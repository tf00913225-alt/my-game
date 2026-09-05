"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const cp=require("node:child_process");

const restCss=fs.readFileSync("css/37-v139-rested-experience.css","utf8");
const sharedCss=fs.readFileSync("css/49-v169-rpg-ui.css","utf8");

assert.match(sharedCss,/--ui-medium-modal-max-width:360px;/);
assert.match(sharedCss,/--ui-medium-modal-height:540px;/);
assert.match(sharedCss,/--ui-medium-modal-safe-space:28px;/);
assert.match(restCss,/#homeFeatureModal:has\(#restButton\) \.home-feature-modal-box\{[\s\S]*?max-width:var\(--ui-medium-modal-max-width,360px\) !important;[\s\S]*?height:min\(var\(--ui-medium-modal-height,540px\),calc\(100% - var\(--ui-medium-modal-safe-space,28px\)\)\) !important;/);
assert.match(restCss,/#homeFeatureModal:has\(#restButton\) #homeFeatureModalBody\{[\s\S]*?flex:1 1 auto !important;[\s\S]*?overflow-y:auto !important;[\s\S]*?touch-action:pan-y !important;[\s\S]*?scrollbar-gutter:stable !important;/);
assert.match(restCss,/#homeFeatureModal:has\(#restButton\) \.home-feature-modal-title\{[\s\S]*?flex:0 0 auto !important;/);
assert.match(restCss,/#homeFeatureModal:has\(#restButton\) #restButton\{[\s\S]*?min-height:44px !important;/);

function findChrome(){
    for(const name of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){
        const result=cp.spawnSync("which",[name],{encoding:"utf8"});
        if(result.status===0&&result.stdout.trim()){ return result.stdout.trim(); }
    }
    return "";
}

const chrome=findChrome();
if(!chrome){
    console.log("Rest Medium Modal browser check skipped: Chrome not available");
    process.exit(0);
}

const fixture=path.join(process.cwd(),".ui-rest-medium-modal-smoke.html");
const fileUrl="file://"+fixture.replace(/\\/g,"/");
const html=`<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="css/00-main.css">
<link rel="stylesheet" href="css/37-v139-rested-experience.css">
<link rel="stylesheet" href="css/38-v141-system-expansion.css">
<link rel="stylesheet" href="css/49-v169-rpg-ui.css">
<style>
html,body{margin:0;width:420px;height:746.6667px;overflow:hidden;background:#000;}
#game-stage{position:relative!important;left:auto!important;top:auto!important;width:420px!important;height:746.6667px!important;overflow:hidden!important;transform:none!important;}
#homeFeatureModal{display:flex!important;position:absolute!important;inset:0!important;width:420px!important;height:746.6667px!important;align-items:center!important;justify-content:center!important;padding:0!important;}
.home-feature-modal-title{height:52px!important;}
</style></head><body><div id="game-stage"><div id="homeFeatureModal" class="home-feature-modal">
<div class="home-feature-modal-box"><div class="home-feature-modal-title"><span>休息</span><button>返回</button></div><div id="homeFeatureModalBody"><div id="restCopy"></div><button id="restButton">休息（回滿 HP／SP）</button></div></div>
</div></div><pre id="result"></pre><script>
(function(){
 const box=document.querySelector('.home-feature-modal-box');
 const title=document.querySelector('.home-feature-modal-title');
 const body=document.getElementById('homeFeatureModalBody');
 const restButton=document.getElementById('restButton');
 const copy=document.getElementById('restCopy');
 const rect=el=>{const r=el.getBoundingClientRect();return {left:r.left,top:r.top,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
 const snap=name=>({name,box:rect(box),title:rect(title),body:rect(body),button:rect(restButton),boxStyle:{height:getComputedStyle(box).height,maxWidth:getComputedStyle(box).maxWidth},bodyStyle:{overflowY:getComputedStyle(body).overflowY,gutter:getComputedStyle(body).scrollbarGutter,touchAction:getComputedStyle(body).touchAction},scrollHeight:body.scrollHeight,clientHeight:body.clientHeight});
 copy.innerHTML='<p>回主城休息可以免費把 HP、SP 補滿。</p>';void box.offsetHeight;const short=snap('short');
 copy.innerHTML=Array.from({length:45},(_,i)=>'<p>休息說明 '+i+'：測試內容。</p>').join('');void box.offsetHeight;const long=snap('long');
 document.getElementById('result').textContent=JSON.stringify({short,long});
})();
</script></body></html>`;

fs.writeFileSync(fixture,html,"utf8");
try{
    const run=cp.spawnSync(chrome,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--force-device-scale-factor=1","--window-size=420,747","--dump-dom",fileUrl],{encoding:"utf8",timeout:30000,maxBuffer:8*1024*1024});
    assert.equal(run.status,0,run.stderr||"Chrome rest Medium Modal fixture failed");
    const match=run.stdout.match(/<pre id="result">([\s\S]*?)<\/pre>/);
    assert.ok(match,"rest Medium Modal browser result missing");
    const data=JSON.parse(match[1].replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"'));
    for(const shot of [data.short,data.long]){
        assert.equal(shot.boxStyle.maxWidth,"360px","rest must use Medium Modal width ceiling");
        assert.equal(shot.boxStyle.height,"540px","rest must use Medium Modal height");
        assert.equal(shot.bodyStyle.overflowY,"auto","rest body must own vertical scrolling");
        assert.equal(shot.bodyStyle.gutter,"stable","rest body must reserve stable scrollbar space");
        assert.equal(shot.bodyStyle.touchAction,"pan-y","rest body must permit vertical touch scrolling");
        assert.ok(shot.button.height>=44,"rest action must keep a mobile-friendly tap target");
    }
    for(const part of ["box","title","body"]){
        for(const key of ["left","top","width","height"]){
            assert.ok(Math.abs(data.short[part][key]-data.long[part][key])<0.25,`${part}.${key} must not move when rest content changes`);
        }
    }
    assert.ok(data.long.scrollHeight>data.long.clientHeight,"long rest content must scroll internally");
    assert.ok(data.short.scrollHeight<=data.short.clientHeight+1,"short rest content must leave stable empty space instead of resizing the modal");
    console.log("Headless Chrome: rest uses one fixed Medium Modal frame");
}finally{
    try{fs.unlinkSync(fixture);}catch(_){ }
}
