'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const factory=require('../js/equipment-factory'),core=require('../functions/src/hero-core');
const source=fs.readFileSync('js/00-main.js','utf8').replace(/\r\n/g,'\n');
const decl=name=>source.match(new RegExp('^function '+name+'\\([^]*?^\\}','m'))[0];
const ids=core.listHeroDefinitions().map(d=>d.heroId),key=id=>'heroNpc:'+id;
const empty=()=>({head:null,hand:null,shoulder:null,armor:null,shoes:null,ring:null});
function runtime(){
 const player={id:'P',level:40,element:'fire'},equipment={fire:empty(),[key(ids[0])]:empty(),[key(ids[1])]:empty()};
 const c={console,player,player2:null,player3:null,battleActive:false,inventoryCharacterIndex:0,characterEquipment:equipment,inventoryItems:[],roster:[ids[0]],uid:'A',saved:[],alerts:[],
  FourSymbolsEquipmentFactory:factory,FourSymbolsHeroCore:core,FourSymbolsEquipmentReforge:require('../functions/src/equipment-reforge'),
  getPartyCharacterKey:i=>['fire','player2','player3'][i],getPartyCharacterByIndex:i=>i===0?player:null,
  getSkillLevel:()=>{throw Error('Hero must not resolve player EX');},
  closeItemModal(){vm.runInContext('equipmentDetailSelection=null',c);},rebuildInventorySlots(){},renderInventory(){},updateUI(){},refreshHeroPage(){},
  saveGame(){if(c.failSave)return false;c.saved.push(JSON.stringify({inventoryItems:c.inventoryItems,characterEquipment:c.characterEquipment}));return true;},
  alert:message=>c.alerts.push(message),
  getActiveBuffPercent:()=>0,getPlayerDefenseDownPercent:()=>0,getWindEXFinalEvasionBonusPercent:()=>0,getRelicFinalEvasionPercent:()=>0,getFrostbiteFinalPercentPointPenalty:()=>0,
  combineEvasionRates:a=>a.reduce((x,y)=>x+y,0),projectRelicBattleStats:(_,s)=>s,
  calculateCharacterBaseStats:(character,bonus)=>({maxHP:100+(bonus.maxHP||0),maxSP:50,attack:40+(bonus.attack||0),agility:character.agility+(bonus.agility||0),defense:20,evasion:0})};
 c.window=c;c.FourSymbolsAccountSave={getActiveUid:()=>c.uid};c.FourSymbolsHeroBattle={getRoster:()=>c.roster};
 let account=core.normalizeAccountState();for(const id of ids)account.heroes[id].unlocked=true;
 const domain=core.createDomain(account,()=>[player],c.calculateCharacterBaseStats,()=>null);c.FourSymbolsHeroSystem={getDomain:()=>domain};
 vm.createContext(c);vm.runInContext(source.slice(source.indexOf('const EQUIPMENT_SOCKET_CAPACITY='),source.indexOf('/* =====================================================',source.indexOf('const EQUIPMENT_SOCKET_CAPACITY=')))+'\nlet equipmentDetailSelection=null;'+['getHeroEquipmentCharacter','getBackpackPartyCharacters','getBackpackCharacter','getBackpackEquipmentKey','getEquipmentSelection','captureEquipmentSelection','getInventoryEquipmentSlot','getEquipmentBonus','getAdditionalCharacterBattleStats','commitEquipmentTransfer','equipSelectedItem','unequipItem'].map(decl).join('\n'),c);
 return c;
}
function wear(c,item,id=null){c.captureEquipmentSelection(item,id);return c.equipSelectedItem();}
function remove(c,item,id=null){c.captureEquipmentSelection(item,id,'hand');return c.unequipItem('hand');}
test('one physical instance transfers player → bag → hero → bag → other hero, preserving all affixes',()=>{
 const c=runtime(),item=factory.starter('ironSword');item.sockets=[{stat:'vitality',value:5}];c.inventoryItems.push(item);const original=JSON.stringify(item);
 assert.equal(wear(c,item),true);assert.strictEqual(c.characterEquipment.fire.hand,item);assert.equal(c.inventoryItems.length,0);
 assert.equal(wear(c,item,ids[0]),false);assert.equal(c.characterEquipment[key(ids[0])].hand,null);
 assert.equal(remove(c,item),true);assert.equal(wear(c,item,ids[0]),true);
 assert.equal(wear(c,item,ids[1]),false);assert.strictEqual(c.characterEquipment[key(ids[0])].hand,item);
 assert.equal(remove(c,item,ids[0]),true);assert.equal(wear(c,item,ids[1]),true);
 assert.equal(JSON.stringify(item),original);assert.equal(factory.validateOwnership(c.inventoryItems,c.characterEquipment),true);
 assert.equal(c.saved.length,5);
});
test('replacement at full bag is atomic; full bag unequip and failed saves retain exact objects',()=>{
 const c=runtime(),a=factory.starter('ironSword'),b=factory.starter('woodStaff');c.characterEquipment[key(ids[0])].hand=a;c.inventoryItems.push(b,...Array.from({length:119},(_,i)=>({id:'material'+i,type:'material'})));
 assert.equal(wear(c,b,ids[0]),true);assert.equal(c.inventoryItems.length,120);assert.ok(c.inventoryItems.includes(a));
 assert.equal(remove(c,b,ids[0]),false);assert.strictEqual(c.characterEquipment[key(ids[0])].hand,b);
 c.inventoryItems.pop();c.failSave=true;const before=c.inventoryItems.slice();
 assert.equal(remove(c,b,ids[0]),false);assert.deepEqual(c.inventoryItems,before);assert.strictEqual(c.characterEquipment[key(ids[0])].hand,b);
 assert.equal(wear(c,a,ids[0]),false);assert.deepEqual(c.inventoryItems,before);assert.strictEqual(c.characterEquipment[key(ids[0])].hand,b);
});
test('stale modal cannot redirect by sorting, formation change, UID switch, character replacement or battle',()=>{
 const c=runtime(),item=factory.starter('ironSword');c.inventoryItems.push(item);c.inventoryCharacterIndex=3;c.captureEquipmentSelection(item);
 c.roster=[];assert.equal(c.equipSelectedItem(),false);assert.ok(c.inventoryItems.includes(item));
 c.captureEquipmentSelection(item,ids[0]);c.uid='B';assert.equal(c.equipSelectedItem(),false);
 c.uid='A';c.captureEquipmentSelection(item,ids[0]);c.battleActive=true;assert.equal(c.equipSelectedItem(),false);
 c.battleActive=false;c.inventoryCharacterIndex=0;c.captureEquipmentSelection(item);c.player={...c.player};c.getPartyCharacterByIndex=()=>c.player;assert.equal(c.equipSelectedItem(),false);
});
test('backpack exposes only confirmed fielded heroes; hero-page subject supports owned non-fielded heroes',()=>{
 const c=runtime();assert.equal(c.getBackpackPartyCharacters().length,4);assert.equal(c.getBackpackEquipmentKey(3),key(ids[0]));
 const late=fs.readFileSync('js/35-v141-ui-battle.js','utf8').replace(/\r\n/g,'\n');
 vm.runInContext(late.match(/    function getCreatedBackpackIndexes\([^]*?\n    \}/)[0],c);
 assert.deepEqual(Array.from(c.getCreatedBackpackIndexes()),[0,3]);
 assert.equal(c.getBackpackCharacter(3).combatantKind,'heroNpc');assert.equal(c.getBackpackCharacter(4),null);
 const item=factory.starter('woodStaff');c.inventoryItems.push(item);assert.equal(wear(c,item,ids[1]),true);
 c.roster=[];assert.equal(c.getBackpackPartyCharacters().length,3);assert.strictEqual(c.characterEquipment[key(ids[1])].hand,item);
});
test('the existing wear restriction Owner applies the same level and element rules to Heroes',()=>{
 const c=runtime(),expansion=fs.readFileSync('js/27-v132-content-expansion.js','utf8').replace(/\r\n/g,'\n');
 const start=expansion.indexOf('    if(typeof equipSelectedItem==="function"){');
 c.normalizeEquipmentSetItem=()=>{};c.elementDatabase={wind:{name:'風'}};
 vm.runInContext(expansion.slice(start,expansion.indexOf('    /* =====================================================\n       12.',start)),c);
 const item=factory.starter('ironSword');c.inventoryItems.push(item);item.levelRequirement=50;assert.equal(wear(c,item,ids[0]),undefined);
 assert.ok(c.inventoryItems.includes(item));item.levelRequirement=1;item.requiredElement='wind';wear(c,item,ids[0]);assert.ok(c.inventoryItems.includes(item));
 item.requiredElement='fire';assert.equal(wear(c,item,ids[0]),true);assert.strictEqual(c.characterEquipment[key(ids[0])].hand,item);
});
test('duplicate UID graph rejects bag/hero, player/hero and hero/hero; legacy main aliases remain legal',()=>{
 const item=factory.starter('ironSword');
 for(const graph of [{fire:{hand:item},[key(ids[0])]:{hand:{...item}}},{[key(ids[0])]:{hand:item},[key(ids[1])]:{hand:item}}])assert.throws(()=>factory.validateOwnership([],graph));
 assert.throws(()=>factory.validateOwnership([item],{[key(ids[0])]:{hand:item}}));
 assert.equal(factory.validateOwnership([],{fire:{hand:item},water:{hand:{...item}}}),true);
});
test('Hero uses shared gear/reforge/gem bonus without player skill identity or mutation of Core state',()=>{
 const c=runtime(),item=factory.starter('ironSword');item.stats={attack:12,maxHP:50};item.reforgeAffixes=[{stat:'attack',value:3}];
 item.rarityKey='orange';item.sockets=['gemVitalityI'];c.characterEquipment[key(ids[0])].hand=item;
 const actor=c.getHeroEquipmentCharacter(ids[0]),before=JSON.stringify(c.FourSymbolsHeroSystem.getDomain().serialize());
 const stats=c.getAdditionalCharacterBattleStats(actor,null);assert.equal(stats.attack,55);assert.equal(stats.maxHP,150);
 assert.equal(c.getAdditionalCharacterBattleStats(actor,key(ids[0])).attack,55,'backpack equipment key cannot become a player skill key');
 assert.equal(c.getEquipmentBonus(key(ids[0])).vitality,1);
 assert.equal(JSON.stringify(c.FourSymbolsHeroSystem.getDomain().serialize()),before);
});
