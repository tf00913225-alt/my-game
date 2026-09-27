"use strict";

const {assembleCanonicalSnapshot,verifyCanonicalSnapshotAgainstSources,claimRecordsDigest}=
    require("./canonical-snapshot");
const {createRecoveryArchive}=require("./canonical-recovery-archive");
const {source,readOwnedSources,advanceOwnedRecords,advanceOwnedSources}=
    require("./canonical-owned-sources");
const ID=/^[A-Za-z0-9_-]{16,64}$/;
const STATS=new Set(["attack","vitality","energy","intelligence","spirit","agility"]);

// Internal first-character ability allocation. Only a stat choice crosses the
// boundary; points, new values, HP/SP and revision are computed from sources.
function createCanonicalAttributeAllocation({db,FieldValue,HttpsError,runProtected,
    inspectExistingEnvelope,nextRevision}){
    const fail=(code,message)=>{throw new HttpsError(code,message);};
    async function allocateAttributePoint(request,{operationId,expectedRevision,stat}){
        if(!ID.test(operationId||"")||!STATS.has(stat)||
           !Number.isSafeInteger(expectedRevision)||expectedRevision<1){
            fail("invalid-argument","A stat, operation and expected revision are required.");
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
               account.slots[1]!==null||account.slots[2]!==null){
                fail("failed-precondition","First-character source is not eligible.");
            }
            if(operationSnap.exists){
                const receipt=operationSnap.data(),ledger=ledgerSnap.data();
                if(grantOperationSnap.exists||!ledgerSnap.exists||
                   receipt.ownerUid!==uid||receipt.operationId!==operationId||
                   receipt.kind!=="attribute-allocation"||receipt.stat!==stat||
                   receipt.characterId!==account.slots[0]||
                   !Number.isSafeInteger(receipt.allocatedRevision)||
                   receipt.allocatedRevision<1||
                   receipt.allocatedRevision>envelope.serverRevision||
                   !Number.isSafeInteger(receipt.statAfter)||receipt.statAfter<1||
                   !Number.isSafeInteger(receipt.pointsAfter)||receipt.pointsAfter<0||
                   !/^[a-f0-9]{64}$/.test(receipt.snapshotSha256||"")||
                   ledger.ownerUid!==uid||ledger.operationId!==operationId||
                   ledger.kind!=="attribute-allocation"||
                   ledger.characterId!==receipt.characterId||ledger.stat!==stat||
                   ledger.amount!==-1||ledger.statAfter!==receipt.statAfter||
                   ledger.pointsAfter!==receipt.pointsAfter||
                   ledger.allocatedRevision!==receipt.allocatedRevision||
                   ledger.snapshotSha256!==receipt.snapshotSha256){
                    fail("data-loss","Attribute allocation receipt is inconsistent.");
                }
                return {allocatedRevision:receipt.allocatedRevision,stat,
                    statAfter:receipt.statAfter,pointsAfter:receipt.pointsAfter,
                    unchanged:true,authoritativeStateReady:false};
            }
            if(grantOperationSnap.exists||ledgerSnap.exists){
                fail("failed-precondition","Operation ID is already used.");
            }
            if(envelope.serverRevision!==expectedRevision){
                fail("aborted","CLOUD_REVISION_CONFLICT");
            }
            const previous=account.serverRevision;
            if(!Number.isSafeInteger(previous)||previous<1||
               previous>expectedRevision||
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
            const keys=[...STATS,"attributePoints","bonusHP","bonusSP","hp","sp"];
            if(character.characterId!==account.slots[0]||
               keys.some(key=>!Number.isSafeInteger(state[key])||state[key]<0)||
               state.hp>100+state.vitality*50+state.bonusHP||
               state.sp>50+state.energy*15+state.bonusSP){
                fail("data-loss","Character ability state is invalid.");
            }
            if(state.attributePoints<1){
                fail("failed-precondition","No attribute points remain.");
            }
            if(state[stat]>=Number.MAX_SAFE_INTEGER){
                fail("failed-precondition","Attribute exceeds safe range.");
            }
            const revision=nextRevision(envelope);
            const nextState={...state,[stat]:state[stat]+1,
                attributePoints:state.attributePoints-1};
            const nextClaimRecords=records.claimRecords.map(record=>
                ({...record,serverRevision:revision}));
            const nextRecords={...records,...advanceOwnedRecords(records,revision),
                account:{...records.account,serverRevision:revision},
                characters:[{...character,serverRevision:revision,state:nextState}],
                economy:{...records.economy,serverRevision:revision},
                relicLoadout:{...records.relicLoadout,serverRevision:revision},
                progress:{...records.progress,serverRevision:revision},
                claimCheckpoint:{...records.claimCheckpoint,serverRevision:revision,
                    claimDigest:claimRecordsDigest(nextClaimRecords)}};
            let bundle;
            try{bundle=assembleCanonicalSnapshot(uid,revision,nextRecords);}
            catch(_){fail("data-loss","Next character projection is invalid.");}
            const stamp=FieldValue.serverTimestamp();
            tx.update(accountRef,{serverRevision:revision,snapshotSha256:bundle.sha256,updatedAt:stamp});
            tx.update(characterRef,{serverRevision:revision,state:nextState,updatedAt:stamp});
            tx.update(economyRef,{serverRevision:revision,updatedAt:stamp});
            for(const ref of [loadoutRef,progressRef]){
                tx.update(ref,{serverRevision:revision,updatedAt:stamp});
            }
            tx.update(checkpointRef,{serverRevision:revision,
                claimDigest:nextRecords.claimCheckpoint.claimDigest,updatedAt:stamp});
            advanceOwnedSources(tx,owned.refs,revision,stamp);
            tx.create(root.collection("playableSnapshots").doc(String(revision)),
                {...bundle,createdAt:stamp});
            tx.create(root.collection("recoveryArchives").doc(String(revision)),
                {...createRecoveryArchive(uid,revision,nextRecords,bundle),createdAt:stamp});
            const receipt={schemaVersion:1,ownerUid:uid,operationId,
                kind:"attribute-allocation",characterId:character.characterId,
                stat,statAfter:nextState[stat],
                pointsAfter:nextState.attributePoints,allocatedRevision:revision,
                snapshotSha256:bundle.sha256,createdAt:stamp};
            tx.create(operationRef,receipt);
            tx.create(ledgerRef,{...receipt,amount:-1});
            tx.update(envelopeRef,{serverRevision:revision,updatedAt:stamp});
            return {allocatedRevision:revision,stat,statAfter:nextState[stat],
                pointsAfter:nextState.attributePoints,unchanged:false,
                authoritativeStateReady:false};
        });
    }
    return Object.freeze({allocateAttributePoint});
}
module.exports={createCanonicalAttributeAllocation};
