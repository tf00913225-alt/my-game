# Level Suppression V2 — 2026-10-05

Work ID: `LEVEL-SUPPRESSION-V2-20261005`  
Requirement: `REQ-LEVEL-SUPPRESSION-V2-20261005`  
Target: dev; main excluded. Game/Cache: 173.73.

## Formal contract

`Final Damage Level Multiplier = 1.01 ^ (Attacker Level - Target Level)`.

Single Owner: `js/00-main.js::getDamageLevelMultiplier(casterLevel,targetLevel)`.
Call chain: `calculateDamage() → getDamageLevelMultiplier() → Math.pow(1.01,levelDiff)`.
Both player→monster and monster→player, physical/magic, normal/skill damage reuse
this same existing levelFactor position; no extra multiplier is applied.
Every adjacent level changes immediately, with no tiers, tables or artificial
multiplier cap/floor. Valid levels are integers Lv1–100, so the multiplier is
always positive and finite. `M(A,B) × M(B,A) ≈ 1`.

Input normalization preserves numeric-string compatibility. Undefined/NaN,
nonfinite, fractional or out-of-contract levels fall back to Lv1 independently;
this validates inputs, never clamps the multiplier. Valid ±99 differences are
fully preserved.

| Difference | Multiplier |
|---:|---:|
| 0 | 1 |
| +1 | 1.01 |
| -1 | 0.990099009901 |
| +10 | 1.104622125411 |
| -10 | 0.905286954693 |
| +30 | 1.347848915333 |
| -30 | 0.741922917787 |
| +99 | 2.678033494477 |
| -99 | 0.373408324452 |

Values above are display examples only; Runtime never rounds the multiplier.
Final Damage retains the existing rounding/minimum-damage rule. Defense K
still depends on target level through its separate existing owner; integration
expectations preserve K, and use a fixed target to isolate this multiplier.

## Replacement / retirement

Retired: `1 + diff × 1%`, clamp 0.85–1.15, and the three
`LEVEL_DIFF_FACTOR_*_PHYSICAL` constants. No compatibility layer, new wrapper or
late override is needed. Element disadvantage 0.85, Tower fire modifier 1.15
and unrelated numerical contracts remain valid.

The server normal-attack build extractor removes only retired constant names.
`npm run build` mechanically copies the exact canonical function into
`functions/src/generated/plain-player-normal-attack-rules.js` and refreshes its
policy digest; it is a generated projection, not a second formula owner. Existing
private proof/replay/policy pinning is unchanged. Existing policies remain
immutable; new deployment uses new generated declarations/digests.

## Isolation / scope

No Hit/Evasion/Status/Crit coupling. `calculateStatusEffectChance()` retains
`void casterLevel; void targetLevel;`. No change to Critical Chance/Damage,
Status/Hard Control, Speed/Agility, healing, shield, SP, costs, skill chance,
targeting or AI. This does not replace or modify Level Base/natural growth or
Ability Point Budget `(level - 1) × 5`. MonsterBalance Phase1–2F and all mode,
rank and World Stage profiles are unchanged. Tower difficulty is a separate
future calibration. No UI or release version change.

## Permanent regression / build evidence

- `tests/level-suppression-v2.test.mjs`: exact 0/±1/±5/±10/±30/±99 with floating
  tolerance, all adjacent levels against Lv1/70/100, all 10,000 valid directed
  pairs positive/finite/reciprocal, invalid inputs and scoped retirement gate.
- `tests/v170-final-spec-integration.test.js`: old linear expectations migrated;
  added a fresh VM loading ALL current generated production feature bundles in
  dependency order. Fixed attack/defense/element/bonus/crit/pressure, Lv70/71/69/
  100/40 calculateDamage in both directions and actual calculateSkillDamage
  match the canonical curve. Actual normalAttack/processSingleMonsterAttack
  entrypoints also execute each same-level/±1/±30 vector. Levels1/100 retain identical hit, evasion, status,
  hard control and the complete 100-roll critical distribution.
- Existing six-stat, damage/normal/enemy/skill, Hit/Evasion V2, status/hard-control,
  critical, MonsterBalance aggregate and cloud browser-rule parity remain gates.
- Existing build Owner: `npm run build` followed by `npm run build:check`;
  superseded hashed files are retired automatically. No hand-edited bundle/hash.
- Existing dev Hit/Evasion CI step explicitly executes the new suite; no second
  workflow. The main-only all-suite step is not used as dev verification. Requirement stays
  IMPLEMENTED until all functional/build and exact latest-head CI gates pass.
  Work PR owns live CI, integration, deployment and branch-cleanup evidence.
