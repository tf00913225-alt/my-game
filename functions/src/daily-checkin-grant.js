"use strict";

// The only present-day quest that the server can prove without trusting a
// browser battle result is opening today's quest list (the check-in quest).
// Issuance is internal: it does not publish a playable cloud character or
// accept a client-supplied day, reward, balance or completion counter.
const {readDailyCheckinEvidence}=require("./daily-checkin-event-evidence");
const {taipeiDay,REWARD_GOLD}=require("./daily-checkin-policy");

function createDailyCheckinGrant({db,FieldValue,HttpsError,runProtected,
    inspectExistingEnvelope,now=Date.now}){
    const fail=(code,message)=>{throw new HttpsError(code,message);};

    async function issue(request){
        // Capture once: a transaction retried across midnight must not change
        // its identity halfway through the same request.
        const day=taipeiDay(now());
        const grantId=`daily-checkin-${day}`;
        return runProtected(request,async(tx,session)=>{
            const uid=session.uid;
            const root=db.collection("serverUsers").doc(uid);
            const accountRef=root.collection("account").doc("current");
            const grantRef=root.collection("pendingGrants").doc(grantId);
            const envelopeRef=db.collection("users").doc(uid).collection("saves").doc("current");
            const [accountSnap,grantSnap,envelopeSnap]=await Promise.all([
                tx.get(accountRef),tx.get(grantRef),tx.get(envelopeRef)
            ]);
            if(!envelopeSnap.exists||!accountSnap.exists){
                fail("failed-precondition","Canonical first character required.");
            }
            const envelope=inspectExistingEnvelope(envelopeSnap.data(),uid);
            const account=accountSnap.data();
            if(envelope.kind!=="current"||envelope.data.authoritativeStateReady!==false||
               account.ownerUid!==uid||account.provenance!=="server-created"||
               !Array.isArray(account.slots)||account.slots.length!==3||
               typeof account.slots[0]!=="string"||account.slots[1]!==null||
               account.slots[2]!==null||
               !Number.isSafeInteger(account.serverRevision)||
               account.serverRevision<1||account.serverRevision>envelope.serverRevision){
                fail("failed-precondition","Canonical first character is not eligible.");
            }
            if(grantSnap.exists){
                await readDailyCheckinEvidence({tx,root,uid,grantId,grant:grantSnap.data(),fail});
                const grant=grantSnap.data();
                if(grant.schemaVersion!==1||grant.ownerUid!==uid||
                   grant.source!=="server-event"||grant.kind!=="gold"||
                   grant.amount!==REWARD_GOLD||grant.eventType!=="daily-checkin"||
                   grant.periodDate!==day||
                   !["pending","reserved","credited"].includes(grant.status)||
                   (grant.status==="pending"?grant.claimedByOperationId!==null:
                       !/^[A-Za-z0-9_-]{16,64}$/.test(grant.claimedByOperationId||""))){
                    fail("data-loss","Daily check-in grant is inconsistent.");
                }
                return {grantId,periodDate:day,unchanged:true,status:grant.status};
            }
            const sourceGrant={ownerUid:uid,source:"server-event",eventType:"daily-checkin",
                periodDate:day,kind:"gold",amount:REWARD_GOLD};
            const proof=await readDailyCheckinEvidence({tx,root,uid,grantId,grant:sourceGrant,fail,
                allowCreate:true,day,characterId:account.slots[0],sourceRevision:account.serverRevision,
                sourceSnapshotSha256:account.snapshotSha256});
            tx.create(proof.ref,{...proof.event,sha256:proof.sha256,createdAt:FieldValue.serverTimestamp()});
            tx.create(grantRef,{schemaVersion:1,ownerUid:uid,sourceEventSha256:proof.sha256,
                source:"server-event",eventType:"daily-checkin",periodDate:day,
                kind:"gold",amount:REWARD_GOLD,status:"pending",
                claimedByOperationId:null,createdAt:FieldValue.serverTimestamp()});
            return {grantId,periodDate:day,unchanged:false,status:"pending"};
        });
    }
    return Object.freeze({issue});
}

module.exports={createDailyCheckinGrant,taipeiDay,REWARD_GOLD};
