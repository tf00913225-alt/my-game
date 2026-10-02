/* Sole equipment unit migration owner, shared by the app-shell and backend.
 * Unversioned equipment comes from the pre-V2 schema: its only Accuracy
 * producers are four-symbol armor base stats and the retired Spirit mapping.
 * This never converts character/monster/skill/buff Accuracy or raw archives.
 */
(function(root,factory){
    const api=factory();
    if(typeof module==="object"&&module.exports){ module.exports=api; }
    else{ root.FourSymbolsEquipmentCombatMigration=api; }
})(typeof window!=="undefined"?window:globalThis,function(){
    "use strict";
    const VERSION=2;
    const SET_IDS=new Set(["setFire","setWater","setEarth","setWind"]);
    const rounded=value=>Math.round(value*1e10)/1e10;
    function migrateItem(item){
        if(!item||typeof item!=="object"||Array.isArray(item)){ return item; }
        const version=item.equipmentCombatPercentUnitVersion;
        if(version===VERSION){ return item; }
        if(version!==undefined&&version!==1){ throw new Error("Unknown equipment combat unit version"); }
        const armor=SET_IDS.has(item.setId)&&
            [item.setId+"_heavyArmor",item.setId+"_robe"].includes(item.id);
        const updates={};
        for(const key of ["stats","reforgeStats"]){
            const source=item[key];
            if(source==null){ continue; }
            if(typeof source!=="object"||Array.isArray(source)){ throw new Error("Invalid equipment stats"); }
            const stats={...source};
            for(const field of ["accuracy","spirit","antiCrit","statusResistance","evasion"]){
                if(stats[field]!==undefined&&!Number.isFinite(Number(stats[field]))){
                    throw new Error("Invalid equipment combat stat: "+field);
                }
            }
            let accuracy=Number(stats.accuracy)||0;
            // Set base is replaced before any legacy-unit conversion. Reforge
            // Accuracy is never mistaken for the set's ten-point base.
            if(key==="stats"&&armor&&accuracy>=10){
                accuracy-=10;
                stats.evasion=(Number(stats.evasion)||0)+10;
            }
            if(Object.prototype.hasOwnProperty.call(stats,"accuracy")){
                if(accuracy){ stats.accuracy=rounded(accuracy*0.15); }
                else{ delete stats.accuracy; }
            }
            const spirit=Number(stats.spirit)||0;
            if(spirit){
                stats.accuracy=rounded((Number(stats.accuracy)||0)+spirit*0.3);
                stats.antiCrit=rounded((Number(stats.antiCrit)||0)+spirit*0.1);
                stats.statusResistance=rounded((Number(stats.statusResistance)||0)+spirit*0.05);
            }
            delete stats.spirit;
            updates[key]=stats;
        }
        Object.assign(item,updates,{equipmentCombatPercentUnitVersion:VERSION});
        return item;
    }
    function projectItem(item){
        return migrateItem(JSON.parse(JSON.stringify(item)));
    }
    return Object.freeze({VERSION,migrateItem,projectItem});
});
