import assert from "node:assert/strict";
import {createRequire} from "node:module";
import test from "node:test";
import {readFileSync} from "node:fs";
import vm from "node:vm";

const require=createRequire(import.meta.url);
const {createCanonicalSourceWriter}=require("../functions/src/canonical-source-writer.js");
const {newcomerExpNext}=require("../functions/src/canonical-newcomer-exp.js");
const stamp={toMillis:()=>1};
const uid="uid-a";
const save=`users/${uid}/saves/current`;
const root=`serverUsers/${uid}`;
const operationId="init-character-0001";

const selection={displayName:"英雄",element:"fire",gender:"female",
    attributes:{attack:3,vitality:2,energy:1,intelligence:2,defensePoints:1,agility:1}};

test("new period sources use the existing Taipei server day at calendar boundaries",async()=>{
    for(const [instant,date] of [
        ["2026-10-15T15:59:59.999Z","2026-10-15"],
        ["2026-10-15T16:00:00.000Z","2026-10-16"],
        ["2026-12-31T16:00:00.000Z","2027-01-01"],
        ["2024-02-28T16:00:00.000Z","2024-02-29"],
        ["2024-02-29T16:00:00.000Z","2024-03-01"]]){
        const h=harness();h.setClock(Date.parse(instant));
        const args={operationId,expectedRevision:4,selection};
        await h.writer.commitInitialSources({},args);
        const archive=h.data.get(`${root}/recoveryArchives/5`);
        const records=archive.sourceRecords;
        const expected={"daily-dungeon-state":{date,used:{exp:false,material:false,equipment:false}},
            "equipment-shop-daily":{date,refreshCount:0,soldOfferIds:[]}};
        for(const [key,state] of Object.entries(expected)){
            const entry={status:"present",raw:JSON.stringify(state)};
            assert.deepEqual(records.progress.sidecars[key],entry);
            assert.deepEqual(h.data.get(`${root}/progress/current`).sidecars[key],entry);
            assert.deepEqual(h.data.get(`${root}/playableSnapshots/5`).snapshot.progress.sidecars[key],entry);
        }
        const {assembleCanonicalPlayableProjection}=require("../functions/src/canonical-snapshot.js");
        const bundle=assembleCanonicalPlayableProjection(uid,5,records);
        assert.equal(bundle.readyForPublication,false);
        assert.equal(bundle.projection.authoritativeStateReady,false);
        assert.equal(archive.readyForRestore,false);
        assert.equal(records.claimRecords.length,0);
        assert.equal(records.economy.gold,0);
        const before=JSON.stringify([...h.data]),writes=h.committed;
        h.setClock(Date.parse(instant)+86400000*35);
        assert.equal((await h.writer.commitInitialSources({},args)).unchanged,true);
        assert.equal(h.committed,writes);assert.equal(JSON.stringify([...h.data]),before);
    }
});

test("historical absent period sources and creation replay never backfill",async()=>{
    const {makeInitialCharacterSources,makeInitialSidecars}=require("../functions/src/initial-character-sources.js");
    const {assembleCanonicalSnapshot,assembleCanonicalPlayableProjection}=require("../functions/src/canonical-snapshot.js");
    const {createRecoveryArchive}=require("../functions/src/canonical-recovery-archive.js");
    const h=harness(),args={operationId,expectedRevision:4,selection};
    await h.writer.commitInitialSources({},args);
    const records=structuredClone(h.data.get(`${root}/recoveryArchives/5`).sourceRecords);
    for(const key of ["daily-dungeon-state","equipment-shop-daily"]){
        records.progress.sidecars[key]={status:"not-applicable",raw:null};
        assert.deepEqual(makeInitialSidecars()[key],{status:"not-applicable",raw:null});
        assert.deepEqual(makeInitialCharacterSources(uid,5,operationId,selection).progress.sidecars[key],
            {status:"not-applicable",raw:null});
    }
    const snapshot=assembleCanonicalSnapshot(uid,5,records);
    const archive=createRecoveryArchive(uid,5,records,snapshot);
    h.data.set(`${root}/progress/current`,records.progress);
    h.data.set(`${root}/playableSnapshots/5`,snapshot);
    h.data.set(`${root}/recoveryArchives/5`,archive);
    h.data.get(`${root}/operations/${operationId}`).snapshotSha256=snapshot.sha256;
    const before=JSON.stringify([...h.data]),writes=h.committed;
    h.setClock(1900000000000);
    assert.equal((await h.writer.commitInitialSources({},args)).unchanged,true);
    assert.equal(h.committed,writes);assert.equal(JSON.stringify([...h.data]),before);
    assert.throws(()=>assembleCanonicalPlayableProjection(uid,5,records),/sidecar missing/);
});

test("new period sources are independent of the Functions host timezone",()=>{
    const {execFileSync}=require("node:child_process");
    const factory=require.resolve("../functions/src/initial-character-sources.js");
    const code=`const {makeInitialSidecars}=require(${JSON.stringify(factory)});`+
        `console.log(makeInitialSidecars(Date.parse('2026-10-15T16:00:00Z'))['equipment-shop-daily'].raw);`;
    for(const TZ of ["UTC","America/Los_Angeles","Pacific/Kiritimati"]){
        assert.deepEqual(JSON.parse(execFileSync(process.execPath,["-e",code],
            {encoding:"utf8",env:{...process.env,TZ}})),
            {date:"2026-10-16",refreshCount:0,soldOfferIds:[]});
    }
});

function harness(candidate="none"){
    let sessionId="creation-session-one";
    let clock=1700000000000;
    const data=new Map([[save,{schemaVersion:2,ownerUid:uid,
        authoritativeStateReady:false,authoritativeStateVersion:0,
        migrationCandidateStatus:candidate,
        status:candidate==="none"?"awaiting_authoritative_migration":
            "migration_candidate_received",serverRevision:4,
        createdAt:stamp,updatedAt:stamp,
        ...(candidate==="none"?{}:{migrationCandidateRevision:1,
            migrationCandidateFingerprint:"a".repeat(64),
            migrationCandidateGameSaveVersion:6,migrationCandidateByteLength:100})}]]);
    const ref=path=>({path,collection(name){return collection(`${path}/${name}`);}});
    const collection=path=>({doc(id){return ref(`${path}/${id}`);}});
    const db={collection};
    let committed=0;
    const transaction={
        async get(reference){
            const value=data.get(reference.path);
            return {exists:value!==undefined,data:()=>value,get:key=>value?.[key]};
        },
        create(reference,value){
            if(data.has(reference.path)){ throw Error("duplicate document"); }
            data.set(reference.path,value);committed++;
        },
        update(reference,patch){
            if(!data.has(reference.path)){ throw Error("missing document"); }
            data.set(reference.path,{...data.get(reference.path),...patch});committed++;
        }
    };
    class HttpsError extends Error{constructor(code,message){super(message);this.code=code;}}
    const writer=createCanonicalSourceWriter({db,FieldValue:{serverTimestamp:()=>stamp},
        HttpsError,runProtected:(_request,operation)=>operation(transaction,{uid,sessionId}),
        inspectExistingEnvelope:record=>({kind:"current",serverRevision:record.serverRevision,
            data:record}),nextRevision:envelope=>envelope.serverRevision+1,now:()=>clock});
    return {writer,data,setSessionId:value=>{sessionId=value;},
        setClock:value=>{clock=value;},
        get committed(){return committed;}};
}

test("public first creation replay requires the original session and current revision",async()=>{
    const h=harness(),args={operationId,expectedRevision:4,selection};
    await h.writer.commitInitialSources({},args,{requireCurrentReplay:true});
    assert.equal((await h.writer.commitInitialSources({},args,{requireCurrentReplay:true}))
        .unchanged,true);
    h.setSessionId("another-session");
    await assert.rejects(h.writer.commitInitialSources({},args,{requireCurrentReplay:true}),
        /earlier session/);
    h.setSessionId("creation-session-one");
    h.data.get(save).serverRevision=6;
    await assert.rejects(h.writer.commitInitialSources({},args,{requireCurrentReplay:true}),
        /advanced character/);
});

test("new creation persists server-generated playable fields in the existing revision and recovery archive",async()=>{
    const h=harness(),args={operationId,expectedRevision:4,selection};
    await h.writer.commitInitialSources({},args);
    const progress=h.data.get(`${root}/progress/current`);
    const fields=progress.playableState;
    assert.equal(progress.serverRevision,5);
    assert.equal(fields.lastSaveTimestamp,1700000000000);
    assert.equal(fields.selectedCreationElement,selection.element);
    assert.deepEqual(fields.bestiaryData,{});
    assert.ok(Object.values(fields.heroAccount.heroes).every(row=>
        row.unlocked===false&&row.stars===0&&row.specificFragments===0));
    for(const key of ["autoConfig","autoConfig2","autoConfig3"]){
        assert.deepEqual(fields[key],{enabled:false,skill:"normal",hp:50,sp:25,returnToCityWhenEmpty:false});
    }
    assert.notEqual(fields.autoConfig,fields.autoConfig2);
    assert.deepEqual(h.data.get(`${root}/playableSnapshots/5`).snapshot.progress.playableState,fields);
    const archive=h.data.get(`${root}/recoveryArchives/5`);
    assert.deepEqual(archive.sourceRecords.progress.playableState,fields);
    const initial={
        "daily-dungeon-state":{date:"2023-11-15",used:{exp:false,material:false,equipment:false}},
        "equipment-shop-daily":{date:"2023-11-15",refreshCount:0,soldOfferIds:[]},
        "element-box-state":{remainingMs:0},
        "exp-pool-growth-state":{initialized:true,unlocked:false,lastAt:1700000000000,
            noticeShown:false,lastCapped:false,newcomerRewards:{}},
        "rested-exp-state":{battles:0,progressMs:0,lastSeenAt:1700000000000,
            blockedByElementBox:false},
        "progress":{eliteKills:0,dungeonWins:0,abyssClears:0},
        "quest-milestones":{date:"2023-11-14",daily:{},commission:{}},
        "abyss-state":progress.abyssProgress,
        "legacy-abyss-state":{active:false,floor:1,phase:"boss",x:50,y:84,
            message:"",clears:0,rewardVersion:1}
    };
    for(const [key,state] of Object.entries(initial)){
        assert.deepEqual(progress.sidecars[key],{status:"present",raw:JSON.stringify(state)});
    }
    for(const [key,entry] of Object.entries(progress.sidecars)){
        if(!Object.hasOwn(initial,key)){assert.deepEqual(entry,{status:"not-applicable",raw:null});}
    }
    assert.deepEqual(archive.sourceRecords.progress.sidecars,progress.sidecars);
    assert.deepEqual(h.data.get(`${root}/playableSnapshots/5`).snapshot.progress.sidecars,progress.sidecars);
    assert.equal(archive.readyForRestore,false);
    const client=readFileSync(new URL("../js/59-abyss-two-tier-runtime.js",import.meta.url),"utf8");
    const definitions=client.slice(client.indexOf("function defaultRun("),
        client.indexOf("function normalizeRun("));
    const noHistoryMigration=client.slice(client.indexOf("function migrateLegacy("),
        client.indexOf("function readMainSave("));
    const expected=JSON.parse(JSON.stringify(vm.runInNewContext(
        'const STATE_VERSION=3;const localStorage={getItem:()=>null};'+
        definitions+noHistoryMigration+';migrateLegacy(defaultRoot())')));
    assert.deepEqual(progress.abyssProgress,expected);
    assert.deepEqual(archive.sourceRecords.progress.abyssProgress,expected);
    assert.deepEqual(h.data.get(`${root}/playableSnapshots/5`).snapshot.progress.abyssProgress,expected);
    const legacyClient=readFileSync(new URL("../js/36-v141-content-systems.js",import.meta.url),"utf8");
    const legacyFactory=legacyClient.slice(legacyClient.indexOf("function defaultAbyssState()"),
        legacyClient.indexOf("function loadAbyssState()"));
    const legacyDefault=JSON.parse(JSON.stringify(vm.runInNewContext(legacyFactory+";defaultAbyssState()")));
    assert.deepEqual(JSON.parse(progress.sidecars["legacy-abyss-state"].raw),legacyDefault);
    assert.equal(archive.sourceRecords.claimRecords.length,0);
    const count=h.committed;
    h.setClock(1800000000000);
    assert.equal((await h.writer.commitInitialSources({},args)).unchanged,true);
    assert.equal(h.committed,count);
    assert.equal(h.data.get(`${root}/progress/current`).playableState.lastSaveTimestamp,1700000000000);
    assert.deepEqual(h.data.get(`${root}/progress/current`).sidecars,progress.sidecars);
    assert.equal(h.data.get(`${root}/economy/current`).sharedExp,0);
    const {assembleCanonicalPlayableProjection}=require("../functions/src/canonical-snapshot.js");
    const complete=assembleCanonicalPlayableProjection(uid,5,archive.sourceRecords);
    assert.equal(complete.readyForPublication,false);
    assert.equal(complete.projection.authoritativeStateReady,false);
    const imported=harness();
    await assert.rejects(imported.writer.commitInitialSources({}, {...args,
        selection:{...selection,heroAccount:fields.heroAccount}}),/Invalid initial/);
    assert.equal(imported.committed,0);
    for(const key of ["sidecars","remainingMs","lastSeenAt","newcomerRewards",
        "daily","commission","claimRecords","quest-milestones","eliteKills",
        "abyssProgress","runs","firstClearClaims","legacyMigrated","legacy-abyss-state","rewardVersion","clears",
        "daily-dungeon-state","equipment-shop-daily","date","used","refreshCount","soldOfferIds"]){
        const h=harness();
        await assert.rejects(h.writer.commitInitialSources({}, {...args,
            selection:{...selection,[key]:1}}),/Invalid initial/);
        assert.equal(h.committed,0);
    }
});

test("static newcomer EXP curve follows current game anchors",()=>{
    assert.deepEqual([1,2,5,10,15,19].map(newcomerExpNext),
        [300,375,600,1200,2500,6900]);
    assert.throws(()=>newcomerExpNext(20),/unavailable/);
});

test("initial server-owned character commits complete sources and receipt at one revision",async()=>{
    const h=harness();
    const request={};
    const args={operationId,expectedRevision:4,selection};
    const result=await h.writer.commitInitialSources(request,args);
    assert.equal(result.sourceRevision,5);
    assert.equal(result.authoritativeStateReady,false);
    assert.equal(h.data.get(save).serverRevision,5);
    assert.equal(h.data.get(save).authoritativeStateReady,false);
    assert.deepEqual(h.data.get(`${root}/account/current`).slots,
        [`character-${operationId}`,null,null]);
    const character=h.data.get(`${root}/characters/character-${operationId}`);
    assert.equal(character.ownerUid,uid);
    assert.equal(character.state.skillPoints,2);
    assert.equal(character.state.expNext,300);
    assert.equal(character.state.hp,200);
    assert.equal(h.data.get(`${root}/economy/current`).gold,0);
    assert.equal(h.data.get(`${root}/claimCheckpoints/current`).claimCount,0);
    assert.equal(h.data.get(`${root}/playableSnapshots/5`).readyForPublication,false);
    assert.equal(h.data.get(`${root}/operations/${operationId}`).snapshotSha256,
        result.snapshotSha256);
    const count=h.committed;
    assert.deepEqual(await h.writer.commitInitialSources(request,args),{
        sourceRevision:5,snapshotSha256:result.snapshotSha256,
        unchanged:true,authoritativeStateReady:false});
    assert.equal(h.committed,count);
});

test("candidate, stale revision or incomplete source cannot create partial records",async()=>{
    const candidate=harness("received");
    await assert.rejects(candidate.writer.commitInitialSources({},
        {operationId,expectedRevision:4,selection}),/migration candidate/);
    assert.equal(candidate.committed,0);
    const orphan=harness();
    orphan.data.set(`${root}/migrationCandidates/latest`,{trusted:false});
    await assert.rejects(orphan.writer.commitInitialSources({},
        {operationId,expectedRevision:4,selection}),/migration candidate/);
    assert.equal(orphan.committed,0);
    const stale=harness();
    await assert.rejects(stale.writer.commitInitialSources({},
        {operationId,expectedRevision:3,selection}),/REVISION_CONFLICT/);
    assert.equal(stale.committed,0);
    const corrupt=harness();
    await assert.rejects(corrupt.writer.commitInitialSources({},
        {operationId,expectedRevision:4,selection:{...selection,
            attributes:{...selection.attributes,attack:4}}}),/Invalid initial/);
    assert.equal(corrupt.committed,0);
    const paid=harness();
    await assert.rejects(paid.writer.commitInitialSources({},
        {operationId,expectedRevision:4,selection:{...selection,gold:100}}),/Invalid initial/);
    assert.equal(paid.committed,0);
});

test("a missing receipt cannot repeat an already persisted initial character",async()=>{
    const h=harness();
    await h.writer.commitInitialSources({},
        {operationId,expectedRevision:4,selection});
    h.data.delete(`${root}/operations/${operationId}`);
    await assert.rejects(h.writer.commitInitialSources({},
        {operationId:"init-character-0002",expectedRevision:5,selection}),
    /existing character/);
});

test("changed choices cannot replay the same operation receipt",async()=>{
    const h=harness();
    await h.writer.commitInitialSources({}, {operationId,expectedRevision:4,selection});
    await assert.rejects(h.writer.commitInitialSources({}, {operationId,
        expectedRevision:4,selection:{...selection,element:"water"}}),/inconsistent/);
});


test("historical source factory calls do not backfill the legacy Abyss sidecar",()=>{
    const {makeInitialCharacterSources,makeInitialSidecars}=require("../functions/src/initial-character-sources.js");
    const historical=makeInitialCharacterSources(uid,5,operationId,selection);
    assert.deepEqual(historical.progress.sidecars["legacy-abyss-state"],{status:"not-applicable",raw:null});
    assert.deepEqual(makeInitialSidecars()["legacy-abyss-state"],{status:"not-applicable",raw:null});
    assert.equal(Object.hasOwn(historical.progress,"playableState"),false);
});

test("new-account quest sources match the actual Client initial declarations without rewards",async()=>{
    const client=readFileSync(new URL("../js/00-main.js",import.meta.url),"utf8");
    const expected={};
    for(const key of ["dailyQuestState","commissionQuestState"]){
        const declaration=client.match(new RegExp("let "+key+"=\\{[\\s\\S]*?^\\};","m"));
        assert.ok(declaration,"Client initial quest declaration missing: "+key);
        expected[key]=JSON.parse(JSON.stringify(vm.runInNewContext(declaration[0]+";"+key)));
    }
    const h=harness(),args={operationId,expectedRevision:4,selection};
    await h.writer.commitInitialSources({},args);
    const progress=h.data.get(`${root}/progress/current`);
    const snapshot=h.data.get(`${root}/playableSnapshots/5`);
    const archive=h.data.get(`${root}/recoveryArchives/5`);
    for(const [key,state] of Object.entries(expected)){
        assert.deepEqual(progress[key],state);
        assert.deepEqual(snapshot.snapshot.progress[key],state);
        assert.deepEqual(archive.sourceRecords.progress[key],state);
        assert.equal(state.date,"");
        assert.ok(Object.values(state.progress).every(value=>value===0));
        assert.ok(Object.values(state.claimed).every(value=>value===false));
        const imported=harness();
        await assert.rejects(imported.writer.commitInitialSources({},{
            ...args,selection:{...selection,[key]:state}}),/Invalid initial/);
        assert.equal(imported.committed,0);
    }
    assert.equal(snapshot.readyForPublication,false);
    assert.equal(archive.readyForRestore,false);
    assert.equal(h.data.get(save).authoritativeStateReady,false);
    assert.equal(archive.sourceRecords.claimRecords.length,0);
    assert.equal(h.data.get(`${root}/economy/current`).gold,0);
    const before=JSON.stringify([...h.data]),count=h.committed;
    h.setClock(1900000000000);
    await h.writer.commitInitialSources({},args);
    assert.equal(h.committed,count);
    assert.equal(JSON.stringify([...h.data]),before);
});

test("historical empty quest snapshots and receipt replay are preserved without backfill",async()=>{
    const {assembleCanonicalSnapshot}=require("../functions/src/canonical-snapshot.js");
    const {createRecoveryArchive}=require("../functions/src/canonical-recovery-archive.js");
    const h=harness(),args={operationId,expectedRevision:4,selection};
    await h.writer.commitInitialSources({},args);
    const records=structuredClone(h.data.get(`${root}/recoveryArchives/5`).sourceRecords);
    records.progress.dailyQuestState={};
    records.progress.commissionQuestState={};
    const snapshot=assembleCanonicalSnapshot(uid,5,records);
    const archive=createRecoveryArchive(uid,5,records,snapshot);
    h.data.set(`${root}/progress/current`,records.progress);
    h.data.set(`${root}/playableSnapshots/5`,snapshot);
    h.data.set(`${root}/recoveryArchives/5`,archive);
    h.data.get(`${root}/operations/${operationId}`).snapshotSha256=snapshot.sha256;
    const before=JSON.stringify([...h.data]),count=h.committed;
    await h.writer.commitInitialSources({},args);
    assert.equal(h.committed,count);
    assert.equal(JSON.stringify([...h.data]),before);
    const {makeInitialCharacterSources}=require("../functions/src/initial-character-sources.js");
    const historical=makeInitialCharacterSources(uid,5,operationId,selection);
    assert.deepEqual(historical.progress.dailyQuestState,{});
    assert.deepEqual(historical.progress.commissionQuestState,{});
});


function clientInitialGameplay(recordedAt){
    const client={console,setTimeout:()=>0,clearTimeout:()=>{},saveGame:()=>{},
        FourSymbolsAccountSave:{getActiveUid:()=>"fixture",saveKey:()=>"fixture",
            readForUid:()=>({status:"missing"})}};
    client.window=client;
    vm.runInNewContext(readFileSync(new URL("../js/gameplay-boss-tower-system.js",import.meta.url),"utf8"),client);
    return JSON.parse(JSON.stringify(client.GameplaySystem.normalizeState(null,recordedAt)));
}

test("new-account Boss and Tower storage matches the actual Client at UTC week boundaries",async()=>{
    const times=[Date.UTC(1970,0,5),Date.UTC(2020,1,23,23,59,59,999),
        Date.UTC(2020,1,24),Date.UTC(2020,2,2),Date.UTC(2020,2,9),Date.UTC(2020,2,16),
        Date.UTC(2023,11,31,23,59,59,999),Date.UTC(2024,0,1),
        Date.UTC(2024,1,29),Date.UTC(2026,9,15),1700000000000];
    const elements=new Set();
    for(const recordedAt of times){
        const expected=clientInitialGameplay(recordedAt),h=harness();
        elements.add(expected.tower.element);h.setClock(recordedAt);
        const args={operationId,expectedRevision:4,selection};
        await h.writer.commitInitialSources({},args);
        const progress=h.data.get(`${root}/progress/current`);
        const snapshot=h.data.get(`${root}/playableSnapshots/5`);
        const archive=h.data.get(`${root}/recoveryArchives/5`);
        assert.deepEqual(progress.gameplayProgress,expected);
        assert.deepEqual(snapshot.snapshot.progress.gameplayProgress,expected);
        assert.deepEqual(archive.sourceRecords.progress.gameplayProgress,expected);
        assert.equal(snapshot.readyForPublication,false);assert.equal(archive.readyForRestore,false);
        assert.equal(h.data.get(save).authoritativeStateReady,false);
        assert.equal(archive.sourceRecords.claimRecords.length,0);
        assert.equal(h.data.get(`${root}/economy/current`).gold,0);
        const before=JSON.stringify([...h.data]),count=h.committed;
        h.setClock(recordedAt+35*86400000);
        await h.writer.commitInitialSources({},args);
        assert.equal(h.committed,count);assert.equal(JSON.stringify([...h.data]),before);
    }
    assert.deepEqual([...elements].sort(),["earth","fire","water","wind"]);
});

test("Client Boss progress, Tower periods and claim markers cannot be imported at creation",async()=>{
    for(const key of ["gameplayProgress","tower","weekKey","claimedFloors","personal","world",
        "firstClear","completedStages","historicalHighest","pendingRelicChoice"]){
        const h=harness();
        await assert.rejects(h.writer.commitInitialSources({},{
            operationId,expectedRevision:4,selection:{...selection,[key]:clientInitialGameplay(1700000000000)}
        }),/Invalid initial/);
        assert.equal(h.committed,0);
    }
});

test("historical empty Boss and Tower receipts and original factory hash remain unchanged",async()=>{
    const {assembleCanonicalSnapshot}=require("../functions/src/canonical-snapshot.js");
    const {createRecoveryArchive}=require("../functions/src/canonical-recovery-archive.js");
    const {makeInitialCharacterSources}=require("../functions/src/initial-character-sources.js");
    const historical=makeInitialCharacterSources(uid,5,operationId,selection);
    assert.deepEqual(historical.progress.gameplayProgress,{});
    assert.equal(assembleCanonicalSnapshot(uid,5,historical).sha256,
        "d2a7e43cffce469abde068d3f993079b5eef072adb2c4169154c567fa430bb54");
    const h=harness(),args={operationId,expectedRevision:4,selection};
    await h.writer.commitInitialSources({},args);
    const records=structuredClone(h.data.get(`${root}/recoveryArchives/5`).sourceRecords);
    records.progress.gameplayProgress={};
    const snapshot=assembleCanonicalSnapshot(uid,5,records);
    const archive=createRecoveryArchive(uid,5,records,snapshot);
    h.data.set(`${root}/progress/current`,records.progress);
    h.data.set(`${root}/playableSnapshots/5`,snapshot);
    h.data.set(`${root}/recoveryArchives/5`,archive);
    h.data.get(`${root}/operations/${operationId}`).snapshotSha256=snapshot.sha256;
    const before=JSON.stringify([...h.data]),count=h.committed;
    h.setClock(1900000000000);
    await h.writer.commitInitialSources({},args);
    assert.equal(h.committed,count);assert.equal(JSON.stringify([...h.data]),before);
});
