"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const source=fs.readFileSync("js/gameplay-boss-tower-system.js","utf8");
const accountSource=fs.readFileSync("js/startup/account-save-repository.js","utf8");
const TEST_UID="boss-tower-test";

function storage(seed){
    const values=new Map(Object.entries(seed||{}).map(([key,value])=>[key,String(value)]));
    return {
        getItem:key=>values.has(String(key))?values.get(String(key)):null,
        setItem:(key,value)=>values.set(String(key),String(value)),
        removeItem:key=>values.delete(String(key)),
        snapshot:()=>Object.fromEntries(values)
    };
}

function load(options={}){
    const localStorage=storage(options.storage);
    const noop=()=>{};
    const document={
        readyState:"complete",
        getElementById:()=>null,
        querySelector:()=>null,
        querySelectorAll:()=>[],
        createElement:()=>({classList:{add:noop,remove:noop,toggle:noop},dataset:{},setAttribute:noop,appendChild:noop}),
        addEventListener:noop
    };
    let context;
    context={
        console,JSON,Math:Object.create(Math),Date,Number,String,Boolean,Object,Array,Set,Map,Promise,RegExp,Error,TypeError,
        parseInt,parseFloat,isNaN,localStorage,document,setTimeout:fn=>{ if(fn){ fn(); }return 1; },clearTimeout:noop,
        player:{id:"玩法測試者",element:"fire",level:options.level||100,hp:10000,sp:2000,activeBuffs:[],statusEffects:[]},
        player2:null,player3:null,gold:0,sharedExp:0,monsters:[],currentBattleMonsters:[],
        battleActive:false,battlePhase:"declare",battleToken:1,turn:1,actionReady:false,pendingAction:null,
        activeBattleCharacterIndex:0,queuedPlayerActions:{},autoBattle:true,
        skillDatabase:{
            blast:{id:"blast",name:"全域破陣",element:"fire",category:"magic",targetType:"all",baseDamage:100,spCost:10},
            strike:{id:"strike",name:"破陣斬",element:"fire",category:"physical",targetType:"single",baseDamage:100,spCost:5},
            fireRocket:{id:"fireRocket",element:"fire",category:"magic"},
            explosiveFlurry:{id:"explosiveFlurry",element:"fire",category:"physical"},
            dragonSlash:{id:"dragonSlash",element:"fire",category:"physical"},
            rage:{id:"rage",element:"fire",category:"buff"},
            stoneSlash:{id:"stoneSlash",element:"earth",category:"physical"},
            flyingSandStrike:{id:"flyingSandStrike",element:"earth",category:"magic"},
            dustStorm:{id:"dustStorm",element:"earth",category:"magic"},
            rockWall:{id:"rockWall",element:"earth",category:"buff"},
            waterKnife:{id:"waterKnife",element:"water",category:"physical"},
            frostPunch:{id:"frostPunch",element:"water",category:"physical"},
            floodBeast:{id:"floodBeast",element:"water",category:"magic"},
            healSpell:{id:"healSpell",element:"water",category:"heal"},
            stormFlurry:{id:"stormFlurry",element:"wind",category:"physical"},
            windCrossSlash:{id:"windCrossSlash",element:"wind",category:"physical"},
            windHowlLightning:{id:"windHowlLightning",element:"wind",category:"magic"},
            dodgeSkill:{id:"dodgeSkill",element:"wind",category:"buff"}
        },
        getExistingPartyIndexes:()=>[0],
        getPartyCharacterByIndex:index=>index===0?context.player:null,
        getPartyBattleStats:()=>({maxHP:10000,maxSP:2000,attack:100000,magicAttack:100000,defense:100,accuracy:100,intelligence:100}),
        getPartyCharacterKey:()=>"fire",
        getSkillLevel:()=>1,
        getMonsterEvasion:()=>0,
        getMonsterEffectiveAntiCrit:()=>0,
        rollCritical:()=>({isCrit:false,multiplier:1}),
        calculateSkillDamage:options=>Math.max(1,Math.round(options.effectiveAttack)),
        calculateDamage:attack=>Math.max(1,Math.round(Number(attack)||1)),
        getSkillTargets:(center,targetType)=>targetType==="all"||targetType==="tri"||targetType==="row"?[0]:[center],
        finishPlayerAction:()=>{ context.finished=(context.finished||0)+1; },
        updateUI:noop,startTurn:noop,setBattleTargetSelectionMode:noop,clearBattleTargetSelectionMode:noop,
        selectBattleTarget:()=>{ context.numericSelections=(context.numericSelections||0)+1; },
        resolveQueuedPlayerAction:index=>{
            const queued=context.queuedPlayerActions[index];
            context.coreTargets=context.getSkillTargets(Number(queued.target)||0,context.skillDatabase[queued.action]?.targetType||"single");
        },
        getPartyAutoConfig:()=>({enabled:true,skill:"blast"}),
        autoActionForCharacter:()=>{ context.baseAutoCalled=(context.baseAutoCalled||0)+1; },
        castHealSkill:()=>{ context.player.hp=Math.min(10000,context.player.hp+1000);context.player.sp=Math.min(2000,context.player.sp+100); },
        renderBattle:undefined,showPage:noop,saveGame:()=>{
            const current=context.FourSymbolsAccountSave.readForUid(TEST_UID);
            const previous=current.status==="ready"?current.save:{};
            if(context.GameplaySystem){ previous.gameplayProgress=context.GameplaySystem.getSerializableState(); }
            previous.player={id:context.player.id,level:context.player.level};
            context.FourSymbolsAccountSave.writeForUid(TEST_UID,previous,{source:"test"});
        },
        rebuildInventorySlots:noop,updateGoldDisplay:noop,addBattleLog:message=>{ (context.logs||(context.logs=[])).push(message); },
        showPlayerHit:noop,checkBattleEnd:()=>false,
        v133GetHighestCreatedCharacterLevel:()=>options.level||100,
        v132BuildDungeonMonster:(name,level,element,rank)=>({
            name,level,element,rank,maxHP:1000,hp:1000,maxSP:100,sp:100,defense:100,
            attack:100,magicAttack:100,alive:true,statusEffects:[],activeBuffs:[]
        }),
        v132AddItemToInventory:()=>true,v132GetOreDefinition:id=>({id,name:id}),
        v141ShowBlackGoldReward:noop,
        v174RelicDevUnlock:id=>{ (context.relicUnlocks||(context.relicUnlocks=[])).push(id);return true; }
    };
    context.v132LaunchDungeonBattle=(roster,onComplete)=>{
        context.monsters=roster;context.currentBattleMonsters=roster.map((_,index)=>index);
        context.battleActive=true;context.lastBattleCallback=onComplete;return true;
    };
    context.window=context;context.globalThis=context;
    vm.createContext(context);
    vm.runInContext(accountSource,context,{filename:"js/startup/account-save-repository.js"});
    context.FourSymbolsAccountSave.activate(TEST_UID);
    vm.runInContext(source,context,{filename:"js/gameplay-boss-tower-system.js"});
    return {context,localStorage};
}

function value(context,expression){ return JSON.parse(vm.runInContext("JSON.stringify("+expression+")",context)); }
function finishBattle(context,result){ const callback=context.lastBattleCallback;context.battleActive=false;callback({result}); }

let passed=0;
function test(name,fn){ fn();passed++;console.log("✓ "+name); }

test("central definitions own nine fixed personal bosses, four permanent world bosses and five mechanism types",()=>{
    const {context}=load();
    assert.equal(context.GameplaySystem.personalBosses.length,9);
    assert.deepEqual(value(context,"GameplaySystem.personalBosses.map(item=>item.level)"),[20,30,40,50,60,70,80,90,100]);
    assert.deepEqual(value(context,"GameplaySystem.personalBosses.map(item=>item.phases)"),[1,1,2,2,3,3,3,4,4]);
    assert.equal(context.GameplaySystem.worldBosses.length,4);
    assert.deepEqual(Object.keys(value(context,"GameplaySystem.mechanisms")).sort(),["amplify","charge","heal","seal","shield"]);
    assert.deepEqual(value(context,"GameplaySystem.towerConfig.elementOrder"),["fire","earth","water","wind"]);
});

test("Tower owner produces 100 floors with elite, boss and milestone cadence",()=>{
    const {context}=load();
    const kind=floor=>context.GameplaySystem.getTowerFloorKind(floor);
    assert.equal(kind(1),"普通層");assert.equal(kind(5),"精英層");assert.equal(kind(10),"守關 BOSS");
    assert.match(kind(25),/大型里程碑/);assert.match(kind(50),/大型里程碑/);
    assert.match(kind(75),/大型里程碑/);assert.match(kind(100),/最終 BOSS/);
    assert.equal(context.GameplaySystem.towerConfig.floorCount,100);
    for(let floor=1;floor<=100;floor++){
        if(floor%10===0){ assert.match(kind(floor),/BOSS/); }
        else if(floor%5===0){ assert.match(kind(floor),/精英/); }
        else{ assert.equal(kind(floor),"普通層"); }
    }
});

test("weekly UTC owner resets only weekly Tower fields and preserves history",()=>{
    const {context}=load();
    const week=value(context,"GameplaySystem.getWeekInfo(Date.UTC(2026,8,7))");
    const old={version:1,personal:{},world:{},tower:{weekKey:week.key,element:week.element,completedFloor:37,highestThisWeek:37,claimedFloors:{"1":true,"37":true},historicalHighest:64}};
    const same=JSON.parse(JSON.stringify(context.GameplaySystem.normalizeState(old,Date.UTC(2026,8,9))));
    assert.deepEqual([same.tower.completedFloor,same.tower.highestThisWeek,same.tower.historicalHighest],[37,37,64]);
    const next=JSON.parse(JSON.stringify(context.GameplaySystem.normalizeState(old,Date.UTC(2026,8,14))));
    assert.deepEqual([next.tower.completedFloor,next.tower.highestThisWeek,next.tower.historicalHighest],[0,0,64]);
    assert.deepEqual(next.tower.claimedFloors,{});
    assert.notEqual(next.tower.element,week.element);
});

test("blocking shield is outside the monster roster and blocks single, tri and all target resolution",()=>{
    const {context}=load();
    assert.equal(context.vGameplayStartBoss("personal","personal-20"),true);
    context.monsters[0].statusEffects.push({type:"burn",turnsLeft:2});
    context.turn=2;context.startTurn(context.battleToken);
    const battle=value(context,"GameplaySystem.getActiveBattleState()");
    assert.equal(battle.mechanisms.length,1);assert.equal(battle.mechanisms[0].type,"shield");
    assert.equal(context.currentBattleMonsters.length,1,"mechanism card must not consume a normal formation slot");
    assert.equal(context.GameplaySystem.canDirectlyAffectMonster(context.monsters[0]),false);
    assert.deepEqual(context.getSkillTargets(0,"single"),[]);
    assert.deepEqual(context.getSkillTargets(0,"tri"),[]);
    assert.deepEqual(context.getSkillTargets(0,"all"),[]);
    context.selectBattleTarget(0);
    assert.equal(context.numericSelections||0,0);
    assert.match(context.logs.join("\n"),/護盾尚未破除/);
    assert.deepEqual(context.monsters[0].statusEffects,[{type:"burn",turnsLeft:2}],"pre-existing DOT must remain intact");
    context.getSkillTargets(0,"all").forEach(index=>context.monsters[index].statusEffects.push({type:"freeze",turnsLeft:1}));
    assert.equal(context.monsters[0].statusEffects.some(effect=>effect.type==="freeze"),false,"a new AoE status must not bypass the shield");
});

test("multi-phase personal bosses change action loadout at HP thresholds",()=>{
    const {context}=load();
    context.vGameplayStartBoss("personal","personal-40");
    assert.deepEqual(value(context,"GameplaySystem.getActiveBattleState()"),{
        mode:"personal",definitionId:"personal-40",stage:1,floor:null,combatPhase:1,totalPhases:2,mechanisms:[]
    });
    context.monsters[0].hp=Math.floor(context.monsters[0].maxHP*.49);
    context.turn=2;context.startTurn(context.battleToken);
    assert.equal(value(context,"GameplaySystem.getActiveBattleState().combatPhase"),2);
    assert.match(context.logs.join("\n"),/進入第二階段/);
    assert.ok(context.monsters[0].skillIds.length>=2,"later phase must change the Boss action loadout");
});

test("AoE destroys the shield but cannot retarget the Boss until the next formal action",()=>{
    const {context}=load();
    context.vGameplayStartBoss("personal","personal-20");context.turn=2;context.startTurn(context.battleToken);
    const shield=value(context,"GameplaySystem.getActiveBattleState().mechanisms[0]");
    context.queuedPlayerActions[0]={action:"blast",target:"mechanism:"+shield.id};
    context.battlePhase="resolve";context.resolveQueuedPlayerAction(0,context.battleToken);
    assert.deepEqual(context.coreTargets,[],"same AoE action must retain its shield snapshot after breaking the card");
    assert.equal(value(context,"GameplaySystem.getActiveBattleState().mechanisms.length"),0);
    assert.equal(context.GameplaySystem.canDirectlyAffectMonster(context.monsters[0]),true);
    assert.deepEqual(context.getSkillTargets(0,"all"),[0],"the next action may target the Boss again");
});

test("auto battle prioritizes a blocking mechanism card instead of selecting the protected Boss",()=>{
    const {context}=load();
    context.vGameplayStartBoss("personal","personal-20");context.turn=2;context.startTurn(context.battleToken);
    context.autoActionForCharacter(0,context.battleToken);
    assert.match(context.queuedPlayerActions[0].target,/^mechanism:/);
    assert.equal(context.baseAutoCalled||0,0);
});

test("auto battle uses the formal mechanism priority after the shield tier",()=>{
    const {context}=load();
    context.vGameplayStartBoss("personal","personal-70");context.turn=2;context.startTurn(context.battleToken);
    const charge=context.GameplaySystem.debugSpawnMechanism("charge","priority-test");
    const active=value(context,"GameplaySystem.getActiveBattleState().mechanisms");
    assert.deepEqual(active.map(card=>card.type).sort(),["charge","heal"]);
    context.autoActionForCharacter(0,context.battleToken);
    assert.equal(context.queuedPlayerActions[0].target,"mechanism:"+charge.id,"charge must outrank healing when no shield exists");
});

test("charge cancels when destroyed, heal restores Boss, amplify raises damage and seal reduces healing",()=>{
    {
        const {context}=load();context.vGameplayStartBoss("personal","personal-30");context.turn=2;context.startTurn(context.battleToken);
        context.turn=3;context.startTurn(context.battleToken);
        const charge=value(context,"GameplaySystem.getActiveBattleState().mechanisms[0]");assert.equal(charge.countdown,1);
        context.queuedPlayerActions[0]={action:"strike",target:"mechanism:"+charge.id};context.resolveQueuedPlayerAction(0,context.battleToken);
        const hp=context.player.hp;context.turn=4;context.startTurn(context.battleToken);assert.equal(context.player.hp,hp,"destroyed charge must not fire");
    }
    {
        const {context}=load();context.vGameplayStartBoss("personal","personal-40");context.turn=2;context.startTurn(context.battleToken);
        context.monsters[0].hp-=1000;const before=context.monsters[0].hp;context.turn=3;context.startTurn(context.battleToken);assert.ok(context.monsters[0].hp>before);
    }
    {
        const {context}=load();context.vGameplayStartBoss("personal","personal-70");context.turn=2;context.startTurn(context.battleToken);context.turn=5;context.startTurn(context.battleToken);
        assert.equal(context.calculateDamage(100,0,1,1,"fire","fire",{attacker:context.monsters[0]}),125);
    }
    {
        const {context}=load();context.vGameplayStartBoss("personal","personal-90");context.turn=2;context.startTurn(context.battleToken);
        context.player.hp=5000;context.player.sp=1000;context.castHealSkill("heal",0);
        assert.deepEqual([context.player.hp,context.player.sp],[5600,1060]);
    }
});

test("world stage completion survives reload, defeat never erases it and special first clear grants once",()=>{
    const first=load();const context=first.context;
    context.vGameplayStartBoss("world","world-40");finishBattle(context,"win");
    assert.equal(value(context,"GameplaySystem.getSerializableState().world['world-40'].completedStages"),1);
    const reloaded=load({storage:first.localStorage.snapshot()});
    assert.equal(value(reloaded.context,"GameplaySystem.getSerializableState().world['world-40'].completedStages"),1);
    reloaded.context.vGameplayStartBoss("world","world-40");finishBattle(reloaded.context,"lose");
    assert.equal(value(reloaded.context,"GameplaySystem.getSerializableState().world['world-40'].completedStages"),1);
    for(let stage=2;stage<=4;stage++){ reloaded.context.vGameplayStartBoss("world","world-40");finishBattle(reloaded.context,"win"); }
    const complete=value(reloaded.context,"GameplaySystem.getSerializableState().world['world-40']");
    assert.deepEqual([complete.completedStages,complete.firstClear,complete.clears],[4,true,1]);
    assert.equal(reloaded.context.gold,6000);
    reloaded.context.vGameplayStartBoss("world","world-40");finishBattle(reloaded.context,"win");
    assert.equal(reloaded.context.gold,6700,"replay must receive only the normal repeat reward");
    assert.equal(reloaded.context.relicUnlocks.length,1,"special relic must not duplicate");
});

test("personal first-clear reward survives reload and repeat challenge excludes it",()=>{
    const first=load();first.context.vGameplayStartBoss("personal","personal-20");finishBattle(first.context,"win");
    assert.equal(first.context.gold,1200);
    const reloaded=load({storage:first.localStorage.snapshot()});
    assert.equal(value(reloaded.context,"GameplaySystem.getSerializableState().personal['personal-20'].firstClear"),true);
    reloaded.context.vGameplayStartBoss("personal","personal-20");finishBattle(reloaded.context,"win");
    assert.equal(reloaded.context.gold,260,"repeat challenge must receive only its normal reward");
});

test("Tower floor 37 and its claimed reward survive reload; replay does not grant it twice",()=>{
    const first=load();
    const week=first.context.GameplaySystem.getWeekInfo(Date.now());
    const raw={version:1,personal:{},world:{},tower:{weekKey:week.key,element:week.element,completedFloor:37,highestThisWeek:37,claimedFloors:{"37":true},historicalHighest:37,pendingRelicChoice:false}};
    first.context.GameplaySystem.debugReloadState(raw,Date.now());first.context.saveGame();
    const second=load({storage:first.localStorage.snapshot()});
    assert.equal(value(second.context,"GameplaySystem.getSerializableState().tower.completedFloor"),37);
    const before=second.context.gold;
    assert.equal(second.context.vGameplaySelectTowerBand(37),true);finishBattle(second.context,"win");
    assert.equal(second.context.gold,before,"same weekly floor reward must not repeat");
    assert.equal(value(second.context,"GameplaySystem.getSerializableState().tower.completedFloor"),37);
});

test("Tower floor 50 grants one weekly choice and replay cannot recreate it",()=>{
    const first=load();const week=first.context.GameplaySystem.getWeekInfo(Date.now());
    first.context.GameplaySystem.debugReloadState({version:1,personal:{},world:{},tower:{weekKey:week.key,element:week.element,completedFloor:49,highestThisWeek:49,claimedFloors:{},historicalHighest:49,pendingRelicChoice:false}},Date.now());
    assert.equal(first.context.vGameplaySelectTowerBand(50),true);finishBattle(first.context,"win");
    assert.equal(value(first.context,"GameplaySystem.getSerializableState().tower.pendingRelicChoice"),true);
    assert.equal(first.context.vGameplayChooseTowerRelic("relic_qinglan_feather"),true);
    assert.deepEqual(first.context.relicUnlocks,["relic_qinglan_feather"]);
    const goldAfterFirst=first.context.gold;
    assert.equal(first.context.vGameplaySelectTowerBand(50),true);finishBattle(first.context,"win");
    assert.equal(first.context.gold,goldAfterFirst);
    assert.equal(value(first.context,"GameplaySystem.getSerializableState().tower.pendingRelicChoice"),false);
});


test("Boss balance is calibrated to same-level two-character early teams and three-character late teams",()=>{
    const {context}=load();
    const personal=value(context,"GameplaySystem.personalBosses");
    const world=value(context,"GameplaySystem.worldBosses");
    assert.deepEqual(personal.slice(0,4).map(item=>item.recommendedParty),[2,2,2,2]);
    assert.ok(personal.slice(4).every(item=>item.recommendedParty===3));
    assert.equal(world[0].recommendedParty,2);
    assert.ok(world.slice(1).every(item=>item.recommendedParty===3));
    assert.ok(personal.every(item=>item.hpMultiplier>=7.2&&item.defenseMultiplier>=1.28));
    assert.ok(world.every(item=>item.hpMultiplier>=10&&item.defenseMultiplier>=1.5));
    const names=[...personal,...world].map(item=>item.name);
    assert.equal(new Set(names).size,names.length,"all fixed Boss names must be distinct");
    assert.ok(names.every(name=>name.includes("・")&&!/天兵天將|野怪|精英/.test(name)),"Boss names must stay visually distinct from generic monster naming");
    assert.equal(context.vGameplayStartBoss("personal","personal-20"),true);
    assert.equal(context.monsters[0].maxHP,7200);
    assert.equal(context.monsters[0].attack,122);
    assert.equal(context.monsters[0].defense,128);
});

test("every Boss action loadout is filtered to the Boss element",()=>{
    for(const type of ["personal","world"]){
        const probe=load();
        const ids=value(probe.context,type==="personal"?"GameplaySystem.personalBosses.map(item=>item.id)":"GameplaySystem.worldBosses.map(item=>item.id)");
        for(const id of ids){
            const {context}=load();
            assert.equal(context.vGameplayStartBoss(type,id),true);
            const boss=context.monsters[0];
            for(const skillId of [...boss.skillIds,...(boss.v141SupportSkillIds||[])]){
                assert.equal(context.skillDatabase[skillId].element,boss.element,id+" contains cross-element skill "+skillId);
            }
        }
    }
    const {context}=load();
    const towerBoss=context.GameplaySystem.buildTowerRoster(100)[0];
    for(const skillId of [...towerBoss.skillIds,...(towerBoss.v141SupportSkillIds||[])]){
        assert.equal(context.skillDatabase[skillId].element,towerBoss.element);
    }
});

test("mechanism cards have meaningful durability instead of one-token HP",()=>{
    const {context}=load();
    context.vGameplayStartBoss("personal","personal-20");
    context.turn=2;context.startTurn(context.battleToken);
    const boss=context.monsters[0];
    const shield=value(context,"GameplaySystem.getActiveBattleState().mechanisms[0]");
    assert.equal(shield.type,"shield");
    assert.ok(shield.maxHP>=Math.round(boss.maxHP*.31));
    assert.ok(shield.defense>=Math.round(boss.defense*.9));
});

test("selected Boss encounters summon two real same-element elite reinforcements",()=>{
    const {context}=load();
    context.vGameplayStartBoss("personal","personal-30");
    const boss=context.monsters[0];
    boss.hp=Math.floor(boss.maxHP*.49);
    context.turn=2;context.startTurn(context.battleToken);
    assert.equal(context.monsters.length,3);
    assert.deepEqual(value(context,"currentBattleMonsters"),[0,1,2]);
    const guards=context.monsters.slice(1);
    assert.ok(guards.every(unit=>unit.vGameplayBossSummon===true&&unit.rank==="elite"&&unit.element===boss.element));
    assert.equal(new Set(guards.map(unit=>unit.name)).size,2);
    guards.forEach(unit=>[...unit.skillIds,...(unit.v141SupportSkillIds||[])].forEach(skillId=>{
        assert.equal(context.skillDatabase[skillId].element,boss.element);
    }));
});

console.log(`All ${passed} Gameplay / BOSS / Tower runtime tests passed.`);
