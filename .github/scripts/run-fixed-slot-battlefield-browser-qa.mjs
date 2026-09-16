import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {spawnSync} from "node:child_process";

const ROOT=process.cwd();
const ARTIFACT_DIR=path.join(ROOT,"artifacts/browser-qa");
const FIXTURE=path.join(ROOT,".fixed-slot-battlefield-rendering-v2-qa.html");
const VIEWPORTS=[[412,915],[393,873],[360,800]];
const read=file=>fs.readFileSync(path.join(ROOT,file),"utf8");

function findChrome(){
    for(const name of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){
        const probe=spawnSync("bash",["-lc",`command -v ${name}`],{encoding:"utf8"});
        if(probe.status===0&&probe.stdout.trim()){ return probe.stdout.trim(); }
    }
    throw new Error("Headless Chrome/Chromium is required for Fixed Slot battlefield QA.");
}
function esc(value){
    return String(value).replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}
function decode(value){return value.replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#39;/g,"'");}

const ownerSource=read("js/battlefield-slot-owner.js").replace(/<\/script/gi,"<\\/script");
const adapterSource=read("js/battlefield-render-geometry-adapter.js").replace(/<\/script/gi,"<\\/script");
const geometryCss=read("css/fixed-slot-battlefield-rendering-v2.css").replace(/<\/style/gi,"<\\/style");

function fixtureHtml(width,height){
    return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#120e09;color:#fff;font-family:sans-serif}
#game-stage{width:${width}px;height:${height}px;overflow:hidden}
#battlePage{position:relative;width:100%;height:100%;overflow:visible}
.battle-wrap{height:100%;display:flex;flex-direction:column;gap:3px;overflow:hidden}
.battle-title{flex:0 0 20px;height:20px;text-align:center}.battle-monster-gap-filler{display:none}
#bossMechanismSlot{flex:0 0 28px;height:28px}.battle-middle{flex:0 0 70px;height:70px}.v-fixed-action-zone{height:44px}
.battle-monster,.battle-player{position:relative}.v174-battle-art{background-image:linear-gradient(#7db,#246);background-repeat:no-repeat}
.battle-monster-name,.battle-player-id{color:#fff}.monster-hp,.hp-bar{background:#5b1717}.monster-sp,.sp-bar{background:#173b6b}
.v143-skill-stage{position:fixed;inset:0;pointer-events:none}
.damage-popup{position:absolute;font-weight:900}
</style><style>${geometryCss}</style></head><body>
<div id="game-stage"><section id="battlePage" class="v-fixed-slot-render-v2"><div class="battle-wrap">
<div class="battle-title">戰鬥</div><div id="battleMonsterArea"></div><div id="bossMechanismSlot"></div>
<div class="battle-middle"><div id="battleTurnIndicator">第 1 回合</div></div>
<div id="battlePlayerRow"></div><div id="battleActionRegion" class="v-fixed-action-zone">操作區</div>
</div></section></div><pre id="result" hidden></pre>
<script>
window.getExistingPartyIndexes=function(){return [0,1,2];};
window.monsters=Array.from({length:10},function(_,i){return {hp:1000,alive:true,rank:i===2?'boss':(i===1?'elite':'regular')};});
window.currentBattleMonsters=[];
window.getMonsterRank=function(m){return m&&m.rank||'regular';};
window.renderBattle=function(){};
window.showDamagePopup=function(element,text,type,isCrit){var p=document.createElement('div');p.className='damage-popup hp-popup'+(isCrit?' crit':'');p.textContent=text||'-100';element.appendChild(p);return p;};
window.showMissEffect=function(isPlayerTarget,index,label){var el=document.getElementById((isPlayerTarget?'battlePlayerCard':'battleMonster')+index);if(!el)return;var p=document.createElement('div');p.className='damage-popup miss-popup';p.textContent=label||'MISS';el.appendChild(p);};
</script><script>${ownerSource}</script><script>${adapterSource}</script>
<script>
(function(){
 const owner=window.FourSymbolsBattlefieldSlots,adapter=window.FourSymbolsBattlefieldRenderGeometry;
 function enemyCard(index){var c=document.createElement('div');c.id='battleMonster'+index;c.className='battle-monster';c.innerHTML='<div class="v174-battle-art"></div><div class="battle-monster-name">怪物'+index+'</div><div class="monster-status-badges"></div><div class="monster-hp"></div><div class="monster-sp"></div>';return c;}
 function allyCard(index){var c=document.createElement('div');c.id='battlePlayerCard'+index;c.className='battle-player';c.innerHTML='<div class="v174-battle-art"></div><div class="battle-player-id">角色'+index+'</div><div class="monster-status-badges"></div><div class="hp-bar"></div><div class="sp-bar"></div>';return c;}
 function addCards(count){
   var enemy=document.getElementById('battleMonsterArea'); enemy.innerHTML='';
   window.currentBattleMonsters=Array.from({length:count},function(_,i){return i;}); owner.clearActiveEnemySnapshot();
   for(var i=0;i<count;i++)enemy.appendChild(enemyCard(i));
   var ally=document.getElementById('battlePlayerRow'); ally.innerHTML=''; for(var a=0;a<3;a++)ally.appendChild(allyCard(a));
   adapter.reconcile();
 }
 function rect(sel){var r=document.querySelector(sel).getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};}
 function lower(){return {ally:rect('#battlePlayerRow'),middle:rect('.battle-middle'),action:rect('#battleActionRegion')};}
 function clipChain(node){var result=[];for(var p=node.parentElement;p&&p.id!=='game-stage';p=p.parentElement){var cs=getComputedStyle(p);result.push({tag:p.id||p.className,overflow:cs.overflow,overflowX:cs.overflowX,overflowY:cs.overflowY});}return result;}
 var scenarios={};
 [1,3,5,6,8,10].forEach(function(count){
   addCards(count);var snap=owner.getActiveEnemySnapshot();var assigned=Object.assign({},snap.monsterIndexToSlot);var primary=assigned[0];
   var single=adapter.getVfxGeometry('monster',primary,'single');var tri=adapter.getVfxGeometry('monster',primary,'tri');var all=adapter.getVfxGeometry('monster',primary,'all');
   scenarios[count]={lower:lower(),assigned:assigned,single:single&&{width:single.baseWidth,height:single.baseHeight},tri:tri&&{width:tri.baseWidth,height:tri.baseHeight},all:all&&{width:all.baseWidth,height:all.baseHeight},slots:document.querySelectorAll('.v-fixed-enemy-slot').length};
 });
 addCards(3);
 var enemy1=document.getElementById('battleMonster1'),enemy2=document.getElementById('battleMonster2');var beforeDeath={e1:rect('#battleMonster1'),e2:rect('#battleMonster2')};enemy1.remove();var afterDeath={e2:rect('#battleMonster2')};
 var art=document.querySelector('#battleMonster2 .v174-battle-art');var artStyle=getComputedStyle(art);
 window.showDamagePopup(document.getElementById('battleMonster2'),'-777','hp',true);window.showMissEffect(false,2,'MISS');
 var damage=Array.from(document.querySelectorAll('.damage-popup.hp-popup')).pop();var miss=Array.from(document.querySelectorAll('.damage-popup.miss-popup')).pop();
 var stage=document.createElement('div');stage.className='v143-skill-stage';stage.dataset.geometryOwner='fixed-slot';document.body.appendChild(stage);
 setTimeout(function(){
   var result={viewport:{width:${width},height:${height}},scenarios:scenarios,beforeDeath:beforeDeath,afterDeath:afterDeath,art:{backgroundSize:artStyle.backgroundSize,overflow:artStyle.overflow,clipChain:clipChain(art)},popup:{damage:{slot:damage&&damage.dataset.slot,left:damage&&damage.style.left,top:damage&&damage.style.top,fontSize:damage&&damage.style.fontSize},miss:{slot:miss&&miss.dataset.slot,left:miss&&miss.style.left,top:miss&&miss.style.top}},stageOverflow:getComputedStyle(stage).overflow,pageScroll:{width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,clientWidth:document.documentElement.clientWidth,clientHeight:document.documentElement.clientHeight},enemySlots:document.querySelectorAll('.v-fixed-enemy-slot').length,allySlots:document.querySelectorAll('.v-fixed-ally-slot').length};
   document.getElementById('result').textContent=JSON.stringify(result);
 },40);
})();
</script></body></html>`;
}

function close(a,b,label,tolerance=.5){assert.ok(Math.abs(a-b)<=tolerance,`${label}: ${a} != ${b}`);}
function runViewport(chrome,width,height){
    fs.writeFileSync(FIXTURE,fixtureHtml(width,height),"utf8");
    const fileUrl="file://"+FIXTURE.replace(/\\/g,"/");
    const result=spawnSync(chrome,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--force-device-scale-factor=1",`--window-size=${width},${height}`,"--virtual-time-budget=1200","--dump-dom",fileUrl],{encoding:"utf8",timeout:30000,maxBuffer:24*1024*1024});
    assert.equal(result.status,0,result.stderr||`browser fixture failed ${width}x${height}`);
    const match=result.stdout.match(/<pre id="result"[^>]*>([\s\S]*?)<\/pre>/);assert.ok(match,`missing QA result ${width}x${height}`);
    const data=JSON.parse(decode(match[1]));
    assert.equal(data.enemySlots,10);assert.equal(data.allySlots,6);
    const baseline=data.scenarios[1].lower;
    for(const count of [1,3,5,6,8,10]){
        const scenario=data.scenarios[count];assert.equal(scenario.slots,10);
        close(scenario.lower.ally.top,baseline.ally.top,`ally top count ${count}`);
        close(scenario.lower.middle.top,baseline.middle.top,`middle top count ${count}`);
        close(scenario.lower.action.top,baseline.action.top,`action top count ${count}`);
        close(scenario.single.width,data.scenarios[1].single.width,`single scale count ${count}`);
        close(scenario.tri.width,data.scenarios[1].tri.width,`tri scale count ${count}`);
        close(scenario.all.width,data.scenarios[1].all.width,`all scale count ${count}`);
        close(scenario.all.height,data.scenarios[1].all.height,`all height count ${count}`);
    }
    close(data.beforeDeath.e2.left,data.afterDeath.e2.left,"death must not move right unit");
    close(data.beforeDeath.e2.top,data.afterDeath.e2.top,"death must not move right unit vertically");
    assert.equal(data.art.backgroundSize,"contain");assert.equal(data.art.overflow,"visible");
    assert.equal(data.art.clipChain.some(entry=>/hidden|clip/.test(entry.overflow)||/hidden|clip/.test(entry.overflowX)||/hidden|clip/.test(entry.overflowY)),false,"artwork has a clipping ancestor inside battlefield");
    assert.equal(data.popup.damage.slot,"ENEMY_F4");assert.equal(data.popup.miss.slot,"ENEMY_F4");
    assert.ok(data.popup.damage.left&&data.popup.damage.top);assert.ok(data.popup.miss.left&&data.popup.miss.top);
    assert.equal(data.stageOverflow,"visible");
    assert.ok(data.pageScroll.width<=data.pageScroll.clientWidth+1,`horizontal page scroll ${width}x${height}`);
    assert.ok(data.pageScroll.height<=data.pageScroll.clientHeight+1,`vertical page scroll ${width}x${height}`);
    return data;
}

fs.mkdirSync(ARTIFACT_DIR,{recursive:true});
try{
    const chrome=findChrome();
    const results=VIEWPORTS.map(([width,height])=>runViewport(chrome,width,height));
    const evidence={suite:"fixed-slot-battlefield-rendering-v2",passed:true,viewports:results.map(item=>item.viewport),checks:{enemyCounts:[1,3,5,6,8,10],allySlots:6,deathDoesNotCompress:true,vfxScaleStable:true,artworkNoBattlefieldClip:true,popupUsesSlotAnchor:true,noPageScroll:true},results};
    fs.writeFileSync(path.join(ARTIFACT_DIR,"fixed-slot-battlefield-rendering-v2.json"),JSON.stringify(evidence,null,2)+"\n","utf8");
    console.log("Fixed Slot Battlefield Rendering V2 mobile browser QA passed:",VIEWPORTS.map(v=>v.join("x")).join(", "));
}finally{
    try{fs.unlinkSync(FIXTURE);}catch(_){ }
}
