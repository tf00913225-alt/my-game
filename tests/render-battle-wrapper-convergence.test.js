"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const read=file=>fs.readFileSync(file,"utf8");
const core=read("js/00-main.js");
const v131=read("js/25-v131-fix-batch.js");
const v141=read("js/35-v141-ui-battle.js");
const v143=read("js/38-v143-system-fixes.js");
const v152=read("js/44-v152-dev-fixes.js");
const v154=read("js/45-v154-dev-fixes.js");
const v158=read("js/47-v158-combat-tuning.js");
const fixedSlot=read("js/battlefield-render-geometry-adapter.js");

function walkJavaScript(directory){
    return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{
        const full=path.join(directory,entry.name);
        if(entry.isDirectory()){ return walkJavaScript(full); }
        return entry.isFile()&&entry.name.endsWith(".js")?[full]:[];
    });
}

const runtimeFiles=walkJavaScript("js");
const runtimeSources=runtimeFiles.map(file=>({file:file.split(path.sep).join("/"),source:read(file)}));
const ownerDeclarations=runtimeSources
    .filter(entry=>/\bfunction\s+renderBattle\s*\(/.test(entry.source))
    .map(entry=>entry.file);
const reassignmentCount=runtimeSources.reduce(
    (total,entry)=>total+(entry.source.match(/\brenderBattle\s*=\s*(?:function|wrapped\b)/g)||[]).length,
    0
);

assert.deepEqual(ownerDeclarations,["js/00-main.js"],"00-main.js must be the only renderBattle owner");
assert.equal(reassignmentCount,0,"production runtime must not install renderBattle wrappers");
assert.doesNotMatch(runtimeSources.map(entry=>entry.source).join("\n"),/\brenderBattle(?:2|Final|Fix|V2)\b/);

assert.match(core,/before:Object\.freeze\(\[\s*"v158PrepareBattleRender",\s*"v141PrepareBattleRender"\s*\]\)/);
assert.match(core,/after:Object\.freeze\(\[\s*"v131AfterBattleRender",\s*"v141AfterBattleRender",\s*"v143AfterBattleRender",\s*"v154AfterBattleRender",\s*"vFixedSlotAfterBattleRender"\s*\]\)/);
assert.ok(
    core.indexOf('runBattleRenderHooks("before",this,arguments);')<core.indexOf('const area ='),
    "pre-render hooks must run before canonical DOM rendering"
);
assert.ok(
    core.indexOf('runBattleRenderHooks("after",this,arguments);')>core.indexOf('bossPresentationOwner.syncHud();'),
    "post-render hooks must run after the canonical render and Boss HUD sync"
);

assert.match(v131,/function v131AfterBattleRender\(\)[\s\S]*?applyBattleFormation\(\);[\s\S]*?applyAllyBattleFormation\(\);[\s\S]*?applyPlayerElementFrames\(\);/);
assert.match(v131,/window\.v131AfterBattleRender=v131AfterBattleRender;/);

assert.match(v141,/function v141PrepareBattleRender\(\)[\s\S]*?v141RollWildMonsterRanks[\s\S]*?rebalanceDungeonElements\(\);[\s\S]*?battleSnapshot=\{/);
assert.match(v141,/function v141AfterBattleRender\(\)[\s\S]*?decorateBattleCards\(\);[\s\S]*?v141-preparing-entry/);
assert.match(v141,/window\.v141PrepareBattleRender=v141PrepareBattleRender;/);
assert.match(v141,/window\.v141AfterBattleRender=v141AfterBattleRender;/);

assert.match(v143,/function v143AfterBattleRender\(\)[\s\S]*?decorateEnemyCards\(\);[\s\S]*?requestAnimationFrame\(decorateEnemyCards\)[\s\S]*?v144ConfigureDungeonBattleSkillsAfterRender/);
assert.match(v143,/window\.v143AfterBattleRender=v143AfterBattleRender;/);

assert.doesNotMatch(
    v152,
    /if\(typeof renderBattle==="function"\)\{[\s\S]*?syncAbyssBattleUi\(\);[\s\S]*?\n    \}/,
    "V152 must remain a hook and must not reinstall a renderBattle wrapper"
);
assert.match(v152,/window\.v152SyncAbyssBattleUi=syncAbyssBattleUi;/);

assert.match(v154,/function v154AfterBattleRender\(\)[\s\S]*?window\.v152SyncAbyssBattleUi\(\);[\s\S]*?syncMonsterPortraits\(\);/);
assert.match(v154,/window\.v154AfterBattleRender=v154AfterBattleRender;/);

assert.match(v158,/function v158PrepareBattleRender\(\)[\s\S]*?normalizeDailyDungeonMonster/);
assert.match(v158,/window\.v158PrepareBattleRender=v158PrepareBattleRender;/);

assert.match(fixedSlot,/window\.vFixedSlotAfterBattleRender=reconcile;/);
assert.doesNotMatch(fixedSlot,/window\.renderBattle\s*=/);

console.log("renderBattle owner convergence: PASS");
