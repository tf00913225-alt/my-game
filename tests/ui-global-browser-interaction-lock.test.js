"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const touchSource=fs.readFileSync("js/01-stage-v8-touch-lock.js","utf8");
const baseCss=fs.readFileSync("css/00-main.css","utf8");
const battleQa=fs.readFileSync("js/54-v173.51-battle-qa.js","utf8");
const qaCss=fs.readFileSync("css/53-v173.51-qa.css","utf8");
const animation=fs.readFileSync("js/39-v143-skill-animation.js","utf8");
const index=fs.readFileSync("index.html","utf8");
const release=JSON.parse(fs.readFileSync("release/release.json","utf8"));
const guide=fs.readFileSync("UI_GUIDELINES.md","utf8");

assert.match(index,/maximum-scale=1\.0,user-scalable=no/);
assert.match(index,/js\/01-stage-v8-touch-lock\.js\?v=173\.63/);
assert.ok(release.managedCacheReferences.includes("js/01-stage-v8-touch-lock.js"));
assert.match(baseCss,/#game-stage img,[\s\S]*?-webkit-touch-callout:none/);
assert.match(touchSource,/event\.touches[\s\S]*?event\.touches\.length>1[\s\S]*?event\.preventDefault\(\)/);
assert.match(touchSource,/"contextmenu"[\s\S]*?event\.preventDefault\(\)/);
assert.match(touchSource,/"dragstart"[\s\S]*?event\.preventDefault\(\)/);
assert.match(touchSource,/"selectstart"[\s\S]*?event\.preventDefault\(\)/);
assert.match(touchSource,/"wheel"[\s\S]*?event\.ctrlKey/);
assert.match(guide,/禁止瀏覽器層級的 pinch zoom/);
assert.match(guide,/長按圖片沒有任何瀏覽器原生反應/);

assert.doesNotMatch(qaCss,/v17351-management-open #v143-skill-stage/);
assert.doesNotMatch(battleQa,/stage\.style\.visibility/);
assert.match(animation,/stage\.id="v143-skill-stage"[\s\S]*?stage\.style\.visibility="visible"/);

const listeners={};
const winListeners={};
const gameRoot={};
const scroller={
  nodeType:1,
  matches:()=>true,
  parentElement:null,
  scrollHeight:900,
  clientHeight:300,
  scrollWidth:300,
  clientWidth:300
};
const target={
  nodeType:1,
  parentElement:scroller,
  matches:()=>false,
  closest(selector){
    if(selector==="#game-stage") return gameRoot;
    if(selector.includes("input")||selector.includes("textarea")||selector.includes("contenteditable")) return null;
    return null;
  }
};
const editable={
  nodeType:1,
  parentElement:null,
  matches:()=>false,
  closest(selector){
    if(selector==="#game-stage") return gameRoot;
    if(selector.includes("input")) return editable;
    return null;
  }
};
const outside={nodeType:1,parentElement:null,matches:()=>false,closest:()=>null};
const document={
  documentElement:{},
  addEventListener(name,handler,options){(listeners[name]??=[]).push({handler,options});}
};
const windowObj={
  getComputedStyle(){return {overflowY:"auto",overflowX:"hidden"};},
  addEventListener(name,handler,options){(winListeners[name]??=[]).push({handler,options});}
};
vm.runInNewContext(touchSource,{document,window:windowObj});

function fire(name,event){
  for(const entry of listeners[name]||[]) entry.handler(event);
}
function evt(target,extra={}){
  let prevented=false;
  return Object.assign({target,preventDefault(){prevented=true;},get prevented(){return prevented;}},extra);
}

const single=evt(target,{touches:[{}]});
fire("touchmove",single);
assert.equal(single.prevented,false,"single-finger scroll inside whitelisted scroller must remain native");

const pinch=evt(target,{touches:[{},{}]});
fire("touchmove",pinch);
assert.equal(pinch.prevented,true,"two-finger pinch must be blocked even inside a whitelisted scroller");

const menu=evt(target);
fire("contextmenu",menu);
assert.equal(menu.prevented,true,"game UI context menu must be blocked");

const editMenu=evt(editable);
fire("contextmenu",editMenu);
assert.equal(editMenu.prevented,false,"text input editing must remain available");

const outsideMenu=evt(outside);
fire("contextmenu",outsideMenu);
assert.equal(outsideMenu.prevented,false,"browser UI outside game-stage is not owned by the game");

const drag=evt(target);
fire("dragstart",drag);
assert.equal(drag.prevented,true,"native media drag must be blocked");

console.log("✓ global browser interaction lock and VFX ownership regression");
