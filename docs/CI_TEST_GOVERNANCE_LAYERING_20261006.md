# CI test governance layering

Work ID: `CI-TEST-GOVERNANCE-LAYERING-20261006`
Target: dev; main writes forbidden.
Branch: `feature/ci-test-governance-layering-20261006`.
Status: Original layering integrated. Current Boss tier optimization is owned by
Work ID CI-BOSS-TIERED-GATES-20261008, branch feature/ci-boss-tiered-gates-20261008.
Latest Head, Required CI, integration and cleanup evidence belong to its PR.

## Current routing owner (supersedes historical phase restrictions below)

The classifier remains the single routing owner. PR comparisons require a real
merge base and exact PR head; only its checkout receives full ancestry. dev push
compares exact before/after trees. Missing SHA, unrelated histories, invalid/new
unowned runtime and unexplained generated outputs retain strict fallback.

Known existing presentation declarations in js/00-main.js and explicitly mapped
reforge/shop declarations in the shared content/equipment modules are compared by Acorn
AST boundaries. Unchanged surrounding source, declaration identity and call/write
effects are required; new declarations, new effects and unknown shared changes
are strict. Shop/character presentation routes to UI; battle presentation routes
to battle and Boss Fast. Boss/Tower source routes to Boss/Tower/battle Full. MonsterBalance routes to
all affected balance modes, Daily and battle, with full Node regressions.

Generated bundles/manifests and restricted-policy digest may follow their source
only after production build --check, registered-output validation and a real
source change. Generated-only changes stay strict. CI routing/aggregate/workflow
owners run core and full Node contract suites; other CI/build/release owners stay
strict. Full Boss retains all nine scenarios at both phone sizes. No Full
scenario, required assertion or failure propagation is removed. The new
observer failure propagation exposed an existing dead-Boss/live-support
formation bug: the Boss Owner now retains context authority until completion
or abort, including after the body dies. This necessary blocker repair changes
no stats, AI, damage, rewards, progression, save or account authority, and must
pass Full plus natural/deployed snapshot acceptance itself.

Boss mode is emitted by the same classifier for PR and dev push and passed
unchanged to deployed QA: `none` for reliably isolated inventory/shop/docs;
`fast` for known battle presentation/animation; `full` for Boss rules, balance,
unknown/shared effects, core/lifecycle/settlement, Cloud/persistence, release and manual/nightly.
Cloud/persistence uses Boss Full on both PR and dev, including its required flag.
Inventory/reforge routes still execute the existing eligibility, synthesis,
equipment and selection regressions in core_checks. The affected step runs
them sequentially only when full_node is false; full_node already includes
the same tests. No new test system or relaxed assertions are introduced.
Unmapped mechanisms cannot use Fast merely because a filename sounds visual.
The existing floating-feedback and skill-name presentation CSS owners route
to UI/battle Fast; their Runtime timing/lifecycle JS remains strict.
CI policy edits exercise Fast and retained Full themselves. Generated outputs
still require exact build verification; shared call arguments and complete
writes must remain identical, not just the callee/write destination.
Even otherwise pure declarations retain parameter/async/generator signatures;
directives, dynamic scope, debugger, delete and implicit iterator edits stay strict.
Dynamic imports and tagged calls are effects; tagged-template raw arguments remain intact.
Only unshadowed Math rounding of numeric literals is treated as a pure diagnostic;
opaque used bindings and control flow remain fixed even in otherwise pure declarations.
Effectful presentation functions also retain control-flow/guard/early-return
order, used local bindings and default parameters; changing a call input via
an alias cannot masquerade as unchanged effects. canActuallyReforge/reforgeSlotCount are consumed by transactions and
are deliberately excluded from presentation routing; their changes stay Full.

Fast uses real Runtime natural personal-20 victory/first rewards/progression,
personal-70 and world-40 stage 4 up to ten completed rounds (early natural
victory retains settlement checks). Separate controlled personal-70 HP .34
and world-stage round-7 probes run real actions after formal mechanism owners
trigger summons/charge/phases/shield. The HP probe equips a legal level-1
windSpell loadout and requires actual status RNG plus a committed agilityDown
event from formal actions; it never injects a successful status result.
They never claim natural victory.
390x844 runs combat; 412x915 verifies all three formal entries, visible HUD,
target rules and status-detail interaction without replaying complete battles.
Explicit controlled viewport state triggers HP/round mechanisms to verify
support/object DOM slots and shield at 412x915 too; these are zero-action UI
probes, never natural combat or settlement. Status/HUD capture holds retain
both important screens before formal abort.
Bounded probes release observers and use the existing dungeon abort, dispose
VFX, then assert inactive Boss/dungeon/battle/auto state, cleared timers/locks
and no late turn or reward. Both neutral and seeded all-Boss TTK remain.
Artifacts distinguish Fast/Full, natural/controlled/UI scenes, total rounds,
verified settlements, elapsed time and skipped coverage/reason. Actual CI
timings and latest Head acceptance belong to the Work PR; no fixed savings
percentage is promised. Historical timing records below remain unchanged.

Ordinary dev integration now uses affected gates. main/release, manual full CI,
Nightly and unknown changes retain full validation. Targeted dev runs never
publish Full Regression Health. Nightly/manual full evidence is still required
for promotion; main publication remains separately authorized. Nightly schedule
activation still requires its separately authorized arrival on the default branch.

CI concurrency isolates PR number, dev integration and full candidate/run ID.
Only ordinary dev-target PR/dev push runs cancel older runs in the same group.
The parent cancellation includes its reusable dev deployment; latest-dev guard
rejects an already superseded integration before testing. Nightly/main/release
and separate workflows are isolated. Exact deployed SHA checks remain before
and after every affected QA group. Publisher and responsive live smoke remain
mandatory; each other deployed group accepts only an explicit affected-mode
skip, never failure/cancellation/missing evidence. Manual deployment defaults full.

## Historical implementation evidence

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

## Phase 1 remote acceptance / Phase 2 shadow checkpoint

Exact Head `ab146b3701d5c3a2b151825881449b15dfd09062`: CI run
`37408209921` SUCCESS, Repository checks SUCCESS, Session Authority
`37408209717` emulator SUCCESS. All original test/evidence steps retained.
Real failure propagation: earlier run `37407980798` Tower failure resulted in
Repository checks FAILURE after all required children settled.
Execution: core 1m42s, UI 8m35s, Daily 8m57s, Tower/Wild 13m28s, Battle 10m18s,
Portrait 1m05s, Adventure balance 4m19s, Abyss 18m19s, Boss 34m14s.
Final barrier takes the Boss critical path, not merely the split serial group.

Classifier owner: `.github/scripts/ci-change-classifier.mjs`. Unit fixtures cover
Battle, UI, Cloud, Portrait, Docs, MonsterBalance, Release, Workflow, unknown
runtime, unavailable comparison, new files, shadow and full dev/main behavior.
Shadow emits predicted/effective gates in every PR summary; original full gates
remain. Classifier itself is also a required aggregate child.
Generated build/manifest diffs are strict as required; many UI PRs containing
such generated changes can therefore still run the full matrix.
Automatic schedule activation is blocked until a separately authorized main
release: main is this repository's default branch, and GitHub only schedules
workflows present there. This task must not modify main or default-branch settings.

## Phase 2 enforced checkpoint

Remote Shadow classifier job `112100800243` on Head `668ec9ff42c5e3e1e27456b4b728e5c323d2ef29`
passed all fixtures and emitted SHADOW with every original gate retained; CI
run `37411524319` remains supplementary full execution. Eight representative
fixtures plus fail-closed cases passed before enabling conditional PR gates.
Enforcement is restricted to PRs into dev. main-target PRs and all non-PR
contexts force full gates. Aggregate validates the classifier child and schema;
failure/cancellation never count as legal skips. Pure docs can skip balance and
browser jobs; unknown source, generated manifest/build, CI/framework/shared
owners remain strict. Runtime files under docs are not document-only changes.

## Phase 3 full regression / health

dev push runs all Node suites and every browser job, including boot/relic,
plus the existing Session Authority emulator in validation-only mode. Called
emulators have per-run concurrency groups, avoiding a cycle with standalone
Firebase deployment waiting for Repository checks. Original Session job name,
security tests, credentials and bounded wait remain; reuse cannot deploy.

Nightly `23 20 * * *` targets Taiwan 04:23, pins current dev once, and reuses
full CI. Every checkout uses the pinned SHA and an independent source-SHA
assertion. All Node, Battle/Hit, Daily, Tower/Wild, Abyss, Adventure, Boss,
UI/Forge/navigation, skill/backpack/portrait, boot/relic, Cloud/Session and
build/release/artifact gates execute. It never deploys. Scheduling is NOT ACTIVE
until this workflow reaches main through a separately authorized release.

`Full Regression Health` status and a 90-day report record exact candidate SHA,
owner run and results. Missing/pending/failure/error cannot promote. Later full
success on the same candidate resolves failure; no fallback to older success.
The owner run must complete SUCCESS, including dev deployment if present.
main-target CI compares the actual candidate tree to current dev and checks
health before Repository checks succeeds. Existing main/production gates remain.

Protection endpoints remain UNVERIFIED. Main promotion/production is not
performed. Nightly activation remains a platform/authorization limitation;
code integration alone must not be called complete schedule activation.

## Exact dev deployment parallelization

Publication remains one immutable artifact deployment. Six independent deployed
QA groups (Responsive/Forge, Battle/Hit/Daily, Tower, Abyss, Adventure, Boss)
check the same github.sha source and dev HEAD, and validate deployed manifest
before and after QA. No QA command/evidence upload is removed. Credentials
remain only in the publication job. The original `Deploy dev preview` check
now aggregates publisher plus all six groups: failure, cancellation or skip
fails the final barrier. Production deployment workflow is unchanged.

Local acceptance: 137 targeted contract tests PASS, workflow YAML/semantic
validation and actionlint PASS, git diff --check PASS. Remote final-head
acceptance and full dev deployment remain pending until actual run completion.
Rollback dependent changes in reverse order: deployed parallelization, then
Nightly/health; PR classifier enforcement can separately return to Shadow by
setting PR_GATES_ENABLED=false. Never remove existing main/dev protection.

## Full-suite restoration discovered by strict PR execution

Exact Head d109f12d enabled full Node suites for Strict/Cloud/Persistence PRs.
The 284-suite runner exposed older assertions that referenced retired V173
Daily stat multipliers, the former ten-enemy Daily roster, legacy Abyss HP
post-writes, and pre-fix inventory navigation order. Ten existing test files
are aligned with the formal MonsterBalance/three-wave Daily/two-tier Abyss/
V174 presentation owners. No suite or test case is removed; factories and
projection/identity/confirmation/resume behavior are exercised instead of
matching retired assignments. The Fire Tower fixture also pins its week and
loads the real MonsterBalance module. No gameplay/build/release asset changes.

Local suite diagnosis: 280/284 suites pass after targeted repairs; four actual
Chrome suites require the GitHub runner's Chrome (not counted as local passes).
Governance contracts: 138/138 PASS. Remote full acceptance remains required.
The d109f12d Boss job failed before gameplay at Chrome CDP ECONNREFUSED; evidence
is retained, and a later exact-head execution must pass the unchanged QA.
