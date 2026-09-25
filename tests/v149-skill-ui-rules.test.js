"use strict";

/* V149 owns follow-up/presentation compatibility only.  V173.64 is the sole
   player Skill Data Owner, including all values shown by the Skill UI. */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const source=fs.readFileSync("js/43-v149-skill-ui-rules.js","utf8");
const progression=fs.readFileSync("js/60-v173.64-skill-progression-rebalance.js","utf8");
let passed=0;
function test(name,handler){ handler(); passed++; console.log("✓ "+name); }

function load(overrides={}){
    const context=Object.assign({
        window:null,console,Math,Number,Object,Array,Set,Map,Promise,
        skillDatabase:{flameSlash:{id:"flameSlash",element:"fire",spCost:10,baseDamage:30,maxLevel:10}},
        document:{getElementById(){return null;},querySelector(){return null;},querySelectorAll(){return [];},readyState:"complete"},
        setTimeout(callback){ callback(); return 1; },clearTimeout(){},requestAnimationFrame(callback){ return callback(); },
        finishPlayerAction(){},castDamageSkill(){},rollCritical(){ return {isCrit:false}; }
    },overrides);
    context.window=context;
    vm.createContext(context);
    vm.runInContext(source,context);
    return context;
}

test("V149 leaves canonical Skill Data unchanged",()=>{
    const context=load();
    assert.equal(context.skillDatabase.flameSlash.spCost,10);
    assert.equal(context.skillDatabase.flameSlash.baseDamage,30);
    assert.equal(context.skillDatabase.flameSlash.maxLevel,10);
    assert.doesNotMatch(source,/Object\.keys\(SKILLS\)\.forEach\(id=>patchSkill/);
    assert.match(source,/V173\.64 owns the player Skill Spec/);
    assert.doesNotMatch(source,/LEGACY_SKILL_SNAPSHOT|LEGACY_SKILL_CLEANUP_FIELDS/);
    assert.match(progression,/function applyFinalProgressionData\(\)/);
});

test("V149 preserves bounded free-follow-up orchestration without a second data table",()=>{
    assert.match(source,/function runPlayerFollowUp\(options,castNumber\)/);
    assert.match(source,/castNumber<numeric\(options\.skill\.followUpMaxCasts\)/);
    assert.match(source,/freeCast:freeCast===true/);
    assert.match(source,/withPlayerDirectSkillCast/);
    assert.doesNotMatch(source,/skill\.damageBonusPercent\s*=/);
});

test("V149 does not become a second Skill UI projection owner",()=>{
    const context=load({
        getSkillPreviewSummary(){ return "formal-preview"; },
        getSkillEffectPreviewText(){ return "formal-effect"; },
        buildSkillLevelBreakdownHTML(){ return "formal-levels"; }
    });
    assert.equal(context.getSkillPreviewSummary(context.skillDatabase.flameSlash),"formal-preview");
    assert.equal(context.getSkillEffectPreviewText(context.skillDatabase.flameSlash,1),"formal-effect");
    assert.equal(context.buildSkillLevelBreakdownHTML(context.skillDatabase.flameSlash),"formal-levels");
    assert.match(progression,/getSkillEffectPreviewText=function/);
    assert.match(progression,/buildSkillLevelBreakdownHTML=function/);
});

console.log("\nV149 compatibility suite: "+passed+" tests passed.");
