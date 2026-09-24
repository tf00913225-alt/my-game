# 《四象江湖傳》怪物立繪工作入口

凡涉及怪物、精英、BOSS、深淵帝王、BOSS 援軍、日常副本敵人或天兵天將的立繪生成／導入／接線，請先讀：

1. `docs/MONSTER_PORTRAIT_SPEC_V1.md` — 人類可讀正式規格。
2. `config/monster-portrait-registry.json` — 機器可讀目標清單與路徑。
3. `scripts/import-monster-portraits.mjs` — 已生成素材的正式快速導入 owner。
4. `scripts/audit-monster-portraits.mjs` — 全域自動盤點與缺圖驗證。
5. `release/monster-portrait-batches/*.json` — 尚未生成素材的 batch 邊界。
6. `scripts/audit-monster-portrait-batch.mjs` — 單批 strict gate。

固定流程分成兩條，禁止混用：

### A. 已生成素材快速導入（預設）

當核准素材已經完成 WebP 轉檔，且已放到 `config/monster-portrait-registry.json` 指定的正式路徑時，**不再要求建立 batch manifest 或重跑生成流程**。

直接使用：

```bash
npm run portrait:import -- --keys=<portraitKey,portraitKey,...>
```

也可針對單一 registry group：

```bash
npm run portrait:import -- --group=daily --dry-run
```

工具固定負責：

- 驗證選取範圍，禁止無 scope 全量升級。
- 正式目標限定在 `assets/monsters/`；若舊 Registry 仍是 `.png/.jpg/.jpeg`，但同 stem 的核准 `.webp` 已存在，工具會自動把 Registry 路徑收斂成 `.webp`。
- 驗證 WebP 可解碼、尺寸符合 sizeClass、保留 Alpha 且真的有透明像素。
- `planned` 素材通過後直接升為 `existing`。
- `retired` 預設拒絕；只有已明確授權重新啟用的 target 才可加 `--reactivate-retired`。
- 日常副本必須仍由 runtime 寫入明確 `portraitKey`。
- 匯入前必須跑既有 `tests/monster-portrait-runtime.test.js`，確認 V154 owner／V159 同步契約沒有漂移。
- 更新 registry snapshot 時，`retired` 不得被誤算成 `planned`。

這條快速流程只處理「素材已生成、已核准、已落正式路徑」的導入；**不得重新生成、裁切、改圖或自行從中文檔名猜對應關係**。

### B. 尚未生成素材的批次流程

只有素材尚未完成時，才走：

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
- 四象塔 Boss：gameplay rank 仍為 boss，但 sizeClass 固定 standard，使用 1024×1536 Small Boss 規格。
- 個人 Boss／世界 Boss／深淵帝王：1536×2048。
- 同名普通怪被 roll 成精英時共用同一張立繪。
- 四象天兵只做 fire / water / wind / earth 四張，四象塔與深淵共用。
- 深淵東／南／天／北領域前置關分別用土／火／風／水天兵。
- 真境最終戰五名天兵視覺順序固定：水｜土｜火｜風｜水。
- 極帝領域前置四關目前是 light；未經使用者明確決定，不得自行新增「光天兵」。
- 不得新增第三套 battle portrait wrapper；既有深淵 owner 是 V154，同步時序補丁是 V159，後續導入要收斂而非再疊 patch。
