import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const original=readFileSync(new URL('./account-save-local-pending.test.js',import.meta.url),'utf8');
const fixture=new Function('require',original.slice(0,original.indexOf('function existing()'))+'\nreturn fixture;')(require);
function setup(){
 const f=fixture();f.repo.activate('pending-uid');
 const pending={kind:'tower',attemptVersion:1,attemptId:'0123456789abcdef0123456789abcdef',ownerUid:'pending-uid',weekKey:'2026-10-26',phase:'launch-requested'};
 const tower={weekKey:'2026-10-26',completedFloor:4,highestThisWeek:4,claimedFloors:{'1':true},pendingRelicChoice:false};
 const save={version:6,player:{id:'fixture',relicProgression:{pending}},gameplayProgress:{version:1,tower},inventoryItems:[],gold:17};
 f.repo.writeForUid('pending-uid',save);f.events.length=0;return {...f,save};
}
test('ordinary writer rejects changed or absent Tower week before any write',()=>{
 for(const tower of [null,{weekKey:'2026-11-02'}]){
  const f=setup(),before=[...f.values],candidate=structuredClone(f.save);candidate.gameplayProgress.tower=tower;
  assert.throws(()=>f.repo.writeForUid('pending-uid',candidate),e=>e.code==='account-tower-period-unresolved');
  assert.deepEqual(f.events,[]);assert.deepEqual([...f.values],before);
 }
});
test('ordinary writer checks actual serialized raw and preserves same-week candidate behavior',()=>{
 const f=setup(),before=[...f.values],candidate=structuredClone(f.save);
 candidate.toJSON=()=>({...structuredClone(f.save),gameplayProgress:{version:1,tower:{weekKey:'2026-11-02'}}});
 assert.throws(()=>f.repo.writeForUid('pending-uid',candidate),e=>e.code==='account-tower-period-unresolved');
 assert.deepEqual(f.events,[]);assert.deepEqual([...f.values],before);
 const same=structuredClone(f.save);same.player.relicProgression.pending=null;same.gold=23;
 f.repo.writeForUid('pending-uid',same);assert.equal(f.repo.readForUid('pending-uid').save.gold,23);
});
test('ordinary writer blocks foreign or incomplete Tower pending without writes',()=>{
 for(const change of [p=>delete p.ownerUid,p=>p.ownerUid='foreign',p=>p.weekKey='invalid',p=>p.weekKey='0001-01-01']){
  const f=setup(),prior=structuredClone(f.save);change(prior.player.relicProgression.pending);
  // Seed malformed historical bytes outside the writer, then observe the real writer.
  f.values.set(f.repo.saveKey('pending-uid'),JSON.stringify(prior));f.events.length=0;const before=[...f.values];
  assert.throws(()=>f.repo.writeForUid('pending-uid',f.save),e=>e.code==='account-tower-period-unresolved');
  assert.deepEqual(f.events,[]);assert.deepEqual([...f.values],before);
 }
});
test('same-week legacy Tower pending without attempt fields keeps ordinary save behavior',()=>{
 const f=setup(),legacy=structuredClone(f.save);legacy.player.relicProgression.pending={kind:'tower',weekKey:'2026-10-26',floor:1};
 f.values.set(f.repo.saveKey('pending-uid'),JSON.stringify(legacy));f.events.length=0;
 legacy.gold=44;f.repo.writeForUid('pending-uid',legacy);assert.equal(f.repo.readForUid('pending-uid').save.gold,44);
});
test('ordinary writer rejects an out-of-range period even when both keys match',()=>{
 const f=setup(),prior=structuredClone(f.save);prior.player.relicProgression.pending.weekKey='0001-01-01';prior.gameplayProgress.tower.weekKey='0001-01-01';
 f.values.set(f.repo.saveKey('pending-uid'),JSON.stringify(prior));f.events.length=0;const before=[...f.values];
 assert.throws(()=>f.repo.writeForUid('pending-uid',prior),e=>e.code==='account-tower-period-unresolved');
 assert.deepEqual(f.events,[]);assert.deepEqual([...f.values],before);
});
