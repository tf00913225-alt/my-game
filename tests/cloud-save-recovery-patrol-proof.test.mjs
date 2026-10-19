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
const {decodePatrolProofPayload,encodePatrolProofPayload,decodeInventoryPayload,encodeInventoryPayload,PATROL_PROOF_LIMITS}=require('../functions/src/recovery-audit-artifact');
const {createRecoveryArchive}=require('../functions/src/canonical-recovery-archive');
const {assembleCanonicalSnapshot}=require('../functions/src/canonical-snapshot');
const {snapshotDigest}=require('../functions/src/canonical-snapshot');
const auditId='proof-component-audit-0001',approvalId='proof-component-approval-01';
async function fixture({battles=20,three=true,largeBytes=0,rested=false}={}){
    const h=storeHarness({optimisticTransactions:true}),sessions=createSessionAuthority(h.dependencies),authTime=Math.floor(h.clock/1000);let session;
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
    await forest.observePresence(request(),{operationId:id('reopen'),expectedRevision:h.revision,expectedSequence:0,intent:'reopen',elementBox:'keep'});
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
    if(battles>=20){
        const allocator=createCanonicalExpAllocation(deps);for(let level=1;level<10;level++)await allocator.allocateSharedExp(request(),{operationId:id('allocate'),expectedRevision:h.revision});
        await createCanonicalSourceWriter(deps).commitAdditionalCharacter(request(),{operationId:id('additional'),expectedRevision:h.revision,slotIndex:1,
            selection:{...selection,displayName:'Second',attributes:{attack:3,vitality:0,energy:0,intelligence:0,defensePoints:0,agility:0}}});
        assert.equal(h.data.get(h.root+'/recoveryArchives/'+h.revision).sourceRecords.characters[0].state.level,10);
        for(const path of [...h.data.keys()])if(['account','characters','economy','inventory','equipment','relics','relicLoadout','progress','claimRecords','claimCheckpoints']
            .some(name=>path.startsWith(h.root+'/'+name+'/')))h.data.delete(path);
    }
    await createCanonicalRecoveryApproval(deps).issue({auth:{uid:'proof-operator',token:{cloudSaveOperator:true}},data:{ownerUid:h.uid,operationId:approvalId,sourceRevision:h.revision,ttlSeconds:60}});
    const recovery=createCanonicalCurrentRecovery(deps);await recovery.beginAudit(request(),{operationId:auditId,expectedRevision:h.revision,approvalOperationId:approvalId});
    await recovery.prepareInventory(request(),{auditId,expectedEpoch:1,operationId:'proof-prepare-operation-01'});
    let result,sequence=0;do{result=await recovery.captureInventoryPage(request(),{auditId,expectedEpoch:1,operationId:`proof-inventory-${String(++sequence).padStart(8,'0')}`,expectedSequence:sequence});}while(!result.inventoryExhausted);
    const root=h.root+'/recoveryAuditRuns/'+auditId,traces=[],base=h.dependencies.db.runTransaction;
    h.dependencies.db.runTransaction=callback=>base(async tx=>{const trace={reads:0,queries:0,writes:0,paths:[]};traces.push(trace);
        const wrapper={get:async ref=>{trace.paths.push(ref.path);const snap=await tx.get(ref);trace.reads+=snap.docs?Math.max(1,snap.size):1;trace.queries+=snap.docs?1:0;return snap;}};
        for(const method of ['set','create','update','delete'])wrapper[method]=(...args)=>{trace.writes++;return tx[method](...args);};return callback(wrapper);});
    return {h,recovery,request,tickets,root,traces,deps,sessions,intent:(sequence=1,ticketId=tickets[0])=>({auditId,expectedEpoch:1,operationId:`proof-capsule-${String(sequence).padStart(8,'0')}`,expectedSequence:sequence,ticketId})};
}
const unchanged=async(f,operation,pattern)=>{const before=copy([...f.h.data]),writes=f.h.writes;await assert.rejects(operation,pattern);assert.deepEqual([...f.h.data],before);assert.equal(f.h.writes,writes);};
function capsule(f,input){const receipt=f.h.data.get(f.root+'/patrolProofPages/'+input.operationId);
    const chunks=receipt.chunkSha256s.map((_,index)=>f.h.data.get(f.root+'/proofPayloadChunks/'+input.operationId+'_'+String(index).padStart(2,'0')).payloadBytes);
    return {receipt,bytes:Buffer.concat(chunks),payload:decodePatrolProofPayload(Buffer.concat(chunks))};}
test('true twenty Forest battles, Lv10 and slot2 current loss capture original bounded Forest components and replay complete old bytes',async()=>{
    const f=await fixture();assert.equal(f.tickets.length,21);let maximum=0;
    for(let index=0;index<f.tickets.length;index++){
        const input=f.intent(index+1,f.tickets[index]),result=await f.recovery.capturePatrolProof(f.request(),input),trace=f.traces.at(-1);
        assert(trace.reads<=400);assert(trace.writes<=10);assert.equal(trace.queries,index===0?3:1);
        for(const flag of ['authoritativeStateReady','candidateProofValid','trustedCaptureVerified','restoreAuthorized'])assert.equal(result[flag],false);
        const saved=capsule(f,input);assert.equal(saved.bytes.length,result.payloadByteLength);assert(saved.bytes.length<=2*1024*1024);maximum=Math.max(maximum,saved.bytes.length);
        assert.deepEqual(encodePatrolProofPayload(saved.payload),saved.bytes);
        assert(saved.payload.documents.some(row=>!row.exists),'explicit absence is retained');
        const original=copy([...f.h.data]);assert.deepEqual(await f.recovery.capturePatrolProof(f.request(),input),{...result,unchanged:true});
        assert.equal(f.traces.at(-1).writes,0);assert.deepEqual([...f.h.data],original);
    }
    assert(maximum>100000);assert.equal(f.h.data.get(f.root+'/proofState/current').nextSequence,22);
    assert.equal((await f.recovery.capturePatrolProof(f.request(),f.intent())).unchanged,true,'historical original receipt remains replayable');
});
test('Forest proof rollback, CAS race, strict intent, immutable chunk and inventory chain corruption reject without mutation',async()=>{
    const f=await fixture({battles:1,three:false}),input=f.intent();f.h.abortNext();await unchanged(f,()=>f.recovery.capturePatrolProof(f.request(),input),/rollback/);
    const results=await Promise.all([f.recovery.capturePatrolProof(f.request(),input),f.recovery.capturePatrolProof(f.request(),input)]);
    assert.deepEqual(results.map(row=>row.unchanged).sort(),[false,true]);
    await unchanged(f,()=>f.recovery.capturePatrolProof(f.request(),{...input,ticketId:'proof-nonexistent-ticket-01'}),/receipt differs/);
    const ticketPath=f.h.root+'/patrolTickets/'+input.ticketId;f.h.data.set(ticketPath,copy(f.h.data.get(ticketPath)));
    assert.equal((await f.recovery.capturePatrolProof(f.request(),input)).unchanged,true);
    assert(!f.traces.at(-1).paths.some(path=>/\/(patrolTickets|patrolTicketStates|patrolSettlements|patrolClosures)\//.test(path)),
        'old receipt replay uses the original capsule, not live Forest sources');
    const chunkPath=f.root+'/proofPayloadChunks/'+input.operationId+'_00',chunk=copy(f.h.data.get(chunkPath));f.h.data.delete(chunkPath);
    await unchanged(f,()=>f.recovery.capturePatrolProof(f.request(),input),/shape/);f.h.data.set(chunkPath,chunk);
    f.h.data.set(chunkPath,{...chunk,payloadBytes:Buffer.from('corrupt')});await unchanged(f,()=>f.recovery.capturePatrolProof(f.request(),input),/chunk differs/);f.h.data.set(chunkPath,chunk);
    const pagePath=[...f.h.data.keys()].find(path=>path.startsWith(f.root+'/inventoryPages/')),page=copy(f.h.data.get(pagePath));
    f.h.data.set(pagePath,{...page,payloadSha256:'f'.repeat(64)});await unchanged(f,()=>f.recovery.capturePatrolProof(f.request(),input),/seal/);f.h.data.set(pagePath,page);
    f.h.data.set(f.root+'/inventoryPages/proof-orphan-page-0001',copy(page));await unchanged(f,()=>f.recovery.capturePatrolProof(f.request(),input),/page inventory differs/);
});
test('proof admission does not inherit decoder limits, requires exhausted inventory and live source versions',async()=>{
    const f=await fixture({battles:1,three:false}),path=f.root+'/captureState/current',original=copy(f.h.data.get(path));
    const rehash=row=>{const {stateSha256,createdAt,updatedAt,...rest}=row;return {...row,stateSha256:snapshotDigest(rest)};};
    f.h.data.set(path,rehash({...original,namespaceIndex:30,inventoryExhausted:false}));await unchanged(f,()=>f.recovery.capturePatrolProof(f.request(),f.intent()),/admission/);f.h.data.set(path,original);
    f.h.data.set(path,rehash({...original,capturedCount:4097}));await unchanged(f,()=>f.recovery.capturePatrolProof(f.request(),f.intent()),/admission/);f.h.data.set(path,original);
    const source=f.h.root+'/patrolTickets/'+f.tickets[0],ticket=copy(f.h.data.get(source));f.h.data.set(source,ticket);
    await unchanged(f,()=>f.recovery.capturePatrolProof(f.request(),f.intent()),/version or bytes changed/);
});
test('sole proof codec bounds resources and chunk identifiers retain the original 64-character operation ID',()=>{
    assert.throws(()=>encodePatrolProofPayload({validString:'x'.repeat(PATROL_PROOF_LIMITS.bytes)}),/size/);
    const operationId='a'.repeat(64),chunkId=operationId+'_07';assert.equal(chunkId.length,67);assert.match(chunkId,/^[A-Za-z0-9_-]{16,64}_0[0-7]$/);
    assert.throws(()=>decodePatrolProofPayload(Buffer.from('[]')),/typed/);
});

test('valid original Forest unit with large canonical structural inventory either commits bounded chunks or rejects over2MiB without partial writes',async t=>{
    const f=await fixture({battles:1,three:false,largeBytes:300000}),input=f.intent();
    const result=await f.recovery.capturePatrolProof(f.request(),input);assert.equal(result.chunkCount,8);t.diagnostic(JSON.stringify({structuralCanonicalItemNameBytes:300000,exactCapsuleBytes:result.payloadByteLength,chunks:result.chunkCount,actualReads:f.traces.at(-1).reads,actualWrites:f.traces.at(-1).writes}));
    assert(result.payloadByteLength>256*1024);assert(f.traces.at(-1).writes<=10);
    assert.equal((await f.recovery.capturePatrolProof(f.request(),input)).unchanged,true);
    const huge=await fixture({battles:1,three:false,largeBytes:450000});
    await unchanged(huge,()=>huge.recovery.capturePatrolProof(huge.request(),huge.intent()),/payload size/);
    assert.equal(huge.traces.at(-1).writes,0);
});


test('state head, inventory binding, live expiry and cancellation remain mandatory for new components and old replay',async()=>{
    const f=await fixture({battles:1,three:false}),input=f.intent();await f.recovery.capturePatrolProof(f.request(),input);
    const path=f.root+'/proofState/current',original=copy(f.h.data.get(path));
    const rehash=row=>{const {stateSha256,createdAt,updatedAt,...rest}=row;return {...row,stateSha256:snapshotDigest(rest)};};
    for(const changed of [{...original,nextSequence:99},{...original,lastOperationId:'proof-missing-head-operation'},
        {...original,inventoryStateSha256:'f'.repeat(64)}]){
        f.h.data.set(path,rehash(changed));await unchanged(f,()=>f.recovery.capturePatrolProof(f.request(),input),/state/);
    }f.h.data.set(path,original);
    f.h.advance(60000);await unchanged(f,()=>f.recovery.capturePatrolProof(f.request(),input),/operator approval/);f.h.advance(-60000);
    await f.recovery.cancelAudit(f.request(),{operationId:'proof-cancel-operation-001',auditId,expectedEpoch:1});
    await unchanged(f,()=>f.recovery.capturePatrolProof(f.request(),input),/epoch or session/);
});
test('bounded inventory query detects overflow before decoding arbitrary orphan pages',async()=>{
    const f=await fixture({battles:1,three:false}),pages=[...f.h.data.keys()].filter(path=>path.startsWith(f.root+'/inventoryPages/'));
    const template=copy(f.h.data.get(pages[0]));
    for(let number=pages.length;number<318;number++)f.h.data.set(f.root+'/inventoryPages/'+('overflow-page-'+String(number).padStart(8,'0')),template);
    await unchanged(f,()=>f.recovery.capturePatrolProof(f.request(),f.intent()),/page inventory differs/);
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
    await unchanged(f,()=>recovery.capturePatrolProof(f.request(),f.intent()),/kernel read budget/);
    assert.equal(issued,60);assert.equal(f.traces.at(-1).writes,0);assert(f.traces.at(-1).reads<=400);
});
test('fixed capsule writes have bounded document and Commit sizing; default index estimate is explicitly separate from unobserved production indexes',async t=>{
    const f=await fixture({battles:1,three:false,largeBytes:300000});await f.recovery.capturePatrolProof(f.request(),f.intent());
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
    await unchanged(f,()=>f.recovery.capturePatrolProof(f.request(),f.intent()),/timestamp/);assert.equal(f.traces.at(-1).writes,0);
});

for(const keepReceipt of [true,false])test('missing proof state cannot reset sequence1 over retained '+(keepReceipt?'receipt':'chunk-only')+' history',async()=>{
        const f=await fixture({battles:1,three:false}),first=f.intent();await f.recovery.capturePatrolProof(f.request(),first);
        f.h.data.delete(f.root+'/proofState/current');if(!keepReceipt)f.h.data.delete(f.root+'/patrolProofPages/'+first.operationId);
        await unchanged(f,()=>f.recovery.capturePatrolProof(f.request(),{...first,operationId:'proof-reopened-missing-state'}),/orphan|missing proof state/);
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
    const original=copy([...f.h.data]),result=await f.recovery.capturePatrolProof(f.request(),f.intent());
    const decoded=capsule(f,f.intent()).payload.documents.find(row=>row.path===f.h.root+'/modeTimeEvents/'+terminal.operationId);
    assert.notDeepEqual(Object.keys(decoded.data.beforeModes.rested),originalKeys,
        'the original sorted codec remains unchanged; original raw sidecars determine reconstruction');
    assert.equal((await f.recovery.capturePatrolProof(f.request(),f.intent())).unchanged,true);
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
