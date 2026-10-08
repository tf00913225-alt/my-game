"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const releaseMeta=JSON.parse(fs.readFileSync("release/release.json","utf8"));
const vm=require("node:vm");

const read=path=>fs.readFileSync(path,"utf8");
const runtime=read("js/19-stage-v78-character-inventory-runtime.js");
const coreCss=read("css/22-stage-v78-character-inventory-core.css");
const finalCss=read("css/31-v131-fix-batch.css");
const sharedCss=read("css/49-v169-rpg-ui.css");
const loader=read("js/20-anonymous-20.js")+read("scripts/build-production.mjs");
const index=read("index.html");

let passed=0;
function test(name,callback){
    callback();
    passed++;
    console.log("✓ "+name);
}

function rule(source,selector){
    const blocks=[...source.replace(/\/\*[\s\S]*?\*\//g,"").matchAll(/([^{}]+)\{([^{}]*)\}/g)]
        .filter(match=>match[1].trim()===selector);
    assert.ok(blocks.length,"CSS rule exists: "+selector);
    const declarations=new Map();
    for(const block of blocks){
        for(const declaration of block[2].split(";")){
            const colon=declaration.indexOf(":");
            if(colon<0){ continue; }
            declarations.set(declaration.slice(0,colon).trim(),declaration.slice(colon+1).trim());
        }
    }
    return [...declarations].map(([property,value])=>property+":"+value+";").join("\n");
}

test("the retired V78 export cannot write character or backpack geometry",()=>{
    const context=vm.createContext({window:{}});
    vm.runInContext(runtime,context);
    assert.equal(typeof context.window.v78ApplyCharacterInventoryLayout,"function");
    assert.equal(context.window.v78ApplyCharacterInventoryLayout(),false);
    assert.doesNotMatch(runtime,/setProperty|MutationObserver|setTimeout|requestAnimationFrame/);
    const frame=rule(sharedCss,"#game-ui #homeFeatureModal .home-feature-modal-box.wide");
    assert.match(frame,/width:calc\(100% - var\(--ui-large-panel-safe-space\)\) !important;/);
    assert.match(frame,/max-width:var\(--ui-large-panel-max-width\) !important;/);
    assert.match(frame,/height:min\(var\(--ui-large-panel-height\),calc\(100% - var\(--ui-large-panel-safe-space\)\)\) !important;/);
    assert.match(frame,/max-height:calc\(100% - var\(--ui-large-panel-safe-space\)\) !important;/);
    assert.match(rule(sharedCss,"#game-ui #homeFeatureModal .home-feature-modal-box.wide #homeFeatureModalBody"),/flex:1 1 auto !important;/);
    const content=rule(sharedCss,"#game-ui #homeFeatureModal #characterTabContent");
    assert.match(content,/flex:1 1 auto !important;/);
    assert.match(content,/height:auto !important;/);
    assert.match(content,/scrollbar-gutter:stable !important;/);
});

test("the browser character uses the shared capped Large Panel owner",()=>{
    assert.match(sharedCss,/--ui-large-panel-max-width:396px/);
    assert.match(sharedCss,/--ui-large-panel-height:620px/);
    assert.match(sharedCss,/#game-ui\{[^}]*--ui-large-panel-max-width:960px;[^}]*--ui-large-panel-height:760px;/);
    assert.doesNotMatch(sharedCss,/#game-ui #homeFeatureModal \.home-feature-modal-box\.wide\{[^}]*max-width:none !important;/);
    assert.match(sharedCss,/\.home-feature-modal-box\.wide #homeFeatureModalBody\{[\s\S]{0,220}flex:1 1 auto !important/);
    assert.match(sharedCss,/#characterTabContent\{[\s\S]{0,220}flex:1 1 auto !important/);
});

test("backpack geometry no longer competes with the character modal",()=>{
    assert.match(coreCss,/#game-ui #inventoryPage \.inventory-classic-shell\{[^}]*width:100%;[^}]*height:100%;/);
    assert.doesNotMatch(coreCss,/#characterTabContent|\.home-feature-modal-box\.wide/);
    assert.doesNotMatch(runtime,/transform\s*:\s*scale\s*\(|dataset\.characterTab|fixedCharacterTab/);
});

test("long character tabs retain their CSS scroll owner and backpack has its own",()=>{
    const content=rule(sharedCss,"#game-ui #homeFeatureModal .home-feature-modal-box.wide #characterTabContent");
    assert.match(content,/overflow-y:auto !important;/);
    assert.match(content,/overflow-x:hidden !important;/);
    assert.match(content,/touch-action:pan-y !important;/);
    assert.match(rule(coreCss,"#game-ui #inventoryPage .inventory-grid-scroll"),/overflow-y:auto;[^}]*scrollbar-gutter:stable;/);
    assert.doesNotMatch(finalCss,/\.inventory-grid-scroll\{/);
});

test("the functional V173.63 repair runtime follows late owners inside gameplay-core",()=>{
    const build=read("scripts/build-production.mjs");
    assert.ok(build.indexOf('"js/53-v173.50-inventory-qol.js"')<build.indexOf('"js/58-v173.63-functional-fixes.js"'));
    assert.doesNotMatch(runtime,/createElement\(["']script["']\)|v173:runtime-ready/);
    assert.doesNotMatch(runtime,/visible-ui-repairs/);
});

test("the repository source remains V173.62 and dev deployment keeps that source version",()=>{
    assert.equal((loader.match(/const V_ASSET_VERSION="([^"]+)"/)||[])[1],releaseMeta.cacheVersion);
    assert.ok(index.includes("<title>四象江湖傳 V"+releaseMeta.version+"</title>"));
    assert.ok(index.includes('aria-label="目前版本 V'+releaseMeta.version+'"'));
    assert.ok(index.includes(">V"+releaseMeta.version+"</div>"));
});

console.log("\n"+passed+" character-shell regression tests passed.");
