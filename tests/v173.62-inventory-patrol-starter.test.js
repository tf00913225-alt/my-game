"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const releaseMeta=JSON.parse(fs.readFileSync("release/release.json","utf8"));

const main=fs.readFileSync("js/00-main.js","utf8");
const equipment=fs.readFileSync("js/equipment-progression.js","utf8");
const qol=fs.readFileSync("js/53-v173.50-inventory-qol.js","utf8");
const battle=fs.readFileSync("js/54-v173.51-battle-qa.js","utf8");
const animation=fs.readFileSync("js/39-v143-skill-animation.js","utf8");
const loader=fs.readFileSync("js/20-anonymous-20.js","utf8")+fs.readFileSync("scripts/build-production.mjs","utf8");
const index=fs.readFileSync("index.html","utf8");

assert.match(main,/const INVENTORY_MAX_STACK_DEFAULT=999;/);
assert.match(qol,/const V17362_STACK_LIMIT=999;/);
assert.match(qol,/window\.v17362NormalizeInventoryStacksAndOrder=normalizeInventoryStacksAndOrder/);
assert.match(qol,/if\(isInventoryEquipment\(item\)\)[\s\S]*?item\.count=1/);
assert.match(qol,/entry\.total\+=Math\.max\(1,Math\.floor\(Number\(item\.count\)\|\|1\)\)/);
assert.match(qol,/Math\.min\(V17362_STACK_LIMIT,remaining\)/);
assert.match(qol,/const qualityDiff=inventoryQualityRank\(b\)-inventoryQualityRank\(a\)/);
assert.match(qol,/item\.blueprintSlot[\s\S]*?material:blueprint/);
assert.match(qol,/\/\^ore\/i\.test\(id\)[\s\S]*?material:ore/);

const starterFactory=require('../js/equipment-factory');
assert.match(main,/FourSymbolsEquipmentFactory.starter\(id\)/);
for(const [id,expected] of Object.entries({ironSword:{attack:3},woodStaff:{intelligence:3},leatherHelmet:{vitality:1},leatherArmor:{vitality:2},leatherShoes:{agility:2}}))assert.deepEqual(starterFactory.starter(id).stats,expected);
assert.doesNotMatch(equipment,/repairStarterWhiteStats/);

assert.doesNotMatch(battle,/stage\.style\.visibility/);
assert.doesNotMatch(battle,/v17351-management-open.*toggle/);
assert.match(animation,/stage\.className="v143-skill-stage";[\s\S]*?stage\.style\.visibility="visible";/);

assert.ok(loader.includes('const V_ASSET_VERSION="'+releaseMeta.cacheVersion+'";'));
assert.ok(index.includes('<title>四象江湖傳 V'+releaseMeta.version+'</title>'));
console.log("✓ V173.62 inventory / patrol VFX / starter gear regressions");
