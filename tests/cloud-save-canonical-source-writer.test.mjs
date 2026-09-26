import assert from "node:assert/strict";
import {createRequire} from "node:module";
import test from "node:test";

const require=createRequire(import.meta.url);
const {createCanonicalSourceWriter}=require("../functions/src/canonical-source-writer.js");
const stamp={toMillis:()=>1};
const uid="uid-a";
const save=`users/${uid}/saves/current`;
const root=`serverUsers/${uid}`;
const operationId="init-character-0001";

const selection={displayName:"英雄",element:"fire",gender:"female",
    attributes:{attack:3,vitality:2,energy:1,intelligence:2,spirit:1,agility:1}};

function harness(candidate="none"){
    const data=new Map([[save,{schemaVersion:2,ownerUid:uid,
        authoritativeStateReady:false,authoritativeStateVersion:0,
        migrationCandidateStatus:candidate,
        status:candidate==="none"?"awaiting_authoritative_migration":
            "migration_candidate_received",serverRevision:4,
        createdAt:stamp,updatedAt:stamp,
        ...(candidate==="none"?{}:{migrationCandidateRevision:1,
            migrationCandidateFingerprint:"a".repeat(64),
            migrationCandidateGameSaveVersion:6,migrationCandidateByteLength:100})}]]);
    const ref=path=>({path,collection(name){return collection(`${path}/${name}`);}});
    const collection=path=>({doc(id){return ref(`${path}/${id}`);}});
    const db={collection};
    let committed=0;
    const transaction={
        async get(reference){
            const value=data.get(reference.path);
            return {exists:value!==undefined,data:()=>value,get:key=>value?.[key]};
        },
        create(reference,value){
            if(data.has(reference.path)){ throw Error("duplicate document"); }
            data.set(reference.path,value);committed++;
        },
        update(reference,patch){
            if(!data.has(reference.path)){ throw Error("missing document"); }
            data.set(reference.path,{...data.get(reference.path),...patch});committed++;
        }
    };
    class HttpsError extends Error{constructor(code,message){super(message);this.code=code;}}
    const writer=createCanonicalSourceWriter({db,FieldValue:{serverTimestamp:()=>stamp},
        HttpsError,runProtected:(_request,operation)=>operation(transaction,{uid}),
        inspectExistingEnvelope:record=>({kind:"current",serverRevision:record.serverRevision,
            data:record}),nextRevision:envelope=>envelope.serverRevision+1});
    return {writer,data,get committed(){return committed;}};
}

test("initial server-owned character commits complete sources and receipt at one revision",async()=>{
    const h=harness();
    const request={};
    const args={operationId,expectedRevision:4,selection};
    const result=await h.writer.commitInitialSources(request,args);
    assert.equal(result.sourceRevision,5);
    assert.equal(result.authoritativeStateReady,false);
    assert.equal(h.data.get(save).serverRevision,5);
    assert.equal(h.data.get(save).authoritativeStateReady,false);
    assert.deepEqual(h.data.get(`${root}/account/current`).slots,
        [`character-${operationId}`,null,null]);
    const character=h.data.get(`${root}/characters/character-${operationId}`);
    assert.equal(character.ownerUid,uid);
    assert.equal(character.state.skillPoints,2);
    assert.equal(character.state.hp,200);
    assert.equal(h.data.get(`${root}/economy/current`).gold,0);
    assert.equal(h.data.get(`${root}/claimCheckpoints/current`).claimCount,0);
    assert.equal(h.data.get(`${root}/playableSnapshots/5`).readyForPublication,false);
    assert.equal(h.data.get(`${root}/operations/${operationId}`).snapshotSha256,
        result.snapshotSha256);
    const count=h.committed;
    assert.deepEqual(await h.writer.commitInitialSources(request,args),{
        sourceRevision:5,snapshotSha256:result.snapshotSha256,
        unchanged:true,authoritativeStateReady:false});
    assert.equal(h.committed,count);
});

test("candidate, stale revision or incomplete source cannot create partial records",async()=>{
    const candidate=harness("received");
    await assert.rejects(candidate.writer.commitInitialSources({},
        {operationId,expectedRevision:4,selection}),/migration candidate/);
    assert.equal(candidate.committed,0);
    const orphan=harness();
    orphan.data.set(`${root}/migrationCandidates/latest`,{trusted:false});
    await assert.rejects(orphan.writer.commitInitialSources({},
        {operationId,expectedRevision:4,selection}),/migration candidate/);
    assert.equal(orphan.committed,0);
    const stale=harness();
    await assert.rejects(stale.writer.commitInitialSources({},
        {operationId,expectedRevision:3,selection}),/REVISION_CONFLICT/);
    assert.equal(stale.committed,0);
    const corrupt=harness();
    await assert.rejects(corrupt.writer.commitInitialSources({},
        {operationId,expectedRevision:4,selection:{...selection,
            attributes:{...selection.attributes,attack:4}}}),/Invalid initial/);
    assert.equal(corrupt.committed,0);
    const paid=harness();
    await assert.rejects(paid.writer.commitInitialSources({},
        {operationId,expectedRevision:4,selection:{...selection,gold:100}}),/Invalid initial/);
    assert.equal(paid.committed,0);
});

test("a missing receipt cannot repeat an already persisted initial character",async()=>{
    const h=harness();
    await h.writer.commitInitialSources({},
        {operationId,expectedRevision:4,selection});
    h.data.delete(`${root}/operations/${operationId}`);
    await assert.rejects(h.writer.commitInitialSources({},
        {operationId:"init-character-0002",expectedRevision:5,selection}),
    /existing character/);
});

test("changed choices cannot replay the same operation receipt",async()=>{
    const h=harness();
    await h.writer.commitInitialSources({}, {operationId,expectedRevision:4,selection});
    await assert.rejects(h.writer.commitInitialSources({}, {operationId,
        expectedRevision:4,selection:{...selection,element:"water"}}),/inconsistent/);
});
