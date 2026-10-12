"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");

const source=fs.readFileSync("js/equipment-progression.js","utf8");
const ui=fs.readFileSync("js/51-v169-rpg-ui.js","utf8");
const build=fs.readFileSync("scripts/build-production.mjs","utf8");

assert.match(build,/"js\/51-v169-rpg-ui\.js"[\s\S]*?"js\/equipment-progression\.js"/);
assert.doesNotMatch(ui,/createElement\(["']script["']\)|equipment-progression\.js\?v=/);
/* Ordinary equipment/shop odds remain unchanged; chest odds are independent. */
assert.match(source,/\{key:"white",label:"白階",min:5,max:10,reforgeSlots:1/);
assert.match(source,/\{key:"blue",label:"藍階",min:11,max:16,reforgeSlots:1/);
assert.match(source,/\{key:"purple",label:"紫階",min:17,max:22,reforgeSlots:2/);
assert.match(source,/\{key:"orange",label:"橙階",min:23,max:28,reforgeSlots:2/);

assert.match(source,/window\.v132NormalizeEquipmentSetItem\(item\)/);
assert.doesNotMatch(source,/const SET_RULES=/,"late progression must not own another set stat table");
assert.doesNotMatch(source,/item\.quality="orange"/);
assert.match(fs.readFileSync("js/27-v132-content-expansion.js","utf8"),/item\.rarityKey="pink"/);
assert.match(source,/FourSymbolsItemSlot\.art/);

assert.match(source,/reforgeSlots/);
assert.match(fs.readFileSync("js/equipment-factory.js","utf8"),/reforgeUsed:0/);
assert.match(source,/\[可冶煉\]/);

assert.match(source,/shoulder:\{label:"護腕",warrior:\["vitality","attack","defensePoints"\],mage:\["vitality","intelligence","defensePoints"\]\}/);
assert.match(source,/head:\{label:"頭盔",warrior:\["vitality","attack","agility","defensePoints"\],mage:\["vitality","intelligence","agility","defensePoints"\]\}/);
assert.match(source,/weapon:\{label:"武器",warrior:\["attack"\],mage:\["intelligence"\]\}/);

assert.match(source,/currentShopOffers\(state=shopState\(\)\)[\s\S]*?seededRandom\(offerId\)/);
assert.match(source,/window\.v17346BuyEquipmentShopOffer/);
assert.match(source,/window\.v148BuildDailyDungeonWaves\("gold"\)/);
assert.match(source,/window\.v17346BeginEquipmentDungeon=beginEquipmentDungeon/);
assert.doesNotMatch(source,/window\.v132BeginEquipmentDungeon=beginEquipmentDungeon/);
assert.match(source,/onclick="v17346BeginEquipmentDungeon\(\)"/);

/* Equipment dungeon now grants real backpack chests; each chest opens into 3 gear. */
assert.match(source,/const EQUIPMENT_CHEST_DROP_TABLE=\[[\s\S]*?\{key:"white",label:"白階",chance:50\}[\s\S]*?\{key:"blue",label:"藍階",chance:35\}[\s\S]*?\{key:"purple",label:"紫階",chance:10\}[\s\S]*?\{key:"orange",label:"橙階",chance:5\}/);
assert.match(source,/id:"equipmentChest"[\s\S]*?name:"裝備寶箱"[\s\S]*?type:"chest"/);
assert.match(source,/return Array\.from\(\{length:3\},\(\)=>\{/);
assert.match(source,/generateEquipment\(random,\{rarity:rarity\.key\}\)/);
assert.match(source,/v132ConsumeStackItem\(EQUIPMENT_CHEST_DEFINITION\.id,1\)/);
assert.match(source,/rewards\.every\(item=>window\.v132AddItemToInventory\(item,1\)\)/);
assert.match(source,/const chestCount=2\*multiplier,fragmentCount=receipt\.count\*multiplier/);
assert.match(source,/showRewardedAd\(\(\)=>grant\(2\)/);
assert.match(source,/v132AddItemToInventory\(receipt\.fragment,fragmentCount\)&&saveGame\(\)===true/);
assert.match(source,/window\.v17346OpenEquipmentChest=openEquipmentChest/);
assert.match(source,/window\.v17346ShowEquipmentChestPreview=showEquipmentChestPreview/);
assert.doesNotMatch(source,/pendingEquipmentRewards|equipmentRewardItems/);
assert.match(source,/assets\/items\/chests\/dungeon-chest\.png/);
assert.match(source,/<section class="v17363-preview-group"><b>裝備寶箱<\/b><em>×2<\/em>/);
assert.match(source,/const odds=equipmentChestOddsText\("　・　"\)/);
assert.match(source,/dungeon-equipment-v17346\.png/);

assert.doesNotMatch(source,/v17346-potion-detail/);
assert.doesNotMatch(source,/#game-stage #itemModal[^\n]*height:auto!important/);
assert.match(fs.readFileSync("js/00-main.js","utf8"),/setItemModalPresentationMode\(isEquipment\?"equipment":"compact"\)/);
assert.match(source,/v17346-preview-modal/);
assert.match(source,/\.v132-preview-list-scroll\{flex:1 1 auto!important/);

const assetPaths=[
 "assets/equipment/warrior/bracer-01.png","assets/equipment/warrior/head-01.png","assets/equipment/warrior/armor-01.png","assets/equipment/warrior/shoes-01.png","assets/equipment/warrior/weapon-01.png",
 "assets/equipment/mage/bracer-01.png","assets/equipment/mage/head-01.png","assets/equipment/mage/armor-01.png","assets/equipment/mage/shoes-01.png","assets/equipment/mage/weapon-01.png",
 "assets/ui/dungeon-equipment-v17346.png"
];
assetPaths.forEach(file=>assert.equal(fs.existsSync(file),true,file));

console.log("V173.46 equipment progression specification checks passed");

// V173.62: reforgeSlots are affix-slot capacity; attempts are unlimited.
assert.match(source,/window\.FourSymbolsReforge\.slotCount\(item\)/);
assert.doesNotMatch(source,/item\.reforgeUsed=Math\.min/);

const rarityContext={window:{}};require("node:vm").runInNewContext(require("../.github/scripts/fixtures/item-slot-owner.cjs"),rarityContext);
for(const [rarityKey,color] of Object.entries({white:"#D8D8D8",blue:"#42A5FF",purple:"#B05CFF",orange:"#FF9F38",pink:"#FF4FA7","four-symbol":"#E5C06B"})){
 assert.equal(rarityContext.window.getEquipmentNameColor({rarityKey,setId:"setFire",name:"赤炎四象",icon:"orange.png"}),color,"name color must use explicit rarity only");
}
assert.equal(rarityContext.window.FourSymbolsItemSlot.name("補品",{type:"potion",rarityKey:"orange"}),"補品","non-equipment names retain their original presentation");
