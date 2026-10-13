/* Shared storage/admission policy. No combat execution, resources or storage. */
(function installTeamFormationPolicy(global){
    "use strict";
    const Core=typeof module!=="undefined"&&module.exports?require("./hero-core"):global.FourSymbolsHeroCore;
    const front=Object.freeze(["ALLY_F1","ALLY_F2","ALLY_F3"]);
    const back=Object.freeze(["ALLY_B1","ALLY_B2","ALLY_B3"]);
    const slots=Object.freeze(front.concat(back));
    const object=value=>value!==null&&typeof value==="object"&&!Array.isArray(value);
    function validate(value,playerIndexes,ownedIds){
        if(!object(value)||value.version!==2||Object.keys(value).sort().join("|")!=="characterIndexToSlot|heroIdToSlot|version"||
            !object(value.characterIndexToSlot)||!object(value.heroIdToSlot))throw Error("invalid team formation schema");
        const players=Object.keys(value.characterIndexToSlot).sort();
        if(players.join("|")!==playerIndexes.map(String).sort().join("|"))throw Error("invalid player formation references");
        const heroes=Object.keys(value.heroIdToSlot);
        if(heroes.length>Core.contract.maxHeroes||heroes.some(id=>!ownedIds.includes(id)))throw Error("unowned or excessive heroes");
        heroes.forEach(id=>Core.getHeroDefinition(id));
        const positions=Object.values(value.characterIndexToSlot).concat(Object.values(value.heroIdToSlot));
        if(positions.length>slots.length||positions.some(slot=>!slots.includes(slot))||new Set(positions).size!==positions.length)
            throw Error("duplicate or invalid team slots");
        return JSON.parse(JSON.stringify(value));
    }
    function roster(value){return slots.flatMap(slot=>Object.keys(value?.heroIdToSlot||{}).filter(id=>value.heroIdToSlot[id]===slot));}
    const api=Object.freeze({slots,front,back,validate,roster});
    global.FourSymbolsTeamFormationPolicy=api;
    if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:globalThis);
