import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import {createRequire} from "node:module";

const require=createRequire(import.meta.url);
const {normalizePreferences}=require("../functions/src/cloud-preferences.js");

const source=fs.readFileSync(new URL("../js/00-main.js",import.meta.url),"utf8");
const start=source.indexOf("function restoreAutoBattlePreferences(uid,preferences){");
const end=source.indexOf("/* V111：",start);
assert.ok(start>=0&&end>start,"Phase 4 restore must remain inside the gameplay save owner");
const restoreSource=source.slice(start,end);
const config=()=>({enabled:false,skill:"normal",hp:50,sp:25,returnToCityWhenEmpty:false});
const preferences=()=>({
    characterIds:["hero-a",null,null],
    autoConfig:{...config(),enabled:true,skill:"fireRocket"},
    autoConfig2:config(),autoConfig3:config()
});
function owner(){
    const local={player:{id:"hero-a"},gold:1200,inventoryItems:[{id:"ore",count:2}],autoConfig:config(),autoConfig2:config(),autoConfig3:config()};
    const writes=[];
    const context={
        SAVE_KEY:"four_symbols_save:uid-a",player:{id:"hero-a"},
        autoConfig:config(),autoConfig2:config(),autoConfig3:config(),
        window:{FourSymbolsAccountSave:{
            getActiveUid:()=>"uid-a",saveKey:uid=>"four_symbols_save:"+uid,
            readForUid:()=>({status:"ready",save:local})
        }},
        saveGame(options){
            writes.push({options,save:{...local,autoConfig:{...context.autoConfig},autoConfig2:{...context.autoConfig2},autoConfig3:{...context.autoConfig3}}});
            return true;
        }
    };
    vm.runInNewContext(restoreSource,context);
    return {local,writes,context,restore:(uid,value)=>context.restoreAutoBattlePreferences(uid,value)};
}

test("explicit same-UID restore changes only character-bound auto-battle settings",()=>{
    const setup=owner();
    assert.equal(setup.restore("uid-a",preferences()),true);
    assert.equal(setup.writes.length,1);
    assert.equal(setup.writes[0].options.source,"cloud-preferences-restore");
    assert.equal(setup.writes[0].save.autoConfig.skill,"fireRocket");
    assert.equal(setup.writes[0].save.gold,1200);
    assert.deepEqual(setup.writes[0].save.inventoryItems,[{id:"ore",count:2}]);
});

test("different UID, changed character or reward-bearing field fail before local save",()=>{
    const setup=owner();
    assert.throws(()=>setup.restore("uid-b",preferences()),/different UID/);
    assert.throws(()=>setup.restore("uid-a",{...preferences(),characterIds:["other",null,null]}),/unsupported fields/);
    assert.throws(()=>setup.restore("uid-a",{...preferences(),gold:9000}),/unsupported fields/);
    assert.equal(setup.writes.length,0);
    assert.equal(setup.context.autoConfig.skill,"normal");
});

test("local save failure restores in-memory settings",()=>{
    const setup=owner();
    setup.context.saveGame=()=>false;
    assert.throws(()=>setup.restore("uid-a",preferences()),/Failed to save/);
    assert.equal(setup.context.autoConfig.skill,"normal");
});

test("offline Boot QA cloud double exports the Phase 4 bridge but never writes",async()=>{
    const qa=fs.readFileSync(new URL("../.github/scripts/run-boot-architecture-browser-qa.mjs",import.meta.url),"utf8");
    const match=qa.match(/const fakeCloud=String\.raw`([\s\S]*?)`;/);
    assert.ok(match,"Boot QA cloud module double must exist");
    const stub=await import("data:text/javascript,"+encodeURIComponent(match[1]));
    await assert.rejects(stub.saveLocalAutoBattlePreferences(),/QA never performs a cloud write/);
});

test("older UID saves project only approved preference fields before upload",async()=>{
    const client=fs.readFileSync(new URL("../js/firebase/firebase-cloud-save.js",import.meta.url),"utf8");
    const start=client.indexOf("export async function saveLocalAutoBattlePreferences(expectedRevision){");
    const end=client.indexOf("export async function submitLegacyMigrationCandidate",start);
    assert.ok(start>=0&&end>start);
    const raw={
        player:{id:"hero-a"},player2:null,player3:null,gold:9000,
        autoConfig:{enabled:true,skill:"normal",hp:50,inventoryItems:[{id:"ore"}]},
        autoConfig2:{skill:"normal"}
    };
    const writes=[];
    const context={
        requireSignedInUid:()=>"uid-a",
        window:{FourSymbolsAccountSave:{getActiveUid:()=>"uid-a",readForUid:()=>({status:"ready",save:raw})}},
        callTrustedFunction:async(name,payload)=>{writes.push({name,payload});return {ok:true};}
    };
    vm.runInNewContext(client.slice(start,end).replace("export async function","async function"),context);
    assert.equal((await context.saveLocalAutoBattlePreferences(1)).ok,true);
    assert.equal(writes.length,1);
    assert.equal(writes[0].name,"saveCloudPreferences");
    assert.equal(writes[0].payload.expectedRevision,1);
    const serialized=JSON.parse(JSON.stringify(writes[0].payload.preferences));
    assert.deepEqual(serialized.characterIds,["hero-a",null,null]);
    assert.deepEqual(serialized.autoConfig,{enabled:true,skill:"normal",hp:50,sp:25,returnToCityWhenEmpty:false});
    assert.deepEqual(serialized.autoConfig2,{enabled:false,skill:"normal",hp:50,sp:25,returnToCityWhenEmpty:false});
    assert.deepEqual(serialized.autoConfig3,serialized.autoConfig2);
    assert.deepEqual(normalizePreferences(serialized),serialized);
    assert.ok(!JSON.stringify(serialized).includes("gold"));
    assert.ok(!JSON.stringify(serialized).includes("inventoryItems"));
    assert.equal(raw.autoConfig.sp,undefined,"source save must not be rewritten");
});

test("ambiguous upload response does not claim cloud data was unchanged",async()=>{
    const ui=fs.readFileSync(new URL("../js/firebase/firebase-auth-ui.js",import.meta.url),"utf8");
    const start=ui.indexOf("async function testCloudPreferences(){");
    const end=ui.indexOf("async function restoreCloudPreferences(){",start);
    assert.ok(start>=0&&end>start);
    const context={
        busy:false,DEV_SESSION_TEST_ENABLED:true,state:{},setBusy:()=>{},render:()=>{},
        sessionTestFailureText:()=>"⚠️ 無法確認目前權限，請稍後再試。",
        console:{error:()=>{}},
        window:{FourSymbolsFirebase:{
            getUser:()=>({uid:"uid-a"}),bootstrapCloudSave:async()=>({ok:true}),
            resolveCloudSave:async()=>({exists:true,data:{ownerUid:"uid-a",serverRevision:1}}),
            saveLocalAutoBattlePreferences:async()=>{throw new Error("response lost after write");}
        }}
    };
    vm.runInNewContext(ui.slice(start,end),context);
    await context.testCloudPreferences();
    assert.match(context.state.cloudPreferencesTest,/結果尚未確認/);
    assert.match(context.state.cloudPreferencesTest,/請勿重複上傳/);
    assert.doesNotMatch(context.state.cloudPreferencesTest,/雲端未修改/);
});
