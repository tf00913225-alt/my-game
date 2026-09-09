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

    function readPersistedPrimaryCharacter(){
        try{
            const raw=localStorage.getItem("battle_full_version_save_v5");
            if(!raw){ return null; }
            const saved=JSON.parse(raw);
            const primary=saved&&saved.player;
            if(!primary||typeof primary!=="object"){ return null; }
            const id=String(primary.id||"").trim();
            const level=Math.floor(Number(primary.level)||0);
            return id&&level>=1?primary:null;
        }catch(_){
            return null;
        }
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
            if(persisted){
                const message="偵測到既有主角色存檔「"+String(persisted.id||"角色")+"」Lv."+
                    Math.max(1,Math.floor(Number(persisted.level)||1))+"。為避免覆寫原角色，本次創建已取消；請重新整理後繼續遊戲。";
                if(typeof window.rpgAlert==="function"){
                    void window.rpgAlert(message,{title:"角色存檔保護",confirmText:"知道了",danger:true});
                }else if(typeof window.alert==="function"){
                    window.alert(message);
                }
                return false;
            }
            return current.apply(this,arguments);
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
