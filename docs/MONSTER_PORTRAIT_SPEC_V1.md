# 《四象江湖傳》怪物立繪生成規格書 v1

> 本文件是「怪物／精英／BOSS／深淵／天兵天將立繪」的專項規格來源。一般 UI、字級、觸控與版面仍以 `UI_GUIDELINES.md` 為準；架構 owner 與 patch 收斂仍以 `ARCHITECTURE_RULES.md` 為準。
>
> 機器可讀清單：`config/monster-portrait-registry.json`
>
> 自動盤點：`node scripts/audit-monster-portraits.mjs`

## 0. Boss 術語（唯一正式 Owner）

- **大 Boss**：僅指世界 Boss、個人 Boss。
- **小 Boss**：深淵等一般首領，例如五帝天尊；四象塔與日常副本首領也屬此語意。
- 大／小是立繪／資產分類的溝通術語，不表示戰力、難度、稀有度、劇情地位、掉落或玩法階級。尺寸語意重要時，需求、PR、文件與回報不得只寫模糊的「Boss」。玩家介面可保留「世界 Boss／個人 Boss／深淵首領」等玩法名稱，不因統稱而強制更改既有文案。
- `World Boss`、`Personal Boss`、`Abyss Boss` 作為玩法／規格名稱仍有效；內部 identifier、Battle Mode、Registry key、rank、sizeClass 與 legacy 路徑不得因中文統稱自動改名。Monster Balance 的 `smallBoss`／`boss` rank 與 `personalBoss`／`worldBoss` mode 仍依其正式資料契約，不能以文字替換改資料。
- 術語不自動指定尺寸或 footprint（戰場佔位）。深淵五帝仍保留第 3.2／3.3 節的既有尺寸與已核准素材，不因改稱小 Boss 自動 resize 或重製。四象塔小 Boss 仍是 standard 單格；個人／世界大 Boss 的中央六格、援軍與功能物件規則仍由 `SYSTEM_CONTRACTS.md` 及正式 Battle Owner 管理。

## 1. 目標與工作流

正式工作流分成三條，依素材目前狀態選最短路徑：

- **素材尚未生成**：自動盤點 → 自動生成 Master PNG → 放入 `assets-library` 正式 Master 路徑。
- **Master PNG 已生成並核准，且 Registry target 已存在**：優先執行 `portrait:finalize-master`；同一個 scoped transaction（限定範圍交易）完成 WebP、Provenance（來源追溯）、Registry 升級與 Runtime／Audit／Permanent Gate 驗證。
- **正式 Runtime WebP 已經生成並核准**：使用 `portrait:import` 快速導入，不重新生成圖片。

已生成素材不得因舊 batch 流程重做生成；尚未生成素材也不得用快速導入假裝完成。歷史 batch 工具只保留相容用途，不再是新素材的優先正式路徑。

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

### 3.1 一般怪／精英／BOSS 援軍／日常副本全類型／天兵天將

- Library 母檔：**1024 × 1536 px 透明 PNG**。
- 正式 runtime 資產：**1024 × 1536 px 無損 WebP**。
- 比例：**2:3**。
- 本體可視高度：**78%～85%**。

日常副本的 `regular`、`elite`、`boss` 三種階級全部使用此尺寸；日常副本
Boss（修行教頭、礦脈統領、金庫總管）不得套用大型 Boss 尺寸，也不得為了
符合舊規則放大、重製或 resize。

四象塔 Boss 雖然 gameplay `rank="boss"`，視覺規格固定為 Small Boss：
`sizeClass="standard"`，使用 **1024 × 1536、2:3**。戰鬥階級與立繪尺寸
是兩個獨立語意，不得因 `rank="boss"` 自動升級成大型 Boss 尺寸。

### 3.2 個人 BOSS／世界 BOSS／深淵帝王

- Library 母檔：**1536 × 2048 px 透明 PNG**。
- 正式 runtime 資產：**1536 × 2048 px 無損 WebP**。
- 比例：**3:4**。
- 本體可視高度：**85%～92%**

### 3.3 既有已核准素材

既有深淵五帝透明 WebP 不因本規格強制重製。`assets/dungeons/abyss/*.webp` 可繼續作為 grandfathered approved assets。

新生成的母檔一律先保留透明 PNG；正式 runtime 必須使用完成尺寸、Alpha 與無損驗證的 WebP，
但不得只保留 runtime derivative 而丟失母檔。

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
assets/monsters/wild/zone-01/fire-01.webp
assets/monsters/daily/exp/regular.webp
assets/monsters/boss/personal/personal-20.webp
assets/monsters/boss/world/world-100.webp
assets/monsters/boss-support/water-01.webp
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

同名稱在不同波次／不同元素位置仍共用同一張立繪。三個日常副本 Boss
（教頭／統領／總管）與一般怪、精英一樣使用 **1024 × 1536** 標準尺寸，
正式 runtime 使用無損 WebP。

### 6.3 個人／世界 BOSS

- 每一個正式 BOSS 定義皆建立獨立立繪。
- 不與普通野怪共圖。
- 不以名稱後綴判定檔名，使用系統 ID 作路徑 key。
- BOSS 援軍使用自己的 1024×1536 圖，不共用 BOSS 本體圖。

### 6.4 四象塔 BOSS

低階「鎮塔使」與高階「鎮天尊」是兩個不同 portrait target；火／水／風／土各自獨立，共 8 個 BOSS target。

四象塔 BOSS 固定為 Small Boss 視覺契約：`rank="boss"`、`sizeClass="standard"`，
正式 runtime 使用 **1024 × 1536、2:3** 透明無損 WebP。不得使用個人／世界 Boss
的 1536 × 2048 Large Boss 視覺尺寸，也不得使用中央六格 Boss footprint。

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

## 8. Runtime 與 Portrait Visual Scale Contract

選圖唯一 Owner 是 `js/45-v154-dev-fixes.js`。所有玩法共用明確 portraitKey → Registry identity → 已登記唯一名稱相容映射；明確 key 缺圖時不得改用另一個名稱或元素。四象天兵只在正式天兵身份且無其他明確 key 時按元素解析。极帝 light 天兵保留 Registry policy 指定的 legacy 圖，不能作一般怪 fallback。未完成素材維持 planned，通用 fallback 是無圖片的中性幾何標記，不冒用天兵、其他元素怪或 Boss。DEV／Test 可由 record.fallbackReason 與 DOM data-portrait-fallback 觀察。

V159 已退休；舊 EARLY_ABYSS_PORTRAITS／FINAL_ABYSS_PORTRAITS 與 temporary 天兵／火魔替代圖已退場，不再建立 wrapper、Timer 或 Observer。

呈現唯一 Owner 是 `js/54-v173.51-battle-qa.js` 的 V174；Slot／HUD 幾何仍由原 Fixed Slot Owner 控制。Registry `presentation` 是唯一離線尺寸資料來源，與資產 canvas sizeClass 分離：

| 視覺 class | 非透明主體目標高度／paint slot | 底部基準／paint slot |
|---|---|---|
| STANDARD | 82% | 96% |
| ELITE | 85% | 96% |
| SMALL_BOSS | 88% | 96% |
| BIG_BOSS | 90% | 96% |

個人／世界 Boss 使用其正式中央 footprint；深淵、塔與日常首領仍依原玩法 Slot。資產 standard／boss canvas 不因此改名或重製。

`scripts/measure-monster-portraits.mjs --write` 在 Import／Audit 階段計算完整 nonzero Alpha Bounding Box（含武器、角、翅膀、尾巴及透明特效），寫入像素範圍、canvas dimensions 與 SHA-256。此範圍是完整可見輪廓，不宣稱可以自動區分核心身體與武器。Runtime 不讀像素；以等比例 contain 投影完整畫布，將 Alpha bottom 對齊 baseline。寬型輪廓以完整不裁切優先，按可用寬度縮小，QA 記錄 widthLimited；不得以 crop 或每張 CSS magic number 強制同高。Bounds 不改 Master、Runtime 圖像或 Provenance bytes。

正式 CSS Owner 為 `css/fixed-slot-battlefield-rendering-v2.css`。`--portrait-width` 由 class、Bounds 與容器單位投影，不使用 transform:scale。更換資產後必須更新 metadata；`--check` 重新解碼核對，Registry Audit 與 regression 拒絕 stale hash、缺檔、非法 Bounds、planned 冒充 existing。首次準備、重繪、重入均由原 lifecycle 同步。

## 8.1 Reusable Shared NPC Portrait Assets

共用人物素材唯一建檔 Owner 仍是 `config/monster-portrait-registry.json` 的 `assetPool.entries`；本節是其唯一正式治理規則來源，不另建 NPC Registry。

- `NPC_SHARED_XXX` 是永久素材身分，與 Content 的 NPC／敵人名稱、元素、階級、數值、門派、劇情、技能、掉落及 AI 分離；這些 Gameplay 欄位不得寫入 shared-npc entry。`displayName` 僅描述外觀。
- ID 建立後不得重新編號、重新分配或回收；退休保留 row。新增只在歷史最大序號後追加。相同 SHA-256 母檔不得配置第二個永久素材 ID；重複來源只能追溯至原 ID。
- `assetClass="shared-npc"` 預設 `reusePolicy="reusable"`、`exclusive=false`。只有使用者明確授權專屬角色時才能設 `exclusive=true`／`reusePolicy="exclusive"`，並在 notes 記錄授權。allowedContexts 是許可場合，不是現有角色綁定。
- 未使用維持既有 `reserved`；不得產生 runtimePath、加入 groups、Encounter、Rotation 或 Runtime manifest。sourceBranch／sourcePath／sourceCommit／sourceSha256 與 sourceImage 保留母檔 bytes、實際尺寸、解碼及透明驗證。sizeClass 是未來 derivative 畫布規格，不表示母檔已縮放；inbox Master 不刪除、不覆寫、不裁切。
- 正式採用須另由 Content Owner 明確指定既有等價 `portraitKey: "NPC_SHARED_003"`；多個 Content 可引用同一 ID，不複製圖片，角色名稱及屬性由各 Content 自己擁有。usedIn／references 若存在只供查詢，不是角色身分 Owner。
- 採用時依 `docs/IMAGE_ASSET_SPEC.md` 與既有 Selective Import Gate 建立唯一透明無損 WebP derivative，再記錄 runtimePath／presentation 並升 `adopted`。本次建檔不決定正式 Runtime 路徑；既有 importer 的 assets/monsters 範圍不得為保留素材繞過。
- V154 僅接受 adopted＋runtimePath 且明確 portraitKey 的共用圖；不建立 displayName 映射、不按名稱／檔名／性別／武器／元素猜圖、不覆寫 Content 名稱。不存在、reserved、未建立 derivative 或 decode 失敗時沿用中性 fallback，不任選共用圖。
- Audit 檢查唯一 ID／來源／SHA、不可回收的歷史 ID、純素材欄位與 reserved 隔離；Runtime regression 同時保護既有 Monster 與共用素材的 explicit binding。

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

## 9.1 已生成素材的正式快速導入

若已核准的是 **Master PNG**，且該怪物已存在於 Registry，優先使用：

```bash
npm run portrait:finalize-master -- \
  --master-root=/absolute/path/to/assets-library \
  --master-commit=<assets-library full SHA> \
  --keys=<portraitKey,portraitKey,...>
```

此流程會依 `sizeClass` 自動選擇 1024×1536 或 1536×2048，建立／更新 Provenance、產生無損 WebP、把 Registry 升成 `existing`，並執行 Runtime contract、portrait audit 與 Permanent Image Asset Gate。任一後置驗證失敗時必須回滾，不得留下半完成狀態。

若圖片已經完成生成、核准、無損 WebP 轉檔，並已放到 registry 指定的正式 `assets/monsters/` 路徑，後續正式接線改由：

```bash
npm run portrait:import -- --keys=<portraitKey,portraitKey,...>
```

處理。此流程不需要另外建立 batch manifest，也不需要再次執行生成／裁切。

固定安全限制：

- 必須明確指定 `--keys` 或 `--group`，禁止無範圍全量升級。
- 目標必須位於 registry 已定義的 `assets/monsters/`；若舊 registry path 是 `.png/.jpg/.jpeg`，同 stem 的正式 `.webp` 已存在時可由工具自動收斂路徑。
- 工具必須檢查解碼、sizeClass 尺寸、Alpha channel 與實際透明像素。
- `planned` 通過後可升為 `existing`。
- `retired` 不得默默復活；只有專案負責人明確要求重新啟用時才可使用 `--reactivate-retired`。
- 日常副本必須保留明確 `portraitKey` runtime 接線；若 owner 契約或 runtime regression test 失敗，工具必須停止，不得只因檔案存在就宣稱導入成功。
- 此快速流程沿用 V154 Resolver／V174 Presentation；V159 已退休，不得新增 portrait wrapper。

尚未生成的素材仍使用既有 batch 流程；兩者用途不同。

## 10. 自動盤點／驗證標準

執行：

```bash
node scripts/audit-monster-portraits.mjs
```

正式檢查至少要包含：

- runtime 怪物名稱是否全部出現在 registry。
- registry 是否有重複 `portraitKey`。
- registry 是否有重複目標 path。
- `status=existing` 的素材是否真的存在，且新正式 runtime 立繪為 WebP。
- `status=planned` 的缺圖數量。
- `status=retired` 的永久停用 target 不列入待辦、批次 committed/pending 或素材解碼稽核；保留 registry row 僅供歷史識別與 runtime 名稱對帳，除非使用者明確重新授權，不得重新排程、生成或導入。
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
2. WebP 可正常解碼並有 alpha channel。
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
