import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {spawnSync} from "node:child_process";

const ROOT=process.cwd();
const ARTIFACT_DIR=path.join(ROOT,"artifacts/browser-qa");
const FIXTURE=path.join(ROOT,".adventure-browser-qa.html");
const VIEWPORTS=[[360,800],[390,844],[412,915]];

function findChrome(){
    for(const name of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){
        const probe=spawnSync("bash",["-lc",`command -v ${name}`],{encoding:"utf8"});
        if(probe.status===0&&probe.stdout.trim()){ return probe.stdout.trim(); }
    }
    throw new Error("Headless Chrome/Chromium is required for Adventure browser QA.");
}
function read(file){ return fs.readFileSync(path.join(ROOT,file),"utf8"); }
function escHtml(value){ return String(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
function fileHref(file){ return new URL("file://"+path.join(ROOT,file).replace(/\\/g,"/")).href; }

const manifest=JSON.parse(read("asset-manifest.json"));
const feature=manifest.featureManifest;
assert.equal(feature.features.adventure,"feature-adventure");
const entryBundle=feature.bundles["feature-adventure-entry"];
const adventureBundle=feature.bundles["feature-adventure"];
assert.ok(entryBundle&&adventureBundle,"Adventure build bundles must exist in asset-manifest.json");
for(const file of [...entryBundle.scripts,...entryBundle.styles,...adventureBundle.scripts,...adventureBundle.styles]){
    assert.equal(fs.existsSync(path.join(ROOT,file)),true,`missing Adventure build artifact: ${file}`);
}
const sourceCss=read("css/adventure-v1-20260915.css")+"\n"+read("css/adventure-entry-v1-20260915.css");
assert.match(sourceCss,/env\(safe-area-inset-top\)/);
assert.match(sourceCss,/env\(safe-area-inset-bottom\)/);
assert.doesNotMatch(sourceCss,/transform\s*:\s*scale\s*\(/i,"Adventure feature CSS must not own whole-surface scaling");

const cssLinks=[...entryBundle.styles,...adventureBundle.styles]
    .map(file=>`<link rel="stylesheet" href="${escHtml(fileHref(file))}">`).join("\n");

const scenarios={
    home:`<div id="homePage" style="position:relative;width:100%;height:100%;background:#17140f"><div id="adventureHomeAxis" class="adventure-home-axis"><span class="adventure-home-gate"></span><button id="adventureHomeEntry" class="adventure-home-entry"><span class="adventure-home-kicker">江湖主線 · 章節推進</span><strong>出城冒險</strong><span class="adventure-home-notice"></span></button></div></div>`,
    map:`<section id="adventurePage" class="adventure-page"><div class="adventure-scene-decor"><span class="adventure-mountain mountain-a"></span><span class="adventure-mist mist-a"></span><span class="adventure-lantern-glow glow-a"></span></div><header class="adventure-header"><button class="adventure-back-button">返回主城</button><div class="adventure-heading"><span>出城冒險</span><strong>山關初行</strong></div><div class="adventure-header-meta"><span>建議 Lv.10</span><span>主線章節</span></div></header><div class="adventure-view"><section class="adventure-map-screen"><div class="adventure-map-caption"><span>第一章 · 山關初行</span><b>建議 Lv.10</b></div><div class="adventure-map-canvas"><svg class="adventure-road-layer" viewBox="0 0 1000 1500"><path class="adventure-road-main" d="M200 1250L500 800L650 350"></path></svg><button class="adventure-node type-battle status-completed" style="--node-x:22%;--node-y:78%"><span class="adventure-node-icon">戰</span><span class="adventure-node-copy"><strong>山道伏影</strong><small>已完成</small></span></button><button class="adventure-node type-objective status-current" style="--node-x:50%;--node-y:53%"><span class="adventure-node-icon">令</span><span class="adventure-node-copy"><strong>村民委託</strong><small>前往野怪區</small></span></button><button class="adventure-node type-rest status-available" style="--node-x:30%;--node-y:31%"><span class="adventure-node-icon">休</span><span class="adventure-node-copy"><strong>落雁驛</strong><small>休息</small></span></button><button class="adventure-node type-boss status-boss" style="--node-x:70%;--node-y:12%"><span class="adventure-node-icon">首</span><span class="adventure-node-copy"><strong>黑松寨主</strong><small>Boss</small></span></button></div><footer class="adventure-map-footer"><span>首次岔路：林間小徑</span><span>主線與野怪區分開：推進卡住時，可先回野怪區養成。</span></footer></section></div></section>`,
    event:`<section id="adventurePage" class="adventure-page"><div class="adventure-scene-decor"><span class="adventure-mist mist-a"></span></div><header class="adventure-header"><button class="adventure-back-button">返回主城</button><div class="adventure-heading"><span>出城冒險</span><strong>山關初行</strong></div><div class="adventure-header-meta"><span>建議 Lv.10</span><span>主線章節</span></div></header><div class="adventure-view"><section class="adventure-panel event-panel"><div class="adventure-panel-scene"></div><div class="adventure-panel-card"><div class="adventure-panel-title"><small>NPC／劇情事件</small><h2>山前驛旅人求助</h2></div><div class="adventure-event-layout"><div class="adventure-event-portrait"><span>旅</span></div><div class="adventure-dialogue"><b>守驛人</b><p>這是一段刻意拉長的手機閱讀驗證內容，用來確認三種指定手機尺寸下不會造成水平溢出，也不會讓文字被畫面邊界裁掉。</p><p>山路近來被黑松寨的人攔住，往來旅人只敢在驛站停留。</p></div></div><div class="adventure-panel-actions"><button class="adventure-choice">聽取提醒</button><button class="adventure-choice">直接上路</button></div></div></section></div></section>`,
    branch:`<section id="adventurePage" class="adventure-page"><header class="adventure-header"><button class="adventure-back-button">返回主城</button><div class="adventure-heading"><span>出城冒險</span><strong>山關初行</strong></div><div class="adventure-header-meta"><span>建議 Lv.10</span><span>主線章節</span></div></header><div class="adventure-view"><section class="adventure-panel branch-panel"><div class="adventure-panel-scene"></div><div class="adventure-panel-card"><div class="adventure-panel-title"><small>第一次有選擇，長期沒有遺憾</small><h2>山路分岔</h2></div><p class="adventure-lead">兩條路最後都會回到主線。首次推進選定後不能立刻回頭；章節通關後可直接回溯另一條。</p><div class="adventure-route-grid"><button class="adventure-route-choice"><span class="adventure-route-risk">較安全</span><strong>林間小徑</strong><p>繞過寨門，會遇到一名受傷旅人。</p><small>選擇此路線</small></button><button class="adventure-route-choice"><span class="adventure-route-risk">高風險</span><strong>山寨正門</strong><p>直接闖關，面對更強的守寨精英。</p><small>選擇此路線</small></button></div><div class="adventure-panel-actions"><button class="adventure-button secondary">先看看地圖</button></div></div></section></div></section>`,
    merchant:`<section id="adventurePage" class="adventure-page"><header class="adventure-header"><button class="adventure-back-button">返回主城</button><div class="adventure-heading"><span>出城冒險</span><strong>山關初行</strong></div><div class="adventure-header-meta"><span>建議 Lv.10</span><span>主線章節</span></div></header><div class="adventure-view"><section class="adventure-panel merchant-panel"><div class="adventure-panel-scene"></div><div class="adventure-panel-card"><div class="adventure-panel-title"><small>燈影下的旅商</small><h2>神秘商人</h2></div><div class="adventure-merchant-hero"><div class="adventure-merchant-portrait"><span>商</span></div><div><b>無名旅商</b><p>路過才會遇見的少量補給。不是最有效率的養成來源，也沒有商人限定核心戰力。</p><strong>持有 999,999 金幣</strong></div></div><div class="adventure-merchant-grid">${["回復 50% HP 藥水","回復 50% SP 藥水","九轉回元丹","太清聚氣丹"].map((name,index)=>`<article class="adventure-merchant-item${index>1?" rare":""}"><div class="adventure-merchant-icon">${index>1?"丹":"藥"}</div><div class="adventure-merchant-copy"><small>${index>1?"橙階珍稀":"旅途補給"}</small><strong>${name}</strong><span>數量 ×1 · 持有 9</span></div><button>${index>1?"1,800":"260"} 金</button></article>`).join("")}</div><div class="adventure-panel-actions"><button class="adventure-button secondary">離開攤位</button></div></div></section></div></section>`,
    tracker:`<div id="mapPage" style="position:relative;width:100%;height:100%;overflow:hidden;background:#17201a"><div id="mockPlayer" style="position:absolute;left:46%;top:45%;width:70px;height:100px;background:#444"></div><button id="mockControl" style="position:absolute;right:12px;bottom:12px;width:90px;height:42px">操作</button><aside id="adventureObjectiveTracker" class="adventure-objective-tracker is-ready"><button class="adventure-tracker-main"><small>出城冒險</small><strong>山狼的委託信物</strong><span class="adventure-progress-dots"><i class="filled"></i><i class="filled"></i><i class="filled"></i><i class="filled"></i><i class="filled"></i></span><b>5 / 5 ✓</b><span>山狼 · 山脊</span><em>返回章節</em></button></aside></div>`
};

function fixtureHtml(reduced){
    return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">${cssLinks}<style>
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#050505}*{box-sizing:border-box}#game-viewport{position:fixed;inset:0;overflow:hidden;background:#050505}#game-stage{position:absolute;left:50%;top:50%;width:1080px;height:1920px;transform-origin:center center}#game-content{position:absolute;left:0;top:0;width:420px;height:746.6666667px;transform:scale(${1080/420});transform-origin:top left;overflow:hidden}#qa-result{display:none}
</style></head><body><div id="game-viewport"><div id="game-stage"><div id="game-content"></div></div></div><pre id="qa-result"></pre><script>
const scenarios=${JSON.stringify(scenarios)};
const reducedExpected=${reduced?"true":"false"};
const errors=[];window.onerror=(message,source,line,column)=>{errors.push(String(message)+"@"+line+":"+column)};window.onunhandledrejection=event=>errors.push(String(event.reason||"unhandled rejection"));
function overlap(a,b){return Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));}
function outside(r){return r.left<-1||r.right>innerWidth+1||r.top<-1||r.bottom>innerHeight+1;}
function measureScenario(name,html){
 const content=document.getElementById("game-content");content.innerHTML=html;void content.offsetHeight;
 const root=document.getElementById("adventurePage")||document.getElementById("homePage")||document.getElementById("mapPage");
 const buttons=[...content.querySelectorAll("button")];const rects=buttons.map(node=>({node,r:node.getBoundingClientRect()}));
 const overlaps=[];for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++){const area=overlap(rects[i].r,rects[j].r);if(area>4){overlaps.push([i,j,Math.round(area)]);}}
 const readable=[...content.querySelectorAll(".adventure-panel-title h2,.adventure-panel-card p,.adventure-dialogue,.adventure-route-choice p,.adventure-map-footer span,.adventure-objective-paper p")];
 const clipped=readable.filter(node=>node.scrollWidth>node.clientWidth+1||((getComputedStyle(node).overflowY==="hidden"||getComputedStyle(node).overflow==="hidden")&&node.scrollHeight>node.clientHeight+1)).map(node=>node.textContent.trim().slice(0,40));
 const decorations=[...content.querySelectorAll(".adventure-scene-decor,.adventure-panel-scene,.adventure-road-layer,.adventure-landmark,.adventure-home-gate")];
 const badPointer=decorations.filter(node=>getComputedStyle(node).pointerEvents!=="none").map(node=>node.className&&String(node.className.baseVal||node.className));
 const rootRect=root?root.getBoundingClientRect():null;
 const result={name,rootOutside:rootRect?outside(rootRect):true,badButtons:rects.filter(x=>outside(x.r)).map((x,i)=>i),overlaps,clipped,badPointer,docOverflow:document.documentElement.scrollWidth>innerWidth+1||document.documentElement.scrollHeight>innerHeight+1};
 if(name==="tracker"){
   const tracker=content.querySelector("#adventureObjectiveTracker")?.getBoundingClientRect();const player=content.querySelector("#mockPlayer")?.getBoundingClientRect();const control=content.querySelector("#mockControl")?.getBoundingClientRect();
   result.trackerOverlapPlayer=tracker&&player?overlap(tracker,player):999;result.trackerOverlapControl=tracker&&control?overlap(tracker,control):999;
 }
 return result;
}
function run(){
 const scale=Math.min(innerWidth/1080,innerHeight/1920);const stage=document.getElementById("game-stage");stage.style.transform="translate(-50%,-50%) scale("+scale+")";
 const results=Object.entries(scenarios).map(([name,html])=>measureScenario(name,html));
 const content=document.getElementById("game-content");content.innerHTML=scenarios.home;void content.offsetHeight;
 const reduced=matchMedia("(prefers-reduced-motion: reduce)").matches;const entry=content.querySelector("#adventureHomeEntry");const reducedAnimation=entry?getComputedStyle(entry).animationName:"missing";
 document.getElementById("qa-result").textContent="QA_JSON:"+JSON.stringify({width:innerWidth,height:innerHeight,results,errors,reduced,reducedExpected,reducedAnimation});
}
addEventListener("load",()=>requestAnimationFrame(()=>requestAnimationFrame(run)));
</script></body></html>`;
}

const chrome=findChrome();
fs.mkdirSync(ARTIFACT_DIR,{recursive:true});
const evidence=[];
for(const [width,height] of VIEWPORTS){
    for(const reduced of [false,...(width===390&&height===844?[true]:[])]){
        fs.writeFileSync(FIXTURE,fixtureHtml(reduced),"utf8");
        const args=["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--force-device-scale-factor=1",`--window-size=${width},${height}`];
        if(reduced){ args.push("--force-prefers-reduced-motion=reduce"); }
        args.push("--dump-dom",fileHref(path.relative(ROOT,FIXTURE)));
        const run=spawnSync(chrome,args,{cwd:ROOT,encoding:"utf8",timeout:30000,maxBuffer:16*1024*1024});
        if(run.error){ throw run.error; }
        if(run.status!==0){ throw new Error(`Chrome Adventure QA failed to launch at ${width}x${height}: ${run.stderr||run.stdout}`); }
        const match=run.stdout.match(/QA_JSON:(\{[\s\S]*?\})<\/pre>/);
        assert.ok(match,`missing QA metrics at ${width}x${height}`);
        const data=JSON.parse(match[1].replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>'));
        assert.deepEqual(data.errors,[],`console/runtime errors at ${width}x${height}`);
        for(const result of data.results){
            assert.equal(result.rootOutside,false,`${result.name}: root outside viewport at ${width}x${height}`);
            assert.deepEqual(result.badButtons,[],`${result.name}: buttons outside viewport at ${width}x${height}`);
            assert.deepEqual(result.overlaps,[],`${result.name}: buttons overlap at ${width}x${height}`);
            assert.deepEqual(result.clipped,[],`${result.name}: readable text clips at ${width}x${height}`);
            assert.deepEqual(result.badPointer,[],`${result.name}: decorative layer captures pointer events at ${width}x${height}`);
            assert.equal(result.docOverflow,false,`${result.name}: document overflow at ${width}x${height}`);
            if(result.name==="tracker"){
                assert.equal(result.trackerOverlapPlayer,0,`objective HUD overlaps the player area at ${width}x${height}`);
                assert.equal(result.trackerOverlapControl,0,`objective HUD overlaps the control area at ${width}x${height}`);
            }
        }
        if(reduced){
            assert.equal(data.reduced,true,"Chrome reduced-motion emulation must be active");
            assert.equal(data.reducedAnimation,"none","Adventure home breathing animation must stop under reduced motion");
        }
        evidence.push(data);
    }
}
fs.writeFileSync(path.join(ARTIFACT_DIR,"adventure-browser-qa.json"),JSON.stringify({generatedAt:new Date().toISOString(),evidence},null,2)+"\n");
try{ fs.rmSync(FIXTURE,{force:true}); }catch(_){ }
console.log("✓ Adventure browser QA passed at 360x800, 390x844 and 412x915 (including reduced motion)");
