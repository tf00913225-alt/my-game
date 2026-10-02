"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");

const main=fs.readFileSync("js/00-main.js","utf8");
const shared=fs.readFileSync("css/49-v169-rpg-ui.css","utf8");
const core=fs.readFileSync("css/24-stage-v85-inventory-inner-grid-scroll-root.css","utf8");
const visual=fs.readFileSync("css/22-stage-v78-character-inventory-core.css","utf8");
const legacyMain=fs.readFileSync("css/00-main.css","utf8");

assert.match(main,/function openInventoryContext\(context\)[\s\S]*?showPage\("inventory"\)/);
assert.match(main,/function openMapInventoryOverlay\(context\)[\s\S]*?return openInventoryContext\(context\)/);
assert.doesNotMatch(main,/mapInventoryOverlayOpen=true/);
assert.doesNotMatch(main,/map-inventory-overlay-open/);
assert.doesNotMatch(shared,/map-inventory-overlay-open/);
assert.doesNotMatch(legacyMain,/map-inventory-overlay-open\{/);
// The V177 backpack frame belongs to css/22 in every entry context.
assert.match(visual,/#game-stage #inventoryPage \.inventory-classic-shell\{[^}]*width:93\.4%;[^}]*height:100%;[^}]*overflow:hidden/);
assert.doesNotMatch(shared,/\.inventory-classic-shell\{/);
assert.match(core,/\.inventory-grid-scroll\{[\s\S]*?overflow-y:auto;[^}]*overflow-x:hidden;[^}]*touch-action:pan-y;[^}]*scrollbar-gutter:stable;/);
assert.match(main,/sourcePage===\"map\"&&typeof leaveMap===\"function\"/);
assert.match(main,/gameplayPage.*boss.*towerPage/);
assert.match(main,/const pageMap=\{[\s\S]*gameplayPage:\"gameplay\"[\s\S]*bossPage:\"boss\"[\s\S]*towerPage:\"tower\"/);

console.log("✓ Inventory contexts use the canonical page presentation; only return context differs");
