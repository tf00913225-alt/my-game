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
assert.match(main,/SKILL_ELEMENT_TAB_META=Object.freeze\(\{[\s\S]*?fire:[\s\S]*?water:[\s\S]*?wind:[\s\S]*?earth:/);
assert.doesNotMatch(main,/learn:\{label:"學習技能"/);
assert.doesNotMatch(main,/selectedSkillElementTab==="learn"/);
assert.match(main,/skill.element===selectedSkillElementTab/);
assert.match(main,/const eligibility=getSkillLearnEligibilityForUi\(skillOwner,skill,skillLevels\);/);
assert.doesNotMatch(main,/skill-row-cost|學習需要\"\+skill\.learnCost/);
assert.match(progression,/window.v173GetInitialLearnCost=function\(character,skill\)/);
assert.match(progression,/window.v173GetSkillLearnEligibility=getSkillLearnEligibility/);
assert.match(progression,/prerequisiteRequired=!cross/);
assert.match(main,/getSkillLearnEligibilityForUi\(skillOwner,skill,skillLevels\)/);
assert.match(main,/skill-category-badge \$\{skill\.category\}/);
assert.doesNotMatch(main,/isSkillPrereqMet\(/);
assert.doesNotMatch(context,/openMapInventoryOverlay\(normalized\)/);
assert.doesNotMatch(context,/mapWasActive|mapPage\.classList\.add\("active"\)/);
assert.doesNotMatch(context,/if\(dungeonActive\|\|!gameplayPageId\)\{ return openMapInventoryOverlay\(\); \}/);
assert.match(mainCss,/grid-template-columns:repeat\(4,minmax\(0,1fr\)/);
assert.doesNotMatch(mainCss,/\.skill-element-tab\.learn\{/);
assert.doesNotMatch(mainCss,/skill-section-divider|skill-section-learned|skill-section-unlearned/);
assert.match(inventoryCss,/app\.inventory-overlay-open[\s\S]*?display:none !important/);
assert.match(inventoryCss,/app\.on-inventory-page \.content\{[\s\S]*?bottom:0 !important/);
assert.match(battleCss,/skill-quick-button \.sq-name\{[\s\S]*?display:block !important/);
assert.match(battleCss,/skill-quick-button \.v135-sq-scope\{[\s\S]*?display:block !important/);
assert.doesNotMatch(main,/sq-description|descriptionNode/);
assert.doesNotMatch(battleCss,/sq-description|top:-128px/);
assert.doesNotMatch(main,/class="sq-description"|\.sq-description/);
assert.doesNotMatch(fs.readFileSync("js/61-v174-ui-regression-guards.js","utf8"),/normalizeSkillActionCards/);
assert.doesNotMatch(fs.readFileSync("js/25-v131-fix-batch.js","utf8"),/decorateSkillRows|v131-skill-kind/);
assert.match(battleCss,/skill-quick-button\{[\s\S]*?height:100%/);

console.log("Skill, inventory and battle UI convergence checks passed");
