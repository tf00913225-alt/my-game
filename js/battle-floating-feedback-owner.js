/* =====================================================
   Battle Floating Feedback Owner
   - Sole DOM/queue/typography owner for transient battle text.
   - V143 owns impact timing only.
   - Fixed Slot adapter owns all unit geometry.
===================================================== */
(function installBattleFloatingFeedbackOwner(){
    "use strict";
    if(typeof window==="undefined"||window.__battleFloatingFeedbackOwnerInstalled){ return; }
    window.__battleFloatingFeedbackOwnerInstalled=true;

    const MAX_LANES=4;
    const LANE_PITCH_PX=25;
    const LANE_RENDER_HEIGHT_PX=23;
    const LANE_BOTTOM_INSET_PX=6;
    const DEFAULT_DURATION=980;
    const STATUS_PRESENTATION_SEMANTICS=Object.freeze({burn:Object.freeze({color:"#e32626",label:"burn"}),damageDown:Object.freeze({color:"#39c96b",label:"damageDown"}),agilityDown:Object.freeze({color:"#39c96b",label:"agilityDown"}),freeze:Object.freeze({color:"#62d9ff",label:"freeze"}),frostbite:Object.freeze({color:"#62d9ff",label:"frostbite"}),petrify:Object.freeze({color:"#d2a85c",label:"petrify"}),defenseDown:Object.freeze({color:"#d2a85c",label:"defenseDown"}),statDown:Object.freeze({color:"#d49cff",label:"statDown"}),stun:Object.freeze({color:"#ffd35a",label:"stun"}),shield:Object.freeze({color:"#f4f4f4",label:"shield"}),barrier:Object.freeze({color:"#f4f4f4",label:"barrier"}),default:Object.freeze({color:"#f4f4f4",label:"default"})});
    const contexts=new Map();
    let sequence=0;

    function numeric(value,fallback){
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
        if(!owner||typeof owner.getUnitGeometry!=="function"){ return null; }
        return owner.getUnitGeometry(side,index)||null;
    }
    function contextFor(side,index){
        const key=unitKey(side,index);
        let context=contexts.get(key);
        if(!context){
            context={key:key,side:side,index:index,active:new Map(),queue:[]};
            contexts.set(key,context);
        }
        return context;
    }
    function semanticKind(kind){
        const value=String(kind||"damage").toLowerCase();
        if(value==="heal"||value==="hp-recovery"){ return "heal"; }
        if(value==="sp"||value==="sp-recovery"){ return "sp"; }
        if(value==="shield"){ return "shield"; }
        if(value==="miss"){ return "miss"; }
        if(value==="resist"){ return "resist"; }
        if(value==="status"||value==="buff"||value==="debuff"){ return "status"; }
        if(value==="escape"||value==="escape-fail"){ return "escape"; }
        return value==="criticaldamage"||value==="critical-damage"?"criticalDamage":"damage";
    }
    function statusPresentation(statusType){ return STATUS_PRESENTATION_SEMANTICS[String(statusType||"default")]||STATUS_PRESENTATION_SEMANTICS.default; }
    function phaseOrder(kind){ return kind==="shield"?10:(kind==="status"?30:20); }
    function compareRequests(left,right){ return left.impactId&&right.impactId&&left.impactId===right.impactId ? (left.phaseOrder-right.phaseOrder)||(left.id-right.id) : left.id-right.id; }
    function timingFor(options){
        if(options&&options.skipImpactTiming){ return {delayMs:0,critical:false,impactId:null,impactAt:0,sequence:0}; }
        const resolver=window.v143ResolveBattleFeedbackTiming;
        if(typeof resolver!=="function"){ return {delayMs:0,critical:false,impactId:null,impactAt:0,sequence:0}; }
        try{
            const timing=resolver(options.side==="monster"?"monster":"player",Number(options.index)||0,semanticKind(options.kind))||{};
            return {delayMs:Math.max(0,numeric(timing.delayMs,0)),critical:timing.critical===true,impactId:timing.impactId||null,impactAt:Number.isFinite(Number(timing.impactAt))?Number(timing.impactAt):0,sequence:numeric(timing.sequence,0)};
        }catch(_){ return {delayMs:0,critical:false,impactId:null,impactAt:0,sequence:0}; }
    }
    function makeHandle(request){
        let resolvePromise;
        const promise=new Promise(resolve=>{ resolvePromise=resolve; });
        request.resolve=resolvePromise;
        request.cancelled=false;
        return Object.freeze({
            id:request.id,
            promise:promise,
            cancel:function(){ cancelRequest(request); }
        });
    }
    function finishRequest(request,reason){
        if(!request||request.finished){ return; }
        request.finished=true;
        if(request.delayTimer){ clearTimeout(request.delayTimer); request.delayTimer=null; }
        if(request.removeTimer){ clearTimeout(request.removeTimer); request.removeTimer=null; }
        if(request.node&&request.node.parentNode){ request.node.remove(); }
        if(typeof request.resolve==="function"){ request.resolve(reason||"done"); }
    }
    function cancelRequest(request){
        if(!request||request.finished){ return; }
        request.cancelled=true;
        const context=request.context;
        if(context){
            context.queue=context.queue.filter(item=>item!==request);
            if(context.active.has(request.id)){ context.active.delete(request.id); }
        }
        finishRequest(request,"cancelled");
        if(context){ pump(context); }
    }
    function laneMetrics(context){
        const geometry=currentGeometry(context.side,context.index);
        if(!geometry||!geometry.feedbackSafeRect){ return null; }
        const safe=geometry.feedbackSafeRect;
        const anchor=geometry.feedbackAnchor||{
            x:safe.left+safe.width/2,
            y:safe.bottom-LANE_BOTTOM_INSET_PX
        };
        const baseline=Math.min(
            numeric(anchor.y,safe.bottom-LANE_BOTTOM_INSET_PX),
            safe.bottom-LANE_BOTTOM_INSET_PX
        );
        const upwardRoom=Math.max(0,baseline-safe.top-LANE_RENDER_HEIGHT_PX);
        const capacity=Math.max(1,Math.min(
            MAX_LANES,
            Math.floor(upwardRoom/LANE_PITCH_PX)+1
        ));
        return {geometry:geometry,safe:safe,anchor:anchor,baseline:baseline,capacity:capacity};
    }
    function freeLane(context,metrics){
        const resolved=metrics||laneMetrics(context);
        if(!resolved){ return -1; }
        const used=new Set(Array.from(context.active.values()).map(request=>request.lane));
        for(let lane=0;lane<resolved.capacity;lane++){ if(!used.has(lane)){ return lane; } }
        return -1;
    }
    function formatCritical(text){
        const value=String(text==null?"":text);
        if(/^爆擊\s/.test(value)){ return value; }
        const match=value.match(/\d+(?:\.\d+)?/);
        return "爆擊 "+(match?match[0]:value);
    }
    function spawn(context,request,lane){
        if(request.cancelled||request.finished){ return false; }
        const metrics=laneMetrics(context);
        if(!metrics||!metrics.geometry.unitRect){
            finishRequest(request,"missing-geometry");
            return false;
        }
        const anchor=metrics.anchor;
        const laneY=metrics.baseline-lane*LANE_PITCH_PX;
        const critical=request.critical===true;
        const node=document.createElement("div");
        node.className="battle-floating-feedback battle-floating-feedback-"+request.kind+(critical?" is-critical":"")+(request.kind==="status"?" is-status-capsule":"");
        node.dataset.feedbackOwner="battle-floating-feedback";
        node.dataset.feedbackSide=context.side;
        node.dataset.feedbackIndex=String(context.index);
        node.dataset.feedbackLane=String(lane);
        node.dataset.feedbackKind=request.kind;
        node.dataset.feedbackSource=request.source;
        node.dataset.feedbackSequence=String(request.id);
        node.dataset.feedbackPhase=request.phase;
        if(request.statusType){ node.dataset.feedbackStatusType=request.statusType; node.style.setProperty("--battle-feedback-status-color",statusPresentation(request.statusType).color); }
        node.textContent=critical?formatCritical(request.text):String(request.text==null?"":request.text);
        node.style.setProperty("--battle-feedback-x",anchor.x+"px");
        node.style.setProperty("--battle-feedback-y",laneY+"px");
        node.style.setProperty("--battle-feedback-duration",request.duration+"ms");
        document.body.appendChild(node);
        request.node=node;
        request.lane=lane;
        request.context=context;
        context.active.set(request.id,request);
        request.removeTimer=setTimeout(()=>{
            context.active.delete(request.id);
            finishRequest(request,"done");
            pump(context);
        },request.duration+70);
        return true;
    }
    function pump(context){
        if(!context){ return; }
        while(context.queue.length){
            const metrics=laneMetrics(context);
            const lane=freeLane(context,metrics);
            if(lane<0){ break; }
            const request=context.queue.shift();
            if(!request||request.cancelled||request.finished){ continue; }
            if(!spawn(context,request,lane)){ continue; }
        }
        if(!context.active.size&&!context.queue.length){ contexts.delete(context.key); }
    }
    function enqueue(request){
        if(request.cancelled||request.finished){ return; }
        const context=contextFor(request.side,request.index);
        request.context=context;
        context.queue.push(request);
        context.queue.sort(compareRequests);
        queueMicrotask(()=>pump(context));
    }
    function emit(options){
        if(typeof document==="undefined"||!document.body){ return null; }
        const input=Object.assign({},options||{});
        const kind=semanticKind(input.kind);
        const timing=timingFor(input);
        const request={
            id:++sequence,side:input.side==="monster"?"monster":"player",
            index:Number.isInteger(Number(input.index))?Number(input.index):0,kind:kind,
            statusType:kind==="status"?String(input.statusType||input.effectType||"default"):null,
            text:String(input.text==null?"":input.text),
            duration:Math.max(500,Math.min(1800,numeric(input.duration,DEFAULT_DURATION))),
            critical:input.critical===true,source:String(input.source||"battle"),
            impactId:input.impactId||timing.impactId||null,impactAt:timing.impactAt||0,
            phase:String(input.phase||(kind==="status"?"status":"impact")),
            phaseOrder:Number.isFinite(Number(input.phaseOrder))?Number(input.phaseOrder):phaseOrder(kind),
            timingSequence:timing.sequence||0
        };
        request.critical=request.critical||timing.critical;
        const handle=makeHandle(request);
        if(timing.delayMs>8){
            request.delayTimer=setTimeout(()=>{ request.delayTimer=null;enqueue(request); },timing.delayMs);
        }else{
            enqueue(request);
        }
        return handle;
    }
    function emitAtImpact(options){ return emit(options); }
    function emitStatus(side,index,text,options){
        return emit(Object.assign({},options||{},{
            side:side,index:index,kind:"status",text:text,source:"status"
        }));
    }
    function emitEscapeFailure(index){
        return emit({
            side:"player",index:Number(index)||0,kind:"escape",text:"逃脫失敗",
            source:"escape",skipImpactTiming:true,duration:760
        });
    }
    function clear(){
        Array.from(contexts.values()).forEach(context=>{
            context.queue.slice().forEach(request=>finishRequest(request,"teardown"));
            Array.from(context.active.values()).forEach(request=>finishRequest(request,"teardown"));
            context.queue=[];
            context.active.clear();
        });
        contexts.clear();
        document.querySelectorAll&&document.querySelectorAll(".battle-floating-feedback").forEach(node=>node.remove());
    }
    function debugSnapshot(){
        return Array.from(contexts.values()).map(context=>{
            const metrics=laneMetrics(context);
            return {
                key:context.key,
                capacity:metrics?metrics.capacity:0,
                active:Array.from(context.active.values()).map(request=>({id:request.id,lane:request.lane,kind:request.kind})),
                queued:context.queue.map(request=>({id:request.id,kind:request.kind}))
            };
        });
    }

    const api=Object.freeze({
        version:"battle-floating-feedback-v2",
        emit:emit,
        emitAtImpact:emitAtImpact,
        emitStatus:emitStatus,
        emitEscapeFailure:emitEscapeFailure,
        clear:clear,
        identifyUnit:identifyUnit,
        getContextCount:()=>contexts.size,
        debugSnapshot:debugSnapshot
    });
    window.FourSymbolsBattleFloatingFeedback=api;

    /* Legacy callers keep their function name, but the sole implementation is
       this owner. No caller may create/position a second popup DOM node. */
    function ownedShowDamagePopup(element,text,type,isCrit){
        const unit=identifyUnit(element);
        if(!unit){ return null; }
        if(isCrit&&typeof triggerCriticalImpact==="function"){ triggerCriticalImpact(element); }
        return emit({
            side:unit.side,index:unit.index,
            kind:type==="heal"?"heal":type==="sp"?"sp":type==="miss"?"miss":type==="shield"?"shield":"damage",
            text:text,critical:!!isCrit,source:"legacy-entry"
        });
    }
    try{ showDamagePopup=ownedShowDamagePopup; }catch(_){}
    window.showDamagePopup=ownedShowDamagePopup;
})();
