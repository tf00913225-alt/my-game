"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");

const bossRuntime=fs.readFileSync("js/gameplay-boss-tower-system.js","utf8");
const bossCss=fs.readFileSync("css/gameplay-boss-tower.css","utf8");
const vfxRuntime=fs.readFileSync("js/39-v143-skill-animation.js","utf8");
const vfxCss=fs.readFileSync("css/40-v143-combat-dungeon-polish.css","utf8");
const touchLock=fs.readFileSync("js/01-stage-v8-touch-lock.js","utf8");
const relicCss=fs.readFileSync("css/55-team-relic-system.css","utf8");
const compactModalCss=fs.readFileSync("css/37-v139-rested-experience.css","utf8");
const dungeonNav=fs.readFileSync("js/41-v146-system-polish.js","utf8");

/* BOSS mechanism cards remain sidecar targets and the lethal charge countdown
   stays visible on the card itself. */
assert.match(bossRuntime,/Mechanism cards are real attackable sidecar targets, never monsters/);
assert.match(bossRuntime,/if\(card\.type==="charge"\)\{ return "倒數 "\+card\.countdown\+" 回合・歸零發動大型技能"; \}/);
assert.match(bossCss,/\.boss-mechanism-card\.destroying\{[\s\S]*?position:absolute;[\s\S]*?pointer-events:none;/);
assert.match(bossCss,/\.boss-mechanism-card\[data-type="charge"\] \.boss-mechanism-effect\{[\s\S]*?font-size:10px;[\s\S]*?font-weight:900;/);

/* The stale destroyed card must not remain as an invisible flex item that
   pushes the next mechanism to the right of the BOSS. */
assert.doesNotMatch(bossCss,/\.boss-mechanism-card\.destroying\{\s*pointer-events:none;/);

/* Four-Symbol Tower weekly element is gameplay state, not just border color. */
assert.match(bossRuntime,/const ELEMENT_ORDER=Object\.freeze\(\["fire","earth","water","wind"\]\)/);
assert.match(bossRuntime,/if\(element==="fire"\)\{ monster\.skillChance=Math\.min\(\.82,monster\.skillChance\+\.08\);monster\.critChance/);
assert.match(bossRuntime,/if\(element==="water"\)\{ monster\.v141SupportSkillIds=ELEMENTS\.water\.supports\.slice\(\);monster\.v141AbyssAi="support"; \}/);
assert.match(bossRuntime,/if\(element==="wind"\)\{ monster\.evasion=.*monster\.agility=.*1\.12; \}/);
assert.match(bossRuntime,/if\(element==="earth"\)\{ monster\.defense=.*monster\.maxHP=.*1\.12;monster\.hp=monster\.maxHP; \}/);

/* Official Sprite Sheets own their complete action where present. The retired
   V142 generic visual stage stays hidden, while its timing gate remains usable. */
assert.match(vfxCss,/#v142-skill-stage\{display:none !important;\}/);
assert.match(vfxRuntime,/current\.config\.id==="fireRocket"&&current\.model\.sprite\)\{ return; \}/);
assert.match(vfxRuntime,/current\.config\.id==="iceSpin"&&current\.model\.sprite\)\{ return; \}/);
assert.match(vfxRuntime,/if\(current\.model\.sprite\)\{\s*addSprite\(current,index,target\);[\s\S]*?return;\s*\}/);

/* Relic scrolling must pass the global touch lock from both the body and the
   horizontal category strip. */
assert.match(touchLock,/#homeFeatureModal\.team-relic-mode #homeFeatureModalBody, \.team-relic-tabs/);
assert.match(relicCss,/\.team-relic-tabs\{[^}]*touch-action:pan-x pan-y;/);
assert.match(relicCss,/team-relic-modal \.home-feature-modal-box\.wide #homeFeatureModalBody\{[^}]*overflow-y:auto!important;[^}]*touch-action:pan-y!important;/);

/* Compact home functions size to content; large empty full-height windows are
   reserved for genuinely large features. */
assert.match(compactModalCss,/#homeFeatureModal:has\(#restButton\) \.home-feature-modal-box\{[\s\S]*?height:auto !important;[\s\S]*?max-height:min\(/);
assert.match(compactModalCss,/#homeFeatureModal:has\(#homeFeatureModalBody > \.system-panel\) \.home-feature-modal-box\{[\s\S]*?height:auto !important;[\s\S]*?max-height:min\(/);

/* Dungeon navigation uses the formal relic entry instead of the old shop slot. */
assert.match(dungeonNav,/\["秘寶","assets\/ui\/nav-relic-v174\.webp","openHomeFeature\('relic'\)"\]/);
assert.ok(fs.existsSync("assets/ui/home-relic-v174.webp"));
assert.ok(fs.existsSync("assets/ui/home-element-box-v174.webp"));
assert.ok(fs.existsSync("assets/ui/nav-relic-v174.webp"));

console.log("✓ 2026-09-08 gameplay/UI regression guards");
