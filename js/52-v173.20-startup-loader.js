/* =====================================================
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
