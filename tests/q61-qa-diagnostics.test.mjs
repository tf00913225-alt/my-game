import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createQ61DiagnosticTrace,captureQ61Event} from '../.github/scripts/q61-qa-diagnostics.mjs';

test('two waits have distinct labels and only the latest eight stages remain',()=>{
 const trace=createQ61DiagnosticTrace();
 for(let i=0;i<10;i++)trace.record({stage:i===8?'wait-battle-active':i===9?'wait-entry-animation':'before-entry',sceneIndex:i});
 const rows=trace.snapshot();assert.equal(rows.length,8);
 assert.equal(rows.at(-2).stage,'wait-battle-active');assert.equal(rows.at(-1).stage,'wait-entry-animation');
});
test('only allow-listed fields are read or emitted',()=>{
 const trace=createQ61DiagnosticTrace();let sensitiveReads=0;
 const input={stage:'before-entry',mode:'tower',element:'fire',floor:5,weekKey:'2026-11-02',battleActive:false,
  get uid(){sensitiveReads++;return 'private';},get rewards(){sensitiveReads++;return ['private'];},
  get save(){sensitiveReads++;return {private:true};},get pendingPhase(){sensitiveReads++;return 'private';}};
 trace.record(input);const text=JSON.stringify(trace.snapshot());
 assert.equal(sensitiveReads,0);assert.doesNotMatch(text,/private|"uid"|"rewards"|"save":\{/);
 assert.equal(trace.snapshot()[0].pendingPhase,'not-observed');
});
test('missing or malformed events never delay or replace the original error',()=>{
 const trace=createQ61DiagnosticTrace(),original=Error('original');
 try{throw original;}catch(error){trace.capture({stage:'before-entry'},()=>{throw Error('diagnostic');});assert.equal(error,original);}
 assert.equal(trace.snapshot()[0].stage,'capture-failed');
 assert.deepEqual(captureQ61Event(undefined),{status:'capture-failed'});
 assert.deepEqual(captureQ61Event([{method:'Runtime.consoleAPICalled',params:{args:[{value:'Q61_TOWER_DIAGNOSTICS'},{value:'invalid'}]}}]),{status:'capture-failed'});
 const captured=captureQ61Event([{method:'Runtime.consoleAPICalled',params:{args:[{value:'Q61_TOWER_DIAGNOSTICS'},{value:JSON.stringify([{stage:'entry-returned',entryResult:'false',uid:'secret',rewards:['secret']}])}]}}]);
 assert.equal(captured.status,'captured');assert.doesNotMatch(JSON.stringify(captured),/secret|"uid"|"rewards"/);
});
test('QA scripts retain the original entry, waits, timeout and assertions',()=>{
 const tower=readFileSync(new URL('../.github/scripts/run-tower-challenge-browser-qa.mjs',import.meta.url),'utf8');
 const battle=readFileSync(new URL('../.github/scripts/battle-layer-audio-live-qa.mjs',import.meta.url),'utf8');
 assert.ok(tower.includes("check(started===true,'Tower entry refused')"));
 assert.ok(tower.includes('await wait(()=>battleActive)'));
 assert.ok(tower.includes("await wait(()=>!document.getElementById('battlePage')?.matches('.v141-preparing-entry,.v141-entry-moving'))"));
 assert.ok(tower.includes('const wait=async(test,ms=12000)'));
 assert.ok(tower.includes('finally{Date.now=realNow;}'));
 assert.ok(battle.includes('assert.equal(started,true,"Could not start formal battle presentation QA mode: "+mode)'));
 assert.ok(battle.includes("'tower'"));
 assert.doesNotMatch(tower,/getSerializableState\s*\(/);
});
for(const target of ['wait-battle-active','wait-entry-animation'])test('actual Tower QA expression records '+target+' without replacing its timeout',async()=>{
 const script=readFileSync(new URL('../.github/scripts/run-tower-challenge-browser-qa.mjs',import.meta.url),'utf8');
 const expression=script.match(/const expression=`([\s\S]*?)`;\s*const deployedBase/)[1];
 const cut=expression.indexOf(' // Full production loadout');assert.ok(cut>0);
 const source=(expression.slice(0,cut)+' window.__probeEnter=enter;return true;}catch(error){throw error;}})()')
  .replace('${createQ61DiagnosticTrace.toString()}',createQ61DiagnosticTrace.toString());
 let tick=0;const names=['fire','earth','water','wind'],week=604800000,anchor=Date.UTC(1970,0,5);
 const c={console,Date,Promise,Math,Set,Object,Array,Number,performance:{now:()=>{tick+=20000;return tick;}},
  setTimeout:fn=>fn(),player:{},autoBattle:false,autoConfig:{},autoPatrolEnabled:false,
  battleActive:target==='wait-entry-animation',showPage(){},closeHomeFeature(){},getMainCharacterStats:()=>({maxHP:10,maxSP:10}),
  FourSymbolsStartupPolicy:{getState:()=> 'READY'},FourSymbolsFeatures:{ensure:async()=>{}},
  FourSymbolsReleaseUpdate:{checkForUpdate:async()=>{},notifySafeState(){}},
  document:{getElementById:id=>id==='battlePage'?{matches:()=>true}:null},
  GameplaySystem:{getWeekInfo:time=>{const i=Math.floor((time-anchor)/week);return {key:'2026-11-02',element:names[((i%4)+4)%4]};},debugReloadState(){},buildTowerRoster:()=>[]},
  vGameplaySelectTowerBand:()=>true};
 c.window=c;vm.createContext(c);await vm.runInContext(source,c);
 await assert.rejects(c.__probeEnter('fire',1),/Runtime wait timeout/);
 assert.equal(c.__q61TowerFailureTrace.snapshot().at(-1).stage,target);
});
for(const outcome of ['success','timeout','refused','throw'])test('Tower fixture clock covers asynchronous preparation and restores on '+outcome,async()=>{
 const script=readFileSync(new URL('../.github/scripts/run-tower-challenge-browser-qa.mjs',import.meta.url),'utf8');
 const expression=script.match(/const expression=`([\s\S]*?)`;\s*const deployedBase/)[1];
 const cut=expression.indexOf(' // Full production loadout');
 const source=(expression.slice(0,cut)+' window.__probeEnter=enter;return true;}catch(error){throw error;}})()')
  .replace('${createQ61DiagnosticTrace.toString()}',createQ61DiagnosticTrace.toString());
 const actual=Date.UTC(2026,10,6,12),names=['fire','earth','water','wind'],week=604800000,anchor=Date.UTC(1970,0,5);
 class ProbeDate extends Date{} ProbeDate.now=()=>actual;const originalNow=ProbeDate.now;
 let tick=0,observed=null;const monster=()=>({balanceOwner:'MonsterBalance',mode:'tower',level:40,context:'tower/floor/1',rank:'regular',maxHP:100,maxSP:10,attack:10,magicAttack:10,defense:10,agility:10,vTowerCriticalBonusPercent:15,skillChance:.65,balanceProjection:{finalDamagePressure:1}});
 const c={console,Date:ProbeDate,Promise,Math,Set,Object,Array,Number,performance:{now:()=>{tick+=1000;return tick;}},
  setTimeout:fn=>fn(),player:{},autoBattle:false,autoConfig:{},autoPatrolEnabled:false,battleActive:false,innerWidth:500,
  currentBattleMonsters:[0,1,2,3,4,5],monsters:Array.from({length:6},monster),showPage(){},closeHomeFeature(){},getMainCharacterStats:()=>({maxHP:10,maxSP:10}),
  FourSymbolsStartupPolicy:{getState:()=> 'READY'},FourSymbolsFeatures:{ensure:async()=>{}},FourSymbolsReleaseUpdate:{checkForUpdate:async()=>{},notifySafeState(){}},
  document:{getElementById:id=>id==='battlePage'?{matches:()=>false}:id.startsWith('battleMonster')?{getBoundingClientRect:()=>({width:10,height:10,left:0,right:10})}:null},
  GameplaySystem:{getWeekInfo:time=>{const i=Math.floor((time-anchor)/week);return {key:new Date(anchor+i*week).toISOString().slice(0,10),element:names[((i%4)+4)%4]};},debugReloadState(){},buildTowerRoster:()=>Array.from({length:12},monster)},
  MonsterBalance:{debug:m=>({final:{maxHP:m.maxHP,maxSP:m.maxSP,physicalAttack:m.attack,magicAttack:m.magicAttack,defense:m.defense,speed:m.agility}})},
  FourSymbolsBattlefieldSlots:{getActiveEnemySnapshot:()=>({monsterIndexToSlot:{0:0,1:1,2:2,3:3,4:4,5:5}}),getEnemySlotForMonster:(_,i)=>i,createEnemyFormationSnapshot:()=>({})},
  getMonsterCriticalChance:()=>25,getTowerDirectDamageMultiplier:()=>1.15,getMonsterEvasion:()=>0,getMonsterAgility:m=>m.agility,getMonsterEffectiveDefense:m=>m.defense,
  vGameplaySelectTowerBand(){if(outcome==='refused')return false;if(outcome==='throw')throw Error('entry error');if(outcome==='success')Promise.resolve().then(()=>{observed=ProbeDate.now();c.battleActive=true;});return true;}};
 c.window=c;vm.createContext(c);await vm.runInContext(source,c);
 if(outcome==='success'){
  await c.__probeEnter('fire',1);assert.notEqual(observed,actual);assert.equal(c.GameplaySystem.getWeekInfo(observed).element,'fire');
 }else await assert.rejects(c.__probeEnter('fire',1),outcome==='timeout'?/Runtime wait timeout/:outcome==='refused'?/Tower entry refused/:/entry error/);
 assert.equal(ProbeDate.now,originalNow,'Date.now must restore after '+outcome);
});
for(const mode of ['false','throw'])test('actual Battle QA tower entry preserves '+mode+' without extra observation calls',async()=>{
 const script=readFileSync(new URL('../.github/scripts/battle-layer-audio-live-qa.mjs',import.meta.url),'utf8');
 const start=script.indexOf('async function launchPresentationQaMode('),end=script.indexOf('\nasync function captureRelicPresentationQa(',start);
 assert.ok(start>=0&&end>start);const trace=createQ61DiagnosticTrace(),original=Error('original entry failure');let calls=0;
 const launch=new Function('assert','cleanupPresentationQaBattle','q61PresentationTrace','waitFor',script.slice(start,end)+'\nreturn launchPresentationQaMode;')(
  assert,async()=>{},trace,async()=>{throw Error('wait must not run');});
 const client={async eval(){calls++;if(calls===3){if(mode==='throw')throw original;return false;}return true;}};
 if(mode==='throw')await assert.rejects(launch(client,'tower','relic_sun_orb'),error=>error===original);
 else await assert.rejects(launch(client,'tower','relic_sun_orb'),/Could not start formal battle presentation QA mode: tower/);
 assert.equal(calls,3,'diagnostics must not add a CDP observation call');
 assert.equal(trace.snapshot().at(-1).entryResult,mode==='throw'?'throw':'false');
});
