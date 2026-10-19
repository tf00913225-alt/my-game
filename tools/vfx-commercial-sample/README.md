# VFX commercial sample 01

Work ID: VFX-COMMERCIAL-SAMPLE-20261019
Target: three isolated visual samples for user comparison
Branch: feature/vfx-commercial-sample-20261019
Base dev: 07402d4cc56cff6e43bade758ef81c87ce2af072

Serve the repository root and open `tools/vfx-commercial-sample/index.html`.
The page compares the actual existing flameSlash, iceArrowRain and
relic_nine_dragon_fire sprite sheets with three newly authored candidates.
It never loads gameplay, saves, auth, rewards or a second combat renderer.

The two panels share 12 uniform frames, frame-eight contact and original
760/1600/2550ms durations. Reference character positions and sprite sizes
are explicitly controlled review geometry, not a capture or reproduction
of production Fixed Slot geometry. Desktop shows both; mobile toggles the
same scene at the same size. Pause, slow playback and scrubbing are provided.

New sheets were generated with imagegen. Lossless WebP conversion preserves
the complete 1448×1086 canvas, 4×3 frame grid and original RGBA pixels.
See asset-verification.json. Each new frame is 362×362; existing flame/ice
frames are 384×384. These candidates aim for cleaner shapes and less coverage,
and do not claim increased native resolution or temporal interpolation.

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
