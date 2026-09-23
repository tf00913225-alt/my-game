"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const read=file=>fs.readFileSync(file,"utf8");
const main=read("js/00-main.js");
const progression=read("js/60-v173.64-skill-progression-rebalance.js");
const support=read("js/42-v148-combat-dungeon-fixes.js");
const abyss=read("js/46-v155-dev-fixes.js");
const freezeOwner=read("js/47-v158-combat-tuning.js");
const water=read("js/50-v169-water-skill-rules.js");
const relic=read("js/60-team-relic-system.js");
const relicSummary=read("js/relic-summary-catalog.js");
const relicProgression=read("js/relic-progression-drop-system.js");
const build=read("scripts/build-production.mjs");
const manifest=JSON.parse(read("config/feature-manifest.json"));

function extractFunction(source,name){
  const start=source.indexOf("function "+name+"(");
  assert.ok(start>=0,"missing "+name);
  let brace=source.indexOf("{",start),depth=0,end=-1;
  for(let i=brace;i<source.length;i++){
    if(source[i]==="{") depth++;
    else if(source[i]==="}"){
      depth--;
      if(depth===0){ end=i+1;break; }
    }
  }
  assert.ok(end>start,"unterminated "+name);
  return source.slice(start,end);
}

test("canonical Lv10 damage curve uses formal rounding and exact breakthrough nodes",()=>{
  const fn=extractFunction(main,"getSkillDamageAtLevel");
  const context={result:null,Math,Number};
  vm.createContext(context);
  vm.runInContext(fn+"; result=[1,2,3,4,5,6,7,8,9,10].map(level=>getSkillDamageAtLevel({baseDamage:30,damagePerLevel:6},level));",context);
  assert.deepEqual(Array.from(context.result),[30,36,42,48,72,78,84,90,96,144]);
  assert.match(fn,/current===5\s*\|\|\s*current===10/);
  assert.match(fn,/Math\.round\(damage\*1\.5\)/);
  assert.match(main,/function calculateDamage[\s\S]*?return Math\.max\(1,Math\.round\(result\)\)/);
  assert.match(main,/function getSkillRawAttack[\s\S]*?getSkillDamageAtLevel\(skill,skillLevel\)/);
  assert.match(main,/function getSkillPowerAtLevel\(skill,level\)\{\s*return Number\(skill\.powerMultiplier\);\s*\}/);
  assert.doesNotMatch(main,/function getSkillPowerAtLevel[\s\S]{0,220}?powerPerLevel\*\(resolvedLevel-1\)/);
});

test("all 31 player direct-damage skills are Lv10 and every upgrade target costs one point",()=>{
  const ids=[
    "flameSlash","fireCritical","explosiveFlurry","dragonSlash","fireRocket","blazeSpell","flameTornado","phoenixCry",
    "waterKnife","frostPunch","iceSpin","frostCrush","waterBall","floodBeast","iceArrowRain",
    "stormFist","stormFlurry","windCrossSlash","dizzyFist","windSpell","stormCircle","windHowlLightning","stormRain",
    "stoneSlash","petrifyFist","stoneBreakSky","earthquakeCrush","stoneThrow","sandWind","flyingSandStrike","dustStorm"
  ];
  assert.equal(ids.length,31);
  ids.forEach(id=>assert.match(progression,new RegExp('"'+id+'"'),id));
  assert.match(progression,/PLAYER_DAMAGE_SKILL_ID_SET\.has\(skillId\)[\s\S]*?skill\.maxLevel=10/);
  assert.match(progression,/2:1,3:1,4:1,5:1,6:1,7:1,8:1,9:1,10:1/);
  assert.match(progression,/function getUpgradeCostForTargetLevel[\s\S]*?SKILL_UPGRADE_COST_BY_TARGET_LEVEL/);
  assert.doesNotMatch(progression,/\{2:1,3:2,4:3,5:4\}/);
});

test("support skill final arrays and runtime owners match the formal spec",()=>{
  [
    /FIRE_MOMENTUM_BY_LEVEL=Object\.freeze\(\[12,15,18,21,25\]\)/,
    /BLOOD_BURN_HP_COST_BY_LEVEL=Object\.freeze\(\[5,10,15,20,25\]\)/,
    /BLOOD_BURN_BY_LEVEL=Object\.freeze\(\[5,10,15,20,35\]\)/,
    /HEAL_HP_BY_LEVEL=Object\.freeze\(\[550,580,610,640,670\]\)/,
    /HEAL_SP_PERCENT_BY_LEVEL=Object\.freeze\(\[0,0,5,10,15\]\)/,
    /FREEZE_CHANCE_BY_LEVEL=Object\.freeze\(\[55,65,75,85,95\]\)/,
    /FREEZE_DURATION_BY_LEVEL=Object\.freeze\(\[3,3,3,4,5\]\)/,
    /PURIFY_TARGET_COUNT_BY_LEVEL=Object\.freeze\(\[1,1,3\]\)/,
    /STEALTH_DURATION_BY_LEVEL=Object\.freeze\(\[2,3,4\]\)/,
    /CALM_RESIST_BY_LEVEL=Object\.freeze\(\[25,35,45,55,65\]\)/,
    /CALM_ACCURACY_BY_LEVEL=Object\.freeze\(\[10,20,30,40,50\]\)/,
    /ROCK_WALL_BY_LEVEL=Object\.freeze\(\[15,20,25,30,35\]\)/,
    /EARTH_SHIELD_BY_LEVEL=Object\.freeze\(\[20,30,35,40,50\]\)/,
    /EARTH_SHIELD_DURATION_BY_LEVEL=Object\.freeze\(\[3,3,3,4,5\]\)/,
    /BARRIER_BLOCKS_BY_LEVEL=Object\.freeze\(\[3,3,3,4,5\]\)/,
    /BARRIER_DURATION_BY_LEVEL=Object\.freeze\(\[3,3,3,4,5\]\)/
  ].forEach(pattern=>assert.match(progression,pattern));
  assert.match(progression,/fireSoulResonance:[\s\S]*?spCost:45/);
  assert.match(progression,/bloodBurnArt:[\s\S]*?spCost:35/);
  assert.match(support,/spRestorePercentByLevel/);
  assert.match(support,/removeRemovableStatusEffects/);
  assert.match(support,/targetCountByLevel/);
  assert.match(freezeOwner,/freezeChanceByLevel/);
  assert.match(freezeOwner,/targetTypeAtMaxLevel/);
  assert.doesNotMatch(water,/withFinalFreezeTargets|wrapSecondaryFreeze/);
});

test("formal Heal and Purify runtime keeps robust fallbacks and the selected primary target",()=>{
  assert.match(support,/typeof calculateSPHealingAmount==="function"[\s\S]*?legacySpBase/);
  assert.match(support,/const selectedPrimary=targetSide==="monster"[\s\S]*?\?enemyIndex/);
  assert.match(support,/const primaryTarget=targets\.includes\(selectedPrimary\)\?selectedPrimary:targets\[0\]/);
  assert.match(support,/animateSupportCast\(state,characterIndex,skill,primaryTarget,targets,targetSide\)/);
});

test("Lv5 resonance extension and three-cast Blood Burn exclude free follow-ups",()=>{
  assert.match(progression,/maxExtensionRounds:3,maxExtensionsPerRound:1/);
  assert.match(progression,/lastExtendedRound/);
  assert.match(progression,/extensionCount/);
  assert.match(progression,/if\(succeeded&&!freeCast\)/);
  assert.match(progression,/const bloodBonus=!freeCast&&blood/);
  assert.match(progression,/remainingFireActions:3/);
  assert.match(progression,/blood\.remainingFireActions=Math\.max\(0/);
});

test("enemy Rock Wall shares tri-target owner and formal level data",()=>{
  assert.match(abyss,/function resolveRockWall[\s\S]*?const targets=allyTriTargets\(monsterIndex\)/);
  assert.match(abyss,/defenseBonusPercentByLevel/);
  assert.match(abyss,/同排最多/);
  assert.doesNotMatch(abyss,/function resolveRockWall[\s\S]{0,700}?const targets=currentAbyssEntries\(\)/);
  const v144=read("js/40-v144-rules-and-abyss.js");
  assert.match(v144,/rockWall[\s\S]*?targetType:"allyTri"/);
  assert.doesNotMatch(v144,/rockWall[\s\S]{0,220}?targetType:"allyAll"/);
});

test("formal skill owner is part of gameplay-core and owns player-facing projections",()=>{
  assert.match(build,/gameplayScripts=\[[\s\S]*?"js\/60-v173\.64-skill-progression-rebalance\.js"/);
  assert.doesNotMatch(build,/const skillScripts=/);
  assert.equal(manifest.features.skill,"gameplay-core");
  assert.match(progression,/function descriptionFor\(skill\)/);
  assert.match(progression,/function levelBreakdownHtml\(skill\)/);
  assert.match(progression,/getSkillEffectPreviewText=function\(skill,level\)/);
  assert.match(progression,/buildSkillLevelBreakdownHTML=function\(skill\)/);
  assert.doesNotMatch(water,/buildWaterSkillLevelBreakdown|waterSupportEffectText/);
});

test("Team Relic runtime is guaranteed by gameplay-core, not a Boss-only side effect",()=>{
  assert.match(build,/gameplayScripts=\[[\s\S]*?"js\/60-v173\.64-skill-progression-rebalance\.js",[\s\S]*?"js\/60-team-relic-system\.js"/);
  assert.match(build,/gameplayStyles=\[[\s\S]*?"css\/55-team-relic-system\.css"/);
  assert.match(build,/const bossRelicScripts=\["js\/gameplay-boss-tower-system\.js"\]/);
  assert.doesNotMatch(build,/feature-relic-runtime|relicRuntime:target/);
  assert.equal(manifest.features.battle,"gameplay-core");
  ["feature-patrol","feature-abyss","feature-adventure","feature-boss-relic"].forEach(name=>
    assert.ok(manifest.bundles[name].dependencies.includes("gameplay-core"),name)
  );
});

test("10 runtime-ready relics retain one Trigger/Effect owner and 10 unopened relics are gated",()=>{
  const ready=(relic.match(/runtimeReady:true/g)||[]).length;
  const pending=(relic.match(/runtimeReady:false/g)||[]).length;
  assert.equal(ready,10);
  assert.equal(pending,10);
  assert.match(relic,/function dispatchRelicEvent\(event,payload\)/);
  assert.match(relic,/function resolveEffects\(triggerDef,def,payload\)/);
  assert.match(relic,/function equipRelic\(id\)[\s\S]*?def\.runtimeReady!==true/);
  assert.match(relic,/function normalizeLoadout\(raw\)[\s\S]*?def&&def\.runtimeReady===true\?id:null/);
  assert.match(relicProgression,/def\.runtimeReady!==true[\s\S]*?目前不可合成、裝備或強化/);
  assert.match(relic,/效果尚未覺醒/);
  assert.match(relic,/能力尚未開放/);
  assert.doesNotMatch(relic,/下一級提升效果數值/);
});

test("implemented relic descriptions expose real special cases without fake zero bonuses",()=>{
  assert.match(relicSummary,/寒泉玉珮","任一我方角色HP由35%以上降至35%以下時/);
  assert.match(relic,/HP由35%以上降至35%以下時觸發，每場最多2次，冷卻3回合/);
  assert.match(relic,/relic_nine_dragon_fire[\s\S]*?level>=20\?"，對燃燒目標額外\+15%"/);
  assert.match(relic,/relic_rock_mountain_seal[\s\S]*?Lv20護盾後準備一次18%秘寶威力反震/);
  assert.match(relic,/const bonus=Math\.round\(valueFor\(def,"burnBonus",level\)\*100\)/);
  assert.match(relic,/bonus>0\?"；燃燒目標額外\+"/);
});
