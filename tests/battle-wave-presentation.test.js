"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const source=fs.readFileSync("js/35-v141-ui-battle.js","utf8");
const start=source.indexOf("window.v141PresentBattleWave=function");
const end=source.indexOf("\n    };",start)+7;
function fixture(){
 const animations=[],frames=[],events=[];let decode;
 const area={isConnected:true,getBoundingClientRect:()=>({height:200}),
  querySelectorAll:()=>[{decode:()=>new Promise(resolve=>{decode=resolve;})}],
  animate:(keys,options)=>{let resolve,reject;const finished=new Promise((a,b)=>{resolve=a;reject=b;});const a={keys,options,finished,finish:resolve,cancel:()=>{events.push("cancel");reject(Error("cancelled"));}};animations.push(a);return a;}};
 const c={window:{},document:{getElementById:()=>area},battleActive:true,battleToken:4,Promise,Array,Error,requestAnimationFrame:fn=>frames.push(fn)};
 vm.createContext(c);vm.runInContext(source.slice(start,end),c);
 const cancel=c.window.v141PresentBattleWave({token:4,replace:()=>{events.push("replace");return true;},complete:()=>events.push("complete"),fail:()=>events.push("fail")});
 return {c,animations,frames,events,cancel,decode:()=>decode()};
}
const flush=async()=>{for(let i=0;i<5;i++)await Promise.resolve();};
test("V141 waits for actual group exit, decoded entry, animation finish and painted frame",async()=>{
 const f=fixture();assert.equal(f.animations.length,1);assert.equal(f.animations[0].options.duration,780);
 assert.deepEqual(f.events,[]);f.animations[0].finish();await flush();assert.deepEqual(f.events,["replace"]);
 assert.equal(f.animations.length,1,"entry waits for decoded assets");f.decode();await flush();
 assert.equal(f.animations.length,2);assert.equal(f.animations[1].options.duration,700);
 assert.equal(f.animations[1].keys[0].transform,"translateY(-110%)");
 f.animations[1].finish();await flush();assert.ok(!f.events.includes("complete"));
 f.frames.shift()();f.frames.shift()();await flush();assert.equal(f.events.at(-1),"complete");
});
test("cancelled exit never replaces wave roster or resumes combat",async()=>{
 const f=fixture();f.cancel();await flush();assert.ok(!f.events.includes("replace"));assert.ok(!f.events.includes("complete"));assert.ok(!f.events.includes("fail"));
});
test("obsolete token after decode cannot enter or complete",async()=>{
 const f=fixture();f.animations[0].finish();await flush();f.c.battleToken++;f.decode();await flush();
 assert.equal(f.animations.length,1);assert.ok(!f.events.includes("complete"));
});
