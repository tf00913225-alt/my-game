"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {spawnSync}=require("node:child_process");

function findChrome(){
    for(const name of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){
        const probe=spawnSync("bash",["-lc",`command -v ${name}`],{encoding:"utf8"});
        if(probe.status===0&&probe.stdout.trim()){ return probe.stdout.trim(); }
    }
    return "";
}
function decode(value){
    return value.replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">")
        .replace(/&quot;/g,'"').replace(/&#39;/g,"'");
}

const fixture=path.join(process.cwd(),".critical-regressions-browser.html");
const rows=Array.from({length:60},(_,i)=>`<div style="height:34px">秘寶測試列 ${i+1}</div>`).join("");
const html=`<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="css/29-v125-character-creation-native.css">
<link rel="stylesheet" href="css/55-team-relic-system.css">
<link id="v174-critical-ui-regression-style" rel="stylesheet" href="css/56-v174-critical-ui-regressions.css">
<style>
html,body{margin:0;width:390px;height:844px;background:#050505;overflow:hidden}
#game-stage{position:relative;width:390px;height:844px;transform:none!important;overflow:hidden}
#homeFeatureModal{display:flex!important;position:absolute!important;inset:0!important}
#homeFeatureModal .home-feature-modal-box.wide{display:flex;flex-direction:column;width:382px;height:836px}
#homeFeatureModalBody{height:760px;min-height:0}
#allSkillsList{position:absolute;left:4px;top:4px;z-index:20;width:360px}
.skill-row{display:grid;grid-template-columns:40px minmax(0,1fr) auto;gap:6px}
.skill-action-card{width:auto}.skill-action-card-label{display:block}
#goldTest{position:absolute;left:4px;top:70px;z-index:20;background:rgb(238,196,92);color:rgb(35,23,5);text-shadow:0 2px 2px #000}
#creationPage{display:none!important}
</style></head><body><div id="game-stage">
<div id="allSkillsList"><div class="skill-row"><div></div><div class="skill-row-text">技能說明必須保留主要寬度</div><button class="skill-action-card"><span class="skill-action-card-label">角色 Lv43 可升至技能 Lv3</span></button></div></div>
<button id="goldTest">黃底黑字</button>
<div id="homeFeatureModal" class="home-feature-modal show team-relic-modal team-relic-mode"><section class="home-feature-modal-box wide"><div id="homeFeatureModalBody"><div id="characterTabContent"><div style="height:1000px">角色頁</div></div></div></section></div>
</div><pre id="result"></pre>
<script>window.requestAnimationFrame=function(cb){return setTimeout(cb,0)};</script>
<script src="js/19-stage-v78-character-inventory-runtime.js"></script>
<script src="js/61-v174-ui-regression-guards.js"></script>
<script>
setTimeout(function(){
  var body=document.getElementById("homeFeatureModalBody");
  var before=getComputedStyle(body).overflowY;
  body.innerHTML='<main class="team-relic-page">${rows}</main>';
  document.getElementById("homeFeatureModal").className='home-feature-modal show team-relic-modal team-relic-mode';
  setTimeout(function(){
    var action=document.querySelector('.skill-action-card');
    var label=document.querySelector('.skill-action-card-label');
    var gold=document.getElementById('goldTest');
    var style=getComputedStyle(body),actionStyle=getComputedStyle(action),goldStyle=getComputedStyle(gold);
    var b0=body.scrollTop;body.scrollTop=Math.max(0,body.scrollHeight-body.clientHeight);var b1=body.scrollTop;
    var roleHint=getComputedStyle(document.createElement('div'),'::after').content;
    document.getElementById('result').textContent=JSON.stringify({
      relic:{before:before,overflowY:style.overflowY,touchAction:style.touchAction,clientHeight:body.clientHeight,scrollHeight:body.scrollHeight,beforeScroll:b0,afterScroll:b1,inlineOverflow:body.style.getPropertyValue('overflow')},
      skill:{label:label.textContent,title:action.title,width:actionStyle.width},
      gold:{shadow:goldStyle.textShadow,marker:gold.dataset.v174DarkGoldShadow||''}
    });
  },120);
},80);
</script></body></html>`;
fs.writeFileSync(fixture,html,"utf8");
try{
    const chrome=findChrome();
    if(!chrome){
        if(process.env.CI){ throw new Error("CI must provide Chrome for critical regression browser QA"); }
        console.log("Critical regression browser QA skipped: Chrome not available");
        process.exit(0);
    }
    const fileUrl="file://"+fixture.replace(/\\/g,"/");
    const run=spawnSync(chrome,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--force-device-scale-factor=1","--window-size=390,844","--virtual-time-budget=1500","--dump-dom",fileUrl],{encoding:"utf8",timeout:30000,maxBuffer:12*1024*1024});
    assert.equal(run.status,0,run.stderr||"critical regression browser fixture failed");
    const match=run.stdout.match(/<pre id="result">([\s\S]*?)<\/pre>/);
    assert.ok(match&&match[1].trim(),"critical regression browser result missing");
    const data=JSON.parse(decode(match[1]));
    assert.equal(data.relic.inlineOverflow,"","character layout owner left stale inline overflow on relic body");
    assert.match(data.relic.overflowY,/auto|scroll/);
    assert.equal(data.relic.touchAction,"pan-y");
    assert.ok(data.relic.scrollHeight>data.relic.clientHeight&&data.relic.afterScroll>data.relic.beforeScroll,"relic body cannot actually scroll after owner handoff");
    assert.equal(data.skill.label,"Lv43 解鎖");
    assert.match(data.skill.title,/角色 Lv43 可升至技能 Lv3/);
    assert.ok(parseFloat(data.skill.width)<=105,"skill action card remained too wide");
    assert.equal(data.gold.shadow,"none");
    assert.equal(data.gold.marker,"1");
    console.log("✓ critical UI mobile browser regression QA passed");
}finally{
    try{fs.unlinkSync(fixture);}catch(_){}
}
