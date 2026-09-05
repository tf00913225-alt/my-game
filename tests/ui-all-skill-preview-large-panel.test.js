"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const cp=require("node:child_process");

const owner=fs.readFileSync("css/30-v130-requested-updates.css","utf8");

assert.match(owner,/html body \.skill-preview-modal\.v141-body-preview \.skill-preview-dialog\{[\s\S]*?max-width:var\(--ui-large-panel-max-width,396px\) !important;[\s\S]*?height:min\(var\(--ui-large-panel-height,620px\),calc\(100dvh - var\(--ui-large-panel-safe-space,24px\)\)\) !important;/);
assert.match(owner,/html body \.skill-preview-modal\.v141-body-preview \.skill-preview-heading,[\s\S]*?\.skill-preview-tabs\{[\s\S]*?flex:0 0 auto !important;/);
assert.match(owner,/html body \.skill-preview-modal\.v141-body-preview \.skill-preview-tabs button\{[\s\S]*?min-height:var\(--ui-large-panel-tab-height,42px\) !important;/);
assert.match(owner,/html body \.skill-preview-modal\.v141-body-preview \.skill-preview-body\{[\s\S]*?flex:1 1 auto !important;[\s\S]*?overflow-y:auto !important;[\s\S]*?scrollbar-gutter:stable !important;/);

function findChrome(){
    for(const name of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){
        const result=cp.spawnSync("which",[name],{encoding:"utf8"});
        if(result.status===0&&result.stdout.trim()){ return result.stdout.trim(); }
    }
    return "";
}

const chrome=findChrome();
if(!chrome){
    console.log("All-skill Large Panel browser check skipped: Chrome not available");
    process.exit(0);
}

const fixture=path.join(process.cwd(),".ui-all-skill-preview-large-panel.html");
const fileUrl="file://"+fixture.replace(/\\/g,"/");
const html=`<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="css/00-main.css">
<link rel="stylesheet" href="css/30-v130-requested-updates.css">
<link rel="stylesheet" href="css/31-v131-fix-batch.css">
<link rel="stylesheet" href="css/38-v141-system-expansion.css">
<link rel="stylesheet" href="css/49-v169-rpg-ui.css">
<style>html,body{margin:0;width:420px;height:746.6667px;overflow:hidden;background:#000;}</style>
</head><body>
<div id="allElementSkillPreviewModal" class="skill-preview-modal v141-body-preview show" aria-hidden="false">
  <div class="skill-preview-dialog">
    <div class="skill-preview-heading"><h2>全屬性技能預覽</h2><button>返回</button></div>
    <div class="skill-preview-tabs"><button>火</button><button>水</button><button>土</button><button>風</button></div>
    <div class="skill-preview-body" id="body"></div>
  </div>
</div>
<pre id="result"></pre>
<script>
(function(){
 const dialog=document.querySelector('.skill-preview-dialog');
 const heading=document.querySelector('.skill-preview-heading');
 const tabs=document.querySelector('.skill-preview-tabs');
 const body=document.getElementById('body');
 const rect=el=>{const r=el.getBoundingClientRect();return {left:r.left,top:r.top,width:r.width,height:r.height};};
 const snap=()=>({dialog:rect(dialog),heading:rect(heading),tabs:rect(tabs),body:rect(body),dialogStyle:{width:getComputedStyle(dialog).width,height:getComputedStyle(dialog).height,maxWidth:getComputedStyle(dialog).maxWidth},bodyStyle:{overflowY:getComputedStyle(body).overflowY,gutter:getComputedStyle(body).scrollbarGutter},scrollHeight:body.scrollHeight,clientHeight:body.clientHeight});
 body.innerHTML='<div class="skill-preview-card"><strong>短內容</strong><p>技能說明</p></div>'; void dialog.offsetHeight; const short=snap();
 body.innerHTML=Array.from({length:40},(_,i)=>'<div class="skill-preview-card"><strong>技能 '+i+'</strong><p>這是一段較長的技能說明，用來確認只有技能列表區可以上下捲動。</p></div>').join(''); void dialog.offsetHeight; const long=snap();
 document.getElementById('result').textContent=JSON.stringify({short,long});
})();
</script></body></html>`;

fs.writeFileSync(fixture,html,"utf8");
try{
    const run=cp.spawnSync(chrome,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--force-device-scale-factor=1","--window-size=420,747","--dump-dom",fileUrl],{encoding:"utf8",timeout:30000,maxBuffer:8*1024*1024});
    assert.equal(run.status,0,run.stderr||"Chrome all-skill preview fixture failed");
    const match=run.stdout.match(/<pre id="result">([\s\S]*?)<\/pre>/);
    assert.ok(match,"all-skill preview browser result missing");
    const data=JSON.parse(match[1].replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"'));
    for(const shot of [data.short,data.long]){
        assert.equal(shot.dialogStyle.width,"396px","all-skill preview must use Large Panel width");
        assert.equal(shot.dialogStyle.maxWidth,"396px","all-skill preview must keep Large Panel width ceiling");
        assert.equal(shot.dialogStyle.height,"620px","all-skill preview must use Large Panel height");
        assert.equal(shot.bodyStyle.overflowY,"auto","skill list must own vertical scrolling");
        assert.equal(shot.bodyStyle.gutter,"stable","skill list must reserve stable scrollbar space");
    }
    for(const part of ["dialog","heading","tabs","body"]){
        for(const key of ["left","top","width","height"]){
            assert.ok(Math.abs(data.short[part][key]-data.long[part][key])<0.25,`${part}.${key} must stay fixed when skill content changes`);
        }
    }
    assert.ok(data.long.scrollHeight>data.long.clientHeight,"long skill preview content must scroll internally");
    assert.ok(data.short.scrollHeight<=data.short.clientHeight+1,"short skill preview content must leave stable empty space");
    console.log("Headless Chrome: all-element skill preview uses one fixed Large Panel frame");
}finally{
    try{fs.unlinkSync(fixture);}catch(_){ }
}
