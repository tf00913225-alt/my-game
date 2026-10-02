"use strict";

const {createHash}=require("node:crypto");
const {REWARD_GOLD}=require("./daily-checkin-policy");
function validDay(day){
    if(typeof day!=="string"||!/^\d{8}$/.test(day))return false;
    const iso=`${day.slice(0,4)}-${day.slice(4,6)}-${day.slice(6,8)}`;
    const date=new Date(`${iso}T00:00:00Z`);
    return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===iso;
}
const isDailyGrant=(grantId,grant)=>grantId.startsWith("daily-checkin-")||
    grant?.eventType==="daily-checkin";
function eventDigest(event){
    const fields=[event.schemaVersion,event.ownerUid,event.eventId,event.eventType,
        event.periodDate,event.kind,event.amount,event.characterId,event.sourceRevision];
    return createHash("sha256").update(JSON.stringify(fields)).digest("hex");
}
// Immutable server observation of the check-in intent, not a browser completion
// flag. Callers defer create until all transaction reads have completed.
async function readDailyCheckinEvidence({tx,root,uid,grantId,grant,fail,
    allowCreate=false,day=null,characterId=null,sourceRevision=null}){
    if(!isDailyGrant(grantId,grant))return null;
    const ref=root.collection("rewardEvents").doc(grantId);
    const snap=await tx.get(ref);
    const invalid=()=>fail("data-loss","Daily check-in event evidence is inconsistent.");
    if(!snap.exists){
        if(!allowCreate){fail("failed-precondition","REWARD_EVENT_EVIDENCE_REQUIRED");}
        if(!validDay(day)||grant.eventType!=="daily-checkin"||grant.periodDate!==day||
           grant.kind!=="gold"||grant.amount!==REWARD_GOLD||
           grantId!==`daily-checkin-${day}`||typeof characterId!=="string"||!characterId||
           !Number.isSafeInteger(sourceRevision)||sourceRevision<1)invalid();
        const event={schemaVersion:1,ownerUid:uid,eventId:grantId,
            eventType:"daily-checkin",periodDate:day,kind:"gold",amount:REWARD_GOLD,
            characterId,sourceRevision};
        return {ref,event,sha256:eventDigest(event),create:true};
    }
    // Never repair an orphan event or retrofit evidence onto an old grant.
    if(allowCreate)invalid();
    const event=snap.data();
    const date=event?.periodDate;
    if(event?.schemaVersion!==1||event.ownerUid!==uid||event.eventId!==grantId||
       event.eventType!=="daily-checkin"||!validDay(date)||
       grantId!==`daily-checkin-${date}`||event.kind!=="gold"||event.amount!==REWARD_GOLD||
       typeof event.characterId!=="string"||!event.characterId||
       !Number.isSafeInteger(event.sourceRevision)||event.sourceRevision<1||
       !event.createdAt||typeof event.createdAt.toMillis!=="function"||
       grant.eventType!==event.eventType||grant.periodDate!==date||
       grant.kind!==event.kind||grant.amount!==event.amount||
       grant.source!=="server-event"||grant.ownerUid!==uid)invalid();
    const sha256=eventDigest(event);
    if(event.sha256!==sha256||grant.sourceEventSha256!==sha256)invalid();
    return {ref,event,sha256,create:false};
}
module.exports={readDailyCheckinEvidence,isDailyGrant,eventDigest};
