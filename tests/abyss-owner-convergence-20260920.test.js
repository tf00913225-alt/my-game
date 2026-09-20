"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");

const roster=fs.readFileSync("js/59-abyss-two-tier-runtime.js","utf8");
const combat=fs.readFileSync("js/00-main.js","utf8");
const v141Core=fs.readFileSync("js/34-v141-core-systems.js","utf8");
const v141=fs.readFileSync("js/36-v141-content-systems.js","utf8");
const v144=fs.readFileSync("js/40-v144-rules-and-abyss.js","utf8");
const v154=fs.readFileSync("js/45-v154-dev-fixes.js","utf8");
const v155=fs.readFileSync("js/46-v155-dev-fixes.js","utf8");
const build=fs.readFileSync("scripts/build-production.mjs","utf8");
const registry=JSON.parse(fs.readFileSync("config/monster-portrait-registry.json","utf8"));

const emperorLoadouts=[
    ["東帝天尊",["dustStorm","flyingSandStrike"],["rockWall"]],
    ["天帝天尊",["windHowlLightning","stormRain"],["stealthSkill"]],
    ["極帝天尊",["flyingSandStrike","phoenixCry"],["yuanZuBlessing"]],
    ["北帝天尊",["iceArrowRain","iceSpin"],["healSpell"]],
    ["南帝天尊",["dragonSlash","phoenixCry"],["rage"]]
];

assert.equal((roster.match(/const FINAL_TRUE_REALM_LOADOUTS/g)||[]).length,1);
emperorLoadouts.forEach(([name,skills,supports])=>{
    assert.ok(roster.includes('"'+name+'":Object.freeze({'),`${name} must be declared once in the canonical loadout`);
    assert.ok(roster.includes('skills:Object.freeze('+JSON.stringify(skills)+'),supports:Object.freeze('+JSON.stringify(supports)+')'),`${name} skill/support IDs must remain canonical`);
});
assert.match(roster,/boss\.v141ForceSkillLevel=5/);
assert.match(roster,/elite\.v141ForceSkillLevel=5/);
assert.match(roster,/v174TrueRealmFinal=true/);

assert.match(v141Core,/v141TryMonsterSpecialAction\(monsterIndex,token\)/,"the single monster-turn wrapper must call the shared support dispatcher once");
assert.doesNotMatch(combat,/v141TryMonsterSpecialAction\(monsterIndex\)/,"the base attack function must not create a second dispatcher entry");
assert.match(v141,/forcedSupportSkillId[\s\S]*supportIds\.includes\(forcedSupportSkillId\)/);
assert.match(v155,/chooseFinalAbyssAction[\s\S]*monster\.skillIds/);
assert.match(v155,/v141SupportSkillIds\|\|\[\]\)\.indexOf\("rockWall"\)/);
assert.match(v155,/v141SupportSkillIds\|\|\[\]\)\.indexOf\("stealthSkill"\)/);
assert.match(v155,/v141SupportSkillIds\|\|\[\]\)\.indexOf\("revive"\)/);
assert.doesNotMatch(v144,/FINAL_BOSS_RULES|FINAL_ELITES|v144PatchFinalAbyssRoster|window\.v141TryMonsterSpecialAction=function/);
assert.doesNotMatch(v155,/FINAL_BOSS_RULES|FINAL_ELITE_RULES|v155PatchFinalAbyssRoster|v155FinalAbyss/);
assert.doesNotMatch(v155,/monster\.name!=="(東帝天尊|天帝天尊|北帝天尊|南帝天尊)"/);

const resolverSource=v154.slice(v154.indexOf("function resolveMonsterPortraitRecord"));
const resolverOrder=[
    "const dedicatedPath=",
    "const explicitKey=",
    "const byName=",
    "const legacy=",
    "const temporaryBoss="
].map(fragment=>resolverSource.indexOf(fragment));
assert.ok(resolverOrder.every(index=>index>=0));
assert.deepEqual(resolverOrder.slice().sort((a,b)=>a-b),resolverOrder,"portrait fallback must remain last");
assert.match(v154,/temporaryBoss\?TEMPORARY_BOSS_PORTRAIT:TEMPORARY_MONSTER_PORTRAIT/);

const finalRows=registry.groups["abyss-boss"].filter(row=>row[1].endsWith("天尊")&&row[6]==="existing");
assert.equal(finalRows.length,5);
assert.equal(new Set(finalRows.map(row=>row[5])).size,5);
finalRows.forEach(row=>assert.ok(fs.existsSync(row[5]),row[5]));
assert.ok(build.indexOf("js/59-abyss-two-tier-runtime.js")>build.indexOf("js/46-v155-dev-fixes.js"));
assert.doesNotMatch(build,/"js\/56-v173\.51-shop-qa\.js"/);

console.log("Abyss owner convergence and portrait priority guards passed");
