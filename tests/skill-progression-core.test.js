"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {createRules}=require("../functions/src/skill-progression-core");
const catalog={
    flameSlash:{id:"flameSlash",name:"火焰斬",element:"fire",category:"physical",learnLevel:1,learnCost:2,maxLevel:10},
    waterKnife:{id:"waterKnife",name:"水刀斬",element:"water",category:"physical",learnLevel:1,learnCost:2,maxLevel:10,requires:["iceSpin"]},
    rage:{id:"rage",name:"怒火",element:"fire",category:"buff",learnLevel:18,learnCost:10,maxLevel:5,requires:["flameSlash","fireRocket"]},
    fireEX:{id:"fireEX",name:"火元素EX",element:"fire",category:"passive",learnLevel:50,learnCost:20,maxLevel:1}
};
const rules=createRules(catalog,["flameSlash","waterKnife"]);
test("original normalized cost preserves coercion separately from the public initial multiplier",()=>{
    const character={element:"water",level:100,skillPoints:0};
    const huge={...catalog.flameSlash,learnCost:Number.MAX_VALUE};
    assert.equal(rules.getInitialLearnCost(character,huge),Infinity);
    assert.equal(rules.initialLearnCost({character},huge),0);
    assert.equal(rules.getSkillLearnEligibility(character,huge,{waterKnife:1}).learnCost,0);
    for(const learnCost of [null,undefined,"2.9",-1,NaN,Infinity,2.9]){
        const skill={...catalog.flameSlash,learnCost};
        const raw=rules.getInitialLearnCost(character,skill);
        assert.equal(rules.initialLearnCost({character},skill),Number.isFinite(raw)?Math.max(0,Math.floor(raw)):0);
    }
});
test("native prerequisites are OR; cross-learning requires native ownership, doubles only initial cost and excludes EX",()=>{
    const character={element:"fire",level:100,skillPoints:999};
    assert.equal(rules.getSkillLearnEligibility(character,catalog.waterKnife,{}).allowed,false);
    const cross=rules.getSkillLearnEligibility(character,catalog.waterKnife,{flameSlash:1});
    assert.equal(cross.allowed,true);assert.equal(cross.learnCost,4);assert.equal(cross.prerequisiteRequired,false);
    assert.equal(rules.getSkillLearnEligibility(character,catalog.rage,{flameSlash:1}).allowed,true);
    assert.equal(rules.getSkillLearnEligibility(character,catalog.rage,{}).allowed,false);
    assert.equal(rules.getSkillLearnEligibility({...character,element:"water"},catalog.fireEX,{waterKnife:1}).allowed,false);
    assert.equal(rules.getSkillLearnEligibility({...character,skillPoints:1},catalog.flameSlash,{}).allowed,false);
});
test("absolute damage and support upgrade gates, per-skill caps and one-point upgrades retain existing semantics",()=>{
    for(let target=2;target<=10;target++){
        const level=(target-1)*10;
        assert.equal(rules.getRequiredCharacterLevelForSkillLevel(catalog.flameSlash,target),level);
        assert.equal(rules.getSkillUpgradeEligibility({level:level-1,skillPoints:9},catalog.flameSlash,target-1).allowed,false);
        const next=rules.getSkillUpgradeEligibility({level,skillPoints:1},catalog.flameSlash,target-1);
        assert.equal(next.allowed,true);assert.equal(next.cost,1);
    }
    assert.equal(rules.getRequiredCharacterLevelForSkillLevel(catalog.rage,2),20);
    assert.equal(rules.getRequiredCharacterLevelForSkillLevel(catalog.rage,5),80);
    assert.equal(rules.getRequiredCharacterLevelForSkillLevel(catalog.fireEX,2),Infinity);
    assert.equal(rules.getSkillUpgradeEligibility({level:100,skillPoints:99},catalog.flameSlash,10).allowed,false);
    assert.equal(rules.getSkillUpgradeEligibility({level:100,skillPoints:99},catalog.flameSlash,0).allowed,false);
    assert.equal(rules.getSkillUpgradeEligibility({level:100,skillPoints:0},catalog.waterKnife,1).allowed,false);
});
