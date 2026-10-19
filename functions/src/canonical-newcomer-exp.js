"use strict";

const {createHash}=require("node:crypto");
const table=require("./generated/character-exp-thresholds.json");
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==="object"
    ?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
const {sha256,...payload}=table;
if(table.schemaVersion!==1||table.policyId!=="character-exp-thresholds-v1"||table.maxLevel!==100||
   !Array.isArray(table.thresholds)||table.thresholds.length!==100||
   table.thresholds.some(value=>!Number.isSafeInteger(value)||value<1)||
   createHash("sha256").update(JSON.stringify(stable(payload))).digest("hex")!==sha256){
    throw Error("Trusted character EXP threshold projection is inconsistent.");
}

function newcomerExpNext(level){
    if(!Number.isSafeInteger(level)||level<1||level>table.maxLevel){
        throw new Error("Trusted EXP threshold is unavailable at this level.");
    }
    return table.thresholds[level-1];
}

module.exports={newcomerExpNext};
