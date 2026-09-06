const assert=require("node:assert/strict");
const fs=require("node:fs");

const css=fs.readFileSync("css/49-v169-rpg-ui.css","utf8");
const equip=fs.readFileSync("js/equipment-progression.js","utf8");
const loader=fs.readFileSync("js/20-anonymous-20.js","utf8");
const ui=fs.readFileSync("js/51-v169-rpg-ui.js","utf8");
const index=fs.readFileSync("index.html","utf8");

assert.match(css,/V173\.48 — PREMIUM ONE-SCREEN SHOP/);
assert.match(css,/#homeFeatureModal\.v131-shop-open #homeFeatureModalBody\{[\s\S]*?overflow:hidden !important;[\s\S]*?touch-action:none !important;/);
assert.match(css,/\.v17345-equipment-grid\{[\s\S]*?grid-template-rows:repeat\(3,minmax\(0,1fr\)\) !important;[\s\S]*?overflow:hidden !important;/);
assert.match(css,/\.v17346-shop-card \.v17346-shop-buy\{[\s\S]*?grid-column:1 \/ -1 !important;[\s\S]*?grid-row:5 !important;/);
assert.match(css,/\.v17346-shop-card \.v17346-reforge-mini\{[\s\S]*?grid-row:4 !important;/);
assert.match(css,/\.v17345-equipment-refresh\{[\s\S]*?grid-template-columns:minmax\(0,1fr\) 128px !important;[\s\S]*?height:58px !important;/);
assert.match(css,/\.shop-potion-list\{[\s\S]*?grid-template-rows:repeat\(3,minmax\(0,1fr\)\) !important;[\s\S]*?overflow:hidden !important;/);
assert.ok(equip.includes("前5次免費；第6～10次尚未開放。"));
assert.ok(loader.includes('const V_ASSET_VERSION="173.56";'));
assert.ok(ui.includes('js/equipment-progression.js?v=173.56'));
assert.ok(index.includes('<title>四象江湖傳 V173.56</title>'));
assert.ok(index.includes('>V173.56</div>'));
assert.ok(index.includes('js/20-anonymous-20.js?v=173.56'));

console.log("✓ V173.50 premium one-screen shop layout");
