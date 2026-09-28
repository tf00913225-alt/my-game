"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");

const v154=fs.readFileSync("js/45-v154-dev-fixes.js","utf8");
const v148=fs.readFileSync("js/42-v148-combat-dungeon-fixes.js","utf8");
const equipment=fs.readFileSync("js/equipment-progression.js","utf8");
const adapter=fs.readFileSync("js/battlefield-render-geometry-adapter.js","utf8");
const css=fs.readFileSync("css/fixed-slot-battlefield-rendering-v2.css","utf8");
const v174=fs.readFileSync("js/54-v173.51-battle-qa.js","utf8");

assert.doesNotMatch(v154,/v162-abyss-battle-portrait-art|syncMonsterPortraitArt/,
    "V154 must not create or maintain a legacy img portrait pipeline");
assert.match(v154,/presentation\.applyUnit\(card,"monster"\)/,
    "V154 must hand the selected record to the only presentation owner");
assert.match(v154,/monsterPortraitRegistryPromise=null/,
    "registry failure must be retryable");
assert.match(v154,/dailyPortraitPreparation\.delete\(key\)/,
    "failed preparation must not poison the session");
assert.match(v154,/ensureAssets\(\[record\.path\]\)/,
    "asset failure isolation must be per portraitKey");
assert.match(v148,/prepared\.state!=="ready"/,
    "formal daily launch must gate on Visual Ready");
assert.match(equipment,/v154PrepareDailyDungeonPortraits\("gold"\)/,
    "equipment/gold entry must use the shared preparation lifecycle");
assert.doesNotMatch(adapter,/img\.v162-abyss-battle-portrait-art/,
    "geometry must measure only formal artwork");
assert.doesNotMatch(css,/v162-abyss-battle-portrait-art/,
    "CSS must not hide a retired legacy image");
assert.match(v174,/function syncUnitArtwork\(card,kind\)/,
    "V174 must own artwork DOM creation and presentation");

console.log("Daily Dungeon portrait owner convergence contracts: PASS.");