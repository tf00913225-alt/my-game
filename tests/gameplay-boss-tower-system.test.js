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

test("definitions expose Boss objects instead of a parallel function-card system",()=>{
    const {context}=load();
    assert.equal(context.GameplaySystem.personalBosses.length,9);
    assert.equal(context.GameplaySystem.worldBosses.length,4);
    assert.deepEqual(Object.keys(value(context,"GameplaySystem.objects")).sort(),["amplify","charge","defense","heal","seal","shield"]);
    assert.equal(context.FourSymbolsBattlefieldSlots.mechanismSlots,undefined);
    assert.deepEqual(value(context,"FourSymbolsBattlefieldSlots.bossFootprintSlots"),[
        "ENEMY_B2","ENEMY_B3","ENEMY_B4","ENEMY_F2","ENEMY_F3","ENEMY_F4"
    ]);
});

test("Boss is one entity with one target identity and isolated target settlement",()=>{
    const {context}=load();
    assert.equal(context.vGameplayStartBoss("personal","personal-20"),true);
    assert.equal(context.currentBattleMonsters.length,1);
    assert.equal(context.FourSymbolsBossBattle.getBossIndex(),0);
    for(const type of ["single","tri","row","column"]){
        assert.deepEqual(value(context,'FourSymbolsBossBattle.resolveEnemyDamageTargets(0,"'+type+'")'),[0]);
    }
    assert.deepEqual(value(context,'FourSymbolsBossBattle.resolveEnemyDamageTargets(0,"all")'),[0]);
    const snapshot=context.FourSymbolsBattlefieldSlots.getActiveEnemySnapshot();
    assert.equal(context.FourSymbolsBattlefieldSlots.getEnemySlotForMonster(snapshot,0),"ENEMY_B3");
});

test("reinforcements occupy B1/B5 and retain normal action capability",()=>{
    const {context}=load();
    context.vGameplayStartBoss("personal","personal-30");
    const boss=context.monsters[0];
    boss.hp=Math.floor(boss.maxHP*.5);
    context.turn=3;
    context.FourSymbolsBossBattle.processRound();
    const guards=context.monsters.filter(unit=>unit.unitKind==="boss-reinforcement");
    assert.equal(guards.length,2);
    assert.deepEqual(
        JSON.parse(JSON.stringify(guards.map(unit=>unit.vGameplayBattlefieldSlot))),
        ["ENEMY_B1","ENEMY_B5"]
    );
    assert.ok(guards.every(unit=>unit.canAct===true&&unit.rank==="elite"));
});

test("World Boss uses the live Fixed Slot snapshot when stage-three reinforcements arrive",()=>{
    const {context}=load();
    context.GameplaySystem.debugReloadState({
        world:{"world-40":{completedStages:2,firstClear:false,clears:0}}
    });
    assert.equal(context.vGameplayStartBoss("world","world-40"),true);
    const boss=context.monsters[0];
    const slots=context.FourSymbolsBattlefieldSlots;

    /* A legacy render may replace the active snapshot after the Boss context
       was seeded. Summons must write to that live geometry owner. */
    slots.setActiveEnemySnapshot(slots.createEnemyFormationSnapshot([0],{originalFormationType:3}));
    boss.hp=Math.floor(boss.maxHP*.5);
    context.turn=3;
    context.FourSymbolsBossBattle.processRound();

    const guards=context.monsters.filter(unit=>unit.unitKind==="boss-reinforcement");
    assert.equal(context.GameplaySystem.getActiveBattleState().mode,"world");
    assert.deepEqual(
        JSON.parse(JSON.stringify(guards.map(unit=>unit.vGameplayBattlefieldSlot))),
        ["ENEMY_B1","ENEMY_B5"]
    );
    assert.deepEqual(
        JSON.parse(JSON.stringify(guards.map(unit=>slots.getEnemySlotForMonster(slots.getActiveEnemySnapshot(),context.monsters.indexOf(unit))))),
        ["ENEMY_B1","ENEMY_B5"]
    );
});

test("totems and flags are normal numeric target entities at F1/F5 but never act or reward",()=>{
    const {context}=load();
    context.vGameplayStartBoss("personal","personal-70");
    const heal=context.GameplaySystem.debugSpawnBossObject("heal","test-heal");
    const flag=context.GameplaySystem.debugSpawnBossObject("amplify","test-flag");
    assert.ok(heal&&flag);
    assert.deepEqual([heal.vGameplayBattlefieldSlot,flag.vGameplayBattlefieldSlot],["ENEMY_F1","ENEMY_F5"]);
    assert.ok([heal,flag].every(unit=>unit.unitKind==="boss-object"&&unit.canAct===false&&unit.noRewards===true));
    assert.ok(context.currentBattleMonsters.every(Number.isInteger));
    const healIndex=context.monsters.indexOf(heal);
    assert.deepEqual(value(context,'FourSymbolsBossBattle.resolveEnemyDamageTargets('+healIndex+',"tri")'),[healIndex]);
    assert.deepEqual(
        JSON.parse(JSON.stringify(
            value(context,'FourSymbolsBossBattle.resolveEnemyDamageTargets('+healIndex+',"all")').sort((a,b)=>a-b)
        )),
        JSON.parse(JSON.stringify(context.currentBattleMonsters.slice().sort((a,b)=>a-b)))
    );
});

test("Boss Shield absorbs first and only overflow reaches HP",()=>{
    const {context}=load();
    context.vGameplayStartBoss("personal","personal-30");
    const boss=context.monsters[0];
    const before=boss.hp;
    assert.equal(context.FourSymbolsBossBattle.applyShield(3000),3000);
    boss.hp=before-5000;
    assert.equal(boss.hp,before-2000);
    assert.equal(context.FourSymbolsBossBattle.getShieldState(),null);
    const settlement=context.FourSymbolsBossBattle.consumeDamageSettlement(0);
    assert.deepEqual(JSON.parse(JSON.stringify(settlement)),{
        requested:5000,reduced:0,shieldAbsorbed:3000,hpDamage:2000
    });
});

test("Boss Shield keeps HP state correct through shield-only, overflow and heal",()=>{
    const {context}=load();
    context.vGameplayStartBoss("personal","personal-30");
    const boss=context.monsters[0];
    const full=boss.hp;
    assert.equal(context.FourSymbolsBossBattle.applyShield(10000),10000);
    boss.hp=full-5000;
    assert.equal(boss.hp,full,"shield-only damage must not reduce Boss HP");
    assert.equal(context.FourSymbolsBossBattle.getShieldState().current,5000);
    boss.hp=full-11000;
    assert.equal(boss.hp,full-6000,"overflow must reduce Boss HP after the shield is exhausted");
    assert.equal(context.FourSymbolsBossBattle.getShieldState(),null);
    boss.hp=Math.min(boss.maxHP,boss.hp+3000);
    assert.equal(boss.hp,full-3000,"Boss heal must retain the formal HP value after shield settlement");
});

test("Boss HUD renders the white shield inside its formal HP bar",()=>{
    const {context}=load();
    context.vGameplayStartBoss("personal","personal-30");
    const boss=context.monsters[0];
    const hpInner={className:"monster-hp-inner",style:{}};
    const hpLabel={className:"monster-bar-text",style:{},textContent:""};
    const hpBar={
        children:[hpInner,hpLabel],
        querySelector(selector){
            const className=selector.match(/\.([\w-]+)$/)?.[1];
            return this.children.find(node=>node.className===className)||null;
        },
        insertBefore(node,before){
            const index=before?this.children.indexOf(before):-1;
            if(index>=0){ this.children.splice(index,0,node); }
            else{ this.children.push(node); }
        }
    };
    const card={
        querySelector(selector){ return selector.includes(".monster-hp")?hpBar:null; },
        querySelectorAll(){ return []; }
    };
    context.document.getElementById=id=>id==="battleMonster0"?card:null;
    context.document.createElement=()=>({className:"",style:{}});

    context.FourSymbolsBossBattle.applyShield(10000);
    const overlay=hpBar.children.find(node=>node.className==="boss-hp-shield-overlay");
    assert.ok(overlay,"shield overlay must be a monster-hp child");
    const fullHpPercent=boss.maxHP/(boss.maxHP+10000)*100;
    const fullShieldPercent=10000/(boss.maxHP+10000)*100;
    assert.equal(hpInner.style.width,fullHpPercent+"%","full HP and shield use the formal shared proportion");
    assert.equal(overlay.style.left,fullHpPercent+"%");
    assert.equal(overlay.style.width,fullShieldPercent+"%");
    assert.equal(hpLabel.textContent,boss.hp+" / "+boss.maxHP);

    boss.hp=boss.hp-5000;
    assert.equal(overlay.style.width,5000/(boss.maxHP+5000)*100+"%","half shield remaining shrinks the white segment immediately");
    boss.hp=boss.hp-5000;
    assert.equal(overlay.style.width,"0%","shield zero removes the white segment without a second HUD");
});

test("a destroyed healing object stops its persistent effect immediately",()=>{
    const {context}=load();
    context.vGameplayStartBoss("personal","personal-30");
    const boss=context.monsters[0];
    const totem=context.GameplaySystem.debugSpawnBossObject("heal","test-heal");
    boss.hp-=2000;
    const wounded=boss.hp;
    context.turn=2;
    context.GameplaySystem.debugProcessBossRound();
    assert.ok(boss.hp>wounded);
    totem.alive=false;
    totem.hp=0;
    boss.hp-=1000;
    const afterSecondHit=boss.hp;
    context.turn=3;
    context.GameplaySystem.debugProcessBossRound();
    assert.equal(boss.hp,afterSecondHit);
});

test("weekly and reward state remains persistent",()=>{
    const first=load();
    first.context.vGameplayStartBoss("personal","personal-20");
    finishBattle(first.context,"win");
    assert.equal(first.context.gold,1200);
    const second=load({storage:first.localStorage.snapshot()});
    assert.equal(value(second.context,"GameplaySystem.getSerializableState().personal['personal-20'].firstClear"),true);
});

console.log("All "+passed+" Boss target-entity runtime tests passed.");
