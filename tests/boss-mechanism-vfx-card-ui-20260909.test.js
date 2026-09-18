"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");

const runtime=fs.readFileSync("js/gameplay-boss-tower-system.js","utf8");
const slots=fs.readFileSync("js/battlefield-slot-owner.js","utf8");
const adapter=fs.readFileSync("js/battlefield-render-geometry-adapter.js","utf8");
const vfx=fs.readFileSync("js/39-v143-skill-animation.js","utf8");
const css=fs.readFileSync("css/gameplay-boss-tower.css","utf8");

assert.match(slots,/bossFootprintSlots:BOSS_FOOTPRINT/);
assert.match(slots,/"ENEMY_B2","ENEMY_B3","ENEMY_B4"[\s\S]*"ENEMY_F2","ENEMY_F3","ENEMY_F4"/);
assert.doesNotMatch(slots,/MECH_L|MECH_C|MECH_R|mechanismSlots/);

assert.match(runtime,/BOSS_REINFORCEMENT_SLOTS=Object\.freeze\(\["ENEMY_B1","ENEMY_B5"\]\)/);
assert.match(runtime,/BOSS_OBJECT_SLOTS=Object\.freeze\(\["ENEMY_F1","ENEMY_F5"\]\)/);
assert.match(runtime,/unitKind:"boss-object"/);
assert.match(runtime,/canAct:false/);
assert.match(runtime,/noRewards:true/);
assert.match(runtime,/function applyBossShield\(amount\)/);
assert.match(runtime,/const absorbed=Math\.min\(afterReduction/);
assert.match(runtime,/const hpDamage=Math\.max\(0,afterReduction-absorbed\)/);
assert.match(runtime,/function resolveEnemyDamageTargets\(primaryIndex,targetType\)/);
assert.match(runtime,/targetType==="all"\|\|targetType==="enemyAll"/);
assert.doesNotMatch(runtime,/blockingShield|mandatoryMechanismTarget|resolveMechanismAction|boss-mechanism-card|mechanism:/);

assert.match(adapter,/className="v-fixed-boss-footprint"/);
assert.match(adapter,/footprint\.appendChild\(bossCard\)/);
assert.match(css,/\.v-fixed-boss-footprint\{[\s\S]*left:calc\(20% \+ 12px\);[\s\S]*right:calc\(20% \+ 12px\);/);
assert.match(css,/\.gameplay-boss-card > \.v174-battle-art\{[\s\S]*background-size:contain;/);
assert.doesNotMatch(css,/boss-mechanism-card|boss-mechanism-slot/);

assert.match(vfx,/Number\.isInteger\(index\)&&canReceive/);
assert.match(vfx,/isBossIndexForVfx\(current\.targetId\)/);
assert.doesNotMatch(vfx,/MECHANISM_TARGET_PREFIX|mechanismCardFor|bossMechanismSlot|mechanism:/);

console.log("Boss target-entity, six-slot footprint and VFX contract passed.");
