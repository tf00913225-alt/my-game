import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
const root=process.cwd();
const registry=JSON.parse(fs.readFileSync(path.join(root,"config/monster-portrait-registry.json"),"utf8"));
const tower=fs.readFileSync(path.join(root,"js/gameplay-boss-tower-system.js"),"utf8");
const pool=registry.assetPool.entries.filter(e=>e.element==="fire");
assert.equal(pool.length,40);
assert.deepEqual(Object.fromEntries(["normal","elite","miniboss","boss"].map(t=>[t,pool.filter(e=>e.tier===t).length])),{normal:10,elite:19,miniboss:11,boss:0});
assert.equal(pool.filter(e=>e.status==="adopted").length,39);
assert.equal(pool.filter(e=>e.status==="cataloged").length,0);
assert.equal(pool.filter(e=>e.status==="reserved").length,1);
assert.equal(registry.fireTowerCoverage.formalRules.eliteEvery,5);
assert.equal(registry.fireTowerCoverage.formalRules.bossEvery,10);
assert.equal(Object.keys(registry.fireTowerCoverage.bossByFloor).length,10);
for(const e of pool.filter(e=>e.status==="adopted")) assert.ok(e.runtimePath && fs.existsSync(path.join(root,e.runtimePath)),e.assetId+" runtime missing");
for(const id of Object.values(registry.fireTowerCoverage.bossByFloor)) assert.equal(pool.find(e=>e.assetId===id).tier,"miniboss");
assert.match(tower,/eliteEvery:5,bossEvery:10/);
assert.match(tower,/monster\.portraitKey=towerPortraitAssetId/);
assert.match(tower,/towerPortraitAssetId\(floor,"boss"/);
assert.match(tower,/function bindTowerMonsterIdentity\(monster\)/);
assert.match(tower,/monster\.name=monster\.displayName/);

const byId=Object.fromEntries(pool.map(entry=>[entry.assetId,entry]));
const expectedNames={
  "MON_FIRE_NORMAL_001":"炎刃流寇",
  "MON_FIRE_ELITE_001":"裂甲熔蠍",
  "MON_FIRE_ELITE_002":"焚稻魈",
  "MON_FIRE_MINIBOSS_001":"炎脊裂龍",
  "MON_FIRE_MINIBOSS_005":"焚城魔將",
  "MON_FIRE_MINIBOSS_011":"焰冠獅魁"
};
for(const [assetId,name] of Object.entries(expectedNames)){
  assert.equal(byId[assetId].displayName,name,assetId+" displayName mismatch");
}
console.log("Fire tower portrait coverage tests passed.");\n// Keep Registry display-name coverage explicit for CI review.
