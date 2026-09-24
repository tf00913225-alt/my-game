"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");

const vfx=fs.readFileSync("js/39-v143-skill-animation.js","utf8");
const targetContract=fs.readFileSync("js/00-main.js","utf8");
const boss=fs.readFileSync("js/gameplay-boss-tower-system.js","utf8");

assert.doesNotMatch(vfx,/mechanism:|mechanismCardFor|bossMechanismSlot/);
assert.doesNotMatch(targetContract,/value\.indexOf\("mechanism:"\)/);
assert.match(targetContract,/ids=Array\.from\(new Set\(ids\.filter\(Number\.isInteger\)\)\)/);

for(const targetType of ["tri","row","column"]){
    const resolver=boss.slice(
        boss.indexOf("function resolveEnemyDamageTargets"),
        boss.indexOf("function outgoingDamageMultiplier")
    );
    assert.match(resolver,/return alive\.includes\(primaryIndex\)\?\[primaryIndex\]:\[\]/,
        targetType+" must settle only the selected Boss-mode entity");
}
assert.match(vfx,/const targetType=String\(current\.targetType\|\|current\.config&&current\.config\.targetType\|\|"single"\)/);
assert.match(vfx,/getGeometryRectFromShape\(current\.targetSide,primarySlot,shape\)/,
    "tri/row/column visual geometry remains authored independently of one-target damage settlement");

console.log("Numeric Boss target VFX reliability contract passed.");
