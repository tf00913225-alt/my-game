import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {spawnSync} from "node:child_process";

function findChrome(){
    for(const name of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){
        const probe=spawnSync("bash",["-lc",`command -v ${name}`],{encoding:"utf8"});
        if(probe.status===0&&probe.stdout.trim()){ return probe.stdout.trim(); }
    }
    throw new Error("Headless Chrome/Chromium is required for skill progression browser QA.");
}

const fixture=path.join(process.cwd(),".skill-progression-browser-qa.html");
const fileUrl="file://"+fixture.replace(/\\/g,"/");
const skillIds=[
    "waterKnife","frostPunch","iceSpin","frostCrush",
    "waterBall","floodBeast","iceArrowRain","healSpell",
    "revive","freeze","purifyMind","waterEX"
];
const names={
    waterKnife:"水刀斬",frostPunch:"冰霜拳",iceSpin:"冰旋一閃",frostCrush:"冰封重擊",
    waterBall:"水球術",floodBeast:"洪水猛獸",iceArrowRain:"冰霜箭雨",healSpell:"治療術",
    revive:"復活術",freeze:"冰封",purifyMind:"淨心訣",waterEX:"水元素EX"
};

const html=`<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="css/00-main.css">
<link rel="stylesheet" href="css/30-v130-requested-updates.css">
<link rel="stylesheet" href="css/31-v131-fix-batch.css">
<link rel="stylesheet" href="css/46-v154-dev-fixes.css">
<link rel="stylesheet" href="css/49-v169-rpg-ui.css">
<style>
html,body{margin:0;width:390px;height:844px;overflow:hidden;background:#050505;}
#game-stage{width:390px;height:844px;position:relative;transform:none!important;}
#homeFeatureModal{display:flex!important;visibility:visible!important;opacity:1!important;pointer-events:auto!important;position:absolute!important;inset:0!important;}
#homeFeatureModal .home-feature-modal-box.wide{width:382px!important;height:836px!important;max-width:none!important;max-height:none!important;}
#homeFeatureModalBody{display:flex!important;flex:1 1 auto!important;min-height:0!important;}
#characterTabContent{display:block!important;flex:1 1 auto!important;min-height:0!important;overflow-y:auto!important;overflow-x:hidden!important;touch-action:pan-y!important;}
#skillPage{display:block!important;position:static!important;height:auto!important;min-height:0!important;padding:0 0 12px!important;}
#allSkillsList{display:block!important;overflow:visible!important;padding-bottom:12px!important;}
.skill-row{display:grid;grid-template-columns:42px minmax(0,1fr) minmax(96px,auto);gap:8px;align-items:center;width:100%;box-sizing:border-box;min-height:58px;margin:0 0 8px;padding:7px;border:1px solid rgba(210,170,90,.35);}
.skill-row-text{min-width:0;overflow-wrap:anywhere;}
.skill-action-card{min-width:0;max-width:132px;white-space:normal;overflow-wrap:anywhere;}
</style>
</head>
<body>
<div id="game-stage">
  <div id="homeFeatureModal" class="home-feature-modal show no-padding">
    <div class="home-feature-modal-box wide">
      <div id="homeFeatureModalBody">
        <div id="characterTabContent">
          <section id="skillPage">
            <div id="skillPoints">999</div>
            <div id="allSkillsList"></div>
            <div id="skillDetailStats"></div>
          </section>
        </div>
      </div>
    </div>
  </div>
</div>
<pre id="result"></pre>
<script>
var player={id:"寒泉一號",element:"water",level:19,skillPoints:999,hp:1000,sp:1000,activeBuffs:[],statusEffects:[]};
var player2={id:"寒泉二號",element:"water",level:10,skillPoints:999,hp:1000,sp:1000,activeBuffs:[],statusEffects:[]};
var player3=null;
var currentSkillCharacter="water";
var activeBattleCharacterIndex=0;
var characterSkillLoadouts={
  water:{name:"寒泉一號",skillLevels:{healSpell:1},equippedSkills:[]},
  player2:{name:"寒泉二號",skillLevels:{healSpell:1},equippedSkills:[]}
};
var skillDatabase={};
var fixtureSkillIds=${JSON.stringify(skillIds)};
var fixtureSkillNames=${JSON.stringify(names)};
fixtureSkillIds.forEach(function(id){
  skillDatabase[id]={id:id,name:fixtureSkillNames[id],element:"water",category:"magic",targetType:"single",learnCost:99,maxLevel:5,requires:[],description:"技能說明"};
});
skillDatabase.healSpell.category="heal";skillDatabase.healSpell.targetType="allyTri";
skillDatabase.revive.category="revive";skillDatabase.revive.targetType="deadAlly";
skillDatabase.freeze.maxLevel=1;skillDatabase.purifyMind.maxLevel=1;skillDatabase.waterEX.maxLevel=1;
function getSkillCharacterObject(key){return key==="player2"?player2:player;}
function getPartyCharacterByIndex(index){return index===1?player2:player;}
function getPartyCharacterKey(index){return index===1?"player2":"water";}
function getCharacterSkillKey(actor){return actor===player2?"player2":"water";}
function saveGame(){}
function updateUI(){}
function alert(message){window.__lastAlert=message;}
function learnSkill(){return false;}
function upgradeSkill(){return false;}
function renderSkillLoadout(){
  var list=document.getElementById("allSkillsList");
  list.innerHTML=fixtureSkillIds.map(function(id){
    return '<div class="skill-row">'+
      '<div id="skillIcon_'+id+'" aria-hidden="true"></div>'+
      '<div class="skill-row-text"><strong>'+fixtureSkillNames[id]+'</strong></div>'+
      '<button class="skill-action-card" type="button"><span class="skill-action-card-label">學習</span></button>'+
      '</div>';
  }).join("");
}
function showSkillDetail(){document.getElementById("skillDetailStats").innerHTML="";}
</script>
<script src="js/60-v173.64-skill-progression-rebalance.js"></script>
<script>
(function(){
  function reviveState(){
    var row=Array.from(document.querySelectorAll("#allSkillsList .skill-row")).find(function(item){return !!item.querySelector("#skillIcon_revive");});
    var card=row&&row.querySelector(".skill-action-card");
    var label=card&&card.querySelector(".skill-action-card-label");
    var rr=row&&row.getBoundingClientRect();
    var cr=card&&card.getBoundingClientRect();
    return {
      exists:!!row,
      rowHeight:rr?rr.height:0,
      label:label?label.textContent.replace(/\\s+/g," ").trim():"",
      disabled:!!(card&&card.classList.contains("disabled")),
      onclick:card?card.getAttribute("onclick")||"":"",
      overflow:!!(row&&row.scrollWidth>row.clientWidth+1),
      actionOutside:!!(rr&&cr&&(cr.left<rr.left-1||cr.right>rr.right+1))
    };
  }

  currentSkillCharacter="water";
  player.level=19;
  renderSkillLoadout();
  var lv19=reviveState();

  player.level=20;
  renderSkillLoadout();
  var lv20=reviveState();

  currentSkillCharacter="player2";
  renderSkillLoadout();
  var second=reviveState();

  currentSkillCharacter="water";
  player.level=20;
  renderSkillLoadout();
  showSkillDetail("revive");
  var detail=document.getElementById("skillDetailStats").textContent.replace(/\\s+/g," ").trim();
  var pageText=document.getElementById("skillPage").textContent;
  var rows=Array.from(document.querySelectorAll("#allSkillsList .skill-row"));
  var root=document.getElementById("characterTabContent");
  var natural={overflowY:getComputedStyle(root).overflowY,touchAction:getComputedStyle(root).touchAction};
  root.style.setProperty("height","240px","important");
  root.style.setProperty("max-height","240px","important");
  root.style.setProperty("overflow-y","scroll","important");
  void root.offsetHeight;
  var before=root.scrollTop;
  root.scrollTop=Math.max(0,root.scrollHeight-root.clientHeight);
  var after=root.scrollTop;

  document.getElementById("result").textContent=JSON.stringify({
    installed:window.__v17364SkillProgressionInstalled===true,
    lv19:lv19,lv20:lv20,second:second,detail:detail,
    forbidden:["learnLevel","requires","tier","upgradeCost"].filter(function(word){return pageText.includes(word);}),
    progressionHints:document.querySelectorAll("#allSkillsList .v17364-progression-hint").length,
    rowCount:rows.length,
    horizontalOverflow:rows.some(function(row){return row.scrollWidth>row.clientWidth+1;}),
    natural:natural,
    scroll:{scrollHeight:root.scrollHeight,clientHeight:root.clientHeight,before:before,after:after}
  });
})();
</script>
</body>
</html>`;

fs.writeFileSync(fixture,html,"utf8");
try{
    const chrome=findChrome();
    const run=spawnSync(chrome,[
        "--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage",
        "--allow-file-access-from-files","--force-device-scale-factor=1","--window-size=390,844",
        "--dump-dom",fileUrl
    ],{encoding:"utf8",timeout:30000,maxBuffer:12*1024*1024});
    assert.equal(run.status,0,run.stderr||"Skill progression browser fixture failed");
    const match=run.stdout.match(/<pre id="result">([\s\S]*?)<\/pre>/);
    assert.ok(match,"Skill progression browser result missing");
    const decoded=match[1]
        .replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">")
        .replace(/&quot;/g,'"').replace(/&#39;/g,"'");
    const data=JSON.parse(decoded);

    assert.equal(data.installed,true,"V173.64 skill progression owner did not install");
    assert.equal(data.lv19.exists,true,"Revive row is missing");
    assert.ok(data.lv19.rowHeight>0,"Revive row is not visibly rendered");
    assert.equal(data.lv19.disabled,true);assert.match(data.lv19.label,/Lv20/);
    assert.equal(data.lv19.overflow,false);assert.equal(data.lv19.actionOutside,false);

    assert.equal(data.lv20.disabled,false);assert.match(data.lv20.onclick,/learnSkill\('revive'\)/);
    assert.equal(data.second.disabled,true,"Second character must use its own Lv10 gate");assert.match(data.second.label,/Lv20/);

    for(const label of ["最低學習等級","目前技能等級","下一級角色需求","學習成本","升級成本","前置技能"]){
        assert.match(data.detail,new RegExp(label));
    }
    assert.deepEqual(data.forbidden,[]);
    assert.equal(data.progressionHints,0,"Verbose progression text must live in skill details, not summary rows");
    assert.ok(data.rowCount>=8,"Water skill list is unexpectedly short");
    assert.equal(data.horizontalOverflow,false,"Skill rows must not overflow horizontally at 390px");
    assert.match(data.natural.overflowY,/auto|scroll/);
    assert.equal(data.natural.touchAction,"pan-y");
    assert.ok(data.scroll.scrollHeight>data.scroll.clientHeight,"Constrained skill content must overflow vertically");
    assert.ok(data.scroll.after>data.scroll.before,"Skill scroll owner did not actually scroll");
    console.log("✓ Skill progression mobile browser QA passed");
}finally{
    try{fs.unlinkSync(fixture);}catch(_){ }
}
