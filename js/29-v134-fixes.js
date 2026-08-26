/*
   V134 — 三個回報問題的修正：
   1. 戰鬥「空拍很久」：輪到手動角色時指令列沒顯示，玩家看不到按鈕、
      只能乾等 20 秒倒數跑完
   2. 自動戰鬥「設定出招了還一直普通攻擊」：退回普攻時完全靜默，
      玩家不知道為什麼；外加自動技能選單跟引擎的分類條件不一致
   3. 背包從下方導覽列進去時沒有返回鍵

   ★ 原則：全部用「包一層既有函式」的方式接進去，不改
   js/00-main.js 本體，也不動戰鬥公式、傷害、怪物強度、掉率。
*/
(function installV134Fixes(){
    "use strict";

    /* =====================================================
       1. 戰鬥空拍：輪到手動角色時要把指令列叫回來
       ===================================================== */

    /*
       ★ 根因（讀 js/00-main.js 確認）：
       updateActionHudVisibility()（31898）是依「當下的
       activeBattleCharacterIndex 是不是自動」來決定指令列要不要
       隱藏，但全專案只有三個地方呼叫它：
         - startTurn()（10042）——此時 index 恆為 0
         - startResolutionPhase()（11934）
         - toggleAutoBattle()（19112）
       宣告階段真正在「換人」的 beginCharacterTurn()（10078）
       從來沒有呼叫過它。

       所以只要 0 號是自動、1／2 號是手動，指令列在 startTurn 那次
       就被判定成「隱藏」，然後整個宣告階段都不會再更新——輪到手動
       角色時玩家看不到任何按鈕、什麼都不能做，只能眼睜睜等
       beginCharacterTurn() 裡那個 20 秒 setInterval（10241）跑完，
       直到 timeoutTurn() 印出「⏰ 時間到，本回合沒有行動。」
       一個手動角色就是 20 秒空拍，兩個就是 40 秒——這正是使用者
       說的「為何有空拍很久的時候」。

       這個狀態很容易進入：saveAutoSettingsFormToCharacter()（19884）
       只寫 skill/hp/sp/returnToCityWhenEmpty，從來不寫 enabled，
       所以 autoConfig.enabled 跟 autoConfig2/3.enabled 很容易不同步。

       修法：包一層 beginCharacterTurn()，等原函式把
       activeBattleCharacterIndex 推到正確的人之後，補呼叫一次
       updateActionHudVisibility()。原函式如果已經跑到底去呼叫
       startResolutionPhase()，這裡再叫一次也是安全的——那時
       battlePhase 已經是 "resolve"，同一個函式會正確地算出「該隱藏」。
    */
    if(typeof beginCharacterTurn==="function"){
        const originalBeginCharacterTurn=beginCharacterTurn;
        beginCharacterTurn=function(token){
            const result=originalBeginCharacterTurn.apply(this,arguments);
            if(typeof updateActionHudVisibility==="function"){
                updateActionHudVisibility();
            }
            return result;
        };
    }

    /*
       ★ 次要的節奏違和：技能名稱徽章原本存活 2200ms，比每一步的
       1500ms 還長，所以上一位的技能名稱還飄在畫面上、下一位就已經
       出手了，看起來會「疊在一起、怪怪的」。這裡把徽章壽命收到
       1200ms，確保它一定在下一位出手前就消失。
       只改移除時間，不改任何動畫本身或戰鬥邏輯。
    */
    /* ★ 這個數字必須小於 js/25 的 V131_RESOLVE_DELAY_MS（目前1250），
       否則上一位的技能名稱會跨到下一位出手，看起來會疊在一起。
       節奏改成1.25秒之後，這裡跟著從1200收到1000。 */
    const V134_SKILL_BADGE_MS=1000;

    function trimSkillBadgeLifetime(badge){
        if(!badge){ return; }
        setTimeout(()=>{
            if(badge && badge.parentNode){
                badge.parentNode.removeChild(badge);
            }
        },V134_SKILL_BADGE_MS);
    }

    if(typeof showSkillNameBadge==="function"){
        const originalShowSkillNameBadge=showSkillNameBadge;
        showSkillNameBadge=function(skillName,elementType,characterIndex){
            const result=originalShowSkillNameBadge.apply(this,arguments);
            const layer=
                document.getElementById("game-overlay-layer") ||
                document.getElementById("game-stage");
            if(layer){
                trimSkillBadgeLifetime(layer.querySelector(".skill-name-badge:last-child"));
            }
            return result;
        };
    }

    if(typeof showMonsterSkillNameBadge==="function"){
        const originalShowMonsterSkillNameBadge=showMonsterSkillNameBadge;
        showMonsterSkillNameBadge=function(skillName,elementType,monsterIndex){
            const result=originalShowMonsterSkillNameBadge.apply(this,arguments);
            const layer=
                document.getElementById("game-overlay-layer") ||
                document.getElementById("game-stage");
            if(layer){
                trimSkillBadgeLifetime(layer.querySelector(".skill-name-badge:last-child"));
            }
            return result;
        };
    }


    /* =====================================================
       2. 自動戰鬥：退回普攻時要說明原因
       ===================================================== */

    /*
       ★ 這一段原本在這裡（V134），已經在 V135 被更好的做法取代，
       所以整段移除，避免兩份邏輯同時印出重複的訊息。

       V134 的做法是「在原函式跑之前，自己複製一份引擎的四個判斷
       條件去預測會不會退回普攻」。缺點是：只要引擎因為某個沒被
       複製到的理由退回，預判就會全部通過、什麼都不印，玩家還是
       看到莫名其妙的普攻。使用者接著就回報了「我很確定有SP，
       自動戰鬥還是使用普通攻擊」——正是這種預判對不上的情況。

       V135 改成「以實際結果為準」：讓原函式跑完，再去看
       queuedPlayerActions 裡實際排進去的是什麼，只要
       「設定的是技能、實際卻是普通攻擊」就一定會印說明。
       詳見 js/30-v135-fixes.js 第 1 節。
    */


    /*
       ★ 調查記錄（給下一個接手的人，避免重複走冤枉路）：
       原本以為還要修「UI 選單跟引擎的分類條件不一致」——
       populateAutoSkillOptions()（00-main.js:31426）只濾掉
       buff/passive，但引擎（20245）連 heal/revive 也拒絕。

       實際查證後發現這是**死程式碼**：它操作的
       #autoSkillHome / #autoSkillBattle / #autoEnabled 這幾個元素
       在現在的 index.html 裡**根本不存在**（grep 結果都是 0），
       是舊版主城自動面板的殘留，這也正是 console 一直在印
       「找不到元素： autoSkillHome / autoEnabled …」的原因。

       玩家現在真正在用的是元素匣面板的 #autoSettingsActionSelect，
       由 switchAutoSettingsCharacter()（00-main.js:20052-20074）
       負責填充，而它**本來就有**正確濾掉 buff/passive/heal/revive。
       所以這裡不需要、也不應該再加一層修正。

       萬一 autoConfig.skill 因為舊存檔之類的原因還是留著一個
       heal/revive 技能，上面新增的回饋訊息會直接告訴玩家
       「屬於治療類技能，自動戰鬥目前不支援」，不會再靜默普攻，
       這樣就夠了。
    */


    /* =====================================================
       3. 背包返回鍵
       ===================================================== */

    /*
       ★ 根因（讀 index.html + css/00-main.css 確認）：
       #inventoryPage 唯一的關閉鍵 #mapInventoryOverlayClose
       （index.html:2158）被 CSS 綁死只在覆蓋層模式顯示：
         css/00-main.css:5604  .map-inventory-overlay-close{ display:none; }
         css/00-main.css:5607  #inventoryPage.map-inventory-overlay-open
                               .map-inventory-overlay-close{ display:flex !important; }
       而 .map-inventory-overlay-open 只有 openMapInventoryOverlay()
       （00-main.js:6980）會加。背包有三種進入方式，只有「從地圖頁」
       那一種會加這個 class；使用者截圖是從「下方導覽列」進去的
       （index.html:2329 的 showPage('inventory')），那條路徑
       #inventoryPage 從頭到尾沒有任何返回控制項。

       修法分兩半：
       - CSS（css/35-v134-fixes.css）：讓這顆按鈕在 #inventoryPage
         一律顯示，不再只綁覆蓋層 class
       - JS（這裡）：依使用者決定「返回上一個頁面」，包一層
         showPage() 記錄前一頁，再把按鈕的行為換成
         「覆蓋層開著 → 照舊關覆蓋層；否則 → 回上一頁」
    */
    let v134PreviousPage=null;
    let v134CurrentPage=null;

    if(typeof showPage==="function"){
        const originalShowPage=showPage;
        showPage=function(page){
            /* 只在「真的會切過去」時才記錄——原函式在戰鬥中會直接
               return 擋掉切頁（00-main.js:7032），那種情況不能算數，
               否則返回鍵會指到一個從來沒去過的頁面。 */
            const willActuallySwitch=!(battleActive && page!=="battle");

            if(willActuallySwitch && page!==v134CurrentPage){
                if(v134CurrentPage!==null){
                    v134PreviousPage=v134CurrentPage;
                }
                v134CurrentPage=page;
            }

            return originalShowPage.apply(this,arguments);
        };
    }

    window.v134BackFromInventory=function(){
        /* 從地圖頁開的覆蓋層版本：維持原本的關閉行為，
           不要弄壞這條本來就正常的路徑。 */
        if(typeof mapInventoryOverlayOpen!=="undefined" && mapInventoryOverlayOpen){
            if(typeof closeMapInventoryOverlay==="function"){
                closeMapInventoryOverlay();
            }
            return;
        }

        /*
           借進角色彈窗的情況（switchCharacterTab("inventory") 會把
           整個 #inventoryPage 搬進 #homeFeatureModalBody）：這時候
           這顆按鈕應該關掉那個彈窗，而不是切頁。

           ★ 判斷條件刻意用「#inventoryPage 是不是真的被搬進彈窗裡」
           而不是「彈窗是不是可見」——後者太寬鬆：只要畫面上剛好有
           任何一個 home-feature 彈窗開著（即使背包是獨立整頁顯示、
           跟那個彈窗一點關係都沒有），就會誤判成借用情境，結果按了
           返回只是關掉那個不相干的彈窗、背包頁還留在原地。
           實測就踩到過這個情況。用 contains() 檢查父子關係才精準。
        */
        const modalBody=document.getElementById("homeFeatureModalBody");
        const inventoryPage=document.getElementById("inventoryPage");
        if(modalBody && inventoryPage && modalBody.contains(inventoryPage)){
            if(typeof closeHomeFeature==="function"){
                closeHomeFeature();
            }
            return;
        }

        const target=
            (v134PreviousPage && v134PreviousPage!=="inventory")
            ? v134PreviousPage
            : "home";

        showPage(target);
    };

    /* 把按鈕的 onclick 從寫死的 closeMapInventoryOverlay() 換成
       上面那個依情境判斷的版本。用 DOM 直接改，不動 index.html。 */
    function rebindInventoryBackButton(){
        const button=document.getElementById("mapInventoryOverlayClose");
        if(!button || button.dataset.v134Bound==="1"){ return; }
        button.dataset.v134Bound="1";
        button.setAttribute("onclick","v134BackFromInventory()");
        button.textContent="返回";
    }

    if(document.readyState==="loading"){
        document.addEventListener("DOMContentLoaded",rebindInventoryBackButton,{once:true});
    }else{
        rebindInventoryBackButton();
    }

})();
