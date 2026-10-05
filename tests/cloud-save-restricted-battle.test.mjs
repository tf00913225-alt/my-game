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
function fixture({mutate=()=>{},retry=false,enemy='wild.zone-01.fire-01'}={}){
  const records=makeInitialCharacterSources(uid,2,'restricted-initial-source-0001',{
    displayName:'場次英雄',element:'fire',gender:'male',
    attributes:{attack:10,intelligence:0,vitality:0,energy:0,defensePoints:0,agility:0}});
  mutate(records);
  const snapshot=assembleCanonicalSnapshot(uid,2,records),root=`serverUsers/${uid}`;
  const data=new Map([[`${root}/account/current`,{...records.account,snapshotSha256:snapshot.sha256}],
    [`${root}/playableSnapshots/2`,snapshot],[`${root}/recoveryArchives/2`,createRecoveryArchive(uid,2,records,snapshot)],
    [`users/${uid}/saves/current`,{serverRevision:2,authoritativeStateReady:false}]]);
  const collection=p=>({doc:id=>({path:`${p}/${id}`,collection:n=>collection(`${p}/${id}/${n}`)})});
  let clock=1000,writes=0,abort=false,active=sessionId;
  class HttpsError extends Error{constructor(code,message){super(message);this.code=code;}}
  const deps={db:{collection},FieldValue:{serverTimestamp:()=>({toMillis:()=>123})},HttpsError,now:()=>clock,
    inspectExistingEnvelope:v=>({kind:'current',data:v,serverRevision:v.serverRevision}),
    runProtected:async(request,fn)=>{
      if(request.data.uid!==uid)throw new HttpsError('permission-denied','wrong UID');
      const call=async()=>{const pending=[];
        const tx={get:async ref=>({exists:data.has(ref.path),data:()=>data.get(ref.path)}),
          create:(ref,v)=>{assert.equal(data.has(ref.path),false);const {createdAt,...body}=v;
            pending.push([ref.path,{...structuredClone(body),createdAt}]);}};
        const result=await fn(tx,{uid,sessionId:active});return {pending,result};};
      if(retry)await call();
      const {pending,result}=await call();if(abort)throw Error('interrupted instance transaction');
      for(const [p,v] of pending)data.set(p,v);writes+=pending.length;return result;
    }};
  const owner=createCanonicalRestrictedBattle(deps),request={data:{uid,session:{}}};
  const args={attemptId,operationId,expectedRevision:2};
  return {data,root,records,snapshot,args,request,owner,get writes(){return writes;},
    set clock(v){clock=v;},set abort(v){abort=v;},set session(v){active=v;},
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
    assert.equal(h.owner.advance,undefined);assert.equal(h.owner.complete,undefined);
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
  assert.doesNotMatch(source,/onCall\(|tx\.(set|update)|randomBytes\(|Math\.random\(|battleAttackProofs/);
  assert.doesNotMatch(fs.readFileSync('functions/index.js','utf8'),/createCanonicalRestrictedBattle/);
});
