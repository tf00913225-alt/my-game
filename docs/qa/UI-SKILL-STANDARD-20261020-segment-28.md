# 第28段：故事before短長文與active首句，限定驗收

Production c349a41065a7f1a2796b604a3022641bd8ea7c39。手寫只原UI render按正式tutorial.active投影back.hidden、原CSS header overlay/題牌及共享49雕框；runtime/content/交易/guard不改。

短／長四尺寸8case共32圖：真主城入口、兩個canonical before cursor、玩家/NPC發話、合法16字名、正文首末、非末句真下一句、非引導返回重開。Active四尺寸各2圖：canonical c1_01 before0；返回hidden、displaynone、rect0x0；未點返回／下一句，未繞原guard。

三方獨立審核已限定通過：art_review實看短長文32圖及active8圖，interaction_review實看四尺寸並核真輸入／還原，scope_review實看四尺寸並核原Owner與交易邊界。Active本句說話者是守驛人，不另外宣稱active長玩家名發話已驗。三方審核只能涵蓋這些具體畫面／操作，不等全故事或完整新手引導。

原open保留lastViewedAt/beginChapter及local save/background副作用；same-task只觀察指定combat/economy/character資料域，不能稱零save或全storage不變。finally raw save/meta/playerid精確恢復，真帳號/雲端/交易/實機未驗。

仍未驗：guidance/ending分支、末句transition、tutorial系統往返／準備確認／護具領獎／戰鬥、其他故事cursor與長文／場景／人物組合、硬體鍵盤。第11段舊map/event/returns僅保原有限歷史證據，不能替代新版故事狀態。

前候選9ea26af7實圖證實header display:none使返回0×0；診斷保留，不作通過。證據位於segment28-short-long-accepted及segment28-active-accepted；helper原始位元組gzip與SHA保留。18項故事finalization原guard測試、adventure scroll/render targeted及build check通過；CI仍須最新Head，非部署驗收。
