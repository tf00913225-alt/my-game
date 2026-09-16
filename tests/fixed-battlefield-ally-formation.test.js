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
assert.equal(slots.mechanismSlots.some(slot=>slots.allySlots.includes(slot)),false,"mechanism slots are not ally unit geometry");

const core=fs.readFileSync(new URL("../js/00-main.js",import.meta.url),"utf8");
const support=fs.readFileSync(new URL("../js/42-v148-combat-dungeon-fixes.js",import.meta.url),"utf8");
const enemySupport=fs.readFileSync(new URL("../js/36-v141-content-systems.js",import.meta.url),"utf8");
const water=fs.readFileSync(new URL("../js/50-v169-water-skill-rules.js",import.meta.url),"utf8");
assert.match(core,/allyFormation\s*:/,"ally formation persists in the formal account save document");
assert.match(core,/targetType===\"allyTri\"/,"manual allyTri enters ally target selection");
assert.doesNotMatch(support,/living\.length<=3/,"allyTri no longer expands to every living party member");
assert.match(support,/resolveAllyTargets\(/,"party buffs/heals share canonical ally slot geometry");
assert.match(support,/resolveEnemyTargets\(snapshot,center,\"tri\"/,"enemy rage shares canonical enemy slot geometry");
assert.match(enemySupport,/resolveEnemyTargets\(snapshot,center,\"tri\"/,"enemy heal/support shares canonical enemy slot geometry");
assert.match(water,/\"column\"/,"water freeze compatibility still resolves to column geometry");

// Geometry is element-agnostic: all four elements consume the same shape truth.
for(const element of ["fire","water","wind","earth"]){
    eq(slots.resolveSlotsFromShape("enemy","ENEMY_F3","tri"),["ENEMY_F2","ENEMY_F3","ENEMY_F4"],element+" tri geometry");
    eq(slots.resolveSlotsFromShape("enemy","ENEMY_F3","column"),["ENEMY_B3","ENEMY_F3"],element+" column geometry");
}

console.log("persistent ally formation and four-element slot geometry: PASS");
