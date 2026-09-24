"use strict";

const CLOUD_SAVE_ENVELOPE_SCHEMA_VERSION=2;
const LEGACY_ENVELOPE_SCHEMA_VERSION=1;
const EMPTY_STATUS="awaiting_authoritative_migration";
const CANDIDATE_STATUS="migration_candidate_received";

class CloudSaveEnvelopeError extends Error{
    constructor(code,message){
        super(message);
        this.name="CloudSaveEnvelopeError";
        this.code=code;
    }
}

function fail(message,code="data-loss"){
    throw new CloudSaveEnvelopeError(code,message);
}

function isTimestamp(value){
    return !!value && typeof value.toMillis==="function" && Number.isFinite(value.toMillis());
}

function requireOwner(data,uid){
    if(!data || typeof data!=="object" || data.ownerUid!==uid){
        fail("Cloud-save envelope owner mismatch.","failed-precondition");
    }
}

function requireBaseState(data){
    if(data.authoritativeStateReady!==false || data.authoritativeStateVersion!==0){
        fail("Phase 2 envelope contains an unsupported authoritative state.");
    }
    if(!isTimestamp(data.createdAt)||!isTimestamp(data.updatedAt)||data.updatedAt.toMillis()<data.createdAt.toMillis()){
        fail("Cloud-save envelope timestamps are invalid.");
    }
    if(data.gameSave!==undefined||data.save!==undefined||data.authoritativeSave!==undefined){
        fail("Non-authoritative envelope must not contain gameplay state.");
    }
    if(data.status===EMPTY_STATUS){
        if(data.migrationCandidateStatus!=="none"){
            fail("Empty cloud-save envelope has inconsistent migration status.");
        }
        return;
    }
    if(data.status!==CANDIDATE_STATUS||data.migrationCandidateStatus!=="received"){
        fail("Cloud-save envelope status is invalid.");
    }
    if(!Number.isSafeInteger(data.migrationCandidateRevision)||data.migrationCandidateRevision<1||
       !/^[a-f0-9]{64}$/.test(data.migrationCandidateFingerprint||"")||
       !Number.isInteger(data.migrationCandidateGameSaveVersion)||
       data.migrationCandidateGameSaveVersion<3||data.migrationCandidateGameSaveVersion>6||
       !Number.isSafeInteger(data.migrationCandidateByteLength)||data.migrationCandidateByteLength<1){
        fail("Cloud-save migration metadata is invalid.");
    }
}

function inspectExistingEnvelope(data,uid){
    requireOwner(data,uid);
    requireBaseState(data);
    if(data.schemaVersion===CLOUD_SAVE_ENVELOPE_SCHEMA_VERSION){
        if(!Number.isSafeInteger(data.serverRevision)||data.serverRevision<1||data.serverRevision>=Number.MAX_SAFE_INTEGER){
            fail("Cloud-save envelope revision is invalid.");
        }
        return Object.freeze({kind:"current",serverRevision:data.serverRevision,data});
    }
    if(data.schemaVersion===LEGACY_ENVELOPE_SCHEMA_VERSION&&data.serverRevision===0){
        return Object.freeze({kind:"legacy-phase1",serverRevision:0,data});
    }
    fail("Cloud-save envelope schema is unsupported.","failed-precondition");
}

function createEmptyEnvelope(uid,timestamp){
    if(typeof uid!=="string"||!uid||uid.includes("/")){
        fail("Cloud-save envelope requires a valid UID.","invalid-argument");
    }
    return Object.freeze({
        schemaVersion:CLOUD_SAVE_ENVELOPE_SCHEMA_VERSION,
        ownerUid:uid,
        status:EMPTY_STATUS,
        authoritativeStateReady:false,
        authoritativeStateVersion:0,
        serverRevision:1,
        migrationCandidateStatus:"none",
        createdAt:timestamp,
        updatedAt:timestamp
    });
}

function upgradeLegacyEnvelopePatch(){
    return Object.freeze({
        schemaVersion:CLOUD_SAVE_ENVELOPE_SCHEMA_VERSION,
        serverRevision:1
    });
}

function nextRevision(envelope){
    if(!envelope||envelope.kind!=="current"||!Number.isSafeInteger(envelope.serverRevision)||
       envelope.serverRevision<1||envelope.serverRevision>=Number.MAX_SAFE_INTEGER){
        fail("Cloud-save envelope cannot advance an invalid revision.");
    }
    return envelope.serverRevision+1;
}

module.exports={
    CANDIDATE_STATUS,
    CLOUD_SAVE_ENVELOPE_SCHEMA_VERSION,
    CloudSaveEnvelopeError,
    EMPTY_STATUS,
    createEmptyEnvelope,
    inspectExistingEnvelope,
    nextRevision,
    upgradeLegacyEnvelopePatch
};
