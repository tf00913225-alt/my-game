"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const mainSource=fs.readFileSync("js/00-main.js","utf8");
const loaderSource=fs.readFileSync("js/20-anonymous-20.js","utf8");
const v131Source=fs.readFileSync("js/25-v131-fix-batch.js","utf8");
const v132Source=fs.readFileSync("js/27-v132-content-expansion.js","utf8");
const v133Source=fs.readFileSync("js/28-v133-economy-rebalance.js","utf8");
const coreSource=fs.readFileSync("js/34-v141-core-systems.js","utf8");
const uiSource=fs.readFileSync("js/35-v141-ui-battle.js","utf8");
const contentSource=fs.readFileSync("js/36-v141-content-systems.js","utf8");
const cssSource=fs.readFileSync("css/38-v141-system-expansion.css","utf8");
const indexSource=fs.readFileSync("index.html","utf8");

function extractFunction(source,name){
    const marker="function "+name+"(";
    const start=source.indexOf(marker);
    assert.notEqual(start,-1,"missing function "+name);
    const open=source.indexOf("{",start);
    let depth=0;
    let quote=null;
    let escaped=false;
    for(let index=open;index<source.length;index++){
        const char=source[index];
        if(quote){
            if(escaped){ escaped=false; continue; }
            if(char==="\\"){ escaped=true; continue; }
            if(char===quote){ quote=null; }
            continue;
        }
        if(char==='"'||char==="'"||char==='`'){ quote=char; continue; }
        if(char==="{"){ depth++; }
        if(char==="}" && --depth===0){ return source.slice(start,index+1); }
    }
    throw new Error("unterminated function "+name);
}

function extractAssignedFunction(source,name){
    const marker=name+"=function(";
    const start=source.indexOf(marker);
    assert.notEqual(start,-1,"missing assigned function "+name);
    const open=source.indexOf("{",start);
    let depth=0;
    let quote=null;
    let escaped=false;
    for(let index=open;index<source.length;index++){
        const char=source[index];
        if(quote){
            if(escaped){ escaped=false; continue; }
            if(char==="\\"){ escaped=true; continue; }
            if(char===quote){ quote=null; }
            continue;
        }
        if(char==='"'||char==="'"||char==='`'){ quote=char; continue; }
        if(char==="{"){ depth++; }
        if(char==="}" && --depth===0){ return source.slice(start,index+1); }
    }
    throw new Error("unterminated assigned function "+name);
}

let passed=0;
function test(name,fn){ fn(); passed++; console.log("✓ "+name); }

test("V141 assets remain ordered before later patches with the current cache version",()=>{
    const paths=[
        "js/33-v140-four-element-balance.js",
        "js/34-v141-core-systems.js",
        "js/35-v141-ui-battle.js",
        "js/36-v141-content-systems.js",
        "js/37-v142-skill-animation.js",
        "js/38-v143-system-fixes.js",
        "js/39-v143-skill-animation.js",
        "js/40-v144-rules-and-abyss.js",
        "js/41-v146-system-polish.js"
    ].map(path=>loaderSource.indexOf(path));
    assert.ok(paths.every(index=>index>=0));
    assert.deepEqual(paths.slice().sort((a,b)=>a-b),paths);
    assert.match(loaderSource,/css\/38-v141-system-expansion\.css/);
    assert.match(loaderSource,/const V_ASSET_VERSION="173\.44"/);
    assert.match(indexSource,/js\/00-main\.js\?v=173\.44/);
    assert.match(indexSource,/js\/20-anonymous-20\.js\?v=173\.44/);
});

test("backpack is 120 slots rendered as seven cyclic pages of 18 without drag or slot numbers",()=>{
    assert.match(mainSource,/new Array\(120\)\.fill\(null\)/);
    assert.match(mainSource,/const INVENTORY_CATEGORY_SLOT_COUNT = 120/);
    assert.match(uiSource,/const INVENTORY_PAGE_SIZE=18/);
    assert.match(uiSource,/const INVENTORY_PAGE_COUNT=7/);
    assert.match(uiSource,/inventoryPageIndex=\(inventoryPageIndex\+Number\(direction\)\+INVENTORY_PAGE_COUNT\)%INVENTORY_PAGE_COUNT/);
    assert.match(uiSource,/box\.draggable=false/);
    assert.doesNotMatch(uiSource,/inventory-slot-number/);
    assert.match(cssSource,/grid-template-rows:repeat\(3,minmax\(0,1fr\)\)/);
    assert.match(cssSource,/\.inventory-slot-number\{\s*display:none/);
});

test("monster skills cap at 1/2/3 and use fixed Lv1-Lv5 bands",()=>{
    const context=vm.createContext({Math,Number});
    vm.runInContext(extractFunction(coreSource,"getMonsterSkillCarryLimit"),context);
    vm.runInContext(extractFunction(coreSource,"getMonsterFixedSkillLevel"),context);
    assert.deepEqual([1,20,21,40,41,81].map(level=>vm.runInContext(`getMonsterSkillCarryLimit(${level})`,context)),[1,1,2,2,3,3]);
    assert.deepEqual([1,20,21,40,41,60,61,80,81,100].map(level=>vm.runInContext(`getMonsterFixedSkillLevel(${level})`,context)),[1,1,2,2,3,3,4,4,5,5]);
    assert.match(coreSource,/if\(!monster \|\| monster\.v141Abyss\)\{ return monster; \}/);
});

test("wild ranks are explicit, independent 10% rolls and never random BOSS",()=>{
    assert.match(coreSource,/const WILD_ELITE_RATE=0\.10/);
    assert.match(coreSource,/monster\.v141BattleRank=Math\.random\(\)<WILD_ELITE_RATE \? "elite" : "regular"/);
    assert.match(coreSource,/VALID_RANKS\.has\(monster\.rank\)/);
    const rankBody=extractAssignedFunction(coreSource,"getMonsterRank");
    assert.doesNotMatch(rankBody,/name|王|皇/);
    assert.doesNotMatch(extractFunction(mainSource,"getMonsterRank"),/name|王|皇/);
    assert.doesNotMatch(v133Source,/endsWith\("王"\)/);
    assert.match(coreSource,/monster\.rank="regular"/);
    assert.doesNotMatch(coreSource,/v141BattleRank=.*boss/);
});

test("elite special loot uses one 19% cumulative table and isolates the normal low-tier pool",()=>{
    const dropBody=extractFunction(coreSource,"addEliteSpecialDrop");
    assert.equal((dropBody.match(/Math\.random\(\)/g)||[]).length,1);
    ["roll<1","roll<2","roll<3","roll<4","roll<9","roll<14","roll<19"].forEach(token=>assert.ok(dropBody.includes(token)));
    assert.match(coreSource,/v141EliteDropIsolation:true/);
    assert.match(v132Source,/if\(window\.v132ActiveDungeonRun\)\{ return; \}/);
    assert.match(v131Source,/rank==="elite"\)\{ return 1\.5; \}/);
    assert.match(v133Source,/rank==="elite"\s*\?\s*2/);
});

test("final EXP curve follows the eight-monster zones and deterministic 10% elite expectation",()=>{
    assert.match(v133Source,/return 1\+rate\*\.5/);
    assert.match(coreSource,/monster\.v141CurveEliteRate=WILD_ELITE_RATE/);
    const checkpoints={
        10:{levels:[3,2,3,2,3,2,4,4],group:2,battles:15,avg:211,next:3165},
        30:{levels:[22,23,22,23,27,28,25,25],group:4.5,battles:100,avg:4031,next:403100},
        50:{levels:[42,43,42,43,48,50,45,45],group:4.5,battles:400,avg:7401,next:2960400},
        70:{levels:[62,63,62,63,68,70,65,65],group:4.5,battles:900,avg:10708,next:9637200},
        80:{levels:[72,73,72,73,78,80,75,75],group:4.5,battles:1200,avg:12362,next:14834400},
        90:{levels:[82,83,82,83,88,90,85,85],group:4.5,battles:1700,avg:14016,next:23827200},
        99:{levels:[92,93,92,93,98,100,95,95],group:4.5,battles:4000,avg:15669,next:62676000}
    };
    Object.values(checkpoints).forEach(point=>{
        const averageLevel=point.levels.reduce((sum,value)=>sum+value,0)/point.levels.length;
        const averageExp=Math.round(averageLevel*10*1.05*point.group*3.5);
        assert.equal(averageExp,point.avg);
        assert.equal(averageExp*point.battles,point.next);
    });
    const effectiveBattles=69760;
    assert.ok(effectiveBattles>=60000&&effectiveBattles<=80000);
    assert.equal(Number((effectiveBattles/(5*60*8*.70)).toFixed(2)),41.52);
});

test("offline EXP uses highest-character level bands without changing its time cap",()=>{
    const context=vm.createContext({getHighestCharacterLevel:()=>context.level});
    vm.runInContext(extractFunction(coreSource,"getOfflineLevelMultiplier"),context);
    const expected=[[1,1],[10,1],[11,1.2],[21,1.4],[31,1.6],[41,1.8],[51,2],[100,2]];
    expected.forEach(([level,multiplier])=>{ context.level=level; assert.equal(vm.runInContext("getOfflineLevelMultiplier()",context),multiplier); });
    assert.match(coreSource,/baseGain\*getOfflineLevelMultiplier\(\)/);
    assert.match(uiSource,/OFFLINE_EXP_MAX_MINUTES/);
});

test("daily dungeon formations and element balancing match the requested expansion",()=>{
    assert.match(v132Source,/for\(let i=0;i<10;i\+\+\)/);
    assert.match(v132Source,/stage===3 \? "elite" : "regular"/);
    assert.match(v132Source,/bossCount:1/);
    assert.match(v132Source,/eliteCount:4/);
    assert.match(v132Source,/total:5/);
    assert.match(v132Source,/const DUNGEON_DAILY_LIMIT_ENABLED=false/);
    assert.match(uiSource,/const elements=\["fire","water","earth","wind"\]/);
    assert.match(uiSource,/monster\.element=elements\[index%elements\.length\]/);
    assert.match(uiSource,/bosses\.forEach/);
    assert.match(uiSource,/roster\.filter\(monster=>getMonsterRank\(monster\)!=="boss"\)/);
});

test("monster shields are real HP absorption with their own white HUD bar",()=>{
    const context=vm.createContext({Math,Number});
    ["getMonsterShieldRemaining","removeMonsterShield","syncMonsterShield","applyMonsterShield"].forEach(name=>vm.runInContext(extractFunction(coreSource,name),context));
    context.monster={alive:true,maxHP:500,hp:400,activeBuffs:[]};
    assert.equal(vm.runInContext("applyMonsterShield(monster,200,2)",context),200);
    assert.equal(context.monster.hp,600);
    context.monster.hp-=120;
    assert.equal(vm.runInContext("syncMonsterShield(monster)",context),80);
    assert.equal(context.monster.maxHP,700);
    context.monster.hp-=80;
    assert.equal(vm.runInContext("syncMonsterShield(monster)",context),0);
    assert.equal(context.monster.maxHP,500);
    assert.equal(context.monster.hp,400);
    assert.match(uiSource,/v141-monster-shield-bar/);
    assert.match(uiSource,/entity\.v141Shield\.isBarrier\?"barrier":"shield"/);
    assert.match(cssSource,/background:linear-gradient\(90deg,#f7fbff,#cfeeff/);
});

test("all player slots can manually resolve heal, revive and buff skills",()=>{
    assert.match(uiSource,/activeBattleCharacterIndex<=0/);
    assert.match(uiSource,/\["buff","heal","revive"\]\.includes\(skill\.category\)/);
    assert.match(uiSource,/characterIndex>0&&queued&&skill/);
    assert.match(uiSource,/executeAdditionalSupportAction/);
    assert.match(uiSource,/target\.hp=Math\.max\(1/);
    assert.match(uiSource,/ally\.activeBuffs\.push/);
});

test("card VFX cover all requested status groups and battle transitions are directional",()=>{
    ["burn","stun","freeze","petrify","shield","barrier","defenseDown","agilityDown","damageDown","statDown","buff"].forEach(type=>{
        assert.ok(uiSource.includes('"'+type+'"'),"missing effect "+type);
    });
    ["heal","revive","potion","talisman"].forEach(type=>assert.ok(uiSource.includes('"'+type+'"')));
    assert.match(uiSource,/setTimeout\(\(\)=>\{[\s\S]*?v141-entry-moving[\s\S]*?\},1000\)/);
    assert.match(cssSource,/v141MonsterEnter/);
    assert.match(cssSource,/v141PlayerEnter/);
    assert.match(cssSource,/v141PlayerExit/);
    assert.match(cssSource,/v141MonsterExit/);
    assert.match(cssSource,/data-element="earth"\]\.active-turn::after/);
});

test("battle rewards wait until exit and use one black-gold map toast",()=>{
    assert.match(uiSource,/finishBattleExit/);
    assert.match(uiSource,/setTimeout\(\(\)=>\{[\s\S]*?original\.apply\(context,args\)[\s\S]*?\},2700\)/);
    assert.match(uiSource,/showPage\("map"\)/);
    assert.match(uiSource,/v141-reward-toast/);
    const exitBody=extractFunction(uiSource,"finishBattleExit");
    assert.ok(exitBody.indexOf('suppressLegacyExpToastUntil=Date.now()+5000')<exitBody.indexOf('const result=original.apply(context,args)'));
    assert.match(uiSource,/showPage\("dungeon"\)[\s\S]*?setTimeout\(\(\)=>originalShowRewardModal/);
    assert.match(cssSource,/background:linear-gradient\(160deg,rgba\(34,25,14,.98\)/);
});

test("patrol movement, left task tracker, global tap feedback and red dots are wired",()=>{
    assert.match(uiSource,/distance\/125/);
    assert.match(uiSource,/cubic-bezier\(\.22,\.61,\.36,1\)/);
    assert.match(uiSource,/setPointerCapture/);
    assert.match(uiSource,/mapBattleOverlay/);
    assert.match(uiSource,/v141-tap-ripple/);
    ["homeIconQuest","homeIconAchievement","homeIconOfflineExp","homeIconAnnouncement","dungeonNav"].forEach(id=>assert.ok(uiSource.includes(id)));
    assert.match(cssSource,/image-rendering:auto !important/);
});

test("compact UI and daily cover scaffolding meet the mobile layout requirements",()=>{
    assert.match(cssSource,/\.item-stat-list \*\{\s*font-size:15px !important/);
    assert.match(cssSource,/\.shop-potion-list\{grid-template-columns:repeat\(2/);
    assert.match(cssSource,/\.v141-offline-panel\{display:grid/);
    assert.match(cssSource,/\.v141-dungeon-cover-art\{[\s\S]*?aspect-ratio:16 \/ 9/);
    assert.match(uiSource,/獎勵預覽/);
    assert.match(uiSource,/剩餘次數/);
    assert.match(uiSource,/openMapInventoryOverlay\(\)/);
    assert.match(uiSource,/v141-dungeon-return/);
    assert.match(cssSource,/\.v141-dungeon-active #bottomNav\{display:none !important;\}/);
});

test("new blueprints encode part, tier and series while legacy saves remain selectable",()=>{
    assert.match(v132Source,/const BLUEPRINT_SERIES=\[/);
    assert.match(v132Source,/BLUEPRINT_SERIES\.forEach\(series/);
    assert.match(v132Source,/setId:series\.id/);
    assert.equal(5*4*4,80);
    assert.match(contentSource,/blueprint\.setId\|\|synthesisState\.seriesId/);
    assert.match(contentSource,/由圖紙決定/);
    assert.match(contentSource,/僅舊存檔既有圖紙沒有系列欄位/);
});

test("synthesis implements exact material costs, replacement-only reforge and peak rolls",()=>{
    ["craftGold:500","craftGold:1500","craftGold:4000","craftGold:10000","reforgeGold:1000","reforgeGold:3000","reforgeGold:8000","reforgeGold:20000"].forEach(token=>assert.ok(contentSource.includes(token)));
    assert.match(contentSource,/ConsumeStackItem\(blueprint\.id,50\)/);
    assert.match(contentSource,/ConsumeStackItem\(ore\.id,50\)/);
    assert.match(contentSource,/consumeMatching\([^\n]+,100\)/);
    assert.match(contentSource,/ConsumeStackItem\(ore\.id,100\)/);
    assert.match(contentSource,/item\.reforgeStats=Object\.assign\(\{\},pending\.stats\)/);
    assert.match(contentSource,/Math\.random\(\)<\.10/);
    assert.match(contentSource,/Math\.random\(\)<\.05/);
    assert.match(contentSource,/qty\*3/);
    assert.match(contentSource,/countItem\(fragment\.id\)<qty\*100/);
    assert.match(contentSource,/gold<qty\*500/);
    assert.match(contentSource,/Math\.min\(100,count\)/);
});

test("Abyss has exact five-floor rosters, fixed center support BOSS and click-only final chest",()=>{
    ["東帝","南帝","天帝","北帝","極帝天尊","東帝天尊","南帝天尊","北帝天尊","天帝天尊"].forEach(name=>assert.ok(contentSource.includes(name)));
    ["flyingSandStrike","dustStorm","stoneSlash","explosiveFlurry","dragonSlash","fireRocket","windHowlLightning","stormFlurry","windCrossSlash","floodBeast","frostPunch","waterKnife"].forEach(id=>assert.ok(contentSource.includes(id)));
    assert.match(contentSource,/function openAbyssBossDialogue\(\)/);
    assert.match(contentSource,/const overlay=document\.createElement\("button"\)/);
    assert.match(contentSource,/window\.v141ChallengeAbyssBoss=function\(\)\{\s*return openAbyssBossDialogue\(\);\s*\}/);
    assert.match(contentSource,/if\(spec\[0\]==="極帝天尊"\)/);
    assert.match(contentSource,/v141FormationPosition=position/);
    assert.match(contentSource,/monster\.maxHP\+=extraHp/);
    assert.match(contentSource,/floor<5[\s\S]*?"boss",5000/);
    assert.match(contentSource,/"boss",10000/);
    assert.match(contentSource,/"elite",3500/);
    assert.match(contentSource,/abyssState\.phase="chest"/);
    assert.match(contentSource,/window\.v141OpenAbyssChest=function/);
    assert.match(contentSource,/source\.currentSrc\|\|source\.src/);
});

test("procedural audio is skill-driven and covers the combat sound building blocks",()=>{
    ["swing","hit","damage","heavy","crit","block","dodge","magic","charge","explosion","fire","ice","water","wind","earth","buff","debuff","shield","heal","revive","boss","monster","death"].forEach(kind=>assert.ok(coreSource.includes('case "'+kind+'"')));
    assert.match(coreSource,/playSkill\(skill,name\)/);
    assert.match(coreSource,/skill\.category==="physical"\?"swing":"magic"/);
    assert.match(coreSource,/originalShowShieldAbsorb/);
    assert.match(coreSource,/originalShowMissEffect/);
    assert.doesNotMatch(coreSource,/setFire|setWater|setEarth|setWind/);
});

console.log("\nV141 system expansion suite: "+passed+" tests passed.");
