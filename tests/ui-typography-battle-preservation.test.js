"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");

const fixed=fs.readFileSync("css/fixed-slot-battlefield-rendering-v2.css","utf8");
const boss=fs.readFileSync("css/gameplay-boss-tower.css","utf8");
const polish=fs.readFileSync("css/42-v146-system-polish.css","utf8");
const relic=fs.readFileSync("css/55-team-relic-system.css","utf8");

assert.match(fixed,/#battleMonsterArea > \.v-fixed-enemy-row\{[\s\S]*?grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
assert.match(fixed,/#battlePlayerRow > \.v-fixed-ally-slot-row\{[\s\S]*?grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
assert.match(fixed,/--battle-resource-bar-height:11px/);
assert.match(fixed,/\.monster-bar-text,[\s\S]*?font-size:9px !important/);
assert.match(fixed,/\.battle-info-region\{[\s\S]*?position:absolute !important;[\s\S]*?bottom:0 !important/);
assert.match(fixed,/\.battle-info-toggle\{[\s\S]*?width:96px;[\s\S]*?height:32px;[\s\S]*?border:3px solid #d9ad50;[\s\S]*?font-size:14px/);

assert.match(boss,/\/\* ---------- Boss battle target-entity presentation ---------- \*\//);
assert.match(boss,/\.v-fixed-boss-footprint\{[\s\S]*?left:calc\(20% \+ 5px\);[\s\S]*?right:calc\(20% \+ 5px\);[\s\S]*?pointer-events:none/);
assert.match(boss,/\.battle-monster\.gameplay-boss-card\{[\s\S]*?border:0 !important;[\s\S]*?background:none !important;[\s\S]*?pointer-events:auto/);
assert.match(boss,/\.gameplay-boss-card > \.v174-battle-art\{[\s\S]*?background-size:contain/);
assert.doesNotMatch(boss,/boss-mechanism|MECH_[LCR]|aspect-ratio:4\s*\/\s*3/);
assert.match(boss,/\.gameplay-boss-card > \.battle-monster-name\{[\s\S]*?position:absolute !important;[\s\S]*?height:16px !important;[\s\S]*?min-height:16px !important;[\s\S]*?max-height:16px !important/);
assert.match(boss,/\.gameplay-boss-card > \.monster-hp,[\s\S]*?position:absolute !important;[\s\S]*?display:block !important;[\s\S]*?visibility:visible !important/);
assert.match(boss,/\.v-fixed-enemy-slot\[data-slot\$="1"\] \.v174-battle-art\{[\s\S]*?left:-2px !important;[\s\S]*?right:14px !important/);
assert.match(boss,/\.v-fixed-enemy-slot\[data-slot\$="5"\] \.v174-battle-art\{[\s\S]*?left:14px !important;[\s\S]*?right:-2px !important/);

assert.doesNotMatch(polish,/v143-earth-shield-effect/);
assert.doesNotMatch(polish,/v143-skill-flight|v143-skill-field|v143-hit-impact|v146-flight-art/);
assert.match(relic,/#game-stage \.team-relic-battle-banner/);

console.log("Battle preservation: Fixed Slot, cardless Boss target entity, readable HUD and bottom drawer owners verified.");
