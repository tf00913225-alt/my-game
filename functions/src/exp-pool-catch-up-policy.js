/* Shared EXP pool arithmetic. Callers supply the actual party identity and
   levels; this policy grants no EXP and does not decide eligibility. */
(function installExpPoolCatchUpPolicy(global){
    "use strict";
    function multiplierForLevel(level,highestCreatedLevel){
        const gap=Math.max(0,highestCreatedLevel-Math.max(1,Number(level)||1));
        if(gap>=30)return 1.50;
        if(gap>=20)return 1.30;
        if(gap>=10)return 1.15;
        return 1;
    }
    function multiplierForSlot(slotIndex,level){
        if(Math.max(1,Number(level)||1)>=20)return 1;
        if(slotIndex===2)return 2;
        if(slotIndex===1)return 1.50;
        return 1;
    }
    function multiplierForCharacter(slotIndex,level,highestCreatedLevel){
        const slot=multiplierForSlot(slotIndex,level);
        return slot>1?slot:multiplierForLevel(level,highestCreatedLevel);
    }
    const policy=Object.freeze({multiplierForLevel,multiplierForSlot,multiplierForCharacter});
    if(typeof module!=="undefined"&&module.exports)module.exports=policy;
    global.FourSymbolsExpPoolCatchUpPolicy=policy;
})(typeof window!=="undefined"?window:globalThis);
