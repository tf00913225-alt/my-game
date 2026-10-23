'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/39-v143-skill-animation.js','utf8');
const block=source.slice(source.indexOf('    function addSprite('),source.indexOf('    function queueTargetHit('));
function setup(id='explosiveFlurry',reduced=false){
 const tracks=[],node={style:{left:'80px',top:'100px',setProperty(){}},dataset:{},classList:{contains:()=>true},animate(frames,options){const a={frames,options,cancel(){this.cancelled=true;}};tracks.push(a);return a;}};
 const current={config:{id},model:{hit:7/12,sprite:{columns:4,rows:3,frames:12,src:'unchanged.webp'}},targetType:'tri',duration:1450,startedAt:100,visualStartedAt:0,firstVisibleFrameAt:0,spriteNodes:new Map()};
 const c={window:{matchMedia:()=>({matches:reduced})},state:{stage:{}},Date:{now:()=>900},DEFAULT_HIT:7/12,placementFor:()=> 'group',appendSpriteNode:()=>node,placeSprite(){},requestSpriteAspect(){}};
 vm.createContext(c);vm.runInContext(block,c);return {c,current,node,tracks};
}
const f=setup();f.c.addSprite(f.current,0,{});f.c.addSprite(f.current,1,{});f.c.addSprite(f.current,2,{});
assert.equal(f.current.spriteNodes.size,1,'one shared group source, not three damage clips');
assert.equal(f.tracks.length,1,'remeasuring another target does not restart envelope');
assert.equal(f.tracks[0].options.duration,1450);assert.equal(f.tracks[0].frames[2].offset,7/12);
assert.ok(f.tracks[0].frames.every(k=>{
 assert.match(k.transform,/^translate\(-50%,-50%\) scale\(/,'translation precedes scale, preserving fitted center');
 const scale=Number(k.transform.match(/scale\(([^)]+)\)/)[1]);return scale<=1&&scale>=.9;
}),'within original fitted box');
assert.equal(f.node.style.left,'80px');assert.equal(f.node.style.top,'100px');
for(const [id,reduced] of [['phoenixCry',false],['flameSlash',false],['explosiveFlurry',true]]){
 const x=setup(id,reduced);x.c.addSprite(x.current,0,{});assert.equal(x.tracks.length,0);
}
const late=setup();late.current.firstVisibleFrameAt=late.current.visualStartedAt=100;late.c.addSprite(late.current,0,{});
assert.equal(late.tracks[0].currentTime,800,'late source catches up without new clock');
console.log('Fire range sample: one bounded envelope, unchanged clock/anchor, reduced-motion and other-skill exclusions PASS');
// Larger sample glyphs reserve room only while that request is active/queued.
const feedback=fs.readFileSync('js/battle-floating-feedback-owner.js','utf8');
const lanes={MAX_LANES:4,LANE_PITCH_PX:25,LANE_RENDER_HEIGHT_PX:23,LANE_BOTTOM_INSET_PX:6,
 currentGeometry:()=>({unitRect:{},feedbackSafeRect:{left:0,top:0,width:120,height:180,bottom:180}}),numeric:(n,f)=>Number.isFinite(Number(n))?Number(n):f};
vm.createContext(lanes);vm.runInContext(feedback.slice(feedback.indexOf('    function laneMetrics('),feedback.indexOf('    function freeLane(')),lanes);
const context={side:'monster',index:0,active:new Map(),queue:[]};
assert.equal(lanes.laneMetrics(context).capacity,4);
context.active.set(1,{presentationStyle:'fire-sample'});assert.equal(lanes.laneMetrics(context).capacity,1);
context.active.clear();context.queue.push({kind:'status'});assert.equal(lanes.laneMetrics(context).capacity,4,'non-fire capacity restored even with later status queued');
const recipient=setup();
const modelLine=source.match(/^\s*explosiveFlurry:(\{.*\}),$/m)[1];
recipient.c.DEFAULT_HIT=7/12;recipient.c.castSheet=(src,placement,options)=>({src,placement,columns:4,rows:3,frames:12,...options});
recipient.current.model=vm.runInContext('('+modelLine+')',recipient.c);
recipient.c.placementFor=(_config,sprite)=>sprite.presentation==='per-recipient'?'single':sprite.placement;
recipient.c.appendSpriteNode=()=>({...recipient.node,dataset:{},style:{...recipient.node.style}});
for(const i of [0,1,2])recipient.c.addSprite(recipient.current,i,{});
assert.deepEqual([...recipient.current.spriteNodes.keys()],['0','1','2'],'one original sprite track per actual recipient');
assert.equal(recipient.current.model.sprite.recipientSlice,'center-third','reuse only central authored strike without rewriting bitmap');
assert.equal(recipient.tracks.length,3);
assert.ok(recipient.tracks.every(t=>t.options.duration===1450),'recipient tracks retain original duration');
assert.equal(recipient.current.model.hit,7/12);
const noWaapi=setup();noWaapi.node.animate=undefined;
assert.doesNotThrow(()=>noWaapi.c.addSprite(noWaapi.current,0,{}),'optional envelope must not prevent original CSS raster visibility');
assert.equal(noWaapi.node.style.visibility,'visible');assert.equal(noWaapi.tracks.length,0);
