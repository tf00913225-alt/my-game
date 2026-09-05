"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const cp=require("node:child_process");

const detailCss=fs.readFileSync("css/23-stage-v77-inventory-detail-ui.css","utf8");
const sharedCss=fs.readFileSync("css/49-v169-rpg-ui.css","utf8");
const touchLock=fs.readFileSync("js/01-stage-v8-touch-lock.js","utf8");

assert.match(sharedCss,/--ui-medium-modal-max-width:360px;/);
assert.match(sharedCss,/--ui-medium-modal-height:540px;/);
assert.match(sharedCss,/--ui-medium-modal-safe-space:28px;/);
assert.match(detailCss,/#inventoryCharacterDetailModal \.inventory-character-detail-box\{[\s\S]*?max-width:var\(--ui-medium-modal-max-width,360px\) !important;[\s\S]*?height:min\(var\(--ui-medium-modal-height,540px\),calc\(100% - var\(--ui-medium-modal-safe-space,28px\)\)\) !important;/);
assert.match(detailCss,/#inventoryCharacterDetailModal \.inventory-character-detail-grid\{[\s\S]*?flex:1 1 auto !important;[\s\S]*?overflow-y:auto !important;[\s\S]*?touch-action:pan-y !important;[\s\S]*?scrollbar-gutter:stable !important;/);
assert.match(detailCss,/#inventoryCharacterDetailModal \.close-item-button\{[\s\S]*?flex:0 0 auto !important;/);
assert.match(touchLock,/\.inventory-character-detail-grid/);

function findChrome(){
    for(const name of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){
        const result=cp.spawnSync("which",[name],{encoding:"utf8"});
        if(result.status===0&&result.stdout.trim()){ return result.stdout.trim(); }
    }
    return "";
}

const chrome=findChrome();
if(!chrome){
    console.log("Character detail Medium Modal browser check skipped: Chrome not available");
    process.exit(0);
}

const fixture=path.join(process.cwd(),".ui-character-detail-medium-smoke.html");
const fileUrl="file://"+fixture.replace(/\\/g,"/");
const html=`<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="css/00-main.css">
<link rel="stylesheet" href="css/23-stage-v77-inventory-detail-ui.css">
<link rel="stylesheet" href="css/49-v169-rpg-ui.css">
<style>
html,body{margin:0;width:420px;height:746.6667px;overflow:hidden;background:#000;}
#game-stage{position:relative!important;width:420px!important;height:746.6667px!important;overflow:hidden!important;transform:none!important;}
#inventoryCharacterDetailModal{display:flex!important;position:absolute!important;inset:0!important;width:420px!important;height:746.6667px!important;align-items:center!important;justify-content:center!important;}
#inventoryCharacterDetailModal .inventory-character-detail-box{padding:15px!important;}
#inventoryCharacterDetailModal h2{flex:0 0 auto;margin:0;height:36px;}
#inventoryCharacterDetailModal .close-item-button{height:46px;min-height:46px;}
.inventory-character-detail-row{min-height:44px;box-sizing:border-box;}
</style></head><body><div id="game-stage"><div id="inventoryCharacterDetailModal" class="item-modal inventory-character-detail-modal">
<div class="inventory-character-detail-box"><h2>測試 Lv.12</h2><div id="inventoryCharacterDetailStats" class="inventory-character-detail-grid"></div><button class="close-item-button">關閉</button></div>
</div></div><pre id="result"></pre><script>
(function(){
 const box=document.querySelector('.inventory-character-detail-box');
 const stats=document.getElementById('inventoryCharacterDetailStats');
 const close=document.querySelector('.close-item-button');
 const rect=el=>{const r=el.getBoundingClientRect();return {left:r.left,top:r.top,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
 const snap=name=>({name,box:rect(box),stats:rect(stats),close:rect(close),boxStyle:{width:getComputedStyle(box).width,height:getComputedStyle(box).height,maxWidth:getComputedStyle(box).maxWidth},statsStyle:{overflowY:getComputedStyle(stats).overflowY,gutter:getComputedStyle(stats).scrollbarGutter,touchAction:getComputedStyle(stats).touchAction},scrollHeight:stats.scrollHeight,clientHeight:stats.clientHeight});
 const row=i=>'<div class="inventory-character-detail-row"><span>屬性 '+i+'</span><b>'+i+'.0%</b></div>';
 stats.innerHTML=Array.from({length:4},(_,i)=>row(i)).join('');void box.offsetHeight;const short=snap('short');
 stats.innerHTML=Array.from({length:36},(_,i)=>row(i)).join('');void box.offsetHeight;const long=snap('long');
 document.getElementById('result').textContent=JSON.stringify({short,long});
})();
</script></body></html>`;

fs.writeFileSync(fixture,html,"utf8");
try{
    const run=cp.spawnSync(chrome,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--force-device-scale-factor=1","--window-size=420,747","--dump-dom",fileUrl],{encoding:"utf8",timeout:30000,maxBuffer:8*1024*1024});
    assert.equal(run.status,0,run.stderr||"Chrome character detail Medium Modal fixture failed");
    const match=run.stdout.match(/<pre id="result">([\s\S]*?)<\/pre>/);
    assert.ok(match,"character detail Medium Modal browser result missing");
    const data=JSON.parse(match[1].replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"'));
    for(const shot of [data.short,data.long]){
        assert.equal(shot.boxStyle.maxWidth,"360px","character detail must keep Medium Modal width ceiling");
        assert.equal(shot.boxStyle.height,"540px","character detail must use Medium Modal height");
        assert.equal(shot.statsStyle.overflowY,"auto","character detail stats must own vertical scrolling");
        assert.equal(shot.statsStyle.gutter,"stable","character detail stats must reserve scrollbar space");
        assert.equal(shot.statsStyle.touchAction,"pan-y","character detail stats must allow vertical touch scrolling");
    }
    for(const part of ["box","stats","close"]){
        for(const key of ["left","top","width","height"]){
            assert.ok(Math.abs(data.short[part][key]-data.long[part][key])<0.25,`${part}.${key} must not move when character detail content changes`);
        }
    }
    assert.ok(data.long.scrollHeight>data.long.clientHeight,"long character detail content must scroll internally");
    assert.ok(data.short.scrollHeight<=data.short.clientHeight+1,"short character detail content must leave stable empty space instead of resizing the modal");
    console.log("Headless Chrome: character detail uses one fixed Medium Modal frame");
}finally{
    try{fs.unlinkSync(fixture);}catch(_){ }
}
