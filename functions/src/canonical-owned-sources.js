"use strict";

const {inspectCanonicalSnapshot}=require("./canonical-snapshot");

// Read the complete owned sets in the same transaction as the snapshot check.
// Claims and owned items are advanced with every canonical revision.
const SOURCE_COLLECTIONS=[
    ["inventory","ownedItemId",record=>record.ownedItemId],
    ["equipment","equipmentKey",record=>`${record.characterId}_${record.slot}`],
    ["relics","relicId",record=>record.relicId]
];
const source=data=>{
    const {createdAt,updatedAt,snapshotSha256,...record}=data;
    return record;
};

// Read only the existing account's bounded references, in slot order. The
// canonical snapshot Owner remains responsible for complete account/character
// schema, revision and playable-state validation; this helper admits no slots.
async function readCharacterSources(tx,root,account,fail){
    const uid=root.id||root.path?.split("/").at(-1),slots=account?.slots;
    if(typeof uid!=="string"||!uid||account?.ownerUid!==uid||
       !Array.isArray(slots)||slots.length!==3||typeof slots[0]!=="string"||
       slots.some(id=>id!==null&&(typeof id!=="string"||!id||id.includes("/")))||
       new Set(slots.filter(id=>id!==null)).size!==slots.filter(id=>id!==null).length){
        fail("data-loss","Canonical character references are inconsistent.");
    }
    const positions=slots.flatMap((id,index)=>id===null?[]:[{id,index}]);
    const refs=positions.map(({id})=>root.collection("characters").doc(id));
    const snapshots=await Promise.all(refs.map(ref=>tx.get(ref)));
    const records=snapshots.map((snapshot,index)=>{
        const data=snapshot.data(),position=positions[index];
        if(!snapshot.exists||snapshot.id!==position.id||data?.characterId!==position.id||
           data.ownerUid!==uid||data.slotIndex!==position.index){
            fail("data-loss","Canonical character source identity is inconsistent.");
        }
        return source(data);
    });
    return {records,refs};
}

async function readOwnedSources(tx,root,fail,preloaded){
    const snapshots=await Promise.all([
        ...SOURCE_COLLECTIONS.map(([name])=>tx.get(root.collection(name))),
        tx.get(root.collection("claimRecords"))
    ]);
    const records={claimRecords:[]},refs=[];
    for(let i=0;i<SOURCE_COLLECTIONS.length;i++){
        const [name,,key]=SOURCE_COLLECTIONS[i];
        records[name]=snapshots[i].docs.map(doc=>{
            const data=doc.data();
            if(doc.id!==key(data)){
                fail("data-loss","Owned source document ID differs from its identity.");
            }
            refs.push(doc.ref);
            return source(data);
        });
    }
    records.claimRecords=snapshots[3].docs.map(doc=>{
        const data=doc.data();
        if(doc.id!==data.claimKey){
            fail("data-loss","Claim document ID differs from its key.");
        }
        refs.push(doc.ref);
        return source(data);
    }).sort((a,b)=>a.claimKey.localeCompare(b.claimKey,"en"));
    if(refs.length>400){
        fail("failed-precondition","Owned source set exceeds the transaction budget.");
    }
    if(records.inventory.length){
        // Firestore collection order is document-ID order, not bag insertion
        // order. The current canonical snapshot retains the original sequence;
        // only that same-transaction source may order the live owned records.
        const uid=root.id||root.path?.split("/").at(-1);
        if(typeof uid!=="string"||!uid){
            fail("data-loss","Owned inventory root identity is missing.");
        }
        const accountRef=root.collection("account").doc("current");
        // A caller may reuse snapshots already read in THIS callback attempt.
        // Accept DocumentSnapshots only, never a raw inventory or cached rows.
        if(preloaded!==undefined&&(!preloaded||
           preloaded.accountSnapshot?.ref?.path!==accountRef.path||
           typeof preloaded.accountSnapshot?.data!=="function"||
           typeof preloaded.currentSnapshot?.data!=="function")){
            fail("data-loss","Preloaded inventory ordering references are inconsistent.");
        }
        const accountSnap=preloaded===undefined?await tx.get(accountRef):preloaded.accountSnapshot;
        const account=accountSnap.data();
        if(!accountSnap.exists||account?.schemaVersion!==1||account.ownerUid!==uid||
           !Number.isSafeInteger(account.serverRevision)||account.serverRevision<1||
           !/^[a-f0-9]{64}$/.test(account.snapshotSha256||"")){
            fail("data-loss","Owned inventory ordering account is inconsistent.");
        }
        const snapshotRef=root.collection("playableSnapshots").doc(String(account.serverRevision));
        if(preloaded!==undefined&&preloaded.currentSnapshot?.ref?.path!==snapshotRef.path){
            fail("data-loss","Preloaded inventory snapshot reference is inconsistent.");
        }
        const snapshotSnap=preloaded===undefined?await tx.get(snapshotRef):preloaded.currentSnapshot;
        let inventory;
        try{
            if(!snapshotSnap.exists||snapshotSnap.get("sha256")!==account.snapshotSha256){
                throw Error("Current inventory snapshot is missing or mismatched.");
            }
            inventory=inspectCanonicalSnapshot(snapshotSnap.data(),uid,account.serverRevision).inventory;
            if(!Array.isArray(inventory)){throw Error("Current inventory sequence is missing.");}
        }catch(_){fail("data-loss","Owned inventory ordering snapshot is inconsistent.");}
        const byId=new Map(records.inventory.map(record=>[record.ownedItemId,record]));
        const order=inventory.map(record=>record?.ownedItemId);
        if(byId.size!==records.inventory.length||order.length!==byId.size||
           order.some(id=>typeof id!=="string"||!id||!byId.has(id))||
           new Set(order).size!==order.length){
            fail("data-loss","Owned inventory ordering set differs from current sources.");
        }
        // Preserve live quantities/fields for the caller's full snapshot check.
        // Snapshot rows supply order only and never replace damaged source data.
        records.inventory=order.map(id=>byId.get(id));
    }
    return {records,refs};
}

function advanceOwnedRecords(records,revision){
    return Object.fromEntries(["inventory","equipment","relics","claimRecords"].map(name=>
        [name,records[name].map(record=>({...record,serverRevision:revision}))]));
}

function advanceOwnedSources(tx,refs,revision,stamp){
    for(const ref of refs){
        tx.update(ref,{serverRevision:revision,updatedAt:stamp});
    }
}

module.exports={source,readCharacterSources,readOwnedSources,advanceOwnedRecords,advanceOwnedSources};
