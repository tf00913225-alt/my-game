import assert from "node:assert/strict";
import {createRequire} from "node:module";
import test from "node:test";

const require=createRequire(import.meta.url);
const {makeInitialCharacterSources}=require("../functions/src/initial-character-sources.js");
const {assembleCanonicalSnapshot,claimRecordsDigest}=require("../functions/src/canonical-snapshot.js");
const {createRecoveryArchive}=require("../functions/src/canonical-recovery-archive.js");
const {createCanonicalCurrentRecovery}=require("../functions/src/canonical-current-recovery.js");
const uid="recovery-owner",root=`serverUsers/${uid}`;
const args={operationId:"recover-original-proof-0001",expectedRevision:6};
const selection={displayName:"英雄",element:"fire",gender:"female",
    attributes:{attack:3,vitality:2,energy:1,intelligence:2,defensePoints:1,agility:1}};

function nextRecords(records){
    const next=structuredClone(records);
    for(const value of Object.values(next)){
        for(const record of Array.isArray(value)?value:[value])record.serverRevision=7;
    }
    next.claimCheckpoint.claimDigest=claimRecordsDigest(next.claimRecords);
    return next;
}
function harness(){
    const records=makeInitialCharacterSources(uid,6,"create-original-source-0001",selection,
        {recordedAt:Date.parse("2026-10-15T16:00:00Z")});
    const original=assembleCanonicalSnapshot(uid,6,records);
    const originalArchive=createRecoveryArchive(uid,6,records,original);
    const recoveredRecords=nextRecords(records);
    const recovered=assembleCanonicalSnapshot(uid,7,recoveredRecords);
    const archive=createRecoveryArchive(uid,7,recoveredRecords,recovered);
    const receipt={schemaVersion:1,kind:"canonical-current-recovery",ownerUid:uid,
        ...args,sourceRevision:6,restoredRevision:7,sourceSha256:originalArchive.sourceSha256,
        snapshotSha256:recovered.sha256,approvedBy:"operator-original",authoritativeStateReady:false};
    delete receipt.expectedRevision;
    const approval={schemaVersion:1,kind:"canonical-current-recovery-approval",ownerUid:uid,
        operationId:args.operationId,sourceRevision:6,sourceSha256:originalArchive.sourceSha256,
        snapshotSha256:original.sha256,approvedBy:receipt.approvedBy,status:"used",usedRevision:7,
        expiresAt:{toMillis:()=>1}};
    const data=new Map([
        [`users/${uid}/saves/current`,{serverRevision:9,authoritativeStateReady:false}],
        [`${root}/playableSnapshots/6`,original],[`${root}/recoveryArchives/6`,originalArchive],
        [`${root}/playableSnapshots/7`,recovered],[`${root}/recoveryArchives/7`,archive],
        [`${root}/operations/${args.operationId}`,receipt],
        [`${root}/recoveryAudits/${args.operationId}`,{...receipt}],
        [`${root}/recoveryApprovals/${args.operationId}`,approval]
    ]);
    const ref=path=>({path,collection:name=>collection(`${path}/${name}`)});
    const collection=path=>({doc:id=>ref(`${path}/${id}`)});
    let writes=0,revoked=false;
    const tx={get:async ref=>{const value=data.get(ref.path);return {
        exists:value!==undefined,data:()=>value,get:key=>value?.[key]};}};
    for(const name of ["create","set","update","delete"]){
        tx[name]=()=>{writes++;throw Error("Replay attempted a write");};
    }
    class HttpsError extends Error{constructor(code,message){super(message);this.code=code;}}
    const recovery=createCanonicalCurrentRecovery({db:{collection},FieldValue:{},HttpsError,
        runProtected:(_request,operation)=>{
            if(revoked)throw new HttpsError("permission-denied","SESSION_REVOKED");
            return operation(tx,{uid});
        },inspectExistingEnvelope:record=>({kind:"current",serverRevision:record.serverRevision,data:record}),
        nextRevision:envelope=>envelope.serverRevision+1,now:()=>Date.parse("2026-11-01T00:00:00Z")});
    return {data,recovery,recoveredRecords,writes:()=>writes,revoke:()=>{revoked=true;}};
}
async function reject(h){
    const before=JSON.stringify([...h.data]);
    await assert.rejects(h.recovery.restoreCurrent({},args),error=>error.code==="data-loss");
    assert.equal(h.writes(),0);assert.equal(JSON.stringify([...h.data]),before);
}
test("historical recovery retry preserves original result after expiry and later revisions without writes",async()=>{
    const h=harness(),before=JSON.stringify([...h.data]);
    assert.deepEqual(await h.recovery.restoreCurrent({},args),{
        restoredRevision:7,unchanged:true,authoritativeStateReady:false});
    assert.equal(h.writes(),0);assert.equal(JSON.stringify([...h.data]),before);
});
test("missing or corrupt restored archive blocks replay instead of regenerating proof",async()=>{
    for(const mutate of [h=>h.data.delete(`${root}/recoveryArchives/7`),
        h=>{h.data.get(`${root}/recoveryArchives/7`).sourceRecords.economy.gold=99;},
        h=>{h.data.get(`${root}/recoveryArchives/7`).readyForRestore=true;}]){
        const h=harness();mutate(h);await reject(h);
    }
});
test("self-consistent substituted restored snapshot and archive cannot replace approved source",async()=>{
    const h=harness(),next=h.recoveredRecords;next.economy.gold=99;
    const bundle=assembleCanonicalSnapshot(uid,7,next);
    h.data.set(`${root}/playableSnapshots/7`,bundle);
    h.data.set(`${root}/recoveryArchives/7`,createRecoveryArchive(uid,7,next,bundle));
    for(const name of ["operations","recoveryAudits"]){
        h.data.get(`${root}/${name}/${args.operationId}`).snapshotSha256=bundle.sha256;
    }
    await reject(h);
});
test("replay binds all retained approval and audit fields to original receipt and source",async()=>{
    const cases={recoveryApprovals:{schemaVersion:2,ownerUid:"other",operationId:"other",
        sourceRevision:5,sourceSha256:"a".repeat(64),snapshotSha256:"b".repeat(64),
        approvedBy:"other",expiresAt:null,status:"approved",usedRevision:8},
    recoveryAudits:{schemaVersion:2,kind:"other",ownerUid:"other",operationId:"other",
        sourceRevision:5,restoredRevision:8,sourceSha256:"a".repeat(64),
        snapshotSha256:"b".repeat(64),approvedBy:"other",authoritativeStateReady:true},
    operations:{schemaVersion:2,approvedBy:"",authoritativeStateReady:true}};
    for(const [name,fields] of Object.entries(cases)){
        for(const [field,value] of Object.entries(fields)){
            const h=harness();h.data.get(`${root}/${name}/${args.operationId}`)[field]=value;
            await reject(h);
        }
    }
});
test("retry still requires active session and refuses a public ready account",async()=>{
    const h=harness();h.revoke();
    await assert.rejects(async()=>h.recovery.restoreCurrent({},args),/SESSION_REVOKED/);
    const ready=harness();ready.data.get(`users/${uid}/saves/current`).authoritativeStateReady=true;
    await assert.rejects(ready.recovery.restoreCurrent({},args),error=>error.code==="failed-precondition");
    assert.equal(h.writes(),0);assert.equal(ready.writes(),0);
});
