"use strict";

/* CURRENT WATER SPEC: V169 remains the authoritative Water owner and is kept
   aligned with the latest V173.43 design values. */

const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const source=fs.readFileSync("js/50-v169-water-skill-rules.js","utf8");

let passed=0;
function test(name,handler){
    handler();
    passed++;
    console.log("\u2713 "+name);
}

function clone(value){ return JSON.parse(JSON.stringify(value)); }

function staleSkills(){
    const common={
        element:"water",targetType:"tri",learnCost:999,maxLevel:9,upgradeCost:7,
        baseDamage:1,damagePerLevel:1,spCost:1,
        freezeChance:77,freezeDuration:7,freezeSingleTarget:false,
        teamFreezeChance:88,teamFreezeDuration:8,
        frostbiteChance:66,frostbiteDuration:6,
        lifestealPercentByLevel:[9,9,9,9,9],requires:["wrong"]
    };
    return {
        waterKnife:Object.assign({id:"waterKnife",name:"水刀斬",category:"physical"},clone(common)),
        frostPunch:Object.assign({id:"frostPunch",name:"冰霜拳",category:"physical"},clone(common)),
        iceSpin:Object.assign({id:"iceSpin",name:"冰旋一閃",category:"physical"},clone(common)),
        frostCrush:Object.assign({id:"frostCrush",name:"冰封重擊",category:"physical"},clone(common)),
        waterBall:Object.assign({id:"waterBall",name:"水球術",category:"magic"},clone(common)),
        floodBeast:Object.assign({id:"floodBeast",name:"洪水猛獸",category:"magic"},clone(common)),
        iceArrowRain:Object.assign({id:"iceArrowRain",name:"冰霜箭雨",category:"magic"},clone(common)),
        freeze:Object.assign({id:"freeze",name:"冰封",category:"magic"},clone(common)),
        healSpell:{id:"healSpell",name:"治療術",category:"heal",statusResistBonus:99},
        revive:{id:"revive",name:"復活術",category:"revive"},
        waterEX:{id:"waterEX",name:"水元素EX",category:"passive",statusResistBonus:99},
        unrelated:{id:"unrelated",freezeChance:73,frostbiteChance:64}
    };
}

function bareDocument(nodes={}){
    return {
        getElementById(id){ return nodes[id]||null; },
        querySelector(){ return null; },
        querySelectorAll(){ return []; }
    };
}

function load(overrides={}){
    const context=Object.assign({
        window:null,console,Math:Object.create(Math),Number,Object,Array,Set,Map,Promise,
        skillDatabase:staleSkills(),monsters:[],document:bareDocument(),
        getSkillTargets(centerIndex,targetType){
            if(targetType==="tri"){ return [centerIndex-1,centerIndex,centerIndex+1]; }
            if(targetType==="column"){ return [centerIndex-3,centerIndex]; }
            return [centerIndex];
        }
    },overrides);
    context.window=context;
    vm.createContext(context);
    vm.runInContext(source,context);
    return context;
}

function fields(skill){
    return {
        category:skill.category,targetType:skill.targetType,
        learnCost:skill.learnCost,maxLevel:skill.maxLevel,upgradeCost:skill.upgradeCost,
        baseDamage:skill.baseDamage,damagePerLevel:skill.damagePerLevel,spCost:skill.spCost,
        lifestealPercentByLevel:skill.lifestealPercentByLevel&&Array.from(skill.lifestealPercentByLevel),
        requires:skill.requires&&Array.from(skill.requires),
        frostbiteChance:skill.frostbiteChance,frostbiteDuration:skill.frostbiteDuration,
        freezeChance:skill.freezeChance,freezeDuration:skill.freezeDuration
    };
}

test("the eight offensive and control Water skill definitions are exact",()=>{
    const skills=load().skillDatabase;
    const expected={
        waterKnife:{category:"physical",targetType:"single",learnCost:2,maxLevel:5,upgradeCost:1,baseDamage:21,damagePerLevel:5,spCost:6,lifestealPercentByLevel:[4,5,6,7,8],requires:[],frostbiteChance:30,frostbiteDuration:1,freezeChance:undefined,freezeDuration:undefined},
        frostPunch:{category:"physical",targetType:"single",learnCost:10,maxLevel:5,upgradeCost:1,baseDamage:32,damagePerLevel:7,spCost:17,lifestealPercentByLevel:[4,5,6,7,8],requires:["waterKnife"],frostbiteChance:35,frostbiteDuration:2,freezeChance:undefined,freezeDuration:undefined},
        iceSpin:{category:"physical",targetType:"tri",learnCost:20,maxLevel:5,upgradeCost:1,baseDamage:35,damagePerLevel:7,spCost:45,lifestealPercentByLevel:[3,4,5,6,7],requires:["frostPunch"],frostbiteChance:35,frostbiteDuration:2,freezeChance:undefined,freezeDuration:undefined},
        frostCrush:{category:"physical",targetType:"single",learnCost:30,maxLevel:5,upgradeCost:1,baseDamage:116,damagePerLevel:24,spCost:60,lifestealPercentByLevel:[4,5,6,7,8],requires:["iceSpin"],frostbiteChance:45,frostbiteDuration:2,freezeChance:undefined,freezeDuration:undefined},
        waterBall:{category:"magic",targetType:"tri",learnCost:2,maxLevel:5,upgradeCost:1,baseDamage:10,damagePerLevel:2,spCost:8,lifestealPercentByLevel:[3,4,5,6,7],requires:[],frostbiteChance:30,frostbiteDuration:1,freezeChance:undefined,freezeDuration:undefined},
        floodBeast:{category:"magic",targetType:"single",learnCost:15,maxLevel:5,upgradeCost:1,baseDamage:105,damagePerLevel:21,spCost:35,lifestealPercentByLevel:[4,5,6,7,8],requires:["waterBall"],frostbiteChance:35,frostbiteDuration:2,freezeChance:undefined,freezeDuration:undefined},
        iceArrowRain:{category:"magic",targetType:"all",learnCost:20,maxLevel:5,upgradeCost:1,baseDamage:30,damagePerLevel:6,spCost:75,lifestealPercentByLevel:[1,2,3,4,5],requires:["floodBeast"],frostbiteChance:35,frostbiteDuration:2,freezeChance:undefined,freezeDuration:undefined},
        freeze:{category:"magic",targetType:"column",learnCost:20,maxLevel:1,upgradeCost:undefined,baseDamage:undefined,damagePerLevel:undefined,spCost:32,lifestealPercentByLevel:undefined,requires:["frostPunch","floodBeast"],frostbiteChance:undefined,frostbiteDuration:undefined,freezeChance:90,freezeDuration:3}
    };
    Object.entries(expected).forEach(([id,value])=>assert.deepEqual(fields(skills[id]),value,id));
});

test("legacy Freeze and Frostbite conflict fields are deleted without touching unrelated skills",()=>{
    const skills=load().skillDatabase;
    ["waterKnife","frostPunch","iceSpin","frostCrush","waterBall","floodBeast","iceArrowRain","freeze"].forEach(id=>{
        assert.equal(skills[id].freezeSingleTarget,undefined,id+" freezeSingleTarget");
        assert.equal(skills[id].teamFreezeChance,undefined,id+" teamFreezeChance");
        assert.equal(skills[id].teamFreezeDuration,undefined,id+" teamFreezeDuration");
    });
    assert.deepEqual(
        [skills.floodBeast.freezeChance,skills.iceArrowRain.freezeChance,skills.freeze.frostbiteChance],
        [undefined,undefined,undefined]
    );
    assert.deepEqual([skills.unrelated.freezeChance,skills.unrelated.frostbiteChance],[73,64]);
    assert.equal(skills.waterEX.statusResistBonus,undefined);
});

test("Water support, cleanse, revive and EX passive are owned by the same final layer",()=>{
    const skills=load().skillDatabase;
    assert.deepEqual(
        [skills.healSpell.targetType,skills.healSpell.learnCost,skills.healSpell.baseHeal,skills.healSpell.healPerLevel,
            skills.healSpell.baseHealSP,skills.healSpell.healSPPerLevel,skills.healSpell.spCost,skills.healSpell.cleanseAll],
        ["allyTri",16,550,30,35,0,45,true]
    );
    assert.deepEqual(Array.from(skills.healSpell.requires),["frostPunch","floodBeast"]);
    assert.deepEqual([skills.revive.learnCost,Array.from(skills.revive.reviveHealPercentByLevel),skills.revive.spCost],[18,[20,40,60,80,100],45]);
    assert.deepEqual(
        [skills.purifyMind.name,skills.purifyMind.targetType,skills.purifyMind.learnCost,skills.purifyMind.spCost,skills.purifyMind.removeAllStates],
        ["淨心訣","ally",1,22,true]
    );
    assert.deepEqual(Array.from(skills.purifyMind.requires),["frostPunch","floodBeast"]);
    assert.deepEqual(
        [skills.waterEX.damageBonusPercent,skills.waterEX.healBonusPercent,skills.waterEX.turnStartCleanseChance,skills.waterEX.statusResistBonus],
        [5,10,30,undefined]
    );
    assert.equal(load().v169WaterSkillRules.skillIds.length,12);
});

test("damage growth sequences and HP-only lifesteal text match every level",()=>{
    const context=load({
        getSkillEffectPreviewText(){ return "legacy"; },
        buildSkillLevelBreakdownHTML(){ return "legacy"; }
    });
    const sequences={
        waterKnife:[21,26,31,36,41],frostPunch:[32,39,46,53,60],iceSpin:[35,42,49,56,63],
        frostCrush:[116,140,164,188,212],waterBall:[10,12,14,16,18],
        floodBeast:[105,126,147,168,189],iceArrowRain:[30,36,42,48,54]
    };
    Object.entries(sequences).forEach(([id,expected])=>{
        const actual=[1,2,3,4,5].map(level=>{
            const parts=Array.from(context.v169WaterSkillRules.effectParts(id,level));
            return Number(parts[0].match(/\d+/)[0]);
        });
        assert.deepEqual(actual,expected,id);
    });
    const preview=context.getSkillEffectPreviewText(context.skillDatabase.iceSpin,5);
    assert.match(preview,/63/);
    assert.match(preview,/35%基礎機率凍傷2回合/);
    assert.match(preview,/傷害-25%、閃避-25%、異常狀態抗性-25%/);
    assert.match(preview,/吸取實際傷害7%（只恢復自身HP）/);
    assert.doesNotMatch(preview,/HP\/SP|冰封/);
    const freeze=context.getSkillEffectPreviewText(context.skillDatabase.freeze,1);
    assert.match(freeze,/90%基礎機率冰封3回合/);
    assert.match(freeze,/不造成傷害/);
});

test("secondary and legacy player-two Freeze resolve the front/back column",()=>{
    const observed=[];
    const context=load({
        castSecondaryCharacterSkill(characterIndex,skillId,centerIndex){
            observed.push(["secondary",Array.from(this.getSkillTargets(centerIndex,"tri"))]);
        },
        castPlayer2Skill(skillId,centerIndex){
            observed.push(["player2",Array.from(this.getSkillTargets(centerIndex,"tri"))]);
        }
    });
    context.castSecondaryCharacterSkill(2,"freeze",4);
    context.castPlayer2Skill("freeze",7);
    context.castSecondaryCharacterSkill(2,"iceSpin",4);
    assert.deepEqual(observed,[
        ["secondary",[1,4]],["player2",[4,7]],["secondary",[3,4,5]]
    ]);
});

test("Frostbite is a soft debuff and never blocks skills or monster special actions",()=>{
    const frostbitten={name:"測試",statusEffects:[{type:"frostbite",turnsLeft:2}]};
    const clean={name:"正常",statusEffects:[]};
    let specials=0;
    const context=load({
        player:frostbitten,monsters:[frostbitten,clean],activeBattleCharacterIndex:0,
        getPartyCharacterByIndex:()=>frostbitten,
        v141TryMonsterSpecialAction(){ specials++; return true; },
        prepareAction(){ return "skill-ok"; },
        processSingleMonsterAttack(){ return "monster-skill-ok"; },
        getOutgoingDamageDownPercent(){ return 0; },
        getMonsterEvasion(){ return 40; },
        getMonsterEffectiveSpiritPoints(){ return 80; },
        getPlayerStatusResistBonus(){ return 20; },
        getFinalBattleSpiritForPlayerTarget(){ return 100; }
    });
    assert.equal(context.v141TryMonsterSpecialAction(0),true);
    assert.equal(specials,1);
    assert.equal(context.prepareAction("waterKnife"),"skill-ok");
    assert.equal(context.processSingleMonsterAttack(0),"monster-skill-ok");
    assert.equal(context.getOutgoingDamageDownPercent(frostbitten),25);
    assert.equal(context.getMonsterEvasion(frostbitten),30);
    assert.equal(context.getMonsterEffectiveSpiritPoints(frostbitten),60);
    assert.equal(context.getFinalBattleSpiritForPlayerTarget(frostbitten),75);
    assert.equal(context.getPlayerStatusResistBonus(frostbitten),15);
    assert.equal(context.v169WaterSkillRules.frostbitePenaltyPercent,25);
    assert.equal(context.v169WaterSkillRules.isFrostbitten(frostbitten),true);
});

test("monster Freeze pure-control damage is owned by the authoritative core",()=>{
    const main=fs.readFileSync("js/00-main.js","utf8");
    assert.doesNotMatch(source,/window\.calculateDamage\s*=/);
    assert.match(main,/const isPureControlSkill=[\s\S]*?castSkillData2\.id==="freeze"/);
    assert.match(main,/let damage=[\s\S]*?isPureControlSkill[\s\S]*?\?0/);
    assert.match(main,/if\(damage>0 && hasBarrier\)/);
});

test("all final UI description entry points expose current Frostbite and HP-only recovery",()=>{
    const description={textContent:""};
    const levels={innerHTML:""};
    let creationCalls=0;
    const context=load({
        document:bareDocument({
            creationSkillDetailDescription:description,
            creationSkillDetailLevels:levels
        }),
        getSkillPreviewSummary(){ return "legacy-summary"; },
        getSkillEffectPreviewText(){ return "legacy-effect"; },
        buildSkillLevelBreakdownHTML(){ return "legacy-levels"; },
        showCreationSkillDetail(){ creationCalls++; }
    });
    const skill=context.skillDatabase.iceArrowRain;
    const summary=context.getSkillPreviewSummary(skill);
    const effect=context.getSkillEffectPreviewText(skill,3);
    const breakdown=context.buildSkillLevelBreakdownHTML(skill);
    context.showCreationSkillDetail("iceArrowRain");

    assert.match(summary,/敵方全體/);
    assert.match(summary,/凍傷：傷害、閃避、異常抗性各降低25%/);
    assert.match(summary,/恢復自身HP/);
    assert.match(effect,/42/);
    assert.match(effect,/35%基礎機率凍傷2回合/);
    assert.match(breakdown,/Lv\.5/);
    assert.match(breakdown,/54/);
    assert.match(breakdown,/只恢復自身HP/);
    assert.equal(creationCalls,1);
    assert.equal(description.textContent,skill.description);
    assert.match(levels.innerHTML,/凍傷2回合/);
    assert.doesNotMatch(levels.innerHTML,/HP\/SP|冰封/);
});

console.log("\nV169 Water skill rules suite: "+passed+" tests passed.");
