"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {spawnSync}=require("node:child_process");

function findChrome(){
    for(const name of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){
        const probe=spawnSync("bash",["-lc",`command -v ${name}`],{encoding:"utf8"});
        if(probe.status===0&&probe.stdout.trim()){ return probe.stdout.trim(); }
    }
    return "";
}

function decodeHtml(value){
    return value.replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">")
        .replace(/&quot;/g,'"').replace(/&#39;/g,"'");
}

function fixture(width,height){
    const cards=Array.from({length:20},(_,index)=>{
        const locked=index>=10?" locked":"";
        return `<button class="team-relic-card rarity-${index===19?"four-symbol":"purple"}${locked}"><span class="team-relic-card-art"><span class="team-relic-placeholder"><i>寶</i><b>${index+1}</b></span></span><span class="team-relic-card-name">測試秘寶 ${index+1}</span><span class="team-relic-card-meta">Lv.1・分類</span></button>`;
    }).join("");
    const tabs=["全部","攻擊","回復","防禦","增益","控制","元素聯動","特殊"]
        .map((label,index)=>`<button class="${index===0?"active":""}">${label}</button>`).join("");
    return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="css/00-main.css">
<link rel="stylesheet" href="css/31-v131-fix-batch.css">
<link rel="stylesheet" href="css/49-v169-rpg-ui.css">
<link rel="stylesheet" href="css/55-team-relic-system.css">
<!-- Historical high-specificity wide-modal owner intentionally loads last. -->
<link rel="stylesheet" href="css/22-stage-v78-character-inventory-core.css">
<style>
html,body{margin:0;width:${width}px;height:${height}px;overflow:hidden;background:#050505;}
#game-stage{position:relative!important;width:${width}px!important;height:${height}px!important;transform:none!important;overflow:hidden!important;}
#homeFeatureModal{display:flex!important;visibility:visible!important;opacity:1!important;pointer-events:auto!important;position:absolute!important;inset:0!important;}
.team-relic-home-tools{position:absolute;left:8px;right:8px;bottom:8px;display:flex;justify-content:space-between;}
.team-relic-home-tools .home-card{position:relative;width:82px;height:68px;}
.qa-player-row{position:absolute;left:8px;right:8px;bottom:92px;height:116px;}
</style></head><body><div id="game-stage">
  <div class="team-relic-home-tools"><button class="home-card home-card-utility team-relic-home-entry">秘寶</button><button class="home-card home-card-utility team-element-box-home-entry">元素匣</button></div>
  <div id="homeFeatureModal" class="home-feature-modal show no-padding team-relic-modal">
    <section class="home-feature-modal-box wide">
      <header class="home-feature-modal-title"><span id="homeFeatureModalTitle">秘 寶</span><button class="home-feature-close-btn">返回</button></header>
      <div id="homeFeatureModalBody"><main class="team-relic-page">
        <div class="team-relic-resource-line"><span>隊伍共用戰場神器</span><b>金幣 300</b></div>
        <div class="team-relic-current-card empty"><div class="team-relic-empty-slot">寶</div><div class="team-relic-current-copy"><small>目前隊伍秘寶</small><b>尚未裝備秘寶</b><p>每支隊伍只能啟用一件秘寶。</p></div><button class="team-relic-select-first">選擇秘寶</button></div>
        <nav class="team-relic-tabs">${tabs}</nav><div class="team-relic-grid">${cards}</div>
      </main></div>
    </section>
  </div>
  <div id="teamRelicBattleBanner" class="team-relic-battle-banner show"><span class="team-relic-battle-icon">寶</span><b>秘寶・青嵐羽符</b></div>
  <div class="qa-player-row"></div>
</div><pre id="result"></pre><script>
(function(){
  var q=function(selector){return document.querySelector(selector);};
  var rect=function(element){var r=element.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
  var overlap=function(a,b){return a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;};
  var stage=q("#game-stage"),box=q(".team-relic-modal .home-feature-modal-box"),body=q("#homeFeatureModalBody"),tabs=q(".team-relic-tabs"),grid=q(".team-relic-grid");
  var entries=Array.from(document.querySelectorAll(".team-relic-home-tools button")).map(rect);
  var cards=Array.from(document.querySelectorAll(".team-relic-card")).map(rect);
  var bodyStyle=getComputedStyle(body),tabStyle=getComputedStyle(tabs),gridStyle=getComputedStyle(grid);
  var bodyBefore=body.scrollTop;body.scrollTop=Math.max(0,body.scrollHeight-body.clientHeight);var bodyAfter=body.scrollTop;
  var tabsBefore=tabs.scrollLeft;tabs.scrollLeft=Math.max(0,tabs.scrollWidth-tabs.clientWidth);var tabsAfter=tabs.scrollLeft;
  var bannerRect=rect(q("#teamRelicBattleBanner")),playerRect=rect(q(".qa-player-row")),stageRect=rect(stage);
  q("#result").textContent=JSON.stringify({viewport:{width:innerWidth,height:innerHeight},stage:stageRect,box:rect(box),body:{overflowY:bodyStyle.overflowY,overflowX:bodyStyle.overflowX,touchAction:bodyStyle.touchAction,clientHeight:body.clientHeight,scrollHeight:body.scrollHeight,before:bodyBefore,after:bodyAfter},tabs:{overflowX:tabStyle.overflowX,touchAction:tabStyle.touchAction,clientWidth:tabs.clientWidth,scrollWidth:tabs.scrollWidth,before:tabsBefore,after:tabsAfter},grid:{columns:gridStyle.gridTemplateColumns,cards:cards},entries:entries,banner:{rect:bannerRect,playerRect:playerRect,overlapsPlayer:overlap(bannerRect,playerRect)}});
})();
</script></body></html>`;
}

function run(chrome,width,height){
    const file=path.join(process.cwd(),`.team-relic-browser-qa-${width}.html`);
    fs.writeFileSync(file,fixture(width,height),"utf8");
    try{
        const fileUrl="file://"+file.replace(/\\/g,"/");
        const result=spawnSync(chrome,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--force-device-scale-factor=1",`--window-size=${width},${height}`,"--dump-dom",fileUrl],{encoding:"utf8",timeout:30000,maxBuffer:12*1024*1024});
        assert.equal(result.status,0,result.stderr||`Team relic ${width}px browser fixture failed`);
        const match=result.stdout.match(/<pre id="result">([\s\S]*?)<\/pre>/);
        assert.ok(match,`Team relic ${width}px browser result missing`);
        return JSON.parse(decodeHtml(match[1]));
    }finally{
        try{fs.unlinkSync(file);}catch(_){ }
    }
}

function verify(data,width,height){
    const tolerance=1;
    assert.ok(Math.abs(data.stage.width-width)<=tolerance,`${width}px stage width changed`);
    assert.ok(Math.abs(data.stage.height-height)<=tolerance,`${width}px stage height changed`);
    assert.ok(data.box.left>=data.stage.left-tolerance&&data.box.right<=data.stage.right+tolerance,`${width}px relic modal escapes horizontally`);
    assert.ok(data.box.top>=data.stage.top-tolerance&&data.box.bottom<=data.stage.bottom+tolerance,`${width}px relic modal escapes vertically`);
    /* The modal owns 4px outer padding and an additional 8px safe inset, so
       a 16px total delta on each axis is the intended full-screen frame. */
    assert.ok(data.box.width>=width-20&&data.box.height>=height-20,
        `${width}px relic modal is not full-screen (${data.box.width}x${data.box.height})`);
    assert.match(data.body.overflowY,/auto|scroll/,`${width}px legacy wide-modal CSS retook scroll ownership`);
    assert.equal(data.body.overflowX,"hidden");assert.equal(data.body.touchAction,"pan-y");
    assert.ok(data.body.scrollHeight>data.body.clientHeight&&data.body.after>data.body.before,`${width}px relic body cannot actually scroll`);
    assert.equal(data.tabs.overflowX,"auto");assert.equal(data.tabs.touchAction,"pan-x");
    assert.ok(data.tabs.scrollWidth>data.tabs.clientWidth&&data.tabs.after>data.tabs.before,`${width}px category rail cannot actually scroll`);
    assert.equal(data.grid.cards.length,20);
    assert.equal(data.grid.columns.trim().split(/\s+/).length,2,`${width}px relic grid is not two columns`);
    assert.ok(Math.abs(data.grid.cards[0].top-data.grid.cards[1].top)<=tolerance&&data.grid.cards[2].top>data.grid.cards[0].top,`${width}px relic cards do not form two-column rows`);
    for(const card of data.grid.cards){assert.ok(card.left>=data.box.left-tolerance&&card.right<=data.box.right+tolerance,`${width}px relic card escapes modal`);}
    assert.equal(data.entries.length,2);assert.ok(data.entries[0].right<data.entries[1].left,`${width}px relic and element-box entries overlap`);
    assert.equal(data.banner.overlapsPlayer,false,`${width}px relic battle banner covers the player row`);
    assert.ok(data.banner.rect.left>=data.stage.left-tolerance&&data.banner.rect.right<=data.stage.right+tolerance,`${width}px relic battle banner escapes horizontally`);
}

const chrome=findChrome();
if(!chrome){
    if(process.env.CI){ throw new Error("CI must provide Chrome for team relic mobile browser QA"); }
    console.log("Team relic mobile browser QA skipped: Chrome not available");
}else{
    for(const [width,height] of [[390,844],[412,915]]){
        const data=run(chrome,width,height);
        try{ verify(data,width,height); }
        catch(error){ error.message+=` | metrics=${JSON.stringify(data)}`; throw error; }
    }
    console.log("✓ Team relic mobile browser QA passed at 390px and 412px");
}
