"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const source=fs.readFileSync("js/45-v154-dev-fixes.js","utf8");
const timingSource=fs.readFileSync("js/48-v159-abyss-battle-portraits.js","utf8");
const battlefieldCss=fs.readFileSync("css/fixed-slot-battlefield-rendering-v2.css","utf8");

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
        setProperty(name,value){ values[name]=String(value); },
        removeProperty(name){ delete values[name]; },
        getPropertyValue(name){ return values[name]||""; }
    };
}

function element(){
    const node={
        className:"",classList:classList(),style:style(),dataset:{},attributes:{},children:[],parentNode:null,
        textContent:"",src:"",id:"",
        setAttribute(name,value){ this.attributes[name]=String(value); },
        appendChild(child){ child.parentNode=this; this.children.push(child); return child; },
        insertBefore(child,before){
            child.parentNode=this;
            const index=this.children.indexOf(before);
            if(index<0){ this.children.push(child); }
            else{ this.children.splice(index,0,child); }
            return child;
        },
        removeChild(child){ this.children=this.children.filter(item=>item!==child); child.parentNode=null; },
        remove(){ if(this.parentNode){ this.parentNode.removeChild(this); } },
        querySelector(selector){
            if(!selector.startsWith(".")){ return null; }
            const className=selector.slice(1);
            return this.children.find(child=>String(child.className||"").split(/\s+/).includes(className))||null;
        }
    };
    Object.defineProperty(node,"firstChild",{get(){ return this.children[0]||null; }});
    return node;
}

function loadRuntime(monsterRows){
    const cards=Array.from({length:12},()=>element());
    const body=element();
    const head=element();
    const battlePage=element();
    const button=element();
    const document={
        body,head,readyState:"complete",
        createElement(){ return element(); },
        getElementById(id){
            if(id==="battlePage"){ return battlePage; }
            if(id==="autoBattleButton"){ return button; }
            const match=/^battleMonster(\d+)$/.exec(id);
            return match?cards[Number(match[1])]||null:null;
        }
    };
    const context={
        window:null,document,console,Math,Number,Object,Array,Set,Map,Promise,
        currentBattleMonsters:monsterRows.map((_,index)=>index),monsters:monsterRows,autoBattle:false,
        updateAutoButton(){},openAutoBattleSettings(){},closeAutoBattleSettings(){},
        openHomeFeature(){},closeHomeFeature(){},applyPostBattleAutoRecovery(){},
        confirmAutoBattleSettings(){},toggleAutoBattle(){}
    };
    context.window=context;
    vm.createContext(context);
    vm.runInContext(source,context);
    return {context,cards,battlePage,monsters:monsterRows};
}

const registry={
    tupleSchema:["portraitKey","name","element","rank","sizeClass","path","status"],
    groups:{
        wild:[
            ["wild.zone-01.fire-01","哥布林","fire","regular","standard","assets/monsters/wild/zone-01/fire-01.png","existing"],
            ["wild.zone-01.water-01","史萊姆","water","regular","standard","assets/monsters/wild/zone-01/water-01.png","planned"]
        ],
        "heavenly-soldier":[
            ["soldier.fire","天兵天將","fire","regular","standard","assets/monsters/soldiers/heavenly-soldier-fire.png","existing"],
            ["soldier.water","天兵天將","water","regular","standard","assets/monsters/soldiers/heavenly-soldier-water.png","existing"],
            ["soldier.wind","天兵天將","wind","regular","standard","assets/monsters/soldiers/heavenly-soldier-wind.png","existing"],
            ["soldier.earth","天兵天將","earth","regular","standard","assets/monsters/soldiers/heavenly-soldier-earth.png","existing"]
        ],
        "abyss-boss":[
            ["abyss.final.east","東帝天尊","earth","boss","boss","assets/dungeons/abyss/floor5-east-emperor.webp","existing"],
            ["abyss.final.heaven","天帝天尊","wind","boss","boss","assets/dungeons/abyss/floor5-heaven-emperor.webp","existing"],
            ["abyss.final.extreme","極帝天尊","light","boss","boss","assets/dungeons/abyss/floor5-extreme-emperor.webp","existing"],
            ["abyss.final.north","北帝天尊","water","boss","boss","assets/dungeons/abyss/floor5-north-emperor.webp","existing"],
            ["abyss.final.south","南帝天尊","fire","boss","boss","assets/dungeons/abyss/floor5-south-emperor.webp","existing"]
        ]
    }
};

{
    const runtime=loadRuntime([{name:"哥布林",element:"fire"},{name:"史萊姆",element:"water"}]);
    runtime.context.v154InstallMonsterPortraitRegistry(registry);
    runtime.context.v154SyncMonsterPortraits();
    assert.equal(runtime.context.resolveMonsterPortrait(runtime.context.monsters[0]),"assets/monsters/wild/zone-01/fire-01.png");
    assert.equal(runtime.context.resolveMonsterPortrait(runtime.context.monsters[1]),"assets/dungeons/abyss/soldier.webp");
    assert.equal(runtime.cards[0].dataset.monsterPortraitKey,"wild.zone-01.fire-01");
    assert.equal(runtime.cards[1].dataset.monsterPortraitKey,"temporary.heavenly-soldier");
}

{
    const runtime=loadRuntime(["water","earth","fire","wind","water"].map(element=>({
        name:"天兵天將",element,v141Abyss:true
    })));
    runtime.context.v154InstallMonsterPortraitRegistry(registry);
    runtime.context.v154SyncMonsterPortraits();
    assert.deepEqual(runtime.cards.slice(0,5).map(card=>card.dataset.monsterPortraitKey),
        ["soldier.water","soldier.earth","soldier.fire","soldier.wind","soldier.water"]);
}

{
    const names=["東帝天尊","天帝天尊","極帝天尊","北帝天尊","南帝天尊"];
    const runtime=loadRuntime(names.map((name,index)=>({name,element:["earth","wind","light","water","fire"][index],rank:"boss",v141Abyss:true})));
    runtime.context.v154InstallMonsterPortraitRegistry(registry);
    runtime.context.v154SyncMonsterPortraits();
    assert.deepEqual(runtime.cards.slice(0,5).map(card=>card.dataset.monsterPortraitKey),[
        "abyss.final.east","abyss.final.heaven","abyss.final.extreme","abyss.final.north","abyss.final.south"]);
    assert.deepEqual(runtime.monsters.map(monster=>runtime.context.resolveMonsterPortrait(monster)),[
        "assets/dungeons/abyss/floor5-east-emperor.webp",
        "assets/dungeons/abyss/floor5-heaven-emperor.webp",
        "assets/dungeons/abyss/floor5-extreme-emperor.webp",
        "assets/dungeons/abyss/floor5-north-emperor.webp",
        "assets/dungeons/abyss/floor5-south-emperor.webp"]);
}

{
    const runtime=loadRuntime([{name:"天兵天將",element:"light",v141Abyss:true}]);
    runtime.context.v154InstallMonsterPortraitRegistry(registry);
    runtime.context.v154SyncMonsterPortraits();
    assert.equal(runtime.context.resolveMonsterPortrait(runtime.context.monsters[0]),"assets/dungeons/abyss/soldier.webp");
    assert.equal(runtime.cards[0].dataset.monsterPortraitKey,"legacy.abyss.天兵天將");
}

assert.match(source,/MONSTER_PORTRAIT_REGISTRY_URL="config\/monster-portrait-registry\.json"/);
assert.match(source,/TEMPORARY_MONSTER_PORTRAIT="assets\/dungeons\/abyss\/soldier\.webp"/);
assert.match(source,/TEMPORARY_BOSS_PORTRAIT="assets\/monsters\/boss\/boss-placeholder-fire-demon\.webp"/);
assert.match(source,/target\.status!=="existing"/);
assert.doesNotMatch(source,/background-size:contain!important/,
    "portrait selection runtime must not inject a second geometry owner");
assert.match(battlefieldCss,/\.v174-battle-art\{[\s\S]*background-size:contain !important/,
    "the canonical Fixed Slot stylesheet owns no-crop portrait geometry");
assert.equal((source.match(/renderBattle=function/g)||[]).length,1);
assert.equal((source.match(/updateMonsterUI=function/g)||[]).length,1);
assert.match(timingSource,/v154SyncMonsterPortraits/);

console.log("Monster portrait runtime tests passed.");
