"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const battle=fs.readFileSync("js/42-v148-combat-dungeon-fixes.js","utf8");
const tuning=fs.readFileSync("js/47-v158-combat-tuning.js","utf8");
const abyss=fs.readFileSync("js/36-v141-content-systems.js","utf8");
const maps=fs.readFileSync("js/17-stage-v60-training-render-guard.js","utf8");
const ui=fs.readFileSync("css/42-v146-system-polish.css","utf8");
const abyssCss=fs.readFileSync("css/46-v154-dev-fixes.css","utf8");
const v131=fs.readFileSync("js/25-v131-fix-batch.js","utf8");

assert.match(battle,/REFERENCE_TARGET_ORDER_6=\[4,1,3,6,2,5\]/);
assert.match(battle,/REFERENCE_TARGET_ORDER_10=\[7,2,6,1,5,10,4,9,3,8\]/);
assert.match(battle,/monster\.v148TargetOrder=REFERENCE_TARGET_ORDER_6\[slot\]/);
assert.match(tuning,/partySize===1\?\.40:partySize===2\?\.72:1/);
assert.match(tuning,/highestLevel<=15\?\.80:highestLevel<=20\?\.90:highestLevel<=50\?1:1\.05/);
assert.match(tuning,/FORMAL_DAILY_DUNGEON_TYPES=new Set\(\["exp","material","gold"\]\)/);
assert.match(tuning,/v173DailySoloProtected=context\.partySize===1&&context\.highestLevel<=20/);
assert.match(tuning,/Number\(monster\.v141DungeonStage\)===1\?0:Math\.min\(\.45,baseSkillChance\*\.60\)/);
assert.match(tuning,/v173DailyBossUsedSkillLastAction===true/);
assert.doesNotMatch(tuning,/v17342DailyDungeonStatsHalvedAgain/);
assert.match(battle,/if\(soloProtected\)[\s\S]*slot===4\?"elite":null[\s\S]*slot===4\)\{ return "boss"; \}[\s\S]*slot===3\?"elite":null/);
assert.match(battle,/material:\{title:"材料副本",requirement:"任一角色達到20級"/);
assert.match(battle,/gold:\{title:"金幣副本",requirement:"任一角色達到20級"/);
assert.match(ui,/\.v141-notice-dot,[\s\S]*width:7px !important;[\s\S]*height:7px !important/);
assert.match(v131,/const wait=Math\.max\(0,V138_ACTION_DELAY_MS-elapsed\)/);
assert.match(abyss,/abyssState\.phase==="boss"&&floor<5/);
assert.match(abyss,/function maybeTriggerFinalAbyssEncounter\(\)/);
assert.match(abyss,/if\(activeAbyssDialogueAdvance\)/);
assert.match(abyss,/點擊空白處繼續/);
assert.match(abyssCss,/floor-5\.png/);
assert.doesNotMatch(abyssCss,/floor-5 \.v141-abyss-boss::before[\s\S]*floor5-extreme-emperor/);
["desert","ice","zone4","zone5","zone6","zone7","zone8","zone9","zone10"].forEach(key=>assert.match(maps,new RegExp(key+':"assets/maps/')));
[
  "assets/dungeons/covers/gold-v17344.png",
  "assets/dungeons/abyss/maps/floor-1.png","assets/dungeons/abyss/maps/floor-2.png","assets/dungeons/abyss/maps/floor-3.png","assets/dungeons/abyss/maps/floor-4.png","assets/dungeons/abyss/maps/floor-5.png",
  "assets/maps/desert-v17344.png","assets/maps/ice-v17344.png","assets/maps/zone4-v17344.png","assets/maps/zone5-v17344.png","assets/maps/zone6-v17344.png","assets/maps/zone7-v17344.png","assets/maps/zone8-v17344.png","assets/maps/zone9-v17344.png","assets/maps/zone10-v17344.png"
].forEach(path=>assert.equal(fs.existsSync(path),true,path));
console.log("✓ V173.44 current request regression passed");
