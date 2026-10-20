import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import {storeHarness,selection} from '../scripts/test-helpers/canonical-store-harness.mjs';
const require=createRequire(import.meta.url);
const {createCanonicalSkillLearning}=require('../functions/src/canonical-skill-learning');
const {createCanonicalSkillLoadout,verifySkillLoadoutEvidence}=require('../functions/src/canonical-skill-loadout');
const fail=(code,message)=>{throw Object.assign(Error(message),{code});};
async function fixture(){
    const h=storeHarness();
    await h.initial.commitInitialSources(h.request(),{operationId:'loadout_initial_0001',expectedRevision:h.revision,selection});
    const characterId=h.data.get(`${h.root}/account/current`).slots[0];
    await createCanonicalSkillLearning(h.dependencies).learnOrUpgrade(h.request(),{operationId:'loadout_learned_0001',
        expectedRevision:h.revision,characterId,action:'learn',skillId:'flameSlash'});
    const writer=createCanonicalSkillLoadout(h.dependencies);
    const intent={operationId:'loadout_equip_000001',expectedRevision:h.revision,characterId,action:'equip',skillId:'flameSlash'};
    return {h,writer,intent,characterId};
}
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
