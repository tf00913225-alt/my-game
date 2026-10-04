# Monster Balance Owner Phase 2F — Personal / World Boss

Work ID: MONSTER-BALANCE-OWNER-P2F-BOSS-20261004.
Base dev: 9fff3664d2767739fe8cd5c893f2985f8032d5ef.
Main: f63d69dbfa66ba75637d1c3cd7fcc7d74782e356; forbidden.
Branch: feature/monster-balance-owner-phase2f-boss-20261004; target dev.
Status: IMPLEMENTED, not VERIFIED. PR owns current Head / CI / pending gates.
Classification: Convergence / Replacement / Removal. No new runtime wrapper.

## Inspected formal content

Nine Personal identities: personal-20/30/40/50/60/70/80/90/100.
Four World identities: world-40/60/80/100, each with stages 1–4 (16 cases).
Original names, fixed levels, fire/water identities, objects, phases, summon
plans, skill IDs/chance, first/repeat rewards and progression are unchanged.
All fixed archetypes are balanced: existing loadouts mix physical/magic and
change by stage/phase; no stable exclusive role or defensive-AI capability is
declared. This is an explicit evidence-based fallback, never a spawn-time roll.

## Caller graph / 28 responsibility inventory

Boss entry -> definition/progress selects stage -> buildBossMonster ->
MonsterBalance.build -> levelBase / allocatePoints / rank+mode+stage projection
-> configureBossSkills -> v132LaunchDungeonBattle -> Boss-owned snapshot ->
geometry/presentation/render -> initiative / final enemy AI / damage/status ->
Boss Round mechanism/phase/summon -> completion -> reward/persist/return.

| Responsibility | Owner / disposition |
|---|---|
| Definition | gameplay-boss-tower-system PERSONAL_BOSSES / WORLD_BOSSES |
| Level specification | fixed definition level; projection validates/converts |
| Element | definition; no new Boss element stat bonus |
| Rank | explicit boss for body, elite for reinforcement |
| Six stats | MonsterBalance / monster-archetypes allocation |
| HP | MonsterBalance final.maxHP |
| SP | MonsterBalance final.maxSP |
| Physical attack | MonsterBalance final.physicalAttack |
| Magic attack | MonsterBalance final.magicAttack |
| Defense | MonsterBalance final.defense |
| Speed | MonsterBalance final.speed |
| Mode profile | separate personalBoss/worldBoss inside MonsterBalance |
| Stage stat profile | WORLD_BOSS_STAGE_PROFILES inside MonsterBalance |
| Final outgoing pressure | projection; getEnemyPressureMultiplier consumes once |
| Skill loadout | configureBossSkills / existing legal skill registry |
| Skill frequency | configureBossSkills (phase/stage semantics preserved) |
| AI | core / V141 / V155 final legal carried-skill decision owners |
| Mechanisms | GameplaySystem processBossRound (not stat projection) |
| Objects | buildBossObject, construct, no action/reward/balanceOwner |
| Reinforcement | existing summon timing/atomic snapshot assignment; elite projection |
| Shield | Boss health/absorption owner; maxHP ratio once |
| Formation / footprint | Boss snapshot + BattlefieldSlots; six center slots |
| Portrait | V154 / existing portrait registry and resolver |
| Reward | grantConfiguredReward; unchanged |
| Progression | completePersonalBoss / completeWorldStage; unchanged |
| Snapshot lifecycle | seed/release/restore Boss snapshot; unchanged |
| Battle end | core end detection / V132 callback / Boss release |
| UI / VFX | existing geometry/presentation/VFX/statistics; unchanged |

## Legacy baseline and candidate profiles

Original baseline is retained in monster-balance-boss-baseline-20261004.json.
The actual chain was legacy random allocation -> V132 1.30/1.10/rank ->
bossBalanceProfile level/party/mode -> buildBossMonster stage HP/raw-attack
postwrites -> legacy rank+dungeon pressure. defenseMultiplier had no runtime
consumer (only exposed metadata/tests), so it is retired, never activated.
Two/three-member recommended party metadata remains for object floors and UI,
not additional Boss ability points or dynamic player-power scaling.

Candidate body rank: HP3, SP2, DEF1.25, outgoing pressure1.2.
Personal mode: HP1, SP/DEF/speed1, outgoing pressure0.4.
World mode: HP1.15, SP/DEF/speed1, outgoing pressure0.45.
Formal World stage HP intent remains .78/.88/.96/1; outgoing pressure uses
.92/1/1.06/1.12 once. Raw attacks are no longer multiplied by pressure.
Reinforcement has Elite rank HP1.5/DEF1.1/pressure1.1 and does not inherit body
rank or World body stage scaling. Global profiles and earlier mode coefficients
remain unchanged; budget always (level-1)*5, including all ranks.

Initial old neutral matrix: 25 cases, 7 losses, clearing Personal10–17 rounds.
Initial candidate neutral+seeded: 50 cases clear+survive; Personal7–11 rounds,
World5–11 rounds. These are provisional synchronous diagnostics. They are not
Chrome evidence and must be regenerated after the Shield packet correction.
No forced two/five-round target. Mechanism events, shields, objects, summons,
phase, final HP, player survivors, skills and hard-control observations are
recorded by formal owners, not HP/DPS arithmetic.

## Retirement and verification boundaries

Core legacy allocation/constructor and V132 stat builder/multipliers removed.
Dormant V132 Exp/Material entry/roster functions were superseded by final V148
exports; only their inactive numerical paths are removed. Existing rewards,
launcher, ore/chest helpers and final V148 entry/rosters remain.
makeZoneMonster is exclusively the registered Wild adapter and rejects missing
explicit Wild specs. Boss mechanisms use no generic monster base builder.
Deprecated gate forbids all physically retired stat tokens and dead defense
metadata. Legacy pressure fallback for unowned compatibility damage fixtures
is not a monster stat builder; formal seven-mode entities consume projection.

Lower Boss maxHP exposed an existing shield packet clipping boundary: setter
clamped negative incoming HP before shield absorption. It now retains the
full incoming packet and clamps resulting HP after shield absorption. Existing
overflow/heal regressions use HP-relative packets and remain mandatory.
No new damage formula, skill, reward, object count or snapshot architecture.

Required remaining gates: final focused/aggregate + all directly related
regressions; final neutral/seeded TTK; production Chrome390×844/412×915 Personal
and all World stages; snapshot/mechanism/reward/repeat/transition; final Runtime
scan; build/check; latest-head CI; dev merge/deployment/exact SHA and absorbed
branch cleanup. Requirement remains IMPLEMENTED. No COMPLETE claim.
