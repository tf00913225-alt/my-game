"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const read=file=>fs.readFileSync(file,"utf8");
const main=read("js/00-main.js");
const spec=read("js/60-v173.64-skill-progression-rebalance.js");
const fixed=read("css/fixed-slot-battlefield-rendering-v2.css");
const itemCss=read("css/00-main.css");
const status=read("js/39-v143-skill-animation.js");
const relic=read("js/60-team-relic-system.js");

function damage(base,growth,level){ let result=base; for(let lv=2;lv<=level;lv++) result=lv===5||lv===10?Math.round(result*1.5):result+growth; return result; }
[
    ["火焰斬",30,6,[30,36,42,48,72,78,84,90,96,144]],
    ["霸龍裂天斬",165,33,[165,198,231,264,396,429,462,495,528,792]],
    ["冰封重擊",116,24,[116,140,164,188,282,306,330,354,378,567]],
    ["暈眩猛擊",141,29,[141,170,199,228,342,371,400,429,458,687]],
    ["地裂重拳",47,9,[47,56,65,74,111,120,129,138,147,221]]
].forEach(([name,base,growth,expected])=>assert.deepEqual(Array.from({length:10},(_,index)=>damage(base,growth,index+1)),expected,name));

assert.match(spec,/const FOUR_ELEMENT_DAMAGE_SPEC=Object\.freeze/);
assert.match(spec,/Object\.entries\(FOUR_ELEMENT_DAMAGE_SPEC\)/);
assert.match(spec,/maxLevel=10/);
assert.match(main,/if\(!isBattleTargetAlive\(targetSide,index\)\)\{ return false; \}/);
assert.doesNotMatch(main,/if\(hostileTargetType==="all"\)\{\s*queuedPlayerActions/);
assert.match(main,/function finishBattleRoundDurations\(\)/);
assert.match(main,/if\(type==="round_end"\)\{ finishBattleRoundDurations\(\); \}/);
assert.match(fixed,/turn-target-row\.battle-item-open\{[\s\S]*bottom:calc\(var\(--battle-command-visual-height\) \+ 112px\)/);
assert.match(fixed,/\.v135-sq-scope/);
assert.match(itemCss,/\.battle-item-menu\{[\s\S]*height:auto;[\s\S]*max-height:/);
assert.match(itemCss,/grid-auto-rows:55px/);
assert.match(main,/battle-item-icon/);
assert.doesNotMatch(main,/battle-item-badge">\$\{resourceLabel\}/);
assert.match(status,/stealthSkill:statusVisual\("","none"/);
assert.match(status,/fireMomentum:statusVisual\("","none"/);
assert.match(relic,/function resolveBattleIdentityIcon/);
assert.match(relic,/return resolveBattleIdentityIcon\(def\)\.then/);
console.log("✓ V174 four-element owner convergence: canonical progression, manual all-target declaration, round-end duration and presentation gates");
