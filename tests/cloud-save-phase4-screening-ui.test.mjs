import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";

const ui=fs.readFileSync(new URL("../js/firebase/firebase-auth-ui.js",import.meta.url),"utf8");
const client=fs.readFileSync(new URL("../js/firebase/firebase-cloud-save.js",import.meta.url),"utf8");
const bootstrap=fs.readFileSync(new URL("../js/firebase/firebase-bootstrap.js",import.meta.url),"utf8");
const bootQa=fs.readFileSync(new URL("../.github/scripts/run-boot-architecture-browser-qa.mjs",import.meta.url),"utf8");
const action=ui.slice(ui.indexOf("const CANDIDATE_BLOCKER_LABELS="),ui.indexOf("function cancelOriginalDeviceMigrationCandidate(){"));
assert.ok(action.includes("async function screenCurrentMigrationCandidate(){"));

function harness(){
    let user={uid:"uid-a"};
    let revision=4;
    const calls=[];
    const envelope=()=>({exists:true,data:{ownerUid:"uid-a",serverRevision:revision,
        authoritativeStateReady:false,migrationCandidateStatus:"received",
        migrationCandidateRevision:1,migrationCandidateFingerprint:"digest"}});
    const api={getUser:()=>user,resolveCloudSave:async()=>{calls.push("read");return envelope();},
        screenLegacyMigrationCandidate:async(candidate,expected)=>{
            calls.push(["screen",candidate,expected]);
            return {candidateRevision:1,serverRevision:4,fingerprint:"digest",status:"blocked",
                readyForAcceptance:false,blockers:["HISTORICAL_REWARDS_UNVERIFIED","DAILY_QUESTS_CLAIM_RECORD_INVALID"]};
        }};
    const context={busy:false,DEV_SESSION_TEST_ENABLED:true,state:{mode:"READY"},
        setBusy:()=>{},render:()=>{},console:{error:()=>{}},
        sessionTestFailureText:()=>"⚠️ 無法確認目前權限，請稍後再試。",
        window:{FourSymbolsFirebase:api}};
    vm.runInNewContext(action,context);
    return {context,api,calls,setUser:value=>{user=value;},setRevision:value=>{revision=value;},
        run:()=>context.screenCurrentMigrationCandidate()};
}

test("current Revision 1 is screened read-only and blocker meanings are visible",async()=>{
    const h=harness(); await h.run();
    assert.deepEqual(h.calls,["read",["screen",1,4],"read"]);
    assert.match(h.context.state.candidateScreening,/候選 Revision 1 唯讀審查：仍受阻擋/);
    assert.match(h.context.state.candidateScreening,/歷史獎勵來源尚未證實/);
    assert.match(h.context.state.candidateScreening,/每日任務領獎紀錄不正確/);
    assert.match(h.context.state.candidateScreening,/不能在其他手機取回角色/);
});

test("sealed missing sidecar names are displayed without raw bytes or authority claims",async()=>{
    const h=harness();h.api.screenLegacyMigrationCandidate=async()=>({
        candidateRevision:1,serverRevision:4,fingerprint:"digest",status:"blocked",
        readyForAcceptance:false,
        blockers:["HISTORICAL_REWARDS_UNVERIFIED","SIDECAR_BACKUP_MISSING"],
        missingClaimSidecars:["quest-milestones","abyss-state"]
    });
    await h.run();
    assert.match(h.context.state.candidateScreening,/任務里程碑（quest-milestones）/);
    assert.match(h.context.state.candidateScreening,/深淵紀錄（abyss-state）/);
    assert.match(h.context.state.candidateScreening,/不能在其他手機取回角色/);
});

test("unexpected sidecar identifiers fail closed instead of entering the UI",async()=>{
    const h=harness();h.api.screenLegacyMigrationCandidate=async()=>({
        candidateRevision:1,serverRevision:4,fingerprint:"digest",status:"blocked",
        readyForAcceptance:false,blockers:["SIDECAR_BACKUP_MISSING"],
        missingClaimSidecars:["private-raw-value"]
    });
    await h.run();assert.match(h.context.state.candidateScreening,/無法確認目前候選/);
    assert.doesNotMatch(h.context.state.candidateScreening,/private-raw-value/);
});

test("missing current candidate never calls screening or submission",async()=>{
    const h=harness();h.api.resolveCloudSave=async()=>({exists:false,data:null});
    await h.run();assert.deepEqual(h.calls,[]);
    assert.match(h.context.state.candidateScreening,/無法確認目前候選/);
});

test("revision change during screening discards stale blockers",async()=>{
    const h=harness();h.api.screenLegacyMigrationCandidate=async(candidate,expected)=>{
        h.calls.push(["screen",candidate,expected]);h.setRevision(5);
        return {candidateRevision:1,serverRevision:4,fingerprint:"digest",status:"blocked",
            readyForAcceptance:false,blockers:["HISTORICAL_REWARDS_UNVERIFIED"]};
    };
    await h.run();assert.match(h.context.state.candidateScreening,/無法確認目前候選/);
    assert.doesNotMatch(h.context.state.candidateScreening,/歷史獎勵來源尚未證實/);
});

test("UID switch drops the previous account's screening result",async()=>{
    const h=harness();h.api.screenLegacyMigrationCandidate=async()=>{
        h.setUser({uid:"uid-b"});return {candidateRevision:1,serverRevision:4,status:"blocked",
            readyForAcceptance:false,blockers:["HISTORICAL_REWARDS_UNVERIFIED"]};
    };
    await h.run();assert.match(h.context.state.candidateScreening,/正在唯讀審查/);
    assert.doesNotMatch(h.context.state.candidateScreening,/歷史獎勵來源尚未證實/);
});

test("client routes exact revisions through the protected session owner",()=>{
    assert.match(client,/callTrustedFunction\("screenLegacyMigrationCandidate",\{candidateRevision,expectedRevision\}\)/);
    assert.match(bootstrap,/screenLegacyMigrationCandidate,saveLocalAutoBattlePreferences/);
    assert.match(ui,/firebaseCandidateScreeningButton.*審查目前私人候選/);
    assert.match(bootQa,/export async function screenLegacyMigrationCandidate\(\)/);
});
