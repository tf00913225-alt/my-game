import assert from "node:assert/strict";
import fs from "node:fs";

const registry=JSON.parse(fs.readFileSync("config/monster-portrait-registry.json","utf8"));
const provenance=JSON.parse(fs.readFileSync("config/monster-asset-provenance.json","utf8"));
const manifest=JSON.parse(fs.readFileSync("asset-manifest.json","utf8"));
const runtime=fs.readFileSync("js/00-main.js","utf8");
const fields=Object.fromEntries(registry.tupleSchema.map((field,index)=>[field,index]));
const rows=registry.groups.wild.filter(row=>/^wild\.zone-\d+\.water-01$/.test(row[fields.portraitKey]));
const expectedNames=["水靈狐","浪尾獺","澤木妖","沼鉤怪","潮蛙卒","鱗潭獸","瀾花姬","海蜇巫","霜鬃狼","玄潮俠"];

assert.equal(rows.length,10,"batch 1 must contain exactly ten water wild targets");
assert.deepEqual(rows.map(row=>row[fields.name]),expectedNames);
const allNames=Object.values(registry.groups).flat().map(row=>row[fields.name]);
for(const row of rows){
    const key=row[fields.portraitKey];
    const name=row[fields.name];
    assert.match(name,/^[\u4e00-\u9fff]{2,4}$/,key+" name must be 2-4 Han characters");
    assert.equal(allNames.filter(candidate=>candidate===name).length,1,key+" global name collision");
    assert.equal(row[fields.element],"water");
    assert.equal(row[fields.status],"existing");
    assert.match(row[fields.path],/^assets\/monsters\/wild\/zone-\d+\/water-01\.webp$/);
    assert.ok(fs.existsSync(row[fields.path]),key+" missing Runtime WebP");
    assert.ok(runtime.includes(`"${name}"`)&&runtime.includes(`"${key}"`),key+" runtime identity missing");
    const entry=provenance.assets.find(item=>item.portraitKey===key);
    assert.equal(entry?.runtimeReady,true,key+" provenance not ready");
    assert.equal(entry.master.commit,"a27a9fd23192cfa82e2eafd69a831c7f980272ce");
    assert.match(entry.master.path,/^assets\/inbox\/英雄or怪物立繪\/水元素\/普通怪\/.*\.png$/);
    assert.equal(entry.runtime.path,row[fields.path]);
}

assert.deepEqual(new Set((manifest.runtimePortraits.water||[]).map(entry=>entry.assetId)),new Set(rows.map(row=>row[fields.portraitKey])));
assert.ok(manifest.runtimePortraits.fire.every(entry=>!String(entry.assetId).includes(".water-")),"fire manifest must exclude water wild portraits");
assert.ok(manifest.runtimePortraits.wind.every(entry=>!String(entry.assetId).includes(".water-")),"wind manifest must exclude water wild portraits");
assert.equal(registry.groups.wild.filter(row=>row[fields.element]==="water"&&row[fields.status]==="planned").length,8,"second water identities remain planned");
console.log("Water wild portrait batch 1 registry, runtime names, provenance and manifest isolation passed.");
