"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const css=fs.readFileSync("css/49-v169-rpg-ui.css","utf8");
const ui=fs.readFileSync("js/51-v169-rpg-ui.js","utf8");
const guidelines=fs.readFileSync("UI_GUIDELINES.md","utf8");

assert.match(css,/--ui-large-panel-max-width:396px/);
assert.match(css,/--ui-large-panel-height:620px/);
assert.match(css,/#homeFeatureModal\.v131-shop-open \.home-feature-modal-box\{[\s\S]*?max-width:var\(--ui-large-panel-max-width\) !important;[\s\S]*?height:min\(var\(--ui-large-panel-height\),calc\(100% - var\(--ui-large-panel-safe-space\)\)\) !important;/);
assert.match(css,/#homeFeatureModal\.v131-shop-open #homeFeatureModalBody\{[\s\S]*?flex:1 1 auto;[\s\S]*?min-height:0;[\s\S]*?scrollbar-gutter:stable;/);
assert.match(css,/\.v17345-shop-shell\{[\s\S]*?height:100%;[\s\S]*?min-height:100%;/);
assert.match(css,/\.v17345-shop-tabs\{[\s\S]*?flex:0 0 auto;/);
assert.match(css,/\.v17345-shop-tabs button\{[\s\S]*?min-height:var\(--ui-large-panel-tab-height\)/);
assert.doesNotMatch(css,/#homeFeatureModal\.v131-shop-open[^{]*\{[^}]*transform:\s*scale\(/);

assert.match(guidelines,/A 級 — Large Panel/);
assert.match(guidelines,/B 級 — Medium Modal/);
assert.match(guidelines,/C 級 — Small Dialog/);
assert.match(guidelines,/功能層級決定視窗尺寸；內容量不決定視窗尺寸；同一視窗 Tab 只換內容、不換框架/);

const body={innerHTML:""};
const storage=new Map();
const injectedScripts=[];
const document={
    head:{appendChild(node){ injectedScripts.push(node); }},
    getElementById(id){ return id==="homeFeatureModalBody"?body:null; },
    createElement(tag){
        if(tag==="script"){
            return {id:"",src:"",async:true};
        }
        throw new Error("unexpected DOM parsing in focused shop switch test");
    }
};
const context={
    window:null,document,console,Promise,String,Object,Array,Set,Map,Number,Date,Math,
    localStorage:{
        getItem(key){ return storage.has(key)?storage.get(key):null; },
        setItem(key,value){ storage.set(key,String(value)); }
    },
    renderShopContent(){ return '<div class="shop-potion-interface">POTION</div>'; }
};
context.window=context;
vm.createContext(context);
vm.runInContext(ui,context);

assert.equal(injectedScripts.length,1,"equipment progression bootstrap should inject one script");
assert.match(injectedScripts[0].src,/js\/equipment-progression\.js\?v=173\.47$/);

const pages=["equipment","potion","equipment","potion","equipment"];
pages.forEach(page=>{
    context.v169SwitchShopPage(page);
    assert.match(body.innerHTML,/class="v17345-shop-shell"/);
    assert.match(body.innerHTML,/class="v17345-shop-tabs"/);
    assert.match(body.innerHTML,/>補品<\/button>/);
    assert.match(body.innerHTML,/>裝備<\/button>/);
});
assert.match(body.innerHTML,/class="v17345-equipment-shop"/);

console.log("UI panel sizing regression checks passed");
