# Cloud Save Phase 4：一般進度遷移契約（施工中）

狀態：IN PROGRESS / 0/6 VERIFIED。偏好欄位已在 PR #559／#560／#561 合入 dev，最新 `dev@01c543564498400b38dd8778acccb9d76777131f` 已通過 CI 與 DEV exact-SHA 部署（Game／Cache 173.72）。手機已驗證上傳、讀回及修復確認視窗後的手動取回成功（Revision 7）；「返回／取回」易混淆，改為「取消／套用雲端設定」。跨裝置完整角色恢復仍未開啟。正式角色 gameplay cloud write 仍未開啟；`main` 禁止修改。

## 現有 owner 與風險

- `js/00-main.js::saveGame()`／`loadGame()` 寫讀同一份 UID 本機主存檔；`js/startup/account-save-repository.js` 管理 UID owner、dirty/base fingerprint。`js/60-team-relic-system.js` 仍有 `saveGame` 後置 wrapper，不能在此再疊 wrapper。
- `js/52-v173.20-startup-loader.js::resolveSaveFor()` 只在完整 `authoritativeStateReady:true` 且有效角色 payload 時讀取雲端完整存檔；Phase 2 envelope `authoritativeStateReady:false` 不得假裝已有可遊玩角色。
- `functions/index.js` 的 `bootstrapCloudSave`／`submitLegacyMigrationCandidate` 由 `sessions.runProtected` 在同一交易內驗證單一有效 session；`functions/src/cloud-save-envelope.js` 目前只允許非權威空 envelope／未受信任候選，`serverRevision` 是後端擁有。客戶端沒有 Firestore 寫入權限。

## 欄位邊界（預設拒絕，逐欄審核）

| 分類 | 現有欄位／資料 | Phase 4 限制 |
| --- | --- | --- |
| 高價值／可帶來獎勵 | `player`／`player2`／`player3`（含等級、EXP）、`sharedExp`、`gold`、`inventoryItems`、`characterEquipment`、`characterSkillLoadouts`、`playerRelics`、`teamLoadout` | 不接受 client 值作正式權威；留待 Phase 5 可信後端決策 |
| 看似一般進度，實際有獎勵耦合 | `dailyQuestState`、`commissionQuestState`、`achievementState`、`gameplayProgress` 的 Boss 首通／塔樓 claimed floors、`abyssProgress`、各類帶領獎標記的 sidecar | 不能直接按本機值恢復／覆蓋；先盤點每一處獎勵和可重複領取的效果 |
| 描述性或偏好候選 | `autoConfig`／`autoConfig2`／`autoConfig3`、`allyFormation`、`bestiaryData`、UI 偏好 sidecar | 即使值可上雲，也須逐欄驗證是否影響戰力、獎勵或消耗；偏好同步不等於「角色可跨裝置恢復」 |
| 本機時間／裝置狀態 | `lastSaveTimestamp`、local metadata `updatedAt`／`localDirty`、`cloudBaseFingerprint` | 不用作 server revision 或優先權；不能用時間較新就覆蓋雲端 |

## 遷移與載入必守條件

1. 任何舊主存檔僅能是 UID-bound **untrusted candidate**；後端按欄位驗證、決定權威值，不能把整包 JSON 改名 `gameSave`／`authoritativeSave` 後寫回 Phase 2 envelope。
2. 受保護寫入須在同一 Firestore transaction 內查 active session、owner、schema 與預期 `serverRevision`，由伺服器增加 revision 並使用 server timestamp；revision 不合、登出或 UID 改變時拒絕，不能背景自動重送失敗的舊寫入。
3. 已有雲端權威資料時，客戶端絕不依 local timestamp、dirty flag 或 fingerprint 自動覆蓋。若無法同時安全恢復角色與高價值狀態，維持既有完整 UID 本機遊戲，不把局部進度當作完整雲端角色灌入 Boot。
4. 離線只保留同 UID 本機候選；重新上線須重新讀 revision 並明確處理衝突。不得跨 Google／訪客 UID 自動搬移、刪除舊檔、變更金幣／物品／獎勵或隱性重置進度。
5. 以 emulator 與既有 Boot browser QA 驗證舊版 envelope 升級、同 UID 重複提交、兩裝置 revision 競態、UID／session 變動、未驗證獎勵及離線衝突；真手機 DEV 驗收後才宣稱 Phase 4 完成。

Phase 4 的可交付面需能真正恢復**允許範圍**內的資料，並明示未涵蓋的角色／資產。沒有後端驗證的領獎狀態不能因為名稱含「進度」就放行；若與高價值資料不可分割，必須保留為待 Phase 5 處理並明確標示範圍，不能為達成階段數字而靜默承認不可信存檔。

## 已部署偏好實作（整體 Phase 4 仍待實機與角色權威）

- 第一批只含三名角色的 `autoConfig`／`autoConfig2`／`autoConfig3`，加上三個角色 ID 作恢復綁定；後端只接受每組固定五個設定欄位、拒絕任何額外欄位或金幣／物品。`allyFormation` 與 `bestiaryData` 尚未通過獎勵／戰力審核，不在這輪寫入。
- `saveCloudPreferences` 使用 Phase 1 session 保護的同一 Firestore transaction，比對 expected `serverRevision`，版本不符拒絕；相同設定不增加 revision，更新只用 server timestamp。無 envelope 必須先 bootstrap，且 `authoritativeStateReady:false` 保持不變。
- DEV 帳號面板有手動「驗證自動戰鬥設定上雲」與「取回雲端自動戰鬥設定」按鈕。上傳只讀 UID 本機主存檔的上述欄位；取回先要求明確確認，再核對相同 UID、角色 ID 和 revision，在 gameplay save owner 中只套用自動設定並走既有本機存檔流程。沒有登入時自動同步，也沒有以局部設定觸發創角或恢復完整角色。
- 這是有限的偏好同步，不等於跨手機恢復角色／背包／金幣或 Phase 4 整體結案。正式 gameplay／獎勵權威後端仍待後續工程；真手機驗收前不得標記 COMPLETE。

## 下一段：換手機保留角色資料

玩家真正需要的是角色、等級、金幣、物品和進度，而不只是自動戰鬥設定。現有 `saveGame()` 仍由瀏覽器計算並寫 UID 本機存檔；Phase 2 envelope 固定 `authoritativeStateReady:false`。因此不能靠擴大偏好欄位白名單、加入整份本機 JSON 或以「讀到舊存檔」宣稱完成換機。

1. 先列出正式角色存檔每個欄位的生成／修改 owner，標記獎勵與經濟的依賴；確認哪些狀態需在同一後端交易內更新。
2. 設計舊本機存檔首次採納的可信來源與使用者確認流程：保留原始 UID 備份、校驗角色身分與 schema、明確處理已存在雲端角色及另一裝置較新 revision；未確認前不得設定 `authoritativeStateReady:true`。
3. 建立後端權威寫入和獎勵去重，讓等級、EXP、金幣、背包、裝備與領獎狀態都由受保護的操作或可信遷移產生；每次比對 active session、UID 與 server revision。缺少該能力時，不提供跨裝置恢復角色按鈕。
4. 完整角色 payload 通過 schema、相依與安全測試後，才讓既有 `resolveSaveFor()` 走 `authoritativeStateReady:true`，以同 UID 兩裝置、離線後回線、衝突與不可重領獎勵驗收；先保留各裝置原存檔與備份，不做自動整份覆蓋。

此路線依賴 Phase 5 高價值資料後端權威，實際工程可在 Phase 4 的後續 PR 銜接；驗收未完成前保持 Phase 4 `IN PROGRESS`。自動戰鬥偏好僅是已部署的有限管線測試，不當作下一個玩家價值里程碑。
