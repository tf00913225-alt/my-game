# UI-SKILL-STANDARD-20261020 — 第二施工段（驗收中）

PR #955，Target dev。此 checkpoint 不是全介面完成或畫面批准。

- 沿用技能原九宮格至原 homeFeatureModal；各功能內容排版保留。
- 全 UI 標題分族核對：龍紋牌以原圖30%／60%／10%書寫區排列，底留白4個既有單位校正垂直中心；自動設定六字標題使用整列牌面、原返回另列，保持字級。
- 背包標題與 kicker 群、裝備比較標題群、玩法面板標題群、創角技能詳情標題群在各自標題區置中；沒有全域 h2／transform 補丁。
- 秘寶原樣式避免 border shorthand 清除共用九宮格；詳情原返回位置與 handler 保留，以原 DOM 文字呈現，標題預留返回空間。
- 對稱詳情條、獎勵／預覽、冒險、創角主標題等尚需逐族實圖核對，不能把已置中部分再水平位移。內文項目與閱讀章節標籤不強制置中。

待驗：固定 source 的四 viewport 截圖、實際返回／捲動／長文字及獨立三方複審。初步調整中截圖不作 final evidence；正式證據另標記 Head、source hash、狀態及限制。

## 固定來源複審

Head `4d5c2ac624cd161ff62abd4a11e8ab806cf1a33e`：四尺寸 reading 圖與 source-binding（前後雜湊一致）、四尺寸各17圖／25項控制，保存於 `artifacts/ui-skill-standard/title-final-4d5c2ac6` 與 `title-controls-4d5c2ac6`。代表前後圖另存本目錄 `evidence/UI-SKILL-STANDARD-20261020`，非遊戲素材。

- art_review 實看四尺寸主標題族及技能／自動設定／規則末端：已覆蓋標題置中通過；副本最初遺漏經原 css40 Owner 補修，四尺寸重驗解除。
- interaction_review 實看主標題／返回／help／TAB，未見互蓋；自動設定兩列是長標題配置，末端可達，非要求全部標題同列。
- scope_review 實看393八族前後，無過度重排；真正 PR diff 僅原呈現修正。曾疑商店66→65 SP，三份原scene DOM文字及正式 recoveryValue 均66，屬視覺誤讀，無數值改動。
- 此結論不批准詳情／比較／預覽普通框美術、未覆蓋狀態、真實手機、部署或全遊戲完成。帳號、啟動、隱私及戰鬥等標題族仍未驗。自動設定sticky卡邊緣露字與廣告瘦框線索另列下一段。
