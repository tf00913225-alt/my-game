> 2026-10-05 fire lethal-retarget amendment: historical lethal-cancellation assertions below are superseded by docs/FIRE_FOLLOWUP_LETHAL_RETARGET_20261005.md. Snapshot/round/revival identity protections remain authoritative.

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
- Existing CI runs the focused test plus new production-bundle Browser runner; existing DEV deployment runs the same runner against exact deployed assets with manifest SHA assertion. Read-only disposable account transport reuses the existing QA support, never real player data. Browser evidence checks real damage, primary/target badges, HP non-target stability, once-only SP/finish, initial-dead exclusion and free follow-up over two mobile viewports. 24/24 scenarios PASS on candidate `914f260a718f1f725dd55038f2e523c8ec4a6be9`, CI run37273828938 / artifact11329756508. JSON and both battlefield screenshots reviewed. Initial QA assumptions about pre-normalization SP and reloading a QA session were corrected using actual initial SP and one formally booted session; effective geometry assertions migrated to the new snapshot boundary with real Slot execution. No Runtime/specification relaxation.

## Remaining gates

Exact final PR Head CI; actual Browser evidence review; requirement promotion only after executable functional evidence; latest-dev recheck and normal integration; Merge SHA CI; exact DEV deployment and deployed browser matrix; main unchanged; absorbed-branch deletion with recoverable evidence. PR discussion will own final SHAs and closeout status. Physical S23 Ultra acceptance remains a separate manual gate.

## Continuation checkpoint — 2026-10-05

Resumed existing PR #804 at f22d326dbb58e4caa3027a1bc0d8a22014f358de; no duplicate branch or repair. Latest dev and live manifest are 2c9daaf8563f4c7836a27f7153ec331aa0decf4a; main remains f63d69dbfa66ba75637d1c3cd7fcc7d74782e356. Only open PR is #804.

Final historical CI37274272365: Repository, Adventure and Boss PASS; Abyss focus/neutral+seeded TTK PASS, Chrome debug endpoint refused connection at 127.0.0.1:9933 before browser execution. This is not a gameplay or numerical failure and is not relabeled PASS. Session Authority37274272140 SUCCESS.

Normal two-parent merge absorbs separately integrated #802 and #803. Target source auto-merges with the level formula; preserve both. HANDOFF and requirements union all three work records; production bundles/manifests and restricted policy certificates regenerate through the existing build Owner. No Cloud implementation, formula, projection profile or QA assertion is changed by this continuation. Latest integrated Head CI/emulator, dev merge/deploy/live target QA and cleanup remain mandatory; Phase2 not started.


### Integrated-head Abyss regression fixture correction

- Head `ff7eeeb5e2eea3d936e0fb4efc326756d99f5433`: Target Lifecycle production browser QA passed 24/24; Abyss run `37296971517` failed its existing actual-hard-control gate. Chrome started successfully and all seven first-viewport natural scenes completed.
- Evidence contained actual `stun` states but no hard-control rolls. The formal skill contract treats these stun effects as accuracy reduction, not lockdown. The fixed global RNG tape selects flyingSandStrike, but the final Skill Progression Owner removes its retired petrify payload and assigns petrify to dustStorm. Target planning exposes the old fixture assumption; it does not authorize restoring retired skill effects.
- The QA boundary now injects the category draw at the existing `FourSymbolsEnemySkillAI.chooseCategory` owner, delegates to its original implementation, identifies petrify from the final legal/affordable skill data and derives the skill-selection draw from that native pool, and retains the existing formal status-roll boundary. No forced skill field, loadout, monster stat, hit formula or gameplay owner changes.
- Acceptance is stricter: the native category/selection and actual hard-control roll must be recorded, and applied state must be freeze/petrify; soft stun cannot satisfy the gate. The temporary observation object is restored in the existing QA finally cleanup and never shipped as Runtime code.
- All final-head CI, merge, deployment and deployed browser gates remain pending until actual success evidence is available.

- Exact Head `49165d75` CI `37298970891` diagnosed the stale skill identity conclusively: native AI probe selected flyingSandStrike and its actual badge appeared, but no lockdown roll occurred. Final owner `js/60-v173.64-skill-progression-rebalance.js` deliberately deletes that skill's petrify and sets dustStorm's petrify. QA now selects hard-control capability from the final skill data, without resurrecting retired payloads. The prior assumption that fixed global draw timing alone caused the missing roll was incomplete.

- Head b58ba68c / CI37300228717 reached the correct hard-control owner: AI selected dustStorm, actual enemy→player chance37.95%, draw0, hit true, actual petrify persisted/expired across rounds. Final encounter then exceeded the old 180s browser wait while still at round7 resolve; no Console error. This is not reported as a lifecycle PASS.
- The natural-scene runner now records monotonic action timing and captures queue/locks/HP/status on failure; it permits a bounded 300s natural battle for the newly exercised lockdown scenario. This QA wall-clock allowance is not the formal round/TTK contract: focus/seeded/neutral TTK gates and all skill, pressure, projection, survival, real control, healing, cleanup and watchdog assertions remain intact. No Runtime delay, lifecycle, stats or skill effects change. Executable final-head completion evidence is still required.
