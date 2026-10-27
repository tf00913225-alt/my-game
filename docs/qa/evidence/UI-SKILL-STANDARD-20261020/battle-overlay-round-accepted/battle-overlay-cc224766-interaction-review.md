# cc224766 skill/item overlay：獨立互動審核

限定通過四尺寸空技能格／空補品的開關與回合牌可見性。完整Head cc22476683818b433179762b4e9b0e5f2b7eec4f；證據 fixedslot-overlay-cc224766/{skill,item}-indicator-qualified/{360x640,393x873,412x915,1280x800}。實看全部8張open及四尺寸item返回後4張，合計12圖；讀8份完整reports。另12張初始HUD與skill返回圖未在此逐張獨立重看，skill返回有show=false／domain／幾何證據。

四尺寸open實圖皆可讀到倒數19及完整「第1回合」，回合牌不再被overlay蓋住。技能四空格、返回及邊框完整，補品空訊息與說明完整。原我方姓名、Lv、HP/SP條在兩種open畫面均可見，返回後敵我畫面與命令列恢復。item面板本身會正常覆住背景敵方角色與其HUD，不能稱「open時敵我HUD全部不被遮」；本次通過的是回合牌／我方資訊未受新增衝突與關閉後恢復，敵方背景被popup覆蓋未列為新回合牌問題。

八case每個五次真輸入（森林入口鏈、原skill/item、原close）均EFP=true且44+；close最小44.57/48.66/51.01/55.71screen。每個case fresh profile只一overlay，未點技能／物品格或符咒TAB。indicator text/Range、實際style及clip祖先、overlay幾何、z-index與EFPstack均保存；open inkIntersection=0，Range在真正clipping祖先內。指示文字pointer-events:none不作EFP可見性的錯誤推論，實圖確認可見。

原自然計時八case都20→19，觀察約1.03–1.12秒，不freeze/不改timer/clock。所有記錄維持turn1/declare/token1，HP/SP/level、金幣、inventory/equipment/monsterHP與declare baseline相等；raw/meta前後相同，save委派觀測0、非GET請求0。沒有敵人點擊／攻擊／結算。各complete/clean/sourceUnchanged/profileRemoved=true，沒有8秒watchdog觸發證據。原startBattle API的active/token/cooldown等開戰副作用並不等於零；最後只有隔離Chrome/profile銷毀，runtimeexact未還原如實。

未驗：非空技能／補品／符咒、長名／長描述／滿資料、技能或物品使用、TAB切換、auto、後續倒數／timeout／多回合、傷害／勝敗／結算／獎勵、真地圖點怪、實機。normalprompt新牌寬另驗，不以本輪代替。未Chrome／產品修改。

## 同Head normalprompt 補審

另實看 fixedslot-prompt88-cc224766/natural-entry-qualified 四尺寸 target PNG共4圖，讀四report；本審核累計16張實看圖／12report。新180native牌中倒數與回合文字均完整，回合Range在牌rect內；提示頂與牌底保留5.14/5.61/5.89/6.43screen間隔，不互碰。返回44.57/48.66/51.01/55.71、真五inputs均hit。唯一回合label=1、timer專屬clip Gate通過，取消pending恢復。

四個 normalprompt report complete/clean/sourceUnchanged/profileRemoved均true；raw/meta相同、save觀測0。normalprompt仍小於一秒，倒數跨秒只由上列八個overlay獨立profile各20→19證據支撐，不倒填到normal case。本補審限定通過原normal開prompt→返回，不擴攻擊或結算。
