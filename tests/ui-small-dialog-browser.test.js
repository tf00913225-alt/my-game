"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const cp=require("node:child_process");

const css=fs.readFileSync("css/49-v169-rpg-ui.css","utf8");
const ui=fs.readFileSync("js/51-v169-rpg-ui.js","utf8");

assert.match(css,/--ui-small-dialog-max-width:340px;/);
assert.match(css,/--ui-small-dialog-height:300px;/);
assert.match(css,/\.v169-rpg-dialog\{[\s\S]*?width:min\(100%,var\(--ui-small-dialog-max-width\)\);[\s\S]*?height:min\(var\(--ui-small-dialog-height\),calc\(100dvh - var\(--ui-small-dialog-safe-space\)\)\);[\s\S]*?display:flex;/);
assert.match(css,/\.v169-rpg-dialog-message\{[\s\S]*?flex:1 1 auto;[\s\S]*?overflow-y:auto;[\s\S]*?touch-action:pan-y;[\s\S]*?scrollbar-gutter:stable;[\s\S]*?font-size:15px;/);
assert.match(css,/\.v169-rpg-dialog-actions\{[\s\S]*?flex:0 0 auto;/);
assert.match(css,/\.v169-rpg-dialog-button\{[\s\S]*?min-height:44px;[\s\S]*?font-size:15px;/);
assert.match(ui,/window\.rpgConfirm=function\(message,options\)/);
assert.match(ui,/window\.rpgAlert=function\(message,options\)/);

function findChrome(){
    for(const name of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){
        const result=cp.spawnSync("which",[name],{encoding:"utf8"});
        if(result.status===0&&result.stdout.trim()){ return result.stdout.trim(); }
    }
    return "";
}

const chrome=findChrome();
if(!chrome){
    console.log("Small Dialog browser check skipped: Chrome not available");
    process.exit(0);
}

const fixture=path.join(process.cwd(),".ui-small-dialog-smoke.html");
const fileUrl="file://"+fixture.replace(/\\/g,"/");
const html=`<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="css/49-v169-rpg-ui.css">
<style>html,body{margin:0;width:420px;height:746.6667px;overflow:hidden;background:#000;}</style>
</head><body>
<div class="v169-rpg-dialog-layer show">
<section class="v169-rpg-dialog" data-kind="confirm" data-tone="normal">
<div class="v169-rpg-dialog-crest">✦</div>
<h2>副本確認</h2>
<div class="v169-rpg-dialog-message" id="message"></div>
<div class="v169-rpg-dialog-actions"><button class="v169-rpg-dialog-button secondary">返回</button><button class="v169-rpg-dialog-button primary">確定</button></div>
</section></div><pre id="result"></pre>
<script>
(function(){
 const dialog=document.querySelector('.v169-rpg-dialog');
 const title=dialog.querySelector('h2');
 const message=document.getElementById('message');
 const actions=dialog.querySelector('.v169-rpg-dialog-actions');
 const buttons=Array.from(actions.querySelectorAll('button'));
 const rect=el=>{const r=el.getBoundingClientRect();return {left:r.left,top:r.top,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
 const snap=name=>({name,dialog:rect(dialog),title:rect(title),message:rect(message),actions:rect(actions),buttons:buttons.map(rect),messageStyle:{overflowY:getComputedStyle(message).overflowY,touchAction:getComputedStyle(message).touchAction,gutter:getComputedStyle(message).scrollbarGutter,fontSize:getComputedStyle(message).fontSize},scrollHeight:message.scrollHeight,clientHeight:message.clientHeight});
 message.textContent='確定進入副本嗎？';void dialog.offsetHeight;const short=snap('short');
 message.textContent=Array.from({length:45},(_,i)=>'第 '+(i+1)+' 行：確認資訊與戰鬥警告').join('\\n');void dialog.offsetHeight;const long=snap('long');
 document.getElementById('result').textContent=JSON.stringify({short,long});
})();
</script></body></html>`;

fs.writeFileSync(fixture,html,"utf8");
try{
    const run=cp.spawnSync(chrome,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--force-device-scale-factor=1","--window-size=420,747","--dump-dom",fileUrl],{encoding:"utf8",timeout:30000,maxBuffer:8*1024*1024});
    assert.equal(run.status,0,run.stderr||"Chrome Small Dialog fixture failed");
    const match=run.stdout.match(/<pre id="result">([\s\S]*?)<\/pre>/);
    assert.ok(match,"Small Dialog browser result missing");
    const data=JSON.parse(match[1].replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"'));
    for(const shot of [data.short,data.long]){
        assert.ok(Math.abs(shot.dialog.width-340)<0.25,"Small Dialog width must stay at 340px");
        assert.ok(Math.abs(shot.dialog.height-300)<0.25,"Small Dialog height must stay at 300px");
        assert.equal(shot.messageStyle.overflowY,"auto","message must own vertical scrolling");
        assert.equal(shot.messageStyle.touchAction,"pan-y","message must allow vertical touch scrolling");
        assert.equal(shot.messageStyle.gutter,"stable","message must reserve stable scrollbar space");
        assert.equal(shot.messageStyle.fontSize,"15px","message text must remain readable");
        shot.buttons.forEach(button=>assert.ok(button.height>=44,"Small Dialog buttons must keep a 44px tap target"));
    }
    for(const part of ["dialog","title","message","actions"]){
        for(const key of ["left","top","width","height"]){
            assert.ok(Math.abs(data.short[part][key]-data.long[part][key])<0.25,`${part}.${key} must not move when dialog text changes`);
        }
    }
    assert.ok(data.long.scrollHeight>data.long.clientHeight,"long confirmation text must scroll inside the message area");
    assert.ok(data.short.scrollHeight<=data.short.clientHeight+1,"short confirmation text must leave stable empty space instead of resizing the dialog");
    console.log("Headless Chrome: shared Small Dialog keeps one fixed frame and scrolls only its message");
}finally{
    try{fs.unlinkSync(fixture);}catch(_){ }
}
