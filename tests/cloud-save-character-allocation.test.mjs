import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {storeHarness,selection,copy} from './helpers/canonical-store-harness.mjs';
const require=createRequire(import.meta.url);
const {makeInitialCharacterSources}=require('../functions/src/initial-character-sources');
const {assembleCanonicalSnapshot}=require('../functions/src/canonical-snapshot');
const {createRecoveryArchive,inspectRecoveryArchive}=require('../functions/src/canonical-recovery-archive');
const {createCanonicalExpAllocation}=require('../functions/src/canonical-exp-allocation');
const {createCanonicalAttributeAllocation}=require('../functions/src/canonical-attribute-allocation');
let serial=0;
const id=()=>`allocation-target-${String(++serial).padStart(8,'0')}`;
const records=h=>h.data.get(h.root+'/recoveryArchives/'+h.data.get(h.root+'/account/current').serverRevision).sourceRecords;
// Complete trusted-source fixture for allocation, not an additional-slot grant
// path. Actual Forest→Lv10→slot2 admission is covered in additional-character.
function install(h,next){
 const revision=h.revision+1;
 for(const key of ['account','economy','relicLoadout','progress','claimCheckpoint'])next[key].serverRevision=revision;
 for(const key of ['characters','inventory','equipment','relics','claimRecords'])for(const row of next[key])row.serverRevision=revision;
 const bundle=assembleCanonicalSnapshot(h.uid,revision,next);
 const archive=createRecoveryArchive(h.uid,revision,next,bundle);
 for(const [key,collection] of Object.entries({account:'account',economy:'economy',relicLoadout:'relicLoadout',progress:'progress',claimCheckpoint:'claimCheckpoints'}))
  h.data.set(h.root+'/'+collection+'/current',{...copy(next[key]),...(key==='account'?{snapshotSha256:bundle.sha256}:{})});
 for(const row of next.characters)h.data.set(h.root+'/characters/'+row.characterId,copy(row));
 h.data.set(h.root+'/playableSnapshots/'+revision,bundle);h.data.set(h.root+'/recoveryArchives/'+revision,archive);
 h.data.get(h.save).serverRevision=revision;
}
async function fixture(count=3){
 const h=storeHarness();await h.initial.commitInitialSources(h.request(),{operationId:id(),expectedRevision:1,selection});
 const next=copy(records(h));
 for(let slot=1;slot<count;slot++){
  const generated=makeInitialCharacterSources(h.uid,3,id(),{...selection,displayName:'Target '+slot,attributes:{...selection.attributes,attack:0}},{allowUnspent:true});
  const character={...generated.characters[0],slotIndex:slot};next.characters.push(character);next.account.slots[slot]=character.characterId;
 }
 next.economy.sharedExp=100000;next.characters[0].state.attributePoints=5;install(h,next);
 h.exp=createCanonicalExpAllocation(h.dependencies);h.attribute=createCanonicalAttributeAllocation(h.dependencies);return h;
}
async function refuses(h,operation,code){
 const before=copy([...h.data]),writes=h.writes;
 await assert.rejects(operation,code?{code}:undefined);assert.deepEqual([...h.data],before);assert.equal(h.writes,writes);
}
function complete(h){
 const next=records(h),revision=next.account.serverRevision;
 inspectRecoveryArchive(h.data.get(h.root+'/recoveryArchives/'+revision),h.uid,revision,h.data.get(h.root+'/playableSnapshots/'+revision));
 for(const row of next.characters){assert.equal(row.serverRevision,revision);assert.equal(h.data.get(h.root+'/characters/'+row.characterId).serverRevision,revision);}
 return next;
}

test('stable secondary and third targets use actual pool discounts and preserve every other character state',async()=>{
 const h=await fixture(),original=copy(records(h)),history=copy([...h.data].filter(([path])=>/\/(playableSnapshots|recoveryArchives)\//.test(path)));
 for(const [slot,cost] of [[1,200],[2,150]]){
  const before=copy(records(h)),characterId=before.account.slots[slot],operationId=id();
  const result=await h.exp.allocateSharedExp(h.request(),{operationId,expectedRevision:h.revision,characterId});
  assert.equal(result.cost,cost);const after=complete(h);
  assert.equal(after.economy.sharedExp,before.economy.sharedExp-cost);assert.equal(after.characters[slot].state.level,2);
  assert.equal(after.characters[slot].state.attributePoints,before.characters[slot].state.attributePoints+5);
  assert.equal(after.characters[slot].state.skillPoints,before.characters[slot].state.skillPoints+2);
  for(let index=0;index<3;index++)if(index!==slot)assert.deepEqual(after.characters[index].state,before.characters[index].state);
  assert.equal(h.data.get(h.root+'/operations/'+operationId).characterId,characterId);
  assert.equal(h.data.get(h.root+'/ledgerEntries/'+operationId).amount,-cost);
 }
 for(const pair of history)assert.deepEqual(h.data.get(pair[0]),pair[1]);
 assert.deepEqual(records(h).characters[0].state,original.characters[0].state);
});

test('attribute targets spend only their own point and advance all character sources',async()=>{
 const h=await fixture();
 for(const slot of [1,2,0]){
  const before=copy(records(h)),operationId=id(),characterId=before.account.slots[slot];
  const input={operationId,expectedRevision:h.revision,characterId,stat:'attack'};
  const result=await h.attribute.allocateAttributePoint(h.request(),input),after=complete(h);
  assert.equal(result.statAfter,before.characters[slot].state.attack+1);
  assert.equal(result.pointsAfter,before.characters[slot].state.attributePoints-1);
  assert.deepEqual(after.economy,{...before.economy,serverRevision:after.account.serverRevision});
  for(let index=0;index<3;index++)if(index!==slot)assert.deepEqual(after.characters[index].state,before.characters[index].state);
  assert.equal(h.data.get(h.root+'/operations/'+operationId).characterId,characterId);
  const retry=await h.attribute.allocateAttributePoint(h.request(),input);assert.equal(retry.unchanged,true);
 }
});

test('default primary receipts retry unchanged after slot append and later secondary activity; alternate target cannot reuse receipt',async()=>{
 const h=await fixture(1),expInput={operationId:id(),expectedRevision:h.revision};
 const expResult=await h.exp.allocateSharedExp(h.request(),expInput);
 const attributeInput={operationId:id(),expectedRevision:h.revision,stat:'agility'};
 const attributeResult=await h.attribute.allocateAttributePoint(h.request(),attributeInput);
 const next=copy(records(h)),character={...makeInitialCharacterSources(h.uid,h.revision+1,id(),{...selection,displayName:'Later target'}).characters[0],slotIndex:1};
 next.characters.push(character);next.account.slots[1]=character.characterId;install(h,next);
 await h.exp.allocateSharedExp(h.request(),{operationId:id(),expectedRevision:h.revision,characterId:character.characterId});
 const before=copy([...h.data]);
 assert.deepEqual(await h.exp.allocateSharedExp(h.request(),expInput),{...expResult,unchanged:true});
 assert.deepEqual(await h.attribute.allocateAttributePoint(h.request(),attributeInput),{...attributeResult,unchanged:true});
 assert.deepEqual([...h.data],before);
 await refuses(h,()=>h.exp.allocateSharedExp(h.request(),{...expInput,characterId:character.characterId}),'data-loss');
 await refuses(h,()=>h.attribute.allocateAttributePoint(h.request(),{...attributeInput,characterId:character.characterId}),'data-loss');
});

test('target mutations retain rollback, stale and session protection, while malformed complete sources reject zero writes',async()=>{
 for(const kind of ['exp','attribute']){
  const h=await fixture(),characterId=records(h).account.slots[1];
  const call=(input,request=h.request())=>kind==='exp'?h.exp.allocateSharedExp(request,input):h.attribute.allocateAttributePoint(request,{...input,stat:'attack'});
  const input={operationId:id(),expectedRevision:h.revision,characterId};
  h.abortNext();await refuses(h,()=>call(input));
  await refuses(h,()=>call({...input,expectedRevision:h.revision-1}),'aborted');
  for(const target of ['foreign-character','',null,1])await refuses(h,()=>call({...input,characterId:target}),'invalid-argument');
  const old=h.request();h.setSession('b'.repeat(32));await refuses(h,()=>call(input,old),'permission-denied');
  const third=records(h).account.slots[2],path=h.root+'/characters/'+third,row=copy(h.data.get(path));
  h.data.delete(path);await refuses(h,()=>call(input),'data-loss');h.data.set(path,copy(row));
  h.data.get(path).ownerUid='foreign';await refuses(h,()=>call(input),'data-loss');h.data.set(path,copy(row));
  h.data.get(path).state.attack++;await refuses(h,()=>call(input),'data-loss');h.data.set(path,copy(row));
  await call(input);complete(h);
 }
});

test('pool rounding follows remaining EXP and primary gap rules; unavailable curve and level cap remain closed',async()=>{
 const h=await fixture(),next=copy(records(h));next.characters[1].state.exp=1;next.characters[2].state.level=40;
 // This valid source fixture exercises the pool gap without claiming an
 // available authoritative threshold for the high-level character itself.
 install(h,next);
 const secondary=await h.exp.allocateSharedExp(h.request(),{operationId:id(),expectedRevision:h.revision,characterId:next.account.slots[1]});
 assert.equal(secondary.cost,200);
 const primary=await h.exp.allocateSharedExp(h.request(),{operationId:id(),expectedRevision:h.revision});assert.equal(primary.cost,200);
 for(const level of [19,100]){
  const state=copy(records(h));state.characters[2].state.level=level;install(h,state);
  await refuses(h,()=>h.exp.allocateSharedExp(h.request(),{operationId:id(),expectedRevision:h.revision,characterId:state.account.slots[2]}),'failed-precondition');
 }
});
