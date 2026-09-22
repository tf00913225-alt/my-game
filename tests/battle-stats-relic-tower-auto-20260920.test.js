"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const battle=fs.readFileSync("js/00-main.js","utf8");
const statsSource=fs.readFileSync("js/battle-statistics-system.js","utf8");
const statsCss=fs.readFileSync("css/battle-statistics-system.css","utf8");
const boss=fs.readFileSync("js/gameplay-boss-tower-system.js","utf8");
const bossCss=fs.readFileSync("css/gameplay-boss-tower.css","utf8");
const abyss=fs.readFileSync("js/59-abyss-two-tier-runtime.js","utf8");
const relic=fs.readFileSync("js/60-team-relic-system.js","utf8");
const relicCss=fs.readFileSync("css/55-team-relic-system.css","utf8");
const synthesis=fs.readFileSync("js/36-v141-content-systems.js","utf8");
const synthesisCss=fs.readFileSync("css/38-v141-system-expansion.css","utf8");
const abyssCss=fs.readFileSync("css/50-v169-abyss-flow.css","utf8");
const mainCss=fs.readFileSync("css/00-main.css","utf8");
const homeRosterCss=fs.readFileSync("css/19-stage-v54-main-city-moderate-native-scale.css","utf8");
const build=fs.readFileSync("scripts/build-production.mjs","utf8");

assert.match(build,/"js\/battle-statistics-system\.js"/,"Battle Statistics must be part of gameplay-core");
assert.match(build,/"css\/battle-statistics-system\.css"/,"Battle Statistics UI must be part of gameplay-core");

assert.match(statsSource,/new Set\(\["playerCharacter","heroNpc","reinforcement"\]\)/);
assert.doesNotMatch(statsSource,/skillCastCount|skillUseCount|skillCasts|技能施放次數/);
assert.match(statsSource,/damageDealt/);
assert.match(statsSource,/healingDone/);
assert.match(statsSource,/damageTaken/);
assert.match(statsSource,/criticalHits/);

const context={console,JSON,Math,Number,String,Boolean,Object,Array,Set,Map,RegExp,Error,TypeError};
context.window=context;
context.globalThis=context;
vm.createContext(context);
vm.runInContext(statsSource,context,{filename:"js/battle-statistics-system.js"});

const stats=context.FourSymbolsBattleStatistics;
assert.ok(stats,"Battle Statistics public owner must install");
stats.begin({
    battleToken:77,
    combatants:[
        {id:"player:0",kind:"playerCharacter",side:"ally",battleIndex:0,name:"玩家"},
        {id:"hero:jade",kind:"heroNpc",side:"ally",battleIndex:3,name:"玉衡"},
        {id:"reinforce:1",kind:"reinforcement",side:"ally",battleIndex:4,name:"援軍"}
    ]
});
stats.recordDamage({sourceId:"player:0",amount:321});
stats.recordDamage({targetId:"player:0",amount:89});
stats.recordHealing({sourceId:"hero:jade",amount:45});
stats.recordCritical({id:"player:0"});
stats.recordCritical({id:"player:0"});
let snapshot=stats.getSnapshot();
assert.equal(snapshot.combatants.length,3,"future Hero NPC and reinforcement share the same combatant-keyed session");
const player=snapshot.combatants.find(item=>item.id==="player:0");
const hero=snapshot.combatants.find(item=>item.id==="hero:jade");
assert.equal(player.damageDealt,321);
assert.equal(player.damageTaken,89);
assert.equal(player.criticalHits,2);
assert.equal(hero.healingDone,45);
stats.finish({result:"win"});
snapshot=stats.getFinalSnapshot();
assert.equal(snapshot.result,"win");
assert.equal(snapshot.combatants.find(item=>item.id==="player:0").damageDealt,321,"final result reuses the same accumulated snapshot");

assert.match(battle,/showAutoBattleRoundPrompt\(token\)/);
assert.match(battle,/battleRoundPromptTimeoutId=setTimeout\([\s\S]*?\},500\)/);
assert.match(battle,/acquirePresentationLock\("auto-round-prompt"\)/);
assert.doesNotMatch(statsSource,/acquireDrawerPause|acquirePauseLock|battle-insight-drawer[\s\S]*acquirePresentationLock/,"battle insight drawers must never pause combat");
assert.match(battle,/battleResolutionResumeToken/);
assert.match(battle,/battleAutoActionResume/);
assert.match(battle,/finishBattleStatisticsSession\("win"\)/);
assert.match(battle,/finishBattleStatisticsSession\("lose"\)/);
assert.match(statsCss,/\.battle-stats-edge-button[\s\S]*left:0/);
assert.match(statsCss,/\.battle-mechanism-alert[\s\S]*right:0/);
assert.match(statsCss,/@keyframes battleMechanismAlertPulse/);
assert.match(statsCss,/\.battle-stats-drawer\{left:0;transform:translateX\(-102%\)/);
assert.match(statsCss,/\.battle-boss-mechanism-drawer\{right:0;transform:translateX\(102%\)/);
assert.doesNotMatch(
    statsSource,
    /className="battle-insight-scrim"|scrim=document\.createElement|ui\.scrim\.classList\.add/,
    "non-blocking drawers must not install or open a full-screen scrim"
);
assert.match(
    statsSource,
    /staleScrim=document\.getElementById\("battleInsightScrim"\)[\s\S]*?staleScrim\.remove\(\)/,
    "legacy scrim cleanup may remain only to remove stale DOM from an older runtime"
);
assert.match(statsSource,/function installStatsEdgeDrag\(edge,root\)/);
assert.match(statsCss,/\.battle-stats-edge-button[\s\S]*touch-action:none/);
assert.match(statsCss,/\.battle-insight-drawer\{[\s\S]*z-index:220/);
assert.match(statsCss,/#battlePage\.v-fixed-slot-render-v2 \.battle-center-region\{[\s\S]*z-index:80/);
assert.match(statsCss,/\.battle-statistics-result-panel\{[\s\S]*width:min\(900px,calc\(100% - 24px\)\)/);
assert.match(statsCss,/\.battle-statistics-result-panel \.battle-stat-grid b\{font-size:22px/);

assert.match(boss,/function bossMechanismInspectorCards\(\)/);
assert.match(boss,/getActiveMechanisms:function\(\)/);
assert.match(boss,/stats\.setBossMechanisms\(bossMechanismInspectorCards\(\)\)/);
assert.match(boss,/showBossBattleResult\(/);
assert.match(abyss,/title:"深淵・戰鬥詳細結算"/);
assert.match(abyss,/onClose:finish/);

assert.match(boss,/class="tower-auto-advance"/);
assert.match(boss,/vGameplayToggleTowerAutoAdvance/);
assert.match(boss,/towerAutoAdvanceCountdown=3/);
assert.match(boss,/towerAutoAdvanceCountdown--/);
assert.match(boss,/towerAutoAdvanceTimeoutId=setTimeout\(tick,1000\)/);
assert.doesNotMatch(boss,/towerAutoAdvance[^\n]*setInterval|setInterval[^\n]*towerAutoAdvance/);
assert.match(boss,/else\{[\s\S]*?cancelTowerAutoAdvance\(true\);[\s\S]*?\}[\s\S]*?if\(!won\)\{ return; \}/,"Tower loss must cancel auto-advance before returning");
assert.match(boss,/state\.tower\.completedFloor>=TOWER_FLOORS/);
assert.match(bossCss,/\.tower-auto-advance/);
assert.match(bossCss,/\.tower-auto-countdown/);

assert.doesNotMatch(relic,/DEV 已配裝|DEV 正式功能配裝|DEV 僅演出配裝|DEV 狀態|Presentation Only|Runtime Ready/);
assert.doesNotMatch(relic,/devPreviewRelicId/,"formal equip must not keep a DEV-only loadout mirror");
assert.match(relic,/function effectiveLoadoutRelicId\(\)\{[\s\S]*?return teamLoadout\.relicId;/);
assert.match(relic,/teamLoadout\.relicId=id;[\s\S]*?saveRelics\(\);[\s\S]*?syncHomeRelicUi\(\)/);
assert.match(relicCss,/\.team-relic-card \.team-relic-equip/);
assert.doesNotMatch(relicCss,/team-relic-card-dev|team-relic-dev-equip/);

assert.match(synthesis,/class="v141-talisman-source" aria-label="合成材料"/);
assert.match(synthesis,/class="v141-talisman-target" aria-label="合成目標"/);
assert.match(synthesisCss,/#homeFeatureModal\.v141-synthesis-modal \.v141-upgrade-flow \.v169-talisman-art\{[\s\S]*?width:92px;[\s\S]*?height:138px;[\s\S]*?overflow:hidden/);
assert.match(synthesisCss,/#homeFeatureModal\.v141-synthesis-modal \.v141-upgrade-flow \.v169-talisman-art > img\{[\s\S]*?object-fit:contain/);
assert.doesNotMatch(abyssCss,/#homeFeatureModal\.v141-synthesis-modal \.v141-upgrade-flow \.v169-talisman-art/);

assert.match(mainCss,/#homePage\{[\s\S]*?height:100%;[\s\S]*?overflow-y:auto;[\s\S]*?scroll-padding-bottom:calc\(var\(--bottom-nav-height,70px\) \+ var\(--safe-bottom,0px\) \+ 14px\)/);
assert.match(homeRosterCss,/\.v146-home-roster\{[\s\S]*?margin:18px 10px calc\(var\(--bottom-nav-height,70px\) \+ var\(--safe-bottom,0px\) \+ 12px\)/,"final team/relic block must reserve exactly the fixed nav and safe area");

console.log("Battle statistics / relic / talisman / Boss / Tower focused contracts passed");
