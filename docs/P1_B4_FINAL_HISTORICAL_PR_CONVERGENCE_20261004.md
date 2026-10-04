# P1-B4 #566／#548 最終歷史 PR 收斂

Work ID：P1-B4-FINAL-HISTORICAL-PR-CONVERGENCE-20261004。
分類：Convergence／Removal；Target dev；main 全程禁止修改。
開工 dev：`da66cd015258d8baf2a330cb70c02d6018480ddf`。
開工 main：`f63d69dbfa66ba75637d1c3cd7fcc7d74782e356`。
Branch：`chore/p1-b4-historical-pr-convergence-20261004`。
本工作 PR 是最終 CI／merge／deploy／close／branch cleanup 的耐久狀態 Owner；以下未執行 Gate 不預填成功。

## 即時歷史 PR 盤點

- Open PR：#566、#548、#788。#788 僅只讀保護盤點，未修改／關閉／改 Base／合併／使用其分支。
- #566：OPEN，Base dev，開工 API base SHA `62585458d850e278e6b0ca8ead75c4781f2693cc`，head `d70acab0906a7af4d78e7f6b0e32fb4878492054`，branch `feature/four-element-skill-final-spec-20260925`。完整 20-file patch（含 generated build）與7 commits 已讀；不能直接合併。
- #548：OPEN，Base dev，開工 API base SHA `c496e30a651a9bec4851e040234f42db9d58aded`，head `aff0c821b164056e26f359c4dba6c1ccc39c9080`，branch `chore/remove-portrait-inbox-from-dev-20260924`。完整15-file刪除清單、唯一commit 已核對。
- #566 commits：a91e8a1f、b89a10b0、3c7649d9、66d4b510、03de32e9、7b1c30d6、d70acab0。全部屬技能／狀態／選擇／呈現／測試需求，沒有其他獨立有效功能。
- #548 唯一commit aff0c821 只移除零位元組 .gitkeep，無圖片、程式、Registry 或 Provenance 變更。
- 当前 dev 為 NORMAL DEVELOPMENT；本批不是 Release Freeze／main 發布／P1-C。

## #566 能力判定

有效產品需求全部 ABSORBED／SUPERSEDED；MISSING=0。
「唯一正式資料 Owner」不代表所有歴史檔案／兼容戰鬥 wrapper 都應刪除；本批不擴大重構。

| 能力 | 判定 | current-dev 證據／責任 |
| --- | --- | --- |
| 火技能資料 | ABSORBED | 單一 skillDatabase；V173.64 FINAL_REBALANCE_DATA／applyFinalProgressionData 投影火系正式數值，舊 #566 FOUR_ELEMENT_DAMAGE_SPEC 不回復。 |
| 水技能資料 | SUPERSEDED | 同一 V173.64 final data；凍傷／吸血與 SP 吸取使用現行規則，V169 不再擁有資料表。 |
| 風技能資料 | SUPERSEDED | 同一 final data；最終命中／閃躲與風 EX 依現行契約，不恢復歷史數值。 |
| 土技能資料 | SUPERSEDED | 同一 final data；防禦下降、護盾、結界與 EX 使用現行陣列／數值。 |
| 技能學習門檻 | ABSORBED | getSkillLearnEligibility／getRequiredCharacterLevelForSkillLevel；水系 revive／purifyMind 保留 healSpell 或 frostCrush 前置路徑。 |
| 技能升級 | ABSORBED | 31 個直接傷害技能 Lv10、輔助依現行 maxLevel（部分 Lv3、EX Lv1），每級 1 點；Lv5／10 突破由核心 getSkillDamageAtLevel。 |
| SP 消耗 | ABSORBED | prepareAction／executeAction／敵方 AI 讀同一 skillDatabase.spCost；正式支援 ByLevel 不做临時數值覆寫。 |
| Target Type | SUPERSEDED | FourSymbolsBattleSkillTargeting → FourSymbolsBattlefieldSlots；全體技使用存活確認錨點，隱身不排除全體技，取代 #566 的隱身錨點限制。 |
| 異常狀態 | SUPERSEDED | 核心 calculateStatusEffectChance／rollStatusEffectHit 與 Persistent State Gate；Round End consumeRoundEndDurations 取代舊 action tick／#566 粗略 sweep。 |
| 被動技能 | ABSORBED | category=passive 不進手動施放；核心 stats 與 EX hooks 讀正式資料。 |
| Four Element EX | SUPERSEDED | V173.64 四個 EX final data；現行水 EX 治療15%／淨化35%、土 EX DEF35%／HP×1.2、風 EX 命中閃躲15%及低HP cap 等優先。 |
| Element DNA | ABSORBED | calculateDamage 使用 attacker.element 對 defender.element；skill.element 只保留技能視覺／身份。 |
| Cross-Element Learning | ABSORBED | 需一招本命技能；跨修免 requires，初學×2、後續1點；EX 本命限定。 |
| Cross-Element Equip Limit | ABSORBED | normalizeCrossElementEquip／normalizeAllCrossElementEquips 保留第一招跨修，學習／裝備／存檔／Ready Gate 共用。 |
| Skill Runtime declaration | ABSORBED | 核心 prepareAction／selectBattleTarget／selectBattleAllyTarget／returnFromBattleTargetSelection；三角色、all 確認、取消重選、exactly once 測試通過。 |
| AI 使用技能來源 | ABSORBED | 核心 chooseMonsterAction／selectAutoAction 等讀正式資料；V144 元素 allowlist、V155 深淵固定級為各自玩法 adapter，不是第二玩家資料表。 |
| UI 顯示技能來源 | SUPERSEDED | FourSymbolsSkillSpec effectText／levelRows／learnEligibility／upgradeEligibility；核心技能頁／Quick Bar 讀正式資料。#566 快捷列歷史座標由現行 Fixed Slot CSS 取代。 |
| VFX linkage | ABSORBED | V142 時間、V143 Sprite/Status manifest、正式 Targeting／Battle Flow；隱身僅立繪35%及炎勢無Body/HUD圖。 |
| Legacy skill tables | SUPERSEDED | V140/V149/V169 歷史資料寫入已退休，保留各自仍有效的結算／敵方支援／追擊 adapters；沒有第二份正式平衡來源。 |
| Late patch／wrapper retirement | SUPERSEDED | 正式 final data／說明／target／duration 各有明確 Owner；歷史戰鬥兼容 wrapper 仍承擔結算/追擊責任，不能誤稱所有 wrapper 已刪除。#566 未帶來額外有效退休需求。 |

原 PR 附帶呈現能力亦已核對：

- battle-item icon／adaptive height：js/00-main.js renderBattleItemMenu 與 css/00-main.css 正式 .battle-item-icon／height:auto／max-height／55px row 已存在。原PR誤把element icon指向藥水、10%藥水指向30%圖的變動屬 CONFLICTING，不搬回。
- timer／quick-bar scope：css/fixed-slot-battlefield-rendering-v2.css 正式 tokens 與 v135-sq-scope；歷史硬寫112px／-46px由現行幾何 SUPERSEDED。
- persistent status：js/39-v143-skill-animation.js 正式 noBodyVisual／noHudIcon；現行狀態淡入淡出與詳情資料測試通過，歷史CSS不得覆蓋。
- relic identity decode：js/60-team-relic-system.js loadBattleIdentityImage → resolveBattleIdentityIcon → beginRelicCinematic 在decoded實圖準備完成後啟動身份時序，原能力 ABSORBED；現行overlay／target projection保留。
- 舊 v174-four-element-owner-convergence.test.js 保護過時 table token／座標，OBSOLETE；有效行為由現行專項測試承接。
- #566 的舊技能數值／水EX／土EX／隱身all anchor限制與粗略turnsLeft sweep 對 current contract 為 CONFLICTING；其有效意圖已由上述 Owner 完整替代，不代表仍有 MISSING。

正式規範已核對 AGENTS、HANDOFF、SYSTEM_CONTRACTS、ARCHITECTURE_RULES、UI_GUIDELINES、Change Safety、Release Readiness 第21章；不新建 Skill Database、不補 wrapper、不改技能平衡。核心與現行final data完全不寫入。

## #548 能力判定

開工總判定：MISSING（僅15個空目錄標記尚未清理）；永久素材保存／Runtime 分離已 ABSORBED。
本新 PR 只承接仍有效的零位元組結構清理，合併後才可判定完整吸收／關閉。

| 能力 | 開工判定 | 證據／處理 |
| --- | --- | --- |
| dev 原始 Inbox | MISSING | 指定子樹恰有15個0-byte .gitkeep，無圖片；逐檔清理。 |
| assets-library Master 來源 | ABSORBED | 即時recursive tree完整且15個最底層來源目錄存在；assets/ASSET_INDEX.md只讀。 |
| Runtime WebP 與 Master 分離 | ABSORBED | 永久流程：assets-library PNG → dev WebP → Registry／Provenance → V154。 |
| Registry／Provenance 完整性 | ABSORBED | 現行Permanent Image Gate與portrait audit驗證；本批完全不改其blob。 |
| Runtime 直接讀 Inbox | ABSORBED | 執行源無正式Inbox讀取；prepare-static-deployment排除assets/inbox。 |
| 測試依賴 Inbox | SUPERSEDED | Wind／Earth／Water測試讀遠端Master path字串／provenance，不需dev空標記；刪除後原測試驗證。 |
| 採用素材永久化 | ABSORBED | runtimeReady來源／sha256／canvas／decode由現行Gate驗證；既有planned／retired不是本批待導入需求，不將全Registry冒稱existing。 |
| Archive／Quarantine | SUPERSEDED | reserved損壞土小Boss與來源隔離證據保留；刪除清單無此內容。 |
| 舊刪除清單是否過時 | SUPERSEDED | 僅15個 .gitkeep仍適用；不得擴張到圖片或整個assets/inbox。 |
| current dev 相同清理 | MISSING | 開工尚未完成；由本新PR吸收，不能直接merge #548。 |

## 素材類型／刪除安全

- A Runtime：assets/monsters等正式WebP完全保留。
- B Master、D assets-library来源、E已採用Master：全保留於assets-library，不寫入該分支。
- C Provenance：config/monster-asset-provenance.json及Registry完全保留，遠端Master path字串不等於dev目錄依賴。
- F暫存／重複：本批只刪下列15個0-byte .gitkeep，不批次rm圖片。
- G Quarantine、H Reserved：現行來源失敗證據與reserved記錄全部保留。
- dev的assets/inbox/README.md與美術圖標記非#548刪除清單，保留。
- 清理前確認：0-byte檔案無圖片內容，Runtime／Registry無.gitkeep引用，Master全部在正式來源；生成器透過--master-root讀assets-library，Tests不依賴dev目錄標記。
- assets-library recursive tree未截斷；15個來源目錄逐一存在。不是刪素材，不會更動正式fallback選擇。

精確移除清單：
- `assets/inbox/英雄or怪物立繪/土元素/小Boss/.gitkeep`
- `assets/inbox/英雄or怪物立繪/土元素/普通怪/.gitkeep`
- `assets/inbox/英雄or怪物立繪/土元素/菁英怪/.gitkeep`
- `assets/inbox/英雄or怪物立繪/大Boss/世界Boss/.gitkeep`
- `assets/inbox/英雄or怪物立繪/大Boss/個人Boss/.gitkeep`
- `assets/inbox/英雄or怪物立繪/水元素/小Boss/.gitkeep`
- `assets/inbox/英雄or怪物立繪/水元素/普通怪/.gitkeep`
- `assets/inbox/英雄or怪物立繪/水元素/菁英怪/.gitkeep`
- `assets/inbox/英雄or怪物立繪/火元素/小Boss/.gitkeep`
- `assets/inbox/英雄or怪物立繪/火元素/普通怪/.gitkeep`
- `assets/inbox/英雄or怪物立繪/火元素/菁英怪/.gitkeep`
- `assets/inbox/英雄or怪物立繪/英雄/.gitkeep`
- `assets/inbox/英雄or怪物立繪/風元素/小Boss/.gitkeep`
- `assets/inbox/英雄or怪物立繪/風元素/普通怪/.gitkeep`
- `assets/inbox/英雄or怪物立繪/風元素/菁英怪/.gitkeep`

## 本機驗證與後續Gate

- 現行技能／宣告／狀態／UI相關既有測試：40/40 PASS，0 skip。
- Permanent Image Gate：117個runtimeReady provenance條目PASS；portrait runtime/import與Earth/Wind來源／隔離證據：5/5 PASS，0 skip。刪除後再次執行相關測試；audit ok=true、brokenReferenceCount=0、missingExisting=0（37個planned保持既有狀態）；build／build:check PASS且generated產物無diff；git diff --check PASS。
- 本批Runtime／CSS／圖片／Registry／Provenance／Cloud／Monster Balance／版本／release requirements完全不變；Game／Cache 173.73／173.73。
- 最新head CI、合併dev、合併後CI／部署及SHA：PENDING。
- 合併且有效內容完整承接後，在#566／#548留言完整證據再Close；來源分支另核對其他Open PR／獨立有效內容／永久或backup身份，再安全刪除。
- 若所有剩餘Open PR均為有效施工，P1-B正式結案；本次不執行P1-C。
