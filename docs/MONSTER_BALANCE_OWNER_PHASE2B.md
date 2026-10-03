# Monster Balance Owner Phase 2B — Daily

Work ID: MONSTER-BALANCE-OWNER-P2B-DAILY-20261003. Start dev: 4274454a30f25f5807fa589804413efe8ec13290. Main observed: f63d69dbfa66ba75637d1c3cd7fcc7d74782e356; never written. Branch: feature/monster-balance-owner-phase2b-daily-20261003. Status: FUNCTIONALLY VERIFIED; natural Chrome PASS on source 1b4cb31 / merge snapshot 9dce10c7. Latest Required CI, dev integration/deployment/closeout remain pending. Current durable status is owned by this work PR.

## Responsibility inventory / multi-owner decision

1. Formal entry and lifecycle: V148 `beginFormalDailyDungeon` → `buildDailyDungeonWaves` → `buildDailyWave` → existing `MonsterBalance.build`. No V132 stat builder or makeZoneMonster fallback in Daily.
2. Stat authority: `js/combat/monster-balance-owner.mjs`; same Level Base and deterministic Archetype allocation adopted by Wild. Classic synchronous projection generated from identical ESM by `syncMonsterBalanceRuntime`; build:check rejects drift.
3. Rank: explicit regular/elite/boss. boss is accepted only in mode=daily; challenge smallBoss is rejected for Daily. Existing core getMonsterRank remains sole resolver. No name guessing or late reroll.
4. Mode/party durability: Owner immutable Daily profile. Party size is recorded when three rosters are built, never read from mutable global party state during render.
5. Level selection: existing V132 highest*0.70 + average*0.30, rounded; unchanged. No highest-level multiplier after level selection.
6. Skill frequency: existing `getMonsterSkillTierAndChance` supplies baseline 0/.35/.45/.55. Owner resolves solo wave1=0 and later min(.45,base*.60) once at construction. V141/V144 remain legal carried-skill/loadout owners and do not rewrite skillChance. V158 retains only temporary action-level beginner boss cooldown (restore in finally); V149 temporary forced follow-up belongs to established Gameplay, not pre-battle calibration.
7. Final outgoing pressure: core `getEnemyPressureMultiplier` consumes Owner.finalDamagePressure once for explicit Daily. v132Dungeon is compatibility metadata only. Rank+mode multiply, no Daily +5%. Raw attack and magicAttack never receive Daily damage-pressure calibration.
8. Begin/activate/render/battle/next-wave/return/re-entry: V148 existing three-wave lifecycle activates fresh projected rosters, resets HP/SP/status resources, never reapplies profiles. V158 render stat normalization and its hook are physically removed.
9. Rewards, UI, portraits, equipment, players and non-Daily runtime are excluded. Existing slot geometry and all eighteen identities remain.
10. Legacy retirement details are authoritative in `monster-balance-owner-retirement-map.json`.

## Profiles and identity

Daily base mode hp/defense/damage/sp=1; global hp/sp/damage/defense=1. Rank Regular hp/defense/pressure=1/1/1; Elite=1.50/1.10/1.10; Daily resource Boss=2/1.15/1.15. Rank never increases allocation/ability budget/SP/raw attacks/speed.

Calibration final party HP durability: one=.04, two=.08, three=.12. This factor acts only in Owner pre-battle HP projection. It is neither V158 whole-core scaling nor a level or player-power multiplier. Low-level solo (highest <=20) pressure=.50; otherwise1. Rank still applies once (protected solo Elite .55 / Boss .575). No points, raw attack, SP, level, allocation or speed are scaled by party size.

Starting factors .60/.80/1 produced 3–9-round failures and party deaths in formal damage/action diagnostics. .08/.16/.24 retained nine failing waves; .04/.08/.12 met TTK but solo Gold Lv10/20 still died from cumulative fast-enemy actions. Explicit low-level solo pressure .50 solved survival, preserving normal teams' damage1. No per-type or per-monster HP adjustments. Boss HP2 and defense1.15 remain approved ratios. Calibration source/evidence: existing reference party and `daily-balance-ttk-matrix.mjs`. These are deterministic representative builds, not a guarantee for arbitrary builds/random misses.

All nine portrait-key identities map in `config/daily-monster-archetypes.json`: cultivation disciple/elite magic, instructor balanced; ore guard tank/elite physical/commander tank; vault guard physical/elite speedControl/manager balanced. Same name keeps one archetype across elements. Existing legal damage/support/control pools are used. Tank has defensive allocation but no invented defensive AI. speedControl uses legal existing debuff/control when available, damage fallback otherwise. No assets or names are replaced.

Normal formations remain 6Regular → 4Regular+2Elite → 3Regular+2Elite+1Boss. Protected solo <=20 remains 6Regular → 5Regular+1Elite → 4Regular+1Elite+1Boss. All waves contain6. Skill/accuracy/crit protection and cooldown metadata remain; Accuracy/Evasion are independent0 base, no new rank accuracy/crit bonuses are introduced.

## Retirement / compatibility

V158 DAILY_DUNGEON_SCALE_FIELDS, .5 whole-stat difficulty, party .40/.72/1, level .80/.90/1/1.05, stored base-stat/scale markers and pre-render normalizer: RETIRED. No restored HP on every render.

Equipment dedicated elite/boss factors, constructor, roster and inactive original entry: physically RETIRED. Complete current-loader search shows formal v132BeginEquipmentDungeon already aliases V148 Gold; no other effective runtime caller uses the equipment builder. Existing compatibility button/save name continues to mean Gold. Equipment reward/inventory helpers are not reintroduced as gameplay.

V132 shared1.30/1.10 and3.20/4.50 builders remain NON-DAILY COMPATIBILITY ONLY for Tower/Abyss/Boss and existing legacy consumers. Core legacy allocation and pressure keep non-Daily outputs. Daily has no caller edge to them. Retire after explicit Phase2C Tower,2D Abyss,2E Adventure and2F Personal/World Boss migrations; do not delete shared dependencies early. Historical V132 old EXP/Material entry functions are superseded by V148's canonical exports in the final loader; they are not formal Daily Runtime entry owners.

## Evidence / gates

Focused Phase2B:972 actual Daily identities across Lv10/20/30/50/70/100 ×1/2/3 ×EXP/Material/Gold ×3waves×6, preview equality, formal preparation hooks, fresh re-entry, single rank/pressure, point invariance and retirement. Isolated VM does not parse renderPlayers DOM; actual render/visible UI proof belongs to real Chrome.

Reference owner remains `tests/fixtures/wild-balance-reference-party.js`, extended with an optional partySize only. No second reference fixture or changed stat/skill budget.54 encounters /162 cumulative HP/SP waves all clear <=2 rounds with living characters. Diagnostics execute real action/stat/damage/status owners and neutral.5 rolls; no animation callbacks. Natural full lifecycle separately required.

Phase1/2A20/20, unchanged common compatibility outputs,50 real Abyss rosters,123 Tower/Boss/Adventure outputs and40 Wild TTK checks retained. Direct Six-Stat, Daily integration, battle-render, V158, hit/evasion, portraits and Tower regressions pass locally.

Real Chrome harness `.github/scripts/run-daily-balance-browser-qa.mjs` uses production index/bundles with existing read-only isolated account transport, fresh profile per390×844/412×915. EXP/Material/Gold full waves, manual/automatic, reward/return and EXP re-entry at both sizes, low-level solo Gold at412. It observes natural turn/wave boundaries, projection equality after actual render, HP/SP and visible artwork; never calls winBattle or changes damage formulas. Existing CI steps extended; no duplicate workflow. Local Chrome154 binary was found but OS socket() EPERM prevents it from launching. That local attempt is FAIL/NO browser evidence, not PASS; runner Chrome evidence is required before completion.

Stop after Phase2B. No Tower Phase2C or production/main release.

## Representative values and damage evidence

EXP, party3, same-level reference. R/E/B use their deterministic name mapping (Boss balanced), so raw allocation differs by archetype, never by rank. HP/SP/physical/magic/defense/speed shown below.

| Lv | Regular | Elite | Daily Boss |
|---|---|---|---|
| 10 | 54/155/82/90.5/94/7 | 81/155/82/90.5/103.4/7 | 132/155/102/74/117.3/4 |
| 20 | 96/260/146/162/162/14 | 144/260/146/162/178.2/14 | 252/260/182/120.75/209.3/10 |
| 30 | 144/380/202/228/234/22 | 216/380/202/228/257.4/22 | 372/380/262/170.25/301.3/14 |
| 50 | 234/605/322/365.5/374/37 | 351/605/322/365.5/411.4/37 | 612/605/422/266.5/485.3/24 |
| 70 | 324/830/442/503/514/52 | 486/830/442/503/565.4/52 | 852/830/582/362.75/669.3/34 |
| 100 | 456/1160/626/712/722/74 | 684/1160/626/712/794.2/74 | 1212/1160/822/505.75/945.3/50 |

TTK entries are Wave1/2/3; each party cell lists EXP;Material;Gold. Neutral .5 rolls and the existing reference owner, cumulative resources, all cases survive.

| Lv | Solo | Party2 | Party3 |
|---|---|---|---|
| 10 | 2/2/2; 2/2/2; 2/2/2 | 1/1/1; 1/1/1; 1/1/1 | 1/1/1; 1/1/1; 1/1/1 |
| 20 | 2/2/2; 2/2/2; 2/2/2 | 1/1/1; 1/1/2; 1/1/1 | 1/1/1; 1/1/1; 1/1/1 |
| 30 | 1/1/1; 1/1/1; 1/1/1 | 1/1/1; 1/1/1; 1/1/1 | 1/1/1; 1/1/1; 1/1/1 |
| 50 | 1/1/1; 1/1/1; 1/1/1 | 1/1/1; 1/1/1; 1/1/1 | 1/1/1; 1/1/1; 1/1/1 |
| 70 | 1/1/1; 1/1/2; 1/1/1 | 1/1/1; 1/1/2; 1/1/1 | 1/1/1; 1/1/2; 1/1/1 |
| 100 | 1/1/1; 1/1/2; 1/1/1 | 1/1/1; 1/1/2; 1/1/1 | 1/1/1; 1/1/2; 1/1/1 |

Solo average damage taken per wave (EXP;Material;Gold), cumulative HP is never restored between waves:

| Lv | EXP | Material | Gold |
|---|---|---|---|
| 10 | 106/109/125 | 122/137/146 | 152/182/188 |
| 20 | 178/184/211 | 198/231/247 | 271/310/313 |
| 30 | 0/0/0 | 0/0/0 | 0/383/357 |
| 50 | 0/0/0 | 0/0/314 | 0/576/537 |
| 70 | 0/0/0 | 0/0/419 | 0/765/713 |
| 100 | 0/0/0 | 0/0/253 | 0/1765/1211 |

Actual skill-hit samples: Lv100 Gold Elite Flame Tornado=927 damage to its single chosen target; Ice Arrow Rain=432 per target (party3 total1296). Lv100 Material Boss Flying Sand=253 per target (party3 total759). The HP920 Lv10 protected solo Gold reference finishes at398; Lv20 HP1720 finishes826. Fast Elite actions are recorded, and no sampled party is wiped by two actions. Full raw events and every final projection are retained in `monster-balance-daily-ttk-evidence.json`. Natural browser survival remains a separate gate.

## Natural Chrome verification — source 1b4cb31

Existing CI run37132447706/job111230087559 Daily step PASS. Artifact11276934048 ZIP SHA256 e782d11d76b9cb2e60a9e76bb0883df73cb7f2e2b65d3e3164d576027aaac01e was independently downloaded and verified. Raw report and exact source/merge provenance: `monster-balance-daily-browser-evidence-20261003.json`. Both390×844/412×915 passed EXP/Material/Gold plus EXP re-entry;412 additionally Lv10 solo Gold. Nine encounters /27 natural waves: reference Lv50 party3 all one round, Lv10 solo all two rounds and final HP382. Manual skill/target declarations and Gold auto actions use existing owners, no watchdog recovery. EXP3180276, material3, Gold4500 (Lv50)/2500 (Lv10), return/run cleanup PASS; actual visible portrait/HP/SP/status/floating feedback and repeated render projection equality PASS. Representative EXP/Material/beginner Gold wave3 screenshots reviewed, unobstructed. Previous local Chrome launch remains unavailable and is not counted as browser evidence. Functional requirement1/1 VERIFIED; latest full CI, dev merge, exact deployed runtime and cleanup remain separate gates owned by PR#784. No Phase2C/main release.
