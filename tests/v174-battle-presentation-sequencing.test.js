"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");

const relic=fs.readFileSync("js/60-team-relic-system.js","utf8");
const relicCss=fs.readFileSync("css/55-team-relic-system.css","utf8");
const v142=fs.readFileSync("js/37-v142-skill-animation.js","utf8");

assert.match(relic,/RELIC_VFX_FLOOR_MS=2000/,
    "relic VFX keeps a readable minimum while preserving the single V142/V143 presentation owner");
assert.match(relic,/presentationDurationMs:2400/,
    "relic presentation fallback stays in the readable duration band instead of flashing or returning to 3-second slow motion");
assert.match(relic,/presentationLeadGapMs:120/,
    "relic presentation keeps the short handoff gap after the previous visual gate settles");
assert.match(relic,/function queueRelicPresentation\(def,onStart,visualContext\)/);
assert.match(relic,/waitForAnimationRelease\(gate\)/,
    "relic presentation must wait for the active V142 skill gate");
assert.doesNotMatch(relic,/waitForRelicPresentation|deferredCombatants|deferredStartTurns/,
    "presentation promises must never own round or initiative continuation");
assert.doesNotMatch(relic,/relicPresentationPending>0&&hasLiveBattlePresentationHost\(\)/,
    "visual duration and combat advancement remain independent");
assert.match(relic,/markTriggered\(triggerDef,key\);[\s\S]*?relicVisualCollector=visuals[\s\S]*?resolveEffects\(triggerDef,def,payload\|\|\{\}\)[\s\S]*?performRelicPresentation/,
    "every runtime-ready relic must settle mechanically before its deferred popup presentation");
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

assert.match(v142,/window\.v142GetRemainingAnimationMs=function/,
    "V142 exposes remaining visual time to the core queue owner");
assert.doesNotMatch(v142,/finishPlayerAction\s*=(?!=)|processNextCombatant\s*=(?!=)/,
    "V142 must not replace combat queue functions");

console.log("✓ battle presentation sequencing contract tests passed");
