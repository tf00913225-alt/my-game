import assert from "node:assert/strict";
import fs from "node:fs";

const registry=JSON.parse(fs.readFileSync("config/monster-portrait-registry.json","utf8"));
const provenance=JSON.parse(fs.readFileSync("config/monster-asset-provenance.json","utf8"));
const manifest=JSON.parse(fs.readFileSync("asset-manifest.json","utf8"));
const towerRuntime=fs.readFileSync("js/gameplay-boss-tower-system.js","utf8");
const wildRuntime=fs.readFileSync("js/34-v141-core-systems.js","utf8");
const fields=Object.fromEntries(registry.tupleSchema.map((field,index)=>[field,index]));
const allRows=Object.values(registry.groups).flat();
const wildRows=registry.groups.wild.filter(row=>/^wild\.zone-\d+\.earth-01$/.test(row[fields.portraitKey]));
const towerRows=registry.groups["tower-earth"];
const pool=registry.assetPool.entries.filter(entry=>entry.element==="earth");
const adoptedPool=pool.filter(entry=>entry.status==="adopted");
const reservedPool=pool.filter(entry=>entry.status==="reserved");

assert.equal(wildRows.length,10,"earth wild roster must expose ten unique identities");
assert.equal(towerRows.length,29,"only 29 decodable earth tower Masters may be adopted");
assert.equal(adoptedPool.length,29);
assert.equal(adoptedPool.filter(entry=>entry.tier==="normal").length,10);
assert.equal(adoptedPool.filter(entry=>entry.tier==="elite").length,10);
assert.equal(adoptedPool.filter(entry=>entry.tier==="miniboss").length,9);
assert.deepEqual(reservedPool.map(entry=>entry.assetId),["MON_EARTH_MINIBOSS_010"]);
assert.equal(provenance.assets.some(entry=>entry.portraitKey==="MON_EARTH_MINIBOSS_010"),false,"corrupt Master must never become provenance-ready");
assert.equal(fs.existsSync(reservedPool[0].runtimePath),false,"corrupt Master must never produce Runtime WebP");

const coverage=registry.earthTowerCoverage;
assert.equal(coverage.normalByBand.length,10);
assert.equal(coverage.eliteByBand.length,10);
assert.deepEqual(Object.keys(coverage.bossByFloor),["10","20","30","40","50","60","70","80","90"]);
assert.deepEqual(coverage.missingFloor100,{assetId:"MON_EARTH_MINIBOSS_010",status:"reserved",reason:"SOURCE_PNG_DECODE_FAILED"});
const selected=[...coverage.normalByBand.flat(),...coverage.eliteByBand.flat(),...Object.values(coverage.bossByFloor)];
assert.deepEqual(new Set(selected),new Set(adoptedPool.map(entry=>entry.assetId)),"every adopted tower portrait must be used in its own tier");
for(const key of selected) assert.ok(towerRuntime.includes(`"${key}"`),key+" missing from earth tower Runtime plan");

const earthRows=[...wildRows,...towerRows];
const names=allRows.map(row=>row[fields.name]);
for(const row of earthRows){
    const key=row[fields.portraitKey];
    const name=row[fields.name];
    assert.match(name,/^[\u4e00-\u9fff]{2,4}$/,key+" name must be 2-4 Han characters");
    assert.equal(names.filter(candidate=>candidate===name).length,1,key+" global Registry name collision");
    assert.equal(row[fields.element],"earth");
    assert.equal(row[fields.status],"existing");
    assert.match(row[fields.path],/\.webp$/);
    assert.ok(fs.existsSync(row[fields.path]),key+" missing Runtime WebP");
    const entry=provenance.assets.find(item=>item.portraitKey===key);
    assert.equal(entry?.runtimeReady,true,key+" provenance not ready");
    assert.equal(entry.master.commit,"a27a9fd23192cfa82e2eafd69a831c7f980272ce");
    assert.match(entry.master.path,/^assets\/inbox\/英雄or怪物立繪\/土元素\/(普通怪|菁英怪|小Boss)\/.*\.png$/);
    assert.equal(entry.runtime.path,row[fields.path]);
    if(key.startsWith("wild.")){
        assert.ok(wildRuntime.includes(`"${name}"`),key+" Runtime name mismatch");
        assert.ok(wildRuntime.includes(`.earth-01"`),key+" explicit portrait identity missing");
    }
}

const expectedManifestKeys=new Set([...wildRows.map(row=>row[fields.portraitKey]),...adoptedPool.map(entry=>entry.assetId)]);
assert.deepEqual(new Set((manifest.runtimePortraits.earth||[]).map(entry=>entry.assetId)),expectedManifestKeys);
for(const element of ["fire","water","wind"]){
    assert.ok(manifest.runtimePortraits[element].every(entry=>!String(entry.assetId).includes("EARTH")&&!String(entry.assetId).includes(".earth-")),element+" manifest must exclude earth portraits");
}

console.log("Earth wild/tower identities, 39 valid portraits and corrupt-source quarantine passed.");
