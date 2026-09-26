/* =====================================================
   Battle Floating Feedback Owner
   - Single DOM/geometry/queue/typography owner for transient battle feedback.
   - V143 remains impact-timing owner.
   - Fixed Slot adapter remains the only battlefield geometry owner.
===================================================== */
(function installBattleFloatingFeedbackOwner(){
    "use strict";
    if(typeof window==="undefined"||window.__battleFloatingFeedbackOwnerInstalled){ return; }
    window.__battleFloatingFeedbackOwnerInstalled=true;

    const contexts=new Map();
    let sequence=0;

    function number(value,fallback){
        const parsed=Number(value);
        return Number.isFinite(parsed)?parsed:(fallback||0);
    }
    function battleTokenValue(){
        try{ return typeof battleToken!=="undefined"?battleToken:null; }catch(_){ return null; }
    }
    function geometryOwner(){ return window.FourSymbolsBattlefieldRenderGeometry||null; }
    function unitKey(side,index){ return (side==="monster"?"monster":"player")+":"+String(Number(index)||0); }
    function identifyUnit(element){
        if(!element){ return null; }
        const id=String(element.id||"");
        let match=/^battleMonster(\d+)$/.exec(id);
        if(match){ return {side:"monster",index:Number(match[1])}; }
        match=/^battlePlayerCard(\d+)$/.exec(id);
        if(match){ return {side:"player",index:Number(match[1])}; }
        if(typeof element.closest==="function"){
            const unit=element.closest('[id^="battleMonster"],[id^="battlePlayerCard"]');
            if(unit&&unit!==element){ return identifyUnit(unit); }
        }
        return null;
    }
    function currentGeometry(side,index){
        const owner=geometryOwner();
        if(owner&&typeof owner.getUnitGeometry==="function"){
            const geometry=owner.getUnitGeometry(side,index);
            if(geometry){ return geometry; }
        }
        const element=document.getElementById(side==="monster"?"battleMonster"+index:"battlePlayerCard"+index);
        if(!element||typeof element.getBoundingClientRect!=="function"){ return null; }
        const rect=element.getBoundingClientRect();
        const top=Number(rect.top)||0,left=Number(rect.left)||0;
        const width=Math.max(0,Number(rect.width)||0),height=Math.max(0,Number(rect.height)||0);
        const bottom=top+height,right=left+width;
        const feedbackTop=top+6,feedbackBottom=Math.max(feedbackTop+24,bottom-34);
        return {
            side:side,index:index,
            unitRect:{left:left,top:top,right:right,bottom:bottom,width:width,height:height},
            hudSafeRect:{left:left,top:feedbackBottom+8,right:right,bottom:bottom,width:width,height:Math.max(0,bottom-feedbackBottom-8)},
            feedbackSafeRect:{left:left+4,top:feedbackTop,right:right-4,bottom:feedbackBottom,width:Math.max(0,width-8),height:Math.max(0,feedbackBottom-feedbackTop)},
            feedbackAnchor:{x:left+width/2,y:feedbackBottom-12}
        };
    }
    function clearContext(context){
        if(!context){ return; }
        context.active.forEach(entry=>{
            clearTimeout(entry.timer);
            if(entry.node&&entry.node.parentNode){ entry.node.remove(); }
        });
        context.active.clear();
        context.queue.length=0;
    }
    function contextFor(side,index){
        const key=unitKey(side,index);
        const token=battleTokenValue();
        let context=contexts.get(key);
        if(context&&context.token!==token){
            clearContext(context);
            contexts.delete(key);
            context=null;
        }
        if(!context){
            context={key:key,side:side,index:index,token:token,active:new Map(),queue:[]};
            contexts.set(key,context);
        }
        return context;
    }
    function semanticClass(kind){
        const value=String(kind||"damage").toLowerCase();
        if(value==="heal"||value==="hp-recovery"){ return "heal"; }
        if(value==="sp"||value==="sp-recovery"){ return "sp"; }
        if(value==="shield"){ return "shield"; }
        if(value==="miss"||value==="resist"){ return value; }
        if(value==="status"||value==="buff"||value==="debuff"||value==="escape"){ return value; }
        return "damage";
    }
    function laneContract(geometry){
        const safe=geometry&&geometry.feedbackSafeRect;
        const height=Math.max(24,number(safe&&safe.height,72));
        const spacing=Math.max(30,Math.min(36,height/2.15));
        const laneCount=Math.max(1,Math.min(4,Math.floor((height+6)/spacing)));
        return {safe:safe,spacing:spacing,laneCount:laneCount};
    }
    function freeLane(context,laneCount){
        const used=new Set(Array.from(context.active.values()).map(entry=>entry.lane));
        for(let lane=0;lane<laneCount;lane++){ if(!used.has(lane)){ return lane; } }
        return -1;
    }
    function removeEntry(context,id){
        const entry=context&&context.active.get(id);
        if(!entry){ return; }
        clearTimeout(entry.timer);
        if(entry.node&&entry.node.parentNode){ entry.node.remove(); }
        context.active.delete(id);
        drain(context);
        if(!context.active.size&&!context.queue.length){ contexts.delete(context.key); }
    }
    function spawn(context,options){
        const geometry=currentGeometry(context.side,context.index);
        if(!geometry||!geometry.unitRect){ return null; }
        const contract=laneContract(geometry);
        const lane=freeLane(context,contract.laneCount);
        if(lane<0){ return null; }

        const duration=Math.max(520,Math.min(2200,number(options.duration,1050)));
        const safe=contract.safe||geometry.unitRect;
        const anchor=geometry.feedbackAnchor||{
            x:geometry.unitRect.left+geometry.unitRect.width/2,
            y:safe.bottom-12
        };
        const minY=number(safe.top,geometry.unitRect.top)+11;
        const maxY=Math.max(minY,number(safe.bottom,geometry.unitRect.bottom)-11);
        const y=Math.max(minY,Math.min(maxY,number(anchor.y,maxY)-lane*contract.spacing));
        const node=document.createElement("div");
        const kind=semanticClass(options.kind);
        node.className="battle-floating-feedback battle-floating-feedback-"+kind+(options.critical?" is-critical":"");
        node.dataset.feedbackOwner="battle-floating-feedback";
        node.dataset.feedbackSide=context.side;
        node.dataset.feedbackIndex=String(context.index);
        node.dataset.feedbackLane=String(lane);
        node.dataset.feedbackKind=kind;
        node.dataset.feedbackSequence=String(sequence+1);
        if(options.source){ node.dataset.feedbackSource=String(options.source); }
        node.textContent=String(options.text==null?"":options.text);
        node.style.setProperty("--battle-feedback-x",number(anchor.x,geometry.unitRect.left+geometry.unitRect.width/2)+"px");
        node.style.setProperty("--battle-feedback-y",y+"px");
        node.style.setProperty("--battle-feedback-duration",duration+"ms");
        document.body.appendChild(node);

        const id=++sequence;
        const timer=setTimeout(()=>removeEntry(context,id),duration+80);
        context.active.set(id,{id:id,node:node,lane:lane,timer:timer});
        return node;
    }
    function drain(context){
        if(!context||!context.queue.length){ return; }
        let guard=0;
        while(context.queue.length&&guard++<8){
            const next=context.queue[0];
            const node=spawn(context,next);
            if(!node){ break; }
            context.queue.shift();
        }
    }
    function emit(options){
        if(typeof document==="undefined"||!document.body){ return null; }
        options=options||{};
        const side=options.side==="monster"?"monster":"player";
        const parsedIndex=Number(options.index);
        const index=Number.isInteger(parsedIndex)?parsedIndex:0;
        const context=contextFor(side,index);
        const node=spawn(context,options);
        if(node){ return node; }
        context.queue.push(Object.assign({},options,{side:side,index:index}));
        return null;
    }
    function emitAtImpact(options){
        options=Object.assign({},options||{});
        const side=options.side==="monster"?"monster":"player";
        const parsedIndex=Number(options.index);
        const index=Number.isInteger(parsedIndex)?parsedIndex:0;
        if(typeof window.v143RunAtTargetHit==="function"){
            window.v143RunAtTargetHit(side,index,()=>emit(Object.assign({},options,{side:side,index:index})),true);
            return null;
        }
        return emit(Object.assign({},options,{side:side,index:index}));
    }
    function emitStatus(side,index,text,kind){
        return emitAtImpact({
            side:side,index:index,kind:kind||"status",text:text,duration:940,source:"status"
        });
    }
    function clear(){
        contexts.forEach(clearContext);
        contexts.clear();
        if(typeof document!=="undefined"&&document.querySelectorAll){
            document.querySelectorAll(".battle-floating-feedback").forEach(node=>node.remove());
        }
    }
    function acquireLock(owner){
        const flow=window.FourSymbolsBattleFlow;
        return flow&&typeof flow.acquirePresentationLock==="function"
            ?flow.acquirePresentationLock(owner)
            :function(){};
    }
    function playEscape(characterIndex,succeeded){
        const parsedIndex=Number(characterIndex);
        const index=Number.isInteger(parsedIndex)?parsedIndex:0;
        const card=document.getElementById("battlePlayerCard"+index);
        if(!card){ return Promise.resolve(); }
        const release=acquireLock("escape-presentation");
        const geometry=currentGeometry("player",index);
        const rect=geometry&&geometry.unitRect?geometry.unitRect:card.getBoundingClientRect();
        const overlayOwner=geometryOwner();
        const overlay=overlayOwner&&typeof overlayOwner.getBattlefieldOverlayGeometry==="function"
            ?overlayOwner.getBattlefieldOverlayGeometry()
            :null;
        const viewportBottom=overlay&&overlay.rect?overlay.rect.bottom:Math.max(number(window.innerHeight,0),number(rect.bottom,0));
        const fullDistance=Math.max(number(rect.height,0)*1.4,viewportBottom-number(rect.top,0)+number(rect.height,0)+18);
        const halfDistance=Math.max(number(rect.height,0)*.52,Math.min((viewportBottom-number(rect.top,0))*.44,number(rect.height,0)*1.05));
        const keyframes=succeeded
            ?[
                {transform:"translateY(0)",opacity:1,offset:0},
                {transform:"translateY("+Math.round(fullDistance)+"px)",opacity:.12,offset:.9},
                {transform:"translateY("+Math.round(fullDistance)+"px)",opacity:0,offset:1}
            ]
            :[
                {transform:"translateY(0)",opacity:1,offset:0},
                {transform:"translateY("+Math.round(halfDistance)+"px)",opacity:1,offset:.4},
                {transform:"translateY("+Math.round(halfDistance)+"px)",opacity:1,offset:.6},
                {transform:"translateY(0)",opacity:1,offset:1}
            ];
        const duration=succeeded?760:820;
        card.classList.add("battle-escape-presenting");
        let animation=null;
        let promise;
        if(typeof card.animate==="function"){
            animation=card.animate(keyframes,{
                duration:duration,
                easing:succeeded?"cubic-bezier(.35,.04,.7,.3)":"cubic-bezier(.25,.7,.3,1)",
                fill:"forwards"
            });
            promise=animation.finished.catch(()=>{});
        }else{
            promise=new Promise(resolve=>setTimeout(resolve,duration));
        }
        return Promise.resolve(promise).then(()=>{
            if(animation){ try{animation.cancel();}catch(_){} }
            card.classList.remove("battle-escape-presenting");
            card.style.removeProperty("transform");
            card.style.removeProperty("opacity");
            if(!succeeded){
                emit({side:"player",index:index,kind:"escape",text:"逃脫失敗",duration:760,source:"escape"});
                return new Promise(resolve=>setTimeout(resolve,540));
            }
            return null;
        }).finally(()=>{
            if(animation){ try{animation.cancel();}catch(_){} }
            card.classList.remove("battle-escape-presenting");
            card.style.removeProperty("transform");
            card.style.removeProperty("opacity");
            release();
        });
    }

    const api=Object.freeze({
        version:"battle-floating-feedback-v2",
        emit:emit,
        emitAtImpact:emitAtImpact,
        emitStatus:emitStatus,
        clear:clear,
        identifyUnit:identifyUnit,
        playEscape:playEscape,
        getContextCount:()=>contexts.size,
        getActiveSnapshot:()=>Array.from(contexts.values()).map(context=>({
            key:context.key,active:context.active.size,queued:context.queue.length,token:context.token
        }))
    });
    window.FourSymbolsBattleFloatingFeedback=api;

    function ownedShowDamagePopup(element,text,type,isCrit){
        const unit=identifyUnit(element);
        if(!unit){ return null; }
        if(isCrit&&typeof triggerCriticalImpact==="function"){ triggerCriticalImpact(element); }
        let display=String(text==null?"":text);
        if(isCrit){
            const match=display.match(/\d+(?:\.\d+)?/);
            display="爆擊 "+(match?match[0]:display);
        }
        return emitAtImpact({
            side:unit.side,index:unit.index,
            kind:type==="heal"?"heal":type==="sp"?"sp":type==="miss"?"miss":type==="shield"?"shield":"damage",
            text:display,critical:!!isCrit,source:"combat"
        });
    }

    try{ showDamagePopup=ownedShowDamagePopup; }catch(_){}
    window.showDamagePopup=ownedShowDamagePopup;
})();
