/* =====================================================
   V169 — Element Box per-character settings persistence
===================================================== */
(function installV169ElementBoxSettings(){
    "use strict";

    if(
        typeof window==="undefined"||
        typeof document==="undefined"||
        window.__v169ElementBoxSettingsInstalled
    ){
        return;
    }
    window.__v169ElementBoxSettingsInstalled=true;

    const SETTINGS_PANEL_ID="autoBattleSettingsPanel";
    const STOP_BUTTON_ID="v169ElementBoxStopButton";
    const IMMEDIATE_FIELD_IDS=[
        "autoSettingsActionSelect",
        "autoSettingsHP",
        "autoSettingsSP",
        "autoSettingsReturnCity"
    ];

    function selectedCharacterIndex(){
        const characterSelect=document.getElementById("autoSettingsCharacterSelect");
        if(!characterSelect){ return null; }

        const characterIndex=Number(characterSelect.value);
        if(!Number.isInteger(characterIndex)||characterIndex<0||characterIndex>2){
            return null;
        }
        if(
            typeof getPartyCharacterByIndex==="function"&&
            !getPartyCharacterByIndex(characterIndex)
        ){
            return null;
        }
        return characterIndex;
    }

    function persistSelectedCharacterSettings(){
        const characterIndex=selectedCharacterIndex();
        if(
            characterIndex===null||
            typeof saveAutoSettingsFormToCharacter!=="function"
        ){
            return false;
        }

        saveAutoSettingsFormToCharacter(characterIndex);
        if(typeof saveGame==="function"){
            saveGame();
        }
        return true;
    }
    window.v169PersistElementBoxSettings=persistSelectedCharacterSettings;

    function bindImmediatePersistence(){
        IMMEDIATE_FIELD_IDS.forEach(id=>{
            const field=document.getElementById(id);
            if(
                !field||
                typeof field.addEventListener!=="function"||
                field.dataset.v169ImmediateSave==="1"
            ){
                return;
            }
            field.dataset.v169ImmediateSave="1";
            field.addEventListener("change",persistSelectedCharacterSettings);
        });
    }

    /* The original switch already writes the outgoing form into that
       character's config. Persist immediately after it does so, instead of
       waiting for a later Apply click that may never happen. */
    if(typeof switchAutoSettingsCharacter==="function"){
        const previousSwitchAutoSettingsCharacter=switchAutoSettingsCharacter;
        switchAutoSettingsCharacter=function(){
            const result=previousSwitchAutoSettingsCharacter.apply(this,arguments);
            if(typeof saveGame==="function"){
                saveGame();
            }
            return result;
        };
    }

    function settingsPanelIsVisible(){
        const panel=document.getElementById(SETTINGS_PANEL_ID);
        return !!(
            panel&&
            panel.style&&
            panel.style.display!=="none"
        );
    }

    /* Both the shared home modal and the legacy battle overlay can own this
       panel. Save once before either close path restores/hides the DOM node. */
    let closeSaveDepth=0;
    function wrapCloseWithSave(previousClose){
        return function(){
            if(closeSaveDepth===0&&settingsPanelIsVisible()){
                persistSelectedCharacterSettings();
            }
            closeSaveDepth++;
            try{
                return previousClose.apply(this,arguments);
            }finally{
                closeSaveDepth--;
            }
        };
    }

    if(typeof closeHomeFeature==="function"){
        closeHomeFeature=wrapCloseWithSave(closeHomeFeature);
    }
    if(typeof closeAutoBattleSettings==="function"){
        closeAutoBattleSettings=wrapCloseWithSave(closeAutoBattleSettings);
    }

    function elementBoxIsActive(){
        if(typeof window.v131GetElementBoxState==="function"){
            try{
                const state=window.v131GetElementBoxState();
                if(state&&state.active){ return true; }
            }catch(_){ }
        }
        return typeof autoBattle!=="undefined"&&!!autoBattle;
    }

    function ensureStopButton(){
        let button=document.getElementById(STOP_BUTTON_ID);
        if(button){ return button; }

        const panel=document.getElementById(SETTINGS_PANEL_ID);
        const status=panel&&typeof panel.querySelector==="function"
            ?panel.querySelector(".auto-premium-status")
            :null;
        if(!status||typeof document.createElement!=="function"){
            return null;
        }

        button=document.createElement("button");
        button.id=STOP_BUTTON_ID;
        button.type="button";
        button.className="v169-element-box-stop";
        button.textContent="停止元素匣";
        button.hidden=true;
        button.setAttribute("aria-label","停止元素匣");
        button.addEventListener("click",()=>window.v169StopElementBox());
        status.appendChild(button);
        return button;
    }

    function syncElementBoxSettingControls(){
        const active=elementBoxIsActive();
        const primary=document.getElementById("autoBattleButton");
        const stopButton=ensureStopButton();
        const panel=document.getElementById(SETTINGS_PANEL_ID);
        const status=panel&&typeof panel.querySelector==="function"
            ?panel.querySelector(".auto-premium-status")
            :null;

        if(primary){
            primary.setAttribute("onclick","v169SaveElementBoxSettings()");
            primary.textContent=active?"儲存設定":"套用並啟動";
            primary.classList.toggle("active",active);
            primary.dataset.v169Mode=active?"save":"activate";
        }
        if(stopButton){
            stopButton.hidden=!active;
            stopButton.classList.toggle("active",active);
        }
        if(status){
            status.classList.toggle("v169-element-box-active",active);
        }
    }
    window.v169SyncElementBoxSettingControls=syncElementBoxSettingControls;

    window.v169SaveElementBoxSettings=function(){
        persistSelectedCharacterSettings();
        if(typeof confirmAutoBattleSettings==="function"){
            return confirmAutoBattleSettings();
        }
    };

    window.v169StopElementBox=function(){
        persistSelectedCharacterSettings();
        if(!elementBoxIsActive()||typeof toggleAutoBattle!=="function"){
            syncElementBoxSettingControls();
            return false;
        }

        /* winBattle() can temporarily clear autoBattle while the V131 Element
           Box session remains active. Normalize that transient state so the
           existing toggle path performs a real stop (and clears all party
           enabled flags) instead of accidentally starting it again. */
        if(typeof autoBattle!=="undefined"&&!autoBattle){
            autoBattle=true;
        }
        const result=toggleAutoBattle();
        syncElementBoxSettingControls();
        return result;
    };

    if(typeof updateAutoButton==="function"){
        const previousUpdateAutoButton=updateAutoButton;
        updateAutoButton=function(){
            const result=previousUpdateAutoButton.apply(this,arguments);
            syncElementBoxSettingControls();
            return result;
        };
    }
    if(typeof openHomeFeature==="function"){
        const previousOpenHomeFeature=openHomeFeature;
        openHomeFeature=function(type){
            const result=previousOpenHomeFeature.apply(this,arguments);
            if(type==="autoBattleSettings"){
                bindImmediatePersistence();
                syncElementBoxSettingControls();
            }
            return result;
        };
    }
    if(typeof openAutoBattleSettings==="function"){
        const previousOpenAutoBattleSettings=openAutoBattleSettings;
        openAutoBattleSettings=function(){
            const result=previousOpenAutoBattleSettings.apply(this,arguments);
            bindImmediatePersistence();
            syncElementBoxSettingControls();
            return result;
        };
    }

    bindImmediatePersistence();
    syncElementBoxSettingControls();
})();
