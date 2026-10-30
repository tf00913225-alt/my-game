# 玩家戰鬥姿勢立繪接入

Work ID: PLAYER-BATTLE-PORTRAITS-20261030
Base dev: 2d6fae07b437e65e0ce3fb027b99135fabc1eb1b
Branch: feature/player-battle-portraits-20261030

目前為盤點 checkpoint；資產轉檔、獨立 QA、接線、CI、dev 部署尚待完成。即時狀態以本工作 PR 為準。

正式接線：`js/00-main.js::getCharacterBattleArtworkPath` 玩家分支、`js/54-v173.51-battle-qa.js::PARTY_ART_DENSITY` 的八位玩家 metadata、`config/first-play-manifest.json` 的八個 P2 圖片預載，以及既有 build 產生的 bundles／manifests。

保留英雄 NPC 專用分支及資產、一般立繪／創角／巡遊 mapping、戰場格位／HUD／動畫／數值與存檔。新增有版本辨識的新檔名，不覆蓋或刪除舊戰鬥 PNG。PNG 母圖保存於 inbox，正式 runtime 使用經 RGBA、尺寸及透明資訊比對的 lossless WebP。

正規化沿用原 `partyPortraitHeight()` 與既有後排光學面積基準，更新新圖片的實際 alpha-area density 與 SHA256；不得為遷就素材另改 UI 或戰鬥公式。最終需獨立檢查八組 mapping、解碼、透明邊緣、畫面縮小辨識、前後排與英雄 NPC 不變。
