import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import test from 'node:test';

test('navigation QA retains real child failure evidence before CDP exists',()=>{
 const output=fs.mkdtempSync(path.join(os.tmpdir(),'nav-chrome-evidence-'));
 try{
  const original=fs.readFileSync(new URL('../.github/scripts/run-bottom-nav-runtime-browser-qa.mjs',import.meta.url),'utf8');
  // Inject only the external browser/server/probe and artifact destination.
  // Node rejects the unchanged Chrome flags; execute the real failure writer.
  let source=original.replace('const ARTIFACT_DIR=path.join(ROOT,"artifacts","browser-qa");',`const ARTIFACT_DIR=${JSON.stringify(output)};`);
  assert.notEqual(source,original,'fixture must isolate its artifact output');
  source=source.replace('import {spawn,spawnSync} from "node:child_process";', 'import {spawn as realSpawn,spawnSync} from "node:child_process";let fixtureChild;const spawn=(...args)=>(fixtureChild=realSpawn(...args));');
  const replaceFunction=(start,end,replacement)=>{const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a);source=source.slice(0,a)+replacement+'\n'+source.slice(b);};
  replaceFunction('function findChrome(){','function mime(', 'function findChrome(){return process.execPath;}');
  replaceFunction('async function startServer(){','function waitJson(', "async function startServer(){return {url:'http://127.0.0.1/unused',server:{close:done=>done()}};}");
  replaceFunction('function waitJson(','class Cdp{', "async function waitJson(){if(fixtureChild.exitCode===null||!fixtureChild.stderr.readableEnded)await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('fixture child did not exit')),5000);fixtureChild.once('close',()=>{clearTimeout(timer);resolve();});});throw Error('injected CDP unavailable');}");
  const script=`try{await import(${JSON.stringify('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))});throw Error('expected failure');}catch(error){if(!error.message.startsWith('Navigation Chrome startup failed:'))throw error;}`;
  const result=spawnSync(process.execPath,['--input-type=module'],{input:script,encoding:'utf8',timeout:10000});
  assert.equal(result.status,0,String(result.error||result.stderr).slice(-2000));
  const data=JSON.parse(fs.readFileSync(path.join(output,'bottom-nav-home-scroll-qa.json'),'utf8'));
  assert.equal(data.passed,false);assert.deepEqual(data.evidence.rows,[]);
  const child=data.evidence.chromeProcess;
  assert.equal(child.executable,process.execPath);assert.ok(child.pid>0);
  assert.notEqual(child.exit.code,0);assert.equal(child.spawnError,null);
  assert.match(child.stderr,/bad option/);assert.ok(child.stderr.length<=4000);
  assert.match(result.stderr,/Navigation Chrome startup diagnostics:/);
 }finally{fs.rmSync(output,{recursive:true,force:true});}
});
