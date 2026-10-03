"use strict";
const assert=require("node:assert/strict");
const test=require("node:test");
const {makeInitialCharacterSources}=require("../functions/src/initial-character-sources");
const {migrateLegacyCanonicalCharacterState}=require("../functions/src/canonical-attribute-allocation");

test("new Cloud Save character sources use the formal six-stat schema",()=>{
    const sources=makeInitialCharacterSources("uid-test",2,"initial-operation-0001",{
        displayName:"測試角色",element:"fire",gender:"male",
        attributes:{attack:2,intelligence:2,vitality:2,energy:1,defensePoints:2,agility:1}
    });
    const state=sources.characters[0].state;
    assert.equal(state.attack,2);
    assert.equal(state.intelligence,2);
    assert.equal(state.vitality,2);
    assert.equal(state.energy,1);
    assert.equal(state.defensePoints,2);
    assert.equal(state.agility,1);
    assert.equal(Object.hasOwn(state,"spirit"),false);
    assert.equal(Object.keys(state).filter(key=>["attack","intelligence","vitality","energy","defensePoints","agility"].includes(key)).length,6);
});

test("legacy canonical Spirit points return to the unspent pool and never become Defense",()=>{
    const migrated=migrateLegacyCanonicalCharacterState({
        spirit:17,defensePoints:0,attributePoints:3,attack:2,intelligence:1,
        vitality:10,energy:4,agility:1,hp:600,sp:110,bonusHP:0,bonusSP:0
    });
    assert.equal(migrated.attributePoints,20);
    assert.equal(migrated.defensePoints,0);
    assert.equal(migrated.vitality,10);
    assert.equal(Object.hasOwn(migrated,"spirit"),false);
    assert.deepEqual(migrateLegacyCanonicalCharacterState(migrated),migrated);
});
