import assert from "node:assert/strict";
import test from "node:test";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const {fixture,uid,root,env}=require("../.github/scripts/fixtures/hero-canonical-context.cjs");
const {createCanonicalShopPurchase}=require("../functions/src/canonical-shop-purchase.js");
const {assembleCanonicalSnapshot,claimRecordsDigest,verifyCanonicalSnapshotAgainstSources}=
    require("../functions/src/canonical-snapshot.js");
const {createRecoveryArchive}=require("../functions/src/canonical-recovery-archive.js");
const {source}=require("../functions/src/canonical-owned-sources.js");
const first={operationId:"shop-continuity-first-0001",expectedRevision:2,itemId:"hpPotion10",quantity:1};
function setup(claimed=true){
    const h=fixture({fragments:0,pills:0});
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
