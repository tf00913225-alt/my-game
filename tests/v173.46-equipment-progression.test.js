"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");

const source=fs.readFileSync("js/equipment-progression.js","utf8");
const ui=fs.readFileSync("js/51-v169-rpg-ui.js","utf8");

assert.match(ui,/js\/equipment-progression\.js\?v=173\.50/);
assert.match(source,/\{key:"white",label:"白裝",chance:40,min:1,max:3,reforgeSlots:0/);
assert.match(source,/\{key:"blue",label:"藍裝",chance:40,min:4,max:6,reforgeSlots:0/);
assert.match(source,/\{key:"purple",label:"紫裝",chance:15,min:7,max:9,reforgeSlots:1/);
assert.match(source,/\{key:"orange",label:"橙裝",chance:5,min:10,max:12,reforgeSlots:1/);

assert.match(source,/blade:\{stats:\{attack:15,vitality:-2\}\}/);
assert.match(source,/fan:\{stats:\{intelligence:15,vitality:-2\}\}/);
assert.match(source,/heavyArmor:\{stats:\{attack:7,spirit:5\}\}/);
assert.match(source,/robe:\{stats:\{intelligence:7,spirit:5\}\}/);
assert.match(source,/boots:\{stats:\{attack:2,agility:13\}\}/);
assert.match(source,/shoes:\{stats:\{intelligence:2,agility:13\}\}/);
assert.match(source,/helm:\{stats:\{attack:15\}\}/);
assert.match(source,/crown:\{stats:\{intelligence:15\}\}/);
assert.match(source,/wristguard:\{stats:\{attack:15\}\}/);
assert.match(source,/focus:\{stats:\{intelligence:15\}\}/);
assert.match(source,/item\.quality="orange"/);
assert.match(source,/v17346-rarity-orange/);

assert.match(source,/reforgeSlots/);
assert.match(source,/reforgeUsed/);
assert.match(source,/\[可冶煉\]/);
assert.match(source,/remainingReforgeSlots\(item\)<=0/);
assert.match(source,/item\.reforgeUsed=Math\.min/);
assert.match(source,/merged\[key\]=\(Number\(merged\[key\]\)\|\|0\)\+\(Number\(value\)\|\|0\)/);
assert.match(source,/hasRecordedUse=Object\.prototype\.hasOwnProperty\.call\(item,"reforgeUsed"\)/);
assert.match(source,/item\.reforgeStats&&Object\.keys\(item\.reforgeStats\)\.length\?1:0/);

assert.match(source,/shoulder:\{label:"護腕",warrior:\["vitality","attack"\],mage:\["vitality","intelligence"\]\}/);
assert.match(source,/head:\{label:"頭盔",warrior:\["vitality","attack","agility"\],mage:\["vitality","intelligence","agility"\]\}/);
assert.match(source,/weapon:\{label:"武器",warrior:\["attack"\],mage:\["intelligence"\]\}/);

assert.match(source,/currentShopOffers\(\)[\s\S]*?generateEquipment\(seededRandom/);
assert.match(source,/window\.v17346BuyEquipmentShopOffer/);
assert.match(source,/window\.v148BuildDailyDungeonWaves\("gold"\)/);
assert.match(source,/window\.v17346BeginEquipmentDungeon=beginEquipmentDungeon/);
assert.doesNotMatch(source,/window\.v132BeginEquipmentDungeon=beginEquipmentDungeon/);
assert.match(source,/onclick="v17346BeginEquipmentDungeon\(\)"/);
assert.match(source,/const count=6\*Math\.max\(1/);
assert.match(source,/inventoryItems\.length\+pendingEquipmentRewards\.length>120/);
assert.match(source,/看廣告雙倍為12件裝備/);
assert.match(source,/白裝40%・藍裝40%・紫裝15%・橙裝5%/);
assert.match(source,/dungeon-equipment-v17346\.png/);

assert.match(source,/v17346-potion-detail/);
assert.match(source,/\.item-modal-buttons\{margin-top:0!important\}/);
assert.match(source,/v17346-preview-modal/);
assert.match(source,/\.v132-preview-list-scroll\{flex:1 1 auto!important/);

const assetPaths=[
 "assets/equipment/warrior/bracer-01.png","assets/equipment/warrior/head-01.png","assets/equipment/warrior/armor-01.png","assets/equipment/warrior/shoes-01.png","assets/equipment/warrior/weapon-01.png",
 "assets/equipment/mage/bracer-01.png","assets/equipment/mage/head-01.png","assets/equipment/mage/armor-01.png","assets/equipment/mage/shoes-01.png","assets/equipment/mage/weapon-01.png",
 "assets/ui/dungeon-equipment-v17346.png"
];
assetPaths.forEach(file=>assert.equal(fs.existsSync(file),true,file));

console.log("V173.46 equipment progression specification checks passed");
