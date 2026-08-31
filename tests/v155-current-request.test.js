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
        dragonSlash:{id:"dragonSlash",name:"霸龍裂天斬",element:"fire",category:"physical"},
        phoenixCry:{id:"phoenixCry",name:"火鳳天鳴",element:"fire",category:"magic"},
        yuanXiangGuangMing:{id:"yuanXiangGuangMing",name:"元相光明",element:"light",category:"heal",maxLevel:5,spCost:35},
        yuanGuangShield:{id:"yuanGuangShield",name:"元光護體",element:"light",category:"buff",maxLevel:5,spCost:40},
        yuanZuBlessing:{id:"yuanZuBlessing",name:"元祖賜福",element:"light",category:"buff",maxLevel:1,spCost:45},
        healSpell:{id:"healSpell",name:"治療術",element:"water",category:"heal",maxLevel:5,spCost:40,baseHeal:350,healPerLevel:30,baseHealSP:35,healSPPerLevel:30},
        stealthSkill:{id:"stealthSkill",name:"隱身術",element:"wind",category:"buff",targetType:"ally",maxLevel:1,spCost:45,duration:2}
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
    assert.match(loader,/const V_ASSET_VERSION="173\.11"/);
    assert.match(index,/js\/20-anonymous-20\.js\?v=173\.11/);
    assert.match(index,/js\/19-stage-v78-character-inventory-runtime\.js\?v=173\.11/);
    const v154=loader.indexOf("js/45-v154-dev-fixes.js");
    const v155=loader.indexOf("js/46-v155-dev-fixes.js");
    const v158=loader.indexOf("js/47-v158-combat-tuning.js");
    assert.ok(v154>=0&&v155>v154&&v158>v155);
});

test("Dragon Slash and Phoenix Cry expose every requested final value",()=>{
    const s=load().skillDatabase;
    assert.deepEqual(
        [s.dragonSlash.learnCost,s.dragonSlash.maxLevel,s.dragonSlash.upgradeCost,s.dragonSlash.baseDamage,s.dragonSlash.damagePerLevel,s.dragonSlash.spCost,s.dragonSlash.repeatMaxCasts],
        [45,5,1,165,25,65,2]
    );
    assert.deepEqual(array(s.dragonSlash.requires),["explosiveFlurry"]);
    assert.deepEqual(array(s.dragonSlash.repeatChanceByLevel),[5,10,20,30,40]);
    assert.deepEqual(
        [s.phoenixCry.learnCost,s.phoenixCry.maxLevel,s.phoenixCry.upgradeCost,s.phoenixCry.baseDamage,s.phoenixCry.damagePerLevel,s.phoenixCry.spCost,s.phoenixCry.burnChance,s.phoenixCry.burnDuration,s.phoenixCry.burnBonusOnNoTargetsPercent],
        [45,5,1,60,18,68,70,2,50]
    );
    assert.deepEqual(array(s.phoenixCry.requires),["flameTornado"]);
    assert.deepEqual(array(s.phoenixCry.burnPercentByLevel),[5,7,9,11,13]);
    assert.deepEqual([s.yuanZuBlessing.cleanseChance,s.yuanZuBlessing.evasionBonusPercent,s.yuanZuBlessing.duration],[20,30,2]);
    assert.equal(s.yuanZuBlessing.agilityBonusPercent,undefined);
});

test("final Abyss roster uses exact boss maxima and elite minima",()=>{
    const bossNames=["東帝天尊","天帝天尊","極帝天尊","北帝天尊","南帝天尊"];
    const roster=bossNames.map(name=>({name,v141Abyss:true,hp:100,alive:true}));
    for(let index=0;index<5;index++){ roster.push({name:"天兵天將",v141Abyss:true,hp:100,alive:true}); }
    const context=load({monsters:roster,currentBattleMonsters:roster.map((_,index)=>index)});
    context.v155PatchFinalAbyssRoster(roster);
    const byName=name=>roster.find(monster=>monster.name===name);
    assert.deepEqual(array(byName("東帝天尊").skillIds),["dustStorm","stoneBreakSky"]);
    assert.deepEqual(array(byName("東帝天尊").v141SupportSkillIds),["barrier"]);
    assert.deepEqual(array(byName("天帝天尊").skillIds),["windHowlLightning","stormRain","stormSpell"]);
    assert.deepEqual(array(byName("天帝天尊").v141SupportSkillIds),[]);
    assert.deepEqual(array(byName("極帝天尊").v141SupportSkillIds),["yuanXiangGuangMing","yuanGuangShield","yuanZuBlessing"]);
    assert.deepEqual(array(byName("北帝天尊").skillIds),["iceArrowRain","freeze"]);
    assert.deepEqual(array(byName("北帝天尊").v141SupportSkillIds),["healSpell"]);
    assert.deepEqual(array(byName("南帝天尊").skillIds),["phoenixCry","dragonSlash"]);
    assert.deepEqual(array(byName("南帝天尊").v141SupportSkillIds),["rage"]);
    roster.slice(0,5).forEach(monster=>assert.equal(monster.v141ForceSkillLevel,5));
    assert.deepEqual(roster.slice(5).map(monster=>[monster.name,monster.element,array(monster.skillIds),array(monster.v141SupportSkillIds),monster.v141ForceSkillLevel]),[
        ["天兵天將","water",["frostCrush"],[],1],
        ["天兵天將","earth",["stoneThrow"],[],1],
        ["天兵天將","fire",["fireBurstStrike"],[],1],
        ["天兵天將","wind",[],["stealthSkill"],1],
        ["天兵天將","water",["frostCrush"],[],1]
    ]);
    assert.equal(context.skillDatabase.fireBurstStrike.name,"火爆一擊");
    assert.equal(Object.keys(context.skillDatabase).includes("fireBurstStrike"),false,"monster-only skill must not leak into player lists");
    let forcedSnapshot;
    context.v155WithForcedFinalAbyssSkillLevel(byName("南帝天尊"),()=>{
        const skill=context.skillDatabase.dragonSlash;
        forcedSnapshot=[skill.maxLevel,skill.baseDamage,skill.damagePerLevel,array(skill.repeatChanceByLevel)];
    });
    assert.deepEqual(forcedSnapshot,[1,265,0,[40]],"a low-level floor 5 boss still resolves the maximum skill rank");
    assert.deepEqual([context.skillDatabase.dragonSlash.maxLevel,context.skillDatabase.dragonSlash.baseDamage],[5,165]);
});

test("Extreme Emperor heal, shield and blessing resolve exact values",()=>{
    let finishes=0;
    const oldDisplay={type:"v141TeamBuff"};
    const extreme={name:"極帝天尊",v141Abyss:true,alive:true,hp:500,maxHP:500,sp:500,maxSP:500,evasion:50,agility:50,activeBuffs:[],statusEffects:[]};
    const ally={name:"盟友",v141Abyss:true,alive:true,hp:100,maxHP:500,sp:10,maxSP:300,evasion:150,agility:150,
        activeBuffs:[oldDisplay],statusEffects:[{type:"burn"}],v142AgilityBlessing:{originalAgility:100,displayBuff:oldDisplay,turnsLeft:2}};
    const monsters=[extreme,ally];
    const context=load({
        monsters,currentBattleMonsters:[0,1],battleToken:9,turn:1,
        isMonsterFrozen:()=>false,isMonsterPetrified:()=>false,
        finishPlayerAction(){ finishes++; },showMonsterSkillNameBadge(){},showMonsterHit(){},addBattleLog(){},updateUI(){},
        v141HealMonsterPreservingShield(monster,amount){ const before=monster.hp; monster.hp=Math.min(monster.maxHP,monster.hp+amount); return monster.hp-before; },
        v141ApplyMonsterShield(monster,amount,duration){ monster.v141Shield={remaining:amount,turnsLeft:duration,baseMaxHP:monster.maxHP}; }
    });
    assert.equal(context.v155ResolveExtremeEmperorAction(0,"yuanZuBlessing",true),true);
    assert.deepEqual(array(ally.statusEffects),[]);
    assert.equal(ally.agility,100,"old agility blessing is removed");
    assert.equal(ally.evasion,195);
    assert.equal(ally.v155EvasionBlessing.displayBuff.turnsLeft,2);
    ally.hp=100; ally.sp=10;
    assert.equal(context.v155ResolveExtremeEmperorAction(0,"yuanXiangGuangMing"),true);
    assert.equal(ally.hp,250);
    assert.equal(ally.sp,65);
    assert.equal(context.v155ResolveExtremeEmperorAction(0,"yuanGuangShield"),true);
    assert.deepEqual([ally.v141Shield.remaining,ally.v141Shield.turnsLeft],[100,2]);
    assert.equal(finishes,3);
    context.turn=3;
    context.startTurn?context.startTurn(9):context.v155RuleDiagnostics();
});

test("North Emperor heals at level five and never carries Revive",()=>{
    let finishes=0;
    const north={name:"北帝天尊",v141Abyss:true,alive:true,hp:500,maxHP:500,sp:500,maxSP:500,activeBuffs:[],statusEffects:[]};
    const ally={name:"盟友",v141Abyss:true,alive:true,hp:10,maxHP:1000,sp:10,maxSP:500,activeBuffs:[],statusEffects:[]};
    const context=load({
        monsters:[north,ally],currentBattleMonsters:[0,1],
        isMonsterFrozen:()=>false,isMonsterPetrified:()=>false,
        finishPlayerAction(){ finishes++; },showMonsterSkillNameBadge(){},showMonsterHit(){},addBattleLog(){},updateUI(){},
        v141HealMonsterPreservingShield(monster,amount){ const before=monster.hp; monster.hp=Math.min(monster.maxHP,monster.hp+amount); return monster.hp-before; }
    });
    assert.equal(context.v155ResolveNorthHeal(0,true),true);
    assert.equal(ally.hp,480);
    assert.equal(ally.sp,165);
    assert.equal(finishes,1);
});

test("wind elite Stealth blocks only single-target selection for two rounds",()=>{
    let finishes=0;
    const elite={name:"天兵天將",element:"wind",v141Abyss:true,alive:true,hp:100,sp:100,maxSP:100,skillChance:1,activeBuffs:[]};
    const context=load({
        monsters:[elite],currentBattleMonsters:[0],battleToken:4,turn:1,
        isMonsterFrozen:()=>false,isMonsterPetrified:()=>false,
        getSkillTargets(center,targetType){ return targetType==="all"?[0]:[center]; },
        finishPlayerAction(){ finishes++; },showMonsterSkillNameBadge(){},addBattleLog(){},updateUI(){}
    });
    assert.equal(context.v155ResolveWindEliteStealth(0,true),true);
    assert.deepEqual(array(context.getSkillTargets(0,"single")),[]);
    assert.deepEqual(array(context.getSkillTargets(0,"all")),[0]);
    assert.equal(finishes,1);
});

test("Phoenix zero-burn cast grants one next-round 50 percent damage boost",()=>{
    const player={id:"火俠",hp:100,sp:300,activeBuffs:[]};
    const damages=[];
    let shouldBurn=false;
    const context=load({
        player,battleToken:7,turn:1,addBattleLog(){},showSkillNameBadge(){},
        calculateSkillDamage(){ return 100; },applyBurnEffect(){},
        castDamageSkill(id){
            this.showSkillNameBadge(this.skillDatabase[id].name,"fire",0);
            damages.push(this.calculateSkillDamage());
            if(shouldBurn){ this.applyBurnEffect({name:"目標"},2,5); }
        }
    });
    context.castDamageSkill("phoenixCry");
    assert.deepEqual(damages,[100]);
    assert.deepEqual([player.v155PhoenixDamageBuff.readyTurn,player.v155PhoenixDamageBuff.expiresTurn],[2,3]);
    context.turn=2;
    shouldBurn=true;
    context.castDamageSkill("phoenixCry");
    assert.deepEqual(damages,[100,150]);
    assert.equal(player.v155PhoenixDamageBuff,undefined,"successful burn consumes the one-round boost without rearming it");
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
