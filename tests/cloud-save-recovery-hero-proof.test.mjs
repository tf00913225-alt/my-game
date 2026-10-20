import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire,Module} from 'node:module';
import {readFileSync} from 'node:fs';
import {dirname} from 'node:path';
import {storeHarness,selection,copy} from '../scripts/test-helpers/canonical-store-harness.mjs';
const require=createRequire(import.meta.url);
const {createSessionAuthority}=require('../functions/src/session-authority');
const {createCanonicalSourceWriter}=require('../functions/src/canonical-source-writer');
const {createHeroAcquisition}=require('../functions/src/hero-acquisition');
const {createHeroGrowth}=require('../functions/src/hero-growth');
const {createCanonicalRecoveryApproval}=require('../functions/src/canonical-recovery-approval');
const {createCanonicalCurrentRecovery}=require('../functions/src/canonical-current-recovery');
const {snapshotDigest}=require('../functions/src/canonical-snapshot');
const {classifyRetainedCanonicalOperation}=require('../functions/src/canonical-operation-classifier');
const {recoveryAuditNamespaces}=require('../functions/src/recovery-audit-artifact');

test('Hero namespace inventory is explicitly versioned without changing either retained namespace list',()=>{
    const uid='hero-proof-namespace-owner';
    const v1=recoveryAuditNamespaces(uid,1),v2=recoveryAuditNamespaces(uid,2),v3=recoveryAuditNamespaces(uid,3);
    assert.equal(v1.length,29);
    assert.deepEqual(v2,[...v1.slice(0,-1),`serverUsers/${uid}/recoveryAuditFence`,
        `serverUsers/${uid}/recoveryAuditRuns`,v1.at(-1)]);
    assert.deepEqual(recoveryAuditNamespaces(uid),v2,'default remains the retained v2 contract');
    assert.deepEqual(v3,[...v2.slice(0,-1),...['heroAcquisition','heroAcquisitionHistory','heroChapter',
        'heroChapterTickets','heroChapterSteps'].map(name=>`serverUsers/${uid}/${name}`),v2.at(-1)]);
    assert.equal(new Set(v3).size,36);
    for(const version of [0,4,'3',null])assert.throws(()=>recoveryAuditNamespaces(uid,version),/namespace identity/);
});

test('raw archive v4 syntax binds the Hero namespace and both revision cuts without silently changing v3',()=>{
    const codec=require('../functions/src/recovery-audit-artifact');
    const material={binding:{ownerUid:'hero-syntax-owner',auditId:'hero-syntax-audit-0001',epoch:1,
        sourceRevision:3,inventoryStateSha256:'a'.repeat(64)},run:{syntaxOnly:true},inventoryState:{syntaxOnly:true},
        inventoryPages:[],rawState:{syntaxOnly:true},rawReceipts:[],rawChunks:[]};
    const encode=value=>codec.encodeRawRecoveryArchive(value,codec.createRecoveryAuditAssemblyBudget());
    const decode=value=>codec.decodeRawRecoveryArchive(value,codec.createRecoveryAuditAssemblyBudget());
    const header=wire=>JSON.parse(wire.subarray(10,10+wire.readUInt32BE(6)).toString('utf8'));
    const old=encode(material);
    assert.equal(header(old).schemaVersion,3);
    assert.deepEqual(encode(decode(old)),old);
    const current={...material,binding:{...material.binding,canonicalRevision:2,namespaceVersion:3}};
    const wire=encode(current);
    assert.equal(header(wire).schemaVersion,4);
    assert.deepEqual(decode(wire),current);
    assert.deepEqual(encode(decode(wire)),wire);
    assert.deepEqual(encode(material),old,'the retained format remains byte identical');
    for(const patch of [{namespaceVersion:2},{namespaceVersion:'3'},{canonicalRevision:4},
        {canonicalRevision:1},{canonicalRevision:2.5},{canonicalRevision:undefined}]){
        assert.throws(()=>encode({...current,binding:{...current.binding,...patch}}),/revision or namespace version/);
    }
    assert.throws(()=>encode({...material,binding:{...material.binding,canonicalRevision:2}}),/frame shape/);
    // Syntax alone never claims an original source proof or a restore right.
    assert.equal(Object.hasOwn(decode(wire),'candidateProofValid'),false);
});

async function heroFixture(beforeHero){
    const h=storeHarness(),sessions=createSessionAuthority(h.dependencies);
    let session;
    const request=()=>({auth:{uid:h.uid,token:{auth_time:Math.floor(h.clock/1000)}},
        data:{uid:h.uid,...(session?{session}:{})}});
    session=await sessions.create(request());
    const deps={...h.dependencies,runProtected:sessions.runProtected,runRecoveryAuditMaintenance:sessions.runRecoveryAuditMaintenance};
    await createCanonicalSourceWriter(deps).commitInitialSources(request(),{
        operationId:'hero-proof-initial-operation-01',expectedRevision:1,selection});
    if(beforeHero)await beforeHero({h,deps,request});
    await createHeroAcquisition({...deps,now:()=>h.clock,seed:()=>1}).observeLogin({
        ...request(),data:{...request().data,expectedRevision:h.revision}});
    return {h,deps,request,refreshSession:async()=>{session=await sessions.create({
        auth:{uid:h.uid,token:{auth_time:Math.floor(h.clock/1000)}},data:{uid:h.uid}});}};
}

test('a genuine Hero login is retained recovery evidence while canonical and envelope revisions differ',async()=>{
    const {h}=await heroFixture();
    assert.equal(h.revision,3);
    assert.equal(h.data.get(h.root+'/account/current').serverRevision,2);
    assert.equal(h.data.has(h.root+'/recoveryArchives/2'),true);
    assert.equal(h.data.has(h.root+'/recoveryArchives/3'),false,'an observation does not fabricate an archive');
    const operations=[...h.data].filter(([path,row])=>path.startsWith(h.root+'/operations/')&&row.kind==='hero-login-observation');
    assert.equal(operations.length,1);
    const [path,row]=operations[0],before=copy([...h.data]),writes=h.writes;
    const fail=(code,message)=>{const error=new Error(message);error.code=code;throw error;};
    assert.equal(classifyRetainedCanonicalOperation(row,path.split('/').at(-1),h.uid,h.revision,fail),'hero');
    assert.deepEqual([...h.data],before);
    assert.equal(h.writes,writes);
});

test('Hero approval binds the actual current canonical pointer and envelope cut without creating an intermediate archive',async()=>{
    const {h,deps}=await heroFixture(),owner=createCanonicalRecoveryApproval({...deps,now:()=>h.clock});
    const operationId='hero-proof-dual-approval-0001';
    const request={auth:{uid:'hero-proof-operator',token:{cloudSaveOperator:true}},data:{
        ownerUid:h.uid,operationId,sourceRevision:3,canonicalRevision:2,ttlSeconds:60}};
    const before=copy([...h.data]),response=await owner.issue(request);
    assert.equal(response.approved,true);
    assert.equal(response.canonicalRevision,2);
    assert.equal(response.sourceRevision,3);
    assert.equal(response.namespaceVersion,3);
    const approval=h.data.get(h.root+'/recoveryApprovals/'+operationId);
    assert.equal(approval.schemaVersion,2);
    assert.equal(approval.canonicalRevision,2);
    assert.equal(approval.namespaceVersion,3);
    assert.deepEqual([...h.data].filter(([path])=>path!==h.root+'/recoveryApprovals/'+operationId),before);
    const writes=h.writes;
    assert.equal((await owner.issue(request)).unchanged,true);
    assert.equal(h.writes,writes);
    assert.equal(h.data.has(h.root+'/recoveryArchives/3'),false);
    const pointer=h.data.get(h.root+'/account/current');
    for(const broken of [null,{...pointer,serverRevision:3},{...pointer,snapshotSha256:'f'.repeat(64)},
        {...pointer,ownerUid:'foreign-owner'}]){
        if(broken)h.data.set(h.root+'/account/current',broken);else h.data.delete(h.root+'/account/current');
        const prior=copy([...h.data]),count=h.writes;
        await assert.rejects(owner.issue({...request,data:{...request.data,operationId:'hero-proof-rejected-approval'}}),/current canonical pointer/);
        assert.deepEqual([...h.data],prior);
        assert.equal(h.writes,count);
    }
    h.data.set(h.root+'/account/current',pointer);
    await assert.rejects(owner.issue({...request,data:{...request.data,canonicalRevision:4}}),/valid owner/);
    await assert.rejects(owner.issue({...request,data:{...request.data,namespaceVersion:3}}),/Only an owner/);
});

test('Hero audit and inventory preserve both approved cuts and explicitly seal namespace v3',async()=>{
    const {h,deps,request}=await heroFixture(),owner=createCanonicalRecoveryApproval({...deps,now:()=>h.clock});
    const operationId='hero-proof-capture-approval-01',auditId='hero-proof-capture-audit-001';
    await owner.issue({auth:{uid:'hero-proof-operator',token:{cloudSaveOperator:true}},data:{
        ownerUid:h.uid,operationId,sourceRevision:3,canonicalRevision:2,ttlSeconds:60}});
    const recovery=createCanonicalCurrentRecovery({...deps,now:()=>h.clock});
    const begun=await recovery.beginAudit(request(),{operationId:auditId,expectedRevision:3,approvalOperationId:operationId});
    assert.equal(begun.beginAccepted,true);
    const root=h.root+'/recoveryAuditRuns/'+auditId,run=h.data.get(root);
    assert.equal(run.schemaVersion,2);
    assert.equal(run.canonicalRevision,2);
    assert.equal(run.sourceRevision,3);
    assert.equal(run.namespaceVersion,3);
    const result=await recovery.prepareInventory(request(),{auditId,expectedEpoch:1,operationId:'hero-proof-inventory-prepare-01'});
    assert.equal(result.authoritativeStateReady,false);
    const inventory=h.data.get(root+'/captureState/current');
    assert.equal(inventory.schemaVersion,2);
    assert.equal(inventory.canonicalRevision,2);
    assert.equal(inventory.sourceRevision,3);
    assert.equal(inventory.namespaceVersion,3);
    assert.equal(inventory.namespaceListSha256,snapshotDigest(recoveryAuditNamespaces(h.uid,3)));
    assert.equal(h.data.has(h.root+'/recoveryArchives/3'),false);
});

test('original retained-control proof closes mixed old and Hero audit history against each original canonical archive',async()=>{
    const oldApproval='hero-proof-old-approval-0001',oldAudit='hero-proof-old-audit-00001';
    const {h,deps,request}=await heroFixture(async({h,deps,request})=>{
        const approvals=createCanonicalRecoveryApproval({...deps,now:()=>h.clock});
        await approvals.issue({auth:{uid:'hero-proof-operator',token:{cloudSaveOperator:true}},data:{
            ownerUid:h.uid,operationId:oldApproval,sourceRevision:2,ttlSeconds:60}});
        const recovery=createCanonicalCurrentRecovery({...deps,now:()=>h.clock});
        await recovery.beginAudit(request(),{operationId:oldAudit,expectedRevision:2,approvalOperationId:oldApproval});
        await recovery.cancelAudit(request(),{auditId:oldAudit,expectedEpoch:1,operationId:'hero-proof-old-cancel-00001'});
    });
    const approvalId='hero-proof-new-approval-0001',auditId='hero-proof-new-audit-00001';
    await createCanonicalRecoveryApproval({...deps,now:()=>h.clock}).issue({
        auth:{uid:'hero-proof-operator',token:{cloudSaveOperator:true}},data:{
            ownerUid:h.uid,operationId:approvalId,sourceRevision:3,canonicalRevision:2,ttlSeconds:60}});
    await createCanonicalCurrentRecovery({...deps,now:()=>h.clock}).beginAudit(request(),{
        operationId:auditId,expectedRevision:3,approvalOperationId:approvalId});
    const owner=proofOwnerForTest({...deps,now:()=>h.clock});
    const verify=async()=>h.dependencies.db.runTransaction(async tx=>{
        const root=h.dependencies.db.collection('serverUsers').doc(h.uid),names=['recoveryApprovals','recoveryAuditRuns','recoveryAuditFence','operations'];
        const snapshots=await Promise.all(names.map(name=>tx.get(root.collection(name))));
        const rows=new Map(names.map((name,i)=>[name,snapshots[i]]));
        return owner.verifyRetainedAuditControls({tx,root,rows:name=>rows.get(name),auditControl:{auditId,epoch:2}},
            h.uid,3,rows.get('operations'),[]);
    });
    const before=copy([...h.data]),writes=h.writes;
    await verify();
    assert.deepEqual([...h.data],before);assert.equal(h.writes,writes);
    const path=h.root+'/recoveryAuditRuns/'+oldAudit,run=h.data.get(path);
    h.data.set(path,{...run,schemaVersion:2,canonicalRevision:2,namespaceVersion:3});
    await assert.rejects(verify(),/source or epoch differs/);
    assert.equal(h.writes,writes);
});

function proofOwnerForTest(deps){
    const filename=require.resolve('../functions/src/canonical-current-recovery'),compiled=new Module(filename);
    compiled.filename=filename;compiled.paths=Module._nodeModulePaths(dirname(filename));
    const original=readFileSync(filename,'utf8'),marker='return Object.freeze({restoreCurrent,verifyRecoveryAuditArtifact,';
    assert.equal(original.split(marker).length,2);
    compiled._compile(original.replace(marker,'return Object.freeze({verifyRetainedAuditControls,verifySegmentedRawRecoveryProof,restoreCurrent,verifyRecoveryAuditArtifact,'),filename);
    return compiled.exports.createCanonicalCurrentRecovery(deps);
}

// The fake SDK exposes query metadata. Only this test reference facade adds
// the public native isEqual method; production never inspects fake internals.
function queryDb(db){
    const reference=row=>({path:row.path,id:row.id,collection:name=>query(row.collection(name))});
    const query=row=>({path:row.path,doc:id=>reference(row.doc(id)),limit:n=>query(row.limit(n)),
        where:(...args)=>query(row.where(...args)),orderBy:(...args)=>query(row.orderBy(...args)),
        key:JSON.stringify([row.path,row.filters,row.maximum,row.order]),
        isEqual:other=>other?.isEqual instanceof Function&&other.key===JSON.stringify([row.path,row.filters,row.maximum,row.order])});
    return {collection:name=>query(db.collection(name)),doc:path=>reference(db.doc(path))};
}

async function completeHeroRawCapture(afterHero,beforeHero){
    const f=await heroFixture(beforeHero),{h,deps,request}=f,approvalId='hero-full-raw-approval-0001',auditId='hero-full-raw-audit-00001';
    if(afterHero)await afterHero(f);
    const envelopeRevision=h.revision,canonicalRevision=h.data.get(h.root+'/account/current').serverRevision;
    await createCanonicalRecoveryApproval({...deps,now:()=>h.clock}).issue({auth:{uid:'hero-proof-operator',token:{cloudSaveOperator:true}},
        data:{ownerUid:h.uid,operationId:approvalId,sourceRevision:envelopeRevision,canonicalRevision,ttlSeconds:60}});
    const recovery=createCanonicalCurrentRecovery({...deps,now:()=>h.clock});
    await recovery.beginAudit(request(),{operationId:auditId,expectedRevision:envelopeRevision,approvalOperationId:approvalId});
    const epoch=h.data.get(h.root+'/recoveryAuditRuns/'+auditId).epoch;
    await recovery.prepareInventory(request(),{auditId,expectedEpoch:epoch,operationId:'hero-full-inventory-prepare'});
    const root=h.root+'/recoveryAuditRuns/'+auditId;
    for(let sequence=1;!h.data.get(root+'/captureState/current').inventoryExhausted;sequence++){
        assert.ok(sequence<150,'bounded original empty-terminal inventory');
        await recovery.captureInventoryPage(request(),{auditId,expectedEpoch:epoch,operationId:'hero-full-inventory-'+String(sequence).padStart(4,'0'),expectedSequence:sequence});
    }
    const state=copy(h.data.get(root+'/captureState/current'));
    let ordinal=0;
    for(let sequence=1;ordinal<state.capturedCount;sequence++){
        const result=await recovery.captureRawInventory(request(),{auditId,expectedEpoch:epoch,operationId:'hero-full-raw-capsule-'+String(sequence).padStart(4,'0'),
            expectedSequence:sequence,startOrdinal:ordinal,count:Math.min(16,state.capturedCount-ordinal)});
        ordinal=result.nextOrdinal;
    }
    const rows=name=>[...h.data].filter(([path])=>path.startsWith(root+'/'+name+'/')).map(([path,row])=>({id:path.split('/').at(-1),row:copy(row)}));
    const material={binding:{ownerUid:h.uid,auditId,epoch,sourceRevision:envelopeRevision,canonicalRevision,namespaceVersion:3,inventoryStateSha256:state.stateSha256},
        run:copy(h.data.get(root)),inventoryState:state,inventoryPages:rows('inventoryPages'),rawState:copy(h.data.get(root+'/proofState/current')),
        rawReceipts:rows('patrolProofPages'),rawChunks:rows('proofPayloadChunks')};
    return {...f,material};
}

test('genuine Hero histories traverse original inventory and raw capture into complete original rights proof',async t=>{
    for(const comprehensive of [false,true]){
        const f=await completeHeroRawCapture(comprehensive?async({h,deps,request,refreshSession})=>{
            const acquisition=createHeroAcquisition({...deps,now:()=>h.clock,seed:()=>1});
            const growth=createHeroGrowth({...deps,acquisition,now:()=>h.clock,seed:()=>2});
            const intent=extra=>({...request(),data:{...request().data,expectedRevision:h.revision,...extra}});
            const daily=()=>{const periodDate=require('../functions/src/daily-checkin-policy').taipeiDay(h.clock);
                return growth.claimDailySupply(intent({periodDate,operationId:'hero-daily-supply-v1-'+periodDate}));};
            await daily();
            for(let day=2;day<=7;day++){
                h.advance(86400000);await refreshSession();await acquisition.observeLogin(intent());
            }
            const policy=require('../functions/src/generated/hero-chapter-qualification.json');
            await acquisition.ensureChapterTicket(intent());
            for(let count=0;count<33;count++){
                const state=await acquisition.read(request());
                if(state.chapter.phase==='completed')break;
                assert.ok(count<32);
                const node=policy.nodes.find(row=>row.id===state.chapter.nextNodeId);
                await acquisition.completeChapterNode(intent({ticketId:state.chapter.ticketId,nodeId:node.id,
                    choiceId:node.type==='branch'?node.branches[0].id:null}));
            }
            await daily();
            await growth.mutate(intent({operationId:'hero-full-growth-reroll-0001',action:'reroll',heroId:'divineDogHongbao'}));
        }:null);
        const {h,deps,material}=f,before=copy([...h.data]),writes=h.writes;
        const result=await proofOwnerForTest({...deps,db:queryDb(h.dependencies.db),now:()=>h.clock}).verifySegmentedRawRecoveryProof(material);
        assert.equal(result.segmentedProofValid,true);
        assert.equal(result.canonicalRevision,material.binding.canonicalRevision);
        for(const key of ['authoritativeStateReady','candidateProofValid','trustedCaptureVerified','restoreAuthorized'])assert.equal(result[key],false);
        assert.deepEqual([...h.data],before);assert.equal(h.writes,writes);
        assert.equal(h.data.has(h.root+'/recoveryArchives/3'),false);
        assert.ok(result.residentUsage.maxUnitReads<=60);
        t.diagnostic(JSON.stringify({comprehensive,canonicalRevision:result.canonicalRevision,envelopeRevision:result.sourceRevision,
            usage:result.assemblyUsage,maxUnitReads:result.residentUsage.maxUnitReads}));
    }
});

test('complete Hero capture cannot hide a lost ledger or an unused renewal source behind a new valid seal',async()=>{
    for(const fault of ['ledger','unused-renewal']){
        const f=await completeHeroRawCapture(async({h,deps,request,refreshSession})=>{
            if(fault==='ledger'){
                const path=[...h.data].find(([path,row])=>path.startsWith(h.root+'/ledgerEntries/')&&row.kind==='hero-login-observation')[0];
                h.data.delete(path); // Deliberate source-loss negative, never a repair operation.
            }else{
                const acquisition=createHeroAcquisition({...deps,now:()=>h.clock,seed:()=>1});
                const intent=()=>({...request(),data:{...request().data,expectedRevision:h.revision}});
                const original=await acquisition.ensureChapterTicket(intent());
                h.advance(8*86400000);await refreshSession();
                await acquisition.ensureChapterTicket(intent());
                h.data.delete(h.root+'/heroChapterTickets/'+original.chapter.ticketId);
            }
        });
        const {h,deps,material}=f,before=copy([...h.data]),writes=h.writes;
        await assert.rejects(proofOwnerForTest({...deps,db:queryDb(h.dependencies.db),now:()=>h.clock}).verifySegmentedRawRecoveryProof(material),
            fault==='ledger'?/Hero acquisition history or revision is incomplete/:/complete versioned retained proof/);
        assert.deepEqual([...h.data],before);assert.equal(h.writes,writes);
    }
});

test('Hero capture cannot be downgraded to a retained raw format by removing the namespace and canonical cut',async()=>{
    const {h,deps,material}=await completeHeroRawCapture();
    delete material.binding.namespaceVersion;delete material.binding.canonicalRevision;
    const before=copy([...h.data]),writes=h.writes;
    await assert.rejects(proofOwnerForTest({...deps,db:queryDb(h.dependencies.db),now:()=>h.clock}).verifySegmentedRawRecoveryProof(material),/raw capture run differs/);
    assert.deepEqual([...h.data],before);assert.equal(h.writes,writes);
});


test('full Hero raw proof closes cancelled legacy audit and current versioned audit together',async()=>{
    const f=await completeHeroRawCapture(null,async({h,deps,request})=>{
        const operationId='hero-full-legacy-approval-001',auditId='hero-full-legacy-audit-00001';
        await createCanonicalRecoveryApproval({...deps,now:()=>h.clock}).issue({
            auth:{uid:'hero-proof-operator',token:{cloudSaveOperator:true}},
            data:{ownerUid:h.uid,operationId,sourceRevision:2,ttlSeconds:60}});
        const recovery=createCanonicalCurrentRecovery({...deps,now:()=>h.clock});
        await recovery.beginAudit(request(),{operationId:auditId,expectedRevision:2,approvalOperationId:operationId});
        await recovery.cancelAudit(request(),{auditId,expectedEpoch:1,operationId:'hero-full-legacy-cancel-001'});
    });
    const {h,deps,material}=f,before=copy([...h.data]),writes=h.writes;
    assert.equal(material.binding.epoch,2);
    const result=await proofOwnerForTest({...deps,db:queryDb(h.dependencies.db),now:()=>h.clock}).verifySegmentedRawRecoveryProof(material);
    assert.equal(result.segmentedProofValid,true);
    assert.deepEqual([...h.data],before);assert.equal(h.writes,writes);
});

test('extra orphan Hero ledger or claim cannot acquire rights through a valid raw seal',async()=>{
    for(const collection of ['ledgerEntries','uniqueClaims']){
        const {h,deps,material}=await completeHeroRawCapture(async({h})=>{
            const original=[...h.data].find(([path,row])=>path.startsWith(h.root+'/ledgerEntries/')&&row.kind==='hero-login-observation')[1];
            h.data.set(h.root+'/'+collection+'/hero-orphan-evidence-0001',copy(original));
        });
        const before=copy([...h.data]),writes=h.writes;
        await assert.rejects(proofOwnerForTest({...deps,db:queryDb(h.dependencies.db),now:()=>h.clock}).verifySegmentedRawRecoveryProof(material));
        assert.deepEqual([...h.data],before);assert.equal(h.writes,writes);
    }
});
