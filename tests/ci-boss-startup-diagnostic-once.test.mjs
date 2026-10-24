import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import test from 'node:test';
const require=createRequire(import.meta.url),yaml=require('yaml');
const workflow=yaml.parse(fs.readFileSync('.github/workflows/ci.yml','utf8'));
const old=yaml.parse(execFileSync('git',['show','89d3dba7:.github/workflows/ci.yml'],{encoding:'utf8'}));
const boss=fs.readFileSync('.github/scripts/battle-layer-audio-live-qa.mjs','utf8');
const helper=fs.readFileSync('.github/scripts/runtime-browser-qa-support.mjs','utf8');
const encode=vm.runInNewContext('('+boss.slice(boss.indexOf('function encodeBossStartupDiagnostic('),boss.indexOf('\nasync function runBossBalanceProductionQa('))+')',{Buffer});
const yes=(expression,context)=>expression===undefined?true:!!vm.runInNewContext(String(expression).replace(/^\$\{\{\s*|\s*\}\}$/g,''),{...context,always:()=>true,cancelled:()=>false});
const branch='chore/ci-boss-startup-probe-20261024';
const context=(event,ref,outputs={})=>({github:{event_name:event,ref:'refs/heads/'+ref,ref_name:ref},inputs:{full_regression:false,candidate_sha:''},needs:{classify:{result:'skipped',outputs},verify:{result:'skipped'}}});
test('exact diagnostic dispatch allocates only one five-minute read-only runner',()=>{
 const ctx=context('workflow_dispatch',branch);
 assert.deepEqual(Object.entries(workflow.jobs).filter(([,job])=>yes(job.if,ctx)).map(([name])=>name),['boss_startup_diagnostic']);
 const job=workflow.jobs.boss_startup_diagnostic;
 assert.equal(job['timeout-minutes'],5);assert.equal(job['runs-on'],'ubuntu-latest');assert.deepEqual(job.permissions,{contents:'read'});
 assert.deepEqual(job.steps.map(s=>s['timeout-minutes']),[2,1,1,1]);
 const upload=job.steps.at(-1).with;assert.equal(upload['retention-days'],1);assert.equal(upload['compression-level'],0);assert.equal(upload.path,'artifacts/boss-startup-diagnostic/boss-startup.json');assert.ok(!upload.path.includes('boss-balance'));
});
test('all original normal-event job conditions retain their decisions',()=>{
 const outputs=new Proxy({},{get:()=> 'true'});
 for(const [event,ref] of [['pull_request','pr987'],['push','dev'],['push','main'],['workflow_dispatch','dev'],['workflow_call','dev']]){
  const ctx=context(event,ref,outputs);ctx.needs.classify.result='success';ctx.needs.verify.result='success';
  for(const [name,job] of Object.entries(old.jobs))assert.equal(yes(workflow.jobs[name].if,ctx),yes(job.if,ctx),event+':'+name);
  assert.equal(yes(workflow.jobs.boss_startup_diagnostic.if,ctx),false);
 }
});
test('diagnostic serializer caps UTF-8 and escape-heavy payloads below sixty KiB',()=>{
 for(const text of ['small','x'.repeat(200000),'漢字'.repeat(100000),'\\\"\n\u0000'.repeat(100000)]){
  const result=encode({schemaVersion:1,diagnosticOnly:true,notAcceptance:true,text});
  assert.ok(Buffer.byteLength(result)<=60*1024);const parsed=JSON.parse(result);assert.equal(parsed.notAcceptance,true);
  if(Buffer.byteLength(text)>60*1024)assert.equal(parsed.truncated,true);
 }
});
test('one-shot original spawn returns before product QA and keeps explicit non-tracing quiet options',()=>{
 const start=boss.indexOf('chromeExecutable=findChrome();'),end=boss.indexOf('await client.send',start),startup=boss.slice(start,end);
 assert.equal((startup.match(/proc=spawn\(/g)||[]).length,1);
 assert.match(startup,/traceEnabled:false,logEvidence:false/);assert.match(startup,/if\(diagnostic\)\{await writeDiagnostic\('DevTools ready'\);return;\}/);
 assert.match(boss,/GITHUB_RUN_ATTEMPT,'1'/);assert.match(boss,/Unknown diagnostic token/);
 assert.match(helper,/if\(!traceEnabled\|\|atMs!==5000/);assert.match(helper,/if\(logEvidence\)try\{console.log\('Chrome startup observation:/);
 assert.match(helper,/if\(logEvidence\)console.error\('DevTools connection failure diagnostics:/);
});
import {EventEmitter} from 'node:events';
import http from 'node:http';
import {waitJson,observeChromeStartup} from '../.github/scripts/runtime-browser-qa-support.mjs';
test('diagnostic quiet switches keep raw observation/probe payload off stdout while retaining returned evidence',async()=>{
 const logs=[],errors=[],log=console.log,error=console.error;
 const server=http.createServer((req,res)=>res.end('[]'));await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const child=Object.assign(new EventEmitter(),{pid:process.pid,exitCode:null,signalCode:null,stderr:new EventEmitter()});
 try{
  console.log=(...args)=>logs.push(args);console.error=(...args)=>errors.push(args);
  await assert.rejects(waitJson('http://127.0.0.1:'+server.address().port+'/json/list',{chromeProcess:child,timeoutMs:30,accept:()=>false,logEvidence:false}),e=>e.devToolsDiagnostics.directHttp.status===200);
  const observer=observeChromeStartup(child,{port:server.address().port,traceEnabled:false,logEvidence:false});
  child.stderr.emit('data','private diagnostic stderr');const observed=await observer.finish('fixture only');
  assert.equal(observed.stderrHead,'private diagnostic stderr');assert.equal(observed.trace,null);assert.equal(logs.length,0);assert.equal(errors.length,0);
 }finally{console.log=log;console.error=error;server.closeAllConnections();await new Promise(r=>server.close(r));}
});
