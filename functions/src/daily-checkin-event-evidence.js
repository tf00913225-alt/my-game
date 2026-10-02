"use strict";

const {createHash}=require("node:crypto");
const {REWARD_GOLD}=require("./daily-checkin-policy");
const {inspectRecoveryArchive}=require("./canonical-recovery-archive");
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
    allowCreate=false,day=null,characterId=null,sourceRevision=null,sourceSnapshotSha256=null}){
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
        await verifySource(event,sourceSnapshotSha256);
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
    await verifySource(event);
    return {ref,event,sha256,create:false};

    // A self-consistent event digest is not proof that its character existed.
    // Resolve the original revision, never today's mutable account/balance.
    // Reuse the complete snapshot/archive verifier before any caller writes.
    async function verifySource(event,expectedSha256){
        const revision=String(event.sourceRevision);
        const [snapshot,archive]=await Promise.all([
            tx.get(root.collection("playableSnapshots").doc(revision)),
            tx.get(root.collection("recoveryArchives").doc(revision))
        ]);
        if(!snapshot.exists||!archive.exists){
            fail("data-loss","Daily check-in source snapshot or archive is missing.");
        }
        let records;
        try{
            records=inspectRecoveryArchive(archive.data(),uid,event.sourceRevision,snapshot.data());
        }catch(_){
            fail("data-loss","Daily check-in source snapshot or archive is inconsistent.");
        }
        const slots=records.account.slots;
        if(records.account.provenance!=="server-created"||
           slots[0]!==event.characterId||slots[1]!==null||slots[2]!==null||
           records.characters.length!==1||
           (allowCreate&&snapshot.data().sha256!==expectedSha256)){
            fail("data-loss","Daily check-in source character is not eligible.");
        }
    }
}
module.exports={readDailyCheckinEvidence,isDailyGrant,eventDigest};
