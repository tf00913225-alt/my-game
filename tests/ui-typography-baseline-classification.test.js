"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");

const guidelines=fs.readFileSync("UI_GUIDELINES.md","utf8");
const fixed=fs.readFileSync("css/fixed-slot-battlefield-rendering-v2.css","utf8");
const boss=fs.readFileSync("css/gameplay-boss-tower.css","utf8");

assert.match(guidelines,/13px — 絕對最低值/);
assert.match(guidelines,/戰鬥介面排除/);
assert.match(fixed,/--battle-name-row-height:26px/);
assert.match(fixed,/--battle-resource-bar-height:6px/);
assert.match(fixed,/\.battle-identity-name\{[^}]*font-size:11px/);
assert.match(fixed,/\.battle-identity-level\{[^}]*font-size:10px/);
assert.doesNotMatch(boss,/\.v174-unit-hud\[data-boss="true"\] > \.battle-monster-name\{/);
assert.match(boss,/boss-hp-shield-overlay/);

console.log("Current UI typography classification: general UI floor and compact battle HUD exceptions verified.");
