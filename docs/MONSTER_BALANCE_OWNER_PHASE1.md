# Monster Balance Owner Phase 1

Work ID: MONSTER-BALANCE-OWNER-P1-20261003. Target: dev. Classification: Convergence + Replacement Preparation. Base dev: 9284bff51226119c9c2ffd21e01daefa3c49cec5; main observed: d71bc663bd8f0b501f68467b7abee6ca018b4734. Phase 1 is SHADOW ONLY; production gameplay and player stats retain their existing implementation. This is not completed Runtime owner convergence.


## Final closeout — 2026-10-05

Status: COMPLETE.
Phase1 COMPLETE: PR #777 MERGED; final Head 2736e9b769c3eb25ed544251d55485d1f83e6c9a; merge / verified phase deployment SHA de5e2049eae20294a173f3e7f5b57fa54c5afe9b. CI Run37116666287 / Repository Job111186429103 / deployment Job111186429099 SUCCESS. Exact SHA and live QA retained in PR final closeout. Construction branch DELETED / absent.
[PR #777 final evidence](https://github.com/tf00913225-alt/my-game/pull/777).
Phase 1 completed its approved shadow scope; its Runtime migration deferral was resolved by Phase 2A–2F.
Current seven-mode migration status: [COMPLETE](MONSTER_BALANCE_OWNER_FINAL.md).

## Historical implementation and verification record

Below are source-time specifications, checkpoints and stop instructions. Later
phases superseded unmigrated-mode boundaries; execution gates described below
as pending were resolved by the final closeout above. Historical evidence remains
unchanged and is not the current migration status.

## Responsibility / Multi-Owner / Canonical Decision

- Future shared Lv1/growth/six-stat conversion: `js/combat/level-base-contract.mjs::CombatLevelBase.preview(level)`.
- Allocation and AI intent registry: `js/combat/monster-archetypes.mjs::ARCHETYPES/allocatePoints`.
- Spec validation, pre-battle projection, profile ordering and breakdown: `js/combat/monster-balance-owner.mjs::MonsterBalance.preview(spec)`.
- Existing Runtime responsibility remains in `00-main`, V131, V132, V141, V144, V158, V174 Abyss, Tower/Boss and Adventure. Machine-readable dispositions: `docs/monster-balance-owner-retirement-map.json` (25 entries). No unknown disposition.
- Additional discovery: V144 is another `makeZoneMonster` wrapper for skill legality/loadout, distinct from stat generation. Three grandfathered wrappers are explicitly listed; no new one is allowed. Player level-base source also differs from the future common Contract.
- Phase1 architecture gate validates pure isolated shadow ownership. Formal Runtime multi-owner Gate is DEFERRED, not misreported PASS: old Runtime writers are required to preserve player experience. Phase2 must remove each migrated mode's old write authority, while unmigrated mode dependencies remain explicitly scoped.
- No timers/listeners/persistence/UI lifecycle in shadow modules. Every call creates independent output, no cache or global setter; imports are explicit ES modules. They are absent from all formal build/feature/boot chains. No late patch or loader-order ownership.

## Contract

Lv1 physical/magic/defense=30/30/30. Growth from Lv1 is +4/+2.75/+4; budget=(level-1)*5. Point conversions=4/2.75/50/15/4/1 for Attack/Intelligence/Vitality/Energy/Defense/Agility. No Accuracy/Evasion/Anti-Crit/Status Accuracy/Status Resistance derived from six stats.

Six registries follow the approved proportions exactly. Largest Remainder uses integer numerator/remainder and fixed `STAT_ORDER` tie order (Attack, Intelligence, Vitality, Energy, Defense, Agility); every point is conserved. Same identity tuple produces identical six stats; no random/time/order input. Explicit archetype is required. Phase2 content specs must assign each named monster one stable catalog archetype, never reselect per spawn. Phase1 does not classify or change existing monsters.

HP100/SP50 is explicitly a compatibility resource base for diagnostics, not a ratification of per-level bonus resources. Monster +30HP/+10SP per level remains PENDING PRODUCT DECISION. Player Runtime is also not switched. Rank/mode use neutral1 only to form a diagnostic baseline and are labelled PENDING_PRODUCT_CALIBRATION/SHADOW_BASELINE_ONLY; old3.20/4.50/1.80/2.80 are never copied into a new approved rank contract. Ability budget does not change by rank. No executable skill or AI added; intent requires existing carried/legal/affordable skills. Tank and speedControl require functional capability metadata before future adoption.

Explicit modes: wild/daily/tower/abyss/adventure/personalBoss/worldBoss. Shadow uses regular/elite/smallBoss; legacy boss conversion exists only in diagnostics. No interpretation of v132Dungeon as daily. Global calibration is solely `{hp:1,sp:1,damage:1,defense:1}` and has no mutable override/setter.

Tower `previewTower(spec,floor)` resolves level=floor and stable floor context. `previewTowerRoster` returns10 regular,2elite+8regular on5-multiple,1smallBoss+2elite+7regular on10-multiple. Existing earth HP/defense1.15 and wind speed1.15 project pre-battle; fire/water/wind effects are metadata for existing gameplay owners, not extra final attack multipliers. Formal towerMonsterLevel, roster and profiles remain unchanged.

Wild/daily <=2-round kill/clear-wave is validation direction only; no TTK simulation or new HP multiplier is claimed. Tower/Abyss TTK and final rank/mode calibration remain pending.

## API

```js
import {MonsterBalance} from '../js/combat/monster-balance-owner.mjs';
const result=MonsterBalance.preview({
  name:'Example',level:50,element:'fire',archetype:'physical',
  rank:'regular',mode:'wild',context:'wild/map-1'
});
// base, allocation, derived, profiles, final, aiIntent, breakdown,
// pendingProductDecisions. Never mutates input or a formal monster.
```

Integers1..100, named element/archetype/rank/mode and stable nonempty string context are mandatory. Invalid or legacy ambiguous input throws. Context IDs must encode actual map/floor/encounter; no timestamp/spawn order. Allocation and derived magic values retain fractions; only existing Tower earth rounding is applied in that profile, wind speed stays fractional. Breakdown records inputs, coefficients, intermediate outputs and neutral profile status.

## Shadow matrix / evidence

Run `node scripts/monster-balance-shadow-matrix.mjs /tmp/monster-shadow-matrix.json` from repository root. It executes current production app/gameplay sources and actual Tower/Abyss builders inside an isolated existing DOM fixture, never a live account/site. Diagnostic private-function access is confined to this VM; tracked production sources are unchanged. This script is not a formal dependency.

`docs/monster-balance-shadow-matrix.csv`:540 rows,6levels×6archetypes×3ranks×5modes; old/new points,HP,SP,physical/magic/defense/speed and difference%. Legacy has no archetypes; repeated old values are intentional. Wild uses explicit diagnostic zone band and real V131/V158 normalization; daily uses3-member exp V132/V158 pipeline. Tower old level is29+floor×.71, clamped30..100; diagnostics include otherwise unplayable smallBoss floor/rank combinations, labelled as such. Adventure compares its direct builder contract without starting encounter/persistence.

Abyss officially supports only Lv20/40. Matrix uses actual closest difficulty compatibility roster, explicitly records actual level/element/sameLevel=false where applicable. These differences are not same-level balance answers. `docs/monster-balance-shadow-evidence.json` additionally preserves all50actual Abyss difficulty/region/stage rosters and source hashes; null difference means a zero denominator. Matrix rows are builder comparisons, not player TTK proofs. No rebalancing of Abyss.

## Phase 2 retirement order and gate

Wild → Daily (including equipment subtype) → Tower → Abyss → Adventure → Personal/World Boss. Each adoption requires approved pending product values, explicit mode specs, legal existing AI skill capabilities, same-name archetype mapping, necessary runtime/build regression and actual mode validation. Then physically remove old writes for that mode before next adoption. Shared V132 and core builders remain only for explicitly unmigrated callers and retire at their final dependency migration. All target details/gates are in the JSON map.

Wild retires V131/V141 strength mutation and V158 beginner postscale, migrates rank projection and base generation. Daily retires V132 strength/rank (for daily callers), equipment rank scaling and V158 party/level/core-point rescaling. Tower replaces level rule and prebattle stat mutations, preserves10-unit composition/skill features. Abyss preserves current compatibility snapshots while migrating V174 durability and deleting legacy V141 build path after compatibility API/save callers transfer. Adventure transfers direct builder responsibility. Boss transfers HP/attack factors; unused boss defenseMultiplier is TO RETIRE metadata, never silently applied. Existing damage settlement/skill legality remains KEEP and consumes explicit profiles rather than owning a second calibration.

STOP after Phase1. Formal Runtime switching is not authorized in this work.
