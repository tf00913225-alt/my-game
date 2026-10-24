"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),vm=require("node:vm"),fs=require("node:fs");
function harness(){
    let now=1000,reduced=false,next=0;const timers=new Map(),created=[],frames=new Map(),draws=[];
    const ctx={drawImage(){},closePath(){},lineTo(){},setTransform(){},clearRect(){},save(){},restore(){},translate(){},rotate(){},scale(){},beginPath(){},ellipse(){draws.push("ellipse");},stroke(){},moveTo(){},quadraticCurveTo(){},fill(){draws.push("leaf");},fillRect(){draws.push("rect");}};
    const window={matchMedia:()=>({matches:reduced})};
    const node=()=>({attributes:[],textContent:"",style:{setProperty(k,v){this[k]=v;}},dataset:{},getContext:()=>ctx,setAttribute(name,value){this.attributes.push({name,value});},
        animate(frames,options){const a=animation();a.frames=frames;a.options=options;(this.animations||(this.animations=[])).push(a);return a;},
        remove(){this.detached=true;},removeAttribute(name){this.attributes=this.attributes.filter(a=>a.name!==name);},getAnimations(){return this.animations||[];}});
    const source=fs.readFileSync("js/39-v143-skill-animation.js","utf8").replace("/* @battle-vfx-feedback-config */ null",fs.readFileSync("config/battle-vfx-feedback.json","utf8"));
    vm.runInNewContext(source.split("/* =====================================================")[0],{window,document:{querySelectorAll(selector){return selector===".v143-feedback-dot"?created.filter(n=>n.className==="v143-feedback-dot"&&!n.detached):[];},getElementById(){return {getBoundingClientRect:()=>({left:0,top:0,width:400,height:700})};},createElement(){const n=node();created.push(n);return n;}},requestAnimationFrame(fn){frames.set(++next,fn);return next;},cancelAnimationFrame(id){frames.delete(id);},Date:{now:()=>now},setTimeout(fn,ms){timers.set(++next,{fn,ms});return next;},clearTimeout(id){timers.delete(id);}});
    const animation=(state="running")=>({playState:state,playbackRate:1,currentTime:750,effect:{getTiming:()=>({duration:1500})},pause(){this.playState="paused";},play(){this.playState="running";},cancel(){this.playState="idle";}});
    const root=tracks=>({getAnimations:()=>tracks,animate(frames,options){const a=animation();a.frames=frames;a.options=options;this.shakes=(this.shakes||[]).concat(a);return a;}});
    return {api:window.FourSymbolsHitFeedback,timers,frames,draws,animation,root,created,setReduced(v){reduced=v;},noPaint(ms){now+=ms;const pending=Array.from(timers.values());timers.clear();pending.forEach(t=>t.fn());},advance(ms){now+=ms;const pending=Array.from(timers.values());timers.clear();pending.forEach(t=>t.fn());const paints=Array.from(frames.values());frames.clear();paints.forEach(fn=>fn(now));}};
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
test("one pooled particle canvas stays bounded, renders native shapes and cancels its loop on dispose",()=>{
    const h=harness(),children=[],host={appendChild:n=>children.push(n),insertBefore:n=>children.push(n)},rect={left:0,top:0,width:80,height:100};
    h.api.config.skills.stormFlurry.maxEffectNodes=5;h.api.config.skills.stormFlurry.windCount=999;
    const f=h.api.create("stormFlurry");f.wind(host,[rect],2500);f.impact(host,rect,2,true,true,2500);
    assert.equal(f.effectCount(),5);assert.equal(children.length,1);h.advance(16);assert.ok(h.draws.length>0);
    const rasterizations=h.draws.length;h.advance(16);assert.equal(h.draws.length,rasterizations,"moving frames reuse rasterized glow instead of redrawing blurred shapes");
    f.dispose();assert.equal(f.effectCount(),0);assert.equal(h.api.poolSize("particle"),5);assert.equal(h.frames.size,0);assert.equal(h.api.poolSize("particle-canvas"),1);
    h.api.config.skills.stormFlurry.maxEffectNodes=48;const g=h.api.create("stormFlurry");g.impact(host,rect,2,true,false,2500);
    assert.ok(g.snapshot().some(n=>n.kind==="trail"));assert.ok(g.snapshot().some(n=>n.kind==="screen-flash"));
    assert.equal(children[1],children[0],"next cast reuses same layer canvas");h.advance(2000);assert.equal(g.effectCount(),0,"all tail particles expire naturally");g.dispose();
});
test("particle age freezes during hit stop and resumes without extending the skill deadline",()=>{
 const h=harness(),host={appendChild(){},insertBefore(){}},f=h.api.create("stormFlurry");f.wind(host,[{left:0,top:0,width:80,height:100}],2500);
 h.advance(16);const before=f.snapshot()[0].opacity;f.hit({key:0,damage:168,roots:[]});h.advance(32);assert.equal(f.snapshot()[0].opacity,before);
 h.advance(32);assert.notEqual(f.snapshot()[0].opacity,before);h.advance(1600);assert.equal(f.effectCount(),0);assert.equal(h.frames.size,0);f.dispose();
});
test("two hit stops without an intervening particle frame retain both paused intervals",()=>{
 const host={appendChild(){},insertBefore(){}},rect={left:0,top:0,width:80,height:100},h=harness(),f=h.api.create("stormFlurry");f.wind(host,[rect],2500);h.advance(16);
 f.hit({key:0,damage:168,roots:[]});h.noPaint(100);f.hit({key:1,damage:168,roots:[]});h.noPaint(50);h.advance(0);
 const control=harness(),g=control.api.create("stormFlurry");g.wind(host,[rect],2500);control.advance(66);
 assert.ok(Math.abs(f.snapshot()[0].opacity-g.snapshot()[0].opacity)<1e-9,"166ms wall time minus two50ms stops equals66ms particle age");f.dispose();g.dispose();
});


test("automatic profiles cover element/type tables, incomplete data and controlled four-skill rollout without mutating data",()=>{
 const h=harness(),a=h.api,source={element:"fire",category:"physical",targetType:"single",baseDamage:30,burnChance:50};
 const before=JSON.stringify(source),fire=a.configFor("flameSlash",source);assert.equal(fire.enabled,true);assert.equal(fire.profile.kind,"single");assert.equal(fire.profile.element,"fire");assert.equal(fire.colors[0],"#ff7733");assert.equal(JSON.stringify(source),before);
 for(const element of ["fire","water","wind","thunder","earth","light","dark","neutral"]){const p=a.resolveProfile("future",{element});assert.equal(p.element,element);assert.ok(p.colors.length>=2);}
 assert.equal(a.resolveProfile("future",{element:"ice"}).element,"water");assert.equal(a.resolveProfile("future",{description:"冰晶攻擊"}).element,"water");
 assert.equal(a.resolveProfile("future",{}).element,"neutral");assert.equal(a.resolveProfile("future",null).kind,"single");
 assert.equal(a.resolveProfile("future",{targetType:"column"}).kind,"multi");assert.equal(a.resolveProfile("future",{targetType:"all"}).kind,"all");
 assert.equal(a.configFor("future",{}).enabled,false);a.config.automatic.rolloutAll=true;assert.equal(a.configFor("future",{}).enabled,true);assert.equal(a.configFor("normal",{}).enabled,false);assert.equal(a.configFor("future",{category:"passive"}).enabled,false);
});
test("healing and shield profiles never stop or shake; support particles and sparse front plane dispose normally",()=>{
 const h=harness(),root=h.root([]),host={appendChild(){},insertBefore(){}},rect={left:10,top:30,width:80,height:100};
 const heal=h.api.create("healSpell",{category:"heal",element:"water",targetType:"allyTri"});assert.equal(heal.hit({key:0,damage:100,roots:[root]}),false);assert.equal(h.timers.size,0);
 heal.wind(host,[rect],2500);heal.support(host,rect,"heal",2500);assert.ok(heal.snapshot().some(e=>e.depth==="near"));assert.ok(heal.snapshot().filter(e=>e.depth==="near").length<=2);heal.dispose();assert.equal(h.frames.size,0);assert.equal(h.api.poolSize("particle-canvas"),2);
 const shield=h.api.create("rockWall",{category:"buff",element:"earth",description:"護盾"});assert.equal(shield.config.profile.kind,"shield");shield.support(host,rect,"shield",2500);assert.ok(shield.snapshot().some(e=>e.kind==="shield"));shield.dispose();
});
test("sustained slow particle frames lower only bounded decoration quality; damage and clocks are untouched",()=>{
 const h=harness(),f=h.api.create("stormFlurry",{element:"wind",targetType:"tri"}),host={appendChild(){},insertBefore(){}};f.wind(host,[{left:0,top:0,width:80,height:100}],2500);
 for(let i=0;i<8;i++)h.advance(40);assert.ok(h.api.quality()<1);assert.ok(h.api.quality()>=h.api.config.performance.minQuality);f.dispose();assert.equal(h.frames.size,0);
});


test("preview status badge follows the actual successful entry, never a different skill's same-named status",()=>{
 const h=harness(),a={type:"damageDown",turnsLeft:2},b={type:"damageDown",turnsLeft:2};assert.equal(h.api.statusEnabled("damageDown",a),false);h.api.markStatus(a);assert.equal(h.api.statusEnabled("damageDown",a),true);assert.equal(h.api.statusEnabled("damageDown",b),false);h.api.setEnabled(false);assert.equal(h.api.statusEnabled("damageDown",a),false);
});


test("persistent DOT accents are bounded, require an approved live status entry and clear on module disable",()=>{
 const h=harness(),entry={type:"burn",turnsLeft:2},hosts=[];for(let i=0;i<5;i++){const children=[];hosts.push({children,querySelector:()=>children[0]||null,appendChild:n=>children.push(n)});}
 h.api.decorateStatus(hosts[0],"burn",entry);assert.equal(hosts[0].children.length,0);h.api.markStatus(entry);
 for(const host of hosts){h.api.decorateStatus(host,"burn",entry);h.api.decorateStatus(host,"burn",entry);}
 assert.equal(hosts.reduce((n,h)=>n+h.children.length,0),8);assert.equal(hosts[0].children.length,2);h.api.setEnabled(false);assert.ok(h.created.filter(n=>n.className==="v143-feedback-dot").every(n=>n.detached));
});


test("retained status body drops preview DOT accents when its entry is replaced by another source",()=>{
 const h=harness(),children=[],host={querySelector:()=>children.find(n=>!n.detached)||null,querySelectorAll:()=>children.filter(n=>!n.detached),appendChild:n=>children.push(n)};
 const approved={type:"burn",turnsLeft:2};h.api.markStatus(approved);h.api.decorateStatus(host,"burn",approved);assert.equal(children.length,2);
 h.api.decorateStatus(host,"burn",{type:"burn",turnsLeft:2});assert.ok(children.every(n=>n.detached));
});
