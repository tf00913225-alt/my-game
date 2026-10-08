"use strict";

const {assembleCanonicalSnapshot,inspectCanonicalSnapshot}=require("./canonical-snapshot");
const {makeInitialCharacterSources}=require("./initial-character-sources");
const {createRecoveryArchive}=require("./canonical-recovery-archive");
const {createHash}=require("node:crypto");

const OPERATION_ID=/^[A-Za-z0-9_-]{16,64}$/;

// Internal transaction owner; its guarded callable accepts choices only.
// Source records and progression are never accepted from the browser.
function createCanonicalSourceWriter({db,FieldValue,HttpsError,runProtected,
    inspectExistingEnvelope,nextRevision,now=Date.now}){
    const fail=(code,message)=>{ throw new HttpsError(code,message); };

    async function commitInitialSources(request,{operationId,expectedRevision,selection},
        {requireCurrentReplay=false}={}){
        if(!OPERATION_ID.test(operationId||"")||
           !Number.isSafeInteger(expectedRevision)||expectedRevision<1){
            fail("invalid-argument","An internal source operation needs an ID and revision.");
        }
        // Pin the server observation outside Firestore transaction retries.
        const recordedAt=now();
        return runProtected(request,async(transaction,session)=>{
            const uid=session.uid;
            let choices;
            try{ choices=makeInitialCharacterSources(uid,expectedRevision+1,
                operationId,selection); }
            catch(_){ fail("invalid-argument","Invalid initial character choices."); }
            const selectionSha256=createHash("sha256").update(JSON.stringify(
                choices.characters[0].state)).digest("hex");
            const root=db.collection("serverUsers").doc(uid);
            const envelopeRef=db.collection("users").doc(uid).collection("saves").doc("current");
            const accountRef=root.collection("account").doc("current");
            const operationRef=root.collection("operations").doc(operationId);
            const grantOperationRef=root.collection("grantOperations").doc(operationId);
            const ledgerRef=root.collection("ledgerEntries").doc(operationId);
            const candidateRef=root.collection("migrationCandidates").doc("latest");
            const [envelopeSnap,accountSnap,operationSnap,grantOperationSnap,
                ledgerSnap,candidateSnap]=await Promise.all([
                transaction.get(envelopeRef),transaction.get(accountRef),
                transaction.get(operationRef),transaction.get(grantOperationRef),
                transaction.get(ledgerRef),transaction.get(candidateRef)
            ]);
            if(!envelopeSnap.exists){ fail("failed-precondition","Bootstrap the cloud account first."); }
            const envelope=inspectExistingEnvelope(envelopeSnap.data(),uid);
            if(envelope.kind!=="current"||envelope.data.authoritativeStateReady!==false){
                fail("failed-precondition","A canonical account cannot be initialized here.");
            }
            if(operationSnap.exists){
                if(grantOperationSnap.exists||ledgerSnap.exists){
                    fail("data-loss","Initial character operation ID overlaps another operation.");
                }
                const receipt=operationSnap.data();
                if(!accountSnap.exists||receipt.ownerUid!==uid||
                   receipt.operationId!==operationId||receipt.kind!=="initial-character-sources"||
                   receipt.selectionSha256!==selectionSha256||
                   !Number.isSafeInteger(receipt.sourceRevision)||
                   receipt.sourceRevision<1||receipt.sourceRevision>envelope.serverRevision||
                   accountSnap.get("ownerUid")!==uid||
                   accountSnap.get("provenance")!=="server-created"||
                   accountSnap.get("slots")?.[0]!==`character-${operationId}`||
                   !Number.isSafeInteger(accountSnap.get("serverRevision"))||
                   accountSnap.get("serverRevision")<receipt.sourceRevision||
                   !/^[a-f0-9]{64}$/.test(receipt.snapshotSha256||"")){
                    fail("data-loss","Initial character receipt is inconsistent.");
                }
                // Later protected mutations advance the account digest. A lost
                // creation response resolves against its original version.
                const original=await transaction.get(root.collection("playableSnapshots")
                    .doc(String(receipt.sourceRevision)));
                let snapshot;
                try{
                    if(!original.exists||original.get("sha256")!==receipt.snapshotSha256){
                        throw new Error("Original source snapshot missing.");
                    }
                    snapshot=inspectCanonicalSnapshot(original.data(),uid,receipt.sourceRevision);
                }catch(_){ fail("data-loss","Initial character snapshot is inconsistent."); }
                if(snapshot.provenance!=="server-created"||
                   snapshot.slots?.[0]!==`character-${operationId}`||
                   snapshot.characters?.length!==1||
                   Object.keys(snapshot.characters[0].state||{}).sort().join("|")!==
                       Object.keys(choices.characters[0].state).sort().join("|")||
                   Object.keys(choices.characters[0].state).some(key=>
                       JSON.stringify(snapshot.characters[0].state[key])!==
                       JSON.stringify(choices.characters[0].state[key]))){
                    fail("data-loss","Initial character choices differ from the receipt.");
                }
                if(requireCurrentReplay&&
                   (envelope.serverRevision!==receipt.sourceRevision||
                    receipt.creationSessionId!==session.sessionId)){
                    fail("failed-precondition",
                        "An earlier session or advanced character cannot start a local save.");
                }
                return {sourceRevision:receipt.sourceRevision,
                    snapshotSha256:receipt.snapshotSha256,unchanged:true,
                    authoritativeStateReady:false};
            }
            if(grantOperationSnap.exists||ledgerSnap.exists){
                fail("failed-precondition","Operation ID is already used.");
            }
            if(accountSnap.exists||candidateSnap.exists||
               envelope.data.migrationCandidateStatus!=="none"){
                fail("failed-precondition","An existing character or migration candidate needs review.");
            }
            if(envelope.serverRevision!==expectedRevision){
                fail("aborted","CLOUD_REVISION_CONFLICT");
            }
            const revision=nextRevision(envelope);
            const records=makeInitialCharacterSources(uid,revision,operationId,selection,{recordedAt});
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
            transaction.create(root.collection("recoveryArchives").doc(String(revision)),{
                ...createRecoveryArchive(uid,revision,records,bundle),createdAt:stamp
            });
            transaction.create(operationRef,{
                schemaVersion:1,ownerUid:uid,kind:"initial-character-sources",
                operationId,sourceRevision:revision,snapshotSha256:bundle.sha256,
                selectionSha256,
                ...(session.sessionId?{creationSessionId:session.sessionId}:{}),
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
