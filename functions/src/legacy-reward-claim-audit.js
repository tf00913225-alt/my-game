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

function auditLegacyRewardClaims(save){
    const audits=[
        auditQuestState(save.dailyQuestState,"daily_quests"),
        auditQuestState(save.commissionQuestState,"commission_quests"),
        auditAchievementState(save.achievementState),
        auditTowerState(save.gameplayProgress),
        auditAbyssState(save.abyssProgress)
    ];
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
