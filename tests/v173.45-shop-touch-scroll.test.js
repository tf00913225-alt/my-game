"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const touchLock=fs.readFileSync("js/01-stage-v8-touch-lock.js","utf8");
const shopCss=fs.readFileSync("css/44-v149-skill-ui-rules.css","utf8");
const frameCss=fs.readFileSync("css/49-v169-rpg-ui.css","utf8");

assert.match(touchLock,/data-scroll-owner="x\|y\|both"/);
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
    getElementById:()=>null,
    addEventListener(name,handler){ listeners.set(name,handler); }
};
vm.runInNewContext(touchLock,{document,window});

const stage={};
const box={
    nodeType:1,parentElement:documentElement,scrollHeight:620,clientHeight:620,
    computedStyle:{overflowY:"hidden"},
    matches:selector=>selector.includes(".home-feature-modal-box"),
    closest:selector=>["#game-stage","#game-stage, #game-ui"].includes(selector)?stage:null
};
const body={
    nodeType:1,parentElement:box,scrollHeight:1200,clientHeight:520,
    computedStyle:{overflowY:"auto"},
    matches:selector=>selector.includes("#homeFeatureModalBody"),
    closest:selector=>["#game-stage","#game-stage, #game-ui"].includes(selector)?stage:null
};
const card={
    nodeType:1,parentElement:body,matches:()=>false,
    closest:selector=>["#game-stage","#game-stage, #game-ui"].includes(selector)?stage:null
};
const background={
    nodeType:1,parentElement:documentElement,matches:()=>false,
    closest:selector=>["#game-stage","#game-stage, #game-ui"].includes(selector)?stage:null
};

function dispatch(type,target,pointerType){
    let prevented=false;
    listeners.get(type)({
        target,pointerType,
        preventDefault(){ prevented=true; }
    });
    return prevented;
}

assert.equal(window.FourSymbolsGestureArbiter.findScrollOwner(card)?.node,body,"shop card must resolve to the modal body scroll owner");
assert.equal(dispatch("touchmove",card),false,"touchmove inside scrollable shop content must remain native");
assert.equal(dispatch("pointermove",card,"touch"),false,"touch pointer movement inside shop content must remain native");
assert.equal(dispatch("touchmove",background),false,"single-finger panning remains browser-owned; CSS locks the modal background");

body.scrollHeight=body.clientHeight;
assert.equal(window.FourSymbolsGestureArbiter.findScrollOwner(card),null,"body is allowed only when it actually has overflow");
assert.equal(dispatch("touchmove",card),false,"single-finger panning is never cancelled by the gesture arbiter");

console.log("V173.50 shop touch-scroll regression checks passed");
