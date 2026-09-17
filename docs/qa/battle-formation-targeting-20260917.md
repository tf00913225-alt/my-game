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

## Real DEV runtime follow-up (`1000070330.mp4`)

- The user-provided 39.6-second mobile recording is a real `dev.four-symbols-dev.pages.dev` battle, not a synthetic fixture.
- The water character is visibly below／behind the two front allies. This verifies `FORMATION-PROJECTION` in the real runtime.
- The BOSS mechanism card is on the same visual band as the BOSS and later overlaps the center of the BOSS／reinforcement trio. This disproves the first mechanism-plane implementation as a complete runtime repair.
- Source tracing found the missing half of that repair: `seedBossBattlefieldSnapshot()` and `BOSS_REINFORCEMENT_SLOTS` still reserved `ENEMY_F3/F2/F4`, the same front plane now owned by the independent mechanism lane.
- The follow-up source repair reserves `ENEMY_B3/B2/B4` for the BOSS trio and synchronously reconciles the live DOM after seeding the snapshot. The independent `MECH_*` lane remains in front and outside normal enemy target geometry.
- The recorded enemy casts are single-target skills (`冰霜拳` and `洪水猛獸`); the clip does not contain an enemy `tri`／`row` cast. `MONSTER-RANGE-TARGETING` therefore remains unverified in real gameplay.

## Supplementary checks only

- Fixed Slot CSS contract.
- Ally formation geometry / range-target regression.
- Production JavaScript syntax, deterministic build, full repository checks, CI and deployment.

These checks do **not** prove the remaining real gameplay results. Keep this batch at 1/3 VERIFIED until a post-fix BOSS mechanism encounter and a real enemy `tri`／`row` cast satisfy the remaining acceptance items.
