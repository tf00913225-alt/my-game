"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),vm=require("node:vm"),fs=require("node:fs");
function harness(){
    let now=1000,reduced=false,next=0;const timers=new Map(),created=[];
    const window={matchMedia:()=>({matches:reduced})};
    const node=()=>({attributes:[],textContent:"",style:{},dataset:{},setAttribute(name,value){this.attributes.push({name,value});},
        animate(frames,options){const a=animation();a.frames=frames;a.options=options;(this.animations||(this.animations=[])).push(a);return a;},
        remove(){this.detached=true;},removeAttribute(name){this.attributes=this.attributes.filter(a=>a.name!==name);},getAnimations(){return this.animations||[];}});
    const source=fs.readFileSync("js/39-v143-skill-animation.js","utf8").replace("/* @battle-vfx-feedback-config */ null",fs.readFileSync("config/battle-vfx-feedback.json","utf8"));
    vm.runInNewContext(source.split("/* =====================================================")[0],{window,document:{getElementById(){return {getBoundingClientRect:()=>({left:0,top:0,width:400,height:700})};},createElement(){const n=node();created.push(n);return n;}},Date:{now:()=>now},setTimeout(fn,ms){timers.set(++next,{fn,ms});return next;},clearTimeout(id){timers.delete(id);}});
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
test("each sweep recipient gets one 50ms stop; existing paused tracks and gate deadline remain intact",()=>{
    const h=harness(),running=h.animation(),paused=h.animation("paused"),finished=h.animation("finished"),cast=h.animation();cast.hitFeedbackDeadline=1750;
    const root=h.root([running,paused,finished,cast]),f=h.api.create("stormFlurry");
    f.hit({key:0,damage:168,roots:[root]});assert.equal(running.playState,"paused");assert.equal(h.timers.values().next().value.ms,50);
    f.hit({key:0,damage:168,roots:[root]});assert.equal(h.timers.size,1);assert.equal(root.shakes.length,1);
    h.advance(50);assert.equal(running.playState,"running");assert.equal(paused.playState,"paused");assert.equal(finished.playState,"finished");
    assert.equal(running.playbackRate,1);assert.equal(cast.playbackRate,750/700);
    h.advance(50);f.hit({key:1,damage:168,roots:[root]});assert.equal(root.shakes.length,2);assert.equal(root.shakes[0].playState,"idle");assert.equal(h.timers.size,1);
});
test("shake uses additive transforms, damage scaling, .85 decay and cancellation",()=>{
    const h=harness(),r=h.root([]),f=h.api.create("stormFlurry");f.hit({key:0,damage:336,roots:[r]});
    const a=r.shakes[0];assert.equal(a.options.composite,"add");assert.equal(a.frames[1].transform,"translate(8px,4px)");
    assert.equal(a.frames[2].transform,"translate(-6.8px,3.4px)");f.dispose();assert.equal(a.playState,"idle");assert.equal(h.timers.size,0);
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
test("wind accents stay bounded, use transform/opacity only, trail fades and dispose recycles every node",()=>{
    const h=harness(),children=[],host={appendChild:n=>children.push(n)},rect={left:0,top:0,width:80,height:100};
    h.api.config.skills.stormFlurry.maxEffectNodes=5;h.api.config.skills.stormFlurry.windCount=999;
    const f=h.api.create("stormFlurry");f.wind(host,[rect],2500);f.impact(host,rect,2,true,true,2500);
    assert.equal(f.effectCount(),5);assert.equal(children.length,5);
    children.forEach(n=>n.animations.forEach(a=>assert.ok(a.frames.every(k=>Object.keys(k).every(p=>["transform","opacity","offset"].includes(p))))));
    f.dispose();assert.equal(f.effectCount(),0);assert.equal(h.api.poolSize("wind-effect"),5);
    h.api.config.skills.stormFlurry.maxEffectNodes=48;const g=h.api.create("stormFlurry");g.impact(host,rect,2,true,false,2500);
    assert.ok(children.some(n=>n.dataset.feedbackEffect==="trail"&&n.animations.at(-1).frames.at(-1).opacity===0));
    assert.ok(children.some(n=>n.dataset.feedbackEffect==="screen-flash"));g.dispose();
});
