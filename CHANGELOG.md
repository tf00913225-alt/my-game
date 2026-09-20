# 四象江湖傳版本紀錄

## V173.67 — 2026-09-20

本版本聚焦戰鬥資訊可讀性、頭目／深淵結算、元素塔連續挑戰、秘寶介面與商店數量輸入體驗；不調整角色技能、秘寶技能、Boss（頭目）數值、怪物 AI（人工智慧）、EXP（經驗值）、金幣、掉落、獎勵或既定戰鬥速度。

### 戰鬥資訊／頭目／深淵
- 個人 Boss（個人頭目）、世界 Boss（世界頭目）與深淵戰後可查看總傷害、有效治療、承受傷害與暴擊次數；詳細結算放大並保留手動關閉。
- 左側「詳細戰況」與右側 Boss（頭目）機制資訊改為非阻塞顯示，開啟後戰鬥持續進行，不再以遮罩攔截戰鬥操作。
- 左側戰況入口固定貼近螢幕左側並支援上下拖移；戰鬥操作仍位於其上層，技能 VFX（視覺特效）維持在資訊抽屜上方。
- Auto Battle（自動戰鬥）每個正式新回合開始時短暫顯示「第 X 回合」，不改既定出手節奏。

### 元素塔
- 新增「自動挑戰下一層」選項；勝利後以 3→2→1 倒數進入下一層。
- 戰敗、到達最高層、進入條件不成立、獎勵流程未完成、取消或離開頁面時都會停止，不會自動重試失敗關卡。

### 主城／秘寶／合成
- 主城隊伍秘寶摘要回到正式配裝資料來源，並修正底部捲動空間與秘寶介面顯示。
- 符咒合成確認畫面的材料／目標圖片分工與比例修正，避免重複或顯示不清。

### 商店／補品
- 修正購買數量預設值 1 無法刪除的問題；玩家可先清空再輸入 50 等數量，不再被組合成 150。
- 空白編輯期間不允許誤購，離開仍為空白的欄位才恢復安全最小值 1；正式上限維持 999。
- 六種標準補品正式正名：HP（生命值）10%／20%／30% 為「回春散／養命丹／大還丹」，SP（技能值）10%／20%／30% 為「凝氣散／聚氣丹／歸元丹」。
- 六種補品加入正式 WebP（網頁圖片格式）圖示，商店、背包與物品詳細視窗共用同一套圖示資料；既有道具 ID（識別碼）、回復比例、價格與存檔相容性不變。

### 對應 Requirement Batches（需求批次）
- `2026-09-20-battle-stats-relic-ui-tower-auto`
- `2026-09-20-release-update-battle-ui-followup`
- `2026-09-20-potion-names-icons`


## V173.66 — 2026-09-19

本版本聚焦手機生命週期、主城第一畫面、商店與巡練穩定性，並正式加入版本更新通知與登入公告提醒設定；不調整戰鬥公式、EXP、掉落或技能數值。

### 手機與登入體驗
- 強化 Screen Wake Lock（螢幕常亮）的重新取得、有限重試與診斷；Android／瀏覽器主動釋放時，可見頁面會安全重新取得。
- 背景切換維持即時存檔，並補上 pageshow／freeze／resume／discard 診斷；普通回前景不重跑完整啟動流程。
- 主城首次顯示固定保留隊伍 HUD 與隊伍秘寶摘要位置，存檔載入後直接填入內容，減少進城後延遲與版面跳動。

### 商店／元素匣／冒險
- 商店恢復顯示目前金幣，補品購買數量統一限制為 1～999，輸入、總價、確認與實際入背包數量使用同一規則。
- 元素匣有效巡練時，HP=0 的角色可實際消耗設定中的 HP 補品恢復；缺藥不免費復活，死亡狀態不會先誤扣 SP 補品。
- 冒險委託從野怪區返回時正式結束巡怪生命週期，離場後舊打架動畫 callback 不再背景啟動戰鬥。
- 登入／進入主城不再自動顯示 NT$99「30 天免廣告服務」宣傳；底層資訊仍保留手動開啟能力。

### 正式版本通知
- 新增共用 Release Update Notification System（版本更新通知系統）：線上玩家可由跑馬燈查看更新，公告與更新內容共用同一份正式 manifest。
- 玩家每次新的登入工作階段進入主城後會顯示目前版本公告一次。
- 公告底部加入「今日不再跳出提醒」；只抑制同一帳號／同一公告的當日自動跳窗，隔日恢復，新公告不受舊勾選影響。
- 一般／強制更新仍遵守安全重新載入規則，不會在戰鬥、結算、獎勵或高價值操作途中強制刷新。

### 對應 Requirement Batches
- `2026-09-19-mobile-lifecycle-shop-elementbox-adventure-home-hud`
- `2026-09-19-release-update-notification-system`
- `2026-09-19-release-update-daily-login-reminder`


## V173.65 — 2026-09-10

本版本正式發布 Account-first 啟動架構、Critical Boot／Feature Lazy Loading、UID 存檔歸屬與可量測的效能防回歸基線；不變更戰鬥公式、EXP、掉落、裝備或技能數值。

### 啟動與帳號
- 移除 12～15 秒人工最低等待、fake 90→100% 進度與等待完整 late runtime 的全域輸入鎖。
- 建立唯一 Startup State Machine；Firebase Auth／session restore、UID 與 UID save resolution 完成後，才可能進入創角。
- 帳號畫面提供 Google、Email／建立帳號與 Firebase Anonymous 訪客；正式環境移除未登入 local-only bypass。

### 存檔歸屬與安全
- Canonical local save、背包／裝備／進度 sidecar 全部依 UID namespace 隔離；帳號切換會清除前一帳號 active memory，不共享角色資料。
- `battle_full_version_save_v5` 只作為未綁定 legacy candidate；需使用者確認、先備份、衝突 fail closed，雲端已有角色時不會被本機資料靜默覆蓋。
- Firestore browser client 維持 owner-read-only；正式寫入仍限定可信後端，不因登入流程重構而放寬安全規則。

### 效能、資產與 CI
- Production build 產生 content-hashed boot/app/gameplay/feature bundles；Critical Boot 只載帳號與下一階段必要程式，其他功能以 feature-local loading 與 idle/pointer prefetch 載入。
- 61 個 Base64 巡怪 JavaScript chunk 已移除，改為 16 個可 HTTP cache 的 hashed WebP，僅在巡怪 feature 需要時載入。
- 移除 app-shell 已打包 CSS 的重複 unhashed runtime request；mutable entry/manifest revalidate，hashed assets 使用 immutable cache。
- 新增 139 套 Node／架構回歸 suites、fresh/warm mobile browser benchmark、帳號切換、migration、功能 lazy loading、巡怪資產與部署 Live QA。

Requirement Batch：`release/requirement-batches/2026-09-09-cold-start-auth-boot-architecture.json`（12/12 VERIFIED）。

## V173.64 — 2026-09-08

本版本將已完成 DEV exact-SHA 部署、Repository checks 與實際操作驗收的技能成長、秘寶戰鬥整合及全新玩法中心正式發布。

### 玩法中心／BOSS
- 底部導覽的「BOSS」正式改為「玩法」，使用 320×320 RGBA 真透明玩法 icon，原五顆導覽尺寸與位置不變。
- 新增黑金武俠大型玩法中心，集中 BOSS、四象塔、深淵與單一「更多玩法」預告卡。
- 個人 BOSS 採固定等級、永久解鎖與不限次再戰；特殊首通獎勵每存檔只發一次。
- 世界 BOSS 為純單機永久災厄討伐，四個階段逐階保存，失敗不回退已完成階段。
- 新增護盾、蓄力、回復、增幅、封鎖五種 BOSS 機制卡；機制卡有獨立 HP 與專屬槽，不占一般敵人上限，也不產生普通擊殺獎勵。
- 護盾期間會阻擋 BOSS 點選、單體／三體／全體新直接傷害與新異常；自動戰鬥會依機制優先序正確選取目標。

### 四象塔／深淵
- 新增四象塔 100 層架構，Lv30 開放，以火→土→水→風每週輪替；週內進度與樓層首通保存，歷史最高紀錄永久保留。
- 深淵入口由日常副本移至玩法中心，Lv20／Lv40 地圖、五帝、戰鬥與既有 runtime owner 均保留。
- 深淵首通寶箱與最終特殊獎勵加入永久領取紀錄，再戰不會重複取得高價值首通獎勵；所有正常離開路徑返回玩法中心。

### 技能／秘寶／戰鬥演出
- 正式發布已驗證的玩家技能成長與境界門檻調整，包含火系戰術技、四元素支援技能與 EX 解鎖規則。
- 收斂秘寶主城入口、返回按鈕、黑金確認按鈕、戰鬥回饋與深淵八敵編成。
- 技能、傷害、HP／SP 回復與秘寶演出依既有戰鬥 gate 序列化，避免浮字重疊或下一動作提前開始。

### 對應 Requirement Batches
- `2026-09-07-skill-progression-rebalance`
- `2026-09-08-relic-ui-battle-abyss-polish`
- `2026-09-08-relic-navigation-dialog-abyss-boss`
- `2026-09-08-battle-presentation-sequencing`
- `2026-09-08-gameplay-boss-tower-hub`

## V173.63 — 2026-09-07

本版本收錄自 V173.62 之後，已完成自動化測試、DEV 部署、手機實機驗證與正式 main 發布驗證的修正。

### 合成／裝備／副本 UI
- 冶煉材料階級改為橫向滑動排列，避免內容被向下擠壓裁切。
- 裝備冶煉與材料合成內頁支援完整垂直捲動，可滑至最底部。
- 材料合成移除瀏覽器原生下拉選單，改為《四象江湖傳》黑金／階級色自訂選單。
- 材料合成圖片縮小，釋放下方設計圖升階操作空間。
- 裝備合成與符咒合成首次開啟即顯示正式 icon，不再需要先點擊一次。
- 背包装備比較改為同部位雙欄比較，修正武器／頭部／鞋子等槽位錯配與「明明已裝備卻顯示未裝備」。
- 裝備比較重新分隔 icon、數值與穿戴／售出／鎖定操作區。
- 副本獎勵預覽框加高，長文字不再穿出框或壓到背景圖片。

### 全域 UI／手機操作
- 全遊戲禁止雙指 pinch zoom，同時保留合法的單指上下／左右捲動。
- 全遊戲圖片、SVG、Canvas 等視覺素材禁止長按叫出下載、分享、Google Lens、開新分頁等瀏覽器原生選單。
- 禁止遊戲視覺素材原生拖曳與非輸入區文字選取，避免破壞手遊操作感。

### 戰鬥／技能動畫
- 修復技能 VFX 偶發或整體不顯示問題。
- 恢復玩家與怪物技能 badge 對 V142 動畫 runtime 的 direct trigger，不再依賴容易被後載入程式覆蓋的 wrapper 順序。
- V142 支援 partial-sentinel recovery：若只留下 installed 旗標但 director／trigger 不完整，會重新建立動畫 runtime。
- 移除 V173.51 QA 對 V143 VFX stage visibility 的錯誤 ownership，避免技能名稱／傷害出現但特效舞台被隱藏。
- 新增永久 regression，防止未來再次退回 wrapper-only 導致技能動畫失效。

### 系統／發布安全
- 正式移除巡怪省電模式舊 DOM、handler、設定 key 與相容性 WakeLock 殘留。
- Release Gate、Requirement Checklist、deprecated-code assertion、DEV exact-SHA deploy 與部署後 SHA/version/cache read-back 已實際運作。
- 正式版本升級現在必須同步更新本 CHANGELOG；沒有對應版本紀錄時 CI 會拒絕發布。

### 對應 Requirement Batches
- `2026-09-07-synthesis-dungeon-equipment-ui`
- `2026-09-07-synthesis-vertical-scroll`
- `2026-09-07-synthesis-first-render-icons`
- `2026-09-07-global-ui-gesture-vfx-lock`
