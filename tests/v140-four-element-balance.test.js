"use strict";

/* HISTORICAL SPEC SNAPSHOT (V140): 只保留該版驗收紀錄；V170 最終規格以 v170-final-spec-integration.test.js 為準。 */

const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const mainSource=fs.readFileSync("js/00-main.js","utf8");
const patchSource=fs.readFileSync("js/33-v140-four-element-balance.js","utf8");
const loaderSource=fs.readFileSync("js/20-anonymous-20.js","utf8");
const indexSource=fs.readFileSync("index.html","utf8");

function clone(value){
    return JSON.parse(JSON.stringify(value));
}

function extractMainSkillDatabase(){
    const start=mainSource.indexOf("const skillDatabase =");
    const end=mainSource.indexOf("\n};",start)+3;
    assert.ok(start>=0&&end>start,"skillDatabase source block must exist");
    const source=mainSource.slice(start,end)
        .replace("const skillDatabase =","skillDatabase =");
    const sandbox={};
    vm.runInNewContext(source,sandbox,{filename:"skill-database.fixture.js"});
    return clone(sandbox.skillDatabase);
}

const baseSkillDatabase=extractMainSkillDatabase();

function makeContext(){
    const context=vm.createContext({
        console,
        skillDatabase:clone(baseSkillDatabase),
        document:{getElementById:()=>null},
        setTimeout:()=>0,
        battleActive:true,
        player:{id:"主角",element:"water",level:10,hp:100,sp:100,activeBuffs:[],statusEffects:[]},
        player2:{id:"副角",element:"water",level:10,hp:100,sp:100,activeBuffs:[],statusEffects:[]},
        player3:{id:"三角",element:"water",level:10,hp:100,sp:100,activeBuffs:[],statusEffects:[]},
        monsters:[{
            name:"測試怪",level:10,hp:100,sp:100,maxHP:500,maxSP:100,
            attack:100,intelligencePoints:25,activeBuffs:[]
        }],
        battleLogs:[],
        updateCount:0,
        lastPlayerStatusChance:null,
        lastMonsterStatusChance:null,
        monsterAttackMode:"lifesteal",
        skillLevels:{rage:1,barrier:1,healSpell:1,waterEX:0},
        queuedPlayerActions:{},
        talismanDefinitions:[
            {id:"freezeTalismanLow",talismanEffect:"freeze",talismanDuration:4,tierChance:35},
            {id:"stealthTalismanLow",talismanEffect:"stealth",talismanDuration:2,tierChance:35},
            {id:"barrierTalismanLow",talismanEffect:"barrier",talismanDuration:4,tierChance:35}
        ]
    });
    context.window=context;

    vm.runInContext(`
        function calculateStatusEffectChance(){ return -1; }
        function rollHitChance(){ return false; }
        function addBattleLog(message){ battleLogs.push(String(message)); }
        function showSkillNameBadge(){}
        function showMonsterSkillNameBadge(){}
        function updateUI(){ updateCount++; }
        function finishPlayerAction(){}
        function lungePlayerCard(){}
        function showPlayerSpPopup(){}
        function showPlayerHit(){}
        function getSkillLevel(characterKey,skillId){
            return skillLevels[skillId]===undefined ? 1 : skillLevels[skillId];
        }

        function getMainCharacterStats(){
            return {attack:100,intelligence:20,maxHP:100,maxSP:100};
        }
        function getPartyCharacterByIndex(index){
            return Number(index)===1?player2:Number(index)===2?player3:player;
        }
        function getBattleCharacterByIndex(index){
            return getPartyCharacterByIndex(index);
        }
        function getPartyBattleStats(){
            return {attack:100,intelligence:20,maxHP:100,maxSP:100};
        }
        function getPlayer2BattleStats(){
            return {attack:100,intelligence:25,maxHP:100,maxSP:100};
        }
        function getStatDownPercentFor(){ return 0; }
        function getMonsterEffectiveAbilityPoints(monster,statName){
            return statName==="intelligence"?monster.intelligencePoints:0;
        }
        function getActivePlayerCharacters(){
            return [player,player2,player3].filter(character=>character.hp>0);
        }
        function getCharacters(){ return [player,player2,player3]; }
        function getBackpackCharacter(index){ return getPartyCharacterByIndex(index); }
        function v132GetTalismanDefinition(id){
            return talismanDefinitions.find(definition=>definition.id===id)||null;
        }
        function hasActiveBuff(character,buffType){
            return !!(character.activeBuffs||[]).some(
                buff=>buff.type===buffType&&buff.turnsLeft>0
            );
        }

        function calculateHealingAmount(base,intelligence){
            return base+Math.floor(intelligence*1.25);
        }
        function calculateSPHealingAmount(base,intelligence){
            return base+Math.floor(intelligence*0.5);
        }

        function rollCritical(character){
            const rage=(character.activeBuffs||[]).find(buff=>buff.type==="rage");
            const bonus=rage?Number(rage.bonusPercent)||0:0;
            const isCrit=Math.random()*100<10+bonus;
            return {isCrit,multiplier:isCrit?1.5+bonus/100:1};
        }

        function getInventoryCharacterCriticalStats(index){
            const character=getBackpackCharacter(index);
            const rage=(character.activeBuffs||[]).find(buff=>buff.type==="rage");
            const bonus=rage?Number(rage.bonusPercent)||0:0;
            return {
                physical:{chance:10+bonus,multiplier:1.5+bonus/100},
                magic:{chance:10+bonus,multiplier:1.5+bonus/100}
            };
        }

        function castBuffSkill(skillId,targetIndex){
            const skill=skillDatabase[skillId];
            const level=getSkillLevel("fire",skillId);
            const target=getBattleCharacterByIndex(targetIndex);
            if(!battleActive||!skill||level<=0||!target||target.hp<=0||player.sp<skill.spCost){
                return;
            }
            player.sp-=skill.spCost;
            showSkillNameBadge(skill.name,skill.element);
            const targets=skill.targetType==="allyAll"
                ? getActivePlayerCharacters().slice(0,3)
                : [target];
            targets.forEach(character=>{
                character.activeBuffs=(character.activeBuffs||[])
                    .filter(buff=>buff.type!==skillId);
                const extra=skillId==="rage"
                    ? {bonusPercent:skill.critBonusByLevel[level-1]}
                    : {};
                character.activeBuffs.push(Object.assign(
                    {type:skillId,turnsLeft:skill.duration},extra
                ));
            });
            if(skillId==="rage"){
                addBattleLog(
                    "怒火生效！我方最多3人爆擊率與爆擊傷害提升"+
                    skill.critBonusByLevel[level-1]+"%，持續"+skill.duration+"回合。"
                );
            }else if(skillId==="barrier"){
                addBattleLog(target.id+"獲得結界，可抵擋所有傷害，持續"+skill.duration+"回合。");
            }
            updateUI();
            finishPlayerAction();
        }

        function castHealSkill(skillId,targetIndex){
            const skill=skillDatabase[skillId];
            const level=getSkillLevel("fire",skillId);
            const target=getBattleCharacterByIndex(targetIndex);
            if(!battleActive||!skill||level<=0||!target||target.hp<=0||player.sp<skill.spCost){
                return;
            }
            player.sp-=skill.spCost;
            showSkillNameBadge(skill.name,skill.element);
            const stats=getPartyBattleStats(Number(targetIndex)||0);
            const hpAmount=calculateHealingAmount(
                skill.baseHeal+skill.healPerLevel*(level-1),20
            );
            const spAmount=calculateSPHealingAmount(
                skill.baseHealSP+skill.healSPPerLevel*(level-1),20
            );
            const actualHP=Math.max(0,Math.min(hpAmount,stats.maxHP-target.hp));
            const actualSP=target===player
                ? 0
                : Math.max(0,Math.min(spAmount,stats.maxSP-target.sp));
            target.hp=Math.min(stats.maxHP,target.hp+hpAmount);
            if(target!==player){ target.sp=Math.min(stats.maxSP,target.sp+spAmount); }
            addBattleLog(
                skill.name+"使"+target.id+"恢復"+actualHP+"點HP"+
                (target===player
                    ? "；施放者本人不回復SP。"
                    : "、"+actualSP+"點SP。")
            );
            updateUI();
            finishPlayerAction();
        }

        function simulateOldPlayerLifesteal(character,skill){
            character.sp-=skill.spCost;
            showSkillNameBadge(skill.name,skill.element||"water");
            lastPlayerStatusChance=calculateStatusEffectChance(
                50,10,10,999,20,false,"regular",0
            );
            const finalDamage=500;
            const amount=Math.floor(finalDamage*skill.lifestealPercentByLevel[0]/100);
            character.hp+=amount;
            character.sp+=amount;
            addBattleLog("回復了"+amount+"點HP與SP。");
        }

        function castDamageSkill(skillId){
            const skill=skillDatabase[skillId];
            if(skill.lifestealPercentByLevel){
                simulateOldPlayerLifesteal(player,skill);
                return;
            }
            player.sp-=skill.spCost;
            showSkillNameBadge(skill.name,"fire");
            lastPlayerStatusChance=calculateStatusEffectChance(
                50,10,10,999,20,false,"regular",0
            );
        }

        function castSecondaryCharacterSkill(characterIndex,skillId){
            simulateOldPlayerLifesteal(
                getPartyCharacterByIndex(characterIndex),
                skillDatabase[skillId]
            );
        }

        function castPlayer2Skill(skillId){
            simulateOldPlayerLifesteal(player2,skillDatabase[skillId]);
        }

        function processSingleMonsterAttack(monsterIndex){
            const monster=monsters[monsterIndex];
            if(monsterAttackMode==="direct"){
                showMonsterSkillNameBadge("普通攻擊","normal",monsterIndex);
                if(hasActiveBuff(player,"barrier")){
                    addBattleLog(player.id+"的結界完全格擋了這次攻擊！");
                }else{
                    player.hp-=10;
                }
                return;
            }

            const skill=skillDatabase.frostCrush;
            monster.sp-=skill.spCost;
            showMonsterSkillNameBadge(skill.name,"water",monsterIndex);
            lastMonsterStatusChance=calculateStatusEffectChance(
                skill.freezeChance,10,10,999,20,true,"regular",0
            );
            const finalDamage=500;
            const amount=Math.floor(finalDamage*skill.lifestealPercentByLevel[0]/100);
            monster.hp+=amount;
            monster.sp+=amount;
            addBattleLog(monster.name+"吸取傷害並恢復"+amount+"點HP、"+amount+"點SP。");
        }

        function tickStatusEffects(){
            const burn=(player.statusEffects||[]).find(effect=>effect.type==="burn");
            if(!battleActive||!burn){ return; }
            if(hasActiveBuff(player,"barrier")){
                addBattleLog(player.id+"的結界抵擋了燃燒傷害。");
            }else{
                player.hp-=5;
                addBattleLog(player.id+"受到燃燒傷害5點。");
            }
        }

        function resolveQueuedPlayerAction(characterIndex){
            const queued=queuedPlayerActions[characterIndex];
            const definition=queued&&v132GetTalismanDefinition(queued.action);
            if(!definition){ return; }
            const caster=getBattleCharacterByIndex(characterIndex);
            let target=Number.isInteger(queued.targetAlly)
                ? getBattleCharacterByIndex(queued.targetAlly)
                : caster;
            if(!target||target.hp<=0){ target=caster; }
            const buffType=definition.talismanEffect==="stealth"
                ? "stealthSkill"
                : "barrier";
            if(definition.talismanEffect!=="freeze"){
                target.activeBuffs=(target.activeBuffs||[])
                    .filter(buff=>buff.type!==buffType);
                target.activeBuffs.push({
                    type:buffType,
                    turnsLeft:definition.talismanDuration
                });
            }
            if(definition.talismanEffect==="barrier"){
                addBattleLog(
                    caster.id+"使用低階結界符，"+target.id+
                    "獲得結界，可抵擋所有傷害，持續"+
                    definition.talismanDuration+"回合。"
                );
            }
        }

        function getSkillEffectPreviewText(skill,level){
            if(skill.id==="rage"){
                return "爆擊率／爆擊傷害 +"+skill.critBonusByLevel[level-1]+"%，持續2回合";
            }
            if(skill.id==="healSpell"){
                return "回復HP與SP（施放者本人不回復SP）";
            }
            return "吸取5%傷害（回復HP/SP）";
        }
        function buildSkillLevelBreakdownHTML(skill){
            if(skill.id==="rage"){
                return skill.critBonusByLevel.map(
                    value=>"爆擊率／爆擊傷害 +"+value+"%"
                ).join("|");
            }
            if(skill.id==="healSpell"){
                return "回復SP（施放者本人不回復SP）";
            }
            return "吸取傷害5%（回復HP/SP）";
        }
    `,context);

    vm.runInContext(patchSource,context,{filename:"js/33-v140-four-element-balance.js"});
    return context;
}

let passed=0;
function test(name,fn){
    fn();
    passed++;
    console.log("✓ "+name);
}

function assertFields(actual,expected,id){
    Object.entries(expected).forEach(([field,value])=>{
        assert.deepEqual(clone(actual[field]),clone(value),id+"."+field);
    });
}

test("the complete authoritative four-element skill table is exact",()=>{
    const context=makeContext();
    const audit=vm.runInContext("v140GetSkillBalanceAudit()",context);
    const expected={
        flameSlash:{category:"physical",targetType:"single",learnCost:2,maxLevel:5,baseDamage:17,damagePerLevel:10,spCost:8},
        fireCritical:{category:"physical",targetType:"single",learnCost:10,maxLevel:5,baseDamage:39,damagePerLevel:13,spCost:15,requires:["flameSlash"]},
        explosiveFlurry:{category:"physical",targetType:"tri",learnCost:20,maxLevel:5,baseDamage:35,damagePerLevel:15,spCost:22,requires:["fireCritical"]},
        dragonSlash:{category:"physical",targetType:"single",learnCost:45,maxLevel:5,baseDamage:145,damagePerLevel:25,spCost:55,requires:["explosiveFlurry"]},
        fireRocket:{category:"magic",targetType:"tri",learnCost:2,maxLevel:5,baseDamage:17,damagePerLevel:8,spCost:8},
        blazeSpell:{category:"magic",targetType:"single",learnCost:10,maxLevel:5,baseDamage:42,damagePerLevel:15,spCost:15,requires:["fireRocket"]},
        flameTornado:{category:"magic",targetType:"row",learnCost:30,maxLevel:5,baseDamage:40,damagePerLevel:13,spCost:38,burnChance:30,burnDuration:2,burnPercentByLevel:[3,4,5,6,8],requires:["blazeSpell"]},
        phoenixCry:{category:"magic",targetType:"all",learnCost:45,maxLevel:5,baseDamage:53,damagePerLevel:15,spCost:62,burnChance:50,burnDuration:2,burnPercentByLevel:[5,7,9,11,13],requires:["flameTornado"]},
        rage:{category:"buff",targetType:"allyAll",learnCost:25,maxLevel:5,spCost:50,duration:2,critChanceBonusByLevel:[5,10,15,20,25],critDamageBonusByLevel:[10,20,30,40,50],requires:["explosiveFlurry","flameTornado"]},
        fireEX:{category:"passive",learnCost:25,maxLevel:1,damageBonusPercent:10,critChanceBonusPercent:5,critDamageBonusPercent:5},

        waterKnife:{category:"physical",targetType:"single",learnCost:2,maxLevel:5,baseDamage:13,damagePerLevel:3,spCost:6,lifestealPercentByLevel:[4,5,6,7,8]},
        frostPunch:{category:"physical",targetType:"single",learnCost:10,maxLevel:5,baseDamage:30,damagePerLevel:8,spCost:17,lifestealPercentByLevel:[4,5,6,7,8],requires:["waterKnife"]},
        iceSpin:{category:"physical",targetType:"tri",learnCost:20,maxLevel:5,baseDamage:25,damagePerLevel:7,spCost:20,lifestealPercentByLevel:[3,4,5,6,7],requires:["frostPunch"]},
        frostCrush:{category:"physical",targetType:"single",learnCost:30,maxLevel:5,baseDamage:100,damagePerLevel:15,spCost:50,freezeChance:45,freezeDuration:1,lifestealPercentByLevel:[4,5,6,7,8],requires:["iceSpin"]},
        waterBall:{category:"magic",targetType:"tri",learnCost:2,maxLevel:5,baseDamage:17,damagePerLevel:3,spCost:8,lifestealPercentByLevel:[3,4,5,6,7]},
        floodBeast:{category:"magic",targetType:"single",learnCost:15,maxLevel:5,baseDamage:35,damagePerLevel:8,spCost:15,lifestealPercentByLevel:[4,5,6,7,8],requires:["waterBall"]},
        iceArrowRain:{category:"magic",targetType:"all",learnCost:20,maxLevel:5,baseDamage:30,damagePerLevel:12,spCost:50,lifestealPercentByLevel:[1,2,3,4,5],requires:["floodBeast"]},
        freeze:{category:"magic",targetType:"single",learnCost:25,maxLevel:1,spCost:22,freezeChance:65,freezeDuration:4,requires:["iceArrowRain"]},
        healSpell:{category:"heal",targetType:"ally",learnCost:20,maxLevel:5,baseHeal:40,healPerLevel:5,baseHealSP:15,healSPPerLevel:5,spCost:30,requires:["iceArrowRain","iceSpin"]},
        revive:{category:"revive",targetType:"deadAlly",learnCost:20,maxLevel:5,spCost:45,reviveHealPercentByLevel:[20,40,60,80,100],requires:["healSpell"]},
        waterEX:{category:"passive",learnCost:25,maxLevel:1,damageBonusPercent:5,healBonusPercent:5,statusResistBonus:10},

        stormFist:{category:"physical",targetType:"single",learnCost:2,maxLevel:5,baseDamage:14,damagePerLevel:2,spCost:7,agilityDownChance:50,agilityDownByLevel:[30,40,50,60,70],agilityDownDuration:1},
        stormFlurry:{category:"physical",targetType:"tri",learnCost:10,maxLevel:5,baseDamage:28,damagePerLevel:7,spCost:20,damageDownChance:50,damageDownByLevel:[15,18,21,25,30],damageDownDuration:1,requires:["stormFist"]},
        windCrossSlash:{category:"physical",targetType:"single",learnCost:15,maxLevel:5,baseDamage:90,damagePerLevel:12,spCost:39,damageDownChance:65,damageDownByLevel:[15,20,25,30,35],damageDownDuration:1,requires:["stormFlurry"]},
        dizzyFist:{category:"physical",targetType:"single",learnCost:30,maxLevel:5,baseDamage:120,damagePerLevel:15,spCost:55,stunChance:65,missBonusByLevel:[10,20,30,40,50],stunDuration:2,requires:["stormFlurry"]},
        windSpell:{category:"magic",targetType:"tri",learnCost:2,maxLevel:5,baseDamage:18,damagePerLevel:2,spCost:9,agilityDownChance:50,agilityDownByLevel:[10,20,30,40,50],agilityDownDuration:1},
        stormCircle:{category:"magic",targetType:"row",learnCost:10,maxLevel:5,baseDamage:38,damagePerLevel:9,spCost:18,damageDownChance:55,damageDownByLevel:[15,18,21,25,30],damageDownDuration:1,requires:["windSpell"]},
        windHowlLightning:{category:"magic",targetType:"single",learnCost:15,maxLevel:5,baseDamage:95,damagePerLevel:12,spCost:39,damageDownChance:65,damageDownByLevel:[15,20,25,30,35],damageDownDuration:1,requires:["stormCircle"]},
        stormRain:{category:"magic",targetType:"all",learnCost:30,maxLevel:5,baseDamage:48,damagePerLevel:14,spCost:55,stunChance:35,missBonusByLevel:[30,45,50,55,65],stunDuration:1,requires:["windHowlLightning"]},
        dodgeSkill:{category:"buff",targetType:"allyAll",learnCost:10,maxLevel:1,spCost:20,duration:2,evasionBonusPercent:30,requires:["windCrossSlash","windHowlLightning"]},
        stealthSkill:{category:"buff",targetType:"ally",learnCost:15,maxLevel:1,spCost:25,duration:2,requires:["dodgeSkill"]},
        dinghaishenzhen:{category:"buff",targetType:"allyAll",learnCost:20,maxLevel:1,spCost:55,duration:3,statusResistBonus:35,requires:["stealthSkill"]},
        windEX:{category:"passive",learnCost:25,maxLevel:1,evasionBonusPercent:15},

        stoneSlash:{category:"physical",targetType:"single",learnCost:2,maxLevel:5,baseDamage:14,damagePerLevel:2,spCost:7,defenseDownChance:65,defenseDownByLevel:[10,20,30,40,50],defenseDownDuration:1},
        petrifyFist:{category:"physical",targetType:"tri",learnCost:10,maxLevel:5,baseDamage:28,damagePerLevel:7,spCost:26,allyShieldByLevel:[100,125,150,175,200],shieldDuration:2,requires:["stoneSlash"]},
        stoneBreakSky:{category:"physical",targetType:"single",learnCost:15,maxLevel:5,baseDamage:65,damagePerLevel:9,spCost:42,allyShieldByLevel:[100,125,150,175,200],shieldDuration:2,requires:["petrifyFist"]},
        earthquakeCrush:{category:"physical",targetType:"tri",learnCost:30,maxLevel:5,baseDamage:48,damagePerLevel:14,spCost:55,selfShieldByLevel:[100,150,200,250,300],shieldDuration:2,requires:["stoneBreakSky"]},
        stoneThrow:{category:"magic",targetType:"tri",learnCost:2,maxLevel:5,baseDamage:14,damagePerLevel:2,spCost:7,defenseDownChance:65,defenseDownByLevel:[10,20,30,40,50],defenseDownDuration:1},
        sandWind:{category:"magic",targetType:"row",learnCost:10,maxLevel:5,baseDamage:17,damagePerLevel:5,spCost:19,defenseDownChance:65,defenseDownByLevel:[10,20,30,40,50],defenseDownDuration:1,requires:["stoneThrow"]},
        flyingSandStrike:{category:"magic",targetType:"all",learnCost:15,maxLevel:5,baseDamage:20,damagePerLevel:8,spCost:26,petrifyChanceByLevel:[25,35,45,55,65],petrifyDuration:2,requires:["sandWind"]},
        dustStorm:{category:"magic",targetType:"all",learnCost:30,maxLevel:5,baseDamage:48,damagePerLevel:14,spCost:55,defenseDownChance:60,defenseDownByLevel:[10,15,20,25,30],defenseDownDuration:1,requires:["flyingSandStrike"]},
        earthShield:{category:"buff",targetType:"ally",learnCost:10,maxLevel:1,spCost:32,duration:3,reflectPercent:50,requires:["stoneBreakSky","flyingSandStrike"]},
        rockWall:{category:"buff",targetType:"allyAll",learnCost:15,maxLevel:1,spCost:45,duration:3,defenseBonusPercent:30,requires:["barrier"]},
        barrier:{category:"buff",targetType:"ally",learnCost:20,maxLevel:1,spCost:40,duration:5,barrierBlockCount:5,requires:["earthShield"]},
        earthEX:{category:"passive",learnCost:25,maxLevel:1,defenseBonusPercent:15}
    };

    assert.deepEqual(Object.keys(audit),Object.keys(expected));
    Object.entries(expected).forEach(([id,fields])=>assertFields(audit[id],fields,id));
    assert.match(mainSource,/skill\.requires\.some\(/,"multi-prerequisites must remain OR");
});

test("the three revised direct-damage sequences are exact",()=>{
    const context=makeContext();
    const audit=vm.runInContext("v140GetSkillBalanceAudit()",context);
    const sequence=id=>[1,2,3,4,5].map(level=>
        audit[id].baseDamage+audit[id].damagePerLevel*(level-1)
    );
    assert.deepEqual(sequence("fireRocket"),[17,25,33,41,49]);
    assert.deepEqual(sequence("frostPunch"),[30,38,46,54,62]);
    assert.deepEqual(sequence("stoneBreakSky"),[65,74,83,92,101]);
});

test("water lifesteal uses final damage and restores HP only on every actor path",()=>{
    const context=makeContext();
    vm.runInContext("castDamageSkill('frostPunch')",context);
    assert.equal(context.player.hp,120,"500 final damage × 4% must heal 20 HP");
    assert.equal(context.player.sp,83,"main character stays at post-cost SP");
    vm.runInContext("castSecondaryCharacterSkill(2,'frostPunch',0)",context);
    assert.equal(context.player3.hp,120);
    assert.equal(context.player3.sp,83);
    vm.runInContext("castPlayer2Skill('frostPunch',0)",context);
    assert.equal(context.player2.hp,120);
    assert.equal(context.player2.sp,83);
    vm.runInContext("processSingleMonsterAttack(0,1)",context);
    assert.equal(context.monsters[0].hp,120);
    assert.equal(context.monsters[0].sp,50);
    assert.doesNotMatch(context.battleLogs.at(-1),/SP/);
});

test("physical and magic abnormal hit formulas use their specified offensive stats",()=>{
    const context=makeContext();
    const calculate=(...args)=>context.v140CalculateStatusEffectChance(...args);
    assert.equal(calculate(50,10,10,100,20,false,"regular",0,"physical"),64);
    assert.equal(calculate(50,10,10,100,20,false,"regular",0,"magic"),74);
    assert.equal(calculate(40,30,10,0,0,false,"regular",10,"magic"),50);
    assert.equal(calculate(40,1,30,0,0,false,"regular",0,"magic"),20);
});

test("hard-control square-root scaling and rank caps stay exact",()=>{
    const context=makeContext();
    const calculate=rank=>context.v140CalculateStatusEffectChance(
        90,10,10,100,0,true,rank,0,"physical"
    );
    assert.equal(calculate("regular"),80);
    assert.equal(calculate("elite"),60);
    assert.equal(calculate("boss"),40);
    assert.equal(context.v140CalculateStatusEffectChance(
        30,10,10,100,20,true,"regular",0,"physical"
    ),26);
    assert.equal(context.v140CalculateStatusEffectChance(
        30,10,10,100,20,true,"regular",0,"magic"
    ),26);
});

test("real actor wrappers feed physical attack or intelligence to abnormal rolls",()=>{
    const context=makeContext();
    vm.runInContext("castDamageSkill('frostPunch')",context);
    assert.equal(context.lastPlayerStatusChance,64);
    context.player.sp=100;
    vm.runInContext("castDamageSkill('fireRocket')",context);
    assert.equal(context.lastPlayerStatusChance,50);
});

test("rage applies separate critical chance and critical-damage bonuses",()=>{
    const context=makeContext();
    vm.runInContext("castBuffSkill('rage',0)",context);
    const rage=context.player.activeBuffs.find(buff=>buff.type==="rage");
    assert.equal(rage.critChanceBonusPercent,5);
    assert.equal(rage.critDamageBonusPercent,10);
    assert.match(context.battleLogs.at(-1),/爆擊率提升5%.*爆擊傷害提升10%/);
    vm.runInContext("Math.random=()=>0.12",context);
    const crit=vm.runInContext("rollCritical(player,'physical',0)",context);
    assert.equal(crit.isCrit,true,"12% roll must pass the 15% total chance");
    assert.equal(crit.multiplier,1.6,"critical damage gets +10%, not +5%");
    const details=vm.runInContext("getInventoryCharacterCriticalStats(0)",context);
    assert.deepEqual(clone(details.physical),{chance:15,multiplier:1.6});
});

test("heal spell never restores the caster's own SP",()=>{
    const context=makeContext();
    context.player.hp=20;
    vm.runInContext("castHealSkill('healSpell',0)",context);
    assert.equal(context.player.hp,85,"40 base + INT×1.25 heals 65 HP");
    assert.equal(context.player.sp,70,"self-cast pays 30 SP and receives no SP back");
    assert.match(context.battleLogs.at(-1),/施放者本人不回復SP/);
});

test("skill barrier blocks five direct hits and lets DOT through",()=>{
    const context=makeContext();
    vm.runInContext("castBuffSkill('barrier',0)",context);
    let barrier=context.player.activeBuffs.find(buff=>buff.type==="barrier");
    assert.equal(context.player.sp,60);
    assert.equal(barrier.turnsLeft,5);
    assert.equal(barrier.remainingBlocks,5);
    assert.equal(barrier.sourceSkill,"barrier");
    context.monsterAttackMode="direct";
    for(let count=0;count<5;count++){
        vm.runInContext("processSingleMonsterAttack(0)",context);
    }
    assert.equal(context.player.hp,100);
    assert.equal(context.player.activeBuffs.some(buff=>buff.type==="barrier"),false);
    vm.runInContext("processSingleMonsterAttack(0)",context);
    assert.equal(context.player.hp,90,"the sixth direct hit must land");

    context.player.sp=100;
    context.player.hp=100;
    vm.runInContext("castBuffSkill('barrier',0)",context);
    barrier=context.player.activeBuffs.find(buff=>buff.type==="barrier");
    context.player.statusEffects=[{type:"burn",turnsLeft:2}];
    vm.runInContext("tickStatusEffects()",context);
    assert.equal(context.player.hp,95,"burn DOT must pass through the skill barrier");
    assert.equal(barrier.remainingBlocks,5,"DOT must not consume a direct block");

});

test("talismans share the latest corresponding skill effects",()=>{
    const context=makeContext();
    const barrierDefinition=context.v132GetTalismanDefinition("barrierTalismanLow");
    const freezeDefinition=context.v132GetTalismanDefinition("freezeTalismanLow");
    const stealthDefinition=context.v132GetTalismanDefinition("stealthTalismanLow");
    assert.equal(barrierDefinition.talismanDuration,context.skillDatabase.barrier.duration);
    assert.equal(barrierDefinition.barrierBlockCount,5);
    assert.equal(barrierDefinition.sharedSkillId,"barrier");
    assert.equal(freezeDefinition.talismanDuration,context.skillDatabase.freeze.freezeDuration);
    assert.equal(stealthDefinition.talismanDuration,context.skillDatabase.stealthSkill.duration);

    context.queuedPlayerActions[0]={action:"barrierTalismanLow",targetAlly:0};
    vm.runInContext("resolveQueuedPlayerAction(0,1)",context);
    const barrier=context.player.activeBuffs.find(buff=>buff.type==="barrier");
    assert.equal(barrier.turnsLeft,5);
    assert.equal(barrier.remainingBlocks,5);
    assert.equal(barrier.sourceTalisman,"barrierTalismanLow");
    assert.match(context.battleLogs.at(-1),/5次直接傷害/);

    context.player.statusEffects=[{type:"burn",turnsLeft:2}];
    vm.runInContext("tickStatusEffects()",context);
    assert.equal(context.player.hp,95,"talisman barrier also lets DOT through");
    assert.equal(barrier.remainingBlocks,5,"DOT does not consume talisman blocks");

    context.monsterAttackMode="direct";
    for(let count=0;count<5;count++){
        vm.runInContext("processSingleMonsterAttack(0)",context);
    }
    assert.equal(context.player.hp,95,"five direct hits are blocked after the DOT");
    vm.runInContext("processSingleMonsterAttack(0)",context);
    assert.equal(context.player.hp,85,"the sixth direct hit lands");
});

test("skill UI text matches HP-only lifesteal, split rage values, and no self SP healing",()=>{
    const context=makeContext();
    const preview=(id,level)=>vm.runInContext(
        `getSkillEffectPreviewText(skillDatabase.${id},${level})`,context
    );
    const breakdown=id=>vm.runInContext(
        `buildSkillLevelBreakdownHTML(skillDatabase.${id})`,context
    );
    assert.equal(preview("frostPunch",1),"吸取5%傷害（只回復HP）");
    assert.match(preview("rage",1),/爆擊率 \+5%、爆擊傷害 \+10%/);
    assert.match(breakdown("rage"),/爆擊率 \+25%、爆擊傷害 \+50%/);
    assert.match(preview("healSpell",1),/施放者本人不回復SP/);
    assert.match(breakdown("healSpell"),/施放者本人不回復SP/);
});

test("hit chance applies the final capped evasion rate after accuracy",()=>{
    const context=makeContext();
    assert.equal(context.v140GetHitChancePercent(0,1000,0),14.250000000000002);
    assert.equal(context.v140GetHitChancePercent(1000,0,0),99);
    assert.ok(Math.abs(context.v140GetHitChancePercent(100,80,10)-19.8)<Number.EPSILON*100);
});

test("existing lifesteal paths still accumulate post-critical final damage",()=>{
    const mainCast=mainSource.slice(mainSource.indexOf("function castDamageSkill"),mainSource.indexOf("function castBuffSkill"));
    const monsterCast=mainSource.slice(mainSource.indexOf("function processSingleMonsterAttack"),mainSource.indexOf("function checkBattleEnd"));
    const secondaryCast=mainSource.slice(mainSource.indexOf("function castSecondaryCharacterSkill"),mainSource.indexOf("function player2NormalAttack"));
    const player2Cast=mainSource.slice(mainSource.indexOf("function castPlayer2Skill"),mainSource.indexOf("function getMonsterGoldDrop"));
    assert.match(mainCast,/critResult\.multiplier[\s\S]*?totalLifestealDamage\+=[\s\S]*?actualDamageDealt/);
    assert.match(monsterCast,/monsterCrit[\s\S]*?monsterLifestealDamage\+=damage/);
    assert.match(secondaryCast,/critResult\.multiplier[\s\S]*?totalLifesteal\+=actualDamageDealt/);
    assert.match(player2Cast,/critResult\.multiplier[\s\S]*?totalLifesteal\+=[\s\S]*?actualDamageDealt/);
});

test("V140 remains before the ordered V141/V142 layers and both cache keys are bumped",()=>{
    const runtimeOrder=[
        "js/31-v136-auto-battle-fix.js",
        "js/32-v139-rested-experience.js",
        "js/33-v140-four-element-balance.js",
        "js/34-v141-core-systems.js",
        "js/35-v141-ui-battle.js",
        "js/36-v141-content-systems.js",
        "js/37-v142-skill-animation.js",
        "js/38-v143-system-fixes.js",
        "js/39-v143-skill-animation.js"
    ].map(path=>loaderSource.indexOf(path));
    assert.ok(runtimeOrder.every(index=>index>=0));
    assert.deepEqual(runtimeOrder.slice().sort((a,b)=>a-b),runtimeOrder);
    assert.match(loaderSource,/const V_ASSET_VERSION="173\.20"/);
    assert.match(indexSource,/js\/20-anonymous-20\.js\?v=173\.20/);
});

console.log("\nV140 four-element balance suite: "+passed+" tests passed.");
