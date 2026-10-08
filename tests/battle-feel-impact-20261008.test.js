"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const source=fs.readFileSync("js/39-v143-skill-animation.js","utf8");
const start=source.indexOf("    window.v143ResolveBattleFeedbackTiming=function");
const end=source.indexOf('    if(typeof applySkillDebuffEffectsToPlayer',start);
const resolver=source.slice(start,end);
function fixture(config={id:"normal"}){
    const sounds=[],motions=[],timers=[];
    const artwork={animate(frames,options){motions.push({frames,options});return {cancel(){}};}};
    const current={done:false,sequence:1,targetSide:"monster",config};
    const context={window:{v141Audio:{play:kind=>sounds.push(kind),combatFeedbackVolumeScale:2}},
        state:{current,metrics:{delayedNumbers:0}},Date:{now:()=>100},
        delayFor:()=>config.wait??297,setTimer:fn=>timers.push(fn),cardFor:()=>({querySelector:sel=>{assert.equal(sel,".v174-battle-art");return artwork;}})};
    vm.createContext(context);vm.runInContext(resolver,context);
    return {context,sounds,motions,timers};
}
for(const kind of ["damage","criticalDamage","miss","heal","sp","shield","status"]){
    const f=fixture();const timing=f.context.window.v143ResolveBattleFeedbackTiming("monster",0,kind,kind==="criticalDamage");
    assert.equal(timing.delayMs,297);assert.equal(f.sounds.length,0);assert.equal(f.motions.length,0);
    f.timers.forEach(fn=>fn());
    const damage=kind==="damage"||kind==="criticalDamage";
    assert.equal(f.motions.length,damage?1:0);
    if(damage){assert.equal(f.motions[0].options.duration,140);assert.equal(f.motions[0].frames[1].translate,kind==="criticalDamage"?"0px -5px":"0px -4px");}
    const sound={damage:"damage",criticalDamage:"crit",miss:"dodge",shield:"block"}[kind];
    assert.deepEqual(f.sounds,sound?[sound]:[]);
}
const indirect=fixture({id:"healSpell",category:"heal"});indirect.context.window.v143ResolveBattleFeedbackTiming("monster",0,"damage");indirect.timers.forEach(fn=>fn());assert.equal(indirect.motions.length,0);
const noCast=fixture();noCast.context.state.current=null;noCast.context.window.v143ResolveBattleFeedbackTiming("monster",0,"damage");noCast.timers.forEach(fn=>fn());assert.equal(noCast.motions.length,0);
const expired=fixture({id:'normal',wait:0});expired.context.window.v143ResolveBattleFeedbackTiming('monster',0,'damage');assert.equal(expired.sounds.length,0);assert.equal(expired.motions.length,0);expired.timers.forEach(fn=>fn());assert.equal(expired.motions.length,1);
const scheduleStart=source.indexOf('    function scheduleStatusOwnedUiUpdate(');
const scheduleEnd=source.indexOf('    if(typeof document!=="undefined")',scheduleStart);
const calls=[],timers=[];const c={state:{pendingUpdates:new Map()},existingTargetDelay:()=>300,setTimer:fn=>timers.push(fn),window:{},syncStatusVisualsForUnit(){}};
vm.createContext(c);vm.runInContext(source.slice(scheduleStart,scheduleEnd),c);
for(const projection of ["status","resources","labels","defeated"]){c.window.v143SchedulePlayerStatusUiUpdate(0,()=>calls.push(projection),projection);}
assert.deepEqual(calls,[]);assert.equal(timers.length,4);timers.forEach(fn=>fn());assert.deepEqual(calls,["status","resources","labels","defeated"]);assert.equal(c.state.pendingUpdates.size,0);
const queued=[];const cold={state:{pendingUpdates:new Map(),current:{done:false,targetSide:'monster',emitted:new Set([0]),hitReached:false}},existingTargetDelay:()=>0,setTimer:fn=>queued.push(fn),window:{},syncStatusVisualsForUnit(){}};
let projected=false;vm.createContext(cold);vm.runInContext(source.slice(scheduleStart,scheduleEnd),cold);cold.window.v143ScheduleMonsterUiUpdate(0,()=>{projected=true;},'boss-shield');assert.equal(projected,false);assert.equal(queued.length,1);cold.state.current.hitReached=true;queued[0]();assert.equal(projected,true);
console.log("Battle feel: target-hit audio/artwork-only recoil, critical, non-damage exclusion and independent committed projections PASS");
const cleanupStart=source.indexOf('    function cleanupCurrent(');
const cleanupEnd=source.indexOf('    let sequence=',cleanupStart);
let cancelled=0;
const art={v143ImpactRecoil:{cancel(){cancelled++;}}};
const active={done:false,spriteNodes:[],targetIndexes:[0],targetSide:'monster'};
const cleanupContext={state:{current:active,stage:null,metrics:{completed:0}},cardFor:()=>({classList:{remove(){}},querySelector:()=>art}),syncStatusVisualEffects(){}};
vm.createContext(cleanupContext);vm.runInContext(source.slice(cleanupStart,cleanupEnd),cleanupContext);
cleanupContext.cleanupCurrent(active,'dispose');
assert.equal(cancelled,1);assert.equal(art.v143ImpactRecoil,null);assert.equal(cleanupContext.state.current,null);
