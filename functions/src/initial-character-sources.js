"use strict";

const {createHash}=require("node:crypto");
const {LEGACY_BACKUP_SIDECARS}=require("./cloud-save-policy");
const {newcomerExpNext}=require("./canonical-newcomer-exp");

const STAT_KEYS=["attack","intelligence","vitality","energy","defensePoints","agility"];
const ELEMENTS=new Set(["fire","water","wind","earth"]);
const digest=value=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
const plain=value=>value!==null&&typeof value==="object"&&!Array.isArray(value);

// Initial evidence only. No elapsed-time accrual, reward or historical default.
function makeInitialSidecars(recordedAt){
    const sidecars=Object.fromEntries(LEGACY_BACKUP_SIDECARS.map(key=>[
        key,{status:"not-applicable",raw:null}]));
    if(recordedAt!==undefined){
        const initial={
            "element-box-state":{remainingMs:0},
            "exp-pool-growth-state":{initialized:true,unlocked:false,lastAt:recordedAt,
                noticeShown:false,lastCapped:false,newcomerRewards:{}},
            "rested-exp-state":{battles:0,progressMs:0,lastSeenAt:recordedAt,
                blockedByElementBox:false}
        };
        for(const [key,state] of Object.entries(initial)){
            sidecars[key]={status:"present",raw:JSON.stringify(state)};
        }
    }
    return sidecars;
}

// Only the player's choices cross this boundary. All progression is generated
// here by the server. The callable accepts choices only, never progression.
function makeInitialCharacterSources(uid,revision,operationId,selection,{recordedAt}={}){
    if(!plain(selection)||Object.keys(selection).sort().join("|")!==
        "attributes|displayName|element|gender"||
       typeof selection.displayName!=="string"||
       selection.displayName!==selection.displayName.trim()||
       selection.displayName.length<2||selection.displayName.length>24||
       /[\u0000-\u001f\u007f<>]/u.test(selection.displayName)||
       !ELEMENTS.has(selection.element)||
       !["male","female"].includes(selection.gender)||
       !plain(selection.attributes)||
       Object.keys(selection.attributes).sort().join("|")!==[...STAT_KEYS].sort().join("|")||
       STAT_KEYS.some(key=>!Number.isSafeInteger(selection.attributes[key])||
           selection.attributes[key]<0||selection.attributes[key]>10)||
       STAT_KEYS.reduce((sum,key)=>sum+selection.attributes[key],0)!==10){
        throw new Error("Invalid initial character choices.");
    }
    const characterId=`character-${operationId}`;
    const base={schemaVersion:1,ownerUid:uid,serverRevision:revision,
        provenance:"server-created"};
    const attributes=selection.attributes;
    if(recordedAt!==undefined&&(!Number.isSafeInteger(recordedAt)||recordedAt<1)){
        throw new Error("Invalid server creation timestamp.");
    }
    const state={id:selection.displayName,element:selection.element,
        gender:selection.gender,level:1,exp:0,expNext:newcomerExpNext(1),
        ...Object.fromEntries(STAT_KEYS.map(key=>[key,attributes[key]])),
        bonusHP:0,bonusSP:0,attributePoints:0,skillPoints:2,
        hp:100+attributes.vitality*50,sp:50+attributes.energy*15,
        activeBuffs:[],statusEffects:[],isDefending:false};
    return {
        account:{...base,slots:[characterId,null,null],formation:null},
        characters:[{...base,characterId,slotIndex:0,
            displayName:selection.displayName,element:selection.element,state,
            skillLoadout:{name:selection.displayName,skillLevels:{},equippedSkills:[]}}],
        economy:{...base,gold:0,sharedExp:0},inventory:[],equipment:[],relics:[],
        relicLoadout:{...base,relicId:null,subRelicId:null},
        progress:{...base,dailyQuestState:{},commissionQuestState:{},
            achievementState:{},gameplayProgress:{},abyssProgress:{},
            ...(recordedAt===undefined?{}:{playableState:{
                heroAccount:require("./hero-core").normalizeAccountState(null),
                bestiaryData:{},
                ...Object.fromEntries(["autoConfig","autoConfig2","autoConfig3"].map(key=>
                    [key,{enabled:false,skill:"normal",hp:50,sp:25,returnToCityWhenEmpty:false}])),
                selectedCreationElement:selection.element,lastSaveTimestamp:recordedAt}}),
            sidecars:makeInitialSidecars(recordedAt)},
        claimRecords:[],claimCheckpoint:{...base,claimCount:0,
            claimDigest:digest([]),historicalClaimsBlocked:false}
    };
}

module.exports={makeInitialCharacterSources,makeInitialSidecars};
