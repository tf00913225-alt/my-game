"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");

const main=fs.readFileSync("js/00-main.js","utf8");
const equipment=fs.readFileSync("js/equipment-progression.js","utf8");
const qol=fs.readFileSync("js/53-v173.50-inventory-qol.js","utf8");
const battle=fs.readFileSync("js/54-v173.51-battle-qa.js","utf8");
const animation=fs.readFileSync("js/39-v143-skill-animation.js","utf8");
const loader=fs.readFileSync("js/20-anonymous-20.js","utf8");
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

assert.match(main,/id:"ironSword"[\s\S]*?stats:\{\s*attack:3\s*\}/);
assert.match(main,/id:"woodStaff"[\s\S]*?stats:\{\s*intelligence:3\s*\}/);
assert.match(main,/id:"leatherHelmet"[\s\S]*?stats:\{\s*vitality:1\s*\}/);
assert.match(main,/id:"leatherArmor"[\s\S]*?stats:\{\s*vitality:2\s*\}/);
assert.match(main,/id:"leatherShoes"[\s\S]*?stats:\{\s*agility:2\s*\}/);
assert.doesNotMatch(main,/id:"woodStaff"[\s\S]{0,220}intelligence:12/);
assert.doesNotMatch(main,/id:"leatherArmor"[\s\S]{0,240}defense:10/);
assert.match(equipment,/const STARTER_WHITE_STATS=\{[\s\S]*?ironSword:\{attack:3\}[\s\S]*?woodStaff:\{intelligence:3\}[\s\S]*?leatherArmor:\{vitality:2\}/);
assert.match(equipment,/Object\.values\(characterEquipment\)[\s\S]*?repairStarterWhiteStats\(item\)/);

assert.match(battle,/const open=!inBattle\(\)&&!!\(tab&&visible\(tab\)&&\(!shell\|\|visible\(shell\)\)\);/);
assert.match(animation,/stage\.className="v143-skill-stage";[\s\S]*?stage\.style\.visibility="visible";/);

assert.ok(loader.includes('const V_ASSET_VERSION="173.62";'));
assert.ok(index.includes('<title>四象江湖傳 V173.62</title>'));
console.log("✓ V173.62 inventory / patrol VFX / starter gear regressions");
