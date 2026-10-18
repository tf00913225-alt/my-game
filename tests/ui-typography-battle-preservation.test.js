"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");

const fixed=fs.readFileSync("css/fixed-slot-battlefield-rendering-v2.css","utf8");
const boss=fs.readFileSync("css/gameplay-boss-tower.css","utf8");
const polish=fs.readFileSync("css/42-v146-system-polish.css","utf8");
const relic=fs.readFileSync("css/55-team-relic-system.css","utf8");

assert.match(fixed,/#battleMonsterArea > \.v-fixed-enemy-row\{[\s\S]*?grid-template-columns:repeat\(var\(--battle-enemy-columns,5\),minmax\(0,1fr\)\)/);
assert.match(fixed,/#battlePlayerRow > \.v-fixed-ally-slot-row\{[\s\S]*?grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
assert.match(fixed,/--battle-resource-bar-height:6px/);
assert.match(fixed,/\.battle-identity-name\{[^}]*font-size:11px/);
assert.doesNotMatch(fixed,/battle-info-region/,"retired battle log UI must stay absent");
assert.doesNotMatch(fixed,/battle-info-toggle/,"retired battle log UI must stay absent");

assert.match(boss,/\/\* ---------- Boss battle target-entity presentation ---------- \*\//);
assert.match(boss,/\.v-fixed-boss-footprint\{[\s\S]*?left:calc\(20% \+ 5px\);[\s\S]*?right:calc\(20% \+ 5px\);[\s\S]*?pointer-events:none/);
assert.match(boss,/\.battle-monster\.gameplay-boss-card\{[\s\S]*?border:0 !important;[\s\S]*?background:none !important;[\s\S]*?pointer-events:auto/);
assert.match(boss,/\.gameplay-boss-card > \.v174-battle-art\{[\s\S]*?background-size:contain/);
assert.doesNotMatch(boss,/boss-mechanism|MECH_[LCR]|aspect-ratio:4\s*\/\s*3/);
assert.match(fixed,/\.v174-unit-hud :is\(\.battle-monster-name,\.battle-player-id\)/,"Boss uses the same compact identity owner");
assert.match(boss,/boss-hp-shield-overlay/,"Boss shield projection remains intact");
assert.match(boss,/\.v-fixed-enemy-slot\[data-slot\$="1"\] \.v174-battle-art\{[\s\S]*?left:-2px !important;[\s\S]*?right:14px !important/);
assert.match(boss,/\.v-fixed-enemy-slot\[data-slot\$="5"\] \.v174-battle-art\{[\s\S]*?left:14px !important;[\s\S]*?right:-2px !important/);

assert.doesNotMatch(polish,/v143-earth-shield-effect/);
assert.doesNotMatch(polish,/v143-skill-flight|v143-skill-field|v143-hit-impact|v146-flight-art/);
assert.match(relic,/#game-stage \.team-relic-battle-banner/);

console.log("Battle preservation: Fixed Slot, cardless Boss target entity, readable HUD and bottom drawer owners verified.");
