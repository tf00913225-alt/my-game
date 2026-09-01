"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const source=fs.readFileSync("js/45-v154-dev-fixes.js","utf8");
const css=fs.readFileSync("css/46-v154-dev-fixes.css","utf8");
const abyss=fs.readFileSync("js/36-v141-content-systems.js","utf8");
const loader=fs.readFileSync("js/20-anonymous-20.js","utf8");
const index=fs.readFileSync("index.html","utf8");

let passed=0;
function test(name,handler){
    handler();
    passed++;
    console.log("✓ "+name);
}

function classList(){
    return {toggle(){}};
}

function element(){
    return {
        classList:classList(),style:{setProperty(){},removeProperty(){}},dataset:{},
        setAttribute(){},textContent:""
    };
}

function loadRuntime(overrides={}){
    const button=element();
    const battlePage=element();
    const document={
        getElementById(id){
            if(id==="autoBattleButton"){ return button; }
            if(id==="battlePage"){ return battlePage; }
            return null;
        }
    };
    const context=Object.assign({
        window:null,document,console,Math,Number,Object,Array,Set,Map,Promise,
        currentBattleMonsters:[],monsters:[],autoBattle:false,
        updateAutoButton(){},openAutoBattleSettings(){},
        applyPostBattleAutoRecovery(){},confirmAutoBattleSettings(){},toggleAutoBattle(){}
    },overrides);
    context.window=context;
    vm.createContext(context);
    vm.runInContext(source,context);
    return context;
}

test("the current cache key delivers the repaired runtime and CSS",()=>{
    assert.match(loader,/const V_ASSET_VERSION="173\.20"/);
    assert.match(index,/js\/20-anonymous-20\.js\?v=173\.20/);
    assert.match(loader,/css\/46-v154-dev-fixes\.css/);
    assert.match(loader,/js\/45-v154-dev-fixes\.js/);
});

test("an active element box heals the whole party even when a stale character flag is false",()=>{
    const characters=[
        {id:"測火",hp:20,sp:100},
        {id:"測水",hp:20,sp:100},
        {id:"測風",hp:20,sp:100}
    ];
    let potions=5;
    let baseCalls=0;
    const context=loadRuntime({
        v131GetElementBoxState:()=>({active:true,remainingMs:1000}),
        applyPostBattleAutoRecovery(){ baseCalls++; },
        getExistingPartyIndexes:()=>[0,1,2],
        getPartyCharacterByIndex:index=>characters[index],
        getPartyAutoConfig:()=>({enabled:false,hp:50,sp:25}),
        getPartyBattleStats:()=>({maxHP:100,maxSP:100}),
        normalizeAutoBattleThreshold:value=>Number(value),
        getAutoPotionId:resource=>resource==="hp"&&potions>0?"hpPotion10":null,
        getPotionDefinition:id=>id?{name:"回復10%HP藥水",recoveryPercent:10}:null,
        consumePotionFromInventory(){ if(potions<=0){ return false; } potions--; return true; },
        rebuildInventorySlots(){},addBattleLog(){}
    });

    context.applyPostBattleAutoRecovery();
    assert.equal(baseCalls,1);
    assert.deepEqual(characters.map(character=>character.hp),[40,40,30]);
    assert.equal(potions,0);
});

test("an inactive element box does not bypass a disabled character setting",()=>{
    const character={id:"測火",hp:20,sp:100};
    let consumed=0;
    const context=loadRuntime({
        autoBattle:true,
        v131GetElementBoxState:()=>({active:false,remainingMs:1000}),
        getExistingPartyIndexes:()=>[0],
        getPartyCharacterByIndex:()=>character,
        getPartyAutoConfig:()=>({enabled:false,hp:50,sp:25}),
        getPartyBattleStats:()=>({maxHP:100,maxSP:100}),
        normalizeAutoBattleThreshold:value=>Number(value),
        getAutoPotionId:()=>"hpPotion10",
        getPotionDefinition:()=>({name:"回復10%HP藥水",recoveryPercent:10}),
        consumePotionFromInventory(){ consumed++; return true; }
    });

    context.applyPostBattleAutoRecovery();
    assert.equal(character.hp,20);
    assert.equal(consumed,0);
});

test("every Abyss map floor presents a portrait-backed challenge button",()=>{
    [
        "east-emperor.webp","south-emperor.webp","heaven-emperor.webp",
        "north-emperor.webp","floor5-extreme-emperor.webp"
    ].forEach((asset,index)=>{
        assert.match(css,new RegExp("floor-"+(index+1)+"[\\s\\S]*"+asset.replace(".","\\.")));
    });
    assert.match(css,/\.v141-abyss-boss\{[\s\S]*width:120px !important;[\s\S]*height:168px !important;/);
    assert.match(css,/\.v141-abyss-boss::before\{[\s\S]*background-size:contain !important;/);
    assert.match(css,/touch-action:manipulation !important/);
    assert.match(abyss,/<button type="button" class="v141-abyss-boss"[\s\S]*data-abyss-boss-control="true"[\s\S]*v141HandleAbyssBossInteraction\(event\)/);
});

test("all map portrait assets exist on dev",()=>{
    [
        "east-emperor.webp","south-emperor.webp","heaven-emperor.webp",
        "north-emperor.webp","floor5-extreme-emperor.webp"
    ].forEach(name=>assert.equal(fs.existsSync("assets/dungeons/abyss/"+name),true,name));
});

console.log("\nV156 deep-trace fixes suite: "+passed+" tests passed.");
