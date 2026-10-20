# UI-SKILL-STANDARD-20261020 — 第四施工段（驗收中）

帳號、客服、啟動載入與隱私外框沿原呈現 Owner 使用技能既有黑鐵九宮格；對稱主標題保留獨立置中，法律章節維持閱讀對齊。提高原小字與輸入可讀性，disabled維持原屬性與阻擋行為，以可讀顏色表示。啟動細節取消單行省略，保留完整診斷提示；玩家文案改為帳號/角色用語。客服原信箱僅在@後增加可斷行點，mailto不變。

已完整讀取 Boot、Data Security、Firebase Auth契約。scope_review確認Auth/Boot控制流程AST除字串外一致，Privacy inline script逐位元一致；未改驗證、session、讀存檔、migration、同意或交易。原測試僅同步相同未驗證禁止創角語義的新字串，boot 70000 bytes門檻未調高。

六個focused測試檔16 entries通過，Windows auth browser fixture因locator未找到Chrome自行跳過，不列為實際browser通過。另用production loader、既有boot fakeAuth transport與真正CDP touch驗證；provider延遲2秒僅供穩定載入圖，不作正式效能證據。不登入/註冊、不接受隱私、不操作雲端。

dirty360試驗抓到客服信箱硬斷與失敗工程術語，已退回原來源修正。auth-polish-r2在施工期間來源變更而停止，不能作固定快照驗收。待checkpoint四尺寸重新取證，補短密碼本地錯誤、返回回頂、隱私關閉重開，再獨立三方審核。真帳號、reauth/migration、軟鍵盤與硬體未驗，不能宣稱全UI完成。
