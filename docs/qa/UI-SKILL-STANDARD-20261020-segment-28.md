# 第28段：故事before短長文與active首句，限定驗收

Production c349a41065a7f1a2796b604a3022641bd8ea7c39。手寫只原UI render按正式tutorial.active投影back.hidden、原CSS header overlay/題牌及共享49雕框；runtime/content/交易/guard不改。

短／長四尺寸8case共32圖：真主城入口、兩個canonical before cursor、玩家/NPC發話、合法16字名、正文首末、非末句真下一句、非引導返回重開。Active四尺寸各2圖：canonical c1_01 before0；返回hidden、displaynone、rect0x0；未點返回／下一句，未繞原guard。

三方獨立審核已限定通過：art_review實看短長文32圖及active8圖，interaction_review實看四尺寸並核真輸入／還原，scope_review實看四尺寸並核原Owner與交易邊界。Active本句說話者是守驛人，不另外宣稱active長玩家名發話已驗。三方審核只能涵蓋這些具體畫面／操作，不等全故事或完整新手引導。

原open保留lastViewedAt/beginChapter及local save/background副作用；same-task只觀察指定combat/economy/character資料域，不能稱零save或全storage不變。finally raw save/meta/playerid精確恢復，真帳號/雲端/交易/實機未驗。

仍未驗：guidance/ending分支、末句transition、tutorial系統往返／準備確認／護具領獎／戰鬥、其他故事cursor與長文／場景／人物組合、硬體鍵盤。第11段舊map/event/returns僅保原有限歷史證據，不能替代新版故事狀態。

前候選9ea26af7實圖證實header display:none使返回0×0；診斷保留，不作通過。證據位於segment28-short-long-accepted及segment28-active-accepted；helper原始位元組gzip與SHA保留。18項故事finalization原guard測試、adventure scroll/render targeted及build check通過；CI仍須最新Head，非部署驗收。

## before全20節點補驗（331f01f0）

四尺寸各20節點、76句正式before對話逐句真操作完成，共80份成功報告；最後一句只展示，真返回再開核對最後cursor。360沿用原node01，02公告遮擋失敗保留排除，resolved僅補02至20；其他三尺寸不重做。原公告自然settled，不宣稱每case曾真點公告返回。

三方獨立限定通過。art_review實看146張取樣，01至06三尺寸全部78、07三尺寸15加360一張、08至20各四尺寸代表52；不是全部圖片人工審。已見守驛人、旅人、藥師、旅商、黑松寨主；未把未抽中的獨立橋景稱已人工看過。interaction_review與scope_review逐node核文字、句序、素材decoded、真輸入、末句重開及raw/meta/name還原，並實看四尺寸代表。

原監測在Next重繪後漏記same-task資料域，舊報告不改寫；Next本身真輸入與cursor/text證據仍有效。另node02四尺寸next-observation-v2精確獨立斷言各1次Next同task域不變、總5events、clean/complete/sourceequal/restore通過。此delta不是76句全部same-task觀測。首次delta未設WindowsChrome的啟動失敗亦保留排除。

證據：segment28-all20-before-accepted，含正式plan、原失敗、80成功報告、四尺寸最小delta及三個時期原helper gzip。仍未批准guidance/ending、末句轉移、真戰鬥/獎勵/領取/教學完成/載圖失敗/實體裝置。下一段已發現教學返回可見但無法命中的實際缺陷，另存第29段診斷，不混入本before呈現驗收。
