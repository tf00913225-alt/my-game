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
    console.log("Synthesis Large Panel browser check skipped: Chrome not available");
    process.exit(0);
}

const root=process.cwd();
const fixture=path.join(root,".ui-synthesis-large-panel-smoke.html");
const fileUrl="file://"+fixture.replace(/\\/g,"/");
const html=`<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="css/00-main.css">
<link rel="stylesheet" href="css/38-v141-system-expansion.css">
<link rel="stylesheet" href="css/40-v143-combat-dungeon-polish.css">
<link rel="stylesheet" href="css/49-v169-rpg-ui.css">
<style>
html,body{margin:0;width:420px;height:746.6667px;overflow:hidden;background:#000;}
#game-stage{position:relative!important;width:420px!important;height:746.6667px!important;overflow:hidden!important;}
#homeFeatureModal{display:flex!important;position:absolute!important;inset:0!important;width:420px!important;height:746.6667px!important;}
</style></head><body><div id="game-stage">
<div id="homeFeatureModal" class="home-feature-modal show v141-synthesis-modal">
<div class="home-feature-modal-box"><div class="home-feature-modal-title"><span>合成</span><button class="home-feature-close-btn">返回</button></div>
<div id="homeFeatureModalBody"><div class="v141-synthesis v143-synthesis">
<div class="v141-synthesis-wallet"><span>合成</span><b>金幣 999999</b></div>
<div class="v141-synthesis-tabs"><button class="active">裝備冶煉</button><button>符咒合成</button><button>碎片合成</button></div>
<div class="v141-synthesis-body" id="body"></div>
</div></div></div></div><pre id="result"></pre>
<script>
(function(){
 const modal=document.getElementById('homeFeatureModal');
 const box=modal.querySelector('.home-feature-modal-box');
 const wallet=modal.querySelector('.v141-synthesis-wallet');
 const tabs=modal.querySelector('.v141-synthesis-tabs');
 const body=document.getElementById('body');
 const rect=el=>{const r=el.getBoundingClientRect();return {left:r.left,top:r.top,width:r.width,height:r.height};};
 const shots=[];
 const record=name=>{void box.offsetHeight;shots.push({name,box:rect(box),wallet:rect(wallet),tabs:rect(tabs),body:rect(body),scrollHeight:body.scrollHeight,clientHeight:body.clientHeight});};
 body.innerHTML='<div class="v141-synthesis-card"><p>短內容</p></div>';record('reforge');
 body.innerHTML='<div class="v141-synthesis-card">'+Array.from({length:40},(_,i)=>'<p>符咒內容 '+i+'</p>').join('')+'</div>';record('talisman');
 body.innerHTML='<div class="v141-synthesis-card">'+Array.from({length:24},(_,i)=>'<p>碎片內容 '+i+'</p>').join('')+'</div>';record('fragment');
 document.getElementById('result').textContent=JSON.stringify(shots);
})();
</script></div></body></html>`;

fs.writeFileSync(fixture,html,"utf8");
try{
    const run=cp.spawnSync(chrome,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--force-device-scale-factor=1","--window-size=420,747","--dump-dom",fileUrl],{encoding:"utf8",timeout:30000,maxBuffer:8*1024*1024});
    assert.equal(run.status,0,run.stderr||"Chrome synthesis layout fixture failed");
    const match=run.stdout.match(/<pre id="result">([\s\S]*?)<\/pre>/);
    assert.ok(match,"synthesis browser layout result missing");
    const shots=JSON.parse(match[1].replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"'));
    assert.equal(shots.length,3);
    const baseline=shots[0];
    for(const shot of shots){
        for(const part of ["box","wallet","tabs","body"]){
            for(const key of ["left","top","width","height"]){
                assert.ok(Math.abs(shot[part][key]-baseline[part][key])<0.25,`${shot.name} ${part}.${key} drifted`);
            }
        }
    }
    assert.ok(shots[1].scrollHeight>shots[1].clientHeight,"long synthesis content must scroll only inside the synthesis body");
    assert.ok(shots[0].scrollHeight<=shots[0].clientHeight+1,"short synthesis content must not shrink the outer frame");
    console.log("Headless Chrome: reforge, talisman and fragment synthesis share one Large Panel frame");
}finally{
    try{fs.unlinkSync(fixture);}catch(_){ }
}
