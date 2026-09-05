"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const cp=require("node:child_process");

const css=fs.readFileSync("css/49-v169-rpg-ui.css","utf8");

assert.match(css,/--ui-medium-modal-max-width:360px;/);
assert.match(css,/--ui-medium-modal-height:540px;/);
assert.match(css,/--ui-medium-modal-safe-space:28px;/);
assert.match(css,/#itemModal \.item-modal-box\{[\s\S]*?max-width:var\(--ui-medium-modal-max-width\) !important;[\s\S]*?height:min\(var\(--ui-medium-modal-height\),calc\(100% - var\(--ui-medium-modal-safe-space\)\)\) !important;/);
assert.match(css,/#itemModal #itemModalStats\{[\s\S]*?flex:1 1 auto !important;[\s\S]*?overflow-y:auto !important;[\s\S]*?scrollbar-gutter:stable !important;/);
assert.match(css,/#itemModal \.item-modal-buttons\{[\s\S]*?flex:0 0 auto !important;/);

function findChrome(){
    for(const name of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){
        const result=cp.spawnSync("which",[name],{encoding:"utf8"});
        if(result.status===0&&result.stdout.trim()){ return result.stdout.trim(); }
    }
    return "";
}

const chrome=findChrome();
if(!chrome){
    console.log("Item Medium Modal browser check skipped: Chrome not available");
    process.exit(0);
}

const fixture=path.join(process.cwd(),".ui-medium-item-detail-smoke.html");
const fileUrl="file://"+fixture.replace(/\\/g,"/");
const html=`<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="css/00-main.css">
<link rel="stylesheet" href="css/38-v141-system-expansion.css">
<link rel="stylesheet" href="css/49-v169-rpg-ui.css">
<style>
html,body{margin:0;width:420px;height:746.6667px;overflow:hidden;background:#000;}
#game-stage{position:relative!important;width:420px!important;height:746.6667px!important;overflow:hidden!important;transform:none!important;}
#itemModal{display:flex!important;position:absolute!important;inset:0!important;width:420px!important;height:746.6667px!important;align-items:center!important;justify-content:center!important;}
#itemModalIcon{height:150px;}.item-modal-buttons{height:46px;}
</style></head><body><div id="game-stage"><div id="itemModal" class="item-modal">
<div class="item-modal-box"><div id="itemModalIcon" class="item-modal-icon">物</div><div id="itemModalName" class="item-modal-name">測試裝備</div><div id="itemModalStats" class="item-stat-list"></div><div class="item-modal-buttons"><button>裝備</button><button>返回</button></div></div>
</div></div><pre id="result"></pre><script>
(function(){
 const box=document.querySelector('.item-modal-box');
 const stats=document.getElementById('itemModalStats');
 const buttons=document.querySelector('.item-modal-buttons');
 const rect=el=>{const r=el.getBoundingClientRect();return {left:r.left,top:r.top,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
 const snap=name=>({name,box:rect(box),stats:rect(stats),buttons:rect(buttons),boxStyle:{width:getComputedStyle(box).width,height:getComputedStyle(box).height,maxWidth:getComputedStyle(box).maxWidth},statsStyle:{overflowY:getComputedStyle(stats).overflowY,gutter:getComputedStyle(stats).scrollbarGutter},scrollHeight:stats.scrollHeight,clientHeight:stats.clientHeight});
 stats.innerHTML='<p>短內容</p>';void box.offsetHeight;const short=snap('short');
 stats.innerHTML=Array.from({length:45},(_,i)=>'<p>裝備屬性 '+i+'</p>').join('');void box.offsetHeight;const long=snap('long');
 document.getElementById('result').textContent=JSON.stringify({short,long});
})();
</script></body></html>`;

fs.writeFileSync(fixture,html,"utf8");
try{
    const run=cp.spawnSync(chrome,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--force-device-scale-factor=1","--window-size=420,747","--dump-dom",fileUrl],{encoding:"utf8",timeout:30000,maxBuffer:8*1024*1024});
    assert.equal(run.status,0,run.stderr||"Chrome item Medium Modal fixture failed");
    const match=run.stdout.match(/<pre id="result">([\s\S]*?)<\/pre>/);
    assert.ok(match,"item Medium Modal browser result missing");
    const data=JSON.parse(match[1].replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"'));
    for(const shot of [data.short,data.long]){
        assert.equal(shot.boxStyle.width,"360px","item detail must use Medium Modal width");
        assert.equal(shot.boxStyle.maxWidth,"360px","item detail must keep Medium Modal width ceiling");
        assert.equal(shot.boxStyle.height,"540px","item detail must use Medium Modal height");
        assert.equal(shot.statsStyle.overflowY,"auto","item stats must own vertical scrolling");
        assert.equal(shot.statsStyle.gutter,"stable","item stats must reserve stable scrollbar space");
    }
    for(const part of ["box","stats","buttons"]){
        for(const key of ["left","top","width","height"]){
            assert.ok(Math.abs(data.short[part][key]-data.long[part][key])<0.25,`${part}.${key} must not move when item content changes`);
        }
    }
    assert.ok(data.long.scrollHeight>data.long.clientHeight,"long item detail content must scroll internally");
    assert.ok(data.short.scrollHeight<=data.short.clientHeight+1,"short item detail content must leave stable empty space instead of resizing the modal");
    console.log("Headless Chrome: item/equipment detail uses one fixed Medium Modal frame");
}finally{
    try{fs.unlinkSync(fixture);}catch(_){ }
}
