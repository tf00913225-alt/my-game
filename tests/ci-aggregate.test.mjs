import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {CHILD_GATES, requireChildGates} from '../.github/scripts/ci-aggregate.mjs';
import {classifyChanges} from '../.github/scripts/ci-change-classifier.mjs';

const passed = () => Object.fromEntries(CHILD_GATES.map(key => [key, {result: 'success'}]));
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

test('isolated Tower runner prepares the directory required by its existing TTK writer', () => {
  const text = fs.readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  const tower = text.split('\n  tower_wild_browser:')[1].split('\n  portrait_browser:')[0];
  const prepare = tower.indexOf('run: mkdir -p artifacts/browser-qa');
  const write = tower.indexOf('node scripts/tower-balance-ttk-matrix.mjs artifacts/browser-qa/');
  assert.ok(prepare >= 0 && write > prepare, 'TTK output cannot depend on a previous browser job');
});
