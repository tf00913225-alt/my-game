# 第六段：分類選中、數量區、任務獎勵文字

Work ID：UI-SKILL-STANDARD-20261020；PR #955；從暫停 checkpoint `2fa326580bdf09095e2e515d95e818d3fed7fe56` 恢復，沿用原施工線。production source 為 `a0d8d30779f5e48648a9bd4649a12876d4b3dfef`，暫停 checkpoint 僅保存文件及證據。

## 實際驗證

- before：segment6-before-cff3ee03/resolved4，360／393 各17圖。早期準備失敗及暫停時 after-unapproved 不作批准依據。
- after：artifacts/ui-skill-standard/segment6-resumed-2fa32658，360x640／393x873／412x915／1280x800 各28圖，report 綁定 Head、source 及實際載入 bundle hash，前後不變、clean。
- 秘寶八分類先向右、再向左真觸控，每次選中項均在分類列可視範圍。使用原列表 render 後定位 active，沒有修改分類／裝備／進度規則。
- 任務以正式 #questTabBody 真捲至末端（2597+512=3109）；鎖定獎勵文字可讀，保留箱圖狀態與領取規則。未領獎。
- 符咒使用隔離 stock3702／gold1000000，真按增減及最大，預覽數量2／1234完整；成本仍按原公式顯示。碎片末列與 disabled 按鈕可達，沒有 crafting／交易。
- Hero 正式唯讀 transport 的列表、詳情、返回與編隊 candidate 選中可達；不聲稱已放置或儲存。祖先容器 scrollTop 為0，標題未被牽動。
- Auto393／412 sticky 卡片上緣仍露後方文字細線，保留為下一段問題，不納入本段通過。

interaction_review 已實看並限定原三症狀通過；art_review 實看四尺寸34張關鍵圖及分類／末端，scope_review 實看四尺寸代表 after、before及diff，三方限定通過。碎片 disabled 文案可辨認，保留狀態差；全尺寸控制列實際未溢出，不因先前欄寬猜測加補丁。未驗交易／獎勵領取／合成執行／真實裝置，不能把預覽當業務完成。

## CI 技能標題量測修正

最新暫停 Head CI39374766946 的 ui job118471268923 首敗於 skill runner centerError：舊公式仍要求整牌50%中心，而已批准原 Owner 為30%／60%／10% grid，真文字在第二書寫區，中心約牌面60%。修正既有 runner 以 resolved grid tracks／border／padding 計算文字中心；驗證三欄比例、零gap及方向，保留原4px門檻、墨跡safe31%..80%及上下安全區、return同高／不相蓋／框不跳／素材decode等所有檢查。

正式 runner 在 production 未變、僅 QA 公式 dirty 的本機 Chrome 四尺寸360x800／393x873／412x915／1280x960通過，文字Range中心差0.0806／0.0880／0.0923／0.1209px。實圖 artifacts/browser-qa/skill-393x873.png、skill-list-393x873.png；完整 JSON skill-inventory-semantic-browser-qa.json。這不是最新提交 GitHub CI 通過，也不是所有標題／所有裝置驗收。

同 run core job118471268965 的首敗為 backpack visual composition 的 Chrome DevTools15秒 ECONNREFUSED，分流既有 #954；未改期限／flags，未盲重跑。Session Authority39374766844成功。dev 暫停後新增 #967 文件／Cloud測試及 #963 創角fixture stylesheet-ready測試，無 production UI 修改；本段證據未因該差異改變。
