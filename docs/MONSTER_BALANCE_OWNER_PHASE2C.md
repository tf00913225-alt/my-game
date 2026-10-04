# Monster Balance Owner Phase 2C — Tower

Work ID: MONSTER-BALANCE-OWNER-P2C-TOWER-20261004. Start dev: 13c22561afc518ce33b7da798b32e1c215e3cbde. Main observed: f63d69dbfa66ba75637d1c3cd7fcc7d74782e356 and is forbidden to change. Work branch: feature/monster-balance-owner-phase2c-tower-20261004. Current status: functional 1/1 VERIFIED; final metadata-head CI, integration and exact dev deployment pending. Stop after Phase 2C; do not enter Abyss Phase 2D.

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

It runs existing player stat/skill owners, initiative, enemy AI, damage and status settlement with neutral 0.5 rolls for Regular/Elite/smallBoss representative floors across all four elements. Tower unlock requires Lv30: reference level is max(30, floor). Two reference members are used below floor 50 and three from floor 50. Formal autoActionForCharacter selects affordable skills or normal attacks; the diagnostic permits at most 60 rounds, without adding a product TTK limit. The first mandatory gate is clear + at least one survivor; local 60-case calibration passes clear + survivor. Regular 1 round, Elite 1–19 rounds, smallBoss 1–11 rounds. Water support/control causes the long cases. These are synchronous diagnostics; Chrome separately verifies animation lifecycle. Original neutral Tower profile failed 51/60 cases with the old diagnostic; correcting unlock/action semantics alone still left 39 failures. Functional verification passed complete exact-head CI at d7108cead55b297a03c3aa6325ce913690ae17e7.

Production Chrome owner: `.github/scripts/run-tower-challenge-browser-qa.mjs`.

The existing 27-scene Tower QA additionally requires every visible encounter entity to be MonsterBalance-owned, floor-level exact, free of V132 stat markers, correct canonical rank composition, and byte-visible final stats equal to the stored owner projection. Existing ten-target visibility, skill-frequency, water support/control, full ten-unit queue, AOE settlement and rule screenshots remain mandatory.

No Phase 2C requirement may be marked VERIFIED until the exact latest work head passes required CI and the evidence is reviewed. Integration, exact dev deployment and deployed QA remain separate closeout gates.

## Stop point

After Phase 2C is integrated and deployed, the next separate migration is Phase 2D Abyss. This work must not migrate Abyss, Adventure, Personal Boss or World Boss.

## Resume evidence checkpoint

Resume dev `da66cd015258d8baf2a330cb70c02d6018480ddf`; subsequent dev `36381e61c264c355d29e15008b6415114003e221` absorbed by normal merge. Both production build and synchronization check rerun. Functional Head `1c6f48c14230f668cc541255af03402186227156`, CI Run37164133231 Job111323468239 passed focused, TTK60/60, Tower Chrome27/27, Wild/Daily Chrome and real battle QA; the full run failed at a portrait fixture that injected only the retired V132 builder. That fixture now loads the formal generated owner, retains all portrait/first-frame assertions, and additionally checks owner identity/projection and zero Tower V132 calls. Requirement remains IMPLEMENTED until renewed complete latest-head CI passes.

Full diagnostic rows, player remaining HP and initial enemy stats/pressure: `docs/monster-balance-tower-ttk-evidence-20261004.json`. Full 27-scene browser evidence: `docs/monster-balance-tower-browser-evidence-20261004.json`. Artifact11289322164 SHA256 `701da0310420d8e097ea2be78078ee952b98420d9102374410f4b69ab970f1e7` independently matched; battle/rules screenshots inspected. Historical functional evidence never substitutes for final exact-head CI or exact dev deployment.

## Functional VERIFIED checkpoint

Exact functional source Head `d7108cead55b297a03c3aa6325ce913690ae17e7`: complete CI Run37165953470 / Repository checks Job111328746224 SUCCESS; Session Authority Run37165952955 / Job111328745049 SUCCESS. Focused5/5; actual four elements ×100 floors; TTK60/60 clear+survivor; production Chrome27/27 with all six stats/four elements/B3/queue/AOE; fire/wind/earth portrait first-frame fixtures300 owner checks and zero V132 calls; Phase1/2A/2B, unchanged unmigrated-mode regressions, build synchronization, deprecated code and syntax PASS. Full renewed reports now preserve this source Head and artifact11289725982 SHA256 `d3ba1425e94ad12b6d5a73f592ad3c6c0132b34b81a806f8d4fb97695a15c928`; screenshots reviewed.

Requirement1/1 VERIFIED, dev checklist32/32 VERIFIED. This is functional verification, not an integration/deployment claim. The metadata commit must pass its own latest-head Required CI before PR #788 merges. Actual merge SHA, final dev checks, exact deployed manifest/version, live Tower27 QA and branch cleanup belong to PR #788's durable closeout record. Main unchanged; stop before Phase2D.
