# P2 Package Metadata / Version Ownership Convergence

Work ID: `P2-PACKAGE-VERSION-OWNERSHIP-20261004`.
Start dev: `9fff3664d2767739fe8cd5c893f2985f8032d5ef`.
Protected main: `f63d69dbfa66ba75637d1c3cd7fcc7d74782e356`.
Branch: `chore/p2-package-version-ownership-20261004`; target dev.
NORMAL DEVELOPMENT; Release Freeze NO. Stop after this batch.
The Work PR owns latest Head, remote CI, merge, deployment and branch cleanup.
This source record is functional evidence, not a claim of completed remote gates.

## Historical cause

| Release | Commit | PR | Actual change |
| --- | --- | --- | --- |
| Root metadata V173.69 | `0706a241000299593c72a8d172f0a35aeaaecdea` | #380 | `173.68.0` → `173.69.0`; message `release: align package version to 173.69` |
| V173.70 | `09a275b128ca5b6b710b58afb3f1f2311139b619` | #456 | release version/cache only in this commit |
| V173.71 | `9a54fb908bf7d84769ecfa2cc768ed69cdfcfe31` | #520 | release version/cache only in this commit |
| V173.72 | `d322bf53a6332f7d476fbfa2ae43174064ed9614` | #535 | release source, notice, loader/index, checklist, changelog/tests; no root package |
| V173.73 | `a861578d43f20c76acab2e245d883fe3b4aef96c` | #770 | release source, notice, loader/index, generated bundles, scope/checklist/changelog; no root package |

`git log -G '"version"' -- package.json` and these diffs establish a historical
release metadata mirror, not an independently released npm product. Earlier
V173.66/67/68 package commits also explicitly aligned release metadata. Later
package edits only add portrait tooling commands. There is no evidence of a
deliberate contract declaring a new independent root package release series.

Confirmed mechanism: later release changes omitted the metadata mirror, and
the existing Gate checked release/index/loader/manifests but did not check root
package metadata. Build does not consume package version, so neither build nor
Gate rejected the omission. This is case A for historical metadata intent;
it is NOT a Runtime version defect or evidence that package was the Game Owner.
Commit evidence establishes what happened, not the author's unrecorded motive.

## Responsibility inventory / Owner graph

| Semantic | Decision Owner | Consumers / verification |
| --- | --- | --- |
| Game Version | `release/release.json.version` | build asset manifest; HUD/index/loader Gate; release notice alignment |
| Cache Version | `release/release.json.cacheVersion` | `js/20-anonymous-20.js::V_ASSET_VERSION` checked by Gate; build content hashes |
| Root npm release metadata | one-way projection of release Game Version | `package.json.version`, validated in existing `release-gate.mjs::checkPackageMetadata`; npm maintains the file |
| Production / DEV manifest | `release-gate.mjs::writeDeployManifest` | version/cache from release source, SHA/branch from existing workflow; `validateArtifactManifest` / `verifyDeployed` |
| Functions npm metadata | `functions/package.json.version` | its own npm lock; Firebase deploy identifies code by exact Git SHA, not Game Version |
| Player update notice | `release/release-update.json` content | `js/release-update-notification.js`, aligned to release Game Version; not package metadata |

Formal contract: `docs/RELEASE_VERIFICATION_RULES.md` §4A. This report is evidence,
not a second permanent rules Owner. The historical two-part Game version maps
to npm three-part `N.N.0`; three-part release versions retain their value.
Metadata does not reverse-write release source, nor independently select a version.

Caller scan: `rg 'package\.json|npm_package_version|173\.69\.0' scripts .github js tests`.
Only portrait-script tests, backend metadata tests, native-auth cache configuration,
the emulator's `createRequire` resolver anchor and release-diff classification
reference package files. None reads package.version as a Game/Cache decision.
Full browser build, manifest generator, release/update/cache gates and all
deployment workflows were inspected; no workflow env version constant exists.
`prepare-static-deployment.mjs` uses one immutable tracked-file packaging policy
and invokes the same Gate. Functions deployment runs its own `npm ci` and exact
checkout; its package `1.0.0` remains independent.

## Minimal change / retirement / lifecycle

Convergence: npm updates only root version to `173.73.0`. Gate replaces the old
unchecked mirror with mandatory release-derived validation and checks package/lock
name/version at the top level and npm `packages[""]` entry. Existing CI Gate step
also runs the executable regression suite; no new workflow, wrapper, timer,
deployment path, release Owner or version data file.

Root has no dependencies and no tracked lock at starting dev (`git ls-tree` and
filesystem verified). No root lock is introduced merely to match numbers.
Optional future npm-generated locks are validated. Functions package/lock have
matching `1.0.0` at both metadata locations; neither is modified.
History and old package values in evidence remain historical, not forbidden
Runtime tokens; no deprecated Runtime token is introduced or removed.

Release lifecycle: release source decides → npm maintains projected metadata →
existing Gate rejects drift → existing immutable packaging/manifest validation →
existing deployment/readback. No runtime listener, state, save or cleanup lifecycle
is added. No temporary patch or later overwrite point remains.

## Executable verification

- `npm version 173.73.0 --no-git-tag-version --ignore-scripts`: root metadata
  changed by npm; no tag, dependency or root lock change.
- `tests/package-version-ownership.test.mjs`: 12/12 PASS, skip0. Actual Gate
  subprocesses exercise stale/package-only/release-only advancement, invalid JSON,
  missing Functions lock, root and Functions top/entry drift, independent
  Functions advancement and isolated offline npm install/ci without metadata drift.
  Initial fixture omitted Functions source evidence links; corrected the fixture
  and retained every existing Gate assertion. No production change was needed.
- Root npm ci is not applicable without a lock. Both npm install and ci are
  executed in isolated fixtures with an npm-generated lock; the real repository
  keeps its existing lock absence. Functions dependency installation is owned by
  existing path-filtered Session Authority CI, which is not triggered by this
  batch. Functions lock metadata is verified here; dependencies/lock are unchanged.
- `npm run build`, `npm run build:check`, Release Gate `ci` and `release-ready`
  (including Deprecated Gate): PASS; Game/Cache 173.73/173.73. Generated build,
  manifests, index, JS/CSS and Functions source have zero tracked diff.
- Workflow YAML parses; only the existing release-check step adds the focused
  test. Triggers/permissions/deployment jobs and all other workflow definitions
  stay unchanged. Latest PR/dev CI are independent required remote gates.

## Deployment and parallel work

No gameplay or Firebase code redeployment is intrinsically required by metadata;
however the existing push-to-dev CI always calls Cloudflare deployment. Session
Authority is filtered to Functions/Firebase/Cloud/session paths; none is changed
by this batch, so no Session run or Firebase redeployment is required or claimed.
Do not change or bypass those policies. The actual Cloudflare run and exact
manifest SHA readback must be reported from the Work PR. No main release.
The static artifact contains tracked package/checklist/docs metadata, so its
automatically deployed exact SHA must not be substituted with the old baseline.

Open work at start: Draft PR #799 / Boss Phase2F, Head
`d26cf1947d54c296e5dbb4dde12f3f81c2a29a71`. No open standalone Issues.
Starting dev CI37208254884 and Session37208254604 SUCCESS. This batch does not
modify Boss/MonsterBalance/Cloud/UI owners. If dev advances, merge normally,
preserve parallel requirements/HANDOFF and obtain latest-head CI; no rebase/force.

Remaining P2: historical documentation/test maintenance and other toolchain
warnings, retained historical/material branches only as separately scoped work.
Cloud/Android/Boss/UI development is outside this batch. No automatic next P2/P3.

## Latest-dev integration checkpoint

PR #799 advanced dev to `db8530b59d683231535da717d1f641c391adbbcd`.
Absorbed by a normal two-parent merge, without rebase or force. Preserve all
Boss Runtime/source/generated bundles, its VERIFIED requirement/HANDOFF records,
and its existing CI Boss job/deploy dependency. This batch still changes only
metadata, the existing release Gate test step and its documentation.
The existing Cloudflare deployment now also requires the Boss job; Session
Authority paths are unchanged by this batch relative to current dev.
Integration Head requires fresh complete CI; earlier-head SUCCESS is historical.
