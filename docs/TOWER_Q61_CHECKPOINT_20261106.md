# Q61 implementation checkpoint

- Work ID: TOWER-Q61-WEEKLY-20261106
- Target: dev, review only. Do not merge or deploy this work.
- Branch: fix/tower-q61-weekly-20261106
- Base dev: 5e4dc940a7c1f8a942dc77d86eb266607748a7fc
- Status: partial implementation; settlement/admission activation STOP.

## Accepted product behavior

Taipei Monday 00:00 starts the new week. Players climb again and receive normal
new-week rewards after a qualifying new-week victory. Old-week claims must not
block genuinely different new-week entitlements. A formally accepted battle
settles against its entry period; late settlement never overwrites the active
new week. Updating within the same logical week is not an extra reward cycle.

## This checkpoint

The existing Tower Owner now contains one explicit calendar calculation for
utc-v1 and taipei-v2, interval identity, and a read-only calendar transition
classifier. Node imports return only the pure policy API before save hydration.
The live utcWeekInfo delegates to utc-v1; STATE_VERSION, save readers, initial
account sources, reward amounts, pending handling and runtime rollover remain v1.
No v2 client entry point or reward writer has been enabled.

The classifier only inspects calendar metadata. It is not a save validator,
trusted eligibility decision, migration receipt, ledger or transaction. A reset
classification must not be applied to player data. `requiresSettlement` denotes
an unimplemented gate, not evidence that settlement has occurred.

## Remaining STOP and precise dependencies

The formal source inspection found protected grant/claim/ledger/replay mechanisms
in functions/src/trusted-grant-ledger.js, canonical-resource-credit.js and
credited-grant-evidence.js. These do not supply a Tower victory source or a
complete Tower gold/items/weekly/lifetime/pending/migration transaction.
canonical-snapshot.js still requires gameplayProgress.version === 1. No Tower v2
admission, reject-downgrade, durable period receipt or unknown-result recovery
capability has been established. Local completion callbacks and inventory counts
are not trusted victory or cross-period delivery evidence.

Do not activate taipei-v2 or mutate schema until those dependencies are proven.
If reliable Tower eligibility/outcome would require a new server battle engine
or resuming frozen battle evidence engineering, stop that portion. Do not widen
Cloud readiness, weaken source validation, resume #994/#955 or discard unknown
pending merely to complete Q61.

## Required next implementation when gates are resolved

- UID + fixed migration event identity; source revision is only a CAS condition.
- Atomically commit migration marker, active-week reset, old pending preservation
  and version transition; lost response retrieves the same migration result.
- Persist entry UID/token/operation/period/element/floor and known/unknown result.
  Unknown closure is not defeat, delivery or permission to delete the receipt.
- Keep old-period late claims durably queryable under the formal AccountSave /
  Reward Owner, with bounded records; Tower's seven fields describe active week.
- Weekly uniqueness is UID/period/floor/reward kind. Only equivalent encodings of
  the same entitlement may alias; genuinely different weeks must remain distinct.
- Resolve lifetime milestones atomically at commit. If already awarded elsewhere,
  exclude only the lifetime component, preserving a lawful weekly reward.
- Readers precede v2 writers; prove new-account parity and downgrade rejection.

## Validation at this checkpoint

New policy tests cover Taipei/UTC boundaries, four elements, leap/year boundaries,
host timezones, strict instant validation, cross-realm Date input, legacy formula
parity, same-week retain/new-week reset, repeatable classification and malformed /
future calendar metadata. Existing Boss/Tower topology and Relic targeted tests
pass. Tower AI and canonical snapshot tests also pass; the final calendar-only
low-year rejection was then covered by rerunning the eight policy tests.
Production artifacts were rebuilt with the existing builder; build check and
diff whitespace check pass. The original /root/compatibility reviewer read the
diff, required strict unambiguous instant parsing and blocked low-year metadata,
then confirmed both corrections and allowed a remote Draft checkpoint. Reviewer
did not execute tests and did not approve merge or deployment.

These tests do not verify runtime Taipei rollover, atomic migration, cross-device
once-only, failure recovery or player experience. Those remain pending, together
with necessary final-head CI. No deployment QA is claimed.

## Second checkpoint: v1 admission protection and retained cross-period pending

Actual changes on this same branch:

- The original AccountSaveOperations Writer in js/00-main.js rejects unsupported
  incoming or stored gameplayProgress versions before any backup/storage write.
  An existing v1 gameplayProgress cannot be omitted or replaced by unversioned
  progress. Cloud bundle screening also rejects unsupported gameplay versions.
- Tower bootstrap does not hydrate, normalize, persist or install battle callbacks
  for unsupported versions. Its normalizer also refuses a future version.
- Relic reconciliation returns blocked-period before inventory comparison or age
  cleanup for Tower pending whose week is missing or differs from the active week.
  It does not invent a victory, a new operation, delivery or an old-week reward.

These are protections in the updated v1 client, not formal v2 admission or a way
to force already-distributed old clients to reject downgrade. Same-week unknown
pending was still age-cleared at the second checkpoint; the third checkpoint
below removes that Tower cleanup.
The shared pending guard also blocks Boss entry while an unresolved old Tower
receipt exists. There is no new recovery/adjudication capability, so this preserves
value at the cost of availability. Do not claim non-Tower behavior is unchanged
in that exceptional state or enable v2 on the basis of these tests.

Narrow source/consumer audit:

- Tower startTowerFloor accepts the local launcher callback; completeTowerFloor
  interprets its local result. getActiveBattleState exposes local context, not a
  server-accepted entry entitlement or durable victory receipt.
- Relic buildTowerPending stores a local week and reward plan; pendingVictory reads
  the current claimedFloors marker. This cannot establish trusted eligibility.
- functions/index.js wires reserveTrustedGrant and claimDailyCheckin, but no Tower
  entry/outcome/settlement consumer. canonical-operation-classifier.js has no Tower
  retained-operation kind. Unsupported kinds are rejected; do not add an alias
  merely to make a client victory acceptable.
- trusted-grant-ledger.js requires an existing server-issued grant;
  canonical-resource-credit.js accepts specific server-event gold/EXP sources.
  Neither creates a Tower source, period eligibility, victory proof or complete
  Tower item/lifetime/pending transaction.
- canonical-snapshot.js remains strict v1. The AccountSave/Reward Owner must prove
  source-specific admission, atomic period receipts and recovery before v2 writes.
  Frozen battle evidence cannot be promoted to this source.

New version/admission tests cover raw save/metadata/sidecar preservation, valid v1,
cloud screening and unsupported Tower bootstrap. The Relic regression covers
reload, aged old pending, a current-week claim of the same floor and retries.
Nine targeted test files pass (40 Node test-runner results, including legacy
suites), production build/check and diff check pass. The original reviewer read
the second diff, found no mandatory correction, and required the availability,
then-outstanding same-week unknown and old-client limitations to remain explicit.

The official builder refreshed only js/00-main.js's source digest inside the
retained restricted-forest-instance-policy.json; no battle policy/formula or
frozen engine behavior was changed or activated. No CI rerun, merge or deployment
was requested. Latest-head CI must be reported separately from the first commit.

## Third checkpoint: same-week unknown preservation and explicit entry refusal

The same-week Tower no-claim case used to fall through to age > 250 ms cleanup.
Neither elapsed time nor absence of claimedFloors proves defeat. Tower now returns
blocked-outcome instead, retaining the original pending across reload and retries.
The original Boss-only cleanup and known failed-launch cancellation remain as-is.
This is not a trusted result writer, new receipt engine or recovery mechanism.

Single-slot audit: normalizeProgressionState clones one pending; setPending
replaces it. Both Boss and Tower starters require that slot for their planned
rewards, and legacy Boss reward suppression also reads its kind. Allowing Boss
while retaining a Tower record would either overwrite that record, lose Boss
tracking or require another durable slot/schema and its recovery contract. No
such contract is established here, so safe isolation was not implemented. Both
entries remain blocked and now use the existing notify path to explain that the
Tower record is retained and there is no automatic recovery. No new UI component,
layout, wrapper, timer or save field was added; paused UI work remains untouched.

Availability STOP: real defeat/escape with no durable terminal evidence can also
remain unknown, blocking both Tower and Boss indefinitely. This Draft is not a
publishable gameplay fix. Do not resolve that state by trusting a client win flag,
deleting pending, promising that reload will recover, or resuming frozen battle
engineering. A supported terminal/cancellation/recovery contract remains required.

Targeted Relic tests cover same-week and cross-week aged pending, reload/retry,
no grant, unchanged saved record, explicit Tower/Boss refusal notifications and
known rejected-entry cancellation. Existing successful weekly/next-week and
permanent-milestone cases continue to pass. Only the changed Relic suite and
necessary builder/checks are rerun in this batch, not the completed prior suite.
Original /root/compatibility reviewer read this diff and permits only a Draft
value-preservation checkpoint, requiring the availability STOP to stay explicit.
Player-visible notification layout/experience has not been browser-validated.

## Sixth checkpoint: local pending marker, single updated writer only

Ordinary AccountSave now stages `localWritePending:{version:1}` in the existing
metadata and verifies it before main/shop writes. It reads back main and optional
shop, writes final metadata last, and rolls back destination bytes and verifies
them before restoring metadata. Reader and writer reject any present marker;
malformed values block, and a marker without main is not treated as an empty
account. Legacy metadata without the field follows the existing path. Cloud
adoption reaches the same read guard before same-cut return or backup. A local
synchronous reentry guard also covers getters/toJSON. Shop key binds captured UID.

Original reviewer confirms only a Draft checkpoint. If the final metadata write
succeeds but readback fails, the Writer reports `account-local-commit-unknown`
without rollback: all destination bytes were previously checked but the metadata
outcome is uncertain. **Consumer STOP:** existing `saveGame()` can turn this
error into `false`; Relic and other consumers may revert in-memory state and
later overwrite an already committed result. It does not yet prevent gameplay
or blind retry after an uncertain read. The requested end-to-end blocking after
storage-read failure is therefore not complete. No merge or deployment.

Rollback metadata readback failure reports rollback failure without claiming a
marker necessarily remains; metadata restoration may already have succeeded.
The tests also characterize an uncooperative old client interleaving through
the marker and yielding an undetected mixed write. This is not cross-tab CAS,
old-client protection, a crash recovery journal or filesystem durability.

Focused account marker, ownership, legacy hydration, admission and actual cloud
bundle tests pass (37 Node runner results); production build/check and diff check
pass. No v2 admission, reliable victory/negative terminal, receipt recovery or
Cloud readiness is activated. Original AccountSave Owner's independent review
of this exact diff remains pending. Future work must settle uncertain-result
propagation and gameplay blocking without changing other Owners opportunistically.

## Eighth checkpoint: do not delete an uncertain legacy migration

The original migration catch now rethrows `account-local-commit-unknown`,
`account-local-rollback-failed`, and `account-local-write-incomplete` unchanged
before cleanup. It does not remove main, metadata, sidecars, legacy or backups
for those three outcomes. Other errors retain the old cleanup behavior; this
does not prove that broader cleanup or partial sidecar migration is safe.

Targeted tests use the real AccountSave writer and the original Startup
confirm-migration branch. They cover each of the three errors, verified ordinary
failure, UID switch, no compensating deletion, and no READY in that same startup.
After a final-metadata read failure, reload may still see READY with sidecars not
yet migrated. This characterization is an explicit STOP, not recovery PASS.
There is no durable migration marker, global unknown barrier or auto recovery.
The original reviewer read the diff and allowed an unreleased Draft checkpoint;
the Startup test is an isolated original branch, not browser Boot QA.

## Ninth checkpoint: reader-side migration-pending guard only

The existing AccountSave repository recognizes the reserved UID-local
`four_symbols_migration_pending:<UID>` key. A present valid marker blocks before
the empty/ready decision; malformed, foreign, oversized and unreadable markers
also fail closed. Ordinary writer/adoption/migration reach that reader guard;
delete and write-producing archived-sidecar recovery check directly. Existing
sealed backup verify/export remain unchanged and are not a complete pending-state
export. Direct gameplay sidecar writers are not frozen.

NO CREATOR / NO CLEAR: the current legacy migration does not create the key or
verify its full destination set before clearing it. Therefore a real partial
migration can still reload READY. This checkpoint does not complete the approved
repository/Startup objective and must not be merged or deployed. The remaining
work is the closed single-Owner migration command, prepared/final boundaries and
full real startup/fault matrix. Do not expose a public bypass, claim atomicity,
enable Q61 or modify sidecar Owners to imply a global freeze.

Four focused files yielded 41 passing Node runner results. After reviewer input,
the marker check was moved before JSON parsing, a parseable oversized case and
Startup creation-count assertion were added, and the guard suite passed again.
Production build/check and diff check passed. The original reviewer read the
final diff and approved a Draft checkpoint only; AccountSave Owner's independent
review of this exact diff is pending. Latest-head CI is not yet verified.
