"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const ownerSource=fs.readFileSync("js/battlefield-slot-owner.js","utf8");
const context=vm.createContext({window:{},console});
context.window.window=context.window;
vm.runInContext(ownerSource,context,{filename:"js/battlefield-slot-owner.js"});

const owner=context.window.FourSymbolsBattlefieldSlots;
assert.ok(owner,"Fixed Slot owner must install");
const plain=value=>JSON.parse(JSON.stringify(value));

const formation=owner.normalizeAllyFormation(null,[0,1,2]);
assert.deepEqual(plain(formation.characterIndexToSlot),{
    0:"ALLY_F1",1:"ALLY_F2",2:"ALLY_F3"
});

for(const primary of [0,1,2]){
    assert.deepEqual(
        plain(owner.resolveAllyTargets(formation,primary,"allyTri",()=>true)),
        [0,1,2],
        `allyTri primary ${primary} must retain the full three-slot row window`
    );
}

assert.deepEqual(
    plain(owner.resolveAllyTargets(formation,0,"allyTri",index=>index!==1)),
    [0,2],
    "dead allies are filtered after the fixed three-slot window is resolved"
);
assert.deepEqual(plain(formation.characterIndexToSlot),{
    0:"ALLY_F1",1:"ALLY_F2",2:"ALLY_F3"
},"alive filtering must not move ally slots");

const splitFormation=owner.normalizeAllyFormation({
    characterIndexToSlot:{0:"ALLY_F1",1:"ALLY_B2",2:"ALLY_F3"}
},[0,1,2]);
assert.deepEqual(
    plain(owner.resolveAllyTargets(splitFormation,0,"allyTri",()=>true)),
    [0,2],
    "allyTri must not cross from the selected front row into the back row"
);

const snapshot=owner.createEnemyFormationSnapshot([0,1,2,3,4],{
    originalFormationType:5,
    rankWeight:()=>1
});

const enemySlotCases=[
    ["ENEMY_F1",["ENEMY_F1","ENEMY_F2","ENEMY_F3"]],
    ["ENEMY_F3",["ENEMY_F2","ENEMY_F3","ENEMY_F4"]],
    ["ENEMY_F5",["ENEMY_F3","ENEMY_F4","ENEMY_F5"]]
];
enemySlotCases.forEach(([primary,expected])=>{
    assert.deepEqual(
        plain(owner.resolveSlotsFromShape("enemy",primary,"tri")),
        expected,
        `${primary} targeting window`
    );
    assert.deepEqual(
        plain(owner.getGeometrySlotsFromShape("enemy",primary,"tri")),
        expected,
        `${primary} geometry window must match targeting`
    );
});

assert.deepEqual(plain(owner.resolveEnemyTargets(snapshot,0,"tri",()=>true)),[0,1,2]);
assert.deepEqual(plain(owner.resolveEnemyTargets(snapshot,2,"tri",()=>true)),[1,2,3]);
assert.deepEqual(plain(owner.resolveEnemyTargets(snapshot,4,"tri",()=>true)),[2,3,4]);
assert.deepEqual(
    plain(owner.resolveEnemyTargets(snapshot,0,"tri",index=>index!==1)),
    [0,2],
    "dead enemies are filtered without recentering the formal tri window"
);
assert.equal(owner.getEnemySlotForMonster(snapshot,0),"ENEMY_F1");
assert.equal(owner.getEnemySlotForMonster(snapshot,1),"ENEMY_F2");
assert.equal(owner.getEnemySlotForMonster(snapshot,2),"ENEMY_F3");
assert.equal(owner.getEnemySlotForMonster(snapshot,3),"ENEMY_F4");
assert.equal(owner.getEnemySlotForMonster(snapshot,4),"ENEMY_F5");

assert.deepEqual(plain(owner.resolveSlotsFromShape("enemy","ENEMY_F3","single")),["ENEMY_F3"]);
assert.deepEqual(plain(owner.resolveSlotsFromShape("enemy","ENEMY_F3","row")),[
    "ENEMY_F1","ENEMY_F2","ENEMY_F3","ENEMY_F4","ENEMY_F5"
]);
assert.deepEqual(plain(owner.resolveSlotsFromShape("enemy","ENEMY_F3","column")),[
    "ENEMY_B3","ENEMY_F3"
]);
assert.deepEqual(plain(owner.resolveSlotsFromShape("enemy","ENEMY_F3","all")),[
    "ENEMY_B1","ENEMY_B2","ENEMY_B3","ENEMY_B4","ENEMY_B5",
    "ENEMY_F1","ENEMY_F2","ENEMY_F3","ENEMY_F4","ENEMY_F5"
]);

console.log("Fixed Slot tri target-window regression passed.");
