# 四象塔挑戰特性驗收（2026-10-02）

Work ID: TOWER-CHALLENGE-PROFILE-20261002；PR #757；整合 dev，main 排除。Game／Cache 173.72 不變。

## 功能證據

- Candidate: a1e208abd223c1f6f20d978f65a95822dd79fb34。
- CI run: 36984210420；Tower challenge gate PASS。完整 Repository checks 在此紀錄建立時仍執行中，不以單一 gate 冒稱全 CI 成功。
- Artifact: 11216788440，tower-challenge-6438c6a1ce6e2ba8551f65c0342faa9bafdd449f。JSON 的 passed=true、commitSha 與候選一致。27 場依序為四元素各 [1,5,10,45,75,100]，再 water100、water100、fire1。
- Production Chrome 412×915，正式 index／bundle／lazy owner；只隔離外部 Firebase transport，未讀寫玩家／雲端資料。登入公告透過 closeHomeFeature 正式操作關閉，所有場景檢查沒有覆蓋的 shared modal。
- battle／rules PNG 已檢視：塔戰鬥十隻敵人可見，規則段落完整顯示十人與 65/70/75/80%。這是 Chrome 手機模擬，非 Android 實體操作驗收。

## 31 項需求對應

- 01～02：正式 towerSkillChance 配合四元素×100層 Node 矩陣；瀏覽器每單位 1000 個分層 roll 驗證 65/70/75/80%，火塔沒有第二次加成。
- 03～05：calculateDamage／getMonsterCriticalChance 實際函式測試直接物理／法術 ×1.15、爆擊 +15 與 cap；DoT、Burn、Reflect、Relic、Object、HP Cost、Self、Environment 排除。
- 06～07：正式 enemy turn 消耗 SP 並回復低血量友軍；自然回合十隻皆宣告冰封。HP 治療 1000→1150，SP 未受 healing factor 改動。使用原有合法 Heal／Freeze，未發明獨立水系 Buff。
- 08～10：正式狀態公式 30+15=45、52+15 封頂60、999封頂60；Node 覆蓋玩家→Regular／Elite／Boss 90/75/60、敵→玩家60，及一般異常5～95。
- 11～18：四元素×100層的各階級數值、Profile 重複套用不變、其他模式 metadata 隔離；正式 Chrome 記錄 evasion／speed／HP／defense。風塔首層閃避15、速度11.5，未由速度衍生命中／閃避；土塔 HP／Defense ×1.15。
- 19～20：正式 tower page 規則 DOM 與 PNG、SYSTEM_CONTRACTS 對齊。
- 21～25：四元素×100層每層10，Regular10、Elite2+8、Boss1+2+7，含100層；Chrome代表樓層確認真實 roster與格位。
- 26～28：正式 all-target cast 對10個獨立目標各造成298傷害與一筆HP feedback；唯一10格、死亡不重排；其他形狀解析維持既有上限。
- 29～30：最高層水塔自然佇列 actions=[0,1,2,3,4,5,6,7,8,9]，每隻恰好行動一次，十次冰封，正式Round-End完成；不加速／跳過動畫或以for-loop取代Runtime佇列。
- 31：既有15項 Boss回歸、四象塔／Personal／World隔離與小Boss單格契約通過；未改一般野怪、副本、深淵、玩家技能、六圍或命中核心平衡。

## 修復過的測試缺口

舊 Gameplay UI guard 保護退休火塔+8%與風／土12%，已遷移新15%規格。測試啟動需等待正式 Startup owner READY；27場不能仍計24。早期被登入公告遮擋的截圖不作可見畫面證據。所有真實戰鬥斷言保留，新增完整場景順序及shared-modal遮擋檢查。

## 整合與部署

31/31 是功能證據。最新文件Head的必要CI、PR合併、dev Repository checks、Cloudflare部署及release-manifest SHA仍須另行核對；不得以本文件替代它們。工作分支只在內容已吸收且無有效PR後安全清理；main不修改。
