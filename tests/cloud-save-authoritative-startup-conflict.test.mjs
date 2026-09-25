import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

// Execute the real decision branch without booting the browser or Firebase.
const source=readFileSync(new URL("../js/52-v173.20-startup-loader.js",import.meta.url),"utf8");
const start=source.indexOf("        let selectedSave=authoritative;");
const end=source.indexOf("        if(authoritative){",start);
assert.ok(start>=0 && end>start);
const select=new Function("authoritative","local","repo","user","migration","fail","token",
    `${source.slice(start,end)}\nreturn {selectedSave};`);

function run(local){
    const cloud={player:{id:"a"},gold:100};
    const writes=[];
    const conflicts=[];
    const repo={
        fingerprint:save=>JSON.stringify(save),
        writeForUid:(...args)=>writes.push(args)
    };
    const result=select(cloud,local,repo,{uid:"uid-a"},(...args)=>{
        conflicts.push(args);
        return {blocked:true};
    },error=>{ throw error; },0);
    return {cloud,result,writes,conflicts};
}

test("an identical UID cache reads the cloud snapshot and repairs provenance only",()=>{
    const cloud={player:{id:"a"},gold:100};
    const fingerprint=JSON.stringify(cloud);
    const {result,writes,conflicts}=run({status:"ready",save:cloud,metadata:{cloudBaseFingerprint:fingerprint,localDirty:true}});
    assert.deepEqual(result.selectedSave,cloud);
    assert.equal(writes.length,1);
    assert.equal(writes[0][2].localDirty,false);
    assert.equal(conflicts.length,0);
});

test("a changed local save with a matching base stays intact and blocks gameplay",()=>{
    const cloud={player:{id:"a"},gold:100};
    const candidate={player:{id:"a"},gold:999999};
    const {result,writes,conflicts}=run({status:"ready",save:candidate,metadata:{cloudBaseFingerprint:JSON.stringify(cloud),localDirty:true}});
    assert.deepEqual(result,{blocked:true});
    assert.equal(writes.length,0);
    assert.equal(conflicts.length,1);
    assert.equal(conflicts[0][1],true);
    assert.deepEqual(candidate,{player:{id:"a"},gold:999999});
});

test("an unrelated local save also blocks without overwriting either copy",()=>{
    const {result,writes,conflicts}=run({status:"ready",save:{player:{id:"b"}},metadata:{cloudBaseFingerprint:null}});
    assert.deepEqual(result,{blocked:true});
    assert.equal(writes.length,0);
    assert.equal(conflicts.length,1);
});

test("suspend cannot overwrite a local candidate while startup is blocked",()=>{
    const main=readFileSync(new URL("../js/00-main.js",import.meta.url),"utf8");
    const start=main.indexOf("    function persistBeforeSuspend(reason){");
    const end=main.indexOf("    if(lifecycleDiagnostics.sessionPreviouslyEntered)",start);
    assert.ok(start>=0 && end>start);
    const calls=[];
    let state="MIGRATION_REQUIRED";
    const lifecycleDiagnostics={backgroundSaveCount:0};
    const make=new Function("window","saveGame","lifecycleDiagnostics",
        `${main.slice(start,end)}\nreturn persistBeforeSuspend;`);
    const persist=make({FourSymbolsStartupPolicy:{getState:()=>state}},value=>{calls.push(value);return true;},lifecycleDiagnostics);
    for(const blocked of ["MIGRATION_REQUIRED","SAVE_LOADING","ERROR","NEED_CHARACTER"]){
        state=blocked;persist("pagehide");
    }
    assert.equal(calls.length,0);
    state="READY";persist("pagehide");
    state="OFFLINE_READY";persist("pagehide");
    assert.equal(calls.length,2);
    assert.equal(lifecycleDiagnostics.backgroundSaveCount,2);
});
