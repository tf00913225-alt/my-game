"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const cp=require("node:child_process");

const detailCss=fs.readFileSync("css/23-stage-v77-inventory-detail-ui.css","utf8");
const nativeCss=fs.readFileSync("css/29-v125-character-creation-native.css","utf8");
const runtime=fs.readFileSync("js/24-v125-character-creation-native-runtime.js","utf8");
const touchLock=fs.readFileSync("js/01-stage-v8-touch-lock.js","utf8");

assert.match(detailCss,/#creationSkillDetailModal \.creation-skill-detail-box\{[\s\S]*?width:920px !important;[\s\S]*?height:1390px !important;[\s\S]*?max-height:calc\(100% - 96px\) !important;/);
assert.match(detailCss,/#creationSkillDetailModal \.creation-skill-detail-levels\{[\s\S]*?flex:1 1 auto !important;[\s\S]*?overflow-y:auto !important;[\s\S]*?touch-action:pan-y !important;[\s\S]*?scrollbar-gutter:stable !important;/);
assert.match(detailCss,/#creationSkillDetailModal \.creation-skill-detail-x\{[\s\S]*?width:124px !important;[\s\S]*?height:124px !important;/);
assert.match(detailCss,/#creationSkillDetailModal \.creation-skill-detail-close\{[\s\S]*?height:124px !important;[\s\S]*?min-height:124px !important;/);
assert.match(runtime,/class="creation-skill-detail-levels"/);
assert.match(runtime,/class="creation-skill-detail-close"/);
assert.match(touchLock,/\.creation-skill-detail-levels/);
assert.doesNotMatch(touchLock,/\.creation-skill-detail-box/);
assert.match(nativeCss,/#creationSkillDetailModal\{[\s\S]*?width:1080px;[\s\S]*?height:1920px;/);

function findChrome(){
    for(const name of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){
        const result=cp.spawnSync("which",[name],{encoding:"utf8"});
        if(result.status===0&&result.stdout.trim()){ return result.stdout.trim(); }
    }
    return "";
}

const chrome=findChrome();
if(!chrome){
    console.log("Creation skill detail browser check skipped: Chrome not available");
    process.exit(0);
}

const fixture=path.join(process.cwd(),".ui-creation-skill-detail-smoke.html");
const fileUrl="file://"+fixture.replace(/\\/g,"/");
const html=`<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="css/23-stage-v77-inventory-detail-ui.css">
<link rel="stylesheet" href="css/29-v125-character-creation-native.css">
<style>
html,body{margin:0;width:1080px;height:1920px;overflow:hidden;background:#050407;}
#game-stage{position:relative!important;width:1080px!important;height:1920px!important;transform:none!important;overflow:hidden!important;}
</style></head><body><div id="game-stage"><div id="creationSkillDetailModal" class="show" data-element="water">
<div class="creation-skill-detail-box">
<div class="creation-skill-detail-header"><div class="creation-skill-detail-glyph">水</div><div class="creation-skill-detail-heading"><div class="creation-skill-detail-name">冰霜箭雨</div><div class="creation-skill-detail-path">水系 · 法術</div></div><button class="creation-skill-detail-x">×</button></div>
<div class="creation-skill-detail-tags"><span class="creation-skill-detail-tag">法術</span><span class="creation-skill-detail-tag">敵方全體</span><span class="creation-skill-detail-tag">最高 Lv.5</span></div>
<div class="creation-skill-detail-description">以寒泉之力凝聚冰箭，對敵方造成群體傷害並施加冰霜效果。</div>
<div class="creation-skill-detail-meta">消耗 35 SP｜學習需要 2 技能點</div>
<div class="creation-skill-detail-section-title">各等級數值</div>
<div id="creationSkillDetailLevels" class="creation-skill-detail-levels"></div>
<button class="creation-skill-detail-close">關閉</button>
</div></div></div><pre id="result"></pre><script>
(function(){
 const box=document.querySelector('.creation-skill-detail-box');
 const header=document.querySelector('.creation-skill-detail-header');
 const x=document.querySelector('.creation-skill-detail-x');
 const levels=document.getElementById('creationSkillDetailLevels');
 const close=document.querySelector('.creation-skill-detail-close');
 const rect=el=>{const r=el.getBoundingClientRect();return {left:r.left,top:r.top,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
 const snap=name=>({name,box:rect(box),header:rect(header),x:rect(x),levels:rect(levels),close:rect(close),boxStyle:{height:getComputedStyle(box).height,width:getComputedStyle(box).width,maxHeight:getComputedStyle(box).maxHeight},levelsStyle:{overflowY:getComputedStyle(levels).overflowY,gutter:getComputedStyle(levels).scrollbarGutter,touchAction:getComputedStyle(levels).touchAction,flex:getComputedStyle(levels).flex},scrollHeight:levels.scrollHeight,clientHeight:levels.clientHeight});
 levels.innerHTML='<div class="creation-skill-detail-level-row"><b>Lv.1</b><span>傷害 100，冰封機率 20%</span></div>';void box.offsetHeight;const short=snap('short');
 levels.innerHTML=Array.from({length:24},(_,i)=>'<div class="creation-skill-detail-level-row"><b>Lv.'+(i+1)+'</b><span>傷害 '+(100+i*12)+'，冰封與追加效果說明 '+i+'</span></div>').join('');void box.offsetHeight;const long=snap('long');
 document.getElementById('result').textContent=JSON.stringify({short,long});
})();
</script></body></html>`;

fs.writeFileSync(fixture,html,"utf8");
try{
    const run=cp.spawnSync(chrome,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--force-device-scale-factor=1","--window-size=1080,1920","--dump-dom",fileUrl],{encoding:"utf8",timeout:30000,maxBuffer:8*1024*1024});
    assert.equal(run.status,0,run.stderr||"Chrome creation skill detail fixture failed");
    const match=run.stdout.match(/<pre id="result">([\s\S]*?)<\/pre>/);
    assert.ok(match,"creation skill detail browser result missing");
    const data=JSON.parse(match[1].replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"'));
    for(const shot of [data.short,data.long]){
        assert.ok(Math.abs(shot.box.width-920)<0.25,"creation skill detail must keep the native 920px Medium-equivalent width");
        assert.ok(Math.abs(shot.box.height-1390)<0.25,"creation skill detail must keep the native 1390px Medium-equivalent height");
        assert.ok(shot.x.width>=124&&shot.x.height>=124,"top close target must be at least 124 native px");
        assert.ok(shot.close.height>=124,"bottom close target must be at least 124 native px");
        assert.equal(shot.levelsStyle.overflowY,"auto","skill levels must own vertical scrolling");
        assert.equal(shot.levelsStyle.gutter,"stable","skill levels must reserve scrollbar space");
        assert.equal(shot.levelsStyle.touchAction,"pan-y","skill levels must permit vertical touch scrolling");
    }
    for(const part of ["box","header","x","levels","close"]){
        for(const key of ["left","top","width","height"]){
            assert.ok(Math.abs(data.short[part][key]-data.long[part][key])<0.25,`${part}.${key} must not drift with level-row count`);
        }
    }
    assert.ok(data.short.scrollHeight<=data.short.clientHeight+1,"short skill-level content must not need scrolling");
    assert.ok(data.long.scrollHeight>data.long.clientHeight,"long skill-level content must scroll inside the fixed viewport");
    console.log("Headless Chrome: creation skill detail uses one fixed native Medium-equivalent frame with internal level scrolling");
}finally{
    try{fs.unlinkSync(fixture);}catch(_){ }
}
