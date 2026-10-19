import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {readCharacterSources}=require('../functions/src/canonical-owned-sources');
const {assembleCanonicalSnapshot,verifyCanonicalSnapshotAgainstSources}=require('../functions/src/canonical-snapshot');
const {createRecoveryArchive,inspectRecoveryArchive}=require('../functions/src/canonical-recovery-archive');
const {fixture,uid,root,env,heroId}=require('../.github/scripts/fixtures/hero-canonical-context.cjs');
const {createTeamFormation}=require('../functions/src/team-formation');
const fail=(code,message)=>{throw Object.assign(new Error(message),{code});};

function reader(slots){
 const reads=[],data=new Map(slots.flatMap((id,index)=>id===null?[]:[[id,{characterId:id,ownerUid:uid,
  slotIndex:index,state:{id:'unchanged-'+index},createdAt:{seconds:1},updatedAt:{seconds:2}}]]));
 const account={ownerUid:uid,slots};
 const collection={id:uid,path:root,collection:name=>({doc:id=>({id,path:`${root}/${name}/${id}`})})};
 const tx={get:async ref=>{reads.push(ref.path);return {id:ref.id,exists:data.has(ref.id),data:()=>data.get(ref.id)};}};
 return {reads,data,account,run:()=>readCharacterSources(tx,collection,account,fail)};
}
test('bounded character reads preserve one/two/three slot order and unused null slots without writes',async()=>{
 for(const slots of [['z-primary',null,null],['z-primary','a-secondary',null],['z-primary','a-secondary','m-third']]){
  const h=reader(slots),before=structuredClone([...h.data]),account=structuredClone(h.account);
  const value=await h.run();
  assert.deepEqual(value.records.map(row=>row.characterId),slots.filter(id=>id!==null));
  assert.deepEqual(value.refs.map(ref=>ref.id),slots.filter(id=>id!==null));
  assert.deepEqual(h.reads,slots.filter(id=>id!==null).map(id=>`${root}/characters/${id}`));
  for(const row of value.records){assert.equal(row.createdAt,undefined);assert.equal(row.updatedAt,undefined);}
  assert.deepEqual([...h.data],before);assert.deepEqual(h.account,account);
 }
});
test('invalid bounded references refuse before reads and missing/foreign/mismatched sources cannot be admitted',async()=>{
 for(const slots of [[],[null,null,null],['a','b','c','d'],['a','a',null],['a','b/c',null],['a',undefined,null]]){
  const h=reader(['a',null,null]);h.account.slots=slots;
  await assert.rejects(h.run(),{code:'data-loss'});assert.deepEqual(h.reads,[]);
 }
 for(const damage of ['missing','foreign','character-id','slot']){
  const h=reader(['z-primary','a-secondary',null]);
  if(damage==='missing')h.data.delete('a-secondary');
  else if(damage==='foreign')h.data.get('a-secondary').ownerUid='foreign-uid';
  else if(damage==='character-id')h.data.get('a-secondary').characterId='other-id';
  else h.data.get('a-secondary').slotIndex=0;
  const before=structuredClone([...h.data]);await assert.rejects(h.run(),{code:'data-loss'});
  assert.deepEqual([...h.data],before);
 }
});
function multiFixture(count){
 const h=fixture({owned:true}),records=structuredClone(h.data.get(`${root}/recoveryArchives/2`).sourceRecords);
 const template=records.characters[0];
 for(let index=1;index<count;index++){
  const id=index===1?'zz-secondary-character':'aa-third-character',name='角色-'+index;
  records.account.slots[index]=id;
  records.characters.push({...structuredClone(template),characterId:id,slotIndex:index,displayName:name,
   state:{...structuredClone(template.state),id:name},skillLoadout:{name,skillLevels:{},equippedSkills:[]}});
 }
 const bundle=assembleCanonicalSnapshot(uid,2,records);
 h.data.set(`${root}/account/current`,{...records.account,snapshotSha256:bundle.sha256});
 // Store in reverse document insertion order: the formal reader follows slots.
 for(const row of records.characters.slice().reverse())h.data.set(`${root}/characters/${row.characterId}`,row);
 h.data.set(`${root}/playableSnapshots/2`,bundle);
 h.data.set(`${root}/recoveryArchives/2`,createRecoveryArchive(uid,2,records,bundle));
 h.formation=createTeamFormation({...h.deps,readContext:h.writer.readInTransaction});
 return h;
}
test('existing Hero growth and formation context preserve all two/three-character sources and immutable archives',async()=>{
 for(const count of [2,3]){
  const h=multiFixture(count),original=structuredClone(h.data.get(`${root}/recoveryArchives/2`));
  const c=await h.deps.runProtected(h.request(),(tx,session)=>h.writer.readInTransaction(tx,session));
  assert.deepEqual(c.records.characters.map(row=>row.characterId),c.records.account.slots.filter(Boolean));
  await h.writer.mutate(h.intent('starUp','multi-character-hero-growth',2));
  const formation={version:2,characterIndexToSlot:Object.fromEntries(Array.from({length:count},(_,index)=>
   [String(index),['ALLY_F2','ALLY_F1','ALLY_F3'][index]])),heroIdToSlot:{[heroId]:'ALLY_B2'}};
  await h.formation.save(h.request({operationId:'multi-character-formation-save',expectedRevision:3,formation}));
  const read=await h.formation.read(h.request());assert.deepEqual(read.playerIndexes,Array.from({length:count},(_,i)=>i));
  assert.deepEqual(read.formation,formation);
  const snapshot=h.data.get(`${root}/playableSnapshots/4`),archive=h.data.get(`${root}/recoveryArchives/4`);
  const records=inspectRecoveryArchive(archive,uid,4,snapshot);
  verifyCanonicalSnapshotAgainstSources(snapshot,uid,4,records);
  assert.equal(h.data.get(env).authoritativeStateReady,false);
  for(let index=0;index<count;index++){
   const before=original.sourceRecords.characters[index],after=records.characters[index];
   assert.deepEqual(after,{...before,serverRevision:4});
   assert.deepEqual(h.data.get(`${root}/characters/${after.characterId}`),{...after,updatedAt:{seconds:1}});
  }
  assert.deepEqual(h.data.get(`${root}/recoveryArchives/2`),original);
 }
});
test('existing multi-character Hero context refuses a missing character without source writes',async()=>{
 const h=multiFixture(2),id=h.data.get(`${root}/account/current`).slots[1];
 h.data.delete(`${root}/characters/${id}`);const before=structuredClone([...h.data]);
 await assert.rejects(h.writer.read(h.request()),{code:'data-loss'});assert.deepEqual([...h.data],before);
});
