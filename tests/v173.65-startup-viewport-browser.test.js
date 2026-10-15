"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const os=require("node:os");
const {spawnSync}=require("node:child_process");

function chrome(){
    for(const name of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){
        const probe=spawnSync("bash",["-lc",`command -v ${name}`],{encoding:"utf8"});
        if(probe.status===0&&probe.stdout.trim()){ return probe.stdout.trim(); }
    }
    return "";
}

const css=fs.readFileSync("css/51-v173.20-startup-loader.css","utf8");
assert.match(css,/body > #startupLoader\{[\s\S]*?position:fixed;[\s\S]*?width:100vw;[\s\S]*?height:100dvh;/);
assert.doesNotMatch(css,/body > #startupLoader\{[\s\S]*?width:1080px;[\s\S]*?height:1920px;/);
assert.doesNotMatch(css,/backdrop-filter\s*:/,"critical startup surface must not depend on a blur compositor layer");

const c=chrome();
if(!c){
    if(process.env.CI){ throw new Error("Chrome required for startup viewport QA"); }
    console.log("startup viewport browser QA skipped");
    process.exit(0);
}

const fixture=path.join(process.cwd(),".startup-viewport-regression.html");
fs.writeFileSync(fixture,`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="stylesheet" href="css/00-main.css"><link rel="stylesheet" href="css/51-v173.20-startup-loader.css"><style>html,body{margin:0;background:#111}#game-stage{position:relative;left:50vw;top:50vh;transform:scale(.36)}</style></head><body><div id="game-stage"></div><section id="startupLoader"><div class="startup-scene startup-city-scene is-active"><div class="startup-scene-image" style="background:#654"></div></div><div class="startup-loading-panel"><div class="startup-status-row"><div class="startup-status-copy"><div class="startup-status-title">登入前載入</div><div class="startup-status-detail">viewport regression probe</div></div><div class="startup-percent">50%</div></div><div class="startup-progress-track"><div class="startup-progress-fill" style="width:50%"></div></div></div></section><pre id="result"></pre><script>const root=document.getElementById('startupLoader'),panel=root.querySelector('.startup-loading-panel'),stage=document.getElementById('game-stage');const rect=e=>{const r=e.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}};document.getElementById('result').textContent=JSON.stringify({viewport:{width:innerWidth,height:innerHeight},stage:rect(stage),root:rect(root),panel:rect(panel),position:getComputedStyle(root).position});</script></body></html>`,"utf8");

(async()=>{
const {spawn}=require("node:child_process");
const {startServer,waitJson,Cdp}=await import("../.github/scripts/runtime-browser-qa-support.mjs");
const profile=fs.mkdtempSync(path.join(os.tmpdir(),"startup-viewport-"));
const server=await startServer();
const port=9300+process.pid%400;
const child=spawn(c,["--headless=new",`--user-data-dir=${profile}`,"--no-sandbox","--disable-dev-shm-usage",`--remote-debugging-port=${port}`,"about:blank"],{stdio:"ignore"});
let client;
try{
    const targets=await waitJson(`http://127.0.0.1:${port}/json/list`);
    client=new Cdp(targets.find(t=>t.type==="page").webSocketDebuggerUrl);
    await client.send("Page.enable");
    await client.send("Emulation.setDeviceMetricsOverride",{width:393,height:873,deviceScaleFactor:1,mobile:true});
    await client.send("Page.navigate",{url:server.url.replace("index.html",path.basename(fixture))});
    const data=await client.eval(`new Promise((resolve,reject)=>{let remaining=100;function sample(){const text=document.getElementById('result')?.textContent;if(text){resolve(JSON.parse(text));}else if(--remaining){setTimeout(sample,50);}else{reject(new Error('startup viewport probe result missing'));}}sample();})`);
    assert.equal(data.position,"fixed");
    assert.ok(Math.abs(data.root.left)<1&&Math.abs(data.root.top)<1,"startup surface must begin at viewport origin");
    assert.ok(Math.abs(data.root.width-data.viewport.width)<1,"startup width must equal real viewport width");
    assert.ok(Math.abs(data.root.height-data.viewport.height)<1,"startup height must equal real viewport height");
    assert.ok(data.panel.left>=0&&data.panel.right<=data.viewport.width+1,"startup panel must stay horizontally inside viewport");
    assert.ok(data.panel.top>=0&&data.panel.bottom<=data.viewport.height+1,"startup panel must stay vertically inside viewport");
    // The fixture explicitly reproduces the historical stage offset; canonical CSS no longer supplies it.
    assert.ok(data.stage.left>data.root.left||data.stage.top>data.root.top,"probe must preserve the mispositioned stage while startup escapes it");
    console.log("✓ startup critical surface covers the real mobile viewport",data);
}finally{
    client?.close();child.kill();
    await new Promise(resolve=>server.server.close(resolve));
    try{ fs.unlinkSync(fixture); }catch(_){ }
    try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:3});}catch(_){}
}
})().catch(error=>{console.error(error);process.exitCode=1;});
