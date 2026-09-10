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
const html=`<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="css/00-main.css">
<link rel="stylesheet" href="css/09-stage-v15-native-character-shell.css">
<link rel="stylesheet" href="css/31-v131-fix-batch.css">
<link rel="stylesheet" href="css/38-v141-system-expansion.css">
<link rel="stylesheet" href="css/40-v143-combat-dungeon-polish.css">
<link rel="stylesheet" href="css/45-v152-dev-fixes.css">
<link rel="stylesheet" href="css/46-v154-dev-fixes.css">
<link rel="stylesheet" href="css/gameplay-boss-tower.css">
<style>
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#050403;}
body{position:relative;}
#qaViewport{position:absolute;inset:0;overflow:hidden;}
#result{display:none;}
#game-stage{position:absolute!important;left:50%!important;top:50%!important;width:420px!important;height:746.6667px!important;min-width:420px!important;min-height:746.6667px!important;transform:translate(-50%,-50%) scale(var(--qa-scale))!important;transform-origin:center center!important;}
#game-stage>#app{position:relative!important;width:420px!important;height:746.6667px!important;min-width:420px!important;min-height:746.6667px!important;transform:none!important;}
#game-stage>#app>#game-content{position:relative!important;width:420px!important;height:746.6667px!important;min-height:746.6667px!important;padding-bottom:0!important;overflow:hidden!important;}
#game-stage #battlePage{display:block!important;position:relative!important;width:420px!important;height:746.6667px!important;min-height:0!important;padding:4px 6px!important;overflow:hidden!important;box-sizing:border-box!important;}
#game-stage #battlePage>.battle-wrap{height:100%!important;min-height:0!important;}
#battleActionRegion{position:relative;display:flex;min-height:66px;flex-direction:column;gap:4px;}
#battleCommandRow{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px;min-height:62px;}
#battleCommandRow button{min-width:0;min-height:52px;}
#battleInfo{display:block;}
#bossMechanismSlot .boss-mechanism-card{animation:none!important;}
</style>
</head>
<body>
<div id="qaViewport">
<div id="game-stage">
<div id="app"><div id="game-content"><section id="battlePage" class="active">
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
  <div class="battle-player" data-element="fire"></div><div class="battle-player" data-element="water"></div><div class="battle-player" data-element="wind"></div>
</div>
<div id="battleInfo" class="battle-info">戰鬥紀錄<br>BOSS 展開機制卡【金剛護體】<br>玩家造成 12688 傷害</div>
</div>
</section></div></div>
</div>
</div>
<pre id="result"></pre>
<script>
(function(){
  var legacyWidth=420,legacyHeight=746.6667;
  var scale=Math.min(innerWidth/legacyWidth,innerHeight/legacyHeight);
  document.documentElement.style.setProperty("--qa-scale",String(scale));
  function rect(selector){
    var node=document.querySelector(selector),r=node.getBoundingClientRect();
    return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};
  }
  requestAnimationFrame(function(){requestAnimationFrame(function(){
    var boss=document.querySelector(".gameplay-boss-card"),mech=document.querySelector(".boss-mechanism-card");
    var slot=document.getElementById("bossMechanismSlot"),area=document.getElementById("battleMonsterArea");
    var bossRect=rect(".gameplay-boss-card"),mechRect=rect(".boss-mechanism-card");
    var slotRect=rect("#bossMechanismSlot"),areaRect=rect("#battleMonsterArea");
    var playerRect=rect("#battlePlayerRow"),logRect=rect("#battleInfo"),pageRect=rect("#battlePage");
    var name=document.querySelector(".gameplay-boss-card .battle-monster-name");
    var hp=document.querySelector(".gameplay-boss-card .monster-hp"),sp=document.querySelector(".gameplay-boss-card .monster-sp");
    var bossStyle=getComputedStyle(boss),mechStyle=getComputedStyle(mech),slotStyle=getComputedStyle(slot),areaStyle=getComputedStyle(area);
    document.getElementById("result").textContent=JSON.stringify({
      viewport:{width:innerWidth,height:innerHeight},scale:scale,
      boss:bossRect,mechanism:mechRect,slot:slotRect,area:areaRect,player:playerRect,log:logRect,page:pageRect,
      bossWidthShare:bossRect.width/innerWidth,mechanismWidthShare:mechRect.width/innerWidth,
      bossRatio:bossRect.height/bossRect.width,mechanismRatio:mechRect.height/mechRect.width,
      bossComputed:{width:bossStyle.width,height:bossStyle.height,minWidth:bossStyle.minWidth,maxWidth:bossStyle.maxWidth,flexBasis:bossStyle.flexBasis,aspectRatio:bossStyle.aspectRatio,boxSizing:bossStyle.boxSizing},
      mechanismComputed:{width:mechStyle.width,height:mechStyle.height,minWidth:mechStyle.minWidth,maxWidth:mechStyle.maxWidth,flexBasis:mechStyle.flexBasis,aspectRatio:mechStyle.aspectRatio,boxSizing:mechStyle.boxSizing,display:mechStyle.display},
      slotComputed:{width:slotStyle.width,display:slotStyle.display,flexDirection:slotStyle.flexDirection},
      areaComputed:{width:areaStyle.width,display:areaStyle.display,flexDirection:areaStyle.flexDirection,flexWrap:areaStyle.flexWrap},
      mechanismCount:document.querySelectorAll(".boss-mechanism-card").length,
      textOverflow:name.scrollWidth>name.clientWidth+1,
      hpOverflow:hp.scrollWidth>hp.clientWidth+1,
      spOverflow:sp.scrollWidth>sp.clientWidth+1,
      pageHorizontalOverflow:document.getElementById("battlePage").scrollWidth>document.getElementById("battlePage").clientWidth+1,
      documentHorizontalOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,
      bossBeforeMechanism:mechRect.top>=bossRect.bottom+scale*4,
      mechanismBeforePlayer:mechRect.bottom<=playerRect.top+1,
      playerBeforeLog:playerRect.bottom<=logRect.top+1,
      visibleLog:logRect.height>1&&logRect.top<innerHeight&&logRect.bottom>0,
      visiblePlayer:playerRect.height>1&&playerRect.top<innerHeight&&playerRect.bottom>0
    });
  });});
})();
</script>
</body></html>`;

function decode(text){
    return text.replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">")
        .replace(/&quot;/g,'"').replace(/&#39;/g,"'");
}

function runViewport(chrome,width,height){
    const result=spawnSync(chrome,[
        "--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage",
        "--allow-file-access-from-files","--force-device-scale-factor=1",`--window-size=${width},${height}`,
        "--dump-dom",fileUrl
    ],{encoding:"utf8",timeout:30000,maxBuffer:16*1024*1024});
    assert.equal(result.status,0,result.stderr||`Boss mobile browser fixture failed at ${width}x${height}`);
    const match=result.stdout.match(/<pre id="result">([\s\S]*?)<\/pre>/);
    assert.ok(match,`Boss mobile browser result missing at ${width}x${height}`);
    const data=JSON.parse(decode(match[1]));
    console.log(`Boss portrait browser geometry ${width}x${height}:`,JSON.stringify(data));
    const ratio=16/9;
    assert.ok(data.bossWidthShare>=.38&&data.bossWidthShare<=.46,`Boss width share ${data.bossWidthShare} is outside 38%-46% at ${width}x${height}`);
    assert.ok(data.mechanismWidthShare>=.20&&data.mechanismWidthShare<=.26,`Mechanism width share ${data.mechanismWidthShare} is outside 20%-26% at ${width}x${height}`);
    assert.ok(Math.abs(data.bossRatio-ratio)<.025,`Boss is not 9:16 at ${width}x${height}: ${data.bossRatio}`);
    assert.ok(Math.abs(data.mechanismRatio-ratio)<.025,`Mechanism card is not 9:16 at ${width}x${height}: ${data.mechanismRatio}`);
    assert.equal(data.bossComputed.aspectRatio,"9 / 16");
    assert.equal(data.mechanismComputed.aspectRatio,"9 / 16");
    assert.equal(data.textOverflow,false,`Boss name overflows at ${width}x${height}`);
    assert.equal(data.hpOverflow,false,`Boss HP bar overflows at ${width}x${height}`);
    assert.equal(data.spOverflow,false,`Boss SP bar overflows at ${width}x${height}`);
    assert.equal(data.pageHorizontalOverflow,false,`Battle page overflows horizontally at ${width}x${height}`);
    assert.equal(data.documentHorizontalOverflow,false,`Document overflows horizontally at ${width}x${height}`);
    assert.equal(data.bossBeforeMechanism,true,`Mechanism card is not below the Boss at ${width}x${height}`);
    assert.equal(data.mechanismBeforePlayer,true,`Mechanism card overlaps the player row at ${width}x${height}`);
    assert.equal(data.playerBeforeLog,true,`Player row overlaps battle log at ${width}x${height}`);
    assert.equal(data.visiblePlayer,true,`Player row is not visible at ${width}x${height}`);
    assert.equal(data.visibleLog,true,`Battle log is not visible at ${width}x${height}`);
    return data;
}

fs.writeFileSync(fixture,html,"utf8");
try{
    const chrome=findChrome();
    const results=[[360,800],[393,873],[412,915]].map(([width,height])=>runViewport(chrome,width,height));
    console.log("Boss portrait mobile browser QA passed:",JSON.stringify(results.map(data=>({
        viewport:data.viewport,
        bossPx:[Number(data.boss.width.toFixed(2)),Number(data.boss.height.toFixed(2))],
        bossShare:Number((data.bossWidthShare*100).toFixed(2)),
        mechanismPx:[Number(data.mechanism.width.toFixed(2)),Number(data.mechanism.height.toFixed(2))],
        mechanismShare:Number((data.mechanismWidthShare*100).toFixed(2)),
        logVisible:data.visibleLog,
        playerVisible:data.visiblePlayer
    }))));
}finally{
    try{fs.unlinkSync(fixture);}catch(_){ }
}
