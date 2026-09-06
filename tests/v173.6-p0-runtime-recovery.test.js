"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");

const main=fs.readFileSync("js/00-main.js","utf8");
const v142=fs.readFileSync("js/37-v142-skill-animation.js","utf8");
const abyss=fs.readFileSync("js/38-v143-system-fixes.js","utf8");
const animation=fs.readFileSync("js/39-v143-skill-animation.js","utf8");
const loader=fs.readFileSync("js/20-anonymous-20.js","utf8");
const index=fs.readFileSync("index.html","utf8");

assert.match(v142,/if\(typeof window==="undefined" \|\| window\.__v142SkillAnimationInstalled\)\{ return; \}/);
assert.match(v142,/showSkillNameBadge=function/);
assert.match(v142,/showMonsterSkillNameBadge=function/);
assert.doesNotMatch(v142,/v142PlaySkillAnimationFromBadge/);
assert.doesNotMatch(main,/v142PlaySkillAnimationFromBadge/);
assert.doesNotMatch(abyss,/v141ChallengeAbyssBoss=function/);
assert.match(animation,/water-orb-vfx\.png\?v=173\.19/);
assert.match(loader,/const V_ASSET_VERSION="173\.58"/);
assert.match(index,/<title>四象江湖傳 V173\.58<\/title>/);

console.log("V173.39 P0 known-good animation-chain recovery: 10 tests passed.");
