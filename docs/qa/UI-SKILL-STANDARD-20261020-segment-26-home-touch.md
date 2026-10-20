# 第26段：主頁工具觸控與標題入口限定驗收

Work ID：UI-SKILL-STANDARD-20261020。原CSS00只修改DEV按鈕min-height44ui／font15ui，底部工具按鈕與其父grid列同步132native（360下44px）。不改四入口、DEV資源數值、資料或任何handler。

## 快照綁定

來源bf51672f7672382462ceeb23ed26081c4f291564的四尺寸實測各17張PNG與四入口返回，但報告均正確記dirty:true。原因為build同步的新critical CSS href漏納index.html提交；root查明唯一一行e7a5→1a331，補存至f7a837cdba2d7ce7e5421d24083ef7ffa35712a2，build/check通過。

原四報告全部120個source hash與新Head Git blob、目前檔案逐位元相同；原dirty事實與無loaded欄位保留，不冒稱bf是clean。另以clean f7四尺寸各兩張主頁頂／末煙測，直接記performance資源：新boot-core.1a331d452911.css回應200、sheetReady／774規則、無舊critical CSS請求或CSSHTTP失敗。來源與Head固定且clean，不重跑原17場景矩陣。

正式證據：evidence/UI-SKILL-STANDARD-20261020/segment26-home-touch-accepted，內含原檔、逐檔等價證明及clean-loader-smoke。實測尺寸360×640、393×873、412×915、1280×800。

## 限定結果

1／3名合法16字角色、主頁真捲頂末與通知空／有；DEV兩鍵只量測44px與15px，不點擊資源。四工具成就／公告／離線經驗／系統真入口、題牌、原header返回與原主頁anchor保留，末端與底nav分離。

- art_review：實看四尺寸24張主頁與四入口代表圖，長名、題牌置中、禁用文字、原雕框與內卡層次可保留，限定通過。未以代表圖批准全部其他狀態。
- interaction_review：實看四尺寸首末、入口／返回及clean煙測八張；44px／15px、四anchor、通知DOM、實際資源載入與120／120來源相同，限定通過。
- scope_review：實看四尺寸代表圖、原三行CSS與四報告，另核clean煙測及逐位元等價，無DEVclick／業務JS修改，限定通過。

未驗或未操作：四目的頁的全部內容與業務狀態、領取／廣告／刪除／存檔、DEV加資源、編隊／秘寶交易、實體裝置及硬體鍵盤。不是全主城、全標題或全遊戲完成結論。Latest Head Required CI／dev合併／實際部署仍待後續正常Gate。
