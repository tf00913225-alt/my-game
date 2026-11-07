# Q76 bounded draft

Work ID: TAOXI-Q76-CONFIRM-20261107
Branch: fix/taoxi-q76-confirm-20261107
Base dev: 5e4dc940a7c1f8a942dc77d86eb266607748a7fc
Status: IMPLEMENTED draft; do not merge or deploy.

Authorization: user explicitly agreed to only the Q76 pre-village information and confirmation draft. Other 2D pauses and rejected browser operations remain unchanged.

The original world map region now reveals a bottom information panel with the existing location and five-stage/onboarding requirement. Only its separate confirmation enters the original village scene. Locked regions remain readable, with entry disabled. Confirmation rereads the existing eligibility and fails closed on read failure or stale owner. Back first dismisses the panel and restores region focus. No movement, combat, save, reward or content change.

Validation executed: 13 Node tests (original 10 Taoxi regressions plus 3 new VM/DOM event-flow cases) passed; original production builder, build:check, QA script syntax and git diff --check passed. The existing Browser QA source was adapted to perform two real taps, assert selection stays on map, and verify locked information remains readable; it was NOT executed.

Independent source review found no blocking issue in product/CSS/new tests. This is source review only, not visual acceptance. Browser QA source delta received a separate follow-up review.

Pending: real browser/mobile/desktop layout, hit targets, readability, interaction and original symptom evidence; physical device acceptance; latest Head necessary CI. No alternate browser, localhost or CDP path was used to bypass the previously refused comparison operation. These remain unverified, not passed. No merge/deployment authorization exists for this draft.
