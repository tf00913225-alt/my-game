"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const v131=fs.readFileSync("js/25-v131-fix-batch.js","utf8");
const economy=fs.readFileSync("js/28-v133-economy-rebalance.js","utf8");
const autoBattle=fs.readFileSync("js/31-v136-auto-battle-fix.js","utf8");
const v141=fs.readFileSync("js/35-v141-ui-battle.js","utf8");
const abyss=fs.readFileSync("js/36-v141-content-systems.js","utf8");
const homePolish=fs.readFileSync("js/41-v146-system-polish.js","utf8");
const dungeonPolish=fs.readFileSync("js/42-v148-combat-dungeon-fixes.js","utf8");
const recovery=fs.readFileSync("js/45-v154-dev-fixes.js","utf8");
const tuning=fs.readFileSync("js/47-v158-combat-tuning.js","utf8");
const settings=fs.readFileSync("js/49-v169-element-box-settings.js","utf8");
const waterRules=fs.readFileSync("js/50-v169-water-skill-rules.js","utf8");
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
assert.match(settingsCss,/body\.v162-element-box-settings-open #homeFeatureModalBody\{[\s\S]*overflow-y:auto !important;[\s\S]*touch-action:pan-y !important;[\s\S]*scrollbar-gutter:stable !important/);
assert.match(settingsCss,/body\.v162-element-box-settings-open #homeFeatureModal \.home-feature-modal-box\{[\s\S]*max-width:var\(--ui-medium-modal-max-width,360px\) !important;[\s\S]*height:min\(var\(--ui-medium-modal-height,540px\),calc\(100% - var\(--ui-medium-modal-safe-space,28px\)\)\) !important/);
assert.match(settingsCss,/body\.v162-element-box-settings-open #autoBattleSettingsPanel\.v131-element-box-panel\{[\s\S]*position:static !important;[\s\S]*padding:0 2px 24px !important;[\s\S]*overflow:visible !important/);
assert.match(settingsCss,/#autoBattleSettingsPanel\.v131-element-box-panel\.v17342-settings-locked #autoBattleButton\{[\s\S]*display:none !important/);
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

/* V173.43 daily-dungeon strength is dynamic, not the old 0.5 × 0.5 path. */
assert.match(tuning,/const partyMultiplier=partySize===1\?\.40:partySize===2\?\.72:1;/);
assert.match(tuning,/const levelMultiplier=highestLevel<=15\?\.80:highestLevel<=20\?\.90:highestLevel<=50\?1:1\.05;/);
assert.match(tuning,/function getDailyDungeonScaleContext\(\)/);
assert.match(tuning,/function normalizeDailyDungeonMonster\(monster\)/);
assert.match(tuning,/factor:partyMultiplier\*levelMultiplier/);
assert.match(tuning,/monster\.v141Abyss===true/);
assert.doesNotMatch(tuning,/v17342DailyDungeonStatsHalvedAgain/);
assert.match(tuning,/rollBeginnerForestNormalAttackDamage=function\(\)\{[\s\S]*return 5\+Math\.floor\(Math\.random\(\)\*4\)/);

/* Second / third character starts at Lv1; catch-up is EXP-only and ends at Lv20. */
assert.match(economy,/function getCharacterPartyIndex\(character\)/);
assert.match(economy,/function getAdditionalCharacterPoolMultiplier\(character,level\)/);
assert.match(economy,/if\(safeLevel>=20\)\{ return 1; \}/);
assert.match(economy,/if\(index===2\)\{ return 2\.00; \}/);
assert.match(economy,/if\(index===1\)\{ return 1\.50; \}/);
assert.match(economy,/function getDirectCatchUpExpMultiplier\(character\)/);
assert.match(economy,/if\(index===2\)\{ return 3; \}/);
assert.match(economy,/if\(index===1\)\{ return 2; \}/);
assert.doesNotMatch(economy,/function grantFastStartToAdditionalCharacter\(character,slotNumber\)/);
assert.doesNotMatch(economy,/啟用追趕養成，從 Lv\.10 開始冒險/);
assert.match(economy,/v173GrantCharacterCatchUpExp/);
assert.match(economy,/v173GetDirectCatchUpExpMultiplier/);

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

/* Red dots reuse the small breathing creation prompt and taps never flash blue. */
assert.match(homeCss,/#game-stage \*/);
assert.match(homeCss,/-webkit-tap-highlight-color:rgba\(0,0,0,0\) !important/);
assert.match(homeCss,/\.v141-notice-dot,[\s\S]*width:7px !important;[\s\S]*height:7px !important/);
assert.match(homeCss,/animation:v131RedDotPulse 1\.1s ease-in-out infinite alternate !important/);

/* Manual actions do not add a second empty wait after the turn declaration. */
assert.match(v131,/const elapsed=v131TurnStartedAt>0 \? \(Date\.now\(\)-v131TurnStartedAt\) : 0/);
assert.match(v131,/const wait=Math\.max\(0,V138_ACTION_DELAY_MS-elapsed\)/);

/* Auto targeting and tri-target geometry use the original full formation. */
assert.match(autoBattle,/v148GetAutoTargetPriority/);
assert.match(dungeonPolish,/function stableFormationRows\(indexes\)/);
assert.match(dungeonPolish,/function autoTargetPriority\(indexes\)/);
assert.match(dungeonPolish,/row\.slice\(Math\.max\(0,position-1\),Math\.min\(row\.length,position\+2\)\)/);
assert.match(dungeonPolish,/return selected\.filter\(index=>alive\.includes\(index\)\)/);

/* Daily content is one shared 3-wave × 6 structure: EXP / Material / Gold. */
assert.match(dungeonPolish,/DAILY_DUNGEON_META=\{/);
assert.match(dungeonPolish,/gold:\{title:"金幣副本"/);
assert.match(dungeonPolish,/\[1,2,3\]\.map\(wave=>buildDailyWave/);
assert.match(dungeonPolish,/for\(let slot=0;slot<6;slot\+\+\)/);
assert.match(dungeonPolish,/if\(soloProtected\)[\s\S]*wave===2[\s\S]*slot===4\?"elite":null/);
assert.match(dungeonPolish,/if\(wave===2\)\{ return slot>=4\?"elite":null; \}/);
assert.match(dungeonPolish,/if\(slot===4\)\{ return "boss"; \}/);
assert.match(dungeonPolish,/monster\.v141FormationRow=slot<3\?0:1/);
assert.match(dungeonPolish,/monster\.v141FormationPosition=slot%3/);
assert.match(dungeonPolish,/REFERENCE_TARGET_ORDER_6=\[4,1,3,6,2,5\]/);
assert.match(dungeonPolish,/REFERENCE_TARGET_ORDER_10=\[7,2,6,1,5,10,4,9,3,8\]/);
assert.match(dungeonPolish,/monster\.v148TargetOrder=REFERENCE_TARGET_ORDER_6\[slot\]/);
assert.match(dungeonPolish,/dailyDungeonSequence\.waveIndex<2/);
assert.match(dungeonPolish,/advanceDailyDungeonWave\(\)/);
assert.match(dungeonPolish,/function finishDailyExpReward\(amount\)[\s\S]*?sharedExp=Math\.max\(0,numeric\(sharedExp\)\+granted\)/);
assert.doesNotMatch(dungeonPolish,/請指定1名角色領取/);
assert.match(dungeonPolish,/v148ClaimDailyGoldReward/);
assert.match(dungeonPolish,/v132BeginEquipmentDungeon=function\(\)\{ return beginFormalDailyDungeon\("gold"\); \}/);
assert.match(dungeonPolish,/questRewardReady/);
assert.match(dungeonPolish,/progress&&state\.progress\[quest\.id\]/);

/* Water V173.43 values and Frostbite semantics. */
assert.match(waterRules,/waterKnife:\{[\s\S]*frostbiteChance:30,frostbiteDuration:1/);
assert.match(waterRules,/frostPunch:\{[\s\S]*frostbiteChance:35,frostbiteDuration:2/);
assert.match(waterRules,/iceSpin:\{[\s\S]*frostbiteChance:35,frostbiteDuration:2/);
assert.match(waterRules,/frostCrush:\{[\s\S]*frostbiteChance:45,frostbiteDuration:2/);
assert.match(waterRules,/iceArrowRain:\{[\s\S]*baseDamage:30,damagePerLevel:6[\s\S]*frostbiteChance:35,frostbiteDuration:2/);
assert.match(waterRules,/freeze:\{[\s\S]*learnCost:20[\s\S]*requires:\["frostPunch","floodBeast"\]/);
assert.match(waterRules,/healSpell:\{[\s\S]*learnCost:16[\s\S]*requires:\["frostPunch","floodBeast"\]/);
assert.match(waterRules,/revive:\{[\s\S]*learnCost:18/);
assert.match(waterRules,/purifyMind:\{[\s\S]*learnCost:1[\s\S]*spCost:22[\s\S]*removeAllStates:true/);
assert.match(waterRules,/FROSTBITE_REMAINING_RATE=\.75/);
assert.match(waterRules,/previousTryMonsterSpecialAction/);
assert.match(waterRules,/frostbitePenaltyPercent:25/);

assert.match(dungeonPolish,/\["主城","assets\/ui\/nav-home\.png","showPage\('home'\)"\]/);
assert.doesNotMatch(dungeonPolish,/\["返回","assets\/ui\/map-return\.png"/);
assert.match(dungeonPolish,/topReturn\.setAttribute\("aria-label","返回上一層"\)/);
assert.match(dungeonPolish,/nav\.dataset\.v146Columns="5"/);

assert.match(homeCss,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
assert.match(creationCss,/creation-stat-details\[open\] \.creation-stat-details-body\{[\s\S]*font-size:32px/);
assert.match(questCss,/quest-milestone\.reached:not\(\.claimed\) \.quest-milestone-slot::after/);
assert.match(questCss,/quest-milestone:not\(\.reached\)[\s\S]*opacity:\.5 !important/);
assert.match(questCss,/quest-milestone\.claimed[\s\S]*opacity:\.5 !important/);

assert.match(abyssCss,/home-background-v17344\.png/);
assert.match(abyssCss,/gold-v17344\.png/);
assert.match(abyssCss,/abyss-cover-v17343\.png/);
[
    "assets/ui/home-background-v17344.png",
    "assets/ui/home-character.png",
    "assets/dungeons/covers/equipment-v17343.png",
    "assets/dungeons/abyss/abyss-cover-v17343.png",
    "assets/dungeons/covers/gold-v17344.png",
    "assets/dungeons/abyss/maps/floor-5.png",
    "assets/maps/zone10-v17344.png"
].forEach(path=>assert.equal(fs.existsSync(path),true,path+" must exist"));

console.log("✓ V173.43 player flow / daily dungeons / catch-up / Water regression passed");
