/* Shared account-mode time arithmetic only. Callers own validated state,
   clocks, presence, eligibility, grants, persistence and lifecycle decisions. */
(function installAccountModeTimePolicy(global){
    "use strict";
    const constants=Object.freeze({restedMsPerBattle:120000,restedMaxBattles:300,
        elementBoxRewardMs:8*60*60*1000,elementBoxMaxMs:32*60*60*1000});
    function accrueRested(battles,progressMs,elapsedMs){
        const safeElapsed=Math.max(0,Math.floor(Number(elapsedMs)||0));
        if(safeElapsed<=0||battles>=constants.restedMaxBattles){
            if(battles>=constants.restedMaxBattles){progressMs=0;}
            return {battles,progressMs,accepted:0};
        }
        const cappedElapsed=Math.min(safeElapsed,
            constants.restedMaxBattles*constants.restedMsPerBattle);
        const totalMs=progressMs+cappedElapsed;
        const earned=Math.floor(totalMs/constants.restedMsPerBattle);
        const accepted=Math.min(earned,constants.restedMaxBattles-battles);
        battles+=accepted;
        progressMs=battles>=constants.restedMaxBattles?0:
            totalMs-earned*constants.restedMsPerBattle;
        return {battles,progressMs,accepted};
    }
    function grantElementBox(remainingMs,hours,maxHours){
        const safeHours=Math.max(0,Number(hours)||0);
        const capMs=Math.max(0,Number(maxHours)||32)*60*60*1000;
        return Math.min(capMs,Math.max(0,remainingMs)+safeHours*60*60*1000);
    }
    function debitElementBox(remainingMs,elapsedMs,active){
        let used=0,exhausted=false;
        if(active&&remainingMs>0){
            const delta=Math.max(0,elapsedMs);
            used=Math.min(delta,remainingMs);
            remainingMs-=used;
            if(remainingMs<=0){remainingMs=0;exhausted=true;}
        }
        return {remainingMs,used,exhausted};
    }
    function elementBoxStoredMs(remainingMs){
        return Math.max(0,Math.floor(remainingMs));
    }
    const api=Object.freeze({constants,accrueRested,grantElementBox,debitElementBox,elementBoxStoredMs});
    global.FourSymbolsAccountModeTimePolicy=api;
    if(typeof module!=="undefined"&&module.exports){module.exports=api;}
})(typeof window!=="undefined"?window:globalThis);
