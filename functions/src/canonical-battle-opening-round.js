"use strict";

const {resolvePlainPlayerNormalAttack,samplePlainPlayerNormalAttack}=require('./canonical-battle-normal-attack');
const {createForestOpeningRoundRules}=require('./generated/forest-opening-round-rules');
const openingPolicy=require('./generated/forest-opening-round-policy.json');
const playerPolicy=require('./generated/plain-player-normal-attack-policy.json');
const restrictedPolicy=require('./generated/restricted-forest-instance-policy.json');
const {claimRecordsDigest:digest}=require('./canonical-snapshot');
const copy=value=>JSON.parse(JSON.stringify(value));
const invalid=message=>{throw Error('Opening round input invalid: '+message);};

// Pure internal projection, NOT a persisted/legal encounter or terminal
// verdict. Both actors' normal attacks are explicitly restricted assumptions;
// no enemy skill selection, multi-enemy draw or protected lifecycle.
// A protected successor must pin the complete policy and server transcript.
function resolveForestRoundArithmetic(args,currentState=null,sampler=null){
    if(!args||typeof args!=='object'||Array.isArray(args)||
       Object.keys(args).sort().join('|')!=='archive|encounterKey|encounterPolicy|randomTape|revision|snapshot|uid'){
        invalid('only private original sources and an explicit server transcript are supported');
    }
    const {randomTape,...sources}=args;
    if(!Array.isArray(randomTape)||(!sampler&&randomTape.length<3)||randomTape.length>7||
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
    if(currentState){
        const entry=restrictedPolicy.entries[args.encounterKey];
        if(!entry||entry.specSha256!==digest(definition.spec)||entry.skillChance!==0||
           entry.attackSkills.length||entry.supportSkills.length){
            invalid('enemy must be certified naturally normal-attack-only');
        }
        if(typeof currentState!=='object'||Array.isArray(currentState)||
           Object.keys(currentState).sort().join('|')!=='enemyHP|enemySP|playerHP|playerSP|round|roundVersion'||
           !Number.isSafeInteger(currentState.round)||currentState.round<0||
           currentState.round>=Number.MAX_SAFE_INTEGER||currentState.roundVersion!==currentState.round||
           !Number.isSafeInteger(currentState.playerHP)||currentState.playerHP<1||currentState.playerHP>player.hp||
           !Number.isSafeInteger(currentState.enemyHP)||currentState.enemyHP<1||currentState.enemyHP>enemy.maxHP||
           currentState.playerSP!==player.sp||currentState.enemySP!==enemy.maxSP||
           (currentState.round===0&&(currentState.playerHP!==player.hp||currentState.enemyHP!==enemy.maxHP))){
            invalid('live bounded prior round state required; healing, SP changes and terminal replay unsupported');
        }
        player.hp=currentState.playerHP;
    }
    let cursor=0;
    const random=()=>{
        if(sampler){
            const value=sampler();
            if(cursor>=7||typeof value!=='number'||!Number.isFinite(value)||value<0||value>=1)invalid('server sampler invalid');
            randomTape.push(value);
        }
        if(cursor>=randomTape.length)invalid('server transcript exhausted');
        return randomTape[cursor++];
    };
    const rules=createForestOpeningRoundRules(player,admitted.playerStats,enemy,random);
    const queue=rules.initiative();
    if(cursor!==2||queue.length!==2||new Set(queue.map(a=>a.type)).size!==2||
       queue.some(a=>!['player','monster'].includes(a.type))){
        invalid('unsupported two-combatant initiative contract');
    }
    let playerHP=player.hp,enemyHP=currentState?currentState.enemyHP:enemy.maxHP;
    const enemyHPBefore=enemyHP;
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
        playerHPBefore:player.hp,playerHPAfter:playerHP,enemyHPBefore,enemyHPAfter:enemyHP,
        randomTape:copy(randomTape),randomSamplesConsumed:cursor,
        combatRulesReady:false,outcomeVerified:false,rewardEligible:false,creditedToCharacter:false};
    if(currentState){
        body.kind='restricted-forest-round-arithmetic';
        body.restrictedPolicySha256=digest(restrictedPolicy);
        body.priorState=copy(currentState);
        body.priorStateSha256=digest(currentState);
        body.nextState={round:currentState.round+1,roundVersion:currentState.roundVersion+1,
            playerHP,enemyHP,playerSP:player.sp,enemySP:enemy.maxSP};
        body.nextStateSha256=digest(body.nextState);
    }
    return Object.freeze({...body,sha256:digest(body)});
}
// Retain the original opening projection contract and digest. Both entry
// points execute this same loop; there is no second initiative/damage owner.
function resolveForestOpeningRound(args){return resolveForestRoundArithmetic(args);}
// Pure internal successor prerequisite. currentState is a protected caller's
// committed state, never browser authority. Hashes alone prove no provenance.
// Death stops further projections; no terminal verdict or reward is issued.
function resolveForestRepeatedRound(args){
    if(!args||typeof args!=='object'||Array.isArray(args)||
       !Object.hasOwn(args,'currentState')||!args.currentState){invalid('prior state required');}
    const {currentState,...sources}=args;
    return resolveForestRoundArithmetic(sources,currentState);
}
// Captures only samples consumed by the shared loop, including dead skips.
function sampleForestRepeatedRound(args,random){
    if(typeof random!=='function'||!args?.currentState)invalid('server sampler and prior state required');
    const {currentState,...sources}=args;
    if(Object.hasOwn(sources,'randomTape'))invalid('sampler does not accept a transcript');
    return resolveForestRoundArithmetic({...sources,randomTape:[]},currentState,random);
}
module.exports={resolveForestOpeningRound,resolveForestRepeatedRound,sampleForestRepeatedRound};
