# Segment 9 — 正式副本預覽與獨立標題

Work ID UI-SKILL-STANDARD-20261020，PR #955，驗證來源 Head 3d211ee66151b33d6ae5b4940f92c9de210b2a15。

實際四個日常封面按鈕證實舊 QA 呼叫 v141 短預覽不足以驗收正式入口。正式經驗／材料／金幣／裝備預覽在 360 寬只約 120px，正文 4～5px，群標逐字直排；四尺寸皆出現。before 綁8433f93d，之後至本段前相關來源沒有變。

修原 Owner：CSS43 的歷史圖片版規則退出正式 text class，CSS42／53 重複字級退役，CSS33 保留 native 尺寸並擁有文字與內容 grid；CSS49 原共用素材承接外框與對稱標題。內卡克制細框，徽記與標題有獨立格；未疊全域放大。副本／深淵只加原標題帶及原日常 TAB 材質，封面與地圖保留。JS58／equipment-progression 僅眉題術語與玩家說明，獎勵數量、機率計算、掉落表、handler 與權威不變。

原 functional-reading QA 改用四類真封面入口及返回，保留可讀寬度／字級斷言。focused 五組通過；v174 第一次因尚未 build 的 manifest stale 失敗，正常生成後重跑通過，不放寬 gate。

四尺寸 360×640、393×873、412×915、1280×800，root各14張 after；input四類正式入口／返回／重開、深淵真返回，均綁3d211ee6、dirty=false、來源與bundle hash不變。正式四類內容原本完整可見，記錄無需捲動；另外複製正式材料／裝備 section 十份，以正式 modal API 做明標 synthetic 長文壓力情境，手機真 touch／桌面 wheel 到末端再返回。末列 note 完整在返回上方。三位獨立審核對已列呈現／操作限定通過；美術看16張代表圖，scope看前後實圖及精確diff。

耐久證據 `docs/qa/evidence/UI-SKILL-STANDARD-20261020/segment9-accepted`。操作權威見 interaction-review.json：resolved2 是正式四類，long-formal 只採材料，long-equipment 是正式裝備長文。resolved360 錯誤返回 selector、resolved2 舊 v141 synthetic、long-formal 裝備參數落入經驗 fallback 均不作通過證據；原失敗保留。

未驗：日常頁不存在的 gameplay-back-button 不冒稱出口已驗；開戰、廣告、結算、領獎、交易與存檔均未進行，實體裝置未驗。裝備機率短組跨行為非阻塞後續排版觀察，未改數字。台帳另核對 shared.prompt 現況沒有 production 實作／caller，標不適用；英雄取得／成長與秘寶強化是詳情子區，不假列新頁。

CI：8433 的 run39388097548 core第一實際失敗是舊 battle-patrol-ui-targeting 仍要求 commandHeight+44px；正式段5使用 picker top offset，將以原變數與嚴格offset斷言同步，不能改回舊遮擋。ui／Adventure／portrait 的第一失敗是Linux Chrome啟動 DevTools ECONNREFUSED（9659／9764／9984），portrait PID2596在15s為D/folio、無LISTEN；不是已證實根因。最新 Head 必要 CI 尚未通過，不合併、不冒稱部署。

Next：練功區真十卡已取 before，獨立 trainingZoneModalTitle 仍左貼且360返回偏小；外框合格保留，只修原標題／返回，再續查清單未驗入口與狀態。
