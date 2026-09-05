"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const cp=require("node:child_process");

const compactCss=fs.readFileSync("css/37-v139-rested-experience.css","utf8");
const sharedCss=fs.readFileSync("css/49-v169-rpg-ui.css","utf8");

assert.match(sharedCss,/--ui-medium-modal-max-width:360px;/);
assert.match(sharedCss,/--ui-medium-modal-height:540px;/);
assert.match(sharedCss,/--ui-medium-modal-safe-space:28px;/);
assert.match(compactCss,/#homeFeatureModal:has\(#homeFeatureModalBody > \.system-panel\) \.home-feature-modal-box\{[\s\S]*?max-width:var\(--ui-medium-modal-max-width,360px\) !important;[\s\S]*?height:min\(var\(--ui-medium-modal-height,540px\),calc\(100% - var\(--ui-medium-modal-safe-space,28px\)\)\) !important;/);
assert.match(compactCss,/#homeFeatureModal:has\(#homeFeatureModalBody > \.system-panel\) #homeFeatureModalBody\{[\s\S]*?flex:1 1 auto !important;[\s\S]*?overflow-y:auto !important;[\s\S]*?touch-action:pan-y !important;[\s\S]*?scrollbar-gutter:stable !important;/);
assert.match(compactCss,/#homeFeatureModal:has\(#homeFeatureModalBody > \.system-panel\) \.home-feature-modal-title\{[\s\S]*?flex:0 0 auto !important;/);
assert.match(compactCss,/#homeFeatureModal:has\(#homeFeatureModalBody > \.system-panel\) \.system-panel-row\{[\s\S]*?min-height:56px !important;/);
assert.match(compactCss,/#homeFeatureModal:has\(#homeFeatureModalBody > \.system-panel\) \.system-panel button,[\s\S]*?min-height:44px !important;/);

function findChrome(){
    for(const name of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){
        const result=cp.spawnSync("which",[name],{encoding:"utf8"});
        if(result.status===0&&result.stdout.trim()){ return result.stdout.trim(); }
    }
    return "";
}

const chrome=findChrome();
if(!chrome){
    console.log("System Medium Modal browser check skipped: Chrome not available");
    process.exit(0);
}

const fixture=path.join(process.cwd(),".ui-system-medium-modal-smoke.html");
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
<div class="home-feature-modal-box"><div class="home-feature-modal-title"><span>系統</span><button>返回</button></div><div id="homeFeatureModalBody"><div id="systemPanel" class="system-panel"></div></div></div>
</div></div><pre id="result"></pre><script>
(function(){
 const box=document.querySelector('.home-feature-modal-box');
 const title=document.querySelector('.home-feature-modal-title');
 const body=document.getElementById('homeFeatureModalBody');
 const panel=document.getElementById('systemPanel');
 const rect=el=>{const r=el.getBoundingClientRect();return {left:r.left,top:r.top,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
 const row=i=>'<div class="system-panel-row"><div><strong>系統設定 '+i+'</strong><small>設定說明</small></div><button type="button">切換</button></div>';
 const snap=name=>{const first=panel.querySelector('.system-panel-row');const button=panel.querySelector('button');return {name,box:rect(box),title:rect(title),body:rect(body),row:first?rect(first):null,button:button?rect(button):null,boxStyle:{height:getComputedStyle(box).height,maxWidth:getComputedStyle(box).maxWidth},bodyStyle:{overflowY:getComputedStyle(body).overflowY,gutter:getComputedStyle(body).scrollbarGutter,touchAction:getComputedStyle(body).touchAction},scrollHeight:body.scrollHeight,clientHeight:body.clientHeight};};
 panel.innerHTML=row(1)+row(2);void box.offsetHeight;const short=snap('short');
 panel.innerHTML=Array.from({length:20},(_,i)=>row(i+1)).join('');void box.offsetHeight;const long=snap('long');
 document.getElementById('result').textContent=JSON.stringify({short,long});
})();
</script></body></html>`;

fs.writeFileSync(fixture,html,"utf8");
try{
    const run=cp.spawnSync(chrome,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--force-device-scale-factor=1","--window-size=420,747","--dump-dom",fileUrl],{encoding:"utf8",timeout:30000,maxBuffer:8*1024*1024});
    assert.equal(run.status,0,run.stderr||"Chrome system Medium Modal fixture failed");
    const match=run.stdout.match(/<pre id="result">([\s\S]*?)<\/pre>/);
    assert.ok(match,"system Medium Modal browser result missing");
    const data=JSON.parse(match[1].replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"'));
    for(const shot of [data.short,data.long]){
        assert.equal(shot.boxStyle.maxWidth,"360px","system must use Medium Modal width ceiling");
        assert.equal(shot.boxStyle.height,"540px","system must use Medium Modal height");
        assert.equal(shot.bodyStyle.overflowY,"auto","system body must own vertical scrolling");
        assert.equal(shot.bodyStyle.gutter,"stable","system body must reserve stable scrollbar space");
        assert.equal(shot.bodyStyle.touchAction,"pan-y","system body must permit vertical touch scrolling");
        assert.ok(shot.row.height>=56,"system rows must keep readable mobile height");
        assert.ok(shot.button.height>=44,"system controls must keep mobile-friendly tap height");
    }
    for(const part of ["box","title","body"]){
        for(const key of ["left","top","width","height"]){
            assert.ok(Math.abs(data.short[part][key]-data.long[part][key])<0.25,`${part}.${key} must not move when system content changes`);
        }
    }
    assert.ok(data.long.scrollHeight>data.long.clientHeight,"long system content must scroll internally");
    assert.ok(data.short.scrollHeight<=data.short.clientHeight+1,"short system content must leave stable empty space instead of resizing the modal");
    console.log("Headless Chrome: system uses one fixed Medium Modal frame");
}finally{
    try{fs.unlinkSync(fixture);}catch(_){ }
}
