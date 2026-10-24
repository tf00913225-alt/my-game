"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),vm=require("node:vm"),fs=require("node:fs");
function harness(){
    let now=1000,reduced=false,next=0;const timers=new Map(),created=[];
    const window={matchMedia:()=>({matches:reduced})};
    const node=()=>({attributes:[],textContent:"",remove(){this.detached=true;},removeAttribute(name){this.attributes=this.attributes.filter(a=>a.name!==name);},getAnimations(){return this.animations||[];}});
    vm.runInNewContext(fs.readFileSync("js/39-v143-skill-animation.js","utf8").split("/* =====================================================")[0],{window,document:{createElement(){const n=node();created.push(n);return n;}},Date:{now:()=>now},setTimeout(fn,ms){timers.set(++next,{fn,ms});return next;},clearTimeout(id){timers.delete(id);}});
    const animation=(state="running")=>({playState:state,playbackRate:1,currentTime:750,effect:{getTiming:()=>({duration:1500})},pause(){this.playState="paused";},play(){this.playState="running";},cancel(){this.playState="idle";}});
    const root=tracks=>({getAnimations:()=>tracks,animate(frames,options){const a=animation();a.frames=frames;a.options=options;this.shakes=(this.shakes||[]).concat(a);return a;}});
    return {api:window.FourSymbolsHitFeedback,timers,animation,root,created,setReduced(v){reduced=v;},advance(ms){now+=ms;const pending=Array.from(timers.values());timers.clear();pending.forEach(t=>t.fn());}};
}
test("opt-in defaults, overrides and disabled/MISS do not schedule effects",()=>{
    const h=harness();assert.equal(h.api.configFor("windSpell").enabled,false);
    h.api.config.skills.stormFlurry.shakePx=8;assert.equal(h.api.configFor("stormFlurry").shakePx,8);
    const f=h.api.create("stormFlurry"),r=h.root([]);assert.equal(f.hit({key:0,damage:0,roots:[r]}),false);
    h.api.setEnabled(false);assert.equal(f.config.enabled,false);assert.equal(f.hit({key:0,damage:100,roots:[r]}),false);assert.equal(h.timers.size,0);
});
test("50ms visual stop resumes only running tracks, preserves gate deadline and batches range hits",()=>{
    const h=harness(),running=h.animation(),paused=h.animation("paused"),finished=h.animation("finished"),cast=h.animation();cast.hitFeedbackDeadline=1750;
    const root=h.root([running,paused,finished,cast]),f=h.api.create("stormFlurry");
    f.hit({key:0,damage:168,roots:[root]});assert.equal(running.playState,"paused");assert.equal(h.timers.values().next().value.ms,50);
    f.hit({key:1,damage:168,roots:[root]});assert.equal(h.timers.size,1);assert.equal(root.shakes.length,1);
    h.advance(50);assert.equal(running.playState,"running");assert.equal(paused.playState,"paused");assert.equal(finished.playState,"finished");
    assert.equal(running.playbackRate,1);assert.equal(cast.playbackRate,750/700);
});
test("shake uses additive transforms, damage scaling, .85 decay and cancellation",()=>{
    const h=harness(),r=h.root([]),f=h.api.create("stormFlurry");f.hit({key:0,damage:336,roots:[r]});
    const a=r.shakes[0];assert.equal(a.options.composite,"add");assert.equal(a.frames[1].transform,"translate(12px,6px)");
    assert.equal(a.frames[2].transform,"translate(-10.2px,5.1px)");f.dispose();assert.equal(a.playState,"idle");assert.equal(h.timers.size,0);
});
test("reduced motion creates no stop or shake; disposal restores interrupted stop",()=>{
    const h=harness(),r=h.root([h.animation()]);h.setReduced(true);h.api.create("stormFlurry").hit({key:0,damage:168,roots:[r]});assert.equal(h.timers.size,0);
    h.setReduced(false);h.api.create("stormFlurry").hit({key:0,damage:168,roots:[r]});h.api.disposeAll();assert.equal(r.getAnimations()[0].playState,"running");assert.equal(h.timers.size,0);
});
test("variable dwell pins hit frame at .5; hit dwell doubles its original allocation; custom weights and total remain valid",()=>{
    const h=harness(),sprite={frames:12,columns:4,rows:3,hitFrame:7},c=h.api.configFor("stormFlurry");
    const frames=h.api.frameTrack(sprite,c,.5);assert.equal(frames[6].offset,.5);assert.equal(frames.at(-1).offset,1);
    assert.ok(frames.every(f=>Object.keys(f).every(k=>["transform","offset","easing"].includes(k))));
    assert.ok(Math.abs((frames[7].offset-frames[6].offset)-2*(.5/6))<1e-9);
    c.frameDurations=[1,2,1,1,1,1,1,1,1,1,1,1];const custom=h.api.frameTrack(sprite,c,.5);
    assert.equal(custom[6].offset,.5);assert.ok(custom.every((f,i)=>!i||f.offset>=custom[i-1].offset));
});
test("pool clears attributes, content, animations and motion references before reuse and remains bounded",()=>{
    const h=harness(),n=h.api.acquire("sprite"),a=h.animation();n.attributes=[{name:"style"},{name:"data-skill"}];n.textContent="old";n.animations=[a];n.v143FrameAnimation=a;
    h.api.release("sprite",n,1);assert.equal(a.playState,"idle");assert.equal(n.attributes.length,0);assert.equal(n.textContent,"");assert.equal(n.v143FrameAnimation,undefined);
    const extra=h.api.acquire("flash");h.api.release("sprite",extra,1);assert.equal(h.api.poolSize("sprite"),1);assert.equal(h.api.acquire("sprite"),n);
});
