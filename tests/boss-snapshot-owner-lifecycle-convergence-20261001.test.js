"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const ownerSource=fs.readFileSync("js/battlefield-slot-owner.js","utf8");
const v131Source=fs.readFileSync("js/25-v131-fix-batch.js","utf8");
const formationSource=v131Source.slice(
    v131Source.indexOf("    function getFormationRankWeight("),
    v131Source.indexOf("    function formatDuration(")
);

function createContext(){
    const context={
        console,
        window:null,
        document:{querySelector(){ return null; }},
        localStorage:{getItem(){ return null; },setItem(){},removeItem(){}},
        monsters:[],
        currentBattleMonsters:[],
        getMonsterRank(monster){ return monster&&monster.rank||"regular"; }
    };
    context.window=context;
    vm.createContext(context);
    vm.runInContext(ownerSource,context,{filename:"js/battlefield-slot-owner.js"});
    vm.runInContext(formationSource,context,{filename:"js/25-v131-fix-batch.js#formation"});
    return context;
}

function assignBossBattle(context){
    const owner=context.FourSymbolsBattlefieldSlots;
    context.monsters=[
        {rank:"boss",alive:true,hp:1000},
        {rank:"elite",alive:true,hp:100},
        {rank:"elite",alive:true,hp:100},
        {rank:"regular",unitKind:"boss-object",alive:true,hp:100},
        {rank:"regular",unitKind:"boss-object",alive:true,hp:100}
    ];
    context.currentBattleMonsters=[0,1,2,3,4];
    const snapshot=owner.createEnemyFormationSnapshot([0],{originalFormationType:6});
    snapshot.bossBattleSnapshot=true;
    owner.assignMonsterToEnemySlot(snapshot,1,"ENEMY_B1");
    owner.assignMonsterToEnemySlot(snapshot,2,"ENEMY_B5");
    owner.assignMonsterToEnemySlot(snapshot,3,"ENEMY_F1");
    owner.assignMonsterToEnemySlot(snapshot,4,"ENEMY_F5");
    owner.setActiveEnemySnapshot(snapshot);
    let active=true;
    context.FourSymbolsBossBattle={
        isActive(){ return active; },
        getEnemyFormationSnapshot(){
            if(owner.getActiveEnemySnapshot()!==snapshot){ owner.setActiveEnemySnapshot(snapshot); }
            return snapshot;
        },
        ownsEnemyFormationSnapshot(candidate){ return candidate===snapshot; }
    };
    return {owner,snapshot,deactivate(){ active=false; }};
}

{
    const context=createContext();
    const {owner,snapshot}=assignBossBattle(context);

    owner.removeMonsterFromEnemySlot(snapshot,3);
    context.monsters[3].alive=false;
    context.monsters[3].hp=0;
    for(let render=0;render<3;render++){
        assert.equal(context.v138EnsureEnemyFormationSnapshot(context.currentBattleMonsters),snapshot);
        assert.equal(owner.getActiveEnemySnapshot(),snapshot);
    }
    assert.equal(owner.getActiveEnemySnapshot(),snapshot,
        "dead F1 roster entry must not trigger normal formation creation");
    assert.equal(owner.getEnemySlotForMonster(snapshot,0),"ENEMY_B3");
    assert.equal(owner.getEnemySlotForMonster(snapshot,1),"ENEMY_B1");
    assert.equal(owner.getEnemySlotForMonster(snapshot,2),"ENEMY_B5");
    assert.equal(owner.getAssignedMonsterAtEnemySlot(snapshot,"ENEMY_F1"),null);
    assert.equal(owner.getEnemySlotForMonster(snapshot,4),"ENEMY_F5");

    owner.removeMonsterFromEnemySlot(snapshot,4);
    context.monsters[4].alive=false;
    context.monsters[4].hp=0;
    owner.removeMonsterFromEnemySlot(snapshot,1);
    context.monsters[1].alive=false;
    context.monsters[1].hp=0;
    for(let render=0;render<3;render++){
        assert.equal(context.v138EnsureEnemyFormationSnapshot(context.currentBattleMonsters),snapshot);
    }
    assert.equal(owner.getActiveEnemySnapshot(),snapshot,
        "dead F5/reinforcement roster entries must not compact survivors");
    assert.equal(owner.getEnemySlotForMonster(snapshot,0),"ENEMY_B3");
    assert.equal(owner.getEnemySlotForMonster(snapshot,2),"ENEMY_B5");
    assert.equal(owner.getAssignedMonsterAtEnemySlot(snapshot,"ENEMY_B1"),null);
    assert.equal(owner.getAssignedMonsterAtEnemySlot(snapshot,"ENEMY_F1"),null);
    assert.equal(owner.getAssignedMonsterAtEnemySlot(snapshot,"ENEMY_F5"),null);
}

for(const count of [1,3,5,6,8,10]){
    const context=createContext();
    context.monsters=Array.from({length:count},()=>({rank:"regular",alive:true,hp:100}));
    context.currentBattleMonsters=Array.from({length:count},(_,index)=>index);
    context.FourSymbolsBossBattle={
        isActive(){ return false; },
        ownsEnemyFormationSnapshot(){ return false; }
    };
    const snapshot=context.v138EnsureEnemyFormationSnapshot(context.currentBattleMonsters);
    assert.ok(snapshot,`normal ${count}-monster battle must still create a formation`);
    assert.equal(Object.keys(snapshot.monsterIndexToSlot).length,count);
    assert.equal(snapshot.originalFormationType,count);
}

console.log("Boss snapshot owner lifecycle convergence regression passed.");
