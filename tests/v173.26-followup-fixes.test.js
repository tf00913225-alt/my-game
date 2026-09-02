"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const read=path=>fs.readFileSync(path,"utf8");
const main=read("js/00-main.js");
const v131Css=read("css/31-v131-fix-batch.css");
const statusPopup=read("js/41-v146-system-polish.js");
const loader=read("js/20-anonymous-20.js");
const index=read("index.html");

let passed=0;
function test(name,callback){
    callback();
    passed++;
    console.log("✓ "+name);
}

function extractFunction(source,name){
    const start=source.indexOf("function "+name+"(");
    const end=source.indexOf("\n\n/*",start);
    assert.ok(start>=0&&end>start,"function "+name+" exists");
    return source.slice(start,end);
}

test("numeric programmatic select values render as native string values",()=>{
    const context={String,Object,Array};
    vm.createContext(context);
    vm.runInContext(extractFunction(main,"makeSelectValueReactive"),context);

    const options=["25","50","75","90","100"].map(value=>({value,selected:value==="100"}));
    const select={value:"100",options};
    const rendered=[];
    context.makeSelectValueReactive(select,value=>rendered.push(value));

    select.value=50;
    assert.equal(select.value,"50");
    assert.deepEqual(options.filter(option=>option.selected).map(option=>option.value),["50"]);
    assert.deepEqual(rendered,["50"]);
});

test("switching away from a 100 percent draft renders the target character thresholds",()=>{
    const context={String,Object,Array};
    vm.createContext(context);
    vm.runInContext(extractFunction(main,"makeSelectValueReactive"),context);

    function thresholdSelect(initial){
        const options=["25","50","75","90","100"].map(value=>({value,selected:value===initial}));
        return {value:initial,options};
    }

    const hp=thresholdSelect("100");
    const sp=thresholdSelect("100");
    let hpLabel="100%";
    let spLabel="100%";
    context.makeSelectValueReactive(hp,value=>{ hpLabel=value+"%"; });
    context.makeSelectValueReactive(sp,value=>{ spLabel=value+"%"; });

    const player2={hp:50,sp:25};
    hp.value=player2.hp;
    sp.value=player2.sp;

    assert.deepEqual([hp.value,sp.value],["50","25"]);
    assert.deepEqual([hpLabel,spLabel],["50%","25%"]);
});

test("the final character scroll owner has no synthetic bottom spacer",()=>{
    assert.match(v131Css,/#homeFeatureModal #characterTabContent\{[\s\S]{0,700}padding-bottom:0 !important/);
    assert.doesNotMatch(v131Css,/padding-bottom:110px/);
});

test("turn-end status and buff cleanup resynchronize Sprites at one shared boundary",()=>{
    const startTurn=extractFunction(main,"startTurn");
    const entity={
        statusEffects:[{type:"frostbite",turnsLeft:1}],
        activeBuffs:[{type:"dodgeSkill",turnsLeft:1}]
    };
    let synced=null;
    const context={
        window:null,Set,
        battleActive:true,battleToken:7,turn:2,
        battlePhase:"",activeBattleCharacterIndex:-1,
        declaredCharacterIndexes:null,resolutionPhaseStarted:true,
        turnAdvancePending:true,queuedPlayerActions:null,
        addBattleLog(){},$(){ return null; },
        tickStatusEffects(){ entity.statusEffects=[]; },
        tickPlayerBuffs(){ entity.activeBuffs=[]; },
        checkBattleEnd(){ return false; },
        updateActionHudVisibility(){},beginCharacterTurn(){}
    };
    context.window=context;
    context.v143SyncStatusSpriteEffects=function(){
        synced={
            statuses:entity.statusEffects.slice(),
            buffs:entity.activeBuffs.slice()
        };
    };
    vm.createContext(context);
    vm.runInContext(startTurn,context);
    context.startTurn(7);
    assert.deepEqual(synced,{statuses:[],buffs:[]});
});

test("status popup stays below the HP damage lane",()=>{
    assert.match(statusPopup,/rect\.top\+rect\.height\*\.86/);
    assert.doesNotMatch(statusPopup,/rect\.top\+rect\.height\*\.68/);
});

test("development release advances to V173.33",()=>{
    assert.match(loader,/const V_ASSET_VERSION="173\.33"/);
    assert.match(index,/<title>四象江湖傳 V173\.33<\/title>/);
    assert.match(index,/aria-label="目前版本 V173\.33"/);
    assert.match(index,/>V173\.33<\/div>/);
});

console.log("\n"+passed+" V173.33 follow-up regression tests passed.");
