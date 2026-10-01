# Cold Entry Navigation / Notification Dot QA

Work ID: `NAV-COLD-DOT-20261002`

Base: `dev@b676b2671df7c8195675eae486f6eed5095d3301`

Branch: `fix/navigation-cold-entry-notification-dots`

## Responsibility result

- DOM and shell lifecycle: `js/04-stage-v11-native-bottom-nav-runtime.js::FourSymbolsBottomNav`
- Context selection and projection: `FourSymbolsBottomNav.syncContext()` in the same eager app-shell owner
- Page transition caller: `js/00-main.js::showPage()`
- Abyss top-return compatibility lifecycle: `js/42-v148-combat-dungeon-fixes.js::syncContextNavigation()`
- Native geometry and native red-dot conversion: `css/06-stage-v11-native-bottom-nav.css`
- Legacy red-dot presentation and animation: `css/38-v141-system-expansion.css`

The former lazy V148 context selector and CSS42 global 7px dot override are retired. No second shell, timer, observer, wrapper or late CSS patch is introduced.

## Required executable evidence

`.github/scripts/run-bottom-nav-runtime-browser-qa.mjs` must run on 360×640, 393×873 and 412×915. Before the first training tap it blocks gameplay-core responses, and must prove:

- gameplay-core is not ready;
- one real tap activates `trainingPage` once;
- immediate and settled labels are `角色／背包／秘寶／元素匣／返回`;
- context is `training`, shell identity/count remains one, and no main-navigation flash occurs;
- after lazy owners load, first/second entry and all existing navigation lifecycle rows remain stable;
- native and Legacy dot computed styles, maximum/static rectangle and pulse minimum rectangle are recorded;
- static screen diameter is 7–9 CSS px, pulse minimum remains visible, dots are inside their buttons and pointer-inert;
- the backpack last row can scroll fully above the footer and refresh/pagination controls remain hit-testable;
- home remains non-scrolling while formal backpack/skill scroll owners remain usable.

Local source tests and deterministic build checks pass. Local browser execution is unavailable when Chrome/Chromium is absent; CI and deployed DEV evidence must be recorded separately before VERIFIED.

## PR verification log

- PR #747 run 3832 exposed and corrected one stale owner assertion before browser QA.
- PR #747 run 3834 passed source, owner and build-sync checks, then stalled in the pre-existing CJK font installation step; it is not accepted as browser evidence.
- A fresh run on the final PR head must complete the browser matrix before merge.
