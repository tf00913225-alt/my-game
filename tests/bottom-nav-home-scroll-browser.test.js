"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const cp=require("node:child_process");
const root=path.resolve(__dirname,"..");
const chrome=["google-chrome","google-chrome-stable","chromium","chromium-browser"]
    .map(name=>cp.spawnSync("bash",["-lc",`command -v ${name}`],{encoding:"utf8"}))
    .find(result=>result.status===0&&result.stdout.trim())?.stdout.trim();
if(!chrome){
    if(process.env.CI){ throw new Error("Chrome required for navigation and home geometry QA"); }
    console.log("Navigation and home geometry browser QA skipped: Chrome unavailable");
    process.exit(0);
}
const manifest=JSON.parse(fs.readFileSync(path.join(root,"build/asset-manifest.json"),"utf8"));
const styles=[...(manifest.critical.styles||[]),...(manifest.featureManifest?.bundles?.["app-shell"]?.styles||[]),
    ...(manifest.featureManifest?.bundles?.["gameplay-core"]?.styles||[])];
// The fixture loads the same built CSS surfaces used by production.
const css=[...new Set(styles)].map(file=>`<link rel="stylesheet" href="${file}">`).join("");
const source=fs.readFileSync(path.join(root,"index.html"),"utf8");
const start=source.indexOf('<div\n    id="homePage"');
const end=source.indexOf('<div\n    id="trainingPage"',start);
assert.ok(start>=0&&end>start,"home source boundary missing");
const home=source.slice(start,end);
const navStart=source.indexOf('<div id="bottomNav"');
const navEnd=source.indexOf("</div>",navStart)+6;
assert.ok(navStart>=0&&navEnd>navStart,"canonical nav source missing");
const nav=source.slice(navStart,navEnd);
const roster=`<section id="v146HomeRoster" class="v146-home-roster"><header><b>冒險隊伍</b><span class="v146-home-roster-count">隊伍 3 / 6</span><span class="v146-home-roster-gold">金幣 <strong>99999</strong></span><button class="v-fixed-formation-entry">佈陣</button></header>${Array.from({length:3},(_,i)=>`<article class="v146-home-character"><div class="v146-home-avatar"></div><div class="v146-home-character-main"><div><b>角色${i+1}</b><span>Lv99</span></div><div class="v146-home-resource hp"><strong>HP 9999</strong></div><div class="v146-home-resource sp"><strong>SP 9999</strong></div></div></article>`).join("")}<div class="team-relic-loadout-slot"><span>隊伍秘寶</span><b>乾坤玉壺</b><small>已裝備</small><button>選擇</button></div></section>`;
const fixture=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${css}<style>html,body{margin:0}#game-stage{position:relative;margin:0;transform:scale(.3638889);transform-origin:top left}#legalScroll{height:120px;overflow-y:auto}</style></head><body><div id="game-stage"><div id="app" class="no-header no-scroll-page"><div id="game-content"><div class="content">${home}<div id="legalScroll"><div style="height:400px"></div></div></div>${nav}</div></div><div id="game-overlay-layer"></div></div><pre id="result"></pre><script src="js/04-stage-v11-native-bottom-nav-runtime.js"></script><script>
const grid=document.querySelector('.home-card-grid');grid.insertAdjacentHTML('afterend',${JSON.stringify(roster)});
const manager=window.FourSymbolsBottomNav;manager.renderMain('home');
const shell=document.querySelector('.native-bottom-nav-layer');
const rect=n=>{const r=n.getBoundingClientRect();return {width:r.width,height:r.height,bottom:r.bottom,left:r.left}};
const contexts=['home','training','patrol','dungeon','gameplay','boss','tower','abyss'];
const results=contexts.map(mode=>{
 if(mode==='home')manager.renderMain('home');else manager.renderContext([['角色','assets/ui/nav-character.png',''],['背包','assets/ui/nav-backpack.png',''],['秘寶','assets/ui/nav-relic-v175.webp',''],['元素匣','assets/ui/nav-element-box.png',''],['返回','assets/ui/map-return.png','']],mode);
 return {mode,shell:rect(shell),nav:rect(document.getElementById('bottomNav')),columns:[...document.querySelectorAll('#bottomNav > button')].map(rect),icons:[...document.querySelectorAll('#bottomNav img')].map(rect),owners:document.querySelectorAll('.native-bottom-nav-layer').length,visibleNav:document.querySelectorAll('#bottomNav').length};
});
const page=document.getElementById('homePage');const before=page.scrollTop;page.scrollTop=120;
const legal=document.getElementById('legalScroll');legal.scrollTop=50;
document.getElementById('result').textContent=JSON.stringify({results,home:{clientHeight:page.clientHeight,scrollHeight:page.scrollHeight,scrollTop:page.scrollTop,before,overflow:getComputedStyle(page).overflowY},legalScrollTop:legal.scrollTop,documentScroll:document.scrollingElement.scrollTop});
</script></body></html>`;
const file=path.join(root,".bottom-nav-home-geometry-qa.html");
try{
    fs.writeFileSync(file,fixture);
    const result=cp.spawnSync(chrome,["--headless=new","--no-sandbox","--disable-gpu","--allow-file-access-from-files","--window-size=393,873","--dump-dom","file://"+file],{encoding:"utf8",timeout:30000,maxBuffer:16*1024*1024});
    assert.equal(result.status,0,result.stderr);
    const match=result.stdout.match(/<pre id="result">([^<]+)<\/pre>/);
    assert.ok(match,"browser geometry evidence missing");
    const data=JSON.parse(match[1].replace(/&quot;/g,'"').replace(/&amp;/g,"&"));
    const baseline=data.results[0];
    for(const row of data.results){
        assert.equal(row.owners,1,row.mode+" shell owners");
        assert.equal(row.visibleNav,1,row.mode+" nav count");
        for(const key of ["width","height","bottom","left"]){
            assert.ok(Math.abs(row.nav[key]-baseline.nav[key])<=1,row.mode+" "+key);
        }
        assert.equal(row.columns.length,5,row.mode+" columns");
        assert.ok(row.columns.every(column=>Math.abs(column.width-row.columns[0].width)<=1),row.mode+" uneven columns");
        assert.ok(row.icons.every(icon=>Math.abs(icon.height-row.icons[0].height)<=1),row.mode+" icon frames");
    }
    assert.ok(data.home.scrollHeight<=data.home.clientHeight+1,JSON.stringify(data.home));
    assert.equal(data.home.scrollTop,0);
    assert.equal(data.documentScroll,0);
    assert.equal(data.legalScrollTop,50);
    console.log("Navigation and home geometry browser QA passed",JSON.stringify(data));
}finally{try{fs.unlinkSync(file);}catch(_){}}
