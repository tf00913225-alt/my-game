"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const {execFileSync}=require("node:child_process");

const html=fs.readFileSync("index.html","utf8");
const source=fs.readFileSync("js/52-v173.20-startup-loader.js","utf8");
const contract=fs.readFileSync("js/startup/startup-contract.js","utf8");
const loader=fs.readFileSync("js/20-anonymous-20.js","utf8")+fs.readFileSync("scripts/build-production.mjs","utf8");
const manifest=JSON.parse(fs.readFileSync("asset-manifest.json","utf8"));
const releaseMeta=JSON.parse(fs.readFileSync("release/release.json","utf8"));

for(const file of ["assets/ui/startup-logo.4631c0bc3f2b.jpg","assets/ui/startup-main-city.d43e67af1c1c.jpg"]){
    const details=execFileSync("identify",["-format","%m %w %h",file],{encoding:"utf8"});
    assert.equal(details,"JPEG 864 1536",file);
}
assert.ok(html.indexOf('id="startupLoader"')<html.indexOf('id="game-viewport"'),"boot shell must escape the transformed stage");
assert.equal((html.match(/<script\b[^>]*\bsrc=/g)||[]).length,1);
assert.match(html,/build\/boot-core\.[0-9a-f]{12}\.js/);
assert.match(html,/build\/boot-core\.[0-9a-f]{12}\.css/);
assert.equal((loader.match(/const V_ASSET_VERSION="([^"]+)"/)||[])[1],releaseMeta.cacheVersion);
assert.doesNotMatch(loader,/TOTAL_RUNTIME_MODULES|__v173ReportRuntimeProgress|createElement\(["']script["']\)/);
assert.match(source,/Sole StartupStateMachine owner/);
for(const state of ["BOOT_LOADING","AUTH_RESOLVING","AUTH_REQUIRED","SAVE_LOADING","MIGRATION_REQUIRED","NEED_CHARACTER","READY","OFFLINE_READY","ERROR"]){
    assert.match(contract,new RegExp(`${state}:["']${state}["']`));
}
assert.match(contract,/AUTH_REQUIRED:Object\.freeze\(\["SAVE_LOADING","ERROR"\]\)/);
assert.match(contract,/SAVE_LOADING:Object\.freeze\(\["AUTH_REQUIRED","MIGRATION_REQUIRED","NEED_CHARACTER","READY","OFFLINE_READY","ERROR"\]\)/);
assert.match(source,/safeCloudEmpty/);
assert.match(source,/canShowCharacterCreation:\(\)=>contract\.canCreateCharacter/);
assert.match(source,/global\.getComputedStyle\(root\)\.transitionDuration/);
assert.doesNotMatch(source,/12000|15000|MIN_DURATION|totalDuration|runtimeReady/);
assert.equal(manifest.featureManifest.features.patrol,"feature-patrol");
assert.match(html,/startupCityScene/);
assert.match(html,/startup-main-city\.d43e67af1c1c\.jpg/);
assert.match(source,/showCity/);
assert.match(source,/const logoTargetMs=Math\.max\(5000,/);
assert.match(source,/const cityTargetMs=5000/);
assert.match(source,/await delay\(logoTargetMs\);[\s\S]*?showCity[\s\S]*?await delay\(cityTargetMs\)/);
assert.match(source,/CREATION_PORTRAITS/);
assert.match(source,/await prepareCreationRender\(\)/);
console.log("✓ account-first startup state machine with real readiness");

// Exercise the real presentation lifecycle, including a callback already queued
// when a new destination requests the shell again.
(async()=>{
    const vm=require("node:vm");
    const classes=new Set(),timers=new Map();let nextTimer=0;
    const root={hidden:false,classList:{add:c=>classes.add(c),remove:c=>classes.delete(c)},setAttribute(){}};
    const global={
        getComputedStyle:()=>({transitionDuration:"0.36s, 0s"}),
        setTimeout(fn,ms){assert.equal(ms,360);timers.set(++nextTimer,fn);return nextTimer;},
        clearTimeout(){}
    };
    const lifecycle=source.slice(source.indexOf("    let exitOp=null;"),source.indexOf("    function accountUi("));
    const context={root,global,Promise,parseFloat,showCity(){}};
    vm.runInNewContext(lifecycle+"this.show=showLoader;this.hide=hideLoader;",context);
    const first=context.hide();assert.equal(context.hide(),first,"one active exit per shell");
    const stale=timers.get(1);
    context.show();await first;stale();
    assert.equal(root.hidden,false,"cancelled exit cannot hide the next loading destination");
    assert.equal(classes.has("is-leaving"),false);
    const second=context.hide();timers.get(2)();await second;
    assert.equal(root.hidden,true);
    context.show();assert.equal(root.hidden,false,"retry restores the same shell");
    console.log("✓ startup exit cancellation, idempotence and retry");
})().catch(error=>{console.error(error);process.exitCode=1;});
