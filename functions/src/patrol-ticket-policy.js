"use strict";

const catalog=require("./generated/patrol-source-catalog.json");
const rewards=require("./patrol-reward-policy");
const drops=require("./patrol-drop-policy");
const {newcomerExpNext}=require("./canonical-newcomer-exp");
const forest=catalog.zones.forest;

// Bounded ordinary source selection, not combat adjudication. Map availability
// is an allowed presentation hint, never proof of a kill or reward amount.
// The protected ticket Owner alone supplies server-generated random samples.
function preparePatrolMembers({triggerEntryId,availableEntryIds},draw){
    const ids=forest.mapEntries.map(row=>row.entryId);
    const available=availableEntryIds===undefined?ids:availableEntryIds;
    if(typeof draw!=="function"||!Array.isArray(available)||!available.length||
       available.length>forest.selection.maxMapEntries||new Set(available).size!==available.length||
       available.some(id=>!ids.includes(id))||!available.includes(triggerEntryId)){
        throw Error("Unsupported Forest source selection.");
    }
    const sample=()=>{
        const value=draw();
        if(typeof value!=="number"||!Number.isFinite(value)||value<0||value>=1){
            throw Error("Invalid server Patrol sample.");
        }
        return value;
    };
    const trigger=ids.indexOf(triggerEntryId);
    const pool=ids.map((id,index)=>available.includes(id)&&index!==trigger?index:null)
        .filter(index=>index!==null);
    // Preserve the original Client order: shuffle first, group-size draw next,
    // sort selected map positions, then roll each selected member's rank.
    for(let i=pool.length-1;i>0;i--){
        const j=Math.floor(sample()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];
    }
    const target=forest.selection.groupMin+Math.floor(sample()*
        (forest.selection.groupMax-forest.selection.groupMin+1));
    const selected=[trigger,...pool.slice(0,Math.min(target-1,pool.length))].sort((a,b)=>a-b);
    const ranked=selected.map(index=>({...forest.mapEntries[index],
        rank:sample()<forest.rank.eliteChance?"elite":"regular"}));
    return ranked.map((row,memberIndex)=>{
        const goldSample=sample(),dropSamples=row.rank==="elite"?[sample()]:drops.normalRows.map(()=>sample());
        const results=row.rank==="elite"?[drops.eliteDrop(dropSamples[0])]:
            dropSamples.map((value,index)=>drops.normalDrop(index,value));
        return {...row,memberIndex,goldSample,dropSamples,
            gold:rewards.awardedGoldFromBase(rewards.baseGold(row.level,row.rank,goldSample)),
            drops:results.filter(Boolean)};
    });
}

function patrolVictoryExp(members,characters,mode){
    if(!Array.isArray(members)||members.length<1||members.length>forest.selection.groupMax||
       !Array.isArray(characters)||!characters.length||characters.some(row=>
           !Number.isSafeInteger(row.level)||row.level<1||row.level>100)){
        throw Error("Complete canonical Patrol EXP inputs are required.");
    }
    for(const row of members){
        const original=forest.mapEntries.find(entry=>entry.entryId===row.entryId);
        if(!original||!["regular","elite"].includes(row.rank)||
           Object.entries(original).some(([key,value])=>row[key]!==value)){
            throw Error("Unsupported Forest member EXP identity.");
        }
    }
    if(new Set(members.map(row=>row.entryId)).size!==members.length){
        throw Error("Duplicate Patrol map position.");
    }
    const primary=characters[0].level,highest=Math.max(...characters.map(row=>row.level));
    const standard=primary<10?rewards.beginnerForestExp(
        rewards.beginnerForestBattleExp(Array.from({length:9},(_,index)=>newcomerExpNext(index+1))),
        members.reduce((sum,row)=>sum+rewards.expRankMultiplier(row.rank),0)):
        rewards.standardPatrolExp(members,highest);
    return rewards.applyExpMode(standard,mode);
}

module.exports={preparePatrolMembers,patrolVictoryExp};
