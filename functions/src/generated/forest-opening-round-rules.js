// GENERATED from js/00-main.js by production build. DO NOT EDIT.
"use strict";
function createForestOpeningRoundRules(player,stats,enemy,random){
    const Math=Object.create(globalThis.Math);
    Math.random=random;
    const getExistingPartyIndexes=()=>[0];
    const getPartyCharacterByIndex=index=>index===0?player:null;
    const getPartyBattleStats=()=>stats;
    const getPartyCharacterIndex=entity=>entity===player?0:-1;
    const getLearnedElementEX=()=>null;
    const getMonsterDebuffValue=()=>0;
    const getStatDownPercentFor=()=>0;
    const currentBattleMonsters=[0];
    const monsters=[enemy];
    const combatEventObservers=new Map();
const HIT_CHANCE_BASE = 95;

const HIT_CHANCE_MIN_PERCENT = 5;

const HIT_CHANCE_MAX_PERCENT = 99;

function buildInitiativeQueue(){

    const list=[];

    getExistingPartyIndexes().forEach(characterIndex=>{
        const character=getPartyCharacterByIndex(characterIndex);
        if(!character || character.hp<=0){ return; }

        list.push({
            type:character.combatantKind==="heroNpc"?"heroNpc":"player",
            combatantKind:getBattleStatisticsCombatantKind(character),
            characterIndex:characterIndex,
            agility:getPartyBattleStats(characterIndex).agility
        });
    });


    currentBattleMonsters.forEach(
        i=>{

            if(
                monsters[i] &&
                monsters[i].alive &&
                monsters[i].canAct!==false
            ){

                list.push({

                    type:"monster",

                    monsterIndex:i,

                    agility:
                        getMonsterAgility(
                            monsters[i]
                        )

                });

            }

        }
    );


    /*
       ★ 修正（重新設計回合制之後，這裡改回單純排序）：
       之前這裡有個「第一回合強制玩家排最前面」的
       特殊處理，是在還沒有宣告/結算兩階段之前
       的暫時解法。

       現在有了宣告階段，玩家本來就一定會在
       結算開始「之前」把這回合要做什麼決定好，
       不管第幾回合都一樣，所以這個特殊處理
       已經不需要了——結算階段單純依敏捷高低排序就好，
       敏捷快的怪物依然可以搶到「結算順序」的先手，
       但那已經是玩家決定好行動之後的事了，
       不會再有「還沒設定就先挨打」的問題。
    */

    list.sort(
        (a,b)=>

            (
                b.agility+
                Math.random()*0.01
            )-
            (
                a.agility+
                Math.random()*0.01
            )

    );


    return list;

}

function getMonsterAgility(monster){

    const base=

        monster.agility!==undefined
        ? monster.agility
        : monster.level*1.2;


    const agilityDown=
        getMonsterDebuffValue(
            monster,
            "agilityDown"
        );
    const statDown=
        getStatDownPercentFor(
            monster,
            "agility"
        );


    return Math.max(
        0,
        base*
        (1-agilityDown/100)*
        (1-statDown/100)
    );

}

function getMonsterAccuracy(monster){

    const base=

        monster.accuracy!==undefined
        ? monster.accuracy
        : 0;


    return Math.max(0,Number(base)||0);

}

function calculateHitChancePercent(
    casterAccuracy,
    targetEvasion,
    directChanceReductionPercent,
    directChanceBonusPercent,
    targetCharacter
){
    const chance=
        HIT_CHANCE_BASE+
        (Number(casterAccuracy)||0)+
        (Number(directChanceBonusPercent)||0)-
        Math.max(0,Number(targetEvasion)||0)-
        Math.max(0,Number(directChanceReductionPercent)||0);

    const normalFinalChance=Math.max(
        HIT_CHANCE_MIN_PERCENT,
        Math.min(HIT_CHANCE_MAX_PERCENT,chance)
    );
    return normalFinalChance;
}

function rollHitChance(
    casterAccuracy,
    targetEvasion,
    directChanceReductionPercent,
    directChanceBonusPercent,
    targetCharacter
){
    const roll=Math.random()*100;
    const chance=calculateHitChancePercent(
        casterAccuracy,
        targetEvasion,
        directChanceReductionPercent,
        directChanceBonusPercent,
        targetCharacter
    );
    const hit=roll<chance;
    emitCombatEvent("hit_roll",{target:targetCharacter,roll,chance,hit,casterAccuracy,targetEvasion,
        directChanceReductionPercent,directChanceBonusPercent});
    return hit;
}

function emitCombatEvent(type,event){
    (combatEventObservers.get(type)||[]).forEach(observer=>observer(event));
    return event;
}

        const rollBeginnerForestNormalAttackDamage=function(){
            return 5+Math.floor(Math.random()*4);
        };
    return Object.freeze({
        initiative:()=>buildInitiativeQueue(),
        enemyHit:()=>rollHitChance(getMonsterAccuracy(enemy),stats.evasion,0,0,player),
        enemyDamage:()=>rollBeginnerForestNormalAttackDamage()
    });
}
module.exports={createForestOpeningRoundRules};
