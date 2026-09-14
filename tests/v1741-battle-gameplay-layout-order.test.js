"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const battle=fs.readFileSync("js/54-v173.51-battle-qa.js","utf8");
const css=fs.readFileSync("css/gameplay-boss-tower.css","utf8");
const boss=fs.readFileSync("js/gameplay-boss-tower-system.js","utf8");
const relic=fs.readFileSync("js/relic-progression-drop-system.js","utf8");
const finalNav=fs.readFileSync("js/42-v148-combat-dungeon-fixes.js","utf8");
const vfx=fs.readFileSync("js/39-v143-skill-animation.js","utf8");
const vfxCss=fs.readFileSync("css/40-v143-combat-dungeon-polish.css","utf8");

// Approved 2026-09-14 battle presentation contract: player art is ~1.5x,
// enemy/BOSS art preserves the complete portrait, enemy identity sits below
// its HP/SP lanes, and enemy resource bars use the thin HUD treatment.
assert.match(battle,/battle-player\.v174-cardless-unit>\.v174-battle-art\{[\s\S]*?inset:-49px -33px 30px!important;[\s\S]*?background-size:contain!important/);
assert.match(battle,/battle-monster\.v174-cardless-unit>\.v174-battle-art\{[\s\S]*?background-size:contain!important[\s\S]*?background-position:center center!important/);
assert.doesNotMatch(battle,/battle-monster\.v174-cardless-unit>\.v174-battle-art\{[\s\S]*?background-size:cover!important/);
assert.match(battle,/battle-monster\.gameplay-boss-card\.v174-cardless-unit>\.v174-battle-art\{[\s\S]*?background-size:contain!important/);
assert.match(battle,/battle-monster\.v174-cardless-unit>\.battle-monster-name\{[\s\S]*?top:auto!important;bottom:0!important/);
assert.match(battle,/battle-monster\.v174-cardless-unit>\.monster-hp\{[\s\S]*?bottom:29px!important/);
assert.match(battle,/battle-monster\.v174-cardless-unit>\.monster-sp\{[\s\S]*?bottom:16px!important/);
assert.match(battle,/battle-monster\.v174-cardless-unit>\.monster-hp,[\s\S]*?height:11px!important;min-height:11px!important/);
assert.match(battle,/monster-hp>\.monster-bar-text,[\s\S]*?font-size:9px!important;line-height:11px!important/);
assert.doesNotMatch(battle,/battle-player\.v174-cardless-unit\{[^}]*?(?:width|max-width|min-height|height):/s,"art sizing must not resize player combat slots");
assert.doesNotMatch(battle,/battle-monster\.v174-cardless-unit\{[^}]*?(?:width|max-width|min-height|height):/s,"art enlargement must not resize enemy combat slots");
assert.match(battle,/battle-player\.v174-cardless-unit>\.hp-bar\{[\s\S]*?bottom:13px!important/);
assert.match(battle,/battle-player\.v174-cardless-unit>\.sp-bar\{[\s\S]*?bottom:0!important/);

// Gameplay and Dungeon must share the single final V148 navigation renderer.
assert.match(finalNav,/function contextNavMarkup\(returnAction\)/);
assert.match(finalNav,/\["角色","assets\/ui\/nav-character\.png"/);
assert.match(finalNav,/\["背包","assets\/ui\/nav-backpack\.png"/);
assert.match(finalNav,/\["秘寶","assets\/ui\/nav-relic-v175\.webp"/);
assert.match(finalNav,/\["元素匣","assets\/ui\/nav-element-box\.png"/);
assert.match(finalNav,/buttons\.push\(\["返回","assets\/ui\/map-return\.png",returnAction\]\)/);

// VFX positioning may overflow; only the inner Sprite Sheet frame clips a cell.
assert.match(vfx,/className="v143-vfx-frame"/);
assert.match(vfx,/frame\.style\.backgroundImage=imageValue/);
assert.match(vfxCss,/\.v143-skill-stage\{[\s\S]*?overflow:visible;[\s\S]*?contain:layout style;/);
assert.match(vfxCss,/\.v143-vfx-frame\{[\s\S]*?overflow:hidden;/);

assert.match(css,/\.gameplay-hub-grid\{[\s\S]*?display:flex;[\s\S]*?flex-direction:column;/);
assert.match(css,/\.gameplay-mode-card\{[\s\S]*?flex:0 0 auto;[\s\S]*?aspect-ratio:16 \/ 9;/);
const detail=boss.slice(boss.indexOf("function bossDetailMarkup"),boss.indexOf("function renderBossPage"));
assert.ok(detail.indexOf("gameplay-primary-action")<detail.indexOf("boss-detail-grid"),"BOSS challenge action must render above recommended-party grid");
assert.match(relic,/grid\.insertBefore\(section,grid\.firstElementChild\)/,"relic preview must be first detail section");
console.log("V174.1 battle/gameplay layout ordering regression checks passed");
