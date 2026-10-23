# Backpack three-row density — independent art review

Source 2da64051499d7a2d7e8384d1bc3011208f41a611. Actually viewed source before/populated-backpack.png under docs/qa/evidence/UI-SKILL-STANDARD-20261020/ci-d5-density-source, four populated-backpack.png sizes (360x640, 393x873, 412x915, 1280x800) and 360x640 long-gold.png / native-end.png under artifacts/ui-skill-standard/ci-d5-bag-density-verified-2da64051. No Chrome launched or tracked file changed.

Verdict: 限定通過此三列密度及頁首金幣配置子項。The before image cuts the third item row behind the fixed footer. All four after populated images show five columns and three complete rows of item art/borders, ending above the footer controls. Reorganize, pagination and one-click sell labels remain legible and separate from the grid. Native-end shows the final partial row's four occupied cells fully above the footer, without bottom art clipping.

The header's 背包 title, 金幣 5,740,767 and close control remain distinct in all four sizes. The 360 long-gold image shows 金幣 9,999,999,999 fully visible in one line, with no collision with the title plate or close button. The title plate narrows for the long value but both title glyphs remain complete and visually balanced. This observation does not certify longer arbitrary balances/localized currencies.

Character portrait visual scale, pose, detail and foot visibility remain consistent with before; no observed shrinkage, distortion or blur was introduced to recover rows. Name, level, HP/SP values, equipment labels and tabs remain readable. The tighter layout is concentrated in reclaimed wallet-row/spacing space rather than a degraded portrait or compressed item art. No blocking visual regression found in these requested fixtures.

Minimal source corroboration: the original inventoryGoldValue wallet element is moved from inventory-right-panel into inventory-header in index.html; CSS22 changes the original header grid to three columns and keeps close in column 3. Review focuses on resulting image evidence rather than restating CI geometry as a visual pass. Existing 詳 control overlaps part of the portrait region both before/after; this review does not claim a new fix or broader approval for that pre-existing placement.

Limits: only the observed populated density/header/visible end state is approved. No full-UI, real-device, transaction/sale, gameplay, arbitrary item/art or complete state-matrix acceptance is claimed. Browser CI reports are separate execution evidence and were not rerun by this reviewer.
