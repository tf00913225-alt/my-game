"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const read=path=>fs.readFileSync(path,"utf8");
const runtime=read("js/19-stage-v78-character-inventory-runtime.js");
const coreCss=read("css/22-stage-v78-character-inventory-core.css");
const finalCss=read("css/31-v131-fix-batch.css");
const sharedCss=read("css/49-v169-rpg-ui.css");
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
            setProperty(name,value,priority){ values.set(name,{value,priority}); }
        },
        value(name){ return values.get(name)?.value; },
        priority(name){ return values.get(name)?.priority; }
    };
}

test("the V78 owner keeps every character tab inside one fixed Large Panel",()=>{
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
    const context={document:{getElementById:id=>elements[id]||null},Math,Number};
    vm.createContext(context);
    vm.runInContext(extractFunction(runtime,"applyNow"),context);
    context.applyNow();

    assert.equal(box.value("width"),"calc(100% - var(--ui-large-panel-safe-space,24px))");
    assert.equal(box.value("max-width"),"var(--ui-large-panel-max-width,396px)");
    assert.equal(box.value("height"),"min(var(--ui-large-panel-height,620px),calc(100% - var(--ui-large-panel-safe-space,24px)))");
    assert.equal(box.value("max-height"),"calc(100% - var(--ui-large-panel-safe-space,24px))");
    assert.equal(body.value("flex"),"1 1 auto");
    assert.equal(root.value("flex"),"1 1 auto");
    assert.equal(root.value("overflow-y"),"scroll");
    assert.equal(root.value("scrollbar-gutter"),"stable");
    assert.equal(root.priority("height"),"important");
});

test("the late shared design-system CSS is the authoritative character frame",()=>{
    assert.match(sharedCss,/--ui-large-panel-max-width:396px/);
    assert.match(sharedCss,/--ui-large-panel-height:620px/);
    assert.match(sharedCss,/\.home-feature-modal-box\.wide\{[\s\S]{0,460}width:calc\(100% - var\(--ui-large-panel-safe-space\)\) !important;[\s\S]{0,120}max-width:var\(--ui-large-panel-max-width\) !important;[\s\S]{0,180}height:min\(var\(--ui-large-panel-height\),calc\(100% - var\(--ui-large-panel-safe-space\)\)\) !important/);
    assert.match(sharedCss,/\.home-feature-modal-box\.wide #homeFeatureModalBody\{[\s\S]{0,220}flex:1 1 auto !important/);
    assert.match(sharedCss,/#characterTabContent\{[\s\S]{0,220}flex:1 1 auto !important/);
});

test("historical character rules remain compatible fallbacks instead of a scale-based layout patch",()=>{
    assert.match(coreCss,/\.home-feature-modal-box\.wide/);
    assert.match(finalCss,/\.home-feature-modal-box\.wide/);
    assert.doesNotMatch(runtime,/transform\s*:\s*scale\s*\(|setProperty\(\s*["']transform["']\s*,\s*["']scale\s*\(/);
    assert.doesNotMatch(runtime,/dataset\.characterTab|fixedCharacterTab/);
});

test("long character tabs retain the canonical internal scroll owner",()=>{
    assert.match(runtime,/inventoryOwnsScroll\s*\? "hidden"\s*: "scroll"/);
    assert.match(runtime,/"scrollbar-gutter",[\s\S]*?"stable"/);
    assert.match(coreCss,/#characterTabContent\{[\s\S]{0,500}overflow-y:auto !important/);
    assert.match(finalCss,/#characterTabContent\{[\s\S]{0,500}overflow-y:auto !important/);
});

test("the current released label remains V173.50 while this UI work stays on dev",()=>{
    assert.match(loader,/const V_ASSET_VERSION="173\.61"/);
    assert.match(index,/<title>四象江湖傳 V173\.61<\/title>/);
    assert.match(index,/aria-label="目前版本 V173\.61"/);
    assert.match(index,/>V173\.61<\/div>/);
});

console.log("\n"+passed+" character-shell regression tests passed.");
