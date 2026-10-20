# Segment32C interaction review

結論：四尺寸限定通過。Reviewer interaction_review 已逐張實看各尺寸 `growth-failure-end.png` 與 `failure-list-return.png`，共8張，並獨立核對四份 report；未啟動 Chrome、未修改 production。

Snapshot：`89ec4b167df6482f7509451b64072150acb0d3ac`。
Evidence：`artifacts/ui-skill-standard/segment32c-hero-failure-end-89ec4b16/clamped-return/{360x640,393x873,412x915,1280x800}/`。

- 四 report 均 complete/clean/sourceUnchanged，單次 growth503 後至末端仍 ready=false、busy=false、error 非空，readCount=7，沒有把恢復狀態當作失敗末端。
- 手機原 touch gesture／桌面 native-client mouseWheel 操作原 `#heroPageContent`；四尺寸終點均 `4207 + 1350 = 5557`。最後「神犬紅包被動」完整全文墨跡位於 owner 內，底部保留約19.42／21.20／22.22／24.27 screen px，沒有被框或固定返回壓住。題牌、原列表返回可見。
- 真列表返回後，原儲存 `heroPageListScroll=1353` 保留；503清除proof使新列表最大位置變1299，實際四尺寸皆1299，精確等於 clamp(1353,0,1299)。舊 failure-end 的「原px必等1353」失敗屬QA契約錯配，原證據保留，不當產品修復。
- 返回圖兩個正式owned ID卡均存在；神犬卡全文/人物/等級完整，原選中卡 EFP 命中、尺寸79.33×188.44至99.17×235.55，達44。每尺寸5次正式tap attempt均hit且非disabled；原headerclose也真tap。
- raw/meta/actors/inventory/selection/saveApi 六項exact restore全true，mutations皆空。Node端canonical heroAccount未變；原save wrapper仍委派，不因此宣稱一般零save。finally腳本包含CDP關閉、Chrome process tree終止與server關閉；此review未額外啟程序或獨立取得OS cleanup快照。

限制：僅isolated GET503失敗後閱讀末端及返回；未驗私有Hero client caches精確還原（報告明列false，以fresh profile隔離）、實機觸控/軟鍵盤、真實供應商網路事故、重新開啟/自動read、claim/equip/upgrade/formation save/戰鬥或其他交易。未將本段擴稱英雄全狀態完成。
