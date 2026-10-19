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
const {createCanonicalSourceWriter}=require("./canonical-source-writer");
const {createCanonicalPatrolSettlement}=require("./canonical-patrol-settlement");
const {decodeRecoveryAuditArtifact,recoveryAuditNamespaces,encodeInventoryPayload,decodeInventoryPayload,
    inventoryDocumentMetadata,INVENTORY_LIMITS}=require("./recovery-audit-artifact");
const {createHash}=require("node:crypto");

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
function createCanonicalCurrentRecovery({db,FieldValue,HttpsError,runProtected,
    runRecoveryAuditMaintenance,inspectExistingEnvelope,nextRevision,now=Date.now}){
    const fail=(code,message)=>{throw new HttpsError(code,message);};
    const sourceEvidence=createCanonicalSourceWriter({db,FieldValue,HttpsError,runProtected,
        inspectExistingEnvelope,nextRevision,now});
    const patrolEvidence=createCanonicalPatrolSettlement({db,FieldValue,HttpsError,runProtected,
        inspectExistingEnvelope,nextRevision,now});
    const modeEvidence=patrolEvidence.modeOwner;
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
        const binding={schemaVersion:approval.schemaVersion,kind:approval.kind,ownerUid:uid,operationId:approvalOperationId,
            sourceRevision,sourceSha256:approval.sourceSha256,snapshotSha256:approval.snapshotSha256,
            approvedBy:approval.approvedBy,status:approval.status,issuedAt:timestampPair(approval.issuedAt),expiresAt:timestampPair(approval.expiresAt)};
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
    function inspectInventoryPage(row,args,run,state,namespaces,pendingCreate=false){
        inventoryExact(row,["schemaVersion","kind","ownerUid","auditId","epoch","operationId","intentSha256","payloadSha256","payloadBytes","createdAt"],"page");
        if(row.schemaVersion!==1||row.kind!=="canonical-recovery-inventory-page"||row.ownerUid!==run.ownerUid||row.auditId!==run.auditId||
           row.epoch!==run.epoch||row.operationId!==args.operationId||row.intentSha256!==snapshotDigest({action:"capture-inventory-page",...args})||
           !HEX.test(row.payloadSha256||"")||!Buffer.isBuffer(row.payloadBytes)||inventoryHash(row.payloadBytes)!==row.payloadSha256||
           (!pendingCreate&&typeof row.createdAt?.toMillis!=="function"))fail("data-loss","Inventory page seal is inconsistent.");
        let payload;try{payload=decodeInventoryPayload(row.payloadBytes);}catch(error){fail("data-loss",error.message);}
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
    async function verifyDebitRecoveryEvidence(tx,root,uid,expectedRevision,records,doc,ledger,receipt){
        const operation=await tx.get(root.collection("operations").doc(doc.id));
        const debit=operation.data();
        if(receipt||!operation.exists||debit.schemaVersion!==1||debit.ownerUid!==uid||
           debit.operationId!==doc.id||!["shop-purchase","exp-allocation","attribute-allocation"].includes(debit.kind)){
            fail("data-loss","An unmatched ledger entry blocks recovery.");
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
    async function verifyRecoveryRights(tx,root,uid,expectedRevision,records,{
        claims,receipts,ledgers,grants,events,operations,modeSources,modeEvents,
        patrolTickets,patrolStates,patrolSettlements,patrolClosures,patrolModeEvents,
        patrolOwnedModeEvents,patrolOperationIds}){
        const archivedClaims=new Map(records.claimRecords.map(record=>[record.claimKey,record]));
        if(claims.docs.length!==archivedClaims.size){
            fail("data-loss","Independent claims differ from the recovery archive.");
        }
        // A lost claim/receipt index cannot hide a retained economic delta.
        // Reuse the original credit/debit Owners; never infer a missing
        // receipt from a balance or regenerate an operation during repair.
        const receiptById=new Map(receipts.docs.map(doc=>[doc.id,doc.data()]));
        const verifiedPatrolOperations=new Set(),ticketProofs=new Map();
        for(const doc of patrolTickets.docs){
            const proof=await patrolEvidence.verifyRetainedTicket(tx,root,uid,records.account,doc,expectedRevision);
            ticketProofs.set(doc.id,proof);
            for(const operationId of proof.verifiedOperationIds)verifiedPatrolOperations.add(operationId);
        }
        if(patrolStates.docs.length!==ticketProofs.size){
            fail("data-loss","Patrol ticket checkpoint inventory differs from retained sources.");
        }
        for(const doc of patrolStates.docs){
            const {createdAt,updatedAt,...state}=doc.data();
            if(!ticketProofs.has(doc.id)||snapshotDigest(state)!==snapshotDigest(ticketProofs.get(doc.id).state)){
                fail("data-loss","An orphaned Patrol checkpoint blocks recovery.");
            }
        }
        for(const doc of patrolSettlements.docs){
            if(!verifiedPatrolOperations.has(doc.id))fail("data-loss","An unindexed Patrol earning blocks recovery.");
            await patrolEvidence.verifyRetainedSettlement(tx,root,uid,records.account,doc,expectedRevision);
        }
        for(const doc of patrolClosures.docs){
            const proof=ticketProofs.get(doc.get("ticketId"));
            if(!proof||proof.state.status!=="abandoned"||proof.state.terminalOperationId!==doc.id){
                fail("data-loss","An orphaned Patrol closure blocks recovery.");
            }
            await patrolEvidence.verifyRetainedClosure(tx,root,uid,records.account,doc,expectedRevision);
        }
        for(const doc of [...patrolModeEvents.docs,...patrolOwnedModeEvents.docs]){
            if(doc.get("schemaVersion")!==2||doc.get("resultOwner")!=="forest-patrol-settlement"||
               !verifiedPatrolOperations.has(doc.id)||!patrolOperationIds.has(doc.id)){
                fail("data-loss","A Forest mode component lacks its original earning source.");
            }
        }
        await patrolEvidence.verifyCurrentEvidence(tx,root,uid,records.account,expectedRevision);
        await modeEvidence.verifyCurrentEvidence(tx,root,uid,records.account,records,expectedRevision);
        for(const doc of modeSources.docs){
            await modeEvidence.verifyRetainedSource(tx,root,uid,records.account,doc,expectedRevision);
        }
        const verifiedModeOperations=new Set();
        for(const doc of modeEvents.docs){
            if(doc.get("schemaVersion")===2){
                if(!verifiedPatrolOperations.has(doc.id))fail("data-loss","An orphaned Forest value event blocks recovery.");
                continue; // Full source-specific proof already checked this exact component.
            }
            await modeEvidence.verifyRetainedEvent(tx,root,uid,records.account,doc,expectedRevision);
            verifiedModeOperations.add(doc.id);
        }
        // Debit receipts survive independently of their ledger. Every known
        // purchase/allocation must reach the original full debit proof below,
        // even when its ledger was lost with the current canonical sources.
        const ledgerIds=new Set(ledgers.docs.map(doc=>doc.id));
        for(const doc of operations.docs){
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
                    await modeEvidence.verifyRetainedOperation(tx,root,uid,records.account,doc,expectedRevision);
                }
                verifiedModeOperations.add(doc.id);
            }else if(["shop-purchase","exp-allocation","attribute-allocation"].includes(value.kind)){
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
                }else{
                    await sourceEvidence.verifyRetainedOperation(tx,root,uid,records.account,doc);
                }
            }
        }
        // Events survive independently of grants. Losing a grant must not
        // hide an original reward observation or authorize recreating it.
        const grantById=new Map(grants.docs.map(doc=>[doc.id,doc.data()]));
        for(const doc of events.docs){
            const grant=grantById.get(doc.id);
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
        const receiptsByGrant=new Set(receipts.docs.map(doc=>doc.get("grantId")));
        for(const doc of grants.docs){
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
        for(const doc of ledgers.docs){
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
            await verifyDebitRecoveryEvidence(tx,root,uid,expectedRevision,records,doc,ledger,receipt);
        }
        if(creditLedgerCount!==archivedClaims.size){
            fail("data-loss","Credit ledger inventory differs from the recovery archive.");
        }
        let creditedCount=0;
        for(const doc of receipts.docs){
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
        for(const doc of claims.docs){
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
               receipts.docs.length+ledgers.docs.length*5+reservedCount*6+
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
        const {tx,root}=view;
        patrolEvidence.beginEvidenceAttempt(tx);
        try{
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
            await verifyRecoveryRights(tx,root,uid,expectedRevision,records,{claims,receipts,ledgers,grants,events,operations,
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
            return Object.freeze({candidateProofValid:true,ownerUid:uid,sourceRevision:expectedRevision,
                sourceSha256:archiveSnap.get("sourceSha256"),snapshotSha256:snapshotSnap.get("sha256"),
                trustedCaptureVerified:false,restoreAuthorized:false,authoritativeStateReady:false,...view.finish()});
        }catch(error){
            if(error instanceof HttpsError)throw error;
            fail("data-loss",error.message);
        }
    }
    return Object.freeze({restoreCurrent,verifyRecoveryAuditArtifact,beginAudit,resumeAudit,cancelAudit,prepareInventory,captureInventoryPage});
}

module.exports={createCanonicalCurrentRecovery,inspectRecoveryAuditFence,
    RECOVERY_AUDIT_FENCE_COLLECTION,RECOVERY_AUDIT_RUN_COLLECTION,RECOVERY_INVENTORY_STATE_COLLECTION,RECOVERY_INVENTORY_PAGE_COLLECTION};
