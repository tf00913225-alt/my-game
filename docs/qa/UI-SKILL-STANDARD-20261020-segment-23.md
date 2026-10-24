# 第二十三段：帳號 Session 與讀檔錯誤呈現

Work ID UI-SKILL-STANDARD-20261020；PR #955。Base 5dcd47fa59860079ec21e69d792f49fbef79b50e，final adb1bc4517884fbf474f66fd1c58bf04d27cc37a；段號按既有準備保留，22材料段尚待。

360實拍發現原fail開帳號ERROR後仍保留更高startup遮罩，帳號/重試全部不可操作。正式BOOT ERROR規定retry/account UI。只在原js52 fail已有firebase分支交給accountUi後沿原hideLoader退出；無firebase與resourceFailure保留原loader，ERROR/saveResolved=false/創角與UID守衛不變，無z-index補丁。原帳號卡owner英文改中文。三方實圖又發現raw Firestore/JSON英文直出；原accountUi只交既有中文message，原error/lastError/getLastError/emit診斷保留。

既有loader測試新增原函數VM回歸，遮擋與raw文案兩次red/green均保存；驗證ERROR/未resolved/stale token/no-firebase loader，raw同物件保留。完整v173.20檔本機缺identify而未執行到tests，未冒稱全檔通過，CI原圖片檢查未降級；real-startup-progress與build/check過。standalone auth responsive因Chrome locator跳過，不當Browser證據；本段實際指定Windows Chrome/CDP四尺寸。

5d四尺寸base含Google/guest原session事件、首末、reauth顯隱與清除、cloud/corrupt讀錯誤，360十圖/其他十一圖，另360retry補四圖。訪客每次fresh signedout入口避免前QA把底部誤標首屏；最早缺括號、fakeSession優先提示斷言錯誤、loader覆蓋時不可捲動皆failed-prep排除，保before圖不當驗收。原fakeSession intentionally unavailable，先拍優先提示再原no-code事件只清呈現以看retained message，不修改backend guard。

adb1僅受文案影響read-error delta，各尺寸七圖/五records，其中一真retry，讀取1→2仍ERROR/canCreatefalse/creationnone；四次corrupt bytes均{broken-json未變。其餘session沿有效5d（auth-ui source未再變）不重跑。原loader已退讓、實際account hit可見、控制>=44、真scroll-end與底鍵完整，三方依實圖有限通過。未把debug工具可見當成權限驗證成功。所有有效report clean/sourcehashunchanged，Chrome/server均退出。

證據evidence/UI-SKILL-STANDARD-20261020/segment23-accepted，bindings逐數量/Head/記錄。真帳號/Session Authority/重新驗證/登出/權限測試及雲端寫入未驗；沒有角色創建/資料遷移/恢復/清除或商業交易；Google與guest session為原UI API加原事件隔離呈現，不是實際失去session重現；原boot fakeSession刻意unavailable；先拍優先提示，再原no-code事件僅清sessionError以看底層read-error，後端守衛未放寬；只cloud-read failure與corrupt-local，未涵所有fail callsite、save-write failure或成功恢復；實體裝置/真軟鍵盤未驗；可見控制的rect不代表已執行其業務；activeguard暫停時鐘真觸控未完成，整次排除，其他三尺寸未跑。

另保存EXCLUDED guard360：CDP clock確實pause、baseline/stalled全HP/SP/EXP/gold/inventory/storage等相同、save0，但真touch未完成與原dialog未開。精確還原getter/save及清理，不改產品、不跑剩餘尺寸、不批准activeguard。

CI最後讀adb1 CI39425179670 / SessionAuthority39425179503皆pending，不當通過。未合併/部署/全介面完成。Next材料實際ID詳情、主城與剩餘可達戰鬥/狀態，先沿既有有效證據對映台帳。
