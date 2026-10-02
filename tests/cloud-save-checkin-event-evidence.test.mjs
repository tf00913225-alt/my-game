import assert from "node:assert/strict";
import test from "node:test";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const {readDailyCheckinEvidence,eventDigest}=require("../functions/src/daily-checkin-event-evidence");
const {createDailyCheckinGrant}=require("../functions/src/daily-checkin-grant");
const {makeInitialCharacterSources}=require("../functions/src/initial-character-sources");
const {assembleCanonicalSnapshot,claimRecordsDigest}=require("../functions/src/canonical-snapshot");
const {createRecoveryArchive}=require("../functions/src/canonical-recovery-archive");
const uid="event-user",grantId="daily-checkin-20261002",stamp={toMillis:()=>1};
function fixture(){
    const records=makeInitialCharacterSources(uid,2,"initial-event-proof-0001",{
        displayName:"來源角色",element:"fire",gender:"male",
        attributes:{attack:10,intelligence:0,vitality:0,energy:0,defensePoints:0,agility:0}});
    const bundle=assembleCanonicalSnapshot(uid,2,records);
    const archive=createRecoveryArchive(uid,2,records,bundle);
    const event={schemaVersion:1,ownerUid:uid,eventId:grantId,eventType:"daily-checkin",
        periodDate:"20261002",kind:"gold",amount:50,characterId:records.account.slots[0],sourceRevision:2};
    event.sha256=eventDigest(event);event.createdAt=stamp;
    const grant={schemaVersion:1,ownerUid:uid,source:"server-event",eventType:"daily-checkin",
        periodDate:event.periodDate,kind:"gold",amount:50,status:"pending",claimedByOperationId:null,
        sourceEventSha256:event.sha256,createdAt:stamp};
    const data=new Map([[`serverUsers/${uid}/rewardEvents/${grantId}`,event],
        [`serverUsers/${uid}/pendingGrants/${grantId}`,grant],
        [`serverUsers/${uid}/account/current`,{ownerUid:uid,provenance:"server-created",
            slots:records.account.slots,serverRevision:2,snapshotSha256:bundle.sha256}],
        [`serverUsers/${uid}/playableSnapshots/2`,structuredClone(bundle)],
        [`serverUsers/${uid}/recoveryArchives/2`,archive],
        [`users/${uid}/saves/current`,{serverRevision:2,authoritativeStateReady:false}]]);
    const collection=path=>({doc:id=>({path:`${path}/${id}`,collection:name=>collection(`${path}/${id}/${name}`)})});
    let writes=0;
    const tx={get:async ref=>({exists:data.has(ref.path),data:()=>data.get(ref.path)}),
        create:(ref,value)=>{assert.equal(data.has(ref.path),false);data.set(ref.path,value);writes++;}};
    const root=collection("serverUsers").doc(uid);
    const fail=(code,message)=>{throw Object.assign(new Error(message),{code});};
    class HttpsError extends Error{constructor(code,message){super(message);this.code=code;}}
    const issuer=createDailyCheckinGrant({db:{collection},FieldValue:{serverTimestamp:()=>stamp},
        HttpsError,now:()=>Date.parse("2026-10-02T05:00:00Z"),
        inspectExistingEnvelope:data=>({kind:"current",data,serverRevision:data.serverRevision}),
        runProtected:(_req,fn)=>fn(tx,{uid})});
    return {data,event,grant,issuer,get writes(){return writes;},
        read:extra=>readDailyCheckinEvidence({tx,root,uid,grantId,grant,fail,...extra})};
}
test("server check-in issuance commits the event and grant together, repeats without writes",async()=>{
    const h=fixture();h.data.delete(`serverUsers/${uid}/rewardEvents/${grantId}`);
    h.data.delete(`serverUsers/${uid}/pendingGrants/${grantId}`);
    assert.equal((await h.issuer.issue({})).unchanged,false);assert.equal(h.writes,2);
    assert.equal((await h.issuer.issue({})).unchanged,true);assert.equal(h.writes,2);
    assert.equal(h.data.get(`serverUsers/${uid}/rewardEvents/${grantId}`).sha256,
        h.data.get(`serverUsers/${uid}/pendingGrants/${grantId}`).sourceEventSha256);
});
test("valid proof is read-only and ignores mutable claimed status",async()=>{
    const h=fixture();assert.equal((await h.read()).sha256,h.event.sha256);
    h.grant.status="credited";assert.equal((await h.read()).create,false);assert.equal(h.writes,0);
});
const mutations={
    missing:h=>h.data.delete(`serverUsers/${uid}/rewardEvents/${grantId}`),
    uid:h=>{h.event.ownerUid="other-user";},
    amount:h=>{h.event.amount=5000;},
    day:h=>{h.event.periodDate="20261003";},
    character:h=>{h.event.characterId="other-character";},
    revision:h=>{h.event.sourceRevision=3;},
    digest:h=>{h.grant.sourceEventSha256="0".repeat(64);},
    downgrade:h=>{delete h.grant.eventType;},
    timestamp:h=>{delete h.event.createdAt;}
};
for(const [name,mutate] of Object.entries(mutations))test(`reject ${name} evidence without backfill`,async()=>{
    const h=fixture();mutate(h);
    await assert.rejects(h.read());await assert.rejects(h.issuer.issue({}));assert.equal(h.writes,0);
});
test("orphan event cannot authorize a new grant",async()=>{
    const h=fixture();h.data.delete(`serverUsers/${uid}/pendingGrants/${grantId}`);
    await assert.rejects(h.issuer.issue({}),/inconsistent/);assert.equal(h.writes,0);
});

const sourceMutations={
    "missing source snapshot":h=>h.data.delete(`serverUsers/${uid}/playableSnapshots/2`),
    "missing source archive":h=>h.data.delete(`serverUsers/${uid}/recoveryArchives/2`),
    "source snapshot digest":h=>{h.data.get(`serverUsers/${uid}/playableSnapshots/2`).sha256="0".repeat(64);},
    "source archive content":h=>{h.data.get(`serverUsers/${uid}/recoveryArchives/2`).sourceRecords.economy.gold=999;},
    "source archive UID":h=>{h.data.get(`serverUsers/${uid}/recoveryArchives/2`).ownerUid="other-user";},
    "self-consistent nonexistent character":h=>{h.event.characterId="not-in-source";h.event.sha256=eventDigest(h.event);h.grant.sourceEventSha256=h.event.sha256;},
    "self-consistent nonexistent revision":h=>{h.event.sourceRevision=99;h.event.sha256=eventDigest(h.event);h.grant.sourceEventSha256=h.event.sha256;}
};
for(const [name,mutate] of Object.entries(sourceMutations)){
    test(`original eligibility rejects ${name} for existing and new issuance without writes`,async()=>{
        const h=fixture();mutate(h);
        await assert.rejects(h.read(),e=>e.code==="data-loss");
        await assert.rejects(h.issuer.issue({}),e=>e.code==="data-loss");
        assert.equal(h.writes,0);
        // Creation reads the original account snapshot/archive, too.
        if(!name.startsWith("self-consistent")){
            h.data.delete(`serverUsers/${uid}/rewardEvents/${grantId}`);
            h.data.delete(`serverUsers/${uid}/pendingGrants/${grantId}`);
            await assert.rejects(h.issuer.issue({}),e=>e.code==="data-loss");
            assert.equal(h.writes,0);
        }
    });
}
test("new event requires the account pointer to match its immutable source",async()=>{
    const h=fixture();h.data.delete(`serverUsers/${uid}/rewardEvents/${grantId}`);
    h.data.delete(`serverUsers/${uid}/pendingGrants/${grantId}`);
    h.data.get(`serverUsers/${uid}/account/current`).snapshotSha256="0".repeat(64);
    await assert.rejects(h.issuer.issue({}),e=>e.code==="data-loss");assert.equal(h.writes,0);
});
test("original eligibility survives later account revision and balance changes without rewriting event",async()=>{
    const h=fixture();const before={...h.event};
    h.data.get(`serverUsers/${uid}/account/current`).serverRevision=10;
    h.data.get(`users/${uid}/saves/current`).serverRevision=10;
    h.data.set(`serverUsers/${uid}/economy/current`,{gold:999});
    assert.equal((await h.read()).sha256,h.event.sha256);
    assert.equal((await h.issuer.issue({})).unchanged,true);
    assert.deepEqual(h.event,before);assert.equal(h.writes,0);
});

test("structurally valid historical and multi-character source revisions are not eligible",async()=>{
    for(const kind of ["historical","multi-character"]){
        const h=fixture();const records=structuredClone(h.data.get(`serverUsers/${uid}/recoveryArchives/2`).sourceRecords);
        if(kind==="historical"){
            for(const value of Object.values(records)){
                for(const record of Array.isArray(value)?value:[value])record.provenance="grandfathered-unverified-history";
            }
            records.progress.sidecars=Object.fromEntries(Object.keys(records.progress.sidecars).map(key=>[key,{status:"present",raw:"{}"}]));
            records.claimRecords=[{...records.account,claimKey:"historical:all",status:"blocked"}];
            records.claimCheckpoint.claimCount=1;
            records.claimCheckpoint.claimDigest=claimRecordsDigest(records.claimRecords);
            records.claimCheckpoint.historicalClaimsBlocked=true;
        }else{
            records.account.slots[1]="second-character";
            records.characters.push({...structuredClone(records.characters[0]),characterId:"second-character",slotIndex:1});
        }
        const bundle=assembleCanonicalSnapshot(uid,2,records);
        h.data.set(`serverUsers/${uid}/playableSnapshots/2`,bundle);
        h.data.set(`serverUsers/${uid}/recoveryArchives/2`,createRecoveryArchive(uid,2,records,bundle));
        h.data.get(`serverUsers/${uid}/account/current`).snapshotSha256=bundle.sha256;
        await assert.rejects(h.read(),e=>e.code==="data-loss");
        h.data.delete(`serverUsers/${uid}/rewardEvents/${grantId}`);
        h.data.delete(`serverUsers/${uid}/pendingGrants/${grantId}`);
        await assert.rejects(h.issuer.issue({}),e=>e.code==="data-loss");
        assert.equal(h.writes,0);
    }
});
