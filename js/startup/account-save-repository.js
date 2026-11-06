/* Account-aware local save owner. Gameplay schema stays unchanged; ownership lives beside it. */
(function installAccountSaveRepository(global){
    "use strict";
    // Boot budget aliases keep all original error strings and public property names unchanged.
    const Q0="account-save-corrupt",Q1="account-save-fingerprint-failed",Q2="account-migration-marker-corrupt",Q3="Migration marker is invalid.",Q4="account-not-active",Q5="Backup owner is not active.",Q6="migration-backup-corrupt",Q7="migration-backup-sidecar-corrupt",Q8="migration-backup-conflict",Q9="migration-backup-write-failed",Q10="account-save-reentrant",Q11="A migration is already in progress.",Q12="migration-recovery-ambiguous",Q13="account-metadata-corrupt",Q14="Account save metadata is corrupt.";
    if(!global || global.FourSymbolsAccountSave){ return; }

    const LK="battle_full_version_save_v5";
    const PREFIX="four_symbols_save:";
    const MT="four_symbols_save_meta:";
    const BP="four_symbols_legacy_backup:";
    const MB="four_symbols_migration_backup:";
    const AU="four_symbols_active_uid";
    const MIGRATION_PENDING_PREFIX="four_symbols_migration_pending:";
    const SV=2;
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
    const BS=Object.freeze([...new Set([...Object.values(LEGACY_SIDECARS),"patrol-character-index"])]);
    const PS=new Set(["announcement-read","bulk-sell-quality","patrol-character-index"]);

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
        }catch(cause){ throw coded(code||Q0,"Stored save is not valid JSON.",cause); }
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
        catch(cause){ if(cause&&cause.code){ throw cause; } throw coded(Q1,"Save fingerprint could not be calculated.",cause); }
        if(!serialized){ throw coded(Q1,"Save fingerprint requires a JSON payload."); }
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
    function metadataKey(uid){ return MT+validUid(uid); }
    function getActiveUid(){
        const value=storage().getItem(AU);
        return value ? validUid(value) : null;
    }
    function activate(uid){
        uid=validUid(uid); storage().setItem(AU,uid); return uid;
    }
    function deactivate(){ storage().removeItem(AU); }
    // Fail closed even when no main/meta exists. There is no public bypass or
    // automatic recovery; an absent key is the only non-pending state.
    function assertNoMigrationPending(uid){
        uid=validUid(uid);
        if(global.FourSymbolsAccountSaveOperations?.localWriteIsUnresolved?.(uid)){
            throw coded("account-local-write-fenced","A local save result is unresolved in this page.");
        }
        if(global.FourSymbolsAccountSaveOperations?.migrationIsUnresolved?.(uid)){
            throw coded("account-migration-commit-unknown","Migration completion is unresolved in this page.");
        }
        const raw=storage().getItem(MIGRATION_PENDING_PREFIX+uid);
        if(raw===null){ return; }
        if(raw.length>512||!/^[\x00-\x7f]*$/.test(raw)){
            throw coded(Q2,Q3);
        }
        let marker;
        try{ marker=JSON.parse(raw); }catch(cause){ throw coded(Q2,"Migration marker is malformed.",cause); }
        if(!marker||typeof marker!=="object"||Array.isArray(marker)||
           Object.keys(marker).sort().join("|")!=="kind|ownerUid|transactionId|version"||
           marker.version!==1||marker.kind!=="legacy"||marker.ownerUid!==uid||
           typeof marker.transactionId!=="string"||!/^[a-f0-9]{32}$/.test(marker.transactionId)){
            throw coded(Q2,Q3);
        }
        throw coded("account-migration-incomplete","An incomplete migration must be preserved for recovery.");
    }
    function readForUid(uid){
        uid=validUid(uid);
        assertNoMigrationPending(uid);
        const raw=storage().getItem(saveKey(uid));
        const mr=storage().getItem(metadataKey(uid));
        // Presence, including a malformed/false marker, is never a committed save.
        // Check before the empty/incomplete branches so orphan markers stay blocked.
        if(mr!==null){
            let staged;
            try{ staged=JSON.parse(mr); }
            catch(cause){ throw coded(Q13,Q14,cause); }
            if(staged&&Object.prototype.hasOwnProperty.call(staged,"localWritePending")){
                const marker=staged.localWritePending;
                if(!marker||typeof marker!=="object"||Array.isArray(marker)||
                   Object.keys(marker).join("|")!=="version"||marker.version!==1){
                    throw coded(Q13,"Local save marker is malformed.");
                }
                throw coded("account-local-write-incomplete","An interrupted local save must be preserved for recovery.");
            }
        }
        if(!raw&&!mr){ return {status:"empty",uid,save:null,metadata:null}; }
        if(!raw||!mr){
            throw coded("account-save-incomplete","Local account save and ownership metadata are incomplete.");
        }
        const save=parseSave(raw,Q0);
        let metadata=null;
        try{ metadata=JSON.parse(mr); }
        catch(cause){ throw coded(Q13,Q14,cause); }
        if(!metadata || metadata.ownerUid!==uid){
            throw coded("account-owner-mismatch","Local save ownership cannot be verified.");
        }
        if(metadata.cloudAdoptionPending===true){
            throw coded("account-cloud-adoption-incomplete","Cloud adoption is incomplete; the original backup must be retained.");
        }
        const cloudSidecarsFingerprint=metadata.cloudState?fingerprint(Object.fromEntries(BS.map(name=>{
            const value=storage().getItem(accountKey(name,uid));
            return [name,value===null?{status:"missing",raw:null}:{status:"present",raw:value}];
        }))):null;
        return {status:"ready",uid,save,metadata,...(metadata.cloudState?{cloudSidecarsFingerprint}:{})};
    }
    function readActive(){
        const uid=getActiveUid();
        return uid ? readForUid(uid) : {status:"inactive",uid:null,save:null,metadata:null};
    }
    // Transport/schema screening only, never publication or reward authority.
    function writerOperations(){
 const value=global.FourSymbolsAccountSaveOperations;
 if(!value)throw coded("account-writer-unavailable","Account writer must load before any save operation.");
 return value;
 }
 function writerContext(){return {validUid,coded,storage,getActiveUid,saveKey,metadataKey,readForUid,fingerprint,createMigrationBackup,accountKey,SCHEMA_VERSION:SV,BACKUP_SIDECARS:BS,PLAIN_SIDECARS:PS,parseSave,inspectLegacy,activate,migrationBackupKey,LEGACY_KEY:LK,LEGACY_SIDECARS,MIGRATION_PENDING_PREFIX};}
 function inspectCloudBundle(uid,bundle){return writerOperations().inspectCloudBundle(writerContext(),uid,bundle);}
 function writeForUid(uid,save,options={}){return writerOperations().writeForUid(writerContext(),uid,save,options);}

    function inspectLegacy(){
        let raw;
        try{ raw=storage().getItem(LK); }
        catch(cause){ return {status:"error",save:null,raw:null,error:coded("legacy-unavailable","Legacy save cannot be inspected.",cause)}; }
        if(!raw){ return {status:"none",save:null,raw:null,error:null}; }
        try{ return {status:"available",save:parseSave(raw,"legacy-corrupt"),raw,error:null}; }
        catch(error){ return {status:"corrupt",save:null,raw,error}; }
    }
    function migrationBackupKey(uid,transactionId){
        uid=validUid(uid);
        if(typeof transactionId!=="string"||!/^[a-f0-9]{32}$/.test(transactionId))throw coded("migration-identity-invalid","Migration backup identity is invalid.");
        return BP+uid+":"+transactionId;
    }
    /* Original-device safety copy only.  This is never a cloud authority. */
    function migrationBackupKeyFor(uid,gf,mf){
        uid=validUid(uid);
        if(!/^v1:[0-9a-f]+:[0-9a-f]{32}$/.test(gf||"")){
            throw coded("migration-backup-fingerprint-invalid","Migration backup requires a verified main-save fingerprint.");
        }
        return MB+uid+":"+gf+(mf?":"+mf:"");
    }
    function verifyMigrationBackup(uid,bk){
        uid=validUid(uid);
        if(getActiveUid()!==uid){ throw coded(Q4,Q5); }
        if(typeof bk!=="string"||!bk.startsWith(MB+uid+":")){
            throw coded("migration-backup-owner-mismatch","Backup does not belong to this UID.");
        }
        let backup;
        try{ backup=JSON.parse(storage().getItem(bk)); }
        catch(_){ throw coded(Q6,"Backup is corrupt."); }
        if(!backup||backup.schemaVersion!==2||backup.ownerUid!==uid||
           !backup.mainRaw||!backup.metadataRaw||!backup.sidecars){
            throw coded(Q6,"Backup is incomplete.");
        }
        const main=parseSave(backup.mainRaw,Q6);
        const metadata=parseSave(backup.metadataRaw,Q6);
        if(metadata.ownerUid!==uid||fingerprint(main)!==backup.mainFingerprint){
            throw coded(Q6,"Backup ownership or main fingerprint changed.");
        }
        const keys=Object.keys(backup.sidecars).sort();
        if(keys.join("|")!==[...BS].sort().join("|")){
            throw coded(Q6,"Backup sidecar inventory is incomplete.");
        }
        for(const suffix of keys){
            const item=backup.sidecars[suffix];
            if(!item||!(["present","missing"].includes(item.status))||
               (item.status==="missing"?item.raw!==null:typeof item.raw!=="string")){
                throw coded(Q6,"Backup sidecar record is invalid.");
            }
            if(item.status==="present"&&!PS.has(suffix)){
                parseSave(item.raw,Q7);
            }
        }
        const mf=fingerprint(backup.sidecars);
        if(mf!==backup.sidecarManifestFingerprint||
           migrationBackupKeyFor(uid,backup.mainFingerprint,mf)!==bk){
            throw coded(Q6,"Backup manifest changed.");
        }
        return Object.freeze({...backup,backupKey:bk});
    }
    function createMigrationBackup(uid){
        uid=validUid(uid);
        if(getActiveUid()!==uid){ throw coded(Q4,"Refusing to back up a non-active account save."); }
        const local=readForUid(uid);
        if(local.status!=="ready"){ throw coded("migration-backup-save-required","A complete UID-owned local save is required."); }
        const mainRaw=storage().getItem(saveKey(uid));
        const mr=storage().getItem(metadataKey(uid));
        const gf=fingerprint(local.save);
        const sidecars={};
        for(const suffix of BS){
            const key=accountKey(suffix,uid);
            const raw=storage().getItem(key);
            if(raw===null){ sidecars[suffix]={status:"missing",raw:null}; continue; }
            if(!PS.has(suffix)){ parseSave(raw,Q7); }
            sidecars[suffix]={status:"present",raw};
        }
        const smf=fingerprint(sidecars);
        const bk=migrationBackupKeyFor(uid,gf,smf);
        const existing=storage().getItem(bk);
        if(existing){
            const verified=verifyMigrationBackup(uid,bk);
            if(verified.mainRaw!==mainRaw||verified.metadataRaw!==mr){
                throw coded(Q8,"An existing migration backup cannot be verified.");
            }
            return Object.freeze({...verified,unchanged:true});
        }
        const backup=Object.freeze({
            schemaVersion:2,ownerUid:uid,mainFingerprint:gf,sidecarManifestFingerprint:smf,mainRaw,metadataRaw:mr,
            sidecars,createdAt:Date.now()
        });
        try{ storage().setItem(bk,JSON.stringify(backup)); }
        catch(error){ throw coded(Q9,"The immutable migration backup could not be stored.",error); }
        return Object.freeze({...verifyMigrationBackup(uid,bk),unchanged:false});
    }
    // Only copies historical bytes that the original UID migration sealed next to
    // the exact same main-save bytes. No live key is changed, and an absent
    // archived record remains missing. This does not establish claim entitlement.
    function recoverArchivedMigrationSidecars(uid){
        uid=validUid(uid);
        if(global.FourSymbolsAccountSaveOperations?.migrationIsRunning?.())throw coded(Q10,Q11);
        assertNoMigrationPending(uid);
        if(getActiveUid()!==uid){ throw coded(Q4,"Recovery owner is not active."); }
        const mk=["daily-dungeon-state","task-tracker","legacy-abyss-state"];
        const oldKeys=Object.fromEntries(Object.entries(LEGACY_SIDECARS)
            .map(([oldKey,suffix])=>[suffix,oldKey]));
        const sealedPrefix=MB+uid+":";
        const legacyPrefix=BP+uid+":";
        const candidates=[];
        let es=0,la=0,ema=0,ia=0;
        for(let index=0;index<storage().length;index++){
            const key=storage().key(index);
            if(typeof key==="string"&&key.startsWith(legacyPrefix)&&
               /^(?:\d+|[a-f0-9]{32})$/.test(key.slice(legacyPrefix.length))){ la++; }
        }
        for(let index=0;index<storage().length;index++){
            const key=storage().key(index);
            if(typeof key!=="string"||!key.startsWith(sealedPrefix)){ continue; }
            const backup=verifyMigrationBackup(uid,key);
            if(mk.some(suffix=>backup.sidecars[suffix].status!=="missing")){ continue; }
            es++;
            const matches=[];
            for(let other=0;other<storage().length;other++){
                const root=storage().key(other);
                if(typeof root!=="string"||!root.startsWith(legacyPrefix)||
                    !/^(?:\d+|[a-f0-9]{32})$/.test(root.slice(legacyPrefix.length))||
                    storage().getItem(root)!==backup.mainRaw){ continue; }
                ema++;
                const recovered={};
                for(const suffix of mk){
                    const raw=storage().getItem(root+":"+oldKeys[suffix]);
                    if(raw===null){ break; }
                    parseSave(raw,Q7);
                    recovered[suffix]={status:"present",raw};
                }
                if(Object.keys(recovered).length===mk.length){
                    matches.push({root,recovered});
                }else{
                    ia++;
                }
            }
            if(matches.length>1){
                throw coded(Q12,"More than one matching original migration archive exists.");
            }
            if(matches.length===1){ candidates.push({backup,match:matches[0]}); }
        }
        if(candidates.length!==1){
            const reason=candidates.length?Q12:
                !es?"migration-recovery-sealed-missing":
                !la?"migration-recovery-archive-missing":
                !ema?"migration-recovery-main-mismatch":
                ia?"migration-recovery-sidecars-missing":"migration-recovery-source-missing";
            throw coded(reason,
                "Exactly one sealed save with a complete matching original archive is required.");
        }
        const {backup,match}=candidates[0];
        const sidecars={...backup.sidecars,...match.recovered};
        const smf=fingerprint(sidecars);
        const bk=migrationBackupKeyFor(uid,backup.mainFingerprint,smf);
        const existing=storage().getItem(bk);
        if(existing){
            const checked=verifyMigrationBackup(uid,bk);
            if(checked.mainRaw!==backup.mainRaw||checked.metadataRaw!==backup.metadataRaw||
               JSON.stringify(checked.sidecars)!==JSON.stringify(sidecars)){
                throw coded(Q8,"An existing recovery backup differs.");
            }
            return {backupKey:bk,unchanged:true,recoveredSources:mk};
        }
        const next={schemaVersion:2,ownerUid:uid,mainFingerprint:backup.mainFingerprint,
            sidecarManifestFingerprint:smf,mainRaw:backup.mainRaw,metadataRaw:backup.metadataRaw,
            sidecars,createdAt:Date.now()};
        try{ storage().setItem(bk,JSON.stringify(next)); }
        catch(error){ throw coded(Q9,"Recovered backup could not be sealed.",error); }
        try{ verifyMigrationBackup(uid,bk); }
        catch(error){
            try{ storage().removeItem(bk); }catch(_){ }
            throw error;
        }
        return {backupKey:bk,unchanged:false,recoveredSources:mk};
    }
    // Export only sealed local records owned by the active UID. This is an
    // offline copy, never a cloud save or a source of reward entitlement.
    function exportMigrationBackups(uid){
        uid=validUid(uid);
        if(getActiveUid()!==uid){ throw coded(Q4,Q5); }
        const prefix=MB+uid+":";
        const keys=[];
        for(let index=0;index<storage().length;index++){
            const key=storage().key(index);
            if(typeof key==="string"&&key.startsWith(prefix)){ keys.push(key); }
        }
        keys.sort();
        if(!keys.length){ throw coded("migration-backup-missing","No sealed backup exists for this UID."); }
        const backups=keys.map(key=>{
            const {backupKey:bk,unchanged,...backup}=verifyMigrationBackup(uid,key);
            return {backupKey:bk,...backup};
        });
        return JSON.stringify({format:"four-symbols-local-migration-backups-v1",ownerUid:uid,
            authoritativeStateReady:false,backups});
    }
    function migrateLegacyToUid(uid,options={}){
        return writerOperations().migrateLegacyToUid(writerContext(),uid,options);
    }
    function removeActive(){
        const uid=getActiveUid();
        if(!uid){ return false; }
        if(global.FourSymbolsAccountSaveOperations?.migrationIsRunning?.())throw coded(Q10,Q11);
        assertNoMigrationPending(uid);
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
        SCHEMA_VERSION:SV,LEGACY_KEY:LK,ACTIVE_UID_KEY:AU,activate,deactivate,getActiveUid,
        saveKey,metadataKey,readForUid,readActive,writeForUid,inspectLegacy,inspectCloudBundle,
        migrateLegacyToUid,removeActive,accountKey,fingerprint,LEGACY_SIDECARS,
        migrationBackupKeyFor,createMigrationBackup,verifyMigrationBackup,
        exportMigrationBackups,recoverArchivedMigrationSidecars,BACKUP_SIDECARS:BS
    });
})(typeof window!=="undefined"?window:globalThis);
