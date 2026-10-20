import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {inspectStorageRecoveryReadiness,collectStorageRecoveryReadiness} from '../scripts/storage-recovery-readiness.mjs';
const project='four-symbols-jianghu',bucket=project+'.firebasestorage.app';
const runtime='runtime-reader@four-symbols-jianghu.iam.gserviceaccount.com';
const context={observedAt:'2026-10-20T00:00:00.000Z',sourceSha:'a'.repeat(40),runId:'123',attempt:'2'};
const ok=value=>({status:0,stdout:JSON.stringify(value)});
const metadata=()=>({name:bucket,projectNumber:'123456789',metageneration:'7',location:'ASIA-EAST1',locationType:'region',
    iamConfiguration:{publicAccessPrevention:'enforced',uniformBucketLevelAccess:{enabled:true,lockedTime:'2026-11-20T00:00:00Z'}},
    versioning:{enabled:true},retentionPolicy:{retentionPeriod:'604800',isLocked:false,effectiveTime:'2026-10-19T00:00:00Z'},
    softDeletePolicy:{retentionDurationSeconds:'604800',effectiveTime:'2026-10-19T00:00:00Z'}});
const functionMetadata=()=>({name:`projects/${project}/locations/us-central1/functions/restoreCanonicalCurrent`,state:'ACTIVE',
    serviceConfig:{serviceAccountEmail:runtime,service:`projects/${project}/locations/us-central1/services/restorecanonicalcurrent`},
    updateTime:'2026-10-19T00:00:00Z'});
const policy=()=>({version:3,bindings:[{role:'roles/storage.objectViewer',members:['serviceAccount:'+runtime]},
    {role:'roles/storage.objectCreator',members:['serviceAccount:'+runtime],condition:{expression:'resource.name.startsWith("private/prefix/")'}}]});
const responses=()=>[ok(metadata()),ok(policy()),ok(functionMetadata())];

test('collector executes only the three exact fixed read commands with bounded subprocesses and no shell',()=>{
    const calls=[],results=responses();
    const report=collectStorageRecoveryReadiness({context,exec:(file,args,options)=>{
        calls.push({file,args:[...args],options});return results[calls.length-1];
    }});
    assert.deepEqual(calls.map(row=>[row.file,...row.args]),[
        ['gcloud','storage','buckets','describe','gs://'+bucket,'--raw','--project='+project,'--format=json'],
        ['gcloud','storage','buckets','get-iam-policy','gs://'+bucket,'--project='+project,'--format=json'],
        ['gcloud','functions','describe','restoreCanonicalCurrent','--v2','--region=us-central1','--project='+project,
            '--format=json(name,state,serviceConfig.serviceAccountEmail,serviceConfig.service,updateTime)']
    ]);
    for(const {options} of calls)assert.deepEqual(options,{encoding:'utf8',shell:false,windowsHide:true,timeout:20000,maxBuffer:512*1024});
    assert.equal(report.bucket.status,'OBSERVED');assert.equal(report.runtimeFunction.serviceAccountEmail,runtime);
    assert.equal(report.candidateStorageReady,false);assert.equal(report.status,'UNVERIFIED');
    assert.deepEqual(report.effectivePermissions,{create:'UNKNOWN',read:'UNKNOWN',delete:'UNKNOWN',overwrite:'UNKNOWN',metadataUpdate:'UNKNOWN'});
});

test('allowlisted metadata preserves observed settings without upgrading versioning, inherited PAP or bucket bindings to immutable/private access',()=>{
    const input=responses(),data=metadata();data.iamConfiguration.publicAccessPrevention='inherited';
    data.iamConfiguration.uniformBucketLevelAccess.enabled=false;input[0]=ok(data);
    const report=inspectStorageRecoveryReadiness(input,context);
    assert.equal(report.bucket.publicAccessPrevention,'inherited');assert.equal(report.bucket.uniformBucketLevelAccess.enabled,false);
    assert.equal(report.bucket.versioningEnabled,true);assert.equal(report.bucket.retentionPolicy.isLocked,false);
    assert.equal(report.iam.privateAccess,'UNKNOWN');assert.equal(report.candidateStorageReady,false);
    assert.equal(report.iam.matchingRoles.length,2);assert.equal(report.iam.matchingRoles[1].conditional,true);
    assert.match(report.iam.matchingRoles[1].conditionSha256,/^[a-f0-9]{64}$/);
    const sparse=metadata();delete sparse.versioning;delete sparse.retentionPolicy;delete sparse.iamConfiguration;
    const missing=inspectStorageRecoveryReadiness([ok(sparse),...input.slice(1)],context);
    assert.equal(missing.bucket.versioningEnabled,'UNKNOWN');assert.equal(missing.bucket.publicAccessPrevention,'UNKNOWN');
    assert.equal(missing.bucket.retentionPolicy.isLocked,'UNKNOWN');assert.equal(missing.status,'UNVERIFIED');
});

test('only public principals and the observed runtime match; deployment identity and unrelated IAM/environment/secret fields are never emitted',()=>{
    const secret='DO_NOT_OUTPUT_RAW_SECRET',data=metadata(),fn=functionMetadata(),iam=policy();
    data.accessToken=secret;data.labels={secret};fn.serviceConfig.environmentVariables={SECRET:secret};fn.privateKey=secret;
    iam.bindings.push({role:'roles/storage.objectAdmin',members:['allUsers','allAuthenticatedUsers',
        'serviceAccount:github-firebase-deployer@four-symbols-jianghu.iam.gserviceaccount.com',secret]});
    iam.bindings[1].condition.expression=secret;iam.etag=secret;
    const report=inspectStorageRecoveryReadiness([ok(data),ok(iam),ok(fn)],{...context,secret});
    const encoded=JSON.stringify(report);
    assert.equal(encoded.includes(secret),false);assert.equal(encoded.includes('github-firebase-deployer'),false);
    assert.deepEqual(report.iam.matchingRoles.slice(-2).map(row=>row.principal),['allUsers','allAuthenticatedUsers']);
    assert.equal(report.iam.privateAccess,'UNKNOWN');assert.equal(report.effectivePermissions.delete,'UNKNOWN');
});

test('permission, missing resource, missing executable, malformed and oversized responses are explicitly unverified without raw error text',()=>{
    for(const [result,reason] of [
        [{status:1,stderr:'403 PERMISSION_DENIED raw-secret'},'PERMISSION_DENIED'],
        [{status:1,stderr:'404 NOT_FOUND raw-secret'},'NOT_FOUND'],
        [{error:{code:'ENOENT',message:'raw-secret'}},'COMMAND_UNAVAILABLE'],
        [{error:{code:'ETIMEDOUT',message:'raw-secret'}},'COMMAND_TIMEOUT'],
        [{status:0,stdout:'raw-secret'},'MALFORMED_RESPONSE'],
        [ok([]),'MALFORMED_RESPONSE'],[{status:0,stdout:' '.repeat(512*1024+1)},'MALFORMED_RESPONSE'],
        [undefined,'COMMAND_FAILED']
    ]){
        const report=inspectStorageRecoveryReadiness([result,result,result],context);
        for(const section of ['bucket','iam','runtimeFunction'])assert.deepEqual(report[section],{status:'UNVERIFIED',reason});
        assert.equal(JSON.stringify(report).includes('raw-secret'),false);assert.equal(report.candidateStorageReady,false);
    }
    let calls=0;
    const thrown=collectStorageRecoveryReadiness({exec:()=>{calls++;throw Error('raw-secret');}});
    assert.equal(calls,3);assert.equal(thrown.bucket.reason,'COMMAND_FAILED');assert.equal(JSON.stringify(thrown).includes('raw-secret'),false);
});

test('foreign targets, missing runtime identity and malformed IAM cannot produce observed or effective permission evidence',()=>{
    for(const change of [data=>{data.name='other-bucket';},data=>{delete data.location;},data=>{data.projectNumber=1;}]){
        const data=metadata();change(data);
        assert.equal(inspectStorageRecoveryReadiness([ok(data),...responses().slice(1)],context).bucket.status,'UNVERIFIED');
    }
    const fn=functionMetadata();fn.name=fn.name.replace('restoreCanonicalCurrent','differentFunction');
    const foreign=inspectStorageRecoveryReadiness([...responses().slice(0,2),ok(fn)],context);
    assert.equal(foreign.runtimeFunction.status,'UNVERIFIED');assert.equal(foreign.iam.runtimePrincipal,'UNKNOWN');
    assert.deepEqual(foreign.iam.matchingRoles,[]);
    for(const data of [{},{bindings:'wrong'},{bindings:[{role:'roles/storage.objectViewer',members:1}]}])
        assert.equal(inspectStorageRecoveryReadiness([responses()[0],ok(data),responses()[2]],context).iam.status,'UNVERIFIED');
});

test('existing workflow retains authenticated read-only inspection, fixed JSON upload and original Firestore/deploy gates',()=>{
    const workflow=fs.readFileSync(new URL('../.github/workflows/session-authority.yml',import.meta.url),'utf8');
    const auth=workflow.indexOf('uses: google-github-actions/auth@v2'),storage=workflow.indexOf('name: Inspect Storage recovery readiness');
    assert.ok(auth>0&&storage>auth);
    assert.match(workflow,/run: node scripts\/storage-recovery-readiness\.mjs/);
    assert.match(workflow,/path: artifacts\/recovery\/storage-readiness\.json/);
    assert.equal(workflow.match(/- 'scripts\/storage-recovery-readiness\.mjs'/g).length,2);
    assert.match(workflow,/gcloud firestore databases describe/);assert.match(workflow,/gcloud firestore backups schedules list/);
    assert.match(workflow,/gcloud firestore backups list/);assert.match(workflow,/Require current dev and its Repository checks/);
    assert.match(workflow,/name: Deploy protected cloud endpoints and deny-write rules/);
    assert.match(workflow,/test "\$\(git ls-remote origin refs\/heads\/dev \| cut -f1\)" = "\$GITHUB_SHA"/);
});
