import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire,Module} from 'node:module';
import {readFileSync} from 'node:fs';
import {dirname} from 'node:path';
import {storeHarness,selection,copy} from '../scripts/test-helpers/canonical-store-harness.mjs';
const require=createRequire(import.meta.url);
const {createCanonicalCurrentRecovery}=require('../functions/src/canonical-current-recovery');
const {createCanonicalPatrolSettlement}=require('../functions/src/canonical-patrol-settlement');
const {createCanonicalExpAllocation}=require('../functions/src/canonical-exp-allocation');
const {createCanonicalRecoveryApproval}=require('../functions/src/canonical-recovery-approval');
const {decodeRecoveryAuditArtifact,drainAndCloseRecoveryAuditLookups}=require('../functions/src/recovery-audit-artifact');
const {snapshotDigest}=require('../functions/src/canonical-snapshot');
const {createCanonicalAccountModeTime}=require('../functions/src/canonical-account-mode-time');
const functionsRequire=createRequire(new URL('../functions/package.json',import.meta.url));
let timestampModule;
try{timestampModule=functionsRequire.resolve('firebase-admin/firestore');}
catch(error){if(error.code!=='MODULE_NOT_FOUND')throw error;}
const NodeTimestamp=timestampModule?functionsRequire(timestampModule).Timestamp:null;
if(timestampModule)assert.equal(typeof NodeTimestamp,'function','installed Admin SDK must expose Timestamp');
const namespaces=['account','characters','economy','inventory','equipment','relics','relicLoadout','progress',
    'claimCheckpoints','claimRecords','playableSnapshots','recoveryArchives','uniqueClaims','grantOperations',
    'ledgerEntries','pendingGrants','rewardEvents','operations','simulatedAdSources','modeTimeEvents','modeTime',
    'patrol','patrolTickets','patrolTicketStates','patrolSettlements','patrolClosures','recoveryApprovals','recoveryAudits'];
const compare=(a,b)=>Buffer.compare(Buffer.from(a),Buffer.from(b));
// Add the real SDK's public equality contract only to this test's reference
// facade. Artifact code never examines the fixture's query internals.
function queryDb(db){
    const reference=row=>({path:row.path,id:row.id,collection:name=>query(row.collection(name))});
    const query=row=>({path:row.path,doc:id=>reference(row.doc(id)),
        limit:n=>query(row.limit(n)),where:(...args)=>query(row.where(...args)),orderBy:(...args)=>query(row.orderBy(...args)),
        isEqual:other=>other?.isEqual instanceof Function&&other.key===JSON.stringify([row.path,row.filters,row.maximum,row.order]),
        key:JSON.stringify([row.path,row.filters,row.maximum,row.order])});
    return {collection:name=>query(db.collection(name)),doc:path=>reference(db.doc(path))};
}
function typed(value){
    if(value===null)return ['null'];
    if(typeof value==='number')return ['number',Object.is(value,-0)?'-0':value];
    if(['string','boolean'].includes(typeof value))return [typeof value,value];
    if(typeof value?.toMillis==='function'){
        const millis=value.toMillis(),seconds=value.seconds??Math.floor(millis/1000);
        return ['timestamp',seconds,value.nanoseconds??Math.round((millis-seconds*1000)*1000000)];
    }
    if(Array.isArray(value))return ['array',value.map(typed)];
    assert.equal(typeof value,'object');
    return ['object',Object.entries(value).map(([key,row])=>[key,typed(row)])];
}
function frameBytes(frames){
    return Buffer.concat([Buffer.from('CSRA1\n'),...frames.flatMap(frame=>{
        const bytes=Buffer.from(JSON.stringify(frame)),size=Buffer.alloc(4);size.writeUInt32BE(bytes.length);return [size,bytes];
    })]);
}
function material(h){
    const paths=[...namespaces.map(name=>h.root+'/'+name),h.save.slice(0,h.save.lastIndexOf('/'))];
    const docs=new Map([...h.data].filter(([path])=>paths.includes(path.slice(0,path.lastIndexOf('/')))));
    return {h,paths,docs,absent:new Set()};
}
function frames(m){
    return [{type:'header',schemaVersion:m.auditControl?2:1,ownerUid:m.h.uid,expectedRevision:m.h.revision,
        ...(m.auditControl?{auditControl:m.auditControl}:{})},
        ...[...m.docs].map(([path,data])=>({type:'document',path,data:typed(data)})),
        ...[...m.absent].map(path=>({type:'absence',path})),
        ...m.paths.map(path=>({type:'namespace',path,ids:[...m.docs.keys()].filter(key=>key.slice(0,key.lastIndexOf('/'))===path)
            .map(key=>key.slice(key.lastIndexOf('/')+1)).sort(compare),terminalEmpty:true})),
        {type:'footer',frameCount:2+m.docs.size+m.absent.size+m.paths.length,documentCount:m.docs.size,absenceCount:m.absent.size}];
}
const bytes=m=>frameBytes(frames(m));
function candidate(h){
    return createCanonicalCurrentRecovery({...h.dependencies,db:queryDb(h.dependencies.db),
        runProtected:()=>{throw Error('candidate must not enter a live protected transaction');}});
}
async function verify(m){return candidate(m.h).verifyRecoveryAuditArtifact({uid:m.h.uid,expectedRevision:m.h.revision,artifactBytes:bytes(m)});}
let baseline;
async function forestFixture(){
    if(!baseline)baseline=(async()=>{
        const h=storeHarness();let serial=0;const id=label=>`artifact-${label}-${String(++serial).padStart(8,'0')}`;
        await h.initial.commitInitialSources(h.request(),{operationId:id('initial'),expectedRevision:1,selection});
        const patrol=createCanonicalPatrolSettlement({...h.dependencies,randomBytes:n=>Buffer.alloc(n,255)});
        await patrol.observePresence(h.request(),{operationId:id('reopen'),expectedRevision:h.revision,expectedSequence:0,intent:'reopen',elementBox:'keep'});
        for(let battle=0;battle<20;battle++){
            const ticketId=id('ticket');
            await patrol.issueTicket(h.request(),{operationId:ticketId,expectedRevision:h.revision,triggerEntryId:'forest:0',availableEntryIds:['forest:0']});
            await patrol.settleMember(h.request(),{operationId:id('member'),expectedRevision:h.revision,ticketId,memberIndex:0});
            await patrol.settleTerminal(h.request(),{operationId:id('win'),expectedRevision:h.revision,ticketId,kind:'win'});
        }
        const allocator=createCanonicalExpAllocation(h.dependencies);
        for(let level=1;level<10;level++)await allocator.allocateSharedExp(h.request(),{operationId:id('allocate'),expectedRevision:h.revision});
        await h.initial.commitAdditionalCharacter(h.request(),{operationId:id('additional'),expectedRevision:h.revision,slotIndex:1,
            selection:{...selection,displayName:'Second',attributes:{attack:3,vitality:0,energy:0,intelligence:0,defensePoints:0,agility:0}}});
        const records=h.data.get(h.root+'/recoveryArchives/'+h.revision).sourceRecords;
        assert.equal(records.characters[0].state.level,10);assert.equal(records.characters.length,2);
        assert.equal(records.economy.sharedExp,30);
        const sourceId=id('ad-begin');
        await patrol.beginSimulatedAd(h.request(),{operationId:sourceId,expectedRevision:h.revision,
            expectedSequence:h.data.get(h.root+'/modeTime/current').sequence});
        await patrol.abandonSimulatedAd(h.request(),{operationId:id('ad-abandon'),expectedRevision:h.revision,
            expectedSequence:h.data.get(h.root+'/modeTime/current').sequence,sourceId});
        for(const key of [...h.data.keys()])if(['account','characters','economy','inventory','equipment','relics','relicLoadout',
            'progress','claimRecords','claimCheckpoints'].some(name=>key.startsWith(h.root+'/'+name+'/')))h.data.delete(key);
        return copy([...h.data]);
    })();
    const h=storeHarness();h.data.clear();for(const pair of copy(await baseline))h.data.set(...pair);return h;
}
// Materialize explicit negative dependencies from the fixture's actual missing
// documents. This is test construction, not a production capture/trust claim.
let closedBaseline;
async function buildClosedFixture(){
    const h=await forestFixture(),m=material(h);
    for(const name of ['account','economy','relicLoadout','progress','claimCheckpoints'])m.absent.add(h.root+'/'+name+'/current');
    const ids=new Set([...m.docs.keys()].filter(path=>['operations','modeTimeEvents'].includes(path.split('/').at(-2)))
        .map(path=>path.split('/').at(-1)));
    for(const id of ids)for(const name of ['operations','ledgerEntries','grantOperations']){
        const path=h.root+'/'+name+'/'+id;if(!h.data.has(path))m.absent.add(path);
    }
    for(let step=0;step<4096;step++){
        try{await verify(m);return m;}catch(error){
            const missing=error.message.match(/unrecorded dependency (.+)$/);
            if(missing){assert.equal(h.data.has(missing[1]),false);m.absent.add(missing[1]);continue;}
            const unused=error.message.match(/unused dependency (.+)$/);
            if(unused){assert(m.docs.delete(unused[1])||m.absent.delete(unused[1]));continue;}
            throw error;
        }
    }
    throw Error('fixture closure failed to converge');
}
async function closedFixture(){
    if(!closedBaseline)closedBaseline=buildClosedFixture();
    const saved=await closedBaseline,h=await forestFixture();
    return {...saved,h,docs:new Map(saved.docs),absent:new Set(saved.absent)};
}
const nanoStamp=(seconds,nanoseconds)=>({seconds,nanoseconds,toMillis:()=>seconds*1000+Math.floor(nanoseconds/1000000)});
async function controlledFixture(){
    const m=await closedFixture(),h=m.h,approvalId='artifact-audit-approval-001',auditId='artifact-audit-run-0000001';
    const approval=createCanonicalRecoveryApproval(h.dependencies);
    await approval.issue({auth:{uid:'artifact-operator',token:{cloudSaveOperator:true}},
        data:{ownerUid:h.uid,operationId:approvalId,sourceRevision:h.revision,ttlSeconds:60}});
    const approvalPath=h.root+'/recoveryApprovals/'+approvalId,raw=copy(h.data.get(approvalPath)),seconds=Math.floor(h.clock/1000);
    // Preserve the exact sub-millisecond stored timestamps while the live
    // Owner continues to apply its original expiresAt.toMillis() semantics.
    raw.issuedAt=nanoStamp(seconds,123);raw.expiresAt=nanoStamp(seconds+60,123);h.data.set(approvalPath,raw);
    const runRecoveryAuditMaintenance=(request,_auditId,operation)=>h.dependencies.runProtected(request,
        (tx,session)=>operation(tx,{...session,revision:1}));
    const recovery=createCanonicalCurrentRecovery({...h.dependencies,runRecoveryAuditMaintenance});
    await recovery.beginAudit(h.request(),{operationId:auditId,expectedRevision:h.revision,approvalOperationId:approvalId});
    const fencePath=h.root+'/recoveryAuditFence/current',runPath=h.root+'/recoveryAuditRuns/'+auditId;
    for(const path of [approvalPath,fencePath,runPath])m.docs.set(path,copy(h.data.get(path)));
    m.paths=[...m.paths,h.root+'/recoveryAuditFence',h.root+'/recoveryAuditRuns'];
    m.auditControl={auditId,epoch:1,sessionId:'a'.repeat(32),sessionRevision:1,recordedAt:['timestamp',seconds,123]};
    return {m,recovery,approvalPath,fencePath,runPath,seconds};
}
function cloneMaterial(m){return {...m,docs:new Map([...m.docs].map(([path,data])=>[path,copy(data)])),
    absent:new Set(m.absent),paths:m.paths.slice(),auditControl:m.auditControl?copy(m.auditControl):undefined};}

function assemblyHelperFaults({operations,nodes,clock}={}){
    const filename=require.resolve('../functions/src/recovery-audit-artifact'),compiled=new Module(filename);
    compiled.filename=filename;compiled.paths=Module._nodeModulePaths(dirname(filename));
    const native=compiled.require.bind(compiled);compiled.require=name=>name==='node:perf_hooks'&&clock?{performance:{now:clock}}:native(name);
    let source=readFileSync(filename,'utf8');
    assert(source.includes('bytes:256*1024*1024,nodes:16000000,operations:16384,passes:64,milliseconds:30000'));
    // Resource fault injection only. No production/request quota option exists.
    if(nodes!==undefined)source=source.replace('nodes:16000000','nodes:'+nodes);
    if(operations!==undefined)source=source.replace('operations:16384','operations:'+operations);
    compiled._compile(source,filename);return compiled.exports;
}

test('fixed assembly token protects reserved raw bytes, terminal reservations, node/pass/deadline limits and charges closed-view late reads',async()=>{
    const helper=require('../functions/src/recovery-audit-artifact'),m=await closedFixture(),db=queryDb(m.h.dependencies.db);
    const empty={uid:m.h.uid,expectedRevision:m.h.revision,auditControl:{auditId:'assembly-test-audit-0001',epoch:1,
        sessionId:'a'.repeat(32),sessionRevision:1,recordedAt:['timestamp',1700000000,0]},documents:[],absences:[],
        namespaces:helper.recoveryAuditNamespaces(m.h.uid,2).map(path=>({path,ids:[],terminalEmpty:true}))};
    const reserved=helper.createRecoveryAuditAssemblyBudget(),buffer=Buffer.alloc(2*1024*1024);
    helper.reserveRecoveryAuditRawInputs(reserved,Array(128).fill(buffer));
    let allocations=0,parses=0;const from=Buffer.from,parse=JSON.parse;
    Buffer.from=(...args)=>{allocations++;return from(...args);};JSON.parse=(...args)=>{parses++;return parse(...args);};
    try{
        assert.throws(()=>helper.encodeProofPayload({x:1},reserved),/assembly bytes budget exceeded/);
        assert.throws(()=>helper.decodeProofPayload(buffer,reserved),/assembly bytes budget exceeded/);
    }finally{Buffer.from=from;JSON.parse=parse;}
    assert.equal(allocations,0);assert.equal(parses,0);
    const orphan=helper.createRecoveryAuditAssemblyBudget();helper.reserveRecoveryAuditRawInputs(orphan,[Buffer.from('unconsumed')]);
    assert.throws(()=>helper.finishRecoveryAuditRawInputs(orphan),/reservation is incomplete/);
    assert.throws(()=>helper.encodeRecoveryAuditCandidate(empty,orphan),/reservation is incomplete/);
    const unknown=Object.freeze({});assert.throws(()=>helper.recoveryAuditAssemblyUsage(unknown),/unknown assembly budget/);

    const tiny=assemblyHelperFaults({nodes:8}),nodeToken=tiny.createRecoveryAuditAssemblyBudget();
    assert.throws(()=>tiny.encodeProofPayload(Array(9).fill(null),nodeToken),/assembly nodes budget exceeded/);
    assert.throws(()=>tiny.recoveryAuditAssemblyUsage(nodeToken),/assembly nodes budget exceeded/,'exhaustion is sticky');
    const passes=helper.createRecoveryAuditAssemblyBudget();helper.reserveRecoveryAuditRawInputs(passes,[]);
    for(let index=0;index<64;index++)helper.encodeRecoveryAuditCandidate(empty,passes);
    assert.throws(()=>helper.encodeRecoveryAuditCandidate(empty,passes),/assembly passes budget exceeded/);

    let now=0;const timed=assemblyHelperFaults({clock:()=>now}),timeToken=timed.createRecoveryAuditAssemblyBudget();
    timed.reserveRecoveryAuditRawInputs(timeToken,[]);const encoded=timed.encodeRecoveryAuditCandidate(empty,timeToken);
    const timedView=timed.decodeRecoveryAuditArtifact(encoded,{uid:m.h.uid,expectedRevision:m.h.revision,db},timeToken);
    now=30001;assert.throws(()=>timedView.finish(),/assembly deadline exceeded/,'terminal finish must check the deadline');
    await timed.drainAndCloseRecoveryAuditLookups(timedView);
    assert.throws(()=>timed.decodeRecoveryAuditArtifact(encoded,{uid:m.h.uid,expectedRevision:m.h.revision,db},timeToken),/assembly deadline exceeded/);

    const limited=assemblyHelperFaults({operations:3}),opToken=limited.createRecoveryAuditAssemblyBudget();
    limited.reserveRecoveryAuditRawInputs(opToken,[]);const opBytes=limited.encodeRecoveryAuditCandidate(empty,opToken);
    const view=limited.decodeRecoveryAuditArtifact(opBytes,{uid:m.h.uid,expectedRevision:m.h.revision,db},opToken),path=m.h.root+'/operations/not-recorded-test-01';
    await assert.rejects(()=>view.tx.get(db.doc(path)),/unrecorded dependency/);
    assert.deepEqual(await limited.drainAndCloseRecoveryAuditLookups(view),[path]);
    assert.equal(view.rows('operations').size,0);
    await assert.rejects(()=>view.tx.get(db.doc(path)),/unrecorded dependency/);
    await assert.rejects(()=>view.tx.get(db.doc(path)),/assembly operations budget exceeded/);
    assert.deepEqual(await limited.drainAndCloseRecoveryAuditLookups(view),[path],'closed diagnostics do not disable accounting');
    assert.throws(()=>limited.recoveryAuditAssemblyUsage(opToken),/assembly operations budget exceeded/);
    const claimed=helper.createRecoveryAuditAssemblyBudget();helper.reserveRecoveryAuditRawInputs(claimed,[]);
    const declared={...empty,namespaces:empty.namespaces.map(row=>row.path===m.h.root+'/operations'?{...row,ids:['missing-claimed-document']}:row)};
    const claimedBytes=helper.encodeRecoveryAuditCandidate(declared,claimed);
    assert.throws(()=>helper.decodeRecoveryAuditArtifact(claimedBytes,{uid:m.h.uid,expectedRevision:m.h.revision,db},claimed),/inventory missing document/);
});

test('exact-view lookup diagnostics collect only missing members, close once and never relax strict reads',async()=>{
    const m=await closedFixture(),db=queryDb(m.h.dependencies.db),input={uid:m.h.uid,expectedRevision:m.h.revision,db};
    const view=decodeRecoveryAuditArtifact(bytes(m),input),other=decodeRecoveryAuditArtifact(bytes(m),input);
    const missing=['diagnostic-missing-0001','diagnostic-missing-0002'].map(id=>m.h.root+'/operations/'+id);
    const emitted=missing.map(path=>view.tx.get(db.doc(path)));
    await assert.rejects(()=>Promise.all(emitted),/unrecorded dependency/);
    const trace=await drainAndCloseRecoveryAuditLookups(view);
    assert.deepEqual(trace,missing);assert(Object.isFrozen(trace));
    assert.equal(await drainAndCloseRecoveryAuditLookups(view),trace,'close is idempotent');
    // Closing drains only already-emitted lookup promises, not an Owner's
    // asynchronous call graph. A later lookup still rejects without appending.
    const late=m.h.root+'/operations/diagnostic-late-0001';
    await assert.rejects(()=>Promise.resolve().then(()=>view.tx.get(db.doc(late))),/unrecorded dependency/);
    assert.equal(await drainAndCloseRecoveryAuditLookups(view),trace);
    await assert.rejects(()=>other.tx.get(db.doc(late)),/unrecorded dependency/);
    assert.deepEqual(await drainAndCloseRecoveryAuditLookups(other),[late]);
    await assert.rejects(()=>drainAndCloseRecoveryAuditLookups({...view}),/unknown lookup view/);

    const clean=decodeRecoveryAuditArtifact(bytes(m),input);
    await clean.tx.get(db.doc([...m.docs.keys()][0]));
    assert.equal((await clean.tx.get(db.doc([...m.absent][0]))).exists,false);
    for(const path of ['foreign/uid/operations/missing',m.h.root+'/operations//missing',m.h.root+'/unknown/missing']){
        await assert.rejects(()=>clean.tx.get({path,collection(){}}),/unrecorded dependency/);
    }
    await assert.rejects(()=>clean.tx.get(db.collection('unsupported').limit(1)),/unknown or ambiguous query/);
    await assert.rejects(()=>clean.tx.get({isEqual:()=>true}),/unknown or ambiguous query/);
    await assert.rejects(()=>clean.tx.get({}),/unsupported query API/);
    assert.deepEqual(await drainAndCloseRecoveryAuditLookups(clean),[]);
    const corrupt=cloneMaterial(m),event=[...corrupt.docs.keys()].find(path=>path.includes('/modeTimeEvents/'));
    corrupt.docs.set(event,{...corrupt.docs.get(event),sequence:'invalid'});
    const invalid=decodeRecoveryAuditArtifact(bytes(corrupt),input);
    await assert.rejects(()=>invalid.tx.get(db.collection('serverUsers').doc(m.h.uid).collection('modeTimeEvents')
        .orderBy('sequence','desc').limit(2)),/unsupported mode sequence ordering/);
    assert.deepEqual(await drainAndCloseRecoveryAuditLookups(invalid),[]);
});

test('public candidate preserves complete v1/v2 results, strict errors and original Owner error wrapping',async()=>{
    const m=await closedFixture(),controlled=await controlledFixture();
    for(const source of [m,controlled.m]){
        const original=bytes(source),before=copy([...source.h.data]),writes=source.h.writes;
        const expected={candidateProofValid:true,ownerUid:source.h.uid,sourceRevision:source.h.revision,
            sourceSha256:source.docs.get(source.h.root+'/recoveryArchives/'+source.h.revision).sourceSha256,
            snapshotSha256:source.docs.get(source.h.root+'/playableSnapshots/'+source.h.revision).sha256,
            trustedCaptureVerified:false,restoreAuthorized:false,authoritativeStateReady:false,
            artifactSha256:require('node:crypto').createHash('sha256').update(original).digest('hex'),
            documentCount:source.docs.size,absenceCount:source.absent.size,dependencyCount:source.docs.size+source.absent.size};
        assert.deepEqual(await verify(source),expected);assert.deepEqual(bytes(source),original);
        assert.deepEqual([...source.h.data],before);assert.equal(source.h.writes,writes);
    }
    const owner=candidate(m.h);
    await assert.rejects(()=>owner.verifyRecoveryAuditArtifact({uid:m.h.uid,expectedRevision:1,artifactBytes:bytes(m)}),
        {code:'invalid-argument',message:'A candidate owner and current revision are required.'});
    await assert.rejects(()=>owner.verifyRecoveryAuditArtifact({uid:m.h.uid,expectedRevision:m.h.revision,artifactBytes:Buffer.from('bad')}),
        {code:'data-loss',message:'Invalid recovery audit artifact: bytes or magic'});
    const damaged=cloneMaterial(m),additional=[...m.docs].find(([path,row])=>path.includes('/operations/')&&row.kind==='additional-character-sources')[1];
    const negative=['grantOperations','ledgerEntries'].map(name=>m.h.root+'/'+name+'/'+additional.operationId);
    for(const path of negative)damaged.absent.delete(path);
    await assert.rejects(()=>verify(damaged),{code:'data-loss',message:'Original additional-character evidence is inconsistent.'});
    const db=queryDb(m.h.dependencies.db),view=decodeRecoveryAuditArtifact(bytes(damaged),{uid:m.h.uid,expectedRevision:m.h.revision,db});
    const row={id:additional.operationId,data:()=>additional},account=m.docs.get(m.h.root+'/recoveryArchives/'+m.h.revision).sourceRecords.account;
    await assert.rejects(()=>m.h.initial.verifyRetainedOperation(view.tx,db.collection('serverUsers').doc(m.h.uid),m.h.uid,account,row),
        {code:'data-loss',message:'Original additional-character evidence is inconsistent.'});
    assert.deepEqual(await drainAndCloseRecoveryAuditLookups(view),negative,
        'original Owner may replace the error; the exact reader retains only the actual missing lookup group');
});

test('real twenty-battle Lv10 plus slot2 current-loss artifact is candidate-only, while original restore keeps its400 gate',async()=>{
    const m=await closedFixture(),h=m.h,before=copy([...h.data]),writes=h.writes;
    const result=await verify(m);
    assert.equal(result.candidateProofValid,true);assert.equal(result.trustedCaptureVerified,false);assert.equal(result.restoreAuthorized,false);
    assert.equal(result.authoritativeStateReady,false);
    assert.deepEqual(Object.keys(result).sort(),['absenceCount','artifactSha256','authoritativeStateReady','candidateProofValid','dependencyCount','documentCount',
        'ownerUid','restoreAuthorized','snapshotSha256','sourceRevision','sourceSha256','trustedCaptureVerified'].sort());
    assert(bytes(m).length>1024*1024,'actual raw proof closure exceeds a Firestore document');
    assert.deepEqual([...h.data],before);assert.equal(h.writes,writes);
    const operationId='artifact-original-restore-0001';
    await createCanonicalRecoveryApproval(h.dependencies).issue({auth:{uid:'artifact-operator',token:{cloudSaveOperator:true}},
        data:{ownerUid:h.uid,operationId,sourceRevision:h.revision,ttlSeconds:300}});
    await assert.rejects(()=>createCanonicalCurrentRecovery(h.dependencies).restoreCurrent(h.request(),
        {operationId,expectedRevision:h.revision}),/transaction budget/);
});

test('missing original proof, orphan economics and unknown operation history refuse without any writes',async()=>{
    const base=await closedFixture();
    for(const mutate of [
        m=>{const key=[...m.docs.keys()].find(path=>path.includes('/ledgerEntries/'));m.docs.delete(key);m.absent.add(key);},
        m=>m.docs.set(m.h.root+'/ledgerEntries/orphan-ledger-0000001',{schemaVersion:1,kind:'forest-patrol-settlement',ownerUid:m.h.uid,operationId:'orphan-ledger-0000001'}),
        m=>m.docs.set(m.h.root+'/operations/unknown-operation-001',{schemaVersion:1,kind:'frozen-battle',ownerUid:m.h.uid,operationId:'unknown-operation-001'}),
        m=>{const key=[...m.docs.keys()].find(path=>path.includes('/recoveryArchives/2'));m.docs.delete(key);m.absent.add(key);},
        m=>m.docs.set(m.h.root+'/modeTimeEvents/unknown-mode-event-01',{schemaVersion:3,kind:'unknown',modeChanged:false,ownerUid:m.h.uid,operationId:'unknown-mode-event-01'})
    ]){
        const m={...base,docs:new Map(base.docs),absent:new Set(base.absent)},before=copy([...m.h.data]),writes=m.h.writes;
        mutate(m);await assert.rejects(()=>verify(m));assert.deepEqual([...m.h.data],before);assert.equal(m.h.writes,writes);
    }
});

test('framing, terminal inventories, unknown dependencies and typed timestamp nanoseconds are strict',async()=>{
    const m=await closedFixture(),db=queryDb(m.h.dependencies.db),input={uid:m.h.uid,expectedRevision:m.h.revision,db};
    const key=[...m.docs.keys()].find(path=>path.includes('/operations/'));
    const nanos=123456789;
    const changed={...m,docs:new Map(m.docs)};
    changed.docs.set(key,{...changed.docs.get(key),createdAt:{seconds:1700000000,nanoseconds:nanos,toMillis:()=>1700000000123.4568}});
    const view=decodeRecoveryAuditArtifact(bytes(changed),input),snapshot=await view.tx.get(db.doc(key));
    assert.equal(snapshot.id,key.split('/').at(-1));assert.equal(snapshot.ref.path,key);assert.equal(snapshot.exists,true);
    assert.equal(snapshot.get('createdAt').nanoseconds,nanos);assert.equal(snapshot.get('createdAt').seconds,1700000000);
    assert.equal(snapshot.get('createdAt').toMillis(),1700000000123);assert.notEqual(snapshot.data(),snapshot.data());
    assert.equal(snapshot.get('createdAt').toDate().getTime(),1700000000123);
    assert.equal(snapshotDigest({stamp:snapshot.get('createdAt')}),snapshotDigest({stamp:{_seconds:1700000000,_nanoseconds:nanos}}));
    assert.equal((await verify(changed)).candidateProofValid,true);
    assert(Object.isFrozen(snapshot.data()));assert(Object.isFrozen(snapshot.get('createdAt')));
    for(const [seconds,nanoseconds,millis,dateMillis] of [[1700000000,123999999,1700000000123,1700000000124],[-1,999999999,-1,0]]){
        const f=frames(m);f.find(row=>row.type==='document'&&row.path===key).data=['object',[['stamp',['timestamp',seconds,nanoseconds]]]];
        const stamp=(await decodeRecoveryAuditArtifact(frameBytes(f),input).tx.get(db.doc(key))).get('stamp');
        assert.equal(stamp.toMillis(),millis);assert.equal(stamp.toDate().getTime(),dateMillis);
        assert.equal(stamp.nanoseconds,nanoseconds);assert.equal(stamp.seconds,seconds);
    }
    await assert.rejects(()=>view.tx.get(db.doc(m.h.root+'/operations/not-recorded-0000001')),/unrecorded dependency/);
    await assert.rejects(()=>view.tx.get(db.collection('unrecognized').limit(1)),/unknown or ambiguous query/);
    await assert.rejects(()=>view.tx.get({isEqual:()=>true}),/unknown or ambiguous query/);
    for(const mutate of [
        f=>{f.find(row=>row.type==='namespace').terminalEmpty=false;},
        f=>{f.find(row=>row.type==='namespace').ids.push('invented');},
        f=>{const row=f.find(row=>row.type==='namespace'&&row.ids.length);row.ids.push(...row.ids);},
        f=>{f[1].data=['timestamp',1700000000,1000000000];},
        f=>{let nested=['null'];for(let i=0;i<66;i++)nested=['array',[nested]];f[1].data=['object',[['deep',nested]]];},
        f=>{f[0].schemaVersion=2;}
    ]){const f=frames(m);mutate(f);assert.throws(()=>decodeRecoveryAuditArtifact(frameBytes(f),input));}
    assert.throws(()=>decodeRecoveryAuditArtifact(Buffer.concat([bytes(m),Buffer.from([0])]),input),/frame boundary/);
    assert.throws(()=>decodeRecoveryAuditArtifact(bytes(m).subarray(0,-1),input),/frame size/);
    assert.throws(()=>decodeRecoveryAuditArtifact(Buffer.alloc(32*1024*1024+1),input),/bytes or magic/);
    const oversized=Buffer.alloc(10);Buffer.from('CSRA1\n').copy(oversized);oversized.writeUInt32BE(2*1024*1024+1,6);
    assert.throws(()=>decodeRecoveryAuditArtifact(oversized,input),/frame size/);
    const dense={type:'document',path:key,data:['array',Array.from({length:350000},()=>[])]};
    const smallHeader=frames(m)[0],denseBytes=frameBytes([smallHeader,dense,dense,dense]);
    assert.throws(()=>decodeRecoveryAuditArtifact(denseBytes,input),/parsed node or depth limit/);
    const extra={...m,docs:new Map(m.docs)};extra.docs.set(m.h.save.slice(0,m.h.save.lastIndexOf('/')+1)+'other',{unknown:true});
    await assert.rejects(()=>verify(extra),/unused dependency/);
    for(const sequence of ['999',true,Number.MAX_SAFE_INTEGER+1]){
        const broken={...m,docs:new Map(m.docs)},path=[...m.docs.keys()].find(p=>p.includes('/modeTimeEvents/'));
        broken.docs.set(path,{...broken.docs.get(path),sequence});
        const v=decodeRecoveryAuditArtifact(bytes(broken),input);
        await assert.rejects(()=>v.tx.get(db.collection('serverUsers').doc(m.h.uid).collection('modeTimeEvents').orderBy('sequence','desc').limit(2)),
            /unsupported mode sequence ordering/);
    }
});

test('original non-value mode verifier covers zero presence/ad lifecycle and refuses economic overlap or missing original proof',async()=>{
    const base=await closedFixture(),db=queryDb(base.h.dependencies.db),root=db.collection('serverUsers').doc(base.h.uid);
    const before=copy([...base.h.data]),writes=base.h.writes;
    const owner=createCanonicalAccountModeTime({...base.h.dependencies,db}),account=base.docs.get(base.h.root+'/recoveryArchives/'+base.h.revision).sourceRecords.account;
    const zero=[...base.docs].filter(([path,row])=>path.includes('/modeTimeEvents/')&&row.schemaVersion===1&&row.modeChanged===false);
    assert.deepEqual(zero.map(([,row])=>row.intent.action).sort(),['abandon-ad','begin-ad','reopen']);
    async function check(m,path){
        const view=decodeRecoveryAuditArtifact(bytes(m),{uid:m.h.uid,expectedRevision:m.h.revision,db});
        await owner.verifyRetainedNonValueEvent(view.tx,root,m.h.uid,account,await view.tx.get(db.doc(path)),m.h.revision);
    }
    for(const [path] of zero)await check(base,path);
    const reopen=zero.find(([,row])=>row.intent.action==='reopen')[0];
    const abandoned=zero.find(([,row])=>row.intent.action==='abandon-ad')[0];
    const sourceId=base.docs.get(abandoned).intent.sourceId;
    const removals=[base.h.root+'/simulatedAdSources/'+sourceId,
        base.h.root+'/modeTimeEvents/'+sourceId,base.h.root+'/recoveryArchives/'+base.docs.get(abandoned).sourceRevision];
    for(const path of removals){
        const m={...base,docs:new Map(base.docs),absent:new Set(base.absent)};assert(m.docs.delete(path));m.absent.add(path);
        await assert.rejects(()=>check(m,abandoned),undefined,path);
    }
    for(const name of ['operations','ledgerEntries','grantOperations']){
        const m={...base,docs:new Map(base.docs),absent:new Set(base.absent)},id=reopen.split('/').at(-1),path=base.h.root+'/'+name+'/'+id;
        m.absent.delete(path);m.docs.set(path,{operationId:id});
        await assert.rejects(()=>check(m,reopen),/overlaps economic evidence/);
    }
    for(const patch of [{modeChanged:true},{schemaVersion:2},{kind:'unknown'},{operationId:'wrong-zero-event-0001'},
        {observedAtMs:base.docs.get(reopen).observedAtMs+1}]){
        const m={...base,docs:new Map(base.docs)};m.docs.set(reopen,{...m.docs.get(reopen),...patch});await assert.rejects(()=>check(m,reopen));
    }
    assert.deepEqual([...base.h.data],before);assert.equal(base.h.writes,writes);
});

test('artifact timestamps preserve the installed pinned Admin SDK semantics and original hash',
    {skip:!NodeTimestamp?'functions Firebase Admin dependency is not installed locally':false},async()=>{
    const m=await closedFixture(),db=queryDb(m.h.dependencies.db),key=[...m.docs.keys()].find(path=>path.includes('/operations/'));
    for(const [seconds,nanos] of [[1700000000,123456789],[1700000000,123999999],[-1,999999999]]){
        const timestamp=new NodeTimestamp(seconds,nanos),f=frames(m);
        f.find(row=>row.type==='document'&&row.path===key).data=['object',[['stamp',typed(timestamp)]]];
        const view=decodeRecoveryAuditArtifact(frameBytes(f),{uid:m.h.uid,expectedRevision:m.h.revision,db});
        const decoded=(await view.tx.get(db.doc(key))).get('stamp');
        assert.deepEqual(Object.keys(decoded),Object.keys(timestamp));
        assert.equal(decoded.toMillis(),timestamp.toMillis());assert.equal(decoded.toDate().getTime(),timestamp.toDate().getTime());
        assert.equal(decoded.seconds,timestamp.seconds);assert.equal(decoded.nanoseconds,timestamp.nanoseconds);
        assert.equal(snapshotDigest({stamp:decoded}),snapshotDigest({stamp:timestamp}));
    }
});

test('v2 selected audit control closes the real20-battle artifact without granting trust, while v1 remains byte-compatible',async()=>{
    const legacy=await closedFixture(),legacyBytes=bytes(legacy),legacyResult=await verify(legacy);
    assert.deepEqual(frames(legacy)[0],{type:'header',schemaVersion:1,ownerUid:legacy.h.uid,expectedRevision:legacy.h.revision});
    const {m,recovery}=await controlledFixture(),before=copy([...m.h.data]),writes=m.h.writes;
    const result=await verify(m);assert.equal(result.candidateProofValid,true);assert.equal(result.trustedCaptureVerified,false);assert.equal(result.restoreAuthorized,false);
    assert.deepEqual(Object.keys(result).sort(),Object.keys(legacyResult).sort());
    assert.equal(result.documentCount,legacyResult.documentCount+3);assert.equal(result.absenceCount,legacyResult.absenceCount);
    assert.equal(result.sourceSha256,legacyResult.sourceSha256);assert.equal(result.snapshotSha256,legacyResult.snapshotSha256);
    // recordedAt is a named consistency observation, never trusted current time.
    m.h.advance(61000);assert.equal((await verify(m)).candidateProofValid,true);
    await assert.rejects(()=>recovery.resumeAudit(m.h.request(),{auditId:m.auditControl.auditId,expectedEpoch:1,expectedRevision:m.h.revision}),/operator approval/);
    assert.deepEqual([...m.h.data],before);assert.equal(m.h.writes,writes);
    assert.deepEqual(bytes(legacy),legacyBytes);assert.deepEqual(await verify(legacy),legacyResult);
    const v1WithApproval=cloneMaterial(legacy),approval=[...m.docs].find(([path])=>path.includes('/recoveryApprovals/'));
    v1WithApproval.docs.set(...approval);await assert.rejects(()=>verify(v1WithApproval),/unused dependency/);
});

test('v2 control rejects missing, foreign, used, extra or inconsistently bound raw evidence without writes',async()=>{
    const {m,approvalPath,fencePath,runPath}=await controlledFixture(),before=copy([...m.h.data]),writes=m.h.writes;
    const cases=[
        n=>{n.docs.delete(approvalPath);n.absent.add(approvalPath);},
        n=>{n.docs.delete(fencePath);n.absent.add(fencePath);},
        n=>{n.docs.delete(runPath);n.absent.add(runPath);},
        n=>{n.auditControl.epoch++;},n=>{n.auditControl.sessionId='b'.repeat(32);},n=>{n.auditControl.sessionRevision++;},
        n=>{delete n.auditControl.sessionRevision;},n=>{n.auditControl.ownerUid=n.h.uid;},
        n=>{delete n.auditControl.sessionId;},
        n=>{n.auditControl.auditId='artifact-wrong-audit-0001';n.absent.add(n.h.root+'/recoveryAuditRuns/'+n.auditControl.auditId);},
        n=>{n.docs.get(fencePath).ownerUid='foreign';},n=>{n.docs.get(runPath).ownerUid='foreign';},
        n=>{n.docs.get(approvalPath).ownerUid='foreign';},n=>{n.docs.get(approvalPath).status='used';},
        n=>{n.docs.get(approvalPath).operationId='artifact-wrong-approval-01';},
        n=>{delete n.docs.get(approvalPath).issuedAt;},n=>{delete n.docs.get(approvalPath).expiresAt;},
        n=>{n.docs.get(approvalPath).sourceRevision--;},n=>{n.docs.get(approvalPath).sourceSha256='f'.repeat(64);},
        n=>{n.docs.get(approvalPath).snapshotSha256='f'.repeat(64);},
        n=>{n.docs.get(approvalPath).approvedBy='another-operator';},
        n=>{n.docs.get(runPath).beginIntentSha256='f'.repeat(64);},
        n=>{n.docs.get(fencePath).approvalBindingSha256='f'.repeat(64);n.docs.get(runPath).approvalBindingSha256='f'.repeat(64);},
        n=>{n.docs.get(fencePath).sourceSha256='f'.repeat(64);n.docs.get(runPath).sourceSha256='f'.repeat(64);},
        n=>{n.docs.get(fencePath).snapshotSha256='f'.repeat(64);n.docs.get(runPath).snapshotSha256='f'.repeat(64);},
        n=>{n.docs.get(fencePath).sourceRevision--;n.docs.get(runPath).sourceRevision--;},
        n=>{n.docs.get(fencePath).epoch++;n.docs.get(runPath).epoch++;},
        n=>{n.docs.set(n.h.root+'/recoveryApprovals/artifact-unreferenced-0001',copy(n.docs.get(approvalPath)));},
        n=>{n.docs.set(n.h.root+'/recoveryAuditRuns/artifact-unreferenced-0001',copy(n.docs.get(runPath)));},
        n=>{n.paths=n.paths.filter(path=>!path.endsWith('/recoveryAuditRuns'));}
    ];
    for(const mutate of cases){const n=cloneMaterial(m);mutate(n);await assert.rejects(()=>verify(n));}
    const foreign=frames(m);foreign[0].ownerUid='foreign';await assert.rejects(()=>candidate(m.h).verifyRecoveryAuditArtifact({
        uid:m.h.uid,expectedRevision:m.h.revision,artifactBytes:frameBytes(foreign)}),/header identity/);
    assert.deepEqual([...m.h.data],before);assert.equal(m.h.writes,writes);
});

test('v2 approval interval comparisons preserve exact nanosecond boundaries rather than millisecond rounding',async()=>{
    const {m,recovery,approvalPath,seconds}=await controlledFixture();
    for(const [sec,nanos,valid] of [[seconds,122,false],[seconds,123,true],[seconds+60,122,true],[seconds+60,123,false]]){
        const n=cloneMaterial(m);n.auditControl.recordedAt=['timestamp',sec,nanos];
        if(valid)assert.equal((await verify(n)).candidateProofValid,true);
        else await assert.rejects(()=>verify(n),/approval interval/);
    }
    for(const stamp of [nanoStamp(seconds+60,123),nanoStamp(seconds+61,123)]){
        const n=cloneMaterial(m);n.docs.get(approvalPath).issuedAt=stamp;
        await assert.rejects(()=>verify(n),/approval interval/);
    }
    const n=cloneMaterial(m);n.auditControl.recordedAt=['timestamp',seconds,1000000000];await assert.rejects(()=>verify(n),/timestamp/);
    m.h.setClock((seconds+60)*1000);
    await assert.rejects(()=>recovery.resumeAudit(m.h.request(),{auditId:m.auditControl.auditId,expectedEpoch:1,expectedRevision:m.h.revision}),
        /operator approval/,'Live expiry retains expiresAt.toMillis() <= now semantics at the exact millisecond');
});
