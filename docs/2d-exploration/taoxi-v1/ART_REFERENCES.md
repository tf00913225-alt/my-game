# 桃溪村首版：美術參考與來源

整理日期：2026-10-25（台灣）。這批圖片來自本次與專案負責人的美術討論，供 Codex 查看與製作資產時比對。它們是生成的概念圖，不是遊戲執行截圖、可直接使用的完整關卡、分層場景或人物動作圖。

本目錄只保存規劃文件與閱讀用參考圖，正式 runtime 不得引用這些概念圖。施工規格見 [README.md](README.md)，啟動提示詞見 [CODEX_START.md](CODEX_START.md)。

## 讀圖順序與核准範圍

### 1. 大地圖：已接受美術方向

[開啟 world-map-approved.png](art-reference/world-map-approved.png)

- 使用者答覆：「這個方向符合，保留亮起區域與暗色未開放區域」。
- 採用簡化的地形、樹群、道路與建築表現；已開放桃溪村明亮，未開放地區較暗。
- 這是區域選擇頁，點桃溪村後切換到可走動的村莊。不能把選區頁當作村莊探索場景。
- 圖中暗區數量、地理方位、山林圖形、道路及村莊圖示是示意，不是已定案的世界區域數量或桃溪村五間民宅平面圖。首版只交付桃溪村。
- 圖中文字、返回鍵及狀態標籤是概念示意；實作時由正式 UI 呈現，不能烘焙進背景。

### 2. 民宅室內：已接受美術方向

[開啟 interior-approved.png](art-reference/interior-approved.png)

- 使用者答覆：「整體接近，沿用這個室內美術方向」。
- 暖色木造房間、清楚輪廓、柔和上色；家具靠牆，中央保留容易辨認的活動空間，細節簡潔。
- 此圖為縮小右側箱子後的版本。五間民宅共用美術規格，但仍需要可辨識的格局或擺設差異。
- 圖中人物只示範稍微 Q 版的方向；不是八款人物全部動作已完成，也不鎖定其像素大小。角色視野與手機可讀性應在真實運行畫面核對。
- 搖桿、搜尋按鈕、出口標示與人物必須獨立實作；場景應有對應的碰撞、互動位置及遮擋資料。

### 3. 簡化村莊：環境參考，未單獨最終核准

[開啟 village-simplified-reference.png](art-reference/village-simplified-reference.png)

- 使用者曾表示前一版「畫風接近，但景物與地面的細節太多，希望簡潔一些」；此圖是據此減少細節的後續參考。
- 參考乾淨道路、較少碎石花草、較簡單屋頂與樹葉塊面，避免重新堆滿地面裝飾。
- 此圖未取得單獨的最終核准；圖中的偏高人物比例不能覆蓋已選定的「稍微 Q 版」。它也不是完整五間民宅的關卡配置。

## 八款創角立繪是人物畫風與身分來源

已核對基準 dev：`3a9283467b0b663af7314993da6066e2e223c971`。沿用 repository 內的原檔，不另外複製八份：

- `assets/characters/player_male_01.webp`
- `assets/characters/player_male_02.webp`
- `assets/characters/player_male_03.webp`
- `assets/characters/player_male_04.webp`
- `assets/characters/player_female_01.webp`
- `assets/characters/player_female_02.webp`
- `assets/characters/player_female_03.webp`
- `assets/characters/player_female_04.webp`

創角對應來源：`js/24-v125-character-creation-native-runtime.js`；核對歷史：[PR #986](https://github.com/tf00913225-alt/my-game/pull/986)。施工時再次確認即時的創角對應，不能只按性別任意替換。

美術方向是精緻 2D 武俠手繪插畫、清楚描線、偏動畫造型與柔和有層次的上色。探索人物稍微 Q 版，頭略大、手腳自然、保留俠客感；保留各款髮型、衣色、服裝與配件辨識。原立繪本身不是行走 sprite，也不是 Q 版比例標準。

## Codex 必須實際看到圖片

取得上述檔案後，使用環境可用的圖片檢視工具開啟，而非只列檔名或讀取二進位內容。先簡述三個具體視覺觀察，證明已查看；無法讀圖時明確列出缺少的能力或檔案，請使用者把所需圖片附到該次任務，不可聲稱已看過。

OpenAI 官方圖片輸入說明：[Image inputs](https://developers.openai.com/codex/image-inputs)。CLI 可使用 `codex --image <圖片路徑>` 提供視覺參考；圖片仍須搭配規格說明。此文件不假設另一個 Codex 對話自動持有本次聊天附件或暫存路徑。

## 檔案完整性

三張原始 PNG 逐位元複製，未裁切、縮放、調色或轉檔。本次已確認可解碼與下列尺寸；這不代表正式素材導入或遊戲 QA 通過。尺寸近似直式，實作顯示規格仍以共用 1080×1920、9:16 畫布為準。

### world-map-approved.png

- 來源檔名：`exec-45f7c531-3555-40ee-88ca-b3d71c5a54bf.png`
- 尺寸：941×1672；RGB；2,618,973 bytes。
- SHA-256：`798df47eef81c13daa15f6d390c4efd01843d5a7e5924ccdc41ecb5e9695e3ad`
- Git blob SHA-1：`de514b36b182da2735005161bb17e8cabf768b87`

### interior-approved.png

- 來源檔名：`exec-a5e816c5-f1ad-49cd-85bf-138c4079c3ba.png`
- 尺寸：941×1672；RGB；2,009,696 bytes。
- SHA-256：`ce3ca2e1a558953b00f4395da5e4059fed458e24b15e852cbb0ff4541e384f6e`
- Git blob SHA-1：`804aae32dc9f93e50f15d52a27c8410c1bc34e6d`

### village-simplified-reference.png

- 來源檔名：`exec-540c8456-f6ce-4e17-86fa-fa4235045e33.png`
- 尺寸：941×1671；RGB；3,189,677 bytes。
- SHA-256：`dc48ad05f161d553df7c66f6defe2f61717cbb5af0d0bed171f2d4676edbe9b2`
- Git blob SHA-1：`b9ca01ba9750c8276f3bb331ad4c46aa9e503178`

## 轉為正式素材時

依 repository 既有 [圖片導入規範](../../IMAGE_ASSET_SPEC.md) 與 [inbox 說明](../../../assets/inbox/README.md) 處理新製作或整理後的素材。需要另外交付地面、建物／遮擋層、室內物件、八款人物動作及相關資料；概念圖中已畫上的角色與 UI 不能保留在正式場景底圖。

正式新點陣資產使用已驗證的無損 WebP，保持所選來源資產的尺寸、Alpha、幀排列及畫布；不能把重繪或裁切偽稱為單純無損轉檔。互動文字由正式 UI 呈現。驗收提供實際運行截圖與可重現步驟，並與這些美術參考分開標示。
