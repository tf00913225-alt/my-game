# 第十三段：商店卡片與操作觸控

Work ID：UI-SKILL-STANDARD-20261020；PR #955。Before `ad5c3f95`（production5d），DOM before `8062139d`；修復 `0b408c143114b5407634e6e8071fd0dbe909b4f8`，最終 `639391f4245b0535c7d4aef35cca746bb244bc8a`。

四尺寸實圖證實裝備卡「可冶煉」被價格鈕壓住；360 DOM 字墨與按鈕重疊2.333screen px。原 css53 把末列設108native，卻讓按鈕126native且垂直置中。將現有字級與完整行列回原 css49 Owner，刪除 css53 六條重複覆蓋；末列及購買鈕132native，至少44screen。商店局部 header token 為44；補品數量欄／購買列與按鈕同步132native。標題、美術、內卡、品階色與各頁排版保留。

真末端驗證另發現物品獲取途徑返回僅40.75screen；css42 min40覆蓋原css33 min44。只移除該min-height覆蓋，保留字級與行高，回原元件Owner。沒有JS／價格／數量上限／機率／刷新與購買handler／交易或權威變更。

360×640、393×873、412×915、1280×800：0b各12張呈現涵蓋補品無金幣／可操作／999量／確認取消／待確認時金幣改變拒絕、裝備／預覽／獲取途徑／已購買fixture／資料損壞fixture／特定QA UID儲存QuotaExceededError失敗提示及返回；最終639各10張delta含補品／裝備／獲取途徑／冶煉規則原scroller真touch或wheel末端、預覽與返回。全部相關操作／數量欄至少44screen；逐6卡reforge與buy overlap=0；最後內容不被footer壓住，來源雜湊不變、clean。

三方限定通過，權威證據在 `evidence/UI-SKILL-STANDARD-20261020/segment13-accepted/`。保留並排除：最初body直系dialog錯誤與誤以補品點擊立即報金幣不足的探索、0b不足高度失敗、639根目錄誤把主城DEV28px工具納入商店scope的失敗；最終只使用resolved四份完整報告。Windows standalone preview browser自動skip不當Browser QA，真CDP另有上述證據。

沒有成功購買／刷新／領獎／存檔、真帳號或真機驗收。正式刷新為unlimited test mode直接操作，沒有前置確認彈窗，該狀態N/A，不新增假頁。待完成其他台帳／Latest Head Required CI／dev部署；不能稱全商店所有業務或全介面完成。

Next：第十四段成就／公告／離線經驗／系統；四尺寸before在639已完成。成就真分頁可達，但外框捲動把標題與返回捲走，需原Owner修復與真手勢驗證。
