"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const cp=require("node:child_process");

function chrome(){
    const configured=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
    if(configured&&fs.existsSync(configured)){return configured;}
    for(const name of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){
        const result=cp.spawnSync("which",[name],{encoding:"utf8"});
        if(result.status===0&&result.stdout.trim()){ return result.stdout.trim(); }
    }
    return "";
}

const browser=chrome();
if(!browser){ console.log("main-city roster header browser check skipped: Chrome unavailable"); process.exit(0); }

const fixture=path.join(process.cwd(),".main-city-roster-header-browser.html");
const fileUrl="file://"+fixture.replace(/\\/g,"/");
const cases=[360,393,412,768,1366,1920];
const cityHud=fs.readFileSync('index.html','utf8').match(/<header class="home-city-hud"[\s\S]*?<\/header>/)[0];
const html=width=>`<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="css/00-main.css">
<link rel="stylesheet" href="css/19-stage-v54-main-city-moderate-native-scale.css">
<link rel="stylesheet" href="css/31-v131-fix-batch.css">
<style>
html,body{margin:0;width:${width}px;height:900px;overflow:hidden;background:#050505}
#game-ui{width:${width}px!important;height:900px!important;transform:none!important;overflow:hidden!important}
#homePage{display:block!important;width:${width}px!important;height:900px!important}
#v146HomeRoster{margin:8px 10px!important;width:auto!important}
</style></head><body><div id="game-ui"><div id="homePage">${cityHud}
<section id="v146HomeRoster" class="v146-home-roster"><header>
<b>冒險隊伍</b><span class="v146-home-roster-count">隊伍 3 / 6</span>
<span class="v146-home-roster-gold">金幣 <strong>9,999,999</strong></span>
<button type="button" class="v-fixed-formation-entry">佈陣</button>
</header><div class="v146-home-character">甲</div><div class="v146-home-character">乙</div><div class="v146-home-character">丙</div>
<div class="team-relic-loadout-slot"><span>隊伍秘寶</span><b>乾坤玉壺 Lv.1</b><button>更換</button></div></section>
</div></div><pre id="result"></pre><script>
const rect=e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
const overlap=(a,b)=>a.left<b.right&&b.left<a.right&&a.top<b.bottom&&b.top<a.bottom;
const root=document.documentElement,page=document.getElementById('homePage'),header=document.querySelector('#v146HomeRoster>header'),count=document.querySelector('.v146-home-roster-count'),gold=document.querySelector('.v146-home-roster-gold'),formation=document.querySelector('.v-fixed-formation-entry');
homeHudGoldValue.textContent='9,999,999';homeHudExpValue.textContent='9,999,999,999';
const resources=[...document.querySelectorAll('.home-hud-resources>span')].map(n=>{const range=document.createRange();range.selectNodeContents(n);const r=range.getBoundingClientRect();return {box:rect(n),text:{left:r.left,right:r.right,top:r.top,bottom:r.bottom},overflow:n.scrollWidth-n.clientWidth,font:parseFloat(getComputedStyle(n).fontSize)};});
document.getElementById('result').textContent=JSON.stringify({width:${width},viewport:innerWidth,pageWidth:rect(page).width,pageOverflow:page.scrollWidth-page.clientWidth,docWidth:root.scrollWidth,header:rect(header),count:rect(count),gold:rect(gold),formation:rect(formation),countGold:overlap(rect(count),rect(gold)),goldFormation:overlap(rect(gold),rect(formation)),resources});
</script></body></html>`;

try{
    for(const width of cases){
        fs.writeFileSync(fixture,html(width),"utf8");
        const run=cp.spawnSync(browser,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--force-device-scale-factor=1",`--window-size=${width},900`,"--dump-dom",fileUrl],{encoding:"utf8",timeout:30000,maxBuffer:4*1024*1024});
        assert.equal(run.status,0,run.stderr||"Chrome failed");
        const match=run.stdout.match(/<pre id="result">([\s\S]*?)<\/pre>/);
        assert.ok(match,"header geometry result missing");
        const data=JSON.parse(match[1].replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"'));
        assert.equal(data.pageWidth,width);
        assert.ok(data.header.width>0&&data.header.height>0,`${width}px header is not visible`);
        assert.equal(data.countGold,false,`${width}px team count overlaps gold`);
        assert.equal(data.goldFormation,false,`${width}px gold overlaps formation button`);
        assert.ok(data.pageOverflow<=1,`${width}px home page has internal horizontal overflow: ${data.pageOverflow}`);
        assert.equal(data.resources.length,2,'both resources remain visible');
        for(const resource of data.resources){
            assert.ok(resource.overflow<=1,`${width}px resource text overflows its cell`);
            assert.ok(resource.font>=13,`${width}px resource reading size regressed`);
            assert.ok(resource.text.left>=resource.box.left-1&&resource.text.right<=resource.box.right+1&&resource.text.top>=resource.box.top-1&&resource.text.bottom<=resource.box.bottom+1,`${width}px resource glyphs escape their cell`);
        }
    }
    console.log("Main-city HUD and roster geometry passed at six widths with 9,999,999 gold and 9,999,999,999 EXP");
}finally{ try{ fs.unlinkSync(fixture); }catch(_){} }
