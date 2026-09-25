"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const source=fs.readFileSync("js/60-v173.64-skill-progression-rebalance.js","utf8");
const main=fs.readFileSync("js/00-main.js","utf8");

const names={
    flameSlash:"火焰斬",fireCritical:"會心一擊",explosiveFlurry:"火爆亂擊",dragonSlash:"霸龍裂天斬",
    fireRocket:"火箭",blazeSpell:"烈火術",flameTornado:"烈焰龍捲",phoenixCry:"火鳳天鳴",rage:"怒火",fireEX:"火元素EX",
    waterKnife:"水刀斬",frostPunch:"冰霜拳",iceSpin:"冰旋一閃",frostCrush:"冰封重擊",waterBall:"水球術",floodBeast:"洪水猛獸",iceArrowRain:"冰霜箭雨",
    healSpell:"治療術",revive:"復活術",freeze:"冰封",purifyMind:"淨心訣",waterEX:"水元素EX",
    stormFist:"暴風拳",stormFlurry:"暴風亂擊",windCrossSlash:"風旋十字斬",dizzyFist:"暈眩猛擊",windSpell:"狂風術",stormCircle:"風焰術",windHowlLightning:"風哮電擊",stormRain:"風起雲湧",dodgeSkill:"閃躲術",stealthSkill:"隱身術",dinghaishenzhen:"氣定神閒",windEX:"風元素EX",
    stoneSlash:"土石斬",petrifyFist:"石盾拳",stoneBreakSky:"石破天驚",earthquakeCrush:"地裂重拳",stoneThrow:"落石術",sandWind:"滾石術",flyingSandStrike:"飛沙瞬擊",dustStorm:"地牛猛襲",rockWall:"岩石壁壘",earthShield:"萬象土盾",barrier:"結界",earthEX:"土元素EX",stormSpell:"暴風術"
};
const elementById=id=>{
    if(/^water|frost|ice|heal|revive|freeze|purify/.test(id)) return "water";
    if(/^storm|wind|dizzy|dodge|stealth|dinghai/.test(id)) return "wind";
    if(/^stone|petrify|sand|flying|dust|earth|rock|barrier/.test(id)) return "earth";
    return "fire";
};
const categoryById=id=>{
    if(/EX$/.test(id)) return "passive";
    if(["rage","dodgeSkill","stealthSkill","dinghaishenzhen","rockWall","earthShield","barrier","purifyMind"].includes(id)) return "buff";
    if(id==="healSpell") return "heal";
    if(id==="revive") return "revive";
    if(["fireRocket","blazeSpell","flameTornado","phoenixCry","waterBall","floodBeast","iceArrowRain","freeze","windSpell","stormCircle","windHowlLightning","stormRain","stoneThrow","sandWind","flyingSandStrike","dustStorm","stormSpell"].includes(id)) return "magic";
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
    Object.assign(db.barrier,{spCost:40,duration:5,targetType:"ally",barrierBlockCount:5});
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
    const beforeCombatantObservers=[];
    const actionFinishedObservers=[];
    const context={
        console,Math,Number,Object,Array,String,Set,Map,Date,JSON,
        skillDatabase,characterSkillLoadouts,currentSkillCharacter:options.key||"fire",activeBattleCharacterIndex:0,turn:1,
        player:owners.fire,player2:owners.player2,player3:null,
        getSkillCharacterObject:key=>owners[key],
        getPartyCharacterByIndex:index=>index===1?owners.player2:owners.fire,
        getPartyCharacterKey:index=>index===1?"player2":"fire",
        getCharacterSkillKey:actor=>actor===owners.player2?"player2":"fire",
        getPartyBattleStats:()=>({maxHP:1000,maxSP:1000}),
        renderSkillLoadout(){},updateUI(){},saveGame(){},alert(message){ context.lastAlert=message; },
        learnSkill(){},upgradeSkill(){},equipSkill(){},
        rollCritical(){ return {isCrit:critShouldHit}; },
        applyBurnEffect(){ return burnShouldAdd; },
        finishPlayerAction(){ finished++; },
        showSkillNameBadge(){},addBattleLog(){},
        castDamageSkill(skillId){
            observedBonus=Number(this.FourSymbolsSkillDamageContext&&this.FourSymbolsSkillDamageContext.directSkillBonusPercent)||0;
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
        FourSymbolsBattleFlow:{
            subscribeBeforeCombatant(observer){ beforeCombatantObservers.push(observer); return ()=>{}; },
            subscribeActionFinished(observer){ actionFinishedObservers.push(observer); return ()=>{}; }
        },
        monsters:options.monsters||[],
        document:undefined
    };
    context.window=context;
    vm.createContext(context);
    vm.runInContext(source,context,{filename:"js/60-v173.64-skill-progression-rebalance.js"});
    const rawCastDamageSkill=context.castDamageSkill;
    context.castDamageSkill=function(skillId){
        return context.FourSymbolsSkillSpec.withPlayerDirectSkillCast(
            0,skillId,{freeCast:false},()=>rawCastDamageSkill.call(context,skillId)
        );
    };
    return {
        context,owners,loadouts:characterSkillLoadouts,skills:skillDatabase,
        setBurn(value){ burnShouldAdd=value; },setCrit(value){ critShouldHit=value; },
        observedBonus:()=>observedBonus,observedSupport:()=>observedSupport,finished:()=>finished,
        freeCast(skillId){
            return context.FourSymbolsSkillSpec.withPlayerDirectSkillCast(
                0,skillId,{freeCast:true},()=>rawCastDamageSkill.call(context,skillId)
            );
        },
        beginAction(entry){ beforeCombatantObservers.forEach(observer=>observer({token:1,turn:context.turn,index:0,queue:[entry]})); },
        finishAction(){ actionFinishedObservers.forEach(observer=>observer()); }
    };
}

function resetForLearn(runtime,key,level,points=999){
    runtime.context.currentSkillCharacter=key;
    runtime.owners[key].level=level;
    runtime.owners[key].skillPoints=points;
    runtime.loadouts[key].skillLevels={};
    runtime.context.lastAlert="";
}

test("cross-element learning uses the formal native gate, doubled initial cost, EX ban and one equipped slot",()=>{
    const r=makeRuntime({key:"water",level:7,points:30});
    assert.equal(r.context.learnSkill("fireCritical"),false);
    assert.match(r.context.lastAlert,/本命元素技能/);
    r.loadouts.water.skillLevels.waterKnife=1;
    const before=r.owners.water.skillPoints;
    assert.equal(r.context.learnSkill("fireCritical"),true);
    assert.equal(r.loadouts.water.skillLevels.fireCritical,1);
    assert.equal(r.owners.water.skillPoints,before-12);
    assert.equal(r.context.upgradeSkill("fireCritical"),false,"Lv2 still observes its character-level gate");
    r.owners.water.level=50;
    assert.equal(r.context.learnSkill("fireEX"),false);
    assert.match(r.context.lastAlert,/本命元素限定/);
    r.loadouts.water.equippedSkills=[];
    assert.equal(r.context.equipSkill("fireCritical"),true);
    r.loadouts.water.skillLevels.stormFist=1;
    assert.equal(r.context.equipSkill("stormFist"),false);
    assert.match(r.context.lastAlert,/最多攜帶 1 招跨元素/);
});

test("final progression data standardizes Lv10 damage skills, EX and support structure",()=>{
    const r=makeRuntime();
    const expected={
        flameSlash:[1,2],fireCritical:[7,6],explosiveFlurry:[14,10],dragonSlash:[30,16],
        fireRocket:[1,2],blazeSpell:[7,6],flameTornado:[14,10],phoenixCry:[30,16],
        waterKnife:[1,2],frostPunch:[7,6],iceSpin:[14,10],frostCrush:[30,16],waterBall:[1,2],floodBeast:[7,6],iceArrowRain:[14,10],
        stormFist:[1,2],stormFlurry:[7,6],windCrossSlash:[14,10],dizzyFist:[30,16],windSpell:[1,2],stormCircle:[7,6],windHowlLightning:[14,10],stormRain:[30,16],
        stoneSlash:[1,2],petrifyFist:[7,6],stoneBreakSky:[14,10],earthquakeCrush:[30,16],stoneThrow:[1,2],sandWind:[7,6],flyingSandStrike:[14,10],dustStorm:[30,16]
    };
    for(const [id,value] of Object.entries(expected)){
        assert.deepEqual([r.skills[id].learnLevel,r.skills[id].learnCost,r.skills[id].maxLevel],[value[0],value[1],10],id);
        assert.equal(r.skills[id].upgradeCost,1,id+" upgrade cost");
    }
    for(const id of ["fireEX","waterEX","windEX","earthEX"]) assert.deepEqual([r.skills[id].learnLevel,r.skills[id].learnCost,r.skills[id].maxLevel],[50,20,1],id);
    assert.deepEqual([r.skills.rage.learnLevel,r.skills.rage.learnCost],[18,10]);
    assert.deepEqual([r.skills.fireSoulResonance.learnLevel,r.skills.fireSoulResonance.learnCost,r.skills.fireSoulResonance.maxLevel,r.skills.fireSoulResonance.spCost],[25,14,5,45]);
    assert.deepEqual(Array.from(r.skills.fireSoulResonance.momentumBonusByLevel),[12,15,18,21,25]);
    assert.deepEqual([r.skills.bloodBurnArt.learnLevel,r.skills.bloodBurnArt.learnCost,r.skills.bloodBurnArt.maxLevel,r.skills.bloodBurnArt.spCost],[35,18,5,35]);
    assert.deepEqual(Array.from(r.skills.bloodBurnArt.hpCostPercentByLevel),[20,25,30,35,40]);
    assert.deepEqual(Array.from(r.skills.bloodBurnArt.directDamageBonusByLevel),[20,25,30,35,50]);
    assert.deepEqual([r.skills.healSpell.maxLevel,r.skills.freeze.maxLevel,r.skills.purifyMind.maxLevel],[5,5,3]);
    assert.deepEqual(Array.from(r.skills.healSpell.healHpByLevel),[550,580,610,640,670]);
    assert.deepEqual(Array.from(r.skills.healSpell.spRestorePercentByLevel),[0,0,5,10,15]);
    assert.deepEqual(Array.from(r.skills.freeze.freezeChanceByLevel),[55,65,75,85,95]);
    assert.deepEqual(Array.from(r.skills.freeze.freezeDurationByLevel),[3,3,3,4,5]);
    assert.deepEqual(Array.from(r.skills.purifyMind.targetCountByLevel),[1,1,3]);
    assert.match(
        r.context.FourSymbolsSkillSpec.descriptionFor(r.skills.freeze),
        /範圍：同一直列前、後最多2名敵人。滿級範圍：敵方中、左、右最多3名/
    );
    assert.match(
        r.context.FourSymbolsSkillSpec.descriptionFor(r.skills.purifyMind),
        /範圍：我方或敵方1名。滿級範圍：我方或敵方中、左、右最多3名/
    );
    assert.deepEqual([r.skills.dodgeSkill.maxLevel,r.skills.stealthSkill.maxLevel,r.skills.dinghaishenzhen.maxLevel],[5,3,5]);
    assert.deepEqual(Array.from(r.skills.dodgeSkill.evasionBonusPercentByLevel),[5,10,15,20,25]);
    assert.deepEqual(Array.from(r.skills.stealthSkill.durationByLevel),[2,3,4]);
    assert.deepEqual(Array.from(r.skills.dinghaishenzhen.statusResistBonusByLevel),[5,8,10,12,15]);
    assert.deepEqual(Array.from(r.skills.dinghaishenzhen.accuracyBonusPercentByLevel),[5,10,15,20,25]);
    assert.deepEqual(Array.from(r.skills.rockWall.defenseBonusPercentByLevel),[15,20,25,30,35]);
    assert.deepEqual(Array.from(r.skills.earthShield.reflectPercentByLevel),[20,40,60,80,100]);
    assert.deepEqual(Array.from(r.skills.earthShield.durationByLevel),[3,3,3,3,4]);
    assert.equal(r.skills.barrier.barrierBlockCountByLevel,undefined,"Barrier is duration-owned, not charge-owned");
    assert.deepEqual(Array.from(r.skills.barrier.durationByLevel),[3,3,3,4,5]);
    assert.deepEqual(Array.from(r.skills.rockWall.requires),["petrifyFist","sandWind"]);
    assert.deepEqual(Array.from(r.skills.earthShield.requires),["rockWall"]);
    assert.deepEqual(Array.from(r.skills.barrier.requires),["earthShield"]);
    assert.equal(r.skills.stormSpell.learnLevel,undefined,"monster-only 暴風術不進玩家 progression");
});

test("the formal owner supplies every direct skill base value without V149 data writes",()=>{
    const r=makeRuntime();
    const expected={
        flameSlash:[30,6,10],fireCritical:[45,9,28],explosiveFlurry:[50,10,47],dragonSlash:[165,33,65],fireRocket:[13,4,10],blazeSpell:[45,9,28],flameTornado:[150,30,47],phoenixCry:[28,6,60],
        waterKnife:[21,5,6],frostPunch:[32,7,17],iceSpin:[35,7,45],frostCrush:[116,24,60],waterBall:[10,2,8],floodBeast:[105,21,35],iceArrowRain:[30,6,75],
        stormFist:[26,6,7],stormFlurry:[13,3,20],windCrossSlash:[128,26,39],dizzyFist:[141,29,55],windSpell:[12,3,9],stormCircle:[14,4,18],windHowlLightning:[128,26,55],stormRain:[24,5,75],
        stoneSlash:[26,6,7],petrifyFist:[13,3,26],stoneBreakSky:[128,26,42],earthquakeCrush:[47,9,55],stoneThrow:[12,3,7],sandWind:[14,4,19],flyingSandStrike:[24,5,55],dustStorm:[140,28,65]
    };
    Object.entries(expected).forEach(([id,values])=>{
        assert.deepEqual([r.skills[id].baseDamage,r.skills[id].damagePerLevel,r.skills[id].spCost],values,id);
    });
});

test("shared level formula preserves gates while every upgrade costs one point",()=>{
    const r=makeRuntime();
    const required=r.context.v17364GetRequiredCharacterLevelForSkillLevel;
    assert.deepEqual([1,2,3,4,5,6,7,8,9,10].map(level=>required(r.skills.flameSlash,level)),[1,15,30,50,80,80,80,80,80,80]);
    assert.deepEqual([1,2,3,4,5,6,7,8,9,10].map(level=>required(r.skills.dragonSlash,level)),[30,38,48,60,80,80,80,80,80,80]);
    assert.deepEqual([1,2,3,4,5].map(level=>required(r.skills.revive,level)),[20,28,38,50,80]);
    assert.deepEqual(Object.assign({},r.context.v17364SkillUpgradeCostByTargetLevel),{2:1,3:1,4:1,5:1,6:1,7:1,8:1,9:1,10:1});
});

test("learning milestones use the selected character own level, prerequisites and points",()=>{
    const r=makeRuntime();
    resetForLearn(r,"fire",6); r.loadouts.fire.skillLevels.flameSlash=1; assert.equal(r.context.learnSkill("fireCritical"),false);
    resetForLearn(r,"fire",7); r.loadouts.fire.skillLevels.flameSlash=1; assert.equal(r.context.learnSkill("fireCritical"),true);
    resetForLearn(r,"fire",13); r.loadouts.fire.skillLevels.fireCritical=1; assert.equal(r.context.learnSkill("explosiveFlurry"),false);
    resetForLearn(r,"fire",14); r.loadouts.fire.skillLevels.fireCritical=1; assert.equal(r.context.learnSkill("explosiveFlurry"),true);
    resetForLearn(r,"fire",17); r.loadouts.fire.skillLevels.explosiveFlurry=1; assert.equal(r.context.learnSkill("rage"),false);
    resetForLearn(r,"fire",18); r.loadouts.fire.skillLevels.explosiveFlurry=1; assert.equal(r.context.learnSkill("rage"),true);
    resetForLearn(r,"fire",25); assert.equal(r.context.learnSkill("fireSoulResonance"),false,"炎魂共鳴不能跳過怒火");
    resetForLearn(r,"fire",25); r.loadouts.fire.skillLevels.rage=1; assert.equal(r.context.learnSkill("fireSoulResonance"),true);
    resetForLearn(r,"fire",35); assert.equal(r.context.learnSkill("bloodBurnArt"),false,"焚血訣不能跳過炎魂共鳴");
    resetForLearn(r,"fire",35); r.loadouts.fire.skillLevels.fireSoulResonance=1; assert.equal(r.context.learnSkill("bloodBurnArt"),true);
    resetForLearn(r,"water",19); r.loadouts.water.skillLevels.healSpell=1; assert.equal(r.context.learnSkill("revive"),false);
    resetForLearn(r,"water",20); r.loadouts.water.skillLevels.healSpell=1; assert.equal(r.context.learnSkill("revive"),true);
    resetForLearn(r,"fire",29); r.loadouts.fire.skillLevels.explosiveFlurry=1; assert.equal(r.context.learnSkill("dragonSlash"),false);
    resetForLearn(r,"fire",30); r.loadouts.fire.skillLevels.explosiveFlurry=1; assert.equal(r.context.learnSkill("dragonSlash"),true);
    resetForLearn(r,"fire",49); assert.equal(r.context.learnSkill("fireEX"),false);
    resetForLearn(r,"fire",50); assert.equal(r.context.learnSkill("fireEX"),true);
    r.owners.fire.level=100;
    resetForLearn(r,"player2",10); r.loadouts.player2.skillLevels.healSpell=1; assert.equal(r.context.learnSkill("revive"),false,"第二角色不能借第一角色等級");
});

test("Lv10 upgrades keep the established character gates and charge one point every time",()=>{
    const r=makeRuntime();
    const cases=[[14,1,false],[15,1,true],[29,2,false],[30,2,true],[49,3,false],[50,3,true],[79,4,false],[80,4,true],[80,5,true],[80,6,true],[80,7,true],[80,8,true],[80,9,true]];
    for(const [level,current,expected] of cases){
        resetForLearn(r,"fire",level,999);r.loadouts.fire.skillLevels.flameSlash=current;
        assert.equal(r.context.upgradeSkill("flameSlash"),expected,`flameSlash char ${level} skill ${current}`);
    }
    resetForLearn(r,"fire",30,1);r.loadouts.fire.skillLevels.flameSlash=2;
    assert.equal(r.context.upgradeSkill("flameSlash"),true,"Lv2→Lv3 costs exactly one point");
    assert.equal(r.owners.fire.skillPoints,0);
    assert.equal(r.loadouts.fire.skillLevels.flameSlash,3);
});

test("revive keeps 20/40/60/80/100 battle values and uses 20/28/38/50/80 gates",()=>{
    const r=makeRuntime();
    assert.deepEqual(Array.from(r.skills.revive.reviveHealPercentByLevel),[20,40,60,80,100]);
    assert.deepEqual([1,2,3,4,5].map(level=>r.context.v17364GetRequiredCharacterLevelForSkillLevel(r.skills.revive,level)),[20,28,38,50,80]);
});

test("Fire Soul Resonance grants persistent momentum and Lv5 extends at most once per formal round",()=>{
    const r=makeRuntime();
    r.loadouts.fire.skillLevels.fireSoulResonance=5;
    r.loadouts.fire.skillLevels.flameSlash=1;
    assert.equal(r.context.v17364CastNewFireTactical(0,"fireSoulResonance"),true);
    const resonance=r.owners.fire.activeBuffs.find(buff=>buff.type==="fireSoulResonance");
    const momentum=r.owners.fire.activeBuffs.find(buff=>buff.type==="fireMomentum");
    assert.ok(resonance);assert.ok(momentum);
    assert.equal(momentum.bonusPercent,25);
    assert.equal(resonance.turnsLeft,3);assert.equal(momentum.turnsLeft,3);

    r.context.turn=1;r.setCrit(true);r.setBurn(false);
    r.context.castDamageSkill("flameSlash",0);
    assert.equal(r.observedBonus(),25);
    assert.equal(resonance.extensionCount,1);
    assert.equal(resonance.turnsLeft,4);
    assert.equal(momentum.turnsLeft,4);

    r.context.castDamageSkill("flameSlash",0);
    assert.equal(resonance.extensionCount,1,"same formal round cannot extend twice");

    r.context.turn=2;r.setCrit(false);r.setBurn(true);
    r.context.castDamageSkill("flameSlash",0);
    assert.equal(resonance.extensionCount,2,"new Burn may extend on a later round");

    r.context.turn=3;r.setCrit(true);r.setBurn(true);
    r.context.castDamageSkill("flameSlash",0);
    assert.equal(resonance.extensionCount,3);
    r.context.turn=4;r.context.castDamageSkill("flameSlash",0);
    assert.equal(resonance.extensionCount,3,"whole cast cannot extend beyond +3 rounds");
});

test("Lv1-Lv4 resonance never uses the Lv5 extension rule",()=>{
    const r=makeRuntime();
    r.loadouts.fire.skillLevels.fireSoulResonance=4;
    r.loadouts.fire.skillLevels.fireRocket=1;
    r.context.v17364CastNewFireTactical(0,"fireSoulResonance");
    const resonance=r.owners.fire.activeBuffs.find(buff=>buff.type==="fireSoulResonance");
    const momentum=r.owners.fire.activeBuffs.find(buff=>buff.type==="fireMomentum");
    assert.ok(momentum);assert.equal(momentum.bonusPercent,21);
    r.setCrit(true);r.setBurn(true);
    r.context.castDamageSkill("fireRocket",0);
    assert.equal(resonance.extensionCount,0);
    assert.equal(resonance.turnsLeft,3);
});

test("Blood Burn pays each level's max-HP cost and buffs exactly four direct casts",()=>{
    const r=makeRuntime();
    r.loadouts.fire.skillLevels.flameSlash=1;
    for(const [level,cost,bonus] of [[1,200,20],[2,250,25],[3,300,30],[4,350,35],[5,400,50]]){
        r.owners.fire.activeBuffs=[];r.owners.fire.hp=1000;r.owners.fire.sp=1000;
        r.loadouts.fire.skillLevels.bloodBurnArt=level;
        assert.equal(r.context.v17364CastNewFireTactical(0,"bloodBurnArt"),true,`Lv${level} can cast`);
        assert.equal(r.owners.fire.hp,1000-cost,`Lv${level} pays exact max-HP percentage`);
        r.freeCast("flameSlash");
        assert.equal(r.observedBonus(),bonus,`Lv${level} free follow-up uses the original cast bonus`);
        assert.equal(r.owners.fire.activeBuffs.find(buff=>buff.type==="bloodBurn")?.remainingFireActions,4,"free follow-up does not consume a charge");
        for(let cast=1;cast<=4;cast++){
            r.context.castDamageSkill("flameSlash",0);
            assert.equal(r.observedBonus(),bonus,`Lv${level} fire cast ${cast} is buffed`);
        }
        assert.equal(r.owners.fire.activeBuffs.some(buff=>buff.type==="bloodBurn"),false,`Lv${level} ends after the fourth valid direct cast`);
        r.context.castDamageSkill("flameSlash",0);
        assert.equal(r.observedBonus(),0,`Lv${level} fourth fire cast is not buffed`);
    }
});

test("resonance and Blood Burn add in one direct-damage bonus bucket",()=>{
    const r=makeRuntime();
    r.loadouts.fire.skillLevels.fireSoulResonance=1;
    r.loadouts.fire.skillLevels.bloodBurnArt=1;
    r.loadouts.fire.skillLevels.flameSlash=1;
    r.context.v17364CastNewFireTactical(0,"fireSoulResonance");
    r.context.v17364CastNewFireTactical(0,"bloodBurnArt");
    r.setCrit(false);r.setBurn(false);
    r.context.castDamageSkill("flameSlash",0);
    assert.equal(r.observedBonus(),32);
    assert.equal(r.skills.flameSlash.damageBonusPercent,undefined,"global skill data is never mutated by a cast bonus");
});

test("duration lifecycle is owned by the core BattleFlow rather than the late progression module",()=>{
    const main=fs.readFileSync("js/00-main.js","utf8");
    assert.match(main,/window\.FourSymbolsDurationLifecycle=Object\.freeze/);
    assert.match(main,/function beginBattleDurationAction\(event\)/);
    assert.match(main,/function finishBattleDurationAction\(\)/);
    assert.match(main,/function finishPlayerAction\(\)[\s\S]*?interceptBattleActionFinish\(\)[\s\S]*?finishBattleDurationAction\(\)/);
    assert.doesNotMatch(source,/window\.FourSymbolsDurationLifecycle=Object\.freeze/);
    assert.doesNotMatch(source,/captureActionDurationEntries|restoreActionDurationEntries|previousStartTurnForDuration/);
});

test("wind and earth support values stay in formal arrays instead of transient skill mutation",()=>{
    const r=makeRuntime();
    assert.deepEqual(Array.from(r.skills.dodgeSkill.evasionBonusPercentByLevel),[5,10,15,20,25]);
    assert.equal(r.skills.dodgeSkill.evasionBonusPercent,undefined);
    assert.deepEqual(Array.from(r.skills.rockWall.defenseBonusPercentByLevel),[15,20,25,30,35]);
    assert.equal(r.skills.rockWall.defenseBonusPercent,undefined);
    assert.deepEqual(Array.from(r.skills.earthShield.reflectPercentByLevel),[20,40,60,80,100]);
    assert.equal(r.skills.earthShield.reflectPercent,undefined);
    assert.equal(r.skills.barrier.barrierBlockCountByLevel,undefined,"Barrier has no charge lifecycle");
    assert.equal(r.skills.earthEX.maxHpMultiplier,1.2,"Earth EX applies Max HP after base sources");
    assert.match(main,/\)\*maxHpPassiveMultiplier\)/,"both player stat owners apply Earth EX after base Max HP");
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

test("player progression is isolated from Abyss fixed levels and lives in gameplay-core",()=>{
    const abyss=fs.readFileSync("js/59-abyss-two-tier-runtime.js","utf8");
    const talisman=fs.readFileSync("js/27-v132-content-expansion.js","utf8");
    const main=fs.readFileSync("js/00-main.js","utf8");
    const build=fs.readFileSync("scripts/build-production.mjs","utf8");
    const featureManifest=JSON.parse(fs.readFileSync("config/feature-manifest.json","utf8"));
    assert.match(abyss,/v132FixedSkillLoadout\s*=\s*true/);
    assert.match(abyss,/v141ForceSkillLevel\s*=\s*config\.skillLevel/);
    assert.doesNotMatch(abyss,/v17364GetRequiredCharacterLevelForSkillLevel|learnLevel/);
    assert.match(talisman,/sharedSkillId/);
    assert.doesNotMatch(talisman,/v17364GetRequiredCharacterLevelForSkillLevel/);
    assert.match(main,/equippedSkills\.length\s*>=\s*4/);
    assert.match(build,/const abyssScripts=\["js\/59-abyss-two-tier-runtime\.js"\]/);
    assert.match(build,/gameplayScripts=\[[\s\S]*?"js\/60-v173\.64-skill-progression-rebalance\.js"/);
    assert.doesNotMatch(build,/const skillScripts=/);
    assert.equal(featureManifest.features.skill,"gameplay-core");
});

function battleSourceBetween(sourceText,startToken,endToken){
    const start=sourceText.indexOf(startToken);
    const end=sourceText.indexOf(endToken,start+startToken.length);
    assert.notEqual(start,-1,"missing start token: "+startToken);
    assert.notEqual(end,-1,"missing end token: "+endToken);
    return sourceText.slice(start,end);
}

test("battle quickbar validates canonical structure and projects formal skill text",()=>{
    const main=fs.readFileSync("js/00-main.js","utf8");
    const css=fs.readFileSync("css/36-v135-fixes.css","utf8");
    assert.match(main,/function isCanonicalSkillQuickBarButton\(button\)/);
    assert.match(main,/buttons\.every\(isCanonicalSkillQuickBarButton\)/);
    assert.match(main,/class="sq-description"/);
    assert.match(main,/formalSpec\.targetLabel/);
    assert.match(main,/formalSpec\.effectText/);
    assert.match(css,/\.skill-quick-button \.sq-description\{/);
});

test("one target owner handles both directions and Stealth only blocks hostile primary selection",()=>{
    const main=fs.readFileSync("js/00-main.js","utf8");
    const slice=battleSourceBetween(
        main,
        "function normalizeBattleTargetType(targetType){",
        "/* =====================================================\n   Persistent-state identity"
    );
    const monsters=[
        {name:"敵A",alive:true,hp:100,activeBuffs:[]},
        {name:"敵B",alive:true,hp:100,activeBuffs:[{type:"stealthSkill",turnsLeft:2}]},
        {name:"敵C",alive:true,hp:100,activeBuffs:[]}
    ];
    const party=[
        {id:"我A",hp:100,activeBuffs:[]},
        {id:"我B",hp:100,activeBuffs:[{type:"stealthSkill",turnsLeft:2}]},
        {id:"我C",hp:100,activeBuffs:[]}
    ];
    const slotOwner={
        getActiveEnemySnapshot(){ return {kind:"test"}; },
        resolveEnemyTargets(_snapshot,primary,shape,isAlive){
            if(shape==="single"){ return isAlive(primary)?[primary]:[]; }
            if(shape==="all"){ return [0,1,2].filter(isAlive); }
            return [0,1,2].filter(isAlive);
        },
        ensureAllyFormation(){ return {kind:"ally-formation"}; },
        resolveAllyTargets(_formation,primary,shape,isAlive){
            if(shape==="single"){ return isAlive(primary)?[primary]:[]; }
            if(shape==="all"){ return [0,1,2].filter(isAlive); }
            return [0,1,2].filter(isAlive);
        }
    };
    const context={
        console,Math,Number,Object,Array,String,Set,Map,
        monsters,currentBattleMonsters:[0,1,2],
        getExistingPartyIndexes:()=>[0,1,2],
        getPartyCharacterByIndex:index=>party[index]||null,
        getEffectiveSkillTargetType:skill=>skill&&skill.targetType||"single",
        getSkillFreezeChanceAtLevel:()=>0,
        getSkillFreezeDurationAtLevel:()=>1,
        hasNamedPersistentState:()=>false,
        FourSymbolsBattlefieldSlots:slotOwner
    };
    context.window=context;
    vm.createContext(context);
    vm.runInContext(slice,context,{filename:"battle-target-owner-slice.js"});

    const owner=context.FourSymbolsBattleSkillTargeting;
    assert.equal(owner.canSelectHostilePrimary("monster",1,"single"),false);
    assert.equal(owner.canSelectHostilePrimary("monster",1,"tri"),false);
    assert.equal(owner.canSelectHostilePrimary("player",1,"single"),false);
    assert.equal(owner.canSelectHostilePrimary("player",1,"column"),false);
    assert.deepEqual(Array.from(owner.resolveTargets("monster",0,"tri",{hostilePrimary:true})),[0,1,2]);
    assert.deepEqual(Array.from(owner.resolveTargets("player",0,"tri",{hostilePrimary:true})),[0,1,2]);
    assert.deepEqual(Array.from(owner.resolveTargets("monster",null,"all",{hostilePrimary:true})),[0,1,2]);
    assert.deepEqual(Array.from(owner.resolveTargets("player",null,"all",{hostilePrimary:true})),[0,1,2]);
});

test("core duration lifecycle consumes existing timed effects once per formal action",()=>{
    const main=fs.readFileSync("js/00-main.js","utf8");
    const slice=battleSourceBetween(
        main,
        "const BATTLE_ACTION_DURATION_STATUS_TYPES=new Set([",
        'if(typeof window!=="undefined"){\n    window.FourSymbolsBattleFlow=Object.freeze({'
    );
    const actor={
        id:"測試角色",hp:100,
        activeBuffs:[
            {type:"rage",turnsLeft:3},
            {type:"bloodBurn",turnsLeft:3,remainingFireActions:3}
        ],
        statusEffects:[
            {type:"freeze",turnsLeft:3},
            {type:"frostbite",turnsLeft:2}
        ]
    };
    const context={
        console,Math,Number,Object,Array,String,Set,Map,
        monsters:[],
        getPartyCharacterByIndex:index=>index===0?actor:null,
        addBattleLog(){},
        v143SyncStatusVisualEffects(){}
    };
    context.window=context;
    vm.createContext(context);
    vm.runInContext(slice,context,{filename:"duration-owner-slice.js"});

    const lifecycle=context.FourSymbolsDurationLifecycle;
    const event={token:1,index:0,queue:[{type:"player",characterIndex:0}]};

    lifecycle.beginAction(event);
    actor.activeBuffs.push({type:"dodgeSkill",turnsLeft:3});
    lifecycle.finishAction();
    assert.equal(actor.activeBuffs.find(x=>x.type==="rage").turnsLeft,2);
    assert.equal(actor.activeBuffs.find(x=>x.type==="dodgeSkill").turnsLeft,3);
    assert.equal(actor.activeBuffs.find(x=>x.type==="bloodBurn").turnsLeft,3);
    assert.equal(actor.statusEffects.find(x=>x.type==="freeze").turnsLeft,2);
    assert.equal(actor.statusEffects.find(x=>x.type==="frostbite").turnsLeft,1);

    lifecycle.beginAction(event);
    lifecycle.finishAction();
    assert.equal(actor.activeBuffs.find(x=>x.type==="rage").turnsLeft,1);
    assert.equal(actor.activeBuffs.find(x=>x.type==="dodgeSkill").turnsLeft,2);
    assert.equal(actor.statusEffects.some(x=>x.type==="frostbite"),false);

    lifecycle.beginAction(event);
    lifecycle.finishAction();
    assert.equal(actor.activeBuffs.some(x=>x.type==="rage"),false);
    assert.equal(actor.statusEffects.some(x=>x.type==="freeze"),false);
    assert.equal(actor.activeBuffs.find(x=>x.type==="dodgeSkill").turnsLeft,1);
});

test("repaired battle paths retire duplicate duration owners",()=>{
    const main=fs.readFileSync("js/00-main.js","utf8");
    const v141=fs.readFileSync("js/34-v141-core-systems.js","utf8");
    const enemySupport=fs.readFileSync("js/36-v141-content-systems.js","utf8");
    const v142=fs.readFileSync("js/37-v142-skill-animation.js","utf8");
    const v144=fs.readFileSync("js/40-v144-rules-and-abyss.js","utf8");
    const v155=fs.readFileSync("js/46-v155-dev-fixes.js","utf8");
    assert.doesNotMatch(source,/FourSymbolsDurationLifecycle=Object\.freeze/);
    assert.doesNotMatch(source,/captureActionDurationEntries|restoreActionDurationEntries|previousStartTurnForDuration/);
    assert.doesNotMatch(v141,/lastShieldTickKey/);
    assert.doesNotMatch(enemySupport,/lastAbyssBuffTick/);
    assert.doesNotMatch(v142,/v142ResolveExtremeEmperorAction|v142AgilityBlessing|turnsLeft--/);
    assert.doesNotMatch(v144,/v144AbyssBuffTick/);
    assert.doesNotMatch(v155,/tickV155TimedStates/);
    assert.match(main,/function finishPlayerAction\(\)[\s\S]*?interceptBattleActionFinish\(\)[\s\S]*?finishBattleDurationAction\(\)/);
});

test("Stealth presentation dims only combatant artwork to 35 percent",()=>{
    const vfx=fs.readFileSync("js/39-v143-skill-animation.js","utf8");
    const css=fs.readFileSync("css/40-v143-combat-dungeon-polish.css","utf8");
    assert.match(vfx,/classList\.toggle\("v143-unit-stealthed",stealthActive\)/);
    assert.match(vfx,/querySelectorAll\("\.v143-unit-stealthed"\)[\s\S]*?classList\.remove\("v143-unit-stealthed"\)/);
    assert.match(css,/\.battle-player\.v143-unit-stealthed > \.v174-battle-art[\s\S]*?opacity:\.35 !important/);
    assert.match(css,/\.battle-monster\.v143-unit-stealthed > \.v174-battle-art[\s\S]*?opacity:\.35 !important/);
});
