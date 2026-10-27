# 第十六段：秘寶詳情、自選與載入重試

Work ID UI-SKILL-STANDARD-20261020；PR #955。Before67772d2ab22e476b7554765a5863960bea8adb4d；主要UI f817bf18c364b1949ff08f5d39cdb301e35f4a7b；最終delta f3ee2487856b71b31aa08b624d59a19e1d4da8ec。

原列表、雕框、短秘寶牌、品階邊線／四象呼吸與詳情內卡已合格，保留。真主城入口4→卡片揭露→詳情，列表body.scrollTop1346被保留，詳情clamp1025，名稱與立繪y約-261～-136完全在body72～622外。原js60只在新詳情markup完成後、首paint前scrollTop=0；invalid guard與資料全不改。既有nav測試執行原函式，驗1346→0先於paint、invalid保留1346，不靠CSS值當回歸。

Before360長『秘寶碎片自選』在短龍牌斷行落出；19個選項150.5×38，次行品階／碎片被clip。原49長標題族沿用對稱雕牌與獨立返回列，24UI不縮字；原progression選項natural height/wrap，76UI完整兩行與品階框。最終只把共用long header justify-content:flex-end，頂返回靠右與左側返回列表區別；release原右返與24UI等值，360真公告→詳情→home返回圖證。初始root測試錯預期回公告，保留排除，未當UI故障。

38px操作原因已用matched CSS取證：原CSS38兩ID generic button min114/font45蓋55/progression一ID局部44／76規格。原38 selector以:where(:not(.team-relic-modal button))零specificity窄退場，其他介面specificity和值不變，沒有!important補丁；55原card row/返鈕及progression原box/back修44，小字突破說明原12.5→14。沒有改稀有度、素材規格或控制權。dirty cascade僅因果診斷，其舊build綁677，不冒充乾淨驗收。

補驗原loading/catch發現generic退場後retry落回UA，23.109×8.333screen／4.466字。原55 loading-error button補132native／45font與原共用bronze外觀；最後delta四尺寸延遲asset loader rejection→原catch→還原原API→真tap重試成功。這是精確failure fixture，不稱真網路事件；沒有fakeDOM或權威bypass。

主要f817四尺寸各14scene、17records＝12次真tap＋5筆捲動末端記錄；真卡片詳情、來源全文／返回、隔離Lv10／20、自選19項末端、城市返回重開。名稱／hero首畫scroll0，所有相關控制44以上，選項文字完整，最後列不壓底鈕。f3ee只補載入／失敗／真重試及自選右返首末、360公告，未重跑無關完整矩陣。原UI mark-seen/saveRelics副作用仍在，不宣稱零save呼叫。三方實看限定通過，證據於evidence/UI-SKILL-STANDARD-20261020/segment16-accepted。

限制：DEV statusOf強制卡片unlocked，本fixtureprogression仍讀實際owned=false，不能據此批准正式locked卡。catalog沒有未覺醒項，未造runtimeReady=false。僅天罡戰旗詳情；另外19件效果／來源仍待逐件巡查。沒執行裝備／卸下／強化／合成／選箱交易、獎勵、真雲端或實體裝置。

dev eb749810已用正常merge677吸收，僅生成檔衝突由正式build重建；新shared skill core先於js60。42項技能core/parity/catalog/rebalance/UI-owner檢查與正式skill runtime四尺寸Chrome通過，保存該677報告與代表圖。第16focused／正式build check通過；square-art單獨測試自行找不到Chrome而skip，不計Browser證據，實際CDP證據另列。

677 CI39405967821 attempt1 core118572194969 first fail為battle-status-info-assets舊44／-82px斷言，按已實驗正式188px offset＋8gap／負offset同步並加188精確值；其餘target／duration／VFX斷言不降級。最新Head必要CI尚待，不拿舊綠燈代替，未合併／部署／全UI完成。

新發現另列待修：360「自選捲末→home→公告→更新詳情」時，長標題及右返仍完整，但正文沿用body舊捲動位置而從中段開始。f3ee delta report finding與實圖已記，沒有把header回歸通過擴稱release全狀態驗收。下一段沿原release呈現Owner修正，不否定c590當時單一路徑證據。
