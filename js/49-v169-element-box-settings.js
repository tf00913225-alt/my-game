/* =====================================================
   V169 / V173.42 — Element Box settings ownership
   - Auto action remains per character.
   - HP / SP potion thresholds + return-home are shared by the whole party.
   - Settings are locked while Element Box is active; stop first to edit.
===================================================== */
(function installV169ElementBoxSettings(){
    "use strict";

    if(typeof window==="undefined"||typeof document==="undefined"||window.__v169ElementBoxSettingsInstalled){ return; }
    window.__v169ElementBoxSettingsInstalled=true;

    const SETTINGS_PANEL_ID="autoBattleSettingsPanel";
    const STOP_BUTTON_ID="v169ElementBoxStopButton";
    const LOCK_NOTICE_ID="v17342ElementBoxLockNotice";
    const CONTROL_IDS=["autoSettingsCharacterSelect","autoSettingsActionSelect","autoSettingsHP","autoSettingsSP","autoSettingsReturnCity"];
    const IMMEDIATE_FIELD_IDS=["autoSettingsActionSelect","autoSettingsHP","autoSettingsSP","autoSettingsReturnCity"];
    const LOCKED_SETTING_SELECTOR=".auto-setting-card,.auto-threshold-card,.auto-return-card";

    function elementBoxIsActive(){
        if(typeof window.v131GetElementBoxState==="function"){
            try{ const state=window.v131GetElementBoxState(); if(state&&state.active){ return true; } }catch(_){ }
        }
        return typeof autoBattle!=="undefined"&&!!autoBattle;
    }

    function selectedCharacterIndex(){
        const select=document.getElementById("autoSettingsCharacterSelect");
        if(!select){ return null; }
        const index=Number(select.value);
        if(!Number.isInteger(index)||index<0||index>2){ return null; }
        if(typeof getPartyCharacterByIndex==="function"&&!getPartyCharacterByIndex(index)){ return null; }
        return index;
    }

    function existingIndexes(){
        if(typeof getExistingPartyIndexes==="function"){ return getExistingPartyIndexes().slice(0,3); }
        return [0,1,2].filter(index=>typeof getPartyCharacterByIndex!=="function"||!!getPartyCharacterByIndex(index));
    }

    function sharedSourceConfig(){
        if(typeof getPartyAutoConfig!=="function"){ return null; }
        const indexes=existingIndexes();
        return getPartyAutoConfig(indexes.length?indexes[0]:0)||null;
    }

    function syncSharedRecoveryForm(){
        const config=sharedSourceConfig();
        if(!config){ return; }
        const hp=document.getElementById("autoSettingsHP");
        const sp=document.getElementById("autoSettingsSP");
        const back=document.getElementById("autoSettingsReturnCity");
        if(hp){ hp.value=String(config.hp==null?50:config.hp); }
        if(sp){ sp.value=String(config.sp==null?25:config.sp); }
        if(back){ back.checked=!!config.returnToCityWhenEmpty; }
    }

    function writeSharedRecoveryFromForm(){
        if(typeof getPartyAutoConfig!=="function"){ return; }
        const hp=document.getElementById("autoSettingsHP");
        const sp=document.getElementById("autoSettingsSP");
        const back=document.getElementById("autoSettingsReturnCity");
        const hpValue=hp?Number(hp.value):50;
        const spValue=sp?Number(sp.value):25;
        const returnValue=!!(back&&back.checked);
        existingIndexes().forEach(index=>{
            const config=getPartyAutoConfig(index);
            if(!config){ return; }
            config.hp=hpValue;
            config.sp=spValue;
            config.returnToCityWhenEmpty=returnValue;
        });
    }

    function normalizeSharedRecoveryAcrossParty(){
        syncSharedRecoveryForm();
        writeSharedRecoveryFromForm();
    }

    function notifyLocked(){
        alert("先停止元素匣，才能設定");
    }

    function persistSelectedCharacterSettings(){
        if(elementBoxIsActive()){ notifyLocked(); syncSharedRecoveryForm(); return false; }
        const index=selectedCharacterIndex();
        if(index===null||typeof saveAutoSettingsFormToCharacter!=="function"){ return false; }
        saveAutoSettingsFormToCharacter(index);
        writeSharedRecoveryFromForm();
        if(typeof saveGame==="function"){ saveGame(); }
        return true;
    }
    window.v169PersistElementBoxSettings=persistSelectedCharacterSettings;

    function bindImmediatePersistence(){
        IMMEDIATE_FIELD_IDS.forEach(id=>{
            const field=document.getElementById(id);
            if(!field||typeof field.addEventListener!=="function"||field.dataset.v169ImmediateSave==="1"){ return; }
            field.dataset.v169ImmediateSave="1";
            field.addEventListener("change",()=>{
                if(elementBoxIsActive()){ notifyLocked(); syncSharedRecoveryForm(); return; }
                persistSelectedCharacterSettings();
            });
        });
    }

    function bindLockedInteractionGuard(){
        const panel=document.getElementById(SETTINGS_PANEL_ID);
        if(!panel||typeof panel.addEventListener!=="function"||panel.dataset.v17342LockGuard==="1"){ return; }
        panel.dataset.v17342LockGuard="1";
        panel.addEventListener("click",event=>{
            if(!elementBoxIsActive()){ return; }
            const target=event&&event.target;
            if(!target||typeof target.closest!=="function"){ return; }
            if(target.closest("#"+STOP_BUTTON_ID)){ return; }
            const setting=target.closest(LOCKED_SETTING_SELECTOR);
            if(!setting||typeof panel.contains==="function"&&!panel.contains(setting)){ return; }
            if(typeof event.preventDefault==="function"){ event.preventDefault(); }
            if(typeof event.stopPropagation==="function"){ event.stopPropagation(); }
            notifyLocked();
            syncSharedRecoveryForm();
        },true);
    }

    if(typeof switchAutoSettingsCharacter==="function"){
        const previous=switchAutoSettingsCharacter;
        switchAutoSettingsCharacter=function(initializing){
            /* openHomeFeature('autoBattleSettings') uses true only to populate the
               existing form. That initialization is not a player edit and must
               never show the locked warning. */
            if(elementBoxIsActive()&&initializing!==true){ notifyLocked(); return false; }
            const result=previous.apply(this,arguments);
            syncSharedRecoveryForm();
            if(!elementBoxIsActive()&&typeof saveGame==="function"){ saveGame(); }
            return result;
        };
    }

    function settingsPanelIsVisible(){
        const panel=document.getElementById(SETTINGS_PANEL_ID);
        return !!(panel&&panel.style&&panel.style.display!=="none");
    }

    let closeSaveDepth=0;
    function wrapCloseWithSave(previousClose){
        return function(){
            if(closeSaveDepth===0&&settingsPanelIsVisible()&&!elementBoxIsActive()){ persistSelectedCharacterSettings(); }
            closeSaveDepth++;
            try{ return previousClose.apply(this,arguments); }
            finally{ closeSaveDepth--; }
        };
    }
    if(typeof closeHomeFeature==="function"){ closeHomeFeature=wrapCloseWithSave(closeHomeFeature); }
    if(typeof closeAutoBattleSettings==="function"){ closeAutoBattleSettings=wrapCloseWithSave(closeAutoBattleSettings); }

    function ensureStopButton(){
        let button=document.getElementById(STOP_BUTTON_ID);
        if(button){ return button; }
        const panel=document.getElementById(SETTINGS_PANEL_ID);
        const status=panel&&panel.querySelector?panel.querySelector(".auto-premium-status"):null;
        if(!status||typeof document.createElement!=="function"){ return null; }
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

    function ensureLockNotice(){
        let notice=document.getElementById(LOCK_NOTICE_ID);
        if(notice){ return notice; }
        const panel=document.getElementById(SETTINGS_PANEL_ID);
        if(!panel||typeof document.createElement!=="function"){ return null; }
        notice=document.createElement("div");
        notice.id=LOCK_NOTICE_ID;
        notice.className="v17342-element-box-lock-notice";
        notice.textContent="元素匣運作中：先停止元素匣，才能修改設定";
        notice.hidden=true;
        const shared=panel.querySelector&&panel.querySelector(".v17342-element-box-shared");
        panel.insertBefore(notice,shared||panel.firstChild||null);
        return notice;
    }

    function syncElementBoxSettingControls(){
        const active=elementBoxIsActive();
        const primary=document.getElementById("autoBattleButton");
        const stopButton=ensureStopButton();
        const notice=ensureLockNotice();
        const panel=document.getElementById(SETTINGS_PANEL_ID);
        const status=panel&&panel.querySelector?panel.querySelector(".auto-premium-status"):null;

        /* Keep setting controls technically enabled so taps reach the capture
           guard and can explain the lock. The guard prevents the edit itself. */
        CONTROL_IDS.forEach(id=>{
            const field=document.getElementById(id);
            if(!field){ return; }
            field.disabled=false;
            field.setAttribute("aria-disabled",active?"true":"false");
            field.dataset.v169Locked=active?"1":"0";
        });
        if(primary){
            primary.setAttribute("onclick","v169SaveElementBoxSettings()");
            primary.textContent=active?"先停止後設定":"套用並啟動";
            primary.disabled=active;
            primary.classList.toggle("active",active);
            primary.dataset.v169Mode=active?"locked":"activate";
        }
        if(stopButton){ stopButton.hidden=!active; stopButton.classList.toggle("active",active); }
        if(notice){ notice.hidden=!active; }
        if(status){ status.classList.toggle("v169-element-box-active",active); }
        if(panel){ panel.classList.toggle("v17342-settings-locked",active); }
        syncSharedRecoveryForm();
    }
    window.v169SyncElementBoxSettingControls=syncElementBoxSettingControls;

    window.v169SaveElementBoxSettings=function(){
        if(elementBoxIsActive()){ notifyLocked(); return false; }
        persistSelectedCharacterSettings();
        if(typeof confirmAutoBattleSettings==="function"){ return confirmAutoBattleSettings(); }
        return true;
    };

    window.v169StopElementBox=function(){
        if(!elementBoxIsActive()||typeof toggleAutoBattle!=="function"){ syncElementBoxSettingControls(); return false; }
        if(typeof autoBattle!=="undefined"&&!autoBattle){ autoBattle=true; }
        const result=toggleAutoBattle();
        syncElementBoxSettingControls();
        return result;
    };

    if(typeof updateAutoButton==="function"){
        const previous=updateAutoButton;
        updateAutoButton=function(){ const result=previous.apply(this,arguments); syncElementBoxSettingControls(); return result; };
    }

    function afterOpen(type){
        if(type!=="autoBattleSettings"){ return; }
        bindImmediatePersistence();
        bindLockedInteractionGuard();
        syncElementBoxSettingControls();
    }
    if(typeof openHomeFeature==="function"){
        const previous=openHomeFeature;
        openHomeFeature=function(type){ const result=previous.apply(this,arguments); afterOpen(type); return result; };
    }
    if(typeof openAutoBattleSettings==="function"){
        const previous=openAutoBattleSettings;
        openAutoBattleSettings=function(){ const result=previous.apply(this,arguments); afterOpen("autoBattleSettings"); return result; };
    }

    normalizeSharedRecoveryAcrossParty();
    bindImmediatePersistence();
    bindLockedInteractionGuard();
    syncElementBoxSettingControls();
})();
