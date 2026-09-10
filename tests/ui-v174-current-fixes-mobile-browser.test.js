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
    return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="css/00-main.css">
<link rel="stylesheet" href="css/56-v174-critical-ui-regressions.css">
<link rel="stylesheet" href="css/57-v174-current-ui-fixes.css">
<!-- These feature styles intentionally load after the app-shell patch, matching runtime order. -->
<link rel="stylesheet" href="css/22-stage-v78-character-inventory-core.css">
<link rel="stylesheet" href="css/42-v146-system-polish.css">
<link rel="stylesheet" href="css/43-v148-combat-dungeon-fixes.css">
<link rel="stylesheet" href="css/50-v169-abyss-flow.css">
<link rel="stylesheet" href="css/gameplay-boss-tower.css">
<link rel="stylesheet" href="css/55-team-relic-system.css">
<style>
html,body{margin:0;width:${width}px;height:${height}px;overflow:hidden;background:#050505;}
#game-stage{position:relative!important;width:${width}px!important;height:${height}px!important;transform:none!important;overflow:hidden!important;}
#homePage{display:block!important;position:relative!important;width:${width}px!important;height:${Math.min(height,760)}px!important;margin:0!important;padding:0!important;}
.home-card-grid{position:relative;width:100%;height:360px;}
.qa-normal-card{position:absolute;left:8px;top:8px;width:80px;height:82px;}
.team-relic-home-tools{position:absolute!important;left:100px!important;right:auto!important;bottom:0!important;width:192px!important;}
#v146HomeRoster{position:relative!important;}
#gameplayPage{display:block!important;width:100%;height:180px;}
.gameplay-large-panel{height:160px!important;}
#inventoryPage{display:block!important;width:390px!important;height:160px!important;padding:0!important;}
.inventory-grid-classic{width:72px!important;display:grid!important;grid-template-columns:72px!important;}
.inventory-item-classic{width:72px!important;height:72px!important;aspect-ratio:auto!important;}
.inventory-icon{width:100%!important;height:100%!important;}
#allElementSkillPreviewModal{display:block!important;}
#allElementSkillPreviewModal .skill-preview-body{width:350px;}
.v17361-reward-preview{width:350px;}
</style></head><body><div id="game-stage">
<div id="homePage"><div class="home-card-grid"><button class="home-card home-card-secondary qa-normal-card"><span class="home-card-icon"></span><span id="normalLabel" class="home-card-label">系統</span></button><div class="home-utility-actions team-relic-home-tools"><button class="home-card home-card-utility team-relic-home-entry"><span class="home-card-icon"></span><span id="relicLabel" class="home-card-label">秘寶</span></button><button class="home-card home-card-utility team-element-box-home-entry"><span class="home-card-icon"></span><span id="elementLabel" class="home-card-label">元素匣</span></button></div></div><section id="v146HomeRoster" class="v146-home-roster"><header>冒險隊伍</header><div class="v146-home-character">角色</div></section></div>
<div id="gameplayPage" class="gameplay-page"><section class="gameplay-large-panel"><header class="gameplay-panel-header"><div><small>特殊戰鬥總覽</small><h2>玩法</h2></div></header></section></div>
<div id="allElementSkillPreviewModal"><div id="skillBody" class="skill-preview-body"></div></div>
<div id="inventoryPage"><div class="inventory-grid-classic"><button class="inventory-item-classic"><span class="inventory-icon"><span id="equipmentArt" class="v169-item-art v169-equipment-art v169-rarity-blue"><img id="equipmentImg" alt="" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect width='100' height='100' fill='%23c88f30'/%3E%3C/svg%3E"></span></span></button></div></div>
<div class="v17361-reward-preview"><div id="rewardVisual" class="v17361-reward-visual equipment"><div id="rewardIcon" class="v17361-reward-icon rarity-white"><img alt=""><em>40%</em></div></div><div id="chestCount" class="v17361-chest-count">×2</div></div>
<pre id="result"></pre></div><script>window.showPage=function(name){window.__qaPage=name;};</script><script src="js/62-v174-current-ui-fixes.js"></script><script>
document.addEventListener("DOMContentLoaded",function(){
 var q=function(s){return document.querySelector(s);};var rect=function(el){var r=el.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
 var back=q('.v174-gameplay-home-back');if(back){back.click();}
 var art=q('#equipmentArt'),img=q('#equipmentImg'),header=q('#gameplayPage .gameplay-panel-header');
 q('#result').textContent=JSON.stringify({
  labels:{normal:getComputedStyle(q('#normalLabel')).fontSize,relic:getComputedStyle(q('#relicLabel')).fontSize,element:getComputedStyle(q('#elementLabel')).fontSize,relicLine:getComputedStyle(q('#relicLabel')).lineHeight},
  roster:{marginTop:getComputedStyle(q('#v146HomeRoster')).marginTop,gap:getComputedStyle(q('#v146HomeRoster')).gap,charHeight:rect(q('.v146-home-character')).height},
  gameplay:{count:document.querySelectorAll('.v174-gameplay-home-back').length,back:back?rect(back):null,header:rect(header),page:window.__qaPage||''},
  hint:{font:getComputedStyle(q('#skillBody'),'::before').fontSize,content:getComputedStyle(q('#skillBody'),'::before').content},
  equipment:{art:rect(art),img:rect(img),objectFit:getComputedStyle(img).objectFit,transform:getComputedStyle(img).transform},
  preview:{icon:getComputedStyle(q('#rewardIcon')).display,chest:getComputedStyle(q('#chestCount')).display,content:getComputedStyle(q('#rewardVisual'),'::before').content}
 });
},{once:true});
</script></body></html>`;
}
function run(chrome,width,height){
    const file=path.join(process.cwd(),`.v174-current-ui-browser-qa-${width}.html`);
    fs.writeFileSync(file,fixture(width,height),"utf8");
    try{
        const fileUrl="file://"+file.replace(/\\/g,"/");
        const result=spawnSync(chrome,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--force-device-scale-factor=1",`--window-size=${width},${height}`,"--dump-dom",fileUrl],{encoding:"utf8",timeout:30000,maxBuffer:12*1024*1024});
        assert.equal(result.status,0,result.stderr||`V174 UI ${width}px browser fixture failed`);
        const match=result.stdout.match(/<pre id="result">([\s\S]*?)<\/pre>/);
        assert.ok(match,`V174 UI ${width}px browser result missing`);
        return JSON.parse(decodeHtml(match[1]));
    }finally{ try{fs.unlinkSync(file);}catch(_){ } }
}
function verify(data,width){
    assert.equal(data.labels.normal,"13px");
    assert.equal(data.labels.relic,data.labels.normal,`${width}px relic label differs from normal home label`);
    assert.equal(data.labels.element,data.labels.normal,`${width}px element-box label differs from normal home label`);
    assert.equal(data.labels.relicLine,"18px");
    assert.equal(data.roster.marginTop,"4px");assert.equal(data.roster.gap,"2px");assert.ok(data.roster.charHeight<=78.5);
    assert.equal(data.gameplay.count,1);assert.equal(data.gameplay.page,"home");
    assert.ok(data.gameplay.back.right<=data.gameplay.header.right+1&&data.gameplay.back.left>data.gameplay.header.left+data.gameplay.header.width/2,`${width}px gameplay return is not in the header right side`);
    assert.equal(data.hint.font,"16px");assert.match(data.hint.content,/土剋水.*水剋火.*火剋風.*風剋土/);
    assert.ok(data.equipment.art.width>=60&&data.equipment.art.height>=60,`${width}px equipment art collapsed`);
    assert.ok(data.equipment.img.width>=data.equipment.art.width-8&&data.equipment.img.height>=data.equipment.art.height-8,`${width}px equipment image does not fill its safe square`);
    assert.equal(data.equipment.objectFit,"contain");assert.equal(data.equipment.transform,"none");
    assert.equal(data.preview.icon,"none");assert.equal(data.preview.chest,"none");assert.match(data.preview.content,/裝備寶箱.*×2/);
}
const chrome=findChrome();
if(!chrome){
    if(process.env.CI){throw new Error("CI must provide Chrome for V174 current UI browser QA");}
    console.log("V174 current UI browser QA skipped: Chrome not available");
}else{
    for(const [width,height] of [[390,844],[412,915]]){verify(run(chrome,width,height),width);}
    console.log("✓ V174 current UI mobile browser QA passed at 390px and 412px");
}
