# 技能頁暗鐵古銅視覺

Work ID: UI-SKILL-IRON-BRONZE-20261018

使用者核准暗鐵／古銅技能頁 DEMO，於 2026-10-18 授權實作第一個可操作頁面。此階段只處理技能頁及必要的原共用角色視窗外觀，不代表全部功能頁已換裝。

## 呈現及功能

- 共用角色視窗仍是原 Large Panel；三個角色位置、經驗池／能力值／技能入口、返回與借入／歸還同一 DOM 的生命週期保留。各頁籤的框、標題列與角色列幾何相同，只有技能狀態使用新材質。
- 原角色圖由 `getCharacterArtworkPath` 提供，技能圖由 `getSkillIconBackgroundImage` 提供；不以 DEMO 的生成角色替換玩家外觀。
- 四元素頁籤保留原選取狀態，圖案採裝飾性 SVG mask；已裝備技能仍一排四格、點擊原格卸下。技能點移至同一裝備區標題，只保留原 `skillPoints` 節點。
- 原單一技能列表保留名稱、分類、等級、兩行說明及完整詳細入口。學習／升級及裝備按鈕在右側同欄上下排列，所有成本、資格、disabled、滿級與通知點來自原規則，沒有改數值或持久化資料。
- 正式文案、數值、頭像選取及按鈕都是 DOM；美術只提供無文字的框與標題裝飾。小手機依原內容 viewport 捲動，不用縮字塞成概念圖中的固定四列。
- 底部導覽沿原共用視窗生命週期，不在技能視窗內複製第二套導覽；其他頁面與導覽的全面美術尚屬後續階段。

## 控制來源與退場

- `js/00-main.js` 原 `switchCharacterTab` 設定 `data-character-tab` 及標題，原 `closeHomeFeature` 清理；不加 wrapper、observer、timer、viewport 判斷或第二個 renderer。
- `css/49-v169-rpg-ui.css` 是技能內容、角色頭像樣式及技能外框的唯一呈現 Owner。原 `css/00` 技能樣式及 `css/08`、`30`、`31`、`42` 對同責任的覆寫實體移除；其他系統規則保留。
- `characterTabContent` 仍是唯一垂直捲動來源；技能頁與列表使用正常內容高度。共用 Large Panel 幾何及單一 1080×1920 Display Owner 不變。
- 頭像的動態 `background-image` 保留在原 DOM renderer，避免相對 URL 經 CSS 自訂變數解析成 `/build/assets/`。不把資料 URL 交給第二個樣式資料來源。
- `functions/src/generated/restricted-forest-instance-policy.json` 僅由正常 build 同步 `js/00-main.js` 的 source digest；沒有變更後端規則、獎勵或任何 policy 值。

## 新素材

使用內建 imagegen，依使用者核准概念圖生成兩張獨立裝飾；沒有直接使用外部遊戲截圖。母圖保持本機生成位置，正式 WebP 已含完整相同像素，可無損還原。

| Runtime | 尺寸 | 母圖 SHA256 | Runtime SHA256 |
|---|---|---|---|
| `assets/ui/skill-iron-bronze/panel.827d9ba9a6f8.webp` | 1254×1254 | `361b11980df8913e15ad32fe8c055db54b4d3cc3a40f146550de948ddf14185d` | `827d9ba9a6f8d8b990c9b27a9a7c0d400459f19df9c868b0d51af5ebaaa80ba1` |
| `assets/ui/skill-iron-bronze/title-short.bb578519c9f4.webp` | 2079×756 | `7e501593f25d6876800bb548f937402634fcbc76abd8fb3691850884d20a4ffa` | `bb578519c9f421daac11a46c4fc0e50d1482be9f378406d5bf7b2bc9603d620d` |

生成要求：panel 為正面方形暗鐵紋理、古銅直邊與角落龍雲雕飾，中央無文字，供 nine-slice；title 為透明背景橫向龍首與空白古銅銘牌，沒有文字、數字或操作圖案。未使用整張介面截圖作背景。

轉換：Pillow `WEBP lossless=True, exact=True, method=6`；兩張尺寸不變、RGBA 解碼逐位元組相等。Panel alpha 全不透明；title alpha 範圍 0–255，完整保留。圖片版本以內容雜湊命名，正常 build 產生 bundle／manifest 引用，不改正式 Game／Cache Version。

## 驗收

原正式技能 production browser QA 增加：兩素材與原頭像／技能圖完整解碼、技能狀態關閉清理、三個角色頁籤框幾何不變、原單一捲動來源。原四元素、學習／升級／裝備、點數不足、前置／等級限制、滿級及技能詳細測試保留。

舊 source tests 改讀目前 CSS Owner；列表寬度驗證改依實際 grid 同欄上下按鈕計算，仍檢查文字與圖案／兩個按鈕均不重疊、字級與點擊尺寸。跨頁驗收使用既有完整 responsive-item QA，不另建共同 CI 或部署流程。最新 SHA、CI、部署與截圖紀錄以本 Work ID 的 PR 為準。

## 核准標題列修正

Work ID: UI-SKILL-HEADER-BRONZE-20261018。使用者核准短銘牌置中與同材質返回按鈕 DEMO 後實作；只有技能狀態套用，其他頁籤、共用框幾何與原返回事件不變。

長銘牌原先是整條 header 的 72% 背景，文字以獨立左 padding 定位，導致文字偏左且尾端空白。改將短銘牌與原標題文字放在同一個原 span，由 flex 置中於避開左側龍紋的文字區；寬度為原標題列 45%。短銘牌以原比例顯示，不裁切或拉伸圖案。標題及原返回按鈕共用 38 個既有 UI 長度單位，保持原共用 header 行高；返回按鈕以古銅倒角、細框及純裝飾箭頭呈現，原點擊／鍵盤事件不變。未新增 DOM、縮放、JavaScript 或互動來源。

短銘牌以內建 imagegen 依核准圖生成：透明背景、左側小龍浮雕、暗鐵古銅空白書寫區、細金邊、無文字／數字／其他介面。母圖 exec-fe317504-3bf4-4614-b1f0-22b14eb656df.png；正常 lossless/exact WebP 轉換，尺寸與 RGBA 逐位元組相同、alpha 0–255。舊長銘牌已無正式 consumer，隨本修正退役；panel 素材沿用。

既有技能 Browser QA 改從真正標題 span 驗證新圖 decode，並檢查短銘牌、置中與按鈕同高；原技能功能與單一 scroller 契約保留。V169 的框架幾何禁令仍保護 panel／scroll，只將已授權的標題與按鈕元件排除，不允許技能狀態另寫框尺寸。
