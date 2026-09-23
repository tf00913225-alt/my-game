"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const ROOT=path.resolve(__dirname,"..");
const read=relative=>fs.readFileSync(path.join(ROOT,relative),"utf8");

const main=read("js/00-main.js");
const v39=read("js/39-v143-skill-animation.js");
const v45=read("js/45-v154-dev-fixes.js");
const v48=read("js/48-v159-abyss-battle-portraits.js");
const v54=read("js/54-v173.51-battle-qa.js");
const v55=read("js/55-v173.51-inventory-qa.js");
const v57=read("js/57-v173.51-quest-qa.js");
const v58=read("js/58-v173.63-functional-fixes.js");
const geometry=read("js/battlefield-render-geometry-adapter.js");
const statusCss=read("css/40-v143-combat-dungeon-polish.css");
const fixedCss=read("css/fixed-slot-battlefield-rendering-v2.css");
const mainCss=read("css/00-main.css");
const stats=read("js/battle-statistics-system.js");
const guard=read(".github/scripts/battle-runtime-architecture-guard.mjs");

function block(source,startToken,endToken){
    const start=source.indexOf(startToken);
    const end=source.indexOf(endToken,start+startToken.length);
    assert.ok(start>=0&&end>start,"missing block "+startToken);
    return source.slice(start,end);
}

{
    const quickBar=block(main,"function populateSkillQuickBar()","function syncTurnTimerWithBattlePickers");
    assert.match(main,/function ensureSkillQuickBarButtons\(bar\)/);
    assert.match(main,/bar\.replaceChildren\(\)/);
    assert.doesNotMatch(quickBar,/bar\.innerHTML\s*=\s*["']/);
    assert.match(quickBar,/syncSkillQuickBarButton\(/);
}

{
    const ui=block(main,"function updateUI()","let autosaveIndicatorTimer");
    const battleBranch=ui.indexOf("if(battleActive)");
    const returnAt=ui.indexOf("return;",battleBranch);
    const homeUpdate=ui.indexOf("updateHomeTestTools()");
    assert.ok(battleBranch>=0&&returnAt>battleBranch&&homeUpdate>returnAt,
        "battle updateUI must return before home/non-battle work");
    assert.match(ui,/currentBattleMonsters\.forEach\(index=>\{\s*updateMonsterUI\(index\)/);
}

{
    assert.doesNotMatch(v45,/\bupdateMonsterUI\s*=\s*function/);
    assert.doesNotMatch(v48,/\bupdateUI\s*=\s*function/);
    assert.match(v45,/window\.v154AfterBattleRender=v154AfterBattleRender/);
    assert.match(main,/"v154AfterBattleRender",[\s\S]*"v17351AfterBattleRender",[\s\S]*"vFixedSlotAfterBattleRender"/);
    assert.match(v54,/window\.v17351AfterBattleRender=syncBattlePresentation/);
}

{
    assert.doesNotMatch(v54,/MutationObserver/);
    assert.doesNotMatch(geometry,/MutationObserver/);
    assert.doesNotMatch(v55,/MutationObserver|setInterval\s*\(/);
    assert.doesNotMatch(v57,/MutationObserver|setInterval\s*\(/);
    assert.doesNotMatch(v58,/\.observe\s*\(\s*document\.body|document\.addEventListener\s*\(\s*["'](?:click|change)["']\s*,\s*scheduleRepairs/);
    assert.match(v55,/window\.v17351SyncInventoryQa=scheduleInventorySync/);
    assert.match(v57,/window\.v17351PreviewQuestMilestones=previewChests/);
    assert.match(v58,/window\.v17363SyncFunctionalFixes=runRepairs/);
}

{
    assert.match(main,/function isBattleStatusInspectionBlocked\(\)\{[\s\S]*?if\(!battleActive\)\{ return true; \}[\s\S]*?target-selecting/);
    const inspection=block(main,"function isBattleStatusInspectionBlocked()","function battleStatusElementLabel");
    assert.doesNotMatch(inspection,/actionReady|pendingAction|skillQuickBar|itemMenu/);
}

{
    assert.match(statusCss,/\.v143-status-icon\{[\s\S]*?width:24px;[\s\S]*?height:24px;[\s\S]*?flex:0 0 24px/);
    assert.match(v39,/const STATUS_ROTATION_MS=2000/);
    assert.match(v39,/const shellStatus=type==="shield"\|\|type==="barrier"\|\|type==="earthShield"\|\|type==="rockWall"/);
    assert.match(v39,/widthScale=\(regularEnemy\?1\.45:1\.40\)\*\(shellStatus\?1\.08:1\)/);
    assert.doesNotMatch(statusCss,/\.v143-status-icon\{[^}]*transform:scale\(/);
}

{
    assert.match(mainCss,/\.battle-info\{[\s\S]*?background:transparent;[\s\S]*?border:0;[\s\S]*?border-radius:0/);
    assert.match(fixedCss,/\.battle-info-region\.is-expanded\{[\s\S]*?border:1px solid rgba\(138,106,58,\.72\);[\s\S]*?background:rgba\(8,8,8,\.96\);[\s\S]*?box-shadow:none/);
    assert.match(mainCss,/#battlePage\{[\s\S]*?--battle-command-row-height:66px;[\s\S]*?--battle-command-art-overhang:34px;[\s\S]*?--battle-command-visual-height:calc\(var\(--battle-command-row-height\) \+ var\(--battle-command-art-overhang\)\);[\s\S]*?--battle-turn-row-height:36px;[\s\S]*?--battle-center-min-height:/);
    assert.doesNotMatch(fixedCss,/--battle-command-row-height:66px|--battle-command-art-overhang:34px/);
    assert.match(fixedCss,/minmax\(var\(--battle-center-min-height\),var\(--battle-center-region-track\)\)/);
    assert.match(fixedCss,/#battleActionRegion > \.turn-target-row\{[\s\S]*?bottom:var\(--battle-command-visual-height\)/);
    assert.doesNotMatch(fixedCss,/#battleActionRegion > \.turn-target-row\{[\s\S]*?bottom:78px/);
}

{
    assert.match(stats,/function appRoot\(\)\{\s*return document\.getElementById\("game-content"\)\|\|document\.getElementById\("app"\)/);
    assert.doesNotMatch(read("css/battle-statistics-system.css"),/battle-statistics-result-modal[\s\S]{0,500}transform:\s*scale\(/);
}

{
    assert.match(guard,/updateUIWrappers:0/);
    assert.match(guard,/updateMonsterUIWrappers:0/);
    assert.match(guard,/bodyObservers:0/);
    assert.match(guard,/retired QA\/repair polling pattern returned/);
    assert.match(guard,/setIntervals:15/);
    assert.match(guard,/globalClickListeners:5/);
}

console.log("Battle Runtime Hot Path convergence contracts: PASS");
