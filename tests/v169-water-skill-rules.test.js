"use strict";

/* V169 is a Water-runtime compatibility layer. V173.64 is the only player
   Skill Data Owner; this test protects that boundary as well as Frostbite. */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const source=fs.readFileSync("js/50-v169-water-skill-rules.js","utf8");
const progression=fs.readFileSync("js/60-v173.64-skill-progression-rebalance.js","utf8");
let passed=0;
function test(name,handler){ handler(); passed++; console.log("✓ "+name); }

function load(overrides={}){
    const skills={
        waterKnife:{id:"waterKnife",element:"water",learnCost:999,frostbiteChance:66},
        unrelated:{id:"unrelated",freezeChance:73}
    };
    const context=Object.assign({
        window:null,console,Math:Object.create(Math),Number,Object,Array,Set,Map,Promise,
        skillDatabase:skills,monsters:[],document:{getElementById(){return null;},querySelector(){return null;},querySelectorAll(){return [];}}
    },overrides);
    context.window=context;
    vm.createContext(context);
    vm.runInContext(source,context);
    return context;
}

test("V169 no longer mutates the player Skill Database",()=>{
    const context=load();
    assert.equal(context.skillDatabase.waterKnife.learnCost,999);
    assert.equal(context.skillDatabase.waterKnife.frostbiteChance,66);
    assert.equal(context.skillDatabase.unrelated.freezeChance,73);
    assert.equal(context.v169WaterSkillRules.skillIds.length,12);
    assert.doesNotMatch(source,/Object\.keys\(finalData\)\.forEach/);
    assert.match(source,/V173\.64 is the sole author of player skill fields/);
    assert.match(progression,/function applyFinalProgressionData\(\)/);
});

test("Frostbite remains a soft runtime debuff with the final 30 percent damage penalty",()=>{
    const frostbitten={name:"測試",statusEffects:[{type:"frostbite",turnsLeft:2}]};
    let specials=0;
    const context=load({
        player:frostbitten,activeBattleCharacterIndex:0,getPartyCharacterByIndex:()=>frostbitten,
        v141TryMonsterSpecialAction(){ specials++; return true; },
        prepareAction(){ return "skill-ok"; }, processSingleMonsterAttack(){ return "monster-skill-ok"; },
        getOutgoingDamageDownPercent(){ return 0; }, getMonsterEvasion(){ return 40; },
        getMonsterEffectiveSpiritPoints(){ return 80; }, getPlayerStatusResistBonus(){ return 20; },
        getFinalBattleSpiritForPlayerTarget(){ return 100; }
    });
    assert.equal(context.v141TryMonsterSpecialAction(0),true);
    assert.equal(specials,1);
    assert.equal(context.prepareAction("waterKnife"),"skill-ok");
    assert.equal(context.processSingleMonsterAttack(0),"monster-skill-ok");
    assert.equal(context.getOutgoingDamageDownPercent(frostbitten),30);
    assert.equal(context.getMonsterEvasion(frostbitten),40);
    assert.equal(context.getMonsterEffectiveSpiritPoints(frostbitten),80);
    assert.equal(context.getPlayerStatusResistBonus(frostbitten),20);
    assert.equal(context.getFinalBattleSpiritForPlayerTarget(frostbitten),100);
    assert.equal(context.v169WaterSkillRules.frostbitePenaltyPercent,30);
});

test("Water UI descriptions are left to the formal progression owner",()=>{
    const context=load({
        getSkillPreviewSummary(){ return "legacy-summary"; },
        getSkillEffectPreviewText(){ return "legacy-effect"; },
        buildSkillLevelBreakdownHTML(){ return "legacy-levels"; }
    });
    assert.equal(context.getSkillPreviewSummary(context.skillDatabase.waterKnife),"legacy-summary");
    assert.equal(context.getSkillEffectPreviewText(context.skillDatabase.waterKnife,1),"legacy-effect");
    assert.equal(context.buildSkillLevelBreakdownHTML(context.skillDatabase.waterKnife),"legacy-levels");
    assert.doesNotMatch(source,/getSkillPreviewSummary\s*=|getSkillEffectPreviewText\s*=|buildSkillLevelBreakdownHTML\s*=/);
    assert.match(progression,/window\.getSkillPreviewSummary=function/);
});

console.log("\nV169 Water runtime compatibility suite: "+passed+" tests passed.");
