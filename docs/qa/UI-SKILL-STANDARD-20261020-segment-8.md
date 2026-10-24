# Segment 8 — 角色建立原樣式

Work ID: UI-SKILL-STANDARD-20261020；PR #955；驗證 Head: 8433f93d451e3f9c0072c64c14f8df681e6f8130。

只在 CSS29 的原主框、標題與展示區沿用技能頁黑鐵雕框，移除舊菱形與 L 角。CSS56 的立繪、字級、配點與返回配置保留，沒有 JS、數值、建立或帳號權威修改。551b9fc2 為來源、159027d5 補齊生成 critical link；8433f93d 正常 merge dev 9a093762（含 #963 stylesheet-ready QA），最終 build --check 通過。

四尺寸 360×640、393×873、412×915、1280×800，各 19 張畫面／38 筆紀錄，Head、來源與載入 bundle hash 保持不變、工作目錄乾淨。實際點選男女／四元素、十二個加減控制、能力說明收合、長名稱切步、空名稱錯誤、上一步與取消。首次建立情境為隔離 fixture，不是真實帳號。技能詳情由既有 API 開啟後真實關閉，現有 DOM 沒有 creation-skill-chip，不能當作真入口驗收。

三位獨立審核限定通過：美術實看 15 張與四份報告；互動看四尺寸實圖與操作；scope 看前後圖、CSS29 與生成物及 dev merge。題牌在對稱框內置中、底部操作完整、無新遮擋；內部卡片維持技能頁克制細框，不額外雕框。

未驗：有效建立／雲端提交、實體裝置／鍵盤、processing／retry 的實際瀏覽器畫面、技能詳情等級 4～10 捲動。單元測試的 pending/reject 不代替畫面驗收。最新 Head CI 39388097548 尚在執行，Session Authority 39388097549 成功；尚未合併或部署。

耐久證據：`docs/qa/evidence/UI-SKILL-STANDARD-20261020/segment8-accepted`。原 before 為 segment7-main-before-fa402d1c（該創角來源至本段前未變）；after 為 segment8-creation-8433f93d/resolved。失敗探索的不存在 selector 不列為產品 bug 或通過證據。

下一段真實副本四類預覽入口已取證：舊 CSS43 的 360px 強制寬度與 CSS53 原始 px 字級在 native stage 被縮成約 120px 窄條與 4～5px 正文；舊短預覽 API 不能代表正式四類入口驗收。優先修原 Owner，保留獎勵、機率及交易邏輯。
