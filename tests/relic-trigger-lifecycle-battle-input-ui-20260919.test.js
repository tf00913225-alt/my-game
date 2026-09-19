"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const core=fs.readFileSync("js/00-main.js","utf8");
const relic=fs.readFileSync("js/60-team-relic-system.js","utf8");
const ui=fs.readFileSync("js/35-v141-ui-battle.js","utf8");
const mainCss=fs.readFileSync("css/00-main.css","utf8");
const fixesCss=fs.readFileSync("css/45-v152-dev-fixes.css","utf8");
const rippleCss=fs.readFileSync("css/38-v141-system-expansion.css","utf8");

function extractFunction(source,name){
    const start=source.indexOf("function "+name+"(");
    assert.notEqual(start,-1,"missing function "+name);
    const open=source.indexOf("{",start);
    let depth=0,quote=null,escaped=false;
    for(let index=open;index<source.length;index++){
        const char=source[index];
        if(quote){
            if(escaped){escaped=false;continue;}
            if(char==="\\"){escaped=true;continue;}
            if(char===quote){quote=null;}
            continue;
        }
        if(char==='"'||char==="'"||char.charCodeAt(0)===96){quote=char;continue;}
        if(char==="{"){depth++;}
        if(char==="}"&&--depth===0){return source.slice(start,index+1);}
    }
    throw new Error("unterminated function "+name);
}

const flowBlock=core.slice(core.indexOf("window.FourSymbolsBattleFlow=Object.freeze"),core.indexOf("function getBattleAdvanceDelay"));
assert.match(flowBlock,/subscribeRoundStart\(observer\)/);
assert.match(flowBlock,/subscribeRoundEnd\(observer\)/);
assert.match(flowBlock,/acquirePresentationLock\(owner\)/);
assert.match(flowBlock,/isPresentationActive\(\)\{ return battlePresentationLocks\.size>0; \}/);

const nextCombatant=extractFunction(core,"processNextCombatant");
assert.ok(
    nextCombatant.indexOf('notifyBattleRoundBoundary("round_end",token)')<
    nextCombatant.indexOf("\n        turn++;"),
    "the core round_end boundary must settle before turn increments"
);
const startTurn=extractFunction(core,"startTurn");
assert.ok(
    startTurn.indexOf('notifyBattleRoundBoundary("round_start",token)')<
    startTurn.indexOf('battlePhase=\n        "declare"'),
    "the core round_start boundary must precede the new declare phase"
);
assert.match(extractFunction(core,"beginCharacterTurn"),/battlePresentationLocks\.size>0[\s\S]*battleInputResumeToken=token[\s\S]*return;/);

assert.doesNotMatch(relic,/startTurn=function\(/,"team relic must not wrap the core round owner");
assert.doesNotMatch(relic,/subscribeBeforeCombatant/,"round_end must not be inferred from the next combatant hook");
assert.match(relic,/subscribeRoundStart\(\(\)=>/);
assert.match(relic,/subscribeRoundEnd\(\(\)=>/);
assert.match(
    relic,
    /markTriggered\(triggerDef,key\);[\s\S]*?resolveEffects\(triggerDef,def,payload\|\|\{\}\);[\s\S]*?performRelicPresentation\(def,triggerDef,payload\|\|\{\},visuals\)/,
    "gameplay effects must settle synchronously before presentation is queued"
);
assert.doesNotMatch(
    extractFunction(relic,"performRelicPresentation"),
    /resolveEffects\(/,
    "presentation is visual-only and may never own gameplay settlement"
);
assert.doesNotMatch(
    extractFunction(relic,"initializeBattleRelic"),
    /DEV 戰鬥演出預覽|queueRelicPresentation/,
    "presentation-only relics must not auto-play when battle starts"
);
assert.match(relic,/v174RelicDevPreviewPresentation=function\(id\)/);
assert.match(relic,/Runtime Ready（正式功能已完成）/);
assert.match(relic,/Presentation Only（僅演出預覽/);

function classList(initial=[]){
    const values=new Set(initial);
    return {
        add(...tokens){tokens.forEach(token=>values.add(token));},
        remove(...tokens){tokens.forEach(token=>values.delete(token));},
        toggle(token,force){
            if(force===undefined){force=!values.has(token);}
            if(force){values.add(token);}else{values.delete(token);}
            return force;
        },
        contains(token){return values.has(token);}
    };
}
const nodes={
    turnTargetRow:{classList:classList()},
    battleCommandRow:{classList:classList()},
    skillQuickBar:{classList:classList(["show"])},
    itemMenu:{classList:classList(["show"])},
    battleActionRegion:{classList:classList(["target-selecting"])}
};
let presentationActive=true;
const hudContext={
    window:{FourSymbolsBattleFlow:{isPresentationActive:()=>presentationActive}},
    activeBattleCharacterIndex:0,autoBattle:false,battlePhase:"declare",
    getPartyAutoConfig:()=>({enabled:false}),
    $:id=>nodes[id]||null,
    closeMenus(){nodes.skillQuickBar.classList.remove("show");nodes.itemMenu.classList.remove("show");},
    clearBattleTargetSelectionMode(){nodes.battleActionRegion.classList.remove("target-selecting");}
};
vm.createContext(hudContext);
vm.runInContext(extractFunction(core,"updateActionHudVisibility"),hudContext);
hudContext.updateActionHudVisibility();
assert.equal(nodes.turnTargetRow.classList.contains("battle-hud-hidden"),true);
assert.equal(nodes.battleCommandRow.classList.contains("battle-hud-hidden"),true);
assert.equal(nodes.skillQuickBar.classList.contains("show"),false);
assert.equal(nodes.itemMenu.classList.contains("show"),false);
assert.equal(nodes.battleActionRegion.classList.contains("target-selecting"),false);
presentationActive=false;
hudContext.updateActionHudVisibility();
assert.equal(nodes.battleCommandRow.classList.contains("battle-hud-hidden"),false,"manual HUD returns only after the core presentation lock releases");

assert.match(mainCss,/--battle-command-skill-left:6\.8%/);
assert.match(mainCss,/--battle-command-run-width:17\.75%/);
assert.doesNotMatch(fixesCss,/Skill hotspot|width:21\.5%/);

assert.match(ui,/event\.target\.closest\("#battlePage"\)\)\{ return; \}/);
assert.match(ui,/let globalTapRippleNode=null/);
assert.match(ui,/if\(!ripple\|\|!ripple\.isConnected\)/);
assert.match(rippleCss,/will-change:transform,opacity/);
const keyframes=(rippleCss.match(/@keyframes v141TapRipple\{([\s\S]*?)\n\}/)||[])[1]||"";
assert.doesNotMatch(keyframes,/width|height|margin|border-width/,"tap feedback must animate only compositor-friendly properties");
assert.match(keyframes,/transform:scale\(1\)/);
assert.match(keyframes,/opacity:0/);

console.log("✓ relic lifecycle, core round boundary, HUD lock, hitbox and ripple contracts passed");
