# Battle layout and VFX runtime repair — NOT COMPLETE

Base: `dev@b38411944c8c01b56faa6308f41d969644d82b25`

Branch: `fix/battle-layout-vfx-runtime-20260917`

Severity: P1 — the reported Ice Arrow Rain sequence can block the core battle loop, while layout and range-VFX defects make legal skills materially misleading. No evidence shows that the whole game is unable to start.

Game/cache version: 173.65, unchanged.

## User evidence and scope

- The supplied DEV recording `1000070338.mp4` shows small battle units, battle information below the ally field, range VFX rendered near one-card size and battle progression stopping after Ice Arrow Rain.
- The supplied marked screenshot `1000070335.jpg` is a region-allocation concept, not a pixel specification. This repair implements proportional enemy / operation / ally regions without drawing its guide lines.
- The repair does not alter damage, skill formulas, target selection, formation rules, reinforcement rules, BOSS rules, turn settlement, player data or monster data.

## Root causes

1. V142 created its safety deadline only when it rendered the badge itself. V143 intentionally calls V142 with `render:false`; therefore an exception in V143 DOM lookup, asset setup or geometry could leave `finishPlayerAction()` awaiting a gate that no owner would release.
2. V143 correctly acquired the complete Fixed Slot side bounds for all-target skills, but `applySpriteBox()` fitted a square into the short side and then multiplied battlefield/group geometry by 0.72/0.62. This visually collapsed all-target and three-target sheets toward one-card size. Placement also trusted stale manifest labels instead of the final authoritative `config.targetType`.
3. The battle DOM remained a mostly flat flow with a growing spacer and the information log below allies. Legacy size rules competed with Fixed Slot presentation, so enemy and ally cards did not own stable, equal regions.
4. Wind Flame already authors one range sheet whose individual source frames contain a deliberate three-lane motif. The runtime uses one `main` node; the apparent double playback can occur when an exception leaves an old V143 stage in the DOM before the next cast.

## Owners changed

- `index.html`: structural owner for the three semantic battle regions.
- `css/fixed-slot-battlefield-rendering-v2.css`: canonical proportional tracks, shared slot/card/art/name/bar tokens, equal ally columns, enemy rows and overflow contract.
- `js/37-v142-skill-animation.js`: unconditional action-gate safety deadline.
- `js/39-v143-skill-animation.js`: target-type-derived placement, full/group Fixed Slot footprint sizing, unclipped full-frame fitting that stays outside the operation track, stale-stage cleanup and render-error completion.
- `js/battlefield-render-geometry-adapter.js` and `js/battlefield-slot-owner.js` remain the unchanged coordinate owners. VFX still consumes their live card/slot bounding boxes; no coordinates were hard-coded.

## Layout contract

- Enemy / operation / ally tracks are centralized as 34 / 31 / 35 fractional parts of the available battle viewport.
- Enemy slots are two equal five-column rows. Ally front/back layers use the same shared slot and card dimensions and three equal columns; row depth changes position, not card size.
- The center region exclusively owns turn/status information, action controls, auto/battle-speed controls and the battle log. Enemy and ally cards cannot participate in its grid track.
- Portrait, name and HP/SP geometry are derived from shared CSS custom properties bounded with `clamp()` rather than per-card transforms or per-device coordinates.

## Automated evidence

- `tests/battle-layout-vfx-runtime-20260917.test.js` audits representative fire, water, wind and earth single/tri/all skills against final rule target types, one-node range rendering, stale-stage cleanup and gate release.
- `tests/v150-ice-arrow-rain-vfx.test.js` proves Ice Arrow Rain retains the complete battlefield footprint after casualties and Ice Spin retains one shared three-person footprint.
- `tests/v173.23-wind-vfx.test.js` proves Wind Flame uses one shared node and survivor-independent group geometry.
- `tests/v142-skill-animation.test.js` proves the render-disabled V142 gate still has a bounded safety completion.
- `tests/fixed-slot-battlefield-rendering-v2.test.js` and the 9:16 Chrome fixture lock the three-region separation, equal card dimensions and unclipped presentation.

## Required deployed-dev acceptance

1. Start a real three-character portrait-mobile battle and confirm enemy, operation and ally regions remain separate at narrow and tall phone ratios.
2. Confirm equal ally cards, equal same-type enemy cards, readable names/HP/SP, and stable BOSS/reinforcement placement.
3. Cast representative four-element single/tri/all skills. Verify single card center, fixed three-person group footprint regardless of survivors, and full fixed-side battlefield coverage regardless of survivors.
4. Repeatedly cast Ice Arrow Rain and Wind Flame. Confirm battle progression continues, animations are not clipped, and Wind Flame never leaves two simultaneous V143 raster stages.
5. Verify the deployed manifest commit matches the merged `dev` SHA. Synthetic fixtures alone cannot mark this batch complete.

`main` is explicitly outside this change. Promotion readiness must remain negative until the user separately accepts the deployed-dev result and authorizes a protected `dev` → `main` release.
