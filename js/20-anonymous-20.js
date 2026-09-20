/* Critical/feature boundary owner. No global input lock and no network-order patch chain. */
const V_ASSET_VERSION="173.69";

(function installFeatureIntentBoundary(){
    "use strict";
    if(window.__fourSymbolsFeatureIntentInstalled){ return; }
    window.__fourSymbolsFeatureIntentInstalled=true;

    const rules=[
        {pattern:/showPage\(['"]map|openMap|patrol/i,feature:"patrol",label:"巡怪"},
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
        const element=target(event); const info=descriptor(element); const api=loader();
        if(info&&api&&!api.isReady(info.feature)){ void api.prefetch(info.feature,event.type); }
    }
    function enter(event){
        const element=target(event); const info=descriptor(element); const api=loader();
        if(!info||!api||api.isReady(info.feature)||element.dataset.featureReplay==="1"){ return; }
        event.preventDefault(); event.stopImmediatePropagation();
        if(element.dataset.featureLoading==="1"){ return; }
        element.dataset.featureLoading="1"; setLocalLoading(element,true,info.label);
        api.ensure(info.feature,info.expPool?"exp-pool-safety":"navigation").then(()=>{
            delete element.dataset.featureLoading; setLocalLoading(element,false);
            if(info.expPool){
                /* 不 replay 舊 DOM 上可能仍指向 immediate distribute 的 handler。
                   先由正式 owner 重繪成「預覽 → 確認」UI，玩家再點一次才會花 EXP。 */
                refreshExpPoolSafetyUiOnce();
                return;
            }
            element.dataset.featureReplay="1"; element.click(); delete element.dataset.featureReplay;
        }).catch(error=>{
            delete element.dataset.featureLoading; setLocalLoading(element,false);
            console.error("Feature failed to load:",info.feature,error);
            document.dispatchEvent(new CustomEvent("four-symbols:feature-local-error",{detail:{feature:info.feature,error}}));
        });
    }
    document.addEventListener("pointerdown",prefetch,{capture:true,passive:true});
    document.addEventListener("touchstart",prefetch,{capture:true,passive:true});
    document.addEventListener("click",enter,true);
    document.addEventListener("click",()=>setTimeout(primeExpPoolSafety,0),true);
    document.addEventListener("four-symbols:startup-ready",()=>{
        const api=loader();
        if(api){ api.idle(); }
        primeExpPoolSafety();
    },{once:true});

    function installExpPoolVisibilityObserver(){
        if(!document.body||typeof MutationObserver==="undefined"){ return; }
        const observer=new MutationObserver(()=>{
            if(expPoolSafetyUiReady){ return; }
            primeExpPoolSafety();
        });
        observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:["class","style","hidden"]});
        primeExpPoolSafety();
    }
    if(document.readyState==="loading"){
        document.addEventListener("DOMContentLoaded",installExpPoolVisibilityObserver,{once:true});
    }else{
        installExpPoolVisibilityObserver();
    }
})();

(function initBattleElementBoxDrag(){
    function bind(){
        const button=document.getElementById("battleElementBoxButton");
        const page=document.getElementById("battlePage");
        if(!button||!page||button.dataset.dragReady==="1"){ return; }
        button.dataset.dragReady="1";
        let drag=null; let suppressClick=false; const threshold=5;
        function logicalScale(){
            const rect=page.getBoundingClientRect();
            return {rect,sx:rect.width?page.clientWidth/rect.width:1,sy:rect.height?page.clientHeight/rect.height:1};
        }
        button.addEventListener("pointerdown",event=>{
            if(event.pointerType==="mouse"&&event.button!==0){ return; }
            const scale=logicalScale(); const bounds=button.getBoundingClientRect();
            drag={pointerId:event.pointerId,x:event.clientX,y:event.clientY,left:(bounds.left-scale.rect.left)*scale.sx,top:(bounds.top-scale.rect.top)*scale.sy,sx:scale.sx,sy:scale.sy,moved:false};
            suppressClick=false; button.classList.add("dragging");
            try{ button.setPointerCapture(event.pointerId); }catch(_){ }
            event.preventDefault();
        });
        button.addEventListener("pointermove",event=>{
            if(!drag||event.pointerId!==drag.pointerId){ return; }
            const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
            if(!drag.moved&&Math.hypot(dx,dy)>=threshold){ drag.moved=true; }
            if(!drag.moved){ return; }
            const left=Math.max(0,Math.min(Math.max(0,page.clientWidth-button.offsetWidth),drag.left+dx*drag.sx));
            const top=Math.max(0,Math.min(Math.max(0,page.clientHeight-button.offsetHeight),drag.top+dy*drag.sy));
            button.style.setProperty("left",left+"px","important"); button.style.setProperty("top",top+"px","important");
            button.style.setProperty("bottom","auto","important"); event.preventDefault();
        });
        function finish(event){
            if(!drag||event.pointerId!==drag.pointerId){ return; }
            suppressClick=drag.moved; drag=null; button.classList.remove("dragging"); event.preventDefault();
        }
        button.addEventListener("pointerup",finish); button.addEventListener("pointercancel",finish);
        button.addEventListener("click",event=>{
            if(suppressClick){ suppressClick=false; event.preventDefault(); event.stopPropagation(); return; }
            if(typeof openHomeFeature==="function"){ openHomeFeature("autoBattleSettings"); }
        });
        button.addEventListener("dragstart",event=>event.preventDefault());
    }
    if(document.readyState==="loading"){ document.addEventListener("DOMContentLoaded",bind,{once:true}); }else{ bind(); }
})();
