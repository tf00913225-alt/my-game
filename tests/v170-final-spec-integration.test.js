"use strict";

/*
 * V170 FINAL INTEGRATION SPEC
 *
 * This suite is the only test that represents the fully loaded V170 rules.
 * Tests named after V140/V149/V155/V158/V169 are historical snapshots of one
 * patch layer and must not be used as the current source of truth.
 */

const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const MAIN_BASELINE_SHA="9115b66988feb992822826eb5397e9515b4d795e";
const mainSource=fs.readFileSync("js/00-main.js","utf8");
const indexSource=fs.readFileSync("index.html","utf8");
const loaderSource=fs.readFileSync("js/20-anonymous-20.js","utf8");

const EXPECTED_DIRECT_SCRIPT_PATHS=[
    "js/23-v125-character-creation-bootstrap.js",
    "js/00-main.js",
    "js/01-stage-v8-touch-lock.js",
    "js/02-stage-v9-native-coordinate-api.js",
    "js/03-stage-v10-battle-log-scroll-runtime.js",
    "js/04-stage-v11-native-bottom-nav-runtime.js",
    "js/05-stage-v13-native-map-nav-runtime.js",
    "js/06-stage-v39-battle-map-background-runtime.js",
    "js/07-stage-v40-root-battle-background-runtime.js",
    "js/08-stage-v41-runtime.js",
    "js/09-stage-v45-runtime.js",
    "js/10-stage-v46-runtime.js",
    "js/11-stage-v47-runtime.js",
    "js/12-stage-v48-runtime.js",
    "js/13-stage-v49-runtime.js",
    "js/14-stage-v50-runtime.js",
    "js/15-stage-v51-runtime.js",
    "js/16-stage-v54-main-city-runtime.js",
    "js/17-stage-v60-training-render-guard.js",
    "js/18-stage-v64-character-touch-action-runtime.js",
    "js/19-stage-v78-character-inventory-runtime.js",
    "js/20-anonymous-20.js",
    "js/24-v125-character-creation-native-runtime.js"
];

const EXPECTED_RUNTIME_PATHS=[
    "js/25-v131-fix-batch.js",
    "js/27-v132-content-expansion.js",
    "js/28-v133-economy-rebalance.js",
    "js/29-v134-fixes.js",
    "js/30-v135-fixes.js",
    "js/31-v136-auto-battle-fix.js",
    "js/32-v139-rested-experience.js",
    "js/33-v140-four-element-balance.js",
    "js/34-v141-core-systems.js",
    "js/35-v141-ui-battle.js",
    "js/36-v141-content-systems.js",
    "js/37-v142-skill-animation.js",
    "js/38-v143-system-fixes.js",
    "js/39-v143-skill-animation.js",
    "js/40-v144-rules-and-abyss.js",
    "js/41-v146-system-polish.js",
    "js/42-v148-combat-dungeon-fixes.js",
    "js/43-v149-skill-ui-rules.js",
    "js/44-v152-dev-fixes.js",
    "js/45-v154-dev-fixes.js",
    "js/46-v155-dev-fixes.js",
    "js/47-v158-combat-tuning.js",
    "js/48-v159-abyss-battle-portraits.js",
    "js/49-v169-element-box-settings.js",
    "js/50-v169-water-skill-rules.js",
    "js/51-v169-rpg-ui.js"
];

/* damage, growth, SP, target, learn, upgrade, max, prerequisites */
const FINAL_FOUR_ELEMENT_CORE={
    flameSlash:[17,10,8,"single",2,1,5,[]],
    fireCritical:[39,13,15,"single",10,1,5,["flameSlash"]],
    explosiveFlurry:[35,15,22,"tri",20,1,5,["fireCritical"]],
    dragonSlash:[165,25,65,"single",45,1,5,["explosiveFlurry"]],
    fireRocket:[17,8,8,"tri",2,1,5,[]],
    blazeSpell:[42,15,15,"single",10,1,5,["fireRocket"]],
    flameTornado:[135,13,55,"single",30,1,5,["blazeSpell"]],
    phoenixCry:[60,18,68,"all",45,1,5,["flameTornado"]],
    rage:[null,null,65,"allyTri",25,1,5,["explosiveFlurry","flameTornado"]],
    fireEX:[null,null,null,"none",25,null,1,[]],

    waterKnife:[13,3,6,"single",2,1,5,[]],
    frostPunch:[30,8,17,"single",10,1,5,["waterKnife"]],
    iceSpin:[25,7,45,"tri",20,1,5,["frostPunch"]],
    frostCrush:[100,15,60,"single",30,1,5,["iceSpin"]],
    waterBall:[17,3,8,"tri",2,1,5,[]],
    floodBeast:[85,8,35,"single",15,1,5,["waterBall"]],
    iceArrowRain:[30,12,75,"all",20,1,5,["floodBeast"]],
    freeze:[null,null,32,"single",25,null,1,["iceArrowRain"]],
    healSpell:[null,null,45,"allyAll",20,1,5,["iceArrowRain","iceSpin"]],
    revive:[null,null,45,"deadAlly",20,1,5,["healSpell"]],
    waterEX:[null,null,null,"none",25,null,1,[]],

    stormFist:[14,2,7,"single",2,1,5,[]],
    stormFlurry:[28,7,20,"tri",10,1,5,["stormFist"]],
    windCrossSlash:[90,12,39,"single",15,1,5,["stormFlurry"]],
    dizzyFist:[120,15,55,"single",30,1,5,["stormFlurry"]],
    windSpell:[18,2,9,"tri",2,1,5,[]],
    stormCircle:[38,9,18,"row",10,1,5,["windSpell"]],
    windHowlLightning:[98,15,55,"single",15,1,5,["stormCircle"]],
    stormRain:[48,14,75,"all",30,1,5,["windHowlLightning"]],
    dodgeSkill:[null,null,20,"allyAll",10,null,1,["windCrossSlash","windHowlLightning"]],
    stealthSkill:[null,null,45,"ally",15,null,1,["dodgeSkill"]],
    dinghaishenzhen:[null,null,77,"allyAll",20,null,1,["stealthSkill"]],
    windEX:[null,null,null,"none",25,null,1,[]],

    stoneSlash:[14,2,7,"single",2,1,5,[]],
    petrifyFist:[28,7,26,"tri",10,1,5,["stoneSlash"]],
    stoneBreakSky:[65,9,42,"single",15,1,5,["petrifyFist"]],
    earthquakeCrush:[48,14,55,"tri",30,1,5,["stoneBreakSky"]],
    stoneThrow:[14,2,7,"tri",2,1,5,[]],
    sandWind:[17,5,19,"row",10,1,5,["stoneThrow"]],
    flyingSandStrike:[35,8,26,"all",15,1,5,["sandWind"]],
    dustStorm:[98,15,55,"single",30,1,5,["flyingSandStrike"]],
    earthShield:[null,null,66,"allyAll",10,null,1,["stoneBreakSky","flyingSandStrike"]],
    rockWall:[null,null,45,"allyAll",15,null,1,["barrier"]],
    barrier:[null,null,40,"ally",20,null,1,["earthShield"]],
    earthEX:[null,null,null,"none",25,null,1,[]]
};

function extractRuntimePaths(){
    const block=loaderSource.match(/const runtimes=\[([\s\S]*?)\n\s*\];/);
    assert.ok(block,"js/20 runtime list must exist");
    return Array.from(block[1].matchAll(/src:"([^"]+\.js)"/g),match=>match[1]);
}

function makeUniversalNode(){
    const style={setProperty(){},removeProperty(){},getPropertyValue(){ return ""; }};
    const classList={add(){},remove(){},toggle(){ return false; },contains(){ return false; }};
    let node;
    const target=function(){ return node; };
    node=new Proxy(target,{
        get(_target,property){
            if(property===Symbol.iterator){ return function* empty(){}; }
            if(property===Symbol.toPrimitive){ return ()=>0; }
            if(property==="length"){ return 0; }
            if(property==="style"){ return style; }
            if(property==="dataset"){ return {}; }
            if(property==="classList"){ return classList; }
            if(property==="querySelector"){ return ()=>null; }
            if(property==="querySelectorAll"){ return ()=>[]; }
            if(property==="getBoundingClientRect"){
                return ()=>({left:0,top:0,right:0,bottom:0,width:0,height:0});
            }
            if(property==="appendChild"){ return child=>child; }
            if(property==="toJSON"){ return ()=>({}); }
            return node;
        },
        set(){ return true; },apply(){ return node; },construct(){ return node; }
    });
    return node;
}

function makeContext(){
    const noop=()=>{};
    const dummy=makeUniversalNode();
    const storage=()=>({getItem:()=>null,setItem:noop,removeItem:noop,clear:noop});
    const document={
        readyState:"loading",hidden:false,body:dummy,head:dummy,documentElement:dummy,
        activeElement:null,getElementById:()=>dummy,querySelector:()=>null,querySelectorAll:()=>[],
        createElement:()=>dummy,createTextNode:()=>dummy,
        addEventListener:noop,removeEventListener:noop,dispatchEvent:()=>true
    };
    class EmptyObserver{ observe(){} disconnect(){} }
    class EmptyEvent{ constructor(type,options){ this.type=type; Object.assign(this,options||{}); } }
    const context={
        console,document,navigator:{userAgent:"node-v170-integration",maxTouchPoints:0},
        location:{hash:"",href:"",reload:noop},history:{pushState:noop,replaceState:noop},
        localStorage:storage(),sessionStorage:storage(),
        setTimeout:()=>1,clearTimeout:noop,setInterval:()=>1,clearInterval:noop,
        requestAnimationFrame:()=>1,cancelAnimationFrame:noop,queueMicrotask:noop,
        addEventListener:noop,removeEventListener:noop,dispatchEvent:()=>true,
        scrollTo:noop,getComputedStyle:()=>({getPropertyValue:()=>"",display:"none",position:"static"}),
        MutationObserver:EmptyObserver,ResizeObserver:EmptyObserver,
        HTMLElement:function(){},Node:function(){},Event:EmptyEvent,CustomEvent:EmptyEvent,
        Image:function(){ return dummy; },Audio:function(){ return dummy; },
        FileReader:function(){ return dummy; },Blob:function(){},URL:{createObjectURL:()=>"",revokeObjectURL:noop},
        fetch:async()=>({ok:true,json:async()=>({}),text:async()=>""}),
        alert:noop,confirm:()=>true,prompt:()=>null,
        performance:{now:()=>0},crypto:{randomUUID:()=>"v170-test-id"},
        CSS:{escape:value=>String(value)},
        Math:Object.create(Math),Date,Number,String,Boolean,Object,Array,
        Set,Map,WeakMap,WeakSet,Promise,JSON,RegExp,Error,TypeError,parseInt,parseFloat,isNaN
    };
    context.window=context;
    context.self=context;
    context.globalThis=context;
    return vm.createContext(context);
}

function loadFinalRuntime(){
    const context=makeContext();
    const loaded=[];
    EXPECTED_DIRECT_SCRIPT_PATHS.forEach(path=>{
        vm.runInContext(fs.readFileSync(path,"utf8"),context,{filename:path,timeout:2000});
        loaded.push(path);
    });
    extractRuntimePaths().forEach(path=>{
        vm.runInContext(fs.readFileSync(path,"utf8"),context,{filename:path,timeout:2000});
        loaded.push(path);
    });
    const skills=JSON.parse(vm.runInContext("JSON.stringify(skillDatabase)",context));
    return {context,loaded,skills};
}

let passed=0;
function test(name,handler){
    handler();
    passed++;
    console.log("✓ "+name);
}

function normalizedCore(skill){
    const value=field=>skill[field]===undefined?null:skill[field];
    return [
        value("baseDamage"),value("damagePerLevel"),value("spCost"),
        value("targetType"),value("learnCost"),value("upgradeCost"),
        value("maxLevel"),Array.from(skill.requires||[])
    ];
}

function evaluateJson(context,expression){
    return JSON.parse(vm.runInContext("JSON.stringify("+expression+")",context));
}

function executeFullWaterCast(skillId){
    const runtime=loadFinalRuntime();
    return evaluateJson(runtime.context,`(function(){
        const skillId=${JSON.stringify(skillId)};
        Object.assign(player,{
            id:"水角",element:"water",level:50,hp:1000,sp:1000,
            activeBuffs:[],statusEffects:[]
        });
        characterSkillLoadouts.fire.skillLevels[skillId]=1;
        monsters.splice(0,monsters.length);
        currentBattleMonsters.splice(0,currentBattleMonsters.length);
        for(let index=0;index<10;index++){
            monsters.push({
                name:"怪"+index,level:50,hp:10000,maxHP:10000,sp:100,maxSP:100,
                alive:true,element:"fire",defense:0,evasion:0,spiritPoints:0,
                activeBuffs:[],statusEffects:[]
            });
            currentBattleMonsters.push(index);
        }
        selectedMonster=4;
        battleActive=true;
        autoBattle=false;
        getMainCharacterStats=function(){
            return {attack:0,magicAttack:0,intelligence:0,accuracy:1000,maxHP:1000,maxSP:1000};
        };
        getMonsterEvasion=function(){ return 0; };
        getMonsterEffectiveSpiritPoints=function(){ return 0; };
        getMonsterRank=function(){ return "regular"; };
        updateUI=function(){};
        finishPlayerAction=function(){};
        lungePlayerCard=function(){};
        showSkillNameBadge=function(){};
        showPlayerSpPopup=function(){};
        showMonsterHit=function(){};
        showMissEffect=function(){};
        addBattleLog=function(){};
        Math.random=()=>0;
        const before=monsters.map(monster=>monster.hp);
        castDamageSkill(skillId);
        return {before:before,after:monsters.map(monster=>monster.hp),
            effects:monsters.map(monster=>monster.statusEffects),sp:player.sp};
    })()`);
}

test("V170 baseline and the real index/js20 runtime order are pinned",()=>{
    assert.equal(MAIN_BASELINE_SHA,"9115b66988feb992822826eb5397e9515b4d795e");
    const directScripts=Array.from(indexSource.matchAll(/<script\b[^>]*\bsrc="([^"?]+)(?:\?[^\"]*)?"/g),match=>match[1]);
    assert.deepEqual(directScripts,EXPECTED_DIRECT_SCRIPT_PATHS);
    assert.deepEqual(extractRuntimePaths(),EXPECTED_RUNTIME_PATHS);
    EXPECTED_RUNTIME_PATHS.forEach(path=>assert.equal(fs.existsSync(path),true,path));
});

test("all V170 formal runtimes execute once in production order",()=>{
    const runtime=loadFinalRuntime();
    assert.deepEqual(runtime.loaded,EXPECTED_DIRECT_SCRIPT_PATHS.concat(EXPECTED_RUNTIME_PATHS));
});

test("the complete four-element V170 core table is final after every patch",()=>{
    const skills=loadFinalRuntime().skills;
    assert.equal(Object.keys(FINAL_FOUR_ELEMENT_CORE).length,45);
    Object.entries(FINAL_FOUR_ELEMENT_CORE).forEach(([id,expected])=>{
        assert.deepEqual(normalizedCore(skills[id]),expected,id);
    });
});

test("Burn, Frostbite, Freeze and every other final status definition are exact",()=>{
    const skills=loadFinalRuntime().skills;
    const expected={
        flameTornado:{burnChance:30,burnDuration:2,burnPercentByLevel:[3,4,5,6,8]},
        phoenixCry:{burnChance:70,burnDuration:2,burnPercentByLevel:[5,7,9,11,13],burnBonusOnNoTargetsPercent:50,burnBonusDuration:1},
        iceSpin:{frostbiteChance:30,frostbiteDuration:1},
        frostCrush:{frostbiteChance:40,frostbiteDuration:1},
        floodBeast:{frostbiteChance:40,frostbiteDuration:1},
        iceArrowRain:{frostbiteChance:20,frostbiteDuration:1},
        freeze:{freezeChance:90,freezeDuration:5},
        stormFist:{agilityDownChance:50,agilityDownByLevel:[30,40,50,60,70],agilityDownDuration:1},
        stormFlurry:{damageDownChance:50,damageDownByLevel:[10,20,30,40,50],damageDownDuration:2},
        windCrossSlash:{damageDownChance:65,damageDownByLevel:[15,20,25,30,35],damageDownDuration:1},
        dizzyFist:{stunChance:65,missBonusByLevel:[30,45,50,55,65],stunDuration:5},
        windSpell:{agilityDownChance:50,agilityDownByLevel:[10,20,30,40,50],agilityDownDuration:1},
        stormCircle:{damageDownChance:55,damageDownByLevel:[15,18,21,25,30],damageDownDuration:1},
        windHowlLightning:{damageDownChance:65,damageDownByLevel:[15,20,25,30,35],damageDownDuration:1},
        stormRain:{stunChance:35,missBonusByLevel:[30,45,50,55,65],stunDuration:1},
        stoneSlash:{defenseDownChance:65,defenseDownByLevel:[10,20,30,40,50],defenseDownDuration:1},
        stoneThrow:{defenseDownChance:65,defenseDownByLevel:[10,20,30,40,50],defenseDownDuration:1},
        sandWind:{defenseDownChance:65,defenseDownByLevel:[10,20,30,40,50],defenseDownDuration:1},
        flyingSandStrike:{petrifyChanceByLevel:[25,35,45,55,65],petrifyDuration:2},
        dustStorm:{defenseDownChance:60,defenseDownByLevel:[10,15,20,25,35],defenseDownDuration:1},
        earthquakeCrush:{petrifyChanceByLevel:[30,35,40,45,50],petrifyDuration:3}
    };
    Object.entries(expected).forEach(([id,fields])=>{
        Object.entries(fields).forEach(([field,value])=>assert.deepEqual(skills[id][field],value,id+"."+field));
    });
    ["iceSpin","frostCrush","floodBeast","iceArrowRain"].forEach(id=>{
        ["freezeChance","freezeDuration","freezeSingleTarget","teamFreezeChance","teamFreezeDuration"].forEach(field=>{
            assert.equal(skills[id][field],undefined,id+" must not retain "+field);
        });
    });
    assert.equal(skills.freeze.baseDamage,undefined);
    assert.equal(skills.freeze.frostbiteChance,undefined);
    assert.equal(skills.earthquakeCrush.selfShieldByLevel,undefined);
});

test("final normal hit and status-effect bounds override the historical floors",()=>{
    const runtime=loadFinalRuntime();
    const hit=runtime.context.v158GetHitChancePercent;
    assert.deepEqual(
        [hit(0,0,0),hit(10,0,0),hit(0,10,0),hit(0,1000,0),hit(0,1000,50),hit(1000,0,0)],
        [95,98,92,80,60,99]
    );
    const status=runtime.context.v140CalculateStatusEffectChance;
    assert.equal(status(50,10,10,100,20,false,"regular",0,"physical"),64);
    assert.equal(status(50,10,10,100,20,false,"regular",0,"magic"),74);
    assert.deepEqual(
        ["regular","elite","boss"].map(rank=>status(90,10,10,100,0,true,rank,0,"magic")),
        [80,60,40]
    );
});

test("status refresh, hard-control exclusion and Frostbite action blocking remain active",()=>{
    const runtime=loadFinalRuntime();
    const result=evaluateJson(runtime.context,`(function(){
        const target={name:"狀態目標",hp:100,maxHP:100,alive:true,statusEffects:[]};
        applyBurnEffect(target,2,3);
        applyBurnEffect(target,2,8);
        const burn=target.statusEffects.filter(effect=>effect.type==="burn");
        applyFreezeEffect(target,5);
        applyMonsterDebuff(target,"petrify",3,0);
        const afterPetrify=target.statusEffects.map(effect=>effect.type);
        applyFreezeEffect(target,5);
        const afterFreeze=target.statusEffects.map(effect=>effect.type);

        monsters.splice(0,monsters.length,{
            name:"極帝天尊",element:"light",level:100,hp:1000,maxHP:1000,sp:500,maxSP:1000,
            alive:true,evasion:100,activeBuffs:[],statusEffects:[{type:"frostbite",turnsLeft:1}],
            v141Abyss:true,v155FinalAbyss:true
        });
        currentBattleMonsters.splice(0,currentBattleMonsters.length,0);
        const action=v141TryMonsterSpecialAction(0);
        return {burn:burn,afterPetrify:afterPetrify,afterFreeze:afterFreeze,action:action,sp:monsters[0].sp};
    })()`);
    assert.deepEqual(result,{
        burn:[{type:"burn",turnsLeft:2,percent:8}],
        afterPetrify:["burn","petrify"],afterFreeze:["burn","freeze"],
        action:false,sp:500
    });
});

test("Flood Beast stays single-target while Ice Arrow Rain resolves every living enemy",()=>{
    const runtime=loadFinalRuntime();
    vm.runInContext(`
        monsters.splice(0,monsters.length);
        currentBattleMonsters.splice(0,currentBattleMonsters.length);
        for(let index=0;index<10;index++){
            monsters.push({name:"目標"+index,level:50,hp:1000,maxHP:1000,alive:true,statusEffects:[]});
            currentBattleMonsters.push(index);
        }
    `,runtime.context);
    assert.deepEqual(evaluateJson(runtime.context,"getSkillTargets(4,skillDatabase.floodBeast.targetType)"),[4]);
    assert.deepEqual(evaluateJson(runtime.context,"getSkillTargets(4,skillDatabase.iceArrowRain.targetType)"),[0,1,2,3,4,5,6,7,8,9]);
    assert.match(mainSource,/getSkillTargets\(\s*centerIndex,\s*skill\.targetType\s*\)[\s\S]*?targets\.forEach\(index=>/);

    const flood=executeFullWaterCast("floodBeast");
    assert.deepEqual(flood.after.map((hp,index)=>hp<flood.before[index]),[
        false,false,false,false,true,false,false,false,false,false
    ]);
    assert.deepEqual(flood.effects,[
        [],[],[],[],[{type:"frostbite",turnsLeft:1,value:0}],[],[],[],[],[]
    ]);
    assert.equal(flood.effects.flat().some(effect=>effect.type==="freeze"),false);
    assert.equal(flood.sp,965);

    const rain=executeFullWaterCast("iceArrowRain");
    assert.deepEqual(rain.after.map((hp,index)=>hp<rain.before[index]),Array(10).fill(true));
    assert.deepEqual(
        rain.effects.map(effects=>effects.map(effect=>[effect.type,effect.turnsLeft])),
        Array.from({length:10},()=>[["frostbite",1]])
    );
    assert.equal(rain.effects.flat().some(effect=>effect.type==="freeze"),false);
    assert.equal(rain.sp,925);
});

test("Heal Spell restores allies but never refunds the caster's own SP",()=>{
    const runtime=loadFinalRuntime();
    const result=evaluateJson(runtime.context,`(function(){
        Object.assign(player,{
            id:"施法者",element:"water",level:50,hp:100,sp:100,
            attack:0,vitality:0,energy:0,intelligence:0,spirit:0,agility:0,
            bonusHP:0,bonusSP:0,activeBuffs:[],statusEffects:[]
        });
        player2={
            id:"隊友",element:"fire",level:50,hp:200,sp:10,
            attack:0,vitality:0,energy:0,intelligence:0,spirit:0,agility:0,
            bonusHP:0,bonusSP:0,activeBuffs:[],statusEffects:[]
        };
        player3=null;
        getPartyBattleStats=function(){ return {maxHP:1000,maxSP:1000,intelligence:0}; };
        getSkillLevel=function(_key,skillId){ return skillId==="healSpell"?1:0; };
        updateUI=function(){};
        battleActive=true;
        activeBattleCharacterIndex=0;
        const settled=v148ResolveSupportAction(0,{action:"healSpell",targetAlly:0},skillDatabase.healSpell);
        return {
            settled:settled,
            caster:{hp:player.hp,sp:player.sp},
            ally:{hp:player2.hp,sp:player2.sp},
            data:{baseHeal:skillDatabase.healSpell.baseHeal,healPerLevel:skillDatabase.healSpell.healPerLevel,
                baseHealSP:skillDatabase.healSpell.baseHealSP,healSPPerLevel:skillDatabase.healSpell.healSPPerLevel,
                spCost:skillDatabase.healSpell.spCost,targetType:skillDatabase.healSpell.targetType}
        };
    })()`);
    assert.deepEqual(result,{
        settled:true,caster:{hp:650,sp:55},ally:{hp:750,sp:75},
        data:{baseHeal:550,healPerLevel:30,baseHealSP:65,healSPPerLevel:30,spCost:45,targetType:"allyAll"}
    });
});

function prepareExtremeEmperor(context){
    vm.runInContext(`
        monsters.splice(0,monsters.length,
            {name:"極帝天尊",element:"light",level:100,hp:500,maxHP:1000,sp:500,maxSP:1000,
                alive:true,evasion:100,agility:80,activeBuffs:[],statusEffects:[{type:"burn",turnsLeft:2}]},
            {name:"天兵天將",element:"fire",level:100,hp:400,maxHP:1000,sp:10,maxSP:1000,
                alive:true,evasion:100,agility:80,activeBuffs:[],statusEffects:[{type:"stun",turnsLeft:1}]}
        );
        currentBattleMonsters.splice(0,currentBattleMonsters.length,0,1);
        battleToken="v170-emperor-test";
        turn=10;
    `,context);
}

test("the three Extreme Emperor skills settle with the final V155 behavior",()=>{
    const healRuntime=loadFinalRuntime();
    prepareExtremeEmperor(healRuntime.context);
    const heal=evaluateJson(healRuntime.context,`(function(){
        const ok=v155ResolveExtremeEmperorAction(0,"yuanXiangGuangMing",false);
        return {ok:ok,allies:monsters.map(monster=>({hp:monster.hp,sp:monster.sp,evasion:monster.evasion,statusEffects:monster.statusEffects}))};
    })()`);
    assert.deepEqual(heal,{
        ok:true,allies:[
            {hp:650,sp:520,evasion:100,statusEffects:[{type:"burn",turnsLeft:2}]},
            {hp:550,sp:65,evasion:100,statusEffects:[{type:"stun",turnsLeft:1}]}
        ]
    });

    const shieldRuntime=loadFinalRuntime();
    prepareExtremeEmperor(shieldRuntime.context);
    const shield=evaluateJson(shieldRuntime.context,`(function(){
        const ok=v155ResolveExtremeEmperorAction(0,"yuanGuangShield",false);
        return {ok:ok,sp:monsters[0].sp,shields:monsters.map(monster=>({remaining:monster.v141Shield.remaining,turnsLeft:monster.v141Shield.turnsLeft}))};
    })()`);
    assert.deepEqual(shield,{ok:true,sp:460,shields:[{remaining:100,turnsLeft:2},{remaining:100,turnsLeft:2}]});

    const blessingRuntime=loadFinalRuntime();
    prepareExtremeEmperor(blessingRuntime.context);
    const blessing=evaluateJson(blessingRuntime.context,`(function(){
        const first=v155ResolveExtremeEmperorAction(0,"yuanZuBlessing",true);
        const afterFirst=monsters.map(monster=>({evasion:monster.evasion,statusEffects:monster.statusEffects,
            turnsLeft:monster.v155EvasionBlessing.displayBuff.turnsLeft}));
        monsters[0].sp=500;
        const second=v155ResolveExtremeEmperorAction(0,"yuanZuBlessing",false);
        return {first:first,second:second,afterFirst:afterFirst,
            afterSecond:monsters.map(monster=>({evasion:monster.evasion,blessings:monster.activeBuffs.filter(buff=>buff.v141BuffType==="dodge").length}))};
    })()`);
    assert.deepEqual(blessing,{
        first:true,second:true,
        afterFirst:[
            {evasion:130,statusEffects:[],turnsLeft:2},
            {evasion:130,statusEffects:[],turnsLeft:2}
        ],
        afterSecond:[{evasion:130,blessings:1},{evasion:130,blessings:1}]
    });

    const data=healRuntime.skills;
    assert.deepEqual(
        [data.yuanXiangGuangMing.spCost,data.yuanXiangGuangMing.baseHeal,data.yuanXiangGuangMing.baseHealSP,
            data.yuanGuangShield.spCost,data.yuanGuangShield.shieldAmount,data.yuanGuangShield.shieldDuration,
            data.yuanZuBlessing.spCost,data.yuanZuBlessing.cleanseChance,data.yuanZuBlessing.evasionBonusPercent,data.yuanZuBlessing.duration],
        [35,150,55,40,100,2,45,20,30,2]
    );
    assert.equal(data.yuanZuBlessing.agilityBonusPercent,undefined);
});

console.log("\nV170 final integration suite: "+passed+" tests passed.");
