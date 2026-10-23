# PLAYER-PORTRAITS-20261023

- Target: dev
- Branch: feature/player-portraits-20261023
- Base dev: bc7efd1c4e66c1cb412fab29d404123f5495ea86
- Status: eight replacement portraits generated and integrated; independent final browser report and latest-head CI pending.

## Inventory and bounded replacement

The production creation owner is `js/24-v125-character-creation-native-runtime.js`. Its gender/element table selects eight `assets/characters/{gender}_{element}.jpg` files. `index.html` supplies the initial female/fire image; `js/52-v173.20-startup-loader.js` and `config/first-play-manifest.json` preload the same eight images. `js/22-v124-character-creation-native-runtime.js` is an unpackaged legacy source.

The JPEGs also serve inventory through `getCharacterArtworkPath` in `js/00-main.js`. Battle artwork uses the separate `getCharacterBattleArtworkPath` and `battle_{gender}_{element}.png` set. Neither consumer is changed. No old assets are deleted or overwritten.

New creation mapping uses `assets/characters/player_male_01.webp` through `04` and `player_female_01.webp` through `04`, in the existing fire/water/wind/earth slot order. Appearance art has no elemental symbolism; selection remains coupled to the existing element controls. This task adds no appearance persistence, schema, stat or combat change. Future battle compatibility is visual composition only, not an assertion that this task replaces battle artwork.

## Art and responsibility

Root: image generation and candidate management using the built-in imagegen tool. Integration agent: source copying, lossless conversion, mapping and focused checks. Independent QA agent: adversarial art, alpha, scope and browser review; no generation or integration.

The user rejected the first batch as ordinary-looking and stiff. It is not accepted product art. The replacement batch prioritizes handsome men, beautiful women, protagonist charisma, well-tailored clothes and expressive asymmetrical weight-bearing poses while retaining frontal full-body composition. No magic/glow or excessive god-armor design. All women use modest opaque attire and flat boots. Exact replacement prompt set is retained in `assets/inbox/player-portraits-20261023/prompts-v2.json`. Male01 and female01 serve as style references for the other six, not face or costume templates. No API-key fallback is used.

## Conversion and acceptance

Preserve generated PNG masters in `assets/inbox/player-portraits-20261023/`. Pillow WebP settings: `lossless=True, quality=100, method=6, exact=True`. No crop, resize, trim or alpha modification. Decode and compare every source/output RGBA pixel and canvas dimension. Runtime references use WebP only. Production build regenerates hashed bundles and manifests; release version remains unchanged.

## Validation checkpoint

All eight final candidates passed independent individual art review. Four reference-generated candidates were rejected for same-face/costume similarity and regenerated without image references (male02, male03, female02, female04). Rejected batches remain local artifacts, not production assets.

All eight final PNG/WebP pairs are 1024×1536 with exact decoded RGBA equality and alpha 0..254. Runtime WebP total is 9,063,236 bytes; see the per-file hashes and measurements in `PLAYER-PORTRAITS-20261023-assets.json`. This is a deliberate quality-first lossless asset set; the eight-image first-play download is approximately 9.1 MB.

Build and build check pass. Seven focused test files pass (10 outer Node tests): player portrait mapping, critical feature budget, boot architecture, first-play download owner, auth-before-creation, creation feedback and V167 creation behavior. The longer asset paths initially exceeded the unchanged boot JS 70,000-byte budget by 43 bytes (baseline 69,999); factoring their repeated prefix in the existing preload list reduces the final boot to 69,855 bytes while the mapping test verifies all eight expanded paths. No threshold changed.

Local `v173.20-startup-loader.test.js` cannot finish because ImageMagick `identify` is absent on this Windows host; this is not recorded as a pass. The normal required CI remains necessary. Initial one-off Windows manifest write failure was resolved by a successful build and build check.

Independent final results, exact commit/CI/deployment and remaining limitations will be recorded after verification. No current claim of deployed acceptance.
