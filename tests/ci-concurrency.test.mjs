import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
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
  assert.match(job,/fetch-depth: 0/);
  assert.match(job,/ref: \$\{\{ inputs.candidate_sha \|\| github.event.pull_request.head.sha \|\| github.sha \}\}/);
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
