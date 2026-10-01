"use strict";

const {inspectRecoveryArchive}=require("./canonical-recovery-archive");
const positive=value=>Number.isSafeInteger(value)&&value>=1;
const balance=value=>Number.isSafeInteger(value)&&value>=0;
const digest=value=>typeof value==="string"&&/^[a-f0-9]{64}$/.test(value);

// Shared by settlement and reservation retries. Never recreate missing proof,
// consult browser history, or compare an old credit to today's mutable balance.
async function verifyCreditedGrant({tx,root,uid,grantId,operationId,currentRevision,
    grant,receipt,ledger,claim,claimRecord,otherOperationExists,fail}){
    const invalid=()=>fail("data-loss","Credited grant evidence is inconsistent.");
    if(otherOperationExists||!grant||!receipt||!ledger||!claim||!claimRecord||
       [grant,receipt,ledger,claim,claimRecord].some(record=>
           record.schemaVersion!==1||record.ownerUid!==uid)||
       grant.source!=="server-event"||grant.status!=="credited"||
       !["gold","exp"].includes(grant.kind)||!positive(grant.amount)||grant.amount>100000||
       grant.claimedByOperationId!==operationId||receipt.creditedToCharacter!==true||
       !positive(receipt.serverRevision)||!positive(receipt.creditRevision)||
       receipt.serverRevision>receipt.creditRevision||receipt.creditRevision>currentRevision||
       !digest(receipt.snapshotSha256)||
       [receipt,ledger,claim,claimRecord].some(record=>
           record.grantId!==grantId||record.operationId!==operationId)||
       receipt.kind!==grant.kind||receipt.amount!==grant.amount||
       ledger.kind!==grant.kind||ledger.amount!==grant.amount||
       ledger.creditRevision!==receipt.creditRevision||
       ledger.snapshotSha256!==receipt.snapshotSha256||
       claim.creditRevision!==receipt.creditRevision||
       claimRecord.claimKey!==grantId||claimRecord.status!=="claimed"||
       claimRecord.provenance!=="server-created"||!positive(claimRecord.serverRevision)||
       claimRecord.serverRevision<receipt.creditRevision||claimRecord.serverRevision>currentRevision){
        invalid();
    }
    // Older ledgers are retained, never backfilled from current balances. A
    // separate evidence migration would be required before acknowledging them.
    if(ledger.creditEvidenceVersion===undefined){
        fail("failed-precondition","CREDIT_EVIDENCE_REQUIRED");
    }
    if(ledger.creditEvidenceVersion!==1||!positive(ledger.sourceRevision)||
       ledger.sourceRevision>=receipt.creditRevision||!digest(ledger.sourceSnapshotSha256)||
       !balance(ledger.balanceBefore)||!balance(ledger.balanceAfter)||
       ledger.balanceBefore>Number.MAX_SAFE_INTEGER-grant.amount||
       ledger.balanceAfter!==ledger.balanceBefore+grant.amount){invalid();}
    const [beforeSnapshot,beforeArchive,afterSnapshot,afterArchive]=await Promise.all([
        tx.get(root.collection("playableSnapshots").doc(String(ledger.sourceRevision))),
        tx.get(root.collection("recoveryArchives").doc(String(ledger.sourceRevision))),
        tx.get(root.collection("playableSnapshots").doc(String(receipt.creditRevision))),
        tx.get(root.collection("recoveryArchives").doc(String(receipt.creditRevision)))
    ]);
    let before,after;
    try{
        if(beforeSnapshot.get("sha256")!==ledger.sourceSnapshotSha256||
           afterSnapshot.get("sha256")!==receipt.snapshotSha256){throw new Error("digest");}
        before=inspectRecoveryArchive(beforeArchive.data(),uid,ledger.sourceRevision,beforeSnapshot.data());
        after=inspectRecoveryArchive(afterArchive.data(),uid,receipt.creditRevision,afterSnapshot.data());
    }catch(_){invalid();}
    const key=grant.kind==="gold"?"gold":"sharedExp";
    const otherKey=grant.kind==="gold"?"sharedExp":"gold";
    const archivedClaim=after.claimRecords.find(record=>record.claimKey===grantId);
    if(before.economy[key]!==ledger.balanceBefore||after.economy[key]!==ledger.balanceAfter||
       before.economy[otherKey]!==after.economy[otherKey]||
       before.claimRecords.some(record=>record.claimKey===grantId)||
       after.claimRecords.length!==before.claimRecords.length+1||
       !archivedClaim||archivedClaim.operationId!==operationId||
       archivedClaim.grantId!==grantId||archivedClaim.status!=="claimed"){
        invalid();
    }
}

module.exports={verifyCreditedGrant};
