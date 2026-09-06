"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const inv=fs.readFileSync("js/55-v173.51-inventory-qa.js","utf8");
const loader=fs.readFileSync("js/20-anonymous-20.js","utf8");
const qol=fs.readFileSync("js/53-v173.50-inventory-qol.js","utf8");
const index=fs.readFileSync("index.html","utf8");
assert.match(inv,/if\(b\.textContent!==text\)b\.textContent=text/);
assert.match(inv,/if\(meta\.textContent!==text\)meta\.textContent=text/);
assert.match(inv,/let inventorySyncQueued=false/);
assert.match(inv,/new MutationObserver\(scheduleInventorySync\)/);
assert.doesNotMatch(inv,/new MutationObserver\(\(\)=>\{fullscreen\(\);picker\(\);syncSellUi\(\)\}\)/);
assert.match(loader,/const V_ASSET_VERSION="173\.58"/);
for(const name of ["54-v173.51-battle-qa.js","55-v173.51-inventory-qa.js","56-v173.51-shop-qa.js","57-v173.51-quest-qa.js"]){assert.ok(qol.includes(name+"?v=173.58"));}
assert.match(index,/<title>四象江湖傳 V173\.58<\/title>/);
console.log("✓ V173.58 inventory observer no longer self-triggers at module 30");
