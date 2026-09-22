# 《四象江湖傳》System Contracts / 系統契約

本文件定義跨模組、跨版本都必須維持的正式系統契約。若歷史註解、測試、交接或舊功能卡規格與本文件衝突，以本文件與最新需求批次為準。

## 戰鬥目標契約

- 一般戰鬥維持 `single / tri / row / column / all` 的 Fixed Slot（固定格位）規則。
- Boss（頭目）專屬模式內，Boss、援軍、圖騰、戰旗、法器與技能召喚物都是獨立的數字索引 target entity（目標單位）。
- Boss 模式中，除 `all / enemyAll` 外，所有技能只結算 primary target（主要目標）。視覺範圍與傷害目標數量彼此獨立。
- Boss 是單一 entity（單位）；中央 `B2/B3/B4/F2/F3/F4` 六格只構成 visual footprint（視覺佔位）、點擊面積與 VFX（視覺特效）錨點，不得複製六份生命或傷害判定。
- 援軍只使用 `B1/B5`；Boss 技能物件只使用 `F1/F5`。
- Boss 技能物件使用一般敵方單位呈現與受擊管線，但必須 `canAct=false`、不進 AI（人工智慧）行動序、不提供一般掉落或擊殺進度。
- 金剛護體是 Boss 自身 Shield（護盾）；傷害先扣 Shield，剩餘值才扣 Boss HP（生命值）。
- `MECH_L / MECH_C / MECH_R`、`mechanism:*` 字串目標與功能卡傷害管線已退役，不得重新加入。

## 戰鬥呈現契約

- 玩家、普通／精英敵人、Boss、援軍、圖騰與戰旗全部使用無卡框立繪。
- Fixed Slot 只擁有站位、幾何、點擊、HUD（資訊介面）與 VFX 錨點；不得重新成為可見卡框。
- `FourSymbolsBattlefieldSlots` 是格位與範圍幾何唯一 owner（控制來源）；`battlefield-render-geometry-adapter.js` 只投影 DOM（文件物件模型）；`FourSymbolsBattlePresentation` 只裝飾立繪與瞬時回饋。
- 動態生成單位必須在插入 DOM 當下套用正式 presentation（呈現），不得依賴輪詢修正。
- 受擊回饋只使用傷害數字、立繪震動、技能 VFX 與爆擊效果；`.red-hit` 根卡框狀態已退役。Heal（治療）不得使用傷害語意。
- 玩家與普通敵方共用資源條高度與 HUD 錨點；Boss 可使用自己的大型 HP／Shield HUD。

## VFX 與回合流程契約

- V142 只擁有視覺生命週期與剩餘時間；V143 只擁有 raster VFX（點陣視覺特效）渲染與幾何。
- `00-main.js` 是 `finishPlayerAction()` 與 `processNextCombatant()` 唯一 owner。功能模組不得替換這兩個函式，也不得以 Promise（非同步承諾）阻塞回合佇列。
- 功能模組需要觀察或暫時攔截完成通知時，只能使用 `FourSymbolsBattleFlow` 的訂閱／攔截 API（應用程式介面），並確保攔截器可解除。
- single 的中心是實際目標格；tri 即使只剩一個單位也保留三人格視覺尺寸；all 永遠保留完整目標側範圍；projectile（飛行技能）從施放者中心飛向正式主要目標中心。
- DOM 例外、MISS（未命中）、Buff（增益）、Heal、Shield、Debuff（減益）與 VFX 清理都不得讓同一 initiative（行動序）永久等待。

## 持續效果回合生命週期契約

- 「持續 N 回合」必須提供目標 N 個真正有效的行動／限制機會；不得由無關的大回合邊界預先扣除。
- Buff（增益）在目標實際行動結束後才消耗 1 回合；施放 Buff 的那次行動不消耗剛建立的 Buff。尚未行動的受益者可立刻在自己的行動享受效果，已行動者必須保留完整 N 次後續有效行動。
- Freeze（冰封）與 Petrify（石化）以實際阻止行動次數計算；N 回合必須阻止 N 次行動，玩家與所有怪物階級使用相同語意。
- Burn（燃燒）是獨立 DoT（持續傷害）生命週期：套用當下不額外跳傷害，之後在正式 Status Tick（狀態結算點）恰好造成 N 次傷害。
- Frostbite（凍傷）及其他有回合數的軟性 Debuff（減益）不得再以玩家專用 `deferFirstTick` 形成不同算法；同樣在受影響單位的有效行動邊界消耗。
- `FourSymbolsDurationLifecycle` 是持續回合扣除的共用協調入口；新技能不得另建全域 round-start 倒數或 timer（計時器）繞過它。

## Battle Statistics（戰鬥統計）與戰況介面契約

- `FourSymbolsBattleStatistics` 是每場戰鬥統計的唯一 owner（控制來源）；每場開始建立一次、戰鬥中累積、結束時凍結同一份 snapshot（快照），戰後結算禁止重新推算第二份數字。
- 統計必須以 combatant ID（戰鬥單位唯一識別）為 key，至少支援 `playerCharacter`、`heroNpc`、`reinforcement`。禁止寫死三名玩家角色；未來 Hero NPC（英雄非玩家角色）只能註冊進同一 owner，不得另建統計核心。
- 正式統計欄位只有：實際總傷害、有效治療量、實際承受傷害、真正 Critical（暴擊）次數。技能施放次數不是正式欄位。
- 傷害／治療只能從戰鬥結算前後的實際 HP 差額或正式 settlement（結算）事件累積；不得讀浮字、VFX、紅字顏色或戰鬥紀錄反推。
- Shield（護盾）、減傷、Barrier（結界）、無敵／吸收後未真正扣 HP 的部分不得算承受傷害；Overheal（過量治療）未另有正式規則前不得算入有效治療。
- 左側「戰鬥數據」Drawer（抽屜）與右側 Boss 功能卡 Drawer 都是 non-blocking observer UI（非阻塞觀察介面）：打開時不得取得 `FourSymbolsBattleFlow` pause／presentation lock，Auto／Manual Battle（自動／手動戰鬥）都必須照常推進。閱讀介面具有顯示優先權：任一戰鬥數據／Boss 功能卡 Drawer、底部戰鬥資訊 Drawer 或戰鬥狀態詳情開啟時，技能 VFX、技能名稱與傷害／治療浮字不得覆蓋閱讀內容；允許僅暫停其 paint（繪製／顯示），但不得停止 VFX timing gate、回合流程或目標點擊契約。左側入口固定貼齊戰場左邊並允許玩家上下拖移。
- Auto Battle（自動戰鬥）回合提示是正式 round lifecycle 的 0.5 秒 tracked lock；新回合成立後先顯示「第 X 回合」，提示結束後才允許第一個宣告／行動。手動戰鬥維持既有節奏。
- 個人 Boss、世界 Boss、深淵可在 battle finish 後顯示 `FourSymbolsBattleStatistics` 的 frozen snapshot，直到玩家主動關閉；一般巡怪與每日副本不得因此增加長駐結算 Modal。

## Boss 功能卡資訊契約

- 右側驚嘆號與 Drawer 只投影目前正式 Boss object entity（功能物件）狀態；不得重建已退役的 `MECH_*`／`mechanism:*` 第二套機制資料。
- Drawer 必須列出目前所有存活 Boss object，而非只列第一張；名稱、效果、觸發來源、目前狀態、倒數／剩餘回合全部從 `FourSymbolsBossBattle`／active battle context（當前戰鬥上下文）讀取。
- 功能物件生成、被破壞、倒數、退休時必須同步 inspector（檢視器）；沒有存活功能物件時紅色「！」必須消失。

## Element Tower（元素塔）自動續戰契約

- 「自動挑戰下一層」屬 `gameplay-boss-tower-system.js` 的正式 Tower lifecycle（塔生命週期），不是戰鬥核心第二套迴圈。
- 勾選後只有本層正式勝利且下一層存在／可進入時才啟動 3 → 2 → 1；倒數必須使用單一受管理 timeout owner，禁止裸 `setInterval` 或離頁後仍存活的背景計時器。
- 戰敗、最高層、下一層不存在、進入條件不符、正式 launcher 回報不能繼續、玩家取消或離開 Tower 頁面，皆必須取消倒數並停止自動挑戰；戰敗禁止自動重試同層或跳下一層。
- 第 50 層等正式獎勵／秘寶選擇 gate（閘門）若阻止下一層，必須停止自動續戰，不能繞過正式 progression（進度）條件。

## 布陣與儲存契約

- `FourSymbolsBattlefieldSlots` 的六個我方格位與 V131 既有 Formation（布陣）面板是唯一布陣系統。
- 首頁布陣入口必須載入並開啟正式面板；交換／前後排調整後透過既有 `saveGame()` 與帳號存檔 owner 持久化。
- 不得建立未連動正式 party formation state（隊伍站位狀態）的第二套視窗。

## dev → main 發布契約

- `main` 只代表已在 `dev` 通過驗證的發布內容，不是獨立開發線。
- dev → main 發布檢查若發現 Bug，必須從最新 dev 建立新的 `fix/` 分支，修復並以 PR（合併請求）回 dev；CI（持續整合）通過且 dev 合併後，才可重新執行 main 發布檢查。
- 禁止只在 main、發布 PR 的 head（前端提交）或發布暫存分支修一份 dev 沒有的程式差異。
- 永遠維持：`main ⊆ 已驗證 dev`。若 `main = dev + 獨立修復`，發布必須停止。

## 玩家正式版本通知契約

- `release/release.json` 是工程用 Game／Cache Version 唯一來源；`release/release-update.json` 是玩家可見 `releaseVersion`、`noticeId`、標題、摘要、完整更新內容、發布時間、`normal / forced`、`minimumVersion` 與 `publicNotice` 的唯一來源。三個玩家入口（線上跑馬燈、首頁／首次登入公告、Update Detail Modal）必須讀同一份資料。
- `release-manifest.json` 記錄部署 Commit SHA 與驗證，僅供部署核對；不得拿 Git SHA 當玩家版本或公告唯一識別。
- `js/release-update-notification.js` 在 startup ready 後檢查一次，之後每 4 分鐘、頁面回到前景與網路恢復時以節流方式檢查。請求必須 cache-bust 並採 `cache: no-store`；失敗安靜略過，不能阻塞登入或遊戲。
- 玩家每次新的登入工作階段進入主城後，當前正式版本公告必須自動顯示一次；`last-seen` 只控制已讀／通知狀態，不得永久阻止後續登入公告。公告底部固定提供「今日不再跳出提醒」checkbox（勾選框）；勾選後只以 per-UID `localStorage` sidecar 記錄當地日期＋目前 `noticeId`，同一帳號／同一公告僅當日停止自動跳窗。隔日必須重新顯示；同日若 `noticeId` 改變，新公告仍必須顯示。此設定不得寫入 Cloud Save、UID、金幣、背包、裝備或任何權威遊戲資料。
- 一般更新只通知、可稍後更新；玩家點「立即更新」時才 reload。強制更新在安全狀態顯示不可略過的既有共用 Modal；若正在高風險操作，只標記 pending，完成後才鎖定後續操作，絕不半途 reload。
- 安全 reload 的唯一判斷為 `canSafelyReloadForUpdate()`：戰鬥／戰鬥演出或結算、獎勵、背包交易、合成／冶煉／商店高價值視窗、帳號存檔寫入與已登記的 critical operation 均為不安全。未來任何非同步雲端寫入或高價值 transaction 都必須使用 `beginCriticalOperation()` 登記其生命週期。
- 每次 dev → main，除非專案負責人明確說「本次不公告」，發布 owner 必須自行從實際 `main...dev` 全量 diff 整理所有玩家可感知變更，再更新同一份正式 manifest；純文件、CI、開發工具或完全玩家不可見的內部修改才可以不公告。
- DEV／本機驗收可在精確允許 host 加上 `?releaseUpdatePreview=marquee`（點擊跑馬燈再看視窗）或 `?releaseUpdatePreview=modal`（直接看視窗）。預覽仍只讀正式 manifest，不能寫 localStorage 已讀紀錄、不能 reload，且正式 `main` host 必須完全忽略該 query。Preview Modal 不得顯示「立即更新」造成可更新假象，主要動作固定使用「關閉預覽」或等價明確語意。
- 禁止 rebase（變基）、force push（強制推送）或直接修改 dev／main。
