"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const cp=require("node:child_process");
const net=require("node:net");
const root=path.resolve(__dirname,"..");
const findChrome=()=>{
    const configured=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
    if(configured&&fs.existsSync(configured))return configured;
    return ["google-chrome","google-chrome-stable","chromium","chromium-browser"].map(name=>cp.spawnSync("bash",["-lc",`command -v ${name}`],{encoding:"utf8"})).find(r=>r.status===0&&r.stdout.trim())?.stdout.trim()||"";
};

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function freePort(){return new Promise((resolve,reject)=>{const server=net.createServer();server.once("error",reject);server.listen(0,"127.0.0.1",()=>{const port=server.address().port;server.close(()=>resolve(port));});});}
async function connectChrome(chrome){
    const port=await freePort(),profile=fs.mkdtempSync(path.join(require("node:os").tmpdir(),"backpack-runtime-"));
    const child=cp.spawn(chrome,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--remote-debugging-address=127.0.0.1",`--remote-debugging-port=${port}`,`--user-data-dir=${profile}`,"about:blank"],{stdio:["ignore","ignore","pipe"]});
    let stderr="",launchError,exit;
    child.stderr?.on("data",chunk=>{stderr=(stderr+String(chunk)).slice(-4000);});
    child.once("error",error=>{launchError=error;});
    child.once("exit",(code,signal)=>{exit={code,signal};});
    let socket,id=0;const pending=new Map();
    const rejectPending=error=>{for(const request of pending.values()){clearTimeout(request.timer);request.reject(error);}pending.clear();};
    const close=async()=>{rejectPending(new Error("Backpack Chrome connection closed"));socket?.close();if(child.exitCode===null){child.kill("SIGKILL");await new Promise(resolve=>child.once("exit",resolve));}await fs.promises.rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});};
    try{
        // Match the existing shared browser readiness budget, not 100 polls.
        let target,lastProbe="not attempted";const deadline=Date.now()+15000;
        while(!target&&Date.now()<deadline){
            if(launchError||exit)throw new Error(`Backpack Chrome launch failed: ${launchError?.message||JSON.stringify(exit)}\n${stderr}`);
            try{
                const response=await fetch(`http://127.0.0.1:${port}/json/list`,{signal:AbortSignal.timeout(1000)});
                const targets=await response.json();
                lastProbe=JSON.stringify({status:response.status,targets:targets.map(row=>({type:row.type,debugger:!!row.webSocketDebuggerUrl}))});
                target=targets.find(row=>row.type==="page"&&row.webSocketDebuggerUrl);
            }catch(error){lastProbe=String(error.stack||error)+(error.cause?" cause="+String(error.cause):"");}
            if(!target)await sleep(50);
        }
        assert.ok(target,`Chrome DevTools target unavailable within 15 seconds: ${JSON.stringify({chrome,pid:child.pid,port,exit:exit||null,lastProbe})}\n${stderr}`);
        socket=new WebSocket(target.webSocketDebuggerUrl);
        await new Promise((resolve,reject)=>{
            const timer=setTimeout(()=>reject(new Error("Backpack Chrome socket open timed out")),5000);
            socket.addEventListener("open",()=>{clearTimeout(timer);resolve();},{once:true});
            socket.addEventListener("error",()=>{clearTimeout(timer);reject(new Error("Backpack Chrome socket failed to open"));},{once:true});
        });
        socket.addEventListener("message",event=>{const message=JSON.parse(String(event.data));if(message.id&&pending.has(message.id)){const request=pending.get(message.id);pending.delete(message.id);clearTimeout(request.timer);message.error?request.reject(new Error(message.error.message)):request.resolve(message.result);}});
        socket.addEventListener("close",()=>rejectPending(new Error("Backpack Chrome socket closed before response")));
        socket.addEventListener("error",()=>rejectPending(new Error("Backpack Chrome socket error")));
        const send=(method,params={})=>new Promise((resolve,reject)=>{
            const next=++id;
            const timer=setTimeout(()=>{pending.delete(next);reject(new Error(`Backpack Chrome CDP timed out after 30 seconds: ${method}`));},30000);
            pending.set(next,{resolve,reject,timer});
            try{socket.send(JSON.stringify({id:next,method,params}));}catch(error){clearTimeout(timer);pending.delete(next);reject(error);}
        });
        return {send,close};
    }catch(error){await close();throw error;}
}

const chrome=findChrome();
if(!chrome){if(process.env.CI)throw new Error("Backpack Browser Visual QA requires Chrome/Chromium in CI");console.log("Backpack Browser Visual QA skipped: Chrome/Chromium not available");process.exit(0);}

const manifest=JSON.parse(fs.readFileSync(path.join(root,"build/asset-manifest.json"),"utf8"));
const stylePaths=[...(manifest.critical?.styles||[]),...Object.values(manifest.featureManifest?.bundles||{}).flatMap(bundle=>bundle.styles||[])].filter((file,index,all)=>file&&all.indexOf(file)===index);
assert.ok(stylePaths.some(file=>file.includes("gameplay-core")),"fixture must load the production gameplay CSS bundle");
const equipmentProgressionSource=fs.readFileSync(path.join(root,"js/equipment-progression.js"),"utf8");
const functionalFixesSource=fs.readFileSync(path.join(root,"js/58-v173.63-functional-fixes.js"),"utf8");
const context={window:{}};require("node:vm").runInNewContext(require("../.github/scripts/fixtures/item-slot-owner.cjs"),context);
const itemSlot=context.window.FourSymbolsItemSlot;
const injectedMaterialMatch=functionalFixesSource.match(/:is\(#game-stage,#game-ui\) \.v169-material-art:not\(\.inventory-backpack-rarity-neutral\)[\s\S]*?(?=#game-stage #dungeonPage)/);
assert.ok(injectedMaterialMatch,"fixture must source material rarity CSS from js/58 runtime injection");
const styles=stylePaths.map(file=>`<link rel="stylesheet" href="${file}">`).join("")+`<style id="functional-material-style">${injectedMaterialMatch[0]}</style>`;
const equipmentArt='<span class="v169-item-art v169-equipment-art v169-rarity-orange v17346-rarity-orange inventory-backpack-rarity-neutral"><img alt="裝備" src="data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'64\' height=\'64\'%3E%3Crect width=\'64\' height=\'64\' fill=\'%23c88f30\'/%3E%3C/svg%3E"></span>';
const equipmentKeys=["white","blue","purple","orange","pink","four-symbol"];
const equipmentByRarity=key=>equipmentArt.replaceAll("orange",key);
const slotAttributes=key=>`class="item-slot" data-item-rarity="${key}" style="${itemSlot.tokens({rarityKey:key})}"`;
const materialArt='<span class="v169-item-art v169-material-art v169-rarity-blue inventory-backpack-rarity-neutral"><img alt="材料" src="data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'64\' height=\'64\'%3E%3Crect width=\'64\' height=\'64\' fill=\'%2342a5ff\'/%3E%3C/svg%3E"></span>';

                                                 const rarities=["white","blue","purple","orange","red","myriad"];
const slots=Array.from({length:24},(_,index)=>`<button class="inventory-item-classic item-slot rarity-${rarities[index%rarities.length]}${index===3?" is-selected":""}" data-item-rarity="${equipmentKeys[index%6]}" style="${itemSlot.tokens({rarityKey:equipmentKeys[index%6]})}"><span class="inventory-icon">${index<6?equipmentByRarity(equipmentKeys[index]):index%2?materialArt:equipmentByRarity(equipmentKeys[index%6])}</span><b class="inventory-count">${index+1}</b></button>`).join("");
const equipment=Array.from({length:6},(_,index)=>`<div class="inventory-equipment-cell"><span class="inventory-equipment-slot-label">部位${index+1}</span><div class="inventory-equipment-slot item-slot" data-item-rarity="${equipmentKeys[index]}" style="${itemSlot.tokens({rarityKey:equipmentKeys[index]})}">${equipmentByRarity(equipmentKeys[index])}</div></div>`).join("");
const shopTints=equipmentKeys.map(key=>`<div class="v17346-gear-art">${itemSlot.art(equipmentByRarity(key).replace(" inventory-backpack-rarity-neutral",""),{type:"armor",rarityKey:key})}</div>`).join("");
const fixture=path.join(root,".backpack-visual-qa.html");
const html=`<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${styles}<style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#050708}#qa-native-stage{position:absolute;left:50%;top:50%;width:1080px;height:1920px;transform-origin:center;transform:translate(-50%,-50%) scale(min(calc(100vw / 1080px),calc(100vh / 1920px)))}#game-ui{width:1080px;height:1920px}#game-ui>#app{width:100%;height:100%;padding:0;margin:0}#shopTintProbes{position:absolute;left:-10000px}</style></head><body><div id="qa-native-stage"><main id="game-ui"><div id="app"><div id="inventoryPage"><div class="inventory-classic-shell"><header class="inventory-header"><div class="inventory-title-plate"><h2>背包</h2></div><button class="map-inventory-overlay-close">關閉</button></header><div class="inventory-character-switch"><button class="inventory-character-arrow">‹</button><span class="inventory-character-name">角色一 <small>Lv.40</small></span><button class="inventory-character-arrow">›</button></div><div class="inventory-character-stage"><div class="inventory-portrait-frame"><span>角色立繪</span></div><div class="inventory-equipment-grid">${equipment}</div></div><div class="inventory-right-panel"><div class="inventory-category-tabs"><div class="inventory-category-tab active">裝備</div><div class="inventory-category-tab">物品</div><div class="inventory-category-tab">材料</div><div class="inventory-category-tab">功能</div></div><div id="inventoryGridScroll" class="inventory-grid-scroll"><div id="inventoryGrid" class="inventory-grid-classic">${slots}</div></div><div class="inventory-bottom-actions"><button class="inventory-bottom-action">重新整理</button><div class="inventory-pagination-slot"><div class="v141-inventory-pager"><button>←</button><span>1 / 5</span><button>→</button></div></div><button class="inventory-bottom-action inventory-quick-sell-action">一鍵售出</button></div></div></div></div></div></main></div><section id="shopTintProbes">${shopTints}</section><script>window.__qa=()=>{const q=s=>document.querySelector(s),r=e=>{const x=e.getBoundingClientRect();return {left:x.left,right:x.right,top:x.top,bottom:x.bottom,width:x.width,height:x.height}},title=q('.inventory-title-plate'),close=q('.map-inventory-overlay-close'),shell=q('.inventory-classic-shell'),slots=[...document.querySelectorAll('.inventory-item-classic')];return {title:q('h2').textContent,titleRect:r(title),closeRect:r(close),shell:r(shell),slots:slots.map(slot=>({rarity:[...slot.classList].find(c=>c.startsWith('rarity-')),border:getComputedStyle(slot).border,borderWidth:getComputedStyle(slot).borderWidth,borderStyle:getComputedStyle(slot).borderStyle})),tints:[...document.querySelectorAll('.v169-equipment-art')].map(art=>({tier:(art.closest('.item-slot')||art).dataset.itemRarity,context:art.closest('#shopTintProbes')?'shop':art.closest('.inventory-equipment-slot')?'equipped':'bag',color:getComputedStyle(art.closest(".item-slot")||art).backgroundColor,image:getComputedStyle(art.closest(".item-slot")||art).backgroundImage,opacity:getComputedStyle(art.querySelector('img')).opacity})),arts:[...document.querySelectorAll('.inventory-backpack-rarity-neutral')].map(art=>({material:art.classList.contains('v169-material-art'),borderWidth:getComputedStyle(art).borderWidth,borderStyle:getComputedStyle(art).borderStyle,shadow:getComputedStyle(art).boxShadow,animation:getComputedStyle(art).animationName}))};};</script></body></html>`;
fs.writeFileSync(fixture,html,"utf8");

(async()=>{const browser=await connectChrome(chrome);try{for(const [width,height] of [[360,800],[390,844],[412,915],[430,932]]){await browser.send("Emulation.setDeviceMetricsOverride",{width,height,deviceScaleFactor:1,mobile:true,screenWidth:width,screenHeight:height,screenOrientation:{type:"portraitPrimary",angle:0}});await browser.send("Runtime.evaluate",{expression:"delete window.__qa"});await browser.send("Page.navigate",{url:`file://${fixture}`});await waitFixtureReady(browser);const data=(await browser.send("Runtime.evaluate",{expression:"window.__qa()",returnByValue:true})).result.value;assert.equal(data.title,"背包");assert.ok(data.titleRect.left>=data.shell.left&&data.titleRect.right<=data.closeRect.left,`compact title overlaps close at ${width}`);assert.ok(data.closeRect.right<=data.shell.right&&data.closeRect.height>=44&&data.closeRect.width>=44,`close geometry or touch target invalid at ${width}`);assert.equal(data.slots.length,24);for(const rarity of rarities){const slot=data.slots.find(row=>row.rarity===`rarity-${rarity}`);assert.equal(slot.borderWidth,"3px",`${rarity} must use one native outer frame`);assert.equal(slot.borderStyle,"solid",`${rarity} must use solid outer frame`);}for(const art of data.arts){assert.equal(art.borderWidth,"0px","inner artwork border leaked");assert.equal(art.borderStyle,"none","inner artwork border leaked");assert.equal(art.shadow,"none","inner artwork glow leaked");assert.equal(art.animation,"none","inner artwork animation leaked");}const tintColors={white:"rgba(216, 216, 216, 0.25)",blue:"rgba(66, 165, 255, 0.25)",purple:"rgba(176, 92, 255, 0.25)",orange:"rgba(255, 159, 56, 0.25)",pink:"rgba(255, 79, 167, 0.25)"};for(const context of ["shop","bag","equipped"]){assert.equal(new Set(data.tints.filter(x=>x.context===context).map(x=>x.tier)).size,6,context+" must cover all tiers");}for(const tint of data.tints){assert.equal(tint.opacity,"1","equipment image must remain opaque");if(tint.tier==="four-symbol"){for(const color of ["rgba(255, 90, 54, 0.25)","rgba(66, 165, 255, 0.25)","rgba(71, 214, 163, 0.25)","rgba(200, 155, 69, 0.25)"])assert.ok(tint.image.includes(color),"four-symbol translucent element missing");}else assert.ok(tint.image.includes(tintColors[tint.tier]),tint.context+" "+tint.tier+" full outer background must use 25% tier color");}const shot=await browser.send("Page.captureScreenshot",{format:"png",fromSurface:true,captureBeyondViewport:false});const out=path.join(root,"artifacts/browser-qa",`backpack-${width}.png`);fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,Buffer.from(shot.data,"base64"));}console.log("✓ Backpack Browser Visual QA passed: production CSS stack + single rarity frame 360/390/412/430px");}finally{await browser.close();try{fs.unlinkSync(fixture);}catch(_){}}})().catch(error=>{console.error(error.stack||error);process.exitCode=1;});

async function waitFixtureReady(browser){
    const deadline=Date.now()+15000;
    while(Date.now()<deadline){
        const probe=await browser.send("Runtime.evaluate",{expression:"document.readyState==='complete'&&typeof window.__qa==='function'&&Array.from(document.querySelectorAll('link[rel=stylesheet]')).every(link=>!!link.sheet)",returnByValue:true});
        if(probe.result?.value===true){
            const decoded=await browser.send("Runtime.evaluate",{expression:"Promise.all(Array.from(document.images,image=>image.decode())).then(()=>Array.from(document.images).every(image=>image.complete&&image.naturalWidth>0))",awaitPromise:true,returnByValue:true});
            assert.equal(decoded.result?.value,true,"Backpack fixture artwork must decode before visual measurements");
            return;
        }
        await sleep(50);
    }
    assert.fail("Backpack fixture document, styles and measurement function did not become ready within 15 seconds");
}

// CI trigger: preserve semantic Backpack art border assertions.
