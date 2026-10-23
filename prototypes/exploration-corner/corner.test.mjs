import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {scene,move,canStand,cameraFor,nearNpc,findRoute,followRoute,npcRoute} from './scene.mjs';import {displaySource,startSample} from './serve.mjs';
test('sample host serves real static references and canonical Display before consumers',async()=>{
 const {server,url}=await startSample();
 try{
  const response=await fetch(url),html=await response.text();assert.equal(response.status,200);
  assert.ok(html.includes(`<script>${displaySource()}</script>`));
  assert.ok(html.indexOf('window.eventToGamePoint =')<html.indexOf('src="/js/01-stage-v8-touch-lock.js"'));
  const template=fs.readFileSync(new URL('./index.html',import.meta.url),'utf8');
  for(const [,reference] of template.matchAll(/(?:src|href)="([^"]+)"/g)){
   const relative=reference.split('#')[0];assert.ok(relative.startsWith('/'));
   assert.ok(fs.statSync(new URL('../..'+relative,import.meta.url)).isFile(),reference);
   const resource=await fetch(new URL(reference,url));assert.equal(resource.status,200,reference);
   assert.match(resource.headers.get('content-type'),/text\/css|text\/javascript|image\/svg\+xml/);
  }
  assert.equal((await fetch(new URL('/prototype-display-owner.js',url))).status,404);
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
test('safe spawn, boundary and solid furniture cannot be entered',()=>{
 assert.ok(canStand(scene.spawn.x,scene.spawn.y));assert.equal(canStand(0,100),false);
 for(const {solid:b} of scene.objects)assert.equal(canStand(b.x+b.width/2,b.y+b.height/2),false);
});
test('tap routes go around house and tree using collision-safe continuous movement',()=>{
 for(const [start,target] of [[{x:720,y:1250},{x:720,y:650}],[{x:230,y:1430},{x:420,y:1330}]]){
  const route=findRoute(start,target);assert.ok(route?.length);let state=start,frames=0;
  while(route.length&&frames++<3000){const before=state;state=followRoute(state,route,.05);assert.ok(canStand(state.x,state.y));assert.ok(Math.hypot(state.x-before.x,state.y-before.y)<=16.001);}
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
test('four directional art views preserve speed, facing and idle',()=>{
 const origin={x:720,y:1660};for(const direction of ['up','down','left','right']){
 const state=move(origin,direction,.05);assert.equal(Math.hypot(state.x-origin.x,state.y-origin.y),16);assert.equal(state.facing,direction);}
 assert.equal(move(origin,null,.05).moving,false);
});
test('diagonal and straight movement have equal speed and routes spend residual distance across waypoints',()=>{
 const origin={x:700,y:1800};
 for(const direction of ['right',[1,1],[-1,-1],[100,100]]){
  const state=move(origin,direction,.05);assert.ok(Math.abs(Math.hypot(state.x-origin.x,state.y-origin.y)-16)<1e-8);
 }
 const target={x:1000,y:2100},route=findRoute(origin,target);assert.deepEqual(route,[target]);
 const state=followRoute(origin,route,.05);assert.ok(state.x>origin.x&&state.y>origin.y);
 const cornerRoute=[{x:705,y:1800},{x:705,y:1900}];
 const turned=followRoute(origin,cornerRoute,.05);assert.ok(Math.abs(turned.x-705)<1e-8);assert.ok(Math.abs(turned.y-1811)<1e-8);assert.equal(turned.moving,true);
});
test('swept diagonal motion cannot cut thin obstacles, rounded corners or boundaries',()=>{
 const data={width:200,height:200,radius:.5,speed:320,objects:[{solid:{x:51,y:49,width:.1,height:4}}]};
 const state=move({x:49,y:49},[1,1],.05,data);assert.deepEqual([state.x,state.y],[49,49]);
 const corner={...data,radius:5,objects:[{solid:{x:50,y:50,width:20,height:20}}]};
 const start={x:40,y:48},route=findRoute(start,{x:80,y:48},corner);assert.ok(route);
 let current=start;for(let i=0;route.length&&i<1000;i++){current=followRoute(current,route,.05,corner);assert.ok(canStand(current.x,current.y,corner));}
 assert.equal(route.length,0);assert.ok(Math.hypot(current.x-80,current.y-48)<.01);
 const edge=move({x:6,y:6},[-1,-1],.05,corner);assert.ok(edge.x>=5&&edge.y>=5);
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
