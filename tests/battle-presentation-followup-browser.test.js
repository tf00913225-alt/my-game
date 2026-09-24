"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {spawnSync}=require("node:child_process");

function chromePath(){
    for(const name of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){
        const found=spawnSync("bash",["-lc",`command -v ${name}`],{encoding:"utf8"});
        if(found.status===0&&found.stdout.trim()){ return found.stdout.trim(); }
    }
    throw new Error("Chrome/Chromium is required for battle presentation browser QA.");
}
function escapeAttribute(value){
    return String(value).replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}
function decode(value){
    return value.replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#39;/g,"'");
}

const manifest=JSON.parse(fs.readFileSync("asset-manifest.json","utf8"));
const bundles=manifest.featureManifest.bundles;
const styles=[
    ...(manifest.critical.styles||[]),
    ...(bundles["app-shell"].styles||[]),
    ...(bundles["gameplay-core"].styles||[]),
    ...(bundles["feature-boss-relic"].styles||[])
];
const art="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='90' height='150'%3E%3Cpath fill='%23d9b66f' d='M45 0 80 150H10z'/%3E%3C/svg%3E";
function hud(name,hp,sp){
    return `<div class="v174-battle-art" style="background-image:url(&quot;${art}&quot;)"></div><div class="monster-status-badges"></div><div class="monster-hp"><div class="monster-hp-inner"></div><div class="monster-bar-text">${hp}</div></div><div class="monster-sp"><div class="monster-sp-inner"></div><div class="monster-bar-text">${sp}</div></div><div class="battle-monster-name v143-monster-identity">${name}</div><div class="battle-monster-level">Lv.40</div>`;
}
const links=styles.map(href=>`<link rel="stylesheet" href="${href}">`).join("");
const inner=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${links}<style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#17120d}*{animation:none!important}</style></head><body><div id="game-viewport"><div id="game-stage"><div id="app" class="in-battle"><div id="game-content" class="content"><div id="battlePage" class="page active v-fixed-slot-render-v2"><div class="battle-wrap"><section class="battle-enemy-region"><div class="battle-title">戰鬥</div><div id="battleMonsterArea" class="v-fixed-enemy-zone v-fixed-zone-v2 gameplay-boss-active"><div class="v-fixed-slot-row v-fixed-enemy-row" data-slot-row="back"><div class="v-fixed-battle-slot v-fixed-enemy-slot" data-slot="ENEMY_B1"><div id="battleMonster1" class="battle-monster v174-cardless-unit" data-element="water">${hud("援軍一","2288/2288","839/874")}</div></div><div class="v-fixed-battle-slot v-fixed-enemy-slot" data-slot="ENEMY_B2"></div><div class="v-fixed-battle-slot v-fixed-enemy-slot" data-slot="ENEMY_B3"></div><div class="v-fixed-battle-slot v-fixed-enemy-slot" data-slot="ENEMY_B4"></div><div class="v-fixed-battle-slot v-fixed-enemy-slot" data-slot="ENEMY_B5"><div id="battleMonster2" class="battle-monster v174-cardless-unit" data-element="water">${hud("援軍二","2288/2288","839/874")}</div></div></div><div class="v-fixed-slot-row v-fixed-enemy-row" data-slot-row="front"><div class="v-fixed-battle-slot v-fixed-enemy-slot" data-slot="ENEMY_F1"></div><div class="v-fixed-battle-slot v-fixed-enemy-slot" data-slot="ENEMY_F2"></div><div class="v-fixed-battle-slot v-fixed-enemy-slot" data-slot="ENEMY_F3"></div><div class="v-fixed-battle-slot v-fixed-enemy-slot" data-slot="ENEMY_F4"></div><div class="v-fixed-battle-slot v-fixed-enemy-slot" data-slot="ENEMY_F5"></div></div><div class="v-fixed-boss-footprint"><div id="battleMonster0" class="battle-monster gameplay-boss-card v174-cardless-unit target" data-element="fire">${hud("焰天君","5142/5142","0/0")}<div class="damage-popup hp-popup">-468HP</div></div></div></div></section><section class="battle-center-region"><div class="turn-target-row">第 1 回合</div><div class="battle-middle"></div></section><section class="battle-ally-region"><div id="battlePlayerRow" class="v-fixed-ally-zone"></div></section><section class="battle-info-region"><div class="battle-info-header-row"><button id="battleInfoToggle" class="battle-info-toggle"><span>⌃</span></button></div><div id="battleInfo" class="battle-info">資訊</div></section></div></div></div></div></div></div><script>function rect(selector){const r=document.querySelector(selector).getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height,centerX:r.left+r.width/2}}const boss=document.getElementById('battleMonster0'),left=document.getElementById('battleMonster1'),right=document.getElementById('battleMonster2'),hp=boss.querySelector('.monster-hp'),sp=boss.querySelector('.monster-sp'),leftHp=left.querySelector('.monster-hp'),popup=boss.querySelector('.damage-popup'),toggle=document.querySelector('.battle-info-toggle'),stage=document.getElementById('game-stage'),gameContent=document.getElementById('game-content'),gameContentStyle=getComputedStyle(gameContent),gameContentRect=rect('#game-content');parent.document.getElementById('result').textContent=JSON.stringify({bossBorder:getComputedStyle(boss).borderTopWidth,bossShadow:getComputedStyle(boss).boxShadow,leftBorder:getComputedStyle(left).borderTopWidth,bossHpDisplay:getComputedStyle(hp).display,bossHpVisibility:getComputedStyle(hp).visibility,bossHpPosition:getComputedStyle(hp).position,bossSpPosition:getComputedStyle(sp).position,bossHpCssHeight:parseFloat(getComputedStyle(hp).height),leftHpCssHeight:parseFloat(getComputedStyle(leftHp).height),gameContentScale:gameContentRect.width/parseFloat(gameContentStyle.width),bossHp:rect('#battleMonster0 > .monster-hp'),bossSp:rect('#battleMonster0 > .monster-sp'),bossName:rect('#battleMonster0 > .battle-monster-name'),leftHpHeight:rect('#battleMonster1 > .monster-hp').height,popupDisplay:getComputedStyle(popup).display,leftCard:rect('#battleMonster1'),rightCard:rect('#battleMonster2'),leftArt:rect('#battleMonster1 > .v174-battle-art'),rightArt:rect('#battleMonster2 > .v174-battle-art'),bossArt:rect('#battleMonster0 > .v174-battle-art'),toggle:rect('.battle-info-toggle'),toggleCssRight:parseFloat(getComputedStyle(toggle).right),stage:rect('#game-stage'),toggleBackground:getComputedStyle(toggle).backgroundColor});</script></body></html>`;
const outer=`<!doctype html><html><body style="margin:0"><pre id="result"></pre><iframe style="width:412px;height:915px;border:0" srcdoc="${escapeAttribute(inner)}"></iframe></body></html>`;
const fixture=path.join(process.cwd(),".battle-presentation-followup-browser.html");
try{
    fs.writeFileSync(fixture,outer,"utf8");
    const result=spawnSync(chromePath(),["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--window-size=800,1000","--virtual-time-budget=1000","--dump-dom","file://"+fixture],{encoding:"utf8",timeout:30000,maxBuffer:20*1024*1024});
    assert.equal(result.status,0,result.stderr);
    const match=result.stdout.match(/<pre id="result">([\s\S]*?)<\/pre>/);
    assert.ok(match,"browser QA result missing");
    const data=JSON.parse(decode(match[1]));
    assert.equal(data.bossBorder,"0px");
    assert.equal(data.leftBorder,"0px");
    assert.equal(data.bossShadow,"none");
    assert.equal(data.bossHpDisplay,"block");
    assert.equal(data.bossHpVisibility,"visible");
    assert.equal(data.bossHpPosition,"absolute");
    assert.equal(data.bossSpPosition,"absolute");
    assert.equal(data.bossHpCssHeight,11,"Boss HP must keep the 11px logical resource-bar height");
    assert.ok(Math.abs(data.bossHp.height-(11*data.gameContentScale))<.01,"Boss HP physical rect must reflect only the canonical game-content scale");
    assert.ok(data.bossHp.width>100,"Boss HP must escape the legacy 68px monster-bar width");
    assert.ok(Math.abs(data.bossHp.width-data.bossName.width)<=1,"Boss HP must use the same HUD width as the Boss name");
    assert.ok(Math.abs(data.bossSp.width-data.bossHp.width)<=1,"Boss SP must align to the formal Boss HP width");
    assert.ok(data.bossHp.bottom<=data.bossSp.top+1,"Boss HP must sit above SP");
    assert.ok(data.bossSp.bottom<=data.bossName.top+1,"Boss SP must sit above the name");
    assert.equal(data.leftHpCssHeight,11,"Reinforcement HP must keep the 11px logical resource-bar height");
    assert.ok(Math.abs(data.leftHpHeight-(11*data.gameContentScale))<.01,"Reinforcement HP physical rect must reflect only the canonical game-content scale");
    assert.notEqual(data.popupDisplay,"none","Boss HP damage popup must remain visible");
    assert.ok(data.leftArt.right<=data.bossArt.left,"B1 reinforcement artwork must not overlap Boss artwork");
    assert.ok(data.rightArt.left>=data.bossArt.right,"B5 reinforcement artwork must not overlap Boss artwork");
    assert.ok(data.leftArt.centerX<=data.leftCard.centerX-6,"B1 reinforcement artwork must visibly shift outward");
    assert.ok(data.rightArt.centerX>=data.rightCard.centerX+6,"B5 reinforcement artwork must visibly shift outward");
    assert.equal(data.toggleCssRight,4,"drawer handle must keep its 4px logical bottom-right inset");
    assert.ok(data.toggle.left>=data.stage.left&&data.toggle.right<=data.stage.right,"drawer handle must remain inside the battle stage");
    assert.match(data.toggleBackground,/rgba?\(0, 0, 0/);
    console.log("Battle presentation follow-up browser QA 412x915 passed:",JSON.stringify(data));
}finally{
    try{fs.unlinkSync(fixture);}catch(_){ }
}
