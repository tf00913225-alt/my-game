import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import test from 'node:test';

test('terminal visual QA retains failed Chrome process evidence before CDP exists',()=>{
    const root=fs.mkdtempSync(path.join(os.tmpdir(),'ci-terminal-chrome-evidence-'));
    try{
        const original=fs.readFileSync(new URL('../.github/scripts/run-terminal-visual-handoff-browser-qa.mjs',import.meta.url),'utf8');
        // Only external dependencies are injected. Execute the real spawn,
        // failure capture, artifact writer and cleanup against an actual child
        // that exits: Node rejects the unchanged Chrome command-line flags.
        const dependencies=`const ROOT=${JSON.stringify(root)};
            const findChrome=()=>process.execPath;
            const startServer=async()=>({url:'http://127.0.0.1/unused',failures:[],server:{close:done=>done()}});
            const waitJson=async()=>{
                if(proc.exitCode===null||!proc.stderr.readableEnded){await new Promise((resolve,reject)=>{
                    const timer=setTimeout(()=>reject(Error('fixture child did not exit')),5000);
                    proc.once('close',()=>{clearTimeout(timer);resolve();});
                });}
                throw Error('injected CDP unavailable');
            };
            class Cdp{};
            const collectStartupFailure=async()=>{throw Error('CDP must not exist');};`;
        const source=original.replace(/^import \{ROOT,findChrome,startServer,waitJson,Cdp,collectStartupFailure\} from .*;$/m,dependencies)
            .replace("const baseUrl=process.env.QA_BASE_URL||'';","const baseUrl='';");
        assert.notEqual(source,original,'fixture must isolate the imported transport');
        const script=`try{await import(${JSON.stringify('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))});throw Error('expected failure');}
            catch(error){if(error.message!=='injected CDP unavailable')throw error;}`;
        const result=spawnSync(process.execPath,['--input-type=module','-e',script],{encoding:'utf8',timeout:15000});
        assert.equal(result.status,0,String(result.error||result.stderr).slice(0,2000));
        const evidence=JSON.parse(fs.readFileSync(path.join(root,'artifacts/browser-qa/terminal-visual-handoff.json'),'utf8'));
        assert.equal(evidence.passed,false);
        assert.equal(evidence.detail.chromeProcess.executable,process.execPath);
        assert.notEqual(evidence.detail.chromeProcess.exit.code,0);
        assert.equal(evidence.detail.chromeProcess.spawnError,null);
        assert.match(evidence.detail.chromeProcess.stderr,/bad option/);
        assert.ok(evidence.detail.chromeProcess.stderr.length<=4000);
        assert.match(result.stderr,/Terminal visual Chrome startup diagnostics:/);
    }finally{
        fs.rmSync(root,{recursive:true,force:true});
    }
});
