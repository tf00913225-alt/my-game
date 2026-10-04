# P2 Session Authority CI wait convergence — 2026-10-04

Work ID: P2-SESSION-CI-WAIT-20261004. NORMAL DEVELOPMENT; no Freeze/RC.
Start dev: `0de3c3a5c9c5aff789b071f9bd89b4dcdce413d9`.
Protected main: `f63d69dbfa66ba75637d1c3cd7fcc7d74782e356`.
Branch: `chore/p2-session-ci-wait-convergence-20261004`; target dev.
Work PR owns current integration/deployment/cleanup evidence; this source record
does not claim those gates have completed.

## Confirmed cause and historical evidence (UTC)

Read the full failed deployment job logs and successful attempt logs through
GitHub, and all-attempt job metadata through the official REST API. No canceled
CI, stale commit or wrong owner selection is present in these two failures.

| SHA | Session run / failed job (attempt 1) | Wait step | CI run / Repository checks job (attempt 1) | Repository checks execution | Session attempt 2 success job |
| --- | --- | --- | --- | --- | --- |
| fe84524b47408224d17c09384dcd46d71306cca0 | 37190573579 / 111402407246 | 09:02:19–09:17:23 | 37190573763 / 111401688817 | 08:57:13–09:22:45 (25m32s) | 111405944828, 09:23:22–09:26:28 |
| a0c4cf3ccf6b83278f9940da7f71516d9c98cfa4 | 37192593665 / 111408494787 | 09:39:54–09:54:20 | 37192593797 / 111407744337 | 09:34:30–10:00:02 (25m32s) | 111411878508, 10:00:44–10:03:32 |

Both failed logs end with `Timed out waiting for Repository checks.` and exit 1;
all Firebase/auth/readiness/deploy steps were skipped. Successful reruns started
after the same exact SHA's Repository checks succeeded and printed Firebase
`Deploy complete!`. CI had one attempt. Session reruns did not select another SHA.

The reportedly healthy latest baseline also needed Session attempt 2:
CI37200431153/job111430819138 ran 11:56:51–12:22:06 (25m15s);
Session37200430849 deploy111431581787 failed 12:02:06–12:17:47;
deploy111435085738 succeeded 12:23:10–12:26:43. Latest SUCCESS is not proof of
healthy first-attempt waiting. This additional baseline is corroboration, not a
replacement for the two complete failed/success log investigations above.

Old wait: 80 polls, sleep10s each, plus remote/API latency (~14–15m observed).
Deploy cap20m. Formal Repository checks cap40m, raised by Daily CI work (#784).
The independently triggered Session workflow finishes its emulator in ~4–5m;
its wait therefore exhausts ~5m before ordinary CI completion. The current
CI cap and its consumer wait were not kept aligned. Rerunning only after CI
completion bypassed the delay but did not repair the mismatch.

## Responsibility and replacement

- Workflow/deploy owner: `.github/workflows/session-authority.yml::deploy`.
- One wait implementation: `.github/scripts/wait-session-repository-checks.mjs::waitForRepositoryChecks`.
  The inline loop is physically removed; no wrapper, temporary patch, second CI
  or alternate deployment owner.
- Formal dependency: `.github/workflows/ci.yml::verify`, job `Repository checks`,
  event=push, branch=dev, head_sha=expected SHA. Other same-named PR checks do not qualify.
- Workflow concurrency `session-authority-${github.ref}` and deployment group
  `firebase-native-auth-backend`, both cancel-in-progress=false, unchanged.
- No other Session wait/late overwrite was found in the direct workflow/helper
  search. Existing emulator dependency and final pre-Firebase current-dev guard
  remain. All downstream secrets, read-only readiness and deploy steps match the
  baseline parsed YAML exactly. Existing gcloud metadata continue-on-error is
  unchanged; no new continue-on-error or CI bypass.
- Classification: Replacement of the existing wait implementation, bounded
  maintenance repair. No gameplay, cloud authority rules, player data or production changes.

## Bounded contract after repair

45m monotonic elapsed deadline = existing40m CI execution cap +5m finite
runner admission/API visibility allowance. Poll interval stays10s; external
commands are bounded to30s or the remaining deadline, whichever is shorter.
API time is included. Deploy cap60m =45m wait +15m checkout/auth/readiness/deploy
reserve (observed successful rerun total ~3m). Missing runners/checks beyond this
finite allowance still fail; this is not an unlimited queue guarantee.

Select newest exact dev push CI run explicitly by ID. Read jobs through
`actions/runs/{run_id}/attempts/{run_attempt}/jobs`, then re-resolve latest
run/attempt before accepting success. GitHub's attempt endpoint is authoritative
for carried successful jobs in failed-job reruns; no older attempt is queried.
Relevant official API docs: https://docs.github.com/en/rest/actions/workflow-jobs
and https://docs.github.com/en/rest/actions/workflow-runs .

Reject terminal CI failure/cancellation/timeout, unsuccessful target jobs,
completed runs missing the job, mismatched identity and duplicate named jobs.
Queued/missing/in-progress observations wait only within the shared deadline.
Check current dev initially, each poll, before acceptance, and again through the
unchanged final deployment step. Rerun detection selects the new attempt rather
than using old success. No new workflow_run/needs/reusable scheduling is introduced;
push/PR/dispatch/rerun semantics and the number of deployment invocations remain
the existing workflow's responsibility. Logs identify expected SHA/run/attempt/job,
remaining budget and last state; failure exits nonzero.

## Validation and remaining closeout gates

- Direct behavioral test:22/22 PASS, including historical normal CI beyond old
  wait, full40m execution plus finite admission delay, exact SHA/owner filtering,
  failure/cancel/timeout/missing, old-success/new-failure, attempt race, carried
  successful jobs, stale dev and time consumed by API calls.
- Existing session-client / trusted-backend regressions:20/20 PASS.
- YAML parsing and semantic comparison PASS; only wait/tests/paths/cap changed.
- npm build/build:check PASS; generated production files unchanged.
- architecture/release/deprecated gates and git diff --check PASS.
- Tests execute in the existing Session emulator job on PR/push, including helper
  path changes. No permanent one-off workflow and no destructive CI test.

Required before COMPLETE: latest PR Head required CI + Session emulator SUCCESS,
latest-dev owner check, dev merge, first-attempt merged-dev CI/Session wait logs
showing exact SHA/run/attempt and Firebase success, DEV deployment exact manifest
SHA/Game+Cache173.73, unchanged main, absorbed source branch safe deletion.
Do not use a manual rerun success alone as repair evidence.

Non-goals: package173.69.0, retired inspect workflow, Java/Google/Firebase warning
upgrades, repository cleanup, cloud/monster next phases or main release.
