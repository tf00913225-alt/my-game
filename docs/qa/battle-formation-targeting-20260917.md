# Battle formation and target repair — NOT COMPLETE

Base: `f4cd11ff8e9a4ba51edf64ec37c0db711140616a`.
Scope: ally/enemy front-back projection, BOSS mechanism visual plane, and monster `tri` / `row` / `column` targeting only.

## Root cause

1. The fixed Slot owner already stored allies correctly as `ALLY_F*` and `ALLY_B*`, but its CSS projection put ally back at the top and ally front at the bottom. Since enemies are above allies, that reversed the visible formation.
2. `renderMechanisms()` appended BOSS mechanism cards after the absolute enemy rows. Their `position:relative` normal flow therefore began at the enemy zone top, which is the visual back row.
3. `processSingleMonsterAttack()` treated `tri` and `row` as `livingTargets`, so every living party member was hit. The canonical `resolveAllyTargets()` function already expressed the intended row/column geometry but was not used by this attack owner.

## Source repair

- The ally front visual row now projects to the top of the ally zone; its back row projects to the bottom.
- BOSS mechanism DOM marks itself as the fixed mechanism zone and the canonical stylesheet anchors that zone to the bottom of the enemy zone (the enemy front visual plane). It remains a mechanism target, not a monster Slot.
- Monster range attacks select one living primary position, then call `FourSymbolsBattlefieldSlots.resolveAllyTargets()` with the skill shape. `all` keeps the explicit all-living behavior. Single-target stealth behavior is unchanged.

## Supplementary checks only

- Fixed Slot CSS contract.
- Ally formation geometry / range-target regression.
- Production JavaScript syntax, deterministic build, full repository checks, CI and deployment.

These checks do **not** prove the real gameplay result. Keep this batch at 0/3 VERIFIED until a fully loaded dev battle demonstrates the three acceptance items in its Requirement Batch.
