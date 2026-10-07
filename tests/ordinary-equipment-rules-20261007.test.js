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
});
test('ordinary rolls use new inclusive ranges, one stat, and explicit rarity art pools',()=>{
 const c=fixture();
 for(const [rarity,[min,max]] of Object.entries(ranges))for(const classType of ['warrior','mage'])for(const slot of ['weapon','shoulder','head','armor','shoes'])for(const [random,value] of [[0,min],[.99999,max]]){
  const item=c.v17346GenerateEquipment(()=>random,{rarity,classType,slot});
  assert.equal(Object.keys(item.stats).length,1);assert.equal(Object.values(item.stats)[0],value);
  if(['white','blue'].includes(rarity)){assert.match(item.assetPath,/assets\/equipment\/(warrior|mage)\//);assert.match(item.icon,/<img /);}
  else {assert.equal(item.assetPath,'');assert.doesNotMatch(item.icon,/<img |v17346-rarity-/);assert.match(item.icon,/data-asset-state="missing"/);assert.match(item.icon,/裝備素材尚未就緒/);}
 }
 for(const rarity of ['pink','four-symbol','unknown'])assert.throws(()=>c.v17346GenerateEquipment(()=>0,{rarity}),/特殊裝備/);
});
test('both classes can roll defense only on bracers helmets and clothes',()=>{
 const c=fixture();
 for(const classType of ['warrior','mage'])for(const [slot,pool] of Object.entries({weapon:[classType==='warrior'?'attack':'intelligence'],shoulder:['vitality',classType==='warrior'?'attack':'intelligence','defensePoints'],head:['vitality',classType==='warrior'?'attack':'intelligence','agility','defensePoints'],armor:['vitality','agility',classType==='warrior'?'attack':'intelligence','defensePoints'],shoes:['vitality','agility',classType==='warrior'?'attack':'intelligence']})){
  for(let i=0;i<pool.length;i++)assert.deepEqual(Object.keys(c.v17346GenerateEquipment(()=>(i+.1)/pool.length,{rarity:'white',classType,slot}).stats),[pool[i]]);
 }
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
