"use strict";

const {createHash}=require("node:crypto");
const {projectItem}=require("./equipment-combat-percent-migration");
const {LEGACY_BACKUP_SIDECARS}=require("./cloud-save-policy.js");

const SCHEMA_VERSION=1;
const MAX_SNAPSHOT_BYTES=750*1024;
const PROGRESS_FIELDS=["dailyQuestState","commissionQuestState","achievementState",
    "gameplayProgress","abyssProgress"];
const CLAIM_SIDECARS=new Set(["daily-dungeon-state","progress","quest-milestones",
    "task-tracker","legacy-abyss-state","equipment-shop-daily",
    "equipment-shop-purchases","abyss-state"]);
const EQUIPMENT_SLOTS=new Set(["head","hand","shoulder","armor","shoes","ring"]);
const EQUIPMENT_TYPES={weapon:"hand",hand:"hand",helmet:"head",head:"head",
    shoulder:"shoulder",armor:"armor",shoes:"shoes",accessory:"ring",ring:"ring"};
const FORMATION_SLOTS=new Set(["ALLY_F1","ALLY_F2","ALLY_F3",
    "ALLY_B1","ALLY_B2","ALLY_B3"]);
const ELEMENTS=new Set(["fire","water","wind","earth"]);
const ID=/^[A-Za-z0-9_-]{1,128}$/;

function fail(message){ throw new Error(`Canonical snapshot invalid: ${message}`); }
function object(value){ return value!==null&&typeof value==="object"&&!Array.isArray(value); }
function copy(value){ return JSON.parse(JSON.stringify(value)); }
// Firestore may return map keys in a different order than the writer supplied.
// Hash the logical record, while preserving array order and the exact byte
// length check of the stored JSON projection separately.
function stable(value){
    if(Array.isArray(value)){return value.map(stable);}
    if(object(value)){
        return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])]));
    }
    return value;
}
function digest(value){ return createHash("sha256").update(JSON.stringify(value),"utf8").digest("hex"); }
function snapshotDigest(value){ return digest(stable(value)); }
function claimRecordsDigest(records){ return digest(stable(records)); }

// Durable sources inherit ownership/revision from progress/current. The older
// explicit in-memory input remains available, but two sources cannot coexist.
function inspectPlayableState(records){
    const fields=["heroAccount","bestiaryData","autoConfig","autoConfig2","autoConfig3",
        "selectedCreationElement","lastSaveTimestamp"];
    const stored=records.progress?.playableState;
    let extra=records.playableState;
    if(stored!==undefined){
        if(extra!==undefined||!object(stored)||Object.keys(stored).length!==fields.length||
           fields.some(key=>!Object.hasOwn(stored,key))){
            fail("durable playable fields or duplicate source");
        }
        extra={schemaVersion:records.progress.schemaVersion,ownerUid:records.progress.ownerUid,
            serverRevision:records.progress.serverRevision,provenance:records.progress.provenance,
            ...stored};
    }
    const keys=["schemaVersion","ownerUid","serverRevision","provenance",...fields];
    if(!object(extra)||Object.keys(extra).length!==keys.length||
       keys.some(key=>!Object.hasOwn(extra,key))||extra.schemaVersion!==1||
       extra.ownerUid!==records.account.ownerUid||extra.serverRevision!==records.account.serverRevision||
       extra.provenance!==records.account.provenance||
       !object(extra.heroAccount)||!object(extra.bestiaryData)||
       !ELEMENTS.has(extra.selectedCreationElement)||
       !Number.isSafeInteger(extra.lastSaveTimestamp)||extra.lastSaveTimestamp<1){
        fail("complete playable source owner, revision or fields");
    }
    require("./cloud-save-policy").validateJsonValue(extra,"playable source",0);
    const hero=require("./hero-core").normalizeAccountState(extra.heroAccount);
    if(snapshotDigest(hero)!==snapshotDigest(extra.heroAccount)){
        fail("Hero source would require defaults or discard fields");
    }
    for(const [name,row] of Object.entries(extra.bestiaryData)){
        if(!name.trim()||name.length>128||!object(row)||
           Object.keys(row).sort().join("|")!=="kills|seen"||typeof row.seen!=="boolean"||
           !Number.isSafeInteger(row.kills)||row.kills<0||(!row.seen&&row.kills>0)){
            fail("bestiary observation or kill count");
        }
    }
    const configKeys=["autoConfig","autoConfig2","autoConfig3"];
    const preferences=require("./cloud-preferences").normalizePreferences({
        characterIds:records.account.slots.map((id,index)=>id===null?null:`slot-${index}`),
        ...Object.fromEntries(configKeys.map(key=>[key,extra[key]]))});
    return {extra,hero,preferences};
}

// The future protected writer supplies server-owned records at one revision.
// This pure reader never reads a client candidate, changes Firestore, or
// publishes a playable pointer. A recovery/claim gate must precede publication.
function assembleCanonicalSnapshot(uid,revision,records){
    if(typeof uid!=="string"||!uid||uid.includes("/")||
       !Number.isSafeInteger(revision)||revision<1||!object(records)){
        fail("owner or revision");
    }
    const required=["account","characters","economy","inventory","equipment",
        "relics","relicLoadout","progress","claimCheckpoint","claimRecords"];
    if(required.some(key=>records[key]===undefined)){
        fail("required source missing");
    }
    const provenance=records.account?.provenance;
    if(!["server-created","grandfathered-unverified-history"].includes(provenance)){
        fail("untrusted or unsupported provenance");
    }
    const check=(record,label)=>{
        if(!object(record)||record.schemaVersion!==SCHEMA_VERSION||
           record.ownerUid!==uid||record.serverRevision!==revision||
           record.provenance!==provenance){ fail(`${label} owner, schema or revision`); }
    };
    check(records.account,"account");
    const slots=records.account.slots;
    if(!Array.isArray(slots)||slots.length!==3||!ID.test(slots[0]||"")||
       slots.some((id,index)=>id!==null&&!ID.test(id||"")||
           index===2&&id!==null&&slots[1]===null)||
       new Set(slots.filter(Boolean)).size!==slots.filter(Boolean).length){
        fail("character slots");
    }
    const characters=records.characters;
    if(!Array.isArray(characters)||characters.length!==slots.filter(Boolean).length){
        fail("character count");
    }
    const seenCharacters=new Set();
    for(const character of characters){
        check(character,"character");
        if(!Number.isInteger(character.slotIndex)||character.slotIndex<0||
           character.slotIndex>2||slots[character.slotIndex]!==character.characterId||
           seenCharacters.has(character.characterId)||
           typeof character.displayName!=="string"||!character.displayName.trim()||
           !ELEMENTS.has(character.element)||!object(character.state)||
           character.state.id!==character.displayName||
           character.state.element!==character.element||
           !Number.isSafeInteger(character.state.level)||character.state.level<1||
           !Number.isSafeInteger(character.state.exp)||character.state.exp<0||
           !object(character.skillLoadout)||
           !object(character.skillLoadout.skillLevels)||
           !Array.isArray(character.skillLoadout.equippedSkills)){
            fail("character state or slot reference");
        }
        seenCharacters.add(character.characterId);
    }
    const formation=records.account.formation;
    if(formation!=null){
        const map=formation.characterIndexToSlot;
        if(!object(formation)||formation.version!==1||!object(map)||
           Object.entries(map).some(([index,slot])=>
               !/^(0|1|2)$/.test(index)||slots[Number(index)]===null||
               !FORMATION_SLOTS.has(slot))||
           new Set(Object.values(map)).size!==Object.values(map).length){
            fail("formation reference");
        }
    }
    check(records.economy,"economy");
    if(!Number.isSafeInteger(records.economy.gold)||records.economy.gold<0||
       !Number.isSafeInteger(records.economy.sharedExp)||records.economy.sharedExp<0){
        fail("economy");
    }
    const items=new Map();
    if(!Array.isArray(records.inventory)||!Array.isArray(records.equipment)){
        fail("inventory or equipment source missing");
    }
    for(const item of records.inventory){
        check(item,"owned item");
        if(!ID.test(item.ownedItemId||"")||items.has(item.ownedItemId)||
           !["bag","equipped"].includes(item.location)||!object(item.state)||
           typeof item.state.id!=="string"||!item.state.id.trim()||
           !Number.isSafeInteger(item.state.count)||item.state.count<1){
            fail("owned item identity or state");
        }
        items.set(item.ownedItemId,item);
    }
    const equippedIds=new Set(),occupied=new Set();
    for(const ref of records.equipment){
        check(ref,"equipment reference");
        const item=items.get(ref.ownedItemId);
        const slotKey=`${ref.characterId}:${ref.slot}`;
        if(!slots.includes(ref.characterId)||!EQUIPMENT_SLOTS.has(ref.slot)||
           !item||item.location!=="equipped"||item.state.count!==1||
           EQUIPMENT_TYPES[item.state.type]!==ref.slot||
           equippedIds.has(ref.ownedItemId)||
           occupied.has(slotKey)){
            fail("equipment ownership or slot reference");
        }
        equippedIds.add(ref.ownedItemId);occupied.add(slotKey);
    }
    if([...items.values()].some(item=>item.location==="equipped"&&!equippedIds.has(item.ownedItemId))){
        fail("equipped item without a reference");
    }
    if(!Array.isArray(records.relics)){ fail("relic source missing"); }
    const relics=new Map();
    for(const relic of records.relics){
        check(relic,"relic");
        if(typeof relic.relicId!=="string"||!relic.relicId.trim()||
           relics.has(relic.relicId)||typeof relic.unlocked!=="boolean"||
           !Number.isSafeInteger(relic.level)||relic.level<1||
           !Number.isSafeInteger(relic.exp)||relic.exp<0){
            fail("relic identity or state");
        }
        relics.set(relic.relicId,relic);
    }
    check(records.relicLoadout,"relic loadout");
    if(records.relicLoadout.subRelicId!==null||
       records.relicLoadout.relicId!==null&&
       relics.get(records.relicLoadout.relicId)?.unlocked!==true){
        fail("relic loadout ownership");
    }
    check(records.progress,"progress");
    if(PROGRESS_FIELDS.some(key=>!object(records.progress[key]))||
       !object(records.progress.sidecars)||
       Object.keys(records.progress.sidecars).sort().join("|")!==LEGACY_BACKUP_SIDECARS.join("|")){
        fail("progress or sidecar inventory");
    }
    for(const [key,entry] of Object.entries(records.progress.sidecars)){
        if(!object(entry)||!(entry.status==="present"&&typeof entry.raw==="string"||
             entry.status==="missing"&&entry.raw===null||
             provenance==="server-created"&&entry.status==="not-applicable"&&entry.raw===null)||
           CLAIM_SIDECARS.has(key)&&provenance!=="server-created"&&entry.status!=="present"){
            fail("claim-bearing sidecar missing or invalid");
        }
        if(CLAIM_SIDECARS.has(key)&&entry.status==="present"){
            let parsed;
            try{ parsed=JSON.parse(entry.raw); }catch(_){ fail("claim-bearing sidecar JSON"); }
            if(!object(parsed)){ fail("claim-bearing sidecar structure"); }
        }
    }
    check(records.claimCheckpoint,"claim checkpoint");
    if(!Array.isArray(records.claimRecords)||
       records.claimCheckpoint.claimCount!==records.claimRecords.length||
       records.claimCheckpoint.claimDigest!==claimRecordsDigest(records.claimRecords)||
       records.claimCheckpoint.historicalClaimsBlocked!==
           (provenance==="grandfathered-unverified-history")){
        fail("claim checkpoint");
    }
    const claimKeys=new Set();
    for(const claim of records.claimRecords){
        check(claim,"claim");
        if(typeof claim.claimKey!=="string"||!claim.claimKey||
           claimKeys.has(claim.claimKey)||!(["claimed","blocked"].includes(claim.status))){
            fail("claim identity or status");
        }
        claimKeys.add(claim.claimKey);
    }
    if(provenance==="grandfathered-unverified-history"&&
       !records.claimRecords.some(claim=>claim.status==="blocked")){
        fail("historical claims need a blocking record");
    }
    if(records.progress.playableState!==undefined){inspectPlayableState(records);}
    const payload={schemaVersion:SCHEMA_VERSION,ownerUid:uid,
        sourceServerRevision:revision,provenance,slots:copy(slots),
        characters:copy(characters),economy:copy(records.economy),
        inventory:records.inventory.map(item=>({...copy(item),state:EQUIPMENT_TYPES[item.state.type]?projectItem(item.state):copy(item.state)})),equipment:copy(records.equipment),
        relics:copy(records.relics),relicLoadout:copy(records.relicLoadout),
        formation:copy(records.account.formation??null),
        progress:copy(records.progress),
        claimCheckpoint:copy(records.claimCheckpoint)};
    const serialized=JSON.stringify(payload);
    const byteLength=Buffer.byteLength(serialized,"utf8");
    if(byteLength>MAX_SNAPSHOT_BYTES){ fail("snapshot exceeds internal size budget"); }
    return Object.freeze({snapshot:payload,sha256:snapshotDigest(payload),byteLength,
        readyForPublication:false});
}

function inspectCanonicalSnapshot(bundle,uid,revision){
    if(!object(bundle)||!object(bundle.snapshot)||bundle.readyForPublication!==false||
       bundle.snapshot.ownerUid!==uid||bundle.snapshot.sourceServerRevision!==revision||
       !/^[a-f0-9]{64}$/.test(bundle.sha256||"")||
       !Number.isSafeInteger(bundle.byteLength)||bundle.byteLength<1||
       Buffer.byteLength(JSON.stringify(bundle.snapshot),"utf8")!==bundle.byteLength||
       snapshotDigest(bundle.snapshot)!==bundle.sha256){
        fail("stored snapshot digest, size or owner");
    }
    return bundle.snapshot;
}

function verifyCanonicalSnapshotAgainstSources(bundle,uid,revision,records){
    inspectCanonicalSnapshot(bundle,uid,revision);
    const rebuilt=assembleCanonicalSnapshot(uid,revision,records);
    if(rebuilt.sha256!==bundle.sha256||rebuilt.byteLength!==bundle.byteLength){
        fail("snapshot differs from canonical source records");
    }
    return bundle.snapshot;
}

// A separate, unpublished projection keeps existing archive/receipt v1 hashes
// stable. The caller must supply reviewed server sources; this is not a writer
// or a client-candidate adoption path.
function assembleCanonicalPlayableProjection(uid,revision,records){
    const {validateJsonValue,validateLegacySaveCandidate}=require("./cloud-save-policy.js");
    validateJsonValue(records,"canonical sources",0);
    const source=assembleCanonicalSnapshot(uid,revision,records);
    const {extra,hero,preferences}=inspectPlayableState(records);
    const configKeys=["autoConfig","autoConfig2","autoConfig3"];
    const slotKeys=["fire","player2","player3"];
    const characterEquipment={},characterSkillLoadouts={};
    const players=[null,null,null];
    for(const character of source.snapshot.characters){
        const state=character.state;
        const integers=["attack","intelligence","vitality","energy","defensePoints",
            "agility","expNext","skillPoints","attributePoints","bonusHP","bonusSP"];
        if(integers.some(key=>!Number.isSafeInteger(state[key])||state[key]<0)||
           state.expNext<1||!["male","female"].includes(state.gender)||
           ["hp","sp"].some(key=>!Number.isFinite(state[key])||state[key]<0)||
           !Array.isArray(state.activeBuffs)||!Array.isArray(state.statusEffects)||
           typeof state.isDefending!=="boolean"){
            fail("complete character state");
        }
        players[character.slotIndex]=copy(state);
        const key=slotKeys[character.slotIndex];
        characterEquipment[key]=Object.fromEntries([...EQUIPMENT_SLOTS].map(slot=>[slot,null]));
        characterSkillLoadouts[key]=copy(character.skillLoadout);
    }
    const items=new Map(source.snapshot.inventory.map(item=>[item.ownedItemId,item]));
    const itemState=item=>({...copy(item.state),v141Uid:item.ownedItemId});
    for(const ref of source.snapshot.equipment){
        const index=source.snapshot.slots.indexOf(ref.characterId);
        characterEquipment[slotKeys[index]][ref.slot]=itemState(items.get(ref.ownedItemId));
    }
    const playerRelics={};
    for(const relic of source.snapshot.relics){
        if(typeof relic.seen!=="boolean"){ fail("complete relic state"); }
        playerRelics[relic.relicId]={unlocked:relic.unlocked,level:relic.level,
            exp:relic.exp,seen:relic.seen};
    }
    // Device-only preferences may be missing; every gameplay source must be
    // explicit. An empty/default object cannot be synthesized by this reader.
    const deviceOnly=new Set(["announcement-read","bulk-sell-quality","patrol-character-index"]);
    const sidecars=copy(source.snapshot.progress.sidecars);
    for(const [key,entry] of Object.entries(sidecars)){
        if(deviceOnly.has(key)){continue;}
        if(entry.status!=="present"){ fail(`playable sidecar missing: ${key}`); }
        let parsed;
        try{parsed=JSON.parse(entry.raw);}catch(_){fail(`playable sidecar JSON: ${key}`);}
        if(!object(parsed)){fail(`playable sidecar structure: ${key}`);}
        validateJsonValue(parsed,`sidecar ${key}`,0);
    }
    const gameSave={version:6,heroAccount:hero,player:players[0],player2:players[1],
        player3:players[2],gold:source.snapshot.economy.gold,
        sharedExp:source.snapshot.economy.sharedExp,bestiaryData:copy(extra.bestiaryData),
        lastSaveTimestamp:extra.lastSaveTimestamp,selectedCreationElement:extra.selectedCreationElement,
        characterEquipment,characterSkillLoadouts,allyFormation:copy(source.snapshot.formation),
        playerRelics,teamLoadout:{relicId:source.snapshot.relicLoadout.relicId,
            subRelicId:source.snapshot.relicLoadout.subRelicId},
        inventoryItems:source.snapshot.inventory.filter(item=>item.location==="bag").map(itemState),
        ...Object.fromEntries(PROGRESS_FIELDS.map(key=>[key,copy(source.snapshot.progress[key])])),
        ...Object.fromEntries(configKeys.map(key=>[key,copy(preferences[key])]))};
    // Reuse the current save-format bounds, without adopting a candidate or
    // treating structural validity as authority.
    validateLegacySaveCandidate(gameSave);
    const projection={projectionVersion:1,ownerUid:uid,sourceServerRevision:revision,
        sourceSnapshotSha256:source.sha256,gameSave,sidecars,
        claimCheckpoint:copy(source.snapshot.claimCheckpoint),authoritativeStateReady:false};
    const byteLength=Buffer.byteLength(JSON.stringify(projection),"utf8");
    if(byteLength>MAX_SNAPSHOT_BYTES){ fail("playable projection exceeds internal size budget"); }
    return Object.freeze({projection,sha256:snapshotDigest(projection),byteLength,
        readyForPublication:false});
}

function verifyCanonicalPlayableProjectionAgainstSources(bundle,uid,revision,records){
    if(!object(bundle)||!object(bundle.projection)||bundle.readyForPublication!==false||
       bundle.projection.authoritativeStateReady!==false||
       bundle.projection.ownerUid!==uid||bundle.projection.sourceServerRevision!==revision||
       snapshotDigest(bundle.projection)!==bundle.sha256||
       Buffer.byteLength(JSON.stringify(bundle.projection),"utf8")!==bundle.byteLength){
        fail("playable projection digest, size, readiness or owner");
    }
    const rebuilt=assembleCanonicalPlayableProjection(uid,revision,records);
    if(rebuilt.sha256!==bundle.sha256||rebuilt.byteLength!==bundle.byteLength){
        fail("playable projection differs from canonical sources");
    }
    return bundle.projection;
}

module.exports={assembleCanonicalSnapshot,assembleCanonicalPlayableProjection,inspectCanonicalSnapshot,
    verifyCanonicalSnapshotAgainstSources,verifyCanonicalPlayableProjectionAgainstSources,
    claimRecordsDigest,MAX_SNAPSHOT_BYTES};
