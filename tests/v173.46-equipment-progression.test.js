"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");

const source=fs.readFileSync("js/equipment-progression.js","utf8");
const ui=fs.readFileSync("js/51-v169-rpg-ui.js","utf8");

assert.match(ui,/js\/equipment-progression\.js\?v=173\.61/);
assert.match(source,/\{key:"white",label:"白階",chance:40,min:1,max:3,reforgeSlots:0/);
assert.match(source,/\{key:"blue",label:"藍階",chance:40,min:4,max:6,reforgeSlots:0/);
assert.match(source,/\{key:"purple",label:"紫階",chance:15,min:7,max:9,reforgeSlots:1/);
assert.match(source,/\{key:"orange",label:"橙階",chance:5,min:10,max:12,reforgeSlots:1/);

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
assert.match(source,/reforgeUsed=0/);
assert.match(source,/\[可冶煉\]/);

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
assert.match(source,/\["white","assets\/equipment\/warrior\/head-01\.png","40%"\]/);
assert.match(source,/\["blue","assets\/equipment\/warrior\/armor-01\.png","40%"\]/);
assert.match(source,/\["purple","assets\/equipment\/warrior\/shoes-01\.png","15%"\]/);
assert.match(source,/\["orange","assets\/equipment\/warrior\/weapon-01\.png","5%"\]/);
assert.match(source,/assets\/items\/chests\/dungeon-chest\.png/);
assert.match(source,/>×2<\/b>/);
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

// V173.61: reforgeSlots are affix-slot capacity; attempts are unlimited.
assert.match(source,/return Math\.max\(explicit,existing\)/);
assert.doesNotMatch(source,/item\.reforgeUsed=Math\.min/);
