# Battle Target Lifecycle Convergence

Work ID: BATTLE-TARGET-LIFECYCLE-CONVERGENCE-20261005

Status: IMPLEMENTED. Remote CI / final-production Browser QA / integration / deployment / cleanup pending. Phase 2 must not start before complete closeout. main forbidden.

## Verified opening state

- dev: `276f6a1e9e5d65f563a5a8b51d477f8580430252`; main: `f63d69dbfa66ba75637d1c3cd7fcc7d74782e356`.
- DEV release-manifest readback: same opening dev SHA; V173.73 / cache173.73. No release freeze.
- Sole open PR at opening audit: #802, `feature/cloud-restricted-battle-instance-20261005`; independent Cloud track excluded. #801 already merged Monster Balance Owner final documentation. Phase1–2F not reopened.
- Work branch: `fix/battle-target-lifecycle-convergence-20261005`.

## Evidence and root cause

The executable test runs the real core enemy attack plus complete V149 module. Before repair, four regular/Boss cases fail: living primary produces hits `[0,2]` instead of `[0,0]`; lethal first hit produces `[0,1]` instead of `[0]`. V149's free cast calls its previous attack again, while the core rebuilds the living target pool and random primary on every invocation.

The formal round queue previously carried enemy index/agility only. Hostile selection occurred at resolution; a character dead when the queue was built could be revived and enter the freshly constructed pool. There was no earlier erroneous death snapshot: the defect was missing planning identity and late selection.

## Responsibility inventory / retirement

- Queue and target identity: core `startResolutionPhase`, `processNextCombatant`, `createEnemyActionTargetSnapshot`, `isEnemyActionTargetSnapshotCurrent`, `resolveEnemyActionTargets`, `processSingleMonsterAttack`.
- Shape/stealth legality: existing FourSymbolsBattleSkillTargeting and FourSymbolsBattlefieldSlots via canonical selectors. No replacement geometry.
- Free cast/count/animation: existing V149 `runMonsterFollowUp`; passes the identical snapshot. The previous resolution-time random pool is physically removed. No new wrapper, observer, delay patch or second registry.
- V140 barrier/lifesteal, V141 carried-skill/support, V148 reflect, V155 damage actor/final level, V158 Daily protection and Team Relic source/count compatibility wrappers retain separate responsibilities; existing arguments are forwarded. None can reselect primary after the core handoff.
- Failure/lifecycle: invalid primary ends targeted action with one finish notification; delayed follow-up on cancellation/new token/round/replaced actor returns without finishing a new action. No persistent state or migration.
- The production build mechanically refreshes the existing Cloud plain-attack policy's V149 file digest. Server formulas, lifecycle, authority, callable, rules, economy and #802 source remain unchanged; this is dependency fingerprint synchronization, not Cloud construction.

## Validation

- Targeted regression:19/19 PASS, skip0. Shapes single/tri/row/column/all, death-at-planning/revive-before-resolution, identity replacement, stealth, three possible random primaries, cancellation/new-battle/new-round/replaced actor, regular/Boss live/lethal follow-ups, shared manual/auto queue handoff.
- Related execution: V149/V148/V144/V140/V158, Skill/Relic owner and primary VFX anchor PASS; declaration/Boss architecture/slot/Cloud arithmetic compatibility PASS. No assertions removed or relaxed.
- Build and build:check PASS; YAML parse PASS; whitespace PASS. No Game/Cache change.
- Full local Node runner stops at suite22 because Chrome is not on PATH; installed Chrome154 was subsequently located and attempted directly, but startup fails `socket() failed: Operation not permitted`. This is not a full-suite PASS. No emulation is claimed as S23 Ultra.
- Existing CI runs the focused test plus new production-bundle Browser runner; existing DEV deployment runs the same runner against exact deployed assets with manifest SHA assertion. Read-only disposable account transport reuses the existing QA support, never real player data. Browser evidence checks real damage, primary/target badges, HP non-target stability, once-only SP/finish, initial-dead exclusion and free follow-up over two mobile viewports. Browser assertions not yet executed remotely.

## Remaining gates

Exact final PR Head CI; actual Browser evidence review; requirement promotion only after executable functional evidence; latest-dev recheck and normal integration; Merge SHA CI; exact DEV deployment and deployed browser matrix; main unchanged; absorbed-branch deletion with recoverable evidence. PR discussion will own final SHAs and closeout status. Physical S23 Ultra acceptance remains a separate manual gate.
