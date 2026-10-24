# dev758 UI 合併前相依核對

只讀 origin/dev=758fe75cbdfe66a80a11a36b339fcbc7b6e21126；未 merge、未改 tracked、未開 Chrome。

190d249e..dev 的 js00 唯戰鬥狀態詳情立繪、敏捷欄及開啟回頂；技能配置、shared skill progression core/loadout、Firebase loader/config 無新增差異。cc2842c5..758 僅 #979 js39 airshot、單張素材、正式SYSTEM相關段與測試/證據及生成物；不影響35靜態巡邏已驗來源。

仍需保留 #958 的 css40/fixedslot、js01 touchlock、js54、geometry adapter 新增戰鬥 Owner；#975 functions recovery 屬上游既有內容，不能以UI合併改寫。builder target 新增 LF 正規化，生成產物必須由合併來源重建，不能選整份舊bundle覆蓋。

建議源保護 proof：以共同 base/兩邊來源獨立三方重建 js00、css40、fixedslot、js54 等共有修改檔後逐byte比 staged；35 css00/js17/js26、css31、js41/js42/js59及其相關CSS無 incoming delta，要求 staged 等 UI HEAD；上游 js39/asset、functions、builder 無 UI改動則要求 staged 等 dev。政策檔排除來源摘要後比較上游，重建摘要；index 僅准生成href區差異。

最小驗證：正式 build/check、35既有訓練/靜態入口 focused、相關 battle status/fixedslot/touch/airshot targeted；共同必要 CI 以新合併Head執行。若只生成衝突且 source proof 全通，不重跑35完整四尺寸；後續battleUI使用新Owner時補相應原症狀實圖。不得本機重跑完整SDK/Cloud矩陣。現階段尚未看到實際merge結果，不能預稱無衝突或新Head已通。
