"use strict";

const policy=require("./generated/patrol-progress-policy.json");
const catalog=require("./generated/patrol-source-catalog.json");
const {snapshotDigest}=require("./canonical-snapshot");
const {createHash}=require("node:crypto");
const clone=value=>JSON.parse(JSON.stringify(value));
const object=value=>value!==null&&typeof value==="object"&&!Array.isArray(value);
const exact=(value,keys)=>object(value)&&Object.keys(value).sort().join("|")===[...keys].sort().join("|");
const fail=message=>{const error=new Error("Patrol progress: "+message);error.code="data-loss";throw error;};
const same=(a,b)=>snapshotDigest(a)===snapshotDigest(b);
function validDate(value){
    if(typeof value!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
    try{return new Date(value+"T00:00:00Z").toISOString().slice(0,10)===value;}catch(_){return false;}
}
function generated(value,scope){
    const {sha256,...body}=value;
    if(value.schemaVersion!==1||value.scope!==scope||value.outcomeVerified!==false||
        value.rewardEligible!==false||snapshotDigest(body)!==sha256)fail("Generated source policy is inconsistent.");
}
function quest(state,goals,required,today,initialLineageVerified){
    if(!exact(state,["date","progress","claimed"])||!object(state.progress)||!object(state.claimed)){
        fail("Complete quest storage is required.");
    }
    const ids=Object.keys(state.progress);
    if(!same(ids.slice().sort(),Object.keys(state.claimed).sort())||
        required.some(id=>!Object.hasOwn(state.progress,id))||
        ids.some(id=>!Object.hasOwn(goals,id)||!Number.isSafeInteger(state.progress[id])||
            state.progress[id]<0||typeof state.claimed[id]!=="boolean")){
        fail("Quest keyset, counter or claim marker is unsupported.");
    }
    if(state.date===""){
        if(initialLineageVerified!==true||ids.some(id=>state.progress[id]!==0||state.claimed[id]!==false)){
            fail("An empty quest date requires verified original zero-state lineage.");
        }
    }else if(!validDate(state.date)||state.date>today)fail("Quest period is invalid or in the future.");
    const changedPeriod=state.date!==today;
    const result={date:today,progress:{},claimed:{}};
    for(const id of Object.keys(goals)){
        // A new UTC view never overwrites an old period's retained evidence.
        // Expansion keys are the Client's existing zero/false defaults only.
        result.progress[id]=changedPeriod?0:state.progress[id]??0;
        result.claimed[id]=changedPeriod?false:state.claimed[id]??false;
    }
    return {state:result,changedPeriod};
}
function sidecar(progress,name){
    const entry=progress.sidecars?.[name];
    if(!exact(entry,["status","raw"])||entry.status!=="present"||typeof entry.raw!=="string"){
        fail("Missing canonical "+name+" sidecar.");
    }
    let state;try{state=JSON.parse(entry.raw);}catch(_){fail("Malformed "+name+" sidecar.");}
    return {raw:entry.raw,state};
}
function memberIdentity(member){
    if(!object(member)||Object.keys(member).some(key=>
        !["entryId","rank","name","level","element","monsterKey","context"].includes(key))||
        !["regular","elite"].includes(member.rank))fail("Unsupported member identity or rank.");
    const row=catalog.zones.forest.mapEntries.find(entry=>entry.entryId===member.entryId);
    if(!row||Object.keys(member).some(key=>key!=="rank"&&member[key]!==row[key])){
        fail("Member identity differs from the generated Forest source.");
    }
    return row;
}
function increment(state,goals,key){
    if(!Object.hasOwn(goals,key))fail("Required progress goal is absent from the generated policy.");
    state.progress[key]=Math.min(goals[key],state.progress[key]+1);
}

// Pure projection for an already admitted online Forest settlement. The caller
// owns Session/revision/source admission, once-only membership/outcome, receipts,
// snapshots and archived claim evidence. This neither verifies combat nor pays
// quest rewards, creates claims, rolls milestones or accepts Client counters.
function applyPatrolProgress(records,input){
    generated(policy,"quest-progress-data-only");generated(catalog,"patrol-source-data-only");
    if(!same(policy.period,{timeZone:"UTC",dateFormat:"YYYY-MM-DD",boundary:"00:00:00Z"})){
        fail("Unsupported generated quest period.");
    }
    if(!object(input)||Object.keys(input).some(key=>!["kind","member","serverNow","initialLineageVerified"].includes(key))||
        !["member","win","loss","escape"].includes(input.kind)||
        !Number.isSafeInteger(input.serverNow)||input.serverNow<1||
        !(input.initialLineageVerified===undefined||typeof input.initialLineageVerified==="boolean")||
        (input.kind!=="member"&&input.member!==undefined))fail("Unsupported progress intent or server time.");
    let today;try{today=new Date(input.serverNow).toISOString().slice(0,10);}catch(_){fail("Invalid server UTC time.");}
    if(!validDate(today))fail("Unsupported server UTC period.");
    if(!object(records?.progress)||!object(records.progress.playableState)||
        !object(records.progress.playableState.bestiaryData))fail("Complete playable progress is required.");
    const before=records.progress,daily=quest(before.dailyQuestState,policy.quests.daily,
        ["checkin","killMonsters","winBattle"],today,input.initialLineageVerified),
        commission=quest(before.commissionQuestState,policy.quests.commission,
            ["killMonsters","winBattle"],today,input.initialLineageVerified);
    const counters=sidecar(before,"progress"),milestones=sidecar(before,"quest-milestones");
    if(!exact(counters.state,["eliteKills","dungeonWins","abyssClears"])||Object.values(counters.state).some(
        value=>!Number.isSafeInteger(value)||value<0))fail("Invalid lifetime progress counters.");
    if(!exact(milestones.state,["date","daily","commission"])||!validDate(milestones.state.date)||milestones.state.date>today||
        ["daily","commission"].some(group=>!object(milestones.state[group])||Object.entries(milestones.state[group]).some(
            ([key,value])=>!["20","40","60","80","100"].includes(key)||value!==true))){
        fail("Invalid retained milestone claim evidence.");
    }
    for(const [name,row] of Object.entries(before.playableState.bestiaryData)){
        if(!name.trim()||name.length>128||!exact(row,["seen","kills"])||typeof row.seen!=="boolean"||
            !Number.isSafeInteger(row.kills)||row.kills<0||(!row.seen&&row.kills>0))fail("Invalid retained bestiary evidence.");
    }
    const progress=clone(before);progress.dailyQuestState=daily.state;progress.commissionQuestState=commission.state;
    if(input.kind==="member"){
        const member=memberIdentity(input.member),bestiary=progress.playableState.bestiaryData;
        const old=Object.hasOwn(bestiary,member.name)?bestiary[member.name].kills:0;
        if(old>=Number.MAX_SAFE_INTEGER)fail("Bestiary counter exceeds safe precision.");
        bestiary[member.name]={seen:true,kills:old+1};
        increment(daily.state,policy.quests.daily,"killMonsters");increment(daily.state,policy.quests.daily,"kill10");
        increment(commission.state,policy.quests.commission,"killMonsters");increment(commission.state,policy.quests.commission,"kill30");
        if(input.member.rank==="elite"){
            increment(commission.state,policy.quests.commission,"elite2");
            if(counters.state.eliteKills>=Number.MAX_SAFE_INTEGER)fail("Elite counter exceeds safe precision.");
            counters.state.eliteKills++;
            progress.sidecars.progress={status:"present",raw:JSON.stringify(counters.state)};
        }
    }else if(input.kind==="win"){
        increment(daily.state,policy.quests.daily,"winBattle");increment(daily.state,policy.quests.daily,"win3");
        increment(commission.state,policy.quests.commission,"winBattle");increment(commission.state,policy.quests.commission,"win5");
    }
    const transitionEvidence={schemaVersion:1,kind:"patrol-utc-quest-progress",serverNow:input.serverNow,utcDay:today,
        policySha256:policy.sha256,sourceCatalogSha256:catalog.sha256,
        changedPeriod:{daily:daily.changedPeriod,commission:commission.changedPeriod},
        before:{dailyQuestState:clone(before.dailyQuestState),commissionQuestState:clone(before.commissionQuestState),
            questMilestonesRaw:milestones.raw,questMilestonesSha256:createHash("sha256").update(milestones.raw,"utf8").digest("hex"),progressRaw:counters.raw},
        after:{dailyQuestState:clone(daily.state),commissionQuestState:clone(commission.state)}};
    return {progress,transitionEvidence};
}

module.exports={applyPatrolProgress};
