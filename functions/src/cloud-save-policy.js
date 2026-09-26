"use strict";

const {createHash}=require("node:crypto");

const CLOUD_SAVE_SCHEMA_VERSION=1;
const MAX_CANDIDATE_BYTES=700*1024;
const MAX_DEPTH=24;
const MAX_ARRAY_ITEMS=5000;
const MAX_OBJECT_KEYS=2000;
const MAX_STRING_LENGTH=65536;

const ALLOWED_SAVE_KEYS=new Set([
    "version",
    "player",
    "player2",
    "player3",
    "sharedExp",
    "gold",
    "dailyQuestState",
    "commissionQuestState",
    "bestiaryData",
    "achievementState",
    "lastSaveTimestamp",
    "selectedCreationElement",
    "characterEquipment",
    "characterSkillLoadouts",
    "allyFormation",
    "autoConfig",
    "autoConfig2",
    "autoConfig3",
    "playerRelics",
    "teamLoadout",
    "gameplayProgress",
    "abyssProgress",
    "inventoryItems"
]);

const FORBIDDEN_OBJECT_KEYS=new Set([
    "__proto__",
    "prototype",
    "constructor"
]);

class CloudSavePolicyError extends Error{
    constructor(code,message){
        super(message);
        this.name="CloudSavePolicyError";
        this.code=code;
    }
}

function fail(code,message){
    throw new CloudSavePolicyError(code,message);
}

function isPlainObject(value){
    if(!value || typeof value!=="object" || Array.isArray(value)){ return false; }
    const proto=Object.getPrototypeOf(value);
    return proto===Object.prototype || proto===null;
}

function validateJsonValue(value,path,depth){
    if(depth>MAX_DEPTH){
        fail("invalid-argument",`${path} exceeds maximum nesting depth.`);
    }

    if(value===null){ return; }

    const type=typeof value;
    if(type==="string"){
        if(value.length>MAX_STRING_LENGTH){
            fail("invalid-argument",`${path} contains an oversized string.`);
        }
        return;
    }
    if(type==="number"){
        if(!Number.isFinite(value)){
            fail("invalid-argument",`${path} contains a non-finite number.`);
        }
        return;
    }
    if(type==="boolean"){ return; }

    if(Array.isArray(value)){
        if(value.length>MAX_ARRAY_ITEMS){
            fail("invalid-argument",`${path} contains too many array items.`);
        }
        value.forEach((entry,index)=>validateJsonValue(entry,`${path}[${index}]`,depth+1));
        return;
    }

    if(isPlainObject(value)){
        const keys=Object.keys(value);
        if(keys.length>MAX_OBJECT_KEYS){
            fail("invalid-argument",`${path} contains too many object keys.`);
        }
        for(const key of keys){
            if(FORBIDDEN_OBJECT_KEYS.has(key)){
                fail("invalid-argument",`${path} contains a forbidden object key.`);
            }
            validateJsonValue(value[key],`${path}.${key}`,depth+1);
        }
        return;
    }

    fail("invalid-argument",`${path} contains a non-JSON value.`);
}

function validateCharacter(character,path,{required=false}={}){
    if(character===null || character===undefined){
        if(required){ fail("invalid-argument",`${path} is required.`); }
        return;
    }
    if(!isPlainObject(character)){
        fail("invalid-argument",`${path} must be an object or null.`);
    }

    if(typeof character.id!=="string"||!character.id.trim()||character.id.trim().length>64){
        fail("invalid-argument",`${path}.id is invalid.`);
    }

    const level=Number(character.level);
    if(!Number.isInteger(level) || level<1 || level>100){
        fail("invalid-argument",`${path}.level must be an integer from 1 to 100.`);
    }
}

function validateNonNegativeNumber(value,path,{integer=false,max=Number.MAX_SAFE_INTEGER}={}){
    if(value===undefined || value===null){ return; }
    const number=Number(value);
    if(!Number.isFinite(number) || number<0 || number>max || (integer && !Number.isInteger(number))){
        fail("invalid-argument",`${path} is outside the accepted migration-candidate range.`);
    }
}

function validateLegacySaveCandidate(candidate){
    if(!isPlainObject(candidate)){
        fail("invalid-argument","save must be a plain object.");
    }

    for(const key of Object.keys(candidate)){
        if(!ALLOWED_SAVE_KEYS.has(key)){
            fail("invalid-argument",`save contains unsupported top-level field: ${key}`);
        }
    }

    const gameSaveVersion=Number(candidate.version);
    if(!Number.isInteger(gameSaveVersion) || gameSaveVersion<3 || gameSaveVersion>6){
        fail("invalid-argument","save.version must be a supported legacy save version (3-6).");
    }

    validateCharacter(candidate.player,"save.player",{required:true});
    validateCharacter(candidate.player2,"save.player2");
    validateCharacter(candidate.player3,"save.player3");
    if(candidate.player3!=null&&candidate.player2==null){
        fail("invalid-argument","save.player3 cannot exist without save.player2.");
    }
    validateNonNegativeNumber(candidate.gold,"save.gold",{integer:true,max:1_000_000_000_000});
    validateNonNegativeNumber(candidate.sharedExp,"save.sharedExp",{integer:true,max:10_000_000_000_000_000});
    validateNonNegativeNumber(candidate.lastSaveTimestamp,"save.lastSaveTimestamp",{integer:true,max:9_999_999_999_999});

    validateJsonValue(candidate,"save",0);

    let serialized;
    try{
        serialized=JSON.stringify(candidate);
    }catch(_){
        fail("invalid-argument","save cannot be serialized as JSON.");
    }

    const byteLength=Buffer.byteLength(serialized,"utf8");
    if(byteLength>MAX_CANDIDATE_BYTES){
        fail(
            "invalid-argument",
            `save is too large for a migration candidate (${byteLength} bytes; max ${MAX_CANDIDATE_BYTES}).`
        );
    }

    const snapshot=JSON.parse(serialized);
    const fingerprint=createHash("sha256").update(serialized,"utf8").digest("hex");

    return Object.freeze({
        snapshot,
        byteLength,
        fingerprint,
        gameSaveVersion
    });
}

// The caller supplies an untrusted copy of a sealed local backup. Digests
// establish byte consistency, never historical truth or reward entitlement.
function validateMigrationBackup(bundle,uid){
    if(!isPlainObject(bundle)||bundle.schemaVersion!==2||bundle.ownerUid!==uid||
       typeof bundle.mainRaw!=="string"||typeof bundle.metadataRaw!=="string"||
       !isPlainObject(bundle.sidecars)||
       !/^v1:[a-f0-9]+:[a-f0-9]{32}$/.test(bundle.mainFingerprint||"")||
       !/^v1:[a-f0-9]+:[a-f0-9]{32}$/.test(bundle.sidecarManifestFingerprint||"")||
       bundle.backupId!==`four_symbols_migration_backup:${uid}:${bundle.mainFingerprint}:${bundle.sidecarManifestFingerprint}`){
        fail("invalid-argument","A complete UID-owned backup reference is required.");
    }
    const sha=value=>createHash("sha256").update(value,"utf8").digest("hex");
    const keys=Object.keys(bundle.sidecars).sort();
    const expected=["element-box-state","daily-dungeon-state","exp-pool-growth-state",
        "rested-exp-state","progress","announcement-read","quest-milestones",
        "task-tracker","legacy-abyss-state","equipment-shop-daily",
        "bulk-sell-quality","equipment-shop-purchases","abyss-state","patrol-character-index"].sort();
    if(keys.join("|")!==expected.join("|")){
        fail("invalid-argument","Backup sidecar inventory is incomplete.");
    }
    for(const suffix of keys){
        const sidecar=bundle.sidecars[suffix];
        if(!isPlainObject(sidecar)||!(["present","missing"].includes(sidecar.status))||
           (sidecar.status==="missing"?sidecar.raw!==null:typeof sidecar.raw!=="string")){
            fail("invalid-argument","Backup sidecar is invalid.");
        }
        if(sidecar.status==="present"&&!new Set(["announcement-read","bulk-sell-quality","patrol-character-index"]).has(suffix)){
            try{ validateJsonValue(JSON.parse(sidecar.raw),`sidecars.${suffix}`,0); }
            catch(_){ fail("invalid-argument","Backup sidecar JSON is invalid."); }
        }
    }
    const manifestRaw=JSON.stringify(bundle.sidecars);
    const backupRaw=JSON.stringify({ownerUid:uid,mainRaw:bundle.mainRaw,
        metadataRaw:bundle.metadataRaw,sidecars:bundle.sidecars});
    if(Buffer.byteLength(backupRaw,"utf8")>MAX_CANDIDATE_BYTES ||
       sha(manifestRaw)!==bundle.sidecarManifestSha256||
       sha(backupRaw)!==bundle.backupSha256){
        fail("invalid-argument","Backup bytes or SHA-256 digest do not match.");
    }
    let save,metadata;
    try{ save=JSON.parse(bundle.mainRaw); metadata=JSON.parse(bundle.metadataRaw); }
    catch(_){ fail("invalid-argument","Backup main save or ownership metadata is corrupt."); }
    if(!isPlainObject(metadata)||metadata.ownerUid!==uid){
        fail("invalid-argument","Backup metadata owner is invalid.");
    }
    const candidate=validateLegacySaveCandidate(save);
    if(Buffer.byteLength(JSON.stringify({backup:bundle,snapshot:candidate.snapshot}),"utf8")>800*1024){
        fail("invalid-argument","Candidate exceeds the safe Firestore document budget.");
    }
    // Preserve original bytes for later review, including their key order.
    return Object.freeze({...candidate,backupId:bundle.backupId,
        backupSha256:bundle.backupSha256,sidecarManifestSha256:bundle.sidecarManifestSha256,
        backup:{...bundle},mainRaw:bundle.mainRaw});
}

function normalizeClientVersion(value){
    const version=String(value||"").trim();
    if(!version){ return null; }
    if(version.length>32 || !/^[A-Za-z0-9._-]+$/.test(version)){
        fail("invalid-argument","clientVersion is invalid.");
    }
    return version;
}

module.exports={
    ALLOWED_SAVE_KEYS,
    CLOUD_SAVE_SCHEMA_VERSION,
    CloudSavePolicyError,
    MAX_CANDIDATE_BYTES,
    normalizeClientVersion,
    validateLegacySaveCandidate,
    validateMigrationBackup
};
