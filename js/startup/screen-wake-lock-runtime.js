/* Global visible-page Screen Wake Lock lifecycle. This runtime never blocks startup. */
(function installScreenWakeLock(global){
    "use strict";
    const doc=global&&global.document;
    if(!global||!doc||global.FourSymbolsScreenWakeLock){ return; }

    let sentinel=null;
    let requestInFlight=null;
    let requestGeneration=0;

    function supported(){
        return !!(global.navigator&&global.navigator.wakeLock&&typeof global.navigator.wakeLock.request==="function");
    }

    async function releaseSentinel(target){
        if(target&&!target.released&&typeof target.release==="function"){
            try{ await target.release(); }catch(_){ }
        }
    }

    async function acquire(){
        if(!supported()||doc.visibilityState!=="visible"){ return false; }
        if(sentinel&&!sentinel.released){ return true; }
        if(requestInFlight){
            const pending=requestInFlight;
            const acquired=await pending.promise;
            if(!acquired&&doc.visibilityState==="visible"&&requestGeneration!==pending.generation){
                return acquire();
            }
            return acquired;
        }

        const flight={generation:requestGeneration,promise:null};
        flight.promise=(async()=>{
            try{
                const next=await global.navigator.wakeLock.request("screen");
                if(flight.generation!==requestGeneration||doc.visibilityState!=="visible"){
                    await releaseSentinel(next);
                    return false;
                }
                sentinel=next;
                if(next&&typeof next.addEventListener==="function"){
                    next.addEventListener("release",()=>{
                        if(sentinel===next){ sentinel=null; }
                    },{once:true});
                }
                return !!next;
            }catch(_){
                return false;
            }finally{
                if(requestInFlight===flight){ requestInFlight=null; }
            }
        })();
        requestInFlight=flight;
        return flight.promise;
    }

    async function release(){
        requestGeneration++;
        const current=sentinel;
        sentinel=null;
        await releaseSentinel(current);
    }

    function handleVisibilityChange(){
        if(doc.visibilityState==="visible"){ void acquire(); }
        else{ void release(); }
    }

    doc.addEventListener("visibilitychange",handleVisibilityChange);
    global.addEventListener("pageshow",()=>{ if(doc.visibilityState==="visible"){ void acquire(); } });
    global.addEventListener("pagehide",()=>{ void release(); });

    global.FourSymbolsScreenWakeLock=Object.freeze({
        acquire,
        release,
        isSupported:supported,
        isHeld:()=>!!(sentinel&&!sentinel.released)
    });

    void acquire();
})(typeof window!=="undefined"?window:globalThis);
