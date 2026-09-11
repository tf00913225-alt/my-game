window.__FOUR_SYMBOLS_BUILD__=Object.freeze({"release":"173.65","firebaseBootstrap":"build/firebase/firebase-bootstrap.5c544293719d.js"});

/* bundled source: js/startup/support-contact.js */
/* =====================================================
   Shared customer-support contact owner
   - Available in Critical Boot before authentication.
   - Login, system settings and paid-service disclosure all read one email.
===================================================== */
(function installFourSymbolsSupportContact(global){
    "use strict";

    if(!global||global.FourSymbolsSupport){ return; }

    const EMAIL="tf00913225@gmail.com";
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
            : (previousMetadata&&previousMetadata.cloudBaseFingerprint||null);
        if(cloudBaseFingerprint!==null&&!/^v1:[0-9a-f]+:[0-9a-f]{32}$/.test(cloudBaseFingerprint)){
            throw coded("account-cloud-base-invalid","Cloud save provenance fingerprint is invalid.");
        }
        let localDirty;
        if(typeof options.localDirty==="boolean"){
            localDirty=options.localDirty;
        }else if(source==="authoritative-cloud-read"){
            localDirty=false;
        }else if(source==="hydration-normalization"){
            localDirty=previousMetadata?previousMetadata.localDirty===true:true;
        }else{
            localDirty=true;
        }
        const metadata=JSON.stringify({
            schemaVersion:SCHEMA_VERSION,
            ownerUid:uid,
            source,
            cloudBaseFingerprint,
            localDirty,
            updatedAt:Date.now()
        });
        try{
            storage().setItem(key,raw);
            storage().setItem(metaKey,metadata);
        }catch(error){
            try{
                if(previousRaw===null){ storage().removeItem(key); }else{ storage().setItem(key,previousRaw); }
                if(previousMeta===null){ storage().removeItem(metaKey); }else{ storage().setItem(metaKey,previousMeta); }
            }catch(_){ }
            throw coded("account-save-write-failed","Account save could not be committed atomically.",error);
        }
        return {uid,key,metadata:JSON.parse(metadata)};
    }
    function inspectLegacy(){
        let raw;
        try{ raw=storage().getItem(LEGACY_KEY); }
        catch(cause){ return {status:"error",save:null,raw:null,error:coded("legacy-unavailable","Legacy save cannot be inspected.",cause)}; }
        if(!raw){ return {status:"none",save:null,raw:null,error:null}; }
        try{ return {status:"available",save:parseSave(raw,"legacy-corrupt"),raw,error:null}; }
        catch(error){ return {status:"corrupt",save:null,raw,error}; }
    }
    function migrationBackupKey(uid){ return BACKUP_PREFIX+validUid(uid)+":"+Date.now(); }
    function migrateLegacyToUid(uid,options={}){
        uid=validUid(uid);
        if(options.confirmed!==true){ throw coded("migration-confirmation-required","Legacy migration requires explicit confirmation."); }
        const legacy=inspectLegacy();
        if(legacy.status!=="available"){ throw legacy.error||coded("legacy-missing","No safe legacy save exists."); }
        const existing=readForUid(uid);
        if(existing.status!=="empty" || options.cloudHasCharacter===true){
            throw coded("migration-conflict","Migration is blocked because this account already has a save.");
        }
        activate(uid);
        const backupKey=migrationBackupKey(uid);
        const backups=[backupKey];
        const writtenSidecars=[];
        storage().setItem(backupKey,legacy.raw);
        try{
            writeForUid(uid,legacy.save,{source:"legacy-confirmed"});
            for(const [oldKey,suffix] of Object.entries(LEGACY_SIDECARS)){
                const raw=storage().getItem(oldKey);
                if(raw===null){ continue; }
                const target=accountKey(suffix,uid);
                if(storage().getItem(target)!==null){ throw coded("migration-sidecar-conflict","An account sidecar already exists: "+suffix); }
                const sidecarBackup=backupKey+":"+oldKey;
                storage().setItem(sidecarBackup,raw); backups.push(sidecarBackup);
                storage().setItem(target,raw); writtenSidecars.push(target);
            }
            return {status:"migrated",uid,backupKey,backupKeys:backups,legacyKey:LEGACY_KEY};
        }catch(error){
            writtenSidecars.forEach(key=>{ try{ storage().removeItem(key); }catch(_){ } });
            try{ storage().removeItem(saveKey(uid)); storage().removeItem(metadataKey(uid)); }catch(_){ }
            // The canonical legacy key and its backup are deliberately preserved.
            throw error;
        }
    }
    function removeActive(){
        const uid=getActiveUid();
        if(!uid){ return false; }
        storage().removeItem(saveKey(uid));
        storage().removeItem(metadataKey(uid));
        return true;
    }
    function accountKey(name,uid){
        uid=validUid(uid||getActiveUid());
        const suffix=String(name||"").trim();
        if(!suffix){ throw coded("account-key-invalid","Account sidecar name is required."); }
        return "four_symbols_account:"+uid+":"+suffix;
    }

    global.FourSymbolsAccountSave=Object.freeze({
        SCHEMA_VERSION,LEGACY_KEY,ACTIVE_UID_KEY,activate,deactivate,getActiveUid,
        saveKey,metadataKey,readForUid,readActive,writeForUid,inspectLegacy,
        migrateLegacyToUid,removeActive,accountKey,fingerprint,LEGACY_SIDECARS
    });
})(typeof window!=="undefined"?window:globalThis);


/* bundled source: js/startup/feature-loader.js */
/* The sole dynamic runtime loader. Downloads may overlap; dependency execution is deterministic. */
(function installFeatureLoader(global){
    "use strict";
    if(!global || global.FourSymbolsFeatures){ return; }

    let manifestPromise=null;
    const preparation=new Map();
    const execution=new Map();
    const ready=new Set();
    const readyFeatures=new Set();
    const bundleFeatures=new Map();

    function emit(name,detail){
        try{ global.dispatchEvent(new CustomEvent(name,{detail})); }catch(_){ }
    }
    function manifest(){
        if(!manifestPromise){
            manifestPromise=fetch("asset-manifest.json",{cache:"no-cache"}).then(response=>{
                if(!response.ok){ throw new Error("Feature manifest unavailable ("+response.status+")."); }
                return response.json();
            }).then(data=>data.featureManifest||data);
        }
        return manifestPromise;
    }
    function addLink(attributes){
        return new Promise((resolve,reject)=>{
            const link=document.createElement("link");
            Object.entries(attributes).forEach(([key,value])=>link.setAttribute(key,value));
            link.addEventListener("load",()=>resolve(link),{once:true});
            link.addEventListener("error",()=>reject(new Error("Failed to load "+(attributes.href||"resource"))),{once:true});
            document.head.appendChild(link);
        });
    }
    function prepareBundle(name,bundle){
        if(preparation.has(name)){ return preparation.get(name); }
        const promise=Promise.all([
            ...(bundle.styles||[]).map(url=>addLink({rel:"stylesheet",href:url,"data-feature-style":name})),
            ...(bundle.scripts||[]).map(url=>addLink({rel:"preload",as:"script",href:url,"data-feature-preload":name}))
        ]);
        preparation.set(name,promise);
        return promise;
    }
    function topology(target,bundles){
        const ordered=[]; const visiting=new Set(); const visited=new Set();
        function visit(name){
            if(visited.has(name)){ return; }
            if(visiting.has(name)){ throw new Error("Feature dependency cycle at "+name); }
            const bundle=bundles[name];
            if(!bundle){ throw new Error("Unknown feature bundle: "+name); }
            visiting.add(name);
            (bundle.dependencies||[]).forEach(visit);
            visiting.delete(name); visited.add(name); ordered.push(name);
        }
        visit(target); return ordered;
    }
    function executeBundle(name,bundle){
        if(ready.has(name)){ return Promise.resolve(name); }
        if(execution.has(name)){ return execution.get(name); }
        const promise=prepareBundle(name,bundle).then(()=>{
            let chain=Promise.resolve();
            (bundle.scripts||[]).forEach(url=>{
                chain=chain.then(()=>new Promise((resolve,reject)=>{
                    const script=document.createElement("script");
                    script.src=url; script.async=false; script.dataset.featureBundle=name;
                    script.addEventListener("load",resolve,{once:true});
                    script.addEventListener("error",()=>reject(new Error("Failed to execute "+url)),{once:true});
                    document.body.appendChild(script);
                }));
            });
            return chain;
        }).then(()=>{
            ready.add(name);
            (bundleFeatures.get(name)||[]).forEach(feature=>readyFeatures.add(feature));
            emit("four-symbols:feature-ready",{bundle:name,features:[...(bundleFeatures.get(name)||[])]});
            return name;
        }).catch(error=>{
            execution.delete(name);
            emit("four-symbols:feature-error",{bundle:name,error});
            throw error;
        });
        execution.set(name,promise); return promise;
    }
    async function ensure(feature,reason="navigation"){
        const data=await manifest();
        Object.entries(data.features||{}).forEach(([key,value])=>{
            if(!bundleFeatures.has(value)){ bundleFeatures.set(value,new Set()); }
            bundleFeatures.get(value).add(key);
        });
        const target=(data.features&&data.features[feature]) || (data.bundles&&data.bundles[feature]?feature:null);
        if(!target){ throw new Error("Unknown feature: "+feature); }
        const order=topology(target,data.bundles||{});
        // Start every network fetch before executing the first dependency.
        await Promise.all(order.map(name=>prepareBundle(name,data.bundles[name])));
        for(const name of order){ await executeBundle(name,data.bundles[name]); }
        emit("four-symbols:feature-request-complete",{feature,bundle:target,reason});
        return target;
    }
    function prefetch(feature,reason="intent"){
        return manifest().then(data=>{
            const target=(data.features&&data.features[feature]) || (data.bundles&&data.bundles[feature]?feature:null);
            if(!target){ return false; }
            const order=topology(target,data.bundles||{});
            return Promise.all(order.map(name=>prepareBundle(name,data.bundles[name]))).then(()=>true);
        }).catch(()=>false);
    }
    function idle(){
        const run=()=>manifest().then(data=>Promise.all((data.idlePreload||[]).map(item=>prefetch(item,"idle"))));
        if(typeof global.requestIdleCallback==="function"){
            global.requestIdleCallback(run,{timeout:2500});
        }else{ global.setTimeout(run,800); }
    }

    global.FourSymbolsFeatures=Object.freeze({
        ensure,prefetch,idle,
        isReady:name=>ready.has(name)||readyFeatures.has(name),
        manifest
    });
})(typeof window!=="undefined"?window:globalThis);


/* bundled source: js/startup/startup-contract.js */
/* Declarative startup contract shared by the state-machine owner and tests. */
(function installStartupContract(global){
    "use strict";
    if(!global||global.FourSymbolsStartupContract){ return; }

    const STATES=Object.freeze({
        BOOT_LOADING:"BOOT_LOADING",
        AUTH_RESOLVING:"AUTH_RESOLVING",
        AUTH_REQUIRED:"AUTH_REQUIRED",
        SAVE_LOADING:"SAVE_LOADING",
        MIGRATION_REQUIRED:"MIGRATION_REQUIRED",
        NEED_CHARACTER:"NEED_CHARACTER",
        READY:"READY",
        OFFLINE_READY:"OFFLINE_READY",
        ERROR:"ERROR"
    });
    const ALLOWED=Object.freeze({
        BOOT_LOADING:Object.freeze(["AUTH_RESOLVING","ERROR"]),
        AUTH_RESOLVING:Object.freeze(["AUTH_REQUIRED","SAVE_LOADING","ERROR"]),
        AUTH_REQUIRED:Object.freeze(["SAVE_LOADING","ERROR"]),
        SAVE_LOADING:Object.freeze(["AUTH_REQUIRED","MIGRATION_REQUIRED","NEED_CHARACTER","READY","OFFLINE_READY","ERROR"]),
        MIGRATION_REQUIRED:Object.freeze(["READY","AUTH_REQUIRED","ERROR"]),
        NEED_CHARACTER:Object.freeze(["READY","AUTH_REQUIRED","ERROR"]),
        READY:Object.freeze(["AUTH_REQUIRED","ERROR"]),
        OFFLINE_READY:Object.freeze(["AUTH_REQUIRED","ERROR"]),
        ERROR:Object.freeze(["AUTH_RESOLVING","SAVE_LOADING","AUTH_REQUIRED","OFFLINE_READY"])
    });
    function canTransition(from,to){
        return from===to||!!(ALLOWED[from]&&ALLOWED[from].includes(to));
    }
    function canCreateCharacter(context={}){
        return context.state===STATES.NEED_CHARACTER&&
            typeof context.userUid==="string"&&context.userUid.length>0&&
            context.userUid===context.resolvedUid&&
            context.userUid===context.activeSaveUid&&
            context.saveResolved===true;
    }
    global.FourSymbolsStartupContract=Object.freeze({STATES,ALLOWED,canTransition,canCreateCharacter});
})(typeof window!=="undefined"?window:globalThis);


/* bundled source: js/52-v173.20-startup-loader.js */
/* Sole StartupStateMachine owner: identity -> UID save -> destination. */
(function installStartupStateMachine(global){
    "use strict";
    const contract=global.FourSymbolsStartupContract;
    if(!contract){ throw new Error("Startup contract must load before its state-machine owner."); }
    const STATES=contract.STATES;
    const root=document.getElementById("startupLoader");
    const logoScene=document.getElementById("startupLogoScene");
    const cityScene=document.getElementById("startupCityScene");
    const title=document.getElementById("startupStatusTitle");
    const detail=document.getElementById("startupStatusDetail");
    const percent=document.getElementById("startupPercent");
    const progress=document.getElementById("startupProgress");
    const fill=document.getElementById("startupProgressFill");
    const creation=document.getElementById("creationPage");
    const game=document.getElementById("gameInterface");
    const build=global.__FOUR_SYMBOLS_BUILD__||{};
    const introLogoTargetMs=Math.max(350,Math.min(1800,Number(root&&root.dataset.logoTargetMs)||900));
    let state=STATES.BOOT_LOADING;
    let activeUser=null;
    let resolvedUid=null;
    let saveResolved=false;
    let cloudResult=null;
    let transitionToken=0;
    let firebase=null;
    let lastError=null;
    let introTimer=0;
    let citySceneShown=false;

    function mark(name){
        try{ if(global.performance&&typeof global.performance.mark==="function"){ global.performance.mark(name); } }catch(_){ }
    }

    if(creation){ creation.style.display="none"; creation.setAttribute("aria-hidden","true"); }
    if(game){ game.style.display="none"; }
    if(root){ root.hidden=false; root.dataset.owner="StartupStateMachine"; root.dataset.state=state; }
    mark("four-symbols:boot-core-ready");
    scheduleCityScene();

    // Signed-out players need only the account surface. Start the application
    // shell after Firebase has produced a UID, then overlap it with save I/O.
    let appShellPromise=null;
    function startAppShell(){
        if(!appShellPromise){
            appShellPromise=global.FourSymbolsFeatures.ensure("app-shell","authenticated-boot")
                .then(value=>({value,error:null}),error=>({value:null,error}));
        }
        return appShellPromise;
    }
    async function requireAppShell(){
        const result=await startAppShell();
        if(result.error){ throw result.error; }
        return result.value;
    }
    function emit(name,payload={}){ document.dispatchEvent(new CustomEvent(name,{detail:{state,...payload}})); }
    function render(value,nextTitle,nextDetail){
        const safe=Math.max(0,Math.min(100,Math.round(value)));
        if(fill){ fill.style.width=safe+"%"; }
        if(percent){ percent.textContent=safe+"%"; }
        if(progress){ progress.setAttribute("aria-valuenow",String(safe)); }
        if(title){ title.textContent=nextTitle; }
        if(detail){ detail.textContent=nextDetail; }
    }
    function transition(next,payload={}){
        if(!contract.canTransition(state,next)){ throw new Error("Invalid startup transition "+state+" -> "+next); }
        state=next; if(root){ root.dataset.state=state; }
        emit("four-symbols:startup-state",payload); return state;
    }
    function showCityScene(reason="boot-progress"){
        if(citySceneShown){ return; }
        citySceneShown=true;
        if(introTimer){ global.clearTimeout(introTimer); introTimer=0; }
        if(logoScene){ logoScene.classList.remove("is-active"); logoScene.setAttribute("aria-hidden","true"); }
        if(cityScene){ cityScene.classList.add("is-active"); cityScene.setAttribute("aria-hidden","false"); }
        if(root){ root.dataset.scene="city"; root.dataset.sceneReason=reason; }
        mark("four-symbols:intro-city-visible");
    }
    function scheduleCityScene(){
        if(!root||citySceneShown||introTimer){ return; }
        introTimer=global.setTimeout(()=>showCityScene("logo-target"),introLogoTargetMs);
    }
    function showLoader(){ if(root){ root.hidden=false; root.classList.remove("is-leaving"); root.setAttribute("aria-hidden","false"); } }
    function hideLoader(){
        if(!root){ return Promise.resolve(); }
        showCityScene("destination-ready");
        root.classList.add("is-leaving");
        return new Promise(resolve=>global.setTimeout(()=>{ root.hidden=true; root.setAttribute("aria-hidden","true"); resolve(); },360));
    }
    function accountUi(mode,message,error=false,migration=null){
        firebase.setUiState({mode,user:activeUser,message,error,migration}); firebase.openAuth();
    }
    function safeCloudEmpty(result,uid){
        // A successful authenticated read of this UID's missing document is an
        // authoritative empty result. Read errors never reach this function.
        if(result&&result.exists===false&&result.uid===uid){ return true; }
        const data=result&&result.data;
        return !!(result&&result.exists&&data&&data.ownerUid===uid&&data.authoritativeStateReady===false&&
            data.status==="awaiting_authoritative_migration"&&(data.migrationCandidateStatus||"none")==="none");
    }
    function cloudPayload(result){
        const data=result&&result.data;
        if(!data||data.authoritativeStateReady!==true){ return null; }
        const payload=data.gameSave||data.save||data.authoritativeSave||null;
        if(!payload||typeof payload!=="object"||Array.isArray(payload)||!payload.player||!payload.player.id){
            const error=new Error("Authoritative cloud metadata has no valid game-save payload."); error.code="cloud-authoritative-payload-invalid"; throw error;
        }
        return payload;
    }
    function domReady(){
        if(document.readyState!=="loading"){ return Promise.resolve(); }
        return new Promise(resolve=>document.addEventListener("DOMContentLoaded",resolve,{once:true}));
    }
    function activateGameplaySaveOwner(){
        if(!resolvedUid||!global.FourSymbolsGameSave||typeof global.FourSymbolsGameSave.activate!=="function"){
            throw new Error("Gameplay save owner is unavailable after app-shell installation.");
        }
        global.FourSymbolsGameSave.activate(resolvedUid);
        if(global.FourSymbolsAccountSave.getActiveUid()!==resolvedUid){
            throw new Error("Gameplay save owner refused the resolved Firebase UID.");
        }
    }
    function showCharacterCreationSurface(){
        const saveOwner=global.FourSymbolsGameSave;
        if(!saveOwner||typeof saveOwner.showCreation!=="function"){
            throw new Error("Character creation surface is unavailable after app-shell installation.");
        }
        saveOwner.showCreation();
        if(!creation||global.getComputedStyle(creation).display==="none"){
            throw new Error("Character creation surface did not become visible.");
        }
        creation.setAttribute("aria-hidden","false");
    }
    async function enterReady(save,offline=false,token=transitionToken){
        showLoader(); render(92,"載入角色資料",offline?"使用已驗證 UID 的本機存檔離線繼續":"準備第一個可操作畫面");
        await Promise.all([requireAppShell(),domReady()]);
        if(token!==transitionToken){ return; }
        activateGameplaySaveOwner();
        const loaded=global.FourSymbolsGameSave&&global.FourSymbolsGameSave.load();
        if(!loaded){ throw new Error("Account save passed resolution but gameplay hydration failed."); }
        transition(offline?STATES.OFFLINE_READY:STATES.READY,{uid:resolvedUid});
        firebase.closeAuth(); render(100,"載入完成","主城已可操作");
        mark("four-symbols:critical-ready");
        await hideLoader();
        mark("four-symbols:main-city-interactive");
        emit("four-symbols:startup-ready",{uid:resolvedUid,offline});
        document.dispatchEvent(new CustomEvent("v173.20:startup-entered"));
    }
    async function enterCreation(token=transitionToken){
        await Promise.all([requireAppShell(),domReady()]);
        if(token!==transitionToken){ return; }
        activateGameplaySaveOwner();
        transition(STATES.NEED_CHARACTER,{uid:resolvedUid});
        firebase.closeAuth(); render(100,"帳號資料已確認","此 UID 尚無角色，可以建立角色");
        showCharacterCreationSurface();
        if(game){ game.style.display="none"; }
        mark("four-symbols:critical-ready");
        await hideLoader();
        if(state!==STATES.NEED_CHARACTER){ return; }
        mark("four-symbols:character-creation-interactive");
        emit("four-symbols:character-creation-allowed",{uid:resolvedUid});
    }
    function migration(message,blocked=false){
        transition(STATES.MIGRATION_REQUIRED,{uid:resolvedUid,blocked});
        render(100,"需要確認舊存檔","未確認前不會綁定、覆寫或建立角色");
        accountUi("MIGRATION_REQUIRED",message,false,{message,blocked});
        void hideLoader();
        mark("four-symbols:critical-ready"); mark("four-symbols:migration-ui-interactive");
    }
    async function resolveSaveFor(user){
        showCityScene("identity-resolved");
        const token=++transitionToken;
        activeUser=user; resolvedUid=user.uid; saveResolved=false; cloudResult=null; lastError=null;
        startAppShell();
        transition(STATES.SAVE_LOADING,{uid:user.uid}); showLoader();
        render(70,"讀取帳號角色","正在解析 UID 雲端與本機存檔"); accountUi("SAVE_LOADING","正在讀取此 UID 的角色資料…");
        const repo=global.FourSymbolsAccountSave;
        repo.activate(user.uid);
        if(global.FourSymbolsGameSave){ global.FourSymbolsGameSave.activate(user.uid); }
        let local;
        try{ local=repo.readForUid(user.uid); }
        catch(error){ return fail(error,"本機帳號存檔無法安全讀取。",token); }
        let cloud;
        try{ cloud=await firebase.resolveCloudSave(user); }
        catch(error){
            if(token!==transitionToken){ return; }
            if(local.status==="ready"){
                saveResolved=true; cloudResult={error}; mark("four-symbols:save-resolved");
                try{ await enterReady(local.save,true,token); }catch(readyError){ fail(readyError,"離線存檔載入失敗。",token); }
                return;
            }
            return fail(error,"雲端存檔尚未確認；為避免誤判新玩家，禁止創角。",token);
        }
        if(token!==transitionToken){ return; }
        cloudResult=cloud;
        let authoritative=null;
        try{ authoritative=cloudPayload(cloud); }
        catch(error){ return fail(error,"雲端角色資料不完整；未修改任何本機資料。",token); }
        const legacy=repo.inspectLegacy();
        if(legacy.status==="corrupt"||legacy.status==="error"){
            return fail(legacy.error,"偵測到損壞或不可讀的舊版存檔；禁止覆寫。",token);
        }
        if(authoritative&&legacy.status==="available"){
            return migration("雲端已有角色，同時偵測到未綁定舊版角色。系統禁止自動覆寫；請保留資料並由後續衝突處理流程處理。",true);
        }
        let selectedSave=authoritative;
        if(authoritative&&local.status==="ready"){
            try{
                const cloudFingerprint=repo.fingerprint(authoritative);
                const localFingerprint=repo.fingerprint(local.save);
                const localBase=local.metadata&&local.metadata.cloudBaseFingerprint||null;
                if(localFingerprint===cloudFingerprint){
                    if(localBase!==cloudFingerprint||local.metadata.localDirty!==false){
                        repo.writeForUid(user.uid,local.save,{source:"authoritative-cloud-read",cloudBaseFingerprint:cloudFingerprint,localDirty:false});
                    }
                    selectedSave=local.save;
                }else if(localBase===cloudFingerprint){
                    // The cloud snapshot is unchanged and this UID's local save is
                    // a verified descendant (normalization or later local play).
                    selectedSave=local.save;
                }else{
                    return migration("雲端角色與此 UID 的本機角色沒有共同的已驗證基底。系統禁止靜默選邊或覆寫。",true);
                }
            }catch(error){ return fail(error,"無法驗證雲端與本機存檔的來源關係；未覆寫任何資料。",token); }
        }
        if(authoritative){
            if(local.status==="empty"){
                const cloudFingerprint=repo.fingerprint(authoritative);
                repo.writeForUid(user.uid,authoritative,{source:"authoritative-cloud-read",cloudBaseFingerprint:cloudFingerprint,localDirty:false});
            }
            saveResolved=true; mark("four-symbols:save-resolved"); return enterReady(selectedSave,false,token).catch(error=>fail(error,"角色載入失敗。",token));
        }
        if(local.status==="ready"){
            saveResolved=true; mark("four-symbols:save-resolved"); return enterReady(local.save,false,token).catch(error=>fail(error,"角色載入失敗。",token));
        }
        if(legacy.status==="available"){
            return migration("偵測到此裝置存在舊版角色資料。請確認是否備份並作為目前 UID 的本機角色；原始 legacy key 會保留。",false);
        }
        if(!safeCloudEmpty(cloud,user.uid)){
            return migration("雲端狀態仍在遷移或無法證明為空；禁止把它當成新帳號。",true);
        }
        saveResolved=true; mark("four-symbols:save-resolved"); render(90,"帳號資料已確認","此 UID 沒有角色");
        return enterCreation(token).catch(error=>fail(error,"創角介面載入失敗。",token));
    }
    function requireAuth(){
        showCityScene("auth-required");
        activeUser=null; resolvedUid=null; saveResolved=false; cloudResult=null;
        if(global.FourSymbolsGameSave){ global.FourSymbolsGameSave.deactivate(); }else{ global.FourSymbolsAccountSave.deactivate(); }
        transition(STATES.AUTH_REQUIRED); render(100,"帳號服務已就緒","請登入、註冊或以 Firebase 訪客 UID 開始");
        accountUi("AUTH_REQUIRED","請先登入、註冊或使用訪客開始遊戲。沒有 UID 時不能建立角色。");
        void hideLoader();
        mark("four-symbols:critical-ready"); mark("four-symbols:auth-ui-interactive");
    }
    function fail(error,message,token=transitionToken){
        if(token!==transitionToken){ return; }
        showCityScene("startup-error");
        lastError=error; saveResolved=false;
        if(state!==STATES.ERROR){ transition(STATES.ERROR,{error}); }
        showLoader(); render(Math.min(99,Number(progress&&progress.getAttribute("aria-valuenow"))||0),"啟動失敗",message);
        if(firebase){ accountUi("ERROR",message+" "+String(error&&error.message||""),true); }
        emit("four-symbols:startup-error",{error,message});
    }
    function onAuth(detail){
        const user=detail&&detail.user; const error=detail&&detail.error;
        if(error){ fail(error,"Firebase 身份解析失敗；不會顯示創角。"); return; }
        if(!user){
            if(activeUser){
                global.FourSymbolsAccountSave.deactivate();
                // A full reload clears player/inventory/equipment globals before another UID can hydrate.
                global.location.reload(); return;
            }
            if(state===STATES.AUTH_RESOLVING){ requireAuth(); }
            return;
        }
        if(activeUser&&activeUser.uid!==user.uid){ global.FourSymbolsAccountSave.deactivate(); global.location.reload(); return; }
        if(state===STATES.AUTH_RESOLVING||state===STATES.AUTH_REQUIRED){ void resolveSaveFor(user); }
    }
    async function boot(){
        try{
            render(15,"建立啟動環境","載入最小 Boot Core"); transition(STATES.AUTH_RESOLVING); render(30,"初始化帳號服務","恢復 Firebase Authentication session");
            const url=new URL(build.firebaseBootstrap,document.baseURI).href;
            await import(url);
            firebase=global.FourSymbolsFirebaseLifecycle;
            if(!firebase){ throw new Error("Firebase lifecycle owner did not install."); }
            global.addEventListener("four-symbols:firebase-auth-state",event=>onAuth(event.detail));
            global.addEventListener("four-symbols:account-ui-action",event=>{
                const action=event.detail&&event.detail.action;
                if(action==="retry"&&activeUser){ void resolveSaveFor(activeUser); }
                if(action==="confirm-migration"&&state===STATES.MIGRATION_REQUIRED&&activeUser){
                    try{
                        const data=cloudResult&&cloudResult.data;
                        const cloudHas=!!(data&&data.authoritativeStateReady===true);
                        global.FourSymbolsAccountSave.migrateLegacyToUid(activeUser.uid,{confirmed:true,cloudHasCharacter:cloudHas});
                        const migrated=global.FourSymbolsAccountSave.readForUid(activeUser.uid);
                        const token=transitionToken;
                        saveResolved=true; void enterReady(migrated.save,false,token)
                            .catch(error=>fail(error,"migration 後角色載入失敗；原始 legacy 與備份均已保留。",token));
                    }catch(error){ fail(error,"舊版存檔 migration 失敗；原檔與備份均未刪除。"); }
                }
                if(action==="cancel-migration"&&state===STATES.MIGRATION_REQUIRED&&activeUser){
                    firebase.signOut().catch(error=>fail(error,"無法安全退出 migration 流程；資料未被修改。"));
                }
            });
            await firebase.initialize(); mark("four-symbols:auth-initialized"); render(50,"確認登入狀態","等待 Firebase 回復身份");
            const user=await firebase.resolveIdentity(); mark("four-symbols:auth-resolved"); render(65,"身份確認完成",user?"已取得 UID":"需要玩家選擇登入方式");
            onAuth({user,error:null});
        }catch(error){ fail(error,"Firebase Authentication 無法初始化；禁止 fail-open 創角。"); }
    }
    global.FourSymbolsStartupPolicy=Object.freeze({
        states:STATES,getState:()=>state,getUid:()=>resolvedUid,
        canShowCharacterCreation:()=>contract.canCreateCharacter({state,userUid:activeUser&&activeUser.uid,resolvedUid,saveResolved,activeSaveUid:global.FourSymbolsAccountSave.getActiveUid()}),
        canCreateCharacter:()=>contract.canCreateCharacter({state,userUid:activeUser&&activeUser.uid,resolvedUid,saveResolved,activeSaveUid:global.FourSymbolsAccountSave.getActiveUid()}),
        openAccountManager:()=>{
            if(!firebase||!activeUser){ return false; }
            accountUi(state,"目前角色資料綁定此 Firebase UID。");
            return true;
        },
        notifyCharacterCreated:()=>{
            if(!global.FourSymbolsStartupPolicy.canCreateCharacter()){ throw new Error("Character creation completion is not authorized."); }
            transition(STATES.READY,{uid:resolvedUid,newCharacter:true});
            emit("four-symbols:startup-ready",{uid:resolvedUid,newCharacter:true});
            document.dispatchEvent(new CustomEvent("v173.20:startup-entered"));
            global.FourSymbolsFeatures.idle();
        },
        retry:()=>activeUser?resolveSaveFor(activeUser):boot(),getLastError:()=>lastError
    });
    void boot();
})(typeof window!=="undefined"?window:globalThis);
