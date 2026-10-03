# Bottom Navigation / Home Scroll Owner Convergence — runtime evidence

Verified runtime commit: `5c2330b79e807ce92f5971488b1d9f12342521e6` on dev, merged by [PR #727](https://github.com/tf00913225-alt/my-game/pull/727). Main was not modified.

The original construction base was `08d5c3cf6e327e3d9dda033dad4c42b7d66f2d64`. This continuation re-read live dev `8760a89eb505a1c9219dbd698047e1f8344be800`, then merged the newly advanced dev `67ebf68350f67f41b62cea21829d319a45f1281f` into the existing fix branch without rebase or force push. Final implementation PR head: `c8c215e8f8d2089322fd29dbdac2f12682396a3b`.

## Responsibility and retirement

- Canonical DOM, migration, item mounting, visibility and selection: `js/04-stage-v11-native-bottom-nav-runtime.js`, through `FourSymbolsBottomNav`. It owns one `#bottomNav` inside one `.native-bottom-nav-layer` under `#game-overlay-layer`.
- Canonical presentation: `css/06-stage-v11-native-bottom-nav.css`. Native shell 1080×216 at the bottom of the 1080×1920 stage; five equal columns; shared 180×180 icon frame; `object-fit:contain`; one background, gold top border, hitbox and active/pressed contract. Existing stage scaling supplies screen coordinates.
- Context item projection: `js/42-v148-combat-dungeon-fixes.js`. `CONTEXT_NAV_ITEMS`, `renderContextNav` and `syncContextNavigation` select items/actions and delegate rendering. They create no independent navigation DOM or geometry.
- Retired: `#mapPageNav` DOM, `js/05-stage-v13-native-map-nav-runtime.js`, `css/07-stage-v13-native-map-nav.css`; independent `#v141DungeonNav` creation and V143 reparenting; legacy/main/map/context geometry in CSS00/01/02/09/38/40/42/43/45; V30/V31R2 navigation scaling; direct `navMap`/`markGameplayNav` state writers and timer/MutationObserver navigation scheduling. The build excludes the retired map files.
- Compatibility only: `v148SyncDungeonShell` is an alias of the same context projector, with old fallback references in JS35/41. It has no DOM, presentation, geometry, event listener or independent lifecycle. Retirement condition: remove those fallback references, confirm a zero-caller scan, then delete the alias. They already prefer `v148SyncContextNavigation`.
- Unrelated: quest-notification wrappers/observer, native character/modal migrations and home asset warming. Historical map IDs in comments and `mainBottomNav` in asset warming are inert. CSS00's unused historical bottom-nav custom property has no consumer or decision authority.

`combineStyles()` directly concatenates CSS09 into app-shell CSS. Navigation scaling rules were removed from that source rather than covered by a new patch. Remaining embedded historical character/modal content was inspected and left outside this bounded repair. Source and regenerated formal bundles agree.

## Mobile browser results

[CI run 36821241683](https://github.com/tf00913225-alt/my-game/actions/runs/36821241683) is attached to implementation PR head `c8c215e8f8d2089322fd29dbdac2f12682396a3b`. Its tested merge snapshot is `8a916c169c0ddc000d0f37b2b9080f35dd827fcc`. All required checks passed, including formal battle, inventory, skill and production-build synchronization suites. Navigation JSON evidence is artifact `11143767076`.

Each viewport tested home, training, patrol, dungeon, gameplay, boss, tower and abyss twice: 48 rows total. Every row retained the same shell object, shell count 1 and legacy navigation count 0. Width/height/bottom, five column widths and five icon-frame heights agree across contexts within each viewport. Values below are screen CSS pixels, rounded for readability.

| Viewport | Navigation width × height | Bottom | Each column width | Each icon frame height |
| --- | --- | --- | --- | --- |
| 360×640 | 360×72 | 640 | 72 | 60 |
| 393×873 | 393×78.6000 | 785.8333 | 78.6 | 65.5 |
| 412×915 | 412×82.4000 | 823.7222 | 82.4 | 68.6666 |

The bottom matches the stage bottom; taller viewports retain the existing centered-stage letterboxing. All three home measurements are `clientHeight=653`, `scrollHeight=653`, `overflow-y=hidden`. Native single-finger touch input leaves home `scrollTop=0` and document `scrollTop=0`. No production touch lock was changed for this repair.

The formal skill-modal scroll owner is `#characterTabContent`: client height 429, content height 1781 in the isolated QA account; native touch increases scrollTop by 94 / 87 / 83 px. Inventory preserves `overflow-y:auto` and its formal 24-slot pagination; the tested grid fits without overflow, so the test does not pretend it must scroll.

Lifecycle checks include formal startup, repeated page entry, patrol/inventory/close, dungeon tab, battle-page entry/exit, return home, reload and CDP freeze/active/foreground restoration. The navigation suite measures page transitions for battle exit; separate same-head CI and deployed battle suites exercise the formal combat engine. Physical Android hardware was not used.

Fixture boundary: production index, feature loader, JS/CSS and renderers are real. Only Firebase transport uses an immutable read-only QA account. Fake inventory is reset in the new document before Startup, after the previous document's real pagehide autosave. This avoids making QA-only inventory a cloud migration candidate; Startup READY and migration safety are not bypassed.

## Actual deployed UI results

[Dev CI/deployment run 36821889706](https://github.com/tf00913225-alt/my-game/actions/runs/36821889706) passed. The actual dev release manifest reports commit `5c2330b79e807ce92f5971488b1d9f12342521e6`, Game Version V173.72 and Cache Version 173.72.

The actual dev URL was reloaded and operated through visible UI, including lazy first entry. Browser viewport: 1363×936. Every page below had owner `.native-bottom-nav-layer`, parent `game-overlay-layer`, one shell, no legacy navigation DOM and one visible navigation element.

| Actual UI context | Navigation width × height | Bottom | Five column widths | Five frame heights |
| --- | --- | --- | --- | --- |
| 主城 | 526.5×105.3 | 936 | 105.3 each | 87.75 each |
| 野怪區 | 526.5×105.3 | 936 | 105.3 each | 87.75 each |
| 巡怪地圖 | 526.5×105.3 | 936 | 105.3 each | 87.75 each |
| 副本 | 526.5×105.3 | 936 | 105.3 each | 87.75 each |
| 玩法總覽 | 526.5×105.3 | 936 | 105.3 each | 87.75 each |
| BOSS | 526.5×105.3 | 936 | 105.3 each | 87.75 each |
| 四象塔 | 526.5×105.3 | 936 | 105.3 each | 87.75 each |
| 深淵選擇 | 526.5×105.3 | 936 | 105.3 each | 87.75 each |

Home before deployment had client height 659, scroll height 782 and `overflow-y:auto`. Verified home has client height 653 and scroll height 653; scrolling input leaves home/document/game-viewport scrollTop at 0. Actual deployed skill content retains overflow auto and scrolls to 936 (client height 429, scroll height 1798). Patrol/backpack/close, dungeon tab and boss/tower/abyss return buttons preserve shell geometry.

The signed-in test character is level 1, so the live boss/tower/abyss selections were measured without starting locked challenges. The mobile CI account exercises the higher-level runtime independently. Four requirement rows are VERIFIED. This evidence follow-up changes documentation only; it requires its own current-head CI and exact subsequent deployment before final closeout.
