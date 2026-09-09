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
    /waterBall:\{[\s\S]*?castSheet\("assets\/vfx\/water\/water-orb-vfx\.png\?v=173\.19","group",\{[\s\S]*?alignToSlots:true[\s\S]*?\}\)/
);
assert.match(
    animation,
    /iceArrowRain:\{[\s\S]*?castSheet\("assets\/vfx\/water\/frost-arrow-rain-vfx\.png\?v=173\.19","battlefield",\{fixedFormation:true,coverageScale:1\.22,minWidth:140,minHeight:140\}\)/
);
assert.match(animation,/function castSheet\(src,placement,options\)[\s\S]*?columns:4,rows:3,frames:12,hitFrame:7,[\s\S]*?renderer:"dom-sprite"/);
assert.match(
    animation,
    /const indexes=emittedSpriteTargets\(current\);[\s\S]*?const targetCards=indexes\.map\(i=>cardFor\(current\.targetSide,i\)\)\.filter\(Boolean\);[\s\S]*?groupLayoutBounds\(current,indexes\):fieldBounds\(targetCards\)/
);
assert.doesNotMatch(animation,/canvas-crop|getContext\(|drawImage\(|createElement\(["']canvas["']\)/);

console.log("V173.39 Abyss, raster VFX, and daily-dungeon regression checks passed.");
