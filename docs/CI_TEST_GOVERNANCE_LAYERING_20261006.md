# CI test governance layering

Work ID: `CI-TEST-GOVERNANCE-LAYERING-20261006`
Target: dev; main writes forbidden.
Branch: `feature/ci-test-governance-layering-20261006`.
Status: Phase 1 implementation; remote validation pending.

## Phase 0 evidence

- Read latest GitHub dev: `5ffa4d1e979279b8ee57bfde356e637b8f3471f6`.
- Read main: `f63d69dbfa66ba75637d1c3cd7fcc7d74782e356`.
- Open PR search: #806 Wind EX; no existing CI layering PR.
- Branch protection full endpoints: **UNVERIFIED**, HTTP 403 Resource not
  accessible by integration. Branch metadata reports main's Repository checks
  context, but is not treated as a complete protection/ruleset audit.
- `.github/workflows/ci.yml`: Repository checks serialized target lifecycle,
  bottom navigation/potion, Daily, Hit/Evasion, Tower/Wild, responsive/forge,
  touch/navigation, update notification, fixed slots, battle live, portraits,
  Adventure, skill/backpack. Boot/relic browser and all Node suites were main-only.
- Independent CI jobs: Abyss Phase2D, Adventure Phase2E, Boss Phase2F.
- `session-authority.yml`: independent emulator, then dev-only Firebase deploy;
  `wait-session-repository-checks.mjs` explicitly waits for the exact dev push
  `.github/workflows/ci.yml` job named `Repository checks`. It rejects stale
  dev, failed runs, old attempts and wrong SHA. This external name is preserved.
- Dev deployment previously needs verify/Abyss/Adventure/Boss; reusable
  `deploy-dev-cloudflare.yml` checks current dev, packages immutable artifact,
  deploys exact SHA, verifies release manifest, and runs deployed responsive,
  forge/potion, battle/target, Daily, Tower, Abyss, Adventure and Boss QA.
- Production deploy is workflow_run CI success on main push only; exact verified
  checkout, stale-main checks, release-ready/build, immutable artifact, manifest
  verification and production runtime QA remain untouched.
- Existing dev baseline CI run: `37346751274`, SUCCESS. Historical runtime
  estimates in the task are hypotheses until actual run/job logs are compared.

## Phase 1 owner and topology

CI orchestration remains `.github/workflows/ci.yml`; result policy is
`.github/scripts/ci-aggregate.mjs`. Original test/evidence steps are moved, not
deleted. Independent browser runners isolate server ports and artifacts.

`core_checks`, `battle_browser`, `ui_browser`, `daily_browser`,
`tower_wild_browser`, `portrait_browser`, `adventure_ui_browser`,
`main_browser`, `abyss_balance`, `adventure_balance`, `boss_balance`
→ `verify` (**Repository checks**) → dev deployment.

The barrier uses always() and rejects missing, failure, cancellation, queued,
neutral or unexpected skipped children. Only main_browser's existing non-main
skip is allowed in Phase 1. Session does not wait on core_checks: it waits on
this final barrier. Its finite wait becomes 65m to cover the existing 60m Boss
cap plus runner/API reserve; Firebase job retains 15m after that wait.

All prior test commands, conditions, evidence uploads and main-only gates are
preserved. No PR changed-path skipping is enabled yet. No dev/production
deployment contract is replaced. Gameplay, save state and release versions are
unchanged.

## Validation and phase transitions

- Local aggregate and Session contract tests: 92/92 PASS.
- YAML parse/semantic checks: PASS; every original step is still present;
  step references remain in the same child job; needs reference valid jobs.
- Whitespace: PASS. Remote Latest Head CI and actual timing remain pending.
- First remote execution exposed an implicit serial dependency: Tower TTK
  writer expected `artifacts/browser-qa` to exist from an earlier browser step.
  Job `112089964859` failed ENOENT; isolated browser jobs now explicitly create
  their evidence directory. No assertion or test was removed. Regression added.
- Latest dev `8224dab26348dee1e3c506d1fcdcf91001869a6e` was absorbed by normal
  merge, preserving #806 Wind EX and its newly deployed Hit/Evasion QA.
- Actual baseline run `37346751274`: verify 29m11s; Boss 34m27s; Abyss 18m54s;
  Adventure 4m15s; dev deployment 78m53s. Final barrier must still wait for Boss.
- Phase 2 may start only after Phase 1 remote validation. Classifier shadow
  mode must precede conditional PR gates; dev push must remain full.
- Phase 3 scheduled full regression/health must preserve current main CI and
  deployment; main promotion is not authorized by this engineering task.

## Rollback

Phase 1: revert the Phase 1 commit to restore original serial verify and wait
budget together. Phase 2: disable PR skip, retaining full CI and classifier
shadow evidence. Phase 3: if unstable, remove its new health blocking role;
never remove existing dev/main gates to work around failure.

Final status/evidence, exact Head, timings and deployment belong to the Work PR.
Until those gates pass this work is **NOT COMPLETE**.
