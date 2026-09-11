# 《四象江湖傳》怪物立繪生成規格書 v1

> 本文件是「怪物／精英／BOSS／深淵／天兵天將立繪」的專項規格來源。一般 UI、字級、觸控與版面仍以 `UI_GUIDELINES.md` 為準；架構 owner 與 patch 收斂仍以 `ARCHITECTURE_RULES.md` 為準。
>
> 機器可讀清單：`config/monster-portrait-registry.json`
>
> 自動盤點：`node scripts/audit-monster-portraits.mjs`

## 1. 目標與工作流

正式工作流固定為：

**自動盤點 → 自動生成 → 自動放置 → 自動接線 → 驗證**

只有同時滿足以下條件，才可把一隻怪物標示為「立繪完成」：

1. runtime 確實存在該怪物或該怪物變體。
2. 註冊表有唯一 `portraitKey` 或明確的元素解析規則。
3. 素材檔實際存在於註冊路徑。
4. 圖片符合尺寸、透明背景與構圖規格。
5. runtime 真正使用的 owner 有接到該素材，而不是只把圖丟進 assets。
6. 首次載入與戰鬥重繪後都不破圖。
7. 相關測試／Repository checks 通過。

不得用「檔案存在」代替「runtime 已接線」，也不得用「CI 綠燈」代替「實際立繪顯示正確」。

## 2. 權威識別方式

### 2.1 不以中文名稱猜檔名

runtime 不得把怪物中文名稱直接轉成檔名，也不得靠「王／皇／帝」字尾猜素材。正式識別優先順序：

1. 明確 `portraitKey` / portrait metadata。
2. 已有正式系統 ID（例如 `personal-20`、`world-80`、塔 BOSS 類型）。
3. 已在 `config/monster-portrait-registry.json` 登記的固定映射。
4. 天兵天將使用 `element` 做四象解析。

### 2.2 普通／精英共圖

同一怪物名稱被 `v141BattleRank` 隨機升為精英時，**仍使用同一張人物立繪**。精英差異由遊戲既有 rank UI、框線、標籤、光效處理，不重複生成第二張。

只有使用者明確指定「精英外觀不同」時，才建立新的 `portraitKey`。

## 3. 圖片尺寸與格式

### 3.1 一般怪／精英／BOSS 援軍／日常副本普通與精英／天兵天將

- 母檔：**1024 × 1536 px**
- 比例：**2:3**
- 格式：**PNG**
- 背景：**透明 Alpha**
- 本體可視高度：**78%～85%**

### 3.2 個人 BOSS／世界 BOSS／四象塔 BOSS／深淵帝王／日常副本 BOSS

- 母檔：**1536 × 2048 px**
- 比例：**3:4**
- 格式：**PNG**
- 背景：**透明 Alpha**
- 本體可視高度：**85%～92%**

### 3.3 既有已核准素材

既有深淵五帝透明 WebP 不因本規格強制重製。`assets/dungeons/abyss/*.webp` 可繼續作為 grandfathered approved assets。

新生成的母檔一律先保留透明 PNG；正式 build 若為效能產生 WebP derivative 可以接受，但不得只保留壓縮 derivative 而丟失母檔。

## 4. 構圖統一規範

所有新怪物立繪固定：

- 武俠／東方玄幻 RPG 美術語言，與《四象江湖傳》既有美術一致。
- 單一主體，直式構圖，全身或接近全身。
- 預設 3/4 視角；避免證件照式完全正面，也避免過度側身導致辨識度不足。
- 無文字、無 UI、無邊框、無卡框、無場景背景。
- 頭飾、武器尖端、翅膀、尾巴、披風等重要輪廓不得被裁掉。
- 元素特徵要可辨識，但不得把整隻角色單純染成單色。
- 普通怪保持清楚輪廓；BOSS 可增加法器、甲冑、披風、元素能量與氣場，但不能用「普通怪放大」冒充 BOSS。

安全區：

- 上：6%～8%
- 下：6%～10%
- 左：5%～8%
- 右：5%～8%

## 5. 命名與路徑

### 5.1 檔名規則

- 英文小寫。
- kebab-case。
- 不使用空白、中文、括號、版本日期作為正式語意檔名。
- 不覆蓋其他用途既有素材。
- 路徑以 `config/monster-portrait-registry.json` 為準。

### 5.2 新素材根目錄

```text
assets/monsters/
├─ wild/                 # 十區野怪
├─ daily/                # 日常副本
├─ boss/
│  ├─ personal/          # 個人 BOSS
│  └─ world/             # 世界 BOSS
├─ boss-support/         # BOSS 精英援軍
├─ tower/
│  └─ boss/              # 四象塔 BOSS
└─ soldiers/             # 四象天兵天將共用素材
```

既有深淵帝王素材保留：

```text
assets/dungeons/abyss/
```

### 5.3 路徑例

```text
assets/monsters/wild/zone-01/fire-01.png
assets/monsters/daily/exp/regular.png
assets/monsters/boss/personal/personal-20.png
assets/monsters/boss/world/world-100.png
assets/monsters/boss-support/water-01.png
assets/monsters/tower/boss/fire-envoy.png
assets/monsters/soldiers/heavenly-soldier-earth.png
```

## 6. 類型規範

### 6.1 普通野怪

- 一個唯一 runtime 名稱對應一個 `portraitKey`。
- 同區重複出現的同名怪只生成一次。
- 被 10% 精英 roll 升為精英時不另生成。
- 十區風／土追加怪同樣納入正式清單，不視為臨時資料。

### 6.2 日常副本

目前正式名稱：

- 經驗：修行弟子／修行精英／修行教頭
- 材料：礦脈守衛／礦脈精英／礦脈統領
- 金幣：金庫守衛／金庫精英／金庫總管

同名稱在不同波次／不同元素位置仍共用同一張立繪。教頭／統領／總管使用 BOSS 尺寸級別。

### 6.3 個人／世界 BOSS

- 每一個正式 BOSS 定義皆建立獨立立繪。
- 不與普通野怪共圖。
- 不以名稱後綴判定檔名，使用系統 ID 作路徑 key。
- BOSS 援軍使用自己的 1024×1536 圖，不共用 BOSS 本體圖。

### 6.4 四象塔 BOSS

低階「鎮塔使」與高階「鎮天尊」是兩個不同 portrait target；火／水／風／土各自獨立，共 8 個 BOSS target。

### 6.5 天兵天將

四象塔與深淵共用同一組 **4 張**：

```text
fire  -> assets/monsters/soldiers/heavenly-soldier-fire.png
water -> assets/monsters/soldiers/heavenly-soldier-water.png
wind  -> assets/monsters/soldiers/heavenly-soldier-wind.png
earth -> assets/monsters/soldiers/heavenly-soldier-earth.png
```

普通／精英天兵共圖，**圖片由 `monster.element` 決定，而不是由「天兵天將」名稱決定**。

舊檔：

```text
assets/dungeons/abyss/soldier.webp
assets/dungeons/abyss/floor5-soldier.webp
```

只視為 legacy fallback；四象天兵正式導入後不得繼續作為所有元素共用的最終方案。

## 7. 深淵專項規則

目前 `js/59-abyss-two-tier-runtime.js` 的正式領域元素：

| 領域 | 元素 | 前置四關天兵正式圖 |
|---|---|---|
| 東帝領域 | earth / 土 | 土天兵 |
| 南帝領域 | fire / 火 | 火天兵 |
| 天帝領域 | wind / 風 | 風天兵 |
| 北帝領域 | water / 水 | 水天兵 |
| 極帝領域 | light / 光 | **未定，不得自行發明第五張光天兵** |

前置關普通／精英天兵一律按該領域元素取四象天兵圖。

### 7.1 真境最終戰固定後排視覺元素

使用者指定順序固定為：

**水｜土｜火｜風｜水**

因此最終五名天兵不可全部吃 `light` 圖，也不可全部使用同一張 `floor5-soldier.webp`。未來 runtime 接線時，應為每一名最終天兵寫入明確 portrait element / portrait key，而不是改變其戰鬥元素規則來達成顯示。

### 7.2 極帝前置四關

目前 runtime 元素是 `light`，但本規格沒有授權新增第五張光天兵。直到使用者明確決定前：

- 不生成 `light` soldier。
- 不擅自把極帝前置關改成任一單一四象元素。
- audit 應把這件事列為「已知未決規則」，不是假裝已完成。

## 8. 現有 runtime owner 與未來收斂規則

目前深淵立繪同步 owner：

- `js/45-v154-dev-fixes.js`
  - `syncAbyssPortraits()`
  - `window.v154SyncAbyssPortraits`
  - 目前仍含 `EARLY_ABYSS_PORTRAITS` / `FINAL_ABYSS_PORTRAITS`
- `js/48-v159-abyss-battle-portraits.js`
  - 是後續載入時序補丁，重新呼叫 V154 同步入口。

**禁止再建立第三套 `renderBattle()`／`updateUI()` portrait wrapper。**

四象天兵與全怪物立繪實際導入時，應把 resolver 收斂成單一正式 owner，然後讓 V154/V159 的舊映射／補丁退場或只保留相容橋接；不得讓「舊 abyss map + 新全域 map + 新 wrapper」三套邏輯長期並存。

## 9. 自動生成最小輸入

生成器對每個 target 至少取得：

- `portraitKey`
- 怪物中文名稱
- 類型：普通／精英／BOSS／援軍／天兵
- 元素
- 出現區域／副本
- `sizeClass`
- 目標 path

生成 prompt 必須包含：

- 《四象江湖傳》武俠東方玄幻 RPG 遊戲立繪
- 對應怪物名稱與元素語意
- 全身／近全身、3/4 視角
- 透明背景
- 無文字、無邊框、無 UI
- 指定安全邊界與本體佔比
- BOSS 額外要求更高辨識度、威壓、裝備與氣場

不得因為名稱像某個現成 IP 角色就模仿該 IP 的特定造型。

## 10. 自動盤點／驗證標準

執行：

```bash
node scripts/audit-monster-portraits.mjs
```

正式檢查至少要包含：

- runtime 怪物名稱是否全部出現在 registry。
- registry 是否有重複 `portraitKey`。
- registry 是否有重複目標 path。
- `status=existing` 的素材是否真的存在。
- `status=planned` 的缺圖數量。
- 四象天兵是否恰好是 fire / water / wind / earth 四張。
- 深淵領域與最終戰規則是否仍符合本文件。

所有預定素材完成後才使用：

```bash
node scripts/audit-monster-portraits.mjs --strict
```

`--strict` 模式下，任何 planned 檔案尚不存在都必須失敗。

## 11. 圖片實裝驗證

每一批素材接線後最小必要驗證：

1. 靜態檔案存在且可解碼。
2. PNG 有 alpha channel。
3. 寬高符合該 `sizeClass`。
4. 首次進戰鬥就能看到，不依賴第二次重繪。
5. 戰鬥重繪／換波／副本換層後仍正確。
6. 一般怪、精英、BOSS 不互相拿錯圖。
7. 天兵依 element 取圖。
8. 深淵真境最終後排視覺順序仍是水｜土｜火｜風｜水。
9. 不產生 404、破圖、Console 新錯誤。

## 12. 修改本規格的同步要求

任何新增／刪除／改名怪物，只要影響立繪，都必須同步：

1. runtime 正式資料。
2. `config/monster-portrait-registry.json`。
3. 本規格（若規則本身改變）。
4. 相關 audit／測試。

若只新增一隻怪，不得因此重寫整套 portrait runtime；新增 registry target 與必要素材即可。

---

### v1 基準

本版規格以工作分支建立時的最新 `dev`：`845d5b011352d09763a7f1d5560487ffaba65bfa` 為基準。

本次先建立**規格、註冊表與自動盤點基礎**；尚未生成的圖片不得先接到正式 runtime，以免用不存在的路徑造成破圖。實際圖片生成／放置／接線會在素材存在後依同一份 registry 往下完成。