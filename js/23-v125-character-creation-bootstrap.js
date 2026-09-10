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
        /* Production app-shell CSS owns this style; no runtime stylesheet request. */
        return true;
    }

    function primaryState(state,primary,reason){
        return {state,primary:primary||null,reason:reason||""};
    }

    function readPersistedPrimaryCharacter(){
        let raw="";
        try{
            const repository=window.FourSymbolsAccountSave;
            const active=repository&&repository.readActive();
            if(!active||active.status==="inactive"){ return primaryState("unsafe",null,"account-unresolved"); }
            if(active.status==="empty"){ return primaryState("empty",null,"no-account-save"); }
            raw=JSON.stringify(active.save);
        }catch(_){
            /* Storage being unreadable must never turn into permission to
               overwrite character data. This is intentionally fail-closed. */
            return primaryState("unsafe",null,"storage-unreadable");
        }

        if(!raw){
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
               startup/test flows. */
            return primaryState("empty",null,"no-primary");
        }
        if(typeof primary!=="object"||Array.isArray(primary)){
            return primaryState("unsafe",null,"primary-shape-invalid");
        }

        /* Character ID is the canonical creation identity. Once it exists,
           slot 1 is occupied regardless of whether another field (for example
           level) has become malformed. Never require level to be healthy in
           order to protect an existing character. */
        const id=String(primary.id||"").trim();
        if(id){
            return primaryState("occupied",primary,"primary-id-present");
        }

        /* The canonical uncreated template is id:"", level:1, exp:0.
           If identity is missing but progress/secondary-character evidence is
           present, treat the save as unsafe instead of assuming the slot is
           free. This prevents a partially damaged save from being overwritten. */
        const level=Number(primary.level);
        const exp=Number(primary.exp);
        const progressed=(Number.isFinite(level)&&level>1)||(Number.isFinite(exp)&&exp>0);
        const hasSecondary=!!(
            saved.player2&&typeof saved.player2==="object"&&String(saved.player2.id||"").trim()
        )||!!(
            saved.player3&&typeof saved.player3==="object"&&String(saved.player3.id||"").trim()
        );

        if(progressed||hasSecondary){
            return primaryState("unsafe",primary,"primary-identity-missing");
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
            :"偵測到角色存檔讀取異常或既有角色痕跡。為避免任何角色資料被覆寫，本次創建已取消；請先重新整理，若仍出現此訊息請保留存檔並停止建立角色。";
        if(typeof window.rpgAlert==="function"){
            void window.rpgAlert(message,{title:"角色存檔保護",confirmText:"知道了",danger:true});
        }else if(typeof window.alert==="function"){
            window.alert(message);
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

            const persisted=readPersistedPrimaryCharacter();

            /* An unreadable/corrupt canonical save blocks every character
               creation path, because createAdditionalCharacter eventually
               saves through the same canonical key. A healthy occupied primary
               blocks only slot 1; slot 2/3 remain legitimate additions. */
            if(
                persisted.state==="unsafe"||
                (targetSlot===1&&persisted.state==="occupied")
            ){
                showPrimaryProtection(persisted);
                return false;
            }

            return current.apply(this,arguments);
        }

        guardedCreateCharacter.__v174PersistedPrimaryGuard=true;
        guardedCreateCharacter.__v174OriginalCreateCharacter=current;
        window.createCharacter=guardedCreateCharacter;
    }

    function finalizeBootstrap(){
        installPrimaryCreationSaveGuard();
    }

    loadCriticalUiStyle();

    if(document.readyState==="loading"){
        document.addEventListener("DOMContentLoaded",finalizeBootstrap,{once:true});
    }else{
        finalizeBootstrap();
    }
})();
