# 《四象江湖傳》怪物立繪工作入口

凡涉及怪物、精英、BOSS、深淵帝王、BOSS 援軍、日常副本敵人或天兵天將的立繪生成／導入／接線，請先讀：

1. `docs/MONSTER_PORTRAIT_SPEC_V1.md` — 人類可讀正式規格。
2. `config/monster-portrait-registry.json` — 機器可讀目標清單與路徑。
3. `scripts/audit-monster-portraits.mjs` — 自動盤點與缺圖驗證。

固定流程：

**自動盤點 → 自動生成 → 自動放置 → 自動接線 → 驗證**

重要固定規則：

- 一般／精英／天兵：1024×1536 透明 PNG。
- BOSS／世界 BOSS／塔 BOSS／深淵帝王：1536×2048 透明 PNG。
- 同名普通怪被 roll 成精英時共用同一張立繪。
- 四象天兵只做 fire / water / wind / earth 四張，四象塔與深淵共用。
- 深淵東／南／天／北領域前置關分別用土／火／風／水天兵。
- 真境最終戰五名天兵視覺順序固定：水｜土｜火｜風｜水。
- 極帝領域前置四關目前是 light；未經使用者明確決定，不得自行新增「光天兵」。
- 不得新增第三套 battle portrait wrapper；既有深淵 owner 是 V154，同步時序補丁是 V159，後續導入要收斂而非再疊 patch。
