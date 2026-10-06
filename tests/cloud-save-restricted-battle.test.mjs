import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {buildRestrictedBattlePolicy,RESTRICTED_POLICY_PATH} from '../scripts/lib/cloud-restricted-battle-policy.mjs';
const require=createRequire(import.meta.url);
const {createCanonicalRestrictedBattle}=require('../functions/src/canonical-restricted-battle');
const {createCanonicalBattleAttempt}=require('../functions/src/canonical-battle-attempt');
const {createCanonicalBattleEncounter}=require('../functions/src/canonical-battle-encounter');
const {makeInitialCharacterSources}=require('../functions/src/initial-character-sources');
const {assembleCanonicalSnapshot,claimRecordsDigest:digest}=require('../functions/src/canonical-snapshot');
const {createRecoveryArchive}=require('../functions/src/canonical-recovery-archive');
const uid='restricted-instance-user',attemptId='restricted-preparation-0001',operationId='restricted-instance-0001';
const sessionId='s'.repeat(32);
function fixture({mutate=()=>{},retry=false,sentinel=false,entropy=.999999,enemy='wild.zone-01.fire-01'}={}){
  const records=makeInitialCharacterSources(uid,2,'restricted-initial-source-0001',{
    displayName:'場次英雄',element:'fire',gender:'male',
    attributes:{attack:10,intelligence:0,vitality:0,energy:0,defensePoints:0,agility:0}});
  mutate(records);
  const snapshot=assembleCanonicalSnapshot(uid,2,records),root=`serverUsers/${uid}`;
  const data=new Map([[`${root}/account/current`,{...records.account,snapshotSha256:snapshot.sha256}],
    [`${root}/playableSnapshots/2`,snapshot],[`${root}/recoveryArchives/2`,createRecoveryArchive(uid,2,records,snapshot)],
    [`users/${uid}/saves/current`,{serverRevision:2,authoritativeStateReady:false}]]);
  const collection=p=>({doc:id=>({path:`${p}/${id}`,collection:n=>collection(`${p}/${id}/${n}`)})});
  let clock=1000,writes=0,entropyCalls=0,clockReads=0,expireOnRead=0,abort=false,active=sessionId;
  class HttpsError extends Error{constructor(code,message){super(message);this.code=code;}}
  const deps={db:{collection},FieldValue:{serverTimestamp:()=>sentinel?{serverTransform:true}:{toMillis:()=>123}},HttpsError,now:()=>{clockReads++;if(expireOnRead===clockReads)clock=601000;return clock;},randomBytes:n=>{entropyCalls++;const b=Buffer.alloc(n);
      for(let i=0;i<n;i+=6)b.writeUIntBE(Math.floor((Array.isArray(entropy)?entropy[i/6]:entropy)*281474976710656),i,6);return b;},
    inspectExistingEnvelope:v=>({kind:'current',data:v,serverRevision:v.serverRevision}),
    runProtected:async(request,fn)=>{
      if(request.data.uid!==uid)throw new HttpsError('permission-denied','wrong UID');
      const call=async()=>{const pending=[];
        const tx={get:async ref=>({exists:data.has(ref.path),data:()=>data.get(ref.path)}),
          create:(ref,v)=>{assert.equal(data.has(ref.path),false);const {createdAt,...body}=v;
            pending.push([ref.path,{...structuredClone(body),createdAt}]);},
          update:(ref,v)=>{assert.equal(data.has(ref.path),true);pending.push([ref.path,{...data.get(ref.path),...structuredClone(v)}]);}};
        const result=await fn(tx,{uid,sessionId:active});return {pending,result};};
      if(retry)await call();
      const {pending,result}=await call();if(abort)throw Error('interrupted instance transaction');
      for(const [p,v] of pending)data.set(p,v.createdAt?.serverTransform?{...v,createdAt:{toMillis:()=>123}}:v);writes+=pending.length;return result;
    }};
  const owner=createCanonicalRestrictedBattle(deps),request={data:{uid,session:{}}};
  const args={attemptId,operationId,expectedRevision:2};
  return {data,root,records,snapshot,args,request,owner,newOwner:()=>createCanonicalRestrictedBattle(deps),get writes(){return writes;},get entropyCalls(){return entropyCalls;},
    set clock(v){clock=v;},set expireOnRead(v){expireOnRead=v;clockReads=0;},set abort(v){abort=v;},set session(v){active=v;},
    seed:async()=>{await createCanonicalBattleAttempt(deps).begin(request,{operationId:attemptId,expectedRevision:2});
      clock=1001;await createCanonicalBattleEncounter(deps).seal(request,{attemptId,
        operationId:'restricted-encounter-0001',expectedRevision:2,encounterKey:enemy});clock=1002;},
    begin:(extra={},req=request)=>owner.begin(req,{...args,...extra}),
    battle:()=>data.get(`${root}/restrictedBattles/${attemptId}`)};
}
test('restricted policy executes actual native skill owners and binds generated output',()=>{
  const built=buildRestrictedBattlePolicy(process.cwd());
  assert.equal(fs.readFileSync(RESTRICTED_POLICY_PATH,'utf8'),JSON.stringify(built,null,2)+'\n');
  assert.equal(Object.keys(built.entries).length,2);
  for(const e of Object.values(built.entries))assert.deepEqual([e.attackSkills,e.supportSkills,e.skillChance],[[],[],0]);
  assert.equal(built.lifecycle.acceptsRoundSubmission,false);
});
for(const enemy of ['wild.zone-01.fire-01','wild.zone-01.water-01']){
  test(`protected ${enemy} instance pins original sources, resources and policy without authority writes`,async()=>{
    const h=fixture({enemy});await h.seed();const before=[...h.data];
    const result=await h.begin(),b=h.battle();assert.equal(h.writes,11);
    assert.equal(b.initialState.player.hp,h.records.characters[0].state.hp);
    assert.equal(b.initialState.player.sp,h.records.characters[0].state.sp);
    const pinned=h.data.get(`${h.root}/restrictedBattlePolicies/${b.policySha256}`);
    assert.equal(b.initialState.enemy.hp,pinned.bundle.encounter.entries[enemy].stats.maxHP);
    assert.equal(b.initialState.enemy.sp,pinned.bundle.encounter.entries[enemy].stats.maxSP);
    assert.equal(b.policySha256,digest(pinned.bundle));
    assert.deepEqual([b.initialState.status,b.initialState.round,b.initialState.roundVersion],['PREPARED',0,0]);
    for(const flag of ['combatRulesReady','outcomeVerified','rewardEligible','creditedToCharacter']){
      assert.equal(b[flag],false);assert.equal(result[flag],false);
    }
    assert.equal(result.initialState,undefined);assert.equal(result.randomTape,undefined);
    for(const [p,v] of before)assert.deepEqual(h.data.get(p),v);
    assert.deepEqual(await h.begin(),{...result,unchanged:true});assert.equal(h.writes,11);
    assert.equal(typeof h.owner.advance,'function');assert.equal(h.owner.complete,undefined);
  });
}
test('transaction retries and interrupted commits cannot produce partial instance evidence',async()=>{
  const h=fixture({retry:true});await h.seed();const before=[...h.data];h.abort=true;
  await assert.rejects(h.begin(),/interrupted instance/);assert.deepEqual([...h.data],before);
  h.abort=false;await h.begin();assert.equal(h.writes,11);assert.equal(h.data.size,before.length+4);
});
test('one instance per preparation, including primary record and consumption marker loss',async()=>{
  const h=fixture();await h.seed();await h.begin();
  await assert.rejects(h.begin({operationId:'restricted-instance-0002'}),e=>e.code==='already-exists');
  h.data.delete(`${h.root}/restrictedBattleAttempts/${attemptId}`);
  await assert.rejects(h.begin({operationId:'restricted-instance-0002'}),e=>e.code==='already-exists');
  await assert.rejects(h.begin(),e=>e.code==='data-loss');assert.equal(h.writes,11);
});
for(const collection of ['restrictedBattles','restrictedBattleAttempts','restrictedBattlePolicies','operations']){
  test(`missing ${collection} never regenerates original evidence`,async()=>{
    const h=fixture();await h.seed();const first=await h.begin();
    const key=collection==='restrictedBattlePolicies'?first.policySha256:collection==='operations'?operationId:attemptId;
    h.data.delete(`${h.root}/${collection}/${key}`);
    await assert.rejects(h.begin(),e=>e.code==='data-loss');assert.equal(h.writes,11);
    await assert.rejects(h.begin({operationId:'restricted-instance-0002'}));assert.equal(h.writes,11);
  });
}
for(const [field,value] of Object.entries({ownerUid:'foreign',sourceRevision:3,creationSessionId:'x'.repeat(32),
  snapshotSha256:'0'.repeat(64),attemptSha256:'0'.repeat(64),encounterSha256:'0'.repeat(64),
  policySha256:'0'.repeat(64),preparedAtMs:0,expiresAtMs:9999999,sha256:'0'.repeat(64),
  combatRulesReady:true,outcomeVerified:true,rewardEligible:true,creditedToCharacter:true})){
  test(`tampered instance ${field} is refused`,async()=>{
    const h=fixture();await h.seed();await h.begin();h.battle()[field]=value;
    await assert.rejects(h.begin(),e=>e.code==='data-loss');assert.equal(h.writes,11);
  });
}
test('initial state and pinned policy corruption fail closed',async()=>{
  for(const mutate of [h=>h.battle().initialState.player.hp++,h=>h.battle().initialState.round=1,
    h=>h.data.get(`${h.root}/restrictedBattlePolicies/${h.battle().policySha256}`).bundle.restricted.entries['wild.zone-01.fire-01'].skillChance=.5]){
    const h=fixture();await h.seed();await h.begin();mutate(h);
    await assert.rejects(h.begin(),e=>e.code==='data-loss');assert.equal(h.writes,11);
  }
});
test('new instance requires live expiry and current revision; replay retains original evidence',async()=>{
  const h=fixture();await h.seed();h.clock=601000;
  await assert.rejects(h.begin(),e=>e.code==='failed-precondition');h.clock=1002;
  h.data.get(`${h.root}/account/current`).serverRevision=3;
  h.data.get(`users/${uid}/saves/current`).serverRevision=3;
  await assert.rejects(h.begin(),e=>e.code==='aborted');
  h.data.get(`${h.root}/account/current`).serverRevision=2;
  h.data.get(`users/${uid}/saves/current`).serverRevision=2;
  const first=await h.begin();h.clock=601000;
  h.data.get(`${h.root}/account/current`).serverRevision=3;
  h.data.get(`users/${uid}/saves/current`).serverRevision=3;
  assert.deepEqual(await h.begin(),{...first,unchanged:true,expired:true});
  h.session='x'.repeat(32);await assert.rejects(h.begin(),e=>e.code==='failed-precondition');
});
test('unknown client state/action/entropy/outcome fields and malformed identifiers are refused',async()=>{
  const h=fixture();await h.seed();
  for(const key of ['hp','damage','enemy','randomTape','seed','won','reward','round','action','battleId']){
    await assert.rejects(h.begin({[key]:true}),e=>e.code==='invalid-argument');
    await assert.rejects(h.begin({}, {data:{...h.request.data,[key]:true}}),e=>e.code==='invalid-argument');
  }
  for(const extra of [{operationId:1234567890123456},{attemptId:'short'},{operationId:attemptId},
    {expectedRevision:0},{expectedRevision:2.5}])await assert.rejects(h.begin(extra),e=>e.code==='invalid-argument');
  assert.equal(h.writes,7);
});
test('unsupported skills, effects, defense, bonus resources and dead sources do not establish instances',async()=>{
  for(const mutate of [r=>r.characters[0].skillLoadout.skillLevels.fireEX=1,
    r=>r.characters[0].state.activeBuffs.push({type:'rage'}),r=>r.characters[0].state.isDefending=true,
    r=>r.characters[0].state.bonusHP=1,r=>r.characters[0].state.hp=0]){
    const h=fixture({mutate});await h.seed();await assert.rejects(h.begin(),e=>e.code==='failed-precondition');
    assert.equal(h.writes,7);
  }
});
test('wrong UID, original missing source and operation ID collisions fail before writes',async()=>{
  const h=fixture();await h.seed();
  await assert.rejects(h.begin({}, {data:{uid:'foreign',session:{}}}),e=>e.code==='permission-denied');
  h.data.set(`${h.root}/operations/${operationId}`,{kind:'other'});
  await assert.rejects(h.begin(),e=>e.code==='data-loss');h.data.delete(`${h.root}/operations/${operationId}`);
  h.data.delete(`${h.root}/recoveryArchives/2`);await assert.rejects(h.begin());assert.equal(h.writes,7);
});
test('no callable, gameplay integration, entropy or reward path is exposed',()=>{
  const source=fs.readFileSync('functions/src/canonical-restricted-battle.js','utf8');
  assert.doesNotMatch(source,/onCall\(|tx\.set|Math\.random\(|battleAttackProofs/);
  assert.doesNotMatch(fs.readFileSync('functions/index.js','utf8'),/createCanonicalRestrictedBattle/);
});

const roundArgs=(h,version=0,id='restricted-round-operation-0001')=>({attemptId,operationId:id,
  expectedRevision:2,expectedRoundVersion:version,action:{type:'normal-attack',actor:'player-0',target:'enemy-0'}});
const advance=(h,extra={},req=h.request)=>h.owner.advance(req,{...roundArgs(h),...extra});
async function prepared(options){const h=fixture(options);await h.seed();await h.begin();return h;}

const terminalArgs=(version,id='restricted-terminal-operation-0001')=>({attemptId,operationId:id,
  expectedRevision:2,expectedRoundVersion:version});
async function terminalFixture(options={}){
  const h=await prepared({entropy:.1,...options});
  let version=0;
  do{
    await h.owner.advance(h.request,roundArgs(h,version,'restricted-terminal-round-'+String(++version).padStart(4,'0')));
    const state=h.data.get(h.root+'/restrictedBattleRounds/'+attemptId+'_'+version).projection.nextState;
    if(!state.playerHP||!state.enemyHP)return {h,version,state};
  }while(version<128);
  throw Error('fixture failed to reach terminal resources');
}
for(const lowHP of [false,true])test(`terminal resource closure seals once (${lowHP?'player':'enemy'} dead) without authority`,async()=>{
  const {h,version,state}=await terminalFixture({retry:true,sentinel:true,
    entropy:lowHP?[.1,.1,.99,.1,.1,.1,.1]:.1,mutate:r=>{if(lowHP)r.characters[0].state.hp=1;}});
  const before=[...h.data],writes=h.writes,entropy=h.entropyCalls,args=terminalArgs(version);
  const result=await h.owner.sealTerminal(h.request,args);
  assert.equal(result.resourceStatus,lowHP?'player-dead':'enemy-dead');
  assert.equal(state[lowHP?'playerHP':'enemyHP'],0);assert.equal(h.writes,writes+3);
  assert.equal(h.entropyCalls,entropy);assert.equal(result.projection,undefined);
  assert.deepEqual(await h.owner.sealTerminal(h.request,args),{...result,unchanged:true});
  assert.equal(h.writes,writes+3);
  for(const [p,v] of before)if(!p.includes('/restrictedBattleAttempts/'))assert.deepEqual(h.data.get(p),v);
  for(const flag of ['combatRulesReady','outcomeVerified','rewardEligible','creditedToCharacter'])assert.equal(result[flag],false);
  await assert.rejects(h.owner.sealTerminal(h.request,terminalArgs(version,'restricted-terminal-operation-0002')),e=>e.code==='already-exists');
  await assert.rejects(h.owner.sealTerminal(h.request,{...args,expectedRoundVersion:version+1}),e=>e.code==='failed-precondition');
  await assert.rejects(h.owner.advance(h.request,roundArgs(h,version,'restricted-terminal-after-0001')));
  assert.equal(h.writes,writes+3);
});
test('terminal refuses live resources, uncommitted versions and client verdicts before writes',async()=>{
  const h=await prepared();await advance(h);const writes=h.writes;
  await assert.rejects(h.owner.sealTerminal(h.request,terminalArgs(1)),e=>e.code==='failed-precondition');
  await assert.rejects(h.owner.sealTerminal(h.request,terminalArgs(2)),e=>e.code==='aborted');
  for(const patch of [{expectedRoundVersion:0},{expectedRoundVersion:129},{expectedRevision:0},
    {operationId:attemptId},{winner:'player'},{resourceStatus:'enemy-dead'},{hp:0},{reward:true}]){
    await assert.rejects(h.owner.sealTerminal(h.request,{...terminalArgs(1),...patch}),e=>e.code==='invalid-argument');
  }
  await assert.rejects(h.owner.sealTerminal({data:{...h.request.data,won:true}},terminalArgs(1)),e=>e.code==='invalid-argument');
  assert.equal(h.writes,writes);
});
test('terminal rollback and precommit expiry leave no partial closure',async()=>{
  const {h,version}=await terminalFixture({retry:true}),before=[...h.data],args=terminalArgs(version);
  h.abort=true;await assert.rejects(h.owner.sealTerminal(h.request,args),/interrupted/);
  assert.deepEqual([...h.data],before);h.abort=false;
  h.expireOnRead=2;await assert.rejects(h.owner.sealTerminal(h.request,args),e=>e.code==='failed-precondition');
  assert.deepEqual([...h.data],before);h.expireOnRead=0;h.clock=1003;
  await h.owner.sealTerminal(h.request,args);
});
test('terminal replay preserves historical proof after revision, expiry and deployment drift; Session still binds',async()=>{
  const {h,version}=await terminalFixture(),args=terminalArgs(version);
  h.data.get(h.root+'/account/current').serverRevision=3;
  h.data.get(`users/${uid}/saves/current`).serverRevision=3;
  await assert.rejects(h.owner.sealTerminal(h.request,args),e=>e.code==='aborted');
  h.data.get(h.root+'/account/current').serverRevision=2;
  h.data.get(`users/${uid}/saves/current`).serverRevision=2;
  const result=await h.owner.sealTerminal(h.request,args),writes=h.writes;
  h.clock=601000;h.data.get(h.root+'/account/current').serverRevision=3;
  h.data.get(`users/${uid}/saves/current`).serverRevision=3;
  const policy=require('../functions/src/generated/forest-opening-round-policy.json'),old=policy.rulesSha256;
  policy.rulesSha256='0'.repeat(64);
  try{assert.deepEqual(await h.newOwner().sealTerminal(h.request,args),{...result,unchanged:true,expired:true});}
  finally{policy.rulesSha256=old;}
  h.session='x'.repeat(32);await assert.rejects(h.owner.sealTerminal(h.request,args));
  assert.equal(h.writes,writes);
});
test('missing terminal, receipt, marker or any original chain evidence never regenerates closure',async()=>{
  const {h,version}=await terminalFixture(),args=terminalArgs(version);await h.owner.sealTerminal(h.request,args);
  const writes=h.writes;
  for(const path of [h.root+'/restrictedBattleTerminals/'+attemptId,h.root+'/operations/'+args.operationId,
    h.root+'/restrictedBattles/'+attemptId,h.root+'/restrictedBattleRounds/'+attemptId+'_1',
    h.root+'/restrictedBattlePolicies/'+h.battle().policySha256,h.root+'/recoveryArchives/2']){
    const saved=h.data.get(path);h.data.delete(path);
    await assert.rejects(h.owner.sealTerminal(h.request,args));
    await assert.rejects(h.owner.sealTerminal(h.request,terminalArgs(version,'restricted-terminal-operation-0002')));
    await assert.rejects(advance(h));h.data.set(path,saved);
  }
  const marker=h.data.get(h.root+'/restrictedBattleAttempts/'+attemptId),head=marker.terminalHead;
  delete marker.terminalHead;await assert.rejects(h.owner.sealTerminal(h.request,args),e=>e.code==='data-loss');
  marker.terminalHead=head;
  assert.equal(h.writes,writes);
});
test('terminal tampering of original policy, version, resources, digests, flags and receipts blocks replay',async()=>{
  const {h,version}=await terminalFixture(),args=terminalArgs(version);await h.owner.sealTerminal(h.request,args);
  const path=h.root+'/restrictedBattleTerminals/'+attemptId,t=h.data.get(path),writes=h.writes;
  for(const [key,value] of Object.entries({resourceStatus:'player-dead',roundVersion:version+1,
    roundSha256:'0'.repeat(64),stateSha256:'0'.repeat(64),creationSessionId:'x'.repeat(32),
    sourceRevision:3,sealedAtMs:601000,combatRulesReady:true,outcomeVerified:true,rewardEligible:true,
    creditedToCharacter:true,terminalPolicy:{...t.terminalPolicy,policyId:'unknown'}})){
    h.data.set(path,{...t,[key]:value});
    await assert.rejects(h.owner.sealTerminal(h.request,args),e=>e.code==='data-loss');
  }
  h.data.set(path,t);
  h.data.get(h.root+'/operations/'+args.operationId).terminalSha256='0'.repeat(64);
  await assert.rejects(h.owner.sealTerminal(h.request,args),e=>e.code==='data-loss');assert.equal(h.writes,writes);
});
test('protected rounds pin entropy once across retries, chain committed state, replay and preserve original sources',async()=>{
  const h=await prepared({retry:true}),before=[...h.data],a=roundArgs(h);
  const first=await advance(h);assert.equal(h.entropyCalls,1);assert.equal(first.roundVersion,1);
  assert.equal(first.randomTape,undefined);assert.equal(first.projection,undefined);
  const round=h.data.get(h.root+'/restrictedBattleRounds/'+attemptId+'_1');
  assert.equal(round.projection.randomTape.length,4);assert.equal(round.priorRoundSha256,h.battle().sha256);
  assert.equal(h.writes,14);assert.deepEqual(await advance(h),{...first,unchanged:true});assert.equal(h.writes,14);
  const second=await h.owner.advance(h.request,roundArgs(h,1,'restricted-round-operation-0002'));
  assert.equal(second.roundVersion,2);assert.equal(h.writes,17);
  const r2=h.data.get(h.root+'/restrictedBattleRounds/'+attemptId+'_2');
  assert.equal(r2.priorRoundSha256,round.sha256);assert.deepEqual(r2.projection.priorState,round.projection.nextState);
  assert.deepEqual(await advance(h),{...first,unchanged:true});
  for(const [path,value] of before)if(!path.includes('/restrictedBattleAttempts/'))assert.deepEqual(h.data.get(path),value);
  for(const flag of ['combatRulesReady','outcomeVerified','rewardEligible','creditedToCharacter'])assert.equal(second[flag],false);
});
test('interrupted round commits leave all evidence unchanged and retry commits exactly once',async()=>{
  const h=await prepared({retry:true}),before=[...h.data];h.abort=true;
  await assert.rejects(advance(h),/interrupted/);assert.deepEqual([...h.data],before);
  h.abort=false;await advance(h);assert.equal(h.writes,14);
});
test('version conflicts, ID intent collisions, terminal resources and unsupported declarations never write',async()=>{
  const h=await prepared();await advance(h);const before=[...h.data];
  await assert.rejects(advance(h,{operationId:'restricted-round-other-0001'}),e=>e.code==='aborted');
  await assert.rejects(advance(h,{expectedRoundVersion:1}),e=>e.code==='failed-precondition');
  for(const action of [{type:'skill',actor:'player-0',target:'enemy-0'}, {type:'normal-attack',actor:'player-1',target:'enemy-0'},
    {type:'normal-attack',actor:'player-0',target:'enemy-0',damage:1}]){
    await assert.rejects(advance(h,{action}),e=>e.code==='invalid-argument');
  }
  for(const key of ['hp','damage','randomTape','seed','won','reward','source']){
    await assert.rejects(advance(h,{[key]:true}),e=>e.code==='invalid-argument');
    await assert.rejects(advance(h,{}, {data:{...h.request.data,[key]:true}}),e=>e.code==='invalid-argument');
  }
  assert.deepEqual([...h.data],before);
  const lethal=await prepared({entropy:.5});const r=await advance(lethal);
  const state=lethal.data.get(lethal.root+'/restrictedBattleRounds/'+attemptId+'_1').projection.nextState;
  assert.equal(state.enemyHP,0);assert.equal(r.outcomeVerified,false);
  await assert.rejects(lethal.owner.advance(lethal.request,roundArgs(lethal,1,'restricted-round-operation-0002')),
    e=>e.code==='failed-precondition');
});
test('missing round/receipt/head/original evidence fails closed for replay and new execution',async()=>{
  for(const path of ['restrictedBattleRounds/'+attemptId+'_1','operations/restricted-round-operation-0001',
    'restrictedBattleAttempts/'+attemptId,'restrictedBattles/'+attemptId]){
    const h=await prepared();await advance(h);h.data.delete(h.root+'/'+path);const before=[...h.data];
    await assert.rejects(advance(h));await assert.rejects(h.owner.advance(h.request,roundArgs(h,1,'restricted-round-operation-0002')));
    assert.deepEqual([...h.data],before);
  }
  const h=await prepared();await advance(h);delete h.data.get(h.root+'/restrictedBattleAttempts/'+attemptId).roundHead;
  await assert.rejects(advance(h),e=>e.code==='data-loss');
});
test('corrupt committed chain/entropy/output/policy/version refuses every replay',async()=>{
  for(const mutate of [r=>r.priorRoundSha256='0'.repeat(64),r=>r.projection.nextState.playerHP++,
    r=>r.projection.randomTape[0]=1,r=>r.writerPolicy.maxRounds++,r=>r.projection.nextState.roundVersion++,
    r=>r.outcomeVerified=true,r=>r.projection.actions[0].hpAfter++]){
    const h=await prepared();await advance(h);mutate(h.data.get(h.root+'/restrictedBattleRounds/'+attemptId+'_1'));
    await assert.rejects(advance(h),e=>e.code==='data-loss');assert.equal(h.writes,14);
  }
});
test('new rounds require original expiry/revision/session but historical replay survives expiry and later revision',async()=>{
  const h=await prepared();const first=await advance(h);h.clock=601000;
  h.data.get(h.root+'/account/current').serverRevision=3;h.data.get('users/'+uid+'/saves/current').serverRevision=3;
  assert.deepEqual(await advance(h),{...first,unchanged:true,expired:true});
  await assert.rejects(h.owner.advance(h.request,roundArgs(h,1,'restricted-round-operation-0002')),e=>e.code==='failed-precondition');
  h.clock=1003;
  await assert.rejects(h.owner.advance(h.request,roundArgs(h,1,'restricted-round-operation-0002')),e=>e.code==='aborted');
  h.session='x'.repeat(32);await assert.rejects(advance(h));assert.equal(h.writes,14);
});

test('changed executable policy refuses a new round but historical replay never runs the new arithmetic',async()=>{
  const h=await prepared(),first=await advance(h);
  const nativeRead=fs.readFileSync;
  fs.readFileSync=(path,...rest)=>{
    const content=nativeRead(path,...rest);
    return String(path).endsWith('canonical-battle-opening-round.js')?content+'\n// changed deployment':content;
  };
  let changed;
  try{
    // Recreate the production factory with the fixture's original dependencies.
    changed=h.newOwner();
  }finally{fs.readFileSync=nativeRead;}
  assert.deepEqual(await changed.advance(h.request,roundArgs(h)),{...first,unchanged:true});
  await assert.rejects(changed.advance(h.request,roundArgs(h,1,'restricted-round-operation-0002')),
    e=>e.code==='failed-precondition');assert.equal(h.writes,14);
});

test('expiry crossed during the transaction rejects all buffered writes',async()=>{
  const h=await prepared(),before=[...h.data];h.expireOnRead=3;
  await assert.rejects(advance(h),e=>e.code==='failed-precondition');assert.deepEqual([...h.data],before);
});
test('bounded full-chain exhaustion never issues a terminal verdict or permits overflow',async()=>{
  const h=await prepared();
  for(let version=0;version<128;version++){
    const result=await h.owner.advance(h.request,roundArgs(h,version,'restricted-bound-round-'+String(version).padStart(4,'0')));
    assert.equal(result.roundVersion,version+1);assert.equal(result.outcomeVerified,false);
  }
  const before=h.writes;
  await assert.rejects(h.owner.advance(h.request,roundArgs(h,128,'restricted-bound-overflow-0001')),e=>e.code==='invalid-argument');
  assert.equal(h.writes,before);
  const replay=await h.owner.advance(h.request,roundArgs(h,0,'restricted-bound-round-0000'));assert.equal(replay.unchanged,true);
});

test('server timestamp transforms are validated only after commit; missing committed stamps block replay',async()=>{
  const h=await prepared({sentinel:true}),first=await advance(h);
  assert.deepEqual(await advance(h),{...first,unchanged:true});
  const r=h.data.get(h.root+'/restrictedBattleRounds/'+attemptId+'_1');r.createdAt={serverTransform:true};
  await assert.rejects(advance(h),e=>e.code==='data-loss');assert.equal(h.writes,14);
});
