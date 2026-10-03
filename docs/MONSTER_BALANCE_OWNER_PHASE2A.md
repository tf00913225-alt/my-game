# Monster Balance Owner Phase 2A — Wild

Work ID: MONSTER-BALANCE-OWNER-P2A-WILD-20261003. Original start dev: de5e2049eae20294a173f3e7f5b57fa54c5afe9b. Resume observed dev: 8d797b6b9ce91abfa42064a2f044c2028060b672. Main observed: 642727e0dd687dc4d64edafbf3986ce63b7ab72c; this work never writes main. PR #780 is the only work PR. Status: IMPLEMENTED candidate; natural Chrome, CI, merge, deployed exact SHA and closeout pending.

## Authority and lifecycle

`js/combat/monster-balance-owner.mjs` is the sole Wild pre-battle stat authority. `level-base-contract.mjs` and `monster-archetypes.mjs` supply its immutable base and deterministic allocation. Classic App Shell builds Wild rosters synchronously; `scripts/lib/monster-balance-runtime-source.mjs` mechanically embeds those exact ESM sources and the key mapping into `00-main.js`. Build/check rejects a stale generated projection. There is no handwritten second formula or independent multiplier.

`makeZoneMonster` only adapts explicit Wild identity/spec, portrait and existing skill hooks. Callers must pass mode=wild and stable context; it never guesses from currentZone, v132Dungeon or historical flags. Its legacy branch delegates to `makeLegacyModeMonster` for unmigrated Daily/Tower/Abyss/Adventure/Boss callers. `generateMonsterAttributePoints` is inaccessible to the Wild path. `config/wild-monster-archetypes.json` uses the existing portrait keys and contains no duplicate name registry; all56 identities explicitly map to the six archetypes. Unknown keys throw rather than silently generating random points.

Zone rosters are created through this adapter. Wind/Earth expansion passes the same explicit spec. Encounter rank selection keeps the existing independent10% Elite chance, sets canonical `monster.rank` by fresh Owner projection and resets resources rather than multiplying an old result. Respawn/next entry reuse formal identities and do not apply a calibration again. Rendering reads final values. Combat effects, debuffs and temporary shields remain their existing gameplay responsibilities; they are not pre-battle balance writers.

V141/V144/V158 constructor wrappers are removed. Named construction hooks preserve carried/element-legal skills and explicit/default evasion. Physical/magic loadouts filter their existing legal pools by category; speedControl selects existing control/debuff capabilities; support carries the existing legal water Heal and reserves one carry slot. Low-level no-skill protection remains. Tank keeps its defensive allocation and an explicit defensive-AI capability gap: no new tank skill or AI is claimed. No fourth wrapper is introduced.

## Ratified Wild profiles

Level1 physical/magic/defense base30. Growth per level above1 is4/2.75/4. Budget=(level-1)*5; Elite has exactly the same allocation and raw attacks as Regular. HP base100 + Vitality*50; SP base50 + Energy*15. Monster player-style level bonusHP/bonusSP remain absent.

Regular: HP1, Defense1, final outgoing damage1. Elite: HP1.50, Defense1.10, final outgoing damage1.10. The existing core damage settlement consumes the projection's rank pressure exactly once; neither raw attack receives Elite damage scaling. No Wild Small Boss exists or is introduced.

Global Calibration stays hp/sp/damage/defense=1. Wild Mode Profile: HP0.32, SP1, Damage1, Defense1. The multiplier is independent of zone, player level, equipment and current player power. Level progression alone grows the base/allocation. Beginner context wild/zone-01 has speed0 inside the projection, conserving its allocated points. Existing no-skill, normal damage5–8 and no-crit safety remain. Legacy blanket core*0.5 and its markers are removed.

Calibration evidence: the corrected unequipped reference (same-level three characters, formal abilities and affordable prerequisite skills), neutral0.5 rolls, six-member high-tier encounters and formal damage/actions/status functions had Regular3–4-round mid/high clear times with HP1. HP0.40 still required3 rounds at Lv100 against adverse water; HP0.35 met the direction but introduced HP quantization inconsistencies in the exact1.50 rank comparison. HP0.32 preserves integral Regular resources and exact Elite ratio, and the40-case matrix has Regular1–2, one-Elite-tank1–3 rounds. This is a concentrated mode calibration, not a zone multiplier or new damage system. These are deterministic representative targets, not a guarantee for every random miss, party build or player choice. Natural lifecycle verification is separately required in Chrome.

## Balance Reference Party

`tests/fixtures/wild-balance-reference-party.js` is diagnostic only and never a production dependency. Each character has the formal starting10 ability points plus5 per level; intelligence35%, vitality20%, energy10%, defense15%, agility15%, remaining points attack. Rounding assigns the remainder to attack, conserving the budget. Player +30HP/+10SP per level remains the existing formula. Equipment is empty, with no gems, forge, relic, permanent buff or EX bonus. Player stats are queried through getPartyBattleStats; damage is never hardcoded.

All three are fire casters. Lv10 uses fireRocket10 (skill cost11 of20). Lv30+ uses phoenixCry10 plus prerequisite fireRocket/blazeSpell/flameTornado1 (formal costs and unlock levels checked against level*2 skill budget). Slots below the normal third-character unlock are granted in the isolated diagnostic only because the requested reference explicitly uses three members; this does not change creation/unlock Runtime. A six-role roster is projected at the requested level; Lv10 uses an unlocked Forest fixture and the formal early-zone maximum3 (test-only same-level specs; ordinary live Forest levels remain2/3), higher levels maximum6. One Elite case promotes the tank, including the Lv10 third entity. Four defender elements test favorable, neutral and adverse DNA matchups.

`scripts/wild-balance-ttk-matrix.mjs` executes the formal skill/action/stat/damage/status owners in an isolated VM, formal speed order and enemy actions, then Round-End effects. It does not run asynchronous animation callbacks; it is diagnostic, not the natural Battle Runtime proof. `docs/monster-balance-wild-ttk-evidence.json` retains40 rows and reference stats. `run-wild-balance-browser-qa.mjs` uses the existing isolated Firebase transport and production index/bundles, natural startBattle/startResolutionPhase/round transitions, no modified damage formulas, 390x844/412x915, actual patrol/manual/auto/settlement/re-entry and Beginner safety. It lives in the existing Required CI; no workflow is added.

## Retirement and compatibility

V131 strengthenMonster/strengthenAllZoneMonsters and0.75–1.30 Wild zone table: RETIRED. V141 strengthenNewWildMonster: RETIRED. V158 halveMonsterCoreStats: RETIRED. `_v131StrengthApplied` and `v17342BeginnerStatsHalved`: removed. V141/V144/V158 makeZoneMonster wrapper chain: RETIRED. The detailed authoritative inventory is `monster-balance-owner-retirement-map.json`.

The redundant V141 initial regular-rank writer and rank resolver replacement are removed; core getMonsterRank is the sole resolver. Debug uses the actual retained projection, with explicit resource/speed bases, final damage pressure and provenance; it never recomputes stats.

`v141BattleRank` only mirrors canonical rank for unchanged reward/UI consumers; no rank resolver reads it. Remove the mirror when all reward/UI readers are migrated to monster.rank, in a later explicit semantic migration. Unmigrated common builders/stat writers and non-Wild enemy-pressure compatibility stay until the corresponding Daily→Tower→Abyss→Adventure→Boss migrations. EXP/drop/quest/reward/save/portrait/UI/formal player stats and skills are not rebalanced.

The immutable non-Wild baseline was captured from the starting dev and is not regenerated to conceal a changed output. Regression compares common Legacy/Daily builders and all50 actual Abyss rosters. An additional123-row fixture captured by executing the original starting dev (not the candidate) compares actual Tower regular/elite, Tower Boss, Personal/World Boss builders at six levels/four elements and all Adventure encounter builders. It includes native tower damage/critical/status metadata. Phase1's540 historical rows and50 Abyss evidence remain archival; buildMatrix now reads that snapshot because replaying physically retired Wild functions is invalid. Active Phase2A equality uses528 level/archetype/rank/element specs plus the full56-identity final loader, Elite raw stats and damage regression, repeated rank draw and source retirement guards.

## Completion gate

Do not claim Wild Runtime Migrated until final Required CI, natural Chrome results, actual non-Wild output checks, exact dev deployment, branch safety cleanup and retirement map closeout are all recorded in PR #780. Stop after Phase2A; Daily is not authorized here.

Browser continuation: first candidate ab3be277 passed Tower and Hit/Evasion actual Chrome, but the Wild harness tried to enter Desert at reference Lv10 while the formal unlock is Lv11. That harness mistake is corrected by using the unlocked Forest test fixture, without changing any production unlock. The Lv1 safety fixture uses an affordable skill level1, never a Lv10 loadout. First Wild browser run is FAIL, not Runtime/TTK PASS.
