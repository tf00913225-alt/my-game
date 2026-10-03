import assert from "node:assert/strict";
import test from "node:test";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const {createCanonicalBattleAttempt,TTL_MS}=require("../functions/src/canonical-battle-attempt");
const {makeInitialCharacterSources}=require("../functions/src/initial-character-sources");
const {assembleCanonicalSnapshot}=require("../functions/src/canonical-snapshot");
const {createRecoveryArchive}=require("../functions/src/canonical-recovery-archive");
const uid="battle-proof-user",operationId="battle-source-unit-0001",sessionId="s".repeat(32);
const stamp={toMillis:()=>123};
function fixture(){
    const records=makeInitialCharacterSources(uid,2,"initial-battle-source-0001",{
        displayName:"挑戰英雄",element:"fire",gender:"male",
        attributes:{attack:10,intelligence:0,vitality:0,energy:0,defensePoints:0,agility:0}});
    const snapshot=assembleCanonicalSnapshot(uid,2,records);
    const root=`serverUsers/${uid}`;
    const data=new Map([[`${root}/account/current`,{...records.account,snapshotSha256:snapshot.sha256}],
        [`${root}/playableSnapshots/2`,structuredClone(snapshot)],
        [`${root}/recoveryArchives/2`,createRecoveryArchive(uid,2,records,snapshot)],
        [`users/${uid}/saves/current`,{serverRevision:2,authoritativeStateReady:false}]]);
    const collection=path=>({doc:id=>({path:`${path}/${id}`,collection:name=>collection(`${path}/${id}/${name}`)})});
    let clock=1000,writes=0,abort=false,currentSession=sessionId;
    class HttpsError extends Error{constructor(code,message){super(message);this.code=code;}}
    const owner=createCanonicalBattleAttempt({db:{collection},FieldValue:{serverTimestamp:()=>stamp},
        HttpsError,now:()=>clock,
        inspectExistingEnvelope:value=>({kind:"current",data:value,serverRevision:value.serverRevision}),
        runProtected:async(_request,fn)=>{
            const pending=[];
            const tx={get:async ref=>({exists:data.has(ref.path),data:()=>data.get(ref.path)}),
                create:(ref,value)=>{assert.equal(data.has(ref.path),false);pending.push([ref.path,value]);}};
            const result=await fn(tx,{uid,sessionId:currentSession});
            if(abort)throw new Error("interrupted transaction");
            for(const [path,value] of pending)data.set(path,value);
            writes+=pending.length;return result;
        }});
    const args={operationId,expectedRevision:2};
    return {data,root,args,records,snapshot,
        get writes(){return writes;},set clock(v){clock=v;},set abort(v){abort=v;},
        set session(v){currentSession=v;},
        begin:(extra={},request={data:{uid,session:{}}})=>owner.begin(request,{...args,...extra})};
}
test("atomic preparation binds source/session/time, never awards; lost response repeats same proof",async()=>{
    const h=fixture(),before=h.data.get(`users/${uid}/saves/current`);
    const first=await h.begin();assert.equal(h.writes,3);
    assert.equal(first.rewardEligible,false);assert.equal(first.outcomeVerified,false);
    assert.equal(first.creditedToCharacter,false);
    assert.equal(first.expiresAtMs-first.issuedAtMs,TTL_MS);
    const attempt=h.data.get(`${h.root}/battleAttempts/${operationId}`);
    assert.equal(attempt.creationSessionId,sessionId);assert.equal(attempt.snapshotSha256,h.snapshot.sha256);
    assert.deepEqual(await h.begin(),{...first,unchanged:true});assert.equal(h.writes,3);
    assert.deepEqual(h.data.get(`users/${uid}/saves/current`),before);
    assert.equal([...h.data.keys()].some(path=>/pendingGrants|ledgerEntries|uniqueClaims/.test(path)),false);
});
test("failed commit leaves no attempt/receipt/source marker and can retry",async()=>{
    const h=fixture();h.abort=true;await assert.rejects(h.begin(),/interrupted/);
    assert.equal(h.writes,0);assert.equal(h.data.size,4);
    h.abort=false;assert.equal((await h.begin()).unchanged,false);
});
test("expiry never extends on retry or reopens under another ID",async()=>{
    const h=fixture(),first=await h.begin();h.clock=first.expiresAtMs;
    assert.deepEqual(await h.begin(),{...first,expired:true,unchanged:true});
    await assert.rejects(h.begin({operationId:"battle-source-unit-0002"}),e=>e.code==="already-exists");
    assert.equal(h.writes,3);
});
test("replay verifies original source after current revisions advance; new stale intent rejects",async()=>{
    const h=fixture(),first=await h.begin();
    h.data.get(`${h.root}/account/current`).serverRevision=8;
    h.data.get(`${h.root}/account/current`).snapshotSha256="a".repeat(64);
    h.data.get(`users/${uid}/saves/current`).serverRevision=8;
    assert.deepEqual(await h.begin(),{...first,unchanged:true});
    await assert.rejects(h.begin({operationId:"battle-source-unit-0002",expectedRevision:7}),e=>e.code==="aborted");
    await assert.rejects(h.begin({expectedRevision:8}),e=>e.code==="data-loss");
    assert.equal(h.writes,3);
});
for(const [name,mutate] of Object.entries({
    "missing snapshot":h=>h.data.delete(`${h.root}/playableSnapshots/2`),
    "missing archive":h=>h.data.delete(`${h.root}/recoveryArchives/2`),
    "cross UID archive":h=>{h.data.get(`${h.root}/recoveryArchives/2`).ownerUid="other";},
    "corrupt archive":h=>{h.data.get(`${h.root}/recoveryArchives/2`).sourceRecords.economy.gold=999;},
    "corrupt snapshot":h=>{h.data.get(`${h.root}/playableSnapshots/2`).sha256="0".repeat(64);}
}))test(`reject ${name} on creation and replay without writes`,async()=>{
    const h=fixture();mutate(h);await assert.rejects(h.begin(),e=>e.code==="data-loss");assert.equal(h.writes,0);
    const replay=fixture();await replay.begin();mutate(replay);
    await assert.rejects(replay.begin(),e=>e.code==="data-loss");assert.equal(replay.writes,3);
});
for(const path of ["battleAttempts", "operations", "battleAttemptSources"]){
    test(`missing ${path} cannot be regenerated`,async()=>{
        const h=fixture();await h.begin();h.data.delete(`${h.root}/${path}/${path==="battleAttemptSources"?"2":operationId}`);
        await assert.rejects(h.begin());assert.equal(h.writes,3);
    });
}
for(const [field,value] of Object.entries({ownerUid:"other",sourceRevision:99,
    snapshotSha256:"0".repeat(64),expiresAtMs:99999,rewardEligible:true,outcomeVerified:true,
    creationSessionId:"x",sha256:"0".repeat(64)}))test(`corrupt attempt ${field} fails closed`,async()=>{
    const h=fixture();await h.begin();h.data.get(`${h.root}/battleAttempts/${operationId}`)[field]=value;
    await assert.rejects(h.begin(),e=>e.code==="data-loss");assert.equal(h.writes,3);
});
test("new active session cannot inherit a preparation",async()=>{
    const h=fixture();await h.begin();h.session="n".repeat(32);
    await assert.rejects(h.begin(),e=>e.code==="failed-precondition");assert.equal(h.writes,3);
});
test("client outcomes/amounts/sources and unsupported intents reject before writes",async()=>{
    const h=fixture();
    for(const key of ["won","gold","enemy","sourceRevision","issuedAtMs","reward"]){
        await assert.rejects(h.begin({[key]:true}),e=>e.code==="invalid-argument");
        await assert.rejects(h.begin({}, {data:{uid,[key]:true}}),e=>e.code==="invalid-argument");
    }
    await assert.rejects(h.begin({operationId:"invalid/id"}),e=>e.code==="invalid-argument");
    assert.equal(h.writes,0);
});
test("account pointer, unpublished gate, source revision and foreign operation collisions reject",async()=>{
    for(const mutate of [
        h=>{h.data.get(`${h.root}/account/current`).snapshotSha256="0".repeat(64);},
        h=>{h.data.get(`users/${uid}/saves/current`).authoritativeStateReady=true;},
        h=>{h.data.get(`${h.root}/account/current`).serverRevision=1;},
        h=>h.data.set(`${h.root}/grantOperations/${operationId}`,{}),
        h=>h.data.set(`${h.root}/operations/${operationId}`,{kind:"purchase"})
    ]){const h=fixture();mutate(h);await assert.rejects(h.begin());assert.equal(h.writes,0);}
});
test("valid multi-character sources remain outside this first-character preparation",async()=>{
    const h=fixture(),records=structuredClone(h.records);
    records.account.slots[1]="other-character";
    records.characters.push({...structuredClone(records.characters[0]),characterId:"other-character",slotIndex:1});
    const bundle=assembleCanonicalSnapshot(uid,2,records);
    h.data.set(`${h.root}/playableSnapshots/2`,bundle);
    h.data.set(`${h.root}/recoveryArchives/2`,createRecoveryArchive(uid,2,records,bundle));
    h.data.get(`${h.root}/account/current`).snapshotSha256=bundle.sha256;
    await assert.rejects(h.begin(),e=>e.code==="failed-precondition");assert.equal(h.writes,0);
});
