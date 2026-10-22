"use strict";

const {inspectCanonicalSnapshot}=require("./canonical-snapshot");
const {inspectRecoveryArchive}=require("./canonical-recovery-archive");
const {inspectRecoveryAuditFence,RECOVERY_AUDIT_FENCE_COLLECTION}=require("./canonical-current-recovery");

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
        const allowed=["ownerUid","operationId","sourceRevision","ttlSeconds","canonicalRevision"];
        if(Object.keys(data).some(key=>!allowed.includes(key))){
            fail("invalid-argument","Only an owner, operation and source revision are accepted.");
        }
        const ownerUid=data.ownerUid;
        const operationId=data.operationId;
        const sourceRevision=data.sourceRevision;
        const heroVersion=Object.hasOwn(data,"canonicalRevision");
        const canonicalRevision=heroVersion?data.canonicalRevision:sourceRevision;
        const schemaVersion=heroVersion?2:1;
        const captureBinding=heroVersion?{canonicalRevision,namespaceVersion:3}:{};
        const ttlSeconds=data.ttlSeconds===undefined?5*60:data.ttlSeconds;
        if(typeof ownerUid!=="string"||!UID.test(ownerUid)||
           !OPERATION_ID.test(operationId||"")||
           !Number.isSafeInteger(sourceRevision)||sourceRevision<2||
           !Number.isSafeInteger(canonicalRevision)||canonicalRevision<2||canonicalRevision>sourceRevision||
           !Number.isSafeInteger(ttlSeconds)||
           ttlSeconds<MIN_TTL_SECONDS||ttlSeconds>MAX_TTL_SECONDS){
            fail("invalid-argument","A valid owner, operation, revision and TTL are required.");
        }

        const root=db.collection("serverUsers").doc(ownerUid);
        const saveRef=db.collection("users").doc(ownerUid)
            .collection("saves").doc("current");
        const archiveRef=root.collection("recoveryArchives").doc(String(canonicalRevision));
        const snapshotRef=root.collection("playableSnapshots").doc(String(canonicalRevision));
        const approvalRef=root.collection("recoveryApprovals").doc(operationId);
        const issuedAt=now();
        const expiresAtMs=issuedAt+ttlSeconds*1000;

        return db.runTransaction(async transaction=>{
            const [saveSnapshot,archiveSnapshot,snapshot,approval,fenceSnapshot,accountPointer]=await Promise.all([
                transaction.get(saveRef),transaction.get(archiveRef),
                transaction.get(snapshotRef),transaction.get(approvalRef),
                transaction.get(root.collection(RECOVERY_AUDIT_FENCE_COLLECTION).doc("current")),
                ...(heroVersion?[transaction.get(root.collection("account").doc("current"))]:[])
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
                // The new field is an expected current pointer, never an
                // operator-selected historical archive. Missing sources remain
                // blocked; this adds no disaster-restore authority.
                if(heroVersion&&(!accountPointer?.exists||accountPointer.get("ownerUid")!==ownerUid||
                   accountPointer.get("serverRevision")!==canonicalRevision||
                   accountPointer.get("snapshotSha256")!==snapshot.get("sha256"))){
                    fail("failed-precondition","The expected current canonical pointer is required.");
                }
                inspectCanonicalSnapshot(snapshot.data(),ownerUid,canonicalRevision);
                inspectRecoveryArchive(archiveSnapshot.data(),ownerUid,
                    canonicalRevision,snapshot.data());
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
                if(existing.schemaVersion!==schemaVersion||
                   existing.kind!=="canonical-current-recovery-approval"||
                   existing.ownerUid!==ownerUid||existing.operationId!==operationId||
                   existing.sourceRevision!==sourceRevision||
                   (heroVersion&&(existing.canonicalRevision!==canonicalRevision||existing.namespaceVersion!==3))||
                   (!heroVersion&&(Object.hasOwn(existing,"canonicalRevision")||Object.hasOwn(existing,"namespaceVersion")))||
                   existing.sourceSha256!==sourceSha256||
                   existing.snapshotSha256!==snapshotSha256||
                   existing.approvedBy!==operatorUid||
                   existing.status!=="approved"||
                   typeof existing.expiresAt?.toMillis!=="function"){
                    fail("data-loss","Recovery approval is inconsistent.");
                }
                return {
                    approved:true,unchanged:true,ownerUid,operationId,sourceRevision,...captureBinding,
                    sourceSha256,snapshotSha256,approvedBy:operatorUid,
                    expiresAtMs:existing.expiresAt.toMillis()
                };
            }

            const fence=inspectRecoveryAuditFence(fenceSnapshot.exists?fenceSnapshot.data():undefined,ownerUid,fail);
            if(fence?.status==="active")fail("failed-precondition","Recovery audit maintenance blocks new approvals.");

            const stamp=Timestamp.fromMillis(issuedAt);
            transaction.create(approvalRef,{
                schemaVersion,kind:"canonical-current-recovery-approval",
                ownerUid,operationId,sourceRevision,...captureBinding,sourceSha256,snapshotSha256,
                approvedBy:operatorUid,status:"approved",
                issuedAt:stamp,expiresAt:Timestamp.fromMillis(expiresAtMs)
            });
            return {
                approved:true,unchanged:false,ownerUid,operationId,sourceRevision,...captureBinding,
                sourceSha256,snapshotSha256,approvedBy:operatorUid,expiresAtMs
            };
        });
    }

    return Object.freeze({issue});
}

module.exports={createCanonicalRecoveryApproval};
