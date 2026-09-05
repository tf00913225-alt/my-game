"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const cp=require("node:child_process");

const shared=fs.readFileSync("css/49-v169-rpg-ui.css","utf8");

assert.match(shared,/#app\.on-inventory-page #inventoryPage\.inventory-page-classic:not\(\.map-inventory-overlay-open\) \.inventory-classic-shell\{[\s\S]*?width:calc\(100% - var\(--ui-large-panel-safe-space\)\) !important;[\s\S]*?max-width:var\(--ui-large-panel-max-width\) !important;/);
assert.match(shared,/#game-content #inventoryPage\.map-inventory-overlay-open\{[\s\S]*?left:50% !important;[\s\S]*?top:12px !important;[\s\S]*?bottom:82px !important;[\s\S]*?max-width:var\(--ui-large-panel-max-width\) !important;[\s\S]*?transform:translateX\(-50%\) !important;/);
assert.match(shared,/\.map-inventory-overlay-open \.inventory-classic-shell\{[\s\S]*?width:100% !important;[\s\S]*?margin:0 !important;/);
assert.match(shared,/\.map-inventory-overlay-open \.map-inventory-overlay-close\{[\s\S]*?min-width:72px !important;[\s\S]*?height:42px !important;[\s\S]*?font-size:15px !important;/);
assert.match(shared,/\.map-inventory-overlay-open \.inventory-grid-scroll\{[\s\S]*?scrollbar-gutter:stable !important;/);
assert.match(shared,/\.v169-dungeon-inventory-overlay\{[\s\S]*?z-index:900 !important;/);
assert.match(shared,/\.inventory-character-arrow\{[\s\S]*?width:44px !important;[\s\S]*?height:44px !important;[\s\S]*?border:1px solid #b88a42 !important;/);
assert.match(shared,/#inventoryPortraitFrame \.v131-inventory-portrait\{[\s\S]*?object-fit:contain !important;[\s\S]*?object-position:center center !important;/);
assert.match(shared,/#inventoryCharacterDetailButton::before\{[\s\S]*?content:"!" !important;/);

function findChrome(){
    for(const name of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){
        const result=cp.spawnSync("which",[name],{encoding:"utf8"});
        if(result.status===0&&result.stdout.trim()){ return result.stdout.trim(); }
    }
    return "";
}

const chrome=findChrome();
if(!chrome){
    console.log("Backpack context browser check skipped: Chrome not available");
    process.exit(0);
}

const fixture=path.join(process.cwd(),".ui-backpack-context-smoke.html");
const fileUrl="file://"+fixture.replace(/\\/g,"/");
const html=`<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="css/00-main.css">
<link rel="stylesheet" href="css/22-stage-v78-character-inventory-core.css">
<link rel="stylesheet" href="css/23-stage-v77-inventory-detail-ui.css">
<link rel="stylesheet" href="css/24-stage-v85-inventory-inner-grid-scroll-root.css">
<link rel="stylesheet" href="css/31-v131-fix-batch.css">
<link rel="stylesheet" href="css/49-v169-rpg-ui.css">
<style>
html,body{margin:0;width:420px;height:746.6667px;overflow:hidden;background:#000;}
#game-stage,#app,#game-content{position:relative!important;width:420px!important;height:746.6667px!important;overflow:hidden!important;}
.content{position:absolute!important;inset:0!important;width:420px!important;box-sizing:border-box!important;}
#inventoryPage{display:block!important;}
.inventory-character-panel{height:250px;}.inventory-right-panel{height:360px;}.inventory-grid-scroll{height:180px;overflow-y:auto!important;}
</style></head><body><div id="game-stage"><div id="app" class="on-inventory-page"><div id="game-content"><div class="content">
<div id="inventoryPage" class="page inventory-page-classic"><div class="inventory-classic-shell"><button class="map-inventory-overlay-close">返回</button><div class="inventory-character-switch"><button class="inventory-character-arrow">‹</button><div class="inventory-character-name">測試 Lv.10</div><button class="inventory-character-arrow">›</button></div><div class="inventory-character-panel"><div class="inventory-character-stage"><div class="inventory-portrait-frame" id="inventoryPortraitFrame"><img class="v131-inventory-portrait" alt=""><button id="inventoryCharacterDetailButton" class="inventory-character-detail-button">🔍</button></div></div></div><div class="inventory-right-panel"><div class="inventory-grid-scroll">${'<div style="height:400px"></div>'}</div></div></div></div>
</div></div></div></div><pre id="result"></pre><script>
(function(){
 const app=document.getElementById('app');
 const page=document.getElementById('inventoryPage');
 const shell=page.querySelector('.inventory-classic-shell');
 const close=page.querySelector('.map-inventory-overlay-close');
 const grid=page.querySelector('.inventory-grid-scroll');
 const arrow=page.querySelector('.inventory-character-arrow');
 const portrait=page.querySelector('.v131-inventory-portrait');
 const detail=page.querySelector('#inventoryCharacterDetailButton');
 const rect=el=>{const r=el.getBoundingClientRect();return {left:r.left,top:r.top,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
 const style=el=>{const s=getComputedStyle(el);return {width:s.width,maxWidth:s.maxWidth,height:s.height,minWidth:s.minWidth,top:s.top,bottom:s.bottom,transform:s.transform,scrollbarGutter:s.scrollbarGutter,borderRadius:s.borderRadius,objectFit:s.objectFit,fontSize:s.fontSize};};
 void page.offsetHeight;
 const presentation={arrow:style(arrow),portrait:style(portrait),detail:style(detail),detailGlyph:getComputedStyle(detail,'::before').content};
 const standalone={page:rect(page),shell:rect(shell),shellStyle:style(shell)};
 app.classList.remove('on-inventory-page');
 page.classList.add('map-inventory-overlay-open'); void page.offsetHeight;
 const overlay={page:rect(page),shell:rect(shell),close:rect(close),grid:rect(grid),pageStyle:style(page),closeStyle:style(close),gridStyle:style(grid)};
 document.getElementById('result').textContent=JSON.stringify({standalone,overlay,presentation});
})();
</script></body></html>`;
fs.writeFileSync(fixture,html,"utf8");
try{
    const run=cp.spawnSync(chrome,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--force-device-scale-factor=1","--window-size=420,747","--dump-dom",fileUrl],{encoding:"utf8",timeout:30000,maxBuffer:8*1024*1024});
    assert.equal(run.status,0,run.stderr||"Chrome backpack fixture failed");
    const match=run.stdout.match(/<pre id="result">([\s\S]*?)<\/pre>/);
    assert.ok(match,"backpack browser layout result missing");
    const data=JSON.parse(match[1].replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"'));
    assert.equal(data.standalone.shellStyle.width,"396px","standalone backpack shell must resolve to the Large Panel width");
    assert.equal(data.standalone.shellStyle.maxWidth,"396px","standalone backpack shell must keep the Large Panel width ceiling");
    assert.ok(Math.abs((data.standalone.shell.left-data.standalone.page.left)-(data.standalone.page.right-data.standalone.shell.right))<1,"standalone backpack shell must be centered after stage projection");
    assert.equal(data.overlay.pageStyle.width,"396px","map backpack overlay must resolve to the Large Panel width");
    assert.equal(data.overlay.pageStyle.maxWidth,"396px","map backpack overlay must keep the Large Panel width ceiling");
    assert.equal(data.overlay.pageStyle.top,"12px","map backpack overlay must keep the top safe margin");
    assert.equal(data.overlay.pageStyle.bottom,"82px","map backpack overlay must stay above the bottom nav");
    assert.equal(data.overlay.closeStyle.height,"42px","overlay return control must keep a 42px height");
    assert.equal(data.overlay.closeStyle.minWidth,"72px","overlay return control must keep a 72px minimum width");
    assert.ok(Math.abs((data.overlay.shell.left-data.overlay.page.left)-(data.overlay.page.right-data.overlay.shell.right))<1,"overlay shell must use only the outer panel padding");
    assert.equal(data.overlay.gridStyle.scrollbarGutter,"stable","inventory scroll owner must reserve stable scrollbar space");
    assert.equal(data.presentation.arrow.width,"44px","character switch control must use the polished 44px touch target");
    assert.equal(data.presentation.arrow.height,"44px","character switch control must remain square");
    assert.equal(data.presentation.arrow.borderRadius,"50%","character switch control must be circular");
    assert.equal(data.presentation.portrait.objectFit,"contain","character artwork must never be cropped by the portrait frame");
    assert.equal(data.presentation.detail.fontSize,"0px","legacy magnifier glyph must be visually suppressed");
    assert.equal(data.presentation.detailGlyph,'"!"',"character detail affordance must render an exclamation mark");
    console.log("Headless Chrome: backpack frame, portrait and character controls are aligned and crop-safe");
}finally{
    try{fs.unlinkSync(fixture);}catch(_){ }
}
