import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source=fs.readFileSync(new URL("../js/battlefield-slot-owner.js",import.meta.url),"utf8");
const context={window:{}};
vm.createContext(context);
vm.runInContext(source,context,{filename:"battlefield-slot-owner.js"});
const slots=context.window.FourSymbolsBattlefieldSlots;
assert.ok(slots,"fixed battlefield slot owner should install");

// Values returned from the VM belong to a different JavaScript realm.
// Normalize them to plain JSON data before structural comparisons so Node 24
// does not reject identical arrays only because their prototypes differ.
const plain=value=>JSON.parse(JSON.stringify(value));
const strictDeepEqual=assert.deepEqual.bind(assert);
assert.deepEqual=(actual,expected,message)=>strictDeepEqual(plain(actual),plain(expected),message);

const expectedLayouts={
    3:[["ENEMY_F2","ENEMY_F3","ENEMY_F4"]],
    5:[["ENEMY_F1","ENEMY_F2","ENEMY_F3","ENEMY_F4","ENEMY_F5"]],
    6:[["ENEMY_B2","ENEMY_B3","ENEMY_B4"],["ENEMY_F2","ENEMY_F3","ENEMY_F4"]],
    8:[["ENEMY_B2","ENEMY_B3","ENEMY_B4"],["ENEMY_F1","ENEMY_F2","ENEMY_F3","ENEMY_F4","ENEMY_F5"]],
    10:[["ENEMY_B1","ENEMY_B2","ENEMY_B3","ENEMY_B4","ENEMY_B5"],["ENEMY_F1","ENEMY_F2","ENEMY_F3","ENEMY_F4","ENEMY_F5"]]
};
Object.entries(expectedLayouts).forEach(([count,expected])=>{
    assert.deepEqual(slots.getEnemyFormationSlotRows(Number(count)),expected,`${count}-unit slot layout`);
});

const expectedPriority={
    3:["ENEMY_F3","ENEMY_F4","ENEMY_F2"],
    5:["ENEMY_F4","ENEMY_F2","ENEMY_F5","ENEMY_F3","ENEMY_F1"],
    6:["ENEMY_B3","ENEMY_F3","ENEMY_B4","ENEMY_B2","ENEMY_F4","ENEMY_F2"],
    8:["ENEMY_B3","ENEMY_F4","ENEMY_F2","ENEMY_B4","ENEMY_B2","ENEMY_F5","ENEMY_F3","ENEMY_F1"],
    10:["ENEMY_B4","ENEMY_B2","ENEMY_F4","ENEMY_F2","ENEMY_B5","ENEMY_B3","ENEMY_B1","ENEMY_F5","ENEMY_F3","ENEMY_F1"]
};
Object.entries(expectedPriority).forEach(([count,expected])=>{
    assert.deepEqual(slots.getPrioritySlotsForFormation(Number(count)),expected,`${count}-unit target priority`);
});

const snapshot10=slots.createEnemyFormationSnapshot([0,1,2,3,4,5,6,7,8,9]);
assert.equal(snapshot10.originalFormationType,10,"original formation type is captured once");
assert.equal(slots.getEnemySlotForMonster(snapshot10,6),"ENEMY_F2","G starts in ENEMY_F2");
assert.equal(slots.getEnemySlotForMonster(snapshot10,8),"ENEMY_F4","I starts in ENEMY_F4");

const alive=new Set([0,8,9]);
const isAlive=index=>alive.has(index);
assert.equal(slots.getActiveMonsterAtEnemySlot(snapshot10,"ENEMY_F2",isAlive),null,"dead G leaves its slot empty");
assert.equal(slots.getAssignedMonsterAtEnemySlot(snapshot10,"ENEMY_F2"),6,"dead unit keeps immutable slot assignment for snapshot truth");
assert.equal(slots.getEnemySlotForMonster(snapshot10,8),"ENEMY_F4","surviving I does not compact into G slot");
assert.equal(snapshot10.originalFormationType,10,"death does not switch formation type");
assert.deepEqual(slots.getPriorityMonsterIndexes(snapshot10,isAlive),[8,0,9],"10-unit priority remains active after seven deaths");

const bossSnapshot=slots.createEnemyFormationSnapshot([20],{originalFormationType:3});
assert.equal(slots.getEnemySlotForMonster(bossSnapshot,20),"ENEMY_F3","summoning boss reserves three-unit formation and starts centered");
assert.equal(slots.assignMonsterToPreferredEnemySlot(bossSnapshot,21,["ENEMY_F2","ENEMY_F4"]),"ENEMY_F2");
assert.equal(slots.assignMonsterToPreferredEnemySlot(bossSnapshot,22,["ENEMY_F4","ENEMY_F2"]),"ENEMY_F4");
assert.equal(slots.getEnemySlotForMonster(bossSnapshot,20),"ENEMY_F3","boss remains centered after reinforcements fill reserved slots");

const ranked=slots.createEnemyFormationSnapshot([30,31,32,33,34],{
    rankWeight:index=>index===34?3:1
});
assert.equal(slots.getEnemySlotForMonster(ranked,34),"ENEMY_F3","optional initial rank placement may retain boss-to-center behavior");

const mappingCases={
    3:{slots:["ENEMY_F2","ENEMY_F3","ENEMY_F4"],priority:[1,2,0]},
    5:{slots:["ENEMY_F1","ENEMY_F2","ENEMY_F3","ENEMY_F4","ENEMY_F5"],priority:[3,1,4,2,0]},
    6:{slots:["ENEMY_B2","ENEMY_B3","ENEMY_B4","ENEMY_F2","ENEMY_F3","ENEMY_F4"],priority:[1,4,2,0,5,3]},
    8:{slots:["ENEMY_B2","ENEMY_B3","ENEMY_B4","ENEMY_F1","ENEMY_F2","ENEMY_F3","ENEMY_F4","ENEMY_F5"],priority:[1,6,4,2,0,7,5,3]},
    10:{slots:["ENEMY_B1","ENEMY_B2","ENEMY_B3","ENEMY_B4","ENEMY_B5","ENEMY_F1","ENEMY_F2","ENEMY_F3","ENEMY_F4","ENEMY_F5"],priority:[3,1,8,6,4,2,0,9,7,5]}
};
Object.entries(mappingCases).forEach(([count,expected])=>{
    const indexes=Array.from({length:Number(count)},(_,index)=>index);
    const snapshot=slots.createEnemyFormationSnapshot(indexes,{rankWeight:()=>1});
    assert.deepEqual(indexes.map(index=>slots.getEnemySlotForMonster(snapshot,index)),expected.slots,`${count}-unit natural mapping`);
    assert.deepEqual(slots.getPriorityMonsterIndexes(snapshot,()=>true),expected.priority,`${count}-unit unit priority`);
});

const triSnapshot=slots.createEnemyFormationSnapshot([0,1,2,3,4]);
const triAlive=new Set([0,2,3,4]);
assert.deepEqual(slots.resolveEnemyTargets(triSnapshot,2,"tri",index=>triAlive.has(index)),[2,3],"tri leaves dead left neighbour empty instead of filling from farther slots");
assert.deepEqual(slots.resolveEnemyTargets(triSnapshot,2,"row",index=>triAlive.has(index)),[0,2,3,4],"row stays on the physical row and skips only empty/dead slots");
const columnSnapshot=slots.createEnemyFormationSnapshot([0,1,2,3,4,5,6,7,8,9]);
assert.deepEqual(slots.resolveEnemyTargets(columnSnapshot,7,"column",()=>true),[2,7],"column resolves the same physical column across enemy back/front rows");
assert.equal(slots.resolveEnemyTargets(columnSnapshot,7,"all",()=>true).length,10,"all includes only ten enemy unit slots");

const retargetSnapshot=slots.createEnemyFormationSnapshot([0,1,2,3,4]);
const retargetAlive=new Set([0,1,2,3,4]);
const next=()=>slots.getNextEnemyPrimaryTarget(retargetSnapshot,index=>retargetAlive.has(index));
assert.equal(next(),3,"5-unit first actual action targets D");
retargetAlive.delete(3);
assert.equal(next(),1,"after D dies the next actual action retargets B");
retargetAlive.delete(1);
assert.equal(next(),4,"after B dies the following actual action retargets E");

console.log("fixed battlefield slot model: PASS");
