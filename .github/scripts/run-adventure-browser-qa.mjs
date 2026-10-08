import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import {spawn,spawnSync} from "node:child_process";
import {startServer,waitJson,Cdp,findChrome as productionChrome} from './runtime-browser-qa-support.mjs';

// Same Adventure QA entry; production mode extends the historical layout fixtures.
if(process.env.ADVENTURE_MONSTER_BALANCE_QA==='1'){
    await runProductionAdventureBalanceQa();
    process.exit(0);
}

const ROOT=process.cwd();
const ARTIFACT_DIR=path.join(ROOT,"artifacts/browser-qa");
const VIEWPORTS=[[360,800],[393,873],[412,915]];

function findChrome(){
    for(const name of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){
        const probe=spawnSync("bash",["-lc",`command -v ${name}`],{encoding:"utf8"});
        if(probe.status===0&&probe.stdout.trim()){ return probe.stdout.trim(); }
    }
    throw new Error("Headless Chrome/Chromium is required for Adventure browser QA.");
}
function read(file){ return fs.readFileSync(path.join(ROOT,file),"utf8"); }
function sleep(ms){ return new Promise(resolve=>setTimeout(resolve,ms)); }
async function reservePort(){
    return new Promise((resolve,reject)=>{
        const server=net.createServer();
        server.once("error",reject);
        server.listen(0,"127.0.0.1",()=>{
            const address=server.address();
            const port=typeof address==="object"&&address?address.port:null;
            server.close(error=>error?reject(error):resolve(port));
        });
    });
}
function openCdp(webSocketDebuggerUrl){
    const socket=new WebSocket(webSocketDebuggerUrl);
    const pending=new Map();
    let nextId=1;
    const ready=new Promise((resolve,reject)=>{
        socket.addEventListener("open",resolve,{once:true});
        socket.addEventListener("error",reject,{once:true});
    });
    socket.addEventListener("message",event=>{
        const message=JSON.parse(String(event.data));
        if(!message.id||!pending.has(message.id)){ return; }
        const request=pending.get(message.id);
        pending.delete(message.id);
        if(message.error){ request.reject(new Error(message.error.message)); }
        else{ request.resolve(message.result); }
    });
    return {
        ready,
        send:async(method,params={})=>{
            await ready;
            const id=nextId++;
            return new Promise((resolve,reject)=>{
                pending.set(id,{resolve,reject});
                socket.send(JSON.stringify({id,method,params}));
            });
        },
        close:()=>socket.close()
    };
}

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
assert.match(sourceCss,/prefers-reduced-motion\s*:\s*reduce/i);
assert.doesNotMatch(sourceCss,/transform\s*:\s*scale\s*\(/i,"Adventure feature CSS must not own whole-surface scaling");
assert.match(sourceCss,/aspect-ratio\s*:\s*9\s*\/\s*16/i,"Adventure map must preserve the 9:16 chapter composition");
const builtCss=[...entryBundle.styles,...adventureBundle.styles].map(read).join("\n").replace(/<\/style/gi,"<\\/style");

const mapRoad='<svg class="adventure-road-layer" viewBox="0 0 1080 1920" preserveAspectRatio="none" aria-hidden="true"><path class="adventure-road-bed" d="M194 1613C255 1545 305 1490 356 1440C414 1385 475 1328 529 1267"></path><path class="adventure-road-main" d="M194 1613C255 1545 305 1490 356 1440C414 1385 475 1328 529 1267"></path><path class="adventure-road-branch-bed" d="M529 1267C470 1208 395 1134 335 1075C385 1016 456 946 540 883"></path><path class="adventure-road-branch" d="M529 1267C470 1208 395 1134 335 1075C385 1016 456 946 540 883"></path><path class="adventure-road-branch-bed" d="M529 1267C590 1206 659 1134 724 1075C676 1008 612 942 540 883"></path><path class="adventure-road-branch" d="M529 1267C590 1206 659 1134 724 1075C676 1008 612 942 540 883"></path><path class="adventure-road-bed" d="M540 883C474 818 391 749 324 691C389 642 477 596 551 557C625 516 696 470 756 422C718 359 654 299 594 250C527 205 446 165 367 134"></path><path class="adventure-road-main" d="M540 883C474 818 391 749 324 691C389 642 477 596 551 557C625 516 696 470 756 422C718 359 654 299 594 250C527 205 446 165 367 134"></path><path class="adventure-road-hidden" d="M540 883C648 860 754 824 853 787"></path></svg>';
const node=(id,type,status,x,y,title)=>{
    const glyph={event:"人",battle:"戰",branch:"岔",elite:"精",objective:"令",rest:"休",chest:"箱",boss:"首",finish:"旗",hidden:"？"}[type]||"路";
    return `<button data-node-id="${id}" class="adventure-node type-${type} status-${status}" style="--node-x:${x}%;--node-y:${y}%"${status==="planned"?" disabled":""}><span class="adventure-node-icon">${glyph}</span><span class="adventure-node-copy"><strong>${title}</strong></span></button>`;
};
const mapScene='<div class="adventure-map-depth adventure-map-far"></div><div class="adventure-map-depth adventure-map-mid"></div><div class="adventure-boss-landscape"></div>'+mapRoad+
    node("n01_arrival","event","completed",18,96,"山前驛")+
    node("n02_roadfight","battle","completed",36,89,"山道伏影")+
    node("n03_fork","branch","current",52,82,"岔路口")+
    node("n04a_path","event","available",33,75,"林間小徑")+
    node("n04b_gate","elite","available",72,75,"山寨正門")+
    node("n05_commission","objective","locked",52,68,"村民委託")+
    node("hidden_merchant","hidden","hidden-available",79,41,"未知之處")+
    node("n06_rest","rest","locked",31,61,"落雁驛")+
    node("n07_chest","chest","locked",54,54,"舊驛箱")+
    node("n08_truth","event","locked",72,47,"寨下石橋")+
    node("n09_boss","boss","locked",55,39,"黑松寨主")+
    node("n10_finish","finish","locked",35,32,"章節終點")+
    node("n11_reserved","event","planned",20,26,"山霧古道")+
    node("n12_reserved","battle","planned",45,22,"古道伏兵")+
    node("n13_reserved","chest","planned",68,19,"斷碑密匣")+
    node("n14_reserved","rest","planned",44,16,"松風驛")+
    node("n15_reserved","elite","planned",70,13,"斷嶺哨所")+
    node("n16_reserved","event","planned",51,10,"殘燈舊舍")+
    node("n17_reserved","battle","planned",30,8,"石徑追影")+
    node("n18_reserved","chest","planned",54,6,"關隘藏箱")+
    node("n19_reserved","boss","planned",70,4,"黑松寨主")+
    node("n20_reserved","finish","planned",46,2,"山關重開")+
    '<div class="adventure-landmark landmark-village"><i></i><span>村落</span></div><div class="adventure-landmark landmark-bridge"><i></i><span>石橋</span></div><div class="adventure-landmark landmark-fort"><i></i><span>山寨</span></div><div class="adventure-map-fog"></div><div class="adventure-map-depth adventure-map-near"></div>';

const scenarios={
    home:`<div id="homePage" style="position:relative;width:100%;height:100%;background:#17140f"><div id="adventureHomeAxis" class="adventure-home-axis"><span class="adventure-home-gate" aria-hidden="true"></span><button id="adventureHomeEntry" class="adventure-home-entry"><span class="adventure-home-kicker">江湖主線 · 章節推進</span><strong>出城冒險</strong><span class="adventure-home-notice"></span></button></div></div>`,
    map:`<section id="adventurePage" class="adventure-page"><div class="adventure-scene-decor"><span class="adventure-world-bg"></span><span class="adventure-world-far"></span><span class="adventure-world-mid"></span><span class="adventure-world-near"></span><span class="adventure-mist mist-a"></span></div><header class="adventure-header"><button class="adventure-back-button">返回主城</button><div class="adventure-heading"><span>出城冒險</span><strong>山關初行</strong></div><div class="adventure-header-meta"><span>建議 Lv.10</span><span>主線章節</span></div></header><div class="adventure-view"><section class="adventure-map-screen"><div class="adventure-map-caption"><span>第一章 · 山關初行</span><b>2 / 20 關</b></div><div class="adventure-map-canvas">${mapScene}</div><aside class="adventure-node-sheet is-current"><div class="adventure-sheet-summary"><span class="adventure-sheet-icon type-branch">岔</span><div><small>路線選擇</small><h2>岔路口</h2><p>選擇你的第一條江湖路。</p><span class="adventure-sheet-tag">新手引導 · 技能學習／升級</span></div></div><div class="adventure-sheet-actions"><button class="adventure-button primary">選擇路線</button></div></aside></section></div></section>`,
    event:`<section id="adventurePage" class="adventure-page"><header class="adventure-header"><button class="adventure-back-button">返回主城</button><div class="adventure-heading"><span>出城冒險</span><strong>山關初行</strong></div><div class="adventure-header-meta"><span>建議 Lv.10</span><span>主線章節</span></div></header><div class="adventure-view"><section class="adventure-panel event-panel"><div class="adventure-panel-scene"></div><div class="adventure-panel-card"><div class="adventure-panel-title"><small>NPC／劇情事件</small><h2>山前驛旅人求助</h2></div><div class="adventure-event-layout"><div class="adventure-event-portrait"><span>旅</span></div><div class="adventure-dialogue"><b>守驛人</b><p>這是一段刻意拉長的手機閱讀驗證內容，用來確認指定尺寸下文字不會水平裁切。</p><p>山路近來被黑松寨的人攔住，往來旅人只敢在驛站停留。</p></div></div><div class="adventure-panel-actions"><button class="adventure-choice">聽取提醒</button><button class="adventure-choice">直接上路</button></div></div></section></div></section>`,
    branch:`<section id="adventurePage" class="adventure-page"><header class="adventure-header"><button class="adventure-back-button">返回主城</button><div class="adventure-heading"><span>出城冒險</span><strong>山關初行</strong></div><div class="adventure-header-meta"><span>建議 Lv.10</span><span>主線章節</span></div></header><div class="adventure-view"><section class="adventure-panel branch-panel"><div class="adventure-panel-scene"></div><div class="adventure-panel-card"><div class="adventure-panel-title"><small>第一次有選擇，長期沒有遺憾</small><h2>山路分岔</h2></div><p class="adventure-lead">兩條路最後都會回到主線。首次推進選定後不能立刻回頭；章節通關後可直接回溯另一條。</p><div class="adventure-route-grid"><button class="adventure-route-choice"><span class="adventure-route-risk">較安全</span><strong>林間小徑</strong><p>繞過寨門，會遇到一名受傷旅人。</p><small>選擇此路線</small></button><button class="adventure-route-choice"><span class="adventure-route-risk">高風險</span><strong>山寨正門</strong><p>直接闖關，面對更強的守寨精英。</p><small>選擇此路線</small></button></div><div class="adventure-panel-actions"><button class="adventure-button secondary">先看看地圖</button></div></div></section></div></section>`,
    merchant:`<section id="adventurePage" class="adventure-page"><header class="adventure-header"><button class="adventure-back-button">返回主城</button><div class="adventure-heading"><span>出城冒險</span><strong>山關初行</strong></div><div class="adventure-header-meta"><span>建議 Lv.10</span><span>主線章節</span></div></header><div class="adventure-view"><section class="adventure-panel merchant-panel"><div class="adventure-panel-scene"></div><div class="adventure-panel-card"><div class="adventure-panel-title"><small>燈影下的旅商</small><h2>神秘商人</h2></div><div class="adventure-merchant-hero"><div class="adventure-merchant-portrait"><span>商</span></div><div><b>無名旅商</b><p>旅途中偶遇的少量補給，不販售商人限定核心戰力。</p><strong>持有 999,999 金幣</strong></div></div><div class="adventure-merchant-grid"><article class="adventure-merchant-item rare"><div class="adventure-merchant-icon">丹</div><div class="adventure-merchant-copy"><small>橙階珍稀</small><strong>九轉回元丹</strong><span>數量 ×1 · 持有 9</span></div><button>1,800 金</button></article><article class="adventure-merchant-item"><div class="adventure-merchant-icon">藥</div><div class="adventure-merchant-copy"><small>旅途補給</small><strong>回復 50% SP 藥水</strong><span>數量 ×1 · 持有 9</span></div><button>260 金</button></article></div><div class="adventure-panel-actions"><button class="adventure-button secondary">離開攤位</button></div></div></section></div></section>`,
    tracker:`<div id="mapPage" style="position:relative;width:100%;height:100%;overflow:hidden;background:#17201a"><div id="mockPlayer" style="position:absolute;left:46%;top:45%;width:70px;height:100px;background:#444"></div><button id="mockControl" style="position:absolute;right:12px;bottom:12px;width:90px;height:42px">操作</button><aside id="adventureObjectiveTracker" class="adventure-objective-tracker is-ready"><button class="adventure-tracker-main"><small>出城冒險</small><strong>山狼的委託信物</strong><span class="adventure-progress-dots"><i class="filled"></i><i class="filled"></i><i class="filled"></i><i class="filled"></i><i class="filled"></i></span><b>5 / 5 ✓</b><span>山狼 · 山脊</span><em>返回章節</em></button></aside></div>`
};

function fixtureHtml(){
    return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>${builtCss}</style><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#050505}*{box-sizing:border-box}#game-viewport{position:fixed;inset:0;overflow:hidden;background:#050505}#game-stage{position:absolute;left:50%;top:50%;width:1080px;height:1920px;transform-origin:center center}#game-content{position:absolute;left:0;top:0;width:420px;height:746.6666667px;transform:scale(${1080/420});transform-origin:top left;overflow:hidden}#qa-result{display:none}</style></head><body><div id="game-viewport"><div id="game-stage"><div id="game-content"></div></div></div><pre id="qa-result"></pre><script>
const scenarios=${JSON.stringify(scenarios)};const errors=[];
window.onerror=(message,source,line,column)=>errors.push(String(message)+"@"+line+":"+column);
window.onunhandledrejection=event=>errors.push(String(event.reason||"unhandled rejection"));
function overlap(a,b){return Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));}
function outside(r){return r.left<-1||r.right>innerWidth+1||r.top<-1||r.bottom>innerHeight+1;}
function normPoint(node,map){const r=node.getBoundingClientRect(),m=map.getBoundingClientRect();return{x:(r.left+r.width/2-m.left)/m.width,y:(r.top+r.height/2-m.top)/m.height};}
function measure(name,html){
 const content=document.getElementById("game-content");content.innerHTML=html;void content.offsetHeight;
 const root=document.getElementById("adventurePage")||document.getElementById("homePage")||document.getElementById("mapPage");
 const buttons=[...content.querySelectorAll("button")];const rects=buttons.map(node=>({node,r:node.getBoundingClientRect()}));const overlaps=[];
 for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++){const area=overlap(rects[i].r,rects[j].r);if(area>16)overlaps.push([i,j,Math.round(area)]);}
 const readable=[...content.querySelectorAll(".adventure-panel-title h2,.adventure-panel-card p,.adventure-dialogue,.adventure-route-choice p,.adventure-node-sheet p")];
 const clipped=readable.filter(node=>node.scrollWidth>node.clientWidth+1||((getComputedStyle(node).overflowY==="hidden"||getComputedStyle(node).overflow==="hidden")&&node.scrollHeight>node.clientHeight+1)).map(node=>node.textContent.trim().slice(0,40));
 const decorations=[...content.querySelectorAll(".adventure-scene-decor,.adventure-panel-scene,.adventure-road-layer,.adventure-landmark,.adventure-map-depth,.adventure-boss-landscape,.adventure-map-fog,.adventure-home-gate")];
 const badPointer=decorations.filter(node=>getComputedStyle(node).pointerEvents!=="none").map(node=>String(node.className&&node.className.baseVal||node.className||node.tagName));
 const rr=root&&root.getBoundingClientRect();const result={name,rootOutside:rr?outside(rr):true,badButtons:rects.filter(x=>outside(x.r)).map(x=>x.node.textContent.trim().slice(0,24)),overlaps,clipped,badPointer,docOverflow:document.documentElement.scrollWidth>innerWidth+1||document.documentElement.scrollHeight>innerHeight+1};
 if(name==="map"){
  const view=content.querySelector(".adventure-view"),sheet=content.querySelector(".adventure-node-sheet"),map=content.querySelector(".adventure-map-canvas"),header=content.querySelector(".adventure-header");
  const scrollOwners=[...content.querySelectorAll("*")].filter(node=>{const style=getComputedStyle(node);return (style.overflowY==="auto"||style.overflowY==="scroll")&&node.scrollHeight>node.clientHeight+1;});
  if(view&&map){const viewRect=view.getBoundingClientRect(),nodes=[...map.querySelectorAll(".adventure-node")];const unreachable=[];for(const node of nodes){view.scrollTop=Math.max(0,Math.min(view.scrollHeight-view.clientHeight,node.offsetTop+node.offsetHeight/2-view.clientHeight/2));const rect=node.getBoundingClientRect();if(rect.top<viewRect.top-1||rect.bottom>viewRect.bottom+1){unreachable.push(node.dataset.nodeId||node.textContent.trim());}}view.scrollTop=view.scrollHeight;const sheetRect=sheet?.getBoundingClientRect();result.mapScroll={scrollOwnerCount:scrollOwners.length,viewIsScrollOwner:scrollOwners.includes(view),reachedEnd:Math.abs(view.scrollTop-(view.scrollHeight-view.clientHeight))<=1,sheetFullyVisible:!!sheetRect&&sheetRect.top>=viewRect.top-1&&sheetRect.bottom<=viewRect.bottom+1,unreachable};view.scrollTop=0;}
  if(map){const mr=map.getBoundingClientRect();result.mapAspect=mr.width/mr.height;result.composition={};for(const id of ["n03_fork","n04a_path","n04b_gate","n05_commission","hidden_merchant","n09_boss"]){const el=content.querySelector('[data-node-id="'+id+'"]');if(el)result.composition[id]=normPoint(el,map);}result.headerShare=header?header.getBoundingClientRect().height/root.getBoundingClientRect().height:1;}
 }
 if(name==="tracker"){const t=content.querySelector("#adventureObjectiveTracker")?.getBoundingClientRect(),p=content.querySelector("#mockPlayer")?.getBoundingClientRect(),c=content.querySelector("#mockControl")?.getBoundingClientRect();result.trackerOverlapPlayer=t&&p?overlap(t,p):999;result.trackerOverlapControl=t&&c?overlap(t,c):999;}
 return result;
}
function run(){
 const scale=Math.min(innerWidth/1080,innerHeight/1920);document.getElementById("game-stage").style.transform="translate(-50%,-50%) scale("+scale+")";
 const results=Object.entries(scenarios).map(([name,html])=>measure(name,html));
 document.getElementById("game-content").innerHTML=scenarios.map;void document.body.offsetHeight;
 const reduced=matchMedia("(prefers-reduced-motion: reduce)").matches;const reducedAnimation=getComputedStyle(document.querySelector(".adventure-map-fog")).animationName;
 document.getElementById("qa-result").textContent="QA_JSON:"+JSON.stringify({viewport:[innerWidth,innerHeight],errors,results,reduced,reducedAnimation});
}
run();
</script></body></html>`;
}

async function runChromeViewport(chrome,width,height,reduced){
    const profile=fs.mkdtempSync(path.join(os.tmpdir(),"adventure-browser-qa-"));
    let stderr="";
    const devtoolsPort=await reservePort();
    const proc=spawn(chrome,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--force-device-scale-factor=1","--remote-debugging-address=127.0.0.1",`--remote-debugging-port=${devtoolsPort}`,`--user-data-dir=${profile}`,"about:blank"],{cwd:ROOT,stdio:["ignore","ignore","pipe"]});
    proc.stderr.setEncoding("utf8");proc.stderr.on("data",chunk=>{ stderr+=chunk; });
    let cdp=null;
    try{
        let pages=[];
        for(let attempt=0;attempt<200;attempt++){
            if(proc.exitCode!==null){ break; }
            try{pages=await fetch(`http://127.0.0.1:${devtoolsPort}/json/list`).then(response=>response.json());if(pages.some(page=>page.type==="page")){ break; }}catch(_){ }
            await sleep(50);
        }
        const page=pages.find(candidate=>candidate.type==="page");
        assert.ok(page?.webSocketDebuggerUrl,`Chrome DevTools page target unavailable at ${width}x${height}: ${stderr}`);
        cdp=openCdp(page.webSocketDebuggerUrl);await cdp.ready;await cdp.send("Page.enable");await cdp.send("Runtime.enable");
        await cdp.send("Emulation.setDeviceMetricsOverride",{width,height,deviceScaleFactor:1,mobile:true,screenWidth:width,screenHeight:height,positionX:0,positionY:0,screenOrientation:{type:"portraitPrimary",angle:0}});
        await cdp.send("Emulation.setTouchEmulationEnabled",{enabled:true,maxTouchPoints:5});
        await cdp.send("Emulation.setEmulatedMedia",{features:[{name:"prefers-reduced-motion",value:reduced?"reduce":"no-preference"}]});
        const frameTree=await cdp.send("Page.getFrameTree");
        await cdp.send("Page.setDocumentContent",{frameId:frameTree.frameTree.frame.id,html:fixtureHtml()});
        let qaText="";
        for(let attempt=0;attempt<100;attempt++){
            const evaluation=await cdp.send("Runtime.evaluate",{expression:'document.getElementById("qa-result")?.textContent||""',returnByValue:true});
            qaText=evaluation.result?.value||"";if(qaText.startsWith("QA_JSON:")){ break; }await sleep(50);
        }
        assert.match(qaText,/^QA_JSON:/,`missing QA metrics at ${width}x${height}`);
        if(!reduced){
            const shot=await cdp.send("Page.captureScreenshot",{format:"png",fromSurface:true,captureBeyondViewport:false});
            fs.writeFileSync(path.join(ARTIFACT_DIR,`adventure-map-${width}x${height}.png`),Buffer.from(shot.data,"base64"));
        }
        return JSON.parse(qaText.slice("QA_JSON:".length));
    }finally{
        try{ cdp?.close(); }catch(_){ }
        if(proc.exitCode===null){ proc.kill("SIGKILL"); }
        if(proc.exitCode===null){ await new Promise(resolve=>proc.once("exit",resolve)); }
        for(let attempt=0;attempt<5;attempt++){try{fs.rmSync(profile,{recursive:true,force:true});break;}catch(_){await sleep(50);}}
    }
}

const chrome=findChrome();fs.mkdirSync(ARTIFACT_DIR,{recursive:true});const evidence=[];const compositionByViewport=[];
for(const [width,height] of VIEWPORTS){
    for(const reduced of [false,...(width===393&&height===873?[true]:[])]){
        const data=await runChromeViewport(chrome,width,height,reduced);
        assert.deepEqual(data.viewport,[width,height],`Chrome CSS viewport must exactly match ${width}x${height}`);
        assert.deepEqual(data.errors,[],`console/runtime errors at ${width}x${height}`);
        for(const result of data.results){
            assert.equal(result.rootOutside,false,`${result.name}: root outside viewport at ${width}x${height}`);
            if(result.name!=="map"){ assert.deepEqual(result.badButtons,[],`${result.name}: buttons outside viewport at ${width}x${height}`); }
            assert.deepEqual(result.clipped,[],`${result.name}: readable text clips at ${width}x${height}`);
            assert.deepEqual(result.badPointer,[],`${result.name}: decorative layer captures pointer events at ${width}x${height}`);
            assert.equal(result.docOverflow,false,`${result.name}: document overflow at ${width}x${height}`);
            if(result.name!=="map"){ assert.deepEqual(result.overlaps,[],`${result.name}: buttons overlap at ${width}x${height}`); }
            if(result.name==="map"){
                assert.equal(result.mapScroll?.scrollOwnerCount,1,`map: must keep exactly one vertical scroll owner at ${width}x${height}`);
                assert.equal(result.mapScroll?.viewIsScrollOwner,true,`map: adventure-view must own vertical scrolling at ${width}x${height}`);
                assert.equal(result.mapScroll?.reachedEnd,true,`map: adventure-view must reach its final scroll position at ${width}x${height}`);
                assert.equal(result.mapScroll?.sheetFullyVisible,true,`map: node detail sheet must remain usable after scrolling at ${width}x${height}`);
                assert.deepEqual(result.mapScroll?.unreachable,[],`map: every chapter node must become reachable by the canonical map scroll at ${width}x${height}`);
                assert.ok(result.mapAspect<=9/16+.01,`map: scrollable chapter canvas must retain portrait composition at ${width}x${height}`);
                assert.ok(result.headerShare<.14,`map: header consumes too much map area at ${width}x${height}`);
                const c=result.composition;
                assert.ok(c.n04a_path.x<c.n03_fork.x&&c.n03_fork.x<c.n04b_gate.x,`map: fork must remain visibly left/right at ${width}x${height}`);
                assert.ok(c.n04a_path.y<c.n03_fork.y&&c.n04b_gate.y<c.n03_fork.y&&c.n05_commission.y<c.n04a_path.y,`map: fork branches must rejoin forward at ${width}x${height}`);
                assert.ok(c.hidden_merchant.x>c.n05_commission.x+.2,`map: hidden merchant must stay off the main road at ${width}x${height}`);
                assert.ok(c.n09_boss.y<c.n05_commission.y,`map: boss must remain beyond the current route at ${width}x${height}`);
                if(!reduced){ compositionByViewport.push({viewport:[width,height],composition:c}); }
            }
            if(result.name==="tracker"){
                assert.equal(result.trackerOverlapPlayer,0,`objective HUD overlaps player at ${width}x${height}`);
                assert.equal(result.trackerOverlapControl,0,`objective HUD overlaps control at ${width}x${height}`);
            }
        }
        if(reduced){assert.equal(data.reduced,true,"Chrome reduced-motion emulation must be active");assert.equal(data.reducedAnimation,"none","Adventure fog animation must stop under reduced motion");}
        evidence.push(data);
    }
}
const baseline=compositionByViewport[0]?.composition||{};
for(const entry of compositionByViewport.slice(1)){
    for(const id of Object.keys(baseline)){
        assert.ok(Math.abs(entry.composition[id].x-baseline[id].x)<.015&&Math.abs(entry.composition[id].y-baseline[id].y)<.015,`map: ${id} composition drifted across viewport sizes`);
    }
}
fs.writeFileSync(path.join(ARTIFACT_DIR,"adventure-node-system-v1.json"),JSON.stringify({generatedAt:new Date().toISOString(),screenshots:VIEWPORTS.map(([w,h])=>`adventure-map-${w}x${h}.png`),evidence},null,2)+"\n");
console.log("✓ Adventure browser QA passed at exact 360x800, 393x873 and 412x915 viewports with scroll-reachable chapter nodes and stable portrait composition screenshots");

async function runProductionAdventureBalanceQa(){
    const baseUrl=process.env.ADVENTURE_BALANCE_BASE_URL;
    if(baseUrl){
        const manifest=await fetch(new URL('release-manifest.json',baseUrl+'/')).then(r=>r.json());
        assert.equal(manifest.commitSha,process.env.EXPECTED_COMMIT_SHA,'deployed Adventure exact SHA');
    }
    const reference=fs.readFileSync('tests/fixtures/wild-balance-reference-party.js','utf8');
    const expression=`(async()=>{
      const check=(v,m)=>{if(!v)throw Error(m);};
      const wait=async(fn,ms=30000)=>{const end=performance.now()+ms;while(!fn()&&performance.now()<end)await new Promise(r=>setTimeout(r,40));check(fn(),'Adventure wait: '+fn);};
      await wait(()=>window.FourSymbolsStartupPolicy?.getState?.()==='READY'&&document.getElementById('startupLoader')?.hidden===true&&!document.getElementById('firebaseAuthOverlay')?.classList.contains('show'));
      await FourSymbolsFeatures.ensure('gameplay-core','adventure-balance-qa');
      await wait(()=>FourSymbolsReleaseUpdate?.getState?.().availableReleaseVersion);closeHomeFeature();
      document.getElementById('adventureHomeEntry').click();await wait(()=>window.FourSymbolsAdventure&&document.getElementById('adventurePage')?.classList.contains('is-visible'));
      const api=FourSymbolsAdventure,content=FourSymbolsAdventureContent;
      const evidence=window.adventureBalanceQaEvidence={scenes:[],skills:[],controls:[],portraitGaps:[],decodedPortraits:[]};
      const oldRandom=Math.random,badge=showMonsterSkillNameBadge,statusRoll=rollStatusEffectHit;
      showMonsterSkillNameBadge=function(name,...args){evidence.skills.push({name,round:turn});return badge(name,...args);};
      rollStatusEffectHit=function(...args){const hit=statusRoll(...args);if(args[5]){const chance=calculateStatusEffectChance(...args),cap=args[6]==='regular'?90:args[6]==='elite'?75:60;check(chance<=cap,'actual hard control cap');evidence.controls.push({chance,rank:args[6],hit});}return hit;};
      const stats=m=>[m.maxHP,m.maxSP,m.attack,m.magicAttack,m.defense,m.agility,m.rank,m.level,m.element];
      const verify=m=>{const p=MonsterBalance.debug(m);check(m.balanceOwner==='MonsterBalance'&&m.mode==='adventure','owner');check(!m.v132Dungeon&&!m.v141ExtraHP,'no legacy marker');check(JSON.stringify(stats(m).slice(0,6))===JSON.stringify([p.final.maxHP,p.final.maxSP,p.final.physicalAttack,p.final.magicAttack,p.final.defense,p.final.speed]),'all final stats match projection');check(getEnemyPressureMultiplier(m,player)===p.finalDamagePressure,'pressure once');check(p.base.abilityPointBudget===(m.level-1)*5,'budget');};
      try{
        const nodes=content.chapters.chapter_v1.nodes.filter(n=>n.encounterId);
        check(nodes.length===3,'all formal encounters');
        for(const [sceneIndex,node] of [...nodes,nodes[0]].entries()){
          const replay=sceneIndex===3,level=replay?8:node.suggestedLevel;
          const ref=prepareWildBalanceReferenceParty(level,replay?2:1);v131GrantElementBoxHours(8,32);
          let seed=9000+sceneIndex;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
          autoBattle=false;autoPatrolEnabled=false;for(const cfg of [autoConfig,autoConfig2,autoConfig3]){cfg.enabled=false;cfg.skill=ref.skill;cfg.hp=0;cfg.sp=0;}
          const state=player.adventureProgress.chapters.chapter_v1;state.currentNodeId=node.id;state.branchSelections.fork_1='bold';
          if(!replay){delete state.completedNodes[node.id];delete state.rewardClaims[node.id];}
          api.open();api.selectNode(node.id);const activate=document.querySelector('.adventure-node-sheet .adventure-button.primary');check(activate,'formal encounter action');activate.click();
          await wait(()=>battleActive&&window.v132ActiveDungeonRun?.mode==='adventure');
          await wait(()=>!document.getElementById('battlePage')?.matches('.v141-preparing-entry,.v141-entry-moving'));
          check(!document.getElementById('homeFeatureModal')?.classList.contains('show'),'no blocking modal');
          const roster=monsters.slice(),ids=currentBattleMonsters.slice(),initial=roster.map(stats),beforeParty=getExistingPartyIndexes().map(i=>getPartyCharacterByIndex(i).hp);
          check(roster.length===3,'formal count');roster.forEach(verify);renderBattle();roster.forEach(verify);
          const snapshot=FourSymbolsBattlefieldSlots.getActiveEnemySnapshot(),slots=ids.map(i=>FourSymbolsBattlefieldSlots.getEnemySlotForMonster(snapshot,i));
          check(new Set(slots).size===3,'fixed unique slots');
          const shapes={};for(const shape of ['single','row','tri','all']){shapes[shape]=FourSymbolsBattlefieldSlots.resolveEnemyTargets(snapshot,ids[0],shape,i=>monsters[i]?.alive);check(shapes[shape].length>0&&shapes[shape].every(i=>ids.includes(i)),'targeting '+shape);}
          for(const i of ids){
            const m=roster[i],spec=content.encounters[node.encounterId].enemies[i];
            check(m.name===spec.name&&m.element===spec.element&&m.rank===spec.rank&&m.level===spec.level&&m.monsterKey===spec.monsterKey,'content identity');
            check(m.vAdventureEncounterId===node.encounterId&&m.context==='adventure/chapter_v1/'+node.encounterId,'encounter metadata');
            const card=document.getElementById('battleMonster'+i),art=card?.querySelector('.v174-battle-art');
            check(card?.dataset.slot===slots[i]&&art,'actual slot and artwork');
            check(card.querySelector('.monster-hp-inner')&&card.querySelector('.monster-sp-inner'),'HP/SP UI');
            const portrait=v154ResolveMonsterPortraitRecord(m);
            if(portrait.generic){
              evidence.portraitGaps.push({name:m.name,portrait});
              check(portrait.requestedPortraitKey===m.monsterKey&&portrait.fallbackReason==='planned','registered planned identity');
              check(art.classList.contains('v174-generic-portrait')&&getComputedStyle(art).backgroundImage==='none','visible neutral fallback without wrong monster image');
              check(getComputedStyle(art,'::before').content.includes('◇'),'generic fallback rendered');
            }else{
              const url=getComputedStyle(art).backgroundImage.split('url(')[1]?.split(')')[0].replaceAll('"','').replaceAll("'",'');check(url,'visible portrait URL');
              const image=new Image();image.src=url;await image.decode();check(image.naturalWidth>0,'portrait decode');evidence.decodedPortraits.push({name:m.name,url,width:image.naturalWidth,height:image.naturalHeight});
            }
          }
          window.adventureBalanceQaCapture=node.encounterId+'-'+sceneIndex;
          let maxTurn=1;const events=[],castSkills=[];
          const off=FourSymbolsBattleFlow.subscribeBeforeCombatant(e=>{
            roster.forEach(verify);maxTurn=Math.max(maxTurn,turn);const actor=e.queue[e.index];events.push({turn,type:actor?.type,index:actor?.monsterIndex??actor?.characterIndex});
            check(JSON.stringify(ids.map(i=>FourSymbolsBattlefieldSlots.getEnemySlotForMonster(FourSymbolsBattlefieldSlots.getActiveEnemySnapshot(),i)))===JSON.stringify(slots),'no death reorder');
          });
          try{
            if(sceneIndex!==0){toggleAutoBattle();check(autoBattle,'formal auto input');await wait(()=>!battleActive,240000);}
            else while(battleActive){
              await wait(()=>!battleActive||(battlePhase==='declare'&&battlePresentationLocks.size===0),120000);if(!battleActive)break;
              const beforeTurn=turn;
              while(battleActive&&battlePhase==='declare'){
                await wait(()=>!battleActive||battlePhase!=='declare'||(!battleAdvanceScheduled&&battlePresentationLocks.size===0&&declaredCharacterIndexes.has(activeBattleCharacterIndex)));
                if(!battleActive||battlePhase!=='declare')break;
                const action=chooseWildBalanceReferenceAction(activeBattleCharacterIndex,ref.skill);toggleSkillQuickBar();const button=document.querySelector('.skill-quick-button[data-skill-id="'+ref.skill+'"]');check(button&&!button.disabled,'legal player skill');button.click();check(actionReady&&pendingAction===ref.skill,'skill input');document.getElementById('battleMonster'+(action.target??ids.find(i=>monsters[i].alive))).click();castSkills.push(ref.skill);
              }
              await wait(()=>!battleActive||turn>beforeTurn,120000);
            }
          }finally{off();}
          autoBattle=false;autoConfig.enabled=false;check(document.getElementById('battleStatisticsResultModal')?.hidden!==false,'Adventure has no challenge result modal');
          await wait(()=>!window.v132ActiveDungeonRun&&api.getView().visible);check(!battleActive,'no background battle');roster.forEach(verify);check(JSON.stringify(roster.map(stats))===JSON.stringify(initial),'no late stat writer');
          const survivors=getExistingPartyIndexes().filter(i=>getPartyCharacterByIndex(i).hp>0).length;check(survivors>0,'natural survivors');
          const actualState=player.adventureProgress.chapters.chapter_v1;check(actualState.completedNodes[node.id],'completed node');
          const beforeGold=gold,beforeExp=sharedExp,reward=content.rewards[node.rewardId];
          if(!replay){check(actualState.rewardClaims[node.id]==='ready','reward ready');check(api.claimNodeReward(node.id),'formal claim');check(gold-beforeGold===(reward.gold||0)&&sharedExp-beforeExp===(reward.sharedExp||0),'reward values unchanged');check(!api.claimNodeReward(node.id),'single claim ledger');}
          else{check(actualState.rewardClaims[node.id]==='claimed'&&!api.claimNodeReward(node.id),'replay never double grants');}
          const uid=FourSymbolsAccountSave.getActiveUid(),saved=FourSymbolsAccountSave.readForUid(uid);check(saved.status==='ready'&&saved.save.player.adventureProgress.chapters.chapter_v1.rewardClaims[node.id]==='claimed','persisted progression');
          api.closeToCity();check(!battleActive&&!window.v132ActiveDungeonRun,'return cleanup');document.getElementById('adventureHomeEntry').click();await wait(()=>api.getView().visible);check(api.getChapterState().rewardClaims[node.id]==='claimed','re-entry progression');
          evidence.scenes.push({encounterId:node.encounterId,level,replay,initial,slots,shapes,beforeParty,afterParty:getExistingPartyIndexes().map(i=>getPartyCharacterByIndex(i).hp),rounds:maxTurn,survivors,castSkills,events,rewardGold:gold-beforeGold,rewardExp:sharedExp-beforeExp,saveProgression:true});
        }
        for(const rank of ['regular','elite','boss','smallBoss','player']){const cap=rank==='regular'?90:rank==='elite'?75:60;check(calculateStatusEffectChance(999,100,100,0,0,true,rank==='smallBoss'?getMonsterRank({rank}):rank,0)===cap,'hard cap '+rank);}
        check(evidence.skills.some(skill=>skill.name!=='普通攻擊'),'actual Enemy AI carried skill execution');return evidence;
      }finally{Math.random=oldRandom;showMonsterSkillNameBadge=badge;rollStatusEffectHit=statusRoll;autoBattle=false;autoConfig.enabled=false;}
    })()`;
    const server=await startServer({baseUrl});const file=path.join(process.cwd(),'artifacts/browser-qa/adventure-balance.json');fs.mkdirSync(path.dirname(file),{recursive:true});const results=[];let client,proc,profile;
    const close=()=>{client?.close();client=null;proc?.kill('SIGTERM');proc=null;if(profile){try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:3,retryDelay:100});}catch{}profile=null;}};
    try{
        for(const [width,height] of [[390,844],[412,915]]){
            profile=fs.mkdtempSync(path.join(os.tmpdir(),'adventure-balance-'));const port=9750+Math.floor(Math.random()*100);
            const chrome=productionChrome();let launchError='';
            proc=spawn(chrome,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--remote-debugging-port='+port,'--user-data-dir='+profile,'about:blank'],{stdio:['ignore','ignore','pipe']});
            proc.stderr.on('data',chunk=>{launchError=(launchError+chunk).slice(-4000);});
            proc.on('error',error=>{launchError=String(error);});
            const tabs=await waitJson('http://127.0.0.1:'+port+'/json/list').catch(error=>{throw new Error('Adventure Chrome startup failed: '+chrome+' exit='+proc.exitCode+' '+launchError,{cause:error});});client=new Cdp(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await client.send('Page.enable');await client.send('Runtime.enable');await client.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});await client.send('Page.navigate',{url:server.url});await new Promise(r=>setTimeout(r,1000));
            const active=client.eval(reference+'\n'+expression);let done=false;active.finally(()=>{done=true;}).catch(()=>{});const captured=new Set();
            while(!done){await new Promise(r=>setTimeout(r,250));const marker=await client.eval('window.adventureBalanceQaCapture||null').catch(()=>null);if(marker&&!captured.has(marker)){captured.add(marker);const shot=await client.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(file.replace('.json','-'+width+'x'+height+'-'+marker+'.png'),Buffer.from(shot.data,'base64'));}}
            const evidence=await active;assert.equal(evidence.scenes.length,4);assert.equal(client.events.some(e=>e.method==='Runtime.consoleAPICalled'&&e.params.type==='error'&&JSON.stringify(e.params.args).includes('戰鬥行動超過安全期限')),false,'no watchdog recovery');results.push({width,height,...evidence});close();
        }
        fs.writeFileSync(file,JSON.stringify({passed:true,commitSha:process.env.EXPECTED_COMMIT_SHA||process.env.GITHUB_SHA||'local',results},null,2)+'\n');console.log('Adventure production Chrome: eight natural scenes, both mobile viewports, owner/reward/progression PASS');
    }catch(error){const partial=await client?.eval('({evidence:window.adventureBalanceQaEvidence,phase:battlePhase,turn,battleActive,run:window.v132ActiveDungeonRun,modals:[...document.querySelectorAll(".show")].map(x=>x.id)})').catch(()=>null);fs.writeFileSync(file,JSON.stringify({passed:false,error:String(error.stack||error),results,partial,console:client?.events.filter(e=>e.method==='Runtime.consoleAPICalled').slice(-12)},null,2)+'\n');throw error;}
    finally{close();await new Promise(r=>server.server.close(r));}
}
