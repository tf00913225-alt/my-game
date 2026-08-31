"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const {execFileSync}=require("node:child_process");

const source=fs.readFileSync("js/45-v154-dev-fixes.js","utf8");
const css=fs.readFileSync("css/46-v154-dev-fixes.css","utf8");
const loader=fs.readFileSync("js/20-anonymous-20.js","utf8");
const index=fs.readFileSync("index.html","utf8");
const characterRuntime=fs.readFileSync("js/19-stage-v78-character-inventory-runtime.js","utf8");

let passed=0;
function test(name,handler){
    handler();
    passed++;
    console.log("✓ "+name);
}

function classList(){
    const values=new Set();
    return {
        toggle(name,force){
            const enabled=force===undefined?!values.has(name):!!force;
            if(enabled){ values.add(name); }else{ values.delete(name); }
            return enabled;
        },
        contains(name){ return values.has(name); }
    };
}

function style(){
    const values={};
    return {
        setProperty(name,value){ values[name]=value; },
        removeProperty(name){ delete values[name]; },
        getPropertyValue(name){ return values[name]||""; }
    };
}

function element(){
    const node={
        className:"",classList:classList(),style:style(),dataset:{},attributes:{},textContent:"",
        children:[],parentNode:null,src:"",
        setAttribute(name,value){ this.attributes[name]=String(value); },
        appendChild(child){ child.parentNode=this; this.children.push(child); return child; },
        insertBefore(child,before){
            child.parentNode=this;
            const index=this.children.indexOf(before);
            if(index<0){ this.children.push(child); }
            else{ this.children.splice(index,0,child); }
            return child;
        },
        removeChild(child){
            this.children=this.children.filter(item=>item!==child);
            child.parentNode=null;
        },
        remove(){ if(this.parentNode){ this.parentNode.removeChild(this); } },
        querySelector(selector){
            if(!selector.startsWith(".")){ return null; }
            const name=selector.slice(1);
            return this.children.find(child=>String(child.className||"").split(/\s+/).includes(name))||null;
        }
    };
    Object.defineProperty(node,"firstChild",{get(){ return this.children[0]||null; }});
    return node;
}

function loadRuntime(overrides={}){
    const button=element();
    const battlePage=element();
    const body=element();
    const cards=Array.from({length:10},()=>element());
    const document={
        body,
        createElement(){ return element(); },
        getElementById(id){
            if(id==="autoBattleButton"){ return button; }
            if(id==="battlePage"){ return battlePage; }
            const match=/^battleMonster(\d+)$/.exec(id);
            return match?cards[Number(match[1])]||null:null;
        }
    };
    const context=Object.assign({
        window:null,document,console,Math,Number,Object,Array,Set,Map,Promise,
        currentBattleMonsters:[],monsters:[],autoBattle:false,
        updateAutoButton(){},openAutoBattleSettings(){},closeAutoBattleSettings(){},
        openHomeFeature(){},closeHomeFeature(){},
        applyPostBattleAutoRecovery(){},
        confirmAutoBattleSettings(){},toggleAutoBattle(){}
    },overrides);
    context.window=context;
    vm.createContext(context);
    vm.runInContext(source,context);
    return {context,button,battlePage,body,cards};
}

test("V154 remains ordered immediately before V155",()=>{
    assert.match(loader,/const V_ASSET_VERSION="173\.8"/);
    assert.match(index,/js\/20-anonymous-20\.js\?v=173\.8/);
    assert.match(index,/js\/19-stage-v78-character-inventory-runtime\.js\?v=173\.8/);
    assert.match(loader,/css\/46-v154-dev-fixes\.css/);
    assert.ok(loader.indexOf("js/45-v154-dev-fixes.js")>loader.indexOf("js/44-v152-dev-fixes.js"));
    assert.ok(loader.indexOf("js/46-v155-dev-fixes.js")>loader.indexOf("js/45-v154-dev-fixes.js"));
});

test("element box uses the top apply-and-start action and removes the bottom action row",()=>{
    let confirmations=0;
    const runtime=loadRuntime({confirmAutoBattleSettings(){ confirmations++; }});
    assert.equal(runtime.button.textContent,"套用並啟動");
    assert.equal(runtime.button.attributes.onclick,"v154UseElementBoxPrimaryAction()");
    runtime.context.v154UseElementBoxPrimaryAction();
    assert.equal(confirmations,1);
    assert.match(css,/v131-element-box-panel \.auto-settings-actions\s*\{\s*display:none !important/);
});

test("element box settings temporarily rise above document-level skill effects",()=>{
    const runtime=loadRuntime();
    runtime.context.openHomeFeature("autoBattleSettings");
    assert.equal(runtime.body.classList.contains("v162-element-box-settings-open"),true);
    runtime.context.closeHomeFeature();
    assert.equal(runtime.body.classList.contains("v162-element-box-settings-open"),false);
    runtime.context.openAutoBattleSettings();
    assert.equal(runtime.body.classList.contains("v162-element-box-settings-open"),true);
    runtime.context.closeAutoBattleSettings();
    assert.equal(runtime.body.classList.contains("v162-element-box-settings-open"),false);
    assert.match(css,/v162-element-box-settings-open #game-stage\{[\s\S]*?z-index:2147483644 !important/);
    assert.match(css,/v162-element-box-settings-open #homeFeatureModal,[\s\S]*?z-index:2147483645 !important/);
});

test("automatic recovery keeps using potions until the configured threshold is cleared",()=>{
    const character={id:"測火",hp:10,sp:100};
    let potions=10;
    let baseCalls=0;
    const runtime=loadRuntime({
        applyPostBattleAutoRecovery(){ character.hp+=10; potions--; baseCalls++; },
        getExistingPartyIndexes:()=>[0],
        getPartyCharacterByIndex:()=>character,
        getPartyAutoConfig:()=>({enabled:true,hp:50,sp:25}),
        getPartyBattleStats:()=>({maxHP:100,maxSP:100}),
        normalizeAutoBattleThreshold:value=>Number(value),
        getAutoPotionId:resource=>resource==="hp"&&potions>0?"hpPotion10":null,
        getPotionDefinition:id=>id?{name:"小型生命藥水",recoveryPercent:10}:null,
        consumePotionFromInventory(){ if(potions<=0){ return false; } potions--; return true; },
        rebuildInventorySlots(){},addBattleLog(){}
    });
    runtime.context.applyPostBattleAutoRecovery();
    assert.equal(baseCalls,1);
    assert.equal(character.hp,60);
    assert.equal(potions,5);
});

test("Abyss floors 1 to 4 and floor 5 receive their exact portrait sets",()=>{
    const earlyBosses={
        東帝:"east-emperor.webp",南帝:"south-emperor.webp",
        天帝:"heaven-emperor.webp",北帝:"north-emperor.webp"
    };
    Object.entries(earlyBosses).forEach(([bossName,asset])=>{
        const names=[bossName,"天兵天將","天兵天將","天兵天將","天兵天將"];
        const early=loadRuntime({
            currentBattleMonsters:[0,1,2,3,4],
            monsters:names.map(name=>({name,v141Abyss:true}))
        });
        early.context.v154SyncAbyssPortraits();
        assert.ok(early.cards[0].style.getPropertyValue("--v152-abyss-portrait").endsWith(asset+'")'));
        assert.match(early.cards[1].style.getPropertyValue("--v152-abyss-portrait"),/soldier\.webp/);
        assert.ok(early.cards[0].querySelector(".v162-abyss-battle-portrait-art").src.endsWith(asset));
        assert.ok(early.cards[1].querySelector(".v162-abyss-battle-portrait-art").src.endsWith("soldier.webp"));
        assert.equal(early.cards[0].dataset.abyssPortrait,"floor1-4");
    });

    const finalNames=[
        "東帝天尊","天帝天尊","極帝天尊","北帝天尊","南帝天尊",
        "天兵天將","天兵天將","天兵天將","天兵天將","天兵天將"
    ];
    const final=loadRuntime({
        currentBattleMonsters:finalNames.map((_,index)=>index),
        monsters:finalNames.map(name=>({name,v141Abyss:true}))
    });
    final.context.v154SyncAbyssPortraits();
    const expected=[
        "floor5-east-emperor.webp","floor5-heaven-emperor.webp",
        "floor5-extreme-emperor.webp","floor5-north-emperor.webp",
        "floor5-south-emperor.webp","floor5-soldier.webp"
    ];
    expected.forEach((asset,index)=>assert.ok(
        final.cards[index].style.getPropertyValue("--v152-abyss-portrait").endsWith(asset+'")')
    ));
    expected.forEach((asset,index)=>assert.ok(
        final.cards[index].querySelector(".v162-abyss-battle-portrait-art").src.endsWith(asset)
    ));
    assert.equal(final.cards[0].dataset.abyssPortrait,"floor5");
    assert.equal(final.battlePage.classList.contains("v154-abyss-final"),true);
});

test("all six supplied floor 5 portraits are optimized at the source dimensions",()=>{
    ["east-emperor","heaven-emperor","north-emperor","south-emperor","extreme-emperor","soldier"].forEach(name=>{
        const file="assets/dungeons/abyss/floor5-"+name+".webp";
        assert.equal(fs.existsSync(file),true,file);
        const geometry=execFileSync("identify",["-format","%wx%h",file],{encoding:"utf8"});
        assert.equal(geometry,"1152x1536",file);
    });
});

test("equipment cover, ability scrolling and Abyss decluttering stay scoped",()=>{
    assert.match(css,/data-dungeon-cover="equipment"[\s\S]*?background-size:cover !important/);
    assert.match(css,/#characterTabContent\{[\s\S]*?overflow-y:auto !important/);
    assert.match(characterRuntime,/bodyRect\.bottom-rootRect\.top-10/);
    assert.match(css,/v141-abyss-intro:not\(\.complete\)[\s\S]*?justify-content:flex-end !important/);
    assert.match(css,/v141-abyss-shell > header\{[\s\S]*?position:absolute !important/);
    assert.match(css,/v154-abyss-portrait[\s\S]*?var\(--v152-abyss-portrait\)/);
    assert.match(css,/v162-abyss-battle-portrait-art\{[\s\S]*?object-fit:cover !important/);
});

console.log("\nV154 current request suite: "+passed+" tests passed.");
