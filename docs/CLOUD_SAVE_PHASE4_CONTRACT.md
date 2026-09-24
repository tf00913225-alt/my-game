# Cloud Save Phase 4：一般進度遷移契約（施工中）

狀態：IN PROGRESS；尚無正式 gameplay cloud write、部署或手機驗收。基準 `dev@d8986afa62f0c1f2646fad1f4d1ca73b2be389f6`，工作分支 `feature/cloud-save-phase4-general-progress-20260924`。`main` 禁止修改。

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
