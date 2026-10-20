# VFX commercial sample 01

Work ID: VFX-COMMERCIAL-SAMPLE-20261019
Target: 44 active skills, four passive entries and 21 statuses; original three-sample preview retained below
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

## Nine Dragon Fire revision 3 (historical preview)

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

## Full four-element/status follow-up (current inventory)

The work covers 44 active skills, four intentionally passive entries and 21
formal statuses. `coverage-matrix.json` keeps historical technical runs and
review findings separate from current acceptance. Its current inventory head
is ade43a48; older evidence remains bound to its recorded head.

All 21 statuses now have scoped static PASS on both phone sides at 590b1390.
`status-commercial-gate-20261020.json` preserves the initial rage failure and
subsequent accepted contrast correction (.60-.80), plus the accepted taller
calm aura. Eight pulse statuses also pass sampled-cycle visibility, placement
and brightness-change review using original full FFmpeg-decoded phone frames
under `artifacts/vfx-status-contrast-v2/decoded/frames.json`. The earlier browser
phase strips were invalid and were rejected; they are retained as history.
Sparse samples do not prove continuous smoothness or 60fps. Continuous motion
and sustained performance remain pending; accepted static art is not reopened
for discretionary refinement.

Status lifecycle snapshots exercise layer rotation, selective cleanse, expiry,
death, revival and final zero remaining nodes. These are technical observations,
not animation-smoothness or round-end gameplay-duration acceptance.

Active windSpell now uses `assets/vfx/wind/wind-spell-wide-v2.webp`, a native
wide 4x3 source with cellAspect 2.25. At ade43a48 its source and phone static
three-target range/readability geometry are accepted; dynamic continuity and
performance remain pending. See `wind-wide-source-review.json` and
`wind-wide-overcorrection-review.json`. Stop further source/static refinement
unless a new player-visible defect appears.

Active earthShield uses the single-shield candidate with `single` placement
for its formal `self` target (scale 1.7, maxSize 225). Older group-placement
findings in the inventory refer to historical snapshots.

The complete-safe-side minimum-translation `allowArtRecenter` proposal was
rejected and reverted at b145; it is not current runtime behavior. Historical
screenshots and technical results from that proposal do not endorse it.
Ordinary hit feedback retains the bounded paint fence; raster presentation
and gameplay settlement remain separate owners.

`usb-full-matrix-20261019.json` and later matrix artifacts preserve technical
presentation evidence, including exceptions and node cleanup at their exact
heads. They do not establish art acceptance for all 44 skills, full skill
eligibility/damage behavior, latest-head CI or commercial release readiness.
`assets/full` contains candidate and rejected artwork with provenance; presence
or lossless conversion alone never means runtime adoption or visual PASS.
`usb-comparison.html` retains baseline/checkpoint phone comparisons.

The b1ede88d USB batch records 11 native-wide cast candidates and the correctly
single-recipient barrier replay in `artifacts/vfx-wide-batch-usb`. All hit
observations retain an active battle and six formal HUDs; all casts clean up.
This is technical evidence only. The full recording is decoded at 12fps in
`sequence-frames`; fixed-offset `contact-frames` often sample the tail and must
not be used alone to infer missing art or approve peak placement.

The mixed-status soak at ade43a48 retains 12 body visuals and 30 icons across
six units, then clears them all. Its periodic long tasks require profiling;
the initial 601.2ms interval may include fixture startup and is not a proven
steady-state maximum. This is not a performance pass. Status artwork is
unchanged from ade43a48 to b1ede88d.

The 20ec calm recipient prototype passed independent USB geometry review for
three allies, six enemies (presentation only) and partial recipients. Controlled
reuse is limited to the six confirmed placement failures; each replacement
still needs its own phone gate. iceSpin and stormFlurry contact/identity/release
passed cross-review and are closed to discretionary refinement. Flood Beast's
source boundary is corrected; its remaining backwards-flight finding is being
fixed through the existing phase headings, preserving endpoints and timing.

Nine Dragon Fire v4 is a source-approved single-sheet candidate for the relic
originally requested by the user. It replaces the catalog asset in place with
a content-hash URL query; no extra relic entry or custom impact-image renderer
is added. The exact original is preserved in `assets/nine-dragon-fire-original.webp`
and the historical sample points there. Physical identity, peak clearance and
release still require USB acceptance. Other relics remain excluded.

The 20ec batched-status warm 30-second phone soak retains the same 12 bodies and
30 icons: p95 33.4ms, p99 50.2ms, six long tasks totaling391ms versus the earlier
35 totaling5955ms. The remaining139ms task is unassigned; this is an improvement,
not a blanket performance pass. Extra tracing and final phone gates are pending
USB reauthorization after the device returned `unauthorized`.
