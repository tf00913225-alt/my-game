import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire,Module} from 'node:module';
import {readFileSync} from 'node:fs';
import {dirname} from 'node:path';
import {storeHarness,selection,copy} from '../scripts/test-helpers/canonical-store-harness.mjs';
const require=createRequire(import.meta.url);
const {createSessionAuthority}=require('../functions/src/session-authority');
const {createCanonicalSourceWriter}=require('../functions/src/canonical-source-writer');
const {createCanonicalRecoveryApproval}=require('../functions/src/canonical-recovery-approval');
const {createCanonicalCurrentRecovery,createCanonicalRecoveryMaintenance}=require('../functions/src/canonical-current-recovery');
const auditId='maintenance-audit-operation',approvalId='maintenance-approval-op',publishId='maintenance-publication-op';
function fakeFactory(io){
    const filename=require.resolve('../functions/src/canonical-current-recovery'),compiled=new Module(filename);
    compiled.filename=filename;compiled.paths=Module._nodeModulePaths(dirname(filename));
    const native=compiled.require.bind(compiled);
    compiled.require=name=>name==='./recovery-candidate-storage'?{createRecoveryCandidateStorage:()=>io}:native(name);
    compiled._compile(readFileSync(filename,'utf8'),filename);return compiled.exports.createCanonicalRecoveryMaintenance;
}
function sdkDb(db){
    const reference=row=>({...row,collection:name=>query(row.collection(name))});
    const query=row=>({...row,doc:id=>reference(row.doc(id)),limit:n=>query(row.limit(n)),
        where:(...a)=>query(row.where(...a)),orderBy:(...a)=>query(row.orderBy(...a)),startAfter:s=>query(row.startAfter(s.ref?{path:s.ref.path}:s)),
        key:JSON.stringify([row.path,row.filters,row.maximum,row.order,row.after]),
        isEqual:other=>other?.key===JSON.stringify([row.path,row.filters,row.maximum,row.order,row.after]),
        get:()=>db.runTransaction(tx=>tx.get(row))});
    return {collection:name=>query(db.collection(name)),doc:path=>reference(db.doc(path)),runTransaction:operation=>db.runTransaction(operation)};
}
async function fixture(io){
    const h=storeHarness({optimisticTransactions:true}),sessions=createSessionAuthority(h.dependencies);
    let authTime=Math.floor(h.clock/1000),session=await sessions.create({auth:{uid:h.uid,token:{auth_time:authTime}},data:{uid:h.uid}});
    const request=()=>({auth:{uid:h.uid,token:{auth_time:authTime}},data:{uid:h.uid,session}});
    const deps={...h.dependencies,db:sdkDb(h.dependencies.db),runProtected:sessions.runProtected,runRecoveryAuditMaintenance:sessions.runRecoveryAuditMaintenance};
    await createCanonicalSourceWriter(deps).commitInitialSources(request(),{operationId:'maintenance-initial-character',expectedRevision:1,selection});
    await createCanonicalRecoveryApproval(deps).issue({auth:{uid:'operator',token:{cloudSaveOperator:true}},data:{ownerUid:h.uid,operationId:approvalId,sourceRevision:2,ttlSeconds:60}});
    const owner=io?fakeFactory(io)(deps):createCanonicalRecoveryMaintenance(deps);
    const invoke=(action,intent)=>owner.maintain({...request(),data:{...request().data,action,intent}});
    return {h,deps,owner,request,invoke,takeover:async()=>{h.advance(1000);authTime=Math.floor(h.clock/1000);session=await sessions.create(request());}};
}
const begin={operationId:auditId,expectedRevision:2,approvalOperationId:approvalId};
const binding={auditId,expectedEpoch:1};
test('constructors expose disjoint frozen APIs and reject external action/intent shapes before transaction or IO',async()=>{
    const h=storeHarness(),original=createCanonicalCurrentRecovery(h.dependencies);
    assert.deepEqual(Object.keys(original),['restoreCurrent','verifyRecoveryAuditArtifact','verifyRawRecoveryAuditCandidate','beginAudit','resumeAudit','cancelAudit','prepareInventory','captureInventoryPage','captureProof','captureRawInventory']);
    const owner=createCanonicalRecoveryMaintenance({...h.dependencies,immutableCandidateIO:{get bucketName(){throw Error('injected IO used');}}});
    assert.deepEqual(Object.keys(owner),['maintain']);assert(Object.isFrozen(owner));
    const data={uid:h.uid,session:{},action:'begin',intent:begin};
    const invalid=[null,[],{...data,extra:true},{...data,uid:3},{...data,session:null},{...data,session:[]},
        {...data,action:3},{...data,action:'captureProof'},{...data,action:'restoreCurrent'},{...data,intent:[]},
        {...data,intent:{...begin,operationId:1234567890123456}},{...data,intent:{...begin,expectedRevision:'2'}},
        ...['begin','resume','cancel','prepareInventory','captureInventoryPage','captureRawInventory','publish'].map(action=>({...data,action,intent:{...begin,rawBytes:'forged'}}))];
    for(const value of invalid)await assert.rejects(owner.maintain({data:value}),e=>e.code==='invalid-argument');
    assert.equal(h.commits,0);assert.equal(h.writes,0);
});
test('dispatcher audit lifecycle preserves original results, same-intent retry, session and expiry gates',async()=>{
    const f=await fixture();const original=createCanonicalCurrentRecovery(f.deps);
    const started=await f.invoke('begin',begin);assert.equal(started.epoch,1);
    assert.deepEqual(await f.invoke('begin',begin),await original.beginAudit(f.request(),begin));
    const resume={...binding,expectedRevision:2};
    const before=copy([...f.h.data]),writes=f.h.writes;
    const traces=[],native=f.h.dependencies.db.runTransaction;
    f.h.dependencies.db.runTransaction=operation=>native(async tx=>{
        const trace=[];traces.push(trace);const facade={get:ref=>{trace.push(['get',ref.path]);return tx.get(ref);}};
        for(const name of ['create','set','update','delete'])facade[name]=(...args)=>{trace.push([name,args[0].path]);return tx[name](...args);};
        return operation(facade);
    });
    assert.deepEqual(await f.invoke('resume',resume),await original.resumeAudit(f.request(),resume));
    assert.equal(traces.length,2);assert.deepEqual(traces[0],traces[1]);
    assert.equal(f.h.writes,writes);assert.deepEqual([...f.h.data],before);
    await assert.rejects(f.owner.maintain({...f.request(),data:{...f.request().data,uid:'foreign',action:'resume',intent:resume}}));
    await assert.rejects(f.owner.maintain({...f.request(),data:{...f.request().data,session:{},action:'resume',intent:resume}}));
    f.h.advance(61000);await assert.rejects(f.invoke('resume',resume),e=>e.code==='permission-denied'&&/current server operator approval/.test(e.message));
    await f.takeover();await assert.rejects(f.invoke('resume',resume),/session/i);
    const cancelled=await f.invoke('cancel',{...binding,operationId:'maintenance-cancel-operation'});
    assert.equal(cancelled.status,'cancelled');
    await assert.rejects(f.invoke('prepareInventory',{...binding,operationId:'maintenance-after-cancel'}));
});
test('all seven dispatcher actions use the original raw publication chain without exposing private identities or bytes',async()=>{
    let bytes=null,metadata=null,ioCalls=0;
    const io={bucketName:'private-fake-test-bucket',lookupMetadata:async()=>{ioCalls++;return metadata;},
        createOnly:async input=>{ioCalls++;bytes=Buffer.from(input.bytes);metadata={bucketName:input.bucketName,objectName:input.objectName,generation:'9007199254740993',size:bytes.length};return metadata;},
        readExact:async()=>{ioCalls++;return {metadata,bytes:Buffer.from(bytes)};}};
    const f=await fixture(io);await f.invoke('begin',begin);
    await f.invoke('resume',{...binding,expectedRevision:2});
    await f.invoke('prepareInventory',{...binding,operationId:'maintenance-inventory-prepare'});
    let page,sequence=0;
    do{page=await f.invoke('captureInventoryPage',{...binding,operationId:`maintenance-inventory-${String(++sequence).padStart(5,'0')}`,expectedSequence:sequence});}while(!page.inventoryExhausted);
    const run=f.h.root+'/recoveryAuditRuns/'+auditId,count=f.h.data.get(run+'/captureState/current').capturedCount;
    let offset=0;sequence=0;
    while(offset<count){const value=await f.invoke('captureRawInventory',{...binding,operationId:`maintenance-raw-${String(++sequence).padStart(6,'0')}`,expectedSequence:sequence,startOrdinal:offset,count:Math.min(16,count-offset)});offset=value.nextOrdinal;}
    const result=await f.invoke('publish',{...binding,operationId:publishId});
    assert.equal(result.status,'acknowledged');assert.equal(result.generation,'9007199254740993');assert(ioCalls>0);
    for(const name of ['candidateProofValid','trustedCaptureVerified','restoreAuthorized','authoritativeStateReady'])assert.equal(result[name],false);
    for(const name of ['bytes','records','identity','artifactBytes','objectName','bucketName'])assert.equal(Object.hasOwn(result,name),false);
    const writes=f.h.writes,retry=await f.invoke('publish',{...binding,operationId:publishId});
    assert.equal(retry.unchanged,true);assert.equal(f.h.writes,writes);
    await f.invoke('cancel',{...binding,operationId:'maintenance-finish-cancel'});
    await assert.rejects(f.invoke('publish',{...binding,operationId:publishId}));
});
