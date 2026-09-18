# Battle formation, mechanism isolation and VFX anchor repair — SUPERSEDED

> Historical investigation only. The separate Boss function-card/mechanism
> target lane described below was retired by the 2026-09-18 convergence. It is
> not an implementation contract. The authoritative rules are now
> [`SYSTEM_CONTRACTS.md`](../../SYSTEM_CONTRACTS.md): one Boss entity, B1/B5
> reinforcements, F1/F5 destructible non-acting objects, Boss Shield, and no
> parallel mechanism target or VFX pipeline.

Base: `a21736f3ea1f92b2e7da9e48870dce705c4c5cc4`.
Scope: ally/enemy front-back projection, BOSS mechanism visual plane, monster range targeting, mechanism-only spread settlement, and enemy primary-target VFX anchoring.

## Root cause

1. The fixed Slot owner already stored allies correctly as `ALLY_F*` and `ALLY_B*`, but its CSS projection put ally back at the top and ally front at the bottom. Since enemies are above allies, that reversed the visible formation.
2. `renderMechanisms()` appended BOSS mechanism cards after the absolute enemy rows. Their `position:relative` normal flow therefore began at the enemy zone top, which is the visual back row.
3. `processSingleMonsterAttack()` treated `tri` and `row` as `livingTargets`, so every living party member was hit. The canonical `resolveAllyTargets()` function already expressed the intended row/column geometry but was not used by this attack owner.
4. `resolveMechanismAction()` damaged the selected mechanism, then rewrote a spread skill's target to a living monster and invoked the normal resolver. One declared action therefore entered two settlement paths and could damage the BOSS reinforcements behind the function card.
5. Enemy badge calls started V142/V143 before target selection and carried no target identity. V143 therefore centered group effects on the row geometry instead of the card actually chosen as the primary target.

## Source repair

- The ally front visual row now projects to the top of the ally zone; its back row projects to the bottom.
- BOSS mechanism DOM marks itself as the fixed mechanism zone and the canonical stylesheet anchors that zone to the bottom of the enemy zone (the enemy front visual plane). It remains a mechanism target, not a monster Slot.
- Monster range attacks select one living primary position, then call `FourSymbolsBattlefieldSlots.resolveAllyTargets()` with the skill shape. `all` keeps the explicit all-living behavior. Single-target stealth behavior is unchanged.
- A mechanism-targeted action now stays entirely inside `resolveMechanismAction()`: it validates and pays the skill cost once, damages the mechanism once, and finishes without re-entering the normal monster resolver.
- Enemy target selection now completes before the badge/VFX gate starts. The primary target plus the resolved target list flow through V142 into V143. Single and group effects use the primary card center; battlefield/all-target effects keep the complete formation center.

## Real DEV runtime follow-up (`1000070330.mp4`)

- The user-provided 39.6-second mobile recording is a real `dev.four-symbols-dev.pages.dev` battle, not a synthetic fixture.
- The water character is visibly below／behind the two front allies. This verifies `FORMATION-PROJECTION` in the real runtime.
- The BOSS mechanism card is on the same visual band as the BOSS and later overlaps the center of the BOSS／reinforcement trio. This disproves the first mechanism-plane implementation as a complete runtime repair.
- Source tracing found the missing half of that repair: `seedBossBattlefieldSnapshot()` and `BOSS_REINFORCEMENT_SLOTS` still reserved `ENEMY_F3/F2/F4`, the same front plane now owned by the independent mechanism lane.
- The follow-up source repair reserves `ENEMY_B3/B2/B4` for the BOSS trio and synchronously reconciles the live DOM after seeding the snapshot. The independent `MECH_*` lane remains in front and outside normal enemy target geometry.
- The recorded enemy casts are single-target skills (`冰霜拳` and `洪水猛獸`); the clip does not contain an enemy `tri`／`row` cast. `MONSTER-RANGE-TARGETING` therefore remains unverified in real gameplay.

## Current real DEV status

- Subsequent real DEV mobile verification confirmed the original three requirements: ally formation projection, independent BOSS mechanism placement without overlap, and legal monster range targeting.
- The newly reported mechanism spread leak and VFX anchoring defects are repaired in source and protected by focused regressions, but they have not yet been observed on the newly deployed dev runtime.
- Current requirement status is **3/5 VERIFIED — NOT COMPLETE**.

## Supplementary checks only

- Fixed Slot CSS contract.
- Ally formation geometry / range-target regression.
- Production JavaScript syntax, deterministic build, full repository checks, CI and deployment.

These checks do **not** prove the remaining real gameplay results. Keep this batch at 3/5 VERIFIED until a mechanism-targeted three-target cast leaves the BOSS/reinforcements untouched and enemy single/three-target/all-target casts confirm their required VFX centers on deployed dev.
