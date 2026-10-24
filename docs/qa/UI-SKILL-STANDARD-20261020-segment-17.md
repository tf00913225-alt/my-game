# 第十七段：跨頁開啟公告的首屏

Work ID UI-SKILL-STANDARD-20261020；PR #955；最終UI b67289342afa3f6c779da41ce67471729b561b83。第16f3ee新序列『碎片自選真捲末→主城→公告→更新詳情』保留body中段；先前第14c590單一路徑證據仍有效，未重做。

原js/release-update-notification.js::openReleaseDetail是唯一Owner。b30先在render後/show前reset，plain-element測試通過但真360仍scroll1670，未批准。乾淨diagnostic trace show前0→show後1670，scrollBehavior:auto、summarytop-334在body210～585外；visible同body僅setter0立即與下一繪製皆0，摘要top222可見。QA-only因果對照不是production驗收，原失敗圖完整保留。

根因為隱藏modal沒有實際scrollbox，隱藏時回頂未保留到顯示。最終只移原reset到modal.add(show)之後、同JS task返回前，無rAF/timeout或第二Owner，避免先畫中段。既有Harness改成hidden getter0／setter no-op與borrowedScroll真實模型，修前red1600!==0、修後13cases全通過；同步返回0、opening storage原樣、battle blocked forced保留900。原ack/update/reload/forced/提醒偏好/節流規則均不改。正式build/check通過。

四尺寸360×640、393×873、412×915、1280×800 production loader原真entry序列與return/reopen皆scroll0且auto；摘要完整、長title不碰正文，真swipe/wheel全文末、label文字on／空白off、storage前中後相同。每尺寸5圖13records，不混稱13tap；原UI mark-seen/saveRelics副作用保留。三方看實圖限定通過。所有來源／bundle SHA256前後相同、取證時clean、Chrome退出。

證據固定於evidence/UI-SKILL-STANDARD-20261020/segment17-accepted；before僅360，未偽造四尺寸before。診斷／causal原scope複製錯16已修正17 QA-only metadata，未變head/hash/實際記錄。不包含真forced/update/reload/ack業務執行、真網路／帳號／實體裝置或其他未列跨頁序列。

CI：b672 CI39410629163與Session Authority39410629130 attempt1最後核對pending，不以單元或實畫取代必要Gate。原f3ee CI39408595507（10:31:55）由同ci-pr-955的新bca39409243848（10:37:26）接管取消，後者又於b30 CI39409499357（10:39:41）後取消；已核workflow/event/PR955/SHA與時間及既有concurrency，取消不當通過，無手動取消。下一Head仍需查即時必要checks。未合併／部署／全UI完成。

Next：逐件20個正式秘寶ID，核長名稱／長效果／末端與返回，代表補不足／突破／上限／已裝備呈現，不執行交易；再接委託／材料合成與背包材料／寶箱詳情等其餘台帳。
