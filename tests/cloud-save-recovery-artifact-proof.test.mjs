import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {storeHarness,selection,copy} from './helpers/canonical-store-harness.mjs';
const require=createRequire(import.meta.url);
const {createCanonicalCurrentRecovery}=require('../functions/src/canonical-current-recovery');
const {createCanonicalPatrolSettlement}=require('../functions/src/canonical-patrol-settlement');
const {createCanonicalExpAllocation}=require('../functions/src/canonical-exp-allocation');
const {createCanonicalRecoveryApproval}=require('../functions/src/canonical-recovery-approval');
const {decodeRecoveryAuditArtifact}=require('../functions/src/recovery-audit-artifact');
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
    return [{type:'header',schemaVersion:1,ownerUid:m.h.uid,expectedRevision:m.h.revision},
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
