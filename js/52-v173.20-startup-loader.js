/* =====================================================
   V173.20 — 開場載入動畫唯一 owner
   - 總時長每次隨機 12～15 秒
   - Logo → 主城空景
   - 100% 後必須由玩家點擊才進入遊戲
===================================================== */
(function installStartupLoader(){
    "use strict";

    const MIN_DURATION_MS=12000;
    const MAX_DURATION_MS=15000;
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

    const loadingSteps=[
        {at:0,title:"建立啟動環境",detail:"檢查必要文件 / core.manifest"},
        {at:7,title:"驗證遊戲資源",detail:"整理圖像、字型與介面索引"},
        {at:17,title:"載入角色資料",detail:"讀取角色、裝備與背包資料"},
        {at:29,title:"同步四元素核心",detail:"建立火、水、風、土屬性資料"},
        {at:42,title:"初始化江湖存檔",detail:"讀取本機進度與隊伍設定"},
        {at:54,title:"載入戰鬥模組",detail:"建立技能、狀態與目標規則"},
        {at:67,title:"載入場景資源",detail:"準備地圖、角色與特效圖層"},
        {at:78,title:"渲染主城場景",detail:"建立光影、景深與介面層級"},
        {at:88,title:"校準行動裝置",detail:"同步 9:16 舞台與觸控區域"},
        {at:96,title:"完成最後檢查",detail:"確認必要資源與初始化狀態"}
    ];

    const randomBetween=(minimum,maximum)=>
        minimum+Math.random()*(maximum-minimum);
    const totalDuration=Math.round(randomBetween(MIN_DURATION_MS,MAX_DURATION_MS));
    const citySwitchRatio=randomBetween(.36,.43);
    const citySwitchAt=Math.round(totalDuration*citySwitchRatio);
    const startedAt=(window.performance&&typeof window.performance.now==="function")
        ? window.performance.now()
        : Date.now();

    let currentProgress=0;
    let completed=false;
    let entered=false;
    let cityShown=false;

    root.dataset.ownerReady="1";
    root.dataset.totalDuration=String(totalDuration);

    function now(){
        return (window.performance&&typeof window.performance.now==="function")
            ? window.performance.now()
            : Date.now();
    }

    function renderProgress(value){
        currentProgress=Math.max(currentProgress,Math.min(100,Math.round(value)));
        progressFill.style.width=currentProgress+"%";
        percent.textContent=currentProgress+"%";
        progress.setAttribute("aria-valuenow",String(currentProgress));

        let step=loadingSteps[0];
        for(const candidate of loadingSteps){
            if(currentProgress<candidate.at){ break; }
            step=candidate;
        }
        statusTitle.textContent=step.title;
        statusDetail.textContent=step.detail;
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

    function completeLoading(){
        if(completed){ return; }
        completed=true;
        showMainCityScene();
        renderProgress(100);
        statusTitle.textContent="載入完成";
        statusDetail.textContent="江湖已就緒，等待俠士進入";
        prompt.hidden=false;
        root.classList.add("is-ready");
        root.setAttribute("aria-label","載入完成，點擊空白處進入遊戲");
        root.setAttribute("tabindex","0");
    }

    function enterGame(event){
        if(!completed || entered){ return; }
        if(event && event.type==="keydown" && event.key!=="Enter" && event.key!==" "){
            return;
        }
        entered=true;
        root.classList.add("is-leaving");
        root.removeAttribute("tabindex");
        window.setTimeout(function(){
            root.hidden=true;
            document.dispatchEvent(new CustomEvent("v173.20:startup-entered"));
        },760);
    }

    function advanceProgress(){
        if(completed){ return; }
        const elapsed=Math.max(0,now()-startedAt);
        const ratio=Math.min(1,elapsed/totalDuration);
        const expected=ratio<citySwitchRatio
            ? (ratio/citySwitchRatio)*43
            : 43+((ratio-citySwitchRatio)/(1-citySwitchRatio))*56;
        const noisyTarget=Math.min(99,Math.floor(expected+randomBetween(-.5,3.8)));
        const jump=Math.floor(randomBetween(1,6));

        if(noisyTarget>currentProgress){
            renderProgress(Math.min(noisyTarget,currentProgress+jump));
        }

        if(elapsed>=totalDuration){
            completeLoading();
            return;
        }

        window.setTimeout(advanceProgress,Math.round(randomBetween(240,570)));
    }

    root.addEventListener("pointerup",enterGame);
    root.addEventListener("click",enterGame);
    root.addEventListener("keydown",enterGame);
    window.setTimeout(showMainCityScene,citySwitchAt);
    window.setTimeout(completeLoading,totalDuration);
    window.setTimeout(advanceProgress,Math.round(randomBetween(180,420)));
    renderProgress(0);
})();
