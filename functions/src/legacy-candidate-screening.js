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
const ALLY_SLOTS=new Set(["ALLY_F1","ALLY_F2","ALLY_F3","ALLY_B1","ALLY_B2","ALLY_B3"]);
const CLAIM_SIDECARS=["daily-dungeon-state","progress","quest-milestones",
    "task-tracker","legacy-abyss-state","equipment-shop-daily",
    "equipment-shop-purchases","abyss-state"];
const {auditLegacyRewardClaims}=require("./legacy-reward-claim-audit.js");
const {buildCanonicalCharacterReviewPlan}=require("./canonical-character-review-plan.js");
const {LEGACY_BACKUP_SIDECARS}=require("./cloud-save-policy.js");
const RETAINED_MAIN_FIELDS=["version","bestiaryData","lastSaveTimestamp",
    "selectedCreationElement","autoConfig","autoConfig2","autoConfig3"];

// An internal, read-only translation of the exact legacy sources. References
// here are source paths, never server-owned item or character identifiers.
// Callers must keep the historical claim gate blocked and must not persist or
// send this draft to a client as a playable character.
function prepareLegacyCharacterDraft(save,sidecars,screening=null){
    const review=screening||screenLegacyCandidateSnapshot(save,sidecars);
    if(review.blockers.some(code=>!["HISTORICAL_REWARDS_UNVERIFIED",
        "SIDECAR_BACKUP_MISSING","SIDECAR_CLAIM_RECORD_INVALID"].includes(code))||
       !sidecars||Object.keys(sidecars).sort().join("|")!==LEGACY_BACKUP_SIDECARS.join("|")||
       LEGACY_BACKUP_SIDECARS.some(key=>{
           const entry=sidecars[key];
           return !entry||!(entry.status==="present"&&typeof entry.raw==="string"||
               entry.status==="missing"&&entry.raw===null);
       })){
        return null;
    }
    const copy=value=>JSON.parse(JSON.stringify(value));
    const slots=CHARACTER_KEYS.map(key=>save[key]==null?null:copy(save[key]));
    const inventory=save.inventoryItems.map((item,index)=>({
        source:`inventoryItems[${index}]`,item:copy(item)
    }));
    const equipment=[];
    for(const [owner,items] of Object.entries(save.characterEquipment)){
        const slotIndex={fire:0,player2:1,player3:2}[owner];
        for(const [key,item] of Object.entries(items)){
            if(item!=null){ equipment.push({slotIndex,slot:EQUIPMENT_SLOT_BY_KEY[key],
                source:`characterEquipment.${owner}.${key}`,item:copy(item)}); }
        }
    }
    const retainedMainFields=Object.fromEntries(RETAINED_MAIN_FIELDS.map(key=>[key,
        Object.prototype.hasOwnProperty.call(save,key)
            ? {status:"present",value:copy(save[key])}:{status:"missing"}]));
    // Keep the exact raw source and its missing marker. A missing purchase or
    // claim record is unresolved history, never a claimable default.
    const retainedSidecars=Object.fromEntries(LEGACY_BACKUP_SIDECARS.map(key=>[
        key,{status:sidecars[key].status,raw:sidecars[key].raw}
    ]));
    return {
        source:"untrusted-legacy-review-only",slots,
        economy:{gold:save.gold,sharedExp:save.sharedExp},
        inventory,equipment,
        skills:copy(save.characterSkillLoadouts),
        relics:copy(save.playerRelics),relicLoadout:copy(save.teamLoadout),
        formation:save.allyFormation==null?null:copy(save.allyFormation),
        progress:Object.fromEntries(CLAIM_FIELDS.map(key=>[key,copy(save[key])])),
        retainedMainFields,retainedSidecars,
        historicalRewardClaims:review.historicalRewardClaims,
        claimHistoryBlocked:true
    };
}

function auditLegacyFormation(save,blockers){
    const formation=save.allyFormation;
    // Older saves may predate formation persistence. A missing formation is
    // not evidence of reward eligibility and never supplies a canonical ID.
    if(formation===undefined||formation===null){ return; }
    const map=formation.characterIndexToSlot;
    if(!formation||typeof formation!=="object"||Array.isArray(formation)||
       formation.version!==1||!map||typeof map!=="object"||Array.isArray(map)){
        blockers.add("FORMATION_STRUCTURE_INVALID");
        return;
    }
    const occupied=new Set();
    for(const [index,slot] of Object.entries(map)){
        if(!/^(0|1|2)$/.test(index)||
           (index==="1"&&save.player2==null)||
           (index==="2"&&save.player3==null)||
           !ALLY_SLOTS.has(slot)||occupied.has(slot)){
            blockers.add("FORMATION_STRUCTURE_INVALID");
        }
        occupied.add(slot);
    }
}

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
    if(save.player==null){ blockers.add("CHARACTER_SLOT_MISSING"); }
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
    auditLegacyFormation(save,blockers);
    // A candidate is never an authoritative character. These source checks
    // only prevent a future projection from silently inventing missing state.
    if(!Number.isSafeInteger(save.gold)||save.gold<0||
       !Number.isSafeInteger(save.sharedExp)||save.sharedExp<0){
        blockers.add("ECONOMY_SOURCE_MISSING");
    }
    if(!save.characterSkillLoadouts||typeof save.characterSkillLoadouts!=="object"||
       Array.isArray(save.characterSkillLoadouts)){
        blockers.add("SKILL_SOURCE_MISSING");
    }else if(["fire",...(save.player2!=null?["player2"]:[]),
        ...(save.player3!=null?["player3"]:[])].some(key=>{
        const value=save.characterSkillLoadouts[key];
        return !value||typeof value!=="object"||Array.isArray(value)||
            !value.skillLevels||typeof value.skillLevels!=="object"||
            Array.isArray(value.skillLevels)||!Array.isArray(value.equippedSkills);
    })){
        blockers.add("SKILL_SOURCE_INVALID");
    }
    if(!save.playerRelics||typeof save.playerRelics!=="object"||
       Array.isArray(save.playerRelics)||
       !save.teamLoadout||typeof save.teamLoadout!=="object"||
       Array.isArray(save.teamLoadout)){
        blockers.add("RELIC_SOURCE_MISSING");
    }else if(save.teamLoadout.relicId!=null&&
        (typeof save.teamLoadout.relicId!=="string"||
         save.playerRelics[save.teamLoadout.relicId]?.unlocked!==true)){
        blockers.add("RELIC_REFERENCE_INVALID");
    }
    for(const field of CLAIM_FIELDS){
        if(!save[field]||typeof save[field]!=="object"){
            blockers.add("CLAIM_PROGRESS_MISSING");
        }
    }
    const rewardAudit=auditLegacyRewardClaims(save,sidecars);
    rewardAudit.blockers.forEach(blocker=>blockers.add(blocker));
    if(!sidecars||CLAIM_SIDECARS.some(key=>sidecars[key]?.status!=="present")){
        blockers.add("SIDECAR_BACKUP_MISSING");
    }
    if(sidecars&&CLAIM_SIDECARS.some(key=>{
        if(sidecars[key]?.status!=="present"){ return false; }
        try{
            const value=JSON.parse(sidecars[key].raw);
            return !value||typeof value!=="object"||Array.isArray(value);
        }catch(_){ return true; }
    })){
        blockers.add("SIDECAR_CLAIM_RECORD_INVALID");
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
            const review=screenLegacyCandidateSnapshot(candidate.snapshot,record.backup?.sidecars);
            const draft=prepareLegacyCharacterDraft(candidate.snapshot,record.backup?.sidecars,review);
            // IDs in this review plan are ephemeral. Admission must allocate
            // fresh IDs inside its own future protected transaction.
            const plan=draft?buildCanonicalCharacterReviewPlan(uid,draft):null;
            return {
                candidateRevision,serverRevision:envelope.serverRevision,
                fingerprint:candidate.fingerprint,
                ...review,
                conversionReview:plan?{
                    status:"prepared-untrusted",
                    characterSlots:plan.account.slots.length,
                    characterRecords:plan.characters.length,
                    ownedItemObjects:plan.ownedItems.length,
                    equippedObjects:plan.equipmentRefs.length,
                    retainedSidecarSources:LEGACY_BACKUP_SIDECARS.length,
                    claimHistoryBlocked:true
                }:{status:"blocked"}
            };
        });
    }
    return Object.freeze({screen});
}

module.exports={createLegacyCandidateScreening,screenLegacyCandidateSnapshot,
    prepareLegacyCharacterDraft};
