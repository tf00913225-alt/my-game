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
    throw new Error("Headless Chrome/Chromium is required for Boss portrait browser QA.");
}

const fixture=path.join(process.cwd(),".boss-mobile-portrait-browser-qa.html");
const fileUrl="file://"+fixture.replace(/\\/g,"/");
const manifest=JSON.parse(fs.readFileSync(path.join(process.cwd(),"asset-manifest.json"),"utf8"));
const bundles=manifest.featureManifest&&manifest.featureManifest.bundles||{};
const stylePaths=[
    ...(manifest.critical&&manifest.critical.styles||[]),
    ...(bundles["app-shell"]&&bundles["app-shell"].styles||[]),
    ...(bundles["gameplay-core"]&&bundles["gameplay-core"].styles||[]),
    ...(bundles["feature-boss-relic"]&&bundles["feature-boss-relic"].styles||[])
].filter(Boolean);

function escapeAttribute(value){
    return String(value)
        .replace(/&/g,"&amp;")
        .replace(/"/g,"&quot;")
        .replace(/</g,"&lt;")
        .replace(/>/g,"&gt;");
}

function innerHtml(){
    const links=stylePaths.map(href=>`<link rel="stylesheet" href="${href}">`).join("\n");
    return `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
${links}
<style>
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#050403;}
#bossMechanismSlot .boss-mechanism-card{animation:none!important;}
</style>
</head>
<body>
<div id="game-viewport">
<div id="game-stage">
<div id="app" class="in-battle">
<div id="game-content" class="content">
<div id="battlePage" class="page active">
<div class="battle-wrap">
<div class="battle-title">戰鬥</div>
<div id="battleMonsterArea" class="battle-monsters v131-formation gameplay-boss-active">
  <div class="v131-monster-row">
    <div id="battleMonster0" class="battle-monster gameplay-boss-card" data-rank="boss" data-element="fire">
      <div class="battle-monster-icon"><span aria-hidden="true">炎</span></div>
      <div class="battle-monster-name">熾焰狼王・Lv.100</div>
      <div class="monster-status-badges"><span class="monster-status-badge burn">燃</span></div>
      <div class="monster-hp"><div class="monster-hp-inner" style="width:100%"></div><div class="monster-bar-text">HP 128000 / 128000</div></div>
      <div class="monster-sp"><div class="monster-sp-inner" style="width:82%"></div><div class="monster-bar-text">SP 82 / 100</div></div>
      <div class="damage-popup" style="opacity:1">-12688</div>
    </div>
  </div>
  <div id="bossMechanismSlot" class="boss-mechanism-slot active" aria-label="BOSS 機制卡槽">
    <button type="button" class="boss-mechanism-card" data-type="shield">
      <b class="boss-mechanism-name">金剛護體</b>
      <span class="boss-mechanism-kind">護盾</span>
      <span class="boss-mechanism-hp">HP 692 / 692</span>
    </button>
  </div>
</div>
<div class="battle-monster-gap-filler"></div>
<div class="battle-middle">
  <div class="turn-target-row"><span class="turn-number">第 3 回合</span><span class="timer">15</span></div>
  <div id="battleActionRegion"><div id="battleCommandRow"><button>攻擊</button><button>技能</button><button>防禦</button><button>元素匣</button></div></div>
</div>
<div id="battlePlayerRow" class="battle-player-row">
  <div class="battle-player" data-element="fire"></div>
  <div class="battle-player" data-element="water"></div>
  <div class="battle-player" data-element="wind"></div>
</div>
<div id="battleInfo" class="battle-info">戰鬥紀錄<br>BOSS 展開機制卡【金剛護體】<br>玩家造成 12688 傷害</div>
</div>
</div>
</div>
</div>
</div>
</div>
<script>
(function(){
  var stage=document.getElementById("game-stage");
  var stageScale=Math.min(innerWidth/1080,innerHeight/1920);
  stage.style.setProperty("transform","translate(-50%,-50%) scale("+stageScale+")","important");
  stage.style.setProperty("transform-origin","center center","important");

  function rect(selector){
    var node=document.querySelector(selector),r=node.getBoundingClientRect();
    return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};
  }
  function contained(outer,inner,tolerance){
    var t=tolerance||1;
    return inner.left>=outer.left-t&&inner.right<=outer.right+t&&inner.top>=outer.top-t&&inner.bottom<=outer.bottom+t;
  }

  var boss=document.querySelector(".gameplay-boss-card");
  var mech=document.querySelector(".boss-mechanism-card");
  var area=document.getElementById("battleMonsterArea");
  var page=document.getElementById("battlePage");
  var wrap=page.querySelector(".battle-wrap");
  var bossRect=rect(".gameplay-boss-card");
  var mechRect=rect(".boss-mechanism-card");
  var areaRect=rect("#battleMonsterArea");
  var actionRect=rect("#battleActionRegion");
  var playerRect=rect("#battlePlayerRow");
  var logRect=rect("#battleInfo");
  var pageRect=rect("#battlePage");
  var stageRect=rect("#game-stage");
  var bossStyle=getComputedStyle(boss),mechStyle=getComputedStyle(mech),areaStyle=getComputedStyle(area);
  var name=document.querySelector(".gameplay-boss-card .battle-monster-name");
  var hp=document.querySelector(".gameplay-boss-card .monster-hp");
  var sp=document.querySelector(".gameplay-boss-card .monster-sp");

  parent.document.getElementById("result").textContent=JSON.stringify({
    viewport:{width:innerWidth,height:innerHeight},
    stageScale:stageScale,stage:stageRect,page:pageRect,area:areaRect,boss:bossRect,mechanism:mechRect,action:actionRect,player:playerRect,log:logRect,
    bossBattleWidthShare:bossRect.width/areaRect.width,
    mechanismBattleWidthShare:mechRect.width/areaRect.width,
    bossViewportWidthShare:bossRect.width/innerWidth,
    mechanismViewportWidthShare:mechRect.width/innerWidth,
    bossRatio:bossRect.height/bossRect.width,
    mechanismRatio:mechRect.height/mechRect.width,
    bossComputed:{width:bossStyle.width,height:bossStyle.height,aspectRatio:bossStyle.aspectRatio,maxWidth:bossStyle.maxWidth,flexBasis:bossStyle.flexBasis},
    mechanismComputed:{width:mechStyle.width,height:mechStyle.height,aspectRatio:mechStyle.aspectRatio,minWidth:mechStyle.minWidth,flexBasis:mechStyle.flexBasis},
    areaComputed:{width:areaStyle.width,height:areaStyle.height},
    textOverflow:name.scrollWidth>name.clientWidth+1,
    hpOverflow:hp.scrollWidth>hp.clientWidth+1,
    spOverflow:sp.scrollWidth>sp.clientWidth+1,
    mechanismOverflow:mech.scrollWidth>mech.clientWidth+1||mech.scrollHeight>mech.clientHeight+1,
    pageHorizontalOverflow:page.scrollWidth>page.clientWidth+1,
    wrapHorizontalOverflow:wrap.scrollWidth>wrap.clientWidth+1,
    pageVerticalOverflow:page.scrollHeight>page.clientHeight+1,
    wrapVerticalOverflow:wrap.scrollHeight>wrap.clientHeight+1,
    bossBeforeMechanism:mechRect.top>=bossRect.bottom+stageScale*2.571428571428571*4,
    mechanismBeforeAction:mechRect.bottom<=actionRect.top+1,
    mechanismBeforePlayer:mechRect.bottom<=playerRect.top+1,
    playerBeforeLog:playerRect.bottom<=logRect.top+1,
    stageContainsBoss:contained(stageRect,bossRect,1),
    stageContainsMechanism:contained(stageRect,mechRect,1),
    stageContainsPlayer:contained(stageRect,playerRect,1),
    stageContainsLog:contained(stageRect,logRect,1),
    visiblePlayer:playerRect.height>1&&playerRect.top<innerHeight&&playerRect.bottom>0,
    visibleLog:logRect.height>1&&logRect.top<innerHeight&&logRect.bottom>0
  });
})();
</script>
</body></html>`;
}

function outerHtml(width,height){
    return `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#111;}iframe{display:block;border:0;width:${width}px;height:${height}px;}#result{display:none;}</style></head><body><iframe srcdoc="${escapeAttribute(innerHtml())}"></iframe><pre id="result"></pre></body></html>`;
}

function decode(text){
    return text.replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">")
        .replace(/&quot;/g,'"').replace(/&#39;/g,"'");
}

function runViewport(chrome,width,height){
    fs.writeFileSync(fixture,outerHtml(width,height),"utf8");
    const result=spawnSync(chrome,[
        "--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage",
        "--allow-file-access-from-files","--force-device-scale-factor=1","--window-size=1200,1100",
        "--dump-dom",fileUrl
    ],{encoding:"utf8",timeout:30000,maxBuffer:20*1024*1024});
    assert.equal(result.status,0,result.stderr||`Boss mobile browser fixture failed at ${width}x${height}`);
    const match=result.stdout.match(/<pre id="result">([\s\S]*?)<\/pre>/);
    assert.ok(match,`Boss mobile browser result missing at ${width}x${height}`);
    const data=JSON.parse(decode(match[1]));
    console.log(`Boss portrait browser geometry ${width}x${height}:`,JSON.stringify(data));

    const ratio=16/9;
    assert.equal(data.viewport.width,width,`Iframe viewport width drifted at ${width}x${height}`);
    assert.equal(data.viewport.height,height,`Iframe viewport height drifted at ${width}x${height}`);
    assert.ok(data.bossBattleWidthShare>=.38&&data.bossBattleWidthShare<=.46,`Boss battle width share ${data.bossBattleWidthShare} is outside 38%-46% at ${width}x${height}`);
    assert.ok(data.mechanismBattleWidthShare>=.20&&data.mechanismBattleWidthShare<=.26,`Mechanism battle width share ${data.mechanismBattleWidthShare} is outside 20%-26% at ${width}x${height}`);
    assert.ok(data.bossViewportWidthShare>=.38&&data.bossViewportWidthShare<=.46,`Boss viewport width share ${data.bossViewportWidthShare} is outside 38%-46% at ${width}x${height}`);
    assert.ok(data.mechanismViewportWidthShare>=.20&&data.mechanismViewportWidthShare<=.26,`Mechanism viewport width share ${data.mechanismViewportWidthShare} is outside 20%-26% at ${width}x${height}`);
    assert.ok(Math.abs(data.bossRatio-ratio)<.025,`Boss is not 9:16 at ${width}x${height}: ${data.bossRatio}`);
    assert.ok(Math.abs(data.mechanismRatio-ratio)<.025,`Mechanism card is not 9:16 at ${width}x${height}: ${data.mechanismRatio}`);
    assert.equal(data.bossComputed.aspectRatio,"9 / 16");
    assert.equal(data.mechanismComputed.aspectRatio,"9 / 16");
    assert.equal(data.textOverflow,false,`Boss name overflows at ${width}x${height}`);
    assert.equal(data.hpOverflow,false,`Boss HP bar overflows at ${width}x${height}`);
    assert.equal(data.spOverflow,false,`Boss SP bar overflows at ${width}x${height}`);
    assert.equal(data.mechanismOverflow,false,`Mechanism content overflows its 9:16 card at ${width}x${height}`);
    assert.equal(data.pageHorizontalOverflow,false,`Battle page overflows horizontally at ${width}x${height}`);
    assert.equal(data.wrapHorizontalOverflow,false,`Battle wrap overflows horizontally at ${width}x${height}`);
    assert.equal(data.bossBeforeMechanism,true,`Mechanism card is not below the Boss at ${width}x${height}`);
    assert.equal(data.mechanismBeforeAction,true,`Mechanism card overlaps battle actions at ${width}x${height}`);
    assert.equal(data.mechanismBeforePlayer,true,`Mechanism card overlaps the player row at ${width}x${height}`);
    assert.equal(data.playerBeforeLog,true,`Player row overlaps battle log at ${width}x${height}`);
    assert.equal(data.stageContainsBoss,true,`Boss card escapes the game stage at ${width}x${height}`);
    assert.equal(data.stageContainsMechanism,true,`Mechanism card escapes the game stage at ${width}x${height}`);
    assert.equal(data.stageContainsPlayer,true,`Player row escapes the game stage at ${width}x${height}`);
    assert.equal(data.stageContainsLog,true,`Battle log escapes the game stage at ${width}x${height}`);
    assert.equal(data.pageVerticalOverflow,false,`Battle page vertically overflows at ${width}x${height}`);
    assert.equal(data.wrapVerticalOverflow,false,`Battle wrap vertically overflows at ${width}x${height}`);
    assert.equal(data.visiblePlayer,true,`Player row is not visible at ${width}x${height}`);
    assert.equal(data.visibleLog,true,`Battle log is not visible at ${width}x${height}`);
    return data;
}

try{
    const chrome=findChrome();
    const results=[[360,800],[393,873],[412,915]].map(([width,height])=>runViewport(chrome,width,height));
    console.log("Boss portrait mobile browser QA passed:",JSON.stringify(results.map(data=>({
        viewport:data.viewport,
        bossPx:[Number(data.boss.width.toFixed(2)),Number(data.boss.height.toFixed(2))],
        bossBattleShare:Number((data.bossBattleWidthShare*100).toFixed(2)),
        mechanismPx:[Number(data.mechanism.width.toFixed(2)),Number(data.mechanism.height.toFixed(2))],
        mechanismBattleShare:Number((data.mechanismBattleWidthShare*100).toFixed(2)),
        logVisible:data.visibleLog,
        playerVisible:data.visiblePlayer
    }))));
}finally{
    try{fs.unlinkSync(fixture);}catch(_){ }
}
