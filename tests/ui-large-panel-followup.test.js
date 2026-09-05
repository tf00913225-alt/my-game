"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");

const character=fs.readFileSync("js/19-stage-v78-character-inventory-runtime.js","utf8");
const quest=fs.readFileSync("css/25-stage-v90-quest-interface-core.css","utf8");
const shared=fs.readFileSync("css/49-v169-rpg-ui.css","utf8");

assert.match(shared,/--ui-large-panel-max-width:396px/);
assert.match(shared,/--ui-large-panel-height:620px/);
assert.match(shared,/--ui-large-panel-safe-space:24px/);

assert.match(character,/width[\s\S]*?calc\(100% - var\(--ui-large-panel-safe-space,24px\)\)/);
assert.match(character,/max-width[\s\S]*?var\(--ui-large-panel-max-width,396px\)/);
assert.match(character,/height[\s\S]*?min\(var\(--ui-large-panel-height,620px\),calc\(100% - var\(--ui-large-panel-safe-space,24px\)\)\)/);
assert.match(character,/body\.style\.setProperty\([\s\S]*?"flex",[\s\S]*?"1 1 auto"/);
assert.match(character,/root\.style\.setProperty\([\s\S]*?"flex",[\s\S]*?"1 1 auto"/);
assert.match(character,/"scrollbar-gutter",[\s\S]*?"stable"/);
assert.doesNotMatch(character,/"height",\s*\n\s*"auto",\s*\n\s*"important"\s*\n\s*\);\s*\n\s*\n\s*box\.style/);

assert.match(quest,/#homeFeatureModal\.quest-mode\{[\s\S]*?padding:12px !important/);
assert.match(quest,/\.quest-mode \.home-feature-modal-box\{[\s\S]*?max-width:var\(--ui-large-panel-max-width,396px\) !important/);
assert.match(quest,/\.quest-mode \.home-feature-modal-box\{[\s\S]*?height:min\(var\(--ui-large-panel-height,620px\),calc\(100% - var\(--ui-large-panel-safe-space,24px\)\)\) !important/);
assert.match(quest,/\.quest-tab-body\{[\s\S]*?overflow-y:auto !important[\s\S]*?scrollbar-gutter:stable !important/);
assert.doesNotMatch(quest,/max-width:412px/);
assert.doesNotMatch(quest,/height:90dvh/);

console.log("Character and quest Large Panel migration checks passed");
