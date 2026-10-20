import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import {storeHarness,selection,copy} from '../scripts/test-helpers/canonical-store-harness.mjs';
const require=createRequire(import.meta.url);
const {createCanonicalSkillLearning,verifySkillLearningEvidence}=require('../functions/src/canonical-skill-learning.js');
const fail=(code,message)=>{throw Object.assign(new Error(message),{code});};
async function fixture(){
 const h=storeHarness();
 await h.initial.commitInitialSources(h.request(),{operationId:'skill_initial_0001',expectedRevision:h.revision,selection});
 const characterId=h.data.get(`${h.root}/account/current`).slots[0];
 const writer=createCanonicalSkillLearning(h.dependencies);
 const intent={operationId:'skill_learning_0001',expectedRevision:h.revision,characterId,action:'learn',skillId:'flameSlash'};
 return {...h,h,writer,intent,characterId};
}

test('genuine initial points learn through a stable character target and replay without a second debit',async()=>{
 const h=storeHarness();
 await h.initial.commitInitialSources(h.request(),{operationId:'skill_initial_0001',expectedRevision:h.revision,selection});
 const characterId=h.data.get(`${h.root}/account/current`).slots[0];
 const writer=createCanonicalSkillLearning(h.dependencies);
 const intent={operationId:'skill_learning_0001',expectedRevision:h.revision,characterId,action:'learn',skillId:'flameSlash'};
 const result=await writer.learnOrUpgrade(h.request(),intent);
 assert.equal(result.unchanged,false);
 assert.equal(h.data.get(`${h.root}/characters/${characterId}`).state.skillPoints,0);
 assert.equal(h.data.get(`${h.root}/characters/${characterId}`).skillLoadout.skillLevels.flameSlash,1);
 const writes=h.writes;
 assert.equal((await writer.learnOrUpgrade(h.request(),intent)).unchanged,true);
 assert.equal(h.writes,writes);
 assert.equal(h.data.get(`${h.root}/ledgerEntries/${intent.operationId}`).amount,-2);
});

test('original before/after archive proof rejects every missing original and corrupt policy, receipt or ledger without writes',async()=>{
 const {h,writer,intent}=await fixture();
 await writer.learnOrUpgrade(h.request(),intent);
 const original=new Map(h.data),op=`${h.root}/operations/${intent.operationId}`,ledger=`${h.root}/ledgerEntries/${intent.operationId}`;
 const verify=()=>h.dependencies.runProtected(h.request(),tx=>verifySkillLearningEvidence({tx,
  root:h.dependencies.db.collection('serverUsers').doc(h.uid),uid:h.uid,operationId:intent.operationId,
  currentRevision:h.revision,receipt:h.data.get(op),ledger:h.data.get(ledger),grantExists:false,fail}));
 await verify();
 const writes=h.writes;
 for(const path of ['playableSnapshots/2','recoveryArchives/2','playableSnapshots/3','recoveryArchives/3']){
  h.data.delete(`${h.root}/${path}`);await assert.rejects(verify(),{code:'data-loss'});
  h.data.set(`${h.root}/${path}`,original.get(`${h.root}/${path}`));
 }
 for(const field of ['policyVersion','policySha256','cost','pointsAfter','levelAfter','sourceRevision','snapshotSha256','createdAt']){
  h.data.set(op,{...original.get(op),[field]:field.includes('Revision')?99:'bad'});
  await assert.rejects(verify(),{code:'data-loss'});h.data.set(op,original.get(op));
 }
 h.data.set(ledger,{...original.get(ledger),amount:0});await assert.rejects(verify(),{code:'data-loss'});
 h.data.set(ledger,original.get(ledger));
 h.data.set(`${h.root}/grantOperations/${intent.operationId}`,{kind:'foreign'});
 await assert.rejects(verify(),{code:'data-loss'});
 assert.equal(h.writes,writes);
});

test('a rehashed non-server-created archive pair cannot grandfather ownership through the historical reader',async()=>{
 const {h,writer,intent}=await fixture();await writer.learnOrUpgrade(h.request(),intent);
 const {assembleCanonicalSnapshot,claimRecordsDigest}=require('../functions/src/canonical-snapshot');
 const {createRecoveryArchive}=require('../functions/src/canonical-recovery-archive');
 for(const revision of [2,3]){
  const records=copy(h.data.get(`${h.root}/recoveryArchives/${revision}`).sourceRecords);
  for(const value of Object.values(records))for(const row of Array.isArray(value)?value:[value])row.provenance='grandfathered-unverified-history';
  delete records.progress.playableState;
  for(const key of Object.keys(records.progress.sidecars))records.progress.sidecars[key]={status:'present',raw:'{}'};
  records.claimRecords=[{schemaVersion:1,ownerUid:h.uid,serverRevision:revision,provenance:'grandfathered-unverified-history',claimKey:'history-blocked',status:'blocked'}];
  records.claimCheckpoint={...records.claimCheckpoint,historicalClaimsBlocked:true,claimCount:1,claimDigest:claimRecordsDigest(records.claimRecords)};
  const bundle=assembleCanonicalSnapshot(h.uid,revision,records);
  h.data.set(`${h.root}/playableSnapshots/${revision}`,bundle);
  h.data.set(`${h.root}/recoveryArchives/${revision}`,createRecoveryArchive(h.uid,revision,records,bundle));
 }
 const op=`${h.root}/operations/${intent.operationId}`,ledger=`${h.root}/ledgerEntries/${intent.operationId}`;
 h.data.set(op,{...h.data.get(op),snapshotSha256:h.data.get(`${h.root}/playableSnapshots/3`).sha256});
 h.data.set(ledger,{...h.data.get(op),amount:-2});
 const writes=h.writes;
 await assert.rejects(writer.learnOrUpgrade(h.request(),intent),{code:'data-loss'});
 assert.equal(h.writes,writes);
});

test('only bounded intent crosses the writer, with stale/session/foreign/cost and unearned upgrade rejection',async()=>{
 const {h,writer,intent}=await fixture();const before=new Map(h.data),writes=h.writes;
 for(const patch of [{amount:1},{level:10},{state:{}},{skillId:'stormSpell'},{action:'equip'},
  {characterId:'foreign'},{operationId:'skill_learning_0001\n'}]){
  await assert.rejects(writer.learnOrUpgrade(h.request(),{...intent,...patch}));
  assert.deepEqual([...h.data],[...before]);assert.equal(h.writes,writes);
 }
 h.abortNext();await assert.rejects(writer.learnOrUpgrade(h.request(),intent),/rollback/);
 assert.deepEqual([...h.data],[...before]);assert.equal(h.writes,writes);
 await writer.learnOrUpgrade(h.request(),intent);
 const after=new Map(h.data),afterWrites=h.writes;
 await assert.rejects(writer.learnOrUpgrade(h.request(),{...intent,operationId:'skill_upgrade_00001',expectedRevision:h.revision,action:'upgrade'}),{code:'failed-precondition'});
 await assert.rejects(writer.learnOrUpgrade(h.request(),{...intent,skillId:'flameDance'}));
 await assert.rejects(writer.learnOrUpgrade(h.request(),{...intent,operationId:'skill_stale_000001'}),{code:'aborted'});
 h.setSession('replacement-session');
 await assert.rejects(writer.learnOrUpgrade({auth:{uid:h.uid},data:{uid:h.uid,session:{sessionId:'a'.repeat(32)}}},intent),{code:'permission-denied'});
 assert.deepEqual([...h.data],[...after]);assert.equal(h.writes,afterWrites);
});

test('retained v1 policy is a full immutable deployment snapshot of the formal catalogue, not a client policy claim',()=>{
 const policy=require('../functions/src/skill-learning-policy-v1.json');
 const formal=require('../functions/src/generated/player-skill-config-catalog.json');
 assert.deepEqual(policy.skills,formal.skills);assert.equal(policy.catalogSha256,formal.sha256);
 assert.ok(Object.isFrozen(policy));assert.ok(Object.isFrozen(policy.skills[0]));
});

test('retained v1 factory is explicit and semantic seal ignores presentation but refuses actual formula changes',async()=>{
 const {readFileSync}=await import('node:fs');
 const {skillLearningRuleSemanticDigest,verifySkillLearningPolicy}=await import('../scripts/lib/skill-learning-policy.mjs');
 const {fileURLToPath}=await import('node:url');
 const core=require('../functions/src/skill-progression-core');
 const source=readFileSync(new URL('../functions/src/skill-progression-core.js',import.meta.url),'utf8');
 const digest=skillLearningRuleSemanticDigest(source);
 assert.equal(digest,skillLearningRuleSemanticDigest('/* changed packaging only */\n'+source.replace('"use strict";','"use strict";\n\n')));
 assert.notEqual(digest,skillLearningRuleSemanticDigest(source.replace('base*(cross?2:1)','base*(cross?3:1)')));
 assert.notEqual(digest,skillLearningRuleSemanticDigest(source.replace('2:1,3:1','2:2,3:1')));
 assert.throws(()=>core.getRulesForVersion('v2',{},[]),RangeError);
 assert.throws(()=>core.getRulesForVersion('v1\n',{},[]),RangeError);
 assert.equal(verifySkillLearningPolicy(fileURLToPath(new URL('../',import.meta.url))),digest);
 const catalog=Object.fromEntries(require('../functions/src/skill-learning-policy-v1.json').skills.map(row=>[row.id,row]));
 const current=core.createRules(catalog,['flameSlash']),retained=core.getRulesForVersion('v1',catalog,['flameSlash']);
 for(const level of [1,10,20,90])assert.deepEqual(current.getSkillUpgradeEligibility({level,skillPoints:20},catalog.flameSlash,1),
  retained.getSkillUpgradeEligibility({level,skillPoints:20},catalog.flameSlash,1));
});

test('original Recovery restores learned skills from genuine history and replay does not mint a second skill debit',async()=>{
 const {h,writer,intent,characterId}=await fixture();await writer.learnOrUpgrade(h.request(),intent);
 const {createCanonicalCurrentRecovery}=require('../functions/src/canonical-current-recovery');
 const {createCanonicalRecoveryApproval}=require('../functions/src/canonical-recovery-approval');
 const operationId='skill_recovery_00001',revision=h.revision;
 await createCanonicalRecoveryApproval(h.dependencies).issue({auth:{uid:'skill-test-operator',token:{cloudSaveOperator:true}},
  data:{ownerUid:h.uid,operationId,sourceRevision:revision,ttlSeconds:300}});
 for(const name of ['account','economy','progress','relicLoadout','claimCheckpoints'])h.data.delete(`${h.root}/${name}/current`);
 h.data.delete(`${h.root}/characters/${characterId}`);
 const recovery=createCanonicalCurrentRecovery(h.dependencies);
 await recovery.restoreCurrent(h.request(),{operationId,expectedRevision:revision});
 assert.equal(h.data.get(`${h.root}/characters/${characterId}`).skillLoadout.skillLevels.flameSlash,1);
 assert.equal(h.data.get(`${h.root}/characters/${characterId}`).state.skillPoints,0);
 const writes=h.writes;
 assert.equal((await writer.learnOrUpgrade(h.request(),intent)).unchanged,true);
 assert.equal(h.writes,writes);
});

