# Hero System V1 — Phase 1

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

## Future battle contract — not implemented

Hero NPC kind stays `heroNpc`. Future party has 3 players + at most 3 heroes in formal six-slot Owner; `getPartyCharacterByIndex` is unchanged. Hero is not registered in Battle Statistics or Battle Runtime.

Rage is battle transient 0–12; each new battle starts 0. Completed hero basic attack +1 regardless of MISS. Receiving one enemy basic/skill Action +1 once, including MISS/multihit/full shield absorption. Burn/DoT/reflect/self/environment damage give none. At rage >=4 the next own Action must use hero skill, cost 4. Death preserves rage, revival resumes it; a new battle resets it. No runtime/HUD exists in Phase 1.

紅包 passive: each completed basic attack adds 15 percentage points to the next phoenixCry burn chance, stackable and preserved on death/revival; reset only on successful cast. Future hero-specific modifier must not edit global phoenixCry. 天王 passive: completed basic attack applies stealth 1 round to living ally with lowest absolute current HP, including self/players/heroes; ties use canonical Battlefield Slot order. No passive runtime exists.

Equipment must later share the player equipment/inventory Owner with exclusive physical item ownership (no simultaneous copies). UI, equipment, rewards/login/story/activity fragments, Combat AI/rage/slots/targeting/revive/passives and portraits/VFX remain subsequent phases.

Regression: `tests/hero-core-phase1.test.js`; existing account ownership, legacy hydration and player six-stat tests remain applicable. PR is the live CI/merge/closeout Owner.
