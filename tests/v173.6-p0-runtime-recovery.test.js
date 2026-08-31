"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");

const v142=fs.readFileSync("js/37-v142-skill-animation.js","utf8");
const abyss=fs.readFileSync("js/38-v143-system-fixes.js","utf8");
const animation=fs.readFileSync("js/39-v143-skill-animation.js","utf8");
const loader=fs.readFileSync("js/20-anonymous-20.js","utf8");
const index=fs.readFileSync("index.html","utf8");

assert.match(v142,/__v142SkillAnimationInstalled && window\.v142SkillAnimationDirector/);
assert.match(abyss,/map\.offsetWidth\/mapRect\.width/);
assert.match(abyss,/map\.offsetHeight\/mapRect\.height/);
assert.match(abyss,/overlay\.style\.top=Math\.max\(104,\(bossRect\.top-mapRect\.top-8\)\*scaleY\)/);
assert.match(animation,/water-orb-vfx\.png\?v=173\.6/);
assert.match(loader,/const V_ASSET_VERSION="173\.6"/);
assert.match(index,/<title>四象江湖傳 V173\.6<\/title>/);

console.log("V173.6 P0 runtime recovery: 7 tests passed.");
