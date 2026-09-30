"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const cp=require("node:child_process");

function findChrome(){
    for(const name of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){
        const result=cp.spawnSync("bash",["-lc",`command -v ${name}`],{encoding:"utf8"});
        if(result.status===0&&result.stdout.trim()){ return result.stdout.trim(); }
    }
    return "";
}

const chrome=findChrome();
if(!chrome){
    if(process.env.CI){ throw new Error("Backpack Browser Visual QA requires Chrome/Chromium in CI"); }
    console.log("Backpack Browser Visual QA skipped: Chrome/Chromium not available");
    process.exit(0);
}

const root=process.cwd();
const fixture=path.join(root,".backpack-visual-qa.html");
const slots=Array.from({length:18},(_,index)=>`<button class="inventory-item-classic ${index===2?"rarity-orange is-selected":"rarity-white"}"><span class="inventory-icon"><img src="assets/items/placeholder.png" alt="正式物品圖示"></span><b class="inventory-count">${index+1}</b></button>`).join("");
const fixtureHtml=`<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="css/22-stage-v78-character-inventory-core.css"></head><body><main id="game-stage"><div id="app" class="on-inventory-page"><div id="inventoryPage" class="inventory-page-classic"><div class="inventory-classic-shell"><div class="inventory-title-plate"><span class="inventory-title-plate-kicker">INVENTORY</span><h2>行囊</h2><button class="map-inventory-overlay-close">關閉</button></div><div class="inventory-character-switch"><button class="inventory-character-arrow">‹</button><span class="inventory-character-name">角色一 <small>Lv.40</small></span><button class="inventory-character-arrow">›</button></div><div class="inventory-character-stage"><div class="inventory-portrait-frame"><img class="v131-inventory-portrait" src="assets/characters/battle_male_fire.png" alt="角色立繪"></div><div class="inventory-equipment-grid">${Array.from({length:6},(_,i)=>`<div class="inventory-equipment-cell"><div class="inventory-equipment-slot"><span class="inventory-equipment-icon">${i+1}</span></div><span class="inventory-equipment-slot-label">部位${i+1}</span></div>`).join("")}</div></div><div class="inventory-right-panel"><div class="inventory-wallet-bar"><span class="inventory-wallet-label">金幣</span><b class="inventory-wallet-value">3,992,967</b></div><div class="inventory-category-tabs"><div class="inventory-category-tab active">裝備</div><div class="inventory-category-tab">物品</div><div class="inventory-category-tab">材料</div><div class="inventory-category-tab">功能</div></div><div class="v17350-bulk-sell-bar"><b>一鍵售出</b><select><option>紫階以下</option></select><button>售出 9 件</button><small>預計獲得 2,400 金幣</small></div><div id="inventoryGridScroll" class="inventory-grid-scroll"><div id="inventoryGrid" class="inventory-grid inventory-grid-classic">${slots}</div></div><div class="v141-inventory-pager"><button>←</button><span>1 / 7</span><button>→</button></div></div></div></div></div><pre id="result"></pre><script>requestAnimationFrame(()=>{const slot=document.querySelector('.inventory-item-classic');const grid=document.getElementById('inventoryGrid');document.getElementById('result').textContent=JSON.stringify({width:innerWidth,bodyWidth:document.body.scrollWidth,gridWidth:grid.getBoundingClientRect().width,slotWidth:slot.getBoundingClientRect().width,slotHeight:slot.getBoundingClientRect().height,selected:!!document.querySelector('.is-selected'),title:document.querySelector('.inventory-title-plate h2').textContent});});</script></body></html>`;
fs.writeFileSync(fixture,fixtureHtml,"utf8");
try{
    for(const [width,height] of [[360,800],[390,844],[412,915],[430,932]]){
        const screenshot=path.join(root,"artifacts/browser-qa",`backpack-${width}.png`);
        fs.mkdirSync(path.dirname(screenshot),{recursive:true});
        const run=cp.spawnSync(chrome,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--force-device-scale-factor=1",`--window-size=${width},${height}`,"--virtual-time-budget=1000",`--screenshot=${screenshot}`,"--dump-dom",`file://${fixture}`],{encoding:"utf8",timeout:30000,maxBuffer:12*1024*1024});
        assert.equal(run.status,0,run.stderr||`browser failed at ${width}px`);
        const match=run.stdout.match(/<pre id="result">([\s\S]*?)<\/pre>/);
        assert.ok(match&&match[1],`missing visual result at ${width}px`);
        const data=JSON.parse(match[1]);
        assert.equal(data.width,width);
        assert.equal(data.bodyWidth,width,`horizontal overflow at ${width}px`);
        assert.ok(Math.abs(data.slotWidth-data.slotHeight)<1,`slot is not square at ${width}px`);
        assert.equal(data.selected,true);
        assert.equal(data.title,"行囊");
    }
    console.log("✓ Backpack Browser Visual QA passed: 360/390/412/430px");
}finally{
    try{fs.unlinkSync(fixture);}catch(_){ }
}
