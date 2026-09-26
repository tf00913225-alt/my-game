# 《四象江湖傳》Cloud Account / Cloud Save 整體進度

本文件是長期工程進度來源。**每個 Phase 結束都必須更新本文件**；聊天、Commit、PR、CI 或部署成功不能取代驗收紀錄。

## 2026-09-26 — historical claim source reconciliation (candidate)

- Read-only reward audit now parses `quest-milestones` claimed thresholds with its recorded date and compares `abyss-state` claim entries against the mirrored main-save `abyssProgress`. Invalid milestone thresholds or contradictory Abyss claim mirrors block character draft preparation. Historical entries remain duplicate blocks only, never evidence of an unpaid reward. Earlier dates that the client no longer retains remain unverifiable.
- No canonical character or reward writer, claim ledger, accepted baseline, durable server recovery point or second-device restore was introduced. Local targeted checks and PR/merge/deployment evidence are separate gates. Phase 4 remains **IN PROGRESS / 0/6 VERIFIED**.

## 2026-09-26 — complete legacy source retention in read-only draft (candidate)

- The internal draft now retains all 23 allowlisted main-save fields through explicit conversion or present/missing markers and every one of the 14 registered sidecar sources with exact raw bytes or a missing marker. The server backup policy owns the sidecar inventory; the screening owner reuses it. Historical `equipment-shop-purchases` absence remains blocked and is never treated as unclaimed. Claim blockers remain even when character data can be translated for review.
- This is source preservation for a later canonical admission, not a verified claim, authoritative character write, backup/recovery point or playable snapshot. Targeted local tests and PR/merged deployment evidence must be recorded separately. Phase 4 remains **IN PROGRESS / 0/6 VERIFIED**.

## 2026-09-26 — read-only legacy character conversion draft (candidate)

- `functions/src/legacy-candidate-screening.js::prepareLegacyCharacterDraft()` converts a structurally screened legacy candidate into a private review draft: three explicit character slots, economy, distinct bag/equipped objects with source paths, skill/relic sources, progress and parsed claim-bearing sidecars. It never issues canonical IDs or writes character state. The callable returns only conversion status and object counts, not the draft. Missing/corrupt claim sidecars, missing created-character skill loadouts or an unowned equipped relic block the draft; historical rewards remain unverified even for a prepared draft.
- Targeted local verification and PR/merge/deploy evidence must be recorded separately. No baseline acceptance, award, authoritative writer, server recovery point or second-device restore exists. Phase 4 remains **IN PROGRESS / 0/6 VERIFIED**.

## 2026-09-26 — live formation field and canonical source screening (candidate)

- `saveGame()` persists `allyFormation` but the candidate field allowlist previously omitted it. The backend now preserves that field; the read-only candidate screen blocks invalid/duplicate/orphaned formation slots and missing economy, skill or relic source fields. This closes a real save-schema drift without trusting client history or making a playable canonical projection.
- PR #594 head `b7fa64138ae76509f81ae1fe6820359a803ac2d0` passed PR CI runs `36237149443` and `36237149229`, then merged to `dev@c5995ac04ca8a80704c5dfb1fce4eec2a4028d41`. Merged CI run `36237369357` passed Repository checks and exact-commit DEV preview deployment/version verification; Session Authority run `36237369203` passed the emulator and the Firebase deployment job for that same SHA. These are workflow results, not disaster-recovery or second-phone character acceptance.
- No baseline acceptance, authoritative writer, server backup or second-device character restore is implemented. Phase 4 remains **IN PROGRESS / 0/6 VERIFIED**. PR, emulator, merge and exact deployment evidence are tracked separately.

## 2026-09-26 — Persisted-state owner drift and CI guard strengthening (candidate)

- Full runtime search found no active writer/reader for UID `equipment-shop-purchases`; it survives only as a historical legacy translation/backup key. The 39-entry registry now names that actual preservation owner, removes the false shop-UI writer claim and blocks missing/corrupt claim history pending review. No legacy key or backup is deleted.
- The CI guard now rejects an unregistered literal key even if the number of writes in an existing module stays unchanged, rejects unreviewed dynamic account suffixes and rejects a runtime reintroduction of the historical-only key without a claim-policy review. Its self-test exercises all three. This is registry coverage, not a new cloud reward authority. Phase 4 remains **0/6 VERIFIED**.

## 2026-09-26 — Legacy equipped-object migration screening (candidate)

- Runtime audit found that `equipSelectedItem()` moves the entire item object from `inventoryItems` into `characterEquipment`; an equipped item is legitimately absent from the bag. The first character's current owner key is `fire`, later characters use `player2`/`player3`, and legacy alias slots exist. A future canonical conversion must take the union, allocate new server-issued ownership IDs and retain any unmapped item for review.
- The existing read-only candidate screening now reports blockers for duplicate `v141Uid` across bag/equipment, mismatched or ambiguous equipment slots, malformed equipped items and nonempty orphaned owners. An equipped item absent from the bag is not itself a blocker. Legacy marker consistency is only structural; no item entitlement is trusted, no candidate is accepted, and Phase 4 remains **0/6 VERIFIED**.

## 2026-09-26 — Foundation C reservation receipt consistency and settlement gate (candidate)

- `functions/src/trusted-grant-ledger.js` now rejects an inconsistent **existing** reservation receipt if grant amount, status, UID/source, receipt type, credited flag or revision diverges. Emulator regression corrupts each critical field, verifies a retry fails with `DATA_LOSS`, restores the fixture and confirms no extra revision or award. The grant remains only reserved: `creditedToCharacter:false`.
- `docs/CLOUD_OPERATION_SETTLEMENT_CONTRACT.md` gates the first real reward credit on one transaction containing server-owned eligibility/calculation, canonical delta, expected revision, operation ID, unique claim, idempotent receipt and ledger. No such credit writer or source issuer is added here. This does not complete Foundation C or Phase 4; `authoritativeStateReady:false` and Phase 4 **0/6 VERIFIED** remain.

## 2026-09-26 — Foundation B canonical schema and recovery contract (design only)

- `docs/CLOUD_CANONICAL_SCHEMA_AND_RECOVERY.md` now specifies the planned server-owned account/character/economy/inventory/equipment/relic/progress/claim/operation/ledger records, a bounded materialized playable snapshot, revision and digest consistency gate, and a separate recovery point manifest. A valid player may have one or two created characters; unused slots remain explicitly empty.
- The first real gold/EXP/item mutation still requires idempotent operation receipt, ledger, expected revision and transaction together. Migration candidates and original-phone immutable copies cannot serve as authoritative recovery points. Corruption, missing registered sources or UID mismatch must leave `authoritativeStateReady:false`.
- This is a contract and future test skeleton, **not** a canonical writer, server backup, restore implementation, accepted legacy baseline or fresh-device acceptance. Phase 4 remains **IN PROGRESS / 0/6 VERIFIED**. The owner-observed `(default)` PITR and scheduled backup switches remain disabled; Firestore region remains unverified.

## 2026-09-26 — Legacy character identity screening (deployed; no admission)

- Migration policy requires a literal, nonblank string character ID; numeric IDs no longer pass by implicit string coercion. It rejects a new candidate if slot 3 exists without slot 2; the read-only screening reports `CHARACTER_SLOT_GAP` for previously stored candidates. A one-character or two-character party remains valid because the game creates those slots progressively.
- PR #588 merged as `dev@49ca985fd80be20ec0647e1c4e8b5ff277339d2f`. Targeted local tests passed (38); PR Repository CI run `36232442006` and Session Authority emulator run `36232441874` succeeded. Merged dev CI run `36232695973` succeeded, including DEV deployment; merged Session Authority run `36232695823` passed the emulator and Firebase deployment for the exact SHA. The deployment log shows `submitLegacyMigrationCandidate` and `screenLegacyMigrationCandidate` updated in `us-central1` and Firestore deny-write rules released. This strengthens structural screening of untrusted historical candidates only; it does not accept a baseline, create canonical state, enable `authoritativeStateReady`, provide server backup or allow second-device character restore.

## 2026-09-26 — architecture hardening work branch (not yet verified)

- Start base `dev@727279ee0653803c07179e0ff43a1a1b2cb992f8`; discovered Architecture Contract Drift: `DATA_SECURITY_CONTRACTS.md` absent at base. Current branch adds the contract and a 34-entry persisted-state inventory with CI guard; PR, emulator, merge and deployment status must be recorded after execution.
- Candidate source at base was `battle_full_version_save_v5` while the immutable copy came from `four_symbols_save:<UID>`. Candidate submission is being changed to an explicit sealed backup ID and raw bundle with SHA-256 consistency checks. Previously submitted unbundled history remains untrusted and blocked; this does not accept a character. The backup inventory also adds the previously omitted `patrol-character-index` preference.
- Old Phase 1–3 acceptance evidence remains historical. Phase 4 remains **IN PROGRESS / 0/6 VERIFIED**. The grant reservation candidate is a partial prerequisite, not an awarded balance and not Phase 5–7 completion. A passing CI or Firebase deploy cannot certify full character restore.

### Dependency order (preserving original Phase 4–10 history above)

1. Foundation A: persisted-state registry, sealed backup manifest and source unification.
2. Foundation B: canonical server character schema and materialized playable snapshot design.
3. Foundation C: operation ID, idempotency, receipt, ledger, expected revision and transaction implemented **together with the first balance/EXP/item mutation**. Old Phase 6/7 cannot wait until after old Phase 5 award writes.
4. Foundation D: server-issued run/attempt and reward settlement sources.
5. Foundation E: durable server backup, recovery points and audited restore (old Phase 8 moves ahead of migration acceptance).
6. Foundation F: one-time local-history acceptance with explicit owner confirmation and claim blocking.
7. Foundation G: complete schema and claims gate `authoritativeStateReady:true` only after restore rehearsal.
8. Foundation H: fresh-device full-character recovery acceptance (old Phase 4 success gate).
9. Foundation I: payment/refund entitlements (old Phase 9).
10. Foundation J: destructive/disaster/multi-device tests throughout and final release gate (old Phase 10).

`docs/OFFLINE_AUTHORITY_POLICY.md` and `docs/CLOUD_CANONICAL_SCHEMA_AND_RECOVERY.md` specify the provisional offline paths and restoration gates. The owner-provided Google Cloud Console Disaster Recovery screenshot on 2026-09-26 (Asia/Taipei) shows PITR disabled, scheduled backups disabled and no displayed backups for `(default)`; no disaster restore has been rehearsed. Firestore region remains unverified. App Check enforcement, Google guest linking and WIF are unimplemented; an anonymous→Google UID-switch guard is implemented but link/merge remains unavailable.

## 2026-09-25 — Historical reward-claim proof gate (candidate)

- `functions/src/legacy-reward-claim-audit.js` is a pure, fail-closed parser for the five claim-bearing main-save areas: daily quests, commissions, achievements, tower floors and Abyss first-clear/chest records. A structurally valid historical `claimed` entry is classified only as `block_historical_claims_only`; it is never a grant entitlement, balance change or accepted cloud state. Missing, malformed or contradictory records receive a source-specific `*_CLAIM_RECORD_INVALID` blocker.
- The read-only `screenLegacyMigrationCandidate` preflight includes that audit without exposing the candidate snapshot or writing a migration marker. It remains `readyForAcceptance:false`, has no character/economy write path and still reports `SIDECAR_BACKUP_MISSING` until a complete independently preserved sidecar bundle can be verified.
- Pure cloud-save tests currently pass locally. This is not the one-time acceptance transaction, does not upload any phone data, and does not make a cloud character playable or recoverable on another device. Phase 4 remains **IN PROGRESS / 0/6 VERIFIED**.

## 2026-09-25 — Original-device immutable backup primitive

- `js/startup/account-save-repository.js::createMigrationBackup(uid)` is the sole local backup owner. It requires the active UID and complete UID-owned save, records original main-save bytes, metadata bytes and all registered UID sidecars as present/missing, then writes a fingerprint-addressed immutable local record. It never deletes, rewrites or uploads gameplay state.
- `js/firebase/firebase-cloud-save.js::createLocalMigrationBackup()` exposes only that explicit original-device preparation. It rejects UID changes and does not call Firebase, `saveGame()`, `loadGame()` or a restore path.
- This is a preservation prerequisite, not admission: private server backup upload, one-time acceptance transaction, authoritative character writing and second-device restore remain unimplemented. PR #573 was merged to `dev@0cfd6d994fd598a05677a7c770faf975725a2020`; its Repository checks, Session Authority/Firebase deployment and exact DEV SHA verification succeeded. Phase 4 remains **IN PROGRESS / 0/6 VERIFIED**.

## 2026-09-25 — Private legacy candidate screening

- `functions/src/legacy-candidate-screening.js` owns a read-only preflight for the latest private migration candidate; `functions/index.js::screenLegacyMigrationCandidate` requires Firebase identity and the active single-device session in `runProtected()`. It compares the requested cloud revision and candidate revision, checks UID/trust metadata and stored candidate structure, then reports blocker codes without returning the save snapshot.
- A main save by itself cannot prove historical rewards or provide a complete backed-up sidecar bundle. Screening always reports `readyForAcceptance:false`; malformed character, inventory, equipment and claim fields add specific blockers. It does not write a review approval, migration marker, character state, economy value or revision. Old candidate revisions cannot be screened as the current candidate.
- PR #572 was merged before the backup gate. No phone data has been submitted, no cloud character is playable, and Phase 4 remains IN PROGRESS / 0/6 VERIFIED. This gate does not replace the complete future reward operations, sidecar backup or owner-confirmed migration acceptance.

## 2026-09-25 — One-time historical baseline policy and authoritative startup guard

- The owner agreed to a guarded **one-time** acceptance of old local progress as a clearly marked, historically unverifiable baseline, followed by backend-verified new earnings. The exact admission conditions, full main-save/sidecar backup, anomaly/claim checks, unique migration marker, UID/session/revision transaction and post-migration reward receipts are recorded in `docs/CLOUD_CHARACTER_AUTHORITY_MIGRATION_DESIGN.md`. Agreement to the policy does not authorize silently uploading a player's phone save.
- `js/52-v173.20-startup-loader.js::resolveSaveFor()` no longer treats `localBase===cloudFingerprint` as authority for a changed local save. If a future complete cloud character differs from the local copy, boot keeps the local copy intact and blocks with a conflict message; only an identical cache may be loaded from the cloud snapshot. Targeted tests exercise identical cache, locally modified shared base and unrelated save.
- `js/00-main.js::persistBeforeSuspend()` now requires Startup READY/OFFLINE_READY before its existing background `saveGame()`. A blocked conflict or unresolved save must never write an unhydrated default character over the UID candidate during pagehide/freeze. Boot browser QA first checks preservation of a dirty local candidate, then backs up the disposable QA records and exercises a fresh no-cache cloud restore.
- The guard does not create an authoritative character, accept a migration candidate, install reward writers, or restore another device. No second-phone test yet. Phase 4 remains **IN PROGRESS / 0/6 VERIFIED**, Game/Cache `173.72`, `main` untouched. PR, CI, merged SHA and deployment results must be checked separately.

## 2026-09-25 — Server-issued grant reservation candidate

- `functions/src/trusted-grant-ledger.js` is the sole grant reservation owner; `functions/index.js::reserveTrustedGrant` verifies Firebase identity and calls the Phase 1 `runProtected` transaction. A grant must already exist in private `serverUsers/{uid}/pendingGrants/{grantId}` with a server-issued source. Browser Firestore rules deny creation. The request accepts an ID, operation ID and expected revision, never a gold amount.
- One transaction checks active session, UID, envelope revision and grant eligibility, reserves a grant, writes an immutable operation receipt and advances the envelope revision. Same operation ID retries return the receipt; a second ID cannot reserve the same grant. This is **not a gold award**: the receipt explicitly says `creditedToCharacter:false`, and no local save, character payload, inventory or `authoritativeStateReady` changes. No grant issuer or client button is provided.
- This isolated backend prerequisite still needs PR CI, emulator, merge and deployment verification. Phase 4 remains IN PROGRESS / 0/6 VERIFIED; the Phase 5 economy backend remains incomplete. A server-validated gameplay event source, complete character state and legacy adoption policy are still required for actual cross-device recovery.

## 2026-09-25 — Legacy candidate revision history (candidate; pending CI/deploy)

- Backend owner `functions/index.js::submitLegacyMigrationCandidate()` now creates a private `migrationCandidates/{revision}` record in the existing protected transaction, while keeping `latest` for compatibility. Each record remains `trusted:false`; it is a server-side record of a client-supplied candidate, **not** a trusted character backup or accepted cloud save. Historical revisions submitted before this change cannot be reconstructed from an overwritten `latest` record.
- Identical fingerprint retries return the existing receipt and do not increment the envelope revision, including when the first response was lost. A different candidate retains the existing rate limit; the previous revision remains accessible to trusted backend administrators. Inconsistent `latest`/envelope metadata fails closed. Emulator tests cover a second candidate, repeat retry, rate limit, and no authoritative gameplay state.
- This does not upload the original phone's save automatically, alter local storage, provide a restore button, or enable character recovery. Phase 4 remains IN PROGRESS / 0/6 VERIFIED; Phase 5 remains NOT STARTED. Production Firebase deployment and exact dev SHA still require verification after merging the PR.

## A. Overall Architecture Status（整體架構狀態）

| Phase | 範圍 | 狀態 |
| --- | --- | --- |
| 1 | Single Active Session（單一有效工作階段權威） | COMPLETE / 5/5 VERIFIED |
| 2 | Cloud Save Skeleton（雲端存檔骨架） | COMPLETE / 6/6 VERIFIED |
| 3 | UID Local Isolation / Login Loading（本機隔離／登入載入） | COMPLETE / 6/6 VERIFIED |
| 4 | General Progress Migration（一般進度遷移） | IN PROGRESS / 0/6 VERIFIED |
| 5 | High-value Data Backend Authority（高價值資料後端權威） | NOT STARTED |
| 6 | Operation ID / Idempotency / Atomic Transaction | NOT STARTED |
| 7 | Audit / Economy Ledger（稽核／經濟帳本） | NOT STARTED |
| 8 | Snapshot / Backup / Recovery（快照／備份／復原） | NOT STARTED |
| 9 | Payment / Refund Entitlement（付款／退款權益） | NOT STARTED |
| 10 | Destructive / Multi-device / Recovery Testing（破壞性／多裝置／復原測試） | NOT STARTED |

既有 UID local repository、唯讀 cloud reader、migration candidate 等是前置實作，**不代表 Phase 2–10 已驗收完成**。Phase 1 使用交易不代表 Phase 6 全部完成。

## 2026-09-24 character-authority audit (next engineering gate)

- At `dev@567375aea927495e0f16c04b836d8d414bd05bff`, audited core save, startup, Firebase backend and representative battle/quest/tower/abyss/relic reward writers. See `docs/CLOUD_CHARACTER_AUTHORITY_MIGRATION_DESIGN.md` for the field-to-writer map, trusted operation contract and legacy migration gates. `DATA_SECURITY_CONTRACTS.md` is absent at this baseline.
- Corrected the Phase 4 Requirement Batch: its former `IMPLEMENTED` labels described only the deployed preference test, while the written requirements cover character, economy, claims and cross-device recovery. All six remain unverified and full-character implementation remains TODO. This is a documentation/safety gate, not a character cloud deployment.
- Existing locally earned historical assets cannot be independently authenticated from a client save alone; a separately approved, auditable first-migration acceptance policy is required before treating those values as cloud authority. No second-phone character test should begin yet.

## B. Current Phase（目前階段）

- Phase 1 — Single Active Session Authority：**COMPLETE / 5/5 VERIFIED**。
- Phase 2 — Cloud Save Skeleton：**COMPLETE / 6/6 VERIFIED**。PR #553／#554／#555 已依序合併 `dev`；最新驗收部署為 `dev@b037ced9dad9d1cf67d9aacccb4e064c74a135e1`。Repository checks、Java 21 emulator、DEV exact-SHA、Firebase deploy 與真實 Google 帳號手機 live envelope 驗證均 SUCCESS。
- Phase 3 — UID Local Isolation / Login Loading：**COMPLETE / 6/6 VERIFIED**。PR #557 Repository checks run `35999834624` SUCCESS，合併 `dev@eed8dec359eff34727381adfbfa50b7c2ea09bd3`；DEV release manifest 與 hashed Boot Core 已讀回同一 SHA／Phase 3 owner。使用者以真實手機完成 Google → 訪客 → Google 驗收：訪客未看見 Google 角色／資料，重新登入 Google 後原角色／資料正常恢復。
- Phase 4 — General Progress Migration：**IN PROGRESS / 0/6 VERIFIED**。受保護的自動戰鬥偏好讀寫已經 PR #559／#560／#561 合入 `dev` 並部署；手機已證實上傳、雲端讀回與修復後手動取回成功；使用者指出彈窗的「返回／取回」字樣易混淆，改為「取消／套用雲端設定」。這只是偏好設定測試；等級、EXP、金幣、背包、裝備、任務及領獎資料仍在 UID 本機存檔，不能宣稱換手機能取回角色。詳見 `docs/CLOUD_SAVE_PHASE4_CONTRACT.md` 及本階段 Requirement Batch。
- Phase 4 已部署的有限範圍：僅 UID＋角色 ID 綁定的三組自動戰鬥設定；受保護寫入核對 `serverRevision`，手動上傳／取回不會建立完整角色。PR #561 修正自訂非同步確認視窗被 `window.confirm` 包裝器一律當作取消的問題，測試涵蓋確認、取消、UID 切換與 revision 變動；合併 `dev@01c543564498400b38dd8778acccb9d76777131f`，merged Repository checks／DEV deploy run `36022298612` SUCCESS，部署 SHA 核對一致、Game／Cache 均 `173.72`，Session Authority run `36022298060` SUCCESS。手機上傳、雲端骨架與 Revision 讀回有使用者截圖；修復後使用者再以手機 Chrome 操作「取回」，看到「此 UID 的自動戰鬥設定已取回並儲存在本機」且 Revision 7，確認窗的操作通過實機驗證。第二台裝置、離線與獎勵驗收仍待完成；UI 成功訊息未單獨證明跨手機角色還原。
- 起始基準：GitHub 最新 `dev@7dd60dcddc9334902e058123a6084a93353e5943`，2026-09-19 重新 fetch 核對。
- 原實作分支：`feature/cloud-session-authority-phase1-20260919`，當時只整合 `dev`。本次結案分支：`docs/cloud-session-phase1-closeout-20260919`，基準為重新核對的 `dev@342ef104fa2897f5ae5c3249e0c75c9efca3e762`；使用者已授權完成結案後經受保護 PR 發布 main。禁止直接修改 dev／main、rebase、force push。
- 官方版本／cache version 維持 `173.65`，沒有升版。
- 實作／測試／部署狀態分開記錄於下方；未取得實際證據不得標記 COMPLETED。
- 程式 PR [#335](https://github.com/tf00913225-alt/my-game/pull/335) 已在兩組 CI 全綠後合併 `dev`。實作 commits：`3d2434fd1323ea175333868cd8d51871a6f4a69a`、`d413304550f015dc164152d1e0229dd68dcdd95b`；merge commit：`b105f5329d95874820202b6ade78254712200d5e`。未修改 `main`。
- **目前驗收狀態：COMPLETE / 5/5 VERIFIED。** Rules IAM 403 已解除；真實 Firebase 七支 Functions／Rules 部署及同 UID 雙手機 takeover 驗收已有下列證據。Phase 1 完成不等於完整雲端存檔已完成。文件 PR、最後 dev CI／部署、main PR 與正式部署屬本次發布鏈，須各自核對最新 SHA，不能以功能驗收代替發布驗證。

### 2026-09-19 正式驗收結案證據（目前狀態）

- **發布檢查修復回流：** main PR #342 的 run `35441331170` 抓到 `tests/critical-feature-budget.test.js` 過期的 5 個 Firebase 模組預期；Phase 1 已正式納入兩個 session 模組，實際為 7。於最新 `dev@10a2decd213cc061e8820fbfd5b01e4ad4d386f4` 開 fix 分支，精準測試先重現再修正通過；大小／hash／feature 邊界斷言保留，不改正式程式。後續修復 PR、最終 dev／main SHA 和各工作流程結果統一記錄於 [結案 PR #341](https://github.com/tf00913225-alt/my-game/pull/341)，不把前一 dev 的成功紀錄當成修復後證據。
- **已部署驗收基準 SHA：** `342ef104fa2897f5ae5c3249e0c75c9efca3e762`，為本次收尾開始時 GitHub 最新 dev，非沿用未核對的舊 SHA。
- **部署身分與 IAM：** 實際 job 輸出確認 `github-firebase-deployer@four-symbols-jianghu.iam.gserviceaccount.com`；Rules API 403 已解除。本次不新增 IAM 權限、不取得或提交服務帳號金鑰。
- **Firebase 部署：** [run 35438044543](https://github.com/tf00913225-alt/my-game/actions/runs/35438044543)／[job 105884400094](https://github.com/tf00913225-alt/my-game/actions/runs/35438044543/job/105884400094) SUCCESS。2026-09-19 10:44:55 UTC 規則編譯成功、10:45:03 UTC 發布到 cloud.firestore；10:46:01–10:46:09 UTC 七支函式全部 Successful update operation，最後 Deploy complete!。
- **七支已部署 Functions：** `createGameSession`、`revokeGameSession`、`protectedTest`、`bootstrapCloudSave`、`submitLegacyMigrationCandidate`、`createNativeAuthHandoff`、`redeemNativeAuthHandoff`，region `us-central1`。
- **Artifact Registry：** PR #339 在既有精確範圍部署命令加入 `--force`，已解除非互動清理政策造成的部署退出阻塞。上述成功 job 仍含「Failed to set up cleanup policy」警告；只能確認部署完成，不能把清理政策實際設定標成 VERIFIED。此為非阻塞維運追蹤，不擴大本階段功能。
- **真實同 UID 手機 A/B：** 使用者以相同 Google 帳號／UID 測試。舊裝置提供畫面 `SESSION_REVOKED` 與「❌ 這台裝置已被另一台裝置取代。」；使用者於本次對話補充後登入裝置曾顯示成功，成功截圖已刪除，並明確表示已實測、沒有問題。新裝置持續有效採認為使用者實機回報，未假造截圖、token、完整 UID 或伺服器逐次操作日誌。
- **澄清紀錄：** 使用者中途簡短回覆「已被取代」，隨後澄清「是成功的畫面我刪掉了」及已完成實測。先前疑似雙裝置均失效的解讀不作為已確認 Bug；沒有據此改動任何權限程式。
- **不同 UID 隔離／自動驗證：** 同 SHA 的 [emulator job 105883976742](https://github.com/tf00913225-alt/my-game/actions/runs/35438044543/job/105883976742) SUCCESS，實際 HTTP callable 驗證 A SUCCESS → B takeover → A SESSION_REVOKED → B SUCCESS、不同 UID、rules、protected writers、併發與身分撤銷。`scripts/test-session-authority-emulator.mjs` 的 UID Y 在 UID X 撤銷後仍 SUCCESS。這是可執行模擬器證據，沒有冒稱為不同 UID 真實手機驗收。
- **Repository checks／DEV：** [run 35438044719](https://github.com/tf00913225-alt/my-game/actions/runs/35438044719) 的 Repository checks 與 [DEV deployment job 105884077707](https://github.com/tf00913225-alt/my-game/actions/runs/35438044719/job/105884077707) SUCCESS。部署讀回 exact SHA `342ef104fa2897f5ae5c3249e0c75c9efca3e762`，Game／Cache Version 均 `173.65`。
- **DEV 測試按鈕：** `firebase-auth-ui.js::render()` 與 `testCurrentDeviceSession()` 共用精確 hostname allowlist。可執行檢查確認三個允許網域顯示／可呼叫，`tf00913225-alt.github.io`、專案 root 及偽裝後綴網域隱藏／不可呼叫；session client 原有 8 tests 全數 PASS。正式網站發布後仍另做實頁確認，不將此檢查冒稱為正式登入實測。
- **永久發布記錄：** [結案 PR #341](https://github.com/tf00913225-alt/my-game/pull/341) 的最終發布證據保存文件 merge SHA、最終 dev SHA、其 Repository checks／DEV／Firebase run 與 job、dev→main PR、main SHA、正式部署及 SHA 核對。文件內的驗收基準 SHA 不冒充合併後 SHA；最終 merge SHA 由合併產生後記入 PR，避免用另一個文件 commit 不斷改變待驗證 SHA。

## Architecture Audit（修改前實際程式碼稽核）

已完整閱讀 `AGENTS.md`、`CLAUDE.md`、`HANDOFF.md`、`ARCHITECTURE_RULES.md`、`UI_GUIDELINES.md`、`SYSTEM_CONTRACTS.md`、`docs/BOOT_ARCHITECTURE.md`，並讀取 release verification 與既有 Firebase 文件。

**基準中不存在 `DATA_SECURITY_CONTRACTS.md`**（GitHub exact-SHA 404，repository 搜尋亦無此檔）。沒有假設其規定存在；本文件永久記錄使用者本次明確定案的安全原則。後续應由專案補齊／核對契約，不能以本次新增程式宣稱缺失文件已閱讀。

| 問題 | 稽核結果／實際 owner |
| --- | --- |
| 1. Firebase 初始化 | `js/firebase/firebase-config.js` 提供公開 Web config；`firebase-auth.js::initializeFirebaseAuth()` 建立 named app 與 Auth。Web SDK 12.18.0，project `four-symbols-jianghu`。 |
| 2. UID 來源 | Firebase SDK `auth.currentUser.uid`；`publicUser()` 僅公開 UID/profile；bootstrap 透過 `getSignedInUser()` 與 auth listener 交給 startup。沒有使用本機自編 UID 取代 Firebase 身分。 |
| 3. Login | `firebase-auth.js` 的 Google/Facebook popup、Email 登入／註冊、Anonymous；`firebase-auth-ui.js::bind()` 直接使用這些 owner。`getRedirectResult()` 僅相容既有 redirect 回傳。 |
| 4. Logout | `firebase-auth.js::signOutFirebase()` 原本只呼叫 SDK signOut；UI 登出／切換帳號與 bootstrap API 均走此處。 |
| 5. Auth listener | `observeFirebaseAuthState()` → `onAuthStateChanged`；`firebase-bootstrap.js::initializeLifecycle()` 維護 generation、發送 `four-symbols:firebase-auth-state`；startup `onAuth()` 管理 UID 切換。 |
| 6. 玩家讀取 | `js/52-v173.20-startup-loader.js::resolveSaveFor()` → UID local repository + `firebase-bootstrap.js::resolveCloudSave()` → `firebase-cloud-save.js::readCurrentCloudSave()` → Firestore `users/{uid}/saves/current`。正式雲端 payload 需 `authoritativeStateReady===true`；讀取失敗僅允許已驗證 UID local fallback。 |
| 7. 玩家寫入 | `js/00-main.js::saveGame()` → `FourSymbolsAccountSave.writeForUid()` → localStorage。`loadGame()` 接受 startup 已解析 payload。`SAVE_KEY` 與 active UID key 交叉核對。Firestore 寫入由 Admin Functions 處理，並未完成一般遊戲進度上雲。 |
| 8. 現有 Backend | `functions/index.js` 共四支既有 callable：`bootstrapCloudSave`、`submitLegacyMigrationCandidate`、`createNativeAuthHandoff`、`redeemNativeAuthHandoff`。前兩支只有 Firebase Auth，尚無遊戲 session check；後兩支是原生 Facebook 身分交接。 |
| 9. Browser 直接 database 寫入 | Firebase browser source 僅 `getDoc`；未發現 Firestore write API 或 Realtime Database 的正式玩家寫入 owner。歷史 local candidate 透過 callable 送後端，僅標示 untrusted。 |
| 10. 本機儲存 | 詳見下表。程式未發現自有 IndexedDB 玩家存檔 owner；Firebase `browserLocalPersistence` 的 SDK 身分持久化與遊戲存檔分開。First Play cache／UI session resume 不是遊戲權威。 |
| 11. 跨 UID 風險 | 主存檔已按 UID 分區，核心 save guard 存在；但共用 `four_symbols_active_uid` 跨 tab、部分 sidecar 在模組初始化時固定 UID key、全域 gameplay state 切換 reset 仍需 Phase 3 系統性驗證。不能據此宣稱所有 UID 污染風險已清除。 |
| 12. 既有 Session/Device/Token | 有 Firebase Auth persistence、native 2-minute handoff code、`sixiang_startup_session_ready_v1` 等 UI resume 標記；皆不是 single active game session authority。無後端 activeSession 指標。 |
| 13. Security Rules | `firestore.rules` 允許 signed-in owner 讀取自己的 `/users/{uid}` tree；所有 browser create/update/delete 禁止；其餘路徑包括 `serverUsers` 與 `nativeAuthHandoffs` 全拒絕。這是 repository 規則，不能在部署／查驗前推定線上已一致。 |
| 14. Client 可改哪些數值 | 金幣、EXP、等級、背包、裝備、秘寶、進度、副本／Boss／合成等仍在 browser gameplay state 與 local save 計算。migration candidate 雖做結構／數值範圍驗證，仍明確 `trusted:false`，不等於經濟權威。 |

資料流：Firebase UID 經 bootstrap auth event 交給 startup `resolveSaveFor(uid)`，讀取 own-UID cloud save 與 local repository，再由 `loadGame(resolvedSave)` hydrate 遊戲狀態。`saveGame()` 仍寫 UID local save／metadata。legacy 檔只有明確確認後才本機遷移／備份，或另送後端作 untrusted candidate。

| 本機資料／key | 內容／owner |
| --- | --- |
| `four_symbols_save:{uid}` | 角色、金幣、sharedExp、背包、裝備、技能、秘寶、隊伍、任務／副本等主進度；`js/00-main.js`、`js/startup/account-save-repository.js` |
| `four_symbols_save_meta:{uid}` | ownerUid、schemaVersion 2、localDirty、cloudBaseFingerprint、source、本機 updatedAt；只表示快取來源，不是可信 server revision |
| `four_symbols_active_uid` | 同 origin 共用 active pointer；核心 SAVE_KEY guard 不可移除 |
| `battle_full_version_save_v5`、`four_symbols_legacy_backup:{uid}:{timestamp}` | 舊檔與使用者確認遷移時保留的備份；本 Phase 不搬移、不刪除 |
| UID `accountKey()` sidecars | element-box-state (`js/25-*`)、daily-dungeon-state (`js/27-*`)、exp-pool-growth-state (`js/28-*`)、rested-exp-state (`js/32-*`)、progress (`js/34-*`)、announcement-read／quest-milestones／task-tracker (`js/35-*`)、legacy-abyss-state (`js/36-*`)、abyss-state (`js/59-*`) |
| UID UI／商店 sidecars | patrol-character-index (`js/26-*`)、bulk-sell-quality (`js/53-*`、`js/55-*`)、equipment-shop-daily (`js/equipment-progression.js`、`js/51-*`、`js/56-*`)、equipment-shop-purchases (`js/56-*`) |
| 非權威 cache／UI state | `js/startup/first-play-resource-loader.js` resource completion record、`js/00-main.js` sessionStorage resume marker、SDK Auth persistence；不混作玩家正式進度 |

## C. Completed Work（已實作／驗證證據）

### Phase 3 UID Local Isolation / Login Loading（2026-09-24，COMPLETE / 6/6 VERIFIED）

- Startup State Machine 新增唯一帳號轉換入口 `reloadForAccountTransition()`。登出或 Auth observer 發現 UID 改變時，先遞增 `transitionToken` 丟棄舊 save resolution、解除 active save owner、移除 session resume marker、隱藏創角與 gameplay，最後完整 reload。
- 完整 reload 是既有 sidecar 初始化模型的正式收斂方式：`element-box-state`、daily dungeon、EXP、progress、announcement、task、abyss、shop 與 bulk-sell 等模組會在新 document 依當前 active UID 重建 key，不在舊 UID runtime 內直接 hydrate 新帳號。
- Canonical save 與 metadata 仍由 `account-save-repository.js` 驗證 `ownerUid`；只有 active UID 可寫。Cloud read 失敗只在該 Firebase UID 的 `readForUid()` 回傳完整 ready save 時進 `OFFLINE_READY`，否則維持 ERROR。
- Anonymous 訪客 UID 不會自動搬到 Google／Email UID；唯一 legacy migration 仍要求使用者明確確認。本階段沒有一般 gameplay cloud write、Envelope schema 變更、版本升級、經濟或戰鬥修改。
- 新增 `tests/cloud-save-phase3-uid-local-isolation.test.js`，並把它連同 account ownership／auth-before-creation 加入 PR→dev 必跑 CI；既有 Boot browser QA 的 UID A→登出→UID B 流程將驗證 reload 後角色、金幣、EXP、背包、裝備及 metadata 均屬 UID B，UID A 資料保持不變。
- PR #557 已以 candidate `9ad52534cf154d4f3a470afc8f71eb17a8c19371` 通過 Repository checks run `35999834624`，包含 Phase 3 targeted regressions 與既有 account-first Boot browser UID A→登出→UID B 隔離案例；合併 SHA 為 `eed8dec359eff34727381adfbfa50b7c2ea09bd3`。
- DEV `release-manifest.json` 已讀回 exact merge SHA、Game／Cache V173.72；部署 HTML 使用 `build/boot-core.d8fbf40b153e.js`，且 deployed bundle 包含 `reloadForAccountTransition`／`signed-out`／`uid-changed`。
- 真實手機驗收 PASS：Google 帳號進入後登出改用 Firebase 訪客，訪客沒有看到 Google 的角色與進度；再次登出並登入 Google，原 Google 角色／資料正常恢復。
- Requirement Batch：`release/requirement-batches/2026-09-24-cloud-save-phase3-uid-local-isolation.json`，6/6 VERIFIED；Phase 3 正式 COMPLETE。

### Phase 2 Cloud Save Envelope（2026-09-24，COMPLETE / 6/6 VERIFIED）

- 新增唯一 Envelope owner：`functions/src/cloud-save-envelope.js`。正式 public envelope schema 為 Version 2，固定包含 `ownerUid`、`schemaVersion`、server-owned `serverRevision`、`createdAt`、`updatedAt`、authoritative readiness 與 migration metadata 狀態。
- `bootstrapCloudSave` 仍在 Session Authority 的同一 Firestore transaction 內執行：新帳號建立 Revision 1；重複 bootstrap 不變更 envelope Revision／updatedAt；Phase 1 的精確 Version 1／Revision 0 骨架可受控升級為 Version 2／Revision 1。
- `submitLegacyMigrationCandidate` 仍只接受 `trusted:false` candidate；public metadata 變更時把 `serverRevision` 原子遞增。它不會建立 `gameSave`、不會設定 `authoritativeStateReady:true`，也不會把本機 timestamp 當成雲端先後依據。
- 既有 envelope 的 UID、schema、Revision、server timestamps、status／migration metadata 不一致，或非權威 envelope 混入 gameplay payload 時一律 fail closed；不再以 merge 靜默修補任意損壞文件。
- 本階段不包裝 `saveGame()`／`loadGame()`，不遷移一般進度或高價值資料，不新增付款、operationId、帳本、快照或 Phase 3 的 account switching owner。
- 本機精準測試 21/21 PASS、`npm run build:check` PASS、`git diff --check` PASS。當前 runner 僅 Java 17，Firebase CLI 15.30.0 要求 Java 21，因此本機 emulator 明確 BLOCKED；`.github/workflows/session-authority.yml` 已固定安裝 Java 21 並新增 Phase 2 unit／backend gate，遠端結果尚待 PR。
- PR #553 已合併 `dev@195acb63d4acd36ceada31ed95b5f50e448d297f`。PR Repository checks `35987380366`、PR Session Authority `35987380024`、merged dev Repository checks／DEV deploy `35987880895`、merged dev Session Authority／Firebase deploy `35987880460` 全部 SUCCESS；正式 Firebase deploy job `107595824436` SUCCESS。
- `js/firebase/firebase-bootstrap.js` 公開最小 `FourSymbolsFirebase.bootstrapCloudSave()` bridge，僅呼叫既有 Session-protected callable，不自動執行、不影響 first-use read resolution、不上傳本機 gameplay save。此入口只供最後 live 驗證與未來受控帳號流程使用。
- DEV 帳號面板提供手機可點擊的「驗證雲端存檔骨架」按鈕：連續 bootstrap 兩次後讀回 envelope，僅在 owner、Version 2、相同有效 Revision、`authoritativeStateReady:false` 且無 gameplay payload 時顯示成功；不顯示 credential、不提交 legacy／本機存檔，且不在正式網域出現。
- 2026-09-24 真實裝置驗收：使用者以原 Google 帳號在手機 Chrome 的 DEV 頁面取得 `Schema V2、Revision 1` 成功結果；按鈕連續 bootstrap 未增加 Revision，且未建立正式 gameplay state。先前從 ChatGPT 內建瀏覽器開啟時 Google 流程未完成，改用完整 Chrome 後成功，故判定為嵌入式瀏覽器 OAuth 限制而非 Session Authority 或 Envelope 失敗。PR #555 合併 SHA `b037ced9dad9d1cf67d9aacccb4e064c74a135e1`；merged dev CI `35992274605`、Session Authority／Firebase deploy `35992274447` attempt 2 均 SUCCESS。
- Requirement Batch：`release/requirement-batches/2026-09-24-cloud-save-phase2-envelope.json`，目前 COMPLETE / 6/6 VERIFIED。

### Session Authority owner

- `functions/src/session-authority.js`：唯一 session policy／transaction owner。
- `functions/index.js`：三支新 callable `createGameSession`、`revokeGameSession`、`protectedTest`；`verifyGameIdentity()` 用 Admin `verifyIdToken(token,true)` 檢查 Firebase 身分與撤銷狀態。
- 兩支既有存檔 callable 改用 `sessions.runProtected(request, operation)`，**授權檢查與資料寫入在同一 Firestore transaction**；不能在 helper 回傳後另做正式寫入。
- native auth handoff 仍只負責登入身分交換。稽核複查發現它可 mint 新 auth_time，故加入必要的相依防護：建立／兌換交接碼均在交易內驗證 source authTime 未被取代；custom token 攜帶 server-issued `sessionSourceAuthTime`，新 session 建立時再次比對，封住「先兌換、取代後才登入」的競態。Firebase revocation 同時檢查來源登入；不改原生 UI 或遊戲資料。
- 取代交易同時寫入新 record／active pointer 並撤銷上一 record。已先完成的交易可線性化於 takeover 前；B takeover 完成之後才開始的 A 操作必須失敗。

### 資料結構與安全資訊

| 路徑 | 欄位／權限 |
| --- | --- |
| `serverUsers/{uid}/sessionAuthority/current` | schemaVersion 1、uid、activeSessionId、status、authTime、revision、createdAt、updatedAt；Admin only |
| `serverUsers/{uid}/sessions/{sessionId}` | schemaVersion 1、uid、sessionId、authTime、revision、credentialHash、status、createdAt、revokedAt；Admin only |
| sessionStorage `four_symbols_game_session_v1:{encodedUid}` | UID＋authTime 綁定的 credential 或 terminal tombstone；僅 bearer cache，不是權威，不存 Firebase ID Token，不存遊戲進度 |

- sessionId 由後端 24 random bytes 產生；credential 由後端 32 random bytes 產生，僅首次回應回傳 raw credential。資料庫只存 SHA-256 hash，以 constant-time compare 驗證。公開 state/event/API 不回傳 credential。
- createdAt／updatedAt／revokedAt 全部 `FieldValue.serverTimestamp()`。本階段不用 lastSeenAt／heartbeat，不以 client clock 判断有效。
- authTime 來自 Firebase 已驗證的 `auth_time` claim（秒），不是 client timestamp。首次無 authority 的 UID 可採納既有登入；之後取代必須是比前次更新、且 5 分鐘內的登入。refresh token 不更新 auth_time，舊登入不能清除 local state 後搶回 session。
- 同一秒兩次登入無法排序：後一 acquisition 回 `SESSION_REAUTH_REQUIRED`，稍後明確重新登入；不做自動循環重試。撤銷保留 authTime tombstone，禁止復活。
- bearer 被複製即屬同一憑證，不能宣稱硬體綁定。sessionStorage clone／XSS 風險列於下方。

### Client owner 與啟動

- `js/firebase/session-client.js`：UID/authTime-bound lifecycle、重入去重、stale response discard、terminal error、logout。
- `js/firebase/firebase-session.js`：Firebase callable adapter／最小公開狀態；`firebase-bootstrap.js` 於 auth observer 與明確登入完成後同步 session；`firebase-auth.js` owner 在 SDK logout 前撤銷。
- `firebase-cloud-save.js` 的受保護呼叫捕捉原 UID，payload 不得被另一 UID 重標；不自動重新送出失敗寫入。
- `firebase-auth-ui.js` 只沿用現有 status 顯示明確 session error，不改版面。沒有新的 gameplay wrapper 或存檔 override。
- session backend 不可用時，原本 Firebase login、UID cloud read、已驗證 local boot 繼續；**受保護寫入一律失敗**。沒有 cloud promotion／local timestamp 覆蓋雲端。
- session 失效只丟棄憑證／記錄 tombstone，不刪角色、背包或 legacy save。重新整理只驗證已有憑證；失效後不自動建立新 session。
- 新模組納入 `scripts/build-production.mjs` 的既有 hashed Firebase graph 與 First Play manifest，沒有新增獨立啟動 owner。

### 原實作驗證紀錄（歷史；目前狀態以上方結案證據為準）

- 2026-09-19：7 個精準 test files 共 30 tests PASS（session client 8 cases；既有 Firebase auth、trusted backend、account ownership、auth-before-creation、boot architecture、resolved save hydration）。
- `node scripts/build-production.mjs --check` PASS。
- `scripts/test-session-authority-emulator.mjs`：本機 Auth＋Firestore emulator／direct exported handlers PASS：A 成功、B 取代、A 被拒、B 成功；UID 隔離、tampering、logout、私人路徑 rules、兩支既有 protected writer、併發取代／寫入先後、Firebase revoked／disabled identity 均通過。完整 HTTP callable 亦已於下列最終 CI 通過。
- 本機 Functions emulator 被執行環境 Unix socket `EPERM` 限制；未放寬平台權限。測試保留 TCP-only direct callable fallback，完整 HTTP callable 由 GitHub emulator job 驗證。
- `.github/scripts/run-boot-architecture-browser-qa.mjs` 同步新的 session module mock；PR #335／Session Authority run `35430277320` 的 account boot browser gate PASS，確認 backend unavailable 不破壞帳號啟動。
- 第一輪 Repository checks `35430277442` PASS；第一輪 HTTP callable 已跑過 A/B 與併發檢查，最後 revoked-identity assertion 誤將明確 `AUTH_REQUIRED` 視為通用 `UNAUTHENTICATED` 而失敗。修正 test adapter／期望代碼後重跑，不放寬後端檢查、不硬併。
- 原生 Android 身分交換既有精準測試另 6 tests PASS（未執行裝置 OAuth／整套 Android build）。
- 最終程式 `d413304550f015dc164152d1e0229dd68dcdd95b`：Repository checks [35430681904](https://github.com/tf00913225-alt/my-game/actions/runs/35430681904) **SUCCESS**；Session Authority [35430681815](https://github.com/tf00913225-alt/my-game/actions/runs/35430681815) **SUCCESS**。後者包含真實 HTTP callable A/B、rules、並行交易、revoked／disabled identity、native source epoch replay 及 account boot browser QA。
- 併發驗證使用 Firestore document `updateTime` 比較實際提交順序；`serverTimestamp()` 是 server request time，不能把其值誤當 commit ordering。未放寬交易／授權断言。
- `dev@b105f5329d95874820202b6ade78254712200d5e`：Repository checks [35430858607](https://github.com/tf00913225-alt/my-game/actions/runs/35430858607) **SUCCESS**，同 run 的 DEV deployment gate／Cloudflare 部署及部署 SHA 驗證亦 SUCCESS。Game／Cache version 均 `173.65`。
- 同一 dev SHA 的 [Session Authority 35430858389](https://github.com/tf00913225-alt/my-game/actions/runs/35430858389)：emulator job `105865040421` **SUCCESS**；Firebase deploy job `105865475494` **FAILURE**。既有 Secret 存在且 Google Cloud authentication 成功，2026-09-19 08:05:04 UTC 在 `firebaserules.googleapis.com/v1/projects/four-symbols-jianghu:test` 回覆 **403, The caller does not have permission**。
- 該歷史失敗發生於 `firestore.rules` compilation test，當時尚未進入 Functions 部署／Rules release。當時 Live Firebase／真正雲端 A/B 未完成；此阻塞已由上方結案證據解除。沒有為此建立正式環境測試帳號或修改正式玩家資料。

## D. Remaining Work（尚未完成）

1. Phase 1 功能驗收已完成；本次結案文件仍須 PR → Repository checks SUCCESS → merge dev，然後核對最新 dev 的 CI、DEV deployment、Session Authority emulator 與 Firebase deploy，逐一記錄實際 SHA。
2. 使用者已授權 dev → main 發布；只有上述最新 dev 驗證成功，且 main←dev 比較無獨立修復、素材分支混入或機密，才可建立及合併受保護發布 PR。正式部署、登入及無 DEV 測試區亦須獨立驗證。完成結果寫入[結案 PR #341](https://github.com/tf00913225-alt/my-game/pull/341) 永久發布記錄，不預填成功。
3. Artifact Registry 清理政策本身仍有非阻塞警告，保留維運追蹤；不以 Deploy complete 推定政策設定成功。
4. Phase 3 已完成；Phase 4 偏好設定試驗已部署但整批仍 0/6 VERIFIED，手機取回確認操作已通過，跨裝置 QA 未完成；Phase 5–10 仍 NOT STARTED。真正的換機角色恢復需要後端對等級、EXP、金幣、背包、裝備與領獎狀態建立可信權威與遷移策略；不能整包採納本機 gameplay payload 或把偏好測試當作正式角色存檔。

## E. Architecture Decisions（永久決策）

後續不得擅自推翻：

| 決策 | 永久規則 |
| --- | --- |
| Single Active Session | 每 UID 只有一個 activeSession；Firebase identity 之外，所有 protected operations 必須驗證 current session；trusted backend 為最終權威 |
| Cloud Authoritative | 正式進度以雲端為準；local 僅 cache／temporary／offline candidate；禁止以較新 local timestamp 整份覆蓋 cloud |
| UID Isolation | 本機／雲端資料均明確綁定 UID；A 登出／B 登入不得继承 A 正式資料；UID 必須由驗證身分取得 |
| Trusted Backend | 金幣、EXP、等級、物品、裝備、秘寶、獎勵、合成、商店、付款／退款等最終由後端驗證／計算，browser 只提意圖 |
| Revision | 正式資料採用 server-owned monotonic revision 做並行控制；本次 session revision 與 save serverRevision 是不同領域，不互相代替 |
| schemaVersion | 每個持久化 schema 都有明確版本，需具相容／遷移策略；不可把 legacy save version 當 cloud schema |
| serverTimestamp | 正式提交／建立／撤銷時間由 server 決定；local 時間不授權、不決定正式先後 |
| operationId / idempotency | 未來有副作用操作必須 UID-scoped 去重與可重送結果；session 失效不能靠重試重取權威；本次 acquisition 回應遺失要求重新登入 |
| Atomic Transaction | session check 與受保護寫入同一 atomic transaction；transaction callback 可重跑，不得內含外部付款／通知等不可重複副作用 |
| Audit Log | 後續記錄可追查的高價值操作與經濟帳本；不得包含 raw credentials／秘密；本次 session record 不是完整 audit |
| Snapshot / Backup | 後續需可驗證還原與版本／UID 一致性；不得以本機 legacy backup 冒充正式 cloud backup |

## F. Known Risks / Technical Debt（不在本 Phase 擴大施工）

- **高：** 現有 browser 可改本機金幣／EXP／物品等；舊 A 仍可操作本機遊戲，但無權經新的 protected backend 寫正式雲端。未遷移的 gameplay 不能宣稱已防作弊。
- **高：** 部分 sidecar key／in-memory singleton 固定於首次 UID，現有 startup 切換帳號未統一 reload/reset 全部 owner；核心 save guard 可降低風險，Phase 3 仍須獨立稽核與實測。
- **高：** `DATA_SECURITY_CONTRACTS.md` 仍不存在；本次七支 Functions／Rules／部署身分已有實際證據，但不等於所有 Firebase 設定或 providers 皆已稽核。repository CORS 不是授權；不可用它取代 session check。
- **已解除的歷史阻塞：** Firebase Rules IAM 403 與本次七支函式部署阻塞已解除，證據見上方。每次後續部署仍須核對實際 SHA 與結果，不能只凭 GitHub merge 宣稱後端已更新。
- **低／維運追蹤：** Artifact Registry 清理政策仍有設定警告；部署已 SUCCESS，政策本身未 VERIFIED，後續需另行查驗，不於本次擴充 IAM 權限。
- **高：** 未實作 App Check／全面 rate limit／經濟後端；session bearer 在同 origin JS 可讀，XSS／被複製 credential 不屬硬體防複製機制。新增裝置不能只靠 local deviceId 判斷。
- **中：** sessionStorage 不支援／被清除／create response 遺失／tab 關閉後，已存在 authority 的 UID 需明確重新登入；不自動搶回。匿名帳號不得為恢復權威自動建立另一 UID；應先保留原 UID 並規劃綁定／恢復流程。
- **中：** offline logout 會清除本機憑證並執行 SDK logout，但無法保證遠端 revoke 已提交；回報錯誤。已遺失的 bearer 在新登入取代前仍可能有效，不能把 local signOut 等同 server revoke。
- **中：** 不做背景 heartbeat／idle expiry／session records retention；此階段以 takeover、logout 或 Firebase 身分撤銷失效。未來加入 expiry／清理時不可刪除 authTime tombstone 使舊登入復活。
- **中：** Firebase auth_time 精度為秒；相同秒重登需再明確登入，這是保守拒絕，不以 client timestamp 猜順序。
- **中：** 舊客户端沒有 game session credential，部署後其舊 callable 寫入被拒絕；其 login／readonly read 不受影響。不能為相容而保留無 session 的寫入後門。
- **中：** native auth handoff 既有交易內 delete 後 throw 會 rollback 清理；清理／一次性交接可靠性屬原生登入獨立任務，未更動。部署前舊交接碼／舊 custom login 缺少 source authTime，不能取得新遊戲 session，需原 UID 重新登入／重新產生交接碼。
- **中：** 同一 Firebase project 為多個前端共用。`main` 程式碼未修改；部署 session authority 的後端安全行為會適用同 project 所有 caller。

## Backend 部署與 protected-test 操作

`.github/workflows/session-authority.yml`：PR→dev 執行專屬 emulator gate；merge 至 dev 後，先等該 SHA 的 Repository checks SUCCESS 並確認仍是最新 dev，才部署。沿用既有 Actions Secret `FIREBASE_DEPLOY_SERVICE_ACCOUNT_JSON`；缺少權限／Secret 則 job 失敗，Phase 1 必須保持 BLOCKED。

歷史 Rules API IAM 403 已解除；目前部署服務帳號為 `github-firebase-deployer@four-symbols-jianghu.iam.gserviceaccount.com`，七支 Functions／Rules 已實際成功部署。若未來再次遇到權限錯誤，依實際錯誤核對最小權限；本次沒有授予 IAM 角色，也沒有存取或提交私鑰。

此 workflow 依既有 path filters 在相關程式／規則／自身檔案變更時觸發，並已有 `workflow_dispatch` 入口；只有 dev 可部署。單改 Markdown 不會重跑 Firebase。本次只在既有 workflow 增加本結案文件的索引註解，使合併後既有 push 流程可驗證最新 dev；未修改 triggers、權限、部署範圍或 SHA gate。不得重跑舊 SHA 並冒稱是最新部署。

Node.js 22、Java 21（emulator）、Firebase CLI 15.30.0；backend project `four-symbols-jianghu`，region `us-central1`。

```bash
npm --prefix functions ci
npx --yes firebase-tools@15.30.0 emulators:exec --project demo-four-symbols-session --config firebase.session-emulators.json --only auth,firestore,functions 'node scripts/test-session-authority-emulator.mjs'
# 使用有權限的 ADC／正式 Secret，不把服務帳號 JSON 寫入 repo：
npx --yes firebase-tools@15.30.0 deploy --project four-symbols-jianghu --non-interactive --force --only 'functions:createGameSession,functions:revokeGameSession,functions:protectedTest,functions:bootstrapCloudSave,functions:submitLegacyMigrationCandidate,functions:createNativeAuthHandoff,functions:redeemNativeAuthHandoff,firestore:rules'
```

Cloudflare 的靜態部署不部署 Firebase。獨立部署明列三支新 session、兩支既有 save、兩支必要的 native handoff guard，共七支函式；禁止 `--force` 刪除其他函式。部署鎖沿用既有 native-auth backend concurrency group，避免兩個部署互相覆蓋。若需回退，不可部署回沒有 session check 的 protected writer 或沒有 source epoch 的 token issuer；應先停止受保護寫入並保留資料，再另修。

在 DEV 頁面登入後，可直接於帳號面板點「驗證雲端存檔骨架」。沒有電腦時以手機完成即可；按鈕不會上傳本機角色資料。開發工具仍可用來診斷（不要貼出 raw credential／ID Token）：

```js
FourSymbolsFirebase.getUser().uid
FourSymbolsFirebase.getGameSessionState() // 不含 credential
await FourSymbolsFirebase.protectedTest() // {result:"SUCCESS",uid,sessionId,revision}
```

裝置 A 登入 UID X 並確認 SUCCESS；B **獨立重新登入**同 UID X（勿複製 sessionStorage），確認 B SUCCESS；A 再呼叫必須拋 `error.code === "SESSION_REVOKED"`（若憑證不存在／不一致為 SESSION_INVALID）；B 再呼叫仍 SUCCESS。A 可以停在原遊戲畫面。新 session 只影響 X，不能撤銷 UID Y。

Wire callable 名稱是 `protectedTest`（本文 protected-test 的正式 Firebase 名稱），不修改 game save，也不建立角色。payload UID 必須等於驗證身分；session 欄位包含 uid、sessionId、credential、schemaVersion。成功事件／狀態不是將來受保護寫入的通行證，每次仍需 transaction 驗證。

## G. Next Safe Step（每次結束必更新）

**Phase 1 功能驗收 COMPLETE / 5/5 VERIFIED；Phase 2 為 COMPLETE / 6/6 VERIFIED；Phase 3 為 COMPLETE / 6/6 VERIFIED。**

1. 先讀本文件、`AGENTS.md`、`ARCHITECTURE_RULES.md`、`SYSTEM_CONTRACTS.md`、`docs/BOOT_ARCHITECTURE.md`、本次 Requirement Batch。
2. 看 `functions/src/session-authority.js`、`functions/index.js`、`js/firebase/session-client.js`、`firebase-session.js`、兩個 Firebase client owners 與 `firestore.rules`。
3. [結案 PR #341](https://github.com/tf00913225-alt/my-game/pull/341) 先以 CI 全綠合併 dev，再核對該最新 SHA 的 Repository checks、DEV 與 Firebase 部署；把最終 dev SHA／run／job 記錄於結案 PR。
4. 比較 main←dev，完成受保護 PR 與正式部署驗證；把 main SHA、production deployment 及登入／DEV 測試區隔離結果記入永久發布記錄。任一發布環節未完成，整次任務仍回報 NOT COMPLETE。
5. Phase 2 已以真實 Google 帳號在手機 Chrome 完成 Version 2／Revision 1／重複 bootstrap 不增 Revision／無 gameplay payload 驗證。ChatGPT 內建瀏覽器曾使 Google OAuth 不完整，不作為後端失敗證據；後續登入驗收必須使用完整瀏覽器或正式 App Auth surface。
6. Phase 3 已完成自動與真實手機隔離驗收。Phase 4 下一步手機 Chrome 同一 Google UID 的「取回」已顯示成功，彈窗改為「取消／套用雲端設定」並待新標籤上線確認；另一台裝置上不得為了測試局部偏好而建立／覆蓋角色。接著設計並實作可信角色／資產後端與舊存檔遷移，先確定首次採納與衝突策略，再做跨手機角色恢復測試；不得把本機存檔直接升格為雲端權威或整包覆蓋 Phase 2 Envelope。
7. 不修改戰鬥／VFX／UI、經濟／背包／秘寶、支付或 gameplay save owner，禁止 local overwrite 與無關 refactor。禁止直接修改 main／dev。

官方技術依據：[Callable 身分驗證](https://firebase.google.com/docs/functions/callable)、[Firebase auth_time／撤銷檢查](https://firebase.google.com/docs/auth/admin/manage-sessions)、[Firestore 原子交易與重跑](https://firebase.google.com/docs/firestore/manage-data/transactions)。
