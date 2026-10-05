# Monster Balance Owner — Final Convergence Record

Work ID: MONSTER-BALANCE-OWNER-P2F-BOSS-20261004. PR #799, base dev.
Status: COMPLETE.
Monster Balance Owner Phase 1–2F: COMPLETE.
All seven formal modes use Single MonsterBalance Stat Owner.
Final Phase PR #799: MERGED. Final Head: 0c66504aa877c3e004cadef983135954f7909a77.
Merge / verified Phase2F deployment SHA: db8530b59d683231535da717d1f641c391adbbcd.
Requirement1/1 VERIFIED; construction branch deleted / absent; main not modified.
Final documentation Work ID: MONSTER-BALANCE-OWNER-FINAL-CLOSEOUT-20261005.
Rechecked against opening dev 3b4ffbc2963cc472fa13857e2923cb80506e93e4 on 2026-10-05.

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
## Final Phase 2F verification

Requirement1/1 VERIFIED; aggregate53/53 PASS; focused7/7 PASS;
formal TTK50/50 PASS; production Chrome18/18 PASS at390×844/412×915.
Personal identities9; World identities4, four stages each.
Final Head CI37222770813 attempt2 SUCCESS; Session37222770470 SUCCESS.
Merged-dev CI37227464910 SUCCESS: Repository111509986097, Boss111509985888,
Abyss111509985979, Adventure111509985816; deployment111516425091 SUCCESS.
Session37227464696 SUCCESS. Deployed exact SHA:
db8530b59d683231535da717d1f641c391adbbcd; Game/Cache173.73/173.73.
Live Boss artifact11314822885 SHA256d05ff7229ce6af3ea607b7e5545875d3c803088ce5772fea78df9941d274620d;
final manifest11314967111 SHA256aa781e094a1ba4fe1b68c0a931e8ce60282c9211843b1f48389b4f76771725e6.
PR #799 retains independent checks and deploymentShaVerified:true.
Construction branch deleted / absent; main f63d69dbfa66ba75637d1c3cd7fcc7d74782e356 not modified.

## Phase closeout index

| Phase | Scope | Status | PR | Merge / verified phase deployment SHA |
|---|---|---|---|---|
| 1 | shadow foundation | COMPLETE | [#777](https://github.com/tf00913225-alt/my-game/pull/777) | de5e2049eae20294a173f3e7f5b57fa54c5afe9b |
| 2A | wild | COMPLETE | [#780](https://github.com/tf00913225-alt/my-game/pull/780) | 4274454a30f25f5807fa589804413efe8ec13290 |
| 2B | daily | COMPLETE | [#784](https://github.com/tf00913225-alt/my-game/pull/784) | 7558011ba38ed533fc25556314007adda6734e33 |
| 2C | tower | COMPLETE | [#788](https://github.com/tf00913225-alt/my-game/pull/788) | f47862cc592870e359d31da5da52a5d530c831a8 |
| 2D | abyss | COMPLETE | [#793](https://github.com/tf00913225-alt/my-game/pull/793) | dbe58d74f0c13be871512d880cb8dc2e377eab5d |
| 2E | adventure | COMPLETE | [#797](https://github.com/tf00913225-alt/my-game/pull/797) | 0de3c3a5c9c5aff789b071f9bd89b4dcdce413d9 |
| 2F | personalBoss / worldBoss | COMPLETE | [#799](https://github.com/tf00913225-alt/my-game/pull/799) | db8530b59d683231535da717d1f641c391adbbcd |

## Documentation search disposition

A. Current formal files: final/phase documents, retirement map and Monster Balance
requirement metadata now record final closeout. No new requirement ID or status reset.
B. Historical evidence: source-time implementation/checkpoint sections, historical*
map fields, earlier HANDOFF entries and source-bound browser/TTK JSON are retained.
Their pending language does not reopen completed phases.
C. Test fixtures: searched; no requested stale execution-status phrases found.
D. Build artifacts: searched; no requested stale execution-status phrases found;
not edited. Unrelated Cloud pending records are outside this closeout.
Build-production does not consume docs/HANDOFF/Requirement evidence text;
production regeneration is not required for this batch.

Project Mode: NORMAL DEVELOPMENT.
Stop this engineering program. Later monster-strength changes require a separate
Monster Balance Calibration project; do not reopen Phase 1–2F migration.
