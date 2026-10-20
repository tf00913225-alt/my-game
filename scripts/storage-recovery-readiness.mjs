import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

const PROJECT='four-symbols-jianghu';
const BUCKET='four-symbols-jianghu.firebasestorage.app';
const FUNCTION=`projects/${PROJECT}/locations/us-central1/functions/restoreCanonicalCurrent`;
const OUTPUT='artifacts/recovery/storage-readiness.json';
const UNKNOWN='UNKNOWN';
const commands=Object.freeze([
    ['storage','buckets','describe',`gs://${BUCKET}`,'--raw',`--project=${PROJECT}`,'--format=json'],
    ['storage','buckets','get-iam-policy',`gs://${BUCKET}`,`--project=${PROJECT}`,'--format=json'],
    ['functions','describe','restoreCanonicalCurrent','--v2','--region=us-central1',`--project=${PROJECT}`,
        '--format=json(name,state,serviceConfig.serviceAccountEmail,serviceConfig.service,updateTime)']
].map(args=>Object.freeze(args)));
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const text=(value,pattern)=>typeof value==='string'&&pattern.test(value)?value:UNKNOWN;
const boolean=value=>typeof value==='boolean'?value:UNKNOWN;
const decimal=value=>text(value,/^\d{1,24}$/);
const instant=value=>typeof value==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,9})?Z$/.test(value)&&Number.isFinite(Date.parse(value))?value:UNKNOWN;
const unavailable=reason=>({status:'UNVERIFIED',reason});
function response(result){
    if(result?.error?.code==='ENOENT')return unavailable('COMMAND_UNAVAILABLE');
    if(result?.error?.code==='ETIMEDOUT')return unavailable('COMMAND_TIMEOUT');
    if(result?.error)return unavailable('COMMAND_FAILED');
    if(result?.status!==0){
        // Classify privately; never emit the raw CLI response or error text.
        const error=typeof result?.stderr==='string'?result.stderr:'';
        return unavailable(/\b403\b|PERMISSION_DENIED|permission denied|does not have/i.test(error)?'PERMISSION_DENIED':
            /\b404\b|NOT_FOUND|not found/i.test(error)?'NOT_FOUND':'COMMAND_FAILED');
    }
    try{
        if(typeof result.stdout!=='string'||Buffer.byteLength(result.stdout,'utf8')>512*1024)throw Error();
        const data=JSON.parse(result.stdout);
        if(!object(data))throw Error();
        return {status:'OBSERVED',data};
    }catch(_){return unavailable('MALFORMED_RESPONSE');}
}
export function inspectStorageRecoveryReadiness(results,context={}){
    const [bucketResult,policyResult,functionResult]=[0,1,2].map(index=>response(results?.[index]));
    let bucket=bucketResult,iam=policyResult,runtimeFunction=functionResult;
    if(bucketResult.status==='OBSERVED'){
        const data=bucketResult.data;
        if(data.name!==BUCKET||text(data.location,/^[A-Z0-9-]{1,64}$/)===UNKNOWN||
           decimal(data.projectNumber)===UNKNOWN||decimal(data.metageneration)===UNKNOWN){
            bucket=unavailable('BUCKET_IDENTITY_OR_METADATA_INVALID');
        }else bucket={status:'OBSERVED',name:BUCKET,projectNumber:data.projectNumber,
            location:data.location,locationType:text(data.locationType,/^(region|dual-region|multi-region)$/),
            metageneration:data.metageneration,
            publicAccessPrevention:['enforced','inherited'].includes(data.iamConfiguration?.publicAccessPrevention)?
                data.iamConfiguration.publicAccessPrevention:UNKNOWN,
            uniformBucketLevelAccess:{enabled:boolean(data.iamConfiguration?.uniformBucketLevelAccess?.enabled),
                lockedTime:instant(data.iamConfiguration?.uniformBucketLevelAccess?.lockedTime)},
            versioningEnabled:boolean(data.versioning?.enabled),
            retentionPolicy:{retentionPeriod:decimal(data.retentionPolicy?.retentionPeriod),
                isLocked:boolean(data.retentionPolicy?.isLocked),effectiveTime:instant(data.retentionPolicy?.effectiveTime)},
            softDeletePolicy:{retentionDurationSeconds:decimal(data.softDeletePolicy?.retentionDurationSeconds),
                effectiveTime:instant(data.softDeletePolicy?.effectiveTime)}};
    }
    if(functionResult.status==='OBSERVED'){
        const data=functionResult.data,email=data.serviceConfig?.serviceAccountEmail;
        if(data.name!==FUNCTION||text(email,/^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+\.gserviceaccount\.com$/)===UNKNOWN){
            runtimeFunction=unavailable('FUNCTION_IDENTITY_OR_RUNTIME_INVALID');
        }else runtimeFunction={status:'OBSERVED',name:FUNCTION,
            state:text(data.state,/^(ACTIVE|FAILED|DEPLOYING|DELETING|UNKNOWN)$/),serviceAccountEmail:email,
            service:text(data.serviceConfig?.service,/^projects\/[A-Za-z0-9-]+\/locations\/us-central1\/services\/[A-Za-z0-9-]+$/),
            updateTime:instant(data.updateTime)};
    }
    if(policyResult.status==='OBSERVED'){
        const bindings=policyResult.data.bindings;
        if(!Array.isArray(bindings)||bindings.some(binding=>!object(binding)||
           text(binding.role,/^(?:roles\/[A-Za-z0-9_.]+|(?:projects|organizations)\/[A-Za-z0-9-]+\/roles\/[A-Za-z0-9_.]+)$/)===UNKNOWN||
           !Array.isArray(binding.members)||binding.members.some(member=>typeof member!=='string')||
           (binding.condition!==undefined&&(!object(binding.condition)||typeof binding.condition.expression!=='string')))){
            iam=unavailable('IAM_POLICY_INVALID');
        }else{
            const runtime=runtimeFunction.status==='OBSERVED'?`serviceAccount:${runtimeFunction.serviceAccountEmail}`:null;
            const matchingRoles=[];
            for(const binding of bindings)for(const member of binding.members){
                if(!['allUsers','allAuthenticatedUsers',runtime].includes(member))continue;
                matchingRoles.push({principal:member,role:binding.role,conditional:binding.condition!==undefined,
                    ...(binding.condition===undefined?{}:{conditionSha256:createHash('sha256').update(binding.condition.expression,'utf8').digest('hex')})});
            }
            iam={status:'OBSERVED',scope:'BUCKET_POLICY_ONLY',matchingRoles,
                runtimePrincipal:runtime??UNKNOWN,privateAccess:UNKNOWN};
        }
    }
    return {schemaVersion:1,project:PROJECT,bucketName:BUCKET,
        observedAt:instant(context.observedAt),sourceSha:text(context.sourceSha,/^[a-f0-9]{40}$/),
        runId:decimal(context.runId),attempt:decimal(context.attempt),
        status:'UNVERIFIED',reason:'EFFECTIVE_ACCESS_AND_IMMUTABLE_ARTIFACT_NOT_VERIFIED',
        candidateStorageReady:false,bucket,iam,runtimeFunction,
        effectivePermissions:{create:UNKNOWN,read:UNKNOWN,delete:UNKNOWN,overwrite:UNKNOWN,metadataUpdate:UNKNOWN}};
}
export function collectStorageRecoveryReadiness({exec=spawnSync,context={}}={}){
    const results=commands.map(args=>{
        try{return exec('gcloud',args,{encoding:'utf8',shell:false,windowsHide:true,timeout:20000,maxBuffer:512*1024});}
        catch(_){return {status:1,error:{code:'EXECUTION_FAILED'}};}
    });
    return inspectStorageRecoveryReadiness(results,context);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
    const report=collectStorageRecoveryReadiness({context:{observedAt:new Date().toISOString(),
        sourceSha:process.env.GITHUB_SHA,runId:process.env.GITHUB_RUN_ID,attempt:process.env.GITHUB_RUN_ATTEMPT}});
    mkdirSync('artifacts/recovery',{recursive:true});
    writeFileSync(OUTPUT,JSON.stringify(report,null,2)+'\n','utf8');
    console.log(`Storage recovery readiness: UNVERIFIED; bucket metadata ${report.bucket.status}; bucket IAM ${report.iam.status}; runtime identity ${report.runtimeFunction.status}; effective permissions UNKNOWN. Evidence: ${OUTPUT}`);
}
