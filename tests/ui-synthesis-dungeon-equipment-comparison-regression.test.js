"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const read=p=>fs.readFileSync(p,"utf8");
const reforgeCss=read("css/38-v141-system-expansion.css");
const touch=read("js/01-stage-v8-touch-lock.js");
const rewardCss=read("css/33-v132-content-expansion.css");
const inventory=read("js/55-v173.51-inventory-qa.js");
const compareCss=read("css/53-v173.51-qa.css");
const picker=read("js/38-v143-system-fixes.js");
const repairs=read("js/58-v173.63-functional-fixes.js");
const guide=read("UI_GUIDELINES.md");

assert.match(reforgeCss,/\.v17358-reforge-tiers\{[^}]*display:flex[^}]*overflow-x:auto[^}]*touch-action:pan-x/s);
assert.doesNotMatch(reforgeCss,/\.v17358-reforge-tiers\{[^}]*grid-template-columns:repeat\(2/s);
assert.match(touch,/\.v17358-reforge-tiers/);
assert.match(rewardCss,/\.v132-reward-modal \.v132-reward-modal-inner\.v17363-text-reward-preview\{[\s\S]*?height:min\(600px/);
assert.match(rewardCss,/\.v132-reward-modal \.v17363-preview-group p/);

assert.match(inventory,/weapon:"hand"/);
assert.match(inventory,/hand:"hand"/);
assert.doesNotMatch(inventory,/t==="hand"\?"shoulder"/);
assert.match(inventory,/裝備比較/);
assert.match(inventory,/未穿戴此部位裝備/);
assert.match(compareCss,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
assert.match(compareCss,/\.v17351-compare-back/);
assert.match(touch,/\.v17351-compare-stats/);

assert.match(picker,/function iconForPickerValue\(value\)[\s\S]*?item&&item\.assetPath[\s\S]*?v169-equipment-art/);
const renderStart=repairs.indexOf("function renderMaterialSynthesis()");
const renderEnd=repairs.indexOf("function materialFlow",renderStart);
assert.ok(renderStart>=0&&renderEnd>renderStart,"material synthesis render owner must exist");
const materialRender=repairs.slice(renderStart,renderEnd);
assert.doesNotMatch(materialRender,/<select\b/i);
assert.match(materialRender,/materialGameSelect\("oreTier"/);
assert.match(materialRender,/materialGameSelect\("blueprintSet"/);
assert.match(repairs,/\.v17363-game-select-menu/);
assert.match(repairs,/section>\.v169-item-art[\s\S]*?width:70px/);
assert.match(touch,/\.v17363-game-select-menu/);
assert.match(guide,/禁止直接顯示瀏覽器原生 `<select>` \/ `<option>`/);
const synthesisOwner=read("js/36-v141-content-systems.js");
assert.match(synthesisOwner,/ensureEquipmentUids\(\);[\s\S]*?window\.v141RenderSynthesis\(\)/);
assert.match(repairs,/window\.v141RenderSynthesis=function\(\)\{[\s\S]*?v17346SyncFourElementSets[\s\S]*?syncCanonicalItemArt\(\)[\s\S]*?originalRenderSynthesis\.apply[\s\S]*?repairSynthesisIcons\(\)/);

console.log("✓ synthesis, dungeon preview and equipment comparison UI regression batch");
