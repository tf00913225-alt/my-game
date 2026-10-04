import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {waitForRepositoryChecks, WAIT_BUDGET_MS} from '../.github/scripts/wait-session-repository-checks.mjs';

const sha = 'a'.repeat(40), otherSha = 'b'.repeat(40);
const run = (extra = {}) => ({id: 20, run_attempt: 1, path: '.github/workflows/ci.yml',
  event: 'push', head_branch: 'dev', head_sha: sha, status: 'in_progress', conclusion: null, ...extra});
const job = (extra = {}) => ({id: 30, run_id: 20, head_sha: sha, name: 'Repository checks',
  status: 'completed', conclusion: 'success', ...extra});

function fixture({runs = () => [run()], jobs = () => [job()], current = () => sha,
  budgetMs = 100, costMs = 0} = {}) {
  let time = 0, lists = 0;
  const calls = [], logs = [];
  const promise = waitForRepositoryChecks({sha, repository: 'owner/repo', budgetMs, pollMs: 10,
    now: () => time, sleep: async ms => {time += ms;}, log: line => logs.push(line),
    currentDev: () => current(time), api: endpoint => {
      calls.push(endpoint); time += costMs;
      if (endpoint.includes('/jobs?')) return {jobs: jobs(time, endpoint)};
      return {workflow_runs: runs(time, ++lists)};
    }});
  return {promise, calls, logs, time: () => time};
}

test('accepts exact dev push Repository checks and logs SHA/run/attempt/job', async () => {
  const f = fixture();
  assert.deepEqual(await f.promise, {sha, runId: 20, attempt: 1, jobId: 30});
  assert.ok(f.calls.some(p => p.includes('/20/attempts/1/jobs')));
  assert.match(f.logs.at(-1), /accepted: sha=.*run=20 attempt=1.*job=30/);
});

test('historical 25m32s CI completes after old 80x10s budget but inside formal cap', async () => {
  const f = fixture({budgetMs: WAIT_BUDGET_MS, jobs: time => [job(time < (25 * 60 + 32) * 1000
    ? {status: 'in_progress', conclusion: null} : {})]});
  await f.promise;
  assert.ok(f.time() > 80 * 10_000);
  assert.ok(f.time() < WAIT_BUDGET_MS);
});

test('wait accommodates full CI cap plus bounded runner admission', async () => {
  const f = fixture({budgetMs: WAIT_BUDGET_MS,
    runs: time => time < 4 * 60_000 ? [] : [run()],
    jobs: time => [job(time < 44 * 60_000 ? {status: 'in_progress', conclusion: null} : {})]});
  await f.promise;
  assert.equal(f.time(), 44 * 60_000);
});

for (const conclusion of ['failure', 'cancelled', 'timed_out', 'skipped', 'neutral', 'action_required', null]) {
  test(`rejects completed Repository checks: ${conclusion}`, async () => {
    await assert.rejects(fixture({jobs: () => [job({conclusion})]}).promise, /did not succeed.*sha=.*run=20 attempt=1/);
  });
}

test('rejects failed/cancelled/timed-out workflow even with successful target job', async () => {
  for (const conclusion of ['failure', 'cancelled', 'timed_out']) {
    await assert.rejects(fixture({runs: () => [run({status: 'completed', conclusion})]}).promise, /CI run did not succeed/);
  }
});

test('other SHA / PR / dispatch / branch / workflow successes never satisfy wait', async () => {
  for (const extra of [{head_sha: otherSha}, {event: 'pull_request'}, {event: 'workflow_dispatch'},
    {head_branch: 'main'}, {path: '.github/workflows/other.yml'}]) {
    const f = fixture({runs: () => [run({...extra, status: 'completed', conclusion: 'success'})]});
    await assert.rejects(f.promise, /Timed out.*sha=.*Repository checks.*run=missing/);
    assert.equal(f.calls.some(p => p.includes('/jobs?')), false);
  }
});

test('newest exact run failure cannot fall back to older success', async () => {
  await assert.rejects(fixture({runs: () => [run({id: 19, status: 'completed', conclusion: 'success'}),
    run({status: 'completed', conclusion: 'failure'})]}).promise, /CI run did not succeed.*run=20/);
});

test('rerun selects latest attempt and never its old successful attempt', async () => {
  const f = fixture({runs: () => [run({run_attempt: 2})], jobs: (time, endpoint) => {
    assert.match(endpoint, /attempts\/2\/jobs/);
    return [job({conclusion: 'failure'})];
  }});
  await assert.rejects(f.promise, /did not succeed.*attempt=2/);
});

test('rerun beginning between lookup and acceptance must be reselected', async () => {
  const f = fixture({runs: (time, list) => [run({run_attempt: list === 1 ? 1 : 2})],
    jobs: (time, endpoint) => [job(endpoint.includes('/2/') ? {conclusion: 'failure'} : {})]});
  await assert.rejects(f.promise, /did not succeed.*attempt=2/);
  assert.ok(f.calls.some(p => p.includes('/attempts/2/jobs')));
});

test('failed-jobs rerun can carry unchanged successful target job via attempt endpoint', async () => {
  const f = fixture({runs: () => [run({run_attempt: 2})], jobs: () => [job({run_attempt: 1})]});
  assert.equal((await f.promise).attempt, 2);
});

test('missing run/job remains bounded; completed run missing target fails immediately', async () => {
  for (const config of [{runs: () => []}, {jobs: () => []}]) {
    const f = fixture(config);
    await assert.rejects(f.promise, /Timed out.*sha=.*target=.*job=missing/);
    assert.equal(f.time(), 100);
  }
  await assert.rejects(fixture({runs: () => [run({status: 'completed', conclusion: 'success'})], jobs: () => []}).promise,
    /missing Repository checks/);
});

test('rejects mismatched SHA/run and ambiguous named jobs', async () => {
  for (const extra of [{head_sha: otherSha}, {run_id: 19}]) {
    await assert.rejects(fixture({jobs: () => [job(extra)]}).promise, /Job identity mismatch/);
  }
  await assert.rejects(fixture({jobs: () => [job(), job({id: 31})]}).promise, /Ambiguous/);
});

test('stale dev rejects initially, during polling, and immediately before acceptance', async () => {
  await assert.rejects(fixture({current: () => otherSha}).promise, /Stale dev rejected/);
  await assert.rejects(fixture({jobs: () => [job({status: 'in_progress', conclusion: null})],
    current: time => time >= 10 ? otherSha : sha}).promise, /Stale dev rejected/);
  let reads = 0;
  await assert.rejects(fixture({current: () => ++reads === 1 ? sha : otherSha}).promise, /Stale dev rejected/);
});

test('API time consumes same deadline; delayed success cannot pass after exhaustion', async () => {
  const f = fixture({costMs: 60});
  await assert.rejects(f.promise, /Timed out.*sha=.*run=20 attempt=1/);
  assert.equal(f.time(), 120);
});

test('queued/pending jobs wait then succeed and exhausted state identifies target', async () => {
  const f = fixture({jobs: time => [job(time < 20 ? {status: 'queued', conclusion: null} : {})]});
  await f.promise;
  assert.equal(f.time(), 20);
  await assert.rejects(fixture({jobs: () => [job({status: 'in_progress', conclusion: null})]}).promise,
    /Timed out.*run=20 attempt=1.*jobStatus=in_progress\/pending/);
});

test('workflow invokes tested owner and retains finite execution reserve and security gates', () => {
  const workflow = fs.readFileSync(new URL('../.github/workflows/session-authority.yml', import.meta.url), 'utf8');
  assert.match(workflow, /run: node \.github\/scripts\/wait-session-repository-checks\.mjs/);
  assert.doesNotMatch(workflow, /seq 1 80/);
  const deploy = workflow.split('\n  deploy:')[1];
  const cap = Number(deploy.match(/timeout-minutes: (\d+)/)[1]);
  assert.ok(cap * 60_000 >= WAIT_BUDGET_MS + 15 * 60_000);
  assert.match(deploy, /needs: emulator/);
  assert.match(deploy, /github\.ref == 'refs\/heads\/dev'/);
  assert.match(deploy, /firebase-native-auth-backend\n      cancel-in-progress: false/);
  assert.match(deploy, /FIREBASE_DEPLOY_SERVICE_ACCOUNT_JSON/);
  assert.match(deploy, /firestore-backup-readiness\.mjs/);
  assert.match(deploy, /test "\$\(git ls-remote origin refs\/heads\/dev \| cut -f1\)" = "\$GITHUB_SHA"\n          npx/);
});
