import test from 'node:test';
import assert from 'node:assert/strict';
import {selectHealth,requireHealthyRun,HEALTH_CONTEXT} from '../.github/scripts/full-regression-health.mjs';
const sha='a'.repeat(40),repo='owner/repo';
const status=(extra={})=>({id:1,context:HEALTH_CONTEXT,state:'success',description:sha+' full regression PASS',target_url:`https://github.com/${repo}/actions/runs/20`,...extra});
const response=(statuses=[status()])=>({sha,statuses});
const run=(extra={})=>({path:'.github/workflows/ci.yml',event:'push',head_branch:'dev',head_sha:sha,status:'completed',conclusion:'success',...extra});
test('exact full dev success is accepted',()=>{assert.equal(selectHealth(response(),sha,repo).runId,20);assert.equal(requireHealthyRun(run(),sha),true);});
test('latest failure/pending/error cannot fall back to earlier success',()=>{
  for(const state of ['failure','pending','error',null]) assert.throws(()=>selectHealth(response([status(),status({id:2,state})]),sha,repo),/Unresolved/);
});
test('missing, wrong SHA, wrong evidence or URL fails closed',()=>{
  for(const r of [{sha:'b'.repeat(40),statuses:[status()]},response([]),response([status({description:'old candidate'})]),response([status({target_url:'https://example.com/20'})])]) assert.throws(()=>selectHealth(r,sha,repo));
});
test('failed/stale/PR CI cannot supply full dev evidence',()=>{
  for(const extra of [{head_sha:'b'.repeat(40)},{event:'pull_request'},{conclusion:'failure'},{status:'in_progress'},{head_branch:'main'},{path:'other.yml'}]) assert.throws(()=>requireHealthyRun(run(extra),sha));
});
test('manual full CI may record exact dev health',()=>assert.equal(requireHealthyRun(run({event:'workflow_dispatch'}),sha),true));
test('completed nightly owner may report pinned dev SHA through health status',()=>assert.equal(requireHealthyRun(run({path:'.github/workflows/full-regression-nightly.yml',event:'schedule',head_branch:'main'}),sha),true));
