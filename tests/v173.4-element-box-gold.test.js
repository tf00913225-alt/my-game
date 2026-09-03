"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const source=fs.readFileSync("js/25-v131-fix-batch.js","utf8");

let passed=0;
function test(name,handler){
    handler();
    passed++;
    console.log("✓ "+name);
}

function loadRuntime(options={}){
    const values=new Map();
    const goldNode={textContent:""};
    let now=0;
    let tick=null;
    const context={
        window:null,console,Math,Number,Object,Array,Set,Map,JSON,Infinity,
        Date:{now:()=>now},
        gold:Number(options.gold)||0,
        autoBattle:false,
        autoConfig:{enabled:options.enabled!==false,skill:"normal"},
        player:{id:"角色一"},player2:null,player3:null,
        currentBattleMonsters:[],monsters:[],
        localStorage:{
            getItem:key=>values.get(key)||null,
            setItem:(key,value)=>{ values.set(key,String(value)); }
        },
        document:{
            getElementById:id=>id==="v131EbGold"?goldNode:null,
            addEventListener(){},createElement(){ return {}; }
        },
        addEventListener(){},
        setInterval:handler=>{ tick=handler; return 1; },
        setTimeout:()=>1,
        updateGoldDisplay(){},addBattleLog(){},saveGame(){},
        updateAutoButton(){},updateActionHudVisibility(){},
        awardMonsterGoldDrop(monster){
            const amount=Math.max(0,Math.floor(Number(monster.amount)||0));
            if(amount>0){ context.gold+=amount; }
            return amount;
        }
    };
    values.set("v131_element_box_state",JSON.stringify({
        remainingMs:options.remainingMs===undefined?1000:options.remainingMs
    }));
    context.window=context;
    vm.createContext(context);
    vm.runInContext(source,context);
    return {
        context,goldNode,
        tick(){ tick(); },
        advance(ms){ now+=ms; },
        sessionGold(){ return Number(goldNode.textContent.replace(/,/g,"")||0); }
    };
}

test("normal Element Box patrol records each credited monster amount exactly once",()=>{
    const runtime=loadRuntime({gold:1000});

    assert.equal(runtime.context.awardMonsterGoldDrop({amount:7}),7);
    assert.equal(runtime.context.awardMonsterGoldDrop({amount:13}),13);
    assert.equal(runtime.sessionGold(),20);
    assert.equal(runtime.context.gold,1020,"account gold is still credited by the original function");
});

test("pre-battle and unrelated account-gold changes never enter the Element Box session",()=>{
    const runtime=loadRuntime({gold:1000});

    runtime.context.gold+=400;
    assert.equal(runtime.sessionGold(),0);
    runtime.context.awardMonsterGoldDrop({amount:9});
    assert.equal(runtime.sessionGold(),9);
    assert.equal(runtime.context.gold,1409);
});

test("inactive, stopped, and expired Element Box states do not add drops",()=>{
    const inactive=loadRuntime({gold:1000,remainingMs:0});
    inactive.context.awardMonsterGoldDrop({amount:8});
    assert.equal(inactive.sessionGold(),0);
    assert.equal(inactive.context.gold,1008);

    const stopped=loadRuntime({gold:1000});
    stopped.context.autoConfig.enabled=false;
    stopped.context.v131SyncElementBoxForBattle({silent:true});
    stopped.context.awardMonsterGoldDrop({amount:8});
    assert.equal(stopped.sessionGold(),0);

    const expired=loadRuntime({gold:1000,remainingMs:1});
    expired.advance(2);
    expired.tick();
    expired.context.awardMonsterGoldDrop({amount:8});
    assert.equal(expired.sessionGold(),0);
});

test("character changes and reload begin no duplicate session total",()=>{
    const currentSession=loadRuntime({gold:1000});
    currentSession.context.awardMonsterGoldDrop({amount:6});
    currentSession.context.player={id:"角色二"};
    currentSession.context.awardMonsterGoldDrop({amount:4});
    assert.equal(currentSession.sessionGold(),10);

    const reloaded=loadRuntime({gold:currentSession.context.gold});
    reloaded.context.awardMonsterGoldDrop({amount:5});
    assert.equal(reloaded.sessionGold(),5);
    assert.equal(reloaded.context.gold,1015);
});

test("dungeon drops are excluded while wild elite isolation remains normal patrol",()=>{
    const runtime=loadRuntime({gold:1000});

    runtime.context.v132ActiveDungeonRun={previousMonsters:[]};
    runtime.context.awardMonsterGoldDrop({amount:12});
    assert.equal(runtime.sessionGold(),0);

    runtime.context.v132ActiveDungeonRun={v141EliteDropIsolation:true};
    runtime.context.awardMonsterGoldDrop({amount:6});
    assert.equal(runtime.sessionGold(),6);
    assert.equal(runtime.context.gold,1018);
});

test("legacy autoConfig normal is untouched and no gold-difference tracker remains",()=>{
    const runtime=loadRuntime({gold:1000});
    assert.equal(runtime.context.autoConfig.skill,"normal");
    assert.match(source,/const originalAwardMonsterGoldDrop=awardMonsterGoldDrop/);
    assert.doesNotMatch(source,/elementBoxBattleStartGold|battleGoldStart/);
});

console.log("\nV173.39 Element Box gold suite: "+passed+" tests passed.");
