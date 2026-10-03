# Monster Balance Owner Phase 2B — Daily

Work ID: MONSTER-BALANCE-OWNER-P2B-DAILY-20261003. Start dev: 4274454a30f25f5807fa589804413efe8ec13290. Main observed: f63d69dbfa66ba75637d1c3cd7fcc7d74782e356; never written. Branch: feature/monster-balance-owner-phase2b-daily-20261003. Status: IMPLEMENTED; natural Chrome, latest Required CI, dev integration/deployment/closeout pending. Current durable status is owned by this work PR.

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
