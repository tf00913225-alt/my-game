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

assert.deepEqual(slots.bossFootprintSlots,["ENEMY_B2","ENEMY_B3","ENEMY_B4","ENEMY_F2","ENEMY_F3","ENEMY_F4"],"Boss visual footprint owns the central six enemy slots");
assert.ok(slots.bossFootprintSlots.every(slot=>slots.enemySlots.includes(slot)),"Boss footprint is geometry, not a parallel target realm");
assert.equal(Object.prototype.hasOwnProperty.call(slots,"mechanismSlots"),false,"retired function-card slots are absent");

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

const bossSnapshot=slots.createEnemyFormationSnapshot([20],{originalFormationType:6});
assert.equal(slots.getEnemySlotForMonster(bossSnapshot,20),"ENEMY_B3","Boss identity stays centered while its artwork spans six slots");
assert.equal(slots.assignMonsterToPreferredEnemySlot(bossSnapshot,21,["ENEMY_B1","ENEMY_B5"]),"ENEMY_B1");
assert.equal(slots.assignMonsterToPreferredEnemySlot(bossSnapshot,22,["ENEMY_B5","ENEMY_B1"]),"ENEMY_B5");
assert.equal(slots.assignMonsterToPreferredEnemySlot(bossSnapshot,23,["ENEMY_F1","ENEMY_F5"]),"ENEMY_F1");
assert.equal(slots.assignMonsterToPreferredEnemySlot(bossSnapshot,24,["ENEMY_F5","ENEMY_F1"]),"ENEMY_F5");

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

// V1 ordinary profiles share the existing owner, but never truncate legacy encounters.
for(const mode of ['wild','daily','abyss','tower']){
 for(let count=1;count<=10;count++){
  const indexes=Array.from({length:count},(_,i)=>i);
  const snapshot=slots.createEnemyFormationSnapshot(indexes,{encounterMode:mode});
  assert.equal(snapshot.battlefieldProfile,count<=6?'standard-six':'legacy-ten');
  assert.equal(snapshot.migrationStatus,count<=6?'six-slot-ready':'pending-wave-migration');
  assert.equal(Object.keys(snapshot.monsterIndexToSlot).length,count);
  assert.equal(new Set(Object.values(snapshot.monsterIndexToSlot)).size,count);
  assert.equal(slots.getEnemyRenderSlotRows(snapshot).flat().length,count<=6?6:10);
 }
}
const six=slots.createEnemyFormationSnapshot([0,1,2,3,4,5],{encounterMode:'daily'});
slots.setActiveEnemySnapshot(six);
assert.deepEqual(Object.values(six.monsterIndexToSlot),['ENEMY_B1','ENEMY_B2','ENEMY_B3','ENEMY_F1','ENEMY_F2','ENEMY_F3']);
assert.deepEqual(slots.getSideSlots('monster'),slots.standardEnemySlots);
assert.deepEqual(slots.getGeometrySlotsFromShape('monster','ENEMY_F1','tri'),['ENEMY_F1','ENEMY_F2','ENEMY_F3']);
assert.deepEqual(slots.resolveEnemyTargets(six,1,'single',()=>true),[1]);
assert.deepEqual(slots.resolveEnemyTargets(six,1,'tri',()=>true),[0,1,2]);
assert.deepEqual(slots.resolveEnemyTargets(six,1,'column',()=>true),[1,4]);
assert.deepEqual(slots.resolveEnemyTargets(six,1,'all',()=>true),[0,1,2,3,4,5]);
const beforeSix=JSON.stringify(six);
assert.deepEqual(slots.resolveEnemyTargets(six,1,'all',i=>i!==2),[0,1,3,4,5]);
assert.equal(slots.getEnemySlotForMonster(six,5),'ENEMY_F3');
assert.equal(JSON.stringify(six),beforeSix,'death/target filtering never rearranges slots');
assert.equal(slots.assignMonsterToEnemySlot(six,6,'ENEMY_F4'),false,'six profile refuses seventh-slot assignment');
slots.removeMonsterFromEnemySlot(six,2);
assert.deepEqual(slots.resolveEnemyTargets(six,1,'row',()=>true),[0,1],'empty slots cannot be targets');
assert.equal(slots.getEnemySlotForMonster(six,5),'ENEMY_F3');
assert.equal(slots.assignMonsterToEnemySlot(six,7,'ENEMY_F3'),false,'occupied slot refuses second entity');
assert.throws(()=>slots.createEnemyFormationSnapshot([0,0],{encounterMode:'wild'}),/Duplicate/);
assert.throws(()=>slots.createEnemyFormationSnapshot(Array.from({length:11},(_,i)=>i),{encounterMode:'tower'}),/capacity/);
for(const mode of ['boss','personal','world','adventure','legacy-dungeon']){
 const special=slots.createEnemyFormationSnapshot([0,1,2],{encounterMode:mode});
 assert.equal(special.battlefieldProfile,'legacy-ten');
 assert.equal(special.migrationStatus,'special-or-legacy');
}
slots.setActiveEnemySnapshot(bossSnapshot);
assert.equal(slots.getSideSlots('monster').length,10,'Boss retains ten-slot geometry');
slots.clearActiveEnemySnapshot();
context.window.v132ActiveDungeonRun={mode:'tower'};
assert.equal(slots.getCurrentEncounterMode(),'tower');
context.window.v132ActiveDungeonRun=null;
assert.equal(slots.getCurrentEncounterMode(),'wild');
const launch=fs.readFileSync(new URL('../js/27-v132-content-expansion.js',import.meta.url),'utf8');
assert.match(launch,/currentBattleMonsters=monsterList.map[\s\S]*?clearActiveEnemySnapshot\(\);[\s\S]*?renderBattle\(\)/,'new dungeon roster resets reused numeric identities before first render');
console.log('ordinary six-slot / legacy overflow / Boss profile regressions: PASS');

const main=fs.readFileSync(new URL('../js/00-main.js',import.meta.url),'utf8');
const initiative=main.match(/^function buildInitiativeQueue\([\s\S]*?^\}/m)[0];
const actionContext={currentBattleMonsters:[0,1,2,3,4,5],monsters:Array.from({length:6},(_,i)=>({alive:true,hp:100,agility:10+i})),getExistingPartyIndexes:()=>[0,1,2,3,4,5],getPartyCharacterByIndex:()=>({hp:100}),getPartyBattleStats:()=>({agility:5}),getMonsterAgility:m=>m.agility};
vm.createContext(actionContext);vm.runInContext(initiative,actionContext);
const queue=actionContext.buildInitiativeQueue();
assert.deepEqual(queue.filter(e=>e.type==='monster').map(e=>e.monsterIndex).sort(),[0,1,2,3,4,5],'all six enemies enter the formal action queue exactly once');
assert.equal(queue.filter(e=>e.type==='player').length,6,'all six allies retain their actions');
actionContext.monsters[2].alive=false;
assert.equal(actionContext.buildInitiativeQueue().filter(e=>e.type==='monster').length,5,'death removes action without compacting entity indexes');
console.log('six enemy / six ally core initiative queue: PASS');

const end=main.match(/^function checkBattleEnd\([\s\S]*?^\}/m)[0];
let winCount=0,deathCount=0;
actionContext.battleActive=true;
actionContext.battleAdvanceScheduled=false;
actionContext.battleTerminalPresentationToken=null;
actionContext.battleToken=7;
actionContext.killMonster=i=>{actionContext.monsters[i].alive=false;deathCount++;};
actionContext.winBattle=()=>{winCount++;actionContext.battleActive=false;};
actionContext.loseBattle=()=>{throw new Error('living party cannot lose');};
// This fixture is a one-wave battle; use the same core optional-wave guard.
actionContext.battleWaveState=null;
actionContext.battleEscapePendingToken=null;
vm.runInContext(main.match(/^function isBattleEscapePending\([^\n]+/m)[0],actionContext);
vm.runInContext(main.match(/^function requestBattleWaveTransition\([\s\S]*?^\}/m)[0],actionContext);
vm.runInContext(end,actionContext);
assert.equal(actionContext.checkBattleEnd(),false,'surviving sixth enemy prevents early victory');
actionContext.monsters.forEach(m=>{m.hp=0;});
assert.equal(actionContext.checkBattleEnd(),true);
assert.equal(deathCount,5,'each remaining live entity enters canonical death exactly once');
assert.equal(winCount,1);
actionContext.checkBattleEnd();assert.equal(winCount,1,'terminal recheck cannot repeat victory settlement');
console.log('six-slot death / victory / once-only terminal boundary: PASS');
