/* HISTORICAL SPEC SNAPSHOT (V148): 只保留該版驗收紀錄；V170 最終規格以 v170-final-spec-integration.test.js 為準。 */

const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const index=fs.readFileSync("index.html","utf8");
const loader=fs.readFileSync("js/20-anonymous-20.js","utf8");
const touchLock=fs.readFileSync("js/01-stage-v8-touch-lock.js","utf8");
const source=fs.readFileSync("js/42-v148-combat-dungeon-fixes.js","utf8");
const css=fs.readFileSync("css/43-v148-combat-dungeon-fixes.css","utf8");

let passed=0;
function test(name,fn){ fn(); passed++; console.log("✓ "+name); }

function classList(initial=[]){
    const values=new Set(initial);
    return {
        add(...names){ names.forEach(name=>values.add(name)); },
        remove(...names){ names.forEach(name=>values.delete(name)); },
        toggle(name,force){
            if(force===undefined){ force=!values.has(name); }
            if(force){ values.add(name); }else{ values.delete(name); }
            return force;
        },
        contains(name){ return values.has(name); },
        values
    };
}

function element(extra={}){
    return Object.assign({
        id:"",style:{},dataset:{},children:[],classList:classList(),offsetWidth:40,
        addEventListener(){},remove(){ this.removed=true; },querySelector:()=>null,querySelectorAll:()=>[],
        getBoundingClientRect:()=>({left:0,top:0,width:100,height:100})
    },extra);
}

function baseContext(overrides={}){
    const context=Object.assign({
        window:null,console,Math,Date,Number,Object,Array,Set,Map,Promise,
        setTimeout:callback=>{ callback(); return 1; },clearTimeout(){},requestAnimationFrame:callback=>callback(),
        skillDatabase:{
            rage:{id:"rage",name:"怒火",element:"fire",category:"buff",targetType:"allyAll",duration:2,spCost:50,
                critChanceBonusByLevel:[5,10,15,20,25],critDamageBonusByLevel:[10,20,30,40,50]},
            healSpell:{id:"healSpell",name:"治療術",element:"water",category:"heal",targetType:"allyAll",duration:1,
                spCost:40,baseHeal:350,healPerLevel:30,baseHealSP:35,healSPPerLevel:30},
            waterEX:{id:"waterEX",healBonusPercent:10},
            revive:{id:"revive",name:"復活術",element:"water",category:"revive",targetType:"deadAlly",spCost:45,
                reviveHealPercentByLevel:[20,30,40,50,60]},
            stealthSkill:{id:"stealthSkill",name:"隱身術",element:"wind",category:"buff",targetType:"ally",duration:2,spCost:45}
        },
        document:{
            readyState:"complete",body:element(),getElementById:()=>null,
            querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){}
        },
        activeBattleCharacterIndex:0
    },overrides);
    context.window=context;
    vm.createContext(context);
    vm.runInContext(source,context);
    return context;
}

test("V148 remains ordered under the current runtime and cache key",()=>{
    assert.match(index,/js\/20-anonymous-20\.js\?v=173\.6/);
    assert.match(loader,/const V_ASSET_VERSION="173\.6"/);
    assert.match(loader,/css\/43-v148-combat-dungeon-fixes\.css/);
assert.match(index,/js\/01-stage-v8-touch-lock\.js\?v=173\.6/);
    const v146=loader.indexOf("js/41-v146-system-polish.js");
    const v148=loader.indexOf("js/42-v148-combat-dungeon-fixes.js");
    assert.ok(v146>=0&&v148>v146);
    assert.match(touchLock,/\.skill-preview-body, \.creation-skill-detail-levels, #dungeonTabContent/);
    assert.match(css,/touch-action:pan-y !important/);
    assert.match(css,/#dungeonPage:not\(\.v146-abyss-active\)\.active[\s\S]*display:flex !important/);
    ["assets/ui/training-background.jpg","assets/ui/home-synthesis.png","assets/battle/element-box.png"]
        .forEach(path=>assert.equal(fs.existsSync(path),true,path+" must exist"));
});

test("tri targets follow the rendered fixed row without ACE skipping",()=>{
    const monsters=Array.from({length:5},(_,index)=>({
        alive:true,hp:100,v141FormationRow:0,v141FormationPosition:index
    }));
    const context=baseContext({
        currentBattleMonsters:[0,1,2,3,4],monsters,
        getSkillTargets:()=>[0,2,4]
    });
    assert.deepEqual(Array.from(context.getSkillTargets(2,"tri")),[1,2,3]);
    monsters[1].hp=0;
    assert.deepEqual(Array.from(context.getSkillTargets(2,"tri")),[2,3],"a dead slot is filtered, not replaced by a farther card");
});

test("enemy Rage buffs only one adjacent trio",()=>{
    let finishes=0;
    const monsters=Array.from({length:5},(_,index)=>({
        name:index===2?"南帝天尊":"天兵",alive:true,hp:500,sp:200,attack:100,magicAttack:80,
        activeBuffs:[],v141TeamBuffs:[],v141FormationRow:0,v141FormationPosition:index,
        v141SupportSkillIds:index===2?["rage"]:[]
    }));
    const math=Object.create(Math);
    math.random=()=>0;
    const context=baseContext({
        Math:math,currentBattleMonsters:[0,1,2,3,4],monsters,
        v141TryMonsterSpecialAction:()=>false,showMonsterSkillNameBadge(){},
        addBattleLog(){},updateUI(){},finishPlayerAction(){ finishes++; },v141PlayCardEffect(){}
    });
    assert.equal(context.v141TryMonsterSpecialAction(2),true);
    assert.deepEqual(monsters.map(monster=>monster.v141TeamBuffs.length),[0,1,1,1,0]);
    assert.equal(finishes,1);
});

test("single buffs animate only their selected living target and cannot refresh",()=>{
    const party=[
        {id:"甲",hp:500,sp:200,activeBuffs:[]},
        {id:"乙",hp:500,sp:200,activeBuffs:[]},
        {id:"丙",hp:500,sp:200,activeBuffs:[]}
    ];
    const effects=[];
    let finishes=0;
    const context=baseContext({
        getExistingPartyIndexes:()=>[0,1,2],getPartyCharacterByIndex:index=>party[index],
        getPartyCharacterKey:index=>"p"+index,getSkillLevel:()=>1,getPartyBattleStats:()=>({maxHP:500,maxSP:200,intelligence:20}),
        lungePlayerCard(){},showSkillNameBadge(){},showPlayerSpPopup(){},addBattleLog(){},updateUI(){},
        finishPlayerAction(){ finishes++; },v141PlayCardEffect:(side,index,type)=>effects.push([side,index,type])
    });
    const skill=context.skillDatabase.stealthSkill;
    context.v148ResolveSupportAction(0,{action:"stealthSkill",targetAlly:2},skill);
    assert.deepEqual(effects,[["player",2,"buff"]]);
    assert.equal(party[2].activeBuffs[0].turnsLeft,2);
    assert.equal(party[0].sp,155);
    context.v148ResolveSupportAction(0,{action:"stealthSkill",targetAlly:2},skill);
    assert.equal(party[2].activeBuffs[0].turnsLeft,2,"the existing duration is unchanged");
    assert.equal(party[0].sp,155,"an entirely invalid recast spends no SP");
    assert.equal(effects.length,1,"no second/all-party visual is emitted");
    assert.equal(finishes,2);
});

test("party buffs apply to unbuffed allies without extending existing turns",()=>{
    const party=[
        {id:"甲",hp:500,sp:200,activeBuffs:[]},
        {id:"乙",hp:500,sp:200,activeBuffs:[{type:"rage",turnsLeft:1}]},
        {id:"丙",hp:500,sp:200,activeBuffs:[]}
    ];
    const effects=[];
    const context=baseContext({
        getExistingPartyIndexes:()=>[0,1,2],getPartyCharacterByIndex:index=>party[index],
        getPartyCharacterKey:()=>"fire",getSkillLevel:()=>1,getPartyBattleStats:()=>({maxHP:500,maxSP:200,intelligence:20}),
        lungePlayerCard(){},showSkillNameBadge(){},showPlayerSpPopup(){},addBattleLog(){},updateUI(){},finishPlayerAction(){},
        v141PlayCardEffect:(side,index)=>effects.push(index)
    });
    context.v148ResolveSupportAction(0,{action:"rage",targetAlly:null},context.skillDatabase.rage);
    assert.deepEqual(party.map(character=>character.activeBuffs.find(buff=>buff.type==="rage").turnsLeft),[2,1,2]);
    assert.deepEqual(effects,[0,2]);
});

test("Heal Spell restores no SP to its caster",()=>{
    const party=[
        {id:"甲",hp:100,sp:100,activeBuffs:[]},
        {id:"乙",hp:100,sp:0,activeBuffs:[]},
        {id:"丙",hp:100,sp:10,activeBuffs:[]}
    ];
    const context=baseContext({
        getExistingPartyIndexes:()=>[0,1,2],getPartyCharacterByIndex:index=>party[index],getPartyCharacterKey:()=>"water",
        getSkillLevel:(key,id)=>id==="healSpell"?1:0,getPartyBattleStats:()=>({maxHP:500,maxSP:200,intelligence:80}),
        lungePlayerCard(){},showSkillNameBadge(){},showPlayerSpPopup(){},showPlayerHit(){},addBattleLog(){},updateUI(){},finishPlayerAction(){},
        v141PlayCardEffect(){}
    });
    context.v148ResolveSupportAction(0,{action:"healSpell",targetAlly:null},context.skillDatabase.healSpell);
    assert.equal(party[0].sp,60,"caster pays 40 SP and receives zero SP");
    assert.equal(party[1].sp,35);
    assert.equal(party[2].sp,45);
    assert.deepEqual(party.map(character=>character.hp),[450,450,450]);
});

test("Revive gives defeated cards a selectable reticle",()=>{
    const cards=[0,1,2].map(index=>element({id:"battlePlayerCard"+index,classList:classList(["battle-player","v146-defeated"])}));
    const party=[{hp:100},{hp:0},{hp:100}];
    const context=baseContext({
        getExistingPartyIndexes:()=>[0,1,2],getPartyCharacterByIndex:index=>party[index],
        setBattleAllyTargetSelectionMode(){},clearBattleTargetSelectionMode(){},
        document:{
            readyState:"complete",body:element(),addEventListener(){},querySelector:()=>null,
            querySelectorAll:selector=>selector.includes("v148-revive-target")
                ?cards.filter(card=>card.classList.contains("v148-revive-target")):[],
            getElementById:id=>cards.find(card=>card.id===id)||null
        }
    });
    context.setBattleAllyTargetSelectionMode("revive");
    assert.equal(cards[1].classList.contains("ally-targetable"),true);
    assert.equal(cards[1].classList.contains("v148-revive-target"),true);
    assert.match(css,/v146-defeated\.v148-revive-target\.ally-targetable[\s\S]*pointer-events:auto !important/);
});

test("Revive restores HP and shows its popup only at the official hit frame",()=>{
    const party=[
        {id:"甲",hp:500,sp:100,activeBuffs:[]},
        {id:"乙",hp:0,sp:0,activeBuffs:[]},
        {id:"丙",hp:500,sp:100,activeBuffs:[]}
    ];
    const hits=[];
    const effects=[];
    const logs=[];
    let scheduledImpact=null;
    const context=baseContext({
        getExistingPartyIndexes:()=>[0,1,2],getPartyCharacterByIndex:index=>party[index],
        getPartyCharacterKey:()=>"water",getSkillLevel:(key,id)=>id==="revive"?1:0,
        getPartyBattleStats:()=>({maxHP:500,maxSP:200,intelligence:80}),
        lungePlayerCard(){},showSkillNameBadge(){},showPlayerSpPopup(){},addBattleLog:message=>logs.push(message),
        updateUI(){},finishPlayerAction(){},
        showPlayerHit:(amount,type,index)=>hits.push([amount,type,index]),
        v141PlayCardEffect:(side,index,type)=>effects.push([side,index,type]),
        v143RunAtTargetHit(side,index,callback,allowDefeated){
            scheduledImpact={side,index,callback,allowDefeated};
            return 1050;
        }
    });
    context.v148ResolveSupportAction(
        0,{action:"revive",targetAlly:1},context.skillDatabase.revive
    );
    assert.equal(party[1].hp,0,"the defeated ally stays down before frame eight");
    assert.deepEqual(hits,[]);
    assert.deepEqual(effects,[]);
    assert.deepEqual(logs,[]);
    assert.deepEqual(
        [scheduledImpact.side,scheduledImpact.index,scheduledImpact.allowDefeated],
        ["player",1,true]
    );
    scheduledImpact.callback();
    assert.equal(party[1].hp,100,"level one revives for twenty percent max HP");
    assert.deepEqual(hits,[[100,"heal",1]]);
    assert.deepEqual(effects,[["player",1,"revive"]]);
    assert.deepEqual(logs,["乙被復活術復活，恢復100 HP。"]);
});

test("Freeze and Petrify replace rather than coexist",()=>{
    const context=baseContext({
        applyFreezeEffect(entity,duration){
            entity.statusEffects.push({type:"freeze",turnsLeft:duration});
        },
        applyMonsterDebuff(entity,type,duration){
            entity.statusEffects.push({type,turnsLeft:duration});
        }
    });
    const entity={statusEffects:[{type:"freeze",turnsLeft:2}]};
    context.applyMonsterDebuff(entity,"petrify",3,0);
    assert.deepEqual(entity.statusEffects.map(effect=>effect.type),["petrify"]);
    context.applyFreezeEffect(entity,4);
    assert.deepEqual(entity.statusEffects.map(effect=>effect.type),["freeze"]);
});

test("Earth Shield visibly and actually reflects fifty percent",()=>{
    const party=[{id:"甲",hp:500,activeBuffs:[{type:"earthShield",turnsLeft:3,percent:50}]}];
    const monsters=[{name:"敵人",alive:true,hp:500}];
    const hits=[];
    const context=baseContext({
        battleActive:true,currentBattleMonsters:[0],monsters,getExistingPartyIndexes:()=>[0],
        getPartyCharacterByIndex:index=>party[index],getActiveBuffPercent:()=>50,
        processSingleMonsterAttack(){ party[0].hp-=100; },showMonsterHit:(index,amount)=>hits.push(amount),
        addBattleLog(){},killMonster(){},checkBattleEnd:()=>false
    });
    context.processSingleMonsterAttack(0,1);
    assert.equal(monsters[0].hp,450);
    assert.deepEqual(hits,[50]);
});

test("a queued second player never acts after the enemy team reaches zero HP",()=>{
    let legacyActions=0;
    const monsters=[{name:"敵人",alive:true,hp:0}];
    const context=baseContext({
        battleActive:true,currentBattleMonsters:[0],monsters,queuedPlayerActions:{1:{action:"normal",target:0}},
        resolveQueuedPlayerAction(){ legacyActions++; },killMonster(index){ monsters[index].alive=false; },
        checkBattleEnd(){ this.battleActive=false; return true; }
    });
    context.resolveQueuedPlayerAction(1,9);
    assert.equal(legacyActions,0);
    assert.equal(monsters[0].alive,false);
});

test("Abyss movement freezes the current frame and accepts a new direction",()=>{
    let accepted=0;
    let lockSeen="1";
    const map=element({
        dataset:{v146Moving:"1"},classList:classList(["v146-moving"]),
        getBoundingClientRect:()=>({left:0,top:0,width:400,height:500})
    });
    const player=element({
        style:{left:"70%",top:"20%"},offsetWidth:20,
        getBoundingClientRect:()=>({left:90,top:180,width:20,height:40})
    });
    const context=baseContext({
        v141AbyssMoveByEvent(){ accepted++; lockSeen=map.dataset.v146Moving; },
        document:{
            readyState:"complete",body:element(),addEventListener(){},querySelector:()=>null,querySelectorAll:()=>[],
            getElementById:id=>id==="v141AbyssMap"?map:id==="v141AbyssPlayer"?player:null
        }
    });
    context.v141AbyssMoveByEvent({clientX:30,clientY:450,target:{closest:()=>null}});
    assert.equal(accepted,1);
    assert.equal(lockSeen,"0","V146 receives the redirected click instead of rejecting it");
    assert.equal(player.style.left,"25%");
    assert.equal(player.style.top,"40%");
});

test("Abyss return is the fifth bottom-nav button and elite names are orange",()=>{
    let html="";
    const nav=element({dataset:{},children:[1,2,3,4]});
    Object.defineProperty(nav,"innerHTML",{get:()=>html,set:value=>{ html=value; nav.children=[1,2,3,4,5]; }});
    const page=element({querySelector:()=>({})});
    const topReturn=element();
    const context=baseContext({
        document:{
            readyState:"complete",body:element(),addEventListener(){},querySelector:()=>null,querySelectorAll:()=>[],
            getElementById:id=>id==="dungeonPage"?page:id==="v141DungeonNav"?nav:id==="v146AbyssReturn"?topReturn:null
        }
    });
    context.v148SyncDungeonShell();
    assert.equal((html.match(/<button/g)||[]).length,5);
    assert.match(html,/onclick="v146ExitAbyssMap\(\)" aria-label="返回"/);
    assert.equal(nav.dataset.v146Columns,"5");
    assert.equal(topReturn.removed,true);
    assert.match(css,/data-rank="elite"[\s\S]*color:#ff9f43 !important/);
    assert.match(css,/#mapPage \.map-monster\[data-rank="elite"\]/);
    assert.match(source,/card\.dataset\.rank=rank==="boss"\?"boss":rank==="elite"\?"elite":"regular"/);
    assert.match(source,/event\.stopImmediatePropagation\(\)/);
});

console.log("\nV148 combat/dungeon fixes suite: "+passed+" tests passed.");
