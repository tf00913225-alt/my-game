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
assert.match(tower,/function towerPortraitAssetId\(element,floor,role,slot\)/);
assert.match(tower,/towerPortraitAssetId\(definition\.element,floor,"boss",0\)/);
assert.match(tower,/function bindTowerMonsterIdentity\(monster\)/);
assert.match(tower,/monster\.name=monster\.displayName/);

const byId=Object.fromEntries(pool.map(entry=>[entry.assetId,entry]));
const expectedNames={
  "MON_FIRE_NORMAL_001":"炎刃流寇",
  "MON_FIRE_ELITE_001":"裂甲熔蠍",
  "MON_FIRE_ELITE_002":"焚稻魈",
  "MON_FIRE_ELITE_008":"赤甲槍蟲",
  "MON_FIRE_ELITE_010":"六臂修羅",
  "MON_FIRE_ELITE_013":"獄輪魔尊",
  "MON_FIRE_ELITE_014":"業炎法王",
  "MON_FIRE_ELITE_016":"末炎祭司",
  "MON_FIRE_ELITE_017":"熔翼獸王",
  "MON_FIRE_ELITE_018":"炎錘巨魔",
  "MON_FIRE_ELITE_019":"焚天炎龍",
  "MON_FIRE_MINIBOSS_001":"炎脊裂龍",
  "MON_FIRE_MINIBOSS_005":"焚城魔將",
  "MON_FIRE_MINIBOSS_011":"焰冠獅魁"
};
for(const [assetId,name] of Object.entries(expectedNames)){
  assert.equal(byId[assetId].displayName,name,assetId+" displayName mismatch");
}
const fireNames=pool.map(entry=>entry.displayName);
assert.equal(new Set(fireNames).size,fireNames.length,"fire portrait names must remain unique");
for(const name of fireNames){
  const length=Array.from(name).length;
  assert.ok(length>=2&&length<=4,`${name} must contain 2-4 characters`);
}
console.log("Fire tower portrait coverage tests passed.");
