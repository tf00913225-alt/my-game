# dev #981 minimal source merge review

Reviewed working tree/index while HEAD=97db6f6a20c0a2cfa2b65dabdae77f2d723875aa and origin/dev=d2bd5fbdcca8fe53b036065ff815fe8e020fb294, before merge commit. Read-only review; no Chrome launched, no tracked file written.

## Finding

Source merge is acceptable within this narrow review. No source-level loss or conflicting ownership found in the sole handwritten render conflict. This is not approval of Browser QA for a new Head.

Precise retention evidence in js/adventure/adventure-ui-v1-20260915.js:

- Lines 598–599 retain UI branch `samePanel=ui.renderedPanel===view.panel` and capture `panelScrollTop` before rebuilding DOM; lines 608–609 retain map body reset to 0, same-panel non-map scroll restore, and renderedPanel bookkeeping.
- Lines 600–606 retain dev selected-node fallback, visible-map chapter/selection mapKey, existing picker/list capture, and same-key browsing snapshot of native disclosure open plus list scrollTop before innerHTML replacement.
- Lines 610–616 retain lastMapKey assignment and restore nextPicker.open / nextList.scrollTop after DOM replacement. The map body's zero reset and nested native list restore target different owners and coexist in the merged sequence.
- ui.lastMapKey initialization at line 11, ensureRoot reset at line 47 and show reset at line 628 retain dev's visit boundary. No unconditional reuse across changed map selections was introduced.
- `git diff --cached` against HEAD adds the dev map retention/init/reset code around the existing UI body scroll behavior. `git diff origin/dev` shows only the pre-existing UI branch changes (event/branch copy, tutorial return placement, story back guard, body panel scroll preservation) in this file, with no removal of dev's browsing mechanism.

Upstream test preservation: the guided-pointer fixture has zero diff against origin/dev, including the background Hero notification browsing equality assertion. The chapter finalization test's diff against origin/dev consists solely of the UI branch's existing story-return and tutorial-navigation tests; upstream installUi parameterization and same-map Hero refresh regression remain intact. No test assertion was weakened by this resolution.

Generated evidence: both manifest cached diffs contain only adventure UI generated filename/hash/byte descriptor updates to ecc7fc233097 / 52606. Source SHA256 and built feature-adventure-ui.ecc7fc233097.js SHA256 both equal ECC7FC2330974F0036D4217359E4E8487D90870959E5E3A1B86BE082783ECF26; root/build manifests are byte-identical. Conflict backups and resolution.json exist under docs/qa/evidence/UI-SKILL-STANDARD-20261020/dev981-conflict-source; resolution records two generated-path conflicts per manifest and builder regeneration. Cached descriptor-only changes provide no evidence of unrelated auto-merge content loss.

## Validation boundary

Parent reports 52 chapter/scroll tests and build check passed; this reviewer did not rerun them. No new-Head Browser QA performed or approved here. Earlier 8fb material screenshots cannot certify this merged runtime Head. Final merge SHA, Latest Head required CI, and any necessary runtime interaction evidence must be tied to the resulting Head separately.
