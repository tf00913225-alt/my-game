"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const cp=require("node:child_process");

const css=fs.readFileSync("css/20-stage-v60-training-only-safety.css","utf8");
const runtime=fs.readFileSync("js/17-stage-v60-training-render-guard.js","utf8");
const touchLock=fs.readFileSync("js/01-stage-v8-touch-lock.js","utf8");

assert.match(css,/#trainingZoneModal \.home-feature-modal-box\{[\s\S]*?max-width:var\(--ui-medium-modal-max-width,360px\) !important;[\s\S]*?height:min\(var\(--ui-medium-modal-height,540px\),calc\(100% - var\(--ui-medium-modal-safe-space,28px\)\)\) !important;[\s\S]*?overflow:hidden !important;/);
assert.match(css,/#trainingZoneModal #trainingZoneModalBody\{[\s\S]*?flex:1 1 auto !important;[\s\S]*?overflow-y:auto !important;[\s\S]*?touch-action:pan-y !important;[\s\S]*?scrollbar-gutter:stable !important;/);
assert.match(touchLock,/#trainingZoneModalBody/);
assert.doesNotMatch(runtime,/box\.style\.setProperty\("width"|box\.style\.setProperty\("max-height"|box\.style\.setProperty\("overflow-y"/);

function findChrome(){
    for(const name of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){
        const result=cp.spawnSync("which",[name],{encoding:"utf8"});
        if(result.status===0&&result.stdout.trim()){ return result.stdout.trim(); }
    }
    return "";
}

const chrome=findChrome();
if(!chrome){
    console.log("Training zone Medium Modal browser check skipped: Chrome not available");
    process.exit(0);
}

const fixture=path.join(process.cwd(),".ui-training-zone-medium-modal-smoke.html");
const fileUrl="file://"+fixture.replace(/\\/g,"/");
const html=`<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="css/00-main.css">
<link rel="stylesheet" href="css/20-stage-v60-training-only-safety.css">
<link rel="stylesheet" href="css/49-v169-rpg-ui.css">
<style>
html,body{margin:0;width:420px;height:746.6667px;overflow:hidden;background:#000;}
#game-stage{position:relative!important;width:420px!important;height:746.6667px!important;overflow:hidden!important;transform:none!important;}
#trainingZoneModal{display:flex!important;position:absolute!important;inset:0!important;width:420px!important;height:746.6667px!important;align-items:center!important;justify-content:center!important;}
</style></head><body><div id="game-stage"><div id="trainingZoneModal" class="home-feature-modal">
<div class="home-feature-modal-box"><div class="home-feature-modal-title"><span>地區資訊</span><button class="home-feature-close-btn">返回</button></div><div id="trainingZoneModalBody"></div></div>
</div></div><pre id="result"></pre><script>
(function(){
 const box=document.querySelector('#trainingZoneModal .home-feature-modal-box');
 const title=document.querySelector('#trainingZoneModal .home-feature-modal-title');
 const body=document.getElementById('trainingZoneModalBody');
 const rect=el=>{const r=el.getBoundingClientRect();return {left:r.left,top:r.top,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
 const snap=name=>({name,box:rect(box),title:rect(title),body:rect(body),boxStyle:{width:getComputedStyle(box).width,height:getComputedStyle(box).height,maxWidth:getComputedStyle(box).maxWidth,overflowY:getComputedStyle(box).overflowY},bodyStyle:{overflowY:getComputedStyle(body).overflowY,touchAction:getComputedStyle(body).touchAction,gutter:getComputedStyle(body).scrollbarGutter},scrollHeight:body.scrollHeight,clientHeight:body.clientHeight});
 body.innerHTML='<p>推薦等級 Lv.1～10</p><p>普通怪物資訊</p><button class="home-feature-buy-btn">前往地區</button>';void box.offsetHeight;const short=snap('short');
 body.innerHTML=Array.from({length:45},(_,i)=>'<p>地區情報 '+i+'：怪物、經驗與掉落說明</p>').join('')+'<button class="home-feature-buy-btn">前往地區</button>';void box.offsetHeight;const long=snap('long');
 body.scrollTop=body.scrollHeight;void box.offsetHeight;const scrolled=snap('scrolled');
 document.getElementById('result').textContent=JSON.stringify({short,long,scrolled,scrollTop:body.scrollTop});
})();
</script></body></html>`;

fs.writeFileSync(fixture,html,"utf8");
try{
    const run=cp.spawnSync(chrome,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--force-device-scale-factor=1","--window-size=420,747","--dump-dom",fileUrl],{encoding:"utf8",timeout:30000,maxBuffer:8*1024*1024});
    assert.equal(run.status,0,run.stderr||"Chrome training zone Medium Modal fixture failed");
    const match=run.stdout.match(/<pre id="result">([\s\S]*?)<\/pre>/);
    assert.ok(match,"training zone Medium Modal browser result missing");
    const data=JSON.parse(match[1].replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"'));
    for(const shot of [data.short,data.long,data.scrolled]){
        assert.equal(shot.boxStyle.maxWidth,"360px","training zone info must use Medium Modal width ceiling");
        assert.equal(shot.boxStyle.height,"540px","training zone info must use Medium Modal height");
        assert.equal(shot.boxStyle.overflowY,"hidden","training zone frame must not be the scroll owner");
        assert.equal(shot.bodyStyle.overflowY,"auto","training zone body must own vertical scrolling");
        assert.equal(shot.bodyStyle.touchAction,"pan-y","training zone body must allow vertical touch panning");
        assert.equal(shot.bodyStyle.gutter,"stable","training zone body must reserve stable scrollbar space");
    }
    for(const part of ["box","title","body"]){
        for(const key of ["left","top","width","height"]){
            assert.ok(Math.abs(data.short[part][key]-data.long[part][key])<0.25,`${part}.${key} must not move when region content changes`);
        }
    }
    assert.ok(data.long.scrollHeight>data.long.clientHeight,"long region information must scroll inside the body");
    assert.ok(data.short.scrollHeight<=data.short.clientHeight+1,"short region information must not need scrolling");
    assert.ok(data.scrollTop>0,"training zone body must be programmatically scrollable to its bottom");
    assert.ok(Math.abs(data.long.title.top-data.scrolled.title.top)<0.25,"title must stay fixed while the body scrolls");
    console.log("Headless Chrome: training zone information uses one fixed Medium Modal with body-only scrolling");
}finally{
    try{fs.unlinkSync(fixture);}catch(_){ }
}
