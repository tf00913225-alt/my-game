"use strict";

const {inspectCanonicalSnapshot}=require("./canonical-snapshot");
const {inspectRecoveryArchive}=require("./canonical-recovery-archive");

const OPERATION_ID=/^[A-Za-z0-9_-]{16,64}$/;
const UID=/^[A-Za-z0-9:_-]{1,128}$/;
const MIN_TTL_SECONDS=60;
const MAX_TTL_SECONDS=15*60;

function createCanonicalRecoveryApproval({db,Timestamp,HttpsError,inspectExistingEnvelope,now=Date.now}){
    const fail=(code,message)=>{throw new HttpsError(code,message);};

    function requireOperator(request){
        const uid=request&&request.auth&&request.auth.uid;
        const token=request&&request.auth&&request.auth.token;
        if(!uid){ fail("unauthenticated","Firebase Authentication is required."); }
        if(token?.cloudSaveOperator!==true){
            fail("permission-denied","A Cloud Save operator claim is required.");
        }
        return uid;
    }

    async function issue(request){
        const operatorUid=requireOperator(request);
        const data=request&&request.data&&typeof request.data==="object"
            ?request.data:{};
        const allowed=["ownerUid","operationId","sourceRevision","ttlSeconds"];
        if(Object.keys(data).some(key=>!allowed.includes(key))){
            fail("invalid-argument","Only an owner, operation and source revision are accepted.");
        }
        const ownerUid=data.ownerUid;
        const operationId=data.operationId;
        const sourceRevision=data.sourceRevision;
        const ttlSeconds=data.ttlSeconds===undefined?5*60:data.ttlSeconds;
        if(typeof ownerUid!=="string"||!UID.test(ownerUid)||
           !OPERATION_ID.test(operationId||"")||
           !Number.isSafeInteger(sourceRevision)||sourceRevision<2||
           !Number.isSafeInteger(ttlSeconds)||
           ttlSeconds<MIN_TTL_SECONDS||ttlSeconds>MAX_TTL_SECONDS){
            fail("invalid-argument","A valid owner, operation, revision and TTL are required.");
        }

        const root=db.collection("serverUsers").doc(ownerUid);
        const saveRef=db.collection("users").doc(ownerUid)
            .collection("saves").doc("current");
        const archiveRef=root.collection("recoveryArchives").doc(String(sourceRevision));
        const snapshotRef=root.collection("playableSnapshots").doc(String(sourceRevision));
        const approvalRef=root.collection("recoveryApprovals").doc(operationId);
        const issuedAt=now();
        const expiresAtMs=issuedAt+ttlSeconds*1000;

        return db.runTransaction(async transaction=>{
            const [saveSnapshot,archiveSnapshot,snapshot,approval]=await Promise.all([
                transaction.get(saveRef),transaction.get(archiveRef),
                transaction.get(snapshotRef),transaction.get(approvalRef)
            ]);
            if(!saveSnapshot.exists||!archiveSnapshot.exists||!snapshot.exists){
                fail("failed-precondition","Recovery sources are missing.");
            }

            let envelope;
            try{
                envelope=inspectExistingEnvelope(saveSnapshot.data(),ownerUid);
                if(envelope.kind!=="current"||
                   envelope.serverRevision!==sourceRevision||
                   envelope.data.authoritativeStateReady!==false){
                    fail("failed-precondition","Only the current unpublished canonical revision may be approved.");
                }
                inspectCanonicalSnapshot(snapshot.data(),ownerUid,sourceRevision);
                inspectRecoveryArchive(archiveSnapshot.data(),ownerUid,
                    sourceRevision,snapshot.data());
            }catch(error){
                if(error instanceof HttpsError){ throw error; }
                fail("data-loss","Recovery sources are corrupt or inconsistent.");
            }

            const sourceSha256=archiveSnapshot.get("sourceSha256");
            const snapshotSha256=snapshot.get("sha256");
            if(typeof sourceSha256!=="string"||typeof snapshotSha256!=="string"||
               archiveSnapshot.get("snapshotSha256")!==snapshotSha256){
                fail("data-loss","Recovery source digests are inconsistent.");
            }

            if(approval.exists){
                const existing=approval.data();
                if(existing.ownerUid!==ownerUid||existing.operationId!==operationId||
                   existing.sourceRevision!==sourceRevision||
                   existing.sourceSha256!==sourceSha256||
                   existing.snapshotSha256!==snapshotSha256||
                   existing.approvedBy!==operatorUid||
                   existing.status!=="approved"||
                   typeof existing.expiresAt?.toMillis!=="function"){
                    fail("data-loss","Recovery approval is inconsistent.");
                }
                return {
                    approved:true,unchanged:true,ownerUid,operationId,sourceRevision,
                    sourceSha256,snapshotSha256,approvedBy:operatorUid,
                    expiresAtMs:existing.expiresAt.toMillis()
                };
            }

            const stamp=Timestamp.fromMillis(issuedAt);
            transaction.create(approvalRef,{
                schemaVersion:1,kind:"canonical-current-recovery-approval",
                ownerUid,operationId,sourceRevision,sourceSha256,snapshotSha256,
                approvedBy:operatorUid,status:"approved",
                issuedAt:stamp,expiresAt:Timestamp.fromMillis(expiresAtMs)
            });
            return {
                approved:true,unchanged:false,ownerUid,operationId,sourceRevision,
                sourceSha256,snapshotSha256,approvedBy:operatorUid,expiresAtMs
            };
        });
    }

    return Object.freeze({issue});
}

module.exports={createCanonicalRecoveryApproval};
