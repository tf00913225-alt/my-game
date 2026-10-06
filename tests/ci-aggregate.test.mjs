import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {CHILD_GATES, requireChildGates, DEPLOYMENT_GATES, requireDeploymentGates} from '../.github/scripts/ci-aggregate.mjs';
import {classifyChanges} from '../.github/scripts/ci-change-classifier.mjs';

const passed = () => Object.fromEntries(CHILD_GATES.map(key => [key, {result: 'success'}]));
test('deployed aggregate accepts all pass and rejects every failure, skip or cancellation',()=>{
  const passed=()=>Object.fromEntries(DEPLOYMENT_GATES.map(k=>[k,{result:'success'}]));
  assert.equal(requireDeploymentGates(passed()),true);
  for(const key of DEPLOYMENT_GATES) for(const result of ['failure','skipped','cancelled',undefined]) {
    const needs=passed();needs[key]={result};assert.throws(()=>requireDeploymentGates(needs),/did not pass/);
  }
});
test('every parallel deployed QA binds its pre/post manifest checks to the same exact SHA',()=>{
  const text=fs.readFileSync(new URL('../.github/workflows/deploy-dev-cloudflare.yml',import.meta.url),'utf8');
  for(const key of DEPLOYMENT_GATES.filter(k=>k!=='publish_dev')) {
    const job=text.split('\n  '+key+':')[1].split(/\n  [a-z_]+:/)[0];
    assert.match(job,/needs: publish_dev/);assert.match(job,/EXPECTED_COMMIT_SHA: \$\{\{ github.sha \}\}/);
    assert.equal((job.match(/node \.github\/scripts\/release-gate\.mjs verify-deployed/g)||[]).length,2);
    assert.match(job,/ref: \$\{\{ github.sha \}\}/);
  }
  const aggregate=text.split('\n  deploy:')[1];
  assert.match(aggregate,/name: Deploy dev preview\n    if: always\(\)/);
  assert.deepEqual(aggregate.match(/needs: \[([^\]]+)\]/)[1].split(',').map(v=>v.trim()),[...DEPLOYMENT_GATES]);
});
test('all children pass => aggregate passes', () => assert.equal(requireChildGates(passed()), true));
for (const key of CHILD_GATES) {
  for (const result of ['failure', 'cancelled', 'skipped', 'neutral', 'queued', undefined]) {
    test(`${key} ${result} => aggregate rejects`, () => {
      const needs = passed(); needs[key] = {result};
      assert.throws(() => requireChildGates(needs), /did not pass/);
    });
  }
}
test('only explicit non-main policy accepts main browser skip', () => {
  const needs = passed(); needs.main_browser.result = 'skipped';
  assert.equal(requireChildGates(needs, {mainRequired: false}), true);
  needs.boss_balance.result = 'skipped';
  assert.throws(() => requireChildGates(needs, {mainRequired: false}), /boss_balance/);
});

test('legal docs classifier skips pass, failure/cancellation never does', () => {
  const plan=classifyChanges(['docs/readme.md'],{enabled:true});
  const needs=passed();
  for(const key of CHILD_GATES) if(plan.gates[key]===false) needs[key].result='skipped';
  assert.equal(requireChildGates(needs,{mainRequired:false,plan}),true);
  needs.boss_balance.result='cancelled';
  assert.throws(()=>requireChildGates(needs,{mainRequired:false,plan}),/boss_balance/);
});
test('missing classifier / forged strict or dev-push skips fail closed', () => {
  for(const eventName of ['push','pull_request']) {
    const plan=classifyChanges(['.github/workflows/ci.yml'],{enabled:true,eventName});
    plan.gates.boss_balance=false;
    assert.throws(()=>requireChildGates(passed(),{mainRequired:false,plan}),/cannot skip/);
  }
  const needs=passed();needs.classify.result='failure';
  assert.throws(()=>requireChildGates(needs,{mainRequired:false}),/classify/);
});
test('full dev/nightly require Session and boot, while promotion-only is skipped', () => {
  for(const eventName of ['push','schedule']) {
    const plan=classifyChanges(['docs/readme.md'],{eventName,baseRef:'dev',fullRegression:eventName==='schedule'});
    const needs=passed();needs.promotion_health.result='skipped';
    assert.equal(requireChildGates(needs,{mainRequired:true,plan}),true);
    needs.session_authority.result='skipped';
    assert.throws(()=>requireChildGates(needs,{mainRequired:true,plan}),/session_authority/);
  }
});
test('reused Session cannot deploy or deadlock with the standalone Firebase waiter', () => {
  const ci=fs.readFileSync(new URL('../.github/workflows/ci.yml',import.meta.url),'utf8');
  const session=fs.readFileSync(new URL('../.github/workflows/session-authority.yml',import.meta.url),'utf8');
  assert.match(ci,/uses: \.\/\.github\/workflows\/session-authority\.yml[\s\S]*?emulator_only: true/);
  assert.match(session,/if: \$\{\{ !inputs\.emulator_only &&/);
  assert.match(session,/inputs\.emulator_only && format\('session-emulator-\{0\}', github\.run_id\)/);
});
test('missing or unknown dependency fails closed', () => {
  const needs = passed(); delete needs.core_checks;
  assert.throws(() => requireChildGates(needs), /core_checks/);
  assert.throws(() => requireChildGates({...passed(), rogue: {result: 'success'}}), /Unknown/);
});
test('public barrier waits for every required child; deployment only follows barrier', () => {
  const text = fs.readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  const barrier = text.split('\n  verify:')[1].split('\n  deploy_dev:')[0];
  assert.match(barrier, /name: Repository checks\n    if: always\(\)/);
  const dependencies = barrier.match(/needs: \[([^\]]+)\]/)[1].split(',').map(v => v.trim());
  assert.deepEqual(dependencies, [...CHILD_GATES]);
  assert.match(barrier, /run: node \.github\/scripts\/ci-aggregate\.mjs/);
  assert.match(text.split('\n  deploy_dev:')[1], /needs: verify/);
});

test('dev deployment survives legitimate ancestor skips but rejects failed validation and cancellation', () => {
  const workflow=fs.readFileSync(new URL('../.github/workflows/ci.yml',import.meta.url),'utf8');
  const deployment=workflow.split('\n  deploy_dev:')[1];
  const expression=deployment.match(/if: \$\{\{ (.+) \}\}/)[1];
  assert.match(expression,/!cancelled\(\)/,'explicit status function overrides implicit success() ancestor skip propagation');
  const eligible=new Function('cancelled','needs','github',`return ${expression};`);
  const github={event_name:'push',ref:'refs/heads/dev'};
  const needs={verify:{result:'success'},promotion_health:{result:'skipped'}};
  assert.equal(eligible(()=>false,needs,github),true);
  for(const result of ['failure','cancelled','skipped','neutral','queued',undefined]) {
    assert.equal(eligible(()=>false,{...needs,verify:{result}},github),false,result);
  }
  assert.equal(eligible(()=>true,needs,github),false);
  for(const event_name of ['pull_request','workflow_dispatch','schedule']) {
    assert.equal(eligible(()=>false,needs,{...github,event_name}),false,event_name);
  }
  assert.equal(eligible(()=>false,needs,{...github,ref:'refs/heads/main'}),false);
});

test('isolated Tower runner prepares the directory required by its existing TTK writer', () => {
  const text = fs.readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  const tower = text.split('\n  tower_wild_browser:')[1].split('\n  portrait_browser:')[0];
  const prepare = tower.indexOf('run: mkdir -p artifacts/browser-qa');
  const write = tower.indexOf('node scripts/tower-balance-ttk-matrix.mjs artifacts/browser-qa/');
  assert.ok(prepare >= 0 && write > prepare, 'TTK output cannot depend on a previous browser job');
});

test('full Node suites obey classifier full-node policy independently of main-only browsers',()=>{
  const workflow=fs.readFileSync('.github/workflows/ci.yml','utf8');
  assert.match(workflow,/name: Run all Node unit and integration suites\n\s+if: needs\.classify\.outputs\.full_node == 'true'/);
});
