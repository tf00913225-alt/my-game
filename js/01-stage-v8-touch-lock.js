(function(){
    "use strict";

    /* Shared input contract owner. A scroll owner declares
       data-scroll-owner="x|y|both". Legacy owners are inferred only from
       real computed overflow, never from a selector whitelist. */
    const TAP_SLOP_CSS_PX=10;
    const activePointers=new Map();
    // Completed gestures expire even if the browser emits no compatibility click.
    const CLICK_LIFETIME_MS=1000;
    const completedPointers=new Map();
    const retiringMousePointers=new Map();
    const retiringClickGuards=new Set();
    let legacyClickGesture=null;
    const managedSurfaces=new WeakMap();
    function managedSurfaceFor(target){
        for(let node=target;node;node=node.parentElement){ if(managedSurfaces.has(node)){ return node; } }
        const root=target&&target.closest&&target.closest("#game-stage, #game-ui");
        return root&&managedSurfaces.has(root)?root:null;
    }
    function isGameSurfaceTarget(target){ return !!(managedSurfaceFor(target)||target&&target.closest&&target.closest("#game-stage, #game-ui")); }
    function isEditableGameControl(target){ return !!(target&&target.closest&&target.closest('input, textarea, [contenteditable]:not([contenteditable="false"])')); }
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
    function findScrollOwner(target,axis){
        let node=target&&target.nodeType===1?target:target&&target.parentElement;
        while(node&&node!==document.documentElement){
            const axes=scrollAxes(node);
            if(axes&&(!axis||((axes===axis||axes==="both")&&(axis==="x"?node.scrollWidth>node.clientWidth+1:node.scrollHeight>node.clientHeight+1)))) return {node,axes};
            node=node.parentElement;
        }
        return null;
    }
    function scrollPoint(node,clientX,clientY){
        const surface=node.closest&&node.closest("#game-content")?"legacy":node.closest&&node.closest("#game-stage")?"native":"browser";
        const display=window.FourSymbolsDisplay;
        if(display&&typeof display.clientToSurface==="function") return display.clientToSurface(surface,clientX,clientY);
        return surface==="browser"?{x:clientX,y:clientY}:null;
    }
    function releaseScrollCapture(pointer){
        const node=pointer.captureNode;
        pointer.captureNode=null;
        try{ if(node&&node.hasPointerCapture?.(pointer.pointerId)) node.releasePointerCapture(pointer.pointerId); }catch(_){ }
    }
    function beginMouseScroll(pointer,event){
        if(pointer.pointerType!=="mouse"||pointer.dragOwner||pointer.editable) return;
        const axis=Math.abs(event.clientX-pointer.startX)>=Math.abs(event.clientY-pointer.startY)?"x":"y";
        const owner=findScrollOwner(pointer.initialTarget,axis);
        const origin=owner&&scrollPoint(owner.node,pointer.startX,pointer.startY);
        if(!origin) return;
        pointer.scrollOwner=owner;
        pointer.mouseScroll={axis,origin,left:owner.node.scrollLeft,top:owner.node.scrollTop};
        pointer.state="SCROLL";
        // Capture only after the existing slop threshold. A small press remains
        // the original button activation, while a drag cannot release on a reward.
        const node=pointer.interactiveTarget;
        try{ if(node?.setPointerCapture){ node.setPointerCapture(pointer.pointerId);pointer.captureNode=node; } }catch(_){ }
    }
    function moveMouseScroll(pointer,event,preventDefault=true){
        if(pointer.state!=="SCROLL"||!pointer.mouseScroll) return;
        const node=pointer.scrollOwner.node,scroll=pointer.mouseScroll;
        if(node.isConnected===false||pointer.initialTarget.isConnected===false){ pointer.state="CANCEL";releaseScrollCapture(pointer);return; }
        const current=scrollPoint(node,event.clientX,event.clientY);
        if(!current){ pointer.state="CANCEL";releaseScrollCapture(pointer);return; }
        if(scroll.axis==="x") node.scrollLeft=Math.max(0,Math.min(node.scrollWidth-node.clientWidth,scroll.left+scroll.origin.x-current.x));
        else node.scrollTop=Math.max(0,Math.min(node.scrollHeight-node.clientHeight,scroll.top+scroll.origin.y-current.y));
        if(preventDefault&&event.cancelable) event.preventDefault();
    }
    function retireMouseScroll(pointer,held=false){
        const node=pointer.interactiveTarget;
        if(!pointer.mouseScroll||pointer.retiredGuard||node?.isConnected===false||!node?.addEventListener) return;
        // A connected surface can be unregistered before the browser emits the
        // release click. The completion lifetime starts on physical release,
        // never while the user is still holding the button.
        let timer;
        const cleanup=()=>{clearTimeout(timer);node.removeEventListener('click',guard,true);node.removeEventListener('pointerdown',cleanup,true);if(retiringMousePointers.get(pointer.pointerId)?.pointer===pointer)retiringMousePointers.delete(pointer.pointerId);retiringClickGuards.delete(cleanup);pointer.retiredGuard=null;};
        const finish=()=>{retiringMousePointers.delete(pointer.pointerId);if(pointer.retiredGuard)timer=setTimeout(cleanup,CLICK_LIFETIME_MS);};
        const guard=event=>{if(event.detail===0)return;if(Number.isFinite(event.pointerId)&&event.pointerId>=0&&event.pointerId!==pointer.pointerId)return;event.preventDefault();event.stopImmediatePropagation();cleanup();};
        pointer.retiredGuard=cleanup;retiringClickGuards.add(cleanup);
        node.addEventListener('click',guard,true);node.addEventListener('pointerdown',cleanup,true);
        if(held)retiringMousePointers.set(pointer.pointerId,{pointer,finish,cleanup});else finish();
    }
    function interactiveTarget(target){ return target&&target.closest&&target.closest("button,a,[role=button],input,select,textarea,[data-action],[onclick]"); }
    function pruneGestures(){
        const now=Date.now();
        for(const [id,pointer] of completedPointers){
            if(now-pointer.finishedAt>CLICK_LIFETIME_MS||pointer.interactiveTarget.isConnected===false){ completedPointers.delete(id); }
        }
        if(legacyClickGesture&&!completedPointers.has(legacyClickGesture.pointerId)){ legacyClickGesture=null; }
    }
    function rememberCompletion(pointer){
        pointer.finishedAt=Date.now();
        completedPointers.set(pointer.pointerId,pointer);
        legacyClickGesture=pointer;
    }
    function consumeSuppression(event){
        pruneGestures();
        // Keyboard/assistive/programmatic activation is not a pointer gesture.
        if(event.detail===0){ return false; }
        const hasPointerId=Number.isFinite(event.pointerId)&&event.pointerId>=0;
        const pointer=hasPointerId?completedPointers.get(event.pointerId):legacyClickGesture;
        if(!pointer){ return false; }
        // A legacy MouseEvent cannot identify an old touch after a new down.
        if(!hasPointerId&&activePointers.size){ return false; }
        const target=interactiveTarget(event.target)||event.target;
        const initial=pointer.interactiveTarget;
        if(initial!==target&&!(initial.contains&&initial.contains(target))&&!(target.contains&&target.contains(initial))){ return false; }
        completedPointers.delete(pointer.pointerId);
        if(legacyClickGesture===pointer){ legacyClickGesture=null; }
        return pointer.state!=="TAP";
    }
    function classify(pointer,event){
        const distance=Math.hypot(event.clientX-pointer.startX,event.clientY-pointer.startY);
        pointer.currentX=event.clientX; pointer.currentY=event.clientY; pointer.distance=distance;
        if(distance<TAP_SLOP_CSS_PX||pointer.state!=="TAP") return;
        pointer.state=pointer.dragOwner?"DRAG":pointer.scrollOwner?"SCROLL":"CANCEL";
        beginMouseScroll(pointer,event);
    }
    document.addEventListener("pointerdown",function(event){
        retiringMousePointers.get(event.pointerId)?.cleanup();
        if(event.pointerType==="touch"&&activePointers.size&&!isGameSurfaceTarget(event.target)){
            for(const pointer of activePointers.values()){ pointer.state="CANCEL"; }
        }
        if(!isGameSurfaceTarget(event.target)||(event.pointerType==="mouse"&&event.button!==0)) return;
        pruneGestures();
        legacyClickGesture=null;
        completedPointers.delete(event.pointerId);
        const initial=interactiveTarget(event.target)||event.target;
        activePointers.set(event.pointerId,{pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,currentX:event.clientX,currentY:event.clientY,distance:0,initialTarget:event.target,surface:managedSurfaceFor(event.target),interactiveTarget:initial,scrollOwner:findScrollOwner(event.target),dragOwner:event.target.closest&&event.target.closest("[data-drag-owner],#battleElementBoxButton,#v141TaskTracker"),pointerType:event.pointerType,editable:isEditableGameControl(event.target)||!!event.target.closest?.('select,[role="slider"],canvas,.status-btn'),state:"TAP"});
        if(activePointers.size>1){ for(const pointer of activePointers.values()){ pointer.state="CANCEL";releaseScrollCapture(pointer); } }
    },{capture:true,passive:true});
    document.addEventListener("pointermove",function(event){ const pointer=activePointers.get(event.pointerId); if(pointer){ if(pointer.mouseScroll&&Number.isFinite(event.buttons)&&(event.buttons&1)===0){cancelPointer(event);return;}classify(pointer,event);moveMouseScroll(pointer,event); } },{capture:true,passive:false});
    function finishPointer(event){ retiringMousePointers.get(event.pointerId)?.finish();const pointer=activePointers.get(event.pointerId); if(!pointer) return; classify(pointer,event);moveMouseScroll(pointer,event,false);activePointers.delete(event.pointerId); rememberCompletion(pointer);releaseScrollCapture(pointer); }
    document.addEventListener("pointerup",finishPointer,{capture:true,passive:true});
    function cancelPointer(event){ if(event.type!=="lostpointercapture")retiringMousePointers.get(event.pointerId)?.finish();const pointer=activePointers.get(event.pointerId); if(pointer){ pointer.state="CANCEL"; activePointers.delete(event.pointerId); rememberCompletion(pointer);releaseScrollCapture(pointer); } }
    document.addEventListener("pointercancel",cancelPointer,{capture:true,passive:true});
    document.addEventListener("lostpointercapture",cancelPointer,{capture:true,passive:true});
    function handleSuppressedGestureClick(event){ if(consumeSuppression(event)){ event.preventDefault(); event.stopImmediatePropagation(); } }
    function registerSurface(surface){
        if(!surface||typeof surface.addEventListener!=="function"){ return false; }
        if(managedSurfaces.has(surface)){ return true; }
        const leave=event=>{ if(event.target===surface){ cancelPointer(event); } };
        surface.addEventListener("click",handleSuppressedGestureClick,true);
        surface.addEventListener("pointerleave",leave,true);
        managedSurfaces.set(surface,{leave});
        return true;
    }
    function unregisterSurface(surface){
        const entry=surface&&managedSurfaces.get(surface);
        if(!entry){ return false; }
        surface.removeEventListener?.("click",handleSuppressedGestureClick,true);
        surface.removeEventListener?.("pointerleave",entry.leave,true);
        managedSurfaces.delete(surface);
        const belongs=pointer=>pointer.surface===surface||surface.contains?.(pointer.initialTarget);
        for(const [id,pointer] of activePointers){ if(belongs(pointer)){ retireMouseScroll(pointer,true);activePointers.delete(id);releaseScrollCapture(pointer); } }
        for(const [id,pointer] of completedPointers){ if(belongs(pointer)){ retireMouseScroll(pointer);completedPointers.delete(id); } }
        if(legacyClickGesture&&belongs(legacyClickGesture)){ legacyClickGesture=null; }
        return true;
    }
    for(const surface of [document.getElementById("game-stage"),document.getElementById("game-ui")]){
        registerSurface(surface);
    }
    function resetGestures(){
        const pointers=[...activePointers.values()];activePointers.clear();completedPointers.clear();legacyClickGesture=null;
        for(const pointer of pointers){ if(pointer.mouseScroll){pointer.state="CANCEL";retireMouseScroll(pointer,true);}releaseScrollCapture(pointer); }
    }
    window.addEventListener("blur",resetGestures);
    window.addEventListener("pagehide",()=>{resetGestures();for(const cleanup of [...retiringClickGuards])cleanup();});
    window.addEventListener("resize",resetGestures);
    document.addEventListener("visibilitychange",function(){ if(document.hidden){ resetGestures(); } });

    /* Pinch is the sole touchmove cancellation. Single-finger panning is
       deliberately left to the browser and the Scroll Owner CSS contract. */
    document.addEventListener("touchmove",function(event){ if(isGameSurfaceTarget(event.target)&&event.touches&&event.touches.length>1){ for(const pointer of activePointers.values()){ pointer.state="CANCEL"; } event.preventDefault(); } },{passive:false});
    document.addEventListener("contextmenu",function(event){ if(isGameSurfaceTarget(event.target)&&!isEditableGameControl(event.target)) event.preventDefault(); },{capture:true});
    document.addEventListener("dragstart",function(event){ if(isGameSurfaceTarget(event.target)&&!isEditableGameControl(event.target)) event.preventDefault(); },{capture:true});
    document.addEventListener("selectstart",function(event){ if(isGameSurfaceTarget(event.target)&&!isEditableGameControl(event.target)) event.preventDefault(); },{capture:true});
    document.addEventListener("wheel",function(event){ if(event.ctrlKey&&isGameSurfaceTarget(event.target)) event.preventDefault(); },{capture:true,passive:false});
    ["gesturestart","gesturechange"].forEach(name=>window.addEventListener(name,function(event){ if(isGameSurfaceTarget(event.target)) event.preventDefault(); },{passive:false}));
    window.FourSymbolsGestureArbiter=Object.freeze({TAP_SLOP_CSS_PX,findScrollOwner,registerSurface,unregisterSurface,getState:pointerId=>activePointers.get(pointerId)||null});
})();
