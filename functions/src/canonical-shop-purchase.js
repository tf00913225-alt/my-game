"use strict";

const {assembleCanonicalSnapshot,verifyCanonicalSnapshotAgainstSources,
    claimRecordsDigest}=require("./canonical-snapshot");
const {createRecoveryArchive}=require("./canonical-recovery-archive");
const {source,readOwnedSources,advanceOwnedRecords,advanceOwnedSources}=
    require("./canonical-owned-sources");

const ID=/^[A-Za-z0-9_-]{16,64}$/;
// Server-owned prices for the non-retired potions in js/00-main.js. The
// browser's displayed price and inventory are never transaction inputs.
const PRICES=Object.freeze({hpPotion10:20,spPotion10:25,
    hpPotion100:180,spPotion100:220});

function createCanonicalShopPurchase({db,FieldValue,HttpsError,runProtected,
    inspectExistingEnvelope,nextRevision}){
    const fail=(code,message)=>{throw new HttpsError(code,message);};
    async function purchase(request,{operationId,expectedRevision,itemId,quantity}){
        if(!ID.test(operationId||"")||!Object.hasOwn(PRICES,itemId)||
           !Number.isSafeInteger(quantity)||quantity<1||quantity>999||
           !Number.isSafeInteger(expectedRevision)||expectedRevision<1){
            fail("invalid-argument","A catalog item, quantity, operation and revision are required.");
        }
        const cost=PRICES[itemId]*quantity;
        return runProtected(request,async(tx,session)=>{
            const uid=session.uid,root=db.collection("serverUsers").doc(uid);
            const envelopeRef=db.collection("users").doc(uid).collection("saves").doc("current");
            const accountRef=root.collection("account").doc("current");
            const economyRef=root.collection("economy").doc("current");
            const loadoutRef=root.collection("relicLoadout").doc("current");
            const progressRef=root.collection("progress").doc("current");
            const checkpointRef=root.collection("claimCheckpoints").doc("current");
            const operationRef=root.collection("operations").doc(operationId);
            const grantRef=root.collection("grantOperations").doc(operationId);
            const ledgerRef=root.collection("ledgerEntries").doc(operationId);
            const ownedItemId=`shop-${operationId}`;
            const itemRef=root.collection("inventory").doc(ownedItemId);
            const refs=[envelopeRef,accountRef,economyRef,loadoutRef,progressRef,
                checkpointRef,operationRef,grantRef,ledgerRef,itemRef];
            const [envelopeSnap,accountSnap,economySnap,loadoutSnap,progressSnap,
                checkpointSnap,operationSnap,grantSnap,ledgerSnap,itemSnap]=
                await Promise.all(refs.map(ref=>tx.get(ref)));
            if(!envelopeSnap.exists||!accountSnap.exists||!economySnap.exists||
               !loadoutSnap.exists||!progressSnap.exists||!checkpointSnap.exists){
                fail("failed-precondition","Complete canonical sources required.");
            }
            const envelope=inspectExistingEnvelope(envelopeSnap.data(),uid);
            const account=accountSnap.data(),economy=economySnap.data();
            if(envelope.kind!=="current"||envelope.data.authoritativeStateReady!==false||
               account.ownerUid!==uid||account.provenance!=="server-created"||
               economy.ownerUid!==uid||!Array.isArray(account.slots)||
               account.slots.length!==3||typeof account.slots[0]!=="string"||
               account.slots[1]!==null||account.slots[2]!==null){
                fail("failed-precondition","First-character source is not eligible.");
            }
            if(operationSnap.exists){
                const receipt=operationSnap.data(),ledger=ledgerSnap.data();
                if(grantSnap.exists||!ledgerSnap.exists||
                   receipt.kind!=="shop-purchase"||receipt.ownerUid!==uid||
                   receipt.operationId!==operationId||receipt.itemId!==itemId||
                   receipt.quantity!==quantity||receipt.cost!==cost||
                   receipt.ownedItemId!==ownedItemId||
                   !Number.isSafeInteger(receipt.purchasedRevision)||
                   receipt.purchasedRevision<2||receipt.purchasedRevision>envelope.serverRevision||
                   !/^[a-f0-9]{64}$/.test(receipt.snapshotSha256||"")||
                   ledger.kind!==receipt.kind||ledger.ownerUid!==uid||
                   ledger.operationId!==operationId||ledger.itemId!==itemId||
                   ledger.quantity!==quantity||ledger.ownedItemId!==ownedItemId||
                   ledger.amount!==-cost||
                   ledger.purchasedRevision!==receipt.purchasedRevision||
                   ledger.snapshotSha256!==receipt.snapshotSha256){
                    fail("data-loss","Shop purchase receipt is inconsistent.");
                }
                const original=await tx.get(root.collection("playableSnapshots")
                    .doc(String(receipt.purchasedRevision)));
                if(!original.exists||original.get("sha256")!==receipt.snapshotSha256||
                   !original.get("snapshot.inventory")?.some(item=>
                       item.ownedItemId===ownedItemId&&item.state?.id===itemId&&
                       item.state.count===quantity)){
                    fail("data-loss","Original purchased item snapshot is missing.");
                }
                return {purchasedRevision:receipt.purchasedRevision,ownedItemId,
                    cost,unchanged:true,authoritativeStateReady:false};
            }
            if(grantSnap.exists||ledgerSnap.exists||itemSnap.exists){
                fail("failed-precondition","Operation or item ID is already used.");
            }
            if(envelope.serverRevision!==expectedRevision){
                fail("aborted","CLOUD_REVISION_CONFLICT");
            }
            const previous=account.serverRevision;
            if(!Number.isSafeInteger(previous)||previous<2||
               previous>expectedRevision||
               !/^[a-f0-9]{64}$/.test(account.snapshotSha256||"")){
                fail("failed-precondition","Canonical source revision is invalid.");
            }
            const characterRef=root.collection("characters").doc(account.slots[0]);
            const priorRef=root.collection("playableSnapshots").doc(String(previous));
            const [characterSnap,priorSnap]=await Promise.all([
                tx.get(characterRef),tx.get(priorRef)]);
            if(!characterSnap.exists||!priorSnap.exists||
               priorSnap.get("sha256")!==account.snapshotSha256){
                fail("data-loss","Previous canonical snapshot is missing.");
            }
            const owned=await readOwnedSources(tx,root,fail);
            const records={account:source(account),characters:[source(characterSnap.data())],
                economy:source(economy),...owned.records,
                relicLoadout:source(loadoutSnap.data()),progress:source(progressSnap.data()),
                claimCheckpoint:source(checkpointSnap.data())};
            try{verifyCanonicalSnapshotAgainstSources(priorSnap.data(),uid,previous,records);}
            catch(_){fail("data-loss","Previous sources differ from snapshot.");}
            if(!Number.isSafeInteger(economy.gold)||economy.gold<cost){
                fail("failed-precondition","Insufficient canonical gold.");
            }
            if(owned.refs.length>=400){
                fail("failed-precondition","Owned source set exceeds the transaction budget.");
            }
            const revision=nextRevision(envelope);
            const item={schemaVersion:1,ownerUid:uid,serverRevision:revision,
                provenance:"server-created",ownedItemId,location:"bag",
                state:{id:itemId,type:"potion",count:quantity}};
            const nextOwned=advanceOwnedRecords(records,revision);
            nextOwned.inventory.push(item);
            const nextRecords={...records,...nextOwned,
                account:{...records.account,serverRevision:revision},
                characters:[{...records.characters[0],serverRevision:revision}],
                economy:{...records.economy,serverRevision:revision,gold:economy.gold-cost},
                relicLoadout:{...records.relicLoadout,serverRevision:revision},
                progress:{...records.progress,serverRevision:revision},
                claimCheckpoint:{...records.claimCheckpoint,serverRevision:revision,
                    claimDigest:claimRecordsDigest(nextOwned.claimRecords)}};
            let bundle;
            try{bundle=assembleCanonicalSnapshot(uid,revision,nextRecords);}
            catch(_){fail("data-loss","Purchased item cannot form a complete snapshot.");}
            const stamp=FieldValue.serverTimestamp();
            tx.update(accountRef,{serverRevision:revision,snapshotSha256:bundle.sha256,updatedAt:stamp});
            tx.update(characterRef,{serverRevision:revision,updatedAt:stamp});
            tx.update(economyRef,{serverRevision:revision,gold:economy.gold-cost,updatedAt:stamp});
            for(const ref of [loadoutRef,progressRef,checkpointRef]){
                tx.update(ref,{serverRevision:revision,updatedAt:stamp});
            }
            advanceOwnedSources(tx,owned.refs,revision,stamp);
            tx.create(itemRef,{...item,createdAt:stamp,updatedAt:stamp});
            tx.create(root.collection("playableSnapshots").doc(String(revision)),
                {...bundle,createdAt:stamp});
            tx.create(root.collection("recoveryArchives").doc(String(revision)),
                {...createRecoveryArchive(uid,revision,nextRecords,bundle),createdAt:stamp});
            const receipt={schemaVersion:1,ownerUid:uid,kind:"shop-purchase",
                operationId,itemId,quantity,cost,ownedItemId,purchasedRevision:revision,
                snapshotSha256:bundle.sha256,createdAt:stamp};
            tx.create(operationRef,receipt);
            tx.create(ledgerRef,{...receipt,amount:-cost});
            tx.update(envelopeRef,{serverRevision:revision,updatedAt:stamp});
            return {purchasedRevision:revision,ownedItemId,cost,
                unchanged:false,authoritativeStateReady:false};
        });
    }
    return Object.freeze({purchase});
}

module.exports={createCanonicalShopPurchase};
