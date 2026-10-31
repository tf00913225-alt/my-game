import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const startup=read('js/52-v173.20-startup-loader.js');
const tick=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
function fixture({state='OFFLINE_READY',cloud,session={uid:'uid-a',status:'active',sessionId:'session-a'}}={}){
    const events=new Map(),timers=new Map(),messages=[],calls=[],writes=[];
    let timerId=0,user={uid:'uid-a'},currentSession=session;
    const local={status:'ready',save:{player:{id:'character-a'},gold:10},metadata:{ownerUid:'uid-a',cloudBaseFingerprint:'base',localDirty:true}};
    const repo={getActiveUid:()=>user?.uid,readForUid:()=>structuredClone(local),fingerprint:JSON.stringify,inspectCloudBundle:(_,bundle)=>bundle,
        writeForUid:()=>writes.push('write'),activate:()=>writes.push('activate'),deactivate:()=>writes.push('deactivate')};
    const firebase={getUser:()=>user,getGameSessionState:()=>currentSession,
        resolveCloudSave:(...args)=>{calls.push(args);return cloud?cloud(...args):Promise.resolve({uid:'uid-a',exists:true,serverConfirmed:true,data:{ownerUid:'uid-a',authoritativeStateReady:true,serverRevision:4,gameSave:structuredClone(local.save)}});},
        setUiState:value=>messages.push(value),openAuth:()=>messages.push('open'),closeAuth:()=>messages.push('close')};
    const context={console,Promise,JSON,Object,String,Number,Error,CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}},
        document:{getElementById:()=>null,dispatchEvent:()=>{},readyState:'complete'},navigator:{onLine:true},
        setTimeout:(fn,ms)=>{timers.set(++timerId,{fn,ms});return timerId;},clearTimeout:id=>timers.delete(id),
        addEventListener:(name,fn)=>{if(!events.has(name))events.set(name,[]);events.get(name).push(fn);},
        FourSymbolsAccountSave:repo,__fixture:{firebase,user,state},location:{reload:()=>writes.push('reload')}};
    context.window=context;vm.createContext(context);vm.runInContext(read('js/00-main.js').split('/* ACCOUNT_SAVE_OPERATIONS_OWNER_BEGIN */')[1].split('/* ACCOUNT_SAVE_OPERATIONS_OWNER_END */')[0],context);vm.runInContext(read('js/startup/startup-contract.js'),context);
    const retryBranch=startup.slice(startup.indexOf('                if(action==="retry"'),startup.indexOf('                if(action==="confirm-migration"'));
    vm.runInContext(startup.replace('    void boot();',`    firebase=global.__fixture.firebase;activeUser=global.__fixture.user;resolvedUid=activeUser.uid;state=global.__fixture.state;saveResolved=true;global.__fixture.auth=onAuth;global.__fixture.retryAction=()=>{const action="retry";${retryBranch}};`),context);
    return {context,local,calls,writes,messages,timers,policy:context.FourSymbolsStartupPolicy,
        fire:async(name,detail)=>{for(const fn of events.get(name)||[])fn({detail});await tick();},
        user:value=>{user=value;},session:value=>{currentSession=value;}};
}
test('actual startup Owner observes online once and only confirms cloud read without mutating local state',async()=>{
    const f=fixture(),before=structuredClone(f.local);await f.fire('online');
    assert.equal(f.calls.length,1,'OFFLINE_READY reconnect must perform one read');
    assert.equal(f.calls[0][1].serverOnly,true);assert.equal(f.policy.getState(),'OFFLINE_READY');
    assert.equal(f.policy.getReconnectState().status,'confirmed');assert(Object.isFrozen(f.policy.getReconnectState()));
    assert.deepEqual(f.local,before);assert.deepEqual(f.writes,[]);assert.equal(f.messages.includes('open'),false);
    await f.fire('online');assert.equal(f.calls.length,1);
    f.policy.openAccountManager();assert.match(f.messages.at(-2).message,/本機/);
});

test('complete-bundle reconnect compares actual local sidecars rather than only retained metadata',async()=>{
    let bundle;
    const f=fixture({cloud:async()=>({uid:'uid-a',exists:true,serverConfirmed:true,data:{ownerUid:'uid-a',
        authoritativeStateReady:true,serverRevision:4,cloudBundle:bundle}})});
    bundle={serverRevision:4,gameSave:structuredClone(f.local.save),sidecars:{progress:{status:'present',raw:'{"eliteKills":0}'}}};
    f.local.save.lastSaveTimestamp=123;f.local.metadata.localDirty=false;
    f.local.metadata.cloudState={serverRevision:4,sidecarsFingerprint:'original-sidecars',
        normalizedMainFingerprint:JSON.stringify(f.local.save),
        bundleFingerprint:JSON.stringify({gameSave:bundle.gameSave,sidecars:bundle.sidecars})};
    f.local.cloudSidecarsFingerprint='original-sidecars';
    await f.fire('online');assert.equal(f.policy.getReconnectState().status,'confirmed');
    await f.fire('offline');f.local.cloudSidecarsFingerprint='changed-actual-sidecars';
    await f.fire('online');assert.equal(f.policy.getReconnectState().status,'conflict');assert.deepEqual(f.writes,[]);
    await f.fire('offline');f.local.cloudSidecarsFingerprint='original-sidecars';f.local.save.gold++;
    await f.fire('online');assert.equal(f.policy.getReconnectState().status,'conflict');assert.deepEqual(f.writes,[]);
});
test('single flight, timeout and offline epochs discard late results while keeping bytes and startup state',async()=>{
    const pending=[];const f=fixture({cloud:()=>new Promise(resolve=>pending.push(resolve))});
    await f.fire('online');await f.fire('online');assert.equal(f.calls.length,1);
    const timeout=[...f.timers.values()].find(row=>row.ms===15000);assert(timeout);timeout.fn();await tick();
    assert.equal(f.policy.getReconnectState().status,'unconfirmed');
    pending[0]({uid:'uid-a',exists:true,serverConfirmed:true,data:{authoritativeStateReady:true,gameSave:f.local.save}});await tick();
    assert.equal(f.policy.getReconnectState().status,'unconfirmed');
    await f.fire('offline');await f.fire('online');assert.equal(f.calls.length,2);
    await f.fire('offline');pending[1]({uid:'uid-a',exists:false,serverConfirmed:true});await tick();
    assert.deepEqual(f.writes,[]);assert.equal(f.policy.getState(),'OFFLINE_READY');
});
test('server pending/missing/non-authoritative/conflicts never claim synchronization or replace local data',async()=>{
    for(const cloud of [
        {uid:'uid-a',exists:true,serverConfirmed:false,data:{}},
        {uid:'uid-a',exists:false,serverConfirmed:true},
        {uid:'uid-a',exists:true,serverConfirmed:true,data:{authoritativeStateReady:false}},
        {uid:'uid-a',exists:true,serverConfirmed:true,data:{authoritativeStateReady:true,gameSave:{player:{id:'other'}}}}
    ]){
        const f=fixture({cloud:async()=>cloud}),before=structuredClone(f.local);await f.fire('online');
        assert.notEqual(f.policy.getReconnectState().status,'confirmed');assert.equal(f.messages.includes('open'),true);
        assert.equal(f.policy.getState(),'OFFLINE_READY');assert.deepEqual(f.local,before);assert.deepEqual(f.writes,[]);
    }
});
test('UID/session takeover, local changes and blocked sessions cannot accept stale reconnect evidence',async()=>{
    for(const change of ['uid','session','local']){
        let resolve;const f=fixture({cloud:()=>new Promise(r=>{resolve=r;})});await f.fire('online');
        if(change==='uid')f.user({uid:'uid-b'});
        if(change==='session')f.session({uid:'uid-a',status:'blocked',code:'SESSION_REVOKED'});
        if(change==='local')f.local.save.gold++;
        resolve({uid:'uid-a',exists:true,serverConfirmed:true,data:{authoritativeStateReady:true,gameSave:structuredClone(f.local.save)}});await tick();
        assert.notEqual(f.policy.getReconnectState().status,'confirmed');assert.deepEqual(f.writes,[]);
    }
    const f=fixture({session:{status:'blocked',uid:'uid-a'}});await f.fire('online');assert.equal(f.calls.length,0);
});
test('READY needs a same-UID offline cycle and OFFLINE_READY retry stays read-only',async()=>{
    const f=fixture({state:'READY'});await f.fire('online');assert.equal(f.calls.length,0);
    await f.fire('offline');await f.fire('online');assert.equal(f.calls.length,1);assert.equal(f.policy.getState(),'READY');
    const offline=fixture();await offline.policy.retry();assert.equal(offline.calls.length,1);assert.equal(offline.policy.getState(),'OFFLINE_READY');assert.deepEqual(offline.writes,[]);
});
test('foreign/missing owner and non-current revision cannot be reported as confirmed',async()=>{
    for(const fields of [{ownerUid:'foreign',serverRevision:1},{serverRevision:1},{ownerUid:'uid-a'},
        ...[0,-1,1.5,'1',Number.MAX_SAFE_INTEGER].map(serverRevision=>({ownerUid:'uid-a',serverRevision}))]){
        const f=fixture({cloud:async()=>({uid:'uid-a',exists:true,serverConfirmed:true,data:{...fields,authoritativeStateReady:true,gameSave:{player:{id:'character-a'},gold:10}}})});
        await f.fire('online');assert.equal(f.policy.getReconnectState().status,'unconfirmed');assert.deepEqual(f.writes,[]);
    }
});
test('same-UID Auth error invalidates the pending response and preserves its ERROR message',async()=>{
    let resolve;const f=fixture({cloud:()=>new Promise(r=>{resolve=r;})});await f.fire('online');
    f.context.__fixture.auth({user:{uid:'uid-a'},error:new Error('auth unavailable')});
    const messages=JSON.stringify(f.messages);assert.equal(f.policy.getState(),'ERROR');
    resolve({uid:'uid-a',exists:true,serverConfirmed:true,data:{ownerUid:'uid-a',serverRevision:4,authoritativeStateReady:true,gameSave:f.local.save}});await tick();
    assert.equal(f.policy.getState(),'ERROR');assert.equal(JSON.stringify(f.messages),messages);assert.deepEqual(f.writes,[]);
});
test('READY offline conflict retries through both API and actual account-action branch without save resolution',async()=>{
    const f=fixture({state:'READY',cloud:async()=>({uid:'uid-a',exists:true,serverConfirmed:true,data:{ownerUid:'uid-a',serverRevision:4,authoritativeStateReady:true,gameSave:{player:{id:'other'}}}})});
    await f.fire('offline');await f.fire('online');assert.equal(f.policy.getReconnectState().status,'conflict');
    await f.policy.retry();f.context.__fixture.retryAction();await tick();assert.equal(f.calls.length,3);
    assert.equal(f.policy.getState(),'READY');assert.deepEqual(f.writes,[]);
});
const stripImports=source=>source.replace(/^import\s+[\s\S]*?\s+from\s+"[^"]+";\s*/gm,'');
test('real Firestore read Owner preserves default shape and requires explicit server metadata on server-only reads',async()=>{
    let exists=true,metadata={fromCache:false,hasPendingWrites:false},cached=0,server=0;
    const snapshot=()=>({exists:()=>exists,data:()=>({serverRevision:7}),metadata});
    const c={console,Object,Error,TextEncoder,window:{},initializeFirebaseAuth:async()=>{},getFirebaseApp:()=>({}),
        getFirebaseAuth:()=>({currentUser:{uid:'uid-a'}}),getFirestore:()=>({}),doc:()=>({path:'users/uid-a/saves/current'}),
        getDoc:async()=>{cached++;return snapshot();},getDocFromServer:async()=>{server++;return snapshot();}};
    vm.createContext(c);vm.runInContext(stripImports(read('js/firebase/firebase-cloud-save.js')).replace(/^export \{[^}]+\};/gm,'').replace(/\bexport (?=async function|const|function)/g,'')+'\nglobalThis.readCloud=readCurrentCloudSave;',c);
    const plain=await c.readCloud();assert.equal(cached,1);assert.equal(server,0);assert.deepEqual(Object.keys(plain),['exists','uid','path','data']);
    assert.equal((await c.readCloud({serverOnly:true})).serverConfirmed,true);assert.equal(server,1);
    for(const value of [undefined,{fromCache:true,hasPendingWrites:false},{fromCache:false,hasPendingWrites:true},{fromCache:false}]){
        metadata=value;await assert.rejects(c.readCloud({serverOnly:true}),e=>e.code==='cloud-server-unconfirmed');
    }
    exists=false;metadata={fromCache:false,hasPendingWrites:false};assert.equal((await c.readCloud({serverOnly:true})).serverConfirmed,true);
    assert.deepEqual(Object.keys(await c.readCloud()),['exists','uid','path','data']);
});
test('real Firebase lifecycle forwards server-only options and fences UID/generation before and after awaits',async()=>{
    const source=read('js/firebase/firebase-bootstrap.js'),imports=[...source.matchAll(/^import\s+\{([\s\S]*?)\}\s+from\s+"[^"]+";/gm)].flatMap(m=>m[1].split(',').map(s=>s.trim()));
    let user={uid:'uid-a'},resolve,observer,reads=0,options;
    const c={console,Object,String,Promise,Error,CustomEvent:class{constructor(type,value){this.type=type;this.detail=value.detail;}}};
    for(const name of imports)c[name]=()=>{};
    Object.assign(c,{getSignedInUser:()=>user,getFirebaseAuthConfigStatus:()=>({ready:true}),initializeFirebaseAuth:async()=>{},
        observeFirebaseAuthState:async callback=>{observer=callback;return ()=>{};},synchronizeGameSession:async()=>{},
        readCurrentCloudSave:value=>{reads++;options=value;return new Promise(r=>{resolve=r;});},
        addEventListener:()=>{},dispatchEvent:()=>{}});c.window=c;vm.createContext(c);vm.runInContext(stripImports(source),c);
    const api=c.FourSymbolsFirebaseLifecycle;await api.initialize();
    const first=api.resolveCloudSave(user,{serverOnly:true});assert.equal(options.serverOnly,true);user={uid:'uid-b'};resolve({});
    await assert.rejects(first,e=>e.code==='firebase/account-changed');
    await assert.rejects(api.resolveCloudSave({uid:'uid-a'},{serverOnly:true}),e=>e.code==='firebase/account-changed');assert.equal(reads,1);
    user={uid:'uid-a'};const second=api.resolveCloudSave(user,{serverOnly:true});observer(user);resolve({});
    await assert.rejects(second,e=>e.code==='firebase/account-changed');
});
