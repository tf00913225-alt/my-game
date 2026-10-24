"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const source=fs.readFileSync("js/39-v143-skill-animation.js","utf8");
const between=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
function fixture(side="player",actorIndex=0,targetIndex=0){
 let now=100;const nodes=[],microtasks=[],timers=[],events=[];
 const anchors={player:{x:40+actorIndex*30,y:420,rect:{width:90,height:120}},monster:{x:60+targetIndex*50,y:90,rect:{width:95,height:120}}};
 const current={config:{id:"normal"},side,actorIndex,targetSide:side==="player"?"monster":"player",targetIndexes:[targetIndex],startedAt:100,duration:520,model:{hit:.57,projectile:{src:"assets/vfx/normal/normal-air-shot-v1.webp",minSize:52,maxSize:64},sprite:{impactOnly:true}},spriteNodes:new Map(),confirmedTargets:new Set(),hitCallbacks:new Map(),gate:{complete(){this.done=true;}}};
 const impact={dataset:{},style:{visibility:"hidden",animationPlayState:"paused"}};current.spriteNodes.set(String(targetIndex),impact);
 const context={Date:{now:()=>now},DEFAULT_HIT:.5833333333,Math,window:{},state:{current,stage:{dataset:{sequence:"1"},remove(){events.push("stage-removed");}},metrics:{completed:0}},clamp:(x,a,b)=>Math.max(a,Math.min(b,x)),slotAnchor:s=>anchors[s],queueMicrotask:f=>microtasks.push(f),setTimer:(f,t)=>{timers.push({f,t});return timers.length;},clearTimeout(){},cardFor:()=>({classList:{remove(){}},querySelector:()=>null}),syncStatusVisualsForUnit(){},syncStatusVisualEffects(){},beginVisualTimeline(c){c.firstVisibleFrameAt=c.visualStartedAt=now;events.push("clock");},appendSpriteNode(){const node={dataset:{},style:{},setAttribute(){},animate(frames,options){const animation={frames,options,currentTime:null,pause(){this.paused=true;},play(){this.played=true;},cancel(){this.cancelled=true;}};return animation;}};nodes.push(node);return node;}};
 vm.createContext(context);
 vm.runInContext(between("    function addNormalProjectile(","    function addSprite("),context);
 vm.runInContext(between("    function startNormalProjectiles(","    function requestCastTimeline("),context);
 vm.runInContext(between("    function requestImpactTimeline(","    function confirmTargetVisual("),context);
 vm.runInContext(between("    function targetHitTime(","    function beginVisualTimeline("),context);
 vm.runInContext(between("    function settleTargetVisual(","    function emitSprite("),context);
 vm.runInContext(between("    function cleanupCurrent(","    let sequence="),context);
 return {context,current,impact,nodes,microtasks,timers,events,anchors,setNow:n=>now=n};
}
// Both sides and non-primary actor/target indices follow the official anchors.
for(const side of ["player","monster"])for(const index of [0,2,5]){
 const f=fixture(side,index,index),c=f.current,target=f.anchors[c.targetSide];
 f.context.addNormalProjectile(c,index,target);f.context.addNormalProjectile(c,index,target);
 assert.equal(f.nodes.length,1,"once per attempted target");
 const node=f.nodes[0],a=node.v143MotionAnimation;
 assert.equal(a.paused,true);assert.equal(a.played,undefined);assert.equal(node.dataset.actorIndex,String(index));
 assert.equal(node.style.left,f.anchors[side].x+"px");assert.equal(node.style.top,f.anchors[side].y+"px");
 assert.equal(a.options.duration,296.4);assert.equal(a.frames.at(-1).opacity,0);
 assert.equal(a.frames[1].offset,.30);assert.equal(a.frames[1].opacity,0,'short preparation stays inside original hit window');
 c.characterMotion={play(){this.playCount=(this.playCount||0)+1;}};
 assert.match(a.frames.at(-1).transform,new RegExp(String(target.x-f.anchors[side].x)+"px"));
 assert.equal(c.confirmedTargets.size,0,"attempt flight exists before hit or MISS outcome");
 f.context.requestImpactTimeline(c);f.setNow(900);f.microtasks.shift()();
 assert.deepEqual(f.events,["clock"]);assert.equal(c.visualStartedAt,900);assert.equal(a.played,true);assert.equal(a.currentTime,0);
 assert.equal(c.characterMotion.playCount,1);assert.equal(c.characterMotion.currentTime,0);
 f.context.startNormalProjectiles(c);assert.equal(c.characterMotion.playCount,1,'shared clock starts actor once');
 assert.equal(f.timers.length,1,"only the existing target hit timer");assert.equal(f.timers[0].t,296.4000000000001);
 f.context.settleTargetVisual(c,index);
 assert.equal(node.style.visibility,"hidden");assert.equal(f.impact.style.visibility,"hidden","MISS never reveals impact");
}
// Confirmed impact remains on its existing key; adding air:string does not collide.
{
 const f=fixture(),c=f.current;f.context.addNormalProjectile(c,0,f.anchors.monster);c.confirmedTargets.add(0);
 f.context.settleTargetVisual(c,0);assert.equal(f.impact.style.visibility,"visible");assert.equal(f.nodes[0].style.visibility,"hidden");
}
// Late attachment catches up to the original clock instead of starting a new flight.
{
 const f=fixture(),c=f.current;c.firstVisibleFrameAt=c.visualStartedAt=100;f.setNow(240);
 f.context.addNormalProjectile(c,0,f.anchors.monster);assert.equal(f.nodes[0].v143MotionAnimation.currentTime,140);assert.equal(f.timers.length,0);
}
// Disposal/supersession cancel every motion track and stale deferred starts do nothing.
for(const reason of ["dispose","superseded"]){
 const f=fixture(),c=f.current;f.context.addNormalProjectile(c,0,f.anchors.monster);f.context.requestImpactTimeline(c);
 f.context.cleanupCurrent(c,reason);f.microtasks.shift()();assert.equal(f.nodes[0].v143MotionAnimation.cancelled,true);assert.equal(f.nodes[0].v143MotionAnimation.played,undefined);assert.equal(f.context.state.current,null);
}
// The same existing eager and explicit asset preload owner includes the texture.
{
 const loaded=[],context={Image:function(){Object.defineProperty(this,"src",{set:s=>loaded.push(s)});},failedAssets:new Set(),RAW_MANIFEST:{normal:{sprite:{src:"impact"},projectile:{src:"air"}}},RAW_STATUS_VISUALS:{},MANIFEST:{normal:{sprite:{src:"impact"},projectile:{src:"air"}}},window:{}};
 vm.createContext(context);vm.runInContext(between("    function preflightAsset(","    const director="),context);
 assert.deepEqual(loaded,["impact","air"]);context.window.v143PreloadBattleVfxAsset("normal");assert.deepEqual(loaded,["impact","air","impact","air"]);
}
console.log("Normal air shot: real actor/target, shared cold hit clock, MISS/confirmed separation, late catch-up, dispose/supersede and eager/explicit preload PASS");
