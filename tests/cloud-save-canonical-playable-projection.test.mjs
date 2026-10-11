import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {readFileSync} from "node:fs";
import test from "node:test";
const require=createRequire(import.meta.url);
const {assembleCanonicalSnapshot,assembleCanonicalPlayableProjection,
    verifyCanonicalPlayableProjectionAgainstSources,claimRecordsDigest}=require("../functions/src/canonical-snapshot.js");
const {LEGACY_BACKUP_SIDECARS,ALLOWED_SAVE_KEYS}=require("../functions/src/cloud-save-policy.js");
const {normalizeAccountState}=require("../functions/src/hero-core.js");
const {makeInitialSidecars}=require("../functions/src/initial-character-sources.js");

function sources(count=1){
    const base={schemaVersion:1,ownerUid:"uid-a",serverRevision:7,provenance:"grandfathered-unverified-history"};
    const slots=["char-a",count>1?"char-b":null,count>2?"char-c":null];
    const characters=slots.flatMap((id,slotIndex)=>id?[{...base,characterId:id,slotIndex,
        displayName:`hero-${slotIndex}`,element:"water",state:{id:`hero-${slotIndex}`,element:"water",
            gender:"female",level:3,exp:10,expNext:100,skillPoints:1,attributePoints:2,
            attack:1,intelligence:2,vitality:3,energy:4,defensePoints:5,agility:6,
            bonusHP:0,bonusSP:0,hp:250,sp:80,activeBuffs:[],statusEffects:[],isDefending:false},
        skillLoadout:{skillLevels:{waterSlash:2},equippedSkills:["waterSlash"]}}]:[]);
    const claimRecords=[{...base,claimKey:"historical:all",status:"blocked"}];
    const auto={enabled:false,skill:"waterSlash",hp:30,sp:20,returnToCityWhenEmpty:true};
    return {account:{...base,slots,formation:{version:1,characterIndexToSlot:{0:"ALLY_F2"}}},characters,
        economy:{...base,gold:42,sharedExp:7},inventory:[
            {...base,ownedItemId:"bag-a",location:"bag",state:{id:"potion",count:2}},
            {...base,ownedItemId:"equip-a",location:"equipped",state:{id:"sword",type:"weapon",count:1}}],
        equipment:[{...base,characterId:"char-a",slot:"hand",ownedItemId:"equip-a"}],
        relics:[{...base,relicId:"relic-a",unlocked:true,level:2,exp:3,seen:true}],
        relicLoadout:{...base,relicId:"relic-a",subRelicId:null},
        progress:{...base,dailyQuestState:{claimed:true},commissionQuestState:{},achievementState:{},
            gameplayProgress:{},abyssProgress:JSON.parse(makeInitialSidecars(1700000000000)["abyss-state"].raw),
            sidecars:Object.fromEntries(LEGACY_BACKUP_SIDECARS.map(key=>
                [key,makeInitialSidecars(1700000000000)[key].status==="present"?
                    makeInitialSidecars(1700000000000)[key]:
                    {status:"present",raw:JSON.stringify(key==="daily-dungeon-state"?
                        {date:"2020-02-29",used:{exp:true,material:false,equipment:true}}:
                        key==="equipment-shop-daily"?
                        {date:"2020-02-29",refreshCount:2,soldOfferIds:["2020-02-29:0:5","2020-02-29:2:0"]}:
                        key==="legacy-abyss-state"?
                        {active:true,floor:3,phase:"portal",x:50,y:84,message:"寶箱已開啟",clears:2,rewardVersion:1}:
                        {marker:key})}]))},
        claimRecords,claimCheckpoint:{...base,claimCount:1,claimDigest:claimRecordsDigest(claimRecords),historicalClaimsBlocked:true},
        playableState:{...base,heroAccount:normalizeAccountState(null),bestiaryData:{slime:{seen:true,kills:9}},
            autoConfig:{...auto},autoConfig2:{...auto},autoConfig3:{...auto},
            selectedCreationElement:"water",lastSaveTimestamp:1700000000000}};
}
const assemble=records=>assembleCanonicalPlayableProjection("uid-a",7,records);

test("legacy Abyss preservation rejects lossy or ambiguous evidence without migration",()=>{
    const mutations=[s=>delete s.rewardVersion,s=>s.rewardVersion=0,s=>s.rewardVersion=2,
        s=>s.rewardVersion="1",s=>s.active=1,s=>s.floor=0,s=>s.floor=6,s=>s.floor=1.5,
        s=>s.floor="3",s=>s.phase="ready",s=>s.x=3,s=>s.x=97,s=>s.x="50",
        s=>s.y=7,s=>s.y=95,s=>s.message=null,s=>s.clears=-1,s=>s.clears=0.5,
        s=>s.clears=Number.MAX_SAFE_INTEGER+1,s=>s.extra=true];
    const initial=JSON.parse(sources().progress.sidecars["legacy-abyss-state"].raw);
    for(const change of mutations){
        const state=structuredClone(initial);change(state);
        for(const durable of [false,true]){
            const records=sources();records.progress.sidecars["legacy-abyss-state"].raw=JSON.stringify(state);
            if(durable){const {schemaVersion,ownerUid,serverRevision,provenance,...fields}=records.playableState;
                records.progress.playableState=fields;delete records.playableState;}
            const before=structuredClone(records);
            assert.throws(()=>assemble(records),/legacy Abyss|claim sidecar fields/);
            if(durable){assert.throws(()=>assembleCanonicalSnapshot("uid-a",7,records),/legacy Abyss|claim sidecar fields/);}
            assert.deepEqual(records,before);
        }
    }
});

test("legacy Abyss recorded phases and bytes survive snapshots and recovery archives without claims",()=>{
    const {createRecoveryArchive,inspectRecoveryArchive}=require("../functions/src/canonical-recovery-archive.js");
    for(const phase of ["boss","chest","portal","complete"]){
        const records=sources(),state=JSON.parse(records.progress.sidecars["legacy-abyss-state"].raw);
        Object.assign(state,{phase,floor:5,x:4,y:94,clears:7});
        const raw=" \n"+JSON.stringify(state)+" \n";
        records.progress.sidecars["legacy-abyss-state"].raw=raw;
        const {schemaVersion,ownerUid,serverRevision,provenance,...fields}=records.playableState;
        records.progress.playableState=fields;delete records.playableState;
        const before=structuredClone(records),snapshot=assembleCanonicalSnapshot("uid-a",7,records),bundle=assemble(records);
        const archive=JSON.parse(JSON.stringify(createRecoveryArchive("uid-a",7,records,snapshot)));
        const restored=inspectRecoveryArchive(archive,"uid-a",7,snapshot);
        assert.equal(restored.progress.sidecars["legacy-abyss-state"].raw,raw);
        assert.equal(bundle.projection.sidecars["legacy-abyss-state"].raw,raw);
        assert.deepEqual(restored.claimRecords,records.claimRecords);
        assert.deepEqual(bundle.projection.gameSave.abyssProgress,records.progress.abyssProgress);
        assert.deepEqual(bundle.projection.gameSave.gold,records.economy.gold);
        assert.equal(archive.readyForRestore,false);assert.equal(bundle.readyForPublication,false);
        assert.equal(bundle.projection.authoritativeStateReady,false);
        const changed=structuredClone(records);state.phase=phase==="portal"?"chest":"portal";
        changed.progress.sidecars["legacy-abyss-state"].raw=JSON.stringify(state);
        assert.notEqual(assemble(changed).sha256,bundle.sha256);
        assert.throws(()=>verifyCanonicalPlayableProjectionAgainstSources(bundle,"uid-a",7,changed),/differs/);
        const tampered=structuredClone(archive);tampered.sourceRecords.progress.sidecars["legacy-abyss-state"].raw="{}";
        assert.throws(()=>inspectRecoveryArchive(tampered,"uid-a",7,snapshot),/digest/);
        assert.deepEqual(records,before);
    }
});

test("ambiguous historical legacy Abyss v1 bytes remain compatible but cannot become complete evidence",()=>{
    for(const raw of [' {"phase":"portal","floor":2} ',' {"phase":"portal","rewardVersion":0} ']){
        const records=sources();records.progress.sidecars["legacy-abyss-state"].raw=raw;
        const before=structuredClone(records),bundle=assembleCanonicalSnapshot("uid-a",7,records);
        assert.equal(bundle.snapshot.progress.sidecars["legacy-abyss-state"].raw,raw);
        assert.equal(assembleCanonicalSnapshot("uid-a",7,JSON.parse(JSON.stringify(records))).sha256,bundle.sha256);
        assert.throws(()=>assemble(records),/legacy Abyss|claim sidecar fields/);
        assert.deepEqual(records,before);
    }
});

test("complete projection covers current save fields, slots, owned equipment and sidecar bytes without mutation",()=>{
    for(const count of [1,2,3]){
        const records=sources(count),before=structuredClone(records),bundle=assemble(records);
        const restored=JSON.parse(JSON.stringify(bundle.projection));
        assert.deepEqual(Object.keys(restored.gameSave).sort(),[...ALLOWED_SAVE_KEYS].sort());
        for(let index=0;index<3;index++){
            assert.deepEqual(restored.gameSave[["player","player2","player3"][index]],records.characters[index]?.state??null);
        }
        assert.deepEqual(restored.gameSave.heroAccount,records.playableState.heroAccount);
        assert.deepEqual(restored.gameSave.bestiaryData,{slime:{seen:true,kills:9}});
        assert.deepEqual(restored.sidecars,records.progress.sidecars);
        assert.deepEqual(restored.claimCheckpoint,records.claimCheckpoint);
        assert.equal(restored.gameSave.characterEquipment.fire.hand.v141Uid,"equip-a");
        assert.equal(restored.gameSave.inventoryItems.length,1);
        assert.equal(restored.gameSave.inventoryItems[0].v141Uid,"bag-a");
        assert.equal(restored.gameSave.characterEquipment.water,undefined);
        assert.deepEqual(restored.gameSave.playerRelics["relic-a"],{unlocked:true,level:2,exp:3,seen:true});
        assert.equal(restored.authoritativeStateReady,false);
        assert.equal(bundle.readyForPublication,false);
        assert.equal(bundle.byteLength,Buffer.byteLength(JSON.stringify(restored)));
        assert.deepEqual(records,before);
        records.playableState.bestiaryData.slime.kills=99;
        assert.equal(restored.gameSave.bestiaryData.slime.kills,9);
    }
});
test("new digest binds previously omitted fields while v1 receipt hash stays stable",()=>{
    const records=sources(),old=assembleCanonicalSnapshot("uid-a",7,records).sha256,initial=assemble(records).sha256;
    for(const change of [r=>r.playableState.heroAccount.heroes.divineDogHongbao.specificFragments++,
        r=>r.playableState.bestiaryData.slime.kills++,r=>r.playableState.autoConfig.hp++,
        r=>r.playableState.lastSaveTimestamp++]){
        const changed=structuredClone(records);change(changed);
        assert.equal(assembleCanonicalSnapshot("uid-a",7,changed).sha256,old);
        assert.notEqual(assemble(changed).sha256,initial);
    }
    const reordered=structuredClone(records);
    reordered.playableState=Object.fromEntries(Object.entries(reordered.playableState).reverse());
    assert.equal(assemble(reordered).sha256,initial);
});
test("incomplete, foreign and corrupt sources block without filling defaults",()=>{
    const changes=[r=>delete r.playableState,r=>r.playableState.ownerUid="other",
        r=>r.playableState.serverRevision++,r=>r.playableState.provenance="server-created",
        r=>r.playableState.heroAccount=null,r=>delete r.playableState.heroAccount.heroes.divineDogHongbao,
        r=>r.playableState.heroAccount.extra=true,r=>r.characters[0].state.attack=NaN,
        r=>delete r.characters[0].state.hp,r=>delete r.relics[0].seen,
        r=>r.playableState.autoConfig.hp=101,r=>r.playableState.bestiaryData.bad=Infinity,
        r=>r.playableState.selectedCreationElement="unknown",r=>r.playableState.lastSaveTimestamp=0,
        r=>r.playableState.extra=true,r=>r.inventory[0].ownerUid="other"];
    for(const change of changes){const r=sources();change(r);assert.throws(()=>assemble(r));}
    for(const field of ["attack","intelligence","vitality","energy","defensePoints","agility",
        "expNext","skillPoints","attributePoints","bonusHP","bonusSP","gender","sp","activeBuffs","statusEffects","isDefending"]){
        const r=sources();delete r.characters[0].state[field];assert.throws(()=>assemble(r),field);
    }
});
test("registry gameplay sidecars are mandatory, device preferences retain explicit missing state",()=>{
    const registry=JSON.parse(readFileSync(new URL("../config/persisted-state-registry.json",import.meta.url))).states;
    for(const key of LEGACY_BACKUP_SIDECARS){
        const entry=registry.find(row=>row.key===`four_symbols_account:<UID>:${key}`);
        assert.ok(entry,key);
        const r=sources();r.progress.sidecars[key]={status:"missing",raw:null};
        if(entry.gameplayCritical){assert.throws(()=>assemble(r),key);}
        else{assert.deepEqual(assemble(r).projection.sidecars[key],{status:"missing",raw:null});}
    }
    const r=sources();r.progress.sidecars["element-box-state"].raw="null";assert.throws(()=>assemble(r));
});
test("projection rejects oversized and non-JSON payloads before serialization can discard them",()=>{
    const r=sources();r.playableState.bestiaryData.bad=undefined;assert.throws(()=>assemble(r));
    const large=sources();large.playableState.bestiaryData=Object.fromEntries(
        Array.from({length:20},(_,i)=>[i,"x".repeat(60000)]));assert.throws(()=>assemble(large));
    const expanded=sources();
    for(const [key,entry] of Object.entries(expanded.progress.sidecars)){
        if(makeInitialSidecars(1)[key].status!=="present"){
            entry.raw=["daily-dungeon-state","equipment-shop-daily","legacy-abyss-state"].includes(key)?
                entry.raw+" ".repeat(62000):JSON.stringify({data:"x".repeat(62000)});
        }
    }
    expanded.playableState.bestiaryData=Object.fromEntries(Array.from({length:1999},(_,index)=>
        [`monster-${index}-${"x".repeat(110)}`,{seen:true,kills:1}]));
    assert.ok(assembleCanonicalSnapshot("uid-a",7,expanded).byteLength<750*1024);
    assert.throws(()=>assemble(expanded),/playable projection exceeds internal size budget/);
});

test("time sidecars reject lossy values and contradictory recorded state without accrual",()=>{
    const mutations={
        "element-box-state":[s=>s.remainingMs=-1,s=>s.remainingMs=0.5,
            s=>s.remainingMs=32*60*60*1000+1,s=>s.remainingMs="0",s=>s.extra=true],
        "rested-exp-state":[s=>s.battles=301,s=>s.battles=-1,s=>s.progressMs=120000,
            s=>s.progressMs=0.5,s=>s.lastSeenAt=0,s=>s.blockedByElementBox=1,
            s=>{s.battles=300;s.progressMs=1;}],
        "exp-pool-growth-state":[s=>s.lastAt=-1,s=>s.lastAt=0.5,s=>s.lastAt=0,
            s=>s.unlocked=1,s=>s.newcomerRewards={quest:false},
            s=>s.newcomerRewards={"":true},s=>s.newcomerRewards=[],
            s=>s.noticeShown=true,s=>s.lastCapped=true,s=>s.initialized=false]
    };
    for(const [key,changes] of Object.entries(mutations)){
        for(const change of changes){
            const r=sources(),state=JSON.parse(r.progress.sidecars[key].raw);
            change(state);r.progress.sidecars[key].raw=JSON.stringify(state);
            assert.throws(()=>assemble(r),undefined,key);
            const {schemaVersion,ownerUid,serverRevision,provenance,...fields}=r.playableState;
            r.progress.playableState=fields;delete r.playableState;
            assert.throws(()=>assembleCanonicalSnapshot("uid-a",7,r),undefined,key);
        }
        const r=sources();r.progress.sidecars[key].raw="{}";
        assert.throws(()=>assemble(r),/time sidecar fields/);
        r.progress.sidecars[key].raw="{";
        assert.throws(()=>assemble(r),new RegExp(`playable sidecar JSON: ${key}`));
    }
    const r=sources();
    r.progress.sidecars["element-box-state"].raw='{"remainingMs":115200000}';
    r.progress.sidecars["rested-exp-state"].raw=JSON.stringify({battles:300,progressMs:0,
        lastSeenAt:1700000000000,blockedByElementBox:true});
    r.progress.sidecars["exp-pool-growth-state"].raw=JSON.stringify({initialized:true,
        unlocked:true,lastAt:1700000000000,noticeShown:true,lastCapped:true,newcomerRewards:{quest:true}});
    const before=structuredClone(r),projection=assemble(r).projection;
    assert.deepEqual(projection.sidecars,r.progress.sidecars);
    assert.deepEqual(r,before);
    assert.equal(projection.gameSave.sharedExp,7);
    assert.equal(projection.authoritativeStateReady,false);
});

test("historical v1 time bytes stay unchanged but cannot become complete playable evidence",()=>{
    const r=sources();
    for(const key of ["element-box-state","exp-pool-growth-state","rested-exp-state"]){
        r.progress.sidecars[key]={status:"present",raw:"{}"};
    }
    const before=structuredClone(r),bundle=assembleCanonicalSnapshot("uid-a",7,r);
    assert.deepEqual(bundle.snapshot.progress.sidecars,r.progress.sidecars);
    assert.equal(assembleCanonicalSnapshot("uid-a",7,r).sha256,bundle.sha256);
    assert.throws(()=>assemble(r),/time sidecar fields/);
    assert.deepEqual(r,before);
});
test("recorded claim sidecars reject missing, lossy and unknown claim fields",()=>{
    const badProgress=[{}, {eliteKills:-1,dungeonWins:0,abyssClears:0},
        {eliteKills:0.5,dungeonWins:0,abyssClears:0},
        {eliteKills:"0",dungeonWins:0,abyssClears:0},
        {eliteKills:0,dungeonWins:Number.MAX_SAFE_INTEGER+1,abyssClears:0},
        {eliteKills:0,dungeonWins:0,abyssClears:0,rewardClaimed:true}];
    const valid={date:"2024-02-29",daily:{20:true},commission:{100:true}};
    const badMilestones=[{}, {...valid,date:"2023-02-29"}, {...valid,date:"2024-02-30"},
        {...valid,date:"2024-13-01"}, {...valid,date:"2024-2-29"},
        {...valid,daily:{20:false}}, {...valid,daily:{20:1}},
        {...valid,commission:{25:true}}, {...valid,daily:[]}, {...valid,extra:true}];
    for(const [key,values] of [["progress",badProgress],["quest-milestones",badMilestones]]){
        for(const value of values){
            const r=sources();r.progress.sidecars[key].raw=JSON.stringify(value);
            assert.throws(()=>assemble(r),undefined,key);
            const {schemaVersion,ownerUid,serverRevision,provenance,...fields}=r.playableState;
            r.progress.playableState=fields;delete r.playableState;
            assert.throws(()=>assembleCanonicalSnapshot("uid-a",7,r),undefined,key);
        }
    }
});

test("older recorded milestone claims survive projection without day rollover or rewards",()=>{
    const r=sources();
    r.progress.sidecars.progress.raw=' {"eliteKills":4,"dungeonWins":2,"abyssClears":1} ';
    r.progress.sidecars["quest-milestones"].raw=' {"date":"2020-02-29","daily":{"20":true,"100":true},"commission":{"40":true}} ';
    const before=structuredClone(r),bundle=assemble(r);
    assert.deepEqual(bundle.projection.sidecars,r.progress.sidecars);
    assert.deepEqual(bundle.projection.claimCheckpoint,r.claimCheckpoint);
    assert.equal(bundle.projection.gameSave.gold,42);
    assert.equal(bundle.projection.gameSave.sharedExp,7);
    assert.equal(bundle.readyForPublication,false);
    assert.deepEqual(r,before);
    const changed=structuredClone(r);
    changed.progress.sidecars["quest-milestones"].raw=JSON.stringify({date:"2020-02-29",daily:{20:true},commission:{40:true}});
    assert.notEqual(assemble(changed).sha256,bundle.sha256);
    assert.throws(()=>verifyCanonicalPlayableProjectionAgainstSources(bundle,"uid-a",7,changed));
});

test("historical v1 claim bytes remain compatible but cannot be complete evidence",()=>{
    const r=sources();
    for(const key of ["progress","quest-milestones"]){r.progress.sidecars[key].raw="{}";}
    const before=structuredClone(r),bundle=assembleCanonicalSnapshot("uid-a",7,r);
    assert.deepEqual(bundle.snapshot.progress.sidecars,r.progress.sidecars);
    assert.equal(assembleCanonicalSnapshot("uid-a",7,r).sha256,bundle.sha256);
    assert.throws(()=>assemble(r),/claim sidecar fields/);
    assert.deepEqual(r,before);
});

test("Abyss invalid fields, claims and mismatched mirrors block without repair",()=>{
    const mutations=[a=>a.version=2,a=>a.selectedDifficulty=30,a=>a.legacyMigrated=1,
        a=>delete a.runs[40],a=>a.runs[20].difficulty=40,
        a=>a.runs[20].regionIndex=5,a=>a.runs[20].encounterIndex=.5,
        a=>a.runs[20].active="false",a=>a.runs[20].clears=-1,
        a=>a.runs[20].completedRegions=[false],a=>a.runs[20].x=100,
        a=>a.runs[20].phase="unknown",a=>a.runs[20].completedStages={"d40-r0-s0":true},
        a=>a.runs[20].firstClearClaims={"d20-r0-s0":{status:"claimed"}},
        a=>a.runs[20].firstClearClaims={"d20-r0-s0":{status:"granting",reservedAt:"1"}},
        a=>a.runs[20].firstClearClaims={"d20-r0-s0":{status:"claimed",migrated:false}},
        a=>a.runs[20].rewardClaims={"d20-r0-s0":{status:"claimed",migrated:true}},
        a=>{a.runs[20].rewardClaims={"d20-r0-s0":{status:"granting",reservedAt:1}};
            a.runs[20].firstClearClaims={"d20-r0-s0":{status:"claimed",migrated:true}};},
        a=>a.runs[20].extra=true];
    for(const mutate of mutations){
        const r=sources();mutate(r.progress.abyssProgress);
        r.progress.sidecars["abyss-state"].raw=JSON.stringify(r.progress.abyssProgress);
        const before=structuredClone(r);assert.throws(()=>assemble(r),/Abyss/);
        assert.deepEqual(r,before);
        const {schemaVersion,ownerUid,serverRevision,provenance,...fields}=r.playableState;
        r.progress.playableState=fields;delete r.playableState;
        assert.throws(()=>assembleCanonicalSnapshot("uid-a",7,r),/Abyss/);
    }
    const r=sources();r.progress.abyssProgress.runs[40].clears=1;
    assert.throws(()=>assemble(r),/disagree/);
    const lossy=sources();lossy.progress.abyssProgress.extra=undefined;
    assert.throws(()=>assemble(lossy));
});

test("Abyss recorded first clears and reservations retain bytes without rewards",()=>{
    const r=sources(),run=r.progress.abyssProgress.runs[40];
    run.clears=2;
    const claimed={status:"claimed",kind:"emperor",gold:500,exp:0,ticketId:"ticketSetEarth",claimedAt:1};
    run.firstClearClaims={"d40-r0-s4":claimed,
        "d40-r1-s0":{status:"granting",reservedAt:2},
        "d40-r2-s4":{status:"claimed",migrated:true}};
    run.rewardClaims={"d40-r0-s4":{...claimed},
        "d40-r1-s0":{status:"granting",reservedAt:1}};
    r.progress.sidecars["abyss-state"].raw=" "+JSON.stringify(r.progress.abyssProgress)+" ";
    const before=structuredClone(r),bundle=assemble(r);
    assert.deepEqual(bundle.projection.gameSave.abyssProgress,r.progress.abyssProgress);
    assert.equal(bundle.projection.sidecars["abyss-state"].raw,r.progress.sidecars["abyss-state"].raw);
    assert.equal(bundle.projection.gameSave.gold,42);assert.equal(bundle.projection.gameSave.sharedExp,7);
    assert.deepEqual(bundle.projection.claimCheckpoint,r.claimCheckpoint);
    assert.equal(bundle.readyForPublication,false);assert.deepEqual(r,before);
    const changed=structuredClone(r);delete changed.progress.abyssProgress.runs[40].firstClearClaims["d40-r2-s4"];
    changed.progress.sidecars["abyss-state"].raw=JSON.stringify(changed.progress.abyssProgress);
    assert.throws(()=>verifyCanonicalPlayableProjectionAgainstSources(bundle,"uid-a",7,changed));
});

test("historical v1 Abyss bytes stay compatible but cannot become complete sources",()=>{
    const r=sources();r.progress.sidecars["abyss-state"].raw="{}";r.progress.abyssProgress={};
    const before=structuredClone(r),bundle=assembleCanonicalSnapshot("uid-a",7,r);
    assert.equal(bundle.snapshot.progress.sidecars["abyss-state"].raw,"{}");
    assert.equal(assembleCanonicalSnapshot("uid-a",7,r).sha256,bundle.sha256);
    assert.throws(()=>assemble(r),/Abyss root schema/);assert.deepEqual(r,before);
});

test("recorded dungeon and shop evidence rejects incomplete or contradictory periods without mutation",()=>{
    const mutations={
        "daily-dungeon-state":[s=>delete s.used,s=>delete s.used.exp,s=>s.used.exp=1,
            s=>s.used.material="false",s=>s.used.extra=false,s=>s.used=[],s=>s.extra=true],
        "equipment-shop-daily":[s=>delete s.soldOfferIds,s=>s.soldOfferIds=null,
            s=>s.refreshCount=-1,s=>s.refreshCount=11,s=>s.refreshCount=.5,s=>s.refreshCount="2",
            s=>s.soldOfferIds.push(s.soldOfferIds[0]),s=>s.soldOfferIds=[1],
            s=>s.soldOfferIds=["2020-03-01:0:0"],s=>s.soldOfferIds=["2020-02-29:3:0"],
            s=>s.soldOfferIds=["2020-02-29:0:6"],s=>s.soldOfferIds=["2020-02-29:00:0"],
            s=>s.soldOfferIds=["2020-02-29:-1:0"],s=>s.soldOfferIds=["2020-02-29:0:0:extra"],
            s=>s.extra=true]
    };
    for(const [key,changes] of Object.entries(mutations)){
        for(const change of [...changes,...["2023-02-29","2020-02-30","2020-13-01","2020-2-29",0].map(
            date=>s=>s.date=date)]){
            const r=sources(),state=JSON.parse(r.progress.sidecars[key].raw);
            change(state);r.progress.sidecars[key].raw=JSON.stringify(state);
            const before=structuredClone(r);assert.throws(()=>assemble(r),undefined,key);
            assert.deepEqual(r,before);
            const {schemaVersion,ownerUid,serverRevision,provenance,...fields}=r.playableState;
            r.progress.playableState=fields;delete r.playableState;
            const durableBefore=structuredClone(r);
            assert.throws(()=>assembleCanonicalSnapshot("uid-a",7,r),undefined,key);
            assert.deepEqual(r,durableBefore);
        }
    }
});

test("older dungeon usage and shop batches retain exact bytes, balances and closed readiness",()=>{
    const r=sources();
    for(const key of ["daily-dungeon-state","equipment-shop-daily"]){
        r.progress.sidecars[key].raw=" "+r.progress.sidecars[key].raw+" ";
    }
    const before=structuredClone(r),bundle=assemble(r);
    assert.deepEqual(bundle.projection.sidecars,r.progress.sidecars);
    assert.deepEqual(bundle.projection.claimCheckpoint,r.claimCheckpoint);
    assert.equal(bundle.projection.gameSave.gold,42);assert.equal(bundle.projection.gameSave.sharedExp,7);
    assert.equal(bundle.projection.gameSave.inventoryItems.length,1);
    assert.equal(bundle.readyForPublication,false);assert.equal(bundle.projection.authoritativeStateReady,false);
    assert.deepEqual(r,before);
    for(const key of ["daily-dungeon-state","equipment-shop-daily"]){
        const changed=structuredClone(r),state=JSON.parse(changed.progress.sidecars[key].raw);
        if(key==="daily-dungeon-state"){state.used.exp=false;}else{state.soldOfferIds.shift();}
        changed.progress.sidecars[key].raw=JSON.stringify(state);
        assert.notEqual(assemble(changed).sha256,bundle.sha256);
        assert.throws(()=>verifyCanonicalPlayableProjectionAgainstSources(bundle,"uid-a",7,changed));
    }
    const boundary=sources();
    boundary.progress.sidecars["equipment-shop-daily"].raw=JSON.stringify({date:"2020-02-29",
        refreshCount:10,soldOfferIds:Array.from({length:66},(_,i)=>`2020-02-29:${Math.floor(i/6)}:${i%6}`)});
    assert.doesNotThrow(()=>assemble(boundary));
    const initial=makeInitialSidecars(1700000000000);
    for(const key of ["daily-dungeon-state","equipment-shop-daily"]){
        assert.deepEqual(initial[key],{status:"not-applicable",raw:null});
    }
});

test("historical v1 period bytes remain compatible without inventing missing purchases",()=>{
    for(const [key,raw] of [["daily-dungeon-state","{}"],
        ["equipment-shop-daily",' {"date":"2020-02-29","refreshCount":2} ']]){
        const r=sources();r.progress.sidecars[key].raw=raw;
        const before=structuredClone(r),bundle=assembleCanonicalSnapshot("uid-a",7,r);
        assert.equal(bundle.snapshot.progress.sidecars[key].raw,raw);
        assert.equal(assembleCanonicalSnapshot("uid-a",7,r).sha256,bundle.sha256);
        assert.throws(()=>assemble(r),/claim sidecar fields/);assert.deepEqual(r,before);
    }
});

test("stored projection must match sources and cannot publish through tampered flags",()=>{
    const r=sources(),bundle=assemble(r);
    assert.deepEqual(verifyCanonicalPlayableProjectionAgainstSources(bundle,"uid-a",7,r),bundle.projection);
    for(const change of [b=>b.projection.gameSave.gold++,b=>b.projection.sidecars.progress.raw="{}",
        b=>b.projection.authoritativeStateReady=true,b=>b.readyForPublication=true,
        b=>b.byteLength++,b=>b.projection.ownerUid="other",b=>b.projection.sourceServerRevision++]){
        const b=structuredClone(bundle);change(b);
        assert.throws(()=>verifyCanonicalPlayableProjectionAgainstSources(b,"uid-a",7,r));
    }
    r.playableState.bestiaryData.slime.kills++;
    assert.throws(()=>verifyCanonicalPlayableProjectionAgainstSources(bundle,"uid-a",7,r));
});

test("bestiary observations reject lossy, negative, fractional and contradictory kill history",()=>{
    for(const row of [9,{}, {seen:true,kills:-1},{seen:true,kills:1.5},
        {seen:false,kills:1},{seen:1,kills:0},{seen:true,kills:Number.MAX_SAFE_INTEGER+1},
        {seen:true,kills:0,rewardClaimed:false}]){
        const r=sources();r.playableState.bestiaryData.slime=row;
        assert.throws(()=>assemble(r),/bestiary/);
    }
    const r=sources();r.playableState.bestiaryData={"":{seen:true,kills:0}};
    assert.throws(()=>assemble(r),/bestiary/);
    r.playableState.bestiaryData={slime:{seen:false,kills:0}};
    assert.deepEqual(assemble(r).projection.gameSave.bestiaryData,r.playableState.bestiaryData);
});

test("durable playable fields use the progress revision and reject duplicate source owners",()=>{
    const r=sources();
    const {schemaVersion,ownerUid,serverRevision,provenance,...fields}=r.playableState;
    r.progress.playableState=fields;delete r.playableState;
    const original=assemble(r);
    assert.deepEqual(original.projection.gameSave.heroAccount,fields.heroAccount);
    const changed=structuredClone(r);changed.progress.playableState.bestiaryData.slime.kills++;
    assert.notEqual(assemble(changed).sha256,original.sha256);
    assert.notEqual(assembleCanonicalSnapshot("uid-a",7,changed).sha256,
        assembleCanonicalSnapshot("uid-a",7,r).sha256);
    r.playableState={schemaVersion,ownerUid,serverRevision,provenance,...fields};
    assert.throws(()=>assemble(r),/duplicate source/);
    delete r.playableState;
    r.progress.playableState.ownerUid="other";
    assert.throws(()=>assembleCanonicalSnapshot("uid-a",7,r),/durable playable fields/);
    delete r.progress.playableState.ownerUid;
    r.progress.playableState.bestiaryData.slime.kills=-1;
    assert.throws(()=>assembleCanonicalSnapshot("uid-a",7,r),/bestiary/);
});
test("existing initial-character sources stay unpublished and cannot substitute missing playable domains",()=>{
    const {makeInitialCharacterSources}=require("../functions/src/initial-character-sources.js");
    const r=makeInitialCharacterSources("uid-a",7,"create-a",{displayName:"new hero",element:"water",gender:"female",
        attributes:{attack:1,intelligence:2,vitality:3,energy:4,defensePoints:0,agility:0}});
    assert.equal(assembleCanonicalSnapshot("uid-a",7,r).readyForPublication,false);
    assert.throws(()=>assemble(r));
    r.playableState={...sources().playableState,provenance:"server-created"};
    assert.throws(()=>assemble(r),/sidecar missing/);
    const bad=sources();bad.progress.sidecars["element-box-state"].raw='{"constructor":{}}';
    assert.throws(()=>assemble(bad));
});
