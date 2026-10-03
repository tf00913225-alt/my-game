"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const releaseMeta=JSON.parse(fs.readFileSync("release/release.json","utf8"));
const inv=fs.readFileSync("js/55-v173.51-inventory-qa.js","utf8");
const loader=fs.readFileSync("js/20-anonymous-20.js","utf8")+fs.readFileSync("scripts/build-production.mjs","utf8");
const qol=fs.readFileSync("js/53-v173.50-inventory-qol.js","utf8");
const index=fs.readFileSync("index.html","utf8");
const build=fs.readFileSync("scripts/build-production.mjs","utf8");
// Retired button/meta writers must not be restored to satisfy old fixtures.
// The runtime now delegates quick-sell rendering through its formal owner.
let syncCount=0;
const writes=[];
const changes=[];
const select={value:"white",dispatchEvent:event=>changes.push(event.type)};
const context=vm.createContext({
    window:{
        FourSymbolsAccountSave:{accountKey:name=>"test-uid:"+name},
        v17350SyncQuickSellModal(){ syncCount++; }
    },
    document:{getElementById:id=>id==="v17350QuickSellQuality"?select:null},
    localStorage:{setItem:(key,value)=>writes.push([key,value])},
    Event:class Event{constructor(type){this.type=type;}},
    Promise
});
vm.runInContext(inv,context);
assert.equal(syncCount,1,"installation delegates once without timers or observers");
context.window.v17351ChooseQuality("orange");
assert.equal(select.value,"orange");
assert.deepEqual(writes,[["test-uid:bulk-sell-quality","orange"]]);
assert.deepEqual(changes,["change"]);
assert.equal(syncCount,2,"quality change delegates once to the quick-sell owner");
context.window.v17351ChooseQuality("unknown");
assert.equal(select.value,"white","invalid quality falls back through the existing policy");
assert.equal(syncCount,3);
vm.runInContext(inv,context);
assert.equal(syncCount,3,"reinstallation cannot duplicate the lifecycle hook");
assert.doesNotMatch(inv,/b\.textContent!==text|meta\.textContent!==text/);
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
