"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const cp=require("node:child_process");

const detailCss=fs.readFileSync("css/23-stage-v77-inventory-detail-ui.css","utf8");
const touchSource=fs.readFileSync("js/01-stage-v8-touch-lock.js","utf8");

assert.match(detailCss,/#game-stage #skillDetailModal \.item-modal-box\{[\s\S]*?max-width:var\(--ui-medium-modal-max-width,360px\) !important;[\s\S]*?height:min\(var\(--ui-medium-modal-height,540px\),calc\(100% - var\(--ui-medium-modal-safe-space,28px\)\)\) !important;/);
assert.match(detailCss,/#game-stage #skillDetailModal #skillDetailStats\{[\s\S]*?flex:1 1 auto !important;[\s\S]*?overflow-y:auto !important;[\s\S]*?scrollbar-gutter:stable !important;/);
assert.match(detailCss,/#game-stage #skillDetailModal \.close-item-button\{[\s\S]*?margin-top:0 !important;/);
assert.match(touchSource,/#skillDetailStats/);

function findChrome(){
    for(const name of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){
        const result=cp.spawnSync("which",[name],{encoding:"utf8"});
        if(result.status===0&&result.stdout.trim()){ return result.stdout.trim(); }
    }
    return "";
}

const chrome=findChrome();
if(!chrome){
    console.log("Skill Medium Modal browser check skipped: Chrome not available");
    process.exit(0);
}

const fixture=path.join(process.cwd(),".ui-medium-skill-detail-smoke.html");
const fileUrl="file://"+fixture.replace(/\\/g,"/");
const html=`<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="css/00-main.css">
<link rel="stylesheet" href="css/23-stage-v77-inventory-detail-ui.css">
<link rel="stylesheet" href="css/49-v169-rpg-ui.css">
<style>
html,body{margin:0;width:420px;height:746.6667px;overflow:hidden;background:#000;}
#game-stage{position:relative!important;width:420px!important;height:746.6667px!important;overflow:hidden!important;transform:none!important;}
#skillDetailModal{display:flex!important;position:absolute!important;inset:0!important;width:420px!important;height:746.6667px!important;align-items:center!important;justify-content:center!important;}
#skillDetailIcon{height:90px;}.close-item-button{height:46px;}
</style></head><body><div id="game-stage"><div id="skillDetailModal" class="item-modal">
<div class="item-modal-box"><div id="skillDetailIcon" class="item-modal-icon">技</div><div id="skillDetailName" class="item-modal-name">測試技能</div><div id="skillDetailStats" class="item-stat-list"></div><button class="close-item-button">返回</button></div>
</div></div><pre id="result"></pre><script>
(function(){
 const box=document.querySelector('.item-modal-box');
 const stats=document.getElementById('skillDetailStats');
 const close=document.querySelector('.close-item-button');
 const rect=el=>{const r=el.getBoundingClientRect();return {left:r.left,top:r.top,width:r.width,height:r.height};};
 const snap=()=>({box:rect(box),stats:rect(stats),close:rect(close),boxStyle:{height:getComputedStyle(box).height,maxWidth:getComputedStyle(box).maxWidth},statsStyle:{overflowY:getComputedStyle(stats).overflowY,gutter:getComputedStyle(stats).scrollbarGutter},scrollHeight:stats.scrollHeight,clientHeight:stats.clientHeight});
 stats.innerHTML='<p>短技能說明</p>';void box.offsetHeight;const short=snap();
 stats.innerHTML=Array.from({length:45},(_,i)=>'<p>技能效果說明 '+i+'</p>').join('');void box.offsetHeight;const long=snap();
 document.getElementById('result').textContent=JSON.stringify({short,long});
})();
</script></body></html>`;

fs.writeFileSync(fixture,html,"utf8");
try{
    const run=cp.spawnSync(chrome,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--force-device-scale-factor=1","--window-size=420,747","--dump-dom",fileUrl],{encoding:"utf8",timeout:30000,maxBuffer:8*1024*1024});
    assert.equal(run.status,0,run.stderr||"Chrome skill Medium Modal fixture failed");
    const match=run.stdout.match(/<pre id="result">([\s\S]*?)<\/pre>/);
    assert.ok(match,"skill Medium Modal browser result missing");
    const data=JSON.parse(match[1].replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"'));
    for(const shot of [data.short,data.long]){
        assert.equal(shot.boxStyle.maxWidth,"360px","skill detail must keep Medium Modal width ceiling");
        assert.equal(shot.boxStyle.height,"540px","skill detail must use Medium Modal height");
        assert.equal(shot.statsStyle.overflowY,"auto","skill stats must own vertical scrolling");
        assert.equal(shot.statsStyle.gutter,"stable","skill stats must reserve stable scrollbar space");
    }
    for(const part of ["box","stats","close"]){
        for(const key of ["left","top","width","height"]){
            assert.ok(Math.abs(data.short[part][key]-data.long[part][key])<0.25,`${part}.${key} must not move when skill content changes`);
        }
    }
    assert.ok(data.long.scrollHeight>data.long.clientHeight,"long skill detail must scroll internally");
    assert.ok(data.short.scrollHeight<=data.short.clientHeight+1,"short skill detail must leave stable empty space instead of resizing the modal");
    console.log("Headless Chrome: skill detail uses one fixed Medium Modal frame");
}finally{
    try{fs.unlinkSync(fixture);}catch(_){ }
}
