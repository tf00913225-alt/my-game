import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import {EventEmitter} from 'node:events';
import test from 'node:test';
const source=fs.readFileSync('.github/scripts/run-bottom-nav-runtime-browser-qa.mjs','utf8');
const body=source.slice(source.indexOf('async function runViewport('),source.indexOf('\nfs.mkdirSync(ARTIFACT_DIR',source.indexOf('async function runViewport(')));
function fixture(probe){
 const proc=Object.assign(new EventEmitter(),{pid:42,exitCode:null,signalCode:null,stderr:new EventEmitter()});
 const calls={killed:0,removed:0,probes:0};proc.kill=()=>{calls.killed++;};
 const productFailure=new Error('original product check failed');
 class Cdp{async send(){throw productFailure;}close(){}}
 const run=vm.runInNewContext('('+body+')',{fs:{mkdtempSync:()=>'/isolated/nav-fixture',rmSync:()=>{calls.removed++;}},path,os,spawn:()=>proc,process:{platform:'win32'},console:{error(){}},Cdp,
  waitJson:async(url,options)=>{calls.probes++;assert.match(url,/^http:\/\/127\.0\.0\.1:\d+\/json\/list$/);assert.equal(options.chromeProcess,proc);return probe(proc);}});
 return {run,proc,calls,productFailure};
}
test('navigation retires local retry and binds startup to the formal owner',()=>{
 assert.match(source,/import \{waitJson\} from "\.\/runtime-browser-qa-support\.mjs"/);
 assert.doesNotMatch(source,/function waitJson\(/);
});
test('navigation startup failure preserves original cause and child evidence and cleans once',async()=>{
 const failure=Object.assign(new Error('startup deadline'),{code:'ETIMEDOUT'}),f=fixture(()=>{throw failure;});
 await assert.rejects(f.run('/fixture/chrome','http://fixture',360,640),error=>{
  assert.equal(error.cause,failure);assert.equal(error.navEvidence.chromeProcess.pid,42);assert.equal(error.navEvidence.rows.length,0);return true;
 });
 assert.deepEqual(f.calls,{killed:1,removed:1,probes:1});
});
test('navigation does not convert a post-connect product failure into startup success',async()=>{
 const f=fixture(()=>[{type:'page',webSocketDebuggerUrl:'ws://fixture'}]);
 await assert.rejects(f.run('/fixture/chrome','http://fixture',360,640),error=>error===f.productFailure);
 assert.deepEqual(f.calls,{killed:1,removed:1,probes:1});
});
