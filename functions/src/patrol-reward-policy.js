/* Shared patrol settlement arithmetic only. This does not simulate combat,
   verify outcomes, establish eligibility or authorize a reward. Callers own
   canonical-input validation and supply any reward random sample explicitly. */
(function installPatrolRewardPolicy(global){
    "use strict";

    const constants=Object.freeze({elementBoxExpRatio:0.70,expMultiplier:3,
        goldMultiplier:5,beginnerTargetBattles:20,beginnerFallbackExp:690});

    function beginnerForestBattleExp(thresholds){
        if(thresholds===null||thresholds===undefined){return constants.beginnerFallbackExp;}
        let totalRequired=0;
        for(let index=0;index<9;index++){
            totalRequired+=Math.max(1,Math.round(Number(thresholds[index])||0));
        }
        return Math.max(1,Math.ceil(totalRequired/constants.beginnerTargetBattles));
    }
    function beginnerForestMonsterExpUnit(battleExp){
        return Math.max(1,Math.ceil(battleExp/3));
    }
    function expRankMultiplier(rank){
        if(rank==="boss"){return 3;}
        if(rank==="elite"){return 1.5;}
        return 1;
    }
    function formalMonsterBaseExp(level){
        return Math.max(0,Math.floor((Number(level)||0)*35));
    }
    function progressionExpMultiplier(level){
        const safeLevel=Math.max(1,Math.floor(Number(level)||1));
        return safeLevel<20?constants.expMultiplier:1;
    }
    function standardPatrolExp(rows,progressionLevel){
        const rankAdjustedExp=(Array.isArray(rows)?rows:[]).reduce((total,row)=>{
            if(!row){return total;}
            return total+formalMonsterBaseExp(row.level)*expRankMultiplier(row.rank);
        },0);
        return Math.max(0,Math.floor(rankAdjustedExp*progressionExpMultiplier(progressionLevel)));
    }
    function beginnerForestExp(battleExp,rankWeight){
        return Math.max(1,Math.round(beginnerForestMonsterExpUnit(battleExp)*
            Math.max(1,rankWeight)*constants.expMultiplier));
    }
    function applyExpMode(standardExp,options){
        const safeExp=Math.max(0,Math.floor(Number(standardExp)||0));
        const mode=options&&typeof options==="object"?options:{};
        if(mode.elementBox){return Math.round(safeExp*constants.elementBoxExpRatio);}
        if(mode.rested){return Math.round(safeExp*2);}
        return safeExp;
    }
    function baseGold(level,rank,randomUnit){
        const safeLevel=Math.max(1,Math.floor(Number(level)||1));
        const rankMultiplier=rank==="boss"?5:rank==="elite"?2:1;
        const base=safeLevel*2+3;
        const variance=0.85+randomUnit*0.30;
        return Math.max(1,Math.floor(base*rankMultiplier*variance));
    }
    function awardedGoldFromBase(baseAmount){
        const base=Math.max(0,Number(baseAmount)||0);
        const bonus=Math.max(0,Math.floor(base*(constants.goldMultiplier-1)));
        return base+bonus;
    }

    const api=Object.freeze({constants,beginnerForestBattleExp,beginnerForestMonsterExpUnit,
        expRankMultiplier,formalMonsterBaseExp,progressionExpMultiplier,standardPatrolExp,
        beginnerForestExp,applyExpMode,baseGold,awardedGoldFromBase});
    global.FourSymbolsPatrolRewardPolicy=api;
    if(typeof module!=="undefined"&&module.exports){module.exports=api;}
})(typeof window!=="undefined"?window:globalThis);
