# Dungeon end c295 independent input/geometry review

Reviewed four daily-true-end.png actual images via view_image and necessary steps/report/cleanup fields under artifacts/ui-skill-standard/batch2-dungeon-end-observed-c295393d. All bind Head c295393d76bceb1f5648647f02c115574dec7880. No browser or tracked writes.

All four step sequences: native-entry (#dungeonNav), native-category, two native-scroll observations, true-end, native-return-home, native-reopen. True end scroll988 + client545 = total1533; owner auto. Four card ids exp/material/gold/equipment are retained, including after reopen. Runner confirms original entry/category/return/reopen via tap helper; phone scroll dispatches touchStart/move/end, desktop scroll uses mouseWheel. Tap helper uses touch input even on desktop; do not describe desktop entry/return as mouse clicks. True return asserts home active and reopens original dungeon nav.

|Viewport|Last two buttons each W/H px|Buttons bottom|Card bottom|Owner bottom / nav top|
|---|---|---|---|---|
|360x640|159.86/44.57|516.27|549.00|567.99/568.00|
|393x873|174.51/48.66|650.76|686.49|707.22/707.23|
|412x915|182.95/51.01|682.12|719.58|741.31/741.32|
|1280x800|199.82/55.71|645.33|686.25|709.99/710.00|

Both equipment-card buttons are enabled, >=44 both dimensions, EFP hit=true and fit owner above nav in all four. Actual images agree: last equipment image/content/status/buttons fully visible, no bottom control obscured by navigation. Top gold illustration is naturally above the scrolled viewport, not a cropped final card.

Reports dirty=false with initial/final status empty, manifestUnchanged=true; cleanup profileRemoved=true and runtimeRestoreExact=false. Runner asserts Head/status/manifest unchanged during QA. This is source cleanliness at recorded checks, not exhaustive runtime/save restoration. CSS42 original owner min-height38→52 is the supplied/source-proof scoped product change; no interaction owner replacement is implied.

Important evidence limit: helper's older template does not persist every native input's target/coordinates/event record. steps records sequence/state and source shows EFP/44 assertions plus dispatch; this review does not claim an independently replayed durable trace. Last-card buttons were measured/hit-tested, not clicked to run reward preview or challenge. No battle, transaction, save-exact or real-device qualification. Reopen proves four ids remain, not all four cards simultaneously visible or every card action exercised.

No new blocker in this narrow true-end/last-target/context-return evidence. Necessary latest-Head CI and broader product gates remain separate.
