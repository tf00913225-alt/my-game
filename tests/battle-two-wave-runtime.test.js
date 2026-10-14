"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const main=fs.readFileSync("js/00-main.js","utf8");
const declaration=name=>{const match=main.match(new RegExp("^function "+name+"\\([\\s\\S]*?^\\}","m"));assert.ok(match,name);return match[0];};
function runtime({deferred=false,realQueue=false}={}){
 const noop=()=>{},timers=[],party=[{hp:71,sp:23,rage:9,activeBuffs:[{remaining:2}],statusEffects:[{remaining:3}]},{hp:60,sp:17}],indicator={};let ready;
 const first=Array.from({length:6},(_,i)=>({id:"first"+i,hp:0,maxHP:100,maxSP:20,alive:true,agility:2}));
 const second=Array.from({length:6},(_,i)=>({id:"second"+i,hp:100,maxHP:100,maxSP:20,alive:true,agility:3}));
 const ctx={console,Promise,Set,Map,Array,Object,Number,Math,window:{},battleToken:7,battleActive:true,turn:4,monsters:first.slice(),currentBattleMonsters:first.map((_,i)=>i),selectedMonster:0,
 initiativeQueue:[{type:"player",characterIndex:0},{type:"player",characterIndex:1},...first.map((_,i)=>({type:"monster",monsterIndex:i}))],initiativeIndex:0,processedInitiativeIndexes:new Set(),battlePresentationLocks:new Set(),battleAdvanceScheduled:false,battlePhase:"resolve",timerId:null,
 getExistingPartyIndexes:()=>[0,1],getPartyCharacterByIndex:i=>party[i],getPartyBattleStats:()=>({agility:5}),getMonsterAgility:m=>m.agility,
 killMonster:i=>{ctx.monsters[i].alive=false;ctx.deaths++;},deaths:0,wins:0,losses:0,winBattle:()=>{ctx.wins++;ctx.battleActive=false;},loseBattle:()=>{ctx.losses++;ctx.battleActive=false;},
 closeMenus:noop,clearBattleTargetSelectionMode:noop,updateActionHudVisibility:noop,clearBattleActionWatchdog:noop,clearTransientBattlePresentation:()=>{ctx.cleanups++;},cleanups:0,
 renderBattle:()=>{ctx.snapshot=ctx.window.FourSymbolsBattlefieldSlots.createEnemyFormationSnapshot(ctx.currentBattleMonsters,{encounterMode:"tower",originalFormationType:6});ctx.window.FourSymbolsBattlefieldSlots.setActiveEnemySnapshot(ctx.snapshot);},
 isBattleTargetAlive:(type,i)=>!!ctx.monsters[i]?.alive,createEnemyActionTargetSnapshot:(i,token)=>({monster:ctx.monsters[i],index:i,token}),$:()=>indicator,addBattleLog:noop,startTurn:()=>{ctx.roundStarts++;},roundStarts:0,beginBattleRoundDeclaration:()=>{ctx.declarations++;},declarations:0,
 battleStatisticsFinishAction:noop,interceptBattleActionFinish:()=>ctx.intercept,intercept:false,notifyBattleActionFinished:()=>{ctx.actionFinishedEvents++;},actionFinishedEvents:0,finishBattleDurationAction:()=>{ctx.durationFinishes++;},durationFinishes:0,
 clearInterval:noop,setTimeout:(fn,delay)=>{timers.push({fn,delay});return timers.length;},getBattleAdvanceDelay:()=>{ctx.delayReads++;return 810;},delayReads:0,
 processNextCombatant:token=>{if(token===ctx.battleToken)ctx.commitBattleWaveTransition();},beginCharacterTurn:noop,getPartyAutoConfig:()=>({enabled:false}),autoBattle:false,activeBattleCharacterIndex:0};
 ctx.window=ctx;ctx.v154PreparePortraitsForEncounter=()=>deferred?new Promise(resolve=>{ready=resolve;}):{state:"ready"};ctx.v132AbortDungeonBattle=()=>{ctx.battleActive=false;ctx.aborted=true;};vm.createContext(ctx);
 vm.runInContext(fs.readFileSync("js/battlefield-slot-owner.js","utf8"),ctx);
 vm.runInContext(main.slice(main.indexOf("let battleWaveState=null;"),main.indexOf("const POST_ACTION_DELAY_MS=650;"))+["checkBattleEnd","buildInitiativeQueue","finishPlayerAction"].map(declaration).join("\n"),ctx);
 if(realQueue){
   Object.assign(ctx,{battleDurationAction:null,battleResolutionResumeToken:null,
     turnAdvancePending:false,notifyBeforeCombatant:noop,notifyBattleRoundBoundary:noop,
     armBattleActionWatchdog:noop,isMonsterFrozen:()=>false,isMonsterPetrified:()=>false,
     battleStatisticsBeginAction:noop,resolveQueuedPlayerAction:noop,processSingleMonsterAttack:noop});
   vm.runInContext(declaration("processNextCombatant"),ctx);
 }
 ctx.FourSymbolsBattleWaves.initialize("tower",[first,second]);
 return {ctx,party,first,second,timers,ready:()=>ready({state:"ready"}),finish:()=>ctx.finishPlayerAction(),flush:()=>{const t=timers.shift();assert.ok(t);t.fn();}};
}
test("first-wave death waits for formal action and single existing queue delay",()=>{const r=runtime(),c=r.ctx;assert.equal(c.checkBattleEnd(),false);assert.equal(c.wins,0);assert.equal(c.FourSymbolsBattleWaves.getState().phase,"WAVE_TRANSITION");assert.equal(c.commitBattleWaveTransition(),false);r.finish();r.finish();assert.equal(r.timers.length,1);assert.equal(c.delayReads,1);assert.equal(r.timers[0].delay,810);r.flush();assert.equal(c.FourSymbolsBattleWaves.getState().phase,"WAVE_2_ACTIVE");assert.equal(c.battleToken,7);assert.equal(c.turn,4);assert.equal(c.roundStarts,0);assert.deepEqual(Array.from(c.currentBattleMonsters),[6,7,8,9,10,11]);assert.ok(r.first.every((_,i)=>c.monsters[i]===undefined));assert.equal(c.cleanups,1);assert.equal(c.initiativeQueue.filter(e=>e.type==="monster").length,6);assert.deepEqual(Array.from(c.initiativeQueue.filter(e=>e.type!=="monster"),e=>e.characterIndex),[1]);});
test("player HP SP rage buffs debuffs and identity survive transition",()=>{const r=runtime(),before=JSON.stringify(r.party);r.finish();r.flush();assert.equal(JSON.stringify(r.party),before);assert.equal(r.ctx.getPartyCharacterByIndex(0),r.party[0]);assert.equal(r.ctx.deaths,6);assert.equal(r.ctx.FourSymbolsBattlefieldSlots.getActiveEnemySnapshot().battlefieldProfile,"standard-six");});
test("follow-up interception and presentation locks block transition",()=>{const r=runtime(),c=r.ctx;c.intercept=true;r.finish();assert.equal(r.timers.length,0);c.intercept=false;r.finish();c.battlePresentationLocks.add("relic");r.flush();assert.equal(c.FourSymbolsBattleWaves.getState().phase,"WAVE_TRANSITION");c.battlePresentationLocks.clear();assert.equal(c.commitBattleWaveTransition(),true);});
test("asynchronous portrait readiness resumes after the one action delay",async()=>{const r=runtime({deferred:true});r.finish();r.flush();assert.equal(r.ctx.FourSymbolsBattleWaves.getState().phase,"WAVE_TRANSITION");r.ready();await Promise.resolve();assert.equal(r.ctx.FourSymbolsBattleWaves.getState().phase,"WAVE_2_ACTIVE");assert.equal(r.ctx.delayReads,1);});
test("portrait callback from obsolete battle cannot spawn wave two",async()=>{const r=runtime({deferred:true});r.finish();r.flush();r.ctx.battleToken++;r.ready();await Promise.resolve();assert.equal(r.ctx.monsters.length,6);assert.equal(r.ctx.cleanups,0);});
test("defeat wins priority over wave transition and final settlement occurs once",()=>{const r=runtime();r.party.forEach(p=>p.hp=0);assert.equal(r.ctx.checkBattleEnd(),true);assert.equal(r.ctx.losses,1);assert.equal(r.ctx.wins,0);assert.equal(r.ctx.cleanups,0);const win=runtime();win.finish();win.flush();win.ctx.currentBattleMonsters.forEach(i=>win.ctx.monsters[i].hp=0);assert.equal(win.ctx.checkBattleEnd(),true);assert.equal(win.ctx.checkBattleEnd(),true);assert.equal(win.ctx.wins,1);assert.equal(win.ctx.FourSymbolsBattleWaves.getState().phase,"BATTLE_COMPLETE");});
test("invalid oversized and duplicate entity plans fail closed",()=>{const r=runtime();assert.throws(()=>r.ctx.FourSymbolsBattleWaves.validate("tower",[r.first,r.first]));assert.throws(()=>r.ctx.FourSymbolsBattleWaves.validate("boss",[r.first,r.second]));assert.throws(()=>r.ctx.FourSymbolsBattleWaves.validate("tower",[r.first,[...r.second,{}]]));});

function endFixture(r){
 const qa=fs.readFileSync(".github/scripts/battle-layer-audio-live-qa.mjs","utf8");
 const current=qa.match(/^function finishBattleLayerQaEndFixture\([\s\S]*?^\}/m);
 assert.ok(current,"actual QA end fixture declaration must exist");
 const source=current[0];
 r.ctx.__battleLayerQaEndResult={ended:false};
 vm.runInContext(source,r.ctx);
 return ()=>r.ctx.finishBattleLayerQaEndFixture();
}
test("QA end fixture consumes both waves through the formal settled queue without a dummy action",()=>{
 const r=runtime({realQueue:true}),finish=endFixture(r),before=JSON.stringify(r.party);
 assert.equal(finish(),false);
 assert.equal(r.ctx.FourSymbolsBattleWaves.getState().index,1);
 assert.deepEqual(Array.from(r.ctx.currentBattleMonsters),[6,7,8,9,10,11]);
 assert.equal(r.ctx.wins,0);assert.equal(r.ctx.actionFinishedEvents,0);
 assert.equal(r.ctx.durationFinishes,0);assert.equal(r.ctx.delayReads,0);
 assert.equal(JSON.stringify(r.party),before);
 assert.equal(finish(),true);assert.equal(r.ctx.wins,1);
 assert.equal(r.ctx.__battleLayerQaEndResult.ended,true);
 assert.equal(finish(),true);assert.equal(r.ctx.wins,1);
});
test("QA end fixture waits for unfinished actions, queued continuation and presentation locks",()=>{
 const r=runtime({realQueue:true}),finish=endFixture(r);
 r.first.forEach(m=>{m.hp=100;m.alive=true;});
 r.ctx.battleDurationAction={completed:false};
 assert.equal(finish(),false);assert.ok(r.first.every(m=>m.hp===100));
 r.ctx.battleDurationAction.completed=true;r.ctx.battleAdvanceScheduled=true;
 assert.equal(finish(),false);assert.ok(r.first.every(m=>m.hp===0));
 assert.equal(r.ctx.FourSymbolsBattleWaves.getState().index,0);
 r.first.forEach(m=>{m.hp=100;m.alive=true;});
 r.ctx.battleAdvanceScheduled=false;r.ctx.battlePresentationLocks.add("cinematic");
 r.ctx.FourSymbolsBattleFlow={isPresentationActive:()=>r.ctx.battlePresentationLocks.size>0};
 assert.equal(finish(),false);assert.ok(r.first.every(m=>m.hp===100));
 r.ctx.battlePresentationLocks.clear();
 assert.equal(finish(),false);assert.equal(r.ctx.FourSymbolsBattleWaves.getState().index,1);
 assert.equal(finish(),true);
});
test("QA end fixture handles manual declaration without inventing an action or round",()=>{
 const r=runtime({realQueue:true}),finish=endFixture(r);
 r.ctx.battlePhase="declare";
 assert.equal(finish(),false);
 assert.equal(r.ctx.FourSymbolsBattleWaves.getState().index,1);
 assert.equal(r.ctx.actionFinishedEvents,0);assert.equal(r.ctx.durationFinishes,0);
 assert.equal(r.ctx.delayReads,0);assert.equal(r.ctx.turn,4);
 assert.equal(finish(),true);assert.equal(r.ctx.wins,1);
});
test("QA end fixture retains deferred second-wave preparation and one final win",async()=>{
 const r=runtime({realQueue:true,deferred:true}),finish=endFixture(r);
 assert.equal(finish(),false);assert.equal(r.ctx.FourSymbolsBattleWaves.getState().phase,"WAVE_TRANSITION");
 assert.equal(r.ctx.wins,0);r.ready();await Promise.resolve();
 assert.equal(r.ctx.FourSymbolsBattleWaves.getState().index,1);
 assert.equal(finish(),true);assert.equal(r.ctx.wins,1);
});
test("QA end fixture preserves one-wave completion and already-finished behavior",()=>{
 const r=runtime({realQueue:true}),finish=endFixture(r);
 r.ctx.FourSymbolsBattleWaves.initialize("tower",null);
 assert.equal(finish(),true);assert.equal(r.ctx.wins,1);
 assert.equal(finish(),true);assert.equal(r.ctx.wins,1);
});

test("Abyss QA startup waits for the actual Policy, loader and Auth overlay without an unbound reference",()=>{
 const source=fs.readFileSync(".github/scripts/run-abyss-balance-browser-qa.mjs","utf8");
 const match=source.match(/await wait\(\(\)=>([^\n]+)\);/);
 assert.ok(match,"actual Abyss startup predicate");
 const state={policy:"READY",loaderHidden:false,authVisible:false};
 const context={window:{},document:{getElementById:id=>id==="startupLoader"?{hidden:state.loaderHidden}:
   {classList:{contains:()=>state.authVisible}}}};
 const read=()=>vm.runInNewContext("("+match[1]+")",context);
 assert.doesNotThrow(read);assert.equal(read(),false);
 context.window.FourSymbolsStartupPolicy={getState:()=>state.policy};
 assert.equal(read(),false);state.loaderHidden=true;assert.equal(read(),true);
 state.authVisible=true;assert.equal(read(),false);state.authVisible=false;
 state.policy="ERROR";assert.equal(read(),false);state.policy="AUTH_REQUIRED";assert.equal(read(),false);
});
