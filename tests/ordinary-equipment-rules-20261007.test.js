"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/equipment-progression.js','utf8');
const forge=fs.readFileSync('js/36-v141-content-systems.js','utf8');
function fixture(items=[],equipment={}){
 const c=vm.createContext({console,inventoryItems:items,characterEquipment:equipment,localStorage:{getItem:()=>null},setTimeout(){},
  document:{readyState:'loading',addEventListener(){},getElementById:()=>null,createElement:()=>({}),head:{appendChild(){}}},
  FourSymbolsAccountSave:{accountKey:x=>x}});c.window=c;vm.runInContext(source,c);return c;
}
const plain=x=>JSON.parse(JSON.stringify(x));
const ranges={white:[5,10],blue:[11,16],purple:[17,22],orange:[23,28]};
test('independent shop and chest tables total 100 and deterministic boundaries exclude special tiers',()=>{
 const c=fixture();
 assert.deepEqual(plain(c.v17346EquipmentShopDropTable).map(x=>x.chance),[70,15,10,5]);
 assert.deepEqual(plain(c.v17346EquipmentChestDropTable).map(x=>x.chance),[40,40,15,5]);
 for(const table of [c.v17346EquipmentShopDropTable,c.v17346EquipmentChestDropTable]){
  assert.equal(table.reduce((n,x)=>n+x.chance,0),100);assert.deepEqual(plain(table).map(x=>x.key),Object.keys(ranges));
 }
 for(const [roll,key] of [[0,'white'],[.69999,'white'],[.7,'blue'],[.84999,'blue'],[.85,'purple'],[.94999,'purple'],[.95,'orange'],[.99999,'orange']])assert.equal(c.v17346RollEquipmentShopRarity(()=>roll),key);
 for(const [roll,key] of [[0,'white'],[.39999,'white'],[.4,'blue'],[.79999,'blue'],[.8,'purple'],[.94999,'purple'],[.95,'orange'],[.99999,'orange']]){
  const items=c.v17346RollEquipmentChestItems(()=>roll);
  assert.equal(items.length,3);assert.ok(items.every(x=>x.rarityKey===key));
 }
 const samples=[0,...Array(3).fill(0),.4,...Array(3).fill(0),.95,...Array(3).fill(0)];
 assert.deepEqual(plain(c.v17346RollEquipmentChestItems(()=>samples.shift())).map(x=>x.rarityKey),['white','blue','orange']);
 assert.equal(samples.length,0,'each piece consumes its own rarity roll');
});
test('fixed catalog owns every ordinary name, legal stat, rarity and image',()=>{
 const c=fixture(),catalog=plain(c.v17346GetEquipmentCatalog());
 assert.equal(catalog.length,661);assert.equal(new Set(catalog.map(x=>x.name)).size,661);
 const manifest=JSON.parse(fs.readFileSync('docs/equipment-catalog-20261008.json','utf8'));
 assert.deepEqual(catalog,manifest.equipment);assert.equal(manifest.images.length,301);
 assert.deepEqual(Object.fromEntries(Object.keys(ranges).map(key=>[key,catalog.filter(x=>x.rarityKey===key).length])),{white:91,blue:90,purple:240,orange:240});
 assert.equal(manifest.images.filter(x=>x.legacy&&x.classType==='warrior').length,90);
 assert.equal(manifest.images.filter(x=>x.legacy&&x.classType==='mage').length,91);
 assert.equal(new Set(manifest.images.filter(x=>x.legacy).map(x=>x.rgbaSha256)).size,181);
 for(const image of manifest.images){
  const entries=catalog.filter(x=>x.assetPath===image.assetPath);assert.equal(entries.length,image.legacy?1:4);
  assert.deepEqual(entries.map(x=>x.rarityKey),image.legacy?[image.rarityKey]:['purple','purple','orange','orange']);
  assert.ok(fs.existsSync(image.assetPath),image.assetPath);
  assert.match(image.assetPath,/\.webp$/);
 }
 for(const entry of catalog){
  const pool=catalog.filter(x=>x.rarityKey===entry.rarityKey&&x.classType===entry.classType&&x.type===entry.type);
  const roll=(pool.findIndex(x=>x.name===entry.name)+.1)/pool.length;
  const item=c.v17346GenerateEquipment(()=>roll,{rarity:entry.rarityKey,classType:entry.classType,slot:entry.type});
  assert.equal(item.name,entry.name);assert.deepEqual(plain(item.stats),entry.stats);assert.equal(item.assetPath,entry.assetPath);assert.match(item.icon,/<img /);
  assert.equal(Object.keys(item.stats).length,1);const [min,max]=ranges[entry.rarityKey];assert.ok(Object.values(item.stats)[0]>=min&&Object.values(item.stats)[0]<=max);
  const power=entry.classType==='warrior'?'attack':'intelligence';
  const allowed={weapon:[power],shoulder:['vitality',power,'defensePoints'],head:['vitality',power,'agility','defensePoints'],armor:['vitality','agility',power,'defensePoints'],shoes:['vitality','agility',power]};
  assert.ok(allowed[entry.type].includes(Object.keys(item.stats)[0]));
  item.stats.attack=999;assert.deepEqual(plain(c.v17346GetEquipmentCatalog()).find(x=>x.name===entry.name).stats,entry.stats);
 }
 for(const rarity of ['pink','four-symbol','unknown'])assert.throws(()=>c.v17346GenerateEquipment(()=>0,{rarity}),/特殊裝備/);
});
test('inventory, equipped UIDs, old stats and reforge stats survive repeated load/sync; starter stays fixed',()=>{
 const items=[{id:'old-gear',v141Uid:'old-uid',type:'armor',rarityKey:'orange',v17346GeneratedEquipment:true,stats:{attack:12},reforgeStats:{vitality:4},assetPath:'old.png',icon:'old'}];
 const equipment={fire:{weapon:{id:'equipped',v141Uid:'equipped-uid',stats:{intelligence:6},reforgeStats:{agility:2}}}};
 const before=JSON.stringify({items,equipment});const c=fixture(items,equipment);
 c.v17346SyncFourElementSets();c.v17346SyncFourElementSets();
 assert.equal(JSON.stringify({items,equipment}),before);
 assert.deepEqual(plain(c.v17362StarterWhiteStats),{ironSword:{attack:3},woodStaff:{intelligence:3},leatherHelmet:{vitality:1},leatherArmor:{vitality:2},leatherShoes:{agility:2}});
});
function forgeFixture(){
 // Execute the existing pure roll owner and its declarations, without booting unrelated dungeon/UI owners.
 const start=forge.indexOf('    const TIER_ALIASES=');const end=forge.indexOf('    function escapeHtml(');
 const c=vm.createContext({Math:Object.create(Math)});vm.runInContext(forge.slice(start,end),c);
 vm.runInContext(forge.slice(forge.indexOf('    function reforgeSlotCount('),forge.indexOf('    function canActuallyReforge(')),c);
 vm.runInContext(forge.slice(forge.indexOf('    function rollUniform('),forge.indexOf('    function statsHtml(')).replace(/window\./g,'globalThis.'),c);return c;
}
test('reforge material tier controls ranges, white/blue no sub, locks persist, special tiers reject',()=>{
 const c=forgeFixture();
 for(const [tier,[min,max]] of Object.entries(ranges)){
  for(const [random,expected] of [[0,max],[.1,min]]){
   c.Math.random=()=>random;const item={reforgeSlots:2};const result=plain(c.v17358RollReforgeAffixes(item,tier,[]));
   const main=Object.entries(result).find(([key])=>['attack','intelligence'].includes(key));assert.equal(main[1],expected);
   const sub=Object.entries(result).filter(([key])=>!['attack','intelligence'].includes(key));
   if(['white','blue'].includes(tier))assert.equal(sub.length,0);else {assert.equal(sub.length,1);assert.ok(sub[0][1]>=11&&sub[0][1]<=16);}
  }
 }
 c.Math.random=()=>.1;const item={reforgeSlots:2,reforgeStats:{attack:99,agility:4}};
 const before=JSON.stringify(item);assert.equal(c.v17358RollReforgeAffixes(item,'purple',['attack']).attack,99);assert.equal(JSON.stringify(item),before);
 for(const tier of ['pink','four-symbol','unknown'])assert.throws(()=>c.v17358RollReforgeAffixes({reforgeSlots:2},tier,[]),/尚未開放/);
});
