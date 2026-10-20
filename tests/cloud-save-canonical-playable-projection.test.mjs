import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {readFileSync} from "node:fs";
import test from "node:test";
import vm from "node:vm";
const require=createRequire(import.meta.url);
const {assembleCanonicalSnapshot,assembleCanonicalPlayableProjection,
    verifyCanonicalPlayableProjectionAgainstSources,claimRecordsDigest}=require("../functions/src/canonical-snapshot.js");
const {LEGACY_BACKUP_SIDECARS,ALLOWED_SAVE_KEYS}=require("../functions/src/cloud-save-policy.js");
const {normalizeAccountState}=require("../functions/src/hero-core.js");
const {makeInitialSidecars}=require("../functions/src/initial-character-sources.js");

// Storage parity uses the actual Client Owner, without starting a battle.
const gameplayClient={console,setTimeout:()=>0,clearTimeout:()=>{},saveGame:()=>{},
    FourSymbolsAccountSave:{getActiveUid:()=>"fixture",saveKey:()=>"fixture",
        readForUid:()=>({status:"missing"})}};
gameplayClient.window=gameplayClient;
vm.runInNewContext(readFileSync(new URL("../js/gameplay-boss-tower-system.js",import.meta.url),"utf8"),
    gameplayClient);
const recordedGameplay=()=>JSON.parse(JSON.stringify(
    gameplayClient.GameplaySystem.normalizeState(null,Date.UTC(2020,1,24))));

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
    return {account:{...base,slots,formation:{version:1,characterIndexToSlot:Object.fromEntries(slots.flatMap((id,index)=>id===null?[]:[[index,["ALLY_F2","ALLY_B1","ALLY_F3"][index]]]))}},characters,
        economy:{...base,gold:42,sharedExp:7},inventory:[
            {...base,ownedItemId:"bag-a",location:"bag",state:{id:"potion",count:2}},
            {...base,ownedItemId:"equip-a",location:"equipped",state:{id:"sword",type:"weapon",count:1}}],
        equipment:[{...base,characterId:"char-a",slot:"hand",ownedItemId:"equip-a"}],
        relics:[{...base,relicId:"relic-a",unlocked:true,level:2,exp:3,seen:true}],
        relicLoadout:{...base,relicId:"relic-a",subRelicId:null},
        progress:{...base,dailyQuestState:{date:"2020-02-29",progress:{checkin:1,killMonsters:4,winBattle:2},
            claimed:{checkin:true,killMonsters:false,winBattle:false}},
            commissionQuestState:{date:"2020-02-29",progress:{killMonsters:6,winBattle:3},
            claimed:{killMonsters:false,winBattle:true}},achievementState:{},
            gameplayProgress:recordedGameplay(),abyssProgress:JSON.parse(makeInitialSidecars(1700000000000)["abyss-state"].raw),
            sidecars:Object.fromEntries(LEGACY_BACKUP_SIDECARS.map(key=>
                [key,!["legacy-abyss-state","daily-dungeon-state","equipment-shop-daily"].includes(key)&&makeInitialSidecars(1700000000000)[key].status==="present"?
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

test("canonical preference v1 retains original343 snapshot/projection bytes and strict errors",()=>{
    // Independently compiled original343 canonical reader produced these values
    // using this unchanged original fixture; v2 does not rewrite the v1 path.
    const r=sources(),bundle=assemble(r);
    assert.equal(assembleCanonicalSnapshot("uid-a",7,r).sha256,"f894593e082ed1b88c7bce12c35e55b7391a1054474a1739293f4720f3ee932f");
    assert.equal(bundle.sha256,"8d54c9734c1d40063eeaa24260ed6ad14cce145c61607a22322d47a6a3153795");
    assert.equal(bundle.byteLength,6691);
    for(const field of ["v136ActionIntent","v136LastSkill"]){
        const changed=sources();changed.playableState.autoConfig[field]="skill";
        const before=JSON.stringify(changed);
        assert.throws(()=>assemble(changed),error=>error.message==="autoConfig has invalid preference fields."&&error.code==="invalid-argument");
        assert.equal(JSON.stringify(changed),before);
    }
});

test("canonical v2 independently preserves each v136 presence through projection and archive",()=>{
    const {createRecoveryArchive,inspectRecoveryArchive}=require("../functions/src/canonical-recovery-archive.js");
    const {normalizePreferences}=require("../functions/src/cloud-preferences.js");
    for(const optional of [{},{v136ActionIntent:"normal"},{v136ActionIntent:"defend"},
        {v136ActionIntent:"skill"},{v136LastSkill:"waterSlash"},
        {v136ActionIntent:"normal",v136LastSkill:"waterSlash"}]){
        const r=sources(),{schemaVersion,ownerUid,serverRevision,provenance,...fields}=r.playableState;
        r.progress.playableState={...fields,preferencesVersion:2};delete r.playableState;
        Object.assign(r.progress.playableState.autoConfig,optional);
        const before=JSON.stringify(r),bundle=assemble(r),expected={...fields.autoConfig};
        assert.deepEqual(bundle.projection.gameSave.autoConfig,expected);
        for(const field of ["v136ActionIntent","v136LastSkill"])
            assert.equal(Object.hasOwn(bundle.projection.gameSave.autoConfig,field),Object.hasOwn(optional,field));
        const snapshot=assembleCanonicalSnapshot("uid-a",7,r);
        const archive=createRecoveryArchive("uid-a",7,r,snapshot),restored=inspectRecoveryArchive(archive,"uid-a",7,snapshot);
        assert.deepEqual(restored,r);assert.deepEqual(assemble(restored),bundle);
        assert.equal(bundle.readyForPublication,false);assert.equal(bundle.projection.authoritativeStateReady,false);
        assert.equal(JSON.stringify(r),before);
        if(Object.keys(optional).length)assert.throws(()=>normalizePreferences({characterIds:["char-a",null,null],
            ...Object.fromEntries(["autoConfig","autoConfig2","autoConfig3"].map(key=>[key,r.progress.playableState[key]]))}));
    }
});

test("canonical preferences reject unknown version, malformed presence and unknown fields without mutation",()=>{
    for(const change of [r=>r.preferencesVersion=1,r=>r.preferencesVersion="2",r=>r.preferencesVersion=3,
        r=>r.autoConfig.v136ActionIntent="unknown",r=>r.autoConfig.v136ActionIntent=null,
        r=>r.autoConfig.v136LastSkill=null,r=>r.autoConfig.v136LastSkill="waterSlash\n",
        r=>r.autoConfig.v136LastSkill=1,r=>r.autoConfig.extra=true,r=>r.extra=true,
        r=>delete r.autoConfig.hp]){
        const r=sources();r.playableState.preferencesVersion=2;change(r.playableState);
        const before=JSON.stringify(r);assert.throws(()=>assemble(r));assert.equal(JSON.stringify(r),before);
    }
});

// Actual server-created source evidence; no test-only period completion.
function newAccountSources(){
    const {makeInitialCharacterSources}=require("../functions/src/initial-character-sources.js");
    const records=makeInitialCharacterSources("uid-a",7,"create-reserved-history",{
        displayName:"new hero",element:"water",gender:"female",
        attributes:{attack:1,intelligence:2,vitality:3,energy:4,defensePoints:0,agility:0}
    },{recordedAt:1700000000000});
    return records;
}

test("server-created explicit inapplicable reserved history survives unpublished projection and archive",()=>{
    const {createRecoveryArchive,inspectRecoveryArchive}=require("../functions/src/canonical-recovery-archive.js");
    const records=newAccountSources(),before=structuredClone(records);
    const snapshot=assembleCanonicalSnapshot("uid-a",7,records),bundle=assemble(records);
    const key="equipment-shop-purchases",entry={status:"not-applicable",raw:null};
    assert.deepEqual(bundle.projection.sidecars[key],entry);
    assert.equal(bundle.readyForPublication,false);
    assert.equal(bundle.projection.authoritativeStateReady,false);
    assert.equal(bundle.projection.gameSave.gold,0);
    assert.deepEqual(bundle.projection.claimCheckpoint,records.claimCheckpoint);
    assert.equal(records.claimRecords.length,0);
    assert.equal(snapshot.readyForPublication,false);
    const archive=JSON.parse(JSON.stringify(createRecoveryArchive("uid-a",7,records,snapshot)));
    const restored=inspectRecoveryArchive(archive,"uid-a",7,snapshot);
    assert.deepEqual(restored,records);
    assert.deepEqual(assemble(restored),bundle);
    assert.equal(archive.readyForRestore,false);
    assert.deepEqual(verifyCanonicalPlayableProjectionAgainstSources(bundle,"uid-a",7,records),bundle.projection);
    const changed=structuredClone(records);
    changed.progress.sidecars[key]={status:"present",raw:' {"reserved":"retained"} '};
    assert.notEqual(assemble(changed).sha256,bundle.sha256);
    assert.throws(()=>verifyCanonicalPlayableProjectionAgainstSources(bundle,"uid-a",7,changed),/differs/);
    assert.equal(assembleCanonicalSnapshot("uid-a",7,records).sha256,snapshot.sha256);
    assert.deepEqual(records,before);
});

test("reserved-history exception never turns missing or corrupt source into an empty purchase record",()=>{
    const key="equipment-shop-purchases";
    for(const entry of [{status:"missing",raw:null},{status:"not-applicable",raw:"{}"},
        {status:"present",raw:null},{status:"present",raw:"corrupt"},
        {status:"present",raw:"[]"},{status:"present",raw:"null"}]){
        const records=newAccountSources();records.progress.sidecars[key]=entry;
        const before=structuredClone(records);
        assert.throws(()=>assemble(records),/sidecar/);
        assert.deepEqual(records,before);
    }
    for(const entry of [{status:"missing",raw:null},{status:"not-applicable",raw:null},
        {status:"present",raw:"corrupt"}]){
        const historical=sources();historical.progress.sidecars[key]=entry;
        const before=structuredClone(historical);
        assert.throws(()=>assemble(historical),/sidecar/);
        assert.deepEqual(historical,before);
    }
    const mixed=newAccountSources();mixed.account.provenance="grandfathered-unverified-history";
    assert.throws(()=>assemble(mixed),/provenance|revision/);
});

test("present reserved purchase bytes and blocked historical claims remain exact",()=>{
    const key="equipment-shop-purchases",raw=' \n{"legacyPurchase":"opaque-history","claimed":true} \n';
    for(const records of [sources(),newAccountSources()]){
        records.progress.sidecars[key]={status:"present",raw};
        const before=structuredClone(records),bundle=assemble(records);
        assert.equal(bundle.projection.sidecars[key].raw,raw);
        assert.deepEqual(bundle.projection.claimCheckpoint,records.claimCheckpoint);
        assert.equal(bundle.projection.claimCheckpoint.historicalClaimsBlocked,
            records.account.provenance==="grandfathered-unverified-history");
        assert.deepEqual(records,before);
    }
});

test("server-created provenance cannot exempt active gameplay sidecars or enable publication",()=>{
    for(const key of ["daily-dungeon-state","equipment-shop-daily","progress","quest-milestones",
        "legacy-abyss-state","abyss-state","element-box-state","exp-pool-growth-state","rested-exp-state"]){
        const records=newAccountSources();
        records.progress.sidecars[key]={status:"not-applicable",raw:null};
        assert.throws(()=>assemble(records),/playable sidecar missing/,key);
    }
});

test("task tracker preference cannot block complete evidence or stand in for real claims",()=>{
    const registry=JSON.parse(readFileSync(new URL("../config/persisted-state-registry.json",import.meta.url))).states;
    const row=registry.find(entry=>entry.key==="four_symbols_account:<UID>:task-tracker");
    assert.equal(row.scope,"uid");assert.equal(row.deviceOnly,true);assert.equal(row.backupRequired,true);
    for(const field of ["gameplayCritical","rewardCoupled","economyCoupled","claimCoupled",
        "cloudRequired","migrationRequired"]){assert.equal(row[field],false,field);}
    assert.equal(row.authorityTier,"C");
    const {createRecoveryArchive,inspectRecoveryArchive}=require("../functions/src/canonical-recovery-archive.js");
    for(const entry of [{status:"missing",raw:null},
        {status:"present",raw:' {"top":123.5,"collapsed":true} '},
        {status:"present",raw:"corrupt-ui-preference"}]){
        const records=sources();records.progress.sidecars["task-tracker"]=entry;
        const before=structuredClone(records),bundle=assemble(records);
        assert.deepEqual(bundle.projection.sidecars["task-tracker"],entry);
        assert.equal(bundle.readyForPublication,false);assert.equal(bundle.projection.authoritativeStateReady,false);
        const {schemaVersion,ownerUid,serverRevision,provenance,...fields}=records.playableState;
        records.progress.playableState=fields;delete records.playableState;
        const snapshot=assembleCanonicalSnapshot("uid-a",7,records);
        const archive=JSON.parse(JSON.stringify(createRecoveryArchive("uid-a",7,records,snapshot)));
        const restored=inspectRecoveryArchive(archive,"uid-a",7,snapshot);
        assert.deepEqual(restored.progress.sidecars["task-tracker"],entry);
        assert.deepEqual(restored.claimRecords,before.claimRecords);
        assert.equal(restored.claimCheckpoint.historicalClaimsBlocked,true);
        assert.equal(archive.readyForRestore,false);
        for(const key of ["daily-dungeon-state","progress","quest-milestones","legacy-abyss-state",
            "equipment-shop-daily","equipment-shop-purchases","abyss-state"]){
            const missing=structuredClone(records);missing.progress.sidecars[key]={status:"missing",raw:null};
            assert.throws(()=>assemble(missing),/claim-bearing sidecar missing/,key);
        }
        const changed=structuredClone(before);changed.progress.sidecars["task-tracker"]={status:"present",raw:"different-ui-bytes"};
        assert.notEqual(assemble(changed).sha256,bundle.sha256);
        assert.throws(()=>verifyCanonicalPlayableProjectionAgainstSources(bundle,"uid-a",7,changed),/differs/);
    }
});

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
        if(["legacy-abyss-state","daily-dungeon-state","equipment-shop-daily"].includes(key)||makeInitialSidecars(1)[key].status!=="present"){
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
            s=>s.refreshCount=-1,s=>s.refreshCount=Number.MAX_SAFE_INTEGER+1,s=>s.refreshCount=.5,s=>s.refreshCount="2",
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
        refreshCount:25,soldOfferIds:Array.from({length:156},(_,i)=>`2020-02-29:${Math.floor(i/6)}:${i%6}`)});
    assert.doesNotThrow(()=>assemble(boundary));
    const initial=makeInitialSidecars();
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

test("complete skill evidence rejects lossy levels, unknown fields and orphan or duplicate equipped references",()=>{
    const mutations=[
        l=>l.skillLevels.waterSlash=0,l=>l.skillLevels.waterSlash=-1,
        l=>l.skillLevels.waterSlash=1.5,l=>l.skillLevels.waterSlash="2",
        l=>l.skillLevels.waterSlash=11,l=>l.skillLevels["bad id"]=2,
        l=>l.equippedSkills=["missing"],l=>l.equippedSkills=["waterSlash","waterSlash"],
        l=>l.equippedSkills=[2],l=>l.extra=true,l=>l.name=4,l=>l.name=" ",
        l=>{l.skillLevels={a:1,b:1,c:1,d:1,e:1};l.equippedSkills=["a","b","c","d","e"];}
    ];
    for(const mutate of mutations){
        for(const durable of [false,true]){
            const records=sources(3);mutate(records.characters[2].skillLoadout);
            if(durable){const {schemaVersion,ownerUid,serverRevision,provenance,...fields}=records.playableState;
                records.progress.playableState=fields;delete records.playableState;}
            const before=structuredClone(records);
            assert.throws(()=>assemble(records),/skill loadout/);
            if(durable){assert.throws(()=>assembleCanonicalSnapshot("uid-a",7,records),/skill loadout/);}
            assert.deepEqual(records,before);
        }
    }
});
test("recorded skill levels and equipped order survive every slot and recovery without learning or defaults",()=>{
    const {createRecoveryArchive,inspectRecoveryArchive}=require("../functions/src/canonical-recovery-archive.js");
    for(const count of [1,2,3]){
        const records=sources(count);
        records.characters.forEach((c,i)=>c.skillLoadout={name:`retained-${i}`,
            skillLevels:{waterSlash:10,flameSlash:1,healSpell:5,waterEX:1},
            equippedSkills:["healSpell","flameSlash","waterSlash","waterEX"]});
        const {schemaVersion,ownerUid,serverRevision,provenance,...fields}=records.playableState;
        records.progress.playableState=fields;delete records.playableState;
        const before=structuredClone(records),snapshot=assembleCanonicalSnapshot("uid-a",7,records),bundle=assemble(records);
        const archive=createRecoveryArchive("uid-a",7,records,snapshot);
        const restored=inspectRecoveryArchive(archive,"uid-a",7,snapshot);
        for(let i=0;i<count;i++){
            const key=["fire","player2","player3"][i];
            assert.deepEqual(bundle.projection.gameSave.characterSkillLoadouts[key],records.characters[i].skillLoadout);
            assert.deepEqual(restored.characters[i].skillLoadout,records.characters[i].skillLoadout);
        }
        assert.equal(Object.keys(bundle.projection.gameSave.characterSkillLoadouts).length,count);
        assert.deepEqual(restored.claimRecords,records.claimRecords);
        assert.equal(bundle.readyForPublication,false);assert.equal(bundle.projection.authoritativeStateReady,false);
        assert.equal(archive.readyForRestore,false);assert.deepEqual(records,before);
        const changed=structuredClone(records);changed.characters[0].skillLoadout.equippedSkills.reverse();
        assert.notEqual(assemble(changed).sha256,bundle.sha256);
        assert.throws(()=>verifyCanonicalPlayableProjectionAgainstSources(bundle,"uid-a",7,changed),/differs/);
    }
});
test("historical v1 skill evidence retains its bytes but cannot become complete playable data",()=>{
    const records=sources();records.characters[0].skillLoadout.equippedSkills=["waterSlash","waterSlash"];
    const before=structuredClone(records),snapshot=assembleCanonicalSnapshot("uid-a",7,records);
    assert.deepEqual(snapshot.snapshot.characters[0].skillLoadout,records.characters[0].skillLoadout);
    assert.throws(()=>assemble(records),/skill loadout/);assert.deepEqual(records,before);
    records.characters[0].skillLoadout={skillLevels:{},equippedSkills:[]};
    assert.deepEqual(assemble(records).projection.gameSave.characterSkillLoadouts.fire,records.characters[0].skillLoadout);
});

test("durable character snapshots reject missing or lossy playable fields before archival",()=>{
    const mutations=[
        s=>delete s.attack,s=>s.intelligence=-1,s=>s.vitality=1.5,s=>s.energy="4",
        s=>delete s.defensePoints,s=>s.agility=null,s=>s.expNext=0,s=>delete s.expNext,
        s=>s.skillPoints=-1,s=>delete s.attributePoints,s=>s.bonusHP=0.5,
        s=>s.bonusSP="0",s=>delete s.gender,s=>s.gender="unknown",
        s=>delete s.hp,s=>s.hp=-1,s=>s.sp="80",s=>delete s.activeBuffs,
        s=>s.activeBuffs={},s=>delete s.statusEffects,s=>s.statusEffects={},
        s=>delete s.isDefending,s=>s.isDefending=1
    ];
    const {createRecoveryArchive}=require("../functions/src/canonical-recovery-archive.js");
    for(const mutate of mutations){
        for(const count of [1,2,3]){
            const records=sources(count);
            const {schemaVersion,ownerUid,serverRevision,provenance,...fields}=records.playableState;
            records.progress.playableState=fields;delete records.playableState;
            const oldBundle=assembleCanonicalSnapshot("uid-a",7,records);
            mutate(records.characters[count-1].state);
            const before=structuredClone(records);
            assert.throws(()=>assembleCanonicalSnapshot("uid-a",7,records),/complete character state/);
            assert.throws(()=>assemble(records),/complete character state/);
            assert.throws(()=>createRecoveryArchive("uid-a",7,records,oldBundle),/complete character state/);
            assert.deepEqual(records,before);
        }
    }
});
test("durable character state preserves recorded points, fractional HP/SP and transient arrays",()=>{
    const {createRecoveryArchive,inspectRecoveryArchive}=require("../functions/src/canonical-recovery-archive.js");
    for(const count of [1,2,3]){
        const records=sources(count);
        records.characters.forEach((c,i)=>Object.assign(c.state,{
            gender:i%2?"male":"female",hp:i===0?0:123.5,sp:i===0?0:45.25,
            skillPoints:0,attributePoints:0,bonusHP:3,bonusSP:7,
            activeBuffs:[{id:"recorded-buff",turns:2}],statusEffects:[{id:"recorded-status",turns:1}],
            isDefending:true}));
        const {schemaVersion,ownerUid,serverRevision,provenance,...fields}=records.playableState;
        records.progress.playableState=fields;delete records.playableState;
        const before=structuredClone(records),snapshot=assembleCanonicalSnapshot("uid-a",7,records);
        const bundle=assemble(records),archive=createRecoveryArchive("uid-a",7,records,snapshot);
        const restored=inspectRecoveryArchive(archive,"uid-a",7,snapshot);
        records.characters.forEach((c,i)=>{
            assert.deepEqual(snapshot.snapshot.characters[i].state,c.state);
            assert.deepEqual(bundle.projection.gameSave[["player","player2","player3"][i]],c.state);
            assert.deepEqual(restored.characters[i].state,c.state);
        });
        assert.deepEqual(records,before);assert.equal(archive.readyForRestore,false);
        assert.equal(snapshot.readyForPublication,false);assert.equal(bundle.projection.authoritativeStateReady,false);
        const changed=structuredClone(records);changed.characters[count-1].state.hp+=0.25;
        assert.notEqual(assembleCanonicalSnapshot("uid-a",7,changed).sha256,snapshot.sha256);
        assert.throws(()=>verifyCanonicalPlayableProjectionAgainstSources(bundle,"uid-a",7,changed),/differs/);
    }
});
test("historical incomplete character snapshots retain their bytes without becoming complete projection",()=>{
    const records=sources(3);delete records.characters[2].state.hp;
    const before=structuredClone(records),snapshot=assembleCanonicalSnapshot("uid-a",7,records);
    const {createRecoveryArchive,inspectRecoveryArchive}=require("../functions/src/canonical-recovery-archive.js");
    const archive=createRecoveryArchive("uid-a",7,records,snapshot);
    assert.deepEqual(inspectRecoveryArchive(archive,"uid-a",7,snapshot),records);
    assert.equal(Object.hasOwn(snapshot.snapshot.characters[2].state,"hp"),false);
    assert.throws(()=>assemble(records),/complete character state/);assert.deepEqual(records,before);
});

test("explicit complete formations reject missing characters and discarded root fields",()=>{
    const {createRecoveryArchive}=require("../functions/src/canonical-recovery-archive.js");
    for(const count of [1,2,3]){
        for(const durable of [false,true]){
            for(const mutate of [...Array.from({length:count},(_,index)=>f=>delete f.characterIndexToSlot[index]),
                f=>f.extra=true,f=>f.kind="ally-formation",f=>f.slotToCharacterIndex={} ]){
                const records=sources(count);
                if(durable){const {schemaVersion,ownerUid,serverRevision,provenance,...fields}=records.playableState;
                    records.progress.playableState=fields;delete records.playableState;}
                const priorSnapshot=assembleCanonicalSnapshot("uid-a",7,records);
                mutate(records.account.formation);
                const before=structuredClone(records);
                assert.throws(()=>assemble(records),/complete formation state/);
                if(durable){
                    assert.throws(()=>assembleCanonicalSnapshot("uid-a",7,records),/complete formation state/);
                    assert.throws(()=>createRecoveryArchive("uid-a",7,records,priorSnapshot),/complete formation state/);
                }
                assert.deepEqual(records,before);
            }
        }
    }
});

test("every recorded formation slot and null state survive projection and recovery exactly",()=>{
    const {createRecoveryArchive,inspectRecoveryArchive}=require("../functions/src/canonical-recovery-archive.js");
    const positions=["ALLY_F1","ALLY_F2","ALLY_F3","ALLY_B1","ALLY_B2","ALLY_B3"];
    for(const count of [1,2,3]){
        for(const offset of [0,1,2,3,4,5]){
            for(const absent of [false,true]){
                const records=sources(count);
                records.account.formation=absent?null:{version:1,characterIndexToSlot:
                    Object.fromEntries(records.characters.map((c,index)=>[c.slotIndex,positions[(offset+index)%6]]))};
                const before=structuredClone(records),projection=assemble(records);
                assert.deepEqual(projection.projection.gameSave.allyFormation,before.account.formation);
                const {schemaVersion,ownerUid,serverRevision,provenance,...fields}=records.playableState;
                records.progress.playableState=fields;delete records.playableState;
                const snapshot=assembleCanonicalSnapshot("uid-a",7,records);
                const archive=createRecoveryArchive("uid-a",7,records,snapshot);
                const restored=inspectRecoveryArchive(archive,"uid-a",7,snapshot);
                assert.deepEqual(restored.account.formation,before.account.formation);
                assert.equal(archive.readyForRestore,false);
                assert.equal(projection.readyForPublication,false);
                assert.equal(projection.projection.authoritativeStateReady,false);
                const changed=structuredClone(records);
                changed.account.formation=absent?{version:1,characterIndexToSlot:
                    Object.fromEntries(records.characters.map((c,index)=>[c.slotIndex,positions[(offset+index)%6]]))}:null;
                assert.notEqual(assemble(changed).sha256,projection.sha256);
            }
        }
    }
});

test("historical v1 partial formation keeps its hash but cannot become complete projection evidence",()=>{
    const {createRecoveryArchive,inspectRecoveryArchive}=require("../functions/src/canonical-recovery-archive.js");
    const records=sources(3);records.account.formation.characterIndexToSlot={0:"ALLY_F2"};
    const before=structuredClone(records),snapshot=assembleCanonicalSnapshot("uid-a",7,records);
    const archive=createRecoveryArchive("uid-a",7,records,snapshot);
    assert.deepEqual(inspectRecoveryArchive(archive,"uid-a",7,snapshot).account.formation,before.account.formation);
    assert.throws(()=>assemble(records),/complete formation state/);
    assert.deepEqual(records,before);
});

test("achievement claim markers remain exact across complete slots, durable snapshots and recovery archives",()=>{
    const {createRecoveryArchive,inspectRecoveryArchive}=require("../functions/src/canonical-recovery-archive.js");
    for(const count of [1,2,3]){
        const records=sources(count);
        records.progress.achievementState={firstBattle:true,reachLevel10:false};
        const before=structuredClone(records),bundle=assemble(records);
        assert.deepEqual(bundle.projection.gameSave.achievementState,before.progress.achievementState);
        assert.deepEqual(records,before);
        assert.equal(bundle.readyForPublication,false);
        const {schemaVersion,ownerUid,serverRevision,provenance,...fields}=records.playableState;
        records.progress.playableState=fields;delete records.playableState;
        const snapshot=assembleCanonicalSnapshot("uid-a",7,records);
        const archive=JSON.parse(JSON.stringify(createRecoveryArchive("uid-a",7,records,snapshot)));
        const restored=inspectRecoveryArchive(archive,"uid-a",7,snapshot);
        assert.deepEqual(restored.progress.achievementState,before.progress.achievementState);
        assert.deepEqual(restored.claimRecords,before.claimRecords);
        assert.deepEqual(restored.claimCheckpoint,before.claimCheckpoint);
        assert.equal(archive.readyForRestore,false);
    }
});

test("malformed achievement markers cannot become complete evidence or durable playable snapshots",()=>{
    for(const state of [{firstBattle:"true"},{firstBattle:1},{firstBattle:null},
        {firstBattle:{claimed:true}},{firstBattle:[]},{"":true},{"bad id":false}]){
        const records=sources();records.progress.achievementState=state;
        assert.throws(()=>assemble(records),/achievement claim/);
        const {schemaVersion,ownerUid,serverRevision,provenance,...fields}=records.playableState;
        records.progress.playableState=fields;delete records.playableState;
        assert.throws(()=>assembleCanonicalSnapshot("uid-a",7,records),/achievement claim/);
    }
});

test("historical achievement bytes stay compatible but never satisfy complete projection evidence",()=>{
    const {createRecoveryArchive,inspectRecoveryArchive}=require("../functions/src/canonical-recovery-archive.js");
    const records=sources();records.progress.achievementState={firstBattle:{claimed:true}};
    const snapshot=assembleCanonicalSnapshot("uid-a",7,records);
    const archive=JSON.parse(JSON.stringify(createRecoveryArchive("uid-a",7,records,snapshot)));
    const restored=inspectRecoveryArchive(archive,"uid-a",7,snapshot);
    assert.deepEqual(restored.progress.achievementState,records.progress.achievementState);
    assert.equal(archive.readyForRestore,false);
    assert.throws(()=>assemble(restored),/achievement claim/);
});

test("recorded daily and commission quest evidence survives every slot and recovery without rollover",()=>{
    const {createRecoveryArchive,inspectRecoveryArchive}=require("../functions/src/canonical-recovery-archive.js");
    for(const count of [1,2,3]){
        const records=sources(count);
        for(const key of ["dailyQuestState","commissionQuestState"]){
            records.progress[key].progress.retainedQuest_2=Number.MAX_SAFE_INTEGER;
            records.progress[key].claimed.retainedQuest_2=false;
        }
        const before=structuredClone(records),bundle=assemble(records);
        for(const key of ["dailyQuestState","commissionQuestState"]){
            assert.deepEqual(bundle.projection.gameSave[key],before.progress[key]);
        }
        assert.equal(bundle.readyForPublication,false);
        assert.equal(bundle.projection.authoritativeStateReady,false);
        assert.deepEqual(records,before);
        const {schemaVersion,ownerUid,serverRevision,provenance,...fields}=records.playableState;
        records.progress.playableState=fields;delete records.playableState;
        const snapshot=assembleCanonicalSnapshot("uid-a",7,records);
        const archive=JSON.parse(JSON.stringify(createRecoveryArchive("uid-a",7,records,snapshot)));
        const restored=inspectRecoveryArchive(archive,"uid-a",7,snapshot);
        for(const key of ["dailyQuestState","commissionQuestState"]){
            assert.deepEqual(restored.progress[key],before.progress[key]);
        }
        assert.deepEqual(restored.claimRecords,before.claimRecords);
        assert.deepEqual(restored.claimCheckpoint,before.claimCheckpoint);
        assert.equal(archive.readyForRestore,false);
    }
});

test("malformed quest storage cannot become complete evidence or durable playable snapshots",()=>{
    const changes=[
        s=>{delete s.date;},s=>s.extra=true,s=>s.date="2023-02-29",
        s=>s.date="2020-02-30",s=>s.date=1700000000000,s=>s.date="2020-2-29",
        s=>s.progress.killMonsters=-1,s=>s.progress.killMonsters=1.5,
        s=>s.progress.killMonsters="4",s=>s.progress.killMonsters=Number.MAX_SAFE_INTEGER+1,
        s=>s.claimed.killMonsters="false",s=>s.claimed.killMonsters={claimed:true},
        s=>{delete s.progress.killMonsters;},s=>{delete s.claimed.winBattle;},
        s=>s.progress.orphan=1,s=>s.claimed.orphan=false,
        s=>{s.progress["bad id"]=1;s.claimed["bad id"]=false;},
        s=>s.progress=[],s=>s.claimed=[],s=>s.date=""
    ];
    for(const key of ["dailyQuestState","commissionQuestState"]){
        for(const change of [s=>{for(const k of Object.keys(s)){delete s[k];}},...changes]){
            const records=sources();change(records.progress[key]);
            const before=structuredClone(records);
            assert.throws(()=>assemble(records),/quest/);
            const {schemaVersion,ownerUid,serverRevision,provenance,...fields}=records.playableState;
            records.progress.playableState=fields;delete records.playableState;
            assert.throws(()=>assembleCanonicalSnapshot("uid-a",7,records),/quest/);
            delete records.progress.playableState;records.playableState=before.playableState;
            assert.deepEqual(records,before);
        }
    }
});

test("historical v1 quest bytes remain compatible but cannot stand in for complete evidence",()=>{
    const {createRecoveryArchive,inspectRecoveryArchive}=require("../functions/src/canonical-recovery-archive.js");
    for(const key of ["dailyQuestState","commissionQuestState"]){
        const records=sources();records.progress[key]={claimed:true};
        const before=structuredClone(records),snapshot=assembleCanonicalSnapshot("uid-a",7,records);
        const archive=JSON.parse(JSON.stringify(createRecoveryArchive("uid-a",7,records,snapshot)));
        const restored=inspectRecoveryArchive(archive,"uid-a",7,snapshot);
        assert.deepEqual(restored.progress[key],before.progress[key]);
        assert.equal(assembleCanonicalSnapshot("uid-a",7,restored).sha256,snapshot.sha256);
        assert.equal(archive.readyForRestore,false);
        assert.throws(()=>assemble(restored),/quest/);
        assert.deepEqual(records,before);
    }
});

test("new-account zero quests preserve their empty date while historical uninitialized quests stay blocked",()=>{
    const {makeInitialCharacterSources}=require("../functions/src/initial-character-sources.js");
    const records=makeInitialCharacterSources("uid-a",7,"create-quest",{displayName:"new hero",
        element:"water",gender:"female",
        attributes:{attack:1,intelligence:2,vitality:3,energy:4,defensePoints:0,agility:0}},
        {recordedAt:1700000000000});
    const initial=structuredClone(records);
    assert.equal(assembleCanonicalSnapshot("uid-a",7,records).readyForPublication,false);
    assert.deepEqual(records,initial);
    assert.equal(assemble(records).readyForPublication,false);
    for(const key of ["dailyQuestState","commissionQuestState"]){
        const historical=structuredClone(records);historical.progress[key]={};
        assert.throws(()=>assemble(historical),/quest/);
        assert.equal(assembleCanonicalSnapshot("uid-a",7,historical).readyForPublication,false);
    }
    const bundle=assemble(records);
    for(const key of ["dailyQuestState","commissionQuestState"]){
        assert.deepEqual(bundle.projection.gameSave[key],records.progress[key]);
        for(const mutate of [s=>s.progress.killMonsters=1,s=>s.claimed.killMonsters=true]){
            const bad=structuredClone(records);mutate(bad.progress[key]);
            assert.throws(()=>assemble(bad),/quest/);
            assert.throws(()=>assembleCanonicalSnapshot("uid-a",7,bad),/quest/);
        }
    }
    assert.equal(bundle.readyForPublication,false);
});

test("Client Boss and Tower storage survives every slot and recovery without week rollover or rewards",()=>{
    const {createRecoveryArchive,inspectRecoveryArchive}=require("../functions/src/canonical-recovery-archive.js");
    for(const count of [1,2,3]){
        const records=sources(count),state=records.progress.gameplayProgress;
        state.personal["personal-20"]={firstClear:true,clears:5};
        state.world["world-40"]={completedStages:4,firstClear:true,clears:2};
        state.world["world-60"]={completedStages:2,firstClear:false,clears:0};
        Object.assign(state.tower,{completedFloor:50,highestThisWeek:50,historicalHighest:75,
            claimedFloors:{1:true,25:true,50:true},pendingRelicChoice:true});
        const before=structuredClone(records),bundle=assemble(records);
        assert.deepEqual(bundle.projection.gameSave.gameplayProgress,before.progress.gameplayProgress);
        assert.deepEqual(records,before);
        assert.equal(bundle.readyForPublication,false);
        assert.equal(bundle.projection.authoritativeStateReady,false);
        const {schemaVersion,ownerUid,serverRevision,provenance,...fields}=records.playableState;
        records.progress.playableState=fields;delete records.playableState;
        const snapshot=assembleCanonicalSnapshot("uid-a",7,records);
        const archive=JSON.parse(JSON.stringify(createRecoveryArchive("uid-a",7,records,snapshot)));
        const restored=inspectRecoveryArchive(archive,"uid-a",7,snapshot);
        assert.deepEqual(restored.progress.gameplayProgress,before.progress.gameplayProgress);
        assert.deepEqual(restored.claimRecords,before.claimRecords);
        assert.deepEqual(restored.claimCheckpoint,before.claimCheckpoint);
        assert.equal(archive.readyForRestore,false);
    }
});

test("missing or lossy Boss and Tower records cannot become durable playable or complete evidence",()=>{
    const changes=[
        s=>s.version=2,s=>s.extra=true,s=>{delete s.personal;},s=>s.personal={},
        s=>{delete s.personal["personal-20"];},s=>s.personal["unknown-boss"]={firstClear:false,clears:0},
        s=>s.personal["personal-20"].firstClear="false",s=>s.personal["personal-20"].clears="2",
        s=>s.personal["personal-20"].clears=-1,s=>s.personal["personal-20"].clears=1.5,
        s=>s.personal["personal-20"].clears=Number.MAX_SAFE_INTEGER+1,
        s=>s.personal["personal-20"].rewardClaimed=true,
        s=>s.world={},s=>{delete s.world["world-40"];},
        s=>s.world["world-40"].completedStages=5,s=>s.world["world-40"].completedStages=1.5,
        s=>s.world["world-40"].firstClear={claimed:true},
        s=>s.world["world-40"].clears=null,s=>s.world["world-40"].extra=true,
        s=>s.tower={},s=>s.tower.weekKey="2023-02-29",s=>s.tower.weekKey="2020-02-25",
        s=>s.tower.weekKey="",s=>s.tower.element="light",
        s=>s.tower.completedFloor=101,s=>s.tower.completedFloor="1",
        s=>s.tower.highestThisWeek=-1,s=>s.tower.historicalHighest=0.5,
        s=>s.tower.claimedFloors={"01":true},s=>s.tower.claimedFloors={0:true},
        s=>s.tower.claimedFloors={101:true},s=>s.tower.claimedFloors={1:"true"},
        s=>s.tower.claimedFloors={1:false},s=>s.tower.claimedFloors={1:{claimed:true}},
        s=>s.tower.pendingRelicChoice="false",s=>s.tower.extra=true
    ];
    for(const change of changes){
        const records=sources();change(records.progress.gameplayProgress);
        const before=structuredClone(records);
        assert.throws(()=>assemble(records),/gameplay progress/);
        const {schemaVersion,ownerUid,serverRevision,provenance,...fields}=records.playableState;
        records.progress.playableState=fields;delete records.playableState;
        assert.throws(()=>assembleCanonicalSnapshot("uid-a",7,records),/gameplay progress/);
        delete records.progress.playableState;records.playableState=before.playableState;
        assert.deepEqual(records,before);
    }
});

test("historical v1 Boss and Tower bytes keep their hash without satisfying complete evidence",()=>{
    const {createRecoveryArchive,inspectRecoveryArchive}=require("../functions/src/canonical-recovery-archive.js");
    const records=sources();records.progress.gameplayProgress={tower:{claimedFloors:{50:"true"}}};
    const before=structuredClone(records),snapshot=assembleCanonicalSnapshot("uid-a",7,records);
    const archive=JSON.parse(JSON.stringify(createRecoveryArchive("uid-a",7,records,snapshot)));
    const restored=inspectRecoveryArchive(archive,"uid-a",7,snapshot);
    assert.deepEqual(restored.progress.gameplayProgress,before.progress.gameplayProgress);
    assert.equal(assembleCanonicalSnapshot("uid-a",7,restored).sha256,snapshot.sha256);
    assert.equal(archive.readyForRestore,false);
    assert.throws(()=>assemble(restored),/gameplay progress/);
    assert.deepEqual(records,before);
});

test("new-account Boss and Tower sources satisfy storage projection without publication or history defaults",()=>{
    const {makeInitialCharacterSources}=require("../functions/src/initial-character-sources.js");
    const records=makeInitialCharacterSources("uid-a",7,"create-gameplay",{displayName:"new hero",
        element:"water",gender:"female",
        attributes:{attack:1,intelligence:2,vitality:3,energy:4,defensePoints:0,agility:0}},
        {recordedAt:1700000000000});
    const expected=JSON.parse(JSON.stringify(gameplayClient.GameplaySystem.normalizeState(null,1700000000000)));
    assert.deepEqual(records.progress.gameplayProgress,expected);
    const before=structuredClone(records);
    assert.equal(assembleCanonicalSnapshot("uid-a",7,records).readyForPublication,false);
    assert.deepEqual(records,before);
    assert.equal(assemble(records).readyForPublication,false);
    const historical=structuredClone(records);historical.progress.gameplayProgress={};
    assert.throws(()=>assemble(historical),/gameplay progress/);
    assert.equal(assembleCanonicalSnapshot("uid-a",7,historical).readyForPublication,false);
    const bundle=assemble(records);
    assert.deepEqual(bundle.projection.gameSave.gameplayProgress,expected);
    assert.equal(bundle.readyForPublication,false);
    assert.equal(bundle.projection.authoritativeStateReady,false);
    assert.equal(assembleCanonicalSnapshot("uid-a",7,records).readyForPublication,false);
});
