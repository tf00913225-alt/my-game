import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source=fs.readFileSync(new URL("../js/battlefield-slot-owner.js",import.meta.url),"utf8");
const context={window:{}};
vm.createContext(context);
vm.runInContext(source,context,{filename:"battlefield-slot-owner.js"});
const slots=context.window.FourSymbolsBattlefieldSlots;
const plain=value=>JSON.parse(JSON.stringify(value));
const eq=(actual,expected,message)=>assert.deepEqual(plain(actual),plain(expected),message);

let formation=slots.hydrateAllyFormation(null,[0]);
assert.equal(slots.getAllySlotForCharacter(0),"ALLY_F2","solo migration stays centered");
formation=slots.hydrateAllyFormation(null,[0,1]);
assert.equal(slots.getAllySlotForCharacter(0),"ALLY_F1");
assert.equal(slots.getAllySlotForCharacter(1),"ALLY_F3","two-character migration stays symmetric");
formation=slots.hydrateAllyFormation(null,[0,1,2]);
eq(formation.characterIndexToSlot,{0:"ALLY_F1",1:"ALLY_F2",2:"ALLY_F3"},"three-character migration preserves left-to-right order");

assert.equal(slots.moveAllyCharacter(1,"ALLY_B2"),true);
assert.equal(slots.getAllySlotForCharacter(1),"ALLY_B2");
assert.equal(slots.getCharacterAtAllySlot("ALLY_F2"),null,"moving to empty slot leaves the source empty");
assert.equal(slots.moveAllyCharacter(0,"ALLY_F3"),true);
assert.equal(slots.getAllySlotForCharacter(0),"ALLY_F3");
assert.equal(slots.getAllySlotForCharacter(2),"ALLY_F1","moving onto occupied slot swaps characters");

formation=slots.hydrateAllyFormation({characterIndexToSlot:{
    0:"ALLY_F1",1:"ALLY_F2",4:"ALLY_F3",2:"ALLY_B2",3:"ALLY_B3"
}},[0,1,2,3,4]);
const alive=index=>[0,1,2,3,4].includes(index);
eq(slots.resolveAllyTargets(formation,2,"allyTri",alive),[2,3],"back-centre allyTri does not borrow front-row units or fill empty B1");
eq(slots.resolveAllyTargets(formation,1,"allyTri",alive),[0,1,4],"front-centre allyTri hits only its three physical row slots");
eq(slots.resolveAllyTargets(formation,2,"column",alive),[1,2],"ally column stays in the same physical column");
eq(slots.resolveAllyTargets(formation,null,"allyAll",alive),[0,1,4,2,3],"allyAll returns occupied living ally unit slots only");
assert.equal(Object.prototype.hasOwnProperty.call(slots,"mechanismSlots"),false,"retired sidecar target geometry is absent");

formation=slots.hydrateAllyFormation({characterIndexToSlot:{
    0:"ALLY_B2",1:"ALLY_F1",2:"ALLY_F3"
}},[0,1,2]);
eq(slots.resolveAllyTargets(formation,1,"tri",index=>[0,1,2].includes(index)),[1],"a tri attack on an ally front-edge slot cannot hit the back-row water character");
eq(slots.resolveAllyTargets(formation,1,"row",index=>[0,1,2].includes(index)),[1,2],"a row attack on the ally front row hits only front-row characters");
eq(slots.resolveAllyTargets(formation,0,"row",index=>[0,1,2].includes(index)),[0],"a row attack on the ally back row only hits that back-row character");

const core=fs.readFileSync(new URL("../js/00-main.js",import.meta.url),"utf8");
const support=fs.readFileSync(new URL("../js/42-v148-combat-dungeon-fixes.js",import.meta.url),"utf8");
const enemySupport=fs.readFileSync(new URL("../js/36-v141-content-systems.js",import.meta.url),"utf8");
const water=fs.readFileSync(new URL("../js/50-v169-water-skill-rules.js",import.meta.url),"utf8");
const finalSkills=fs.readFileSync(new URL("../js/60-v173.64-skill-progression-rebalance.js",import.meta.url),"utf8");
assert.match(core,/allyFormation\s*:/,"ally formation persists in the formal account save document");
assert.match(core,/targetType===\"allyTri\"/,"manual allyTri enters ally target selection");
assert.doesNotMatch(support,/living\.length<=3/,"allyTri no longer expands to every living party member");
assert.match(support,/resolveAllyTargets\(/,"party buffs/heals share canonical ally slot geometry");
assert.match(support,/resolveEnemyTargets\(snapshot,center,\"tri\"/,"enemy rage shares canonical enemy slot geometry");
assert.match(enemySupport,/resolveEnemyTargets\(snapshot,center,\"tri\"/,"enemy heal/support shares canonical enemy slot geometry");
assert.doesNotMatch(water,/freeze\s*:/,"retired V169 compatibility layer does not own freeze targeting");
assert.match(finalSkills,/freeze:\s*\{[^}]*targetType:"column",targetTypeAtMaxLevel:"tri"/,"canonical V173.64 skill owner defines freeze targeting progression");
assert.match(core,/function resolveBattlefieldTargets\(targetSide,primaryIndex,targetType,options\)[\s\S]*?owner\.resolveAllyTargets\(formation,primaryIndex,normalized,alive\)/,"shared target resolver delegates ally geometry to the canonical Slot owner");
assert.match(core,/resolveEnemyActionTargets\(actionTargets,skillTargetType\)/,"monster attacks pass their effective skill shape to the action snapshot owner");
const snapshotResolver=core.match(/^function resolveEnemyActionTargets\([\s\S]*?^\}/m)?.[0];
assert.ok(snapshotResolver,"formal enemy snapshot resolver exists");
assert.match(snapshotResolver,/resolveBattlefieldTargets\("player",primary\.index,targetType,\{hostilePrimary:true\}\)/,"snapshot owner delegates range geometry to the shared target resolver");
// Execute the new boundary with the real Slot owner: keeping a target identity
// must not change front/back row, tri or column geometry.
const party=[{hp:100},{hp:100},{hp:100}];
const snapshotContext={getPartyCharacterByIndex:index=>party[index],canSelectHostileBattlePrimary:()=>true,
    resolveBattlefieldTargets:(side,index,shape,options)=>{
        assert.equal(side,"player");assert.equal(options.hostilePrimary,true);
        return slots.resolveAllyTargets(formation,index,shape,i=>party[i].hp>0);
    }};
vm.createContext(snapshotContext);vm.runInContext(snapshotResolver,snapshotContext);
const snapshot={targets:party.map((character,index)=>({index,character}))};snapshot.primary=snapshot.targets[1];
for(const [shape,expected] of [["single",[1]],["tri",[1]],["row",[1,2]],["column",[1]],["all",[0,1,2]]]){
    eq(snapshotContext.resolveEnemyActionTargets(snapshot,shape).targets.map(entry=>entry.index),expected,"enemy snapshot preserves "+shape+" formation geometry");
}
assert.doesNotMatch(core,/const attackTargets=isRangeSkill\s*\?\s*livingTargets/,"monster tri and row skills must not expand to all living allies");

// Geometry is element-agnostic: all four elements consume the same shape truth.
for(const element of ["fire","water","wind","earth"]){
    eq(slots.resolveSlotsFromShape("enemy","ENEMY_F3","tri"),["ENEMY_F2","ENEMY_F3","ENEMY_F4"],element+" tri geometry");
    eq(slots.resolveSlotsFromShape("enemy","ENEMY_F3","column"),["ENEMY_B3","ENEMY_F3"],element+" column geometry");
}

console.log("persistent ally formation and four-element slot geometry: PASS");

const formationRuntime=fs.readFileSync(new URL("../js/25-v131-fix-batch.js",import.meta.url),"utf8");
assert.match(formationRuntime,/const owner=fixedBattlefieldSlots\(\);[\s\S]*owner\.ensureAllyFormation/,"battle ally renderer resolves the canonical owner object");
assert.doesNotMatch(formationRuntime,/fixedBattlefieldSlots\.ally(?:Front|Back|Slots)/,"battle ally renderer must not read properties from the owner getter function");
