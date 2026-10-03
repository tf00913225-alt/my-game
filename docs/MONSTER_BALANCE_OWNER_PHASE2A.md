# Monster Balance Owner Phase 2A — Wild

Work ID: MONSTER-BALANCE-OWNER-P2A-WILD-20261003
Target: dev. main must not be modified.
Base dev: de5e2049eae20294a173f3e7f5b57fa54c5afe9b
Initial main: 642727e0dd687dc4d64edafbf3986ce63b7ab72c
Branch: feature/monster-balance-owner-phase2a-wild-20261003
Status: IN PROGRESS / NOT COMPLETE

## Preflight and ownership

PR #777 is merged; its Phase 1 owner is pure Shadow. Open PR #778 and draft main PR #779 concern independent production acceptance and are outside this Work ID.

Wild stat writers before this change: 00-main generateMonsterAttributePoints/makeZoneMonster; V131 strengthenMonster/strengthenAllZoneMonsters and zone calibration; V141 strengthenNewWildMonster for added wind/earth; V158 halveMonsterCoreStats/normalizeBeginnerForestMonster. Wild rank writers: V141 roster normalization and v141RollWildMonsterRanks, with getMonsterRank preferring v141BattleRank. Skill wrappers: V141 configureMonsterSkills; V144 configureEncounterSkills; V158 normalizeMonsterDefaultEvasion.

Lifecycle: App Shell creates ten zone rosters; V141 adds wind/earth during gameplay installation. V141 Battle Render rolls encounter rank before simulation. Official rosters have no boss rank; names containing king/emperor are Regular identities. No Small Boss encounter is added.

Canonical stat authority: js/combat/monster-balance-owner.mjs. The production build synchronously projects these canonical ESM sources into a generated block at the beginning of 00-main, before roster initialization. The generated block is never edited by hand; build:check requires source equality. This preserves standalone source fixtures and synchronous App Shell lifecycle without a dynamic stat fallback or late mutation patch.

makeZoneMonster delegates explicit mode=wild specs to MonsterBalance.build. Non-Wild callers use makeLegacyModeMonster until their authorized migration Phase. Named configureBuiltMonster invokes existing skill/default-evasion hooks; no constructor reassignment remains.

V131 and V141 wild stat writers and V158 core-halving fields/function/marker are physically removed. Beginner normal attack and critical safety remain. v141BattleRank is a compatibility mirror only, for unchanged reward/UI consumers; retire it after those consumers read canonical rank. Non-Wild old allocation, mode/rank multipliers and gameplay paths remain compatibility only until Phase 2B and subsequent per-mode phases.

Rank V1 Wild: Regular HP/Defense/Pressure 1; Elite HP 1.5, Defense 1.1, outgoing pressure 1.1. Allocation and raw attack are identical between ranks. Final Damage owner reads projection pressure once. Base resources 100/50; no player level resource bonuses. Global calibration remains 1.

Explicit archetype mapping uses existing portrait keys; no second name registry. Tank defensive AI gap is explicit. Skill capability, full retirement map, Shadow/Runtime matrix, reference-party TTK, full regression/build, mobile Browser QA, latest-head CI, merge/deploy and closeout remain pending. Do not claim Runtime Migrated until all gates pass.
