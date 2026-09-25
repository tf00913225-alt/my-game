"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const releaseMeta=JSON.parse(fs.readFileSync("release/release.json","utf8"));
const inv=fs.readFileSync("js/55-v173.51-inventory-qa.js","utf8");
const loader=fs.readFileSync("js/20-anonymous-20.js","utf8")+fs.readFileSync("scripts/build-production.mjs","utf8");
const qol=fs.readFileSync("js/53-v173.50-inventory-qol.js","utf8");
const index=fs.readFileSync("index.html","utf8");
const build=fs.readFileSync("scripts/build-production.mjs","utf8");
assert.match(inv,/if\(b\.textContent!==text\)b\.textContent=text/);
assert.match(inv,/if\(meta\.textContent!==text\)meta\.textContent=text/);
assert.doesNotMatch(inv,/let inventorySyncQueued=false|scheduleInventorySync|v17351SyncInventoryQa/);
assert.doesNotMatch(inv,/MutationObserver|setInterval\s*\(/,
    "inventory QA must be lifecycle-driven in production, not observer/polling-driven");
assert.equal((loader.match(/const V_ASSET_VERSION="([^"]+)"/)||[])[1],releaseMeta.cacheVersion);
for(const name of ["54-v173.51-battle-qa.js","55-v173.51-inventory-qa.js","57-v173.51-quest-qa.js"]){assert.ok(build.includes('"js/'+name+'"'));}
assert.doesNotMatch(build,/"js\/56-v173\.51-shop-qa\.js"/,
    "retired shop QA runtime must not return to the production bundle");
assert.doesNotMatch(qol,/createElement\(["']script["']\)|\.onload\s*=/);
assert.ok(index.includes("<title>四象江湖傳 V"+releaseMeta.version+"</title>"));
console.log("✓ V173.62 inventory observer no longer self-triggers at module 30");
