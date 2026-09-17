# Battle runtime P1 — NOT COMPLETE

Base: `acc6419b72ee3a31a6314a6833ded3f81a3fd219` (merged PR #261).
Scope: character/enemy portrait placement and VFX size/center only.
Game/cache: 173.65, unchanged. Requirements: 0/2 VERIFIED.
Runtime source commit: `f230a5bb46867f1483481ef3481f5d53888cb039`.

## Evidence actually observed

- Reviewed user video `1000070324.mp4` (1080×2316, 12.131 seconds). It shows personal BOSS 霜淵侯 Lv50 with summoned 蒼嵐迅衛 / 天罡風侍, enemies above their normal zone, player damage numbers below an empty field, and detached VFX.
- Opened the real deployed game at `https://dev.four-symbols-dev.pages.dev`, completed the genuine Anonymous Auth/character-creation flow through the UI (new test character 戰場定位驗證), entered 新手森林, and triggered a real three-enemy encounter through 自動巡怪. No injected battle DOM, fake combat state, or mocked boot was used for this observation.
- At the fully loaded 1363×936 browser viewport, the real game surface was 526.5×935.987. Read-only DOM measurements found:

| Element | Intended slot height (CSS px) | Actual computed unit height (CSS px) | Other actual state |
|---|---:|---:|---|
| Ally | 86 | 122 | Legacy 2px frame still present |
| Enemy | 92 | 100 | Unit height exceeds its slot |
| Enemy zone | — | 188 | `top:16px` **plus** `translateY(16px)` |

- The real normal-battle screenshot showed a visible player with the old card frame, confirming that the isolated prior fixture had missed the production cascade. The same BOSS reinforcement scenario has **not** yet been reproduced in the browser in this run.
- After reloading to prepare the high-level BOSS scenario, clicking the existing DEV experience-grant button opened a native alert. The browser reported an active alert on close, but documented dialog dismissal and subsequent DOM operations timed out (`CDP operation refresh tabs timed out`). Creating a new tab did not restore inspection. No save or authentication data was deleted.

## Root causes and proposed source changes

1. `js/35-v141-ui-battle.js` resets `v141-preparing-entry` on every `renderBattle`. `js/gameplay-boss-tower-system.js::summonBossElites` calls that renderer during the existing battle. `startTurn` skips the entry cleanup for an already-started battle token. The resulting CSS hides/translates the player by +130px and translates enemies by -110px; living-enemy CSS separately forces enemy opacity to 1. This source trace matches the video, but still requires the exact runtime scenario to confirm.
   - Reuse the existing entry-token set in the existing render owner; only prepare entry before that battle token starts. No extra wrapper or timer.
2. The canonical fixed-slot stylesheet used a shorter namespace than the four-ID legacy app selectors. Its unit dimensions and presentation were overridden after all production styles loaded.
   - Match the real `#game-stage > #app > #game-content #battlePage` host in the existing canonical stylesheet. Keep all coordinates and formation tables unchanged. Limit the historical V146 zone translation to non-fixed zones.
3. PR #261 applies independent CSS `scale` on the same element whose `transform` centers and moves the sprite. Independent scaling also scales those translations, offsetting the visible center and shortening flight distance.
   - Apply the same placement multipliers to V143 raster box dimensions before aspect fitting. Remove the independent CSS scale. Target coordinates, animation timing, target selection, skill data, and damage logic remain unchanged.

Owners remain `FourSymbolsBattlefieldSlots`, its render adapter, the existing V141 entry owner, and V143 raster renderer. No new runtime patch/owner.

## Supplementary checks (not visual acceptance)

- `node tests/fixed-slot-battlefield-rendering-v2.test.js`: passed, including actual source entry lifecycle (initial battle / same-token redraw / new battle), raster sizing, aspect and anchor preservation.
- `node tests/v174-cardless-battle-presentation.test.js`: 4 passed.
- `node tests/fixed-battlefield-slots.test.js`: passed.
- JS syntax, production build synchronization, release coherence and diff whitespace: passed.
- Existing isolated browser gate retains its assertions and now has the real app host ancestry. Its PASS cannot mark either requirement VERIFIED.

## Required acceptance before completion

1. In the fully loaded candidate runtime, repeat the actual Lv50 personal BOSS encounter through round 4 with reinforcements. Capture before/after screenshots and unit/slot rects; assert no stale `v141-preparing-entry`, visible living party, no enemy -110px transform.
2. Verify single, group and traveling skills through actual combat; capture raster bounds and intended slot centers/endpoints, including after target death/reinforcement.
3. Check a normal encounter and a three-member party with front/back formation at portrait mobile sizes; confirm portraits stay inside the game viewport and retain their slots.
4. Follow the existing review/integration process, then verify CI, dev deployment SHA, game/cache versions and both requirement items. Do not advance status or version based on synthetic QA.

The source proposal is reviewable; the requested real-runtime repair is not yet verified or complete. No deployment or integration has been performed by this change.

## Publication blocker

The automatic approval reviewer rejected `git push --set-upstream origin fix/battle-runtime-portraits-vfx-20260917` to `https://github.com/tf00913225-alt/my-game.git`: it treated the remote as unverified and required explicit authorization to avoid disclosing private source. No alternate write tool was used to bypass the rejection. The local commit is preserved; no Draft PR, remote CI or deployment has been created for this candidate. User approval is required before retrying that push and creating its validation Draft PR.
