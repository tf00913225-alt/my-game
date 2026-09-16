# 永久架構規則

1. 先找出此功能目前真正的來源檔、主要函式與既有後續覆蓋點。

2. 一般修改優先直接修正該功能的主要來源，不新增新的 vXXX runtime patch。

3. 若因相容性風險必須新增暫時補丁：
   - 必須在 HANDOFF.md 記錄原因、影響函式、原始來源檔與未來收斂位置。
   - 同一個函式不得連續疊第三層補丁。
   - 下一次再修改同一功能時，必須把既有暫時補丁收斂回單一權威實作。

4. 不可對 renderBattle、winBattle、技能結算、存檔讀寫等核心函式反覆 wrapper 疊加；先整合既有邏輯再修改。

5. CSS 優先修改該頁／該元件原本的樣式；禁止只靠新增更後面的 CSS 和 !important 壓過舊規則。

6. 每次修改後，測試必須以「所有正式腳本都載入後」的最終遊戲行為為準，不能只測單一歷史補丁。

7. 新功能要指定唯一 owner 檔案；HANDOFF.md 必須記錄它的權威位置。

8. 不順手全面重構；只在本次修改的同一子系統內做小範圍收斂。

## Boot Architecture

1. Critical Boot 只包含首次操作真正需要的模組；權威清單為 `asset-manifest.json` 的 `critical`。
2. 非 Critical feature 禁止阻塞 startup；功能邊界由 `config/feature-manifest.json` 與 `window.FourSymbolsFeatures` 管理。
3. 禁止 artificial startup delay；不得以 logo、cinematic、廣告或固定秒數延後已就緒的下一階段。
4. 禁止 fake loading progress；100% 必須表示目前下一個帳號／創角／主城階段已可操作。
5. 禁止以 sequential HTTP request 維持大量 runtime execution order；需要順序的 legacy source 必須在 production bundle 內固定順序，bundle 間依 dependency graph 執行。
6. 圖片禁止以大型 Base64 字串切成多個 JavaScript chunk。
7. 圖片必須使用正常資產檔、content-hash 與 HTTP cache；非首屏圖片預設 lazy 或 background preload。
8. Character creation 必須在 Firebase Auth 與 UID save resolution 都成功後，且 StartupStateMachine 已進入 `NEED_CHARACTER` 才能顯示。
9. Account identity 必須先於 character ownership；沒有 Firebase UID 時禁止建立正式角色，訪客也必須使用 Anonymous Auth UID。
10. local save 必須 account-aware；canonical save 與 sidecar key 都必須包含目前 UID，gameplay schema 與 ownership metadata 分離。
11. 帳號切換不可共享前一 UID 的 active save、記憶體角色、背包、裝備或進度；切換 UID 必須先解除 owner 並重建 runtime context。
12. Firebase optional service 可以 fail gracefully，但身份與存檔判斷不可 fail-open；已驗證 UID 的完整本機存檔才可進 `OFFLINE_READY`。
13. 不可因 Auth、Firestore、localStorage 或 migration error 誤判成「新玩家」，也不可因此顯示創角或清除資料。
14. 新增 feature 預設為 lazy/non-critical；只有能證明它是帳號畫面、創角最小依賴或第一個可操作畫面必要依賴時，才能加入 Critical Boot。
15. 修改 startup architecture 必須同步更新 boot manifest、production build、`docs/BOOT_ARCHITECTURE.md`、架構測試與 browser QA。

## Cross-System Contract Authority

跨系統狀態、帳號安全與付款權益的永久權威邊界如下：

1. **`SYSTEM_CONTRACTS.md` 是跨系統狀態正確性與生命週期契約的最高權威文件。**
   - 負責 Canonical Owner（唯一正式擁有者）、Source of Truth（唯一真實資料）、Lifecycle（生命週期）、Mutation（狀態變更）、Invariant（不變條件）、Transaction（交易）、Derived State（衍生狀態）、Async（非同步）、Test Fixture（測試夾具）、Impact Audit（影響稽核）與 Regression（回歸驗證）。
   - 任何新系統或既有邏輯修改都必須先完成其 System Contract Check（系統契約檢查）。

2. **`DATA_SECURITY_CONTRACTS.md` 是帳號、資料、雲端、安全與後台權限的最高權威文件。**
   - 負責 Firebase（雲端服務）、Firebase Auth（身分驗證）、UID（使用者唯一識別）、本機／雲端存檔、多裝置同步、Migration（資料遷移）、Firestore Rules（資料庫安全規則）、Secret（機密）、個人資料、Log（紀錄）、Environment Isolation（環境隔離）、管理員後台、Backup（備份）、Restore（還原）與 Disaster Recovery（災難復原）。

3. **`PAYMENT_ENTITLEMENT_CONTRACTS.md` 是付款、訂單、虛寶權益、退款、補發與對帳的最高權威文件。**
   - 負責 Real Money（เงินจริง）、Order（訂單）、Payment Provider（金流服務商）、Webhook（伺服器通知）、Server Verification（伺服器驗證）、Transaction ID（交易編號）、Idempotency（冪等性）、Entitlement（玩家付費權益）、Grant（發放）、Refund（退款）、Revocation（回收）、補發、郵件補償、Reconciliation（對帳）與 Audit Log（稽核紀錄）。

4. 現有專項權威文件維持原責任，不被上述三份文件取代：
   - `AGENTS.md`：AI（人工智慧）施工前置要求、專案開發與 QA（品質保證）固定流程。
   - `CLAUDE.md`：既有開發代理規則。
   - `HANDOFF.md`：目前專案狀態、歷史施工、交接與暫時補丁紀錄。
   - `ARCHITECTURE_RULES.md`：檔案 Owner（擁有者）、Wrapper（包裝）、Patch（補丁）收斂、Boot（啟動）與整體架構施工規則。
   - `UI_GUIDELINES.md`：一般 UI（使用者介面）規範。
   - `docs/ITEM_RARITY_UI_SPEC.md`：物品階級與固定色號專項權威。
   - `docs/IMAGE_ASSET_SPEC.md`：圖片格式、WebP（網頁圖片格式）、透明度、尺寸、Sprite Sheet（精靈圖集）／VFX（視覺特效）資產流程專項權威。

5. 禁止把三份 Contract（契約）文件整份複製到其他規範。其他文件只建立清楚的責任邊界與交叉引用，避免形成第二套規範或版本分歧。

6. 若規範發生交叉，依問題類型判定最高權威：
   - 狀態如何合法形成、誰能修改、生命週期何時成立：`SYSTEM_CONTRACTS.md`。
   - 帳號屬於誰、資料如何保存／同步／授權、Secret（機密）如何保護：`DATA_SECURITY_CONTRACTS.md`。
   - 錢是否收到、何時能發貨、如何防重、退款與對帳：`PAYMENT_ENTITLEMENT_CONTRACTS.md`。
   - UI（使用者介面）呈現：`UI_GUIDELINES.md` 與其專項規格。
   - 圖片資產格式與導入：`docs/IMAGE_ASSET_SPEC.md`。
   - 物品稀有度階級與色號：`docs/ITEM_RARITY_UI_SPEC.md`。

永久原則：**先證明一個狀態如何合法形成，再修改使用這個狀態的程式。**
