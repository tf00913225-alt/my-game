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
const navShell=fs.readFileSync("js/04-stage-v11-native-bottom-nav-runtime.js","utf8");
const recovery=fs.readFileSync("js/45-v154-dev-fixes.js","utf8");
const tuning=fs.readFileSync("js/47-v158-combat-tuning.js","utf8");
const settings=fs.readFileSync("js/49-v169-element-box-settings.js","utf8");
const waterRules=fs.readFileSync("js/60-v173.64-skill-progression-rebalance.js","utf8");
const frostbiteOwner=fs.readFileSync("js/50-v169-water-skill-rules.js","utf8");
const settingsCss=fs.readFileSync("css/48-v169-element-box-settings.css","utf8");
const index=fs.readFileSync("index.html","utf8");
const baseCss=fs.readFileSync("css/00-main.css","utf8");
const questCss=fs.readFileSync("css/25-stage-v90-quest-interface-core.css","utf8");
const creationCss=fs.readFileSync("css/29-v125-character-creation-native.css","utf8");
const homeCss=fs.readFileSync("css/42-v146-system-polish.css","utf8");
const homeRosterCss=fs.readFileSync("css/19-stage-v54-main-city-moderate-native-scale.css","utf8");
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
assert.match(index,/home-utility-actions team-relic-home-tools/);
assert.match(index,/team-relic-home-entry[^>]*data-feature="relic"/);
assert.match(index,/team-element-box-home-entry[^>]*data-feature="gameplay-core"/);
assert.match(baseCss,/grid-template-rows:repeat\(4,70px\)/);
assert.match(v131,/V17342_GLOBAL_EXP_REWARD_MULTIPLIER=3/);
assert.match(v131,/function getFormalMonsterBaseExp/);
assert.doesNotMatch(v131,/V131_EXP_MULTIPLIER/);
assert.match(v131,/V17342_GLOBAL_GOLD_REWARD_MULTIPLIER=5/);
assert.match(v131,/getBeginnerForestMonsterExpUnit/);
assert.match(v131,/beginnerMonsterUnits/);

// MonsterBalance owns Daily durability; retired V173 scaling must not return.
const {MonsterBalance,DAILY_PARTY_DURABILITY}=require("../js/combat/monster-balance-owner.mjs");
assert.deepEqual(DAILY_PARTY_DURABILITY,{1:.04,2:.08,3:.12});
const dailySpec={context:'ci/formal-daily',monsterKey:'daily.exp.regular',name:'修行弟子',element:'fire',rank:'regular',archetype:'balanced',level:50,mode:'daily',dailyType:'exp',wave:1,slot:0,highestPartyLevel:50,skillFrequency:.35};
const dailyParty=[1,2,3].map(partySize=>MonsterBalance.build({...dailySpec,partySize}));
assert.deepEqual(dailyParty.map(m=>m.balanceProjection.profiles.mode.partySizeDurability),[.04,.08,.12]);
for(const m of dailyParty){
  assert.equal(m.balanceOwner,'MonsterBalance');
  for(const key of ['attack','magicAttack','defense','maxSP','agility'])assert.equal(m[key],dailyParty[0][key]);
  assert.equal(m.v173DailyDungeonScaleFactor,undefined);
}
assert.doesNotMatch(tuning,/partyMultiplier|levelMultiplier|DAILY_DUNGEON_DIFFICULTY_MULTIPLIER|normalizeDailyDungeonMonster/);
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
assert.match(homePolish,/#bottomNav button\[aria-label='角色'\]/);
assert.match(homePolish,/clearLegacyHudExpAttention/);
assert.match(homePolish,/characterTabBtnExpPool/);
assert.match(homePolish,/characterTabBtnStatus/);
assert.match(homePolish,/characterTabBtnSkill/);
assert.match(homePolish,/v131-exp-preview-btn/);
assert.match(homePolish,/v131-exp-confirm/);
assert.match(homePolish,/confirmStatusButton/);
assert.match(core,/upgradeSkill\(/);
assert.match(homePolish,/card.dataset.skillAction===\"growth\"/);
assert.match(core,/equipSkill\(/);
assert.match(homePolish,/card.dataset.skillAction===\"equip\"/);
assert.match(homePolish,/skill-loadout-slot/);
assert.match(homePolish,/已學習但尚未裝備/);
assert.match(homePolish,/normalizeOrdinaryBlueprintItem/);
assert.match(homePolish,/delete item\.setId/);
assert.match(homePolish,/隨機普通裝備/);

/* Red dots use the shared coordinate-aware contract and taps never flash blue. */
assert.match(homeCss,/#game-stage \*/);
assert.match(homeCss,/-webkit-tap-highlight-color:rgba\(0,0,0,0\) !important/);
assert.doesNotMatch(homeCss,/\.v141-notice-dot,[\s\S]*width:7px !important/);
assert.match(fs.readFileSync("css/38-v141-system-expansion.css","utf8"),/animation:v141NoticePulse 1\.25s ease-in-out infinite/);
assert.match(fs.readFileSync("css/06-stage-v11-native-bottom-nav.css","utf8"),/#bottomNav > \.nav-button > \.v141-notice-dot\{[\s\S]*?width:22px;/);

/* Manual actions use one core delay owner extended only by visual remaining time. */
assert.match(core,/function getBattleAdvanceDelay\(phase\)/);
assert.match(core,/v142GetRemainingAnimationMs/);
assert.doesNotMatch(v131,/finishPlayerAction\s*=|processNextCombatant\s*=/);

/* Auto targeting and tri-target geometry use the original full formation. */
assert.match(autoBattle,/v148GetAutoTargetPriority/);
assert.match(dungeonPolish,/function stableFormationRows\(indexes\)/);
assert.match(dungeonPolish,/function autoTargetPriority\(indexes\)/);
assert.match(dungeonPolish,/owner\.resolveEnemyTargets\(snapshot,center,"tri",monsterAlive\)/);
assert.match(dungeonPolish,/return stableFormationRows\(ordered\)\.flatMap\(centerFirstOrder\)\.filter\(monsterAlive\);/);

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

/* Final Skill Data replaces V169 data patches; outgoing Frostbite stays at its compatibility owner. */
assert.match(waterRules,/waterKnife:\{[^}]*frostbiteChance:50,frostbiteDuration:3/);
assert.match(waterRules,/frostPunch:\{[^}]*frostbiteChance:40,frostbiteDuration:2/);
assert.match(waterRules,/iceSpin:\{[^}]*frostbiteChance:35,frostbiteDuration:2/);
assert.match(waterRules,/frostCrush:\{[^}]*frostbiteChance:45,frostbiteDuration:2/);
assert.match(waterRules,/iceArrowRain:\{[^}]*baseDamage:30,damagePerLevel:6[^}]*frostbiteChance:35,frostbiteDuration:2/);
assert.match(waterRules,/freeze:\{[^}]*learnLevel:25,learnCost:14[^}]*requires:\["iceSpin","iceArrowRain"\]/);
assert.match(waterRules,/healSpell:\{[^}]*learnLevel:15,learnCost:8[^}]*requires:\["frostPunch","floodBeast"\]/);
assert.match(waterRules,/revive:\{[^}]*learnLevel:20,learnCost:10/);
assert.match(waterRules,/purifyMind:\{[^}]*learnLevel:35,learnCost:18[^}]*spCost:22[^}]*removeAllStates:true/);
assert.match(frostbiteOwner,/FROSTBITE_REMAINING_RATE=\.70/);
assert.match(waterRules,/PLAYER_DAMAGE_SKILL_IDS/);
assert.match(frostbiteOwner,/frostbitePenaltyPercent:30/);
const vm=require("node:vm");
const frostbiteRuntime={window:null,getOutgoingDamageDownPercent:()=>0};
frostbiteRuntime.window=frostbiteRuntime;
vm.createContext(frostbiteRuntime);
vm.runInContext(frostbiteOwner,frostbiteRuntime);
assert.equal(frostbiteRuntime.getOutgoingDamageDownPercent({statusEffects:[{type:"frostbite",turnsLeft:2}]}),30);
assert.equal(frostbiteRuntime.getOutgoingDamageDownPercent({statusEffects:[{type:"frostbite",turnsLeft:0}]}),0);
assert.equal(frostbiteRuntime.getOutgoingDamageDownPercent({statusEffects:[]}),0);

assert.match(navShell,/\["秘寶","assets\/ui\/nav-relic-v175\.webp","v148OpenContextRelic\(\)"\]/);
assert.match(navShell,/\["元素匣","assets\/ui\/nav-element-box\.png","openHomeFeature\('autoBattleSettings'\)"\]/);
assert.match(navShell,/\["返回","assets\/ui\/map-return\.png"/);
assert.match(dungeonPolish,/topReturn\.setAttribute\("aria-label","返回上一層"\)/);
assert.match(navShell,/grid-template-columns|renderGameplayContext/);

assert.match(homeRosterCss,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
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
