# 0f5 CI followup independent test diff review

Reviewed current working-tree diff of exactly tests/battle-patrol-ui-targeting-20260923.test.js and tests/v170-final-spec-integration.test.js, and compared against original css/fixed-slot-battlefield-rendering-v2.css lines165–182. Read focused evidence note docs/qa/UI-SKILL-STANDARD-20261020-ci-followup-0f5.md. No tracked writes, Chrome, or repeated image QA.

Battle test changes replace obsolete independent +8px/bottom syntax with the actual shared mechanism: full skill command-height + menu-offset + turn-row-height +24px formula; full item bottom + height + gap formula; common skill/item consumer top:auto, shared bottom variable, opacity:1. Existing menu offset188, retired-log absence, z-index and target-selecting visibility assertions remain. No relevant behavioral condition was dropped or converted to a permissive assertion; the exact expected geometry mechanism changes to match already-existing product CSS. This remains static contract coverage, not runtime far-row geometry proof.

v170 adds a stable baseURI to the isolated mock document and changes the existing relative-URL regression to resolve through document.baseURI, preserving its exact expected absolute URL. Native URL constructor/blob seams remain untouched. Production runtime-order assertion and other test assertions are unchanged. This makes the fixture represent the browser dependency used by the original asset owner without changing product URL logic.

Working-tree status shows two modified tests plus untracked focused documentation/evidence. No product/CSS/Modal/float/VFX edit appears in this working-tree change set. Parent/evidence reports original targeted13 and v17041 pass; not duplicated here. No new necessary gap found in this narrow test-only review.

Remaining required gates are unchanged: latest-Head required CI, real far-row artwork geometry diagnosis, story-owner integration/validation and Chrome-owner gate. These focused passes do not replace browser/CI acceptance or authorize merge. Existing valid product images were not re-reviewed because this delta does not modify presentation.
