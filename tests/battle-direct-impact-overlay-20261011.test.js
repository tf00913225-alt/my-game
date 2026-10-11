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
 const projections=arts.map((_,i)=>({rect:{left:20+i*50,top:i%2?180:70,width:i===count-1?180:40,height:i===count-1?240:80},backgroundImage:'url("target-'+i+'.webp")',backgroundSize:'contain',backgroundPosition:'center',backgroundRepeat:'no-repeat'}));
 const current={sequence:1,config:{id:'iceArrowRain',category:'magic',targetType:'all'},done:false,hitReached:true,targetSide:'monster'};
 const context={window:{FourSymbolsBattlefieldRenderGeometry:{getUnitGeometry:(_side,i)=>({artworkProjection:projections[i]})},FourSymbolsCombatEvents:{lastDamageFor:e=>facts.get(e),subscribe:(event,fn)=>events.set(event,fn)}},document:{body,createElement:node,getElementById:()=>({classList:{contains:()=>true}})},state:{current,impactFlashes:new Map(),hitOverlay:null,metrics:{delayedNumbers:0}},entityFor:(_side,i)=>entities[i],cardFor:(_side,i)=>cards[i],Date:{now:()=>100},delayFor:()=>0,setTimer:fn=>jobs.push(fn)};
 vm.createContext(context);
 vm.runInContext(slice('    function clearImpactOverlays(','    function clearTimers(')+slice('    function queueTargetHit(','    function requestImpactTimeline(')+slice('    window.v143ResolveBattleFeedbackTiming=function','    if(typeof applySkillDebuffEffectsToPlayer'),context);
 return {context,body,arts,entities,cards,projections,motions,jobs,events,facts,current};
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
const css=fs.readFileSync('css/40-v143-combat-dungeon-polish.css','utf8'),hudCss=fs.readFileSync('css/fixed-slot-battlefield-rendering-v2.css','utf8');
assert.match(css,/\.v143-hit-feedback-overlay\{[^}]*z-index:16010;[^}]*pointer-events:none/s);assert.match(hudCss,/\.v174-battle-hud-layer\{[^}]*z-index:16015/);
assert.doesNotMatch(source,/const flash=artwork.animate/);
console.log('Direct impact overlay: one root, exact official artwork projection, 80/40/80, all targets, terminal cleanup, indirect exclusion and unchanged action/recoil PASS');
