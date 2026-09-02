"use strict";

/*
 * CURRENT FINAL INTEGRATION SPEC (V173.34)
 *
 * This suite represents the fully loaded current rules.
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
    "js/52-v173.20-startup-loader.js",
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
    flameSlash:[30,6,10,"single",2,1,5,[]],
    fireCritical:[45,9,28,"single",10,1,5,["flameSlash"]],
    explosiveFlurry:[50,10,47,"tri",20,1,5,["fireCritical"]],
    dragonSlash:[165,33,65,"single",35,1,5,["explosiveFlurry"]],
    fireRocket:[13,4,10,"tri",2,1,5,[]],
    blazeSpell:[45,9,28,"single",10,1,5,["fireRocket"]],
    flameTornado:[150,30,47,"single",30,1,5,["blazeSpell"]],
    phoenixCry:[28,6,60,"all",35,1,5,["flameTornado"]],
    rage:[null,null,50,"allyTri",25,1,5,["explosiveFlurry","flameTornado"]],
    fireEX:[null,null,null,"none",25,null,1,[]],

    waterKnife:[21,5,6,"single",2,1,5,[]],
    frostPunch:[32,7,17,"single",10,1,5,["waterKnife"]],
    iceSpin:[35,7,45,"tri",20,1,5,["frostPunch"]],
    frostCrush:[116,24,60,"single",30,1,5,["iceSpin"]],
    waterBall:[10,2,8,"tri",2,1,5,[]],
    floodBeast:[105,21,35,"single",15,1,5,["waterBall"]],
    iceArrowRain:[20,4,75,"all",20,1,5,["floodBeast"]],
    freeze:[null,null,32,"column",25,null,1,["iceArrowRain"]],
    healSpell:[null,null,45,"allyTri",20,1,5,["iceArrowRain","iceSpin"]],
    revive:[null,null,45,"deadAlly",20,1,5,["healSpell"]],
    waterEX:[null,null,null,"none",25,null,1,[]],

    stormFist:[26,6,7,"single",2,1,5,[]],
    stormFlurry:[13,3,20,"tri",10,1,5,["stormFist"]],
    windCrossSlash:[128,26,39,"single",15,1,5,["stormFlurry"]],
    dizzyFist:[141,29,55,"single",30,1,5,["stormFlurry"]],
    windSpell:[12,3,9,"tri",2,1,5,[]],
    stormCircle:[14,4,18,"tri",10,1,5,["windSpell"]],
    windHowlLightning:[128,26,55,"single",15,1,5,["stormCircle"]],
    stormRain:[24,5,75,"all",30,1,5,["windHowlLightning"]],
    dodgeSkill:[null,null,20,"allyTri",10,null,1,["windCrossSlash","windHowlLightning"]],
    stealthSkill:[null,null,45,"ally",15,null,1,["dodgeSkill"]],
    dinghaishenzhen:[null,null,77,"allyAll",20,null,1,["stealthSkill"]],
    windEX:[null,null,null,"none",25,null,1,[]],

    stoneSlash:[26,6,7,"single",2,1,5,[]],
    petrifyFist:[13,3,26,"tri",10,1,5,["stoneSlash"]],
    stoneBreakSky:[128,26,42,"single",15,1,5,["petrifyFist"]],
    earthquakeCrush:[47,9,55,"tri",30,1,5,["stoneBreakSky"]],
    stoneThrow:[12,3,7,"tri",2,1,5,[]],
    sandWind:[14,4,19,"tri",10,1,5,["stoneThrow"]],
    flyingSandStrike:[24,5,55,"all",15,1,5,["sandWind"]],
    dustStorm:[140,28,65,"single",30,1,5,["flyingSandStrike"]],
    earthShield:[null,null,66,"allyTri",10,null,1,["stoneBreakSky","flyingSandStrike"]],
    rockWall:[null,null,45,"allyTri",15,null,1,["barrier"]],
    barrier:[null,null,40,"ally",20,null,1,["earthShield"]],
    earthEX:[null,null,null,"none",25,null,1,[]]
};

const FINAL_DAMAGE_ROLE_PROFILES={
    single_low:[1.40,.05,0,0],single_normal:[1.75,.075,10,0],single_burst:[2.10,.10,20,0],
    tri_damage:[1.35,.05,5,0],aoe_damage:[1.10,.05,0,0],
    single_control:[1.35,.05,0,0],tri_control:[1.20,.04,0,0],aoe_control:[.95,.04,0,0],
    single_dot:[1.50,.06,5,0],tri_dot:[1.15,.04,0,0],aoe_dot:[.95,.04,0,0]
};

const FINAL_DAMAGE_SKILL_ROLES={
    flameSlash:"single_low",fireCritical:"single_normal",explosiveFlurry:"tri_damage",dragonSlash:"single_burst",
    fireRocket:"tri_dot",blazeSpell:"single_dot",flameTornado:"single_dot",phoenixCry:"aoe_dot",
    waterKnife:"single_low",frostPunch:"single_normal",iceSpin:"tri_damage",frostCrush:"single_burst",
    waterBall:"tri_damage",floodBeast:"single_normal",iceArrowRain:"aoe_damage",
    stormFist:"single_low",stormFlurry:"tri_damage",windCrossSlash:"single_normal",dizzyFist:"single_normal",
    windSpell:"tri_damage",stormCircle:"tri_damage",windHowlLightning:"single_normal",stormRain:"aoe_damage",
    stormSpell:"aoe_damage",stoneSlash:"single_low",petrifyFist:"tri_damage",stoneBreakSky:"single_normal",
    earthquakeCrush:"tri_control",stoneThrow:"tri_damage",sandWind:"tri_damage",
    flyingSandStrike:"aoe_damage",dustStorm:"single_control"
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

test("the baseline and the real index/js20 runtime order are pinned",()=>{
    assert.equal(MAIN_BASELINE_SHA,"9115b66988feb992822826eb5397e9515b4d795e");
    const directScripts=Array.from(indexSource.matchAll(/<script\b[^>]*\bsrc="([^"?]+)(?:\?[^\"]*)?"/g),match=>match[1]);
    assert.deepEqual(directScripts,EXPECTED_DIRECT_SCRIPT_PATHS);
    assert.deepEqual(extractRuntimePaths(),EXPECTED_RUNTIME_PATHS);
    EXPECTED_RUNTIME_PATHS.forEach(path=>assert.equal(fs.existsSync(path),true,path));
});

test("all formal runtimes execute once in production order",()=>{
    const runtime=loadFinalRuntime();
    assert.deepEqual(runtime.loaded,EXPECTED_DIRECT_SCRIPT_PATHS.concat(EXPECTED_RUNTIME_PATHS));
});

test("new Lv1 characters start with two skill points while level-up remains plus two",()=>{
    const runtime=loadFinalRuntime();
    const result=evaluateJson(runtime.context,`(function(){
        const additional=buildAdditionalCharacter("新角","fire","male");
        return {
            initial:INITIAL_CHARACTER_SKILL_POINTS,
            additional:additional.skillPoints
        };
    })()`);
    assert.deepEqual(result,{initial:2,additional:2});
    assert.match(mainSource,/function createCharacter\(\)[\s\S]*?player\.skillPoints\s*=\s*INITIAL_CHARACTER_SKILL_POINTS;/);
    assert.match(mainSource,/function checkLevelUp\(targetCharacter\)[\s\S]*?character\.skillPoints\s*\+=\s*2;/);
    assert.match(mainSource,/const player\s*=\s*\{[\s\S]*?skillPoints:0,/);
});

test("all ten wild zones use the exact one-pass curve and the beginner forest stays basic-only",()=>{
    const runtime=loadFinalRuntime();
    const result=evaluateJson(runtime.context,`(function(){
        function expected(monster,multiplier){
            return {
                maxHP:Math.max(1,Math.round((100+monster.vitalityPoints*50)*multiplier)),
                maxSP:Math.max(1,Math.round((50+monster.energyPoints*15)*multiplier)),
                attack:Math.max(1,Math.round((10+monster.attackPoints*8)*multiplier)),
                defense:Math.max(1,Math.round((10+monster.vitalityPoints*6)*multiplier)),
                magicAttack:Math.max(1,Math.round((10+monster.intelligencePoints*8)*multiplier))
            };
        }
        function actual(monster){
            return {
                maxHP:monster.maxHP,maxSP:monster.maxSP,attack:monster.attack,
                defense:monster.defense,magicAttack:monster.magicAttack
            };
        }
        const multipliers=Array.from(v173WildZoneStrengthMultipliers);
        const zones=[forestMonsters,desertMonsters,iceMountainMonsters,zone4Monsters,zone5Monsters,
            zone6Monsters,zone7Monsters,zone8Monsters,zone9Monsters,zone10Monsters];
        return {multipliers:multipliers,zones:zones.map((zone,index)=>zone.map(monster=>({
            name:monster.name,level:monster.level,actual:actual(monster),
            expected:expected(monster,multipliers[index]),skillIds:monster.skillIds,
            skillChance:monster.skillChance,applied:monster._v131StrengthApplied
        })))};
    })()`);
    assert.deepEqual(result.multipliers,[.75,.90,.95,1,1.05,1.10,1.15,1.20,1.25,1.30]);
    assert.equal(result.zones.length,10);
    result.zones.forEach((zone,index)=>zone.forEach(monster=>{
        assert.deepEqual(monster.actual,monster.expected,monster.name+" zone "+(index+1)+" multiplier");
        assert.equal(monster.applied,true,monster.name+" strength flag");
    }));
    assert.ok(result.zones[0].length>=8);
    result.zones[0].forEach(monster=>{
        assert.ok(monster.level===2||monster.level===3,monster.name+" level");
        assert.deepEqual(monster.skillIds,[],monster.name+" skill pool");
        assert.equal(monster.skillChance,0,monster.name+" skill chance");
    });
});

test("the complete four-element core table is final after every patch",()=>{
    const skills=loadFinalRuntime().skills;
    assert.equal(Object.keys(FINAL_FOUR_ELEMENT_CORE).length,45);
    Object.entries(FINAL_FOUR_ELEMENT_CORE).forEach(([id,expected])=>{
        assert.deepEqual(normalizedCore(skills[id]),expected,id);
    });
});

test("Burn, Frostbite, Freeze and every other final status definition are exact",()=>{
    const skills=loadFinalRuntime().skills;
    const expected={
        fireRocket:{burnChance:25,burnDuration:2,burnPercentByLevel:[1,1,2,2,3]},
        blazeSpell:{burnChance:30,burnDuration:2,burnPercentByLevel:[1,2,3,4,5]},
        flameTornado:{burnChance:100,guaranteedBurn:true,burnDuration:1,burnPercentByLevel:[3,4,5,6,7]},
        phoenixCry:{burnChance:40,burnDuration:2,burnPercentByLevel:[5,7,9,11,13],burnBonusThreshold:3,nextRoundDamageBonusPercent:30,nextRoundDamageBonusDuration:1},
        waterKnife:{frostbiteChance:10,frostbiteDuration:1},
        frostPunch:{frostbiteChance:15,frostbiteDuration:1},
        iceSpin:{frostbiteChance:20,frostbiteDuration:1},
        frostCrush:{frostbiteChance:25,frostbiteDuration:1},
        waterBall:{frostbiteChance:10,frostbiteDuration:1},
        floodBeast:{frostbiteChance:15,frostbiteDuration:1},
        iceArrowRain:{frostbiteChance:20,frostbiteDuration:1},
        freeze:{freezeChance:90,freezeDuration:3},
        stormFist:{agilityDownChance:50,agilityDownByLevel:[30,40,50,60,70],agilityDownDuration:1},
        stormFlurry:{damageDownChance:50,damageDownByLevel:[10,20,30,40,50],damageDownDuration:2},
        windCrossSlash:{damageDownChance:65,damageDownByLevel:[20,30,35,40,50],damageDownDuration:1},
        dizzyFist:{stunChance:65,missBonusByLevel:[30,45,50,55,65],stunDuration:5},
        windSpell:{agilityDownChance:50,agilityDownByLevel:[10,20,30,40,50],agilityDownDuration:1},
        stormCircle:{damageDownChance:55,damageDownByLevel:[15,18,21,25,30],damageDownDuration:1},
        windHowlLightning:{damageDownChance:65,damageDownByLevel:[15,20,25,30,35],damageDownDuration:1},
        stormRain:{stunChance:35,missBonusByLevel:[30,45,50,55,65],stunDuration:1},
        stoneSlash:{defenseDownChance:65,defenseDownByLevel:[10,20,30,40,50],defenseDownDuration:1},
        stoneThrow:{defenseDownChance:65,defenseDownByLevel:[10,20,30,40,50],defenseDownDuration:1},
        sandWind:{defenseDownChance:65,defenseDownByLevel:[10,20,30,40,50],defenseDownDuration:1},
        flyingSandStrike:{defenseDownChance:60,defenseDownByLevel:[10,15,20,25,35],defenseDownDuration:2},
        dustStorm:{petrifyChanceByLevel:[20,25,30,35,45],petrifyDuration:2},
        earthquakeCrush:{petrifyChanceByLevel:[30,35,40,45,50],petrifyDuration:2}
    };
    Object.entries(expected).forEach(([id,fields])=>{
        Object.entries(fields).forEach(([field,value])=>assert.deepEqual(skills[id][field],value,id+"."+field));
    });
    ["waterKnife","frostPunch","iceSpin","frostCrush","waterBall","floodBeast","iceArrowRain"].forEach(id=>{
        ["freezeChance","freezeDuration","freezeSingleTarget","teamFreezeChance","teamFreezeDuration"].forEach(field=>{
            assert.equal(skills[id][field],undefined,id+" must not retain "+field);
        });
    });
    assert.equal(skills.freeze.baseDamage,undefined);
    assert.equal(skills.freeze.frostbiteChance,undefined);
    assert.equal(skills.earthquakeCrush.selfShieldByLevel,undefined);
    assert.deepEqual(skills.petrifyFist.selfShieldByLevel,[100,125,150,175,200]);
    assert.deepEqual(skills.stoneBreakSky.selfShieldByLevel,[100,125,150,175,200]);
    assert.equal(skills.flyingSandStrike.petrifyChanceByLevel,undefined);
    assert.equal(skills.dustStorm.defenseDownChance,undefined);
});

test("final normal hit and status-effect bounds override the historical floors",()=>{
    assert.match(mainSource,/const STATUS_RESIST_PER_SPIRIT_POINT = 0\.05;/);
    assert.match(mainSource,/const LEVEL_DIFF_FACTOR_PER_LEVEL_PHYSICAL = 0\.02;/);
    assert.match(mainSource,/const LEVEL_DIFF_FACTOR_MIN_PHYSICAL = 0\.70;/);
    assert.match(mainSource,/const LEVEL_DIFF_FACTOR_MAX_PHYSICAL = 1\.30;/);
    assert.match(mainSource,/const HIT_CHANCE_MIN_PERCENT = 50;/);
    assert.doesNotMatch(mainSource,/STATUS_HIT_INT_COEFFICIENT|HIT_CHANCE_MIN_PERCENT = 60/);
    const runtime=loadFinalRuntime();
    const hit=runtime.context.v158GetHitChancePercent;
    assert.deepEqual(
        [hit(0,0,0),hit(10,0,0),hit(0,10,0),hit(0,1000,0),hit(0,1000,50),hit(1000,0,0)],
        [95,98,85.5,14.250000000000002,7.500000000000001,99]
    );
    const status=runtime.context.v140CalculateStatusEffectChance;
    assert.equal(status(50,10,10,100,20,false,"regular",0,"physical"),54);
    assert.equal(status(50,10,10,100,20,false,"regular",0,"magic"),54);
    assert.equal(status(50,10,10,100,100,false,"regular",7,"physical"),43);
    assert.equal(status(50,10,10,100,100,false,"regular",7,"magic"),43);
    assert.equal(status(30,10,10,100,20,true,"regular",0,"physical"),26);
    assert.equal(status(30,10,10,100,20,true,"regular",0,"magic"),26);
    assert.deepEqual(
        ["regular","elite","boss"].map(rank=>status(90,10,10,100,0,true,rank,0,"magic")),
        [80,60,40]
    );
    const levelCases=[[0,1],[5,1.1],[10,1.2],[15,1.3],[30,1.3],[-5,.9],[-10,.8],[-15,.7],[-30,.7]];
    assert.deepEqual(
        levelCases.map(([difference])=>status(40,50+difference,50,0,0,false,"regular",0,"magic")),
        [40,44,48,52,52,36,32,28,28]
    );
    assert.deepEqual(
        levelCases.map(([difference])=>status(40,50+difference,50,0,0,true,"regular",0,"magic")),
        [40,44,48,52,52,36,32,28,28]
    );
    runtime.context.Math.random=()=>.5;
    assert.deepEqual(
        levelCases.map(([difference])=>runtime.context.calculateDamage(100,0,50+difference,50,"fire","fire")),
        [100,110,120,130,130,90,80,70,70]
    );
});

test("same-name states miss without refresh while differently named hard controls coexist",()=>{
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
        burn:[{type:"burn",turnsLeft:2,percent:3,statusName:"燃燒"}],
        afterPetrify:["burn","freeze","petrify"],afterFreeze:["burn","freeze","petrify"],
        action:false,sp:500
    });
});

test("same-name detection runs before the probability roll and keeps the original payload",()=>{
    const runtime=loadFinalRuntime();
    const result=evaluateJson(runtime.context,`(function(){
        const target={name:"同名目標",alive:true,hp:100,statusEffects:[{
            type:"burn",statusName:"燃燒",turnsLeft:2,percent:3
        }]};
        let rolls=0;
        rollStatusEffectHit=function(){ rolls++; return true; };
        const duplicate=v173RollNamedPersistentStatusEffect(
            target,"burn",[100,1,1,0,0],"monster",0,"烈火術"
        );
        const different=v173RollNamedPersistentStatusEffect(
            target,"freeze",[100,1,1,0,0,true,"regular"],"monster",0,"冰封"
        );
        return {duplicate:duplicate,different:different,rolls:rolls,effects:target.statusEffects};
    })()`);
    assert.deepEqual(result,{
        duplicate:{duplicate:true,hit:false},different:{duplicate:false,hit:true},rolls:1,
        effects:[{type:"burn",statusName:"燃燒",turnsLeft:2,percent:3}]
    });
});

test("guaranteed Burn bypasses probability only after the same-name check",()=>{
    const runtime=loadFinalRuntime();
    const result=evaluateJson(runtime.context,`(function(){
        const target={name:"必燃目標",alive:true,hp:100,statusEffects:[]};
        let rolls=0;
        rollStatusEffectHit=function(){ rolls++; return false; };
        const first=v173RollNamedPersistentStatusEffect(
            target,"burn",[100,1,1,0,0],"monster",0,"烈焰龍捲",true
        );
        if(first.hit){ applyBurnEffect(target,1,3); }
        const duplicate=v173RollNamedPersistentStatusEffect(
            target,"burn",[100,1,1,0,0],"monster",0,"烈焰龍捲",true
        );
        return {first:first,duplicate:duplicate,rolls:rolls,effects:target.statusEffects};
    })()`);
    assert.deepEqual(result,{
        first:{duplicate:false,hit:true},duplicate:{duplicate:true,hit:false},rolls:0,
        effects:[{type:"burn",turnsLeft:1,percent:3,statusName:"燃燒"}]
    });
});

test("duplicate status MISS remains distinct and never cancels landed direct damage",()=>{
    const runtime=loadFinalRuntime();
    const result=evaluateJson(runtime.context,`(function(){
        const logs=[];
        const popups=[];
        Object.assign(player,{
            id:"火角",element:"fire",level:50,hp:1000,sp:1000,
            attack:0,vitality:0,energy:0,intelligence:0,spirit:0,agility:0,
            bonusHP:0,bonusSP:0,activeBuffs:[],statusEffects:[]
        });
        characterSkillLoadouts.fire.skillLevels.fireRocket=1;
        const target={
            name:"燃燒目標",level:50,hp:1000,maxHP:1000,sp:0,maxSP:0,
            alive:true,element:"earth",defense:0,evasion:0,spiritPoints:0,
            activeBuffs:[],statusEffects:[{type:"burn",statusName:"燃燒",turnsLeft:2,percent:3}]
        };
        monsters.splice(0,monsters.length,target);
        currentBattleMonsters.splice(0,currentBattleMonsters.length,0);
        selectedMonster=0;battleActive=true;autoBattle=false;
        getMainCharacterStats=function(){
            return {attack:0,magicAttack:0,intelligence:0,accuracy:1000,maxHP:1000,maxSP:1000};
        };
        getMonsterEvasion=function(){ return 0; };
        getMonsterEffectiveSpiritPoints=function(){ return 0; };
        getMonsterRank=function(){ return "regular"; };
        updateUI=function(){};finishPlayerAction=function(){};lungePlayerCard=function(){};
        showSkillNameBadge=function(){};showPlayerSpPopup=function(){};showMonsterHit=function(){};
        showMissEffect=function(_playerSide,_index,label){ popups.push(label); };
        addBattleLog=function(message){ logs.push(String(message)); };
        Math.random=function(){ return 0; };
        const before=target.hp;
        castDamageSkill("fireRocket");
        const afterHit=target.hp;
        Math.random=function(){ return .999999; };
        castDamageSkill("fireRocket");
        return {
            before:before,afterHit:afterHit,afterMiss:target.hp,popups:popups,logs:logs,
            effects:target.statusEffects
        };
    })()`);
    assert.ok(result.afterHit<result.before,"the landed direct hit must still deal damage");
    assert.equal(result.afterMiss,result.afterHit,"an actual attack MISS must deal no damage");
    assert.deepEqual(result.popups,["狀態MISS","MISS"]);
    assert.equal(result.effects.length,1);
    assert.match(result.logs.join("\n"),/已有【燃燒】，新的【燃燒】MISS。/);
});

test("accuracy, enemy Rage, monster shields and Stealth use their formal state rules",()=>{
    const runtime=loadFinalRuntime();
    const result=evaluateJson(runtime.context,`(function(){
        Object.assign(player,{spirit:10,activeBuffs:[]});
        const basePlayerAccuracy=getMainCharacterStats().accuracy;
        player.activeBuffs=[{
            type:"dinghaishenzhen",statusName:"氣定神閒",turnsLeft:3,
            resistBonus:65,accuracyBonusPercent:50
        }];
        const playerAccuracy=getMainCharacterStats().accuracy;
        const supportMonster={
            name:"支援怪",level:50,accuracy:100,hp:1000,maxHP:1000,alive:true,
            activeBuffs:[],statusEffects:[],v141TeamBuffs:[{
                type:"resistance",statusName:"氣定神閒",turnsLeft:3,amount:65,
                accuracyBonusPercent:50
            },{
                type:"rage",statusName:"怒火",turnsLeft:3,
                critChanceBonusPercent:25,critDamageBonusPercent:50
            }]
        };
        monsters.splice(0,monsters.length,supportMonster);
        currentBattleMonsters.splice(0,currentBattleMonsters.length,0);
        const monsterAccuracy=getMonsterAccuracy(supportMonster);
        const rage=v173GetActiveRageCriticalBonuses(supportMonster);
        const firstShield=v141ApplyMonsterShield(supportMonster,100,2);
        supportMonster.v141Shield.remaining=37;
        supportMonster.hp=supportMonster.v141Shield.baseHp+37;
        const secondShield=v141ApplyMonsterShield(supportMonster,200,5);
        const shield={
            first:firstShield,second:secondShield,statusName:supportMonster.v141Shield.statusName,
            remaining:supportMonster.v141Shield.remaining,turnsLeft:supportMonster.v141Shield.turnsLeft
        };

        const elite={
            name:"天兵天將",element:"wind",v141Abyss:true,alive:true,
            hp:100,maxHP:100,sp:100,maxSP:100,skillChance:1,activeBuffs:[],statusEffects:[]
        };
        monsters.splice(0,monsters.length,elite);
        currentBattleMonsters.splice(0,currentBattleMonsters.length,0);
        battleToken=91;turn=4;
        const stealthCast=v155ResolveWindEliteStealth(0,true);
        return {
            playerAccuracyMultiplier:playerAccuracy/basePlayerAccuracy,
            monsterAccuracy:monsterAccuracy,rage:rage,shield:shield,
            stealthCast:stealthCast,stealth:elite.activeBuffs.find(buff=>buff.type==="stealthSkill"),
            stealthExpires:elite.v155MonsterStealth&&elite.v155MonsterStealth.expiresTurn
        };
    })()`);
    assert.deepEqual(result,{
        playerAccuracyMultiplier:1.5,monsterAccuracy:150,rage:{chance:25,damage:50},
        shield:{first:100,second:0,statusName:"岩盾",remaining:37,turnsLeft:2},
        stealthCast:true,stealth:{type:"stealthSkill",v141BuffType:"stealth",statusName:"隱身",turnsLeft:3},
        stealthExpires:7
    });
});

test("reflection uses actual HP loss and cannot reflect absorbed or overkill damage",()=>{
    const runtime=loadFinalRuntime();
    const result=evaluateJson(runtime.context,`(function(){
        Object.assign(player,{
            id:"反傷者",level:1,hp:10,sp:0,vitality:0,energy:0,intelligence:0,spirit:0,agility:0,
            activeBuffs:[{type:"earthShield",statusName:"萬象土盾",turnsLeft:3,percent:50}],statusEffects:[]
        });
        player2=null;player3=null;
        const attacker={
            name:"過量攻擊者",level:100,attack:10000,element:"fire",accuracy:1000,
            hp:1000,maxHP:1000,sp:0,maxSP:0,alive:true,skillIds:[],skillChance:0,
            activeBuffs:[],statusEffects:[]
        };
        monsters.splice(0,monsters.length,attacker);
        currentBattleMonsters.splice(0,currentBattleMonsters.length,0);
        battleActive=true;battleToken=77;Math.random=function(){ return 0; };
        finishPlayerAction=function(){};updateUI=function(){};addBattleLog=function(){};
        showMonsterSkillNameBadge=function(){};showPlayerHit=function(){};showMonsterHit=function(){};
        processSingleMonsterAttack(0,battleToken);
        return {playerHp:player.hp,attackerHp:attacker.hp};
    })()`);
    assert.deepEqual(result,{playerHp:0,attackerHp:995});
});

test("evasion sources multiply to 83.75%, cap at 85%, and Barrier spends once per skill cast",()=>{
    const runtime=loadFinalRuntime();
    const result=evaluateJson(runtime.context,`(function(){
        const target={activeBuffs:[{
            type:"barrier",statusName:"結界",turnsLeft:5,remainingBlocks:5
        }]};
        const blocked=v173WithDirectBarrierCast(function(){
            return [v140ConsumeDirectBarrier(target),v140ConsumeDirectBarrier(target),v140ConsumeDirectBarrier(target)];
        });
        return {
            combined:v173CombineEvasionRates([35,75]),
            capped:v173CombineEvasionRates([80,80]),
            blocked:blocked,remaining:target.activeBuffs[0].remainingBlocks
        };
    })()`);
    assert.deepEqual(result,{combined:83.75,capped:85,blocked:[true,true,true],remaining:4});
});

test("player agility and default monster level retain the final evasion rules",()=>{
    const runtime=loadFinalRuntime();
    const result=evaluateJson(runtime.context,`(function(){
        Object.assign(player,{
            element:"fire",agility:100,activeBuffs:[],statusEffects:[]
        });
        characterSkillLoadouts.fire.skillLevels.windEX=0;
        const custom={level:80,evasion:24,agilityPoints:12,statusEffects:[]};
        const missing={level:200,statusEffects:[]};
        v158NormalizeMonsterDefaultEvasion(custom);
        v158NormalizeMonsterDefaultEvasion(missing);
        return {
            player:getMainCharacterStats().evasion,
            level40:makeZoneMonster("四十級怪",40,"fire").evasion,
            level200:makeZoneMonster("兩百級怪",200,"fire").evasion,
            custom:custom.evasion,missing:missing.evasion
        };
    })()`);
    assert.deepEqual(result,{player:60,level40:12,level200:30,custom:24,missing:30});
});

test("multi-target buffs resolve same-name MISS independently without replacing existing values",()=>{
    const runtime=loadFinalRuntime();
    const result=evaluateJson(runtime.context,`(function(){
        Object.assign(player,{
            id:"中",hp:500,sp:100,level:10,activeBuffs:[{
                type:"rage",statusName:"怒火",turnsLeft:2,
                bonusPercent:5,critChanceBonusPercent:5,critDamageBonusPercent:10
            }],statusEffects:[]
        });
        player2={id:"左",hp:500,sp:100,level:10,activeBuffs:[],statusEffects:[]};
        player3={id:"右",hp:500,sp:100,level:10,activeBuffs:[],statusEffects:[]};
        battleActive=true;activeBattleCharacterIndex=0;
        getSkillLevel=function(_key,id){ return id==="rage"?5:0; };
        getPartyBattleStats=function(){ return {maxHP:500,maxSP:100,intelligence:0}; };
        updateUI=function(){};finishPlayerAction=function(){};lungePlayerCard=function(){};
        showSkillNameBadge=function(){};showPlayerSpPopup=function(){};showMissEffect=function(){};addBattleLog=function(){};
        v148ResolveSupportAction(0,{action:"rage",targetAlly:0},skillDatabase.rage);
        return {
            sp:player.sp,
            buffs:[player,player2,player3].map(character=>character.activeBuffs.map(buff=>({
                type:buff.type,statusName:buff.statusName,turnsLeft:buff.turnsLeft,
                chance:buff.critChanceBonusPercent,damage:buff.critDamageBonusPercent
            })))
        };
    })()`);
    assert.deepEqual(result,{
        sp:50,
        buffs:[
            [{type:"rage",statusName:"怒火",turnsLeft:2,chance:5,damage:10}],
            [{type:"rage",statusName:"怒火",turnsLeft:3,chance:25,damage:50}],
            [{type:"rage",statusName:"怒火",turnsLeft:3,chance:25,damage:50}]
        ]
    });
});

test("Phoenix Might counts only newly added Burns and boosts every direct damage formula next round",()=>{
    const runtime=loadFinalRuntime();
    const result=evaluateJson(runtime.context,`(function(){
        Object.assign(player,{
            id:"火角",element:"fire",level:50,hp:1000,sp:1000,
            activeBuffs:[],statusEffects:[]
        });
        characterSkillLoadouts.fire.skillLevels.phoenixCry=1;
        monsters.splice(0,monsters.length);
        currentBattleMonsters.splice(0,currentBattleMonsters.length);
        for(let index=0;index<3;index++){
            monsters.push({
                name:"鳳威目標"+index,level:50,hp:5000,maxHP:5000,sp:0,maxSP:0,
                alive:true,element:"earth",defense:0,evasion:0,spiritPoints:0,
                activeBuffs:[],statusEffects:index<2?[{type:"burn",statusName:"燃燒",turnsLeft:2,percent:1}]:[]
            });
            currentBattleMonsters.push(index);
        }
        selectedMonster=1;battleActive=true;autoBattle=false;turn=4;battleToken=77;
        getMainCharacterStats=function(){
            return {attack:0,magicAttack:0,intelligence:0,accuracy:1000,maxHP:1000,maxSP:1000};
        };
        getMonsterEvasion=function(){ return 0; };
        getMonsterEffectiveSpiritPoints=function(){ return 0; };
        getMonsterRank=function(){ return "regular"; };
        updateUI=function(){};finishPlayerAction=function(){};lungePlayerCard=function(){};
        showPlayerSpPopup=function(){};showMonsterHit=function(){};showMissEffect=function(){};addBattleLog=function(){};
        Math.random=function(){ return 0; };
        castDamageSkill("phoenixCry");
        const buff=player.activeBuffs.find(entry=>entry.type==="phoenixMight");
        const burnCounts=monsters.map(monster=>monster.statusEffects.filter(effect=>effect.type==="burn").length);
        turn=5;
        window.v149CurrentDamageActor=player;
        const boosted=calculateDamage(100,0,1,1,"fire","earth");
        player.activeBuffs=[];
        const plain=calculateDamage(100,0,1,1,"fire","earth");
        return {
            burnCounts:burnCounts,
            buff:buff&&{statusName:buff.statusName,readyTurn:buff.readyTurn,expiresTurn:buff.expiresTurn,bonusPercent:buff.bonusPercent},
            boosted:boosted,plain:plain
        };
    })()`);
    assert.deepEqual(result.burnCounts,[1,1,1]);
    assert.deepEqual(result.buff,{statusName:"鳳威",readyTurn:5,expiresTurn:6,bonusPercent:30});
    assert.equal(result.boosted,Math.floor(result.plain*1.3));
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
        [],[],[],[],[{type:"frostbite",turnsLeft:1,value:0,statusName:"凍傷"}],[],[],[],[],[]
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
            bonusHP:0,bonusSP:0,activeBuffs:[],statusEffects:[{type:"burn",turnsLeft:2}]
        });
        player2={
            id:"隊友",element:"fire",level:50,hp:200,sp:10,
            attack:0,vitality:0,energy:0,intelligence:0,spirit:0,agility:0,
            bonusHP:0,bonusSP:0,activeBuffs:[],statusEffects:[{type:"stun",turnsLeft:1}]
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
            ally:{hp:player2.hp,sp:player2.sp},statuses:[player.statusEffects,player2.statusEffects],
            data:{baseHeal:skillDatabase.healSpell.baseHeal,healPerLevel:skillDatabase.healSpell.healPerLevel,
                baseHealSP:skillDatabase.healSpell.baseHealSP,healSPPerLevel:skillDatabase.healSpell.healSPPerLevel,
                spCost:skillDatabase.healSpell.spCost,targetType:skillDatabase.healSpell.targetType}
        };
    })()`);
    assert.deepEqual(result,{
        settled:true,caster:{hp:650,sp:55},ally:{hp:750,sp:45},statuses:[[],[]],
        data:{baseHeal:550,healPerLevel:30,baseHealSP:35,healSPPerLevel:0,spCost:45,targetType:"allyTri"}
    });
});

test("final support passives and front/back Freeze behavior are exact",()=>{
    const runtime=loadFinalRuntime();
    const skills=runtime.skills;
    assert.deepEqual(
        [skills.rage.duration,skills.dodgeSkill.evasionBonusPercent,skills.dodgeSkill.duration,
            skills.stealthSkill.duration,skills.dinghaishenzhen.statusResistBonus,
            skills.dinghaishenzhen.accuracyBonusPercent,skills.windEX.evasionBonusPercent],
        [3,75,3,3,65,50,35]
    );
    assert.deepEqual(
        [skills.earthShield.reflectPercent,skills.earthShield.duration,
            skills.rockWall.defenseBonusPercent,skills.rockWall.duration,
            skills.barrier.barrierBlockCount,skills.barrier.duration,skills.earthEX.defenseBonusPercent],
        [50,3,35,4,5,5,35]
    );
    assert.deepEqual(
        [skills.waterEX.damageBonusPercent,skills.waterEX.healBonusPercent,
            skills.waterEX.turnStartCleanseChance,skills.waterEX.statusResistBonus],
        [5,10,30,undefined]
    );
    assert.deepEqual(
        [skills.fireEX.damageBonusPercent,skills.fireEX.critChanceBonusPercent,
            skills.fireEX.critDamageBonusPercent,skills.fireEX.statusTargetDamageBonusPercent],
        [10,5,5,5]
    );
    ["flameSlash","fireCritical","explosiveFlurry"].forEach(id=>{
        assert.deepEqual([skills[id].followUpOnCriticalOrDefeat,skills[id].followUpMaxCasts],[true,1],id);
    });
    assert.deepEqual([skills.dragonSlash.followUpOnCriticalOrDefeat,skills.dragonSlash.followUpMaxCasts],[true,2]);

    const result=evaluateJson(runtime.context,`(function(){
        monsters.splice(0,monsters.length);
        currentBattleMonsters.splice(0,currentBattleMonsters.length);
        for(let index=0;index<6;index++){
            monsters.push({
                name:"列目標"+index,hp:100,alive:true,
                v141FormationRow:Math.floor(index/3),v141FormationPosition:index%3
            });
            currentBattleMonsters.push(index);
        }
        Object.assign(player,{id:"水角",element:"water",hp:100,statusEffects:[{type:"burn",turnsLeft:2}]});
        player2=null;player3=null;battleActive=true;
        getSkillLevel=function(_key,id){ return id==="waterEX"?1:0; };
        Math.random=function(){ return 0; };
        const column=getSkillTargets(1,"column");
        tickStatusEffects();
        return {column:column,statuses:player.statusEffects};
    })()`);
    assert.deepEqual(result,{column:[1,4],statuses:[]});
});

test("equipment dungeon is fixed at one boss plus four elites with its own single rank multiplier",()=>{
    const runtime=loadFinalRuntime();
    const result=evaluateJson(runtime.context,`(function(){
        Math.random=function(){ return 0; };
        function character(id){ return {id:id,level:60}; }
        const compositions=[];
        [1,2,3].forEach(count=>{
            Object.assign(player,character("主角"));
            player2=count>=2?character("角色2"):null;
            player3=count>=3?character("角色3"):null;
            const composition=v138GetEquipmentDungeonComposition();
            const roster=v132BuildEquipmentDungeonRoster();
            const before=roster.map(monster=>monster.skillIds.slice());
            roster.forEach(monster=>v144ConfigureMonsterEncounterSkills(monster,"equipment-test"));
            compositions.push({composition:composition,count:roster.length,
                ranks:roster.map(monster=>monster.rank),levels:roster.map(monster=>monster.level),
                skillLevels:roster.map(monster=>monster.v141ForceSkillLevel),
                chances:roster.map(monster=>monster.skillChance),
                tiers:roster.map(monster=>monster.skillIds.map(id=>skillDatabase[id].tier)),
                unchanged:roster.every((monster,index)=>JSON.stringify(monster.skillIds)===JSON.stringify(before[index])),
                locked:roster.every(monster=>monster.v132FixedSkillLoadout===true)
            });
        });
        const normalEliteBase=v132BuildDungeonMonster("基準精英",60,"fire","regular");
        const equipmentElite=v132BuildEquipmentDungeonMonster("裝備精英",60,"fire","elite");
        const normalBossBase=v132BuildDungeonMonster("基準首領",60,"fire","regular");
        const equipmentBoss=v132BuildEquipmentDungeonMonster("裝備首領",60,"fire","boss");
        function expected(base,multiplier){
            return {maxHP:Math.round(base.maxHP*multiplier.maxHP),maxSP:base.maxSP,
                attack:Math.round(base.attack*multiplier.attack),
                magicAttack:Math.round(base.magicAttack*multiplier.magicAttack),
                defense:Math.round(base.defense*multiplier.defense)};
        }
        function actual(monster){ return {maxHP:monster.maxHP,maxSP:monster.maxSP,attack:monster.attack,
            magicAttack:monster.magicAttack,defense:monster.defense}; }
        return {compositions:compositions,multipliers:v173EquipmentDungeonRankMultipliers,
            elite:{actual:actual(equipmentElite),expected:expected(normalEliteBase,{maxHP:1.8,attack:1.15,magicAttack:1.15,defense:1.1})},
            boss:{actual:actual(equipmentBoss),expected:expected(normalBossBase,{maxHP:2.8,attack:1.3,magicAttack:1.3,defense:1.2})}};
    })()`);
    result.compositions.forEach((entry,index)=>{
        assert.deepEqual(entry.composition,{playerCount:index+1,bossCount:1,eliteCount:4,total:5});
        assert.equal(entry.count,5);
        assert.deepEqual(entry.ranks,["boss","elite","elite","elite","elite"]);
        assert.deepEqual(entry.levels,[60,60,60,60,60]);
        assert.deepEqual(entry.skillLevels,[3,2,2,2,2]);
        assert.deepEqual(entry.chances,[.7,.7,.7,.7,.7]);
        assert.ok(entry.tiers[0].length>0&&entry.tiers[0].every(tier=>tier===4));
        entry.tiers.slice(1).forEach(tiers=>assert.ok(tiers.length>0&&tiers.every(tier=>tier===3)));
        assert.equal(entry.unchanged,true);
        assert.equal(entry.locked,true);
    });
    assert.deepEqual(result.multipliers,{elite:{maxHP:1.8,attack:1.15,magicAttack:1.15,defense:1.1},
        boss:{maxHP:2.8,attack:1.3,magicAttack:1.3,defense:1.2}});
    assert.deepEqual(result.elite.actual,result.elite.expected);
    assert.deepEqual(result.boss.actual,result.boss.expected);
});

test("Abyss floors one through five keep exact compositions, skill levels and additional HP",()=>{
    const runtime=loadFinalRuntime();
    const result=evaluateJson(runtime.context,`(function(){
        Object.assign(player,{id:"主角",level:70});player2=null;player3=null;
        Math.random=function(){ return 0; };
        return [1,2,3,4,5].map(floor=>{
            const roster=v141BuildAbyssRoster(floor);
            if(floor===5){ v155PatchFinalAbyssRoster(roster); }
            return {floor:floor,count:roster.length,names:roster.map(monster=>monster.name),
                ranks:roster.map(monster=>monster.rank),elements:roster.map(monster=>monster.element),
                forceLevels:roster.map(monster=>monster.v141ForceSkillLevel),
                extraHP:roster.map(monster=>monster.v141ExtraHP),
                skills:roster.map(monster=>monster.skillIds.slice()),
                supports:roster.map(monster=>Array.from(monster.v141SupportSkillIds||[])),
                rows:roster.map(monster=>monster.v141FormationRow),
                positions:roster.map(monster=>monster.v141FormationPosition)};
        });
    })()`);
    result.slice(0,4).forEach((floor,index)=>{
        const level=index+1;
        assert.equal(floor.count,5);
        assert.deepEqual(floor.ranks,["boss","elite","elite","elite","elite"]);
        assert.deepEqual(floor.forceLevels,[level,level,level,level,level]);
        assert.deepEqual(floor.extraHP,[5000,2500,2500,2500,2500]);
    });
    const final=result[4];
    assert.equal(final.count,10);
    assert.deepEqual(final.names,["東帝天尊","天帝天尊","極帝天尊","北帝天尊","南帝天尊",
        "天兵天將","天兵天將","天兵天將","天兵天將","天兵天將"]);
    assert.deepEqual(final.ranks,["boss","boss","boss","boss","boss","elite","elite","elite","elite","elite"]);
    assert.deepEqual(final.elements,["earth","wind","light","water","fire","water","earth","fire","wind","water"]);
    assert.deepEqual(final.forceLevels,[5,5,5,5,5,4,4,4,4,4]);
    assert.deepEqual(final.extraHP,[10000,10000,10000,10000,10000,3500,3500,3500,3500,3500]);
    assert.deepEqual(final.skills.slice(0,5),[["dustStorm","stoneBreakSky"],["windHowlLightning","stormRain","stormSpell"],[],
        ["iceArrowRain","freeze"],["phoenixCry","dragonSlash"]]);
    assert.deepEqual(final.supports.slice(0,5),[["barrier"],[],["yuanXiangGuangMing","yuanGuangShield","yuanZuBlessing"],["healSpell"],["rage"]]);
    assert.deepEqual(final.skills.slice(5),[[],["stoneBreakSky"],["phoenixCry"],[],[]]);
    assert.deepEqual(final.supports.slice(5),[["healSpell"],[],[],["dodgeSkill"],["healSpell"]]);
    assert.deepEqual(final.rows,[0,0,0,0,0,1,1,1,1,1]);
    assert.deepEqual(final.positions,[0,1,2,3,4,0,1,2,3,4]);
});

test("enemy Heal Spell affects only one same-row trio for both North Emperor and water elites",()=>{
    const runtime=loadFinalRuntime();
    const result=evaluateJson(runtime.context,`(function(){
        monsters.splice(0,monsters.length);
        currentBattleMonsters.splice(0,currentBattleMonsters.length);
        for(let index=0;index<10;index++){
            monsters.push({name:index===3?"北帝天尊":"天兵天將",element:"water",level:100,
                rank:index<5?"boss":"elite",v141Abyss:true,v155FinalAbyss:true,alive:true,
                hp:(index>=1&&index<=3)?100:900,maxHP:1000,sp:1000,maxSP:1000,
                activeBuffs:[],statusEffects:[],v141FormationRow:index<5?0:1,v141FormationPosition:index%5,
                v141SupportSkillIds:index===3?["healSpell"]:[],v141ForceSkillLevel:index===3?5:4,skillChance:1});
            currentBattleMonsters.push(index);
        }
        updateUI=function(){};finishPlayerAction=function(){};addBattleLog=function(){};
        showMonsterSkillNameBadge=function(){};showMonsterHit=function(){};Math.random=function(){ return 0; };
        const beforeNorth=monsters.map(monster=>monster.hp);
        const north=v155ResolveNorthHeal(3,true);
        const northChanged=monsters.map((monster,index)=>monster.hp!==beforeNorth[index]?index:null).filter(index=>index!==null);

        monsters.forEach((monster,index)=>{ monster.hp=(index>=6&&index<=8)?100:1000;monster.sp=1000;monster.v141SupportSkillIds=[]; });
        monsters[5].v141SupportSkillIds=["healSpell"];
        monsters[5].v141ForceSkillLevel=4;
        const beforeElite=monsters.map(monster=>monster.hp);
        const elite=v141TryMonsterSpecialAction(5);
        const eliteChanged=monsters.map((monster,index)=>monster.hp!==beforeElite[index]?index:null).filter(index=>index!==null);
        return {north:north,northChanged:northChanged,elite:elite,eliteChanged:eliteChanged};
    })()`);
    assert.deepEqual(result,{north:true,northChanged:[1,2,3],elite:true,eliteChanged:[6,7,8]});
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
        const first=v155ResolveExtremeEmperorAction(0,"yuanZuBlessing",[true,false]);
        const afterFirst=monsters.map(monster=>({evasion:monster.evasion,statusEffects:monster.statusEffects,
            turnsLeft:monster.v155EvasionBlessing.displayBuff.turnsLeft}));
        monsters[0].sp=500;
        const second=v155ResolveExtremeEmperorAction(0,"yuanZuBlessing",[false,true]);
        return {first:first,second:second,afterFirst:afterFirst,
            afterSecond:monsters.map(monster=>({evasion:monster.evasion,statusEffects:monster.statusEffects,
                blessings:monster.activeBuffs.filter(buff=>buff.v141BuffType==="dodge").length}))};
    })()`);
    assert.deepEqual(blessing,{
        first:true,second:true,
        afterFirst:[
            {evasion:85,statusEffects:[],turnsLeft:2},
            {evasion:85,statusEffects:[{type:"stun",turnsLeft:1}],turnsLeft:2}
        ],
        afterSecond:[
            {evasion:85,statusEffects:[],blessings:1},
            {evasion:85,statusEffects:[{type:"stun",turnsLeft:1}],blessings:1}
        ]
    });

    const data=healRuntime.skills;
    assert.deepEqual(
        [data.yuanXiangGuangMing.spCost,data.yuanXiangGuangMing.baseHeal,data.yuanXiangGuangMing.baseHealSP,
            data.yuanGuangShield.spCost,data.yuanGuangShield.shieldAmount,data.yuanGuangShield.shieldDuration,
            data.yuanZuBlessing.spCost,data.yuanZuBlessing.cleanseChance,data.yuanZuBlessing.evasionBonusPercent,data.yuanZuBlessing.duration],
        [35,150,55,40,100,2,45,25,35,2]
    );
    assert.equal(data.yuanZuBlessing.agilityBonusPercent,undefined);
});

test("all formal four-element damage skills use one fixed damage-role table",()=>{
    const runtime=loadFinalRuntime();
    const profiles=evaluateJson(runtime.context,"v173DamageRoleProfiles");
    const mapping=evaluateJson(runtime.context,"v173FormalDamageSkillRoles");
    assert.deepEqual(mapping,FINAL_DAMAGE_SKILL_ROLES);
    assert.equal(Object.keys(mapping).length,32);

    Object.entries(FINAL_DAMAGE_ROLE_PROFILES).forEach(([role,expected])=>{
        const profile=profiles[role];
        assert.deepEqual(
            [profile.powerMultiplier,profile.powerPerLevel,profile.flatDamage,profile.flatDamagePerLevel],
            expected,
            role
        );
    });

    Object.entries(mapping).forEach(([skillId,role])=>{
        const skill=runtime.skills[skillId];
        assert.ok(skill,skillId);
        assert.equal(skill.damageRole,role,skillId);
        assert.deepEqual(
            [skill.powerMultiplier,skill.powerPerLevel,skill.flatDamage,skill.flatDamagePerLevel],
            FINAL_DAMAGE_ROLE_PROFILES[role],
            skillId
        );
        assert.equal(typeof skill.baseDamage,"number",skillId+" legacy baseDamage");
        assert.equal(typeof skill.damagePerLevel,"number",skillId+" legacy damagePerLevel");
    });
    const discovered=Object.values(runtime.skills)
        .filter(skill=>["fire","water","wind","earth"].includes(skill.element))
        .filter(skill=>skill.category==="physical"||skill.category==="magic")
        .filter(skill=>typeof skill.baseDamage==="number")
        .map(skill=>skill.id)
        .sort();
    assert.deepEqual(discovered,Object.keys(mapping).sort());
    assert.equal(runtime.skills.freeze.damageRole,undefined);
    const monsterOnly=evaluateJson(runtime.context,`(function(){
        const skill=skillDatabase.fireBurstStrike;
        return [skill.damageRole,skill.powerMultiplier,skill.powerPerLevel,skill.flatDamage,skill.flatDamagePerLevel];
    })()`);
    assert.deepEqual(monsterOnly,["single_normal",1.75,.075,10,0]);
    assert.doesNotMatch(mainSource,/skillBonusDamage/);
    ["castDamageSkill","castSecondaryCharacterSkill","castPlayer2Skill","processSingleMonsterAttack"].forEach(name=>{
        const start=mainSource.indexOf("function "+name+"(");
        assert.ok(start>=0,name);
        assert.match(mainSource.slice(start,start+18000),/calculateSkillDamage\(\{/);
    });
    assert.doesNotMatch(fs.readFileSync("js/47-v158-combat-tuning.js","utf8"),/calculateDamage\s*=\s*function/);
});

test("dynamic defense, recalibrated attributes and modern or legacy skills share one core",()=>{
    const runtime=loadFinalRuntime();
    const result=evaluateJson(runtime.context,`(function(){
        Math.random=function(){ return .5; };
        Object.assign(player,{attack:10,intelligence:10,vitality:10,energy:0,spirit:0,agility:0,bonusHP:0,bonusSP:0});
        const base=getBaseStats();
        const monster=makeZoneMonster("比例怪",50,"fire","regular");
        const target={level:50,element:"fire",defense:0,statusEffects:[]};
        const modern=calculateSkillDamage({skill:skillDatabase.flameSlash,skillLevel:1,
            effectiveAttack:100,target:target,targetDefense:0,casterLevel:50,casterElement:"fire"});
        const legacySkill={baseDamage:30,damagePerLevel:5};
        const legacy=calculateSkillDamage({skill:legacySkill,skillLevel:3,
            effectiveAttack:100,target:target,targetDefense:0,casterLevel:50,casterElement:"fire"});
        return {
            constants:[20,50,80,100].map(v173GetDamageFormulaConstant),
            half:[20,50,80,100].map(level=>{
                const k=v173GetDamageFormulaConstant(level);
                return calculateDamage(k,k,level,level,"fire","fire");
            }),
            base:{maxHP:base.maxHP,attack:base.attack,magicAttack:base.magicAttack,defense:base.defense},
            monster:{attack:monster.attack,expectedAttack:10+monster.attackPoints*8,
                magicAttack:monster.magicAttack,expectedMagicAttack:10+monster.intelligencePoints*8,
                defense:monster.defense,expectedDefense:10+monster.vitalityPoints*6},
            modern:modern,modernRaw:v173GetSkillRawAttack(skillDatabase.flameSlash,1,100),
            legacy:legacy,legacyRaw:v173GetSkillRawAttack(legacySkill,3,100)
        };
    })()`);
    assert.deepEqual(result.constants,[550,1000,1450,1750]);
    assert.deepEqual(result.half,[275,500,725,875]);
    assert.deepEqual(result.base,{maxHP:600,attack:90,magicAttack:90,defense:70});
    assert.equal(result.monster.attack,result.monster.expectedAttack);
    assert.equal(result.monster.magicAttack,result.monster.expectedMagicAttack);
    assert.equal(result.monster.defense,result.monster.expectedDefense);
    assert.deepEqual([result.modern,result.modernRaw],[140,140]);
    assert.deepEqual([result.legacy,result.legacyRaw],[140,140]);
});

test("the live monster skill path uses the same modern skill calculator",()=>{
    const runtime=loadFinalRuntime();
    const result=evaluateJson(runtime.context,`(function(){
        Object.assign(player,{id:"受擊者",element:"light",level:50,hp:4070,sp:100,
            activeBuffs:[],statusEffects:[],isDefending:false});
        player2=null;player3=null;
        getMainCharacterStats=function(){
            return {maxHP:4070,maxSP:100,defense:310,evasion:0,antiCrit:100,
                vitality:50,spirit:0,accuracy:0,attack:0,magicAttack:0};
        };
        const attacker={name:"共用公式怪",element:"fire",level:50,rank:"regular",
            hp:1000,maxHP:1000,sp:1000,maxSP:1000,attack:100,magicAttack:100,
            accuracy:1000,evasion:0,spiritPoints:0,alive:true,skillIds:["dragonSlash"],
            skillChance:1,v141ForceSkillLevel:5,activeBuffs:[],statusEffects:[]};
        monsters.splice(0,monsters.length,attacker);
        currentBattleMonsters.splice(0,currentBattleMonsters.length,0);
        battleActive=true;battleToken=734;turn=1;Math.random=function(){ return .5; };
        updateUI=function(){};finishPlayerAction=function(){};addBattleLog=function(){};
        showMonsterSkillNameBadge=function(){};showPlayerHit=function(){};showMonsterHit=function(){};
        const expected=calculateSkillDamage({skill:skillDatabase.dragonSlash,skillLevel:5,effectiveAttack:100,
            target:player,targetDefense:310,casterLevel:50,casterElement:"fire"});
        processSingleMonsterAttack(0,battleToken);
        return {expected:expected,actual:4070-player.hp};
    })()`);
    assert.deepEqual(result,{expected:206,actual:206});
});

test("representative normal, equipment and Abyss damage stays in the intended hierarchy",()=>{
    const runtime=loadFinalRuntime();
    const report=evaluateJson(runtime.context,`(function(){
        Math.random=function(){ return .5; };
        function playerFixture(level){
            return {level:level,element:"light",maxHP:100+level*50+(level-1)*30,defense:10+level*6};
        }
        function percent(damage,maxHP){ return Math.round(damage/maxHP*10000)/100; }
        function skillForRole(role){
            return Object.assign({id:"role-"+role,category:"physical"},v173DamageRoleProfiles[role],{damageRole:role});
        }
        function skillDamage(monster,skill,skillLevel,target){
            const offense=skill.category==="magic"?monster.magicAttack:monster.attack;
            return calculateSkillDamage({skill:skill,skillLevel:skillLevel,effectiveAttack:offense,
                target:target,targetDefense:target.defense,casterLevel:monster.level,casterElement:monster.element});
        }
        const roles=["single_low","single_normal","single_burst","tri_damage","aoe_damage","single_control","aoe_control"];
        const levelRows=[20,50,80,100].map(level=>{
            const target=playerFixture(level);
            const monster=makeZoneMonster("同級野怪",level,"fire","regular");
            const multiplier=v173WildZoneStrengthMultipliers[Math.ceil(level/10)-1];
            ["maxHP","maxSP","attack","magicAttack","defense"].forEach(key=>{
                monster[key]=Math.max(1,Math.round(monster[key]*multiplier));
            });
            const normal=calculateDamage(monster.attack,target.defense,level,level,"fire","light");
            const skillLevel=Math.min(5,Math.ceil(level/20));
            const damages={};
            roles.forEach(role=>{ damages[role]=skillDamage(monster,skillForRole(role),skillLevel,target); });
            return {level:level,skillLevel:skillLevel,maxHP:target.maxHP,normal:normal,
                normalPercent:percent(normal,target.maxHP),damages:damages};
        });

        Object.assign(player,{id:"基準角色",level:60});player2=null;player3=null;
        const equipment=v132BuildEquipmentDungeonRoster();
        const equipmentTarget=playerFixture(60);
        const equipmentRows=[equipment.find(monster=>monster.rank==="elite"),equipment.find(monster=>monster.rank==="boss")].map(monster=>{
            const skill=skillDatabase[monster.skillIds[0]];
            const normal=calculateDamage(monster.attack,equipmentTarget.defense,monster.level,60,monster.element,"light");
            const damage=skillDamage(monster,skill,monster.v141ForceSkillLevel,equipmentTarget);
            return {rank:monster.rank,normal:normal,normalPercent:percent(normal,equipmentTarget.maxHP),
                skillId:skill.id,skillLevel:monster.v141ForceSkillLevel,skillDamage:damage,
                skillPercent:percent(damage,equipmentTarget.maxHP)};
        });

        Object.assign(player,{id:"基準角色",level:100});
        const abyssTarget=playerFixture(100);
        const preferred={1:"dustStorm",2:"dragonSlash",3:"windCrossSlash",4:"floodBeast",5:"dragonSlash"};
        const abyssRows=[1,2,3,4,5].map(floor=>{
            const roster=v141BuildAbyssRoster(floor);
            if(floor===5){ v155PatchFinalAbyssRoster(roster); }
            const monster=floor===5?roster.find(entry=>entry.name==="南帝天尊"):roster[0];
            const skill=skillDatabase[preferred[floor]];
            const normal=calculateDamage(monster.attack,abyssTarget.defense,monster.level,100,monster.element,"light");
            const damage=skillDamage(monster,skill,monster.v141ForceSkillLevel,abyssTarget);
            return {floor:floor,boss:monster.name,normal:normal,normalPercent:percent(normal,abyssTarget.maxHP),
                skillId:skill.id,skillLevel:monster.v141ForceSkillLevel,skillDamage:damage,
                skillPercent:percent(damage,abyssTarget.maxHP),extraHP:monster.v141ExtraHP};
        });
        return {levels:levelRows,equipment:equipmentRows,abyss:abyssRows};
    })()`);

    report.levels.forEach(row=>{
        assert.ok(row.normalPercent>=3&&row.normalPercent<=7,"Lv"+row.level+" normal "+row.normalPercent+"%");
        const ratio=role=>row.damages[role]/row.normal;
        assert.ok(ratio("single_low")>=1.3&&ratio("single_low")<=1.65);
        assert.ok(ratio("single_normal")>=1.6&&ratio("single_normal")<=2.2);
        assert.ok(ratio("single_burst")>=2&&ratio("single_burst")<=2.7);
        assert.ok(row.damages.tri_damage<row.damages.single_normal);
        assert.ok(row.damages.aoe_damage<row.damages.single_burst);
        assert.ok(row.damages.single_control<row.damages.single_burst);
        assert.ok(row.damages.aoe_control<row.damages.aoe_damage);
    });
    assert.ok(report.equipment[0].normalPercent>=5&&report.equipment[0].normalPercent<=9);
    assert.ok(report.equipment[1].normalPercent>=6&&report.equipment[1].normalPercent<=11);
    assert.deepEqual(report.equipment.map(row=>row.skillLevel),[2,3]);
    report.abyss.forEach(row=>assert.ok(row.normalPercent>=6&&row.normalPercent<=11));
    assert.deepEqual(report.abyss.map(row=>row.skillLevel),[1,2,3,4,5]);
    assert.deepEqual(report.abyss.map(row=>row.extraHP),[5000,5000,5000,5000,10000]);
    assert.ok(report.abyss[4].skillPercent>=15&&report.abyss[4].skillPercent<=25);
});

test("forced final-Abyss skill levels fold the modern scaling fields exactly once",()=>{
    const runtime=loadFinalRuntime();
    const result=evaluateJson(runtime.context,`(function(){
        const monster={v155FinalAbyss:true,v141ForceSkillLevel:5,skillIds:["dragonSlash"],v141SupportSkillIds:[]};
        const skill=skillDatabase.dragonSlash;
        const before=[skill.maxLevel,skill.powerMultiplier,skill.powerPerLevel,skill.flatDamage,skill.flatDamagePerLevel];
        const during=v155WithForcedFinalAbyssSkillLevel(monster,function(){
            return [skill.maxLevel,skill.powerMultiplier,skill.powerPerLevel,skill.flatDamage,skill.flatDamagePerLevel];
        });
        const after=[skill.maxLevel,skill.powerMultiplier,skill.powerPerLevel,skill.flatDamage,skill.flatDamagePerLevel];
        return {before:before,during:during,after:after};
    })()`);
    assert.deepEqual(result,{
        before:[5,2.1,.1,20,0],during:[1,2.5,0,20,0],after:[5,2.1,.1,20,0]
    });
});

console.log("\nV170 final integration suite: "+passed+" tests passed.");
