
/* =====================================================
   ★★★ 資產快取版本號（改動任何被下面 loader 載入的檔案，
   就把這個數字往上加一，只要改這一個地方）★★★

   為什麼要有這個：這個專案的 patch 檔（js/25、js/26、js/27、js/28、
   css/31~34……）不是靠 index.html 的 <script> 標籤載入，而是由下面
   幾個 loader 動態插進來的，網址後面都帶 ?v=NNN。瀏覽器是用「完整
   網址」當快取鍵，所以只要這個數字沒變，就算檔案內容整個換掉，
   手機瀏覽器還是會繼續拿舊的快取版本，使用者會看到「修了但沒生效」。

   過去這個數字是散在 4 個 loader 裡各寫各的字面值，結果從 v=132 之後
   連續 4 個 PR（#17/#18/#19/#20）改了 js/25、js/27、css/33，版本號
   卻一次都沒動——使用者整整 4 輪都在跑舊程式碼，回報了一堆「已經
   修好卻還在發生」的問題。改成單一常數就是為了讓「忘記改」這件事
   不可能再發生：只要記得動這一行就好。

   ⚠️ 提醒：js/00-main.js 的 ?v= 寫在 index.html 裡（不經過這裡），
   改到那個檔案時要另外去 index.html 更新。
===================================================== */
const V_ASSET_VERSION="173.39";

function vAssetUrl(path){
    return path+"?v="+V_ASSET_VERSION;
}


/* =====================================================
   V109 — 戰鬥元素匣：可重複拖曳懸浮按鈕
   - 點一下：開啟原本自動戰鬥設定
   - 拖曳：只改元素匣位置，不觸發設定
   - 每次 pointerdown 都以「目前位置」重新計算，所以可反覆拖曳
   - 使用 Pointer Events，同時支援 Android Chrome 觸控與滑鼠
===================================================== */
(function initBattleElementBoxDrag(){
    function bind(){
        const button=document.getElementById("battleElementBoxButton");
        const page=document.getElementById("battlePage");
        if(!button || !page || button.dataset.dragReady==="1") return;
        button.dataset.dragReady="1";

        let drag=null;
        let suppressClick=false;
        const DRAG_THRESHOLD=5;

        function getLogicalScale(){
            const rect=page.getBoundingClientRect();
            return {
                rect,
                sx:rect.width ? page.clientWidth/rect.width : 1,
                sy:rect.height ? page.clientHeight/rect.height : 1
            };
        }

        button.addEventListener("pointerdown",function(e){
            if(e.pointerType==="mouse" && e.button!==0) return;

            const scale=getLogicalScale();
            const br=button.getBoundingClientRect();
            const startLeft=(br.left-scale.rect.left)*scale.sx;
            const startTop=(br.top-scale.rect.top)*scale.sy;

            drag={
                pointerId:e.pointerId,
                startClientX:e.clientX,
                startClientY:e.clientY,
                startLeft,
                startTop,
                sx:scale.sx,
                sy:scale.sy,
                moved:false
            };

            suppressClick=false;
            button.classList.add("dragging");
            try{ button.setPointerCapture(e.pointerId); }catch(_){ }
            e.preventDefault();
        });

        button.addEventListener("pointermove",function(e){
            if(!drag || e.pointerId!==drag.pointerId) return;

            const dx=e.clientX-drag.startClientX;
            const dy=e.clientY-drag.startClientY;
            if(!drag.moved && Math.hypot(dx,dy)>=DRAG_THRESHOLD){
                drag.moved=true;
            }
            if(!drag.moved) return;

            const maxLeft=Math.max(0,page.clientWidth-button.offsetWidth);
            const maxTop=Math.max(0,page.clientHeight-button.offsetHeight);
            const left=Math.max(0,Math.min(maxLeft,drag.startLeft+dx*drag.sx));
            const top=Math.max(0,Math.min(maxTop,drag.startTop+dy*drag.sy));

            button.style.setProperty("left",left+"px","important");
            button.style.setProperty("top",top+"px","important");
            button.style.setProperty("bottom","auto","important");
            e.preventDefault();
        });

        function finishPointer(e){
            if(!drag || e.pointerId!==drag.pointerId) return;
            suppressClick=drag.moved;
            try{
                if(button.hasPointerCapture(e.pointerId)){
                    button.releasePointerCapture(e.pointerId);
                }
            }catch(_){ }
            drag=null;
            button.classList.remove("dragging");
            e.preventDefault();
        }

        button.addEventListener("pointerup",finishPointer);
        button.addEventListener("pointercancel",function(e){
            if(!drag || e.pointerId!==drag.pointerId) return;
            try{
                if(button.hasPointerCapture(e.pointerId)){
                    button.releasePointerCapture(e.pointerId);
                }
            }catch(_){ }
            drag=null;
            suppressClick=false;
            button.classList.remove("dragging");
        });

        button.addEventListener("click",function(e){
            if(suppressClick){
                suppressClick=false;
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            openHomeFeature("autoBattleSettings");
        });

        button.addEventListener("dragstart",function(e){ e.preventDefault(); });
    }

    if(document.readyState==="loading"){
        document.addEventListener("DOMContentLoaded",bind,{once:true});
    }else{
        bind();
    }
})();

/* V131 loader — keeps the split project stable without reopening index.html. */
(function loadV131FixBatch(){
    function load(){
        if(!document.getElementById("v131-fix-batch-style")){
            const link=document.createElement("link");
            link.id="v131-fix-batch-style";
            link.rel="stylesheet";
            link.href=vAssetUrl("css/31-v131-fix-batch.css");
            document.head.appendChild(link);
        }

    }

    if(document.readyState==="loading"){
        document.addEventListener("DOMContentLoaded",load,{once:true});
    }else{
        setTimeout(load,0);
    }
})();

/* V131 patrol asset loader — sequential because the sprite is split into chunks. */
(function loadV131PatrolAppearanceAssets(){
    function loadStyle(){
        if(document.getElementById("v131-patrol-appearance-style")){ return; }
        const link=document.createElement("link");
        link.id="v131-patrol-appearance-style";
        link.rel="stylesheet";
        link.href=vAssetUrl("css/32-v131-patrol-appearance.css");
        document.head.appendChild(link);
    }

    function loadScripts(){
        const sources=[
            "js/v131-patrol-sprite-0.js?v=131f",
            "js/v131-patrol-sprite-1.js?v=131f",
            "js/v131-patrol-sprite-2.js?v=131f",
            "js/v131-patrol-sprite-3.js?v=131f",
            "js/v131-patrol-sprite-4.js?v=131f",
            "js/v131-patrol-sprite-5.js?v=131f",
            "js/v131-patrol-sprite-6.js?v=131f",
            "js/v131-patrol-sprite-7.js?v=131f",
            "js/v131-patrol-sprite-8.js?v=131f",
            "js/v131-patrol-sprite-9.js?v=131f",
            "js/v131-patrol-sprite-10.js?v=131f",
            "js/v131-patrol-sprite-11.js?v=131f",
            "js/v131-patrol-sprite-12.js?v=131f",
            "js/v131-patrol-sprite-13.js?v=131f",
            "js/v131-patrol-sprite-14.js?v=131f",
            "js/v131-patrol-sprite-15.js?v=131f",
            "js/v131-patrol-sprite-16.js?v=131f",
            "js/v131-patrol-sprite-17.js?v=131f",
            "js/v131-patrol-sprite-18.js?v=131f",
            "js/v131-patrol-sprite-19.js?v=131f",
            "js/v131-patrol-sprite-20.js?v=131f",
            "js/v131-patrol-sprite-21.js?v=131f",
            "js/v131-patrol-sprite-22.js?v=131f",
            "js/v131-patrol-sprite-23.js?v=131f",
            "js/v131-patrol-sprite-24.js?v=131f",
            "js/v131-patrol-sprite-25.js?v=131f",
            "js/v131-patrol-sprite-26.js?v=131f",
            "js/v131-patrol-sprite-27.js?v=131f",
            "js/v131-patrol-sprite-28.js?v=131f",
            "js/v131-patrol-sprite-29.js?v=131f",
            "js/v131-patrol-sprite-30.js?v=131f",
            "js/v131-patrol-sprite-31.js?v=131f",
            "js/v131-patrol-sprite-32.js?v=131f",
            "js/v131-patrol-sprite-33.js?v=131f",
            "js/v131-patrol-sprite-34.js?v=131f",
            "js/v131-patrol-sprite-35.js?v=131f",
            "js/v131-patrol-sprite-36.js?v=131f",
            "js/v131-patrol-sprite-37.js?v=131f",
            "js/v131-patrol-sprite-38.js?v=131f",
            "js/v131-patrol-sprite-39.js?v=131f",
            "js/v131-patrol-sprite-40.js?v=131f",
            "js/v131-patrol-sprite-41.js?v=131f",
            "js/v131-patrol-sprite-42.js?v=131f",
            "js/v131-patrol-sprite-male-0.js?v=131c",
            "js/v131-patrol-sprite-male-1.js?v=131c",
            "js/v131-patrol-sprite-male-2.js?v=131c",
            "js/v131-patrol-sprite-male-3.js?v=131c",
            "js/v131-patrol-sprite-male-4.js?v=131c",
            "js/v131-patrol-sprite-male-5.js?v=131c",
            "js/v131-patrol-sprite-male-6.js?v=131c",
            "js/v131-patrol-sprite-male-7.js?v=131c",
            "js/v131-patrol-sprite-male-8.js?v=131c",
            "js/v131-patrol-sprite-male-9.js?v=131c",
            "js/v131-patrol-sprite-male-10.js?v=131c",
            "js/v131-patrol-sprite-male-11.js?v=131c",
            "js/v131-patrol-sprite-male-12.js?v=131c",
            "js/v131-patrol-sprite-male-13.js?v=131c",
            "js/v131-patrol-sprite-male-14.js?v=131c",
            "js/v131-patrol-sprite-male-15.js?v=131c",
            "js/v131-patrol-sprite-male-16.js?v=131c",
            "js/v131-patrol-sprite-male-17.js?v=131c",
            /*
               ★ 上面 61 個 sprite chunk 是純 base64 圖片資料、內容從
               V131 之後就沒再變過，而且體積很大——所以刻意「不」跟著
               V_ASSET_VERSION 走，維持釘死在各自的舊版本號，避免每次
               改一行邏輯就害使用者重新下載一整包圖片。真的換圖時再手動
               改這幾個字面值即可。下面這個才是會跟著改的邏輯檔。
            */
            vAssetUrl("js/26-v131-patrol-appearance.js")
        ];

        function next(index){
            if(index>=sources.length){ return; }
            const id="v131-patrol-script-"+index;
            const existing=document.getElementById(id);
            if(existing){
                if(existing.dataset.loaded==="1"){ next(index+1); }
                else{ existing.addEventListener("load",()=>next(index+1),{once:true}); }
                return;
            }
            const script=document.createElement("script");
            script.id=id;
            script.src=sources[index];
            script.addEventListener("load",function(){
                script.dataset.loaded="1";
                next(index+1);
            },{once:true});
            script.addEventListener("error",function(){
                console.error("V131 巡怪形象素材載入失敗：",sources[index]);
            },{once:true});
            document.body.appendChild(script);
        }
        next(0);
    }

    function load(){
        loadStyle();
        loadScripts();
    }

    if(document.readyState==="loading"){
        document.addEventListener("DOMContentLoaded",load,{once:true});
    }else{
        setTimeout(load,0);
    }
})();

/* V132 loader — talismans/materials/equipment sets/daily dungeons content patch. */
(function loadV132ContentExpansion(){
    function load(){
        if(!document.getElementById("v132-content-expansion-style")){
            const link=document.createElement("link");
            link.id="v132-content-expansion-style";
            link.rel="stylesheet";
            link.href=vAssetUrl("css/33-v132-content-expansion.css");
            document.head.appendChild(link);
        }

    }

    if(document.readyState==="loading"){
        document.addEventListener("DOMContentLoaded",load,{once:true});
    }else{
        setTimeout(load,0);
    }
})();

/* V133 loader — EXP curve / gold rank multiplier / shop tier pricing rebalance. */
(function loadV133EconomyRebalance(){
    function load(){
        if(!document.getElementById("v133-economy-rebalance-style")){
            const link=document.createElement("link");
            link.id="v133-economy-rebalance-style";
            link.rel="stylesheet";
            link.href=vAssetUrl("css/34-v133-economy-rebalance.css");
            document.head.appendChild(link);
        }

    }

    if(document.readyState==="loading"){
        document.addEventListener("DOMContentLoaded",load,{once:true});
    }else{
        setTimeout(load,0);
    }
})();

/* V134 loader — battle HUD/pacing, auto-battle feedback, backpack back button. */
(function loadV134Fixes(){
    function load(){
        if(!document.getElementById("v134-fixes-style")){
            const link=document.createElement("link");
            link.id="v134-fixes-style";
            link.rel="stylesheet";
            link.href=vAssetUrl("css/35-v134-fixes.css");
            document.head.appendChild(link);
        }

    }

    if(document.readyState==="loading"){
        document.addEventListener("DOMContentLoaded",load,{once:true});
    }else{
        setTimeout(load,0);
    }
})();

/* V135 loader — auto-battle feedback, skill target scope labels, shield bar. */
(function loadV135Fixes(){
    function load(){
        if(!document.getElementById("v135-fixes-style")){
            const link=document.createElement("link");
            link.id="v135-fixes-style";
            link.rel="stylesheet";
            link.href=vAssetUrl("css/36-v135-fixes.css");
            document.head.appendChild(link);
        }

    }

    if(document.readyState==="loading"){
        document.addEventListener("DOMContentLoaded",load,{once:true});
    }else{
        setTimeout(load,0);
    }
})();

/* V139 loader — rested EXP status panel. */
(function loadV139RestedExperienceStyle(){
    function load(){
        if(document.getElementById("v139-rested-experience-style")){ return; }
        const link=document.createElement("link");
        link.id="v139-rested-experience-style";
        link.rel="stylesheet";
        link.href=vAssetUrl("css/37-v139-rested-experience.css");
        document.head.appendChild(link);
    }

    if(document.readyState==="loading"){
        document.addEventListener("DOMContentLoaded",load,{once:true});
    }else{
        setTimeout(load,0);
    }
})();

/* V141 loader — synthesis, compact mobile UI, battle effects and Abyss. */
(function loadV141SystemExpansionStyle(){
    function load(){
        if(document.getElementById("v141-system-expansion-style")){ return; }
        const link=document.createElement("link");
        link.id="v141-system-expansion-style";
        link.rel="stylesheet";
        link.href=vAssetUrl("css/38-v141-system-expansion.css");
        document.head.appendChild(link);
    }

    if(document.readyState==="loading"){
        document.addEventListener("DOMContentLoaded",load,{once:true});
    }else{
        setTimeout(load,0);
    }
})();

/* V142 loader — shared action-timed skill animations. */
(function loadV142SkillAnimationStyle(){
    function load(){
        if(document.getElementById("v142-skill-animation-style")){ return; }
        const link=document.createElement("link");
        link.id="v142-skill-animation-style";
        link.rel="stylesheet";
        link.href=vAssetUrl("css/39-v142-skill-animation.css");
        document.head.appendChild(link);
    }

    if(document.readyState==="loading"){
        document.addEventListener("DOMContentLoaded",load,{once:true});
    }else{
        setTimeout(load,0);
    }
})();

/* V143 loader — readable enemy cards, dungeon flow and per-ID animations. */
(function loadV143CombatDungeonPolishStyle(){
    function load(){
        if(document.getElementById("v143-combat-dungeon-polish-style")){ return; }
        const link=document.createElement("link");
        link.id="v143-combat-dungeon-polish-style";
        link.rel="stylesheet";
        link.href=vAssetUrl("css/40-v143-combat-dungeon-polish.css");
        document.head.appendChild(link);
    }

    if(document.readyState==="loading"){
        document.addEventListener("DOMContentLoaded",load,{once:true});
    }else{
        setTimeout(load,0);
    }
})();

/* V144 loader — economy, monster loadouts, hard-control and Abyss rules. */
(function loadV144RulesAndAbyssStyle(){
    function load(){
        if(document.getElementById("v144-rules-and-abyss-style")){ return; }
        const link=document.createElement("link");
        link.id="v144-rules-and-abyss-style";
        link.rel="stylesheet";
        link.href=vAssetUrl("css/41-v144-rules-and-abyss.css");
        document.head.appendChild(link);
    }

    if(document.readyState==="loading"){
        document.addEventListener("DOMContentLoaded",load,{once:true});
    }else{
        setTimeout(load,0);
    }
})();

/* V146 loader — final combat, Abyss, inventory and economy polish. */
(function loadV146SystemPolishStyle(){
    function load(){
        if(document.getElementById("v146-system-polish-style")){ return; }
        const link=document.createElement("link");
        link.id="v146-system-polish-style";
        link.rel="stylesheet";
        link.href=vAssetUrl("css/42-v146-system-polish.css");
        document.head.appendChild(link);
    }

    if(document.readyState==="loading"){
        document.addEventListener("DOMContentLoaded",load,{once:true});
    }else{
        setTimeout(load,0);
    }
})();

/* V148 loader — target truth, support rules and dungeon usability. */
(function loadV148CombatDungeonFixesStyle(){
    function load(){
        if(document.getElementById("v148-combat-dungeon-fixes-style")){ return; }
        const link=document.createElement("link");
        link.id="v148-combat-dungeon-fixes-style";
        link.rel="stylesheet";
        link.href=vAssetUrl("css/43-v148-combat-dungeon-fixes.css");
        document.head.appendChild(link);
    }

    if(document.readyState==="loading"){
        document.addEventListener("DOMContentLoaded",load,{once:true});
    }else{
        setTimeout(load,0);
    }
})();

/* V149 loader — final skill rules, shop alignment and combat feedback. */
(function loadV149SkillUiRulesStyle(){
    function load(){
        if(document.getElementById("v149-skill-ui-rules-style")){ return; }
        const link=document.createElement("link");
        link.id="v149-skill-ui-rules-style";
        link.rel="stylesheet";
        link.href=vAssetUrl("css/44-v149-skill-ui-rules.css");
        document.head.appendChild(link);
    }

    if(document.readyState==="loading"){
        document.addEventListener("DOMContentLoaded",load,{once:true});
    }else{
        setTimeout(load,0);
    }
})();

/* V152 loader — current dev fixes, dungeon art and final balance values. */
(function loadV152DevFixesStyle(){
    function load(){
        if(document.getElementById("v152-dev-fixes-style")){ return; }
        const link=document.createElement("link");
        link.id="v152-dev-fixes-style";
        link.rel="stylesheet";
        link.href=vAssetUrl("css/45-v152-dev-fixes.css");
        document.head.appendChild(link);
    }

    if(document.readyState==="loading"){
        document.addEventListener("DOMContentLoaded",load,{once:true});
    }else{
        setTimeout(load,0);
    }
})();

/* V154 loader — current battle, element box and Abyss fixes. */
(function loadV154DevFixesStyle(){
    function load(){
        if(document.getElementById("v154-dev-fixes-style")){ return; }
        const link=document.createElement("link");
        link.id="v154-dev-fixes-style";
        link.rel="stylesheet";
        link.href=vAssetUrl("css/46-v154-dev-fixes.css");
        document.head.appendChild(link);
    }

    if(document.readyState==="loading"){
        document.addEventListener("DOMContentLoaded",load,{once:true});
    }else{
        setTimeout(load,0);
    }
})();

/* V158 loader — final skill, combat-value and Abyss portrait tuning. */
(function loadV158CombatTuningStyle(){
    function load(){
        if(document.getElementById("v158-combat-tuning-style")){ return; }
        const link=document.createElement("link");
        link.id="v158-combat-tuning-style";
        link.rel="stylesheet";
        link.href=vAssetUrl("css/47-v158-combat-tuning.css");
        document.head.appendChild(link);
    }

    if(document.readyState==="loading"){
        document.addEventListener("DOMContentLoaded",load,{once:true});
    }else{
        setTimeout(load,0);
    }
})();

/* V169 loader — Element Box settings, RPG UI and Abyss reward flow. */
(function loadV169Styles(){
    const styles=[
        {id:"v169-element-box-settings-style",href:"css/48-v169-element-box-settings.css"},
        {id:"v169-rpg-ui-style",href:"css/49-v169-rpg-ui.css"},
        {id:"v169-abyss-flow-style",href:"css/50-v169-abyss-flow.css"}
    ];

    function load(){
        styles.forEach(style=>{
            if(document.getElementById(style.id)){ return; }
            const link=document.createElement("link");
            link.id=style.id;
            link.rel="stylesheet";
            link.href=vAssetUrl(style.href);
            document.head.appendChild(link);
        });
    }

    if(document.readyState==="loading"){
        document.addEventListener("DOMContentLoaded",load,{once:true});
    }else{
        setTimeout(load,0);
    }
})();

/*
   V137 — all runtime patches must execute in version order.

   Dynamically appended scripts default to async=true.  The old loader appended
   V131/V132/V133/V134/V135/V136 independently, so cache/network timing could
   reverse wrappers that deliberately build on one another.  In particular,
   V131 could wrap V132's dungeon win interceptor (granting ordinary battle EXP
   inside dungeons), and V132/V135 could disagree about target-scope labels.
   Load one script at a time and append the next only after the previous one has
   executed, which makes the wrapper stack deterministic on every device.
*/
(function loadVersionedRuntimePatchesInOrder(){
    const runtimes=[
        {id:"v131-fix-batch-runtime",src:"js/25-v131-fix-batch.js"},
        {id:"v132-content-expansion-runtime",src:"js/27-v132-content-expansion.js"},
        {id:"v133-economy-rebalance-runtime",src:"js/28-v133-economy-rebalance.js"},
        {id:"v134-fixes-runtime",src:"js/29-v134-fixes.js"},
        {id:"v135-fixes-runtime",src:"js/30-v135-fixes.js"},
        {id:"v136-auto-battle-fix-runtime",src:"js/31-v136-auto-battle-fix.js"},
        {id:"v139-rested-experience-runtime",src:"js/32-v139-rested-experience.js"},
        {id:"v140-four-element-balance-runtime",src:"js/33-v140-four-element-balance.js"},
        {id:"v141-core-systems-runtime",src:"js/34-v141-core-systems.js"},
        {id:"v141-ui-battle-runtime",src:"js/35-v141-ui-battle.js"},
        {id:"v141-content-systems-runtime",src:"js/36-v141-content-systems.js"},
        {id:"v142-skill-animation-runtime",src:"js/37-v142-skill-animation.js"},
        {id:"v143-system-fixes-runtime",src:"js/38-v143-system-fixes.js"},
        {id:"v143-skill-animation-runtime",src:"js/39-v143-skill-animation.js"},
        {id:"v144-rules-and-abyss-runtime",src:"js/40-v144-rules-and-abyss.js"},
        {id:"v146-system-polish-runtime",src:"js/41-v146-system-polish.js"},
        {id:"v148-combat-dungeon-fixes-runtime",src:"js/42-v148-combat-dungeon-fixes.js"},
        {id:"v149-skill-ui-rules-runtime",src:"js/43-v149-skill-ui-rules.js"},
        {id:"v152-dev-fixes-runtime",src:"js/44-v152-dev-fixes.js"},
        {id:"v154-dev-fixes-runtime",src:"js/45-v154-dev-fixes.js"},
        {id:"v155-dev-fixes-runtime",src:"js/46-v155-dev-fixes.js"},
        {id:"v158-combat-tuning-runtime",src:"js/47-v158-combat-tuning.js"},
        {id:"v159-abyss-battle-portraits-runtime",src:"js/48-v159-abyss-battle-portraits.js"},
        {id:"v169-element-box-settings-runtime",src:"js/49-v169-element-box-settings.js"},
        {id:"v169-water-skill-rules-runtime",src:"js/50-v169-water-skill-rules.js"},
        {id:"v169-rpg-ui-runtime",src:"js/51-v169-rpg-ui.js"}
    ];

    function next(index){
        if(index>=runtimes.length){ return; }
        const runtime=runtimes[index];
        const existing=document.getElementById(runtime.id);

        if(existing){
            if(existing.dataset.loaded==="1" || existing.dataset.failed==="1"){
                next(index+1);
                return;
            }
            existing.addEventListener("load",()=>next(index+1),{once:true});
            existing.addEventListener("error",()=>next(index+1),{once:true});
            return;
        }

        const script=document.createElement("script");
        script.id=runtime.id;
        script.async=false;
        script.src=vAssetUrl(runtime.src);
        script.addEventListener("load",function(){
            script.dataset.loaded="1";
            next(index+1);
        },{once:true});
        script.addEventListener("error",function(){
            script.dataset.failed="1";
            console.error("版本補丁載入失敗：",runtime.src);
            next(index+1);
        },{once:true});
        document.body.appendChild(script);
    }

    function load(){
        next(0);
    }

    if(document.readyState==="loading"){
        document.addEventListener("DOMContentLoaded",load,{once:true});
    }else{
        setTimeout(load,0);
    }
})();
