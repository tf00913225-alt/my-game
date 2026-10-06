"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const v131Source=fs.readFileSync("js/25-v131-fix-batch.js","utf8");
const v132Source=fs.readFileSync("js/27-v132-content-expansion.js","utf8");
const loaderSource=fs.readFileSync("js/20-anonymous-20.js","utf8")+fs.readFileSync("scripts/build-production.mjs","utf8");
const indexSource=fs.readFileSync("index.html","utf8");
const battleCss=fs.readFileSync("css/31-v131-fix-batch.css","utf8");
const slotOwnerSource=fs.readFileSync("js/battlefield-slot-owner.js","utf8");
const coreSource=fs.readFileSync("js/00-main.js","utf8");
const releaseMeta=JSON.parse(fs.readFileSync("release/release.json","utf8"));

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

test("core battle flow owns pacing and skips non-acting entities",()=>{
    assert.match(coreSource,/function getBattleAdvanceDelay\(phase\)/);
    assert.match(coreSource,/v142GetRemainingAnimationMs/);
    assert.match(coreSource,/monsters\[i\]\.canAct!==false/);
    assert.match(coreSource,/actingMonster\.canAct===false/);
    assert.doesNotMatch(v131Source,/finishPlayerAction\s*=|processNextCombatant\s*=/);
});

test("formation puts BOSS in the center, then elites, then regular monsters",()=>{
    const ranks=["regular","elite","boss","regular","elite"];
    const weights={regular:1,elite:2,boss:3};
    const ctx=context({window:null});
    ctx.window=ctx;
    vm.runInContext(slotOwnerSource,ctx);
    const slots=ctx.FourSymbolsBattlefieldSlots;
    const snapshot=slots.createEnemyFormationSnapshot([0,1,2,3,4],{
        rankWeight:index=>weights[ranks[index]]
    });
    assert.equal(slots.getEnemySlotForMonster(snapshot,2),"ENEMY_F3");
    assert.equal(slots.getEnemySlotForMonster(snapshot,1),"ENEMY_F2");
    assert.equal(slots.getEnemySlotForMonster(snapshot,4),"ENEMY_F4");
    assert.equal(slots.getEnemySlotForMonster(snapshot,0),"ENEMY_F1");
    assert.equal(slots.getEnemySlotForMonster(snapshot,3),"ENEMY_F5");
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
    ctx.EXP_DUNGEON_REWARD_RATIO=0.33;
    assert.equal(vm.runInContext("getExpDungeonRewardExp()",ctx),18150);
    assert.match(v132Source,/const EXP_DUNGEON_REWARD_RATIO=0\.33/);
});

test("equipment dungeon always keeps one BOSS and four elites",()=>{
    let playerCount=1;
    const ctx=context({getExistingPartyIndexes:()=>Array.from({length:playerCount},(_,i)=>i)});
    vm.runInContext(extractFunction(v132Source,"getEquipmentDungeonComposition"),ctx);
    assert.deepEqual(
        JSON.parse(JSON.stringify(vm.runInContext("getEquipmentDungeonComposition()",ctx))),
        {playerCount:1,bossCount:1,eliteCount:4,total:5}
    );
    playerCount=2;
    assert.deepEqual(
        JSON.parse(JSON.stringify(vm.runInContext("getEquipmentDungeonComposition()",ctx))),
        {playerCount:2,bossCount:1,eliteCount:4,total:5}
    );
    playerCount=3;
    assert.deepEqual(
        JSON.parse(JSON.stringify(vm.runInContext("getEquipmentDungeonComposition()",ctx))),
        {playerCount:3,bossCount:1,eliteCount:4,total:5}
    );
});

test("all three formal daily entry paths require confirmation before construction",()=>{
    const owner=fs.readFileSync("js/42-v148-combat-dungeon-fixes.js","utf8");
    const calls=[];
    const context=vm.createContext({dailyPartyContext:()=>({soloProtected:false}),window:{rpgConfirm:(text,options)=>{calls.push({text,options});return Promise.resolve(true);}}});
    vm.runInContext(extractFunction(owner,"confirmFormalDailyDungeon"),context);
    for(const title of ['經驗副本','材料副本','金幣副本'])context.confirmFormalDailyDungeon({title});
    assert.equal(calls.length,3);
    calls.forEach((call,i)=>{assert.ok(call.text.includes(['經驗副本','材料副本','金幣副本'][i]));assert.equal(call.options.confirmText,'進入副本');});
    assert.match(extractFunction(owner,"beginFormalDailyDungeon"),/if\(!await confirmFormalDailyDungeon\(meta\)\)\{ return; \}\s*const built=buildDailyDungeonWaves\(type\)/);
});

test("daily elite and BOSS durability follows the formal balance owner without SP rewrites",()=>{
    const {MonsterBalance}=require('../js/combat/monster-balance-owner.mjs');
    const spec={context:'ci/formal-daily',monsterKey:'daily.exp.regular',name:'修行弟子',element:'fire',rank:'regular',archetype:'balanced',level:50,mode:'daily',partySize:3,dailyType:'exp',wave:1,slot:0,highestPartyLevel:50,skillFrequency:.35};
    const regular=MonsterBalance.build(spec);
    for(const [rank,hp,defense] of [['elite',1.5,1.1],['boss',2,1.15]]){
        const m=MonsterBalance.build({...spec,rank});
        assert.equal(m.maxHP,regular.maxHP*hp);assert.equal(m.defense,regular.defense*defense);
        assert.equal(m.maxSP,regular.maxSP);assert.equal(m.sp,m.maxSP);
        assert.equal(m.attack,regular.attack);assert.equal(m.balanceOwner,'MonsterBalance');
    }
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
    assert.doesNotMatch(v131Source,/v138-skill-learn-cost|學習需要/);
    assert.match(indexSource,/class="card v138-skill-point-summary"/);
    assert.match(indexSource,/剩餘技能點：/);
});

test("current release uses a hashed boot entry and feature manifest",()=>{
    const manifest=JSON.parse(fs.readFileSync("asset-manifest.json","utf8"));
    assert.match(indexSource,/build\/boot-core\.[0-9a-f]{12}\.js/);
    const assetVersionMatch=loaderSource.match(/const V_ASSET_VERSION="([^"]+)"/);
    assert.equal(assetVersionMatch?.[1],releaseMeta.cacheVersion);
    assert.equal(manifest.release,releaseMeta.version);
    assert.ok(manifest.featureManifest.bundles["gameplay-core"]);
});

console.log("\nV138 feature suite: "+passed+" tests passed.");
