# Monster Balance Owner Phase 2E — Adventure

Work ID: MONSTER-BALANCE-OWNER-P2E-ADVENTURE-20261004.
Start dev: a0c4cf3ccf6b83278f9940da7f71516d9c98cfa4.
Main: f63d69dbfa66ba75637d1c3cd7fcc7d74782e356 (forbidden).
Branch: feature/monster-balance-owner-phase2e-adventure-20261004; target dev.
Status: IMPLEMENTED; PR is the durable current CI/integration/deployment/cleanup owner.
Classification: Convergence / Replacement. Stop before Phase 2F.

## Current product specification, independently inspected

One chapter chapter_v1, three playable encounters (not 20 battles).
enc_road: three Regular, fire8/wind8/earth9; n02 suggested8.
enc_gate_elite: earth Elite10, fire/wind Regular10; n04b suggested10.
enc_boss: earth smallBoss12, fire/wind Elite11; n09 suggested12.
Nine element-qualified identities, eight names; each stable balanced archetype.
The two guards share the same archetype. Formal content has no fixed weapon/AI
role registry and Lv8–10 no carried skills; all balanced is an explicit lack-of-
evidence decision, not a random role guess. No tank/support capability invented.
No water or light battle exists. No high-level chapter exists. All encounters
are three units in the canonical fixed three-slot formation. No special event
monster, no player-level scaling, no chapter scaling or HP/attack multiplier.
The chapter has planned nodes11–20, which cannot become battles in this work.
The patrol objective uses Wild's unlocked roster only for a kill/drop target;
that encounter remains Wild and is not migrated or rebalanced here.

## Actual caller graph and the 21 responsibilities

Home entry -> feature-adventure -> Content.encounters -> Runtime.beginBattle
-> buildEncounter -> MonsterBalance.build -> levelBase / allocatePoints /
Adventure rank+mode+neutral element profiles -> projected entity -> core
skill pool/frequency -> configureBuiltMonster (V141/V144 legality/carry)
-> v132LaunchDungeonBattle(mode:adventure) -> fixed-slot snapshot -> final render
-> final initiative/Enemy AI/damage/status owners -> V132 result callback ->
Adventure completeNode/claimNodeReward/persist -> map/return/re-entry.

| Responsibility | Canonical owner / disposition |
|---|---|
| Encounter identity | adventure-content; explicit monsterKey, encounter id, name/element |
| Level specification | content fixed8–12, no dynamic formula; projection validates level |
| Six-stat allocation | MonsterBalance + monster-archetypes; budget(level-1)*5 |
| HP | MonsterBalance only |
| SP | MonsterBalance only |
| Physical attack | MonsterBalance level-base and allocation |
| Magic attack | MonsterBalance level-base and allocation |
| Defense | MonsterBalance only |
| Agility/speed | MonsterBalance only |
| Rank specification | Content regular/elite/smallBoss; getMonsterRank compatibility |
| Outgoing pressure | MonsterBalance.finalDamagePressure, core consumes once |
| Skill loadout | core pools, V141 carry, V144 legality unchanged |
| Skill frequency | core level tier0 through10, .35 at11–12 unchanged |
| AI | final core/V141/V155 existing carried/legal/affordable behavior |
| Formation | FourSymbolsBattlefieldSlots, three slots, no death reflow |
| Element | content explicit; neutral Adventure stat profile, no bonus invented |
| Portrait | existing V154 registry/resolver; no asset, key or name replacement |
| Reward | Adventure content rewards/runtime claim ledger; unchanged |
| Progression | Adventure Runtime chapter/node/branch/objective state; unchanged |
| Encounter lifecycle | Adventure resource monitor + shared V132/core battle/result |
| Render/UI | adventure-ui and existing battle renderer/geometry; no stat authority |

No new wrapper/patch/timer/save owner. Existing resource monitor is for player
resource continuity on defeat, never enemy stat generation. A fresh Adventure
encounter clears the existing Slot Owner snapshot only after rejecting a live
battle, preventing old indices from acquiring a preceding roster's geometry.

## Baseline and calibrated profiles

Original edge: buildEncounter -> makeZoneMonster -> makeLegacyModeMonster.
Contrary to Phase1 diagnostic assumptions, this formal edge never called
v132BuildDungeonMonster; no1.30/1.10 Dungeon bonus applies. Original ranks changed
pressure1/1.1/1.2 but not durability. Baseline nine entities HP200–250,
SP125–155, attack86–106, magic75.75–97.25, defense74–90, speed3–4.
Original18 neutral diagnostic references all survive, 1–4 rounds. Full baseline
source and resources/loadouts are in monster-balance-adventure-baseline-20261004.json.

Adventure mode: HP0.50, SP/defense/speed/outgoing pressure1.
Rank Regular HP1/DEF1/pressure1; Elite HP1.4/DEF1.05/pressure1.1;
smallBoss HP2/DEF1.10/pressure1.2. SP and raw attack remain1 for every rank.
These are Adventure-specific profiles: regular keeps the exploratory pace;
Elite/smallBoss acquire visible durability without Tower pressure or HP sponge.
Rank never adds points. Element stat profiles stay neutral.
No post-construction stat write, legacy marker or additive pressure applies.

The formal TTK matrix uses every actual encounter at suggested/+5/+10 levels,
solo and two-member legal unequipped parties, neutral and seeded draws:36 cases.
Final stat/skill/initiative/enemy AI/damage/status/round-end owners are executed,
not a copied formula. All clear+survive; Regular encounter1–4 rounds,
Elite encounter1–3, smallBoss encounter2–4. These describe whole-encounter
duration, not fabricated independent monster TTK. Raw player HP before/after,
enemy initial stats/resources/pressure, skills and control draws are preserved.
No unsupported water/high-level/ten-enemy scenario is fabricated.
Async battle/animation and save continuity still require production Chrome.

## Retirement and compatibility

Adventure's direct legacy stat caller and rank post-write physically retired.
Core pressure admits explicit Adventure MonsterBalance projection once.
Only the Adventure-specific old constructor expression is globally forbidden;
makeZoneMonster/makeLegacyModeMonster/V132 shared builders remain legal for
Personal/World Boss. Existing Wild/Daily/Tower/Abyss regressions stay mandatory.
Phase2A retains exact48 Personal/World Boss baseline comparisons; Adventure
coverage moves to Phase2E real nine projections, not weakened Boss protection.
Generic consumers keep boss compatibility through getMonsterRank.
Portrait fallback gaps are recorded by browser evidence, never corrected here.

Production build regeneration also updates generated cloud source-provenance
metadata because core source changed. Existing restricted Forest numerical
rules and all readiness/outcome/reward flags remain under their own regression.
No Cloud authority is expanded by this build synchronization.

## Verification and pending gates

Focused six tests: all identities, fixed contexts/levels/archetypes/ranks/budget,
projection, original skill/portrait continuity, pressure once, physical writer
retirement,48 immutable Boss baselines and36 TTK cases.
Existing Adventure lifecycle/reward/progression tests remain mandatory.
Existing Adventure browser entry is extended for real production runtime;
existing layout viewports retained and production390×844/412×915 added.
Required: final focused/direct regressions, identity/TTK, production Chrome,
reward/save/return/re-entry, build sync, deprecated/syntax and latest-head CI.
Only then Requirement VERIFIED; integration, dev CI/deploy/exact manifest/SHA/
Game+Cache, deployed Adventure QA and absorbed-branch deletion are separate gates.
Main untouched. Do not enter Phase2F.
