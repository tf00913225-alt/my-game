"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const cp=require("node:child_process");

const css=fs.readFileSync("css/48-v169-element-box-settings.css","utf8");
const sharedCss=fs.readFileSync("css/49-v169-rpg-ui.css","utf8");

assert.match(sharedCss,/--ui-medium-modal-max-width:360px;/);
assert.match(sharedCss,/--ui-medium-modal-height:540px;/);
assert.match(css,/body\.v162-element-box-settings-open #homeFeatureModal \.home-feature-modal-box\{[\s\S]*?max-width:var\(--ui-medium-modal-max-width,360px\) !important;[\s\S]*?height:min\(var\(--ui-medium-modal-height,540px\),calc\(100% - var\(--ui-medium-modal-safe-space,28px\)\)\) !important;/);
assert.match(css,/body\.v162-element-box-settings-open #homeFeatureModalBody\{[\s\S]*?overflow-y:auto !important;[\s\S]*?touch-action:pan-y !important;[\s\S]*?scrollbar-gutter:stable !important;[\s\S]*?scroll-padding-bottom:24px !important;/);
assert.match(css,/body\.v162-element-box-settings-open #autoBattleSettingsPanel\.v131-element-box-panel\{[\s\S]*?flex:0 0 auto !important;[\s\S]*?padding:0 2px 24px !important;[\s\S]*?overflow:visible !important;/);
assert.match(css,/#autoBattleSettingsPanel\.v131-element-box-panel \.auto-premium-status-copy small\{[\s\S]*?font-size:11px;/);
assert.match(css,/#autoBattleSettingsPanel\.v131-element-box-panel \.auto-setting-card\{[\s\S]*?min-height:56px;/);
assert.match(css,/body\.v162-element-box-settings-open #autoBattleSettingsPanel\.v131-element-box-panel \.auto-premium-status\{[\s\S]*?position:sticky !important;[\s\S]*?top:0 !important;/);
assert.match(css,/#autoBattleSettingsPanel\.v131-element-box-panel\.v17342-settings-locked #autoBattleButton\{[\s\S]*?display:none !important;/);
assert.match(css,/#autoBattleSettingsPanel \.v169-element-box-stop\{[\s\S]*?min-height:44px;/);

function findChrome(){
    for(const name of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){
        const result=cp.spawnSync("which",[name],{encoding:"utf8"});
        if(result.status===0&&result.stdout.trim()){ return result.stdout.trim(); }
    }
    return "";
}

const chrome=findChrome();
if(!chrome){
    console.log("Element Box Medium Modal browser check skipped: Chrome not available");
    process.exit(0);
}

const fixture=path.join(process.cwd(),".ui-element-box-medium-modal-smoke.html");
const fileUrl="file://"+fixture.replace(/\\/g,"/");
const html=`<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="css/00-main.css">
<link rel="stylesheet" href="css/26-v110-auto-settings-premium.css">
<link rel="stylesheet" href="css/48-v169-element-box-settings.css">
<link rel="stylesheet" href="css/49-v169-rpg-ui.css">
<style>
html,body{margin:0;width:420px;height:746.6667px;overflow:hidden;background:#000;}
#game-stage{position:relative!important;left:auto!important;top:auto!important;width:420px!important;height:746.6667px!important;overflow:hidden!important;transform:none!important;}
#homeFeatureModal{display:flex!important;position:absolute!important;inset:0!important;width:420px!important;height:746.6667px!important;align-items:center!important;justify-content:center!important;padding:0!important;}
.home-feature-modal-title{height:52px!important;}
</style></head><body class="v162-element-box-settings-open"><div id="game-stage"><div id="homeFeatureModal" class="home-feature-modal">
<div class="home-feature-modal-box"><div class="home-feature-modal-title"><span>元素匣設定</span><button>返回</button></div><div id="homeFeatureModalBody"><div id="autoBattleSettingsPanel" class="auto-settings-expanded auto-premium-panel v131-element-box-panel"><div class="auto-premium-status"><div class="auto-premium-status-copy"><span class="auto-panel-kicker">AUTO COMBAT</span><strong>元素匣</strong><small>設定角色行動與共用恢復條件</small></div><button id="autoBattleButton" class="auto-premium-toggle">套用並啟動</button><button id="stop" class="v169-element-box-stop" hidden>停止元素匣</button></div><div id="cards"></div><div id="bottom" class="v141-element-box-remaining">元素匣剩餘時間 08:00:00</div></div></div></div>
</div></div><pre id="result"></pre><script>
(function(){
 const box=document.querySelector('.home-feature-modal-box');
 const title=document.querySelector('.home-feature-modal-title');
 const body=document.getElementById('homeFeatureModalBody');
 const panel=document.getElementById('autoBattleSettingsPanel');
 const status=document.querySelector('.auto-premium-status');
 const primary=document.getElementById('autoBattleButton');
 const stop=document.getElementById('stop');
 const cards=document.getElementById('cards');
 const bottom=document.getElementById('bottom');
 const rect=el=>{const r=el.getBoundingClientRect();return {left:r.left,top:r.top,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
 const snap=name=>({name,box:rect(box),title:rect(title),body:rect(body),panel:rect(panel),status:rect(status),primary:rect(primary),bottom:rect(bottom),boxStyle:{height:getComputedStyle(box).height,maxWidth:getComputedStyle(box).maxWidth},bodyStyle:{overflowY:getComputedStyle(body).overflowY,gutter:getComputedStyle(body).scrollbarGutter,touchAction:getComputedStyle(body).touchAction},panelStyle:{overflowY:getComputedStyle(panel).overflowY},statusStyle:{position:getComputedStyle(status).position,top:getComputedStyle(status).top},primaryDisplay:getComputedStyle(primary).display,scrollHeight:body.scrollHeight,clientHeight:body.clientHeight,scrollTop:body.scrollTop});
 const card=i=>'<div class="auto-setting-card"><div class="auto-setting-emblem">'+i+'</div><div class="auto-setting-meta"><span>設定項目</span><strong>自動戰鬥設定 '+i+'</strong></div><div class="auto-setting-control"><button style="height:44px">選擇</button></div></div>';
 cards.innerHTML=card(1)+card(2);void box.offsetHeight;const short=snap('short');
 cards.innerHTML=Array.from({length:18},(_,i)=>card(i+1)).join('');void box.offsetHeight;const longTop=snap('longTop');
 body.scrollTop=body.scrollHeight;void box.offsetHeight;const longBottom=snap('longBottom');
 body.scrollTop=0;panel.classList.add('v17342-settings-locked');status.classList.add('v169-element-box-active');primary.disabled=true;primary.dataset.v169Mode='locked';stop.hidden=false;void box.offsetHeight;const active=snap('active');
 document.getElementById('result').textContent=JSON.stringify({short,longTop,longBottom,active});
})();
</script></body></html>`;

fs.writeFileSync(fixture,html,"utf8");
try{
    const run=cp.spawnSync(chrome,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--force-device-scale-factor=1","--window-size=420,747","--dump-dom",fileUrl],{encoding:"utf8",timeout:30000,maxBuffer:8*1024*1024});
    assert.equal(run.status,0,run.stderr||"Chrome Element Box Medium Modal fixture failed");
    const match=run.stdout.match(/<pre id="result">([\s\S]*?)<\/pre>/);
    assert.ok(match,"Element Box Medium Modal browser result missing");
    const data=JSON.parse(match[1].replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"'));
    for(const shot of [data.short,data.longTop,data.longBottom,data.active]){
        assert.equal(shot.boxStyle.maxWidth,"360px","Element Box must use Medium Modal width ceiling");
        assert.equal(shot.boxStyle.height,"540px","Element Box must use Medium Modal height");
        assert.equal(shot.bodyStyle.overflowY,"auto","modal body must own vertical scrolling");
        assert.equal(shot.bodyStyle.gutter,"stable","modal body must reserve stable scrollbar space");
        assert.equal(shot.bodyStyle.touchAction,"pan-y","modal body must permit vertical touch scrolling");
        assert.equal(shot.panelStyle.overflowY,"visible","settings panel must not create a nested scroll surface");
        assert.equal(shot.statusStyle.position,"sticky","status row must stay visible while settings scroll");
    }
    for(const part of ["box","title","body"]){
        for(const key of ["left","top","width","height"]){
            assert.ok(Math.abs(data.short[part][key]-data.longTop[part][key])<0.25,`${part}.${key} must not move when settings content changes`);
        }
    }
    assert.ok(data.longTop.scrollHeight>data.longTop.clientHeight,"long settings content must scroll inside the modal body");
    assert.ok(data.short.scrollHeight<=data.short.clientHeight+1,"short settings content must leave stable empty space instead of resizing the modal");
    assert.ok(data.longBottom.scrollTop>0,"the body must scroll to the final settings rows");
    assert.ok(data.longBottom.bottom.bottom<=data.longBottom.body.bottom+1,"the final Element Box row must be fully reachable");
    assert.ok(Math.abs(data.longBottom.status.top-data.longBottom.body.top)<1.5,"sticky status row must remain at the top while scrolled");
    assert.equal(data.active.primaryDisplay,"none","locked mode must hide the redundant disabled primary button");
    assert.ok(data.active.status.height<90,"active status must stay compact instead of consuming two rows");
    console.log("Headless Chrome: Element Box settings remain reachable with one body scroll owner");
}finally{
    try{fs.unlinkSync(fixture);}catch(_){ }
}
