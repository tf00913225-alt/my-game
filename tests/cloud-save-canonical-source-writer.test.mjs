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
const observationId="observe-period-0001";
const observation={operationId:observationId,expectedRevision:5};
const application={operationId:"apply-period-0001",periodId:"daily-period-20261016",expectedRevision:5};

async function applicationHarness(){
    const h=await periodHarness();
    await h.writer.observeDailyPeriod({},observation);
    return h;
}
async function rejectedApplication(h,args=application,pattern){
    const before=JSON.stringify([...h.data]),count=h.committed;
    await assert.rejects(h.writer.applyDailyPeriod({},args),pattern);
    assert.equal(h.committed,count);assert.equal(JSON.stringify([...h.data]),before);
}

test("zero-consumption application blocks pending entitlements, orphan ledgers and unknown operations",async()=>{
    for(const name of ["pendingGrants","grantOperations","uniqueClaims","ledgerEntries","rewardEvents"]){
        const h=await applicationHarness();h.data.set(root+"/"+name+"/unrelated-id",{status:"pending"});
        await rejectedApplication(h,application,/Economic history or pending/);
    }
    for(const row of [{schemaVersion:1,ownerUid:uid,kind:"dungeon-complete"},
        {schemaVersion:1,ownerUid:uid,kind:"shop-purchase"},
        {schemaVersion:1,ownerUid:uid},
        {schemaVersion:1,ownerUid:"other",kind:"daily-period-source"}]){
        const h=await applicationHarness();h.data.set(root+"/operations/unrelated-id",row);
        await rejectedApplication(h,application,/Unreconciled operation|inventory is inconsistent/);
    }
    const h=await applicationHarness();
    for(let i=0;i<399;i++)h.data.set(root+"/operations/history-"+i,{schemaVersion:1,ownerUid:uid,kind:"unknown"});
    await rejectedApplication(h,application,/controlled limit/);
});

test("protected zero-consumption day application atomically advances sources, snapshot and archive only",async()=>{
    const h=await applicationHarness();
    const before=JSON.parse(JSON.stringify([...h.data])),old=new Map(before);
    const result=await h.writer.applyDailyPeriod({},application);
    assert.equal(result.appliedRevision,6);assert.equal(result.targetDate,"2026-10-16");
    assert.equal(result.authoritativeStateReady,false);assert.equal(result.rewardEligible,false);
    assert.equal(h.data.get(save).serverRevision,6);
    const archive=h.data.get(root+"/recoveryArchives/6"),records=archive.sourceRecords;
    assert.equal(archive.readyForRestore,false);
    assert.equal(h.data.get(root+"/playableSnapshots/6").readyForPublication,false);
    const {assembleCanonicalPlayableProjection}=require("../functions/src/canonical-snapshot.js");
    assert.equal(assembleCanonicalPlayableProjection(uid,6,records).readyForPublication,false);
    for(const key of ["daily-dungeon-state","equipment-shop-daily"]){
        assert.equal(JSON.parse(records.progress.sidecars[key].raw).date,"2026-10-16");
        assert.deepEqual(h.data.get(root+"/progress/current").sidecars[key],records.progress.sidecars[key]);
    }
    for(const [path,value] of old){
        if(/\/(playableSnapshots|recoveryArchives|operations)\//.test(path)){
            assert.equal(JSON.stringify(h.data.get(path)),JSON.stringify(value));
        }
    }
    assert.equal(records.economy.gold,0);assert.equal(records.economy.sharedExp,0);
    assert.deepEqual(records.inventory,[]);assert.deepEqual(records.claimRecords,[]);
    assert.equal(records.claimCheckpoint.claimDigest,old.get(root+"/claimCheckpoints/current").claimDigest);
    const marker=h.data.get(root+"/operations/daily-period-applied-20261016");
    assert.equal(marker.consumption.status,"verified-empty");
    assert.equal(marker.consumption.initialSnapshotSha256,old.get(root+"/playableSnapshots/5").sha256);
    assert.deepEqual(marker.consumption.periods,
        old.get(root+"/operations/daily-period-20261016").periods);
    assert.equal([...h.data.keys()].some(key=>key.includes("/ledgerEntries/")),false);
    assert.equal([...h.data.keys()].some(key=>key.includes("/grantOperations/")),false);
    assert.deepEqual(records.progress.playableState,
        old.get(root+"/progress/current").playableState);
    const after=JSON.stringify([...h.data]),count=h.committed;
    h.setClock(Date.parse("2026-11-20T16:00:00Z"));
    assert.deepEqual(await h.writer.applyDailyPeriod({},application),{...result,unchanged:true});
    assert.equal(h.committed,count);assert.equal(JSON.stringify([...h.data]),after);
    await rejectedApplication(h,{...application,expectedRevision:6},/intent/);
    await rejectedApplication(h,{...application,periodId:"daily-period-20261017"},/intent/);
    await rejectedApplication(h,{...application,operationId:"apply-period-0002"},/already applied/);
});

test("later zero periods use the prior protected application and never regenerate consumed sources",async()=>{
    const h=await applicationHarness();
    await h.writer.applyDailyPeriod({},application);
    h.setClock(Date.parse("2026-10-16T16:00:00Z"));
    await h.writer.observeDailyPeriod({},{operationId:"observe-period-0002",expectedRevision:6});
    const second={operationId:"apply-period-0002",periodId:"daily-period-20261017",expectedRevision:6};
    const result=await h.writer.applyDailyPeriod({},second);
    assert.equal(result.appliedRevision,7);assert.equal(result.targetDate,"2026-10-17");
    assert.equal((await h.writer.applyDailyPeriod({},application)).unchanged,true);
    assert.equal((await h.writer.applyDailyPeriod({},second)).unchanged,true);
    h.data.delete(root+"/operations/apply-period-0001");
    await rejectedApplication(h,second,/receipt is missing/);
});

test("daily application rejects client state, stale or expired observations and namespace overlap",async()=>{
    for(const key of ["date","observedAt","used","refreshCount","soldOfferIds","gold",
        "claimed","consumption","rewardEligible","authoritativeStateReady"]){
        const h=await applicationHarness();
        await rejectedApplication(h,{...application,[key]:true},/only operation/);
    }
    const stale=await applicationHarness();
    await rejectedApplication(stale,{...application,expectedRevision:4},/REVISION_CONFLICT/);
    const expired=await applicationHarness();expired.setClock(Date.parse("2026-10-16T16:00:00Z"));
    await rejectedApplication(expired,application,/current server period/);
    for(const collection of ["operations","grantOperations","ledgerEntries"]){
        for(const id of [application.operationId,"daily-period-applied-20261016"]){
            const h=await applicationHarness();h.data.set(root+"/"+collection+"/"+id,{kind:"other"});
            await rejectedApplication(h);
        }
    }
    const candidate=await applicationHarness();candidate.data.get(save).migrationCandidateStatus="received";
    await rejectedApplication(candidate,application,/Unresolved migration/);
});

test("used flags, purchases, refreshes, claims and state changes cannot masquerade as zero consumption",async()=>{
    for(const change of [
        records=>{const s=JSON.parse(records.progress.sidecars["daily-dungeon-state"].raw);
            s.used.exp=true;records.progress.sidecars["daily-dungeon-state"].raw=JSON.stringify(s);},
        records=>{const s=JSON.parse(records.progress.sidecars["equipment-shop-daily"].raw);
            s.refreshCount=1;records.progress.sidecars["equipment-shop-daily"].raw=JSON.stringify(s);},
        records=>{const s=JSON.parse(records.progress.sidecars["equipment-shop-daily"].raw);
            s.soldOfferIds=["2026-10-15:0:0"];
            records.progress.sidecars["equipment-shop-daily"].raw=JSON.stringify(s);},
        records=>{records.economy.gold=10;},
        records=>{records.progress.playableState.autoConfig.enabled=true;},
        records=>{records.progress.sidecars["equipment-shop-purchases"]={status:"present",raw:"{}"};}
    ]){
        const h=await periodHarness();
        rewritePeriodSources(h,change);
        // Reflect valid-but-untrusted current sources without rewriting the
        // immutable creation receipt: a same-revision edited archive is not
        // a legitimate consumption proof.
        const source=h.data.get(root+"/recoveryArchives/5").sourceRecords;
        h.data.set(root+"/economy/current",source.economy);
        await h.writer.observeDailyPeriod({},observation);
        await rejectedApplication(h);
    }
    const noOrigin=await applicationHarness();
    noOrigin.data.delete(root+"/operations/"+operationId);
    await rejectedApplication(noOrigin,application,/Original zero/);
});

test("missing or corrupt application/observation/snapshot/archive proof fails without writes",async()=>{
    for(const path of ["operations/daily-period-20261016","operations/"+observationId,
        "playableSnapshots/5","recoveryArchives/5","progress/current","claimCheckpoints/current"]){
        const h=await applicationHarness();h.data.delete(root+"/"+path);
        await rejectedApplication(h);
    }
    for(const path of ["operations/daily-period-applied-20261016",
        "operations/"+application.operationId,"playableSnapshots/6","recoveryArchives/6"]){
        const h=await applicationHarness();await h.writer.applyDailyPeriod({},application);
        h.data.delete(root+"/"+path);await rejectedApplication(h);
    }
    for(const field of ["sourceSha256","consumption","snapshotSha256","inputRevision",
        "rewardEligible","authoritativeStateReady"]){
        const h=await applicationHarness();await h.writer.applyDailyPeriod({},application);
        h.data.get(root+"/operations/daily-period-applied-20261016")[field]="corrupt";
        await rejectedApplication(h);
    }
    const h=await applicationHarness();
    const current=JSON.parse(JSON.stringify(h.data.get(root+"/progress/current")));
    current.sidecars["daily-dungeon-state"].raw="{}";
    h.data.set(root+"/progress/current",current);
    await rejectedApplication(h,application,/Current sources differ/);
});

async function periodHarness(){
    const h=harness();
    h.setClock(Date.parse("2026-10-15T15:59:59.999Z"));
    await h.writer.commitInitialSources({}, {operationId,expectedRevision:4,selection});
    h.setClock(Date.parse("2026-10-15T16:00:00.000Z"));
    return h;
}
function rewritePeriodSources(h,change){
    const {assembleCanonicalSnapshot}=require("../functions/src/canonical-snapshot.js");
    const {createRecoveryArchive}=require("../functions/src/canonical-recovery-archive.js");
    const records=structuredClone(h.data.get(root+"/recoveryArchives/5").sourceRecords);
    change(records);
    const bundle=assembleCanonicalSnapshot(uid,5,records);
    h.data.set(root+"/progress/current",records.progress);
    h.data.set(root+"/account/current",{...records.account,snapshotSha256:bundle.sha256});
    h.data.set(root+"/playableSnapshots/5",bundle);
    h.data.set(root+"/recoveryArchives/5",createRecoveryArchive(uid,5,records,bundle));
}
async function unchangedRejection(h,args=observation,pattern){
    const before=JSON.stringify([...h.data]),count=h.committed;
    await assert.rejects(h.writer.observeDailyPeriod({},args),pattern);
    assert.equal(h.committed,count);assert.equal(JSON.stringify([...h.data]),before);
}

test("daily observation pins Taipei midnight/year/leap periods without changing any gameplay bytes",async()=>{
    for(const [before,after,date] of [
        ["2026-10-15T15:59:59.999Z","2026-10-15T16:00:00.000Z","2026-10-16"],
        ["2026-12-31T15:59:59.999Z","2026-12-31T16:00:00.000Z","2027-01-01"],
        ["2024-02-28T15:59:59.999Z","2024-02-28T16:00:00.000Z","2024-02-29"],
        ["2024-02-29T15:59:59.999Z","2024-02-29T16:00:00.000Z","2024-03-01"]]){
        const h=harness();h.setClock(Date.parse(before));
        await h.writer.commitInitialSources({}, {operationId,expectedRevision:4,selection});
        await unchangedRejection(h,observation,/later daily/);
        h.setClock(Date.parse(after));
        const original=new Map([...h.data].map(([k,v])=>[k,JSON.stringify(v)])),count=h.committed;
        const result=await h.writer.observeDailyPeriod({},observation);
        assert.equal(result.targetDate,date);assert.equal(result.sourceRevision,5);
        assert.equal(result.authoritativeStateReady,false);assert.equal(result.rewardEligible,false);
        assert.equal(h.committed,count+2);
        for(const [key,bytes] of original){assert.equal(JSON.stringify(h.data.get(key)),bytes);}
        assert.equal(h.data.size,original.size+2);
        const marker=h.data.get(root+"/operations/"+result.periodId);
        assert.equal(marker.snapshotSha256,h.data.get(root+"/playableSnapshots/5").sha256);
        assert.equal(marker.observedAt,Date.parse(after));
        const beforeRetry=JSON.stringify([...h.data]);
        h.setClock(Date.parse(after)+35*86400000);
        assert.deepEqual(await h.writer.observeDailyPeriod({},observation),{...result,unchanged:true});
        assert.equal(JSON.stringify([...h.data]),beforeRetry);assert.equal(h.committed,count+2);
        await unchangedRejection(h,{...observation,expectedRevision:6},/intent/);
    }
});

test("recorded dungeon usage and shop purchase batches remain exact in a later-day source",async()=>{
    const h=await periodHarness();
    rewritePeriodSources(h,records=>{
        records.progress.sidecars["daily-dungeon-state"].raw=
            ' { "date":"2026-10-15","used":{"exp":true,"material":false,"equipment":true} } ';
        records.progress.sidecars["equipment-shop-daily"].raw=
            '{"date":"2026-10-15","refreshCount":2,"soldOfferIds":["2026-10-15:0:1","2026-10-15:2:5"]}';
    });
    const raw=structuredClone(h.data.get(root+"/progress/current").sidecars);
    const result=await h.writer.observeDailyPeriod({},observation);
    assert.deepEqual(h.data.get(root+"/progress/current").sidecars,raw);
    const marker=h.data.get(root+"/operations/"+result.periodId);
    const {createHash}=require("node:crypto");
    for(const key of ["daily-dungeon-state","equipment-shop-daily"]){
        assert.equal(marker.periods[key].rawSha256,
            createHash("sha256").update(raw[key].raw,"utf8").digest("hex"));
    }
    await unchangedRejection(h,{...observation,operationId:"observe-period-0002"},/already observed/);
    h.data.get(save).serverRevision=6;h.data.get(root+"/account/current").serverRevision=6;
    assert.equal((await h.writer.observeDailyPeriod({},observation)).unchanged,true);
});

test("either lagging period can be observed but future, missing, historical and corrupt sources fail closed",async()=>{
    for(const key of ["daily-dungeon-state","equipment-shop-daily"]){
        const h=await periodHarness();
        rewritePeriodSources(h,records=>{
            const state=JSON.parse(records.progress.sidecars[key].raw);
            state.date="2026-10-16";records.progress.sidecars[key].raw=JSON.stringify(state);
        });
        assert.equal((await h.writer.observeDailyPeriod({},observation)).unchanged,false);
        for(const change of [
            records=>{records.progress.sidecars[key]={status:"not-applicable",raw:null};},
            records=>{const state=JSON.parse(records.progress.sidecars[key].raw);
                state.date="2026-10-17";records.progress.sidecars[key].raw=JSON.stringify(state);}]){
            const blocked=await periodHarness();
            // Historical v1 intentionally accepts opaque sidecar bytes; the
            // observation must still reject them without inventing a source.
            rewritePeriodSources(blocked,change);
            await unchangedRejection(blocked,observation,/inconsistent/);
        }
        const missing=await periodHarness();
        delete missing.data.get(root+"/progress/current").sidecars[key];
        await unchangedRejection(missing,observation,/inconsistent/);
        const corrupt=await periodHarness();
        corrupt.data.get(root+"/progress/current").sidecars[key].raw="{";
        await unchangedRejection(corrupt,observation,/inconsistent/);
    }
});

test("daily observation rejects imported dates, rewards, stale revisions and namespace collisions",async()=>{
    for(const extra of ["date","targetDate","observedAt","used","refreshCount","soldOfferIds",
        "gold","claimed","rewardEligible","authoritativeStateReady"]){
        const h=await periodHarness();
        await unchangedRejection(h,{...observation,[extra]:true},/only an ID/);
    }
    for(const args of [{...observation,expectedRevision:4},
        {...observation,operationId:"daily-period-20261016"}]){
        const h=await periodHarness();await unchangedRejection(h,args);
    }
    for(const collection of ["operations","grantOperations","ledgerEntries"]){
        for(const id of [observationId,"daily-period-20261016"]){
            const h=await periodHarness();h.data.set(root+"/"+collection+"/"+id,{kind:"other"});
            await unchangedRejection(h);
        }
    }
    for(const key of [root+"/account/current",root+"/characters/character-"+operationId,
        root+"/economy/current",root+"/progress/current",root+"/claimCheckpoints/current",
        root+"/playableSnapshots/5",root+"/recoveryArchives/5"]){
        const h=await periodHarness();h.data.delete(key);await unchangedRejection(h);
    }
    const tampered=await periodHarness();
    tampered.data.get(root+"/progress/current").sidecars["daily-dungeon-state"].raw="{}";
    await unchangedRejection(tampered,observation,/inconsistent/);
});

test("missing or altered original observation proof cannot be regenerated by replay or another intent",async()=>{
    for(const id of [observationId,"daily-period-20261016"]){
        const h=await periodHarness();await h.writer.observeDailyPeriod({},observation);
        h.data.delete(root+"/operations/"+id);
        await unchangedRejection(h);
        if(id===observationId){
            h.setClock(Date.parse("2026-10-20T16:00:00.000Z"));
            await unchangedRejection(h,observation,/missing its receipt/);
        }
    }
    for(const path of [root+"/playableSnapshots/5",root+"/recoveryArchives/5"]){
        const h=await periodHarness();await h.writer.observeDailyPeriod({},observation);
        h.data.delete(path);await unchangedRejection(h,observation,/proof/);
    }
    for(const field of ["targetDate","observedAt","sourceRevision","snapshotSha256",
        "characterId","ownerUid","sha256","periods","rewardEligible","authoritativeStateReady"]){
        const h=await periodHarness();await h.writer.observeDailyPeriod({},observation);
        h.data.get(root+"/operations/daily-period-20261016")[field]="corrupt";
        await unchangedRejection(h,observation,/proof/);
        await unchangedRejection(h,{...observation,operationId:"observe-period-0002"},/proof/);
    }
    for(const field of ["kind","ownerUid","sourceSha256","expectedRevision","rewardEligible"]){
        const h=await periodHarness();await h.writer.observeDailyPeriod({},observation);
        h.data.get(root+"/operations/"+observationId)[field]="corrupt";
        await unchangedRejection(h);
        await unchangedRejection(h,{...observation,operationId:"observe-period-0002"});
    }
});

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
    const collection=path=>({path,doc(id){return ref(`${path}/${id}`);},
        limit(max){return {path,query:true,max};},
        where(field,operator,value){
            assert.equal(operator,"==");
            return {limit:()=>({path,filter:row=>row[field]===value})};
        }});
    const db={collection};
    let committed=0;
    const transaction={
        async get(reference){
            if(typeof reference.doc==="function"||reference.filter||reference.query){
                return {docs:[...data].filter(([key])=>key.startsWith(reference.path+"/")&&
                    !key.slice(reference.path.length+1).includes("/"))
                    .filter(([,value])=>!reference.filter||reference.filter(value))
                    .slice(0,reference.max??Infinity).map(([key,value])=>({
                    id:key.slice(reference.path.length+1),ref:ref(key),data:()=>value}))};
            }
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

async function retainedProof(h,id,account=h.data.get(`${root}/account/current`)){
    let reads=0;
    const ref=path=>({path,collection:name=>({doc:key=>ref(`${path}/${name}/${key}`)})});
    const tx={get:async reference=>{
        reads++;
        const value=h.data.get(reference.path);
        return {exists:value!==undefined,data:()=>value,get:key=>value?.[key]};
    }};
    const value=h.data.get(`${root}/operations/${id}`);
    const before=JSON.stringify([...h.data]),writes=h.committed;
    try{
        await h.writer.verifyRetainedOperation(tx,ref(root),uid,account,{id,data:()=>value});
    }finally{
        assert.equal(JSON.stringify([...h.data]),before);assert.equal(h.committed,writes);
        assert.ok(reads<=h.writer.retainedOperationReadBudget(value?.kind));
    }
}

test("recovery source proof reuses original initial and daily owners within a fixed read budget",async()=>{
    const h=await applicationHarness();
    await retainedProof(h,operationId);
    await retainedProof(h,observationId);
    await retainedProof(h,"daily-period-20261016");
    await h.writer.applyDailyPeriod({},application);
    await retainedProof(h,application.operationId);
    await retainedProof(h,"daily-period-applied-20261016");
    h.setClock(Date.parse("2026-10-16T16:00:00.000Z"));
    await h.writer.observeDailyPeriod({}, {operationId:"observe-period-0002",expectedRevision:6});
    await h.writer.applyDailyPeriod({}, {operationId:"apply-period-0002",
        periodId:"daily-period-20261017",expectedRevision:6});
    await retainedProof(h,"apply-period-0002");
    await retainedProof(h,operationId);
});

test("recovery initial proof rejects corrupt identity and original evidence without writes",async()=>{
    for(const change of [
        h=>h.data.get(`${root}/operations/${operationId}`).ownerUid="foreign",
        h=>h.data.get(`${root}/operations/${operationId}`).sourceRevision=8,
        h=>h.data.get(`${root}/operations/${operationId}`).selectionSha256="a".repeat(64),
        h=>h.data.get(`${root}/operations/${operationId}`).snapshotSha256="a".repeat(64),
        h=>h.data.delete(`${root}/playableSnapshots/5`),
        h=>h.data.delete(`${root}/recoveryArchives/5`),
        h=>h.data.get(`${root}/recoveryArchives/5`).sourceSha256="a".repeat(64)
    ]){
        const h=await periodHarness();change(h);
        await assert.rejects(retainedProof(h,operationId),e=>e.code==="data-loss");
    }
});

test("recovery daily proofs reject missing pairs and corrupt original history without writes",async()=>{
    for(const change of [
        h=>h.data.delete(`${root}/operations/${observationId}`),
        h=>h.data.get(`${root}/operations/daily-period-20261016`).sourceRevision=8,
        h=>h.data.get(`${root}/operations/daily-period-20261016`).sha256="a".repeat(64),
        h=>h.data.delete(`${root}/recoveryArchives/5`)
    ]){
        const h=await applicationHarness();change(h);
        await assert.rejects(retainedProof(h,"daily-period-20261016"),e=>e.code==="data-loss");
    }
    for(const change of [
        h=>h.data.delete(`${root}/operations/${application.operationId}`),
        h=>h.data.get(`${root}/operations/daily-period-applied-20261016`).sha256="a".repeat(64),
        h=>h.data.delete(`${root}/recoveryArchives/6`)
    ]){
        const h=await applicationHarness();await h.writer.applyDailyPeriod({},application);change(h);
        await assert.rejects(retainedProof(h,"daily-period-applied-20261016"),e=>e.code==="data-loss");
    }
});

test("recovery source owner rejects unsupported operation kinds without reads or writes",async()=>{
    for(const kind of [undefined,"unknown","battle-source-preparation","restricted-battle-terminal"]){
        const h=await periodHarness();h.data.set(`${root}/operations/unknown-operation-0001`,{
            schemaVersion:1,ownerUid:uid,kind});
        await assert.rejects(retainedProof(h,"unknown-operation-0001"),e=>e.code==="failed-precondition");
    }
});

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
