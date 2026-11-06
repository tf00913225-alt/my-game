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
