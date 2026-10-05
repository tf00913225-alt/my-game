"use strict";

/*
 * HISTORICAL INTEGRATION SNAPSHOT (V173.43)
 *
 * This suite preserves the V173.43 integration surface. Later owner changes
 * are validated by newer regression suites and must not be inferred from this
 * historical runtime load order.
 */

const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const MAIN_BASELINE_SHA="70df66e8cb371ff6193a7f70609cf9aad7bd15ac";
const mainSource=fs.readFileSync("js/00-main.js","utf8");
const indexSource=fs.readFileSync("index.html","utf8");
const loaderSource=fs.readFileSync("js/20-anonymous-20.js","utf8")+fs.readFileSync("scripts/build-production.mjs","utf8");
const progressionSource=fs.readFileSync("js/60-v173.64-skill-progression-rebalance.js","utf8");
const v140Source=fs.readFileSync("js/33-v140-four-element-balance.js","utf8");
const v158Source=fs.readFileSync("js/47-v158-combat-tuning.js","utf8");

const EXPECTED_DIRECT_SCRIPT_PATHS=[
    "js/00-main.js",
    "js/01-stage-v8-touch-lock.js",
    "js/02-stage-v9-native-coordinate-api.js",
    "js/03-stage-v10-battle-log-scroll-runtime.js",
    "js/04-stage-v11-native-bottom-nav-runtime.js",
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
    "js/23-v125-character-creation-bootstrap.js",
    "js/24-v125-character-creation-native-runtime.js",
    "js/20-anonymous-20.js",
    "js/61-v174-ui-regression-guards.js"
];

const EXPECTED_RUNTIME_PATHS=[
    "js/battlefield-slot-owner.js",
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
    "js/51-v169-rpg-ui.js",
    "js/60-v173.64-skill-progression-rebalance.js",
    "js/59-abyss-two-tier-runtime.js",
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
    iceArrowRain:[30,6,75,"all",20,1,5,["floodBeast"]],
    freeze:[null,null,32,"column",20,null,1,["frostPunch","floodBeast"]],
    healSpell:[null,null,45,"allyTri",16,1,5,["frostPunch","floodBeast"]],
    revive:[null,null,45,"deadAlly",18,1,5,["healSpell"]],
    purifyMind:[null,null,22,"ally",1,null,1,["frostPunch","floodBeast"]],
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
    single_low:[1.20,.05,0,0],single_normal:[1.50,.075,0,0],single_burst:[1.75,.10,0,0],
    tri_damage:[.95,.05,0,0],aoe_damage:[.70,.04,0,0],
    single_control:[1.50,.075,0,0],tri_control:[.95,.05,0,0],aoe_control:[.70,.04,0,0],
    single_dot:[1.50,.075,0,0],tri_dot:[.95,.05,0,0],aoe_dot:[.70,.04,0,0]
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
    const build=fs.readFileSync("scripts/build-production.mjs","utf8");
    let cursor=-1;
    for(const file of EXPECTED_RUNTIME_PATHS){
        const next=build.indexOf('"'+file+'"');
        assert.ok(next>cursor,file+" must retain deterministic bundle order");
        cursor=next;
    }
    return [...EXPECTED_RUNTIME_PATHS];
}

function makeUniversalNode(){
    const style={setProperty(){},removeProperty(){},getPropertyValue(){ return ""; }};
    const classList={add(){},remove(){},toggle(){ return false; },contains(){ return false; }};
    const terminalParent={
        dataset:{},parentElement:null,parentNode:null,
        insertBefore(){},removeChild(){},appendChild(child){ return child; }
    };
    let node;
    const target=function(){ return node; };
    node=new Proxy(target,{
        get(_target,property){
            if(property===Symbol.iterator){ return function* empty(){}; }
            if(property===Symbol.toPrimitive){ return ()=>0; }
            if(property==="length"){ return 0; }
            if(property==="style"){ return style; }
            if(property==="dataset"){ return {}; }
            if(property==="parentElement"){ return null; }
            if(property==="parentNode"){ return terminalParent; }
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
    const storage=()=>{
        const values=new Map();
        return {
            getItem:key=>values.has(String(key))?values.get(String(key)):null,
            setItem:(key,value)=>values.set(String(key),String(value)),
            removeItem:key=>values.delete(String(key)),clear:()=>values.clear()
        };
    };
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
    vm.runInContext(fs.readFileSync("functions/src/equipment-combat-percent-migration.js","utf8"),context);
    vm.runInContext(fs.readFileSync("js/startup/account-save-repository.js","utf8"),context,{filename:"js/startup/account-save-repository.js"});
    vm.runInContext('FourSymbolsAccountSave.activate("v170-test-uid")',context);
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
    assert.equal(MAIN_BASELINE_SHA,"70df66e8cb371ff6193a7f70609cf9aad7bd15ac");
    const directScripts=Array.from(indexSource.matchAll(/<script\b[^>]*\bsrc="([^"?]+)(?:\?[^\"]*)?"/g),match=>match[1]);
    assert.equal(directScripts.length,1);
    assert.match(directScripts[0],/^build\/boot-core\.[0-9a-f]{12}\.js$/);
    const manifest=JSON.parse(fs.readFileSync("asset-manifest.json","utf8"));
    assert.equal(manifest.featureManifest.features.home,"app-shell");
    assert.equal(manifest.featureManifest.features.battle,"gameplay-core");
    assert.deepEqual(extractRuntimePaths(),EXPECTED_RUNTIME_PATHS);
    EXPECTED_DIRECT_SCRIPT_PATHS.concat(EXPECTED_RUNTIME_PATHS).forEach(path=>assert.equal(fs.existsSync(path),true,path));
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

test("Wild final rosters use the sole balance projection and preserve beginner protection",()=>{
    const runtime=loadFinalRuntime();
    const result=evaluateJson(runtime.context,`(()=>Object.keys(zoneConfig).map(k=>zoneConfig[k].monsters().map(m=>({
        mode:m.mode,owner:m.balanceOwner,actual:{maxHP:m.maxHP,maxSP:m.maxSP,physicalAttack:m.attack,magicAttack:m.magicAttack,defense:m.defense,speed:m.agility},
        expected:MonsterBalance.preview(m.balanceProjection.identity).final,
        applied:m._v131StrengthApplied||false,halved:m.v17342BeginnerStatsHalved||false,
        skills:m.skillIds,chance:m.skillChance,level:m.level
    }))))()`);
    assert.equal(result.length,10);
    for(const zone of result)for(const m of zone){
        assert.equal(m.mode,'wild');assert.equal(m.owner,'MonsterBalance');
        assert.deepEqual(m.actual,m.expected);assert.equal(m.applied,false);assert.equal(m.halved,false);
    }
    assert.ok(result[0].length>=8);
    for(const m of result[0]){assert.ok(m.level===2||m.level===3);assert.deepEqual(m.skills,[]);assert.equal(m.chance,0);assert.equal(m.actual.speed,0);}
    const tuningSource=fs.readFileSync("js/47-v158-combat-tuning.js","utf8");
    assert.doesNotMatch(tuningSource,/halveMonsterCoreStats/);
    assert.match(tuningSource,/rollBeginnerForestNormalAttackDamage=function\(\)\{[\s\S]*?return 5\+Math\.floor\(Math\.random\(\)\*4\);/);
});


test("the current four-element owner loads after every historical compatibility module",()=>{
    const skills=loadFinalRuntime().skills;
    const direct={
        flameSlash:[30,6,10],dragonSlash:[165,33,65],
        frostCrush:[116,24,60],dizzyFist:[141,29,55],
        earthquakeCrush:[47,9,55]
    };
    Object.entries(direct).forEach(([id,expected])=>{
        assert.deepEqual([skills[id].baseDamage,skills[id].damagePerLevel,skills[id].spCost],expected,id);
        assert.equal(skills[id].maxLevel,10,id+" max level");
        assert.equal(skills[id].upgradeCost,1,id+" upgrade cost");
    });
    assert.deepEqual(skills.revive.requires,["healSpell","frostCrush"]);
    assert.deepEqual(skills.purifyMind.requires,["healSpell","frostCrush"]);
    assert.equal(skills.earthShield.spCost,45);
    assert.equal(skills.barrier.remainingBlocksByLevel,undefined);
});

test("the current owner supplies the rebalanced status definitions",()=>{
    const skills=loadFinalRuntime().skills;
    const expected={
        fireRocket:{burnChance:40,burnDuration:2,burnPercentByLevel:[2,2,2,2,3,3,3,3,3,4]},
        blazeSpell:{burnChance:45,burnDuration:2,burnPercentByLevel:[3,3,3,3,4,4,4,4,4,6]},
        flameTornado:{burnChance:60,burnDuration:2,burnPercentByLevel:[4,4,4,4,5,5,5,5,5,7]},
        phoenixCry:{burnChance:50,burnDuration:2,burnPercentByLevel:[5,5,5,5,7,7,7,7,7,9],burnBonusThreshold:3,nextRoundDamageBonusPercent:30,nextRoundDamageBonusDuration:1},
        waterKnife:{frostbiteChance:50,frostbiteDuration:3,lifestealPercentByLevel:[4,4,4,4,7,7,7,7,7,10],spStealPercentByLevel:[4,4,4,4,7,7,7,7,7,10]},
        frostPunch:{frostbiteChance:40,frostbiteDuration:2},
        iceSpin:{frostbiteChance:35,frostbiteDuration:2},
        frostCrush:{frostbiteChance:45,frostbiteDuration:2},
        waterBall:{frostbiteChance:50,frostbiteDuration:2},
        floodBeast:{frostbiteChance:40,frostbiteDuration:2},
        iceArrowRain:{frostbiteChance:35,frostbiteDuration:2},
        freeze:{freezeChanceByLevel:[55,65,75,85,95],freezeDurationByLevel:[3,3,3,4,5]},
        stormFist:{agilityDownChance:50,agilityDownByLevel:[10,15,20,25,30,30,35,35,40,45],agilityDownDuration:1},
        stormFlurry:{damageDownChance:50,damageDownByLevel:[10,15,20,25,30,35,40,45,50,55],damageDownDuration:2},
        windCrossSlash:{damageDownChance:65,damageDownByLevel:[20,20,20,20,30,30,30,30,40,50],damageDownDuration:1},
        dizzyFist:{stunChance:65,missBonusByLevel:[5,7,9,11,13,15,17,19,22,25],stunDuration:5},
        windSpell:{agilityDownChance:50,agilityDownByLevel:[10,15,20,25,30,30,35,35,40,45],agilityDownDuration:1},
        stormCircle:{damageDownChance:55,damageDownByLevel:[10,15,25,30,40,40,40,40,40,50],damageDownDuration:1},
        windHowlLightning:{damageDownChance:65,damageDownByLevel:[10,15,25,30,40,50,50,50,55,60],damageDownDuration:1},
        stormRain:{stunChance:35,missBonusByLevel:[5,7,9,11,13,15,17,19,22,25],stunDuration:1},
        stoneSlash:{defenseDownChance:75,defenseDownByLevel:[10,20,25,30,40,40,45,55,65,70],defenseDownDuration:1},
        stoneThrow:{defenseDownChance:75,defenseDownByLevel:[10,20,25,30,40,40,45,55,65,70],defenseDownDuration:1},
        sandWind:{defenseDownChance:65,defenseDownByLevel:[15,20,25,30,30,40,50,55,55,60],defenseDownDuration:1},
        flyingSandStrike:{defenseDownChance:60,defenseDownByLevel:[10,15,20,25,35,35,35,35,35,35],defenseDownDuration:2},
        dustStorm:{petrifyChanceByLevel:[15,20,25,30,35,40,45,50,55,60],petrifyDuration:2},
        earthquakeCrush:{petrifyChanceByLevel:[30,33,36,39,45,48,51,54,57,65],petrifyDuration:2}
    };
    Object.entries(expected).forEach(([id,fields])=>{
        Object.entries(fields).forEach(([field,value])=>{
            assert.deepEqual(skills[id][field],value,id+"."+field);
        });
    });
    ["waterKnife","frostPunch","iceSpin","frostCrush","waterBall","floodBeast","iceArrowRain"].forEach(id=>{
        ["freezeChance","freezeDuration","freezeSingleTarget","teamFreezeChance","teamFreezeDuration"].forEach(field=>{
            assert.equal(skills[id][field],undefined,id+" must not retain "+field);
        });
    });
    assert.equal(skills.freeze.baseDamage,undefined);
    assert.equal(skills.freeze.frostbiteChance,undefined);
    assert.equal(skills.earthquakeCrush.selfShieldByLevel,undefined);
    assert.deepEqual(skills.petrifyFist.selfShieldByLevel,[100,125,150,175,200,300,400,500,600,750]);
    assert.deepEqual(skills.stoneBreakSky.selfShieldByLevel,[100,125,150,175,200,250,300,350,400,500]);
    assert.equal(skills.flyingSandStrike.petrifyChanceByLevel,undefined);
    assert.equal(skills.dustStorm.defenseDownChance,undefined);
});

test("final hit, evasion and status chances use one percentage-point model",()=>{
    assert.doesNotMatch(mainSource,/STATUS_RESIST_PER_SPIRIT_POINT/);
    assert.match(mainSource,/const STATUS_OFFENSE_ATTRIBUTE_COEFFICIENT = 0\.05;/);
    assert.doesNotMatch(mainSource,/HIT_CHANCE_ACCURACY_COEFFICIENT/);
    assert.match(mainSource,/const HIT_CHANCE_MIN_PERCENT = 5;/);
    assert.doesNotMatch(mainSource,/DEFAULT_MONSTER_EVASION_PER_LEVEL/);
    assert.doesNotMatch(mainSource,/DEFAULT_MONSTER_EVASION_CAP/);
    assert.doesNotMatch(v140Source,/Math\.sqrt\(power\)|GENERAL_STATUS_COEFFICIENT|LOCKDOWN_STATUS_COEFFICIENT/);
    assert.doesNotMatch(v140Source,/rollHitChance\s*=\s*function|calculateStatusEffectChance\s*=\s*function/);
    assert.doesNotMatch(v158Source,/v158GetHitChancePercent|rollHitChance\s*=\s*function/);

    const runtime=loadFinalRuntime();
    const hit=runtime.context.v173GetHitChancePercent;
    assert.deepEqual(
        [hit(0,0,0,0),hit(10,0,0,0),hit(0,10,0,0),hit(0,1000,0,0),hit(0,1000,50,0),hit(1000,0,0,0)],
        [95,99,85,5,5,99]
    );
    assert.equal(hit(0,15,5,10),85,"95 + 10 - 15 - 5 must equal 85 percentage points");

    const status=runtime.context.calculateStatusEffectChance;
    assert.equal(status(50,10,10,100,20,false,"regular",0),35);
    assert.equal(status(50,10,10,100,100,false,"regular",7),5);
    assert.equal(status(30,10,10,200,0,true,"boss",20),20,
        "30 base + INT 200×0.05 - Boss resistance 20 = 20");
    assert.deepEqual(
        ["regular","elite","boss"].map(rank=>status(90,10,10,100,0,true,rank,0)),
        [90,75,60]
    );
    const levelCases=[0,5,10,15,30,-5,-10,-15,-30];
    assert.deepEqual(
        levelCases.map(difference=>status(40,50+difference,50,0,0,false,"regular",0)),
        levelCases.map(()=>40),
        "status chance must no longer contain a hidden level-difference factor"
    );
    assert.deepEqual(
        levelCases.map(difference=>status(40,50+difference,50,0,0,true,"regular",0)),
        levelCases.map(()=>40),
        "hard control must use the same attribute/resistance conversion before rank cap"
    );

    runtime.context.Math.random=()=>0.5;
    assert.deepEqual(
        levelCases.map(difference=>runtime.context.calculateDamage(100,0,50+difference,50,"fire","fire")),
        levelCases.map(difference=>Math.round(100*Math.pow(1.01,difference)))
    );
});

test("Freeze and Petrify are mutually exclusive without refreshing the active hard control",()=>{
    const runtime=loadFinalRuntime();
    const result=evaluateJson(runtime.context,`(function(){
        const target={name:"狀態目標",hp:100,maxHP:100,alive:true,statusEffects:[]};
        applyBurnEffect(target,2,3);
        applyBurnEffect(target,2,8);
        const burn=target.statusEffects.filter(effect=>effect.type==="burn");

        const freezeApplied=applyFreezeEffect(target,5);
        const freezeBefore=target.statusEffects.find(effect=>effect.type==="freeze").turnsLeft;
        const petrifyWhileFrozen=applyMonsterDebuff(target,"petrify",3,0);
        const freezeAgain=applyFreezeEffect(target,2);
        const freezeAfter=target.statusEffects.find(effect=>effect.type==="freeze").turnsLeft;
        const whileFrozen=target.statusEffects.map(effect=>effect.type);

        target.statusEffects=target.statusEffects.filter(effect=>effect.type!=="freeze");
        const petrifyAfterRelease=applyMonsterDebuff(target,"petrify",3,0);
        const petrifyBefore=target.statusEffects.find(effect=>effect.type==="petrify").turnsLeft;
        const freezeWhilePetrified=applyFreezeEffect(target,4);
        const petrifyAgain=applyMonsterDebuff(target,"petrify",1,0);
        const petrifyAfter=target.statusEffects.find(effect=>effect.type==="petrify").turnsLeft;
        const whilePetrified=target.statusEffects.map(effect=>effect.type);

        monsters.splice(0,monsters.length,{
            name:"極帝天尊",element:"light",level:100,hp:1000,maxHP:1000,sp:500,maxSP:1000,
            alive:true,evasion:100,activeBuffs:[],statusEffects:[{type:"frostbite",turnsLeft:1}],
            v141Abyss:true,v174TrueRealmFinal:true,v141SupportSkillIds:["yuanZuBlessing"]
        });
        currentBattleMonsters.splice(0,currentBattleMonsters.length,0);
        Math.random=function(){ return 0; };
        const action=v141TryMonsterSpecialAction(0);
        return {
            burn:burn,
            freezeApplied:freezeApplied,freezeBefore:freezeBefore,
            petrifyWhileFrozen:petrifyWhileFrozen,freezeAgain:freezeAgain,freezeAfter:freezeAfter,
            whileFrozen:whileFrozen,
            petrifyAfterRelease:petrifyAfterRelease,petrifyBefore:petrifyBefore,
            freezeWhilePetrified:freezeWhilePetrified,petrifyAgain:petrifyAgain,petrifyAfter:petrifyAfter,
            whilePetrified:whilePetrified,action:action,sp:monsters[0].sp
        };
    })()`);
    assert.deepEqual(result,{
        burn:[{type:"burn",turnsLeft:2,percent:3,statusName:"燃燒"}],
        freezeApplied:true,freezeBefore:5,
        petrifyWhileFrozen:false,freezeAgain:false,freezeAfter:5,
        whileFrozen:["burn","freeze"],
        petrifyAfterRelease:true,petrifyBefore:3,
        freezeWhilePetrified:false,petrifyAgain:false,petrifyAfter:3,
        whilePetrified:["burn","petrify"],
        action:true,sp:555
    });
});

test("exclusive hard-control conflict is rejected before the status probability roll",()=>{
    const runtime=loadFinalRuntime();
    const result=evaluateJson(runtime.context,`(function(){
        const target={name:"硬控目標",alive:true,hp:100,statusEffects:[
            {type:"freeze",statusName:"冰封",turnsLeft:4}
        ]};
        let rolls=0;
        rollStatusEffectHit=function(){ rolls++; return true; };
        const blocked=v173RollNamedPersistentStatusEffect(
            target,"petrify",[100,1,1,0,0,true,"regular"],"monster",0,"石化"
        );
        return {blocked:blocked,rolls:rolls,turns:target.statusEffects[0].turnsLeft};
    })()`);
    assert.deepEqual(result,{
        blocked:{duplicate:false,reason:"exclusiveConflict",hit:false},rolls:0,turns:4
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
        duplicate:{duplicate:true,reason:"sameNameDuplicate",hit:false},different:{duplicate:false,hit:true},rolls:1,
        effects:[{type:"burn",statusName:"燃燒",turnsLeft:2,percent:3}]
    });
});

test("exclusive hard-control MISS uses the formal status-MISS presentation and names both states",()=>{
    const runtime=loadFinalRuntime();
    const result=evaluateJson(runtime.context,`(function(){
        const popups=[],logs=[];
        showMissEffect=function(isPlayer,index,text){ popups.push([isPlayer,index,text]); };
        addBattleLog=function(message){ logs.push(message); };
        const target={name:"測試目標",alive:true,hp:100,statusEffects:[
            {type:"freeze",statusName:"冰封",turnsLeft:2}
        ]};
        const allowed=v173CanApplyNamedPersistentState(
            target,"petrify","monster",0,"石化術"
        );
        return {allowed:allowed,popups:popups,logs:logs};
    })()`);
    assert.deepEqual(result,{
        allowed:false,
        popups:[[false,0,"狀態MISS"]],
        logs:["石化術：測試目標目前已有【冰封】，新的【石化】MISS。"]
    });
});

test("player, regular monster, Boss and Abyss share the same Freeze-Petrify gate",()=>{
    const runtime=loadFinalRuntime();
    const result=evaluateJson(runtime.context,`(function(){
        let rolls=0;
        rollStatusEffectHit=function(){ rolls++; return true; };
        showMissEffect=function(){};
        addBattleLog=function(){};
        const cases=[
            {side:"player",index:0,entity:{id:"玩家",hp:100,statusEffects:[{type:"freeze",turnsLeft:2}]}},
            {side:"monster",index:0,entity:{name:"一般怪",alive:true,hp:100,statusEffects:[{type:"petrify",turnsLeft:2}]}},
            {side:"monster",index:1,entity:{name:"Boss",rank:"boss",alive:true,hp:100,statusEffects:[{type:"freeze",turnsLeft:2}]}},
            {side:"monster",index:2,entity:{name:"深淵怪",v141Abyss:true,alive:true,hp:100,statusEffects:[{type:"petrify",turnsLeft:2}]}}
        ];
        const results=cases.map(item=>{
            const next=item.entity.statusEffects[0].type==="freeze"?"petrify":"freeze";
            const before=item.entity.statusEffects[0].turnsLeft;
            const roll=v173RollNamedPersistentStatusEffect(
                item.entity,next,[100,1,1,0,0,true,item.entity.rank||"regular"],
                item.side,item.index,"硬控測試"
            );
            return {roll:roll,before:before,after:item.entity.statusEffects[0].turnsLeft};
        });
        return {rolls:rolls,results:results};
    })()`);
    assert.equal(result.rolls,0);
    result.results.forEach(entry=>{
        assert.deepEqual(entry.roll,{duplicate:false,reason:"exclusiveConflict",hit:false});
        assert.equal(entry.after,entry.before);
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
        first:{duplicate:false,hit:true},duplicate:{duplicate:true,reason:"sameNameDuplicate",hit:false},rolls:0,
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
    assert.deepEqual(result.popups,["MISS"]);
    assert.equal(result.effects.length,1);
    assert.match(result.logs.join("\n"),/火箭對燃燒目標，沒有命中！/);
});

test("accuracy, enemy Rage, monster shields and wind-elite Dodge use their formal state rules",()=>{
    const runtime=loadFinalRuntime();
    const result=evaluateJson(runtime.context,`(function(){
        Object.assign(player,{spirit:10,activeBuffs:[]});
        characterEquipment[player.element]={weapon:{stats:{accuracy:100}}};
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
        const monsterAccuracyBonus=getActiveAccuracyBonusPercent(supportMonster);
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
            name:"天兵天將",element:"wind",v141Abyss:true,v141SupportSkillIds:["dodgeSkill"],alive:true,
            hp:100,maxHP:100,sp:100,maxSP:100,evasion:20,skillChance:1,activeBuffs:[],statusEffects:[]
        };
        monsters.splice(0,monsters.length,elite);
        currentBattleMonsters.splice(0,currentBattleMonsters.length,0);
        battleToken=91;turn=4;
        const dodgeCast=v155ResolveWindEliteDodge(0,true);
        return {
            playerAccuracyMultiplier:playerAccuracy/basePlayerAccuracy,
            playerFinalAccuracyBonus:v173GetFinalAccuracyBonusPercent(player),
            monsterAccuracy:monsterAccuracy,monsterAccuracyBonus:monsterAccuracyBonus,rage:rage,shield:shield,
            dodgeCast:dodgeCast,evasion:elite.evasion,
            dodge:elite.activeBuffs.find(buff=>buff.type==="dodgeSkill"),
            dodgeExpires:elite.v155WindDodge&&elite.v155WindDodge.expiresTurn,
            hasStealth:elite.activeBuffs.some(buff=>buff.type==="stealthSkill"||buff.statusName==="隱身")
        };
    })()`);
    assert.deepEqual(result,{
        playerAccuracyMultiplier:1,playerFinalAccuracyBonus:50,monsterAccuracy:100,monsterAccuracyBonus:50,rage:{chance:25,damage:50},
        shield:{first:100,second:0,statusName:"岩盾",remaining:37,turnsLeft:2},
        dodgeCast:true,evasion:45,
        dodge:{type:"dodgeSkill",v141BuffType:"dodge",turnsLeft:3,statusName:"風行"},
        dodgeExpires:7,hasStealth:false
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

test("evasion sources add as final percentage points without an independent cap, and Barrier spends once per skill cast",()=>{
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
            uncapped:v173CombineEvasionRates([80,80]),
            blocked:blocked,remaining:target.activeBuffs[0].remainingBlocks
        };
    })()`);
    assert.deepEqual(result,{combined:110,uncapped:160,blocked:[true,true,true],remaining:5});
});

test("player agility does not grant evasion and default monster level retains explicit evasion",()=>{
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
            level40:MonsterBalance.build({monsterKey:"test",name:"四十級怪",level:40,element:"fire",archetype:"balanced",mode:"wild",rank:"regular",context:"wild/test"}).evasion,
            level200:v158NormalizeMonsterDefaultEvasion({level:200}).evasion,
            custom:custom.evasion,missing:missing.evasion
        };
    })()`);
    assert.deepEqual(result,{player:0,level40:0,level200:0,custom:24,missing:0});
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
        v148ResolveSupportAction(0,{action:"rage",targetAlly:1},skillDatabase.rage);
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
            [{type:"rage",statusName:"怒火",turnsLeft:3,chance:30,damage:55}],
            [{type:"rage",statusName:"怒火",turnsLeft:3,chance:30,damage:55}]
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
        getMonsterRank=function(){ return "regular"; };
        updateUI=function(){};finishPlayerAction=function(){};lungePlayerCard=function(){};
        showPlayerSpPopup=function(){};showMonsterHit=function(){};showMissEffect=function(){};addBattleLog=function(){};
        Math.random=function(){ return 0; };
        castDamageSkill("phoenixCry");
        const buff=player.activeBuffs.find(entry=>entry.type==="phoenixMight");
        const burnCounts=monsters.map(monster=>monster.statusEffects.filter(effect=>effect.type==="burn").length);
        turn=5;Math.random=function(){ return .5; };
        const boosted=calculateDamage(100,0,1,1,"fire","earth",{attacker:player,target:monsters[0]});
        player.activeBuffs=[];
        const plain=calculateDamage(100,0,1,1,"fire","earth",{attacker:player,target:monsters[0]});
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
    assert.match(mainSource,/const effectiveTargetType=getEffectiveSkillTargetType\(skill,level\);[\s\S]*?getSkillTargets\(\s*centerIndex,\s*effectiveTargetType\s*\)[\s\S]*?targets\.forEach\(index=>/);

    const flood=executeFullWaterCast("floodBeast");
    assert.deepEqual(flood.after.map((hp,index)=>hp<flood.before[index]),[
        false,false,false,false,true,false,false,false,false,false
    ]);
    assert.deepEqual(flood.effects,[
        [],[],[],[],[{type:"frostbite",turnsLeft:2,value:0,statusName:"凍傷"}],[],[],[],[],[]
    ]);
    assert.equal(flood.effects.flat().some(effect=>effect.type==="freeze"),false);
    assert.equal(flood.sp,965);

    const rain=executeFullWaterCast("iceArrowRain");
    assert.deepEqual(rain.after.map((hp,index)=>hp<rain.before[index]),Array(10).fill(true));
    assert.deepEqual(
        rain.effects.map(effects=>effects.map(effect=>[effect.type,effect.turnsLeft])),
        Array.from({length:10},()=>[["frostbite",2]])
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
        FourSymbolsBattlefieldSlots.hydrateAllyFormation({characterIndexToSlot:{0:"ALLY_F1",1:"ALLY_F2"}},[0,1]);
        const settled=v148ResolveSupportAction(0,{action:"healSpell",targetAlly:0},skillDatabase.healSpell);
        return {
            settled:settled,
            caster:{hp:player.hp,sp:player.sp},
            ally:{hp:player2.hp,sp:player2.sp},statuses:[player.statusEffects,player2.statusEffects],
            data:{baseHeal:skillDatabase.healSpell.baseHeal,healPerLevel:skillDatabase.healSpell.healPerLevel,
                spRestorePercentByLevel:skillDatabase.healSpell.spRestorePercentByLevel,
                spCost:skillDatabase.healSpell.spCost,targetType:skillDatabase.healSpell.targetType}
        };
    })()`);
    assert.deepEqual(result,{
        settled:true,caster:{hp:650,sp:55},ally:{hp:750,sp:10},statuses:[[],[]],
        data:{baseHeal:550,healPerLevel:30,spRestorePercentByLevel:[0,0,5,10,15],spCost:45,targetType:"allyTri"}
    });
});

test("final support passives and front/back Freeze behavior are exact",()=>{
    const runtime=loadFinalRuntime();
    const skills=runtime.skills;
    assert.deepEqual(
        [skills.rage.duration,skills.dodgeSkill.duration,skills.stealthSkill.duration,
            skills.windEX.evasionBonusPercent],
        [3,3,2,15],
        "current progression owner supplies support durations and Wind EX"
    );
    assert.match(progressionSource,/windEX:\{[\s\S]*?evasionBonusPercent:15/);
    assert.match(progressionSource,/DODGE_BY_LEVEL=Object\.freeze\(\[5,10,15,20,25\]\)/);
    assert.match(progressionSource,/CALM_RESIST_BY_LEVEL=Object\.freeze\(\[5,8,10,12,15\]\)/);
    assert.match(progressionSource,/CALM_ACCURACY_BY_LEVEL=Object\.freeze\(\[5,10,15,20,25\]\)/);
    assert.match(progressionSource,/const dodge=skillDatabase\.dodgeSkill;[\s\S]*?dodge\.evasionBonusPercentByLevel=DODGE_BY_LEVEL\.slice\(\)[\s\S]*?delete dodge\.evasionBonusPercent/);
    assert.match(progressionSource,/const calm=skillDatabase\.dinghaishenzhen;[\s\S]*?calm\.statusResistBonusByLevel=CALM_RESIST_BY_LEVEL\.slice\(\)[\s\S]*?calm\.accuracyBonusPercentByLevel=CALM_ACCURACY_BY_LEVEL\.slice\(\)[\s\S]*?delete calm\.statusResistBonus[\s\S]*?delete calm\.accuracyBonusPercent/);
    assert.deepEqual(skills.earthShield.reflectPercentByLevel,[20,40,60,80,100]);
    assert.deepEqual(skills.earthShield.durationByLevel,[3,3,3,3,4]);
    assert.deepEqual(skills.earthShield.remainingBlocksByLevel,[2,2,2,2,3]);
    assert.deepEqual(skills.barrier.durationByLevel,[3,3,3,4,5]);
    assert.equal(skills.barrier.remainingBlocksByLevel,undefined);
    assert.deepEqual(
        [skills.waterEX.damageBonusPercent,skills.waterEX.healBonusPercent,
            skills.waterEX.turnStartCleanseChance,skills.waterEX.statusResistBonus],
        [5,15,35,undefined]
    );
    assert.deepEqual(
        [skills.fireEX.damageBonusPercent,skills.fireEX.critChanceBonusPercent,
            skills.fireEX.critDamageBonusPercent,skills.fireEX.statusTargetDamageBonusPercent],
        [10,5,25,5]
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
        updateUI=function(){};
        Math.random=function(){ return 0; };
        const column=getSkillTargets(1,"column");
        tickStatusEffects();
        return {column:column,statuses:player.statusEffects};
    })()`);
    assert.deepEqual(result,{column:[1,4],statuses:[]});
});

test("all daily dungeons share three six-enemy waves and Gold replaces Equipment",()=>{
    const runtime=loadFinalRuntime();
    const result=evaluateJson(runtime.context,`(function(){
        Math.random=function(){ return 0; };
        Object.assign(player,{id:"主角",level:40});player2=null;player3=null;
        const types=["exp","material","gold"];
        const runs=types.map(type=>{
            const built=v148BuildDailyDungeonWaves(type);
            return {type:type,lengths:built.waves.map(wave=>wave.length),
                ranks:built.waves.map(wave=>wave.map(monster=>getMonsterRank(monster))),
                rows:built.waves.map(wave=>wave.map(monster=>monster.v141FormationRow)),
                positions:built.waves.map(wave=>wave.map(monster=>monster.v141FormationPosition)),
                orders:built.waves.map(wave=>wave.map(monster=>monster.v148TargetOrder))};
        });
        const one40=v148BuildDailyDungeonWaves("exp").waves[0][0].balanceProjection.profiles.mode;
        player2={id:"角色2",level:40};
        const two40=v148BuildDailyDungeonWaves("exp").waves[0][0].balanceProjection.profiles.mode;
        player3={id:"角色3",level:80};
        const three80=v148BuildDailyDungeonWaves("exp").waves[0][0].balanceProjection.profiles.mode;
        return {runs:runs,one40:one40,two40:two40,three80:three80};
    })()`);
    result.runs.forEach(run=>{
        assert.deepEqual(run.lengths,[6,6,6],run.type);
        assert.deepEqual(run.ranks[0],["regular","regular","regular","regular","regular","regular"]);
        assert.deepEqual(run.ranks[1],["regular","regular","regular","regular","elite","elite"]);
        assert.deepEqual(run.ranks[2],["regular","regular","regular","elite","boss","elite"]);
        run.rows.forEach(row=>assert.deepEqual(row,[0,0,0,1,1,1]));
        run.positions.forEach(row=>assert.deepEqual(row,[0,1,2,0,1,2]));
        run.orders.forEach(row=>assert.deepEqual(row,[4,1,3,6,2,5]));
    });
    assert.equal(result.one40.partySizeDurability,.04);
    assert.equal(result.two40.partySizeDurability,.08);
    assert.equal(result.three80.partySizeDurability,.12);
    const dungeonSource=fs.readFileSync("js/42-v148-combat-dungeon-fixes.js","utf8");
    assert.match(dungeonSource,/showDailyGoldReward\(goldDungeonReward\(active\.level\)\)/);
    assert.match(dungeonSource,/金幣副本/);
    assert.match(dungeonSource,/v132BeginEquipmentDungeon=function\(\)\{ return beginFormalDailyDungeon\("gold"\); \}/);
});

test("Abyss floors one through five keep exact compositions, skill levels and additional HP",()=>{
    const runtime=loadFinalRuntime();
    const result=evaluateJson(runtime.context,`(function(){
        Object.assign(player,{id:"主角",level:70});player2=null;player3=null;
        Math.random=function(){ return 0; };
        return [1,2,3,4,5].map(floor=>{
            const roster=floor===5?v174AbyssBuildRoster(40,4,4):v141BuildAbyssRoster(floor);
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
    const final=result[4];
    assert.equal(final.count,10);
    assert.deepEqual(final.names,["東帝天尊","天帝天尊","極帝天尊","北帝天尊","南帝天尊",
        "天兵天將","天兵天將","天兵天將","天兵天將","天兵天將"]);
    assert.deepEqual(final.ranks,["smallBoss","smallBoss","smallBoss","smallBoss","smallBoss","elite","elite","elite","elite","elite"]);
    assert.deepEqual(final.elements,["earth","wind","light","water","fire","water","earth","fire","wind","water"]);
    assert.deepEqual(final.forceLevels,[5,5,5,5,5,5,5,5,5,5]);
    assert.deepEqual(final.skills.slice(0,5),[["dustStorm","flyingSandStrike"],["windHowlLightning","stormRain"],["flyingSandStrike","phoenixCry"],
        ["iceArrowRain","iceSpin"],["dragonSlash","phoenixCry"]]);
    assert.deepEqual(final.supports.slice(0,5),[["rockWall"],["stealthSkill"],["yuanZuBlessing"],["healSpell"],["rage"]]);
    assert.deepEqual(final.skills.slice(5),[[],["stoneBreakSky"],["flameTornado"],[],[]]);
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
                rank:index<5?"boss":"elite",v141Abyss:true,v174TrueRealmFinal:true,alive:true,
                hp:(index>=1&&index<=3)?100:900,maxHP:1000,sp:1000,maxSP:1000,
                activeBuffs:[],statusEffects:[],v141FormationRow:index<5?0:1,v141FormationPosition:index%5,
                v141SupportSkillIds:index===3?["healSpell"]:[],v141ForceSkillLevel:5,skillChance:1});
            currentBattleMonsters.push(index);
        }
        FourSymbolsBattlefieldSlots.setActiveEnemySnapshot(
            FourSymbolsBattlefieldSlots.createEnemyFormationSnapshot(currentBattleMonsters,{originalFormationType:10})
        );
        updateUI=function(){};finishPlayerAction=function(){};addBattleLog=function(){};
        showMonsterSkillNameBadge=function(){};showMonsterHit=function(){};Math.random=function(){ return 0; };
        const beforeNorth=monsters.map(monster=>monster.hp);
        const north=v155ResolveNorthHeal(3,true);
        const northChanged=monsters.map((monster,index)=>monster.hp!==beforeNorth[index]?index:null).filter(index=>index!==null);

        monsters.forEach((monster,index)=>{ monster.hp=(index>=6&&index<=8)?100:1000;monster.sp=1000;monster.v141SupportSkillIds=[]; });
        monsters[5].v141SupportSkillIds=["healSpell"];
        monsters[5].v141ForceSkillLevel=5;
        const beforeElite=monsters.map(monster=>monster.hp);
        const elite=v141TryMonsterSpecialAction(5);
        const eliteChanged=monsters.map((monster,index)=>monster.hp!==beforeElite[index]?index:null).filter(index=>index!==null);
        return {north:north,northChanged:northChanged,elite:elite,eliteChanged:eliteChanged};
    })()`);
    assert.deepEqual(result,{north:true,northChanged:[1,2,3],elite:true,eliteChanged:[6,7,8]});
});

test("North Emperor does not revive when revive is absent from its loadout",()=>{
    const runtime=loadFinalRuntime();
    const result=evaluateJson(runtime.context,`(function(){
        monsters.splice(0,monsters.length,
            {name:"東帝天尊",rank:"boss",v141Abyss:true,v174TrueRealmFinal:true,alive:false,hp:0,maxHP:1000,sp:0,maxSP:1000,activeBuffs:[],statusEffects:[]},
            {name:"天帝天尊",rank:"boss",v141Abyss:true,v174TrueRealmFinal:true,alive:true,hp:1000,maxHP:1000,sp:1000,maxSP:1000,activeBuffs:[],statusEffects:[]},
            {name:"極帝天尊",rank:"boss",v141Abyss:true,v174TrueRealmFinal:true,v141SupportSkillIds:["yuanZuBlessing"],alive:true,hp:1000,maxHP:1000,sp:1000,maxSP:1000,activeBuffs:[],statusEffects:[]},
            {name:"北帝天尊",rank:"boss",v141Abyss:true,v174TrueRealmFinal:true,v141SupportSkillIds:["healSpell"],alive:true,hp:1000,maxHP:1000,sp:1000,maxSP:1000,v141ForceSkillLevel:5,activeBuffs:[],statusEffects:[],skillChance:1},
            {name:"天兵天將",rank:"elite",v141Abyss:true,v174TrueRealmFinal:true,alive:false,hp:0,maxHP:1000,sp:0,maxSP:1000,activeBuffs:[],statusEffects:[]}
        );
        currentBattleMonsters.splice(0,currentBattleMonsters.length,0,1,2,3,4);
        updateUI=function(){};finishPlayerAction=function(){};addBattleLog=function(){};
        showMonsterSkillNameBadge=function(){};showMonsterHit=function(){};
        const cast=v155ResolveNorthSupport(3,true);
        return {cast:cast,boss:{alive:monsters[0].alive,hp:monsters[0].hp},elite:{alive:monsters[4].alive,hp:monsters[4].hp}};
    })()`);
    assert.deepEqual(result,{cast:false,boss:{alive:false,hp:0},elite:{alive:false,hp:0}});
});

test("East Rock Wall and Heaven Stealth use their carried Skill IDs",()=>{
    const runtime=loadFinalRuntime();
    const result=evaluateJson(runtime.context,`(function(){
        const names=["東帝天尊","天帝天尊"];
        monsters.splice(0,monsters.length,...names.map((name,index)=>({
            name:name,rank:"boss",element:index===0?"earth":index===1?"wind":"light",
            v141Abyss:true,v174TrueRealmFinal:true,v141SupportSkillIds:index===0?["rockWall"]:["stealthSkill"],alive:true,hp:1000,maxHP:1000,sp:1000,maxSP:1000,
            resistance:0,evasion:0,skillChance:1,activeBuffs:[],statusEffects:[],
            v141FormationRow:0,v141FormationPosition:index
        })));
        currentBattleMonsters.splice(0,currentBattleMonsters.length,0,1);
        FourSymbolsBattlefieldSlots.setActiveEnemySnapshot(
            FourSymbolsBattlefieldSlots.createEnemyFormationSnapshot(currentBattleMonsters,{originalFormationType:5})
        );
        updateUI=function(){};finishPlayerAction=function(){};addBattleLog=function(){};
        showMonsterSkillNameBadge=function(){};showMonsterHit=function(){};
        const earth=v155ResolveRockWall(0,true);
        const calm=v155ResolveStealthSkill(1,true);
        return {
            earth:earth,calm:calm,
            earthTargets:monsters.filter(monster=>monster.activeBuffs.some(buff=>buff.type==="rockWall")).length,
            calmTargets:monsters.filter(monster=>monster.activeBuffs.some(buff=>buff.type==="stealthSkill")).length,
            earthBuff:monsters[0].activeBuffs.find(buff=>buff.type==="rockWall"),
            calmBuff:monsters[0].v141TeamBuffs.find(buff=>buff.type==="stealthSkill")
        };
    })()`);
    assert.equal(result.earth,true);
    assert.equal(result.calm,true);
    assert.equal(result.earthTargets,2);
    assert.equal(result.calmTargets,1);
    assert.equal(result.earthBuff.type,"rockWall");
    assert.equal(result.calmBuff.type,"stealthSkill");
});

function prepareExtremeEmperor(context){
    vm.runInContext(`
        monsters.splice(0,monsters.length,
            {name:"極帝天尊",element:"light",level:100,hp:500,maxHP:1000,sp:500,maxSP:1000,
                alive:true,v174TrueRealmFinal:true,v141SupportSkillIds:["yuanZuBlessing"],evasion:100,agility:80,activeBuffs:[],statusEffects:[{type:"burn",turnsLeft:2}]},
            {name:"天兵天將",element:"fire",level:100,hp:400,maxHP:1000,sp:10,maxSP:1000,
                alive:true,evasion:100,agility:80,activeBuffs:[],statusEffects:[{type:"stun",turnsLeft:1}]}
        );
        currentBattleMonsters.splice(0,currentBattleMonsters.length,0,1);
        battleToken="v170-emperor-test";
        turn=10;
    `,context);
}

test("Extreme Emperor carries only Yuan Zu Blessing and settles its final behavior",()=>{
    const blessingRuntime=loadFinalRuntime();
    prepareExtremeEmperor(blessingRuntime.context);
    const blessing=evaluateJson(blessingRuntime.context,`(function(){
        const first=v155ResolveExtremeEmperorAction(0,"yuanZuBlessing",[true,false]);
        const afterFirst=monsters.map(monster=>({hp:monster.hp,sp:monster.sp,evasion:monster.evasion,statusEffects:monster.statusEffects,
            turnsLeft:monster.v155EvasionBlessing.displayBuff.turnsLeft}));
        monsters[0].sp=500;
        const second=v155ResolveExtremeEmperorAction(0,"yuanZuBlessing",[false,true]);
        const rejectedFormerSkills=[
            v155ResolveExtremeEmperorAction(0,"yuanXiangGuangMing",false),
            v155ResolveExtremeEmperorAction(0,"yuanGuangShield",false)
        ];
        return {first:first,second:second,rejectedFormerSkills:rejectedFormerSkills,afterFirst:afterFirst,
            afterSecond:monsters.map(monster=>({hp:monster.hp,sp:monster.sp,evasion:monster.evasion,statusEffects:monster.statusEffects,
                blessings:monster.activeBuffs.filter(buff=>buff.statusName==="元祖賜福").length}))};
    })()`);
    assert.deepEqual(blessing,{
        first:true,second:true,rejectedFormerSkills:[false,false],
        afterFirst:[
            {hp:600,sp:555,evasion:115,statusEffects:[],turnsLeft:2},
            {hp:500,sp:110,evasion:115,statusEffects:[{type:"stun",turnsLeft:1}],turnsLeft:2}
        ],
        afterSecond:[
            {hp:700,sp:555,evasion:115,statusEffects:[],blessings:1},
            {hp:600,sp:210,evasion:115,statusEffects:[],blessings:1}
        ]
    });

    const data=blessingRuntime.skills;
    assert.deepEqual(
        [data.yuanZuBlessing.spCost,data.yuanZuBlessing.baseHeal,data.yuanZuBlessing.baseHealSP,
            data.yuanZuBlessing.cleanseChance,data.yuanZuBlessing.evasionBonusPercent,data.yuanZuBlessing.duration],
        [45,100,100,35,15,2]
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
    assert.deepEqual(monsterOnly,["single_normal",1.50,.075,0,0]);
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
        Object.assign(player,{attack:10,intelligence:10,vitality:10,energy:0,defensePoints:0,agility:0,bonusHP:0,bonusSP:0});
        const base=getBaseStats();
        const monster=MonsterBalance.build({monsterKey:"test",name:"比例怪",level:50,element:"fire",archetype:"balanced",mode:"wild",rank:"regular",context:"wild/test"});
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
            baseExpected:{maxHP:100+player.vitality*50,attack:30+player.level*4+player.attack*4,
                magicAttack:30+player.level*4+player.intelligence*2.75,
                defense:30+player.level*3+player.defensePoints*4},
            monster:{attack:monster.attack,expectedAttack:30+(monster.level-1)*4+monster.attackPoints*4,
                magicAttack:monster.magicAttack,expectedMagicAttack:30+(monster.level-1)*2.75+monster.intelligencePoints*2.75,
                defense:monster.defense,expectedDefense:30+(monster.level-1)*4+monster.defensePoints*4},
            modern:modern,modernRaw:v173GetSkillRawAttack(skillDatabase.flameSlash,1,100),
            legacy:legacy,legacyRaw:v173GetSkillRawAttack(legacySkill,3,100)
        };
    })()`);
    assert.deepEqual(result.constants,[600,900,1200,1400]);
    assert.deepEqual(result.half,[300,450,600,700]);
    assert.deepEqual(result.base,result.baseExpected);
    assert.equal(result.monster.attack,result.monster.expectedAttack);
    assert.equal(result.monster.magicAttack,result.monster.expectedMagicAttack);
    assert.equal(result.monster.defense,result.monster.expectedDefense);
    assert.deepEqual([result.modern,result.modernRaw],[150,150],
        "single_low role = effectiveAttack×1.20 + Lv1 skill damage 30");
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
    assert.equal(result.actual,result.expected,"live monster skill damage must equal the shared modern calculator");
    assert.ok(result.expected>0);
});

test("V173.38 formal damage matrix covers levels, roles, elements, pressure and snapshot range",()=>{
    const runtime=loadFinalRuntime();
    const report=evaluateJson(runtime.context,`(function(){
        Math.random=function(){ return .5; };
        const roles=["single_low","single_normal","single_burst","tri_damage","aoe_damage"];
        function roleSkill(role){
            return Object.assign({id:"test-"+role,category:"physical",damageRole:role},v173DamageRoleProfiles[role]);
        }
        function direct(level,role,skillLevel){
            const attack=30+level*4+level*3;
            const defense=30+level*3+level*4;
            return calculateSkillDamage({skill:roleSkill(role),skillLevel:skillLevel,effectiveAttack:attack,
                target:{level:level,element:"light",statusEffects:[]},targetDefense:defense,
                casterLevel:level,casterElement:"light"});
        }
        const levels=[20,50,80,100].map(level=>({
            level:level,
            values:Object.fromEntries(roles.map(role=>[role,direct(level,role,Math.min(5,Math.ceil(level/20)))]))
        }));
        const baseOptions={ordinaryDamageBonusPercent:0,critMultiplier:1};
        const same=calculateDamage(1000,0,50,50,"light","light",baseOptions);
        const high=calculateDamage(1000,0,60,50,"light","light",baseOptions);
        const low=calculateDamage(1000,0,30,50,"light","light",baseOptions);
        const neutral=calculateDamage(1000,0,50,50,"earth","fire",baseOptions);
        const advantage=calculateDamage(1000,0,50,50,"earth","water",baseOptions);
        const disadvantage=calculateDamage(1000,0,50,50,"water","earth",baseOptions);

        Object.assign(player,{id:"目標",level:100,element:"light"});player2=null;player3=null;
        const world={rank:"regular",level:100,element:"fire"};
        const elite={rank:"elite",level:100,element:"fire"};
        const boss={rank:"boss",level:100,element:"fire"};
        const daily={rank:"boss",level:100,element:"fire",v132Dungeon:true};
        const abyss={rank:"boss",level:100,element:"fire",v132Dungeon:true,v141Abyss:true};
        const pressures=[world,elite,boss,daily,abyss].map(attacker=>v173GetEnemyPressureMultiplier(attacker,player));
        const reverse=v173GetEnemyPressureMultiplier(player,abyss);

        const burst=roleSkill("single_burst");
        const snapshot=calculateSkillDamage({skill:burst,skillLevel:5,effectiveAttack:1330,
            target:{level:100,element:"light",statusEffects:[]},targetDefense:1330,
            casterLevel:100,casterElement:"light",critMultiplier:1});
        const budget=calculateSkillDamage({skill:Object.assign({},burst,{damageBudgetMultiplier:.9}),skillLevel:5,effectiveAttack:1330,
            target:{level:100,element:"light",statusEffects:[]},targetDefense:1330,
            casterLevel:100,casterElement:"light",critMultiplier:1});
        return {levels:levels,level:[same,high,low],element:[neutral,advantage,disadvantage],
            pressures:pressures,reverse:reverse,snapshot:snapshot,budget:budget};
    })()`);

    report.levels.forEach(row=>{
        assert.ok(row.values.single_low<row.values.single_normal);
        assert.ok(row.values.single_normal<row.values.single_burst);
        assert.ok(row.values.tri_damage<row.values.single_normal);
        assert.ok(row.values.aoe_damage<row.values.tri_damage);
        Object.values(row.values).forEach(value=>assert.ok(Number.isFinite(value)&&value>=1));
    });
    assert.deepEqual(report.level,[1000,Math.round(1000*Math.pow(1.01,10)),Math.round(1000*Math.pow(1.01,-20))]);
    assert.deepEqual(report.element,[1000,1200,850]);
    assert.deepEqual(report.pressures,[1,1.1,1.2,1.25,1.35]);
    assert.equal(report.reverse,1);
    assert.ok(Number.isFinite(report.snapshot)&&report.snapshot>report.level[0],report.snapshot);
    assert.ok(report.budget<report.snapshot);
});

test("forced final-Abyss skill levels fold the modern scaling fields exactly once",()=>{
    const runtime=loadFinalRuntime();
    const result=evaluateJson(runtime.context,`(function(){
        const monster={v174TrueRealmFinal:true,v141ForceSkillLevel:5,skillIds:["dragonSlash"],v141SupportSkillIds:[]};
        const skill=skillDatabase.dragonSlash;
        const before=[skill.maxLevel,skill.powerMultiplier,skill.powerPerLevel,skill.flatDamage,skill.flatDamagePerLevel];
        const during=v155WithForcedFinalAbyssSkillLevel(monster,function(){
            return [skill.maxLevel,skill.powerMultiplier,skill.powerPerLevel,skill.flatDamage,skill.flatDamagePerLevel];
        });
        const after=[skill.maxLevel,skill.powerMultiplier,skill.powerPerLevel,skill.flatDamage,skill.flatDamagePerLevel];
        return {before:before,during:during,after:after};
    })()`);
    assert.deepEqual(result,{
        before:[10,1.75,.1,0,0],during:[1,2.15,0,0,0],after:[10,1.75,.1,0,0]
    });
});


test("ordinary bonuses share one capped additive bucket and critical damage caps at 2.25",()=>{
    const runtime=loadFinalRuntime();
    const result=evaluateJson(runtime.context,`(function(){
        Math.random=function(){ return .5; };
        getElementDamagePassiveMultiplier=function(){ return 1.12; };
        getLearnedElementEX=function(){ return {}; };
        window.v155GetPhoenixMightMultiplier=function(){ return 1; };
        const attacker={element:"fire",activeBuffs:[],statusEffects:[]};
        const target={rank:"boss",level:50,element:"light",statusEffects:[{type:"burn",turnsLeft:1}]};
        const skill={category:"physical"};
        const options={attacker:attacker,target:target,skill:skill,critMultiplier:1};
        const percent=v173GetOrdinaryDamageBonusPercent(options);
        const additive=calculateDamage(1000,0,50,50,"fire","light",options);
        const capped=calculateDamage(1000,0,50,50,"light","light",{
            ordinaryDamageBonusPercent:[40,20],critMultiplier:1
        });
        const cappedCrit=calculateDamage(1000,0,50,50,"light","light",{critMultiplier:99});

        Object.assign(player,{level:100,attack:1000,element:"fire",activeBuffs:[{
            type:"rage",turnsLeft:2,skillLevel:5,bonusPercent:1000,
            critChanceBonusPercent:1000,critDamageBonusPercent:1000
        }]});
        getSkillLevel=function(){ return 0; };
        Math.random=function(){ return 0; };
        const roll=rollCritical(player,"physical",0);
        return {percent:Math.round(percent*100)/100,additive:additive,capped:capped,cappedCrit:cappedCrit,roll:roll};
    })()`);
    assert.deepEqual(result,{percent:17,additive:1170,capped:1500,cappedCrit:2250,
        roll:{isCrit:true,multiplier:2.05}});
    assert.doesNotMatch(fs.readFileSync("js/43-v149-skill-ui-rules.js","utf8"),/previousCalculateSkillDamage/);
    assert.doesNotMatch(fs.readFileSync("js/46-v155-dev-fixes.js","utf8"),/previousCalculateDamage/);
    assert.doesNotMatch(fs.readFileSync("js/50-v169-water-skill-rules.js","utf8"),/window\.calculateDamage\s*=/);
});

test("damage safety, full pressure matrix and Abyss level brackets remain formal",()=>{
    const runtime=loadFinalRuntime();
    const result=evaluateJson(runtime.context,`(function(){
        Object.assign(player,{id:"壓力目標",level:100,element:"light"});player2=null;player3=null;
        function attacker(rank,mode){
            const value={rank:rank,level:100,element:"fire"};
            if(mode==="daily"){ value.v132Dungeon=true; }
            if(mode==="abyss"){ value.v132Dungeon=true;value.v141Abyss=true; }
            return value;
        }
        const pressure={};
        ["world","daily","abyss"].forEach(mode=>{
            pressure[mode]=["regular","elite","boss"].map(rank=>
                v173GetEnemyPressureMultiplier(attacker(rank,mode),player)
            );
        });
        const reverse=v173GetEnemyPressureMultiplier(player,attacker("boss","abyss"));

        Math.random=function(){ return .5; };
        const identity={monsterKey:"rank.test",name:"Rank reference",level:60,element:"fire",archetype:"balanced",mode:"daily",context:"daily/test",dailyType:"exp",wave:1,slot:0,partySize:3,highestPartyLevel:60,skillFrequency:.45};
        const [dailyRegular,dailyElite,dailyBoss]=["regular","elite","boss"].map(rank=>MonsterBalance.build({...identity,rank}));
        const rankAttack=[dailyRegular,dailyElite,dailyBoss].map(monster=>[monster.attack,monster.magicAttack]);

        const abyssLevels=[20,50,80,100].map(level=>{
            window.v132GetDungeonMonsterLevel=function(){ return level; };
            return v141BuildAbyssRoster(1)[0].v141ForceSkillLevel;
        });
        window.v132GetDungeonMonsterLevel=function(){ return 100; };
        const floor5=v141BuildAbyssRoster(5);

        const burst=Object.assign({id:"snapshot",category:"physical",damageRole:"single_burst"},
            v173DamageRoleProfiles.single_burst);
        Math.random=function(){ return 0; };
        const low=calculateSkillDamage({skill:burst,skillLevel:5,effectiveAttack:1330,
            target:{level:100,element:"light",statusEffects:[]},targetDefense:1330,
            casterLevel:100,casterElement:"light",critMultiplier:1});
        Math.random=function(){ return 1; };
        const high=calculateSkillDamage({skill:burst,skillLevel:5,effectiveAttack:1330,
            target:{level:100,element:"light",statusEffects:[]},targetDefense:1330,
            casterLevel:100,casterElement:"light",critMultiplier:1});
        const unsafe=[
            calculateDamage(NaN,NaN,NaN,NaN,null,null),
            calculateDamage(Infinity,0,100,100,"fire","wind"),
            calculateDamage(1000,Infinity,100,100,"fire","wind"),
            calculateDamage(-100,-100,100,100,"fire","wind")
        ];
        return {pressure:pressure,reverse:reverse,rankAttack:rankAttack,abyssLevels:abyssLevels,
            floor5Count:floor5.length,floor5Levels:floor5.map(monster=>monster.v141ForceSkillLevel),
            low:low,high:high,unsafe:unsafe};
    })()`);
    assert.deepEqual(result.pressure,{world:[1,1.1,1.2],daily:[1.05,1.15,1.25],abyss:[1.15,1.25,1.35]});
    assert.equal(result.reverse,1);
    assert.deepEqual(result.rankAttack,[result.rankAttack[0],result.rankAttack[0],result.rankAttack[0]]);
    assert.deepEqual(result.abyssLevels,[2,2,2,2]);
    assert.equal(result.floor5Count,10);
    assert.ok(result.floor5Levels.every(level=>level===5));
    assert.ok(Number.isFinite(result.low)&&result.low>=1,result.low);
    assert.ok(Number.isFinite(result.high)&&result.high>=1,result.high);
    assert.ok(result.low<result.high,"95%-105% variance must preserve low < high");
    result.unsafe.forEach(value=>assert.ok(Number.isFinite(value)&&value>=1));
});



test("formal EXP chain couples actual patrol reward to target battles from Lv20",()=>{
    const runtime=loadFinalRuntime();
    const report=evaluateJson(runtime.context,`(function(){
        const checkpoints=[20,30,40,50,60,70,80,90,95,98,99];
        const profiles=[
            {min:11,max:20,key:"desert",size:2},{min:21,max:30,key:"ice",size:4.5},
            {min:31,max:40,key:"zone4",size:4.5},{min:41,max:50,key:"zone5",size:4.5},
            {min:51,max:60,key:"zone6",size:4.5},{min:61,max:70,key:"zone7",size:4.5},
            {min:71,max:80,key:"zone8",size:4.5},{min:81,max:90,key:"zone9",size:4.5},
            {min:91,max:99,key:"zone10",size:4.5}
        ];
        function runtimeAverage(level){
            const profile=profiles.find(value=>level>=value.min&&level<=value.max);
            const source=zoneConfig[profile.key].monsters;
            const roster=typeof source==="function"?source():source;
            const expectedUnit=roster.reduce((sum,monster)=>{
                if(Number.isFinite(Number(monster.v141CurveEliteRate))){
                    const rate=Math.max(0,Math.min(1,Number(monster.v141CurveEliteRate)));
                    const regular=Object.assign({},monster,{rank:"regular"});
                    const elite=Object.assign({},monster,{rank:"elite"});
                    return sum+v173CalculateStandardPatrolExp([regular],level)*(1-rate)+
                        v173CalculateStandardPatrolExp([elite],level)*rate;
                }
                return sum+v173CalculateStandardPatrolExp([monster],level);
            },0)/roster.length;
            return Math.round(expectedUnit*profile.size);
        }
        const rows=checkpoints.map(level=>{
            const averageBattleExp=v139GetTrainingZoneAverageExpForLevel(level);
            const expNext=v133GetExpNextForLevel(level);
            const targetBattles=v139GetTargetBattlesForLevel(level);
            const theoreticalBattles=expNext/averageBattleExp;
            return {level:level,expNext:expNext,averageBattleExp:averageBattleExp,
                runtimeAverage:runtimeAverage(level),targetBattles:targetBattles,
                theoreticalBattles:theoreticalBattles,
                differencePercent:(theoreticalBattles-targetBattles)/targetBattles*100};
        });
        const rankMonster={level:20,element:"fire"};
        const rank=["regular","elite","boss"].map(rank=>
            v173CalculateStandardPatrolExp([Object.assign({},rankMonster,{rank:rank})],20)
        );
        const standard=rank[0];
        const modes={
            manual:v173ApplyPatrolExpMode(standard,{}),
            elementBox:v173ApplyPatrolExpMode(standard,{elementBox:true}),
            rested:v173ApplyPatrolExpMode(standard,{rested:true}),
            blockedStack:v173ApplyPatrolExpMode(standard,{elementBox:true,rested:true})
        };
        const phase={level19:v173GetPatrolProgressionExpMultiplier(19),level20:v173GetPatrolProgressionExpMultiplier(20)};
        const charge=[20,50,99].map(level=>[level,v173GetNaturalChargeLevelsPerDay(level)]);
        const daily=[20,50,99].map(level=>{
            const reward=v173GetDailyGrowthRewardBreakdown(level);
            const levelsPerDay=v173GetDailyQuestLevelsPerDay(level);
            return [level,reward.totalExp,Math.round(v133GetExpNextForLevel(level)*levelsPerDay),levelsPerDay];
        });
        Object.assign(player,{level:20,exp:0,expNext:v133GetExpNextForLevel(20)});player2=null;player3=null;
        const dungeonNormal=v139GetExpDungeonRewardExp();
        return {rows:rows,rank:rank,modes:modes,phase:phase,charge:charge,daily:daily,
            dungeonNormal:dungeonNormal,dungeonRatio:dungeonNormal/player.expNext};
    })()`);

    report.rows.forEach(row=>{
        assert.ok(Math.abs(row.theoreticalBattles-row.targetBattles)<0.001,"Lv"+row.level+" target battles");
        assert.ok(Math.abs(row.differencePercent)<0.001,"Lv"+row.level+" difference");
        assert.ok(Math.abs(row.runtimeAverage-row.averageBattleExp)/row.averageBattleExp<.01,"Lv"+row.level+" battle owner/audit mismatch");
    });
    assert.deepEqual(report.rank,[700,1050,2100]);
    assert.deepEqual(report.modes,{manual:700,elementBox:490,rested:1400,blockedStack:490});
    assert.deepEqual(report.phase,{level19:3,level20:1});
    assert.deepEqual(report.charge,[[20,1.3],[50,1],[99,.32]]);
    report.daily.forEach(([level,actual,expected])=>assert.equal(actual,expected,"Lv"+level+" daily Growth EXP"));
    assert.ok(Math.abs(report.dungeonRatio-.33)<.001);
    const dungeonSource=fs.readFileSync("js/27-v132-content-expansion.js","utf8");
    const dailyDungeonSource=fs.readFileSync("js/42-v148-combat-dungeon-fixes.js","utf8");
    assert.match(dungeonSource,/const DUNGEON_DAILY_LIMIT_ENABLED=false/);
    assert.match(dailyDungeonSource,/showRewardedAd\(\(\)=>grant\(2\)/);
    console.log("EXP_GROWTH_REPORT="+JSON.stringify(report));
});

test("V2 final percent sources, naked levels, Calm, Dodge, Wind EX and low-HP cap",()=>{
    const runtime=loadFinalRuntime();
    const evidence=evaluateJson(runtime.context,`(()=>{
        player.element="wind";player.level=100;player.activeBuffs=[];player.statusEffects=[];
        characterEquipment.fire={};characterEquipment.wind=characterEquipment.fire;
        characterSkillLoadouts.fire={skillLevels:{windEX:1},equippedSkills:[]};
        player.hp=getMainCharacterStats().maxHP;
        const wind={accuracy:getFinalAccuracyBonusPercent(player),evasion:getMainCharacterStats().evasion};
        player.hp=1;
        const cap=calculateHitChancePercent(1000,0,0,0,player);
        characterSkillLoadouts.fire.skillLevels.windEX=0;
        const naked=[1,100].map(level=>{player.level=level;return calculateHitChancePercent(getMainCharacterStats().accuracy,MonsterBalance.build({monsterKey:"test",name:"QA",level,element:"fire",archetype:"balanced",mode:"wild",rank:"regular",context:"wild/test"}).evasion,0,0);});
        const calm=[5,10,15,20,25].map(value=>{player.activeBuffs=[{type:"dinghaishenzhen",turnsLeft:3,accuracyBonusPercent:value}];return [getMainCharacterStats().accuracy,getFinalAccuracyBonusPercent(player),calculateHitChancePercent(0,40,0,getFinalAccuracyBonusPercent(player))];});
        const dodge=[5,10,15,20,25].map(value=>{player.activeBuffs=[{type:"dodgeSkill",turnsLeft:3,percent:value}];return getMainCharacterStats().evasion;});
        return {wind,cap,naked,calm,dodge};
    })()`);
    assert.deepEqual(evidence.wind,{accuracy:15,evasion:15});assert.equal(evidence.cap,50);
    assert.deepEqual(evidence.naked,[95,95]);
    assert.deepEqual(evidence.calm,[5,10,15,20,25].map(v=>[0,v,55+v]));
    assert.deepEqual(evidence.dodge,[5,10,15,20,25]);
});

test("V2 explicit hit fields survive Daily Owner construction and repeated render",()=>{
    const runtime=loadFinalRuntime();
    const values=evaluateJson(runtime.context,`(()=>{
        const daily=[10,20,100].map(level=>{
            Object.assign(player,{id:"QA",level});player2=null;player3=null;
            const monster=v148BuildDailyDungeonWaves("exp").waves[0][0];
            monster.accuracy=10;monster.evasion=8;
            monsters=[monster];currentBattleMonsters=[0];currentZone="dungeon";
            window.v132ActiveDungeonRun={mode:"daily",partySize:1,highestPartyLevel:level};
            const attack=monster.attack;v141PrepareBattleRender();v144ConfigureDungeonBattleSkillsAfterRender();v141PrepareBattleRender();v144ConfigureDungeonBattleSkillsAfterRender();
            if(attack!==monster.attack)throw Error("late attack mutation");
            return [monster.accuracy,monster.evasion,calculateHitChancePercent(monster.accuracy,monster.evasion,0,0)];
        });
        const beginner={accuracy:10,evasion:8,attack:100,maxHP:1000,hp:1000};
        v17342NormalizeBeginnerForestMonster(beginner);
        return {daily,beginner:[beginner.accuracy,beginner.evasion,beginner.attack]};
    })()`);
    assert.deepEqual(values.daily,[[10,8,97],[10,8,97],[10,8,97]]);
    assert.deepEqual(values.beginner,[10,8,100]);
});

test("Level Suppression V2 after ALL generated production feature bundles",()=>{
    const context=makeContext();
    context.document.createDocumentFragment=()=>makeUniversalNode();
    vm.runInContext(fs.readFileSync('js/startup/account-save-repository.js','utf8'),context);
    vm.runInContext('FourSymbolsAccountSave.activate("v170-test-uid")',context);
    const manifest=JSON.parse(fs.readFileSync('asset-manifest.json','utf8'));
    const features=manifest.featureManifest.bundles;
    const loaded=new Set();
    function load(name){
        if(loaded.has(name))return;
        const bundle=features[name];
        for(const dependency of bundle.dependencies||[])load(dependency);
        for(const file of bundle.scripts||[])vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file,timeout:5000});
        loaded.add(name);
    }
    for(const name of Object.keys(features))load(name);
    const report=evaluateJson(context,`(function(){
        Math.random=function(){return .5;};
        Object.assign(player,{id:"V2",element:"light",activeBuffs:[],statusEffects:[],hp:1000});
        player2=null;player3=null;
        const target={level:70,element:"light",hp:100000,maxHP:100000,defense:400,alive:true,statusEffects:[]};
        const levels=[70,71,69,100,40];
        const playerDamage=levels.map(level=>{player.level=level;return calculateDamage(10000,400,level,70,"light","light",{attacker:player,target,ordinaryDamageBonusPercent:20,critMultiplier:1.5});});
        const enemyDamage=levels.map(level=>{player.level=70;target.level=level;return calculateDamage(10000,400,level,70,"light","light",{attacker:target,target:player,ordinaryDamageBonusPercent:20,critMultiplier:1.5});});
        const skill=skillDatabase.stoneSlash;
        const skillDamage=levels.map(level=>{player.level=level;target.level=70;return calculateSkillDamage({skill,skillLevel:1,effectiveAttack:10000,casterLevel:level,casterElement:"light",target,targetDefense:400,attacker:player});});
        const isolation=[1,100].map(level=>{
            player.level=level;target.level=101-level;
            const hit=calculateHitChancePercent(8,12,5,10,target);
            const evasion=getMonsterEvasion(target);
            const status=calculateStatusEffectChance(40,level,101-level,100,12,false,"regular",3,5);
            const hard=calculateStatusEffectChance(40,level,101-level,100,12,true,"boss",3,5);
            const critical=[];
            for(let roll=0;roll<100;roll++){
                Math.random=function(){return (roll+.5)/100;};
                critical.push(rollCritical(player,"physical",5,target));
            }
            return {hit,evasion,status,hard,critical};
        });
        return {levels,playerDamage,enemyDamage,skillDamage,skillRaw:getSkillRawAttack(skill,1,10000),isolation};
    })()`);
    const defenseFactor=1100/1500;
    for(let index=0;index<report.levels.length;index++){
        const level=report.levels[index];
        const expected=Math.round(10000*defenseFactor*1.2*1.5*Math.pow(1.01,level-70));
        assert.equal(report.playerDamage[index],expected,'player damage at '+level);
        assert.equal(report.enemyDamage[index],expected,'enemy damage at '+level);
        assert.equal(report.skillDamage[index],Math.round(report.skillRaw*defenseFactor*Math.pow(1.01,level-70)),'skill damage at '+level);
    }
    assert.deepEqual(report.isolation[0],report.isolation[1],'Hit/Evasion/Status/Hard Control/Crit do not couple to levels');
});

console.log("\nV170 final integration suite: "+passed+" tests passed.");
