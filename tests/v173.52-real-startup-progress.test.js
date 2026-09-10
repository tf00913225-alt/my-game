"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");

const loader=fs.readFileSync("js/20-anonymous-20.js","utf8")+fs.readFileSync("scripts/build-production.mjs","utf8");
const startup=fs.readFileSync("js/52-v173.20-startup-loader.js","utf8");
const featureLoader=fs.readFileSync("js/startup/feature-loader.js","utf8");
const build=fs.readFileSync("scripts/build-production.mjs","utf8");
const index=fs.readFileSync("index.html","utf8");

assert.doesNotMatch(loader,/TOTAL_RUNTIME_MODULES|runtime-ready|runtime-failed|createElement\(["']script["']\)/);
assert.doesNotMatch(startup,/MIN_DURATION|totalDuration|runtimeReady|12000|15000|\*\s*90/);
for(const state of ["AUTH_RESOLVING","AUTH_REQUIRED","SAVE_LOADING","NEED_CHARACTER","READY","ERROR"]){
    assert.ok(startup.includes(state),"startup owner declares "+state);
}
assert.match(startup,/render\(100,"帳號資料已確認"/);
assert.match(startup,/render\(100,"載入完成"/);
assert.match(featureLoader,/Promise\.all\(order\.map\(name=>prepareBundle/);
assert.match(featureLoader,/script\.async=false/);
assert.equal((featureLoader.match(/createElement\("script"\)/g)||[]).length,1);
assert.match(build,/"js\/equipment-progression\.js"[\s\S]*?"js\/53-v173\.50-inventory-qol\.js"[\s\S]*?"js\/54-v173\.51-battle-qa\.js"/);
assert.equal((index.match(/<script\b[^>]*\bsrc=/g)||[]).length,1);
assert.match(index,/build\/boot-core\.[0-9a-f]{12}\.js/);
assert.match(index,/<title>四象江湖傳 V173\.65<\/title>/);
console.log("✓ real critical-task progress and deterministic feature loading");
