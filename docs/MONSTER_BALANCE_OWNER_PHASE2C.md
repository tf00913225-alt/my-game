# Monster Balance Owner Phase 2C — Tower

Work ID: MONSTER-BALANCE-OWNER-P2C-TOWER-20261004. Start dev: 13c22561afc518ce33b7da798b32e1c215e3cbde. Main observed: f63d69dbfa66ba75637d1c3cd7fcc7d74782e356 and is forbidden to change. Work branch: feature/monster-balance-owner-phase2c-tower-20261004. Current status: IMPLEMENTED / verification pending. Stop after Phase 2C; do not enter Abyss Phase 2D.

## Authority boundary

- `js/combat/monster-balance-owner.mjs` is the only Tower pre-battle owner for level, six-stat allocation, HP, SP, physical/magic attack, defense, speed, rank profiles and final outgoing pressure.
- Floor N is monster level N for all 1..100. The retired `29 + floor * .71` level writer must not return.
- Tower uses deterministic `balanced` archetype allocation for the existing generic Tower roster. Rank never grants ability points. This avoids inventing a second name/archetype registry while preserving the established elemental skill/loadout owner.
- Runtime ranks are canonical `regular`, `elite`, `smallBoss`. Generic compatibility `getMonsterRank(smallBoss)` returns `boss` only for existing UI/reward/status-cap/slot consumers; the MonsterBalance identity stays `smallBoss`.
- Regular profile: HP 1, defense 1, final pressure 1.
- Elite profile: HP 1.50, defense 1.10, final pressure 1.10.
- Tower smallBoss profile: HP 3.00, defense 1.15, final pressure 1.15.
- Tower mode calibration is HP 0.20 and outgoing damage pressure 0.25; SP/defense/speed remain 1. Raw physical/magic attack and allocation are untouched. Rank ratios remain 1/1.5/3 HP and 1/1.1/1.15 pressure. Global calibration remains 1.
- Tower entities do not carry `v132Dungeon` or `v132EquipmentDungeon`; core damage settlement consumes `balanceProjection.finalDamagePressure` once.

## Gameplay owners intentionally preserved

Every floor remains exactly 10 enemies.

- Normal floor: 10 Regular.
- Multiple of 5 but not 10: 2 Elite + 8 Regular.
- Multiple of 10: 1 smallBoss + 2 Elite + 7 Regular.
- The smallBoss remains one standard-size unit at ENEMY_B3. It does not enter Personal/World Boss footprint, reinforcement, object, shield or mechanism lifecycle.
- Skill frequency remains 65% through floor 30, 70% through 60, 75% through 90 and 80% through 100.
- Fire keeps critical +15% and direct damage +15%.
- Water keeps healing +15%, status accuracy +15%, support/heal/freeze preference.
- Wind keeps evasion +15%; speed +15% is projected by MonsterBalance rather than a late agility write.
- Earth HP +15% and defense +15% are projected by MonsterBalance rather than late mutation.
- Existing V144 element legality, portraits, rewards, weekly progression, fixed slots and battle presentation remain their current owners.

## Physically retired Tower writes

- `towerMonsterLevel()` old 30..100 compressed level curve.
- Tower caller edge to `v132BuildDungeonMonster` and its 1.30 / 1.10 / Elite-Boss multiplier chain.
- Tower `bossBalanceProfile(...,"tower",...)` HP/attack post-write.
- Tower earth HP/defense post-write.
- Tower wind agility post-write.
- Core legacy enemy pressure for Tower.

Shared V132/core legacy builders remain only for unmigrated Abyss, Adventure and Personal/World Boss callers. They must not be deleted early.

## Portrait compatibility

V154 temporary Boss fallback accepts canonical `smallBoss` and `vGameplayTowerBoss`. This prevents a Tower smallBoss without a dedicated portrait from falling back to the ordinary heavenly-soldier placeholder. This is presentation compatibility only and does not own balance stats.

## Verification contract

Focused owner gate: `tests/monster-balance-owner-phase2c.test.mjs`.

It verifies four elements × all 100 floors, fixed ten-unit composition, floor=level, deterministic allocation, rank-point invariance, single projection, no V132 stat markers, element projection and smallBoss compatibility semantics.

Formal diagnostic: `scripts/tower-balance-ttk-matrix.mjs`.

It runs existing player stat/skill owners, initiative, enemy AI, damage and status settlement with neutral 0.5 rolls for Regular/Elite/smallBoss representative floors across all four elements. Tower unlock requires Lv30: reference level is max(30, floor). Two reference members are used below floor 50 and three from floor 50. Formal autoActionForCharacter selects affordable skills or normal attacks; the diagnostic permits at most 60 rounds, without adding a product TTK limit. The first mandatory gate is clear + at least one survivor; local 60-case calibration passes clear + survivor. Regular 1 round, Elite 1–19 rounds, smallBoss 1–11 rounds. Water support/control causes the long cases. These are synchronous diagnostics; Chrome separately verifies animation lifecycle. Original neutral Tower profile failed 51/60 cases with the old diagnostic; correcting unlock/action semantics alone still left 39 failures. Final functional verification remains pending exact-head CI.

Production Chrome owner: `.github/scripts/run-tower-challenge-browser-qa.mjs`.

The existing 27-scene Tower QA additionally requires every visible encounter entity to be MonsterBalance-owned, floor-level exact, free of V132 stat markers, correct canonical rank composition, and byte-visible final stats equal to the stored owner projection. Existing ten-target visibility, skill-frequency, water support/control, full ten-unit queue, AOE settlement and rule screenshots remain mandatory.

No Phase 2C requirement may be marked VERIFIED until the exact latest work head passes required CI and the evidence is reviewed. Integration, exact dev deployment and deployed QA remain separate closeout gates.

## Stop point

After Phase 2C is integrated and deployed, the next separate migration is Phase 2D Abyss. This work must not migrate Abyss, Adventure, Personal Boss or World Boss.
