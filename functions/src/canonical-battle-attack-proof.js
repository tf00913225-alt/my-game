"use strict";

const {randomBytes:cryptoRandomBytes}=require("node:crypto");
const {createCanonicalBattleEncounter}=require("./canonical-battle-encounter");
const {samplePlainPlayerNormalAttack}=require("./canonical-battle-normal-attack");
const {claimRecordsDigest:digest}=require("./canonical-snapshot");
const currentPolicy=require("./generated/plain-player-normal-attack-policy.json");
const ID=/^[A-Za-z0-9_-]{16,64}$/;
const HASH=/^[a-f0-9]{64}$/;
const KIND="plain-player-normal-attack-proof";
const flags={combatRulesReady:false,outcomeVerified:false,rewardEligible:false,creditedToCharacter:false};
const fields=["schemaVersion","kind","ownerUid","operationId","attemptId","attemptSha256",
    "encounterSha256","characterId","sourceRevision","snapshotSha256","creationSessionId",
    "sealedAtMs","expiresAtMs","rulesPolicySha256","projection",...Object.keys(flags)];
const proofDigest=value=>digest(Object.fromEntries(fields.map(key=>[key,value[key]])));
const stamped=value=>value?.createdAt&&typeof value.createdAt.toMillis==="function";
function inspectRulesPolicy(policy,sha256){
    if(!policy||policy.schemaVersion!==1||policy.policyId!=="plain-player-normal-attack-v1"||
       policy.scope!=="single-plain-player-normal-attack-arithmetic-only"||policy.sourceOwner!=="js/00-main.js"||
       !HASH.test(policy.rulesSha256||"")||policy.combatRulesReady!==false||
       policy.outcomeVerified!==false||policy.rewardEligible!==false||
       !policy.declarationDigests||!policy.compatibilityDigests||
       Object.values({...policy.declarationDigests,...policy.compatibilityDigests}).some(v=>!HASH.test(v))||
       digest(policy)!==sha256)throw Error("Invalid pinned normal attack rules policy");
    return policy;
}
// Protected immutable arithmetic observation, NOT a legal action or battle
// verdict. One proof per preparation, no successor/repeated combat lifecycle.
// No callable/client hook or account/economy/HP/reward mutation.
function createCanonicalBattleAttackProof(dependencies){
    const {db,FieldValue,HttpsError,runProtected,now=Date.now,randomBytes=cryptoRandomBytes}=dependencies;
    const encounters=createCanonicalBattleEncounter(dependencies);
    const fail=(code,message)=>{throw new HttpsError(code,message);};
    async function seal(request,args){
        if(!args||typeof args!=="object"||Array.isArray(args)||
           Object.keys(args).sort().join("|")!=="attemptId|expectedRevision|operationId"||
           typeof args.operationId!=="string"||typeof args.attemptId!=="string"||
           !ID.test(args.operationId)||!ID.test(args.attemptId)||args.operationId===args.attemptId||
           !Number.isSafeInteger(args.expectedRevision)||args.expectedRevision<1||
           Object.keys(request?.data||{}).some(key=>!["uid","session"].includes(key))){
            fail("invalid-argument","Only operation ID, preparation ID and source revision are accepted.");
        }
        const time=now();
        if(!Number.isSafeInteger(time)||time<1)fail("internal","Server clock is unavailable.");
        // Entropy is captured once outside the transaction callback. Firestore
        // retries use the same pool; persisted replays never consume this pool.
        const bytes=randomBytes(18);
        if(!Buffer.isBuffer(bytes)||bytes.length!==18)fail("internal","Server entropy is unavailable.");
        const pool=[0,6,12].map(offset=>bytes.readUIntBE(offset,6)/281474976710656);
        return runProtected(request,async(tx,session)=>{
            const {attemptId,operationId,expectedRevision}=args,uid=session.uid;
            const root=db.collection("serverUsers").doc(uid);
            const original=await encounters.readSeal(tx,session,{attemptId,expectedRevision},time);
            const {attempt,sealed,policy,snapshot,archive}=original;
            const ref=root.collection("battleAttackProofs").doc(attemptId);
            const receiptRef=root.collection("operations").doc(operationId);
            const markerRef=root.collection("battleAttackAttempts").doc(attemptId);
            const [proofSnap,receiptSnap,markerSnap,accountSnap,envelopeSnap,grantSnap,ledgerSnap,attemptSnap]=
                await Promise.all([tx.get(ref),tx.get(receiptRef),tx.get(markerRef),
                    tx.get(root.collection("account").doc("current")),
                    tx.get(db.collection("users").doc(uid).collection("saves").doc("current")),
                    tx.get(root.collection("grantOperations").doc(operationId)),
                    tx.get(root.collection("ledgerEntries").doc(operationId)),
                    tx.get(root.collection("battleAttempts").doc(operationId))]);
            if(proofSnap.exists&&proofSnap.data().operationId!==operationId){
                fail("already-exists","Preparation already has an arithmetic proof.");
            }
            if(proofSnap.exists||receiptSnap.exists){
                const proof=proofSnap.exists?proofSnap.data():null;
                const receipt=receiptSnap.exists?receiptSnap.data():null;
                const marker=markerSnap.exists?markerSnap.data():null;
                if(!proof||!receipt||!marker||grantSnap.exists||ledgerSnap.exists||attemptSnap.exists||
                   proof.schemaVersion!==1||proof.kind!==KIND||proof.ownerUid!==uid||
                   proof.operationId!==operationId||proof.attemptId!==attemptId||
                   proof.attemptSha256!==attempt.sha256||proof.encounterSha256!==sealed.sha256||
                   proof.characterId!==attempt.characterId||proof.sourceRevision!==expectedRevision||
                   proof.snapshotSha256!==attempt.snapshotSha256||proof.creationSessionId!==session.sessionId||
                   !Number.isSafeInteger(proof.sealedAtMs)||proof.sealedAtMs<sealed.sealedAtMs||
                   proof.sealedAtMs>=attempt.expiresAtMs||proof.expiresAtMs!==attempt.expiresAtMs||
                   !HASH.test(proof.rulesPolicySha256||"")||proof.sha256!==proofDigest(proof)||
                   Object.keys(flags).some(key=>proof[key]!==false)||
                   receipt.schemaVersion!==1||receipt.kind!==KIND||receipt.ownerUid!==uid||
                   receipt.operationId!==operationId||receipt.attemptId!==attemptId||
                   receipt.sourceRevision!==expectedRevision||receipt.proofSha256!==proof.sha256||
                   receipt.creditedToCharacter!==false||
                   marker.schemaVersion!==1||marker.ownerUid!==uid||marker.attemptId!==attemptId||
                   marker.operationId!==operationId||marker.proofSha256!==proof.sha256||
                   [proof,receipt,marker].some(value=>!stamped(value))){
                    fail("data-loss","Arithmetic proof, receipt or preparation marker is inconsistent.");
                }
                const pinnedSnap=await tx.get(root.collection("battleAttackPolicies").doc(proof.rulesPolicySha256));
                try{
                    const pinned=pinnedSnap.exists?pinnedSnap.data():null;
                    if(!pinned||pinned.schemaVersion!==1||pinned.ownerUid!==uid||!stamped(pinned))throw Error("policy record");
                    const rules=inspectRulesPolicy(pinned.policy,proof.rulesPolicySha256),p=proof.projection;
                    const {sha256,...body}=p||{};
                    if(!p||p.schemaVersion!==1||p.kind!=="plain-player-normal-attack-arithmetic"||
                       p.ownerUid!==uid||p.sourceRevision!==expectedRevision||p.characterId!==attempt.characterId||
                       p.snapshotSha256!==snapshot.sha256||p.encounterKey!==sealed.encounterKey||
                       p.encounterPolicySha256!==policy.sha256||p.definitionSha256!==sealed.definitionSha256||
                       p.rulesSha256!==rules.rulesSha256||sha256!==digest(body)||
                       Object.keys(flags).some(key=>p[key]!==false)||
                       !Array.isArray(p.randomTape)||![1,3].includes(p.randomTape.length)||
                       p.randomSamplesConsumed!==p.randomTape.length||
                       p.randomTape.some(v=>typeof v!=="number"||!Number.isFinite(v)||v<0||v>=1)||
                       typeof p.hit!=="boolean"||typeof p.isCrit!=="boolean"||
                       p.randomTape.length!==(p.hit?3:1)||(!p.hit&&(p.damage!==0||p.isCrit))||
                       !Number.isSafeInteger(p.damage)||p.damage<0||p.damage>1000000000||
                       p.hpBefore!==policy.entries[sealed.encounterKey].stats.maxHP||
                       p.hpAfter!==Math.max(0,p.hpBefore-p.damage))throw Error("projection binding");
                }catch(_){fail("data-loss","Original pinned rules or arithmetic projection is inconsistent.");}
                // Never run new deployment code against historical projections.
                return result(proof,true,time);
            }
            if(markerSnap.exists)fail("already-exists","Preparation already has an arithmetic proof.");
            if(grantSnap.exists||ledgerSnap.exists||attemptSnap.exists)fail("failed-precondition","Operation ID is already used.");
            if(time<sealed.sealedAtMs||time>=attempt.expiresAtMs){
                fail("failed-precondition","Preparation is outside its original server time window.");
            }
            if(accountSnap.data().serverRevision!==expectedRevision||
               envelopeSnap.data().serverRevision!==expectedRevision||
               accountSnap.data().snapshotSha256!==snapshot.sha256)fail("aborted","CLOUD_REVISION_CONFLICT");
            const rulesPolicySha256=digest(currentPolicy);
            try{inspectRulesPolicy(currentPolicy,rulesPolicySha256);}catch(_){fail("internal","Server attack policy is invalid.");}
            const policyRef=root.collection("battleAttackPolicies").doc(rulesPolicySha256);
            const pinnedSnap=await tx.get(policyRef);
            if(pinnedSnap.exists){
                try{const pinned=pinnedSnap.data();
                    if(pinned.schemaVersion!==1||pinned.ownerUid!==uid||!stamped(pinned))throw Error("policy record");
                    inspectRulesPolicy(pinned.policy,rulesPolicySha256);
                }catch(_){fail("data-loss","Existing pinned rules policy is inconsistent.");}
            }
            let cursor=0,projection;
            try{projection=samplePlainPlayerNormalAttack({uid,revision:expectedRevision,snapshot,archive,
                encounterPolicy:policy,encounterKey:sealed.encounterKey},()=>pool[cursor++]);
            }catch(_){fail("failed-precondition","Source is unsupported by the plain attack rules.");}
            const proof={schemaVersion:1,kind:KIND,ownerUid:uid,operationId,attemptId,
                attemptSha256:attempt.sha256,encounterSha256:sealed.sha256,characterId:attempt.characterId,
                sourceRevision:expectedRevision,snapshotSha256:snapshot.sha256,creationSessionId:session.sessionId,
                sealedAtMs:time,expiresAtMs:attempt.expiresAtMs,rulesPolicySha256,projection,...flags};
            proof.sha256=proofDigest(proof);
            const createdAt=FieldValue.serverTimestamp();
            if(!pinnedSnap.exists)tx.create(policyRef,{schemaVersion:1,ownerUid:uid,policy:currentPolicy,createdAt});
            tx.create(ref,{...proof,createdAt});
            tx.create(receiptRef,{schemaVersion:1,kind:KIND,ownerUid:uid,operationId,attemptId,
                sourceRevision:expectedRevision,proofSha256:proof.sha256,creditedToCharacter:false,createdAt});
            tx.create(markerRef,{schemaVersion:1,ownerUid:uid,attemptId,operationId,proofSha256:proof.sha256,createdAt});
            return result(proof,false,time);
        });
    }
    function result(proof,unchanged,time){
        // Entropy/projection remain UID-private, absent from this return value.
        return {operationId:proof.operationId,attemptId:proof.attemptId,sourceRevision:proof.sourceRevision,
            proofSha256:proof.sha256,rulesPolicySha256:proof.rulesPolicySha256,expiresAtMs:proof.expiresAtMs,
            expired:time>=proof.expiresAtMs,unchanged,...flags};
    }
    return Object.freeze({seal});
}
module.exports={createCanonicalBattleAttackProof};
