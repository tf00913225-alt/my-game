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
.battle-wrap{height:100%;display:flex;flex-direction:column;gap:3px;overflow:visible}
.battle-title{flex:0 0 20px;height:20px;text-align:center}.battle-monster-gap-filler{display:none}
#bossMechanismSlot{flex:0 0 28px;height:28px}.battle-middle{flex:0 0 70px;height:70px}.v-fixed-action-zone{height:44px}
.battle-monster,.battle-player{position:relative}.v174-battle-art{background-image:linear-gradient(#7db,#246);background-repeat:no-repeat}
.battle-monster-name,.battle-player-id{color:#fff}.monster-hp,.hp-bar{background:#5b1717}.monster-sp,.sp-bar{background:#173b6b}
.v143-skill-stage{position:fixed;inset:0;pointer-events:none}.damage-popup{position:absolute;font-weight:900}
</style>
<style id="v174-cardless-battle-style">#battlePage .v174-battle-art{inset:999px!important}#battlePage .battle-wrap{overflow:hidden!important}</style>
<style>${geometryCss}</style></head><body>
<div id="game-stage"><section id="battlePage" class="v-fixed-slot-render-v2"><div class="battle-wrap">
<div class="battle-title">戰鬥</div><div id="battleMonsterArea" class="battle-monsters v131-formation"></div><div id="bossMechanismSlot"></div>
<div class="battle-middle"><div id="battleTurnIndicator">第 1 回合</div></div>
<div id="battlePlayerRow" class="battle-player-row"></div><div id="battleActionRegion" class="v-fixed-action-zone">操作區</div>
</div></section></div><pre id="result" hidden></pre>
<script>
window.__allyIndexes=[0,1,2];
window.getExistingPartyIndexes=function(){return window.__allyIndexes.slice();};
window.monsters=Array.from({length:10},function(_,i){return {hp:1000,alive:true,rank:i===2?'boss':(i===1?'elite':'regular')};});
window.currentBattleMonsters=[];window.getMonsterRank=function(m){return m&&m.rank||'regular';};window.renderBattle=function(){};
window.showDamagePopup=function(element,text,type,isCrit){var p=document.createElement('div');p.className='damage-popup hp-popup'+(isCrit?' crit':'');p.textContent=text||'-100';element.appendChild(p);return p;};
window.showMissEffect=function(isPlayerTarget,index,label){var el=document.getElementById((isPlayerTarget?'battlePlayerCard':'battleMonster')+index);if(!el)return;var p=document.createElement('div');p.className='damage-popup miss-popup';p.textContent=label||'MISS';el.appendChild(p);};
</script><script>${ownerSource}</script><script>${adapterSource}</script>
<script>
(function(){
 const owner=window.FourSymbolsBattlefieldSlots,adapter=window.FourSymbolsBattlefieldRenderGeometry;
 function enemyCard(index){var c=document.createElement('div');c.id='battleMonster'+index;c.className='battle-monster '+(index===4?'abyss-unit':'');c.dataset.rank=window.monsters[index].rank;c.innerHTML='<div class="v174-battle-art"></div><div class="battle-monster-name">怪物'+index+'</div><div class="monster-status-badges"></div><div class="monster-hp"></div><div class="monster-sp"></div>';return c;}
 function allyCard(index){var c=document.createElement('div');c.id='battlePlayerCard'+index;c.className='battle-player';c.innerHTML='<div class="v174-battle-art"></div><div class="battle-player-id">角色'+index+'</div><div class="monster-status-badges"></div><div class="hp-bar"></div><div class="sp-bar"></div>';return c;}
 function addCards(enemyCount,allyCount,split){
   allyCount=allyCount===undefined?3:allyCount;
   var enemy=document.getElementById('battleMonsterArea');enemy.innerHTML='';window.currentBattleMonsters=Array.from({length:enemyCount},function(_,i){return i;});owner.clearActiveEnemySnapshot();for(var i=0;i<enemyCount;i++)enemy.appendChild(enemyCard(i));
   window.__allyIndexes=Array.from({length:allyCount},function(_,i){return i;});
   if(split&&allyCount===3){owner.hydrateAllyFormation({characterIndexToSlot:{0:'ALLY_F1',1:'ALLY_B2',2:'ALLY_F3'}},window.__allyIndexes);}else{owner.hydrateAllyFormation(null,window.__allyIndexes);}
   var ally=document.getElementById('battlePlayerRow');ally.innerHTML='';for(var a=0;a<allyCount;a++)ally.appendChild(allyCard(a));adapter.reconcile();
 }
 function rect(sel){var node=document.querySelector(sel),r=node.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height,centerX:r.left+r.width/2,centerY:r.top+r.height/2};}
 function lower(){return {ally:rect('#battlePlayerRow'),middle:rect('.battle-middle'),action:rect('#battleActionRegion')};}
 function clipChain(node){var result=[];for(var p=node.parentElement;p&&p.id!=='game-stage';p=p.parentElement){var cs=getComputedStyle(p);result.push({tag:p.id||p.className,overflow:cs.overflow,overflowX:cs.overflowX,overflowY:cs.overflowY,contain:cs.contain});}return result;}
 function artEvidence(selector){var art=document.querySelector(selector+' .v174-battle-art'),s=getComputedStyle(art);return {backgroundSize:s.backgroundSize,overflow:s.overflow,contain:s.contain,clipChain:clipChain(art),rect:rect(selector),artRect:{left:art.getBoundingClientRect().left,top:art.getBoundingClientRect().top,right:art.getBoundingClientRect().right,bottom:art.getBoundingClientRect().bottom,width:art.getBoundingClientRect().width,height:art.getBoundingClientRect().height}};}
 function geoEvidence(g){return g&&{width:g.baseWidth,height:g.baseHeight,left:g.rect.left,top:g.rect.top,right:g.rect.right,bottom:g.rect.bottom,centerX:g.center.x,centerY:g.center.y};}
 var scenarios={};
 [1,3,5,6,8,10].forEach(function(count){addCards(count,3,false);var snap=owner.getActiveEnemySnapshot(),assigned=Object.assign({},snap.monsterIndexToSlot),primary=assigned[0];var single=adapter.getVfxGeometry('monster',primary,'single'),tri=adapter.getVfxGeometry('monster',primary,'tri'),row=adapter.getVfxGeometry('monster',primary,'row'),column=adapter.getVfxGeometry('monster',primary,'column'),all=adapter.getVfxGeometry('monster',primary,'all');scenarios[count]={lower:lower(),assigned:assigned,single:geoEvidence(single),tri:geoEvidence(tri),row:geoEvidence(row),column:geoEvidence(column),all:geoEvidence(all),slots:document.querySelectorAll('.v-fixed-enemy-slot').length};});
 var allyScenarios={};
 [1,2,3].forEach(function(count){addCards(5,count,false);allyScenarios[count]={lower:lower(),slots:document.querySelectorAll('.v-fixed-ally-slot').length,assigned:Object.assign({},owner.ensureAllyFormation(window.__allyIndexes).characterIndexToSlot)};});
 addCards(5,3,true);var splitAlly={lower:lower(),assigned:Object.assign({},owner.ensureAllyFormation(window.__allyIndexes).characterIndexToSlot)};var artwork={player:artEvidence('#battlePlayerCard0'),regular:artEvidence('#battleMonster0'),elite:artEvidence('#battleMonster1'),boss:artEvidence('#battleMonster2'),abyss:artEvidence('#battleMonster4')};
 addCards(3,3,true);var beforeDeath={e1:rect('#battleMonster1'),e2:rect('#battleMonster2')};document.getElementById('battleMonster1').remove();var afterDeath={e2:rect('#battleMonster2')};var targetSlot=owner.getEnemySlotForMonster(owner.getActiveEnemySnapshot(),2),targetRect=owner.getSlotRect(targetSlot);
 window.showDamagePopup(document.getElementById('battleMonster2'),'-100','hp',false);
 window.showDamagePopup(document.getElementById('battleMonster2'),'-777','hp',true);
 window.showDamagePopup(document.getElementById('battleMonster2'),'+250','heal',false);
 window.showMissEffect(false,2,'MISS');
 var hpPopups=Array.from(document.querySelectorAll('.damage-popup.hp-popup')),damage=hpPopups[hpPopups.length-3],critical=hpPopups[hpPopups.length-2],heal=hpPopups[hpPopups.length-1],miss=Array.from(document.querySelectorAll('.damage-popup.miss-popup')).pop();
 var stage=document.createElement('div');stage.className='v143-skill-stage';stage.dataset.geometryOwner='fixed-slot';document.body.appendChild(stage);
 setTimeout(function(){var legacyStyle=document.getElementById('v174-cardless-battle-style');var result={viewport:{width:${width},height:${height}},scenarios:scenarios,allyScenarios:allyScenarios,splitAlly:splitAlly,artwork:artwork,beforeDeath:beforeDeath,afterDeath:afterDeath,targetSlot:targetSlot,targetRect:targetRect,legacyStyle:{owner:legacyStyle&&legacyStyle.dataset.geometryOwner,textLength:legacyStyle?legacyStyle.textContent.length:-1},popup:{damage:{slot:damage&&damage.dataset.slot,kind:damage&&damage.dataset.popupKind,left:damage&&damage.style.left,top:damage&&damage.style.top,fontSize:damage&&damage.style.fontSize},critical:{slot:critical&&critical.dataset.slot,kind:critical&&critical.dataset.popupKind,left:critical&&critical.style.left,top:critical&&critical.style.top,fontSize:critical&&critical.style.fontSize},heal:{slot:heal&&heal.dataset.slot,kind:heal&&heal.dataset.popupKind,left:heal&&heal.style.left,top:heal&&heal.style.top,fontSize:heal&&heal.style.fontSize},miss:{slot:miss&&miss.dataset.slot,kind:miss&&miss.dataset.popupKind,left:miss&&miss.style.left,top:miss&&miss.style.top,fontSize:miss&&miss.style.fontSize}},stageOverflow:getComputedStyle(stage).overflow,pageScroll:{width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,clientWidth:document.documentElement.clientWidth,clientHeight:document.documentElement.clientHeight},enemySlots:document.querySelectorAll('.v-fixed-enemy-slot').length,allySlots:document.querySelectorAll('.v-fixed-ally-slot').length,legacyClasses:{enemy:document.getElementById('battleMonsterArea').className,ally:document.getElementById('battlePlayerRow').className}};document.getElementById('result').textContent=JSON.stringify(result);},40);
})();
</script></body></html>`;
}

function close(a,b,label,tolerance=.5){assert.ok(Math.abs(a-b)<=tolerance,`${label}: ${a} != ${b}`);}
function runViewport(chrome,width,height){
    fs.writeFileSync(FIXTURE,fixtureHtml(width,height),"utf8");
    const fileUrl="file://"+FIXTURE.replace(/\\/g,"/");
    const result=spawnSync(chrome,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--force-device-scale-factor=1",`--window-size=${width},${height}`,"--virtual-time-budget=1200","--dump-dom",fileUrl],{encoding:"utf8",timeout:30000,maxBuffer:24*1024*1024});
    assert.equal(result.status,0,result.stderr||`browser fixture failed ${width}x${height}`);
    const match=result.stdout.match(/<pre id="result"[^>]*>([\s\S]*?)<\/pre>/);assert.ok(match,`missing QA result ${width}x${height}`);const data=JSON.parse(decode(match[1]));
    assert.equal(data.enemySlots,10);assert.equal(data.allySlots,6);
    assert.equal(data.legacyStyle.owner,"fixed-slot");assert.equal(data.legacyStyle.textLength,0,"legacy runtime geometry style must be neutralized");
    assert.doesNotMatch(data.legacyClasses.enemy,/battle-monsters|v131-formation|v141-fixed-formation/);assert.doesNotMatch(data.legacyClasses.ally,/battle-player-row/);
    const baseline=data.scenarios[1].lower;
    for(const count of [1,3,5,6,8,10]){const scenario=data.scenarios[count];assert.equal(scenario.slots,10);close(scenario.lower.ally.top,baseline.ally.top,`ally top count ${count}`);close(scenario.lower.middle.top,baseline.middle.top,`middle top count ${count}`);close(scenario.lower.action.top,baseline.action.top,`action top count ${count}`);for(const shape of ["single","tri","row","column","all"]){close(scenario[shape].width,data.scenarios[1][shape].width,`${shape} width count ${count}`);close(scenario[shape].height,data.scenarios[1][shape].height,`${shape} height count ${count}`);close(scenario[shape].centerX,(scenario[shape].left+scenario[shape].right)/2,`${shape} centerX count ${count}`);close(scenario[shape].centerY,(scenario[shape].top+scenario[shape].bottom)/2,`${shape} centerY count ${count}`);}}
    const allyBaseline=data.allyScenarios[1].lower;for(const count of [1,2,3]){assert.equal(data.allyScenarios[count].slots,6);close(data.allyScenarios[count].lower.ally.height,allyBaseline.ally.height,`ally zone height party ${count}`);close(data.allyScenarios[count].lower.action.top,allyBaseline.action.top,`action top party ${count}`);}assert.equal(data.splitAlly.assigned[1],"ALLY_B2");close(data.splitAlly.lower.ally.height,allyBaseline.ally.height,"split front/back ally zone height");
    close(data.beforeDeath.e2.left,data.afterDeath.e2.left,"death must not move right unit");close(data.beforeDeath.e2.top,data.afterDeath.e2.top,"death must not move right unit vertically");
    for(const [kind,art] of Object.entries(data.artwork)){assert.equal(art.backgroundSize,"contain",`${kind} artwork must use contain`);assert.equal(art.overflow,"visible",`${kind} artwork overflow`);assert.equal(art.contain,"none",`${kind} artwork contain`);assert.equal(art.clipChain.some(entry=>/hidden|clip/.test(entry.overflow)||/hidden|clip/.test(entry.overflowX)||/hidden|clip/.test(entry.overflowY)),false,`${kind} artwork has clipping ancestor`);}
    for(const kind of ["damage","critical","heal","miss"]){assert.equal(data.popup[kind].slot,data.targetSlot,`${kind} slot anchor`);assert.ok(data.popup[kind].left&&data.popup[kind].top,`${kind} position`);}assert.equal(data.popup.critical.fontSize,"20px");assert.equal(data.popup.damage.fontSize,"18px");assert.equal(data.popup.heal.kind,"heal");assert.equal(data.popup.miss.kind,"miss");
    assert.equal(data.stageOverflow,"visible");
    assert.ok(data.pageScroll.width<=data.pageScroll.clientWidth+1,`horizontal page scroll ${width}x${height}`);assert.ok(data.pageScroll.height<=data.pageScroll.clientHeight+1,`vertical page scroll ${width}x${height}`);return data;
}

fs.mkdirSync(ARTIFACT_DIR,{recursive:true});
try{
    const chrome=findChrome();const results=VIEWPORTS.map(([width,height])=>runViewport(chrome,width,height));
    const evidence={suite:"fixed-slot-battlefield-rendering-v2",passed:true,viewports:results.map(item=>item.viewport),checks:{enemyCounts:[1,3,5,6,8,10],allyCounts:[1,2,3],splitAllyFormation:true,deathDoesNotCompress:true,vfxShapes:["single","tri","row","column","all"],vfxCenterUsesGeometry:true,vfxScaleStable:true,artworkKinds:["player","regular","elite","boss","abyss"],artworkNoBattlefieldClip:true,popupKinds:["damage","critical","heal","miss"],popupUsesSlotAnchor:true,legacyRuntimeGeometryNeutralized:true,noPageScroll:true},results};
    fs.writeFileSync(path.join(ARTIFACT_DIR,"fixed-slot-battlefield-rendering-v2.json"),JSON.stringify(evidence,null,2)+"\n","utf8");console.log("Fixed Slot Battlefield Rendering V2 mobile browser QA passed:",VIEWPORTS.map(v=>v.join("x")).join(", "));
}finally{try{fs.unlinkSync(FIXTURE);}catch(_){}}
