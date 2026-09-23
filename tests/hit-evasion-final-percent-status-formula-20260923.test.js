"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const main=fs.readFileSync("js/00-main.js","utf8");
const v140=fs.readFileSync("js/33-v140-four-element-balance.js","utf8");
const v149=fs.readFileSync("js/43-v149-skill-ui-rules.js","utf8");
const v158=fs.readFileSync("js/47-v158-combat-tuning.js","utf8");
const v169=fs.readFileSync("js/50-v169-water-skill-rules.js","utf8");
const progression=fs.readFileSync("js/60-v173.64-skill-progression-rebalance.js","utf8");
const statusVfx=fs.readFileSync("js/39-v143-skill-animation.js","utf8");
const patrol=fs.readFileSync("js/26-v131-patrol-appearance.js","utf8");
const html=fs.readFileSync("index.html","utf8");
const baseCss=fs.readFileSync("css/00-main.css","utf8");
const fixedCss=fs.readFileSync("css/fixed-slot-battlefield-rendering-v2.css","utf8");
const statusCss=fs.readFileSync("css/40-v143-combat-dungeon-polish.css","utf8");
const panelSvg=fs.readFileSync("assets/battle/battle-command-panel-transparent.svg","utf8");

function sourceFunction(source,name){
    const marker="function "+name+"(";
    const start=source.indexOf(marker);
    assert.ok(start>=0,name+" source missing");
    const brace=source.indexOf("{",start);
    let depth=0,quote=null,escape=false;
    for(let i=brace;i<source.length;i++){
        const ch=source[i];
        if(quote){
            if(escape){escape=false;continue;}
            if(ch==="\\"){escape=true;continue;}
            if(ch===quote){quote=null;}
            continue;
        }
        if(ch==='"'||ch==="'"||ch==="`"){quote=ch;continue;}
        if(ch==="{"){depth++;}
        else if(ch==="}"&&--depth===0){return source.slice(start,i+1);}
    }
    throw new Error(name+" source unterminated");
}

function constLine(name){
    const match=main.match(new RegExp("const\\s+"+name+"\\s*=\\s*[^;]+;"));
    assert.ok(match,name+" constant missing");
    return match[0];
}

function constObject(name){
    const marker="const "+name+" = {";
    const start=main.indexOf(marker);
    assert.ok(start>=0,name+" object missing");
    const brace=main.indexOf("{",start);
    let depth=0;
    for(let i=brace;i<main.length;i++){
        if(main[i]==="{"){depth++;}
        else if(main[i]==="}"&&--depth===0){
            const semi=main.indexOf(";",i);
            return main.slice(start,semi+1);
        }
    }
    throw new Error(name+" object unterminated");
}

function formulaRuntime(){
    const code=[
        constLine("HIT_CHANCE_BASE"),
        constLine("HIT_CHANCE_ACCURACY_COEFFICIENT"),
        constLine("HIT_CHANCE_MIN_PERCENT"),
        constLine("HIT_CHANCE_MAX_PERCENT"),
        constLine("DEFAULT_MONSTER_EVASION_PER_LEVEL"),
        constLine("DEFAULT_MONSTER_EVASION_CAP"),
        constLine("STATUS_RESIST_PER_SPIRIT_POINT"),
        constLine("STATUS_OFFENSE_ATTRIBUTE_COEFFICIENT"),
        constLine("STATUS_HIT_MIN_PERCENT"),
        constLine("STATUS_HIT_MAX_PERCENT"),
        constObject("LOCKDOWN_HIT_BOUNDS"),
        sourceFunction(main,"getDefaultMonsterEvasion"),
        sourceFunction(main,"calculateHitChancePercent"),
        sourceFunction(main,"calculateStatusEffectChance"),
        "this.hit=calculateHitChancePercent;this.ev=getDefaultMonsterEvasion;this.status=calculateStatusEffectChance;"
    ].join("\n");
    const context={Math,Number};
    vm.createContext(context);
    vm.runInContext(code,context);
    return context;
}

{
    const r=formulaRuntime();
    assert.equal(r.hit(0,0,0,0),95);
    assert.equal(r.hit(100,10,0,0),99);
    assert.equal(r.hit(0,10,0,0),85);
    assert.equal(r.hit(0,15,5,10),85,"95 + 10 - 15 - 5 must be 85 percentage points");
    assert.deepEqual([40,60,80,100,200].map(r.ev),[4,6,8,10,10]);
    assert.equal(r.status(30,10,10,200,0,true,"boss",20),20);
    assert.equal(r.status(30,99,1,200,0,true,"boss",20),20,"level gap must not change status chance");
    assert.deepEqual(
        ["regular","elite","boss"].map(rank=>r.status(90,10,10,100,0,true,rank,0)),
        [90,75,60]
    );
}

{
    const statusFn=sourceFunction(main,"calculateStatusEffectChance");
    assert.doesNotMatch(statusFn,/Math\.sqrt|levelFactor|LEVEL_DIFF_FACTOR|LOCKDOWN_STATUS_SPIRIT_COEFFICIENT/);
    assert.doesNotMatch(v140,/calculateStatusEffectChance\s*=\s*function|rollHitChance\s*=\s*function|Math\.sqrt\(power\)/);
    assert.doesNotMatch(v158,/v158GetHitChancePercent|rollHitChance\s*=\s*function/);
    assert.doesNotMatch(v149,/rollStatusEffectHit\s*=\s*function/);
    assert.doesNotMatch(v169,/getMonsterEvasion\s*=\s*function|getMonsterEffectiveSpiritPoints\s*=\s*function|getPlayerStatusResistBonus\s*=\s*function/);
    assert.match(main,/evasion:\s*\n\s*getDefaultMonsterEvasion\(level\)/);
    assert.ok(
        main.indexOf("const DEFAULT_MONSTER_EVASION_PER_LEVEL = 0.1;")<
        main.indexOf("function makeZoneMonster("),
        "default monster evasion constants must initialize before top-level zone roster creation"
    );
    assert.ok(
        main.indexOf("function getDefaultMonsterEvasion(level)")<
        main.indexOf("function makeZoneMonster("),
        "default monster evasion owner must exist before makeZoneMonster is invoked at top level"
    );
    assert.match(main,/function combineEvasionRates\(sources\)[\s\S]*?sum\+\(Number\(source\)\|\|0\)/);
}

{
    assert.match(progression,/FINAL_POINT_DAMAGE_LEVELS=Object\.freeze\(\[5,7,9,11,13,15,17,19,22,25\]\)/);
    assert.match(progression,/DODGE_BY_LEVEL=Object\.freeze\(\[5,10,15,20,25\]\)/);
    assert.match(progression,/CALM_RESIST_BY_LEVEL=Object\.freeze\(\[5,8,10,12,15\]\)/);
    assert.match(progression,/CALM_ACCURACY_BY_LEVEL=Object\.freeze\(\[5,10,15,20,25\]\)/);
    assert.match(progression,/windEX:\{[\s\S]*?evasionBonusPercent:10/);
    assert.match(progression,/followUpOnCriticalOrDefeat/);
    assert.match(progression,/免費再施放/);
    assert.match(progression,/鳳威/);
    assert.match(progression,/免費追擊也不消耗3次有效施放次數/);
    assert.match(progression,/不清除永久被動、EX、裝備效果、Boss固有機制、HP／SP或死亡狀態/);
    assert.match(progression,/凍傷：[\s\S]*?傷害-25%[\s\S]*?最終閃躲-25個百分點[\s\S]*?最終異常狀態抗性-25個百分點/);
}

{
    const statusText=sourceFunction(statusVfx,"statusEffectText");
    assert.doesNotMatch(statusText,/凍傷.*無法使用技能/);
    assert.match(statusText,/frostbite[\s\S]*?傷害 -25%[\s\S]*?最終閃躲 -25個百分點[\s\S]*?最終異常狀態抗性 -25個百分點/);
    const finishDuration=sourceFunction(progression,"finishDurationAction");
    assert.match(finishDuration,/v143SyncStatusVisualEffects\("?(?:false)?"?\)|v143SyncStatusVisualEffects\(false\)/);
}

{
    assert.doesNotMatch(html,/id="patrolCharacterImg"[\s\S]{0,180}src="assets\/characters\/patrol-character\.png"/);
    assert.match(patrol,/function decodeSource\(source\)/);
    assert.match(patrol,/image\.style\.visibility="hidden"/);
    assert.match(patrol,/decodedSources\.has\(source\)/);
    assert.match(baseCss,/#mapBattleInfo\{[\s\S]*?background:rgba\(0,0,0,\.88\)/);
    assert.match(baseCss,/battle-command-panel-transparent\.svg/);
    assert.doesNotMatch(baseCss,/#mainBattleMenu::before\{[\s\S]*?battle-command-panel\.jpg/);
    assert.match(panelSvg,/data:image\/jpeg;base64,/);
    assert.match(fixedCss,/\.v-fixed-enemy-slot \.battle-monster-name\{[\s\S]*?background:none !important;[\s\S]*?border:0 !important/);
    assert.match(fixedCss,/\.monster-status-badges\{[\s\S]*?bottom:40px !important;[\s\S]*?min-height:24px !important;[\s\S]*?z-index:32 !important/);
    assert.match(statusCss,/--v143-status-layer-hud:34/);
    assert.match(fixedCss,/\.targetable::after,[\s\S]*?\.ally-targetable::after\{[\s\S]*?content:none !important;[\s\S]*?display:none !important/);
    assert.match(fixedCss,/\.ally-targetable::before,[\s\S]*?\.targetable::before\{/);
    assert.match(fixedCss,/\.battle-info-region:not\(\.is-expanded\)\{[\s\S]*?background:transparent/);
    assert.match(fixedCss,/\.battle-info-region\.is-expanded > #battleInfo\{[\s\S]*?background:rgba\(0,0,0,\.92\) !important/);
    assert.match(fixedCss,/#battleActionRegion\.target-selecting > \.turn-target-row\{[\s\S]*?top:auto;[\s\S]*?bottom:calc\(var\(--battle-target-prompt-height\) \+ var\(--battle-target-select-gap\)\);[\s\S]*?opacity:1/);
}

{
    const drag=sourceFunction(main,"installBattleInfoHandleDrag");
    assert.match(drag,/requestAnimationFrame\(paintDrag\)/);
    assert.match(drag,/translate3d\(/);
    assert.doesNotMatch(drag,/pointermove[\s\S]*?clientWidth|pointermove[\s\S]*?offsetWidth/);
    assert.doesNotMatch(drag,/setTimeout/);
}

console.log("Hit/evasion/status formula + battle UI owner convergence: PASS");
