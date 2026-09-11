"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");

const loader=fs.readFileSync("js/20-anonymous-20.js","utf8")+fs.readFileSync("scripts/build-production.mjs","utf8");
const startup=fs.readFileSync("js/52-v173.20-startup-loader.js","utf8");
const firstPlay=fs.readFileSync("js/startup/first-play-resource-loader.js","utf8");
const featureLoader=fs.readFileSync("js/startup/feature-loader.js","utf8");
const build=fs.readFileSync("scripts/build-production.mjs","utf8");
const index=fs.readFileSync("index.html","utf8");

assert.doesNotMatch(loader,/TOTAL_RUNTIME_MODULES|runtime-ready|runtime-failed|createElement\(["']script["']\)/);
assert.doesNotMatch(startup,/MIN_DURATION|totalDuration|runtimeReady|12000|15000|\*\s*90/);
for(const state of ["AUTH_RESOLVING","AUTH_REQUIRED","SAVE_LOADING","NEED_CHARACTER","READY","ERROR"]){
    assert.ok(startup.includes(state),"startup owner declares "+state);
}
assert.match(startup,/renderFirstPlayProgress[\s\S]*firstPlay\.prepare/,
    "startup progress must be driven by the First Play loader");
assert.match(startup,/render\(100,"遊戲資源準備完成"/,
    "100% is reserved for verified First Play readiness");
assert.match(startup,/status\("帳號資料已確認"/,
    "post-download account phases may update status text without faking progress");
assert.match(startup,/status\("載入完成"/,
    "destination readiness may update status text without changing verified progress");
assert.match(firstPlay,/state\.loadedBytes\/state\.totalBytes/);
assert.match(firstPlay,/Image\.decode|image\.decode/);
assert.match(firstPlay,/crypto\.subtle\.digest\("SHA-256"/);
assert.match(firstPlay,/completedTasks===progressState\.totalTasks\?100/);
assert.match(featureLoader,/Promise\.all\(order\.map\(name=>prepareBundle/);
assert.match(featureLoader,/script\.async=false/);
assert.equal((featureLoader.match(/createElement\("script"\)/g)||[]).length,1);
assert.match(build,/"js\/equipment-progression\.js"[\s\S]*?"js\/53-v173\.50-inventory-qol\.js"[\s\S]*?"js\/54-v173\.51-battle-qa\.js"/);
assert.equal((index.match(/<script\b[^>]*\bsrc=/g)||[]).length,1);
assert.match(index,/build\/boot-core\.[0-9a-f]{12}\.js/);
assert.match(index,/<title>四象江湖傳 V173\.65<\/title>/);
console.log("✓ real First Play progress and deterministic feature loading");
