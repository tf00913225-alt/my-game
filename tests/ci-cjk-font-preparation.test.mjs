import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import test from 'node:test';
import {parse} from 'yaml';

const source=fs.readFileSync(new URL('../.github/scripts/ensure-cjk-fonts.sh',import.meta.url),'utf8');
const bash=process.platform==='win32'?path.join(process.env.ProgramFiles||'C:/Program Files','Git/bin/bash.exe'):'bash';
function run(initial,behavior='ok',script=source){
    return spawnSync(bash,['-c',`
font_state='${initial}'
rg(){ echo 'unexpected rg dependency' >&2; return 127; }
fc-list(){
    [[ "$*" == ':lang=zh' ]] || return 91
    case "$font_state" in ready) printf 'Noto Sans CJK:lang=zh\\n';; broken) return 9;; *) printf ' \\n';; esac
}
sudo(){
    printf 'APT:%s\\n' "$*"
    [[ "$1" == apt-get ]] || return 92
    if [[ "$2" == update ]]; then
        [[ '${behavior}' != update-fails ]] || return 7
    elif [[ "$*" == 'apt-get install --yes --no-install-recommends fonts-noto-cjk' ]]; then
        [[ '${behavior}' != install-fails ]] || return 8
        [[ '${behavior}' == still-missing ]] || font_state=ready
    else return 93; fi
}
${script}`],{encoding:'utf8'});
}
test('negative control reproduces old installed-font false negative without rg',()=>{
    const result=run('ready','ok',`set -euo pipefail
if ! fc-list :lang=zh | rg -q .; then
    sudo apt-get update
    sudo apt-get install --yes --no-install-recommends fonts-noto-cjk
fi`);
    assert.equal(result.status,0,result.stderr);
    assert.match(result.stderr,/unexpected rg dependency/);
    assert.match(result.stdout,/APT:apt-get install/);
});
test('already available CJK font skips apt even without rg',()=>{
    const result=run('ready');
    assert.equal(result.status,0,result.stderr);
    assert.doesNotMatch(result.stdout,/APT:/);
    assert.match(result.stdout,/support verified/);
});
test('missing font installs once and verifies the actual post-install font',()=>{
    const result=run('missing');
    assert.equal(result.status,0,result.stderr);
    assert.deepEqual(result.stdout.split('\n').filter(x=>x.startsWith('APT:')),['APT:apt-get update','APT:apt-get install --yes --no-install-recommends fonts-noto-cjk']);
    assert.match(result.stdout,/support verified/);
});
for(const [initial,behavior,status] of [['broken','ok',9],['missing','update-fails',7],['missing','install-fails',8],['missing','still-missing',1]]){
    test(`font preparation fails closed: ${initial}/${behavior}`,()=>{
        const result=run(initial,behavior);
        assert.equal(result.status,status,result.stderr);
        assert.doesNotMatch(result.stdout,/support verified/);
        if(initial==='broken') assert.doesNotMatch(result.stdout,/APT:/);
        if(behavior==='update-fails') assert.doesNotMatch(result.stdout,/APT:apt-get install/);
    });
}
test('CI and dev browser jobs use the same font preparation without changing Abyss deadline',()=>{
    let callers=0;
    for(const name of ['ci.yml','deploy-dev-cloudflare.yml']){
        const workflow=parse(fs.readFileSync(new URL(`../.github/workflows/${name}`,import.meta.url),'utf8'));
        for(const job of Object.values(workflow.jobs)){
            for(const step of job.steps||[]){
                if(!/Ensure CJK font/.test(step.name||'')) continue;
                assert.equal(step.run,'bash .github/scripts/ensure-cjk-fonts.sh');
                callers++;
            }
        }
        if(name==='ci.yml') assert.equal(workflow.jobs.abyss_balance['timeout-minutes'],40);
    }
    assert.equal(callers,16);
});
