"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const bossSource=fs.readFileSync("js/gameplay-boss-tower-system.js","utf8");
const relicSource=fs.readFileSync("js/relic-progression-drop-system.js","utf8");
const relicCatalogSource=fs.readFileSync("js/60-team-relic-system.js","utf8");
const gameplayCss=fs.readFileSync("css/gameplay-boss-tower.css","utf8");
const skillPreviewCss=fs.readFileSync("css/56-v174-critical-ui-regressions.css","utf8");

function bossContext(level=100){
    const noop=()=>{};
    let context;
    const document={
        readyState:"complete",
        getElementById:()=>null,
        querySelector:()=>null,
        querySelectorAll:()=>[],
        createElement:()=>({classList:{add:noop,remove:noop,toggle:noop},dataset:{},setAttribute:noop,appendChild:noop}),
        addEventListener:noop
    };
    const skillDatabase={
        fireRocket:{element:"fire"},explosiveFlurry:{element:"fire"},dragonSlash:{element:"fire"},rage:{element:"fire"},
        waterKnife:{element:"water"},frostPunch:{element:"water"},floodBeast:{element:"water"},healSpell:{element:"water"},
        stoneSlash:{element:"earth"},flyingSandStrike:{element:"earth"},dustStorm:{element:"earth"},rockWall:{element:"earth"},
        stormFlurry:{element:"wind"},windCrossSlash:{element:"wind"},windHowlLightning:{element:"wind"},dodgeSkill:{element:"wind"}
    };
    context={
        window:null,globalThis:null,console,JSON,Math,Date,Number,String,Boolean,Object,Array,Set,Map,Promise,RegExp,Error,TypeError,
        setTimeout:fn=>{ if(fn){ fn(); } return 1; },clearTimeout:noop,
        document,skillDatabase,
        player:{id:"BossQA",level,hp:10000,sp:1000,element:"fire",activeBuffs:[],statusEffects:[]},player2:null,player3:null,
        monsters:[],currentBattleMonsters:[],battleActive:false,battleToken:1,turn:1,
        FourSymbolsAccountSave:{
            getActiveUid:()=>"boss-balance-qa",
            saveKey:uid=>"four_symbols_save:"+uid,
            readForUid:()=>({status:"ready",save:{player:{id:"BossQA",level}}})
        },
        v133GetHighestCreatedCharacterLevel:()=>level,
        saveGame:()=>true,showPage:noop,startTurn:noop,checkBattleEnd:()=>false,
        addBattleLog:noop,
        v132BuildDungeonMonster:(name,monsterLevel,element,rank)=>({
            name,level:monsterLevel,element,rank,maxHP:1000,hp:1000,maxSP:200,sp:200,
            attack:100,magicAttack:100,defense:100,alive:true,statusEffects:[],activeBuffs:[]
        })
    };
    context.v132LaunchDungeonBattle=(roster,onComplete)=>{
        context.monsters=roster;
        context.currentBattleMonsters=roster.map((_,index)=>index);
        context.lastRoster=roster;
        context.lastBattleCallback=onComplete;
        context.battleActive=true;
        return true;
    };
    context.window=context;context.globalThis=context;
    vm.createContext(context);
    vm.runInContext(bossSource,context,{filename:"js/gameplay-boss-tower-system.js"});
    return context;
}

function relicContext(level){
    const catalog={
        relic_qiankun_flask:{id:"relic_qiankun_flask",name:"乾坤玉壺",rarity:"blue",runtimeReady:true,maxLevel:20},
        relic_xuanwu_seal:{id:"relic_xuanwu_seal",name:"玄武靈印",rarity:"blue",runtimeReady:true,maxLevel:20},
        relic_qinglan_feather:{id:"relic_qinglan_feather",name:"青嵐羽符",rarity:"blue",runtimeReady:true,maxLevel:20},
        relic_sun_orb:{id:"relic_sun_orb",name:"烈陽神珠",rarity:"purple",runtimeReady:true,maxLevel:20}
    };
    const owned=Object.fromEntries(Object.keys(catalog).map(id=>[id,{unlocked:true,level:1,exp:0,seen:false}]));
    const loadout={relicId:"relic_qiankun_flask",subRelicId:null};
    const player={id:"RelicQA",level};
    const saveDoc={player,inventoryItems:[]};
    const context={
        window:null,globalThis:null,console,JSON,Math,Date,Number,String,Boolean,Object,Array,Set,Map,Promise,RegExp,Error,TypeError,
        setTimeout,clearTimeout,setInterval,clearInterval,
        player,inventoryItems:saveDoc.inventoryItems,gold:0,
        saveGame(){
            saveDoc.player=JSON.parse(JSON.stringify(context.player));
            saveDoc.playerRelics=JSON.parse(JSON.stringify(owned));
            saveDoc.teamLoadout=JSON.parse(JSON.stringify(loadout));
            return true;
        },
        FourSymbolsAccountSave:{getActiveUid:()=>"relic-lv20-qa",readForUid:()=>({status:"ready",save:saveDoc})},
        v174RelicSystem:{catalog,getOwnedState:()=>owned,getTeamLoadout:()=>loadout},
        GameplaySystem:{
            towerConfig:{floorCount:100,relicChoices:[]},personalBosses:[],worldBosses:[],
            getSerializableState:()=>({personal:{},world:{},tower:{weekKey:"2026-09-07",historicalHighest:0,claimedFloors:{},pendingRelicChoice:false}}),
            getActiveBattleState:()=>null
        }
    };
    context.window=context;context.globalThis=context;
    vm.createContext(context);
    vm.runInContext(relicSource,context,{filename:"js/relic-progression-drop-system.js"});
    return {context,owned,saveDoc};
}

/* Requirement 1: level-derived Boss balance, same-element skill loadouts,
   meaningful mechanism durability and two same-element elite helpers. */
{
    const context=bossContext(100);
    const lv20=context.GameplaySystem.getBossBalanceProfile(20,"personal",1);
    const lv60=context.GameplaySystem.getBossBalanceProfile(60,"personal",1);
    assert.equal(lv20.expectedPartySize,2,"Lv20 Boss balance must assume two same-level characters");
    assert.equal(lv60.expectedPartySize,3,"Lv60+ Boss balance must assume the third character slot is available");
    assert.ok(lv20.hpMultiplier>4.2,"Lv20 Boss HP must be materially stronger than the old fixed multiplier");
    assert.equal(lv20.supportCount,0,"early Bosses remain focused one-Boss fights");
    assert.equal(lv60.supportCount,2,"higher personal Bosses must bring two elite helpers");

    const personalNames=context.GameplaySystem.personalBosses.map(item=>item.name);
    const worldNames=context.GameplaySystem.worldBosses.map(item=>item.name);
    assert.equal(new Set([...personalNames,...worldNames]).size,personalNames.length+worldNames.length,"Boss names must be globally distinct across personal/world lists");
    for(const retired of ["熾焰狼王","烈焰巨魔王","深淵水靈王","寒潮巨獸王","玄冰修羅王","絕冰魔君王","極寒龍獄皇","永凍深淵皇","末世寒神皇","熔岩巨獸王","焚天龍獄皇","終焉神魔皇"]){
        assert.equal([...personalNames,...worldNames].includes(retired),false,"old generic/reused Boss name must not remain: "+retired);
    }
}
{
    const context=bossContext(100);
    assert.equal(context.vGameplayStartBoss("personal","personal-20"),true);
    assert.equal(context.lastRoster.length,1,"Lv20 remains a one-Boss onboarding challenge");
    const boss=context.lastRoster[0];
    assert.equal(boss.element,"fire");
    assert.ok(boss.skillIds.every(id=>context.skillDatabase[id].element===boss.element),"Boss skills must match the Boss element");
    context.turn=2;context.startTurn(context.battleToken);
    const mechanism=context.GameplaySystem.getActiveBattleState().mechanisms[0];
    assert.equal(mechanism.type,"shield");
    assert.ok(mechanism.maxHP>=1500,"Lv20 mechanism cards must survive more than a trivial single hit");
}
{
    const context=bossContext(100);
    assert.equal(context.vGameplayStartBoss("personal","personal-60"),true);
    assert.equal(context.lastRoster.length,3,"Lv60+ personal Boss must have Boss + two elite helpers");
    const [boss,...helpers]=context.lastRoster;
    assert.equal(boss.element,"water");
    assert.equal(helpers.length,2);
    helpers.forEach(helper=>{
        assert.equal(helper.rank,"elite");
        assert.equal(helper.element,boss.element,"elite helper element must match its Boss");
        assert.ok(helper.skillIds.every(id=>context.skillDatabase[id].element===helper.element),"elite helper skills must match helper element");
    });
}

/* Requirement 2: activity cover art uses 16:9 while battlefield Boss and
   mechanism cards retain the newer dev-approved 4:3 combat geometry. */
assert.match(gameplayCss,/\.gameplay-mode-card\{[\s\S]*?aspect-ratio:16\s*\/\s*9;/);
assert.match(gameplayCss,/gameplay-boss-card\[data-rank="boss"\]\{[^}]*aspect-ratio:4\s*\/\s*3;/);
assert.match(gameplayCss,/\.boss-mechanism-card\{[^}]*aspect-ratio:4\s*\/\s*3;/);

/* Requirement 3: all-element preview explicitly distinguishes advantage from
   disadvantage and stays on the real body-mounted modal owner. */
assert.match(skillPreviewCss,/元素克制｜土剋水・水剋火・火剋風・風剋土/);
assert.match(skillPreviewCss,/克制：你的元素剋對方＝你佔優勢/);
assert.match(skillPreviewCss,/被克制：對方元素剋你＝你處於劣勢/);
assert.match(skillPreviewCss,/#allElementSkillPreviewModal \.skill-preview-body::before\{[\s\S]*?white-space:pre-line;/);
assert.doesNotMatch(skillPreviewCss,/body #game-stage #allElementSkillPreviewModal/);

/* Requirement 4: first character Lv20 grants exactly the two designated,
   already-formal blue/runtime-ready starter relics, once per save. */
assert.match(relicCatalogSource,/id:"relic_qiankun_flask"[\s\S]{0,180}?rarity:"blue"[\s\S]{0,100}?runtimeReady:true/);
assert.match(relicCatalogSource,/id:"relic_xuanwu_seal"[\s\S]{0,180}?rarity:"blue"[\s\S]{0,100}?runtimeReady:true/);
{
    const {context,owned}=relicContext(19);
    assert.equal(owned.relic_qiankun_flask.unlocked,false);
    assert.equal(owned.relic_xuanwu_seal.unlocked,false);
    assert.equal(context.RelicProgressionSystem.getProgressionState().firstCharacterLevel20Grant,false);
}
{
    const {context,owned}=relicContext(20);
    const rule=context.RelicProgressionSystem.firstCharacterRelicUnlock;
    assert.equal(rule.level,20);
    assert.deepEqual(Array.from(rule.relicIds),["relic_qiankun_flask","relic_xuanwu_seal"]);
    assert.equal(owned.relic_qiankun_flask.unlocked,true);
    assert.equal(owned.relic_xuanwu_seal.unlocked,true);
    assert.equal(owned.relic_qinglan_feather.unlocked,false,"the milestone must not silently unlock every blue relic");
    assert.equal(context.RelicProgressionSystem.getProgressionState().firstCharacterLevel20Grant,true);
    assert.equal(context.RelicProgressionSystem.reconcileLevelMilestones(),false,"the Lv20 starter grant must be idempotent");
}

console.log("✓ Boss balance / 16:9 gameplay cover / element hint / Lv20 relic milestone regression passed");
