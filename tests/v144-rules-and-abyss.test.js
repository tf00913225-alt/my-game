/* HISTORICAL SPEC SNAPSHOT (V144): 只保留該版驗收紀錄；V170 最終規格以 v170-final-spec-integration.test.js 為準。 */

const assert=require("node:assert/strict");
const fs=require("node:fs");
const releaseMeta=JSON.parse(fs.readFileSync("release/release.json","utf8"));
const vm=require("node:vm");

const index=fs.readFileSync("index.html","utf8");
const loader=fs.readFileSync("js/20-anonymous-20.js","utf8")+fs.readFileSync("scripts/build-production.mjs","utf8");
const source=fs.readFileSync("js/40-v144-rules-and-abyss.js","utf8");
const progressionSource=fs.readFileSync("js/60-v173.64-skill-progression-rebalance.js","utf8");
const v143Source=fs.readFileSync("js/38-v143-system-fixes.js","utf8");
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
    assert.match(index,/build\/boot-core\.[0-9a-f]{12}\.js/);
    assert.equal((loader.match(/const V_ASSET_VERSION="([^"]+)"/)||[])[1],releaseMeta.cacheVersion);
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
    assert.deepEqual(
        ["hpPotion10","hpPotion20","hpPotion30","spPotion10","spPotion20","spPotion30"].map(id=>byId[id].name),
        ["回春散","養命丹","大還丹","凝氣散","聚氣丹","歸元丹"]
    );
    assert.deepEqual(
        ["hpPotion10","hpPotion20","hpPotion30","spPotion10","spPotion20","spPotion30"].map(id=>byId[id].shortName),
        ["回春散","養命丹","大還丹","凝氣散","聚氣丹","歸元丹"]
    );
    assert.match(byId.hpPotion10.icon,/assets\/items\/potions\/hp-potion-10-huichun\.webp/);
    assert.match(byId.hpPotion20.icon,/assets\/items\/potions\/hp-potion-20-yangming\.webp/);
    assert.match(byId.hpPotion30.icon,/assets\/items\/potions\/hp-potion-30-dahuan\.webp/);
    assert.match(byId.spPotion10.icon,/assets\/items\/potions\/sp-potion-10-ningqi\.webp/);
    assert.match(byId.spPotion20.icon,/assets\/items\/potions\/sp-potion-20-juqi\.webp/);
    assert.match(byId.spPotion30.icon,/assets\/items\/potions\/sp-potion-30-guiyuan\.webp/);
    assert.ok(["hpPotion10","hpPotion20","hpPotion30","spPotion10","spPotion20","spPotion30"].every(id=>byId[id].icon.includes("v169-item-art")));
    assert.equal(byId.hpPotion50.recoveryPercent,50,"legacy owned potions stay usable");
    assert.equal(byId.spPotion100.recoveryPercent,100,"legacy rare potions stay usable");
    assert.match(source,/SHOP_PRICE_TIERS/);
    assert.match(source,/v133GetShopItemPrice/);
});

test("formal potion presentation syncs existing inventory stacks and shop cards",()=>{
    const owned={
        hpPotion10:[{id:"hpPotion10",name:"舊名稱",icon:""}],
        hpPotion20:[{id:"hpPotion20",name:"舊名稱",icon:""}],
        hpPotion30:[{id:"hpPotion30",name:"舊名稱",icon:""}],
        spPotion10:[{id:"spPotion10",name:"舊名稱",icon:""}],
        spPotion20:[{id:"spPotion20",name:"舊名稱",icon:""}],
        spPotion30:[{id:"spPotion30",name:"舊名稱",icon:""}]
    };
    const context=run(baseContext({
        getPotionInventoryItems:id=>owned[id]||[],
        getPotionCount:()=>0,
        gold:999999,
        renderShopContent:()=>"",
        v133GetHighestCreatedCharacterLevel:()=>1
    }));
    const expected={
        hpPotion10:"回春散",hpPotion20:"養命丹",hpPotion30:"大還丹",
        spPotion10:"凝氣散",spPotion20:"聚氣丹",spPotion30:"歸元丹"
    };
    Object.entries(expected).forEach(([id,name])=>{
        assert.equal(owned[id][0].name,name);
        assert.match(owned[id][0].icon,/\.webp/);
    });
    const markup=context.renderShopContent();
    assert.equal((markup.match(/shop-potion-icon/g)||[]).length,6);
    assert.match(markup,/回春散/);
    assert.match(markup,/歸元丹/);
    assert.match(markup,/assets\/items\/potions\/hp-potion-10-huichun\.webp/);
    assert.match(markup,/assets\/items\/potions\/sp-potion-30-guiyuan\.webp/);
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
    const abyss={
        level:90,element:"fire",v141Abyss:true,
        skillIds:["phoenixCry","stoneThrow"],
        v141SupportSkillIds:["rage","healSpell"]
    };
    context.v144ConfigureMonsterEncounterSkills(abyss,"ignored");
    assert.deepEqual(abyss.skillIds,["phoenixCry"],"Abyss attacks are validated but not regenerated");
    assert.deepEqual(abyss.v141SupportSkillIds,["rage"],"Abyss supports also pass the same element guard");
    assert.equal(abyss.v144SkillEncounter,undefined);
    assert.doesNotMatch(source,/processSingleMonsterAttack\s*=\s*function[\s\S]*configureEncounterSkills/);
});

test("fixed loadouts fail closed on cross-element IDs unless explicitly allowlisted",()=>{
    const context=run(baseContext());
    const regular={
        level:80,element:"water",v132FixedSkillLoadout:true,v141ForceSkillLevel:5,
        skillIds:["iceArrowRain","phoenixCry"],v141SupportSkillIds:["healSpell","rage"]
    };
    context.v144ConfigureMonsterEncounterSkills(regular,"fixed-water");
    assert.deepEqual(regular.skillIds,["iceArrowRain"]);
    assert.deepEqual(regular.v141SupportSkillIds,["healSpell"]);
    assert.deepEqual(regular.v144LegalSkillPool,["iceArrowRain"]);

    const explicit={
        level:80,element:"light",v141Abyss:true,
        skillIds:["flyingSandStrike","phoenixCry"],v141SupportSkillIds:[],
        v144CrossElementSkillIds:["flyingSandStrike","phoenixCry"]
    };
    context.v144ConfigureMonsterEncounterSkills(explicit,"abyss-explicit");
    assert.deepEqual(explicit.skillIds,["flyingSandStrike","phoenixCry"]);
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

test("later skill progression owner supersedes the V144 player-skill snapshot",()=>{
    assert.match(progressionSource,/healSpell:\{[\s\S]*?targetType:"allyTri"[\s\S]*?healHpByLevel:HEAL_HP_BY_LEVEL\.slice\(\)[\s\S]*?cleanseAll:true/);
    assert.match(progressionSource,/freeze:\{[\s\S]*?targetType:"column",targetTypeAtMaxLevel:"tri"[\s\S]*?freezeChanceByLevel:FREEZE_CHANCE_BY_LEVEL\.slice\(\)/);
    assert.match(progressionSource,/dodge\.targetType="allyTri"; dodge\.duration=3; dodge\.spCost=20/);
    assert.match(progressionSource,/calm\.statusResistBonusByLevel=CALM_RESIST_BY_LEVEL\.slice\(\)/);
    assert.match(progressionSource,/shield\.targetType="allyTri"; shield\.spCost=66/);
    assert.doesNotMatch(source,/getMainCharacterStats\s*=\s*function[\s\S]*accuracyBonusPercent/);
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

test("V144 no longer owns or patches the final Lv40 Abyss roster",()=>{
    assert.doesNotMatch(source,/FINAL_BOSS_RULES|FINAL_ELITES|v144PatchFinalAbyssRoster/);
    assert.match(source,/v174TrueRealmFinal/);
});

test("V144 leaves the final support cast to the shared Skill-ID dispatcher",()=>{
    assert.doesNotMatch(source,/window\.v141TryMonsterSpecialAction=function/);
    assert.doesNotMatch(source,/monster\.name===\"極帝天尊\"|monster\.name===\"北帝天尊\"|monster\.name===\"天帝天尊\"/);
});

test("shared dungeon render hook validates every runtime mode without mutating monster elements",()=>{
    const renderBlock=source.slice(source.indexOf("let configuredDungeonBattleToken"),source.indexOf("function abyssAllies"));
    assert.doesNotMatch(renderBlock,/renderBattle\s*=\s*function/);
    assert.doesNotMatch(renderBlock,/monster\.element\s*=/);
    assert.match(source,/function configureDungeonBattleSkillsAfterRender/);
    assert.match(source,/window\.v144ConfigureDungeonBattleSkillsAfterRender=configureDungeonBattleSkillsAfterRender/);
    assert.match(v143Source,/v144ConfigureDungeonBattleSkillsAfterRender/);
    assert.match(source,/function isMonsterSkillElementLegal\(monster,skillId\)/);
    assert.match(source,/window\.v144NormalizeMonsterSkillLoadout=normalizeMonsterSkillLoadout/);
});

test("the existing V143 render hook invokes V144 dungeon locking once per battle",()=>{
    let renderCalls=0;
    const dungeonMonsters=[{name:"火怪",level:50,element:"fire",skillIds:[]}];
    const context=baseContext({
        renderBattle(){ renderCalls++; return "rendered"; },
        requestAnimationFrame(){},
        setTimeout(){ return 1; },
        v132ActiveDungeonRun:true,
        battleToken:"battle-a",
        currentBattleMonsters:[0],
        monsters:dungeonMonsters
    });
    vm.createContext(context);
    vm.runInContext(v143Source,context);
    vm.runInContext(source,context);
    assert.equal(context.renderBattle(),"rendered");
    context.v143AfterBattleRender();
    assert.equal(renderCalls,1);
    assert.match(dungeonMonsters[0].v144SkillEncounter,/^dungeon-render-/);
    const encounter=dungeonMonsters[0].v144SkillEncounter;
    context.renderBattle();
    context.v143AfterBattleRender();
    assert.equal(dungeonMonsters[0].v144SkillEncounter,encounter);
});

console.log("\nV144 rules/Abyss suite: "+passed+" tests passed.");
