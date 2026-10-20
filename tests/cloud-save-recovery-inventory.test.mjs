import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {storeHarness,selection,copy} from '../scripts/test-helpers/canonical-store-harness.mjs';
const require=createRequire(import.meta.url);
const {createSessionAuthority}=require('../functions/src/session-authority');
const {createCanonicalSourceWriter}=require('../functions/src/canonical-source-writer');
const {createCanonicalCurrentRecovery}=require('../functions/src/canonical-current-recovery');
const {createCanonicalRecoveryApproval}=require('../functions/src/canonical-recovery-approval');
const {createCanonicalPatrolSettlement}=require('../functions/src/canonical-patrol-settlement');
const {snapshotDigest}=require('../functions/src/canonical-snapshot');
const {recoveryAuditNamespaces,decodeInventoryPayload,encodeInventoryPayload}=require('../functions/src/recovery-audit-artifact');
const auditId='inventory-audit-operation-001',approvalId='inventory-approval-00000001';
async function fixture(){
    const h=storeHarness({optimisticTransactions:true}),sessions=createSessionAuthority(h.dependencies);let session,authTime=Math.floor(h.clock/1000);
    const request=()=>({auth:{uid:h.uid,token:{auth_time:authTime}},data:{uid:h.uid,...(session?{session}:{})}});
    session=await sessions.create(request());
    const deps={...h.dependencies,runProtected:sessions.runProtected,runRecoveryAuditMaintenance:sessions.runRecoveryAuditMaintenance};
    await createCanonicalSourceWriter(deps).commitInitialSources(request(),{operationId:'inventory-initial-operation-01',expectedRevision:1,selection});
    const forest=createCanonicalPatrolSettlement(deps);
    for(let index=0;index<18;index++)await forest.observePresence(request(),{operationId:`inventory-presence-${String(index).padStart(8,'0')}`,
        expectedRevision:h.revision,expectedSequence:index,intent:index?'heartbeat':'reopen',elementBox:'keep'});
    await createCanonicalRecoveryApproval(deps).issue({auth:{uid:'inventory-operator',token:{cloudSaveOperator:true}},
        data:{ownerUid:h.uid,operationId:approvalId,sourceRevision:h.revision,ttlSeconds:60}});
    const recovery=createCanonicalCurrentRecovery(deps);await recovery.beginAudit(request(),{operationId:auditId,expectedRevision:h.revision,approvalOperationId:approvalId});
    const root=h.root+'/recoveryAuditRuns/'+auditId,statePath=root+'/captureState/current',pagePath=id=>root+'/inventoryPages/'+id;
    const base=h.dependencies.db.runTransaction,traces=[];
    h.dependencies.db.runTransaction=callback=>base(async tx=>{
        const trace={reads:0,queries:0,writes:0,paths:[]};traces.push(trace);
        const traced={...tx,get:async reference=>{const row=await tx.get(reference);trace.reads+=row.docs?Math.max(1,row.size):1;
            trace.queries+=row.docs?1:0;trace.paths.push(reference.path);return row;}};
        for(const method of ['create','set','update','delete'])traced[method]=(...args)=>{trace.writes++;return tx[method](...args);};
        return callback(traced);
    });
    return {h,sessions,request,recovery,deps,traces,statePath,pagePath,
        prepare:{auditId,expectedEpoch:1,operationId:'inventory-prepare-operation-01'},
        takeover:async()=>{h.advance(1000);authTime=Math.floor(h.clock/1000);session=await sessions.create(request());}};
}
const intent=sequence=>({auditId,expectedEpoch:1,operationId:`inventory-page-${String(sequence).padStart(10,'0')}`,expectedSequence:sequence});
async function rejectUnchanged(f,operation,pattern){const before=copy([...f.h.data]),writes=f.h.writes;
    await assert.rejects(operation,pattern);assert.deepEqual([...f.h.data],before);assert.equal(f.h.writes,writes);}
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
test('all fixed namespaces use exact SDK versions, true empty pages and bounded actual read/write traces',async()=>{
    const f=await fixture(),before=copy([...f.h.data]),prepared=await f.recovery.prepareInventory(f.request(),f.prepare);
    assert.equal(f.traces.at(-1).reads,10);assert.equal(f.traces.at(-1).writes,1);assert.equal(prepared.nextSequence,1);
    const prepareRetry=await f.recovery.prepareInventory(f.request(),f.prepare);assert.equal(prepareRetry.unchanged,true);assert.equal(f.traces.at(-1).reads,10);
    const names=recoveryAuditNamespaces(f.h.uid,2),counts=[],seen=new Map(names.map(name=>[name,[]]));let exhausted=false,sequence=1;
    while(!exhausted){
        assert(sequence<100);const input=intent(sequence),result=await f.recovery.captureInventoryPage(f.request(),input),trace=f.traces.at(-1);
        assert.equal(trace.queries,1);assert.equal(trace.reads,11+Math.max(1,result.entryCount));assert(trace.reads<=27);assert.equal(trace.writes,2);
        for(const key of ['authoritativeStateReady','candidateProofValid','trustedCaptureVerified','restoreAuthorized'])assert.equal(result[key],false);
        const raw=f.h.data.get(f.pagePath(input.operationId)),payload=decodeInventoryPayload(raw.payloadBytes);assert(raw.payloadBytes.length<=128*1024);
        assert.equal(raw.payloadSha256,sha(raw.payloadBytes));assert.equal(payload.namespacePath,names[result.namespaceIndex]);
        if(payload.namespacePath.endsWith('/modeTimeEvents'))counts.push(result.entryCount);
        for(const row of payload.entries){
            assert.deepEqual(Object.keys(row).sort(),['id','typedDataByteLength','typedDataSha256','updateTime']);
            assert(Number.isInteger(row.updateTime.nanoseconds));assert(row.typedDataByteLength>0);seen.get(payload.namespacePath).push(row.id);
        }
        if(!result.entryCount)assert.equal(result.terminalEmpty,true);else assert.equal(result.terminalEmpty,false);
        const snapshot=copy([...f.h.data]),retry=await f.recovery.captureInventoryPage(f.request(),input);
        assert.deepEqual(retry,{...result,unchanged:true});assert.equal(f.traces.at(-1).reads,11);assert.equal(f.traces.at(-1).queries,0);assert.equal(f.traces.at(-1).writes,0);
        assert.deepEqual([...f.h.data],snapshot);exhausted=result.inventoryExhausted;sequence++;
    }
    assert.deepEqual(counts,[16,2,0]);
    for(const path of names){const actual=[...f.h.data.keys()].filter(key=>key.startsWith(path+'/')&&!key.slice(path.length+1).includes('/'))
        .map(key=>key.slice(path.length+1)).sort((a,b)=>Buffer.compare(Buffer.from(a),Buffer.from(b)));assert.deepEqual(seen.get(path),actual);}
    for(const [path,value] of before)assert.deepEqual(f.h.data.get(path),value,'inventory does not update root run/fence/approval or assets');
    assert.equal(f.h.data.get(f.statePath).phase,'inventory');assert.equal(f.h.data.get(f.statePath).inventoryExhausted,true);
    await rejectUnchanged(f,()=>f.recovery.captureInventoryPage(f.request(),intent(sequence)),/cursor is not current/);
    // A historical committed page retry returns its own seal, not today's cursor.
    assert.equal((await f.recovery.captureInventoryPage(f.request(),intent(1))).unchanged,true);assert.equal(f.traces.at(-1).queries,0);
});
test('rollback, exact retry and optimistic same-sequence races commit one immutable page',async()=>{
    const f=await fixture();f.h.abortNext();await rejectUnchanged(f,()=>f.recovery.prepareInventory(f.request(),f.prepare),/rollback/);
    await f.recovery.prepareInventory(f.request(),f.prepare);f.h.abortNext();await rejectUnchanged(f,()=>f.recovery.captureInventoryPage(f.request(),intent(1)),/rollback/);
    const before=f.h.writes;const results=await Promise.all([f.recovery.captureInventoryPage(f.request(),intent(1)),f.recovery.captureInventoryPage(f.request(),intent(1))]);
    assert.deepEqual(results.map(row=>row.unchanged).sort(),[false,true]);assert.equal(f.h.writes-before,2);
    assert.equal(f.h.data.get(f.statePath).nextSequence,2);assert.equal(f.traces.at(-1).queries,0);
    await rejectUnchanged(f,()=>f.recovery.captureInventoryPage(f.request(),{...intent(1),operationId:'inventory-conflicting-page-01'}),/cursor/);
    await rejectUnchanged(f,()=>f.recovery.captureInventoryPage(f.request(),{...intent(1),expectedSequence:2}),/page seal/);
    await rejectUnchanged(f,()=>f.recovery.prepareInventory(f.request(),{...f.prepare,operationId:'inventory-prepare-another-01'}),/another intent/);
});
test('every retry checks live epoch/session/expiry, and cancel leaves all inventory evidence retained',async()=>{
    const f=await fixture();await f.recovery.prepareInventory(f.request(),f.prepare);await f.recovery.captureInventoryPage(f.request(),intent(1));
    const page=copy(f.h.data.get(f.pagePath(intent(1).operationId)));f.h.advance(60000);
    await rejectUnchanged(f,()=>f.recovery.captureInventoryPage(f.request(),intent(1)),/operator approval/);
    f.h.advance(-60000);await f.takeover();
    await rejectUnchanged(f,()=>f.recovery.captureInventoryPage(f.request(),intent(1)),/epoch or session/);
    await f.recovery.cancelAudit(f.request(),{operationId:'inventory-cancel-operation-01',auditId,expectedEpoch:1});
    await rejectUnchanged(f,()=>f.recovery.captureInventoryPage(f.request(),intent(2)),/epoch or session/);
    assert.deepEqual(f.h.data.get(f.pagePath(intent(1).operationId)),page);
});
test('invalid cursor, page bytes/shape, foreign paths and missing exact updateTime fail without any writes',async()=>{
    const f=await fixture();await f.recovery.prepareInventory(f.request(),f.prepare);await f.recovery.captureInventoryPage(f.request(),intent(1));
    const state=copy(f.h.data.get(f.statePath)),pagePath=f.pagePath(intent(1).operationId),page=copy(f.h.data.get(pagePath));
    f.h.data.set(f.statePath,{...state,afterDocumentId:'../foreign'});
    await rejectUnchanged(f,()=>f.recovery.captureInventoryPage(f.request(),intent(2)),/state/);f.h.data.set(f.statePath,state);
    for(const mutate of [
        p=>{p.payloadBytes[0]^=1;},p=>{p.ownerUid='foreign';},
        p=>{const v=copy(decodeInventoryPayload(p.payloadBytes));v.namespacePath='serverUsers/foreign/account';p.payloadBytes=encodeInventoryPayload(v);p.payloadSha256=sha(p.payloadBytes);},
        p=>{const v=copy(decodeInventoryPayload(p.payloadBytes));v.entries[0].updateTime.nanoseconds=1000000000;p.payloadBytes=encodeInventoryPayload(v);p.payloadSha256=sha(p.payloadBytes);},
        p=>{const v=copy(decodeInventoryPayload(p.payloadBytes));v.terminalEmpty=true;p.payloadBytes=encodeInventoryPayload(v);p.payloadSha256=sha(p.payloadBytes);}
    ]){const changed=copy(page);mutate(changed);f.h.data.set(pagePath,changed);await rejectUnchanged(f,()=>f.recovery.captureInventoryPage(f.request(),intent(1)));}
    f.h.data.set(pagePath,page);
    // Current namespace account has only one row: this page is true-empty;
    // the following characters page is nonempty and must have SDK metadata.
    await f.recovery.captureInventoryPage(f.request(),intent(2));
    const base=f.h.dependencies.db.runTransaction;
    f.h.dependencies.db.runTransaction=callback=>base(tx=>callback({...tx,get:async ref=>{
        const row=await tx.get(ref);return row.docs?{...row,docs:row.docs.map(doc=>({...doc,updateTime:undefined}))}:row;
    }}));
    try{await rejectUnchanged(f,()=>f.recovery.captureInventoryPage(f.request(),intent(3)),/timestamp/);}
    finally{f.h.dependencies.db.runTransaction=base;}
    await rejectUnchanged(f,()=>f.recovery.captureInventoryPage(f.request(),{...intent(3),namespace:'foreign'}),/exact/);
    await rejectUnchanged(f,()=>f.sessions.runRecoveryAuditMaintenance(f.request(),auditId,tx=>tx.set(f.h.dependencies.db.doc(pagePath),page)),/WRITE_SCOPE/);
    await rejectUnchanged(f,()=>f.sessions.runRecoveryAuditMaintenance(f.request(),auditId,tx=>tx.create(f.h.dependencies.db.doc(pagePath+'/nested/foreign'),{})),/WRITE_SCOPE/);
});
test('unsupported source data and resource failures do not persist a blocked or partial page',async()=>{
    const f=await fixture();await f.recovery.prepareInventory(f.request(),f.prepare);
    const accountPath=f.h.root+'/account/current',account=copy(f.h.data.get(accountPath));
    f.h.data.set(accountPath,{...account,unsupported:Buffer.from('not an admitted artifact value')});
    await rejectUnchanged(f,()=>f.recovery.captureInventoryPage(f.request(),intent(1)),/unsupported typed value/);
    assert.equal(f.h.data.get(f.statePath).phase,'preparing');assert.equal(f.h.data.has(f.pagePath(intent(1).operationId)),false);
    f.h.data.set(accountPath,account);
    assert.throws(()=>encodeInventoryPayload({large:'x'.repeat(128*1024)}),/payload size/);
    const sparse=[];sparse.length=1;assert.throws(()=>encodeInventoryPayload({sparse}),/sparse/);
    let deep=null;for(let index=0;index<66;index++)deep=[deep];assert.throws(()=>encodeInventoryPayload({deep}),/resource limit/);
    await f.recovery.captureInventoryPage(f.request(),intent(1));
    assert.equal(f.h.data.get(f.statePath).phase,'inventory');
});
