"use strict";
const assert=require("node:assert/strict");
const {migrateItem,projectItem}=require("../functions/src/equipment-combat-percent-migration");
for(const item of [
    {id:"gear",stats:{spirit:10,attack:7},reforgeStats:{spirit:10}},
    {id:"gear",stats:{accuracy:20,antiCrit:1,statusResistance:0.5,attack:7},reforgeStats:{accuracy:20,antiCrit:1,statusResistance:0.5}}
]){
    migrateItem(item);
    for(const stats of [item.stats,item.reforgeStats]){
        assert.equal(stats.accuracy,3);assert.equal(stats.antiCrit,1);
        assert.equal(stats.statusResistance,0.5);assert.equal(stats.spirit,undefined);
    }
    assert.equal(item.stats.attack,7);
    const once=structuredClone(item);migrateItem(item);migrateItem(item);
    assert.deepEqual(item,once);
    assert.deepEqual(projectItem(item),once);
}
for(const setId of ["setFire","setWater","setEarth","setWind"]){
    for(const suffix of ["heavyArmor","robe"]){
        const item={id:setId+"_"+suffix,setId,stats:{accuracy:10,antiCrit:0.5,statusResistance:0.25},reforgeStats:{accuracy:20,antiCrit:1,statusResistance:0.5}};
        const original=structuredClone(item),projected=projectItem(item);
        assert.deepEqual(item,original,"sealed original remains immutable");
        assert.equal(projected.stats.evasion,10);assert.equal(projected.stats.accuracy,undefined);
        assert.equal(projected.reforgeStats.accuracy,3,"reforge never treated as set base");
        assert.equal(projected.stats.antiCrit,0.5);assert.equal(projected.stats.statusResistance,0.25);
        assert.deepEqual(projectItem(projected),projected);
    }
}
const mixed={id:"setWind_robe",setId:"setWind",stats:{accuracy:30,antiCrit:1.5,statusResistance:0.75}};
migrateItem(mixed);assert.equal(mixed.stats.evasion,10);assert.equal(mixed.stats.accuracy,3);
const invalid={stats:{spirit:10},reforgeStats:{accuracy:"broken"}};
const before=structuredClone(invalid);assert.throws(()=>migrateItem(invalid));assert.deepEqual(invalid,before,"failed migration is atomic");
assert.throws(()=>migrateItem({equipmentCombatPercentUnitVersion:3,stats:{accuracy:20}}));
const current={equipmentCombatPercentUnitVersion:2,stats:{accuracy:10,evasion:10}};
assert.deepEqual(projectItem(current),current,"new percentage items never converted");
const fs=require("node:fs"),vm=require("node:vm");
const inventorySource=fs.readFileSync("js/55-v173.51-inventory-qa.js","utf8");
const statFunction=inventorySource.split("\n").find(line=>line.startsWith("function statText("));
const ui=vm.runInNewContext('const num=v=>Number.isFinite(Number(v))?Number(v):0;'+statFunction+';statText');
assert.equal(ui({stats:{accuracy:1.5,evasion:10},reforgeStats:{accuracy:0.3,evasion:2}}),"命中 +1.8%　閃避 +12%","numeric reforge aggregation precedes the display suffix");
console.log("V2 equipment unit migration: original and V1 Spirit, four sets, reforge separation, atomic failure, immutable archive projection and repeated-load PASS");
