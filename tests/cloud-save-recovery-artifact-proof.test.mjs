import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire,Module} from 'node:module';
import {readFileSync} from 'node:fs';
import {dirname} from 'node:path';
import {createHash} from 'node:crypto';
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
    h.advance(1); // The deliberately sub-ms issuedAt must precede the real begin commit.
    await recovery.beginAudit(h.request(),{operationId:auditId,expectedRevision:h.revision,approvalOperationId:approvalId});
    const fencePath=h.root+'/recoveryAuditFence/current',runPath=h.root+'/recoveryAuditRuns/'+auditId;
    for(const path of [approvalPath,fencePath,runPath])m.docs.set(path,copy(h.data.get(path)));
    m.paths=[...m.paths,h.root+'/recoveryAuditFence',h.root+'/recoveryAuditRuns'];
    m.auditControl={auditId,epoch:1,sessionId:'a'.repeat(32),sessionRevision:1,recordedAt:['timestamp',seconds,123]};
    return {m,recovery,approvalPath,fencePath,runPath,seconds};
}
function cloneMaterial(m){return {...m,docs:new Map([...m.docs].map(([path,data])=>[path,copy(data)])),
    absent:new Set(m.absent),paths:m.paths.slice(),auditControl:m.auditControl?copy(m.auditControl):undefined};}

function assemblyHelperFaults({operations,nodes,bytes,clock}={}){
    const filename=require.resolve('../functions/src/recovery-audit-artifact'),compiled=new Module(filename);
    compiled.filename=filename;compiled.paths=Module._nodeModulePaths(dirname(filename));
    const native=compiled.require.bind(compiled);compiled.require=name=>name==='node:perf_hooks'&&clock?{performance:{now:clock}}:native(name);
    let source=readFileSync(filename,'utf8');
    assert(source.includes('bytes:256*1024*1024,nodes:16000000,operations:16384,passes:64,milliseconds:30000'));
    // Resource fault injection only. No production/request quota option exists.
    if(nodes!==undefined)source=source.replace('nodes:16000000','nodes:'+nodes);
    if(bytes!==undefined)source=source.replace('bytes:256*1024*1024','bytes:'+bytes);
    if(operations!==undefined)source=source.replace('operations:16384','operations:'+operations);
    compiled._compile(source,filename);return compiled.exports;
}

test('prepared fixed frames preserve fresh wire bytes and hashes while isolating their snapshot, output buffers and one budget',()=>{
    const helper=require('../functions/src/recovery-audit-artifact');
    const fixed={uid:'encoding-test-uid',expectedRevision:2,auditControl:{auditId:'encoding-test-audit-001',epoch:1,
        sessionId:'a'.repeat(32),sessionRevision:1,recordedAt:['timestamp',1700000000,123]},
        documents:[{path:'serverUsers/encoding-test-uid/account/current',data:{value:1,nested:['x',false,null]}}],
        namespaces:[{path:'serverUsers/encoding-test-uid/account',ids:['current'],terminalEmpty:true}]};
    const before=copy(fixed),token=helper.createRecoveryAuditAssemblyBudget();helper.reserveRecoveryAuditRawInputs(token,[]);
    const encode=helper.prepareRecoveryAuditCandidateEncoding(fixed,token),cache=helper.recoveryAuditAssemblyUsage(token);
    assert(Object.isFrozen(encode));assert(cache.bytes>0);assert.equal(cache.passes,0);assert.equal(cache.reservedBytes,0);
    let expectedWork=cache.bytes;
    for(const absences of [[],['serverUsers/encoding-test-uid/operations/absent-operation-01'],
        ['serverUsers/encoding-test-uid/grantOperations/absent-operation-01','serverUsers/encoding-test-uid/ledgerEntries/absent-operation-01']]){
        const original=helper.encodeRecoveryAuditCandidate({...before,absences}),actual=encode(absences);
        assert(actual.equals(original));assert.equal(createHash('sha256').update(actual).digest('hex'),createHash('sha256').update(original).digest('hex'));
        expectedWork+=actual.length;assert.equal(helper.recoveryAuditAssemblyUsage(token).bytes,expectedWork);
    }
    fixed.documents[0].data.value=9;fixed.auditControl.epoch=2;fixed.namespaces[0].ids.push('other');
    const original=helper.encodeRecoveryAuditCandidate({...before,absences:[]});
    assert(encode([]).equals(original));assert(!helper.encodeRecoveryAuditCandidate({...fixed,absences:[]}).equals(original),'fresh API reads each current input');
    const escaped=encode([]);escaped.fill(0);assert(encode([]).equals(original),'outputs never alias the cached bytes');
    assert.throws(()=>encode([],helper.createRecoveryAuditAssemblyBudget()),/only absences/);
    assert.throws(()=>helper.prepareRecoveryAuditCandidateEncoding(before,{}),/unknown assembly budget/);
    assert.throws(()=>helper.prepareRecoveryAuditCandidateEncoding(before,undefined),/unknown assembly budget/);
    for(const data of [{bad:()=>{}},{bad:undefined}]){
        const value={...before,documents:[{path:before.documents[0].path,data}]};let oldError;
        try{helper.encodeRecoveryAuditCandidate({...value,absences:[]});}catch(error){oldError=error.message;}
        const budget=helper.createRecoveryAuditAssemblyBudget();helper.reserveRecoveryAuditRawInputs(budget,[]);
        assert.throws(()=>helper.prepareRecoveryAuditCandidateEncoding(value,budget),error=>error.message===oldError);
    }
});

test('fixed cache and every copied output pay real byte/node/pass/deadline costs before Buffer allocation, without spending raw reservations',()=>{
    const helper=require('../functions/src/recovery-audit-artifact'),fixed={uid:'encoding-limit-uid',expectedRevision:2,
        auditControl:{auditId:'encoding-limit-audit-01',epoch:1,sessionId:'a'.repeat(32),sessionRevision:1,recordedAt:['timestamp',1700000000,0]},
        documents:[{path:'serverUsers/encoding-limit-uid/account/current',data:{value:1}}],namespaces:[]};
    const beforeAllocation=operation=>{let count=0;const alloc=Buffer.alloc;Buffer.alloc=(...args)=>{count++;return alloc(...args);};
        try{assert.throws(operation,/assembly bytes|reservation is incomplete|assembly nodes|assembly deadline|assembly passes/);}finally{Buffer.alloc=alloc;}
        assert.equal(count,0);};
    for(const fault of [{bytes:8},{nodes:2}]){
        const limited=assemblyHelperFaults(fault),token=limited.createRecoveryAuditAssemblyBudget();limited.reserveRecoveryAuditRawInputs(token,[]);
        beforeAllocation(()=>limited.prepareRecoveryAuditCandidateEncoding(fixed,token));
    }
    const reserved=helper.createRecoveryAuditAssemblyBudget();helper.reserveRecoveryAuditRawInputs(reserved,[Buffer.from('not-consumed')]);
    beforeAllocation(()=>helper.prepareRecoveryAuditCandidateEncoding(fixed,reserved));
    const token=helper.createRecoveryAuditAssemblyBudget();helper.reserveRecoveryAuditRawInputs(token,[]);
    helper.prepareRecoveryAuditCandidateEncoding(fixed,token);const cacheBytes=helper.recoveryAuditAssemblyUsage(token).bytes;
    const outputBytes=helper.encodeRecoveryAuditCandidate({...fixed,absences:[]}).length;
    const limited=assemblyHelperFaults({bytes:cacheBytes+outputBytes-1}),byteToken=limited.createRecoveryAuditAssemblyBudget();
    limited.reserveRecoveryAuditRawInputs(byteToken,[]);const encode=limited.prepareRecoveryAuditCandidateEncoding(fixed,byteToken);
    beforeAllocation(()=>encode([]));
    let now=0;const timed=assemblyHelperFaults({clock:()=>now}),timeToken=timed.createRecoveryAuditAssemblyBudget();
    timed.reserveRecoveryAuditRawInputs(timeToken,[]);const timeEncode=timed.prepareRecoveryAuditCandidateEncoding(fixed,timeToken);
    now=30001;beforeAllocation(()=>timeEncode([]));
    const passes=helper.createRecoveryAuditAssemblyBudget();helper.reserveRecoveryAuditRawInputs(passes,[]);
    const many=helper.prepareRecoveryAuditCandidateEncoding(fixed,passes);for(let index=0;index<64;index++)many([]);
    beforeAllocation(()=>many([]));
});

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

// Pure syntax pressure fixtures below make no earned-history/proof claim.
function rawSyntaxMaterial(length=3){
    const leaf=()=>({metadataMarker:'原😀 " \\ framing',payloadBytes:Buffer.alloc(length,7),sha256:'preserved-original-field'});
    return {binding:{ownerUid:'syntax-owner',auditId:'syntax-audit-operation',epoch:1,sourceRevision:2,inventoryStateSha256:'a'.repeat(64)},
        run:{stamp:new TimestampForRawSyntax(1700000000,999999999),nested:{documents:['文😀',-0]}},inventoryState:{syntax:true},rawState:{syntax:true},
        inventoryPages:[{id:'inventory-a',row:leaf()}],rawReceipts:[{id:'receipt-a',row:{preserve:{unknownToCodec:true}}}],
        rawChunks:[{id:'chunk-a',row:leaf()},{id:'chunk-b',row:leaf()}]};
}
class TimestampForRawSyntax{
    constructor(seconds,nanoseconds){this.seconds=seconds;this.nanoseconds=nanoseconds;}
    toMillis(){return this.seconds*1000+Math.floor(this.nanoseconds/1000000);}
}
function archiveFrames(bytes){const frames=[];for(let offset=6;offset<bytes.length;){const size=bytes.readUInt32BE(offset);offset+=4;
    frames.push(JSON.parse(bytes.subarray(offset,offset+size).toString('utf8')));offset+=size;}return frames;}
function syntaxFrames(frames,seal=true){
    const parts=[Buffer.from('CSRA1\n')];
    const append=frame=>{const bytes=Buffer.from(JSON.stringify(frame)),prefix=Buffer.alloc(4);prefix.writeUInt32BE(bytes.length);parts.push(prefix,bytes);};
    frames.slice(0,-1).forEach(append);
    if(seal)frames.at(-1).framesSha256=createHash('sha256').update(Buffer.concat(parts)).digest('hex');append(frames.at(-1));return Buffer.concat(parts);
}
// Frozen pre-elision leaf reference; no runtime or Git-history dependency.
function previousRawBase64(text,maximum,charge=()=>{}){
    const bad=message=>{throw Error('Invalid recovery audit artifact: '+message);};
    if(typeof text!=="string"||!text.length||text.length%4||! /^[A-Za-z0-9+/]*={0,2}$/.test(text))bad("raw archive base64");
    const alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    if((text.endsWith("==")&&(alphabet.indexOf(text.at(-3))&15))||
       (!text.endsWith("==")&&text.endsWith("=")&&(alphabet.indexOf(text.at(-2))&3)))bad("raw archive base64");
    const length=text.length/4*3-(text.endsWith("==")?2:text.endsWith("=")?1:0);
    if(length<1||length>maximum)bad("raw archive payload size");
    charge(length);
    const bytes=Buffer.from(text,"base64");
    charge(text.length);
    if(bytes.length!==length||bytes.toString("base64")!==text)bad("raw archive base64");
    return bytes;
}
test('raw base64 removes only canonical reencoding allocation and preserves the original joint guards',()=>{
    const filename=require.resolve('../functions/src/recovery-audit-artifact'),compiled=new Module(filename);
    compiled.filename=filename;compiled.paths=Module._nodeModulePaths(dirname(filename));
    compiled._compile(readFileSync(filename,'utf8')+'\nmodule.exports.testRawBase64=rawArchiveBase64;',filename);
    const helper=compiled.exports,maximum=256*1024;
    const valid=[Buffer.from(Array.from({length:256},(_,i)=>i)),Buffer.alloc(maximum,255)];
    for(let byte=0;byte<256;byte++)for(const length of [1,2,3])valid.push(Buffer.alloc(length,byte));
    for(let length=1;length<=8;length++)valid.push(Buffer.alloc(length,7));
    for(const input of valid){
        const text=input.toString('base64'),token=helper.createRecoveryAuditAssemblyBudget();let formerBytes=0;
        const expected=previousRawBase64(text,maximum,amount=>{formerBytes+=amount;});
        let reencodes=0;const native=Buffer.prototype.toString;
        Buffer.prototype.toString=function(...args){if(args[0]==='base64')reencodes++;return native.apply(this,args);};
        let actual;try{actual=helper.testRawBase64(text,maximum,token);}finally{Buffer.prototype.toString=native;}
        assert.deepEqual(actual,expected);assert.equal(reencodes,0);
        assert.equal(helper.recoveryAuditAssemblyUsage(token).bytes,input.length,'only the real decoded allocation remains');
        assert.equal(formerBytes-helper.recoveryAuditAssemblyUsage(token).bytes,text.length,'exact former reencoding allocation removed');
    }
    const invalid=[undefined,null,true,{},'', 'A','AA','AAA','AAAAA','AA=','A===','====','AA===','A=AA','AB==','AAB=',
        '-w==','_w==','A A=','AA\t=','AA\n=', 'AA\r='];
    for(const suffix of ['\n','\r','\r\n','\u2028','\u2029'])for(const base of ['AA==','AAA=','AAAA','AAA','AA='])invalid.push(base+suffix);
    invalid.push(Buffer.alloc(maximum+1).toString('base64'));
    for(const text of invalid){
        const errors=[];
        for(const decode of [()=>previousRawBase64(text,maximum),()=>helper.testRawBase64(text,maximum,helper.createRecoveryAuditAssemblyBudget())]){
            try{decode();assert.fail('invalid base64 was accepted');}catch(error){errors.push(error.message);}
        }
        assert.deepEqual(errors,[errors[0],errors[0]]);assert.match(errors[0],/^Invalid recovery audit artifact:/);
    }
    const material=rawSyntaxMaterial(),wire=helper.encodeRawRecoveryArchive(material,helper.createRecoveryAuditAssemblyBudget());
    assert.deepEqual(helper.encodeRawRecoveryArchive(helper.decodeRawRecoveryArchive(wire,helper.createRecoveryAuditAssemblyBudget()),helper.createRecoveryAuditAssemblyBudget()),wire);
});

test('raw canonical UTF8 validation preserves original frame values and error order without a second encoded Buffer',()=>{
    const filename=require.resolve('../functions/src/recovery-audit-artifact'),source=readFileSync(filename,'utf8');
    function probe(legacy=false,clock){
        const compiled=new Module(filename);compiled.filename=filename;compiled.paths=Module._nodeModulePaths(dirname(filename));
        const native=compiled.require.bind(compiled);
        compiled.require=name=>name==='node:perf_hooks'&&clock?{performance:{now:()=>clock.now}}:
            name==='node:buffer'&&clock?{isUtf8:input=>{clock.now=30001;return native(name).isUtf8(input);}}:native(name);
        const current='assemblyCharge(assemblyBudget);\n            const validUtf8=isUtf8(raw);\n            assemblyCharge(assemblyBudget);\n            if(!validUtf8)bad("noncanonical JSON");';
        assert.equal(source.split(current).length,2);
        const body=legacy?source.replace(current,'assemblyCharge(assemblyBudget,"bytes",length);\n            if(!Buffer.from(canonical).equals(raw))bad("noncanonical JSON");'):source;
        compiled._compile(body+'\nmodule.exports.testFrames=(bytes,token,raw=true)=>readRecoveryFrames(bytes,token,raw);',filename);return compiled.exports;
    }
    const previous=probe(true),current=probe(),frame=value=>({type:'control',name:'run',data:['object',[['text',['string',value]]]]});
    const wire=raw=>{const length=Buffer.alloc(4);length.writeUInt32BE(raw.length);return Buffer.concat([Buffer.from('CSRA1\n'),length,raw]);};
    for(const text of ['', '文😀', '\ufffd', '\u0000\t"\\', '\ud800']){
        const canonical=JSON.stringify(frame(text)),bytes=wire(Buffer.from(canonical));
        const a=previous.createRecoveryAuditAssemblyBudget(),b=current.createRecoveryAuditAssemblyBudget();
        let oldAllocations=0,newAllocations=0;const from=Buffer.from;
        Buffer.from=(value,...args)=>{if(typeof value==='string')oldAllocations++;return from(value,...args);};
        let expected;try{expected=previous.testFrames(bytes,a);}finally{Buffer.from=from;}
        Buffer.from=(value,...args)=>{if(typeof value==='string')newAllocations++;return from(value,...args);};
        let actual;try{actual=current.testFrames(bytes,b);}finally{Buffer.from=from;}
        assert.deepEqual(actual,expected);assert.equal(oldAllocations,1);assert.equal(newAllocations,0);
        assert.equal(previous.recoveryAuditAssemblyUsage(a).bytes-current.recoveryAuditAssemblyUsage(b).bytes,Buffer.byteLength(canonical));
        for(const key of ['nodes','operations','passes'])assert.equal(previous.recoveryAuditAssemblyUsage(a)[key],current.recoveryAuditAssemblyUsage(b)[key]);
        const legacyA=previous.createRecoveryAuditAssemblyBudget(),legacyB=current.createRecoveryAuditAssemblyBudget();
        const legacyBytes=wire(Buffer.from(JSON.stringify({type:'document',path:'serverUsers/test/account/current',data:['string',text]})));
        assert.deepEqual(current.testFrames(legacyBytes,legacyB,false),previous.testFrames(legacyBytes,legacyA,false));
        assert.equal(previous.recoveryAuditAssemblyUsage(legacyA).bytes,current.recoveryAuditAssemblyUsage(legacyB).bytes,'v1/v2 frame branch accounting is unchanged');
    }
    const template=JSON.stringify(frame('MARKER')),at=template.indexOf('MARKER'),prefix=Buffer.from(template.slice(0,at)),suffix=Buffer.from(template.slice(at+6));
    const malformed=[Buffer.from(' '+template),Buffer.from(template.replace('"type":"control"','"type":"control","type":"control"')),
        Buffer.from(template.replace('MARKER','\\u4e2d')),Buffer.from(template.replace('MARKER','"'))];
    for(const raw of [[255],[192,175],[237,160,128],[240,144,128],[226,130],[226,40,161]])malformed.push(Buffer.concat([prefix,Buffer.from(raw),suffix]));
    for(const raw of malformed){
        const errors=[];
        for(const helper of [previous,current])try{helper.testFrames(wire(raw),helper.createRecoveryAuditAssemblyBudget());assert.fail('invalid frame accepted');}
        catch(error){errors.push(error.message);}
        assert.deepEqual(errors,[errors[0],errors[0]]);assert.match(errors[0],/^Invalid recovery audit artifact:/);
    }
    const clock={now:0},timed=probe(false,clock),token=timed.createRecoveryAuditAssemblyBudget();
    assert.throws(()=>timed.testFrames(wire(Buffer.from(JSON.stringify(frame('deadline')))),token),/deadline exceeded/);
    assert.throws(()=>timed.recoveryAuditAssemblyUsage(token),/deadline exceeded/);
});

test('raw archive fixed version frames reject extra, missing, duplicate, reordered, noncanonical and damaged syntax without authority',()=>{
    const helper=require('../functions/src/recovery-audit-artifact'),material=rawSyntaxMaterial(),bytes=helper.encodeRawRecoveryArchive(material,helper.createRecoveryAuditAssemblyBudget());
    const mutations=[
        fs=>{fs[0].schemaVersion=99;},fs=>{fs[0].extra=true;},fs=>{fs[1].type='future-frame';},
        fs=>{[fs[1],fs[2]]=[fs[2],fs[1]];},fs=>{fs.splice(1,1);},
        fs=>{fs.findLast(row=>row.type==='raw-chunk').id='chunk-a';},
        fs=>{const [a,b]=fs.map((r,i)=>r.type==='raw-chunk'?i:-1).filter(i=>i>=0);[fs[a],fs[b]]=[fs[b],fs[a]];},
        fs=>{fs.at(-1).chunkCount++;},fs=>{fs.at(-1).payloadByteLength++;},
        fs=>{fs.find(row=>row.type==='raw-chunk').payloadBase64='AB==';},
        fs=>{fs.find(row=>row.type==='raw-chunk').payloadBase64='Bw==\n';},
        fs=>{fs.find(row=>row.type==='raw-chunk').sha256='0'.repeat(64);},
        fs=>{fs.find(row=>row.type==='raw-chunk').metadata=['object',[['z',['number',1]],['a',['number',2]]]];}
    ];
    for(const mutate of mutations){const frames=archiveFrames(bytes);mutate(frames);
        assert.throws(()=>helper.decodeRawRecoveryArchive(syntaxFrames(frames),helper.createRecoveryAuditAssemblyBudget()));}
    const frames=archiveFrames(bytes);frames.at(-1).framesSha256='0'.repeat(64);
    assert.throws(()=>helper.decodeRawRecoveryArchive(syntaxFrames(frames,false),helper.createRecoveryAuditAssemblyBudget()),/frames hash/);
    assert.throws(()=>helper.decodeRawRecoveryArchive(Buffer.concat([bytes,Buffer.from([0])]),helper.createRecoveryAuditAssemblyBudget()),/frame boundary/);
    for(const mutate of [m=>{m.extra=true;},m=>{delete m.run;},m=>{m.rawChunks[1].id=m.rawChunks[0].id;},m=>{m.rawChunks.reverse();}]){
        const invalid=rawSyntaxMaterial();mutate(invalid);assert.throws(()=>helper.encodeRawRecoveryArchive(invalid,helper.createRecoveryAuditAssemblyBudget()));
    }
    const decoded=helper.decodeRawRecoveryArchive(bytes,helper.createRecoveryAuditAssemblyBudget());
    assert.equal(decoded.rawChunks[0].row.sha256,'preserved-original-field','syntax container never heals original source metadata');
    assert.deepEqual(decoded.rawReceipts[0].row,{preserve:{unknownToCodec:true}});
});
test('raw archive caller budget is required and sticky, with byte and elapsed admission before Buffer allocation or parse',()=>{
    const helper=require('../functions/src/recovery-audit-artifact'),material=rawSyntaxMaterial(),bytes=helper.encodeRawRecoveryArchive(material,helper.createRecoveryAuditAssemblyBudget());
    for(const token of [undefined,{},Object.freeze({})]){
        assert.throws(()=>helper.encodeRawRecoveryArchive(material,token),/unknown assembly budget/);
        assert.throws(()=>helper.decodeRawRecoveryArchive(bytes,token),/unknown assembly budget/);
    }
    for(const operation of ['encode','decode']){
        const limited=assemblyHelperFaults({bytes:0}),token=limited.createRecoveryAuditAssemblyBudget();let allocations=0,parses=0;
        const from=Buffer.from,alloc=Buffer.alloc,parse=JSON.parse;
        Buffer.from=(...a)=>{allocations++;return from(...a);};Buffer.alloc=(...a)=>{allocations++;return alloc(...a);};JSON.parse=(...a)=>{parses++;return parse(...a);};
        try{assert.throws(()=>operation==='encode'?limited.encodeRawRecoveryArchive(material,token):limited.decodeRawRecoveryArchive(bytes,token),/bytes budget exceeded/);}
        finally{Buffer.from=from;Buffer.alloc=alloc;JSON.parse=parse;}
        assert.equal(allocations,0);assert.equal(parses,0);assert.throws(()=>limited.recoveryAuditAssemblyUsage(token),/bytes budget exceeded/);
    }
    let now=0;const timed=assemblyHelperFaults({clock:()=>now}),token=timed.createRecoveryAuditAssemblyBudget();now=30001;
    assert.throws(()=>timed.encodeRawRecoveryArchive(material,token),/deadline/);assert.throws(()=>timed.decodeRawRecoveryArchive(bytes,token),/deadline/);
    const small=assemblyHelperFaults({nodes:8}),nodeToken=small.createRecoveryAuditAssemblyBudget();
    assert.throws(()=>small.decodeRawRecoveryArchive(bytes,nodeToken),/nodes budget/);
    assert.throws(()=>small.recoveryAuditAssemblyUsage(nodeToken),/nodes budget/);
    // Malformed frames still pay their actual parsed tree before shape refusal.
    // A shape-first decoder would throw frame-shape instead and leave this token usable.
    const malformed=archiveFrames(bytes);malformed[0].extra=Array(100).fill('dense');
    const strict=assemblyHelperFaults({nodes:64}),badToken=strict.createRecoveryAuditAssemblyBudget();let first;
    try{strict.decodeRawRecoveryArchive(syntaxFrames(malformed),badToken);}catch(error){first=error;}
    assert.match(first?.message??'',/assembly nodes budget exceeded/);
    assert.throws(()=>strict.recoveryAuditAssemblyUsage(badToken),error=>error===first);
    assert.throws(()=>strict.encodeRawRecoveryArchive(material,badToken),error=>error===first);
});
test('raw archive pure syntax leaf pressure keeps original frame/container limits and exact canonical base64',()=>{
    const helper=require('../functions/src/recovery-audit-artifact'),material=rawSyntaxMaterial(128*1024),token=helper.createRecoveryAuditAssemblyBudget();
    material.rawChunks[0].row.payloadBytes=Buffer.alloc(256*1024,255);
    const bytes=helper.encodeRawRecoveryArchive(material,token),decoded=helper.decodeRawRecoveryArchive(bytes,token);
    assert.deepEqual(decoded.rawChunks[0].row.payloadBytes,material.rawChunks[0].row.payloadBytes);
    assert(bytes.length<32*1024*1024);
    material.rawChunks[0].row.payloadBytes=Buffer.alloc(256*1024+1);
    assert.throws(()=>helper.encodeRawRecoveryArchive(material,helper.createRecoveryAuditAssemblyBudget()),/payload size/);
    material.rawChunks[0].row.payloadBytes=Buffer.alloc(1);material.run={oversized:'x'.repeat(2*1024*1024)};
    assert.throws(()=>helper.encodeRawRecoveryArchive(material,helper.createRecoveryAuditAssemblyBudget()),/frame size/);
    assert.throws(()=>helper.decodeRawRecoveryArchive(Buffer.alloc(32*1024*1024+1),helper.createRecoveryAuditAssemblyBudget()),/bytes or magic/);
    const base=archiveFrames(helper.encodeRawRecoveryArchive(rawSyntaxMaterial(),helper.createRecoveryAuditAssemblyBudget()));
    const tooMany=[...base.slice(0,4),...Array(12284).fill({type:'raw-receipt',id:'r',data:['object',[]]}),base.at(-1)];
    assert.throws(()=>helper.decodeRawRecoveryArchive(syntaxFrames(tooMany),helper.createRecoveryAuditAssemblyBudget()),/frame boundary/);
    const dense=['object',[['many',['array',Array(125000).fill(['null'])]]]];
    for(let i=1;i<=3;i++)base[i].data=dense;base.find(row=>row.type==='raw-receipt').data=dense;
    assert.throws(()=>helper.decodeRawRecoveryArchive(syntaxFrames(base),helper.createRecoveryAuditAssemblyBudget()),/parsed node or depth limit/);

});

test('raw archive encoder admits oversized metadata and complete planned work before JSON, base64 or Buffer allocation',()=>{
    const helper=require('../functions/src/recovery-audit-artifact');
    for(const [owner,material,pattern] of [
        [helper,{...rawSyntaxMaterial(),run:{large:'x'.repeat(2*1024*1024)}},/frame size/],
        [assemblyHelperFaults({bytes:512}),{...rawSyntaxMaterial(),run:{large:'x'.repeat(1024)}},/bytes budget exceeded/]
    ]){
        let strings=0,base64=0,allocations=0;const stringify=JSON.stringify,toString=Buffer.prototype.toString,from=Buffer.from,alloc=Buffer.alloc;
        JSON.stringify=(...a)=>{strings++;return stringify(...a);};Buffer.prototype.toString=function(...a){if(a[0]==='base64')base64++;return toString.apply(this,a);};
        Buffer.from=(...a)=>{allocations++;return from(...a);};Buffer.alloc=(...a)=>{allocations++;return alloc(...a);};
        try{assert.throws(()=>owner.encodeRawRecoveryArchive(material,owner.createRecoveryAuditAssemblyBudget()),pattern);}
        finally{JSON.stringify=stringify;Buffer.prototype.toString=toString;Buffer.from=from;Buffer.alloc=alloc;}
        assert.equal(strings,0);assert.equal(base64,0);assert.equal(allocations,0);
    }
});

test('raw archive resource oracle matches native JSON UTF8 escaping/numbers and refuses getters, cycles and unsupported trees',()=>{
    const filename=require.resolve('../functions/src/recovery-audit-artifact'),compiled=new Module(filename);
    compiled.filename=filename;compiled.paths=Module._nodeModulePaths(dirname(filename));
    compiled._compile(readFileSync(filename,'utf8')+'\nmodule.exports.lexicalResourceOracle=rawArchiveJSONMetrics;',filename);
    const helper=compiled.exports,values=[null,true,false,-0,0,1e20,1e21,1e-6,1e-7,Number.MAX_VALUE,-Number.MAX_VALUE,Number.MIN_VALUE,
        '"\\'+String.fromCharCode(...Array.from({length:32},(_,i)=>i)), 'é中文😀𐐷\u2028\u2029','\ud800','\udc00',
        {nested:['原😀',-0,{documents:'"\\\n'}]},Array(7).fill(null)];
    const count=row=>1+(row&&typeof row==='object'?Object.values(row).reduce((sum,v)=>sum+count(v),0):0);
    for(const value of values){const token=helper.createRecoveryAuditAssemblyBudget(),metric=helper.lexicalResourceOracle(value,token);
        assert.equal(metric.length,Buffer.byteLength(JSON.stringify(value),'utf8'));assert.equal(metric.nodes,count(value));}
    let gets=0;const accessor={get x(){gets++;return 1;}},cycle={};cycle.self=cycle;
    for(const bad of [accessor,cycle,undefined,()=>1,Symbol('unsupported'),BigInt(1),Object.create({foreign:true})])
        assert.throws(()=>helper.lexicalResourceOracle(bad,helper.createRecoveryAuditAssemblyBudget()));
    assert.equal(gets,0);
    const array=[];Object.defineProperty(array,'0',{enumerable:true,get(){gets++;return 1;}});array.length=1;
    const material=rawSyntaxMaterial();material.run={array};
    assert.throws(()=>helper.encodeRawRecoveryArchive(material,helper.createRecoveryAuditAssemblyBudget()),/accessor/);assert.equal(gets,0);
    material.run={cycle};assert.throws(()=>helper.encodeRawRecoveryArchive(material,helper.createRecoveryAuditAssemblyBudget()),/cycle/);
});

test('raw archive array precheck rejects nonenumerable map overrides and nondata shapes before getters execute',()=>{
    const helper=require('../functions/src/recovery-audit-artifact');let getters=0;
    const cases=[
        ()=>{const a=[1];Object.defineProperty(a,'map',{get(){getters++;return Array.prototype.map;}});return a;},
        ()=>{const a=[1];Object.defineProperty(a,'map',{value:Array.prototype.map});return a;},
        ()=>{const a=[1];a[Symbol('extra')]=2;return a;},
        ()=>{const a=[1];a.extra=2;return a;},
        ()=>new Array(1),
        ()=>{const a=[1];Object.defineProperty(a,'0',{get(){getters++;return 1;}});return a;}
    ];
    for(const build of cases){const material=rawSyntaxMaterial();material.run={array:build()};
        assert.throws(()=>helper.encodeRawRecoveryArchive(material,helper.createRecoveryAuditAssemblyBudget()),/array shape|accessor/);}
    assert.equal(getters,0);
    const nested=[1];Object.defineProperty(nested,'map',{get(){getters++;return Array.prototype.map;}});
    const array=[];Object.defineProperty(array,'0',{value:nested});array.length=1;
    const material=rawSyntaxMaterial();material.run={array};
    assert.throws(()=>helper.encodeRawRecoveryArchive(material,helper.createRecoveryAuditAssemblyBudget()),/array shape/);assert.equal(getters,0);
    material.run={array:[0,-0,['中😀',null,true]],stamp:new TimestampForRawSyntax(1700000000,999999999)};
    const token=helper.createRecoveryAuditAssemblyBudget(),bytes=helper.encodeRawRecoveryArchive(material,token),decoded=helper.decodeRawRecoveryArchive(bytes,token);
    assert.deepEqual(helper.encodeProofPayload(decoded.run),helper.encodeProofPayload(material.run));
});
