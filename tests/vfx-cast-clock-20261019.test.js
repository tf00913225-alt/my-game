"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const source=fs.readFileSync("js/39-v143-skill-animation.js","utf8");
const between=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
function fixture(withRaf=true){
    let now=100;const frames=[],jobs=[],events=[];
    const tracks=[{animationName:"v143RasterCastFrames"},{animationName:"v143RasterTravel"},{animationName:"unrelated",startTime:7}];
    const current={model:{hit:7/12,sprite:{}},duration:1200,startedAt:10,firstVisibleFrameAt:0,targetSide:"monster",targetIndexes:[0,2],emitted:new Set([0,2]),spriteNodes:new Map([["0",{getAnimations:()=>tracks}],["2",{getAnimations:()=>tracks.slice(0,1)}]]),gate:{}};
    const context={state:{current,pendingUpdates:new Map(),metrics:{completed:0},impactFlashes:new Map()},Date:{now:()=>now},performance:{now:()=>now-100},Number,Map,Set,
        setTimer:(fn,delay)=>{jobs.push({fn,delay});return jobs.length;},clearTimeout(){},window:{},syncStatusVisualEffects(){},cardFor:()=>null};
    if(withRaf)context.requestAnimationFrame=fn=>frames.push(fn);
    vm.createContext(context);
    vm.runInContext(between("    function queueTargetHit(","    function requestImpactTimeline("),context);
    vm.runInContext(between("    function targetHitTime(","    function settleTargetVisual("),context);
    vm.runInContext(between("    function cleanupCurrent(","    let sequence="),context);
    context.settleTargetVisual=(_c,index)=>events.push(index);
    current.gate.restartVisualTimeline=duration=>events.push(["restart",duration]);
    current.gate.complete=function(){this.done=true;};
    return {context,current,frames,jobs,events,tracks,setNow:value=>{now=value;}};
}
{
    const f=fixture();let called=0;
    assert.equal(f.context.queueTargetHit(f.current,1,()=>called++,"feedback","monster"),false,"nonemitted targets cannot strand callbacks");
    assert.equal(f.context.queueTargetHit(f.current,0,()=>called++,"projection","monster"),true);
    f.context.requestCastTimeline(f.current);f.context.requestCastTimeline(f.current);
    assert.equal(f.frames.length,1,"one handoff only; no procedural frame loop");
    assert.equal(f.current.gate.visualTimelinePending,true);assert.equal(f.current.firstVisibleFrameAt,0);assert.equal(f.jobs.length,0);assert.equal(called,0);
    f.setNow(450);f.frames.shift()(350);
    assert.equal(f.current.visualStartedAt,450);assert.equal(f.current.gate.visualTimelinePending,false);
    assert.equal(f.tracks[0].startTime,350);assert.equal(f.tracks[1].startTime,350);assert.equal(f.tracks[2].startTime,7);
    assert.equal(f.frames.length,0,"handoff does not recursively schedule frames");
    assert.deepEqual(f.jobs.map(job=>job.delay),[1200,700,700],"all targets use the same authored hit offset");
    f.jobs[1].fn();f.jobs[2].fn();
    assert.equal(f.frames.length,2,"each target timer hands off exactly once to the paint clock");
    assert.deepEqual(f.events,[["restart",1200]],"timer task must not present against an old CSS timeline sample");
    f.frames.shift()(1050);f.frames.shift()(1050);
    assert.deepEqual(f.events,[["restart",1200],0,2]);
    assert.equal(f.frames.length,0,"hit callbacks cannot create a procedural frame loop");
}
{
    const f=fixture();f.setNow(450);
    f.current.spriteNodes=new Map([["0",{getAnimations(){f.setNow(750);return f.tracks;}}]]);
    f.context.requestCastTimeline(f.current);f.frames.shift()(350);
    assert.equal(f.current.animationStartTimeline,650,"read the performance clock after expensive style creation");
    assert.equal(f.current.visualStartedAt,750,"Date and performance clocks preserve the fixture's 100ms origin offset");
    assert.equal(f.tracks[0].startTime,650,"stale RAF timestamp must not advance the CSS animation by setup latency");
    assert.deepEqual(f.jobs.map(job=>job.delay),[1200,700,700]);
}
{
    const f=fixture();const badTrack={animationName:"v143RasterCastFrames",set startTime(_){throw new Error("unsupported setter");}};
    f.current.spriteNodes=new Map([["0",{getAnimations(){throw new Error("unsupported CSS animation enumeration");}}],["2",{getAnimations:()=>[badTrack,f.tracks[0]]}]]);
    f.context.requestCastTimeline(f.current);f.frames.shift()(350);
    assert.equal(f.context.state.metrics.clockAlignmentFailures,2);
    assert.equal(f.current.gate.visualTimelinePending,false,"optional animation API failures cannot strand the visual lifecycle");
    assert.equal(f.current.visualStartedAt,100);assert.equal(f.tracks[0].startTime,0,"a failed track must not prevent other tracks aligning");
    assert.equal(f.jobs.length,3);
}
for(const reason of ["dispose","superseded"]){
    const f=fixture();f.current.pendingUpdateKeys=new Set(["monster-resources:0"]);f.context.state.pendingUpdates.set("monster-resources:0",true);
    f.context.queueTargetHit(f.current,0,()=>assert.fail("abandoned callback ran"),"projection","monster");
    f.context.requestCastTimeline(f.current);f.context.cleanupCurrent(f.current,reason);f.frames.shift()(350);
    assert.equal(f.current.firstVisibleFrameAt,0);assert.equal(f.current.hitCallbacks.size,0);assert.equal(f.context.state.pendingUpdates.size,0);assert.equal(f.jobs.length,0);
}
{
    const f=fixture(false);f.context.requestCastTimeline(f.current);
    assert.equal(f.current.firstVisibleFrameAt,100);assert.equal(f.current.animationStartTimeline,null);assert.equal(f.current.gate.visualTimelinePending,false);assert.equal(f.jobs.length,3);
    f.jobs[1].fn();assert.deepEqual(f.events,[["restart",1200],0],"no-RAF fallback presents synchronously");
}
console.log("Ordinary cast RAF handoff, raster track alignment, shared targets, non-target rejection, disposal and synchronous fallback PASS");
