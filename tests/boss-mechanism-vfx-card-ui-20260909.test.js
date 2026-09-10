"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");

const vfx=fs.readFileSync("js/39-v143-skill-animation.js","utf8");
const v141=fs.readFileSync("css/38-v141-system-expansion.css","utf8");
const v143=fs.readFileSync("css/40-v143-combat-dungeon-polish.css","utf8");
const boss=fs.readFileSync("css/gameplay-boss-tower.css","utf8");
const runtime=fs.readFileSync("js/gameplay-boss-tower-system.js","utf8");
const featureManifest=JSON.parse(fs.readFileSync("config/feature-manifest.json","utf8"));
const build=fs.readFileSync("scripts/build-production.mjs","utf8");

function cssRule(source,selector){
    const start=source.indexOf(selector);
    assert.ok(start>=0,`missing CSS selector: ${selector}`);
    const open=source.indexOf("{",start);
    const close=source.indexOf("}",open);
    assert.ok(open>=0&&close>open,`malformed CSS selector: ${selector}`);
    return source.slice(start,close+1);
}

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

// Generic battle card sizes remain untouched. Only a runtime-tagged Gameplay
// BOSS receives the large portrait 9:16 variables requested for this screen.
assert.match(v141,/flex:0 0 var\(--v143-monster-card-width,76px\) !important;/);
assert.match(v143,/#game-stage > #app > #game-content #battlePage \.battle-monster\[data-rank="boss"\]\{[\s\S]*?--v143-monster-card-width:82px;[\s\S]*?--v143-monster-card-height:106px;/);
assert.match(boss,/#game-stage > #app > #game-content #battlePage \.battle-monster\.gameplay-boss-card\[data-rank="boss"\]\{[\s\S]*?--v143-monster-card-width:clamp\(154px,38\.1%,166px\);[\s\S]*?--v143-monster-card-height:auto;[\s\S]*?--v143-monster-icon-width:calc\(100% - 12px\);[\s\S]*?--v143-monster-bar-width:calc\(100% - 10px\);[\s\S]*?aspect-ratio:9 \/ 16;/);
assert.match(runtime,/bossCard\.classList\.add\("gameplay-boss-card"\)/);

// The old V131 row has a hard flex sizing path. Gameplay BOSS mode switches
// only that runtime row to grid so the real card width variable can own geometry;
// this avoids a later !important or transform-based visual enlargement.
assert.match(boss,/#battleMonsterArea\.gameplay-boss-active \.v131-monster-row\{[\s\S]*?display:grid;[\s\S]*?grid-template-columns:1fr;[\s\S]*?place-items:start center;/);
const bossCardSelector="#game-stage > #app > #game-content #battlePage .battle-monster.gameplay-boss-card[data-rank=\"boss\"]{";
const bossCardRule=cssRule(boss,bossCardSelector);
assert.doesNotMatch(bossCardRule,/!important/);
assert.doesNotMatch(bossCardRule,/transform\s*:/);
assert.doesNotMatch(bossCardRule,/zoom\s*:/);
assert.doesNotMatch(bossCardRule,/scale\(/);

// The redundant battle heading is hidden only while a Gameplay BOSS is active.
// Its historical geometry is reclaimed by the formation without introducing
// a new priority patch in the new Boss-specific sizing rules.
assert.match(boss,/#battlePage:has\(#battleMonsterArea\.gameplay-boss-active\) \.battle-title\{[\s\S]*?visibility:hidden;[\s\S]*?opacity:0;/);
assert.match(boss,/#battleMonsterArea\.gameplay-boss-active\{[\s\S]*?margin-top:-32px;/);
const activeBossAreaRule=cssRule(boss,"#game-stage #battleMonsterArea.gameplay-boss-active{");
const activeBossRowRule=cssRule(boss,"#game-stage #battleMonsterArea.gameplay-boss-active .v131-monster-row{");
assert.doesNotMatch(activeBossAreaRule,/!important/);
assert.doesNotMatch(activeBossRowRule,/!important/);

// The function/mechanism card is an independent portrait 9:16 battlefield
// component. Its face is type -> name -> HP -> concise effect. Combat targeting
// remains on the mechanism button itself; the separate detail panel keeps the
// full dynamic explanation available.
assert.match(boss,/\.boss-mechanism-slot\.active\{\s*display:flex;/);
assert.match(boss,/\.boss-mechanism-card\{[\s\S]*?width:clamp\(82px,20%,96px\);[\s\S]*?aspect-ratio:9 \/ 16;[\s\S]*?flex:0 0 clamp\(82px,20%,96px\);/);
assert.match(boss,/\.boss-mechanism-kind\{[\s\S]*?order:1;[\s\S]*?font-size:13px;/);
assert.match(boss,/\.boss-mechanism-name\{[\s\S]*?order:2;[\s\S]*?font-size:14px;[\s\S]*?-webkit-line-clamp:2;/);
assert.match(boss,/\.boss-mechanism-hp\{[\s\S]*?order:3;[\s\S]*?min-height:20px;[\s\S]*?font-size:11px;[\s\S]*?font-weight:900;/);
assert.match(boss,/\.boss-mechanism-card::after\{[\s\S]*?order:4;[\s\S]*?-webkit-line-clamp:4;/);
assert.match(boss,/data-type="shield"\]::after\{ content:"護體中・優先擊破"; \}/);
assert.match(boss,/data-type="charge"\]::after\{ content:"倒數重擊・擊破可取消"; \}/);
assert.match(boss,/data-type="heal"\]::after\{ content:"每回合回復 BOSS 4%"; \}/);
assert.match(boss,/data-type="amplify"\]::after\{ content:"BOSS 傷害提高25%"; \}/);
assert.match(boss,/data-type="seal"\]::after\{ content:"治療／SP 回復 -40%"; \}/);
const mechanismCardRule=cssRule(boss,"#game-stage #battleMonsterArea .boss-mechanism-card{");
assert.doesNotMatch(mechanismCardRule,/!important/);
assert.doesNotMatch(mechanismCardRule,/transform\s*:/);
assert.doesNotMatch(mechanismCardRule,/zoom\s*:/);
assert.doesNotMatch(mechanismCardRule,/scale\(/);

const renderStart=runtime.indexOf("function renderMechanisms()");
const renderEnd=runtime.indexOf("function showMechanismToast",renderStart);
assert.ok(renderStart>=0&&renderEnd>renderStart,"renderMechanisms owner must exist");
const renderBlock=runtime.slice(renderStart,renderEnd);
assert.match(renderBlock,/node\.onclick=function\(\)\{ selectMechanism\(card\.id\); \};/);
assert.match(renderBlock,/boss-mechanism-name/);
assert.match(renderBlock,/boss-mechanism-kind/);
assert.match(renderBlock,/boss-mechanism-hp/);
assert.doesNotMatch(renderBlock,/boss-mechanism-effect/);

// Detailed explanation is owned by a separate right-side alert/panel. The
// alert rapidly flashes red, opens the live detail and 返回 collapses it.
assert.match(runtime,/class="boss-mechanism-info-alert"[^>]*>!<\/button>/);
assert.match(runtime,/class="boss-mechanism-info-back">‹ 返回<\/button>/);
assert.match(runtime,/ui\.body\.innerHTML=alive\.map\(mechanismInfoMarkup\)\.join\(""\)/);
assert.match(runtime,/boss-mechanism-info-effect/);
assert.match(runtime,/mechanismEffectText\(card\)/);
assert.match(boss,/\.boss-mechanism-info-alert\{[\s\S]*?border-radius:50%;[\s\S]*?animation:gameplayMechanismInfoAlert \.48s ease-in-out infinite;/);
assert.match(boss,/\.boss-mechanism-info-panel\{[\s\S]*?width:170px;[\s\S]*?height:302px;[\s\S]*?aspect-ratio:9 \/ 16;/);
assert.match(boss,/@keyframes gameplayMechanismInfoAlert/);
assert.match(boss,/prefers-reduced-motion:reduce[\s\S]*?boss-mechanism-info-alert/);

// Production owns these sources in a content-hashed feature bundle. No runtime
// HTTP chain or global cache-busting query is allowed to retake ownership.
assert.equal(featureManifest.features["boss-tower"],"feature-boss-relic");
assert.deepEqual(featureManifest.bundles["feature-boss-relic"].dependencies,["gameplay-core"]);
assert.match(build,/const bossRelicScripts=\["js\/gameplay-boss-tower-system\.js","js\/60-team-relic-system\.js"\]/);
assert.match(build,/const bossRelicStyles=\["css\/gameplay-boss-tower\.css","css\/55-team-relic-system\.css"\]/);

console.log("Boss mechanism VFX/card UI regression checks passed.");
