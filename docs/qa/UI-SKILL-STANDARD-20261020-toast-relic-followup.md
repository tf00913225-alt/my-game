# Shared toast 與秘寶滑鼠補驗

Work ID：UI-SKILL-STANDARD-20261020；原 #955 / fix/ui-skill-standard-polish-20261020；parent 8a056cd141c48cb17f5faec48e8aa9fad93a1c1c。本輪保留既有視覺與操作證據，不重新全跑舊矩陣。

## 實際問題與最小修正

原 shared.toast 台帳沒有生命週期證據。正式 showLevelUpToast 的 show=true / opacity=1 不代表玩家看得到：360 修前截圖完全沒有通知。原 levelUpToast 留在 legacy app，下方 native game-ui 的主城蓋過它。原 setupNativeGameUi 名單加入同一個 levelUpToast；其原 CSS 改為 native 固定單位、合理寬度換行與技能頁既有 rpg-window-frame。沒有新增容器、樣式 Owner 或全域補丁；不改 API、2600ms timer、等級、獎勵、存檔或教學。

原 builder 同步 app-shell JS、boot CSS、index hash 路徑及兩個 manifest。restricted-forest-instance-policy.json 唯一變更為 main sourceDigest；政策語意未變。三個 typography focused suites、build/check、diff-check 通過。

## 新實際證據

[證據目錄](evidence/UI-SKILL-STANDARD-20261020/shared-toast-relic-followup/)：before/ 為真正修前；after/ 為四尺寸修後；relic-mouse/ 為原8a056cd1未改來源的新增mouse巡檢。各 report 綁 parent、完整來源hash與生成包hash；修後 dirty source 由 source-proof.json 精確識別，不能把8a056cd1本身稱為修後版本。

- 四尺寸360×640、393×873、412×915、1280×800；合計108張新增路徑圖，另留一張升級提示修前圖。
- 秘寶8分類真mouse點擊、橫列雙向拖曳、長owned詳情上下至末端、返回與重開；補證真mouse右端582/左端0、兩端額外拖動clamp、每步active仍全部，及真card overlay開詳情。原16/18美術證據保留，不以此次mouse新增要求倒推舊視覺全部未驗。初稿只到330等中間值的圖，不當端點驗收。
- 原 v141ShowBlackGoldReward 展示API：短/長摘要、4200ms自然移除show、真mouse點擊dismiss、A→B同DOM替換；A到期後B仍show，B新期限後隱藏。
- 原 showLevelUpToast 展示API：16字名稱與等級全文、2600ms自然移除show。四尺寸修後圖真正可見，原黑鐵/古銅材質，未裁字或遮主要入口/nav。提示作為短暫前景會覆頂部資源區。
- 不執行真發獎、升級、裝備、強化、領取、戰鬥或存檔入口。原UI自身seen/save sideeffects留在隔離profile，不宣稱完全沒有save呼叫。展示API同task只核對腳本實際序列化的actors/gold/sharedExp/inventory/loadouts/localStorage；equipment/uid的非正式optional讀值不作證，未核完整owned。秘寶補證正式getTeamLoadout()、gold/inventory前後相等。沒有凍結原timer；private cache/所有瞬態不主張exact還原。瀏覽器viewport不是手機硬體。

## 獨立審核

remaining_audit_review實看四尺寸秘寶及toast圖並對照技能標題素材；relic_input_review核對四尺寸真input、時序及圖；pending_scope_review核對原來源/生成包反向diff、政策只有digest並看360前後圖。三類限定通過，詳見 independent-review.json。hover金色曾被誤認分類切換，已由active資料撤回，沒有以誤判修產品。

## CI 與剩餘

8a056cd1 的 check-runs、workflow-runs、statuses皆空；PR mergeable=false。原CI pull_request事件適用dev，合併衝突期間無PR CI，不能算通過或稱測試首錯。唯讀merge-tree定位七個衝突：兩manifest、戰場CSS、restricted policy、Adventure runtime、cloud skill loadout test、戰場test。保存 ci-merge-conflicts.json。未取消/重跑/降級CI，也不跨線修Chrome、工具、Story或安全政策。

已回寫原261項台帳 shared.toast 及三個秘寶項目的限定stateEvidence；其餘有效歷史保留。這不是所有介面/標題/業務狀態完成：最新Head必要CI、正常dev相依吸收與原台帳未列證狀態、硬體/PWA實機及真業務仍待完成。shared.prompt原本無正式入口維持不適用，不造DOM驗收。排程955維持PAUSED，未合併/部署/main發布。
