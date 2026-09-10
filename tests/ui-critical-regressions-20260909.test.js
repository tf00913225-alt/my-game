"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const read=path=>fs.readFileSync(path,"utf8");

const bootstrap=read("js/23-v125-character-creation-bootstrap.js");
const layout=read("js/19-stage-v78-character-inventory-runtime.js");
const inventory=read("js/55-v173.51-inventory-qa.js");
const compareCss=read("css/53-v173.51-qa.css");
const guard=read("js/61-v174-ui-regression-guards.js");
const uiCss=read("css/56-v174-critical-ui-regressions.css");
const relicCss=read("css/55-team-relic-system.css");
const touch=read("js/01-stage-v8-touch-lock.js");

assert.match(bootstrap,/FourSymbolsAccountSave/);
assert.doesNotMatch(bootstrap,/battle_full_version_save_v5/);
assert.match(bootstrap,/readPersistedPrimaryCharacter/);
assert.match(bootstrap,/const persisted=readPersistedPrimaryCharacter\(\)/);
assert.match(bootstrap,/persisted\.state==="unsafe"/);
assert.match(bootstrap,/targetSlot===1&&persisted\.state==="occupied"/);
assert.match(bootstrap,/const id=String\(primary\.id\|\|""\)\.trim\(\);[\s\S]*?if\(id\)\{[\s\S]*?"occupied"/);
assert.match(bootstrap,/save-json-invalid/);
assert.match(bootstrap,/storage-unreadable/);
assert.match(bootstrap,/角色存檔保護/);
assert.doesNotMatch(bootstrap,/creation-native-active[\s\S]*classList\.add/);

assert.match(uiCss,/grid-template-columns:52% 48%/);
assert.match(uiCss,/\.creation-portrait-image\{[\s\S]*?bottom:0;[\s\S]*?width:100%;[\s\S]*?height:100%;[\s\S]*?object-fit:contain/);
assert.match(uiCss,/土剋水・水剋火・火剋風・風剋土/);
assert.match(uiCss,/#allElementSkillPreviewModal \.skill-preview-body::before/);

assert.match(inventory,/SLOT_STORAGE_ALIASES/);
assert.match(inventory,/shoulder:\["shoulder","wristguard"\]/);
assert.match(inventory,/armor:\["armor","robe"\]/);
assert.match(inventory,/shoes:\["shoes","boots"\]/);
assert.match(inventory,/selectedInventorySlot!==null/);
assert.match(inventory,/openEquippedItem=function\(\)[\s\S]*?clearEquipmentComparison\(\)/);
assert.match(compareCss,/v17351-equipment-comparison \.item-modal-box\{[^}]*height:auto!important/);
assert.match(compareCss,/\.v17351-compare-stats\{[^}]*max-height:190px!important/);

assert.match(guard,/compactSkillActionLabel/);
assert.match(guard,/Lv"\+match\[1\]\+" 解鎖/);
assert.match(guard,/text-shadow","none","important/);
assert.match(guard,/max-width","104px","important/);

assert.match(relicCss,/team-relic-modal \.home-feature-modal-box\.wide #homeFeatureModalBody\{[^}]*overflow-y:auto!important/);
assert.match(touch,/#homeFeatureModal\.team-relic-mode #homeFeatureModalBody, \.team-relic-tabs/);
assert.match(layout,/modal\.dataset\.v78CharacterLayoutActive="1"/);
assert.match(layout,/const characterRootMounted=!!root/);
assert.match(layout,/if\(!characterRootMounted\)\{[\s\S]*?releaseCharacterLayoutOwnership/);
assert.match(layout,/body\.style\.removeProperty\(property\)/);

console.log("✓ 2026-09-09 critical UI regression guards");
