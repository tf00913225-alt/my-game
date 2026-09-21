# 《四象江湖傳》怪物立繪工作入口

凡涉及怪物、精英、BOSS、深淵帝王、BOSS 援軍、日常副本敵人或天兵天將的立繪生成／導入／接線，請先讀：

1. `docs/MONSTER_PORTRAIT_SPEC_V1.md` — 人類可讀正式規格。
2. `config/monster-portrait-registry.json` — 機器可讀目標清單與路徑。
3. `scripts/audit-monster-portraits.mjs` — 全域自動盤點與缺圖驗證。
4. `release/monster-portrait-batches/*.json` — 每批唯一允許處理的 registry keys。
5. `scripts/audit-monster-portrait-batch.mjs` — 單批 strict gate。

固定流程：

**自動盤點 → 按 batch 生成 → 自動放置 → batch finalize → batch strict audit → 下一批**

批次規則（P2）：

- 禁止一次把所有 `planned` target 當成已完成素材接線；`planned` 不可解析成正式 runtime 立繪。
- 每一批必須先在 `release/monster-portrait-batches/*.json` 列出 `committed`＋`pending` 的 registry `portraitKey`；這個清單就是該批唯一邊界。
- 素材檔真的存在後，才可執行：

```bash
node scripts/finalize-monster-portrait-registry.mjs --batch=release/monster-portrait-batches/<batch>.json
```

- finalize **不得無 batch 執行**，且只會升級該 batch 中「檔案實際存在」的 target；不存在的素材維持 `planned` / `pending`。
- 當該 batch 的 `pending=[]` 且 manifest 為 `COMPLETE` 後，必須執行：

```bash
node scripts/audit-monster-portrait-batch.mjs --strict --batch=release/monster-portrait-batches/<batch>.json
```

- 單批 strict 只要求該批完整；其他尚未製作的 registry `planned` target 可以繼續存在，不得因此把它們硬接或假裝完成。
- 全部批次完成後，才使用全域 `node scripts/audit-monster-portraits.mjs --strict` 作最終總驗收。

重要固定規則：

- Library 母檔保留透明 PNG；正式 runtime 新立繪使用無損 WebP。
- 一般／精英／BOSS 援軍／日常副本全類型／天兵：1024×1536。
- 日常副本 Boss（修行教頭、礦脈統領、金庫總管）也使用 1024×1536，不使用大型 Boss 尺寸。
- 個人 Boss／世界 Boss／四象塔 Boss／深淵帝王：1536×2048。
- 同名普通怪被 roll 成精英時共用同一張立繪。
- 四象天兵只做 fire / water / wind / earth 四張，四象塔與深淵共用。
- 深淵東／南／天／北領域前置關分別用土／火／風／水天兵。
- 真境最終戰五名天兵視覺順序固定：水｜土｜火｜風｜水。
- 極帝領域前置四關目前是 light；未經使用者明確決定，不得自行新增「光天兵」。
- 不得新增第三套 battle portrait wrapper；既有深淵 owner 是 V154，同步時序補丁是 V159，後續導入要收斂而非再疊 patch。
