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
        learnSkill(){},upgradeSkill(){},
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
    assert.deepEqual(Array.from(r.skills.bloodBurnArt.hpCostPercentByLevel),[5,10,15,20,25]);
    assert.deepEqual(Array.from(r.skills.bloodBurnArt.directDamageBonusByLevel),[5,10,15,20,35]);
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
    assert.deepEqual(Array.from(r.skills.earthShield.reflectPercentByLevel),[20,30,35,40,50]);
    assert.deepEqual(Array.from(r.skills.earthShield.durationByLevel),[3,3,3,4,5]);
    assert.deepEqual([r.skills.barrier.maxLevel,...Array.from(r.skills.barrier.barrierBlockCountByLevel)],[5,3,3,3,4,5]);
    assert.deepEqual(Array.from(r.skills.barrier.durationByLevel),[3,3,3,4,5]);
    assert.deepEqual(Array.from(r.skills.rockWall.requires),["petrifyFist","sandWind"]);
    assert.deepEqual(Array.from(r.skills.earthShield.requires),["rockWall"]);
    assert.deepEqual(Array.from(r.skills.barrier.requires),["earthShield"]);
    assert.equal(r.skills.stormSpell.learnLevel,undefined,"monster-only 暴風術不進玩家 progression");
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

test("Blood Burn pays each level's max-HP cost and buffs exactly three non-free fire casts",()=>{
    const r=makeRuntime();
    r.loadouts.fire.skillLevels.flameSlash=1;
    for(const [level,cost,bonus] of [[1,50,5],[2,100,10],[3,150,15],[4,200,20],[5,250,35]]){
        r.owners.fire.activeBuffs=[];r.owners.fire.hp=1000;r.owners.fire.sp=1000;
        r.loadouts.fire.skillLevels.bloodBurnArt=level;
        assert.equal(r.context.v17364CastNewFireTactical(0,"bloodBurnArt"),true,`Lv${level} can cast`);
        assert.equal(r.owners.fire.hp,1000-cost,`Lv${level} pays exact max-HP percentage`);
        r.freeCast("flameSlash");
        assert.equal(r.observedBonus(),0,`Lv${level} free follow-up receives no Blood Burn bonus`);
        assert.equal(r.owners.fire.activeBuffs.find(buff=>buff.type==="bloodBurn")?.remainingFireActions,3,"free follow-up does not consume a charge");
        for(let cast=1;cast<=3;cast++){
            r.context.castDamageSkill("flameSlash",0);
            assert.equal(r.observedBonus(),bonus,`Lv${level} fire cast ${cast} is buffed`);
        }
        assert.equal(r.owners.fire.activeBuffs.some(buff=>buff.type==="bloodBurn"),false,`Lv${level} ends after the third valid fire cast`);
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
    assert.equal(r.observedBonus(),17);
    assert.equal(r.skills.flameSlash.damageBonusPercent,undefined,"temporary bucket contribution is restored after the cast");
});

test("duration lifecycle counts effective actions, blocked actions and never consumes a newly-cast buff",()=>{
    const r=makeRuntime();
    const actor=r.owners.fire;
    actor.activeBuffs=[{type:"rage",turnsLeft:3}];
    actor.statusEffects=[{type:"freeze",turnsLeft:3},{type:"frostbite",turnsLeft:2}];
    for(let action=1;action<=3;action++){
        r.beginAction({type:"player",characterIndex:0});
        if(action===1){ actor.activeBuffs.push({type:"dodgeSkill",turnsLeft:3}); }
        r.finishAction();
        if(action<3){
            assert.equal(actor.activeBuffs.find(buff=>buff.type==="rage")?.turnsLeft,3-action,`rage action ${action}`);
            assert.equal(actor.statusEffects.find(effect=>effect.type==="freeze")?.turnsLeft,3-action,`freeze blocks action ${action}`);
        }
    }
    assert.equal(actor.activeBuffs.some(buff=>buff.type==="rage"),false,"three effective actions exhaust a three-turn buff");
    assert.equal(actor.statusEffects.some(effect=>effect.type==="freeze"),false,"three blocked actions exhaust a three-turn Freeze");
    assert.equal(actor.activeBuffs.find(buff=>buff.type==="dodgeSkill")?.turnsLeft,1,"a buff created during the action does not lose that action");
    assert.equal(actor.statusEffects.some(effect=>effect.type==="frostbite"),false,"two affected actions exhaust two-turn Frostbite");
});

test("wind and earth support values stay in formal arrays instead of transient skill mutation",()=>{
    const r=makeRuntime();
    assert.deepEqual(Array.from(r.skills.dodgeSkill.evasionBonusPercentByLevel),[5,10,15,20,25]);
    assert.equal(r.skills.dodgeSkill.evasionBonusPercent,undefined);
    assert.deepEqual(Array.from(r.skills.rockWall.defenseBonusPercentByLevel),[15,20,25,30,35]);
    assert.equal(r.skills.rockWall.defenseBonusPercent,undefined);
    assert.deepEqual(Array.from(r.skills.earthShield.reflectPercentByLevel),[20,30,35,40,50]);
    assert.equal(r.skills.earthShield.reflectPercent,undefined);
    assert.deepEqual(Array.from(r.skills.barrier.barrierBlockCountByLevel),[3,3,3,4,5]);
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
