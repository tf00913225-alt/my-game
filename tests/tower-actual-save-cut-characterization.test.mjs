import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';

const require=createRequire(import.meta.url);
const tests=readFileSync(new URL('./tower-preentry-attempt.test.mjs',import.meta.url),'utf8');
const factory=tests.slice(tests.indexOf('const fixture='),tests.indexOf("test('manifest-selected"));
const loadIntegrated=new Function('readFileSync','require','vm','URL','importMetaUrl','assert',factory.replaceAll('import.meta.url','importMetaUrl')+'\nreturn loadIntegrated;')(readFileSync,require,vm,URL,import.meta.url,assert);
const main=readFileSync(new URL('../js/00-main.js',import.meta.url),'utf8');
function installOriginalSave(c){
 Object.assign(c,{SAVE_KEY:'four_symbols_save:boss-tower-test',deleteAllCharactersInProgress:false,
  normalizeInventoryStacks(){},FourSymbolsHeroCore:{normalizeAccountState:()=>({})},heroAccountState:{},
  dailyQuestState:{},commissionQuestState:{},bestiaryData:{},achievementState:{},selectedCreationElement:'fire',
  characterEquipment:{},characterSkillLoadouts:{},autoConfig:{},autoConfig2:{},autoConfig3:{},inventoryItems:c.inventoryItems||[]});
 vm.runInContext(main.slice(main.indexOf('function saveGame(options={}){'),main.indexOf('function loadGame(){')),c);
}
test('formal pending and original saveGame can be read from isolated repository',()=>{
 const c=loadIntegrated();installOriginalSave(c);
 assert.equal(c.saveGame(),true);
 assert.equal(c.vGameplaySelectTowerBand(1),true);
 const read=c.FourSymbolsAccountSave.readForUid('boss-tower-test');
 assert.equal(read.status,'ready');
 const p=read.save.player.relicProgression.pending;
 assert.equal(p.kind,'tower');assert.equal(p.phase,'launch-requested');
 assert.equal(p.ownerUid,'boss-tower-test');assert.ok(p.attemptId);assert.equal(p.floor,1);assert.ok(p.weekKey);
});
test('same-week pre-entry cancellation can retire through original saveGame and preserve live resources',async()=>{
 const c=loadIntegrated();installOriginalSave(c);assert.equal(c.saveGame(),true);
 let reject;c.v154PreparePortraitsForEncounter=()=>new Promise((resolve,fail)=>{reject=fail;});
 assert.equal(c.vGameplaySelectTowerBand(1),true);c.gold=987;c.player.hp=765;
 reject(Error('fixture preparation failed'));await new Promise(resolve=>setImmediate(resolve));
 const terminal=c.FourSymbolsAccountSave.readForUid('boss-tower-test').save.player.relicProgression.pending;
 assert.equal(terminal.phase,'cancelled-before-launch');
 assert.equal(c.vGameplaySelectTowerBand(1),true);
 const saved=c.FourSymbolsAccountSave.readForUid('boss-tower-test').save;
 assert.equal(saved.gold,987);assert.equal(saved.player.hp,765);
 assert.notEqual(saved.player.relicProgression.pending.attemptId,terminal.attemptId);
});
test('same-week Tower completion and Relic receipt reconciliation keep original save path',()=>{
 const c=loadIntegrated();installOriginalSave(c);assert.equal(c.saveGame(),true);
 c.v132AddItemToInventory=(definition,count)=>{let stack=c.inventoryItems.find(item=>item.id===definition.id);if(!stack){stack={id:definition.id,count:0};c.inventoryItems.push(stack);}stack.count+=count;return true;};
 c.v132RunInventoryTransaction=operation=>operation();
 assert.equal(c.vGameplaySelectTowerBand(1),true);
 const before=c.FourSymbolsAccountSave.readForUid('boss-tower-test').save.player.relicProgression.pending;
 assert.equal(before.phase,'launch-requested');
 c.battleActive=false;c.lastBattleCallback({result:'win'});
 assert.equal(c.RelicProgressionSystem.reconcilePending(),'delivered');
 const saved=c.FourSymbolsAccountSave.readForUid('boss-tower-test').save;
 assert.equal(saved.gameplayProgress.tower.claimedFloors['1'],true);
 assert.equal(saved.player.relicProgression.pending,null);
 for(const reward of before.rewards)assert.equal(saved.inventoryItems.find(item=>item.id===reward.itemId)?.count,reward.count);
 assert.equal(c.RelicProgressionSystem.reconcilePending(),'none');
 assert.deepEqual(JSON.parse(JSON.stringify(c.inventoryItems)),JSON.parse(JSON.stringify(saved.inventoryItems)));
});
for(const fault of ['marker','final-readback'])test('Relic reports retirement '+fault+' as save-failed without retry',()=>{
 const c=loadIntegrated();installOriginalSave(c);assert.equal(c.saveGame(),true);
 c.v132AddItemToInventory=(definition,count)=>{let stack=c.inventoryItems.find(item=>item.id===definition.id);if(!stack){stack={id:definition.id,count:0};c.inventoryItems.push(stack);}stack.count+=count;return true;};
 c.v132RunInventoryTransaction=operation=>operation();
 assert.equal(c.vGameplaySelectTowerBand(1),true);
 const receipt=c.FourSymbolsAccountSave.readForUid('boss-tower-test').save.player.relicProgression.pending;
 c.battleActive=false;c.lastBattleCallback({result:'win'});
 const set=c.localStorage.setItem,get=c.localStorage.getItem,meta='four_symbols_save_meta:boss-tower-test';
 let failed=false,armed=false,retirementMarkers=0;
 c.localStorage.setItem=(key,value)=>{
  const retirement=c.player.relicProgression?.pending===null;
  if(retirement&&key===meta&&String(value).includes('localWritePending')){
   retirementMarkers++;if(fault==='marker'&&!failed){failed=true;throw Error('retirement marker');}
  }
  const result=set(key,value);
  if(retirement&&fault==='final-readback'&&key===meta&&!String(value).includes('localWritePending'))armed=true;
  return result;
 };
 c.localStorage.getItem=key=>{if(key===meta&&armed&&!failed){failed=true;throw Error('retirement final readback');}return get(key);};
 assert.equal(c.RelicProgressionSystem.reconcilePending(),'save-failed');
 assert.equal(failed,true);assert.equal(retirementMarkers,1);
 const stored=JSON.parse(c.localStorage.snapshot()['four_symbols_save:boss-tower-test']);
 assert.equal(stored.gameplayProgress.tower.claimedFloors['1'],true);
 for(const reward of receipt.rewards)assert.equal(stored.inventoryItems.find(item=>item.id===reward.itemId)?.count,reward.count);
 assert.equal(stored.player.relicProgression.pending===null,fault==='final-readback');
 assert.notEqual(c.player.relicProgression.pending,null);
 if(fault==='final-readback'){
  assert.throws(()=>c.FourSymbolsAccountSave.readForUid('boss-tower-test'),e=>e.code==='account-local-write-fenced');
  assert.throws(()=>c.FourSymbolsAccountSave.writeForUid('boss-tower-test',stored),e=>e.code==='account-local-write-fenced');
 }
});
test('ordinary save refuses a new Tower week while formal pending remains',()=>{
 const realNow=Date.now,oldTime=Date.UTC(2026,9,27),newTime=Date.UTC(2026,10,3);
 try{
  Date.now=()=>oldTime;
  const c=loadIntegrated();installOriginalSave(c);
  assert.equal(c.saveGame(),true);assert.equal(c.vGameplaySelectTowerBand(1),true);
  const before=c.FourSymbolsAccountSave.readForUid('boss-tower-test').save;
  assert.equal(before.player.relicProgression.pending.phase,'launch-requested');
  const savedAttempt=before.player.relicProgression.pending.attemptId;
  const towerFixture=readFileSync(new URL('./gameplay-boss-tower-system.test.js',import.meta.url),'utf8');
  const needle='    vm.runInContext(source,context,{filename:"js/gameplay-boss-tower-system.js"});';
  assert.ok(towerFixture.includes(needle));
  const patched=towerFixture.slice(0,towerFixture.indexOf('let passed=0;')).replace(needle,
   '    context.player=context.FourSymbolsAccountSave.readForUid(TEST_UID).save.player; installOriginalSave(context); context.__towerWrites=[]; const originalSet=context.localStorage.setItem,originalRemove=context.localStorage.removeItem; context.localStorage.setItem=(...args)=>{context.__towerWrites.push("set");return originalSet(...args);}; context.localStorage.removeItem=(...args)=>{context.__towerWrites.push("remove");return originalRemove(...args);};\n'+needle);
  const loadFresh=new Function('require','installOriginalSave',patched+'\nreturn load;')(require,installOriginalSave);
  Date.now=()=>newTime;
  const fresh=loadFresh({storage:c.localStorage.snapshot()}).context;
  const read=fresh.FourSymbolsAccountSave.readForUid('boss-tower-test');
  assert.equal(read.status,'ready');
  assert.equal(read.save.player.relicProgression.pending.attemptId,savedAttempt);
  assert.deepEqual(JSON.parse(JSON.stringify(read.save.player.relicProgression.pending)),JSON.parse(JSON.stringify(before.player.relicProgression.pending)));
  assert.equal(read.save.gameplayProgress.tower.weekKey,before.gameplayProgress.tower.weekKey);
  assert.deepEqual(fresh.__towerWrites,[]);
  assert.deepEqual(fresh.localStorage.snapshot(),c.localStorage.snapshot());
 }finally{Date.now=realNow;}
});
