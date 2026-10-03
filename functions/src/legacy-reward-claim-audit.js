"use strict";

// Historical client state can at most tell the migration flow which reward
// claims must remain blocked. It can never establish that a reward is due.
// Keep this parser pure so the eventual server-side admission transaction can
// reuse exactly the same fail-closed interpretation.
const CLAIM_DISPOSITION="block_historical_claims_only";

function isPlainObject(value){
    return !!value&&typeof value==="object"&&!Array.isArray(value);
}

function isBooleanMap(value){
    return isPlainObject(value)&&Object.keys(value).every(key=>
        typeof key==="string"&&key.trim()!==""&&typeof value[key]==="boolean");
}

function isProgressMap(value){
    return isPlainObject(value)&&Object.keys(value).every(key=>
        typeof key==="string"&&key.trim()!==""&&
        Number.isSafeInteger(value[key])&&value[key]>=0);
}

function auditQuestState(value,source){
    if(!isPlainObject(value)||typeof value.date!=="string"||
       !isProgressMap(value.progress)||!isBooleanMap(value.claimed)){
        return {source,status:"blocked",blocker:"CLAIM_RECORD_INVALID"};
    }
    return {source,status:"blocked",claimedKeys:Object.keys(value.claimed)
        .filter(key=>value.claimed[key]).sort(),disposition:CLAIM_DISPOSITION};
}

function auditAchievementState(value){
    if(!isBooleanMap(value)){
        return {source:"achievements",status:"blocked",blocker:"CLAIM_RECORD_INVALID"};
    }
    return {source:"achievements",status:"blocked",claimedKeys:Object.keys(value)
        .filter(key=>value[key]).sort(),disposition:CLAIM_DISPOSITION};
}

function auditTowerState(value){
    const claimed=value&&value.tower&&value.tower.claimedFloors;
    if(!isBooleanMap(claimed)||Object.keys(claimed).some(key=>
        !/^[1-9][0-9]*$/.test(key))){
        return {source:"tower",status:"blocked",blocker:"CLAIM_RECORD_INVALID"};
    }
    return {source:"tower",status:"blocked",claimedKeys:Object.keys(claimed)
        .filter(key=>claimed[key]).sort(),disposition:CLAIM_DISPOSITION};
}

function auditAbyssState(value){
    if(!isPlainObject(value)||!isPlainObject(value.runs)){
        return {source:"abyss",status:"blocked",blocker:"CLAIM_RECORD_INVALID"};
    }
    const claimedKeys=[];
    for(const runId of Object.keys(value.runs).sort()){
        const run=value.runs[runId];
        if(!isPlainObject(run)||!isPlainObject(run.rewardClaims)||!isPlainObject(run.firstClearClaims)){
            return {source:"abyss",status:"blocked",blocker:"CLAIM_RECORD_INVALID"};
        }
        for(const field of ["rewardClaims","firstClearClaims"]){
            for(const key of Object.keys(run[field])){
                const claim=run[field][key];
                if(!isPlainObject(claim)||!["granting","claimed"].includes(claim.status)){
                    return {source:"abyss",status:"blocked",blocker:"CLAIM_RECORD_INVALID"};
                }
                claimedKeys.push(`${runId}:${field}:${key}`);
            }
        }
    }
    return {source:"abyss",status:"blocked",claimedKeys:claimedKeys.sort(),disposition:CLAIM_DISPOSITION};
}

function parseSidecar(sidecars,key){
    if(sidecars?.[key]?.status!=="present"){ return null; }
    try{ return JSON.parse(sidecars[key].raw); }
    catch(_){ return null; }
}

function auditMilestoneSidecar(sidecars){
    if(sidecars?.["quest-milestones"]?.status!=="present"){ return null; }
    const value=parseSidecar(sidecars,"quest-milestones");
    if(!isPlainObject(value)||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value.date||"")||
       !isBooleanMap(value.daily)||!isBooleanMap(value.commission)||
       [value.daily,value.commission].some(map=>Object.keys(map).some(key=>
           !["20","40","60","80","100"].includes(key)))){
        return {source:"quest_milestones",status:"blocked",blocker:"CLAIM_RECORD_INVALID"};
    }
    const claimedKeys=["daily","commission"].flatMap(type=>
        Object.keys(value[type]).filter(key=>value[type][key])
            .map(key=>`${value.date}:${type}:${key}`)).sort();
    return {source:"quest_milestones",status:"blocked",claimedKeys,
        disposition:CLAIM_DISPOSITION};
}

function claimEntries(value){
    if(!isPlainObject(value)||!isPlainObject(value.runs)){ return null; }
    const entries=[];
    for(const [runId,run] of Object.entries(value.runs)){
        if(!isPlainObject(run)||!isPlainObject(run.rewardClaims)||
           !isPlainObject(run.firstClearClaims)){ return null; }
        for(const field of ["rewardClaims","firstClearClaims"]){
            for(const [key,claim] of Object.entries(run[field])){
                if(!isPlainObject(claim)||!["granting","claimed"].includes(claim.status)){
                    return null;
                }
                entries.push(`${runId}:${field}:${key}:${claim.status}`);
            }
        }
    }
    return entries.sort();
}

function auditAbyssSidecar(save,sidecars){
    if(sidecars?.["abyss-state"]?.status!=="present"){ return null; }
    const main=claimEntries(save.abyssProgress);
    const mirrored=claimEntries(parseSidecar(sidecars,"abyss-state"));
    if(!main||!mirrored){
        return {source:"abyss_sidecar",status:"blocked",blocker:"CLAIM_RECORD_INVALID"};
    }
    if(JSON.stringify(main)!==JSON.stringify(mirrored)){
        return {source:"abyss_sidecar",status:"blocked",blocker:"CLAIM_MIRROR_CONFLICT"};
    }
    return {source:"abyss_sidecar",status:"blocked",claimedKeys:mirrored,
        disposition:CLAIM_DISPOSITION};
}

function auditLegacyRewardClaims(save,sidecars=null){
    const audits=[
        auditQuestState(save.dailyQuestState,"daily_quests"),
        auditQuestState(save.commissionQuestState,"commission_quests"),
        auditAchievementState(save.achievementState),
        auditTowerState(save.gameplayProgress),
        auditAbyssState(save.abyssProgress),
        auditMilestoneSidecar(sidecars),
        auditAbyssSidecar(save,sidecars)
    ].filter(Boolean);
    const blockers=new Set(["HISTORICAL_REWARDS_UNVERIFIED"]);
    audits.filter(audit=>audit.blocker).forEach(audit=>blockers.add(`${audit.source.toUpperCase()}_${audit.blocker}`));
    return Object.freeze({
        status:"blocked",
        readyForAcceptance:false,
        historicalGrantable:false,
        disposition:CLAIM_DISPOSITION,
        sources:Object.freeze(audits.map(audit=>Object.freeze(audit))),
        blockers:Object.freeze([...blockers].sort())
    });
}

module.exports={auditLegacyRewardClaims,CLAIM_DISPOSITION};
