"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");

const qol=fs.readFileSync("js/53-v173.50-inventory-qol.js","utf8");
const css=fs.readFileSync("css/52-v173.50-inventory-qol.css","utf8");
const recovery=fs.readFileSync("js/45-v154-dev-fixes.js","utf8");
const equipment=fs.readFileSync("js/equipment-progression.js","utf8");
const loader=fs.readFileSync("js/20-anonymous-20.js","utf8")+fs.readFileSync("scripts/build-production.mjs","utf8");
const ui=fs.readFileSync("js/51-v169-rpg-ui.js","utf8");
const index=fs.readFileSync("index.html","utf8");
const build=fs.readFileSync("scripts/build-production.mjs","utf8");

assert.match(css,/\.v17342-element-box-use-notice\{[\s\S]*?font-size:27px !important/);
assert.match(qol,/window\.v17350BulkSellEquipment=async function/);
assert.match(qol,/QUALITY_ORDER=\["white","blue","purple","orange","pink","four-symbol"\]/);
assert.match(qol,/summary\.hasOrangeOrAbove[\s\S]*?window\.rpgConfirm/);
assert.match(qol,/高階裝備售出後無法復原/);
assert.match(qol,/id="v17350BulkSellQuality"/);
assert.match(qol,/window\.v17350RunBatchAction=async function/);
assert.match(qol,/id="v17350BatchQuantity"[\s\S]*?value="'\+descriptor\.total\+'"/);
assert.match(qol,/descriptor\.kind==="potion"/);
assert.match(qol,/descriptor\.kind==="chest"/);
assert.match(qol,/descriptor\.kind==="ticket"/);

/* 2026-09-08 regressions: legacy material ids must still collapse into one
   visible stack when they represent the same named material. */
assert.match(qol,/function inventoryStackIdentity\(item\)/);
assert.match(qol,/if\(type==="material"\)\{[\s\S]*?const name=String\(item\.name\|\|""\)\.trim\(\);[\s\S]*?return "material::name::"\+name;/);
assert.match(qol,/const stackKey=inventoryStackIdentity\(item\)/);

/* Quick-sell and batch actions keep the same black/gold readable button
   language instead of the former yellow background + black text treatment. */
assert.match(css,/\.v17350-bulk-sell-bar button\{[\s\S]*?color:#f4d793;[\s\S]*?background:linear-gradient\(180deg,#332414,#15100a\)/);
assert.match(css,/\.v17350-bulk-sell-bar button\.danger\{[\s\S]*?background:linear-gradient\(180deg,#8d3928,#4d1812\)/);
assert.match(css,/\.v17350-batch-action button\{[\s\S]*?color:#f4d793;[\s\S]*?background:linear-gradient\(180deg,#332414,#15100a\)/);

assert.match(recovery,/window\.rpgAlert\([\s\S]*?title:"補品不足"[\s\S]*?confirmText:"知道了"/);
assert.doesNotMatch(recovery,/補品不足[\s\S]{0,180}setTimeout\(/);
assert.match(build,/"css\/52-v173\.50-inventory-qol\.css"/);
assert.match(build,/"js\/equipment-progression\.js"[\s\S]*?"js\/53-v173\.50-inventory-qol\.js"/);
assert.doesNotMatch(equipment,/createElement\(["']script["']\)|script\.onload/);
assert.ok(loader.includes('const V_ASSET_VERSION="173.64";'));
assert.doesNotMatch(ui,/equipment-progression\.js\?v=|createElement\(["']script["']\)/);
assert.ok(index.includes('<title>四象江湖傳 V173.64</title>'));

console.log("✓ V173.50 inventory QoL and persistent no-potion warning");
