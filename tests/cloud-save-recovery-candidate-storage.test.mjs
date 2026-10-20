import assert from 'node:assert/strict';
import fs from 'node:fs';
import Module from 'node:module';
import {EventEmitter} from 'node:events';
import {createHash} from 'node:crypto';
import test from 'node:test';
const filename=new URL('../functions/src/recovery-candidate-storage.js',import.meta.url);
const source=fs.readFileSync(filename,'utf8');
const bucketName='four-symbols-jianghu-recovery-private';
const objectName='private/recovery-candidates/v1/uid 中文%/audit-operation-0001/1/publication-operation1.csra';
const input={bucketName,objectName},bytes=Buffer.from('original immutable candidate bytes');
const md5=data=>createHash('md5').update(data).digest('base64');
const meta=(generation='9007199254740993',data=bytes)=>({bucket:bucketName,name:objectName,generation,size:String(data.length),md5Hash:md5(data)});
function harness(plans=[],{token=async()=>({access_token:'PRIVATE_TOKEN_DO_NOT_LEAK'}),concat=Buffer.concat}={}){
    const calls=[],timers=new Map();let serial=0,tokenCalls=0,now=0;
    const clock={setTimeout:(fn,ms)=>{assert.equal(ms,20000);const id=++serial;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id)};
    const fakeHttps={request(options,callback){
        const plan=plans.shift();assert(plan,'unexpected network request');
        const req=new EventEmitter(),parts=[];req.destroyed=false;
        req.destroy=()=>{req.destroyed=true;};req.write=part=>parts.push(Buffer.from(part));
        req.end=part=>{if(part)parts.push(Buffer.from(part));queueMicrotask(()=>{
            if(plan.error){req.emit('error',Error('provider secret PRIVATE_TOKEN_DO_NOT_LEAK'));return;}
            if(plan.hang)return;
            const res=new EventEmitter();res.statusCode=plan.status??200;res.headers=plan.headers??{};res.complete=plan.complete??true;
            res.destroy=()=>{res.destroyed=true;queueMicrotask(()=>res.emit('close'));};
            calls.at(-1).response=res;callback(res);
            if(res.destroyed)return;
            plan.beforeData?.();
            for(const chunk of plan.chunks??[Buffer.from(JSON.stringify(plan.json??meta()))]){if(res.destroyed)break;res.emit('data',chunk);}
            plan.beforeEnd?.();
            if(plan.aborted)res.emit('aborted');else if(plan.earlyClose)res.emit('close');
            else if(!res.destroyed){res.emit('end');res.emit('close');}
        });};
        calls.push({options,parts,req});return req;
    }};
    const compiled=new Module(filename.pathname);compiled.paths=[];
    compiled.require=name=>{
        if(name==='node:https')return fakeHttps;
        if(name==='test:clock')return clock;
        if(name==='test:buffer')return {from:Buffer.from.bind(Buffer),isBuffer:Buffer.isBuffer,concat};
        if(name==='firebase-admin/app')return {getApp:()=>({options:{credential:{getAccessToken:()=>{tokenCalls++;return token();}}}})};
        if(name==='node:crypto')return {createHash,randomBytes:size=>Buffer.alloc(size,7)};
        if(name==='node:perf_hooks')return {performance:{now:()=>now}};
        throw Error('unexpected dependency '+name);
    };
    compiled._compile(source.replace('const https=require("node:https");',
        'const https=require("node:https");const {setTimeout,clearTimeout}=require("test:clock");const Buffer=require("test:buffer");'),filename.pathname);
    return {io:compiled.exports.createRecoveryCandidateStorage(),calls,timers,tokenCalls:()=>tokenCalls,
        advance:ms=>{now+=ms;},expire:()=>{for(const fn of [...timers.values()])fn();}};
}
const refused=(promise,code)=>assert.rejects(promise,error=>{
    assert.equal(error.code,code);assert(!String(error.stack).includes('PRIVATE_TOKEN_DO_NOT_LEAK'));assert.equal(Object.hasOwn(error,'cause'),false);return true;
});

test('fixed public IO sends multipart create-only zero with payload MD5, no redirect/SDK generation coercion',async()=>{
    const h=harness([{status:201,json:meta()}]);assert(Object.isFrozen(h.io));
    assert.deepEqual(Object.keys(h.io).sort(),['bucketName','createOnly','lookupMetadata','readExact']);
    const result=await h.io.createOnly({...input,bytes,ifGenerationMatch:'0'});
    assert.deepEqual(result,{...input,generation:'9007199254740993',size:bytes.length});
    const {options,parts}=h.calls[0],url=new URL(options.path,'https://storage.googleapis.com');
    assert.equal(options.hostname,'storage.googleapis.com');assert.equal(options.port,443);assert.equal(options.method,'POST');
    assert.equal(url.searchParams.get('uploadType'),'multipart');assert.equal(url.searchParams.get('ifGenerationMatch'),'0');
    assert.equal(url.searchParams.get('name'),objectName);assert.equal(options.headers['Accept-Encoding'],'identity');
    assert.equal(Object.hasOwn(options.headers,'Content-MD5'),false);
    assert.equal(parts.length,3);assert.deepEqual(parts[1],bytes);
    assert.match(parts[0].toString(),new RegExp('"md5Hash":"'+md5(bytes).replace(/[+]/g,'\\+')+'"'));
    assert.equal(Number(options.headers['Content-Length']),parts.reduce((n,b)=>n+b.length,0));assert.equal(h.timers.size,0);
});

test('lookup returns exact four-key identity; only 404 is absent and provider metadata is strict',async()=>{
    assert.equal(await harness([{status:404}]).io.lookupMetadata(input),null);
    for(const patch of [{bucket:'other'},{name:'other'},{generation:9007199254740992},{generation:'01'},
        {generation:'1\n'},{generation:'1\r\n'},
        {size:'33554433'},{size:'0'},{size:1},{size:'1\n'},{md5Hash:'bad'},{contentEncoding:'gzip'}]){
        await refused(harness([{json:{...meta(),...patch}}]).io.lookupMetadata(input),'DATA_LOSS');
    }
    for(const [status,code] of [[401,'UNAUTHENTICATED'],[403,'PERMISSION_DENIED'],[302,'PROVIDER_REJECTED'],[500,'PROVIDER_REJECTED']])
        await refused(harness([{status}]).io.lookupMetadata(input),code);
    await refused(harness([{status:404,headers:{'content-encoding':'gzip'}}]).io.lookupMetadata(input),'DATA_LOSS');
    await refused(harness([{chunks:[Buffer.from('PRIVATE_TOKEN_DO_NOT_LEAK invalid JSON')]}]).io.lookupMetadata(input),'DATA_LOSS');
});

test('readExact pins original 64-bit generation in both actual URLs and streams full unchanged bytes',async()=>{
    for(const generation of ['9007199254740993','18446744073709551615']){
        const h=harness([{json:meta(generation)},{chunks:[bytes.subarray(0,4),bytes.subarray(4)]}]);
        const result=await h.io.readExact({...input,generation});assert.deepEqual(result.bytes,bytes);
        assert.equal(result.metadata.generation,generation);
        for(const {options} of h.calls){const url=new URL(options.path,'https://storage.googleapis.com');
            assert.equal(url.pathname,'/storage/v1/b/'+bucketName+'/o/'+encodeURIComponent(objectName));
            assert.equal(url.searchParams.get('generation'),generation);assert.equal(options.headers.Range,undefined);
        }
        assert.equal(new URL(h.calls[1].options.path,'https://storage.googleapis.com').searchParams.get('alt'),'media');
        assert.equal(h.tokenCalls(),1);assert.equal(h.timers.size,0);
    }
});

test('deferred credentials cannot retarget the admitted generation through mutable caller input',async()=>{
    const generation='9007199254740993';let release;
    const h=harness([{json:meta(generation)},{chunks:[bytes]}],{token:()=>new Promise(resolve=>{release=resolve;})});
    const mutable={...input,generation},pending=h.io.readExact(mutable);
    await Promise.resolve();mutable.generation='18446744073709551615';
    release({access_token:'PRIVATE_TOKEN_DO_NOT_LEAK'});
    const result=await pending;assert.equal(result.metadata.generation,generation);
    assert.deepEqual(h.calls.map(({options})=>new URL(options.path,'https://storage.googleapis.com').searchParams.get('generation')),
        [generation,generation]);
});

test('existing UID controls remain encoded object data without an additional identity restriction',async()=>{
    const name=objectName.replace('uid 中文%','uid\u0000\u001f\u007f\n\r'),h=harness([{json:{...meta(),name}}]);
    const result=await h.io.lookupMetadata({...input,objectName:name});assert.equal(result.objectName,name);
    const requestPath=h.calls[0].options.path;
    assert.equal(requestPath,'/storage/v1/b/'+bucketName+'/o/'+encodeURIComponent(name));
    assert(!/[\x00-\x1f\x7f]/.test(requestPath));
});

test('stream size/MD5/completeness and identity encoding pass before media concat; no truncated candidate accepted',async()=>{
    for(const plan of [{chunks:[Buffer.from('wrong')]},{chunks:[Buffer.alloc(bytes.length,1)]},
        {chunks:[bytes],complete:false},{chunks:[bytes],aborted:true},{chunks:[bytes],earlyClose:true},{chunks:[bytes],headers:{'content-encoding':'gzip'}},
        {chunks:[bytes,Buffer.from('extra')]},{chunks:[bytes],headers:{'content-length':'33554433'}}]){
        let concats=0;
        const h=harness([{json:meta()},plan],{concat:(...args)=>{concats++;return Buffer.concat(...args);}});
        await assert.rejects(h.io.readExact({...input,generation:'9007199254740993'}));
        assert.equal(concats,1,'only bounded metadata may concat on rejected media');
    }
    await refused(harness([{json:meta('9007199254740994')}]).io.readExact({...input,generation:'9007199254740993'}),'DATA_LOSS');
});

test('metadata is bounded before retention/parse; media over 32MiB is destroyed without a full concat',async()=>{
    const h=harness([{chunks:[Buffer.alloc(65536,32),Buffer.from('x')]}]);
    await refused(h.io.lookupMetadata(input),'RESOURCE_EXHAUSTED');assert.equal(h.calls[0].response.destroyed,true);
    const large=Buffer.alloc(32*1024*1024,1);let concats=0;
    const m=harness([{json:meta('1',large)},{chunks:[large,Buffer.from('x')]}],{concat:(...args)=>{concats++;return Buffer.concat(...args);}});
    await refused(m.io.readExact({...input,generation:'1'}),'RESOURCE_EXHAUSTED');assert.equal(concats,1);
    assert.equal(m.calls[1].response.destroyed,true);
});

test('only attempted write transport ambiguity maps UNKNOWN_COMMIT; credentials/provider bodies never escape',async()=>{
    for(const [plan,code] of [[{status:412},'ALREADY_EXISTS'],[{status:408},'UNKNOWN_COMMIT'],[{status:429},'UNKNOWN_COMMIT'],
        [{status:503},'UNKNOWN_COMMIT'],[{status:503,headers:{'content-encoding':'gzip'}},'UNKNOWN_COMMIT'],
        [{status:412,headers:{'content-encoding':'gzip'}},'ALREADY_EXISTS'],
        [{error:true},'UNKNOWN_COMMIT'],[{status:403},'PERMISSION_DENIED'],
        [{status:400},'PROVIDER_REJECTED'],[{status:302},'PROVIDER_REJECTED']]){
        const h=harness([plan]);await refused(h.io.createOnly({...input,bytes,ifGenerationMatch:'0'}),code);assert.equal(h.calls.length,1);
    }
    const h=harness([],{token:async()=>{throw Object.assign(Error('PRIVATE_TOKEN_DO_NOT_LEAK'),{code:'UNKNOWN_COMMIT'});}});
    await refused(h.io.createOnly({...input,bytes,ifGenerationMatch:'0'}),'UNAUTHENTICATED');assert.equal(h.calls.length,0);
    for(const patch of [{md5Hash:md5(Buffer.from('different'))},{size:String(bytes.length+1)}])
        await refused(harness([{status:201,json:{...meta(),...patch}}]).io.createOnly({...input,bytes,ifGenerationMatch:'0'}),'DATA_LOSS');
});

test('one wall deadline covers delayed credentials and all pinned-read requests without renewing',async()=>{
    let release;
    const h=harness([],{token:()=>new Promise(resolve=>{release=resolve;})});
    const pending=h.io.lookupMetadata(input);await Promise.resolve();h.expire();await refused(pending,'DEADLINE_EXCEEDED');
    release({access_token:'PRIVATE_TOKEN_DO_NOT_LEAK'});await Promise.resolve();assert.equal(h.calls.length,0);
    const r=harness([{json:meta()},{hang:true}]);const read=r.io.readExact({...input,generation:'9007199254740993'});
    for(let index=0;index<10&&r.calls.length<2;index++)await Promise.resolve();
    assert.equal(r.calls.length,2);assert.equal(r.timers.size,1);r.expire();await refused(read,'DEADLINE_EXCEEDED');assert.equal(r.calls[1].req.destroyed,true);
    const w=harness([{hang:true}]);const write=w.io.createOnly({...input,bytes,ifGenerationMatch:'0'});
    for(let index=0;index<5&&!w.calls.length;index++)await Promise.resolve();w.expire();await refused(write,'UNKNOWN_COMMIT');
});

test('invalid tuples, local size and generation inputs refuse before credentials or network',async()=>{
    for(const change of [{bucketName:'other'},{objectName:'https://evil.test/x'},
        {objectName:objectName.replace('uid 中文%',String.fromCharCode(0xd800))},
        {objectName:objectName.replace('/1/','/9007199254740993/')},{objectName:objectName+'\n'},{headers:{}},{transport:()=>{}}]){
        const h=harness();await refused(h.io.lookupMetadata({...input,...change}),'INVALID_ARGUMENT');assert.equal(h.tokenCalls(),0);
    }
    for(const generation of [9007199254740992,'0','01','184467440737095516150','1\r\nsecret','1\n','1\r\n']){
        const h=harness();await refused(h.io.readExact({...input,generation}),'INVALID_ARGUMENT');assert.equal(h.calls.length,0);assert.equal(h.tokenCalls(),0);
    }
    for(const payload of [Buffer.alloc(0),Buffer.alloc(32*1024*1024+1),'raw']){
        const h=harness();await refused(h.io.createOnly({...input,bytes:payload,ifGenerationMatch:'0'}),'INVALID_ARGUMENT');assert.equal(h.tokenCalls(),0);
    }
});

test('overdue token microtask cannot open HTTPS before the delayed timer callback runs',async()=>{
    let release;
    const h=harness([{json:meta()}],{token:()=>new Promise(resolve=>{release=resolve;})});
    const pending=h.io.lookupMetadata(input);await Promise.resolve();h.advance(20001);
    release({access_token:'PRIVATE_TOKEN_DO_NOT_LEAK'});
    await refused(pending,'DEADLINE_EXCEEDED');assert.equal(h.calls.length,0);assert.equal(h.timers.size,0);
});

test('overdue media chunks and end cannot retain or concatenate a successful body while timers are starved',async()=>{
    for(const hook of ['beforeData','beforeEnd']){
        let concats=0;
        const plan={chunks:[bytes],[hook]:()=>h.advance(20001)};
        const h=harness([{json:meta()},plan],{concat:(...args)=>{concats++;return Buffer.concat(...args);}});
        await refused(h.io.readExact({...input,generation:'9007199254740993'}),'DEADLINE_EXCEEDED');
        assert.equal(concats,1,'metadata only; overdue media cannot concatenate');
        assert.equal(h.calls[1].req.destroyed,true);assert.equal(h.calls[1].response.destroyed,true);
        assert.equal(h.timers.size,0);
    }
});

test('deadline is checked again at the second request and final resolution; attempted create is uncertain',async()=>{
    const h=harness([{json:meta()}],{concat:(...args)=>{const result=Buffer.concat(...args);h.advance(20001);return result;}});
    await refused(h.io.readExact({...input,generation:'9007199254740993'}),'DEADLINE_EXCEEDED');
    assert.equal(h.calls.length,1,'overdue metadata continuation cannot open the media request');
    const lookup=harness([{json:meta()}],{concat:(...args)=>{const result=Buffer.concat(...args);lookup.advance(20001);return result;}});
    await refused(lookup.io.lookupMetadata(input),'DEADLINE_EXCEEDED');
    for(const hook of ['beforeData','beforeEnd']){
        const plan={status:201,json:meta(),[hook]:()=>write.advance(20001)},write=harness([plan]);
        await refused(write.io.createOnly({...input,bytes,ifGenerationMatch:'0'}),'UNKNOWN_COMMIT');
        assert.equal(write.calls[0].req.destroyed,true);assert.equal(write.timers.size,0);
    }
});
