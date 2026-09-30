"use strict";
/* Production-stack fixture root is constrained to the emulated viewport. */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const cp=require("node:child_process");
const net=require("node:net");

function findChrome(){
    for(const name of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){
        const r=cp.spawnSync("bash",["-lc",`command -v ${name}`],{encoding:"utf8"});
        if(r.status===0&&r.stdout.trim()) return r.stdout.trim();
    }
    return "";
}
function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
async function freePort(){return new Promise((resolve,reject)=>{const s=net.createServer();s.once("error",reject);s.listen(0,"127.0.0.1",()=>{const p=s.address().port;s.close(()=>resolve(p));});});}
async function connectChrome(chrome){
    const port=await freePort(),profile=fs.mkdtempSync(path.join(require("node:os").tmpdir(),"backpack-runtime-"));
    const child=cp.spawn(chrome,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--remote-debugging-address=127.0.0.1",`--remote-debugging-port=${port}`,`--user-data-dir=${profile}`,"about:blank"],{stdio:["ignore","ignore","ignore"]});
    let target;
    for(let i=0;i<100&&!target;i++){try{const list=await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();target=list.find(x=>x.type==="page"&&x.webSocketDebuggerUrl);}catch(_){ }if(!target)await sleep(50);}
    assert.ok(target,"Chrome DevTools target unavailable");
    const socket=new WebSocket(target.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{socket.addEventListener("open",resolve,{once:true});socket.addEventListener("error",reject,{once:true});});
    let id=0;const pending=new Map();socket.addEventListener("message",event=>{const m=JSON.parse(String(event.data));if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(new Error(m.error.message)):p.resolve(m.result);}});
    const send=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});socket.send(JSON.stringify({id:n,method,params}));});
    return {send,close:()=>{socket.close();child.kill("SIGKILL");fs.rmSync(profile,{recursive:true,force:true});}};
}

const chrome=findChrome();
if(!chrome){
    if(process.env.CI)throw new Error("Backpack Browser Visual QA requires Chrome/Chromium in CI");
    console.log("Backpack Browser Visual QA skipped: Chrome/Chromium not available");
    process.exit(0);
}

const root=process.cwd(),fixture=path.join(root,".backpack-visual-qa.html");
const manifest=JSON.parse(fs.readFileSync(path.join(root,"build/asset-manifest.json"),"utf8"));
const stylePaths=[...(manifest.critical?.styles||[]),...Object.values(manifest.featureManifest?.bundles||{}).flatMap(bundle=>bundle.styles||[])].filter((v,i,a)=>v&&a.indexOf(v)===i);
assert.ok(stylePaths.some(file=>file.includes("gameplay-core")),"fixture must load the production gameplay CSS bundle");
const styleLinks=stylePaths.map(file=>`<link rel="stylesheet" href="${file}">`).join("");
const art=`<span class="v169-item-art v169-equipment-art v169-rarity-orange"><img alt="裝備" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64'%3E%3Crect width='64' height='64' fill='%23c88f30'/%3E%3C/svg%3E"></span>`;
const slots=Array.from({length:24},(_,i)=>`<button class="inventory-item-classic ${i===2?"rarity-orange is-selected":"rarity-orange"}"><span class="inventory-icon">${art}</span><b class="inventory-count">${i+1}</b></button>`).join("");
const equipment=Array.from({length:6},(_,i)=>`<div class="inventory-equipment-cell"><span class="inventory-equipment-slot-label">部位${i+1}</span><div class="inventory-equipment-slot"><span class="inventory-equipment-icon">${i+1}</span></div></div>`).join("");
const fixtureHtml=`<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${styleLinks}<style>html,body{margin:0;width:100%;min-height:100%;overflow-x:hidden;background:#050708}#game-stage,#game-stage>#app,#game-stage>#app>#game-content,#game-stage #inventoryPage{width:100%!important;min-width:0!important;max-width:100vw!important;overflow-x:visible}#game-stage{min-height:100vh;overflow:visible}#homeFeatureModal{display:none}.inventory-portrait-frame{min-height:0!important}</style></head><body><main id="game-stage"><div id="app" class="on-inventory-page"><div id="inventoryPage" class="inventory-page-classic"><div class="inventory-classic-shell"><div class="inventory-title-plate"><span class="inventory-title-plate-kicker">INVENTORY</span><h2>行囊</h2><button class="map-inventory-overlay-close">關閉</button></div><div class="inventory-character-switch"><button class="inventory-character-arrow">‹</button><span class="inventory-character-name">角色一 <small>Lv.40</small></span><button class="inventory-character-arrow">›</button></div><div class="inventory-character-stage"><div class="inventory-portrait-frame" id="inventoryPortraitFrame"><button id="inventoryCharacterDetailButton" class="inventory-character-detail-button">詳</button><span class="inventory-portrait-placeholder">角色立繪</span></div><div class="inventory-equipment-grid">${equipment}</div></div><div class="inventory-right-panel"><div class="inventory-wallet-bar"><span class="inventory-wallet-label">金幣</span><b class="inventory-wallet-value">3,992,967</b></div><div class="inventory-category-tabs"><div class="inventory-category-tab active">裝備</div><div class="inventory-category-tab">物品</div><div class="inventory-category-tab">材料</div><div class="inventory-category-tab">功能</div></div><div id="inventoryGridScroll" class="inventory-grid-scroll"><div id="inventoryGrid" class="inventory-grid inventory-grid-classic">${slots}</div></div><div class="inventory-bottom-actions" id="inventoryBottomActions"><button id="inventoryRefreshButton" class="inventory-bottom-action">重新整理</button><div id="inventoryPaginationSlot" class="inventory-pagination-slot"><div class="v141-inventory-pager"><button>←</button><span>1 / 5</span><button>→</button></div></div><button id="inventoryQuickSellButton" class="inventory-bottom-action inventory-quick-sell-action">一鍵售出</button></div></div></div></div></div></main><div id="homeFeatureModal"><div class="home-feature-modal-box"><div id="homeFeatureModalBody"></div></div></div><pre id="result"></pre><script>window.v17350OpenQuickSellModal=()=>{const m=document.getElementById('homeFeatureModal'),b=document.getElementById('homeFeatureModalBody');b.innerHTML='<select id="v17350QuickSellQuality"><option>紫階以下</option></select><b id="v17350QuickSellCount">9 件</b><b id="v17350QuickSellGold">2,400 金幣</b><button id="v17350QuickSellConfirm">確認售出</button><button onclick="v17350CloseQuickSellModal()">取消</button>';m.style.display='block';m.classList.add('show')};window.v17350CloseQuickSellModal=()=>{const m=document.getElementById('homeFeatureModal');m.style.display='none';m.classList.remove('show')};document.getElementById('inventoryQuickSellButton').onclick=window.v17350OpenQuickSellModal;window.__qa=()=>{const rect=e=>{const r=e.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}},cells=[...document.querySelectorAll('.inventory-equipment-cell')],slots=[...document.querySelectorAll('.inventory-equipment-slot')],labels=[...document.querySelectorAll('.inventory-equipment-slot-label')],portrait=document.querySelector('.inventory-portrait-frame'),detail=document.getElementById('inventoryCharacterDetailButton'),art=document.querySelector('.inventory-item-classic .v169-item-art'),first=document.querySelector('.inventory-item-classic');return {bodyWidth:Math.max(document.body.scrollWidth,document.documentElement.scrollWidth),slotWidth:first.getBoundingClientRect().width,slotHeight:first.getBoundingClientRect().height,selected:first.classList.contains('is-selected'),title:document.querySelector('.inventory-title-plate h2').textContent,bottomActions:document.querySelectorAll('#inventoryBottomActions>*').length,slotCount:document.querySelectorAll('#inventoryGrid .inventory-item-classic').length,detail:rect(detail),portrait:rect(portrait),slots:slots.map(rect),labels:labels.map(rect),cells:cells.map(rect),art:{border:getComputedStyle(art).border,shadow:getComputedStyle(art).boxShadow,animation:getComputedStyle(art).animationName}}}</script></body></html>`;
fs.writeFileSync(fixture,fixtureHtml,"utf8");

(async()=>{
    const browser=await connectChrome(chrome);
    try{
        for(const [width,height] of [[360,800],[390,844],[412,915],[430,932]]){
            await browser.send("Emulation.setDeviceMetricsOverride",{width,height,deviceScaleFactor:1,mobile:true,screenWidth:width,screenHeight:height,screenOrientation:{type:"portraitPrimary",angle:0}});
            await browser.send("Page.navigate",{url:`file://${fixture}`});await sleep(220);
            const data=(await browser.send("Runtime.evaluate",{expression:"window.__qa()",returnByValue:true})).result.value;
            assert.ok(data.bodyWidth<=width,`horizontal overflow at ${width}px`);
            assert.ok(Math.abs(data.slotWidth-data.slotHeight)<1,`item slot is not square at ${width}px`);
            assert.equal(data.selected,true);assert.equal(data.title,"行囊");assert.equal(data.bottomActions,3);assert.equal(data.slotCount,24);
            assert.ok(data.detail.width<=32&&data.detail.height<=32,`detail button too large at ${width}px`);
            assert.ok(data.detail.left>=data.portrait.left&&data.detail.right<=data.portrait.right,`detail button escaped portrait at ${width}px`);
            for(let i=0;i<6;i++){assert.ok(Math.abs(data.slots[i].width-data.slots[i].height)<1,`equipment slot ${i+1} is not square at ${width}px`);assert.ok(data.labels[i].top>=data.cells[i].top&&data.labels[i].bottom<=data.cells[i].bottom,`equipment label ${i+1} escaped cell at ${width}px`);}
            assert.equal(data.art.shadow,"none",`Backpack art rarity shadow leaked at ${width}px`);assert.equal(data.art.animation,"none",`Backpack art rarity animation leaked at ${width}px`);
            await browser.send("Runtime.evaluate",{expression:"document.getElementById('inventoryQuickSellButton').click()"});
            const modal=(await browser.send("Runtime.evaluate",{expression:"({open:document.getElementById('homeFeatureModal').classList.contains('show'),hasThreshold:!!document.getElementById('v17350QuickSellQuality'),hasCount:!!document.getElementById('v17350QuickSellCount'),hasGold:!!document.getElementById('v17350QuickSellGold')})",returnByValue:true})).result.value;
            assert.deepEqual(modal,{open:true,hasThreshold:true,hasCount:true,hasGold:true});await browser.send("Runtime.evaluate",{expression:"v17350CloseQuickSellModal()"});
            assert.equal((await browser.send("Runtime.evaluate",{expression:"document.getElementById('homeFeatureModal').classList.contains('show')",returnByValue:true})).result.value,false);
            const shot=await browser.send("Page.captureScreenshot",{format:"png",fromSurface:true,captureBeyondViewport:false});const file=path.join(root,"artifacts/browser-qa",`backpack-${width}.png`);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,Buffer.from(shot.data,"base64"));
        }
        console.log("✓ Backpack Browser Visual QA passed: production CSS stack + geometry 360/390/412/430px");
    }finally{browser.close();try{fs.unlinkSync(fixture);}catch(_){} }
})().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
