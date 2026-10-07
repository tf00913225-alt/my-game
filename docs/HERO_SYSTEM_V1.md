# Hero System V1 — Phase 1 and Phase 2A

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

## Future Rage and passive contract — not implemented

Hero NPC kind stays `heroNpc`. Phase 2A party capacity is 3 players + at most 3 heroes in the existing six-slot Owner; Hero uses the same Battle Runtime and Statistics Owner. The following Rage/passive behavior remains unimplemented metadata.

Rage is battle transient 0–12; each new battle starts 0. Completed hero basic attack +1 regardless of MISS. Receiving one enemy basic/skill Action +1 once, including MISS/multihit/full shield absorption. Burn/DoT/reflect/self/environment damage give none. At rage >=4 the next own Action must use hero skill, cost 4. Death preserves rage, revival resumes it; a new battle resets it. No runtime/HUD exists in Phase 1.

紅包 passive: each completed basic attack adds 15 percentage points to the next phoenixCry burn chance, stackable and preserved on death/revival; reset only on successful cast. Future hero-specific modifier must not edit global phoenixCry. 天王 passive: completed basic attack applies stealth 1 round to living ally with lowest absolute current HP, including self/players/heroes; ties use canonical Battlefield Slot order. No passive runtime exists.

Equipment must later share the player equipment/inventory Owner with exclusive physical item ownership (no simultaneous copies). Hero UI, equipment, rewards/login/story/activity fragments, skill AI/rage/passives and portraits/VFX remain subsequent phases.

Regression: `tests/hero-core-phase1.test.js`; existing account ownership, legacy hydration and player six-stat tests remain applicable. PR is the live CI/merge/closeout Owner.
