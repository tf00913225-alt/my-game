"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const read=path=>fs.readFileSync(path,"utf8");
const main=read("js/00-main.js");
const support=read("js/42-v148-combat-dungeon-fixes.js");
const enemySupport=read("js/36-v141-content-systems.js");
const vfx=read("js/39-v143-skill-animation.js");
const progression=read("js/60-v173.64-skill-progression-rebalance.js");
const v141=read("js/34-v141-core-systems.js");
const v144=read("js/40-v144-rules-and-abyss.js");
const v155=read("js/46-v155-dev-fixes.js");
const skillCss=read("css/36-v135-fixes.css");
const combatCss=read("css/40-v143-combat-dungeon-polish.css");
const contracts=read("SYSTEM_CONTRACTS.md");

function sourceBetween(source,startToken,endToken){
    const start=source.indexOf(startToken);
    const end=source.indexOf(endToken,start+startToken.length);
    assert.notEqual(start,-1,"missing start token: "+startToken);
    assert.notEqual(end,-1,"missing end token: "+endToken);
    return source.slice(start,end);
}

test("battle quickbar validates its canonical inner structure and projects formal text",()=>{
    assert.match(main,/function isCanonicalSkillQuickBarButton\(button\)/);
    assert.match(main,/buttons\.every\(isCanonicalSkillQuickBarButton\)/);
    assert.match(main,/class="sq-description"/);
    assert.match(main,/FourSymbolsSkillSpec/);
    assert.match(main,/formalSpec\.targetLabel/);
    assert.match(main,/formalSpec\.effectText/);
    assert.match(skillCss,/\.skill-quick-button \.sq-description\{/);
    assert.match(contracts,/Battle Quick Bar[\s\S]*canonical structure/);
});

test("one target resolver owns both directions and Stealth only blocks hostile primary selection",()=>{
    const slice=sourceBetween(
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
        getEffectiveSkillTargetType:(skill)=>skill&&skill.targetType||"single",
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

    assert.deepEqual(
        Array.from(owner.resolveTargets("monster",0,"tri",{hostilePrimary:true})),
        [0,1,2],
        "stealthed enemy is still collateral from a legal tri primary"
    );
    assert.deepEqual(
        Array.from(owner.resolveTargets("player",0,"tri",{hostilePrimary:true})),
        [0,1,2],
        "stealthed ally is still collateral from a legal enemy tri primary"
    );
    assert.deepEqual(Array.from(owner.resolveTargets("monster",null,"all",{hostilePrimary:true})),[0,1,2]);
    assert.deepEqual(Array.from(owner.resolveTargets("player",null,"all",{hostilePrimary:true})),[0,1,2]);

    assert.match(support,/FourSymbolsBattleSkillTargeting/);
    assert.match(enemySupport,/FourSymbolsBattleSkillTargeting/);
    assert.match(contracts,/同一 Skill ID[\s\S]*禁止.*第二份目標人數/);
});

test("core duration lifecycle consumes existing timed effects once per formal action",()=>{
    const slice=sourceBetween(
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
    assert.equal(actor.activeBuffs.find(x=>x.type==="dodgeSkill").turnsLeft,3,"newly-created buff keeps the casting action");
    assert.equal(actor.activeBuffs.find(x=>x.type==="bloodBurn").turnsLeft,3,"charge-owned Blood Burn is not action-duration ticked");
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

test("late duration owners and round-start decrements in the repaired paths are retired",()=>{
    assert.doesNotMatch(progression,/FourSymbolsDurationLifecycle=Object\.freeze/);
    assert.doesNotMatch(progression,/captureActionDurationEntries|restoreActionDurationEntries|previousStartTurnForDuration/);
    assert.doesNotMatch(v141,/lastShieldTickKey/);
    assert.doesNotMatch(enemySupport,/lastAbyssBuffTick/);
    assert.doesNotMatch(v144,/v144AbyssBuffTick/);
    assert.doesNotMatch(v155,/tickV155TimedStates|previousStartTurn=startTurn[\s\S]{0,100}?tickV155TimedStates/);
    assert.match(main,/finishPlayerAction\(\)[\s\S]*?interceptBattleActionFinish\(\)[\s\S]*?finishBattleDurationAction\(\)/);
});

test("Stealth presentation dims only artwork to 35 percent and clears with state sync",()=>{
    assert.match(vfx,/classList\.toggle\("v143-unit-stealthed",stealthActive\)/);
    assert.match(vfx,/querySelectorAll\("\.v143-unit-stealthed"\)[\s\S]*?classList\.remove\("v143-unit-stealthed"\)/);
    assert.match(combatCss,/\.battle-player\.v143-unit-stealthed > \.v174-battle-art[\s\S]*?opacity:\.35 !important/);
    assert.match(combatCss,/\.battle-monster\.v143-unit-stealthed > \.v174-battle-art[\s\S]*?opacity:\.35 !important/);
    assert.match(contracts,/combatant artwork[\s\S]*opacity: 0\.35/);
});
