import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";

const source=fs.readFileSync(new URL("../js/firebase/firebase-auth-ui.js",import.meta.url),"utf8");
const start=source.indexOf("async function submitOriginalDeviceMigrationCandidate(){");
const end=source.indexOf("function clearResumeTimer(){",start);
assert.ok(start>=0&&end>start);
const actionSource=source.slice(start,end);

function harness(approve=true){
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
        busy:false,DEV_SESSION_TEST_ENABLED:true,state:{mode:"READY"},
        setBusy:value=>events.push(value?"busy":"idle"),render:()=>{},
        sessionTestFailureText:()=> "⚠️ 無法確認目前權限，請稍後再試。",
        console:{error:()=>{}},
        window:{FourSymbolsFirebase:api,FourSymbolsAccountSave:repository,
            rpgConfirm:async()=>{events.push("confirm");return approve;}}
    };
    vm.runInNewContext(actionSource,context);
    return {events,context,api,setUser:value=>{user=value;},setRevision:value=>{revision=value;},
        submit:()=>context.submitOriginalDeviceMigrationCandidate()};
}

test("explicit approval seals the original first, then submits only its backup key",async()=>{
    const h=harness();
    await h.submit();
    assert.deepEqual(h.events,["busy","backup","bootstrap","read","confirm","read",
        ["submit","sealed-a",2],"read","idle"]);
    assert.match(h.context.state.migrationCandidate,/未受信任/);
    assert.match(h.context.state.migrationCandidate,/不能取回角色/);
});

test("cancel preserves the local backup and sends no candidate",async()=>{
    const h=harness(false);
    await h.submit();
    assert.deepEqual(h.events,["busy","backup","bootstrap","read","confirm","idle"]);
    assert.match(h.context.state.migrationCandidate,/已取消提交/);
});

test("UID switch during confirmation blocks candidate submission",async()=>{
    const h=harness();
    h.context.window.rpgConfirm=async()=>{h.setUser({uid:"uid-b"});return true;};
    await h.submit();
    assert.equal(h.events.some(item=>Array.isArray(item)&&item[0]==="submit"),false);
});

test("cloud revision change during confirmation blocks candidate submission",async()=>{
    const h=harness();
    h.context.window.rpgConfirm=async()=>{h.setRevision(4);return true;};
    await h.submit();
    assert.equal(h.events.some(item=>Array.isArray(item)&&item[0]==="submit"),false);
    assert.match(h.context.state.migrationCandidate,/尚未提交/);
});

test("ambiguous readback does not claim successful migration",async()=>{
    const h=harness();
    h.api.resolveCloudSave=async()=>{h.events.push("read");return {exists:true,data:{
        ownerUid:"uid-a",serverRevision:2,authoritativeStateReady:false
    }};};
    await h.submit();
    assert.equal(h.events.some(item=>Array.isArray(item)&&item[0]==="submit"),true);
    assert.match(h.context.state.migrationCandidate,/結果尚未確認/);
});
