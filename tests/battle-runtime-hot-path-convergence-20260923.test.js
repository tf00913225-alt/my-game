"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

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
    assert.doesNotMatch(v55,/window\.v17351SyncInventoryQa|scheduleInventorySync/);
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
    const profiles=block(v39,"    const STATUS_BODY_PRESENTATION=","    const RAW_STATUS_VISUALS=");
    const placement=block(v39,"    function placeStatusBodyVisual(","    function activeBodyStatusTypesForLayer(");
    const context={};
    vm.createContext(context);
    vm.runInContext(profiles+placement+";this.profiles=STATUS_BODY_PRESENTATION;this.place=placeStatusBodyVisual;",context);
    for(const type of ["shield","barrier","earthShield","rockWall"]){
        assert.equal(context.profiles[type].anchor,"feet");
        const properties={};
        const node={dataset:{},style:{setProperty:(key,value)=>{ properties[key]=value; }}};
        // Placement consumes the measured snapshot, never reading layout after a write.
        const card={getBoundingClientRect(){ throw new Error("late status layout read"); }};
        context.place(node,"monster",0,type,card,{slot:"enemy-0",rect:{left:0,top:0,width:100,height:120}},
            {artworkProjection:{rect:{left:10,top:20,width:80,height:100}},hudSurface:{scaleX:1,scaleY:1}},
            {left:0,top:0,width:100,height:120});
        const profile=context.profiles[type];
        assert.equal(parseFloat(node.style.width),Math.min(80*profile.width,94));
        assert.equal(parseFloat(node.style.height),100*profile.height);
        assert.equal(parseFloat(node.style.left),50);
        assert.equal(parseFloat(node.style.top)+parseFloat(node.style.height)/2,120);
        assert.equal(properties["--v143-status-opacity-max"],String(profile.max));
    }
    assert.doesNotMatch(statusCss,/\.v143-status-icon\{[^}]*transform:scale\(/);
}

{
    assert.doesNotMatch(mainCss,/\.battle-info\{/);
    assert.doesNotMatch(fixedCss,/battle-info-region/,"retired battle log UI must stay absent");
    assert.doesNotMatch(fixedCss,/battle-info-region/,"retired battle log UI must stay absent");
    assert.match(mainCss,/#battlePage\{[\s\S]*?--battle-command-row-height:66px;[\s\S]*?--battle-command-art-overhang:0px;[\s\S]*?--battle-command-visual-height:calc\(var\(--battle-command-row-height\) \+ var\(--battle-command-art-overhang\)\);[\s\S]*?--battle-turn-row-height:36px;/);
    assert.doesNotMatch(mainCss,/--battle-center-min-height/);
    assert.doesNotMatch(fixedCss,/--battle-command-row-height:66px|--battle-command-art-overhang:0px/);
    assert.match(fixedCss,/minmax\(0,var\(--battle-center-region-track\)\)/);
    assert.match(fixedCss,/#battleActionRegion > \.turn-target-row\{[\s\S]*?top:0;[\s\S]*?bottom:auto;/);
    assert.doesNotMatch(fixedCss,/#battleActionRegion > \.turn-target-row\{[\s\S]*?bottom:78px/);
}

{
    assert.doesNotMatch(stats,/function appRoot\(|battleStatisticsResultModal|showResultDetails|hideResultDetails/,"retired result UI owner must stay absent");
    assert.doesNotMatch(read("css/battle-statistics-system.css"),/battle-statistics-result-modal/,"retired result surface must not retain CSS");
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
