"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const cp=require("node:child_process");
const vm=require("node:vm");

const css=fs.readFileSync("css/23-stage-v77-inventory-detail-ui.css","utf8");
const touchLock=fs.readFileSync("js/01-stage-v8-touch-lock.js","utf8");
const index=fs.readFileSync("index.html","utf8");

assert.match(index,/id="statusHelpModal"[\s\S]*?class="item-modal"/);
assert.match(css,/#statusHelpModal \.item-modal-box\{[\s\S]*?max-width:var\(--ui-medium-modal-max-width,360px\) !important;[\s\S]*?height:min\(var\(--ui-medium-modal-height,540px\),calc\(100% - var\(--ui-medium-modal-safe-space,28px\)\)\) !important;[\s\S]*?overflow:hidden !important;/);
assert.match(css,/#statusHelpModal \.item-stat-list\{[\s\S]*?flex:1 1 auto !important;[\s\S]*?overflow-y:auto !important;[\s\S]*?touch-action:pan-y !important;[\s\S]*?scrollbar-gutter:stable !important;/);
assert.match(css,/#statusHelpModal \.close-item-button\{[\s\S]*?min-height:44px !important;/);
assert.match(touchLock,/#statusHelpModal \.item-stat-list/);

// Verify the global stage touch lock admits the real status-help scroll owner.
const listeners=new Map();
const documentElement={};
const window={
    addEventListener(){},
    getComputedStyle(node){ return node.computedStyle||{overflowY:"visible",overflowX:"visible"}; }
};
const document={
    documentElement,
    addEventListener(name,handler){ listeners.set(name,handler); }
};
vm.runInNewContext(touchLock,{document,window});
const stage={};
const box={
    nodeType:1,parentElement:documentElement,scrollHeight:540,clientHeight:540,
    computedStyle:{overflowY:"hidden",overflowX:"hidden"},
    matches:selector=>selector.includes(".item-modal-box"),
    closest:selector=>selector==="#game-stage"?stage:null
};
const body={
    nodeType:1,parentElement:box,scrollHeight:960,clientHeight:410,
    computedStyle:{overflowY:"auto",overflowX:"hidden"},
    matches:selector=>selector.includes("#statusHelpModal .item-stat-list"),
    closest:selector=>selector==="#game-stage"?stage:null
};
const row={
    nodeType:1,parentElement:body,matches:()=>false,
    closest:selector=>selector==="#game-stage"?stage:null
};
assert.equal(window.isInsideAllowedScrollerV78(row),true,"status help copy must resolve to its own scroll owner");

function findChrome(){
    for(const name of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){
        const result=cp.spawnSync("which",[name],{encoding:"utf8"});
        if(result.status===0&&result.stdout.trim()){ return result.stdout.trim(); }
    }
    return "";
}
const chrome=findChrome();
if(!chrome){
    console.log("Status help Medium Modal browser check skipped: Chrome not available");
    process.exit(0);
}

const fixture=path.join(process.cwd(),".ui-status-help-smoke.html");
const fileUrl="file://"+fixture.replace(/\\/g,"/");
const html=`<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="css/00-main.css">
<link rel="stylesheet" href="css/23-stage-v77-inventory-detail-ui.css">
<link rel="stylesheet" href="css/38-v141-system-expansion.css">
<link rel="stylesheet" href="css/49-v169-rpg-ui.css">
<style>
html,body{margin:0;width:420px;height:746.6667px;overflow:hidden;background:#000;}
#game-stage{position:relative!important;width:420px!important;height:746.6667px!important;overflow:hidden!important;transform:none!important;}
#statusHelpModal{display:flex!important;position:absolute!important;inset:0!important;width:420px!important;height:746.6667px!important;align-items:center!important;justify-content:center!important;}
</style></head><body><div id="game-stage"><div id="statusHelpModal" class="item-modal"><div class="item-modal-box" style="max-height:88%;overflow-y:auto;">
<div class="item-modal-name">能力值說明</div><div class="item-stat-list"></div><button class="close-item-button">返回</button>
</div></div></div><pre id="result"></pre><script>
(function(){
 const box=document.querySelector('.item-modal-box');
 const title=document.querySelector('.item-modal-name');
 const body=document.querySelector('.item-stat-list');
 const close=document.querySelector('.close-item-button');
 const rect=el=>{const r=el.getBoundingClientRect();return {left:r.left,top:r.top,width:r.width,height:r.height};};
 const snap=name=>({name,box:rect(box),title:rect(title),body:rect(body),close:rect(close),boxHeight:getComputedStyle(box).height,bodyOverflow:getComputedStyle(body).overflowY,bodyGutter:getComputedStyle(body).scrollbarGutter,scrollHeight:body.scrollHeight,clientHeight:body.clientHeight});
 body.innerHTML='<p>短說明</p>';void box.offsetHeight;const short=snap('short');
 body.innerHTML=Array.from({length:55},(_,i)=>'<p><b>能力 '+i+'</b> 詳細效果與計算說明</p>').join('');void box.offsetHeight;const long=snap('long');
 document.getElementById('result').textContent=JSON.stringify({short,long});
})();
</script></body></html>`;
fs.writeFileSync(fixture,html,"utf8");
try{
    const run=cp.spawnSync(chrome,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--force-device-scale-factor=1","--window-size=420,747","--dump-dom",fileUrl],{encoding:"utf8",timeout:30000,maxBuffer:8*1024*1024});
    assert.equal(run.status,0,run.stderr||"Chrome status-help fixture failed");
    const match=run.stdout.match(/<pre id="result">([\s\S]*?)<\/pre>/);
    assert.ok(match,"status-help browser result missing");
    const data=JSON.parse(match[1].replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"'));
    for(const shot of [data.short,data.long]){
        assert.equal(shot.boxHeight,"540px","status help must use the shared Medium Modal height");
        assert.equal(shot.bodyOverflow,"auto","status help copy must own vertical scrolling");
        assert.equal(shot.bodyGutter,"stable","status help must reserve scrollbar space");
    }
    for(const part of ["box","title","close"]){
        for(const key of ["left","top","width","height"]){
            assert.ok(Math.abs(data.short[part][key]-data.long[part][key])<0.25,`${part}.${key} must remain fixed when help copy changes`);
        }
    }
    assert.ok(data.long.scrollHeight>data.long.clientHeight,"long status help must scroll internally");
    console.log("Headless Chrome: status help uses one fixed Medium Modal with an internal scroll owner");
}finally{
    try{fs.unlinkSync(fixture);}catch(_){ }
}
