"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");

const main=fs.readFileSync("js/00-main.js","utf8");
const v142=fs.readFileSync("js/37-v142-skill-animation.js","utf8");
const animation=fs.readFileSync("js/39-v143-skill-animation.js","utf8");
const loader=fs.readFileSync("js/20-anonymous-20.js","utf8")+fs.readFileSync("scripts/build-production.mjs","utf8");
const index=fs.readFileSync("index.html","utf8");

assert.match(v142,/__v142SkillAnimationInstalled && window\.v142SkillAnimationDirector &&[\s\S]*?v142PlaySkillAnimationFromBadge/);
assert.match(v142,/window\.v142PlaySkillAnimationFromBadge=function/);
assert.doesNotMatch(v142,/const previous=showSkillNameBadge/);
assert.match(main,/v142PlaySkillAnimationFromBadge\("player",skillName,elementType,characterIndex\|\|0\)/);
assert.match(main,/v142PlaySkillAnimationFromBadge\("monster",skillName,elementType,monsterIndex\|\|0\)/);
assert.match(animation,/water-orb-vfx\.png\?v=173\.19/);
assert.match(loader,/const V_ASSET_VERSION="173\.65"/);
assert.match(index,/<title>四象江湖傳 V173\.65<\/title>/);

console.log("V173.62 P0 direct animation runtime recovery: 8 tests passed.");
