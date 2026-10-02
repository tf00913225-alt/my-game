import assert from "node:assert/strict";
import test from "node:test";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const {readDailyCheckinEvidence,eventDigest}=require("../functions/src/daily-checkin-event-evidence");
const {createDailyCheckinGrant}=require("../functions/src/daily-checkin-grant");
const uid="event-user",grantId="daily-checkin-20261002",stamp={toMillis:()=>1};
function fixture(){
    const event={schemaVersion:1,ownerUid:uid,eventId:grantId,eventType:"daily-checkin",
        periodDate:"20261002",kind:"gold",amount:50,characterId:"first-character",sourceRevision:2};
    event.sha256=eventDigest(event);event.createdAt=stamp;
    const grant={schemaVersion:1,ownerUid:uid,source:"server-event",eventType:"daily-checkin",
        periodDate:event.periodDate,kind:"gold",amount:50,status:"pending",claimedByOperationId:null,
        sourceEventSha256:event.sha256,createdAt:stamp};
    const data=new Map([[`serverUsers/${uid}/rewardEvents/${grantId}`,event],
        [`serverUsers/${uid}/pendingGrants/${grantId}`,grant],
        [`serverUsers/${uid}/account/current`,{ownerUid:uid,provenance:"server-created",
            slots:["first-character",null,null],serverRevision:2}],
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
