import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {scene,move,canStand,cameraFor,nearNpc} from './scene.mjs';import {displaySource} from './serve.mjs';
test('safe spawn, boundary and solid furniture cannot be entered',()=>{
 assert.ok(canStand(scene.spawn.x,scene.spawn.y));assert.equal(canStand(0,100),false);
 for(const {solid:b} of scene.objects)assert.equal(canStand(b.x+b.width/2,b.y+b.height/2),false);
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
