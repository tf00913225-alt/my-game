# PLAYER-PORTRAITS-20261023

- Target: dev
- Branch: feature/player-portraits-20261023
- Base dev: bc7efd1c4e66c1cb412fab29d404123f5495ea86
- Status: v3 male01 manually approved; user authorized the remaining seven at the same stylized costume standard without more approval questions. All eight v3 assets integrated and independently verified locally. Latest-head Required CI pending in PR #986. Prior v2 PASS results below are historical and do not certify v3.

## Inventory and bounded replacement

The production creation owner is `js/24-v125-character-creation-native-runtime.js`. Its gender/element table selects eight `assets/characters/{gender}_{element}.jpg` files. `index.html` supplies the initial female/fire image; `js/52-v173.20-startup-loader.js` and `config/first-play-manifest.json` preload the same eight images. `js/22-v124-character-creation-native-runtime.js` is an unpackaged legacy source.

The JPEGs also serve inventory through `getCharacterArtworkPath` in `js/00-main.js`. Battle artwork uses the separate `getCharacterBattleArtworkPath` and `battle_{gender}_{element}.png` set. Neither consumer is changed. No old assets are deleted or overwritten.

New creation mapping uses `assets/characters/player_male_01.webp` through `04` and `player_female_01.webp` through `04`, in the existing fire/water/wind/earth slot order. Appearance art has no elemental symbolism; selection remains coupled to the existing element controls. This task adds no appearance persistence, schema, stat or combat change. Future battle compatibility is visual composition only, not an assertion that this task replaces battle artwork.

## Art and responsibility

Root: image generation and candidate management using the built-in imagegen tool. Integration agent: source copying, lossless conversion, mapping and focused checks. Independent QA agent: adversarial art, alpha, scope and browser review; no generation or integration.

The user rejected the first batch as ordinary/stiff and v2 as ordinary costumes/too realistic. Neither is final product art. The user approved v3 male01: stylized clean ink lines and broad cel-shaded shapes, crane-sect shoulder/waist/forearm/coat design and protagonist charisma. The user then authorized generating all remaining seven to that standard without further questions. This set is selection/story artwork; battle requires different poses and its existing assets are not changed here. No magic/glow or excessive god armor; women use modest opaque attire and flat boots. Exact v3 prompts are preserved with the PNG masters; no API-key fallback.

## Conversion and acceptance

Preserve generated PNG masters in `assets/inbox/player-portraits-20261023/`. Pillow WebP settings: `lossless=True, quality=100, method=6, exact=True`. No crop, resize, trim or alpha modification. Decode and compare every source/output RGBA pixel and canvas dimension. Runtime references use WebP only. Production build regenerates hashed bundles and manifests; release version remains unchanged.

## Historical v2 validation checkpoint (superseded art)

All eight final candidates passed independent individual art review. Four reference-generated candidates were rejected for same-face/costume similarity and regenerated without image references (male02, male03, female02, female04). Rejected batches remain local artifacts, not production assets.

All eight final PNG/WebP pairs are 1024×1536 with exact decoded RGBA equality and alpha 0..254. Runtime WebP total is 9,063,236 bytes; see the per-file hashes and measurements in `PLAYER-PORTRAITS-20261023-assets.json`. This is a deliberate quality-first lossless asset set; the eight-image first-play download is approximately 9.1 MB.

Build and build check pass. Seven focused test files pass (10 outer Node tests): player portrait mapping, critical feature budget, boot architecture, first-play download owner, auth-before-creation, creation feedback and V167 creation behavior. The longer asset paths initially exceeded the unchanged boot JS 70,000-byte budget by 43 bytes (baseline 69,999); factoring their repeated prefix in the existing preload list reduces the final boot to 69,855 bytes while the mapping test verifies all eight expanded paths. No threshold changed.

Local `v173.20-startup-loader.test.js` cannot finish because ImageMagick `identify` is absent on this Windows host; this is not recorded as a pass. The normal required CI remains necessary. Initial one-off Windows manifest write failure was resolved by a successful build and build check.

Independent final art, pixel and browser results are recorded by the separate reviewer in `PLAYER-PORTRAITS-20261023-qa.json`. Actual local Chrome at PC 1440×900, 9:16 360×640 and long-screen 390×844 passed 24 real pointer selections. The final boot recheck confirms all eight HTTP200 + decode results, name entry, next/back and reload. No Runtime exception or non-cancelled portrait failure. Existing favicon404 and cancelled speculative/reload requests are separated from successful image evidence. This uses an isolated empty-account transport fixture, not real Firebase writes or physical phones.

PR: https://github.com/tf00913225-alt/my-game/pull/986 . Latest Head, CI and deployment checkpoint live in the PR body. No current claim of deployed acceptance.

## v3 adopted asset checkpoint

The approved male01 is paired with seven new stylized sect-costume characters: male02 bronze/ox geometric blade hero, male03 jade/bamboo fan scholar, male04 silver/cloud low-haired swordsman, female01 silver/crane sword heroine, female02 bronze/phoenix short-haired blade heroine, female03 jade/orchid fan heroine, female04 silver/moon-orchid braided sword heroine. Artwork themes are costume motifs, not elemental abilities. One v3 male04 candidate was independently rejected as a purple repaint of male01 and regenerated with different hair, cloud motif, round clasp and horizontal sheathed-sword pose.

All eight adopted v3 images passed individual independent art review against the user's approved male01. All8 PNG/WebP pairs are 1024×1536, alpha 0..254, exact decoded RGBA; total lossless WebP 9,484,070 bytes. New hashes live in `PLAYER-PORTRAITS-20261023-assets.json` (artRevision v3). `prompts-v3.json` preserves approved/batch/correction prompts. Build, build check, eight-choice mapping and diff checks pass; unchanged boot is `build/boot-core.bbbaf3175142.js`.

Independent v3 full-set pixel/hash/composite/browser validation PASS is recorded in the QA JSON as `local-v3-art-and-browser-pass`. Actual local Chrome at1440×900/360×640/390×844 repeated all24 true pointer selections and eight HTTP200+decodes, name/next/back/reload. New v3 screenshots were captured after startup fade-out. No Runtime exception/non-cancelled portrait failure. Limits remain physical phone, real Firebase, deployed SHA and persistent production cache, which are not certified by this local fixture. Historical v2 screenshots are not used for v3 acceptance.
