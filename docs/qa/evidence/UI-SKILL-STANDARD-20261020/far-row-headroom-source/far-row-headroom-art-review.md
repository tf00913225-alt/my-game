# Far-row headroom — minimal independent image review

Reviewed working-tree images at HEAD bd003a9fe5827abf983b499c99129249795b4d8d, with uncommitted target change. No Chrome launched; no tracked files written.

Actually viewed:
- Before: docs/qa/evidence/UI-SKILL-STANDARD-20261020/far-row-0a102556-diagnostic/command-portrait-412x915-party6-visible.png
- After: artifacts/browser-qa/command-portrait-412x915-party6-visible.png
- After: artifacts/browser-qa/command-portrait-412x915-party1-visible.png

Verdict: 限定通過 far-ally 2 logical px top headroom subitem in these static geometry fixtures. Comparing party6 before/after, upper-row figures retain their distinct silhouettes and lower foot placement; labels and both HUD bars remain below their figures, readable and unobscured. No new artwork paint appears over the skill/attack/bag/defend/escape controls. The figures begin close to the controls' lower boundary in both images, so this is not certification of extra visual whitespace. The party1 after image similarly retains an unobscured centered character label/HUD and operation row. No new blocking art issue found in the requested comparison.

Minimal source corroboration: css/fixed-slot-battlefield-rendering-v2.css separates the previously shared far enemy/far ally depth declaration; both retain --battle-art-depth:1.10, while only front data-slot-row far ally receives --battle-art-overhang-top:9px. The inspected CSS diff contains no foot anchor, HUD, region fr, countdown64, floating text, timing or arrow-owner changes. Parent states original full four-size Browser and command pixel gate pass; this review did not rerun or independently inspect those gate logs.

Limits: the screenshots are static geometry fixtures with gradient monster blocks, generic labels and duplicate round text. They cannot establish natural combat commercial-art quality, animation/VFX/arrow behavior, real-device touch or all encounter/formation conditions. This approval is restricted to the visible headroom change at 412x915 party6/party1, not natural gameplay acceptance or a blanket visual PASS.
