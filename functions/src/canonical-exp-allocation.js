"use strict";

const {assembleCanonicalSnapshot,verifyCanonicalSnapshotAgainstSources}=
    require("./canonical-snapshot");
const {newcomerExpNext}=require("./canonical-newcomer-exp");
const {source,readOwnedSources,advanceOwnedRecords,advanceOwnedSources}=
    require("./canonical-owned-sources");
const ID=/^[A-Za-z0-9_-]{16,64}$/;
// js/28-v133-economy-rebalance.js owns the current game level ceiling.
const MAX_CHARACTER_LEVEL=100;

// One server-created character, one level per protected operation. The client
// supplies an operation ID and expected revision, never a cost or new stats.
function createCanonicalExpAllocation({db,FieldValue,HttpsError,runProtected,
    inspectExistingEnvelope,nextRevision}){
    const fail=(code,message)=>{throw new HttpsError(code,message);};
    async function allocateSharedExp(request,{operationId,expectedRevision}){
        if(!ID.test(operationId||"")||
           !Number.isSafeInteger(expectedRevision)||expectedRevision<1){
            fail("invalid-argument","An operation and expected revision are required.");
        }
        return runProtected(request,async(tx,session)=>{
            const uid=session.uid,root=db.collection("serverUsers").doc(uid);
            const envelopeRef=db.collection("users").doc(uid).collection("saves").doc("current");
            const accountRef=root.collection("account").doc("current");
            const economyRef=root.collection("economy").doc("current");
            const loadoutRef=root.collection("relicLoadout").doc("current");
            const progressRef=root.collection("progress").doc("current");
            const checkpointRef=root.collection("claimCheckpoints").doc("current");
            const operationRef=root.collection("operations").doc(operationId);
            const grantOperationRef=root.collection("grantOperations").doc(operationId);
            const ledgerRef=root.collection("ledgerEntries").doc(operationId);
            const refs=[envelopeRef,accountRef,economyRef,loadoutRef,progressRef,
                checkpointRef,operationRef,grantOperationRef,ledgerRef];
            const [envelopeSnap,accountSnap,economySnap,loadoutSnap,progressSnap,
                checkpointSnap,operationSnap,grantOperationSnap,ledgerSnap]=
                await Promise.all(refs.map(ref=>tx.get(ref)));
            if(!envelopeSnap.exists||!accountSnap.exists||!economySnap.exists||
               !loadoutSnap.exists||!progressSnap.exists||!checkpointSnap.exists){
                fail("failed-precondition","Complete canonical sources required.");
            }
            const envelope=inspectExistingEnvelope(envelopeSnap.data(),uid);
            const account=accountSnap.data(),economy=economySnap.data();
            if(envelope.kind!=="current"||envelope.data.authoritativeStateReady!==false||
               account.ownerUid!==uid||account.provenance!=="server-created"||
               economy.ownerUid!==uid||!Array.isArray(account.slots)||
               account.slots.length!==3||typeof account.slots[0]!=="string"||
               account.slots[1]!==null||account.slots[2]!==null||
               !Number.isSafeInteger(economy.sharedExp)||economy.sharedExp<0){
                fail("failed-precondition","First-character EXP source is not eligible.");
            }
            if(operationSnap.exists){
                const receipt=operationSnap.data(),ledger=ledgerSnap.data();
                if(grantOperationSnap.exists||!ledgerSnap.exists||
                   receipt.ownerUid!==uid||receipt.operationId!==operationId||
                   receipt.kind!=="exp-allocation"||
                   receipt.characterId!==account.slots[0]||
                   !Number.isSafeInteger(receipt.allocatedRevision)||
                   receipt.allocatedRevision<1||
                   receipt.allocatedRevision>envelope.serverRevision||
                   !Number.isSafeInteger(receipt.cost)||receipt.cost<1||
                   !Number.isSafeInteger(receipt.levelAfter)||receipt.levelAfter<2||
                   !/^[a-f0-9]{64}$/.test(receipt.snapshotSha256||"")||
                   ledger.ownerUid!==uid||ledger.operationId!==operationId||
                   ledger.kind!=="exp-allocation"||
                   ledger.characterId!==receipt.characterId||
                   ledger.amount!==-receipt.cost||
                   ledger.levelAfter!==receipt.levelAfter||
                   ledger.allocatedRevision!==receipt.allocatedRevision||
                   ledger.snapshotSha256!==receipt.snapshotSha256){
                    fail("data-loss","EXP allocation receipt is inconsistent.");
                }
                return {allocatedRevision:receipt.allocatedRevision,
                    cost:receipt.cost,levelAfter:receipt.levelAfter,unchanged:true,
                    authoritativeStateReady:false};
            }
            if(grantOperationSnap.exists||ledgerSnap.exists){
                fail("failed-precondition","Operation ID is already used.");
            }
            if(envelope.serverRevision!==expectedRevision){
                fail("aborted","CLOUD_REVISION_CONFLICT");
            }
            const previous=account.serverRevision;
            if(!Number.isSafeInteger(previous)||previous<1||
               previous>expectedRevision||checkpointSnap.get("claimCount")!==0||
               !/^[a-f0-9]{64}$/.test(account.snapshotSha256||"")){
                fail("failed-precondition","Source revision or claim state is invalid.");
            }
            const characterRef=root.collection("characters").doc(account.slots[0]);
            const priorRef=root.collection("playableSnapshots").doc(String(previous));
            const [characterSnap,priorSnap]=await Promise.all([
                tx.get(characterRef),tx.get(priorRef)]);
            if(!characterSnap.exists||!priorSnap.exists||
               priorSnap.get("sha256")!==account.snapshotSha256){
                fail("data-loss","Previous canonical snapshot is missing.");
            }
            const owned=await readOwnedSources(tx,root,fail);
            const records={account:source(account),characters:[source(characterSnap.data())],
                economy:source(economy),...owned.records,
                relicLoadout:source(loadoutSnap.data()),progress:source(progressSnap.data()),
                claimCheckpoint:source(checkpointSnap.data())};
            try{verifyCanonicalSnapshotAgainstSources(priorSnap.data(),uid,previous,records);}
            catch(_){fail("data-loss","Previous sources differ from snapshot.");}
            const character=records.characters[0],state=character.state;
            const keys=["level","exp","expNext","attributePoints","skillPoints",
                "bonusHP","bonusSP","hp","sp","vitality","energy"];
            if(character.characterId!==account.slots[0]||
               keys.some(key=>!Number.isSafeInteger(state[key])||state[key]<0)||
               state.level<1||state.level>MAX_CHARACTER_LEVEL||
               state.expNext<1||state.exp>=state.expNext||
               state.hp>100+state.vitality*50+state.bonusHP||
               state.sp>50+state.energy*15+state.bonusSP){
                fail("data-loss","Character EXP or resource state is invalid.");
            }
            if(state.level===MAX_CHARACTER_LEVEL){
                fail("failed-precondition","Character has reached the level cap.");
            }
            // Beyond the static newcomer curve the runtime uses a live zone roster.
            // No client-computed threshold can become an authoritative debit.
            if(state.level>=19){
                fail("failed-precondition","Trusted EXP curve is unavailable at this level.");
            }
            if(state.expNext!==newcomerExpNext(state.level)){
                fail("data-loss","Character EXP threshold differs from the trusted curve.");
            }
            const cost=state.expNext-state.exp;
            const nextExpNext=newcomerExpNext(state.level+1);
            if(economy.sharedExp<cost){
                fail("failed-precondition","Shared EXP is insufficient.");
            }
            if(state.level>=Number.MAX_SAFE_INTEGER||
               state.attributePoints>Number.MAX_SAFE_INTEGER-5||
               state.skillPoints>Number.MAX_SAFE_INTEGER-2||
               state.bonusHP>Number.MAX_SAFE_INTEGER-30||
               state.bonusSP>Number.MAX_SAFE_INTEGER-10||
               !Number.isSafeInteger(nextExpNext)){
                fail("failed-precondition","Level or growth exceeds safe range.");
            }
            const revision=nextRevision(envelope);
            const nextState={...state,level:state.level+1,exp:0,
                expNext:nextExpNext,attributePoints:state.attributePoints+5,
                skillPoints:state.skillPoints+2,bonusHP:state.bonusHP+30,
                bonusSP:state.bonusSP+10};
            const nextRecords={...records,...advanceOwnedRecords(records,revision),
                account:{...records.account,serverRevision:revision},
                characters:[{...character,serverRevision:revision,state:nextState}],
                economy:{...records.economy,serverRevision:revision,
                    sharedExp:economy.sharedExp-cost},
                relicLoadout:{...records.relicLoadout,serverRevision:revision},
                progress:{...records.progress,serverRevision:revision},
                claimCheckpoint:{...records.claimCheckpoint,serverRevision:revision}};
            let bundle;
            try{bundle=assembleCanonicalSnapshot(uid,revision,nextRecords);}
            catch(_){fail("data-loss","Next character projection is invalid.");}
            const stamp=FieldValue.serverTimestamp();
            tx.update(accountRef,{serverRevision:revision,snapshotSha256:bundle.sha256,updatedAt:stamp});
            tx.update(characterRef,{serverRevision:revision,state:nextState,updatedAt:stamp});
            tx.update(economyRef,{serverRevision:revision,
                sharedExp:nextRecords.economy.sharedExp,updatedAt:stamp});
            for(const ref of [loadoutRef,progressRef,checkpointRef]){
                tx.update(ref,{serverRevision:revision,updatedAt:stamp});
            }
            advanceOwnedSources(tx,owned.refs,revision,stamp);
            tx.create(root.collection("playableSnapshots").doc(String(revision)),
                {...bundle,createdAt:stamp});
            tx.create(operationRef,{schemaVersion:1,ownerUid:uid,operationId,
                kind:"exp-allocation",characterId:character.characterId,cost,
                levelAfter:nextState.level,allocatedRevision:revision,
                snapshotSha256:bundle.sha256,createdAt:stamp});
            tx.create(ledgerRef,{schemaVersion:1,ownerUid:uid,operationId,
                kind:"exp-allocation",characterId:character.characterId,
                amount:-cost,balanceAfter:nextRecords.economy.sharedExp,
                levelAfter:nextState.level,allocatedRevision:revision,
                snapshotSha256:bundle.sha256,createdAt:stamp});
            tx.update(envelopeRef,{serverRevision:revision,updatedAt:stamp});
            return {allocatedRevision:revision,cost,levelAfter:nextState.level,
                unchanged:false,authoritativeStateReady:false};
        });
    }
    return Object.freeze({allocateSharedExp});
}
module.exports={createCanonicalExpAllocation};
