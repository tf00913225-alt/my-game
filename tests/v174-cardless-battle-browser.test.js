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
    throw new Error("Headless Chrome/Chromium is required for V174 battle presentation QA.");
}

const fixture=path.join(process.cwd(),".v174-cardless-battle-browser-qa.html");
const fileUrl="file://"+fixture.replace(/\\/g,"/");
const manifest=JSON.parse(fs.readFileSync(path.join(process.cwd(),"asset-manifest.json"),"utf8"));
const bundles=manifest.featureManifest&&manifest.featureManifest.bundles||{};
const stylePaths=[
    ...(manifest.critical&&manifest.critical.styles||[]),
    ...(bundles["app-shell"]&&bundles["app-shell"].styles||[]),
    ...(bundles["gameplay-core"]&&bundles["gameplay-core"].styles||[])
].filter(Boolean);
const runtimeSource=fs.readFileSync(path.join(process.cwd(),"js","54-v173.51-battle-qa.js"),"utf8")
    .replace(/<\/script/gi,"<\\/script");

function escapeAttribute(value){
    return String(value)
        .replace(/&/g,"&amp;")
        .replace(/"/g,"&quot;")
        .replace(/</g,"&lt;")
        .replace(/>/g,"&gt;");
}

function enemyCard(index){
    const hp=1380-index*5,sp=630-index*3;
    return `<div id="battleMonster${index}" class="battle-monster v154-abyss-portrait" style="--v152-abyss-portrait:url(&quot;data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='112'%3E%3Crect width='80' height='112' fill='%23654'%3E%3C/rect%3E%3C/svg%3E&quot;)">
      <div id="battleMonsterFreezeOverlay${index}" class="card-status-overlay freeze-overlay"></div>
      <img class="v162-abyss-battle-portrait-art" alt="" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='112'%3E%3Crect width='80' height='112' fill='%23654'/%3E%3C/svg%3E">
      <div class="battle-monster-icon"></div>
      <div class="battle-monster-name">天兵${index+1}</div>
      <div class="battle-monster-level">Lv.100</div>
      <div id="battleMonsterStatus${index}" class="monster-status-badges"></div>
      <div class="monster-hp"><div id="battleMonsterBar${index}" class="monster-hp-inner"></div><div id="battleMonsterHPText${index}" class="monster-bar-text">${hp}/2000</div></div>
      <div class="monster-sp"><div id="battleMonsterSPBar${index}" class="monster-sp-inner"></div><div id="battleMonsterSPText${index}" class="monster-bar-text">${sp}/800</div></div>
    </div>`;
}

function playerCard(index,hp,sp){
    return `<div id="battlePlayerCard${index}" class="battle-player" style="background-image:url(&quot;data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='116' height='144'%3E%3Crect width='116' height='144' fill='%23456'/%3E%3C/svg%3E&quot;)">
      <div class="battle-player-icon"></div>
      <div id="battlePlayerStatus${index}" class="monster-status-badges"></div>
      <div class="hp-bar"><div id="battlePlayerHPBar${index}" class="hp-bar-inner"></div><div id="battlePlayerShieldBar${index}" class="hp-bar-shield-overlay"></div><div class="hp-bar-text">${hp}/1000</div></div>
      <div class="sp-bar"><div id="battlePlayerSPBar${index}" class="sp-bar-inner"></div><div class="sp-bar-text">${sp}/600</div></div>
      <div class="battle-player-id">冒險者${index+1}</div>
    </div>`;
}

function innerHtml(){
    const links=stylePaths.map(href=>`<link rel="stylesheet" href="${href}">`).join("\n");
    return `<!doctype html>
<html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${links}
<style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#17120d}*{animation-duration:.5s}</style></head><body>
<div id="game-viewport"><div id="game-stage"><div id="app" class="in-battle"><div id="game-content" class="content">
<div id="battlePage" class="page active v154-abyss-battle"><div class="battle-wrap">
<div class="battle-title">戰鬥</div>
<div id="battleMonsterArea" class="battle-monsters v131-formation v141-fixed-formation">
  <div class="v131-monster-row v131-monster-row-1">${[0,1,2,3,4].map(enemyCard).join("")}</div>
  <div class="v131-monster-row v131-monster-row-2">${[5,6,7,8,9].map(enemyCard).join("")}</div>
</div>
<div class="battle-monster-gap-filler"></div>
<div class="battle-middle"><div class="turn-target-row" id="turnTargetRow"><span>第 3 回合　目標：天兵1</span><strong>9</strong></div>
<div id="battleActionRegion"><div id="battleCommandRow"><button>攻擊</button><button>技能</button><button>防禦</button><button>元素匣</button></div></div></div>
<div id="battlePlayerRow" class="battle-player-row">${playerCard(0,835,412)}${playerCard(1,798,468)}${playerCard(2,752,506)}</div>
<div id="battleInfo" class="battle-info">戰鬥紀錄</div>
</div></div></div></div></div></div>
<script>
var battleActive=true;
var monsters=Array.from({length:10},function(_,index){return {hp:1380-index*5,sp:630-index*3,maxHP:2000,maxSP:800};});
var qaParty=[{hp:835,sp:412},{hp:798,sp:468},{hp:752,sp:506}];
function getPartyCharacterByIndex(index){return qaParty[index]||null;}
function qaRect(selector){var r=document.querySelector(selector).getBoundingClientRect();return {left:r.left,top:r.top,width:r.width,height:r.height,right:r.right,bottom:r.bottom};}
function qaRects(){return {enemy0:qaRect('#battleMonster0'),enemy5:qaRect('#battleMonster5'),player0:qaRect('#battlePlayerCard0'),player2:qaRect('#battlePlayerCard2'),turn:qaRect('#turnTargetRow'),actions:qaRect('#battleActionRegion')};}
window.__qaBefore=qaRects();
</script>
<script>${runtimeSource}</script>
<script>
(function(){
  var player=document.getElementById('battlePlayerCard0');
  var art=player.querySelector(':scope > .v174-battle-art');
  player.classList.add('attacker-lunge-up');
  var lungeAnimation=getComputedStyle(art).animationName;
  player.classList.remove('attacker-lunge-up');
  var popup=document.createElement('div');popup.className='damage-popup hp-popup';popup.textContent='-120';player.appendChild(popup);
  setTimeout(function(){
    var after=qaRects();
    var enemy=document.getElementById('battleMonster0');
    var enemyArt=enemy.querySelector(':scope > .v174-battle-art');
    var overlay=document.getElementById('battleMonsterFreezeOverlay0');
    var result={
      rows:document.querySelectorAll('#battleMonsterArea > .v131-monster-row').length,
      enemies:document.querySelectorAll('#battleMonsterArea .battle-monster').length,
      players:document.querySelectorAll('#battlePlayerRow .battle-player').length,
      before:window.__qaBefore,after:after,
      playerBorder:getComputedStyle(player).borderTopWidth,
      enemyBorder:getComputedStyle(enemy).borderTopWidth,
      playerShadow:getComputedStyle(player).boxShadow,
      enemyShadow:getComputedStyle(enemy).boxShadow,
      playerArt:!!art,
      enemyArt:!!enemyArt,
      playerIdle:getComputedStyle(document.getElementById('battlePlayerCard1').querySelector(':scope > .v174-battle-art')).animationName,
      lungeAnimation:lungeAnimation,
      hitAnimation:getComputedStyle(art).animationName,
      footShadowContent:getComputedStyle(art,'::after').content,
      abyssOwnerOpacity:getComputedStyle(enemy.querySelector('.v162-abyss-battle-portrait-art')).opacity,
      overlayPosition:getComputedStyle(overlay).position,
      playerHp:player.querySelector('.hp-bar-text').textContent,
      playerSp:player.querySelector('.sp-bar-text').textContent,
      enemyHp:enemy.querySelector('.monster-hp .monster-bar-text').textContent,
      enemySp:enemy.querySelector('.monster-sp .monster-bar-text').textContent
    };
    parent.document.getElementById('result').textContent=JSON.stringify(result);
  },60);
})();
</script>
</body></html>`;
}

function outerHtml(width,height){
    return `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#111}iframe{display:block;border:0;width:${width}px;height:${height}px}#result{display:none}</style></head><body><iframe srcdoc="${escapeAttribute(innerHtml())}"></iframe><pre id="result"></pre></body></html>`;
}
function decode(text){return text.replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#39;/g,"'");}
function closeEnough(a,b,label){assert.ok(Math.abs(a-b)<0.2,`${label} moved: ${a} -> ${b}`);}
function assertRectStable(before,after,label){for(const key of ["left","top","width","height"]){closeEnough(before[key],after[key],`${label}.${key}`);}}

function runViewport(chrome,width,height){
    fs.writeFileSync(fixture,outerHtml(width,height),"utf8");
    const result=spawnSync(chrome,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--force-device-scale-factor=1","--window-size=1200,1100","--virtual-time-budget=1800","--dump-dom",fileUrl],{encoding:"utf8",timeout:30000,maxBuffer:20*1024*1024});
    assert.equal(result.status,0,result.stderr||`V174 browser fixture failed at ${width}x${height}`);
    const match=result.stdout.match(/<pre id="result">([\s\S]*?)<\/pre>/);
    assert.ok(match,`V174 browser result missing at ${width}x${height}`);
    const data=JSON.parse(decode(match[1]));
    assert.equal(data.rows,2);
    assert.equal(data.enemies,10);
    assert.equal(data.players,3);
    for(const key of ["enemy0","enemy5","player0","player2","turn","actions"]){assertRectStable(data.before[key],data.after[key],key);}
    assert.equal(data.playerBorder,"0px");
    assert.equal(data.enemyBorder,"0px");
    assert.equal(data.playerShadow,"none");
    assert.equal(data.enemyShadow,"none");
    assert.equal(data.playerArt,true);
    assert.equal(data.enemyArt,true);
    assert.equal(data.playerIdle,"v174BattleIdle");
    assert.equal(data.lungeAnimation,"v174BattleLungeUp");
    assert.equal(data.hitAnimation,"v174BattleHitShake");
    assert.notEqual(data.footShadowContent,"none");
    assert.equal(data.abyssOwnerOpacity,"0");
    assert.equal(data.overlayPosition,"absolute");
    assert.equal(data.playerHp,"835");
    assert.equal(data.playerSp,"412");
    assert.equal(data.enemyHp,"1380");
    assert.equal(data.enemySp,"630");
    console.log(`V174 cardless battle browser QA ${width}x${height}:`,JSON.stringify(data));
}

try{
    const chrome=findChrome();
    [[360,800],[412,915]].forEach(([width,height])=>runViewport(chrome,width,height));
    console.log("V174 cardless battle mobile browser QA passed.");
}finally{
    try{fs.unlinkSync(fixture);}catch(_){ }
}
