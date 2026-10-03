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

// Run the canonical renderer and the complete progression owner. No handwritten
// action labels or obsolete js/61 label rewriting are used by this fixture.
const main=fs.readFileSync("js/00-main.js","utf8");
const databaseStart=main.indexOf("const skillDatabase = {");
const databaseEnd=main.indexOf("\n};",databaseStart)+3;
assert.ok(databaseStart>=0&&databaseEnd>databaseStart,"formal skill database missing");
const rendererStart=main.indexOf('let selectedSkillElementTab="";');
const rendererEnd=main.indexOf("/*",main.indexOf("    populateAutoSkillOptions2();",rendererStart));
assert.ok(rendererStart>=0&&rendererEnd>rendererStart,"formal skill renderer missing");
const scriptText=source=>source.replace(/<\/script/gi,"<\\/script");
const databaseSource=scriptText(main.slice(databaseStart,databaseEnd));
// Stop directly after renderSkillLoadout; subsequent preview helpers are unrelated.
const rendererSource=scriptText(main.slice(rendererStart,rendererEnd));
const progressionSource=scriptText(fs.readFileSync("js/60-v173.64-skill-progression-rebalance.js","utf8"));
const fixture=path.join(process.cwd(),".critical-regressions-browser.html");
const rows=Array.from({length:60},(_,i)=>`<div style="height:34px">秘寶測試列 ${i+1}</div>`).join("");
const html=`<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="css/00-main.css">
<link rel="stylesheet" href="css/30-v130-requested-updates.css">
<link rel="stylesheet" href="css/31-v131-fix-batch.css">
<link rel="stylesheet" href="css/29-v125-character-creation-native.css">
<link rel="stylesheet" href="css/55-team-relic-system.css">
<link id="v174-critical-ui-regression-style" rel="stylesheet" href="css/56-v174-critical-ui-regressions.css">
<style>
html,body{margin:0;width:390px;height:844px;background:#050505;overflow:hidden}
#game-stage{position:relative;width:390px;height:844px;transform:none!important;overflow:hidden}
#homeFeatureModal{display:flex!important;position:absolute!important;inset:0!important}
#homeFeatureModal .home-feature-modal-box.wide{display:flex;flex-direction:column;width:382px;height:836px}
#homeFeatureModalBody{height:760px;min-height:0}
#skillPage{width:360px}
#skillLoadout,#skillElementTabs{display:none}
#goldTest{position:absolute;left:4px;top:70px;z-index:20;background:rgb(238,196,92);color:rgb(35,23,5);text-shadow:0 2px 2px #000}
#creationPage{display:none!important}
</style></head><body><div id="game-stage">
<div id="homeFeatureModal" class="home-feature-modal show team-relic-modal team-relic-mode"><section class="home-feature-modal-box wide"><button id="goldTest">黃底黑字</button><div id="homeFeatureModalBody"><div id="characterTabContent"><div id="skillPage"><div id="skillLoadout"></div><div id="skillElementTabs"></div><div id="allSkillsList"></div></div></div></div></section></div>
</div><pre id="result"></pre>
<script>window.requestAnimationFrame=function(cb){return setTimeout(cb,0)};</script>
<script src="js/19-stage-v78-character-inventory-runtime.js"></script>
<script>
${databaseSource}
var player={id:'測試角色',element:'fire',level:19,skillPoints:99};
var currentSkillCharacter='fire';
var characterSkillLoadouts={fire:{element:'fire',skillLevels:{flameSlash:2,rage:2},equippedSkills:[]}};
function $(id){return document.getElementById(id)}
function getSkillCharacterObject(){return player}
function getPartyCharacterByIndex(){return player}
function getSkillIconBackgroundImage(){return 'none'}
function getSkillCategoryLabel(category){return category}
function populateAutoSkillOptions(){}
function populateAutoSkillOptions2(){}
${rendererSource}
</script>
<script>${progressionSource}</script>
<script src="js/61-v174-ui-regression-guards.js"></script>
<script>
setTimeout(function(){
  var body=document.getElementById("homeFeatureModalBody");
  var before=getComputedStyle(body).overflowY;
  var scenes=[];
  function capture(id){
    renderSkillLoadout();
    var row=document.querySelector('[data-skill-id="'+id+'"]');
    var action=row.querySelector('[data-skill-action="growth"]');
    var label=action.querySelector('.skill-action-card-label');
    var rect=action.getBoundingClientRect(),text=row.querySelector('.skill-row-text');
    var textRect=text.getBoundingClientRect();
    scenes.push({id:id,label:label.textContent.trim(),disabled:action.disabled,
      width:rect.width,height:rect.height,fontSize:getComputedStyle(label).fontSize,
      textWidth:textRect.width,textFont:getComputedStyle(text.querySelector(".skill-row-desc")).fontSize,
      labelFits:label.scrollWidth<=label.clientWidth+1,
      gate:characterSkillLoadouts.fire.skillLevels[id]
        ?window.v17364GetSkillUpgradeEligibility(player,skillDatabase[id],characterSkillLoadouts.fire.skillLevels[id])
        :window.v173GetSkillLearnEligibility(player,skillDatabase[id],characterSkillLoadouts.fire.skillLevels)});
  }
  capture('flameSlash'); // damage Lv2 -> Lv3 requires character Lv20, not Lv43
  capture('rage'); // support Lv2 -> Lv3 requires character Lv40
  player.level=40;capture('rage');
  player.skillPoints=0;capture('rage');
  player.skillPoints=99;characterSkillLoadouts.fire.skillLevels.rage=5;capture('rage');
  player.level=1;capture('dragonSlash');
  player.level=100;capture('dragonSlash');
  characterSkillLoadouts.fire.skillLevels.explosiveFlurry=1;capture('dragonSlash');
  body.innerHTML='<main class="team-relic-page">${rows}</main>';
  document.getElementById("homeFeatureModal").className='home-feature-modal show team-relic-modal team-relic-mode';
  setTimeout(function(){
    var gold=document.getElementById('goldTest');
    var style=getComputedStyle(body),goldStyle=getComputedStyle(gold);
    var b0=body.scrollTop;body.scrollTop=Math.max(0,body.scrollHeight-body.clientHeight);var b1=body.scrollTop;
    document.getElementById('result').textContent=JSON.stringify({
      relic:{before:before,overflowY:style.overflowY,touchAction:style.touchAction,clientHeight:body.clientHeight,scrollHeight:body.scrollHeight,beforeScroll:b0,afterScroll:b1,inlineOverflow:body.style.getPropertyValue('overflow')},
      skills:scenes,
      gold:{shadow:goldStyle.textShadow,marker:gold.dataset.v174DarkGoldShadow||''}
    });
  },120);
},80);
</script></body></html>`;
fs.writeFileSync(fixture,html,"utf8");
try{
    const chrome=findChrome();
    assert.ok(chrome,"Chrome is required for critical regression browser QA");
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
    assert.deepEqual(data.skills.slice(0,5).map(row=>[row.label,row.disabled]),[
        ["需要角色 Lv20",true],["需要角色 Lv40",true],["升級・1點",false],
        ["技能點不足，需要1點",true],["已滿級",true]
    ]);
    assert.equal(data.skills[0].gate.requiredLevel,20);
    assert.equal(data.skills[1].gate.requiredLevel,40);
    assert.equal(data.skills[2].gate.allowed,true);
    assert.equal(data.skills[3].gate.pointsOk,false);
    assert.match(data.skills[5].label,/^Lv\d+ 解鎖$/);
    assert.equal(data.skills[5].gate.levelOk,false);
    assert.match(data.skills[6].label,/^需先學習：/);
    assert.equal(data.skills[6].gate.prerequisiteOk,false);
    assert.match(data.skills[7].label,/^學習・\d+點$/);
    assert.equal(data.skills[7].gate.allowed,true);
    for(const row of data.skills){
        assert.ok(row.width<=112&&row.width>=72,"canonical compact button width: "+JSON.stringify(row));
        assert.ok(row.height>=44,"skill action touch height");
        assert.ok(parseFloat(row.fontSize)>=13&&parseFloat(row.textFont)>=13,"readable skill text");
        assert.ok(row.textWidth>row.width,"description retains the main row width");
        assert.equal(row.labelFits,true,"skill action label must not overflow");
    }
    assert.equal(data.gold.shadow,"none");
    assert.equal(data.gold.marker,"1");
    console.log("✓ critical UI mobile browser regression QA passed");
}finally{
    try{fs.unlinkSync(fixture);}catch(_){}
}
