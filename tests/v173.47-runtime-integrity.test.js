const fs=require("node:fs");
const assert=require("node:assert/strict");

const loader=fs.readFileSync("js/20-anonymous-20.js","utf8");
const index=fs.readFileSync("index.html","utf8");
const ui=fs.readFileSync("js/51-v169-rpg-ui.js","utf8");
const equipment=fs.readFileSync("js/equipment-progression.js","utf8");
const animation=fs.readFileSync("js/39-v143-skill-animation.js","utf8");

assert.ok(loader.indexOf("installV17347RuntimeReadinessGate")<loader.indexOf('const V_ASSET_VERSION="173.57"'),"readiness gate must install before late loaders can expose legacy UI");
assert.match(loader,/__v17347RuntimeGateFail/);
assert.match(loader,/stopImmediatePropagation/);
assert.match(index,/js\/20-anonymous-20\.js\?v=173\.57/);
assert.match(ui,/equipment-progression\.js\?v=173\.57/);
assert.match(equipment,/__v17347RuntimeGateRelease/);

assert.match(equipment,/weapon-\(\?:03\|04\).*?"法扇":"法杖"/s);
assert.match(equipment,/normalizeGeneratedMageWeaponName/);
assert.doesNotMatch(equipment,/mage:\{shoulder:"法環",head:"法冠",armor:"法袍",shoes:"法履",weapon:"法器"\}/);

assert.match(animation,/fireRocket:\{[\s\S]*?src:"assets\/vfx\/fire\/fire-rocket-cast\.png\?v=165"/);
assert.match(animation,/placement:"trajectory",travelToTargets:true/);
assert.doesNotMatch(animation,/config\.id==="fireRocket"&&model\.sprite[\s\S]*?model\.sprite=null/);

assert.match(equipment,/equipmentDungeonWaveIndex<2/);
assert.match(equipment,/previousEquipmentPostBattleAutoRecovery/);
assert.match(equipment,/equipmentDungeonWaveIndex=index/);

console.log("V173.51 runtime integrity regressions passed");
