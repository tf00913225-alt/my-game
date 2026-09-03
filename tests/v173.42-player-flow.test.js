"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const v131=fs.readFileSync("js/25-v131-fix-batch.js","utf8");
const v141=fs.readFileSync("js/35-v141-ui-battle.js","utf8");
const abyss=fs.readFileSync("js/36-v141-content-systems.js","utf8");
const homePolish=fs.readFileSync("js/41-v146-system-polish.js","utf8");
const dungeonPolish=fs.readFileSync("js/42-v148-combat-dungeon-fixes.js","utf8");
const recovery=fs.readFileSync("js/45-v154-dev-fixes.js","utf8");
const tuning=fs.readFileSync("js/47-v158-combat-tuning.js","utf8");
const settings=fs.readFileSync("js/49-v169-element-box-settings.js","utf8");
const settingsCss=fs.readFileSync("css/48-v169-element-box-settings.css","utf8");
const index=fs.readFileSync("index.html","utf8");
const baseCss=fs.readFileSync("css/00-main.css","utf8");
const questCss=fs.readFileSync("css/25-stage-v90-quest-interface-core.css","utf8");
const creationCss=fs.readFileSync("css/29-v125-character-creation-native.css","utf8");
const homeCss=fs.readFileSync("css/42-v146-system-polish.css","utf8");
const abyssCss=fs.readFileSync("css/46-v154-dev-fixes.css","utf8");
const core=fs.readFileSync("js/00-main.js","utf8");

assert.match(v141,/v17342UseInventoryPotion/);
assert.match(v141,/getBackpackCharacter\(inventoryCharacterIndex\)/);
assert.match(settings,/先停止元素匣，才能設定/);
assert.match(settings,/bindLockedInteractionGuard/);
assert.match(settings,/LOCKED_SETTING_SELECTOR/);
assert.doesNotMatch(settings,/if\(elementBoxIsActive\(\)\)\{ setTimeout\(notifyLocked,0\); \}/);
assert.match(settingsCss,/auto-premium-status\.v169-element-box-active[\s\S]*overflow:visible/);
assert.match(settingsCss,/body\.v162-element-box-settings-open #homeFeatureModal\{[\s\S]*overflow:hidden !important/);
assert.match(settingsCss,/#homeFeatureModalBody\{[\s\S]*overflow:hidden !important/);
assert.match(settingsCss,/#autoBattleSettingsPanel\.v131-element-box-panel\{[\s\S]*padding:0 1px 2px !important;[\s\S]*overflow:visible !important/);
assert.match(settingsCss,/pointer-events:none/);
assert.match(index,/v17342-element-box-shared/);
assert.match(recovery,/setInterval\(\(\)=>\{[\s\S]*isElementBoxRecoveryActive/);
assert.match(recovery,/v17342PendingBattleNotices/);
assert.match(recovery,/showElementBoxUseNotice/);
assert.match(abyssCss,/v17342-element-box-use-notice/);
assert.match(abyssCss,/overflow-y:auto !important/);
assert.match(core,/pendingElementBoxNotices/);
assert.match(abyss,/v17342-abyss-battle-info/);
assert.match(abyssCss,/aspect-ratio:9\/16/);
assert.match(v141,/hasExpLevelUp/);
assert.doesNotMatch(index,/home-utility-actions/);
assert.match(baseCss,/grid-template-rows:repeat\(4,82px\)/);
assert.match(v131,/V17342_GLOBAL_EXP_REWARD_MULTIPLIER=3/);
assert.match(v131,/V17342_GLOBAL_GOLD_REWARD_MULTIPLIER=5/);
assert.match(v131,/getBeginnerForestMonsterExpUnit/);
assert.match(v131,/beginnerMonsterUnits/);

assert.match(tuning,/V17342_HALF_MONSTER_FIELDS/);
assert.match(tuning,/v17342BeginnerStatsHalved/);
assert.match(tuning,/v17342DailyDungeonStatsHalved/);
assert.match(tuning,/v17342DailyDungeonStatsHalvedAgain/);
assert.match(tuning,/halveMonsterCoreStats\(monster,"v17342DailyDungeonStatsHalved"\);[\s\S]*halveMonsterCoreStats\(monster,"v17342DailyDungeonStatsHalvedAgain"\)/);
assert.match(tuning,/rollBeginnerForestNormalAttackDamage=function\(\)\{[\s\S]*return 5\+Math\.floor\(Math\.random\(\)\*4\)/);
assert.match(tuning,/if\(!isAbyss\)\{ roster\.forEach\(normalizeDailyDungeonMonster\); \}/);

assert.match(homePolish,/getCharacterGrowthAttention/);
assert.match(homePolish,/characterSkillAttention/);
assert.match(homePolish,/attributePoints/);
assert.match(homePolish,/skillPoints/);
assert.match(homePolish,/#mapPageNav button\[aria-label='角色'\]/);
assert.match(homePolish,/clearLegacyHudExpAttention/);
assert.match(homePolish,/characterTabBtnExpPool/);
assert.match(homePolish,/characterTabBtnStatus/);
assert.match(homePolish,/characterTabBtnSkill/);
assert.match(homePolish,/v131-exp-preview-btn/);
assert.match(homePolish,/v131-exp-confirm/);
assert.match(homePolish,/confirmStatusButton/);
assert.match(homePolish,/upgradeSkill\(/);
assert.match(homePolish,/equipSkill\(/);
assert.match(homePolish,/skill-loadout-slot/);
assert.match(homePolish,/已學習但尚未裝備/);
assert.match(homePolish,/normalizeOrdinaryBlueprintItem/);
assert.match(homePolish,/delete item\.setId/);
assert.match(homePolish,/隨機普通裝備/);

assert.match(dungeonPolish,/\["主城","assets\/ui\/nav-home\.png","showPage\('home'\)"\]/);
assert.doesNotMatch(dungeonPolish,/\["返回","assets\/ui\/map-return\.png"/);
assert.match(dungeonPolish,/topReturn\.setAttribute\("aria-label","返回上一層"\)/);
assert.match(dungeonPolish,/nav\.dataset\.v146Columns="5"/);

assert.match(homeCss,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
assert.match(creationCss,/creation-stat-details\[open\] \.creation-stat-details-body\{[\s\S]*font-size:32px/);
assert.match(questCss,/quest-milestone\.reached:not\(\.claimed\) \.quest-milestone-slot::after/);
assert.match(questCss,/quest-milestone:not\(\.reached\)[\s\S]*opacity:\.5 !important/);
assert.match(questCss,/quest-milestone\.claimed[\s\S]*opacity:\.5 !important/);

assert.match(abyssCss,/home-background-v17343\.png/);
assert.match(abyssCss,/equipment-v17343\.png/);
assert.match(abyssCss,/abyss-cover-v17343\.png/);
[
    "assets/ui/home-background-v17343.png",
    "assets/ui/home-character.png",
    "assets/dungeons/covers/equipment-v17343.png",
    "assets/dungeons/abyss/abyss-cover-v17343.png"
].forEach(path=>assert.equal(fs.existsSync(path),true,path+" must exist"));

console.log("✓ V173.42 player flow / economy / Element Box / current dev regression passed");
