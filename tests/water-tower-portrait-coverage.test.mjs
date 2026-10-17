import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const registry=JSON.parse(fs.readFileSync('config/monster-portrait-registry.json'));const provenance=JSON.parse(fs.readFileSync('config/monster-asset-provenance.json'));const source=fs.readFileSync('js/gameplay-boss-tower-system.js','utf8');const manifest=JSON.parse(fs.readFileSync('asset-manifest.json'));const rows=Object.values(registry.groups).flat();const byKey=new Map(rows.map(r=>[r[0],r]));
const declarations=source.slice(source.indexOf('    const FIRE_TOWER_PORTRAIT_PLAN'),source.indexOf('    function towerBossName'));
const context=vm.createContext({});vm.runInContext(declarations+';globalThis.select=towerPortraitAssetId;',context);const plan=registry.waterTowerCoverage;
assert.equal(registry.groups['tower-water'].length,20);assert.equal(new Set(plan.normalByBand.flat()).size,20);assert.equal(new Set(plan.eliteByBand.flat()).size,10);
for(let band=0;band<10;band++)for(const role of ['regular','elite'])for(let slot=0;slot<6;slot++){
 const key=context.select('water',band*10+1,role,slot);const row=byKey.get(key);assert.ok(row);assert.equal(row[2],'water');assert.equal(row[6],'existing');assert.ok(fs.existsSync(row[5]));assert.equal(key,(role==='elite'?plan.eliteByBand:plan.normalByBand)[band][slot%(role==='elite'?1:2)]);
}
for(let floor=10;floor<=100;floor+=10)assert.equal(context.select('water',floor,'boss',0),null,'missing approved tower boss identity must not borrow another image');
for(const row of registry.groups['tower-water']){assert.notEqual(row[1],'天兵天將','authorized water Tower appearance names');assert.match(row[1],/^[\u4e00-\u9fff]{2,4}$/);assert.equal(row[4],'standard');const p=provenance.assets.find(e=>e.portraitKey===row[0]);assert.equal(p.runtimeReady,true);assert.equal(p.master.commit,'f4c6886fa28522a7e7d4c936d050333d97908bbf');assert.equal(p.runtime.path,row[5]);}
for(const key of [...plan.normalByBand.flat(),...plan.eliteByBand.flat()])assert.ok(manifest.runtimePortraits.water.some(e=>e.assetId===key));
for(const key of ['tower-boss.water.envoy','tower-boss.water.venerable'])assert.equal(byKey.get(key)[6],'planned');
assert.equal(byKey.get('soldier.water')[5],'assets/monsters/soldiers/heavenly-soldier-water.png','Abyss soldier contract preserved');
console.log('Water tower 10 bands / 120 slot selections, 30 approved assets, preserved names and blocked boss identities PASS.');
