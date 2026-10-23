import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {once} from 'node:events';
import test from 'node:test';
import {readStartupResourceWindow,observeProcPageWait} from '../.github/scripts/runtime-browser-qa-support.mjs';

function fixture(){
    const root=fs.mkdtempSync(path.join(os.tmpdir(),'startup-resource-'));
    const procRoot=path.join(root,'proc'),cgroupRoot=path.join(root,'cgroup');
    const base=path.join(procRoot,'42'),group=path.join(cgroupRoot,'runner','job');
    fs.mkdirSync(base,{recursive:true});fs.mkdirSync(group,{recursive:true});
    fs.mkdirSync(path.join(procRoot,'pressure'));
    fs.writeFileSync(path.join(base,'cgroup'),'0::/runner/job\n');
    fs.writeFileSync(path.join(procRoot,'pressure/io'),'some avg10=1.00 total=123\n');
    fs.writeFileSync(path.join(procRoot,'pressure/cpu'),'some avg10=0.00 total=4\n');
    fs.writeFileSync(path.join(group,'io.stat'),'8:0 rbytes=100\n');
    fs.writeFileSync(path.join(group,'io.max'),'8:0 rbps=max\n');
    fs.writeFileSync(path.join(group,'io.pressure'),'full avg10=0.00 total=12\n');
    return {root,procRoot,cgroupRoot,base,group};
}

test('resource evidence reads only current cgroup, bounds bytes and retains missing fields',()=>{
    const f=fixture();
    try{
        fs.writeFileSync(path.join(f.group,'io.stat'),'x'.repeat(5000));
        const result=readStartupResourceWindow(f.base,f);
        assert.equal(result.cgroup.path,'/runner/job');
        assert.match(result.pressure.io.text,/total=123/);
        assert.equal(result.cgroup['io.stat'].text.length,4096);
        assert.equal(result.cgroup['io.stat'].truncated,true);
        assert.equal(result.cgroup['cpu.stat'].error,'ENOENT');
        assert.equal(fs.readFileSync(path.join(f.group,'io.max'),'utf8'),'8:0 rbps=max\n','collection cannot alter limits');
        assert.ok(Number.isFinite(result.sampleMonotonicMs)&&Number.isFinite(result.timeOriginMs));
    }finally{fs.rmSync(f.root,{recursive:true,force:true});}
});

test('invalid or unsupported cgroup binding never falls back to root or an ancestor',()=>{
    const f=fixture();
    try{
        for(const binding of ['0::/../outside\n','0::/runner/./job\n','0::/runner\\job\n']){
            fs.writeFileSync(path.join(f.base,'cgroup'),binding);
            const result=readStartupResourceWindow(f.base,f);
            assert.equal(result.cgroup.error,'INVALID_CGROUP_PATH');
            assert.equal(result.cgroup['io.max'],undefined);
        }
        fs.writeFileSync(path.join(f.base,'cgroup'),'5:cpu:/runner/job\n');
        assert.equal(readStartupResourceWindow(f.base,f).cgroup.error,'CGROUP_V2_BINDING_UNAVAILABLE');
        fs.writeFileSync(path.join(f.base,'cgroup'),'0::/'+ 'x'.repeat(5000));
        const result=readStartupResourceWindow(f.base,f);
        assert.equal(result.cgroup.binding.truncated,true);
        assert.equal(result.cgroup.path,undefined);
    }finally{fs.rmSync(f.root,{recursive:true,force:true});}
});

test('permission denial is evidence, not an empty group or permission fallback',()=>{
    const f=fixture(),open=fs.openSync;
    try{
        const denied=path.join(f.group,'io.max');
        fs.openSync=(file,...args)=>{if(file===denied)throw Object.assign(new Error('fixture denial'),{code:'EACCES'});return open(file,...args);};
        const result=readStartupResourceWindow(f.base,f);
        assert.equal(result.cgroup['io.max'].error,'EACCES');
        assert.match(result.cgroup['io.pressure'].text,/total=12/);
    }finally{fs.openSync=open;fs.rmSync(f.root,{recursive:true,force:true});}
});

test('a directory redirected to a different group inside the root is rejected',()=>{
    const f=fixture();
    try{
        const alias=path.join(f.cgroupRoot,'runner','alias');
        fs.symlinkSync(f.group,alias,process.platform==='win32'?'junction':'dir');
        fs.writeFileSync(path.join(f.base,'cgroup'),'0::/runner/alias\n');
        const result=readStartupResourceWindow(f.base,f);
        assert.equal(result.cgroup.error,'REDIRECTED_CGROUP_DIRECTORY');
        assert.equal(result.cgroup['io.max'],undefined);
    }finally{fs.rmSync(f.root,{recursive:true,force:true});}
});

test('a redirected metadata file is rejected instead of reading another file',()=>{
    const f=fixture(),realpath=fs.realpathSync;
    try{
        const redirected=path.join(f.group,'io.max');
        fs.realpathSync=(file,...args)=>file===redirected?path.join(f.group,'other-group-limit'):realpath(file,...args);
        const result=readStartupResourceWindow(f.base,f);
        assert.equal(result.cgroup['io.max'].error,'REDIRECTED_CGROUP_FILE');
        assert.equal(result.cgroup['io.max'].text,undefined);
    }finally{fs.realpathSync=realpath;fs.rmSync(f.root,{recursive:true,force:true});}
});

test('existing worker serializes resource capture and retains an unavailable process',async()=>{
    const created=once(process,'worker');
    const collector=observeProcPageWait('/proc/2147483647');
    const [worker]=await created;
    await once(worker,'exit');
    assert.equal(collector.evidence.status,'captured');
    assert.ok(collector.evidence.resources.cgroup.binding.error);
    assert.equal(collector.evidence.budgetMs,200);
});
