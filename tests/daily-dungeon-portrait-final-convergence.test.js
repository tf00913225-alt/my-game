"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,".."),read=f=>fs.readFileSync(path.join(root,f),"utf8");
const v154=read("js/45-v154-dev-fixes.js"),v159=read("js/48-v159-abyss-battle-portraits.js"),v148=read("js/42-v148-combat-dungeon-fixes.js"),eq=read("js/equipment-progression.js"),p=read("js/54-v173.51-battle-qa.js"),a=read("js/battlefield-render-geometry-adapter.js"),css=read("css/fixed-slot-battlefield-rendering-v2.css");
assert.doesNotMatch(v154,/v162-abyss-battle-portrait-art|createElement\(["']img/);
assert.match(v154,/Promise\.all\(keys\.map/);assert.match(v154,/dailyPortraitPreparation\.delete\(key\)/);assert.match(v154,/monsterPortraitRegistryPromise=null/);
assert.doesNotMatch(v159,/requestAnimationFrame|setTimeout|v132LaunchDungeonBattle/);assert.match(v148,/window\.v148PrepareDailyDungeonLaunch/);assert.match(eq,/v148PrepareDailyDungeonLaunch\("gold",waves\)/);
assert.match(p,/FourSymbolsBattlePresentation=Object\.freeze/);assert.match(a,/window\.vFixedSlotAfterBattleRender=reconcile/);assert.doesNotMatch(css,/v162-abyss-battle-portrait-art/);
console.log("Daily Dungeon Portrait Final Convergence contract: PASS");
