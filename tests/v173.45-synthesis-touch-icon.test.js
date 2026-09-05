"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const touchLock=fs.readFileSync("js/01-stage-v8-touch-lock.js","utf8");
const itemCss=fs.readFileSync("css/50-v169-abyss-flow.css","utf8");

assert.match(touchLock,/\.v143-item-picker/);
assert.match(touchLock,/const canScrollX =[\s\S]*?overflowX==="auto"[\s\S]*?node\.scrollWidth >[\s\S]*?node\.clientWidth \+ 1/);
assert.match(itemCss,/#homeFeatureModal\.v141-synthesis-modal \.v141-upgrade-flow \.v169-talisman-art\{[\s\S]*?width:92px;[\s\S]*?height:138px;/);

const listeners=new Map();
const documentElement={};
const window={
    addEventListener(){},
    getComputedStyle(node){
        return node.computedStyle||{overflowX:"visible",overflowY:"visible"};
    }
};
const document={
    documentElement,
    addEventListener(name,handler){ listeners.set(name,handler); }
};
vm.runInNewContext(touchLock,{document,window});

const stage={};
const body={
    nodeType:1,parentElement:documentElement,
    scrollHeight:500,clientHeight:500,scrollWidth:300,clientWidth:300,
    computedStyle:{overflowX:"hidden",overflowY:"auto"},
    matches:selector=>selector.includes("#homeFeatureModalBody"),
    closest:selector=>selector==="#game-stage"?stage:null
};
const picker={
    nodeType:1,parentElement:body,
    scrollHeight:90,clientHeight:90,scrollWidth:520,clientWidth:300,
    computedStyle:{overflowX:"auto",overflowY:"hidden"},
    matches:selector=>selector.includes(".v143-item-picker"),
    closest:selector=>selector==="#game-stage"?stage:null
};
const card={
    nodeType:1,parentElement:picker,matches:()=>false,
    closest:selector=>selector==="#game-stage"?stage:null
};

let prevented=false;
listeners.get("touchmove")({target:card,preventDefault(){ prevented=true; }});
assert.equal(window.isInsideAllowedScrollerV78(card),true,"equipment picker must qualify as a horizontal scroll owner");
assert.equal(prevented,false,"horizontal equipment picker touchmove must remain native");

picker.scrollWidth=picker.clientWidth;
assert.equal(window.isInsideAllowedScrollerV78(card),false,"picker is whitelisted only when horizontal overflow actually exists");

console.log("Synthesis horizontal touch and compact talisman checks passed");
