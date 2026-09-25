/* V169 — Water runtime compatibility only. V173.64 is the sole author of player skill fields. */
(function installV169WaterSkillRules(){
    "use strict";
    if(typeof window==="undefined"||window.__v169WaterSkillRulesInstalled){ return; }
    window.__v169WaterSkillRulesInstalled=true;

    const VERSION="169";
    const WATER_DAMAGE_SKILL_IDS=Object.freeze([
        "waterKnife","frostPunch","iceSpin","frostCrush","waterBall","floodBeast","iceArrowRain"
    ]);
    const WATER_SKILL_IDS=Object.freeze(WATER_DAMAGE_SKILL_IDS.concat([
        "freeze","healSpell","revive","purifyMind","waterEX"
    ]));
    const FROSTBITE_REMAINING_RATE=.70;
    const numeric=value=>{
        const result=Number(value);
        return Number.isFinite(result)?result:0;
    };
    const activeFrostbite=entity=>!!(entity&&Array.isArray(entity.statusEffects)&&entity.statusEffects.some(effect=>
        effect&&effect.type==="frostbite"&&numeric(effect.turnsLeft)>0
    ));

    /* Frostbite's outgoing-damage multiplier is a shared Runtime seam. Its
       chance, duration and all other skill fields are authored by V173.64. */
    if(typeof window.getOutgoingDamageDownPercent==="function"){
        const previousOutgoingDamageDown=window.getOutgoingDamageDownPercent;
        window.getOutgoingDamageDownPercent=function(attacker){
            const existing=Math.max(0,Math.min(100,numeric(previousOutgoingDamageDown.apply(this,arguments))));
            if(!activeFrostbite(attacker)){ return existing; }
            return Math.max(0,Math.min(100,100-(100-existing)*FROSTBITE_REMAINING_RATE));
        };
    }

    window.v169WaterSkillRules=Object.freeze({
        version:VERSION,skillIds:WATER_SKILL_IDS.slice(),
        isFrostbitten:activeFrostbite,frostbitePenaltyPercent:30
    });
})();
