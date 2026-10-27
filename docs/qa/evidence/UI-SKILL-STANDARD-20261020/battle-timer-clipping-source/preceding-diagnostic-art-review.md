# Fixed-slot prompt88 diagnostic visual review

Source9b584af2909008d82da52a26332dd0247bc59c8a. Report says complete=false, diagnosticOnly=true: NO completion approval.

Actually viewed3 existing360x640 PNGs in `fixedslot-prompt88-9b584af2/natural-entry-diagnostic/360x640`: battle-hud, battle-target-prompt, battle-hud-cancelled. Requested battle-target-cancelled.png does not exist; the actual cancelled image is named battle-hud-cancelled.png.

Target prompt itself is readable: `選擇 [普通攻擊]` and `選擇目標` sit within the existing iron/bronze carved frame, with a separate return button and no text overlap. All three target crosshairs and enemy labels remain visible. The prompt overlaps the upper edge of the foreground player's artwork, but does not obscure the visible name/HP/SP indicators in this fixture. Returning restores the original action row and removes the prompt/crosshairs in the cancelled image.

Concrete defect: two simultaneous `第1回合` labels are visible in HUD, prompt and cancelled views. Left plaque combines round text with a large `20`; a second unframed gold label appears immediately right/below it at x128/y301. This duplicates information, weakens hierarchy and nearly touches the target-prompt upper frame. The first HUD image also shows the large20 sitting awkwardly against the slanted plaque boundary. Root should identify the formal round/countdown owners and retain one clear semantic round label; do not conceal duplicate text via opacity, smaller text or another global overlay. The artwork/battlefield need not move merely to address this local HUD issue.

No approval for four viewports, other target counts/actions, real attack/turn progression, combat effects, trades/rewards or physical devices. No Chrome launched or tracked source modified.
