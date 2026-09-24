"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const releaseMeta=JSON.parse(fs.readFileSync("release/release.json","utf8"));
const battle=fs.readFileSync("js/54-v173.51-battle-qa.js","utf8");
const inventory=fs.readFileSync("js/55-v173.51-inventory-qa.js","utf8");
const loader=fs.readFileSync("js/20-anonymous-20.js","utf8")+fs.readFileSync("scripts/build-production.mjs","utf8");
const qol=fs.readFileSync("js/53-v173.50-inventory-qol.js","utf8");
const index=fs.readFileSync("index.html","utf8");
const build=fs.readFileSync("scripts/build-production.mjs","utf8");
assert.doesNotMatch(battle,/MutationObserver|observer\.observe\(/);
assert.doesNotMatch(battle,/stage\.style\.visibility/);
assert.doesNotMatch(inventory,/MutationObserver|obs\.observe\(/);
assert.match(inventory,/classList\.contains\("v17351-inventory-fullscreen"\)!==open/);
assert.equal((loader.match(/const V_ASSET_VERSION="([^"]+)"/)||[])[1],releaseMeta.cacheVersion);
for(const name of ["54-v173.51-battle-qa.js","55-v173.51-inventory-qa.js","57-v173.51-quest-qa.js"]){
  assert.ok(build.includes('"js/'+name+'"'),name+" fixed bundle entry");
}
assert.doesNotMatch(build,/"js\/56-v173\.51-shop-qa\.js"/, "retired shop QA runtime must not return to the production bundle");
assert.doesNotMatch(qol,/createElement\(["']script["']\)|\.onload\s*=/);
assert.ok(index.includes("<title>四象江湖傳 V"+releaseMeta.version+"</title>"));
console.log("✓ V173.62 fixes 29/32 startup microtask starvation");
