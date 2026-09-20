window.__FOUR_SYMBOLS_BUILD__=Object.freeze({"release":"173.69","firebaseBootstrap":"build/firebase/firebase-bootstrap.0128f5b3761e.js"});

/* bundled source: js/startup/support-contact.js */
/* =====================================================
   Shared customer-support contact owner
   - Available in Critical Boot before authentication.
   - Login, system settings and paid-service disclosure all read one email.
===================================================== */
(function installFourSymbolsSupportContact(global){
    "use strict";

    if(!global||global.FourSymbolsSupport){ return; }

    const EMAIL="foursymbols.support@gmail.com";
    const OVERLAY_ID="fourSymbolsSupportOverlay";

    function close(){
        const overlay=document.getElementById(OVERLAY_ID);
        if(!overlay){ return false; }
        overlay.hidden=true;
        overlay.setAttribute("aria-hidden","true");
        return true;
    }

    function ensureOverlay(){
        let overlay=document.getElementById(OVERLAY_ID);
        if(overlay){ return overlay; }

        overlay=document.createElement("section");
        overlay.id=OVERLAY_ID;
        overlay.className="support-contact-overlay";
        overlay.hidden=true;
        overlay.setAttribute("aria-hidden","true");
        overlay.innerHTML=[
            '<div class="support-contact-dialog" role="dialog" aria-modal="true" aria-labelledby="supportContactTitle">',
                '<div class="support-contact-eyebrow">FOUR SYMBOLS SUPPORT</div>',
                '<h2 id="supportContactTitle">聯絡客服</h2>',
                '<p>客服信箱</p>',
                '<a class="support-contact-email" href="mailto:'+EMAIL+'">'+EMAIL+'</a>',
                '<button id="supportContactCloseButton" type="button">關閉</button>',
            '</div>'
        ].join("");

        overlay.addEventListener("click",event=>{
            if(event.target===overlay){ close(); }
        });
        overlay.querySelector("#supportContactCloseButton").addEventListener("click",close);
        document.body.appendChild(overlay);
        return overlay;
    }

    function show(){
        const overlay=ensureOverlay();
        overlay.hidden=false;
        overlay.setAttribute("aria-hidden","false");
        const closeButton=overlay.querySelector("#supportContactCloseButton");
        if(closeButton){ closeButton.focus({preventScroll:true}); }
        return EMAIL;
    }

    document.addEventListener("keydown",event=>{
        if(event.key==="Escape"){ close(); }
    });

    global.FourSymbolsSupport=Object.freeze({email:EMAIL,show,close});
})(window);


/* bundled source: js/startup/screen-wake-lock-runtime.js */
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


/* bundled source: js/startup/account-save-repository.js */
/* Account-aware local save owner. Gameplay schema stays unchanged; ownership lives beside it. */
(function installAccountSaveRepository(global){
    "use strict";
    if(!global || global.FourSymbolsAccountSave){ return; }

    const LEGACY_KEY="battle_full_version_save_v5";
    const PREFIX="four_symbols_save:";
    const META_PREFIX="four_symbols_save_meta:";
    const BACKUP_PREFIX="four_symbols_legacy_backup:";
    const ACTIVE_UID_KEY="four_symbols_active_uid";
    const SCHEMA_VERSION=2;
    const LEGACY_SIDECARS=Object.freeze({
        v131_element_box_state:"element-box-state",
        v132_daily_dungeon_state:"daily-dungeon-state",
        v173_exp_pool_growth_state:"exp-pool-growth-state",
        v139_rested_exp_state:"rested-exp-state",
        v141_account_progress:"progress",
        v141_announcement_read:"announcement-read",
        v141_quest_milestones:"quest-milestones",
        v141_task_tracker:"task-tracker",
        v141_abyss_state:"legacy-abyss-state",
        v169_equipment_shop_daily:"equipment-shop-daily",
        v17350_bulk_sell_quality:"bulk-sell-quality",
        v17351_equipment_shop_purchases:"equipment-shop-purchases",
        v174_abyss_state_v2:"abyss-state"
    });

    function storage(){
        if(!global.localStorage){ throw coded("local-storage-unavailable","Local storage is unavailable."); }
        return global.localStorage;
    }
    function coded(code,message,cause){
        const error=new Error(message); error.code=code; if(cause){ error.cause=cause; } return error;
    }
    function validUid(value){
        const uid=String(value||"").trim();
        if(!uid || uid.length>128 || !/^[A-Za-z0-9:_-]+$/.test(uid)){
            throw coded("account-invalid-uid","A valid Firebase UID is required.");
        }
        return uid;
    }
    function parseSave(raw,code){
        if(!raw){ return null; }
        try{
            const value=JSON.parse(raw);
            if(!value || typeof value!=="object" || Array.isArray(value)){
                throw new Error("Save root must be an object.");
            }
            return value;
        }catch(cause){ throw coded(code||"account-save-corrupt","Stored save is not valid JSON.",cause); }
    }
    function canonicalValue(value,seen){
        if(value===null||typeof value!=="object"){ return value; }
        if(seen.has(value)){ throw coded("account-save-cyclic","Save cannot contain cyclic values."); }
        seen.add(value);
        let output;
        if(Array.isArray(value)){
            output=value.map(item=>item===undefined||typeof item==="function"||typeof item==="symbol"?null:canonicalValue(item,seen));
        }else{
            output={};
            Object.keys(value).sort().forEach(key=>{
                const item=value[key];
                if(item===undefined||typeof item==="function"||typeof item==="symbol"){ return; }
                output[key]=canonicalValue(item,seen);
            });
        }
        seen.delete(value); return output;
    }
    function fingerprint(save){
        let serialized;
        try{ serialized=JSON.stringify(canonicalValue(save,new WeakSet())); }
        catch(cause){ if(cause&&cause.code){ throw cause; } throw coded("account-save-fingerprint-failed","Save fingerprint could not be calculated.",cause); }
        if(!serialized){ throw coded("account-save-fingerprint-failed","Save fingerprint requires a JSON payload."); }
        let a=0x243f6a88,b=0x85a308d3,c=0x13198a2e,d=0x03707344;
        for(let index=0;index<serialized.length;index++){
            const code=serialized.charCodeAt(index);
            a=Math.imul(a^code,0x9e3779b1); b=Math.imul(b^code,0x85ebca77);
            c=Math.imul(c^code,0xc2b2ae3d); d=Math.imul(d^code,0x27d4eb2f);
        }
        function finish(hash,other){
            hash^=serialized.length; hash^=other>>>13; hash=Math.imul(hash^(hash>>>16),0x85ebca6b);
            hash=Math.imul(hash^(hash>>>13),0xc2b2ae35); return (hash^(hash>>>16))>>>0;
        }
        const hashes=[finish(a,c),finish(b,d),finish(c,a),finish(d,b)];
        return "v1:"+serialized.length.toString(16)+":"+hashes.map(value=>value.toString(16).padStart(8,"0")).join("");
    }
    function saveKey(uid){ return PREFIX+validUid(uid); }
    function metadataKey(uid){ return META_PREFIX+validUid(uid); }
    function getActiveUid(){
        const value=storage().getItem(ACTIVE_UID_KEY);
        return value ? validUid(value) : null;
    }
    function activate(uid){
        uid=validUid(uid); storage().setItem(ACTIVE_UID_KEY,uid); return uid;
    }
    function deactivate(){ storage().removeItem(ACTIVE_UID_KEY); }
    function readForUid(uid){
        uid=validUid(uid);
        const raw=storage().getItem(saveKey(uid));
        const metadataRaw=storage().getItem(metadataKey(uid));
        if(!raw&&!metadataRaw){ return {status:"empty",uid,save:null,metadata:null}; }
        if(!raw||!metadataRaw){
            throw coded("account-save-incomplete","Local account save and ownership metadata are incomplete.");
        }
        const save=parseSave(raw,"account-save-corrupt");
        let metadata=null;
        try{ metadata=JSON.parse(metadataRaw); }
        catch(cause){ throw coded("account-metadata-corrupt","Account save metadata is corrupt.",cause); }
        if(!metadata || metadata.ownerUid!==uid){
            throw coded("account-owner-mismatch","Local save ownership cannot be verified.");
        }
        return {status:"ready",uid,save,metadata};
    }
    function readActive(){
        const uid=getActiveUid();
        return uid ? readForUid(uid) : {status:"inactive",uid:null,save:null,metadata:null};
    }
    function writeForUid(uid,save,options={}){
        uid=validUid(uid);
        if(!save || typeof save!=="object" || Array.isArray(save)){
            throw coded("account-save-invalid","Save must be an object.");
        }
        const active=getActiveUid();
        if(active!==uid){ throw coded("account-not-active","Refusing to write a non-active account save."); }
        const key=saveKey(uid);
        const metaKey=metadataKey(uid);
        const previousRaw=storage().getItem(key);
        const previousMeta=storage().getItem(metaKey);
        let previousMetadata=null;
        if(previousMeta){
            try{ previousMetadata=JSON.parse(previousMeta); }
            catch(cause){ throw coded("account-metadata-corrupt","Account save metadata is corrupt.",cause); }
            if(!previousMetadata||previousMetadata.ownerUid!==uid){
                throw coded("account-owner-mismatch","Existing local save ownership cannot be verified.");
            }
        }
        const raw=JSON.stringify(save);
        const source=String(options.source||"local");
        const explicitBase=Object.prototype.hasOwnProperty.call(options,"cloudBaseFingerprint");
        const cloudBaseFingerprint=explicitBase
            ? (options.cloudBaseFingerprint===null?null:String(options.cloudBaseFingerprint||""))
            : (previousMe