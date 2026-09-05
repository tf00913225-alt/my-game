"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const cp=require("node:child_process");

const css=fs.readFileSync("css/33-v132-content-expansion.css","utf8");

assert.match(css,/--ui-reward-dialog-max-width:340px;/);
assert.match(css,/--ui-reward-dialog-height:300px;/);
assert.match(css,/\.v132-reward-modal-inner\{[\s\S]*?width:min\(100%,var\(--ui-reward-dialog-max-width\)\);[\s\S]*?height:min\(var\(--ui-reward-dialog-height\),calc\(100dvh - 32px\)\);[\s\S]*?overflow-y:auto;/);
assert.match(css,/\.v132-reward-modal-inner h3\{[\s\S]*?position:sticky;[\s\S]*?top:0;/);
assert.match(css,/\.v132-reward-actions\{[\s\S]*?position:sticky;[\s\S]*?bottom:0;/);
assert.match(css,/\.v132-reward-actions button\{[\s\S]*?min-height:44px;/);
assert.match(css,/\.v132-ticket-preview-modal\{[\s\S]*?--ui-reward-preview|max-width:var\(--ui-reward-preview-max-width\);/);
assert.match(css,/\.v132-ticket-preview-modal\{[\s\S]*?height:min\(var\(--ui-reward-preview-height\),calc\(100dvh - 24px\)\);[\s\S]*?overflow:hidden;/);
assert.match(css,/\.v132-ticket-preview-modal \.v132-preview-grid\{[\s\S]*?grid-template-rows:repeat\(5,minmax\(0,1fr\)\);[\s\S]*?overflow:visible;/);

function findChrome(){
    for(const name of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){
        const result=cp.spawnSync("which",[name],{encoding:"utf8"});
        if(result.status===0&&result.stdout.trim()){ return result.stdout.trim(); }
    }
    return "";
}

const chrome=findChrome();
if(!chrome){
    console.log("Reward dialog browser check skipped: Chrome not available");
    process.exit(0);
}

const fixture=path.join(process.cwd(),".ui-reward-dialog-smoke.html");
const fileUrl="file://"+fixture.replace(/\\/g,"/");
const html=`<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="css/33-v132-content-expansion.css">
<style>html,body{margin:0;width:420px;height:746.6667px;overflow:hidden;background:#000}.v132-reward-modal{display:flex!important}</style>
</head><body><div class="v132-reward-modal"><div class="v132-reward-modal-inner"><h3>副本獎勵</h3><div id="content"></div><div class="v132-reward-actions"><button id="action">直接領取</button></div></div></div><pre id="result"></pre><script>
(function(){
 const box=document.querySelector('.v132-reward-modal-inner');
 const title=box.querySelector('h3');
 const action=document.getElementById('action');
 const content=document.getElementById('content');
 const rect=el=>{const r=el.getBoundingClientRect();return {top:r.top,left:r.left,width:r.width,height:r.height,bottom:r.bottom};};
 content.innerHTML=Array.from({length:30},(_,i)=>'<p>獎勵內容 '+i+'：測試說明文字</p>').join('');
 void box.offsetHeight;
 const before={box:rect(box),title:rect(title),action:rect(action),scrollHeight:box.scrollHeight,clientHeight:box.clientHeight,overflow:getComputedStyle(box).overflowY,titlePos:getComputedStyle(title).position,actionPos:getComputedStyle(action.parentElement).position,buttonHeight:rect(action).height};
 box.scrollTop=box.scrollHeight;
 void box.offsetHeight;
 const after={box:rect(box),title:rect(title),action:rect(action),scrollTop:box.scrollTop};
 document.getElementById('result').textContent=JSON.stringify({before,after});
})();
</script></body></html>`;

fs.writeFileSync(fixture,html,"utf8");
try{
    const run=cp.spawnSync(chrome,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--force-device-scale-factor=1","--window-size=420,747","--dump-dom",fileUrl],{encoding:"utf8",timeout:30000,maxBuffer:8*1024*1024});
    assert.equal(run.status,0,run.stderr||"Chrome reward dialog fixture failed");
    const match=run.stdout.match(/<pre id="result">([\s\S]*?)<\/pre>/);
    assert.ok(match,"reward dialog browser result missing");
    const data=JSON.parse(match[1].replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"'));
    assert.ok(data.before.box.width<=340.5&&data.before.box.width>=330,"generic reward dialog must use the compact width");
    assert.ok(Math.abs(data.before.box.height-300)<1,"generic reward dialog must keep a 300px frame");
    assert.equal(data.before.overflow,"auto","generic reward dialog must own vertical scrolling");
    assert.ok(data.before.scrollHeight>data.before.clientHeight,"long reward content must overflow internally");
    assert.equal(data.before.titlePos,"sticky","reward title must stay sticky");
    assert.equal(data.before.actionPos,"sticky","reward action row must stay sticky");
    assert.ok(data.before.buttonHeight>=44,"reward action must remain touch friendly");
    assert.ok(data.after.scrollTop>0,"reward dialog must actually scroll");
    assert.ok(Math.abs(data.before.box.top-data.after.box.top)<0.25&&Math.abs(data.before.box.height-data.after.box.height)<0.25,"reward frame must not move while scrolling");
    assert.ok(data.after.title.top>=data.after.box.top-1,"sticky reward title must remain visible after scrolling");
    assert.ok(data.after.action.bottom<=data.after.box.bottom+1,"sticky reward action must remain inside the frame after scrolling");
    console.log("Headless Chrome: generic reward dialog keeps a compact fixed frame with sticky title/actions and internal scrolling");
}finally{
    try{fs.unlinkSync(fixture);}catch(_){ }
}
