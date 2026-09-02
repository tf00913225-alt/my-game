"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");

const abyssFinalOwner=fs.readFileSync("js/41-v146-system-polish.js","utf8");
const dungeon=fs.readFileSync("js/27-v132-content-expansion.js","utf8");
const animation=fs.readFileSync("js/39-v143-skill-animation.js","utf8");

assert.match(
    abyssFinalOwner,
    /const boss=map\.querySelector\("\.v141-abyss-boss"\);[\s\S]*?const bossHit=!!\(boss&&[\s\S]*?if\(bossHit\)\{ return previousAbyssMove\.apply\(this,arguments\); \}/
);
assert.ok(
    abyssFinalOwner.indexOf("if(bossHit){ return previousAbyssMove.apply(this,arguments); }")<
    abyssFinalOwner.indexOf("const synthetic={")
);

assert.match(dungeon,/const DUNGEON_DAILY_LIMIT_ENABLED=false;/);
assert.match(dungeon,/if\(!DUNGEON_DAILY_LIMIT_ENABLED\)\{ return; \}/);
assert.match(dungeon,/if\(!DUNGEON_DAILY_LIMIT_ENABLED\)\{ return false; \}/);

assert.match(
    animation,
    /waterBall:\{[\s\S]*?columns:4,rows:3,frames:12,frameWidth:384,frameHeight:384,hitFrame:7,\s*placement:"group",renderer:"canvas-crop"/
);
assert.match(
    animation,
    /iceArrowRain:\{[\s\S]*?columns:4,rows:3,frames:12,frameWidth:384,frameHeight:384,hitFrame:7,\s*placement:"battlefield",renderer:"canvas-crop",targetBounds:true,coverageScale:1\.22/
);
assert.match(
    animation,
    /const targetCards=indexes\.map\(targetIndex=>cardFor\(current\.targetSide,targetIndex\)\)[\s\S]*?const bounds=fieldBounds\(targetCards\);/
);

console.log("V173.38 Abyss, VFX, and daily-dungeon regression checks passed.");
