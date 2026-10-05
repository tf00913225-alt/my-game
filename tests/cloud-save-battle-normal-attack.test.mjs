import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {buildPlainPlayerNormalAttackRules,RULES_PATH,POLICY_PATH} from '../scripts/lib/cloud-battle-normal-attack-rules.mjs';
const require=createRequire(import.meta.url);
const {resolvePlainPlayerNormalAttack:resolve}=require('../functions/src/canonical-battle-normal-attack');
const {makeInitialCharacterSources}=require('../functions/src/initial-character-sources');
const {assembleCanonicalSnapshot,claimRecordsDigest}=require('../functions/src/canonical-snapshot');
const {createRecoveryArchive}=require('../functions/src/canonical-recovery-archive');
const catalog=require('../functions/src/generated/battle-encounter-catalog.json');
const policy=require('../functions/src/generated/plain-player-normal-attack-policy.json');
const main=fs.readFileSync('js/00-main.js','utf8');
const uid='normal-attack-rule-user';
function input(element='fire',level=1,randomTape=[0.5,0.5,0.5],mutate=()=>{}){
  const records=makeInitialCharacterSources(uid,2,'normal-attack-source-0001',{
    displayName:'規則英雄',element,gender:'male',
    attributes:{attack:10,intelligence:0,vitality:0,energy:0,defensePoints:0,agility:0}});
  records.characters[0].state.level=level;mutate(records);
  const snapshot=assembleCanonicalSnapshot(uid,2,records);
  return {uid,revision:2,snapshot,archive:createRecoveryArchive(uid,2,records,snapshot),
    encounterPolicy:structuredClone(catalog),encounterKey:'wild.zone-01.fire-01',randomTape};
}


// Independent bracket-aware extraction from the browser source. Load the
// actual late skill wrappers too: the plain admitted case must still match.
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
function browser(state,tape,definition){
  let cursor=0;
  const randomMath=Object.assign(Object.create(Math),{random:()=>tape[cursor++]});
  const context=vm.createContext({player:structuredClone(state),player2:null,player3:null,
    Math:randomMath,console,skillDatabase:{},characterEquipment:{},
    castBuffSkill(){},castDamageSkill(){},castSecondaryCharacterSkill(){},castPlayer2Skill(){},
    processSingleMonsterAttack(){},hasActiveBuff:()=>false,
    getStatDownPercentFor:()=>0,getMonsterDebuffValue:()=>0,getSkillLevel:()=>0,
    getEquipmentBonus:()=>({}),getActiveBuffPercent:()=>0,getPlayerDefenseDownPercent:()=>0,
    getFrostbiteFinalPercentPointPenalty:()=>0,combineEvasionRates:()=>0,
    getPartyCharacterIndex:e=>e===context.player?0:-1,
    getPartyBattleStats:()=>context.getMainCharacterStats(),battleStatisticsRecordCriticalByActor:()=>{}});
  context.window=context;
  const declarations=Object.keys(policy.declarationDigests).map(name=>name.startsWith('get')||name.startsWith('calculate')||name.startsWith('isParty')||name==='rollCritical'
    ?extract(name):main.match(new RegExp('^const '+name+'\\s*=\\s*[\\s\\S]*?;','m'))[0]);
  declarations.push(...['getMainCharacterStats','getRelicFinalEvasionPercent','getCharacterSkillKey','getLearnedElementEX','getWindEXFinalEvasionBonusPercent'].map(extract));
  vm.runInContext(declarations.join('\n'),context);
  for(const file of ['js/33-v140-four-element-balance.js','js/43-v149-skill-ui-rules.js',
    'js/44-v152-dev-fixes.js','js/60-v173.64-skill-progression-rebalance.js']){
    vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});
  }
  const enemy={...definition.stats,level:definition.spec.level,element:definition.spec.element};
  const stats=context.getMainCharacterStats();
  const hit=randomMath.random()*100<context.calculateHitChancePercent(stats.accuracy,enemy.evasion,0,0);
  const critical=hit?context.rollCritical(context.player,'physical',enemy.antiCrit,enemy):{isCrit:false,multiplier:1};
  const damage=hit?context.calculateDamage(stats.attack,enemy.defense,state.level,enemy.level,state.element,enemy.element,
    {attacker:context.player,target:enemy,critMultiplier:critical.multiplier}):0;
  return {stats:JSON.parse(JSON.stringify(stats)),hit,isCrit:critical.isCrit,damage,cursor};
}
test('exact generated declarations/code/policy stay tied to the current browser owners',()=>{
  const built=buildPlainPlayerNormalAttackRules(process.cwd());
  assert.equal(fs.readFileSync(RULES_PATH,'utf8'),built.code);
  assert.deepEqual(policy,built.policy);
  assert.equal(fs.readFileSync(POLICY_PATH,'utf8'),JSON.stringify(policy,null,2)+'\n');
  assert.equal(policy.combatRulesReady,false);assert.equal(policy.outcomeVerified,false);
});
test('known plain vector resolves hit/crit/damage/HP and deterministic digest with zero source mutation',()=>{
  const args=input(),before=structuredClone(args),result=resolve(args);
  assert.equal(result.playerStats.attack,74);assert.equal(result.playerStats.defense,33);
  assert.equal(result.playerStats.magicAttack,34);assert.equal(result.playerStats.accuracy,0);
  assert.equal(result.damage,66);assert.equal(result.hpBefore,64);assert.equal(result.hpAfter,0);
  assert.equal(result.hit,true);assert.equal(result.isCrit,false);assert.equal(result.randomSamplesConsumed,3);
  assert.deepEqual(resolve(args),result);assert.deepEqual(args,before);
  for(const flag of ['combatRulesReady','outcomeVerified','rewardEligible','creditedToCharacter'])assert.equal(result[flag],false);
  const {sha256,...body}=result;assert.equal(sha256,claimRecordsDigest(body));
});
test('four elements/levels/enemies and threshold tapes match browser AFTER actual late wrappers',()=>{
  let cases=0;
  for(const element of ['fire','water','wind','earth'])for(const level of [1,10,50,100]){
    for(const key of Object.keys(catalog.entries))for(const tape of [[0.949999,0.099999,0],[0.5,0.10,0.5],[0.5,0.5,0.999999],[0.95]]){
      const args=input(element,level,tape);args.encounterKey=key;
      const actual=resolve(args),expected=browser(args.archive.sourceRecords.characters[0].state,tape,catalog.entries[key]);
      assert.deepEqual(actual.playerStats,expected.stats);
      assert.equal(actual.hit,expected.hit);assert.equal(actual.isCrit,expected.isCrit);
      assert.equal(actual.damage,expected.damage);assert.equal(actual.randomSamplesConsumed,expected.cursor);cases++;
    }
  }
  assert.equal(cases,128);
});
test('MISS consumes only hit sample, never damages or accepts hidden extra samples',()=>{
  const args=input('fire',1,[0.95]),result=resolve(args);
  assert.equal(result.hit,false);assert.equal(result.isCrit,false);assert.equal(result.damage,0);
  assert.equal(result.hpAfter,64);assert.equal(result.randomSamplesConsumed,1);
  assert.throws(()=>resolve({...args,randomTape:[0.95,0,0]}),/unused random/);
  assert.throws(()=>resolve({...args,randomTape:[0.5]}),/exhausted/);
});
test('no ambient random, and result data cannot mutate input source/tape',()=>{
  const args=input(),saved=Math.random;
  try{Math.random=()=>{throw Error('ambient RNG used');};const result=resolve(args);
    result.playerStats.attack=999;result.randomTape[0]=0;
    assert.equal(resolve(args).playerStats.attack,74);assert.equal(args.randomTape[0],0.5);
  }finally{Math.random=saved;}
});
for(const [label,mutate] of Object.entries({
  learned:r=>{r.characters[0].skillLoadout.skillLevels.fireEX=1;},
  carried:r=>{r.characters[0].skillLoadout.equippedSkills=['flameSlash'];},
  buff:r=>{r.characters[0].state.activeBuffs=[{type:'rage',bonusPercent:30}];},
  debuff:r=>{r.characters[0].state.statusEffects=[{type:'statDown',turnsLeft:2}];},
  defending:r=>{r.characters[0].state.isDefending=true;},
  dead:r=>{r.characters[0].state.hp=0;},
  invalidHP:r=>{r.characters[0].state.hp=101;},
  invalidSP:r=>{r.characters[0].state.sp=51;},
  unknownModifier:r=>{r.characters[0].state.criticalChance=99;},
  legacy:r=>{r.characters[0].state.spirit=1;},
  bonusHP:r=>{r.characters[0].state.bonusHP=10;},
  negativeStat:r=>{r.characters[0].state.attack=-1;},
  unsafeStat:r=>{r.characters[0].state.attack=Number.MAX_SAFE_INTEGER;},
  invalidLevel:r=>{r.characters[0].state.level=101;},
  bag:r=>{r.inventory=[{...r.account,ownedItemId:'bag-item',location:'bag',state:{id:'potion',count:1}}];}
}))test(`unsupported ${label} cannot silently use plain formulas`,()=>{
  const args=input('fire',1,[0.5,0.5,0.5],mutate),before=structuredClone(args);
  assert.throws(()=>resolve(args));assert.deepEqual(args,before);
});
test('UID/revision/corrupt archive/snapshot/policy/unknown enemy never produce a projection',()=>{
  for(const mutate of [a=>a.uid='foreign',a=>a.revision=3,a=>a.archive.sourceSha256='0'.repeat(64),
    a=>a.snapshot.snapshot.characters[0].state.attack=999,a=>a.encounterPolicy.entries[a.encounterKey].stats.defense=999,
    a=>a.encounterKey='__proto__',a=>a.encounterKey='wild.zone-02.fire-01']){
    const args=input();mutate(args);assert.throws(()=>resolve(args));
  }
});
test('unsupported enemy metadata remains blocked even when the input policy hash is self consistent',()=>{
  for(const mutate of [d=>d.stats.vBossShield=1,d=>d.spec.rank='elite',d=>d.spec.mode='tower',
    d=>d.spec.level=0,d=>d.stats.defense=NaN,d=>d.finalDamagePressure=1.1]){
    const args=input();mutate(args.encounterPolicy.entries[args.encounterKey]);
    const {sha256,...body}=args.encounterPolicy;args.encounterPolicy.sha256=claimRecordsDigest(body);
    assert.throws(()=>resolve(args));
  }
});
test('bounded exact random transcript and strict internal arguments reject browser result/reward fields',()=>{
  for(const tape of [[],[0,0],[0,0,0,0],[NaN,0,0],[Infinity,0,0],[-0.01,0,0],[1,0,0],['0',0,0],null]){
    assert.throws(()=>resolve({...input(),randomTape:tape}));
  }
  for(const field of ['won','gold','damage','hpAfter','seed','stats','rewardEligible']){
    assert.throws(()=>resolve({...input(),[field]:true}));
  }
});
test('the kernel has no callable/gameplay hook, stored verdict or authority writer',()=>{
  const source=fs.readFileSync('functions/src/canonical-battle-normal-attack.js','utf8');
  assert.doesNotMatch(source,/onCall\(|tx\.(create|update|set)|Math\.random\(|randomBytes\(/);
  assert.doesNotMatch(fs.readFileSync('functions/index.js','utf8'),/resolvePlainPlayerNormalAttack/);
});
