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

## Verification boundary

The requirement batch remains NOT COMPLETE until the exact candidate is exercised in a real portrait browser. Node/static contracts and isolated geometry fixtures are supplementary and cannot alone promote these requirements to VERIFIED.
