"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");

const guidelines=fs.readFileSync("UI_GUIDELINES.md","utf8");
const fixed=fs.readFileSync("css/fixed-slot-battlefield-rendering-v2.css","utf8");
const boss=fs.readFileSync("css/gameplay-boss-tower.css","utf8");

assert.match(guidelines,/13px — 絕對最低值/);
assert.match(guidelines,/戰鬥介面排除/);
assert.match(fixed,/--battle-name-row-height:14px/);
assert.match(fixed,/--battle-resource-bar-height:11px/);
assert.match(fixed,/\.battle-monster-name\{[\s\S]*?font-size:11px !important/);
assert.match(fixed,/\.monster-bar-text,[\s\S]*?font-size:9px !important/);
assert.match(boss,/\.gameplay-boss-card > \.battle-monster-name\{[\s\S]*?font-size:14px/);
assert.match(boss,/\.gameplay-boss-card \.monster-bar-text\{[\s\S]*?font-size:10px/);

console.log("Current UI typography classification: general UI floor and compact battle HUD exceptions verified.");
