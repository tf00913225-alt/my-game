"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const read=path=>fs.readFileSync(path,"utf8");
const runtime=read("js/19-stage-v78-character-inventory-runtime.js");
const coreCss=read("css/22-stage-v78-character-inventory-core.css");
const finalCss=read("css/31-v131-fix-batch.css");
const loader=read("js/20-anonymous-20.js");
const index=read("index.html");

let passed=0;
function test(name,callback){
    callback();
    passed++;
    console.log("✓ "+name);
}

function extractFunction(source,name){
    const start=source.indexOf("function "+name+"(");
    const end=source.indexOf("\n}\n\nfunction ",start);
    assert.ok(start>=0&&end>start,"function "+name+" exists");
    return source.slice(start,end+2);
}

function makeElement(){
    const values=new Map();
    return {
        clientHeight:520,
        parentElement:null,
        style:{
            setProperty(name,value,priority){
                values.set(name,{value,priority});
            }
        },
        value(name){
            return values.get(name)?.value;
        },
        priority(name){
            return values.get(name)?.priority;
        }
    };
}

test("the V78 owner shrink-wraps short character tabs instead of forcing a viewport-height shell",()=>{
    const body=makeElement();
    const root=makeElement();
    const inventory=makeElement();
    const box=makeElement();
    const modal=makeElement();
    modal.classList={contains:name=>name==="show"};
    modal.querySelector=selector=>selector===".home-feature-modal-box.wide"?box:null;

    const elements={
        homeFeatureModal:modal,
        homeFeatureModalBody:body,
        characterTabContent:root,
        inventoryPage:inventory
    };
    const context={
        document:{getElementById:id=>elements[id]||null},
        Math,Number
    };
    vm.createContext(context);
    vm.runInContext(extractFunction(runtime,"applyNow"),context);
    context.applyNow();

    assert.equal(box.value("height"),"auto");
    assert.equal(box.value("max-height"),"96%");
    assert.equal(body.value("flex"),"0 1 auto");
    assert.equal(root.value("flex"),"0 1 auto");
    assert.equal(root.value("height"),"auto");
    assert.equal(root.value("max-height"),"none");
    assert.equal(root.value("overflow-y"),"scroll");
    assert.equal(root.priority("height"),"important");
});

test("the core character shell uses content height with a 96 percent ceiling",()=>{
    assert.match(coreCss,/\.home-feature-modal-box\.wide\{[\s\S]{0,320}height:auto !important;[\s\S]{0,80}max-height:96% !important/);
    assert.match(coreCss,/\.home-feature-modal-box\.wide #homeFeatureModalBody\{[\s\S]{0,220}flex:0 1 auto !important/);
    assert.match(coreCss,/#characterTabContent\{[\s\S]{0,280}flex:0 1 auto !important;[\s\S]{0,80}height:auto !important;[\s\S]{0,100}max-height:none !important/);
    assert.doesNotMatch(coreCss,/--character-scroll-height/);
});

test("the later V131 layout cannot restore the fixed black-tail shell",()=>{
    assert.match(finalCss,/\.home-feature-modal-box\.wide\{[\s\S]{0,160}height:auto !important;[\s\S]{0,80}max-height:96% !important/);
    assert.match(finalCss,/\.home-feature-modal-box\.wide #homeFeatureModalBody\{[\s\S]{0,160}flex:0 1 auto !important/);
    assert.match(finalCss,/#characterTabContent\{[\s\S]{0,180}flex:0 1 auto !important;[\s\S]{0,80}height:auto !important/);
    const shellBlock=finalCss.match(/#game-stage #homeFeatureModal \.home-feature-modal-box\.wide\{[^}]*\}/)?.[0]||"";
    const rootBlock=finalCss.match(/#game-stage #homeFeatureModal #characterTabContent\{[^}]*\}/)?.[0]||"";
    assert.doesNotMatch(shellBlock,/^\s*height:94% !important;/m);
    assert.doesNotMatch(rootBlock,/^\s*height:0 !important;/m);
});

test("long character tabs retain the canonical internal scroll owner",()=>{
    assert.match(runtime,/inventoryOwnsScroll\s*\? "hidden"\s*: "scroll"/);
    assert.match(coreCss,/#characterTabContent\{[\s\S]{0,500}overflow-y:auto !important/);
    assert.match(finalCss,/#characterTabContent\{[\s\S]{0,500}overflow-y:auto !important/);
});

test("the development release advances to V173.28",()=>{
    assert.match(loader,/const V_ASSET_VERSION="173\.28"/);
    assert.match(index,/<title>四象江湖傳 V173\.28<\/title>/);
    assert.match(index,/aria-label="目前版本 V173\.28"/);
    assert.match(index,/>V173\.28<\/div>/);
});

console.log("\n"+passed+" V173.28 character-shell regression tests passed.");
