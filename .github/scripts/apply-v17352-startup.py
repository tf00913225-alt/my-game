from pathlib import Path

repo = Path('.')

startup = r'''/* =====================================================
   V173.52 — 真實模組進度開場動畫 owner
   - 進度 0~90% 直接來自實際 runtime 模組 load 事件
   - runtime 全部 ready 後，最後 10% 只負責完成既有 12~15 秒開場節奏
   - 可進入時間 = max(真實模組完成時間, 12~15 秒開場時間)
   - 任一必要模組失敗時停在錯誤狀態，不會假裝 100%
===================================================== */
(function installStartupLoader(){
    "use strict";

    const MIN_DURATION_MS=12000;
    const MAX_DURATION_MS=15000;
    const DEFAULT_RUNTIME_TOTAL=32;
    const root=document.getElementById("startupLoader");
    if(!root || root.dataset.ownerReady==="1"){ return; }

    const logoScene=document.getElementById("startupLogoScene");
    const cityScene=document.getElementById("startupCityScene");
    const statusTitle=document.getElementById("startupStatusTitle");
    const statusDetail=document.getElementById("startupStatusDetail");
    const percent=document.getElementById("startupPercent");
    const progress=document.getElementById("startupProgress");
    const progressFill=document.getElementById("startupProgressFill");
    const prompt=document.getElementById("startupEnterPrompt");

    if(!logoScene || !cityScene || !statusTitle || !statusDetail ||
       !percent || !progress || !progressFill || !prompt){
        root.hidden=true;
        return;
    }

    const randomBetween=(minimum,maximum)=>minimum+Math.random()*(maximum-minimum);
    const totalDuration=Math.round(randomBetween(MIN_DURATION_MS,MAX_DURATION_MS));
    const citySwitchRatio=randomBetween(.36,.43);
    const citySwitchAt=Math.round(totalDuration*citySwitchRatio);
    const startedAt=(window.performance&&typeof window.performance.now==="function")
        ?window.performance.now():Date.now();

    let runtimeLoaded=0;
    let runtimeTotal=DEFAULT_RUNTIME_TOTAL;
    let runtimeReady=false;
    let runtimeFailed=false;
    let failureMessage="";
    let currentProgress=0;
    let completed=false;
    let entered=false;
    let cityShown=false;

    root.dataset.ownerReady="1";
    root.dataset.totalDuration=String(totalDuration);
    root.dataset.progressMode="runtime";
    root.hidden=false;
    prompt.hidden=true;

    function now(){
        return (window.performance&&typeof window.performance.now==="function")
            ?window.performance.now():Date.now();
    }

    function stageCopy(){
        if(runtimeFailed){
            return {title:"載入失敗",detail:failureMessage||"必要遊戲模組載入失敗，請重新整理。"};
        }
        if(runtimeReady){
            return {title:"完成最後檢查",detail:"遊戲模組已全部就緒，正在完成開場準備"};
        }
        const loaded=Math.max(0,Math.min(runtimeTotal,runtimeLoaded));
        let title="載入核心系統";
        if(loaded>=6){ title="載入戰鬥模組"; }
        if(loaded>=14){ title="載入副本與介面"; }
        if(loaded>=22){ title="載入商店與角色"; }
        if(loaded>=26){ title="載入裝備系統"; }
        if(loaded>=27){ title="載入背包系統"; }
        if(loaded>=28){ title="載入功能模組"; }
        return {title,detail:"已載入 "+loaded+" / "+runtimeTotal+" 個遊戲模組"};
    }

    function renderProgress(value){
        const safe=Math.max(0,Math.min(100,Math.round(value)));
        currentProgress=Math.max(currentProgress,safe);
        progressFill.style.width=currentProgress+"%";
        percent.textContent=currentProgress+"%";
        progress.setAttribute("aria-valuenow",String(currentProgress));
        const copy=stageCopy();
        statusTitle.textContent=copy.title;
        statusDetail.textContent=copy.detail;
    }

    function showMainCityScene(){
        if(cityShown){ return; }
        cityShown=true;
        logoScene.classList.remove("is-active");
        logoScene.setAttribute("aria-hidden","true");
        cityScene.classList.add("is-active");
        cityScene.setAttribute("aria-hidden","false");
        root.dataset.scene="city";
    }

    function calculatedProgress(){
        if(runtimeFailed){ return currentProgress; }
        const moduleRatio=runtimeTotal>0?Math.max(0,Math.min(1,runtimeLoaded/runtimeTotal)):0;
        const modulePercent=Math.floor(moduleRatio*90);
        if(!runtimeReady){ return modulePercent; }
        const elapsed=Math.max(0,now()-startedAt);
        const cinematicRatio=Math.max(0,Math.min(1,elapsed/totalDuration));
        return Math.max(modulePercent,90+Math.floor(cinematicRatio*10));
    }

    function completeLoading(){
        if(completed||runtimeFailed||!runtimeReady||now()-startedAt<totalDuration){ return false; }
        completed=true;
        showMainCityScene();
        renderProgress(100);
        statusTitle.textContent="載入完成";
        statusDetail.textContent="江湖已就緒，等待俠士進入";
        prompt.hidden=false;
        root.classList.add("is-ready");
        root.setAttribute("aria-label","載入完成，點擊空白處進入遊戲");
        root.setAttribute("tabindex","0");
        return true;
    }

    function tick(){
        if(completed||runtimeFailed){ return; }
        renderProgress(calculatedProgress());
        if(completeLoading()){ return; }
        window.setTimeout(tick,180);
    }

    function enterGame(event){
        if(!completed||entered){ return; }
        if(event&&event.type==="keydown"&&event.key!=="Enter"&&event.key!==" "){ return; }
        entered=true;
        root.classList.add("is-leaving");
        root.removeAttribute("tabindex");
        window.setTimeout(function(){
            root.hidden=true;
            document.dispatchEvent(new CustomEvent("v173.20:startup-entered"));
        },760);
    }

    function onRuntimeProgress(event){
        const detail=event&&event.detail||{};
        runtimeTotal=Math.max(1,Math.floor(Number(detail.total)||runtimeTotal||DEFAULT_RUNTIME_TOTAL));
        runtimeLoaded=Math.max(runtimeLoaded,Math.min(runtimeTotal,Math.floor(Number(detail.loaded)||0)));
        root.hidden=false;
        renderProgress(calculatedProgress());
    }

    function onRuntimeReady(event){
        const detail=event&&event.detail||{};
        runtimeTotal=Math.max(1,Math.floor(Number(detail.total)||runtimeTotal||DEFAULT_RUNTIME_TOTAL));
        runtimeLoaded=runtimeTotal;
        runtimeReady=true;
        root.hidden=false;
        renderProgress(calculatedProgress());
        completeLoading();
    }

    function onRuntimeFailed(event){
        runtimeFailed=true;
        failureMessage=String(event&&event.detail&&event.detail.message||"必要遊戲模組載入失敗，請重新整理。");
        root.hidden=false;
        root.classList.add("is-error");
        root.setAttribute("aria-label","遊戲模組載入失敗");
        renderProgress(currentProgress);
        statusTitle.textContent="載入失敗";
        statusDetail.textContent=failureMessage;
        prompt.hidden=true;
    }

    document.addEventListener("v173:runtime-progress",onRuntimeProgress);
    document.addEventListener("v173:runtime-ready",onRuntimeReady);
    document.addEventListener("v173:runtime-failed",onRuntimeFailed);
    document.addEventListener("v17347:runtime-ready",function(){
        if(!runtimeReady){ onRuntimeReady({detail:{loaded:runtimeTotal,total:runtimeTotal}}); }
    });

    root.addEventListener("pointerup",enterGame);
    root.addEventListener("click",enterGame);
    root.addEventListener("keydown",enterGame);
    window.setTimeout(showMainCityScene,citySwitchAt);
    window.setTimeout(tick,120);
    renderProgress(0);
})();
'''
Path('js/52-v173.20-startup-loader.js').write_text(startup, encoding='utf-8')

loader_path=Path('js/20-anonymous-20.js')
loader=loader_path.read_text(encoding='utf-8')
start=loader.index('/* =====================================================\n   V173.47 — CRITICAL RUNTIME READINESS GATE')
end=loader.index('/* =====================================================\n   ★★★ 資產快取版本號',start)
new_gate=r'''/* =====================================================
   V173.52 — CRITICAL RUNTIME READINESS GATE + REAL PROGRESS
   Gameplay remains blocked until the full late runtime stack is ready, but the
   separate black gate UI is gone. The existing cinematic startup layer owns the
   visible progress and receives one event per successfully loaded module.
===================================================== */
(function installV17352RuntimeReadinessGate(){
    if(typeof window==="undefined"||window.__v17347RuntimeGateInstalled){ return; }
    window.__v17347RuntimeGateInstalled=true;
    const TOTAL_RUNTIME_MODULES=32;
    const loadedKeys=new Set();
    let released=false;
    let failed=false;

    function dispatch(name,detail){
        try{
            if(typeof CustomEvent==="function"){
                document.dispatchEvent(new CustomEvent(name,{detail:detail||{}}));
            }else if(document&&typeof document.dispatchEvent==="function"){
                document.dispatchEvent({type:name,detail:detail||{}});
            }
        }catch(_){ }
    }
    function progressDetail(label){
        return {loaded:loadedKeys.size,total:TOTAL_RUNTIME_MODULES,label:String(label||"")};
    }
    function blockInteraction(event){
        if(released){ return; }
        if(event&&typeof event.preventDefault==="function"){ event.preventDefault(); }
        if(event&&typeof event.stopImmediatePropagation==="function"){ event.stopImmediatePropagation(); }
    }

    document.addEventListener("pointerdown",blockInteraction,true);
    document.addEventListener("click",blockInteraction,true);
    document.addEventListener("keydown",blockInteraction,true);
    document.addEventListener("touchstart",blockInteraction,{capture:true,passive:false});

    window.__v173RuntimeProgressTotal=TOTAL_RUNTIME_MODULES;
    window.__v173ReportRuntimeProgress=function(key,label){
        if(key){ loadedKeys.add(String(key)); }
        dispatch("v173:runtime-progress",progressDetail(label));
        return loadedKeys.size;
    };
    window.__v17347RuntimeGateFail=function(message){
        if(failed||released){ return false; }
        failed=true;
        const text=String(message||"必要遊戲模組載入失敗，請重新整理。");
        dispatch("v173:runtime-failed",{message:text,loaded:loadedKeys.size,total:TOTAL_RUNTIME_MODULES});
        return false;
    };
    window.__v17347RuntimeGateRelease=function(){
        if(released||failed){ return false; }
        released=true;
        document.removeEventListener("pointerdown",blockInteraction,true);
        document.removeEventListener("click",blockInteraction,true);
        document.removeEventListener("keydown",blockInteraction,true);
        document.removeEventListener("touchstart",blockInteraction,true);
        document.documentElement.dataset.runtimeReady="173.52";
        dispatch("v173:runtime-ready",{loaded:TOTAL_RUNTIME_MODULES,total:TOTAL_RUNTIME_MODULES});
        dispatch("v17347:runtime-ready",{loaded:TOTAL_RUNTIME_MODULES,total:TOTAL_RUNTIME_MODULES});
        return true;
    };
    dispatch("v173:runtime-progress",{loaded:0,total:TOTAL_RUNTIME_MODULES,label:"啟動遊戲模組"});
})();

'''
loader=loader[:start]+new_gate+loader[end:]
loader=loader.replace('const V_ASSET_VERSION="173.51";','const V_ASSET_VERSION="173.52";',1)

old='''        if(existing){
            if(existing.dataset.loaded==="1" || existing.dataset.failed==="1"){
                next(index+1);
                return;
            }
            existing.addEventListener("load",()=>next(index+1),{once:true});
            existing.addEventListener("error",()=>next(index+1),{once:true});
            return;
        }
'''
new='''        if(existing){
            if(existing.dataset.loaded==="1"){
                if(typeof window.__v173ReportRuntimeProgress==="function"){ window.__v173ReportRuntimeProgress(runtime.id,runtime.src); }
                next(index+1);
                return;
            }
            if(existing.dataset.failed==="1"){
                next(index+1);
                return;
            }
            existing.addEventListener("load",()=>{
                if(typeof window.__v173ReportRuntimeProgress==="function"){ window.__v173ReportRuntimeProgress(runtime.id,runtime.src); }
                next(index+1);
            },{once:true});
            existing.addEventListener("error",()=>next(index+1),{once:true});
            return;
        }
'''
if old not in loader: raise SystemExit('runtime existing block not found')
loader=loader.replace(old,new,1)
old='''        script.addEventListener("load",function(){
            script.dataset.loaded="1";
            next(index+1);
        },{once:true});
'''
new='''        script.addEventListener("load",function(){
            script.dataset.loaded="1";
            if(typeof window.__v173ReportRuntimeProgress==="function"){ window.__v173ReportRuntimeProgress(runtime.id,runtime.src); }
            next(index+1);
        },{once:true});
'''
if old not in loader: raise SystemExit('runtime load block not found')
loader=loader.replace(old,new,1)
loader_path.write_text(loader,encoding='utf-8')

ui_path=Path('js/51-v169-rpg-ui.js')
ui=ui_path.read_text(encoding='utf-8')
ui=ui.replace('js/equipment-progression.js?v=173.51','js/equipment-progression.js?v=173.52')
old='''        script.async=false;
        script.onerror=function(){
'''
new='''        script.async=false;
        script.onload=function(){
            if(typeof window.__v173ReportRuntimeProgress==="function"){
                window.__v173ReportRuntimeProgress("equipment-progression-runtime","裝備與商店系統");
            }
        };
        script.onerror=function(){
'''
if old not in ui: raise SystemExit('equipment loader onload anchor not found')
ui=ui.replace(old,new,1)
ui_path.write_text(ui,encoding='utf-8')

equip_path=Path('js/equipment-progression.js')
equip=equip_path.read_text(encoding='utf-8')
equip=equip.replace('css/52-v173.50-inventory-qol.css?v=173.50','css/52-v173.50-inventory-qol.css?v=173.52')
equip=equip.replace('js/53-v173.50-inventory-qol.js?v=173.51','js/53-v173.50-inventory-qol.js?v=173.52')
old='''        script.onload=function(){
        const startedAt=Date.now();
'''
new='''        script.onload=function(){
        if(typeof window.__v173ReportRuntimeProgress==="function"){
            window.__v173ReportRuntimeProgress("v17350-inventory-qol-runtime","背包與批量操作系統");
        }
        const startedAt=Date.now();
'''
if old not in equip: raise SystemExit('qol onload anchor not found')
equip=equip.replace(old,new,1)
equip_path.write_text(equip,encoding='utf-8')

qol_path=Path('js/53-v173.50-inventory-qol.js')
qol=qol_path.read_text(encoding='utf-8')
qol=qol.replace('css/53-v173.51-qa.css?v=173.51','css/53-v173.51-qa.css?v=173.52')
for name in ['54-v173.51-battle-qa.js','55-v173.51-inventory-qa.js','56-v173.51-shop-qa.js','57-v173.51-quest-qa.js']:
    qol=qol.replace(name+'?v=173.51',name+'?v=173.52')
old='''            script.async=false;
            script.onload=next;
'''
new='''            script.async=false;
            script.onload=function(){
                if(typeof window.__v173ReportRuntimeProgress==="function"){
                    window.__v173ReportRuntimeProgress(pair[0],pair[1]);
                }
                next();
            };
'''
if old not in qol: raise SystemExit('qa load progress anchor not found')
qol=qol.replace(old,new,1)
qol_path.write_text(qol,encoding='utf-8')

index_path=Path('index.html')
index=index_path.read_text(encoding='utf-8')
index=index.replace('173.51','173.52')
index=index.replace('js/52-v173.20-startup-loader.js?v=173.20','js/52-v173.20-startup-loader.js?v=173.52')
index=index.replace('css/51-v173.20-startup-loader.css?v=173.20','css/51-v173.20-startup-loader.css?v=173.52')
index_path.write_text(index,encoding='utf-8')

# Update only current-version expectations; preserve historical filenames / feature labels.
for path in Path('tests').glob('*.js'):
    text=path.read_text(encoding='utf-8')
    new=text
    replacements=[
        ('V_ASSET_VERSION="173\\.51"','V_ASSET_VERSION="173\\.52"'),
        ('V_ASSET_VERSION="173.51"','V_ASSET_VERSION="173.52"'),
        ('?v=173\\.51','?v=173\\.52'),
        ('?v=173.51','?v=173.52'),
        ('<title>四象江湖傳 V173\\.51<\\/title>','<title>四象江湖傳 V173\\.52<\\/title>'),
        ('<title>四象江湖傳 V173.51</title>','<title>四象江湖傳 V173.52</title>'),
        ('aria-label="目前版本 V173\\.51"','aria-label="目前版本 V173\\.52"'),
        ('aria-label="目前版本 V173.51"','aria-label="目前版本 V173.52"'),
        ('>V173\\.51<\\/div>','>V173\\.52<\\/div>'),
        ('>V173.51</div>','>V173.52</div>'),
    ]
    for a,b in replacements: new=new.replace(a,b)
    if new!=text: path.write_text(new,encoding='utf-8')

# Rewrite startup regression to verify real module progress + minimum cinematic duration.
test=Path('tests/v173.20-startup-loader.test.js')
test.write_text(r'''"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const {execFileSync}=require("node:child_process");
const html=fs.readFileSync("index.html","utf8");
const css=fs.readFileSync("css/51-v173.20-startup-loader.css","utf8");
const source=fs.readFileSync("js/52-v173.20-startup-loader.js","utf8");
const loader=fs.readFileSync("js/20-anonymous-20.js","utf8");

for(const file of ["assets/ui/startup-logo-v173.20.jpg","assets/ui/startup-main-city-v173.20.jpg"]){
  const details=execFileSync("identify",["-format","%m %w %h",file],{encoding:"utf8"});
  assert.equal(details,"JPEG 864 1536",file);
}
assert.ok(html.indexOf('id="startupLoader"')<html.indexOf('id="app"'));
assert.ok(html.indexOf("js/52-v173.20-startup-loader.js?v=173.52")<html.indexOf("js/00-main.js?v=173.52"));
assert.match(html,/css\/51-v173\.20-startup-loader\.css\?v=173\.52/);
assert.match(loader,/const V_ASSET_VERSION="173\.52"/);
assert.match(loader,/TOTAL_RUNTIME_MODULES=32/);
assert.match(loader,/__v173ReportRuntimeProgress/);
assert.doesNotMatch(loader,/id="v17347RuntimeGate"/);
assert.match(source,/DEFAULT_RUNTIME_TOTAL=32/);
assert.match(source,/v173:runtime-progress/);
assert.match(source,/v173:runtime-ready/);
assert.match(source,/v173:runtime-failed/);
assert.match(source,/moduleRatio[\s\S]*?\*90/);
assert.match(source,/elapsed\/totalDuration/);
assert.match(source,/!runtimeReady\|\|now\(\)-startedAt<totalDuration/);
assert.match(source,/runtimeFailed/);
assert.match(source,/載入核心系統/);
assert.match(source,/已載入 \"\+loaded\+\" \/ \"\+runtimeTotal\+\" 個遊戲模組/);
assert.match(html,/〔點擊空白處 進入遊戲〕/);
assert.match(css,/\.startup-enter-prompt\{[\s\S]*?animation:startupEnterBlink 1\.15s ease-in-out infinite;/);
console.log("✓ V173.52 real startup progress + 12~15s cinematic gate");
''',encoding='utf-8')

# Update old runtime integrity expectations to the new non-visual gate and Fire Rocket owner.
p=Path('tests/v173.47-runtime-integrity.test.js')
s=p.read_text(encoding='utf-8')
s=s.replace('const V_ASSET_VERSION="173\\.51"','const V_ASSET_VERSION="173\\.52"')
s=s.replace('js\\/20-anonymous-20\\.js\\?v=173\\.51','js\\/20-anonymous-20\\.js\\?v=173\\.52')
s=s.replace('equipment-progression\\.js\\?v=173\\.51','equipment-progression\\.js\\?v=173\\.52')
s=s.replace('assert.match(animation,/config\\.id==="fireRocket"&&model\\.sprite/);\nassert.match(animation,/record\\.failed\\|\\|!record\\.ready/);\nassert.match(animation,/model\\.sprite=null/);',
'''assert.match(animation,/fireRocket:\\{[\\s\\S]*?assets\\/vfx\\/fire\\/fire-rocket-cast\\.png/);\nassert.doesNotMatch(animation,/config\\.id==="fireRocket"[\\s\\S]{0,260}model\\.sprite=null/);''')
p.write_text(s,encoding='utf-8')

# Dedicated integration assertions.
Path('tests/v173.52-real-startup-progress.test.js').write_text(r'''"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const loader=fs.readFileSync("js/20-anonymous-20.js","utf8");
const startup=fs.readFileSync("js/52-v173.20-startup-loader.js","utf8");
const ui=fs.readFileSync("js/51-v169-rpg-ui.js","utf8");
const equipment=fs.readFileSync("js/equipment-progression.js","utf8");
const qol=fs.readFileSync("js/53-v173.50-inventory-qol.js","utf8");
const index=fs.readFileSync("index.html","utf8");
assert.match(loader,/TOTAL_RUNTIME_MODULES=32/);
assert.match(loader,/__v173ReportRuntimeProgress\(runtime\.id,runtime\.src\)/);
assert.match(loader,/dispatch\("v173:runtime-ready"/);
assert.match(loader,/dispatch\("v173:runtime-failed"/);
assert.doesNotMatch(loader,/正在同步最新遊戲系統/);
assert.doesNotMatch(loader,/v17347RuntimeGateStatus/);
assert.match(startup,/進度 0~90% 直接來自實際 runtime 模組 load 事件/);
assert.match(startup,/runtimeReady/);
assert.match(startup,/totalDuration/);
assert.match(ui,/equipment-progression\.js\?v=173\.52/);
assert.match(ui,/__v173ReportRuntimeProgress\("equipment-progression-runtime"/);
assert.match(equipment,/53-v173\.50-inventory-qol\.js\?v=173\.52/);
assert.match(equipment,/__v173ReportRuntimeProgress\("v17350-inventory-qol-runtime"/);
assert.match(qol,/54-v173\.51-battle-qa\.js\?v=173\.52/);
assert.match(qol,/57-v173\.51-quest-qa\.js\?v=173\.52/);
assert.match(qol,/__v173ReportRuntimeProgress\(pair\[0\],pair\[1\]\)/);
assert.match(index,/<title>四象江湖傳 V173\.52<\/title>/);
console.log("✓ V173.52 real startup progress integration");
''',encoding='utf-8')

print('V173.52 startup integration patch applied')
