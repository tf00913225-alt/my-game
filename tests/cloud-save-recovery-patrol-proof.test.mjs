import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire,Module} from 'node:module';
import {readFileSync} from 'node:fs';
import {dirname} from 'node:path';
import {storeHarness,selection,copy} from '../scripts/test-helpers/canonical-store-harness.mjs';
const require=createRequire(import.meta.url);
const {createSessionAuthority}=require('../functions/src/session-authority');
const {createCanonicalSourceWriter}=require('../functions/src/canonical-source-writer');
const {createCanonicalCurrentRecovery}=require('../functions/src/canonical-current-recovery');
const {createCanonicalRecoveryApproval}=require('../functions/src/canonical-recovery-approval');
const {createCanonicalAccountModeTime}=require('../functions/src/canonical-account-mode-time');
const {createCanonicalPatrolSettlement}=require('../functions/src/canonical-patrol-settlement');
const {createCanonicalExpAllocation}=require('../functions/src/canonical-exp-allocation');
const {decodeProofPayload,encodeProofPayload,decodeInventoryPayload,encodeInventoryPayload,PATROL_PROOF_LIMITS}=require('../functions/src/recovery-audit-artifact');
const {createRecoveryArchive}=require('../functions/src/canonical-recovery-archive');
const {assembleCanonicalSnapshot}=require('../functions/src/canonical-snapshot');
const {snapshotDigest}=require('../functions/src/canonical-snapshot');
const auditId='proof-component-audit-0001',approvalId='proof-component-approval-01';
async function fixture({battles=20,three=true,largeBytes=0,rested=false,adStatus=null,historicalSession=false,zeroHeartbeat=false,beforeAudit=null,currentLoss=true}={}){
    const h=storeHarness({optimisticTransactions:true}),sessions=createSessionAuthority(h.dependencies);let authTime=Math.floor(h.clock/1000),session;
    const request=()=>({auth:{uid:h.uid,token:{auth_time:authTime}},data:{uid:h.uid,...(session?{session}:{})}});
    session=await sessions.create(request());
    const deps={...h.dependencies,runProtected:sessions.runProtected,runRecoveryAuditMaintenance:sessions.runRecoveryAuditMaintenance};
    await createCanonicalSourceWriter(deps).commitInitialSources(request(),{operationId:'proof-initial-operation-001',expectedRevision:1,selection});
    if(largeBytes){
        // Explicit Admin structural pressure fixture: canonical projection shape
        // and original Forest unit proof, not fully earned global provenance.
        // Preserve actual initial creation archive2/receipt unchanged.
        const records=copy(h.data.get(h.root+'/recoveryArchives/2').sourceRecords),revision=3;
        for(const name of ['account','economy','progress','relicLoadout','claimCheckpoint'])records[name].serverRevision=revision;
        for(const name of ['characters','inventory','equipment','relics','claimRecords'])for(const row of records[name])row.serverRevision=revision;
        records.inventory=[{schemaVersion:1,ownerUid:h.uid,serverRevision:revision,provenance:'server-created',ownedItemId:'structural-pressure-item',location:'bag',
            state:{id:'hp_potion_s',type:'consumable',name:'x'.repeat(largeBytes),count:1}}];
        const bundle=assembleCanonicalSnapshot(h.uid,revision,records),archive=createRecoveryArchive(h.uid,revision,records,bundle);
        for(const [name,collection] of Object.entries({account:'account',economy:'economy',progress:'progress',relicLoadout:'relicLoadout',claimCheckpoint:'claimCheckpoints'}))
            h.data.set(h.root+'/'+collection+'/current',{...records[name],...(name==='account'?{snapshotSha256:bundle.sha256}:{})});
        for(const row of records.characters)h.data.set(h.root+'/characters/'+row.characterId,row);
        h.data.set(h.root+'/inventory/structural-pressure-item',records.inventory[0]);
        h.data.set(h.root+'/playableSnapshots/3',bundle);h.data.set(h.root+'/recoveryArchives/3',archive);h.data.get(h.save).serverRevision=3;
    }
    const forest=createCanonicalPatrolSettlement({...deps,randomBytes:size=>Buffer.alloc(size,255)}),tickets=[];let serial=0;
    const id=name=>`proof-${name}-${String(++serial).padStart(8,'0')}`;
    const reopenId=id('reopen');
    await forest.observePresence(request(),{operationId:reopenId,expectedRevision:h.revision,expectedSequence:0,intent:'reopen',elementBox:'keep'});
    if(rested){
        await forest.observePresence(request(),{operationId:id('rest'),expectedRevision:h.revision,expectedSequence:1,intent:'rest',elementBox:'keep'});
        h.advance(120000);
        await forest.observePresence(request(),{operationId:id('resume'),expectedRevision:h.revision,expectedSequence:2,intent:'resume',elementBox:'keep'});
    }
    for(let index=0;index<battles+(three?1:0);index++){
        const ticketId=id('ticket'),triple=index===battles;
        await forest.issueTicket(request(),{operationId:ticketId,expectedRevision:h.revision,triggerEntryId:'forest:0',availableEntryIds:triple?['forest:0','forest:1','forest:2']:['forest:0']});
        for(const memberIndex of triple?[2,0,1]:[0])await forest.settleMember(request(),{operationId:id('member'),expectedRevision:h.revision,ticketId,memberIndex});
        await forest.settleTerminal(request(),{operationId:id('win'),expectedRevision:h.revision,ticketId,kind:'win'});tickets.push(ticketId);
    }
    const allocations=[];let additional;
    if(battles>=20){
        const allocator=createCanonicalExpAllocation(deps);for(let level=1;level<10;level++){const operationId=id('allocate');await allocator.allocateSharedExp(request(),{operationId,expectedRevision:h.revision});allocations.push(operationId);}
        additional=id('additional');
        await createCanonicalSourceWriter(deps).commitAdditionalCharacter(request(),{operationId:additional,expectedRevision:h.revision,slotIndex:1,
            selection:{...selection,displayName:'Second',attributes:{attack:3,vitality:0,energy:0,intelligence:0,defensePoints:0,agility:0}}});
        assert.equal(h.data.get(h.root+'/recoveryArchives/'+h.revision).sourceRecords.characters[0].state.level,10);

    }
    let adSourceId,adCloseId;
    if(adStatus){
        const sequence=()=>h.data.get(h.root+'/modeTime/current').sequence;
        adSourceId=id('ad-begin');await forest.beginSimulatedAd(request(),{operationId:adSourceId,expectedRevision:h.revision,expectedSequence:sequence()});
        if(adStatus!=='pending'){
            adCloseId=id('ad-close');if(adStatus==='consumed')h.advance(3000);
            await forest[adStatus==='consumed'?'completeSimulatedAd':'abandonSimulatedAd'](request(),{
                operationId:adCloseId,expectedRevision:h.revision,expectedSequence:sequence(),sourceId:adSourceId});
        }
    }
    let heartbeatId;
    if(zeroHeartbeat){heartbeatId=id('heartbeat');await forest.observePresence(request(),{operationId:heartbeatId,expectedRevision:h.revision,
        expectedSequence:h.data.get(h.root+'/modeTime/current').sequence,intent:'heartbeat',elementBox:'keep'});}
    if(historicalSession){h.advance(1000);authTime=Math.floor(h.clock/1000);
        session=await sessions.create({auth:{uid:h.uid,token:{auth_time:authTime}},data:{uid:h.uid}});}
    if(battles>=20&&currentLoss)for(const path of [...h.data.keys()])if(['account','characters','economy','inventory','equipment','relics','relicLoadout','progress','claimRecords','claimCheckpoints']
        .some(name=>path.startsWith(h.root+'/'+name+'/')))h.data.delete(path);
    if(beforeAudit)await beforeAudit(h);
    await createCanonicalRecoveryApproval(deps).issue({auth:{uid:'proof-operator',token:{cloudSaveOperator:true}},data:{ownerUid:h.uid,operationId:approvalId,sourceRevision:h.revision,ttlSeconds:60}});
    const recovery=createCanonicalCurrentRecovery(deps);await recovery.beginAudit(request(),{operationId:auditId,expectedRevision:h.revision,approvalOperationId:approvalId});
    await recovery.prepareInventory(request(),{auditId,expectedEpoch:1,operationId:'proof-prepare-operation-01'});
    let result,sequence=0;do{result=await recovery.captureInventoryPage(request(),{auditId,expectedEpoch:1,operationId:`proof-inventory-${String(++sequence).padStart(8,'0')}`,expectedSequence:sequence});}while(!result.inventoryExhausted);
    const root=h.root+'/recoveryAuditRuns/'+auditId,traces=[],base=h.dependencies.db.runTransaction;
    h.dependencies.db.runTransaction=callback=>base(async tx=>{const trace={reads:0,queries:0,writes:0,paths:[]};traces.push(trace);
        const wrapper={get:async ref=>{trace.paths.push(ref.path);const snap=await tx.get(ref);trace.reads+=snap.docs?Math.max(1,snap.size):1;trace.queries+=snap.docs?1:0;return snap;}};
        for(const method of ['set','create','update','delete'])wrapper[method]=(...args)=>{trace.writes++;return tx[method](...args);};return callback(wrapper);});
    return {h,recovery,request,tickets,allocations,additional,adSourceId,adCloseId,reopenId,heartbeatId,root,traces,deps,sessions,takeover:async()=>{h.advance(1000);authTime=Math.floor(h.clock/1000);
        session=await sessions.create({auth:{uid:h.uid,token:{auth_time:authTime}},data:{uid:h.uid}});},intent:(sequence=1,ticketId=tickets[0])=>({auditId,expectedEpoch:1,operationId:`proof-capsule-${String(sequence).padStart(8,'0')}`,expectedSequence:sequence,component:'forest-ticket',sourceId:ticketId})};
}
const unchanged=async(f,operation,pattern)=>{const before=copy([...f.h.data]),writes=f.h.writes;await assert.rejects(operation,pattern);assert.deepEqual([...f.h.data],before);assert.equal(f.h.writes,writes);};
function capsule(f,input){const receipt=f.h.data.get(f.root+'/patrolProofPages/'+input.operationId);
    const chunks=receipt.chunkSha256s.map((_,index)=>f.h.data.get(f.root+'/proofPayloadChunks/'+input.operationId+'_'+String(index).padStart(2,'0')).payloadBytes);
    return {receipt,bytes:Buffer.concat(chunks),payload:decodeProofPayload(Buffer.concat(chunks))};}
test('true twenty Forest battles, Lv10 and slot2 current loss capture original bounded Forest components and replay complete old bytes',async()=>{
    const f=await fixture({adStatus:'abandoned'});assert.equal(f.tickets.length,21);let maximum=0;const forestPaths=new Set();
    const originalSources=copy([...f.h.data]);
    for(let index=0;index<f.tickets.length;index++){
        const input=f.intent(index+1,f.tickets[index]),result=await f.recovery.captureProof(f.request(),input),trace=f.traces.at(-1);
        assert(trace.reads<=400);assert(trace.writes<=10);assert.equal(trace.queries,index===0?3:1);
        for(const flag of ['authoritativeStateReady','candidateProofValid','trustedCaptureVerified','restoreAuthorized'])assert.equal(result[flag],false);
        const saved=capsule(f,input);for(const row of saved.payload.documents)if(row.exists)forestPaths.add(row.path);assert.equal(saved.bytes.length,result.payloadByteLength);assert(saved.bytes.length<=2*1024*1024);maximum=Math.max(maximum,saved.bytes.length);
        assert.deepEqual(encodeProofPayload(saved.payload),saved.bytes);
        assert(saved.payload.documents.some(row=>!row.exists),'explicit absence is retained');
        const original=copy([...f.h.data]);assert.deepEqual(await f.recovery.captureProof(f.request(),input),{...result,unchanged:true});
        assert.equal(f.traces.at(-1).writes,0);assert.deepEqual([...f.h.data],original);
    }
    assert(maximum>100000);assert.equal(f.h.data.get(f.root+'/proofState/current').nextSequence,22);
    const extra=new Set();assert.equal(f.allocations.length,9);
    for(const [index,sourceId] of f.allocations.entries()){
        const input={...f.intent(22+index),component:'exp-allocation',sourceId},result=await f.recovery.captureProof(f.request(),input);
        const saved=capsule(f,input);assert.equal(saved.payload.schemaVersion,2);assert.equal(saved.payload.component,'exp-allocation');
        assert.equal(saved.payload.sourceId,sourceId);assert.equal(result.component,'exp-allocation');
        for(const row of saved.payload.documents)if(row.exists&&!forestPaths.has(row.path))extra.add(row.path);
        assert(saved.payload.documents.some(row=>!row.exists&&row.path===f.h.root+'/grantOperations/'+sourceId));
        const trace=f.traces.at(-1);assert(trace.reads<=400);assert.equal(trace.queries,1);assert(trace.writes<=10);
        const before=copy([...f.h.data]);assert.equal((await f.recovery.captureProof(f.request(),input)).unchanged,true);assert.deepEqual([...f.h.data],before);
        assert(!f.traces.at(-1).paths.some(path=>path===f.h.root+'/operations/'+sourceId),'replay uses raw capsule, not live EXP kernel');
    }
    assert.equal(extra.size,36,'nine original EXP units add exactly36 previously uncovered present dependencies');
    for(const [path,row] of originalSources)assert.deepEqual(f.h.data.get(path),row,'all original sources and raw history remain byte-identical');
    assert.equal(f.h.data.get(f.root+'/proofState/current').nextSequence,31);
    const additionalInput={...f.intent(31),component:'additional-character-sources',sourceId:f.additional};
    const result=await f.recovery.captureProof(f.request(),additionalInput),saved=capsule(f,additionalInput),trace=f.traces.at(-1);
    assert.equal(result.component,'additional-character-sources');
    for(const flag of ['authoritativeStateReady','candidateProofValid','trustedCaptureVerified','restoreAuthorized'])assert.equal(result[flag],false);
    const union=new Set([...forestPaths,...extra]),added=saved.payload.documents.filter(row=>row.exists&&!union.has(row.path));
    assert.deepEqual(added.map(row=>row.path),[f.h.root+'/operations/'+f.additional]);
    assert.deepEqual(saved.payload.documents.filter(row=>!row.exists).map(row=>row.path).sort(),
        [f.h.root+'/grantOperations/'+f.additional,f.h.root+'/ledgerEntries/'+f.additional].sort());
    const operation=f.h.data.get(f.h.root+'/operations/'+f.additional),start=trace.paths.indexOf(f.h.root+'/operations/'+f.additional);
    assert.deepEqual(trace.paths.slice(start),[f.h.root+'/operations/'+f.additional,
        f.h.root+'/playableSnapshots/'+operation.sourceRevision,f.h.root+'/recoveryArchives/'+operation.sourceRevision,
        f.h.root+'/playableSnapshots/'+operation.resultRevision,f.h.root+'/recoveryArchives/'+operation.resultRevision,
        f.h.root+'/grantOperations/'+f.additional,f.h.root+'/ledgerEntries/'+f.additional]);
    const pageCount=[...f.h.data.keys()].filter(path=>path.startsWith(f.root+'/inventoryPages/')).length;
    assert.equal(trace.reads,pageCount+23);assert(trace.reads<=400);assert(trace.writes<=10);
    for(const [path,row] of originalSources)assert.deepEqual(f.h.data.get(path),row);
    const original=copy([...f.h.data]);assert.equal((await f.recovery.captureProof(f.request(),additionalInput)).unchanged,true);
    assert.deepEqual([...f.h.data],original);assert(!f.traces.at(-1).paths.includes(f.h.root+'/operations/'+f.additional));
    assert.equal(f.h.data.get(f.root+'/proofState/current').nextSequence,32);
    for(const row of saved.payload.documents)if(row.exists)union.add(row.path);
    const adInput={...f.intent(32),component:'simulated-ad-source',sourceId:f.adSourceId};
    const adResult=await f.recovery.captureProof(f.request(),adInput),adSaved=capsule(f,adInput),adTrace=f.traces.at(-1);
    assert.equal(adResult.component,'simulated-ad-source');
    assert.deepEqual(adSaved.payload.documents.filter(row=>row.exists&&!union.has(row.path)).map(row=>row.path).sort(),
        [f.h.root+'/simulatedAdSources/'+f.adSourceId,f.h.root+'/modeTimeEvents/'+f.adSourceId,f.h.root+'/modeTimeEvents/'+f.adCloseId].sort());
    const absences=adSaved.payload.documents.filter(row=>!row.exists).map(row=>row.path).sort();
    assert.deepEqual(absences,[f.adSourceId,f.adCloseId].flatMap(id=>['operations','ledgerEntries','grantOperations'].map(name=>f.h.root+'/'+name+'/'+id)).sort());
    assert.equal(adTrace.paths.slice(adTrace.paths.indexOf(f.h.root+'/simulatedAdSources/'+f.adSourceId)).length,18);
    assert(adTrace.reads<=pageCount+49);assert.equal(adTrace.queries,1);assert(adTrace.writes<=10);
    const beforeAdRetry=copy([...f.h.data]);assert.equal((await f.recovery.captureProof(f.request(),adInput)).unchanged,true);assert.deepEqual([...f.h.data],beforeAdRetry);
    assert(!f.traces.at(-1).paths.some(path=>path===f.h.root+'/simulatedAdSources/'+f.adSourceId||path===f.h.root+'/modeTimeEvents/'+f.adSourceId));
    for(const [path,row] of originalSources)assert.deepEqual(f.h.data.get(path),row);
    assert.equal(f.h.data.get(f.root+'/proofState/current').nextSequence,33);
    const present=new Set([...union,...adSaved.payload.documents.filter(row=>row.exists).map(row=>row.path)]);
    const priorAbsences=new Set();
    for(const row of f.h.data.values())if(row.kind==='canonical-recovery-proof-page'){
        const chunks=row.chunkSha256s.map((_,index)=>f.h.data.get(f.root+'/proofPayloadChunks/'+row.operationId+'_'+String(index).padStart(2,'0')).payloadBytes);
        for(const dependency of decodeProofPayload(Buffer.concat(chunks)).documents)if(!dependency.exists)priorAbsences.add(dependency.path);
    }
    const modeInput={...f.intent(33),component:'mode-nonvalue-event',sourceId:f.reopenId};
    const modeResult=await f.recovery.captureProof(f.request(),modeInput),modeSaved=capsule(f,modeInput),modeTrace=f.traces.at(-1);
    assert.equal(modeResult.component,'mode-nonvalue-event');
    assert.deepEqual(modeSaved.payload.documents.filter(row=>row.exists&&!present.has(row.path)),[],'original reopen is already present in Forest lineage');
    assert.deepEqual(modeSaved.payload.documents.filter(row=>!row.exists&&!priorAbsences.has(row.path)).map(row=>row.path).sort(),
        ['operations','ledgerEntries','grantOperations'].map(name=>f.h.root+'/'+name+'/'+f.reopenId).sort());
    assert(modeTrace.paths.slice(modeTrace.paths.indexOf(f.h.root+'/modeTimeEvents/'+f.reopenId)).length<=21);
    assert(modeTrace.reads<=pageCount+37);assert.equal(modeTrace.queries,1);assert(modeTrace.writes<=10);
    const beforeModeRetry=copy([...f.h.data]);assert.equal((await f.recovery.captureProof(f.request(),modeInput)).unchanged,true);assert.deepEqual([...f.h.data],beforeModeRetry);
    assert(!f.traces.at(-1).paths.some(path=>['modeTimeEvents','operations','ledgerEntries','grantOperations'].some(name=>path===f.h.root+'/'+name+'/'+f.reopenId)));
    for(const [path,row] of originalSources)assert.deepEqual(f.h.data.get(path),row);
    for(const flag of ['authoritativeStateReady','candidateProofValid','trustedCaptureVerified','restoreAuthorized'])assert.equal(modeResult[flag],false);
    assert.equal(f.h.data.get(f.root+'/proofState/current').nextSequence,34);




    assert.equal((await f.recovery.captureProof(f.request(),f.intent())).unchanged,true,'historical original receipt remains replayable');
});
test('Forest proof rollback, CAS race, strict intent, immutable chunk and inventory chain corruption reject without mutation',async()=>{
    const f=await fixture({battles:1,three:false}),input=f.intent();f.h.abortNext();await unchanged(f,()=>f.recovery.captureProof(f.request(),input),/rollback/);
    const results=await Promise.all([f.recovery.captureProof(f.request(),input),f.recovery.captureProof(f.request(),input)]);
    assert.deepEqual(results.map(row=>row.unchanged).sort(),[false,true]);
    await unchanged(f,()=>f.recovery.captureProof(f.request(),{...input,sourceId:'proof-nonexistent-ticket-01'}),/receipt differs/);
    const ticketPath=f.h.root+'/patrolTickets/'+input.sourceId;f.h.data.set(ticketPath,copy(f.h.data.get(ticketPath)));
    assert.equal((await f.recovery.captureProof(f.request(),input)).unchanged,true);
    assert(!f.traces.at(-1).paths.some(path=>/\/(patrolTickets|patrolTicketStates|patrolSettlements|patrolClosures)\//.test(path)),
        'old receipt replay uses the original capsule, not live Forest sources');
    const chunkPath=f.root+'/proofPayloadChunks/'+input.operationId+'_00',chunk=copy(f.h.data.get(chunkPath));f.h.data.delete(chunkPath);
    await unchanged(f,()=>f.recovery.captureProof(f.request(),input),/shape/);f.h.data.set(chunkPath,chunk);
    f.h.data.set(chunkPath,{...chunk,payloadBytes:Buffer.from('corrupt')});await unchanged(f,()=>f.recovery.captureProof(f.request(),input),/chunk differs/);f.h.data.set(chunkPath,chunk);
    const pagePath=[...f.h.data.keys()].find(path=>path.startsWith(f.root+'/inventoryPages/')),page=copy(f.h.data.get(pagePath));
    f.h.data.set(pagePath,{...page,payloadSha256:'f'.repeat(64)});await unchanged(f,()=>f.recovery.captureProof(f.request(),input),/seal/);f.h.data.set(pagePath,page);
    f.h.data.set(f.root+'/inventoryPages/proof-orphan-page-0001',copy(page));await unchanged(f,()=>f.recovery.captureProof(f.request(),input),/page inventory differs/);
});
test('proof admission does not inherit decoder limits, requires exhausted inventory and live source versions',async()=>{
    const f=await fixture({battles:1,three:false}),path=f.root+'/captureState/current',original=copy(f.h.data.get(path));
    const rehash=row=>{const {stateSha256,createdAt,updatedAt,...rest}=row;return {...row,stateSha256:snapshotDigest(rest)};};
    f.h.data.set(path,rehash({...original,namespaceIndex:30,inventoryExhausted:false}));await unchanged(f,()=>f.recovery.captureProof(f.request(),f.intent()),/admission/);f.h.data.set(path,original);
    f.h.data.set(path,rehash({...original,capturedCount:4097}));await unchanged(f,()=>f.recovery.captureProof(f.request(),f.intent()),/admission/);f.h.data.set(path,original);
    const source=f.h.root+'/patrolTickets/'+f.tickets[0],ticket=copy(f.h.data.get(source));f.h.data.set(source,ticket);
    await unchanged(f,()=>f.recovery.captureProof(f.request(),f.intent()),/version or bytes changed/);
});
test('sole proof codec bounds resources and chunk identifiers retain the original 64-character operation ID',()=>{
    assert.throws(()=>encodeProofPayload({validString:'x'.repeat(PATROL_PROOF_LIMITS.bytes)}),/size/);
    const operationId='a'.repeat(64),chunkId=operationId+'_07';assert.equal(chunkId.length,67);assert.match(chunkId,/^[A-Za-z0-9_-]{16,64}_0[0-7]$/);
    assert.throws(()=>decodeProofPayload(Buffer.from('[]')),/typed/);
});

test('valid original Forest unit with large canonical structural inventory either commits bounded chunks or rejects over2MiB without partial writes',async t=>{
    const f=await fixture({battles:1,three:false,largeBytes:300000}),input=f.intent();
    const result=await f.recovery.captureProof(f.request(),input);assert.equal(result.chunkCount,8);t.diagnostic(JSON.stringify({structuralCanonicalItemNameBytes:300000,exactCapsuleBytes:result.payloadByteLength,chunks:result.chunkCount,actualReads:f.traces.at(-1).reads,actualWrites:f.traces.at(-1).writes}));
    assert(result.payloadByteLength>256*1024);assert(f.traces.at(-1).writes<=10);
    assert.equal((await f.recovery.captureProof(f.request(),input)).unchanged,true);
    const huge=await fixture({battles:1,three:false,largeBytes:450000});
    await unchanged(huge,()=>huge.recovery.captureProof(huge.request(),huge.intent()),/payload size/);
    assert.equal(huge.traces.at(-1).writes,0);
});


test('state head, inventory binding, live expiry and cancellation remain mandatory for new components and old replay',async()=>{
    const f=await fixture({battles:1,three:false}),input=f.intent();await f.recovery.captureProof(f.request(),input);
    const path=f.root+'/proofState/current',original=copy(f.h.data.get(path));
    const rehash=row=>{const {stateSha256,createdAt,updatedAt,...rest}=row;return {...row,stateSha256:snapshotDigest(rest)};};
    for(const changed of [{...original,nextSequence:99},{...original,lastOperationId:'proof-missing-head-operation'},
        {...original,inventoryStateSha256:'f'.repeat(64)}]){
        f.h.data.set(path,rehash(changed));await unchanged(f,()=>f.recovery.captureProof(f.request(),input),/state/);
    }f.h.data.set(path,original);
    f.h.advance(60000);await unchanged(f,()=>f.recovery.captureProof(f.request(),input),/operator approval/);f.h.advance(-60000);
    await f.recovery.cancelAudit(f.request(),{operationId:'proof-cancel-operation-001',auditId,expectedEpoch:1});
    await unchanged(f,()=>f.recovery.captureProof(f.request(),input),/epoch or session/);
});
test('bounded inventory query detects overflow before decoding arbitrary orphan pages',async()=>{
    const f=await fixture({battles:1,three:false}),pages=[...f.h.data.keys()].filter(path=>path.startsWith(f.root+'/inventoryPages/'));
    const template=copy(f.h.data.get(pages[0]));
    for(let number=pages.length;number<318;number++)f.h.data.set(f.root+'/inventoryPages/'+('overflow-page-'+String(number).padStart(8,'0')),template);
    await unchanged(f,()=>f.recovery.captureProof(f.request(),f.intent()),/page inventory differs/);
    assert.equal(f.traces.at(-1).reads,332);assert.equal(f.traces.at(-1).queries,3);assert.equal(f.traces.at(-1).writes,0);
});

test('the sixty-point Forest kernel guard rejects a 61st request before issuing that read',async()=>{
    const f=await fixture({battles:1,three:false}),filename=require.resolve('../functions/src/canonical-current-recovery'),compiled=new Module(filename);
    compiled.filename=filename;compiled.paths=Module._nodeModulePaths(dirname(filename));const native=compiled.require.bind(compiled);let issued=0;
    compiled.require=name=>name==='./canonical-patrol-settlement'?{createCanonicalPatrolSettlement:deps=>{
        const original=createCanonicalPatrolSettlement(deps);return {...original,verifyRetainedTicket:async(tx,root,uid,account,row,max)=>{
            // This fault injection only exercises the caller's hard read fence;
            // successful proofs above always use the unchanged original Owner.
            for(let number=0;number<61;number++){await tx.get(root.collection('patrolTickets').doc(row.id));issued++;}
            return original.verifyRetainedTicket(tx,root,uid,account,row,max);
        }};
    }}:native(name);
    compiled._compile(readFileSync(filename,'utf8'),filename);
    const recovery=compiled.exports.createCanonicalCurrentRecovery(f.deps);
    await unchanged(f,()=>recovery.captureProof(f.request(),f.intent()),/kernel read budget/);
    assert.equal(issued,60);assert.equal(f.traces.at(-1).writes,0);assert(f.traces.at(-1).reads<=400);
});
test('fixed capsule writes have bounded document and Commit sizing; default index estimate is explicitly separate from unobserved production indexes',async t=>{
    const f=await fixture({battles:1,three:false,largeBytes:300000});await f.recovery.captureProof(f.request(),f.intent());
    const rows=[...f.h.data].filter(([path])=>['proofPayloadChunks','patrolProofPages','proofState'].some(name=>path.startsWith(f.root+'/'+name+'/')));
    assert.equal(rows.length,10);let wireUpper=0,automaticIndexUpper=0;
    for(const [path,row] of rows){
        const nameBytes=Buffer.byteLength(path),payload=Buffer.isBuffer(row.payloadBytes)?row.payloadBytes.length:0;
        const metadata=Object.fromEntries(Object.entries(row).filter(([key])=>key!=='payloadBytes'));
        assert(nameBytes<=6144);assert(Buffer.byteLength(JSON.stringify(metadata))<=16384);
        // A deliberately loose serialized-document/Commit allowance for this
        // fixed shallow schema, NOT an observed SDK protobuf byte count.
        const documentUpper=payload+65536;assert(documentUpper<1024*1024);wireUpper+=documentUpper+16384;
        // Two automatic scalar directions; arrays contribute their bounded
        // entries. No claim about out-of-band production composite indexes.
        for(const [key,value] of Object.entries(row)){
            const values=Array.isArray(value)?value:[value];
            for(const element of values){const size=Buffer.isBuffer(element)?element.length:Buffer.byteLength(JSON.stringify(element));
                automaticIndexUpper+=2*(2*nameBytes+Buffer.byteLength(key)+Math.min(1500,size)+64);}
        }
    }
    assert(wireUpper+automaticIndexUpper<10*1024*1024);
    t.diagnostic(JSON.stringify({fixedSchemaCommitUpperBytes:wireUpper,defaultAutomaticIndexEstimateUpperBytes:automaticIndexUpper,
        actualSDKWireBytes:'not observed',productionIndexOverhead:'not observed'}));
});

test('an exact SDK updateTime is mandatory during Forest capture, with no millisecond or data timestamp fallback',async()=>{
    const f=await fixture({battles:1,three:false}),base=f.h.dependencies.db.runTransaction,ticketPath=f.h.root+'/patrolTickets/'+f.tickets[0];
    f.h.dependencies.db.runTransaction=callback=>base(async tx=>callback({...tx,get:async reference=>{
        const row=await tx.get(reference);return reference.path===ticketPath?{...row,updateTime:undefined}:row;
    }}));
    await unchanged(f,()=>f.recovery.captureProof(f.request(),f.intent()),/timestamp/);assert.equal(f.traces.at(-1).writes,0);
});

for(const keepReceipt of [true,false])test('missing proof state cannot reset sequence1 over retained '+(keepReceipt?'receipt':'chunk-only')+' history',async()=>{
        const f=await fixture({battles:1,three:false}),first=f.intent();await f.recovery.captureProof(f.request(),first);
        f.h.data.delete(f.root+'/proofState/current');if(!keepReceipt)f.h.data.delete(f.root+'/patrolProofPages/'+first.operationId);
        await unchanged(f,()=>f.recovery.captureProof(f.request(),{...first,operationId:'proof-reopened-missing-state'}),/orphan|missing proof state/);
});

test('rested-winning original Forest proof remains valid after sole codec capture and original-chunk replay',async()=>{
    const f=await fixture({battles:1,three:false,rested:true}),root=f.h.dependencies.db.collection('serverUsers').doc(f.h.uid),
        account=f.h.data.get(f.h.root+'/recoveryArchives/'+f.h.revision).sourceRecords.account;
    await f.deps.runProtected(f.request(),async tx=>{
        const forest=createCanonicalPatrolSettlement(f.deps);forest.beginEvidenceAttempt(tx);
        await forest.verifyRetainedTicket(tx,root,f.h.uid,account,await tx.get(root.collection('patrolTickets').doc(f.tickets[0])),f.h.revision);
    });
    const terminal=[...f.h.data].find(([path,row])=>path.startsWith(f.h.root+'/patrolSettlements/')&&row.intent?.kind==='win')[1];
    assert.equal(terminal.mode.rested,true);
    const originalKeys=Object.keys(f.h.data.get(f.h.root+'/modeTimeEvents/'+terminal.operationId).beforeModes.rested);
    const original=copy([...f.h.data]),result=await f.recovery.captureProof(f.request(),f.intent());
    const decoded=capsule(f,f.intent()).payload.documents.find(row=>row.path===f.h.root+'/modeTimeEvents/'+terminal.operationId);
    assert.notDeepEqual(Object.keys(decoded.data.beforeModes.rested),originalKeys,
        'the original sorted codec remains unchanged; original raw sidecars determine reconstruction');
    assert.equal((await f.recovery.captureProof(f.request(),f.intent())).unchanged,true);
    for(const [path,row] of original)assert.deepEqual(f.h.data.get(path),row,'original source and raw strings are unchanged');
    for(const flag of ['authoritativeStateReady','candidateProofValid','trustedCaptureVerified','restoreAuthorized'])assert.equal(result[flag],false);
});

function permuteModeMaps(tx,mutate){return {get:async reference=>{
    const snap=await tx.get(reference);if(!snap.exists)return snap;
    const raw=snap.data();if(reference.path.includes('/modeTimeEvents/'))for(const name of ['beforeModes','afterModes'])if(raw[name]?.rested){
        const original=raw[name].rested;raw[name].rested=Object.fromEntries(Object.keys(original).sort().map(key=>[key,original[key]]));
    }
    if(mutate)mutate(raw,reference.path);
    return {id:snap.id,ref:snap.ref,exists:true,updateTime:snap.updateTime,data:()=>raw,
        get:key=>key.split('.').reduce((value,part)=>value?.[part],raw)};
}};}
for(const kind of ['v1-mode','v2-forest'])test('original '+kind+' proof derives exact sidecar bytes from canonical archive despite unordered evidence maps',async()=>{
    const f=await fixture({battles:1,three:false,rested:true}),before=copy([...f.h.data]),root=f.h.dependencies.db.collection('serverUsers').doc(f.h.uid),
        records=f.h.data.get(f.h.root+'/recoveryArchives/'+f.h.revision).sourceRecords;
    const check=async tx=>{
        if(kind==='v1-mode'){
            const mode=createCanonicalAccountModeTime(f.deps),event=[...f.h.data].find(([path,row])=>path.startsWith(f.h.root+'/modeTimeEvents/')&&row.intent?.action==='resume')[0];
            await mode.verifyRetainedEvent(tx,root,f.h.uid,records.account,await tx.get(f.h.dependencies.db.doc(event)),f.h.revision);
        }else{
            const forest=createCanonicalPatrolSettlement(f.deps);forest.beginEvidenceAttempt(tx);
            await forest.verifyRetainedTicket(tx,root,f.h.uid,records.account,await tx.get(root.collection('patrolTickets').doc(f.tickets[0])),f.h.revision);
        }
    };
    await f.deps.runProtected(f.request(),check); // Same original Owner first passes untouched SDK data.
    await f.deps.runProtected(f.request(),tx=>check(permuteModeMaps(tx)));
    assert.deepEqual([...f.h.data],before,'neither proof can rewrite original source or raw JSON');
    for(const fault of ['value','delta','hash','raw']){
        await unchanged(f,()=>f.deps.runProtected(f.request(),tx=>check(permuteModeMaps(tx,(raw,path)=>{
            const target=raw.intent?.action===(kind==='v1-mode'?'resume':'forest-settlement')&&
                (kind==='v1-mode'||raw.intent.settlementKind==='win');
            if(target){
                if(fault==='hash')raw.sha256='f'.repeat(64);
                if(fault==='value')raw.beforeModes.rested.battles++;
                if(fault==='delta')raw.delta.restedBattles++;
                if(fault==='value'||fault==='delta'){const {sha256,createdAt,...payload}=raw;raw.sha256=snapshotDigest(payload);}
            }
            if(fault==='raw'&&path.includes('/recoveryArchives/'))raw.sourceRecords.progress.sidecars['rested-exp-state'].raw+=' ';
        }))),/inconsistent|differs|missing|invalid/);
    }
});


// Explicit legacy-data fixture only: retain the exact v1 formats and hash rule.
// Production never converts, upgrades or rewrites these immutable records.
function legacyProofFixture(f,input){
    const saved=capsule(f,input),payload={schemaVersion:1,kind:'canonical-recovery-patrol-proof-payload',
        ownerUid:saved.payload.ownerUid,sourceRevision:saved.payload.sourceRevision,ticketId:input.sourceId,
        inventoryStateSha256:saved.payload.inventoryStateSha256,documents:saved.payload.documents};
    const bytes=encodeProofPayload(payload),parts=[];for(let offset=0;offset<bytes.length;offset+=256*1024)parts.push(bytes.subarray(offset,offset+256*1024));
    const hash=value=>require('node:crypto').createHash('sha256').update(value).digest('hex');
    const {component,sourceId,...receipt}=saved.receipt;
    Object.assign(receipt,{schemaVersion:1,kind:'canonical-recovery-patrol-proof-page',ticketId:sourceId,
        intentSha256:snapshotDigest({action:'capture-patrol-proof',auditId:input.auditId,expectedEpoch:input.expectedEpoch,
            operationId:input.operationId,expectedSequence:input.expectedSequence,ticketId:sourceId}),
        payloadSha256:hash(bytes),payloadByteLength:bytes.length,chunkSha256s:parts.map(hash)});
    f.h.data.set(f.root+'/patrolProofPages/'+input.operationId,receipt);
    const old=f.h.data.get(f.root+'/proofState/current'),{lastComponent,lastSourceId,...state}=old;
    Object.assign(state,{schemaVersion:1,kind:'canonical-recovery-patrol-proof-state',lastPayloadSha256:receipt.payloadSha256});
    const {stateSha256,createdAt,updatedAt,...body}=state;state.stateSha256=snapshotDigest(body);f.h.data.set(f.root+'/proofState/current',state);
    for(let index=0;index<saved.receipt.chunkSha256s.length;index++)f.h.data.delete(f.root+'/proofPayloadChunks/'+input.operationId+'_'+String(index).padStart(2,'0'));
    parts.forEach((payloadBytes,chunkIndex)=>f.h.data.set(f.root+'/proofPayloadChunks/'+input.operationId+'_'+String(chunkIndex).padStart(2,'0'),{
        schemaVersion:1,kind:'canonical-recovery-patrol-proof-chunk',ownerUid:receipt.ownerUid,auditId:receipt.auditId,epoch:receipt.epoch,
        operationId:receipt.operationId,chunkIndex,payloadBytes,sha256:receipt.chunkSha256s[chunkIndex]}));
    return {bytes,receipt};
}

test('legacy schema1 Forest retains original hashes and bytes through unified API replay and continuation; EXP requires a new audit',async()=>{
    const f=await fixture({battles:2,three:false}),input=f.intent();await f.recovery.captureProof(f.request(),input);
    const legacy=legacyProofFixture(f,input),before=copy([...f.h.data]);
    assert.equal(typeof f.recovery.capturePatrolProof,'undefined','old test-only API is removed instead of wrapped');
    assert.equal((await f.recovery.captureProof(f.request(),input)).unchanged,true);assert.deepEqual([...f.h.data],before);
    assert.deepEqual(capsule(f,input).bytes,legacy.bytes);assert.deepEqual(capsule(f,input).receipt,legacy.receipt);
    for(const component of ['exp-allocation','additional-character-sources','simulated-ad-source','mode-nonvalue-event'])await unchanged(f,()=>f.recovery.captureProof(f.request(),{...f.intent(2),component,sourceId:'legacy-source-operation-01'}),/new audit/);
    await unchanged(f,()=>f.recovery.captureRawInventory(f.request(),{auditId,expectedEpoch:1,operationId:'legacy-raw-operation-0001',expectedSequence:2,startOrdinal:0,count:1}),/new audit/);
    const next=f.intent(2,f.tickets[1]);await f.recovery.captureProof(f.request(),next);
    assert.equal(capsule(f,next).receipt.schemaVersion,1);assert.equal(capsule(f,next).payload.ticketId,next.sourceId);
    assert.equal(f.h.data.get(f.root+'/proofState/current').schemaVersion,1);
    const after=copy([...f.h.data]);assert.equal((await f.recovery.captureProof(f.request(),input)).unchanged,true);assert.deepEqual([...f.h.data],after);
    const state=f.h.data.get(f.root+'/proofState/current');f.h.data.delete(f.root+'/proofState/current');
    await unchanged(f,()=>f.recovery.captureProof(f.request(),{...f.intent(),operationId:'legacy-orphan-capture-0001'}),/orphan/);
    f.h.data.set(f.root+'/proofState/current',state);
});


test('EXP source kind is hard-listed and v2 component/source tuple, original debit proof and chunks fail closed',async()=>{
    const f=await fixture(),sourceId=f.allocations[0],input={...f.intent(),component:'exp-allocation',sourceId};
    for(const component of ['shop-purchase','attribute-allocation','unknown'])await unchanged(f,()=>f.recovery.captureProof(f.request(),{...input,component}),/required/);
    await unchanged(f,()=>f.recovery.captureProof(f.request(),{...input,sourceId:f.tickets[0]}),/kind or identity/);
    await unchanged(f,()=>f.recovery.captureProof(f.request(),{...input,component:'forest-ticket'}));
    for(const fault of ['shop-purchase','attribute-allocation','ledger','grant','snapshot','archive']){
        const bad=createCanonicalCurrentRecovery({...f.deps,runRecoveryAuditMaintenance:(req,id,operation)=>
            f.deps.runRecoveryAuditMaintenance(req,id,async(tx,session)=>operation({...tx,get:async reference=>{
                const snap=await tx.get(reference);if(snap.docs)return snap;const raw=snap.data();let exists=snap.exists;
                if(reference.path===f.h.root+'/operations/'+sourceId&&['shop-purchase','attribute-allocation'].includes(fault))raw.kind=fault;
                if(reference.path===f.h.root+'/ledgerEntries/'+sourceId&&fault==='ledger')raw.amount--;
                if(reference.path===f.h.root+'/grantOperations/'+sourceId&&fault==='grant'){exists=true;}
                const revision=f.h.data.get(f.h.root+'/operations/'+sourceId).allocatedRevision;
                if(reference.path===f.h.root+'/playableSnapshots/'+revision&&fault==='snapshot')raw.sha256='f'.repeat(64);
                if(reference.path===f.h.root+'/recoveryArchives/'+revision&&fault==='archive')raw.sourceSha256='f'.repeat(64);
                return {...snap,exists,data:()=>raw,get:key=>key.split('.').reduce((value,part)=>value?.[part],raw)};
            }},session))});
        await unchanged(f,()=>bad.captureProof(f.request(),input),error=>error.code==='data-loss');
    }
    const readError=Error('EXP ledger read rejected'),grantPath=f.h.root+'/grantOperations/'+sourceId;let grantStarted=false;
    const failedRead=createCanonicalCurrentRecovery({...f.deps,runRecoveryAuditMaintenance:(req,id,operation)=>
        f.deps.runRecoveryAuditMaintenance(req,id,(tx,session)=>operation({...tx,get:reference=>{
            if(reference.path===f.h.root+'/ledgerEntries/'+sourceId)throw readError;
            if(reference.path===grantPath)grantStarted=true;
            return tx.get(reference);
        }},session))});
    await unchanged(f,()=>failedRead.captureProof(f.request(),input),error=>error===readError);
    assert.equal(grantStarted,false,'a failed ledger read cannot leave another started seed read after callback rejection');
    f.h.abortNext();await unchanged(f,()=>f.recovery.captureProof(f.request(),input),/rollback/);
    const raced=await Promise.all([f.recovery.captureProof(f.request(),input),f.recovery.captureProof(f.request(),input)]);
    assert.deepEqual(raced.map(row=>row.unchanged).sort(),[false,true]);
    const pagePath=f.root+'/patrolProofPages/'+input.operationId,statePath=f.root+'/proofState/current',saved=capsule(f,input);
    const next={...f.intent(2),component:'exp-allocation',sourceId:f.allocations[1]};
    await unchanged(f,()=>f.recovery.captureProof(f.request(),{...input,component:'forest-ticket',sourceId:f.tickets[0]}),/receipt differs/);
    for(const target of ['component','sourceId']){
        const path=f.root+'/proofPayloadChunks/'+input.operationId+'_00',chunk=copy(f.h.data.get(path));
        f.h.data.set(path,{...chunk,[target]:target==='component'?'forest-ticket':f.tickets[0]});
        await unchanged(f,()=>f.recovery.captureProof(f.request(),input),/chunk differs/);f.h.data.set(path,chunk);
        const state=copy(f.h.data.get(statePath)),changed={...state,[target==='component'?'lastComponent':'lastSourceId']:target==='component'?'forest-ticket':f.tickets[0]};
        const {stateSha256,createdAt,updatedAt,...body}=changed;changed.stateSha256=snapshotDigest(body);f.h.data.set(statePath,changed);
        await unchanged(f,()=>f.recovery.captureProof(f.request(),next),/state head differs/);f.h.data.set(statePath,state);
    }
    for(const path of [pagePath,f.root+'/proofPayloadChunks/'+input.operationId+'_00',statePath]){
        const raw=copy(f.h.data.get(path));f.h.data.set(path,{...raw,schemaVersion:1});
        await unchanged(f,()=>f.recovery.captureProof(f.request(),input));f.h.data.set(path,raw);
    }
    assert.deepEqual(capsule(f,input).bytes,saved.bytes);
    f.h.advance(61000);await unchanged(f,()=>f.recovery.captureProof(f.request(),input),/approval/);
});


test('additional-character component uses only its original seven-read proof and rejects wrong sources, corruption and economic overlap',async()=>{
    const f=await fixture(),sourceId=f.additional,input={...f.intent(),component:'additional-character-sources',sourceId};
    for(const wrong of ['proof-initial-operation-001',f.allocations[0],f.tickets[0],'additional-unknown-source-01'])
        await unchanged(f,()=>f.recovery.captureProof(f.request(),{...input,sourceId:wrong}),/kind or identity/);
    const original=f.h.data.get(f.h.root+'/operations/'+sourceId);
    const originalPaths=['playableSnapshots/'+original.sourceRevision,'recoveryArchives/'+original.sourceRevision,
        'playableSnapshots/'+original.resultRevision,'recoveryArchives/'+original.resultRevision];
    for(const fault of ['uid','slot','character','hash','identity','kind','grant','ledger',...originalPaths.flatMap(path=>['missing:'+path,'corrupt:'+path])]){
        const bad=createCanonicalCurrentRecovery({...f.deps,runRecoveryAuditMaintenance:(req,id,operation)=>
            f.deps.runRecoveryAuditMaintenance(req,id,(tx,session)=>operation({...tx,get:async reference=>{
                const snap=await tx.get(reference);if(snap.docs)return snap;let exists=snap.exists;const raw=snap.data();
                if(reference.path===f.h.root+'/operations/'+sourceId){
                    if(fault==='uid')raw.ownerUid='foreign-owner';
                    if(fault==='kind')raw.kind='unknown-operation';
                    if(fault==='slot')raw.slotIndex=2;
                    if(fault==='character')raw.characterId='character-foreign-operation';
                    if(fault==='hash')raw.snapshotSha256='f'.repeat(64);
                    if(fault==='identity')raw.operationId='foreign-operation-000001';
                }
                if(reference.path===f.h.root+'/grantOperations/'+sourceId&&fault==='grant')exists=true;
                if(reference.path===f.h.root+'/ledgerEntries/'+sourceId&&fault==='ledger')exists=true;
                if(fault==='missing:'+reference.path.slice(f.h.root.length+1))exists=false;
                if(fault==='corrupt:'+reference.path.slice(f.h.root.length+1)){
                    if(reference.path.includes('/playableSnapshots/'))raw.sha256='f'.repeat(64);else raw.sourceSha256='f'.repeat(64);
                }
                return {...snap,exists,data:()=>raw,get:key=>key.split('.').reduce((value,part)=>value?.[part],raw)};
            }},session))});
        const expected=fault.startsWith('missing:')&&fault.endsWith('/'+f.h.revision)?'failed-precondition':'data-loss';
        await unchanged(f,()=>bad.captureProof(f.request(),input),error=>error.code===expected);
    }
    f.h.abortNext();await unchanged(f,()=>f.recovery.captureProof(f.request(),input),/rollback/);
    const start=f.traces.length,race=await Promise.all([f.recovery.captureProof(f.request(),input),f.recovery.captureProof(f.request(),input)]);
    assert.deepEqual(race.map(row=>row.unchanged).sort(),[false,true]);
    const pages=[...f.h.data.keys()].filter(path=>path.startsWith(f.root+'/inventoryPages/')).length;
    assert(f.traces.slice(start).some(trace=>trace.reads===pages+24&&trace.writes>0),'fresh original unit includes exactly seven point reads');
    assert(f.traces.slice(start).every(trace=>trace.reads<=400&&trace.writes<=10));
    const saved=capsule(f,input);assert.equal(saved.payload.component,'additional-character-sources');
    const before=copy([...f.h.data]);assert.equal((await f.recovery.captureProof(f.request(),input)).unchanged,true);assert.deepEqual([...f.h.data],before);
    assert(!f.traces.at(-1).paths.some(path=>path===f.h.root+'/operations/'+sourceId));
    f.h.advance(61000);await unchanged(f,()=>f.recovery.captureProof(f.request(),input),/approval/);
    await f.recovery.cancelAudit(f.request(),{auditId,expectedEpoch:1,operationId:'additional-proof-cancel-01'});
    await unchanged(f,()=>f.recovery.captureProof(f.request(),input));
});


for(const [status,unitReads] of [['pending',10],['consumed',20],['abandoned',18]])test('simulated-ad '+status+' capture reuses original source proof and exact reads across a later audit session',async()=>{
    const f=await fixture({battles:1,three:false,adStatus:status,historicalSession:true}),input={...f.intent(),component:'simulated-ad-source',sourceId:f.adSourceId};
    const source=f.h.data.get(f.h.root+'/simulatedAdSources/'+f.adSourceId),before=copy([...f.h.data]);
    assert.equal(source.status,status);assert.equal(source.verifiedProvider,false);assert.equal(source.rewardMs,28800000);assert.equal(source.maximumMs,115200000);
    assert.notEqual(source.sessionId,f.h.data.get(f.root).sessionId,'historical source session is not the current audit session');
    if(status==='consumed'){
        assert.equal(source.closedAtMs-source.startedAtMs,3000);
        const records=f.h.data.get(f.h.root+'/recoveryArchives/'+f.h.revision).sourceRecords;
        assert.equal(JSON.parse(records.progress.sidecars['element-box-state'].raw).remainingMs,28800000);
    }
    const result=await f.recovery.captureProof(f.request(),input),trace=f.traces.at(-1),saved=capsule(f,input);
    const start=trace.paths.indexOf(f.h.root+'/simulatedAdSources/'+f.adSourceId);assert.equal(trace.paths.slice(start).length,unitReads);
    const pages=[...f.h.data.keys()].filter(path=>path.startsWith(f.root+'/inventoryPages/')).length;
    assert.equal(trace.reads,pages+17+unitReads);assert(trace.reads<=pages+50);assert.equal(trace.queries,3);assert(trace.writes<=10);
    assert.equal(saved.payload.component,'simulated-ad-source');
    if(status==='pending')assert(saved.payload.documents.some(row=>row.path===f.h.root+'/modeTime/current'&&row.exists));
    for(const [path,row] of before)assert.deepEqual(f.h.data.get(path),row);
    for(const flag of ['authoritativeStateReady','candidateProofValid','trustedCaptureVerified','restoreAuthorized'])assert.equal(result[flag],false);
    const original=copy([...f.h.data]);assert.equal((await f.recovery.captureProof(f.request(),input)).unchanged,true);assert.deepEqual([...f.h.data],original);
    assert(!f.traces.at(-1).paths.some(path=>path.startsWith(f.h.root+'/simulatedAdSources/')||path.startsWith(f.h.root+'/modeTimeEvents/')));
});


test('simulated-ad source identity, original event chains and economic collisions refuse without writes in all three states',async()=>{
    for(const status of ['pending','consumed','abandoned']){
        const f=await fixture({battles:1,three:false,adStatus:status}),input={...f.intent(),component:'simulated-ad-source',sourceId:f.adSourceId};
        const sourcePath=f.h.root+'/simulatedAdSources/'+f.adSourceId,beginPath=f.h.root+'/modeTimeEvents/'+f.adSourceId,
            closePath=f.adCloseId?f.h.root+'/modeTimeEvents/'+f.adCloseId:null;
        const begin=f.h.data.get(beginPath),predecessor=f.h.root+'/modeTimeEvents/'+begin.beforeHead.lastOperationId;
        for(const wrong of [f.tickets[0],'simulated-ad-unknown-source'])await unchanged(f,()=>f.recovery.captureProof(f.request(),{...input,sourceId:wrong}),/kind or identity/);
        const faults=['missing-source','identity','schema','kind','uid','session','hash','status','provider','missing-begin','begin-hash','predecessor','archive',
            ...(status==='pending'?['pending-head']:['missing-close','closure']),...(status==='consumed'?['receipt','ledger','grant']:['economic-overlap'])];
        for(const fault of faults){
            const bad=createCanonicalCurrentRecovery({...f.deps,runRecoveryAuditMaintenance:(req,id,operation)=>
                f.deps.runRecoveryAuditMaintenance(req,id,(tx,session)=>operation({...tx,get:async reference=>{
                    const snap=await tx.get(reference);if(snap.docs)return snap;let raw=snap.data(),exists=snap.exists;
                    if(reference.path===sourcePath){
                        if(fault==='missing-source')exists=false;
                        if(fault==='identity')raw.sourceId='simulated-ad-foreign-source';
                        if(fault==='schema')raw.schemaVersion=2;
                        if(fault==='kind')raw.kind='unknown-ad-source';
                        if(fault==='uid')raw.ownerUid='foreign-owner';
                        if(fault==='session'){
                            raw.sessionId='historical-session-that-does-not-match-begin';
                            const {sha256,status,consumedBy,closedAtMs,createdAt,updatedAt,...body}=raw;raw.sha256=snapshotDigest(body);
                        }
                        if(fault==='hash')raw.sha256='f'.repeat(64);
                        if(fault==='status')raw.status='unknown';
                        if(fault==='provider')raw.verifiedProvider=true;
                        if(fault==='closure')raw.closedAtMs++;
                    }
                    if(reference.path===beginPath){if(fault==='missing-begin')exists=false;if(fault==='begin-hash')raw.sha256='f'.repeat(64);}
                    if(reference.path===predecessor&&fault==='predecessor')exists=false;
                    if(reference.path===closePath&&fault==='missing-close')exists=false;
                    if(reference.path===f.h.root+'/recoveryArchives/'+begin.sourceRevision&&fault==='archive')raw.sourceSha256='f'.repeat(64);
                    if(reference.path===f.h.root+'/modeTime/current'&&fault==='pending-head')exists=false;
                    if(reference.path===f.h.root+'/operations/'+f.adCloseId&&fault==='receipt')exists=false;
                    if(reference.path===f.h.root+'/ledgerEntries/'+f.adCloseId&&fault==='ledger')exists=false;
                    if(reference.path===f.h.root+'/grantOperations/'+f.adCloseId&&fault==='grant'){exists=true;raw={ownerUid:f.h.uid};}
                    if(reference.path===f.h.root+'/operations/'+f.adSourceId&&fault==='economic-overlap'){exists=true;raw={ownerUid:f.h.uid};}
                    return {...snap,exists,data:()=>raw,get:key=>key.split('.').reduce((value,part)=>value?.[part],raw)};
                }},session))});
            await unchanged(f,()=>bad.captureProof(f.request(),input),error=>error.code==='data-loss');
        }
        f.h.abortNext();await unchanged(f,()=>f.recovery.captureProof(f.request(),input),/rollback/);
        const results=await Promise.all([f.recovery.captureProof(f.request(),input),f.recovery.captureProof(f.request(),input)]);
        assert.deepEqual(results.map(row=>row.unchanged).sort(),[false,true]);
        await unchanged(f,()=>f.recovery.captureProof(f.request(),{...input,component:'forest-ticket',sourceId:f.tickets[0]}),/receipt differs/);
        const path=f.root+'/proofPayloadChunks/'+input.operationId+'_00',chunk=copy(f.h.data.get(path));f.h.data.set(path,{...chunk,sourceId:f.tickets[0]});
        await unchanged(f,()=>f.recovery.captureProof(f.request(),input),/chunk differs/);f.h.data.set(path,chunk);
        f.h.advance(61000);await unchanged(f,()=>f.recovery.captureProof(f.request(),input),/approval/);
    }
});


test('non-value mode component accepts original v1 reopen, heartbeat and ad lifecycle with no new entitlement',async()=>{
    const f=await fixture({battles:1,three:false,adStatus:'abandoned',zeroHeartbeat:true,historicalSession:true});
    const original=copy([...f.h.data]),sources=[f.reopenId,f.heartbeatId,f.adSourceId,f.adCloseId];
    const pages=[...f.h.data.keys()].filter(path=>path.startsWith(f.root+'/inventoryPages/')).length;
    for(const [index,sourceId] of sources.entries()){
        const input={...f.intent(index+1),component:'mode-nonvalue-event',sourceId},result=await f.recovery.captureProof(f.request(),input),trace=f.traces.at(-1);
        const unitReads=trace.paths.slice(trace.paths.indexOf(f.h.root+'/modeTimeEvents/'+sourceId)).length;
        assert(unitReads<=21);assert.equal(trace.reads,pages+(index===0?17:16)+unitReads);assert(trace.reads<=pages+(index===0?38:37));
        assert.equal(trace.queries,index===0?3:1);assert(trace.writes<=10);
        const saved=capsule(f,input);assert.equal(saved.payload.component,'mode-nonvalue-event');
        const event=f.h.data.get(f.h.root+'/modeTimeEvents/'+sourceId);assert.equal(event.schemaVersion,1);assert.equal(event.modeChanged,false);
        assert.deepEqual(saved.payload.documents.filter(row=>!row.exists&&['operations','ledgerEntries','grantOperations'].some(name=>row.path===f.h.root+'/'+name+'/'+sourceId)).map(row=>row.path).sort(),
            ['operations','ledgerEntries','grantOperations'].map(name=>f.h.root+'/'+name+'/'+sourceId).sort());
        const before=copy([...f.h.data]);assert.equal((await f.recovery.captureProof(f.request(),input)).unchanged,true);assert.deepEqual([...f.h.data],before);
        assert(!f.traces.at(-1).paths.some(path=>['modeTimeEvents','operations','ledgerEntries','grantOperations'].some(name=>path===f.h.root+'/'+name+'/'+sourceId)));
        for(const flag of ['authoritativeStateReady','candidateProofValid','trustedCaptureVerified','restoreAuthorized'])assert.equal(result[flag],false);
    }
    for(const [path,row] of original)assert.deepEqual(f.h.data.get(path),row);
});


test('non-value mode source guard and original predecessor/ad/economic proof fail closed, with atomic capture and chunk retry',async()=>{
    const f=await fixture({battles:1,three:false,adStatus:'abandoned',zeroHeartbeat:true,rested:true});
    const sourceId=f.adCloseId,input={...f.intent(),component:'mode-nonvalue-event',sourceId},eventPath=f.h.root+'/modeTimeEvents/'+sourceId;
    const event=f.h.data.get(eventPath),predecessor=f.h.root+'/modeTimeEvents/'+event.beforeHead.lastOperationId;
    const excluded=[...f.h.data].filter(([path,row])=>path.startsWith(f.h.root+'/modeTimeEvents/')&&(row.schemaVersion===2||row.modeChanged===true));
    assert(excluded.some(([,row])=>row.schemaVersion===1&&row.modeChanged===true));assert(excluded.some(([,row])=>row.schemaVersion===2));
    for(const [path] of excluded)await unchanged(f,()=>f.recovery.captureProof(f.request(),{...input,sourceId:path.split('/').at(-1)}),/kind or identity/);
    for(const fault of ['missing','identity','uid','schema','kind','value','hash','source','predecessor','ad','operation','ledger','grant']){
        const bad=createCanonicalCurrentRecovery({...f.deps,runRecoveryAuditMaintenance:(req,id,operation)=>
            f.deps.runRecoveryAuditMaintenance(req,id,(tx,session)=>operation({...tx,get:async reference=>{
                const snap=await tx.get(reference);if(snap.docs)return snap;let raw=snap.data(),exists=snap.exists;
                if(reference.path===eventPath){
                    if(fault==='missing')exists=false;
                    if(fault==='identity')raw.operationId='foreign-mode-operation-0001';
                    if(fault==='uid')raw.ownerUid='foreign-owner';
                    if(fault==='schema')raw.schemaVersion=2;
                    if(fault==='kind')raw.kind='unknown-mode-kind';
                    if(fault==='value')raw.modeChanged=true;
                    if(fault==='hash')raw.sha256='f'.repeat(64);
                    if(fault==='source')raw.sourceSnapshotSha256='f'.repeat(64);
                }
                if(reference.path===predecessor&&fault==='predecessor')exists=false;
                if(reference.path===f.h.root+'/simulatedAdSources/'+f.adSourceId&&fault==='ad')raw.ownerUid='foreign-ad-owner';
                const economic={operation:'operations',ledger:'ledgerEntries',grant:'grantOperations'}[fault];
                if(economic&&reference.path===f.h.root+'/'+economic+'/'+sourceId){exists=true;raw={ownerUid:f.h.uid};}
                return {...snap,exists,data:()=>raw,get:key=>key.split('.').reduce((value,part)=>value?.[part],raw)};
            }},session))});
        await unchanged(f,()=>bad.captureProof(f.request(),input),error=>error.code==='data-loss');
    }
    f.h.abortNext();await unchanged(f,()=>f.recovery.captureProof(f.request(),input),/rollback/);
    const result=await Promise.all([f.recovery.captureProof(f.request(),input),f.recovery.captureProof(f.request(),input)]);
    assert.deepEqual(result.map(row=>row.unchanged).sort(),[false,true]);
    await unchanged(f,()=>f.recovery.captureProof(f.request(),{...input,component:'forest-ticket',sourceId:f.tickets[0]}),/receipt differs/);
    const path=f.root+'/proofPayloadChunks/'+input.operationId+'_00',original=copy(f.h.data.get(path));f.h.data.delete(path);
    await unchanged(f,()=>f.recovery.captureProof(f.request(),input),/shape/);assert.equal(f.h.data.has(path),false);f.h.data.set(path,original);
    const before=copy([...f.h.data]);assert.equal((await f.recovery.captureProof(f.request(),input)).unchanged,true);assert.deepEqual([...f.h.data],before);
});


const rawArgs=(sequence=1,startOrdinal=0,count=16)=>({auditId,expectedEpoch:1,operationId:'raw-capsule-'+String(sequence).padStart(8,'0'),expectedSequence:sequence,startOrdinal,count});
function inventoryOrder(f){return [...f.h.data].filter(([path])=>path.startsWith(f.root+'/inventoryPages/')).map(([,row])=>decodeInventoryPayload(row.payloadBytes))
    .sort((a,b)=>a.sequence-b.sequence).flatMap(page=>page.entries.map(entry=>({path:page.namespacePath+'/'+entry.id,...entry})));}
function stableRawReceipt(row){const {createdAt,...manifest}=row;return snapshotDigest(manifest);}

function privateRawInspector(f){
    const filename=require.resolve('../functions/src/canonical-current-recovery'),compiled=new Module(filename);
    compiled.filename=filename;compiled.paths=Module._nodeModulePaths(dirname(filename));
    const original=readFileSync(filename,'utf8'),needle='return Object.freeze({restoreCurrent,verifyRecoveryAuditArtifact';
    assert.equal(original.split(needle).length,2);
    // Test-only lexical access to the private pure kernel. Production exports,
    // factory methods and SDK entry points remain unchanged.
    compiled._compile(original.replace(needle,'return Object.freeze({inspectCompleteRawCapture,restoreCurrent,verifyRecoveryAuditArtifact'),filename);
    assert.equal(Object.hasOwn(f.recovery,'inspectCompleteRawCapture'),false);
    return compiled.exports.createCanonicalCurrentRecovery(f.deps).inspectCompleteRawCapture;
}
async function completeRawMaterial(f){
    const total=inventoryOrder(f).length;let ordinal=0,sequence=1;
    while(ordinal<total){
        const result=await f.recovery.captureRawInventory(f.request(),rawArgs(sequence++,ordinal,Math.min(16,total-ordinal)));
        ordinal=result.nextOrdinal;
    }
    const rows=name=>[...f.h.data].filter(([path])=>path.startsWith(f.root+'/'+name+'/'))
        .map(([path,row])=>({id:path.split('/').at(-1),row:copy(row)}));
    const inventoryState=copy(f.h.data.get(f.root+'/captureState/current'));
    return {binding:{ownerUid:f.h.uid,auditId,epoch:1,sourceRevision:f.h.revision,inventoryStateSha256:inventoryState.stateSha256},
        run:copy(f.h.data.get(f.root)),inventoryState,inventoryPages:rows('inventoryPages'),
        rawState:copy(f.h.data.get(f.root+'/proofState/current')),rawReceipts:rows('patrolProofPages'),rawChunks:rows('proofPayloadChunks')};
}
function resealRawState(state){const {stateSha256,createdAt,updatedAt,...value}=state;state.stateSha256=snapshotDigest(value);}
function replaceLastRawPayload(material,mutate){
    const receipt=material.rawReceipts.find(entry=>entry.id===material.rawState.lastOperationId).row;
    const rows=material.rawChunks.filter(entry=>entry.row.operationId===receipt.operationId).sort((a,b)=>a.row.chunkIndex-b.row.chunkIndex);
    const payload=copy(decodeProofPayload(Buffer.concat(rows.map(entry=>entry.row.payloadBytes))));mutate(payload);
    const bytes=encodeProofPayload(payload),chunks=[];
    for(let offset=0;offset<bytes.length;offset+=PATROL_PROOF_LIMITS.chunkBytes)chunks.push(bytes.subarray(offset,offset+PATROL_PROOF_LIMITS.chunkBytes));
    const hash=bytes=>require('node:crypto').createHash('sha256').update(bytes).digest('hex');
    material.rawChunks=material.rawChunks.filter(entry=>entry.row.operationId!==receipt.operationId);
    chunks.forEach((payloadBytes,chunkIndex)=>material.rawChunks.push({id:receipt.operationId+'_'+String(chunkIndex).padStart(2,'0'),
        row:{...rows[0].row,chunkIndex,payloadBytes,sha256:hash(payloadBytes)}}));
    receipt.payloadByteLength=bytes.length;receipt.payloadSha256=hash(bytes);receipt.chunkSha256s=chunks.map(hash);
    material.rawState.lastPayloadSha256=receipt.payloadSha256;material.rawState.lastReceiptSha256=stableRawReceipt(receipt);resealRawState(material.rawState);
}

test('private full raw chain closes actual twenty-battle Lv10 slot2 active and current-loss bytes without semantic authority or SDK access',async()=>{
    for(const currentLoss of [false,true]){
        const f=await fixture({three:false,adStatus:'abandoned',currentLoss}),material=await completeRawMaterial(f),inspect=privateRawInspector(f);
        const before=copy([...f.h.data]),writes=f.h.writes,traces=f.traces.length,input=copy(material);
        const result=inspect(material),order=inventoryOrder(f);
        assert.deepEqual(result.documents.map(row=>row.path),order.map(row=>row.path));
        for(const row of result.documents){
            assert.deepEqual(row.updateTime,order.find(entry=>entry.path===row.path).updateTime);
            assert.deepEqual(encodeProofPayload(row.data),encodeProofPayload(f.h.data.get(row.path)));
        }
        for(const flag of ['authoritativeStateReady','candidateProofValid','trustedCaptureVerified','restoreAuthorized'])assert.equal(result[flag],false);
        assert(Object.isFrozen(result));assert(Object.isFrozen(result.documents));assert(Object.isFrozen(result.documents[0].data));
        assert.equal(result.namespaces.length,31);assert(result.namespaces.every(row=>row.terminalEmpty&&Object.isFrozen(row.ids)));
        assert.equal(result.documents.some(row=>row.path===f.h.root+'/account/current'),!currentLoss);
        assert.deepEqual(inspect({...material,inventoryPages:material.inventoryPages.slice().reverse(),
            rawReceipts:material.rawReceipts.slice().reverse(),rawChunks:material.rawChunks.slice().reverse()}),result,
            'collection enumeration order is not a receipt sequence or chunk-order proof');
        assert.deepEqual(material,input);assert.deepEqual([...f.h.data],before);assert.equal(f.h.writes,writes);assert.equal(f.traces.length,traces);
    }
});

test('private full raw chain rejects every missing, orphan, duplicate, binding, range and self-consistent byte/version substitution without writes',async()=>{
    const f=await fixture({battles:1,three:false,beforeAudit:h=>h.data.set(h.root+'/recoveryAudits/unknown-retained-raw',
        {kind:'not-a-supported-right',ownerUid:h.uid})}),base=await completeRawMaterial(f),inspect=privateRawInspector(f);
    assert(inspect(base).documents.some(row=>row.path.endsWith('/unknown-retained-raw')),
        'structural capture deliberately preserves unknown raw records; no semantic candidate success is claimed');
    const mutations=[
        m=>{m.binding.ownerUid='foreign-uid';},m=>{m.binding.auditId='foreign-audit-operation';},
        m=>{m.binding.epoch++;},m=>{m.binding.sourceRevision++;},m=>{m.binding.inventoryStateSha256='f'.repeat(64);},
        m=>{m.inventoryPages.pop();},m=>{m.inventoryPages.push(copy(m.inventoryPages[0]));},
        m=>{m.inventoryPages[0].id='wrong-inventory-page-id';},
        m=>{m.inventoryPages[0].row.payloadBytes[0]^=1;},
        m=>{m.rawState.schemaVersion=2;},m=>{m.rawState.rawNextOffset--;resealRawState(m.rawState);},
        m=>{m.rawState.nextSequence++;resealRawState(m.rawState);},
        m=>{m.rawState.lastReceiptSha256='f'.repeat(64);resealRawState(m.rawState);},
        m=>{m.rawState.lastOperationId='wrong-last-operation-0001';resealRawState(m.rawState);},
        m=>{m.rawState.lastPayloadSha256='f'.repeat(64);resealRawState(m.rawState);},
        m=>{m.rawState.lastStartOrdinal--;resealRawState(m.rawState);},
        m=>{m.rawState.lastCount=1;resealRawState(m.rawState);},
        m=>{m.rawReceipts.shift();},m=>{m.rawReceipts.push(copy(m.rawReceipts[0]));},
        m=>{m.rawReceipts[0].id='wrong-raw-receipt-id';},
        m=>{m.rawReceipts[1].row.sequence=1;},m=>{m.rawReceipts[1].row.previousReceiptSha256='f'.repeat(64);},
        m=>{m.rawReceipts[1].row.startOrdinal--;},m=>{m.rawReceipts[0].row.epoch++;},
        m=>{m.rawReceipts[0].row.inventoryStateSha256='f'.repeat(64);},
        m=>{m.rawChunks.shift();},m=>{m.rawChunks.push(copy(m.rawChunks[0]));},
        m=>{m.rawChunks[0].id+='extra';},
        m=>{const extra=copy(m.rawChunks[0]);extra.id='orphan-chunk-operation-01_00';m.rawChunks.push(extra);},
        m=>{m.rawChunks[0].row.ownerUid='foreign';},m=>{m.rawChunks[0].row.epoch++;},
        m=>{m.rawChunks[0].row.operationId='foreign-chunk-operation-01';},
        m=>{m.rawChunks[0].row.sequence++;},m=>{m.rawChunks[0].row.chunkIndex++;},
        m=>{m.rawChunks[0].row.payloadBytes[0]^=1;},
        m=>replaceLastRawPayload(m,p=>{p.documents[0].updateTime.nanoseconds++;}),
        m=>replaceLastRawPayload(m,p=>{p.documents[0].data.forensicByteChange=true;}),
        m=>replaceLastRawPayload(m,p=>{p.documents[0].path=p.documents.at(-1).path;}),
        m=>replaceLastRawPayload(m,p=>{p.documents[0].exists=false;}),
        m=>replaceLastRawPayload(m,p=>{p.documents.pop();})
    ];
    const before=copy([...f.h.data]),writes=f.h.writes,traces=f.traces.length;
    for(const mutate of mutations){const damaged=copy(base);mutate(damaged);assert.throws(()=>inspect(damaged));
        assert.deepEqual([...f.h.data],before);assert.equal(f.h.writes,writes);assert.equal(f.traces.length,traces);}
    // A current head and exhausted cursor cannot certify an older missing
    // payload, even though the normal last-op retry remains locally valid.
    const damaged=copy(base);damaged.rawChunks=damaged.rawChunks.filter(entry=>entry.row.operationId!==base.rawReceipts[0].id);
    assert.throws(()=>inspect(damaged));assert.deepEqual(inspect(base),inspect(copy(base)));
});

test('schema3 raw uses the same lifecycle and captures every fixed-order present byte, including active and unsupported raw data, without proof authority',async()=>{
    const f=await fixture({battles:1,three:false,beforeAudit:h=>{
        h.data.get(h.root+'/account/current').forensicUnknown={enabled:true,opaque:['leave',7]};
        h.data.set(h.root+'/recoveryAudits/Ω-unknown',{schemaVersion:987,kind:'unsupported-by-proof',ownerUid:h.uid,opaque:{z:1,a:'原始資料'}});
    }}),order=inventoryOrder(f),original=copy([...f.h.data]),seen=[],pageCount=[...f.h.data.keys()].filter(path=>path.startsWith(f.root+'/inventoryPages/')).length;
    let ordinal=0,sequence=1,previous=null;
    while(ordinal<order.length){
        const input=rawArgs(sequence,ordinal,Math.min(16,order.length-ordinal));
        const result=await f.recovery.captureRawInventory(f.request(),input),trace=f.traces.at(-1),saved=capsule(f,input);
        assert.equal(saved.receipt.schemaVersion,3);assert.equal(saved.payload.schemaVersion,3);
        assert.equal(saved.receipt.previousReceiptSha256,previous);assert.equal(saved.payload.previousReceiptSha256,previous);
        assert.equal(result.receiptSha256,stableRawReceipt(saved.receipt));
        assert.equal(trace.reads,pageCount+(sequence===1?14:13)+input.count);assert(trace.reads<=400);assert(trace.writes<=10);assert.equal(trace.queries,sequence===1?3:1);
        assert.deepEqual(saved.payload.documents.map(row=>row.path),order.slice(ordinal,ordinal+input.count).map(row=>row.path));
        for(const row of saved.payload.documents){
            assert.equal(row.exists,true);assert.deepEqual(encodeProofPayload(row.data),encodeProofPayload(f.h.data.get(row.path)));
            assert.deepEqual(row.updateTime,order.find(entry=>entry.path===row.path).updateTime);seen.push(row.path);
        }
        assert.equal(result.proofKernelExecuted,false);for(const flag of ['authoritativeStateReady','candidateProofValid','trustedCaptureVerified','restoreAuthorized'])assert.equal(result[flag],false);
        assert.equal(result.rawCursorExhausted,ordinal+input.count===order.length);assert.equal(Object.hasOwn(result,'rawComplete'),false);
        const before=copy([...f.h.data]);assert.equal((await f.recovery.captureRawInventory(f.request(),input)).unchanged,true);assert.deepEqual([...f.h.data],before);
        assert(f.traces.at(-1).reads<=pageCount+13+saved.receipt.chunkSha256s.length);
        const gateOnly=f.traces.at(-1).paths.filter(path=>!path?.startsWith(f.root+'/')&&path!==f.h.root+'/sessionAuthority/current'&&!path?.includes('/gameSessions/'));
        assert(!gateOnly.some(path=>path===f.h.root+'/account/current'),'raw retry cannot replace captured live source bytes');
        previous=result.receiptSha256;ordinal=result.nextOrdinal;sequence++;
    }
    assert.deepEqual(seen,order.map(entry=>entry.path));assert(seen.includes(f.h.root+'/recoveryAudits/Ω-unknown'));
    for(const [path,row] of original)assert.deepEqual(f.h.data.get(path),row);
    const state=f.h.data.get(f.root+'/proofState/current');assert.equal(state.schemaVersion,3);assert.equal(state.rawNextOffset,order.length);
    assert.equal(state.lastReceiptSha256,previous);
    await unchanged(f,()=>f.recovery.captureProof(f.request(),f.intent(sequence)),/new audit/);
});


test('raw mode selection, immutable committed range, strict sequence and head CAS reject skips, overlap and metadata loss',async()=>{
    const proof=await fixture({battles:1,three:false});await proof.recovery.captureProof(proof.request(),proof.intent());
    await unchanged(proof,()=>proof.recovery.captureRawInventory(proof.request(),rawArgs(2)),/new audit/);
    const f=await fixture({battles:1,three:false}),total=inventoryOrder(f).length;
    for(const input of [rawArgs(2,0,1),rawArgs(1,1,1),rawArgs(1,0,17),rawArgs(1,0,0),rawArgs(1,total,1),rawArgs(1,-1,1)])
        await unchanged(f,()=>f.recovery.captureRawInventory(f.request(),input));
    const first=rawArgs(1,0,2);f.h.abortNext();await unchanged(f,()=>f.recovery.captureRawInventory(f.request(),first),/rollback/);
    const race=await Promise.all([f.recovery.captureRawInventory(f.request(),first),f.recovery.captureRawInventory(f.request(),first)]);
    assert.deepEqual(race.map(row=>row.unchanged).sort(),[false,true]);
    for(const input of [{...first,count:1},{...first,startOrdinal:1}])await unchanged(f,()=>f.recovery.captureRawInventory(f.request(),input),/intent or progress/);
    for(const input of [rawArgs(2,0,1),rawArgs(2,3,1),rawArgs(3,2,1),rawArgs(2,total,1)])await unchanged(f,()=>f.recovery.captureRawInventory(f.request(),input));
    const statePath=f.root+'/proofState/current',pagePath=f.root+'/patrolProofPages/'+first.operationId,state=copy(f.h.data.get(statePath)),page=copy(f.h.data.get(pagePath));
    for(const removePage of [false,true]){
        f.h.data.delete(statePath);if(removePage)f.h.data.delete(pagePath);
        await unchanged(f,()=>f.recovery.captureRawInventory(f.request(),{...first,operationId:'raw-orphan-'+(removePage?'both':'state')+'-operation1'}),/orphan/);
        f.h.data.set(statePath,copy(state));if(removePage)f.h.data.set(pagePath,copy(page));
    }
    f.h.data.delete(pagePath);await unchanged(f,()=>f.recovery.captureRawInventory(f.request(),rawArgs(2,2,1)),/shape/);f.h.data.set(pagePath,copy(page));
    for(const field of ['rawNextOffset','lastStartOrdinal','lastCount','lastReceiptSha256']){
        const changed={...state,[field]:field==='lastReceiptSha256'?'f'.repeat(64):state[field]+1};
        const {stateSha256,createdAt,updatedAt,...body}=changed;changed.stateSha256=snapshotDigest(body);f.h.data.set(statePath,changed);
        await unchanged(f,()=>f.recovery.captureRawInventory(f.request(),rawArgs(2,2,1)),/state/);f.h.data.set(statePath,copy(state));
    }
    const second=rawArgs(2,2,1);await f.recovery.captureRawInventory(f.request(),second);
    const secondPath=f.root+'/patrolProofPages/'+second.operationId,secondPage=copy(f.h.data.get(secondPath));
    f.h.data.set(secondPath,{...secondPage,previousReceiptSha256:'e'.repeat(64)});
    await unchanged(f,()=>f.recovery.captureRawInventory(f.request(),rawArgs(3,3,1)),/head/);f.h.data.set(secondPath,secondPage);
    const before=copy([...f.h.data]);assert.equal((await f.recovery.captureRawInventory(f.request(),first)).unchanged,true);assert.deepEqual([...f.h.data],before);
});

test('raw chunk replay validates complete bytes and self-consistent payload metadata without reading live replacement sources',async()=>{
    const f=await fixture({battles:1,three:false}),input=rawArgs(1,0,2);await f.recovery.captureRawInventory(f.request(),input);
    const saved=capsule(f,input),pagePath=f.root+'/patrolProofPages/'+input.operationId,chunkPath=f.root+'/proofPayloadChunks/'+input.operationId+'_00',statePath=f.root+'/proofState/current';
    const page=copy(f.h.data.get(pagePath)),chunk=copy(f.h.data.get(chunkPath)),state=copy(f.h.data.get(statePath));
    const hash=value=>require('node:crypto').createHash('sha256').update(value).digest('hex');
    for(const fault of ['missing','bytes','binding']){
        if(fault==='missing')f.h.data.delete(chunkPath);
        if(fault==='bytes')f.h.data.set(chunkPath,{...chunk,payloadBytes:Buffer.from('corrupt')});
        if(fault==='binding')f.h.data.set(chunkPath,{...chunk,count:1});
        await unchanged(f,()=>f.recovery.captureRawInventory(f.request(),input));
        if(fault==='missing')assert.equal(f.h.data.has(chunkPath),false);f.h.data.set(chunkPath,copy(chunk));
    }
    for(const fault of ['order','absence','version','data','range']){
        const payload=copy(saved.payload);
        if(fault==='order')payload.documents.reverse();
        if(fault==='absence')payload.documents[0].exists=false;
        if(fault==='version')payload.documents[0].updateTime.nanoseconds++;
        if(fault==='data')payload.documents[0].data.forensicChange=true;
        if(fault==='range')payload.startOrdinal++;
        const bytes=encodeProofPayload(payload);assert(bytes.length<=256*1024);
        const newPage={...page,payloadSha256:hash(bytes),payloadByteLength:bytes.length,chunkSha256s:[hash(bytes)]};
        const newState={...state,lastPayloadSha256:newPage.payloadSha256,lastReceiptSha256:stableRawReceipt(newPage)};
        const {stateSha256,createdAt,updatedAt,...body}=newState;newState.stateSha256=snapshotDigest(body);
        f.h.data.set(pagePath,newPage);f.h.data.set(statePath,newState);f.h.data.set(chunkPath,{...chunk,payloadBytes:bytes,sha256:hash(bytes)});
        await unchanged(f,()=>f.recovery.captureRawInventory(f.request(),input));
        f.h.data.set(pagePath,copy(page));f.h.data.set(statePath,copy(state));f.h.data.set(chunkPath,copy(chunk));
    }
    const sourcePath=saved.payload.documents[0].path;f.h.data.set(sourcePath,{...f.h.data.get(sourcePath),laterRawValue:true});
    const before=copy([...f.h.data]);assert.equal((await f.recovery.captureRawInventory(f.request(),input)).unchanged,true);assert.deepEqual([...f.h.data],before);
    assert.deepEqual(capsule(f,input).bytes,saved.bytes,'receipt replay never replaces old raw bytes with a changed source');
    const nextPath=inventoryOrder(f)[2].path;f.h.data.set(nextPath,copy(f.h.data.get(nextPath)));
    await unchanged(f,()=>f.recovery.captureRawInventory(f.request(),rawArgs(2,2,1)),/version or bytes changed/);
});


async function advanceRawPrefix(f,target){let ordinal=0,sequence=1;
    while(ordinal<target){const result=await f.recovery.captureRawInventory(f.request(),rawArgs(sequence,ordinal,Math.min(16,target-ordinal)));ordinal=result.nextOrdinal;sequence++;}
    return {ordinal,sequence};
}
test('raw page oversize rejects before source reads, while a smaller new operation commits without changing game capacity',async()=>{
    const f=await fixture({battles:1,three:false,beforeAudit:h=>{
        for(let index=0;index<5;index++)h.data.set(h.root+'/recoveryAudits/pressure-'+index,{opaque:'x'.repeat(500000)});
    }}),order=inventoryOrder(f),offset=order.findIndex(row=>row.path.endsWith('/pressure-0')),{sequence}=await advanceRawPrefix(f,offset);
    const input={...rawArgs(sequence,offset,5),operationId:'raw-pressure-oversize-op001'};
    const start=f.traces.length;await unchanged(f,()=>f.recovery.captureRawInventory(f.request(),input),error=>error.code==='resource-exhausted');
    assert(!f.traces.slice(start).some(trace=>trace.paths.some(path=>path?.includes('/pressure-'))),'metadata total bounds temporary data before issuing pressure source reads');
    assert.equal(f.h.data.has(f.root+'/patrolProofPages/'+input.operationId),false);
    // Zero-write failures have no durable operation-ID memory. Using a NEW ID
    // to shrink count is an operational convention, not a reservation feature.
    const smaller={...input,operationId:'raw-pressure-smaller-op001',count:4},result=await f.recovery.captureRawInventory(f.request(),smaller);
    assert.equal(result.count,4);assert.equal(result.chunkCount,8);assert.equal(f.traces.at(-1).writes,10);assert(result.payloadByteLength<=2*1024*1024);
});

test('single raw document may fit metadata framing yet exceed the encoded page, which stays zero-write pending Storage fallback',async()=>{
    const data={many:Array(Math.floor((2*1024*1024-33)/18)).fill(false)};
    assert(Buffer.byteLength(JSON.stringify(data))<1024*1024,'structural pressure data is below1MiB as JSON, not a claim about SDK wire size');
    assert(encodeProofPayload(data).length<=2*1024*1024);
    const f=await fixture({battles:1,three:false,beforeAudit:h=>h.data.set(h.root+'/recoveryAudits/single-pressure',data)}),
        offset=inventoryOrder(f).findIndex(row=>row.path.endsWith('/single-pressure')),{sequence}=await advanceRawPrefix(f,offset),
        input={...rawArgs(sequence,offset,1),operationId:'raw-single-pressure-op001'};
    const start=f.traces.length;await unchanged(f,()=>f.recovery.captureRawInventory(f.request(),input),error=>error.code==='resource-exhausted');
    assert(f.traces.slice(start).some(trace=>trace.paths.includes(f.h.root+'/recoveryAudits/single-pressure')),'the final encoded limit is checked after the one bounded raw read');
    assert.equal(f.h.data.has(f.root+'/patrolProofPages/'+input.operationId),false);
    assert(![...f.h.data.keys()].some(path=>path.startsWith(f.root+'/proofPayloadChunks/'+input.operationId)));
});


test('raw SDK attempts reread sources and all live gates; expiry, takeover and cancel never mint or refresh a permit',async()=>{
    const f=await fixture({battles:1,three:false}),input=rawArgs(1,0,1),source=inventoryOrder(f)[0].path;let callbacks=0;
    const retrying=createCanonicalCurrentRecovery({...f.deps,runRecoveryAuditMaintenance:(req,id,operation)=>f.deps.runRecoveryAuditMaintenance(req,id,async(tx,session)=>{
        callbacks++;const result=await operation(tx,session);if(callbacks===1)throw Object.assign(Error('raw SDK retry'),{code:10});return result;})});
    const start=f.traces.length;await retrying.captureRawInventory(f.request(),input);assert.equal(callbacks,2);
    assert(f.traces.slice(start).every(trace=>trace.paths.includes(source)),'source readsets are rebuilt for every SDK attempt');
    const old=f.request();await f.takeover();await unchanged(f,()=>f.recovery.captureRawInventory(old,input),/SESSION_REVOKED/);
    await unchanged(f,()=>f.recovery.captureRawInventory(f.request(),input));
    await f.recovery.cancelAudit(f.request(),{auditId,expectedEpoch:1,operationId:'raw-cancel-operation-001'});
    await unchanged(f,()=>f.recovery.captureRawInventory(f.request(),input));
    const expired=await fixture({battles:1,three:false});let attempts=0;
    const expires=createCanonicalCurrentRecovery({...expired.deps,runRecoveryAuditMaintenance:(req,id,operation)=>expired.deps.runRecoveryAuditMaintenance(req,id,async(tx,session)=>{
        attempts++;const result=await operation(tx,session);if(attempts===1){expired.h.advance(61000);throw Object.assign(Error('raw approval expires before retry'),{code:10});}return result;})});
    await unchanged(expired,()=>expires.captureRawInventory(expired.request(),input),/approval/);assert.equal(attempts,2);
    const changed=await fixture({battles:1,three:false}),path=inventoryOrder(changed)[0].path;let tries=0;
    const changes=createCanonicalCurrentRecovery({...changed.deps,runRecoveryAuditMaintenance:(req,id,operation)=>changed.deps.runRecoveryAuditMaintenance(req,id,async(tx,session)=>{
        tries++;const result=await operation(tx,session);if(tries===1){changed.h.data.set(path,copy(changed.h.data.get(path)));throw Object.assign(Error('raw source version changes before retry'),{code:10});}return result;})});
    await unchanged(changed,()=>changes.captureRawInventory(changed.request(),input),/version or bytes changed/);assert.equal(tries,2);
});

test('rawCursorExhausted reports progress only and never certifies that older chunks or the full chain remain complete',async()=>{
    const f=await fixture({battles:1,three:false}),total=inventoryOrder(f).length;let ordinal=0,sequence=1,last;
    while(ordinal<total){last=rawArgs(sequence,ordinal,Math.min(16,total-ordinal));const result=await f.recovery.captureRawInventory(f.request(),last);ordinal=result.nextOrdinal;sequence++;}
    const firstChunk=f.root+'/proofPayloadChunks/'+rawArgs().operationId+'_00';assert(last.operationId!==rawArgs().operationId);f.h.data.delete(firstChunk);
    const result=await f.recovery.captureRawInventory(f.request(),last);assert.equal(result.rawCursorExhausted,true);assert.equal(result.proofKernelExecuted,false);
    for(const flag of ['authoritativeStateReady','candidateProofValid','trustedCaptureVerified','restoreAuthorized'])assert.equal(result[flag],false);
    assert.equal(f.h.data.has(firstChunk),false,'only a future full-chain assembler can certify every historical chunk');
});


test('raw capture requires exact SDK source versions and typed bytes, never a millisecond fallback or invented absence',async()=>{
    const f=await fixture({battles:1,three:false}),source=inventoryOrder(f)[0].path,input=rawArgs(1,0,1);
    for(const fault of ['missing-version','milliseconds-only','changed-bytes','missing-source']){
        const bad=createCanonicalCurrentRecovery({...f.deps,runRecoveryAuditMaintenance:(req,id,operation)=>f.deps.runRecoveryAuditMaintenance(req,id,(tx,session)=>
            operation({...tx,get:async reference=>{const snap=await tx.get(reference);if(reference.path!==source)return snap;
                if(fault==='missing-version')return {...snap,updateTime:undefined};
                if(fault==='milliseconds-only')return {...snap,updateTime:{toMillis:()=>f.h.clock}};
                if(fault==='missing-source')return {...snap,exists:false,data:()=>undefined};
                return {...snap,data:()=>({...snap.data(),forensicChange:true})};
            }},session))});
        await unchanged(f,()=>bad.captureRawInventory(f.request(),input),error=>error.code==='data-loss');
    }
});
