import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const require=createRequire(import.meta.url);
const {fixture,uid,root,env,heroId:DOG}=require('../.github/scripts/fixtures/hero-canonical-context.cjs');
const {createHeroGrowth}=require('../functions/src/hero-growth');
const {createHeroAcquisition}=require('../functions/src/hero-acquisition');
const {assembleCanonicalSnapshot}=require('../functions/src/canonical-snapshot');
const {createRecoveryArchive}=require('../functions/src/canonical-recovery-archive');
const KING='vajraHeavenlyKing',captureSha256='a'.repeat(64);
function reader(h,entitlements=[]){
 const reads=[];
 const writer=createHeroGrowth({...h.deps,now:()=>{throw Error('proof cannot read clock');},
  seed:()=>{throw Error('proof cannot draw seed');},acquisition:{readInTransaction(){throw Error('proof cannot read current rights');}}});
 const tx={get:async ref=>{
  assert.equal(ref.query,undefined,'bounded document reads only');reads.push(ref.path);assert.ok(reads.length<=60);
  const value=h.data.get(ref.path);return {exists:value!==undefined,data:()=>structuredClone(value)};
 },create(){assert.fail('proof write');},update(){assert.fail('proof write');},set(){assert.fail('proof write');},delete(){assert.fail('proof write');}};
 const scope={uid,root:h.deps.db.collection('serverUsers').doc(uid),envelopeRevision:h.data.get(env).serverRevision,
  canonicalRevision:h.data.get(`${root}/account/current`).serverRevision,entitlements,captureSha256};
 return {reads,scope,verify:id=>writer.verifyRetainedOperation(tx,scope,id)};
}
function primitive(value){
 if(value===null||['string','number','boolean'].includes(typeof value))return;
 assert.ok(Array.isArray(value)||Object.getPrototypeOf(value)===Object.prototype);
 for(const row of Object.values(value))primitive(row);
}
test('original unlock, star and reroll retained proofs are read-only, complete and bounded',async()=>{
 const h=fixture();
 for(const action of ['unlock','starUp','reroll']){
  const result=await h.writer.mutate(h.intent(action)),before=structuredClone([...h.data]);
  const r=reader(h),proof=await r.verify(result.receipt.intent.operationId);
  assert.equal(proof.kind,'hero-growth');assert.equal(proof.captureSha256,captureSha256);primitive(proof);
  assert.deepEqual(proof.operationIds,[result.receipt.intent.operationId]);
  assert.deepEqual(proof.entitlementObligations,[]);assert.equal(r.reads.length,7);
  assert.deepEqual([...h.data],before);
 }
});
test('original login reward and daily supply project the same complete transition with history binding',async()=>{
 const h=fixture({owned:true,fragments:0,pills:0});let clock=Date.parse('2026-10-12T00:00:00Z');
 const acquisition=createHeroAcquisition({...h.deps,now:()=>clock});
 h.deps.acquisition.readInTransaction=(tx,session)=>acquisition.readInTransaction(tx,session);
 for(let i=0;i<3;i++){
  await acquisition.observeLogin(h.request({expectedRevision:h.data.get(env).serverRevision}));clock+=86400000;
 }
 const login=await h.writer.claimLoginReward(h.request({milestoneDay:3,operationId:'hero-login-reward-v1-day3',expectedRevision:h.data.get(env).serverRevision}));
 let r=reader(h),proof=await r.verify(login.receipt.intent.operationId);
 assert.equal(r.reads.length,8);assert.equal(proof.loginEvidence.sourceId,'hero-login-20261014');
 assert.deepEqual(proof.claimIds,[login.receipt.intent.operationId]);
 const daily=createHeroGrowth({...h.deps,now:()=>clock});
 const result=await daily.claimDailySupply(h.request({periodDate:'20261015',operationId:'hero-daily-supply-v1-20261015',expectedRevision:h.data.get(env).serverRevision}));
 const before=structuredClone([...h.data]);r=reader(h);proof=await r.verify(result.receipt.intent.operationId);
 assert.equal(r.reads.length,7);assert.equal(proof.kind,'hero-daily-supply');assert.deepEqual([...h.data],before);
});
test('before-envelope entitlement cut includes every original grant and excludes later grants',async()=>{
 const h=fixture({owned:true});const grant={heroId:KING,claimKey:'hero-v1-'+KING,allocationSeed:99,sourceId:'hero-login-20261018',grantedRevision:2};
 h.deps.acquisition.readInTransaction=async()=>({entitlements:{[KING]:grant}});
 const result=await h.writer.mutate(h.intent('starUp'));
 const proof=await reader(h,[grant]).verify(result.receipt.intent.operationId);
 assert.deepEqual(proof.entitlementObligations,[{...grant,beforeEnvelopeRevision:2}]);
 await assert.rejects(reader(h).verify(result.receipt.intent.operationId),{code:'data-loss'});
 await assert.rejects(reader(h,[grant,grant]).verify(result.receipt.intent.operationId),{code:'data-loss'});
 const f=fixture({owned:true}),old=await f.writer.mutate(f.intent('starUp'));
 await f.writer.mutate(f.intent('reroll'));
 const later={...grant,grantedRevision:4};
 assert.deepEqual((await reader(f,[later]).verify(old.receipt.intent.operationId)).entitlementObligations,[]);
});
function resignAfter(h,operationId,change){
 const op=h.data.get(`${root}/operations/${operationId}`),revision=op.serverRevision;
 const records=structuredClone(h.data.get(`${root}/recoveryArchives/${revision}`).sourceRecords);change(records);
 const bundle=assembleCanonicalSnapshot(uid,revision,records),archive=createRecoveryArchive(uid,revision,records,bundle);
 h.data.set(`${root}/playableSnapshots/${revision}`,{...bundle,createdAt:{seconds:1}});
 h.data.set(`${root}/recoveryArchives/${revision}`,{...archive,createdAt:{seconds:1}});
 for(const name of ['operations','ledgerEntries'])h.data.set(`${root}/${name}/${operationId}`,{...op,snapshotSha256:bundle.sha256});
}
for(const [name,change] of [
 ['unrelated economy',r=>{r.economy.gold++;}],
 ['character attributes',r=>{r.characters[0].state.skillPoints++;}],
 ['non-resource progress',r=>{r.progress.gameplayProgress.personal['personal-20'].clears++;}],
 ['local preferences',r=>{r.progress.playableState.autoConfig.hp=51;}],
 ['other Hero',r=>{r.progress.playableState.heroAccount.heroes[KING].specificFragments++;}]
])test('resigned internally consistent '+name+' drift is not an original Hero transition',async()=>{
 const h=fixture({owned:true}),result=await h.writer.mutate(h.intent('starUp'));
 resignAfter(h,result.receipt.intent.operationId,change);
 const before=structuredClone([...h.data]);await assert.rejects(reader(h).verify(result.receipt.intent.operationId),{code:'data-loss'});
 assert.deepEqual([...h.data],before);
});
test('missing originals, forged receipt, scope or capture never succeeds or writes',async()=>{
 for(const name of ['operations','ledgerEntries','playableSnapshots','recoveryArchives','uniqueClaims']){
  const h=fixture(),result=await h.writer.mutate(h.intent('unlock')),id=result.receipt.intent.operationId;
  h.data.delete(`${root}/${name}/${['playableSnapshots','recoveryArchives'].includes(name)?'3':name==='uniqueClaims'?'hero-fragment-v1-'+DOG:id}`);
  await assert.rejects(reader(h).verify(id),{code:'data-loss'});
 }
 const h=fixture({owned:true}),result=await h.writer.mutate(h.intent('starUp')),id=result.receipt.intent.operationId;
 const r=reader(h);r.scope.captureSha256='invalid';await assert.rejects(r.verify(id),{code:'data-loss'});
 const v=reader(h);v.scope.canonicalRevision=2;await assert.rejects(v.verify(id),{code:'data-loss'});
 const o=h.data.get(`${root}/operations/${id}`);h.data.set(`${root}/operations/${id}`,{...o,fragmentDelta:1});
 h.data.set(`${root}/ledgerEntries/${id}`,{...o,fragmentDelta:1});await assert.rejects(reader(h).verify(id),{code:'data-loss'});
});

function dailyClockBoundary({crossOnCall=null}={}){
 const h=fixture({owned:true,fragments:0,pills:0}),sameDay=Date.parse('2026-10-18T15:59:59Z');
 let clock=sameDay,calls=0,writes=0,assemblyComplete=false;
 // Observe only the original assembly dependency in an isolated test module.
 // No product hook, global module-cache change or replacement reward formula.
 const module={exports:{}};
 const localRequire=createRequire(new URL('../functions/src/hero-growth.js',import.meta.url));
 const dependency=name=>name==='./canonical-recovery-archive'?{
  ...localRequire(name),createRecoveryArchive(...args){
   const result=localRequire(name).createRecoveryArchive(...args);
   assemblyComplete=true;clock=Date.parse('2026-10-18T16:00:00Z');return result;
  }
 }:localRequire(name);
 const source=readFileSync(new URL('../functions/src/hero-growth.js',import.meta.url),'utf8');
 vm.runInThisContext('(function(require,module,exports){'+source+'\n})')(dependency,module,module.exports);
 const base=h.deps.runProtected;
 const writer=module.exports.createHeroGrowth({...h.deps,
  now:()=>{calls++;if(calls===crossOnCall)clock=Date.parse('2026-10-18T16:00:00Z');return clock;},
  runProtected:(request,operation)=>base(request,(tx,session)=>operation({...tx,
   ...Object.fromEntries(['create','update','set','delete'].map(name=>[name,(...args)=>{writes++;return tx[name](...args);}]))
  },session))});
 return {h,writer,request:h.request({periodDate:'20261018',operationId:'hero-daily-supply-v1-20261018',expectedRevision:2}),
  state:()=>({calls,writes,assemblyComplete,clock})};
}
test('clock boundary: third or fourth original now crossing midnight refuses before assembly with zero writes',async()=>{
 for(const crossOnCall of [3,4]){
  const c=dailyClockBoundary({crossOnCall}),before=structuredClone([...c.h.data]);
  await assert.rejects(c.writer.claimDailySupply(c.request),{code:'failed-precondition'});
  assert.deepEqual(c.state(),{calls:crossOnCall,writes:0,assemblyComplete:false,clock:Date.parse('2026-10-18T16:00:00Z')});
  assert.deepEqual([...c.h.data],before);
 }
});
test('clock boundary: midnight only after original snapshot/archive assembly preserves accepted writer behavior',async()=>{
 const c=dailyClockBoundary(),result=await c.writer.claimDailySupply(c.request);
 assert.equal(result.receipt.kind,'hero-daily-supply');assert.equal(result.receipt.intent.periodDate,'20261018');
 assert.equal(result.receipt.dailyEvidence.observedAtMs,Date.parse('2026-10-18T15:59:59Z'));
 assert.equal(c.state().calls,4,'original four clock reads; no post-assembly clock gate');
 assert.equal(c.state().assemblyComplete,true);assert.ok(c.state().writes>0);
 assert.equal(c.state().clock,Date.parse('2026-10-18T16:00:00Z'));
});
