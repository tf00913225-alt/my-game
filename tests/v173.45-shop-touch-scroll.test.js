"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const touchLock=fs.readFileSync("js/01-stage-v8-touch-lock.js","utf8");
const shopCss=fs.readFileSync("css/44-v149-skill-ui-rules.css","utf8");
const frameCss=fs.readFileSync("css/49-v169-rpg-ui.css","utf8");

assert.match(touchLock,/\.home-feature-modal-box, #homeFeatureModalBody/);
assert.match(touchLock,/\.auto-settings-expanded/);
assert.match(shopCss,/#homeFeatureModal\.v131-shop-open #homeFeatureModalBody\{[\s\S]*?overflow-y:auto !important;[\s\S]*?touch-action:pan-y !important;/);
assert.match(frameCss,/#homeFeatureModal\.v131-shop-open #homeFeatureModalBody\{[\s\S]*?flex:1 1 auto;[\s\S]*?min-height:0;[\s\S]*?scrollbar-gutter:stable;/);

const listeners=new Map();
const documentElement={};
const window={
    addEventListener(){},
    getComputedStyle(node){ return node.computedStyle||{overflowY:"visible"}; }
};
const document={
    documentElement,
    addEventListener(name,handler){ listeners.set(name,handler); }
};
vm.runInNewContext(touchLock,{document,window});

const stage={};
const box={
    nodeType:1,parentElement:documentElement,scrollHeight:620,clientHeight:620,
    computedStyle:{overflowY:"hidden"},
    matches:selector=>selector.includes(".home-feature-modal-box"),
    closest:selector=>selector==="#game-stage"?stage:null
};
const body={
    nodeType:1,parentElement:box,scrollHeight:1200,clientHeight:520,
    computedStyle:{overflowY:"auto"},
    matches:selector=>selector.includes("#homeFeatureModalBody"),
    closest:selector=>selector==="#game-stage"?stage:null
};
const card={
    nodeType:1,parentElement:body,matches:()=>false,
    closest:selector=>selector==="#game-stage"?stage:null
};
const background={
    nodeType:1,parentElement:documentElement,matches:()=>false,
    closest:selector=>selector==="#game-stage"?stage:null
};

function dispatch(type,target,pointerType){
    let prevented=false;
    listeners.get(type)({
        target,pointerType,
        preventDefault(){ prevented=true; }
    });
    return prevented;
}

assert.equal(window.isInsideAllowedScrollerV78(card),true,"shop card must resolve to the modal body scroll owner");
assert.equal(dispatch("touchmove",card),false,"touchmove inside scrollable shop content must remain native");
assert.equal(dispatch("pointermove",card,"touch"),false,"touch pointer movement inside shop content must remain native");
assert.equal(dispatch("touchmove",background),true,"non-scrollable modal background remains locked");

body.scrollHeight=body.clientHeight;
assert.equal(window.isInsideAllowedScrollerV78(card),false,"body is allowed only when it actually has overflow");
assert.equal(dispatch("touchmove",card),true,"non-scrollable content still respects the global stage lock");

console.log("V173.47 shop touch-scroll regression checks passed");
