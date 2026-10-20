"use strict";

const {assembleCanonicalSnapshot,claimRecordsDigest,snapshotDigest}=
    require("./canonical-snapshot");
const {inspectRecoveryArchive,createRecoveryArchive}=
    require("./canonical-recovery-archive");
const {verifyCreditedGrant,verifyReservedGrant,verifyServerIssuedGrant}=require("./credited-grant-evidence");
const {readDailyCheckinEvidence}=require("./daily-checkin-event-evidence");
const {verifyShopPurchaseEvidence}=require("./canonical-shop-purchase");
const {verifyExpAllocationEvidence}=require("./canonical-exp-allocation");
const {verifyAttributeAllocationEvidence}=require("./canonical-attribute-allocation");
const {verifySkillLearningEvidence,skillLearningEvidenceReadBudget}=require("./canonical-skill-learning");
const {createCanonicalSourceWriter}=require("./canonical-source-writer");
const {createCanonicalPatrolSettlement}=require("./canonical-patrol-settlement");
const {createRecoveryAuditAssemblyBudget,reserveRecoveryAuditRawInputs,finishRecoveryAuditRawInputs,recoveryAuditAssemblyUsage,chargeRecoveryAuditAssembly,admitRecoveryAuditAssemblyBytes,recoveryAuditQueryShapes,
    prepareRecoveryAuditCandidateEncoding,decodeRecoveryAuditArtifact,drainAndCloseRecoveryAuditLookups,recoveryAuditNamespaces,encodeInventoryPayload,decodeInventoryPayload,
    inventoryDocumentMetadata,INVENTORY_LIMITS,encodeProofPayload,decodeProofPayload,indexRawProofPayload,decodeIndexedRawProofRow,PATROL_PROOF_LIMITS}=require("./recovery-audit-artifact");
const {createHash}=require("node:crypto");
const {createRecoveryCandidateStorage}=require("./recovery-candidate-storage");

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
const RECOVERY_AUDIT_FENCE_COLLECTION="recoveryAuditFence";
const RECOVERY_AUDIT_RUN_COLLECTION="recoveryAuditRuns";
const RECOVERY_INVENTORY_STATE_COLLECTION="captureState";
const RECOVERY_INVENTORY_PAGE_COLLECTION="inventoryPages";
const HEX=/^[a-f0-9]{64}$/;
const SESSION_ID=/^[A-Za-z0-9_-]{32}$/;
function inspectRecoveryAuditFence(value,uid,fail){
    if(value===undefined)return null;
    const keys=["schemaVersion","kind","ownerUid","auditId","epoch","status","sessionId","sessionRevision",
        "sourceRevision","sourceSha256","snapshotSha256","approvalOperationId","approvalBindingSha256",
        "cancelOperationId","cancelIntentSha256","cancelledBySessionId","cancelledBySessionRevision","createdAt","updatedAt"];
    if(!value||Object.keys(value).sort().join("|")!==keys.sort().join("|")||value.schemaVersion!==1||
       value.kind!=="canonical-recovery-audit-fence"||value.ownerUid!==uid||!OPERATION_ID.test(value.auditId||"")||
       !Number.isSafeInteger(value.epoch)||value.epoch<1||!SESSION_ID.test(value.sessionId||"")||
       !Number.isSafeInteger(value.sessionRevision)||value.sessionRevision<1||
       !Number.isSafeInteger(value.sourceRevision)||value.sourceRevision<2||
       !HEX.test(value.sourceSha256||"")||!HEX.test(value.snapshotSha256||"")||
       !OPERATION_ID.test(value.approvalOperationId||"")||!HEX.test(value.approvalBindingSha256||"")||
       !["active","cancelled"].includes(value.status)||
       typeof value.createdAt?.toMillis!=="function"||typeof value.updatedAt?.toMillis!=="function"||
       !Number.isSafeInteger(value.createdAt.toMillis())||!Number.isSafeInteger(value.updatedAt.toMillis())||
       (value.status==="active"?[value.cancelOperationId,value.cancelIntentSha256,value.cancelledBySessionId,value.cancelledBySessionRevision].some(v=>v!==null):
           (!OPERATION_ID.test(value.cancelOperationId||"")||!HEX.test(value.cancelIntentSha256||"")||
            !SESSION_ID.test(value.cancelledBySessionId||"")||!Number.isSafeInteger(value.cancelledBySessionRevision)||value.cancelledBySessionRevision<1))){
        fail("data-loss","Recovery audit fence is inconsistent.");
    }
    if(value.status==="cancelled"&&value.cancelIntentSha256!==snapshotDigest({action:"cancel-audit",ownerUid:uid,
        operationId:value.cancelOperationId,auditId:value.auditId,expectedEpoch:value.epoch})){
        fail("data-loss","Recovery audit cancellation intent is inconsistent.");
    }
    return value;
}

function restoredRecords(records,revision){
    const next={...records};
    for(const name of Object.keys(SINGLES)){
        next[name]={...records[name],serverRevision:revision};
    }
    for(const name of Object.keys(SETS)){
        next[name]=records[name].map(record=>({...record,serverRevision:revision}));
    }
    next.claimCheckpoint={...next.claimCheckpoint,
        claimDigest:claimRecordsDigest(next.claimRecords)};
    return next;
}

// Internal operator-approved repair of the *current* canonical revision only.
// No earlier revision or later claim/receipt can be rolled back. Approval must
// be written through a separately authorized server operator path, never by a
// browser. There is deliberately no callable or player recovery UI.
function createCanonicalCurrentRecovery(deps){
    return buildRecoveryOwner(deps,null,false);
}
function createCanonicalRecoveryMaintenance(deps){
    return buildRecoveryOwner(deps,createRecoveryCandidateStorage(),true);
}
function buildRecoveryOwner({db,FieldValue,HttpsError,runProtected,
    runRecoveryAuditMaintenance,inspectExistingEnvelope,nextRevision,now=Date.now},immutableCandidateIO,maintenanceMode){
    const fail=(code,message)=>{throw new HttpsError(code,message);};
    const sourceEvidence=createCanonicalSourceWriter({db,FieldValue,HttpsError,runProtected,
        inspectExistingEnvelope,nextRevision,now});
    const patrolEvidence=createCanonicalPatrolSettlement({db,FieldValue,HttpsError,runProtected,
        inspectExistingEnvelope,nextRevision,now});
    const modeEvidence=patrolEvidence.modeOwner;
    // The original factory remains disabled. Only the maintenance constructor
    // binds the sole production Storage Owner; no request/dependency can select IO.
    const publicationPins=new WeakMap(),publicationMaterials=new WeakMap(),publicationArtifacts=new WeakMap(),publicationPreparations=new WeakMap();
    const publicationReadProofs=new WeakMap();
    function requirePublicationPreparation(){
        if(immutableCandidateIO===null)fail("failed-precondition","Immutable candidate publication is unavailable.");
    }
    function inspectCurrentRecoverySource(uid,expectedRevision,{envelopeSnap,archiveSnap,snapshotSnap}){
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
        if(records.account.provenance!=="server-created"){
            fail("failed-precondition","Only a server-created canonical account is eligible.");
        }
        return {envelope,records};
    }
    function auditIntent(action,args,keys){
        if(!args||Object.keys(args).sort().join("|")!==keys.slice().sort().join("|")||
           (args.operationId!==undefined&&!OPERATION_ID.test(args.operationId))||
           (args.auditId!==undefined&&!OPERATION_ID.test(args.auditId))||
           (args.expectedRevision!==undefined&&(!Number.isSafeInteger(args.expectedRevision)||args.expectedRevision<2))||
           (args.expectedEpoch!==undefined&&(!Number.isSafeInteger(args.expectedEpoch)||args.expectedEpoch<1))||
           (args.approvalOperationId!==undefined&&!OPERATION_ID.test(args.approvalOperationId))){
            fail("invalid-argument",`An exact recovery audit ${action} intent is required.`);
        }
        if(typeof runRecoveryAuditMaintenance!=="function")fail("failed-precondition","Recovery audit maintenance runner is unavailable.");
    }
    function inspectAuditRun(raw,uid,auditId){
        if(!raw||raw.kind!=="canonical-recovery-audit-run"||raw.auditId!==auditId||!HEX.test(raw.beginIntentSha256||""))
            fail("data-loss","Recovery audit run is inconsistent.");
        const {beginIntentSha256,...value}=raw;
        inspectRecoveryAuditFence({...value,kind:"canonical-recovery-audit-fence"},uid,fail);
        if(beginIntentSha256!==snapshotDigest({action:"begin-audit",ownerUid:uid,operationId:auditId,
            expectedRevision:raw.sourceRevision,approvalOperationId:raw.approvalOperationId})){
            fail("data-loss","Recovery audit begin intent is inconsistent.");
        }
        return raw;
    }
    function matchingAuditFence(fence,run){
        const {beginIntentSha256,kind,...value}=run;
        if(!fence||snapshotDigest(fence)!==snapshotDigest({...value,kind:"canonical-recovery-audit-fence"}))
            fail("data-loss","Recovery audit run and fence differ.");
    }
    function timestampPair(value){
        if(typeof value?.toMillis!=="function")fail("data-loss","Recovery approval timestamp is invalid.");
        let seconds=value.seconds,nanoseconds=value.nanoseconds;
        // The repository transaction fixture represents exact millisecond
        // timestamps; production Node Timestamp exposes seconds/nanoseconds.
        if(seconds===undefined&&nanoseconds===undefined){
            const millis=value.toMillis();
            if(!Number.isSafeInteger(millis))fail("data-loss","Recovery approval timestamp lacks exact precision.");
            seconds=Math.floor(millis/1000);nanoseconds=(millis-seconds*1000)*1000000;
        }
        if(!Number.isSafeInteger(seconds)||seconds<-62135596800||seconds>253402300799||
           !Number.isInteger(nanoseconds)||nanoseconds<0||nanoseconds>999999999)
            fail("data-loss","Recovery approval timestamp is invalid.");
        return {seconds,nanoseconds};
    }
    function auditApprovalBinding(approval,sourceRevision){
        return {schemaVersion:approval.schemaVersion,kind:approval.kind,ownerUid:approval.ownerUid,operationId:approval.operationId,
            sourceRevision,sourceSha256:approval.sourceSha256,snapshotSha256:approval.snapshotSha256,
            approvedBy:approval.approvedBy,status:approval.status,issuedAt:timestampPair(approval.issuedAt),expiresAt:timestampPair(approval.expiresAt)};
    }
    async function verifyAuditApproval(tx,root,uid,sourceRevision,approvalOperationId,recordedAt){
        const [envelopeSnap,archiveSnap,snapshotSnap,approvalSnap]=await Promise.all([
            db.collection("users").doc(uid).collection("saves").doc("current"),
            root.collection("recoveryArchives").doc(String(sourceRevision)),
            root.collection("playableSnapshots").doc(String(sourceRevision)),
            root.collection("recoveryApprovals").doc(approvalOperationId)].map(ref=>tx.get(ref)));
        const {envelope}=inspectCurrentRecoverySource(uid,sourceRevision,{envelopeSnap,archiveSnap,snapshotSnap});
        if(envelope.serverRevision!==sourceRevision)fail("aborted","CLOUD_REVISION_CONFLICT");
        const approval=approvalSnap.data();
        if(!approvalSnap.exists||approval.schemaVersion!==1||approval.kind!=="canonical-current-recovery-approval"||
           approval.ownerUid!==uid||approval.operationId!==approvalOperationId||approval.status!=="approved"||
           approval.sourceRevision!==sourceRevision||approval.sourceSha256!==archiveSnap.get("sourceSha256")||
           approval.snapshotSha256!==snapshotSnap.get("sha256")||typeof approval.approvedBy!=="string"||!approval.approvedBy.trim()||
           typeof approval.expiresAt?.toMillis!=="function"||(recordedAt===undefined&&approval.expiresAt.toMillis()<=now())){
            fail("permission-denied","A current server operator approval is required for recovery audit.");
        }
        const binding=auditApprovalBinding(approval,sourceRevision);
        if(recordedAt!==undefined){
            const observed=timestampPair(recordedAt),compare=(a,b)=>a.seconds-b.seconds||a.nanoseconds-b.nanoseconds;
            if(compare(binding.issuedAt,binding.expiresAt)>=0||compare(binding.issuedAt,observed)>0||compare(observed,binding.expiresAt)>=0)
                fail("data-loss","Candidate recorded time lies outside its approval interval.");
        }
        return {sourceSha256:binding.sourceSha256,snapshotSha256:binding.snapshotSha256,approvalBindingSha256:snapshotDigest(binding)};
    }
    async function verifyCandidateAuditControl(tx,root,uid,sourceRevision,control){
        const [fenceSnap,runSnap]=await Promise.all([
            tx.get(root.collection(RECOVERY_AUDIT_FENCE_COLLECTION).doc("current")),
            tx.get(root.collection(RECOVERY_AUDIT_RUN_COLLECTION).doc(control.auditId))]);
        const fence=inspectRecoveryAuditFence(fenceSnap.exists?fenceSnap.data():undefined,uid,fail),run=inspectAuditRun(runSnap.data(),uid,control.auditId);
        matchingAuditFence(fence,run);
        if(run.status!=="active"||run.sourceRevision!==sourceRevision||run.epoch!==control.epoch||
           run.sessionId!==control.sessionId||run.sessionRevision!==control.sessionRevision)
            fail("data-loss","Candidate audit control binding differs.");
        const binding=await verifyAuditApproval(tx,root,uid,sourceRevision,run.approvalOperationId,control.recordedAt);
        if(binding.sourceSha256!==run.sourceSha256||binding.snapshotSha256!==run.snapshotSha256||
           binding.approvalBindingSha256!==run.approvalBindingSha256)fail("data-loss","Candidate audit approval binding differs.");
    }
    async function verifyRetainedAuditControls(view,uid,expectedRevision,operations,verifiedRecoveryIDs){
        const {tx,root,auditControl:control}=view,verified=new Set(verifiedRecoveryIDs),receipts=await recoveryIndex(operations,doc=>{const row=doc.data();return segmentedScopes.has(tx)?{kind:row.kind,ownerUid:row.ownerUid,operationId:row.operationId,sourceRevision:row.sourceRevision,sourceSha256:row.sourceSha256,approvedBy:row.approvedBy,restoredRevision:row.restoredRevision,createdAt:row.createdAt}:row;});
        const approvals=new Map(),compare=(a,b)=>a.seconds-b.seconds||a.nanoseconds-b.nanoseconds;
        for await(const doc of recoveryRows(view.rows("recoveryApprovals"))){
            const approval=doc.data(),used=approval?.status==="used";
            inventoryExact(approval,["schemaVersion","kind","ownerUid","operationId","sourceRevision","sourceSha256","snapshotSha256",
                "approvedBy","status","issuedAt","expiresAt",...(used?["usedRevision","usedAt"]:[])],"retained approval");
            if(approval.schemaVersion!==1||approval.kind!=="canonical-current-recovery-approval"||approval.ownerUid!==uid||
               approval.operationId!==doc.id||!OPERATION_ID.test(doc.id)||!["approved","used"].includes(approval.status)||
               !Number.isSafeInteger(approval.sourceRevision)||approval.sourceRevision<2||approval.sourceRevision>expectedRevision||
               !HEX.test(approval.sourceSha256||"")||!HEX.test(approval.snapshotSha256||"")||
               typeof approval.approvedBy!=="string"||!approval.approvedBy.trim())fail("data-loss","Retained audit approval identity differs.");
            const binding=auditApprovalBinding(approval,approval.sourceRevision);
            if(compare(binding.issuedAt,binding.expiresAt)>=0)fail("data-loss","Retained audit approval interval differs.");
            const [snapshot,archive]=await Promise.all([
                tx.get(root.collection("playableSnapshots").doc(String(approval.sourceRevision))),
                tx.get(root.collection("recoveryArchives").doc(String(approval.sourceRevision)))]);
            try{
                if(!snapshot.exists||!archive.exists||snapshot.get("sha256")!==approval.snapshotSha256||
                   archive.get("sourceSha256")!==approval.sourceSha256)throw Error("Missing original approval source");
                const original=inspectRecoveryArchive(archive.data(),uid,approval.sourceRevision,snapshot.data());
                if(original.account.provenance!=="server-created")throw Error("Approval provenance differs");
            }catch(_){fail("data-loss","Retained audit approval source differs.");}
            if(used){
                const receipt=receipts.get(doc.id);
                if(!verified.has(doc.id)||!receipt||receipt.kind!=="canonical-current-recovery"||receipt.ownerUid!==uid||
                   receipt.operationId!==doc.id||receipt.sourceRevision!==approval.sourceRevision||receipt.sourceSha256!==approval.sourceSha256||
                   receipt.approvedBy!==approval.approvedBy||receipt.restoredRevision!==approval.usedRevision||
                   snapshotDigest(timestampPair(approval.usedAt))!==snapshotDigest(timestampPair(receipt.createdAt)))
                    fail("data-loss","Retained used approval lacks its verified recovery result.");
            }
            // This original approved-binding view verifies a historical seal;
            // it cannot authorize reuse of a used or expired approval.
            approvals.set(doc.id,{approval,binding:{...binding,status:"approved"}});
        }
        const runs=[];
        for await(const doc of recoveryRows(view.rows(RECOVERY_AUDIT_RUN_COLLECTION))){
            const run=inspectAuditRun(doc.data(),uid,doc.id);
            if(doc.id!==run.auditId)fail("data-loss","Retained audit run ID differs.");runs.push(run);
        }
        runs.sort((a,b)=>a.epoch-b.epoch);
        if(runs.length!==control.epoch)fail("data-loss","Retained audit epoch inventory differs.");
        let previous;
        for(let index=0;index<runs.length;index++){
            const run=runs[index],last=index===runs.length-1,source=approvals.get(run.approvalOperationId);
            if(run.epoch!==index+1||(last?(run.auditId!==control.auditId||run.status!=="active"):run.status!=="cancelled")||
               run.sourceRevision>expectedRevision||!source||run.sourceRevision!==source.approval.sourceRevision||
               run.sourceSha256!==source.approval.sourceSha256||run.snapshotSha256!==source.approval.snapshotSha256||
               run.approvalBindingSha256!==snapshotDigest(source.binding))fail("data-loss","Retained audit run source or epoch differs.");
            const created=timestampPair(run.createdAt),updated=timestampPair(run.updatedAt);
            if(compare(created,source.binding.issuedAt)<0||compare(created,updated)>0||
               (previous&&(run.sourceRevision<previous.sourceRevision||compare(timestampPair(previous.updatedAt),created)>0)))
                fail("data-loss","Retained audit chronology differs.");
            // Begin authorization precedes commit; cancellation may be later
            // than expiry. Neither commit timestamp is a new expiry gate.
            previous=run;
        }
        const fences=[];for await(const doc of recoveryRows(view.rows(RECOVERY_AUDIT_FENCE_COLLECTION)))fences.push(doc);
        if(fences.length!==1||fences[0].id!=="current")fail("data-loss","Retained audit fence inventory differs.");
        matchingAuditFence(inspectRecoveryAuditFence(fences[0].data(),uid,fail),runs.at(-1));
    }
    async function beginAudit(request,args){
        auditIntent("begin",args,["operationId","expectedRevision","approvalOperationId"]);
        return runRecoveryAuditMaintenance(request,args.operationId,async(tx,session)=>{
            const root=db.collection("serverUsers").doc(session.uid),fenceRef=root.collection(RECOVERY_AUDIT_FENCE_COLLECTION).doc("current"),
                runRef=root.collection(RECOVERY_AUDIT_RUN_COLLECTION).doc(args.operationId);
            const [fenceSnap,runSnap]=await Promise.all([tx.get(fenceRef),tx.get(runRef)]);
            const fence=inspectRecoveryAuditFence(fenceSnap.exists?fenceSnap.data():undefined,session.uid,fail);
            const beginIntentSha256=snapshotDigest({action:"begin-audit",ownerUid:session.uid,...args});
            if(runSnap.exists){
                const run=inspectAuditRun(runSnap.data(),session.uid,args.operationId);
                if(run.beginIntentSha256!==beginIntentSha256)fail("already-exists","Recovery audit ID has another intent.");
                return {auditId:run.auditId,epoch:run.epoch,sourceRevision:run.sourceRevision,beginAccepted:true,unchanged:true};
            }
            if(fence?.status==="active")fail("failed-precondition","A recovery audit is already active.");
            if(fence){
                const previous=await tx.get(root.collection(RECOVERY_AUDIT_RUN_COLLECTION).doc(fence.auditId));
                matchingAuditFence(fence,inspectAuditRun(previous.data(),session.uid,fence.auditId));
            }
            const binding=await verifyAuditApproval(tx,root,session.uid,args.expectedRevision,args.approvalOperationId);
            const epoch=(fence?.epoch??0)+1;
            if(!Number.isSafeInteger(epoch))fail("failed-precondition","Recovery audit epoch is exhausted.");
            const stamp=FieldValue.serverTimestamp(),next={schemaVersion:1,kind:"canonical-recovery-audit-fence",ownerUid:session.uid,
                auditId:args.operationId,epoch,status:"active",sessionId:session.sessionId,sessionRevision:session.revision,
                sourceRevision:args.expectedRevision,...binding,approvalOperationId:args.approvalOperationId,
                cancelOperationId:null,cancelIntentSha256:null,cancelledBySessionId:null,cancelledBySessionRevision:null,createdAt:stamp,updatedAt:stamp};
            tx.create(runRef,{...next,kind:"canonical-recovery-audit-run",beginIntentSha256});tx.set(fenceRef,next);
            return {auditId:next.auditId,epoch,sourceRevision:next.sourceRevision,beginAccepted:true,unchanged:false};
        });
    }
    async function resumeAudit(request,args){
        auditIntent("resume",args,["auditId","expectedEpoch","expectedRevision"]);
        return runRecoveryAuditMaintenance(request,args.auditId,async(tx,session)=>{
            const root=db.collection("serverUsers").doc(session.uid);
            const [fenceSnap,runSnap]=await Promise.all([
                tx.get(root.collection(RECOVERY_AUDIT_FENCE_COLLECTION).doc("current")),tx.get(root.collection(RECOVERY_AUDIT_RUN_COLLECTION).doc(args.auditId))]);
            const fence=inspectRecoveryAuditFence(fenceSnap.exists?fenceSnap.data():undefined,session.uid,fail),run=inspectAuditRun(runSnap.data(),session.uid,args.auditId);
            matchingAuditFence(fence,run);
            if(run.status!=="active"||run.epoch!==args.expectedEpoch||run.sourceRevision!==args.expectedRevision||
               run.sessionId!==session.sessionId||run.sessionRevision!==session.revision)fail("failed-precondition","Recovery audit epoch or session is no longer current.");
            const binding=await verifyAuditApproval(tx,root,session.uid,run.sourceRevision,run.approvalOperationId);
            if(binding.approvalBindingSha256!==run.approvalBindingSha256||binding.sourceSha256!==run.sourceSha256||
               binding.snapshotSha256!==run.snapshotSha256)fail("data-loss","Recovery audit approval binding changed.");
            return {auditId:run.auditId,epoch:run.epoch,sourceRevision:run.sourceRevision,status:run.status};
        });
    }
    async function cancelAudit(request,args){
        auditIntent("cancel",args,["operationId","auditId","expectedEpoch"]);
        return runRecoveryAuditMaintenance(request,args.auditId,async(tx,session)=>{
            const root=db.collection("serverUsers").doc(session.uid),fenceRef=root.collection(RECOVERY_AUDIT_FENCE_COLLECTION).doc("current"),
                runRef=root.collection(RECOVERY_AUDIT_RUN_COLLECTION).doc(args.auditId);
            const [fenceSnap,runSnap]=await Promise.all([tx.get(fenceRef),tx.get(runRef)]);
            const fence=inspectRecoveryAuditFence(fenceSnap.exists?fenceSnap.data():undefined,session.uid,fail),run=inspectAuditRun(runSnap.data(),session.uid,args.auditId);
            const cancelIntentSha256=snapshotDigest({action:"cancel-audit",ownerUid:session.uid,...args});
            if(run.epoch!==args.expectedEpoch)fail("failed-precondition","Recovery audit epoch differs.");
            if(run.status==="cancelled"){
                if(run.cancelOperationId!==args.operationId||run.cancelIntentSha256!==cancelIntentSha256)fail("already-exists","Recovery audit was cancelled by another intent.");
                return {auditId:run.auditId,epoch:run.epoch,status:"cancelled",unchanged:true};
            }
            matchingAuditFence(fence,run);
            const next={...fence,status:"cancelled",cancelOperationId:args.operationId,cancelIntentSha256,
                cancelledBySessionId:session.sessionId,cancelledBySessionRevision:session.revision,updatedAt:FieldValue.serverTimestamp()};
            tx.set(fenceRef,next);tx.set(runRef,{...next,kind:"canonical-recovery-audit-run",beginIntentSha256:run.beginIntentSha256});
            return {auditId:run.auditId,epoch:run.epoch,status:"cancelled",unchanged:false};
        });
    }
    const inventoryFlags=Object.freeze({authoritativeStateReady:false,candidateProofValid:false,trustedCaptureVerified:false,restoreAuthorized:false});
    function inventoryExact(row,keys,label){
        if(!row||Object.keys(row).sort().join("|")!==keys.slice().sort().join("|"))fail("data-loss",`Inventory ${label} shape differs.`);
    }
    const inventoryHash=bytes=>createHash("sha256").update(bytes).digest("hex");
    const inventoryCompare=(a,b)=>Buffer.compare(Buffer.from(a,"utf8"),Buffer.from(b,"utf8"));
    const inventoryId=id=>typeof id==="string"&&id.length>0&&!id.includes("/")&&Buffer.from(id,"utf8").toString("utf8")===id;
    const inventoryBinding=run=>Object.fromEntries(["ownerUid","auditId","epoch","sessionId","sessionRevision","sourceRevision",
        "sourceSha256","snapshotSha256","approvalOperationId","approvalBindingSha256"].map(key=>[key,run[key]]));
    function inventoryStateHash(row){const {stateSha256,createdAt,updatedAt,...payload}=row;return snapshotDigest(payload);}
    function inspectInventoryState(row,run,namespaces){
        const binding=inventoryBinding(run);
        inventoryExact(row,["schemaVersion","kind",...Object.keys(binding),"prepareOperationId","prepareIntentSha256","namespaceListSha256",
            "phase","namespaceIndex","afterDocumentId","nextSequence","capturedCount","lastPageOperationId","lastPageSha256",
            "inventoryExhausted","stateSha256","createdAt","updatedAt"],"state");
        if(row.schemaVersion!==1||row.kind!=="canonical-recovery-inventory-state"||
           Object.keys(binding).some(key=>row[key]!==binding[key])||!OPERATION_ID.test(row.prepareOperationId||"")||
           row.prepareIntentSha256!==snapshotDigest({action:"prepare-inventory",auditId:run.auditId,expectedEpoch:run.epoch,operationId:row.prepareOperationId})||
           row.namespaceListSha256!==snapshotDigest(namespaces)||!["preparing","inventory","blocked"].includes(row.phase)||
           !Number.isSafeInteger(row.namespaceIndex)||row.namespaceIndex<0||row.namespaceIndex>namespaces.length||
           !(row.afterDocumentId===null||inventoryId(row.afterDocumentId))||!Number.isSafeInteger(row.nextSequence)||row.nextSequence<1||
           !Number.isSafeInteger(row.capturedCount)||row.capturedCount<0||
           row.inventoryExhausted!==(row.namespaceIndex===namespaces.length)||
           (row.inventoryExhausted&&row.afterDocumentId!==null)||
           typeof row.createdAt?.toMillis!=="function"||typeof row.updatedAt?.toMillis!=="function"||
           !HEX.test(row.stateSha256||"")||row.stateSha256!==inventoryStateHash(row)||
           (row.nextSequence===1?(row.phase!=="preparing"||row.namespaceIndex!==0||row.afterDocumentId!==null||row.capturedCount!==0||
               row.lastPageOperationId!==null||row.lastPageSha256!==null):
               (row.phase==="preparing"||!OPERATION_ID.test(row.lastPageOperationId||"")||!HEX.test(row.lastPageSha256||"")))){
            fail("data-loss","Inventory state is inconsistent.");
        }
        return row;
    }
    async function inventoryContext(tx,session,auditId,epoch){
        const root=db.collection("serverUsers").doc(session.uid);
        const [fenceSnap,runSnap]=await Promise.all([
            tx.get(root.collection(RECOVERY_AUDIT_FENCE_COLLECTION).doc("current")),
            tx.get(root.collection(RECOVERY_AUDIT_RUN_COLLECTION).doc(auditId))]);
        const fence=inspectRecoveryAuditFence(fenceSnap.exists?fenceSnap.data():undefined,session.uid,fail),run=inspectAuditRun(runSnap.data(),session.uid,auditId);
        matchingAuditFence(fence,run);
        if(run.status!=="active"||run.epoch!==epoch||run.sessionId!==session.sessionId||run.sessionRevision!==session.revision)
            fail("failed-precondition","Inventory audit epoch or session is no longer current.");
        const binding=await verifyAuditApproval(tx,root,session.uid,run.sourceRevision,run.approvalOperationId);
        if(Object.keys(binding).some(key=>binding[key]!==run[key]))fail("data-loss","Inventory approval binding changed.");
        const runRef=root.collection(RECOVERY_AUDIT_RUN_COLLECTION).doc(auditId);
        return {run,namespaces:recoveryAuditNamespaces(session.uid,2),stateRef:runRef.collection(RECOVERY_INVENTORY_STATE_COLLECTION).doc("current"),runRef};
    }
    async function prepareInventory(request,args){
        auditIntent("prepare inventory",args,["auditId","expectedEpoch","operationId"]);
        return runRecoveryAuditMaintenance(request,args.auditId,async(tx,session)=>{
            const {run,namespaces,stateRef}=await inventoryContext(tx,session,args.auditId,args.expectedEpoch);
            const snap=await tx.get(stateRef),intentSha256=snapshotDigest({action:"prepare-inventory",...args});
            if(snap.exists){
                const state=inspectInventoryState(snap.data(),run,namespaces);
                if(state.prepareIntentSha256!==intentSha256)fail("already-exists","Inventory preparation has another intent.");
                return {...inventoryFlags,auditId:run.auditId,epoch:run.epoch,prepareSha256:intentSha256,nextSequence:1,phase:"preparing",unchanged:true};
            }
            const stamp=FieldValue.serverTimestamp(),state={schemaVersion:1,kind:"canonical-recovery-inventory-state",...inventoryBinding(run),
                prepareOperationId:args.operationId,prepareIntentSha256:intentSha256,namespaceListSha256:snapshotDigest(namespaces),
                phase:"preparing",namespaceIndex:0,afterDocumentId:null,nextSequence:1,capturedCount:0,lastPageOperationId:null,
                lastPageSha256:null,inventoryExhausted:false,createdAt:stamp,updatedAt:stamp};
            state.stateSha256=inventoryStateHash(state);tx.create(stateRef,state);
            return {...inventoryFlags,auditId:run.auditId,epoch:run.epoch,prepareSha256:intentSha256,nextSequence:1,phase:"preparing",unchanged:false};
        });
    }
    function inspectInventoryPage(row,args,run,state,namespaces,pendingCreate=false,assemblyBudget){
        inventoryExact(row,["schemaVersion","kind","ownerUid","auditId","epoch","operationId","intentSha256","payloadSha256","payloadBytes","createdAt"],"page");
        if(row.schemaVersion!==1||row.kind!=="canonical-recovery-inventory-page"||row.ownerUid!==run.ownerUid||row.auditId!==run.auditId||
           row.epoch!==run.epoch||row.operationId!==args.operationId||row.intentSha256!==snapshotDigest({action:"capture-inventory-page",...args})||
           !HEX.test(row.payloadSha256||"")||!Buffer.isBuffer(row.payloadBytes)||inventoryHash(row.payloadBytes)!==row.payloadSha256||
           (!pendingCreate&&typeof row.createdAt?.toMillis!=="function"))fail("data-loss","Inventory page seal is inconsistent.");
        let payload;try{payload=decodeInventoryPayload(row.payloadBytes,assemblyBudget);}catch(error){fail("data-loss",error.message);}
        inventoryExact(payload,["schemaVersion","sequence","namespaceIndex","namespacePath","cursorBefore","cursorAfter","entries",
            "terminalEmpty","inventoryExhausted","previousPageSha256","auditBindingSha256"],"payload");
        if(payload.schemaVersion!==1||payload.sequence!==args.expectedSequence||!Number.isSafeInteger(payload.sequence)||payload.sequence<1||
           !Number.isSafeInteger(payload.namespaceIndex)||payload.namespaceIndex<0||payload.namespaceIndex>=namespaces.length||
           payload.namespacePath!==namespaces[payload.namespaceIndex]||!(payload.cursorBefore===null||inventoryId(payload.cursorBefore))||
           !Array.isArray(payload.entries)||payload.entries.length>INVENTORY_LIMITS.rows||
           payload.terminalEmpty!==(payload.entries.length===0)||
           payload.inventoryExhausted!==(payload.terminalEmpty&&payload.namespaceIndex===namespaces.length-1)||
           payload.auditBindingSha256!==snapshotDigest(inventoryBinding(run))||
           (payload.sequence===1?(payload.namespaceIndex!==0||payload.cursorBefore!==null||payload.previousPageSha256!==null):!HEX.test(payload.previousPageSha256||"")))
            fail("data-loss","Inventory page payload is inconsistent.");
        let previous=payload.cursorBefore;
        for(const entry of payload.entries){
            inventoryExact(entry,["id","updateTime","typedDataSha256","typedDataByteLength"],"entry");
            inventoryExact(entry.updateTime,["seconds","nanoseconds"],"version");
            const version=entry.updateTime;
            if(!inventoryId(entry.id)||(previous!==null&&inventoryCompare(previous,entry.id)>=0)||!HEX.test(entry.typedDataSha256||"")||
               !Number.isSafeInteger(entry.typedDataByteLength)||entry.typedDataByteLength<1||entry.typedDataByteLength>2*1024*1024||
               !Number.isInteger(version.seconds)||version.seconds<-62135596800||version.seconds>253402300799||
               !Number.isInteger(version.nanoseconds)||version.nanoseconds<0||version.nanoseconds>999999999)fail("data-loss","Inventory entry is inconsistent.");
            previous=entry.id;
        }
        if(payload.cursorAfter!==(payload.entries.length?previous:null)||payload.sequence>=state.nextSequence||payload.namespaceIndex>state.namespaceIndex||
           state.capturedCount<payload.entries.length||(state.nextSequence===2&&state.capturedCount!==payload.entries.length))
            fail("data-loss","Inventory page and state differ.");
        if(payload.sequence===state.nextSequence-1&&(state.lastPageOperationId!==row.operationId||state.lastPageSha256!==row.payloadSha256||
           state.namespaceIndex!==payload.namespaceIndex+(payload.terminalEmpty?1:0)||state.afterDocumentId!==payload.cursorAfter||
           state.inventoryExhausted!==payload.inventoryExhausted))fail("data-loss","Inventory latest page and state differ.");
        if(payload.namespaceIndex===state.namespaceIndex&&payload.entries.length&&
           (state.afterDocumentId===null||inventoryCompare(state.afterDocumentId,payload.cursorAfter)<0))fail("data-loss","Inventory cursor precedes its receipt.");
        return payload;
    }
    function inventoryPageResult(args,run,payload,sha256,unchanged){
        return {...inventoryFlags,auditId:run.auditId,epoch:run.epoch,operationId:args.operationId,sequence:payload.sequence,
            namespaceIndex:payload.namespaceIndex,cursorBefore:payload.cursorBefore,cursorAfter:payload.cursorAfter,
            entryCount:payload.entries.length,terminalEmpty:payload.terminalEmpty,inventoryExhausted:payload.inventoryExhausted,pageSha256:sha256,unchanged};
    }
    async function captureInventoryPage(request,args){
        auditIntent("capture inventory page",args,["auditId","expectedEpoch","operationId","expectedSequence"]);
        if(!Number.isSafeInteger(args.expectedSequence)||args.expectedSequence<1)fail("invalid-argument","An inventory sequence is required.");
        return runRecoveryAuditMaintenance(request,args.auditId,async(tx,session)=>{
            const {run,namespaces,stateRef,runRef}=await inventoryContext(tx,session,args.auditId,args.expectedEpoch);
            const pageRef=runRef.collection(RECOVERY_INVENTORY_PAGE_COLLECTION).doc(args.operationId);
            const [stateSnap,pageSnap]=await Promise.all([tx.get(stateRef),tx.get(pageRef)]);
            const state=inspectInventoryState(stateSnap.data(),run,namespaces);
            if(pageSnap.exists){
                const row=pageSnap.data(),payload=inspectInventoryPage(row,args,run,state,namespaces);
                return inventoryPageResult(args,run,payload,row.payloadSha256,true);
            }
            if(state.phase==="blocked"||state.inventoryExhausted||state.nextSequence!==args.expectedSequence)
                fail("failed-precondition","Inventory cursor is not current.");
            const namespace=namespaces[state.namespaceIndex];
            let query=db.collection(namespace).orderBy("__name__");
            if(state.afterDocumentId!==null)query=query.startAfter(db.doc(`${namespace}/${state.afterDocumentId}`));
            const rows=await tx.get(query.limit(INVENTORY_LIMITS.rows));
            let entries,payload,payloadBytes;
            try{
                entries=rows.docs.map(doc=>inventoryDocumentMetadata(doc,namespace));
                if(rows.size!==entries.length||entries.length>INVENTORY_LIMITS.rows)throw Error("Invalid inventory query result");
                let previous=state.afterDocumentId;
                for(const entry of entries){if(previous!==null&&inventoryCompare(previous,entry.id)>=0)throw Error("Invalid inventory query ordering");previous=entry.id;}
                payload={schemaVersion:1,sequence:args.expectedSequence,namespaceIndex:state.namespaceIndex,namespacePath:namespace,
                    cursorBefore:state.afterDocumentId,cursorAfter:entries.length?previous:null,entries,terminalEmpty:entries.length===0,
                    inventoryExhausted:entries.length===0&&state.namespaceIndex===namespaces.length-1,
                    previousPageSha256:state.lastPageSha256,auditBindingSha256:snapshotDigest(inventoryBinding(run))};
                payloadBytes=encodeInventoryPayload(payload);
            }catch(error){fail("data-loss",error.message);}
            const nextSequence=state.nextSequence+1,capturedCount=state.capturedCount+entries.length;
            if(!Number.isSafeInteger(nextSequence)||!Number.isSafeInteger(capturedCount))fail("failed-precondition","Inventory sequence is exhausted.");
            const stamp=FieldValue.serverTimestamp(),sha256=inventoryHash(payloadBytes),next={...state,phase:"inventory",
                namespaceIndex:state.namespaceIndex+(payload.terminalEmpty?1:0),afterDocumentId:payload.cursorAfter,nextSequence,capturedCount,
                lastPageOperationId:args.operationId,lastPageSha256:sha256,inventoryExhausted:payload.inventoryExhausted,updatedAt:stamp};
            next.stateSha256=inventoryStateHash(next);
            const page={schemaVersion:1,kind:"canonical-recovery-inventory-page",ownerUid:run.ownerUid,auditId:run.auditId,epoch:run.epoch,
                operationId:args.operationId,intentSha256:snapshotDigest({action:"capture-inventory-page",...args}),payloadSha256:sha256,payloadBytes,createdAt:stamp};
            inspectInventoryPage(page,args,run,next,namespaces,true);
            tx.create(pageRef,page);tx.set(stateRef,next);
            return inventoryPageResult(args,run,payload,sha256,false);
        });
    }
    // Bounded proof components. These seals never certify the complete recovery closure.
    function admitProofInventory(state,namespaces){
        if(namespaces.length!==31||state.phase!=="inventory"||!state.inventoryExhausted||state.capturedCount>PATROL_PROOF_LIMITS.inventoryDocuments)
            fail("failed-precondition","Forest proof inventory admission failed.");
    }
    async function completeInventory(tx,run,state,namespaces,runRef){
        admitProofInventory(state,namespaces);
        const rows=await tx.get(runRef.collection(RECOVERY_INVENTORY_PAGE_COLLECTION).limit(318));
        if(rows.size>=318||rows.size!==state.nextSequence-1)fail("data-loss","Forest inventory page inventory differs.");
        return inspectInventoryPages(rows.docs.map(doc=>({id:doc.id,row:doc.data()})),run,state,namespaces);
    }
    function inspectInventoryPages(rows,run,state,namespaces,assemblyBudget){
        if(rows.length>=318||rows.length!==state.nextSequence-1)fail("data-loss","Forest inventory page inventory differs.");
        const pages=rows.map(({id,row})=>{
            if(id!==row?.operationId)fail("data-loss","Forest inventory page ID differs.");
            const payload=decodeInventoryPayload(row.payloadBytes,assemblyBudget,assemblyBudget!==undefined);
            inspectInventoryPage(row,{auditId:run.auditId,expectedEpoch:run.epoch,operationId:id,expectedSequence:payload.sequence},run,state,namespaces,false,assemblyBudget);
            return {row,payload};
        }).sort((a,b)=>a.payload.sequence-b.payload.sequence);
        const index=new Map();let namespaceIndex=0,cursor=null,previous=null,sequence=1;
        for(const {row,payload} of pages){
            if(payload.sequence!==sequence++||payload.namespaceIndex!==namespaceIndex||payload.cursorBefore!==cursor||payload.previousPageSha256!==previous)
                fail("data-loss","Forest inventory page chain differs.");
            for(const entry of payload.entries){const path=namespaces[namespaceIndex]+"/"+entry.id;
                if(index.has(path))fail("data-loss","Forest inventory has duplicate membership.");index.set(path,entry);}
            previous=row.payloadSha256;cursor=payload.cursorAfter;
            if(payload.terminalEmpty){namespaceIndex++;cursor=null;}
        }
        if(namespaceIndex!==namespaces.length||cursor!==null||index.size!==state.capturedCount||previous!==state.lastPageSha256||
           pages.at(-1)?.row.operationId!==state.lastPageOperationId)fail("data-loss","Forest inventory terminal or membership differs.");
        return index;
    }
    const proofComponent=value=>value==="forest-ticket"||value==="exp-allocation"||value==="additional-character-sources"||value==="simulated-ad-source"||value==="mode-nonvalue-event";
    const proofKind=(version,suffix)=>version===3?"canonical-recovery-raw-inventory-"+suffix:"canonical-recovery-"+(version===1?"patrol-":"")+"proof-"+suffix;
    const proofTarget=(version,component,sourceId)=>version===1?{ticketId:sourceId}:{component,sourceId};
    const proofIntent=(version,args)=>version===1?{action:"capture-patrol-proof",auditId:args.auditId,
        expectedEpoch:args.expectedEpoch,operationId:args.operationId,expectedSequence:args.expectedSequence,ticketId:args.sourceId}:
        {schemaVersion:2,action:"capture-proof",...args};
    function proofStateHash(row){const {stateSha256,createdAt,updatedAt,...value}=row;return snapshotDigest(value);}
    function inspectProofState(row,run,inventory){
        inventoryExact(row,["schemaVersion","kind","ownerUid","auditId","epoch","inventoryStateSha256","nextSequence","lastOperationId","lastPayloadSha256","stateSha256","createdAt","updatedAt",...(row?.schemaVersion===2?["lastComponent","lastSourceId"]:row?.schemaVersion===3?["rawNextOffset","lastStartOrdinal","lastCount","lastReceiptSha256"]:[])],"Forest proof state");
        if(![1,2,3].includes(row.schemaVersion)||row.kind!==proofKind(row.schemaVersion,"state")||
           (row.schemaVersion===2&&(!proofComponent(row.lastComponent)||!OPERATION_ID.test(row.lastSourceId||"")))||
           (row.schemaVersion===3&&(!Number.isSafeInteger(row.rawNextOffset)||row.rawNextOffset<1||row.rawNextOffset>inventory.capturedCount||
               !Number.isSafeInteger(row.lastStartOrdinal)||row.lastStartOrdinal<0||!Number.isSafeInteger(row.lastCount)||row.lastCount<1||row.lastCount>16||
               row.lastStartOrdinal+row.lastCount!==row.rawNextOffset||!HEX.test(row.lastReceiptSha256||"")))||row.ownerUid!==run.ownerUid||row.auditId!==run.auditId||row.epoch!==run.epoch||
           row.inventoryStateSha256!==inventory.stateSha256||!Number.isSafeInteger(row.nextSequence)||row.nextSequence<2||
           !OPERATION_ID.test(row.lastOperationId||"")||!HEX.test(row.lastPayloadSha256||"")||row.stateSha256!==proofStateHash(row)||
           typeof row.createdAt?.toMillis!=="function"||typeof row.updatedAt?.toMillis!=="function")fail("data-loss","Forest proof state differs.");
        return row;
    }
    function proofSnapshot(path,entry){
        const data=entry.exists?entry.data:undefined;
        return Object.freeze({id:path.slice(path.lastIndexOf("/")+1),ref:db.doc(path),exists:entry.exists,
            updateTime:entry.updateTime,data:()=>data,get:key=>key.split(".").reduce((row,name)=>row?.[name],data)});
    }
    function proofMembership(path,row,index,namespaces,assemblyBudget){
        const namespace=path.slice(0,path.lastIndexOf("/"));
        if(!namespaces.includes(namespace))fail("data-loss","Forest proof dependency namespace is unsupported.");
        const metadata=index.get(path);
        if(row.exists){
            if(!metadata)fail("data-loss","Forest proof dependency is outside inventory.");
            let actual;try{actual=inventoryDocumentMetadata(proofSnapshot(path,row),namespace,assemblyBudget);}catch(error){fail("data-loss",error.message);}
            if(snapshotDigest(actual)!==snapshotDigest(metadata))fail("data-loss","Forest proof dependency version or bytes changed.");
        }else if(metadata||row.data!==null||row.updateTime!==null)fail("data-loss","Forest proof absence contradicts inventory.");
    }
    async function checkProofCapsule(payload,run,inventory,index,namespaces,version,component,sourceId){
        inventoryExact(payload,["schemaVersion","kind","ownerUid","sourceRevision",...(version===1?["ticketId"]:["component","sourceId"]),"inventoryStateSha256","documents"],"Forest proof payload");
        if(payload.schemaVersion!==version||payload.kind!==proofKind(version,"payload")||
           (version===1?payload.ticketId!==sourceId:payload.component!==component||payload.sourceId!==sourceId)||payload.ownerUid!==run.ownerUid||
           payload.sourceRevision!==run.sourceRevision||payload.inventoryStateSha256!==inventory.stateSha256||!OPERATION_ID.test(sourceId||"")||
           !Array.isArray(payload.documents)||payload.documents.length>79)fail("data-loss","Forest proof payload differs.");
        const records=new Map();let previous=null;
        for(const row of payload.documents){
            inventoryExact(row,["path","exists","updateTime","data"],"Forest dependency");
            if(typeof row.path!=="string"||typeof row.exists!=="boolean"||(previous!==null&&inventoryCompare(previous,row.path)>=0))
                fail("data-loss","Forest proof dependency order differs.");
            proofMembership(row.path,row,index,namespaces);records.set(row.path,row);previous=row.path;
        }
        const used=new Set(),read=path=>{const row=records.get(path);if(!row)fail("data-loss","Forest proof dependency is missing.");used.add(path);return proofSnapshot(path,row);};
        const root=db.collection("serverUsers").doc(run.ownerUid),source=inspectCurrentRecoverySource(run.ownerUid,run.sourceRevision,{
            envelopeSnap:read("users/"+run.ownerUid+"/saves/current"),
            archiveSnap:read(root.path+"/recoveryArchives/"+run.sourceRevision),snapshotSnap:read(root.path+"/playableSnapshots/"+run.sourceRevision)});
        const fixed={get:async reference=>{if(typeof reference?.path!=="string"||typeof reference.collection!=="function")
                fail("data-loss","Forest proof requires point reads only.");return read(reference.path);}};
        await verifyCandidateAuditControl(fixed,root,run.ownerUid,run.sourceRevision,{auditId:run.auditId,epoch:run.epoch,
            sessionId:run.sessionId,sessionRevision:run.sessionRevision,recordedAt:read(root.path+"/recoveryApprovals/"+run.approvalOperationId).get("issuedAt")});
        let reads=0;const kernel={get:reference=>{if(++reads>PATROL_PROOF_LIMITS.kernelReads)fail("resource-exhausted","Forest proof kernel read budget exceeded.");return fixed.get(reference);}};
        await verifyProofUnit(fixed,kernel,root,run.ownerUid,source.records,run.sourceRevision,component,sourceId);
        if(used.size!==records.size)fail("data-loss","Forest proof contains unused raw dependencies.");
    }
    // Both capture and immutable replay invoke the same original evidence Owner.
    async function verifyProofUnit(seed,kernel,root,uid,records,revision,component,sourceId){
        if(component==="forest-ticket"){
            patrolEvidence.beginEvidenceAttempt(kernel);
            const ticket=await seed.get(root.collection("patrolTickets").doc(sourceId));
            return patrolEvidence.verifyRetainedTicket(kernel,root,uid,records.account,ticket,revision);
        }else if(component==="exp-allocation"){
            const operation=await kernel.get(root.collection("operations").doc(sourceId));
            if(!operation.exists||operation.id!==sourceId||operation.get("operationId")!==sourceId||operation.get("kind")!=="exp-allocation")
                fail("data-loss","EXP proof source kind or identity differs.");
            const ledger=await kernel.get(root.collection("ledgerEntries").doc(sourceId));
            const grant=await kernel.get(root.collection("grantOperations").doc(sourceId));
            if(grant.exists)fail("data-loss","EXP proof overlaps a grant.");
            await verifyDebitRecoveryEvidence(kernel,root,uid,revision,records,operation,ledger.data(),undefined);
        }else if(component==="additional-character-sources"){
            const operation=await kernel.get(root.collection("operations").doc(sourceId));
            if(!operation.exists||operation.id!==sourceId||operation.get("operationId")!==sourceId||operation.get("kind")!=="additional-character-sources")
                fail("data-loss","Additional-character proof source kind or identity differs.");
            await sourceEvidence.verifyRetainedOperation(kernel,root,uid,records.account,operation);
        }else if(component==="simulated-ad-source"){
            const source=await kernel.get(root.collection("simulatedAdSources").doc(sourceId));
            if(!source.exists||source.id!==sourceId||source.get("sourceId")!==sourceId||source.get("schemaVersion")!==1||
               source.get("kind")!=="simulated-element-box-ad"||source.get("ownerUid")!==uid)
                fail("data-loss","Simulated-ad proof source kind or identity differs.");
            await modeEvidence.verifyRetainedSource(kernel,root,uid,records.account,source,revision);
        }else if(component==="mode-nonvalue-event"){
            const event=await kernel.get(root.collection("modeTimeEvents").doc(sourceId));
            if(!event.exists||event.id!==sourceId||event.get("operationId")!==sourceId||event.get("schemaVersion")!==1||
               event.get("kind")!=="account-mode-time"||event.get("ownerUid")!==uid||event.get("modeChanged")!==false)
                fail("data-loss","Non-value mode proof source kind or identity differs.");
            await modeEvidence.verifyRetainedNonValueEvent(kernel,root,uid,records.account,event,revision);
        }else fail("invalid-argument","Unsupported proof component.");
    }
    // Proof semantics: original canonical source validation and retained Owner
    // kernel. The shared capture lifecycle owns all gates, cursors and writes.
    async function buildProofPayload({tx,session,run,namespaces,dependencies,inventory,index,version,args}){
        const root=db.collection("serverUsers").doc(session.uid),base=await Promise.all([
            tx.get(db.doc("users/"+session.uid+"/saves/current")),tx.get(root.collection("recoveryArchives").doc(String(run.sourceRevision))),
            tx.get(root.collection("playableSnapshots").doc(String(run.sourceRevision)))]);
        const source=inspectCurrentRecoverySource(session.uid,run.sourceRevision,{envelopeSnap:base[0],archiveSnap:base[1],snapshotSnap:base[2]});
        let kernelReads=0;
        const kernel={get:reference=>{if(typeof reference?.collection!=="function")fail("data-loss","Forest proof requires point reads only.");
            if(++kernelReads>60)fail("resource-exhausted","Forest proof kernel read budget exceeded.");return tx.get(reference);}};
        await verifyProofUnit(tx,kernel,root,session.uid,source.records,run.sourceRevision,args.component,args.sourceId);
        const documents=[...dependencies.values()].filter(row=>namespaces.includes(row.path.slice(0,row.path.lastIndexOf("/"))))
            .sort((a,b)=>inventoryCompare(a.path,b.path));
        for(const row of documents)proofMembership(row.path,row,index,namespaces);
        const payload={schemaVersion:version,kind:proofKind(version,"payload"),ownerUid:session.uid,sourceRevision:run.sourceRevision,
            ...proofTarget(version,args.component,args.sourceId),inventoryStateSha256:inventory.stateSha256,documents};
        return payload;
    }
    const rawIntent=args=>({schemaVersion:3,action:"capture-raw-inventory",...args});
    function rawReceiptHash(row){const {createdAt,...manifest}=row;return snapshotDigest(manifest);}
    function inspectRawReceipt(row,run,inventory){
        inventoryExact(row,["schemaVersion","kind","ownerUid","auditId","epoch","operationId","intentSha256","sequence","sourceRevision",
            "inventoryStateSha256","startOrdinal","count","endOrdinal","previousReceiptSha256","payloadSha256","payloadByteLength","chunkSha256s","createdAt"],"raw receipt");
        if(row.schemaVersion!==3||row.kind!==proofKind(3,"page")||row.ownerUid!==run.ownerUid||row.auditId!==run.auditId||row.epoch!==run.epoch||
           row.sourceRevision!==run.sourceRevision||row.inventoryStateSha256!==inventory.stateSha256||!OPERATION_ID.test(row.operationId||"")||
           !Number.isSafeInteger(row.sequence)||row.sequence<1||!Number.isSafeInteger(row.startOrdinal)||row.startOrdinal<0||
           !Number.isSafeInteger(row.count)||row.count<1||row.count>16||row.endOrdinal!==row.startOrdinal+row.count||row.endOrdinal>inventory.capturedCount||
           (row.sequence===1?(row.startOrdinal!==0||row.previousReceiptSha256!==null):(row.startOrdinal<1||!HEX.test(row.previousReceiptSha256||"")))||
           row.intentSha256!==snapshotDigest(rawIntent({auditId:row.auditId,expectedEpoch:row.epoch,operationId:row.operationId,
               expectedSequence:row.sequence,startOrdinal:row.startOrdinal,count:row.count}))||
           !Number.isSafeInteger(row.payloadByteLength)||row.payloadByteLength<1||row.payloadByteLength>PATROL_PROOF_LIMITS.bytes||
           !Array.isArray(row.chunkSha256s)||row.chunkSha256s.length!==Math.ceil(row.payloadByteLength/PATROL_PROOF_LIMITS.chunkBytes)||
           row.chunkSha256s.some(hash=>!HEX.test(hash||""))||!HEX.test(row.payloadSha256||"")||typeof row.createdAt?.toMillis!=="function")
            fail("data-loss","Raw inventory receipt differs.");
        return row;
    }
    function rawRange(args,run,inventory,previousReceiptSha256){return {sourceRevision:run.sourceRevision,inventoryStateSha256:inventory.stateSha256,
        startOrdinal:args.startOrdinal,count:args.count,endOrdinal:args.startOrdinal+args.count,previousReceiptSha256};}
    function checkRawCapsule(payload,run,inventory,index,namespaces,version,_component,_sourceId,binding,assemblyBudget){
        inventoryExact(payload,["schemaVersion","kind","ownerUid","auditId","epoch","operationId","sequence","intentSha256","sourceRevision",
            "inventoryStateSha256","startOrdinal","count","endOrdinal","previousReceiptSha256","documents"],"raw payload");
        if(version!==3||payload.schemaVersion!==3||payload.kind!==proofKind(3,"payload")||payload.ownerUid!==run.ownerUid||
           payload.auditId!==run.auditId||payload.epoch!==run.epoch||!Array.isArray(payload.documents)||payload.documents.length!==binding.count||
           ["operationId","sequence","intentSha256","sourceRevision","inventoryStateSha256","startOrdinal","count","endOrdinal","previousReceiptSha256"]
               .some(key=>payload[key]!==binding[key]))fail("data-loss","Raw inventory payload binding differs.");
        const paths=[...index.keys()].slice(binding.startOrdinal,binding.endOrdinal);
        if(paths.length!==binding.count)fail("data-loss","Raw inventory range differs.");
        for(let offset=0;offset<paths.length;offset++){
            const row=payload.documents[offset];inventoryExact(row,["path","exists","updateTime","data"],"raw document");
            if(row.path!==paths[offset]||row.exists!==true)fail("data-loss","Raw inventory document order or existence differs.");
            proofMembership(row.path,row,index,namespaces,assemblyBudget);
        }
    }
    async function buildRawPayload({tx,run,namespaces,inventory,index,args,binding}){
        const selected=[...index.keys()].slice(args.startOrdinal,args.startOrdinal+args.count);
        if(selected.length!==args.count)fail("failed-precondition","Raw inventory range is outside the fixed inventory.");
        const estimate=selected.reduce((sum,path)=>sum+index.get(path).typedDataByteLength,0);
        if(estimate>PATROL_PROOF_LIMITS.bytes)fail("resource-exhausted","Raw page exceeds2MiB; use a smaller new operation or pending Storage fallback.");
        const documents=[];
        for(const path of selected){
            const snap=await tx.get(db.doc(path));
            const row={path,exists:snap.exists,updateTime:snap.exists?{seconds:snap.updateTime?.seconds,nanoseconds:snap.updateTime?.nanoseconds}:null,data:snap.exists?snap.data():null};
            if(!row.exists)fail("data-loss","Raw inventory source is missing.");
            proofMembership(path,row,index,namespaces);documents.push(row);
        }
        return {schemaVersion:3,kind:proofKind(3,"payload"),ownerUid:run.ownerUid,auditId:run.auditId,epoch:run.epoch,
            operationId:args.operationId,sequence:args.expectedSequence,intentSha256:binding.intentSha256,...rawRange(args,run,inventory,binding.previousReceiptSha256),documents};
    }
    function inspectCapsuleChunk(row,number,receipt,run,version,component,sourceId){
        const raw=version===3;
        inventoryExact(row,["schemaVersion","kind","ownerUid","auditId","epoch","operationId","chunkIndex","payloadBytes","sha256",...(raw?["sourceRevision","inventoryStateSha256","sequence","intentSha256","startOrdinal","count","endOrdinal","previousReceiptSha256"]:version===1?[]:["component","sourceId"])],"Forest proof chunk");
        if(row.schemaVersion!==version||row.kind!==proofKind(version,"chunk")||
           (version===2&&(row.component!==component||row.sourceId!==sourceId))||
           (raw&&["sourceRevision","inventoryStateSha256","sequence","intentSha256","startOrdinal","count","endOrdinal","previousReceiptSha256"].some(key=>row[key]!==receipt[key]))||row.ownerUid!==run.ownerUid||row.auditId!==run.auditId||
           row.epoch!==run.epoch||row.operationId!==receipt.operationId||row.chunkIndex!==number||!Buffer.isBuffer(row.payloadBytes)||
           row.payloadBytes.length!==(number===receipt.chunkSha256s.length-1?receipt.payloadByteLength-number*PATROL_PROOF_LIMITS.chunkBytes:PATROL_PROOF_LIMITS.chunkBytes)||
           row.sha256!==receipt.chunkSha256s[number]||inventoryHash(row.payloadBytes)!==row.sha256)fail("data-loss","Forest proof chunk differs.");
        return row.payloadBytes;
    }
    // Structural review of already-materialized schema3 bytes only. No SDK
    // reads, semantic Owner dispatch, candidate approval or restore capability.
    // Decode one bounded capsule at a time; do not concatenate the full capture.
    function inspectCompleteRawCapture(input,assemblyBudget,segmented=false){
        inventoryExact(input,["binding","run","inventoryState","inventoryPages","rawState","rawReceipts","rawChunks"],"complete raw capture");
        const {binding}=input;
        inventoryExact(binding,["ownerUid","auditId","epoch","sourceRevision","inventoryStateSha256"],"raw capture binding");
        if(typeof binding.ownerUid!=="string"||!binding.ownerUid||binding.ownerUid.includes("/")||
           !OPERATION_ID.test(binding.auditId||"")||!Number.isSafeInteger(binding.epoch)||binding.epoch<1||
           !Number.isSafeInteger(binding.sourceRevision)||binding.sourceRevision<2||!HEX.test(binding.inventoryStateSha256||""))
            fail("data-loss","Complete raw capture binding differs.");
        const run=inspectAuditRun(input.run,binding.ownerUid,binding.auditId),namespaces=recoveryAuditNamespaces(binding.ownerUid,2);
        if(run.epoch!==binding.epoch||run.sourceRevision!==binding.sourceRevision)fail("data-loss","Complete raw capture run differs.");
        const inventory=inspectInventoryState(input.inventoryState,run,namespaces);
        admitProofInventory(inventory,namespaces);
        if(inventory.stateSha256!==binding.inventoryStateSha256)fail("data-loss","Complete raw capture inventory binding differs.");
        const {inventoryPages,rawReceipts}=input;let rawChunks=input.rawChunks;
        if(!Array.isArray(inventoryPages)||inventoryPages.length>317||!Array.isArray(rawReceipts)||
           rawReceipts.length<1||rawReceipts.length>inventory.capturedCount||!Array.isArray(rawChunks)||
           rawChunks.length>rawReceipts.length*PATROL_PROOF_LIMITS.chunks)
            fail("data-loss","Complete raw capture collection bounds differ.");
        for(const entry of inventoryPages)inventoryExact(entry,["id","row"],"raw inventory page entry");
        if(assemblyBudget)reserveRecoveryAuditRawInputs(assemblyBudget,[...inventoryPages.map(entry=>entry.row?.payloadBytes),
            ...rawChunks.map(entry=>entry?.row?.payloadBytes)]);
        let privateChunkBytes=0;
        if(segmented){
            for(const entry of rawChunks){
                inventoryExact(entry,["id","row"],"raw chunk entry");
                const bytes=entry?.row?.payloadBytes;
                if(!Buffer.isBuffer(bytes)||!bytes.length||bytes.length>PATROL_PROOF_LIMITS.chunkBytes)
                    fail("data-loss","Segmented raw chunk bounds differ.");
                privateChunkBytes+=bytes.length;
            }
            admitRecoveryAuditAssemblyBytes(assemblyBudget,privateChunkBytes);
            rawChunks=rawChunks.map(entry=>{
                chargeRecoveryAuditAssembly(assemblyBudget,"bytes",entry.row.payloadBytes.length);
                return {id:entry.id,row:{...entry.row,payloadBytes:Buffer.from(entry.row.payloadBytes)}};
            });
        }
        const index=inspectInventoryPages(inventoryPages,run,inventory,namespaces,assemblyBudget);
        const state=inspectProofState(input.rawState,run,inventory);
        if(state.schemaVersion!==3||rawReceipts.length!==state.nextSequence-1)fail("data-loss","Complete raw capture state differs.");
        const chunks=new Map(),receipts=new Map();
        for(const entry of rawChunks){
            inventoryExact(entry,["id","row"],"raw chunk entry");
            if(typeof entry.id!=="string"||chunks.has(entry.id))fail("data-loss","Complete raw capture has duplicate chunk IDs.");
            chunks.set(entry.id,entry.row);
        }
        for(const entry of rawReceipts){
            inventoryExact(entry,["id","row"],"raw receipt entry");
            const row=inspectRawReceipt(entry.row,run,inventory);
            if(entry.id!==row.operationId||receipts.has(entry.id))fail("data-loss","Complete raw capture receipt IDs differ.");
            receipts.set(entry.id,row);
        }
        const ordered=[...receipts.values()].sort((a,b)=>a.sequence-b.sequence),documents=[],paths=new Set(),locators=new Map(),capsules=new Map();
        let sequence=1,offset=0,previous=null,last;
        for(const receipt of ordered){
            if(receipt.sequence!==sequence++||receipt.startOrdinal!==offset||receipt.previousReceiptSha256!==previous)
                fail("data-loss","Complete raw capture receipt chain differs.");
            const parts=[];
            for(let number=0;number<receipt.chunkSha256s.length;number++){
                const id=receipt.operationId+"_"+String(number).padStart(2,"0"),row=chunks.get(id);
                parts.push(inspectCapsuleChunk(row,number,receipt,run,3));chunks.delete(id);
            }
            if(assemblyBudget)recoveryAuditAssemblyUsage(assemblyBudget);
            const bytes=Buffer.concat(parts);
            if(bytes.length!==receipt.payloadByteLength||inventoryHash(bytes)!==receipt.payloadSha256)
                fail("data-loss","Forest proof complete payload differs.");
            const indexed=segmented?indexRawProofPayload(bytes,assemblyBudget,assemblyBudget!==undefined):null;
            const payload=indexed?indexed.payload:decodeProofPayload(bytes,assemblyBudget,assemblyBudget!==undefined);
            checkRawCapsule(payload,run,inventory,index,namespaces,3,undefined,undefined,receipt,assemblyBudget);
            for(const row of payload.documents){
                if(paths.has(row.path))fail("data-loss","Complete raw capture has duplicate documents.");
                if(assemblyBudget)recoveryAuditAssemblyUsage(assemblyBudget);
                paths.add(row.path);
                if(segmented)locators.set(row.path,Object.freeze({operationId:receipt.operationId,
                    ...indexed.spans[locators.size-receipt.startOrdinal],metadata:index.get(row.path)}));
                else documents.push(row);
            }
            if(segmented)capsules.set(receipt.operationId,Object.freeze({...receipt,chunkSha256s:Object.freeze(receipt.chunkSha256s.slice())}));
            offset=receipt.endOrdinal;previous=rawReceiptHash(receipt);last=receipt;
        }
        if(chunks.size||offset!==inventory.capturedCount||paths.size!==index.size||
           state.rawNextOffset!==offset||state.lastOperationId!==last.operationId||state.lastPayloadSha256!==last.payloadSha256||
           state.lastReceiptSha256!==previous||state.lastStartOrdinal!==last.startOrdinal||state.lastCount!==last.count)
            fail("data-loss","Complete raw capture terminal or retained inventory differs.");
        if(assemblyBudget)finishRecoveryAuditRawInputs(assemblyBudget);
        const sealedNamespaces=Object.freeze(namespaces.map(path=>Object.freeze({path,terminalEmpty:true,
            ids:Object.freeze([...index.keys()].filter(key=>key.slice(0,key.lastIndexOf("/"))===path)
                .map(key=>key.slice(key.lastIndexOf("/")+1)))})));
        if(!segmented)return Object.freeze({...inventoryFlags,documents:Object.freeze(documents),namespaces:sealedNamespaces});
        // One private sealed-capture reader. Keep only metadata locations after
        // validating the entire original chain; never expose this capability.
        const chunkRows=new Map(rawChunks.map(entry=>[entry.id,entry.row]));
        const metrics={capsuleDecodes:ordered.length,rowDecodes:0,privateChunkBytes,copyChargedBytes:privateChunkBytes,
            initialHashCheckedBytes:2*privateChunkBytes,rowSpanHashBytes:0,
            maxResidentCapsuleBytes:Math.max(...ordered.map(row=>row.payloadByteLength))};
        const release=()=>{}; // No decoded row/capsule is retained by this locator.
        const read=path=>{
            const location=locators.get(path);if(!location)return null;
            const receipt=capsules.get(location.operationId),parts=[];
            for(let number=0;number<receipt.chunkSha256s.length;number++){
                const bytes=chunkRows.get(receipt.operationId+"_"+String(number).padStart(2,"0")).payloadBytes;
                const start=Math.max(0,location.start-number*PATROL_PROOF_LIMITS.chunkBytes),
                    end=Math.min(bytes.length,location.start+location.length-number*PATROL_PROOF_LIMITS.chunkBytes);
                if(end>start)parts.push(bytes.subarray(start,end));
            }
            chargeRecoveryAuditAssembly(assemblyBudget,"bytes",location.length);
            const bytes=Buffer.concat(parts);
            if(bytes.length!==location.length)fail("data-loss","Segmented raw row span differs.");
            metrics.rowSpanHashBytes+=bytes.length;
            const row=decodeIndexedRawProofRow(bytes,location.qualification,assemblyBudget);metrics.rowDecodes++;
            const metadata=index.get(path);
            if(row?.path!==path||row.exists!==true||metadata!==location.metadata||
               metadata.id!==path.slice(path.lastIndexOf("/")+1)||
               row.updateTime?.seconds!==metadata.updateTime.seconds||row.updateTime?.nanoseconds!==metadata.updateTime.nanoseconds)
                fail("data-loss","Segmented raw locator or validated membership differs.");
            // Full canonical row and exact membership were verified before the
            // locator was installed. The opaque same-budget row qualification
            // and immutable private bytes prove that exact data is unchanged.
            return row;
        };
        return {index,namespaces:sealedNamespaces,read,release,metrics};
    }
    async function captureRawInventory(request,args){
        auditIntent("capture raw inventory",args,["auditId","expectedEpoch","operationId","expectedSequence","startOrdinal","count"]);
        if(!Number.isSafeInteger(args.expectedSequence)||args.expectedSequence<1||!Number.isSafeInteger(args.startOrdinal)||args.startOrdinal<0||
           !Number.isSafeInteger(args.count)||args.count<1||args.count>16||!Number.isSafeInteger(args.startOrdinal+args.count))
            fail("invalid-argument","A bounded raw inventory range and sequence are required.");
        return captureEvidence(request,args,buildRawPayload,checkRawCapsule,3);
    }
    async function captureProof(request,args){
        auditIntent("capture proof",args,["auditId","expectedEpoch","operationId","expectedSequence","component","sourceId"]);
        if(!proofComponent(args.component)||!OPERATION_ID.test(args.sourceId||"")||!Number.isSafeInteger(args.expectedSequence)||args.expectedSequence<1)
            fail("invalid-argument","A supported proof component, source and sequence are required.");
        return captureEvidence(request,args,buildProofPayload,checkProofCapsule,2);
    }
    // One private capture transaction lifecycle. Semantic fronts are fixed by
    // this Owner, never supplied by request data or a public callback registry.
    async function captureEvidence(request,args,buildPayload,checkPayload,freshVersion){
        const raw=freshVersion===3;
        return runRecoveryAuditMaintenance(request,args.auditId,async(rawTx,session)=>{
            // Session Authority has already read its two Session records and fence.
            // Reserve query limits BEFORE sending a read, then release unused slots.
            let reads=3;const dependencies=new Map(),orphanQueries=new Set(),reserve=amount=>{if(reads+amount>400)fail("resource-exhausted","Forest proof transaction read budget exceeded.");reads+=amount;};
            const tx={get:async reference=>{const point=typeof reference?.collection==="function",amount=point?1:orphanQueries.has(reference)?1:318;
                reserve(amount);const row=await rawTx.get(reference);if(!point){
                    if(!Number.isSafeInteger(row.size)||row.size<0||row.size>amount||!Array.isArray(row.docs)||row.docs.length!==row.size)
                        fail("data-loss","Forest proof bounded query result differs.");
                    reads-=amount-Math.max(1,row.size);
                }
                if(point){const path=reference.path;dependencies.set(path,{path,exists:row.exists,
                    updateTime:row.exists?{seconds:row.updateTime?.seconds,nanoseconds:row.updateTime?.nanoseconds}:null,data:row.exists?row.data():null});}
                return row;}};
            const {run,namespaces,stateRef,runRef}=await inventoryContext(tx,session,args.auditId,args.expectedEpoch);
            const proofStateRef=runRef.collection("proofState").doc("current"),receiptRef=runRef.collection("patrolProofPages").doc(args.operationId);
            const [inventorySnap,stateSnap,receiptSnap]=await Promise.all([tx.get(stateRef),tx.get(proofStateRef),tx.get(receiptRef)]);
            const inventory=inspectInventoryState(inventorySnap.data(),run,namespaces);
            admitProofInventory(inventory,namespaces);
            if(!stateSnap.exists&&!receiptSnap.exists){
                // Only these two Owner-created exact query objects receive a
                // one-read reservation; no caller can supply a smaller cost.
                const pages=runRef.collection("patrolProofPages").limit(1),chunks=runRef.collection("proofPayloadChunks").limit(1);
                orphanQueries.add(pages);orphanQueries.add(chunks);
                const retained=[await tx.get(pages),await tx.get(chunks)];
                if(retained.some(rows=>rows.size>0))fail("data-loss","Forest orphan history survives missing proof state.");
            }
            const index=await completeInventory(tx,run,inventory,namespaces,runRef);
            const state=stateSnap.exists?inspectProofState(stateSnap.data(),run,inventory):null,version=state?.schemaVersion??freshVersion;
            if((version===3)!==raw)fail("failed-precondition","Capture mode requires a new audit.");
            if(version===1&&args.component!=="forest-ticket")fail("failed-precondition","Legacy Forest audit requires a new audit for non-Forest proof.");
            const intentSha256=snapshotDigest(raw?rawIntent(args):proofIntent(version,args));
            if(state){
                const headSnap=state.lastOperationId===args.operationId?receiptSnap:
                    await tx.get(runRef.collection("patrolProofPages").doc(state.lastOperationId)),head=headSnap.data();
                if(raw){
                    inspectRawReceipt(head,run,inventory);
                    if(!headSnap.exists||head.operationId!==state.lastOperationId||head.sequence!==state.nextSequence-1||
                       head.payloadSha256!==state.lastPayloadSha256||head.startOrdinal!==state.lastStartOrdinal||head.count!==state.lastCount||
                       head.endOrdinal!==state.rawNextOffset||rawReceiptHash(head)!==state.lastReceiptSha256)fail("data-loss","Raw inventory state head differs.");
                }else{
                inventoryExact(head,["schemaVersion","kind","ownerUid","auditId","epoch","operationId","intentSha256","sequence",...(version===1?["ticketId"]:["component","sourceId"]),
                    "inventoryStateSha256","payloadSha256","payloadByteLength","chunkSha256s","createdAt"],"proof state head receipt");
                const headComponent=version===1?"forest-ticket":head.component,headSource=version===1?head.ticketId:head.sourceId;
                if(!headSnap.exists||head.schemaVersion!==version||head.kind!==proofKind(version,"page")||head.ownerUid!==run.ownerUid||
                   head.auditId!==run.auditId||head.epoch!==run.epoch||head.operationId!==state.lastOperationId||head.sequence!==state.nextSequence-1||
                   head.inventoryStateSha256!==inventory.stateSha256||head.payloadSha256!==state.lastPayloadSha256||!proofComponent(headComponent)||!OPERATION_ID.test(headSource||"")||
                   (version===2&&(state.lastComponent!==headComponent||state.lastSourceId!==headSource))||
                   head.intentSha256!==snapshotDigest(proofIntent(version,{auditId:run.auditId,expectedEpoch:run.epoch,
                       operationId:head.operationId,expectedSequence:head.sequence,component:headComponent,sourceId:headSource})))fail("data-loss","Forest proof state head differs.");
                }
            }
            const result=(receipt,unchanged)=>raw?({...inventoryFlags,captureKind:"raw-inventory",proofKernelExecuted:false,auditId:run.auditId,epoch:run.epoch,
                operationId:args.operationId,sequence:receipt.sequence,startOrdinal:receipt.startOrdinal,count:receipt.count,nextOrdinal:receipt.endOrdinal,
                rawCursorExhausted:receipt.endOrdinal===inventory.capturedCount,previousReceiptSha256:receipt.previousReceiptSha256,receiptSha256:rawReceiptHash(receipt),
                payloadSha256:receipt.payloadSha256,payloadByteLength:receipt.payloadByteLength,chunkCount:receipt.chunkSha256s.length,unchanged}):({...inventoryFlags,component:args.component,auditId:run.auditId,epoch:run.epoch,
                operationId:args.operationId,sourceId:args.sourceId,sequence:receipt.sequence,payloadSha256:receipt.payloadSha256,
                payloadByteLength:receipt.payloadByteLength,chunkCount:receipt.chunkSha256s.length,unchanged});
            if(receiptSnap.exists){
                const receipt=receiptSnap.data();
                if(raw){
                    inspectRawReceipt(receipt,run,inventory);
                    if(!state||receipt.operationId!==args.operationId||receipt.sequence!==args.expectedSequence||receipt.intentSha256!==intentSha256||
                       receipt.startOrdinal!==args.startOrdinal||receipt.count!==args.count||state.nextSequence<=receipt.sequence||receipt.endOrdinal>state.rawNextOffset)
                        fail("data-loss","Raw inventory receipt intent or progress differs.");
                }else{
                inventoryExact(receipt,["schemaVersion","kind","ownerUid","auditId","epoch","operationId","intentSha256","sequence",...(version===1?["ticketId"]:["component","sourceId"]),
                    "inventoryStateSha256","payloadSha256","payloadByteLength","chunkSha256s","createdAt"],"Forest proof receipt");
                if(receipt.schemaVersion!==version||receipt.kind!==proofKind(version,"page")||receipt.ownerUid!==run.ownerUid||receipt.auditId!==run.auditId||
                   receipt.epoch!==run.epoch||receipt.operationId!==args.operationId||receipt.intentSha256!==intentSha256||receipt.sequence!==args.expectedSequence||
                   (version===1?receipt.ticketId!==args.sourceId:receipt.component!==args.component||receipt.sourceId!==args.sourceId)||receipt.inventoryStateSha256!==inventory.stateSha256||!state||state.nextSequence<=receipt.sequence||
                   !Number.isSafeInteger(receipt.payloadByteLength)||receipt.payloadByteLength<1||receipt.payloadByteLength>PATROL_PROOF_LIMITS.bytes||
                   !Array.isArray(receipt.chunkSha256s)||receipt.chunkSha256s.length!==Math.ceil(receipt.payloadByteLength/PATROL_PROOF_LIMITS.chunkBytes)||
                   receipt.chunkSha256s.some(hash=>!HEX.test(hash||""))||!HEX.test(receipt.payloadSha256||"")||typeof receipt.createdAt?.toMillis!=="function"||
                   (state.nextSequence===receipt.sequence+1&&(state.lastOperationId!==args.operationId||state.lastPayloadSha256!==receipt.payloadSha256)))
                    fail("data-loss","Forest proof receipt differs.");
                }
                const chunks=[];
                for(let number=0;number<receipt.chunkSha256s.length;number++){
                    const snap=await tx.get(runRef.collection("proofPayloadChunks").doc(args.operationId+"_"+String(number).padStart(2,"0"))),row=snap.data();
                    inspectCapsuleChunk(row,number,receipt,run,version,args.component,args.sourceId);
                    chunks.push(row.payloadBytes);
                }
                const bytes=Buffer.concat(chunks);if(inventoryHash(bytes)!==receipt.payloadSha256)fail("data-loss","Forest proof complete payload differs.");
                const payload=decodeProofPayload(bytes);
                await checkPayload(payload,run,inventory,index,namespaces,version,args.component,args.sourceId,receipt);return result(receipt,true);
            }
            if((state?.nextSequence??1)!==args.expectedSequence)fail("failed-precondition","Forest proof sequence is not current.");
            if(raw&&(args.startOrdinal!==(state?.rawNextOffset??0)||args.startOrdinal+args.count>inventory.capturedCount))
                fail("failed-precondition","Raw inventory range must continue exactly within the fixed inventory.");
            const binding=raw?{...rawRange(args,run,inventory,state?.lastReceiptSha256??null),operationId:args.operationId,sequence:args.expectedSequence,intentSha256}:null;
            const payload=await buildPayload({tx,session,run,namespaces,dependencies,inventory,index,version,args,binding});
            let bytes;
            try{bytes=encodeProofPayload(payload);await checkPayload(decodeProofPayload(bytes),run,inventory,index,namespaces,version,args.component,args.sourceId,binding);}
            catch(error){if(error instanceof HttpsError)throw error;
                if(raw&&error.message==="Invalid recovery audit artifact: Patrol proof payload size")fail("resource-exhausted","Raw encoded page exceeds2MiB; use a smaller new operation or pending Storage fallback.");
                fail("data-loss",error.message);}
            const chunks=[];for(let offset=0;offset<bytes.length;offset+=PATROL_PROOF_LIMITS.chunkBytes)chunks.push(bytes.subarray(offset,offset+PATROL_PROOF_LIMITS.chunkBytes));
            const stamp=FieldValue.serverTimestamp(),receipt={schemaVersion:version,kind:proofKind(version,"page"),ownerUid:session.uid,auditId:run.auditId,
                epoch:run.epoch,operationId:args.operationId,intentSha256,sequence:args.expectedSequence,...(raw?rawRange(args,run,inventory,binding.previousReceiptSha256):proofTarget(version,args.component,args.sourceId)),inventoryStateSha256:inventory.stateSha256,
                payloadSha256:inventoryHash(bytes),payloadByteLength:bytes.length,chunkSha256s:chunks.map(inventoryHash),createdAt:stamp};
            const next={schemaVersion:version,kind:proofKind(version,"state"),ownerUid:session.uid,auditId:run.auditId,epoch:run.epoch,
                inventoryStateSha256:inventory.stateSha256,nextSequence:args.expectedSequence+1,lastOperationId:args.operationId,lastPayloadSha256:receipt.payloadSha256,...(raw?{rawNextOffset:receipt.endOrdinal,lastStartOrdinal:receipt.startOrdinal,lastCount:receipt.count,lastReceiptSha256:rawReceiptHash(receipt)}:version===1?{}:{lastComponent:args.component,lastSourceId:args.sourceId}),
                createdAt:state?.createdAt??stamp,updatedAt:stamp};
            if(!Number.isSafeInteger(next.nextSequence))fail("resource-exhausted","Forest proof sequence exhausted.");next.stateSha256=proofStateHash(next);
            // Fixed <=8 binary chunks plus receipt/state: <=10 writes. Oversize
            // and every proof check have already failed before any mutation.
            chunks.forEach((payloadBytes,chunkIndex)=>rawTx.create(runRef.collection("proofPayloadChunks").doc(args.operationId+"_"+String(chunkIndex).padStart(2,"0")),{
                schemaVersion:version,kind:proofKind(version,"chunk"),...(raw?{...rawRange(args,run,inventory,binding.previousReceiptSha256),sequence:args.expectedSequence,intentSha256}:version===1?{}:{component:args.component,sourceId:args.sourceId}),ownerUid:session.uid,auditId:run.auditId,epoch:run.epoch,
                operationId:args.operationId,chunkIndex,payloadBytes,sha256:receipt.chunkSha256s[chunkIndex]}));
            rawTx.create(receiptRef,receipt);if(state)rawTx.set(proofStateRef,next);else rawTx.create(proofStateRef,next);
            return result(receipt,false);
        });
    }
    async function verifyDebitRecoveryEvidence(tx,root,uid,expectedRevision,records,doc,ledger,receipt){
        const operation=await tx.get(root.collection("operations").doc(doc.id));
        const debit=operation.data();
        if(receipt||!operation.exists||debit.schemaVersion!==1||debit.ownerUid!==uid||
           debit.operationId!==doc.id||!["shop-purchase","exp-allocation","attribute-allocation","skill-learning"].includes(debit.kind)){
            fail("data-loss","An unmatched ledger entry blocks recovery.");
        }
        if(debit.kind==="skill-learning"){
            if(!records.account.slots.includes(debit.characterId))fail("data-loss","Skill learning character is no longer owned.");
            await verifySkillLearningEvidence({tx,root,uid,operationId:doc.id,currentRevision:expectedRevision,
                receipt:debit,ledger,grantExists:false,fail});
            return;
        }
        const debitRevision=debit.kind==="shop-purchase"?debit.purchasedRevision:debit.allocatedRevision;
        if(!Number.isSafeInteger(debitRevision)||debitRevision<2||debitRevision>expectedRevision){
            fail("data-loss","A later or unknown debit revision blocks recovery.");
        }
        const [debitSnapshot,debitArchive]=await Promise.all([
            tx.get(root.collection("playableSnapshots").doc(String(debitRevision))),
            tx.get(root.collection("recoveryArchives").doc(String(debitRevision)))
        ]);
        try{
            if(!debitSnapshot.exists||!debitArchive.exists||
               debitSnapshot.get("sha256")!==debit.snapshotSha256)throw new Error("Missing debit proof");
            const original=inspectRecoveryArchive(debitArchive.data(),uid,debitRevision,debitSnapshot.data());
            if(original.account.slots.some((id,index)=>id!==null&&id!==records.account.slots[index])||
               (debit.kind!=="shop-purchase"&&!records.account.slots.includes(debit.characterId))||
               (debit.kind==="exp-allocation"&&!original.characters.some(row=>
                   row.characterId===debit.characterId&&row.state.level===debit.levelAfter))||
               (debit.kind==="attribute-allocation"&&!original.characters.some(row=>
                   row.characterId===debit.characterId&&row.state[debit.stat]===debit.statAfter&&
                   row.state.attributePoints===debit.pointsAfter))){
                throw new Error("Debit character differs from its original source");
            }
        }catch(_){fail("data-loss","Original debit snapshot or archive is inconsistent.");}
        const proof={tx,root,uid,operationId:doc.id,currentRevision:expectedRevision,
            receipt:debit,ledger,grantExists:false,fail};
        if(debit.kind==="shop-purchase"){
            await verifyShopPurchaseEvidence({...proof,itemId:debit.itemId,quantity:debit.quantity});
        }else if(debit.kind==="exp-allocation"){
            verifyExpAllocationEvidence({...proof,characterId:debit.characterId});
        }else{
            verifyAttributeAllocationEvidence({...proof,characterId:debit.characterId,stat:debit.stat});
        }
    }
    // Private write kernel: restoreCurrent calls this only after every existing
    // source/inventory proof in the same protected transaction has completed.
    function writeRecoveredRevision(tx,root,uid,operationId,expectedRevision,
        {envelope,records,archiveSnap,approval,queries,singles,setNames,singleNames,
            envelopeRef,approvalRef,operationRef,auditRef}){
        const revision=nextRevision(envelope);
        const next=restoredRecords(records,revision);
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
    }
    async function verifyRecoveredResult(tx,root,uid,operationId,expectedRevision,maxRevision,
        {archiveSnap,snapshotSnap,approvalSnap,operationSnap,auditSnap,grantSnap,ledgerSnap},records){
        const receipt=operationSnap.data(),audit=auditSnap.data(),
            approval=approvalSnap.data();
        if(grantSnap.exists||ledgerSnap.exists||!auditSnap.exists||!approvalSnap.exists||
           receipt.schemaVersion!==1||receipt.kind!=="canonical-current-recovery"||receipt.ownerUid!==uid||
           receipt.operationId!==operationId||receipt.sourceRevision!==expectedRevision||
           receipt.sourceSha256!==archiveSnap.get("sourceSha256")||
           !Number.isSafeInteger(receipt.restoredRevision)||
           receipt.restoredRevision!==expectedRevision+1||
           receipt.restoredRevision>maxRevision||
           !/^[a-f0-9]{64}$/.test(receipt.snapshotSha256||"")||
           receipt.authoritativeStateReady!==false||
           typeof receipt.approvedBy!=="string"||!receipt.approvedBy.trim()||
           ["schemaVersion","kind","sourceSha256","approvedBy","authoritativeStateReady"]
               .some(key=>audit?.[key]!==receipt[key])||
           audit.ownerUid!==uid||audit.operationId!==operationId||
           audit.sourceRevision!==expectedRevision||
           audit.restoredRevision!==receipt.restoredRevision||
           audit.snapshotSha256!==receipt.snapshotSha256||
           approval.schemaVersion!==1||
           approval.kind!=="canonical-current-recovery-approval"||approval.ownerUid!==uid||
           approval.operationId!==operationId||approval.sourceRevision!==expectedRevision||
           approval.sourceSha256!==receipt.sourceSha256||
           approval.snapshotSha256!==snapshotSnap.get("sha256")||
           approval.approvedBy!==receipt.approvedBy||
           typeof approval.expiresAt?.toMillis!=="function"||
           approval.status!=="used"||
           approval.usedRevision!==receipt.restoredRevision){
            fail("data-loss","Recovery receipt or audit is inconsistent.");
        }
        const [restored,restoredArchive]=await Promise.all([
            tx.get(root.collection("playableSnapshots").doc(String(receipt.restoredRevision))),
            tx.get(root.collection("recoveryArchives").doc(String(receipt.restoredRevision)))
        ]);
        try{
            if(!restored.exists||!restoredArchive.exists||
               restored.get("sha256")!==receipt.snapshotSha256){
                throw new Error("Missing recovered evidence.");
            }
            inspectRecoveryArchive(restoredArchive.data(),uid,
                receipt.restoredRevision,restored.data());
            const next=restoredRecords(records,receipt.restoredRevision);
            const expected=assembleCanonicalSnapshot(uid,receipt.restoredRevision,next);
            const expectedArchive=createRecoveryArchive(uid,receipt.restoredRevision,next,expected);
            if(expected.sha256!==receipt.snapshotSha256||
               expectedArchive.sourceSha256!==restoredArchive.get("sourceSha256")){
                throw new Error("Recovered sources differ from the approved original.");
            }
        }catch(_){fail("data-loss","Recovered snapshot or archive is inconsistent.");}
        return {restoredRevision:receipt.restoredRevision,unchanged:true,
            authoritativeStateReady:false};
    }
    const segmentedScopes=new WeakMap(),segmentedRowSets=new WeakMap();
    const recoveryRows=query=>segmentedRowSets.get(query)?.iterate()??query.docs;
    const recoveryCount=query=>segmentedRowSets.get(query)?.count??query.docs.length;
    function recoveryUnit(tx){return segmentedScopes.get(tx)?.unit()??tx;}
    async function recoveryIndex(query,project){
        const result=new Map();for await(const doc of recoveryRows(query))result.set(doc.id,project(doc));return result;
    }
    async function verifyRecoveryRights(tx,root,uid,expectedRevision,records,{
        claims,receipts,ledgers,grants,events,operations,modeSources,modeEvents,
        patrolTickets,patrolStates,patrolSettlements,patrolClosures,patrolModeEvents,
        patrolOwnedModeEvents,patrolOperationIds}){
        const verifiedRecoveryIDs=new Set();
        const archivedClaims=new Map(records.claimRecords.map(record=>[record.claimKey,record]));
        if(recoveryCount(claims)!==archivedClaims.size){
            fail("data-loss","Independent claims differ from the recovery archive.");
        }
        // A lost claim/receipt index cannot hide a retained economic delta.
        // Reuse the original credit/debit Owners; never infer a missing
        // receipt from a balance or regenerate an operation during repair.
        const receiptById=await recoveryIndex(receipts,doc=>{const row=doc.data();return segmentedScopes.has(tx)?{grantId:row.grantId,operationId:row.operationId,creditedToCharacter:row.creditedToCharacter}:row;});
        const verifiedPatrolOperations=new Set(),ticketProofs=new Map();
        for await(const doc of recoveryRows(patrolTickets)){
            const proof=segmentedScopes.has(tx)?await verifyProofUnit(tx,recoveryUnit(tx),root,uid,records,expectedRevision,"forest-ticket",doc.id):
                await patrolEvidence.verifyRetainedTicket(tx,root,uid,records.account,doc,expectedRevision);
            ticketProofs.set(doc.id,{stateSha256:snapshotDigest(proof.state),status:proof.state.status,terminalOperationId:proof.state.terminalOperationId});
            for(const operationId of proof.verifiedOperationIds)verifiedPatrolOperations.add(operationId);
        }
        if(recoveryCount(patrolStates)!==ticketProofs.size){
            fail("data-loss","Patrol ticket checkpoint inventory differs from retained sources.");
        }
        for await(const doc of recoveryRows(patrolStates)){
            const {createdAt,updatedAt,...state}=doc.data();
            if(!ticketProofs.has(doc.id)||snapshotDigest(state)!==ticketProofs.get(doc.id).stateSha256){
                fail("data-loss","An orphaned Patrol checkpoint blocks recovery.");
            }
        }
        for await(const doc of recoveryRows(patrolSettlements)){
            if(!verifiedPatrolOperations.has(doc.id))fail("data-loss","An unindexed Patrol earning blocks recovery.");
            await patrolEvidence.verifyRetainedSettlement(recoveryUnit(tx),root,uid,records.account,doc,expectedRevision);
        }
        for await(const doc of recoveryRows(patrolClosures)){
            const proof=ticketProofs.get(doc.get("ticketId"));
            if(!proof||proof.status!=="abandoned"||proof.terminalOperationId!==doc.id){
                fail("data-loss","An orphaned Patrol closure blocks recovery.");
            }
            await patrolEvidence.verifyRetainedClosure(recoveryUnit(tx),root,uid,records.account,doc,expectedRevision);
        }
        for await(const doc of (async function*(){yield* recoveryRows(patrolModeEvents);yield* recoveryRows(patrolOwnedModeEvents);})()){
            if(doc.get("schemaVersion")!==2||doc.get("resultOwner")!=="forest-patrol-settlement"||
               !verifiedPatrolOperations.has(doc.id)||!patrolOperationIds.has(doc.id)){
                fail("data-loss","A Forest mode component lacks its original earning source.");
            }
        }
        await patrolEvidence.verifyCurrentEvidence(recoveryUnit(tx),root,uid,records.account,expectedRevision);
        await modeEvidence.verifyCurrentEvidence(recoveryUnit(tx),root,uid,records.account,records,expectedRevision);
        for await(const doc of recoveryRows(modeSources)){
            if(segmentedScopes.has(tx))await verifyProofUnit(tx,recoveryUnit(tx),root,uid,records,expectedRevision,"simulated-ad-source",doc.id);
            else await modeEvidence.verifyRetainedSource(tx,root,uid,records.account,doc,expectedRevision);
        }
        const verifiedModeOperations=new Set();
        for await(const doc of recoveryRows(modeEvents)){
            if(doc.get("schemaVersion")===2){
                if(!verifiedPatrolOperations.has(doc.id))fail("data-loss","An orphaned Forest value event blocks recovery.");
                continue; // Full source-specific proof already checked this exact component.
            }
            await modeEvidence.verifyRetainedEvent(recoveryUnit(tx),root,uid,records.account,doc,expectedRevision);
            verifiedModeOperations.add(doc.id);
        }
        // Debit receipts survive independently of their ledger. Every known
        // purchase/allocation must reach the original full debit proof below,
        // even when its ledger was lost with the current canonical sources.
        const ledgerIds=new Set((await recoveryIndex(ledgers,()=>true)).keys());
        for await(const doc of recoveryRows(operations)){
            const value=doc.data();
            if(value.schemaVersion!==1||value.ownerUid!==uid){
                fail("data-loss","Operation inventory identity blocks recovery.");
            }
            if(value.kind==="forest-patrol-settlement"){
                if(receiptById.has(doc.id)||!ledgerIds.has(doc.id)||!verifiedPatrolOperations.has(doc.id)){
                    fail("data-loss","A Patrol operation lacks its original source and signed ledger.");
                }
            }else if(value.kind==="account-mode-time"){
                if(receiptById.has(doc.id)||!ledgerIds.has(doc.id)){
                    fail("data-loss","A mode operation lacks its original signed ledger or overlaps a grant.");
                }
                if(!verifiedModeOperations.has(doc.id)){
                    await modeEvidence.verifyRetainedOperation(recoveryUnit(tx),root,uid,records.account,doc,expectedRevision);
                }
                verifiedModeOperations.add(doc.id);
            }else if(["shop-purchase","exp-allocation","attribute-allocation","skill-learning"].includes(value.kind)){
                if(value.operationId!==doc.id||!OPERATION_ID.test(doc.id)||!ledgerIds.has(doc.id)){
                    fail("data-loss","A debit receipt without its original ledger blocks recovery.");
                }
            }else{
                if(receiptById.has(doc.id)||ledgerIds.has(doc.id)){
                    fail("data-loss","A source operation overlaps economic evidence.");
                }
                if(value.kind==="canonical-current-recovery"){
                    if(value.operationId!==doc.id||!OPERATION_ID.test(doc.id)||
                       !Number.isSafeInteger(value.sourceRevision)||value.sourceRevision<2||
                       !Number.isSafeInteger(value.restoredRevision)||
                       value.restoredRevision>expectedRevision){
                        fail("data-loss","Retained recovery identity blocks recovery.");
                    }
                    const [archiveSnap,snapshotSnap,approvalSnap,auditSnap,grantSnap,ledgerSnap]=
                        await Promise.all([
                            root.collection("recoveryArchives").doc(String(value.sourceRevision)),
                            root.collection("playableSnapshots").doc(String(value.sourceRevision)),
                            root.collection("recoveryApprovals").doc(doc.id),
                            root.collection("recoveryAudits").doc(doc.id),
                            root.collection("grantOperations").doc(doc.id),
                            root.collection("ledgerEntries").doc(doc.id)
                        ].map(ref=>tx.get(ref)));
                    let original;
                    try{
                        if(!archiveSnap.exists||!snapshotSnap.exists)throw Error("Missing recovery source");
                        original=inspectRecoveryArchive(archiveSnap.data(),uid,
                            value.sourceRevision,snapshotSnap.data());
                        if(original.account.provenance!=="server-created"||
                           original.account.slots.some((id,index)=>id!==null&&id!==records.account.slots[index])){
                            throw Error("Recovery character differs");
                        }
                    }catch(_){fail("data-loss","Retained recovery source is inconsistent.");}
                    await verifyRecoveredResult(tx,root,uid,doc.id,value.sourceRevision,expectedRevision,
                        {archiveSnap,snapshotSnap,approvalSnap,operationSnap:doc,auditSnap,grantSnap,ledgerSnap},original);
                    verifiedRecoveryIDs.add(doc.id);
                }else{
                    if(segmentedScopes.has(tx)&&value.kind==="additional-character-sources")
                        await verifyProofUnit(tx,recoveryUnit(tx),root,uid,records,expectedRevision,"additional-character-sources",doc.id);
                    else await sourceEvidence.verifyRetainedOperation(recoveryUnit(tx),root,uid,records.account,doc);
                }
            }
        }
        // Events survive independently of grants. Losing a grant must not
        // hide an original reward observation or authorize recreating it.
        const grantById=await recoveryIndex(grants,doc=>segmentedScopes.has(tx)?true:doc.data());
        for await(const doc of recoveryRows(events)){
            const grant=segmentedScopes.has(tx)?(grantById.has(doc.id)?(await tx.get(root.collection("pendingGrants").doc(doc.id))).data():undefined):grantById.get(doc.id);
            if(!grant){fail("data-loss","An orphaned reward event blocks recovery.");}
            const proof=await readDailyCheckinEvidence({tx,root,uid,grantId:doc.id,grant,fail});
            if(!proof||proof.event.sourceRevision>expectedRevision||
               proof.event.characterId!==records.account.slots[0]){
                fail("data-loss","An unknown, later or foreign reward event blocks recovery.");
            }
        }
        // Retained consumed grants need their original receipt too. Pending
        // rights need an independently versioned event; never use an old
        // balance, creation time or absent receipt as evidence of eligibility.
        const receiptsByGrant=new Set((await recoveryIndex(receipts,doc=>doc.get("grantId"))).values());
        for await(const doc of recoveryRows(grants)){
            const grant=doc.data();
            if(grant.status==="pending"){
                verifyServerIssuedGrant({uid,grant,fail});
                if(grant.claimedByOperationId!==null||receiptsByGrant.has(doc.id)){
                    fail("data-loss","Pending grant consumption evidence is inconsistent.");
                }
                const proof=await readDailyCheckinEvidence({tx,root,uid,grantId:doc.id,grant,fail});
                if(!proof){fail("failed-precondition","VERSIONED_PENDING_GRANT_EVIDENCE_REQUIRED");}
                if(proof.event.sourceRevision>expectedRevision||
                   proof.event.characterId!==records.account.slots[0]){
                    fail("data-loss","A later or foreign pending grant blocks recovery.");
                }
            }else{
                const receipt=receiptById.get(grant.claimedByOperationId);
                if(!["reserved","credited"].includes(grant.status)||!receipt||
                   receipt.grantId!==doc.id||receipt.operationId!==grant.claimedByOperationId||
                   receipt.creditedToCharacter!==(grant.status==="credited")){
                    fail("data-loss","An orphaned or unknown grant blocks recovery.");
                }
                // Existing receipt/claim loops below verify original grant,
                // revision/event/history and no competing operation/ledger.
            }
        }
        let creditLedgerCount=0;
        for await(const doc of recoveryRows(ledgers)){
            const ledger=doc.data(),receipt=receiptById.get(doc.id);
            if(ledger.operationId!==doc.id||!OPERATION_ID.test(doc.id)||
               ledger.schemaVersion!==1||ledger.ownerUid!==uid){
                fail("data-loss","An unmatched ledger entry blocks recovery.");
            }
            if(ledger.kind==="forest-patrol-settlement"){
                if(receipt||!verifiedPatrolOperations.has(doc.id)){
                    fail("data-loss","An unmatched signed Patrol ledger blocks recovery.");
                }
                continue; // Complete Forest proof checked the original asset and mode delta.
            }
            if(ledger.kind==="account-mode-time"){
                if(receipt||!verifiedModeOperations.has(doc.id)){
                    fail("data-loss","An unmatched signed mode ledger blocks recovery.");
                }
                continue; // Original mode Owner verified this exact immutable ledger.
            }
            if(receipt?.creditedToCharacter===true&&
               archivedClaims.get(ledger.grantId)?.operationId===doc.id){
                creditLedgerCount++;
                continue; // Full credit proof is checked below.
            }
            if(segmentedScopes.has(tx)&&ledger.kind==="exp-allocation")
                await verifyProofUnit(tx,recoveryUnit(tx),root,uid,records,expectedRevision,"exp-allocation",doc.id);
            else await verifyDebitRecoveryEvidence(recoveryUnit(tx),root,uid,expectedRevision,records,doc,ledger,receipt);
        }
        if(creditLedgerCount!==archivedClaims.size){
            fail("data-loss","Credit ledger inventory differs from the recovery archive.");
        }
        let creditedCount=0;
        for await(const doc of recoveryRows(receipts)){
            const receipt=doc.data();
            if(receipt.operationId!==doc.id||!OPERATION_ID.test(doc.id)){
                fail("data-loss","Grant receipt identity blocks recovery.");
            }
            if(receipt.creditedToCharacter===true){
                if(archivedClaims.get(receipt.grantId)?.operationId!==doc.id){
                    fail("data-loss","An unmatched credited receipt blocks recovery.");
                }
                creditedCount++;
            }else if(receipt.creditedToCharacter===false&&OPERATION_ID.test(receipt.grantId||"")){
                const [grant,ledger,other]=await Promise.all([
                    tx.get(root.collection("pendingGrants").doc(receipt.grantId)),
                    tx.get(root.collection("ledgerEntries").doc(doc.id)),
                    tx.get(root.collection("operations").doc(doc.id))
                ]);
                await verifyReservedGrant({tx,root,uid,grantId:receipt.grantId,operationId:doc.id,
                    currentRevision:expectedRevision,grant:grant.data(),receipt,
                    ledgerExists:ledger.exists,otherOperationExists:other.exists,fail});
            }else{
                fail("data-loss","Unknown grant receipt state blocks recovery.");
            }
        }
        if(creditedCount!==archivedClaims.size){
            fail("data-loss","Credited receipt inventory differs from the recovery archive.");
        }
        for await(const doc of recoveryRows(claims)){
            const record=archivedClaims.get(doc.id),claim=doc.data();
            if(!record||record.grantId!==doc.id||!OPERATION_ID.test(record.operationId||"")){
                fail("data-loss","Unsupported or unmatched recovery claim.");
            }
            const grantId=doc.id,operationId=record.operationId;
            const [grant,receipt,ledger,other]=await Promise.all([
                tx.get(root.collection("pendingGrants").doc(grantId)),
                tx.get(root.collection("grantOperations").doc(operationId)),
                tx.get(root.collection("ledgerEntries").doc(operationId)),
                tx.get(root.collection("operations").doc(operationId))
            ]);
            await verifyCreditedGrant({tx,root,uid,grantId,operationId,
                currentRevision:expectedRevision,grant:grant.data(),receipt:receipt.data(),
                ledger:ledger.data(),claim,claimRecord:record,otherOperationExists:other.exists,fail});
        }
        return Object.freeze([...verifiedRecoveryIDs]);
    }

    async function restoreCurrent(request,{operationId,expectedRevision}){
        if(!OPERATION_ID.test(operationId||"")||
           !Number.isSafeInteger(expectedRevision)||expectedRevision<2){
            fail("invalid-argument","A recovery operation and current revision are required.");
        }
        return runProtected(request,async(tx,session)=>{
            patrolEvidence.beginEvidenceAttempt(tx);
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
            const {envelope,records}=inspectCurrentRecoverySource(uid,expectedRevision,
                {envelopeSnap,archiveSnap,snapshotSnap});
            if(operationSnap.exists){
                return verifyRecoveredResult(tx,root,uid,operationId,expectedRevision,envelope.serverRevision,
                    {archiveSnap,snapshotSnap,approvalSnap,operationSnap,auditSnap,grantSnap,ledgerSnap},records);
            }
            if(auditSnap.exists||grantSnap.exists||ledgerSnap.exists){
                fail("failed-precondition","Recovery operation ID is already used.");
            }
            if(envelope.serverRevision!==expectedRevision){
                fail("aborted","CLOUD_REVISION_CONFLICT");
            }
            const approval=approvalSnap.data();
            if(!approvalSnap.exists||approval.schemaVersion!==1||
               approval.kind!=="canonical-current-recovery-approval"||approval.ownerUid!==uid||
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
            // A damaged envelope is not evidence that surviving sources are old.
            // Never overwrite a later or unresolvable revision with this archive.
            for(const doc of [...singles,...queries.flatMap(query=>query.docs)]){
                if(doc.exists){
                    const revision=doc.get("serverRevision");
                    if(!Number.isSafeInteger(revision)||revision<1||revision>expectedRevision){
                        fail("data-loss","Surviving source revision blocks current recovery.");
                    }
                }
            }
            for(let i=0;i<setNames.length;i++){
                const name=setNames[i],keys=new Set(records[name].map(SETS[name]));
                if(queries[i].docs.some(doc=>!keys.has(doc.id))){
                    fail("data-loss","Unexpected current source blocks recovery.");
                }
            }
            // Canonical claim sources may all be lost. Independent retained
            // rights must agree with the archive, not be hidden by its rollback.
            const [claims,receipts,ledgers,grants,events,operations,modeSources,modeEvents,
                patrolTickets,patrolStates,patrolSettlements,patrolClosures,patrolModeEvents,patrolOwnedModeEvents,modeHead]=await Promise.all([
                tx.get(root.collection("uniqueClaims").limit(401)),
                tx.get(root.collection("grantOperations").limit(401)),
                tx.get(root.collection("ledgerEntries").limit(401)),
                tx.get(root.collection("pendingGrants").limit(401)),
                tx.get(root.collection("rewardEvents").limit(401)),
                tx.get(root.collection("operations").limit(401)),
                tx.get(root.collection("simulatedAdSources").limit(401)),
                tx.get(root.collection("modeTimeEvents").where("modeChanged","==",true).limit(401)),
                tx.get(root.collection("patrolTickets").limit(401)),
                tx.get(root.collection("patrolTicketStates").limit(401)),
                tx.get(root.collection("patrolSettlements").limit(401)),
                tx.get(root.collection("patrolClosures").limit(401)),
                // Schema 2 carries a Forest asset delta even when no mode value
                // changed. Such evidence must survive loss of all asset indexes.
                tx.get(root.collection("modeTimeEvents").where("schemaVersion","==",2).limit(401)),
                // Independent Owner identity catches an unsupported/corrupt
                // version even if it no longer appears in the schema-2 index.
                tx.get(root.collection("modeTimeEvents").where("resultOwner","==","forest-patrol-settlement").limit(401)),
                tx.get(root.collection("modeTime").doc("current"))
            ]);
            const modeHeadEvent=modeHead.exists?await tx.get(root.collection("modeTimeEvents")
                .doc(modeHead.get("lastOperationId")||"missing-mode-head")):null;
            const patrolOperationIds=new Set(patrolSettlements.docs.map(doc=>doc.id));
            // Each credit proof reads at most 12 documents, including its claim,
            // grant/receipt/ledger/collision and original event/snapshot/archive.
            // Inventory reads are additional; a reservation reserves six proof
            // reads. Each ledger reserves its inventory read plus four reads for
            // a debit's receipt, snapshot/archive and the shop Owner's snapshot.
            // Pending-grant inventory adds one read per row and three original
            // event/snapshot/archive reads for each unconsumed pending grant.
            // Each event inventory row reserves three original proof reads too.
            // Operation inventory adds its original source Owner's bounded proof
            // reads. Debit proof is already reserved by its matching ledger.
            const reservedCount=receipts.docs.filter(doc=>doc.get("creditedToCharacter")===false).length;
            const pendingCount=grants.docs.filter(doc=>doc.get("status")==="pending").length;
            const operationProofReads=operations.docs.reduce((sum,doc)=>sum+
                (doc.get("kind")==="canonical-current-recovery"?8:
                    doc.get("kind")==="forest-patrol-settlement"?0:
                    doc.get("kind")==="account-mode-time"?
                        modeEvidence.retainedOperationReadBudget(doc.get("kind")):
                        sourceEvidence.retainedOperationReadBudget(doc.get("kind"))),0);
            if(queries.reduce((sum,query)=>sum+query.size,0)+claims.docs.length*12+
               receipts.docs.length+ledgers.docs.length*5+
               ledgers.docs.filter(doc=>doc.get("kind")==="skill-learning").length*(1+skillLearningEvidenceReadBudget()-5)+reservedCount*6+
               grants.docs.length+pendingCount*3+events.docs.length*4+
               operations.docs.length+operationProofReads+
               modeSources.docs.length*(1+modeEvidence.retainedSourceReadBudget())+
               modeEvents.docs.reduce((sum,doc)=>sum+1+(doc.get("schemaVersion")===2?0:
                   modeEvidence.retainedEventReadBudget(doc.data())),0)+
               patrolTickets.docs.length*(1+patrolEvidence.retainedTicketReadBudget())+
               patrolStates.docs.length+patrolSettlements.docs.length+patrolClosures.docs.length+
               patrolModeEvents.docs.length+patrolOwnedModeEvents.docs.length+2+
               (patrolTickets.docs.length?patrolEvidence.currentEvidenceReadBudget():5)+
               modeEvidence.currentEvidenceReadBudget(modeHeadEvent?.data()??{schemaVersion:1})>400){
                fail("failed-precondition","Recovery claim evidence exceeds the transaction budget.");
            }
            await verifyRecoveryRights(tx,root,uid,expectedRevision,records,{
                claims,receipts,ledgers,grants,events,operations,modeSources,modeEvents,
                patrolTickets,patrolStates,patrolSettlements,patrolClosures,patrolModeEvents,
                patrolOwnedModeEvents,patrolOperationIds});
            return writeRecoveredRevision(tx,root,uid,operationId,expectedRevision,
                {envelope,records,archiveSnap,approval,queries,singles,setNames,singleNames,
                    envelopeRef,approvalRef,operationRef,auditRef});
        });
    }
    async function verifyCandidateStrict(view,uid,expectedRevision){
        const {tx,root}=view;
        patrolEvidence.beginEvidenceAttempt(tx);
        const [envelopeSnap,archiveSnap,snapshotSnap]=await Promise.all([
            view.save,root.collection("recoveryArchives").doc(String(expectedRevision)),
            root.collection("playableSnapshots").doc(String(expectedRevision))].map(ref=>tx.get(ref)));
        const {envelope,records}=inspectCurrentRecoverySource(uid,expectedRevision,{envelopeSnap,archiveSnap,snapshotSnap});
        if(envelope.serverRevision!==expectedRevision)fail("aborted","CLOUD_REVISION_CONFLICT");
        if(view.auditControl)await verifyCandidateAuditControl(tx,root,uid,expectedRevision,view.auditControl);
        const setNames=Object.keys(SETS),singleNames=Object.keys(SINGLES);
        const [queries,singles]=await Promise.all([
            Promise.all(setNames.map(name=>tx.get(root.collection(name)))),
            Promise.all(singleNames.map(name=>tx.get(root.collection(
                name==="claimCheckpoint"?"claimCheckpoints":name).doc(SINGLES[name]))))]);
        for(const doc of [...singles,...queries.flatMap(query=>query.docs)]){
            if(doc.exists){
                const revision=doc.get("serverRevision");
                if(!Number.isSafeInteger(revision)||revision<1||revision>expectedRevision)
                    fail("data-loss","Surviving source revision blocks current recovery.");
            }
        }
        for(let i=0;i<setNames.length;i++){
            const name=setNames[i],keys=new Set(records[name].map(SETS[name]));
            if(queries[i].docs.some(doc=>!keys.has(doc.id)))fail("data-loss","Unexpected current source blocks recovery.");
        }
        // Full byte-bounded inventories, not truncated query results. The
        // original Owner proof queries keep their existing intrinsic limits.
        const claims=view.rows("uniqueClaims"),receipts=view.rows("grantOperations"),ledgers=view.rows("ledgerEntries"),
            grants=view.rows("pendingGrants"),events=view.rows("rewardEvents"),operations=view.rows("operations"),
            modeSources=view.rows("simulatedAdSources"),patrolTickets=view.rows("patrolTickets"),
            patrolStates=view.rows("patrolTicketStates"),patrolSettlements=view.rows("patrolSettlements"),
            patrolClosures=view.rows("patrolClosures");
        const [modeEvents,patrolModeEvents,patrolOwnedModeEvents]=await Promise.all([
            tx.get(root.collection("modeTimeEvents").where("modeChanged","==",true).limit(401)),
            tx.get(root.collection("modeTimeEvents").where("schemaVersion","==",2).limit(401)),
            tx.get(root.collection("modeTimeEvents").where("resultOwner","==","forest-patrol-settlement").limit(401))]);
        // An inventory exceeding an original filtered query limit must not
        // hide additional mode evidence behind its first 401 documents.
        const allMode=view.rows("modeTimeEvents");
        for(const [key,value,query] of [["modeChanged",true,modeEvents],["schemaVersion",2,patrolModeEvents],
            ["resultOwner","forest-patrol-settlement",patrolOwnedModeEvents]]){
            if(allMode.docs.filter(doc=>doc.get(key)===value).length!==query.size)
                fail("failed-precondition","Candidate mode evidence exceeds an original query limit.");
        }
        const patrolOperationIds=new Set(patrolSettlements.docs.map(doc=>doc.id));
        const verifiedRecoveryIDs=await verifyRecoveryRights(tx,root,uid,expectedRevision,records,{claims,receipts,ledgers,grants,events,operations,
            modeSources,modeEvents,patrolTickets,patrolStates,patrolSettlements,patrolClosures,
            patrolModeEvents,patrolOwnedModeEvents,patrolOperationIds});
        for(const doc of allMode.docs){
            if(doc.get("schemaVersion")===1&&doc.get("modeChanged")===false){
                await modeEvidence.verifyRetainedNonValueEvent(tx,root,uid,records.account,doc,expectedRevision);
            }else if(!(doc.get("schemaVersion")===1&&doc.get("modeChanged")===true)&&
                !(doc.get("schemaVersion")===2&&doc.get("resultOwner")==="forest-patrol-settlement")){
                fail("data-loss","An unclassified private mode event blocks candidate verification.");
            }
        }
        if(view.auditControl)await verifyRetainedAuditControls(view,uid,expectedRevision,operations,verifiedRecoveryIDs);
        return Object.freeze({candidateProofValid:true,ownerUid:uid,sourceRevision:expectedRevision,
            sourceSha256:archiveSnap.get("sourceSha256"),snapshotSha256:snapshotSnap.get("sha256"),
            trustedCaptureVerified:false,restoreAuthorized:false,authoritativeStateReady:false,...view.finish()});
    }
    // Candidate bytes remain local to this readonly assembly. No mutable Buffer,
    // captured records or capability escapes to a restore/publication caller.
    async function assembleRawCandidate(input,budget=createRecoveryAuditAssemblyBudget()){
        try{
            const union=inspectCompleteRawCapture(input,budget),{ownerUid:uid,sourceRevision:expectedRevision,auditId}=input.binding;
            const selected=union.documents.find(row=>row.path===`serverUsers/${uid}/${RECOVERY_AUDIT_RUN_COLLECTION}/${auditId}`);
            if(!selected||!encodeProofPayload(selected.data,budget).equals(encodeProofPayload(input.run,budget)))
                fail("data-loss","Raw selected audit run differs from its capture binding.");
            const run=selected.data,recorded=timestampPair(run.createdAt),auditControl={auditId,epoch:run.epoch,
                sessionId:run.sessionId,sessionRevision:run.sessionRevision,recordedAt:["timestamp",recorded.seconds,recorded.nanoseconds]};
            const namespaceIds=new Map(union.namespaces.map(row=>[row.path,new Set(row.ids)])),absent=new Set();
            const encode=prepareRecoveryAuditCandidateEncoding({uid,expectedRevision,auditControl,
                documents:union.documents,namespaces:union.namespaces},budget);
            for(;;){
                const bytes=encode([...absent]);
                const view=decodeRecoveryAuditArtifact(bytes,{uid,expectedRevision,db},budget);
                let result,error,missing;
                try{result=await verifyCandidateStrict(view,uid,expectedRevision);}
                catch(cause){error=cause;}
                finally{missing=await drainAndCloseRecoveryAuditLookups(view);}
                // Sticky resource exhaustion cannot be hidden by an original
                // Owner replacing a lookup error with its own strict rejection.
                const usage=recoveryAuditAssemblyUsage(budget);
                if(result)return {bytes,summary:Object.freeze({...result,assemblyUsage:usage})};
                if(!missing.length)throw error;
                let added=false;
                for(const path of missing){
                    const slash=path.lastIndexOf("/"),ids=namespaceIds.get(path.slice(0,slash));
                    if(!ids||ids.has(path.slice(slash+1)))throw error;
                    if(!absent.has(path)){absent.add(path);added=true;}
                }
                if(!added)throw error;
            }
        }catch(error){
            if(error instanceof HttpsError)throw error;
            fail("data-loss",error.message);
        }
    }
    // Private verification view over this Owner's already sealed raw capture.
    // It is not a provider, live SDK transaction, publication candidate or
    // caller-configurable loader. Only original exact query shapes are valid.
    function segmentedRawView(capture,budget,uid){
        const root=db.collection("serverUsers").doc(uid),namespaces=new Map(capture.namespaces.map(row=>[row.path,row.ids]));
        const used=new Set(),absences=new Set(),shapes=recoveryAuditQueryShapes(root),pending=new Set();
        const field=(row,key)=>key.split(".").reduce((v,k)=>v?.[k],row);
        const metrics={units:0,maxUnitReads:0,maxUnitTypedBytes:0};
        const snapshot=path=>{
            chargeRecoveryAuditAssembly(budget,"operations",1);
            const slash=path.lastIndexOf("/"),ids=namespaces.get(path.slice(0,slash));
            if(!ids)fail("data-loss","Segmented dependency namespace is unsupported.");
            const row=capture.read(path);
            if(!row){
                if(ids.includes(path.slice(slash+1)))fail("data-loss","Segmented present dependency is missing.");
                if(capture.index.size+absences.size>=4096&&!absences.has(path))fail("resource-exhausted","Segmented dependency limit exceeded.");
                absences.add(path);used.add(path);return proofSnapshot(path,{exists:false});
            }
            used.add(path);return proofSnapshot(path,row);
        };
        const result=docs=>Object.freeze({docs:Object.freeze(docs),size:docs.length,empty:docs.length===0});
        const lookup=async reference=>{
            if(reference&&typeof reference.collection==="function"&&typeof reference.path==="string"){
                if(!db.doc(reference.path).isEqual?.(reference)&&typeof reference.isEqual==="function")
                    fail("data-loss","Segmented document reference differs.");
                return snapshot(reference.path);
            }
            const matches=shapes.filter(entry=>typeof reference?.isEqual==="function"&&reference.isEqual(entry.query));
            if(matches.length!==1)fail("data-loss","Segmented query is unknown or ambiguous.");
            chargeRecoveryAuditAssembly(budget,"operations",1);
            const shape=matches[0],selected=[];
            for(const id of namespaces.get(root.path+"/"+shape.name)){
                const path=root.path+"/"+shape.name+"/"+id,doc=snapshot(path);
                if(shape.filter(doc.data())){
                    if(shape.order&&!Number.isSafeInteger(doc.get(shape.order)))fail("data-loss","Segmented query sequence is invalid.");
                    selected.push(doc);
                    if(shape.order){selected.sort((a,b)=>b.get(shape.order)-a.get(shape.order)||Buffer.compare(Buffer.from(b.id),Buffer.from(a.id)));
                        if(selected.length>shape.maximum)selected.pop();}
                }
                if(!shape.order&&selected.length===shape.maximum)break;
            }
            if(shape.order){
                if(selected.some(doc=>!Number.isSafeInteger(doc.get(shape.order))))fail("data-loss","Segmented query sequence is invalid.");
                selected.sort((a,b)=>b.get(shape.order)-a.get(shape.order)||Buffer.compare(Buffer.from(b.id),Buffer.from(a.id)));
            }
            return result(selected.slice(0,shape.maximum));
        };
        const tracked=reference=>{
            const promise=lookup(reference);pending.add(promise);
            void promise.then(()=>pending.delete(promise),()=>pending.delete(promise));return promise;
        };
        const tx=Object.freeze({get:tracked});
        const unit=()=>{
            capture.release();let reads=0,typedBytes=0;const paths=new Set();metrics.units++;
            // A new readonly identity gives original Owners a unit-local cache.
            // It never calls beginEvidenceAttempt on an existing live attempt.
            return Object.freeze({get:async reference=>{
                if(++reads>PATROL_PROOF_LIMITS.kernelReads)fail("resource-exhausted","Segmented original proof read budget exceeded.");
                const row=await tracked(reference),docs=row.docs??[row];
                if(row.docs)reads+=Math.max(1,row.size)-1;
                if(reads>PATROL_PROOF_LIMITS.kernelReads)fail("resource-exhausted","Segmented original proof read budget exceeded.");
                for(const doc of docs)if(doc.exists&&!paths.has(doc.ref.path)){
                    paths.add(doc.ref.path);typedBytes+=capture.index.get(doc.ref.path).typedDataByteLength;
                    if(typedBytes>PATROL_PROOF_LIMITS.bytes)fail("resource-exhausted","Segmented proof resident data exceeds2MiB.");
                }
                metrics.maxUnitReads=Math.max(metrics.maxUnitReads,reads);metrics.maxUnitTypedBytes=Math.max(metrics.maxUnitTypedBytes,typedBytes);
                return row;
            }});
        };
        segmentedScopes.set(tx,{unit});
        const rows=(name,filter=null)=>{
            const path=root.path+"/"+name,ids=namespaces.get(path);
            if(!ids)fail("data-loss","Segmented inventory namespace differs.");
            const query=Object.freeze({});segmentedRowSets.set(query,{count:filter?undefined:ids.length,
                iterate:async function*(){for(const id of ids){const doc=snapshot(path+"/"+id);if(!filter||filter(doc))yield doc;}}});return query;
        };
        const finish=()=>{
            const unused=[...capture.index.keys()].find(path=>!used.has(path));
            if(unused)fail("data-loss","Segmented unused dependency "+unused);
            capture.release();return {documentCount:capture.index.size,absenceCount:absences.size,dependencyCount:used.size,
                residentUsage:Object.freeze({...metrics,...capture.metrics})};
        };
        return {root,save:db.doc("users/"+uid+"/saves/current"),tx,rows,finish,
            close:async()=>{await Promise.allSettled([...pending]);capture.release();recoveryAuditAssemblyUsage(budget);}};
    }
    async function verifySegmentedRawRecoveryProof(input){
        const budget=createRecoveryAuditAssemblyBudget();let view;
        try{
            chargeRecoveryAuditAssembly(budget,"passes",1);
            const capture=inspectCompleteRawCapture(input,budget,true),{ownerUid:uid,sourceRevision:revision,auditId}=input.binding;
            view=segmentedRawView(capture,budget,uid);const {tx,root}=view;
            const selected=await tx.get(root.collection(RECOVERY_AUDIT_RUN_COLLECTION).doc(auditId));
            if(!selected.exists||!encodeProofPayload(selected.data(),budget).equals(encodeProofPayload(input.run,budget)))
                fail("data-loss","Segmented selected run differs.");
            const run=selected.data();
            view.auditControl={auditId,epoch:run.epoch,sessionId:run.sessionId,sessionRevision:run.sessionRevision,
                recordedAt:run.createdAt};
            const envelopeSnap=await tx.get(view.save),archiveSnap=await tx.get(root.collection("recoveryArchives").doc(String(revision))),
                snapshotSnap=await tx.get(root.collection("playableSnapshots").doc(String(revision)));
            const {envelope,records}=inspectCurrentRecoverySource(uid,revision,{envelopeSnap,archiveSnap,snapshotSnap});
            if(envelope.serverRevision!==revision)fail("aborted","CLOUD_REVISION_CONFLICT");
            await verifyCandidateAuditControl(tx,root,uid,revision,view.auditControl);
            for(const name of Object.keys(SINGLES)){
                const doc=await tx.get(root.collection(name==="claimCheckpoint"?"claimCheckpoints":name).doc(SINGLES[name]));
                if(doc.exists&&(!Number.isSafeInteger(doc.get("serverRevision"))||doc.get("serverRevision")<1||doc.get("serverRevision")>revision))
                    fail("data-loss","Surviving source revision blocks segmented proof.");
            }
            for(const name of Object.keys(SETS)){
                const keys=new Set(records[name].map(SETS[name]));
                for await(const doc of recoveryRows(view.rows(name)))if(!keys.has(doc.id)||!Number.isSafeInteger(doc.get("serverRevision"))||
                    doc.get("serverRevision")<1||doc.get("serverRevision")>revision)fail("data-loss","Unexpected current source blocks segmented proof.");
            }
            const collections={};for(const [key,name] of Object.entries({claims:"uniqueClaims",receipts:"grantOperations",ledgers:"ledgerEntries",
                grants:"pendingGrants",events:"rewardEvents",operations:"operations",modeSources:"simulatedAdSources",patrolTickets:"patrolTickets",
                patrolStates:"patrolTicketStates",patrolSettlements:"patrolSettlements",patrolClosures:"patrolClosures"}))collections[key]=view.rows(name);
            const modeEvents=view.rows("modeTimeEvents",doc=>doc.get("modeChanged")===true),
                patrolModeEvents=view.rows("modeTimeEvents",doc=>doc.get("schemaVersion")===2),
                patrolOwnedModeEvents=view.rows("modeTimeEvents",doc=>doc.get("resultOwner")==="forest-patrol-settlement"),
                patrolOperationIds=new Set((await recoveryIndex(collections.patrolSettlements,()=>true)).keys());
            const verified=await verifyRecoveryRights(tx,root,uid,revision,records,{...collections,modeEvents,patrolModeEvents,patrolOwnedModeEvents,patrolOperationIds});
            for await(const doc of recoveryRows(view.rows("modeTimeEvents"))){
                if(doc.get("schemaVersion")===1&&doc.get("modeChanged")===false)
                    await verifyProofUnit(tx,recoveryUnit(tx),root,uid,records,revision,"mode-nonvalue-event",doc.id);
                else if(!(doc.get("schemaVersion")===1&&doc.get("modeChanged")===true)&&
                    !(doc.get("schemaVersion")===2&&doc.get("resultOwner")==="forest-patrol-settlement"))
                    fail("data-loss","An unclassified private mode event blocks segmented proof.");
            }
            await verifyRetainedAuditControls(view,uid,revision,collections.operations,verified);
            const summary=view.finish();
            return Object.freeze({...inventoryFlags,segmentedProofValid:true,ownerUid:uid,sourceRevision:revision,...summary,
                assemblyUsage:recoveryAuditAssemblyUsage(budget)});
        }catch(error){if(error instanceof HttpsError)throw error;fail("data-loss",error.message);}
        finally{if(view)await view.close();}
    }
    async function verifyRawRecoveryAuditCandidate(input){
        return (await assembleRawCandidate(input)).summary;
    }
    function publicationIdentity(map,value){
        const identity=Object.freeze({});map.set(identity,value);return identity;
    }
    function publicationValue(map,identity){
        const value=identity&&map.get(identity);
        if(!value)fail("permission-denied","An original private candidate identity is required.");
        return value;
    }
    // Thirteen point reads including the original Session runner's three.
    // This does not include the separately bounded outside-transaction scan.
    async function publicationContext(tx,session,args){
        const context=await inventoryContext(tx,session,args.auditId,args.expectedEpoch);
        const {run,namespaces,stateRef,runRef}=context;
        const inventory=inspectInventoryState((await tx.get(stateRef)).data(),run,namespaces);
        admitProofInventory(inventory,namespaces);
        const rawState=inspectProofState((await tx.get(runRef.collection("proofState").doc("current"))).data(),run,inventory);
        if(rawState.schemaVersion!==3||rawState.rawNextOffset!==inventory.capturedCount)
            fail("failed-precondition","A complete raw capture cursor is required.");
        const receipt=inspectRawReceipt((await tx.get(runRef.collection("patrolProofPages").doc(rawState.lastOperationId))).data(),run,inventory);
        if(receipt.sequence!==rawState.nextSequence-1||rawReceiptHash(receipt)!==rawState.lastReceiptSha256||
           receipt.endOrdinal!==rawState.rawNextOffset||receipt.startOrdinal!==rawState.lastStartOrdinal||
           receipt.count!==rawState.lastCount||receipt.payloadSha256!==rawState.lastPayloadSha256)
            fail("data-loss","Publication raw capture head differs.");
        const reference=runRef.collection("candidatePublications").doc(args.operationId),existing=await tx.get(reference);
        const tuple={ownerUid:session.uid,auditId:run.auditId,epoch:run.epoch,operationId:args.operationId,
            sessionId:session.sessionId,sessionRevision:session.revision,sourceRevision:run.sourceRevision,
            sourceSha256:run.sourceSha256,snapshotSha256:run.snapshotSha256,approvalOperationId:run.approvalOperationId,
            approvalBindingSha256:run.approvalBindingSha256,inventoryStateSha256:inventory.stateSha256,
            rawStateSha256:rawState.stateSha256,rawLastReceiptSha256:rawState.lastReceiptSha256};
        return {...context,inventory,rawState,tuple,reference,existing};
    }
    async function pinCandidatePublication(request,args){
        requirePublicationPreparation();
        auditIntent("pin publication",args,["auditId","expectedEpoch","operationId"]);
        // A failed/retried callback never mints an identity. Only its committed
        // result is retained in the private map after run resolves.
        const pinned=await runRecoveryAuditMaintenance(request,args.auditId,async(tx,session)=>{
            const value=await publicationContext(tx,session,args);
            return {args:{...args},tuple:value.tuple,run:value.run,inventory:value.inventory,rawState:value.rawState,runRef:value.runRef};
        },args.operationId);
        return publicationIdentity(publicationPins,pinned);
    }
    async function loadPinnedRawCapture(pin){
        requirePublicationPreparation();
        const pinned=publicationValue(publicationPins,pin),budget=createRecoveryAuditAssemblyBudget();
        const input={binding:{ownerUid:pinned.tuple.ownerUid,auditId:pinned.tuple.auditId,epoch:pinned.tuple.epoch,
            sourceRevision:pinned.tuple.sourceRevision,inventoryStateSha256:pinned.tuple.inventoryStateSha256},
            run:pinned.run,inventoryState:pinned.inventory,rawState:pinned.rawState};
        let wireBytes=0,scanReads=0;
        // Immutable capture paths only. SDK materialization is separately
        // bounded, not charged as thirteen transaction reads or called full
        // history support. B1 reserves these actual buffers once before parse.
        for(const [name,key,maximum] of [["inventoryPages","inventoryPages",317],
            ["patrolProofPages","rawReceipts",pinned.inventory.capturedCount],
            ["proofPayloadChunks","rawChunks",pinned.inventory.capturedCount*8]]){
            const rows=[];let after=null;
            for(;;){
                recoveryAuditAssemblyUsage(budget);
                let query=pinned.runRef.collection(name).orderBy("__name__").limit(16);
                if(after)query=query.startAfter(after);
                const result=await query.get();scanReads+=Math.max(1,result.size);
                recoveryAuditAssemblyUsage(budget);
                if(result.empty)break;
                if(result.size>16||rows.length+result.size>maximum)fail("resource-exhausted","Publication capture scan exceeds its bounds.");
                for(const snapshot of result.docs){
                    const row=snapshot.data();
                    if(name==="patrolProofPages"){
                        inspectRawReceipt(row,pinned.run,pinned.inventory);
                        if(snapshot.id!==row.operationId)fail("data-loss","Publication receipt ID differs.");
                    }else{
                        if(name==="inventoryPages")inventoryExact(row,["schemaVersion","kind","ownerUid","auditId","epoch","operationId","intentSha256","payloadSha256","payloadBytes","createdAt"],"publication inventory page");
                        else{
                            const receipt=input.rawReceipts.find(entry=>entry.id===row?.operationId)?.row;
                            if(!receipt||snapshot.id!==row.operationId+"_"+String(row.chunkIndex).padStart(2,"0"))
                                fail("data-loss","Publication chunk ID differs.");
                            inspectCapsuleChunk(row,row.chunkIndex,receipt,pinned.run,3);
                        }
                        const bytes=row?.payloadBytes;
                        if(!Buffer.isBuffer(bytes)||bytes.length>(name==="inventoryPages"?128*1024:256*1024))
                            fail("data-loss","Publication capture bytes are inconsistent.");
                        wireBytes+=bytes.length;
                        if(wireBytes>256*1024*1024)fail("resource-exhausted","Publication capture scan exceeds its byte bound.");
                    }
                    rows.push({id:snapshot.id,row});
                }
                after=result.docs.at(-1);
            }
            input[key]=rows;
        }
        recoveryAuditAssemblyUsage(budget);
        return publicationIdentity(publicationMaterials,{pin,input,budget,scanReads,wireBytes});
    }
    async function assemblePinnedCandidate(pin,material){
        requirePublicationPreparation();
        publicationValue(publicationPins,pin);
        const value=publicationValue(publicationMaterials,material);
        if(value.pin!==pin)fail("permission-denied","Candidate material belongs to another pin.");
        const artifact=await assembleRawCandidate(value.input,value.budget);
        publicationMaterials.delete(material);
        return publicationIdentity(publicationArtifacts,{pin,bytes:artifact.bytes,summary:artifact.summary});
    }
    async function prepareCandidatePublication(request,pin,artifactIdentity){
        requirePublicationPreparation();
        const pinned=publicationValue(publicationPins,pin),artifact=publicationValue(publicationArtifacts,artifactIdentity);
        if(artifact.pin!==pin)fail("permission-denied","Candidate artifact belongs to another pin.");
        const {args}=pinned;
        const value=await runRecoveryAuditMaintenance(request,args.auditId,async(tx,session)=>{
            const current=await publicationContext(tx,session,args);
            if(snapshotDigest(current.tuple)!==snapshotDigest(pinned.tuple))fail("aborted","Publication capture binding changed.");
            const tuple={schemaVersion:1,kind:"canonical-recovery-candidate-publication",...pinned.tuple,
                intentSha256:snapshotDigest({action:"prepare-candidate-publication",...pinned.tuple}),
                candidateEncodingVersion:2,bucketName:immutableCandidateIO.bucketName,
                objectName:`private/recovery-candidates/v1/${session.uid}/${args.auditId}/${args.expectedEpoch}/${args.operationId}.csra`,
                artifactSha256:inventoryHash(artifact.bytes),artifactByteLength:artifact.bytes.length,status:"prepared",...inventoryFlags};
            if(typeof tuple.bucketName!=="string"||!tuple.bucketName)fail("failed-precondition","A private publication destination is unavailable.");
            if(current.existing.exists){
                inspectPublicationManifest(current.existing.data(),tuple);
            }else tx.create(current.reference,{...tuple,createdAt:FieldValue.serverTimestamp()});
            return tuple;
        },args.operationId);
        return publicationIdentity(publicationPreparations,{pin,artifactIdentity,tuple:value});
    }
    const publicationGeneration=value=>typeof value==="string"&&/^[1-9][0-9]{0,19}$/.test(value);
    function inspectPublicationManifest(row,tuple){
        if(!row)fail("data-loss","Original candidate publication manifest is missing.");
        const {createdAt,...value}=row;
        if(typeof createdAt?.toMillis!=="function"||!Number.isSafeInteger(createdAt.toMillis()))
            fail("data-loss","Original candidate publication timestamp differs.");
        timestampPair(createdAt);
        if(row.status==="acknowledged"){
            const {generation,objectSize,ackAt,...original}=value;
            if(!publicationGeneration(generation)||objectSize!==tuple.artifactByteLength||
               typeof ackAt?.toMillis!=="function"||!Number.isSafeInteger(ackAt.toMillis()))
                fail("data-loss","Original candidate acknowledgement differs.");
            timestampPair(ackAt);
            if(snapshotDigest({...original,status:"prepared"})!==snapshotDigest(tuple))
                fail("data-loss","Original candidate publication manifest differs.");
        }else if(snapshotDigest(value)!==snapshotDigest(tuple))fail("data-loss","Original candidate publication manifest differs.");
        return row;
    }
    async function livePreparedPublication(request,identity){
        const prepared=publicationValue(publicationPreparations,identity),pinned=publicationValue(publicationPins,prepared.pin);
        const artifact=publicationValue(publicationArtifacts,prepared.artifactIdentity);
        const manifest=await runRecoveryAuditMaintenance(request,pinned.args.auditId,async(tx,session)=>{
            const current=await publicationContext(tx,session,pinned.args);
            if(snapshotDigest(current.tuple)!==snapshotDigest(pinned.tuple))fail("aborted","Publication capture binding changed.");
            return inspectPublicationManifest(current.existing.data(),prepared.tuple);
        },pinned.args.operationId);
        return {prepared,pinned,artifact,manifest};
    }
    function publicationMetadata(value,tuple){
        inventoryExact(value,["bucketName","objectName","generation","size"],"publication object metadata");
        if(value.bucketName!==tuple.bucketName||value.objectName!==tuple.objectName||
           !publicationGeneration(value.generation)||value.size!==tuple.artifactByteLength)
            fail("data-loss","Candidate object metadata differs from its manifest.");
        return value;
    }
    async function publishPreparedCandidate(request,identity){
        requirePublicationPreparation();
        if(["createOnly","lookupMetadata","readExact"].some(name=>typeof immutableCandidateIO[name]!=="function"))
            fail("failed-precondition","Immutable candidate IO is unavailable.");
        // This protected read finishes before any external side effect. There
        // is no Firestore/Storage distributed transaction: ACK rechecks again.
        const {prepared,artifact,manifest}=await livePreparedPublication(request,identity),tuple=prepared.tuple;
        const name={bucketName:tuple.bucketName,objectName:tuple.objectName};
        let metadata;
        if(manifest.status==="acknowledged")metadata={...name,generation:manifest.generation,size:manifest.objectSize};
        else{
            metadata=await immutableCandidateIO.lookupMetadata({...name});
            if(metadata===null){
                let created;
                try{
                    created=publicationMetadata(await immutableCandidateIO.createOnly({...name,
                        bytes:Buffer.from(artifact.bytes),ifGenerationMatch:"0"}),tuple);
                }catch(error){
                    if(!["ALREADY_EXISTS","UNKNOWN_COMMIT"].includes(error.code))throw error;
                }
                metadata=await immutableCandidateIO.lookupMetadata({...name});
                if(metadata===null)fail("unavailable","Original immutable candidate object is not available.");
                if(created&&metadata.generation!==created.generation)fail("data-loss","Created candidate generation changed.");
            }
        }
        publicationMetadata(metadata,tuple);
        const response=await immutableCandidateIO.readExact({...name,generation:metadata.generation});
        inventoryExact(response,["metadata","bytes"],"publication exact read");
        const observed=publicationMetadata(response.metadata,tuple);
        if(observed.generation!==metadata.generation||!Buffer.isBuffer(response.bytes)||response.bytes.length!==tuple.artifactByteLength)
            fail("data-loss","Exact candidate generation or bytes differ.");
        const generation=observed.generation,bytes=Buffer.from(response.bytes);
        if(inventoryHash(bytes)!==tuple.artifactSha256)fail("data-loss","Immutable candidate bytes differ from the original manifest.");
        const result=await verifyRecoveryAuditArtifact({uid:tuple.ownerUid,expectedRevision:tuple.sourceRevision,artifactBytes:bytes});
        if(result.candidateProofValid!==true||result.trustedCaptureVerified!==false||result.restoreAuthorized!==false||
           result.authoritativeStateReady!==false||result.ownerUid!==tuple.ownerUid||result.sourceRevision!==tuple.sourceRevision||
           result.sourceSha256!==tuple.sourceSha256||result.snapshotSha256!==tuple.snapshotSha256)
            fail("data-loss","Immutable candidate original proof differs.");
        return publicationIdentity(publicationReadProofs,{identity,tupleSha256:snapshotDigest(tuple),
            generation,size:bytes.length,sha256:inventoryHash(bytes),consumed:false,unusable:false});
    }
    async function ackCandidatePublication(request,identity,readIdentity){
        requirePublicationPreparation();
        const prepared=publicationValue(publicationPreparations,identity),proof=publicationValue(publicationReadProofs,readIdentity);
        const pinned=publicationValue(publicationPins,prepared.pin),tuple=prepared.tuple;
        if(proof.identity!==identity||proof.consumed||proof.unusable||proof.tupleSha256!==snapshotDigest(tuple)||
           proof.size!==tuple.artifactByteLength||proof.sha256!==tuple.artifactSha256)
            fail("permission-denied","An original unconsumed exact candidate read is required.");
        let result;
        try{result=await runRecoveryAuditMaintenance(request,pinned.args.auditId,async(tx,session)=>{
            const current=await publicationContext(tx,session,pinned.args);
            if(snapshotDigest(current.tuple)!==snapshotDigest(pinned.tuple))fail("aborted","Publication capture binding changed.");
            const manifest=inspectPublicationManifest(current.existing.data(),tuple),unchanged=manifest.status==="acknowledged";
            if(unchanged){
                if(manifest.generation!==proof.generation||manifest.objectSize!==proof.size)
                    fail("data-loss","Original acknowledged candidate generation differs.");
            }else tx.update(current.reference,{status:"acknowledged",generation:proof.generation,objectSize:proof.size,ackAt:FieldValue.serverTimestamp()});
            return Object.freeze({...inventoryFlags,status:"acknowledged",auditId:tuple.auditId,operationId:tuple.operationId,
                artifactSha256:tuple.artifactSha256,generation:proof.generation,unchanged});
        },pinned.args.operationId);}
        catch(error){
            // SDK callback retries stay within the awaited runner. Any outer
            // failure (including a committed-but-lost response) requires a
            // fresh exact-generation full read, without hiding its error.
            proof.unusable=true;throw error;
        }
        // Only successful transaction resolution consumes a usable proof.
        proof.consumed=true;return result;
    }
    // Keep every private identity inside one server invocation.
    async function publishCapturedCandidate(request,args){
        requirePublicationPreparation();
        const pin=await pinCandidatePublication(request,args);
        const material=await loadPinnedRawCapture(pin);
        const artifact=await assemblePinnedCandidate(pin,material);
        const prepared=await prepareCandidatePublication(request,pin,artifact);
        const readProof=await publishPreparedCandidate(request,prepared);
        return ackCandidatePublication(request,prepared,readProof);
    }
    // Candidate-only internal consistency review. This does not establish that
    // a trusted capture included all live documents, grant approval, or return
    // records/a capability usable by the private restore write kernel.
    async function verifyRecoveryAuditArtifact({uid,expectedRevision,artifactBytes}){
        if(typeof uid!=="string"||!uid||uid.includes("/")||
           !Number.isSafeInteger(expectedRevision)||expectedRevision<2){
            fail("invalid-argument","A candidate owner and current revision are required.");
        }
        let view;
        try{view=decodeRecoveryAuditArtifact(artifactBytes,{uid,expectedRevision,db});}
        catch(error){fail("data-loss",error.message);}
        try{return await verifyCandidateStrict(view,uid,expectedRevision);}
        catch(error){
            if(error instanceof HttpsError)throw error;
            fail("data-loss",error.message);
        }finally{
            await drainAndCloseRecoveryAuditLookups(view);
        }
    }
    async function maintain(request){
        const data=request?.data;
        if(!data||typeof data!=="object"||Array.isArray(data)||
           Object.keys(data).sort().join("|")!=="action|intent|session|uid"||
           typeof data.uid!=="string"||!data.uid||data.uid.includes("/")||
           !data.session||typeof data.session!=="object"||Array.isArray(data.session)||
           typeof data.action!=="string"||!data.intent||typeof data.intent!=="object"||Array.isArray(data.intent))
            fail("invalid-argument","An exact recovery maintenance action is required.");
        for(const [key,value] of Object.entries(data.intent)){
            if(["expectedRevision","expectedEpoch","expectedSequence","startOrdinal","count"].includes(key)?
                !Number.isSafeInteger(value):typeof value!=="string")
                fail("invalid-argument","Recovery maintenance intent fields have invalid types.");
        }
        switch(data.action){
        case "begin":return beginAudit(request,data.intent);
        case "resume":return resumeAudit(request,data.intent);
        case "cancel":return cancelAudit(request,data.intent);
        case "prepareInventory":return prepareInventory(request,data.intent);
        case "captureInventoryPage":return captureInventoryPage(request,data.intent);
        case "captureRawInventory":return captureRawInventory(request,data.intent);
        case "publish":return publishCapturedCandidate(request,data.intent);
        default:fail("invalid-argument","Unsupported recovery maintenance action.");
        }
    }
    if(maintenanceMode)return Object.freeze({maintain});
    return Object.freeze({restoreCurrent,verifyRecoveryAuditArtifact,verifyRawRecoveryAuditCandidate,beginAudit,resumeAudit,cancelAudit,prepareInventory,captureInventoryPage,captureProof,captureRawInventory});
}

module.exports={createCanonicalCurrentRecovery,createCanonicalRecoveryMaintenance,inspectRecoveryAuditFence,
    RECOVERY_AUDIT_FENCE_COLLECTION,RECOVERY_AUDIT_RUN_COLLECTION,RECOVERY_INVENTORY_STATE_COLLECTION,RECOVERY_INVENTORY_PAGE_COLLECTION};
