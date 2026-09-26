"use strict";

const {assembleCanonicalSnapshot}=require("./canonical-snapshot");

const OPERATION_ID=/^[A-Za-z0-9_-]{16,64}$/;

// This is an internal transaction owner. No callable accepts source records.
// A future trusted character-creation owner must construct the complete
// server-created source set and call this with an already verified session.
function createCanonicalSourceWriter({db,FieldValue,HttpsError,runProtected,
    inspectExistingEnvelope,nextRevision}){
    const fail=(code,message)=>{ throw new HttpsError(code,message); };

    async function commitInitialSources(request,{operationId,expectedRevision,makeSources}){
        if(!OPERATION_ID.test(operationId||"")||
           !Number.isSafeInteger(expectedRevision)||expectedRevision<1||
           typeof makeSources!=="function"){
            fail("invalid-argument","An internal source operation needs an ID and revision.");
        }
        return runProtected(request,async(transaction,session)=>{
            const uid=session.uid;
            const root=db.collection("serverUsers").doc(uid);
            const envelopeRef=db.collection("users").doc(uid).collection("saves").doc("current");
            const accountRef=root.collection("account").doc("current");
            const operationRef=root.collection("operations").doc(operationId);
            const candidateRef=root.collection("migrationCandidates").doc("latest");
            const [envelopeSnap,accountSnap,operationSnap,candidateSnap]=await Promise.all([
                transaction.get(envelopeRef),transaction.get(accountRef),
                transaction.get(operationRef),transaction.get(candidateRef)
            ]);
            if(!envelopeSnap.exists){ fail("failed-precondition","Bootstrap the cloud account first."); }
            const envelope=inspectExistingEnvelope(envelopeSnap.data(),uid);
            if(envelope.kind!=="current"||envelope.data.authoritativeStateReady!==false){
                fail("failed-precondition","A canonical account cannot be initialized here.");
            }
            if(operationSnap.exists){
                const receipt=operationSnap.data();
                if(!accountSnap.exists||receipt.ownerUid!==uid||
                   receipt.operationId!==operationId||receipt.kind!=="initial-character-sources"||
                   receipt.sourceRevision!==accountSnap.get("serverRevision")||
                   receipt.snapshotSha256!==accountSnap.get("snapshotSha256")||
                   !Number.isSafeInteger(receipt.sourceRevision)||
                   receipt.sourceRevision>envelope.serverRevision){
                    fail("data-loss","Initial character receipt is inconsistent.");
                }
                return {sourceRevision:receipt.sourceRevision,
                    snapshotSha256:receipt.snapshotSha256,unchanged:true,
                    authoritativeStateReady:false};
            }
            if(accountSnap.exists||candidateSnap.exists||
               envelope.data.migrationCandidateStatus!=="none"){
                fail("failed-precondition","An existing character or migration candidate needs review.");
            }
            if(envelope.serverRevision!==expectedRevision){
                fail("aborted","CLOUD_REVISION_CONFLICT");
            }
            const revision=nextRevision(envelope);
            // makeSources is an internal, pure server-owned factory. Never pass
            // request.data or a legacy candidate through this boundary.
            const records=makeSources(uid,revision);
            if(records?.account?.provenance!=="server-created"||
               records.claimRecords?.length!==0||records.characters?.length!==1||
               records.account.slots?.[1]!==null||records.account.slots?.[2]!==null||
               records.characters[0].state?.level!==1||
               records.characters[0].state?.exp!==0||
               records.economy?.gold!==0||records.economy?.sharedExp!==0||
               records.inventory?.length!==0||records.equipment?.length!==0||
               records.relics?.length!==0||
               Object.values(records.progress?.sidecars||{}).some(entry=>
                   entry.status!=="not-applicable"||entry.raw!==null)){
                fail("failed-precondition","Initial source cannot import historical claims.");
            }
            let bundle;
            try{ bundle=assembleCanonicalSnapshot(uid,revision,records); }
            catch(_){ fail("failed-precondition","Initial character sources are incomplete."); }
            const stamp=FieldValue.serverTimestamp();
            const withStamp=record=>({...record,createdAt:stamp,updatedAt:stamp});
            transaction.create(accountRef,withStamp({...records.account,
                snapshotSha256:bundle.sha256}));
            for(const character of records.characters){
                transaction.create(root.collection("characters").doc(character.characterId),
                    withStamp(character));
            }
            transaction.create(root.collection("economy").doc("current"),withStamp(records.economy));
            for(const item of records.inventory){
                transaction.create(root.collection("inventory").doc(item.ownedItemId),withStamp(item));
            }
            for(const equipment of records.equipment){
                transaction.create(root.collection("equipment").doc(
                    `${equipment.characterId}_${equipment.slot}`),withStamp(equipment));
            }
            for(const relic of records.relics){
                transaction.create(root.collection("relics").doc(relic.relicId),withStamp(relic));
            }
            transaction.create(root.collection("relicLoadout").doc("current"),
                withStamp(records.relicLoadout));
            transaction.create(root.collection("progress").doc("current"),
                withStamp(records.progress));
            transaction.create(root.collection("claimCheckpoints").doc("current"),
                withStamp(records.claimCheckpoint));
            transaction.create(root.collection("playableSnapshots").doc(String(revision)),{
                ...bundle,createdAt:stamp
            });
            transaction.create(operationRef,{
                schemaVersion:1,ownerUid:uid,kind:"initial-character-sources",
                operationId,sourceRevision:revision,snapshotSha256:bundle.sha256,
                authoritativeStateReady:false,createdAt:stamp
            });
            // The version-2 public envelope has no playable pointer. Keep the
            // existing Phase-2 invariant until durable recovery is proven.
            transaction.update(envelopeRef,{serverRevision:revision,updatedAt:stamp});
            return {sourceRevision:revision,snapshotSha256:bundle.sha256,
                unchanged:false,authoritativeStateReady:false};
        });
    }
    return Object.freeze({commitInitialSources});
}

module.exports={createCanonicalSourceWriter};
