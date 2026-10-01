"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
let now=100;
const listeners=new Map(),win=new Map();
const stage={addEventListener:(name,fn)=>listeners.set("stage:"+name,fn)};
const target={nodeType:1,isConnected:true,closest(selector){return selector==="#game-stage"?stage:selector.includes("button")?this:null;},getAttribute(){return null;},contains(n){return n===this;}};
const document={documentElement:{},hidden:false,getElementById:()=>stage,addEventListener:(name,fn)=>listeners.set(name,fn)};
const window={addEventListener:(name,fn)=>win.set(name,fn),getComputedStyle:()=>({overflowX:"visible",overflowY:"visible"})};
vm.runInNewContext(fs.readFileSync("js/01-stage-v8-touch-lock.js","utf8"),{window,document,Date:{now:()=>now},Math,Number,Map});
function pointer(name,id=1,x=0){listeners.get(name)({target,pointerId:id,pointerType:"touch",clientX:x,clientY:0});}
function click(id=1,detail=1){let stopped=false;listeners.get("stage:click")({target,pointerId:id,detail,preventDefault(){stopped=true;},stopImmediatePropagation(){}});return stopped;}
function tap(id=1){pointer("pointerdown",id);pointer("pointerup",id);return click(id);}
function slide(id=1){pointer("pointerdown",id);pointer("pointermove",id,12);pointer("pointerup",id,12);}
assert.equal(tap(),false,"ordinary tap");
slide();assert.equal(tap(),false,"no-click drag must not eat next tap with reused pointer ID");
slide(2);assert.equal(tap(3),false,"new finger tap must not inherit old suppression");
assert.equal(click(2),true,"delayed click from the original dragged finger remains rejected");
slide(4);assert.equal(click(4),true);assert.equal(click(4),false,"one gesture consumes one click");
slide(5);now+=1001;assert.equal(click(5),false,"expired gesture retires without a click");
pointer("pointerdown",6);pointer("pointercancel",6);assert.equal(click(6),true);assert.equal(tap(6),false);
pointer("pointerdown",7);pointer("pointerdown",8);pointer("pointerup",7);pointer("pointerup",8);
assert.equal(click(7),true);assert.equal(click(8),true,"multitouch cannot declare actions");
slide(9);assert.equal(click(null,0),false,"keyboard/programmatic activation is not a touch click");
slide(10);assert.equal(click(null),true,"legacy compatibility click is scoped to latest gesture");
slide(10);pointer("pointerdown",11);pointer("pointerup",11);assert.equal(click(null),false,"new gesture clears legacy ambiguity");
slide(12);win.get("pagehide")();assert.equal(tap(12),false,"page lifecycle resets gestures");
pointer("pointerdown",13);window.FourSymbolsGestureArbiter.getState(13);win.get("blur")();assert.equal(window.FourSymbolsGestureArbiter.getState(13),null);
for(let i=0;i<10;i++){assert.equal(tap(),false);}
assert.doesNotMatch(fs.readFileSync("js/01-stage-v8-touch-lock.js","utf8"),/suppressedTargets|touchend/);
console.log("✓ gesture-scoped suppression, no-click recovery, cancel, expiry, delayed click, multitouch and re-entry");
