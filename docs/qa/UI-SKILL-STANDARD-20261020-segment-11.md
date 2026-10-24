# Segment 11 — 冒險內頁、標題與可讀資訊

Work ID UI-SKILL-STANDARD-20261020，PR #955，最終驗證 Head 5d905b7cb41574fc0e2a067d84b2d697611d370f。來源fd1b1567加必要捲動修復5d905b7c；無交易／進度／獎勵／存檔邏輯改動。

真城市入口／節點／primary按鈕取證：事件、休息、寶箱、分岔、委託仍使用普通棕色圓角外框與左貼標題。商人數量／持有量遭省略、已購文字暗、按鍵偏小；分支小字在短屏低於可讀底線。原 CSS adventure Owner 沿用技能雕框與黑鐵紋理，主header／panel／節點sheet使用各自對稱題牌。保留地圖、座標、圖示、事件左右布局、分岔與商人雙欄、原捲動結構；沒有依兩個overflow猜測重構。商品文字完整換行、禁用保留、按鍵52legacy，兩個眉題以原正式中文術語統一。

商品完整換行後，正式 hidden merchant node 真觸控證實原renderer沿用地圖scroll：fd時scrollTop98、title.top5.906小於view.top61.621。原renderer現在只在切換panel回頂，同panel更新保閱讀位置，返地圖保map位置。新增回歸直接執行正式UI renderer，涵蓋上述三種位置責任，無新observer／wrapper。5d實際操作merchant98→98、map1584→1584。正式同類不同node入口先經map，不依未證實情境新增修復。

原active「已自動存檔」曾蓋住章節返回。CSS0位置與CSS42字級Owner接受冒險context值，原冒險view預留44legacy底帶，提示bottom8／font16／line20；原1600ms顯示與Save行為保留。實際350ms active提示與返回重疊面積為0，未透過縮字／淡化／裁內容遮掩。

四尺寸360×640、393×873、412×915、1280×800，root各18張修後；input真城門→五種node／primary／頂返回，隱藏商人真node入口→title在頂→touch或wheel末端→同頁render→離攤還原map。長名稱／數量是明標synthetic呈現壓力，不當正式物品。補四尺寸branch-selected-locked隔離fixture：一條真正disabled，文字可讀，未點choice。章節完成為API呈現fixture，真捲末並只呼叫showAutosaveIndicator顯示API，未觸發存檔。來源／bundle hash前後一致、clean，Chrome均退出。美術、input、scope看實圖及操作後限定通過。

耐久證據 `docs/qa/evidence/UI-SKILL-STANDARD-20261020/segment11-accepted`。before權威segment11-before-resolved-a4cc347d（四尺寸）；before-scroll-fix另綁fd。舊803 fixture誤改getView副本造成同event／map重複，全部排除；resolved改canonical隔離fixture並嚴格assert selectedNodeId／panel／class。舊商人diagnostic未關既有角色modal而hit技能頁，亦排除；真正商人證據來自明確closeHomeFeature後真hidden node。不得以這些探索失敗批准產品，也不誤報成產品bug。

focused9項與新增捲動回歸通過、正式build生成含index同步。未驗：實際購買／事件選項／休息效果／開箱／領獎／選路／戰鬥／真通關、真實帳號或雲端、實體裝置與未列同步錯誤。最新Head必要CI尚未通過，不合併／不稱已部署。

下一段鑲嵌空／滿／選單實圖初查已符合原題牌與雕框，先保留，只補長選單／末端真操作；其餘台帳仍逐項續驗。
