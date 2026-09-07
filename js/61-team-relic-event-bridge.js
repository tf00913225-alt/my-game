/* Team Relic Event Bridge — connects future trigger types to existing status owners. */
(function installTeamRelicEventBridge(){
    "use strict";
    if(typeof window==="undefined"||window.__teamRelicEventBridgeInstalled){return;}
    window.__teamRelicEventBridgeInstalled=true;
    if(!window.v174RelicSystem||typeof window.v174RelicSystem.dispatch!=="function"){return;}

    function partyIndexFor(entity){
        if(!entity||typeof getExistingPartyIndexes!=="function"||typeof getPartyCharacterByIndex!=="function"){return null;}
        const found=getExistingPartyIndexes().slice(0,3).find(index=>getPartyCharacterByIndex(index)===entity);
        return Number.isInteger(found)?found:null;
    }
    function activeStatusCount(entity){
        return entity&&Array.isArray(entity.statusEffects)
            ?entity.statusEffects.filter(state=>state&&Number(state.turnsLeft)>0).length
            :0;
    }
    function wrapStatusApplication(name){
        const previous=window[name];
        if(typeof previous!=="function"){return;}
        window[name]=function(entity){
            const targetIndex=partyIndexFor(entity);
            const before=targetIndex===null?0:activeStatusCount(entity);
            const result=previous.apply(this,arguments);
            if(targetIndex!==null&&result!==false&&activeStatusCount(entity)>before){
                window.v174RelicSystem.dispatch("ally_debuffed",{
                    sourceType:"status_owner",
                    targetIndex:targetIndex,
                    statusOwner:name
                });
            }
            return result;
        };
    }

    ["applyBurnEffect","applyFreezeEffect","applyMonsterDebuff","applyPetrifyEffect","applyStunEffect"].forEach(wrapStatusApplication);
})();
