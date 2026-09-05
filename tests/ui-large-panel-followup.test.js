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

assert.match(shared,/\.home-feature-modal-box\.wide\{[\s\S]*?max-width:var\(--ui-large-panel-max-width\) !important[\s\S]*?height:min\(var\(--ui-large-panel-height\),calc\(100% - var\(--ui-large-panel-safe-space\)\)\) !important/);
assert.match(shared,/\.home-feature-modal-box\.wide #homeFeatureModalBody\{[\s\S]*?flex:1 1 auto !important/);
assert.match(shared,/#characterTabContent\{[\s\S]*?flex:1 1 auto !important[\s\S]*?scrollbar-gutter:stable !important/);

assert.match(quest,/#homeFeatureModal\.quest-mode\{[\s\S]*?padding:12px !important/);
assert.match(quest,/\.quest-mode \.home-feature-modal-box\{[\s\S]*?max-width:var\(--ui-large-panel-max-width,396px\) !important/);
assert.match(quest,/\.quest-mode \.home-feature-modal-box\{[\s\S]*?height:min\(var\(--ui-large-panel-height,620px\),calc\(100% - var\(--ui-large-panel-safe-space,24px\)\)\) !important/);
assert.match(quest,/\.quest-tab-body\{[\s\S]*?overflow-y:auto !important[\s\S]*?scrollbar-gutter:stable !important/);
assert.doesNotMatch(quest,/max-width:412px/);
assert.doesNotMatch(quest,/height:90dvh/);

assert.match(shared,/:has\(#homeExpPoolCard\) \.home-feature-modal-box/);
assert.match(shared,/:has\(#homeFeatureModalBody > \.home-feature-row\) \.home-feature-modal-box/);
assert.match(shared,/:has\(#homeFeatureModalBody > button\[onclick\^="claimOfflineExp"\]\) \.home-feature-modal-box/);
assert.match(shared,/:has\(#homeFeatureModalBody > div\[style\*="line-height:1\.8"\]\):not\(:has\(#homeFeatureModalBody > button\)\) \.home-feature-modal-box/);
assert.match(shared,/:has\(#homeExpPoolCard\) #homeFeatureModalBody,[\s\S]*?overflow-y:auto !important[\s\S]*?touch-action:pan-y !important[\s\S]*?scrollbar-gutter:stable !important/);
assert.match(shared,/:not\(:has\(\.home-feature-modal-box\.wide\)\):has\(#homeExpPoolCard\)/);

assert.doesNotMatch(shared,/transform\s*:\s*scale\(/);

console.log("Large Panel follow-up migration checks passed");
