import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import test from 'node:test';
import http from 'node:http';
import {waitJson,observeChromeStartup,readProcWindow,observeProcPageWait} from '../.github/scripts/runtime-browser-qa-support.mjs';

test('blocked proc metadata cannot block the foreground DevTools deadline',async()=>{
    const collector=observeProcPageWait('/unused',{timeoutMs:30,workerSource:'Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,3000);'});
    const server=http.createServer((req,res)=>setTimeout(()=>res.end('[]'),40));
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const start=Date.now();
    try{
        await assert.rejects(waitJson('http://127.0.0.1:'+server.address().port+'/json/list',{timeoutMs:10}),error=>error.code==='ETIMEDOUT');
        assert.ok(Date.now()-start<1000,'metadata must not hold the launch deadline');
        await new Promise(resolve=>setTimeout(resolve,40));
        assert.equal(collector.evidence.status,'timeout');
        assert.ok(Number.isFinite(collector.evidence.settledAfterMs));
    }finally{collector.stop('test-finished');server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});

test('proc metadata capture bounds bytes and preserves denial/missing evidence',()=>{
    const directory=fs.mkdtempSync(path.join(os.tmpdir(),'proc-window-'));
    try{
        const file=path.join(directory,'metadata');fs.writeFileSync(file,'0123456789');
        assert.deepEqual(readProcWindow(file,4),{text:'0123',truncated:true});
        assert.deepEqual(readProcWindow(file,10),{text:'0123456789',truncated:false});
        const read=fs.readSync;
        try{
            fs.readSync=(fd,buffer,offset,length,position)=>read(fd,buffer,offset,Math.min(length,2),position);
            assert.deepEqual(readProcWindow(file,4),{text:'0123',truncated:true},'short proc-style reads are not EOF');
            assert.deepEqual(readProcWindow(file,12),{text:'0123456789',truncated:false});
        }finally{fs.readSync=read;}
        assert.equal(readProcWindow(path.join(directory,'missing'),4).error,'ENOENT');
    }finally{fs.rmSync(directory,{recursive:true,force:true});}
});

test('startup observation cannot mask a child failure when its artifact cannot be written',async()=>{
    const directory=fs.mkdtempSync(path.join(os.tmpdir(),'chrome-observer-'));
    const child=spawn(process.execPath,['-e',"process.stderr.write('isolated startup failure');process.exit(7)"],{stdio:['ignore','ignore','pipe']});
    const observer=observeChromeStartup(child,{port:65530,output:directory});
    try{
        await new Promise(resolve=>child.once('close',resolve));
        const evidence=await observer.finish('failed');
        assert.equal(child.exitCode,7);assert.equal(evidence.exit.code,7);
        assert.match(evidence.artifactError,/directory|EISDIR|EPERM/i);
        assert.match(evidence.stderrHead,/isolated startup failure/);
        assert.notEqual(evidence.firstStderrMs,null);
    }finally{fs.rmSync(directory,{recursive:true,force:true});}
});

test('Linux slow-start observation is limited to the target tree and stops its tracer', {skip:process.platform!=='linux'},async()=>{
    const directory=fs.mkdtempSync(path.join(os.tmpdir(),'chrome-observer-'));
    const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:['ignore','ignore','pipe']});
    const observer=observeChromeStartup(child,{port:65530,output:path.join(directory,'startup.json')});
    try{
        await new Promise(resolve=>setTimeout(resolve,5200));
        const start=Date.now(),evidence=await observer.finish('diagnostic fixture complete');
        assert.ok(Date.now()-start<1500,'observer cleanup is bounded');
        assert.equal(child.exitCode,null,'observation must not stop the target');
        assert.ok(evidence.samples.some(s=>s.processes.some(p=>p.pid===child.pid)));
        assert.ok(evidence.samples.every(s=>s.processes.every(p=>p.pid!==process.pid)),'no parent/system-wide process scan');
        assert.ok(evidence.trace?.unavailable||evidence.trace?.exit||evidence.trace?.error||evidence.trace?.drainedAfterKill);
        assert.equal(JSON.parse(fs.readFileSync(path.join(directory,'startup.json'),'utf8')).outcome,'diagnostic fixture complete');
    }finally{
        const closed=new Promise(resolve=>child.once('close',resolve));child.kill();await closed;
        fs.rmSync(directory,{recursive:true,force:true});
    }
});

for(const phase of ['headers','JSON body']){
    test('DevTools deadline aborts stalled '+phase,async()=>{
        let requests=0;
        const sockets=new Set();
        const server=http.createServer((request,response)=>{
            requests++;
            if(phase==='JSON body'){
                response.writeHead(200,{'Content-Type':'application/json'});
                response.flushHeaders();response.write('[{');
            }
        });
        server.on('connection',socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket));});
        await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
        let watchdog;
        try{
            const probe=waitJson('http://127.0.0.1:'+server.address().port+'/json/list',{timeoutMs:100});
            await assert.rejects(Promise.race([probe,new Promise((_,reject)=>{
                watchdog=setTimeout(()=>reject(new Error('test watchdog: probe remained unbounded')),2500);
            })]),error=>{
                assert.equal(error.code,'ETIMEDOUT');
                assert.match(error.devToolsDiagnostics.directHttp.error,/diagnostic timeout/);
                return true;
            });
            assert.ok(requests>=2,'primary and failure diagnostic must reach the isolated server');
        }finally{
            clearTimeout(watchdog);for(const socket of sockets)socket.destroy();
            await new Promise(resolve=>server.close(resolve));
        }
    });
}

test('DevTools deadline retains normal JSON success',async()=>{
    const server=http.createServer((request,response)=>response.end(JSON.stringify([{type:'page',id:'real-response'}])));
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    try{
        assert.deepEqual(await waitJson('http://127.0.0.1:'+server.address().port+'/json/list'),[{type:'page',id:'real-response'}]);
    }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});

test('interrupted diagnostic response cannot leave startup failure pending',async()=>{
    const server=http.createServer((request,response)=>{
        response.writeHead(200,{'Content-Type':'application/json'});response.flushHeaders();response.write('[{');
        setTimeout(()=>response.destroy(),15);
    });
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    let watchdog;
    try{
        await assert.rejects(Promise.race([
            waitJson('http://127.0.0.1:'+server.address().port+'/json/list',{timeoutMs:50}),
            new Promise((_,reject)=>{watchdog=setTimeout(()=>reject(new Error('test watchdog: interrupted diagnostic remained pending')),2500);})
        ]),error=>{
            assert.ok(error.devToolsDiagnostics,'startup failure retains diagnostics');
            assert.match(error.devToolsDiagnostics.directHttp.error,/aborted|ECONNRESET/);return true;
        });
    }finally{clearTimeout(watchdog);server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});

test('failed DevTools fetch retains direct HTTP evidence without turning failure into success',async()=>{
    const server=http.createServer((request,response)=>{response.setHeader('Content-Type','application/json');response.end(JSON.stringify([{type:'page'}]));});
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const originalFetch=globalThis.fetch;
    try{
        globalThis.fetch=async()=>{throw Object.assign(new Error('injected fetch refusal'),{code:'ECONNREFUSED'});};
        await assert.rejects(waitJson('http://127.0.0.1:'+server.address().port+'/json/list',{timeoutMs:1}),error=>{
            assert.equal(error.message,'injected fetch refusal');
            assert.deepEqual(error.devToolsDiagnostics.directHttp,{status:200,pageTargets:1});
            return true;
        });
    }finally{globalThis.fetch=originalFetch;await new Promise(resolve=>server.close(resolve));}
});

test('unavailable DevTools listener remains a failure with direct connection evidence',async()=>{
    const server=http.createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const port=server.address().port;await new Promise(resolve=>server.close(resolve));
    await assert.rejects(waitJson('http://127.0.0.1:'+port+'/json/list',{timeoutMs:1}),error=>{
        assert.equal(error.devToolsDiagnostics.directHttp.error,'ECONNREFUSED');return true;
    });
});

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
            const observeChromeStartup=()=>({finish(){}});
            class Cdp{};
            const collectStartupFailure=async()=>{throw Error('CDP must not exist');};`;
        const source=original.replace(/^import \{ROOT,findChrome,startServer,waitJson,Cdp,collectStartupFailure,observeChromeStartup\} from .*;$/m,dependencies)
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
