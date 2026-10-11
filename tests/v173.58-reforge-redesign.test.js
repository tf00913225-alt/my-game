"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const releaseMeta=JSON.parse(fs.readFileSync("release/release.json","utf8"));
const synthesis=fs.readFileSync("js/36-v141-content-systems.js","utf8");
const equipment=fs.readFileSync("js/equipment-progression.js","utf8");
const css=fs.readFileSync("css/38-v141-system-expansion.css","utf8");
const loader=fs.readFileSync("js/20-anonymous-20.js","utf8")+fs.readFileSync("scripts/build-production.mjs","utf8");
const index=fs.readFileSync("index.html","utf8");

assert.match(synthesis,/reforgeMaterialTier:"white",lockedReforgeKeys:\[\]/);
assert.match(synthesis,/function reforgeMaterialCost\(lockCount\)/);
assert.match(synthesis,/return locks===0\?50:\(locks===1\?100:150\)/);
assert.match(synthesis,/function reforgeSlotCount\(item\)/);
assert.match(synthesis,/item\.v17351Locked===true/);
assert.match(synthesis,/window\.FourSymbolsReforge=/);
assert.match(synthesis,/v141SelectReforgeMaterialTier/);
assert.match(synthesis,/v141ToggleReforgeLock/);
assert.doesNotMatch(synthesis,/consumeMatching\(candidate=>candidate&&candidate\.blueprintSlot/);
assert.match(synthesis,/v132ConsumeStackItem\(info\.ore\.id,cost\)/);
assert.match(synthesis,/stats:rollReforgeAffixes\(item,tier,locks\)/);
assert.match(synthesis,/item\.reforgeAffixes=pending\.stats\.map/);
assert.match(synthesis,/item\.reforgeUsed=0/);
assert.doesNotMatch(synthesis,/const tier=inferTier\(item\);[\s\S]{0,500}v141StartReforge/);
assert.match(synthesis,/裝備品質不限制材料階級/);
assert.match(synthesis,/未鎖定消耗 50 礦石/);
assert.match(synthesis,/鎖 1 條 100 礦石/);
assert.match(synthesis,/鎖 2 條 150 礦石/);
assert.match(equipment,/window\.FourSymbolsReforge\.slotCount\(item\)/);
assert.doesNotMatch(equipment,/merged\[key\]=/);
assert.doesNotMatch(equipment,/item\.reforgeUsed=Math\.min/);
assert.match(css,/V173\.58 — FREE-MATERIAL REFORGE UI/);
assert.match(css,/\.v17358-reforge-tiers/);
assert.match(css,/\.v17358-affix-lock\.locked/);
assert.equal((loader.match(/const V_ASSET_VERSION="([^"]+)"/)||[])[1],releaseMeta.cacheVersion);
assert.ok(index.includes("<title>四象江湖傳 V"+releaseMeta.version+"</title>"));
console.log("✓ V173.62 unlimited free-material reforge redesign");

const model=require('../functions/src/equipment-reforge');
const vm=require('node:vm');
const pure=x=>JSON.parse(JSON.stringify(x));
for(const [rarity,slots] of Object.entries(model.SLOTS)){
 const item={type:'armor',rarityKey:rarity,reforgeSlots:0,stats:{attack:3},reforgeStats:{attack:18}};
 const base=JSON.stringify(item.stats);model.migrateItem(item);
 assert.equal(item.reforgeAffixes.length,slots);assert.deepEqual(item.reforgeAffixes[0],{stat:'attack',value:18});
 assert.ok(item.reforgeAffixes.slice(1).every(a=>a===null));assert.equal(JSON.stringify(item.stats),base);
 assert.equal(model.maxLocks(item),Math.min(2,slots-1));
 const bytes=JSON.stringify(item);model.migrateItem(item);assert.equal(JSON.stringify(item),bytes);
 const restored=JSON.parse(bytes);model.migrateItem(restored);assert.equal(JSON.stringify(restored),bytes);
}
for(const legacy of [{attack:40,intelligence:38,vitality:36,energy:35,agility:34},{accuracy:3,evasion:2,statusResistance:.5}]){
 const item={rarityKey:'white',reforgeStats:legacy};model.migrateItem(item);
 assert.equal(item.reforgeAffixes.length,Object.keys(legacy).length);assert.deepEqual(model.aggregate(item),legacy);
}
const four={rarityKey:'four-symbol',reforgeAffixes:[{stat:'attack',value:40},{stat:'attack',value:38},{stat:'attack',value:35},null],reforgeStats:{attack:999}};
assert.deepEqual(model.aggregate(four),{attack:113});
assert.deepEqual(model.roll(four,'white',[0],()=>0),[{stat:'attack',value:40},{stat:'attack',value:10},{stat:'attack',value:10},{stat:'attack',value:10}]);
assert.deepEqual(model.locks(four,[3,0,0,1,2]),[0,1]);
for(const [tier,meta] of Object.entries(model.TIERS)){
 assert.deepEqual(meta.range,[5+Object.keys(model.TIERS).indexOf(tier)*6,10+Object.keys(model.TIERS).indexOf(tier)*6]);
 if(!meta.available){assert.throws(()=>model.roll(four,tier,[],()=>0),/尚未開放/);continue;}
 for(let stat=0;stat<6;stat++){
  let seq=[(stat+.5)/6,.099999];const a=model.roll({rarityKey:'white'},tier,[],()=>seq.shift());assert.deepEqual(a,[{stat:model.STATS[stat],value:meta.range[1]}]);assert.equal(seq.length,0);
  for(let value=0;value<5;value++){
   seq=[(stat+.5)/6,.1,(value+.5)/5];assert.equal(model.roll({rarityKey:'white'},tier,[],()=>seq.shift())[0].value,meta.range[0]+value);assert.equal(seq.length,0);
  }
 }
 assert.deepEqual(model.roll({rarityKey:'four-symbol'},tier,[],()=>0),Array(4).fill({stat:'attack',value:meta.range[1]}));
}
for(const item of [{reforgeStats:{attack:'oops'}},{reforgeStats:{unknown:5}},{reforgeSlots:Infinity},{reforgeVersion:99},{reforgeAffixes:[{stat:'attack',value:NaN}]}]){
 const before=JSON.stringify(item);assert.throws(()=>model.migrateItem(item));assert.equal(JSON.stringify(item),before,'invalid original preserved atomically');
}
const mainSource=fs.readFileSync('js/00-main.js','utf8');
const bonusSource=mainSource.slice(mainSource.indexOf('function getEquipmentBonus('),mainSource.indexOf('/* Equipment rarity owns capacity'));
const context={characterEquipment:{fire:{hand:four}},window:{FourSymbolsEquipmentReforge:model},getSocketGemStats:()=>[]};
const bonus=vm.runInNewContext(bonusSource+';getEquipmentBonus',context);
assert.equal(bonus('fire').attack,113);
context.characterEquipment.fire.hand=null;assert.equal(bonus('fire').attack,0);
context.characterEquipment.fire.hand=JSON.parse(JSON.stringify(four));assert.equal(bonus('fire').attack,113);
console.log('PASS reforge V2 deterministic slots, migration, duplicates, locks, six equal stat intervals, 10% peak boundary, five uniform nonpeak intervals, all material tiers and combat owner');

const hydrateSource=mainSource.slice(mainSource.indexOf('function hydrateEquipmentReforge('),mainSource.indexOf('/* =====================================================',mainSource.indexOf('function normalizeEquipmentSlots(')));
const hydrateContext={window:{FourSymbolsEquipmentReforge:model},isEquipmentInventoryType:t=>['weapon','armor','head','shoulder','shoes','ring'].includes(t),migrateLegacyEquipmentStats:i=>i,console};
const normalize=vm.runInNewContext(hydrateSource+';normalizeEquipmentSlots',hydrateContext);
const worn={weapon:{type:'weapon',rarityKey:'purple',stats:{attack:7},reforgeStats:{attack:18}}};normalize(worn);
assert.equal(worn.hand.reforgeAffixes.length,2);assert.equal(worn.hand.reforgeAffixes[1],null);
const wornRaw=JSON.stringify(worn);normalize(worn);assert.equal(JSON.stringify(worn),wornRaw);
assert.doesNotMatch(mainSource.slice(mainSource.indexOf('function migrateLegacyEquipmentStats('),mainSource.indexOf('function hydrateEquipmentReforge(')),/EquipmentReforge/,'render-time legacy normalizer does not migrate reforge slots');

for(const [rarity,count] of Object.entries(model.SLOTS)){
 const legacy={type:'armor',rarityKey:rarity,reforgeSlots:9,reforgeStats:{attack:18}};
 model.migrateItem(legacy);assert.equal(legacy.reforgeSlots,count,'known rarity replaces obsolete empty/attempt capacity');
}
