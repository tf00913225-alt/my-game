"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const towerSource=fs.readFileSync("js/gameplay-boss-tower-system.js","utf8");
const rulesSource=fs.readFileSync("js/40-v144-rules-and-abyss.js","utf8");
const uiSource=fs.readFileSync("js/35-v141-ui-battle.js","utf8");
const slotSource=fs.readFileSync("js/battlefield-slot-owner.js","utf8");
const accountSource=fs.readFileSync("js/startup/account-save-repository.js","utf8");
const registry=JSON.parse(fs.readFileSync("config/monster-portrait-registry.json","utf8"));
const contracts=fs.readFileSync("SYSTEM_CONTRACTS.md","utf8");

function sourceFunction(source,name){
    const start=source.indexOf("    function "+name+"(");
    assert.notEqual(start,-1,"missing function "+name);
    const brace=source.indexOf("{",start);
    let depth=0;
    for(let i=brace;i<source.length;i++){
        if(source[i]==="{"){ depth++; }
        else if(source[i]==="}"){
            depth--;
            if(depth===0){ return source.slice(start,i+1); }
        }
    }
    throw new Error("unterminated function "+name);
}

function makeSkills(){
    return {
        fireRocket:{id:"fireRocket",name:"火箭",element:"fire",category:"magic",tier:1,maxLevel:5,spCost:10},
        explosiveFlurry:{id:"explosiveFlurry",name:"火爆亂擊",element:"fire",category:"physical",tier:2,maxLevel:5,spCost:10},
        dragonSlash:{id:"dragonSlash",name:"霸龍裂天斬",element:"fire",category:"physical",tier:4,maxLevel:5,spCost:10},
        rage:{id:"rage",name:"怒火",element:"fire",category:"buff",maxLevel:5,spCost:10},
        waterKnife:{id:"waterKnife",name:"水刃",element:"water",category:"physical",tier:1,maxLevel:5,spCost:10},
        frostPunch:{id:"frostPunch",name:"寒拳",element:"water",category:"physical",tier:2,maxLevel:5,spCost:10},
        floodBeast:{id:"floodBeast",name:"洪水猛獸",element:"water",category:"magic",tier:3,maxLevel:5,spCost:10},
        healSpell:{id:"healSpell",name:"治療術",element:"water",category:"heal",maxLevel:5,spCost:10,targetType:"allyTri"},
        stoneSlash:{id:"stoneSlash",name:"岩斬",element:"earth",category:"physical",tier:1,maxLevel:5,spCost:10},
        flyingSandStrike:{id:"flyingSandStrike",name:"飛沙瞬擊",element:"earth",category:"magic",tier:3,maxLevel:5,spCost:10},
        dustStorm:{id:"dustStorm",name:"沙塵暴",element:"earth",category:"magic",tier:4,maxLevel:5,spCost:10},
        rockWall:{id:"rockWall",name:"岩石壁壘",element:"earth",category:"buff",maxLevel:5,spCost:10,targetType:"allyTri"},
        stormFlurry:{id:"stormFlurry",name:"風連擊",element:"wind",category:"physical",tier:1,maxLevel:5,spCost:10},
        windCrossSlash:{id:"windCrossSlash",name:"風旋十字斬",element:"wind",category:"physical",tier:2,maxLevel:5,spCost:10},
        windHowlLightning:{id:"windHowlLightning",name:"風哮電擊",element:"wind",category:"magic",tier:3,maxLevel:5,spCost:10},
        dodgeSkill:{id:"dodgeSkill",name:"閃躲術",element:"wind",category:"buff",maxLevel:5,spCost:10,targetType:"allyTri"},
        phoenixCry:{id:"phoenixCry",name:"火鳳天鳴",element:"fire",category:"magic",tier:4,maxLevel:5,spCost:10},
        iceArrowRain:{id:"iceArrowRain",name:"冰霜箭雨",element:"water",category:"magic",tier:3,maxLevel:5,spCost:10},
        yuanZuBlessing:{id:"yuanZuBlessing",name:"元祖賜福",element:"light",category:"buff",maxLevel:5,spCost:10}
    };
}

function storage(){
    const values=new Map();
    return {
        getItem:key=>values.has(String(key))?values.get(String(key)):null,
        setItem:(key,value)=>values.set(String(key),String(value)),
        removeItem:key=>values.delete(String(key))
    };
}

function load(){
    const localStorage=storage();
    const noop=()=>{};
    const document={
        readyState:"complete",getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[],
        createElement:()=>({classList:{add:noop,remove:noop,toggle:noop},dataset:{},setAttribute:noop,appendChild:noop}),
        addEventListener:noop
    };
    let context;
    context={
        window:null,globalThis:null,console,JSON,Math:Object.create(Math),Date,Number,String,Boolean,Object,Array,Set,Map,Promise,RegExp,Error,TypeError,
        parseInt,parseFloat,isNaN,localStorage,document,setTimeout:fn=>{ if(fn){ fn(); }return 1; },clearTimeout:noop,
        requestAnimationFrame:fn=>{ if(fn){ fn(); }return 1; },
        player:{id:"塔測試者",element:"fire",level:100,hp:10000,sp:2000,activeBuffs:[],statusEffects:[]},
        player2:null,player3:null,gold:0,sharedExp:0,monsters:[],currentBattleMonsters:[],
        battleActive:false,battlePhase:"declare",battleToken:1,turn:1,actionReady:false,pendingAction:null,
        skillDatabase:makeSkills(),potionDefinitions:[],
        getExistingPartyIndexes:()=>[0],
        getPartyCharacterByIndex:index=>index===0?context.player:null,
        getPartyBattleStats:()=>({maxHP:10000,maxSP:2000,attack:1000,magicAttack:1000,defense:100,accuracy:100,intelligence:100}),
        getMonsterSkillTierAndChance:()=>({maxTier:4,chance:.5}),
        getMonsterRank:monster=>monster&&monster.rank||"regular",
        getItemCounts:()=>new Map(),
        v141RollWildMonsterRanks:()=>{},decorateBattleCards:()=>{},
        showPage:()=>{},saveGame:()=>{},rebuildInventorySlots:noop,updateGoldDisplay:noop,
        addBattleLog:()=>{},updateUI:noop,startTurn:noop,closeMenus:noop,clearBattleTargetSelectionMode:noop,
        v133GetHighestCreatedCharacterLevel:()=>100,
        v132DungeonRankMultipliers:{elite:{maxHP:3.2,maxSP:2,defense:1.25},boss:{maxHP:4.5,maxSP:2,defense:1.4}},
        v132BuildDungeonMonster:(name,level,element,rank)=>{
            const mult=context.v132DungeonRankMultipliers[rank]||{maxHP:1,maxSP:1,defense:1};
            return {
                name,level,element,rank:rank||"regular",alive:true,
                maxHP:Math.round(1000*mult.maxHP),hp:Math.round(1000*mult.maxHP),
                maxSP:Math.round(100*mult.maxSP),sp:Math.round(100*mult.maxSP),
                defense:Math.round(100*mult.defense),attack:100,magicAttack:100,agility:100,evasion:0,
                activeBuffs:[],statusEffects:[],skillIds:[]
            };
        },
        v132AddItemToInventory:()=>true,v132GetOreDefinition:id=>({id,name:id}),
        v141ShowBlackGoldReward:noop,v174RelicDevUnlock:()=>true
    };
    context.window=context;context.globalThis=context;
    context.v132LaunchDungeonBattle=function(roster,onComplete,options){
        const opts=options&&typeof options==="object"?options:{};
        context.v132ActiveDungeonRun={identityVersion:1,mode:String(opts.mode||"legacy-dungeon"),gameplayMode:opts.gameplayMode||null};
        context.monsters=roster;
        context.currentBattleMonsters=roster.map((_,index)=>index);
        context.battleActive=true;
        context.battleToken++;
        context.lastBattleCallback=onComplete;
        context.lastBattleOptions=opts;
        if(typeof context.v141PrepareBattleRender==="function"){ context.v141PrepareBattleRender(); }
        if(typeof context.v144ConfigureDungeonBattleSkillsAfterRender==="function"){ context.v144ConfigureDungeonBattleSkillsAfterRender(); }
        return true;
    };

    vm.createContext(context);
    vm.runInContext(accountSource,context,{filename:"account-save-repository.js"});
    context.FourSymbolsAccountSave.activate("tower-element-owner-test");
    vm.runInContext(slotSource,context,{filename:"battlefield-slot-owner.js"});
    vm.runInContext([
        "let lastWildRankToken=null;",
        "let battleSnapshot=null;",
        sourceFunction(uiSource,"v141PrepareBattleRender"),
        "window.v141PrepareBattleRender=v141PrepareBattleRender;"
    ].join("\n"),context,{filename:"v141-prepare-slice.js"});
    vm.runInContext(rulesSource,context,{filename:"v144-rules.js"});
    vm.runInContext(towerSource,context,{filename:"gameplay-boss-tower-system.js"});
    return context;
}

function towerDateFor(context,element){
    for(let offset=0;offset<56;offset++){
        const date=new Date(Date.UTC(2026,0,5+offset*7));
        const info=context.GameplaySystem.getWeekInfo(date);
        if(info.element===element){ return {date,info}; }
    }
    throw new Error("no date found for "+element);
}

function setTowerProgress(context,element,completedFloor){
    const found=towerDateFor(context,element);
    context.GameplaySystem.debugReloadState({
        tower:{
            weekKey:found.info.key,element,completedFloor,
            highestThisWeek:completedFloor,historicalHighest:completedFloor,claimedFloors:{},pendingRelicChoice:false
        }
    },found.date);
}

function rankWeight(monster){ return monster.rank==="boss"?3:monster.rank==="elite"?2:1; }
function assertLegalSkills(context,monster){
    for(const id of [...(monster.skillIds||[]),...(monster.v141SupportSkillIds||[])]){
        assert.equal(context.v144IsMonsterSkillElementLegal(monster,id),true,monster.name+" illegal skill "+id);
    }
}

for(const element of ["fire","water","earth","wind"]){
    const context=load();
    setTowerProgress(context,element,0);
    assert.equal(context.vGameplaySelectTowerBand(1),true);
    assert.equal(context.lastBattleOptions.mode,"tower");
    assert.equal(context.v132ActiveDungeonRun.mode,"tower");
    assert.equal(context.currentBattleMonsters.length,6);
    const roster=context.currentBattleMonsters.map(index=>context.monsters[index]);
    roster.forEach(monster=>{
        assert.equal(monster.vGameplayTower,true);
        assert.equal(monster.element,element);
        assert.equal(monster.v132FixedSkillLoadout,true);
        assertLegalSkills(context,monster);
    });
    const slots=context.FourSymbolsBattlefieldSlots;
    const snapshot=slots.createEnemyFormationSnapshot(context.currentBattleMonsters,{
        originalFormationType:6,rankWeight:index=>rankWeight(context.monsters[index])
    });
    slots.setActiveEnemySnapshot(snapshot);
    assert.deepEqual(Array.from(Object.values(snapshot.monsterIndexToSlot)).sort(),[
        "ENEMY_B2","ENEMY_B3","ENEMY_B4","ENEMY_F2","ENEMY_F3","ENEMY_F4"
    ]);
    assert.equal(slots.resolveEnemyTargets(snapshot,0,"all",()=>true).length,6);
}

{
    const context=load();
    setTowerProgress(context,"wind",4);
    assert.equal(context.vGameplaySelectTowerBand(5),true);
    assert.equal(context.currentBattleMonsters.length,10);
    const slots=context.FourSymbolsBattlefieldSlots;
    const snapshot=slots.createEnemyFormationSnapshot(context.currentBattleMonsters,{
        originalFormationType:10,rankWeight:index=>rankWeight(context.monsters[index])
    });
    const center=slots.getAssignedMonsterAtEnemySlot(snapshot,"ENEMY_B3");
    assert.equal(context.monsters[center].rank,"elite");
}

{
    const context=load();
    setTowerProgress(context,"fire",9);
    assert.equal(context.vGameplaySelectTowerBand(10),true);
    assert.equal(context.currentBattleMonsters.length,10);
    const roster=context.currentBattleMonsters.map(index=>context.monsters[index]);
    assert.ok(roster.every(monster=>monster.element==="fire"));
    roster.forEach(monster=>assertLegalSkills(context,monster));
    const bossIndex=context.currentBattleMonsters.find(index=>context.monsters[index].vGameplayTowerBoss===true);
    assert.equal(Number.isInteger(bossIndex),true);
    const boss=context.monsters[bossIndex];
    assert.equal(boss.rank,"boss");
    assert.equal(boss.unitKind,"tower-boss");
    assert.equal(boss.portraitKey,"tower-boss.fire.envoy");
    assert.equal(boss.vGameplayPortraitSizeClass,"standard");
    assert.notEqual(boss.vGameplayBoss,true);
    assert.equal(context.FourSymbolsBossBattle.isActive(),false);
    assert.equal(context.FourSymbolsBossBattle.getBossIndex(),null);

    const slots=context.FourSymbolsBattlefieldSlots;
    const snapshot=slots.createEnemyFormationSnapshot(context.currentBattleMonsters,{
        originalFormationType:10,rankWeight:index=>rankWeight(context.monsters[index])
    });
    slots.setActiveEnemySnapshot(snapshot);
    assert.equal(slots.getEnemySlotForMonster(snapshot,bossIndex),"ENEMY_B3");
    const before=JSON.stringify(snapshot.monsterIndexToSlot);
    assert.deepEqual(Array.from(slots.resolveEnemyTargets(snapshot,bossIndex,"single",()=>true)),[bossIndex]);
    assert.equal(slots.resolveEnemyTargets(snapshot,bossIndex,"tri",()=>true).length,3);
    assert.equal(slots.resolveEnemyTargets(snapshot,bossIndex,"row",()=>true).length,5);
    assert.equal(slots.resolveEnemyTargets(snapshot,bossIndex,"column",()=>true).length,2);
    assert.equal(slots.resolveEnemyTargets(snapshot,bossIndex,"all",()=>true).length,10);
    boss.alive=false;boss.hp=0;
    slots.resolveEnemyTargets(snapshot,bossIndex,"all",index=>context.monsters[index].alive!==false&&context.monsters[index].hp>0);
    assert.equal(JSON.stringify(snapshot.monsterIndexToSlot),before);
}

{
    const context=load();
    assert.equal(context.vGameplayStartBoss("personal","personal-30"),true);
    assert.equal(context.lastBattleOptions.mode,"boss");
    assert.equal(context.lastBattleOptions.gameplayMode,"personal");
    assert.equal(context.FourSymbolsBossBattle.isActive(),true);
    assert.equal(context.FourSymbolsBossBattle.getBossIndex(),0);
    assert.deepEqual(Array.from(context.FourSymbolsBossBattle.getBossFootprintSlots()),[
        "ENEMY_B2","ENEMY_B3","ENEMY_B4","ENEMY_F2","ENEMY_F3","ENEMY_F4"
    ]);
}

const towerRows=registry.groups["tower-boss"];
assert.equal(towerRows.length,8);
towerRows.forEach(row=>{ assert.equal(row[3],"boss");assert.equal(row[4],"standard"); });
registry.groups["boss-personal"].forEach(row=>assert.equal(row[4],"boss"));
registry.groups["boss-world"].forEach(row=>assert.equal(row[4],"boss"));
assert.match(contracts,/Tower Boss portrait `sizeClass="standard"`/);
assert.doesNotMatch(uiSource,/rebalanceDungeonElements/);
assert.doesNotMatch(towerSource,/towerObjectPlan|towerSummonPlan/);

console.log("Tower Element Owner, 6/10 formation, Small Boss and skill-element guard integration passed.");
