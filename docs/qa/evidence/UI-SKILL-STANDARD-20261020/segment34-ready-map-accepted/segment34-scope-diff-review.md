#34 source7025fe96 independent scope review (after images pending)

Read complete eight authored source changes and two regression diffs. Original41 class toggles and exitAPI remain; only duplicate top-return creation/removal block retired. Original42 is still sole creator, only aria changes to返回玩法. Original59 only resolves the existing map URL againstdocument.baseURI and removes overlapping tiny mapback markup. No map progression/current run/action/encounter/chest/portal/reward/settlement data changes. Original04 bottom selection-return remains outside diff.

Manifest only adds existingfeature-patrol dependency tofeature-abyss. No new portrait Owner, observer or asset introduced. No dependency cycle: patrol→gameplay-core,abyss→gameplay-core+patrol. Feature execution/decode is a new explicit dependency, not proof already shown in browser; after must verify projected player and map200.

Original CSS42 top control42→52 authored with min-width52; CSS46 legacy38rule excludes modern selection. CSS50/54 only modern controls corner/bronze colors and HUD original frame material plus obsolete tiny-back style retirement. Class lifecycle migration was correctly abandoned. NoteCSS46 exclusion uses an extra:not class in selector, so specificity increases for remaining legacy matches; actual modern selection is excluded. Keep this transparent; it is not a global CSS patch or new Owner.

Tests retain old route/formation/data assertions and add pure map rendering with nonrootdocumentbaseURI/state unchanged, manifestdependency, obsoleteback absent and top create/reuse/remove/exitdelegation. Root reports six focused entries pass plus build/check. v169asset test localidentifyENOENT remains uncompleted, not approved or downgraded; latest-Head Actions owns that required result.

Independently reconstructed all four complete generated bundles by replacing each exact old authored source block with its exact new block in parentbundle. SecondaryJS,featureAbyssJS,gameplayCSS andfeatureAbyssCSS each byte-exact equal current output; each source embedded once. Sourceproof elsewhere retains per-file hashes. No extra bundled logic was introduced.

Result: source scope provisionally acceptable within proved UI/navigation/material defects. NOafter visual approval here. Required actual4viewport control geometry/hits, original top→Gameplay vsbottom→selection, original class state, mapURL200, nonzero decoded source/projected art, no battle/chest, canonical localwrites/restore still pending.
