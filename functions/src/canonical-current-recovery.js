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
    inspectExistingEnvelope,nextRevision,now=Date.now}){
    const fail=(code,message)=>{throw new HttpsError(code,message);};
    const sourceEvidence=createCanonicalSourceWriter({db,FieldValue,HttpsError,runProtected,
        inspectExistingEnvelope,nextRevision,now});
    const patrolEvidence=createCanonicalPatrolSettlement({db,FieldValue,HttpsError,runProtected,
        inspectExistingEnvelope,nextRevision,now});
    const modeEvidence=patrolEvidence.modeOwner;
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
                               original.account.slots[0]!==records.account.slots[0]||
                               original.account.slots[1]!==null||original.account.slots[2]!==null){
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
                    if(original.account.slots[0]!==records.account.slots[0]||
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
                    verifyExpAllocationEvidence({...proof,characterId:records.account.slots[0]});
                }else{
                    verifyAttributeAllocationEvidence({...proof,characterId:records.account.slots[0],stat:debit.stat});
                }
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
        });
    }
    return Object.freeze({restoreCurrent});
}

module.exports={createCanonicalCurrentRecovery};
