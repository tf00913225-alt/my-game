import assert from "node:assert/strict";
import test from "node:test";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const {fixture,uid,root,env}=require("../.github/scripts/fixtures/hero-canonical-context.cjs");
const {createCanonicalShopPurchase}=require("../functions/src/canonical-shop-purchase.js");
const {assembleCanonicalSnapshot,claimRecordsDigest,verifyCanonicalSnapshotAgainstSources,snapshotDigest}=
    require("../functions/src/canonical-snapshot.js");
const {createRecoveryArchive}=require("../functions/src/canonical-recovery-archive.js");
const {source}=require("../functions/src/canonical-owned-sources.js");
const first={operationId:"shop-continuity-first-0001",expectedRevision:2,itemId:"hpPotion10",quantity:1};
function setup(claimed=true){
    const h=fixture({fragments:0,pills:0});
    // Firestore's default collection order is document ID, not Map insertion.
    // Preserve the existing staged transaction/rollback fixture and model that
    // ordering at its read boundary rather than changing production sources.
    const originalProtected=h.deps.runProtected;
    h.deps.runProtected=(request,operation)=>originalProtected(request,(tx,session)=>
        operation({...tx,get:async reference=>{
            const snapshot=await tx.get(reference);
            if(!reference.query||reference.sort)return snapshot;
            return {...snapshot,docs:snapshot.docs.slice().sort((a,b)=>a.id.localeCompare(b.id,'en'))};
        }},session));
    const records=structuredClone(h.data.get(`${root}/recoveryArchives/2`).sourceRecords);
    records.economy.gold=100;
    if(claimed){
        const row={schemaVersion:1,ownerUid:uid,serverRevision:2,provenance:"server-created",
            claimKey:"retained-once-only-claim",status:"claimed"};
        records.claimRecords=[row];records.claimCheckpoint.claimCount=1;
        records.claimCheckpoint.claimDigest=claimRecordsDigest(records.claimRecords);
        h.data.set(`${root}/claimRecords/${row.claimKey}`,row);
    }
    const bundle=assembleCanonicalSnapshot(uid,2,records);
    h.data.set(`${root}/economy/current`,records.economy);
    h.data.set(`${root}/claimCheckpoints/current`,records.claimCheckpoint);
    h.data.set(`${root}/account/current`,{...records.account,snapshotSha256:bundle.sha256});
    h.data.set(`${root}/playableSnapshots/2`,bundle);
    h.data.set(`${root}/recoveryArchives/2`,createRecoveryArchive(uid,2,records,bundle));
    return {...h,shop:createCanonicalShopPurchase(h.deps)};
}
function current(h){
    const rows={};
    for(const key of ["account","economy","progress","relicLoadout","claimCheckpoint"]){
        rows[key]=source(h.data.get(`${root}/${key==="claimCheckpoint"?"claimCheckpoints":key}/current`));
    }
    for(const key of ["characters","inventory","equipment","relics","claimRecords"]){
        rows[key]=[...h.data].filter(([path])=>path.startsWith(`${root}/${key}/`))
            .map(([,row])=>source(row));
    }
    return rows;
}
test("purchase persists the new claimed-record digest with the same snapshot/archive revision",async()=>{
    const h=setup();await h.shop.purchase(h.request(),first);
    const records=current(h);
    assert.equal(records.claimRecords[0].serverRevision,3);
    assert.equal(records.claimCheckpoint.claimDigest,claimRecordsDigest(records.claimRecords));
    assert.deepEqual(records.claimCheckpoint,h.data.get(`${root}/recoveryArchives/3`).sourceRecords.claimCheckpoint);
    verifyCanonicalSnapshotAgainstSources(h.data.get(`${root}/playableSnapshots/3`),uid,3,records);
    assert.equal(h.data.get(env).authoritativeStateReady,false);
});
test("another purchase can continue after a claimed-record purchase; original retry stays read-only",async()=>{
    const h=setup();await h.shop.purchase(h.request(),first);
    const original=structuredClone(h.data.get(`${root}/recoveryArchives/3`));
    await h.shop.purchase(h.request(),{...first,operationId:"shop-continuity-second-0001",expectedRevision:3});
    const before=structuredClone([...h.data]);
    assert.equal((await h.shop.purchase(h.request(),first)).unchanged,true);
    assert.deepEqual([...h.data],before);
    assert.equal(h.data.get(`${root}/economy/current`).gold,60);
    assert.equal(current(h).claimRecords.length,1);
    verifyCanonicalSnapshotAgainstSources(h.data.get(`${root}/playableSnapshots/4`),uid,4,current(h));
    assert.deepEqual(h.data.get(`${root}/recoveryArchives/3`),original);
});
test("empty claim inventory stays coherent without manufacturing claims",async()=>{
    const h=setup(false);await h.shop.purchase(h.request(),first);
    const records=current(h);
    assert.deepEqual(records.claimRecords,[]);assert.equal(records.claimCheckpoint.claimCount,0);
    verifyCanonicalSnapshotAgainstSources(h.data.get(`${root}/playableSnapshots/3`),uid,3,records);
});
test("interrupted purchase and corrupt checkpoint cannot commit partial or repaired sources",async()=>{
    const h=setup(),before=structuredClone([...h.data]);h.interrupt();
    await assert.rejects(h.shop.purchase(h.request(),first),/transaction interrupted/);
    assert.deepEqual([...h.data],before);
    const bad=setup();bad.data.get(`${root}/claimCheckpoints/current`).claimDigest="a".repeat(64);
    const corrupt=structuredClone([...bad.data]);
    await assert.rejects(bad.shop.purchase(bad.request(),first),error=>error.code==="data-loss");
    assert.deepEqual([...bad.data],corrupt);
});

test("reverse-ID purchases preserve original insertion order and remain readable by the next trusted mutation",async()=>{
    const h=setup(false);
    const purchases=[{...first,operationId:'zzzz-shop-inventory-order-0001'},
        {...first,operationId:'aaaa-shop-inventory-order-0002',expectedRevision:3},
        {...first,operationId:'mmmm-shop-inventory-order-0003',expectedRevision:4}];
    await h.shop.purchase(h.request(),purchases[0]);
    await h.shop.purchase(h.request(),purchases[1]);
    const original=structuredClone([...h.data].filter(([path])=>
        /\/(playableSnapshots|recoveryArchives|operations|ledgerEntries)\//.test(path)));
    const items=structuredClone(h.data.get(`${root}/recoveryArchives/4`).sourceRecords.inventory);
    assert.deepEqual(items.map(row=>row.ownedItemId),purchases.slice(0,2).map(row=>'shop-'+row.operationId));
    await h.shop.purchase(h.request(),purchases[2]);
    const retained=h.data.get(`${root}/recoveryArchives/5`).sourceRecords.inventory;
    assert.deepEqual(retained.map(row=>row.ownedItemId),purchases.map(row=>'shop-'+row.operationId));
    for(let i=0;i<items.length;i++)assert.deepEqual(retained[i],{...items[i],serverRevision:5});
    for(const [path,row] of original)assert.deepEqual(h.data.get(path),row);
    assert.equal(h.data.get(`${root}/economy/current`).gold,40);
    verifyCanonicalSnapshotAgainstSources(h.data.get(`${root}/playableSnapshots/5`),uid,5,current(h));
});

test("unknown, missing or duplicate canonical order identities and invalid pointers refuse without rewriting history",async()=>{
    for(const damage of ['unknown-id','missing-id','missing-row-id','duplicate-id','missing-order',
        'missing-pointer-hash','foreign-pointer-hash','missing-snapshot','missing-snapshot-hash']){
        const h=setup(false);
        await h.shop.purchase(h.request(),{...first,operationId:'zzzz-order-corruption-0001'});
        await h.shop.purchase(h.request(),{...first,operationId:'aaaa-order-corruption-0002',expectedRevision:3});
        const snapshotPath=`${root}/playableSnapshots/4`,accountPath=`${root}/account/current`;
        const originals=structuredClone([...h.data].filter(([path])=>path!==snapshotPath&&path!==accountPath));
        const bundle=h.data.get(snapshotPath),account=h.data.get(accountPath);
        if(['unknown-id','missing-id','missing-row-id','duplicate-id','missing-order'].includes(damage)){
            if(damage==='unknown-id')bundle.snapshot.inventory[1].ownedItemId='unknown-owned-instance-0001';
            else if(damage==='missing-id')bundle.snapshot.inventory.pop();
            else if(damage==='missing-row-id')delete bundle.snapshot.inventory[1].ownedItemId;
            else if(damage==='duplicate-id')bundle.snapshot.inventory[1].ownedItemId=bundle.snapshot.inventory[0].ownedItemId;
            else delete bundle.snapshot.inventory;
            // Valid hashes cannot turn an unresolved/ambiguous ID inventory
            // into ordering evidence. Retained archives remain immutable.
            bundle.sha256=snapshotDigest(bundle.snapshot);
            bundle.byteLength=Buffer.byteLength(JSON.stringify(bundle.snapshot),'utf8');
            account.snapshotSha256=bundle.sha256;
        }else if(damage==='missing-pointer-hash')delete account.snapshotSha256;
        else if(damage==='foreign-pointer-hash')account.snapshotSha256='0'.repeat(64);
        else if(damage==='missing-snapshot')h.data.delete(snapshotPath);
        else delete bundle.sha256;
        const corrupt=structuredClone([...h.data]);
        await assert.rejects(h.shop.purchase(h.request(),{...first,operationId:'mmmm-order-refusal-0003',expectedRevision:4}),
            error=>['data-loss','failed-precondition'].includes(error.code),damage);
        assert.deepEqual([...h.data],corrupt,damage);
        for(const [path,row] of originals)assert.deepEqual(h.data.get(path),row,`${damage}: ${path}`);
        assert.equal(h.data.get(env).serverRevision,4);assert.equal(h.data.get(env).authoritativeStateReady,false);
    }
});
