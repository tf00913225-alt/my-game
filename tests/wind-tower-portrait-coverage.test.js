import assert from 'node:assert/strict';
import fs from 'node:fs';

const registry=JSON.parse(fs.readFileSync('config/monster-portrait-registry.json','utf8'));
const provenance=JSON.parse(fs.readFileSync('config/monster-asset-provenance.json','utf8'));
const tower=fs.readFileSync('js/gameplay-boss-tower-system.js','utf8');
const wild=fs.readFileSync('js/34-v141-core-systems.js','utf8');
const manifest=JSON.parse(fs.readFileSync('asset-manifest.json','utf8'));
const fields=Object.fromEntries(registry.tupleSchema.map((field,i)=>[field,i]));
const rows=Object.values(registry.groups).flat();
const pool=registry.assetPool.entries.filter(entry=>entry.element==='wind');
assert.deepEqual(new Set((manifest.runtimePortraits.wind||[]).map(entry=>entry.assetId)),new Set(pool.map(entry=>entry.assetId)));
assert.ok(manifest.runtimePortraits.fire.every(entry=>!entry.assetId.startsWith('MON_WIND_')));
assert.equal(pool.length,40);
for(const [tier,count] of [['normal',20],['elite',10],['miniboss',10]])
    assert.equal(pool.filter(entry=>entry.tier===tier).length,count);
const keys=new Set(pool.map(entry=>entry.assetId));
const coverage=registry.windTowerCoverage;
assert.equal(coverage.normalByBand.length,10);
assert.equal(coverage.eliteByBand.length,10);
assert.equal(Object.keys(coverage.bossByFloor).length,10);
const selected=[...coverage.normalByBand.flat(),...coverage.eliteByBand.flat(),...Object.values(coverage.bossByFloor)];
assert.deepEqual(new Set(selected),keys,'every tower portrait must be used in its own tier');
for(const key of selected) assert.ok(tower.includes('"'+key+'"'),key+' missing from runtime plan');

const newRows=rows.filter(row=>keys.has(row[fields.portraitKey])||/^wild\.zone-\d+\.wind-01$/.test(row[fields.portraitKey]));
assert.equal(newRows.length,50);
const allNames=rows.map(row=>row[fields.name]).concat(registry.assetPool.entries.map(entry=>entry.displayName));
for(const row of newRows){
    const [key,name]=[row[fields.portraitKey],row[fields.name]];
    assert.match(name,/^[\u4e00-\u9fff]{2,4}$/,key+' name must be 2–4 Han characters');
    assert.equal(allNames.filter(candidate=>candidate===name).length,key.startsWith('MON_WIND_')?2:1,key+' global name collision');
    assert.equal(row[fields.status],'existing');
    assert.ok(fs.existsSync(row[fields.path]),key+' missing WebP');
    const entry=provenance.assets.find(item=>item.portraitKey===key);
    assert.equal(entry?.runtimeReady,true,key+' provenance not ready');
    assert.equal(entry.master.commit,'a27a9fd23192cfa82e2eafd69a831c7f980272ce');
    if(key.startsWith('wild.')) assert.ok(wild.includes('"'+name+'"'),key+' runtime name mismatch');
}
for(const entry of pool){
    assert.equal(entry.status,'adopted');
    assert.ok(entry.sourcePath.startsWith('assets/inbox/英雄or怪物立繪/風元素/'));
}
console.log('Wind wild/tower portrait coverage, names and provenance passed.');
