# 玩家戰鬥姿勢立繪接入

Work ID: PLAYER-BATTLE-PORTRAITS-20261030
Base dev: 2d6fae07b437e65e0ce3fb027b99135fabc1eb1b
Branch: feature/player-battle-portraits-20261030

八張候選已由使用者採用，並完成資產獨立透明／小圖辨識審查、無損轉檔、最小接線與 focused checks；實際戰鬥畫面獨立 QA、最新 Head CI 與 dev 部署仍待完成。即時狀態以 PR #1026 為準。

正式接線：`js/00-main.js::getCharacterBattleArtworkPath` 玩家分支、`js/54-v173.51-battle-qa.js::PARTY_ART_DENSITY` 的八位玩家 metadata、`config/first-play-manifest.json` 的八個 P2 圖片預載，以及既有 build 產生的 bundles／manifests。

保留英雄 NPC 專用分支及資產、一般立繪／創角／巡遊 mapping、戰場格位／HUD／動畫／數值與存檔。新增有版本辨識的新檔名，不覆蓋或刪除舊戰鬥 PNG。PNG 母圖保存於 inbox，正式 runtime 使用經 RGBA、尺寸及透明資訊比對的 lossless WebP。

正規化沿用原 `partyPortraitHeight()` 與既有後排光學面積基準，更新新圖片的實際 alpha-area density 與 SHA256；不得為遷就素材另改 UI 或戰鬥公式。最終需獨立檢查八組 mapping、解碼、透明邊緣、畫面縮小辨識、前後排與英雄 NPC 不變。

技術證據見同目錄 `PLAYER-BATTLE-PORTRAITS-20261030-assets.json` 與 `PLAYER-BATTLE-PORTRAITS-20261030-optical.json`。八張 PNG／WebP 均維持 1024×1536，RGBA 逐像素完全一致；WebP 共 11,061,240 bytes。光學密度沿原逐像素 `area += alpha/255; density=area/height²`，原 reference `.520696867047023`、兩位英雄 metadata 與公式均不變；新構圖自然得到 119.091%～151.075% paint height，舊 PNG 的 <111.2% 測試範圍改為逐資產實測值驗證，實際畫面仍需 QA 驗證武器／鄰角與裁切。

必要 build 連帶更新 restricted-forest-instance policy 的 `js/00-main.js` source digest 一行；該檔政策／數值沒有改動。已通過 build、build --check、battle mapping、一般／創角隔離、光學面積、Hero phase2a 及 cardless presentation focused tests。
