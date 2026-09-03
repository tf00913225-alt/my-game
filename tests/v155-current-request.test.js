/* HISTORICAL SPEC SNAPSHOT (V155): 只保留該版驗收紀錄；V170 最終規格以 v170-final-spec-integration.test.js 為準。 */

const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const source=fs.readFileSync("js/46-v155-dev-fixes.js","utf8");
const v131Source=fs.readFileSync("js/25-v131-fix-batch.js","utf8");
const v142Source=fs.readFileSync("js/37-v142-skill-animation.js","utf8");
const loader=fs.readFileSync("js/20-anonymous-20.js","utf8");
const index=fs.readFileSync("index.html","utf8");

let passed=0;
function test(name,fn){ fn(); passed++; console.log("✓ "+name); }
function array(value){ return Array.from(value||[]); }

function skills(){
    return {
        explosiveFlurry:{id:"explosiveFlurry",name:"火爆亂擊"},
        flameTornado:{id:"flameTornado",name:"烈焰龍捲"},
        fireCritical:{id:"fireCritical",name:"會心一擊",element:"fire",category:"physical",targetType:"single",maxLevel:5,spCost:15},
        dragonSlash:{id:"dragonSlash",name:"霸龍裂天斬",element:"fire",category:"physical",targetType:"single",learnCost:45,maxLevel:5,upgradeCost:1,baseDamage:165,damagePerLevel:33,spCost:65,followUpOnCriticalOrDefeat:true,followUpMaxCasts:2,requires:["explosiveFlurry"]},
        phoenixCry:{id:"phoenixCry",name:"火鳳天鳴",element:"fire",category:"magic",targetType:"all",learnCost:45,maxLevel:5,upgradeCost:1,baseDamage:42,damagePerLevel:9,spCost:60,burnChance:40,burnDuration:2,burnPercentByLevel:[5,7,9,11,13],burnBonusThreshold:3,nextRoundDamageBonusPercent:30,nextRoundDamageBonusDuration:1,requires:["flameTornado"]},
        dustStorm:{id:"dustStorm",name:"地牛猛襲",element:"earth",category:"magic",targetType:"single",maxLevel:5,spCost:65},
        stoneBreakSky:{id:"stoneBreakSky",name:"石破天驚",element:"earth",category:"physical",targetType:"single",maxLevel:5,spCost:42},
        earthShield:{id:"earthShield",name:"萬象土盾",element:"earth",category:"buff",targetType:"allyTri",maxLevel:1,spCost:66,duration:3,reflectPercent:50},
        windHowlLightning:{id:"windHowlLightning",name:"風哮電擊",element:"wind",category:"magic",targetType:"single",maxLevel:5,spCost:55},
        stormRain:{id:"stormRain",name:"風起雲湧",element:"wind",category:"magic",targetType:"all",maxLevel:5,spCost:75},
        dinghaishenzhen:{id:"dinghaishenzhen",name:"氣定神閒",element:"wind",category:"buff",targetType:"allyAll",maxLevel:1,spCost:77,duration:3,statusResistBonus:65,accuracyBonusPercent:50},
        iceArrowRain:{id:"iceArrowRain",name:"冰霜箭雨",element:"water",category:"magic",targetType:"all",maxLevel:5,spCost:45},
        yuanXiangGuangMing:{id:"yuanXiangGuangMing",name:"元相光明",element:"light",category:"heal",maxLevel:5,spCost:35},
        yuanGuangShield:{id:"yuanGuangShield",name:"元光護體",element:"light",category:"buff",maxLevel:5,spCost:40},
        yuanZuBlessing:{id:"yuanZuBlessing",name:"元祖賜福",element:"light",category:"buff",maxLevel:1,spCost:45},
        healSpell:{id:"healSpell",name:"治療術",element:"water",category:"heal",maxLevel:5,spCost:40,baseHeal:350,healPerLevel:30,baseHealSP:35,healSPPerLevel:30,cleanseAll:true},
        revive:{id:"revive",name:"復活術",element:"water",category:"revive",targetType:"deadAlly",maxLevel:5,spCost:45,reviveHealPercentByLevel:[20,40,60,80,100]},
        rage:{id:"rage",name:"怒火",element:"fire",category:"buff",targetType:"allyTri",maxLevel:5,spCost:50,duration:3},
        dodgeSkill:{id:"dodgeSkill",name:"閃躲術",element:"wind",category:"buff",targetType:"allyTri",maxLevel:1,spCost:20,duration:3,evasionBonusPercent:75}
    };
}

function bareDocument(){
    return {getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[]};
}

function load(overrides={}){
    const context=Object.assign({
        window:null,console,Math,Date,Number,Object,Array,Set,Map,Promise,
        skillDatabase:skills(),document:bareDocument(),
        setTimeout:callback=>{ callback(); return 1; },clearTimeout(){},
        currentBattleMonsters:[],monsters:[],battleToken:1,turn:1
    },overrides);
    context.window=context;
    vm.createContext(context);
    vm.runInContext(source,context);
    return context;
}

test("V155 remains ordered before V158 under the current cache version",()=>{
    assert.match(loader,/const V_ASSET_VERSION="173\.40"/);
    assert.match(index,/js\/20-anonymous-20\.js\?v=173\.40/);
    assert.match(index,/js\/19-stage-v78-character-inventory-runtime\.js\?v=173\.39/);
    const v154=loader.indexOf("js/45-v154-dev-fixes.js");
    const v155=loader.indexOf("js/46-v155-dev-fixes.js");
    const v158=loader.indexOf("js/47-v158-combat-tuning.js");
    assert.ok(v154>=0&&v155>v154&&v158>v155);
});

test("V155 preserves the final Fire owner while retaining Emperor support data",()=>{
    const s=load().skillDatabase;
    assert.deepEqual(
        [s.dragonSlash.learnCost,s.dragonSlash.maxLevel,s.dragonSlash.upgradeCost,s.dragonSlash.baseDamage,s.dragonSlash.damagePerLevel,s.dragonSlash.spCost,s.dragonSlash.followUpMaxCasts],
        [45,5,1,165,33,65,2]
    );
    assert.deepEqual(array(s.dragonSlash.requires),["explosiveFlurry"]);
    assert.equal(s.dragonSlash.repeatChanceByLevel,undefined);
    assert.deepEqual(
        [s.phoenixCry.learnCost,s.phoenixCry.maxLevel,s.phoenixCry.upgradeCost,s.phoenixCry.baseDamage,s.phoenixCry.damagePerLevel,s.phoenixCry.spCost,s.phoenixCry.burnChance,s.phoenixCry.burnDuration,s.phoenixCry.burnBonusThreshold,s.phoenixCry.nextRoundDamageBonusPercent],
        [45,5,1,42,9,60,40,2,3,30]
    );
    assert.deepEqual(array(s.phoenixCry.requires),["flameTornado"]);
    assert.deepEqual(array(s.phoenixCry.burnPercentByLevel),[5,7,9,11,13]);
    assert.deepEqual(
        [s.yuanZuBlessing.baseHeal,s.yuanZuBlessing.baseHealSP,s.yuanZuBlessing.cleanseChance,s.yuanZuBlessing.evasionBonusPercent,s.yuanZuBlessing.duration],
        [100,100,35,35,2]
    );
    assert.equal(s.yuanZuBlessing.agilityBonusPercent,undefined);
});

test("final Abyss roster uses the exact ten-enemy loadout at maximum skill levels",()=>{
    const bossNames=["東帝天尊","天帝天尊","極帝天尊","北帝天尊","南帝天尊"];
    const roster=bossNames.map(name=>({name,v141Abyss:true,hp:100,alive:true}));
    for(let index=0;index<5;index++){ roster.push({name:"天兵天將",v141Abyss:true,hp:100,alive:true}); }
    const context=load({monsters:roster,currentBattleMonsters:roster.map((_,index)=>index)});
    context.v155PatchFinalAbyssRoster(roster);
    const byName=name=>roster.find(monster=>monster.name===name);
    assert.deepEqual(array(byName("東帝天尊").skillIds),["dustStorm","stoneBreakSky"]);
    assert.deepEqual(array(byName("東帝天尊").v141SupportSkillIds),["earthShield"]);
    assert.deepEqual(array(byName("天帝天尊").skillIds),["windHowlLightning","stormRain"]);
    assert.deepEqual(array(byName("天帝天尊").v141SupportSkillIds),["dinghaishenzhen"]);
    assert.deepEqual(array(byName("極帝天尊").v141SupportSkillIds),["yuanZuBlessing"]);
    assert.deepEqual(array(byName("北帝天尊").skillIds),["iceArrowRain"]);
    assert.deepEqual(array(byName("北帝天尊").v141SupportSkillIds),["revive","healSpell"]);
    assert.deepEqual(array(byName("南帝天尊").skillIds),["dragonSlash","flameTornado"]);
    assert.deepEqual(array(byName("南帝天尊").v141SupportSkillIds),["rage"]);
    roster.slice(0,5).forEach(monster=>assert.equal(monster.v141ForceSkillLevel,5));
    assert.deepEqual(roster.slice(5).map(monster=>[monster.name,monster.element,array(monster.skillIds),array(monster.v141SupportSkillIds),monster.v141ForceSkillLevel]),[
        ["天兵天將","water",[],["healSpell"],5],
        ["天兵天將","earth",["stoneBreakSky"],[],5],
        ["天兵天將","fire",["flameTornado"],[],5],
        ["天兵天將","wind",[],["dodgeSkill"],5],
        ["天兵天將","water",[],["healSpell"],5]
    ]);
    assert.equal(context.skillDatabase.fireBurstStrike.name,"火爆一擊");
    assert.equal(Object.keys(context.skillDatabase).includes("fireBurstStrike"),false,"monster-only skill must not leak into player lists");
    let forcedSnapshot;
    context.v155WithForcedFinalAbyssSkillLevel(byName("南帝天尊"),()=>{
        const skill=context.skillDatabase.dragonSlash;
        forcedSnapshot=[skill.maxLevel,skill.baseDamage,skill.damagePerLevel,skill.followUpMaxCasts];
    });
    assert.deepEqual(forcedSnapshot,[1,297,0,2],"a low-level floor 5 boss still resolves the maximum skill rank");
    assert.deepEqual([context.skillDatabase.dragonSlash.maxLevel,context.skillDatabase.dragonSlash.baseDamage],[5,165]);
});

test("Extreme Emperor uses only Yuan Zu Blessing with independent cleanse and instant recovery",()=>{
    let finishes=0;
    const oldDisplay={type:"v141TeamBuff"};
    const extreme={name:"極帝天尊",v141Abyss:true,alive:true,hp:300,maxHP:500,sp:200,maxSP:500,evasion:50,agility:50,activeBuffs:[],statusEffects:[{type:"burn"}]};
    const ally={name:"盟友",v141Abyss:true,alive:true,hp:100,maxHP:500,sp:10,maxSP:300,evasion:150,agility:150,
        activeBuffs:[oldDisplay],statusEffects:[{type:"burn"}],v142AgilityBlessing:{originalAgility:100,displayBuff:oldDisplay,turnsLeft:2}};
    const monsters=[extreme,ally];
    const context=load({
        monsters,currentBattleMonsters:[0,1],battleToken:9,turn:1,
        isMonsterFrozen:()=>false,isMonsterPetrified:()=>false,
        finishPlayerAction(){ finishes++; },showMonsterSkillNameBadge(){},showMonsterHit(){},addBattleLog(){},updateUI(){},
        v141HealMonsterPreservingShield(monster,amount){ const before=monster.hp; monster.hp=Math.min(monster.maxHP,monster.hp+amount); return monster.hp-before; }
    });
    assert.equal(context.v155ResolveExtremeEmperorAction(0,"yuanZuBlessing",[true,false]),true);
    assert.deepEqual(array(extreme.statusEffects),[]);
    assert.equal(ally.statusEffects.length,1);
    assert.deepEqual([extreme.hp,extreme.sp],[400,255]);
    assert.deepEqual([ally.hp,ally.sp],[200,110]);
    assert.equal(ally.agility,100,"old agility blessing is removed");
    assert.equal(ally.evasion,85);
    assert.equal(ally.v155EvasionBlessing.displayBuff.turnsLeft,2);
    ally.hp=200; ally.sp=110;
    assert.equal(context.v155ResolveExtremeEmperorAction(0,"yuanZuBlessing",[false,true]),true);
    assert.deepEqual(array(ally.statusEffects),[]);
    assert.deepEqual([ally.hp,ally.sp],[300,210]);
    assert.equal(ally.activeBuffs.filter(buff=>buff.statusName==="元祖賜福").length,1,"same blessing does not stack or refresh");
    assert.equal(context.v155ResolveExtremeEmperorAction(0,"yuanXiangGuangMing"),false,"unassigned former skills cannot be forced");
    assert.equal(finishes,2);
    context.turn=3;
    context.startTurn?context.startTurn(9):context.v155RuleDiagnostics();
});

test("North Emperor revives first, then heals at level five",()=>{
    let finishes=0;
    const north={name:"北帝天尊",v141Abyss:true,alive:true,hp:500,maxHP:500,sp:500,maxSP:500,v141ForceSkillLevel:5,activeBuffs:[],statusEffects:[]};
    const ally={name:"盟友",rank:"boss",v141Abyss:true,alive:false,hp:0,maxHP:1000,sp:10,maxSP:500,activeBuffs:[],statusEffects:[]};
    const context=load({
        monsters:[north,ally],currentBattleMonsters:[0,1],
        isMonsterFrozen:()=>false,isMonsterPetrified:()=>false,
        finishPlayerAction(){ finishes++; },showMonsterSkillNameBadge(){},showMonsterHit(){},addBattleLog(){},updateUI(){},
        v141HealMonsterPreservingShield(monster,amount){ const before=monster.hp; monster.hp=Math.min(monster.maxHP,monster.hp+amount); return monster.hp-before; }
    });
    assert.equal(context.v155ResolveNorthSupport(0,true),true);
    assert.equal(ally.alive,true);
    assert.equal(ally.hp,1000);
    ally.hp=10;
    assert.equal(context.v155ResolveNorthHeal(0,true),true);
    assert.equal(ally.hp,480);
    assert.equal(ally.sp,165);
    assert.equal(finishes,2);
});

test("wind elite uses Dodge, never Stealth",()=>{
    let finishes=0;
    const elite={name:"天兵天將",element:"wind",v141Abyss:true,alive:true,hp:100,maxHP:100,sp:100,maxSP:100,evasion:20,skillChance:1,activeBuffs:[]};
    const context=load({
        monsters:[elite],currentBattleMonsters:[0],battleToken:4,turn:1,
        isMonsterFrozen:()=>false,isMonsterPetrified:()=>false,
        getSkillTargets(center,targetType){ return targetType==="all"?[0]:[center]; },
        finishPlayerAction(){ finishes++; },showMonsterSkillNameBadge(){},addBattleLog(){},updateUI(){}
    });
    assert.equal(context.v155ResolveWindEliteDodge(0,true),true);
    assert.deepEqual(array(context.getSkillTargets(0,"single")),[0]);
    assert.deepEqual(array(context.getSkillTargets(0,"all")),[0]);
    assert.equal(elite.evasion,80);
    assert.deepEqual(
        [elite.v155WindDodge.statusName,elite.v155WindDodge.bonusPercent,elite.v155WindDodge.expiresTurn],
        ["風行",75,4]
    );
    assert.equal(elite.activeBuffs.some(buff=>buff.type==="stealthSkill"||buff.statusName==="隱身"),false);
    assert.equal(context.v155ResolveWindEliteDodge(0,true),false,"same Wind Walk state does not refresh");
    assert.equal(finishes,1);
});

test("enemy Myriad Earth Shield reflects only actual HP loss",()=>{
    const player={id:"攻擊者",hp:1000,maxHP:1000,activeBuffs:[]};
    const target={name:"護盾目標",alive:true,hp:60,maxHP:60,sp:0,maxSP:0,evasion:0,
        activeBuffs:[{type:"earthShield",statusName:"萬象土盾",turnsLeft:3,percent:50}],statusEffects:[]};
    const context=load({
        player,monsters:[target],currentBattleMonsters:[0],
        showMonsterHit(){},showPlayerHit(){},addBattleLog(){},
        normalAttack(){ target.hp=Math.max(0,target.hp-100); this.showMonsterHit(0,100,"hp"); }
    });
    context.normalAttack();
    assert.equal(target.hp,0);
    assert.equal(player.hp,970,"overkill reflects half of the actual 60 HP loss, not half of 100 damage");
});

test("Phoenix fewer-than-three Burn cast grants one non-refreshable next-round 30 percent damage boost",()=>{
    const player={id:"火俠",hp:100,sp:300,activeBuffs:[]};
    const damages=[];
    let burnCount=0;
    const context=load({
        player,battleToken:7,turn:1,addBattleLog(){},showSkillNameBadge(){},
        calculateSkillDamage(){ return 100; },applyBurnEffect(){},
        castDamageSkill(id){
            this.showSkillNameBadge(this.skillDatabase[id].name,"fire",0);
            damages.push(this.calculateSkillDamage());
            for(let index=0;index<burnCount;index++){
                this.applyBurnEffect({name:"目標"+index},2,5);
            }
        }
    });
    context.castDamageSkill("phoenixCry");
    assert.deepEqual(damages,[100]);
    const buff=player.activeBuffs.find(entry=>entry.type==="phoenixMight");
    assert.deepEqual([buff.statusName,buff.readyTurn,buff.expiresTurn,buff.bonusPercent],["鳳威",2,3,30]);
    context.turn=2;
    burnCount=3;
    assert.equal(context.v155GetPhoenixMightMultiplier(player),1.3);
    context.castDamageSkill("phoenixCry");
    assert.deepEqual(damages,[100,100],"the isolated fixture bypasses the production damage formula");
    assert.deepEqual(
        [buff.readyTurn,buff.expiresTurn,buff.bonusPercent],[2,3,30],
        "an existing Phoenix Might state is never refreshed or replaced"
    );
});

test("hard-controlled player and monster finish with the 300 ms override only",()=>{
    const observed=[];
    const player={hp:100,frozen:true};
    const monster={name:"敵人",hp:100,alive:true,frozen:true};
    const context=load({
        monsters:[monster],currentBattleMonsters:[0],battlePhase:"declare",activeBattleCharacterIndex:0,
        getPartyCharacterByIndex:()=>player,
        isMonsterFrozen:entity=>!!(entity&&entity.frozen),isMonsterPetrified:()=>false,
        finishPlayerAction(){ observed.push(this.__battleAdvanceDelayOverrideMs); },
        beginCharacterTurn(){ this.finishPlayerAction(); },
        processSingleMonsterAttack(){ this.finishPlayerAction(); }
    });
    context.beginCharacterTurn(1);
    context.battlePhase="resolve";
    context.processSingleMonsterAttack(0,1);
    assert.deepEqual(observed,[300,300]);
    assert.equal(Object.prototype.hasOwnProperty.call(context,"__battleAdvanceDelayOverrideMs"),false);
    assert.match(v131Source,/consumeBattleAdvanceDelayOverride\(normalDelayMs\)/);
    assert.match(v142Source,/delayOverride===null\?resolveDelay\(initiativeIndex\):delayOverride/);
});

console.log("\nV155 current-request suite: "+passed+" tests passed.");
