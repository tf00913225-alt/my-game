import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import vm from 'node:vm';
import test from 'node:test';
import {startServer,collectStartupFailure} from '../.github/scripts/runtime-browser-qa-support.mjs';

test('Daily QA waits for the Startup Owner without losing the existing readiness conditions or deadline',async()=>{
    const source=fs.readFileSync('.github/scripts/run-daily-balance-browser-qa.mjs','utf8');
    const waitSource=source.match(/^ const wait=(.*);$/m)[1];
    const condition=source.match(/^ await wait\(\(\)=>(.*)\);$/m)[1];
    let elapsed=0;
    const state={window:{},performance:{now:()=>elapsed},Error,
        document:{getElementById:id=>id==='startupLoader'?{hidden:true}:id==='gameInterface'?{}:{classList:{contains:()=>false}}},
        getComputedStyle:()=>({display:'block'}),check:(value,message)=>assert.ok(value,message)};
    state.setTimeout=(resolve,ms)=>{elapsed+=ms;if(elapsed>=80)state.window.FourSymbolsStartupPolicy={getState:()=> 'READY'};resolve();};
    const context=vm.createContext(state);
    const ready=vm.runInContext('(()=>'+condition+')',context);
    assert.equal(ready(),false,'the original Owner may not be installed yet');
    await vm.runInContext('('+waitSource+')',context)(ready);
    assert.equal(elapsed,80,'wait for actual Owner installation rather than throwing or bypassing readiness');
    state.window.FourSymbolsStartupPolicy={getState:()=> 'AUTH_REQUIRED'};assert.equal(ready(),false);
    state.window.FourSymbolsStartupPolicy={getState:()=> 'READY'};
    state.document.getElementById=id=>id==='startupLoader'?{hidden:false}:{};assert.equal(ready(),false);
    state.document.getElementById=id=>id==='startupLoader'?{hidden:true}:id==='gameInterface'?{}:{classList:{contains:()=>true}};assert.equal(ready(),false);
    state.document.getElementById=id=>id==='startupLoader'?{hidden:true}:id==='gameInterface'?{}:{classList:{contains:()=>false}};
    state.getComputedStyle=()=>({display:'none'});assert.equal(ready(),false);
    state.getComputedStyle=()=>({display:'block'});assert.equal(ready(),true);
    delete state.window.FourSymbolsStartupPolicy;elapsed=0;
    state.setTimeout=(resolve,ms)=>{elapsed+=ms;resolve();};
    await assert.rejects(vm.runInContext('('+waitSource+')',context)(ready),/Runtime wait:/);
    assert.equal(elapsed,30000,'missing Owner still fails at the unchanged finite deadline');
});

test('deployed QA proxy preserves failed status and bounded path evidence without retrying',async()=>{
    let calls=0;
    const upstream=http.createServer((req,res)=>{calls++;res.writeHead(503);res.end('temporary upstream failure');});
    await new Promise(resolve=>upstream.listen(0,'127.0.0.1',resolve));
    const proxy=await startServer({baseUrl:`http://127.0.0.1:${upstream.address().port}`});
    try{
        for(let i=0;i<42;i++){
            const response=await fetch(proxy.url.replace('index.html',`missing-${i}.js?token=private`));
            assert.equal(response.status,503);
            assert.equal(await response.text(),'temporary upstream failure');
        }
        assert.equal(calls,42);
        assert.equal(proxy.failures.length,40);
        assert.deepEqual(proxy.failures[0],{path:'/missing-2.js',status:503,message:'upstream HTTP failure'});
        assert.ok(!JSON.stringify(proxy.failures).includes('private'));
    }finally{
        await new Promise(resolve=>proxy.server.close(resolve));
        await new Promise(resolve=>upstream.close(resolve));
    }
});

test('startup failure records the actual Owner error, failed and pending resources without changing state',async()=>{
    const ownerError={message:'app-shell request failed',code:'feature-load-failed'};
    const browser={
        window:{FourSymbolsStartupPolicy:{getState:()=> 'ERROR',getLastError:()=>ownerError},FourSymbolsFirstPlay:{getLastFailed:()=>[{path:'build/app-shell.js',message:'503'}]}},
        document:{getElementById:id=>id==='startupLoader'?{hidden:false}:{classList:{contains:()=>true}}},
        performance:{getEntriesByType:()=>[{name:'four-symbols:auth-resolved',startTime:20},{name:'unrelated',startTime:30}]}
    };
    const cdp={eval:async expression=>vm.runInNewContext(expression,browser),events:[
        {method:'Network.requestWillBeSent',params:{requestId:'a',request:{url:'http://qa/build/app-shell.js?secret=private'}}},
        {method:'Network.responseReceived',params:{response:{status:503,url:'http://qa/build/app-shell.js?secret=private'}}},
        {method:'Network.loadingFailed',params:{requestId:'a',errorText:'net::ERR_ABORTED'}},
        {method:'Network.requestWillBeSent',params:{requestId:'b',request:{url:'http://qa/assets/pending.webp?secret=private'}}}
    ]};
    const evidence=await collectStartupFailure(cdp,{width:412,height:915,phase:'startup-cold'});
    assert.equal(evidence.startup.state,'ERROR');
    assert.equal(evidence.startup.error.code,'feature-load-failed');
    assert.equal(evidence.startup.error.message,'app-shell request failed');
    assert.equal(evidence.startup.failedResources[0].path,'build/app-shell.js');
    assert.equal(evidence.startup.marks.length,1);
    assert.deepEqual(evidence.network.map(item=>item.path),['/build/app-shell.js','/build/app-shell.js']);
    assert.deepEqual(evidence.pendingResources,['/assets/pending.webp']);
    assert.ok(!JSON.stringify(evidence).includes('private'));
    assert.equal(browser.window.FourSymbolsStartupPolicy.getState(),'ERROR');
});

test('a disconnected evidence capture does not mask the original failure or hang cleanup',async()=>{
    const evidence=await collectStartupFailure({eval:async()=>{throw new Error('CDP closed');},events:[]},{phase:'startup-cold'});
    assert.equal(evidence.captureError,'CDP closed');
    assert.deepEqual(evidence.network,[]);
    const timedOut=await collectStartupFailure({eval:()=>new Promise(()=>{}),events:[]},{phase:'startup-cold'});
    assert.equal(timedOut.captureError,'Startup evidence capture timeout');
});
