# Battle system integration repair — 2026-09-18

## Scope and evidence

- Base: `dev@30c8253713fa0fee76ceea597521d7e9a314a9a0`.
- Working branch: `fix/battle-vfx-layout-formation-freeze-20260918`.
- `main` is excluded.
- User recording `1000070339.mp4` is 35.883 seconds at 1080×2316. Its last visible action is Water's Ice Arrow Rain; the battle presentation then remains unchanged through the end of the recording.
- The requested `SYSTEM_CONTRACTS.md` file does not exist in the base repository or its reachable history. No replacement contract was invented.

## Root causes

1. VFX target selection was duplicated. V143 could read queued actions and survivors after combat had already selected a target. This made primary centers depend on queue/hit order and made support skills such as enemy-target Purify Mind ambiguous.
2. Range geometry mixed semantic footprint and current occupancy. Group/projectile boxes could be scaled below their fixed three-slot geometry, while full-side bounds were clipped against the browser viewport instead of the scaled game stage.
3. The battle log was a child of the middle control region. The three-track projection therefore allowed the log, action controls and cards to compete for the same vertical space. HUD labels also used overlap/negative offsets rather than fixed rows below artwork.
4. The home Formation button called an app-shell entry whose renderer lived in lazy `gameplay-core`, but its markup did not declare that feature. The first click therefore opened the modal before its real owner was loaded.
5. Initiative progression ultimately depended on VFX callbacks. Render/DOM exceptions or an unreturned VFX gate could leave the processed initiative index permanently active. V142/V143 had local deadlines, but the combat owner had no final bounded recovery.

## Owner convergence

- `js/00-main.js`: combat target-contract creation and final action watchdog.
- `js/37-v142-skill-animation.js`: timing gate and immutable contract transport.
- `js/39-v143-skill-animation.js`: raster-only drawing and Fixed Slot geometry consumption; no combat inference.
- `js/battlefield-slot-owner.js`: unchanged canonical slot/shape table.
- `js/battlefield-render-geometry-adapter.js` plus `css/fixed-slot-battlefield-rendering-v2.css`: the one battlefield projection.
- `js/25-v131-fix-batch.js`: unchanged Formation editor owner; `js/16-stage-v54-main-city-runtime.js` now declares its lazy feature dependency.

## Verification results

- Runtime commit `a17948aff1d5d89ab58d8c84077d255d12f7d8ab` passed PR CI Run `35259234890` (`#1832`). The exact-candidate browser evidence reports `status: PASS` and the same expected SHA.
- The 412×915 real-game run created an account/character, opened the existing Formation editor, exposed all six ally Slots, moved character 0 from `ALLY_F2` to `ALLY_F1`, and restored it.
- The same run launched an eight-enemy dungeon battle. It verified enemy → middle controls → ally → bottom info ordering, action containment, visible card HUDs, ten enemy Slots, six ally Slots, and the 66×66 logical Element Box control.
- Ice Arrow Rain rendered one complete ten-Slot enemy-side sheet and released exactly once with no remaining stage. Wind Flame rendered a fixed three-Slot sheet around one explicit surviving target and also released exactly once.
- A formally declared Fire Explosive Flurry entered the real resolution owner. Initiative advanced, the battle token changed at completion, the dungeon callback returned, the battle page deactivated, and V143 stage count returned to zero.
- The isolated 9:16 browser suite passed at 412×915, 393×873 and 360×800, including six occupied ally Slots and HUD/card non-overlap.
- Node regressions audit every active/passive Fire, Water, Wind and Earth skill manifest entry, single/tri/all/projectile geometry, support/MISS/error gate release, Formation ownership and the 7-second final watchdog. These supplement rather than replace the real-game run above.
