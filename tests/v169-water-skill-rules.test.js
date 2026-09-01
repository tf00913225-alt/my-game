"use strict";

/* HISTORICAL SPEC SNAPSHOT (V169): 水系值雖與 V170 相容，本檔仍非完整載入整合；V170 以 v170-final-spec-integration.test.js 為準。 */

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

function clone(value){
    return JSON.parse(JSON.stringify(value));
}

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
        getElementById(id){ return nodes[id]||null; }
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
        waterKnife:{category:"physical",targetType:"single",learnCost:2,maxLevel:5,upgradeCost:1,baseDamage:21,damagePerLevel:5,spCost:6,lifestealPercentByLevel:[4,5,6,7,8],requires:[],frostbiteChance:10,frostbiteDuration:1,freezeChance:undefined,freezeDuration:undefined},
        frostPunch:{category:"physical",targetType:"single",learnCost:10,maxLevel:5,upgradeCost:1,baseDamage:32,damagePerLevel:7,spCost:17,lifestealPercentByLevel:[4,5,6,7,8],requires:["waterKnife"],frostbiteChance:15,frostbiteDuration:1,freezeChance:undefined,freezeDuration:undefined},
        iceSpin:{category:"physical",targetType:"tri",learnCost:20,maxLevel:5,upgradeCost:1,baseDamage:35,damagePerLevel:7,spCost:45,lifestealPercentByLevel:[3,4,5,6,7],requires:["frostPunch"],frostbiteChance:20,frostbiteDuration:1,freezeChance:undefined,freezeDuration:undefined},
        frostCrush:{category:"physical",targetType:"single",learnCost:30,maxLevel:5,upgradeCost:1,baseDamage:116,damagePerLevel:24,spCost:60,lifestealPercentByLevel:[4,5,6,7,8],requires:["iceSpin"],frostbiteChance:25,frostbiteDuration:1,freezeChance:undefined,freezeDuration:undefined},
        waterBall:{category:"magic",targetType:"tri",learnCost:2,maxLevel:5,upgradeCost:1,baseDamage:10,damagePerLevel:2,spCost:8,lifestealPercentByLevel:[3,4,5,6,7],requires:[],frostbiteChance:10,frostbiteDuration:1,freezeChance:undefined,freezeDuration:undefined},
        floodBeast:{category:"magic",targetType:"single",learnCost:15,maxLevel:5,upgradeCost:1,baseDamage:105,damagePerLevel:21,spCost:35,lifestealPercentByLevel:[4,5,6,7,8],requires:["waterBall"],frostbiteChance:15,frostbiteDuration:1,freezeChance:undefined,freezeDuration:undefined},
        iceArrowRain:{category:"magic",targetType:"all",learnCost:20,maxLevel:5,upgradeCost:1,baseDamage:30,damagePerLevel:6,spCost:75,lifestealPercentByLevel:[1,2,3,4,5],requires:["floodBeast"],frostbiteChance:20,frostbiteDuration:1,freezeChance:undefined,freezeDuration:undefined},
        freeze:{category:"magic",targetType:"column",learnCost:25,maxLevel:1,upgradeCost:undefined,baseDamage:undefined,damagePerLevel:undefined,spCost:32,lifestealPercentByLevel:undefined,requires:["iceArrowRain"],frostbiteChance:undefined,frostbiteDuration:undefined,freezeChance:90,freezeDuration:5}
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

test("Water support, revive and EX passive are owned by the same final layer",()=>{
    const skills=load().skillDatabase;
    assert.deepEqual(
        [skills.healSpell.targetType,skills.healSpell.baseHeal,skills.healSpell.healPerLevel,
            skills.healSpell.baseHealSP,skills.healSpell.healSPPerLevel,skills.healSpell.spCost,skills.healSpell.cleanseAll],
        ["allyTri",550,30,65,30,45,true]
    );
    assert.deepEqual(Array.from(skills.healSpell.requires),["iceArrowRain","iceSpin"]);
    assert.deepEqual(Array.from(skills.revive.reviveHealPercentByLevel),[20,40,60,80,100]);
    assert.deepEqual(
        [skills.waterEX.damageBonusPercent,skills.waterEX.healBonusPercent,skills.waterEX.turnStartCleanseChance,skills.waterEX.statusResistBonus],
        [5,10,30,undefined]
    );
    assert.equal(load().v169WaterSkillRules.skillIds.length,11);
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
    assert.match(preview,/20%基礎機率凍傷1回合/);
    assert.match(preview,/吸取實際傷害7%（只恢復自身HP）/);
    assert.doesNotMatch(preview,/HP\/SP|冰封/);
    const freeze=context.getSkillEffectPreviewText(context.skillDatabase.freeze,1);
    assert.match(freeze,/90%基礎機率冰封5回合/);
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

test("Frostbite rejects Abyss special skills while allowing the normal fallback",()=>{
    const monsters=[
        {name:"極帝天尊",statusEffects:[{type:"frostbite",turnsLeft:1}]},
        {name:"極帝天尊",statusEffects:[]}
    ];
    let specialCalls=0;
    const context=load({
        monsters,
        v141TryMonsterSpecialAction(){ specialCalls++; return true; }
    });
    assert.equal(context.v141TryMonsterSpecialAction(0),false);
    assert.equal(specialCalls,0,"Frostbite must not enter a named special resolver");
    assert.equal(context.v141TryMonsterSpecialAction(1),true);
    assert.equal(specialCalls,1);
    assert.equal(context.v169WaterSkillRules.isFrostbitten(monsters[0]),true);
});

test("monster Freeze remains pure control even against Defend and Barrier",()=>{
    const barrier={type:"barrier",turnsLeft:5,remainingBlocks:1};
    const target={id:"玩家",hp:100,isDefending:true,activeBuffs:[barrier],statusEffects:[]};
    const logs=[];
    const context=load({
        player:target,
        monsters:[{name:"北帝天尊"}],
        getExistingPartyIndexes:()=>[0],
        getPartyCharacterByIndex:()=>target,
        showMonsterSkillNameBadge(){},
        calculateDamage(){ return 80; },
        addBattleLog(message){ logs.push(message); },
        processSingleMonsterAttack(){
            this.showMonsterSkillNameBadge("冰封","water",0);
            let damage=this.calculateDamage(80,0,1,1,"water","water");
            if(target.isDefending){ damage=Math.max(1,Math.floor(damage*.5)); }
            if(target.activeBuffs.some(buff=>buff.type==="barrier"&&buff.remainingBlocks>0)){
                barrier.remainingBlocks--;
                target.activeBuffs=target.activeBuffs.filter(buff=>buff.remainingBlocks>0);
                this.addBattleLog("玩家的結界完全格擋了這次攻擊！");
                damage=0;
            }
            target.hp-=damage;
            target.statusEffects.push({type:"freeze",turnsLeft:this.skillDatabase.freeze.freezeDuration});
            this.addBattleLog("北帝天尊施放冰封玩家，造成"+damage+"傷害。");
        }
    });
    context.processSingleMonsterAttack(0);
    assert.equal(target.hp,100,"pure control cannot remove HP");
    assert.equal(target.isDefending,true,"Defend state is restored");
    assert.equal(barrier.remainingBlocks,1,"pure control cannot consume a direct-hit Barrier charge");
    assert.equal(target.activeBuffs.includes(barrier),true);
    assert.deepEqual(target.statusEffects,[{type:"freeze",turnsLeft:5}]);
    assert.deepEqual(logs,[],"legacy zero-damage and Barrier messages are suppressed");
});

test("all final UI description entry points expose Frostbite and HP-only recovery",()=>{
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
    assert.match(summary,/凍傷，只禁止技能/);
    assert.match(summary,/恢復自身HP/);
    assert.match(effect,/42/);
    assert.match(effect,/20%基礎機率凍傷1回合/);
    assert.match(breakdown,/Lv\.5/);
    assert.match(breakdown,/54/);
    assert.match(breakdown,/只恢復自身HP/);
    assert.equal(creationCalls,1);
    assert.equal(description.textContent,skill.description);
    assert.match(levels.innerHTML,/凍傷1回合/);
    assert.doesNotMatch(levels.innerHTML,/HP\/SP|冰封/);
});

console.log("\nV169 Water skill rules suite: "+passed+" tests passed.");
