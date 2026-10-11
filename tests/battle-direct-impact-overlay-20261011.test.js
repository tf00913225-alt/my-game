'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/39-v143-skill-animation.js','utf8');
const slice=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
function fixture(count=6){
 const body={children:[],appendChild(n){this.children.push(n);n.parent=this;}};
 const motions=[],jobs=[],events=new Map(),facts=new Map();
 const node=()=>({style:{},dataset:{},isConnected:true,children:[],setAttribute(){},appendChild(n){this.children.push(n);n.parent=this;},remove(){this.removed=true;this.isConnected=false;if(this.parent){this.parent.children=this.parent.children.filter(n=>n!==this);}},animate(frames,options){const a={frames,options,cancelled:false,cancel(){this.cancelled=true;}};motions.push(a);return a;}});
 const arts=Array.from({length:count},node),entities=arts.map(()=>({hp:100,alive:true}));
 const cards=arts.map(art=>({querySelector:()=>art}));
 // Match browser DOMRect: coordinates are non-enumerable prototype properties.
 const projections=arts.map((_,i)=>({rect:Object.create({left:20+i*50,top:i%2?180:70,width:i===count-1?180:40,height:i===count-1?240:80}),backgroundImage:'url("target-'+i+'.webp")',backgroundSize:'contain',backgroundPosition:'center',backgroundRepeat:'no-repeat'}));
 const current={sequence:1,config:{id:'iceArrowRain',category:'magic',targetType:'all'},done:false,hitReached:true,targetSide:'monster'};
 const listeners=new Map();
 const context={window:{FourSymbolsBattlefieldRenderGeometry:{getUnitGeometry:(_side,i)=>({artworkProjection:projections[i]})},FourSymbolsCombatEvents:{lastDamageFor:e=>facts.get(e),subscribe:(event,fn)=>events.set(event,fn)}},document:{body,createElement:node,getElementById:()=>({classList:{contains:()=>true}}),addEventListener:(type,fn)=>listeners.set(type,fn)},state:{current,impactEpoch:0,impactFlashes:new Map(),hitOverlay:null,metrics:{delayedNumbers:0}},entityFor:(_side,i)=>entities[i],cardFor:(_side,i)=>cards[i],Date:{now:()=>100},delayFor:()=>0,setTimer:fn=>jobs.push(fn),director:{dispose:()=>context.clearImpactOverlays()}};
 vm.createContext(context);
 vm.runInContext(slice('    function clearImpactOverlays(','    function clearTimers(')+slice('    function queueTargetHit(','    function requestImpactTimeline(')+slice('    window.v143ResolveBattleFeedbackTiming=function','    if(typeof applySkillDebuffEffectsToPlayer'),context);
 for(let i=0;i<count;i++)context.captureImpactTarget(current,current.targetSide,i);
 const main=fs.readFileSync('js/00-main.js','utf8');
 context.getFormalDamageContext=options=>({damageKind:'direct',sourceType:'activeSkill',...options});
 context.getCombatantHealthSnapshot=e=>({hp:e.hp,maxHP:100});context.combatDamageFacts=facts;
 context.emitCombatEvent=(type,event)=>events.get(type)?.(event);
 vm.runInContext(main.slice(main.indexOf('function settleBattleHpDamage('),main.indexOf('\nfunction ',main.indexOf('function settleBattleHpDamage(')+1)),context);
 return {context,body,arts,entities,cards,projections,motions,jobs,events,facts,current,listeners};
}
for(const count of [1,3,6]){
 const f=fixture(count);
 for(let i=0;i<count;i++)f.context.window.v143ResolveBattleFeedbackTiming('monster',i,'damage',false);
 assert.equal(f.context.state.impactFlashes.size,count);
 assert.equal(f.body.children.length,1,'one shared root regardless of target count');
 assert.equal(f.jobs.length,0,'no new hit, cleanup or gate timer');
 for(const [art,e] of f.context.state.impactFlashes){
  const i=f.arts.indexOf(art),p=f.projections[i];
  assert.equal(e.node.style.left,p.rect.left+'px');assert.equal(e.node.style.width,p.rect.width+'px');
  assert.equal(e.node.style.backgroundImage,p.backgroundImage);
  assert.equal(e.animation.options.duration,200);
  assert.deepEqual(Array.from(e.animation.frames,k=>[k.offset,k.opacity]),[[0,1],[.4,0],[.6,1],[1,0]]);
  assert.equal(art.v143ImpactRecoil.options.duration,140,'existing recoil unchanged');
 }
 const entries=[...f.context.state.impactFlashes.values()];entries.forEach(e=>e.animation.onfinish());
 assert.equal(f.body.children.length,0);assert.equal(f.context.state.impactFlashes.size,0);
 assert.equal(f.current.done,false,'flash lifetime never completes the action gate');
}
for(const kind of ['heal','sp','shield','miss','status','resist']){
 const f=fixture();f.context.window.v143ResolveBattleFeedbackTiming('monster',0,kind,false);assert.equal(f.context.state.impactFlashes.size,0,kind);
}
const generic=fixture(1);
generic.projections[0].backgroundImage='none';
generic.projections[0].genericPortrait=true;
generic.context.window.v143ResolveBattleFeedbackTiming('monster',0,'damage',false);
assert.equal(generic.context.state.impactFlashes.size,1,'formal neutral artwork still flashes without an image asset');
assert.match([...generic.context.state.impactFlashes.values()][0].node.className,/v174-generic-portrait/);
assert.equal(generic.jobs.length,0,'neutral artwork shares the existing hit clock');
for(const sourceType of ['dot','relic','reflect','environment','self','hpCost']){
 const f=fixture();f.facts.set(f.entities[0],{sourceType,damageKind:sourceType==='dot'?'dot':'direct'});
 f.context.window.v143ResolveBattleFeedbackTiming('monster',0,'damage',false);assert.equal(f.context.state.impactFlashes.size,0,sourceType+' during active direct cast');
}
for(const category of ['heal','buff','debuff','dot']){
 const f=fixture();f.current.config={id:'support',category};f.context.window.v143ResolveBattleFeedbackTiming('monster',0,'damage',false);assert.equal(f.context.state.impactFlashes.size,0,category);
}
for(const reason of ['death','departure','battle-end','dispose','supersede','navigation']){
 const f=fixture(1);f.context.window.v143ResolveBattleFeedbackTiming('monster',0,'criticalDamage',true);
 const entry=[...f.context.state.impactFlashes.values()][0];
 if(reason==='death'){f.entities[0].hp=0;f.events.get('hp_damage')({target:f.entities[0]});}
 else if(reason==='departure'){f.arts[0].isConnected=false;f.context.syncImpactOverlays();}
 else if(reason==='battle-end'){f.events.get('battle_end')({});}
 else{f.context.clearImpactOverlays();}
 assert.equal(f.context.state.impactFlashes.size,0,reason);assert.equal(f.body.children.length,0,reason);assert.ok(entry.node.removed&&entry.animation.cancelled,reason);
}
const repeat=fixture(1);repeat.context.window.v143ResolveBattleFeedbackTiming('monster',0,'damage');const old=[...repeat.context.state.impactFlashes.values()][0];const obsoleteFinish=old.animation.onfinish;
repeat.context.window.v143ResolveBattleFeedbackTiming('monster',0,'damage');const latest=[...repeat.context.state.impactFlashes.values()][0];obsoleteFinish();assert.equal(repeat.context.state.impactFlashes.get(repeat.arts[0]),latest);assert.ok(old.node.removed);
// A queued hit from an abandoned cast cannot resurrect feedback after supersede.
const abandoned=fixture(1);abandoned.context.delayFor=()=>50;
abandoned.context.window.v143ResolveBattleFeedbackTiming('monster',0,'damage');
assert.equal(abandoned.jobs.length,1);
abandoned.context.state.current={sequence:2,done:false};abandoned.jobs[0]();
assert.equal(abandoned.context.state.impactFlashes.size,0);
// Clearing before the sole hit callback fires invalidates that presentation
// generation without completing, delaying or replacing the current action.
const endedEarly=fixture(1);endedEarly.context.delayFor=()=>50;
endedEarly.context.window.v143ResolveBattleFeedbackTiming('monster',0,'damage');
endedEarly.events.get('battle_end')({});endedEarly.jobs[0]();
assert.equal(endedEarly.context.state.impactFlashes.size,0);
assert.equal(endedEarly.current.done,false);
assert.equal(endedEarly.body.children.length,0);
const css=fs.readFileSync('css/40-v143-combat-dungeon-polish.css','utf8'),hudCss=fs.readFileSync('css/fixed-slot-battlefield-rendering-v2.css','utf8');
// Use the real committed HP settlement, its event, and the sole V143 callback.
for(const side of ['monster','player']){
 const f=fixture(3);f.current.targetSide=side;
 for(let i=0;i<3;i++)f.context.captureImpactTarget(f.current,side,i);
 f.current.model={sprite:{impactOnly:true}};f.current.hitReached=false;
 f.entities[0].hp=1;f.entities[2].hp=1;
 for(let i=0;i<3;i++){
  const before=f.entities[i].hp;
  assert.equal(f.context.settleBattleHpDamage(f.entities[i],1,{}),1);
  assert.equal(f.entities[i].hp,before-1,'HP commits before presentation');
  f.context.window.v143ResolveBattleFeedbackTiming(side,i,'damage');
  if(i!==1){f.entities[i].alive=false;f.context.clearImpactTarget(side,i,'death');}
 }
 assert.equal(f.context.state.impactFlashes.size,0,'no second hit clock');
 // Death removes its DOM and geometry; snapshot is from the formal projection.
 f.arts[0].isConnected=false;f.cards[0]=null;f.projections[0].rect.left=999;
 f.context.clearImpactOverlays('render');
 for(const callbacks of f.current.hitCallbacks.values())callbacks.forEach(c=>c.callback());
 assert.equal(f.context.state.impactFlashes.size,3,'mixed lethal/live AOE '+side);
 const entries=[...f.context.state.impactFlashes.values()];
 assert.equal(entries[0].node.style.left,'20px','official pre-death geometry snapshot');
 entries.forEach(e=>{
  assert.equal(e.animation.options.duration,200);
  assert.deepEqual(Array.from(e.animation.frames,k=>[k.offset,k.opacity]),[[0,1],[.4,0],[.6,1],[1,0]]);
 });
 f.context.syncImpactOverlays();assert.equal(f.context.state.impactFlashes.size,3);
 f.context.window.v143ResolveBattleFeedbackTiming(side,0,'damage');
 assert.equal(f.context.state.impactFlashes.size,3,'a dead target cannot replay consumed credit');
 assert.equal(f.context.settleBattleHpDamage(f.entities[0],1,{}),0);
 f.context.window.v143ResolveBattleFeedbackTiming(side,0,'damage');
 assert.equal(f.context.state.impactFlashes.get(f.arts[0]),entries[0],'invalid post-death damage cannot replace or cancel the committed lethal hit');
 entries.forEach(e=>e.animation.onfinish());assert.equal(f.context.state.impactFlashes.size,0);
 assert.equal(f.current.done,false);assert.equal(f.jobs.length,0,'no hit/cleanup/gameplay timer added');
}
for(const terminalFirst of [false,true]){
 const f=fixture(1);f.entities[0].hp=1;
 f.current.model={sprite:{impactOnly:true}};f.current.hitReached=false;
 f.context.settleBattleHpDamage(f.entities[0],1,{});
 f.context.window.v143ResolveBattleFeedbackTiming('monster',0,'damage');
 const callback=f.current.hitCallbacks.get(0)[0].callback;
 f.entities[0].alive=false;
 if(!terminalFirst)callback();
 f.events.get('battle_end')({});f.context.battleActive=false;
 assert.ok(f.context.window.v143HasTerminalImpactPresentation(),'visible terminal hit remains owned');
 if(terminalFirst)callback();
 assert.equal(f.context.state.impactFlashes.size,1,'last enemy lethal feedback survives battle_end');
 assert.equal(f.context.battleActive,false,'battle_end has already committed');
 assert.equal(f.current.done,false,'feedback does not acquire or complete a gate');
 [...f.context.state.impactFlashes.values()][0].animation.onfinish();
 assert.equal(f.context.window.v143HasTerminalImpactPresentation(),false);
 callback();assert.equal(f.context.state.impactFlashes.size,0,'old callback cannot replay lethal hit');
 assert.equal(f.motions.length,2,'old callback cannot replay the recoil either');
 f.entities[0].hp=1;
 f.context.settleBattleHpDamage(f.entities[0],1,{});
 f.context.window.v143ResolveBattleFeedbackTiming('monster',0,'damage');
 assert.equal(f.context.state.impactFlashes.size,0,'post-settlement recovery cannot reopen lethal credit');
}
for(const invalidation of ['dispose','supersede','navigation','new-battle','pagehide','hidden','unloaded','identity']){
 const f=fixture(1);f.entities[0].hp=1;f.context.delayFor=()=>50;
 f.context.settleBattleHpDamage(f.entities[0],1,{});
 f.context.window.v143ResolveBattleFeedbackTiming('monster',0,'damage');
 const callback=f.jobs[0];
 if(invalidation==='identity')f.entities[0]={hp:0,alive:false};
 else if(invalidation==='hidden'){f.context.document.hidden=true;f.listeners.get('visibilitychange')();}
 else if(invalidation==='unloaded'){f.context.document.getElementById=()=>null;f.context.syncImpactOverlays();}
 else f.context.clearImpactOverlays();
 callback();assert.equal(f.context.state.impactFlashes.size,0,invalidation+' cannot resurrect');
 f.context.settleBattleHpDamage(f.entities[0],1,{});
 f.context.window.v143ResolveBattleFeedbackTiming('monster',0,'damage');
 f.jobs.slice(1).forEach(fn=>fn());assert.equal(f.context.state.impactFlashes.size,0,'post-death/new-generation event rejected');
}
for(const sourceType of ['dot','relic','reflect','environment','self','hpCost']){
 const f=fixture(1);f.entities[0].hp=1;
 f.context.settleBattleHpDamage(f.entities[0],1,{sourceType,damageKind:sourceType==='dot'?'dot':'direct'});
 f.context.window.v143ResolveBattleFeedbackTiming('monster',0,'damage');
 assert.equal(f.context.state.impactFlashes.size,0,'lethal '+sourceType+' never earns direct-hit credit');
}
assert.doesNotMatch(source,/killMonster=function/,'V143 does not defer core death settlement');
{
 const f=fixture(1);f.context.window.v143ResolveBattleFeedbackTiming('player',0,'damage');
 assert.equal(f.motions.length,0,'matching numeric index on the wrong side is not this cast target');
}
{
 const f=fixture(1);f.entities[0].hp=0;f.entities[0].alive=false;
 f.context.window.v143ResolveBattleFeedbackTiming('monster',0,'damage');
 assert.equal(f.motions.length,0,'arbitrary dead-target feedback produces neither overlay nor recoil');
}
{
 const f=fixture(1);f.entities[0].hp=2;f.context.delayFor=()=>50;
 f.context.settleBattleHpDamage(f.entities[0],1,{});f.context.window.v143ResolveBattleFeedbackTiming('monster',0,'damage');
 f.context.settleBattleHpDamage(f.entities[0],1,{sourceType:'dot',damageKind:'dot'});
 f.jobs[0]();assert.equal(f.motions.length,0,'a prior nonlethal hit cannot become a lethal presentation credit after DOT death');
}
// Exercise the actual V142 terminal/dispose/pagehide bridge, not a label-only clear.
{
 const f=fixture(1),windowEvents=new Map();f.entities[0].hp=1;
 f.context.window.addEventListener=(type,fn)=>windowEvents.set(type,fn);
 f.context.checkBattleEnd=()=>true;
 const bridge=fs.readFileSync('js/37-v142-skill-animation.js','utf8');
 vm.runInContext(bridge.slice(bridge.indexOf('    if(typeof checkBattleEnd==='),bridge.indexOf('\n})();',bridge.indexOf('    if(typeof checkBattleEnd==='))),f.context);
 f.context.settleBattleHpDamage(f.entities[0],1,{});f.context.window.v143ResolveBattleFeedbackTiming('monster',0,'damage');
 assert.equal(f.context.checkBattleEnd(),true);assert.equal(f.context.state.impactFlashes.size,1,'core terminal decision before the existing exit notification preserves the hit');
 f.events.get('battle_end')({});f.context.battleActive=false;
 assert.equal(f.context.checkBattleEnd(),true);assert.equal(f.context.state.impactFlashes.size,1,'terminal bridge never delays core completion or disposes visible lethal hit');
 windowEvents.get('pagehide')();assert.equal(f.context.state.impactFlashes.size,0,'real pagehide bridge immediately disposes');
}
// Core death and end decisions run synchronously while the presentation is queued.
{
 const f=fixture(1);f.entities[0].hp=1;f.entities[0].noRewards=true;
 f.current.model={sprite:{impactOnly:true}};f.current.hitReached=false;
 const main=fs.readFileSync('js/00-main.js','utf8');
 Object.assign(f.context,{monsters:f.entities,currentBattleMonsters:[0],battleActive:true,
  $:()=>null,addBattleLog(){},updateMonsterUI:()=>f.context.syncImpactOverlays(),
  getExistingPartyIndexes:()=>[0],getPartyCharacterByIndex:()=>({hp:100}),
  winBattle(){f.context.emitCombatEvent('battle_end',{});f.context.battleActive=false;}});
 const killStart=main.indexOf('function killMonster('),endStart=main.indexOf('function checkBattleEnd(');
 vm.runInContext(main.slice(killStart,main.indexOf('\n/*',killStart))+main.slice(endStart,main.indexOf('\nfunction applyPostBattleAutoRecovery(',endStart)),f.context);
 f.context.settleBattleHpDamage(f.entities[0],1,{});f.context.window.v143ResolveBattleFeedbackTiming('monster',0,'damage');
 assert.equal(f.context.checkBattleEnd(),true);assert.equal(f.entities[0].alive,false);assert.equal(f.context.battleActive,false);
 assert.equal(f.jobs.length,0,'no death, battle_end or presentation cleanup timer');
 f.current.hitCallbacks.get(0).forEach(c=>c.callback());assert.equal(f.context.state.impactFlashes.size,1);
}
{
 const f=fixture(1);f.context.battleToken=7;f.context.captureImpactTarget(f.current,'monster',0);
 f.entities[0].hp=1;f.context.delayFor=()=>50;
 f.context.settleBattleHpDamage(f.entities[0],1,{});f.context.window.v143ResolveBattleFeedbackTiming('monster',0,'damage');
 f.events.get('battle_end')({});f.context.battleActive=false;f.context.battleToken++;
 f.jobs[0]();assert.equal(f.context.state.impactFlashes.size,1,'only the terminal generation increment is permitted');
 f.context.battleToken++;f.context.syncImpactOverlays();assert.equal(f.context.state.impactFlashes.size,0,'another battle token immediately invalidates the snapshot');
}
assert.match(css,/\.v143-hit-feedback-overlay\{[^}]*z-index:16010;[^}]*pointer-events:none/s);assert.match(hudCss,/\.v174-battle-hud-layer\{[^}]*z-index:16015/);
assert.doesNotMatch(source,/const flash=artwork.animate/);
console.log('Direct impact overlay: one root, exact official artwork projection, 80/40/80, all targets, terminal cleanup, indirect exclusion and unchanged action/recoil PASS');
