"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const cp=require("node:child_process");

const css=fs.readFileSync("css/49-v169-rpg-ui.css","utf8");
const detailCss=fs.readFileSync("css/23-stage-v77-inventory-detail-ui.css","utf8");
const itemRuntime=fs.readFileSync("js/35-v141-ui-battle.js","utf8");

assert.match(css,/--ui-medium-modal-max-width:360px;/);
assert.match(css,/--ui-medium-modal-height:540px;/);
assert.match(css,/--ui-medium-modal-safe-space:28px;/);
assert.match(css,/#itemModal \.item-modal-box\{[\s\S]*?max-width:var\(--ui-medium-modal-max-width\) !important;[\s\S]*?height:min\(var\(--ui-medium-modal-height\),calc\(100% - var\(--ui-medium-modal-safe-space\)\)\) !important;/);
assert.match(css,/#itemModal #itemModalStats\{[\s\S]*?flex:0 1 auto !important;[\s\S]*?overflow-y:auto !important;[\s\S]*?scrollbar-gutter:stable !important;/);
assert.match(css,/#itemModal \.item-modal-buttons\{[\s\S]*?flex:0 0 auto !important;/);
assert.match(detailCss,/#itemModal \.item-modal-box:has\(#v17342InventoryPotionUse\),[\s\S]*?#itemModal \.item-modal-box:has\(#itemEquipButton:disabled\)\{[\s\S]*?height:auto !important;[\s\S]*?flex:0 0 auto !important;[\s\S]*?justify-content:flex-start !important;/);
assert.match(detailCss,/#itemModal \.item-modal-box:has\(#v17342InventoryPotionUse\) #itemModalStats,[\s\S]*?#itemModal \.item-modal-box:has\(#itemEquipButton:disabled\) #itemModalStats\{[\s\S]*?flex:0 0 auto !important;[\s\S]*?max-height:180px !important;/);
assert.match(detailCss,/#itemModal \.item-modal-box:has\(#v17342InventoryPotionUse\) \.item-modal-buttons,[\s\S]*?#itemModal \.item-modal-box:has\(#itemEquipButton:disabled\) \.item-modal-buttons\{[\s\S]*?margin-top:0 !important;/);
assert.match(itemRuntime,/button\.id="v17342InventoryPotionUse"/);
assert.match(itemRuntime,/const definition=item&&typeof getPotionDefinition==="function"\?getPotionDefinition\(item\.id\):null;/);
assert.match(itemRuntime,/if\(!definition\)\{[\s\S]*?if\(button\)\{ button\.remove\(\); \}[\s\S]*?return;/);

function findChrome(){
    for(const name of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){
        const result=cp.spawnSync("which",[name],{encoding:"utf8"});
        if(result.status===0&&result.stdout.trim()){ return result.stdout.trim(); }
    }
    return "";
}

const chrome=findChrome();
if(!chrome){
    console.log("Item detail browser check skipped: Chrome not available");
    process.exit(0);
}

const fixture=path.join(process.cwd(),".ui-medium-item-detail-smoke.html");
const fileUrl="file://"+fixture.replace(/\\/g,"/");
const html=`<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="css/00-main.css">
<link rel="stylesheet" href="css/23-stage-v77-inventory-detail-ui.css">
<link rel="stylesheet" href="css/38-v141-system-expansion.css">
<link rel="stylesheet" href="css/49-v169-rpg-ui.css">
<style>
html,body{margin:0;width:420px;height:746.6667px;overflow:hidden;background:#000;}
#game-stage{position:relative!important;width:420px!important;height:746.6667px!important;overflow:hidden!important;transform:none!important;}
#itemModal{display:flex!important;position:absolute!important;inset:0!important;width:420px!important;height:746.6667px!important;align-items:center!important;justify-content:center!important;}
#itemModalIcon{height:150px;}.item-modal-buttons{min-height:46px;}
</style></head><body><div id="game-stage"><div id="itemModal" class="item-modal">
<div class="item-modal-box"><div id="itemModalIcon" class="item-modal-icon">◆</div><div id="itemModalName" class="item-modal-name">回復10%SP藥水</div><div id="itemModalStats" class="item-stat-list"></div><div class="item-modal-buttons"><button id="v17342InventoryPotionUse">使用</button><button id="itemEquipButton">不可裝備</button><button>售出</button></div><button class="close-item-button">返回</button></div>
</div></div><pre id="result"></pre><script>
(function(){
 const box=document.querySelector('.item-modal-box');
 const stats=document.getElementById('itemModalStats');
 const buttons=document.querySelector('.item-modal-buttons');
 const equip=document.getElementById('itemEquipButton');
 const use=document.getElementById('v17342InventoryPotionUse');
 const rect=el=>{const r=el.getBoundingClientRect();return {left:r.left,top:r.top,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
 const snap=name=>({name,box:rect(box),stats:rect(stats),buttons:rect(buttons),boxStyle:{width:getComputedStyle(box).width,height:getComputedStyle(box).height,maxWidth:getComputedStyle(box).maxWidth,justifyContent:getComputedStyle(box).justifyContent,flex:getComputedStyle(box).flex},statsStyle:{overflowY:getComputedStyle(stats).overflowY,gutter:getComputedStyle(stats).scrollbarGutter,flex:getComputedStyle(stats).flex},scrollHeight:stats.scrollHeight,clientHeight:stats.clientHeight});
 // Match the real final potion DOM signal. Keep equip enabled here deliberately:
 // compact behavior must not depend on the legacy disabled state anymore.
 equip.disabled=false;stats.innerHTML='<p>效果：回復最大 SP 的 10%</p><p>售價：25 金幣</p>';void box.offsetHeight;const potion=snap('potion');
 use.remove();equip.textContent='穿戴';stats.innerHTML=Array.from({length:45},(_,i)=>'<p>裝備屬性 '+i+'</p>').join('');void box.offsetHeight;const equipment=snap('equipment');
 document.getElementById('result').textContent=JSON.stringify({potion,equipment});
})();
</script></body></html>`;

fs.writeFileSync(fixture,html,"utf8");
try{
    const run=cp.spawnSync(chrome,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--force-device-scale-factor=1","--window-size=420,747","--dump-dom",fileUrl],{encoding:"utf8",timeout:30000,maxBuffer:8*1024*1024});
    assert.equal(run.status,0,run.stderr||"Chrome item detail fixture failed");
    const match=run.stdout.match(/<pre id="result">([\s\S]*?)<\/pre>/);
    assert.ok(match,"item detail browser result missing");
    const data=JSON.parse(match[1].replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"'));
    for(const shot of [data.potion,data.equipment]){
        const resolvedWidth=parseFloat(shot.boxStyle.width);
        assert.ok(resolvedWidth>300&&resolvedWidth<=360,"item detail must respect the shared width ceiling and safe area");
        assert.equal(shot.boxStyle.maxWidth,"360px","item detail must keep the shared width ceiling");
        assert.equal(shot.statsStyle.overflowY,"auto","item stats must own vertical scrolling when needed");
        assert.equal(shot.statsStyle.gutter,"stable","item stats must reserve stable scrollbar space");
    }
    assert.ok(data.potion.box.height<data.equipment.box.height-120,"real potion action dialog must collapse far below the equipment inspector height");
    assert.equal(data.potion.boxStyle.justifyContent,"flex-start","potion modal must not distribute leftover vertical space");
    assert.ok(data.potion.boxStyle.flex.startsWith("0 0"),"potion modal must not flex-fill its overlay");
    assert.equal(data.equipment.boxStyle.height,"540px","equipment detail must retain the Medium Modal height");
    assert.ok(data.potion.scrollHeight<=data.potion.clientHeight+1,"potion details must not require scrolling");
    assert.ok(data.equipment.scrollHeight>data.equipment.clientHeight,"long equipment detail must scroll internally");
    assert.ok(data.potion.buttons.top-data.potion.stats.bottom<24,"potion actions must sit directly below the information card without a blank spacer");
    console.log("Headless Chrome: real potion-use DOM collapses the full dialog while equipment retains the fixed Medium Modal inspector");
}finally{
    try{fs.unlinkSync(fixture);}catch(_){ }
}
