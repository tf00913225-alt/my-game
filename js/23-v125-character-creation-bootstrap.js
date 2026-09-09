/* =====================================================
   V174 — PRE-PAINT CHARACTER CREATION BOOTSTRAP + SAVE GUARD
   The creation page starts inside #app for legacy HTML compatibility.

   IMPORTANT:
   - This bootstrap only prepares the DOM location. It never decides that
     character creation is active before persisted data has been restored.
   - A fail-closed primary-character guard prevents an accidental creation
     screen after reload from overwriting an existing saved slot-1 character.
===================================================== */
(function bootstrapNativeCreationPage(){
    "use strict";

    const SAVE_KEY="battle_full_version_save_v5";
    const PRIMARY_CREATED_MARKER_KEY="sixiang_primary_created_v1";
    const page=document.getElementById("creationPage");
    const overlay=document.getElementById("game-overlay-layer");

    if(page&&overlay&&page.parentElement!==overlay){
        overlay.appendChild(page);
    }
    if(page){
        page.dataset.nativePrepaint="v174-dom-only";
    }

    function loadCriticalUiStyle(){
        if(document.getElementById("v174-critical-ui-regression-style")){ return; }
        const link=document.createElement("link");
        link.id="v174-critical-ui-regression-style";
        link.rel="stylesheet";
        link.href="css/56-v174-critical-ui-regressions.css";
        document.head.appendChild(link);
    }

    function primaryState(state,primary,reason){
        return {state,primary:primary||null,reason:reason||""};
    }

    function readPersistedPrimaryCharacter(){
        let raw="";
        let createdMarker="";
        try{
            raw=localStorage.getItem(SAVE_KEY)||"";
            createdMarker=localStorage.getItem(PRIMARY_CREATED_MARKER_KEY)||"";
        }catch(_){
            /* Storage being unreadable must never turn into permission to
               overwrite slot 1. This is intentionally fail-closed. */
            return primaryState("unsafe",null,"storage-unreadable");
        }

        if(!raw){
            /* A stale marker alone must not lock out a deliberate fresh start
               after the canonical save has been removed. */
            return primaryState("empty",null,"no-save");
        }

        let saved=null;
        try{
            saved=JSON.parse(raw);
        }catch(_){
            return primaryState("unsafe",null,"save-json-invalid");
        }

        if(!saved||typeof saved!=="object"||Array.isArray(saved)){
            return primaryState("unsafe",null,"save-shape-invalid");
        }

        const primary=saved.player;
        if(primary===undefined||primary===null){
            /* An empty object is a valid pre-character state in historical
               tests/startup flows. */
            return primaryState("empty",null,"no-primary");
        }
        if(typeof primary!=="object"||Array.isArray(primary)){
            return primaryState("unsafe",null,"primary-shape-invalid");
        }

        const id=String(primary.id||"").trim();
        if(id){
            return primaryState("occupied",primary,"primary-id-present");
        }

        /* The canonical uncreated template is id:"", level:1, exp:0.
           Anything beyond that is evidence of progress or corruption and must
           be protected instead of being treated as an empty slot. */
        const level=Number(primary.level);
        const exp=Number(primary.exp);
        const progressed=(Number.isFinite(level)&&level>1)||(Number.isFinite(exp)&&exp>0);
        const hasSecondary=!!(
            saved.player2&&typeof saved.player2==="object"&&String(saved.player2.id||"").trim()
        )||!!(
            saved.player3&&typeof saved.player3==="object"&&String(saved.player3.id||"").trim()
        );

        if(createdMarker==="1"||progressed||hasSecondary){
            return primaryState("unsafe",primary,"created-primary-identity-missing");
        }

        return primaryState("empty",primary,"blank-primary-template");
    }

    function showPrimaryProtection(state){
        const primary=state&&state.primary;
        const id=String(primary&&primary.id||"").trim();
        const level=Number(primary&&primary.level);
        const occupied=state&&state.state==="occupied";
        const message=occupied
            ?("偵測到既有主角色存檔「"+id+"」"+
                (Number.isFinite(level)&&level>=1?"Lv."+Math.floor(level):"")+"。為避免覆寫原角色，本次創建已取消；請重新整理後繼續遊戲。")
            :"偵測到主角色存檔讀取異常或既有角色痕跡。為避免任何角色資料被覆寫，本次創建已取消；請先重新整理，若仍出現此訊息請保留存檔並停止建立角色。";
        if(typeof window.rpgAlert==="function"){
            void window.rpgAlert(message,{title:"角色存檔保護",confirmText:"知道了",danger:true});
        }else if(typeof window.alert==="function"){
            window.alert(message);
        }
    }

    function markPrimaryCreatedIfPresent(){
        try{
            const runtimePrimary=typeof player!=="undefined"&&player?player:null;
            if(runtimePrimary&&String(runtimePrimary.id||"").trim()){
                localStorage.setItem(PRIMARY_CREATED_MARKER_KEY,"1");
            }
        }catch(_){ }
    }

    function installPrimaryCreationSaveGuard(){
        const current=window.createCharacter;
        if(typeof current!=="function"||current.__v174PersistedPrimaryGuard===true){
            return;
        }

        function guardedCreateCharacter(){
            let targetSlot=1;
            try{
                if(typeof creationTargetSlot!=="undefined"){
                    targetSlot=Math.max(1,Math.floor(Number(creationTargetSlot)||1));
                }
            }catch(_){ }

            const persisted=targetSlot===1?readPersistedPrimaryCharacter():null;
            if(persisted&&(persisted.state==="occupied"||persisted.state==="unsafe")){
                showPrimaryProtection(persisted);
                return false;
            }

            const result=current.apply(this,arguments);
            if(targetSlot===1){
                markPrimaryCreatedIfPresent();
            }
            return result;
        }

        guardedCreateCharacter.__v174PersistedPrimaryGuard=true;
        guardedCreateCharacter.__v174OriginalCreateCharacter=current;
        window.createCharacter=guardedCreateCharacter;
    }

    function loadUiRegressionRuntime(){
        if(document.getElementById("v174-ui-regression-guards-runtime")){ return; }
        const script=document.createElement("script");
        script.id="v174-ui-regression-guards-runtime";
        script.src="js/61-v174-ui-regression-guards.js";
        script.async=false;
        (document.body||document.documentElement).appendChild(script);
    }

    function finalizeBootstrap(){
        installPrimaryCreationSaveGuard();
        loadUiRegressionRuntime();
    }

    loadCriticalUiStyle();

    if(document.readyState==="loading"){
        document.addEventListener("DOMContentLoaded",finalizeBootstrap,{once:true});
    }else{
        finalizeBootstrap();
    }
})();
