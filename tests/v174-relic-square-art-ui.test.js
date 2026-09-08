"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {spawnSync}=require("node:child_process");

const source=fs.readFileSync("js/60-team-relic-system.js","utf8");
const css=fs.readFileSync("css/55-team-relic-system.css","utf8");

/* Runtime source contract: all three UI surfaces already resolve through the
   same iconPath field and helper. The UI task must not introduce parallel art
   fields or touch relic gameplay data. */
assert.match(source,/function relicIconMarkup\(def,large\)\{\s*if\(def\.iconPath\)/,
    "relic art must continue to resolve from the single iconPath field");
assert.doesNotMatch(source,/\b(?:detailImage|cardImage|iconImage)\b/,
    "list/detail/current views must not introduce separate art sources");
assert.match(source,/function cardMarkup\(def\)[\s\S]*?team-relic-card-art[^\n]*relicIconMarkup\(def,false\)/,
    "list cards must render through relicIconMarkup");
assert.match(source,/function renderRelicList\(\)[\s\S]*?team-relic-current-art[^\n]*relicIconMarkup\(ownedDef,true\)/,
    "equipped relic must render through relicIconMarkup");
assert.match(source,/function detailMarkup\(def\)[\s\S]*?team-relic-detail-art[^\n]*relicIconMarkup\(def,true\)/,
    "detail hero must render through relicIconMarkup");

assert.match(css,/\.team-relic-current-art,\s*\n#game-stage \.team-relic-card-art,\s*\n#game-stage \.team-relic-detail-art\{aspect-ratio:1\/1;/,
    "current/list/detail art containers must share the same 1:1 contract");
assert.match(css,/\.team-relic-current-art img,[\s\S]*?\.team-relic-detail-art img\{[^}]*object-fit:contain/,
    "all relic art images must use contain instead of stretching/cropping");
assert.match(css,/\.team-relic-card\{[^}]*display:grid;[^}]*grid-template-columns:68px minmax\(0,1fr\)/,
    "list cards must use left-square-art/right-copy layout");
assert.match(css,/\.team-relic-card-art\{[^}]*grid-column:1;[^}]*grid-row:1\/3;[^}]*width:68px/,
    "list art must stay square at the left of both text rows");
assert.match(css,/\.team-relic-detail-hero\{[^}]*display:grid;[^}]*grid-template-columns:minmax\(96px,34%\) minmax\(0,1fr\)/,
    "detail hero must use left art and right information columns");
assert.match(css,/\.team-relic-detail-art\{[^}]*grid-column:1;[^}]*grid-row:1\/4;[^}]*width:100%/,
    "detail art must occupy only the left square column");
assert.match(css,/\.team-relic-detail-hero h2\{[^}]*grid-column:2/);
assert.match(css,/\.team-relic-detail-hero p\{[^}]*grid-column:2/);
assert.match(css,/\.team-relic-detail-hero strong\{[^}]*grid-column:2/);

function findChrome(){
    for(const name of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){
        const probe=spawnSync("bash",["-lc",`command -v ${name}`],{encoding:"utf8"});
        if(probe.status===0&&probe.stdout.trim()){ return probe.stdout.trim(); }
    }
    return "";
}

function decodeHtml(value){
    return value.replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">")
        .replace(/&quot;/g,'"').replace(/&#39;/g,"'");
}

function fixture(width,height){
    const art="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3Crect width='1024' height='1024' fill='%23110d08'/%3E%3Ccircle cx='512' cy='512' r='280' fill='%23c99b45'/%3E%3C/svg%3E";
    const cards=Array.from({length:8},(_,index)=>`<button type="button" class="team-relic-card rarity-${index===0?"orange":"purple"}${index===0?" equipped":""}"><span class="team-relic-card-art"><img src="${art}" alt=""></span><span class="team-relic-card-name">${index===0?"天罡戰旗":"測試秘寶"+(index+1)}</span><span class="team-relic-card-meta">Lv.${20-index}・${index%2?"回復":"防禦"}</span>${index===0?"<em>已裝備</em>":""}</button>`).join("");
    return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="css/55-team-relic-system.css"><style>html,body{margin:0;width:${width}px;min-width:0;background:#050505;overflow-x:hidden}#game-stage{width:${width}px;min-height:${height}px;box-sizing:border-box;padding:10px;background:#080706}.qa-shell{width:100%;min-width:0;box-sizing:border-box}.qa-gap{height:12px}#result{display:none}</style></head><body><div id="game-stage"><div class="qa-shell">
      <div class="team-relic-current-card"><div class="team-relic-current-art"><img src="${art}" alt=""></div><div class="team-relic-current-copy"><small>目前隊伍秘寶</small><b>天罡戰旗 <span>Lv.20</span></b><p>對敵方全體造成秘寶威力並降低攻擊。</p></div><div class="team-relic-current-actions"><button>卸下</button><button>詳情</button></div></div>
      <div class="team-relic-grid">${cards}</div><div class="qa-gap"></div>
      <div class="team-relic-detail"><div class="team-relic-detail-hero rarity-orange"><div class="team-relic-detail-art"><img src="${art}" alt=""></div><h2>天罡戰旗</h2><p>橙階・Lv.20 / 20</p><strong>防禦 / attack・defense・anti_swarm</strong></div><section><h3>觸發條件</h3><p>我方累積受到6次敵方有效攻擊後。</p></section></div>
    </div></div><pre id="result"></pre><script>(function(){var q=function(s){return document.querySelector(s)},qa=function(s){return Array.from(document.querySelectorAll(s))},r=function(e){var x=e.getBoundingClientRect();return {left:x.left,top:x.top,right:x.right,bottom:x.bottom,width:x.width,height:x.height}};var currentArt=q('.team-relic-current-art'),currentCopy=q('.team-relic-current-copy'),currentActions=q('.team-relic-current-actions'),cardArts=qa('.team-relic-card-art'),cards=qa('.team-relic-card'),names=qa('.team-relic-card-name'),metas=qa('.team-relic-card-meta'),detailArt=q('.team-relic-detail-art'),detailTitle=q('.team-relic-detail-hero h2'),detailMeta=q('.team-relic-detail-hero p'),detailTags=q('.team-relic-detail-hero strong'),grid=q('.team-relic-grid');q('#result').textContent=JSON.stringify({viewport:{width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth},current:{art:r(currentArt),copy:r(currentCopy),actions:r(currentActions),fit:getComputedStyle(currentArt.querySelector('img')).objectFit},grid:{columns:getComputedStyle(grid).gridTemplateColumns,cards:cards.map(r),arts:cardArts.map(r),names:names.map(r),metas:metas.map(r),fits:cardArts.map(n=>getComputedStyle(n.querySelector('img')).objectFit)},detail:{art:r(detailArt),title:r(detailTitle),meta:r(detailMeta),tags:r(detailTags),fit:getComputedStyle(detailArt.querySelector('img')).objectFit}})})();</script></body></html>`;
}

function run(chrome,width,height){
    const file=path.join(process.cwd(),`.relic-square-art-qa-${width}.html`);
    fs.writeFileSync(file,fixture(width,height),"utf8");
    try{
        const result=spawnSync(chrome,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--force-device-scale-factor=1",`--window-size=${width},${height}`,"--dump-dom","file://"+file.replace(/\\/g,"/")],{encoding:"utf8",timeout:30000,maxBuffer:12*1024*1024});
        assert.equal(result.status,0,result.stderr||`relic square-art browser fixture failed at ${width}px`);
        const match=result.stdout.match(/<pre id="result">([\s\S]*?)<\/pre>/);
        assert.ok(match,`relic square-art browser metrics missing at ${width}px`);
        return JSON.parse(decodeHtml(match[1]));
    }finally{
        try{ fs.unlinkSync(file); }catch(_){ }
    }
}

function square(rect,label){
    assert.ok(Math.abs(rect.width-rect.height)<=1,`${label} is not square (${rect.width}x${rect.height})`);
}

function verify(data,width){
    const tolerance=1;
    assert.ok(data.viewport.scrollWidth<=width+tolerance,`${width}px page has horizontal overflow (${data.viewport.scrollWidth})`);
    square(data.current.art,`${width}px current art`);
    assert.equal(data.current.fit,"contain");
    assert.ok(data.current.art.right<=data.current.copy.left+tolerance,`${width}px current art overlaps copy`);
    assert.ok(data.current.actions.right<=width-tolerance,`${width}px current actions escape viewport`);

    assert.equal(data.grid.columns.trim().split(/\s+/).length,2,`${width}px grid is not two columns`);
    assert.equal(data.grid.cards.length,8);
    assert.ok(Math.abs(data.grid.cards[0].height-data.grid.cards[1].height)<=tolerance,`${width}px card row heights differ`);
    for(let i=0;i<data.grid.cards.length;i++){
        const card=data.grid.cards[i],art=data.grid.arts[i],name=data.grid.names[i],meta=data.grid.metas[i];
        assert.ok(card.left>=-tolerance&&card.right<=width+tolerance,`${width}px card ${i} escapes viewport`);
        square(art,`${width}px card ${i} art`);
        assert.equal(data.grid.fits[i],"contain");
        assert.ok(art.right<=name.left+tolerance&&art.right<=meta.left+tolerance,`${width}px card ${i} art is not left of copy`);
    }

    square(data.detail.art,`${width}px detail art`);
    assert.equal(data.detail.fit,"contain");
    assert.ok(data.detail.art.right<=data.detail.title.left+tolerance,`${width}px detail art is not left of title`);
    assert.ok(data.detail.art.right<=data.detail.meta.left+tolerance,`${width}px detail art is not left of rarity/level`);
    assert.ok(data.detail.art.right<=data.detail.tags.left+tolerance,`${width}px detail art is not left of tags`);
    assert.ok(data.detail.tags.right<=width+tolerance,`${width}px detail tags escape viewport`);
}

const chrome=findChrome();
if(!chrome){
    if(process.env.CI){ throw new Error("CI must provide Chrome for relic square-art mobile browser QA"); }
    console.log("Relic square-art mobile browser QA skipped: Chrome not available");
}else{
    for(const [width,height] of [[360,800],[390,844],[412,915],[430,932]]){
        verify(run(chrome,width,height),width);
    }
    console.log("✓ Relic square-art mobile browser QA passed at 360/390/412/430px");
}
