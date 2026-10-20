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
function lexicalFactory(enabled,io={bucketName:'private-fake-test-bucket'},artifactHelper){
    const filename=require.resolve('../functions/src/canonical-current-recovery'),compiled=new Module(filename);
    compiled.filename=filename;compiled.paths=Module._nodeModulePaths(dirname(filename));
    let source=readFileSync(filename,'utf8');
    const needle='return Object.freeze({restoreCurrent,verifyRecoveryAuditArtifact';
    assert.equal(source.split(needle).length,2);
    source=source.replace(needle,'return Object.freeze({assemblePinnedRawArchive,publicationMaterialTestValue:identity=>publicationValue(publicationMaterials,identity),publicationArtifactTestValue:identity=>publicationValue(publicationArtifacts,identity),publicationPreparationTestValue:identity=>publicationValue(publicationPreparations,identity),pinRawCapture,loadPinnedRawMaterial,verifyPinnedSegmentedProof,pinCandidatePublication,loadPinnedRawCapture,assemblePinnedCandidate,prepareCandidatePublication,restoreCurrent,verifyRecoveryAuditArtifact');
    if(enabled){
        source=source.replace('return buildRecoveryOwner(deps,null,false);','return buildRecoveryOwner(deps,require("test-only-immutable-candidate-io"),false);');
        const native=compiled.require.bind(compiled);compiled.require=name=>name==='test-only-immutable-candidate-io'?io:native(name);
    }
    source=source.replace('return Object.freeze({assemblePinnedRawArchive,','return Object.freeze({publishCapturedCandidate,publishPreparedCandidate,ackCandidatePublication,assemblePinnedRawArchive,');
    if(artifactHelper){const native=compiled.require.bind(compiled);compiled.require=name=>name==='./recovery-audit-artifact'?artifactHelper:native(name);}
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
async function fixture(io,artifactHelper,beforeAudit){
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
    if(beforeAudit)await beforeAudit(h);
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
    const traces=[],native=h.dependencies.db.runTransaction;let transactionDepth=0;
    h.dependencies.db.runTransaction=callback=>native(async tx=>{
        const trace={points:0,queries:0,writes:0};traces.push(trace);
        const facade={get:ref=>{trace[ref.query?'queries':'points']++;return tx.get(ref);}};
        for(const name of ['create','set','update','delete'])facade[name]=(...a)=>{trace.writes++;return tx[name](...a);};
        transactionDepth++;try{return await callback(facade);}finally{transactionDepth--;}
    });
    return {h,deps,request,root,sessions,original,traces,
        proof:lexicalFactory(false,undefined,artifactHelper)(deps),private:lexicalFactory(true,io)(deps),disabled:lexicalFactory(false)(deps),get transactionDepth(){return transactionDepth;},
        takeover:async()=>{h.advance(1000);authTime=Math.floor(h.clock/1000);session=await sessions.create({auth:{uid:h.uid,token:{auth_time:authTime}},data:{uid:h.uid}});}};
}
async function artifact(f){const pin=await f.private.pinCandidatePublication(f.request(),args);
    const material=await f.private.loadPinnedRawCapture(pin);return {pin,artifact:await f.private.assemblePinnedCandidate(pin,material)};}
test('publication preparation stays private and production-unavailable before reads; forged identities cannot mint origin',async()=>{
    const f=await fixture(),before=copy([...f.h.data]),writes=f.h.writes;f.traces.length=0;
    for(const name of ['publishCapturedCandidate','pinCandidatePublication','loadPinnedRawCapture','assemblePinnedCandidate','prepareCandidatePublication','publishPreparedCandidate','ackCandidatePublication'])assert.equal(Object.hasOwn(f.original,name),false);
    await assert.rejects(f.disabled.publishCapturedCandidate(f.request(),args),/unavailable/);
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
function fakeStorage(){
    const objects=new Map(),calls=[];let serial=9007199254740993n;
    const io={bucketName:'private-fake-test-bucket',outside:()=>{},calls,objects,
        async lookupMetadata(name){io.outside();calls.push(['lookup',copy(name)]);return copy(objects.get(name.objectName)?.metadata??null);},
        async createOnly(input){
            io.outside();calls.push(['create',input.ifGenerationMatch]);assert.equal(input.ifGenerationMatch,'0');
            if(objects.has(input.objectName))throw Object.assign(Error('exists'),{code:'ALREADY_EXISTS'});
            const metadata={bucketName:input.bucketName,objectName:input.objectName,generation:String(serial++),size:input.bytes.length};
            objects.set(input.objectName,{metadata,bytes:Buffer.from(input.bytes)});return copy(metadata);
        },
        async readExact(input){
            io.outside();calls.push(['read',input.generation]);const row=objects.get(input.objectName);
            if(!row||row.metadata.generation!==input.generation)throw Object.assign(Error('missing exact generation'),{code:'NOT_FOUND'});
            return copy(row);
        }};
    return io;
}
async function preparedFixture(){const io=fakeStorage(),f=await fixture(io);io.outside=()=>assert.equal(f.transactionDepth,0,'Storage IO cannot run in a Firestore callback');
    const ready=await artifact(f);return {...f,io,ready,prepared:await f.private.prepareCandidatePublication(f.request(),ready.pin,ready.artifact)};}

test('single-invocation publication retains all private identities and rechecks the original gates on replay',async()=>{
    const io=fakeStorage(),f=await fixture(io);
    io.outside=()=>assert.equal(f.transactionDepth,0);
    const result=await f.private.publishCapturedCandidate(f.request(),args);
    assert.equal(result.status,'acknowledged');assert.equal(result.generation,'9007199254740993');
    assert.equal(result.unchanged,false);
    for(const name of ['candidateProofValid','trustedCaptureVerified','restoreAuthorized','authoritativeStateReady'])assert.equal(result[name],false);
    assert.deepEqual(Object.keys(result).sort(),['candidateProofValid','trustedCaptureVerified','restoreAuthorized','authoritativeStateReady','status','auditId','operationId','artifactSha256','generation','unchanged'].sort());
    assert(!Object.values(result).some(Buffer.isBuffer));
    const writes=f.h.writes;
    assert.equal((await f.private.publishCapturedCandidate(f.request(),args)).unchanged,true);
    assert.equal(f.h.writes,writes);assert.equal(io.calls.filter(([kind])=>kind==='create').length,1);
    await f.takeover();const ioCount=io.calls.length,takeoverWrites=f.h.writes;
    await assert.rejects(f.private.publishCapturedCandidate(f.request(),args));
    assert.equal(io.calls.length,ioCount,'replaced audit session stops before provider IO');
    assert.equal(f.h.writes,takeoverWrites,'rejected publication wrote nothing');
});
test('private full-read publication and ACK bind canonical string generation; ACK changes only four fields and retry is read-only',async()=>{
    const f=await preparedFixture(),path=f.root+'/candidatePublications/'+operationId,before=copy(f.h.data.get(path));f.traces.length=0;
    const proof=await f.private.publishPreparedCandidate(f.request(),f.prepared);
    assert.deepEqual(proof,{});assert.deepEqual(f.traces,[{points:13,queries:0,writes:0}]);
    f.traces.length=0;const result=await f.private.ackCandidatePublication(f.request(),f.prepared,proof);
    assert.equal(result.generation,'9007199254740993');assert.equal(result.unchanged,false);
    assert.deepEqual(f.traces,[{points:13,queries:0,writes:1}]);
    const {generation,objectSize,ackAt,...after}=f.h.data.get(path);assert(ackAt.toMillis());
    assert.deepEqual(after,{...before,status:'acknowledged'});assert.equal(objectSize,before.artifactByteLength);
    for(const name of ['candidateProofValid','trustedCaptureVerified','restoreAuthorized','authoritativeStateReady'])assert.equal(result[name],false);
    await assert.rejects(f.private.ackCandidatePublication(f.request(),f.prepared,proof),/unconsumed/);
    const newProof=await f.private.publishPreparedCandidate(f.request(),f.prepared);f.traces.length=0;
    assert.equal((await f.private.ackCandidatePublication(f.request(),f.prepared,newProof)).unchanged,true);
    assert.deepEqual(f.traces,[{points:13,queries:0,writes:0}]);
    const repeat=await f.private.prepareCandidatePublication(f.request(),f.ready.pin,f.ready.artifact);assert.deepEqual(repeat,{});
    assert.equal(f.io.calls.filter(([kind])=>kind==='create').length,1);
});
test('lost create/ACK responses preserve the original object and exact bytes without overwrite or source replacement',async()=>{
    const f=await preparedFixture(),create=f.io.createOnly;let lost=true;
    f.io.createOnly=async input=>{const result=await create(input);if(lost){lost=false;throw Object.assign(Error('lost response'),{code:'UNKNOWN_COMMIT'});}return result;};
    const proof=await f.private.publishPreparedCandidate(f.request(),f.prepared),native=f.h.dependencies.db.runTransaction,lostError=Error('lost ACK response');let loseCommit=true;
    f.h.dependencies.db.runTransaction=async callback=>{const result=await native(callback);if(loseCommit){loseCommit=false;throw lostError;}return result;};
    await assert.rejects(f.private.ackCandidatePublication(f.request(),f.prepared,proof),error=>error===lostError);
    f.h.dependencies.db.runTransaction=native;
    const attempts=f.traces.length;
    await assert.rejects(f.private.ackCandidatePublication(f.request(),f.prepared,proof),/unconsumed/);
    assert.equal(f.traces.length,attempts,'a failed outer response invalidates proof before another transaction');
    const refreshed=await f.private.publishPreparedCandidate(f.request(),f.prepared);
    assert.equal((await f.private.ackCandidatePublication(f.request(),f.prepared,refreshed)).unchanged,true);
    assert.equal(f.io.objects.size,1);assert.equal(f.io.calls.filter(([kind])=>kind==='create').length,1);
    // A process restart may rematerialize only the original immutable capture.
    const restarted=lexicalFactory(true,f.io)(f.deps),pin=await restarted.pinCandidatePublication(f.request(),args);
    const material=await restarted.loadPinnedRawCapture(pin),identity=await restarted.assemblePinnedCandidate(pin,material);
    const prepared=await restarted.prepareCandidatePublication(f.request(),pin,identity);
    await restarted.ackCandidatePublication(f.request(),prepared,await restarted.publishPreparedCandidate(f.request(),prepared));
    assert.equal(f.io.calls.filter(([kind])=>kind==='create').length,1);
});
test('metadata, generation, bytes and provider errors cannot ACK, overwrite collisions, or fall back from a lost acknowledged generation',async()=>{
    for(const mutate of [row=>{row.metadata.generation=9007199254740993;},row=>{row.metadata.generation='01';},
        row=>{row.metadata.bucketName='foreign';},row=>{row.metadata.objectName+='-foreign';},row=>{row.metadata.size++;},
        row=>{row.bytes[0]^=1;}]){
        const f=await preparedFixture();await f.private.publishPreparedCandidate(f.request(),f.prepared);
        mutate([...f.io.objects.values()][0]);const writes=f.h.writes;
        await assert.rejects(f.private.publishPreparedCandidate(f.request(),f.prepared));assert.equal(f.h.writes,writes);
        assert.equal(f.io.calls.filter(([kind])=>kind==='create').length,1);
    }
    for(const code of ['PERMISSION_DENIED','DEADLINE_EXCEEDED']){
        const f=await preparedFixture(),failure=Object.assign(Error(code),{code});f.io.createOnly=async()=>{throw failure;};
        await assert.rejects(f.private.publishPreparedCandidate(f.request(),f.prepared),error=>error===failure);
        assert.equal(f.h.data.get(f.root+'/candidatePublications/'+operationId).status,'prepared');
    }
    const f=await preparedFixture(),proof=await f.private.publishPreparedCandidate(f.request(),f.prepared);
    await f.private.ackCandidatePublication(f.request(),f.prepared,proof);
    const row=[...f.io.objects.values()][0];row.metadata.generation='9007199254740994';const writes=f.h.writes;
    await assert.rejects(f.private.publishPreparedCandidate(f.request(),f.prepared),/missing exact generation/);assert.equal(f.h.writes,writes);
});
test('create precondition races reuse one original object; unknown commit without an object cannot ACK and retries never rename',async()=>{
    const f=await preparedFixture();await f.private.publishPreparedCandidate(f.request(),f.prepared);
    const original=copy([...f.io.objects]),lookup=f.io.lookupMetadata;let first=true;
    f.io.lookupMetadata=async input=>{if(first){first=false;return null;}return lookup(input);};
    const proof=await f.private.publishPreparedCandidate(f.request(),f.prepared);
    assert.deepEqual([...f.io.objects],original);await f.private.ackCandidatePublication(f.request(),f.prepared,proof);
    const absent=await preparedFixture(),create=absent.io.createOnly;
    absent.io.createOnly=async()=>{throw Object.assign(Error('unknown commit'),{code:'UNKNOWN_COMMIT'});};
    await assert.rejects(absent.private.publishPreparedCandidate(absent.request(),absent.prepared),/not available/);
    assert.equal(absent.io.objects.size,0);assert.equal(absent.h.data.get(absent.root+'/candidatePublications/'+operationId).status,'prepared');
    absent.io.createOnly=create;
    await absent.private.ackCandidatePublication(absent.request(),absent.prepared,await absent.private.publishPreparedCandidate(absent.request(),absent.prepared));
    assert.equal(absent.io.objects.size,1);
});
test('ACK rollback and concurrent proofs preserve exact tuple; takeover, expiry and cancel recheck live gates after IO',async()=>{
    const f=await preparedFixture();let a=await f.private.publishPreparedCandidate(f.request(),f.prepared);const b=await f.private.publishPreparedCandidate(f.request(),f.prepared);
    f.h.abortNext();await assert.rejects(f.private.ackCandidatePublication(f.request(),f.prepared,a),/rollback/);
    await assert.rejects(f.private.ackCandidatePublication(f.request(),f.prepared,a),/unconsumed/);
    a=await f.private.publishPreparedCandidate(f.request(),f.prepared);
    const before=f.h.writes;
    const results=await Promise.all([f.private.ackCandidatePublication(f.request(),f.prepared,a),f.private.ackCandidatePublication(f.request(),f.prepared,b)]);
    assert.equal(f.h.writes-before,1);assert.deepEqual(results.map(row=>row.unchanged).sort(),[false,true]);
    await assert.rejects(f.private.ackCandidatePublication(f.request(),f.prepared,{}),/original private/);
    for(const action of ['expiry','takeover','cancel']){
        const f=await preparedFixture(),proof=await f.private.publishPreparedCandidate(f.request(),f.prepared);
        if(action==='expiry')f.h.advance(60000);
        else if(action==='takeover')await f.takeover();
        else await f.original.cancelAudit(f.request(),{auditId,expectedEpoch:1,operationId:'immutable-cancel-after-io'});
        const writes=f.h.writes,creates=f.io.calls.filter(([kind])=>kind==='create').length;
        await assert.rejects(f.private.ackCandidatePublication(f.request(),f.prepared,proof));
        await assert.rejects(f.private.publishPreparedCandidate(f.request(),f.prepared));
        assert.equal(f.h.writes,writes);assert.equal(f.io.calls.filter(([kind])=>kind==='create').length,creates);
    }
});

async function pinnedProofMaterial(f){
    const pin=await f.proof.pinRawCapture(f.request(),args),material=await f.proof.loadPinnedRawMaterial(pin);
    return {pin,material};
}
function clockedArtifact(clock){
    const filename=require.resolve('../functions/src/recovery-audit-artifact'),compiled=new Module(filename);
    compiled.filename=filename;compiled.paths=Module._nodeModulePaths(dirname(filename));
    const native=compiled.require.bind(compiled);
    compiled.require=name=>name==='node:perf_hooks'?{performance:{now:()=>clock.now}}:native(name);
    compiled._compile(readFileSync(filename,'utf8'),filename);return compiled.exports;
}
test('null-IO private pinned proof uses literal loader and final thirteen-point gate without issuing authority',async()=>{
    const helper=require('../functions/src/recovery-audit-artifact');let builds=0,token;
    const wrapped={...helper,createRecoveryAuditAssemblyBudget:()=>{builds++;return token=helper.createRecoveryAuditAssemblyBudget();}};
    const f=await fixture(undefined,wrapped),before=copy([...f.h.data]),writes=f.h.writes;
    for(const name of ['pinRawCapture','loadPinnedRawMaterial','verifyPinnedSegmentedProof'])assert.equal(Object.hasOwn(f.original,name),false);
    const {pin,material}=await pinnedProofMaterial(f);assert.equal(builds,1);
    const scans=f.traces.slice(1);assert(scans.length>=6);assert(scans.every(t=>t.queries===1&&t.points===0&&t.writes===0));
    f.traces.length=0;
    const result=await f.proof.verifyPinnedSegmentedProof(f.request(),pin,material);
    assert.equal(builds,1);assert.equal(result.segmentedProofValid,true);
    for(const flag of ['candidateProofValid','trustedCaptureVerified','restoreAuthorized','authoritativeStateReady'])assert.equal(result[flag],false);
    for(const key of ['bytes','artifact','records','documents','identity'])assert.equal(Object.hasOwn(result,key),false);
    assert.deepEqual(f.traces,[{points:13,queries:0,writes:0}]);
    const usage=helper.recoveryAuditAssemblyUsage(token);assert.deepEqual({...result.assemblyUsage,elapsedMs:0},{...usage,elapsedMs:0});
    assert(usage.elapsedMs>=result.assemblyUsage.elapsedMs);
    assert.deepEqual([...f.h.data],before);assert.equal(f.h.writes,writes);
    await assert.rejects(f.proof.verifyPinnedSegmentedProof(f.request(),pin,material),/original private/);
});
test('private pinned proof rejects forged, cross-pin and corrupt material without writes or new origin',async()=>{
    const f=await fixture(),ready=await pinnedProofMaterial(f),other=await f.proof.pinRawCapture(f.request(),{...args,operationId:'pinned-proof-second-origin'});
    await assert.rejects(f.proof.verifyPinnedSegmentedProof(f.request(),{},ready.material),/original private/);
    await assert.rejects(f.proof.verifyPinnedSegmentedProof(f.request(),ready.pin,{}),/original private/);
    await assert.rejects(f.proof.verifyPinnedSegmentedProof(f.request(),other,ready.material),/another pin/);
    const chunk=[...f.h.data.keys()].find(path=>path.startsWith(f.root+'/proofPayloadChunks/'));
    f.h.data.get(chunk).payloadBytes[50]^=1;
    const writes=f.h.writes;await assert.rejects(f.proof.loadPinnedRawMaterial(ready.pin),/chunk|payload/i);
    assert.equal(f.h.writes,writes);
});
test('private pinned proof final gate rejects changed epoch, session, fence, raw head and expired approval',async()=>{
    for(const change of [
        f=>{f.h.data.get(f.root.replace('/recoveryAuditRuns/'+auditId,'')+'/recoveryAuditFence/current').epoch++;},
        f=>{f.h.data.get(f.root).epoch++;},
        f=>{f.h.data.get(f.root+'/proofState/current').stateSha256='f'.repeat(64);},
        f=>f.h.advance(60000),
        f=>f.takeover(),
        f=>f.original.cancelAudit(f.request(),{auditId,expectedEpoch:1,operationId:'pinned-proof-cancel-audit'})
    ]){
        const f=await fixture(),ready=await pinnedProofMaterial(f);await change(f);const before=copy([...f.h.data]),writes=f.h.writes;
        await assert.rejects(f.proof.verifyPinnedSegmentedProof(f.request(),ready.pin,ready.material));
        assert.deepEqual([...f.h.data],before);assert.equal(f.h.writes,writes);
    }
});
test('private pinned proof shares loader sticky work and elapsed deadline including awaited IO and final resolve',async()=>{
    const helper=require('../functions/src/recovery-audit-artifact');let token;
    const f=await fixture(undefined,{...helper,createRecoveryAuditAssemblyBudget:()=>token=helper.createRecoveryAuditAssemblyBudget()}),ready=await pinnedProofMaterial(f);
    helper.chargeRecoveryAuditAssembly(token,'nodes',16000000);const writes=f.h.writes;f.traces.length=0;
    await assert.rejects(f.proof.verifyPinnedSegmentedProof(f.request(),ready.pin,ready.material),/nodes budget exceeded/);
    assert.throws(()=>helper.recoveryAuditAssemblyUsage(token),/nodes budget exceeded/);assert.equal(f.traces.length,0);assert.equal(f.h.writes,writes);
    for(const phase of ['loader-await','before-proof','final-resolve']){
        const clock={now:0},g=await fixture(undefined,clockedArtifact(clock)),pin=await g.proof.pinRawCapture(g.request(),args);
        if(phase==='loader-await'){
            const native=g.h.dependencies.db.runTransaction;g.h.dependencies.db.runTransaction=async callback=>{const result=await native(callback);clock.now=30001;return result;};
            await assert.rejects(g.proof.loadPinnedRawMaterial(pin),/deadline exceeded/);
        }else{
            const material=await g.proof.loadPinnedRawMaterial(pin);
            if(phase==='before-proof')clock.now=30001;
            else{const native=g.h.dependencies.db.runTransaction;g.h.dependencies.db.runTransaction=async callback=>{const result=await native(callback);clock.now=30001;return result;};}
            const original=copy([...g.h.data]),count=g.h.writes;
            await assert.rejects(g.proof.verifyPinnedSegmentedProof(g.request(),pin,material),/deadline exceeded/);
            assert.deepEqual([...g.h.data],original);assert.equal(g.h.writes,count);
        }
    }
});

test('private pinned proof final SDK retry rechecks binding and rollback cannot return proof success',async()=>{
    for(const change of [false,true]){
        const f=await fixture(),ready=await pinnedProofMaterial(f),writes=f.h.writes,native=f.h.dependencies.db.runTransaction;let attempts=0;
        f.h.dependencies.db.runTransaction=operation=>native(async tx=>{
            const result=await operation(tx);
            if(++attempts===1){if(change)f.h.data.get(f.root+'/proofState/current').stateSha256='e'.repeat(64);
                throw Object.assign(Error('SDK retry'),{code:10});}
            return result;
        });
        if(change)await assert.rejects(f.proof.verifyPinnedSegmentedProof(f.request(),ready.pin,ready.material));
        else{const result=await f.proof.verifyPinnedSegmentedProof(f.request(),ready.pin,ready.material);assert.equal(result.segmentedProofValid,true);assert.equal(attempts,2);}
        assert.equal(f.h.writes,writes);
    }
    const f=await fixture(),ready=await pinnedProofMaterial(f),before=copy([...f.h.data]),writes=f.h.writes;
    f.h.abortNext();await assert.rejects(f.proof.verifyPinnedSegmentedProof(f.request(),ready.pin,ready.material),/rollback/);
    assert.equal(f.h.writes,writes);assert.deepEqual([...f.h.data],before);
    await assert.rejects(f.proof.verifyPinnedSegmentedProof(f.request(),ready.pin,ready.material),/original private/);
});
async function rawPreparedFixture(artifactHelper){
    const io=fakeStorage(),f=await fixture(io,artifactHelper);
    io.outside=()=>assert.equal(f.transactionDepth,0);
    const owner=artifactHelper?lexicalFactory(true,io,artifactHelper)(f.deps):f.private;
    const pin=await owner.pinCandidatePublication(f.request(),args),material=await owner.loadPinnedRawCapture(pin);
    const identity=await owner.assemblePinnedRawArchive(pin,material);
    const prepared=await owner.prepareCandidatePublication(f.request(),pin,identity);
    return {...f,private:owner,io,pin,material,identity,prepared};
}
test('raw publication uses one loader/proof/encoding/cut token and a separate original fullread token; v2 stays exact',async t=>{
    const helper=require('../functions/src/recovery-audit-artifact'),tokens=[];
    const wrapped={...helper,createRecoveryAuditAssemblyBudget:()=>{const token=helper.createRecoveryAuditAssemblyBudget();tokens.push(token);return token;}};
    const f=await rawPreparedFixture(wrapped),manifest=f.h.data.get(f.root+'/candidatePublications/'+operationId);
    assert.equal(tokens.length,1);assert.equal(manifest.schemaVersion,2);assert.equal(manifest.candidateEncodingVersion,3);
    assert.equal(manifest.artifactKind,'canonical-recovery-raw-archive');assert.equal(manifest.proofKind,'segmented-original-rights-v1');
    assert.equal(helper.recoveryAuditAssemblyUsage(tokens[0]).passes,2);
    assert.equal(f.private.publicationArtifactTestValue(f.identity).summary.candidateProofValid,false);
    assert.equal(f.private.publicationArtifactTestValue(f.identity).summary.segmentedProofValid,true);
    const prepareUsage=helper.recoveryAuditAssemblyUsage(tokens[0]);
    const original=copy([...f.h.data]),proof=await f.private.publishPreparedCandidate(f.request(),f.prepared);
    t.diagnostic(JSON.stringify({wireBytes:manifest.artifactByteLength,preparation:prepareUsage,fullread:helper.recoveryAuditAssemblyUsage(tokens[1]),scope:"Node fakeStorage; excludes total provider heap and end-to-end real SDK/GCS timing"}));
    assert.equal(tokens.length,2);assert.notEqual(tokens[0],tokens[1]);assert.equal(helper.recoveryAuditAssemblyUsage(tokens[1]).passes,2);
    for(const trace of f.traces.filter(row=>row.points))assert.deepEqual(trace,{points:13,queries:0,writes:trace.writes});
    const result=await f.private.ackCandidatePublication(f.request(),f.prepared,proof);
    for(const key of ['candidateProofValid','trustedCaptureVerified','restoreAuthorized','authoritativeStateReady'])assert.equal(result[key],false);
    assert.equal(result.generation,'9007199254740993');assert.equal(f.io.objects.size,1);
    assert.equal((await f.private.publishCapturedCandidate(f.request(),args)).unchanged,true);
    const v2=await preparedFixture(),row=copy(v2.h.data.get(v2.root+'/candidatePublications/'+operationId));
    assert.equal(row.schemaVersion,1);assert.equal(row.candidateEncodingVersion,2);assert.equal(Object.hasOwn(row,'proofKind'),false);
    const bytes=copy(v2.private.publicationArtifactTestValue(v2.ready.artifact).bytes);
    await v2.private.publishCapturedCandidate(v2.request(),args);
    assert.deepEqual(v2.private.publicationArtifactTestValue(v2.ready.artifact).bytes,bytes);
    const after=v2.h.data.get(v2.root+'/candidatePublications/'+operationId),{generation,objectSize,ackAt,...unchanged}=after;
    assert.deepEqual(unchanged,{...row,status:'acknowledged'});assert.equal(objectSize,bytes.length);assert(generation);assert(ackAt);
    assert.deepEqual(original.filter(([path])=>!path.includes('/candidatePublications/')),copy([...f.h.data]).filter(([path])=>!path.includes('/candidatePublications/')));
});
test('raw publication refuses cross-version manifests and never reinterprets old candidate bytes as raw proof',async()=>{
    for(const mutate of [row=>row.candidateEncodingVersion=2,row=>row.proofKind='candidate-proof',row=>row.artifactKind='candidate',row=>row.schemaVersion=1]){
        const f=await rawPreparedFixture(),path=f.root+'/candidatePublications/'+operationId;mutate(f.h.data.get(path));
        const before=copy([...f.h.data]),calls=f.io.calls.length,writes=f.h.writes;
        await assert.rejects(f.private.publishPreparedCandidate(f.request(),f.prepared),/version|encoding|proof|manifest/i);
        await assert.rejects(f.private.publishCapturedCandidate(f.request(),args));
        assert.deepEqual([...f.h.data],before);assert.equal(f.h.writes,writes);assert.equal(f.io.calls.length,calls);
    }
});
test('raw fullread refuses canonically resealed missing chunks; preparation rejects self-consistent captured economic corruption',async()=>{
    const helper=require('../functions/src/recovery-audit-artifact'),hash=bytes=>require('node:crypto').createHash('sha256').update(bytes).digest('hex');
    const f=await rawPreparedFixture(),artifact=f.private.publicationArtifactTestValue(f.identity);
    const material=helper.decodeRawRecoveryArchive(artifact.bytes,helper.createRecoveryAuditAssemblyBudget());material.rawChunks.pop();
    // Stronger test-only adversary reseals container/manifest/private tuple;
    // original complete capture/source proof must still refuse.
    const bytes=helper.encodeRawRecoveryArchive(material,helper.createRecoveryAuditAssemblyBudget()),prepared=f.private.publicationPreparationTestValue(f.prepared);
    artifact.bytes=bytes;prepared.tuple.artifactSha256=hash(bytes);prepared.tuple.artifactByteLength=bytes.length;
    Object.assign(f.h.data.get(f.root+'/candidatePublications/'+operationId),{artifactSha256:hash(bytes),artifactByteLength:bytes.length});
    const before=copy([...f.h.data]),writes=f.h.writes;
    await assert.rejects(f.private.publishPreparedCandidate(f.request(),f.prepared));
    assert.deepEqual([...f.h.data],before);assert.equal(f.h.writes,writes);
    // The real capture writers seal all inventory/version/hash relationships
    // around a corrupt retained ledger. Integrity alone grants no authority.
    const bad=await fixture(fakeStorage(),undefined,h=>{
        const path=[...h.data.keys()].find(path=>path.startsWith(h.root+'/ledgerEntries/'));h.data.get(path).kind='shop-purchase';
    });
    const pin=await bad.private.pinCandidatePublication(bad.request(),args),loaded=await bad.private.loadPinnedRawCapture(pin);
    const badBefore=copy([...bad.h.data]),badWrites=bad.h.writes;
    await assert.rejects(bad.private.assemblePinnedRawArchive(pin,loaded),/Embedded Forest mode receipt or ledger binding differs/);
    assert.deepEqual([...bad.h.data],badBefore);assert.equal(bad.h.writes,badWrites);
});
test('raw preparation sticky resource/cut drift refuses without manifest; old material never refreshes its token',async()=>{
    const helper=require('../functions/src/recovery-audit-artifact');let token;
    const io=fakeStorage(),f=await fixture(io),owner=lexicalFactory(true,io,{...helper,createRecoveryAuditAssemblyBudget:()=>token=helper.createRecoveryAuditAssemblyBudget()})(f.deps);
    const pin=await owner.pinCandidatePublication(f.request(),args),material=await owner.loadPinnedRawCapture(pin);
    helper.chargeRecoveryAuditAssembly(token,'bytes',256*1024*1024);
    await assert.rejects(owner.assemblePinnedRawArchive(pin,material),/bytes budget exceeded/);
    await assert.rejects(owner.assemblePinnedRawArchive(pin,material),/original private/);
    assert.equal(f.h.data.has(f.root+'/candidatePublications/'+operationId),false);assert.equal(io.calls.length,0);
    const g=await fixture(fakeStorage()),p=await g.private.pinCandidatePublication(g.request(),args),m=await g.private.loadPinnedRawCapture(p);
    const a=await g.private.assemblePinnedRawArchive(p,m);g.h.data.get(g.root+'/proofState/current').stateSha256='e'.repeat(64);
    const writes=g.h.writes;await assert.rejects(g.private.prepareCandidatePublication(g.request(),p,a));assert.equal(g.h.writes,writes);
});
test('raw ACK lost response requires fresh original fullread; expiry takeover and cancel retain final live gates',async()=>{
    const f=await rawPreparedFixture(),proof=await f.private.publishPreparedCandidate(f.request(),f.prepared),native=f.h.dependencies.db.runTransaction;
    f.h.dependencies.db.runTransaction=async operation=>{await native(operation);throw Error('raw lost ACK response');};
    await assert.rejects(f.private.ackCandidatePublication(f.request(),f.prepared,proof),/raw lost ACK response/);
    f.h.dependencies.db.runTransaction=native;const before=f.traces.length;
    await assert.rejects(f.private.ackCandidatePublication(f.request(),f.prepared,proof),/unconsumed/);assert.equal(f.traces.length,before);
    const refreshed=await f.private.publishPreparedCandidate(f.request(),f.prepared);assert.equal((await f.private.ackCandidatePublication(f.request(),f.prepared,refreshed)).unchanged,true);
    for(const mutate of [g=>g.h.advance(60000),g=>g.takeover(),g=>g.original.cancelAudit(g.request(),{auditId,expectedEpoch:1,operationId:'raw-publication-cancel-audit'})]){
        const g=await rawPreparedFixture(),ready=await g.private.publishPreparedCandidate(g.request(),g.prepared);await mutate(g);
        const writes=g.h.writes,calls=g.io.calls.length;
        await assert.rejects(g.private.ackCandidatePublication(g.request(),g.prepared,ready));
        await assert.rejects(g.private.publishPreparedCandidate(g.request(),g.prepared));
        assert.equal(g.h.writes,writes);assert.equal(g.io.calls.length,calls);
    }
});
test('raw publication deadlines include preparation resolution and awaited fullread without minting reusable proof',async()=>{
    for(const phase of ['prepare-resolve','fullread-await']){
        const clock={now:0},helper=clockedArtifact(clock),io=fakeStorage(),f=await fixture(io),owner=lexicalFactory(true,io,helper)(f.deps);
        const pin=await owner.pinCandidatePublication(f.request(),args),material=await owner.loadPinnedRawCapture(pin),artifact=await owner.assemblePinnedRawArchive(pin,material);
        if(phase==='prepare-resolve'){
            const native=f.h.dependencies.db.runTransaction;f.h.dependencies.db.runTransaction=async callback=>{const result=await native(callback);clock.now=30001;return result;};
            await assert.rejects(owner.prepareCandidatePublication(f.request(),pin,artifact),/deadline exceeded/);
            assert.equal(io.calls.length,0,'No private prepared identity escaped the late transaction resolution');
        }else{
            const prepared=await owner.prepareCandidatePublication(f.request(),pin,artifact),read=io.readExact;
            io.readExact=async input=>{const result=await read(input);clock.now=30001;return result;};
            const writes=f.h.writes;await assert.rejects(owner.publishPreparedCandidate(f.request(),prepared),/deadline exceeded/);
            assert.equal(f.h.data.get(f.root+'/candidatePublications/'+operationId).status,'prepared');assert.equal(f.h.writes,writes);
        }
    }
});
