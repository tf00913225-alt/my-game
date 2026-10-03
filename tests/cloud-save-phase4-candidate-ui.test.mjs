import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";

const source=fs.readFileSync(new URL("../js/firebase/firebase-auth-ui.js",import.meta.url),"utf8");
const start=source.indexOf("async function submitOriginalDeviceMigrationCandidate(){");
const end=source.indexOf("function clearResumeTimer(){",start);
assert.ok(start>=0&&end>start);
const actionSource=source.slice(start,end);

function harness(){
    const events=[];
    let user={uid:"uid-a"};
    let revision=2;
    const envelope=()=>({exists:true,data:{
        ownerUid:"uid-a",serverRevision:revision,authoritativeStateReady:false,
        migrationCandidateStatus:revision===3?"received":undefined,
        migrationCandidateRevision:revision===3?1:undefined,
        migrationCandidateFingerprint:revision===3?"fingerprint":undefined
    }});
    const repository={getActiveUid:()=>user?.uid||null};
    const api={
        getUser:()=>user,
        createLocalMigrationBackup:()=>{events.push("backup");return {backupKey:"sealed-a"};},
        bootstrapCloudSave:async()=>{events.push("bootstrap");return {ok:true};},
        resolveCloudSave:async()=>{events.push("read");return envelope();},
        submitLegacyMigrationCandidate:async options=>{
            events.push(["submit",options.backupKey,options.expectedRevision]);
            revision=3;
            return {ok:true,uid:"uid-a",acceptedAs:"untrusted-migration-candidate",
                authoritativeStateReady:false,revision:1,serverRevision:3,fingerprint:"fingerprint"};
        }
    };
    const context={
        busy:false,candidateConfirmation:null,DEV_SESSION_TEST_ENABLED:true,state:{mode:"READY"},
        setBusy:value=>events.push(value?"busy":"idle"),render:()=>{},
        sessionTestFailureText:()=> "⚠️ 無法確認目前權限，請稍後再試。",
        console:{error:()=>{}},
        window:{FourSymbolsFirebase:api,FourSymbolsAccountSave:repository}
    };
    vm.runInNewContext(actionSource,context);
    return {events,context,api,setUser:value=>{user=value;},setRevision:value=>{revision=value;},
        submit:()=>context.submitOriginalDeviceMigrationCandidate(),
        cancel:()=>context.cancelOriginalDeviceMigrationCandidate()};
}

test("cold account session stages consent without the lazy gameplay dialog, then submits the sealed backup",async()=>{
    const h=harness();
    await h.submit();
    assert.deepEqual(h.events,["busy","backup","bootstrap","read","idle"]);
    assert.match(h.context.state.migrationCandidate,/再按「確認提交私人候選」/);
    assert.equal(h.context.candidateConfirmation.backupKey,"sealed-a");
    await h.submit();
    assert.deepEqual(h.events.slice(5),["busy","read",["submit","sealed-a",2],"read","idle"]);
    assert.match(h.context.state.migrationCandidate,/未受信任/);
    assert.match(h.context.state.migrationCandidate,/不能取回角色/);
});

test("cancel after sealing preserves the backup and sends no candidate",async()=>{
    const h=harness();
    await h.submit();
    h.cancel();
    assert.deepEqual(h.events,["busy","backup","bootstrap","read","idle"]);
    assert.equal(h.context.candidateConfirmation,null);
    assert.match(h.context.state.migrationCandidate,/已取消提交/);
});

test("UID switch between the two taps blocks submission",async()=>{
    const h=harness();
    await h.submit();
    h.setUser({uid:"uid-b"});
    await h.submit();
    assert.equal(h.events.some(item=>Array.isArray(item)&&item[0]==="submit"),false);
    assert.equal(h.context.candidateConfirmation,null);
});

test("revision change between the two taps blocks submission",async()=>{
    const h=harness();
    await h.submit();
    h.setRevision(4);
    await h.submit();
    assert.equal(h.events.some(item=>Array.isArray(item)&&item[0]==="submit"),false);
    assert.match(h.context.state.migrationCandidate,/尚未提交/);
});

test("ambiguous readback does not claim successful migration",async()=>{
    const h=harness();
    await h.submit();
    h.api.resolveCloudSave=async()=>{h.events.push("read");return {exists:true,data:{
        ownerUid:"uid-a",serverRevision:2,authoritativeStateReady:false
    }};};
    await h.submit();
    assert.equal(h.events.some(item=>Array.isArray(item)&&item[0]==="submit"),true);
    assert.match(h.context.state.migrationCandidate,/結果尚未確認/);
});

test("leaving READY clears a pending candidate confirmation",()=>{
    const start=source.indexOf("export function setFirebaseAuthUiState(next={}){");
    assert.ok(start>=0);
    const context={
        candidateConfirmation:{uid:"uid-a",backupKey:"sealed-a",revision:2},
        state:{user:{uid:"uid-a"},mode:"READY",migrationCandidate:"已封存"},
        render:()=>{}
    };
    vm.runInNewContext(source.slice(start).replace(/^export /,""),context);
    context.setFirebaseAuthUiState({mode:"SAVE_LOADING"});
    assert.equal(context.candidateConfirmation,null);
});
