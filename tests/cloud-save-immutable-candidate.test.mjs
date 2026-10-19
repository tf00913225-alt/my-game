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
const {createCanonicalCurrentRecovery}=require('../functions/src/canonical-current-recovery');
const {createCanonicalPatrolSettlement}=require('../functions/src/canonical-patrol-settlement');
const auditId='immutable-candidate-audit-001',operationId='immutable-publication-0001';
const args={auditId,expectedEpoch:1,operationId};
function lexicalFactory(enabled){
    const filename=require.resolve('../functions/src/canonical-current-recovery'),compiled=new Module(filename);
    compiled.filename=filename;compiled.paths=Module._nodeModulePaths(dirname(filename));
    let source=readFileSync(filename,'utf8');
    const needle='return Object.freeze({restoreCurrent,verifyRecoveryAuditArtifact';
    assert.equal(source.split(needle).length,2);
    source=source.replace(needle,'return Object.freeze({pinCandidatePublication,loadPinnedRawCapture,assemblePinnedCandidate,prepareCandidatePublication,restoreCurrent,verifyRecoveryAuditArtifact');
    if(enabled)source=source.replace('const immutableCandidateIO=null;','const immutableCandidateIO=Object.freeze({bucketName:"private-fake-test-bucket"});');
    compiled._compile(source,filename);return compiled.exports.createCanonicalCurrentRecovery;
}
// Only the fixture adapts its in-memory references to SDK public query APIs.
// No production constructor accepts an adapter or an authority/ready flag.
function sdkDb(db){
    const reference=row=>({...row,collection:name=>query(row.collection(name))});
    const query=row=>({...row,doc:id=>reference(row.doc(id)),limit:n=>query(row.limit(n)),
        where:(...a)=>query(row.where(...a)),orderBy:(...a)=>query(row.orderBy(...a)),startAfter:s=>query(row.startAfter(s.ref?{path:s.ref.path}:s)),
        key:JSON.stringify([row.path,row.filters,row.maximum,row.order,row.after]),
        isEqual:other=>other?.key===JSON.stringify([row.path,row.filters,row.maximum,row.order,row.after]),
        get:()=>db.runTransaction(tx=>tx.get(row))});
    return {collection:name=>query(db.collection(name)),doc:path=>reference(db.doc(path)),runTransaction:operation=>db.runTransaction(operation)};
}
async function fixture(){
    const h=storeHarness({optimisticTransactions:true}),sessions=createSessionAuthority(h.dependencies);
    let authTime=Math.floor(h.clock/1000),session=await sessions.create({auth:{uid:h.uid,token:{auth_time:authTime}},data:{uid:h.uid}});
    const request=()=>({auth:{uid:h.uid,token:{auth_time:authTime}},data:{uid:h.uid,session}});
    const deps={...h.dependencies,db:sdkDb(h.dependencies.db),runProtected:sessions.runProtected,runRecoveryAuditMaintenance:sessions.runRecoveryAuditMaintenance};
    await createCanonicalSourceWriter(deps).commitInitialSources(request(),{operationId:'immutable-initial-character',expectedRevision:1,selection});
    const forest=createCanonicalPatrolSettlement({...deps,randomBytes:n=>Buffer.alloc(n)});
    await forest.observePresence(request(),{operationId:'immutable-presence-reopen',expectedRevision:2,expectedSequence:0,intent:'reopen',elementBox:'keep'});
    const ticketId='immutable-forest-ticket-001';
    await forest.issueTicket(request(),{operationId:ticketId,expectedRevision:2,triggerEntryId:'forest:0',availableEntryIds:['forest:0']});
    await forest.settleMember(request(),{operationId:'immutable-forest-member-001',expectedRevision:h.revision,ticketId,memberIndex:0});
    await forest.settleTerminal(request(),{operationId:'immutable-forest-win-00001',expectedRevision:h.revision,ticketId,kind:'win'});
    const approvalOperationId='immutable-operator-approval';
    await createCanonicalRecoveryApproval(deps).issue({auth:{uid:'operator',token:{cloudSaveOperator:true}},data:{ownerUid:h.uid,operationId:approvalOperationId,sourceRevision:h.revision,ttlSeconds:60}});
    const original=createCanonicalCurrentRecovery(deps);
    await original.beginAudit(request(),{operationId:auditId,expectedRevision:h.revision,approvalOperationId});
    await original.prepareInventory(request(),{...args,operationId:'immutable-inventory-prepare'});
    let page,sequence=0;
    do{page=await original.captureInventoryPage(request(),{...args,operationId:`immutable-inventory-${String(++sequence).padStart(5,'0')}`,expectedSequence:sequence});}while(!page.inventoryExhausted);
    const root=h.root+'/recoveryAuditRuns/'+auditId;
    const count=h.data.get(root+'/captureState/current').capturedCount;let offset=0;sequence=0;
    while(offset<count){const value=await original.captureRawInventory(request(),{...args,operationId:`immutable-raw-${String(++sequence).padStart(6,'0')}`,
        expectedSequence:sequence,startOrdinal:offset,count:Math.min(16,count-offset)});offset=value.nextOrdinal;}
    const traces=[],native=h.dependencies.db.runTransaction;
    h.dependencies.db.runTransaction=callback=>native(async tx=>{
        const trace={points:0,queries:0,writes:0};traces.push(trace);
        const facade={get:ref=>{trace[ref.query?'queries':'points']++;return tx.get(ref);}};
        for(const name of ['create','set','update','delete'])facade[name]=(...a)=>{trace.writes++;return tx[name](...a);};
        return callback(facade);
    });
    return {h,deps,request,root,sessions,original,traces,
        private:lexicalFactory(true)(deps),disabled:lexicalFactory(false)(deps),
        takeover:async()=>{h.advance(1000);authTime=Math.floor(h.clock/1000);session=await sessions.create({auth:{uid:h.uid,token:{auth_time:authTime}},data:{uid:h.uid}});}};
}
async function artifact(f){const pin=await f.private.pinCandidatePublication(f.request(),args);
    const material=await f.private.loadPinnedRawCapture(pin);return {pin,artifact:await f.private.assemblePinnedCandidate(pin,material)};}
test('publication preparation stays private and production-unavailable before reads; forged identities cannot mint origin',async()=>{
    const f=await fixture(),before=copy([...f.h.data]),writes=f.h.writes;f.traces.length=0;
    for(const name of ['pinCandidatePublication','loadPinnedRawCapture','assemblePinnedCandidate','prepareCandidatePublication'])assert.equal(Object.hasOwn(f.original,name),false);
    await assert.rejects(f.disabled.pinCandidatePublication(f.request(),args),/unavailable/);
    await assert.rejects(f.private.loadPinnedRawCapture(Object.freeze({})),/original private/);
    await assert.rejects(f.private.prepareCandidatePublication(f.request(),{},{}),/original private/);
    assert.equal(f.traces.length,0);assert.equal(f.h.writes,writes);assert.deepEqual([...f.h.data],before);
});
test('actual raw capture prepares one immutable manifest with thirteen point reads; replay is read-only',async()=>{
    const f=await fixture();f.traces.length=0;
    const {pin,artifact:identity}=await artifact(f);
    assert.deepEqual(f.traces[0],{points:13,queries:0,writes:0});
    assert(f.traces.slice(1).every(trace=>trace.points===0&&trace.queries===1&&trace.writes===0),'outside scan accounted separately');
    f.traces.length=0;
    const prepared=await f.private.prepareCandidatePublication(f.request(),pin,identity);
    assert.deepEqual(prepared,{});assert(Object.isFrozen(prepared));
    assert.deepEqual(f.traces,[{points:13,queries:0,writes:1}]);
    const path=f.root+'/candidatePublications/'+operationId,record=copy(f.h.data.get(path));
    assert.equal(record.status,'prepared');assert.equal(record.bucketName,'private-fake-test-bucket');assert(record.artifactByteLength>0);
    for(const key of ['authoritativeStateReady','candidateProofValid','trustedCaptureVerified','restoreAuthorized'])assert.equal(record[key],false);
    f.traces.length=0;await f.private.prepareCandidatePublication(f.request(),pin,identity);
    assert.deepEqual(f.traces,[{points:13,queries:0,writes:0}]);assert.deepEqual(f.h.data.get(path),record);
});
test('original public candidate summary and strict bytes/errors remain compatible with private assembly',async()=>{
    const f=await fixture(),rows=name=>[...f.h.data].filter(([path])=>path.startsWith(f.root+'/'+name+'/')).map(([path,row])=>({id:path.split('/').at(-1),row:copy(row)}));
    const inventoryState=copy(f.h.data.get(f.root+'/captureState/current'));
    const input={binding:{ownerUid:f.h.uid,auditId,epoch:1,sourceRevision:f.h.revision,inventoryStateSha256:inventoryState.stateSha256},
        run:copy(f.h.data.get(f.root)),inventoryState,inventoryPages:rows('inventoryPages'),rawState:copy(f.h.data.get(f.root+'/proofState/current')),
        rawReceipts:rows('patrolProofPages'),rawChunks:rows('proofPayloadChunks')};
    const result=await f.original.verifyRawRecoveryAuditCandidate(input);
    assert.equal(result.candidateProofValid,true);assert.equal(result.restoreAuthorized,false);assert(!Object.values(result).some(Buffer.isBuffer));
    await artifact(f);
    input.rawChunks.pop();await assert.rejects(f.original.verifyRawRecoveryAuditCandidate(input),/chunk|payload/i);
});
test('rollback, SDK retry, tuple collision and head loss cannot publish or mint committed preparations',async()=>{
    const f=await fixture(),{pin,artifact:identity}=await artifact(f),path=f.root+'/candidatePublications/'+operationId;
    f.h.abortNext();await assert.rejects(f.private.prepareCandidatePublication(f.request(),pin,identity),/rollback/);assert(!f.h.data.has(path));
    const native=f.h.dependencies.db.runTransaction;let attempts=0;
    f.h.dependencies.db.runTransaction=operation=>native(async tx=>{const result=await operation(tx);if(++attempts===1)throw Object.assign(Error('SDK retry'),{code:10});return result;});
    await f.private.prepareCandidatePublication(f.request(),pin,identity);assert.equal(attempts,2);
    f.h.dependencies.db.runTransaction=native;
    f.h.data.get(path).bucketName='collision';const before=copy([...f.h.data]),writes=f.h.writes;
    await assert.rejects(f.private.prepareCandidatePublication(f.request(),pin,identity),/manifest differs/);
    assert.deepEqual([...f.h.data],before);assert.equal(f.h.writes,writes);
    const state=f.h.data.get(f.root+'/proofState/current');f.h.data.delete(f.root+'/patrolProofPages/'+state.lastOperationId);
    await assert.rejects(f.private.prepareCandidatePublication(f.request(),pin,identity),/raw receipt|raw.*page|inconsistent|differs/i);
});
test('missing chunks, consumed material, different pins, expiry, takeover and cancellation fail closed',async()=>{
    const f=await fixture(),{pin,artifact:identity}=await artifact(f),second=await f.private.pinCandidatePublication(f.request(),{...args,operationId:'immutable-publication-0002'});
    await assert.rejects(f.private.prepareCandidatePublication(f.request(),second,identity),/another pin/);
    const material=await f.private.loadPinnedRawCapture(pin);await f.private.assemblePinnedCandidate(pin,material);
    await assert.rejects(f.private.assemblePinnedCandidate(pin,material),/original private/);
    const chunk=[...f.h.data.keys()].find(path=>path.startsWith(f.root+'/proofPayloadChunks/'));f.h.data.delete(chunk);
    const broken=await f.private.loadPinnedRawCapture(pin);await assert.rejects(f.private.assemblePinnedCandidate(pin,broken),/chunk|payload/i);
    await f.takeover();await assert.rejects(f.private.prepareCandidatePublication(f.request(),pin,identity),/session|current/i);
    await f.original.cancelAudit(f.request(),{auditId,expectedEpoch:1,operationId:'immutable-cancel-audit-001'});
    await assert.rejects(f.private.prepareCandidatePublication(f.request(),pin,identity),/session|current/i);
    const expired=await fixture(),ready=await artifact(expired);expired.h.advance(60000);
    await assert.rejects(expired.private.prepareCandidatePublication(expired.request(),ready.pin,ready.artifact),/approval/);
});
test('Session publication scope requires the server-only exact operation and rejects set/delete/foreign paths',async()=>{
    const f=await fixture(),reference=f.h.dependencies.db.doc(f.root+'/candidatePublications/'+operationId);
    const attempt=(method,ref=reference,permit)=>f.sessions.runRecoveryAuditMaintenance(f.request(),auditId,tx=>tx[method](ref,{test:true}),permit);
    await assert.rejects(attempt('create'),/WRITE_SCOPE/);
    for(const method of ['set','delete'])await assert.rejects(attempt(method,reference,operationId),/WRITE_SCOPE/);
    for(const path of [f.root+'/candidatePublications/immutable-other-operation',f.root.replace(f.h.uid,'foreign')+'/candidatePublications/'+operationId,
        f.root.replace(auditId,'immutable-foreign-audit-01')+'/candidatePublications/'+operationId,reference.path+'/child/extra'])
        await assert.rejects(attempt('create',f.h.dependencies.db.doc(path),operationId),/WRITE_SCOPE/);
    assert.throws(()=>attempt('create',reference,'bad'),/INVALID/);
});
test('same-op concurrent prepares commit one manifest and every SDK attempt revalidates the original live gates',async()=>{
    const f=await fixture(),ready=await artifact(f),before=f.h.writes;f.traces.length=0;
    await Promise.all([f.private.prepareCandidatePublication(f.request(),ready.pin,ready.artifact),f.private.prepareCandidatePublication(f.request(),ready.pin,ready.artifact)]);
    assert.equal(f.h.writes-before,1);assert(f.traces.length>=3);
    assert(f.traces.every(trace=>trace.points===13&&trace.queries===0));
    const blocked=await fixture();blocked.h.abortNext();
    await assert.rejects(blocked.private.pinCandidatePublication(blocked.request(),args),/rollback/);
    await assert.rejects(blocked.private.loadPinnedRawCapture({}),/original private/);
    const loaded=await fixture(),value=await artifact(loaded),writes=loaded.h.writes;
    loaded.h.data.get(loaded.h.save).serverRevision++;
    await assert.rejects(loaded.private.prepareCandidatePublication(loaded.request(),value.pin,value.artifact),/REVISION/);
    assert.equal(loaded.h.writes,writes);
});
