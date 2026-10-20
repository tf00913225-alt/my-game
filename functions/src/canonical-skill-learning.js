"use strict";

const {createHash}=require("node:crypto");
const {isDeepStrictEqual:same}=require("node:util");
const {getRulesForVersion}=require("./skill-progression-core");
const policy=require("./skill-learning-policy-v1.json");
function freeze(value){if(value&&typeof value==="object"){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
freeze(policy);
const {assembleCanonicalSnapshot,verifyCanonicalSnapshotAgainstSources,claimRecordsDigest}=require("./canonical-snapshot");
const {createRecoveryArchive,inspectRecoveryArchive}=require("./canonical-recovery-archive");
const {source,readCharacterSources,readOwnedSources,advanceOwnedRecords,advanceOwnedSources}=require("./canonical-owned-sources");
const ID=/^[A-Za-z0-9_-]{16,64}(?![\s\S])/;
const KIND="skill-learning";
const POLICY_SHA=createHash("sha256").update(JSON.stringify(policy)).digest("hex");
const catalog=Object.fromEntries(policy.skills.map(row=>[row.id,row]));
const rules=getRulesForVersion(policy.ruleVersion,catalog,policy.skills.filter(row=>row.damageClassification==="direct").map(row=>row.id));
const actions=new Set(["learn","upgrade"]);
function validIntent(value){
    return value&&Object.keys(value).sort().join(",")==="action,characterId,expectedRevision,operationId,skillId"&&
        ID.test(value.operationId||"")&&Number.isSafeInteger(value.expectedRevision)&&value.expectedRevision>=1&&
        typeof value.characterId==="string"&&value.characterId.length>0&&!value.characterId.includes("/")&&
        actions.has(value.action)&&typeof value.skillId==="string"&&Object.hasOwn(catalog,value.skillId);
}
function checkPolicy(receipt,fail){
    if(policy.ruleVersion!=="v1"||policy.schemaVersion!==1||
       (receipt&&(receipt.policyVersion!==policy.policyVersion||receipt.policySha256!==POLICY_SHA))){
        fail("data-loss","Retained skill learning policy is unavailable.");
    }
}
function transition(records,revision,characterId,action,skillId,fail){
    checkPolicy(null,fail);
    if(records.account.provenance!=="server-created")fail("data-loss","Skill learning requires original server-created ownership.");
    const character=records.characters.find(row=>row.characterId===characterId);
    if(!character||!records.account.slots.includes(characterId))fail("invalid-argument","Character target is not owned.");
    const state=character.state,loadout=character.skillLoadout,levels=loadout?.skillLevels;
    if(!state||!Number.isSafeInteger(state.level)||state.level<1||
       !Number.isSafeInteger(state.skillPoints)||state.skillPoints<0||!levels||
       Object.entries(levels).some(([id,level])=>!Object.hasOwn(catalog,id)||
           !Number.isSafeInteger(level)||level<1||level>catalog[id].maxLevel)){
        fail("data-loss","Skill learning sources are invalid or unsupported.");
    }
    const current=levels[skillId]||0,skill=catalog[skillId];
    if(action==="learn"&&current)fail("failed-precondition","Skill is already learned.");
    const eligibility=action==="learn"?rules.getSkillLearnEligibility(state,skill,levels):
        rules.getSkillUpgradeEligibility(state,skill,current);
    if(!eligibility.allowed)fail("failed-precondition","Skill learning eligibility is not satisfied.");
    const cost=action==="learn"?eligibility.learnCost:eligibility.cost;
    if(!Number.isSafeInteger(cost)||cost<1||cost>state.skillPoints)fail("data-loss","Skill point debit is invalid.");
    const levelAfter=action==="learn"?1:eligibility.targetLevel;
    const nextClaimRecords=records.claimRecords.map(row=>({...row,serverRevision:revision}));
    const next={...records,...advanceOwnedRecords(records,revision),
        account:{...records.account,serverRevision:revision},
        characters:records.characters.map(row=>({...row,serverRevision:revision,...(row.characterId===characterId?{
            state:{...row.state,skillPoints:state.skillPoints-cost},
            skillLoadout:{...row.skillLoadout,skillLevels:{...levels,[skillId]:levelAfter}}}:{} )})),
        economy:{...records.economy,serverRevision:revision},
        relicLoadout:{...records.relicLoadout,serverRevision:revision},
        progress:{...records.progress,serverRevision:revision},
        claimCheckpoint:{...records.claimCheckpoint,serverRevision:revision,claimDigest:claimRecordsDigest(nextClaimRecords)}};
    return {next,cost,levelAfter,pointsAfter:state.skillPoints-cost};
}

// Original before/after sources, retained v1 policy and exact transition are the
// sole historical proof. This neither casts skills nor admits client loadouts.
async function verifySkillLearningEvidence({tx,root,uid,operationId,currentRevision,receipt,ledger,grantExists,fail}){
    checkPolicy(receipt,fail);
    const intent={operationId,expectedRevision:receipt?.expectedRevision,characterId:receipt?.characterId,
        action:receipt?.action,skillId:receipt?.skillId};
    const fields="action,allocatedRevision,characterId,cost,createdAt,expectedRevision,kind,levelAfter,operationId,ownerUid,pointsAfter,policySha256,policyVersion,schemaVersion,skillId,snapshotSha256,sourceRevision";
    if(!validIntent(intent)||!receipt||Object.keys(receipt).sort().join(",")!==fields||
       receipt.schemaVersion!==1||receipt.kind!==KIND||receipt.ownerUid!==uid||receipt.operationId!==operationId||
       typeof receipt.createdAt?.toMillis!=="function"||!Number.isFinite(receipt.createdAt.toMillis())||
       !Number.isSafeInteger(receipt.sourceRevision)||receipt.sourceRevision<1||receipt.sourceRevision>receipt.expectedRevision||
       receipt.allocatedRevision!==receipt.expectedRevision+1||receipt.allocatedRevision>currentRevision||
       grantExists||!ledger||!same(ledger,{...receipt,amount:-receipt.cost})){
        fail("data-loss","Skill learning receipt or ledger is inconsistent.");
    }
    const grant=await tx.get(root.collection("grantOperations").doc(operationId));
    if(grant.exists)fail("data-loss","Skill learning has a conflicting grant.");
    const snapshots=[];
    for(const revision of [receipt.sourceRevision,receipt.allocatedRevision]){
        const snapshot=await tx.get(root.collection("playableSnapshots").doc(String(revision)));
        const archive=await tx.get(root.collection("recoveryArchives").doc(String(revision)));
        try{
            if(!snapshot.exists||!archive.exists)throw Error("missing");
            snapshots.push({records:inspectRecoveryArchive(archive.data(),uid,revision,snapshot.data()),snapshot:snapshot.data()});
        }catch(_){fail("data-loss","Original skill learning sources are missing or corrupt.");}
    }
    const reject=()=>fail("data-loss","Original skill learning transition is inconsistent.");
    const derived=transition(snapshots[0].records,receipt.allocatedRevision,receipt.characterId,receipt.action,receipt.skillId,reject);
    if(!same(derived.next,snapshots[1].records)||derived.cost!==receipt.cost||
       derived.levelAfter!==receipt.levelAfter||derived.pointsAfter!==receipt.pointsAfter||
       snapshots[1].snapshot.sha256!==receipt.snapshotSha256)reject();
}

function createCanonicalSkillLearning({db,FieldValue,HttpsError,runProtected,inspectExistingEnvelope,nextRevision}){
    const fail=(code,message)=>{throw new HttpsError(code,message);};
    async function learnOrUpgrade(request,intent){
        if(!validIntent(intent))fail("invalid-argument","A bounded skill learning intent is required.");
        const {operationId,expectedRevision,characterId,action,skillId}=intent;
        return runProtected(request,async(tx,session)=>{
            const uid=session.uid,root=db.collection("serverUsers").doc(uid);
            const envelopeRef=db.collection("users").doc(uid).collection("saves").doc("current");
            const envelopeSnap=await tx.get(envelopeRef);
            if(!envelopeSnap.exists)fail("failed-precondition","Canonical envelope is required.");
            const envelope=inspectExistingEnvelope(envelopeSnap.data(),uid);
            if(envelope.kind!=="current"||envelope.data.authoritativeStateReady!==false)fail("failed-precondition","Canonical envelope is not eligible.");
            const operationRef=root.collection("operations").doc(operationId),ledgerRef=root.collection("ledgerEntries").doc(operationId);
            const operation=await tx.get(operationRef),ledger=await tx.get(ledgerRef),grant=await tx.get(root.collection("grantOperations").doc(operationId));
            if(operation.exists){
                const receipt=operation.data();
                if(receipt.characterId!==characterId||receipt.skillId!==skillId||receipt.action!==action||receipt.expectedRevision!==expectedRevision)
                    fail("failed-precondition","Operation intent differs from its receipt.");
                await verifySkillLearningEvidence({tx,root,uid,operationId,currentRevision:envelope.serverRevision,
                    receipt,ledger:ledger.data(),grantExists:grant.exists,fail});
                return result(receipt,true);
            }
            if(ledger.exists||grant.exists)fail("failed-precondition","Operation ID is already used.");
            if(envelope.serverRevision!==expectedRevision)fail("aborted","CLOUD_REVISION_CONFLICT");
            const names=["account","economy","relicLoadout","progress","claimCheckpoints"];
            const refs=names.map(name=>root.collection(name).doc("current")),singles=[];
            for(const ref of refs){const row=await tx.get(ref);if(!row.exists)fail("data-loss","Complete canonical sources are required.");singles.push(row);}
            const account=singles[0].data(),previous=account.serverRevision;
            if(account.ownerUid!==uid||account.provenance!=="server-created"||!Number.isSafeInteger(previous)||previous<1||previous>expectedRevision)
                fail("data-loss","Canonical skill source revision is invalid.");
            const characters=await readCharacterSources(tx,root,account,fail);
            if(!account.slots.includes(characterId))fail("invalid-argument","Character target is not owned.");
            const prior=await tx.get(root.collection("playableSnapshots").doc(String(previous)));
            const archived=await tx.get(root.collection("recoveryArchives").doc(String(previous)));
            const owned=await readOwnedSources(tx,root,fail,{accountSnapshot:singles[0],currentSnapshot:prior});
            const records={account:source(account),characters:characters.records,...owned.records,
                economy:source(singles[1].data()),relicLoadout:source(singles[2].data()),progress:source(singles[3].data()),claimCheckpoint:source(singles[4].data())};
            try{
                if(!prior.exists||!archived.exists||prior.get("sha256")!==account.snapshotSha256)throw Error("missing");
                verifyCanonicalSnapshotAgainstSources(prior.data(),uid,previous,records);
                if(!same(inspectRecoveryArchive(archived.data(),uid,previous,prior.data()),records))throw Error("different");
            }catch(_){fail("data-loss","Current skill learning sources differ from their archive.");}
            const revision=nextRevision(envelope),derived=transition(records,revision,characterId,action,skillId,fail);
            const bundle=assembleCanonicalSnapshot(uid,revision,derived.next);
            const archive=createRecoveryArchive(uid,revision,derived.next,bundle),stamp=FieldValue.serverTimestamp();
            refs.forEach((ref,index)=>tx.update(ref,{serverRevision:revision,updatedAt:stamp,
                ...(index===0?{snapshotSha256:bundle.sha256}:{}),...(index===4?{claimDigest:derived.next.claimCheckpoint.claimDigest}:{})}));
            characters.refs.forEach((ref,index)=>tx.update(ref,{serverRevision:revision,updatedAt:stamp,
                ...(characters.records[index].characterId===characterId?{state:derived.next.characters[index].state,skillLoadout:derived.next.characters[index].skillLoadout}:{})}));
            advanceOwnedSources(tx,owned.refs,revision,stamp);
            tx.create(root.collection("playableSnapshots").doc(String(revision)),{...bundle,createdAt:stamp});
            tx.create(root.collection("recoveryArchives").doc(String(revision)),{...archive,createdAt:stamp});
            const receipt={schemaVersion:1,kind:KIND,ownerUid:uid,operationId,expectedRevision,sourceRevision:previous,
                allocatedRevision:revision,characterId,action,skillId,cost:derived.cost,levelAfter:derived.levelAfter,
                pointsAfter:derived.pointsAfter,policyVersion:policy.policyVersion,policySha256:POLICY_SHA,snapshotSha256:bundle.sha256,createdAt:stamp};
            tx.create(operationRef,receipt);tx.create(ledgerRef,{...receipt,amount:-derived.cost});
            tx.update(envelopeRef,{serverRevision:revision,updatedAt:stamp});
            return result(receipt,false);
        });
    }
    return Object.freeze({learnOrUpgrade});
}
function result(receipt,unchanged){return {allocatedRevision:receipt.allocatedRevision,characterId:receipt.characterId,
    skillId:receipt.skillId,action:receipt.action,levelAfter:receipt.levelAfter,pointsAfter:receipt.pointsAfter,
    unchanged,outcomeVerified:false,rewardEligible:false,readyForRestore:false,authoritativeStateReady:false};}
module.exports={createCanonicalSkillLearning,verifySkillLearningEvidence,skillLearningEvidenceReadBudget:()=>5};
