import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../functions/index.js',import.meta.url),'utf8');
class HttpsError extends Error{constructor(code,message,details){super(message);this.code=code;this.details=details;}}
const between=(start,end)=>{
    assert.equal(source.split(start).length,2);assert.equal(source.split(end).length,2);
    return source.slice(source.indexOf(start),source.indexOf(end));
};
function harness({decoded={uid:'owner',auth_time:100},verifyError,user,maintenanceError}={}){
    const calls=[],settings={},context={exports:{},HttpsError,console:{error(){}},
        CloudSavePolicyError:class extends Error{},CloudSaveEnvelopeError:class extends Error{},CloudPreferencesError:class extends Error{},
        setGlobalOptions:options=>{settings.global=options;},
        onCall:(options,handler)=>{settings.callable=options;return handler;},
        getAdminAuth:()=>({async verifyIdToken(token,revoked){calls.push(['verify',token,revoked]);if(verifyError)throw verifyError;return decoded;},
            async getUser(uid){calls.push(['user',uid]);return user;}}),
        recoveryMaintenance:{async maintain(request){calls.push(['maintain',request]);if(maintenanceError)throw maintenanceError;return {ok:true};}}};
    vm.createContext(context);
    vm.runInContext(between('const REGION=','function requireUid')+
        between('function requireUid','function authProvider')+
        between('function asHttpsError','function publicSaveRef')+
        between('async function verifyGameIdentity','exports.createGameSession')+
        between('exports.maintainCanonicalRecoveryAudit','exports.createInitialCanonicalCharacter'),context,{timeout:1000});
    return {calls,settings,invoke:context.exports.maintainCanonicalRecoveryAudit};
}
const request=()=>({auth:{uid:'owner',token:{cloudSaveOperator:true,auth_time:999}},
    rawRequest:{headers:{authorization:'Bearer signed-token'}},
    data:{uid:'owner',session:{sessionId:'current'},action:'resume',intent:{}}});
const plain=value=>JSON.parse(JSON.stringify(value));

test('maintenance alone has its dedicated identity and bounded callable options; original defaults remain',()=>{
    const h=harness();
    assert.deepEqual(plain(h.settings.global),{region:'us-central1',memory:'256MiB',timeoutSeconds:30,maxInstances:10});
    const {cors,...options}=h.settings.callable;
    assert.deepEqual(plain(options),{region:'us-central1',memory:'1GiB',timeoutSeconds:180,maxInstances:1,concurrency:1,
        serviceAccount:'cloud-save-recovery@four-symbols-jianghu.iam.gserviceaccount.com'});
    assert.equal(cors.length,3);assert.equal(cors[0],'https://dev.four-symbols-dev.pages.dev');
    assert.equal(cors[1],'https://tf00913225-alt.github.io');
    assert.ok(cors[2].test('http://localhost:8000'));assert.equal(cors[2].test('https://foreign.example'),false);
});

test('maintenance uses original signed and revocation-checked identity before dispatch',async()=>{
    const decoded={uid:'owner',auth_time:100,cloudSaveOperator:false},h=harness({decoded}),req=request();
    assert.deepEqual(await h.invoke(req),{ok:true});
    assert.deepEqual(h.calls[0],['verify','signed-token',true]);assert.equal(h.calls.length,2);
    const received=h.calls[1][1];assert.equal(received.auth.token,decoded);
    assert.equal(received.data,req.data);assert.equal(received.auth.token.cloudSaveOperator,false);
});

test('missing, revoked and mismatched identities never reach maintenance',async()=>{
    const cases=[{change:r=>{r.auth=null;}},{change:r=>{delete r.rawRequest.headers.authorization;}},
        {change:r=>{r.rawRequest.headers.authorization='Basic token';}},
        {verifyError:Error('revoked')},{decoded:{uid:'foreign'}}];
    for(const value of cases){const h=harness(value),req=request();value.change?.(req);
        await assert.rejects(()=>h.invoke(req),{code:'unauthenticated'});
        assert.equal(h.calls.some(call=>call[0]==='maintain'),false);
    }
});

test('native bridge source revocation remains enforced and original maintenance errors survive',async()=>{
    const decoded={uid:'owner',auth_time:110,authBridge:'android-facebook',sessionSourceAuthTime:100};
    const bad=harness({decoded,user:{tokensValidAfterTime:new Date(101000).toISOString()}});
    await assert.rejects(()=>bad.invoke(request()),{code:'unauthenticated'});
    assert.equal(bad.calls.some(call=>call[0]==='maintain'),false);
    const failure=new HttpsError('aborted','revision conflict',{code:'CLOUD_REVISION_CONFLICT'});
    const good=harness({decoded,user:{tokensValidAfterTime:new Date(99000).toISOString()},maintenanceError:failure});
    await assert.rejects(()=>good.invoke(request()),error=>error===failure);
    assert.deepEqual(good.calls.map(call=>call[0]),['verify','user','maintain']);
});
