(function(){
    "use strict";

    /* Mobile input contract owner. A scroll owner declares
       data-scroll-owner="x|y|both". Legacy owners are inferred only from
       real computed overflow, never from a selector whitelist. */
    const TAP_SLOP_CSS_PX=10;
    const activePointers=new Map();
    const suppressedTargets=[];
    function isGameSurfaceTarget(target){ return !!(target&&target.closest&&target.closest("#game-stage")); }
    function isEditableGameControl(target){ return !!(target&&target.closest&&target.closest('input, textarea, [contenteditable="true"]')); }
    function scrollAxes(node){
        const style=window.getComputedStyle(node);
        const declared=node.getAttribute&&node.getAttribute("data-scroll-owner");
        const canY=(style.overflowY==="auto"||style.overflowY==="scroll")&&node.scrollHeight>node.clientHeight+1;
        const canX=(style.overflowX==="auto"||style.overflowX==="scroll")&&node.scrollWidth>node.clientWidth+1;
        if(declared==="y") return canY?"y":null;
        if(declared==="x") return canX?"x":null;
        if(declared==="both") return canX||canY?"both":null;
        if(canX&&canY) return "both";
        return canY?"y":canX?"x":null;
    }
    function findScrollOwner(target){
        let node=target&&target.nodeType===1?target:target&&target.parentElement;
        while(node&&node!==document.documentElement){ const axes=scrollAxes(node); if(axes) return {node,axes}; node=node.parentElement; }
        return null;
    }
    function interactiveTarget(target){ return target&&target.closest&&target.closest("button,a,[role=button],input,select,textarea,[data-action],[onclick]"); }
    function rememberSuppression(target){ if(target) suppressedTargets.push(target); }
    function consumeSuppression(target){
        for(let index=suppressedTargets.length-1;index>=0;index--){
            const suppressed=suppressedTargets[index];
            if(suppressed===target||(suppressed&&suppressed.contains&&suppressed.contains(target))||(target&&target.contains&&target.contains(suppressed))){ suppressedTargets.splice(index,1); return true; }
        }
        return false;
    }
    function classify(pointer,event){
        const distance=Math.hypot(event.clientX-pointer.startX,event.clientY-pointer.startY);
        pointer.currentX=event.clientX; pointer.currentY=event.clientY; pointer.distance=distance;
        if(distance<TAP_SLOP_CSS_PX||pointer.state!=="TAP") return;
        pointer.state=pointer.dragOwner?"DRAG":pointer.scrollOwner?"SCROLL":"CANCEL";
    }
    document.addEventListener("pointerdown",function(event){
        if(!isGameSurfaceTarget(event.target)||(event.pointerType==="mouse"&&event.button!==0)) return;
        const initial=interactiveTarget(event.target)||event.target;
        activePointers.set(event.pointerId,{pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,currentX:event.clientX,currentY:event.clientY,distance:0,initialTarget:event.target,interactiveTarget:initial,scrollOwner:findScrollOwner(event.target),dragOwner:event.target.closest&&event.target.closest("[data-drag-owner]"),state:"TAP"});
    },{capture:true,passive:true});
    document.addEventListener("pointermove",function(event){ const pointer=activePointers.get(event.pointerId); if(pointer) classify(pointer,event); },{capture:true,passive:true});
    function finishPointer(event){ const pointer=activePointers.get(event.pointerId); if(!pointer) return; classify(pointer,event); activePointers.delete(event.pointerId); if(pointer.state!=="TAP") rememberSuppression(pointer.interactiveTarget); }
    document.addEventListener("pointerup",finishPointer,{capture:true,passive:true});
    document.addEventListener("pointercancel",function(event){ activePointers.delete(event.pointerId); },{capture:true,passive:true});
    function handleSuppressedGestureClick(event){ if(consumeSuppression(interactiveTarget(event.target)||event.target)){ event.preventDefault(); event.stopImmediatePropagation(); } }\n    const stage=document.getElementById("game-stage");\n    if(stage){ stage.addEventListener("click",handleSuppressedGestureClick,true); }

    /* Pinch is the sole touchmove cancellation. Single-finger panning is
       deliberately left to the browser and the Scroll Owner CSS contract. */
    document.addEventListener("touchmove",function(event){ if(isGameSurfaceTarget(event.target)&&event.touches&&event.touches.length>1) event.preventDefault(); },{passive:false});
    document.addEventListener("contextmenu",function(event){ if(isGameSurfaceTarget(event.target)&&!isEditableGameControl(event.target)) event.preventDefault(); },{capture:true});
    document.addEventListener("dragstart",function(event){ if(isGameSurfaceTarget(event.target)&&!isEditableGameControl(event.target)) event.preventDefault(); },{capture:true});
    document.addEventListener("selectstart",function(event){ if(isGameSurfaceTarget(event.target)&&!isEditableGameControl(event.target)) event.preventDefault(); },{capture:true});
    document.addEventListener("wheel",function(event){ if(event.ctrlKey&&isGameSurfaceTarget(event.target)) event.preventDefault(); },{capture:true,passive:false});
    ["gesturestart","gesturechange"].forEach(name=>window.addEventListener(name,function(event){ if(isGameSurfaceTarget(event.target)) event.preventDefault(); },{passive:false}));
    window.FourSymbolsGestureArbiter=Object.freeze({TAP_SLOP_CSS_PX,findScrollOwner,getState:pointerId=>activePointers.get(pointerId)||null});
})();
