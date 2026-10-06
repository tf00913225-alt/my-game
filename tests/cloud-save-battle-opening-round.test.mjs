import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {buildForestOpeningRoundRules,OPENING_RULES_PATH,OPENING_POLICY_PATH} from '../scripts/lib/cloud-battle-opening-round-rules.mjs';
const require=createRequire(import.meta.url);
const {resolveForestOpeningRound:resolve,resolveForestRepeatedRound:repeat}=require('../functions/src/canonical-battle-opening-round');
const {resolvePlainPlayerNormalAttack:playerAttack}=require('../functions/src/canonical-battle-normal-attack');
const {makeInitialCharacterSources}=require('../functions/src/initial-character-sources');
const {assembleCanonicalSnapshot,claimRecordsDigest:digest}=require('../functions/src/canonical-snapshot');
const {createRecoveryArchive}=require('../functions/src/canonical-recovery-archive');
const catalog=require('../functions/src/generated/battle-encounter-catalog.json');
const playerPolicy=require('../functions/src/generated/plain-player-normal-attack-policy.json');
const openingPolicy=require('../functions/src/generated/forest-opening-round-policy.json');
const main=fs.readFileSync('js/00-main.js','utf8');
function input({element='fire',level=1,agility=0,hp=100,key='wild.zone-01.fire-01',mutate=()=>{}}={}){
  const uid='opening-round-user',revision=2;
  const records=makeInitialCharacterSources(uid,revision,'opening-source-0001',{
    displayName:'回合英雄',element,gender:'male',
    attributes:{attack:10,intelligence:0,vitality:0,energy:0,defensePoints:0,agility:0}});
  records.characters[0].state.level=level;records.characters[0].state.agility=agility;records.characters[0].state.hp=hp;mutate(records);
  const snapshot=assembleCanonicalSnapshot(uid,revision,records);
  return {uid,revision,snapshot,archive:createRecoveryArchive(uid,revision,records,snapshot),
    encounterPolicy:structuredClone(catalog),encounterKey:key};
}
// Independent bracket-aware browser extraction, not the production generator.
function extract(name){
  const start=main.indexOf('function '+name+'('),opening=main.indexOf('{',start);
  assert.ok(start>=0);let depth=0,quote=null,escaped=false,line=false,block=false;
  for(let i=opening;i<main.length;i++){
    const c=main[i],next=main[i+1];
    if(line){if(c==='\n')line=false;continue;}
    if(block){if(c==='*'&&next==='/'){block=false;i++;}continue;}
    if(quote){if(escaped){escaped=false;continue;}if(c==='\\'){escaped=true;continue;}if(c===quote)quote=null;continue;}
    if(c==='/'&&next==='/'){line=true;i++;continue;}
    if(c==='/'&&next==='*'){block=true;i++;continue;}
    if(['"',"'",'`'].includes(c)){quote=c;continue;}
    if(c==='{')depth++;
    if(c==='}'&&--depth===0)return main.slice(start,i+1);
  }
  throw Error('unterminated '+name);
}
function oracle(args,tape){
  const character=structuredClone(args.archive.sourceRecords.characters[0].state);
  if(args.currentState)character.hp=args.currentState.playerHP;
  const definition=args.encounterPolicy.entries[args.encounterKey];
  const enemy={...definition.stats,level:definition.spec.level,element:definition.spec.element,alive:true,canAct:true};
  const {currentState,...sources}=args;
  const stats=playerAttack({...sources,randomTape:[0.999999999999]}).playerStats;
  let cursor=0;
  const randomMath=Object.assign(Object.create(Math),{random:()=>tape[cursor++]});
  const context=vm.createContext({Math:randomMath,combatEventObservers:new Map(),player:character,currentBattleMonsters:[0],monsters:[enemy],
    getExistingPartyIndexes:()=>[0],getPartyCharacterByIndex:()=>character,
    getPartyBattleStats:()=>stats,getPartyCharacterIndex:e=>e===character?0:-1,
    getLearnedElementEX:()=>null,getMonsterDebuffValue:()=>0,getStatDownPercentFor:()=>0});
  const functions=['buildInitiativeQueue','getMonsterAgility','getMonsterAccuracy',
    'calculateHitChancePercent','rollHitChance','emitCombatEvent','rollBeginnerForestNormalAttackDamage'];
  const constants=['BEGINNER_FOREST_NORMAL_DAMAGE_MIN','BEGINNER_FOREST_NORMAL_DAMAGE_MAX',
    'HIT_CHANCE_BASE','HIT_CHANCE_MIN_PERCENT','HIT_CHANCE_MAX_PERCENT'];
  vm.runInContext([...constants.map(n=>main.match(new RegExp('^const '+n+'\\s*=\\s*[\\s\\S]*?;','m'))[0]),
    ...functions.map(extract)].join('\n'),context);
  context.window=context;
  for(const file of ['js/40-v144-rules-and-abyss.js','js/47-v158-combat-tuning.js']){
    vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});
  }
  const queue=JSON.parse(JSON.stringify(context.buildInitiativeQueue()));
  let playerHP=character.hp,enemyHP=currentState?currentState.enemyHP:enemy.maxHP;const actions=[];
  for(const {type} of queue){
    if(playerHP===0||enemyHP===0){actions.push({actor:type,skipped:true,reason:'combatant-dead'});continue;}
    const start=cursor,hpBefore=type==='player'?enemyHP:playerHP;
    let hit,isCrit=false,damage=0;
    if(type==='player'){
      hit=tape[cursor++]<0.95;
      const samples=hit?tape.slice(cursor-1,cursor+2):[tape[cursor-1]];
      const result=playerAttack({...sources,randomTape:samples});
      cursor+=hit?2:0;({hit,isCrit,damage}=result);enemyHP=Math.max(0,enemyHP-damage);
    }else{
      hit=context.rollHitChance(context.getMonsterAccuracy(enemy),stats.evasion,0,0,character);
      if(hit)damage=context.rollBeginnerForestNormalAttackDamage();
      playerHP=Math.max(0,playerHP-damage);
    }
    actions.push({actor:type,skipped:false,hit,isCrit,damage,hpBefore,
      hpAfter:type==='player'?enemyHP:playerHP,randomSamplesConsumed:cursor-start});
  }
  return {queue,actions,playerHP,enemyHP,cursor};
}
function vector(args,tape=[0,0.9,0.5,0.5,0.5,0.5,0.5]){
  const expected=oracle(args,tape);
  return {...args,randomTape:tape.slice(0,expected.cursor)};
}
test('generated initiative/hit/tutorial declarations and policy match their exact source',()=>{
  const built=buildForestOpeningRoundRules(process.cwd());
  assert.equal(fs.readFileSync(OPENING_RULES_PATH,'utf8'),built.code);
  assert.equal(fs.readFileSync(OPENING_POLICY_PATH,'utf8'),JSON.stringify(built.policy,null,2)+'\n');
  assert.deepEqual(openingPolicy,built.policy);
});
test('opening round matches browser owners across elements, levels, enemies and initiative',()=>{
  let cases=0;
  for(const element of ['fire','water','wind','earth'])for(const level of [1,10,100]){
    for(const key of Object.keys(catalog.entries))for(const agility of [0,20]){
      for(const tape of [Array(7).fill(0.5),Array(7).fill(0.999999)]){
        const args=input({element,level,key,agility}),expected=oracle(args,tape),actual=resolve(vector(args,tape));
        assert.deepEqual(actual.initiative,expected.queue);assert.deepEqual(actual.actions,expected.actions);
        assert.equal(actual.playerHPAfter,expected.playerHP);assert.equal(actual.enemyHPAfter,expected.enemyHP);
        assert.equal(actual.randomSamplesConsumed,expected.cursor);cases++;
      }
    }
  }
  assert.equal(cases,96);
});
test('fast lethal player attack skips enemy action and consumes no retaliation entropy',()=>{
  const args=vector(input({agility:20})),result=resolve(args);
  assert.equal(result.initiative[0].type,'player');assert.equal(result.enemyHPAfter,0);
  assert.equal(result.playerHPAfter,100);assert.deepEqual(result.actions[1],{actor:'monster',skipped:true,reason:'combatant-dead'});
  assert.equal(result.randomSamplesConsumed,5);
});
test('fast enemy lethal attack skips dead player and never samples player critical/damage',()=>{
  const args=vector(input({hp:1})),result=resolve(args);
  assert.equal(result.initiative[0].type,'monster');assert.equal(result.playerHPAfter,0);
  assert.equal(result.enemyHPAfter,result.enemyHPBefore);
  assert.deepEqual(result.actions[1],{actor:'player',skipped:true,reason:'combatant-dead'});
  assert.equal(result.randomSamplesConsumed,4);
});
test('final tutorial enemy damage covers 5 through 8, never critical, independent of elements',()=>{
  for(const element of ['fire','water','wind','earth'])for(let n=0;n<4;n++){
    const tape=[0,0.9,0.5,(n+0.1)/4,0.95];
    const result=resolve({...input({element}),randomTape:tape});
    assert.equal(result.actions[0].actor,'monster');assert.equal(result.actions[0].damage,5+n);
    assert.equal(result.actions[0].isCrit,false);assert.equal(result.actions[1].hit,false);
  }
});
test('enemy MISS uses exactly one sample, player MISS uses exactly one sample',()=>{
  const result=resolve({...input(),randomTape:[0.5,0.5,0.95,0.95]});
  assert.equal(result.actions.every(a=>!a.hit&&a.damage===0),true);
  assert.equal(result.playerHPAfter,100);assert.equal(result.enemyHPAfter,result.enemyHPBefore);
});
test('equal agility follows the actual two-actor random comparator in both directions',()=>{
  const base=input();const enemyAgility=base.encounterPolicy.entries[base.encounterKey].stats.agility;
  // A self-consistent internal policy is a pure-input fixture, never authority proof.
  base.encounterPolicy.entries[base.encounterKey].stats.agility=playerAttack({...base,randomTape:[0.999999999999]}).playerStats.agility;
  const {sha256,...body}=base.encounterPolicy;base.encounterPolicy.sha256=digest(body);
  const orders=[];
  for(const pair of [[0,0.999999],[0.999999,0]]){
    const args=vector(base,[...pair,0.95,0.95,0.5,0.5,0.5]);
    orders.push(resolve(args).initiative[0].type);
  }
  assert.equal(new Set(orders).size,2);assert.ok(enemyAgility>=0);
});
test('deterministic projection/digest cannot mutate source or award authority',()=>{
  const args=vector(input()),before=structuredClone(args),saved=Math.random;
  try{Math.random=()=>{throw Error('ambient RNG');};const result=resolve(args);
    assert.deepEqual(resolve(args),result);assert.deepEqual(args,before);
    assert.equal(result.playerRulesPolicySha256,digest(playerPolicy));
    const {sha256,...body}=result;assert.equal(sha256,digest(body));
    for(const key of ['combatRulesReady','outcomeVerified','rewardEligible','creditedToCharacter'])assert.equal(result[key],false);
  }finally{Math.random=saved;}
});
test('missing/extra/non-numeric entropy and client outcome fields fail closed',()=>{
  const args=vector(input());
  for(const tape of [[],[0,0],args.randomTape.slice(0,-1),[...args.randomTape,0],
    [NaN,0,0],[1,0,0],[-1,0,0],['0',0,0],Array(8).fill(0),null])assert.throws(()=>resolve({...args,randomTape:tape}));
  for(const field of ['won','hpAfter','stats','reward','actions','round','seed'])assert.throws(()=>resolve({...args,[field]:true}));
});
test('existing admission blocks foreign/malformed sources, skills, effects and modifiers',()=>{
  for(const mutate of [r=>{r.characters[0].skillLoadout.skillLevels.fireEX=1;},
    r=>{r.characters[0].state.isDefending=true;},r=>{r.characters[0].state.hp=0;},
    r=>{r.characters[0].state.activeBuffs=[{type:'rage'}];}]){
    assert.throws(()=>resolve({...input({mutate}),randomTape:Array(7).fill(0.5)}));
  }
  const args=vector(input());
  for(const mutate of [a=>a.uid='foreign',a=>a.revision=3,
    a=>a.archive.sourceSha256='0'.repeat(64),a=>a.encounterKey='__proto__',
    a=>a.encounterPolicy.entries[a.encounterKey].stats.defense=999]){
    const changed=structuredClone(args);mutate(changed);assert.throws(()=>resolve(changed));
  }
});
test('opening projection has no callable, persistence, ambient entropy or reward integration',()=>{
  const source=fs.readFileSync('functions/src/canonical-battle-opening-round.js','utf8');
  assert.doesNotMatch(source,/onCall\(|tx\.(create|set|update)|Math\.random\(|randomBytes\(/);
  assert.doesNotMatch(fs.readFileSync('functions/index.js','utf8'),/resolveForestOpeningRound/);
});

function initialRoundState(args){
  const state=args.archive.sourceRecords.characters[0].state;
  const enemy=args.encounterPolicy.entries[args.encounterKey].stats;
  return {round:0,roundVersion:0,playerHP:state.hp,playerSP:state.sp,enemyHP:enemy.maxHP,enemySP:enemy.maxSP};
}
test('shared repeated-round owner matches final browser arithmetic across carried HP and repeated initiative',()=>{
  let cases=0;
  for(const element of ['fire','water','wind','earth'])for(const key of Object.keys(catalog.entries)){
    for(const agility of [0,20]){
      const sources=input({element,key,agility});let state=initialRoundState(sources);
      // Misses retain enemy HP; enemy hits carry decreasing player HP. Each
      // round rerolls initiative, then the last round permits lethal damage.
      for(let round=0;round<4;round++){
        const tape=round<3?[0,0.9,0.999999,0.5,0.5,0.5,0.5]:Array(7).fill(0.5);
        // Player first: MISS then enemy hit. Enemy first: hit then player MISS.
        if(round<3&&agility===0){tape[2]=0.5;tape[3]=0.5;tape[4]=0.999999;}
        const args={...sources,currentState:state},expected=oracle(args,tape);
        const request=vector(args,tape),before=structuredClone(request),actual=repeat(request);
        assert.deepEqual(actual.initiative,expected.queue);assert.deepEqual(actual.actions,expected.actions);
        assert.equal(actual.playerHPBefore,state.playerHP);assert.equal(actual.enemyHPBefore,state.enemyHP);
        assert.deepEqual(actual.nextState,{...state,round:round+1,roundVersion:round+1,
          playerHP:expected.playerHP,enemyHP:expected.enemyHP});
        assert.equal(actual.priorStateSha256,digest(state));assert.equal(actual.nextStateSha256,digest(actual.nextState));
        const {sha256,...body}=actual;assert.equal(sha256,digest(body));
        assert.deepEqual(request,before);assert.deepEqual(repeat(request),actual);
        for(const flag of ['combatRulesReady','outcomeVerified','rewardEligible','creditedToCharacter'])assert.equal(actual[flag],false);
        state=actual.nextState;cases++;
        if(!state.playerHP||!state.enemyHP){assert.throws(()=>repeat({...sources,currentState:state,randomTape:[0,0,0.95,0.95]}));break;}
      }
    }
  }
  assert.equal(cases,64);
});
test('first shared round preserves original opening fields and digest after removing successor metadata',()=>{
  for(const agility of [0,20]){
    const sources=input({agility}),request=vector(sources),opening=resolve(request);
    const repeated=repeat({...request,currentState:initialRoundState(sources)});
    const {priorState,priorStateSha256,nextState,nextStateSha256,restrictedPolicySha256,sha256,...body}=repeated;
    body.kind='forest-opening-round-arithmetic';
    assert.deepEqual({...body,sha256:digest(body)},opening);
  }
});
test('later lethal retaliation skips the dead player without spending its entropy',()=>{
  const sources=input(),currentState={...initialRoundState(sources),round:7,roundVersion:7,playerHP:1,enemyHP:1};
  const actual=repeat({...sources,currentState,randomTape:[0,0.9,0.5,0.5]});
  assert.equal(actual.nextState.playerHP,0);assert.equal(actual.nextState.enemyHP,1);
  assert.deepEqual(actual.actions[1],{actor:'player',skipped:true,reason:'combatant-dead'});
  assert.equal(actual.randomSamplesConsumed,4);
});
test('prior state cannot resurrect, heal, change SP, overflow versions or admit unknown fields',()=>{
  const sources=input(),state=initialRoundState(sources),base={...sources,currentState:state,randomTape:[0.5,0.5,0.95,0.95]};
  for(const change of [{round:-1},{round:1.5,roundVersion:1.5},{round:Number.MAX_SAFE_INTEGER,roundVersion:Number.MAX_SAFE_INTEGER},
    {roundVersion:1},{playerHP:0},{enemyHP:0},{playerHP:state.playerHP+1},{enemyHP:state.enemyHP+1},
    {playerHP:state.playerHP-1},{enemyHP:state.enemyHP-1},{playerSP:state.playerSP-1},{enemySP:state.enemySP+1},
    {won:true},{status:'VICTORY'}])assert.throws(()=>repeat({...base,currentState:{...state,...change}}));
  for(const currentState of [null,[],{},false])assert.throws(()=>repeat({...base,currentState}));
  for(const randomTape of [[0,0], [0.5,0.5,0.95], [0.5,0.5,0.95,0.95,0], [NaN,0,0.95,0.95]]){
    assert.throws(()=>repeat({...base,randomTape}));
  }
  assert.throws(()=>repeat({...base,action:{type:'skill'}}));
  const unbound=structuredClone(base);unbound.encounterPolicy.entries[unbound.encounterKey].spec.level++;
  const {sha256,...body}=unbound.encounterPolicy;unbound.encounterPolicy.sha256=digest(body);
  assert.throws(()=>repeat(unbound),/certified/);
});
