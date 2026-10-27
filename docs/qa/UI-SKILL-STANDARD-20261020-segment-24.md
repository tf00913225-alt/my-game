# Segment24 主城：四尺寸限定驗收，仍有明列缺口

Work ID: UI-SKILL-STANDARD-20261020；Branch: fix/ui-skill-standard-polish-20261020；PR #955。

最新 production: 51d7116c3baa2cfa058e79c55fd1e79bbd56f98b。四尺寸限定畫面／操作通過；範圍與未驗項目見下方最新驗收節。禁止以本文件稱全主城完成。以下候選記錄保留施工歷史。

## 實際症狀與排除候選

- 1cf6761c，360×640真production loader與隔離本機QA帳號：16字長名在主城角色列被ellipsis隱藏，頂部長名與大資源擠壓。獨立美術代理實看退回。首次regex轉義QA語法錯無畫面，不計產品故障。
- 8aff17a6：原CSS00身份/資源改單欄，沿用技能panel115切片；原CSS19角色名可換行、等級獨立列。長名完整，但固定場景被壓縮造成八入口重疊，退回。QA固定資源seed相等斷言另失敗；正式經驗池另含v173GetAvailableExpPool自然充能，並非遊戲來源故障，不為QA凍結數值。
- 4860783e：原home自身overflow-y:auto及場景minmax900native，入口不再重疊，但auto tracks仍讓身份內容與角色列重疊，退回。實際角色頁入口成功後，既有「？」按鈕40×38，44px觸控要求失敗。不是全主城驗證通過。
- e17bc6d3：原home grid明確max-content身份/角色列/摘要與最小900native場景，原css49唯一共用header按鈕min-height38→44、min-width44。此候選尚待真滑動及畫面驗證。沒有更動JS/數值/資源計算/存檔/玩法handler。

## 已執行檢查與下一步

正式build及build --check通過。既有v173.39-main-city-final-polish、v173.28-main-city-lobby、v173.65-dev-deploy-home-utilities共8項focused回歸通過；不是畫面驗收。

下一步：普通/16字名、一/三角色、大資源當次renderer讀值、通知實際DOM、home唯一真scroller首末端、八入口/底列間距、角色/佈陣/秘寶摘要真入口返回位置及底nav離開返回。四目標尺寸360×640、393×873、412×915、1280×800目前新候選皆未驗。摘要canonical local fixture須還原原save/meta bytes，不能稱零副作用或裝備交易驗收。無真帳號、雲端寫入、創角、交易、獎勵、戰鬥驗收。

實際失敗候選畫面與partial/failure報告存於evidence/UI-SKILL-STANDARD-20261020/segment24-candidates；保留失敗，未截斷/縮字/降透明度遮掩。

## 四尺寸限定驗收 checkpoint

Production 51d7116c3baa2cfa058e79c55fd1e79bbd56f98b。原記錄e17以下為施工歷史，並非最新待驗結論。四尺寸每份22張圖、31筆操作，clean/sourceUnchanged，全部腳本exit0；三類代理看實圖限定通過。主城原panel、完整短/16字名、資源分區及當次完整值、1/3角色/HP-SP/通知、真唯一home捲動、5類返回anchor、角色TAB全名、編隊前後排及無候選最後說明已驗。

實際另修原header art覆蓋38px、status-confirm本地44px/generic退讓、formation remove/footer44、原img flex不定高撐大改既有48藝術區；footer由文字夾兩動作浪費一列改狀態整列/兩動作並排，保原拖曳/同步handler。原showcase inline ellipsis退為原CSS49專用name class，JS可逆byteexact；正式restricted policy只有js00來源摘要，所有策略值不變。

**仍非整頁或全遊戲驗收**：
- 摘要fixture在relic owner init之後寫canonical local save；主城summary讀新值，秘寶頁私有hydrate仍舊runtime。只批准空/loaded摘要呈現與真導航返回，不批准跨頁loaded資料一致性，不判產品存檔故障。
- 角色0/1/2跨能力/技能/經驗TAB選角、未創建可建/鎖定、完整英雄編隊、真拖曳/移出/同步成功、pending第三按鈕仍未驗。
- DEV控制28px、主城footer工具42px未列44px通過，仍待修。
- 本機canonical fixture與原UI可能有mark-seen/save副作用，僅原save/meta bytes已精確還原，不能稱零副作用、裝備/交易或雲端驗收。
- 無實體手機/鍵盤/載入拒絕重試/戰鬥/創角/獎勵/交易驗收。

完整88張圖、四份report/all-text、獨立review與後續失敗候選保留於segment24-accepted；原始before與早期失敗候選保留於segment24-candidates。後續source51d修法已讓本三角色/無英雄候補的編隊自然fit，不再靠卡片上滑/窄gutter或跳過end；滿英雄/更長內容仍未驗。

最新必要CI未核定，未合併或部署。下一段25：48實際技能詳情與原角色TAB切換補驗，另補摘要ownerinit前canonical fixture及主城剩餘觸控缺口。
