"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const v131Source=fs.readFileSync("js/25-v131-fix-batch.js","utf8");
const v132Source=fs.readFileSync("js/27-v132-content-expansion.js","utf8");
const loaderSource=fs.readFileSync("js/20-anonymous-20.js","utf8");
const indexSource=fs.readFileSync("index.html","utf8");
const battleCss=fs.readFileSync("css/31-v131-fix-batch.css","utf8");

function extractFunction(source,name){
    const start=source.indexOf("function "+name+"(");
    assert.notEqual(start,-1,"找不到函式 "+name);
    const opening=source.indexOf("{",start);
    let depth=0;
    let quote=null;
    let escaped=false;
    let lineComment=false;
    let blockComment=false;

    for(let i=opening;i<source.length;i++){
        const char=source[i];
        const next=source[i+1];
        if(lineComment){
            if(char==="\n"){ lineComment=false; }
            continue;
        }
        if(blockComment){
            if(char==="*" && next==="/"){ blockComment=false; i++; }
            continue;
        }
        if(quote){
            if(escaped){ escaped=false; continue; }
            if(char==="\\"){ escaped=true; continue; }
            if(char===quote){ quote=null; }
            continue;
        }
        if(char==="/" && next==="/"){ lineComment=true; i++; continue; }
        if(char==="/" && next==="*"){ blockComment=true; i++; continue; }
        if(char==='"' || char==="'" || char==="`"){ quote=char; continue; }
        if(char==="{"){ depth++; }
        if(char==="}"){
            depth--;
            if(depth===0){ return source.slice(start,i+1); }
        }
    }
    throw new Error("函式括號不完整："+name);
}

function context(values={}){
    return vm.createContext({console,Math,Number,String,Object,Array,Map,...values});
}

let passed=0;
function test(name,fn){
    fn();
    passed++;
    console.log("✓ "+name);
}

test("battle pacing is 1.6 seconds per action and 2 seconds per round",()=>{
    assert.match(v131Source,/const V138_ACTION_DELAY_MS=1600/);
    assert.match(v131Source,/const V138_ROUND_TRANSITION_MS=2000/);
    assert.match(
        v131Source,
        /V138_ROUND_TRANSITION_MS-V138_ACTION_DELAY_MS/
    );
    assert.match(v131Source,/skipInactiveInitiativeEntries\(\)/);
    assert.match(
        v131Source,
        /initiativeIndex>=initiativeQueue\.length\s*\? V138_ROUND_HANDOFF_DELAY_MS\s*:\s*V138_ACTION_DELAY_MS/
    );
});

test("formation puts BOSS in the center, then elites, then regular monsters",()=>{
    const ctx=context({
        monsters:[
            {rank:"regular"},
            {rank:"elite"},
            {rank:"boss"},
            {rank:"regular"},
            {rank:"elite"}
        ],
        getMonsterRank:monster=>monster.rank
    });
    ["getFormationRankWeight","arrangeRowCenterFirst","getFormationRows"]
        .forEach(name=>vm.runInContext(extractFunction(v131Source,name),ctx));
    const rows=vm.runInContext("getFormationRows([0,1,2,3,4])",ctx);
    assert.deepEqual(Array.from(rows[0]),[0,1,2,4,3]);
    assert.equal(ctx.monsters[rows[0][2]].rank,"boss");
    assert.equal(ctx.monsters[rows[0][1]].rank,"elite");
    assert.equal(ctx.monsters[rows[0][3]].rank,"elite");
});

test("monster and player frames use element colors while names use rank colors",()=>{
    ["fire","water","wind","earth"].forEach(element=>{
        assert.match(battleCss,new RegExp('data-element="'+element+'"'));
    });
    assert.match(battleCss,/data-rank="elite"[\s\S]*?#ff9f43/);
    assert.match(battleCss,/data-rank="boss"[\s\S]*?#ff5fa2/);
    assert.match(battleCss,/battle-monster-name[\s\S]*?#f8fafc/);
    assert.doesNotMatch(
        battleCss,
        /#game-stage #battlePage \.battle-player\{[\s\S]{0,160}#d8aa36/
    );
});

test("EXP dungeon reward is 11% of the party's average current expNext",()=>{
    const players=[{expNext:50000},{expNext:60000}];
    const ctx=context({
        getExistingPartyIndexes:()=>[0,1],
        getPartyCharacterByIndex:index=>players[index]
    });
    vm.runInContext(extractFunction(v132Source,"getExpDungeonRewardExp"),ctx);
    ctx.EXP_DUNGEON_REWARD_RATIO=0.11;
    assert.equal(vm.runInContext("getExpDungeonRewardExp()",ctx),6050);
    assert.match(v132Source,/const EXP_DUNGEON_REWARD_RATIO=0\.11/);
});

test("equipment dungeon keeps one BOSS per player and adds five more elites",()=>{
    let playerCount=1;
    const ctx=context({getExistingPartyIndexes:()=>Array.from({length:playerCount},(_,i)=>i)});
    vm.runInContext(extractFunction(v132Source,"getEquipmentDungeonComposition"),ctx);
    assert.deepEqual(
        JSON.parse(JSON.stringify(vm.runInContext("getEquipmentDungeonComposition()",ctx))),
        {playerCount:1,bossCount:1,eliteCount:9,total:10}
    );
    playerCount=2;
    assert.deepEqual(
        JSON.parse(JSON.stringify(vm.runInContext("getEquipmentDungeonComposition()",ctx))),
        {playerCount:2,bossCount:2,eliteCount:8,total:10}
    );
    playerCount=3;
    assert.deepEqual(
        JSON.parse(JSON.stringify(vm.runInContext("getEquipmentDungeonComposition()",ctx))),
        {playerCount:3,bossCount:3,eliteCount:7,total:10}
    );
});

test("all three dungeon entry paths require confirmation",()=>{
    const calls=v132Source.match(/confirmDungeonEntry\(/g)||[];
    assert.equal(calls.length,4,"一個函式定義加三個副本呼叫");
    assert.match(v132Source,/confirmDungeonEntry\(\s*"經驗副本"/);
    assert.match(v132Source,/confirmDungeonEntry\(\s*"材料副本"/);
    assert.match(v132Source,/confirmDungeonEntry\(\s*"裝備副本"/);
});

test("dungeon elite and BOSS HP/SP receive the requested additional boosts",()=>{
    assert.match(
        v132Source,
        /DUNGEON_ELITE_MULTIPLIERS=\{maxHP:3\.20,maxSP:2\.00/
    );
    assert.match(
        v132Source,
        /DUNGEON_BOSS_MULTIPLIERS=\{maxHP:4\.50,maxSP:2\.00/
    );
    assert.match(v132Source,/monster\.sp=monster\.maxSP/);
});

test("chests and tickets expose open/preview only and preview exact probabilities",()=>{
    assert.match(v132Source,/sellButton\.style\.display=isChestOrTicket \? "none" : ""/);
    assert.match(v132Source,/useButton\.textContent="開啟"/);
    assert.match(v132Source,/previewButton\.textContent="預覽"/);
    assert.match(v132Source,/tier\.weight\/pool\.length/);
    assert.match(v132Source,/100\/pieces\.length/);
    assert.match(v132Source,/addItemToInventory\(materialChestDefinition,finalCount\)/);
    assert.match(v132Source,/請到背包自行開啟/);
});

test("set bonuses and skill costs are visible before extra detail clicks",()=>{
    assert.ok(v132Source.includes("escapeHtml(label)+']'+count+'/5"));
    assert.match(v132Source,/裝備三件　全能力\+1/);
    assert.match(v132Source,/裝備五件　/);
    assert.match(v131Source,/v138-skill-learn-cost/);
    assert.match(v131Source,/學習需要 "\+Math\.max\(0,Number\(skill\.learnCost\)\|\|0\)\+" 技能點/);
    assert.match(indexSource,/class="card v138-skill-point-summary"/);
    assert.match(indexSource,/剩餘技能點：/);
});

test("current cache version reaches the loader and all dynamic assets",()=>{
    assert.match(indexSource,/js\/20-anonymous-20\.js\?v=173\.1/);
    assert.match(loaderSource,/const V_ASSET_VERSION="173\.1"/);
});

console.log("\nV138 feature suite: "+passed+" tests passed.");
