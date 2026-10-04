"use strict";

const {createPlainPlayerRules}=require("./generated/plain-player-normal-attack-rules");
const policy=require("./generated/plain-player-normal-attack-policy.json");
const {inspectRecoveryArchive}=require("./canonical-recovery-archive");
const {claimRecordsDigest}=require("./canonical-snapshot");
const {inspectPolicy}=require("./canonical-battle-encounter");
const plain=value=>value!==null&&typeof value==="object"&&!Array.isArray(value);
const copy=value=>JSON.parse(JSON.stringify(value));
const invalid=message=>{throw new Error("Normal attack rule input invalid: "+message);};
const integer=(value,max=1000000)=>Number.isSafeInteger(value)&&value>=0&&value<=max;
const stateKeys=["id","element","gender","level","exp","expNext","attack","intelligence",
    "vitality","energy","defensePoints","agility","bonusHP","bonusSP","attributePoints",
    "skillPoints","hp","sp","activeBuffs","statusEffects","isDefending"].sort().join("|");

// Internal, pure arithmetic prerequisite. Caller must obtain the source and
// sealed policy via protected private reads; self-consistent hashes alone do
// NOT prove server origin, eligibility, action order or a battle victory.
// No request/callable, random generator, persistence, win/grant/reward path.
function computePlainPlayerNormalAttack(args,sampler=null){
    if(!plain(args)||Object.keys(args).sort().join("|")!==
       "archive|encounterKey|encounterPolicy|randomTape|revision|snapshot|uid"){
        invalid("only private sources, sealed policy and a server random transcript are accepted");
    }
    const {uid,revision,snapshot,archive,encounterPolicy,encounterKey,randomTape}=args;
    const records=inspectRecoveryArchive(archive,uid,revision,snapshot);
    const sealedPolicy=inspectPolicy(encounterPolicy);
    if(records.account.provenance!=="server-created"||records.characters.length!==1||
       records.account.slots[1]!==null||records.account.slots[2]!==null||
       records.inventory.length||records.equipment.length||records.relics.length||
       records.relicLoadout.relicId!==null||records.relicLoadout.subRelicId!==null){
        invalid("only an unequipped server-created first character is supported");
    }
    const character=records.characters[0],state=character.state,loadout=character.skillLoadout;
    if(!plain(state)||Object.keys(state).sort().join("|")!==stateKeys||
       !["fire","water","wind","earth"].includes(state.element)||
       !Number.isSafeInteger(state.level)||state.level<1||state.level>100||
       ["attack","intelligence","vitality","energy","defensePoints","agility",
           "bonusHP","bonusSP","hp","sp"].some(key=>!integer(state[key]))||
       state.hp<1||state.bonusHP!==0||state.bonusSP!==0||state.isDefending!==false||
       !Array.isArray(state.activeBuffs)||state.activeBuffs.length||
       !Array.isArray(state.statusEffects)||state.statusEffects.length||
       !plain(loadout)||Object.keys(loadout).sort().join("|")!=="equippedSkills|name|skillLevels"||
       !plain(loadout.skillLevels)||Object.keys(loadout.skillLevels).length||
       !Array.isArray(loadout.equippedSkills)||loadout.equippedSkills.length){
        invalid("skills, effects, defense, legacy or unknown modifiers are unsupported");
    }
    if(typeof encounterKey!=="string"||!Object.hasOwn(sealedPolicy.entries,encounterKey)){
        invalid("unknown sealed enemy definition");
    }
    const definition=sealedPolicy.entries[encounterKey],spec=definition?.spec,enemyStats=definition?.stats;
    const enemyKeys=["maxHP","maxSP","attack","magicAttack","defense","agility","accuracy",
        "statusResistance","antiCrit","evasion"].sort().join("|");
    if(!plain(definition)||Object.keys(definition).sort().join("|")!=="finalDamagePressure|spec|stats"||
       !plain(spec)||Object.keys(spec).sort().join("|")!=="archetype|context|element|level|mode|monsterKey|name|rank"||
       spec.monsterKey!==encounterKey||spec.rank!=="regular"||spec.mode!=="wild"||
       spec.context!=="wild/zone-01"||!Number.isSafeInteger(spec.level)||spec.level<1||spec.level>100||
       !["fire","water","wind","earth"].includes(spec.element)||!plain(enemyStats)||
       Object.keys(enemyStats).sort().join("|")!==enemyKeys||
       Object.values(enemyStats).some(value=>!Number.isFinite(value)||value<0||value>1000000)||
       !Number.isSafeInteger(enemyStats.maxHP)||enemyStats.maxHP<1||definition.finalDamagePressure!==1){
        invalid("unsupported sealed regular enemy stats");
    }
    if(!Array.isArray(randomTape)||(!sampler&&![1,3].includes(randomTape.length))||
       randomTape.some(value=>typeof value!=="number"||!Number.isFinite(value)||value<0||value>=1)){
        invalid("exact bounded server random transcript required");
    }
    let consumed=0;
    const transcript=[];
    const random=()=>{
        if(!sampler&&consumed>=randomTape.length)invalid("random transcript exhausted");
        if(consumed>=3)invalid("random sample budget exceeded");
        const value=sampler?sampler():randomTape[consumed];
        if(typeof value!=="number"||!Number.isFinite(value)||value<0||value>=1)invalid("invalid server sample");
        consumed++;transcript.push(value);return value;
    };
    const player=copy(state),enemy={...copy(enemyStats),level:spec.level,element:spec.element};
    const rules=createPlainPlayerRules(player,random),playerStats=rules.stats;
    if(state.hp>playerStats.maxHP||state.sp>playerStats.maxSP)invalid("invalid starting resources");
    const hit=rules.hit(enemy),critical=hit?rules.critical(enemy):{isCrit:false,multiplier:1};
    const damage=hit?rules.damage(enemy,critical):0;
    if(!sampler&&consumed!==randomTape.length)invalid("unused random transcript samples");
    if(!integer(damage,1000000000))invalid("damage exceeds the supported numeric budget");
    const result={schemaVersion:1,kind:"plain-player-normal-attack-arithmetic",
        ownerUid:uid,sourceRevision:revision,characterId:character.characterId,
        snapshotSha256:snapshot.sha256,encounterKey,encounterPolicySha256:sealedPolicy.sha256,
        definitionSha256:claimRecordsDigest(definition),rulesSha256:policy.rulesSha256,
        randomTape:transcript,randomSamplesConsumed:consumed,playerStats:copy(playerStats),
        hit,isCrit:critical.isCrit,damage,hpBefore:enemy.maxHP,hpAfter:Math.max(0,enemy.maxHP-damage),
        combatRulesReady:false,outcomeVerified:false,rewardEligible:false,creditedToCharacter:false};
    return Object.freeze({...result,sha256:claimRecordsDigest(result)});
}

function resolvePlainPlayerNormalAttack(args){return computePlainPlayerNormalAttack(args);}
// Internal server-only entropy adapter; shares admission and arithmetic exactly.
function samplePlainPlayerNormalAttack(args,sampler){
    if(!plain(args)||Object.hasOwn(args,"randomTape")||typeof sampler!=="function")invalid("server sampler required");
    return computePlainPlayerNormalAttack({...args,randomTape:[]},sampler);
}
module.exports={resolvePlainPlayerNormalAttack,samplePlainPlayerNormalAttack};
