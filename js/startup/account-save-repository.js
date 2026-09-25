/* Account-aware local save owner. Gameplay schema stays unchanged; ownership lives beside it. */
(function installAccountSaveRepository(global){
    "use strict";
    if(!global || global.FourSymbolsAccountSave){ return; }

    const LEGACY_KEY="battle_full_version_save_v5";
    const PREFIX="four_symbols_save:";
    const META_PREFIX="four_symbols_save_meta:";
    const BACKUP_PREFIX="four_symbols_legacy_backup:";
    const MIGRATION_BACKUP_PREFIX="four_symbols_migration_backup:";
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
    const BACKUP_SIDECARS=Object.freeze([...new Set([...Object.values(LEGACY_SIDECARS),"patrol-character-index"])]);
    const PLAIN_SIDECARS=new Set(["announcement-read","bulk-sell-quality","patrol-character-index"]);

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
    /* Original-device safety copy only.  This is never a cloud authority. */
    function migrationBackupKeyFor(uid,mainFingerprint,manifestFingerprint){
        uid=validUid(uid);
        if(!/^v1:[0-9a-f]+:[0-9a-f]{32}$/.test(mainFingerprint||"")){
            throw coded("migration-backup-fingerprint-invalid","Migration backup requires a verified main-save fingerprint.");
        }
        return MIGRATION_BACKUP_PREFIX+uid+":"+mainFingerprint+(manifestFingerprint?":"+manifestFingerprint:"");
    }
    function verifyMigrationBackup(uid,backupKey){
        uid=validUid(uid);
        if(getActiveUid()!==uid){ throw coded("account-not-active","Backup owner is not active."); }
        if(typeof backupKey!=="string"||!backupKey.startsWith(MIGRATION_BACKUP_PREFIX+uid+":")){
            throw coded("migration-backup-owner-mismatch","Backup does not belong to this UID.");
        }
        let backup;
        try{ backup=JSON.parse(storage().getItem(backupKey)); }
        catch(_){ throw coded("migration-backup-corrupt","Backup is corrupt."); }
        if(!backup||backup.schemaVersion!==2||backup.ownerUid!==uid||
           !backup.mainRaw||!backup.metadataRaw||!backup.sidecars){
            throw coded("migration-backup-corrupt","Backup is incomplete.");
        }
        const main=parseSave(backup.mainRaw,"migration-backup-corrupt");
        const metadata=parseSave(backup.metadataRaw,"migration-backup-corrupt");
        if(metadata.ownerUid!==uid||fingerprint(main)!==backup.mainFingerprint){
            throw coded("migration-backup-corrupt","Backup ownership or main fingerprint changed.");
        }
        const keys=Object.keys(backup.sidecars).sort();
        if(keys.join("|")!==[...BACKUP_SIDECARS].sort().join("|")){
            throw coded("migration-backup-corrupt","Backup sidecar inventory is incomplete.");
        }
        for(const suffix of keys){
            const item=backup.sidecars[suffix];
            if(!item||!(["present","missing"].includes(item.status))||
               (item.status==="missing"?item.raw!==null:typeof item.raw!=="string")){
                throw coded("migration-backup-corrupt","Backup sidecar record is invalid.");
            }
            if(item.status==="present"&&!PLAIN_SIDECARS.has(suffix)){
                parseSave(item.raw,"migration-backup-sidecar-corrupt");
            }
        }
        const manifestFingerprint=fingerprint(backup.sidecars);
        if(manifestFingerprint!==backup.sidecarManifestFingerprint||
           migrationBackupKeyFor(uid,backup.mainFingerprint,manifestFingerprint)!==backupKey){
            throw coded("migration-backup-corrupt","Backup manifest changed.");
        }
        return Object.freeze({...backup,backupKey});
    }
    function createMigrationBackup(uid){
        uid=validUid(uid);
        if(getActiveUid()!==uid){ throw coded("account-not-active","Refusing to back up a non-active account save."); }
        const local=readForUid(uid);
        if(local.status!=="ready"){ throw coded("migration-backup-save-required","A complete UID-owned local save is required."); }
        const mainRaw=storage().getItem(saveKey(uid));
        const metadataRaw=storage().getItem(metadataKey(uid));
        const mainFingerprint=fingerprint(local.save);
        const sidecars={};
        for(const suffix of BACKUP_SIDECARS){
            const key=accountKey(suffix,uid);
            const raw=storage().getItem(key);
            if(raw===null){ sidecars[suffix]={status:"missing",raw:null}; continue; }
            if(!PLAIN_SIDECARS.has(suffix)){ parseSave(raw,"migration-backup-sidecar-corrupt"); }
            sidecars[suffix]={status:"present",raw};
        }
        const sidecarManifestFingerprint=fingerprint(sidecars);
        const backupKey=migrationBackupKeyFor(uid,mainFingerprint,sidecarManifestFingerprint);
        const existing=storage().getItem(backupKey);
        if(existing){
            const verified=verifyMigrationBackup(uid,backupKey);
            if(verified.mainRaw!==mainRaw||verified.metadataRaw!==metadataRaw){
                throw coded("migration-backup-conflict","An existing migration backup cannot be verified.");
            }
            return Object.freeze({...verified,unchanged:true});
        }
        const backup=Object.freeze({
            schemaVersion:2,ownerUid:uid,mainFingerprint,sidecarManifestFingerprint,mainRaw,metadataRaw,
            sidecars,createdAt:Date.now()
        });
        try{ storage().setItem(backupKey,JSON.stringify(backup)); }
        catch(error){ throw coded("migration-backup-write-failed","The immutable migration backup could not be stored.",error); }
        return Object.freeze({...verifyMigrationBackup(uid,backupKey),unchanged:false});
    }
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
        migrateLegacyToUid,removeActive,accountKey,fingerprint,LEGACY_SIDECARS,
        migrationBackupKeyFor,createMigrationBackup,verifyMigrationBackup,BACKUP_SIDECARS
    });
})(typeof window!=="undefined"?window:globalThis);
