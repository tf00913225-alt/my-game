/* Global visible-page Screen Wake Lock lifecycle. This runtime never blocks startup. */
(function installScreenWakeLock(global){
    "use strict";
    const doc=global&&global.document;
    if(!global||!doc||global.FourSymbolsScreenWakeLock){ return; }

    const RETRY_DELAYS_MS=Object.freeze([1200,4000]);
    let sentinel=null;
    let requestInFlight=null;
    let requestGeneration=0;
    let retryTimer=null;
    let retryAttempt=0;
    const diagnostics={
        supported:false,
        held:false,
        status:"initializing",
        lastFailureReason:null,
        lastAcquireReason:null,
        lastReleaseReason:null,
        retryAttempt:0
    };

    function supported(){
        return !!(global.navigator&&global.navigator.wakeLock&&typeof global.navigator.wakeLock.request==="function");
    }

    function syncDiagnostics(status){
        diagnostics.supported=supported();
        diagnostics.held=!!(sentinel&&!sentinel.released);
        if(status){ diagnostics.status=status; }
        diagnostics.retryAttempt=retryAttempt;
    }

    function cancelRetry(resetAttempt){
        if(retryTimer!==null){
            global.clearTimeout(retryTimer);
            retryTimer=null;
        }
        if(resetAttempt){ retryAttempt=0; }
        syncDiagnostics();
    }

    function scheduleRetry(reason){
        if(!supported()||doc.visibilityState!=="visible"||retryTimer!==null||retryAttempt>=RETRY_DELAYS_MS.length){
            syncDiagnostics(retryAttempt>=RETRY_DELAYS_MS.length?"retry-exhausted":diagnostics.status);
            return false;
        }
        const delay=RETRY_DELAYS_MS[retryAttempt++];
        diagnostics.lastFailureReason=String(reason||"request-failed");
        syncDiagnostics("retry-scheduled");
        retryTimer=global.setTimeout(()=>{
            retryTimer=null;
            if(doc.visibilityState==="visible"&&!diagnostics.held){
                void acquire("retry-"+retryAttempt);
            }
        },delay);
        return true;
    }

    async function releaseSentinel(target){
        if(target&&!target.released&&typeof target.release==="function"){
            try{ await target.release(); }catch(_){ }
        }
    }

    async function acquire(reason){
        const acquireReason=String(reason||"manual");
        diagnostics.supported=supported();
        diagnostics.lastAcquireReason=acquireReason;
        if(!diagnostics.supported){
            syncDiagnostics("unsupported");
            return false;
        }
        if(doc.visibilityState!=="visible"){
            syncDiagnostics("hidden");
            return false;
        }
        if(sentinel&&!sentinel.released){
            syncDiagnostics("held");
            return true;
        }
        if(requestInFlight){
            const pending=requestInFlight;
            const acquired=await pending.promise;
            if(!acquired&&doc.visibilityState==="visible"&&requestGeneration!==pending.generation){
                return acquire(acquireReason+"-generation-refresh");
            }
            return acquired;
        }

        const flight={generation:requestGeneration,promise:null};
        syncDiagnostics("requesting");
        flight.promise=(async()=>{
            try{
                const next=await global.navigator.wakeLock.request("screen");
                if(flight.generation!==requestGeneration||doc.visibilityState!=="visible"){
                    await releaseSentinel(next);
                    syncDiagnostics("stale-request-released");
                    return false;
                }
                sentinel=next;
                cancelRetry(true);
                diagnostics.lastFailureReason=null;
                syncDiagnostics("held");
                if(next&&typeof next.addEventListener==="function"){
                    const acquiredGeneration=flight.generation;
                    next.addEventListener("release",()=>{
                        const wasCurrent=sentinel===next;
                        if(wasCurrent){ sentinel=null; }
                        syncDiagnostics("system-released");
                        if(
                            wasCurrent&&
                            doc.visibilityState==="visible"&&
                            acquiredGeneration===requestGeneration
                        ){
                            void acquire("system-release");
                        }
                    },{once:true});
                }
                return !!next;
            }catch(error){
                diagnostics.lastFailureReason=String(error&&error.message||error&&error.name||"request-failed");
                syncDiagnostics("request-failed");
                scheduleRetry(diagnostics.lastFailureReason);
                return false;
            }finally{
                if(requestInFlight===flight){ requestInFlight=null; }
            }
        })();
        requestInFlight=flight;
        return flight.promise;
    }

    async function release(reason){
        requestGeneration++;
        diagnostics.lastReleaseReason=String(reason||"manual");
        cancelRetry(true);
        const current=sentinel;
        sentinel=null;
        syncDiagnostics("releasing");
        await releaseSentinel(current);
        syncDiagnostics("released");
    }

    function handleVisibilityChange(){
        if(doc.visibilityState==="visible"){
            retryAttempt=0;
            void acquire("visibility-visible");
        }else{
            void release("visibility-hidden");
        }
    }

    doc.addEventListener("visibilitychange",handleVisibilityChange);
    global.addEventListener("pageshow",()=>{
        if(doc.visibilityState==="visible"){
            retryAttempt=0;
            void acquire("pageshow");
        }
    });
    global.addEventListener("pagehide",()=>{ void release("pagehide"); });

    syncDiagnostics(supported()?"idle":"unsupported");
    global.FourSymbolsScreenWakeLock=Object.freeze({
        acquire,
        release,
        isSupported:supported,
        isHeld:()=>!!(sentinel&&!sentinel.released),
        getDiagnostics:()=>Object.freeze(Object.assign({},diagnostics))
    });

    void acquire("initial-visible");
})(typeof window!=="undefined"?window:globalThis);
