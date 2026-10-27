# Adventure input evidence independent review

Reviewed existing reports and four actual `picker-stage20-end.png` images with view_image; no browser opened and no product/source/art investigation or writes. Evidence root: `artifacts/ui-skill-standard/post-e5-adventure-8fb31a94/existing-material-qualified/`; report Head: `8fb31a9488e4cec111490cb9800126af950811c4`. This is a saved-evidence review, not a new live input run.

| Viewport | Smallest exercised input W/H (px) | Down scrollTop | Up scrollTop | End item 20 / owner vertical bounds |
|---|---|---|---|---|
|360x640|44.57 / 44.57|0,187,421,656,812|812,624,391,146,0|405.78–450.35 / 249.78–455.49|
|393x873|48.66 / 48.66|0,245,438,683,812|812,620,378,134,0|530.14–578.80 / 359.84–584.41|
|412x915|51.01 / 51.01|0,248,499,749,812|812,565,310,112,0|555.67–606.68 / 377.13–612.56|
|1280x800|55.71 / 55.71|0,167,333,500,666,812|812,645,479,312,146,0|507.22–562.94 / 312.22–569.36|

All four complete=true. Five exercised inputs per report: city entry, picker summary, c1_01 list button, sheet primary entry, original back. All five have hit=true (reported elementFromPoint evidence), disabled=false, both target dimensions >=44px. This claim covers those exercised inputs, not a fresh hit test of every map landmark or locked row.

Scroll evidence: owner overflow=auto; client=238, total=1050, final top=812 equals total-client in all four. Multiple increasing/decreasing observations support actual list scroll rather than a fabricated stage20 selection. Locked c1_20 remains disabled=true, and its full rectangle lies inside the scroll owner at end. Four viewed images agree: complete `20. 黑松寨主` row is visible above picker footer; no bottom clipping of row 20. Partial preceding row at top is normal scroll clipping. List overlays map while open, as expected for this evidence; image alone does not prove event delivery.

Returned-to-top evidence ends at scrollTop=0 and enabled c1_01. Reports then record the original c1_01 sheet, original first dialogue line (`dialogue=true,status=current,completed=false`) and original return handler `FourSymbolsAdventure.closeToCity()`. `allowed-return-home` has no visible adventure controls, hidden zero-size adventure header, battleActive=false, battleToken=0, timerId=null. View-state cache still says map/dialogue, so cache state is not evidence of exact internal restore; report scope explicitly says private adventure cache not exact restored.

All four reports have seven restore flags true: raw, meta, actors, inventory, loadouts, equipment, saveAPI. profileRemoved=true and sourceUnchanged=true. Original beginChapter/lastViewedAt/save effects were allowed and two save calls observed; restore claims concern the listed surfaces rather than absence of intermediate effects.

Limits: active guide / active onboarding was not exercised (existing-character inactive tutorial path); remaining 20-stage story progression and tutorial skill/shop bridge were not exercised; physical device / real touch input was not verified. Next was not exercised; first-line-only presentation smoke does not qualify terminal story, battle, reward, buy/equip/create, full progression, or production deployment. No new blocker found within the narrow saved evidence.
