"use strict";

const {createHash}=require("node:crypto");
const {inspectRecoveryArchive}=require("./canonical-recovery-archive");
const ID=/^[A-Za-z0-9_-]{16,64}$/;
const HASH=/^[a-f0-9]{64}$/;
const TTL_MS=10*60*1000;
const KIND="battle-source-preparation";
const digest=record=>createHash("sha256").update(JSON.stringify([
    record.schemaVersion,record.ownerUid,record.attemptId,record.kind,
    record.characterId,record.sourceRevision,record.snapshotSha256,
    record.creationSessionId,record.issuedAtMs,record.expiresAtMs,
    record.outcomeVerified,record.rewardEligible
])).digest("hex");

// Internal preparation only. A sealed character and a session prove who may
// start, NOT what enemy was fought or who won. No completion/grant API exists.
// One immutable preparation per canonical revision bounds duplicate starts.
function createCanonicalBattleAttempt({db,FieldValue,HttpsError,runProtected,
    inspectExistingEnvelope,now=Date.now}){
    const fail=(code,message)=>{throw new HttpsError(code,message);};
    function intent(args){
        if(!args||typeof args!=="object"||Array.isArray(args)||
           Object.keys(args).sort().join("|")!=="expectedRevision|operationId"||
           typeof args.operationId!=="string"||!ID.test(args.operationId)||
           !Number.isSafeInteger(args.expectedRevision)||args.expectedRevision<1){
            fail("invalid-argument","Only an attempt operation ID and revision are accepted.");
        }
    }
    async function source(tx,root,uid,revision,sha256,characterId){
        const [snapshot,archive]=await Promise.all([
            tx.get(root.collection("playableSnapshots").doc(String(revision))),
            tx.get(root.collection("recoveryArchives").doc(String(revision)))
        ]);
        let records;
        try{
            if(!snapshot.exists||!archive.exists||snapshot.data().sha256!==sha256){
                throw new Error("Missing source");
            }
            records=inspectRecoveryArchive(archive.data(),uid,revision,snapshot.data());
        }catch(_){fail("data-loss","Battle attempt source snapshot or archive is inconsistent.");}
        if(records.account.provenance!=="server-created"||
           records.account.slots[0]!==characterId||records.account.slots[1]!==null||
           records.account.slots[2]!==null||records.characters.length!==1){
            fail("failed-precondition","Only a server-created first character may prepare an attempt.");
        }
    }
    async function begin(request,args){
        intent(args);
        if(Object.keys(request?.data||{}).some(key=>!["uid","session"].includes(key))){
            fail("invalid-argument","Battle results and client source fields are not accepted.");
        }
        // Capture before transaction retries; server time never comes from intent.
        const issuedAtMs=now();
        if(!Number.isSafeInteger(issuedAtMs)||issuedAtMs<1||
           !Number.isSafeInteger(issuedAtMs+TTL_MS))fail("internal","Server clock is unavailable.");
        return runProtected(request,async(tx,session)=>{
            const uid=session.uid,{operationId,expectedRevision}=args;
            const root=db.collection("serverUsers").doc(uid);
            const attemptRef=root.collection("battleAttempts").doc(operationId);
            const operationRef=root.collection("operations").doc(operationId);
            const revisionRef=root.collection("battleAttemptSources").doc(String(expectedRevision));
            const [envelopeSnap,accountSnap,attemptSnap,operationSnap,revisionSnap,
                grantSnap,ledgerSnap]=await Promise.all([
                tx.get(db.collection("users").doc(uid).collection("saves").doc("current")),
                tx.get(root.collection("account").doc("current")),tx.get(attemptRef),
                tx.get(operationRef),tx.get(revisionRef),
                tx.get(root.collection("grantOperations").doc(operationId)),
                tx.get(root.collection("ledgerEntries").doc(operationId))
            ]);
            if(!envelopeSnap.exists||!accountSnap.exists)fail("failed-precondition","Canonical character required.");
            const envelope=inspectExistingEnvelope(envelopeSnap.data(),uid),account=accountSnap.data();
            if(envelope.kind!=="current"||envelope.data.authoritativeStateReady!==false||
               account.ownerUid!==uid||account.provenance!=="server-created"||
               !Number.isSafeInteger(account.serverRevision)||account.serverRevision<1||
               account.serverRevision>envelope.serverRevision||!Array.isArray(account.slots)||
               account.slots.length!==3||typeof account.slots[0]!=="string"||!account.slots[0]||
               account.slots[1]!==null||account.slots[2]!==null){
                fail("failed-precondition","Unpublished first-character account required.");
            }
            if(attemptSnap.exists||operationSnap.exists){
                const attempt=attemptSnap.exists?attemptSnap.data():null;
                const receipt=operationSnap.exists?operationSnap.data():null;
                const marker=revisionSnap.exists?revisionSnap.data():null;
                if(!attempt||!receipt||!marker||grantSnap.exists||ledgerSnap.exists||
                   attempt.schemaVersion!==1||attempt.ownerUid!==uid||attempt.attemptId!==operationId||
                   attempt.kind!==KIND||attempt.characterId!==account.slots[0]||
                   attempt.sourceRevision!==expectedRevision||!HASH.test(attempt.snapshotSha256||"")||
                   !Number.isSafeInteger(attempt.issuedAtMs)||attempt.issuedAtMs<1||
                   attempt.expiresAtMs!==attempt.issuedAtMs+TTL_MS||
                   !/^[A-Za-z0-9_-]{32}$/.test(attempt.creationSessionId||"")||
                   attempt.outcomeVerified!==false||attempt.rewardEligible!==false||
                   attempt.sha256!==digest(attempt)||
                   receipt.schemaVersion!==1||receipt.ownerUid!==uid||receipt.operationId!==operationId||
                   receipt.kind!==KIND||receipt.sourceRevision!==expectedRevision||
                   receipt.attemptSha256!==attempt.sha256||receipt.creditedToCharacter!==false||
                   marker.schemaVersion!==1||marker.ownerUid!==uid||marker.sourceRevision!==expectedRevision||
                   marker.attemptId!==operationId||marker.attemptSha256!==attempt.sha256||
                   [attempt,receipt,marker].some(record=>!record.createdAt||
                       typeof record.createdAt.toMillis!=="function")||
                   expectedRevision>account.serverRevision){
                    fail("data-loss","Battle attempt receipt or source marker is inconsistent.");
                }
                // A new active session must not inherit an earlier attempt.
                if(attempt.creationSessionId!==session.sessionId){
                    fail("failed-precondition","Battle attempt belongs to an earlier session.");
                }
                await source(tx,root,uid,attempt.sourceRevision,attempt.snapshotSha256,attempt.characterId);
                return result(attempt,true,issuedAtMs);
            }
            if(grantSnap.exists||ledgerSnap.exists)fail("failed-precondition","Operation ID is already used.");
            if(revisionSnap.exists)fail("already-exists","This source revision already has a battle preparation.");
            if(envelope.serverRevision!==expectedRevision||account.serverRevision!==expectedRevision){
                fail("aborted","CLOUD_REVISION_CONFLICT");
            }
            if(!HASH.test(account.snapshotSha256||""))fail("data-loss","Canonical snapshot pointer is invalid.");
            if(!/^[A-Za-z0-9_-]{32}$/.test(session.sessionId||""))fail("failed-precondition","Active session required.");
            await source(tx,root,uid,expectedRevision,account.snapshotSha256,account.slots[0]);
            const attempt={schemaVersion:1,ownerUid:uid,attemptId:operationId,kind:KIND,
                characterId:account.slots[0],sourceRevision:expectedRevision,
                snapshotSha256:account.snapshotSha256,creationSessionId:session.sessionId,
                issuedAtMs,expiresAtMs:issuedAtMs+TTL_MS,outcomeVerified:false,rewardEligible:false};
            attempt.sha256=digest(attempt);
            const createdAt=FieldValue.serverTimestamp();
            tx.create(attemptRef,{...attempt,createdAt});
            tx.create(operationRef,{schemaVersion:1,ownerUid:uid,operationId,kind:KIND,
                sourceRevision:expectedRevision,attemptSha256:attempt.sha256,
                creditedToCharacter:false,createdAt});
            tx.create(revisionRef,{schemaVersion:1,ownerUid:uid,sourceRevision:expectedRevision,
                attemptId:operationId,attemptSha256:attempt.sha256,createdAt});
            return result(attempt,false,issuedAtMs);
        });
    }
    function result(attempt,unchanged,requestTime){
        return {attemptId:attempt.attemptId,sourceRevision:attempt.sourceRevision,
            attemptSha256:attempt.sha256,issuedAtMs:attempt.issuedAtMs,expiresAtMs:attempt.expiresAtMs,
            expired:requestTime>=attempt.expiresAtMs,unchanged,
            outcomeVerified:false,rewardEligible:false,creditedToCharacter:false};
    }
    return Object.freeze({begin});
}
module.exports={createCanonicalBattleAttempt,TTL_MS};
