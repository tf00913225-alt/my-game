import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import {storeHarness,selection,Timestamp} from '../scripts/test-helpers/canonical-store-harness.mjs';
const require=createRequire(import.meta.url);
const {assembleCanonicalCloudReadCandidate}=require('../functions/src/canonical-snapshot');

async function fixture(){
    const h=storeHarness();
    await h.initial.commitInitialSources(h.request(),{operationId:'publication-initial-0001',expectedRevision:1,selection});
    return h;
}
async function unchanged(h,operation){
    const before=JSON.stringify([...h.data]),writes=h.writes;
    try{return await operation();}
    finally{assert.equal(h.writes,writes);assert.equal(JSON.stringify([...h.data]),before);}
}
const prepare=(h,intent={expectedRevision:h.revision})=>h.initial.preparePublicationSources(h.request(),intent);

test('publication preparation reads original nonempty writer sources without publishing or writing',async()=>{
    const h=await fixture(),revision=h.revision;
    const candidate=await unchanged(h,()=>prepare(h));
    const records=h.data.get(`${h.root}/recoveryArchives/${revision}`).sourceRecords;
    assert.deepEqual(candidate,assembleCanonicalCloudReadCandidate(h.uid,revision,revision,records));
    assert.equal(candidate.cloudBundle.gameSave.player.id,records.characters[0].state.id);
    assert.equal(candidate.authoritativeStateReady,false);assert.equal(candidate.readyForPublication,false);
    assert.equal(h.data.get(h.save).cloudBundle,undefined);
    assert.equal(h.data.get(h.save).authoritativeStateReady,false);
});

test('publication preparation rejects stale revision, client state, foreign UID and replaced Session without writes',async()=>{
    const h=await fixture();
    for(const intent of [{expectedRevision:1},{expectedRevision:h.revision,gameSave:{}},
        {expectedRevision:'2'},{expectedRevision:Number.MAX_SAFE_INTEGER}]){
        await unchanged(h,()=>assert.rejects(prepare(h,intent)));
    }
    const old=h.request();h.setSession('b'.repeat(32));
    await unchanged(h,()=>assert.rejects(h.initial.preparePublicationSources(old,{expectedRevision:h.revision}),
        e=>e.code==='permission-denied'&&e.message==='SESSION_REVOKED_OR_UID_MISMATCH'));
    const foreign=h.request();foreign.auth.uid='another-uid';
    await unchanged(h,()=>assert.rejects(h.initial.preparePublicationSources(foreign,{expectedRevision:h.revision}),
        e=>e.code==='permission-denied'));
});

test('publication preparation refuses active or corrupt original Recovery fences without writes',async()=>{
    for(const corrupt of [false,true]){
        const h=await fixture(),stamp=Timestamp.fromMillis(h.clock);
        const fence={schemaVersion:1,kind:'canonical-recovery-audit-fence',ownerUid:h.uid,
            auditId:'publication-audit-0001',epoch:1,status:'active',sessionId:'a'.repeat(32),sessionRevision:1,
            sourceRevision:h.revision,sourceSha256:'a'.repeat(64),snapshotSha256:'b'.repeat(64),
            approvalOperationId:'publication-approval-0001',approvalBindingSha256:'c'.repeat(64),
            cancelOperationId:null,cancelIntentSha256:null,cancelledBySessionId:null,cancelledBySessionRevision:null,
            createdAt:stamp,updatedAt:stamp};
        if(corrupt)fence.ownerUid='another-uid';
        h.data.set(`${h.root}/recoveryAuditFence/current`,fence);
        await unchanged(h,()=>assert.rejects(prepare(h),e=>e.code===(corrupt?'data-loss':'failed-precondition')&&
            e.message===(corrupt?'Recovery audit fence is inconsistent.':'RECOVERY_AUDIT_MAINTENANCE')));
    }
});

test('publication preparation rejects current/source/archive/canonical cut divergence without writes',async()=>{
    for(const change of [h=>{h.data.get(h.save).serverRevision++;},
        h=>{h.data.get(`${h.root}/account/current`).serverRevision--;},
        h=>{h.data.get(`${h.root}/economy/current`).gold++;},
        h=>{h.data.delete(`${h.root}/claimCheckpoints/current`);},
        h=>{h.data.delete(`${h.root}/playableSnapshots/${h.revision}`);},
        h=>{h.data.get(`${h.root}/recoveryArchives/${h.revision}`).sourceRecords.economy.gold++;}]){
        const h=await fixture();change(h);
        await unchanged(h,()=>assert.rejects(prepare(h)));
    }
});

test('original subsequent writer advances the prepared wire; old expected revision cannot prepare again',async()=>{
    const h=await fixture(),first=await unchanged(h,()=>prepare(h));
    h.advance(86400000);
    await h.initial.observeDailyPeriod(h.request(),{operationId:'publication-observe-0001',expectedRevision:h.revision});
    assert.deepEqual(await unchanged(h,()=>prepare(h)),first,'period observation alone does not advance canonical state');
    const periodId='daily-period-'+require('../functions/src/daily-checkin-policy').taipeiDay(h.clock);
    await h.initial.applyDailyPeriod(h.request(),{operationId:'publication-apply-0001',expectedRevision:h.revision,periodId});
    const next=await unchanged(h,()=>prepare(h));
    assert.ok(next.cloudBundle.serverRevision>first.cloudBundle.serverRevision);
    assert.notEqual(next.sha256,first.sha256);
    assert.equal(next.cloudBundle.ownerUid,first.cloudBundle.ownerUid);
    await unchanged(h,()=>assert.rejects(prepare(h,{expectedRevision:first.cloudBundle.serverRevision}),
        e=>e.code==='aborted'&&e.message==='CLOUD_REVISION_CONFLICT'));
    assert.equal(next.authoritativeStateReady,false);assert.equal(next.readyForPublication,false);
});
