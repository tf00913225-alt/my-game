import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {fixture,uid,root,env}=require('../.github/scripts/fixtures/hero-canonical-context.cjs');
const {createCanonicalExpAllocation}=require('../functions/src/canonical-exp-allocation');
const {createCanonicalShopPurchase}=require('../functions/src/canonical-shop-purchase');
const {assembleCanonicalSnapshot,snapshotDigest}=require('../functions/src/canonical-snapshot');
const {createRecoveryArchive}=require('../functions/src/canonical-recovery-archive');
const {readOwnedSources}=require('../functions/src/canonical-owned-sources');

async function setup(){
 const h=fixture({fragments:0,pills:2}),records=structuredClone(h.data.get(root+'/recoveryArchives/2').sourceRecords);
 records.economy.gold=100;records.economy.sharedExp=10000;
 const bundle=assembleCanonicalSnapshot(uid,2,records);
 h.data.set(root+'/economy/current',records.economy);
 h.data.set(root+'/account/current',{...records.account,snapshotSha256:bundle.sha256});
 h.data.set(root+'/playableSnapshots/2',bundle);
 h.data.set(root+'/recoveryArchives/2',createRecoveryArchive(uid,2,records,bundle));
 const original=h.deps.runProtected;
 h.deps.runProtected=(request,operation)=>original(request,(tx,session)=>operation({...tx,get:async ref=>{
  const snap=await tx.get(ref);
  return ref.query&&!ref.sort?{...snap,docs:snap.docs.slice().sort((a,b)=>a.id.localeCompare(b.id,'en'))}:snap;
 }},session));
 const shop=createCanonicalShopPurchase(h.deps);
 for(const [operationId,expectedRevision] of [['zzzz-reuse-purchase-0001',2],['aaaa-reuse-purchase-0002',3]])
  await shop.purchase(h.request(),{operationId,expectedRevision,itemId:'hpPotion10',quantity:1});
 return h;
}
async function refuses(h,operation){
 const before=structuredClone([...h.data]);
 await assert.rejects(operation,error=>['data-loss','failed-precondition'].includes(error.code));
 assert.deepEqual([...h.data],before);
}
test('nonempty-bag allocator reuses account and current snapshot from this transaction attempt without a second point read',async()=>{
 const h=await setup(),before=structuredClone(h.data.get(root+'/recoveryArchives/4').sourceRecords);
 const historical=structuredClone([...h.data].filter(([path])=>/\/(playableSnapshots|recoveryArchives|operations|ledgerEntries)\//.test(path)));
 const original=h.deps.runProtected,reads=new Map();
 const owner=createCanonicalExpAllocation({...h.deps,runProtected:(request,operation)=>original(request,(tx,session)=>
  operation({...tx,get:async ref=>{
   if(!ref.query){
    reads.set(ref.path,(reads.get(ref.path)||0)+1);
    if([root+'/account/current',root+'/playableSnapshots/4'].includes(ref.path))
     assert.equal(reads.get(ref.path),1,'allocator must reuse the same-attempt ordering proof');
   }
   return tx.get(ref);
  }},session))});
 const result=await owner.allocateSharedExp(h.request(),{operationId:'exp-point-read-reuse-0001',expectedRevision:4});
 assert.equal(result.levelAfter,2);assert.equal(result.cost,300);
 for(const path of [root+'/account/current',root+'/playableSnapshots/4'])assert.equal(reads.get(path),1);
 const after=h.data.get(root+'/recoveryArchives/5').sourceRecords;
 assert.deepEqual(after.inventory,before.inventory.map(row=>({...row,serverRevision:5})));
 for(const [path,value] of historical)assert.deepEqual(h.data.get(path),value);
});

test('same-attempt reuse still rejects missing pointers, invalid canonical order and damaged live inventory with zero writes',async()=>{
 for(const damage of ['missing-hash','wrong-hash','missing-snapshot','unknown-order','duplicate-order','missing-order','damaged-source']){
  const h=await setup(),account=h.data.get(root+'/account/current'),bundle=h.data.get(root+'/playableSnapshots/4');
  if(damage==='missing-hash')delete account.snapshotSha256;
  else if(damage==='wrong-hash')account.snapshotSha256='0'.repeat(64);
  else if(damage==='missing-snapshot')h.data.delete(root+'/playableSnapshots/4');
  else if(damage==='damaged-source')h.data.get(root+'/inventory/shop-zzzz-reuse-purchase-0001').state.count++;
  else{
   if(damage==='unknown-order')bundle.snapshot.inventory[1].ownedItemId='unknown-order-instance';
   if(damage==='duplicate-order')bundle.snapshot.inventory[1].ownedItemId=bundle.snapshot.inventory[0].ownedItemId;
   if(damage==='missing-order')bundle.snapshot.inventory.pop();
   bundle.sha256=snapshotDigest(bundle.snapshot);bundle.byteLength=Buffer.byteLength(JSON.stringify(bundle.snapshot),'utf8');account.snapshotSha256=bundle.sha256;
  }
  const owner=createCanonicalExpAllocation(h.deps);
  await refuses(h,()=>owner.allocateSharedExp(h.request(),{operationId:'exp-reuse-refusal-0001',expectedRevision:4}));
 }
});

test('ordering preload rejects foreign or wrong-revision DocumentSnapshot references and raw records',async()=>{
 for(const damage of ['foreign-account','wrong-snapshot','foreign-snapshot','raw-account','raw-snapshot','partial']){
  const h=await setup();
  await refuses(h,()=>h.deps.runProtected(h.request(),async(tx)=>{
   const accountSnapshot=await tx.get(h.deps.db.collection('serverUsers').doc(uid).collection('account').doc('current'));
   const currentSnapshot=await tx.get(h.deps.db.collection('serverUsers').doc(uid).collection('playableSnapshots').doc('4'));
   const preloaded={accountSnapshot,currentSnapshot};
   if(damage==='foreign-account')preloaded.accountSnapshot={...accountSnapshot,ref:{path:'serverUsers/foreign/account/current'}};
   if(damage==='wrong-snapshot')preloaded.currentSnapshot={...currentSnapshot,ref:{path:root+'/playableSnapshots/3'}};
   if(damage==='foreign-snapshot')preloaded.currentSnapshot={...currentSnapshot,ref:{path:'serverUsers/foreign/playableSnapshots/4'}};
   if(damage==='raw-account')preloaded.accountSnapshot=accountSnapshot.data();
   if(damage==='raw-snapshot')preloaded.currentSnapshot=currentSnapshot.data();
   if(damage==='partial')delete preloaded.currentSnapshot;
   await readOwnedSources(tx,h.deps.db.collection('serverUsers').doc(uid),(code,message)=>{throw new h.deps.HttpsError(code,message);},preloaded);
  }));
 }
});
