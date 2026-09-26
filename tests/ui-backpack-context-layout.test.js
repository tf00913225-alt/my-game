"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");

const main=fs.readFileSync("js/00-main.js","utf8");
const shared=fs.readFileSync("css/49-v169-rpg-ui.css","utf8");
const core=fs.readFileSync("css/24-stage-v85-inventory-inner-grid-scroll-root.css","utf8");
const legacyMain=fs.readFileSync("css/00-main.css","utf8");

assert.match(main,/function openInventoryContext\(context\)[\s\S]*?showPage\("inventory"\)/);
assert.match(main,/function openMapInventoryOverlay\(context\)[\s\S]*?return openInventoryContext\(context\)/);
assert.doesNotMatch(main,/mapInventoryOverlayOpen=true/);
assert.doesNotMatch(main,/map-inventory-overlay-open/);
assert.doesNotMatch(shared,/map-inventory-overlay-open/);
assert.doesNotMatch(legacyMain,/map-inventory-overlay-open\{/);
assert.match(shared,/#game-stage #app\.on-inventory-page #inventoryPage\.inventory-page-classic \.inventory-classic-shell\{[\s\S]*?width:calc\(100% - var\(--ui-large-panel-safe-space\)\) !important;[\s\S]*?max-width:var\(--ui-large-panel-max-width\) !important;/);
assert.match(core,/\.inventory-grid-scroll\{[\s\S]*?overflow-y:auto !important/);
assert.match(main,/sourcePage===\"map\"&&typeof leaveMap===\"function\"/);
assert.match(main,/gameplayPage.*boss.*towerPage/);
assert.match(main,/const pageMap=\{[\s\S]*gameplayPage:\"gameplay\"[\s\S]*bossPage:\"boss\"[\s\S]*towerPage:\"tower\"/);

console.log("✓ Inventory contexts use the canonical page presentation; only return context differs");
