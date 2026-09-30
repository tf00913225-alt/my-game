"use strict";
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
function sleep(ms){ return new Promise(resolve=>setTimeout(resolve,ms)); }
async function freePort(){
    return new Promise((resolve,reject)=>{
        const server=net.createServer();
        server.once("error",reject);
        server.listen(0,"127.0.0.1",()=>{const p=server.address().port;server.close(()=>resolve(p));});
    });
}
async function connectChrome(chrome){
    const port=await freePort();
    const profile=fs.mkdtempSync(path.join(require("node:os").tmpdir(),"backpack-visual-"));
    const child=cp.spawn(chrome,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--remote-debugging-address=127.0.0.1",`--remote-debugging-port=${port}`,`--user-data-dir=${profile}`,"about:blank"],{stdio:["ignore","ignore","ignore"]});
    let target;
    for(let i=0;i<100&&!target;i++){try{const list=await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();target=list.find(x=>x.type==="page"&&x.webSocketDebuggerUrl);}catch(_){ }if(!target) await sleep(50);}
    assert.ok(target,"Chrome DevTools target unavailable");
    const socket=new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve,reject)=>{socket.addEventListener("open",resolve,{once:true});socket.addEventListener("error",reject,{once:true});});
    let id=0;const pending=new Map();
    socket.addEventListener("message",event=>{const message=JSON.parse(String(event.data));if(message.id&&pending.has(message.id)){const p=pending.get(message.id);pending.delete(message.id);message.error?p.reject(new Error(message.error.message)):p.resolve(message.result);}});
    const send=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});socket.send(JSON.stringify({id:n,method,params}));});
    return {send,close:()=>{socket.close();child.kill("SIGKILL");fs.rmSync(profile,{recursive:true,force:true});}};
}

const chrome=findChrome();
if(!chrome){
    if(process.env.CI) throw new Error("Backpack Browser Visual QA requires Chrome/Chromium in CI");
    console.log("Backpack Browser Visual QA skipped: Chrome/Chromium not available");
    process.exit(0);
}
const root=process.cwd(),fixture=path.join(root,".backpack-visual-qa.html");
const slots=Array.from({length:18},(_,i)=>`<button class="inventory-item-classic ${i===2?"rarity-orange is-selected":"rarity-white"}"><span class="inventory-icon"><img src="assets/items/placeholder.png" alt="正式物品圖示"></span><b class="inventory-count">${i+1}</b></button>`).join("");
const fixtureHtml=`<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="css/22-stage-v78-character-inventory-core.css"></head><body><main id="game-stage"><div id="app" class="on-inventory-page"><div id="inventoryPage" class="inventory-page-classic"><div class="inventory-classic-shell"><div class="inventory-title-plate"><span class="inventory-title-plate-kicker">INVENTORY</span><h2>行囊</h2><button class="map-inventory-overlay-close">關閉</button></div><div class="inventory-character-switch"><button class="inventory-character-arrow">‹</button><span class="inventory-character-name">角色一 <small>Lv.40</small></span><button class="inventory-character-arrow">›</button></div><div class="inventory-character-stage"><div class="inventory-portrait-frame"><img class="v131-inventory-portrait" src="assets/characters/battle_male_fire.png" alt="角色立繪"></div><div class="inventory-equipment-grid">${Array.from({length:6},(_,i)=>`<div class="inventory-equipment-cell"><div class="inventory-equipment-slot"><span class="inventory-equipment-icon">${i+1}</span></div><span class="inventory-equipment-slot-label">部位${i+1}</span></div>`).join("")}</div></div><div class="inventory-right-panel"><div class="inventory-wallet-bar"><span class="inventory-wallet-label">金幣</span><b class="inventory-wallet-value">3,992,967</b></div><div class="inventory-category-tabs"><div class="inventory-category-tab active">裝備</div><div class="inventory-category-tab">物品</div><div class="inventory-category-tab">材料</div><div class="inventory-category-tab">功能</div></div><div class="v17350-bulk-sell-bar"><b>一鍵售出</b><select><option>紫階以下</option></select><button>售出 9 件</button><small>預計獲得 2,400 金幣</small></div><div id="inventoryGridScroll" class="inventory-grid-scroll"><div id="inventoryGrid" class="inventory-grid inventory-grid-classic">${slots}</div></div><div class="v141-inventory-pager"><button>←</button><span>1 / 7</span><button>→</button></div></div></div></div></div><pre id="result"></pre><script>window.__qa=()=>{const s=document.querySelector('.inventory-item-classic'),g=document.getElementById('inventoryGrid');return {bodyWidth:document.body.scrollWidth,slotWidth:s.getBoundingClientRect().width,slotHeight:s.getBoundingClientRect().height,selected:!!document.querySelector('.is-selected'),title:document.querySelector('.inventory-title-plate h2').textContent,overflow:getComputedStyle(document.body).overflowX}};</script></body></html>`;
fs.writeFileSync(fixture,fixtureHtml,"utf8");
(async()=>{
    const browser=await connectChrome(chrome);
    try{
        for(const [width,height] of [[360,800],[390,844],[412,915],[430,932]]){
            await browser.send("Emulation.setDeviceMetricsOverride",{width,height,deviceScaleFactor:1,mobile:true,screenWidth:width,screenHeight:height,screenOrientation:{type:"portraitPrimary",angle:0}});
            await browser.send("Page.navigate",{url:`file://${fixture}`});
            await sleep(180);
            const result=await browser.send("Runtime.evaluate",{expression:"window.__qa()",returnByValue:true});
            const data=result.result.value;
            assert.equal(data.bodyWidth,width,`horizontal overflow at ${width}px`);
            assert.ok(Math.abs(data.slotWidth-data.slotHeight)<1,`slot is not square at ${width}px`);
            assert.equal(data.selected,true);assert.equal(data.title,"行囊");
            const shot=await browser.send("Page.captureScreenshot",{format:"png",fromSurface:true,captureBeyondViewport:false});
            const file=path.join(root,"artifacts/browser-qa",`backpack-${width}.png`);
            fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,Buffer.from(shot.data,"base64"));
        }
        console.log("✓ Backpack Browser Visual QA passed: 360/390/412/430px");
    }finally{browser.close();try{fs.unlinkSync(fixture);}catch(_){ }}
})().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
