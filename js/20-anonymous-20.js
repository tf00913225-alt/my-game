
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
            link.href="css/31-v131-fix-batch.css?v=132";
            document.head.appendChild(link);
        }

        if(!document.getElementById("v131-fix-batch-runtime")){
            const script=document.createElement("script");
            script.id="v131-fix-batch-runtime";
            script.src="js/25-v131-fix-batch.js?v=132";
            document.body.appendChild(script);
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
        link.href="css/32-v131-patrol-appearance.css?v=132";
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
            "js/26-v131-patrol-appearance.js?v=132"
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
            link.href="css/33-v132-content-expansion.css?v=132";
            document.head.appendChild(link);
        }

        if(!document.getElementById("v132-content-expansion-runtime")){
            const script=document.createElement("script");
            script.id="v132-content-expansion-runtime";
            script.src="js/27-v132-content-expansion.js?v=132";
            document.body.appendChild(script);
        }
    }

    if(document.readyState==="loading"){
        document.addEventListener("DOMContentLoaded",load,{once:true});
    }else{
        setTimeout(load,0);
    }
})();
