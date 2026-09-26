"use strict";

const {assembleCanonicalSnapshot,verifyCanonicalSnapshotAgainstSources}=
    require("./canonical-snapshot");
const ID=/^[A-Za-z0-9_-]{16,64}$/;
const source=data=>{
    const {createdAt,updatedAt,snapshotSha256,...record}=data;
    return record;
};

// Internal settlement for the first server-created character only. There is
// no callable or browser amount input. Later character/mutation owners need
// their own complete source-set transaction before publication is possible.
function createCanonicalGoldCredit({db,FieldValue,HttpsError,runProtected,
    inspectExistingEnvelope,nextRevision}){
    const fail=(code,message)=>{throw new HttpsError(code,message);};
    async function creditReservedGrant(request,{grantId,operationId,expectedRevision}){
        if(!ID.test(grantId||"")||!ID.test(operationId||"")||
           !Number.isSafeInteger(expectedRevision)||expectedRevision<1){
            fail("invalid-argument","A grant, operation and revision are required.");
        }
        return runProtected(request,async(tx,session)=>{
            const uid=session.uid,root=db.collection("serverUsers").doc(uid);
            const envelopeRef=db.collection("users").doc(uid).collection("saves").doc("current");
            const accountRef=root.collection("account").doc("current");
            const economyRef=root.collection("economy").doc("current");
            const loadoutRef=root.collection("relicLoadout").doc("current");
            const progressRef=root.collection("progress").doc("current");
            const checkpointRef=root.collection("claimCheckpoints").doc("current");
            const grantRef=root.collection("pendingGrants").doc(grantId);
            const receiptRef=root.collection("grantOperations").doc(operationId);
            const claimRef=root.collection("uniqueClaims").doc(grantId);
            const ledgerRef=root.collection("ledgerEntries").doc(operationId);
            const otherOperationRef=root.collection("operations").doc(operationId);
            const refs=[envelopeRef,accountRef,economyRef,loadoutRef,progressRef,
                checkpointRef,grantRef,receiptRef,claimRef,ledgerRef,otherOperationRef];
            const [envelopeSnap,accountSnap,economySnap,loadoutSnap,progressSnap,
                checkpointSnap,grantSnap,receiptSnap,claimSnap,ledgerSnap,otherOperationSnap]=
                await Promise.all(refs.map(ref=>tx.get(ref)));
            if(!envelopeSnap.exists||!accountSnap.exists||!economySnap.exists||
               !loadoutSnap.exists||!progressSnap.exists||!checkpointSnap.exists||
               !grantSnap.exists||!receiptSnap.exists){
                fail("failed-precondition","Complete canonical sources and reserved grant required.");
            }
            const envelope=inspectExistingEnvelope(envelopeSnap.data(),uid);
            const account=accountSnap.data(),economy=economySnap.data();
            const grant=grantSnap.data(),receipt=receiptSnap.data();
            if(envelope.kind!=="current"||envelope.data.authoritativeStateReady!==false||
               account.ownerUid!==uid||account.provenance!=="server-created"||
               economy.ownerUid!==uid||grant.ownerUid!==uid||receipt.ownerUid!==uid||
               grant.schemaVersion!==1||receipt.schemaVersion!==1||
               grant.kind!=="gold"||grant.source!=="server-event"||
               grant.claimedByOperationId!==operationId||receipt.operationId!==operationId||
               receipt.grantId!==grantId||receipt.kind!=="gold"||
               !Number.isSafeInteger(grant.amount)||grant.amount<1||grant.amount>100000||
               receipt.amount!==grant.amount||
               !Number.isSafeInteger(economy.gold)||economy.gold<0){
                fail("data-loss","Grant or canonical source identity is inconsistent.");
            }
            if(receipt.creditedToCharacter===true){
                const ledger=ledgerSnap.exists?ledgerSnap.data():null;
                const claim=claimSnap.exists?claimSnap.data():null;
                if(grant.status!=="credited"||!ledger||!claim||
                   ledger.ownerUid!==uid||ledger.grantId!==grantId||
                   ledger.operationId!==operationId||ledger.amount!==grant.amount||
                   ledger.creditRevision!==receipt.creditRevision||
                   ledger.snapshotSha256!==receipt.snapshotSha256||
                   claim.ownerUid!==uid||claim.operationId!==operationId||
                   claim.grantId!==grantId||claim.creditRevision!==receipt.creditRevision||
                   !Number.isSafeInteger(receipt.creditRevision)||
                   receipt.creditRevision>envelope.serverRevision){
                    fail("data-loss","Credited grant receipt is inconsistent.");
                }
                return {creditRevision:receipt.creditRevision,unchanged:true,
                    authoritativeStateReady:false};
            }
            if(grant.status!=="reserved"||receipt.creditedToCharacter!==false||
               claimSnap.exists||ledgerSnap.exists||otherOperationSnap.exists){
                fail("failed-precondition","Grant is not available for first credit.");
            }
            if(envelope.serverRevision!==expectedRevision){
                fail("aborted","CLOUD_REVISION_CONFLICT");
            }
            const previous=account.serverRevision;
            if(!Number.isSafeInteger(previous)||previous<1||previous>expectedRevision||
               !Array.isArray(account.slots)||account.slots.length!==3||
               typeof account.slots[0]!=="string"||
               account.slots[1]!==null||account.slots[2]!==null||
               checkpointSnap.get("claimCount")!==0||
               !/^[a-f0-9]{64}$/.test(account.snapshotSha256||"")){
                fail("failed-precondition","First-character source is not eligible.");
            }
            const characterRef=root.collection("characters").doc(account.slots[0]);
            const previousSnapshotRef=root.collection("playableSnapshots").doc(String(previous));
            const [characterSnap,previousSnapshotSnap]=await Promise.all([
                tx.get(characterRef),tx.get(previousSnapshotRef)]);
            if(!characterSnap.exists||!previousSnapshotSnap.exists||
               previousSnapshotSnap.get("sha256")!==account.snapshotSha256){
                fail("data-loss","Previous canonical source snapshot is missing.");
            }
            // The initial source has empty inventory/equipment/relic/claim sets.
            // Any later state needs a different complete mutation owner.
            const records={account:source(account),characters:[source(characterSnap.data())],
                economy:source(economy),inventory:[],equipment:[],relics:[],
                relicLoadout:source(loadoutSnap.data()),progress:source(progressSnap.data()),
                claimCheckpoint:source(checkpointSnap.data()),claimRecords:[]};
            try{verifyCanonicalSnapshotAgainstSources(previousSnapshotSnap.data(),
                uid,previous,records);}catch(_){
                fail("data-loss","Previous canonical sources differ from snapshot.");
            }
            if(economy.gold>Number.MAX_SAFE_INTEGER-grant.amount){
                fail("failed-precondition","Gold balance exceeds safe range.");
            }
            const revision=nextRevision(envelope);
            const nextRecords={...records,
                account:{...records.account,serverRevision:revision},
                characters:records.characters.map(c=>({...c,serverRevision:revision})),
                economy:{...records.economy,serverRevision:revision,
                    gold:economy.gold+grant.amount},
                relicLoadout:{...records.relicLoadout,serverRevision:revision},
                progress:{...records.progress,serverRevision:revision},
                claimCheckpoint:{...records.claimCheckpoint,serverRevision:revision}};
            const bundle=assembleCanonicalSnapshot(uid,revision,nextRecords);
            const stamp=FieldValue.serverTimestamp();
            tx.update(accountRef,{serverRevision:revision,snapshotSha256:bundle.sha256,updatedAt:stamp});
            tx.update(characterRef,{serverRevision:revision,updatedAt:stamp});
            tx.update(economyRef,{serverRevision:revision,gold:nextRecords.economy.gold,
                updatedAt:stamp});
            for(const ref of [loadoutRef,progressRef,checkpointRef]){
                tx.update(ref,{serverRevision:revision,updatedAt:stamp});
            }
            tx.create(root.collection("playableSnapshots").doc(String(revision)),
                {...bundle,createdAt:stamp});
            tx.create(claimRef,{schemaVersion:1,ownerUid:uid,grantId,operationId,
                creditRevision:revision,createdAt:stamp});
            tx.create(ledgerRef,{schemaVersion:1,ownerUid:uid,grantId,operationId,
                kind:"gold",amount:grant.amount,balanceAfter:nextRecords.economy.gold,
                creditRevision:revision,snapshotSha256:bundle.sha256,createdAt:stamp});
            tx.update(receiptRef,{creditedToCharacter:true,creditRevision:revision,
                snapshotSha256:bundle.sha256,creditedAt:stamp});
            tx.update(grantRef,{status:"credited",creditedAt:stamp});
            tx.update(envelopeRef,{serverRevision:revision,updatedAt:stamp});
            return {creditRevision:revision,unchanged:false,
                authoritativeStateReady:false};
        });
    }
    return Object.freeze({creditReservedGrant});
}

module.exports={createCanonicalGoldCredit};
