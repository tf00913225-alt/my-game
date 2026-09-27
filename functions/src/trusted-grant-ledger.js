"use strict";

// Only a trusted backend can create a grant record. This owner reserves an
// entitlement once; it never trusts a browser-supplied kind or amount.
const ID_PATTERN=/^[A-Za-z0-9_-]{16,64}$/;
const GRANT_SCHEMA_VERSION=1;

function createTrustedGrantLedger({db,FieldValue,HttpsError,runProtected,inspectExistingEnvelope,nextRevision}){
    const fail=(code,message)=>{ throw new HttpsError(code,message); };

    async function reserve(request){
        const grantId=request.data?.grantId;
        const operationId=request.data?.operationId;
        const expectedRevision=request.data?.expectedRevision;
        const keys=Object.keys(request.data||{}).filter(key=>key!=="uid"&&key!=="session").sort();
        if(keys.join(",")!=="expectedRevision,grantId,operationId"||
           !ID_PATTERN.test(grantId||"")||!ID_PATTERN.test(operationId||"")||
           !Number.isSafeInteger(expectedRevision)||expectedRevision<1){
            fail("invalid-argument","Grant intent requires exact IDs and an expected server revision.");
        }

        return runProtected(request,async(transaction,session)=>{
            const uid=session.uid;
            const privateRef=db.collection("serverUsers").doc(uid);
            const grantRef=privateRef.collection("pendingGrants").doc(grantId);
            const receiptRef=privateRef.collection("grantOperations").doc(operationId);
            const operationRef=privateRef.collection("operations").doc(operationId);
            const ledgerRef=privateRef.collection("ledgerEntries").doc(operationId);
            const saveRef=db.collection("users").doc(uid).collection("saves").doc("current");
            const [grantSnapshot,receiptSnapshot,operationSnapshot,ledgerSnapshot,
                saveSnapshot]=await Promise.all([
                transaction.get(grantRef),transaction.get(receiptRef),
                transaction.get(operationRef),transaction.get(ledgerRef),transaction.get(saveRef)
            ]);
            if(!saveSnapshot.exists){ fail("failed-precondition","Bootstrap the cloud account first."); }
            const envelope=inspectExistingEnvelope(saveSnapshot.data(),uid);
            if(envelope.kind!=="current"||envelope.data.authoritativeStateReady!==false){
                fail("failed-precondition","Grant ledger only supports pre-migration envelopes.");
            }
            if(receiptSnapshot.exists){
                if(operationSnapshot.exists){
                    fail("data-loss","Grant operation ID overlaps another operation.");
                }
                const receipt=receiptSnapshot.data();
                const grant=grantSnapshot.exists?grantSnapshot.data():null;
                if(receipt.schemaVersion!==GRANT_SCHEMA_VERSION||receipt.ownerUid!==uid||
                   receipt.grantId!==grantId||receipt.operationId!==operationId||
                   !Number.isSafeInteger(receipt.serverRevision)||receipt.serverRevision<1||
                   receipt.serverRevision>envelope.serverRevision||
                   !receipt.createdAt||typeof receipt.createdAt.toMillis!=="function"||
                   !grant||receipt.kind!==grant.kind||grant.schemaVersion!==GRANT_SCHEMA_VERSION||grant.ownerUid!==uid||
                   !["gold","exp"].includes(grant.kind)||grant.source!=="server-event"||
                   !Number.isSafeInteger(grant.amount)||grant.amount<1||grant.amount>100000||
                   grant.amount!==receipt.amount||
                   grant.claimedByOperationId!==operationId){
                    fail("data-loss","Grant receipt is inconsistent.");
                }
                if(receipt.creditedToCharacter===true){
                    const claim=await transaction.get(privateRef.collection("uniqueClaims").doc(grantId));
                    const ledger=ledgerSnapshot;
                    if(grant.status!=="credited"||!claim.exists||!ledger.exists||
                       claim.get("ownerUid")!==uid||claim.get("operationId")!==operationId||
                       claim.get("creditRevision")!==receipt.creditRevision||
                       ledger.get("ownerUid")!==uid||ledger.get("grantId")!==grantId||
                       ledger.get("operationId")!==operationId||
                       ledger.get("amount")!==receipt.amount||
                       ledger.get("kind")!==grant.kind||
                       ledger.get("creditRevision")!==receipt.creditRevision||
                       ledger.get("snapshotSha256")!==receipt.snapshotSha256||
                       !Number.isSafeInteger(receipt.creditRevision)||
                       receipt.creditRevision>envelope.serverRevision){
                        fail("data-loss","Credited grant receipt is inconsistent.");
                    }
                    return {grantId,operationId,serverRevision:receipt.serverRevision,
                        currentServerRevision:envelope.serverRevision,unchanged:true,
                        creditedToCharacter:true,creditRevision:receipt.creditRevision};
                }
                if(receipt.creditedToCharacter!==false||grant.status!=="reserved"||
                   ledgerSnapshot.exists){
                    fail("data-loss","Grant reservation receipt is inconsistent.");
                }
                return {grantId,operationId,serverRevision:receipt.serverRevision,
                    currentServerRevision:envelope.serverRevision,unchanged:true,creditedToCharacter:false};
            }
            if(operationSnapshot.exists||ledgerSnapshot.exists){
                fail("failed-precondition","Operation ID is already used.");
            }
            if(envelope.serverRevision!==expectedRevision){
                throw new HttpsError("aborted","CLOUD_REVISION_CONFLICT",{code:"CLOUD_REVISION_CONFLICT"});
            }
            if(!grantSnapshot.exists){ fail("failed-precondition","No server-issued grant exists."); }
            const grant=grantSnapshot.data();
            if(grant.schemaVersion!==GRANT_SCHEMA_VERSION||grant.ownerUid!==uid||
               !["gold","exp"].includes(grant.kind)||grant.source!=="server-event"||
               !Number.isSafeInteger(grant.amount)||grant.amount<1||grant.amount>100000||
               !grant.createdAt||typeof grant.createdAt.toMillis!=="function"){
                fail("data-loss","Server-issued grant is invalid.");
            }
            if(grant.status!=="pending"||grant.claimedByOperationId!==null){
                fail("already-exists","Grant already has a receipt.");
            }
            const revision=nextRevision(envelope);
            const timestamp=FieldValue.serverTimestamp();
            transaction.update(grantRef,{status:"reserved",claimedByOperationId:operationId,reservedAt:timestamp});
            transaction.create(receiptRef,{
                schemaVersion:GRANT_SCHEMA_VERSION,ownerUid:uid,grantId,operationId,
                kind:grant.kind,amount:grant.amount,serverRevision:revision,
                creditedToCharacter:false,createdAt:timestamp
            });
            transaction.update(saveRef,{serverRevision:revision,updatedAt:timestamp});
            return {grantId,operationId,serverRevision:revision,currentServerRevision:revision,
                unchanged:false,creditedToCharacter:false};
        });
    }

    return Object.freeze({reserve});
}

module.exports={createTrustedGrantLedger};
