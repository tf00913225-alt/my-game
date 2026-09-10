# Boot Performance Baseline

Baseline was captured before source modification from GitHub `dev` commit `70df66e8cb371ff6193a7f70609cf9aad7bd15ac`. The checkout environment did not contain a Chrome/Chromium executable, so the before measurements below distinguish exact repository/network architecture counts from browser timings that could not honestly be observed locally.

## Before: dev `70df66e8`

| Metric | Baseline | Method / limitation |
| --- | ---: | --- |
| Direct local JS in HTML | 24 requests / 938,733 B | Parsed exact `index.html`; source bytes |
| Full local JS load graph | 128 requests / 2,786,891 B | Parsed direct and dynamic production loader graph |
| Direct local CSS | 30 requests / 353,017 B | Excludes one external Google Fonts stylesheet |
| Eager unique HTML images | 18 / 9,601,742 B | 19 `<img>` nodes with one duplicate; no `loading=lazy` |
| Patrol sprite JS | 61 requests / 423,046 B | Exact `v131-patrol-sprite-*` files |
| Versioned ordered runtime group | 26 requests / 1,013,999 B | Exact ordered loader list |
| Nested late runtime group | 6 requests / 116,661 B | Exact nested loader list |
| Post-runtime group | 5 requests / 252,881 B | Exact post-runtime list |
| Local Firebase modules | 5 requests / 27,174 B | Firebase SDK transitive network excluded |
| Minimum local startup request envelope | 177 | HTML + 128 JS + 30 CSS + 18 eager images; CSS/image subresources excluded |
| Minimum dependency-gated requests | 159 | HTML + all local JS + direct CSS; eager image contention is additional |
| Uncompressed local startup source envelope | 12,829,113 B | HTML + JS + CSS + eager image sources; not wire-compressed transfer |
| Known sprite waterfall | 61 sequential requests | Each request carried a Base64 fragment |
| Artificial readiness wait | 12,000–15,000 ms | Exact `MIN_DURATION_MS` / `MAX_DURATION_MS` source constants |
| Fake progress | 90→100% until cinematic deadline | Exact `calculatedProgress()` behavior |
| Final transition | 760 ms after user input | Exact source timer |
| Loading first paint / auth UI / creation / city / warm timing | Not available | Baseline had no performance marks and local environment had no browser; no numbers are invented |

The byte groups sum exactly to the 2,786,891-byte local JavaScript graph; they are not independent totals to add again. External Google Fonts, Firebase SDK dependency modules, response headers, compression and CSS image/font subresources are excluded.

## After: deterministic source budget

| Metric | Current architecture | Change from baseline |
| --- | ---: | ---: |
| Signed-out local requests | 9 | HTML + 6 JS + 1 CSS + 1 image; at least 94.9% fewer than the old 177-request envelope |
| Signed-out local JS | 6 | 95.3% fewer than 128 |
| Direct HTML JS / CSS | 1 / 1 | Previously 24 / 30 |
| Signed-out uncompressed local critical source | 584,798 B | 95.4% below the old 12,829,113 B envelope |
| Boot JS | 37,742 B | Guarded at ≤45 KB |
| Boot CSS | 216,294 B | Guarded at ≤250 KB |
| Patrol image payload | 16 WebP / 223,598 B | 0 Base64 JS; fetched only with `feature-patrol` |
| Sprite JS requests | 0 | Previously 61 sequential requests |
| Artificial wait / fake 90→100 | 0 / 0 | Removed |
| Ready fade | 360 ms | Previously 760 ms after a 12–15 second gate |
| Global input lock awaiting full runtime | 0 | Feature-local `aria-busy` only |
| Redundant unhashed app-shell CSS request | 0 | `ad-free-service-info-modal.css` is part of the hashed app-shell stylesheet |

An authenticated existing user adds `asset-manifest.json` plus one app-shell JavaScript and one app-shell stylesheet before city hydration. `gameplay-core`, patrol, Abyss, skills, BOSS/relic and other feature bundles remain outside that critical interval.

## Browser evidence

`.github/scripts/run-boot-architecture-browser-qa.mjs` records controlled fresh-context and warm-context Navigation/Resource Timing at `390×844`, with HTTP cache disabled for cold runs and enabled for warm reload. It covers auth UI, anonymous UID, save resolution, creation, existing user, account switching and lazy features. Output: `artifacts/browser-qa/boot-architecture-browser-qa.json`.

`.github/scripts/boot-live-browser-qa.mjs` separately records the deployed Cloudflare/Firebase cold path and response cache headers. Output: `artifacts/browser-qa/boot-live-qa.json`.

The controlled browser budgets are ≤5 seconds to an interactive signed-out account UI and a 3-second CI ceiling for warm city restore, with a product target of ≤2 seconds. Live timing is reported as measured; CDN/Firebase variance is never converted into a fabricated pass.

### Verified DEV measurements

GitHub Actions run `34428020728` verified deployed `dev@08d23ecbf38ab74a6b1ef4ced43fefcded02901a` on 2026-09-10. The controlled QA used fresh mobile contexts and deterministic Firebase doubles; the live QA used the deployed Cloudflare/Firebase path.

| Path | Interactive | First paint | Requests | JS / CSS / image | Transferred |
| --- | ---: | ---: | ---: | ---: | ---: |
| Controlled cold, signed out | 283.9 ms | 284 ms | 10 (9 critical) | 5 / 1 / 2 | 1,095,669 B (1,095,362 B critical) |
| Controlled guest → creation | 1,238.5 ms | 284 ms | 14 | 6 / 3 / 2 | 2,140,168 B |
| Controlled cold, existing UID → city | 550 ms | 164 ms | 28 | 6 / 3 / 17 | 5,756,787 B |
| Controlled warm, existing UID → city | 475 ms | 132 ms | 28 | 6 / 3 / 17 | 4,192,379 B |
| Live Cloudflare/Firebase, signed out | 693.3 ms | 448 ms | 10 | 6 / 1 / 1 | 356,374 B |

The live signed-out run loaded no feature resources and met the five-second target. Mutable `/` and `asset-manifest.json` returned `no-cache, no-store, must-revalidate`; sampled hashed JS/CSS/image assets returned `public, max-age=31536000, immutable`. The controlled byte totals include full browser transfer accounting from the test server and are not directly interchangeable with the CDN-compressed live total.

There is no honest browser-timing delta for the old commit because the baseline environment had neither a browser binary nor instrumentation. The exact architectural delta is therefore reported separately above. V173.65 additionally removes the measured 7,462-byte redundant raw ad-free stylesheet request after app-shell load; no unmeasured timing estimate is substituted for a browser result.
