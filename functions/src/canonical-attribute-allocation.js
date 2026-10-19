"use strict";

const {assembleCanonicalSnapshot,verifyCanonicalSnapshotAgainstSources,claimRecordsDigest}=
    require("./canonical-snapshot");
const {createRecoveryArchive}=require("./canonical-recovery-archive");
const {source,readCharacterSources,readOwnedSources,advanceOwnedRecords,advanceOwnedSources}=
    require("./canonical-owned-sources");
const ID=/^[A-Za-z0-9_-]{16,64}$/;
const STATS=new Set(["attack","intelligence","vitality","energy","defensePoints","agility"]);

function verifyAttributeAllocationEvidence({uid,operationId,currentRevision,characterId,stat,
    receipt,ledger,grantExists,fail}){
    if(!STATS.has(stat)||grantExists||!ledger||receipt.ownerUid!==uid||
       receipt.operationId!==operationId||receipt.kind!=="attribute-allocation"||receipt.stat!==stat||
       receipt.characterId!==characterId||!Number.isSafeInteger(receipt.allocatedRevision)||
       receipt.allocatedRevision<1||receipt.allocatedRevision>currentRevision||
       !Number.isSafeInteger(receipt.statAfter)||receipt.statAfter<1||
       !Number.isSafeInteger(receipt.pointsAfter)||receipt.pointsAfter<0||
       !/^[a-f0-9]{64}$/.test(receipt.snapshotSha256||"")||
       ledger.ownerUid!==uid||ledger.operationId!==operationId||ledger.kind!=="attribute-allocation"||
       ledger.characterId!==receipt.characterId||ledger.stat!==stat||ledger.amount!==-1||
       ledger.statAfter!==receipt.statAfter||ledger.pointsAfter!==receipt.pointsAfter||
       ledger.allocatedRevision!==receipt.allocatedRevision||ledger.snapshotSha256!==receipt.snapshotSha256){
        fail("data-loss","Attribute allocation receipt is inconsistent.");
    }
}

function migrateLegacyCanonicalCharacterState(state){
    if(!state||typeof state!=="object"||Array.isArray(state)){ throw new Error("Invalid canonical character state."); }
    const next={...state};
    const legacySpirit=state.spirit;
    if(legacySpirit!==undefined&&(!Number.isSafeInteger(legacySpirit)||legacySpirit<0)){
        throw new Error("Invalid legacy Spirit allocation.");
    }
    if(!Number.isSafeInteger(state.attributePoints)||state.attributePoints<0){
        throw new Error("Invalid unspent attribute points.");
    }
    if(legacySpirit){
        if(!Number.isSafeInteger(state.attributePoints+legacySpirit)){ throw new Error("Legacy point refund exceeds safe range."); }
        next.attributePoints=state.attributePoints+legacySpirit;
    }
    if(state.defensePoints===undefined){ next.defensePoints=0; }
    else if(!Number.isSafeInteger(state.defensePoints)||state.defensePoints<0){
        throw new Error("Invalid Defense allocation.");
    }
    delete next.spirit;
    return next;
}

// Internal first-character ability allocation. Only a stat choice crosses the
// boundary; points, new values, HP/SP and revision are computed from sources.
function createCanonicalAttributeAllocation({db,FieldValue,HttpsError,runProtected,
    inspectExistingEnvelope,nextRevision}){
    const fail=(code,message)=>{throw new HttpsError(code,message);};
    async function allocateAttributePoint(request,{operationId,expectedRevision,stat,characterId}){
        if(!ID.test(operationId||"")||(characterId!==undefined&&(typeof characterId!=="string"||!characterId))||!STATS.has(stat)||
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
               !account.slots[0]){
                fail("failed-precondition","First-character source is not eligible.");
            }
            const targetId=characterId===undefined?account.slots[0]:characterId;
            if(!account.slots.includes(targetId))fail("invalid-argument","Character target is not owned.");
            if(operationSnap.exists){
                const receipt=operationSnap.data(),ledger=ledgerSnap.data();
                verifyAttributeAllocationEvidence({uid,operationId,currentRevision:envelope.serverRevision,
                    characterId:targetId,stat,receipt,ledger,grantExists:grantOperationSnap.exists,fail});
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
            const priorRef=root.collection("playableSnapshots").doc(String(previous));
            const [characters,priorSnap]=await Promise.all([
                readCharacterSources(tx,root,account,fail),tx.get(priorRef)]);
            if(!priorSnap.exists||
               priorSnap.get("sha256")!==account.snapshotSha256){
                fail("data-loss","Previous canonical snapshot is missing.");
            }
            const owned=await readOwnedSources(tx,root,fail);
            const records={account:source(account),characters:characters.records,
                economy:source(economy),...owned.records,
                relicLoadout:source(loadoutSnap.data()),progress:source(progressSnap.data()),
                claimCheckpoint:source(checkpointSnap.data())};
            try{verifyCanonicalSnapshotAgainstSources(priorSnap.data(),uid,previous,records);}
            catch(_){fail("data-loss","Previous sources differ from snapshot.");}
            const sourceCharacter=records.characters.find(row=>row.characterId===targetId);
            let migratedState;
            try{ migratedState=migrateLegacyCanonicalCharacterState(sourceCharacter.state); }
            catch(_){ fail("data-loss","Character ability migration is invalid."); }
            const character={...sourceCharacter,state:migratedState},state=character.state;
            const keys=[...STATS,"attributePoints","bonusHP","bonusSP","hp","sp"];
            if(character.characterId!==targetId||
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
                characters:records.characters.map(row=>({...row,serverRevision:revision,
                    ...(row.characterId===targetId?{state:nextState}:{})})),
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
            characters.refs.forEach((ref,index)=>tx.update(ref,{serverRevision:revision,
                ...(records.characters[index].characterId===targetId?{state:nextState}:{}),updatedAt:stamp}));
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
module.exports={createCanonicalAttributeAllocation,migrateLegacyCanonicalCharacterState,verifyAttributeAllocationEvidence};
