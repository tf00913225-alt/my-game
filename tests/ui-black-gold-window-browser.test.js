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
    console.log("Black-gold browser geometry check skipped: Chrome not available");
    process.exit(0);
}

const root=process.cwd();
const source=fs.readFileSync("css/49-v169-rpg-ui.css","utf8");
const marker="/* =====================================================\n   Shared Black-Gold Window Skin — visual-only owner";
const markerIndex=source.indexOf(marker);
assert.ok(markerIndex>=0,"black-gold skin marker must exist");

const baselineCss=path.join(root,".ui-black-gold-baseline.css");
const baselineHtml=path.join(root,".ui-black-gold-baseline.html");
const themedHtml=path.join(root,".ui-black-gold-themed.html");

function fixture(cssHref){
return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="css/00-main.css">
<link rel="stylesheet" href="${cssHref}">
<style>
html,body{margin:0;width:420px;height:746px;overflow:hidden;background:#080706;}
#game-stage{position:relative!important;width:420px!important;height:746px!important;overflow:hidden!important;}
#largeSample,#backpackSample,#mediumSample{position:absolute!important;box-sizing:border-box!important;padding:10px!important;overflow:hidden!important;}
#largeSample{left:10px!important;top:10px!important;width:195px!important;height:214px!important;}
#backpackSample{left:215px!important;top:10px!important;width:195px!important;height:214px!important;}
#mediumSample{left:10px!important;top:234px!important;width:195px!important;height:232px!important;display:flex!important;flex-direction:column!important;gap:8px!important;}
#rewardSample{position:absolute!important;left:215px!important;top:234px!important;width:195px!important;height:232px!important;box-sizing:border-box!important;padding:10px!important;overflow:hidden!important;}
#smallSample{position:absolute!important;left:10px!important;top:486px!important;width:400px!important;height:244px!important;box-sizing:border-box!important;padding:20px!important;overflow:hidden!important;}
.sample-tabs{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:6px!important;}
.sample-list{height:116px!important;overflow-y:auto!important;}
.sample-row{height:38px!important;box-sizing:border-box!important;}
#mediumStats{flex:1 1 auto!important;min-height:0!important;overflow-y:auto!important;}
#largeSample button,#backpackSample button,#mediumSample button,#rewardSample button,#smallSample button{height:34px!important;box-sizing:border-box!important;}
</style></head><body>
<div id="game-stage">
  <section id="largeSample" class="home-feature-modal-box">
    <div id="largeTitle" class="home-feature-modal-title"><span>角色</span><button class="home-feature-close-btn">返回</button></div>
    <div class="sample-tabs"><button id="tabIdle" class="character-tab">能力</button><button id="tabActive" class="character-tab active">技能</button></div>
    <div id="largeBody">大型主視窗內容面板</div>
  </section>
  <section id="backpackSample" class="inventory-classic-shell">
    <div class="inventory-classic-title">背包</div>
    <div class="sample-tabs"><button class="inventory-category-tab active">裝備</button><button class="inventory-category-tab">材料</button></div>
    <div class="sample-list">${Array.from({length:6},(_,i)=>`<div class="sample-row">道具 ${i+1}</div>`).join("")}</div>
  </section>
  <section id="mediumSample" class="item-modal-box">
    <div class="item-modal-name">裝備資訊</div>
    <div id="mediumStats" class="item-stat-list">攻擊 +10<br>體力 +5<br>附加詞條<br>說明內容</div>
    <button id="mediumClose" class="close-item-button">返回</button>
  </section>
  <section id="rewardSample" class="v132-reward-modal-inner">
    <div class="v132-reward-modal-title">副本獎勵</div>
    <div class="v17363-text-reward-preview">金幣 × 100<br>材料 × 3</div>
    <button id="rewardButton">確認</button>
  </section>
</div>
<section id="smallSample" class="v169-rpg-dialog" data-kind="confirm">
  <h2>確認視窗</h2><div class="v169-rpg-dialog-message">是否執行此操作？</div>
  <div class="v169-rpg-dialog-actions"><button id="smallCancel" class="v169-rpg-dialog-button">取消</button><button id="smallConfirm" class="v169-rpg-dialog-button primary">確認</button></div>
</section>
<pre id="result"></pre>
<script>
(function(){
 const ids=["largeSample","largeTitle","tabIdle","tabActive","largeBody","backpackSample","mediumSample","mediumStats","mediumClose","rewardSample","rewardButton","smallSample","smallCancel","smallConfirm"];
 const rect=el=>{const r=el.getBoundingClientRect();return {left:r.left,top:r.top,width:r.width,height:r.height};};
 const style=el=>{const s=getComputedStyle(el);return {backgroundImage:s.backgroundImage,boxShadow:s.boxShadow,borderColor:s.borderColor,color:s.color};};
 const out={};
 ids.forEach(id=>{const el=document.getElementById(id);out[id]={rect:rect(el),style:style(el)};});
 document.getElementById("result").textContent=JSON.stringify(out);
})();
</script></body></html>`;
}

function run(file){
    const fileUrl="file://"+file.replace(/\\/g,"/");
    const result=cp.spawnSync(chrome,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--force-device-scale-factor=1","--window-size=420,746","--dump-dom",fileUrl],{encoding:"utf8",timeout:30000,maxBuffer:8*1024*1024});
    assert.equal(result.status,0,result.stderr||"Chrome window-skin fixture failed");
    const match=result.stdout.match(/<pre id="result">([\s\S]*?)<\/pre>/);
    assert.ok(match,"browser result missing");
    const decoded=match[1].replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"');
    return JSON.parse(decoded);
}

fs.writeFileSync(baselineCss,source.slice(0,markerIndex),"utf8");
fs.writeFileSync(baselineHtml,fixture(".ui-black-gold-baseline.css"),"utf8");
fs.writeFileSync(themedHtml,fixture("css/49-v169-rpg-ui.css"),"utf8");

try{
    const before=run(baselineHtml);
    const after=run(themedHtml);
    for(const id of Object.keys(before)){
        for(const key of ["left","top","width","height"]){
            assert.ok(Math.abs(after[id].rect[key]-before[id].rect[key])<0.25,`${id}.${key} changed after visual skin`);
        }
    }

    for(const id of ["largeSample","backpackSample","mediumSample","rewardSample","smallSample"]){
        assert.notEqual(after[id].style.boxShadow,before[id].style.boxShadow,`${id} thick game frame did not change`);
        assert.notEqual(after[id].style.backgroundImage,before[id].style.backgroundImage,`${id} black-gold panel background did not change`);
        assert.match(after[id].style.boxShadow,/115, 88, 45|240, 211, 138|198, 154, 69/,`${id} is missing bronze/gold layered frame`);
    }
    assert.notEqual(after.tabIdle.style.backgroundImage,after.tabActive.style.backgroundImage,"selected tab must be visually distinct");
    assert.notEqual(after.mediumClose.style.backgroundImage,before.mediumClose.style.backgroundImage,"medium popup button skin missing");
    assert.notEqual(after.smallConfirm.style.backgroundImage,before.smallConfirm.style.backgroundImage,"small confirmation button skin missing");

    console.log("Headless Chrome: large, tabbed, backpack/list, reward/medium and small confirm windows keep identical geometry with black-gold skin active");
}finally{
    for(const file of [baselineCss,baselineHtml,themedHtml]){
        try{fs.unlinkSync(file);}catch(_){ }
    }
}
