"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const source=fs.readFileSync("js/39-v143-skill-animation.js","utf8");
const v142=fs.readFileSync("js/37-v142-skill-animation.js","utf8");
const floating=fs.readFileSync("js/battle-floating-feedback-owner.js","utf8");
const between=(text,start,end)=>text.slice(text.indexOf(start),text.indexOf(end,text.indexOf(start)));
let now=100,nextId=0;const jobs=new Map(),microtasks=[],events=[];
const setTimeout=(fn,delay)=>{const id=++nextId;jobs.set(id,{fn,due:now+delay});return id;};
const clearTimeout=id=>jobs.delete(id);
function runDue(){for(;;){const entry=[...jobs].filter(([,job])=>job.due<=now).sort((a,b)=>a[1].due-b[1].due||a[0]-b[0])[0];if(!entry)break;jobs.delete(entry[0]);entry[1].fn();}}
const gate={config:{duration:520},deadline:620,done:false};
const lifecycle={state:{fallbackTimer:0},Date:{now:()=>now},window:{},setTimeout,clearTimeout,currentGate:()=>gate};
vm.createContext(lifecycle);vm.runInContext(between(v142,"    function armGateDeadline(","    function identity("),lifecycle);
vm.runInContext(between(v142,"    window.v142GetRemainingAnimationMs=function","    /* V142 is visual-lifecycle"),lifecycle);
let cancelled=0;const art={animate(){events.push("recoil");return {cancel(){cancelled++;}};}};
const node={style:{visibility:"hidden",animationPlayState:"paused"},dataset:{}};
const current={sequence:1,config:{id:"normal"},model:{hit:.57,sprite:{impactOnly:true}},duration:520,startedAt:100,visualStartedAt:0,firstVisibleFrameAt:0,targetSide:"monster",targetIndexes:[0],spriteNodes:new Map([["0",node]]),confirmedTargets:new Set([0]),gate};
const context={state:{current,stage:null,metrics:{completed:0,delayedNumbers:0}},window:{v141Audio:{play(){events.push("audio");}}},Date:{now:()=>now},setTimeout,clearTimeout,
 setTimer:setTimeout,queueMicrotask:fn=>microtasks.push(fn),DEFAULT_HIT:.57,delayFor:()=>0,
 cardFor:()=>({classList:{remove(){}},querySelector:()=>art}),syncStatusVisualsForUnit(){},syncStatusVisualEffects(){}};
vm.createContext(context);
vm.runInContext(between(source,"    function queueTargetHit(","    function confirmTargetVisual("),context);
vm.runInContext(between(source,"    function targetHitTime(","    function emitSprite("),context);
vm.runInContext(between(source,"    function cleanupCurrent(","    let sequence="),context);
vm.runInContext(between(source,"    window.v143ResolveBattleFeedbackTiming=function","    if(typeof applySkillDebuffEffectsToPlayer"),context);
gate.complete=reason=>{if(gate.done)return;gate.done=true;context.cleanupCurrent(current,reason);};
gate.restartVisualTimeline=duration=>lifecycle.armGateDeadline(gate,duration,"v142-v143-visual-complete");
lifecycle.armGateDeadline(gate,520,"old-render-safety");
// Formal HP commits synchronously. Its display and all feedback await the one hit task.
const formal={hp:900};let displayedHp=1000;
assert.equal(context.queueTargetHit(current,0,()=>{throw new Error("wrong-side projection");},"projection","player"),false);
context.queueTargetHit(current,0,()=>{assert.equal(node.style.visibility,"hidden");displayedHp=formal.hp;events.push("resources");now+=300;},"projection","monster");
const timing=context.window.v143ResolveBattleFeedbackTiming("monster",0,"damage",false);
const batches=new Map();let numbers=0;
const collector={Date:{now:()=>now},numeric:(value,fallback)=>Number(value)||fallback,pendingImpactBatches:batches,impactBatchKey:()=>"normal:0",setTimeout,
 flushImpactBatch(key){const batch=batches.get(key);assert.equal(batch.requests.length,1);assert.equal(batch.requests[0].impactAt,now);numbers++;batches.delete(key);}};
vm.createContext(collector);vm.runInContext(between(floating,"    function registerImpactRequest(","    function makeHandle("),collector);
collector.registerImpactRequest({side:"monster",index:0,impactId:"normal:0",impactAt:100},timing);
context.requestImpactTimeline(current);
now=900; // one synchronous setup task exceeded the old 520ms deadline
assert.equal(formal.hp,900);assert.equal(displayedHp,1000);assert.equal(numbers,0);assert.deepEqual(events,[]);
assert.equal(lifecycle.window.v142GetRemainingAnimationMs(),520);
assert.equal(microtasks.length,1);microtasks.shift()();
assert.equal(current.visualStartedAt,900);assert.equal(gate.deadline,1420);assert.equal(current.duration,520);
now=1196;runDue();assert.equal(displayedHp,1000);assert.equal(numbers,0);
now=1197;runDue();
assert.equal(displayedHp,900);assert.deepEqual(events,["resources","recoil","audio"]);assert.equal(numbers,1);
assert.equal(node.style.visibility,"visible");assert.equal(node.style.animationPlayState,"running");
collector.registerImpactRequest({side:"monster",index:0,impactId:"normal:0",impactAt:0},timing);
assert.equal(numbers,1);runDue();assert.equal(numbers,2); // late hit still batches after its request is registered
assert.equal(current.done,undefined);assert.equal(cancelled,0); // overdue cleanup cannot truncate the real 140ms tail
now+=139;runDue();assert.equal(cancelled,0);
now+=1;runDue();assert.equal(cancelled,1);assert.equal(context.state.current,null);
// Disposal during pending setup must not start an abandoned clock or project stale HP.
const abandoned={...current,sequence:2,done:false,firstVisibleFrameAt:0,timelineRequested:false,presentationReadyAt:0,hitReached:false,hitCallbacks:new Map(),gate:{done:false,config:{duration:520},complete(){this.done=true;}}};
context.state.current=abandoned;let stale=false;
context.queueTargetHit(abandoned,0,()=>{stale=true;});context.requestImpactTimeline(abandoned);
context.cleanupCurrent(abandoned,"dispose");microtasks.shift()();assert.equal(stale,false);assert.equal(context.state.current,null);assert.equal(abandoned.firstVisibleFrameAt,0);
console.log("Cold setup >520ms: synchronous formal HP, one deferred .57 hit clock, resource/float/audio/artwork causality, 140ms tail and pending disposal PASS");
