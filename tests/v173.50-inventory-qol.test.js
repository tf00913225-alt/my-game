"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");

const qol=fs.readFileSync("js/53-v173.50-inventory-qol.js","utf8");
const css=fs.readFileSync("css/52-v173.50-inventory-qol.css","utf8");
const recovery=fs.readFileSync("js/45-v154-dev-fixes.js","utf8");
const equipment=fs.readFileSync("js/equipment-progression.js","utf8");
const loader=fs.readFileSync("js/20-anonymous-20.js","utf8");
const ui=fs.readFileSync("js/51-v169-rpg-ui.js","utf8");
const index=fs.readFileSync("index.html","utf8");

assert.match(css,/\.v17342-element-box-use-notice\{[\s\S]*?font-size:27px !important/);
assert.match(qol,/window\.v17350BulkSellEquipment=async function/);
assert.match(qol,/QUALITY_ORDER=\["white","blue","purple","orange"\]/);
assert.match(qol,/summary\.hasOrangeOrAbove[\s\S]*?window\.rpgConfirm/);
assert.match(qol,/橙裝售出後無法復原/);
assert.match(qol,/id="v17350BulkSellQuality"/);
assert.match(qol,/window\.v17350RunBatchAction=async function/);
assert.match(qol,/id="v17350BatchQuantity"[\s\S]*?value="'\+descriptor\.total\+'"/);
assert.match(qol,/descriptor\.kind==="potion"/);
assert.match(qol,/descriptor\.kind==="chest"/);
assert.match(qol,/descriptor\.kind==="ticket"/);
assert.match(recovery,/window\.rpgAlert\([\s\S]*?title:"補品不足"[\s\S]*?confirmText:"知道了"/);
assert.doesNotMatch(recovery,/補品不足[\s\S]{0,180}setTimeout\(/);
assert.match(equipment,/css\/52-v173\.50-inventory-qol\.css\?v=173\.52/);
assert.match(equipment,/js\/53-v173\.50-inventory-qol\.js\?v=173\.52/);
assert.match(equipment,/script\.onload=function\(\)\{[\s\S]*?__v17351QaReady/);
assert.ok(loader.includes('const V_ASSET_VERSION="173.52";'));
assert.ok(ui.includes('js/equipment-progression.js?v=173.52'));
assert.ok(index.includes('<title>四象江湖傳 V173.52</title>'));

console.log("✓ V173.50 inventory QoL and persistent no-potion warning");
