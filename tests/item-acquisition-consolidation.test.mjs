import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {buildItemAcquisitionProjection} from '../scripts/lib/item-acquisition-projection.mjs';
const read=file=>fs.readFileSync(file,'utf8');
const main=read('js/00-main.js');
function declaration(name){const match=main.match(new RegExp('^function '+name+'\\([\\s\\S]*?^\\}','m'));assert.ok(match,name);return match[0];}
function registry(){const ctx={window:{FourSymbolsItemAcquisitionData:buildItemAcquisitionProjection(process.cwd())}};vm.runInNewContext(read('js/item-acquisition-registry.js'),ctx);return ctx.window.FourSymbolsItemAcquisition;}
test('material chest allowed pool and projection have a sole canonical owner',()=>{
 const data=buildItemAcquisitionProjection(process.cwd());
 const allowed=['oreLow','oreMid','oreHigh','orePerfect','hpPotion10','spPotion10','hpPotion30','spPotion30','hpPotion50','spPotion50','revivalPill'];
 assert.deepEqual(Array.from(data.materialChest,row=>row.itemId).sort(),allowed.sort());
 assert.equal(data.materialChest.reduce((n,row)=>n+row.weight,0),100);
 const source=read('js/27-v132-content-expansion.js');
 assert.match(source,/blueprints:\[\]/);
 assert.match(source,/compatibilityOnly:true/);
 assert.doesNotMatch(source,/getBlueprintDefinitionsByTier\(blueprintTier\)/);
 assert.doesNotMatch(read('js/38-v143-system-fixes.js'),/ConsumeStackItem\(blueprint/);
});
test('50 percent is usable; retired 100 percent saves remain readable',()=>{
 const array=main.match(/const potionDefinitions=([\s\S]*?\n\]);/)[1];
 const ctx={};vm.runInNewContext('var potionDefinitions='+array+';'+['getPotionDefinition','getPotionRecoveryContract','resolvePotionRecovery'].map(declaration).join('\n'),ctx);
 for(const id of ['hpPotion50','spPotion50'])assert.equal(ctx.resolvePotionRecovery(ctx.getPotionDefinition(id),10,200),100);
 for(const id of ['hpPotion100','spPotion100'])assert.equal(ctx.resolvePotionRecovery(ctx.getPotionDefinition(id),10,200),190);
 assert.doesNotMatch(main.match(/const RETIRED_BACKPACK_POTION_IDS=[\s\S]*?\);/)[0],/Potion50/);
 assert.doesNotMatch(read('js/adventure/adventure-content-v1-20260915.js'),/id:"(?:hp|sp)Potion100"/);
});
test('rare full restoration uses the shared recovery formula',()=>{
 const ctx={window:{},potionDefinitions:[],inventoryItems:[],getAutoPotionId:()=>null};vm.runInNewContext(['getPotionRecoveryContract','resolvePotionRecovery'].map(declaration).join('\n'),ctx);
 vm.runInNewContext(read('js/adventure/adventure-items-v1-20260915.js'),ctx);
 for(const def of Object.values(ctx.window.FourSymbolsAdventureItems.definitions))assert.equal(ctx.resolvePotionRecovery(def,35,300),265);
});
test('every source query is read-only, shows exact milestones and recursively traces chests',()=>{
 const owner=registry();
 for(const [id,floor] of [['relicChoiceBoxBlue',25],['relicChoiceBoxPurple',50],['relicChoiceBoxOrange',75],['relicChoiceBoxPink',100]]){
  const source=owner.getSources(id)[0];assert.equal(source.floor,floor);assert.match(owner.formatSource(source),new RegExp('首次第'+floor+'層'));assert.equal(source.quantity,1);
 }
 const tree=owner.trace('revivalPill');assert.equal(tree[0].source.chestId,'materialChest');assert.equal(tree[0].parents[0].source.sourceId,'material');
 assert.ok(owner.getSources('oreLow').length>1);
 for(const id of ['heroMarrowPill','heroFragment_divineDogHongbao','unknown-future-gem'])assert.equal(owner.getSources(id).length,0);
 assert.equal(owner.empty,'目前版本尚無正式取得途徑');
 assert.match(read('index.html'),/id="itemAcquisitionButton"/);
 assert.doesNotMatch(read('js/item-acquisition-registry.js'),/addItemToInventory|consumePotion|saveGame\(|grant\(/);
});
test('revival pill and skill share reactivation; success consumes exactly once and preserves SP',()=>{
 const source=read('js/42-v148-combat-dungeon-fixes.js');
 const shared=source.match(/    function reactivateRevivedPartyUnit[\s\S]*?\n    \}/)[0];
 const pill=source.match(/    window\.v148ResolveRevivalPill=function[\s\S]*?\n    \};/)[0];
 const resolver=source.match(/    function resolvePartyRevive[\s\S]*?\n    \}/)[0];
 const party=[{hp:100,sp:45},{hp:0,sp:17}],impacts=[],ctx={window:{v143RunAtTargetHit:(side,index,callback)=>impacts.push(callback)},party,battleActive:true,battleToken:1,numeric:v=>Number(v)||0,getPartyCharacterByIndex:i=>party[i],getPartyCharacterKey:()=>"fire",getPartyBattleStats:()=>({maxHP:300}),getSkillLevel:()=>0,levelValue:()=>20,skillDatabase:{revive:{id:'revive',element:'water',targetType:'deadAlly'}},animateSupportCast:()=>{},getPotionCount:()=>ctx.count,consumePotionFromInventory:()=>{ctx.count--;return true;},finishSupport:()=>{ctx.finishes++;},saveGame:()=>true,count:2,finishes:0};
 vm.runInNewContext(shared+'\n'+resolver+'\n'+pill,ctx);
 const def={id:'revivalPill',fixedReviveHP:35};
 ctx.window.v148ResolveRevivalPill(0,1,def);assert.equal(party[1].hp,0);assert.equal(ctx.count,2);const impact=impacts.shift();impact();impact();assert.equal(party[1].hp,35);assert.equal(party[1].sp,17);assert.equal(ctx.count,1);assert.equal(ctx.finishes,1);
 ctx.window.v148ResolveRevivalPill(0,1,def);assert.equal(ctx.count,1);
 party[1].hp=0;ctx.battleActive=false;ctx.window.v148ResolveRevivalPill(0,1,def);assert.equal(ctx.count,1);assert.equal(party[1].hp,0);
 party[1].hp=0;ctx.battleActive=true;ctx.saveGame=()=>false;ctx.addPotionToInventory=()=>{ctx.count++;return true;};
 ctx.window.v148ResolveRevivalPill(0,1,def);impacts.shift()();assert.equal(ctx.count,1);assert.equal(party[1].hp,0);assert.equal(party[1].sp,17);
 ctx.saveGame=()=>true;ctx.window.v148ResolveRevivalPill(0,1,def);ctx.battleToken++;impacts.shift()();assert.equal(ctx.count,1);assert.equal(party[1].hp,0);
 ctx.window.v148ResolveRevivalPill(0,1,def);party[1]={hp:0,sp:33};impacts.shift()();assert.equal(ctx.count,1);assert.equal(party[1].hp,0);
 assert.match(source,/reactivateRevivedPartyUnit\(targetIndex,target,restoredHP\)/);
 assert.match(main,/resource:"revive",manualOnly:true/);
 assert.match(declaration('usePotion'),/autoOn/);assert.match(declaration('usePotion'),/setBattleAllyTargetSelectionMode\(potionId\)/);
});
test('relic source compatibility API delegates to acquisition registry',()=>{
 const body=read('js/relic-progression-drop-system.js').match(/    function relicSources[\s\S]*?\n    \}/)[0];
 assert.match(body,/FourSymbolsItemAcquisition/);assert.doesNotMatch(body,/RELIC_BOSS_DROP_TABLE|majorMilestones/);
 const owner=registry(),sources=owner.getSources('relicFragment_xuanwu_seal');assert.ok(sources.some(s=>s.bossName==='雪獄尊'));assert.ok(sources.some(s=>s.chestId==='relicChoiceBoxBlue'));
});

test('elite roll, Boss stages, synthesis and indirect source numbers agree with reward owners',()=>{
 const data=buildItemAcquisitionProjection(process.cwd()),owner=registry();
 assert.equal(Number(data.eliteDrops.reduce((n,row)=>n+row.chance,0).toFixed(2)),.19);
 assert.equal(owner.getSources('ticketSetFire').filter(row=>row.sourceType==='abyss').length,4);
 assert.equal(owner.getSources('ticketSetUnknown').length,0);
 const stages=owner.getSources(data.materials.essenceItemId).filter(row=>row.bossId==='world-40');
 assert.deepEqual(Array.from(stages,row=>row.stage),[1,2,3,4]);
 assert.deepEqual(Array.from(stages[0].quantityRange),Array.from(data.difficulties.hard.essence));
 assert.ok(owner.getSources('oreLow').some(row=>row.bossId==='personal-20'&&row.quantity===1&&row.repeatable));
 assert.equal(owner.trace('freezeTalismanPerfect')[0].parents[0].source.mode,'符咒合成');
 const gear={id:'gear-qa',name:'普通裝備',type:'armor',rarityKey:'orange',v17346GeneratedEquipment:true};
 assert.equal(owner.getSources(gear).length,2);assert.equal(owner.trace(gear)[0].parents[0].source.sourceId,'equipment');
});

test('revival manual declaration targets exact zero HP through the canonical ally validator',()=>{
 const party=[{hp:50,sp:12},{hp:0,sp:17},{hp:-1,sp:20}],def={id:'revivalPill',name:'還魂丹',resource:'revive',targetType:'deadAlly',manualOnly:true};
 const ctx={battleActive:true,battlePhase:'declare',activeBattleCharacterIndex:0,autoBattle:false,actionReady:false,pendingAction:null,getPotionDefinition:()=>def,getPartyCharacterByIndex:i=>party[i],getBattleCharacterByIndex:i=>party[i],getExistingPartyIndexes:()=>[0,1,2],getPotionCount:()=>2,addBattleLog:()=>{},closeMenus:()=>{},getPartyAutoConfig:()=>({enabled:false}),setBattleAllyTargetSelectionMode:()=>{ctx.selected=true;}};
 vm.runInNewContext(declaration('isValidAllyTargetForSkill')+'\n'+declaration('usePotion'),ctx);
 assert.equal(ctx.isValidAllyTargetForSkill(def,party[0],0),false);assert.equal(ctx.isValidAllyTargetForSkill(def,party[1],1),true);assert.equal(ctx.isValidAllyTargetForSkill(def,party[2],2),false);
 ctx.autoBattle=true;ctx.usePotion('revivalPill');assert.equal(ctx.selected,undefined);
 ctx.autoBattle=false;party[1].hp=10;ctx.usePotion('revivalPill');assert.equal(ctx.selected,undefined);assert.equal(ctx.actionReady,false);
 party[1].hp=0;ctx.usePotion('revivalPill');assert.equal(ctx.selected,true);assert.equal(ctx.pendingAction,'revivalPill');assert.equal(ctx.actionReady,true);
 assert.doesNotMatch(read('js/42-v148-combat-dungeon-fixes.js'),/isValidAllyTargetForSkill=function/);
});

test('final potion Owner preserves revival target and canonical declaration selection',()=>{
 const source=read('js/38-v143-system-fixes.js'),party=[{hp:50,sp:12},{hp:0,sp:17},{hp:-1,sp:20}],def={id:'revivalPill',name:'還魂丹',resource:'revive',targetType:'deadAlly',manualOnly:true};
 const ctx={usePotion:()=>{},battleActive:true,battlePhase:'declare',activeBattleCharacterIndex:0,autoBattle:false,actionReady:false,pendingAction:null,POTION_TARGET_ACTION:'potion-target',window:{},getPotionDefinition:()=>def,getPartyCharacterByIndex:i=>party[i],getExistingPartyIndexes:()=>[0,1,2],getPartyBattleStats:()=>({maxHP:100,maxSP:50}),getPotionCount:()=>2,queuedPotionReservations:()=>0,addBattleLog:()=>{},closeMenus:()=>{},setBattleAllyTargetSelectionMode:()=>{ctx.selected=true;}};
 vm.runInNewContext(declaration('isValidAllyTargetForSkill')+'\n'+source.match(/    function validPotionTarget[\s\S]*?\n    \}/)[0]+'\n'+source.slice(source.indexOf('    if(typeof usePotion==='),source.indexOf('    if(typeof selectBattleAllyTarget===')),ctx);
 assert.equal(ctx.validPotionTarget('revivalPill',0),false);assert.equal(ctx.validPotionTarget('revivalPill',1),true);assert.equal(ctx.validPotionTarget('revivalPill',2),false);
 ctx.usePotion('revivalPill');assert.equal(ctx.selected,true);assert.equal(ctx.window.v143PendingPotionTarget.potionId,'revivalPill');
 let resolved;ctx.applyPotionEffect=(...args)=>{resolved=args;};ctx.queuedPlayerActions={0:{targetAlly:1}};
 vm.runInNewContext(source.slice(source.indexOf('    if(typeof applyPotionEffect==='),source.indexOf('    /* Escape routing')),ctx);ctx.applyPotionEffect('revivalPill',0,1);assert.deepEqual(resolved,['revivalPill',0,1]);
});

test('final battle UI clears defeated state after either shared revival; old timed owner is retired',()=>{
 const party=[{hp:50},{hp:0}],classes=[new Set(),new Set()],ctx={currentBattleMonsters:[],monsters:[],getExistingPartyIndexes:()=>[0,1],getPartyCharacterByIndex:i=>party[i],$:id=>({classList:{toggle:(key,on)=>{const set=classes[Number(id.slice(-1))];on?set.add(key):set.delete(key);}}})};
 vm.runInNewContext(declaration('syncBattleDefeatedCards'),ctx);ctx.syncBattleDefeatedCards();assert.ok(classes[1].has('v146-defeated'));party[1].hp=35;ctx.syncBattleDefeatedCards();assert.equal(classes[1].has('v146-defeated'),false);
 assert.match(declaration('updateUI'),/updateBattlePlayerBars\(\);\s*syncBattleDefeatedCards\(\);/);
 assert.doesNotMatch(read('js/41-v146-system-polish.js'),/syncDefeatedCards/);
});
