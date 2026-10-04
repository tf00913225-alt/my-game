import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {createCanonicalBattleAttempt}=require('../functions/src/canonical-battle-attempt');
const {createCanonicalBattleEncounter}=require('../functions/src/canonical-battle-encounter');
const {createCanonicalBattleAttackProof}=require('../functions/src/canonical-battle-attack-proof');
const {resolvePlainPlayerNormalAttack,samplePlainPlayerNormalAttack}=require('../functions/src/canonical-battle-normal-attack');
const {makeInitialCharacterSources}=require('../functions/src/initial-character-sources');
const {assembleCanonicalSnapshot}=require('../functions/src/canonical-snapshot');
const {createRecoveryArchive}=require('../functions/src/canonical-recovery-archive');
const currentPolicy=require('../functions/src/generated/plain-player-normal-attack-policy.json');
const uid='attack-proof-user',attemptId='attack-preparation-0001',encounterOperation='attack-encounter-seal-0001';
const operationId='attack-proof-operation-0001',sessionId='s'.repeat(32);
function fixture({miss=false,unsupported=false,retry=false}={}){
  const records=makeInitialCharacterSources(uid,2,'attack-initial-source-0001',{
    displayName:'運算英雄',element:'fire',gender:'male',attributes:{attack:10,intelligence:0,vitality:0,energy:0,defensePoints:0,agility:0}});
  if(unsupported)records.characters[0].skillLoadout.skillLevels.fireEX=1;
  const snapshot=assembleCanonicalSnapshot(uid,2,records),root=`serverUsers/${uid}`;
  const data=new Map([[`${root}/account/current`,{...records.account,snapshotSha256:snapshot.sha256}],
    [`${root}/playableSnapshots/2`,snapshot],[`${root}/recoveryArchives/2`,createRecoveryArchive(uid,2,records,snapshot)],
    [`users/${uid}/saves/current`,{serverRevision:2,authoritativeStateReady:false}]]);
  const collection=p=>({doc:id=>({path:`${p}/${id}`,collection:name=>collection(`${p}/${id}/${name}`)})});
  let clock=1002,writes=0,abort=false,currentSession=sessionId,entropyCalls=0,entropyOverride=null;
  class HttpsError extends Error{constructor(code,message){super(message);this.code=code;}}
  const stamp=()=>({toMillis:()=>123});
  const deps={db:{collection},FieldValue:{serverTimestamp:stamp},HttpsError,now:()=>clock,
    randomBytes:()=>{entropyCalls++;return entropyOverride??Buffer.alloc(18,miss?255:128);},
    inspectExistingEnvelope:value=>({kind:'current',data:value,serverRevision:value.serverRevision}),
    runProtected:async(request,fn)=>{
      if(request.data.uid!==uid)throw new HttpsError('permission-denied','wrong UID');
      const call=async()=>{const pending=[];
        const tx={get:async ref=>({exists:data.has(ref.path),data:()=>data.get(ref.path)}),
          create:(ref,value)=>{assert.equal(data.has(ref.path),false);
            const {createdAt,...body}=value;pending.push([ref.path,{...structuredClone(body),createdAt}]);}};
        const result=await fn(tx,{uid,sessionId:currentSession});return {result,pending};};
      if(retry)await call(); // discard the first transaction's proposed writes
      const {result,pending}=await call();if(abort)throw Error('interrupted proof transaction');
      for(const [p,value] of pending)data.set(p,value);writes+=pending.length;return result;
    }};
  const request={data:{uid,session:{}}},owner=createCanonicalBattleAttackProof(deps);
  const args={attemptId,operationId,expectedRevision:2};
  return {data,root,args,request,records,snapshot,get writes(){return writes;},get entropyCalls(){return entropyCalls;},
    set clock(v){clock=v;},set abort(v){abort=v;},set session(v){currentSession=v;},
    set entropy(v){entropyOverride=v;},
    seed:async()=>{clock=1000;await createCanonicalBattleAttempt(deps).begin(request,{operationId:attemptId,expectedRevision:2});
      clock=1001;await createCanonicalBattleEncounter(deps).seal(request,{attemptId,operationId:encounterOperation,
        expectedRevision:2,encounterKey:'wild.zone-01.fire-01'});clock=1002;},
    seal:(extra={},req=request)=>owner.seal(req,{...args,...extra}),
    proof:()=>data.get(`${root}/battleAttackProofs/${attemptId}`)};
}
for(const miss of [false,true])test(`private server ${miss?'MISS':'hit'} proof is atomic, bounded, replayable and never awards`,async()=>{
  const h=fixture({miss});await h.seed();const initial=[...h.data].map(([p,v])=>[p,v]);
  const first=await h.seal(),proof=h.proof();assert.equal(h.writes,11);
  const p=proof.projection;assert.equal(p.hit,!miss);assert.equal(p.randomTape.length,miss?1:3);
  assert.equal(p.randomSamplesConsumed,p.randomTape.length);
  const policy=h.data.get(`${h.root}/battleEncounterPolicies/${p.encounterPolicySha256}`).policy;
  assert.deepEqual(resolvePlainPlayerNormalAttack({uid,revision:2,snapshot:h.snapshot,
    archive:h.data.get(`${h.root}/recoveryArchives/2`),encounterPolicy:policy,
    encounterKey:p.encounterKey,randomTape:p.randomTape}),p);
  for(const [path,value] of initial)assert.deepEqual(h.data.get(path),value);
  assert.equal([...h.data.keys()].some(p=>/ledgerEntries|pendingGrants|uniqueClaims/.test(p)),false);
  for(const key of ['combatRulesReady','outcomeVerified','rewardEligible','creditedToCharacter'])assert.equal(first[key],false);
  assert.equal(first.projection,undefined);assert.equal(first.randomTape,undefined);
  h.entropy=Buffer.alloc(18,miss?0:255);
  assert.deepEqual(await h.seal(),{...first,unchanged:true});assert.equal(h.writes,11);
  h.clock=601000;h.data.get(`${h.root}/account/current`).serverRevision=3;
  h.data.get(`${h.root}/account/current`).snapshotSha256='a'.repeat(64);
  h.data.get(`users/${uid}/saves/current`).serverRevision=3;
  const saved=currentPolicy.rulesSha256;
  try{currentPolicy.rulesSha256='b'.repeat(64);
    assert.deepEqual(await h.seal(),{...first,unchanged:true,expired:true});
  }finally{currentPolicy.rulesSha256=saved;}
  assert.deepEqual(h.proof(),proof);assert.equal(h.writes,11);
});
test('transaction retries reuse one captured entropy pool and retain identical projection',async()=>{
  const h=fixture({retry:true});await h.seed();const first=await h.seal();
  assert.equal(h.entropyCalls,1);assert.equal(h.writes,11);assert.equal(first.unchanged,false);
});
test('failed commit rolls back proof/policy/receipt/marker together',async()=>{
  const h=fixture();await h.seed();h.abort=true;await assert.rejects(h.seal(),/interrupted/);
  assert.equal(h.writes,7);assert.equal(h.proof(),undefined);
  assert.equal(h.data.has(`${h.root}/battleAttackPolicies`),false);
  assert.equal([...h.data.keys()].filter(p=>/battleAttack/.test(p)).length,0);
  h.abort=false;await h.seal();assert.equal(h.writes,11);
});
test('different operation cannot reseal and changed source revision fails',async()=>{
  const h=fixture();await h.seed();await h.seal();
  await assert.rejects(h.seal({operationId:'attack-proof-operation-0002'}),e=>e.code==='already-exists');
  await assert.rejects(h.seal({expectedRevision:3}),e=>e.code==='data-loss');assert.equal(h.writes,11);
});
for(const time of [1000,601000])test(`new proof outside original time window ${time} is rejected`,async()=>{
  const h=fixture();await h.seed();h.clock=time;
  await assert.rejects(h.seal(),e=>e.code==='failed-precondition');assert.equal(h.writes,7);
});
test('new stale revision, unsupported modified source and invalid entropy reject without writes',async()=>{
  const stale=fixture();await stale.seed();stale.data.get(`${stale.root}/account/current`).serverRevision=3;
  stale.data.get(`users/${uid}/saves/current`).serverRevision=3;
  await assert.rejects(stale.seal(),e=>e.code==='aborted');assert.equal(stale.writes,7);
  const unsupported=fixture({unsupported:true});await unsupported.seed();
  await assert.rejects(unsupported.seal(),e=>e.code==='failed-precondition');assert.equal(unsupported.writes,7);
  const h=fixture();await h.seed();h.entropy=Buffer.alloc(17);
  await assert.rejects(h.seal(),e=>e.code==='internal');assert.equal(h.writes,7);
});
for(const [collection,key] of [['battleAttempts',attemptId],['operations',attemptId],['battleAttemptSources','2'],
  ['playableSnapshots','2'],['recoveryArchives','2'],['battleEncounters',attemptId],
  ['operations',encounterOperation],['battleEncounterAttempts',attemptId]]){
  test(`missing original ${collection}/${key} blocks creation and replay without regeneration`,async()=>{
    for(const replay of [false,true]){const h=fixture();await h.seed();if(replay)await h.seal();
      h.data.delete(`${h.root}/${collection}/${key}`);const before=h.writes;
      await assert.rejects(h.seal());assert.equal(h.writes,before);}
  });
}
for(const collection of ['battleAttackProofs','battleAttackAttempts','operations','battleAttackPolicies']){
  test(`missing ${collection} cannot regenerate the original proof`,async()=>{
    const h=fixture();await h.seed();const first=await h.seal();
    const key=collection==='operations'?operationId:collection==='battleAttackPolicies'?first.rulesPolicySha256:attemptId;
    h.data.delete(`${h.root}/${collection}/${key}`);await assert.rejects(h.seal());assert.equal(h.writes,11);
    if(['battleAttackProofs','battleAttackAttempts'].includes(collection)){
      await assert.rejects(h.seal({operationId:'attack-proof-operation-0002'}),e=>e.code==='already-exists');
      assert.equal(h.writes,11);
    }
  });
}
for(const [field,value] of Object.entries({ownerUid:'foreign',sourceRevision:9,attemptSha256:'0'.repeat(64),
  encounterSha256:'0'.repeat(64),snapshotSha256:'0'.repeat(64),rulesPolicySha256:'0'.repeat(64),
  expiresAtMs:9999999,sealedAtMs:0,creationSessionId:'n'.repeat(32),combatRulesReady:true,
  outcomeVerified:true,rewardEligible:true,creditedToCharacter:true,sha256:'0'.repeat(64)})){
  test(`tampered ${field} fails closed`,async()=>{const h=fixture();await h.seed();await h.seal();h.proof()[field]=value;
    await assert.rejects(h.seal(),e=>e.code==='data-loss');assert.equal(h.writes,11);});
}
test('projection, private policy and receipt/marker corruption refuses replay',async()=>{
  for(const mutate of [h=>{h.proof().projection.damage++;},
    h=>{h.data.get(`${h.root}/battleAttackPolicies/${h.proof().rulesPolicySha256}`).policy.rulesSha256='0'.repeat(64);},
    h=>{h.data.get(`${h.root}/operations/${operationId}`).proofSha256='0'.repeat(64);},
    h=>{h.data.get(`${h.root}/battleAttackAttempts/${attemptId}`).operationId='foreign';}]){
    const h=fixture();await h.seed();await h.seal();mutate(h);
    await assert.rejects(h.seal(),e=>e.code==='data-loss');assert.equal(h.writes,11);
  }
});
test('foreign UID, replaced session, collisions and browser entropy/results/amounts refuse',async()=>{
  const h=fixture();await h.seed();h.session='n'.repeat(32);
  await assert.rejects(h.seal(),e=>e.code==='failed-precondition');h.session=sessionId;
  await assert.rejects(h.seal({}, {data:{uid:'foreign',session:{}}}),e=>e.code==='permission-denied');
  for(const key of ['won','gold','randomTape','rules','projection','enemy','expiresAtMs']){
    await assert.rejects(h.seal({[key]:true}),e=>e.code==='invalid-argument');
    await assert.rejects(h.seal({}, {data:{uid,session:{},[key]:true}}),e=>e.code==='invalid-argument');
  }
  for(const name of ['grantOperations','ledgerEntries','battleAttempts']){
    h.data.set(`${h.root}/${name}/${operationId}`,{});
    await assert.rejects(h.seal(),e=>e.code==='failed-precondition');h.data.delete(`${h.root}/${name}/${operationId}`);
  }
  await assert.rejects(h.seal({operationId:encounterOperation}),e=>e.code==='data-loss');assert.equal(h.writes,7);
});
test('sampling adapter shares exact admission, rejects client tapes and invalid sampler values',async()=>{
  const h=fixture();await h.seed();const sealed=h.data.get(`${h.root}/battleEncounters/${attemptId}`);
  const policy=h.data.get(`${h.root}/battleEncounterPolicies/${sealed.policySha256}`).policy;
  const args={uid,revision:2,snapshot:h.snapshot,archive:h.data.get(`${h.root}/recoveryArchives/2`),
    encounterKey:sealed.encounterKey,encounterPolicy:policy};
  for(const value of [-1,1,NaN,undefined,'0.5'])assert.throws(()=>samplePlainPlayerNormalAttack(args,()=>value));
  assert.throws(()=>samplePlainPlayerNormalAttack({...args,randomTape:[]},()=>0.5));
  assert.throws(()=>samplePlainPlayerNormalAttack(args,null));
  assert.deepEqual(samplePlainPlayerNormalAttack(args,()=>0.5),resolvePlainPlayerNormalAttack({...args,randomTape:[0.5,0.5,0.5]}));
});
