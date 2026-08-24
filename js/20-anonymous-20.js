
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
