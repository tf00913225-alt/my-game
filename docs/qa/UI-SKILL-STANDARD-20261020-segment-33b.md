# 第33B段：裝備對照標題精簡與置中

Work UI-SKILL-STANDARD-20261020 / PR955；來源15935625a2b75b758b1ddadb8bb8a8220174f74d。before沿用33四尺寸實圖，不重跑五部位矩陣。

原JS55 header原有裝備對照/裝備比較/同部位對照三層，最後一層短螢幕又換兩行；只刪重複small，主題統一裝備對照、副標部位・武器（仍用原slot label投影），原CSS53退役無用small規則。20/18字級、1.6行高、對稱68側欄、返回44及所有scroller/action宣告不變；實際header因刪重複列自然變矮，沒有宣稱實測geometry不變。

四尺寸每2圖共8，art/input逐張看，scope四尺寸代表圖與完整diff限定通過。兩個文字Range各單行、完整置中，原title雕框保留；短螢幕body client由972增1142，真末484+1142=1626，最後stat在body內且不被fixed actions壓住。原返回page1/filter/order、2個同task觀察及六restore均通過；來源clean/hash不變。未重做已驗五部位資料矩陣。

JS55與生成secondarybundle獨立整檔反向替換後逐byte還原bb6f96e2；CSS只退役small，無遊戲資料/回呼/交易更動。既有對照regression只同步精確新標題literal，其餘assert保留，targeted1與production build/check通過。Latest Head Required CI另等。

武器白底查到原catalog011/020與母圖；docs/EQUIPMENT_CATALOG_20261008.md第7行正式記錄圖片本身不變透明。保留原素材，不用opacity/CSS隱藏、不順手重畫；此為既有素材美術品質限制，未被本段解決或拿來否定使用者觀感。後續全介面工作繼續，ring/合法長詞條、業務交易、privatecache完整還原與實機未驗。六restore僅raw/meta/actors/inventory/loadouts/equipment，baseline在startup/moduleinit後。

證據evidence/UI-SKILL-STANDARD-20261020/segment33b-centered-compact-header，原before引用segment33-occupied-five-slots。
