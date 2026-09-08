"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");

const rpgUi=fs.readFileSync("js/51-v169-rpg-ui.js","utf8");
const relicCss=fs.readFileSync("css/55-team-relic-system.css","utf8");
const abyss=fs.readFileSync("js/59-abyss-two-tier-runtime.js","utf8");

assert.match(rpgUi,/confirmButton\.className="v169-rpg-dialog-button secondary"/,
    "normal RPG confirmation must inherit the same dark gradient as the cancel button");
assert.match(rpgUi,/confirmButton\.classList\.toggle\("primary",options\.tone==="danger"\)/,
    "the old bright primary style must be reserved for destructive red danger confirmation only");
assert.match(rpgUi,/confirmButton\.classList\.toggle\("danger",options\.tone==="danger"\)/);
assert.doesNotMatch(rpgUi,/confirmButton\.className="v169-rpg-dialog-button primary"/);

assert.doesNotMatch(relicCss,/map-return\.png/);
assert.match(relicCss,/\.team-relic-home-tools\{[\s\S]*?width:192px;[\s\S]*?gap:32px;/);
assert.match(relicCss,/#statusHelpButton,\s*\n#game-stage #homeFeatureModal\.team-relic-modal #skillPreviewHeaderButton\{display:none!important;\}/,
    "relic modal must never expose the character status-help or all-skill-preview header controls");
assert.match(relicCss,/\.home-feature-close-btn:not\(#statusHelpButton\):not\(#skillPreviewHeaderButton\)\{display:inline-flex!important/,
    "only the real modal return button receives the relic header button skin");
assert.match(relicCss,/:has\(\.team-relic-detail\) \.home-feature-close-btn:not\(#statusHelpButton\):not\(#skillPreviewHeaderButton\)\{display:none!important;\}/);
assert.match(relicCss,/\.team-relic-detail-back\{[^}]*font-size:13px;[^}]*white-space:nowrap/,
    "relic detail return button must render its own label exactly once");
assert.doesNotMatch(relicCss,/\.team-relic-detail-back::after/,
    "relic detail return label must not be duplicated by a pseudo-element");

assert.match(abyss,/for\(let position=0;position<5;position\+\+\)[\s\S]*?for\(let position=1;position<=3;position\+\+\)/,
    "normal emperor stages must keep the five-slot front row and only three centered rear elites");
assert.doesNotMatch(abyss,/for\(let index=0;index<10;index\+\+\)/,
    "legacy one-boss plus nine-elite construction must be removed");
assert.match(abyss,/function buildTrueRealmFinalRoster\(config\)[\s\S]*?for\(let position=0;position<5;position\+\+\)/,
    "Lv40 true-realm final five-emperor formation remains separately owned and unchanged");

console.log("✓ relic navigation, dialog button and Abyss boss polish tests passed");
