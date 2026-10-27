# Normal dev integration through #992

Work ID: UI-SKILL-STANDARD-20261020. PR #955. Target dev only.

Integrated dev: `3a9283467b0b663af7314993da6066e2e223c971`, including normally delivered #989, #991 final ddf95f89/f068, #993 and docs-only #992. Parent UI checkpoint: `9053c5a7599ad209bb1e7a463348eb43c46ade20`.

## Conflict resolution and responsibility

Normal merge, no rebase/history rewrite. Preserve dev's first-battle return/checkpoint, once-only kill receipts (including loss/escape), atomic DTO/phase persistence and original input-guide hold. In the skill entrance conflict retain original character→skill routing and the common footer synchronization at the function bottom; remove the duplicate branch call. The positive navigation regression caught the duplicate call before correction.

Retain existing UI static footer inside the character-modal box/inventory shell, selector-list compatibility and precise modal test fixture. Keep all new #991 safety cases. Original Story Owner reviewed the exact delta against MERGE_HEAD and confirmed no safety semantics removed, no same-file work in flight; four source conflicts handed to this UI Owner. This is normal dependency integration, not a new Story implementation.

Main/battle CSS auto-merged. Preserve accepted Wind effects/shadow-cache and formal battlefield geometry plus readable skill picker/item timer. Battle's separately leased name/active-turn/target hunks remain its sole responsibility. No new product edits in those hunks. #993 acquisition wording and #992 document changes preserved.

Resolve generated bundles/manifests and restricted-policy conflict using the existing production builder. Hero policy blobs exactly equal dev; other regenerated policy differences are source digests only. No safety policy or numerical/gameplay change authored here.

## Verification

- 129 focused tests passed: player flow, chapter finalization, battle checkpoint, fixed-slot battlefield and status assets. Original final #991 reward/noRewards/save-failure/recovery cases retained.
- Production build, build:check and staged diff check passed.
- Four-size synthetic runtime verification: 360×640, 393×873, 412×915, 1280×800. Character skill entry/scroll, formal battlefield, full/insufficient-SP skill picker, empty/full/end item list, trusted touch or wheel and close. All report complete/source-unchanged and exact actor/inventory/loadout/private-storage restoration. No item consumed or reward settled in these static battle probes.
- 393×873 original first-lesson-only trusted-touch path passed: fresh synthetic character, real initial battle, EXP→status→skill→original static footer, same-battle/round restore and normal first-lesson completion. Screenshot taken at the actual return stage. No full five-lesson or twenty-node rerun.
- Independent source review: `/root/ci_player_flow_review` approved bounded source/safety preservation. Independent visual/input reviews saved alongside evidence when completed.

[Evidence, screenshots, traces, probes and source hashes](evidence/UI-SKILL-STANDARD-20261020/dev992-integration/).

Excluded setup failures: first probe lacked the explicit Windows Chrome path; next sandboxed attempt hit localhost DevTools EACCES. Neither reached acceptance. Scoped permitted execution succeeded without changing Chrome, tools or product code.

## Pending / boundaries

Latest new Head required CI must complete naturally after remote checkpoint. Old e5 browser success and old dependency delivery do not certify this new Head. No merge into dev or deployment yet; final publication order must be coordinated before integration.

Existing ledger gaps, creation element control widths below 44px, real devices/PWA and untested natural combat states remain open. Review also noted apparently blank first-row potion artwork; attribution remains unconfirmed and is not silently repaired here. No whole-interface completion claim.

Automation955 remains PAUSED. 2D exploration and dedicated UI/Story interfaces remain product-paused. Main release forbidden.
