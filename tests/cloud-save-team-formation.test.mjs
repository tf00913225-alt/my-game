import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import vm from 'node:vm';
const require=createRequire(import.meta.url);
const {fixture,uid,heroId,root,env}=require('../.github/scripts/fixtures/hero-canonical-context.cjs');
const {createTeamFormation}=require('../functions/src/team-formation');
const Policy=require('../functions/src/team-formation-policy');
const Core=require('../functions/src/hero-core');
const initial=()=>({version:2,characterIndexToSlot:{0:'ALLY_F2'},heroIdToSlot:{[heroId]:'ALLY_B2'}});
function harness(options={owned:true}){
 const h=fixture(options);h.formation=createTeamFormation({...h.deps,readContext:h.writer.readInTransaction});
 h.save=(formation=initial(),operationId='formation-save-000001',expectedRevision=h.data.get(env).serverRevision)=>
  h.formation.save(h.request({operationId,expectedRevision,formation}));return h;
}
test('formation saves stable Hero identity, recovers on a new read, swaps and removes without resource changes',async()=>{
 const h=harness(),prior=structuredClone(h.data.get(`${root}/recoveryArchives/2`));
 assert.equal((await h.formation.read(h.request())).formation,null);
 const first=await h.save();assert.deepEqual(first.formation,initial());assert.equal(first.serverRevision,3);
 assert.deepEqual((await h.formation.read(h.request())).formation,initial());
 const moved=initial();moved.characterIndexToSlot[0]='ALLY_B2';moved.heroIdToSlot[heroId]='ALLY_F2';
 await h.save(moved,'formation-swap-000001');
 assert.deepEqual((await h.formation.read(h.request())).formation,moved);
 await h.save({...moved,heroIdToSlot:{}},'formation-remove-0001');
 const final=await h.formation.read(h.request());assert.deepEqual(final.formation.heroIdToSlot,{});
 assert.equal(final.heroAccount.heroes[heroId].specificFragments,500);
 assert.deepEqual(h.data.get(`${root}/recoveryArchives/2`),prior,'historical archives are immutable');
});
test('identical lost-response retry returns receipt after later growth; conflicts and missing evidence fail closed',async()=>{
 const h=harness(),first=await h.save();await h.writer.mutate(h.intent('starUp'));
 const before=structuredClone([...h.data]);
 const retry=await h.save(initial(),'formation-save-000001',2);
 assert.deepEqual(retry.receipt,first.receipt);assert.deepEqual([...h.data],before);
 await assert.rejects(h.save({...initial(),heroIdToSlot:{}},'formation-save-000001',2),{code:'data-loss'});
 h.data.delete(`${root}/ledgerEntries/formation-save-000001`);
 await assert.rejects(h.save(initial(),'formation-save-000001',2),{code:'data-loss'});
});
test('unowned/duplicate/out-of-range slots, excess fields, stale revision and concurrent writes cannot publish',async()=>{
 const h=harness(),before=structuredClone([...h.data]);
 for(const value of [
  {...initial(),heroIdToSlot:{[heroId]:'ALLY_F2'}},
  {...initial(),heroIdToSlot:{[heroId]:'ALLY_F4'}},
  {...initial(),characterIndexToSlot:{}},
  {...initial(),heroIdToSlot:{unknownHero:'ALLY_B2'}},
  {...initial(),extra:true}])await assert.rejects(h.save(value),{code:'invalid-argument'});
 assert.deepEqual([...h.data],before);
 await assert.rejects(harness({owned:false}).save(),{code:'invalid-argument'});
 await assert.rejects(h.save(initial(),'formation-stale-0001',1),{code:'aborted'});
 const results=await Promise.allSettled([h.save(initial(),'formation-race-00001',2),h.save(initial(),'formation-race-00002',2)]);
 assert.equal(results.filter(row=>row.status==='fulfilled').length,1);
 assert.equal(results.find(row=>row.status==='rejected').reason.code,'aborted');
});
test('interrupted transaction, foreign UID, revoked session and missing archive leave formation untouched',async()=>{
 const h=harness(),before=structuredClone([...h.data]);h.interrupt();
 await assert.rejects(h.save(),/interrupted/);assert.deepEqual([...h.data],before);
 const other=harness();await assert.rejects(other.formation.read({data:{uid:'another',session:'active'}}),{code:'permission-denied'});
 other.revoke();await assert.rejects(other.save(),{code:'permission-denied'});
 const damaged=harness();damaged.data.delete(`${root}/recoveryArchives/2`);
 await assert.rejects(damaged.save(),{code:'data-loss'});
});
function client(){
 const handlers={},h=harness();let accountUid=uid;
 const c={FourSymbolsHeroCore:Core,FourSymbolsTeamFormationPolicy:Policy,navigator:{onLine:true},
  crypto:{randomUUID:()=> '12345678-1234-1234-1234-123456789abc'},
  FourSymbolsAccountSave:{getActiveUid:()=>accountUid},FourSymbolsStartupPolicy:{getUid:()=>accountUid,getState:()=> 'READY'},
  FourSymbolsFirebaseLifecycle:{getUser:()=>({uid:accountUid}),readTeamFormation:()=>h.formation.read(h.request()),saveTeamFormation:intent=>h.formation.save(h.request(intent))},
  addEventListener:(name,fn)=>{handlers[name]=fn;},isHeroGrowthBattleActive:()=>false};
 c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync('js/team-formation-client.js','utf8'),c);
 return {h,c,handlers,switchUid:()=>{accountUid='another';handlers['four-symbols:firebase-auth-state']({});}};
}
test('client never applies rejected/unconfirmed writes; identical retry, reload and UID/session invalidation',async()=>{
 const {c,h,handlers}=client(),api=c.FourSymbolsTeamFormation;await api.read();
 const transport=c.FourSymbolsFirebaseLifecycle.saveTeamFormation,calls=[];let lost=true;
 c.FourSymbolsFirebaseLifecycle.saveTeamFormation=async intent=>{
  calls.push(structuredClone(intent));const value=await transport(intent);if(lost){lost=false;throw Error('lost response');}return value;
 };
 assert.equal(await api.save(initial()),false);assert.equal(api.getConfirmed(),null);assert.ok(api.getStatus().pending);
 assert.equal(h.data.get(env).serverRevision,3);
 assert.equal(await api.retry(),true);assert.deepEqual(calls[0],calls[1]);assert.equal(h.data.get(env).serverRevision,3);
 assert.deepEqual(JSON.parse(JSON.stringify(api.getConfirmed())),initial());
 handlers['four-symbols:game-session-state']({detail:{status:'revoked'}});
 assert.equal(api.getConfirmed(),null);assert.equal(api.getStatus().pending,null);
 await api.read();assert.deepEqual(JSON.parse(JSON.stringify(api.getConfirmed())),initial());
 const dataLoss=Object.assign(Error('revoked'),{code:'permission-denied'});
 c.FourSymbolsFirebaseLifecycle.saveTeamFormation=async()=>{throw dataLoss;};
 assert.equal(await api.save({...initial(),heroIdToSlot:{}}),false);assert.equal(api.getConfirmed(),null);
});
test('changed UID discards an in-flight read and write; battle-time read cannot replace current slots',async()=>{
 const t=client(),api=t.c.FourSymbolsTeamFormation;let resolve;
 t.c.FourSymbolsFirebaseLifecycle.readTeamFormation=()=>new Promise(done=>{resolve=done;});
 const reading=api.read();t.switchUid();resolve(await t.h.formation.read(t.h.request()));await reading;
 assert.equal(api.getConfirmed(),null);
 const b=client();await b.h.save();b.c.isHeroGrowthBattleActive=()=>true;await b.c.FourSymbolsTeamFormation.read();
 assert.equal(b.c.FourSymbolsTeamFormation.getConfirmed(),null);
 b.c.isHeroGrowthBattleActive=()=>false;b.c.FourSymbolsTeamFormation.projectToBattle();
 assert.deepEqual(JSON.parse(JSON.stringify(b.c.FourSymbolsTeamFormation.getConfirmed())),initial());
});
