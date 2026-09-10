"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");

const qol=fs.readFileSync("js/53-v173.50-inventory-qol.js","utf8");
const equipment=fs.readFileSync("js/equipment-progression.js","utf8");
const loader=fs.readFileSync("js/20-anonymous-20.js","utf8")+fs.readFileSync("scripts/build-production.mjs","utf8");
const ui=fs.readFileSync("js/51-v169-rpg-ui.js","utf8");
const index=fs.readFileSync("index.html","utf8");
const build=fs.readFileSync("scripts/build-production.mjs","utf8");
const featureLoader=fs.readFileSync("js/startup/feature-loader.js","utf8");

for(const name of ["54-v173.51-battle-qa.js","55-v173.51-inventory-qa.js","56-v173.51-shop-qa.js","57-v173.51-quest-qa.js"]){
    assert.ok(build.includes('"js/'+name+'"'));
}
assert.doesNotMatch(qol,/createElement\(["']script["']\)|\.onload\s*=/);
assert.doesNotMatch(equipment,/createElement\(["']script["']\)|v17351:qa-ready|30000/);
assert.doesNotMatch(ui,/createElement\(["']script["']\)|equipment-progression\.js\?v=/);
assert.match(featureLoader,/script\.async=false/);
assert.match(loader,/const V_ASSET_VERSION="173\.65"/);
assert.doesNotMatch(loader,/runtimeReady|TOTAL_RUNTIME_MODULES/);
assert.match(index,/build\/boot-core\.[0-9a-f]{12}\.js/);
assert.match(index,/<title>四象江湖傳 V173\.65<\/title>/);
console.log("✓ bundled QA execution order without HTTP readiness chain");
