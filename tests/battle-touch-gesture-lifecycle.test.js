"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
let now=100;
const listeners=new Map(),win=new Map();
const stage={addEventListener:(name,fn)=>listeners.set("stage:"+name,fn)};
const target={nodeType:1,isConnected:true,closest(selector){return ["#game-stage","#game-stage, #game-ui"].includes(selector)?stage:selector.includes("button")?this:null;},getAttribute(){return null;},contains(n){return n===this;}};
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
pointer("pointerdown",14);listeners.get("stage:pointerleave")({target,pointerId:14});pointer("pointerup",14);assert.equal(click(14),false,"leaving a nested child must not cancel a tap inside the stage");
pointer("pointerdown",15);listeners.get("stage:pointerleave")({target:stage,pointerId:15});assert.equal(click(15),true,"leaving the stage cancels that gesture");assert.equal(tap(15),false);
assert.doesNotMatch(fs.readFileSync("js/01-stage-v8-touch-lock.js","utf8"),/suppressedTargets|touchend/);
console.log("✓ gesture-scoped suppression, no-click recovery, cancel, expiry, delayed click, multitouch and re-entry");

// Detached HUDs use this same arbiter, not a second drag detector or document click hook.
{
 const handlers=new Map(),surfaceHandlers=new Map();let adds=0,clock=0;
 const surface={nodeType:1,parentElement:null,isConnected:true,addEventListener(name,fn){adds++;surfaceHandlers.set(name,fn);},removeEventListener(name,fn){assert.equal(surfaceHandlers.get(name),fn);surfaceHandlers.delete(name);},contains(node){for(let n=node;n;n=n.parentElement)if(n===this)return true;return false;}};
 const band={nodeType:1,parentElement:surface,isConnected:true,clientWidth:72,scrollWidth:120,clientHeight:24,scrollHeight:24,getAttribute:name=>name==='data-scroll-owner'?'x':null,closest(){return null;},contains:n=>n===band};
 const document={documentElement:{},hidden:false,getElementById(){return null;},addEventListener(name,fn){handlers.set(name,fn);}};
 const window={addEventListener(){},getComputedStyle:n=>n===band?{overflowX:'auto',overflowY:'hidden'}:{overflowX:'visible',overflowY:'visible'}};
 vm.runInNewContext(fs.readFileSync('js/01-stage-v8-touch-lock.js','utf8'),{window,document,Date:{now:()=>clock},Math,Number,Map});
 const owner=window.FourSymbolsGestureArbiter;
 const pointer=(name,id,x=0)=>handlers.get(name)({target:band,pointerId:id,pointerType:'touch',clientX:x,clientY:0});
 const click=(id,detail=1)=>{let suppressed=false;surfaceHandlers.get('click')({target:band,pointerId:id,detail,preventDefault(){suppressed=true;},stopImmediatePropagation(){}});return suppressed;};
 pointer('pointerdown',20);assert.equal(owner.getState(20),null,'unregistered body content is outside the game input contract');
 assert.equal(owner.registerSurface(surface),true);assert.equal(owner.registerSurface(surface),true);assert.equal(adds,2,'register is idempotent: exactly one capture click and one leave handler');
 pointer('pointerdown',21);assert.equal(owner.getState(21).scrollOwner.node,band);assert.equal(owner.getState(21).scrollOwner.axes,'x');pointer('pointermove',21,30);assert.equal(owner.getState(21).state,'SCROLL');pointer('pointerup',21,30);assert.equal(click(21),true,'horizontal drag cannot leak a compatibility click into card forwarding');assert.equal(click(21),false,'one completion is consumed once');
 pointer('pointerdown',22);pointer('pointerup',22);assert.equal(click(22),false,'ordinary detached HUD tap reaches the original card handler');
 pointer('pointerdown',23);pointer('pointermove',23,30);pointer('pointerup',23,30);assert.equal(click(23,0),false,'keyboard/programmatic activation stays available');
 let pinchPrevented=false;handlers.get('touchmove')({target:band,touches:[{},{}],preventDefault(){pinchPrevented=true;}});assert.equal(pinchPrevented,true,'registered HUD inherits the original pinch guard');
 pointer('pointerdown',24);assert.equal(owner.getState(24).state,'TAP');band.parentElement=null;owner.unregisterSurface(surface);assert.equal(owner.getState(24),null,'removing a HUD surface retires its in-flight gesture');assert.equal(surfaceHandlers.size,0);assert.equal(owner.unregisterSurface(surface),false);
 band.parentElement=surface;owner.registerSurface(surface);pointer('pointerdown',25);pointer('pointermove',25,30);pointer('pointerup',25,30);band.parentElement=null;owner.unregisterSurface(surface);band.parentElement=surface;owner.registerSurface(surface);assert.equal(click(25),false,'removed HUD completion cannot suppress a future reattached surface');
 pointer('pointerdown',26);pointer('pointerup',26);assert.equal(click(26),false,'new HUD surface still taps normally');
 assert.equal(handlers.has('click'),false,'no document-wide click interception was added');
}
console.log('✓ managed detached HUD surface: horizontal scroll, tap forwarding boundary, pinch, lifecycle and single-owner suppression');
