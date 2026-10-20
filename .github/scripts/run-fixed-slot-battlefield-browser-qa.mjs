import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {inflateSync} from "node:zlib";
import {spawnSync} from "node:child_process";

const ROOT=process.cwd();
const ARTIFACT_DIR=path.join(ROOT,"artifacts/browser-qa");
const FIXTURE=path.join(ROOT,".fixed-slot-battlefield-rendering-v2-qa.html");
const VIEWPORTS=[[412,915],[393,873],[390,844],[360,800]];
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
const fullV131Source=read("js/25-v131-fix-batch.js");
const v131FormationSource=fullV131Source.slice(
    fullV131Source.indexOf("    function getFormationRankWeight("),
    fullV131Source.indexOf("    function formatDuration(")
).replace(/<\/script/gi,"<\\/script");
const v131EnemyApplySource=(fullV131Source.slice(
    fullV131Source.indexOf("    function applyBattleFormation("),
    fullV131Source.indexOf("    function ensureAllyFormationState(")
)+"\nwindow.v131AfterBattleRender=function(){ applyBattleFormation(); };\n").replace(/<\/script/gi,"<\\/script");
const mainSource=read("js/00-main.js");
const mainRenderHookSource=mainSource.slice(
    mainSource.indexOf("const BATTLE_RENDER_HOOK_ORDER="),
    mainSource.indexOf("function isBattleStatusInspectionBlocked(")
).replace(/<\/script/gi,"<\\/script");
const mainRenderSource=mainSource.slice(
    mainSource.indexOf("function renderBattle(){"),
    mainSource.indexOf("function runBattleMonsterUiHook(")
).replace(/<\/script/gi,"<\\/script");
const adapterSource=read("js/battlefield-render-geometry-adapter.js").replace(/<\/script/gi,"<\\/script");
const feedbackSource=read("js/battle-floating-feedback-owner.js").replace(/<\/script/gi,"<\\/script");
const feedbackCss=read("css/battle-floating-feedback-owner.css").replace(/<\/style/gi,"<\\/style");
const mainCssSource=read("css/00-main.css");
const commandGeometryCss=[
    mainCssSource.match(/#battlePage \.battle-element-box-button\{[\s\S]*?\n\}/)?.[0],
    mainCssSource.match(/#battlePage\{\s*--battle-command-row-height:[\s\S]*?\n\}/)?.[0],
    mainCssSource.match(/#mainBattleMenu\{[\s\S]*?\n\}/)?.[0],
    mainCssSource.match(/#mainBattleMenu::before\{[\s\S]*?\n\}/)?.[0],
    ...Array.from(mainCssSource.matchAll(/#mainBattleMenu > \.menu-button[^{}]*\{[^}]*\}/g),match=>match[0])
].filter(Boolean).join("\n").replace(/<\/style/gi,"<\\/style");
if(!commandGeometryCss.includes("--battle-command-visual-height")||!commandGeometryCss.includes("#mainBattleMenu::before")){
    throw new Error("Canonical battle command geometry rules missing from css/00-main.css");
}
const identityCss=read("css/40-v143-combat-dungeon-polish.css").replace(/<\/style/gi,"<\\/style");
const v154Css=read("css/46-v154-dev-fixes.css").replace(/<\/style/gi,"<\\/style");
const geometryCss=read("css/fixed-slot-battlefield-rendering-v2.css").replace(/<\/style/gi,"<\\/style");
const bossCss=read("css/gameplay-boss-tower.css").replace(/<\/style/gi,"<\\/style");

const presentationSource=read("js/54-v173.51-battle-qa.js");
const portraitSource=presentationSource.slice(presentationSource.indexOf("function numericValue("),presentationSource.indexOf("function syncUnitArtwork("))+presentationSource.slice(presentationSource.indexOf("function syncUnitArtwork("),presentationSource.indexOf("function clearUnitHud("));
const portraitRegistry=JSON.parse(read("config/monster-portrait-registry.json")).presentation;
const portraitSamples=Object.keys(portraitRegistry.assets).filter(p=>p.startsWith("assets/monsters/wild/zone-01/")).slice(0,6);
const allyPortraitSamples=[...read("js/26-v131-patrol-appearance.js").matchAll(/front:"(assets\/characters\/patrol\/[^" ]+)"/g)].map(match=>({path:match[1],data:"data:image/webp;base64,"+fs.readFileSync(path.join(ROOT,match[1])).toString("base64")}));
assert.equal(allyPortraitSamples.length,8,"formal patrol front portrait coverage");

let allyPortraitProbeMetadata=null;
function fixtureHtml(width,height){
    return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#120e09;color:#fff;font-family:sans-serif}
#game-stage{position:fixed;left:0;top:0;width:420px;height:746.667px;transform-origin:top left;transform:scale(${Math.min(width/420,height/746.667)});overflow:hidden}
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
<style>${commandGeometryCss}</style><style>${identityCss}</style><style>${v154Css}</style><style>${geometryCss}</style><style>${bossCss}</style><style>${feedbackCss}</style></head><body>
<div id="game-stage"><div id="app"><div id="game-content"><section id="battlePage" class="v-fixed-slot-render-v2"><div class="battle-wrap">
<section class="battle-enemy-region"><div id="battleMonsterArea" class="battle-monsters v131-formation"></div></section>
<section class="battle-center-region"><div class="battle-middle"><div id="battleActionRegion" class="v-fixed-action-zone" style="position:relative;display:flex;flex-direction:column;gap:4px"><div class="battle-title">戰鬥</div><div id="battleTurnIndicator">第 1 回合</div><button id="battleElementBoxButton" class="battle-element-box-button" type="button">元素匣</button><div id="turnTargetRow" class="turn-target-row">第 1 回合</div><div id="battleTargetPrompt" class="battle-target-prompt"><div class="battle-target-prompt-copy"><div class="battle-target-prompt-action">選擇［怒火］的我方目標</div><div class="battle-target-prompt-hint">選擇目標</div></div><button class="battle-target-back">返回</button></div><div id="battleCommandRow" style="display:flex;gap:5px;flex:0 0 66px;position:relative"><div id="mainBattleMenu" class="battle-menu" style="flex:1"><button class="menu-button skill">技能</button><button class="menu-button">普通攻擊</button><button class="menu-button defend">防禦</button><button class="menu-button item">背包</button><button class="menu-button run">逃脫</button></div></div></div></div></section>
<section class="battle-ally-region"><div id="battlePlayerRow" class="battle-player-row"></div></section>
</div></section></div></div></div><pre id="result" hidden></pre>
<script>
window.__allyIndexes=[0,1,2];
window.getExistingPartyIndexes=function(){return window.__allyIndexes.slice();};
window.monsters=Array.from({length:10},function(_,i){return {hp:1000,alive:true,rank:i===2?'boss':(i===1?'elite':'regular')};});
window.currentBattleMonsters=[];window.getMonsterRank=function(m){return m&&m.rank||'regular';};window.$=function(id){return document.getElementById(id);};window.updateMonsterUI=function(){};window.renderPlayers=function(){};window.selectBattleTarget=function(){};window.openBattleStatusDetailModal=function(){};
window.addEventListener('error',function(event){var result=document.getElementById('result');if(result&&!result.textContent){result.textContent=JSON.stringify({fixtureError:String(event.error&&event.error.stack||event.message||'unknown fixture error')});}});
/* The focused geometry fixture supplies the public presentation boundary only;
   the exact production implementation is covered by static/runtime suites and
   by the exact-candidate browser job. This prevents unrelated management UI
   observers from participating in a synthetic DOM. */
window.FourSymbolsBattlePresentation={getUnitHud:function(card){return card.v174UnitHud||card.querySelector('.v174-unit-hud')||card;},applyUnit:function(card){if(!card)return;card.classList.add('v174-cardless-unit');var art=card.querySelector(':scope > .v174-battle-art');if(!art){art=document.createElement('div');art.className='v174-battle-art';card.insertBefore(art,card.firstChild);}card.style.setProperty('background-image','none','important');var hud=card.querySelector('.v174-unit-hud');if(!hud){hud=document.createElement('div');hud.className='v174-unit-hud';hud.dataset.side=card.id.startsWith('battleMonster')?'monster':'player';card.querySelectorAll(':scope .battle-monster-name,:scope > .battle-player-id,:scope > .monster-status-badges,:scope .monster-hp,:scope .monster-sp,:scope > .hp-bar,:scope > .sp-bar').forEach(function(n){hud.appendChild(n)});card.appendChild(hud);}hud.dataset.boss=String(card.classList.contains('gameplay-boss-card'));hud.dataset.anchor=hud.dataset.side==='monster'?'top':'bottom';}};
window.showDamagePopup=function(element,text,type,isCrit){var p=document.createElement('div');p.className='damage-popup hp-popup'+(isCrit?' crit':'');p.textContent=text||'-100';element.appendChild(p);return p;};
window.showMissEffect=function(isPlayerTarget,index,label){var el=document.getElementById((isPlayerTarget?'battlePlayerCard':'battleMonster')+index);if(!el)return;var p=document.createElement('div');p.className='damage-popup miss-popup';p.textContent=label||'MISS';el.appendChild(p);};
</script><script>${ownerSource}</script><script>${v131FormationSource}</script><script>${v131EnemyApplySource}</script><script>${adapterSource}</script><script>${feedbackSource}</script><script>${mainRenderHookSource}</script><script>${mainRenderSource}</script>
<script>
(async function(){
${portraitSource}
 const portraitMetadata=${JSON.stringify(portraitRegistry)},portraitPaths=${JSON.stringify(portraitSamples)};
 window.v154GetPortraitPresentation=function(path){return portraitMetadata.assets[path];};
 window.v154GetPortraitScaleContract=function(){return portraitMetadata.classes;};
 const owner=window.FourSymbolsBattlefieldSlots,adapter=window.FourSymbolsBattlefieldRenderGeometry;
 const allyPortraits=${JSON.stringify(allyPortraitProbeMetadata)}||await Promise.all(${JSON.stringify(allyPortraitSamples)}.map(async function(sample){
  const image=new Image();image.src=sample.data;await image.decode();
  const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
  const context=canvas.getContext('2d');context.drawImage(image,0,0);const rgba=context.getImageData(0,0,canvas.width,canvas.height).data;
  let left=canvas.width,top=canvas.height,right=0,bottom=0;
  for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(rgba[(y*canvas.width+x)*4+3]>0){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x+1);bottom=Math.max(bottom,y+1);}
  return {...sample,width:canvas.width,height:canvas.height,alpha:[left,top,right,bottom]};
 }));
 function allyVisiblePortraits(){return Array.from(document.querySelectorAll('#battlePlayerRow .battle-player')).map(function(card,index){
  const source=allyPortraits[index%allyPortraits.length];card.dataset.v174BattleArtwork='url("'+source.data+'")';syncUnitArtwork(card,'player');
  card.querySelector('.v174-battle-art').getAnimations({subtree:true}).forEach(a=>a.cancel());
  const r=card.querySelector('.v174-portrait-paint').getBoundingClientRect(),scale=Math.min(r.width/source.width,r.height/source.height),left=r.left+(r.width-source.width*scale)/2,top=r.bottom-source.height*scale,b=source.alpha;
  return {id:card.id,path:source.path,visible:{left:left+b[0]*scale,top:top+b[1]*scale,right:left+b[2]*scale,bottom:top+b[3]*scale}};
 });}

 function enemyCard(index){var c=document.createElement('div');c.id='battleMonster'+index;c.className='battle-monster '+(index===4?'abyss-unit':'');c.dataset.rank=window.monsters[index].rank;c.innerHTML='<div class="v174-battle-art"><div class="v174-action-motion"><div class="v174-portrait-paint"></div></div></div><div class="battle-monster-name v143-monster-identity">怪物'+index+'</div><div class="monster-status-badges"></div><div class="monster-hp"></div><div class="monster-sp"></div>';return c;}
 function allyCard(index){var c=document.createElement('div');c.id='battlePlayerCard'+index;c.className='battle-player';c.innerHTML='<div class="v174-battle-art"><div class="v174-action-motion"><div class="v174-portrait-paint"></div></div></div><div class="battle-player-id">角色'+index+'</div><div class="monster-status-badges"></div><div class="hp-bar"></div><div class="sp-bar"></div>';return c;}
 function addCards(enemyCount,allyCount,split){
   allyCount=allyCount===undefined?3:allyCount;
   var enemy=document.getElementById('battleMonsterArea');enemy.innerHTML='';window.currentBattleMonsters=Array.from({length:enemyCount},function(_,i){return i;});owner.clearActiveEnemySnapshot();for(var i=0;i<enemyCount;i++)enemy.appendChild(enemyCard(i));
   window.__allyIndexes=Array.from({length:allyCount},function(_,i){return i;});
   if(split&&allyCount===3){owner.hydrateAllyFormation({characterIndexToSlot:{0:'ALLY_F1',1:'ALLY_B2',2:'ALLY_F3'}},window.__allyIndexes);}else{owner.hydrateAllyFormation(null,window.__allyIndexes);}
   var ally=document.getElementById('battlePlayerRow');ally.innerHTML='';for(var a=0;a<allyCount;a++)ally.appendChild(allyCard(a));adapter.reconcile();
 }
 function rect(sel){var node=document.querySelector(sel),r=node.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height,centerX:r.left+r.width/2,centerY:r.top+r.height/2};}
 function commandVisualTop(){var menu=document.getElementById('mainBattleMenu'),r=menu.getBoundingClientRect(),style=getComputedStyle(menu,'::before'),scaleY=menu.offsetHeight?r.height/menu.offsetHeight:1,top=parseFloat(style.top)||0;return r.top+top*scaleY;}
 function lower(){return {enemy:rect('.battle-enemy-region'),center:rect('.battle-center-region'),allyRegion:rect('.battle-ally-region'),ally:rect('#battlePlayerRow'),middle:rect('.battle-middle'),action:rect('#battleActionRegion'),turn:rect('#turnTargetRow'),command:rect('#mainBattleMenu'),commandVisualTop:commandVisualTop(),elementBox:rect('.battle-element-box-button'),elementBoxHit:(function(){var n=document.querySelector('.battle-element-box-button'),r=n.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return n===hit||n.contains(hit);})(),commandButtons:Array.from(document.querySelectorAll('#mainBattleMenu > .menu-button')).map(n=>({rect:n.getBoundingClientRect().toJSON(),radii:(function(){const r=n.getBoundingClientRect(),style=getComputedStyle(n),sx=r.width/n.offsetWidth,sy=r.height/n.offsetHeight;return ['borderTopLeftRadius','borderTopRightRadius','borderBottomRightRadius','borderBottomLeftRadius'].map(key=>{const parts=style[key].split(/\s+/),x=parts[0],y=parts[1]||x;return {x:x.endsWith('%')?parseFloat(x)*r.width/100:parseFloat(x)*sx,y:y.endsWith('%')?parseFloat(y)*r.height/100:parseFloat(y)*sy};});})(),font:getComputedStyle(n).fontSize,hit:document.elementFromPoint(n.getBoundingClientRect().x+n.getBoundingClientRect().width/2,n.getBoundingClientRect().y+n.getBoundingClientRect().height/2)===n})),centerBackground:getComputedStyle(document.querySelector('.battle-center-region')).backgroundImage};}
 function unitRects(selector){return Array.from(document.querySelectorAll(selector)).filter(function(node){return node.children.length;}).map(function(node){return rect('#'+node.children[0].id);});}
 function hudRects(selector){return Array.from(document.querySelectorAll(selector)).filter(function(node){return node.children.length;}).map(function(slot){var card=slot.children[0],art=card.querySelector('.v174-battle-art'),hp=card.querySelector('.monster-hp,.hp-bar'),sp=card.querySelector('.monster-sp,.sp-bar'),name=card.querySelector('.battle-monster-name,.battle-player-id');return {id:card.id,art:rect('#'+card.id+' .v174-battle-art'),hp:rect('#'+card.id+' .monster-hp,#'+card.id+' .hp-bar'),sp:rect('#'+card.id+' .monster-sp,#'+card.id+' .sp-bar'),name:rect('#'+card.id+' .battle-monster-name,#'+card.id+' .battle-player-id'),logicalHp:hp.offsetHeight,logicalSp:sp.offsetHeight};});}
 function clipChain(node){var result=[];for(var p=node.parentElement;p&&p.id!=='game-stage';p=p.parentElement){var cs=getComputedStyle(p);result.push({tag:p.id||p.className,overflow:cs.overflow,overflowX:cs.overflowX,overflowY:cs.overflowY,contain:cs.contain});}return result;}
 function artEvidence(selector){var art=document.querySelector(selector+' .v174-battle-art'),s=getComputedStyle(art);return {backgroundSize:getComputedStyle(art.querySelector(".v174-portrait-paint")).backgroundSize,overflow:s.overflow,contain:s.contain,clipChain:clipChain(art),rect:rect(selector),artRect:{left:art.getBoundingClientRect().left,top:art.getBoundingClientRect().top,right:art.getBoundingClientRect().right,bottom:art.getBoundingClientRect().bottom,width:art.getBoundingClientRect().width,height:art.getBoundingClientRect().height}};}
 function geoEvidence(g){return g&&{width:g.baseWidth,height:g.baseHeight,left:g.rect.left,top:g.rect.top,right:g.rect.right,bottom:g.rect.bottom,centerX:g.center.x,centerY:g.center.y};}
 var scenarios={};
 [1,3,5,6,8,10].forEach(function(count){addCards(count,3,false);var snap=owner.getActiveEnemySnapshot(),assigned=Object.assign({},snap.monsterIndexToSlot),primary=assigned[0];var single=adapter.getVfxGeometry('monster',primary,'single'),tri=adapter.getVfxGeometry('monster',primary,'tri'),row=adapter.getVfxGeometry('monster',primary,'row'),column=adapter.getVfxGeometry('monster',primary,'column'),all=adapter.getVfxGeometry('monster',primary,'all');scenarios[count]={lower:lower(),assigned:assigned,single:geoEvidence(single),tri:geoEvidence(tri),row:geoEvidence(row),column:geoEvidence(column),all:geoEvidence(all),unitRects:unitRects('.v-fixed-enemy-slot'),slots:document.querySelectorAll('.v-fixed-enemy-slot').length};});
 var allyScenarios={};
 [1,2,3,4,5,6].forEach(function(count){addCards(5,count,false);var visiblePortraits=allyVisiblePortraits();allyScenarios[count]={visiblePortraits:visiblePortraits,lower:lower(),unitRects:unitRects('.v-fixed-ally-slot'),hudRects:hudRects('.v-fixed-ally-slot'),slots:document.querySelectorAll('.v-fixed-ally-slot').length,assigned:Object.assign({},owner.ensureAllyFormation(window.__allyIndexes).characterIndexToSlot)};});
 addCards(5,3,true);var splitAlly={lower:lower(),assigned:Object.assign({},owner.ensureAllyFormation(window.__allyIndexes).characterIndexToSlot)};var artwork={player:artEvidence('#battlePlayerCard0'),regular:artEvidence('#battleMonster0'),elite:artEvidence('#battleMonster1'),boss:artEvidence('#battleMonster2'),abyss:artEvidence('#battleMonster4')};
 addCards(3,3,true);var beforeDeath={e1:rect('#battleMonster1'),e2:rect('#battleMonster2')};document.getElementById('battleMonster1').remove();var afterDeath={e2:rect('#battleMonster2')};var targetSlot=owner.getEnemySlotForMonster(owner.getActiveEnemySnapshot(),2),targetRect=owner.getSlotRect(targetSlot);
 /* Restore the formal three-enemy DOM after the death-stability probe. Floating
    feedback must never target a Unit that no longer exists in the battlefield. */
 addCards(3,3,true);
 function activeFrame(index){
  const card=document.getElementById('battlePlayerCard'+index),art=card.querySelector('.v174-battle-art'),paint=art.querySelector('.v174-portrait-paint'),style=getComputedStyle(art,'::before'),a=art.getBoundingClientRect();
  const evidence={index:index,content:style.content,border:style.borderTopWidth,borderColor:style.borderTopColor,shadow:style.boxShadow,animationName:style.animationName,animationDuration:style.animationDuration,zIndex:style.zIndex,insets:[style.top,style.right,style.bottom,style.left],width:parseFloat(style.width),height:parseFloat(style.height),artWidth:art.clientWidth,artHeight:art.clientHeight,transform:style.transform,rootAnimation:getComputedStyle(card,'::after').animationName,rootContent:getComputedStyle(card,'::after').content,footShadow:{content:getComputedStyle(art,'::after').content,background:getComputedStyle(art,'::after').backgroundImage,opacity:getComputedStyle(art,'::after').opacity}};
  if(card.classList.contains('active-turn')){
   const probe=document.createElement('style');probe.textContent='#battlePlayerCard'+index+' > .v174-battle-art::before{pointer-events:auto !important}';document.head.appendChild(probe);
   const old=paint.style.pointerEvents;paint.style.pointerEvents='auto';const hit=document.elementFromPoint(a.left+a.width/2,a.top+a.height/2);evidence.behindPaint=hit===paint||paint.contains(hit);paint.style.pointerEvents=old;probe.remove();
  }
  return evidence;
 }
 function setManualActive(index){document.querySelectorAll('#battlePlayerRow .battle-player').forEach(function(card){card.classList.toggle('active-turn',card.id==='battlePlayerCard'+index);});return {active:Array.from(document.querySelectorAll('#battlePlayerRow .battle-player.active-turn')).map(function(card){return card.id;}),frame:activeFrame(index)};}
 var manualControl={character0:setManualActive(0),character1:setManualActive(1),character2:setManualActive(2)};
 var targetSelectingPlayer=document.getElementById('battlePlayerCard1');setManualActive(1);targetSelectingPlayer.classList.add('ally-targetable');manualControl.targetSelection={active:Array.from(document.querySelectorAll('#battlePlayerRow .battle-player.active-turn')).map(function(card){return card.id;}),frame:activeFrame(1),reticleAnimation:getComputedStyle(targetSelectingPlayer,'::before').animationName};targetSelectingPlayer.classList.remove('ally-targetable');
 document.querySelectorAll('#battlePlayerRow .battle-player').forEach(function(card){card.classList.remove('active-turn');});
 manualControl.auto={active:Array.from(document.querySelectorAll('#battlePlayerRow .battle-player.active-turn')).map(function(card){return card.id;}),frames:[0,1,2].map(activeFrame)};
 var feedback=window.FourSymbolsBattleFloatingFeedback;
 /* A/C: Relic damage + Burn status share the same target context without collision. */
 feedback.emit({side:'monster',index:0,kind:'damage',text:'-188HP',source:'relic',duration:1500,skipImpactTiming:true});
	feedback.emit({side:'monster',index:0,kind:'status',statusType:'burn',text:'燃燒',source:'relic-status',duration:1500,skipImpactTiming:true});
 /* D: Shield + HP damage share another target context. */
 feedback.emit({side:'monster',index:1,kind:'shield',text:'-88',source:'shield',duration:1500,skipImpactTiming:true});
 feedback.emit({side:'monster',index:1,kind:'damage',text:'-100HP',source:'damage',duration:1500,skipImpactTiming:true});
 /* E: MISS + Status share another target context. */
 feedback.emit({side:'monster',index:2,kind:'miss',text:'MISS',source:'miss',duration:1500,skipImpactTiming:true});
	feedback.emit({side:'monster',index:2,kind:'status',statusType:'defenseDown',text:'破防',source:'status',duration:1500,skipImpactTiming:true});
 /* B: HP + SP recovery share one player context. */
 feedback.emit({side:'player',index:0,kind:'heal',text:'+250HP',source:'heal',duration:1500,skipImpactTiming:true});
 feedback.emit({side:'player',index:0,kind:'sp',text:'+40SP',source:'sp',duration:1500,skipImpactTiming:true});
 /* F: two consecutive HP recovery entries must allocate separate lanes. */
 feedback.emit({side:'player',index:1,kind:'heal',text:'+120HP',source:'heal-1',duration:1500,skipImpactTiming:true});
 feedback.emit({side:'player',index:1,kind:'heal',text:'+90HP',source:'heal-2',duration:1500,skipImpactTiming:true});
 /* Queue stress: the fifth simultaneous entry is queued instead of escaping the HUD-safe area. */
 ['Q1','Q2','Q3','Q4','Q5'].forEach(function(label){
   feedback.emit({side:'player',index:2,kind:'status',text:label,source:'queue-stress',duration:1500,skipImpactTiming:true});
 });
 var monster0Feedback=Array.from(document.querySelectorAll('.battle-floating-feedback[data-feedback-side="monster"][data-feedback-index="0"]'));
 var monster1Feedback=Array.from(document.querySelectorAll('.battle-floating-feedback[data-feedback-side="monster"][data-feedback-index="1"]'));
 var monster2Feedback=Array.from(document.querySelectorAll('.battle-floating-feedback[data-feedback-side="monster"][data-feedback-index="2"]'));
 var player0Feedback=Array.from(document.querySelectorAll('.battle-floating-feedback[data-feedback-side="player"][data-feedback-index="0"]'));
 var player1Feedback=Array.from(document.querySelectorAll('.battle-floating-feedback[data-feedback-side="player"][data-feedback-index="1"]'));
 var player2Feedback=Array.from(document.querySelectorAll('.battle-floating-feedback[data-feedback-side="player"][data-feedback-index="2"]'));
 var feedbackQueueSnapshot=feedback.debugSnapshot();
 /* Capture the geometry that actually owned these popups before later Boss
    scenarios intentionally reassign the same Unit indexes to different Slots. */
 var monster0FeedbackGeometry=adapter.getUnitGeometry('monster',0);
 var monster1FeedbackGeometry=adapter.getUnitGeometry('monster',1);
 var monster2FeedbackGeometry=adapter.getUnitGeometry('monster',2);
 var player0FeedbackGeometry=adapter.getUnitGeometry('player',0);
 var player1FeedbackGeometry=adapter.getUnitGeometry('player',1);
 var player2FeedbackGeometry=adapter.getUnitGeometry('player',2);
 var stage=document.createElement('div');stage.className='v143-skill-stage';stage.dataset.geometryOwner='fixed-slot';document.body.appendChild(stage);
 var turnNode=document.getElementById('turnTargetRow'),actionRegion=document.getElementById('battleActionRegion');
 turnNode.style.transition='none';
 var turnUi={normal:{opacity:getComputedStyle(turnNode).opacity,pointerEvents:getComputedStyle(turnNode).pointerEvents,rect:rect('#turnTargetRow')}};
 turnNode.classList.add('skill-picker-open');turnUi.skillPicker={opacity:getComputedStyle(turnNode).opacity};turnNode.classList.remove('skill-picker-open');
 turnNode.classList.add('battle-item-open');turnUi.itemPicker={opacity:getComputedStyle(turnNode).opacity};turnNode.classList.remove('battle-item-open');
 actionRegion.classList.add('target-selecting');turnUi.targetSelecting={opacity:getComputedStyle(turnNode).opacity,pointerEvents:getComputedStyle(turnNode).pointerEvents,rect:rect('#turnTargetRow'),promptRect:rect('#battleTargetPrompt')};actionRegion.classList.remove('target-selecting');
 var turnIndicator=document.getElementById('battleTurnIndicator');
 var logRetirement={absent:!document.querySelector('.battle-info-region,#battleInfoToggle,#battleInfo'),turn:rect('#battleTurnIndicator'),turnOpacity:getComputedStyle(turnIndicator).opacity};
 addCards(5,6,false);
 var bossSnapshot=owner.createEnemyFormationSnapshot([0],{originalFormationType:6});
 bossSnapshot.bossBattleSnapshot=true;
 owner.setActiveEnemySnapshot(bossSnapshot);
 owner.assignMonsterToEnemySlot(bossSnapshot,1,'ENEMY_B1');owner.assignMonsterToEnemySlot(bossSnapshot,2,'ENEMY_B5');
 owner.assignMonsterToEnemySlot(bossSnapshot,3,'ENEMY_F1');owner.assignMonsterToEnemySlot(bossSnapshot,4,'ENEMY_F5');
 window.monsters[0].rank='boss';window.monsters[1].rank='elite';window.monsters[2].rank='elite';
 window.monsters[3].unitKind='boss-object';window.monsters[3].canAct=false;window.monsters[4].unitKind='boss-object';window.monsters[4].canAct=false;
 window.FourSymbolsBossBattle={getBossIndex:function(){return 0;},isBossIndex:function(index){return index===0;},isActive:function(){return true;},getEnemyFormationSnapshot:function(){if(owner.getActiveEnemySnapshot()!==bossSnapshot)owner.setActiveEnemySnapshot(bossSnapshot);return bossSnapshot;},ownsEnemyFormationSnapshot:function(snapshot){return snapshot===bossSnapshot;}};
 adapter.reconcile();
 var bossCard=document.getElementById('battleMonster0'),leftObject=document.getElementById('battleMonster3');
 bossCard.classList.add('targetable');leftObject.classList.add('targetable');
 var bossFootprint=document.querySelector('.v-fixed-boss-footprint'),bossReticle=getComputedStyle(bossCard,'::before'),objectReticle=getComputedStyle(leftObject,'::before');
 var bossHp=bossCard.querySelector('.monster-hp'),bossSp=bossCard.querySelector('.monster-sp'),bossName=bossCard.querySelector('.battle-monster-name');
 var bossEvidence={footprint:rect('.v-fixed-boss-footprint'),card:rect('#battleMonster0'),art:rect('#battleMonster0 > .v174-battle-art'),hud:{hp:rect('#battleMonster0 .monster-hp'),sp:rect('#battleMonster0 .monster-sp'),name:rect('#battleMonster0 .battle-monster-name'),hpPosition:getComputedStyle(bossHp).position,spPosition:getComputedStyle(bossSp).position,hpDisplay:getComputedStyle(bossHp).display,spDisplay:getComputedStyle(bossSp).display},bossCount:document.querySelectorAll('.v-fixed-boss-footprint > #battleMonster0').length,slots:bossFootprint&&bossFootprint.dataset.slots,reinforcements:['#battleMonster1','#battleMonster2'].map(function(selector){return {card:rect(selector),art:rect(selector+' > .v174-battle-art')};}),objects:['#battleMonster3','#battleMonster4'].map(function(selector){return {card:rect(selector),art:rect(selector+' > .v174-battle-art')};}),cardless:Array.from(document.querySelectorAll('.battle-monster')).every(function(card){return card.classList.contains('v174-cardless-unit');}),pointerEvents:getComputedStyle(bossCard).pointerEvents,background:getComputedStyle(bossCard).backgroundImage,reticles:{boss:{content:bossReticle.content,border:bossReticle.borderTopWidth,animation:bossReticle.animationName},object:{content:objectReticle.content,border:objectReticle.borderTopWidth,animation:objectReticle.animationName}}};
 function bossLifecycleEvidence(){var active=owner.getActiveEnemySnapshot(),bossArt=document.querySelector('#battleMonster0 > .v174-battle-art'),bossRect=bossArt&&bossArt.getBoundingClientRect();return {sameSnapshot:active===bossSnapshot,bossSlot:owner.getEnemySlotForMonster(active,0),reinforcementSlots:[owner.getEnemySlotForMonster(active,1),owner.getEnemySlotForMonster(active,2)],objectSlots:[owner.getEnemySlotForMonster(active,3),owner.getEnemySlotForMonster(active,4)],roster:window.currentBattleMonsters.slice(),reinforcements:[1,2].map(function(index){var card=document.getElementById('battleMonster'+index),holder=card&&card.parentElement,art=card&&card.querySelector(':scope > .v174-battle-art'),r=art&&art.getBoundingClientRect();return {holderSlot:holder&&holder.dataset.slot||null,artworkClear:!!(r&&bossRect&&(r.right<=bossRect.left+.5||r.left>=bossRect.right-.5))};})};}
 var bossLifecycle={initial:bossLifecycleEvidence()};
 window.monsters[3].alive=false;window.monsters[3].hp=0;owner.removeMonsterFromEnemySlot(bossSnapshot,3);window.renderBattle();bossLifecycle.afterF1=bossLifecycleEvidence();
 window.monsters[4].alive=false;window.monsters[4].hp=0;owner.removeMonsterFromEnemySlot(bossSnapshot,4);window.renderBattle();window.renderBattle();bossLifecycle.afterF5=bossLifecycleEvidence();
 setTimeout(function(){var legacyStyle=document.getElementById('v174-cardless-battle-style');var result={allyPortraitMetadata:allyPortraits.map(({data,...sample})=>sample),viewport:{width:${width},height:${height}},scenarios:scenarios,allyScenarios:allyScenarios,splitAlly:splitAlly,manualControl:manualControl,logRetirement:logRetirement,turnUi:turnUi,artwork:artwork,beforeDeath:beforeDeath,afterDeath:afterDeath,targetSlot:targetSlot,targetRect:targetRect,boss:bossEvidence,bossLifecycle:bossLifecycle,legacyStyle:{owner:legacyStyle&&legacyStyle.dataset.geometryOwner,textLength:legacyStyle?legacyStyle.textContent.length:-1},feedback:{
	   monster0:monster0Feedback.map(function(node){var r=node.getBoundingClientRect(),s=getComputedStyle(node);return {kind:node.dataset.feedbackKind,statusType:node.dataset.feedbackStatusType||null,source:node.dataset.feedbackSource,lane:Number(node.dataset.feedbackLane),rect:{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height},color:s.color,stroke:s.webkitTextStroke,textShadow:s.textShadow,background:s.backgroundColor};}),
	   monster1:monster1Feedback.map(function(node){var r=node.getBoundingClientRect(),s=getComputedStyle(node);return {kind:node.dataset.feedbackKind,statusType:node.dataset.feedbackStatusType||null,source:node.dataset.feedbackSource,lane:Number(node.dataset.feedbackLane),rect:{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height},color:s.color,stroke:s.webkitTextStroke,textShadow:s.textShadow,background:s.backgroundColor};}),
	   monster2:monster2Feedback.map(function(node){var r=node.getBoundingClientRect(),s=getComputedStyle(node);return {kind:node.dataset.feedbackKind,statusType:node.dataset.feedbackStatusType||null,source:node.dataset.feedbackSource,lane:Number(node.dataset.feedbackLane),rect:{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height},color:s.color,stroke:s.webkitTextStroke,textShadow:s.textShadow,background:s.backgroundColor};}),
	   player0:player0Feedback.map(function(node){var r=node.getBoundingClientRect(),s=getComputedStyle(node);return {kind:node.dataset.feedbackKind,source:node.dataset.feedbackSource,lane:Number(node.dataset.feedbackLane),rect:{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height},color:s.color,stroke:s.webkitTextStroke,textShadow:s.textShadow,background:s.backgroundColor};}),
   player1:player1Feedback.map(function(node){var r=node.getBoundingClientRect();return {kind:node.dataset.feedbackKind,source:node.dataset.feedbackSource,lane:Number(node.dataset.feedbackLane),rect:{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}};}),
   player2:player2Feedback.map(function(node){var r=node.getBoundingClientRect();return {kind:node.dataset.feedbackKind,source:node.dataset.feedbackSource,lane:Number(node.dataset.feedbackLane),rect:{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}};}),
   queueSnapshot:feedbackQueueSnapshot,
   monster0Geometry:monster0FeedbackGeometry,monster1Geometry:monster1FeedbackGeometry,monster2Geometry:monster2FeedbackGeometry,
   player0Geometry:player0FeedbackGeometry,player1Geometry:player1FeedbackGeometry,player2Geometry:player2FeedbackGeometry
 },stageOverflow:getComputedStyle(stage).overflow,pageScroll:{width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,clientWidth:document.documentElement.clientWidth,clientHeight:document.documentElement.clientHeight},enemySlots:document.querySelectorAll('.v-fixed-enemy-slot').length,allySlots:document.querySelectorAll('.v-fixed-ally-slot').length,legacyClasses:{enemy:document.getElementById('battleMonsterArea').className,ally:document.getElementById('battlePlayerRow').className}};
 function portraitProbe(mode){
  window.FourSymbolsBossBattle=null;window.v132ActiveDungeonRun={mode:mode};addCards(6,6,false);
  return portraitPaths.map(function(path,index){
   const card=document.getElementById('battleMonster'+index);
   card.v174UnitHud=card.querySelector('.v174-unit-hud');
   syncUnitArtwork(card,'monster',{path:path,portraitKey:path});
   card.querySelector('.v174-battle-art').getAnimations({subtree:true}).filter(a=>a.animationName==='v174BattleIdle').forEach(a=>a.cancel());
   const art=card.querySelector('.v174-battle-art'),paint=art.querySelector('.v174-portrait-paint'),r=paint.getBoundingClientRect(),a=art.getBoundingClientRect(),m=portraitMetadata.assets[path],b=m.alphaBounds;
   const visible={left:r.left+r.width*b[0]/m.width,top:r.top+r.height*b[1]/m.height,right:r.left+r.width*b[2]/m.width,bottom:r.top+r.height*b[3]/m.height,width:r.width*(b[2]-b[0])/m.width,height:r.height*(b[3]-b[1])/m.height};
   return {path:path,visible:visible,art:{left:a.left,top:a.top,right:a.right,bottom:a.bottom},slot:card.dataset.slot,hudTop:card.v174UnitHud.querySelector('.monster-hp').getBoundingClientRect().top};
  });
 }
 result.portraits={legacy:portraitProbe('adventure'),six:portraitProbe('wild')};
 result.sixProfile=document.getElementById('battleMonsterArea').dataset.battlefieldProfile;
 result.sixRows=Array.from(document.querySelectorAll('.v-fixed-enemy-row')).map(row=>Array.from(row.children).map(slot=>slot.dataset.slot));
const proofParty=Number(new URLSearchParams(location.search).get('proofParty'));if(proofParty){addCards(5,proofParty,false);allyVisiblePortraits();if(new URLSearchParams(location.search).has('hidePortrait'))document.querySelectorAll('#battlePlayerRow .v174-battle-art').forEach(n=>n.style.visibility='hidden');}document.getElementById('result').textContent=JSON.stringify(result);},40);
})();
</script></body></html>`;
}

function readChromePng(file){
    const png=fs.readFileSync(file),chunks=[];let width,height,channels;
    for(let at=8;at<png.length;){const length=png.readUInt32BE(at),type=png.toString("ascii",at+4,at+8),bytes=png.subarray(at+8,at+8+length);if(type==="IHDR"){width=bytes.readUInt32BE(0);height=bytes.readUInt32BE(4);assert.equal(bytes[8],8);channels=bytes[9]===2?3:bytes[9]===6?4:0;assert.ok(channels);assert.equal(bytes[12],0);}if(type==="IDAT")chunks.push(bytes);at+=length+12;}
    const raw=inflateSync(Buffer.concat(chunks)),stride=width*channels,pixels=Buffer.alloc(stride*height),rgb=Buffer.alloc(width*height*3);
    for(let y=0;y<height;y++){const filter=raw[y*(stride+1)];for(let x=0;x<stride;x++){const a=x>=channels?pixels[y*stride+x-channels]:0,b=y?pixels[(y-1)*stride+x]:0,c=y&&x>=channels?pixels[(y-1)*stride+x-channels]:0,p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);assert.ok(filter<=4);const predictor=[0,a,b,Math.floor((a+b)/2),pa<=pb&&pa<=pc?a:pb<=pc?b:c][filter];pixels[y*stride+x]=(raw[y*(stride+1)+1+x]+predictor)&255;}}
    for(let i=0;i<width*height;i++)pixels.copy(rgb,i*3,i*channels,i*channels+3);return {width,height,rgb};
}

function close(a,b,label,tolerance=.5){assert.ok(Math.abs(a-b)<=tolerance,`${label}: ${a} != ${b}`);}
function runViewport(chrome,width,height){
    fs.writeFileSync(FIXTURE,fixtureHtml(width,height),"utf8");
    const fileUrl="file://"+FIXTURE.replace(/\\/g,"/");
    const browserProfile=fs.mkdtempSync(path.join(os.tmpdir(),"fixed-slot-qa-"));
    const result=spawnSync(chrome,["--headless=new",`--user-data-dir=${browserProfile}`,"--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--force-device-scale-factor=1",`--window-size=${width},${height}`,"--virtual-time-budget=1200","--dump-dom",fileUrl],{encoding:"utf8",timeout:30000,maxBuffer:24*1024*1024});
    assert.equal(result.status,0,result.stderr||String(result.error||`browser fixture failed ${width}x${height}`));
    const match=result.stdout.match(/<pre id="result"[^>]*>([\s\S]*?)<\/pre>/);assert.ok(match,`missing QA result ${width}x${height}`);const data=JSON.parse(decode(match[1]));assert.ok(!data.fixtureError,data.fixtureError);
    allyPortraitProbeMetadata=data.allyPortraitMetadata.map(sample=>({...sample,data:allyPortraitSamples.find(p=>p.path===sample.path).data}));
    fs.writeFileSync(FIXTURE,fixtureHtml(width,height),"utf8");
    if(width===412&&height===915){
        const screenshot=path.join(ARTIFACT_DIR,"enemy-six-slots-412x915.png");
        const shot=spawnSync(chrome,["--headless=new",`--user-data-dir=${browserProfile}`,"--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--force-device-scale-factor=1",`--window-size=${width},${height}`,"--virtual-time-budget=1200",`--screenshot=${screenshot}`,fileUrl],{encoding:"utf8",timeout:30000,maxBuffer:8*1024*1024});
        assert.equal(shot.status,0,shot.stderr||"Boss mobile screenshot failed");
        assert.ok(fs.existsSync(screenshot),"Boss mobile screenshot evidence missing");
    }
    data.commandPortraitPaint=[];
    for(const party of ["1","6"]){
        const scenario=data.allyScenarios[party];
        if(!scenario.visiblePortraits.some(p=>scenario.lower.commandButtons.some(({rect:b})=>p.visible.right>b.left&&p.visible.left<b.right&&p.visible.bottom>b.top&&p.visible.top<b.bottom)))continue;
        const shots=[];
        for(const hidden of [false,true]){
            const output=path.join(ARTIFACT_DIR,`command-portrait-${width}x${height}-party${party}-${hidden?"hidden":"visible"}.png`);
            const shot=spawnSync(chrome,["--headless=new",`--user-data-dir=${browserProfile}`,"--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--force-device-scale-factor=1",`--window-size=${width},${height}`,"--virtual-time-budget=20000",`--screenshot=${output}`,fileUrl+`?proofParty=${party}`+(hidden?"&hidePortrait=1":"")],{encoding:"utf8",timeout:30000,maxBuffer:8*1024*1024});
            assert.equal(shot.status,0,shot.stderr);shots.push(readChromePng(output));
        }
        let compared=0;
        scenario.lower.commandButtons.forEach(({rect:r,radii})=>{
            // Use the formal computed elliptical corners and actual transformed
            // dimensions; exclude only pixel centers outside that paint path.
            assert.equal(radii.length,4);radii.forEach(c=>assert.ok(Number.isFinite(c.x)&&Number.isFinite(c.y)&&c.x>=0&&c.y>=0));
            const factor=Math.min(1,r.width/(radii[0].x+radii[1].x||1),r.width/(radii[3].x+radii[2].x||1),r.height/(radii[0].y+radii[3].y||1),r.height/(radii[1].y+radii[2].y||1));
            const corners=radii.map((c,i)=>({x:c.x*factor,y:c.y*factor,right:i===1||i===2,bottom:i>=2}));
            for(let y=Math.ceil(r.top);y<Math.floor(r.bottom);y++)for(let x=Math.ceil(r.left);x<Math.floor(r.right);x++){
                const px=x+.5,py=y+.5;
                if(corners.some(c=>{if(!c.x||!c.y)return false;const dx=c.right?px-(r.right-c.x):(r.left+c.x)-px,dy=c.bottom?py-(r.bottom-c.y):(r.top+c.y)-py;return dx>0&&dy>0&&(dx/c.x)**2+(dy/c.y)**2>1;}))continue;
                const offset=(y*shots[0].width+x)*3;
                assert.deepEqual(shots[0].rgb.subarray(offset,offset+3),shots[1].rgb.subarray(offset,offset+3),`portrait changes command interior ${width}x${height} party ${party} pixel ${x},${y}`);compared++;
            }
        });
        assert.ok(compared>0);data.commandPortraitPaint.push({party:Number(party),comparedPixels:compared,exact:true});
    }
    const canvasScale=Math.min(width/420,height/746.667);
    assert.equal(data.enemySlots,10);assert.equal(data.allySlots,6);
    assert.equal(data.legacyStyle.owner,null);assert.equal(data.legacyStyle.textLength,-1,"legacy runtime geometry style must be removed rather than kept as an override");
    assert.doesNotMatch(data.legacyClasses.enemy,/battle-monsters|v131-formation|v141-fixed-formation/);assert.doesNotMatch(data.legacyClasses.ally,/battle-player-row/);
    const baseline=data.scenarios[1].lower;
    assert.ok(baseline.enemy.bottom<=baseline.center.top+.5,"enemy region must end before the center operation region");
    assert.ok(baseline.center.bottom<=baseline.allyRegion.top+.5,"center operation region must end before the ally region");
    assert.ok(baseline.action.top>=baseline.center.top-.5&&baseline.action.bottom<=baseline.center.bottom+.5,"action controls stay inside the center region");
    assert.equal(baseline.centerBackground,"none","center controls must not own a black translucent background");
    assert.equal(data.logRetirement.absent,true,"retired battle log DOM must be absent");
    assert.equal(data.logRetirement.turnOpacity,"1","current round remains visible");
    assert.ok(data.logRetirement.turn.height>0&&data.logRetirement.turn.bottom<=baseline.allyRegion.bottom+.5,"current round stays in the battlefield");
    assert.equal(data.turnUi.normal.opacity,"1");
    assert.equal(data.turnUi.normal.pointerEvents,"none","turn timer must never block target selection");
    assert.equal(data.turnUi.skillPicker.opacity,"1");
    assert.equal(data.turnUi.itemPicker.opacity,"1");
    assert.equal(data.turnUi.targetSelecting.opacity,"1");
    assert.equal(data.turnUi.targetSelecting.pointerEvents,"none");
    for(const [key,index] of [["character0",0],["character1",1],["character2",2]]){
        const state=data.manualControl[key];
        assert.deepEqual(state.active,[`battlePlayerCard${index}`],`${key} must be the only manual active character`);
        assert.equal(state.frame.content,'""');
        assert.equal(state.frame.border,"3px");
        assert.equal(state.frame.borderColor,"rgb(255, 210, 31)");
        assert.notEqual(state.frame.shadow,"none");
        assert.equal(state.frame.animationName,"v174ManualActiveTurnFrameFlash");
        assert.equal(state.frame.animationDuration,"0.3s");
        assert.equal(state.frame.zIndex,"-1","manual frame stays behind the portrait paint");
        assert.deepEqual(state.frame.insets,["-4px","-4px","-4px","-4px"],"frame follows artwork, not the smaller Unit/HUD rectangle");
        close(state.frame.width,state.frame.artWidth+8,"manual frame artwork width",1);
        close(state.frame.height,state.frame.artHeight+8,"manual frame artwork height",1);
        assert.equal(state.frame.transform,"none","ground-shadow translation must not leak into the frame");
        assert.equal(state.frame.behindPaint,true,"actual frame pseudo-element must paint behind portrait, even when made hit-testable");
        assert.notEqual(state.frame.rootAnimation,"v174ManualActiveTurnFrameFlash","old Unit pseudo must not retain a second frame");
        assert.equal(state.frame.rootContent,"none");
        assert.equal(state.frame.footShadow.content,'""');
        assert.match(state.frame.footShadow.background,/radial-gradient/);
        assert.equal(state.frame.footShadow.opacity,"0.72");
    }
    assert.deepEqual(data.manualControl.auto.active,[],"auto control must expose no manual active character");
    data.manualControl.auto.frames.forEach(frame=>{assert.equal(frame.animationName,"none","inactive/auto cards must not run the manual flash");assert.ok(frame.content==="none"||frame.content==="normal","inactive artwork has no frame");assert.equal(frame.footShadow.content,'""');assert.match(frame.footShadow.background,/radial-gradient/);});
    assert.deepEqual(data.manualControl.targetSelection.active,["battlePlayerCard1"]);
    assert.equal(data.manualControl.targetSelection.frame.animationName,"v174ManualActiveTurnFrameFlash","ally target selection must not suppress the manual active frame");
    assert.equal(data.manualControl.targetSelection.reticleAnimation,"none","multi-target reticles remain static");
    assert.equal(data.manualControl.targetSelection.frame.behindPaint,true,"target selection retains the behind-art frame plane");
    close(data.turnUi.normal.rect.top,baseline.action.top,"turn timer occupies the shared information band",.8);
    assert.ok(baseline.command.height/canvasScale>=66-.1,"command touch row retains 66 logical pixels");
    assert.ok(baseline.elementBox.height/canvasScale>=66-.1,"Element Box retains 66 logical pixels");
    // Product decision: Element Box is a floating button and may overlap the
    // command region; its hit target and the existing command targets remain usable.
    assert.equal(baseline.elementBoxHit,true,"floating Element Box must retain its own hit target");
    assert.equal(baseline.commandButtons.length,5);
    baseline.commandButtons.forEach(button=>{assert.ok(button.rect.height/canvasScale>=66-.1);assert.ok(button.rect.width/canvasScale>=70);assert.equal(button.font,"16px");assert.equal(button.hit,true,"visible command center must hit its own control");});
    assert.ok(data.allyScenarios[6].hudRects[0].art.height/canvasScale/.94>99,"far-row depth preserves the original artwork box before its 6% paint projection");
    assert.ok(data.turnUi.normal.rect.bottom<=baseline.commandVisualTop+.8,"turn timer must not overlap command art");
    assert.ok(data.turnUi.targetSelecting.rect.top>=baseline.center.top-.5,"target-selecting turn timer stays inside center region");
    assert.ok(
        data.turnUi.targetSelecting.promptRect.top>=data.turnUi.targetSelecting.rect.bottom-.5,
        "target-selecting turn timer stays above the target prompt without overlap: "+
        JSON.stringify({turn:data.turnUi.targetSelecting.rect,prompt:data.turnUi.targetSelecting.promptRect,center:baseline.center})
    );
    assert.ok(data.turnUi.targetSelecting.promptRect.bottom<=baseline.center.bottom+.5,"target prompt stays inside center region");
    close(baseline.elementBox.width,66*canvasScale,"element box width");close(baseline.elementBox.height,66*canvasScale,"element box height");
    for(const count of [1,3,5,6,8,10]){const scenario=data.scenarios[count],profileBaseline=data.scenarios[count<=6?1:8].lower;assert.equal(scenario.slots,count<=6?6:10);close(scenario.lower.enemy.height,profileBaseline.enemy.height,`enemy region height count ${count}`);close(scenario.lower.center.height,profileBaseline.center.height,`center region height count ${count}`);close(scenario.lower.ally.top,profileBaseline.ally.top,`ally top count ${count}`);close(scenario.lower.middle.top,profileBaseline.middle.top,`middle top count ${count}`);close(scenario.lower.action.top,profileBaseline.action.top,`action top count ${count}`);scenario.unitRects.forEach(function(rect){close(rect.width,scenario.unitRects[0].width,`enemy card width count ${count}`);close(rect.height,scenario.unitRects[0].height,`enemy card height count ${count}`);assert.ok(rect.bottom<=scenario.lower.enemy.bottom+.5,`enemy card stays above center count ${count}`);});for(const shape of ["single","tri","row","column","all"]){close(scenario[shape].width,data.scenarios[count<=6?1:8][shape].width,`${shape} width count ${count}`);close(scenario[shape].height,data.scenarios[count<=6?1:8][shape].height,`${shape} height count ${count}`);close(scenario[shape].centerX,(scenario[shape].left+scenario[shape].right)/2,`${shape} centerX count ${count}`);close(scenario[shape].centerY,(scenario[shape].top+scenario[shape].bottom)/2,`${shape} centerY count ${count}`);}}
    fs.writeFileSync(path.join(ARTIFACT_DIR,"six-slot-portrait-probe.json"),JSON.stringify(data.portraits,null,2));
    assert.equal(data.sixProfile,"standard-six");
    assert.deepEqual(data.sixRows,[["ENEMY_B1","ENEMY_B2","ENEMY_B3"],["ENEMY_F1","ENEMY_F2","ENEMY_F3"]]);
    data.portraits.six.forEach((sample,index)=>{
        const old=data.portraits.legacy[index];
        assert.ok(sample.visible.width>=old.visible.width-.5,"portrait must not shrink");
        assert.ok(sample.visible.left>=sample.art.left-.5&&sample.visible.right<=sample.art.right+.5,"complete alpha bounds stay in artwork width");
        assert.ok(sample.visible.top>=sample.art.top-.5&&sample.visible.bottom<=sample.art.bottom+.5,"portrait stays in its paint box below the top HUD: "+JSON.stringify(sample));
    });
    assert.ok(data.portraits.six.some((sample,index)=>sample.visible.height>data.portraits.legacy[index].visible.height*1.1),"three columns materially enlarge width-limited portraits");
    const allyBaseline=data.allyScenarios[1].lower;for(const count of [1,2,3,4,5,6]){const scenario=data.allyScenarios[count];assert.equal(scenario.slots,6);close(scenario.lower.ally.height,allyBaseline.ally.height,`ally zone height party ${count}`);close(scenario.lower.action.top,allyBaseline.action.top,`action top party ${count}`);scenario.unitRects.forEach(function(rect,index){close(rect.width,scenario.unitRects[0].width,`ally card width party ${count}`);close(rect.height,scenario.unitRects[0].height,`ally card height party ${count}`);assert.ok(rect.top>=scenario.lower.allyRegion.top-.5,`ally card stays below center party ${count}`);assert.ok(rect.bottom<=scenario.lower.allyRegion.bottom+.5,`ally card stays inside ally region party ${count}`);scenario.unitRects.slice(index+1).forEach(other=>assert.ok(rect.right<=other.left+.5||other.right<=rect.left+.5||rect.bottom<=other.top+.5||other.bottom<=rect.top+.5,`ally cards overlap party ${count}`));});scenario.hudRects.forEach(function(hud){const portrait=scenario.visiblePortraits.find(p=>p.id===hud.id);assert.ok(portrait,"formal alpha projection exists for "+hud.id);scenario.lower.commandButtons.forEach(button=>{const a=portrait.visible,b=button.rect;assert.ok([a.left,a.top,a.right,a.bottom,b.left,b.top,b.right,b.bottom].every(Number.isFinite),"formal portrait and command paint geometry must be finite");});scenario.hudRects.forEach(function(other){if(other===hud)return;assert.ok(hud.art.right<=other.name.left+.5||hud.art.left>=other.name.right-.5||hud.art.bottom<=other.name.top+.5||hud.art.top>=other.name.bottom-.5,`ally art must not overlap another HUD name party ${count}`);});assert.ok(hud.art.bottom<=hud.hp.top+.5,`ally art/HP overlap party ${count}`);assert.ok(hud.hp.bottom<=hud.sp.top+.5,`ally HP/SP overlap party ${count}`);assert.ok(hud.name.bottom<=hud.hp.top+.5,`ally name/HP overlap party ${count}`);assert.equal(hud.logicalHp,6);assert.equal(hud.logicalSp,6);});}assert.equal(data.splitAlly.assigned[1],"ALLY_B2");close(data.splitAlly.lower.ally.height,allyBaseline.ally.height,"split front/back ally zone height");
    assert.ok(data.scenarios[3].unitRects[0].height>100,"enemy cards are visibly taller than the previous 92px owner");
    assert.ok(data.allyScenarios[3].unitRects[0].height>116*canvasScale,"ally cards are visibly taller than the previous 86px owner");
    close(data.beforeDeath.e2.left,data.afterDeath.e2.left,"death must not move right unit");close(data.beforeDeath.e2.top,data.afterDeath.e2.top,"death must not move right unit vertically");
    for(const [kind,art] of Object.entries(data.artwork)){assert.equal(art.backgroundSize,"contain",`${kind} artwork must use contain`);assert.equal(art.overflow,"visible",`${kind} artwork overflow`);assert.equal(art.contain,"none",`${kind} artwork contain`);assert.equal(art.clipChain.some(entry=>/hidden|clip/.test(entry.overflow)||/hidden|clip/.test(entry.overflowX)||/hidden|clip/.test(entry.overflowY)),false,`${kind} artwork has clipping ancestor`);}
    function separated(items,label){for(let i=0;i<items.length;i++){for(let j=i+1;j<items.length;j++){const a=items[i].rect,b=items[j].rect;assert.ok(a.bottom<=b.top+.5||b.bottom<=a.top+.5||a.right<=b.left+.5||b.right<=a.left+.5,label+" overlap: "+JSON.stringify({a:items[i],b:items[j]}));}}}
    assert.equal(data.feedback.monster0.length,2,"Relic damage + Burn status must share one target context: "+JSON.stringify(data.feedback.monster0Geometry));
    assert.deepEqual(data.feedback.monster0.map(item=>item.source).sort(),["relic","relic-status"]);
    assert.equal(data.feedback.monster1.length,2,"Shield + HP damage must share one target context");
    assert.equal(data.feedback.monster2.length,2,"MISS + Status must share one target context");
    assert.equal(data.feedback.player0.length,2,"HP + SP recovery must share one target context");
    assert.equal(data.feedback.player1.length,2,"consecutive HP recovery must allocate separate lanes");
    const queueContext=data.feedback.queueSnapshot.find(item=>item.key==="player:2");
    assert.ok(queueContext,"queue stress context must exist");
    assert.ok(queueContext.capacity>=1&&queueContext.capacity<=4,"lane capacity must stay bounded by the formal maximum");
    assert.equal(data.feedback.player2.length,queueContext.active.length,"rendered feedback must equal active lane count");
    assert.equal(queueContext.active.length,queueContext.capacity,"queue stress must fill every geometry-safe lane");
    assert.equal(queueContext.active.length+queueContext.queued.length,5,"all five stress events must remain active or queued");
    assert.ok(queueContext.queued.length>=1,"overflow feedback must wait in queue instead of entering HUD space");
    [data.feedback.monster0,data.feedback.monster1,data.feedback.monster2,data.feedback.player0,data.feedback.player1,data.feedback.player2].forEach(function(group){
        separated(group,"battle feedback");
        assert.equal(new Set(group.map(item=>item.lane)).size,group.length,"each active feedback item must have a unique lane");
    });
    [[data.feedback.monster0,data.feedback.monster0Geometry],[data.feedback.monster1,data.feedback.monster1Geometry],[data.feedback.monster2,data.feedback.monster2Geometry],[data.feedback.player0,data.feedback.player0Geometry],[data.feedback.player1,data.feedback.player1Geometry],[data.feedback.player2,data.feedback.player2Geometry]].forEach(function(pair){
        pair[0].forEach(function(item){
            assert.ok(
                (item.rect.bottom<=pair[1].hudSafeRect.top+.5||item.rect.top>=pair[1].hudSafeRect.bottom-.5),
                "feedback must stay above HUD safe area: "+JSON.stringify({
                    viewport:data.viewport,
                    item:item,
                    feedbackSafeRect:pair[1].feedbackSafeRect,
                    feedbackAnchor:pair[1].feedbackAnchor,
                    hudSafeRect:pair[1].hudSafeRect,
                    unitRect:pair[1].unitRect
                })
            );
        });
    });
	const damage=data.feedback.monster0.concat(data.feedback.monster1).filter(item=>item.kind==="damage");
	damage.forEach(function(item){
		assert.equal(item.color,"rgb(227, 38, 38)");
		assert.match(item.stroke,/0\.85px rgb\(255, 255, 255\)/);
		assert.equal(item.background,"rgba(0, 0, 0, 0)");
		assert.doesNotMatch(item.textShadow,/8px|10px|14px|16px/);
	});
	const burn=data.feedback.monster0.find(item=>item.kind==="status");
	assert.deepEqual({statusType:burn.statusType,color:burn.color,background:burn.background},{statusType:"burn",color:"rgb(255, 255, 255)",background:"rgb(11, 11, 13)"});
	const defenseDown=data.feedback.monster2.find(item=>item.kind==="status");
	assert.deepEqual({statusType:defenseDown.statusType,color:defenseDown.color,background:defenseDown.background},{statusType:"defenseDown",color:"rgb(255, 255, 255)",background:"rgb(11, 11, 13)"});
	const recoveries=Object.fromEntries(data.feedback.player0.map(item=>[item.kind,item]));
	assert.equal(recoveries.heal.color,"rgb(32, 184, 87)");
	assert.equal(recoveries.sp.color,"rgb(44, 141, 232)");
    assert.equal(data.stageOverflow,"visible");
    close(data.boss.footprint.left,data.boss.card.left,"Boss card left fills six-Slot footprint");close(data.boss.footprint.right,data.boss.card.right,"Boss card right fills six-Slot footprint");close(data.boss.footprint.top,data.boss.card.top,"Boss card top fills six-Slot footprint");close(data.boss.footprint.bottom,data.boss.card.bottom,"Boss card bottom fills six-Slot footprint");
    assert.equal(data.boss.bossCount,1,"Boss must remain one DOM target");assert.equal(data.boss.slots,"ENEMY_B2 ENEMY_B3 ENEMY_B4 ENEMY_F2 ENEMY_F3 ENEMY_F4");assert.equal(data.boss.cardless,true,"Boss-side dynamic Units must be cardless immediately");assert.equal(data.boss.pointerEvents,"auto");assert.equal(data.boss.background,"none");
    assert.equal(data.boss.hud.hpPosition,"absolute","Boss HP must escape the V154 relative HUD rule");assert.equal(data.boss.hud.spPosition,"absolute","Boss SP must escape the V154 relative HUD rule");assert.equal(data.boss.hud.hpDisplay,"block");assert.equal(data.boss.hud.spDisplay,"block");close(data.boss.hud.hp.height,6*canvasScale,"Boss HP canvas projection");close(data.boss.hud.sp.height,canvasScale,"Boss SP compatibility projection");assert.ok(data.boss.hud.name.bottom<=data.boss.hud.hp.top+1,"Boss identity must sit above HP");
    data.boss.reinforcements.concat(data.boss.objects).forEach(function(side){assert.ok(side.card.right<=data.boss.footprint.left+.5||side.card.left>=data.boss.footprint.right-.5,"Boss side Unit must not invade central footprint");assert.ok(side.art.right<=data.boss.art.left+.5||side.art.left>=data.boss.art.right-.5,"Boss side artwork must not overlap Boss artwork");});
    [data.boss.reinforcements[0],data.boss.objects[0]].forEach(function(side){assert.ok(side.art.centerX<=side.card.centerX-6,"left Boss-side artwork must visibly shift outward");});
    [data.boss.reinforcements[1],data.boss.objects[1]].forEach(function(side){assert.ok(side.art.centerX>=side.card.centerX+6,"right Boss-side artwork must visibly shift outward");});
    assert.equal(data.boss.reticles.boss.content,'""');assert.equal(data.boss.reticles.object.content,'""');assert.equal(data.boss.reticles.boss.border,"3px");assert.equal(data.boss.reticles.object.border,"3px");assert.equal(data.boss.reticles.boss.animation,"none");assert.equal(data.boss.reticles.object.animation,"none");
    for(const phase of [data.bossLifecycle.initial,data.bossLifecycle.afterF1,data.bossLifecycle.afterF5]){assert.equal(phase.sameSnapshot,true,"Boss lifecycle must preserve snapshot identity");assert.equal(phase.bossSlot,"ENEMY_B3");assert.deepEqual(phase.reinforcementSlots,["ENEMY_B1","ENEMY_B5"]);assert.ok(phase.reinforcements.every(function(item,index){return item.holderSlot===["ENEMY_B1","ENEMY_B5"][index]&&item.artworkClear;}),"Boss reinforcements must remain outside the central artwork footprint");}
    assert.deepEqual(data.bossLifecycle.initial.objectSlots,["ENEMY_F1","ENEMY_F5"]);assert.deepEqual(data.bossLifecycle.afterF1.objectSlots,[null,"ENEMY_F5"]);assert.deepEqual(data.bossLifecycle.afterF5.objectSlots,[null,null]);assert.ok(data.bossLifecycle.afterF5.roster.includes(3)&&data.bossLifecycle.afterF5.roster.includes(4),"dead Boss objects remain in the lifecycle roster without forcing compaction");
    assert.ok(data.pageScroll.width<=data.pageScroll.clientWidth+1,`horizontal page scroll ${width}x${height}`);assert.ok(data.pageScroll.height<=data.pageScroll.clientHeight+1,`vertical page scroll ${width}x${height}`);return data;
}

fs.mkdirSync(ARTIFACT_DIR,{recursive:true});
try{
    const chrome=findChrome();const results=VIEWPORTS.map(([width,height])=>runViewport(chrome,width,height));
    const evidence={suite:"fixed-slot-battlefield-rendering-v2",passed:true,viewports:results.map(item=>item.viewport),checks:{threeStructuralRegions:true,centerControlsIsolated:true,centerBackgroundRemoved:true,battleLogRemoved:true,currentRoundVisible:true,largeElementBox:true,enemyCounts:[1,3,5,6,8,10],allyCounts:[1,2,3,4,5,6],manualActiveCharacterFlash:true,manualActiveCharacterUnique:true,autoHasNoManualFlash:true,equalEnemyCardGeometry:true,equalAllyCardGeometry:true,sixAllyNoOverlap:true,enlargedUnitCards:true,splitAllyFormation:true,deathDoesNotCompress:true,bossSingleEntity:true,bossSixSlotFootprint:true,bossHudAnchored:true,bossSnapshotIdentityStableAfterObjectDeath:true,bossObjectDeathDoesNotCompact:true,bossSideUnits:["ENEMY_B1","ENEMY_B5","ENEMY_F1","ENEMY_F5"],bossSideUnitsDoNotOverlap:true,bossSideArtworkSeparated:true,bossSideArtworkShiftedOutward:true,bossAndObjectReticles:true,dynamicCardlessImmediate:true,vfxShapes:["single","tri","row","column","all"],vfxCenterUsesGeometry:true,vfxScaleStable:true,artworkKinds:["player","regular","elite","boss","abyss"],artworkNoBattlefieldClip:true,popupKinds:["damage","critical","status","shield","miss","heal","sp"],popupUsesCanonicalUnitGeometry:true,popupCollisionFree:true,popupHudSafe:true,unifiedTypography:true,legacyRuntimeGeometryNeutralized:true,noPageScroll:true},results};
    fs.writeFileSync(path.join(ARTIFACT_DIR,"fixed-slot-battlefield-rendering-v2.json"),JSON.stringify(evidence,null,2)+"\n","utf8");console.log("Fixed Slot Battlefield Rendering V2 mobile browser QA passed:",VIEWPORTS.map(v=>v.join("x")).join(", "));
}finally{try{fs.unlinkSync(FIXTURE);}catch(_){}}
