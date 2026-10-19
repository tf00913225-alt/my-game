import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {storeHarness,selection,copy} from './helpers/canonical-store-harness.mjs';
const require=createRequire(import.meta.url);
const {createCanonicalPatrolSettlement}=require('../functions/src/canonical-patrol-settlement');
const {createCanonicalExpAllocation}=require('../functions/src/canonical-exp-allocation');
const {createCanonicalShopPurchase}=require('../functions/src/canonical-shop-purchase');
const {createCanonicalResourceCredit}=require('../functions/src/canonical-resource-credit');
const {createDailyCheckinGrant,REWARD_GOLD}=require('../functions/src/daily-checkin-grant');
const {createTrustedGrantLedger}=require('../functions/src/trusted-grant-ledger');
const {inspectRecoveryArchive}=require('../functions/src/canonical-recovery-archive');
const {createCanonicalRecoveryApproval}=require('../functions/src/canonical-recovery-approval');
const {createCanonicalCurrentRecovery}=require('../functions/src/canonical-current-recovery');
let serial=0;
const id=kind=>`continuity-${kind}-${String(++serial).padStart(8,'0')}`;
const records=h=>h.data.get(h.root+'/recoveryArchives/'+h.data.get(h.root+'/account/current').serverRevision).sourceRecords;
async function battle(h,kind){
 const ticketId=id('ticket');
 await h.forest.issueTicket(h.request(),{operationId:ticketId,expectedRevision:h.revision,triggerEntryId:'forest:0',availableEntryIds:['forest:0']});
 await h.forest.settleMember(h.request(),{operationId:id('member'),expectedRevision:h.revision,ticketId,memberIndex:0});
 return h.forest.settleTerminal(h.request(),{operationId:id(kind),expectedRevision:h.revision,ticketId,kind});
}
async function twoCharacters(){
 const h=storeHarness();
 await h.initial.commitInitialSources(h.request(),{operationId:id('initial'),expectedRevision:1,selection});
 h.forest=createCanonicalPatrolSettlement({...h.dependencies,randomBytes:n=>Buffer.alloc(n,255)});
 await h.forest.observePresence(h.request(),{operationId:id('reopen'),expectedRevision:h.revision,expectedSequence:0,intent:'reopen',elementBox:'keep'});
 for(let i=0;i<20;i++)await battle(h,'win');
 const allocator=createCanonicalExpAllocation(h.dependencies);
 for(let i=0;i<9;i++)await allocator.allocateSharedExp(h.request(),{operationId:id('allocate'),expectedRevision:h.revision});
 assert.equal(records(h).characters[0].state.level,10);
 await h.initial.commitAdditionalCharacter(h.request(),{operationId:id('second'),expectedRevision:h.revision,slotIndex:1,selection:{...selection,displayName:'第二角色'}});
 return h;
}
function verify(h,states){
 const revision=h.data.get(h.root+'/account/current').serverRevision;
 const archive=h.data.get(h.root+'/recoveryArchives/'+revision),bundle=h.data.get(h.root+'/playableSnapshots/'+revision);
 inspectRecoveryArchive(archive,h.uid,revision,bundle);
 const rows=archive.sourceRecords.characters;
 assert.deepEqual(rows.map(row=>row.state),states);
 assert.deepEqual(rows.map(row=>row.characterId),archive.sourceRecords.account.slots.filter(Boolean));
 for(const row of rows){
  assert.equal(row.serverRevision,revision);
  const live=copy(h.data.get(h.root+'/characters/'+row.characterId));
  delete live.createdAt;delete live.updatedAt;delete live.snapshotSha256;
  assert.deepEqual(live,row);
 }
}
test('actual Forest-funded second character survives mode, shop, loss and win with complete revision archives',async()=>{
 const h=await twoCharacters(),states=copy(records(h).characters.map(row=>row.state));
 const historical=copy([...h.data].filter(([path])=>/\/(playableSnapshots|recoveryArchives)\//.test(path)));
 const presence=async intent=>h.forest.observePresence(h.request(),{operationId:id(intent),expectedRevision:h.revision,
  expectedSequence:h.data.get(h.root+'/modeTime/current').sequence,intent,elementBox:'keep'});
 await presence('rest');h.advance(120000);
 const resumed=await presence('resume');assert.equal(resumed.modeState.rested.battles,1);verify(h,states);
 h.advance(120000);const reopened=await presence('reopen');
 assert.equal(reopened.modeState.rested.battles,2);verify(h,states);
 const shop=createCanonicalShopPurchase(h.dependencies),gold=records(h).economy.gold;
 await shop.purchase(h.request(),{operationId:id('purchase'),expectedRevision:h.revision,itemId:'hpPotion10',quantity:1});
 assert.equal(records(h).economy.gold,gold-20);verify(h,states);
 const issued=await createDailyCheckinGrant({...h.dependencies,now:Date.now}).issue(h.request());
 const operationId=id('daily-credit'),reservedRevision=h.revision;
 const reserveRequest=h.request();Object.assign(reserveRequest.data,{grantId:issued.grantId,operationId,expectedRevision:reservedRevision});
 await createTrustedGrantLedger(h.dependencies).reserve(reserveRequest);
 const credit=createCanonicalResourceCredit(h.dependencies),input={grantId:issued.grantId,operationId,expectedRevision:h.revision};
 const beforeCredit=records(h).economy.gold;
 await credit.creditReservedGrant(h.request(),input);
 assert.equal(records(h).economy.gold,beforeCredit+REWARD_GOLD);verify(h,states);
 assert.equal(records(h).claimRecords.length,1);
 const credited=copy([...h.data]),writes=h.writes;
 assert.equal((await credit.creditReservedGrant(h.request(),input)).unchanged,true);
 assert.equal((await createTrustedGrantLedger(h.dependencies).reserve(reserveRequest)).creditedToCharacter,true);
 assert.equal(h.writes,writes);assert.deepEqual([...h.data],credited);
 const exp=records(h).economy.sharedExp;
 await battle(h,'loss');assert.equal(records(h).economy.sharedExp,exp);verify(h,states);
 await battle(h,'win');assert.ok(records(h).economy.sharedExp>exp);verify(h,states);
 for(const [path,value] of historical)assert.deepEqual(h.data.get(path),value,'prior authority is immutable');
});
test('missing actual secondary character makes mode, shop and Forest fail without writes',async()=>{
 const h=await twoCharacters(),secondary=records(h).characters[1].characterId;
 h.data.delete(h.root+'/characters/'+secondary);
 const shop=createCanonicalShopPurchase(h.dependencies);
 const operations=[
  ()=>h.forest.observePresence(h.request(),{operationId:id('rest'),expectedRevision:h.revision,expectedSequence:h.data.get(h.root+'/modeTime/current').sequence,intent:'rest',elementBox:'keep'}),
  ()=>shop.purchase(h.request(),{operationId:id('shop'),expectedRevision:h.revision,itemId:'hpPotion10',quantity:1}),
  ()=>{const request=h.request();request.data.expectedRevision=h.revision;
   return createCanonicalResourceCredit(h.dependencies).claimDailyCheckin(request);},
  ()=>h.forest.issueTicket(h.request(),{operationId:id('ticket'),expectedRevision:h.revision,triggerEntryId:'forest:0',availableEntryIds:['forest:0']})
 ];
 for(const operation of operations){const before=copy([...h.data]),writes=h.writes;
  await assert.rejects(operation,{code:'data-loss'});assert.equal(h.writes,writes);assert.deepEqual([...h.data],before);}
});
test('actual twenty-battle secondary history retains the formal bounded recovery refusal',async()=>{
 const h=await twoCharacters(),operationId=id('restore'),sourceRevision=h.revision;
 await createCanonicalRecoveryApproval(h.dependencies).issue({auth:{uid:'continuity-operator',token:{cloudSaveOperator:true}},
  data:{ownerUid:h.uid,operationId,sourceRevision,ttlSeconds:300}});
 const collections=['account','characters','economy','inventory','equipment','relics','relicLoadout','progress','claimRecords','claimCheckpoints'];
 for(const path of [...h.data.keys()])if(collections.some(name=>path.startsWith(h.root+'/'+name+'/')))h.data.delete(path);
 const before=copy([...h.data]),writes=h.writes;
 await assert.rejects(()=>createCanonicalCurrentRecovery(h.dependencies).restoreCurrent(h.request(),
  {operationId,expectedRevision:sourceRevision}),error=>error.code==='failed-precondition'&&/budget|bound/i.test(error.message));
 assert.deepEqual([...h.data],before);assert.equal(h.writes,writes);
});
