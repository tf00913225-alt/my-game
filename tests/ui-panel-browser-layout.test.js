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
    console.log("UI panel browser layout check skipped: Chrome not available");
    process.exit(0);
}

const root=process.cwd();
const fixture=path.join(root,".ui-panel-layout-smoke.html");
const fileUrl="file://"+fixture.replace(/\\/g,"/");

const html=`<!doctype html>
<html><head><meta charset="utf-8">
<link rel="stylesheet" href="css/00-main.css">
<link rel="stylesheet" href="css/31-v131-fix-batch.css">
<link rel="stylesheet" href="css/38-v141-system-expansion.css">
<link rel="stylesheet" href="css/44-v149-skill-ui-rules.css">
<link rel="stylesheet" href="css/49-v169-rpg-ui.css">
<style>
html,body{margin:0;width:1080px;height:1920px;overflow:hidden;background:#000;}
#game-stage{position:relative!important;width:1080px!important;height:1920px!important;overflow:hidden!important;}
#app,#game-content{position:relative!important;width:420px!important;height:746.6667px!important;transform:none!important;}
#homeFeatureModal{display:flex!important;position:absolute!important;inset:0!important;width:420px!important;height:746.6667px!important;}
</style></head><body>
<div id="game-stage"><div id="app"><div id="game-content">
<div id="homeFeatureModal" class="home-feature-modal show v131-shop-open">
  <div class="home-feature-modal-box">
    <div class="home-feature-modal-title">
      <span id="homeFeatureModalTitle">商店</span>
      <div><button class="home-feature-close-btn">返回</button></div>
    </div>
    <div id="homeFeatureModalBody">
      <div class="v17345-shop-shell">
        <div class="v17345-shop-tabs"><button class="active">補品</button><button>裝備</button></div>
        <div id="tabContent" class="shop-potion-interface"></div>
      </div>
    </div>
  </div>
</div>
</div></div></div>
<pre id="result"></pre>
<script>
(function(){
  const box=document.querySelector('.home-feature-modal-box');
  const header=document.querySelector('.home-feature-modal-title');
  const close=document.querySelector('.home-feature-close-btn');
  const tabs=document.querySelector('.v17345-shop-tabs');
  const body=document.getElementById('homeFeatureModalBody');
  const content=document.getElementById('tabContent');
  const modal=document.getElementById('homeFeatureModal');
  const snapshots=[];
  function rect(el){
    const r=el.getBoundingClientRect();
    return {left:r.left,top:r.top,width:r.width,height:r.height,right:r.right,bottom:r.bottom};
  }
  function equipmentCard(index){
    const reforge=index%2===0?'<span class="v17346-reforge-mini">[可冶煉]</span>':'';
    return '<article class="v17345-equipment-card v17346-shop-card is-affordable">'+
      '<div class="v17345-equipment-icon v17346-gear-art">裝</div>'+
      '<b class="v17346-shop-name">測試裝備'+index+'</b>'+
      '<span class="v17346-shop-slot">衣服</span>'+
      '<span class="v17346-stat">敏捷 +9</span>'+reforge+
      '<button class="v17346-shop-buy">4,000 金幣</button></article>';
  }
  function potionCard(index){
    return '<div class="shop-potion-card '+(index%2?'sp':'hp')+'">'+
      '<div class="shop-potion-card-head"><span class="shop-potion-type">'+(index%2?'SP':'HP')+'</span><span class="shop-potion-stock">持有 0</span></div>'+
      '<div class="shop-potion-name">測試補品'+index+'</div>'+
      '<div class="shop-potion-effect">回復最大'+(index%2?'SP':'HP')+'的 30%</div>'+
      '<div class="shop-potion-purchase-row"><label>數量</label><input class="shop-potion-quantity" value="1"><span class="v146-shop-total">1,500 金幣</span><button class="shop-potion-buy">購買</button></div></div>';
  }
  const pages=['equipment','potion','equipment','potion','equipment'];
  pages.forEach(function(page){
    if(page==='equipment'){
      content.className='v17345-equipment-shop';
      content.innerHTML='<div class="v17345-equipment-wallet"><span>裝備商店</span><b>999 金幣</b></div><div class="v17345-equipment-grid">'+Array.from({length:6},(_,i)=>equipmentCard(i)).join('')+'</div><div class="v17345-equipment-refresh"><div><b>今日刷新 4 / 10</b><span>前5次免費；第6～10次尚未開放。</span></div><button>免費刷新（剩1次）</button></div>';
    }else{
      content.className='shop-potion-interface';
      content.innerHTML='<div class="shop-potion-note">只販售 HP／SP 回復藥水</div><div class="v133-shop-tier-note">目前商店階級：初階</div><div class="shop-potion-list">'+Array.from({length:6},(_,i)=>potionCard(i)).join('')+'</div>';
    }
    void box.offsetHeight;
    const equipmentCards=Array.from(content.querySelectorAll('.v17346-shop-card'));
    const buyButtons=Array.from(content.querySelectorAll('.v17346-shop-buy'));
    snapshots.push({
      page:page,box:rect(box),header:rect(header),close:rect(close),tabs:rect(tabs),body:rect(body),modal:rect(modal),content:rect(content),
      scrollHeight:body.scrollHeight,clientHeight:body.clientHeight,contentScrollHeight:content.scrollHeight,contentClientHeight:content.clientHeight,
      cardRects:equipmentCards.map(rect),buyRects:buyButtons.map(rect)
    });
  });
  document.getElementById('result').textContent=JSON.stringify(snapshots);
})();
</script></body></html>`;

fs.writeFileSync(fixture,html,"utf8");
try{
    const run=cp.spawnSync(chrome,[
        "--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage",
        "--allow-file-access-from-files","--force-device-scale-factor=1","--window-size=1080,1920",
        "--dump-dom",fileUrl
    ],{encoding:"utf8",timeout:30000,maxBuffer:8*1024*1024});
    assert.equal(run.status,0,run.stderr||"Chrome layout fixture failed");
    const match=run.stdout.match(/<pre id="result">([\s\S]*?)<\/pre>/);
    assert.ok(match,"browser layout result missing");
    const snapshots=JSON.parse(match[1].replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"'));
    assert.equal(snapshots.length,5);

    const baseline=snapshots[0];
    const stableKeys=["left","top","width","height"];
    for(const shot of snapshots.slice(1)){
        for(const part of ["box","header","close","tabs","body"]){
            for(const key of stableKeys){
                assert.ok(Math.abs(shot[part][key]-baseline[part][key])<0.25,`${part}.${key} moved on ${shot.page}`);
            }
        }
    }

    snapshots.forEach(shot=>{
        assert.ok(shot.box.top>=shot.modal.top-0.25,"panel escaped top edge");
        assert.ok(shot.box.bottom<=shot.modal.bottom+0.25,"panel escaped bottom edge");
        assert.ok(shot.scrollHeight<=shot.clientHeight+1,`${shot.page} made the shop body scroll`);
        assert.ok(shot.contentScrollHeight<=shot.contentClientHeight+1,`${shot.page} made the tab content scroll`);
    });

    snapshots.filter(shot=>shot.page==='equipment').forEach(shot=>{
        assert.equal(shot.cardRects.length,6,"equipment shop must show six cards on one screen");
        assert.equal(shot.buyRects.length,6,"each equipment card needs one aligned buy button");
        const cardHeight=shot.cardRects[0].height;
        const buttonWidth=shot.buyRects[0].width;
        const buttonHeight=shot.buyRects[0].height;
        shot.cardRects.forEach(card=>assert.ok(Math.abs(card.height-cardHeight)<0.25,"equipment card heights are inconsistent"));
        shot.buyRects.forEach(button=>{
            assert.ok(Math.abs(button.width-buttonWidth)<0.25,"equipment buy button widths are inconsistent");
            assert.ok(Math.abs(button.height-buttonHeight)<0.25,"equipment buy button heights are inconsistent");
        });
    });

    console.log("Headless Chrome: shop stayed fixed, non-scrollable and aligned across 5 tab switches");
}finally{
    try{ fs.unlinkSync(fixture); }catch(_){ }
}
