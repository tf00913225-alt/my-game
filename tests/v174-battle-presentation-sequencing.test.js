"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");

const relic=fs.readFileSync("js/60-team-relic-system.js","utf8");
const relicCss=fs.readFileSync("css/55-team-relic-system.css","utf8");
const feedback=fs.readFileSync("js/battle-floating-feedback-owner.js","utf8");
const feedbackCss=fs.readFileSync("css/battle-floating-feedback-owner.css","utf8");
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

assert.doesNotMatch(relicCss,/\.damage-popup|\.team-relic-sp-float/,
    "Relic CSS must not own damage/recovery popup positioning or typography");
assert.match(feedback,/const MAX_LANES=4/);
assert.match(feedback,/context\.queue\.push\(request\)/);
assert.match(feedback,/geometry\.feedbackSafeRect/);
assert.match(feedbackCss,/color:#e32626/);
assert.match(feedbackCss,/-webkit-text-stroke:\.85px #fff/);
assert.match(feedbackCss,/text-shadow:1px 1px 0 #000/);
assert.doesNotMatch(feedbackCss,/0 0 (?:7|8|10|14|16)px/,
    "shared battle feedback must not restore colored glow");

assert.match(v142,/window\.v142GetRemainingAnimationMs=function/,
    "V142 exposes remaining visual time to the core queue owner");
assert.doesNotMatch(v142,/finishPlayerAction\s*=(?!=)|processNextCombatant\s*=(?!=)/,
    "V142 must not replace combat queue functions");

console.log("✓ battle presentation sequencing contract tests passed");
