# 第十五段：背包本體與完整角色名稱

Work ID：UI-SKILL-STANDARD-20261020；PR #955。Before9c2ec236；base15660a34；最終UI `3bb8dba51bc177a08a8de3b8965ec7c84847bcf1`。正式容量為120格／5頁／5欄，依即時Owner與runtime核對，沒有按舊102文字更改數值。

四情境真入口與返回、四分類及角色詳細按鈕原流程可用；本體普通切角細框與「INVENTORY 背包」未達技能頁品質，角色箭頭38screen、分類及底操作36、pager32。僅原CSS22 canonical frame/title採既有技能黑鐵九宮格與對稱中文24UI題牌，移除HTML英文裝飾字；原控制至少44，雕框內距12，保留角色區、裝備位、物品格／品階與原唯一grid scroller，沒有加全域補丁或新Owner。

156四尺寸各13scene、獨立真控制圖證明入口／分類／原grid及分頁末端；合法16字滿資料暴露名稱裁切、Lv消失，以及button44但grid track仍32的分頁擠字。3bb原name容器自然換行，保字／字級／等級，pager tracks與44button同步。沒有JS、容量、sorting、稀有度、handler或交易變更；角色detail原雕框已合格，保留。

3bb resolved四尺寸各6圖與完整報告：正常／合法16字＋Lv70／120件fixture、真grid末、pager與返回；字墨處於標題底至立繪頂安全區，360 y70.333～109.667、Lv底122、安全65～130。頁碼兩側與箭頭間距9.448／10.314／10.813／11.810screen，footer不溢，所有相關控制至少44。根360因把overflow-visible字墨超linebox當裁切而false assertion，保留排除；改以真安全區與祖先裁切／水平邊界，不降低遮擋Gate。

另只補滿資料第5頁末端：四尺寸真5/5、真swipe/wheel末、24格occupied，120件且UID唯一；最後格真tap選擇索引119，與normalized order120 UID綁定，不能由UID suffix猜位置。最後格／footer間隔1.990／2.172／2.277／2.487screen，四實圖完整。detail只開關，不使用／穿戴／售出。先前只拍full第4頁的限制由此精確補齊，不重跑已驗四情境。

五個focused檔通過；既有正式backpack Browser regression同步中文fixture、加入16字及Lv、頁碼／footer／44與安全區實測，等待fonts.ready後量測，全部原單層rarity、25% tint、opacity/assert仍保留。Windows實際Chrome360/390/412/430四尺寸通過；不是自動skip。另修typo測試對已退休shop CSS53 owner的舊斷言，回正式49保16/15UI要求並禁止53奪回。build --check、diff check通過。

三方限定通過；權威前後畫面與固定來源報告保存 `evidence/UI-SKILL-STANDARD-20261020/segment15-accepted/`。未批准所有物品變體、使用／裝備／出售／交易／雲端／真帳號或實體裝置。該段沒有改共用技能基準或遊戲邏輯。

Next：即時dev已前進到eb749810，PR mergeable=false且3bb無CI，不拿c590舊run作最新背書。先檢查#969/#966新增Recovery/Skill依賴及正式Owner，正常merge吸收並由正式build重建產物，再跑受影響focused檢查／Latest Head必要CI；禁止rebase/force/main。續查秘寶內頁與台帳其餘未驗狀態，未稱全介面完成或已部署。
