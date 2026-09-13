"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {spawnSync}=require("node:child_process");

function chrome(){
    for(const name of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){
        const probe=spawnSync("bash",["-lc",`command -v ${name}`],{encoding:"utf8"});
        if(probe.status===0&&probe.stdout.trim()){ return probe.stdout.trim(); }
    }
    return "";
}
function decode(value){
    return value.replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#39;/g,"'");
}

const css=fs.readFileSync("css/51-v173.20-startup-loader.css","utf8");
assert.match(css,/#game-stage > #startupLoader\{[\s\S]*?position:fixed;[\s\S]*?width:100vw;[\s\S]*?height:100dvh;/);
assert.doesNotMatch(css,/#game-stage > #startupLoader\{[\s\S]*?width:1080px;[\s\S]*?height:1920px;/);
assert.doesNotMatch(css,/backdrop-filter\s*:/,"critical startup surface must not depend on a blur compositor layer");

const c=chrome();
if(!c){
    if(process.env.CI){ throw new Error("Chrome required for startup viewport QA"); }
    console.log("startup viewport browser QA skipped");
    process.exit(0);
}

const fixture=path.join(process.cwd(),".startup-viewport-regression.html");
fs.writeFileSync(fixture,`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="stylesheet" href="css/00-main.css"><link rel="stylesheet" href="css/51-v173.20-startup-loader.css"><style>html,body{margin:0;background:#111}</style></head><body><div id="game-stage"><section id="startupLoader"><div class="startup-scene startup-city-scene is-active"><div class="startup-scene-image" style="background:#654"></div></div><div class="startup-loading-panel"><div class="startup-status-row"><div class="startup-status-copy"><div class="startup-status-title">登入前載入</div><div class="startup-status-detail">viewport regression probe</div></div><div class="startup-percent">50%</div></div><div class="startup-progress-track"><div class="startup-progress-fill" style="width:50%"></div></div></div></section></div><pre id="result"></pre><script>const root=document.getElementById('startupLoader'),panel=root.querySelector('.startup-loading-panel'),stage=document.getElementById('game-stage');const rect=e=>{const r=e.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}};document.getElementById('result').textContent=JSON.stringify({viewport:{width:innerWidth,height:innerHeight},stage:rect(stage),root:rect(root),panel:rect(panel),position:getComputedStyle(root).position});</script></body></html>`,"utf8");

try{
    const run=spawnSync(c,["--headless=new","--no-sandbox","--disable-gpu","--allow-file-access-from-files","--window-size=393,873","--dump-dom","file://"+fixture.replace(/\\/g,"/")],{encoding:"utf8",timeout:30000,maxBuffer:8*1024*1024});
    assert.equal(run.status,0,run.stderr);
    const match=run.stdout.match(/<pre id="result">([\s\S]*?)<\/pre>/);
    assert.ok(match,"startup viewport probe result missing");
    const data=JSON.parse(decode(match[1]));
    assert.equal(data.position,"fixed");
    assert.ok(Math.abs(data.root.left)<1&&Math.abs(data.root.top)<1,"startup surface must begin at viewport origin");
    assert.ok(Math.abs(data.root.width-data.viewport.width)<1,"startup width must equal real viewport width");
    assert.ok(Math.abs(data.root.height-data.viewport.height)<1,"startup height must equal real viewport height");
    assert.ok(data.panel.left>=0&&data.panel.right<=data.viewport.width+1,"startup panel must stay horizontally inside viewport");
    assert.ok(data.panel.top>=0&&data.panel.bottom<=data.viewport.height+1,"startup panel must stay vertically inside viewport");
    // Regression signature from the reported screenshot was stage origin at roughly 50%/50%.
    assert.ok(data.stage.left>data.root.left||data.stage.top>data.root.top,"probe must preserve the mispositioned stage while startup escapes it");
    console.log("✓ startup critical surface covers the real mobile viewport",data);
}finally{
    try{ fs.unlinkSync(fixture); }catch(_){ }
}
