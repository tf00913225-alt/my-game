import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";

const source=fs.readFileSync(new URL("../js/firebase/firebase-auth-ui.js",import.meta.url),"utf8");
const start=source.indexOf("async function restoreCloudPreferences(){");
const end=source.indexOf("function clearResumeTimer(){",start);
assert.ok(start>=0&&end>start);
const restoreSource=source.slice(start,end);

function harness(confirm,options={}){
    const events=[];
    let user={uid:"uid-a"};
    const cloud={exists:true,data:{ownerUid:"uid-a",preferencesVersion:1,serverRevision:2,preferences:{autoConfig:{hp:25}}}};
    const api={getUser:()=>user,resolveCloudSave:async()=>{events.push("read");return cloud;}};
    const context={busy:false,DEV_SESSION_TEST_ENABLED:true,state:{mode:"READY"},
        setBusy:value=>events.push(value?"busy":"idle"),render:()=>{},
        console:{error:()=>{}},window:{FourSymbolsFirebase:api,
            rpgConfirm:async()=>{events.push("confirm");await Promise.resolve();return confirm;},
            FourSymbolsGameSave:{restoreAutoBattlePreferences:(uid,prefs)=>events.push([uid,prefs.autoConfig.hp])}}
    };
    vm.runInNewContext(restoreSource,context);
    return {events,context,api,cloud,setUser:value=>user=value,restore:()=>context.restoreCloudPreferences()};
}

test("RPG confirm approval restores only after confirmation and fresh cloud read",async()=>{
    const h=harness(true);
    await h.restore();
    assert.deepEqual(h.events,["busy","read","confirm","read",["uid-a",25],"idle"]);
    assert.match(h.context.state.cloudPreferencesTest,/設定已取回/);
});

test("cancel never writes the local save",async()=>{
    const h=harness(false);
    await h.restore();
    assert.deepEqual(h.events,["busy","read","confirm","idle"]);
    assert.match(h.context.state.cloudPreferencesTest,/已取消取回/);
});

test("account switch during asynchronous confirmation cannot restore previous UID",async()=>{
    const h=harness(true);
    h.context.window.rpgConfirm=async()=>{h.setUser({uid:"uid-b"});return true;};
    await h.restore();
    assert.deepEqual(h.events,["busy","read","idle"]);
    assert.match(h.context.state.cloudPreferencesTest,/未能取回/);
});

test("a changed cloud revision after confirmation cannot restore stale data",async()=>{
    const h=harness(true);
    let calls=0;
    h.api.resolveCloudSave=async()=>{calls++;return {...h.cloud,data:{...h.cloud.data,serverRevision:calls===1?2:3}};};
    await h.restore();
    assert.ok(!h.events.some(event=>Array.isArray(event)));
    assert.match(h.context.state.cloudPreferencesTest,/未能取回/);
});
