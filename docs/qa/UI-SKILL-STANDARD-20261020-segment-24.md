# Segment24 主城：施工中，未驗收

Work ID: UI-SKILL-STANDARD-20261020；Branch: fix/ui-skill-standard-polish-20261020；PR #955。

最後 production candidate: e17bc6d3402f4448832be52e9d3ccef7a09ddba8。尚未通過實畫驗收，禁止以本文件稱主城完成。

## 實際症狀與排除候選

- 1cf6761c，360×640真production loader與隔離本機QA帳號：16字長名在主城角色列被ellipsis隱藏，頂部長名與大資源擠壓。獨立美術代理實看退回。首次regex轉義QA語法錯無畫面，不計產品故障。
- 8aff17a6：原CSS00身份/資源改單欄，沿用技能panel115切片；原CSS19角色名可換行、等級獨立列。長名完整，但固定場景被壓縮造成八入口重疊，退回。QA固定資源seed相等斷言另失敗；正式經驗池另含v173GetAvailableExpPool自然充能，並非遊戲來源故障，不為QA凍結數值。
- 4860783e：原home自身overflow-y:auto及場景minmax900native，入口不再重疊，但auto tracks仍讓身份內容與角色列重疊，退回。實際角色頁入口成功後，既有「？」按鈕40×38，44px觸控要求失敗。不是全主城驗證通過。
- e17bc6d3：原home grid明確max-content身份/角色列/摘要與最小900native場景，原css49唯一共用header按鈕min-height38→44、min-width44。此候選尚待真滑動及畫面驗證。沒有更動JS/數值/資源計算/存檔/玩法handler。

## 已執行檢查與下一步

正式build及build --check通過。既有v173.39-main-city-final-polish、v173.28-main-city-lobby、v173.65-dev-deploy-home-utilities共8項focused回歸通過；不是畫面驗收。

下一步：普通/16字名、一/三角色、大資源當次renderer讀值、通知實際DOM、home唯一真scroller首末端、八入口/底列間距、角色/佈陣/秘寶摘要真入口返回位置及底nav離開返回。四目標尺寸360×640、393×873、412×915、1280×800目前新候選皆未驗。摘要canonical local fixture須還原原save/meta bytes，不能稱零副作用或裝備交易驗收。無真帳號、雲端寫入、創角、交易、獎勵、戰鬥驗收。

實際失敗候選畫面與partial/failure報告存於evidence/UI-SKILL-STANDARD-20261020/segment24-candidates；保留失敗，未截斷/縮字/降透明度遮掩。
