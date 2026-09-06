"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const eq=fs.readFileSync("js/equipment-progression.js","utf8");
const synthesis=fs.readFileSync("js/36-v141-content-systems.js","utf8");
const loader=fs.readFileSync("js/20-anonymous-20.js","utf8");
const index=fs.readFileSync("index.html","utf8");

[
  ["ironSword","assets/equipment/warrior/weapon-01.png"],
  ["woodStaff","assets/equipment/mage/weapon-01.png"],
  ["leatherHelmet","assets/equipment/warrior/head-01.png"],
  ["leatherArmor","assets/equipment/warrior/armor-01.png"],
  ["leatherShoes","assets/equipment/warrior/shoes-01.png"]
].forEach(([id,path])=>{
  assert.ok(eq.includes(id+':{path:"'+path+'"'),id+" starter art mapping missing");
});
assert.ok(eq.includes('powerRing:{ring:true}'));
assert.match(eq,/function repairLegacyStarterEquipmentIcons\(\)/);
assert.match(eq,/item\.icon=spec\.ring\?legacyStarterRingMarkup\(\):artMarkup\(spec\.path,"white"\)/);
assert.match(eq,/item\.rarityKey="white"/);
assert.match(eq,/item\.quality="white"/);
assert.match(eq,/item\.reforgeSlots=0/);
assert.match(eq,/repairLegacyStarterEquipmentIcons\(\);\n\s*syncMainCharacterEquipmentStorage\(\)/);

assert.match(synthesis,/function canActuallyReforge\(item\)/);
assert.match(synthesis,/item\.v17351Locked!==true/);
assert.match(synthesis,/reforgeSlotCount\(item\)>0/);
assert.match(synthesis,/isEquipmentInventoryType\(item\.type\)&&canActuallyReforge\(item\)/);
assert.match(synthesis,/if\(item&&canActuallyReforge\(item\)\)\{ results\.push\(\{item,source:"已裝備"\}\); \}/);

assert.match(loader,/const V_ASSET_VERSION="173\.60"/);
assert.match(index,/<title>四象江湖傳 V173\.60<\/title>/);
console.log("✓ V173.60 starter equipment icons and reforge eligibility filter");
