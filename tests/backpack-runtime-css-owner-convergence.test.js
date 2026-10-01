"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");
const css22=read("css/22-stage-v78-character-inventory-core.css");
const css23=read("css/23-stage-v77-inventory-detail-ui.css");
const css24=read("css/24-stage-v85-inventory-inner-grid-scroll-root.css");
const css31=read("css/31-v131-fix-batch.css");
const css38=read("css/38-v141-system-expansion.css");
const css50=read("css/50-v169-abyss-flow.css");
const css55=read("css/55-team-relic-system.css");
const equipmentProgression=read("js/equipment-progression.js");
const browser=read("tests/backpack-visual-composition-browser.test.js");

// Permanent gate: source ownership checks are paired with full production-stack browser QA.
assert.match(css22,/--inventory-equipment-slot-size/);
assert.match(css22,/--inventory-equipment-cell-height/);
assert.match(css22,/#game-stage #inventoryPage #inventoryCharacterDetailButton\{[^}]*width:28px[^}]*height:28px/);
assert.doesNotMatch(css23,/inventory-character-detail-button/);
assert.doesNotMatch(css31,/inventoryCharacterDetailButton/);
assert.doesNotMatch(css24,/102-SLOT|102-slot|exactly 102|no pagination|flex:1 1 auto !important/);
assert.match(css22,/#inventoryPage\{[^}]*height:100%;[^}]*overflow:hidden;/);
assert.doesNotMatch(css24,/inventory-classic-shell|inventory-right-panel/);
assert.match(css24,/inventoryGridScroll|inventory-grid-scroll/);
assert.match(css38,/inventory-backpack-rarity-neutral/);
assert.match(css50,/v169-item-art:not\(\.inventory-backpack-rarity-neutral\)/);
assert.match(read("js/58-v173.63-functional-fixes.js"),/v169-material-art:not\(\.inventory-backpack-rarity-neutral\)/);
assert.doesNotMatch(css22,/inventory-item-classic:before/);
assert.match(css22,/border:1px solid var\(--slot-rarity,var\(--bag-slot-border\)\)/);
for(const rarity of ["white","blue","purple","orange","pink","four-symbol"]){
    assert.doesNotMatch(css55,new RegExp(`#game-stage \\.rarity-${rarity}`),`Team Relic ${rarity} selector must not be global`);
    assert.match(css55,new RegExp(`team-relic-[^,{]+\\.rarity-${rarity}`),`Team Relic ${rarity} selector must carry Team Relic context`);
    assert.match(equipmentProgression,new RegExp(`\\.v17346-rarity-${rarity}\\:not\\(\\.inventory-backpack-rarity-neutral\\)`),`v17346 ${rarity} selector must exclude Backpack neutral art`);
}
assert.match(browser,/build\/asset-manifest\.json/);
assert.match(browser,/gameplay-core/);
assert.match(browser,/v169-item-art v169-equipment-art v169-rarity-orange v17346-rarity-orange inventory-backpack-rarity-neutral/);
assert.match(browser,/v169-item-art v169-material-art v169-rarity-blue inventory-backpack-rarity-neutral/);
assert.match(browser,/equipment-progression-style/);
assert.match(browser,/functional-material-style/);
assert.match(browser,/injectedRarityMatch/);
assert.match(browser,/inventory-equipment-slot-label/);
assert.match(browser,/inner artwork glow leaked/);
console.log("✓ Backpack Runtime CSS Owner convergence regression passed");
