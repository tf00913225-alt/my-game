"use strict";

const {resolvePlainPlayerNormalAttack,samplePlainPlayerNormalAttack}=require('./canonical-battle-normal-attack');
const {createForestOpeningRoundRules}=require('./generated/forest-opening-round-rules');
const openingPolicy=require('./generated/forest-opening-round-policy.json');
const playerPolicy=require('./generated/plain-player-normal-attack-policy.json');
const {claimRecordsDigest:digest}=require('./canonical-snapshot');
const copy=value=>JSON.parse(JSON.stringify(value));
const invalid=message=>{throw Error('Opening round input invalid: '+message);};

// Pure internal projection, NOT a persisted/legal encounter or terminal
// verdict. Both actors' normal attacks are explicitly restricted assumptions;
// no enemy skill selection, multi-enemy draw or repeated-round lifecycle.
// A protected successor must pin the complete policy and server transcript.
function resolveForestOpeningRound(args){
    if(!args||typeof args!=='object'||Array.isArray(args)||
       Object.keys(args).sort().join('|')!=='archive|encounterKey|encounterPolicy|randomTape|revision|snapshot|uid'){
        invalid('only private original sources and an explicit server transcript are supported');
    }
    const {randomTape,...sources}=args;
    if(!Array.isArray(randomTape)||randomTape.length<3||randomTape.length>7||
       randomTape.some(v=>typeof v!=='number'||!Number.isFinite(v)||v<0||v>=1)){
        invalid('bounded exact server transcript required');
    }
    // Reuse the sole admission owner; this guaranteed MISS is only a pure
    // validation/stat query, never an observed action or consumed entropy.
    const admitted=resolvePlainPlayerNormalAttack({...sources,randomTape:[0.999999999999]});
    const player=copy(args.archive.sourceRecords.characters[0].state);
    const definition=copy(args.encounterPolicy.entries[args.encounterKey]);
    const enemy={...definition.stats,level:definition.spec.level,element:definition.spec.element,
        alive:true,canAct:true};
    let cursor=0;
    const random=()=>{
        if(cursor>=randomTape.length)invalid('server transcript exhausted');
        return randomTape[cursor++];
    };
    const rules=createForestOpeningRoundRules(player,admitted.playerStats,enemy,random);
    const queue=rules.initiative();
    if(cursor!==2||queue.length!==2||new Set(queue.map(a=>a.type)).size!==2||
       queue.some(a=>!['player','monster'].includes(a.type))){
        invalid('unsupported two-combatant initiative contract');
    }
    let playerHP=player.hp,enemyHP=enemy.maxHP;
    const actions=[];
    for(const actor of queue){
        const type=actor.type;
        if(playerHP===0||enemyHP===0){actions.push({actor:type,skipped:true,reason:'combatant-dead'});continue;}
        const start=cursor;
        let hit,isCrit=false,damage=0;
        const hpBefore=type==='player'?enemyHP:playerHP;
        if(type==='player'){
            const attack=samplePlainPlayerNormalAttack(sources,random);
            ({hit,isCrit,damage}=attack);
            enemyHP=Math.max(0,enemyHP-damage);
        }else{
            hit=rules.enemyHit();
            if(hit)damage=rules.enemyDamage();
            playerHP=Math.max(0,playerHP-damage);
        }
        actions.push({actor:type,skipped:false,hit,isCrit,damage,hpBefore,
            hpAfter:type==='player'?enemyHP:playerHP,randomSamplesConsumed:cursor-start});
    }
    if(cursor!==randomTape.length)invalid('unused server transcript samples');
    const body={schemaVersion:1,kind:'forest-opening-round-arithmetic',ownerUid:args.uid,
        sourceRevision:args.revision,characterId:admitted.characterId,snapshotSha256:args.snapshot.sha256,
        encounterKey:args.encounterKey,encounterPolicySha256:admitted.encounterPolicySha256,
        definitionSha256:admitted.definitionSha256,openingRulesPolicySha256:digest(openingPolicy),
        playerRulesPolicySha256:digest(playerPolicy),initiative:queue,actions,
        playerHPBefore:player.hp,playerHPAfter:playerHP,enemyHPBefore:enemy.maxHP,enemyHPAfter:enemyHP,
        randomTape:copy(randomTape),randomSamplesConsumed:cursor,
        combatRulesReady:false,outcomeVerified:false,rewardEligible:false,creditedToCharacter:false};
    return Object.freeze({...body,sha256:digest(body)});
}
module.exports={resolveForestOpeningRound};
