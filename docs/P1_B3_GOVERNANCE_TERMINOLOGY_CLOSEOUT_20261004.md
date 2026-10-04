# P1-B3 治理／Boss 術語歷史 PR 收斂

Work ID：P1-B3-GOVERNANCE-TERMINOLOGY-20261004。分類：Convergence。
開工 dev：`13c22561afc518ce33b7da798b32e1c215e3cbde`。
開工 main：`f63d69dbfa66ba75637d1c3cd7fcc7d74782e356`，全程禁止修改。
分支：`docs/p1-b3-governance-terminology-convergence-20261004`。整合目標：dev。

## 開工判定與來源

- #670：OPEN／衝突；head `c4fdccf2281cca46e87a179e8dbd791894c0c469`；只有 AGENTS、CLAUDE、自主修復契約三檔，25 行新增。四個來源 commit：92486f1f、6c6683ed、5ed10ed6、c4fdccf2，全屬同一治理規則。一般 Bug Fast Path 已部分吸收，通用任务規則仍缺。判定 PARTIALLY SUPERSEDED（部分被取代），有效意圖由本工作新版文件完整承接，禁止直接合併舊 PR。
- #542：OPEN／衝突；head `0830692b448bb7a8997c6f964eed40cef192ef0f`；只有 AGENTS、立繪規格兩檔，13 行新增。來源 commit：8a0be01d、0830692b，全部是術語。塔的小 Boss／單格契約已存在，但世界／個人大 Boss 與深淵小 Boss 完整定義未吸收。本工作補入仍有效定義，不搬舊入口編號或改尺寸。
- 上述四個 current-dev 對應文件與 current-main 對應文件開工內容一致；main 無本批尚未吸收規範。舊 PR changed files、完整 patch、各 commit 均已核對；不存在其他獨立有效變更。

## 正式 Owner 與邊界

- DEV merge：AGENTS「DEV PR 自動整合規則」。CLAUDE、自主修復契約、Bug Fast Path 只引用；不重複建立另一套批准規則。
- main／Release／Freeze／P0／P1：docs/RELEASE_VERIFICATION_RULES.md（尤其 16、21 節），本批未修改；使用者確認、最新 Head CI、資料／帳號／付款／不可逆安全 Gate 保留。CI Validation 的禁止合併草稿仍保留限制。
- Boss 術語：docs/MONSTER_PORTRAIT_SPEC_V1.md 第 0 節；AGENTS／CLAUDE／根立繪入口／SYSTEM_CONTRACTS 引用。世界與個人統稱大 Boss；深淵等一般首領是小 Boss。玩家玩法名稱與內部 World Boss／Personal Boss／Abyss Boss／mode／rank／Registry key 保留。
- footprint：SYSTEM_CONTRACTS 與正式 Battle Owner；Tower／Daily／Abyss 不因 rank=boss 套用大 Boss 六格。深淵五帝既有尺寸／素材保留，立繪規格第 1 節以下逐字未改。
- Monster Balance Phase1／2A／2B、retirement map、Monster Portrait Registry、Boss／Tower／Abyss 契約與相關測試已只讀核對；未修改其 Runtime 或資料。UI 玩家名稱保留現有玩法文案，無全域 Replace。

## 文件需求驗證

1. DEV 不再要求重複 MERGE-DEV 確認：VERIFIED（本機文件一致性／入口引用／安全邊界核對）。
2. 大／小 Boss 正式定義與既有資料／素材／格位獨立：VERIFIED（文件一致性與既有 Tower 契約驗證）。

本機證據：文件 UTF-8／完整 HANDOFF 機械讀取與關鍵規範掃描；單一 Owner 與四個術語入口核對；Release／架構契約未變；既有尺寸段落逐字比較；相關 JSON 僅 parse、未修改；release-gate PASS（既有30/30，不能誤報為本批新增需求）；release-update-notification-system 12/12 PASS；tower-element-formation-small-boss 契約與4×100 matrix PASS；git diff --check PASS。

MERGE-DEV／merge approval／manual approval 全文搜尋只命中取消二次確認及入口引用；沒有 active 強制人工 DEV 二次批准。main 發布確認與 Cloud operator approval 是不同 Gate，保留。歷史 HANDOFF／Release Scope 的候選紀錄不作當前指令；現行 NORMAL DEVELOPMENT 由最新發布後結案段落確認。

本批只允許文件、交接与必要結案證據；不更動 release/requirements.json 或任何 Runtime／CSS／Assets／Workflow／版本。Game／Cache 173.73／173.73 不變。未跑全站回歸或手機 QA。

## 整合與清理 Gate

最新 Head 必要 CI、合併 dev、合併後 CI／DEV deployment 與 SHA、兩個歷史 PR comment／關閉／分支清理：PENDING，最終證據必須寫入本工作 PR 與歷史 PR，不預填成功。
舊來源分支只有有效內容已被完整替代、未被其他 PR 使用、非永久／長期分支時才刪除；PR 關閉不是自動刪除依據。
#566／#548 全部排除，未進入 P1-B4。Cloud／Monster Balance／每日副本／鍛造／一般 Bug／UI／新功能／main 不在本批範圍。
