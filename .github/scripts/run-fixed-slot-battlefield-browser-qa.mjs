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
    const configured=String(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||"").trim();
    if(configured&&fs.existsSync(configured)){ return configured; }
    for(const name of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){
        const probe=spawnSync("bash",["-lc",`command -v ${name}`],{encoding:"utf8"});
        if(probe.status===0&&probe.stdout.trim()){ return probe.stdout.trim(); }
    }
    throw new Error("Headless Chrome/Chromium is required for Fixed Slot battlefield QA.");
}
function decode(value){return value.replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#39;/g,"'");}

const ownerSource=read("js/battlefield-slot-owner.js").replace(/<\/script/gi,"<\\/script");
const adapterSource=read("js/battlefield-render-geometry-adapter.js").replace(/<\/script/gi,"<\\/script");
const identityCss=read("css/40-v143-combat-dungeon-polish.css").replace(/<\/style/gi,"<\\/style");
const v154Css=read("css/46-v154-dev-fixes.css").replace(/<\/style/gi,"<\\/style");
const geometryCss=read("css/fixed-slot-battlefield-rendering-v2.css").replace(/<\/style/gi,"<\\/style");
const bossCss=read("css/gameplay-boss-tower.css").replace(/<\/style/gi,"<\\/style");

function fixtureHtml(width,height){
    return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#120e09;color:#fff;font-family:sans-serif}
#game-stage{width:${width}px;height:${height}px;overflow:hidden}
#app,#game-content{width:100%;height:100%}
#battlePage{position:relative;width:100%;height:100%;overflow:visible}
.battle-wrap{height:100%;display:flex;flex-direction:column;gap:3px;overflow:visible}
.battle-title{flex:0 0 20px;height:20px;text-align:center}
.battle-middle{min-height:0}.v-fixed-action-zone{height:66px}.battle-info{min-height:0;overflow-y:auto}
.battle-monster,.battle-player{position:relative}.v174-battle-art{background-image:linear-gradient(#7db,#246);background-repeat:no-repeat}
.battle-monster-name,.battle-player-id{color:#fff}.monster-hp,.hp-bar{background:#5b1717}.monster-sp,.sp-bar{background:#173b6b}
.v143-skill-stage{position:fixed;inset:0;pointer-events:none}.damage-popup{position:absolute;font-weight:900}
</style>
<style id="v174-cardless-battle-style">#battlePage .v174-battle-art{inset:999px!important}#battlePage .battle-wrap{overflow:hidden!important}</style>
<style>${identityCss}</style><style>${v154Css}</style><style>${geometryCss}</style><style>${bossCss}</style></head><body>
<div id="game-stage"><div id="app"><div id="game-content"><section id="battlePage" class="v-fixed-slot-render-v2"><div class="battle-wrap">
<section class="battle-enemy-region"><div class="battle-title">戰鬥</div><div id="battleMonsterArea" class="battle-monsters v131-formation"></div></section>
<section class="battle-center-region"><div class="battle-middle"><div id="battleActionRegion" class="v-fixed-action-zone" style="position:relative;display:flex;flex-direction:column;gap:4px"><div id="turnTargetRow" class="turn-target-row">第 1 回合</div><div id="battleCommandRow" style="height:66px;flex:0 0 66px">操作區</div></div></div></section>
<section class="battle-ally-region"><div id="battlePlayerRow" class="battle-player-row"></div></section>
<section class="battle-info-region"><div class="battle-info-header-row"><button id="battleInfoToggle" class="battle-info-toggle" type="button" aria-expanded="false">戰鬥資訊</button><div id="battleTurnIndicator">第 1 回合</div></div><div id="battleInfo" class="battle-info">戰鬥資訊</div></section>
</div><button class="battle-element-box-button" type="button">元素匣</button></section></div></div></div><pre id="result" hidden></pre>
<script>
window.__allyIndexes=[0,1,2];
window.getExistingPartyIndexes=function(){return window.__allyIndexes.slice();};
window.monsters=Array.from({length:10},function(_,i){return {hp:1000,alive:true,rank:i===2?'boss':(i===1?'elite':'regular')};});
window.currentBattleMonsters=[];window.getMonsterRank=function(m){return m&&m.rank||'regular';};window.renderBattle=function(){};
window.addEventListener('error',function(event){var result=document.getElementById('result');if(result&&!result.textContent){result.textContent=JSON.stringify({fixtureError:String(event.error&&event.error.stack||event.message||'unknown fixture error')});}});
/* The focused geometry fixture supplies the public presentation boundary only;
   the exact production implementation is covered by static/runtime suites and
   by the exact-candidate browser job. This prevents unrelated management UI
   observers from participating in a synthetic DOM. */
window.FourSymbolsBattlePresentation={applyUnit:function(card){if(!card)return;card.classList.add('v174-cardless-unit');var art=card.querySelector(':scope > .v174-battle-art');if(!art){art=document.createElement('div');art.className='v174-battle-art';card.insertBefore(art,card.firstChild);}card.style.setProperty('background-image','none','important');}};
window.showDamagePopup=function(element,text,type,isCrit){var p=document.createElement('div');p.className='damage-popup hp-popup'+(isCrit?' crit':'');p.textContent=text||'-100';element.appendChild(p);return p;};
window.showMissEffect=function(isPlayerTarget,index,label){var el=document.getElementById((isPlayerTarget?'battlePlayerCard':'battleMonster')+index);if(!el)return;var p=document.createElement('div');p.className='damage-popup miss-popup';p.textContent=label||'MISS';el.appendChild(p);};
</script><script>${ownerSource}</script><script>${adapterSource}</script>
<script>
(function(){
 const owner=window.FourSymbolsBattlefieldSlots,adapter=window.FourSymbolsBattlefieldRenderGeometry;
 function enemyCard(index){var c=document.createElement('div');c.id='battleMonster'+index;c.className='battle-monster '+(index===4?'abyss-unit':'');c.dataset.rank=window.monsters[index].rank;c.innerHTML='<div class="v174-battle-art"></div><div class="battle-monster-name v143-monster-identity">怪物'+index+'</div><div class="monster-status-badges"></div><div class="monster-hp"></div><div class="monster-sp"></div>';return c;}
 function allyCard(index){var c=document.createElement('div');c.id='battlePlayerCard'+index;c.className='battle-player';c.innerHTML='<div class="v174-battle-art"></div><div class="battle-player-id">角色'+index+'</div><div class="monster-status-badges"></div><div class="hp-bar"></div><div class="sp-bar"></div>';return c;}
 function addCards(enemyCount,allyCount,split){
   allyCount=allyCount===undefined?3:allyCount;
   var enemy=document.getElementById('battleMonsterArea');enemy.innerHTML='';window.currentBattleMonsters=Array.from({length:enemyCount},function(_,i){return i;});owner.clearActiveEnemySnapshot();for(var i=0;i<enemyCount;i++)enemy.appendChild(enemyCard(i));
   window.__allyIndexes=Array.from({length:allyCount},function(_,i){return i;});
   if(split&&allyCount===3){owner.hydrateAllyFormation({characterIndexToSlot:{0:'ALLY_F1',1:'ALLY_B2',2:'ALLY_F3'}},window.__allyIndexes);}else{owner.hydrateAllyFormation(null,window.__allyIndexes);}
   var ally=document.getElementById('battlePlayerRow');ally.innerHTML='';for(var a=0;a<allyCount;a++)ally.appendChild(allyCard(a));adapter.reconcile();
 }
 function rect(sel){var node=document.querySelector(sel),r=node.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height,centerX:r.left+r.width/2,centerY:r.top+r.height/2};}
 function lower(){return {enemy:rect('.battle-enemy-region'),center:rect('.battle-center-region'),allyRegion:rect('.battle-ally-region'),ally:rect('#battlePlayerRow'),infoRegion:rect('.battle-info-region'),infoToggle:rect('#battleInfoToggle'),middle:rect('.battle-middle'),action:rect('#battleActionRegion'),turn:rect('#turnTargetRow'),info:rect('#battleInfo'),elementBox:rect('.battle-element-box-button'),centerBackground:getComputedStyle(document.querySelector('.battle-center-region')).backgroundImage};}
 function unitRects(selector){return Array.from(document.querySelectorAll(selector)).filter(function(node){return node.children.length;}).map(function(node){return rect('#'+node.children[0].id);});}
 function hudRects(selector){return Array.from(document.querySelectorAll(selector)).filter(function(node){return node.children.length;}).map(function(slot){var card=slot.children[0],art=card.querySelector('.v174-battle-art'),hp=card.querySelector('.monster-hp,.hp-bar'),sp=card.querySelector('.monster-sp,.sp-bar'),name=card.querySelector('.battle-monster-name,.battle-player-id');return {id:card.id,art:rect('#'+card.id+' .v174-battle-art'),hp:rect('#'+card.id+' .monster-hp,#'+card.id+' .hp-bar'),sp:rect('#'+card.id+' .monster-sp,#'+card.id+' .sp-bar'),name:rect('#'+card.id+' .battle-monster-name,#'+card.id+' .battle-player-id'),logicalHp:hp.offsetHeight,logicalSp:sp.offsetHeight};});}
 function clipChain(node){var result=[];for(var p=node.parentElement;p&&p.id!=='game-stage';p=p.parentElement){var cs=getComputedStyle(p);result.push({tag:p.id||p.className,overflow:cs.overflow,overflowX:cs.overflowX,overflowY:cs.overflowY,contain:cs.contain});}return result;}
 function artEvidence(selector){var art=document.querySelector(selector+' .v174-battle-art'),s=getComputedStyle(art);return {backgroundSize:s.backgroundSize,overflow:s.overflow,contain:s.contain,clipChain:clipChain(art),rect:rect(selector),artRect:{left:art.getBoundingClientRect().left,top:art.getBoundingClientRect().top,right:art.getBoundingClientRect().right,bottom:art.getBoundingClientRect().bottom,width:art.getBoundingClientRect().width,height:art.getBoundingClientRect().height}};}
 function geoEvidence(g){return g&&{width:g.baseWidth,height:g.baseHeight,left:g.rect.left,top:g.rect.top,right:g.rect.right,bottom:g.rect.bottom,centerX:g.center.x,centerY:g.center.y};}
 var scenarios={};
 [1,3,5,6,8,10].forEach(function(count){addCards(count,3,false);var snap=owner.getActiveEnemySnapshot(),assigned=Object.assign({},snap.monsterIndexToSlot),primary=assigned[0];var single=adapter.getVfxGeometry('monster',primary,'single'),tri=adapter.getVfxGeometry('monster',primary,'tri'),row=adapter.getVfxGeometry('monster',primary,'row'),column=adapter.getVfxGeometry('monster',primary,'column'),all=adapter.getVfxGeometry('monster',primary,'all');scenarios[count]={lower:lower(),assigned:assigned,single:geoEvidence(single),tri:geoEvidence(tri),row:geoEvidence(row),column:geoEvidence(column),all:geoEvidence(all),unitRects:unitRects('.v-fixed-enemy-slot'),slots:document.querySelectorAll('.v-fixed-enemy-slot').length};});
 var allyScenarios={};
 [1,2,3,4,5,6].forEach(function(count){addCards(5,count,false);allyScenarios[count]={lower:lower(),unitRects:unitRects('.v-fixed-ally-slot'),hudRects:hudRects('.v-fixed-ally-slot'),slots:document.querySelectorAll('.v-fixed-ally-slot').length,assigned:Object.assign({},owner.ensureAllyFormation(window.__allyIndexes).characterIndexToSlot)};});
 addCards(5,3,true);var splitAlly={lower:lower(),assigned:Object.assign({},owner.ensureAllyFormation(window.__allyIndexes).characterIndexToSlot)};var artwork={player:artEvidence('#battlePlayerCard0'),regular:artEvidence('#battleMonster0'),elite:artEvidence('#battleMonster1'),boss:artEvidence('#battleMonster2'),abyss:artEvidence('#battleMonster4')};
 addCards(3,3,true);var beforeDeath={e1:rect('#battleMonster1'),e2:rect('#battleMonster2')};document.getElementById('battleMonster1').remove();var afterDeath={e2:rect('#battleMonster2')};var targetSlot=owner.getEnemySlotForMonster(owner.getActiveEnemySnapshot(),2),targetRect=owner.getSlotRect(targetSlot);
 window.showDamagePopup(document.getElementById('battleMonster2'),'-100','hp',false);
 window.showDamagePopup(document.getElementById('battleMonster2'),'-777','hp',true);
 window.showDamagePopup(document.getElementById('battleMonster2'),'+250','heal',false);
 window.showMissEffect(false,2,'MISS');
 var hpPopups=Array.from(document.querySelectorAll('.damage-popup.hp-popup')),damage=hpPopups[hpPopups.length-3],critical=hpPopups[hpPopups.length-2],heal=hpPopups[hpPopups.length-1],miss=Array.from(document.querySelectorAll('.damage-popup.miss-popup')).pop();
 var stage=document.createElement('div');stage.className='v143-skill-stage';stage.dataset.geometryOwner='fixed-slot';document.body.appendChild(stage);
 var turnNode=document.getElementById('turnTargetRow'),actionRegion=document.getElementById('battleActionRegion');
 turnNode.style.transition='none';
 var turnUi={normal:{opacity:getComputedStyle(turnNode).opacity,pointerEvents:getComputedStyle(turnNode).pointerEvents,rect:rect('#turnTargetRow')}};
 turnNode.classList.add('skill-picker-open');turnUi.skillPicker={opacity:getComputedStyle(turnNode).opacity};turnNode.classList.remove('skill-picker-open');
 turnNode.classList.add('battle-item-open');turnUi.itemPicker={opacity:getComputedStyle(turnNode).opacity};turnNode.classList.remove('battle-item-open');
 actionRegion.classList.add('target-selecting');turnUi.targetSelecting={opacity:getComputedStyle(turnNode).opacity,pointerEvents:getComputedStyle(turnNode).pointerEvents};actionRegion.classList.remove('target-selecting');
 var drawer=document.querySelector('.battle-info-region'),turnIndicator=document.getElementById('battleTurnIndicator');drawer.style.transition='none';turnIndicator.style.transition='none';
 var collapsedDrawer={region:rect('.battle-info-region'),toggle:rect('#battleInfoToggle'),info:rect('#battleInfo'),handleText:document.getElementById('battleInfoToggle').textContent.trim(),turnOpacity:getComputedStyle(turnIndicator).opacity};
 drawer.classList.add('is-expanded');
 var expandedDrawer={region:rect('.battle-info-region'),toggle:rect('#battleInfoToggle'),info:rect('#battleInfo'),turnOpacity:getComputedStyle(turnIndicator).opacity};
 drawer.classList.remove('is-expanded');
 addCards(5,6,false);
 var bossSnapshot=owner.createEnemyFormationSnapshot([0],{originalFormationType:6});
 owner.setActiveEnemySnapshot(bossSnapshot);
 owner.assignMonsterToEnemySlot(bossSnapshot,1,'ENEMY_B1');owner.assignMonsterToEnemySlot(bossSnapshot,2,'ENEMY_B5');
 owner.assignMonsterToEnemySlot(bossSnapshot,3,'ENEMY_F1');owner.assignMonsterToEnemySlot(bossSnapshot,4,'ENEMY_F5');
 window.monsters[0].rank='boss';window.monsters[1].rank='elite';window.monsters[2].rank='elite';
 window.monsters[3].unitKind='boss-object';window.monsters[3].canAct=false;window.monsters[4].unitKind='boss-object';window.monsters[4].canAct=false;
 window.FourSymbolsBossBattle={getBossIndex:function(){return 0;},isBossIndex:function(index){return index===0;}};
 adapter.reconcile();
 var bossCard=document.getElementById('battleMonster0'),leftObject=document.getElementById('battleMonster3');
 bossCard.classList.add('target');leftObject.classList.add('target');
 var bossFootprint=document.querySelector('.v-fixed-boss-footprint'),bossReticle=getComputedStyle(bossCard,'::before'),objectReticle=getComputedStyle(leftObject,'::before');
 var bossHp=bossCard.querySelector('.monster-hp'),bossSp=bossCard.querySelector('.monster-sp'),bossName=bossCard.querySelector('.battle-monster-name');
 var bossEvidence={footprint:rect('.v-fixed-boss-footprint'),card:rect('#battleMonster0'),art:rect('#battleMonster0 > .v174-battle-art'),hud:{hp:rect('#battleMonster0 > .monster-hp'),sp:rect('#battleMonster0 > .monster-sp'),name:rect('#battleMonster0 > .battle-monster-name'),hpPosition:getComputedStyle(bossHp).position,spPosition:getComputedStyle(bossSp).position,hpDisplay:getComputedStyle(bossHp).display,spDisplay:getComputedStyle(bossSp).display},bossCount:document.querySelectorAll('.v-fixed-boss-footprint > #battleMonster0').length,slots:bossFootprint&&bossFootprint.dataset.slots,reinforcements:['#battleMonster1','#battleMonster2'].map(function(selector){return {card:rect(selector),art:rect(selector+' > .v174-battle-art')};}),objects:['#battleMonster3','#battleMonster4'].map(function(selector){return {card:rect(selector),art:rect(selector+' > .v174-battle-art')};}),cardless:Array.from(document.querySelectorAll('.battle-monster')).every(function(card){return card.classList.contains('v174-cardless-unit');}),pointerEvents:getComputedStyle(bossCard).pointerEvents,background:getComputedStyle(bossCard).backgroundImage,reticles:{boss:{content:bossReticle.content,border:bossReticle.borderTopWidth,animation:bossReticle.animationName},object:{content:objectReticle.content,border:objectReticle.borderTopWidth,animation:objectReticle.animationName}}};
 setTimeout(function(){var legacyStyle=document.getElementById('v174-cardless-battle-style');var result={viewport:{width:${width},height:${height}},scenarios:scenarios,allyScenarios:allyScenarios,splitAlly:splitAlly,collapsedDrawer:collapsedDrawer,expandedDrawer:expandedDrawer,turnUi:turnUi,artwork:artwork,beforeDeath:beforeDeath,afterDeath:afterDeath,targetSlot:targetSlot,targetRect:targetRect,boss:bossEvidence,legacyStyle:{owner:legacyStyle&&legacyStyle.dataset.geometryOwner,textLength:legacyStyle?legacyStyle.textContent.length:-1},popup:{damage:{slot:damage&&damage.dataset.slot,kind:damage&&damage.dataset.popupKind,left:damage&&damage.style.left,top:damage&&damage.style.top,fontSize:damage&&damage.style.fontSize},critical:{slot:critical&&critical.dataset.slot,kind:critical&&critical.dataset.popupKind,left:critical&&critical.style.left,top:critical&&critical.style.top,fontSize:critical&&critical.style.fontSize},heal:{slot:heal&&heal.dataset.slot,kind:heal&&heal.dataset.popupKind,left:heal&&heal.style.left,top:heal&&heal.style.top,fontSize:heal&&heal.style.fontSize},miss:{slot:miss&&miss.dataset.slot,kind:miss&&miss.dataset.popupKind,left:miss&&miss.style.left,top:miss&&miss.style.top,fontSize:miss&&miss.style.fontSize}},stageOverflow:getComputedStyle(stage).overflow,pageScroll:{width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,clientWidth:document.documentElement.clientWidth,clientHeight:document.documentElement.clientHeight},enemySlots:document.querySelectorAll('.v-fixed-enemy-slot').length,allySlots:document.querySelectorAll('.v-fixed-ally-slot').length,legacyClasses:{enemy:document.getElementById('battleMonsterArea').className,ally:document.getElementById('battlePlayerRow').className}};document.getElementById('result').textContent=JSON.stringify(result);},40);
})();
</script></body></html>`;
}

function close(a,b,label,tolerance=.5){assert.ok(Math.abs(a-b)<=tolerance,`${label}: ${a} != ${b}`);}
function runViewport(chrome,width,height){
    fs.writeFileSync(FIXTURE,fixtureHtml(width,height),"utf8");
    const fileUrl="file://"+FIXTURE.replace(/\\/g,"/");
    const result=spawnSync(chrome,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--force-device-scale-factor=1",`--window-size=${width},${height}`,"--virtual-time-budget=1200","--dump-dom",fileUrl],{encoding:"utf8",timeout:30000,maxBuffer:24*1024*1024});
    assert.equal(result.status,0,result.stderr||`browser fixture failed ${width}x${height}`);
    const match=result.stdout.match(/<pre id="result"[^>]*>([\s\S]*?)<\/pre>/);assert.ok(match,`missing QA result ${width}x${height}`);const data=JSON.parse(decode(match[1]));assert.ok(!data.fixtureError,data.fixtureError);
    if(width===412&&height===915){
        const screenshot=path.join(ARTIFACT_DIR,"boss-battle-convergence-412x915.png");
        const shot=spawnSync(chrome,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--force-device-scale-factor=1",`--window-size=${width},${height}`,"--virtual-time-budget=1200",`--screenshot=${screenshot}`,fileUrl],{encoding:"utf8",timeout:30000,maxBuffer:8*1024*1024});
        assert.equal(shot.status,0,shot.stderr||"Boss mobile screenshot failed");
        assert.ok(fs.existsSync(screenshot),"Boss mobile screenshot evidence missing");
    }
    assert.equal(data.enemySlots,10);assert.equal(data.allySlots,6);
    assert.equal(data.legacyStyle.owner,null);assert.equal(data.legacyStyle.textLength,-1,"legacy runtime geometry style must be removed rather than kept as an override");
    assert.doesNotMatch(data.legacyClasses.enemy,/battle-monsters|v131-formation|v141-fixed-formation/);assert.doesNotMatch(data.legacyClasses.ally,/battle-player-row/);
    const baseline=data.scenarios[1].lower;
    assert.ok(baseline.enemy.bottom<=baseline.center.top+.5,"enemy region must end before the center operation region");
    assert.ok(baseline.center.bottom<=baseline.allyRegion.top+.5,"center operation region must end before the ally region");
    assert.ok(baseline.action.top>=baseline.center.top-.5&&baseline.action.bottom<=baseline.center.bottom+.5,"action controls stay inside the center region");
    assert.equal(baseline.centerBackground,"none","center controls must not own a black translucent background");
    assert.ok(data.collapsedDrawer.toggle.top>=baseline.allyRegion.bottom-35&&data.collapsedDrawer.toggle.bottom<=baseline.allyRegion.bottom+.5,"collapsed drawer exposes its complete 32px touch handle above the bottom edge");
    assert.ok(data.collapsedDrawer.info.top>=baseline.allyRegion.bottom-.5,"collapsed battle log must stay below the battlefield");
    assert.ok(data.expandedDrawer.region.bottom<=baseline.allyRegion.bottom+.5,"expanded drawer stays anchored to the battlefield bottom");
    assert.ok(data.expandedDrawer.info.top<data.expandedDrawer.info.bottom&&data.expandedDrawer.info.bottom<=baseline.allyRegion.bottom+.5,"expanded battle log must slide fully into view");
    assert.equal(data.collapsedDrawer.handleText,"戰鬥資訊","battle info handle uses horizontal text");
    assert.equal(data.collapsedDrawer.turnOpacity,"1","collapsed drawer shows current round");
    assert.equal(data.expandedDrawer.turnOpacity,"0","expanded drawer hides duplicate round label");
    assert.equal(data.turnUi.normal.opacity,"1");
    assert.equal(data.turnUi.normal.pointerEvents,"none","turn timer must never block target selection");
    assert.equal(data.turnUi.skillPicker.opacity,"0.25");
    assert.equal(data.turnUi.itemPicker.opacity,"0.25");
    assert.equal(data.turnUi.targetSelecting.opacity,"0.25");
    assert.equal(data.turnUi.targetSelecting.pointerEvents,"none");
    assert.ok(data.turnUi.normal.rect.bottom<=baseline.action.bottom+.5&&data.turnUi.normal.rect.top>=baseline.action.top-.5,"turn timer stays inside the action panel above commands");
    close(baseline.elementBox.width,66,"element box width");close(baseline.elementBox.height,66,"element box height");
    for(const count of [1,3,5,6,8,10]){const scenario=data.scenarios[count];assert.equal(scenario.slots,10);close(scenario.lower.enemy.height,baseline.enemy.height,`enemy region height count ${count}`);close(scenario.lower.center.height,baseline.center.height,`center region height count ${count}`);close(scenario.lower.ally.top,baseline.ally.top,`ally top count ${count}`);close(scenario.lower.middle.top,baseline.middle.top,`middle top count ${count}`);close(scenario.lower.action.top,baseline.action.top,`action top count ${count}`);scenario.unitRects.forEach(function(rect){close(rect.width,scenario.unitRects[0].width,`enemy card width count ${count}`);close(rect.height,scenario.unitRects[0].height,`enemy card height count ${count}`);assert.ok(rect.bottom<=scenario.lower.enemy.bottom+.5,`enemy card stays above center count ${count}`);});for(const shape of ["single","tri","row","column","all"]){close(scenario[shape].width,data.scenarios[1][shape].width,`${shape} width count ${count}`);close(scenario[shape].height,data.scenarios[1][shape].height,`${shape} height count ${count}`);close(scenario[shape].centerX,(scenario[shape].left+scenario[shape].right)/2,`${shape} centerX count ${count}`);close(scenario[shape].centerY,(scenario[shape].top+scenario[shape].bottom)/2,`${shape} centerY count ${count}`);}}
    const allyBaseline=data.allyScenarios[1].lower;for(const count of [1,2,3,4,5,6]){const scenario=data.allyScenarios[count];assert.equal(scenario.slots,6);close(scenario.lower.ally.height,allyBaseline.ally.height,`ally zone height party ${count}`);close(scenario.lower.action.top,allyBaseline.action.top,`action top party ${count}`);scenario.unitRects.forEach(function(rect,index){close(rect.width,scenario.unitRects[0].width,`ally card width party ${count}`);close(rect.height,scenario.unitRects[0].height,`ally card height party ${count}`);assert.ok(rect.top>=scenario.lower.allyRegion.top-.5,`ally card stays below center party ${count}`);assert.ok(rect.bottom<=scenario.lower.allyRegion.bottom+.5,`ally card stays inside ally region party ${count}`);scenario.unitRects.slice(index+1).forEach(other=>assert.ok(rect.right<=other.left+.5||other.right<=rect.left+.5||rect.bottom<=other.top+.5||other.bottom<=rect.top+.5,`ally cards overlap party ${count}`));});scenario.hudRects.forEach(function(hud){assert.ok(hud.art.bottom<=hud.hp.top+.5,`ally art/HP overlap party ${count}`);assert.ok(hud.hp.bottom<=hud.sp.top+.5,`ally HP/SP overlap party ${count}`);assert.ok(hud.sp.bottom<=hud.name.top+.5,`ally SP/name overlap party ${count}`);assert.equal(hud.logicalHp,11);assert.equal(hud.logicalSp,11);});}assert.equal(data.splitAlly.assigned[1],"ALLY_B2");close(data.splitAlly.lower.ally.height,allyBaseline.ally.height,"split front/back ally zone height");
    assert.ok(data.scenarios[3].unitRects[0].height>100,"enemy cards are visibly taller than the previous 92px owner");
    assert.ok(data.allyScenarios[3].unitRects[0].height>116,"ally cards are visibly taller than the previous 86px owner");
    close(data.beforeDeath.e2.left,data.afterDeath.e2.left,"death must not move right unit");close(data.beforeDeath.e2.top,data.afterDeath.e2.top,"death must not move right unit vertically");
    for(const [kind,art] of Object.entries(data.artwork)){assert.equal(art.backgroundSize,"contain",`${kind} artwork must use contain`);assert.equal(art.overflow,"visible",`${kind} artwork overflow`);assert.equal(art.contain,"none",`${kind} artwork contain`);assert.equal(art.clipChain.some(entry=>/hidden|clip/.test(entry.overflow)||/hidden|clip/.test(entry.overflowX)||/hidden|clip/.test(entry.overflowY)),false,`${kind} artwork has clipping ancestor`);}
    for(const kind of ["damage","critical","heal","miss"]){assert.equal(data.popup[kind].slot,data.targetSlot,`${kind} slot anchor`);assert.ok(data.popup[kind].left&&data.popup[kind].top,`${kind} position`);}assert.equal(data.popup.critical.fontSize,"20px");assert.equal(data.popup.damage.fontSize,"18px");assert.equal(data.popup.heal.kind,"heal");assert.equal(data.popup.miss.kind,"miss");
    assert.equal(data.stageOverflow,"visible");
    close(data.boss.footprint.left,data.boss.card.left,"Boss card left fills six-Slot footprint");close(data.boss.footprint.right,data.boss.card.right,"Boss card right fills six-Slot footprint");close(data.boss.footprint.top,data.boss.card.top,"Boss card top fills six-Slot footprint");close(data.boss.footprint.bottom,data.boss.card.bottom,"Boss card bottom fills six-Slot footprint");
    assert.equal(data.boss.bossCount,1,"Boss must remain one DOM target");assert.equal(data.boss.slots,"ENEMY_B2 ENEMY_B3 ENEMY_B4 ENEMY_F2 ENEMY_F3 ENEMY_F4");assert.equal(data.boss.cardless,true,"Boss-side dynamic Units must be cardless immediately");assert.equal(data.boss.pointerEvents,"auto");assert.equal(data.boss.background,"none");
    assert.equal(data.boss.hud.hpPosition,"absolute","Boss HP must escape the V154 relative HUD rule");assert.equal(data.boss.hud.spPosition,"absolute","Boss SP must escape the V154 relative HUD rule");assert.equal(data.boss.hud.hpDisplay,"block");assert.equal(data.boss.hud.spDisplay,"block");assert.equal(data.boss.hud.hp.height,11);assert.equal(data.boss.hud.sp.height,11);assert.ok(data.boss.hud.hp.bottom<=data.boss.hud.sp.top+1,"Boss HP must sit above SP");assert.ok(data.boss.hud.sp.bottom<=data.boss.hud.name.top+1,"Boss SP must sit above the name");
    data.boss.reinforcements.concat(data.boss.objects).forEach(function(side){assert.ok(side.card.right<=data.boss.footprint.left+.5||side.card.left>=data.boss.footprint.right-.5,"Boss side Unit must not invade central footprint");assert.ok(side.art.right<=data.boss.art.left+.5||side.art.left>=data.boss.art.right-.5,"Boss side artwork must not overlap Boss artwork");});
    [data.boss.reinforcements[0],data.boss.objects[0]].forEach(function(side){assert.ok(side.art.centerX<=side.card.centerX-6,"left Boss-side artwork must visibly shift outward");});
    [data.boss.reinforcements[1],data.boss.objects[1]].forEach(function(side){assert.ok(side.art.centerX>=side.card.centerX+6,"right Boss-side artwork must visibly shift outward");});
    assert.equal(data.boss.reticles.boss.content,'""');assert.equal(data.boss.reticles.object.content,'""');assert.equal(data.boss.reticles.boss.border,"3px");assert.equal(data.boss.reticles.object.border,"3px");assert.match(data.boss.reticles.boss.animation,/v174TargetReticlePulse/);assert.match(data.boss.reticles.object.animation,/v174TargetReticlePulse/);
    assert.ok(data.pageScroll.width<=data.pageScroll.clientWidth+1,`horizontal page scroll ${width}x${height}`);assert.ok(data.pageScroll.height<=data.pageScroll.clientHeight+1,`vertical page scroll ${width}x${height}`);return data;
}

fs.mkdirSync(ARTIFACT_DIR,{recursive:true});
try{
    const chrome=findChrome();const results=VIEWPORTS.map(([width,height])=>runViewport(chrome,width,height));
    const evidence={suite:"fixed-slot-battlefield-rendering-v2",passed:true,viewports:results.map(item=>item.viewport),checks:{threeStructuralRegions:true,centerControlsIsolated:true,centerBackgroundRemoved:true,bottomBattleInfoDrawer:true,drawerCollapsedAndExpanded:true,largeElementBox:true,enemyCounts:[1,3,5,6,8,10],allyCounts:[1,2,3,4,5,6],equalEnemyCardGeometry:true,equalAllyCardGeometry:true,sixAllyNoOverlap:true,enlargedUnitCards:true,splitAllyFormation:true,deathDoesNotCompress:true,bossSingleEntity:true,bossSixSlotFootprint:true,bossHudAnchored:true,bossSideUnits:["ENEMY_B1","ENEMY_B5","ENEMY_F1","ENEMY_F5"],bossSideUnitsDoNotOverlap:true,bossSideArtworkSeparated:true,bossSideArtworkShiftedOutward:true,bossAndObjectReticles:true,dynamicCardlessImmediate:true,vfxShapes:["single","tri","row","column","all"],vfxCenterUsesGeometry:true,vfxScaleStable:true,artworkKinds:["player","regular","elite","boss","abyss"],artworkNoBattlefieldClip:true,popupKinds:["damage","critical","heal","miss"],popupUsesSlotAnchor:true,legacyRuntimeGeometryNeutralized:true,noPageScroll:true},results};
    fs.writeFileSync(path.join(ARTIFACT_DIR,"fixed-slot-battlefield-rendering-v2.json"),JSON.stringify(evidence,null,2)+"\n","utf8");console.log("Fixed Slot Battlefield Rendering V2 mobile browser QA passed:",VIEWPORTS.map(v=>v.join("x")).join(", "));
}finally{try{fs.unlinkSync(FIXTURE);}catch(_){}}
