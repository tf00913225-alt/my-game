"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");

const relic=fs.readFileSync("js/60-team-relic-system.js","utf8");
const relicCss=fs.readFileSync("css/55-team-relic-system.css","utf8");
const v142=fs.readFileSync("js/37-v142-skill-animation.js","utf8");

assert.match(relic,/presentationDurationMs:2200/,
    "relic presentation must reserve a few seconds before battle can advance");
assert.match(relic,/presentationLeadGapMs:500/,
    "relic presentation must begin after the previous action has visually settled");
assert.match(relic,/function queueRelicPresentation\(def,onStart\)/);
assert.match(relic,/waitForAnimationRelease\(gate\)/,
    "relic presentation must wait for the active V142 skill gate");
assert.match(relic,/if\(relicPresentationPending>0&&hasLiveBattlePresentationHost\(\)\)[\s\S]*?waitForRelicPresentation/,
    "round/initiative continuation must wait while a relic presentation owns the screen");
assert.match(relic,/dispatchRelicEvent\("round_start"[\s\S]*?if\(relicPresentationPending>0/,
    "round-start relics must resolve before the normal round HUD/action flow starts");
assert.match(relic,/triggerDef\.type==="before_lethal_damage"&&hasLiveBattlePresentationHost\(\)[\s\S]*?relicVisualCollector=visuals[\s\S]*?resolveEffects/,
    "lethal prevention must settle mechanically immediately while deferring its popup presentation");
assert.match(relic,/function showRelicSpFloat\(index,amount\)\{[\s\S]*?emitRelicPlayerHit\(amount,"sp",index,true\)/,
    "relic SP recovery must use the shared player-hit popup owner instead of a separate DOM float");
assert.doesNotMatch(relic,/function showRelicSpFloat[\s\S]{0,450}createElement\(/,
    "relic SP recovery must not create its own overlapping popup node");

assert.match(relicCss,/#game-stage #battlePage \.damage-popup\{animation-duration:\.65s!important;\}/,
    "damage/recovery popup animation must finish inside the existing V142 action boundary");
assert.match(relicCss,/\.damage-popup\.heal-popup\{[\s\S]*?top:20%!important;[\s\S]*?color:#19d85c!important/,
    "HP recovery remains green in the upper recovery lane");
assert.match(relicCss,/\.damage-popup\.sp-popup\{[\s\S]*?top:48%!important;[\s\S]*?color:#FF9F38!important/,
    "SP recovery must render below HP in orange");

assert.match(v142,/const CURRENT_RESOLVE_DELAY_MS=1600/,
    "the existing V142 action cadence remains the global owner; the fix must not add a competing core timer");
assert.match(v142,/Promise\.all\(\[timeReady,animationReady\]\)/,
    "V142 must continue requiring both engine cadence and skill animation completion before initiative advances");

console.log("✓ battle presentation sequencing contract tests passed");
