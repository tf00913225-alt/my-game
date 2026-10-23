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
assert.ok(f.tracks[0].frames.every(k=>k.scale<=1&&k.scale>=.9),'within original fitted box');
assert.equal(f.node.style.left,'80px');assert.equal(f.node.style.top,'100px');
for(const [id,reduced] of [['phoenixCry',false],['flameSlash',false],['explosiveFlurry',true]]){
 const x=setup(id,reduced);x.c.addSprite(x.current,0,{});assert.equal(x.tracks.length,0);
}
const late=setup();late.current.firstVisibleFrameAt=late.current.visualStartedAt=100;late.c.addSprite(late.current,0,{});
assert.equal(late.tracks[0].currentTime,800,'late source catches up without new clock');
console.log('Fire range sample: one bounded envelope, unchanged clock/anchor, reduced-motion and other-skill exclusions PASS');
