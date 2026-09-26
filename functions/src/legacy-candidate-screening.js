"use strict";

// A read-only gate over a private, client-supplied candidate. This is not an
// approval operation: main-save fields cannot prove historical reward claims
// or reconstruct the claim-bearing sidecars needed for a playable snapshot.
const ELEMENTS=new Set(["fire","water","wind","earth"]);
const CHARACTER_KEYS=["player","player2","player3"];
const CLAIM_FIELDS=["dailyQuestState","commissionQuestState","achievementState","gameplayProgress","abyssProgress"];
const EQUIPMENT_SLOT_BY_TYPE=Object.freeze({
    weapon:"hand",hand:"hand",helmet:"head",head:"head",shoulder:"shoulder",
    armor:"armor",shoes:"shoes",accessory:"ring",ring:"ring"
});
const EQUIPMENT_SLOT_BY_KEY=Object.freeze({
    head:"head",helmet:"head",hand:"hand",weapon:"hand",shoulder:"shoulder",
    armor:"armor",shoes:"shoes",ring:"ring",accessory:"ring"
});
const {auditLegacyRewardClaims}=require("./legacy-reward-claim-audit.js");

function auditLegacyEquipment(save,blockers){
    const seenUids=new Set();
    const recordUid=item=>{
        if(!item||typeof item!=="object"||Array.isArray(item)){ return; }
        if(item.v141Uid===undefined||item.v141Uid===null){ return; }
        if(typeof item.v141Uid!=="string"||!item.v141Uid.trim()){
            blockers.add("EQUIPMENT_IDENTITY_INVALID");
        }else if(seenUids.has(item.v141Uid)){
            blockers.add("EQUIPMENT_IDENTITY_DUPLICATE");
        }else{ seenUids.add(item.v141Uid); }
    };
    if(Array.isArray(save.inventoryItems)){
        save.inventoryItems.forEach(item=>{
            if(item&&EQUIPMENT_SLOT_BY_TYPE[item.type]&&item.count!==1){
                blockers.add("EQUIPMENT_STRUCTURE_INVALID");
            }
            if(item&&(EQUIPMENT_SLOT_BY_TYPE[item.type]||item.v141Uid!=null)){ recordUid(item); }
        });
    }
    const equipment=save.characterEquipment;
    if(!equipment||typeof equipment!=="object"||Array.isArray(equipment)){ return; }
    for(const [owner,slots] of Object.entries(equipment)){
        if(!slots||typeof slots!=="object"||Array.isArray(slots)){
            blockers.add("EQUIPMENT_STRUCTURE_INVALID");
            continue;
        }
        const occupiedSlots=new Set();
        for(const [slot,item] of Object.entries(slots)){
            if(item===null){ continue; }
            const canonicalSlot=EQUIPMENT_SLOT_BY_KEY[slot];
            if(!canonicalSlot||occupiedSlots.has(canonicalSlot)||
               !item||typeof item!=="object"||Array.isArray(item)||
               typeof item.id!=="string"||!item.id.trim()||
               EQUIPMENT_SLOT_BY_TYPE[item.type]!==canonicalSlot||item.count!==1){
                blockers.add("EQUIPMENT_STRUCTURE_INVALID");
                continue;
            }
            occupiedSlots.add(canonicalSlot);
            // The runtime removes equipped objects from inventoryItems. Audit
            // their identities across both locations, not a bag reference.
            recordUid(item);
            if(owner!=="fire"&&(owner!=="player2"||save.player2==null)&&
               (owner!=="player3"||save.player3==null)){
                blockers.add("EQUIPMENT_OWNER_UNMAPPED");
            }
        }
    }
}

function screenLegacyCandidateSnapshot(save,sidecars=null){
    const blockers=new Set();
    const characters=CHARACTER_KEYS.map(key=>save[key]).filter(value=>value!==null&&value!==undefined);
    const ids=new Set();
    // One or two characters are legitimate; slot 3 cannot precede slot 2.
    if(save.player3!=null&&save.player2==null){ blockers.add("CHARACTER_SLOT_GAP"); }
    for(const character of characters){
        if(!character||typeof character!=="object"||Array.isArray(character)){
            blockers.add("CHARACTER_STRUCTURE_INVALID");
            continue;
        }
        if(ids.has(character.id)){ blockers.add("DUPLICATE_CHARACTER_ID"); }
        ids.add(character.id);
        if(!ELEMENTS.has(character.element)){ blockers.add("CHARACTER_ELEMENT_INVALID"); }
        for(const field of ["exp","skillPoints"]){
            if(!Number.isSafeInteger(character[field])||character[field]<0){
                blockers.add("CHARACTER_PROGRESSION_UNVERIFIED");
            }
        }
    }
    if(!Array.isArray(save.inventoryItems)||
       save.inventoryItems.some(item=>!item||typeof item!=="object"||Array.isArray(item)||
           typeof item.id!=="string"||!item.id.trim()||
           !Number.isSafeInteger(item.count)||item.count<1)){
        blockers.add("INVENTORY_STRUCTURE_INVALID");
    }
    if(!save.characterEquipment||typeof save.characterEquipment!=="object"||
       Array.isArray(save.characterEquipment)){
        blockers.add("EQUIPMENT_STRUCTURE_INVALID");
    }
    auditLegacyEquipment(save,blockers);
    for(const field of CLAIM_FIELDS){
        if(!save[field]||typeof save[field]!=="object"){
            blockers.add("CLAIM_PROGRESS_MISSING");
        }
    }
    const rewardAudit=auditLegacyRewardClaims(save);
    rewardAudit.blockers.forEach(blocker=>blockers.add(blocker));
    const claimSidecars=["daily-dungeon-state","progress","quest-milestones",
        "task-tracker","legacy-abyss-state","equipment-shop-daily",
        "equipment-shop-purchases","abyss-state"];
    if(!sidecars||claimSidecars.some(key=>sidecars[key]?.status!=="present")){
        blockers.add("SIDECAR_BACKUP_MISSING");
    }
    return Object.freeze({
        status:"blocked",readyForAcceptance:false,
        characterCount:characters.length,
        historicalRewardClaims:rewardAudit,
        blockers:Object.freeze([...blockers].sort())
    });
}

function createLegacyCandidateScreening({db,HttpsError,runProtected,inspectExistingEnvelope,validateLegacySaveCandidate,validateMigrationBackup}){
    const fail=(code,message)=>{ throw new HttpsError(code,message); };
    async function screen(request){
        const data=request.data||{};
        const keys=Object.keys(data).filter(key=>key!=="uid"&&key!=="session").sort();
        const {candidateRevision,expectedRevision}=data;
        if(keys.join(",")!=="candidateRevision,expectedRevision"||
           !Number.isSafeInteger(candidateRevision)||candidateRevision<1||
           !Number.isSafeInteger(expectedRevision)||expectedRevision<1){
            fail("invalid-argument","Candidate screening requires exact revisions.");
        }
        return runProtected(request,async(transaction,session)=>{
            const uid=session.uid;
            const privateRef=db.collection("serverUsers").doc(uid);
            const saveRef=db.collection("users").doc(uid).collection("saves").doc("current");
            const candidateRef=privateRef.collection("migrationCandidates").doc(String(candidateRevision));
            const [saveRecord,candidateRecord]=await Promise.all([
                transaction.get(saveRef),transaction.get(candidateRef)
            ]);
            if(!saveRecord.exists||!candidateRecord.exists){
                fail("failed-precondition","The requested candidate or envelope is missing.");
            }
            const envelope=inspectExistingEnvelope(saveRecord.data(),uid);
            if(envelope.kind!=="current"||envelope.data.authoritativeStateReady!==false){
                fail("failed-precondition","Screening only supports an unadmitted envelope.");
            }
            if(envelope.serverRevision!==expectedRevision){
                throw new HttpsError("aborted","CLOUD_REVISION_CONFLICT",{code:"CLOUD_REVISION_CONFLICT"});
            }
            if(envelope.data.migrationCandidateRevision!==candidateRevision){
                fail("failed-precondition","Only the current candidate can be screened.");
            }
            const record=candidateRecord.data();
            if(envelope.data.migrationCandidateFingerprint!==record.fingerprint||
               record.ownerUid!==uid||record.revision!==candidateRevision||
               record.trusted!==false||record.trustLevel!=="client-migration-candidate"||
               record.reviewStatus!=="pending_server_validation"){
                fail("data-loss","Candidate provenance is inconsistent.");
            }
            let candidate;
            try{ candidate=validateLegacySaveCandidate(record.snapshot); }
            catch(_){ fail("data-loss","Stored candidate has an invalid structure."); }
            if(candidate.fingerprint!==record.fingerprint||
               candidate.byteLength!==record.byteLength||
               candidate.gameSaveVersion!==record.gameSaveVersion){
                fail("data-loss","Candidate content differs from its submitted fingerprint.");
            }
            if(record.backup){
                let checked;
                try{ checked=validateMigrationBackup(record.backup,uid); }
                catch(_){ fail("data-loss","Stored backup differs from its immutable bytes or manifest."); }
                if(checked.backupSha256!==record.backupSha256||
                   checked.backupId!==record.backupId||
                   checked.fingerprint!==candidate.fingerprint||
                   checked.mainRaw!==record.backup.mainRaw){
                    fail("data-loss","Candidate and backup are inconsistent.");
                }
            }
            return {
                candidateRevision,serverRevision:envelope.serverRevision,
                fingerprint:candidate.fingerprint,
                ...screenLegacyCandidateSnapshot(candidate.snapshot,record.backup?.sidecars)
            };
        });
    }
    return Object.freeze({screen});
}

module.exports={createLegacyCandidateScreening,screenLegacyCandidateSnapshot};
