import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {buildBattleEncounterCatalog,CATALOG_PATH} from '../scripts/lib/cloud-battle-encounter-catalog.mjs';
import {MonsterBalance} from '../js/combat/monster-balance-owner.mjs';
const require=createRequire(import.meta.url);
const {createCanonicalBattleAttempt}=require('../functions/src/canonical-battle-attempt');
const {createCanonicalBattleEncounter}=require('../functions/src/canonical-battle-encounter');
const {makeInitialCharacterSources}=require('../functions/src/initial-character-sources');
const {assembleCanonicalSnapshot}=require('../functions/src/canonical-snapshot');
const {createRecoveryArchive}=require('../functions/src/canonical-recovery-archive');
const catalog=require('../functions/src/generated/battle-encounter-catalog.json');
const rootDir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const uid='encounter-proof-user',attemptId='battle-encounter-source-0001',operationId='battle-encounter-seal-0001';
const sessionId='s'.repeat(32),encounterKey='wild.zone-01.fire-01';
function fixture(){
  const records=makeInitialCharacterSources(uid,2,'initial-encounter-source-0001',{
    displayName:'測試英雄',element:'fire',gender:'male',attributes:{attack:10,intelligence:0,vitality:0,energy:0,defensePoints:0,agility:0}});
  const snapshot=assembleCanonicalSnapshot(uid,2,records),root=`serverUsers/${uid}`;
  const data=new Map([[`${root}/account/current`,{...records.account,snapshotSha256:snapshot.sha256}],
    [`${root}/playableSnapshots/2`,structuredClone(snapshot)],
    [`${root}/recoveryArchives/2`,createRecoveryArchive(uid,2,records,snapshot)],
    [`users/${uid}/saves/current`,{serverRevision:2,authoritativeStateReady:false}]]);
  const collection=p=>({doc:id=>({path:`${p}/${id}`,collection:name=>collection(`${p}/${id}/${name}`)})});
  let clock=1000,writes=0,abort=false,currentSession=sessionId;
  class HttpsError extends Error{constructor(code,message){super(message);this.code=code;}}
  const deps={db:{collection},FieldValue:{serverTimestamp:()=>({toMillis:()=>123})},HttpsError,now:()=>clock,
    inspectExistingEnvelope:value=>({kind:'current',data:value,serverRevision:value.serverRevision}),
    runProtected:async(request,fn)=>{
      if(request.data.uid!==uid)throw new HttpsError('permission-denied','wrong UID');
      const pending=[];
      const tx={get:async ref=>({exists:data.has(ref.path),data:()=>data.get(ref.path)}),
        create:(ref,value)=>{assert.equal(data.has(ref.path),false);
          pending.push([ref.path,{...value,...(value.policy?{policy:structuredClone(value.policy)}:{})}]);}};
      const result=await fn(tx,{uid,sessionId:currentSession});
      if(abort)throw Error('interrupted encounter transaction');
      for(const [p,value] of pending)data.set(p,value);
      writes+=pending.length;return result;
    }};
  const request={data:{uid,session:{}}},owner=createCanonicalBattleEncounter(deps);
  const args={attemptId,operationId,expectedRevision:2,encounterKey};
  return {data,root,args,request,records,snapshot,get writes(){return writes;},
    set clock(v){clock=v;},set abort(v){abort=v;},set session(v){currentSession=v;},
    begin:()=>createCanonicalBattleAttempt(deps).begin(request,{operationId:attemptId,expectedRevision:2}),
    seal:(extra={},req=request)=>owner.seal(req,{...args,...extra})};
}
test('generated deployment catalog matches formal owner and exact Forest source; no combat authority',async()=>{
  assert.deepEqual(catalog,await buildBattleEncounterCatalog(rootDir));
  assert.equal(fs.readFileSync(path.join(rootDir,CATALOG_PATH),'utf8'),JSON.stringify(catalog,null,2)+'\n');
  assert.equal(Object.keys(catalog.entries).length,2);
  for(const definition of Object.values(catalog.entries)){
    const entity=MonsterBalance.build(definition.spec);
    for(const [key,value] of Object.entries(definition.stats))assert.equal(value,entity[key]);
    assert.equal(definition.finalDamagePressure,entity.balanceProjection.finalDamagePressure);
  }
  assert.equal(catalog.combatRulesReady,false);assert.equal(catalog.rewardEligible,false);
});
test('atomically seals original policy/definition/preparation, never extends expiry or awards',async()=>{
  const h=fixture(),start=await h.begin(),first=await h.seal();
  assert.equal(h.writes,7);assert.equal(first.expiresAtMs,start.expiresAtMs);
  assert.equal(first.outcomeVerified,false);assert.equal(first.rewardEligible,false);
  assert.equal(first.combatRulesReady,false);assert.equal(first.creditedToCharacter,false);
  h.clock=start.expiresAtMs;
  assert.deepEqual(await h.seal(),{...first,expired:true,unchanged:true});assert.equal(h.writes,7);
  assert.equal(h.data.get(`users/${uid}/saves/current`).serverRevision,2);
  assert.equal([...h.data.keys()].some(p=>/pendingGrants|ledgerEntries|uniqueClaims/.test(p)),false);
});
test('failed commit rolls back all four records and supports identical retry',async()=>{
  const h=fixture();await h.begin();h.abort=true;await assert.rejects(h.seal(),/interrupted/);
  assert.equal(h.writes,3);assert.equal(h.data.size,7);
  h.abort=false;assert.equal((await h.seal()).unchanged,false);assert.equal(h.writes,7);
});
test('cannot start without proof, after expiry, before original time or with stale current revision',async()=>{
  const missing=fixture();await assert.rejects(missing.seal(),e=>e.code==='data-loss');assert.equal(missing.writes,0);
  for(const time of [999,601000]){const h=fixture();await h.begin();h.clock=time;
    await assert.rejects(h.seal(),e=>e.code==='failed-precondition');assert.equal(h.writes,3);}
  const stale=fixture();await stale.begin();stale.data.get(`${stale.root}/account/current`).serverRevision=3;
  stale.data.get(`users/${uid}/saves/current`).serverRevision=3;
  await assert.rejects(stale.seal(),e=>e.code==='aborted');assert.equal(stale.writes,3);
});
test('lost response replays original sealed proof after later account revision and catalog changes',async()=>{
  const h=fixture();await h.begin();const first=await h.seal();
  h.data.get(`${h.root}/account/current`).serverRevision=3;
  h.data.get(`${h.root}/account/current`).snapshotSha256='a'.repeat(64);
  h.data.get(`users/${uid}/saves/current`).serverRevision=3;
  const saved=catalog.entries[encounterKey].stats.attack;
  try{catalog.entries[encounterKey].stats.attack=999;
    assert.deepEqual(await h.seal(),{...first,unchanged:true});
  }finally{catalog.entries[encounterKey].stats.attack=saved;}
  assert.equal(h.writes,7);
});
test('another operation cannot reseal a preparation; same operation with changed enemy/intent fails',async()=>{
  const h=fixture();await h.begin();await h.seal();
  await assert.rejects(h.seal({operationId:'battle-encounter-seal-0002'}),e=>e.code==='already-exists');
  await assert.rejects(h.seal({encounterKey:'wild.zone-01.water-01'}),e=>e.code==='data-loss');
  await assert.rejects(h.seal({expectedRevision:3}),e=>e.code==='data-loss');assert.equal(h.writes,7);
});
for(const name of ['battleAttempts','operations','battleAttemptSources','playableSnapshots','recoveryArchives']){
  test(`missing original ${name} refuses first seal and replay without regeneration`,async()=>{
    for(const replay of [false,true]){const h=fixture();await h.begin();if(replay)await h.seal();
      h.data.delete(`${h.root}/${name}/${['battleAttemptSources','playableSnapshots','recoveryArchives'].includes(name)?'2':attemptId}`);
      const before=h.writes;await assert.rejects(h.seal());assert.equal(h.writes,before);}
  });
}
for(const name of ['battleEncounters','operations','battleEncounterAttempts','battleEncounterPolicies']){
  test(`missing ${name} replay cannot regenerate evidence`,async()=>{
    const h=fixture();await h.begin();const first=await h.seal();
    h.data.delete(`${h.root}/${name}/${name==='battleEncounterPolicies'?first.policySha256:name==='battleEncounterAttempts'?attemptId:operationId}`);
    await assert.rejects(h.seal());assert.equal(h.writes,7);
  });
}
for(const [field,value] of Object.entries({ownerUid:'foreign',sourceRevision:9,attemptSha256:'0'.repeat(64),
  definitionSha256:'0'.repeat(64),policySha256:'0'.repeat(64),encounterKey:'wild.zone-01.water-01',
  expiresAtMs:9999999,sealedAtMs:0,creationSessionId:'n'.repeat(32),combatRulesReady:true,
  outcomeVerified:true,rewardEligible:true,creditedToCharacter:true,sha256:'0'.repeat(64)})){
  test(`tampered ${field} fails closed`,async()=>{const h=fixture();await h.begin();await h.seal();
    h.data.get(`${h.root}/battleEncounters/${operationId}`)[field]=value;
    await assert.rejects(h.seal(),e=>e.code==='data-loss');assert.equal(h.writes,7);});
}
test('policy tampering, foreign policy and corrupt receipt/marker refuse replay',async()=>{
  for(const change of [
    (h,p)=>{h.data.get(`${h.root}/battleEncounterPolicies/${p.policySha256}`).policy.entries[encounterKey].stats.attack=999;},
    (h,p)=>{h.data.get(`${h.root}/battleEncounterPolicies/${p.policySha256}`).ownerUid='foreign';},
    h=>{h.data.get(`${h.root}/operations/${operationId}`).encounterSha256='0'.repeat(64);},
    h=>{h.data.get(`${h.root}/battleEncounterAttempts/${attemptId}`).operationId='foreign';}
  ]){const h=fixture();await h.begin();const first=await h.seal();
    // Fake tx does not serialize object values like Firestore; isolate shared policy.
    const ref=`${h.root}/battleEncounterPolicies/${first.policySha256}`,saved=h.data.get(ref);
    h.data.set(ref,{...saved,policy:structuredClone(saved.policy)});
    change(h,first);await assert.rejects(h.seal(),e=>e.code==='data-loss');assert.equal(h.writes,7);}
});
test('different session, cross UID, operation collisions and client win/stat/reward fields refuse',async()=>{
  const h=fixture();await h.begin();h.session='n'.repeat(32);
  await assert.rejects(h.seal(),e=>e.code==='failed-precondition');h.session=sessionId;
  await assert.rejects(h.seal({}, {data:{uid:'foreign',session:{}}}),e=>e.code==='permission-denied');
  for(const key of ['won','reward','gold','enemy','stats','expiresAtMs']){
    await assert.rejects(h.seal({[key]:true}),e=>e.code==='invalid-argument');
    await assert.rejects(h.seal({}, {data:{uid,session:{},[key]:true}}),e=>e.code==='invalid-argument');
  }
  for(const key of ['unknown','__proto__','wild.zone-02.fire-01'])await assert.rejects(h.seal({encounterKey:key}),e=>e.code==='invalid-argument');
  for(const p of ['grantOperations','ledgerEntries']){h.data.set(`${h.root}/${p}/${operationId}`,{});
    await assert.rejects(h.seal(),e=>e.code==='failed-precondition');h.data.delete(`${h.root}/${p}/${operationId}`);}
  assert.equal(h.writes,3);
});
