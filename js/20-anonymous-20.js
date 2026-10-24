/* Critical/feature boundary owner. No global input lock and no network-order patch chain. */
const V_ASSET_VERSION="173.73";

(function installFeatureIntentBoundary(){
    "use strict";
    if(window.__fourSymbolsFeatureIntentInstalled){ return; }
    window.__fourSymbolsFeatureIntentInstalled=true;

    const rules=[
        {pattern:/showPage\(['"]map|enterZone|enterMap|openMap|patrol/i,feature:"patrol",label:"巡怪"},
        {pattern:/showPage\(['"]inventory|open.*inventory|backpack/i,feature:"inventory",label:"背包"},
        {pattern:/equipment|reforge/i,feature:"equipment",label:"裝備"},
        {pattern:/showPage\(['"]dungeon|dungeon/i,feature:"dungeon",label:"副本"},
        {pattern:/abyss/i,feature:"abyss",label:"深淵"},
        {pattern:/boss|tower/i,feature:"boss-tower",label:"四象塔"},
        {pattern:/relic/i,feature:"relic",label:"秘寶"},
        {pattern:/skill/i,feature:"skill",label:"技能"},
        {pattern:/shop/i,feature:"shop",label:"商店"},
        {pattern:/synth/i,feature:"synthesis",label:"合成"},
        {pattern:/battle/i,feature:"battle",label:"戰鬥"}
    ];
    function target(event){ return event.target&&event.target.closest&&event.target.closest("button,a,[data-feature]"); }
    function isBattleRuntimeInteraction(element){
        return !!(element&&element.closest&&element.closest("#battlePage"));
    }
    function isExpPoolInteraction(element){
        return !!(element&&element.closest&&element.closest("#homeExpPoolCard"));
    }
    function descriptor(element){
        if(!element){ return null; }
        /* 經驗池本身屬於主城 app-shell，但「預覽升級＋二次確認」owner 在
           gameplay-core。自從 gameplay-core 改成 lazy 後，若不先載入 owner，
           舊的即時分配按鈕就可能在防呆安裝前被點到。 */
        if(isExpPoolInteraction(element)){
            return {feature:"battle",label:"經驗池安全升級",expPool:true};
        }
        const explicit=element.dataset&&element.dataset.feature;
        if(explicit){ return {feature:explicit,label:element.getAttribute("aria-label")||element.textContent||explicit}; }
        const signature=[element.id,element.className,element.getAttribute&&element.getAttribute("onclick"),element.textContent].join(" ");
        return rules.find(rule=>rule.pattern.test(signature))||null;
    }
    function loader(){ return window.FourSymbolsFeatures; }
    function setLocalLoading(element,active,label){
        if(!element){ return; }
        element.classList.toggle("is-feature-loading",active);
        element.setAttribute("aria-busy",active?"true":"false");
        if(active){ element.dataset.featureLoadingLabel="正在載入"+(label||"功能")+"…"; }
        else{ delete element.dataset.featureLoadingLabel; }
    }
    function createNavigationIntent(element,sourceEvent){
        let executed=false;
        return function executeNavigationIntent(){
            if(executed){ return false; }
            executed=true;
            const inlineAction=element&&element.onclick;
            if(typeof inlineAction==="function"){
                const intentEvent=new MouseEvent("click",{bubbles:false,cancelable:true,view:window});
                inlineAction.call(element,intentEvent);
                return !intentEvent.defaultPrevented;
            }
            document.dispatchEvent(new CustomEvent("four-symbols:navigation-intent",{detail:{element,sourceEvent}}));
            return true;
        };
    }

    let expPoolPrimePromise=null;
    let expPoolSafetyUiReady=false;
    function refreshExpPoolSafetyUiOnce(){
        if(expPoolSafetyUiReady){ return; }
        expPoolSafetyUiReady=true;
        if(typeof window.renderExpDistributeList==="function"){
            window.renderExpDistributeList();
        }
        if(typeof window.v173DecorateExpPoolDistributionUi==="function"){
            window.v173DecorateExpPoolDistributionUi();
        }
        const pool=document.getElementById("homeExpPoolCard");
        if(pool){ pool.dataset.expSafetyOwner="ready"; }
    }
    function primeExpPoolSafety(){
        const pool=document.getElementById("homeExpPoolCard");
        const api=loader();
        if(!pool||!api){ return; }
        const visible=!pool.hidden&&window.getComputedStyle(pool).display!=="none"&&pool.getClientRects().length>0;
        if(!visible){ return; }
        if(api.isReady("battle")){
            refreshExpPoolSafetyUiOnce();
            return;
        }
        if(expPoolPrimePromise){ return; }
        setLocalLoading(pool,true,"經驗池安全升級");
        expPoolPrimePromise=api.ensure("battle","exp-pool-safety").then(()=>{
            setLocalLoading(pool,false);
            refreshExpPoolSafetyUiOnce();
        }).catch(error=>{
            setLocalLoading(pool,false);
            console.error("EXP pool safety owner failed to load:",error);
            document.dispatchEvent(new CustomEvent("four-symbols:feature-local-error",{detail:{feature:"battle",error}}));
        }).finally(()=>{ expPoolPrimePromise=null; });
    }
    function prefetch(event){
        const element=target(event); if(isBattleRuntimeInteraction(element)){ return; }
        const info=descriptor(element); const api=loader();
        if(info&&api&&!api.isReady(info.feature)){ void api.prefetch(info.feature,event.type); }
    }
    function enter(event){
        const element=target(event); if(isBattleRuntimeInteraction(element)){ return; }
        const info=descriptor(element); const api=loader();
        if(!info||!api||api.isReady(info.feature)||element.dataset.featureReplay==="1"){ return; }
        event.preventDefault(); event.stopImmediatePropagation();
        if(element.dataset.featureLoading==="1"){ return; }
        element.dataset.featureLoading="1"; setLocalLoading(element,true,info.label);
        const intent=createNavigationIntent(element,event);
        api.ensure(info.feature,info.expPool?"exp-pool-safety":"navigation").then(()=>{
            delete element.dataset.featureLoading; setLocalLoading(element,false);
            if(info.expPool){
                /* 不 replay 舊 DOM 上可能仍指向 immediate distribute 的 handler。
                   先由正式 owner 重繪成「預覽 → 確認」UI，玩家再點一次才會花 EXP。 */
                refreshExpPoolSafetyUiOnce();
                return;
            }
            /* One accepted human gesture produces one intent.  Do not replay
               a synthetic DOM click: it can be intercepted as a second tap. */
            intent();
        }).catch(error=>{
            delete element.dataset.featureLoading; setLocalLoading(element,false);
            console.error("Feature failed to load:",info.feature,error);
            document.dispatchEvent(new CustomEvent("four-symbols:feature-local-error",{detail:{feature:info.feature,error}}));
        });
    }
    document.addEventListener("pointerdown",prefetch,{capture:true,passive:true});
    document.addEventListener("touchstart",prefetch,{capture:true,passive:true});
    document.addEventListener("click",enter,true);
    window.FourSymbolsNavigationIntent=Object.freeze({create:createNavigationIntent});
    document.addEventListener("four-symbols:startup-ready",()=>{
        const api=loader();
        if(api){
            try{if(performance&&typeof performance.mark==="function"){performance.mark("four-symbols:background-prefetch-start");}}catch(_){ }
            api.idle(["inventory","shop","equipment","synthesis","relic"],["relicIcons"]).then(result=>{
                try{if(Array.isArray(result)&&result.at(-1)&&performance&&typeof performance.mark==="function"){performance.mark("four-symbols:relic-prefetch-ready");}}catch(_){ }
                return api.idle(["patrol","skill"]);
            }).then(()=>{try{if(performance&&typeof performance.mark==="function"){performance.mark("four-symbols:background-prefetch-idle");}}catch(_){ }});
        }
        primeExpPoolSafety();
    },{once:true});

    function primeExpPoolSafetyWhenDomReady(){
        primeExpPoolSafety();
    }
    if(document.readyState==="loading"){
        document.addEventListener("DOMContentLoaded",primeExpPoolSafetyWhenDomReady,{once:true});
    }else{
        primeExpPoolSafetyWhenDomReady();
    }
})();

(function initBattleUtilityControls(){
    function bind(){
        const button=document.getElementById("battleElementBoxButton");
        if(!button||button.dataset.utilityReady==="1"){ return; }
        button.dataset.utilityReady="1";
        button.addEventListener("click",()=>{
            if(typeof setBattleUtilityMenuOpen==="function"){ setBattleUtilityMenuOpen(false); }
            if(typeof openHomeFeature==="function"){ openHomeFeature("autoBattleSettings"); }
        });
        document.addEventListener("pointerdown",event=>{
            const region=document.getElementById("battleActionRegion");
            if(region?.classList.contains("utility-menu-open")&&!event.target.closest("#battleUtilityTray,#battleMoreButton")){
                if(typeof setBattleUtilityMenuOpen==="function"){ setBattleUtilityMenuOpen(false); }
            }
        });
        document.addEventListener("keydown",event=>{
            if(event.key!=="Escape"){ return; }
            const region=document.getElementById("battleActionRegion");
            if(region?.classList.contains("utility-menu-open")){
                if(typeof setBattleUtilityMenuOpen==="function"){ setBattleUtilityMenuOpen(false); }
                document.getElementById("battleMoreButton")?.focus();
            }
        });
    }
    if(document.readyState==="loading"){ document.addEventListener("DOMContentLoaded",bind,{once:true}); }else{ bind(); }
})();
