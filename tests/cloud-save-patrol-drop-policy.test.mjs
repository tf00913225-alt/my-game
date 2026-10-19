import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import test from "node:test";

const require=createRequire(import.meta.url);
const policy=require("../functions/src/patrol-drop-policy.js");
// Frozen original tables and predicates from 4f97e254's v132/v141 Owners.
// No Git subprocess, current Client source or shared sampler is an oracle.
const normalBefore=[
    {itemId:"freezeTalismanLow",chance:.05,quantity:1},
    {itemId:"stealthTalismanLow",chance:.05,quantity:1},
    {itemId:"barrierTalismanLow",chance:.05,quantity:1},
    {itemId:"oreLow",chance:.05,quantity:1}
];
const eliteBefore=[
    {itemId:"ticketSetFire",chance:.01,quantity:1},
    {itemId:"ticketSetWater",chance:.01,quantity:1},
    {itemId:"ticketSetEarth",chance:.01,quantity:1},
    {itemId:"ticketSetWind",chance:.01,quantity:1},
    {itemId:"freezeTalismanMid",chance:.05,quantity:1},
    {itemId:"stealthTalismanMid",chance:.05,quantity:1},
    {itemId:"barrierTalismanMid",chance:.05,quantity:1}
];
function oldNormal(index,sample){
    const row=normalBefore[index];
    if(sample>=row.chance)return null;
    return row;
}
function oldElite(sample){
    let roll=sample;
    return eliteBefore.find(row=>(roll-=row.chance)<0)||null;
}

test("original drop rows, order, chances and quantities remain immutable",()=>{
    assert.deepEqual(policy.normalRows,normalBefore);
    assert.deepEqual(policy.eliteRows,eliteBefore);
    assert.ok(Object.isFrozen(policy));
    for(const rows of [policy.normalRows,policy.eliteRows]){
        assert.ok(Object.isFrozen(rows));
        for(const row of rows){
            assert.ok(Object.isFrozen(row));
            assert.throws(()=>{row.chance=1;},TypeError);
            assert.throws(()=>{row.itemId="foreign";},TypeError);
        }
        assert.throws(()=>rows.push({}),TypeError);
    }
});

test("normal monsters retain four independent five-percent rolls, including zero or four drops",()=>{
    for(let mask=0;mask<16;mask++){
        const samples=normalBefore.map((_,i)=>mask&(1<<i)?0:.5);
        const actual=samples.map((sample,i)=>policy.normalDrop(i,sample));
        assert.deepEqual(actual,samples.map((sample,i)=>oldNormal(i,sample)));
        assert.equal(actual.filter(Boolean).length,mask.toString(2).replaceAll("0","").length);
    }
    for(let index=0;index<4;index++){
        assert.strictEqual(policy.normalDrop(index,0),policy.normalRows[index]);
        assert.strictEqual(policy.normalDrop(index,.05-Number.EPSILON),policy.normalRows[index]);
        assert.equal(policy.normalDrop(index,.05),null);
        assert.equal(policy.normalDrop(index,1-Number.EPSILON),null);
    }
});

test("elite one-roll results preserve sequential subtraction at floating point boundaries",()=>{
    const golden=[
        [0,"ticketSetFire"],[.005,"ticketSetFire"],[.01,"ticketSetWater"],
        [.015,"ticketSetWater"],[.025,"ticketSetEarth"],
        // Replacing the original repeated subtraction with cumulative sums
        // changes these exact decimal samples due to floating point rounding.
        [.03,"ticketSetEarth"],[.04,"ticketSetWind"],
        [.06,"freezeTalismanMid"],[.11,"stealthTalismanMid"],
        [.16,"barrierTalismanMid"],[.20,null],[.5,null],[1-Number.EPSILON,null]
    ];
    for(const [sample,expected] of golden){
        assert.equal(policy.eliteDrop(sample)?.itemId??null,expected,String(sample));
    }
    const boundaries=[0,.01,.02,.03,.04,.09,.14,.19,1];
    for(const boundary of boundaries)for(const delta of [-Number.EPSILON,0,Number.EPSILON]){
        const sample=boundary+delta;
        assert.deepEqual(policy.eliteDrop(sample),oldElite(sample),`${boundary}/${delta}`);
    }
});

test("broad deterministic sample parity protects original normal and elite probability partitions",()=>{
    for(let tick=0;tick<=10000;tick++){
        const sample=tick/10000;
        for(let index=0;index<4;index++)assert.deepEqual(policy.normalDrop(index,sample),oldNormal(index,sample));
        assert.deepEqual(policy.eliteDrop(sample),oldElite(sample),String(sample));
    }
});

test("sampler extraction preserves existing invalid-sample coercion without inventing validation",()=>{
    for(const sample of [undefined,null,NaN,Infinity,-Infinity,-1,1,2,".01",".05","invalid",{},false,true]){
        for(let index=0;index<4;index++)assert.deepEqual(policy.normalDrop(index,sample),oldNormal(index,sample));
        assert.deepEqual(policy.eliteDrop(sample),oldElite(sample));
    }
    // Indices are internal row references; malformed indices retain fail-fast
    // behavior rather than silently selecting a different reward.
    for(const index of [-1,4,undefined,"missing"]){
        assert.throws(()=>policy.normalDrop(index,0),TypeError);
    }
});

test("browser and CommonJS APIs agree, consume no RNG or clock, and leave input arrays unchanged",()=>{
    const source=readFileSync(new URL("../functions/src/patrol-drop-policy.js",import.meta.url),"utf8");
    let randomCalls=0,clockCalls=0;
    const math=Object.create(Math);
    math.random=()=>{randomCalls++;throw Error("implicit RNG");};
    class ForbiddenDate{constructor(){clockCalls++;throw Error("implicit clock");}
        static now(){clockCalls++;throw Error("implicit clock");}}
    const context=vm.createContext({window:{},Math:math,Date:ForbiddenDate});
    vm.runInContext(source,context);
    const browser=context.window.FourSymbolsPatrolDropPolicy;
    assert.deepEqual(Object.keys(browser).sort(),Object.keys(policy).sort());
    assert.equal(JSON.stringify(browser.normalRows),JSON.stringify(policy.normalRows));
    assert.equal(JSON.stringify(browser.eliteRows),JSON.stringify(policy.eliteRows));
    assert.ok(Object.isFrozen(browser));
    for(const rows of [browser.normalRows,browser.eliteRows]){
        assert.ok(Object.isFrozen(rows));assert.ok(rows.every(Object.isFrozen));
    }
    const samples=Object.freeze([0,.01,.03,.04,.05,.09,.14,.19,.5,1-Number.EPSILON]);
    const original=JSON.stringify(samples);
    for(const sample of samples){
        for(let index=0;index<4;index++){
            assert.equal(JSON.stringify(browser.normalDrop(index,sample)),JSON.stringify(policy.normalDrop(index,sample)));
        }
        assert.equal(JSON.stringify(browser.eliteDrop(sample)),JSON.stringify(policy.eliteDrop(sample)));
    }
    assert.equal(browser.normalDrop(0,.5),null);assert.equal(browser.eliteDrop(.5),null);
    assert.equal(JSON.stringify(samples),original);
    assert.equal(randomCalls,0);assert.equal(clockCalls,0);
});
