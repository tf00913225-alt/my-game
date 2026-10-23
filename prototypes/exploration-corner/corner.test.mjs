import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {scene,move,canStand,cameraFor,nearNpc,findRoute,followRoute,npcRoute} from './scene.mjs';import {displaySource} from './serve.mjs';
test('safe spawn, boundary and solid furniture cannot be entered',()=>{
 assert.ok(canStand(scene.spawn.x,scene.spawn.y));assert.equal(canStand(0,100),false);
 for(const {solid:b} of scene.objects)assert.equal(canStand(b.x+b.width/2,b.y+b.height/2),false);
});
test('tap routes go around house and tree using collision-safe cardinal movement',()=>{
 for(const [start,target] of [[{x:720,y:1250},{x:720,y:650}],[{x:230,y:1430},{x:420,y:1330}]]){
  const route=findRoute(start,target);assert.ok(route?.length);let state=start,frames=0;
  while(route.length&&frames++<3000){const before=state;state=followRoute(state,route,.05);assert.ok(canStand(state.x,state.y));assert.ok(Math.abs(state.x-before.x)+Math.abs(state.y-before.y)<=16.001);}
  assert.ok(frames<3000);assert.ok(Math.hypot(state.x-target.x,state.y-target.y)<.01);
 }
});
test('blocked and disconnected destinations fail, NPC route ends nearby outside its solid',()=>{
 assert.deepEqual(findRoute(scene.spawn,scene.spawn),[]);
 assert.equal(findRoute(scene.spawn,{x:800,y:900}),null);
 const closed={...scene,width:400,height:400,objects:[{solid:{x:190,y:0,width:20,height:400}}]};
 assert.equal(findRoute({x:80,y:80},{x:300,y:300},closed),null);
 const route=npcRoute(scene.spawn);assert.ok(route?.length);assert.ok(nearNpc(route.at(-1)));assert.ok(canStand(route.at(-1).x,route.at(-1).y));
});
test('held movement cannot tunnel through house and trunk at a delayed frame',()=>{
 let state={x:800,y:1100};for(let i=0;i<100;i++)state=move(state,'up',5);
 assert.ok(state.y>=1053);assert.ok(canStand(state.x,state.y));
 state={x:200,y:1400};for(let i=0;i<100;i++)state=move(state,'right',.05);
 assert.ok(state.x<=275);assert.ok(canStand(state.x,state.y));
});
test('four directions preserve speed, facing and idle; no input is diagonal',()=>{
 const origin={x:720,y:1660};for(const direction of ['up','down','left','right']){
 const state=move(origin,direction,.05);assert.equal(Math.hypot(state.x-origin.x,state.y-origin.y),16);assert.equal(state.facing,direction);}
 assert.equal(move(origin,null,.05).moving,false);
});
test('camera clamps both edges and NPC prompt requires proximity',()=>{
 assert.deepEqual(cameraFor({x:0,y:0}),{x:0,y:0});
 assert.deepEqual(cameraFor({x:1400,y:2600}),{x:320,y:1280});
 assert.equal(nearNpc(scene.spawn),false);assert.equal(nearNpc({x:1060,y:1480}),true);
});
test('fixture executes canonical display source and sample has no game state writer',()=>{
 assert.match(displaySource(),/window.FourSymbolsDisplay = Object.freeze/);
 const runtime=fs.readFileSync(new URL('./runtime.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(runtime,/localStorage|sessionStorage|indexedDB|saveGame\(|grantReward|startBattle\(/);
 assert.doesNotMatch(fs.readFileSync(new URL('./style.css',import.meta.url),'utf8'),/!important/);
});
