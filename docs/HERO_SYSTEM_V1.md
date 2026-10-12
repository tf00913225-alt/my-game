# Hero System V1 — Phase 1, Phase 2A, Phase 2B and Phase 2C UI

Work ID: HERO-CORE-PHASE1-20261007. Target: dev. Base dev: c1475726961a352811b195d65f7f54e905a80c5c.

## Formal domain and APIs

`functions/src/hero-core.js::FourSymbolsHeroCore` is the sole Hero Domain Owner. Immutable registry, progression costs, allocation version 1, schema validation and pure mutations live here. `FourSymbolsHeroSystem` in `js/00-main.js` adapts current account/player/skill Owners: `getDomain()` returns an immutable account snapshot with live player-level projection; obtain a fresh domain after applying a returned mutation. `replaceAccountState(next)` validates and replaces in-memory state only; callers must coordinate persistence and any consumption through their formal transaction Owner. No reward source or inventory consumption is enabled.

Domain APIs: getHeroDefinition, listHeroDefinitions, getHeroAccountState, isHeroUnlocked, getHeroLevel, getHeroSkillLevel, getHeroStarCost, getHeroTotalAllocatablePoints, getHeroAllocatedStats, getHeroBaseStats, getHeroSkillProjection, canUnlockHero, canStarUpHero, canReroll, unlockHero, unlockHeroDirect, starUpHero, rerollHeroAllocation, addSpecificFragments, serialize. Mutations return a new account without changing input. Direct unlock is a future trusted acquisition interface, not a chapter/login grant.

Registry: `divineDogHongbao` 神犬紅包 / fire / magic / phoenixCry; `vajraHeavenlyKing` 金剛天王 / wind / magic / windHowlLightning. Acquisition metadata: main-story chapter 1 clear and cumulative login day 7 respectively (not consecutive login). Only physical/magic allocation types exist. Passive definitions are metadata; no combat triggers exist.

## Progression

Hero has no EXP. Level is the minimum level of currently created player characters (`id` present); null/uncreated slots are excluded. No created character means projection is unavailable. Skill level is `min(10, 1 + floor(heroLevel / 10))`, including Lv1–9 = 1. Both are derived and never saved. Skill projection references the existing final `skillDatabase` definition without mutation or player requires/skill points.

Hero base stats delegate `calculateCharacterBaseStats` with allocated six-stat points and no equipment/external sources. The live player Owner uses base 30 plus level × 4 physical, level × 4 magic, level × 3 defense; six-stat coefficients remain its existing values. Generated Monster CombatLevelBase is not the player formula. No new Hero base table or attack/magic/defense formula exists.

Unlock: 100 specific fragments or future trusted direct acquisition; initially 0 stars. Stars 0–5; costs 25/50/75/100/150, total 400. Fragment unlock through 5 stars costs 500. Budget = `(level - 1) × 5 + stars × 15`; one star grants 15 total points, never 15 per stat.

Physical weights: Attack 30, Intelligence 10, Agility/Defense/Vitality/Energy each 15. Magic swaps Attack/Intelligence to 10/30. Allocation version 1 uses a hero-ID-mixed nonzero uint32 seed and xorshift32 weighted sequence, one roll per point. Level reduction truncates the sequence; restoration recovers it. Seeds are explicit inputs at unlock/reroll, never generated during render/hydrate. Version/sequence order must not change without migration. 洗髓丹 `heroMarrowPill` costs 1; canReroll checks available count, reroll requires a different seed and returns new canonical state. Inventory proof/atomic consumption remains a future Economy/UI integration requirement; count input is not ownership authority. Reroll affects all level/star allocation, not base/natural growth/equipment/buffs/relics.

## Persistence and compatibility

Existing UID main-save version 6 adds `heroAccount: {schemaVersion:1, heroes:{[heroId]:{heroId,unlocked,specificFragments,stars,allocationSeed,allocationVersion:1}}}`. No sidecar/key is created. `saveGame` serializes canonical fields; `loadGame` validates before mutating characters. Missing extension projects both heroes locked, zero fragments/stars, seed 1. Validation never writes storage or other fields. Existing invalid/unsupported Hero data fails closed; it is not reset to a blank account. Serialization strips derived/transient fields. Existing UID switching reload Owner and backups preserve the same main-save document. This local extension grants no server authority; future Cloud snapshot/admission must explicitly map and validate Hero ownership and costs before publication.

No level, EXP, skill level, final stats, HP, rage or temporary passive stacks are persisted.

`functions/src/hero-core.js` is the same source loaded before main in the browser bundle and required by the existing Cloud candidate policy. `cloud-save-policy.js` accepts the optional extension and delegates structural validation to this Owner; exact untrusted snapshot/raw bytes remain untouched. Read-only legacy screening retains the extension (including a missing marker) in retainedMainFields and the review plan. No Hero entitlement is validated or awarded, no playable canonical writer is enabled, and all historical claim/acceptance gates remain blocked. Raw backups/candidates are evidence, not canonical Hero ownership.

## Phase 2A — Hero Battle Foundation

Work ID: HERO-BATTLE-PHASE2A-20261007. Battle integration Owner is `js/00-main.js`; Hero Core, registry, progression and permanent schema remain Phase 1 APIs unchanged. Wild `startBattle` and shared `v132LaunchDungeonBattle` initialize fresh battle-only combatants from the current unlocked Hero domain before rendering/registration. No unlock/reward source is added.

`FourSymbolsHeroBattle.setRoster(heroIds)` accepts at most three unique, unlocked registry IDs outside battle; `useUnlockedRoster()` restores the default unlocked registry order. Selection is session-only, not saved. The existing registry has two definitions; third-Hero/six-unit capacity QA uses a disposable test domain fixture, never a production registry or saved Hero addition.

Player indexes 0–2 retain their original identities and skill/equipment keys. Battle indexes 3–5 identify Hero slot occupants, with `combatantKind="heroNpc"`, `heroId`, stable per-battle `combatantId="heroNpc:<heroId>"` and no player skill key. `getPartyCharacterByIndex` is the existing battle compatibility lookup; `getCharacters()` remains player-only and Hero level projection excludes NPCs. `getExistingPartyIndexes()` exposes six occupants only while battle is active; post-battle recovery/reward/player interfaces stay player-only. Death changes HP, never identity; legal revival restores the same object. A subsequent battle replaces all transient Hero objects.

Hero six-stat points/level come from Core projections; battle stats use the existing player base-stat and common Buff/Debuff/Relic projection Owner with no equipment/player EX. Hero normal attacks use `secondaryCharacterNormalAttack`, the existing hit/evasion, critical, Damage and HP settlement Owners. Initiative entries use `type="heroNpc"`; common Battle Flow consumes them like allied combatants. Heroes automatically declare only normal attacks, and cannot declare skills/items/escape. Shared Hard Control excludes controlled entries. A revived combatant resumes through the next legal queue build; revival never widens an already captured enemy action snapshot.

Fixed Slot and geometric targeting remain `FourSymbolsBattlefieldSlots`; the enemy Target Snapshot, legal primary selection, hostile stealth rules, healing, revival and round-end Status lifecycle include Hero occupants through the common roster lookup. Statistics registers Hero combatant IDs/kinds and records the same committed HP deltas/critical facts. Hero HP/SP/Buffs/Status/selection are outside `heroAccount`; main-save formation serialization retains only player indexes 0–2. No new storage key/schema or protected backend actor admission is introduced.

Hero artwork is not defined in this phase; battle slots use the existing textual name/element/HP/SP HUD without pretending to be a player portrait. No Hero page/equipment UI, acquisition rewards, Rage state/HUD, Hero skills/AI/passives or Phase 2B behavior is implemented. Existing player Rage Buff remains an ordinary shared Buff, not Hero Rage.

Regression: `tests/hero-battle-phase2a.test.js` and the existing production `run-battle-target-lifecycle-browser-qa.mjs` cover 0–3 Hero capacity, six distinct slots/initiative/identities, normal attack and incoming MISS/damage, death/revive, statistics, real save isolation and prior three-player target lifecycle. PR owns live CI/deploy/merge status.

## Phase 2B — Rage, skills, passives and portraits

Hero NPC kind stays `heroNpc`. Party capacity remains 3 players + at most 3 heroes in the existing six-slot Owner. `js/00-main.js` extends the existing battle adapter and Combat Events; no parallel combat system or permanent schema is added. Work PR owns validation and completion status.

Rage is battle transient 0–12; each new battle starts 0. Completed hero basic attack +1 regardless of MISS. Receiving one enemy basic/skill Action +1 once, including MISS/multihit/full shield absorption. Burn/DoT/reflect/self/environment damage give none. At rage >=4 the next own Action must use hero skill, cost 4 instead of player SP. Declaration and resolution recheck current Rage. No legal skill targets means no cost or stack reset. Death preserves Rage, revival resumes it; a new battle resets it. Hero resource HUD projects Rage using the existing secondary resource bar; player SP remains unchanged.

紅包 passive: each completed basic attack adds 15 percentage points to the next phoenixCry burn chance, stackable and preserved on death/revival; reset only on successful cast. The cast-local modifier does not edit global phoenixCry. 天王 passive: completed basic attack applies Stealth 1 round to living ally with lowest absolute current HP, including self/players/heroes; ties use canonical Battlefield Slot order. Shared named-state admission prevents refreshing an existing Stealth; the existing Round-End Owner expires it.

Hero skills use Core-projected skill level and final skillDatabase through `castSecondaryCharacterSkill`, the existing Targeting/Hit/Critical/Damage/Status/VFX/Statistics Owners. No player skill key, player EX or skill-point requirement is assigned. Completed-action facts are consumed once; enemy recipients are deduplicated on the formal action object. Rage and burn stacks live only on fresh battle actors.

Battle artwork maps stable Hero IDs to `assets/heroes/divine-dog-hongbao.webp` and `assets/heroes/vajra-heavenly-king.webp`. Sources are the two PNGs under `assets/inbox/英雄or怪物立繪/英雄/` at assets-library `7a6d7feb73a940a1a2599de261787f051c5841cc`. Lossless WebP preserves the original 1086×1448 RGBA canvas byte-for-byte without cropping/resizing. Existing combatant presentation uses contain.

Equipment must later share the player equipment/inventory Owner with exclusive physical item ownership (no simultaneous copies). Equipment, acquisition rewards/login/story/activity fragments and additional skill AI remain subsequent phases.

DEV battle preview: only the exact `dev.four-symbols-dev.pages.dev` hostname automatically supplies the two current heroes to the battle-domain projection. `FourSymbolsHeroSystem.getDomain({forBattle:true})` creates a disposable Core account copy for locked heroes, with a stable test seed; existing owned heroes retain all progression. The ordinary domain, canonical `heroAccountState`, save/load and reward claims remain unchanged. No preview entitlement exists on production, root/preview Pages URLs or localhost. The default unlocked roster therefore includes both heroes on DEV; explicit session roster selection still works. This is testing access, not chapter/login acquisition or a permanent grant.

Regression: `tests/hero-core-phase1.test.js`; existing account ownership, legacy hydration and player six-stat tests remain applicable. PR is the live CI/merge/closeout Owner.

## Phase 2C — Hero page and session roster

Work ID: HERO-PAGE-ROSTER-20261012. The existing rest window opens the Hero page through `heroHomeEntry`, using the existing gameplay-core feature intent boundary and `openHomeFeature`/`closeHomeFeature` modal lifecycle. The page shares the Large Panel frame and declares one vertical content scroll owner; portraits reuse the existing WebP artwork Owner with contain presentation.

Profiles read registry metadata, canonical stars/fragments, projected level/six stats/base combat stats/skill definition from the current Core adapter. Locked heroes can be browsed but cannot be fielded; unavailable allocation/combat stats show no fabricated values. DEV preview eligibility is visibly marked separately from canonical ownership. The page grants no chapter/login rewards or ownership and performs no star, fragment, marrow, equipment or Cloud transaction.

`FourSymbolsHeroBattle.getRoster()` returns a copy of the existing effective roster. UI controls use its existing `setRoster` and `useUnlockedRoster` APIs for admission, removal, ordering and reset. Three Hero slots are displayed, while the production registry still has only two definitions. Formation is session-only and does not survive reload; no permanent Save field is added. Battle-time changes are blocked by the runtime battle flag, independently of disabled controls. Battle creation consumes the same selection and retains formal `heroNpc` identities.

Regression: `tests/hero-page-roster.test.js` covers locked/owned/DEV projections, 0–3 capacity using a third-Hero test fixture, order/reset, battle-time guards and canonical isolation. `run-hero-page-browser-qa.mjs` verifies the production rest entry, real touch controls and scroll, mobile/tablet geometry, WebP presentation, modal return and actual UID-local save isolation; the existing UI CI and fixed-SHA DEV responsive verification jobs run it without an additional workflow.

## Formal acquisition — construction checkpoint

Work ID: HERO-ACQUISITION-20261012. User scope: chapter-one clear grants Hongbao; seven cumulative login days grant Vajra, with permanent cross-device and old-local-save duplicate protection. Work PR owns readiness; this section does not assert deployment or completed acceptance.

The initial backend slice `functions/src/hero-acquisition.js` records distinct server Taipei calendar dates (not consecutive days and never client dates/counters). Day seven atomically creates the Vajra entitlement, server-generated allocation seed, immutable unique claim, operation receipt, ledger and chained acquisition history while advancing the existing account envelope revision. Same-day/lost-response retries return the existing result; later days cannot regenerate the seed or award. Missing/corrupt history, receipt, ledger, source or claim blocks both read and mutation. The existing active-session transaction Owner is injected; local character snapshots are never claim inputs.

Private `heroAcquisition/current` and `heroAcquisitionHistory/{revision}` under the existing UID server root record acquisition evidence only. The existing `uniqueClaims`, `operations` and `ledgerEntries` collections retain immutable acquisition rights/audit; restoring a browser save does not restore or erase them. This is not another Hero Core, character Save or combat implementation. The core registry, progression formulas and local Hero schema remain unchanged, and full Cloud Save readiness remains false.

Current pending gates: callable/client and Hero projection integration, actual Firestore concurrency/session/rules tests, retained-rights recovery acceptance, chapter qualification policy/source and both acquisition flows, latest-Head CI/deployment. The initial slice is not exposed or enabled in the game. Existing historical chapter completion and undocumented login days are not trusted or backfilled.
