import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
const ci=fs.readFileSync(new URL('../.github/workflows/ci.yml',import.meta.url),'utf8');
const group=ci.match(/  group: ci-\$\{\{ (.+) \}\}/)[1];
const cancel=ci.match(/  cancel-in-progress: \$\{\{ (.+) \}\}/)[1];
const format=(template,...args)=>template.replace(/\{(\d+)\}/g,(_,n)=>args[n]);
const evaluate=(expression,github,inputs={})=>new Function('github','inputs','format',`return ${expression}`)(github,inputs,format);
const context=(overrides={})=>({event_name:'pull_request',base_ref:'dev',ref:'refs/pull/10/merge',event:{pull_request:{number:10}},run_id:1,...overrides});
test('same PR supersedes stale head, separate PR groups remain isolated',()=>{
  const a=context(),b=context({run_id:2});
  assert.equal(evaluate(group,a),evaluate(group,b));assert.equal(evaluate(cancel,b),true);
  assert.notEqual(evaluate(group,a),evaluate(group,context({event:{pull_request:{number:11}}})));
});
test('new dev run cancels earlier dev CI including its reusable deployment',()=>{
  const a=context({event_name:'push',ref:'refs/heads/dev'}),b={...a,run_id:2};
  assert.equal(evaluate(group,a),evaluate(group,b));assert.equal(evaluate(cancel,b),true);
  assert.match(ci,/uses: \.\/\.github\/workflows\/deploy-dev-cloudflare.yml/);
});
test('nightly, candidate, main and release retain isolated groups and are not cancelled',()=>{
  for(const [github,inputs] of [
    [context({event_name:'schedule',ref:'refs/heads/main'}),{candidate_sha:'a'.repeat(40),full_regression:true}],
    [context(),{candidate_sha:'b'.repeat(40)}],
    [context({event_name:'push',ref:'refs/heads/dev',sha:'a'.repeat(40)}),{full_regression:true}],
    [context({base_ref:'main'}),{}],
    [context({event_name:'push',ref:'refs/heads/main'}),{}],
    [context({event_name:'workflow_dispatch',ref:'refs/heads/release/test'}),{}]
  ]) {
    assert.equal(Boolean(evaluate(cancel,github,inputs)),false);
    assert.notEqual(evaluate(group,github,inputs),evaluate(group,context()),'main/release/full cannot share ordinary dev-target PR group');
    assert.notEqual(evaluate(group,github,inputs),evaluate(group,context({event_name:'push',ref:'refs/heads/dev'})));
  }
  const nightly=fs.readFileSync(new URL('../.github/workflows/full-regression-nightly.yml',import.meta.url),'utf8');
  assert.match(nightly,/group: full-regression-nightly-dev\n  cancel-in-progress: false/);
  assert.match(nightly,/full_regression: true/);
  const deploy=fs.readFileSync(new URL('../.github/workflows/deploy-dev-cloudflare.yml',import.meta.url),'utf8');
  assert.match(deploy,/group: cloudflare-pages-dev\n  cancel-in-progress: true/);
  assert.notEqual('cloudflare-pages-dev','ci-'+evaluate(group,context({event_name:'push',ref:'refs/heads/dev'})));
});
test('targeted integration cannot publish full regression health and stale dev is rejected before tests',()=>{
  const start=ci.split('\n  health_start:')[1].split('\n  health_record:')[0];
  assert.match(start,/if: inputs.full_regression \|\| github.event_name == 'workflow_dispatch'/);
  assert.doesNotMatch(start,/event_name == 'push'/);
  const classify=ci.split('\n  classify:')[1].split('\n  core_checks:')[0];
  assert.ok(classify.indexOf('Reject superseded dev integration before testing') < classify.indexOf('Install pinned CI parser'));
  assert.match(classify,/git ls-remote origin refs\/heads\/dev/);
});
test('classifier alone receives complete ancestry and exact PR head',()=>{
  const job=ci.split('\n  classify:')[1].split('\n  core_checks:')[0];
  assert.match(job,/fetch-depth: 1/);
  assert.match(job,/Fetch exact classifier comparison ancestry/);
  assert.match(job,/ancestry_options\+=\(--unshallow\)/);
  assert.match(job,/test "\$\(git rev-parse --is-shallow-repository\)" = false/);
  assert.match(job,/ref: \$\{\{ inputs.candidate_sha \|\| github.event.pull_request.head.sha \|\| github.sha \}\}/);
});

test('classifier scoped fetch preserves divergent ancestry without unrelated refs and refuses unavailable commits',()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'classifier-ancestry-'));
  const git=(cwd,...args)=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  const source=path.join(directory,'source'),target=path.join(directory,'target');
  const script=ci.split('      - name: Fetch exact classifier comparison ancestry\n')[1]
    .split('      - name: Confirm exact regression source snapshot')[0].split('        run: |\n')[1]
    .split('\n').filter(line=>line.startsWith('          ')).map(line=>line.slice(10)).join('\n');
  const bash=process.platform==='win32'?path.join(process.env.ProgramFiles||'C:/Program Files','Git/bin/bash.exe'):'bash';
  try{
    fs.mkdirSync(source);git(source,'init','-b','main');
    git(source,'config','user.name','isolated fixture');git(source,'config','user.email','fixture@example.invalid');
    const commit=(name,value)=>{fs.writeFileSync(path.join(source,name),value);git(source,'add',name);git(source,'commit','-m',value);return git(source,'rev-parse','HEAD');};
    const ancestor=commit('base.md','ancestor');
    git(source,'checkout','-b','feature');const head=commit('feature.md','feature');
    git(source,'checkout','main');const base=commit('base.md','advanced base');
    git(source,'checkout','--orphan','unrelated');git(source,'rm','-rf','.');
    const unrelated=commit('unrelated.md','unrelated');git(source,'tag','unrelated-tag');
    git(directory,'clone','--no-tags','--depth=1','--branch','feature',pathToFileURL(source).href,target);
    assert.equal(git(target,'rev-parse','--is-shallow-repository'),'true');
    const run=(comparisonBase,comparisonHead=head)=>execFileSync(bash,['-c',script],{cwd:target,
      env:{...process.env,CI_BASE_SHA:comparisonBase,CI_HEAD_SHA:comparisonHead},stdio:['ignore','pipe','pipe']});
    run(base);
    assert.equal(git(target,'rev-parse','HEAD'),head);
    assert.equal(git(target,'rev-parse','--is-shallow-repository'),'false');
    assert.equal(git(target,'merge-base',base,head),ancestor);
    assert.equal(git(target,'diff','--name-only',base+'...'+head),'feature.md');
    assert.equal(git(target,'diff','--name-only',ancestor+'..'+base),'base.md');
    assert.equal(git(target,'show',ancestor+':base.md'),'ancestor');
    assert.equal(git(target,'tag','--list'),'');
    assert.doesNotMatch(git(target,'branch','-r'),/unrelated/);
    assert.throws(()=>git(target,'cat-file','-e',unrelated+'^{commit}'));
    run(unrelated);
    assert.throws(()=>git(target,'merge-base',unrelated,head),'unrelated histories remain fail-closed');
    assert.throws(()=>run('f'.repeat(40)),'unavailable exact base cannot silently fall back');
    assert.throws(()=>run(base,'invalid'),'invalid head cannot start fetch');
  }finally{fs.rmSync(directory,{recursive:true,force:true});}
});
test('affected live QA never starts after failed publication; manual dispatch remains full',()=>{
  const workflow=fs.readFileSync(new URL('../.github/workflows/deploy-dev-cloudflare.yml',import.meta.url),'utf8');
  for(const [job,input] of [['boss_live','boss_required'],['tower_live','tower_required'],['abyss_live','abyss_required'],['adventure_live','adventure_required'],['battle_daily_live','battle_daily_required']]) {
    const block=workflow.split('\n  '+job+':')[1].split(/\n  [a-z_]+:/)[0];
    const expression=block.match(/if: \$\{\{ (.+) \}\}/)[1];
    const eligible=new Function('cancelled','needs','github','inputs',`return ${expression}`);
    const github={event_name:'push'},inputs={[input]:true};
    assert.equal(eligible(()=>false,{publish_dev:{result:'success'}},github,inputs),true);
    assert.equal(eligible(()=>false,{publish_dev:{result:'success'}},github,{[input]:false}),false);
    assert.equal(eligible(()=>false,{publish_dev:{result:'success'}},{event_name:'workflow_dispatch'},{[input]:false}),true);
    for(const result of ['failure','cancelled','skipped',undefined]) assert.equal(eligible(()=>false,{publish_dev:{result}},github,inputs),false);
  }
});
