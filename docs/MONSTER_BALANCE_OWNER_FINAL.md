# Monster Balance Owner — Final Convergence Record

Work ID: MONSTER-BALANCE-OWNER-P2F-BOSS-20261004. PR #799, base dev.
Current status: 1/1 functional VERIFIED. Exact-source complete CI and Boss production Chrome PASS. Metadata-head CI, integration/deployment and absorbed branch cleanup remain execution gates owned by PR#799. This document does not claim COMPLETE.

| Formal mode | Level Spec Owner | Allocation Owner | Rank Profile | Mode Profile | Element Profile | Pressure Owner | Legacy stat edge |
|---|---|---|---|---|---|---|---|
| wild | registered zone identity/spec | monster-archetypes / MonsterBalance | regular/elite | Wild, original beginner compatibility | identity only | MonsterBalance projection, core consumes once | RETIRED |
| daily | V148 formal encounter definition | monster-archetypes / MonsterBalance | regular/elite/boss | Daily, original party durability/protection | identity only | MonsterBalance projection, core consumes once | RETIRED |
| tower | Owner floor=N => level=N | monster-archetypes / MonsterBalance | regular/elite/smallBoss | Tower | Owner pre-battle Earth/Wind; existing Fire/Water gameplay metadata | MonsterBalance projection, core consumes once | RETIRED |
| abyss | formal fixed Lv20/Lv40 definition and region/stage | monster-archetypes / MonsterBalance | regular/elite/smallBoss | Abyss original stage/final challenge | identity only | MonsterBalance projection, core consumes once | RETIRED |
| adventure | fixed chapter encounter definition | monster-archetypes / MonsterBalance | regular/elite/smallBoss | Adventure | identity only | MonsterBalance projection, core consumes once | RETIRED |
| personalBoss | fixed personal definition Lv20..100 | monster-archetypes / MonsterBalance | boss body, elite reinforcement | Personal Boss | identity only | MonsterBalance projection, core consumes once | RETIRED |
| worldBoss | fixed world definition Lv40/60/80/100 | monster-archetypes / MonsterBalance | boss body, elite reinforcement | World Boss plus Owner World stage1..4 | identity only | MonsterBalance projection, core consumes once | RETIRED |

Every level-to-combat conversion uses level-base-contract.mjs and
monster-balance-owner.mjs. Ability budget is (level-1)*5 for every rank.
Fixed archetypes belong to explicit content specs; no random allocation
builder remains. monster-archetypes.mjs is the canonical allocation dependency
of the sole MonsterBalance projection. Earlier mode calibration is unchanged:
288 frozen starting-dev references plus the existing formal mode regressions.

## Physically retired numerical authorities

- Core generateMonsterAttributePoints and makeLegacyModeMonster.
- V132 buildDungeonMonster export and strength/normal/rank multiplier writers.
- bossBalanceProfile and dead defenseMultiplier metadata (never activated).
- Boss post-build HP/raw attack and World stage scaling edges.
- Earlier Wild/Daily/Tower/Abyss/Adventure post-build stat edges recorded in
  monster-balance-owner-retirement-map.json.

The registered Wild makeZoneMonster adapter rejects missing explicit identity.
Formal other-mode callers build MonsterBalance directly. The shared V132
launcher remains a battle lifecycle owner, not a numerical builder. Existing
V148 Exp/Material entries remain authoritative; overwritten inactive V132
roster/entry paths were removed after caller and final-loader tests.

## Responsibilities kept outside pre-battle balance

GameplaySystem owns Boss phase/skill frequency, objects, shield, reinforcement
summon timing, fixed six-center footprint, object F1/F5, reinforcement B1/B5,
Boss snapshot, first/repeat clear, ore/relic/gold, UI/VFX and end lifecycle.
Objects are mechanism entities, never Boss/Elite MonsterBalance bodies.

Generic live skill shields, barrier expiry, rage restoration, rock-wall and
blessing states, and relic debuff/expiry retain their existing owners. They
are individually classified in the final audit; no new pre-battle formula is
introduced. Hard control remains <=60% in both directions. The unowned damage
fixture compatibility fallback is not a Runtime constructor and cannot add
pressure to formal MonsterBalance entities.

## Durable gates

- tests/monster-balance-owner-phase1 through phase2f: 53/53 local PASS.
- Boss focused: 7/7; 9 Personal identities +4 World identities ×4 stages.
- Boss formal neutral/seeded TTK: 50/50 clear+survive; Personal7–11,
  World stage1:5–6, stage2:7–8, stage3:7–8, stage4:7–11 rounds.
- Snapshot/mechanism/Shield critical and direct Boss VFX regressions: PASS.
- scripts/monster-balance-final-convergence-audit.mjs: retired Runtime token
  hits0; remaining evidence/build/test/history and live mechanism writes
  classified explicitly. Self-generated audit JSON is excluded from recursive
  evidence-token counting.
- npm run build / build:check: PASS through official build-production.mjs.
- Production browser390×844/412×915: 18/18 natural scenes PASS; Personal20/30/70, World40 stage1–4 and Personal/World repeat rewards, projection/slots/snapshot/object/reinforcement/shield PASS. Exact source b6f02419; CI37216148173 Boss job111476945757 SUCCESS; artifact11309660021 SHA2564bc8c23163b1e669f16d1c41cb25b624baebad98b0f23cc511259d1c311b1c2c independently checked and representative screenshots reviewed.
- Latest functional-source full CI and independently checked Boss artifact: PASS. 53/53 Phase1–2F aggregate, 7/7 focused, 50/50 formal neutral/seeded TTK, 18/18 natural Chrome scenes at390×844/412×915, snapshot/mechanism/reward regression, final legacy audit and build sync PASS. Exact source d5f88fb03130360add0bbd330930c80c5db6b5c7; Repository CI37220134518 jobs111488621828/111488621822/111488621691/111488621595 SUCCESS; Session CI37220134254 job111488620833 SUCCESS. Boss artifact11309889570 SHA256f949c5f06aa8277bb959e7b111f93599481e6fa1d1cb684126dd8a77c4a26606 independently checked.
- Metadata-head CI, deployed exact SHA/live QA and safe branch cleanup: pending; PR#799 is durable execution owner. Requirement1/1 VERIFIED.

After Phase2F closes, stop this engineering program. Return to NORMAL
DEVELOPMENT; any later balance calibration needs a separate approved project.
