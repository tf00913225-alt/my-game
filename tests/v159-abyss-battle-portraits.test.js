"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const source=fs.readFileSync("js/48-v159-abyss-battle-portraits.js","utf8");
const loader=fs.readFileSync("js/20-anonymous-20.js","utf8");
const index=fs.readFileSync("index.html","utf8");

let passed=0;
function test(name,handler){ handler(); passed++; console.log("✓ "+name); }

function load(overrides={}){
    let syncs=0;
    const context=Object.assign({
        window:null,console,Number,Object,Array,Set,Map,Promise,
        document:{readyState:"complete",addEventListener(){}},
        requestAnimationFrame:callback=>{ callback(); return 1; },
        setTimeout:callback=>{ callback(); return 1; },
        v154SyncAbyssPortraits(){ syncs++; },
        v132LaunchDungeonBattle(){ return true; },
        updateUI(){ return "updated"; }
    },overrides);
    context.window=context;
    context.syncCount=()=>syncs;
    vm.createContext(context);
    vm.runInContext(source,context);
    return context;
}

test("V159 remains the final ordered runtime under cache key 162",()=>{
    assert.match(loader,/const V_ASSET_VERSION="162"/);
    assert.match(index,/js\/20-anonymous-20\.js\?v=162/);
    const v158=loader.indexOf("js/47-v158-combat-tuning.js");
    const v159=loader.indexOf("js/48-v159-abyss-battle-portraits.js");
    assert.ok(v158>=0&&v159>v158);
});

test("an already-open Abyss battle receives portraits when the runtime finishes loading",()=>{
    const context=load();
    assert.ok(context.syncCount()>=3);
});

test("dungeon launch resynchronizes after the battle cards are created",()=>{
    const context=load();
    const before=context.syncCount();
    assert.equal(context.v132LaunchDungeonBattle([]),true);
    assert.ok(context.syncCount()>=before+3);
});

test("the final update layer restores portraits after older UI wrappers run",()=>{
    let portraitState="unapplied";
    const context=load({
        updateUI(){ portraitState="cleared-by-v152"; return "updated"; },
        v154SyncAbyssPortraits(){ portraitState="visible"; }
    });
    assert.equal(context.updateUI(),"updated");
    assert.equal(portraitState,"visible");
});

console.log("\nV159 Abyss battle portrait suite: "+passed+" tests passed.");
