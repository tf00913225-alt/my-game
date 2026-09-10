"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const mainSource=fs.readFileSync("js/00-main.js","utf8");
const loaderSource=fs.readFileSync("js/20-anonymous-20.js","utf8")+fs.readFileSync("scripts/build-production.mjs","utf8");
const v131Source=fs.readFileSync("js/25-v131-fix-batch.js","utf8");
const v132Source=fs.readFileSync("js/27-v132-content-expansion.js","utf8");
const v133Source=fs.readFileSync("js/28-v133-economy-rebalance.js","utf8");
const v136Source=fs.readFileSync("js/31-v136-auto-battle-fix.js","utf8");
const indexSource=fs.readFileSync("index.html","utf8");

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
            if(char==="*" && next==="/"){
                blockComment=false;
                i++;
            }
            continue;
        }
        if(quote){
            if(escaped){ escaped=false; continue; }
            if(char==="\\"){ escaped=true; continue; }
            if(char===quote){ quote=null; }
            continue;
        }
        if(char==="/" && next==="/"){
            lineComment=true;
            i++;
            continue;
        }
        if(char==="/" && next==="*"){
            blockComment=true;
            i++;
            continue;
        }
        if(char==='"' || char==="'" || char==="`"){
            quote=char;
            continue;
        }
        if(char==="{"){ depth++; }
        if(char==="}"){
            depth--;
            if(depth===0){ return source.slice(start,i+1); }
        }
    }
    throw new Error("函式括號不完整："+name);
}

function makeContext(values={}){
    const context=vm.createContext({
        console,
        Math,
        Number,
        String,
        Object,
        Array,
        Infinity,
        ...values
    });
    return context;
}

let passed=0;
function test(name,fn){
    try{
        fn();
        passed++;
        console.log("✓ "+name);
    }catch(error){
        console.error("✗ "+name);
        throw error;
    }
}

test("runtime patches keep deterministic execution order without an HTTP waterfall",()=>{
    const manifest=JSON.parse(fs.readFileSync("asset-manifest.json","utf8"));
    const gameplayUrl=manifest.featureManifest.bundles["gameplay-core"].scripts[0];
    const bundle=fs.readFileSync(gameplayUrl,"utf8");
    const expected=[
        "js/25-v131-fix-batch.js","js/27-v132-content-expansion.js","js/28-v133-economy-rebalance.js",
        "js/29-v134-fixes.js","js/30-v135-fixes.js","js/31-v136-auto-battle-fix.js",
        "js/32-v139-rested-experience.js","js/33-v140-four-element-balance.js","js/34-v141-core-systems.js",
        "js/35-v141-ui-battle.js","js/36-v141-content-systems.js","js/37-v142-skill-animation.js",
        "js/38-v143-system-fixes.js","js/39-v143-skill-animation.js","js/40-v144-rules-and-abyss.js",
        "js/41-v146-system-polish.js","js/42-v148-combat-dungeon-fixes.js","js/43-v149-skill-ui-rules.js",
        "js/44-v152-dev-fixes.js","js/45-v154-dev-fixes.js","js/46-v155-dev-fixes.js",
        "js/47-v158-combat-tuning.js","js/48-v159-abyss-battle-portraits.js",
        "js/49-v169-element-box-settings.js","js/50-v169-water-skill-rules.js","js/51-v169-rpg-ui.js"
    ];
    let cursor=-1;
    for(const file of expected){
        const next=bundle.indexOf("bundled source: "+file);
        assert.ok(next>cursor,file+" must execute after its predecessor inside one bundle");
        cursor=next;
    }
    assert.doesNotMatch(loaderSource,/loadVersionedRuntimePatchesInOrder|createElement\(["']script["']\)/);
});

test("EXP preview uses the V133 curve and refuses levels above 100",()=>{
    const context=makeContext({
        window:{
            v133MaxLevel:100,
            v133GetExpNextForLevel:level=>Math.round(400*Math.pow(level,2.5))
        }
    });
    vm.runInContext(extractFunction(v131Source,"previewCostForCharacter"),context);

    const level10Cost=Math.round(400*Math.pow(10,2.5));
    const level11Cost=Math.round(400*Math.pow(11,2.5));
    const actual=vm.runInContext(
        `previewCostForCharacter({level:10,exp:100,expNext:${level10Cost}},2)`,
        context
    );
    assert.equal(actual,(level10Cost-100)+level11Cost);
    assert.equal(
        vm.runInContext("previewCostForCharacter({level:100,exp:0,expNext:1},1)",context),
        Infinity
    );
});

test("generic inventory additions never partially mutate a full backpack",()=>{
    const context=makeContext({
        inventoryItems:[],
        INVENTORY_MAX_STACK_DEFAULT:100,
        isEquipmentInventoryType:type=>type==="weapon",
        cloneInventoryStackItem:(item,count)=>({...item,stats:{...(item.stats||{})},count})
    });
    [
        "getItemInventoryCapacity",
        "canAddItemToInventory",
        "addItemToInventory",
        "cloneInventorySnapshot",
        "restoreInventorySnapshot",
        "runInventoryTransaction",
        "consumeStackItem"
    ].forEach(name=>vm.runInContext(extractFunction(v132Source,name),context));

    context.inventoryItems=Array.from({length:119},(_,i)=>({id:"filler"+i,count:1,type:"material",stats:{}}));
    assert.equal(
        vm.runInContext("addItemToInventory({id:'sword',type:'weapon',stats:{}},2)",context),
        false
    );
    assert.equal(context.inventoryItems.length,119);

    context.inventoryItems=[
        {id:"ore",count:99,type:"material",stats:{}},
        ...Array.from({length:119},(_,i)=>({id:"full"+i,count:1,type:"material",stats:{}}))
    ];
    assert.equal(vm.runInContext("addItemToInventory({id:'ore',type:'material',stats:{}},2)",context),false);
    assert.equal(context.inventoryItems[0].count,99);

    context.inventoryItems=[
        {id:"ticket",count:2,type:"ticket",stats:{}},
        ...Array.from({length:119},(_,i)=>({id:"slot"+i,count:1,type:"material",stats:{}}))
    ];
    const transactionResult=vm.runInContext(
        "runInventoryTransaction(()=>consumeStackItem('ticket',1) && addItemToInventory({id:'reward',type:'weapon',stats:{}},1))",
        context
    );
    assert.equal(transactionResult,false);
    assert.equal(context.inventoryItems.length,120);
    assert.equal(context.inventoryItems.find(item=>item.id==="ticket").count,2);
});

test("daily dungeon date follows local midnight instead of UTC",()=>{
    class FakeDate extends Date{
        constructor(){ super("2026-08-27T16:30:00.000Z"); }
        getFullYear(){ return 2026; }
        getMonth(){ return 7; }
        getDate(){ return 28; }
    }
    const context=makeContext({Date:FakeDate});
    vm.runInContext(extractFunction(v132Source,"todayString"),context);
    assert.equal(vm.runInContext("todayString()",context),"2026-08-28");
});

test("formal daily dungeons unlock when any actual character reaches Lv10",()=>{
    const context=makeContext({players:[]});
    context.getExistingPartyIndexes=()=>context.players.map((_,index)=>index);
    context.getPartyCharacterByIndex=index=>context.players[index];
    vm.runInContext(extractFunction(v132Source,"hasLevel10CharacterForDailyDungeon"),context);

    context.players=[];
    assert.equal(vm.runInContext("hasLevel10CharacterForDailyDungeon()",context),false);
    context.players=[{level:9},{level:1}];
    assert.equal(vm.runInContext("hasLevel10CharacterForDailyDungeon()",context),false);
    context.players=[{level:10}];
    assert.equal(vm.runInContext("hasLevel10CharacterForDailyDungeon()",context),true);
    context.players=[{level:1},{level:10}];
    assert.equal(vm.runInContext("hasLevel10CharacterForDailyDungeon()",context),true);
});

test("auto tri-targeting chooses the center that hits three of six monsters",()=>{
    const character={id:"測試角色",hp:100,sp:100};
    const monsters=Array.from({length:6},(_,index)=>({id:index,alive:true}));
    const queuedPlayerActions={};
    const context=makeContext({
        battleActive:true,
        autoBattle:true,
        battleToken:9,
        currentBattleMonsters:[0,1,2,3,4,5],
        monsters,
        queuedPlayerActions,
        skillDatabase:{triSkill:{id:"triSkill",targetType:"tri",category:"physical",spCost:10}},
        getPartyCharacterByIndex:()=>character,
        getPartyAutoConfig:()=>({enabled:true,skill:"triSkill"}),
        getPartyCharacterKey:()=>"fire",
        getSkillLevel:()=>1,
        getSkillTargets:center=>{
            const row=center<3 ? [0,1,2] : [3,4,5];
            const position=row.indexOf(center);
            return row.slice(Math.max(0,position-1),Math.min(row.length,position+2));
        },
        checkBattleEnd:()=>false,
        updateUI:()=>{},
        finishPlayerAction:()=>{}
    });
    vm.runInContext(extractFunction(mainSource,"autoActionForCharacter"),context);
    vm.runInContext("autoActionForCharacter(0,9)",context);
    assert.equal(queuedPlayerActions[0].target,1);
    assert.equal(queuedPlayerActions[0].action,"triSkill");
});

test("third-character level-up reads player3 equipment instead of player2",()=>{
    const player={id:"主角"};
    const player3={
        id:"三號",
        level:1,
        exp:100,
        expNext:100,
        attributePoints:0,
        skillPoints:0,
        bonusHP:0,
        bonusSP:0,
        vitality:0,
        energy:0,
        hp:999,
        sp:999
    };
    let equipmentKey=null;
    const context=makeContext({
        player,
        player3,
        getPartyCharacterIndex:character=>character===player3 ? 2 : 0,
        getPartyCharacterKey:index=>index===2 ? "player3" : "fire",
        getEquipmentBonus:key=>{
            equipmentKey=key;
            return {
                maxHP:key==="player3" ? 200 : 0,
                maxSP:key==="player3" ? 100 : 0,
                vitality:0,
                energy:0
            };
        },
        getMainCharacterStats:()=>({maxHP:100,maxSP:50}),
        showLevelUpToast:()=>{},
        refreshCharacterAvatarLevels:()=>{},
        saveGame:()=>{},
        updateUI:()=>{}
    });
    vm.runInContext(extractFunction(mainSource,"checkLevelUp"),context);
    vm.runInContext("checkLevelUp(player3)",context);
    assert.equal(equipmentKey,"player3");
    assert.equal(player3.level,2);
    assert.equal(player3.hp,330);
    assert.equal(player3.sp,160);
});

test("auto battle keeps a valid selected skill instead of silently queuing normal attack",()=>{
    const character={id:"技能測試",hp:100,sp:50};
    const config={enabled:true,skill:"fireBall"};
    const queuedPlayerActions={};
    const notices=[];
    const document={
        getElementById:()=>null,
        addEventListener:()=>{}
    };
    const context=makeContext({
        document,
        skillDatabase:{
            fireBall:{name:"火球術",category:"magic",spCost:10,targetType:"single"}
        },
        characterSkillLoadouts:{fire:{equippedSkills:["fireBall"]}},
        queuedPlayerActions,
        battleActive:true,
        autoBattle:true,
        battleToken:5,
        getPartyCharacterByIndex:()=>character,
        getPartyAutoConfig:()=>config,
        getPartyCharacterKey:()=>"fire",
        getSkillLevel:()=>1,
        saveGame:()=>{},
        addBattleLog:message=>notices.push(message),
        autoActionForCharacter:index=>{
            queuedPlayerActions[index]={action:"normal",target:0};
        }
    });
    context.window=context;

    vm.runInContext(v136Source,context);
    vm.runInContext("autoActionForCharacter(0,5)",context);

    assert.equal(queuedPlayerActions[0].action,"fireBall");
    assert.match(notices.join("\n"),/錯誤排成普通攻擊，已自動校正/);
    assert.equal(vm.runInContext("v136GetAutoBattleDecision(0).kind",context),"skill");
});

test("V137 regressions remain wired through the current deployed entry points",()=>{
    const manifest=JSON.parse(fs.readFileSync("asset-manifest.json","utf8"));
    const appBundle=fs.readFileSync(manifest.featureManifest.bundles["app-shell"].scripts[0],"utf8");
    assert.match(indexSource,/build\/boot-core\.[0-9a-f]{12}\.js/);
    assert.match(appBundle,/bundled source: js\/00-main\.js/);
    assert.match(appBundle,/bundled source: js\/20-anonymous-20\.js/);
    assert.match(loaderSource,/const V_ASSET_VERSION="173\.64"/);
    assert.match(v133Source,/const MAX_CHARACTER_LEVEL=100/);
    assert.doesNotMatch(mainSource,/safeBind\(\s*["'](?:autoEnabled|autoSkillHome|hpUsePctHome|spUsePctHome)/);
    assert.doesNotMatch(v132Source,/const result=originalLoseBattle\.apply/);
    assert.match(v132Source,/材料寶箱未消耗/);
    assert.match(v132Source,/抽獎券未消耗/);
});

console.log("\nV137 regression suite: "+passed+" tests passed.");
