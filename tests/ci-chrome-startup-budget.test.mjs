import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import http from 'node:http';
import {spawn} from 'node:child_process';
import test from 'node:test';
import {waitJson} from '../.github/scripts/runtime-browser-qa-support.mjs';
const alive=()=>Object.assign(new EventEmitter(),{exitCode:null,signalCode:null});
async function endpoint(handler){
 const server=http.createServer(handler);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 return {url:`http://127.0.0.1:${server.address().port}/json/list`,close:async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));}};
}
test('fast startup returns original data, removes child listeners and preserves product failures',async()=>{
 const child=alive(),e=await endpoint((req,res)=>res.end('[{"type":"page","webSocketDebuggerUrl":"ws://fixture"}]'));
 try{const data=await waitJson(e.url,{chromeProcess:child});assert.equal(data[0].type,'page');assert.equal(child.listenerCount('exit'),0);assert.equal(child.listenerCount('error'),0);assert.throws(()=>assert.equal(data[0].type,'wrong-product-state'));}finally{await e.close();}
});
test('startup may become ready after fifteen seconds within the thirty-second default',async()=>{
 const started=Date.now(),child=alive();
 const e=await endpoint((req,res)=>{if(Date.now()-started<16200){res.statusCode=503;res.end('not ready');}else res.end('[{"type":"page"}]');});
 try{const data=await waitJson(e.url,{chromeProcess:child});assert.equal(data[0].type,'page');assert.ok(Date.now()-started>=16200);assert.ok(Date.now()-started<30000);}finally{await e.close();}
});
test('never-ready startup still fails at the actual thirty-second default',async()=>{
 const child=alive(),e=await endpoint(()=>{}),started=Date.now();
 try{await assert.rejects(waitJson(e.url,{chromeProcess:child}),error=>error.code==='ETIMEDOUT');const elapsed=Date.now()-started;assert.ok(elapsed>=30000);assert.ok(elapsed<35000);assert.equal(child.listenerCount('exit'),0);}finally{await e.close();}
});
test('a real exited process aborts an in-flight readiness request early',async()=>{
 const e=await endpoint(()=>{}),child=spawn(process.execPath,['-e','setTimeout(()=>process.exit(7),100)']);
 const started=Date.now();try{await assert.rejects(waitJson(e.url,{chromeProcess:child}),error=>error.code==='CHROME_EXITED'&&error.message.includes('7'));assert.ok(Date.now()-started<5000);}finally{child.kill();await e.close();}
});
test('an already-exited process never accepts an unrelated ready endpoint',async()=>{
 const child=alive();child.exitCode=9;const e=await endpoint((req,res)=>res.end('[]'));
 try{await assert.rejects(waitJson(e.url,{chromeProcess:child}),error=>error.code==='CHROME_EXITED');}finally{await e.close();}
});
test('spawn failure is distinct from timeout',async()=>{
 const e=await endpoint(()=>{}),child=spawn('missing-chrome-binary-for-startup-regression-976');
 try{await assert.rejects(waitJson(e.url,{chromeProcess:child}),error=>error.code==='CHROME_SPAWN_FAILED'&&error.cause.code==='ENOENT');}finally{await e.close();}
});

test('startup target predicate keeps polling empty/non-page JSON until a debugger page exists',async()=>{
 let count=0;const child=alive();const e=await endpoint((req,res)=>res.end(JSON.stringify(++count===1?[]:count===2?[{type:'browser'}]:[{type:'page',webSocketDebuggerUrl:'ws://fixture'}])));
 try{const data=await waitJson(e.url,{chromeProcess:child,accept:rows=>Array.isArray(rows)&&rows.some(row=>row.type==='page'&&row.webSocketDebuggerUrl)});assert.equal(count,3);assert.equal(data[0].webSocketDebuggerUrl,'ws://fixture');}finally{await e.close();}
});
test('never-acceptable JSON cannot escape the finite startup deadline',async()=>{
 const child=alive(),e=await endpoint((req,res)=>res.end('[]')),started=Date.now();
 try{await assert.rejects(waitJson(e.url,{chromeProcess:child,timeoutMs:100,accept:rows=>rows.some(row=>row.type==='page')}),error=>(error.message==='DevTools JSON has no acceptable target yet'||error.code==='ETIMEDOUT'&&error.cause?.message==='DevTools JSON has no acceptable target yet')&&error.devToolsDiagnostics.directHttp.status===200);assert.ok(Date.now()-started<1500);assert.equal(child.listenerCount('exit'),0);}finally{await e.close();}
});
