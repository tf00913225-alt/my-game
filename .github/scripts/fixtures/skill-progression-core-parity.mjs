import crypto from "node:crypto";
import vm from "node:vm";
import {loadLegacyRuntime} from "../../../scripts/monster-balance-shadow-matrix.mjs";

// Actual full-load Client owners, including every later skill data layer.
export function progressionParity(){
    const {context}=loadLegacyRuntime();
    const catalog=vm.runInContext("skillDatabase",context);
    const digest=crypto.createHash("sha256");let cases=0;
    const record=value=>{digest.update(JSON.stringify(value)+"\n");cases++;};
    for(const id of Object.keys(catalog).sort()){
        const skill=catalog[id];
        record([id,...["name","element","category","learnLevel","learnCost","maxLevel","requires"].map(key=>skill[key])]);
        for(const element of ["fire","water","wind","earth"]){
            const native=Object.fromEntries(Object.entries(catalog).filter(([,s])=>s.element===element).map(([key])=>[key,1]));
            const all=Object.fromEntries(Object.keys(catalog).map(key=>[key,1]));
            for(const level of [1,9,10,19,20,49,50,80,90,100]){
                for(const skillPoints of [0,1,2,4,20,999]){
                    const character={element,level,skillPoints};
                    for(const levels of [{},native,all]){
                        record(context.v173GetSkillLearnEligibility(character,skill,levels));
                    }
                    for(const current of [0,1,4,5,9,10]){
                        record(context.v17364GetSkillUpgradeEligibility(character,skill,current));
                    }
                }
            }
        }
    }
    for(const character of [null,{}, {level:"20",skillPoints:"4",element:"fire"}]){
        for(const skill of [null,catalog.flameSlash,catalog.rage]){
            record(context.v173GetSkillLearnEligibility(character,skill,{}));
            record(context.v17364GetSkillUpgradeEligibility(character,skill,"1"));
        }
    }
    return {catalogueSize:Object.keys(catalog).length,cases,sha256:digest.digest("hex")};
}
