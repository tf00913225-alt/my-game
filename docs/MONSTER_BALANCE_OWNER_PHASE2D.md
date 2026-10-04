# Monster Balance Owner Phase 2D — Abyss

Work ID: MONSTER-BALANCE-OWNER-P2D-ABYSS-20261004.
Start dev f47862cc592870e359d31da5da52a5d530c831a8.
Main f63d69dbfa66ba75637d1c3cd7fcc7d74782e356 is forbidden.
Branch feature/monster-balance-owner-phase2d-abyss-20261004; target dev.
Status: IN PROGRESS. Stop before Phase2E. PR is the live closeout owner.

## Verified current specification

Two fixed difficulties Lv20/Lv40, five regions east/south/heaven/north/extreme,
five encounters per region. Each difficulty has 25 encounters.
Pre-stages: five Regular row1 positions0..4, three Elite row0 positions0..2.
Emperor stages: one single-slot smallBoss row0 position2, seven Elite occupying
row0 positions0/1/3/4 and row1 positions1/2/3.
Lv40 extreme final: five smallBoss row0 positions0..4, five Elite row1 positions0..4.
Lv20/Lv40 forced skill level1/2; Lv40 final alone forces level5.
Normal/Elite skill frequency35%; emperors72%, extreme78%, final Elite78%.
Names, carried skill/support IDs and approved portraits remain unchanged.

## Caller graph and responsibility inventory

Gameplay center -> feature loader abyss -> 59::startEncounter ->
launchCurrentEncounter -> buildRoster -> makeAbyssMonster -> MonsterBalance.build
-> levelBase + allocatePoints + Abyss rank/mode/element profiles -> projection.
Roster -> v132LaunchDungeonBattle(mode:abyss) -> V144 skill legality ->
fixed-slot snapshot/render/portrait lifecycle -> initiative -> core attack or
V141/V155 support dispatcher -> core damage/status -> dungeon completion callback
-> 59::resolveBattleResult -> claimChest -> portal/next-stage/re-entry.

1. Level: 59 declares difficulty20/40; MonsterBalance validates/projects identity.
2. Six stats: monster-archetypes allocatePoints, budget(level-1)*5, rank adds no points.
3. HP/SP: MonsterBalance resource/rank/mode projection only.
4. Physical/Magic attack: level-base contract and six-stat conversion only.
5. Defense: MonsterBalance only.
6. Speed/Agility: MonsterBalance only.
7. Rank: 59 explicit composition; MonsterBalance canonical regular/elite/smallBoss;
   getMonsterRank supplies boss compatibility to existing consumers.
8. Outgoing pressure: MonsterBalance finalDamagePressure; core reads it once.
9. Skill loadout: existing core pool plus 59 fixed emperor/final loadouts; V144 guard.
10. Skill frequency: existing core level frequency and 59 emperor/final metadata.
11. AI: core/V141 special dispatcher and V155 final decision/support execution.
12. Formation: 59 metadata and FourSymbolsBattlefieldSlots snapshot, no death reflow.
13. Small Boss identity: explicit emperor slot; no Personal/World footprint.
14. Durability: MonsterBalance Abyss mode/rank/stage profiles; old1.875 writer retired.
15. Element stat profile: MonsterBalance neutral profile; no invented elemental buffs.
16. Portrait: V154 resolver/registry/presentation; V159 already retired.
17. Reward: 59 first-clear claim ledger/currency/item owners unchanged.
18. Render/UI: existing dungeon/Abyss shell and fixed-slot/presentation owners.
19. Battle lifecycle: shared V132 launcher/core flow, 59 completion/return owner.

Legacy baseline path was makeLegacyModeMonster -> V132 strength1.30 -> normal1.10
-> rank HP3.20/4.50, SP2, defense1.25/1.40 -> 59 stage multiplier *1.875.
V141 old builder additionally had extraHP5000/10000 and2500/3500 but was superseded
by59. V158 no longer has Abyss postscale; V159 is a retired comment.
Core legacy pressure was1.15/1.25/1.35 for regular/elite/boss.
Shared legacy builders remain for Adventure/Personal/World Boss only.

## Diagnostic evidence and boundaries

scripts/abyss-balance-ttk-matrix.mjs reuses actual current player stats, skill data,
initiative, enemy AI, damage/status and duration owners, the actual50 Abyss rosters,
and the existing unequipped reference party at unlock/+10/+20.
Two members belowLv50, three fromLv50, neutral0.5 rolls, maximum60 diagnostic rounds.
Animation callbacks and natural battle completion must be independently checked in Chrome.
Baseline150 cases:112 clear+survivor,38 failures retained; Lv20 same-level0/25,
Lv40 same-level16/25, final40 still defeated Lv60 reference. Baseline source is
f47862cc. Intermediate candidate results were discarded; baseline and final evidence are retained.

Calibrated profiles: mode HP0.45, SP1, defense1, speed1, damage pressure0.22;
true-realm final pressure0.18, no additional final HP factor.
Stage HP factors0.90/0.95/1/1.05/1.10 are projected inside MonsterBalance.
Rank Regular HP/SP/defense/pressure1; Elite1.8/1.5/1.15/1.1;
smallBoss3.2/2/1.25/1.2. Raw attack conversion and point budget are unchanged.
Final diagnostic150 cases:149 clear+survivor; only bare two-member Lv40 final loses
in7 rounds. Its Lv50/Lv60 three-member references clear. All other unlock/+10/+20
references clear, no first-round wipe. This explicit challenge criterion preserves
progression and party-size significance; it is not a two-round or universal-clear gate.
Encounter round ranges by participating rank: Regular1–6, Elite1–12, smallBoss2–12;
these are encounter durations, not fabricated independent per-monster TTK.
Skill chance/loadouts remain at their existing values. Pre-stage soldiers map balanced;
south emperors physical, east/heaven/north magic, extreme support. No random archetype.
First-round and final player HP, resources, enemy stats, skills and status evidence are retained.
Focused6/6, related48/48, syntax365/365, build:check and deprecated gates PASS locally.
Production Chrome and final CI remain pending. Combat Rock Wall intentionally changes
visible shield-inclusive maxHP under the existing Status Owner; QA checks baseMaxHP
against projection and verifies the separate shield amount. This is combat execution,
not a pre-battle stat writer. Skill capabilities are not added: no carried revive in final,
no light soldier artwork invented. Light pre-stage portrait remains an existing
approved fallback gap; this numerical migration cannot replace it.

## Pending gates

Focused identities/projection, calibration/TTK, relevant regression, production
Chrome390x844/412x915, build synchronization/deprecated/syntax, latest-head CI,
Requirement VERIFIED, latest dev absorption, PR merge, exact deployed SHA/version,
deployed Abyss QA and safe absorbed branch cleanup. Main untouched; no Phase2E.
