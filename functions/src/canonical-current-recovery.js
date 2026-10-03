"use strict";

const {assembleCanonicalSnapshot,claimRecordsDigest,inspectCanonicalSnapshot}=
    require("./canonical-snapshot");
const {inspectRecoveryArchive,createRecoveryArchive}=
    require("./canonical-recovery-archive");

const OPERATION_ID=/^[A-Za-z0-9_-]{16,64}$/;
const SETS={
    characters:record=>record.characterId,
    inventory:record=>record.ownedItemId,
    equipment:record=>`${record.characterId}_${record.slot}`,
    relics:record=>record.relicId,
    claimRecords:record=>record.claimKey
};
const SINGLES={account:"current",economy:"current",relicLoadout:"current",
    progress:"current",claimCheckpoint:"current"};

// Internal operator-approved repair of the *current* canonical revision only.
// No earlier revision or later claim/receipt can be rolled back. Approval must
// be written through a separately authorized server operator path, never by a
// browser. There is deliberately no callable or player recovery UI.
function createCanonicalCurrentRecovery({db,FieldValue,HttpsError,runProtected,
    inspectExistingEnvelope,nextRevision,now=Date.now}){
    const fail=(code,message)=>{throw new HttpsError(code,message);};
    async function restoreCurrent(request,{operationId,expectedRevision}){
        if(!OPERATION_ID.test(operationId||"")||
           !Number.isSafeInteger(expectedRevision)||expectedRevision<2){
            fail("invalid-argument","A recovery operation and current revision are required.");
        }
        return runProtected(request,async(tx,session)=>{
            const uid=session.uid,root=db.collection("serverUsers").doc(uid);
            const envelopeRef=db.collection("users").doc(uid).collection("saves").doc("current");
            const archiveRef=root.collection("recoveryArchives").doc(String(expectedRevision));
            const snapshotRef=root.collection("playableSnapshots").doc(String(expectedRevision));
            const approvalRef=root.collection("recoveryApprovals").doc(operationId);
            const operationRef=root.collection("operations").doc(operationId);
            const auditRef=root.collection("recoveryAudits").doc(operationId);
            const grantRef=root.collection("grantOperations").doc(operationId);
            const ledgerRef=root.collection("ledgerEntries").doc(operationId);
            const refs=[envelopeRef,archiveRef,snapshotRef,approvalRef,operationRef,
                auditRef,grantRef,ledgerRef];
            const [envelopeSnap,archiveSnap,snapshotSnap,approvalSnap,operationSnap,
                auditSnap,grantSnap,ledgerSnap]=await Promise.all(refs.map(ref=>tx.get(ref)));
            if(!envelopeSnap.exists||!archiveSnap.exists||!snapshotSnap.exists){
                fail("failed-precondition","Current recovery sources are missing.");
            }
            const envelope=inspectExistingEnvelope(envelopeSnap.data(),uid);
            if(envelope.kind!=="current"||envelope.data.authoritativeStateReady!==false){
                fail("failed-precondition","Only an unpublished canonical account can be repaired.");
            }
            let records;
            try{records=inspectRecoveryArchive(archiveSnap.data(),uid,
                expectedRevision,snapshotSnap.data());}
            catch(_){fail("data-loss","Recovery archive or original snapshot is corrupt.");}
            if(records.account.provenance!=="server-created"||
               records.account.slots[1]!==null||records.account.slots[2]!==null){
                fail("failed-precondition","Only the first server-created character is eligible.");
            }
            if(operationSnap.exists){
                const receipt=operationSnap.data(),audit=auditSnap.data(),
                    approval=approvalSnap.data();
                if(grantSnap.exists||ledgerSnap.exists||!auditSnap.exists||!approvalSnap.exists||
                   receipt.kind!=="canonical-current-recovery"||receipt.ownerUid!==uid||
                   receipt.operationId!==operationId||receipt.sourceRevision!==expectedRevision||
                   receipt.sourceSha256!==archiveSnap.get("sourceSha256")||
                   !Number.isSafeInteger(receipt.restoredRevision)||
                   receipt.restoredRevision!==expectedRevision+1||
                   receipt.restoredRevision>envelope.serverRevision||
                   !/^[a-f0-9]{64}$/.test(receipt.snapshotSha256||"")||
                   audit.ownerUid!==uid||audit.operationId!==operationId||
                   audit.sourceRevision!==expectedRevision||
                   audit.restoredRevision!==receipt.restoredRevision||
                   audit.snapshotSha256!==receipt.snapshotSha256||
                   approval.status!=="used"||
                   approval.usedRevision!==receipt.restoredRevision){
                    fail("data-loss","Recovery receipt or audit is inconsistent.");
                }
                const restored=await tx.get(root.collection("playableSnapshots")
                    .doc(String(receipt.restoredRevision)));
                try{
                    if(!restored.exists||restored.get("sha256")!==receipt.snapshotSha256){
                        throw new Error("Missing recovered snapshot.");
                    }
                    inspectCanonicalSnapshot(restored.data(),uid,receipt.restoredRevision);
                }catch(_){fail("data-loss","Recovered snapshot is inconsistent.");}
                return {restoredRevision:receipt.restoredRevision,unchanged:true,
                    authoritativeStateReady:false};
            }
            if(auditSnap.exists||grantSnap.exists||ledgerSnap.exists){
                fail("failed-precondition","Recovery operation ID is already used.");
            }
            if(envelope.serverRevision!==expectedRevision){
                fail("aborted","CLOUD_REVISION_CONFLICT");
            }
            const approval=approvalSnap.data();
            if(!approvalSnap.exists||approval.schemaVersion!==1||approval.ownerUid!==uid||
               approval.operationId!==operationId||approval.status!=="approved"||
               approval.sourceRevision!==expectedRevision||
               approval.sourceSha256!==archiveSnap.get("sourceSha256")||
               approval.snapshotSha256!==snapshotSnap.get("sha256")||
               typeof approval.approvedBy!=="string"||!approval.approvedBy.trim()||
               typeof approval.expiresAt?.toMillis!=="function"||
               approval.expiresAt.toMillis()<=now()){
                fail("permission-denied","A current server operator approval is required.");
            }
            // Query all affected collections before writing. Unknown documents
            // cannot be silently erased or hidden by a repaired snapshot.
            const setNames=Object.keys(SETS);
            const singleNames=Object.keys(SINGLES);
            const [queries,singles]=await Promise.all([
                Promise.all(setNames.map(name=>tx.get(root.collection(name)))),
                Promise.all(singleNames.map(name=>tx.get(root.collection(
                    name==="claimCheckpoint"?"claimCheckpoints":name).doc(SINGLES[name]))))
            ]);
            if(queries.reduce((sum,query)=>sum+query.size,0)>400){
                fail("failed-precondition","Recovery source set exceeds the transaction budget.");
            }
            for(let i=0;i<setNames.length;i++){
                const name=setNames[i],keys=new Set(records[name].map(SETS[name]));
                if(queries[i].docs.some(doc=>!keys.has(doc.id))){
                    fail("data-loss","Unexpected current source blocks recovery.");
                }
            }
            const revision=nextRevision(envelope);
            const next={...records};
            for(const name of Object.keys(SINGLES)){
                next[name]={...records[name],serverRevision:revision};
            }
            for(const name of setNames){
                next[name]=records[name].map(record=>({...record,serverRevision:revision}));
            }
            next.claimCheckpoint={...next.claimCheckpoint,
                claimDigest:claimRecordsDigest(next.claimRecords)};
            let bundle,archive;
            try{
                bundle=assembleCanonicalSnapshot(uid,revision,next);
                archive=createRecoveryArchive(uid,revision,next,bundle);
            }catch(_){fail("data-loss","Recovered sources cannot form a complete revision.");}
            const stamp=FieldValue.serverTimestamp();
            const originalStamp=snapshot=>
                typeof snapshot?.get("createdAt")?.toMillis==="function"
                    ?snapshot.get("createdAt"):stamp;
            for(let i=0;i<singleNames.length;i++){
                const name=singleNames[i],id=SINGLES[name];
                const ref=root.collection(name==="claimCheckpoint"?"claimCheckpoints":name).doc(id);
                tx.set(ref,{...next[name],...(name==="account"?{snapshotSha256:bundle.sha256}:{}),
                    createdAt:originalStamp(singles[i]),updatedAt:stamp});
            }
            for(const name of setNames){
                const existing=new Map(queries[setNames.indexOf(name)].docs.map(doc=>[doc.id,doc]));
                for(const record of next[name]){
                    tx.set(root.collection(name).doc(SETS[name](record)),
                        {...record,createdAt:originalStamp(existing.get(SETS[name](record))),
                            updatedAt:stamp});
                }
            }
            tx.create(root.collection("playableSnapshots").doc(String(revision)),
                {...bundle,createdAt:stamp});
            tx.create(root.collection("recoveryArchives").doc(String(revision)),
                {...archive,createdAt:stamp});
            const receipt={schemaVersion:1,ownerUid:uid,
                kind:"canonical-current-recovery",operationId,
                sourceRevision:expectedRevision,restoredRevision:revision,
                sourceSha256:archiveSnap.get("sourceSha256"),
                snapshotSha256:bundle.sha256,approvedBy:approval.approvedBy,
                authoritativeStateReady:false,createdAt:stamp};
            tx.create(operationRef,receipt);
            tx.create(auditRef,receipt);
            tx.update(approvalRef,{status:"used",usedRevision:revision,usedAt:stamp});
            tx.update(envelopeRef,{serverRevision:revision,updatedAt:stamp});
            return {restoredRevision:revision,unchanged:false,
                authoritativeStateReady:false};
        });
    }
    return Object.freeze({restoreCurrent});
}

module.exports={createCanonicalCurrentRecovery};
