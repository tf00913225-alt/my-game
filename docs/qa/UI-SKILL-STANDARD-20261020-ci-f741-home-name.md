# f741 typography：姓名與等級的正式selector

Work ID UI-SKILL-STANDARD-20261020 / 原Branch / PR955，basef741d4e86a113aa7641b14ef93a09f498396a357。正常CI40013835262/a1 core120622309039首錯ui-typography-standard90要求.v146-home-character span後代selector。正式css19:16–17在既有product8aff17a6把姓名b完整換行normal/anywhere，等級則直屬>span保持nowrap。不是移除nowrap或新產品缺陷。

只同步test為精確>span nowrap，另新增b normal/anywhere要求；保留字級底線、主城其他文字、battle排除及所有原Owner/字級斷言。不改產品CSS/DOM/JS/玩法或Chrome工具。target typography suite及diffcheck PASS。

直接驗證使用原production loader/PREPARE_RUNTIME，在隔離fixture暫放16字中文名與長英文名，呼叫正式v54RenderHomeRoster，採360×640/393×873/412×915/1280×800實圖與字墨範圍，之後恢復原fixture ID；未主動存檔、未接觸實機或真帳號。姓名normal/anywhere、字墨在自己卡片內且無水平overflow，直屬等級保持nowrap。沒有只看CSS數值來判可讀。

獨立/root/daily_scope核對diff/正式來源並實看360與桌面、四尺寸JSON，窄review無阻塞。限制：英文會詞中換行，兩角色fixture不是三人/所有等級/所有名字；圖片底部冒險區有被nav截住的觀察，未在此核實根因或擴改，另列全UI待查，不能宣稱整頁通過。證據evidence/UI-SKILL-STANDARD-20261020/ci-f741-home-name。

Latest Head必要CI仍待；AdventureUI由Story、Adventure/Boss DevTools由工具Owner處理，本段不混改或盲重跑舊SHA。未取消其他jobs、未合併部署。下一步新Head必要Gate與原剩餘台帳，保留loading/PWA/既有成果。
