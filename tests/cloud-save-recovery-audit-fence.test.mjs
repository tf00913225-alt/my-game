import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {storeHarness,selection,copy} from './helpers/canonical-store-harness.mjs';
const require=createRequire(import.meta.url);
const {createSessionAuthority}=require('../functions/src/session-authority');
const {createCanonicalSourceWriter}=require('../functions/src/canonical-source-writer');
const {createCanonicalCurrentRecovery}=require('../functions/src/canonical-current-recovery');
const {createCanonicalRecoveryApproval}=require('../functions/src/canonical-recovery-approval');
const {createCanonicalPatrolSettlement}=require('../functions/src/canonical-patrol-settlement');
const {createHeroAcquisition}=require('../functions/src/hero-acquisition');
const {createDailyCheckinGrant}=require('../functions/src/daily-checkin-grant');
const approvalId='fence-approval-operation-0001',auditId='fence-audit-operation-000001',cancelId='fence-cancel-operation-00001';
async function fixture(){
    const h=storeHarness(),sessions=createSessionAuthority(h.dependencies);
    let authTime=Math.floor(h.clock/1000),session;
    const request=()=>({auth:{uid:h.uid,token:{auth_time:authTime}},data:{uid:h.uid,...(session?{session}:{} )}});
    session=await sessions.create(request());
    const deps={...h.dependencies,runProtected:sessions.runProtected,runRecoveryAuditMaintenance:sessions.runRecoveryAuditMaintenance};
    const initial=createCanonicalSourceWriter(deps),initialIntent={operationId:'fence-initial-creation-00001',expectedRevision:1,selection};
    await initial.commitInitialSources(request(),initialIntent);
    const approval=createCanonicalRecoveryApproval(deps),operator=operationId=>({auth:{uid:'fence-operator',token:{cloudSaveOperator:true}},
        data:{ownerUid:h.uid,operationId,sourceRevision:h.revision,ttlSeconds:60}});
    await approval.issue(operator(approvalId));
    const recovery=createCanonicalCurrentRecovery(deps),begin={operationId:auditId,expectedRevision:h.revision,approvalOperationId:approvalId};
    const takeover=async()=>{h.advance(1000);authTime=Math.floor(h.clock/1000);session=await sessions.create(request());return session;};
    return {h,sessions,request,deps,initial,initialIntent,approval,operator,recovery,begin,takeover,
        fencePath:h.root+'/recoveryAuditFence/current',runPath:h.root+'/recoveryAuditRuns/'+auditId};
}
async function refuses(f,operation,pattern){
    const before=copy([...f.h.data]),writes=f.h.writes;await assert.rejects(operation,pattern);
    assert.deepEqual([...f.h.data],before);assert.equal(f.h.writes,writes);
}
test('audit fences every protected write including private-zero intents while reads and original receipt retries remain available',async()=>{
    const f=await fixture(),{h,recovery,request,sessions}=f;
    const forest=createCanonicalPatrolSettlement({...f.deps,randomBytes:n=>Buffer.alloc(n,255)});
    const reopen={operationId:'fence-mode-reopen-00000001',expectedRevision:h.revision,expectedSequence:0,intent:'reopen',elementBox:'keep'};
    await forest.observePresence(request(),reopen);
    const result=await recovery.beginAudit(request(),f.begin);assert.equal(result.epoch,1);
    assert.equal((await recovery.beginAudit(request(),f.begin)).unchanged,true);
    assert.equal((await recovery.resumeAudit(request(),{auditId,expectedEpoch:1,expectedRevision:h.revision})).status,'active');
    const before=copy([...h.data]);
    assert.equal((await f.initial.commitInitialSources(request(),f.initialIntent)).unchanged,true);
    assert.equal((await forest.observePresence(request(),reopen)).unchanged,true);
    assert.equal((await sessions.protectedTest(request())).result,'SUCCESS');
    const hero=createHeroAcquisition({...f.deps,seed:()=>1});await hero.read(request());
    assert.deepEqual([...h.data],before);
    for(const method of ['create','set','update','delete'])await refuses(f,()=>sessions.runProtected(request(),tx=>{
        assert.equal(tx.firestore,undefined);assert.equal(tx.batch,undefined);
        return tx[method](h.dependencies.db.doc(h.root+'/unknownWriter/new'),{value:1});
    }),/RECOVERY_AUDIT_MAINTENANCE/);
    await refuses(f,()=>forest.observePresence(request(),{operationId:'fence-zero-heartbeat-00001',expectedRevision:h.revision,
        expectedSequence:1,intent:'heartbeat',elementBox:'keep'}),/RECOVERY_AUDIT_MAINTENANCE/);
    await refuses(f,()=>forest.beginSimulatedAd(request(),{operationId:'fence-ad-begin-0000000001',expectedRevision:h.revision,expectedSequence:1}),/RECOVERY_AUDIT_MAINTENANCE/);
    await refuses(f,()=>forest.issueTicket(request(),{operationId:'fence-forest-ticket-000001',expectedRevision:h.revision,
        triggerEntryId:'forest:0',availableEntryIds:['forest:0']}),/RECOVERY_AUDIT_MAINTENANCE/);
    await refuses(f,()=>hero.observeLogin({...request(),data:{...request().data,expectedRevision:h.revision}}),/RECOVERY_AUDIT_MAINTENANCE/);
    const daily=createDailyCheckinGrant(f.deps);
    await refuses(f,()=>daily.issue(request()),/RECOVERY_AUDIT_MAINTENANCE/);
    assert.equal((await f.approval.issue(f.operator(approvalId))).unchanged,true);
    await refuses(f,()=>f.approval.issue(f.operator('fence-new-approval-00000001')),/blocks new approvals/);
    await refuses(f,()=>sessions.runRecoveryAuditMaintenance(request(),auditId,tx=>
        tx.set(h.dependencies.db.doc(h.root+'/economy/current'),{gold:999})),/RECOVERY_AUDIT_WRITE_SCOPE/);
    await refuses(f,()=>sessions.runRecoveryAuditMaintenance(request(),auditId,tx=>
        tx.set(h.dependencies.db.doc('serverUsers/foreign/recoveryAuditFence/current'),{})),/RECOVERY_AUDIT_WRITE_SCOPE/);
    await refuses(f,()=>sessions.runRecoveryAuditMaintenance(request(),auditId,tx=>
        tx.delete(h.dependencies.db.doc(f.fencePath))),/RECOVERY_AUDIT_WRITE_SCOPE/);
    await refuses(f,()=>recovery.beginAudit(request(),{...f.begin,permit:true}),/exact recovery audit/);
    await refuses(f,()=>sessions.runProtected({...request(),data:{...request().data,maintenancePermit:true}},tx=>
        tx.set(h.dependencies.db.doc(h.root+'/requestPermit/blocked'),{})),/RECOVERY_AUDIT_MAINTENANCE/);
    const cancelled=await recovery.cancelAudit(request(),{operationId:cancelId,auditId,expectedEpoch:1});assert.equal(cancelled.status,'cancelled');
    assert.equal((await recovery.cancelAudit(request(),{operationId:cancelId,auditId,expectedEpoch:1})).unchanged,true);
    await forest.observePresence(request(),{operationId:'fence-after-cancel-zero-001',expectedRevision:h.revision,
        expectedSequence:1,intent:'heartbeat',elementBox:'keep'});
    assert.equal(h.data.get(h.root+'/modeTime/current').sequence,2);
});

test('epochs preserve historical begin/cancel retries, and revoke remains usable even with a corrupt fence',async()=>{
    const f=await fixture(),cancel={operationId:cancelId,auditId,expectedEpoch:1};
    await f.recovery.beginAudit(f.request(),f.begin);await f.recovery.cancelAudit(f.request(),cancel);
    const cancelledFence=copy(f.h.data.get(f.fencePath)),cancelledRun=copy(f.h.data.get(f.runPath));
    f.h.data.set(f.fencePath,{...cancelledFence,cancelIntentSha256:'e'.repeat(64)});
    f.h.data.set(f.runPath,{...cancelledRun,cancelIntentSha256:'e'.repeat(64)});
    await refuses(f,()=>f.recovery.cancelAudit(f.request(),cancel),/cancellation intent/);
    f.h.data.set(f.fencePath,cancelledFence);f.h.data.set(f.runPath,cancelledRun);
    const next={...f.begin,operationId:'fence-second-audit-0000001'};
    const result=await f.recovery.beginAudit(f.request(),next);assert.equal(result.epoch,2);
    const before=copy([...f.h.data]);
    assert.equal((await f.recovery.cancelAudit(f.request(),cancel)).unchanged,true);
    assert.equal((await f.recovery.beginAudit(f.request(),f.begin)).unchanged,true);assert.deepEqual([...f.h.data],before);
    await refuses(f,()=>f.recovery.resumeAudit(f.request(),{auditId,expectedEpoch:1,expectedRevision:f.h.revision}),/fence differ/);
    await refuses(f,()=>f.recovery.cancelAudit(f.request(),{...cancel,operationId:'fence-conflicting-cancel-01'}),/another intent/);
    f.h.data.set(f.fencePath,{corrupt:true});
    await f.sessions.revoke(f.request());
    assert.equal(f.h.data.get(f.h.root+'/sessionAuthority/current').status,'revoked');
    assert.deepEqual(f.h.data.get(f.fencePath),{corrupt:true});
});

test('takeover, revoke and expired approval do not unlock; current-session exact cancel works even after canonical source loss',async()=>{
    const f=await fixture();await f.recovery.beginAudit(f.request(),f.begin);const old=f.request();
    f.h.advance(61000);
    await refuses(f,()=>f.recovery.resumeAudit(f.request(),{auditId,expectedEpoch:1,expectedRevision:f.h.revision}),/operator approval/);
    await f.takeover();
    await refuses(f,()=>f.recovery.resumeAudit(f.request(),{auditId,expectedEpoch:1,expectedRevision:f.h.revision}),/epoch or session/);
    await refuses(f,()=>f.recovery.cancelAudit(old,{operationId:cancelId,auditId,expectedEpoch:1}),/SESSION_REVOKED/);
    await f.sessions.revoke(f.request());
    assert.equal(f.h.data.get(f.fencePath).status,'active');await f.takeover();f.h.advance(61000);
    assert.equal((await f.approval.issue(f.operator(approvalId))).expiresAtMs<f.h.clock,true);
    await refuses(f,()=>f.recovery.cancelAudit(f.request(),{operationId:cancelId,auditId,expectedEpoch:2}),/epoch differs/);
    f.h.data.delete(f.h.root+'/account/current');
    await f.recovery.cancelAudit(f.request(),{operationId:cancelId,auditId,expectedEpoch:1});
    assert.equal(f.h.data.get(f.fencePath).status,'cancelled');
});

test('begin and cancel stage both control records atomically, with safe exact retries after rollback',async()=>{
    const f=await fixture(),cancel={operationId:cancelId,auditId,expectedEpoch:1};
    f.h.abortNext();await refuses(f,()=>f.recovery.beginAudit(f.request(),f.begin),/simulated rollback/);
    assert.equal(f.h.data.has(f.fencePath),false);assert.equal(f.h.data.has(f.runPath),false);
    await f.recovery.beginAudit(f.request(),f.begin);
    f.h.abortNext();await refuses(f,()=>f.recovery.cancelAudit(f.request(),cancel),/simulated rollback/);
    assert.equal(f.h.data.get(f.fencePath).status,'active');assert.equal(f.h.data.get(f.runPath).status,'active');
    await f.recovery.cancelAudit(f.request(),cancel);
    assert.equal(f.h.data.get(f.fencePath).status,'cancelled');assert.equal(f.h.data.get(f.runPath).status,'cancelled');
});

test('binding corruption, stale revision, invalid metadata and callback retries fail closed without minting a permit',async()=>{
    const f=await fixture();await f.recovery.beginAudit(f.request(),f.begin);
    const bindingPath=f.h.root+'/recoveryApprovals/'+approvalId,approval=copy(f.h.data.get(bindingPath));
    f.h.data.set(bindingPath,{...approval,approvedBy:'other-operator'});
    await refuses(f,()=>f.recovery.resumeAudit(f.request(),{auditId,expectedEpoch:1,expectedRevision:f.h.revision}),/binding changed/);
    f.h.data.set(bindingPath,approval);
    const originalRun=copy(f.h.data.get(f.runPath));
    f.h.data.set(f.runPath,{...originalRun,beginIntentSha256:'f'.repeat(64)});
    await refuses(f,()=>f.recovery.resumeAudit(f.request(),{auditId,expectedEpoch:1,expectedRevision:f.h.revision}),/begin intent/);
    f.h.data.set(f.runPath,originalRun);
    for(const key of ['sourceSha256','snapshotSha256']){
        const fence=copy(f.h.data.get(f.fencePath)),run=copy(f.h.data.get(f.runPath));
        f.h.data.set(f.fencePath,{...fence,[key]:'f'.repeat(64)});f.h.data.set(f.runPath,{...run,[key]:'f'.repeat(64)});
        await refuses(f,()=>f.recovery.resumeAudit(f.request(),{auditId,expectedEpoch:1,expectedRevision:f.h.revision}),/binding changed/);
        f.h.data.set(f.fencePath,fence);f.h.data.set(f.runPath,run);
    }
    await refuses(f,()=>f.recovery.resumeAudit(f.request(),{auditId,expectedEpoch:1,expectedRevision:f.h.revision+1}),/epoch or session/);
    const fence=copy(f.h.data.get(f.fencePath));f.h.data.set(f.fencePath,{...fence,schemaVersion:99});
    await refuses(f,()=>f.sessions.runProtected(f.request(),tx=>tx.set(f.h.dependencies.db.doc(f.h.root+'/unknown/new'),{})),/fence is inconsistent/);
    assert.equal((await f.approval.issue(f.operator(approvalId))).unchanged,true);
    await refuses(f,()=>f.approval.issue(f.operator('fence-corrupt-approval-001')),/fence is inconsistent/);
    f.h.data.set(f.fencePath,fence);
    const original=f.h.dependencies.db.runTransaction;let firstFacade,attempt=0;
    f.h.data.delete(f.fencePath);
    f.h.dependencies.db.runTransaction=callback=>original(async tx=>{
        await callback(tx);f.h.data.set(f.fencePath,fence);return callback(tx);
    });
    try{
        await assert.rejects(()=>f.sessions.runProtected(f.request(),tx=>{
            if(++attempt===1){firstFacade=tx;return 'retry';}
            assert.notEqual(tx,firstFacade);return tx.set(f.h.dependencies.db.doc(f.h.root+'/retry/new'),{});
        }),/RECOVERY_AUDIT_MAINTENANCE/);
        assert.equal(attempt,2);assert.equal(f.h.data.has(f.h.root+'/retry/new'),false);
    }finally{f.h.dependencies.db.runTransaction=original;}
});
