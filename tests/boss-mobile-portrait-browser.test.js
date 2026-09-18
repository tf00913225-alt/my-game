"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");

const css=fs.readFileSync("css/gameplay-boss-tower.css","utf8");
const adapter=fs.readFileSync("js/battlefield-render-geometry-adapter.js","utf8");

assert.match(adapter,/footprint\.dataset\.slots=slots\.bossFootprintSlots\.join\(" "\)/);
assert.match(css,/\.v-fixed-boss-footprint\{[\s\S]*position:absolute;[\s\S]*left:calc\(20% \+ 5px\);[\s\S]*right:calc\(20% \+ 5px\);[\s\S]*top:var\(--battle-enemy-safe-top\);[\s\S]*bottom:0;/);
assert.match(css,/\.gameplay-boss-card\{[\s\S]*inset:0;[\s\S]*pointer-events:auto;/);
assert.match(css,/\.gameplay-boss-card > \.v174-battle-art\{[\s\S]*background-position:center bottom;[\s\S]*background-size:contain;/);
assert.doesNotMatch(css,/transform:\s*scale\(|zoom\s*:/,"Boss size must come from the six-slot rectangle, not CSS scaling");
assert.match(css,/data-slot="ENEMY_B1"/);
assert.match(css,/data-slot="ENEMY_B5"/);
assert.match(css,/data-slot="ENEMY_F1"/);
assert.match(css,/data-slot="ENEMY_F5"/);

console.log("Boss six-slot mobile portrait geometry contract passed.");
