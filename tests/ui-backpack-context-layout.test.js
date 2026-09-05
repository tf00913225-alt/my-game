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
<link rel="stylesheet" href="css/24-stage-v85-inventory-inner-grid-scroll-root.css">
<link rel="stylesheet" href="css/49-v169-rpg-ui.css">
<style>
html,body{margin:0;width:420px;height:746.6667px;overflow:hidden;background:#000;}
#game-stage,#app,#game-content{position:relative!important;width:420px!important;height:746.6667px!important;overflow:hidden!important;transform:none!important;}
.content{position:absolute!important;inset:0!important;width:420px!important;box-sizing:border-box!important;transform:none!important;}
#inventoryPage{display:block!important;}
.inventory-character-panel{height:120px;}.inventory-right-panel{height:360px;}.inventory-grid-scroll{height:180px;overflow-y:auto!important;}
</style></head><body><div id="game-stage"><div id="app" class="on-inventory-page"><div id="game-content"><div class="content">
<div id="inventoryPage" class="page inventory-page-classic"><div class="inventory-classic-shell"><button class="map-inventory-overlay-close">返回</button><div class="inventory-character-switch">角色</div><div class="inventory-character-panel"></div><div class="inventory-right-panel"><div class="inventory-grid-scroll">${'<div style="height:400px"></div>'}</div></div></div></div>
</div></div></div></div><pre id="result"></pre><script>
(function(){
 const app=document.getElementById('app');
 const page=document.getElementById('inventoryPage');
 const shell=page.querySelector('.inventory-classic-shell');
 const close=page.querySelector('.map-inventory-overlay-close');
 const grid=page.querySelector('.inventory-grid-scroll');
 const rect=el=>{const r=el.getBoundingClientRect();return {left:r.left,top:r.top,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
 void page.offsetHeight;
 const standalone={page:rect(page),shell:rect(shell),shellWidth:getComputedStyle(shell).width,shellMaxWidth:getComputedStyle(shell).maxWidth,stageToken:getComputedStyle(document.getElementById('game-stage')).getPropertyValue('--ui-large-panel-max-width')};
 app.classList.remove('on-inventory-page');
 page.classList.add('map-inventory-overlay-open'); void page.offsetHeight;
 const overlay={page:rect(page),shell:rect(shell),close:rect(close),grid:rect(grid),gutter:getComputedStyle(grid).scrollbarGutter};
 document.getElementById('result').textContent=JSON.stringify({standalone,overlay});
})();
</script></body></html>`;
fs.writeFileSync(fixture,html,"utf8");
try{
    const run=cp.spawnSync(chrome,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--force-device-scale-factor=1","--window-size=420,747","--dump-dom",fileUrl],{encoding:"utf8",timeout:30000,maxBuffer:8*1024*1024});
    assert.equal(run.status,0,run.stderr||"Chrome backpack fixture failed");
    const match=run.stdout.match(/<pre id="result">([\s\S]*?)<\/pre>/);
    assert.ok(match,"backpack browser layout result missing");
    const data=JSON.parse(match[1].replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"'));
    console.log("Backpack geometry:",JSON.stringify(data));
    assert.ok(data.standalone.shell.width<=396.5,"standalone backpack shell must use Large Panel width ceiling");
    assert.ok(Math.abs(data.standalone.shell.left-(420-data.standalone.shell.width)/2)<0.5,"standalone backpack shell must be centered");
    assert.ok(data.overlay.page.width<=396.5,"map backpack overlay must use Large Panel width ceiling");
    assert.ok(Math.abs(data.overlay.page.left-(420-data.overlay.page.width)/2)<0.5,"map backpack overlay must be centered");
    assert.ok(Math.abs(data.overlay.page.top-12)<0.5,"map backpack overlay must keep 12px top safe margin");
    assert.ok(data.overlay.page.bottom<=746.6667-81.5,"map backpack overlay must stay above the bottom nav");
    assert.ok(data.overlay.close.height>=41.5&&data.overlay.close.width>=71.5,"overlay return control must remain a large touch target");
    assert.ok(data.overlay.shell.width<=data.overlay.page.width+0.5,"overlay shell must not create a second horizontal inset");
    assert.equal(data.overlay.gutter,"stable","inventory scroll owner must reserve stable scrollbar space");
    console.log("Headless Chrome: standalone and map backpack frames are aligned and scroll-safe");
}finally{
    try{fs.unlinkSync(fixture);}catch(_){ }
}
