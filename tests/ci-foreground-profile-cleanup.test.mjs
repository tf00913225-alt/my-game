import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {EventEmitter} from 'node:events';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import test from 'node:test';
const file=new URL('../.github/scripts/run-foreground-potion-browser-qa.mjs',import.meta.url);
const source=fs.readFileSync(file,'utf8');
function fixture({alive=true,event='close',timeout=false,rmError=false,symlink=false,tempRoot=os.tmpdir()}={}){
 const profile=fs.mkdtempSync(path.join(fs.realpathSync(tempRoot),'foreground-potion-test-'));
 const proc=new EventEmitter();proc.exitCode=alive?null:0;proc.signalCode=null;
 let running=alive,removals=0,logged=0,options;
 proc.kill=signal=>{assert.equal(signal,'SIGKILL');if(!timeout)setTimeout(()=>{running=false;proc.signalCode=signal;proc.emit(event);},5);return true;};
 const fakeFs={...fs,lstatSync:target=>symlink?{isSymbolicLink:()=>true}:fs.lstatSync(target),rmSync:(target,opts)=>{assert.equal(running,false,'profile removed while Chrome still alive');removals++;options=opts;if(rmError)throw Object.assign(Error('busy'),{code:'EBUSY'});fs.rmSync(target,opts);}};
 const context={fs:fakeFs,os:{tmpdir:()=>tempRoot},path,console:{error:()=>logged++},setTimeout:(fn,ms)=>setTimeout(fn,ms===3000?25:ms),clearTimeout};
 const start=source.indexOf('async function cleanupForegroundProfile('),end=source.indexOf('async function run(',start);
 const cleanup=vm.runInNewContext(source.slice(start,end)+';cleanupForegroundProfile',context);
 return {profile,proc,cleanup,get removals(){return removals},get logged(){return logged},get options(){return options},dispose(){fs.rmSync(profile,{recursive:true,force:true});}};
}
test('original cleanup reproduces removal before delayed Chrome exit',()=>{
 // Exact former cleanup at baseline 863833e062e7f23c1458115b639f58231d9f3fdd;
 // keep this local fixture usable in shallow CI checkouts.
 const original="c?.close();proc.kill('SIGKILL');fs.rmSync(profile,{recursive:true,force:true});";
 let alive=true;
 assert.throws(()=>vm.runInNewContext(original,{c:null,proc:{kill:()=>setTimeout(()=>alive=false,5)},profile:'fixture',fs:{rmSync:()=>{assert.equal(alive,false,'ENOTEMPTY race: Chrome remains alive');}}}),/Chrome remains alive/);
});
for(const event of ['close','exit'])test('delayed '+event+' precedes profile removal',async()=>{
 const h=fixture({event});try{await h.cleanup(h.proc,h.profile);assert.equal(h.removals,1);assert.equal(h.proc.listenerCount(event),0);assert.equal(h.options.maxRetries,3);assert.equal(h.options.retryDelay,100);}finally{h.dispose();}
});
test('already exited child needs no kill',async()=>{const h=fixture({alive:false});h.proc.kill=()=>assert.fail('already exited');try{await h.cleanup(h.proc,h.profile);assert.equal(h.removals,1);}finally{h.dispose();}});
test('exit timeout retains profile and reports path',async()=>{const h=fixture({timeout:true});try{await assert.rejects(h.cleanup(h.proc,h.profile),error=>error.message.includes('timeout')&&error.message.includes(h.profile));assert.equal(h.removals,0);assert.ok(fs.existsSync(h.profile));assert.equal(h.proc.listenerCount('close'),0);}finally{h.dispose();}});
test('cleanup failure preserves original QA error identity',async()=>{const h=fixture({alive:false,rmError:true}),primary=Error('original QA assertion');try{await assert.rejects((async()=>{try{throw primary;}finally{await h.cleanup(h.proc,h.profile,primary);}})(),error=>error===primary);assert.equal(h.logged,1);assert.equal(primary.message,'original QA assertion');}finally{h.dispose();}});
test('foreign and symlink profile paths refuse deletion and kill',async()=>{
 const h=fixture({alive:false}),foreign=fs.mkdtempSync(path.join(os.tmpdir(),'other-qa-'));
 h.proc.kill=()=>assert.fail('unsafe path must not kill');
 try{await assert.rejects(h.cleanup(h.proc,foreign),/Unsafe/);assert.equal(h.removals,0);
 const linked=fixture({alive:false,symlink:true});try{await assert.rejects(linked.cleanup(linked.proc,linked.profile),/Unsafe/);assert.equal(linked.removals,0);}finally{linked.dispose();}
 }finally{h.dispose();fs.rmSync(foreign,{recursive:true,force:true});}
});

test('real child exits before its disposable profile is removed',async()=>{
 const h=fixture();const child=spawn(process.execPath,['-e',"process.stdout.write('ready');setInterval(()=>{},1000)"],{stdio:['ignore','pipe','ignore']});
 try{await once(child.stdout,'data');const start=source.indexOf('async function cleanupForegroundProfile('),end=source.indexOf('async function run(',start);const cleanup=vm.runInNewContext(source.slice(start,end)+';cleanupForegroundProfile',{fs,os,path,console,setTimeout,clearTimeout});await cleanup(child,h.profile);assert.ok(child.exitCode!==null||child.signalCode!==null);assert.equal(fs.existsSync(h.profile),false);}finally{if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');h.dispose();}
});

test('a symlinked temp parent is accepted only through its canonical child path',async()=>{
 const h=fixture({alive:false}),requested=path.join(path.dirname(h.profile),'temp-parent-alias',path.basename(h.profile));
 const fakeFs={...fs,lstatSync:p=>fs.lstatSync(p===requested?h.profile:p),realpathSync:p=>p===requested?h.profile:fs.realpathSync(p)};
 const start=source.indexOf('async function cleanupForegroundProfile('),end=source.indexOf('async function run(',start);
 const cleanup=vm.runInNewContext(source.slice(start,end)+';cleanupForegroundProfile',{fs:fakeFs,os:{tmpdir:()=>path.dirname(requested)},path,console,setTimeout,clearTimeout});
 // Model /tmp -> /private/tmp without requiring symlink privileges.
 fakeFs.realpathSync=p=>p===requested?h.profile:p===path.dirname(requested)?path.dirname(h.profile):fs.realpathSync(p);
 try{await cleanup(h.proc,requested);assert.equal(fs.existsSync(h.profile),false);}finally{h.dispose();}
});

test('replacement directory at the same path is retained after delayed exit',async()=>{
 const root=fs.mkdtempSync(path.join(path.resolve('.'),'foreground-cleanup-test-'));
 const h=fixture({tempRoot:root}),moved=h.profile+'-original';
 h.proc.kill=()=>{fs.renameSync(h.profile,moved);fs.mkdirSync(h.profile);fs.writeFileSync(path.join(h.profile,'replacement'),'keep');setTimeout(()=>{h.proc.signalCode='SIGKILL';h.proc.emit('close');},5);return true;};
 try{await assert.rejects(h.cleanup(h.proc,h.profile),/Unsafe/);assert.equal(h.removals,0);assert.equal(fs.readFileSync(path.join(h.profile,'replacement'),'utf8'),'keep');assert.ok(fs.existsSync(moved));}
 finally{h.dispose();fs.rmSync(moved,{recursive:true,force:true});fs.rmdirSync(root);}
});
