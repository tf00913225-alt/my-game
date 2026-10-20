import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {storeHarness,selection,copy} from '../scripts/test-helpers/canonical-store-harness.mjs';
const require=createRequire(import.meta.url);
const {createSessionAuthority}=require('../functions/src/session-authority');
const {createCanonicalSourceWriter}=require('../functions/src/canonical-source-writer');
const {createHeroAcquisition}=require('../functions/src/hero-acquisition');
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

async function heroFixture(){
    const h=storeHarness(),sessions=createSessionAuthority(h.dependencies);
    let session;
    const request=()=>({auth:{uid:h.uid,token:{auth_time:Math.floor(h.clock/1000)}},
        data:{uid:h.uid,...(session?{session}:{})}});
    session=await sessions.create(request());
    const deps={...h.dependencies,runProtected:sessions.runProtected,runRecoveryAuditMaintenance:sessions.runRecoveryAuditMaintenance};
    await createCanonicalSourceWriter(deps).commitInitialSources(request(),{
        operationId:'hero-proof-initial-operation-01',expectedRevision:1,selection});
    await createHeroAcquisition({...deps,now:()=>h.clock,seed:()=>1}).observeLogin({
        ...request(),data:{...request().data,expectedRevision:h.revision}});
    return {h,deps,request};
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
