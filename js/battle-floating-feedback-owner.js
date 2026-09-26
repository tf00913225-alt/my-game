/* =====================================================
   Battle Floating Feedback Owner
   - Single DOM/geometry/queue owner for battle popup feedback.
   - V143 remains timing owner; Fixed Slot adapter remains geometry owner.
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
        return {
            side:side,index:index,unitRect:rect,portraitRect:rect,
            hudSafeRect:{left:rect.left,top:rect.top+rect.height*.72,right:rect.right,bottom:rect.bottom,width:rect.width,height:rect.height*.28},
            feedbackAnchor:{x:rect.left+rect.width/2,y:rect.top+rect.height*.45}
        };
    }
    function contextFor(side,index){
        const key=unitKey(side,index);
        let context=contexts.get(key);
        if(!context){ context={key:key,active:new Map()};contexts.set(key,context); }
        return context;
    }
    function nextLane(context){
        const used=new Set(Array.from(context.active.values()).map(entry=>entry.lane));
        for(let lane=0;lane<6;lane++){ if(!used.has(lane)){ return lane; } }
        return Math.max(0,context.active.size);
    }
    function semanticClass(kind){
        const value=String(kind||"damage").toLowerCase();
        if(value==="heal"||value==="hp-recovery"){ return "heal"; }
        if(value==="sp"||value==="sp-recovery"){ return "sp"; }
        if(value==="shield"){ return "shield"; }
        if(value==="miss"||value==="resist"){ return "miss"; }
        if(value==="status"||value==="buff"||value==="debuff"||value==="escape"){ return value; }
        return "damage";
    }
    function emit(options){
        if(typeof document==="undefined"||!document.body){ return null; }
        options=options||{};
        const side=options.side==="monster"?"monster":"player";
        const index=Number.isInteger(Number(options.index))?Number(options.index):0;
        const geometry=currentGeometry(side,index);
        if(!geometry||!geometry.unitRect){ return null; }
        const context=contextFor(side,index);
        const lane=nextLane(context);
        const duration=Math.max(500,Math.min(2200,number(options.duration,1100)));
        const rect=geometry.unitRect;
        const anchor=geometry.feedbackAnchor||{x:rect.left+rect.width/2,y:rect.top+rect.height*.45};
        const hudTop=geometry.hudSafeRect&&Number.isFinite(geometry.hudSafeRect.top)?geometry.hudSafeRect.top:rect.bottom;
        const spacing=Math.max(20,Math.min(30,rect.height*.17));
        const baseY=Math.min(anchor.y,hudTop-14);
        const node=document.createElement("div");
        const kind=semanticClass(options.kind);
        node.className="battle-floating-feedback battle-floating-feedback-"+kind+(options.critical?" is-critical":"");
        node.dataset.feedbackOwner="battle-floating-feedback";
        node.dataset.feedbackSide=side;
        node.dataset.feedbackIndex=String(index);
        node.dataset.feedbackLane=String(lane);
        node.dataset.feedbackKind=kind;
        node.textContent=String(options.text==null?"":options.text);
        node.style.setProperty("--battle-feedback-x",anchor.x+"px");
        node.style.setProperty("--battle-feedback-y",(baseY-lane*spacing)+"px");
        node.style.setProperty("--battle-feedback-duration",duration+"ms");
        document.body.appendChild(node);
        const id=++sequence;
        const timer=setTimeout(()=>{
            context.active.delete(id);
            if(node.parentNode){ node.remove(); }
            if(!context.active.size){ contexts.delete(context.key); }
        },duration+80);
        context.active.set(id,{id:id,node:node,lane:lane,timer:timer});
        return node;
    }
    function emitAtImpact(options){
        options=Object.assign({},options||{});
        const side=options.side==="monster"?"monster":"player";
        const index=Number.isInteger(Number(options.index))?Number(options.index):0;
        if(typeof window.v143RunAtTargetHit==="function"){
            window.v143RunAtTargetHit(side,index,()=>emit(options),true);
            return null;
        }
        return emit(options);
    }
    function clear(){
        contexts.forEach(context=>context.active.forEach(entry=>{
            clearTimeout(entry.timer);
            if(entry.node&&entry.node.parentNode){ entry.node.remove(); }
        }));
        contexts.clear();
        document.querySelectorAll&&document.querySelectorAll(".battle-floating-feedback").forEach(node=>node.remove());
    }
    function acquireLock(owner){
        const flow=window.FourSymbolsBattleFlow;
        return flow&&typeof flow.acquirePresentationLock==="function"
            ?flow.acquirePresentationLock(owner)
            :function(){};
    }
    function playEscape(characterIndex,succeeded){
        const index=Number.isInteger(Number(characterIndex))?Number(characterIndex):0;
        const card=document.getElementById("battlePlayerCard"+index);
        if(!card){ return Promise.resolve(); }
        const release=acquireLock("escape-presentation");
        const rect=card.getBoundingClientRect();
        const fullDistance=Math.max(window.innerHeight-rect.top+rect.height,rect.height*2.2);
        const halfDistance=Math.max(rect.height*.9,Math.min(window.innerHeight*.28,rect.height*1.8));
        const keyframes=succeeded
            ?[
                {transform:"translateY(0)",opacity:1,offset:0},
                {transform:"translateY("+Math.round(fullDistance)+"px)",opacity:.15,offset:.9},
                {transform:"translateY("+Math.round(fullDistance)+"px)",opacity:0,offset:1}
            ]
            :[
                {transform:"translateY(0)",opacity:1,offset:0},
                {transform:"translateY("+Math.round(halfDistance)+"px)",opacity:1,offset:.42},
                {transform:"translateY("+Math.round(halfDistance)+"px)",opacity:1,offset:.62},
                {transform:"translateY(0)",opacity:1,offset:1}
            ];
        const duration=succeeded?760:820;
        const finish=()=>{
            card.classList.remove("battle-escape-presenting");
            card.style.removeProperty("transform");
            card.style.removeProperty("opacity");
            if(!succeeded){
                emit({side:"player",index:index,kind:"escape",text:"逃脫失敗",duration:760});
                return new Promise(resolve=>setTimeout(resolve,520));
            }
            return Promise.resolve();
        };
        card.classList.add("battle-escape-presenting");
        let promise;
        if(typeof card.animate==="function"){
            const animation=card.animate(keyframes,{duration:duration,easing:succeeded?"cubic-bezier(.35,.04,.7,.3)":"cubic-bezier(.25,.7,.3,1)",fill:"none"});
            promise=animation.finished.catch(()=>{});
        }else{
            promise=new Promise(resolve=>setTimeout(resolve,duration));
        }
        return Promise.resolve(promise).then(finish).finally(release);
    }

    const api=Object.freeze({
        version:"battle-floating-feedback-v1",
        emit:emit,
        emitAtImpact:emitAtImpact,
        clear:clear,
        identifyUnit:identifyUnit,
        playEscape:playEscape,
        getContextCount:()=>contexts.size
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
            text:display,critical:!!isCrit,source:"legacy-entry"
        });
    }

    try{ showDamagePopup=ownedShowDamagePopup; }catch(_){}
    window.showDamagePopup=ownedShowDamagePopup;
})();