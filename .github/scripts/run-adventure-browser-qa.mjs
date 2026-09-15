import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import {spawn,spawnSync} from "node:child_process";

const ROOT=process.cwd();
const ARTIFACT_DIR=path.join(ROOT,"artifacts/browser-qa");
const VIEWPORTS=[[360,800],[390,844],[412,915]];

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
const node=(id,type,status,x,y,title,sub)=>{
    const glyph={event:"人",battle:"戰",branch:"岔",elite:"精",objective:"令",rest:"休",chest:"箱",boss:"首",finish:"旗",hidden:"？"}[type]||"路";
    return `<button data-node-id="${id}" class="adventure-node type-${type} status-${status}" style="--node-x:${x}%;--node-y:${y}%"><span class="adventure-node-icon">${glyph}</span><span class="adventure-node-copy"><strong>${title}</strong><small>${sub}</small></span></button>`;
};
const mapScene='<div class="adventure-map-depth adventure-map-far"></div><div class="adventure-map-depth adventure-map-mid"></div><div class="adventure-boss-landscape"></div>'+mapRoad+
    node("n01_arrival","event","completed",18,84,"山前驛","旅人求助")+
    node("n02_roadfight","battle","completed",33,75,"山道伏影","普通戰")+
    node("n03_fork","branch","current",49,66,"岔路口","選擇路線")+
    node("n04a_path","event","available",31,56,"林間小徑","旅人事件")+
    node("n04b_gate","elite","available",67,56,"山寨正門","精英戰")+
    node("n05_commission","objective","locked",50,46,"村民委託","前往野怪區")+
    node("hidden_merchant","hidden","hidden-available",79,41,"未知之處","靠近查看")+
    node("n06_rest","rest","locked",30,36,"落雁驛","休息")+
    node("n07_chest","chest","locked",51,29,"舊驛箱","一次性寶箱")+
    node("n08_truth","event","locked",70,22,"寨下石橋","發現真相")+
    node("n09_boss","boss","locked",55,13,"黑松寨主","Boss")+
    node("n10_finish","finish","locked",34,7,"章節終點","山路重開")+
    '<div class="adventure-landmark landmark-village"><i></i><span>村落</span></div><div class="adventure-landmark landmark-bridge"><i></i><span>石橋</span></div><div class="adventure-landmark landmark-fort"><i></i><span>山寨</span></div><div class="adventure-map-fog"></div><div class="adventure-map-depth adventure-map-near"></div>';

const scenarios={
    home:`<div id="homePage" style="position:relative;width:100%;height:100%;background:#17140f"><div id="adventureHomeAxis" class="adventure-home-axis"><span class="adventure-home-gate" aria-hidden="true"></span><button id="adventureHomeEntry" class="adventure-home-entry"><span class="adventure-home-kicker">江湖主線 · 章節推進</span><strong>出城冒險</strong><span class="adventure-home-notice"></span></button></div></div>`,
    map:`<section id="adventurePage" class="adventure-page"><div class="adventure-scene-decor"><span class="adventure-world-bg"></span><span class="adventure-world-far"></span><span class="adventure-world-mid"></span><span class="adventure-world-near"></span><span class="adventure-mist mist-a"></span></div><header class="adventure-header"><button class="adventure-back-button">返回主城</button><div class="adventure-heading"><span>出城冒險</span><strong>山關初行</strong></div><div class="adventure-header-meta"><span>建議 Lv.10</span><span>主線章節</span></div></header><div class="adventure-view"><section class="adventure-map-screen"><div class="adventure-map-caption"><span>第一章 · 山關初行</span><b>建議 Lv.10</b></div><div class="adventure-map-canvas">${mapScene}</div><footer class="adventure-map-footer"><span>首次岔路：尚未選擇</span><span>主線推不動時，可先回野怪區養成，再回來看看下一節。</span></footer></section></div></section>`,
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
 const readable=[...content.querySelectorAll(".adventure-panel-title h2,.adventure-panel-card p,.adventure-dialogue,.adventure-route-choice p,.adventure-map-footer span")];
 const clipped=readable.filter(node=>node.scrollWidth>node.clientWidth+1||((getComputedStyle(node).overflowY==="hidden"||getComputedStyle(node).overflow==="hidden")&&node.scrollHeight>node.clientHeight+1)).map(node=>node.textContent.trim().slice(0,40));
 const decorations=[...content.querySelectorAll(".adventure-scene-decor,.adventure-panel-scene,.adventure-road-layer,.adventure-landmark,.adventure-map-depth,.adventure-boss-landscape,.adventure-map-fog,.adventure-home-gate")];
 const badPointer=decorations.filter(node=>getComputedStyle(node).pointerEvents!=="none").map(node=>String(node.className&&node.className.baseVal||node.className||node.tagName));
 const rr=root&&root.getBoundingClientRect();const result={name,rootOutside:rr?outside(rr):true,badButtons:rects.filter(x=>outside(x.r)).map(x=>x.node.textContent.trim().slice(0,24)),overlaps,clipped,badPointer,docOverflow:document.documentElement.scrollWidth>innerWidth+1||document.documentElement.scrollHeight>innerHeight+1};
 if(name==="map"){
  const view=content.querySelector(".adventure-view"),footer=content.querySelector(".adventure-map-footer"),map=content.querySelector(".adventure-map-canvas"),header=content.querySelector(".adventure-header");
  const scrollOwners=[...content.querySelectorAll("*")].filter(node=>{const style=getComputedStyle(node);return (style.overflowY==="auto"||style.overflowY==="scroll")&&node.scrollHeight>node.clientHeight+1;});
  if(view&&footer){view.scrollTop=view.scrollHeight;const viewRect=view.getBoundingClientRect(),footerRect=footer.getBoundingClientRect();result.mapFooter={scrollOwnerCount:scrollOwners.length,viewIsScrollOwner:scrollOwners.includes(view),reachedEnd:Math.abs(view.scrollTop-(view.scrollHeight-view.clientHeight))<=1,fullyVisible:footerRect.top>=viewRect.top-1&&footerRect.bottom<=viewRect.bottom+1};view.scrollTop=0;}
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
    for(const reduced of [false,...(width===390&&height===844?[true]:[])]){
        const data=await runChromeViewport(chrome,width,height,reduced);
        assert.deepEqual(data.viewport,[width,height],`Chrome CSS viewport must exactly match ${width}x${height}`);
        assert.deepEqual(data.errors,[],`console/runtime errors at ${width}x${height}`);
        for(const result of data.results){
            assert.equal(result.rootOutside,false,`${result.name}: root outside viewport at ${width}x${height}`);
            assert.deepEqual(result.badButtons,[],`${result.name}: buttons outside viewport at ${width}x${height}`);
            assert.deepEqual(result.clipped,[],`${result.name}: readable text clips at ${width}x${height}`);
            assert.deepEqual(result.badPointer,[],`${result.name}: decorative layer captures pointer events at ${width}x${height}`);
            assert.equal(result.docOverflow,false,`${result.name}: document overflow at ${width}x${height}`);
            if(result.name!=="map"){ assert.deepEqual(result.overlaps,[],`${result.name}: buttons overlap at ${width}x${height}`); }
            if(result.name==="map"){
                assert.equal(result.mapFooter?.scrollOwnerCount,1,`map: must keep exactly one vertical scroll owner at ${width}x${height}`);
                assert.equal(result.mapFooter?.viewIsScrollOwner,true,`map: adventure-view must own vertical scrolling at ${width}x${height}`);
                assert.equal(result.mapFooter?.reachedEnd,true,`map: adventure-view must reach its final scroll position at ${width}x${height}`);
                assert.equal(result.mapFooter?.fullyVisible,true,`map: footer must be fully visible after scrolling at ${width}x${height}`);
                assert.ok(Math.abs(result.mapAspect-9/16)<.01,`map: 9:16 composition ratio drifted at ${width}x${height}`);
                assert.ok(result.headerShare<.14,`map: header consumes too much map area at ${width}x${height}`);
                const c=result.composition;
                assert.ok(c.n04a_path.x<c.n03_fork.x&&c.n03_fork.x<c.n04b_gate.x,`map: fork must remain visibly left/right at ${width}x${height}`);
                assert.ok(c.n04a_path.y<c.n03_fork.y&&c.n04b_gate.y<c.n03_fork.y&&c.n05_commission.y<c.n04a_path.y,`map: fork branches must rejoin forward at ${width}x${height}`);
                assert.ok(c.hidden_merchant.x>c.n05_commission.x+.2,`map: hidden merchant must stay off the main road at ${width}x${height}`);
                assert.ok(c.n09_boss.y<.2,`map: boss must stay in the chapter climax area at ${width}x${height}`);
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
console.log("✓ Adventure browser QA passed at exact 360x800, 390x844 and 412x915 viewports with stable 9:16 composition screenshots");
