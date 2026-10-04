import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {performance} from 'node:perf_hooks';

// CI verify has a 40-minute execution cap. Allow five additional minutes for
// runner admission/API visibility; deploy retains 15 minutes after this wait.
export const WAIT_BUDGET_MS = 45 * 60 * 1000;
export const POLL_INTERVAL_MS = 10 * 1000;
const TARGET = 'Repository checks';
const OWNER = '.github/workflows/ci.yml';

function exactRun(run, sha) {
  return run.path === OWNER && run.event === 'push' &&
    run.head_branch === 'dev' && run.head_sha === sha;
}

export async function waitForRepositoryChecks({sha, repository, api, currentDev,
  now = () => performance.now(), sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
  log = console.log, budgetMs = WAIT_BUDGET_MS, pollMs = POLL_INTERVAL_MS}) {
  if (!/^[a-f0-9]{40}$/.test(sha) || !/^[\w.-]+\/[\w.-]+$/.test(repository) ||
      !Number.isFinite(budgetMs) || budgetMs <= 0 || !Number.isFinite(pollMs) || pollMs <= 0) {
    throw new Error('Invalid Session Authority wait configuration');
  }
  const deadline = now() + budgetMs;
  let last = 'run=missing attempt=missing job=missing';
  const fail = reason => { throw new Error(`${reason}; sha=${sha} target=${OWNER}/${TARGET} ${last}`); };
  const remaining = () => {
    const ms = deadline - now();
    if (ms <= 0) fail(`Timed out waiting for ${TARGET} after ${budgetMs}ms`);
    return ms;
  };
  const requireCurrent = () => {
    let actual;
    try { actual = currentDev(remaining()); }
    catch (error) { fail(`Current dev query failed: ${error.message}`); }
    remaining();
    if (actual !== sha) fail(`Stale dev rejected (current=${actual})`);
  };
  const get = endpoint => {
    let result;
    try { result = api(endpoint, remaining()); }
    catch (error) { fail(`CI API query failed: ${error.message}`); }
    remaining();
    return result;
  };
  log(`Waiting for ${TARGET}: sha=${sha} budgetMs=${budgetMs} pollMs=${pollMs}`);
  while (true) {
    requireCurrent();
    const response = get(`repos/${repository}/actions/runs?head_sha=${sha}&event=push&branch=dev&per_page=100`);
    if (!Array.isArray(response.workflow_runs)) fail('Invalid workflow run response');
    // Never fall back to an older successful run when the newest exact owner fails.
    const run = response.workflow_runs.filter(item => exactRun(item, sha))
      .sort((a, b) => b.id - a.id)[0];
    last = 'run=missing attempt=missing job=missing';
    if (run) {
      last = `run=${run.id} attempt=${run.run_attempt} runStatus=${run.status}/${run.conclusion ?? 'pending'} job=missing`;
      if (!Number.isSafeInteger(run.id) || !Number.isSafeInteger(run.run_attempt) || run.run_attempt < 1) fail('Invalid run identity');
      if (run.status === 'completed' && run.conclusion !== 'success') fail('CI run did not succeed');
      const response = get(`repos/${repository}/actions/runs/${run.id}/attempts/${run.run_attempt}/jobs?per_page=100`);
      if (!Array.isArray(response.jobs)) fail('Invalid workflow job response');
      const jobs = response.jobs.filter(job => job.name === TARGET);
      if (jobs.length > 1) fail('Ambiguous Repository checks jobs');
      const job = jobs[0];
      if (job) {
        last += ` job=${job.id} jobStatus=${job.status}/${job.conclusion ?? 'pending'}`;
        // Successful unchanged jobs can be carried into a failed-jobs rerun;
        // the attempt endpoint is authoritative, not the job's original attempt.
        if (job.run_id !== run.id || job.head_sha !== sha) fail('Job identity mismatch');
        if (job.status === 'completed' && job.conclusion !== 'success') fail('Repository checks did not succeed');
        if (job.status === 'completed' && job.conclusion === 'success') {
          // Re-read latest metadata: a rerun/new run may start during job lookup.
          const fresh = get(`repos/${repository}/actions/runs?head_sha=${sha}&event=push&branch=dev&per_page=100`);
          if (!Array.isArray(fresh.workflow_runs)) fail('Invalid workflow run response');
          const latest = fresh.workflow_runs.filter(item => exactRun(item, sha)).sort((a, b) => b.id - a.id)[0];
          if (latest?.id === run.id && latest.run_attempt === run.run_attempt) {
            if (latest.status === 'completed' && latest.conclusion !== 'success') fail('CI run did not succeed');
            requireCurrent();
            log(`Repository checks accepted: sha=${sha} ${last}`);
            return {sha, runId: run.id, attempt: run.run_attempt, jobId: job.id};
          }
          last += ' latest run/attempt changed; reselecting';
        }
      } else if (run.status === 'completed') {
        fail('Completed CI run is missing Repository checks');
      }
    }
    log(`Waiting: sha=${sha} ${last} remainingMs=${Math.ceil(remaining())}`);
    await sleep(Math.min(pollMs, remaining()));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // Every external command consumes the same deadline and has its own finite cap.
  const command = (file, args, remainingMs) => execFileSync(file, args, {
    encoding: 'utf8', timeout: Math.max(1, Math.min(30_000, Math.floor(remainingMs))),
    maxBuffer: 8 * 1024 * 1024
  }).trim();
  try {
    await waitForRepositoryChecks({sha: process.env.GITHUB_SHA, repository: process.env.GITHUB_REPOSITORY,
      api: (endpoint, ms) => JSON.parse(command('gh', ['api', endpoint], ms)),
      currentDev: ms => command('git', ['ls-remote', 'origin', 'refs/heads/dev'], ms).split(/\s+/)[0]
    });
  } catch (error) {
    console.error(`::error::${error.message}`);
    process.exitCode = 1;
  }
}
