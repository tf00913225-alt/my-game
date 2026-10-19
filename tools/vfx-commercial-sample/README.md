# VFX commercial sample 01

Work ID: VFX-COMMERCIAL-SAMPLE-20261019
Target: three isolated visual samples for user comparison
Branch: feature/vfx-commercial-sample-20261019
Base dev: 07402d4cc56cff6e43bade758ef81c87ce2af072

Serve the repository root and open `tools/vfx-commercial-sample/index.html`.
The page compares the actual existing flameSlash, iceArrowRain and
relic_nine_dragon_fire sprite sheets with three visual candidates.
It never loads gameplay, saves, auth, rewards or a second combat renderer.

The two panels share 12 uniform timeline frames, frame-eight contact and
original 760/1600/2550ms durations. Reference character positions and sprite sizes
are explicitly controlled review geometry, not a capture or reproduction
of production Fixed Slot geometry. Desktop shows both; mobile toggles the
same scene at the same size. Pause, slow playback and scrubbing are provided.

New artwork was generated with built-in imagegen. Lossless WebP conversion
preserves each complete canvas, frame layout and original RGBA pixels.
See asset-verification.json. New sheet cells are 362×362; existing flame/ice
frames are 384×384. The V3 relic impact is a separate 1254×1254 image.
Only that keyframe has increased native resolution. The animation has not
gained time frames or temporal interpolation.

Pending: user visual selection, final asset continuity/anchor review,
integration through V143's existing manifest/geometry owner, latest-head
required CI and real battle symptom verification. No runtime replacement
or claim of commercial release readiness is part of this preview.

## Nine Dragon Fire revision 2

User feedback: the first candidate removed too much and the relic was no
longer recognizable. The active relic comparison now restores the original
sheet and its complete dragon silhouettes, with only a 520→500 reference
size change (approximately −4%). Duration remains 2550ms. This revision
restores identity; it does not claim an artwork quality upgrade. The first
generated relic candidate is retained as review history but is not selected.
Flame Slash and Ice Arrow Rain are unchanged.

## Nine Dragon Fire revision 3 (current)

The accepted identity baseline remains the original intertwined dragon
composition, with a 500 logical-pixel review box (original: 520), 2550ms
duration and frame-eight contact. The current candidate uses a new detailed
4×3 sheet for gathering/dissipation and a separate 1254px square contact
keyframe with the full uncut ring. A rejected sheet padding edit did not
meet the intended margin; it was not imported. The independent contact image
avoids that sheet's clipped contact ring. The candidate has a gradual
brightness buildup and a continuous post-contact alpha fade, with zero
opacity during the loop's 700ms gap. The baseline panel remains unchanged.

This remains an asset-review renderer, not a V143 runtime change. The strong
contact frame may require further continuity tuning after user review.
Generation prompts and selected/rejected sources are recorded in
relic-v3-generation.json. Flame Slash and Ice Arrow Rain remain unchanged.

## Physical USB battle validation

See usb-runtime-verification.json and usb-runtime-candidate.patch. The patch
is the exact local candidate adaptation used for this test, not an imported
runtime change. A detached snapshot was built through build-production.mjs
and passed build:check; resource integrity checks remained enabled. The
existing read-only QA account ran the real 3-vs-3 battle on Note9 Android 10.
Flame Slash and Ice Arrow Rain exercised actual isolated damage; the relic
used its existing DEV presentation preview, without testing settlement.

Six baseline/candidate casts completed with no asset failure, runtime
exception or leftover VFX node. Visual acceptance is NOT PASSED: actual
all-target relic geometry still clips the top and obscures enemy HUD, and
the first sampled logical hit precedes frame-eight paint in both versions.
RAF medians near 16.7ms coexist with long action-start frames. This short
test does not certify sustained performance, endurance or gameplay safety.
The raw traces and six phone screenshots are in artifacts/vfx-usb-runtime.

## Full four-element/status follow-up

The work now covers 44 active skills, four intentionally passive entries and
21 formal statuses. `coverage-matrix.json` records their formal owners.
`usb-full-matrix-20261019.json` records the first full Note9 presentation run
at d6f181c4: all 44 casts cleaned up, 21 status entries were exercised, and
there were no runtime exceptions. It includes screenshot hashes and explicit
limits: these were presentation casts, not full skill eligibility/damage tests.
Screenshot capture affects RAF intervals, so they do not certify performance.

Independent screenshot review found that edge-primary group art had shrunk
around one target, single-target artwork could still reach the viewport edge,
and a timer could present feedback while CSS still showed the preceding frame.
The subsequent checkpoint centers group art on canonical shape bounds, fits
single art safely without changing hit anchors, and uses a one-shot paint-frame
handoff for ordinary hit feedback. A new open-center rage status aura replaces
the opaque fire face; its HUD icon and gameplay state remain unchanged.
These subsequent changes require a fresh USB run.

Status lifecycle checks on the isolated phone fixture exercised two-second
rotation with fixed hard control, cleansed input, zero-duration input, death,
revival, enemy status rendering and 24px detached HUD icons. All visual nodes
were removed after cleanup. This is not a retest of the round-end duration owner.

`assets/full` contains artwork candidates and generation evidence. Candidates
are not runtime imports merely because they decode or have lossless conversion.
The earth-shield and fire-soul sheets still require independent art review.
Commercial visual acceptance remains pending; review findings are retained in
the adjacent independent/USB visual review JSON files.

The next candidate imports nine reviewed images (eight cast sheets and the
rage body aura); `runtime-import-review.json` records byte identity and source
provenance. These are phone-test candidates, not an automatic art pass. Group
art now uses the complete safe side with minimum necessary translation, and
ordinary hit feedback uses a bounded two-frame paint fence. Non-travel raster
art fades after frame eight instead of staying opaque until an abrupt stop.
Stun is placed near the head at reduced scale; two dark HUD icons receive a
thin contrast outline. `usb-comparison.html` shows full phone screenshots with
the baseline/checkpoint source labeled per case.
