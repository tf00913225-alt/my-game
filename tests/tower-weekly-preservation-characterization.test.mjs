import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const fixture=readFileSync(new URL('./gameplay-boss-tower-system.test.js',import.meta.url),'utf8');
const load=new Function('require',fixture.slice(0,fixture.indexOf('let passed=0;'))+'\nreturn load;')(require);

// Characterization of the current unsafe behavior, not a preservation PASS.
test('v1 serializer and normalizer discard prior-week Tower fields',()=>{
 const originalNow=Date.now,oldTime=Date.UTC(2026,9,27),newTime=Date.UTC(2026,10,3);
 try{
  Date.now=()=>oldTime;
  const {context:c}=load();
  const oldWeek=c.GameplaySystem.getWeekInfo(oldTime);
  c.player.relicProgression={pending:{kind:'tower',phase:'launch-requested',weekKey:oldWeek.key}};
  const oldTower={weekKey:oldWeek.key,completedFloor:49,highestThisWeek:49,historicalHighest:49,claimedFloors:{'10':true,'40':true},pendingRelicChoice:true};
  c.GameplaySystem.debugReloadState({tower:oldTower},oldTime);
  assert.equal(c.GameplaySystem.getSerializableState().tower.pendingRelicChoice,true);
  Date.now=()=>newTime;
  const serialized=c.GameplaySystem.getSerializableState().tower;
  assert.equal(serialized.completedFloor,0);
  assert.equal(serialized.pendingRelicChoice,false);
  assert.equal(c.player.relicProgression.pending.phase,'launch-requested');
  assert.equal(Object.keys(serialized.claimedFloors).length,0);
  const normalized=c.GameplaySystem.normalizeState({version:1,tower:oldTower},newTime).tower;
  assert.equal(normalized.completedFloor,0);
  assert.equal(normalized.pendingRelicChoice,false);
  assert.equal(Object.keys(normalized.claimedFloors).length,0);
  assert.equal(normalized.historicalHighest,49);
 }finally{Date.now=originalNow;}
});

test('v1 normalizer preserves same-week Tower values in the isolated fixture',()=>{
 const originalNow=Date.now,now=Date.UTC(2026,9,27);
 try{
  Date.now=()=>now;
  const {context:c}=load(),week=c.GameplaySystem.getWeekInfo(now);
  const tower={weekKey:week.key,completedFloor:49,highestThisWeek:49,historicalHighest:49,claimedFloors:{'10':true},pendingRelicChoice:true};
  const same=c.GameplaySystem.normalizeState({version:1,tower},now).tower;
  assert.equal(same.completedFloor,49);assert.equal(same.claimedFloors['10'],true);assert.equal(same.pendingRelicChoice,true);
 }finally{Date.now=originalNow;}
});
