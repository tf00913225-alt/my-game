import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';

const require=createRequire(import.meta.url);
const tests=readFileSync(new URL('./tower-preentry-attempt.test.mjs',import.meta.url),'utf8');
let factory=tests.slice(tests.indexOf('const fixture='),tests.indexOf("test('manifest-selected"));
factory=factory.replace('assert.equal(c.saveGame(),true);vm.runInContext(relicSource,c',`const week=c.GameplaySystem.getWeekInfo(Date.now());
 c.GameplaySystem.debugReloadState({tower:{weekKey:week.key,completedFloor:50,historicalHighest:50,pendingRelicChoice:true}},Date.now());
 c.player.relicProgression={initialized:true,legacyTowerChoiceHandled:false,majorMilestoneClaims:{},pending:null};
 assert.equal(c.saveGame(),true);vm.runInContext(relicSource,c`);
const load=new Function('readFileSync','require','vm','URL','importMetaUrl','assert',factory.replaceAll('import.meta.url','importMetaUrl')+'\nreturn loadIntegrated;')(readFileSync,require,vm,URL,import.meta.url,assert);
const main=readFileSync(new URL('../js/00-main.js',import.meta.url),'utf8');
function setup(){
 const c=load();
 Object.assign(c,{SAVE_KEY:'four_symbols_save:boss-tower-test',deleteAllCharactersInProgress:false,normalizeInventoryStacks(){},FourSymbolsHeroCore:{normalizeAccountState:()=>({})},heroAccountState:{},dailyQuestState:{},commissionQuestState:{},bestiaryData:{},achievementState:{},selectedCreationElement:'fire',characterEquipment:{},characterSkillLoadouts:{},autoConfig:{},autoConfig2:{},autoConfig3:{}});
 vm.runInContext(main.slice(main.indexOf('function saveGame(options={}){'),main.indexOf('function loadGame(){')),c);
 c.v132CanAddItemToInventory=()=>true;
 c.v132AddItemToInventory=(definition,count)=>{c.inventoryItems.push({id:definition.id,count});return true;};
 c.v132RunInventoryTransaction=fn=>fn();
 c.alert=message=>(c.notices||(c.notices=[])).push(message);
 c.v141ShowBlackGoldReward=value=>(c.popups||(c.popups=[])).push(value);
 assert.equal(c.saveGame(),true);
 return c;
}
for(const fault of ['none','marker','final-readback'])test('legacy choice reports final handled save '+fault,()=>{
 const c=setup(),meta='four_symbols_save_meta:boss-tower-test';
 const set=c.localStorage.setItem,get=c.localStorage.getItem;let markers=0,armed=false,failed=false;
 c.localStorage.setItem=(key,value)=>{
  if(key===meta&&String(value).includes('localWritePending')){
   markers++;
   if(fault==='marker'&&markers===3){failed=true;throw Error('fixture marker');}
  }
  const result=set(key,value);
  if(fault==='final-readback'&&key===meta&&markers===3&&!String(value).includes('localWritePending'))armed=true;
  return result;
 };
 c.localStorage.getItem=key=>{if(fault==='final-readback'&&key===meta&&armed&&!failed){failed=true;throw Error('fixture final readback');}return get(key);};
 const result=c.vGameplayChooseTowerRelic('relic_nine_dragon_fire');
 assert.equal(markers,3);assert.equal(failed,fault!=='none');
 assert.equal(result,fault==='none');assert.equal((c.popups||[]).length,fault==='none'?1:0);
 assert.equal(c.inventoryItems.length,1);assert.equal(c.inventoryItems[0].count,50);
 if(fault!=='none')assert.match(c.notices.at(-1),/保存結果未確認/);
 const saved=JSON.parse(c.localStorage.snapshot()['four_symbols_save:boss-tower-test']);
 assert.equal(saved.gameplayProgress.tower.pendingRelicChoice,false);
 assert.equal(saved.inventoryItems[0].count,50);
 assert.equal(saved.player.relicProgression.legacyTowerChoiceHandled,fault!=='marker');
 assert.equal(c.player.relicProgression.legacyTowerChoiceHandled,fault==='none');
 if(fault==='final-readback'){
  assert.throws(()=>c.FourSymbolsAccountSave.readForUid('boss-tower-test'),error=>error.code==='account-local-write-fenced');
  assert.equal(c.saveGame(),false);
 }
 assert.equal(c.vGameplayChooseTowerRelic('relic_nine_dragon_fire'),false);
 assert.equal(c.inventoryItems[0].count,50);
});
