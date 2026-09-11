"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const cp=require("node:child_process");

const bossRuntime=fs.readFileSync("js/gameplay-boss-tower-system.js","utf8");
const bossCss=fs.readFileSync("css/gameplay-boss-tower.css","utf8");
const skillCss=fs.readFileSync("css/56-v174-critical-ui-regressions.css","utf8");
const relic=fs.readFileSync("js/relic-progression-drop-system.js","utf8");

assert.match(bossRuntime,/partyScale:Object\.freeze\(\{[\s\S]*?2:Object\.freeze\(\{hp:1\.60,attack:1\.08\}\)[\s\S]*?3:Object\.freeze\(\{hp:2\.00,attack:1\.12\}\)/);
assert.match(bossRuntime,/hpRatio:\.28/);
assert.match(bossRuntime,/assistCount:2/);
assert.match(bossRuntime,/configureBossSkills\(monster,definition\.element/);
assert.match(bossCss,/\.gameplay-mode-card\{[\s\S]*?aspect-ratio:16 \/ 9;/);
assert.match(skillCss,/克制：你的元素對目標有優勢/);
assert.match(skillCss,/被克制：目標元素對你有優勢/);
assert.match(skillCss,/土剋水｜水剋火｜火剋風｜風剋土/);
assert.match(skillCss,/white-space:pre-line/);
assert.match(relic,/LV20_STARTER_BLUE_MINIMUM=2/);
assert.match(relic,/relic_qiankun_flask.*relic_xuanwu_seal.*relic_qinglan_feather/);
assert.doesNotMatch(relic,/checkLevelUp\s*=/,"Lv20 starter relics must not create another level-up wrapper");

function findChrome(){
  for(const name of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){
    const result=cp.spawnSync("which",[name],{encoding:"utf8"});
    if(result.status===0&&result.stdout.trim()){ return result.stdout.trim(); }
  }
  return "";
}
const chrome=findChrome();
if(!chrome){ console.log("Boss/UI focused browser check skipped: Chrome not available");process.exit(0); }
const fixture=path.join(process.cwd(),".v174-boss-balance-ui-relic-lv20.html");
const fileUrl="file://"+fixture.replace(/\\/g,"/");
const html=`<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="css/gameplay-boss-tower.css">
<link rel="stylesheet" href="css/56-v174-critical-ui-regressions.css">
<style>html,body{margin:0;background:#000}.stage{width:390px;height:844px}.skill-preview-body{width:360px}</style>
</head><body>
<div id="game-stage" class="stage"><div class="gameplay-hub-grid"><button class="gameplay-mode-card boss"><span class="gameplay-mode-copy"><h3>BOSS</h3><p>個人 BOSS・世界 BOSS</p><span class="gameplay-mode-status">狀態文字</span></span><span class="gameplay-mode-seal">戰</span></button></div></div>
<div id="allElementSkillPreviewModal"><div class="skill-preview-body"></div></div><pre id="result"></pre>
<script>(function(){const stage=document.getElementById('game-stage'),card=document.querySelector('.gameplay-mode-card'),body=document.querySelector('.skill-preview-body');const snap=()=>{const r=card.getBoundingClientRect(),p=getComputedStyle(body,'::before');return {width:r.width,height:r.height,ratio:r.width/r.height,overflowX:card.scrollWidth-card.clientWidth,overflowY:card.scrollHeight-card.clientHeight,hint:p.content,whiteSpace:p.whiteSpace,textAlign:p.textAlign};};const a=snap();stage.style.width='412px';void card.offsetHeight;const b=snap();document.getElementById('result').textContent=JSON.stringify({a,b});})();<\/script></body></html>`;
fs.writeFileSync(fixture,html,"utf8");
try{
  const run=cp.spawnSync(chrome,["--headless=new","--no-sandbox","--disable-dev-shm-usage","--allow-file-access-from-files","--window-size=500,950","--dump-dom",fileUrl],{encoding:"utf8",timeout:30000,maxBuffer:8*1024*1024});
  assert.equal(run.status,0,run.stderr||"Chrome focused fixture failed");
  const match=run.stdout.match(/<pre id="result">([\s\S]*?)<\/pre>/);assert.ok(match,"browser result missing");
  const data=JSON.parse(match[1].replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"'));
  for(const shot of [data.a,data.b]){assert.ok(Math.abs(shot.ratio-16/9)<.01,`activity cover ratio must be 16:9, got ${shot.ratio}`);assert.ok(shot.overflowX<=1);assert.ok(shot.overflowY<=1);assert.equal(shot.whiteSpace,"pre-line");assert.equal(shot.textAlign,"left");assert.match(shot.hint,/克制/);assert.match(shot.hint,/被克制/);}
  console.log("Headless Chrome: gameplay activity cards are 16:9 and element-counter explanation is multi-line/readable");
}finally{try{fs.unlinkSync(fixture);}catch(_){}}
