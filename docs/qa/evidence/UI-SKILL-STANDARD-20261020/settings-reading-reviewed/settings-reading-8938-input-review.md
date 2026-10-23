# Settings reading independent input evidence review

Reviewed both reports and four actual images (`settings-newborn.png`, `settings-closed-restored.png` at 360x640 and 1280x800) via view_image under `artifacts/ui-skill-standard/settings-reading-8938e239/modal-native-close-qualified`. Head 8938e239bfbc632175ed8fb4d1c880d017e1ce0e. No browser/product changes.

Both reports complete=true, clean=true, sourceUnchanged=true, profileRemoved=true. Original natural clock observations are 20→19 (1029ms at360; 1017ms at1280), with no freeze/clock/timer API override declared. Screenshots may show later countdown values because the clock continues; they are not exact timer restore evidence.

Existing sequences1–3 are visibility:hidden/opacity0 with reading=true/settings=true. Newborn sequences4–6 are also hidden/opacity0. At360 old floats have naturally expired by the newborn capture; at1280 both old and newborn coexist and all six remain hidden. Both viewed modal images show no float text over the settings surface.

Original close control is `#homeFeatureModal [onclick="closeHomeFeature()"]`, onclick=closeHomeFeature(), disabled=false, EFP hit=true. Actual rectangle68.25×44px at360 and85.3125×55px at1280 meets44. Focused runner's tap helper records the target then dispatches touchStart/touchEnd for360 and mousePressed/mouseReleased for1280. This supports real original close input rather than direct close function invocation. Settings open uses the original openHomeFeature API in the isolated fixture, not a verified user opening gesture.

After close, reading=false/settings=false, hidden panel has zero dimensions, extant floats visibility=visible. Actual closed images show battle again with red/green float presentation (and MISS on desktop). After a natural2000ms wait, floats=[] and contexts=[] in both reports. No manual float reset is used by that cleanup path.

Compared declareBaseline with finalObservation: actors, gold, inventory, equipment, monsters, battleActive/token, turn/phase, actionReady, pendingAction, autoBattle, autoPatrolEnabled, configs and elementBox are unchanged in both reports. Timer continues naturally and save/raw/meta observations are retained rather than claimed identical. RuntimeRestoreExact=false is explicit. Owned isolated profile teardown is not exact battle/save/runtime restoration.

Qualification is pure original float-emitter presentation: no real damage/heal/MISS settlement, no skill VFX timing acceptance, no auto preference or timer modification. #983 natural VFX acceptance remains pending. Report qualificationScope still contains generic inherited skill/item wording; this review follows the concrete settings phases and narrower scope field, not that blanket label.

Excluded earlier QA attempts remain excluded: hidden closeAutoBattleSettings button selection, and shared `.home-feature-close-btn` selection. Corrected native original handler selector is qualified here; those selector failures are not product failures or passing evidence. No new blocker within this narrow modal-hide/original-close/natural-cleanup evidence; no claim of full settings interaction, physical device, real combat or exact runtime restore.
