"use strict";
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const configured=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
let browser=configured&&fs.existsSync(configured)?configured:'';
if(!browser)for(const name of ['google-chrome','google-chrome-stable','chromium','chromium-browser']){
 const r=cp.spawnSync('which',[name],{encoding:'utf8'});if(r.status===0){browser=r.stdout.trim();break;}
}
if(!browser){console.log('main-city header geometry skipped: Chrome unavailable');process.exit(0);}
const root=process.cwd(),fixture=path.join(root,'.main-city-roster-header-browser.html');
const header=fs.readFileSync('index.html','utf8').match(/<header class="home-city-hud"[\s\S]*?<\/header>/)[0];
try{
 for(const width of [360,393,412,768,1366,1920]){
 const scale=Math.min(width/1080,900/1920);
 const html=`<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="css/00-main.css"><link rel="stylesheet" href="css/19-stage-v54-main-city-moderate-native-scale.css"><link rel="stylesheet" href="css/31-v131-fix-batch.css"><style>html,body{margin:0;width:${width}px;height:900px;overflow:hidden}#game-stage{position:relative;width:1080px;height:1920px;transform-origin:top left;transform:scale(${scale})}#homePage{display:grid}</style></head><body><div id="game-stage"><div id="game-ui"><div id="homePage">${header}<section id="v146HomeRoster" class="v146-home-roster"><header><span class="v146-home-roster-count">出戰 5 / 6</span><button class="v-fixed-formation-entry">佈陣</button></header>${[0,1,2].map(()=>'<article class="v146-home-character"><b title="非常長的角色名稱驗證">非常長的角色名稱驗證</b><span>Lv.100</span><div class="home-status-meter" data-resource="hp" title="HP 1250000000 / 1250000000"><span>HP</span><span class="home-status-track" role="meter" aria-label="HP" aria-valuemin="0" aria-valuemax="1250000000" aria-valuenow="1250000000"><i style="width:100%"></i></span></div><div class="home-status-meter" data-resource="sp" title="SP 9990000 / 9990000"><span>SP</span><span class="home-status-track" role="meter" aria-label="SP" aria-valuemin="0" aria-valuemax="9990000" aria-valuenow="9990000"><i style="width:100%"></i></span></div></article>').join('')}</section><div class="home-card-grid"></div><div class="team-relic-loadout-slot"><span>隊伍秘寶</span><b>乾坤玉壺 Lv.20</b><small>觸發說明</small><button>更換</button></div></div></div></div><pre id="result"></pre><script>
 homeHudGoldValue.textContent='999萬';homeHudExpValue.textContent='99.9億';homeBannerName.textContent='非常長的角色名稱驗證';
 const nodes=[...document.querySelectorAll('.v146-home-character>b,.v146-home-character>span,.home-status-meter>span:first-child,.home-hud-resources>span')];
 const data={overflow:homePage.scrollWidth-homePage.clientWidth,rows:document.querySelectorAll('.v146-home-character').length,width:homePage.getBoundingClientRect().width,cells:nodes.map(n=>({text:n.textContent,overflow:n.scrollWidth-n.clientWidth,vertical:n.matches(".v146-home-character>b")?n.scrollHeight-n.clientHeight:0}))};document.getElementById('result').textContent=JSON.stringify(data);
 </script></body></html>`;
 fs.writeFileSync(fixture,html);
 const run=cp.spawnSync(browser,['--headless=new','--no-sandbox','--disable-gpu','--allow-file-access-from-files','--force-device-scale-factor=1','--window-size='+width+',900','--dump-dom','file:///'+fixture.replace(/\\/g,'/')],{encoding:'utf8',timeout:30000,maxBuffer:4*1024*1024});
 assert.equal(run.status,0,run.stderr);const match=run.stdout.match(/<pre id="result">([\s\S]*?)<\/pre>/);assert.ok(match);const data=JSON.parse(match[1]);
 assert.equal(data.rows,3);assert.ok(Math.abs(data.width-1080*scale)<.03);assert.ok(data.overflow<=1);
 for(const cell of data.cells){assert.ok(cell.overflow<=1,width+': '+JSON.stringify(cell));assert.ok(cell.vertical<=1,width+': '+JSON.stringify(cell));}
 }
 console.log('Main-city large-number header geometry passed at six projected widths.');
}finally{fs.rmSync(fixture,{force:true});}
