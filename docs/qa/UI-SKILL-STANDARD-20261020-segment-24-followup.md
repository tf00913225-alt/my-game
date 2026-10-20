# 第24段補驗：進行中

本紀錄補充第24段，不取代已接受的有限範圍；尚未完成全介面驗收或部署。

## 24B 角色分頁

c5ea05020f8d2126e3e86ad4fbd2efdcfd75266a 的360×640實際操作已走過三角色×能力值／技能／經驗池的首尾畫面及新增第二角色入口；返回角色頁按鈕實測41.333px，因此整段未通過。CSS56的124px後載覆蓋原CSS29的132px，是此次高度不足的來源，移除該競爭宣告、保留原畫布與操作列。

獨立美術審核實看發現經驗池禁用按鈕及角色鎖定條件過暗。修原CSS31禁用色與原showcase展示字色／透明度，保留disabled與既有業務handlers。

該次經驗池的兩張舊QA卡為測試準備殘留：替換本機三角色後未呼叫原renderExpDistributeList。不得把此圖當作三角色經驗池資料綁定或第三列可達證據，也不據此修改資料邏輯。補驗須先經原renderer更新，再逐列核對正式角色名稱與等級並實際讀至末列。截圖中追趕徽牌裁切仍須在正確資料準備後確認。

## 24C 秘寶摘要一致性

以正式skill feature ensure之前的隔離本機canonical fixture，讓原秘寶Owner首次初始化讀取資料。preinit2失敗是返回selector選中隱藏statusHelpButton，非秘寶hydrate故障。修QA排除該按鈕後，c5ea0502 preinit3的360×640空／已載入兩情境已完整執行，原始存檔與metadata還原、來源hash不變。其他三尺寸及獨立實圖審核尚待完成，不列整段通過。

原始暫存證據：artifacts/ui-skill-standard/segment24b-character-tabs-c5ea0502/prepared/360x640，以及segment24c-summary-preinit2-c5ea0502與segment24c-summary-preinit3-c5ea0502。通過證據須在四尺寸及獨立審核後轉存正式evidence；失敗候選不可代替通過。

Next：正確三角色EXP fixture後補驗24B四尺寸／創角取消；24C其餘三尺寸及三方實圖審核。其餘全介面待驗項目仍以逐項清單與PR即時狀態為準。

## 正確fixture的後續候選

806599b7已保存上述禁用字色與創角Owner修正。正式EXP renderer重繪三角色後，360實測全名墨跡超出原name box，未通過；未把舊QA兩卡視為產品綁定錯誤。原CSS38雙欄覆蓋CSS31直列，使姓名與資訊過窄；退休該覆蓋，原CSS31姓名允許全文換行，CSS42 metadata／追趕徽牌允許換列與換行。僅修改呈現，仍須後續實際驗證，不提前批准。

## 24C 四尺寸限定接受

Source Head：ccca1b2c97935a586443ada77b2ed76c268bc3cf。360×640、393×873、412×915、1280×800，各空／loaded兩模式，共八份完整報告與24張實際PNG，正式證據位於evidence/UI-SKILL-STANDARD-20261020/segment24c-accepted。每次fresh profile在原Owner初始化前以正式local repository放入fixture，原hydrate後核canonical／getter／卡片同ID、Lv20、解鎖及已裝備狀態，真入口與返回，來源hash不變且raw／metadata與finally再次還原皆exact。這補齊第24段原本因初始化時點而未批准的跨頁一致性；不批准裝備、升級、使用或雲端交易。

- art_review：實看全部四尺寸24張，題牌、空態／裝備摘要、目標頁與返回一致，限定通過。
- interaction_review：核八組report並實看各尺寸代表畫面，手機touch／桌面mouse及返回命中、原資料還原，限定通過。
- scope_review：實看四尺寸代表畫面、原source diff與報告，無新增資料／業務修改，限定通過。

## 24B 動態狀態仍待修

同ccca Head四尺寸各24張、三角色九分頁及鎖定／可建立入口取消的實際操作完成。完整角色名／等級、三EXP列及末端footer可達；沒有創角提交、加點確認、分配、學習或裝備。B報告沒有finally cleanup結果，不宣稱exact restore或零儲存。

獨立art_review另在1280×800/character-2-expPool-top.png抓到自然充能+55 EXP浮字碰到下方說明，root亦實看確認。B整段不得接受，保留其餘有限操作證據，待原CSS42浮字空間修正與四尺寸動態delta。EXP內卡材質／分隔精緻度另待局部試圖，不以幾何通過冒稱全品質完成。
