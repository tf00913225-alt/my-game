"use strict";

const {createCanonicalBattleAttempt}=require("./canonical-battle-attempt");
const {claimRecordsDigest:digest}=require("./canonical-snapshot");
const catalog=require("./generated/battle-encounter-catalog.json");
const ID=/^[A-Za-z0-9_-]{16,64}$/;
const HASH=/^[a-f0-9]{64}$/;
const KIND="battle-encounter-stat-seal";
const fields=["schemaVersion","kind","ownerUid","operationId","attemptId","attemptSha256",
    "characterId","sourceRevision","snapshotSha256","creationSessionId","encounterKey",
    "policySha256","definitionSha256","sealedAtMs","expiresAtMs","combatRulesReady",
    "outcomeVerified","rewardEligible","creditedToCharacter"];
const sealDigest=record=>digest(Object.fromEntries(fields.map(key=>[key,record[key]])));
const hasStamp=record=>record?.createdAt&&typeof record.createdAt.toMillis==="function";
function inspectPolicy(policy){
    if(!policy||policy.schemaVersion!==1||policy.policyId!=="wild-forest-regular-stats-v1"||
       policy.scope!=="single-enemy-stat-definition-only"||policy.projectionOwner!=="MonsterBalance"||
       policy.combatRulesReady!==false||policy.outcomeVerified!==false||policy.rewardEligible!==false||
       !HASH.test(policy.sha256||"")||!policy.entries||!policy.sourceDigests){
        throw new Error("Invalid sealed encounter policy");
    }
    const {sha256,...body}=policy;
    if(digest(body)!==sha256)throw new Error("Invalid encounter policy digest");
    return policy;
}

// Internal stat-definition binding only. It neither selects a playable roster
// nor authorizes combat/skills/results/rewards. No public callable or hook.
function createCanonicalBattleEncounter(dependencies){
    const {db,FieldValue,HttpsError,runProtected,now=Date.now}=dependencies;
    const preparations=createCanonicalBattleAttempt(dependencies);
    const fail=(code,message)=>{throw new HttpsError(code,message);};
    async function seal(request,args){
        if(!args||typeof args!=="object"||Array.isArray(args)||
           Object.keys(args).sort().join("|")!=="attemptId|encounterKey|expectedRevision|operationId"||
           typeof args.operationId!=="string"||typeof args.attemptId!=="string"||
           !ID.test(args.operationId)||!ID.test(args.attemptId)||
           args.operationId===args.attemptId||typeof args.encounterKey!=="string"||
           !/^wild\.[a-z0-9.-]{1,100}$/.test(args.encounterKey)||
           !Number.isSafeInteger(args.expectedRevision)||args.expectedRevision<1||
           Object.keys(request?.data||{}).some(key=>!["uid","session"].includes(key))){
            fail("invalid-argument","Only an operation, preparation, source revision and supported enemy key are accepted.");
        }
        const requestTime=now();
        if(!Number.isSafeInteger(requestTime)||requestTime<1)fail("internal","Server clock is unavailable.");
        return runProtected(request,async(tx,session)=>{
            const uid=session.uid,{attemptId,operationId,expectedRevision,encounterKey}=args;
            const root=db.collection("serverUsers").doc(uid);
            const proof=await preparations.readPreparation(tx,session,
                {operationId:attemptId,expectedRevision},requestTime);
            const {attempt}=proof;
            const ref=root.collection("battleEncounters").doc(operationId);
            const receiptRef=root.collection("operations").doc(operationId);
            const markerRef=root.collection("battleEncounterAttempts").doc(attemptId);
            const [sealedSnap,receiptSnap,markerSnap,grantSnap,ledgerSnap,accountSnap,envelopeSnap]=
                await Promise.all([tx.get(ref),tx.get(receiptRef),tx.get(markerRef),
                    tx.get(root.collection("grantOperations").doc(operationId)),
                    tx.get(root.collection("ledgerEntries").doc(operationId)),
                    tx.get(root.collection("account").doc("current")),
                    tx.get(db.collection("users").doc(uid).collection("saves").doc("current"))]);
            if(sealedSnap.exists||receiptSnap.exists){
                const sealed=sealedSnap.exists?sealedSnap.data():null;
                const receipt=receiptSnap.exists?receiptSnap.data():null;
                const marker=markerSnap.exists?markerSnap.data():null;
                if(!sealed||!receipt||!marker||grantSnap.exists||ledgerSnap.exists||
                   sealed.schemaVersion!==1||sealed.kind!==KIND||sealed.ownerUid!==uid||
                   sealed.operationId!==operationId||sealed.attemptId!==attemptId||
                   sealed.attemptSha256!==attempt.sha256||sealed.encounterKey!==encounterKey||
                   sealed.characterId!==attempt.characterId||sealed.sourceRevision!==expectedRevision||
                   sealed.snapshotSha256!==attempt.snapshotSha256||sealed.creationSessionId!==session.sessionId||
                   !Number.isSafeInteger(sealed.sealedAtMs)||sealed.sealedAtMs<attempt.issuedAtMs||
                   sealed.sealedAtMs>=attempt.expiresAtMs||sealed.expiresAtMs!==attempt.expiresAtMs||
                   sealed.combatRulesReady!==false||sealed.outcomeVerified!==false||
                   sealed.rewardEligible!==false||sealed.creditedToCharacter!==false||
                   !HASH.test(sealed.policySha256||"")||!HASH.test(sealed.definitionSha256||"")||
                   sealed.sha256!==sealDigest(sealed)||
                   receipt.schemaVersion!==1||receipt.kind!==KIND||receipt.ownerUid!==uid||
                   receipt.operationId!==operationId||receipt.attemptId!==attemptId||
                   receipt.sourceRevision!==expectedRevision||receipt.encounterSha256!==sealed.sha256||
                   receipt.creditedToCharacter!==false||
                   marker.schemaVersion!==1||marker.ownerUid!==uid||marker.attemptId!==attemptId||
                   marker.operationId!==operationId||marker.encounterSha256!==sealed.sha256||
                   [sealed,receipt,marker].some(record=>!hasStamp(record))){
                    fail("data-loss","Encounter seal, receipt or preparation marker is inconsistent.");
                }
                const policySnap=await tx.get(root.collection("battleEncounterPolicies").doc(sealed.policySha256));
                let policy;
                try{policy=inspectPolicy(policySnap.exists?policySnap.data().policy:null);
                    if(policy.sha256!==sealed.policySha256||!hasStamp(policySnap.data())||
                       policySnap.data().ownerUid!==uid||policySnap.data().schemaVersion!==1||
                       !Object.hasOwn(policy.entries,encounterKey)||
                       digest(policy.entries[encounterKey])!==sealed.definitionSha256)throw Error("policy binding");
                }catch(_){fail("data-loss","Original encounter policy is missing or inconsistent.");}
                return result(sealed,true,requestTime);
            }
            if(grantSnap.exists||ledgerSnap.exists)fail("failed-precondition","Operation ID is already used.");
            if(markerSnap.exists)fail("already-exists","Preparation already has an encounter seal.");
            if(proof.result.expired||requestTime<attempt.issuedAtMs){
                fail("failed-precondition","Preparation is expired or outside its server time window.");
            }
            if(accountSnap.data().serverRevision!==expectedRevision||
               envelopeSnap.data().serverRevision!==expectedRevision||
               accountSnap.data().snapshotSha256!==attempt.snapshotSha256){
                fail("aborted","CLOUD_REVISION_CONFLICT");
            }
            let policy;
            try{policy=inspectPolicy(catalog);}catch(_){fail("internal","Server encounter catalog is invalid.");}
            if(!Object.hasOwn(policy.entries,encounterKey))fail("invalid-argument","Unsupported encounter key.");
            const policyRef=root.collection("battleEncounterPolicies").doc(policy.sha256);
            const policySnap=await tx.get(policyRef);
            if(policySnap.exists){
                try{const stored=policySnap.data();
                    if(stored.schemaVersion!==1||stored.ownerUid!==uid||!hasStamp(stored)||
                       inspectPolicy(stored.policy).sha256!==policy.sha256)throw Error("policy record");
                }catch(_){fail("data-loss","Existing encounter policy evidence is inconsistent.");}
            }
            const sealed={schemaVersion:1,kind:KIND,ownerUid:uid,operationId,attemptId,
                attemptSha256:attempt.sha256,characterId:attempt.characterId,sourceRevision:expectedRevision,
                snapshotSha256:attempt.snapshotSha256,creationSessionId:session.sessionId,encounterKey,
                policySha256:policy.sha256,definitionSha256:digest(policy.entries[encounterKey]),
                sealedAtMs:requestTime,expiresAtMs:attempt.expiresAtMs,combatRulesReady:false,
                outcomeVerified:false,rewardEligible:false,creditedToCharacter:false};
            sealed.sha256=sealDigest(sealed);
            const createdAt=FieldValue.serverTimestamp();
            if(!policySnap.exists)tx.create(policyRef,{schemaVersion:1,ownerUid:uid,policy,createdAt});
            tx.create(ref,{...sealed,createdAt});
            tx.create(receiptRef,{schemaVersion:1,kind:KIND,ownerUid:uid,operationId,attemptId,
                sourceRevision:expectedRevision,encounterSha256:sealed.sha256,creditedToCharacter:false,createdAt});
            tx.create(markerRef,{schemaVersion:1,ownerUid:uid,attemptId,operationId,encounterSha256:sealed.sha256,createdAt});
            return result(sealed,false,requestTime);
        });
    }
    function result(sealed,unchanged,time){
        return {operationId:sealed.operationId,attemptId:sealed.attemptId,sourceRevision:sealed.sourceRevision,
            encounterKey:sealed.encounterKey,encounterSha256:sealed.sha256,policySha256:sealed.policySha256,
            definitionSha256:sealed.definitionSha256,expiresAtMs:sealed.expiresAtMs,expired:time>=sealed.expiresAtMs,
            unchanged,combatRulesReady:false,outcomeVerified:false,rewardEligible:false,creditedToCharacter:false};
    }
    return Object.freeze({seal});
}
module.exports={createCanonicalBattleEncounter};
