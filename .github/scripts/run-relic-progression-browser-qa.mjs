import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {spawnSync} from "node:child_process";

function findChrome(){
    for(const name of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){
        const probe=spawnSync("bash",["-lc",`command -v ${name}`],{encoding:"utf8"});
        if(probe.status===0&&probe.stdout.trim()){ return probe.stdout.trim(); }
    }
    throw new Error("Headless Chrome/Chromium is required for relic progression browser QA.");
}

const relicPath=process.env.RELIC_SOURCE||path.join(process.cwd(),"js/relic-progression-drop-system.js");
const cssPath=process.env.RELIC_CSS||path.join(process.cwd(),"css/relic-progression-drop-system.css");
const source=fs.readFileSync(relicPath,"utf8").replace(/<\/script/gi,"<\\/script");
const css=fs.readFileSync(cssPath,"utf8");
const fixture=path.join(process.cwd(),".relic-progression-browser-qa.html");
const fileUrl="file://"+fixture.replace(/\\/g,"/");

const html=`<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
html,body{margin:0;width:390px;height:844px;overflow:hidden;background:#050505;color:#ead9ae;font-family:sans-serif}
#game-stage{width:390px;height:844px;position:relative;overflow:hidden;background:#100d09}
#homeFeatureModal{position:absolute;inset:0;display:flex;padding:8px;box-sizing:border-box}
.home-feature-modal-box{width:100%;height:100%;min-width:0;min-height:0;border:2px solid #8d6a34;background:#15110c;display:flex;flex-direction:column;box-sizing:border-box;overflow:hidden}
#homeFeatureModalTitle{height:38px;flex:0 0 38px;text-align:center;padding:8px;box-sizing:border-box}
#homeFeatureModalBody{flex:1 1 auto;min-height:0;min-width:0;overflow-y:auto;overflow-x:hidden;padding:8px;box-sizing:border-box}
.team-relic-detail,.team-relic-page{width:100%;min-width:0;box-sizing:border-box}.team-relic-detail-hero{padding:8px;border:1px solid #7b5b30}.team-relic-detail section{padding:8px;margin:6px 0;border:1px solid #59431f}.team-relic-detail-actions{display:flex;gap:8px}.team-relic-detail-actions button{min-height:44px;flex:1}
.team-relic-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.team-relic-card{min-width:0;padding:8px}.team-relic-card-art{display:block;aspect-ratio:1}.team-relic-tabs{display:flex;gap:4px;overflow-x:auto}.team-relic-resource-line{display:flex;gap:8px;justify-content:space-between;flex-wrap:wrap}
#bossTabContent,#towerPageContent{position:absolute;inset:0;overflow-y:auto;overflow-x:hidden;padding:8px;box-sizing:border-box;background:#100d09}.boss-detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.boss-detail-grid section{min-width:0;padding:8px;border:1px solid #6e522b}.tower-summary-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.tower-summary-grid>div{padding:8px;border:1px solid #6e522b}
${css}
</style></head><body><div id="game-stage">
<div id="homeFeatureModal"><div class="home-feature-modal-box wide"><div id="homeFeatureModalTitle">秘 寶</div><div id="homeFeatureModalBody"></div></div></div>
<div id="bossTabContent" hidden></div><div id="towerPageContent" hidden></div>
</div><pre id="result"></pre>
<script>
var inventoryItems=[
 {id:"relicFragment_nine_dragon_fire",name:"舊九龍碎片",count:72,type:"material",stats:{}},
 {id:"relicUniversalFragment",name:"舊通用",count:86,type:"material",stats:{}},
 {id:"relicEssence",name:"舊精華",count:130,type:"material",stats:{}},
 {id:"relicBreakthroughStone",name:"舊突破",count:3,type:"material",stats:{}},
 {id:"relicChoiceBoxPurple",name:"舊紫箱",count:1,type:"material",stats:{}}
];
var gold=0,battleActive=false;
var player={id:"QA",relicProgression:{version:1,initialized:true,ownershipMigration:"preserved-existing",legacyTowerChoiceHandled:true,majorMilestoneClaims:{},pending:null}};
const catalog={
 relic_qiankun_flask:{id:"relic_qiankun_flask",name:"乾坤玉壺",rarity:"blue",runtimeReady:true,maxLevel:20},
 relic_sun_orb:{id:"relic_sun_orb",name:"烈陽神珠",rarity:"purple",runtimeReady:true,maxLevel:20},
 relic_xuanwu_seal:{id:"relic_xuanwu_seal",name:"玄武靈印",rarity:"blue",runtimeReady:true,maxLevel:20},
 relic_soul_bell:{id:"relic_soul_bell",name:"鎮魂古鐘",rarity:"purple",runtimeReady:true,maxLevel:20},
 relic_tiangang_banner:{id:"relic_tiangang_banner",name:"天罡戰旗",rarity:"orange",runtimeReady:true,maxLevel:20},
 relic_nine_dragon_fire:{id:"relic_nine_dragon_fire",name:"九龍神火罩",rarity:"purple",runtimeReady:true,maxLevel:20},
 relic_cold_spring_jade:{id:"relic_cold_spring_jade",name:"寒泉玉珮",rarity:"purple",runtimeReady:true,maxLevel:20},
 relic_qinglan_feather:{id:"relic_qinglan_feather",name:"青嵐羽符",rarity:"blue",runtimeReady:true,maxLevel:20},
 relic_rock_mountain_seal:{id:"relic_rock_mountain_seal",name:"岩岳鎮印",rarity:"purple",runtimeReady:true,maxLevel:20},
 relic_returning_wheel:{id:"relic_returning_wheel",name:"回天寶輪",rarity:"pink",runtimeReady:true,maxLevel:20},
 relic_all_returning_array:{id:"relic_all_returning_array",name:"萬象歸元盤",rarity:"four-symbol",runtimeReady:false,maxLevel:20}
};
const owned={};Object.values(catalog).forEach(function(def){owned[def.id]={unlocked:def.id==="relic_nine_dragon_fire",level:1,seen:true};});
const loadout={relicId:null,subRelicId:null};
window.v174RelicSystem={catalog:catalog,getOwnedState:function(){return owned;},getTeamLoadout:function(){return loadout;}};
const state={personal:{},world:{},tower:{weekKey:"2026-09-07",completedFloor:24,highestThisWeek:24,historicalHighest:24,claimedFloors:{},pendingRelicChoice:false}};
[20,30,40,50,60,70,80,90,100].forEach(function(level){state.personal["personal-"+level]={firstClear:false,clears:0};});
[40,60,80,100].forEach(function(level){state.world["world-"+level]={firstClear:false,clears:0,completedStages:0};});
const personal=[20,30,40,50,60,70,80,90,100].map(function(level){return {id:"personal-"+level,name:level===30?"烈焰巨魔王":"個人王"+level,level:level,firstReward:"首通獎勵",repeatReward:"重複獎勵"};});
const world=[40,60,80,100].map(function(level){return {id:"world-"+level,name:"世界王"+level,level:level,firstReward:"首通獎勵",repeatReward:"重複獎勵"};});
window.GameplaySystem={personalBosses:personal,worldBosses:world,towerConfig:{floorCount:100,relicChoices:[{id:"relic_nine_dragon_fire",name:"九龍神火罩"}]},getSerializableState:function(){return state;},getActiveBattleState:function(){return null;}};
window.FourSymbolsAccountSave={getActiveUid:function(){return "qa-uid";},readForUid:function(){return {status:"ready",save:{player:player,playerRelics:{relic_nine_dragon_fire:{unlocked:true,level:1,seen:true}}}};}};
function itemCount(id){return inventoryItems.reduce(function(sum,item){return sum+(item.id===id?Number(item.count)||0:0);},0)}
window.v132CanAddItemToInventory=function(){return true};
window.v132AddItemToInventory=function(def,count){var found=inventoryItems.find(function(item){return item.id===def.id});if(found){found.count=(Number(found.count)||0)+count;Object.assign(found,def)}else{inventoryItems.push(Object.assign({},def,{count:count}))}return true};
window.v132ConsumeStackItem=function(id,count){var found=inventoryItems.find(function(item){return item.id===id});if(!found||found.count<count)return false;found.count-=count;if(found.count===0)inventoryItems.splice(inventoryItems.indexOf(found),1);return true};
window.v132RunInventoryTransaction=function(operation){return !!operation()};
window.v141ShowBlackGoldReward=function(){};
function saveGame(){return true}function rebuildInventorySlots(){}function renderInventoryItems(){}function alert(message){window.__lastAlert=message}
function baseRelicList(){return '<div class="team-relic-page"><div class="team-relic-resource-line"><span>舊資源</span><b>舊強化</b></div><div class="team-relic-tabs"><button>全部</button></div><div class="team-relic-grid">'+Object.values(catalog).filter(function(d){return d.runtimeReady}).map(function(d){return '<button class="team-relic-card"><span class="team-relic-card-art"></span><span class="team-relic-card-name">'+d.name+'</span><span class="team-relic-card-meta">'+(owned[d.id].unlocked?'Lv.1':'尚未獲得')+'</span></button>'}).join('')+'</div></div>'}
window.v174OpenRelicPage=function(){document.getElementById('homeFeatureModalBody').innerHTML=baseRelicList();return true};
window.v174OpenRelicDetail=function(id){var d=catalog[id];document.getElementById('homeFeatureModalBody').innerHTML='<div class="team-relic-detail"><button class="team-relic-detail-back">返回</button><div class="team-relic-detail-hero"><h2>'+d.name+'</h2></div><section><h3>效果</h3><p>測試效果</p></section><section class="team-relic-upgrade"><h3>強化</h3><p>目前只消耗金幣</p></section><div class="team-relic-detail-actions"><button>舊按鈕</button></div></div>';return true};
window.v174SetRelicFilter=function(){document.getElementById('homeFeatureModalBody').innerHTML=baseRelicList();return true};
window.v174EquipRelic=function(id){loadout.relicId=id;window.v174OpenRelicDetail(id);return true};window.v174UnequipRelic=function(){loadout.relicId=null;return true};window.v174RelicDevUnlock=function(id){owned[id].unlocked=true;return true};
window.vGameplayOpenBossDetail=function(type,id){document.getElementById('bossTabContent').hidden=false;document.getElementById('homeFeatureModal').hidden=true;var d=(type==='world'?world:personal).find(function(x){return x.id===id});document.getElementById('bossTabContent').innerHTML='<div class="boss-detail"><section class="boss-hero"><h3>'+d.name+'</h3></section><div class="boss-detail-grid"><section><h4>首次擊敗獎勵</h4><p>'+d.firstReward+'・尚未領取</p></section><section><h4>重複掉落</h4><p>'+d.repeatReward+'</p></section></div></div>';return true};
window.vGameplayCloseBossDetail=function(){return true};window.vGameplaySwitchBossTab=function(){return true};window.vGameplayStartBoss=function(){return false};
window.vGameplayOpenTower=function(){document.getElementById('towerPageContent').hidden=false;document.getElementById('homeFeatureModal').hidden=true;document.getElementById('towerPageContent').innerHTML='<div class="tower-home"><section class="tower-element-hero"><h3>火元素</h3></section><div class="tower-summary-grid"><div>本週最高</div><div>歷史最高</div></div></div>';return true};
window.vGameplayToggleTowerOverview=window.vGameplayOpenTower;window.vGameplayRenderTower=window.vGameplayOpenTower;window.vGameplayContinueTower=function(){return false};window.vGameplaySelectTowerBand=function(){return false};window.vGameplayChooseTowerRelic=function(){state.tower.pendingRelicChoice=false;return true};
</script><script>${source}</script><script>
(function(){
 document.getElementById('homeFeatureModal').hidden=false;document.getElementById('bossTabContent').hidden=true;document.getElementById('towerPageContent').hidden=true;
 window.v174OpenRelicDetail('relic_nine_dragon_fire');
 var body=document.getElementById('homeFeatureModalBody');var panel=body.querySelector('.relic-progression-detail-panel');var actions=body.querySelector('.team-relic-detail-actions');var br=body.getBoundingClientRect();var pr=panel&&panel.getBoundingClientRect();
 var detail={text:panel?panel.textContent.replace(/\\s+/g,' ').trim():'',action:actions?actions.textContent.trim():'',overflow:body.scrollWidth>body.clientWidth+1,panelOutside:!!(pr&&(pr.left<br.left-1||pr.right>br.right+1))};
 document.getElementById('homeFeatureModal').hidden=true;document.getElementById('bossTabContent').hidden=false;window.vGameplayOpenBossDetail('personal','personal-30');var boss=document.querySelector('.relic-progression-boss-preview');var bossRoot=document.getElementById('bossTabContent');var bossData={text:boss?boss.textContent.replace(/\\s+/g,' ').trim():'',overflow:bossRoot.scrollWidth>bossRoot.clientWidth+1};
 document.getElementById('bossTabContent').hidden=true;document.getElementById('towerPageContent').hidden=false;window.vGameplayOpenTower();var tower=document.querySelector('.tower-relic-reward-guide');var towerRoot=document.getElementById('towerPageContent');var towerData={text:tower?tower.textContent.replace(/\\s+/g,' ').trim():'',overflow:towerRoot.scrollWidth>towerRoot.clientWidth+1};
 document.getElementById('towerPageContent').hidden=true;document.getElementById('homeFeatureModal').hidden=false;window.v174OpenRelicPage();window.vRelicProgressionOpenBox('relicChoiceBoxPurple');var choice=document.querySelector('.relic-choice-page');var choiceData={exists:!!choice,selects:choice?choice.querySelectorAll('select').length:-1,buttons:choice?choice.querySelectorAll('.relic-choice-grid button').length:0,overflow:body.scrollWidth>body.clientWidth+1};
 document.getElementById('result').textContent=JSON.stringify({installed:window.__relicProgressionDropSystemInstalled===true,detail:detail,boss:bossData,tower:towerData,choice:choiceData});
})();
</script></body></html>`;

fs.writeFileSync(fixture,html,"utf8");
try{
    const chrome=findChrome();
    const run=spawnSync(chrome,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--force-device-scale-factor=1","--window-size=390,844","--dump-dom",fileUrl],{encoding:"utf8",timeout:30000,maxBuffer:20*1024*1024});
    assert.equal(run.status,0,run.stderr||"Relic progression browser fixture failed");
    const match=run.stdout.match(/<pre id="result">([\s\S]*?)<\/pre>/);assert.ok(match,"Relic progression browser result missing");
    const decoded=match[1].replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#39;/g,"'");
    const data=JSON.parse(decoded);
    assert.equal(data.installed,true);
    assert.match(data.detail.text,/72 \/ 100/);assert.match(data.detail.text,/需要秘寶通用碎片 ×56/);assert.equal(data.detail.overflow,false);assert.equal(data.detail.panelOutside,false);
    assert.match(data.boss.text,/秘寶可能獲得/);assert.match(data.boss.text,/九龍神火罩碎片/);assert.equal(data.boss.overflow,false);
    assert.match(data.tower.text,/每 5 層/);assert.match(data.tower.text,/25 \/ 50 \/ 75 \/ 100/);assert.equal(data.tower.overflow,false);
    assert.equal(data.choice.exists,true);assert.equal(data.choice.selects,0,"Player-facing choice must not use native select");assert.ok(data.choice.buttons>=3);assert.equal(data.choice.overflow,false);
    console.log("✓ Relic progression 390x844 browser QA passed");
}finally{try{fs.unlinkSync(fixture);}catch(_){}}
