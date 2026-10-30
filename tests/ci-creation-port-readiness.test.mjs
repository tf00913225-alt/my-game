import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import test from 'node:test';

// Exercise the original startup caller without opening a browser or network.
const source=fs.readFileSync('tests/ui-creation-critical-browser.test.js','utf8');
const start=source.indexOf('async function verifyCreationStates(){');
const end=source.indexOf('\nconst file=',start);
assert.ok(start>=0&&end>start);
const original=source.slice(start,end);
assert.ok(original.includes("const {Cdp,waitJson}=await import('../.github/scripts/runtime-browser-qa-support.mjs');"));
const body=original.replace("const {Cdp,waitJson}=await import('../.github/scripts/runtime-browser-qa-support.mjs');",'const {Cdp,waitJson}=qaSupport;');

async function run({contents=['12345\n/devtools/browser/fixture'],readError,exitCode=null,probeError}={}){
 let time=0,reads=0,killed=false;
 const probes=[];
 const chrome={exitCode,signalCode:null,kill(){killed=true;}};
 const fakeFs={
  readFileSync(file){
   if(String(file).endsWith('DevToolsActivePort')){
    if(readError)throw Object.assign(Error(readError),{code:readError});
    const value=contents[Math.min(reads++,contents.length-1)];
    if(value===undefined)throw Object.assign(Error('not yet created'),{code:'ENOENT'});
    return value;
   }
   return 'function updateInitialCharacterCreationFeedback(){\n}\n';
  },
  existsSync(){return true;},mkdtempSync(){return '/fixture/creation';},
  mkdirSync(){},writeFileSync(){},unlinkSync(){},rmSync(){}
 };
 const qaSupport={
  async waitJson(url,options){
   probes.push({url,budget:options.timeoutMs});
   assert.ok(options.timeoutMs>0&&options.timeoutMs<=15000);
   assert.equal(options.chromeProcess,chrome);
   assert.equal(options.accept([]),false);
   assert.equal(options.accept([{type:'browser'}]),false);
   assert.equal(options.accept([{type:'page',webSocketDebuggerUrl:'ws://fixture'}]),true);
   if(probeError)throw probeError;
   return [{type:'page'},{type:'page',webSocketDebuggerUrl:'ws://fixture'}];
  },
  Cdp:class {constructor(url){assert.equal(url,'ws://fixture');throw Error('READY_PROBE_REACHED');}}
 };
 const promise=vm.runInNewContext(body+'\nverifyCreationStates()',{
  assert,fs:fakeFs,path,os,crypto,qaSupport,process:{cwd:()=>'/fixture'},
  Date:{now:()=>time},setTimeout:fn=>{time+=50;fn();},
  spawnSync:()=>({stdout:'synthetic-head'}),findChrome:()=>'/fixture/chrome',spawn:()=>chrome,
  fetch:()=>{throw Error('Original caller must use the bounded readiness owner');},console
 });
 try{await promise;return {probes,time,reads,killed};}
 catch(error){return {error,probes,time,reads,killed};}
}

test('missing, empty and partial port files never request default port 80',async()=>{
 const result=await run({contents:[undefined,'','12','12345\n/devtools/browser/fixture']});
 assert.match(result.error.message,/READY_PROBE_REACHED/);
 assert.equal(result.reads,4);
 assert.equal(result.probes.length,1);
 assert.equal(result.probes[0].url,'http://127.0.0.1:12345/json/list');
 assert.equal(result.probes[0].budget,14850);
 assert.equal(result.killed,true);
});

for(const content of ['', '12','0\n','abc\n','65536\n','999999\n'])test('invalid port remains a failure: '+JSON.stringify(content),async()=>{
 const result=await run({contents:[content]});
 assert.match(result.error.message,/Chrome remote debugging did not start/);
 assert.equal(result.time,15000);
 assert.equal(result.probes.length,0);
 assert.equal(result.killed,true);
});

test('valid CRLF port is accepted; child exit, file errors and endpoint failure remain failures',async()=>{
 const ready=await run({contents:['65535\r\n/devtools/browser/fixture']});
 assert.match(ready.error.message,/READY_PROBE_REACHED/);
 assert.equal(ready.probes[0].url,'http://127.0.0.1:65535/json/list');
 const exited=await run({exitCode:7});
 assert.match(exited.error.message,/Chrome exited/);
 assert.equal(exited.probes.length,0);
 const denied=await run({readError:'EACCES'});
 assert.equal(denied.error.code,'EACCES');
 const endpointError=Object.assign(Error('endpoint still not ready'),{code:'ETIMEDOUT'});
 assert.equal((await run({probeError:endpointError})).error,endpointError);
});
