# Segment 10 — 練功地區獨立標題與控制

Work ID UI-SKILL-STANDARD-20261020，PR #955；最終驗證 Head 803c309de1185e6d331a8d4967f7a717939c2fef。標題／十卡基準 e2a532203fdbce21dbb7b724b3c718a82cabd177；只將其標題與入口證據沿用，舊 body 按鍵不列通過。

真十卡入口取證發現 trainingZoneModalTitle 是獨立元件，不屬主城標題族，仍左貼且 360 頂部返回只有約42×31px／12px字。原雕框與黑鐵紋理已合格，保留原外殼、地圖、Medium 固定框、單 body scroller 及所有怪物資料／進入與鎖定邏輯。

CSS20 原 header 幾何改為獨立對稱題牌與返回兩區，span 文字置中；CSS49 原共用雕框／返回皮沿用於正式 training 宿主。第一候選33f5返回未命中，實測32.57px不通過。實際DOM診斷確認 trainingZoneModal → trainingPage → gameInterface → game-content 的420單位內容層，並非 #game-ui；不是早期推測的 overlay。只按該局部單位設定標題與控制，沒有新增 scaler／wrapper。

e2 的十卡真入口與 header 已通過，但 input 再抓到 body 進入／返回只有39.43px，不批准。最終803只將原 CSS20 `.home-feature-buy-btn` min-height46→52legacy，原測試加嚴52斷言，保留 handler／font／disabled。四尺寸所有modal按鍵最小44.571／48.657／51.009／55.714screen px。靜態focused檢查通過；Windows training fixture自行跳過 browser，不能算真瀏覽器通過，實際證據由正式loader/CDP提供。

四尺寸360×640、393×873、412×915、1280×800。e2基準十卡真touch／header返回，Lv1森林可用及九區鎖定；最終803各9張delta，首區可用、末區Lv1鎖定／Lv100可用、兩種返回。原怪物名單克隆5次是明標 synthetic 長文壓力情境，真手機touch／桌面wheel到底；最後怪物整列與兩鍵完整，header固定不遮擋。來源／bundle hash前後不變、clean，Chrome均退出。未重跑已有效十卡基準。

三方最終限定通過：美術14張基準加8張delta；scope檢查原CSS與生成物、實看四尺寸delta；input四尺寸操作／命中／真捲動。耐久證據 `docs/qa/evidence/UI-SKILL-STANDARD-20261020/segment10-accepted`。探索失敗保留，不以舊快照的字級／CI綠燈代替實圖。

未驗：實體裝置、進入區域／戰鬥／掉落、真實升級解鎖流程與未列出的載入／失敗狀態。尚未合併或部署；最新 Head 必要 CI 仍須成立。下一段先核對冒險內頁的真實入口與 fixture 綁定，不把同一頁重複截圖誤標成其他內頁。
