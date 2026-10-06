import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

export const HEALTH_CONTEXT = 'Full Regression Health';
export function selectHealth(response, sha, repository) {
  if (response?.sha !== sha || !Array.isArray(response.statuses)) throw Error('Health response SHA mismatch');
  const status=response.statuses.filter(s=>s.context===HEALTH_CONTEXT).sort((a,b)=>b.id-a.id)[0];
  if (!status || status.state !== 'success') throw Error(`Unresolved full regression health: ${status?.state ?? 'missing'}`);
  if (!status.description?.startsWith(sha+' ')) throw Error('Health evidence candidate mismatch');
  const prefix=`https://github.com/${repository}/actions/runs/`;
  if (!status.target_url?.startsWith(prefix) || !/^\d+$/.test(status.target_url.slice(prefix.length))) throw Error('Invalid health run URL');
  return {status, runId:Number(status.target_url.slice(prefix.length))};
}
export function requireHealthyRun(run, sha) {
  const devPush=run.path==='.github/workflows/ci.yml' && run.event==='push' && run.head_branch==='dev' && run.head_sha===sha;
  const nightly=run.path==='.github/workflows/full-regression-nightly.yml' && ['schedule','workflow_dispatch'].includes(run.event);
  if ((!devPush && !nightly) || run.status!=='completed' || run.conclusion!=='success') throw Error('Full regression owner run is not complete/successful');
  return true;
}
if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  try {
    const command=(file,args)=>execFileSync(file,args,{encoding:'utf8',timeout:30_000,maxBuffer:8*1024*1024}).trim();
    const repo=process.env.GITHUB_REPOSITORY;
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw Error('Invalid repository identity');
    const sha=command('git',['ls-remote','origin','refs/heads/dev']).split(/\s+/)[0];
    if (!/^[a-f0-9]{40}$/.test(sha)) throw Error('Cannot resolve exact dev candidate');
    command('git',['fetch','--no-tags','--depth=1','origin',sha]);
    if (command('git',['rev-parse',`${sha}^{tree}`])!==command('git',['rev-parse','HEAD^{tree}'])) throw Error('Promotion candidate tree differs from current dev');
    const api=endpoint=>JSON.parse(command('gh',['api',endpoint]));
    const health=selectHealth(api(`repos/${repo}/commits/${sha}/status`),sha,repo);
    requireHealthyRun(api(`repos/${repo}/actions/runs/${health.runId}`),sha);
    if (command('git',['ls-remote','origin','refs/heads/dev']).split(/\s+/)[0]!==sha) throw Error('dev advanced during health verification');
    console.log(`Full Regression Health verified: exact dev ${sha}, run ${health.runId}`);
  } catch(error) {console.error(`::error::${error.message}`);process.exitCode=1;}
}
