import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import {storeHarness,selection} from '../scripts/test-helpers/canonical-store-harness.mjs';
const require=createRequire(import.meta.url);
const {createCanonicalSkillLearning}=require('../functions/src/canonical-skill-learning');
const {createCanonicalSkillLoadout,verifySkillLoadoutEvidence}=require('../functions/src/canonical-skill-loadout');
const fail=(code,message)=>{throw Object.assign(Error(message),{code});};
async function fixture(options){
    const h=storeHarness(options);
    await h.initial.commitInitialSources(h.request(),{operationId:'loadout_initial_0001',expectedRevision:h.revision,selection});
    const characterId=h.data.get(`${h.root}/account/current`).slots[0];
    await createCanonicalSkillLearning(h.dependencies).learnOrUpgrade(h.request(),{operationId:'loadout_learned_0001',
        expectedRevision:h.revision,characterId,action:'learn',skillId:'flameSlash'});
    const writer=createCanonicalSkillLoadout(h.dependencies);
    const intent={operationId:'loadout_equip_000001',expectedRevision:h.revision,characterId,action:'equip',skillId:'flameSlash'};
    return {h,writer,intent,characterId};
}

test('protected configuration read preserves v1/v2 presence without first-write admission or authority',async()=>{
    const {h,writer,intent,characterId}=await fixture(),reads=[];
    const reader=createCanonicalSkillLoadout({...h.dependencies,runProtected:(request,fn)=>h.dependencies.runProtected(request,(tx,session)=>
        fn({...tx,get:ref=>{reads.push(ref.path);return tx.get(ref);}},session))});
    const original=[...h.data],writes=h.writes;
    // Unrelated operation history is not an absence admission for a read.
    h.data.set(`${h.root}/operations/unknown-read-only-history`,{kind:'unknown'});
    const v1=await reader.readLoadout(h.request(),{expectedRevision:h.revision});
    assert.equal(v1.preferencesVersion,1);assert.equal(v1.ownerUid,h.uid);
    assert.equal(v1.serverRevision,h.revision);assert.equal(v1.canonicalRevision,h.revision);
    assert.deepEqual(v1.characters,[{characterId,slotIndex:0,skillLoadout:h.data.get(`${h.root}/characters/${characterId}`).skillLoadout}]);
    for(const name of ['autoConfig','autoConfig2','autoConfig3']){
        assert.deepEqual(v1[name],h.data.get(`${h.root}/progress/current`).playableState[name]);
        assert.equal(Object.hasOwn(v1[name],'v136ActionIntent'),false);assert.equal(Object.hasOwn(v1[name],'v136LastSkill'),false);
    }
    assert.equal(reads.some(path=>path.includes('/operations')),false);assert.equal(h.writes,writes);
    h.data.delete(`${h.root}/operations/unknown-read-only-history`);assert.deepEqual([...h.data],original);
    await writer.mutateLoadout(h.request(),intent);
    await writer.mutateLoadout(h.request(),{...intent,operationId:'loadout_read_selected01',expectedRevision:h.revision,action:'select-auto-action'});
    reads.length=0;const before=[...h.data],afterWrites=h.writes,v2=await reader.readLoadout(h.request(),{expectedRevision:h.revision});
    assert.equal(v2.preferencesVersion,2);assert.equal(v2.autoConfig.v136ActionIntent,'skill');assert.equal(v2.autoConfig.v136LastSkill,'flameSlash');
    assert.equal(Object.hasOwn(v2.autoConfig2,'v136ActionIntent'),false);assert.equal(Object.hasOwn(v2.autoConfig3,'v136LastSkill'),false);
    assert.ok(reads.includes(`${h.root}/operations/loadout_read_selected01`));
    for(const namespace of ['ledgerEntries','grantOperations'])assert.ok(reads.includes(`${h.root}/${namespace}/loadout_read_selected01`));
    for(const flag of ['authoritativeStateReady','readyForRestore','rewardEligible','outcomeVerified'])assert.equal(v2[flag],false);
    assert.deepEqual(Object.keys(v2).sort(),['schemaVersion','ownerUid','serverRevision','canonicalRevision','preferencesVersion','characters',
        'autoConfig','autoConfig2','autoConfig3','outcomeVerified','rewardEligible','readyForRestore','authoritativeStateReady'].sort());
    assert.equal(h.writes,afterWrites);assert.deepEqual([...h.data],before);
});

test('configuration reads reject stale revision, replaced identity and corrupt original sources/head without writes',async()=>{
    const {h,writer,intent}=await fixture();await writer.mutateLoadout(h.request(),intent);
    const before=[...h.data],writes=h.writes,read=value=>writer.readLoadout(h.request(),value);
    for(const value of [{},{expectedRevision:0},{expectedRevision:'4'},{expectedRevision:h.revision,rawState:{}},
        {expectedRevision:h.revision-1}])await assert.rejects(read(value));
    const head=`${h.root}/operations/${intent.operationId}`,archived=`${h.root}/recoveryArchives/${h.revision}`;
    for(const path of [head,archived]){const value=h.data.get(path);h.data.delete(path);
        await assert.rejects(read({expectedRevision:h.revision}),{code:'data-loss'});h.data.set(path,value);}
    await assert.rejects(writer.readLoadout({auth:{uid:'foreign'},data:h.request().data},{expectedRevision:h.revision}),{code:'permission-denied'});
    const request=h.request();h.setSession('b'.repeat(32));
    await assert.rejects(writer.readLoadout(request,{expectedRevision:h.revision}),{code:'permission-denied'});
    assert.equal(h.writes,writes);assert.deepEqual([...h.data].sort(),before.sort());
});

test('configuration read distinguishes a real Hero-only envelope revision from the canonical source revision',async()=>{
    const h=storeHarness();
    await h.initial.commitInitialSources(h.request(),{operationId:'loadout_read_initial01',expectedRevision:h.revision,selection});
    const {createHeroAcquisition}=require('../functions/src/hero-acquisition');
    const request=h.request();request.data.expectedRevision=h.revision;
    await createHeroAcquisition({...h.dependencies,seed:()=>1}).observeLogin(request);
    assert.equal(h.revision,3);assert.equal(h.data.get(`${h.root}/account/current`).serverRevision,2);
    const writes=h.writes,before=[...h.data];
    const result=await createCanonicalSkillLoadout(h.dependencies).readLoadout(h.request(),{expectedRevision:3});
    assert.equal(result.serverRevision,3);assert.equal(result.canonicalRevision,2);assert.equal(result.preferencesVersion,1);
    assert.equal(h.data.has(`${h.root}/playableSnapshots/3`),false);assert.equal(h.data.has(`${h.root}/recoveryArchives/3`),false);
    assert.equal(h.writes,writes);assert.deepEqual([...h.data],before);
});
test('actual learned ownership equips, explicitly remembers normal/defend/skill and removes with original primary sync',async()=>{
    const {h,writer,intent,characterId}=await fixture(),character=()=>h.data.get(`${h.root}/characters/${characterId}`);
    const points=character().state.skillPoints,eco={...h.data.get(`${h.root}/economy/current`)};
    const initial=h.data.get(`${h.root}/progress/current`).playableState;
    await writer.mutateLoadout(h.request(),intent);
    assert.deepEqual(character().skillLoadout.equippedSkills,['flameSlash']);
    let state=h.data.get(`${h.root}/progress/current`).playableState;
    assert.equal(state.preferencesVersion,2);
    for(const key of ['autoConfig','autoConfig2','autoConfig3'])assert.deepEqual(state[key],initial[key]);
    const run=(action,skillId,id)=>writer.mutateLoadout(h.request(),{...intent,action,skillId,expectedRevision:h.revision,operationId:id});
    await run('select-auto-action','flameSlash','loadout_select_00001');
    await run('select-auto-action','defend','loadout_defend_00001');
    state=h.data.get(`${h.root}/progress/current`).playableState;
    assert.equal(state.autoConfig.skill,'defend');assert.equal(state.autoConfig.v136ActionIntent,'defend');assert.equal(state.autoConfig.v136LastSkill,'flameSlash');
    await run('select-auto-action','flameSlash','loadout_select_00002');
    await run('remove','flameSlash','loadout_remove_00001');
    state=h.data.get(`${h.root}/progress/current`).playableState;
    assert.equal(state.autoConfig.skill,'normal');assert.equal(state.autoConfig.v136ActionIntent,'skill');assert.equal(state.autoConfig.v136LastSkill,'flameSlash');
    assert.deepEqual(character().skillLoadout.equippedSkills,[]);assert.equal(character().state.skillPoints,points);
    assert.deepEqual(h.data.get(`${h.root}/economy/current`),{...eco,serverRevision:h.revision,updatedAt:h.data.get(`${h.root}/economy/current`).updatedAt});
    for(const op of ['loadout_equip_000001','loadout_select_00001','loadout_remove_00001']){
        assert.equal(h.data.has(`${h.root}/ledgerEntries/${op}`),false);assert.equal(h.data.has(`${h.root}/grantOperations/${op}`),false);
    }
    const before=[...h.data],writes=h.writes;
    assert.equal((await writer.mutateLoadout(h.request(),intent)).unchanged,true);
    assert.equal(h.writes,writes);assert.deepEqual([...h.data],before);
});
test('original non-economic receipt proof reads exactly six originals/absences and rejects each corrupt original without writes',async()=>{
    const {h,writer,intent}=await fixture();await writer.mutateLoadout(h.request(),intent);
    const operation=`${h.root}/operations/${intent.operationId}`,receipt=h.data.get(operation),original=new Map(h.data),paths=[];
    const verify=()=>h.dependencies.runProtected(h.request(),tx=>verifySkillLoadoutEvidence({tx:{get:ref=>{paths.push(ref.path);return tx.get(ref);}},
        root:h.dependencies.db.collection('serverUsers').doc(h.uid),uid:h.uid,operationId:intent.operationId,currentRevision:h.revision,receipt:h.data.get(operation),fail}));
    await verify();assert.equal(paths.length,6);assert.equal(new Set(paths).size,6);
    const writes=h.writes;
    for(const path of paths.filter(path=>original.has(path))){h.data.delete(path);await assert.rejects(verify(),{code:'data-loss'});h.data.set(path,original.get(path));}
    for(const name of ['grantOperations','ledgerEntries']){
        const path=`${h.root}/${name}/${intent.operationId}`;h.data.set(path,{kind:'forged'});await assert.rejects(verify(),{code:'data-loss'});h.data.delete(path);
    }
    for(const field of ['policySha256','policyVersion','snapshotSha256','characterId','action','skillId','sourceRevision','resultRevision']){
        h.data.set(operation,{...receipt,[field]:field.endsWith('Revision')?999:'bad'});await assert.rejects(verify(),{code:'data-loss'});h.data.set(operation,receipt);
    }
    assert.equal(h.writes,writes);assert.deepEqual([...h.data].sort(),[...original].sort());
});
test('invalid/no-op/stale/foreign/session intents and rolled-back writes cannot mint an operation',async()=>{
    const {h,writer,intent}=await fixture();
    for(const patch of [{amount:0},{action:'learn'},{skillId:'unknown'},{characterId:'foreign'},
        {operationId:'loadout_equip_000001\n'},{action:'remove'},{action:'select-auto-action'}]){
        const before=[...h.data],writes=h.writes;
        await assert.rejects(writer.mutateLoadout(h.request(),{...intent,...patch}));assert.equal(h.writes,writes);assert.deepEqual([...h.data],before);
    }
    const before=[...h.data];h.abortNext();await assert.rejects(writer.mutateLoadout(h.request(),intent),/rollback/);assert.deepEqual([...h.data],before);
    await writer.mutateLoadout(h.request(),intent);
    const state=[...h.data],writes=h.writes;
    await assert.rejects(writer.mutateLoadout(h.request(),{...intent,operationId:'loadout_equip_again01',expectedRevision:h.revision}),{code:'failed-precondition'});
    await assert.rejects(writer.mutateLoadout(h.request(),{...intent,operationId:'loadout_stale_000001'}),{code:'aborted'});
    h.setSession('replacement-session');
    await assert.rejects(writer.mutateLoadout({auth:{uid:h.uid},data:{uid:h.uid,session:{sessionId:'a'.repeat(32)}}},intent),{code:'permission-denied'});
    assert.equal(h.writes,writes);assert.deepEqual([...h.data],state);
});

test('first admission scans the exact complete bounded operation namespace and refuses malformed or prior history',async()=>{
    const {h,intent}=await fixture(),reads=[];
    const writer=createCanonicalSkillLoadout({...h.dependencies,runProtected:(request,operation)=>h.dependencies.runProtected(request,(tx,session)=>
        operation({...tx,get:async ref=>{const value=await tx.get(ref);reads.push({path:ref.path,query:!!ref.query,maximum:ref.maximum,order:ref.order,
            count:value.docs?Math.max(1,value.size):1});return value;}},session))});
    const original=[...h.data],initial=`${h.root}/operations/loadout_initial_0001`,row=h.data.get(initial);
    for(const patch of [{kind:'unknown-kind'},{schemaVersion:2},{ownerUid:'foreign'},{sourceRevision:h.revision+1},
        {sourceRevision:'2'},{operationId:'wrong-operation-id'}]){
        h.data.set(initial,{...row,...patch});const before=[...h.data],writes=h.writes;
        await assert.rejects(writer.mutateLoadout(h.request(),intent));assert.equal(h.writes,writes);assert.deepEqual([...h.data],before);
        h.data.set(initial,row);
    }
    for(let index=0;index<399;index++)h.data.set(`${h.root}/operations/header-pressure-${String(index).padStart(4,'0')}`,{schemaVersion:1});
    const before=[...h.data],writes=h.writes;
    await assert.rejects(writer.mutateLoadout(h.request(),intent),/admission budget/);assert.equal(h.writes,writes);assert.deepEqual([...h.data],before);
    h.data.clear();for(const [key,value] of original)h.data.set(key,value);
    reads.length=0;await writer.mutateLoadout(h.request(),intent);
    const query=reads.filter(row=>row.query&&row.path===h.root+'/operations');
    assert.equal(query.length,1);assert.equal(query[0].maximum,401);assert.equal(query[0].order[0],'__name__');
    assert.equal(query[0].count,2);assert(reads.reduce((sum,row)=>sum+row.count,0)<=818);
});

test('a retained current head requires its exact original receipt and predecessor, with zero repair writes',async()=>{
    const {h,writer,intent}=await fixture();await writer.mutateLoadout(h.request(),intent);
    const path=`${h.root}/operations/${intent.operationId}`,original=h.data.get(path),writes=h.writes;
    const next={...intent,operationId:'loadout_select_00003',expectedRevision:h.revision,action:'select-auto-action'};
    for(const value of [undefined,{...original,previousLoadoutSource:{operationId:'unknown-previous-op',resultRevision:2,policySha256:'a'.repeat(64)}}]){
        if(value)h.data.set(path,value);else h.data.delete(path);
        const before=[...h.data];await assert.rejects(writer.mutateLoadout(h.request(),next),{code:'data-loss'});
        assert.equal(h.writes,writes);assert.deepEqual([...h.data],before);h.data.set(path,original);
    }
    await writer.mutateLoadout(h.request(),next);
    assert.deepEqual(h.data.get(`${h.root}/operations/${next.operationId}`).previousLoadoutSource,
        {operationId:intent.operationId,resultRevision:original.resultRevision,policySha256:original.policySha256});
});

test('optimistic same-operation and competing intents commit once and preserve the original receipt on retry',async()=>{
    const {h,intent}=await fixture({optimisticTransactions:true});
    // Reuse the shared fixture's SDK-style optimistic retry driver. The
    // production writer itself never retries or weakens a stale intent.
    const writer=createCanonicalSkillLoadout({...h.dependencies,runProtected:(_request,operation)=>h.dependencies.db.runTransaction(operation)});
    const same=await Promise.all([writer.mutateLoadout(h.request(),intent),writer.mutateLoadout(h.request(),intent)]);
    assert.equal(same.filter(row=>row.unchanged===false).length,1);assert.equal(same.filter(row=>row.unchanged).length,1);
    const base={...intent,action:'select-auto-action',expectedRevision:h.revision};
    const outcomes=await Promise.allSettled([writer.mutateLoadout(h.request(),{...base,operationId:'loadout_race_normal1',skillId:'normal'}),
        writer.mutateLoadout(h.request(),{...base,operationId:'loadout_race_defend1',skillId:'defend'})]);
    assert.equal(outcomes.filter(row=>row.status==='fulfilled').length,1);
    assert.equal(outcomes.filter(row=>row.status==='rejected'&&row.reason.code==='aborted').length,1);
});

test('lost responses replay original non-economic proof, while a first-admission namespace phantom is rechecked on SDK retry',async()=>{
    const {h,writer,intent}=await fixture();
    const lost=createCanonicalSkillLoadout({...h.dependencies,runProtected:async(request,operation)=>{
        await h.dependencies.runProtected(request,operation);throw Error('loadout response lost after commit');
    }});
    await assert.rejects(lost.mutateLoadout(h.request(),intent),/response lost/);
    const before=[...h.data],writes=h.writes;
    assert.equal((await writer.mutateLoadout(h.request(),intent)).unchanged,true);assert.equal(h.writes,writes);assert.deepEqual([...h.data],before);
    const fresh=await fixture({optimisticTransactions:true});let inserted=false,attempts=0;
    const racing=createCanonicalSkillLoadout({...fresh.h.dependencies,runProtected:(_request,operation)=>fresh.h.dependencies.db.runTransaction((tx,session)=>{
        attempts++;return operation({...tx,get:async ref=>{
            const row=await tx.get(ref);
            if(ref.query&&ref.path===fresh.h.root+'/operations'&&!inserted){
                inserted=true;fresh.h.data.set(fresh.h.root+'/operations/loadout_phantom_0001',
                    {schemaVersion:1,ownerUid:fresh.h.uid,operationId:'loadout_phantom_0001',kind:'unknown-future-kind'});
            }
            return row;
        }},session);
    })});
    const committed=fresh.h.writes,revision=fresh.h.revision;
    await assert.rejects(racing.mutateLoadout(fresh.h.request(),fresh.intent),{code:'failed-precondition'});
    assert.equal(attempts,2);assert.equal(fresh.h.writes,committed);assert.equal(fresh.h.revision,revision);
    assert.equal(fresh.h.data.has(fresh.h.root+'/operations/'+fresh.intent.operationId),false);
});

test('original approved current-source recovery closes the full loadout chain and rejects missing head or earlier receipts',async()=>{
    const {h,writer,intent,characterId}=await fixture();await writer.mutateLoadout(h.request(),intent);
    const selected={...intent,operationId:'loadout_selected_0004',expectedRevision:h.revision,action:'select-auto-action'};
    await writer.mutateLoadout(h.request(),selected);
    const {createCanonicalCurrentRecovery}=require('../functions/src/canonical-current-recovery');
    const {createCanonicalRecoveryApproval}=require('../functions/src/canonical-recovery-approval');
    const operationId='loadout_recovery_0001',revision=h.revision;
    const head={...h.data.get(`${h.root}/progress/current`).playableState.loadoutSource};
    await createCanonicalRecoveryApproval(h.dependencies).issue({auth:{uid:'loadout-test-operator',token:{cloudSaveOperator:true}},
        data:{ownerUid:h.uid,operationId,sourceRevision:revision,ttlSeconds:300}});
    for(const name of ['account','economy','progress','relicLoadout','claimCheckpoints'])h.data.delete(`${h.root}/${name}/current`);
    h.data.delete(`${h.root}/characters/${characterId}`);
    const recovery=createCanonicalCurrentRecovery(h.dependencies),writes=h.writes;
    for(const id of [intent.operationId,selected.operationId]){
        const path=`${h.root}/operations/${id}`,row=h.data.get(path);h.data.delete(path);const before=[...h.data];
        await assert.rejects(recovery.restoreCurrent(h.request(),{operationId,expectedRevision:revision}),{code:'data-loss'});
        assert.equal(h.writes,writes);assert.deepEqual([...h.data],before);h.data.set(path,row);
    }
    await recovery.restoreCurrent(h.request(),{operationId,expectedRevision:revision});
    assert.deepEqual(h.data.get(`${h.root}/progress/current`).playableState.loadoutSource,head);
    assert.deepEqual(h.data.get(`${h.root}/characters/${characterId}`).skillLoadout.equippedSkills,['flameSlash']);
    const after=h.writes;assert.equal((await writer.mutateLoadout(h.request(),intent)).unchanged,true);assert.equal(h.writes,after);
});
