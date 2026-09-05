"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const cp=require("node:child_process");

function findChrome(){
    for(const name of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){
        const result=cp.spawnSync("which",[name],{encoding:"utf8"});
        if(result.status===0&&result.stdout.trim()){ return result.stdout.trim(); }
    }
    return "";
}

const chrome=findChrome();
if(!chrome){
    console.log("Feature Large Panel browser check skipped: Chrome not available");
    process.exit(0);
}

const root=process.cwd();
const fixture=path.join(root,".ui-feature-large-panel-smoke.html");
const fileUrl="file://"+fixture.replace(/\\/g,"/");

const html=`<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="css/00-main.css">
<link rel="stylesheet" href="css/49-v169-rpg-ui.css">
<style>
html,body{margin:0;width:1080px;height:1920px;overflow:hidden;background:#000;}
#game-stage{position:relative!important;width:1080px!important;height:1920px!important;overflow:hidden!important;}
#app,#game-content{position:relative!important;width:420px!important;height:746.6667px!important;transform:none!important;}
#homeFeatureModal{display:flex!important;position:absolute!important;inset:0!important;width:420px!important;height:746.6667px!important;}
</style></head><body>
<div id="game-stage"><div id="app"><div id="game-content">
<div id="homeFeatureModal" class="home-feature-modal show">
<div class="home-feature-modal-box"><div class="home-feature-modal-title"><span>測試</span><button class="home-feature-close-btn">返回</button></div><div id="homeFeatureModalBody"></div></div>
</div></div></div></div><pre id="result"></pre>
<script>
(function(){
 const modal=document.getElementById('homeFeatureModal');
 const box=modal.querySelector('.home-feature-modal-box');
 const body=document.getElementById('homeFeatureModalBody');
 const title=modal.querySelector('.home-feature-modal-title');
 const close=modal.querySelector('.home-feature-close-btn');
 const snapshots=[];
 const rect=el=>{const r=el.getBoundingClientRect();return {left:r.left,top:r.top,width:r.width,height:r.height};};
 const record=name=>{void box.offsetHeight;snapshots.push({name,box:rect(box),body:rect(body),title:rect(title),close:rect(close),scrollHeight:body.scrollHeight,clientHeight:body.clientHeight});};

 body.innerHTML='<div id="homeExpPoolCard"><div>經驗池</div></div>';record('expPool');
 body.innerHTML=Array.from({length:24},(_,i)=>'<div class="home-feature-row"><span>圖鑑 '+i+'</span><span>擊殺</span></div>').join('');record('bestiary');
 body.innerHTML=Array.from({length:20},(_,i)=>'<div class="home-feature-row"><span>成就 '+i+'</span><button class="home-feature-buy-btn" onclick="claimAchievement(\\'x\\')">領取</button></div>').join('');record('achievement');
 body.innerHTML='<div style="font-size:13px;line-height:1.8;">離線經驗</div><button class="home-feature-buy-btn" onclick="claimOfflineExp()">領取</button>';record('offlineExp');
 body.innerHTML='<div style="font-size:13px;line-height:1.8;">公告內容</div>';record('announcement');
 document.getElementById('result').textContent=JSON.stringify(snapshots);
})();
</script></body></html>`;

fs.writeFileSync(fixture,html,"utf8");
try{
    const run=cp.spawnSync(chrome,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--force-device-scale-factor=1","--window-size=1080,1920","--dump-dom",fileUrl],{encoding:"utf8",timeout:30000,maxBuffer:8*1024*1024});
    assert.equal(run.status,0,run.stderr||"Chrome feature layout fixture failed");
    const match=run.stdout.match(/<pre id="result">([\s\S]*?)<\/pre>/);
    assert.ok(match,"feature browser layout result missing");
    const snapshots=JSON.parse(match[1].replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"'));
    assert.equal(snapshots.length,5);
    const baseline=snapshots[0];
    for(const shot of snapshots){
        for(const part of ["box","body","title","close"]){
            for(const key of ["left","top","width","height"]){
                assert.ok(Math.abs(shot[part][key]-baseline[part][key])<0.25,`${shot.name} ${part}.${key} drifted`);
            }
        }
    }
    assert.ok(snapshots.find(x=>x.name==="bestiary").scrollHeight>snapshots.find(x=>x.name==="bestiary").clientHeight,"bestiary must scroll inside content viewport");
    assert.ok(snapshots.find(x=>x.name==="announcement").scrollHeight<=snapshots.find(x=>x.name==="announcement").clientHeight+1,"announcement should keep blank space instead of shrinking frame");
    console.log("Headless Chrome: EXP pool, bestiary, achievement, offline EXP and announcement share one Large Panel frame");
}finally{
    try{fs.unlinkSync(fixture);}catch(_){ }
}
