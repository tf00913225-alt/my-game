/* Account-aware local save owner. Gameplay schema stays unchanged; ownership lives beside it. */
(function installAccountSaveRepository(global){
    "use strict";
    if(!global || global.FourSymbolsAccountSave){ return; }

    const LEGACY_KEY="battle_full_version_save_v5";
    const PREFIX="four_symbols_save:";
    const META_PREFIX="four_symbols_save_meta:";
    const BACKUP_PREFIX="four_symbols_legacy_backup:";
    const ACTIVE_UID_KEY="four_symbols_active_uid";
    const SCHEMA_VERSION=1;
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
        const raw=JSON.stringify(save);
        const metadata=JSON.stringify({
            schemaVersion:SCHEMA_VERSION,
            ownerUid:uid,
            source:String(options.source||"local"),
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
        migrateLegacyToUid,removeActive,accountKey,LEGACY_SIDECARS
    });
})(typeof window!=="undefined"?window:globalThis);
