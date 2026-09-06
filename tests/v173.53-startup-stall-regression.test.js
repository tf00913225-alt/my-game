"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const battle=fs.readFileSync("js/54-v173.51-battle-qa.js","utf8");
const inventory=fs.readFileSync("js/55-v173.51-inventory-qa.js","utf8");
const loader=fs.readFileSync("js/20-anonymous-20.js","utf8");
const qol=fs.readFileSync("js/53-v173.50-inventory-qol.js","utf8");
const index=fs.readFileSync("index.html","utf8");
assert.doesNotMatch(battle,/observer\.observe\(document\.body,\{subtree:true,childList:true,attributes:true/);
assert.match(battle,/observer\.observe\(document\.body,\{subtree:true,childList:true\}\)/);
assert.match(battle,/stage\.style\.visibility!==nextVisibility/);
assert.doesNotMatch(inventory,/obs\.observe\(document\.body,\{subtree:true,childList:true,attributes:true/);
assert.match(inventory,/obs\.observe\(document\.body,\{subtree:true,childList:true\}\)/);
assert.match(inventory,/classList\.contains\("v17351-inventory-fullscreen"\)!==open/);
assert.match(loader,/const V_ASSET_VERSION="173\.53"/);
for(const name of ["54-v173.51-battle-qa.js","55-v173.51-inventory-qa.js","56-v173.51-shop-qa.js","57-v173.51-quest-qa.js"]){
  assert.ok(qol.includes(name+"?v=173.53"),name+" fresh cache key");
}
assert.match(index,/<title>四象江湖傳 V173\.53<\/title>/);
console.log("✓ V173.53 fixes 29/32 startup microtask starvation");
