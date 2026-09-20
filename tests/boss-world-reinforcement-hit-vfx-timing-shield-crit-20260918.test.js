"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const read=file=>fs.readFileSync(file,"utf8");
const core=read("js/00-main.js");
const boss=read("js/gameplay-boss-tower-system.js");
const slots=read("js/battlefield-slot-owner.js");
const presentation=read("js/54-v173.51-battle-qa.js");
const fixedCss=read("css/fixed-slot-battlefield-rendering-v2.css");
const bossCss=read("css/gameplay-boss-tower.css");
const vfx=read("js/39-v143-skill-animation.js");

assert.match(core,/const MANUAL_RESOLUTION_START_MS=250;/);
assert.match(core,/const POST_ACTION_DELAY_MS=1150;/);
assert.match(core,/if\(phase==="declare"\)[\s\S]*?return MANUAL_RESOLUTION_START_MS;/);
assert.match(core,/return Math\.max\(0,visualRemaining\)\+POST_ACTION_DELAY_MS;/);
assert.doesNotMatch(core,/__battleAdvanceDelayOverrideMs/);
assert.doesNotMatch(read("js/46-v155-dev-fixes.js"),/__battleAdvanceDelayOverrideMs/);
assert.doesNotMatch(core,/BATTLE_MIN_ACTION_INTERVAL_MS|BATTLE_SKILL_VFX_TAIL_MS|ROUND_HANDOFF_MS|ROUND_ANNOUNCE_LEAD_MS|getRoundHandoffDelay/);
assert.match(core,/const nextDelay=getBattleAdvanceDelay\("resolve"\);/);

assert.match(core,/function rollCritical\(character,category="physical",targetAntiCritPercent=0,target\)/);
assert.match(core,/target&&target\.vBossShield&&Number\(target\.vBossShield\.current\)>0[\s\S]*?isCrit:false,multiplier:1/);
assert.match(core,/getMonsterEffectiveAntiCrit\(monster\),\s*monster/g);

assert.match(boss,/Summoning is atomic/);
assert.match(boss,/removeMonsterFromEnemySlot/);
assert.match(boss,/getLastReinforcementProjection/);
assert.match(slots,/function removeMonsterFromSlot/);
assert.match(bossCss,/left:-2px !important;[\s\S]*?right:14px !important;/);
assert.match(bossCss,/left:14px !important;[\s\S]*?right:-2px !important;/);
assert.match(bossCss,/left:calc\(20% \+ 5px\);[\s\S]*?right:calc\(20% \+ 5px\)/);
assert.match(boss,/function retireBossObject[\s\S]*?releaseBossObjectSlot\(entry\.index,entry\.monster/);
assert.match(boss,/function spawnBossObject[\s\S]*?assignMonsterToEnemySlot\(snapshot,index,slot\)[\s\S]*?monsters\.push\(object\)/);

assert.match(vfx,/const initialSprite=!current\.firstVisibleFrameAt;/);
assert.match(vfx,/node\.dataset\.emission=initialSprite\?"initial":"late"/);
assert.match(vfx,/initialSprite\s*\?"0ms"/);
assert.match(vfx,/function beginVisualTimeline\(current\)[\s\S]*?restartVisualTimeline\(current\.duration\)/);

assert.doesNotMatch(presentation,/v174-hit-shake/);
assert.doesNotMatch(fixedCss,/v174-hit-shake/);
assert.doesNotMatch(fixedCss,/damage-popup\.hp-popup\{[\s\S]*?display:none/);
assert.doesNotMatch(core,/suppressEnemyHpPopup/);
assert.doesNotMatch(vfx,/red-hit|hit-overlay|damage-overlay/);

const rollStart=core.indexOf("function rollCritical(");
const rollEnd=core.indexOf("/*\n   通用傷害技能施放函式",rollStart);
assert.ok(rollStart>=0&&rollEnd>rollStart,"rollCritical extraction failed");
const critContext={
    Math:Object.assign(Object.create(Math),{random:()=>0}),Number,
    getCriticalStatPoints:()=>0,
    CRIT_CHANCE_MAX:100,CRIT_CHANCE_BASE:100,CRIT_CHANCE_PER_INTELLIGENCE_POINT:0,
    CRIT_CHANCE_PER_ATTACK_POINT:0,CRIT_MULTIPLIER_ATTRIBUTE_MAX:9,
    CRIT_MULTIPLIER_BASE:2,CRIT_MULTIPLIER_PER_INTELLIGENCE_POINT:0,
    CRIT_MULTIPLIER_PER_ATTACK_POINT:0,ANTI_CRIT_MAX_PERCENT:100,
    CRIT_CHANCE_MIN_AFTER_ANTI_CRIT:0,CRIT_MULTIPLIER_MAX:9,
    getLearnedElementEX:()=>null,
    battleStatisticsRecordCriticalByActor:()=>{}
};
vm.createContext(critContext);
vm.runInContext(core.slice(rollStart,rollEnd)+"this.rollCritical=rollCritical;",critContext);
const protectedBoss={vBossShield:{current:500}};
assert.deepEqual(JSON.parse(JSON.stringify(critContext.rollCritical({activeBuffs:[]},"physical",0,protectedBoss))),{isCrit:false,multiplier:1},"Shield packet must not roll a critical");
protectedBoss.vBossShield.current=0;
assert.equal(critContext.rollCritical({activeBuffs:[]},"physical",0,protectedBoss).isCrit,true,"next independent packet may roll after Shield breaks");

console.log("Boss world reinforcement, hit-feedback, timing and Shield critical regressions passed.");
