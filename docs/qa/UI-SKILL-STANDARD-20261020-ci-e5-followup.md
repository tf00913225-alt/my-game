# e5b251cc CI first-failure follow-up

Work ID: UI-SKILL-STANDARD-20261020. PR #955. Target dev only.

## Evidence and minimal correction

CI [40096923589](https://github.com/tf00913225-alt/my-game/actions/runs/40096923589), attempt 1, pull_request, Head e5b251cc8b7d54aa75cd1c2c4b2c772c7562276e completed with failure. core_checks job 120881280934 step 30 first failed at tests/v173.42-player-flow.test.js:183: retired aria-label 返回上一層. Repository checks failed consequently. Selected browser gates and Session Authority validation succeeded; skipped deployment is not acceptance.

Original js42 uses 返回玩法 and delegates to original js41 exit Owner, preferring v174AbyssLeaveToGameplay and falling back to showPage("gameplay"). Update the stale assertion, preserve delegate verification, and execute that original function in a VM to verify both routes and fallback exclusion on the primary route.

Running the complete focused file then exposed two further stale expectations in that same suite: whole milestone opacity .5. Existing accepted css25 keeps slot text opacity 1 and dims only the chest using saturate(.35) brightness(.58). Assert both unavailable/claimed selectors precisely and retain the reached/unclaimed indicator assertion. No product code, CSS, numeric rules, rewards, or Gate changed.

Validation: `node tests/v173.42-player-flow.test.js` passed after correction. Independent reviewer `/root/ci_player_flow_review` approved the source, VM routes, exact CSS state assertions and preserved Gate. This tests-only segment does not repeat existing successful browser evidence or claim new visual acceptance. Latest new-Head required CI remains pending after push.

## Integration pending

Read-only merge-tree against dev 4e5756e6a6cf5f7c76dadad1f0dd8fa106289442 confirms source conflicts in Adventure runtime/UI, chapter1-story-finalization test, generated restricted-forest policy, plus generated bundles/manifests. Battle main/CSS auto-merge in this simulation; auto-merge is not independent acceptance. Story Owner was asked for scoped handoff before resolving its source conflicts. No actual merge or deployment has begun.

Battle's previously leased name/active-turn/target presentation hunks remain its single-writer responsibility. #992 docs-only publication may precede UI; no UI merge/deployment in flight. 2D exploration and its dedicated UI/Story interfaces remain product-paused. Automation955 remains paused.

Remaining full-interface ledger states, creation element widths, physical-device/PWA and natural combat states remain unverified as previously recorded. This checkpoint is not whole-game completion.
