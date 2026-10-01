"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const cp=require("node:child_process");

const read=file=>fs.readFileSync(file,"utf8");
const index=read("index.html");
const build=read("scripts/build-production.mjs");
const main=read("js/00-main.js");
const comparison=read("js/55-v173.51-inventory-qa.js");
const equipment=read("js/equipment-progression.js");
const inventoryCss=read("css/22-stage-v78-character-inventory-core.css")+read("css/24-stage-v85-inventory-inner-grid-scroll-root.css");
const legacyDetailCss=read("css/23-stage-v77-inventory-detail-ui.css");
const legacyRewardCss=read("css/33-v132-content-expansion.css");
const frameCss=read("css/49-v169-rpg-ui.css");
const compareCss=read("css/53-v173.51-qa.css");

// Formal entry and production bundle must ship every canonical owner.
assert.match(index,/id="inventoryGridScroll" data-scroll-owner="y"/);
assert.match(index,/id="itemModalStats"[\s\S]*?data-scroll-owner="y"/);
for(const owner of [
    "css/22-stage-v78-character-inventory-core.css",
    "css/24-stage-v85-inventory-inner-grid-scroll-root.css",
    "css/49-v169-rpg-ui.css",
    "css/53-v173.51-qa.css",
    "js/equipment-progression.js",
    "js/55-v173.51-inventory-qa.js"
]){
    assert.ok(build.includes('"'+owner+'"'),owner+" must be included by the production builder");
}

// One explicit lifecycle state owns the item frame; incidental DOM must not infer it.
assert.match(main,/const ITEM_MODAL_PRESENTATION_MODES = new Set/);
assert.match(main,/modal\.dataset\.presentationMode=normalized/);
assert.match(main,/setItemModalPresentationMode\(isEquipment\?"equipment":"compact"\)/);
assert.match(main,/classList[\s\S]*?remove\("show"\);[\s\S]*?setItemModalPresentationMode\("closed"\)/);
assert.match(comparison,/setItemModalPresentationMode\("comparison"\)/);
assert.match(comparison,/closeItemModal=function\(\)\{clearEquipmentComparison\(\)/);
assert.doesNotMatch(legacyDetailCss,/:has\(#v17342InventoryPotionUse\)|:has\(#itemEquipButton:disabled\)/);

// Replaced geometry is deleted rather than hidden behind another late override.
assert.doesNotMatch(legacyRewardCss,/v17346-shop-preview-modal|height:400px|min-height:400px|max-height:400px/);
assert.doesNotMatch(equipment,/v17346-potion-detail|v17346-shop-preview-modal\{[^}]*width:|v17346-shop-preview-art\{[^}]*width:/);
assert.doesNotMatch(compareCss,/v17351-equipment-comparison \.item-modal-box|v17351-locked-equipment \.item-modal-box/);
assert.match(frameCss,/#itemModal \.item-modal-box\{[^}]*height:auto !important;[^}]*max-height:min\(/);
assert.match(frameCss,/#itemModal #itemModalIcon\{[^}]*aspect-ratio:1 !important/);
assert.match(frameCss,/#itemModal #itemModalIcon img,[\s\S]*?object-fit:contain !important/);
assert.match(compareCss,/\.v17351-compare-art\{[^}]*aspect-ratio:1!important;[^}]*flex:0 1 auto!important/);
assert.match(compareCss,/@media \(max-width:374px\)\{[\s\S]*?grid-template-columns:minmax\(0,1fr\)!important/);
assert.match(inventoryCss,/\.inventory-grid-scroll\{[^}]*flex:1 1 auto[^}]*overflow-y:auto/);
assert.doesNotMatch(inventoryCss,/\.inventory-grid-scroll\{[^}]*touch-action:none/);

// Real production index/loader/runtime geometry is a separate mandatory CI suite.
assert.doesNotMatch(inventoryCss,/margin:-12px|inventory-character-panel\{flex:0 1 auto/);
assert.match(inventoryCss,/--inventory-equipment-grid-gap:/);
assert.match(read(".github/workflows/ci.yml"),/node .github\/scripts\/run-responsive-item-browser-qa.mjs/);
console.log("Responsive item owner retirement contracts passed; browser verification is separate");
