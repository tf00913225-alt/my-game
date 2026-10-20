"use strict";

const {createHash}=require("node:crypto");
const {isDeepStrictEqual:same}=require("node:util");
const {getLoadoutRulesForVersion}=require("./skill-progression-core");
const policy=require("./skill-loadout-policy-v1.json"),learning=require("./skill-learning-policy-v1.json");
const {assembleCanonicalSnapshot,assembleCanonicalPlayableProjection,verifyCanonicalSnapshotAgainstSources,claimRecordsDigest}=require("./canonical-snapshot");
const {createRecoveryArchive,inspectRecoveryArchive}=require("./canonical-recovery-archive");
const {source,readCharacterSources,readOwnedSources,advanceOwnedRecords,advanceOwnedSources}=require("./canonical-owned-sources");
const {classifyRetainedCanonicalOperation}=require("./canonical-operation-classifier");
function freeze(value){if(value&&typeof value==="object"){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
freeze(policy);freeze(learning);
const KIND="skill-loadout",ID=/^[A-Za-z0-9_-]{16,64}(?![\s\S])/;
const POLICY_SHA=createHash("sha256").update(JSON.stringify(policy)).digest("hex");
const catalog=Object.fromEntries(learning.skills.map(row=>[row.id,row]));
const rules=getLoadoutRulesForVersion(policy.ruleVersion,catalog);
const configKeys=["autoConfig","autoConfig2","autoConfig3"];
function validIntent(value){
    return value&&Object.keys(value).sort().join(",")==="action,characterId,expectedRevision,operationId,skillId"&&
        typeof value.operationId==="string"&&ID.test(value.operationId)&&Number.isSafeInteger(value.expectedRevision)&&value.expectedRevision>=1&&
        typeof value.characterId==="string"&&value.characterId.length>0&&!value.characterId.includes("/")&&
        ["equip","remove","select-auto-action"].includes(value.action)&&typeof value.skillId==="string"&&
        (Object.hasOwn(catalog,value.skillId)||value.action==="select-auto-action"&&["normal","defend"].includes(value.skillId));
}
function transition(records,revision,characterId,action,skillId,operationId,fail){
    if(policy.schemaVersion!==1||policy.ruleVersion!=="v1"||policy.policyVersion!=="player-skill-loadout-v1"||
       records.account.provenance!=="server-created"||!records.progress.playableState)
        fail("data-loss","Original skill loadout policy or sources are unavailable.");
    // This validates stored fields without migration, normalization or defaults.
    try{assembleCanonicalPlayableProjection(records.account.ownerUid,records.account.serverRevision,records);}
    catch(_){fail("data-loss","Canonical skill loadout sources are incomplete or invalid.");}
    for(const character of records.characters){
        const loadout=character.skillLoadout;
        if(Object.entries(loadout.skillLevels).some(([id,level])=>!Object.hasOwn(catalog,id)||level>catalog[id].maxLevel)||
           loadout.equippedSkills.filter(id=>catalog[id].element!==character.element).length>1)
            fail("data-loss","Canonical skill ownership or cross-element loadout is unsupported.");
    }
    const character=records.characters.find(row=>row.characterId===characterId),slot=records.account.slots.indexOf(characterId);
    if(!character||slot<0)fail("invalid-argument","Character target is not owned.");
    let equipped=character.skillLoadout.equippedSkills;
    const playable=records.progress.playableState,preferences={...playable};
    if(action==="equip"){
        const decision=rules.equipSkill(character.state,character.skillLoadout,skillId);
        if(decision.status!=="equipped")fail("failed-precondition","Skill equip intent does not change a legal loadout.");
        equipped=decision.equippedSkills;
    }else if(action==="remove"){
        const index=equipped.indexOf(skillId);
        if(index<0)fail("failed-precondition","Skill is not equipped.");
        equipped=rules.removeEquippedSkill(equipped,index);
    }else{
        if(!["normal","defend"].includes(skillId)&&!rules.isEquippedAndLearnedAutoSkill(character.skillLoadout,skillId))
            fail("failed-precondition","Auto action requires an equipped learned supported skill.");
        const config=rules.rememberExplicitAction(playable[configKeys[slot]],skillId);
        if(same(config,playable[configKeys[slot]]))fail("failed-precondition","Auto action is already explicit.");
        preferences[configKeys[slot]]=config;
    }
    const nextCharacters=records.characters.map(row=>({...row,serverRevision:revision,
        ...(row.characterId===characterId?{skillLoadout:{...row.skillLoadout,equippedSkills:equipped}}:{})}));
    if(action!=="select-auto-action"){
        for(const index of [0,1]){
            const actor=nextCharacters.find(row=>row.slotIndex===index);if(!actor)continue;
            const config=index===0?rules.syncPrimaryAction(playable[configKeys[index]],actor.skillLoadout):playable[configKeys[index]];
            preferences[configKeys[index]]=rules.restoreSkillAfterLegacySync(config,actor.skillLoadout).config;
        }
    }
    // Explicit version conversion preserves every absent v136 field. Never
    // execute the Client's boot migration to reconstruct missing history.
    preferences.preferencesVersion=2;
    preferences.loadoutSource={operationId,resultRevision:revision,policySha256:POLICY_SHA};
    const nextClaims=records.claimRecords.map(row=>({...row,serverRevision:revision}));
    return {...records,...advanceOwnedRecords(records,revision),
        account:{...records.account,serverRevision:revision},characters:nextCharacters,
        economy:{...records.economy,serverRevision:revision},relicLoadout:{...records.relicLoadout,serverRevision:revision},
        progress:{...records.progress,serverRevision:revision,playableState:preferences},
        claimCheckpoint:{...records.claimCheckpoint,serverRevision:revision,claimDigest:claimRecordsDigest(nextClaims)}};
}

// Non-economic proof: the operation, both originals and both economic absences
// must survive. No zero ledger/grant is manufactured to resemble learning.
async function verifySkillLoadoutEvidence({tx,root,uid,operationId,currentRevision,receipt,fail}){
    const fields="action,characterId,createdAt,expectedRevision,kind,operationId,ownerUid,policySha256,policyVersion,previousLoadoutSource,resultRevision,schemaVersion,skillId,snapshotSha256,sourceRevision";
    if(!receipt||Object.keys(receipt).sort().join(",")!==fields||receipt.schemaVersion!==1||receipt.kind!==KIND||
       receipt.ownerUid!==uid||receipt.operationId!==operationId||!validIntent({operationId,expectedRevision:receipt.expectedRevision,
           characterId:receipt.characterId,action:receipt.action,skillId:receipt.skillId})||
       receipt.policyVersion!==policy.policyVersion||receipt.policySha256!==POLICY_SHA||
       !Number.isSafeInteger(receipt.sourceRevision)||receipt.sourceRevision<1||receipt.sourceRevision>receipt.expectedRevision||
       receipt.resultRevision!==receipt.expectedRevision+1||receipt.resultRevision>currentRevision||
       typeof receipt.createdAt?.toMillis!=="function"||!Number.isFinite(receipt.createdAt.toMillis()))
        fail("data-loss","Retained skill loadout receipt is inconsistent.");
    for(const namespace of ["ledgerEntries","grantOperations"]){
        if((await tx.get(root.collection(namespace).doc(operationId))).exists)
            fail("data-loss","Skill loadout overlaps economic evidence.");
    }
    const originals=[];
    for(const revision of [receipt.sourceRevision,receipt.resultRevision]){
        const snapshot=await tx.get(root.collection("playableSnapshots").doc(String(revision)));
        const archive=await tx.get(root.collection("recoveryArchives").doc(String(revision)));
        try{
            if(!snapshot.exists||!archive.exists)throw Error("missing");
            originals.push({records:inspectRecoveryArchive(archive.data(),uid,revision,snapshot.data()),snapshot:snapshot.data()});
        }catch(_){fail("data-loss","Original skill loadout evidence is missing or corrupt.");}
    }
    const reject=()=>fail("data-loss","Original skill loadout transition differs.");
    const previous=originals[0].records.progress.playableState.loadoutSource??null;
    if(!same(previous,receipt.previousLoadoutSource))reject();
    const next=transition(originals[0].records,receipt.resultRevision,receipt.characterId,receipt.action,receipt.skillId,operationId,reject);
    if(!same(next,originals[1].records)||originals[1].snapshot.sha256!==receipt.snapshotSha256)reject();
    return Object.freeze({operationId,resultRevision:receipt.resultRevision,policySha256:receipt.policySha256,
        previousOperationId:previous?.operationId??null,previousResultRevision:previous?.resultRevision??null,
        previousPolicySha256:previous?.policySha256??null});
}

function createCanonicalSkillLoadout({db,FieldValue,HttpsError,runProtected,inspectExistingEnvelope,nextRevision}){
    const fail=(code,message)=>{throw new HttpsError(code,message);};
    // Shared current-source validation only. First-write history admission stays
    // in the mutation, and a configuration read creates no history/absence right.
    async function readCurrentContext(tx,root,uid,envelope,expectedRevision,characterId){
        if(envelope.serverRevision!==expectedRevision)fail("aborted","CLOUD_REVISION_CONFLICT");
        const names=["account","economy","relicLoadout","progress","claimCheckpoints"],refs=names.map(name=>root.collection(name).doc("current")),singles=[];
        for(const ref of refs){const snapshot=await tx.get(ref);if(!snapshot.exists)fail("data-loss","Complete canonical sources are required.");singles.push(snapshot);}
        const account=singles[0].data(),previous=account.serverRevision;
        if(account.ownerUid!==uid||account.provenance!=="server-created"||!Number.isSafeInteger(previous)||previous<1||previous>expectedRevision)
            fail("data-loss","Canonical skill loadout revision is invalid.");
        const characters=await readCharacterSources(tx,root,account,fail);
        if(characterId!==undefined&&!account.slots.includes(characterId))fail("invalid-argument","Character target is not owned.");
        const prior=await tx.get(root.collection("playableSnapshots").doc(String(previous)));
        const archived=await tx.get(root.collection("recoveryArchives").doc(String(previous)));
        const owned=await readOwnedSources(tx,root,fail,{accountSnapshot:singles[0],currentSnapshot:prior});
        const records={account:source(account),characters:characters.records,...owned.records,economy:source(singles[1].data()),
            relicLoadout:source(singles[2].data()),progress:source(singles[3].data()),claimCheckpoint:source(singles[4].data())};
        try{
            if(!prior.exists||!archived.exists||prior.get("sha256")!==account.snapshotSha256)throw Error("missing");
            verifyCanonicalSnapshotAgainstSources(prior.data(),uid,previous,records);
            if(!same(inspectRecoveryArchive(archived.data(),uid,previous,prior.data()),records))throw Error("different");
        }catch(_){fail("data-loss","Current skill loadout sources differ from their archive.");}
        if(!records.progress.playableState)fail("data-loss","Complete playable skill sources are required.");
        return {records,refs,characters,owned,previous};
    }
    async function readLoadout(request,intent){
        if(!intent||Object.keys(intent).join(",")!=="expectedRevision"||!Number.isSafeInteger(intent.expectedRevision)||intent.expectedRevision<1)
            fail("invalid-argument","An expected revision is required for the configuration read.");
        const expectedRevision=intent.expectedRevision;
        return runProtected(request,async(tx,session)=>{
            const uid=session.uid,root=db.collection("serverUsers").doc(uid),snapshot=await tx.get(db.doc(`users/${uid}/saves/current`));
            if(!snapshot.exists)fail("failed-precondition","Canonical envelope is required.");
            const envelope=inspectExistingEnvelope(snapshot.data(),uid);
            if(envelope.kind!=="current"||envelope.data.authoritativeStateReady!==false)fail("failed-precondition","Canonical envelope is not eligible.");
            const {records,previous}=await readCurrentContext(tx,root,uid,envelope,expectedRevision);
            const head=records.progress.playableState.loadoutSource;
            if(head){
                const operation=await tx.get(root.collection("operations").doc(head.operationId));
                if(!operation.exists)fail("data-loss","Current skill loadout source receipt is missing.");
                const edge=await verifySkillLoadoutEvidence({tx,root,uid,operationId:head.operationId,currentRevision:expectedRevision,receipt:operation.data(),fail});
                if(edge.resultRevision!==head.resultRevision||edge.policySha256!==head.policySha256)
                    fail("data-loss","Current skill loadout source binding differs.");
            }
            const projection=assembleCanonicalPlayableProjection(uid,previous,records).projection.gameSave,state=records.progress.playableState;
            return {schemaVersion:1,ownerUid:uid,serverRevision:envelope.serverRevision,canonicalRevision:previous,
                preferencesVersion:Object.hasOwn(state,"preferencesVersion")?state.preferencesVersion:1,
                characters:records.characters.map(character=>({characterId:character.characterId,slotIndex:character.slotIndex,
                    skillLoadout:projection.characterSkillLoadouts[["fire","player2","player3"][character.slotIndex]]})),
                autoConfig:projection.autoConfig,autoConfig2:projection.autoConfig2,autoConfig3:projection.autoConfig3,
                outcomeVerified:false,rewardEligible:false,readyForRestore:false,authoritativeStateReady:false};
        });
    }
    async function mutateLoadout(request,intent){
        if(!validIntent(intent))fail("invalid-argument","A bounded skill loadout intent is required.");
        const {operationId,expectedRevision,characterId,action,skillId}=intent;
        return runProtected(request,async(tx,session)=>{
            const uid=session.uid,root=db.collection("serverUsers").doc(uid),envelopeRef=db.doc(`users/${uid}/saves/current`);
            const envelopeSnap=await tx.get(envelopeRef);
            if(!envelopeSnap.exists)fail("failed-precondition","Canonical envelope is required.");
            const envelope=inspectExistingEnvelope(envelopeSnap.data(),uid);
            if(envelope.kind!=="current"||envelope.data.authoritativeStateReady!==false)fail("failed-precondition","Canonical envelope is not eligible.");
            const operationRef=root.collection("operations").doc(operationId),operation=await tx.get(operationRef);
            if(operation.exists){
                const receipt=operation.data();
                if(receipt.characterId!==characterId||receipt.skillId!==skillId||receipt.action!==action||receipt.expectedRevision!==expectedRevision)
                    fail("failed-precondition","Operation intent differs from its receipt.");
                await verifySkillLoadoutEvidence({tx,root,uid,operationId,currentRevision:envelope.serverRevision,receipt,fail});
                return result(receipt,true);
            }
            for(const namespace of ["ledgerEntries","grantOperations"]){
                if((await tx.get(root.collection(namespace).doc(operationId))).exists)fail("failed-precondition","Operation ID is already used.");
            }
            const {records,refs,characters,owned,previous}=await readCurrentContext(tx,root,uid,envelope,expectedRevision,characterId);
            if(!Object.hasOwn(records.progress.playableState,"loadoutSource")){
                // First admission is explicitly finite. This proves only that
                // complete known operation headers contain no previous loadout;
                // it is not a full economic proof or total-read400 contract.
                const history=await tx.get(root.collection("operations").orderBy("__name__").limit(401));
                if(history.size>400)fail("failed-precondition","First loadout operation inventory exceeds its admission budget.");
                for(const row of history.docs){
                    if(classifyRetainedCanonicalOperation(row.data(),row.id,uid,expectedRevision,fail)==="loadout")
                        fail("data-loss","A retained loadout operation is missing its current source binding.");
                }
            }else{
                const head=records.progress.playableState.loadoutSource;
                const retained=await tx.get(root.collection("operations").doc(head.operationId));
                if(!retained.exists)fail("data-loss","Current skill loadout source receipt is missing.");
                const edge=await verifySkillLoadoutEvidence({tx,root,uid,operationId:head.operationId,currentRevision:expectedRevision,receipt:retained.data(),fail});
                if(edge.resultRevision!==head.resultRevision||edge.policySha256!==head.policySha256)
                    fail("data-loss","Current skill loadout source binding differs.");
            }
            const revision=nextRevision(envelope),next=transition(records,revision,characterId,action,skillId,operationId,fail);
            const bundle=assembleCanonicalSnapshot(uid,revision,next),archive=createRecoveryArchive(uid,revision,next,bundle),stamp=FieldValue.serverTimestamp();
            refs.forEach((ref,index)=>tx.update(ref,{serverRevision:revision,updatedAt:stamp,...(index===0?{snapshotSha256:bundle.sha256}:{}),
                ...(index===3?{playableState:next.progress.playableState}:{}),...(index===4?{claimDigest:next.claimCheckpoint.claimDigest}:{})}));
            characters.refs.forEach((ref,index)=>tx.update(ref,{serverRevision:revision,updatedAt:stamp,skillLoadout:next.characters[index].skillLoadout}));
            advanceOwnedSources(tx,owned.refs,revision,stamp);
            tx.create(root.collection("playableSnapshots").doc(String(revision)),{...bundle,createdAt:stamp});
            tx.create(root.collection("recoveryArchives").doc(String(revision)),{...archive,createdAt:stamp});
            const receipt={schemaVersion:1,kind:KIND,ownerUid:uid,operationId,expectedRevision,sourceRevision:previous,resultRevision:revision,
                characterId,action,skillId,policyVersion:policy.policyVersion,policySha256:POLICY_SHA,snapshotSha256:bundle.sha256,createdAt:stamp};
            receipt.previousLoadoutSource=records.progress.playableState.loadoutSource??null;
            tx.create(operationRef,receipt);tx.update(envelopeRef,{serverRevision:revision,updatedAt:stamp});
            return result(receipt,false);
        });
    }
    return Object.freeze({mutateLoadout,readLoadout});
}
function result(receipt,unchanged){return {operationId:receipt.operationId,resultRevision:receipt.resultRevision,characterId:receipt.characterId,
    action:receipt.action,skillId:receipt.skillId,unchanged,outcomeVerified:false,rewardEligible:false,readyForRestore:false,authoritativeStateReady:false};}
module.exports={createCanonicalSkillLoadout,verifySkillLoadoutEvidence,skillLoadoutEvidenceReadBudget:()=>6};
