"use strict";

// Read the complete owned sets in the same transaction as the snapshot check.
// Claim records require a separate claim writer that advances their digest.
const SOURCE_COLLECTIONS=[
    ["inventory","ownedItemId",record=>record.ownedItemId],
    ["equipment","equipmentKey",record=>`${record.characterId}_${record.slot}`],
    ["relics","relicId",record=>record.relicId]
];
const source=data=>{
    const {createdAt,updatedAt,snapshotSha256,...record}=data;
    return record;
};

async function readOwnedSources(tx,root,fail){
    const snapshots=await Promise.all([
        ...SOURCE_COLLECTIONS.map(([name])=>tx.get(root.collection(name))),
        tx.get(root.collection("claimRecords"))
    ]);
    if(!snapshots[3].empty){
        fail("failed-precondition","Claim records need a complete claim mutation owner.");
    }
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
    if(refs.length>400){
        fail("failed-precondition","Owned source set exceeds the transaction budget.");
    }
    return {records,refs};
}

function advanceOwnedRecords(records,revision){
    return Object.fromEntries(["inventory","equipment","relics"].map(name=>
        [name,records[name].map(record=>({...record,serverRevision:revision}))]));
}

function advanceOwnedSources(tx,refs,revision,stamp){
    for(const ref of refs){
        tx.update(ref,{serverRevision:revision,updatedAt:stamp});
    }
}

module.exports={source,readOwnedSources,advanceOwnedRecords,advanceOwnedSources};
