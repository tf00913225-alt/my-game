# Bottom navigation frame — independent art review

Source e4966289d0fdf41580363fb835f301b430d182e3. Actually viewed home.png and dungeon.png for all four sizes (360x640, 393x873, 412x915, 1280x800) under artifacts/ui-skill-standard/batch2-nav-frame-e4966289, plus before returned-home.png and daily-top.png under docs/qa/evidence/UI-SKILL-STANDARD-20261020/batch2-dungeon-end-reviewed/360x640. No Chrome launched or tracked file written.

Verdict: 限定通過底部導覽底板框飾子項。The new black iron texture and engraved bronze edge give the home and dungeon navigation a more finished frame matching the established skill panel material, replacing the visually plain dark gradient and straight top gold line. The frame remains a shared container rather than individual new button boxes; the dark interior preserves contrast for the gold icons/text.

In all eight after images the edge does not cover icon silhouettes, labels, active underline or notification dots. Home navigation labels remain readable, and dungeon's ornate round icons remain distinguishable. At 360px some labels are close to the lower ornament, but their glyphs are complete and the frame does not visibly run through them. No blocking regression observed in this requested scope. Existing dungeon card content continues behind the fixed navigation at the initial scroll position; this frame-only review does not renew list-end or scroll-reachability approval.

Source corroboration: css/06-stage-v11-native-bottom-nav.css replaces border-top:2px solid #8a6a3a and the linear gradient with border-image skill-iron-bronze/panel.827d9ba9a6f8.webp (115 fill / 18px / 0 stretch) and background #151515. No icon sizing, text declaration, state handler or navigation geometry declaration changes appear in the inspected patch.

Limits: this approves the frame material and visible non-overlap only. Existing icon visual-size differences remain: home bag/crossed swords/buildings/scroll have different silhouette mass, and dungeon round medallions are denser/more ornate. Their proportions are not certified as fully consistent and remain a separate follow-up. No real-device, interaction, deployment, all-state or full-UI/commercial-quality PASS is claimed.

## Follow-up: mixed icon / label implementation

Based on the same eight already-viewed screenshots, the implementation difference (home original SVG plus live label versus contextual round art with embedded text) alone is insufficient evidence for a product change. Home labels are readable at 360px and larger; home active 主城 is distinguishable by its bright underline. Contextual medallions have denser details and visually smaller embedded lettering, but the viewed images do not establish missing/cropped glyphs or a specific unreadable label requiring replacement. Distinct silhouette mass is observable, not by itself a defect when content differs.

The static home/dungeon snapshots do not show a controlled before/pressed/selected sequence for the contextual icons, so they cannot prove that its selected or pressed state is hard to distinguish. No evidence-based reason in these images supports replacing all icons, cropping embedded labels or reducing the existing engraved medallion art for uniformity. Any next subitem should name a concrete label/state defect and obtain corresponding direct evidence first.
