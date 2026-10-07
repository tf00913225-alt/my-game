'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const main=fs.readFileSync('js/00-main.js','utf8');
const rules=main.slice(main.indexOf('function getPotionDefinition('),main.indexOf('function createPotionInventoryItem('));
const declarations=main.slice(main.indexOf('const potionDefinitions=['),main.indexOf('const shopItems=potionDefinitions'));
function fixture(){const c={window:null,console,document:{getElementById(){return null;}},skillDatabase:{},setTimeout(){},inventoryItems:[]};c.window=c;vm.createContext(c);vm.runInContext(declarations+rules,c);vm.runInContext(fs.readFileSync('js/40-v144-rules-and-abyss.js','utf8'),c);return c;}
test('flat starter and percent tiers recover real capped amounts',()=>{
 const c=fixture();for(const [id,current,max,expected] of [['hpPotion10',4000,4520,66],['hpPotion10',4500,4520,20],['spPotion10',1000,1190,66],['spPotion10',1170,1190,20],['hpPotion20',3000,4520,904],['hpPotion30',3000,4520,1356],['spPotion20',500,1190,238],['spPotion30',500,1190,357],['hpPotion50',1000,4520,2260],['spPotion50',100,1190,595],['hpPotion100',4000,4520,520],['spPotion100',1000,1190,190]])assert.equal(c.resolvePotionRecovery(c.getPotionDefinition(id),current,max),expected,id);
 for(const id of ['hpPotion10','spPotion10']){const d=c.getPotionDefinition(id);assert.equal(d.recoveryMode,'flat');assert.equal(d.recoveryValue,66);assert.equal(d.recoveryPercent,undefined);}
 assert.equal(c.getPotionEffectDescription('hpPotion10'),'恢復 66 HP');assert.equal(c.getPotionEffectDescription('spPotion10'),'恢復 66 SP');
});
test('legacy stock hydration keeps identity and counts while retiring flat percent metadata',()=>{
 const c=fixture(),item={id:'hpPotion10',count:321,recoveryPercent:10};c.syncPotionRecoveryContract(item,c.getPotionDefinition(item.id));assert.equal(item.id,'hpPotion10');assert.equal(item.count,321);assert.equal(item.recoveryMode,'flat');assert.equal(item.recoveryValue,66);assert.equal(item.recoveryPercent,undefined);
 assert.equal(c.resolvePotionRecovery({recoveryPercent:100},4000,4520),520);assert.equal(c.resolvePotionRecovery({recoveryMode:'full'},1170,1190),20);assert.equal(c.resolvePotionRecovery({recoveryMode:'flat',recoveryValue:66,recoveryPercent:100},4000,4520),66);assert.equal(c.resolvePotionRecovery({recoveryMode:'percent',recoveryValue:20},1,1),0);
});
test('all formal consumption paths delegate to the same recovery rule',()=>{
 for(const [file,token,end] of [['js/00-main.js','function applyPotionEffect(','function toggleAutoBattle('],['js/00-main.js','function applyPostBattleAutoRecovery(','function winBattle('],['js/35-v141-ui-battle.js','window.v17342UseInventoryPotion=function','if(typeof openItemModal'],['js/53-v173.50-inventory-qol.js','function batchPotion(','function getChestOpenOnce('],['js/45-v154-dev-fixes.js','function finishAutoRecovery(','window.v154FinishAutoRecovery=']]){
 const s=fs.readFileSync(file,'utf8'),start=s.indexOf(token),body=s.slice(start,s.indexOf(end,start));assert.match(body,/resolvePotionRecovery\(definition,/);assert.doesNotMatch(body,/maxValue\s*\*\s*(?:Number\()?definition.recoveryPercent/);
 }
});
