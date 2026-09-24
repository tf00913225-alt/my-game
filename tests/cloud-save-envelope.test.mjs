import assert from "node:assert/strict";
import {createRequire} from "node:module";
import test from "node:test";

const require=createRequire(import.meta.url);
const envelope=require("../functions/src/cloud-save-envelope.js");
const timestamp=value=>({toMillis:()=>value});

function empty(overrides={}){
    return {
        schemaVersion:envelope.CLOUD_SAVE_ENVELOPE_SCHEMA_VERSION,
        ownerUid:"uid-a",
        status:"awaiting_authoritative_migration",
        authoritativeStateReady:false,
        authoritativeStateVersion:0,
        serverRevision:1,
        migrationCandidateStatus:"none",
        createdAt:timestamp(100),
        updatedAt:timestamp(100),
        ...overrides
    };
}

test("creates a server-owned empty envelope at revision one",()=>{
    const now=timestamp(100);
    const value=envelope.createEmptyEnvelope("uid-a",now);
    assert.equal(value.schemaVersion,2);
    assert.equal(value.ownerUid,"uid-a");
    assert.equal(value.serverRevision,1);
    assert.equal(value.authoritativeStateReady,false);
    assert.equal(value.migrationCandidateStatus,"none");
    assert.equal(value.createdAt,now);
    assert.equal(value.updatedAt,now);
});

test("accepts a current envelope and advances only a valid server revision",()=>{
    const inspected=envelope.inspectExistingEnvelope(empty(),"uid-a");
    assert.equal(inspected.kind,"current");
    assert.equal(envelope.nextRevision(inspected),2);
});

test("recognizes only the exact Phase 1 skeleton as a controlled legacy upgrade",()=>{
    const inspected=envelope.inspectExistingEnvelope(empty({schemaVersion:1,serverRevision:0}),"uid-a");
    assert.equal(inspected.kind,"legacy-phase1");
    assert.deepEqual(envelope.upgradeLegacyEnvelopePatch(),{schemaVersion:2,serverRevision:1});
    assert.throws(
        ()=>envelope.inspectExistingEnvelope(empty({schemaVersion:1,serverRevision:7}),"uid-a"),
        /schema is unsupported/
    );
});

test("fails closed for owner, timestamp, state and revision corruption",()=>{
    assert.throws(()=>envelope.inspectExistingEnvelope(empty({ownerUid:"uid-b"}),"uid-a"),/owner mismatch/);
    assert.throws(()=>envelope.inspectExistingEnvelope(empty({updatedAt:timestamp(99)}),"uid-a"),/timestamps are invalid/);
    assert.throws(()=>envelope.inspectExistingEnvelope(empty({authoritativeStateReady:true}),"uid-a"),/unsupported authoritative state/);
    assert.throws(()=>envelope.inspectExistingEnvelope(empty({serverRevision:0}),"uid-a"),/revision is invalid/);
    assert.throws(()=>envelope.inspectExistingEnvelope(empty({gameSave:{player:{id:"x"}}}),"uid-a"),/must not contain gameplay state/);
});

test("validates candidate metadata without trusting candidate gameplay",()=>{
    const inspected=envelope.inspectExistingEnvelope(empty({
        status:"migration_candidate_received",
        migrationCandidateStatus:"received",
        migrationCandidateRevision:1,
        migrationCandidateFingerprint:"a".repeat(64),
        migrationCandidateGameSaveVersion:6,
        migrationCandidateByteLength:128,
        serverRevision:2,
        updatedAt:timestamp(101)
    }),"uid-a");
    assert.equal(inspected.serverRevision,2);
    assert.throws(()=>envelope.inspectExistingEnvelope(empty({
        status:"migration_candidate_received",
        migrationCandidateStatus:"received"
    }),"uid-a"),/migration metadata is invalid/);
});
