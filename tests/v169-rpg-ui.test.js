"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const uiSource=fs.readFileSync("js/51-v169-rpg-ui.js","utf8");
const css=fs.readFileSync("css/49-v169-rpg-ui.css","utf8");
const mainSource=fs.readFileSync("js/00-main.js","utf8");
const layoutSource=fs.readFileSync("js/19-stage-v78-character-inventory-runtime.js","utf8");
const loaderSource=fs.readFileSync("js/20-anonymous-20.js","utf8");
const indexSource=fs.readFileSync("index.html","utf8");
const confirmSources=[
    "js/00-main.js",
    "js/25-v131-fix-batch.js",
    "js/27-v132-content-expansion.js",
    "js/35-v141-ui-battle.js",
    "js/36-v141-content-systems.js"
].map(file=>[file,fs.readFileSync(file,"utf8")]);

let passed=0;
function test(name,handler){
    handler();
    passed++;
    console.log("✓ "+name);
}

function fakeClassList(){
    const values=new Set();
    return {
        add(...names){ names.forEach(name=>values.add(name)); },
        remove(...names){ names.forEach(name=>values.delete(name)); },
        contains(name){ return values.has(name); },
        toggle(name,force){
            const enabled=force===undefined?!values.has(name):!!force;
            if(enabled){ values.add(name); }else{ values.delete(name); }
            return enabled;
        }
    };
}

function loadDialogRuntime(){
    const created=[];
    const document={
        activeElement:null,
        body:null,
        createElement(tagName){
            const listeners={};
            const node={
                tagName:String(tagName).toUpperCase(),
                id:"",className:"",dataset:{},attributes:{},children:[],
                parentNode:null,isConnected:false,hidden:false,textContent:"",
                classList:fakeClassList(),
                setAttribute(name,value){ this.attributes[name]=String(value); },
                addEventListener(type,handler){ listeners[type]=handler; },
                appendChild(child){
                    this.children.push(child);
                    child.parentNode=this;
                    child.isConnected=this.isConnected;
                    return child;
                },
                append(...children){ children.forEach(child=>this.appendChild(child)); },
                focus(){ document.activeElement=this; },
                dispatch(type,event={}){
                    if(listeners[type]){ listeners[type](event); }
                },
                querySelector(){ return null; },
                querySelectorAll(){ return []; }
            };
            created.push(node);
            return node;
        },
        getElementById(){ return null; }
    };
    document.body=document.createElement("body");
    document.body.isConnected=true;

    const context={
        window:null,document,console,Promise,String,Object,Array,Set,Map,Number
    };
    context.window=context;
    vm.createContext(context);
    vm.runInContext(uiSource,context);
    return {context,created};
}

test("RPG alert and confirm share one serial dialog queue",()=>{
    const {context,created}=loadDialogRuntime();
    const first=context.rpgAlert("第一則");
    const second=context.rpgConfirm("第二則");
    assert.equal(typeof first.then,"function");
    assert.equal(typeof second.then,"function");
    assert.deepEqual(
        JSON.parse(JSON.stringify(context.v169GetRpgDialogState())),
        {active:"alert",queued:1}
    );
    assert.ok(created.some(node=>node.id==="v169RpgDialogLayer"));
    assert.match(uiSource,/Promise\.resolve\(\)\.then\(pumpDialogQueue\)/);
});

test("legacy alert is intercepted and the safety confirm cannot open a native dialog",()=>{
    const {context}=loadDialogRuntime();
    assert.equal(context.alert("提示"),undefined);
    assert.equal(context.confirm("遺漏的舊確認"),false);
    assert.match(uiSource,/window\.alert=function\(message\)/);
    assert.match(uiSource,/window\.confirm=function\(message\)/);
});

test("all production confirmation call sites use the asynchronous RPG API",()=>{
    const productionFiles=fs.readdirSync("js")
        .filter(file=>file.endsWith(".js"))
        .map(file=>[file,fs.readFileSync(path.join("js",file),"utf8")]);
    productionFiles.forEach(([file,source])=>{
        assert.doesNotMatch(
            source,
            /\b(?:window\.)?confirm\s*\(/,
            file+" still invokes native confirm"
        );
        assert.doesNotMatch(source,/\bprompt\s*\(/,file+" invokes native prompt");
    });
    confirmSources.forEach(([file,source])=>{
        assert.match(source,/window\.rpgConfirm/,file+" RPG confirmation");
    });
});

test("beforeunload only saves and never triggers a browser leave prompt",()=>{
    const beforeUnload=mainSource.match(/window\.addEventListener\(\s*"beforeunload"[\s\S]{0,260}?\n\s*\);/);
    assert.ok(beforeUnload,"silent beforeunload save handler");
    assert.doesNotMatch(beforeUnload[0],/preventDefault|returnValue/);
    assert.match(mainSource,/addEventListener\("popstate",async/);
    assert.match(mainSource,/await window\.rpgConfirm\([\s\S]*title:"離開冒險"/);
});

test("character runtime marks fixed and scrollable tabs before setting overflow",()=>{
    assert.match(layoutSource,/root\.dataset\.characterTab=\s*activeCharacterTab/);
    assert.match(layoutSource,/activeCharacterTab==="status"\s*\|\|\s*activeCharacterTab==="expPool"/);
    assert.match(layoutSource,/inventoryOwnsScroll \|\| fixedCharacterTab\s*\? "hidden"\s*: "auto"/);
    assert.match(css,/data-character-tab="status"\][\s\S]*data-character-tab="expPool"\][\s\S]*overflow-y:hidden !important/);
    assert.match(css,/data-character-tab="skill"\][\s\S]*overflow-y:auto !important/);
});

test("status and EXP are compact fixed layouts while skills retain only a small tail",()=>{
    assert.match(css,/#characterTabContent\{[\s\S]{0,180}padding-bottom:0 !important/);
    assert.match(css,/#characterTabContent > #skillPage\{[\s\S]{0,120}padding:0 0 12px !important/);
    assert.match(css,/#allSkillsList\{[\s\S]{0,100}padding-bottom:12px !important/);
    assert.match(css,/data-character-tab="status"\][\s\S]*#statusPage[\s\S]*display:flex !important/);
    assert.match(css,/data-character-tab="expPool"\][\s\S]*#homeExpPoolCard[\s\S]*display:flex !important/);
    assert.match(css,/#expDistributeList\{[\s\S]*overflow:hidden/);
});

test("shop renderer creates stable HP-left and SP-right columns",()=>{
    assert.match(uiSource,/makeColumn\("hp","HP 藥水",hpCards\)/);
    assert.match(uiSource,/makeColumn\("sp","SP 藥水",spCards\)/);
    assert.ok(
        uiSource.indexOf('makeColumn("hp"')<uiSource.indexOf('makeColumn("sp"'),
        "HP column is appended before SP"
    );
    assert.match(css,/\.shop-potion-list\.v169-shop-columns\{[\s\S]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});

test("successful potion purchases enqueue an RPG receipt only after inventory changes",()=>{
    assert.match(uiSource,/const purchased=Math\.max\(0,afterCount-beforeCount\)/);
    assert.match(uiSource,/const spent=Math\.max\(0,beforeGold-afterGold\)/);
    assert.match(uiSource,/purchased<=0\|\|spent<=0/);
    assert.match(uiSource,/window\.rpgAlert\([\s\S]*title:"購買成功"/);
});

test("dungeon backpack reuses the real inventory and rises above the dungeon nav",()=>{
    assert.match(uiSource,/dungeonPage\.classList\.contains\("active"\)/);
    assert.match(uiSource,/mapPage\.classList\.add\("active"\)/);
    assert.match(uiSource,/previousOpenMapInventoryOverlay\.apply/);
    assert.match(uiSource,/classList\.add\("v169-dungeon-inventory-overlay"\)/);
    assert.match(css,/\.v169-dungeon-inventory-overlay\{[\s\S]*z-index:900 !important/);
});

test("perpetual modal glow and skill-card compositing are static",()=>{
    assert.match(css,/\.item-modal-box,\s*\.home-feature-modal:not\(#trainingZoneModal\) > \.home-feature-modal-box\{\s*animation:none !important/);
    assert.match(css,/\.skill-preview-card\{\s*will-change:auto !important/);
});

test("V169 styles and runtimes are deployed last under fresh cache keys",()=>{
    assert.match(loaderSource,/const V_ASSET_VERSION="169"/);
    assert.match(indexSource,/js\/00-main\.js\?v=169/);
    assert.match(indexSource,/js\/19-stage-v78-character-inventory-runtime\.js\?v=169/);
    assert.match(indexSource,/js\/20-anonymous-20\.js\?v=169/);

    const styles=[
        "css/48-v169-element-box-settings.css",
        "css/49-v169-rpg-ui.css",
        "css/50-v169-abyss-flow.css"
    ].map(file=>loaderSource.indexOf(file));
    const runtimes=[
        "js/48-v159-abyss-battle-portraits.js",
        "js/49-v169-element-box-settings.js",
        "js/50-v169-water-skill-rules.js",
        "js/51-v169-rpg-ui.js"
    ].map(file=>loaderSource.indexOf(file));
    assert.ok(styles.every(index=>index>=0));
    assert.deepEqual(styles.slice().sort((a,b)=>a-b),styles);
    assert.ok(runtimes.every(index=>index>=0));
    assert.deepEqual(runtimes.slice().sort((a,b)=>a-b),runtimes);
});

console.log("\n"+passed+" V169 RPG UI tests passed.");
