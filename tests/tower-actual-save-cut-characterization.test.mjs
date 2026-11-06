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
test('formal pending persists across isolated Tower bootstrap while old progress is normalized',()=>{
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
   '    context.player=context.FourSymbolsAccountSave.readForUid(TEST_UID).save.player; installOriginalSave(context);\n'+needle);
  const loadFresh=new Function('require','installOriginalSave',patched+'\nreturn load;')(require,installOriginalSave);
  Date.now=()=>newTime;
  const fresh=loadFresh({storage:c.localStorage.snapshot()}).context;
  const read=fresh.FourSymbolsAccountSave.readForUid('boss-tower-test');
  assert.equal(read.status,'ready');
  assert.equal(read.save.player.relicProgression.pending.attemptId,savedAttempt);
  assert.notEqual(read.save.gameplayProgress.tower.weekKey,before.gameplayProgress.tower.weekKey);
 }finally{Date.now=realNow;}
});
