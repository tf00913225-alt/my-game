"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const source=fs.readFileSync("js/gameplay-boss-tower-system.js","utf8");
const accountSource=fs.readFileSync("js/startup/account-save-repository.js","utf8");
const battlefieldSource=fs.readFileSync("js/battlefield-slot-owner.js","utf8");
const TEST_UID="boss-tower-test";
const DUNGEON_RANK_MULTIPLIERS={
    elite:{maxHP:3.2,maxSP:2,defense:1.25},
    boss:{maxHP:4.5,maxSP:2,defense:1.4}
};

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
            triBlast:{id:"triBlast",name:"三才破陣",element:"fire",category:"magic",targetType:"tri",baseDamage:100,spCost:10},
            strike:{id:"strike",name:"破陣斬",element:"fire",category:"physical",targetType:"single",baseDamage:100,spCost:5},
            fireRocket:{element:"fire"},explosiveFlurry:{element:"fire"},dragonSlash:{element:"fire"},rage:{element:"fire"},
            waterKnife:{element:"water"},frostPunch:{element:"water"},floodBeast:{element:"water"},healSpell:{element:"water"},
            stoneSlash:{element:"earth"},flyingSandStrike:{element:"earth"},dustStorm:{element:"earth"},rockWall:{element:"earth"},
            stormFlurry:{element:"wind"},windCrossSlash:{element:"wind"},windHowlLightning:{element:"wind"},dodgeSkill:{element:"wind"}
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
        showSkillNameBadge(){ context.lastSkillBadge=Array.from(arguments); },
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
        v132DungeonRankMultipliers:DUNGEON_RANK_MULTIPLIERS,
        v132BuildDungeonMonster:(name,level,element,rank)=>{
            const multiplier=DUNGEON_RANK_MULTIPLIERS[rank]||{maxHP:1,maxSP:1,defense:1};
            return {
                name,level,element,rank,maxHP:Math.round(1000*multiplier.maxHP),hp:Math.round(1000*multiplier.maxHP),
                maxSP:Math.round(100*multiplier.maxSP),sp:Math.round(100*multiplier.maxSP),defense:Math.round(100*multiplier.defense),
                attack:100,magicAttack:100,alive:true,statusEffects:[],activeBuffs:[]
            };
        },
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
    vm.runInContext(battlefieldSource,context,{filename:"js/battlefield-slot-owner.js"});
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
    assert.deepEqual(value(context,"GameplaySystem.personalBosses.map(item=>({id:item.id,summon:item.summon||null}))"),[
        {id:"personal-20",summon:null},{id:"personal-30",summon:{hpBelow:.5}},{id:"personal-40",summon:null},
        {id:"personal-50",summon:{round:4}},{id:"personal-60",summon:null},{id:"personal-70",summon:{hpBelow:.55}},
        {id:"personal-80",summon:null},{id:"personal-90",summon:{round:4}},{id:"personal-100",summon:{hpBelow:.6}}
    ]);
    assert.deepEqual(value(context,"GameplaySystem.worldStageProfiles.map(item=>item.summon||null)"),[null,null,{hpBelow:.55},{round:4}]);
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

test("Gameplay Bosses are built through the Boss rank defense owner without changing the calibrated HP baseline",()=>{
    const {context}=load();
    const profile=value(context,"GameplaySystem.getBossBalanceProfile(20,'personal',1)");
    const elite=context.v132BuildDungeonMonster("同級精英",20,"fire","elite");
    assert.equal(context.vGameplayStartBoss("personal","personal-20"),true);
    const boss=context.monsters[0];
    assert.equal(boss.rank,"boss");
    assert.ok(boss.defense>elite.defense,"Boss defense must exceed the corresponding elite baseline");
    assert.equal(Number((boss.defense/elite.defense).toFixed(4)),profile.defenseMultiplier);
    assert.ok(Math.abs(boss.maxHP-3200*8.37)<=20,"switching to the Boss rank must preserve the current Lv20 HP calibration");
});

test("selected Bosses summon two same-element elites only after their configured threshold and only once",()=>{
    {
        const {context}=load();
        context.FourSymbolsBattlefieldRenderGeometry={reconcile(){ context.geometryReconciles=(context.geometryReconciles||0)+1; }};
        assert.equal(context.vGameplayStartBoss("personal","personal-30"),true);
        assert.equal(context.geometryReconciles,1,"Boss snapshot must be projected into the live battlefield immediately");
        const boss=context.monsters[0],slotOwner=context.FourSymbolsBattlefieldSlots;
        const openingSnapshot=slotOwner.getActiveEnemySnapshot();
        assert.equal(openingSnapshot.originalFormationType,6,"summoning Boss must reserve a back trio plus an empty front mechanism lane from battle start");
        assert.equal(slotOwner.getEnemySlotForMonster(openingSnapshot,0),"ENEMY_B3");
        assert.equal(slotOwner.getAssignedMonsterAtEnemySlot(openingSnapshot,"ENEMY_B2"),null);
        assert.equal(slotOwner.getAssignedMonsterAtEnemySlot(openingSnapshot,"ENEMY_B4"),null);
        assert.equal(context.monsters.length,1,"reinforcements must not exist in the opening roster");
        boss.hp=Math.round(boss.maxHP*.51);context.turn=2;context.startTurn(context.battleToken);
        assert.equal(context.monsters.length,1,"HP-triggered reinforcements must wait until the configured threshold");
        boss.hp=Math.floor(boss.maxHP*.5);context.turn=3;context.startTurn(context.battleToken);
        assert.equal(context.monsters.length,3);
        const guards=context.monsters.slice(1),summonedSnapshot=slotOwner.getActiveEnemySnapshot();
        assert.equal(slotOwner.getEnemySlotForMonster(summonedSnapshot,0),"ENEMY_B3");
        assert.equal(slotOwner.getEnemySlotForMonster(summonedSnapshot,1),"ENEMY_B2");
        assert.equal(slotOwner.getEnemySlotForMonster(summonedSnapshot,2),"ENEMY_B4");
        assert.deepEqual(Array.from(guards,unit=>unit.vGameplayBattlefieldSlot),["ENEMY_B2","ENEMY_B4"]);
        guards[0].alive=false;guards[0].hp=0;
        assert.equal(slotOwner.getAssignedMonsterAtEnemySlot(summonedSnapshot,"ENEMY_B2"),1,"dead reinforcement keeps its assigned slot");
        assert.equal(slotOwner.getEnemySlotForMonster(summonedSnapshot,0),"ENEMY_B3","Boss must not move after reinforcement death");
        assert.ok(guards.every(unit=>unit.vGameplayBossSummon===true&&unit.rank==="elite"&&unit.element===boss.element));
        assert.equal(new Set(guards.map(unit=>unit.name)).size,2);
        guards.forEach(unit=>[...unit.skillIds,...(unit.v141SupportSkillIds||[])].forEach(skillId=>{
            assert.equal(context.skillDatabase[skillId].element,boss.element);
        }));
        context.turn=4;context.startTurn(context.battleToken);
        assert.equal(context.monsters.length,3,"the same encounter may summon reinforcements only once");
    }
    {
        const {context}=load();
        assert.equal(context.vGameplayStartBoss("personal","personal-50"),true);
        assert.equal(context.monsters.length,1);
        context.turn=3;context.startTurn(context.battleToken);assert.equal(context.monsters.length,1);
        context.turn=4;context.startTurn(context.battleToken);assert.equal(context.monsters.length,3);
    }
    {
        const {context}=load();
        assert.equal(context.vGameplayStartBoss("personal","personal-60"),true);
        context.monsters[0].hp=Math.round(context.monsters[0].maxHP*.1);
        context.turn=10;context.startTurn(context.battleToken);
        assert.equal(context.monsters.length,1,"Bosses without a summon plan must never gain reinforcements");
    }
});

test("world and Tower Boss summon plans retain their stage, HP and round thresholds",()=>{
    {
        const {context}=load();
        const state=value(context,"GameplaySystem.getSerializableState()");
        state.world["world-40"].completedStages=2;
        context.GameplaySystem.debugReloadState(state,Date.now());
        assert.equal(context.vGameplayStartBoss("world","world-40"),true);
        const boss=context.monsters[0];
        assert.equal(context.monsters.length,1);
        boss.hp=Math.round(boss.maxHP*.56);context.turn=2;context.startTurn(context.battleToken);
        assert.equal(context.monsters.length,1);
        boss.hp=Math.floor(boss.maxHP*.55);context.turn=3;context.startTurn(context.battleToken);
        assert.equal(context.monsters.length,3,"world stage 3 must summon at 55% HP");
    }
    {
        const {context}=load();const week=context.GameplaySystem.getWeekInfo(Date.now());
        context.GameplaySystem.debugReloadState({version:1,personal:{},world:{},tower:{weekKey:week.key,element:week.element,completedFloor:49,highestThisWeek:49,claimedFloors:{},historicalHighest:49,pendingRelicChoice:false}},Date.now());
        assert.equal(context.vGameplaySelectTowerBand(50),true);
        const boss=context.monsters[0];
        assert.equal(context.monsters.length,1);
        boss.hp=Math.floor(boss.maxHP*.5);context.turn=2;context.startTurn(context.battleToken);
        assert.equal(context.monsters.length,3,"Tower floor 50 must summon at 50% HP");
    }
    {
        const {context}=load();const week=context.GameplaySystem.getWeekInfo(Date.now());
        context.GameplaySystem.debugReloadState({version:1,personal:{},world:{},tower:{weekKey:week.key,element:week.element,completedFloor:69,highestThisWeek:69,claimedFloors:{},historicalHighest:69,pendingRelicChoice:false}},Date.now());
        assert.equal(context.vGameplaySelectTowerBand(70),true);
        assert.equal(context.monsters.length,1);
        context.turn=3;context.startTurn(context.battleToken);assert.equal(context.monsters.length,1);
        context.turn=4;context.startTurn(context.battleToken);assert.equal(context.monsters.length,3,"Tower floor 70 must summon on round 4");
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
    assert.equal(context.FourSymbolsBattlefieldSlots.getEnemySlotForMonster(
        context.FourSymbolsBattlefieldSlots.getActiveEnemySnapshot(),0
    ),"ENEMY_B3","a mechanism Boss without reinforcements must still leave the enemy front lane clear");
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


test("Mechanisms use stable independent sidecar slots and never join enemy unit geometry",()=>{
    const {context}=load();
    assert.equal(context.vGameplayStartBoss("personal","personal-70"),true);
    const first=context.GameplaySystem.debugSpawnMechanism("shield","slot-test-a");
    const second=context.GameplaySystem.debugSpawnMechanism("charge","slot-test-b");
    assert.ok(first&&second);
    assert.deepEqual([first.battlefieldSlot,second.battlefieldSlot],["MECH_C","MECH_L"]);
    assert.equal(new Set([first.battlefieldSlot,second.battlefieldSlot]).size,2);
    const owner=context.FourSymbolsBattlefieldSlots;
    assert.deepEqual(value(context,"FourSymbolsBattlefieldSlots.mechanismSlots"),["MECH_L","MECH_C","MECH_R"]);
    assert.ok([first.battlefieldSlot,second.battlefieldSlot].every(slot=>!owner.enemySlots.includes(slot)));
    assert.equal(context.currentBattleMonsters.length,1,"mechanism cards must stay outside currentBattleMonsters");
    const snapshot=owner.getActiveEnemySnapshot();
    assert.equal(owner.getEnemySlotForMonster(snapshot,0),"ENEMY_B3");
});

test("AoE destroys the shield without entering normal monster settlement until the next formal action",()=>{
    const {context}=load();
    context.vGameplayStartBoss("personal","personal-20");context.turn=2;context.startTurn(context.battleToken);
    const shield=value(context,"GameplaySystem.getActiveBattleState().mechanisms[0]");
    context.queuedPlayerActions[0]={action:"blast",target:"mechanism:"+shield.id};
    context.battlePhase="resolve";context.resolveQueuedPlayerAction(0,context.battleToken);
    assert.equal(context.coreTargets,undefined,"the function-card action must not enter normal monster settlement");
    assert.equal(value(context,"GameplaySystem.getActiveBattleState().mechanisms.length"),0);
    assert.equal(context.GameplaySystem.canDirectlyAffectMonster(context.monsters[0]),true);
    assert.deepEqual(context.getSkillTargets(0,"all"),[0],"the next action may target the Boss again");
});

test("three-target skills aimed at a mechanism card never damage Boss reinforcements",()=>{
    const {context}=load();
    context.vGameplayStartBoss("personal","personal-30");
    const boss=context.monsters[0];
    boss.hp=Math.floor(boss.maxHP*.5);
    context.turn=3;context.startTurn(context.battleToken);
    assert.equal(context.monsters.length,3);
    const mechanism=value(context,"GameplaySystem.getActiveBattleState().mechanisms[0]");
    assert.ok(mechanism,"the encounter must expose its scheduled mechanism card");
    const hpBefore=context.monsters.map(monster=>monster.hp);
    const spBefore=context.player.sp;
    context.queuedPlayerActions[0]={action:"triBlast",target:"mechanism:"+mechanism.id};
    context.battlePhase="resolve";
    context.resolveQueuedPlayerAction(0,context.battleToken);
    assert.deepEqual(context.monsters.map(monster=>monster.hp),hpBefore,"Boss and both reinforcements must remain untouched");
    assert.equal(context.coreTargets,undefined,"mechanism settlement must not retarget the same skill to living monsters");
    assert.equal(context.player.sp,spBefore-10,"the selected skill cost is paid exactly once");
    assert.deepEqual(
        value(context,"lastSkillBadge.slice(3)"),
        ["mechanism:"+mechanism.id,["mechanism:"+mechanism.id]],
        "the formal VFX gate must keep the mechanism card as its only target"
    );
    assert.equal(context.finished,1,"the isolated mechanism action must finish exactly once");
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

console.log(`All ${passed} Gameplay / BOSS / Tower runtime tests passed.`);
