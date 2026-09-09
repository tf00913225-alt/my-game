"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");

const vfx=fs.readFileSync("js/39-v143-skill-animation.js","utf8");
const v141=fs.readFileSync("css/38-v141-system-expansion.css","utf8");
const v143=fs.readFileSync("css/40-v143-combat-dungeon-polish.css","utf8");
const boss=fs.readFileSync("css/gameplay-boss-tower.css","utf8");
const loader=fs.readFileSync("js/20-anonymous-20.js","utf8");
const core=fs.readFileSync("js/19-stage-v78-character-inventory-runtime.js","utf8");

// Gameplay mechanism targets are sidecar string keys. The final V143 Sprite
// owner must preserve the exact mechanism:* key through card resolution.
assert.match(vfx,/const MECHANISM_TARGET_PREFIX="mechanism:";/);
assert.match(vfx,/function mechanismCardFor\(index\)/);
assert.match(vfx,/document\.getElementById\("bossMechanismSlot"\)/);
assert.match(vfx,/card\.dataset\.id===mechanismId/);
assert.match(vfx,/function queuedMechanismTarget\(config,meta,targetSide\)/);
assert.match(vfx,/if\(mechanismTarget\)\{ return \[mechanismTarget\]; \}/);
assert.match(vfx,/if\(mechanismTarget\)\{ validTargets\.add\(mechanismTarget\); \}/);
assert.match(vfx,/isMechanismTarget\(index\)\)\{ return mechanismCardFor\(index\); \}/);

// BOSS grows independently; ordinary monster defaults stay 76x100.
assert.match(v141,/flex:0 0 var\(--v143-monster-card-width,76px\) !important;/);
assert.match(v143,/\.battle-monster\[data-rank="boss"\]\{[\s\S]*?--v143-monster-card-width:82px;[\s\S]*?--v143-monster-card-height:106px;/);
assert.match(v143,/--v143-monster-bar-width:74px;/);

// Player cards gain height without widening the established 118px card.
assert.match(v141,/\.battle-player-row\{[\s\S]*?flex-basis:144px !important;[\s\S]*?height:144px !important;/);
assert.match(v141,/\.battle-player\{[\s\S]*?width:118px !important;[\s\S]*?height:122px !important;/);

// Function card and HP treatment must keep their increased visual weight.
assert.match(boss,/\.boss-mechanism-slot\{[\s\S]*?top:104px;[\s\S]*?width:252px;[\s\S]*?min-height:86px;/);
assert.match(boss,/\.boss-mechanism-card\{[\s\S]*?width:120px;[\s\S]*?min-height:84px;/);
assert.match(boss,/\.boss-mechanism-hp\{[\s\S]*?min-height:18px;[\s\S]*?font-size:11px;[\s\S]*?font-weight:900;/);

// Changed dynamic owners receive scoped cache keys without changing the two
// release-owned entrypoint URLs in index.html (the loader gate owns those).
assert.match(core,/gameplay-boss-tower\.css\?v=173\.64&patch=boss-card-ui-20260909/);
assert.match(loader,/38-v141-system-expansion\.css"\)\+"&patch=boss-card-ui-20260909"/);
assert.match(loader,/40-v143-combat-dungeon-polish\.css"\)\+"&patch=boss-card-ui-20260909"/);
assert.match(loader,/cacheKey:"boss-mechanism-vfx-20260909"/);
assert.match(loader,/runtime\.cacheKey\?"&patch="\+runtime\.cacheKey/);

console.log("Boss mechanism VFX/card UI regression checks passed.");
