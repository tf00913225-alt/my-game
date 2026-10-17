"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const factory=require("../js/equipment-factory"),reforge=require("../functions/src/equipment-reforge");
const read=path=>fs.readFileSync(path,"utf8").replace(/\r\n/g,"\n");
const plain=value=>JSON.parse(JSON.stringify(value));
function runtime(){
 const store=new Map(),c=vm.createContext({console,skillDatabase:{stormSpell:{}},localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},setTimeout(){},
  document:{readyState:"loading",addEventListener(){},getElementById:()=>null,createElement:()=>({}),head:{appendChild(){}}},
  characterEquipment:{fire:{hand:null}},isEquipmentInventoryType:t=>["head","helmet","weapon","armor","shoes","shoulder","ring"].includes(t),
  FourSymbolsAccountSave:{accountKey:k=>"uid:"+k},FourSymbolsEquipmentFactory:factory,FourSymbolsEquipmentReforge:reforge});
 c.window=c;vm.runInContext(require("../.github/scripts/fixtures/item-slot-owner.cjs"),c);
 const main=read("js/00-main.js"),start=main.indexOf("const inventoryItems = ["),end=main.indexOf("const inventorySlots",start);
 vm.runInContext(main.slice(start,end)+";window.inventoryItems=inventoryItems;",c);
 vm.runInContext(read("js/36-v141-content-systems.js"),c);
 vm.runInContext(read("js/equipment-progression.js"),c);
 return c;
}
test("actual initial inventory and final forge owner recognize every starter with empty canonical slots",()=>{
 const c=runtime(),items=c.inventoryItems.filter(i=>c.isEquipmentInventoryType(i.type));
 assert.equal(items.length,5);assert.equal(new Set(items.map(i=>i.v141Uid)).size,5);
 for(const item of items){assert.equal(item.id,item.v141Uid);assert.ok(factory.validUid(item.v141Uid));assert.equal(c.FourSymbolsReforge.reason(item),"");assert.equal(reforge.slotCount(item),1);assert.deepEqual(item.reforgeAffixes,[null]);assert.equal(Object.keys(item.stats).length,1);assert.ok(factory.validName(item.name));}
});

test("legacy main-element alias preserves conflicting equipped pieces in inventory",()=>{
 const c=runtime(),a=factory.starter("ironSword"),b=factory.starter("woodStaff");
 c.player={element:"water"};c.getBackpackEquipmentKey=()=>"fire";
 c.characterEquipment.fire={hand:a};c.characterEquipment.water={hand:b};
 c.v17346SyncMainCharacterEquipmentStorage();
 assert.strictEqual(c.characterEquipment.water,c.characterEquipment.fire);
 assert.strictEqual(c.characterEquipment.fire.hand,a);assert.ok(c.inventoryItems.includes(b));
});

test("inventory stack normalization keeps canonical equipment references and rejects ambiguous stacks atomically",()=>{
 const c=runtime(),main=read("js/00-main.js"),start=main.indexOf("function cloneInventoryStackItem("),end=main.indexOf("function ",main.indexOf("function normalizeInventoryStacks(")+12);
 vm.runInContext(main.slice(start,end),c);
 const item=c.inventoryItems[0];assert.strictEqual(c.cloneInventoryStackItem(item,1),item);
 item.count=2;const before=JSON.stringify(c.inventoryItems);assert.throws(()=>c.normalizeInventoryStacks());assert.equal(JSON.stringify(c.inventoryItems),before);
});

test("starter passes actual equip, unequip and sale owners without replacing its identity",async()=>{
 const c=runtime(),main=read("js/00-main.js");
 Object.assign(c,{$:()=>({dataset:{}}),getInventoryEquipmentSlot:t=>t==="weapon"?"hand":t,getBackpackCharacter:()=>({}),getBackpackEquipmentKey:()=>"fire",inventoryCharacterIndex:0,
  battleActive:false,refreshHeroPage(){},getEquipmentSelection:()=>c.selection,
  closeItemModal(){},rebuildInventorySlots(){},renderInventory(){},updateUI(){},saveGame(){return true;},updateGoldDisplay(){},rpgConfirm:async()=>true});
 vm.runInContext("let selectedInventorySlot=0; let inventorySlots=inventoryItems; let gold=0;"+main.slice(main.indexOf("function commitEquipmentTransfer("),main.indexOf("/* =====================================================\n   自動戰鬥設定",main.indexOf("function equipSelectedItem(){"))),c);
 c.selection={key:'fire',item:c.inventoryItems[0]};
 const item=c.inventoryItems[0];c.equipSelectedItem();assert.strictEqual(c.characterEquipment.fire.hand,item);assert.ok(!c.inventoryItems.includes(item));
 c.selection.slot='hand';c.unequipItem("hand");assert.strictEqual(c.characterEquipment.fire.hand,null);assert.ok(c.inventoryItems.includes(item));
 vm.runInContext("selectedInventorySlot=inventoryItems.length-1;",c);await c.sellSelectedItem();assert.ok(!c.inventoryItems.includes(item));
 assert.equal(vm.runInContext("gold",c),factory.prices(item).sell);
});
test("missing UID migration preserves stats, results, locks, sale value and bag/equipped identity on reload",()=>{
 const old={id:"ironSword",name:"鐵劍",type:"weapon",stats:{attack:18,energy:2},price:120,reforgeStats:{vitality:7},reforgeUsed:19,v17351Locked:true};
 const bag=[old],equipment={fire:{hand:plain(old)}},saved=plain(old);
 factory.migrateGraph(bag,equipment);assert.strictEqual(equipment.fire.hand,bag[0]);assert.deepEqual(old.stats,saved.stats);assert.deepEqual(old.reforgeStats,saved.reforgeStats);assert.equal(old.reforgeUsed,19);assert.equal(old.price,120);assert.equal(old.v17351Locked,true);
 const identity=old.v141Uid,name=old.name;const reload=plain({bag,equipment});factory.migrateGraph(reload.bag,reload.equipment);
 assert.equal(reload.bag[0].v141Uid,identity);assert.equal(reload.bag[0].name,name);assert.strictEqual(reload.bag[0],reload.equipment.fire.hand);assert.deepEqual(reforge.aggregate(reload.bag[0]),saved.reforgeStats);
 const distinct=[plain(saved),plain(saved)];factory.migrateGraph(distinct,{});assert.notEqual(distinct[0].v141Uid,distinct[1].v141Uid);
});
test("conflicting or malformed existing identity fails before migration and preserves every byte",()=>{
 for(const items of [[{id:"a",type:"armor",v141Uid:"existing",stats:{attack:5}},{id:"b",type:"armor",v141Uid:"existing",stats:{attack:6}}],[{id:"a",type:"armor",stats:{attack:5}},{id:"b",type:"armor",v141Uid:9,stats:{attack:6}}]]){
  const bytes=JSON.stringify(items);assert.throws(()=>factory.migrateGraph(items,{}));assert.equal(JSON.stringify(items),bytes);
 }
});

test("unmarked legacy ordinary equipment repairs invalid names once without rerolling stats",()=>{
 const item={id:"old_reward",type:"armor",name:"幽月幽月法袍",stats:{energy:8},reforgeStats:{attack:2}};
 factory.migrateGraph([item],{});assert.ok(factory.validName(item.name));const saved=plain(item);
 factory.migrateGraph([item],{});assert.deepEqual(item,saved);assert.deepEqual(item.stats,{energy:8});assert.deepEqual(item.reforgeStats,{attack:2});
});
test("new ordinary names and one base stat survive saves; legacy duplicate fragments use UID once",()=>{
 for(const rarity of ["white","blue","purple","orange"]){for(const type of ["head","shoulder","armor","shoes","weapon"]){for(const classType of ["warrior","mage"]){
  const item=factory.create({type,classType,rarityKey:rarity,stats:{[classType==="mage"?"intelligence":"attack"]:20}},{ordinary:true});
  assert.ok(factory.validName(item.name));assert.equal(Object.keys(item.stats).length,1);assert.ok(item.reforgeAffixes.every(a=>a===null));
  const reload=plain(item);factory.migrateGraph([reload],{});assert.equal(reload.name,item.name);assert.equal(reload.v141Uid,item.v141Uid);
 }}}
 const old={id:"old",v141Uid:"stable",name:"幽月幽月法冠",type:"head",classType:"mage",stats:{intelligence:19},v17346GeneratedEquipment:true};factory.migrateItem(old);const name=old.name;factory.migrateItem(old);assert.ok(factory.validName(name));assert.equal(old.name,name);
 const valid={...old,name:"幽月法冠"};factory.migrateItem(valid);assert.equal(valid.name,"幽月法冠");
 assert.doesNotMatch(read("js/equipment-progression.js"),/幽月幽月|repairStarterWhiteStats|function makeUid|item\.reforgeUsed=0/);
});
test("shop name collision rerolls change neither instance/stat/asset nor price",()=>{
 const items=Array.from({length:6},(_,i)=>factory.create({type:"weapon",classType:"mage",rarityKey:"purple",stats:{intelligence:20}},{ordinary:true,uid:"batch"+i}));
 items.forEach(i=>i.name=items[0].name);const before=items.map(({name,...rest})=>plain(rest));factory.uniqueNames(items);assert.equal(new Set(items.map(i=>i.name)).size,6);assert.deepEqual(items.map(({name,...rest})=>plain(rest)),before);
});
test("one price resolver is strictly monotone and ignores absent extra affixes",()=>{
 for(const rarity of ["white","blue","purple","orange"]){for(const type of ["weapon","head","armor","shoes","shoulder"]){for(const stat of reforge.STATS){
  const value={white:5,blue:11,purple:17,orange:23}[rarity]+3;
  const low=factory.create({type,rarityKey:rarity,stats:{[stat]:value}},{ordinary:true}),high={...low,stats:{[stat]:value+1}};
  assert.ok(factory.prices(high).shop>factory.prices(low).shop);high.reforgeStats={attack:999};assert.equal(factory.prices(high).shop,factory.prices({...high,reforgeStats:null}).shop);
 }}}
 const core=read("js/00-main.js"),shop=read("js/equipment-progression.js"),bulk=read("js/53-v173.50-inventory-qol.js");
 assert.match(core,/售價：[\s\S]{0,150}FourSymbolsEquipmentFactory.prices\(item\).sell/);
 assert.match(core,/const price = isEquipmentInventoryType\(item.type\)[\s\S]{0,100}FourSymbolsEquipmentFactory.prices\(item\).sell/);
 assert.match(bulk,/FourSymbolsEquipmentFactory.prices\(item\).sell\*count/);
 assert.match(shop,/const cost=window.FourSymbolsEquipmentFactory.prices\(item\).shop/);assert.doesNotMatch(shop,/rarity.shopPrice/);
});
test("factory special equipment uses the sole V2 slot model without altering set base stats",()=>{
 for(const [rarity,count] of Object.entries({white:1,blue:1,purple:2,orange:2,pink:3,"four-symbol":5})){
  const stats={attack:30,vitality:5},item=factory.create({id:"set-piece",type:"armor",setId:"setFire",rarityKey:rarity,name:"赤炎戰甲",stats});
  assert.equal(reforge.slotCount(item),count);assert.deepEqual(item.stats,stats);assert.equal(item.reforgeAffixes.length,count);
 }
});

test("approved 2% formula and 20% recovery share saved prices across every stat and slot",()=>{
 assert.deepEqual(factory.STAT_PRICE_WEIGHT,{attack:1,intelligence:1,vitality:1,energy:1,defensePoints:1,agility:1});
 assert.ok(Object.isFrozen(factory.STAT_PRICE_WEIGHT));assert.ok(Object.isFrozen(factory.SLOT_PRICE_WEIGHT));
 const tiers={white:[500,5],blue:[1500,11],purple:[4000,17],orange:[10000,23]};
 for(const [rarityKey,[base,min]] of Object.entries(tiers))for(const type of Object.keys(factory.SLOT_PRICE_WEIGHT))for(const stat of reforge.STATS)for(const extra of [0,1,3,5]){
  assert.equal(factory.SLOT_PRICE_WEIGHT[type],1);
  const item=factory.create({type,rarityKey,stats:{[stat]:min+extra}},{ordinary:true});
  const price={shop:base+Math.ceil(base*.02*extra),sell:Math.floor((base+Math.ceil(base*.02*extra))*.2)};
  assert.deepEqual(factory.prices(item),price);assert.equal(item.shopPrice,price.shop);assert.equal(item.price,price.sell);
  const reload=plain(item);reload.shopPrice=1;reload.price=1;factory.migrateItem(reload);
  assert.equal(reload.shopPrice,price.shop);assert.equal(reload.price,price.sell);assert.equal(reload.v141Uid,item.v141Uid);assert.equal(reload.name,item.name);assert.deepEqual(reload.stats,item.stats);
 }
 for(const [rarityKey,value,expected] of [["purple",20,4240],["purple",21,4320],["blue",12,1530],["orange",24,10200]]){
  assert.equal(factory.prices(factory.create({type:"weapon",rarityKey,stats:{attack:value}},{ordinary:true})).shop,expected);
 }
 for(const id of Object.keys(factory.STARTERS))assert.equal(factory.prices(factory.starter(id)).sell,factory.STARTERS[id].price);
 const legacy={id:"legacy",type:"weapon",stats:{attack:20},shopPrice:777,price:33};factory.migrateGraph([legacy],{});assert.deepEqual(factory.prices(legacy),{shop:777,sell:33});
});
