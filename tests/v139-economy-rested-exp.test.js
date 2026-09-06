"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const mainSource=fs.readFileSync("js/00-main.js","utf8");
const v131Source=fs.readFileSync("js/25-v131-fix-batch.js","utf8");
const v132Source=fs.readFileSync("js/27-v132-content-expansion.js","utf8");
const v133Source=fs.readFileSync("js/28-v133-economy-rebalance.js","utf8");
const v139Source=fs.readFileSync("js/32-v139-rested-experience.js","utf8");
const loaderSource=fs.readFileSync("js/20-anonymous-20.js","utf8");
const indexSource=fs.readFileSync("index.html","utf8");
const uiGuidelines=fs.readFileSync("UI_GUIDELINES.md","utf8");

function makeZoneConfig(){
    const variables={
        forest:"forestMonsters",
        desert:"desertMonsters",
        ice:"iceMountainMonsters",
        zone4:"zone4Monsters",
        zone5:"zone5Monsters",
        zone6:"zone6Monsters",
        zone7:"zone7Monsters",
        zone8:"zone8Monsters",
        zone9:"zone9Monsters",
        zone10:"zone10Monsters"
    };
    const config={};
    for(const [key,variable] of Object.entries(variables)){
        const start=mainSource.indexOf("const "+variable+" = [");
        assert.notEqual(start,-1,"找不到練功區陣列 "+variable);
        const end=mainSource.indexOf("];",start);
        assert.notEqual(end,-1,"練功區陣列未結束 "+variable);
        const block=mainSource.slice(start,end);
        const roster=[];
        const pattern=/makeZoneMonster\("([^"]+)",(\d+),"[^"]+"(?:,"(regular|elite|boss)")?\)/g;
        let match;
        while((match=pattern.exec(block))){
            roster.push({
                name:match[1],
                level:Number(match[2]),
                rank:match[3]||undefined
            });
        }
        assert.equal(roster.length,6,variable+" 應有6隻怪物");
        config[key]={monsters:()=>roster};
    }
    return config;
}

function makeEconomyContext(){
    const math=Object.create(Math);
    math.random=()=>0.5;
    const players=[{
        id:"主角",level:1,exp:0,expNext:100,
        attributePoints:0,skillPoints:0,bonusHP:0,bonusSP:0
    }];
    const potionDefinitions=[
        {id:"hpPotion10",resource:"hp",recoveryPercent:10,price:20},
        {id:"spPotion10",resource:"sp",recoveryPercent:10,price:25},
        {id:"hpPotion50",resource:"hp",recoveryPercent:50,price:80},
        {id:"spPotion50",resource:"sp",recoveryPercent:50,price:100},
        {id:"hpPotion100",resource:"hp",recoveryPercent:100,price:180},
        {id:"spPotion100",resource:"sp",recoveryPercent:100,price:220}
    ];
    const storage=new Map();
    const context=vm.createContext({
        console,
        Math:math,
        Number,String,Object,Array,Infinity,JSON,Date,
        player:players[0],player2:null,player3:null,
        players,
        sharedExp:0,
        potionDefinitions,
        zoneConfig:makeZoneConfig(),
        getMonsterRank:monster=>monster.rank||"regular",
        getExistingPartyIndexes:()=>players.map((_,index)=>index),
        getPartyCharacterByIndex:index=>players[index]||null,
        getMonsterGoldDrop:()=>0,
        localStorage:{
            getItem:key=>storage.has(key)?storage.get(key):null,
            setItem:(key,value)=>storage.set(key,String(value))
        },
        setTimeout:()=>0,
        setInterval:()=>0,
        alert:()=>{},
        saveGame:()=>{}
    });
    context.window=context;
    vm.runInContext(v133Source,context);
    return context;
}

let passed=0;
function test(name,fn){
    fn();
    passed++;
    console.log("✓ "+name);
}

test("formal growth curve keeps the legacy zone audit but uses the new fast/smooth EXP requirements",()=>{
    const context=makeEconomyContext();
    const audit=vm.runInContext("v139GetExpCurveAudit()",context);
    assert.equal(audit.totalEffectiveBattles,69760);
    assert.equal(audit.beginnerTotalExp,37950);

    const expectedExpNext={
        10:1200,20:8000,30:60000,40:120000,49:200000,50:215000,
        60:400000,70:650000,80:1000000,90:1500000,95:2000000,99:2800000
    };
    for(const checkpoint of audit.checkpoints){
        assert.equal(checkpoint.expNext,expectedExpNext[checkpoint.level],"Lv"+checkpoint.level+" expNext");
        assert.ok(checkpoint.averageBattleExp>0,"zone EXP audit remains available");
        assert.ok(checkpoint.targetBattles>0,"legacy battle audit remains available");
    }
    assert.ok(expectedExpNext[50]/expectedExpNext[49]<1.08,"Lv49→50 must not cliff");
    assert.equal(vm.runInContext("v173GetNaturalChargeLevelsPerDay(20)",context),1.30);
    assert.equal(vm.runInContext("v173GetNaturalChargeLevelsPerDay(50)",context),1.00);
    assert.equal(vm.runInContext("v173GetNaturalChargeLevelsPerDay(99)",context),0.32);
    assert.equal(vm.runInContext("v173GetDailyTotalTarget(20)",context),3.00);
    assert.equal(vm.runInContext("v173GetDailyTotalTarget(99)",context),1.00);
});

test("monster EXP keeps ×3.5, rank multipliers, and element-box 70%",()=>{
    assert.match(v131Source,/const V131_EXP_MULTIPLIER=3\.5/);
    assert.match(v131Source,/const ELEMENT_BOX_EXP_RATIO=0\.70/);
    assert.match(v131Source,/rank==="boss"\)\{ return 3; \}/);
    assert.match(v131Source,/rank==="elite"\)\{ return 1\.5; \}/);
    assert.match(v131Source,/finalExp=Math\.round\(finalExp\*ELEMENT_BOX_EXP_RATIO\)/);
});

test("EXP dungeon grants 33% of the party's current average level requirement",()=>{
    assert.match(v132Source,/const EXP_DUNGEON_REWARD_RATIO=0\.33/);
    assert.match(
        v132Source,
        /Math\.floor\(\(total\/indexes\.length\)\*EXP_DUNGEON_REWARD_RATIO\)/
    );
});

test("rested EXP accrues every two minutes, caps at 300, and consumes one battle",()=>{
    const storage=new Map();
    const listeners={};
    const document={
        hidden:false,
        getElementById:()=>null,
        addEventListener:(type,handler)=>{ listeners[type]=handler; }
    };
    const context=vm.createContext({
        console,Math,Number,String,Object,Array,JSON,Date,
        player:{id:"主角"},
        document,
        localStorage:{
            getItem:key=>storage.has(key) ? storage.get(key) : null,
            setItem:(key,value)=>storage.set(key,String(value)),
            removeItem:key=>storage.delete(key)
        },
        renderOfflineExpContent:()=>"<div>既有離線經驗</div>",
        setInterval:()=>1
    });
    context.window=context;
    context.addEventListener=(type,handler)=>{ listeners[type]=handler; };

    vm.runInContext(v139Source,context);
    assert.equal(vm.runInContext("v139AccrueRestedMinutes(10)",context),5);
    assert.equal(vm.runInContext("v139GetRestedExpState().battles",context),5);
    assert.equal(vm.runInContext("v139AccrueRestedMinutes(1000)",context),295);
    assert.equal(vm.runInContext("v139GetRestedExpState().battles",context),300);
    assert.deepEqual(
        JSON.parse(JSON.stringify(vm.runInContext("v139TryConsumeRestedBattle()",context))),
        {applied:true,remainingBattles:299}
    );
    assert.match(vm.runInContext("renderOfflineExpContent()",context),/299/);
    assert.match(vm.runInContext("renderOfflineExpContent()",context),/元素匣啟用期間不累積/);

    context.v131GetElementBoxState=()=>({active:true});
    document.hidden=true;
    listeners.visibilitychange();
    assert.equal(vm.runInContext("v139GetRestedExpState().blockedByElementBox",context),true);
    context.v131GetElementBoxState=()=>({active:false});
    document.hidden=false;
    listeners.visibilitychange();
    assert.equal(vm.runInContext("v139GetRestedExpState().blockedByElementBox",context),false);
});

test("rested multiplier is only called outside the element-box branch",()=>{
    assert.match(
        v131Source,
        /if\(isElementBoxBattle\)\{[\s\S]*?finalExp=Math\.round\(finalExp\*ELEMENT_BOX_EXP_RATIO\);[\s\S]*?\}else if\(typeof window\.v139TryConsumeRestedBattle==="function"\)/
    );
    assert.match(v131Source,/finalExp=Math\.round\(finalExp\*2\)/);
    assert.match(v132Source,/if\(!run\)\{\s*return originalWinBattle/);
});

test("gold, highest-level shop tiers, and exact six potion prices remain enforced",()=>{
    const context=makeEconomyContext();
    assert.equal(vm.runInContext("getMonsterGoldDrop({level:20,rank:'regular'})",context),43);
    assert.equal(vm.runInContext("getMonsterGoldDrop({level:20,rank:'elite'})",context),86);
    assert.equal(vm.runInContext("getMonsterGoldDrop({level:20,rank:'boss'})",context),215);

    context.players.push({id:"副角",level:91});
    assert.equal(vm.runInContext("v133GetHighestCreatedCharacterLevel()",context),91);
    assert.equal(vm.runInContext("v133GetShopItemPrice({price:20})",context),90);

    const prices=Object.fromEntries(context.potionDefinitions.map(item=>[item.id,item.price]));
    assert.deepEqual(prices,{
        hpPotion10:20,spPotion10:25,
        hpPotion50:80,spPotion50:100,
        hpPotion100:180,spPotion100:220,
        hpPotion30:50,spPotion30:65
    });
    assert.match(v133Source,/const SHOP_POTION_BASE_PRICES=/);
    assert.match(v133Source,/!SHOP_POTION_IDS\.includes\(itemId\)/);
    assert.doesNotMatch(v133Source,/potionDefinitions\.filter\(item=>item && item\.recoveryPercent<100\)/);
});

test("modular item art is permanent guidance and current assets are cache-versioned",()=>{
    assert.match(uiGuidelines,/道具 Icon 必須模組化/);
    assert.match(uiGuidelines,/基底圖/);
    assert.match(uiGuidelines,/新增約 100 個一般道具/);
    assert.match(loaderSource,/js\/32-v139-rested-experience\.js/);
    assert.match(loaderSource,/css\/37-v139-rested-experience\.css/);
    assert.match(loaderSource,/const V_ASSET_VERSION="173\.55"/);
    assert.match(indexSource,/js\/20-anonymous-20\.js\?v=173\.55/);
});

console.log("\nV139 economy/rested EXP suite: "+passed+" tests passed.");
