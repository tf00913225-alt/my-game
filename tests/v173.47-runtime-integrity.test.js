const fs=require("node:fs");
const assert=require("node:assert/strict");

const loader=fs.readFileSync("js/20-anonymous-20.js","utf8")+fs.readFileSync("scripts/build-production.mjs","utf8");
const index=fs.readFileSync("index.html","utf8");
const ui=fs.readFileSync("js/51-v169-rpg-ui.js","utf8");
const equipment=fs.readFileSync("js/equipment-progression.js","utf8");
const animation=fs.readFileSync("js/39-v143-skill-animation.js","utf8");
const featureLoader=fs.readFileSync("js/startup/feature-loader.js","utf8");

assert.doesNotMatch(loader,/installV17347RuntimeReadinessGate|__v17347RuntimeGateFail|__v17347RuntimeGateRelease/);
assert.match(featureLoader,/Promise\.all\(order\.map\(name=>prepareBundle/);
assert.match(featureLoader,/script\.async=false/);
assert.match(index,/build\/boot-core\.[0-9a-f]{12}\.js/);
assert.doesNotMatch(ui,/equipment-progression\.js\?v=|createElement\(["']script["']\)/);
assert.doesNotMatch(equipment,/__v17347RuntimeGate/);

assert.match(equipment,/weapon-\(\?:03\|04\).*?"法扇":"法杖"/s);
assert.match(equipment,/normalizeGeneratedMageWeaponName/);
assert.doesNotMatch(equipment,/mage:\{shoulder:"法環",head:"法冠",armor:"法袍",shoes:"法履",weapon:"法器"\}/);

assert.match(animation,/function castSheet\(src,placement,options\)\{[\s\S]*?renderer:"dom-sprite"/);
assert.match(animation,/fireRocket:\{hit:DEFAULT_HIT,sprite:castSheet\("assets\/vfx\/fire\/fire-rocket-cast\.png\?v=165","trajectory",\{travelToTargets:true/);
assert.doesNotMatch(animation,/config\.id==="fireRocket"&&model\.sprite[\s\S]*?model\.sprite=null/);

assert.match(equipment,/equipmentDungeonWaveIndex<2/);
assert.match(equipment,/previousEquipmentPostBattleAutoRecovery/);
assert.match(equipment,/equipmentDungeonWaveIndex=index/);

console.log("V173.51 runtime integrity regressions passed");
