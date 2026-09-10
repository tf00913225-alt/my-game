"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const {execFileSync}=require("node:child_process");

const html=fs.readFileSync("index.html","utf8");
const source=fs.readFileSync("js/52-v173.20-startup-loader.js","utf8");
const contract=fs.readFileSync("js/startup/startup-contract.js","utf8");
const loader=fs.readFileSync("js/20-anonymous-20.js","utf8")+fs.readFileSync("scripts/build-production.mjs","utf8");
const manifest=JSON.parse(fs.readFileSync("asset-manifest.json","utf8"));

for(const file of ["assets/ui/startup-logo.4631c0bc3f2b.jpg","assets/ui/startup-main-city-v173.20.jpg"]){
    const details=execFileSync("identify",["-format","%m %w %h",file],{encoding:"utf8"});
    assert.equal(details,"JPEG 864 1536",file);
}
assert.ok(html.indexOf('id="startupLoader"')<html.indexOf('id="app"'));
assert.equal((html.match(/<script\b[^>]*\bsrc=/g)||[]).length,1);
assert.match(html,/build\/boot-core\.[0-9a-f]{12}\.js/);
assert.match(html,/build\/boot-core\.[0-9a-f]{12}\.css/);
assert.match(loader,/const V_ASSET_VERSION="173\.64"/);
assert.doesNotMatch(loader,/TOTAL_RUNTIME_MODULES|__v173ReportRuntimeProgress|createElement\(["']script["']\)/);
assert.match(source,/Sole StartupStateMachine owner/);
for(const state of ["BOOT_LOADING","AUTH_RESOLVING","AUTH_REQUIRED","SAVE_LOADING","MIGRATION_REQUIRED","NEED_CHARACTER","READY","OFFLINE_READY","ERROR"]){
    assert.match(contract,new RegExp(`${state}:["']${state}["']`));
}
assert.match(contract,/AUTH_REQUIRED:Object\.freeze\(\["SAVE_LOADING","ERROR"\]\)/);
assert.match(contract,/SAVE_LOADING:Object\.freeze\(\["AUTH_REQUIRED","MIGRATION_REQUIRED","NEED_CHARACTER","READY","OFFLINE_READY","ERROR"\]\)/);
assert.match(source,/safeCloudEmpty/);
assert.match(source,/canShowCharacterCreation:\(\)=>contract\.canCreateCharacter/);
assert.match(source,/global\.setTimeout\(\(\)=>\{ root\.hidden=true;[\s\S]*?\},360\)/);
assert.doesNotMatch(source,/12000|15000|MIN_DURATION|totalDuration|runtimeReady/);
assert.equal(manifest.featureManifest.features.patrol,"feature-patrol");
assert.doesNotMatch(html,/startup-main-city-v173\.20\.jpg/);
console.log("✓ account-first startup state machine with real readiness");
