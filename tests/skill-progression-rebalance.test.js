"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const source=fs.readFileSync("js/60-v173.64-skill-progression-rebalance.js","utf8");

const names={
    flameSlash:"火焰斬",fireCritical:"會心一擊",explosiveFlurry:"火爆亂擊",dragonSlash:"霸龍裂天斬",
    fireRocket:"火箭",blazeSpell:"烈火術",flameTornado:"烈焰龍捲",phoenixCry:"火鳳天鳴",rage:"怒火",fireEX:"火元素EX",
    waterKnife:"水刀斬",frostPunch:"冰霜拳",iceSpin:"冰旋一閃",frostCrush:"冰封重擊",waterBall:"水球術",floodBeast:"洪水猛獸",iceArrowRain:"冰霜箭雨",
    healSpell:"治療術",revive:"復活術",freeze:"冰封",purifyMind:"淨心訣",waterEX:"水元素EX",
    stormFist:"暴風拳",stormFlurry:"暴風亂擊",windCrossSlash:"風旋十字斬",dizzyFist:"暈眩猛擊",windSpell:"狂風術",stormCircle:"風焰術",windHowlLightning:"風哮電擊",stormRain:"風起雲湧",dodgeSkill:"閃躲術",stealthSkill:"隱身術",dinghaishenzhen:"氣定神閒",windEX:"風元素EX",
    stoneSlash:"土石斬",petrifyFist:"石盾拳",stoneBreakSky:"石破天驚",earthquakeCrush:"地裂重拳",stoneThrow:"落石術",rollingStone:"滾石術",flyingSandStrike:"飛沙瞬擊",earthSpell:"地牛猛襲",rockWall:"岩石壁壘",earthShield:"萬象土盾",barrier:"結界",earthEX:"土元素EX",stormSpell:"暴風術"
};
const elementById=id=>{
    if(/^water|frost|ice|heal|revive|freeze|purify/.test(id)) return "water";
    if(/^storm|wind|dizzy|dodge|stealth|dinghai/.test(id)) return "wind";
    if(/^stone|petrify|earth|rolling|flying|rock|barrier/.test(id)) return "earth";
    return "fire";
};
const categoryById=id=>{
    if(/EX$/.test(id)) return "passive";
    if(["rage","dodgeSkill","stealthSkill","dinghaishenzhen","rockWall","earthShield","barrier","purifyMind"].includes(id)) return "buff";
    if(id==="healSpell") return "heal";
    if(id==="revive") return "revive";
    if(["fireRocket","blazeSpell","flameTornado","phoenixCry","waterBall","floodBeast","iceArrowRain","freeze","windSpell","stormCircle","windHowlLightning","stormRain","stoneThrow","rollingStone","flyingSandStrike","earthSpell","stormSpell"].includes(id)) return "magic";
    return "physical";
};

function makeSkillDatabase(){
    const db={};
    for(const [id,name] of Object.entries(names)){
        db[id]={id,name,element:elementById(id),category:categoryById(id),learnCost:99,maxLevel:/EX$|freeze|purifyMind|stealthSkill|dinghaishenzhen|barrier|stormSpell/.test(id)?1:5,upgradeCost:1,requires:[],description:"初次學習需99技能點。最高5級，每升1級消耗1技能點。"};
    }
    Object.assign(db.fireCritical,{requires:["flameSlash"]});
    Object.assign(db.explosiveFlurry,{requires:["fireCritical"]});
    Object.assign(db.dragonSlash,{requires:["explosiveFlurry"]});
    Object.assign(db.blazeSpell,{requires:["fireRocket"]});
    Object.assign(db.flameTornado,{requires:["blazeSpell"]});
    Object.assign(db.phoenixCry,{requires:["flameTornado"]});
    Object.assign(db.rage,{requires:["explosiveFlurry","flameTornado"],spCost:50,duration:3});
    Object.assign(db.revive,{reviveHealPercentByLevel:[20,40,60,80,100],spCost:45});
    Object.assign(db.dodgeSkill,{spCost:20,duration:3,targetType:"allyTri",evasionBonusPercent:75});
    Object.assign(db.rockWall,{spCost:45,duration:4,targetType:"allyTri",defenseBonusPercent:35,requires:["barrier"]});
    Object.assign(db.earthShield,{spCost:66,duration:3,targetType:"allyTri",reflectPercent:50});
    Object.assign(db.barrier,{spCost:40,duration:5,targetType:"allyTri",blockCount:5});
    return db;
}

function makeRuntime(options={}){
    const skillDatabase=makeSkillDatabase();
    const owners={
        fire:{id:"火測試",element:"fire",level:options.level??100,skillPoints:options.points??999,hp:1000,sp:1000,activeBuffs:[]},
        water:{id:"水測試",element:"water",level:options.level??100,skillPoints:options.points??999,hp:1000,sp:1000,activeBuffs:[]},
        wind:{id:"風測試",element:"wind",level:options.level??100,skillPoints:options.points??999,hp:1000,sp:1000,activeBuffs:[]},
        earth:{id:"土測試",element:"earth",level:options.level??100,skillPoints:options.points??999,hp:1000,sp:1000,activeBuffs:[]},
        player2:{id:"二角",element:"water",level:10,skillPoints:999,hp:1000,sp:1000,activeBuffs:[]}
    };
    const characterSkillLoadouts={};
    Object.keys(owners).forEach(key=>characterSkillLoadouts[key]={name:key,skillLevels:{},equippedSkills:[]});
    let observedBonus=0;
    let observedSupport=null;
    let burnShouldAdd=false;
    let critShouldHit=false;
    let finished=0;
    const context={
        console,Math,Number,Object,Array,String,Set,Map,Date,JSON,
        skillDatabase,characterSkillLoadouts,currentSkillCharacter:options.key||"fire",activeBattleCharacterIndex:0,
        player:owners.fire,player2:owners.player2,player3:null,
        getSkillCharacterObject:key=>owners[key],
        getPartyCharacterByIndex:index=>index===1?owners.player2:owners.fire,
        getPartyCharacterKey:index=>index===1?"player2":"fire",
        getCharacterSkillKey:actor=>actor===owners.player2?"player2":"fire",
        getPartyBattleStats:()=>({maxHP:1000}),
        renderSkillLoadout(){},updateUI(){},saveGame(){},alert(message){ context.lastAlert=message; },
        rollCritical(){ return {isCrit:critShouldHit}; },
        applyBurnEffect(){ return burnShouldAdd; },
        finishPlayerAction(){ finished++; },
        showSkillNameBadge(){},addBattleLog(){},
        castDamageSkill(skillId){
            observedBonus=Number(skillDatabase[skillId].damageBonusPercent)||0;
            context.rollCritical();
            context.applyBurnEffect({});
            owners.fire.sp-=10;
            context.finishPlayerAction();
            return observedBonus;
        },
        castSecondaryCharacterSkill(){},castPlayer2Skill(){},
        castBuffSkill(skillId){
            if(skillId==="dodgeSkill") observedSupport=skillDatabase.dodgeSkill.evasionBonusPercent;
            if(skillId==="rockWall") observedSupport=skillDatabase.rockWall.defenseBonusPercent;
            if(skillId==="earthShield") observedSupport=skillDatabase.earthShield.reflectPercent;
            return observedSupport;
        },
        document:undefined
    };
    context.window=context;
    vm.createContext(context);
    vm.runInContext(source,context,{filename:"js/60-v173.64-skill-progression-rebalance.js"});
    return {
        context,owners,loadouts:characterSkillLoadouts,skills:skillDatabase,
        setBurn(value){ burnShouldAdd=value; },setCrit(value){ critShouldHit=value; },
        observedBonus:()=>observedBonus,observedSupport:()=>observedSupport,finished:()=>finished
    };
}

function resetForLearn(runtime,key,level,points=999){
    runtime.context.currentSkillCharacter=key;
    runtime.owners[key].level=level;
    runtime.owners[key].skillPoints=points;
    runtime.loadouts[key].skillLevels={};
    runtime.context.lastAlert="";
}

test("final progression data standardizes attack milestones, costs, EX and support structure",()=>{
    const r=makeRuntime();
    const expected={
        flameSlash:[1,2],fireCritical:[7,6],explosiveFlurry:[14,10],dragonSlash:[30,16],
        fireRocket:[1,2],blazeSpell:[7,6],flameTornado:[14,10],phoenixCry:[30,16],
        waterKnife:[1,2],frostPunch:[7,6],iceSpin:[14,10],frostCrush:[30,16],waterBall:[1,2],floodBeast:[7,6],iceArrowRain:[14,10],
        stormFist:[1,2],stormFlurry:[7,6],windCrossSlash:[14,10],dizzyFist:[30,16],windSpell:[1,2],stormCircle:[7,6],windHowlLightning:[14,10],stormRain:[30,16],
        stoneSlash:[1,2],petrifyFist:[7,6],stoneBreakSky:[14,10],earthquakeCrush:[30,16],stoneThrow:[1,2],rollingStone:[7,6],flyingSandStrike:[14,10],earthSpell:[30,16]
    };
    for(const [id,value] of Object.entries(expected)) assert.deepEqual([r.skills[id].learnLevel,r.skills[id].learnCost],value,id);
    for(const id of ["fireEX","waterEX","windEX","earthEX"]) assert.deepEqual([r.skills[id].learnLevel,r.skills[id].learnCost,r.skills[id].maxLevel],[50,20,1],id);
    assert.deepEqual([r.skills.rage.learnLevel,r.skills.rage.learnCost],[18,10]);
    assert.deepEqual([r.skills.healSpell.learnLevel,r.skills.healSpell.learnCost,r.skills.revive.learnLevel,r.skills.revive.learnCost],[15,8,20,10]);
    assert.deepEqual(Array.from(r.skills.healSpell.requires),["frostPunch","floodBeast"]);
    assert.deepEqual(Array.from(r.skills.revive.requires),["healSpell"]);
    assert.deepEqual(Array.from(r.skills.freeze.requires),["iceSpin","iceArrowRain"]);
    assert.deepEqual(Array.from(r.skills.purifyMind.requires),["healSpell"]);
    assert.deepEqual([r.skills.dodgeSkill.learnLevel,r.skills.dodgeSkill.learnCost,r.skills.dodgeSkill.maxLevel],[18,10,5]);
    assert.deepEqual(Array.from(r.skills.dodgeSkill.evasionBonusPercentByLevel),[30,40,50,60,70]);
    assert.deepEqual([r.skills.rockWall.learnLevel,r.skills.rockWall.learnCost,r.skills.rockWall.maxLevel],[18,10,5]);
    assert.deepEqual(Array.from(r.skills.rockWall.requires),["petrifyFist","rollingStone"]);
    assert.deepEqual(Array.from(r.skills.rockWall.defenseBonusPercentByLevel),[15,20,25,30,35]);
    assert.deepEqual(Array.from(r.skills.earthShield.requires),["rockWall"]);
    assert.deepEqual(Array.from(r.skills.earthShield.reflectPercentByLevel),[20,30,35,40,50]);
    assert.deepEqual(Array.from(r.skills.barrier.requires),["earthShield"]);
    assert.equal(r.skills.stormSpell.learnLevel,undefined,"monster-only 暴風術不進玩家 progression");
});

test("shared level formula and upgrade cost table enforce slow cultivation",()=>{
    const r=makeRuntime();
    const required=r.context.v17364GetRequiredCharacterLevelForSkillLevel;
    assert.deepEqual([1,2,3,4,5].map(level=>required(r.skills.flameSlash,level)),[1,15,30,50,80]);
    assert.deepEqual([1,2,3,4,5].map(level=>required(r.skills.dragonSlash,level)),[30,38,48,60,80]);
    assert.deepEqual([1,2,3,4,5].map(level=>required(r.skills.revive,level)),[20,28,38,50,80]);
    assert.deepEqual(Object.assign({},r.context.v17364SkillUpgradeCostByTargetLevel),{2:1,3:2,4:3,5:4});
});

test("learning milestones use the selected character own level, prerequisites and points",()=>{
    const r=makeRuntime();
    resetForLearn(r,"fire",6); r.loadouts.fire.skillLevels.flameSlash=1; assert.equal(r.context.learnSkill("fireCritical"),false);
    resetForLearn(r,"fire",7); r.loadouts.fire.skillLevels.flameSlash=1; assert.equal(r.context.learnSkill("fireCritical"),true);
    resetForLearn(r,"fire",13); r.loadouts.fire.skillLevels.fireCritical=1; assert.equal(r.context.learnSkill("explosiveFlurry"),false);
    resetForLearn(r,"fire",14); r.loadouts.fire.skillLevels.fireCritical=1; assert.equal(r.context.learnSkill("explosiveFlurry"),true);
    resetForLearn(r,"fire",17); r.loadouts.fire.skillLevels.explosiveFlurry=1; assert.equal(r.context.learnSkill("rage"),false);
    resetForLearn(r,"fire",18); r.loadouts.fire.skillLevels.explosiveFlurry=1; assert.equal(r.context.learnSkill("rage"),true);
    resetForLearn(r,"water",19); r.loadouts.water.skillLevels.healSpell=1; assert.equal(r.context.learnSkill("revive"),false);
    resetForLearn(r,"water",20); r.loadouts.water.skillLevels.healSpell=1; assert.equal(r.context.learnSkill("revive"),true);
    resetForLearn(r,"fire",29); r.loadouts.fire.skillLevels.explosiveFlurry=1; assert.equal(r.context.learnSkill("dragonSlash"),false);
    resetForLearn(r,"fire",30); r.loadouts.fire.skillLevels.explosiveFlurry=1; assert.equal(r.context.learnSkill("dragonSlash"),true);
    resetForLearn(r,"fire",49); assert.equal(r.context.learnSkill("fireEX"),false);
    resetForLearn(r,"fire",50); assert.equal(r.context.learnSkill("fireEX"),true);
    r.owners.fire.level=100;
    resetForLearn(r,"player2",10); r.loadouts.player2.skillLevels.healSpell=1; assert.equal(r.context.learnSkill("revive"),false,"第二角色不能借第一角色等級");
});

test("five-level upgrades require both character境界 and increasing point cost",()=>{
    const r=makeRuntime();
    const cases=[[14,1,false],[15,1,true],[29,2,false],[30,2,true],[49,3,false],[50,3,true],[79,4,false],[80,4,true]];
    for(const [level,current,expected] of cases){
        resetForLearn(r,"fire",level,999);r.loadouts.fire.skillLevels.flameSlash=current;
        assert.equal(r.context.upgradeSkill("flameSlash"),expected,`flameSlash char ${level} skill ${current}`);
    }
    for(const [level,current,expected] of [[30,1,false],[37,1,false],[38,1,true],[47,2,false],[48,2,true],[59,3,false],[60,3,true],[79,4,false],[80,4,true]]){
        resetForLearn(r,"fire",level,999);r.loadouts.fire.skillLevels.dragonSlash=current;
        assert.equal(r.context.upgradeSkill("dragonSlash"),expected,`dragon char ${level} skill ${current}`);
    }
    resetForLearn(r,"fire",30,1);r.loadouts.fire.skillLevels.flameSlash=2;
    assert.equal(r.context.upgradeSkill("flameSlash"),false,"Lv3 needs 2 points");
    assert.equal(r.owners.fire.skillPoints,1);
});

test("revive keeps 20/40/60/80/100 battle values and uses 20/28/38/50/80 gates",()=>{
    const r=makeRuntime();
    assert.deepEqual(Array.from(r.skills.revive.reviveHealPercentByLevel),[20,40,60,80,100]);
    assert.deepEqual([1,2,3,4,5].map(level=>r.context.v17364GetRequiredCharacterLevelForSkillLevel(r.skills.revive,level)),[20,28,38,50,80]);
});

test("fire resonance works for crit warrior and newly-added-burn mage without stacking or refreshing momentum",()=>{
    const r=makeRuntime();
    r.loadouts.fire.skillLevels.fireSoulResonance=1;
    r.loadouts.fire.skillLevels.flameSlash=1;
    assert.equal(r.context.v17364CastNewFireTactical(0,"fireSoulResonance"),true);
    r.setCrit(true);r.setBurn(false);
    r.context.castDamageSkill("flameSlash",0);
    let momentum=r.owners.fire.activeBuffs.find(buff=>buff.type==="fireMomentum");
    assert.ok(momentum);assert.equal(momentum.bonusPercent,12);
    const originalMomentum=momentum;
    r.context.castDamageSkill("flameSlash",0);
    assert.equal(r.observedBonus(),12,"next player-active main cast receives the additive bucket");
    assert.equal(r.owners.fire.activeBuffs.some(buff=>buff.type==="fireMomentum"),false,"consumed momentum is not refreshed by same cast crit");

    r.setCrit(false);r.setBurn(true);
    r.context.castDamageSkill("flameSlash",0);
    momentum=r.owners.fire.activeBuffs.find(buff=>buff.type==="fireMomentum");
    assert.ok(momentum,"successful newly-added burn can grant momentum");
    const turns=momentum.turnsLeft;
    r.setCrit(true);r.setBurn(true);
    r.context.castDamageSkill("flameSlash",0);
    assert.notEqual(momentum,originalMomentum);
    assert.equal(momentum.turnsLeft,turns,"existing momentum is not refreshed before consumption");
});

test("existing burn does not grant resonance momentum",()=>{
    const r=makeRuntime();
    r.loadouts.fire.skillLevels.fireSoulResonance=1;
    r.loadouts.fire.skillLevels.fireRocket=1;
    r.context.v17364CastNewFireTactical(0,"fireSoulResonance");
    r.setCrit(false);r.setBurn(false);
    r.context.castDamageSkill("fireRocket",0);
    assert.equal(r.owners.fire.activeBuffs.some(buff=>buff.type==="fireMomentum"),false);
});

test("blood burn enforces HP threshold, pays raw max-HP cost and only buffs next player-active main cast",()=>{
    const r=makeRuntime();
    r.loadouts.fire.skillLevels.bloodBurnArt=1;
    r.loadouts.fire.skillLevels.flameSlash=1;
    r.owners.fire.hp=1000;r.owners.fire.sp=1000;
    assert.equal(r.context.v17364CastNewFireTactical(0,"bloodBurnArt"),true);
    assert.equal(r.owners.fire.hp,900);assert.equal(r.owners.fire.sp,980);
    r.context.castDamageSkill("flameSlash",0);
    assert.equal(r.observedBonus(),20);
    assert.equal(r.owners.fire.activeBuffs.some(buff=>buff.type==="bloodBurn"),false);
    r.owners.fire.hp=200;r.owners.fire.sp=1000;
    assert.equal(r.context.v17364CastNewFireTactical(0,"bloodBurnArt"),false);
    assert.equal(r.owners.fire.hp,200);assert.equal(r.owners.fire.sp,1000);
});

test("momentum and blood burn add in the same damage bonus bucket instead of multiplying",()=>{
    const r=makeRuntime();
    r.loadouts.fire.skillLevels.fireSoulResonance=1;r.loadouts.fire.skillLevels.bloodBurnArt=1;r.loadouts.fire.skillLevels.flameSlash=1;
    r.context.v17364CastNewFireTactical(0,"fireSoulResonance");
    r.setCrit(true);r.context.castDamageSkill("flameSlash",0);
    r.setCrit(false);r.context.v17364CastNewFireTactical(0,"bloodBurnArt");
    r.context.castDamageSkill("flameSlash",0);
    assert.equal(r.observedBonus(),32);
    assert.equal(r.skills.flameSlash.damageBonusPercent,undefined,"temporary bucket contribution is restored after the main cast");
});

test("wind and earth level-scaled support values feed the existing support owner",()=>{
    const r=makeRuntime();
    r.loadouts.fire.skillLevels.dodgeSkill=5;
    r.context.castBuffSkill("dodgeSkill",0);assert.equal(r.observedSupport(),70);assert.equal(r.skills.dodgeSkill.evasionBonusPercent,75);
    r.loadouts.fire.skillLevels.rockWall=5;
    r.context.castBuffSkill("rockWall",0);assert.equal(r.observedSupport(),35);assert.equal(r.skills.rockWall.defenseBonusPercent,35);
    r.loadouts.fire.skillLevels.earthShield=5;
    r.context.castBuffSkill("earthShield",0);assert.equal(r.observedSupport(),50);assert.equal(r.skills.earthShield.reflectPercent,50);
});

test("legacy learned skills remain intact while the next upgrade obeys the new gate",()=>{
    const r=makeRuntime();
    r.owners.fire.level=10;r.owners.fire.skillPoints=777;
    r.loadouts.fire.skillLevels.dragonSlash=2;
    const before=JSON.stringify(r.loadouts.fire.skillLevels);
    r.context.v17364ApplyFinalProgressionData();
    assert.equal(JSON.stringify(r.loadouts.fire.skillLevels),before);
    assert.equal(r.context.upgradeSkill("dragonSlash"),false);
    assert.equal(r.loadouts.fire.skillLevels.dragonSlash,2);assert.equal(r.owners.fire.skillPoints,777);
});

test("player progression is isolated from Abyss fixed levels, talisman shared skills and four-slot equip rule",()=>{
    const abyss=fs.readFileSync("js/59-abyss-two-tier-runtime.js","utf8");
    const talisman=fs.readFileSync("js/27-v132-content-expansion.js","utf8");
    const main=fs.readFileSync("js/00-main.js","utf8");
    assert.match(abyss,/v132FixedSkillLoadout\s*=\s*true/);
    assert.match(abyss,/v141ForceSkillLevel\s*=\s*config\.skillLevel/);
    assert.doesNotMatch(abyss,/v17364GetRequiredCharacterLevelForSkillLevel|learnLevel/);
    assert.match(talisman,/sharedSkillId/);
    assert.doesNotMatch(talisman,/v17364GetRequiredCharacterLevelForSkillLevel/);
    assert.match(main,/equippedSkills\.length\s*>=\s*4/);
});
