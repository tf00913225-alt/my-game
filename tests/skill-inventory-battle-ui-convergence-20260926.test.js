"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const read=file=>fs.readFileSync(file,"utf8");

const html=read("index.html");
const main=read("js/00-main.js");
const progression=read("js/60-v173.64-skill-progression-rebalance.js");
const context=read("js/42-v148-combat-dungeon-fixes.js");
const mainCss=read("css/00-main.css");
const inventoryCss=read("css/24-stage-v85-inventory-inner-grid-scroll-root.css");
const battleCss=read("css/fixed-slot-battlefield-rendering-v2.css");

assert.match(html,/id="skillElementTabs" class="skill-element-tabs"/);
assert.match(main,/SKILL_ELEMENT_TAB_META=Object.freeze\(\{[\s\S]*?learn:\{label:"學習技能"[\s\S]*?fire:[\s\S]*?water:[\s\S]*?wind:[\s\S]*?earth:/);
assert.match(main,/selectedSkillElementTab==="learn" \|\| skill.element===selectedSkillElementTab/);
assert.match(main,/const learnCost=getSkillLearnCostForUi\(skillOwner,skill\);/);
assert.match(main,/skill-row-cost.*學習需要/);
assert.match(progression,/window.v173GetInitialLearnCost=function\(character,skill\)/);
assert.match(context,/const mapWasActive=!!\(mapPage&&mapPage.classList/);
assert.doesNotMatch(context,/if\(dungeonActive\|\|!gameplayPageId\)\{ return openMapInventoryOverlay\(\); \}/);
assert.match(mainCss,/\.skill-element-tab\.learn\{[\s\S]*?\.skill-element-tab\.earth/);
assert.match(inventoryCss,/app\.inventory-overlay-open[\s\S]*?display:none !important/);
assert.match(inventoryCss,/app\.on-inventory-page \.content\{[\s\S]*?bottom:0 !important/);
assert.match(battleCss,/skill-quick-button \.sq-name\{[\s\S]*?display:block !important/);
assert.match(battleCss,/skill-quick-button \.v135-sq-scope\{[\s\S]*?display:block !important/);

console.log("Skill, inventory and battle UI convergence checks passed");
