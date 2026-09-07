"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");

const main=fs.readFileSync("js/00-main.js","utf8");
const v142=fs.readFileSync("js/37-v142-skill-animation.js","utf8");
const v140=fs.readFileSync("js/33-v140-four-element-balance.js","utf8");
const v143=fs.readFileSync("js/39-v143-skill-animation.js","utf8");

assert.match(v140,/showSkillNameBadge=function\(skillName\)/);
assert.match(v142,/window\.v142PlaySkillAnimationFromBadge=function/);
assert.doesNotMatch(v142,/showSkillNameBadge=function\(name,element,characterIndex\)/);
assert.match(main,/function showSkillNameBadge[\s\S]*?v142PlaySkillAnimationFromBadge\("player"/);
assert.match(main,/function showMonsterSkillNameBadge[\s\S]*?v142PlaySkillAnimationFromBadge\("monster"/);
assert.match(v143,/if\(!window\.v142SkillAnimationDirector\)\{ return; \}/);
assert.match(v143,/director\.play=function\(config,meta\)/);

console.log("✓ direct skill animation trigger survives later badge wrapper order");
