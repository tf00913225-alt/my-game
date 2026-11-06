import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';

const require=createRequire(import.meta.url);
const fixture=readFileSync(new URL('./gameplay-boss-tower-system.test.js',import.meta.url),'utf8');
const load=new Function('require',fixture.slice(0,fixture.indexOf('let passed=0;'))+'\nreturn load;')(require);
const relicFixture=readFileSync(new URL('./v174-relic-progression-drop-system.test.js',import.meta.url),'utf8');
const relicSource=readFileSync(new URL('../js/relic-progression-drop-system.js',import.meta.url),'utf8');
const makeRelic=new Function('vm','source','require',relicFixture.slice(relicFixture.indexOf('function makeContext('),relicFixture.indexOf('\nfunction add('))+'\nreturn makeContext;')(vm,relicSource,require);
function loadIntegrated(){
 const {context:c}=load(),r=makeRelic({uid:'boss-tower-test',withStarters:true,noTimers:true});
 for(const name of ['v174RelicSystem','FourSymbolsEquipmentGems','v132CanAddItemToInventory','v132AddItemToInventory','v132ConsumeStackItem','v132RunInventoryTransaction'])c[name]=r.context[name];
 c.crypto=require('node:crypto').webcrypto;c.inventoryItems=[];
 c.saveGame=()=>{try{c.FourSymbolsAccountSave.writeForUid('boss-tower-test',{player:c.player,inventoryItems:c.inventoryItems,gameplayProgress:c.GameplaySystem.getSerializableState()},{source:'test'});return true;}catch(_){return false;}};
 assert.equal(c.saveGame(),true);vm.runInContext(relicSource,c,{filename:'relic-progression-drop-system.js'});
 return c;
}
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
function attempt({failPhase=false}={}){
 let phase='preparing',cancelled=0;
 return {matches:()=>phase==='preparing',launchMatches:()=>phase==='launch-requested',
  periodMatches:()=>true,blockForPeriodChange(){phase='blocked-period';},
  markLaunchRequested(){if(failPhase)return false;phase='launch-requested';return true;},
  cancelBeforeLaunch(){if(phase!=='preparing')return false;phase='cancelled';cancelled++;return true;},
  get phase(){return phase;},get cancelled(){return cancelled;}};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('Tower entry diagnostics report actual synchronous branch without exposing pending data',()=>{
 const c=loadIntegrated();
 assert.equal(c.vGameplaySelectTowerBand(1),true);
 let d=c.RelicProgressionSystem.getLastTowerEntryDiagnostic();
 assert.equal(d.reason,'entry-accepted');assert.equal(d.result,'accepted');
 assert.deepEqual(Object.keys(d).sort(),['pendingKind','pendingPhase','reason','result']);
 assert.equal(c.vGameplaySelectTowerBand(1),false);
 d=c.RelicProgressionSystem.getLastTowerEntryDiagnostic();
 assert.equal(d.reason,'pending-blocked');assert.equal(d.pendingKind,'tower');
 assert.equal(d.pendingPhase,'launch-requested');
 const before=JSON.stringify(c.FourSymbolsAccountSave.readForUid('boss-tower-test'));
 d.reason='changed';assert.equal(c.RelicProgressionSystem.getLastTowerEntryDiagnostic().reason,'pending-blocked');
 assert.equal(JSON.stringify(c.FourSymbolsAccountSave.readForUid('boss-tower-test')),before);
});
test('Tower diagnostic preserves starter falsy and original exception',()=>{
 const original=Error('private error');
 for(const throws of [false,true]){
  const {context:c}=makeRelic({withStarters:true,noTimers:true,towerStarter:()=>{if(throws)throw original;return false;}});
  if(throws)assert.throws(()=>c.vGameplaySelectTowerBand(1),error=>error===original);
  else assert.equal(c.vGameplaySelectTowerBand(1),false);
  const d=c.RelicProgressionSystem.getLastTowerEntryDiagnostic();
  assert.equal(d.reason,throws?'entry-threw':'owner-returned-falsy');
  assert.doesNotMatch(JSON.stringify(d),/private|uid|reward|attemptId/);
 }
});
test('unconfirmed begin remains fenced and reports no inferred save result',()=>{
 const {context:c}=makeRelic({withStarters:true,noTimers:true});
 c.saveGame=()=>false;
 assert.equal(c.vGameplaySelectTowerBand(1),false);
 assert.equal(c.RelicProgressionSystem.getLastTowerEntryDiagnostic().reason,'attempt-begin-unconfirmed');
 assert.equal(c.vGameplaySelectTowerBand(1),false);
 assert.equal(c.RelicProgressionSystem.getLastTowerEntryDiagnostic().reason,'attempt-unresolved');
});
function freshRepository(snapshot){
 const values=new Map(Object.entries(snapshot));
 const localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};
 const c=vm.createContext({localStorage,console});c.window=c;
 const repo=readFileSync(new URL('../js/startup/account-save-repository.js',import.meta.url),'utf8');
 vm.runInContext(repo,c);return c.FourSymbolsAccountSave;
}

test('portrait rejection cancels only before launcher invocation',async()=>{
 const {context:c}=load(),d=deferred(),a=attempt();let launches=0;
 c.v154PreparePortraitsForEncounter=()=>d.promise;c.v132LaunchDungeonBattle=()=>{launches++;return true;};
 assert.equal(c.vGameplaySelectTowerBand(1,a),true);d.reject(Error('prepare'));await flush();
 assert.equal(a.cancelled,1);assert.equal(launches,0);
});
test('sync portrait throw follows the same pre-entry cancellation',()=>{
 const {context:c}=load(),a=attempt();let launches=0;
 c.v154PreparePortraitsForEncounter=()=>{throw Error('prepare');};c.v132LaunchDungeonBattle=()=>{launches++;return true;};
 assert.equal(c.vGameplaySelectTowerBand(1,a),false);assert.equal(a.cancelled,1);assert.equal(launches,0);
});
test('UID change during portrait preparation prevents cancellation and launch',async()=>{
 const {context:c}=load(),d=deferred(),a=attempt();let launches=0;
 c.v154PreparePortraitsForEncounter=()=>d.promise;c.v132LaunchDungeonBattle=()=>{launches++;return true;};
 assert.equal(c.vGameplaySelectTowerBand(1,a),true);c.FourSymbolsAccountSave.activate('other-uid');d.resolve({state:'ready'});await flush();
 assert.equal(a.cancelled,0);assert.equal(launches,0);
});
test('stale preparation rejection cannot clear the active Tower context',async()=>{
 const {context:c}=load(),d=deferred(),a=attempt();let launches=0,valid=true;
 const stale={...a,matches:()=>valid,cancelBeforeLaunch:()=>{throw Error('stale cancellation');}};
 c.v154PreparePortraitsForEncounter=()=>d.promise;c.v132LaunchDungeonBattle=()=>{launches++;return true;};
 assert.equal(c.vGameplaySelectTowerBand(1,stale),true);valid=false;d.reject(Error('stale'));await flush();
 assert.equal(c.vGameplaySelectTowerBand(1,attempt()),false,'stale callback must not clear battleStarting');
 assert.equal(launches,0);
});
test('failed phase save never invokes launcher or cancels unknown',async()=>{
 const {context:c}=load(),d=deferred(),a=attempt({failPhase:true});let launches=0;
 c.v154PreparePortraitsForEncounter=()=>d.promise;c.v132LaunchDungeonBattle=()=>{launches++;return true;};
 assert.equal(c.vGameplaySelectTowerBand(1,a),true);d.resolve({state:'ready'});await flush();
 assert.equal(a.cancelled,0);assert.equal(launches,0);
});
test('launcher throw after phase advance is never treated as preparation failure',async()=>{
 const {context:c}=load(),d=deferred(),a=attempt();let launches=0;
 c.v154PreparePortraitsForEncounter=()=>d.promise;c.v132LaunchDungeonBattle=()=>{launches++;throw Error('partial launch');};
 assert.equal(c.vGameplaySelectTowerBand(1,a),true);d.resolve({state:'ready'});await flush();
 assert.equal(a.phase,'launch-requested');assert.equal(a.cancelled,0);assert.equal(launches,1);
});
test('actual Relic and Tower owners cancel a verified portrait failure before launch',async()=>{
 const c=loadIntegrated(),d=deferred();let launches=0;
 c.v154PreparePortraitsForEncounter=()=>d.promise;c.v132LaunchDungeonBattle=()=>{launches++;return true;};
 assert.equal(c.vGameplaySelectTowerBand(1),true);
 assert.equal(c.FourSymbolsAccountSave.readForUid('boss-tower-test').save.player.relicProgression.pending.phase,'preparing');
 d.reject(Error('prepare'));await flush();
 assert.equal(c.FourSymbolsAccountSave.readForUid('boss-tower-test').save.player.relicProgression.pending.phase,'cancelled-before-launch');
 assert.equal(launches,0);
});
test('actual claimed-floor replay starts without creating a reward receipt',()=>{
 const c=loadIntegrated(),week=c.GameplaySystem.getWeekInfo(Date.now());
 c.GameplaySystem.debugReloadState({tower:{weekKey:week.key,completedFloor:1,claimedFloors:{'1':true}}},Date.now());
 assert.equal(c.vGameplaySelectTowerBand(1),true);
 assert.equal(c.RelicProgressionSystem.getProgressionState().pending,null);
 assert.equal(c.battleActive,true);
});
test('official entry guard and settled old promise preserve the next Tower preparation',async()=>{
 const c=loadIntegrated(),first=deferred(),second=deferred();let preparations=0,launches=0;
 c.v154PreparePortraitsForEncounter=()=>++preparations===1?first.promise:second.promise;
 c.v132LaunchDungeonBattle=()=>{launches++;return true;};
 assert.equal(c.vGameplaySelectTowerBand(1),true);
 assert.equal(c.vGameplaySelectTowerBand(1),false);
 assert.equal(c.vGameplayStartBoss('personal','personal-30'),false);
 first.reject(Error('first preparation'));await flush();
 assert.equal(c.vGameplaySelectTowerBand(1),true);
 const before=JSON.stringify(c.GameplaySystem.getActiveBattleState());
 const pending=JSON.stringify(c.FourSymbolsAccountSave.readForUid('boss-tower-test').save.player.relicProgression.pending);
 first.resolve({state:'ready'});await flush();
 assert.equal(JSON.stringify(c.GameplaySystem.getActiveBattleState()),before);
 assert.equal(JSON.stringify(c.FourSymbolsAccountSave.readForUid('boss-tower-test').save.player.relicProgression.pending),pending);
 assert.equal(c.vGameplaySelectTowerBand(1),false);assert.equal(launches,0);
 second.resolve({state:'ready'});await flush();assert.equal(launches,1);
});
test('cross-week portrait preparation never launches the old roster or clears its receipt',async()=>{
 const c=loadIntegrated(),d=deferred();let now=Date.parse('2026-11-01T23:59:59.000Z'),launches=0;
 c.Date=class extends Date{static now(){return now;}};
 c.v154PreparePortraitsForEncounter=()=>d.promise;c.v132LaunchDungeonBattle=()=>{launches++;return true;};
 assert.equal(c.vGameplaySelectTowerBand(1),true);
 const before=c.FourSymbolsAccountSave.readForUid('boss-tower-test').save.player.relicProgression.pending;
 now+=2000;d.resolve({state:'ready'});await flush();
 const after=c.FourSymbolsAccountSave.readForUid('boss-tower-test').save.player.relicProgression.pending;
 assert.deepEqual(JSON.parse(JSON.stringify(after)),JSON.parse(JSON.stringify(before)));
 assert.equal(after.phase,'preparing');assert.equal(launches,0);
 assert.equal(c.vGameplaySelectTowerBand(1),false);
});
test('cross-week portrait rejection retains the original pending receipt',async()=>{
 const c=loadIntegrated(),d=deferred();let now=Date.parse('2026-11-01T23:59:59.000Z'),launches=0;
 c.Date=class extends Date{static now(){return now;}};
 c.v154PreparePortraitsForEncounter=()=>d.promise;c.v132LaunchDungeonBattle=()=>{launches++;return true;};
 assert.equal(c.vGameplaySelectTowerBand(1),true);
 const before=JSON.stringify(c.FourSymbolsAccountSave.readForUid('boss-tower-test').save.player.relicProgression.pending);
 now+=2000;d.reject(Error('prepare'));await flush();
 assert.equal(JSON.stringify(c.FourSymbolsAccountSave.readForUid('boss-tower-test').save.player.relicProgression.pending),before);
 assert.equal(launches,0);assert.equal(c.vGameplaySelectTowerBand(1),false);
});
test('week change during initial save cannot clear pending on synchronous floor rejection',()=>{
 const c=loadIntegrated();let now=Date.parse('2026-11-01T23:59:59.000Z'),calls=0,launches=0;
 c.Date=class extends Date{static now(){return now;}};
 const week=c.GameplaySystem.getWeekInfo(now);
 c.GameplaySystem.debugReloadState({tower:{weekKey:week.key,completedFloor:4,claimedFloors:{}}},now);
 const save=c.saveGame;c.saveGame=()=>{const result=save();if(++calls===1)now+=2000;return result;};
 c.v132LaunchDungeonBattle=()=>{launches++;return true;};
 assert.equal(c.vGameplaySelectTowerBand(5),false);
 const pending=c.FourSymbolsAccountSave.readForUid('boss-tower-test').save.player.relicProgression.pending;
 assert.equal(pending.floor,5);assert.equal(pending.weekKey,week.key);assert.equal(pending.phase,'preparing');
 assert.equal(launches,0);assert.equal(c.vGameplaySelectTowerBand(1),false);
});
test('week change during phase save retains launch-requested and never calls launcher',async()=>{
 const c=loadIntegrated(),d=deferred();let now=Date.parse('2026-11-01T23:59:59.000Z'),calls=0,launches=0;
 c.Date=class extends Date{static now(){return now;}};
 const save=c.saveGame;c.saveGame=()=>{const result=save();if(++calls===2)now+=2000;return result;};
 c.v154PreparePortraitsForEncounter=()=>d.promise;c.v132LaunchDungeonBattle=()=>{launches++;return true;};
 assert.equal(c.vGameplaySelectTowerBand(1),true);d.resolve({state:'ready'});await flush();
 assert.equal(c.FourSymbolsAccountSave.readForUid('boss-tower-test').save.player.relicProgression.pending.phase,'launch-requested');
 assert.equal(launches,0);assert.equal(c.vGameplaySelectTowerBand(1),false);
});
test('claimed floor replay also refuses a roster prepared in a previous week',async()=>{
 const c=loadIntegrated(),d=deferred();let now=Date.parse('2026-11-01T23:59:59.000Z'),launches=0;
 c.Date=class extends Date{static now(){return now;}};
 const week=c.GameplaySystem.getWeekInfo(now);
 c.GameplaySystem.debugReloadState({tower:{weekKey:week.key,completedFloor:1,claimedFloors:{'1':true}}},now);
 c.v154PreparePortraitsForEncounter=()=>d.promise;c.v132LaunchDungeonBattle=()=>{launches++;return true;};
 assert.equal(c.vGameplaySelectTowerBand(1),true);now+=2000;d.resolve({state:'ready'});await flush();
 assert.equal(launches,0);assert.equal(c.RelicProgressionSystem.getProgressionState().pending,null);
});
for(const boundary of ['main-write','final-readback'])test('cancellation retains terminal receipt across week boundary during '+boundary,async()=>{
 const c=loadIntegrated(),d=deferred();let now=Date.parse('2026-11-01T23:59:59.000Z'),launches=0,shifted=false,armed=false;
 c.Date=class extends Date{static now(){return now;}};
 c.v154PreparePortraitsForEncounter=()=>d.promise;c.v132LaunchDungeonBattle=()=>{launches++;return true;};
 assert.equal(c.vGameplaySelectTowerBand(1),true);
 const before=c.FourSymbolsAccountSave.readForUid('boss-tower-test').save.player.relicProgression.pending;
 const set=c.localStorage.setItem,get=c.localStorage.getItem;
 c.localStorage.setItem=(key,value)=>{
  if(boundary==='main-write'&&!shifted&&key==='four_symbols_save:boss-tower-test'&&JSON.parse(value).player.relicProgression.pending?.phase==='cancelled-before-launch'){shifted=true;now+=2000;}
  const result=set(key,value);
  if(boundary==='final-readback'&&key==='four_symbols_save_meta:boss-tower-test'&&!String(value).includes('localWritePending'))armed=true;
  return result;
 };
 c.localStorage.getItem=key=>{if(boundary==='final-readback'&&armed&&!shifted&&key==='four_symbols_save_meta:boss-tower-test'){shifted=true;now+=2000;}return get(key);};
 d.reject(Error('prepare'));await flush();
 const terminal=c.FourSymbolsAccountSave.readForUid('boss-tower-test').save.player.relicProgression.pending;
 assert.equal(shifted,true);assert.equal(terminal.phase,'cancelled-before-launch');
 assert.equal(terminal.ownerUid,before.ownerUid);assert.equal(terminal.attemptId,before.attemptId);assert.equal(terminal.weekKey,before.weekKey);
 assert.deepEqual(JSON.parse(JSON.stringify(terminal.rewards)),JSON.parse(JSON.stringify(before.rewards)));
 assert.equal(c.RelicProgressionSystem.reconcilePending(),'pre-entry-cancelled');assert.equal(launches,0);
 const fresh=freshRepository(c.localStorage.snapshot()).readForUid('boss-tower-test').save;
 assert.equal(fresh.player.relicProgression.pending.phase,'cancelled-before-launch');
 const weekForStartedAt=instant=>{const d=new Date(instant),midnight=Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate());return new Date(midnight-((d.getUTCDay()+6)%7)*86400000).toISOString().slice(0,10);};
 const reload=makeRelic({uid:'boss-tower-test',withStarters:true,noTimers:true,savedPlayer:fresh.player,weekForStartedAt});
 assert.equal(reload.context.RelicProgressionSystem.reconcilePending(),'pre-entry-cancelled');
 const save=reload.context.saveGame,phases=[];reload.context.saveGame=(...args)=>{phases.push(reload.context.player.relicProgression.pending?.phase??null);return save(...args);};
 assert.equal(reload.context.vGameplayStartBoss('personal','personal-20'),true);
 assert.equal(phases[0],null,'retirement is separately saved before a new receipt');
 assert.equal(reload.context.inventoryItems.length,0,'cancelled receipt grants no reward');
});
for(const fault of ['marker','main','final-meta','final-readback','rollback'])test('terminal save '+fault+' fault blocks entry and preserves the actual cut',async()=>{
 const c=loadIntegrated(),d=deferred();let launches=0,failed=false,armed=false;
 c.v154PreparePortraitsForEncounter=()=>d.promise;c.v132LaunchDungeonBattle=()=>{launches++;return true;};
 assert.equal(c.vGameplaySelectTowerBand(1),true);
 const before=c.FourSymbolsAccountSave.readForUid('boss-tower-test').save.player.relicProgression.pending;
 const set=c.localStorage.setItem,get=c.localStorage.getItem,main='four_symbols_save:boss-tower-test',meta='four_symbols_save_meta:boss-tower-test';
 c.localStorage.setItem=(key,value)=>{
  const marker=key===meta&&String(value).includes('localWritePending');
  const terminal=key===main&&JSON.parse(value).player.relicProgression.pending?.phase==='cancelled-before-launch';
  const final=key===meta&&!String(value).includes('localWritePending');
  if(!failed&&(fault==='marker'&&marker||fault==='main'&&terminal||fault==='final-meta'&&final)){failed=true;throw Error(fault);}
  if(fault==='rollback'&&key===main){failed=true;throw Error(fault);}
  const result=set(key,value);if(fault==='final-readback'&&final)armed=true;return result;
 };
 c.localStorage.getItem=key=>{if(fault==='final-readback'&&armed&&!failed&&key===meta){failed=true;throw Error(fault);}return get(key);};
 d.reject(Error('prepare'));await flush();assert.equal(failed,true);assert.equal(launches,0);
 c.localStorage.setItem=set;c.localStorage.getItem=get;
 const snapshot=c.localStorage.snapshot(),fresh=freshRepository(snapshot);
 if(fault==='rollback')assert.throws(()=>fresh.readForUid('boss-tower-test'),error=>error.code==='account-local-write-incomplete');
 else{
  const pending=fresh.readForUid('boss-tower-test').save.player.relicProgression.pending;
  assert.equal(pending.attemptId,before.attemptId);
  assert.equal(pending.phase,fault==='final-readback'?'cancelled-before-launch':'preparing');
  if(fault==='final-readback'){
   const saved=fresh.readForUid('boss-tower-test').save;
   const weekForStartedAt=instant=>{const d=new Date(instant),midnight=Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate());return new Date(midnight-((d.getUTCDay()+6)%7)*86400000).toISOString().slice(0,10);};
   const reload=makeRelic({uid:'boss-tower-test',withStarters:true,noTimers:true,savedPlayer:saved.player,weekForStartedAt});
   assert.equal(reload.context.RelicProgressionSystem.reconcilePending(),'pre-entry-cancelled');
   assert.equal(reload.context.RelicProgressionSystem.reconcilePending(),'pre-entry-cancelled');
   assert.equal(reload.context.inventoryItems.length,0);
  }
 }
 assert.equal(c.vGameplaySelectTowerBand(1),false);assert.deepEqual(c.localStorage.snapshot(),snapshot);
 assert.equal(c.inventoryItems.length,0);
});
test('UID change during terminal save preserves the original receipt and fences same-page retry',async()=>{
 const c=loadIntegrated(),d=deferred();let launches=0;
 c.v154PreparePortraitsForEncounter=()=>d.promise;c.v132LaunchDungeonBattle=()=>{launches++;return true;};
 assert.equal(c.vGameplaySelectTowerBand(1),true);
 const before=JSON.stringify(c.FourSymbolsAccountSave.readForUid('boss-tower-test').save.player.relicProgression.pending);
 const save=c.saveGame;c.saveGame=()=>{c.FourSymbolsAccountSave.activate('other-uid');return save();};
 d.reject(Error('prepare'));await flush();
 assert.equal(JSON.stringify(c.FourSymbolsAccountSave.readForUid('boss-tower-test').save.player.relicProgression.pending),before);
 c.FourSymbolsAccountSave.activate('boss-tower-test');assert.equal(c.vGameplaySelectTowerBand(1),false);
 assert.equal(launches,0);
});
