/* HISTORICAL SPEC SNAPSHOT (V144): 只保留該版驗收紀錄；V170 最終規格以 v170-final-spec-integration.test.js 為準。 */

const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const index=fs.readFileSync("index.html","utf8");
const loader=fs.readFileSync("js/20-anonymous-20.js","utf8");
const source=fs.readFileSync("js/40-v144-rules-and-abyss.js","utf8");
const css=fs.readFileSync("css/41-v144-rules-and-abyss.css","utf8");

let passed=0;
function test(name,fn){ fn(); passed++; console.log("✓ "+name); }

function skillDatabase(extra={}){
    return Object.assign({
        healSpell:{id:"healSpell",element:"water",category:"heal",spCost:30},
        dodgeSkill:{id:"dodgeSkill",element:"wind",category:"buff",spCost:20},
        stealthSkill:{id:"stealthSkill",element:"wind",category:"buff",spCost:25},
        dinghaishenzhen:{id:"dinghaishenzhen",element:"wind",category:"buff",spCost:55},
        earthShield:{id:"earthShield",element:"earth",category:"buff",spCost:32},
        yuanXiangGuangMing:{id:"yuanXiangGuangMing",name:"元相光明",element:"light",category:"heal",spCost:35},
        yuanGuangShield:{id:"yuanGuangShield",name:"元光護體",element:"light",category:"buff",spCost:40},
        revive:{id:"revive",name:"復活術",element:"water",category:"revive",spCost:45},
        iceArrowRain:{id:"iceArrowRain",name:"冰霜箭雨",element:"water",category:"magic",tier:3,maxLevel:5,spCost:75},
        frostCrush:{id:"frostCrush",name:"冰封重擊",element:"water",category:"physical",tier:4,maxLevel:5,spCost:50},
        stoneThrow:{id:"stoneThrow",name:"落石術",element:"earth",category:"magic",tier:1,maxLevel:5,spCost:7},
        fireBurstStrike:{id:"fireBurstStrike",name:"火爆一擊",element:"fire",category:"physical",tier:2,maxLevel:5,spCost:15},
        flyingSandStrike:{id:"flyingSandStrike",name:"飛沙瞬擊",element:"earth",category:"magic",tier:3,maxLevel:5,spCost:26},
        stoneBreakSky:{id:"stoneBreakSky",name:"石破天驚",element:"earth",category:"physical",tier:3,maxLevel:5,spCost:42},
        barrier:{id:"barrier",name:"結界",element:"earth",category:"buff",maxLevel:1,spCost:40},
        stormRain:{id:"stormRain",name:"風起雲湧",element:"wind",category:"magic",tier:4,maxLevel:5,spCost:75},
        stormSpell:{id:"stormSpell",name:"暴風術",element:"wind",category:"magic",tier:4,maxLevel:5,spCost:55},
        phoenixCry:{id:"phoenixCry",name:"火鳳天鳴",element:"fire",category:"magic",tier:4,maxLevel:5,spCost:62},
        dragonSlash:{id:"dragonSlash",name:"霸龍裂天斬",element:"fire",category:"physical",tier:4,maxLevel:5,spCost:55},
        rage:{id:"rage",name:"怒火",element:"fire",category:"buff",maxLevel:5,spCost:50}
    },extra);
}

function baseContext(overrides={}){
    const context=Object.assign({
        window:null,console,Date,Math,
        setTimeout:callback=>{ callback(); return 1; },clearTimeout(){},
        document:{getElementById:()=>null},
        skillDatabase:skillDatabase(),
        potionDefinitions:[
            {id:"hpPotion10",resource:"hp",recoveryPercent:10,price:1},
            {id:"spPotion10",resource:"sp",recoveryPercent:10,price:1},
            {id:"hpPotion30",resource:"hp",recoveryPercent:30,price:1},
            {id:"spPotion30",resource:"sp",recoveryPercent:30,price:1},
            {id:"hpPotion50",resource:"hp",recoveryPercent:50,price:80},
            {id:"spPotion100",resource:"sp",recoveryPercent:100,price:220}
        ]
    },overrides);
    context.window=context;
    return context;
}

function run(context){
    vm.createContext(context);
    vm.runInContext(source,context);
    return context;
}

test("V144 assets remain ordered before later patches under the current cache version",()=>{
    assert.match(index,/js\/20-anonymous-20\.js\?v=173\.6/);
    assert.match(loader,/const V_ASSET_VERSION="173\.6"/);
    assert.match(loader,/css\/41-v144-rules-and-abyss\.css/);
    const order=[
        "js/38-v143-system-fixes.js","js/39-v143-skill-animation.js","js/40-v144-rules-and-abyss.js","js/41-v146-system-polish.js"
    ].map(path=>loader.indexOf(path));
    assert.ok(order.every(value=>value>=0));
    assert.deepEqual(order.slice().sort((a,b)=>a-b),order);
});

test("shop sells only HP/SP 10, 20 and 30 percent potions at balanced base prices",()=>{
    const context=run(baseContext());
    const snapshot=context.v144RuleDiagnostics();
    assert.deepEqual(JSON.parse(JSON.stringify(snapshot.shopPotionIds)),[
        "hpPotion10","hpPotion20","hpPotion30","spPotion10","spPotion20","spPotion30"
    ]);
    const byId=Object.fromEntries(context.potionDefinitions.map(item=>[item.id,item]));
    assert.equal(byId.hpPotion10.price,20);
    assert.equal(byId.hpPotion20.price,45);
    assert.equal(byId.hpPotion30.price,75);
    assert.equal(byId.spPotion10.price,25);
    assert.equal(byId.spPotion20.price,55);
    assert.equal(byId.spPotion30.price,90);
    assert.equal(byId.hpPotion50.recoveryPercent,50,"legacy owned potions stay usable");
    assert.equal(byId.spPotion100.recoveryPercent,100,"legacy rare potions stay usable");
    assert.match(source,/SHOP_PRICE_TIERS/);
    assert.match(source,/v133GetShopItemPrice/);
});

test("general monsters sample one to three legal skills once per encounter",()=>{
    let randomValue=0;
    const math=Object.create(Math);
    math.random=()=>randomValue;
    const skills=skillDatabase({
        f1:{id:"f1",element:"fire",category:"physical",tier:1,maxLevel:5},
        f2:{id:"f2",element:"fire",category:"magic",tier:1,maxLevel:5},
        f3:{id:"f3",element:"fire",category:"physical",tier:1,maxLevel:5},
        f4:{id:"f4",element:"fire",category:"magic",tier:2,maxLevel:5},
        f5:{id:"f5",element:"fire",category:"physical",tier:2,maxLevel:5},
        f6:{id:"f6",element:"fire",category:"magic",tier:3,maxLevel:5},
        passive:{id:"passive",element:"fire",category:"passive",tier:1,maxLevel:1}
    });
    const context=run(baseContext({Math:math,skillDatabase:skills,
        getMonsterSkillTierAndChance:level=>({maxTier:level<=40?1:level<=70?2:3,chance:.5})
    }));
    const monster={name:"火怪",level:50,element:"fire",skillIds:[]};
    context.v144ConfigureMonsterEncounterSkills(monster,"battle-a");
    const first=monster.skillIds.slice();
    assert.equal(first.length,3);
    assert.ok(first.every(id=>["f1","f2","f3","f4","f5"].includes(id)));
    assert.equal(monster.v144SkillLevel,3);
    assert.equal(monster.v144SkillEncounter,"battle-a");
    assert.deepEqual(monster.skillIds,first,"the carried list remains fixed until a new encounter is configured");
    randomValue=.999;
    context.v144ConfigureMonsterEncounterSkills(monster,"battle-b");
    assert.equal(monster.skillIds.length,3);
    assert.notDeepEqual(monster.skillIds,first,"a later encounter may roll a different loadout");
    const abyss={level:90,element:"fire",v141Abyss:true,skillIds:["phoenixCry"]};
    context.v144ConfigureMonsterEncounterSkills(abyss,"ignored");
    assert.deepEqual(abyss.skillIds,["phoenixCry"],"Abyss loadouts are excluded");
    assert.doesNotMatch(source,/processSingleMonsterAttack\s*=\s*function[\s\S]*configureEncounterSkills/);
});

test("monster carry limits and fixed skill levels follow the exact five bands",()=>{
    const context=run(baseContext());
    assert.deepEqual([20,21,40,41,100].map(context.v144GetMonsterSkillCarryLimit),[1,2,2,3,3]);
    assert.deepEqual([20,21,40,41,60,61,80,81,100].map(context.v144GetMonsterFixedSkillLevel),[1,2,2,3,3,4,4,5,5]);
    assert.match(source,/monster\.v141SkillLevel=monsterSkillLevel\(monster\.level\)/);
});

test("hard-controlled manual characters skip declaration and leave the initiative queue",()=>{
    let originalBegins=0;
    let finishes=0;
    const character={id:"水俠",hp:100,frozen:true};
    const context=run(baseContext({
        battleActive:true,battlePhase:"declare",activeBattleCharacterIndex:0,
        declaredCharacterIndexes:new Set(),actionReady:true,pendingAction:"normal",
        getPartyCharacterByIndex:index=>index===0?character:null,
        isMonsterFrozen:target=>!!target.frozen,isMonsterPetrified:()=>false,
        beginCharacterTurn(){ originalBegins++; },
        buildInitiativeQueue:()=>[{type:"player",characterIndex:0},{type:"monster",monsterIndex:0}],
        finishPlayerAction(){ finishes++; },closeMenus(){},clearBattleTargetSelectionMode(){},
        addBattleLog(){},updateActionHudVisibility(){}
    }));
    context.beginCharacterTurn(7);
    assert.equal(originalBegins,0);
    assert.equal(finishes,1);
    assert.ok(context.declaredCharacterIndexes.has(0));
    assert.deepEqual(JSON.parse(JSON.stringify(context.buildInitiativeQueue())),[{type:"monster",monsterIndex:0}]);
});

test("battle transition wording is entry, victory and defeat instead of one generic seal",()=>{
    const text={textContent:"戰"};
    const overlay={dataset:{},querySelector:selector=>selector==="b"?text:null};
    const context=run(baseContext({
        document:{getElementById:id=>id==="v141BattleTransition"?overlay:null},
        currentBattleMonsters:[],monsters:[],turn:1,
        startTurn(){},winBattle(){},loseBattle(){}
    }));
    context.startTurn(1);
    assert.equal(text.textContent,"進入戰場");
    context.winBattle();
    assert.equal(text.textContent,"勝利");
    context.loseBattle();
    assert.equal(text.textContent,"戰鬥失敗");
    assert.match(css,/min-width:118px/);
    assert.match(css,/data-v144-kind="lose"/);
});

test("the five revised player skills expose the exact costs, targets and effects",()=>{
    const player={activeBuffs:[{type:"dinghaishenzhen",turnsLeft:3}]};
    const context=run(baseContext({
        player,getMainCharacterStats:()=>({accuracy:100}),
        getSkillEffectPreviewText:()=>"legacy",buildSkillLevelBreakdownHTML:()=>"legacy",
        getSkillPreviewSummary:()=>"legacy"
    }));
    const db=context.skillDatabase;
    assert.deepEqual([db.healSpell.baseHeal,db.healSpell.baseHealSP,db.healSpell.healPerLevel,db.healSpell.healSPPerLevel,db.healSpell.spCost],[350,35,30,30,40]);
    assert.equal(db.healSpell.targetType,"allyAll");
    assert.deepEqual(JSON.parse(JSON.stringify(db.healSpell.requires)),["iceArrowRain","iceSpin"]);
    assert.equal(db.dodgeSkill.evasionBonusPercent,60);
    assert.equal(db.stealthSkill.spCost,45);
    assert.deepEqual([db.dinghaishenzhen.statusResistBonus,db.dinghaishenzhen.accuracyBonusPercent,db.dinghaishenzhen.spCost],[45,50,77]);
    assert.deepEqual([db.earthShield.targetType,db.earthShield.reflectPercent,db.earthShield.spCost],["allyAll",50,66]);
    assert.equal(context.getMainCharacterStats().accuracy,150,"氣定神閒 must affect real accuracy");
    assert.equal(context.getSkillEffectPreviewText(db.healSpell,5),"我方全體回復 470 HP、155 SP");
    assert.match(context.buildSkillLevelBreakdownHTML(db.healSpell),/Lv\.5[\s\S]*470 HP、155 SP/);
    assert.match(context.getSkillEffectPreviewText(db.dinghaishenzhen,1),/抗性 \+45%、命中 \+50%/);
});

test("Heal Spell restores its exact level-scaled HP and SP to every living ally",()=>{
    let finishes=0;
    const party=[
        {id:"甲",hp:100,sp:100},
        {id:"乙",hp:10,sp:0},
        {id:"丙",hp:190,sp:190}
    ];
    const maxima=[{maxHP:300,maxSP:200},{maxHP:300,maxSP:200},{maxHP:200,maxSP:200}];
    const context=run(baseContext({
        queuedPlayerActions:{0:{action:"healSpell",target:null,targetAlly:null}},
        getPartyCharacterByIndex:index=>party[index]||null,getPartyCharacterKey:index=>"p"+index,
        getSkillLevel:(key,id)=>id==="healSpell"?5:0,getExistingPartyIndexes:()=>[0,1,2],getPartyBattleStats:index=>maxima[index],
        resolveQueuedPlayerAction(){ throw new Error("legacy single-target heal should not run"); },
        lungePlayerCard(){},showSkillNameBadge(){},showPlayerSpPopup(){},showPlayerHit(){},
        addBattleLog(){},updateUI(){},finishPlayerAction(){ finishes++; }
    }));
    context.resolveQueuedPlayerAction(0,1);
    assert.deepEqual(party.map(item=>item.hp),[300,300,200]);
    assert.deepEqual(party.map(item=>item.sp),[200,155,200]);
    assert.equal(finishes,1);
});

test("Abyss floor 5 has the exact fixed order, skills and maximum levels",()=>{
    const names=["東帝天尊","天帝天尊","極帝天尊","北帝天尊","南帝天尊"];
    const bosses=names.map(name=>({name,v141Abyss:true,skillIds:["old"],v141SupportSkillIds:[]}));
    const elements=["water","earth","fire","wind","water"];
    const elites=elements.map(element=>({name:"天兵天將",element,v141Abyss:true,skillIds:["old"]}));
    const roster=[...bosses,...elites];
    const context=run(baseContext());
    context.v144PatchFinalAbyssRoster(roster);
    assert.deepEqual(roster.slice(0,5).map(monster=>monster.name),names);
    assert.deepEqual(roster.slice(5).map(monster=>monster.element),elements);
    assert.deepEqual(Array.from(roster[0].skillIds),["flyingSandStrike","stoneBreakSky"]);
    assert.deepEqual(Array.from(roster[0].v141SupportSkillIds),["barrier"]);
    assert.deepEqual(Array.from(roster[2].v141SupportSkillIds),["yuanXiangGuangMing","yuanGuangShield"]);
    assert.deepEqual(Array.from(roster[3].skillIds),["iceArrowRain"]);
    assert.deepEqual(Array.from(roster[3].v141SupportSkillIds),["revive","healSpell"]);
    assert.deepEqual(Array.from(roster[4].skillIds),["phoenixCry","dragonSlash"]);
    assert.deepEqual(Array.from(roster[7].skillIds),["fireCritical"]);
    assert.deepEqual(Array.from(roster[8].v141SupportSkillIds),["dodgeSkill"]);
    assert.ok(roster.every(monster=>monster.v141ForceSkillLevel===5));
});

test("Extreme Emperor's Light heals 450/95, cleanses and grants 75% agility",()=>{
    let finishes=0;
    const monsters=Array.from({length:10},(_,index)=>({
        name:index===2?"極帝天尊":"天兵天將",v141Abyss:true,alive:true,
        hp:index===0?100:1000,maxHP:1000,sp:100,maxSP:300,agility:100,statusEffects:index===0?[{type:"burn"}]:[]
    }));
    monsters[2].sp=300;
    const context=run(baseContext({
        monsters,currentBattleMonsters:[0,1,2,3,4,5,6,7,8,9],
        v141TryMonsterSpecialAction:()=>false,
        showMonsterSkillNameBadge(){},addBattleLog(){},updateUI(){},finishPlayerAction(){ finishes++; },
        v141HealMonsterPreservingShield(monster,amount){
            const before=monster.hp; monster.hp=Math.min(monster.maxHP,monster.hp+amount); return monster.hp-before;
        },
        v141ApplyMonsterShield(monster,amount,turns){ monster.v141Shield={remaining:amount,turnsLeft:turns}; monster.hp+=amount; }
    }));
    assert.equal(context.v141TryMonsterSpecialAction(2),true);
    assert.equal(monsters[0].hp,550);
    assert.equal(monsters[0].sp,195);
    assert.equal(monsters[0].statusEffects.length,0);
    assert.equal(monsters[0].agility,175);
    assert.equal(monsters[0].v142AgilityBlessing.turnsLeft,2);
    assert.equal(finishes,1);
});

test("daily dungeon locking runs after element rebalance and never touches Abyss",()=>{
    const renderBlock=source.slice(source.indexOf("let configuredDungeonBattleToken"),source.indexOf("function abyssAllies"));
    assert.match(renderBlock,/previousRenderBattleForSkills\.apply[\s\S]*configureEncounterSkills/);
    assert.match(renderBlock,/!isFinalAbyssRoster\(roster\)/);
    assert.match(source,/if\(!monster\|\|monster\.v141Abyss\)\{ return monster; \}/);
});

console.log("\nV144 rules/Abyss suite: "+passed+" tests passed.");
