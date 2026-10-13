"use strict";

const {createHash}=require("node:crypto");
const {projectItem}=require("./equipment-combat-percent-migration");
const {LEGACY_BACKUP_SIDECARS}=require("./cloud-save-policy.js");

const SCHEMA_VERSION=1;
const MAX_SNAPSHOT_BYTES=750*1024;
const PROGRESS_FIELDS=["dailyQuestState","commissionQuestState","achievementState",
    "gameplayProgress","abyssProgress"];
const CLAIM_SIDECARS=new Set(["daily-dungeon-state","progress","quest-milestones",
    "legacy-abyss-state","equipment-shop-daily",
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

// Retained playable character fields only. The same storage guard protects
// durable snapshots and complete projections; no stat formulas, HP/SP refill,
// transient-state execution, defaults or historical backfill happen here.
function inspectPlayableCharacterState(state){
    const integers=["attack","intelligence","vitality","energy","defensePoints",
        "agility","expNext","skillPoints","attributePoints","bonusHP","bonusSP"];
    if(integers.some(key=>!Number.isSafeInteger(state[key])||state[key]<0)||
       state.expNext<1||!["male","female"].includes(state.gender)||
       ["hp","sp"].some(key=>!Number.isFinite(state[key])||state[key]<0)||
       !Array.isArray(state.activeBuffs)||!Array.isArray(state.statusEffects)||
       typeof state.isDefending!=="boolean"){
        fail("complete character state");
    }
}

// Retain an explicitly recorded serialized formation without client hydration,
// missing-character defaults or battle execution. Null remains uninitialized.
function inspectPlayableFormation(formation,slots){
    if(formation==null){return;}
    if(formation.version===2){
        if(Object.keys(formation.characterIndexToSlot||{}).sort().join("|")!==slots.flatMap((id,index)=>id===null?[]:[String(index)]).join("|"))fail("complete formation state");
        return;
    }
    if(!object(formation)||Object.keys(formation).sort().join("|")!=="characterIndexToSlot|version"||
       !object(formation.characterIndexToSlot)||
       Object.keys(formation.characterIndexToSlot).sort().join("|")!==
           slots.flatMap((id,index)=>id===null?[]:[String(index)]).join("|")){
        fail("complete formation state");
    }
}

// Retained Client achievement storage only. Markers never prove eligibility,
// create a claim or authorize rewards; catalogue reconciliation is separate.
function inspectAchievementState(state){
    if(!object(state)||Object.entries(state).some(([id,claimed])=>
       !ID.test(id)||typeof claimed!=="boolean")){
        fail("achievement claim markers");
    }
}

// Recorded Client quest storage only. No rollover, catalogue eligibility,
// completion calculation or reward/claim authorization is performed here.
function recordedDate(value){
    return typeof value==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&
        Number.isFinite(Date.parse(`${value}T00:00:00Z`))&&
        new Date(`${value}T00:00:00Z`).toISOString().slice(0,10)===value;
}
function inspectQuestState(key,state,allowUninitialized=false){
    if(allowUninitialized&&object(state)&&Object.keys(state).length===0){return;}
    const required=key==="dailyQuestState"?["checkin","killMonsters","winBattle"]:
        ["killMonsters","winBattle"];
    if(!object(state)||Object.keys(state).sort().join("|")!=="claimed|date|progress"||
       !object(state.progress)||!object(state.claimed)){
        fail(`quest storage fields: ${key}`);
    }
    const ids=Object.keys(state.progress);
    if(required.some(id=>!Object.hasOwn(state.progress,id))||
       ids.sort().join("|")!==Object.keys(state.claimed).sort().join("|")||
       ids.some(id=>!ID.test(id)||!Number.isSafeInteger(state.progress[id])||
           state.progress[id]<0||typeof state.claimed[id]!=="boolean")||
       !(recordedDate(state.date)||state.date===""&&ids.every(id=>
           state.progress[id]===0&&state.claimed[id]===false))){
        fail(`recorded quest date, counters or claim markers: ${key}`);
    }
}

// Existing Client Boss/Tower storage schema only. Keep recorded periods and
// markers; never compute the current week, run combat or reconcile rewards.
function inspectGameplayProgress(state,allowUninitialized=false){
    if(allowUninitialized&&object(state)&&Object.keys(state).length===0){return;}
    const exact=(value,keys)=>object(value)&&
        Object.keys(value).sort().join("|")===[...keys].sort().join("|");
    const integer=(value,max=Number.MAX_SAFE_INTEGER)=>
        Number.isSafeInteger(value)&&value>=0&&value<=max;
    const personalIds=[20,30,40,50,60,70,80,90,100].map(level=>`personal-${level}`);
    const worldIds=[40,60,80,100].map(level=>`world-${level}`);
    if(!exact(state,["version","personal","world","tower"])||state.version!==1||
       !exact(state.personal,personalIds)||!exact(state.world,worldIds)){
        fail("gameplay progress root or Boss source inventory");
    }
    for(const [group,ids] of [[state.personal,personalIds],[state.world,worldIds]]){
        for(const id of ids){
            const entry=group[id],world=group===state.world;
            if(!exact(entry,world?["completedStages","firstClear","clears"]:["firstClear","clears"])||
               typeof entry.firstClear!=="boolean"||!integer(entry.clears)||
               world&&!integer(entry.completedStages,4)){
                fail("gameplay progress Boss counters or first-clear markers");
            }
        }
    }
    const tower=state.tower;
    if(!exact(tower,["weekKey","element","completedFloor","highestThisWeek",
        "claimedFloors","historicalHighest","pendingRelicChoice"])||
       !recordedDate(tower.weekKey)||new Date(`${tower.weekKey}T00:00:00Z`).getUTCDay()!==1||
       !ELEMENTS.has(tower.element)||
       ["completedFloor","highestThisWeek","historicalHighest"].some(key=>!integer(tower[key],100))||
       typeof tower.pendingRelicChoice!=="boolean"||!object(tower.claimedFloors)||
       Object.entries(tower.claimedFloors).some(([floor,claimed])=>
           !/^[1-9]\d*$/.test(floor)||!integer(Number(floor),100)||claimed!==true)){
        fail("gameplay progress Tower period, counters or recorded claims");
    }
}

// Retained skill storage shape only: no catalogue, learning/cost/element
// eligibility, combat execution, defaults or normalization in this reader.
// Client skill Owner stores positive levels (current global ceiling 10) and
// at most four distinct learned skill references in their recorded order.
function inspectSkillLoadout(loadout){
    if(!object(loadout)||!object(loadout.skillLevels)||!Array.isArray(loadout.equippedSkills)||
       Object.keys(loadout).some(key=>!["name","skillLevels","equippedSkills"].includes(key))||
       Object.hasOwn(loadout,"name")&&(typeof loadout.name!=="string"||!loadout.name.trim())){
        fail("skill loadout fields");
    }
    require("./cloud-save-policy").validateJsonValue(loadout,"skill loadout",0);
    if(Object.entries(loadout.skillLevels).some(([id,level])=>
        !ID.test(id)||!Number.isSafeInteger(level)||level<1||level>10)||
       loadout.equippedSkills.length>4||
       new Set(loadout.equippedSkills).size!==loadout.equippedSkills.length||
       loadout.equippedSkills.some(id=>typeof id!=="string"||!ID.test(id)||
           !Object.hasOwn(loadout.skillLevels,id))){
        fail("skill loadout levels or equipped references");
    }
}

// Validate retained evidence, never sanitize it or accrue elapsed-time value.
// Bounds come from the existing element-box, growth and rested storage owners.
function inspectTimeSidecar(key,raw){
    const fields={
        "element-box-state":["remainingMs"],
        "exp-pool-growth-state":["initialized","unlocked","lastAt","noticeShown",
            "lastCapped","newcomerRewards"],
        "rested-exp-state":["battles","progressMs","lastSeenAt","blockedByElementBox"]
    }[key];
    if(!fields){return;}
    let state;
    try{state=JSON.parse(raw);}catch(_){fail(`time sidecar JSON: ${key}`);}
    if(!object(state)||Object.keys(state).sort().join("|")!==[...fields].sort().join("|")){
        fail(`time sidecar fields: ${key}`);
    }
    require("./cloud-save-policy").validateJsonValue(state,`time sidecar ${key}`,0);
    const integer=(value,max=Number.MAX_SAFE_INTEGER)=>
        Number.isSafeInteger(value)&&value>=0&&value<=max;
    if(key==="element-box-state"){
        if(!integer(state.remainingMs,32*60*60*1000)){fail("element-box remaining time");}
    }else if(key==="rested-exp-state"){
        if(!integer(state.battles,300)||!integer(state.progressMs,120000-1)||
           !integer(state.lastSeenAt)||state.lastSeenAt<1||
           typeof state.blockedByElementBox!=="boolean"||
           state.battles===300&&state.progressMs!==0){fail("rested time evidence");}
    }else{
        if(["initialized","unlocked","noticeShown","lastCapped"].some(field=>
            typeof state[field]!=="boolean")||!integer(state.lastAt)||
           !object(state.newcomerRewards)||Object.entries(state.newcomerRewards).some(
               ([id,claimed])=>!ID.test(id)||claimed!==true)||
           (state.initialized?state.lastAt<1:
               state.lastAt!==0||state.unlocked||state.noticeShown||state.lastCapped)||
           !state.unlocked&&(state.noticeShown||state.lastCapped)){
            fail("growth time or recorded reward evidence");
        }
    }
}

// Recorded progress/claim evidence only. No completion calculation, rollover,
// eligibility, claim creation or migration defaults happen in this reader.
function inspectClaimSidecar(key,raw){
    const fields={progress:["eliteKills","dungeonWins","abyssClears"],
        "quest-milestones":["date","daily","commission"],
        "daily-dungeon-state":["date","used"],
        "legacy-abyss-state":["active","floor","phase","x","y","message","clears","rewardVersion"],
        "equipment-shop-daily":["date","refreshCount","soldOfferIds"]}[key];
    if(!fields){return;}
    let state;
    try{state=JSON.parse(raw);}catch(_){fail(`claim sidecar JSON: ${key}`);}
    if(!object(state)||Object.keys(state).sort().join("|")!==[...fields].sort().join("|")){
        fail(`claim sidecar fields: ${key}`);
    }
    require("./cloud-save-policy").validateJsonValue(state,`claim sidecar ${key}`,0);
    if(key==="progress"){
        if(fields.some(field=>!Number.isSafeInteger(state[field])||state[field]<0)){
            fail("recorded progress counters");
        }
    }else if(key==="legacy-abyss-state"){
        // Pre-chest portal records have ambiguous reward semantics. Retain
        // them in historical v1 archives, never reinterpret them here.
        if(typeof state.active!=="boolean"||!Number.isSafeInteger(state.floor)||
           state.floor<1||state.floor>5||
           !["boss","chest","portal","complete"].includes(state.phase)||
           !Number.isFinite(state.x)||state.x<4||state.x>96||
           !Number.isFinite(state.y)||state.y<8||state.y>94||
           typeof state.message!=="string"||!Number.isSafeInteger(state.clears)||
           state.clears<0||state.rewardVersion!==1){
            fail("recorded legacy Abyss evidence or reward version");
        }
    }else{
        if(!recordedDate(state.date)){
            fail(`recorded claim date: ${key}`);
        }
        if(key==="daily-dungeon-state"){
            if(!object(state.used)||Object.keys(state.used).sort().join("|")!=="equipment|exp|material"||
               Object.values(state.used).some(value=>typeof value!=="boolean")){
                fail("recorded dungeon usage");
            }
        }else if(key==="equipment-shop-daily"){
            if(!Number.isSafeInteger(state.refreshCount)||state.refreshCount<0||
               !Array.isArray(state.soldOfferIds)||new Set(state.soldOfferIds).size!==state.soldOfferIds.length||
               state.soldOfferIds.some(id=>{
                   if(typeof id!=="string"){return true;}
                   const parts=id.split(":");
                   return parts.length!==3||parts[0]!==state.date||
                       !/^(0|[1-9]\d*)$/.test(parts[1])||
                       !Number.isSafeInteger(Number(parts[1]))||Number(parts[1])>state.refreshCount||
                       !/^[0-5]$/.test(parts[2]);
               })){
                fail("recorded shop refresh or purchase evidence");
            }
        }else if(["daily","commission"].some(type=>!object(state[type])||
               Object.entries(state[type]).some(([threshold,claimed])=>
                   !["20","40","60","80","100"].includes(threshold)||claimed!==true))){
            fail("recorded milestone date or claim markers");
        }
    }
}

// Validate retained Client save schema and its mirror, never execute an Abyss
// lifecycle, migrate history, calculate rewards or repair claim records.
function inspectAbyssSidecar(key,raw,progress){
    if(key!=="abyss-state"){return;}
    let state;
    try{state=JSON.parse(raw);}catch(_){fail("Abyss sidecar JSON");}
    const exact=(value,keys)=>object(value)&&
        Object.keys(value).sort().join("|")===[...keys].sort().join("|");
    const integer=(value,min=0,max=Number.MAX_SAFE_INTEGER)=>
        Number.isSafeInteger(value)&&value>=min&&value<=max;
    if(!exact(state,["version","selectedDifficulty","legacyMigrated","runs"])||
       state.version!==3||![null,20,40].includes(state.selectedDifficulty)||
       typeof state.legacyMigrated!=="boolean"||!exact(state.runs,["20","40"])){
        fail("Abyss root schema");
    }
    require("./cloud-save-policy").validateJsonValue(state,"Abyss source",0);
    require("./cloud-save-policy").validateJsonValue(progress.abyssProgress,"Abyss main source",0);
    const booleans=["active","isBoss","battleCompleted","chestSpawned","chestClaimed",
        "portalUnlocked","regionCompleted","completed"];
    const fields=["difficulty",...booleans,"regionIndex","encounterIndex","phase",
        "clears","completedRegions","completedStages","rewardClaims","firstClearClaims",
        "x","y","message"];
    for(const level of [20,40]){
        const run=state.runs[level],stage=new RegExp(`^d${level}-r[0-4]-s[0-4]$`);
        if(!exact(run,fields)||run.difficulty!==level||
           booleans.some(field=>typeof run[field]!=="boolean")||
           !integer(run.regionIndex,0,4)||!integer(run.encounterIndex,0,4)||
           !integer(run.clears)||!["ready","chest","portal","complete"].includes(run.phase)||
           !Number.isFinite(run.x)||run.x<4||run.x>96||
           !Number.isFinite(run.y)||run.y<8||run.y>94||typeof run.message!=="string"||
           !Array.isArray(run.completedRegions)||run.completedRegions.length!==5||
           run.completedRegions.some(value=>typeof value!=="boolean")||
           !object(run.completedStages)||Object.entries(run.completedStages).some(
               ([id,value])=>!stage.test(id)||value!==true)||
           !object(run.rewardClaims)||!object(run.firstClearClaims)){
            fail("Abyss run schema");
        }
        for(const claims of [run.rewardClaims,run.firstClearClaims]){
            for(const [id,claim] of Object.entries(claims)){
                if(!stage.test(id)||!object(claim)){fail("Abyss claim identity");}
                const reserved=exact(claim,["status","reservedAt"])&&
                    claim.status==="granting"&&integer(claim.reservedAt,1);
                const migrated=exact(claim,["status","migrated"])&&
                    claim.status==="claimed"&&claim.migrated===true;
                const claimed=exact(claim,["status","kind","gold","exp","ticketId","claimedAt"])&&
                    claim.status==="claimed"&&["normal","emperor"].includes(claim.kind)&&
                    integer(claim.gold)&&integer(claim.exp)&&integer(claim.claimedAt,1)&&
                    (claim.ticketId===null||typeof claim.ticketId==="string"&&ID.test(claim.ticketId));
                if(!reserved&&!migrated&&!claimed){fail("Abyss recorded claim schema");}
            }
        }
        if(Object.entries(run.rewardClaims).some(([id,claim])=>{
            const permanent=run.firstClearClaims[id];
            // Client records the two reservations with separate Date.now()
            // calls. Preserve both original times; never complete either one.
            return !(claim.status==="granting"&&permanent?.status==="granting")&&
                snapshotDigest(claim)!==snapshotDigest(permanent??null);
        })){
            fail("Abyss permanent claim evidence missing or contradictory");
        }
    }
    if(snapshotDigest(state)!==snapshotDigest(progress.abyssProgress)){
        fail("Abyss main-save and sidecar disagree");
    }
}

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
        if(records.progress.playableState!==undefined){
            inspectPlayableCharacterState(character.state);
            inspectSkillLoadout(character.skillLoadout);
        }
        seenCharacters.add(character.characterId);
    }
    const formation=records.account.formation;
    if(records.progress.playableState!==undefined){inspectPlayableFormation(formation,slots);}
    if(formation?.version===2){
        try{require("./team-formation-policy").validate(formation,slots.flatMap((id,index)=>id===null?[]:[index]),
            Object.keys(records.progress.playableState.heroAccount.heroes).filter(id=>records.progress.playableState.heroAccount.heroes[id].unlocked));}
        catch(_){fail("formation reference");}
    }else if(formation!=null){
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
    if(records.progress.playableState!==undefined){
        inspectAchievementState(records.progress.achievementState);
        inspectGameplayProgress(records.progress.gameplayProgress,provenance==="server-created");
        for(const key of ["dailyQuestState","commissionQuestState"]){
            inspectQuestState(key,records.progress[key],provenance==="server-created");
        }
    }
    for(const [key,entry] of Object.entries(records.progress.sidecars)){
        if(!object(entry)||!(entry.status==="present"&&typeof entry.raw==="string"||
             entry.status==="missing"&&entry.raw===null||
             provenance==="server-created"&&entry.status==="not-applicable"&&entry.raw===null)||
           CLAIM_SIDECARS.has(key)&&provenance!=="server-created"&&entry.status!=="present"){
            fail("claim-bearing sidecar missing or invalid");
        }
        // Preserve historical v1 archive compatibility. Durable playable
        // sources are newer; complete projection always validates below.
        if(records.progress.playableState!==undefined&&entry.status==="present"){
            inspectTimeSidecar(key,entry.raw);
            inspectClaimSidecar(key,entry.raw);
            inspectAbyssSidecar(key,entry.raw,records.progress);
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
    inspectPlayableFormation(source.snapshot.formation,source.snapshot.slots);
    inspectAchievementState(source.snapshot.progress.achievementState);
    const configKeys=["autoConfig","autoConfig2","autoConfig3"];
    const slotKeys=["fire","player2","player3"];
    const characterEquipment={},characterSkillLoadouts={};
    const players=[null,null,null];
    for(const character of source.snapshot.characters){
        const state=character.state;
        inspectPlayableCharacterState(state);
        players[character.slotIndex]=copy(state);
        const key=slotKeys[character.slotIndex];
        characterEquipment[key]=Object.fromEntries([...EQUIPMENT_SLOTS].map(slot=>[slot,null]));
        inspectSkillLoadout(character.skillLoadout);
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
    const deviceOnly=new Set(["announcement-read","bulk-sell-quality","patrol-character-index","task-tracker"]);
    const sidecars=copy(source.snapshot.progress.sidecars);
    for(const [key,entry] of Object.entries(sidecars)){
        if(deviceOnly.has(key)){continue;}
        if(entry.status!=="present"){ fail(`playable sidecar missing: ${key}`); }
        let parsed;
        try{parsed=JSON.parse(entry.raw);}catch(_){fail(`playable sidecar JSON: ${key}`);}
        if(!object(parsed)){fail(`playable sidecar structure: ${key}`);}
        validateJsonValue(parsed,`sidecar ${key}`,0);
        inspectTimeSidecar(key,entry.raw);
        inspectClaimSidecar(key,entry.raw);
        inspectAbyssSidecar(key,entry.raw,source.snapshot.progress);
    }
    for(const key of ["dailyQuestState","commissionQuestState"]){
        inspectQuestState(key,source.snapshot.progress[key]);
    }
    inspectGameplayProgress(source.snapshot.progress.gameplayProgress);
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
    claimRecordsDigest,snapshotDigest,MAX_SNAPSHOT_BYTES};
