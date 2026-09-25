"use strict";

/* V140 remains a battle-compatibility module. Player Skill Data is owned by
   V173.64, so no historical V140 table may mutate skillDatabase. */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const source=fs.readFileSync("js/33-v140-four-element-balance.js","utf8");
const progression=fs.readFileSync("js/60-v173.64-skill-progression-rebalance.js","utf8");
let passed=0;
function test(name,handler){ handler(); passed++; console.log("✓ "+name); }

function load(overrides={}){
    const context=Object.assign({
        window:null,console,Math,Number,Object,Array,Set,Map,Promise,
        skillDatabase:{
            fireRocket:{id:"fireRocket",baseDamage:22,damagePerLevel:4,description:"canonical"},
            frostPunch:{id:"frostPunch",lifestealPercentByLevel:[4,4,4,4,7]},
            barrier:{id:"barrier",duration:4,barrierBlockCountByLevel:[3,3,3,4,5]}
        },
        document:{getElementById(){return null;}},battleActive:true,
        rollCritical(){ return {isCrit:false,multiplier:1.5}; },
        getInventoryCharacterCriticalStats(){ return {}; },
        castDamageSkill(){},castSecondaryCharacterSkill(){},castPlayer2Skill(){},
        castBuffSkill(){},castHealSkill(){},processSingleMonsterAttack(){},tickStatusEffects(){},
        resolveQueuedPlayerAction(){},getPartyCharacterByIndex(){ return null; },
        getSkillLevel(){ return 0; },calculateStatusEffectChance(){ return 0; },
        getMainCharacterStats(){ return {}; },getPartyBattleStats(){ return {}; },
        getPlayer2BattleStats(){ return {}; },getActivePlayerCharacters(){ return []; }
    },overrides);
    context.window=context;
    vm.createContext(context);
    vm.runInContext(source,context);
    return context;
}

test("V140 does not overwrite the canonical player Skill Data",()=>{
    const context=load();
    assert.equal(context.skillDatabase.fireRocket.baseDamage,22);
    assert.equal(context.skillDatabase.fireRocket.damagePerLevel,4);
    assert.equal(context.skillDatabase.fireRocket.description,"canonical");
    assert.deepEqual(Array.from(context.skillDatabase.frostPunch.lifestealPercentByLevel),[4,4,4,4,7]);
    assert.doesNotMatch(source,/skill\.baseDamage\s*=baseDamage|skill\.lifestealPercentByLevel\s*=values/);
    assert.match(source,/Retired data writer\. V173\.64 owns player skill values/);
    assert.match(progression,/function applyFinalProgressionData\(\)/);
});

test("V140 has no second status or hit chance owner",()=>{
    const context=load();
    assert.equal(context.v140CalculateStatusEffectChance,undefined);
    assert.equal(context.v140GetHitChancePercent,undefined);
    assert.doesNotMatch(source,/calculateStatusEffectChance\s*=\s*function|rollHitChance\s*=\s*function/);
});

test("legacy Barrier compatibility never consumes a count or lets DoT bypass the duration barrier",()=>{
    const context=load({
        player:{id:"主角",activeBuffs:[{type:"barrier",turnsLeft:4}]},
        hasActiveBuff(character,type){ return character.activeBuffs.some(buff=>buff.type===type&&buff.turnsLeft>0); }
    });
    assert.equal(context.v140ConsumeDirectBarrier(context.player),true);
    assert.equal(context.player.activeBuffs[0].remainingBlocks,undefined);
    assert.doesNotMatch(source,/barrier\.turnsLeft\s*=\s*0|remainingBlocks\s*-=|remainingBlocks\s*=\s*Math\.max/);
    assert.doesNotMatch(source,/tickStatusEffects=function[\s\S]*?barrier/);
});

console.log("\nV140 compatibility suite: "+passed+" tests passed.");
