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
assert.match(css,/#autoBattleSettingsPanel\.v131-element-box-panel \.auto-premium-status-copy small\{[\s\S]*?font-size:14px;[\s\S]*?line-height:19px;/);
assert.match(css,/#autoBattleSettingsPanel\.v131-element-box-panel \.auto-setting-card\{[\s\S]*?min-height:64px;/);
assert.match(css,/#autoBattleSettingsPanel\.v131-element-box-panel \.auto-setting-meta strong\{[\s\S]*?font-size:16px;/);
assert.match(css,/#autoBattleSettingsPanel\.v131-element-box-panel \.auto-threshold-head strong\{[\s\S]*?font-size:15px;/);
assert.match(css,/body\.v162-element-box-settings-open #autoBattleSettingsPanel\.v131-element-box-panel \.auto-premium-status\{[\s\S]*?position:sticky !important;[\s\S]*?top:0 !important;/);
assert.match(css,/#autoBattleSettingsPanel\.v131-element-box-panel\.v17342-settings-locked #autoBattleButton\{[\s\S]*?display:none !important;/);
assert.match(css,/#autoBattleSettingsPanel \.v169-element-box-stop\{[\s\S]*?min-height:44px;[\s\S]*?font:900 15px\/1 sans-serif;/);

function findChrome(){
    for(const name of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){
        const result=cp.spawnSync("which",[name],{encoding:"utf8"});
        if(result.status===0&&result.stdout.trim()) return result.stdout.trim();
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
<style>html,body{margin:0;width:420px;height:746.6667px;overflow:hidden;background:#000}#game-stage{position:relative!important;left:auto!important;top:auto!important;width:420px!important;height:746.6667px!important;overflow:hidden!important;transform:none!important}#homeFeatureModal{display:flex!important;position:absolute!important;inset:0!important;width:420px!important;height:746.6667px!important;align-items:center!important;justify-content:center!important;padding:0!important}.home-feature-modal-title{height:52px!important}</style>
</head><body class="v162-element-box-settings-open"><div id="game-stage"><div id="homeFeatureModal" class="home-feature-modal"><div class="home-feature-modal-box"><div class="home-feature-modal-title"><span>元素匣設定</span><button>返回</button></div><div id="homeFeatureModalBody"><div id="autoBattleSettingsPanel" class="auto-settings-expanded auto-premium-panel v131-element-box-panel"><div class="auto-premium-status"><div class="auto-premium-status-copy"><span class="auto-panel-kicker">AUTO COMBAT</span><strong>元素匣</strong><small id="statusNote">設定角色行動與共用恢復條件</small></div><button id="autoBattleButton" class="auto-premium-toggle">套用並啟動</button><button id="stop" class="v169-element-box-stop" hidden>停止元素匣</button></div><div id="cards"></div><div id="bottom" class="v141-element-box-remaining">元素匣剩餘時間 08:00:00</div></div></div></div></div></div><pre id="result"></pre>
<script>(function(){const box=document.querySelector('.home-feature-modal-box'),body=document.getElementById('homeFeatureModalBody'),panel=document.getElementById('autoBattleSettingsPanel'),status=document.querySelector('.auto-premium-status'),note=document.getElementById('statusNote'),primary=document.getElementById('autoBattleButton'),stop=document.getElementById('stop'),cards=document.getElementById('cards'),bottom=document.getElementById('bottom');const rect=el=>{const r=el.getBoundingClientRect();return {left:r.left,top:r.top,width:r.width,height:r.height,right:r.right,bottom:r.bottom}};const card=i=>'<div class="auto-setting-card"><div class="auto-setting-emblem">'+i+'</div><div class="auto-setting-meta"><span>設定項目</span><strong>自動戰鬥設定 '+i+'</strong></div><div class="auto-setting-control"><button style="height:44px">選擇</button></div></div>';cards.innerHTML=Array.from({length:18},(_,i)=>card(i+1)).join('');void box.offsetHeight;const top={box:rect(box),body:rect(body),status:rect(status),noteFont:getComputedStyle(note).fontSize,overflow:getComputedStyle(body).overflowY,touch:getComputedStyle(body).touchAction,scrollHeight:body.scrollHeight,clientHeight:body.clientHeight};body.scrollTop=body.scrollHeight;void box.offsetHeight;const bottomShot={status:rect(status),bottom:rect(bottom),body:rect(body),scrollTop:body.scrollTop};body.scrollTop=0;panel.classList.add('v17342-settings-locked');status.classList.add('v169-element-box-active');primary.disabled=true;stop.hidden=false;void box.offsetHeight;const active={primaryDisplay:getComputedStyle(primary).display,statusHeight:rect(status).height,stopFont:getComputedStyle(stop).fontSize,stopHeight:rect(stop).height};document.getElementById('result').textContent=JSON.stringify({top,bottomShot,active})})();</script></body></html>`;

fs.writeFileSync(fixture,html,"utf8");
try{
    const run=cp.spawnSync(chrome,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--force-device-scale-factor=1","--window-size=420,747","--dump-dom",fileUrl],{encoding:"utf8",timeout:30000,maxBuffer:8*1024*1024});
    assert.equal(run.status,0,run.stderr||"Chrome Element Box Medium Modal fixture failed");
    const match=run.stdout.match(/<pre id="result">([\s\S]*?)<\/pre>/);
    assert.ok(match,"Element Box Medium Modal browser result missing");
    const data=JSON.parse(match[1].replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"'));
    assert.ok(Math.abs(data.top.box.width-360)<0.5,"Element Box must keep the Medium Modal width");
    assert.ok(Math.abs(data.top.box.height-540)<0.5,"Element Box must keep the Medium Modal height");
    assert.equal(data.top.overflow,"auto","modal body must own vertical scrolling");
    assert.match(data.top.touch,/pan-y/,"modal body must permit vertical touch scrolling");
    assert.equal(data.top.noteFont,"14px","status helper must remain readable");
    assert.ok(data.top.scrollHeight>data.top.clientHeight,"long settings content must scroll inside the modal body");
    assert.ok(data.bottomShot.scrollTop>0,"the body must scroll to the final settings rows");
    assert.ok(data.bottomShot.bottom.bottom<=data.bottomShot.body.bottom+1,"the final Element Box row must be fully reachable");
    assert.ok(Math.abs(data.bottomShot.status.top-data.bottomShot.body.top)<1.5,"sticky status row must remain at the top while scrolled");
    assert.equal(data.active.primaryDisplay,"none","locked mode must hide the redundant disabled primary button");
    assert.ok(data.active.statusHeight<90,"active status must stay compact instead of consuming two rows");
    assert.equal(data.active.stopFont,"15px","stop action must use primary UI text size");
    assert.ok(data.active.stopHeight>=44,"stop action must keep its touch target");
    console.log("Headless Chrome: Element Box typography, scrolling and locked-state geometry verified");
}finally{try{fs.unlinkSync(fixture)}catch(_){}}
