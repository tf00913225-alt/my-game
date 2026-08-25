Warning: truncated output (original token count: 182924)
Total output lines: 32521



/* =====================================================
   ★ 1080 × 1920 整體等比例縮放控制器
   - 遊戲邏輯舞台固定 1080 × 1920
   - 不依賴 vw / vh 改變遊戲內尺寸
   - 實際螢幕只決定 stage scale
   - letterbox 自然留在 stage 外
===================================================== */


/* =====================================================
   ★ COMPLETE 1080×1920 STAGE CONTENT WRAPPER
   Keep existing DOM IDs/classes and game logic intact.
   All existing #app descendants are moved into one
   transformed legacy design surface.
===================================================== */
(function setupGameContentStage(){
    const app = document.getElementById("app");
    if(!app) return;

    let content = document.getElementById("game-content");

    if(!content){
        content = document.createElement("div");
        content.id = "game-content";

        while(app.firstChild){
            content.appendChild(app.firstChild);
        }

        app.appendChild(content);
    }
})();

/* V3 runtime guard: the wrapper is created before this runs, but keep this
   idempotent in case another script re-renders/reparents the navigation. */
(function enforceVirtualStageLayout(){
    function apply(){
        const app=document.getElementById('app');
        const content=document.getElementById('game-content');
        if(!app || !content) return;
        const navs=content.querySelectorAll('.bottom-nav');
        navs.forEach(function(nav){
            nav.style.position='absolute';
            nav.style.left='0';
            nav.style.right='auto';
            nav.style.bottom='0';
            nav.style.width='420px';
            nav.style.maxWidth='none';
            nav.style.transform='none';
            nav.style.margin='0';
        });
    }
    if(document.readyState==='loading'){
        document.addEventListener('DOMContentLoaded',apply,{once:true});
    }else{
        apply();
    }
})();

const GAME_WIDTH = 1080;
const GAME_HEIGHT = 1920;

const LEGACY_WIDTH = 420;
const LEGACY_HEIGHT = 746.6666667;

/*
 * V9 MIGRATION RULE:
 * 1080×1920 is the official coordinate standard for all NEW systems.
 * LEGACY_WIDTH/HEIGHT exist only for existing content compatibility.
 */

let gameStageScale = 1;
let gameStageLeft = 0;
let gameStageTop = 0;

function updateGameStageScale(){

    const stage = document.getElementById("game-stage");
    const viewport = document.getElementById("game-viewport");
    if(!stage || !viewport){
        return;
    }

    /*
       V5: use the layout viewport / actual game-viewport size,
       NOT visualViewport.width/height.

       visualViewport can become smaller when the browser is zoomed
       or when a file is opened inside a scaled preview surface.
       Using it here caused the game to shrink to the left side instead
       of centering in the real available viewport.
    */
    const vw = viewport.clientWidth || window.innerWidth || GAME_WIDTH;
    const vh = viewport.clientHeight || window.innerHeight || GAME_HEIGHT;

    const rootStyle = getComputedStyle(document.documentElement);

    const safeTop = parseFloat(rootStyle.getPropertyValue("--safe-top")) || 0;
    const safeRight = parseFloat(rootStyle.getPropertyValue("--safe-right")) || 0;
    const safeBottom = parseFloat(rootStyle.getPropertyValue("--safe-bottom")) || 0;
    const safeLeft = parseFloat(rootStyle.getPropertyValue("--safe-left")) || 0;

    const availableWidth = Math.max(1, vw - safeLeft - safeRight);
    const availableHeight = Math.max(1, vh - safeTop - safeBottom);

    gameStageScale = Math.min(
        availableWidth / GAME_WIDTH,
        availableHeight / GAME_HEIGHT
    );

    /*
       Center the 1080×1920 stage inside the actual viewport.
       The stage is still clipped by #game-viewport, so it cannot
       create page scrolling.
    */
    const displayedWidth = GAME_WIDTH * gameStageScale;
    const displayedHeight = GAME_HEIGHT * gameStageScale;

    // The viewport itself is a flex centering surface. Keep the stage at its
    // native 1080x1920 layout size and only scale it visually around center.
    // This avoids transformed-layout overflow and guarantees symmetric bars.
    gameStageLeft = safeLeft + Math.max(0, (availableWidth - displayedWidth) / 2);
    gameStageTop = safeTop + Math.max(0, (availableHeight - displayedHeight) / 2);

    stage.style.left = "auto";
    stage.style.top = "auto";
    stage.style.transformOrigin = "center center";
    stage.style.transform = "scale(" + gameStageScale + ")";

    /* Keep the existing 420×746.6667 legacy design surface intact.
       It is scaled once inside the 1080×1920 virtual stage. */
    const content = document.getElementById("game-content");
    if(content){
        content.style.transform = "scale(" + (GAME_WIDTH / LEGACY_WIDTH) + ")";
        content.style.transformOrigin = "top left";
    }

    /* Expose useful diagnostics for testing. */
    window.GAME_VIEWPORT_WIDTH = vw;
    window.GAME_VIEWPORT_HEIGHT = vh;
    window.GAME_STAGE_SCALE = gameStageScale;
    window.GAME_STAGE_LEFT = gameStageLeft;
    window.GAME_STAGE_TOP = gameStageTop;
}

function gamePointFromClient(clientX,clientY){

    return {
        x:
            (clientX-gameStageLeft)/
            gameStageScale,

        y:
            (clientY-gameStageTop)/
            gameStageScale
    };

}

function clientPointFromGame(x,y){

    return {
        x:
            gameStageLeft+
            x*gameStageScale,

        y:
            gameStageTop+
            y*gameStageScale
    };

}


/* Convert any Pointer/Touch/Mouse event into 1080×1920
   virtual game coordinates. */
function getGamePointFromEvent(event){
    let clientX = 0;
    let clientY = 0;

    if(event && event.touches && event.touches.length){
        clientX = event.touches[0].clientX;
        clientY = event.touches[0].clientY;
    }else if(event && event.changedTouches && event.changedTouches.length){
        clientX = event.changedTouches[0].clientX;
        clientY = event.changedTouches[0].clientY;
    }else if(event){
        clientX = event.clientX ?? 0;
        clientY = event.clientY ?? 0;
    }

    return gamePointFromClient(clientX, clientY);
}

function applyGameStageTransform(){
    updateGameStageScale();
}

window.addEventListener(
    "resize",
    updateGameStageScale,
    {passive:true}
);

window.addEventListener(
    "orientationchange",
    updateGameStageScale,
    {passive:true}
);

if(window.visualViewport){

    /* visualViewport is only a resize trigger. Its dimensions are NOT
       used for the game scale because browser zoom can shrink it. */
    window.visualViewport.addEventListener(
        "resize",
        updateGameStageScale,
        {passive:true}
    );

}

updateGameStageScale();

/* V6: the viewport owns all clipping and centering. Never let a descendant
   contribute document-level scroll dimensions. */
(function enforceViewportSurface(){
    const viewport = document.getElementById("game-viewport");
    if(!viewport) return;
    viewport.style.display = "flex";
    viewport.style.alignItems = "center";
    viewport.style.justifyContent = "center";
    viewport.style.overflow = "hidden";
})();

/* V5 runtime guard: prevent legacy scrolling and keep stage centered in the layout viewport. */
(function installViewportLock(){
    const lock = () => {
        document.documentElement.style.overflow = "hidden";
        document.body.style.overflow = "hidden";
        document.documentElement.style.overscrollBehavior = "none";
        document.body.style.overscrollBehavior = "none";
        updateGameStageScale();
    };

    window.addEventListener("resize", lock, {passive:true});
    window.addEventListener("orientationchange", lock, {passive:true});
    if(window.visualViewport){
        window.visualViewport.addEventListener("resize", lock, {passive:true});
    }
    lock();
})();

/*
   ★ COMPLETE virtual-stage validation helpers
   These expose one consistent 1080×1920 coordinate system
   for future Hotspots, Canvas/VFX and pointer interactions.
*/
window.GAME_VIRTUAL_WIDTH = GAME_WIDTH;
window.GAME_VIRTUAL_HEIGHT = GAME_HEIGHT;
window.gameToScreenPoint = clientPointFromGame;
window.screenToGamePoint = gamePointFromClient;
window.eventToGamePoint = getGamePointFromEvent;


/* =====================================================
   基本設定
===================================================== */

const SAVE_KEY =
    "battle_full_version_save_v5";


const START_ATTRIBUTE_POINTS = 10;


/* =====================================================
   ★ 六項能力值
=====================================================

   attack      = 攻擊
   vitality    = 體質
   energy      = 能量
   intelligence= 智力
   spirit      = 精神
   agility     = 敏捷

===================================================== */

const STAT_NAMES = {

    attack:"攻擊",
    vitality:"體質",
    energy:"能量",
    intelligence:"智力",
    spirit:"精神",
    agility:"敏捷"

};


/* =====================================================
   元素
===================================================== */

const elementDatabase = {

    fire:{
        name:"火",
        icon:"",
        character:"火法師"
    },

    wind:{
        name:"風",
        icon:"",
        character:"風弓手"
    },

    earth:{
        name:"土",
        icon:"",
        character:"土騎士"
    },

    water:{
        name:"水",
        icon:"",
        character:"水戰士"
    }

};


/*
   ★ 新增（依照使用者要求，emoji換成CSS
   動畫圖示）：
   組出<span class="elem-icon elem-icon-火/水/風/土">
   這種HTML片段的小工具，取代原本直接把
   element.icon（emoji字元）塞進字串裡
   的寫法。

   任何地方原本寫「element.icon+" "+xxx」
   這種字串組合、而且是用innerHTML／
   .innerHTML=顯示出來（不是textContent），
   都可以改成呼叫這裡，直接拿到含CSS圖示
   的HTML字串。
*/

function getElementIconHTML(elementKey){

    return (
        '<span class="elem-icon elem-icon-'+
        (elementKey||"fire")+
        '"></span>'
    );

}


let selectedCreationElement =
    "fire";


/* =====================================================
   創角能力
   ★ 全部從0開始
===================================================== */

const creationStats = {

    attack:0,
    vitality:0,
    energy:0,
    intelligence:0,
    spirit:0,
    agility:0

};


let creationPoints =
    START_ATTRIBUTE_POINTS;


/* =====================================================
   ★ 第二角色（Lv.10解鎖）

   跟第一名角色（player）結構完全對稱，
   獨立的等級/經驗/屬性/HP/SP，
   彼此不共用，只共用經驗池（分配時自己選要給誰）。

   player2在還沒創建之前是null，
   存檔/讀檔、UI渲染都要先判斷這個是不是null。
===================================================== */

let player2 = null;

/* 第三角色資料槽：目前先保留為 null，不自行發明解鎖/創角條件。背包 UI 已完整支援第三角色資料。 */
let player3 = null;


/*
   ★ 新增（依照使用者要求，角色陣列重構
   第一階段）：
   使用者明確表示之後會開發第三名角色，
   現在的player/player2兩個各自獨立變數、
   每個角色一套函式（castDamageSkill/
   castPlayer2Skill、getMainCharacterStats/
   getPlayer2BattleStats……）的寫法，
   之後每加一個角色都要再複製一份，
   長期是技術債。

   完整重構成characters[]陣列風險很高
   （現有30幾個函式都要跟著大改），這次
   先做低風險的第一階段：新增這個
   getCharacters()輔助函式，之後新寫的
   通用邏輯（例如這次的buff/debuff系統）
   一律呼叫這裡取得「目前存在的全部角色」，
   不要再各自硬寫[player,player2]。

   故意寫成「每次呼叫都重新讀取」的函式，
   不是宣告一次的靜態陣列——如果宣告成
   靜態陣列，player2從null被賦值成真正的
   角色物件那一刻，陣列裡存的還是舊的null
   參照，不會自動更新。用函式現場組陣列
   就沒有這個問題，player2晚一點才創建
   也一樣抓得到最新狀態。

   之後真的要加第三角色時，只要在這個陣列
   加一行、把角色創建/存讀檔邏輯比照
   player2的模式做一份，「新功能」的部分
   （只要有用這個函式的）幾乎不用再改。
   「舊功能」（castDamageSkill這類還沒
   通用化的核心函式）到時候才需要逐步遷移，
   不是這次的範圍。
*/

function getCharacters(){

    return [
        player,
        player2,
        player3
    ].filter(
        character=>
            !!character
    );

}


let selectedCreationElement2 =
    "fire";


const creationStats2 = {

    attack:0,
    vitality:0,
    energy:0,
    intelligence:0,
    spirit:0,
    agility:0

};


let creationPoints2 =
    START_ATTRIBUTE_POINTS;


/* =====================================================
   玩家
===================================================== */

const player = {

    id:"",

    element:"fire",

    level:1,

    exp:0,

    expNext:100,

    /*
       六項核心能力
    */

    attack:0,

    vitality:0,

    energy:0,

    intelligence:0,

    spirit:0,

    agility:0,

    /*
       每次升級固定獲得的額外HP/SP
       （不算在體質/能量公式內，
       單獨累加，符合規格「升級 +30HP +10SP」）
    */

    bonusHP:0,

    bonusSP:0,

    /*
       狀態
    */

    hp:100,

    sp:50,

    attributePoints:0,

    skillPoints:0,

    /*
       ★ 新增：技能buff追蹤（例如怒火）。
       陣列存放目前生效中的buff，
       每個回合會遞減turnsLeft，歸零就移除。
    */

    activeBuffs:[],

    /*
       ★ 新增（依照使用者要求，「野怪異常
       狀態直接做」——怪物終於可以對玩家
       附加負面效果了）：跟怪物身上的
       monster.statusEffects是同一套資料
       結構、同一套共用函式
       （applyMonsterDebuff()/
       getMonsterDebuffValue()/
       isMonsterFrozen()/isMonsterPetrified()
       雖然名字裡有「Monster」，但這些函式
       本來就只操作傳進去的物件本身，沒有
       任何寫死monster專屬的欄位，玩家角色
       物件一樣能直接沿用，不用重寫一套）。
    */

    statusEffects:[],

    /*
       ★ 新增：防禦狀態。
       選擇防禦之後設為true，
       下次輪到自己行動時（beginCharacterTurn()）
       會重置回false。
    */

    isDefending:false

};


/*
   ★ 共用經驗池
   戰鬥獲得的EXP先進這裡，
   玩家自行按按鈕分配給角色升級。
*/

let sharedExp = 0;

/*
   ★ 新增（依照使用者要求，主城新增商店
   系統）：金幣是跟經驗池一樣的「共用資源」，
   不分角色，賣裝備/完成任務/成就獲得的
   金幣全部進同一個池子，商店消費也是從
   這裡扣，跟sharedExp用同一種設計邏輯。
*/

let gold = 300;

/* =====================================================
   V93 — 開發測試資源
   測試按鈕改成「每按一次就直接追加」：
   金幣 +1,000,000；共用經驗池 +10,000,000。
   不再存在最低值、永久鎖定或自動補回機制。
===================================================== */
const TEST_GOLD_GRANT=1000000;
const TEST_EXP_POOL_GRANT=10000000;

/*
   ★ 新增（依照使用者要求，主城新增六個
   功能：商店/角色展示/每日任務/圖鑑/成就/
   公告）：
   這裡統一宣告這幾個功能需要的持久化資料
   跟靜態設定資料。

   dailyQuestState：每日任務進度，
   date記錄「上次重置是哪一天」，每次玩家
   打開任務清單時會檢查今天的日期跟這個
   date是否相同，不同的話代表跨天了，
   進度/領取狀態全部重置。

   bestiaryData：圖鑑，key是怪物名稱，
   紀錄有沒有見過、累計擊殺數。

   achievementState：成就，key是成就id，
   紀錄有沒有已經領取過獎勵
   （成就本身達成與否是即時用
   checkAchievementCondition()判斷，
   不需要另外存「有沒有達成」，只需要存
   「有沒有領過」，不然重複判斷邏輯會
   分散在存檔/讀檔/畫面三個地方）。
*/

let dailyQuestState={

    date:"",

    progress:{
        checkin:0,
        killMonsters:0,
        winBattle:0
    },

    claimed:{
        checkin:false,
        killMonsters:false,
        winBattle:false
    }

};


const dailyQuestDefinitions=[

    {
        id:"checkin",
        name:"今日簽到",
        desc:"打開每日任務清單即完成",
        goal:1,
        reward:{gold:50}
    },

    {
        id:"killMonsters",
        name:"擊敗5隻怪物",
        desc:"今天累計擊敗5隻怪物",
        goal:5,
        reward:{gold:100,exp:50}
    },

    {
        id:"winBattle",
        name:"打贏1場戰鬥",
        desc:"今天打贏一場完整戰鬥",
        goal:1,
        reward:{gold:80}
    }

];


/*
   ★ 新增（依照使用者要求，任務改成兩個
   分頁：每日任務／委託任務）：
   委託任務跟每日任務共用同一套「每天
   重置」的週期（ensureDailyQuestsCurrent()
   會一起處理兩邊），差別只在目標數字
   訂得更高、獎勵更好，鼓勵玩家真的花
   心力去達成，不是每日任務那種輕鬆
   隨手完成的等級。

   進度來源刻意沿用跟每日任務一樣的
   killMonsters/winBattle事件（見
   recordMonsterKillForBestiary()／
   winBattle()裡，兩邊的進度會同時被
   累加），不用另外設計、另外埋新的
   追蹤鉤子。
*/

let commissionQuestState={

    date:"",

    progress:{
        killMonsters:0,
        winBattle:0
    },

    claimed:{
        killMonsters:false,
        winBattle:false
    }

};


const commissionQuestDefinitions=[

    {
        id:"killMonsters",
        name:"委託：擊敗15隻怪物",
        desc:"今天累計擊敗15隻怪物",
        goal:15,
        reward:{gold:250}
    },

    {
        id:"winBattle",
        name:"委託：打贏3場戰鬥",
        desc:"今天打贏三場完整戰鬥",
        goal:3,
        reward:{gold:200,exp:150}
    }

];


let bestiaryData={};


let achievementState={};


/*
   ★ 新增（依照使用者要求，離線經驗系統）：
   離線經驗的核心參數跟狀態，loadGame()
   讀檔時會依照上次存檔時間算出
   pendingOfflineExp，玩家在主城「離線
   經驗」那張卡片按下領取才會真的加進
   經驗池。
*/

const OFFLINE_EXP_PER_MINUTE=
    10;

const OFFLINE_EXP_MAX_MINUTES=
    480;

let pendingOfflineExp=
    0;

let offlineElapsedMinutesForDisplay=
    0;

/*
   ★ 新增（依照使用者回報，「切到背景
   再切回來，到底有沒有算離線經驗」）：
   原本離線經驗的計算邏輯整段寫死在
   loadGame()裡，只有網頁「第一次載入」
   才會執行到——單純切到背景、再切回
   前景（沒有真的關閉分頁重新整理），
   完全不會觸發計算，這是使用者發現的
   真實漏洞，不是誤會。

   把計算邏輯抽成這個共用函式，
   loadGame()（網頁第一次載入）跟
   visibilitychange切回前景這兩個時機
   都會呼叫這裡，兩種情況都能正確累積
   離線經驗，不用整個重新整理頁面才算。

   多次觸發也不會重複多算：每次都是
   拿「現在時間」減「上一次記錄的時間點」，
   算完立刻把時間點更新成現在，下一次
   觸發只會算「這一段新的離線時間」，
   不會把之前已經算過的區間再算一次。
*/

let lastOfflineCheckTimestamp=
    Date.now();


/* =====================================================
   ★ 新增（依照使用者要求，「很多地方都要
   加看廣告」，先做好通用架構）：

   showRewardedAd(onSuccess, onFail)——
   全遊戲「看廣告換獎勵」唯一的入口，
   不管是離線經驗雙倍、之後任務加成、
   商店額外道具……任何想加「看廣告」的
   地方，都呼叫這一個函式，差別只在
   給的onSuccess（廣告看完後要做什麼）
   不一樣。

   ★ 重要：目前AD_SYSTEM_READY是false，
   代表還沒申請到真的AdSense/AdMob帳號，
   這裡先用「模擬播放」頂著（顯示提示、
   等1.5秒、直接當作看完），讓你可以先
   測試「雙倍獎勵」這類邏輯對不對，不用
   等廣告帳號申請下來才能測。

   ★ 之後申請到真的廣告帳號，把
   AD_SYSTEM_READY改成true，並且把
   下面標示「真正串接廣告API的地方」
   那一段，換成真正呼叫Google Ad
   Placement API的adBreak()（或你最後
   選用的廣告服務商的API）——只要改這裡
   一個函式，全遊戲所有用到
   showRewardedAd()的地方會一起自動
   變成真廣告，不用一個個功能分別去改。
*/

const AD_SYSTEM_READY=
    false;


function showRewardedAd(
    onSuccess,
    onFail
){

    if(!AD_SYSTEM_READY){

        /*
           ★ 模擬廣告播放（目前狀態）：
           顯示提示、等1.5秒、直接視為
           看完成功。純粹是為了讓「雙倍
           獎勵」這類邏輯現在就能測試，
           不是真的廣告。
        */

        addBattleLog(
            "（模擬）廣告播放中…"
        );


        setTimeout(()=>{

            addBattleLog(
                "（模擬）廣告播放完成！"
            );


            if(onSuccess){

                onSuccess();

            }

        },1500);


        return;

    }


    /*
       ★ 真正串接廣告API的地方（等申請到
       AdSense/AdMob帳號後，把下面這段
       換成真正的呼叫）：

       範例（Google Ad Placement API，
       純網頁版）：

       window.adBreak({
           type:'reward',
           name:'offline-exp-double',
           beforeReward:(showAdFn)=>{
               showAdFn();
           },
           adViewed:()=>{
               onSuccess&&onSuccess();
           },
           adDismissed:()=>{
               onFail&&onFail();
           },
           adBreakDone:()=>{}
       });
    */

    if(onFail){

        onFail();

    }

}

function calculateOfflineExpSince(
    previousTimestamp
){

    if(
        !Number.isFinite(
            previousTimestamp
        )
    ){
        return;
    }


    const elapsedMs=

        Date.now()-
        previousTimestamp;


    const elapsedMinutes=

        Math.max(
            0,
            Math.floor(
                elapsedMs/60000
            )
        );


    /*
       切背景時間太短（少於1分鐘）不特別
       處理，避免玩家只是切出去看一下
       通知馬上切回來，也跳出一則「離線
       經驗」的訊息，感覺很雜訊。
    */

    if(elapsedMinutes<1){
        return;
    }


    const cappedMinutes=

        Math.min(
            elapsedMinutes,
            OFFLINE_EXP_MAX_MINUTES
        );


    pendingOfflineExp=

        pendingOfflineExp+
        cappedMinutes*
        OFFLINE_EXP_PER_MINUTE;


    offlineElapsedMinutesForDisplay=

        offlineElapsedMinutesForDisplay+
        elapsedMinutes;

}


const achievementDefinitions=[

    {
        id:"firstKill",
        name:"初次交手",
        desc:"累計擊敗1隻怪物",
        reward:{gold:20},
        check:()=>
            getTotalMonsterKills()>=1
    },

    {
        id:"kill50",
        name:"小有戰績",
        desc:"累計擊敗50隻怪物",
        reward:{gold:100},
        check:()=>
            getTotalMonsterKills()>=50
    },

    {
        id:"kill200",
        name:"身經百戰",
        desc:"累計擊敗200隻怪物",
        reward:{gold:300},
        check:()=>
            getTotalMonsterKills()>=200
    },

    {
        id:"level20",
        name:"嶄露頭角",
        desc:"任一角色等級達到20",
        reward:{gold:150},
        check:()=>

            player.level>=20 ||
            (
                player2 &&
                player2.level>=20
            )
    },

    {
        id:"level50",
        name:"獨當一面",
        desc:"任一角色等級達到50",
        reward:{gold:500},
        check:()=>

            player.level>=50 ||
            (
                player2 &&
                player2.level>=50
            )
    },

    {
        id:"duo",
        name:"雙人成行",
        desc:"創建第二位角色",
        reward:{gold:100},
        check:()=>
            !!player2
    },

    {
        id:"gold1000",
        name:"小富翁",
        desc:"金幣達到1000",
        reward:{gold:100},
        check:()=>
            gold>=1000
    }

];


/* =====================================================
   V91 — 統一藥水資料來源

   商店、背包、戰鬥都只認這六個 potionDefinitions。
   不再使用 player.hpPotions / player.spPotions
   這套獨立戰鬥庫存。
===================================================== */

const potionDefinitions=[
    {
        id:"hpPotion10",
        name:"回復10%HP藥水",
        shortName:"HP 10%",
        icon:"",
        type:"potion",
        resource:"hp",
        recoveryPercent:10,
        price:20,
        stats:{}
    },
    {
        id:"spPotion10",
        name:"回復10%SP藥水",
        shortName:"SP 10%",
        icon:"",
        type:"potion",
        resource:"sp",
        recoveryPercent:10,
        price:25,
        stats:{}
    },
    {
        id:"hpPotion50",
        name:"回復50%的HP藥水",
        shortName:"HP 50%",
        icon:"",
        type:"potion",
        resource:"hp",
        recoveryPercent:50,
        price:80,
        stats:{}
    },
    {
        id:"spPotion50",
        name:"回復50%的SP藥水",
        shortName:"SP 50%",
        icon:"",
        type:"potion",
        resource:"sp",
        recoveryPercent:50,
        price:100,
        stats:{}
    },
    {
        id:"hpPotion100",
        name:"回復所有HP的藥水",
        shortName:"HP 全回復",
        icon:"",
        type:"potion",
        resource:"hp",
        recoveryPercent:100,
        price:180,
        stats:{}
    },
    {
        id:"spPotion100",
        name:"回復所有SP的藥水",
        shortName:"SP 全回復",
        icon:"",
        type:"potion",
        resource:"sp",
        recoveryPercent:100,
        price:220,
        stats:{}
    }
];

const shopItems=potionDefinitions;

/* =====================================================
   V92 — 背包堆疊規則
   - 裝備類：每格最多 1 件。
   - 其餘類型：每格最多 100 件。
   - 超過上限會自動建立下一個堆疊，不讓單格突破上限。
===================================================== */

const INVENTORY_MAX_STACK_DEFAULT=100;

function isEquipmentInventoryType(type){
    return [
        "weapon",
        "helmet",
        "head",
        "hand",
        "shoulder",
        "armor",
        "shoes",
        "accessory",
        "ring"
    ].includes(type);
}

function getInventoryItemMaxStack(item){
    if(!item){
        return INVENTORY_MAX_STACK_DEFAULT;
    }

    return isEquipmentInventoryType(item.type)
        ? 1
        : INVENTORY_MAX_STACK_DEFAULT;
}

function cloneInventoryStackItem(item,count){
    const copy={...item};
    copy.stats=item && item.stats && typeof item.stats==="object"
        ? {...item.stats}
        : {};
    copy.count=Math.max(1,Math.floor(Number(count)||1));
    return copy;
}

function normalizeInventoryStacks(){
    const needsNormalization=inventoryItems.some(item=>{
        if(!item || !item.id){
            return true;
        }

        const count=Number(item.count);
        const maxStack=getInventoryItemMaxStack(item);

        return (
            !Number.isFinite(count) ||
            count<1 ||
            Math.floor(count)!==count ||
            count>maxStack
        );
    });

    if(!needsNormalization){
        return;
    }

    const normalized=[];

    inventoryItems.forEach(item=>{
        if(!item || !item.id){
            return;
        }

        const maxStack=getInventoryItemMaxStack(item);
        const numericCount=Number(item.count);
        let remaining=Number.isFinite(numericCount)
            ? Math.floor(numericCount)
            : 1;

        if(remaining<=0){
            return;
        }

        while(remaining>0 && normalized.length<102){
            const stackCount=Math.min(maxStack,remaining);
            normalized.push(cloneInventoryStackItem(item,stackCount));
            remaining-=stackCount;
        }

        if(remaining>0){
            console.warn(
                "背包堆疊超過102格容量，剩餘物品未能放入：",
                item.id,
                remaining
            );
        }
    });

    inventoryItems.length=0;
    normalized.forEach(item=>inventoryItems.push(item));
}

function getPotionDefinition(potionId){
    return potionDefinitions.find(
        item=>item.id===potionId
    )||null;
}

function getPotionEffectDescription(potionId){
    const definition=getPotionDefinition(potionId);
    if(!definition){
        return "未知效果";
    }

    const resourceLabel=definition.resource==="hp" ? "HP" : "SP";
    return definition.recoveryPercent>=100
        ? `回復所有${resourceLabel}`
        : `回復最大${resourceLabel}的 ${definition.recoveryPercent}%`;
}

function createPotionInventoryItem(potionId,count=1){
    const definition=getPotionDefinition(potionId);

    if(!definition){
        return null;
    }

    return{
        id:definition.id,
        name:definition.name,
        icon:definition.icon,
        type:"potion",
        resource:definition.resource,
        recoveryPercent:definition.recoveryPercent,
        count:Math.min(
            INVENTORY_MAX_STACK_DEFAULT,
            Math.max(1,Math.floor(Number(count)||1))
        ),
        price:Number.isFinite(definition.price) ? definition.price : 0,
        stats:{}
    };
}

function getPotionInventoryItems(potionId){
    return inventoryItems.filter(
        item=>item && item.id===potionId
    );
}

function getPotionInventoryItem(potionId){
    return getPotionInventoryItems(potionId)[0]||null;
}

function getPotionCount(potionId){
    return getPotionInventoryItems(potionId).reduce(
        (total,item)=>total+Math.max(0,Number(item.count)||0),
        0
    );
}

function getTotalPotionCount(resource=null){
    return potionDefinitions.reduce((total,definition)=>{
        if(resource && definition.resource!==resource){
            return total;
        }
        return total+getPotionCount(definition.id);
    },0);
}

function addPotionToInventory(potionId,amount=1){
    const definition=getPotionDefinition(potionId);
    const quantity=Math.max(1,Math.floor(Number(amount)||1));

    if(!definition){
        return false;
    }

    const stacks=getPotionInventoryItems(potionId);
    const stackFreeSpace=stacks.reduce(
        (total,item)=>
            total+Math.max(0,INVENTORY_MAX_STACK_DEFAULT-(Number(item.count)||0)),
        0
    );
    const freeSlots=Math.max(0,102-inventoryItems.length);
    const totalCapacity=
        stackFreeSpace+
        freeSlots*INVENTORY_MAX_STACK_DEFAULT;

    if(quantity>totalCapacity){
        return false;
    }

    let remaining=quantity;

    stacks.forEach(stack=>{
        if(remaining<=0){
            return;
        }

        const current=Math.max(0,Math.floor(Number(stack.count)||0));
        const space=Math.max(0,INVENTORY_MAX_STACK_DEFAULT-current);
        const add=Math.min(space,remaining);

        stack.count=current+add;
        stack.name=definition.name;
        stack.type="potion";
        stack.resource=definition.resource;
        stack.recoveryPercent=definition.recoveryPercent;
        stack.price=Number.isFinite(definition.price) ? definition.price : (Number(stack.price)||0);
        stack.stats={};
        remaining-=add;
    });

    while(remaining>0){
        const stackCount=Math.min(INVENTORY_MAX_STACK_DEFAULT,remaining);
        const created=createPotionInventoryItem(potionId,stackCount);

        if(!created){
            return false;
        }

        inventoryItems.push(created);
        remaining-=stackCount;
    }

    return true;
}

function consumePotionFromInventory(potionId,amount=1){
    let remaining=Math.max(1,Math.floor(Number(amount)||1));

    if(getPotionCount(potionId)<remaining){
        return false;
    }

    for(let index=inventoryItems.length-1;index>=0 && remaining>0;index--){
        const item=inventoryItems[index];

        if(!item || item.id!==potionId){
            continue;
        }

        const current=Math.max(0,Math.floor(Number(item.count)||0));
        const used=Math.min(current,remaining);
        const next=current-used;
        remaining-=used;

        if(next<=0){
            inventoryItems.splice(index,1);
        }else{
            item.count=next;
        }
    }

    rebuildInventorySlots();
    return true;
}

/*
   舊 V90 存檔有兩套藥水庫存：
   inventoryItems 裡的 hpPotion/spPotion，
   以及 player.hpPotions/player.spPotions。
   V92 仍會把它們安全映射成 10% 藥水，並遵守每疊100上限。
*/
function normalizePotionInventoryFromLegacy(saveData){
    const legacyPlayer=
        saveData && saveData.player
        ? saveData.player
        : {};

    const legacyHpBattle=Number(legacyPlayer.hpPotions);
    const legacySpBattle=Number(legacyPlayer.spPotions);

    let legacyHpBag=0;
    let legacySpBag=0;

    inventoryItems.forEach(item=>{
        if(!item){
            return;
        }
        if(item.id==="hpPotion"){
            legacyHpBag+=Math.max(0,Number(item.count)||0);
        }
        if(item.id==="spPotion"){
            legacySpBag+=Math.max(0,Number(item.count)||0);
        }
    });

    for(let index=inventoryItems.length-1;index>=0;index--){
        const id=inventoryItems[index] && inventoryItems[index].id;
        if(id==="hpPotion" || id==="spPotion"){
            inventoryItems.splice(index,1);
        }
    }

    potionDefinitions.forEach(definition=>{
        getPotionInventoryItems(definition.id).forEach(item=>{
            item.name=definition.name;
            item.icon=definition.icon;
            item.type="potion";
            item.resource=definition.resource;
            item.recoveryPercent=definition.recoveryPercent;
            item.price=Number.isFinite(definition.price) ? definition.price : (Number(item.price)||0);
            item.stats={};
            item.count=Math.max(1,Math.floor(Number(item.count)||1));
        });
    });

    normalizeInventoryStacks();

    const existingHp10=getPotionCount("hpPotion10");
    const existingSp10=getPotionCount("spPotion10");

    const hpLegacyCount=Math.max(
        existingHp10,
        legacyHpBag,
        Number.isFinite(legacyHpBattle) ? Math.max(0,legacyHpBattle) : 0
    );
    const spLegacyCount=Math.max(
        existingSp10,
        legacySpBag,
        Number.isFinite(legacySpBattle) ? Math.max(0,legacySpBattle) : 0
    );

    if(hpLegacyCount>existingHp10){
        addPotionToInventory(
            "hpPotion10",
            hpLegacyCount-existingHp10
        );
    }

    if(spLegacyCount>existingSp10){
        addPotionToInventory(
            "spPotion10",
            spLegacyCount-existingSp10
        );
    }

    normalizeInventoryStacks();

    delete player.hpPotions;
    delete player.spPotions;
    rebuildInventorySlots();
}

function getAutoPotionId(resource){
    const ids=potionDefinitions
        .filter(definition=>definition.resource===resource)
        .sort((a,b)=>a.recoveryPercent-b.recoveryPercent)
        .map(definition=>definition.id);

    return ids.find(id=>getPotionCount(id)>0)||null;
}

let battleItemCategory="potion";

function getBattleTalismanInventoryItems(){
    const byId=new Map();

    inventoryItems.forEach(item=>{
        if(
            !item ||
            item.type!=="talisman" ||
            !item.id
        ){
            return;
        }

        const count=Math.max(0,Math.floor(Number(item.count)||0));
        if(count<=0){
            return;
        }

        if(!byId.has(item.id)){
            byId.set(item.id,{
                ...item,
                count:0
            });
        }

        byId.get(item.id).count+=count;
    });

    return Array.from(byId.values());
}

function setBattleItemCategory(category){
    if(category!=="potion" && category!=="talisman"){
        return;
    }

    battleItemCategory=category;
    renderBattleItemMenu();
}

function renderBattleItemMenu(){
    const list=$("battlePotionList");
    const potionTab=$("battleItemPotionTab");
    const talismanTab=$("battleItemTalismanTab");

    if(!list){
        return;
    }

    const potionActive=battleItemCategory==="potion";

    if(potionTab){
        potionTab.classList.toggle("active",potionActive);
        potionTab.setAttribute("aria-selected",potionActive ? "true" : "false");
    }

    if(talismanTab){
        talismanTab.classList.toggle("active",!potionActive);
        talismanTab.setAttribute("aria-selected",!potionActive ? "true" : "false");
    }

    if(potionActive){
        const available=potionDefinitions.filter(
            definition=>getPotionCount(definition.id)>0
        );

        if(available.length===0){
            list.innerHTML=`
                <div class="battle-item-empty">
                    <strong>目前沒有補品</strong>
                    <span>商店購買的 HP／SP 藥水會直接顯示在這裡。</span>
                </div>
            `;
            return;
        }

        list.innerHTML=available.map(definition=>{
            const count=getPotionCount(definition.id);
            const resourceLabel=definition.resource==="hp" ? "HP" : "SP";
            const effectLabel=definition.recoveryPercent>=100
                ? `${resourceLabel} 全回復`
                : `${resourceLabel} +${definition.recoveryPercent}%`;

            return `
                <button
                    type="button"
                    class="battle-item-card ${definition.resource}"
                    onclick="usePotion('${definition.id}')"
                    title="${definition.name}"
                >
                    <span class="battle-item-badge">${resourceLabel}</span>
                    <span class="battle-item-name">${definition.shortName}</span>
                    <span class="battle-item-effect">${effectLabel}</span>
                    <span class="battle-item-count">×${count}</span>
                </button>
            `;
        }).join("");

        return;
    }

    const talismans=getBattleTalismanInventoryItems();

    if(talismans.length===0){
        list.innerHTML=`
            <div class="battle-item-empty">
                <strong>目前沒有符咒</strong>
                <span>之後取得冰封符、結界符等戰鬥符咒時，會顯示在這個頁籤。</span>
            </div>
        `;
        return;
    }

    /*
       目前專案還沒有正式符咒物品規格（skillId、技能等級、
       是否消耗SP、目標規則尚未寫入 Project Knowledge），
       所以這裡只忠實列出庫存，不擅自讓它施放某個技能。
       等第一張正式符咒規格確定後，再把點擊行為接進既有
       技能引擎，避免先寫一套錯的符咒公式。
    */
    list.innerHTML=talismans.map(item=>{
        const linkedSkill=item.skillId && skillDatabase[item.skillId]
            ? skillDatabase[item.skillId]
            : null;
        const skillLabel=linkedSkill
            ? linkedSkill.name+(item.skillLevel ? ` Lv.${item.skillLevel}` : "")
            : "尚未設定技能";

        return `
            <button
                type="button"
                class="battle-item-card talisman"
                disabled
                title="${item.name||item.id}"
            >
                <span class="battle-item-badge">符</span>
                <span class="battle-item-name">${item.name||item.id}</span>
                <span class="battle-item-effect">${skillLabel}</span>
                <span class="battle-item-count">×${item.count}</span>
            </button>
        `;
    }).join("");
}

/* 保留舊函式名稱，避免既有 usePotion() 的庫存刷新路徑失效。 */
function renderBattlePotionMenu(){
    battleItemCategory="potion";
    renderBattleItemMenu();
}


/*
   ★ 圖鑑擊殺紀錄——killMonster()裡唯一的
   呼叫點，見上面killMonster()的修改。
*/

function recordMonsterKillForBestiary(
    monster
){

    if(!monster||!monster.name){
        return;
    }


    if(!bestiaryData[monster.name]){

        bestiaryData[monster.name]={
            seen:true,
            kills:0
        };

    }


    bestiaryData[monster.name].seen=
        true;

    bestiaryData[monster.name].kills=
        (
            bestiaryData[monster.name].kills||
            0
        )+1;


    ensureDailyQuestsCurrent();

    dailyQuestState.progress.killMonsters=
        Math.min(

            dailyQuestDefinitions.find(
                q=>q.id==="killMonsters"
            ).goal,

            (
                dailyQuestState.progress.killMonsters||
                0
            )+1

        );


    /*
       ★ 新增：委託任務的擊殺進度，
       跟每日任務同一個事件來源，一起
       累加，不用另外埋鉤子。
    */

    commissionQuestState.progress.killMonsters=
        Math.min(

            commissionQuestDefinitions.find(
                q=>q.id==="killMonsters"
            ).goal,

            (
                commissionQuestState.progress.killMonsters||
                0
            )+1

        );

}


function getTotalMonsterKills(){

    return Object.values(
        bestiaryData
    ).reduce(
        (sum,entry)=>

            sum+
            (entry.kills||0),

        0
    );

}


/*
   ★ 每天第一次打開每日任務清單，或每天
   第一次擊殺怪物/打贏戰鬥時都會呼叫這裡，
   確保「今天」的進度不會沿用到「昨天」。
*/

function ensureDailyQuestsCurrent(){

    const today=

        new Date()
        .toISOString()
        .slice(0,10);


    if(
        dailyQuestState.date!==
        today
    ){

        dailyQuestState.date=
            today;

        dailyQuestState.progress={
            checkin:0,
            killMonsters:0,
            winBattle:0
        };

        dailyQuestState.claimed={
            checkin:false,
            killMonsters:false,
            winBattle:false
        };

    }


    /*
       ★ 新增：委託任務跟每日任務共用
       同一個「今天」的日期判斷，各自
       有自己獨立的進度/領取狀態，
       互不影響。
    */

    if(
        commissionQuestState.date!==
        today
    ){

        commissionQuestState.date=
            today;

        commissionQuestState.progress={
            killMonsters:0,
            winBattle:0
        };

        commissionQuestState.claimed={
            killMonsters:false,
            winBattle:false
        };

    }

}



/* =====================================================
   ★ 基礎能力計算
===================================================== */

function getBaseStats(){

    return {

        /*
           這裡只給角色固定基礎值。
           六項能力仍然完全由玩家配點。

           1體質 = +50HP +15防禦
           1能量 = +15SP

           bonusHP / bonusSP 是每次升級
           額外固定獲得的 +30HP +10SP，
           跟體質/能量的配點加成分開計算。
        */

        maxHP:
            100+
            player.vitality*50+
            player.bonusHP,

        maxSP:
            50+
            player.energy*15+
            player.bonusSP,

        attack:
            10+
            player.attack*5,

        defense:
            10+
            player.vitality*15,

        magicAttack:
            player.intelligence*5,

        accuracy:
            player.spirit*2,

        resistance:
            calculateStatusResistancePercent(player.spirit),

        antiCrit:
            calculateAntiCritPercent(player.spirit),

        speed:
            player.agility,

        evasion:
            player.agility*2

    };

}


/* =====================================================
   裝備
===================================================== */

const characterEquipment = {

    fire:{
        head:null,
        hand:null,
        shoulder:null,
        armor:null,
        shoes:null,
        ring:null
    },

    water:{
        head:null,
        hand:null,
        shoulder:null,
        armor:null,
        shoes:null,
        ring:null
    },

    wind:{
        head:null,
        hand:null,
        shoulder:null,
        armor:null,
        shoes:null,
        ring:null
    }

};

function normalizeEquipmentSlots(equipment){
    if(!equipment || typeof equipment!=="object") return;
    if(!Object.prototype.hasOwnProperty.call(equipment,"head")) equipment.head=equipment.helmet||null;
    if(!Object.prototype.hasOwnProperty.call(equipment,"hand")) equipment.hand=equipment.weapon||null;
    if(!Object.prototype.hasOwnProperty.call(equipment,"shoulder")) equipment.shoulder=null;
    if(!Object.prototype.hasOwnProperty.call(equipment,"armor")) equipment.armor=null;
    if(!Object.prototype.hasOwnProperty.call(equipment,"shoes")) equipment.shoes=null;
    if(!Object.prototype.hasOwnProperty.call(equipment,"ring")) equipment.ring=equipment.accessory||null;
    delete equipment.weapon;
    delete equipment.helmet;
    delete equipment.accessory;
}


/* =====================================================
   裝備加成
===================================================== */

normalizeEquipmentSlots(characterEquipment.fire);
normalizeEquipmentSlots(characterEquipment.water);
normalizeEquipmentSlots(characterEquipment.wind);

function getEquipmentBonus(characterId){

    const equipment =
        characterEquipment[characterId];

    const bonus = {

        attack:0,
        vitality:0,
        energy:0,
        intelligence:0,
        spirit:0,
        agility:0,

        maxHP:0,
        maxSP:0,
        defense:0

    };


    if(!equipment){
        return bonus;
    }


    Object.values(equipment)
    .forEach(item=>{

        if(
            !item ||
            !item.stats
        ){
            return;
        }


        Object.keys(item.stats)
        .forEach(stat=>{

            if(
                Object.prototype.hasOwnProperty.call(
                    bonus,
                    stat
                )
            ){

                bonus[stat] +=
                    Number(
                        item.stats[stat] || 0
                    );

            }

        });

    });


    return bonus;

}



/* =====================================================
   V119 — 玩家戰鬥中六圍減益統一入口

   風系「降低敏捷／降低所有能力值」與土系「降低防禦」
   先前能寫進 statusEffects，但玩家最終能力沒有完整讀取，
   造成怪物對玩家施放時看得到文字、實際數值卻沒有下降。

   這裡統一規則：
   - statDown 直接降低對應六圍點數；若技能有 excludedStats，該六圍不降。
   - agilityDown 再額外降低有效敏捷。
   - defenseDown 在所有防禦加成算完後再降低最終防禦。
   - 暫時性的 vitality / energy 降低「不動態縮減 maxHP / maxSP」，
     避免減益命中瞬間把現有 HP/SP 強制裁掉；體質仍會降低戰鬥防禦。
     這是沿用本專案先前已確認的戰鬥資源穩定原則，不新增隱性扣血/扣SP。
===================================================== */
function getEffectivePlayerAbilityPoints(character,equipmentBonus,statName){
    if(!character){ return 0; }

    const basePoints=Number(character[statName])||0;
    const equipmentPoints=(statName==="attack")
        ? 0
        : (Number(equipmentBonus&&equipmentBonus[statName])||0);

    const statDown=getStatDownPercentFor(character,statName);

    let effective=(basePoints+equipmentPoints)*(1-statDown/100);

    if(statName==="agility"){
        const agilityDown=getMonsterDebuffValue(character,"agilityDown");
        effective*=1-agilityDown/100;
    }

    return Math.max(0,effective);
}

function getPlayerDefenseDownPercent(character){
    return Math.max(0,getMonsterDebuffValue(character,"defenseDown"));
}

/* =====================================================
   主角最終能力
===================================================== */

function getMainCharacterStats(){

    const bonus=getEquipmentBonus(player.element);

    /* 裝備的 attack 仍沿用既有規則：它是直接物攻詞條，不是「攻擊六圍點數」。 */
    const effectiveAttackPoints=getEffectivePlayerAbilityPoints(player,bonus,"attack");
    const effectiveVitality=getEffectivePlayerAbilityPoints(player,bonus,"vitality");
    const effectiveEnergy=getEffectivePlayerAbilityPoints(player,bonus,"energy");
    const effectiveIntelligence=getEffectivePlayerAbilityPoints(player,bonus,"intelligence");
    const effectiveSpirit=getEffectivePlayerAbilityPoints(player,bonus,"spirit");
    const effectiveAgility=getEffectivePlayerAbilityPoints(player,bonus,"agility");

    const evasionBuffPercent=getActiveBuffPercent(player,"dodgeSkill");
    const defenseBuffPercent=getActiveBuffPercent(player,"rockWall");

    const windEXLevel=getSkillLevel("fire","windEX");
    const earthEXLevel=getSkillLevel("fire","earthEX");

    const evasionPassivePercent=windEXLevel>0
        ? (skillDatabase.windEX.evasionBonusPercent||0)
        : 0;
    const defensePassivePercent=earthEXLevel>0
        ? (skillDatabase.earthEX.defenseBonusPercent||0)
        : 0;

    const defenseDownPercent=getPlayerDefenseDownPercent(player);

    const rawDefense=(
        10+
        effectiveVitality*15+
        (Number(bonus.defense)||0)
    );

    const buffedDefense=rawDefense*(
        1+(defenseBuffPercent+defensePassivePercent)/100
    );

    const rawEvasion=effectiveAgility*2;

    return {
        /* 暫時六圍減益不動態壓縮最大HP/SP；詳見上方統一規則。 */
        maxHP:
            100+
            (player.vitality+(Number(bonus.vitality)||0))*50+
            player.bonusHP+
            (Number(bonus.maxHP)||0),

        maxSP:
            50+
            (player.energy+(Number(bonus.energy)||0))*15+
            player.bonusSP+
            (Number(bonus.maxSP)||0),

        attack:
            10+
            effectiveAttackPoints*5+
            (Number(bonus.attack)||0),

        attackPoints:effectiveAttackPoints,

        defense:Math.max(
            0,
            Math.round(buffedDefense*(1-defenseDownPercent/100))
        ),

        magicAttack:effectiveIntelligence*5,
        accuracy:effectiveSpirit*2,
        resistance:calculateStatusResistancePercent(effectiveSpirit),
        antiCrit:calculateAntiCritPercent(effectiveSpirit),
        speed:effectiveAgility,

        evasion:Math.max(
            0,
            Math.round(rawEvasion*(1+(evasionBuffPercent+evasionPassivePercent)/100))
        ),

        vitality:effectiveVitality,
        energy:effectiveEnergy,
        intelligence:effectiveIntelligence,
        spirit:effectiveSpirit,
        agility:effectiveAgility
    };

}


/*
   ★ 新增（依照使用者要求）：
   通用版本，讀取角色身上某個buff目前的
   百分比數值（沒有這個buff的話回傳0），
   跟怪物那邊的getMonsterDebuffValue()是
   對稱設計，一個讀activeBuffs（玩家的
   增益），一個讀statusEffects（怪物的
   減益）。
*/

function getActiveBuffPercent(
    character,
    buffType
){

    if(!character.activeBuffs){
        return 0;
    }


    const buff=

        character.activeBuffs.find(
            b=>

                b.type===buffType &&
                b.turnsLeft>0

        );


    return (
        buff
        ?
        (buff.percent||0)
        :
        0
    );

}


function hasActiveBuff(
    character,
    buffType
){

    return !!(
        character.activeBuffs &&
        character.activeBuffs.some(
            b=>

                b.type===buffType &&
                b.turnsLeft>0

        )
    );

}


/*
   ★ 新增：第二角色的完整戰鬥數值。
   跟getMainCharacterStats()算法完全對稱，
   只是base直接用player2自己的六圍算，
   裝備加成抓固定的"player2"這個key
   （不是player2.element，
   因為裝備欄是用角色id存的，不是元素）。
*/

function getPlayer2BattleStats(){

    if(!player2){ return null; }

    const bonus=getEquipmentBonus("player2");

    const effectiveAttackPoints=getEffectivePlayerAbilityPoints(player2,bonus,"attack");
    const effectiveVitality=getEffectivePlayerAbilityPoints(player2,bonus,"vitality");
    const effectiveEnergy=getEffectivePlayerAbilityPoints(player2,bonus,"energy");
    const effectiveIntelligence=getEffectivePlayerAbilityPoints(player2,bonus,"intelligence");
    const effectiveSpirit=getEffectivePlayerAbilityPoints(player2,bonus,"spirit");
    const effectiveAgility=getEffectivePlayerAbilityPoints(player2,bonus,"agility");

    const windEXLevel=getSkillLevel("player2","windEX");
    const earthEXLevel=getSkillLevel("player2","earthEX");

    const evasionPassivePercent=windEXLevel>0
        ? (skillDatabase.windEX.evasionBonusPercent||0)
        : 0;
    const defensePassivePercent=earthEXLevel>0
        ? (skillDatabase.earthEX.defenseBonusPercent||0)
        : 0;

    const evasionBuffPercent=getActiveBuffPercent(player2,"dodgeSkill");
    const defenseBuffPercent=getActiveBuffPercent(player2,"rockWall");
    const defenseDownPercent=getPlayerDefenseDownPercent(player2);

    const rawDefense=(
        10+
        effectiveVitality*15+
        (Number(bonus.defense)||0)
    );
    const buffedDefense=rawDefense*(
        1+(defenseBuffPercent+defensePassivePercent)/100
    );
    const rawEvasion=effectiveAgility*2;

    return {
        maxHP:
            100+
            (player2.vitality+(Number(bonus.vitality)||0))*50+
            player2.bonusHP+
            (Number(bonus.maxHP)||0),

        maxSP:
            50+
            (player2.energy+(Number(bonus.energy)||0))*15+
            player2.bonusSP+
            (Number(bonus.maxSP)||0),

        attack:
            10+
            effectiveAttackPoints*5+
            (Number(bonus.attack)||0),

        attackPoints:effectiveAttackPoints,

        defense:Math.max(
            0,
            Math.round(buffedDefense*(1-defenseDownPercent/100))
        ),

        magicAttack:effectiveIntelligence*5,
        accuracy:effectiveSpirit*2,
        resistance:calculateStatusResistancePercent(effectiveSpirit),
        antiCrit:calculateAntiCritPercent(effectiveSpirit),
        speed:effectiveAgility,

        evasion:Math.max(
            0,
            Math.round(rawEvasion*(1+(evasionBuffPercent+evasionPassivePercent)/100))
        ),

        vitality:effectiveVitality,
        energy:effectiveEnergy,
        intelligence:effectiveIntelligence,
        spirit:effectiveSpirit,
        agility:effectiveAgility
    };

}


/* =====================================================
   怪物
===================================================== */


/* V120_FINAL_SKILL_WIRING
   V120 SKILL UPDATE: 2026-08-24
   最新四元素技能規格已套用；舊 ID 優先保留以維持存檔相容。
   V120：風焰術／風哮電擊改為「降低目標造成的傷害」；
   落石術／滾石術／地牛猛襲的降防持續時間正式定為1回合。
*/
const skillDatabase = {

    /* =====================================================
       V120 正式技能規格
       - 數值、前置、SP、範圍依使用者 2026-08-24 最新表
       - 舊技能 ID 能沿用就沿用，避免破壞既有存檔/配裝
       - 新增技能才建立新 ID
    ===================================================== */

    /* ===== 火系：物理 ===== */
    flameSlash:{
        id:"flameSlash", tier:1, name:"火焰斬", element:"fire", category:"physical", targetType:"single",
        learnCost:2, maxLevel:5, baseDamage:17, damagePerLevel:10, spCost:8,
        description:"對單體造成17點基礎傷害，最高5級，每升1級傷害+10。"
    },
    fireCritical:{
        id:"fireCritical", tier:2, name:"會心一擊", element:"fire", category:"physical", targetType:"single",
        learnCost:10, maxLevel:5, baseDamage:39, damagePerLevel:13, spCost:15,
        description:"對單體造成39點基礎傷害，最高5級，每升1級傷害+13。", requires:["flameSlash"]
    },
    explosiveFlurry:{
        id:"explosiveFlurry", tier:3, name:"火爆亂擊", element:"fire", category:"physical", targetType:"tri",
        learnCost:20, maxLevel:5, baseDamage:35, damagePerLevel:15, spCost:22,
        description:"對同一橫排左、中、右最多3名目標各造成35點基礎傷害，最高5級，每升1級傷害+15。", requires:["fireCritical"]
    },
    dragonSlash:{
        id:"dragonSlash", tier:4, name:"霸龍裂天斬", element:"fire", category:"physical", targetType:"single",
        learnCost:45, maxLevel:5, baseDamage:145, damagePerLevel:25, spCost:55,
        description:"對單體造成145點基礎傷害，最高5級，每升1級傷害+25。", requires:["explosiveFlurry"]
    },

    /* ===== 火系：法術 ===== */
    fireRocket:{
        id:"fireRocket", tier:1, name:"火箭", element:"fire", category:"magic", targetType:"tri",
        learnCost:2, maxLevel:5, baseDamage:22, damagePerLevel:8, spCost:8,
        description:"對同一橫排左、中、右最多3名目標各造成22點基礎法術傷害，最高5級，每升1級傷害+8。"
    },
    blazeSpell:{
        id:"blazeSpell", tier:2, name:"烈火術", element:"fire", category:"magic", targetType:"single",
        learnCost:10, maxLevel:5, baseDamage:42, damagePerLevel:15, spCost:15,
        description:"對單體造成42點基礎法術傷害，最高5級，每升1級傷害+15。", requires:["fireRocket"]
    },
    flameTornado:{
        id:"flameTornado", tier:3, name:"烈焰龍捲", element:"fire", category:"magic", targetType:"row",
        learnCost:30, maxLevel:5, baseDamage:40, damagePerLevel:13, spCost:38,
        description:"對任一橫排目標各造成40點基礎法術傷害；30%機率燃燒2回合，每回合造成目標最大HP的5%/7%/12%/18%/25%傷害。",
        burnChance:30, burnDuration:2, burnPercentByLevel:[5,7,12,18,25], requires:["blazeSpell"]
    },
    phoenixCry:{
        id:"phoenixCry", tier:4, name:"火鳳天鳴", element:"fire", category:"magic", targetType:"all",
        learnCost:45, maxLevel:5, baseDamage:53, damagePerLevel:15, spCost:62,
        description:"對敵方全體各造成53點基礎法術傷害；50%機率燃燒2回合，每回合造成目標最大HP的12%/18%/25%/30%/35%傷害。",
        burnChance:50, burnDuration:2, burnPercentByLevel:[12,18,25,30,35], requires:["flameTornado"]
    },

    /* ===== 火系：增益 ===== */
    rage:{
        id:"rage", name:"怒火", element:"fire", category:"buff", targetType:"allyAll",
        learnCost:25, maxLevel:5, spCost:50, duration:2,
        description:"提高我方最多3名存活角色的爆擊率與爆擊傷害，持續2回合；提升幅度依等級為10%/20%/30%/40%/50%。",
        critBonusByLevel:[10,20,30,40,50], requires:["explosiveFlurry","flameTornado"]
    },

    /* ===== 火系：被動 ===== */
    fireEX:{
        id:"fireEX", name:"火元素EX", element:"fire", category:"passive", targetType:"none",
        learnCost:25, maxLevel:1,
        description:"永久提升火元素傷害10%、爆擊率5%、爆擊傷害5%。",
        damageBonusPercent:10, critChanceBonusPercent:5, critDamageBonusPercent:5
    },

    /* ===== 水系：物理 ===== */
    waterKnife:{
        id:"waterKnife", tier:1, name:"水刀斬", element:"water", category:"physical", targetType:"single",
        learnCost:2, maxLevel:5, baseDamage:13, damagePerLevel:3, spCost:6,
        description:"對單體造成13點基礎傷害；吸取傷害的1%/1%/1%/2%/3%，等量恢復自身HP與SP。",
        lifestealPercentByLevel:[1,1,1,2,3]
    },
    frostPunch:{
        id:"frostPunch", tier:2, name:"冰霜拳", element:"water", category:"physical", targetType:"single",
        learnCost:10, maxLevel:5, baseDamage:30, damagePerLevel:5, spCost:17,
        description:"對單體造成30點基礎傷害；吸取傷害的1%/1%/1%/2%/3%，等量恢復自身HP與SP。",
        lifestealPercentByLevel:[1,1,1,2,3], requires:["waterKnife"]
    },
    iceSpin:{
        id:"iceSpin", tier:3, name:"冰旋一閃", element:"water", category:"physical", targetType:"tri",
        learnCost:20, maxLevel:5, baseDamage:25, damagePerLevel:7, spCost:20,
        description:"對同一橫排左、中、右最多3名目標各造成25點基礎傷害；吸取傷害的1%，等量恢復自身HP與SP。",
        lifestealPercentByLevel:[1,1,1,1,1], requires:["frostPunch"]
    },
    frostCrush:{
        id:"frostCrush", tier:4, name:"冰封重擊", element:"water", category:"physical", targetType:"single",
        learnCost:30, maxLevel:5, baseDamage:100, damagePerLevel:15, spCost:50,
        description:"對單體造成100點基礎傷害；45%機率冰封1回合；吸取傷害的1%/1%/1%/2%/3%，等量恢復自身HP與SP。",
        freezeChance:45, freezeDuration:1, lifestealPercentByLevel:[1,1,1,2,3], requires:["iceSpin"]
    },

    /* ===== 水系：法術 ===== */
    waterBall:{
        id:"waterBall", tier:1, name:"水球術", element:"water", category:"magic", targetType:"tri",
        learnCost:2, maxLevel:5, baseDamage:17, damagePerLevel:3, spCost:8,
        description:"對同一橫排左、中、右最多3名目標各造成17點基礎法術傷害；吸取傷害的1%/1%/1%/2%/3%，等量恢復自身HP與SP。",
        lifestealPercentByLevel:[1,1,1,2,3]
    },
    floodBeast:{
        id:"floodBeast", tier:2, name:"洪水猛獸", element:"water", category:"magic", targetType:"single",
        learnCost:15, maxLevel:5, baseDamage:35, damagePerLevel:8, spCost:15,
        description:"對單體造成35點基礎法術傷害；吸取傷害的1%，等量恢復自身HP與SP。",
        lifestealPercentByLevel:[1,1,1,1,1], requires:["waterBall"]
    },
    iceArrowRain:{
        id:"iceArrowRain", tier:3, name:"冰霜箭雨", element:"water", category:"magic", targetType:"all",
        learnCost:20, maxLevel:5, baseDamage:30, damagePerLevel:12, spCost:50,
        description:"對敵方全體各造成30點基礎法術傷害；吸取傷害的1%，等量恢復自身HP與SP。",
        lifestealPercentByLevel:[1,1,1,1,1], requires:["floodBeast"]
    },
    freeze:{
        id:"freeze", tier:4, name:"冰封", element:"water", category:"magic", targetType:"single",
        learnCost:25, maxLevel:1, spCost:22,
        description:"65%機率冰封單一目標，使其無法行動4回合；純控場技能，不造成傷害。",
        freezeChance:65, freezeDuration:4, requires:["iceArrowRain"]
    },

    /* ===== 水系：增益/回復 ===== */
    healSpell:{
        id:"healSpell", name:"治療術", element:"water", category:"heal", targetType:"ally",
        learnCost:20, maxLevel:5, baseHeal:40, healPerLevel:5, baseHealSP:15, healSPPerLevel:5, spCost:30,
        description:"擇一友方目標，恢復HP與SP。HP基礎40、SP基礎15，兩者每升1級基礎恢復量+5；另加HP智力×1.25、SP智力×0.5；施放者本人不回復SP。",
        requires:["iceArrowRain","iceSpin"]
    },
    revive:{
        id:"revive", name:"復活術", element:"water", category:"revive", targetType:"deadAlly",
        learnCost:20, maxLevel:5, spCost:45,
        description:"擇一友方死亡目標原地復活，依等級恢復20%/40%/60%/80%/100%最大HP。",
        reviveHealPercentByLevel:[20,40,60,80,100], requires:["healSpell"]
    },

    /* ===== 水系：被動 ===== */
    waterEX:{
        id:"waterEX", name:"水元素EX", element:"water", category:"passive", targetType:"none",
        learnCost:25, maxLevel:1,
        description:"永久提升水元素傷害5%、回復系技能回復量5%、異常狀態抗性+10%。",
        damageBonusPercent:5, healBonusPercent:5, statusResistBonus:10
    },

    /* ===== 風系：物理 ===== */
    stormFist:{
        id:"stormFist", tier:1, name:"暴風拳", element:"wind", category:"physical", targetType:"single",
        learnCost:2, maxLevel:5, baseDamage:14, damagePerLevel:2, spCost:7,
        description:"對單體造成14點基礎傷害；50%機率降低敏捷1回合，降低50%/60%/70%/80%/90%。",
        agilityDownChance:50, agilityDownByLevel:[50,60,70,80,90], agilityDownDuration:1
    },
    stormFlurry:{
        id:"stormFlurry", tier:2, name:"暴風亂擊", element:"wind", category:"physical", targetType:"tri",
        learnCost:10, maxLevel:5, baseDamage:28, damagePerLevel:7, spCost:20,
        description:"對同一橫排左、中、右最多3名目標各造成28點基礎傷害；50%機率降低所有能力值2回合，降低10%/12%/15%/20%/30%。",
        statDownChance:50, statDownByLevel:[10,12,15,20,30], statDownDuration:2, requires:["stormFist"]
    },
    windCrossSlash:{
        id:"windCrossSlash", tier:3, name:"風旋十字斬", element:"wind", category:"physical", targetType:"single",
        learnCost:15, maxLevel:5, baseDamage:90, damagePerLevel:12, spCost:39,
        description:"對單體造成90點基礎傷害；65%機率降低所有能力值2回合，降低10%/12%/15%/20%/30%。",
        statDownChance:65, statDownByLevel:[10,12,15,20,30], statDownDuration:2, requires:["stormFlurry"]
    },
    dizzyFist:{
        id:"dizzyFist", tier:4, name:"暈眩猛擊", element:"wind", category:"physical", targetType:"single",
        learnCost:30, maxLevel:5, baseDamage:120, damagePerLevel:15, spCost:55,
        description:"對單體造成120點基礎傷害；65%機率使目標暈眩2回合，最終命中率額外降低10%/20%/30%/40%/50%。",
        stunChance:65, missBonusByLevel:[10,20,30,40,50], stunDuration:2, requires:["stormFlurry"]
    },

    /* ===== 風系：法術 ===== */
    windSpell:{
        id:"windSpell", tier:1, name:"狂風術", element:"wind", category:"magic", targetType:"tri",
        learnCost:2, maxLevel:5, baseDamage:18, damagePerLevel:2, spCost:9,
        description:"對同一橫排左、中、右最多3名目標各造成18點基礎法術傷害；50%機率降低敏捷1回合，降低10%/20%/30%/40%/50%。",
        agilityDownChance:50, agilityDownByLevel:[10,20,30,40,50], agilityDownDuration:1
    },
    stormCircle:{
        id:"stormCircle", tier:2, name:"風焰術", element:"wind", category:"magic", targetType:"row",
        learnCost:10, maxLevel:5, baseDamage:38, damagePerLevel:9, spCost:18,
        description:"對任一橫排各造成38點基礎法術傷害；55%機率降低目標造成的傷害1回合，降低15%/18%/21%/25%/30%。",
        damageDownChance:55, damageDownByLevel:[15,18,21,25,30], damageDownDuration:1, requires:["windSpell"]
    },
    windHowlLightning:{
        id:"windHowlLightning", tier:3, name:"風哮電擊", element:"wind", category:"magic", targetType:"single",
        learnCost:15, maxLevel:5, baseDamage:95, damagePerLevel:12, spCost:39,
        description:"對單體造成95點基礎法術傷害；65%機率降低目標造成的傷害1回合，降低15%/20%/25%/30%/35%。",
        damageDownChance:65, damageDownByLevel:[15,20,25,30,35], damageDownDuration:1, requires:["stormCircle"]
    },
    stormRain:{
        id:"stormRain", tier:4, name:"風起雲湧", element:"wind", category:"magic", targetType:"all",
        learnCost:30, maxLevel:5, baseDamage:48, damagePerLevel:14, spCost:55,
        description:"對敵方全體各造成48點基礎法術傷害；35%機率暈眩1回合，使目標MISS率提高30%/45%/50%/55%/65%。",
        stunChance:35, missBonusByLevel:[30,45,50,55,65], stunDuration:1, requires:["windHowlLightning"]
    },

    /* ===== 風系：增益 ===== */
    dodgeSkill:{
        id:"dodgeSkill", name:"閃躲術", element:"wind", category:"buff", targetType:"allyAll",
        learnCost:10, maxLevel:1, spCost:20, duration:2,
        description:"使我方全體閃躲率提升30%，持續2回合。", evasionBonusPercent:30,
        requires:["windCrossSlash","windHowlLightning"]
    },
    stealthSkill:{
        id:"stealthSkill", name:"隱身術", element:"wind", category:"buff", targetType:"ally",
        learnCost:15, maxLevel:1, spCost:25, duration:2,
        description:"使我方單一目標隱身2回合；無法被單體技能選中，但仍會受到範圍技能波及。", requires:["dodgeSkill"]
    },
    dinghaishenzhen:{
        id:"dinghaishenzhen", name:"氣定神閒", element:"wind", category:"buff", targetType:"allyAll",
        learnCost:20, maxLevel:1, spCost:55, duration:3,
        description:"使我方全體異常狀態抗性提升35%，持續3回合。", statusResistBonus:35,
        requires:["stealthSkill"]
    },

    /* ===== 風系：被動 ===== */
    windEX:{
        id:"windEX", name:"風元素EX", element:"wind", category:"passive", targetType:"none",
        learnCost:25, maxLevel:1,
        description:"永久提升風元素角色的閃躲率15%。", evasionBonusPercent:15
    },

    /* ===== 土系：物理 ===== */
    stoneSlash:{
        id:"stoneSlash", tier:1, name:"土石斬", element:"earth", category:"physical", targetType:"single",
        learnCost:2, maxLevel:5, baseDamage:14, damagePerLevel:2, spCost:7,
        description:"對單體造成14點基礎傷害；65%機率降低防禦1回合，降低10%/20%/30%/40%/50%。",
        defenseDownChance:65, defenseDownByLevel:[10,20,30,40,50], defenseDownDuration:1
    },
    petrifyFist:{
        id:"petrifyFist", tier:2, name:"石盾拳", element:"earth", category:"physical", targetType:"tri",
        learnCost:10, maxLevel:5, baseDamage:28, damagePerLevel:7, spCost:26,
        description:"對同一橫排左、中、右最多3名目標各造成28點基礎傷害；為我方全體增加100/125/150/175/200點護盾，持續2回合。",
        allyShieldByLevel:[100,125,150,175,200], shieldDuration:2, requires:["stoneSlash"]
    },
    stoneBreakSky:{
        id:"stoneBreakSky", tier:3, name:"石破天驚", element:"earth", category:"physical", targetType:"single",
        learnCost:15, maxLevel:5, baseDamage:55, damagePerLevel:7, spCost:42,
        description:"對單體造成55點基礎傷害；為我方全體增加100/125/150/175/200點護盾，持續2回合。",
        allyShieldByLevel:[100,125,150,175,200], shieldDuration:2, requires:["petrifyFist"]
    },
    earthquakeCrush:{
        id:"earthquakeCrush", tier:4, name:"地裂重拳", element:"earth", category:"physical", targetType:"tri",
        learnCost:30, maxLevel:5, baseDamage:48, damagePerLevel:14, spCost:55,
        description:"對同一橫排左、中、右最多3名目標各造成48點基礎傷害；為自身增加100/150/200/250/300點護盾，持續2回合。",
        selfShieldByLevel:[100,150,200,250,300], shieldDuration:2, requires:["stoneBreakSky"]
    },

    /* ===== 土系：法術 ===== */
    stoneThrow:{
        id:"stoneThrow", tier:1, name:"落石術", element:"earth", category:"magic", targetType:"tri",
        learnCost:2, maxLevel:5, baseDamage:14, damagePerLevel:2, spCost:7,
        description:"對同一橫排左、中、右最多3名目標各造成14點基礎法術傷害；65%機率降低防禦1回合，降低10%/20%/30%/40%/50%。",
        defenseDownChance:65, defenseDownByLevel:[10,20,30,40,50], defenseDownDuration:1
    },
    sandWind:{
        id:"sandWind", tier:2, name:"滾石術", element:"earth", category:"magic", targetType:"row",
        learnCost:10, maxLevel:5, baseDamage:17, damagePerLevel:5, spCost:19,
        description:"對任一橫排各造成17點基礎法術傷害；65%機率降低防禦1回合，降低10%/20%/30%/40%/50%。",
        defenseDownChance:65, defenseDownByLevel:[10,20,30,40,50], defenseDownDuration:1, requires:["stoneThrow"]
    },
    flyingSandStrike:{
        id:"flyingSandStrike", tier:3, name:"飛沙瞬擊", element:"earth", category:"magic", targetType:"all",
        learnCost:15, maxLevel:5, baseDamage:20, damagePerLevel:8, spCost:26,
        description:"對敵方全體各造成20點基礎法術傷害；依等級25%/35%/45%/55%/65%機率石化目標2回合，使其無法行動。",
        petrifyChanceByLevel:[25,35,45,55,65], petrifyDuration:2, requires:["sandWind"]
    },
    dustStorm:{
        id:"dustStorm", tier:4, name:"地牛猛襲", element:"earth", category:"magic", targetType:"all",
        learnCost:30, maxLevel:5, baseDamage:48, damagePerLevel:14, spCost:55,
        description:"對敵方全體各造成48點基礎法術傷害；60%機率降低防禦1回合，降低10%/15%/20%/25%/30%。",
        defenseDownChance:60, defenseDownByLevel:[10,15,20,25,30], defenseDownDuration:1, requires:["flyingSandStrike"]
    },

    /* ===== 土系：增益 ===== */
    earthShield:{
        id:"earthShield", name:"萬象土盾", element:"earth", category:"buff", targetType:"ally",
        learnCost:10, maxLevel:1, spCost:32, duration:3,
        description:"使我方單一目標獲得50%反傷土盾，持續3回合。", reflectPercent:50,
        requires:["stoneBreakSky","flyingSandStrike"]
    },
    rockWall:{
        id:"rockWall", name:"岩石壁壘", element:"earth", category:"buff", targetType:"allyAll",
        learnCost:15, maxLevel:1, spCost:45, duration:3,
        description:"使我方全體防禦力提升30%，持續3回合。", defenseBonusPercent:30,
        requires:["barrier"]
    },
    barrier:{
        id:"barrier", name:"結界", element:"earth", category:"buff", targetType:"ally",
        learnCost:20, maxLevel:1, spCost:28, duration:4,
        description:"使我方單一目標獲得完全防護罩，可抵擋所有傷害，持續4回合。", requires:["earthShield"]
    },

    /* ===== 土系：被動 ===== */
    earthEX:{
        id:"earthEX", name:"土元素EX", element:"earth", category:"passive", targetType:"none",
        learnCost:25, maxLevel:1,
        description:"永久提升土元素角色的防禦力15%。", defenseBonusPercent:15
    }
};

/* =====================================================
   V126 — MONSTER BOOTSTRAP CONSTANT ORDER
   Monster arrays are constructed immediately below. These four confirmed
   constants must be initialized before makeZoneMonster() calculates status
   resistance and anti-crit values. Values and formulas are unchanged.
===================================================== */
const STATUS_RESIST_PER_SPIRIT_POINT = 0.3;
const ANTI_CRIT_PER_SPIRIT_POINT = 0.1;
const ANTI_CRIT_MAX_PERCENT = 25;
const CRIT_CHANCE_MIN_AFTER_ANTI_CRIT = 5;

const MAX_TRAINING_MONSTERS = 6;


const forestMonsters = [

    makeZoneMonster("哥布林",3,"fire"),
    makeZoneMonster("史萊姆",2,"water"),
    makeZoneMonster("哥布林",3,"fire"),
    makeZoneMonster("史萊姆",2,"water"),
    makeZoneMonster("哥布林",3,"fire"),
    makeZoneMonster("史萊姆",2,"water")

];


/*
   ★ 荒漠地帶（第二區）怪物資料。
   數值明顯比新手森林硬，
   主要是為了讓玩家能實際測試
   燃燒這類「持續傷害」效果——
   新手森林的怪太脆，通常一兩下就死了，
   根本撐不到燃燒跳完2回合。
*/

const desertMonsters = [

    makeZoneMonster("沙漠豺狼",16,"fire"),
    makeZoneMonster("沙蠍",15,"water"),
    makeZoneMonster("沙漠豺狼",16,"fire"),
    makeZoneMonster("沙蠍",15,"water"),
    makeZoneMonster("沙漠豺狼",16,"fire"),
    makeZoneMonster("沙蠍",15,"water")

];


/*
   ★ 修正（依照使用者要求）：
   冰霜山脈（第三區）怪物資料，Lv.21~30。

   1. 技能改成引用skillDatabase裡「真的存在」
      的技能ID，不再自己亂取名字——玩家自己
      也會用到火焰斬、水刀斬這些技能，
      怪物用同一招，玩家一看就懂，
      不會被兩套不同名字的技能搞混。
   2. skillIds改成陣列（就算目前只放1個），
      之後高等級區域要放2、3個技能時，
      直接往陣列裡加就好，不用改資料結構。
   3. 新增skillChance（技能釋放機率），
      每個區域的機率不一樣，直接寫在
      怪物資料裡，讀取的地方不用另外判斷
      現在是哪個區域。
*/

const iceMountainMonsters = [

    makeZoneMonster("熾焰狼",22,"fire"),
    makeZoneMonster("寒冰魔",23,"water"),
    makeZoneMonster("熾焰狼",22,"fire"),
    makeZoneMonster("寒冰魔",23,"water"),
    makeZoneMonster("熾焰狼王",27,"fire"),
    makeZoneMonster("寒冰魔王",28,"water")

];


/*
   ★ 新增（依照使用者要求）：
   第四～八區怪物資料，Lv.31~80，
   每區技能數量、技能釋放機率都不一樣：

   31~40：1個技能，55%機率
   41~50：2個技能，60%機率
   51~60：2個技能，65%機率
   61~70：3個技能，65%機率
   71~80：3個技能，70%機率

   技能池統一從skillDatabase裡挑選
   火/水系的傷害類技能，等級越高的區域
   技能池裡的招式也越多樣、越強。

   ★ 修正（依照使用者要求，「野怪異常
   狀態直接做，我給你分級」）：
   這些手動排的技能池陣列已經被
   getMonsterSkillPoolForLevel()這個
   統一規則取代（見makeZoneMonster()
   附近），不會再用到，整組拿掉。
*/


/*
   ★ 新增（依照使用者要求，怪物六圍系統，
   完全比照玩家的能力點分配/換算公式，
   不再是手動填死的HP/SP/攻擊/防禦數字）：

   總能力點 = 10 + 等級×5
   敏捷點數 = round(等級÷3)，從總能力點裡扣除
   可分配點數 = 總能力點 − 敏捷點數
   能量點數 = round(可分配點數 × 20%)，固定
   體質最低點數 = round(可分配點數 × 40%)，保底
   剩餘點數 = 可分配點數 − 能量點數 − 體質最低點數
     → 隨機分配給「體質(額外加碼)/攻擊/智力/精神」
       四項，體質最終一定 ≥ 40%（保底 + 隨機加碼），
       其餘三項純隨機、每隻怪物都不一樣。

   換算成實際數值時，直接套用跟玩家
   getBaseStats()完全相同的公式：
   maxHP    = 100 + 體質×50
   maxSP    = 50  + 能量×15
   攻擊力    = 10  + 攻擊×5
   防禦     = 10  + 體質×15
   法術攻擊  = 智力×5
   命中 = 精神×2
   異常抗性 = 精神×0.3（百分點）
   閃避     = 敏捷×2
   速度(行動順序用) = 敏捷（原始點數，不額外乘）
*/

/*
   ★ 修正（依照使用者要求，「同一區同一個
   怪物名稱，等級就要一樣，能力值也都要
   一樣」）：
   這個函式原本用Math.random()決定攻擊/
   能量/智力/精神四項怎麼分配，代表就算
   名稱、等級完全相同的怪物（例如同一區
   放了三隻「哥布林 Lv.3」），每一隻實際
   算出來的攻擊力/魔攻/命中/閃避還是會
   各自不同——不是等級沒對齊，是「等級
   對齊了，但點數分配是隨機骰的」，一樣
   會讓玩家覺得「同名同等級的怪，數值
   卻不一樣」不合理。

   改成固定「平均分配」（四項平分，分不
   完的餘數依固定順序，不是隨機順序，
   補給前面幾項），這樣同一個等級不管
   算幾次、算幾隻，結果永遠一模一樣，
   跟體質那項「固定10%、不再參與隨機」
   是同一個精神，只是這裡擴大到全部
   四項都固定，不留任何隨機成分。

   函式名稱保留沒改（怕漏改到其他呼叫
   的地方），但函式本體已經不再隨機。
*/

function distributeRandomPoints(
    totalPoints,
    categoryCount
){

    const base=
        Math.floor(
            totalPoints/
            categoryCount
        );


    const shares=
        new Array(categoryCount)
        .fill(base);


    let remainder=
        totalPoints-
        base*categoryCount;


    let guardIndex=
        0;

    while(remainder>0){

        shares[
            guardIndex%
            categoryCount
        ]++;

        remainder--;

        guardIndex++;

    }


    return shares;

}


function generateMonsterAttributePoints(
    level
){

    /*
       ★ 修正（依照使用者要求，配點規則
       第二次調整）：
       體質改成「固定10%」，不再是「保底
       40%+隨機加碼」——體質不會再從隨機池
       裡多拿到額外點數，就是單純的10%，
       其餘90%（原本能量固定20%的規則也
       取消了）全部丟進隨機池，由「攻擊/
       能量/智力/精神」四項均等競爭。
    */

    const totalPoints=
        10+level*2;


    const agilityPoints=
        Math.round(
            level/3
        );


    const allocatable=
        Math.max(
            0,
            totalPoints-
            agilityPoints
        );


    const vitalityPoints=
        Math.round(
            allocatable*0.1
        );


    const randomPoolPoints=
        Math.max(
            0,
            allocatable-
            vitalityPoints
        );


    /*
       隨機分配的四項順序固定：
       [0]攻擊 [1]能量 [2]智力 [3]精神
       （體質已經固定10%，不再參與這裡的
       隨機競爭）
    */

    const randomShares=
        distributeRandomPoints(
            randomPoolPoints,
            4
        );


    return {

        vitality:
            vitalityPoints,

        attack:
            randomShares[0],

        energy:
            randomShares[1],

        intelligence:
            randomShares[2],

        spirit:
            randomShares[3],

        agility:
            agilityPoints

    };

}


/*
   ★ 新增（依照使用者要求，「野怪異常狀態
   直接做，我給你分級」）：
   野怪技能分級規則，統一由等級決定野怪
   「拿得到哪些技能」跟「放技能的機率」，
   不用像以前那樣每個區域手動排技能ID
   陣列、手動抓機率數字，只要給對element+
   level，其他自動算好：

   Lv.1~10　　只會普通攻擊，不會放技能
   Lv.11~40　可以放到「第1級」技能，35%機率
   Lv.41~70　可以放到「第2級」技能，45%機率
   Lv.71~100　可以放到「第3級」技能，55%機率

   「第N級」是累加的（不是只給那一級，是
   從第1級到第N級全部都可能放），跟技能
   本身在物理/法術鏈上第幾招對應（見
   skillDatabase裡每個攻擊技能新增的tier
   欄位，1=入門、2=第二招、3=第三招、
   4=最強招——野怪最高只到3級，4級的
   終極技能不會出現在野怪身上）。
*/

function getMonsterSkillTierAndChance(level){

    if(level<=10){

        return {
            maxTier:0,
            chance:0
        };

    }


    if(level<=40){

        return {
            maxTier:1,
            chance:0.35
        };

    }


    if(level<=70){

        return {
            maxTier:2,
            chance:0.45
        };

    }


    return {
        maxTier:3,
        chance:0.55
    };

}


function getMonsterSkillPoolForLevel(
    element,
    level
){

    const {maxTier}=
        getMonsterSkillTierAndChance(
            level
        );


    if(maxTier<=0){
        return [];
    }


    return Object.keys(skillDatabase)
        .filter(skillId=>{

            const skill=
                skillDatabase[skillId];


            return (
                skill.element===element&&
                (
                    skill.category===
                    "physical"||
                    skill.category===
                    "magic"
                )&&
                skill.tier&&
                skill.tier<=maxTier
            );

        });

}


function makeZoneMonster(
    name,
    level,
    element,
    rank
){

    const points=
        generateMonsterAttributePoints(
            level
        );


    const maxHP=
        100+
        points.vitality*50;


    const maxSP=
        50+
        points.energy*15;


    /*
       ★ 修正：skillIds／skillChance不再
       由呼叫的地方手動傳入，改成呼叫
       getMonsterSkillPoolForLevel()／
       getMonsterSkillTierAndChance()
       自動依level+element算好，保證同一個
       等級的怪物，不管在哪個區域、哪次
       呼叫，拿到的技能池／施放機率永遠
       一致，不會有些區域手動漏改、數字
       對不上分級規則的情況。
    */

    return {

        name:name,
        level:level,

        maxHP:maxHP,
        hp:maxHP,

        maxSP:maxSP,
        sp:maxSP,

        /*
           ★ 六圍原始點數也一起存起來，
           方便之後查看/除錯，戰鬥實際
           讀取的是下面換算好的attack/
           defense/magicAttack/accuracy/
           resistance/evasion這些「最終數值」，
           不是這幾個原始點數。
        */

        vitalityPoints:
            points.vitality,

        attackPoints:
            points.attack,

        energyPoints:
            points.energy,

        intelligencePoints:
            points.intelligence,

        spiritPoints:
            points.spirit,

        agilityPoints:
            points.agility,


        attack:
            10+
            points.attack*5,

        defense:
            10+
            points.vitality*15,

        magicAttack:
            points.intelligence*5,

        accuracy:
            points.spirit*2,

        resistance:
            calculateStatusResistancePercent(points.spirit),

        antiCrit:
            calculateAntiCritPercent(points.spirit),

        evasion:
            points.agility*2,

        agility:
            points.agility,


        alive:true,
        element:element,

        /*
           ★ 新增（依照使用者要求，「以後
           精英怪跟BOSS的名稱不會有王或皇，
           我會直接跟妳說誰誰誰就是套用
           什麼怪」）：
           新增第4個參數rank，直接明確指定
           "elite"／"boss"，不用再靠名字
           結尾猜。getMonsterRank()原本就
           已經寫成「優先看monster.rank欄位，
           沒有才退回看名字結尾」，這裡接上
           之後，往後新怪物只要在
           makeZoneMonster()呼叫時多補一個
           參數就好，例如：
           makeZoneMonster("熔岩魔像",45,
           "fire","elite")
           不寫這個參數（維持3個參數）的話，
           照舊由getMonsterRank()退回看
           名字結尾判斷，舊資料完全不用改。
        */

        rank:
            rank||
            undefined,

        skillIds:
            getMonsterSkillPoolForLevel(
                element,
                level
            ),

        skillChance:
            getMonsterSkillTierAndChance(
                level
            ).chance

    };

}


const zone4Monsters = [

    makeZoneMonster("烈焰巨魔",32,"fire"),
    makeZoneMonster("深淵水靈",33,"water"),
    makeZoneMonster("烈焰巨魔",32,"fire"),
    makeZoneMonster("深淵水靈",33,"water"),
    makeZoneMonster("烈焰巨魔王",38,"fire"),
    makeZoneMonster("深淵水靈王",40,"water")

];


const zone5Monsters = [

    makeZoneMonster("熔岩巨獸",42,"fire"),
    makeZoneMonster("寒潮巨獸",43,"water"),
    makeZoneMonster("熔岩巨獸",42,"fire"),
    makeZoneMonster("寒潮巨獸",43,"water"),
    makeZoneMonster("熔岩巨獸王",48,"fire"),
    makeZoneMonster("寒潮巨獸王",50,"water")

];


const zone6Monsters = [

    makeZoneMonster("赤炎修羅",52,"fire"),
    makeZoneMonster("玄冰修羅",53,"water"),
    makeZoneMonster("赤炎修羅",52,"fire"),
    makeZoneMonster("玄冰修羅",53,"water"),
    makeZoneMonster("赤炎修羅王",58,"fire"),
    makeZoneMonster("玄冰修羅王",60,"water")

];


const zone7Monsters = [

    makeZoneMonster("業火魔君",62,"fire"),
    makeZoneMonster("絕冰魔君",63,"water"),
    makeZoneMonster("業火魔君",62,"fire"),
    makeZoneMonster("絕冰魔君",63,"water"),
    makeZoneMonster("業火魔君王",68,"fire"),
    makeZoneMonster("絕冰魔君王",70,"water")

];


const zone8Monsters = [

    makeZoneMonster("焚天龍獄",72,"fire"),
    makeZoneMonster("極寒龍獄",73,"water"),
    makeZoneMonster("焚天龍獄",72,"fire"),
    makeZoneMonster("極寒龍獄",73,"water"),
    makeZoneMonster("焚天龍獄皇",78,"fire"),
    makeZoneMonster("極寒龍獄皇",80,"water")

];


/*
   ★ 新增（依照使用者要求，新增81～90、
   91～100兩個地區）：
   延續zone4~8的等級/技能池分配規律
   （每區跨10級、王級比一般高6~8級、
   技能池沿用同一系列的第3池——目前
   FIRE_SKILL_POOL_3/WATER_SKILL_POOL_3
   是最高階的技能池，沒有更高一階的池子，
   這兩個新地區延續使用同一組，等之後
   有需要再擴充新的技能池）。
*/

const zone9Monsters = [

    makeZoneMonster("虛空煉獄",82,"fire"),
    makeZoneMonster("永凍深淵",83,"water"),
    makeZoneMonster("虛空煉獄",82,"fire"),
    makeZoneMonster("永凍深淵",83,"water"),
    makeZoneMonster("虛空煉獄皇",88,"fire"),
    makeZoneMonster("永凍深淵皇",90,"water")

];


const zone10Monsters = [

    makeZoneMonster("終焉神魔",92,"fire"),
    makeZoneMonster("末世寒神",93,"water"),
    makeZoneMonster("終焉神魔",92,"fire"),
    makeZoneMonster("末世寒神",93,"water"),
    makeZoneMonster("終焉神魔皇",98,"fire"),
    makeZoneMonster("末世寒神皇",100,"water")

];



/*
   ★ 修正（依照使用者要求，「整個換掉，
   以後都套用」）：
   舊的「精英怪基準值 × 0.25」這套折扣
   機制，已經被上面全新的六圍能力點分配
   公式完全取代——makeZoneMonster()現在
   直接依照等級算出最終數值，不再需要
   額外疊加一層縮放係數，這裡整段拿掉。
*/


/*
   ★ 目前所在區域的怪物資料，
   進入不同練功區時會重新指向對應的陣列。
   其他所有函式（renderBattle、monsterTurn、
   respawnMonsters…）都是直接讀這個變數，
   不需要另外改，切換區域只要重新賦值就好。
*/

let monsters =
    forestMonsters;


let currentZone =
    "forest";


/* =====================================================
   技能
===================================================== */




/*
   ★ 新增（依照使用者要求，「把火元素技能
   icon放對的位置」）：
   10個火系技能的icon圖片（使用者上傳的
   AI生成插圖，已裁切成正方形並壓縮成
   base64內嵌），對應規則依照圖片內容
   跟技能名稱/效果配對：
   flameSlash（火焰斬，入門單體斬擊）
     → 火焰劍身+弧形火痕，最基本的
       「劍+火」畫面
   fireCritical（會心一擊，高傷害單體）
     → 劍插地、周圍爆發環狀紅色光波，
       代表爆擊瞬間的強烈衝擊感
   explosiveFlurry（火爆亂擊，三人亂擊）
     → 角色雙刀爆裂揮砍，對應「亂擊」
       的動態感
   dragonSlash（霸龍裂天斬，單體大傷害）
     → 龍頭+撕裂天際的光束斬，呼應
       技能名裡的「龍」與「裂天」
   fireRocket（火箭，三人法術傷害）
     → 弓+燃燒的箭，直接對應「箭」
       這個技能名
   blazeSpell（烈火術，單體法術）
     → 純粹的火焰漩渦法陣，代表
       施法產生的火系法術效果
   flameTornado（烈焰龍捲，整排+燃燒）
     → 火龍盤旋成龍捲風的形狀，
       對應技能名裡的「龍捲」
   phoenixCry（火鳳天鳴，全體+燃燒）
     → 火鳳凰展翅嘶鳴，直接對應
       技能名「火鳳」
   rage（怒火，爆擊率/傷害增益）
     → 咆哮的火焰惡魔臉，代表「怒火」
       中燒的憤怒感（依使用者回報，
       跟會心一擊原本配反了，這裡
       已經對調）
   fireEX（火元素EX，被動）
     → 圖片本身就寫著「EX」字樣，
       直接對應
*/

const elementSkillIconMap = {
    flameSlash:"assets/skills/fire-flame-slash.jpg",
    dragonSlash:"assets/skills/fire-dragon-slash.jpg",
    explosiveFlurry:"assets/skills/fire-explosive-flurry.jpg",
    rage:"assets/skills/fire-rage.jpg",
    blazeSpell:"assets/skills/fire-blaze-spell.jpg",
    fireCritical:"assets/skills/fire-critical.jpg",
    fireRocket:"assets/skills/fire-rocket.jpg",
    phoenixCry:"assets/skills/fire-phoenix-cry.jpg",
    flameTornado:"assets/skills/fire-flame-tornado.jpg",
    fireEX:"assets/skills/fire-ex.jpg",

    /*
       ★ 新增（依照使用者要求，「換水元素」）：
       10個水系技能的icon，配對依照圖片內容
       跟技能名稱/效果：
       waterKnife（水刀斬，入門單體）
         → 一道銳利的水/冰刃斜劈而過
       frostPunch（冰霜拳，單體物理）
         → 一記冰霜拳頭正面揮出
       iceSpin（冰旋一閃，三人物理）
         → 旋轉的冰系飛鏢/手裏劍造型，
           呼應技能名裡的「旋」
       frostCrush（冰封重擊，單體大傷害）
         → 冰製戰鎚重重砸下，對應
           技能名裡的「重擊」
       waterBall（水球術，三人法術）
         → 一顆漩渦狀水球，直接對應
           技能名「水球」
       floodBeast（洪水猛獸，單體法術）
         → 巨大的水系怪獸咆哮，直接對應
           技能名「猛獸」
       freeze（冰封，純控場無傷害）
         → 冰晶尖刺從單一地點爆發而出，
           呼應「冰封」困住目標的畫面
       revive（復活術，復活友方）
         → 愛心+十字+人形剪影，直接對應
           「復活」的重生意象
       healSpell（治療術，恢復HP/SP）
         → 雙手捧著綠金色光芒，代表
           治療的溫暖感覺
       waterEX（水元素EX，被動）
         → 圖片本身寫著「EX」字樣

       另外使用者這次上傳了11張圖，
       但水系只有10個技能，其中一張
       （成片冰箭從天而降的畫面）目前
       沒有對應的技能可以放，先沒有
       使用，如果之後水系新增技能
       （例如群體攻擊技）可以再用上。
    */

    waterKnife:"assets/skills/water-knife.jpg",
    waterEX:"assets/skills/water-ex.jpg",
    frostPunch:"assets/skills/water-frost-punch.jpg",
    frostCrush:"assets/skills/water-frost-crush.jpg",
    iceSpin:"assets/skills/water-ice-spin.jpg",
    healSpell:"assets/skills/water-heal.jpg",
    waterBall:"assets/skills/water-ball.jpg",
    freeze:"assets/skills/water-freeze.jpg",
    revive:"assets/skills/water-revive.jpg",
    floodBeast:"assets/skills/water-flood-beast.jpg",

    /*
       ★ 新增（依照使用者要求，「水元素
       11招」新增的冰霜箭雨技能）：
       iceArrowRain（冰霜箭雨，全體法術）
         → 成片冰箭從天而降，直接對應
           「箭雨」這個技能名，這張圖
           上次上傳水系icon時就有給，
           當時水系只有10招沒有位置放，
           這次剛好用上
    */

    iceArrowRain:"assets/skills/water-ice-arrow-rain.jpg"
};

/*
   ★ 新增：取得技能icon的CSS背景圖片字串，
   目前只有火系10個技能有圖，其他元素
   （水/風/土）還沒有icon，這裡統一做
   null保護，沒有對應圖片就回傳空字串，
   讓那格icon框保持原本的空白樣式，
   不會因為找不到圖而報錯。
*/

function getSkillIconBackgroundImage(skillId){

    const url=
        elementSkillIconMap[skillId];


    if(!url){
        return "";
    }


    return "url('"+url+"')";

}


/*
   ★ 新增（依照使用者要求，「前置技能要
   學得機制」，目前只套用在火/水兩系，
   風/土系skillDatabase還沒有requires
   欄位，之後要做再補）：

   每個技能可以有一個requires陣列，裡面
   放「需要哪些技能id」，規則統一是
   「OR」（任一）關係——陣列裡只要有
   任何一個技能等級>0，前置就算通過。
   單一前置直接寫成長度1的陣列即可
   （['flameSlash']這種），效果等同
   「一定要學這個」；沒有requires欄位
   或空陣列，代表沒有前置限制。

   之所以統一用OR、不特別支援AND，是因為
   使用者提供的技能表裡，所有多重前置
   的案例（例如「火爆亂擊或烈焰龍捲其一」）
   全部都是「二選一」，沒有「兩個都要」
   的案例，用一種格式就夠。
*/

function isSkillPrereqMet(skillLevels,skill){

    if(
        !skill ||
        !skill.requires ||
        skill.requires.length===0
    ){
        return true;
    }


    return skill.requires.some(
        reqId=>
            (skillLevels[reqId]||0)>0
    );

}


/*
   ★ 新增：把requires陣列轉成給玩家看的
   中文提示，例如「需先學習：會心一擊」
   或「需先學習：火爆亂擊或烈焰龍捲其一」，
   抓不到技能名稱時保底顯示id本身，
   避免整段消失讓玩家一頭霧水。
*/

function getSkillPrereqLabel(skill){

    if(
        !skill ||
        !skill.requires ||
        skill.requires.length===0
    ){
        return "";
    }


    const names=
        skill.requires.map(
            reqId=>
                (
                    skillDatabase[reqId]&&
                    skillDatabase[reqId].name
                )||
                reqId
        );


    return (
        "需先學習："+
        names.join("或")+
        (
            names.length>1
            ?
            "其一"
            :
            ""
        )
    );

}


const characterSkillLoadouts = {

    fire:{
        name:"火法師",
        /*
           ★ 修正（依照使用者要求）：
           之前這裡故意讓新角色預設先學會
           火焰斬1級，理由是「不想要技能欄
           空空的」。但使用者現在明確表示
           不希望創角時自動幫他選技能，
           要自己決定學什麼——改成完全空白，
           不再自動塞任何技能進去。
        */
        skillLevels:{},
        equippedSkills:[]
    },

    water:{
        name:"水戰士",
        skillLevels:{},
        equippedSkills:[]
    },

    wind:{
        name:"風弓手",
        skillLevels:{},
        equippedSkills:[]
    },

    earth:{
        name:"土騎士",
        skillLevels:{},
        equippedSkills:[]
    }

};


/* =====================================================
   角色
===================================================== */

const characters = [

    {
        id:"fire",
        name:"火法師"
    },

    {
        id:"water",
        name:"水戰士"
    },

    {
        id:"wind",
        name:"風弓手"
    }

];


let inventoryCharacterIndex = 0;


/* =====================================================
   背包
===================================================== */

const inventoryItems = [

    {
        id:"ironSword",
        name:"鐵劍",
        icon:"",
        type:"weapon",
        count:1,
        price:120,
        stats:{
            attack:10
        }
    },

    {
        id:"woodStaff",
        name:"木法杖",
        icon:"",
        type:"weapon",
        count:1,
        price:100,
        stats:{
            intelligence:12,
            attack:3
        }
    },

    {
        id:"leatherHelmet",
        name:"皮帽",
        icon:"",
        type:"helmet",
        count:1,
        price:80,
        stats:{
            vitality:1
        }
    },

    {
        id:"leatherArmor",
        name:"皮甲",
        icon:"",
        type:"armor",
        count:1,
        price:150,
        stats:{
            defense:10,
            maxHP:20
        }
    },

    {
        id:"leatherShoes",
        name:"皮鞋",
        icon:"",
        type:"shoes",
        count:1,
        price:90,
        stats:{
            agility:5
        }
    },

    {
        id:"powerRing",
        name:"力量戒指",
        icon:"",
        type:"accessory",
        count:1,
        price:200,
        stats:{
            attack:5
        }
    },

    {
        id:"hpPotion10",
        name:"回復10%HP藥水",
        icon:"",
        type:"potion",
        resource:"hp",
        recoveryPercent:10,
        count:3,
        price:20,
        stats:{}
    },

    {
        id:"spPotion10",
        name:"回復10%SP藥水",
        icon:"",
        type:"potion",
        resource:"sp",
        recoveryPercent:10,
        count:2,
        price:25,
        stats:{}
    }

];


const inventorySlots =
    new Array(102).fill(null);


function rebuildInventorySlots(){

    normalizeInventoryStacks();

    inventorySlots.fill(null);


    inventoryItems.forEach(
        (item,index)=>{

            if(index<102){

                inventorySlots[index] =
                    item;

            }

        }
    );

}


/* =====================================================
   戰鬥狀態
===================================================== */

let battleActive=false;

let battleToken=0;

let selectedMonster=null;

/*
   ★ 新增：這場戰鬥實際捲入的怪物「原始陣列索引」清單。
   隨機1~3隻，不再是每場都固定把整批怪都拖進來打。
   其他函式（渲染、目標選擇、回合、結算）
   都改成只認這個清單裡的怪物，
   不在清單內的怪物繼續留在地圖上，不會被打。
*/

let currentBattleMonsters=[];

let turn=1;

let timer=20;

let timerId=null;

let monsterMoveId=null;

let respawnId=null;

/*
   ★ 新增：目前輪到誰手動行動
   （0=第一角色、1=第二角色）。
   每次startTurn()重置回0，
   finishPlayerAction()結束一個角色的行動後
   往後推一格，直到活著的角色都行動過，
   才會進入怪物回合。
*/

let activeBattleCharacterIndex=0;

/*
   ★ 新增（真正抓到「宣告階段被重複處理」
   的根源之後補上的防護）：

   手機瀏覽器背景執行時，setTimeout不保證
   準時觸發，可能被系統延後、之後又跟其他
   計時器「一次補發」，導致beginCharacterTurn()
   被同一個activeBattleCharacterIndex值
   呼叫兩次——這不是程式邏輯寫錯，是計時器
   本身不可靠，光靠battleToken/token比對
   擋不住（同一場戰鬥、token沒變，只是
   同一個宣告步驟被觸發了兩次）。

   用這個Set記錄「這個大回合裡，哪些
   activeBattleCharacterIndex已經真正
   宣告過」，beginCharacterTurn()一開始
   如果發現當下這個索引已經在清單裡，
   代表是重複/延遲補發的呼叫，直接跳過、
   不做任何事，不會讓角色索引被多推進、
   不會讓自動判斷函式被重複呼叫。
   每次startTurn()開新的大回合時清空。
*/

let declaredCharacterIndexes=
    new Set();

/*
   ★ 新增（真正補上剩下那個漏洞）：
   declaredCharacterIndexes只擋得住
   「同一個角色被重複宣告」，沒擋到
   「宣告階段結束、要跳進結算階段」這個
   轉換點本身被重複觸發——beginCharacterTurn()
   在activeBattleCharacterIndex超出隊伍
   長度時會呼叫startResolutionPhase()，
   但這個轉換沒有被記錄進防重複清單，
   只要這次呼叫因為手機瀏覽器計時器延遲/
   補發被多觸發一次，就會把initiativeQueue、
   initiativeIndex、processedInitiativeIndexes
   全部重新蓋過去、砍掉重練，等於結算階段
   從頭重新開始一次，已經處理過的怪物/角色
   行動會被重複執行——這正是「同一隻怪物
   一個回合攻擊兩次」「連續跳兩個回合」
   的真正原因。

   用這個旗標記錄「這個大回合的結算階段
   是不是已經真的開始過了」，
   startResolutionPhase()一開始如果發現
   已經開始過，代表是重複/延遲補發的呼叫，
   直接跳過、不會重建佇列。
   每次startTurn()開新的大回合時重置為false。
*/

let resolutionPhaseStarted=
    false;

/*
   ★ 新增（真正補上最後一個漏洞）：
   跟resolutionPhaseStarted同樣的道理，
   processNextCombatant()裡「這個大回合
   結算完畢、要跳到下一個大回合」的分支
   （initiativeIndex>=initiativeQueue.length
   時turn++; startTurn(token)）完全沒有
   防重複保護——這個分支本身不屬於任何
   一個「已處理的initiativeIndex」，
   processedInitiativeIndexes那個Set
   擋不到它。只要這次呼叫因為手機瀏覽器
   計時器延遲/補發被多觸發一次，就會
   turn++兩次、startTurn()被呼叫兩次，
   畫面上會看到「第8回合，開始！
   第9回合，開始！」這種連續跳兩輪、
   中間完全沒有任何角色/怪物行動的情況。

   用這個旗標記錄「這個大回合是不是已經
   真的觸發過『跳到下一輪』」，重複呼叫
   直接擋下。每次startTurn()真正開始
   新的一輪時重置為false。
*/

let turnAdvancePending=
    false;

/*
   ★ 新增（重新設計回合制）：
   使用者明確指出：正確的回合制應該是
   「雙方先各自設定好這回合要做什麼，
   全部設定完，才依敏捷高低開始執行」，
   不是「誰快誰先做，其他人連選都還沒選」。

   battlePhase紀錄目前這個大回合走到哪個階段：
   "declare" = 宣告階段，玩家角色依序選好
   這回合要做什麼（普通攻擊/技能，含選目標），
   選完先「記住」，不會馬上出手。

   "resolve" = 結算階段，把所有已宣告的玩家行動
   跟怪物混在一起，依敏捷高低排序，
   一個一個真正執行、扣血。

   只有「普通攻擊」「傷害技能」這種會影響到怪物、
   跟怪物出手順序有意義關聯的行動需要進到宣告/結算
   兩階段；防禦、物品、增益、治療這類不牽涉
   跟怪物比快慢的行動，維持原本「選了就立刻生效」，
   不需要額外等待，這樣才不會讓防禦這種
   「馬上就要生效」的動作也被迫延遲。
*/

let battlePhase="declare";

let queuedPlayerActions={};

let mapCooldown=false;

/*
   ★ 自動巡怪防卡死：
   mapCooldown 只代表「暫時禁止開戰」，
   不應該直接等同於「停止自動巡怪」。
   另外保留 timeout handle，讓我們可以判斷
   cooldown 是否真的有一個解除排程。
*/
let mapCooldownTimeoutId=null;

let autoBattle=false;

let actionReady=false;

let pendingAction=null;

/*
   ★ 新增（修正設定面板切換角色會遺失未儲存變更的bug）：
   記錄設定面板目前顯示的是「哪個角色」的資料，
   每次切換角色之前，先把目前畫面上的值
   存回這個角色身上，再換顯示新角色的資料，
   這樣使用者可以自由切換A、B兩個角色調整，
   最後統一按一次確定就好，不用每換一個角色
   就要先按一次確定，不然切換那一刻
   還沒儲存的調整會直接消失。
*/

let autoSettingsCurrentCharacter=0;


const autoConfig = {

    enabled:false,

    skill:"normal",

    hp:50,

    sp:25,

    /*
       ★ 新增：沒藥水的話自動回主城。
       戰鬥結束、回到練功區地圖之後，
       如果偵測到HP/SP藥水都用完了，
       自動幫玩家導回主城，
       不用自己記得要回去補貨。
    */

    returnToCityWhenEmpty:false

};


/*
   ★ 新增：第二角色專屬的自動戰鬥設定。
   跟第一角色的autoConfig結構一樣，
   但完全獨立，因為第二角色是自動作戰的隊友，
   一定要有自己的技能/HP門檻/SP門檻設定，
   不能共用第一角色那組（技能都不一樣）。
*/

/*
   ★ 修正：
   之前第二角色永遠自動行動，沒有手動選項，
   所以這裡原本沒有enabled欄位。
   現在第二角色也能手動操作了，
   預設enabled:false（手動），
   跟第一角色的預設行為一致，
   玩家可以自己選要手動控制還是交給AI打。
*/

const autoConfig2 = {

    enabled:false,

    skill:"normal",

    hp:50,

    sp:25,

    returnToCityWhenEmpty:false

};


/* V111：HP／SP 自動補給門檻統一為 25／50／75／90／100%。
   舊存檔可能仍保存 20、30、40、60、70、80 等值；
   讀到舊值時取最接近的新門檻，避免下拉選單出現空白。 */
const AUTO_BATTLE_THRESHOLD_STEPS=[25,50,75,90,100];

function normalizeAutoBattleThreshold(value,fallback){

    const numeric=Number(value);

    if(!Number.isFinite(numeric)){
        return fallback;
    }

    return AUTO_BATTLE_THRESHOLD_STEPS.reduce(
        (best,current)=>
            Math.abs(current-numeric)<Math.abs(best-numeric)
            ? current
            : best,
        AUTO_BATTLE_THRESHOLD_STEPS[0]
    );
}


const pendingStats = {

    attack:0,

    vitality:0,

    energy:0,

    intelligence:0,

    spirit:0,

    agility:0

};


/*
   ★ 狀態頁角色切換（新增）。
   0=第一角色（player），1=第二角色（player2）。
   player2不存在時永遠停在0，
   切換按鈕會被擋掉。
*/

let statusCharacterIndex=0;


function getStatusCharacterObject(){

    return (
        statusCharacterIndex===1 &&
        player2
    )
    ?
    player2
    :
    player;

}


let currentSkillCharacter =
    "fire";


let selectedInventorySlot =
    null;


/* =====================================================
   DOM
===================================================== */

function $(id){
    return document.getElementById(id);
}


/* =====================================================
   ★ 按鈕波紋擴散效果（依照使用者要求）
===================================================== */

/*
   全域監聽整個文件的點擊/觸碰事件，只要
   點到的目標是<button>（或按鈕內部的
   子元素，例如按鈕裡的文字/圖示），就在
   觸碰座標的位置動態生成一個會擴散消失的
   小圓點，0.5秒後自動移除自己，不會留下
   任何殘留的DOM垃圾。

   用事件代理（監聽document、不是個別
   按鈕）的好處：現在95個按鈕、以後不管
   再新增幾個按鈕，完全不用另外寫一行
   程式碼，全部自動套用到，也不會因為
   之後又忘記加而漏掉。

   同時支援touchstart（手機觸控）和
   mousedown（滑鼠點擊，方便桌機瀏覽器
   測試），觸控裝置上兩個事件通常都會
   觸發，這裡用旗標避免同一次點擊
   重複生成兩個波紋。
*/

let lastRippleTime=
    0;


function spawnButtonRipple(
    button,
    clientX,
    clientY
){

    const now=
        Date.now();


    if(now-lastRippleTime<80){
        return;
    }


    lastRippleTime=
        now;


    const rect=
        button.getBoundingClientRect();


    const size=

        Math.max(
            rect.width,
            rect.height
        )*
        1.4;


    const ripple=
        document.createElement("span");

    ripple.className=
        "btn-ripple";

    ripple.style.width=
        size+"px";

    ripple.style.height=
        size+"px";

    ripple.style.left=
        (clientX-rect.left-size/2)+
        "px";

    ripple.style.top=
        (clientY-rect.top-size/2)+
        "px";


    button.appendChild(
        ripple
    );


    setTimeout(()=>{

        ripple.remove();

    },520);

}


function handleGlobalButtonPress(event){

    const button=

        event.target.closest(
            "button"
        );


    if(!button){
        return;
    }


    const point=

        event.touches &&
        event.touches[0]
        ?
        event.touches[0]
        :
        event;


    spawnButtonRipple(
        button,
        point.clientX,
        point.clientY
    );

}


document.addEventListener(
    "touchstart",
    handleGlobalButtonPress,
    {passive:true}
);

document.addEventListener(
    "mousedown",
    handleGlobalButtonPress
);


/* =====================================================
   ★ 自訂下拉選單（依照使用者要求，取代原生<select>）
===================================================== */

/*
   registry：記住每一個被接管的<select>，
   對應到它產生出來的那組假選單DOM
   （wrapper/label/list），
   關閉其他選單、同步畫面時都要用到。
*/

const customDropdownRegistry={};


/*
   ★ 核心技巧：用Object.defineProperty
   在這個<select>「這一個實體」上覆蓋掉
   value這個屬性，變成有自己的get/set。

   這樣不管程式碼在哪裡、用什麼方式寫
   select.value = "xxx"（現有幾十處
   讀寫這幾個select的程式碼完全不用
   改一行），這裡都攔得到，順便同步
   更新假選單的顯示文字/選中狀態——
   不用一個一個去找程式碼裡到底哪裡
   寫了.value=，那樣很容易漏掉、
   而且以後新增的程式碼也可能漏接。

   真正的<option selected>狀態也會
   一起同步更新，保留跟原生<select>
   完全一致的行為，只是外觀換掉。
*/

function makeSelectValueReactive(
    selectEl,
    onValueChanged
){

    let currentValue=
        selectEl.value;


    Object.defineProperty(
        selectEl,
        "value",
        {

            get(){
                return currentValue;
            },

            set(newValue){

                currentValue=
                    newValue;


                Array.from(
                    selectEl.options
                ).forEach(
                    opt=>{

                        opt.selected=
                            (
                                opt.value===
                                newValue
                            );

                    }
                );


                onValueChanged(
                    newValue
                );

            },

            configurable:true

        }

    );

}


/*
   把一個原生<select>（selectId）換成
   自訂假選單。原本的<select>還在DOM裡、
   繼續當作真正的資料來源（只是隱藏），
   change事件照樣會在選項改變時真的被
   觸發，所有現有的onchange監聽/
   .value讀取完全不用改。
*/

function initCustomDropdown(selectId){

    const selectEl=
        $(selectId);


    if(
        !selectEl ||
        customDropdownRegistry[selectId]
    ){
        return;
    }


    selectEl.style.display=
        "none";


    const wrapper=
        document.createElement("div");

    wrapper.className=
        "custom-dropdown";

    if(selectId.indexOf("autoSettings")===0){
        wrapper.classList.add("auto-premium-dropdown");
    }

    wrapper.id=
        selectId+"_customUI";


    const label=
        document.createElement("div");

    label.className=
        "custom-dropdown-label";


    const labelText=
        document.createElement("span");

    const arrow=
        document.createElement("span");

    arrow.className=
        "custom-dropdown-arrow";

    arrow.textContent=
        "▾";


    label.appendChild(
        labelText
    );

    label.appendChild(
        arrow
    );


    const list=
        document.createElement("div");

    list.className=
        "custom-dropdown-list";

    if(selectId.indexOf("autoSettings")===0){
        list.classList.add("auto-premium-dropdown-list");
    }


    wrapper.appendChild(
        label
    );

    wrapper.appendChild(
        list
    );


    selectEl.parentNode.insertBefore(
        wrapper,
        selectEl.nextSibling
    );


    customDropdownRegistry[selectId]={
        selectEl:selectEl,
        wrapper:wrapper,
        label:label,
        labelText:labelText,
        list:list
    };


    label.addEventListener(
        "click",
        event=>{

            event.stopPropagation();

            toggleCustomDropdown(
                selectId
            );

        }
    );


    /*
       選項本身的value有變（例如切換角色
       時，畫面上那顆select被程式碼改了
       選中值），這裡統一攔截同步，
       見上面makeSelectValueReactive()
       的說明。
    */

    makeSelectValueReactive(
        selectEl,
        ()=>{

            renderCustomDropdownOptions(
                selectId
            );

        }
    );


    renderCustomDropdownOptions(
        selectId
    );

}


/*
   依照目前<select>裡的<option>清單，
   重新畫一次假選單的清單內容跟按鈕上
   顯示的文字——初始化時呼叫一次，
   之後<select>的value被改變
   （不管是玩家點了假選單、還是程式碼
   直接賦值）都會重新呼叫這裡同步畫面。
*/

function renderCustomDropdownOptions(selectId){

    const entry=
        customDropdownRegistry[selectId];


    if(!entry){
        return;
    }


    const {
        selectEl,
        labelText,
        list
    }=entry;


    list.innerHTML=
        "";


    Array.from(
        selectEl.options
    ).forEach(
        opt=>{

            const item=
                document.createElement("div");

            item.className=
                "custom-dropdown-item";

            item.textContent=
                opt.textContent;


            const isSelected=

                opt.value===
                selectEl.value;


            if(isSelected){

                item.classList.add(
                    "selected"
                );

                labelText.textContent=
                    opt.textContent;

            }


            item.addEventListener(
                "click",
                event=>{

                    event.stopPropagation();


                    selectEl.value=
                        opt.value;


                    /*
                       手動觸發一次change事件，
                       跟原生<select>被使用者
                       選了新選項時的行為一致，
                       現有掛在這幾個select上的
                       onchange監聽（例如
                       switchAutoSettingsCharacter()）
                       才會被正常呼叫到。
                    */

                    selectEl.dispatchEvent(

                        new Event(
                            "change",
                            {bubbles:true}
                        )

                    );


                    closeCustomDropdown(
                        selectId
                    );

                }
            );


            list.appendChild(
                item
            );

        }
    );

}


function toggleCustomDropdown(selectId){

    const entry=
        customDropdownRegistry[selectId];


    if(!entry){
        return;
    }


    const isOpen=

        entry.wrapper.classList.contains(
            "open"
        );


    /*
       打開一個之前，先把其他所有已經
       打開的假選單關掉，同一時間畫面上
       只會有一個展開，不會疊在一起。
    */

    Object.keys(
        customDropdownRegistry
    ).forEach(
        id=>{

            closeCustomDropdown(
                id
            );

        }
    );


    if(!isOpen){

        entry.wrapper.classList.add(
            "open"
        );


        /*
           ★ 修正（依照使用者實測發現的問題）：
           自動戰鬥設定面板本身有
           overflow-y:auto（要塞六列內容、
           面板高度有限，本來就需要能捲動），
           這代表如果清單留在面板裡面用
           position:absolute展開，超出面板
           範圍的部分會直接被裁掉，看起來
           像選單「展不開」。

           跟之前搬動整個設定面板是同一招：
           展開的當下，把清單暫時搬到
           document.body，改用position:fixed
           配合getBoundingClientRect()量出
           按鈕的實際位置，貼著按鈕正下方
           顯示，不再受面板的overflow限制；
           關閉時搬回原本在DOM裡的位置，
           確保下次面板重新打開時，清單
           還是乖乖跟著對的按鈕，不會殘留
           在body底下到處亂飄。
        */

        moveDropdownListToBody(
            selectId
        );

    }

}


/*
   把清單元素從原本的位置（面板裡面）
   搬到document.body，並且用fixed定位
   貼齊label按鈕的實際畫面座標——
   這樣不管外層容器有沒有overflow:hidden/
   auto，都不會被裁切。
*/

function moveDropdownListToBody(selectId){

    const entry=
        customDropdownRegistry[selectId];


    if(!entry){
        return;
    }


    const {
        wrapper,
        label,
        list
    }=entry;


    if(!entry.originalNextSibling){

        entry.originalParent=
            list.parentNode;

        entry.originalNextSibling=
            list.nextSibling;

    }


    const labelRect=

        (label||wrapper)
        .getBoundingClientRect();


    document.body.appendChild(
        list
    );


    list.style.position=
        "fixed";

    list.style.top=
        (labelRect.bottom+4)+
        "px";

    list.style.left=
        labelRect.left+
        "px";

    list.style.width=
        labelRect.width+
        "px";

    list.style.right=
        "auto";

    /*
       ★ 修正（依照使用者回報，「自動戰鬥
       設定，按下去選單箭頭有反應，但就是
       沒有下拉清單可以選」）：
       真正原因找到了——這個清單被搬到
       document.body之後，z-index寫死
       5000，這在當初（.home-feature-modal
       還是3200的年代）足夠高、沒問題。
       但後來因為另一個bug（設定視窗被
       creationPage的z-index:5000蓋住），
       把.home-feature-modal本身拉高到
       6000，這個清單的5000反而變成比
       彈窗本身的深色遮罩（z-index:6000）
       還低——清單其實有正常展開、位置
       也算對，只是整個被彈窗自己的
       半透明黑色背景蓋在上面，畫面上
       完全看不到，跟「沒有清單可以選」
       的症狀一模一樣。

       這裡拉高到6100，蓋過目前彈窗系統
       用到的所有z-index（6000～6060）。
       ★ 提醒：這個清單是用JS量measured
       getBoundingClientRect()+position:
       fixed搬到body顯示的（見上面
       moveDropdownListToBody()），這整套
       手法本身在這個專案裡已經不只一次
       是bug的來源，之後如果又要調整彈窗
       疊層，記得回來檢查這裡的z-index
       有沒有跟著調整過。
    */

    list.style.zIndex=
        "6100";


    /*
       ★ 新增（依照使用者回報，「按下去
       還是沒反應」，這次真的挖到最底層
       原因了）：
       只搬位置、只修z-index都還不夠——
       清單原本靠CSS規則「.custom-dropdown.
       open .custom-dropdown-list」控制
       展開時的max-height/opacity，這條
       規則要求清單還「留在」.custom-dropdown
       裡面才會生效。清單被搬到
       document.body之後，不再是
       .custom-dropdown.open的子元素，
       這條規則直接失效，清單打回預設的
       max-height:0、opacity:0，等於
       完全收合——這才是真正的原因，
       z-index只是另一個疊加的問題，
       兩個一起修才會真的看到清單。

       這裡讓清單自己身上也帶一個"open"
       class（CSS那邊新增了對應的
       .custom-dropdown-list.open規則），
       不管清單current DOM位置在哪裡都能
       正確展開。
    */

    list.classList.add(
        "open"
    );

}


/*
   把清單搬回它原本在DOM裡的位置，
   清掉fixed定位相關的行內樣式，
   恢復成原本靠CSS class控制的樣子。
*/

function moveDropdownListBack(selectId){

    const entry=
        customDropdownRegistry[selectId];


    if(
        !entry ||
        !entry.originalParent
    ){
        return;
    }


    const {list}=
        entry;


    list.style.position=
        "";

    list.style.top=
        "";

    list.style.left=
        "";

    list.style.width=
        "";

    list.style.right=
        "";

    list.style.zIndex=
        "";


    if(
        entry.originalNextSibling &&
        entry.originalNextSibling.parentNode===
        entry.originalParent
    ){

        entry.originalParent.insertBefore(
            list,
            entry.originalNextSibling
        );

    }
    else{

        entry.originalParent.appendChild(
            list
        );

    }

}


function closeCustomDropdown(selectId){

    const entry=
        customDropdownRegistry[selectId];


    if(entry){

        entry.wrapper.classList.remove(
            "open"
        );


        /*
           ★ 新增：跟moveDropdownListToBody()
           裡加的list.classList.add("open")
           對應，關閉時要記得拿掉，不然清單
           被搬回原位之後still帶著"open"，
           下次還沒點開就已經是展開狀態，
           畫面會怪怪的。
        */

        entry.list.classList.remove(
            "open"
        );


        moveDropdownListBack(
            selectId
        );

    }

}


/*
   點畫面上任何假選單以外的地方，
   全部收合起來，跟原生<select>點
   外面會自動關閉是一樣的行為。
*/

document.addEventListener(
    "click",
    ()=>{

        Object.keys(
            customDropdownRegistry
        ).forEach(
            id=>{

                closeCustomDropdown(
                    id
                );

            }
        );

    }
);


/* =====================================================
   ★ 創角
===================================================== */

function selectElement(element){

    if(
        !elementDatabase[element]
    ){
        return;
    }


    selectedCreationElement =
        element;


    document
    .querySelectorAll(
        ".element-option"
    )
    .forEach(button=>{
        button.classList.remove(
            "selected"
        );
    });


    const button =
        $("element"+
            element
            .charAt(0)
            .toUpperCase()+
            element.slice(1)
        );


    if(button){

        button.classList.add(
            "selected"
        );

    }

}


function creationAdd(stat,amount){

    if(
        !Object.prototype.hasOwnProperty.call(
            creationStats,
            stat
        )
    ){
        return;
    }


    if(amount>0){

        if(
            creationPoints<=0
        ){
            return;
        }


        creationStats[stat]++;

        creationPoints--;

    }
    else{

        /*
           只能扣掉玩家自己剛剛分配的點。
        */

        if(
            creationStats[stat]<=0
        ){
            return;
        }


        creationStats[stat]--;

        creationPoints++;

    }


    updateCreationUI();

}


function updateCreationUI(){

    $("creationAttack")
        .textContent =
        creationStats.attack;


    $("creationVitality")
        .textContent =
        creationStats.vitality;


    $("creationEnergy")
        .textContent =
        creationStats.energy;


    $("creationIntelligence")
        .textContent =
        creationStats.intelligence;


    $("creationSpirit")
        .textContent =
        creationStats.spirit;


    $("creationAgility")
        .textContent =
        creationStats.agility;


    $("creationPoints")
        .textContent =
        creationPoints;

}


/*
   ★ 以下是第二角色創建用的對應函式，
   邏輯跟上面三個完全一樣，只是操作
   creationStats2/creationPoints2/
   selectedCreationElement2 這組獨立變數，
   不會影響第一名角色的創角資料。
*/

function selectElement2(element){

    if(
        !elementDatabase[element]
    ){
        return;
    }


    selectedCreationElement2 =
        element;


    document
    .querySelectorAll(
        "#secondCharacterModal .element-option"
    )
    .forEach(button=>{
        button.classList.remove(
            "selected"
        );
    });


    const button =
        $("element2"+
            element
            .charAt(0)
            .toUpperCase()+
            element.slice(1)
        );


    if(button){

        button.classList.add(
            "selected"
        );

    }

}


function creationAdd2(stat,amount){

    if(
        !Object.prototype.hasOwnProperty.call(
            creationStats2,
            stat
        )
    ){
        return;
    }


    if(amount>0){

        if(
            creationPoints2<=0
        ){
            return;
        }


        creationStats2[stat]++;

        creationPoints2--;

    }
    else{

        if(
            creationStats2[stat]<=0
        ){
            return;
        }


        creationStats2[stat]--;

        creationPoints2++;

    }


    updateCreationUI2();

}


function updateCreationUI2(){

    $("creation2Attack")
        .textContent =
        creationStats2.attack;


    $("creation2Vitality")
        .textContent =
        creationStats2.vitality;


    $("creation2Energy")
        .textContent =
        creationStats2.energy;


    $("creation2Intelligence")
        .textContent =
        creationStats2.intelligence;


    $("creation2Spirit")
        .textContent =
        creationStats2.spirit;


    $("creation2Agility")
        .textContent =
        creationStats2.agility;


    $("creation2Points")
        .textContent =
        creationPoints2;

}


function openSecondCharacterModal(){

    if(
        battleActive ||
        player2
    ){
        return;
    }


    /*
       每次打開都重置成初始狀態，
       避免上次沒創建完、取消掉的殘留數值
       影響下一次打開。
    */

    selectedCreationElement2=
        "fire";


    Object.keys(
        creationStats2
    )
    .forEach(stat=>{

        creationStats2[stat]=0;

    });


    creationPoints2=
        START_ATTRIBUTE_POINTS;


    $("creation2Id")
        .value=
        "";


    document
    .querySelectorAll(
        "#secondCharacterModal .element-option"
    )
    .forEach(button=>{
        button.classList.remove(
            "selected"
        );
    });


    const fireButton=
        $("element2Fire");


    if(fireButton){

        fireButton.classList.add(
            "selected"
        );

    }


    updateCreationUI2();


    $("secondCharacterModal")
        .classList
        .add("show");

}


function closeSecondCharacterModal(){

    $("secondCharacterModal")
        .classList
        .remove("show");

}


/*
   ★ 建立第二角色。

   跟createCharacter()邏輯對應，
   但存進player2而不是player，
   而且不會動到目前的遊戲畫面
   （不需要切換創角頁/遊戲頁，
   關掉modal就好，人還在主城）。
*/

function createSecondCharacter(){

    if(player2){
        return;
    }


    const id=
        $("creation2Id")
        .value
        .trim();


    if(!id){

        alert(
            "請先輸入角色 ID。"
        );

        return;

    }


    if(id.length<2){

        alert(
            "ID至少需要2個字元。"
        );

        return;

    }


    Object.keys(creationStats2)
    .forEach(stat=>{

        creationStats2[stat]=
            Math.max(
                0,
                Number(
                    creationStats2[stat]
                )||0
            );

    });


    player2={

        id:id,

        element:
            selectedCreationElement2,

        level:1,

        exp:0,

        expNext:100,

        attack:
            creationStats2.attack,

        vitality:
            creationStats2.vitality,

        energy:
            creationStats2.energy,

        intelligence:
            creationStats2.intelligence,

        spirit:
            creationStats2.spirit,

        agility:
            creationStats2.agility,

        bonusHP:0,

        bonusSP:0,

        attributePoints:
            creationPoints2,

        skillPoints:0,

        hp:100,

        sp:50,

        activeBuffs:[],

    /*
       ★ 新增（依照使用者要求，「野怪異常
       狀態直接做」——怪物終於可以對玩家
       附加負面效果了）：跟怪物身上的
       monster.statusEffects是同一套資料
       結構、同一套共用函式
       （applyMonsterDebuff()/
       getMonsterDebuffValue()/
       isMonsterFrozen()/isMonsterPetrified()
       雖然名字裡有「Monster」，但這些函式
       本來就只操作傳進去的物件本身，沒有
       任何寫死monster專屬的欄位，玩家角色
       物件一樣能直接沿用，不用重寫一套）。
    */

    statusEffects:[],

        /*
           ★ 新增：防禦狀態，跟player結構一致。
        */

        isDefending:false

    };


    const baseHP=
        100+
        player2.vitality*50+
        player2.bonusHP;


    const baseSP=
        50+
        player2.energy*15+
        player2.bonusSP;


    player2.hp=
        baseHP;


    player2.sp=
        baseSP;


    /*
       ★ 把第二角色掛進既有的
       characters / characterEquipment /
       characterSkillLoadouts 這三個結構，
       用固定id"player2"當key
       （不用元素當key，
       這樣就算元素跟第一名角色重複也不會互相覆蓋）。
       這三個結構原本就是背包頁/技能頁在讀的資料來源，
       掛進去之後那兩個頁面才抓得到第二角色。
    */

    characters.push({

        id:"player2",

        name:
            player2.id

    });


    characterEquipment.player2={
        head:null,
        hand:null,
        shoulder:null,
        armor:null,
        shoes:null,
        ring:null
    };


    characterSkillLoadouts.player2={

        name:
            player2.id,

        skillLevels:{},

        equippedSkills:[]

    };


    closeSecondCharacterModal();


    updateUI();

    saveGame();


    alert(
        "「"+
        player2.id+
        "」創建完成！可以到背包頁跟技能頁查看。"
    );

}


/* =====================================================
   ★ 創角完成
===================================================== */

function createCharacter(){

    const id =
        $("creationId")
        .value
        .trim();


    if(!id){

        alert(
            "請先輸入角色 ID。"
        );

        return;

    }


    if(id.length<2){

        alert(
            "ID至少需要2個字元。"
        );

        return;

    }


    /*
       確保六項能力都是合法數值。
    */

    Object.keys(creationStats)
    .forEach(stat=>{

        creationStats[stat] =
            Math.max(
                0,
                Number(
                    creationStats[stat]
                )||0
            );

    });


    player.id=id;

    player.element =
        selectedCreationElement;


    player.attack =
        creationStats.attack;

    player.vitality =
        creationStats.vitality;

    player.energy =
        creationStats.energy;

    player.intelligence =
        creationStats.intelligence;

    player.spirit =
        creationStats.spirit;

    player.agility =
        creationStats.agility;


    player.attributePoints =
        creationPoints;


    /*
       ★ 重要防呆：
       畫面切換必須放在最前面，
       確保「開始冒險」按下去後
       畫面一定會切換到遊戲介面，
       就算底下任何一行（例如存檔）
       在某些瀏覽器上出錯，
       也不會讓玩家卡在創角畫面。
    */

    $("creationPage")
        .style.display =
        "none";


    $("gameInterface")
        .style.display =
        "block";


    /*
       依六項能力計算初始HP/SP。
       用try/catch包起來，
       就算這裡意外出錯，
       畫面也已經切換過去了。
    */

    try{

        const stats =
            getBaseStats();


        player.hp =
            stats.maxHP;


        player.sp =
            stats.maxSP;


        updatePlayerHeader();

        updateUI();

        renderInventory();

        renderSkillLoadout();

    }
    catch(error){

        console.error(
            "創角後續初始化發生錯誤：",
            error
        );

    }


    try{

        saveGame();

    }
    catch(error){

        console.error(
            "創角存檔發生錯誤：",
            error
        );

    }

}


/* =====================================================
   存檔
===================================================== */

function saveGame(){

    try{

        normalizeInventoryStacks();

        const saveData = {

            version:6,

            player:player,

            /*
               ★ 第二角色存檔（新增）。
               player2在沒創建之前是null，
               JSON.stringify(null)沒問題，
               讀檔時只要判斷這個欄位是不是null就好。
            */

            player2:player2,
            player3:player3,

            sharedExp:sharedExp,

            /*
               ★ 新增（依照使用者要求，主城
               新增的六個功能：商店/角色展示/
               每日任務/圖鑑/成就/公告）：
               金幣、每日任務進度、圖鑑擊殺
               紀錄、成就完成狀態，都是新增的
               持久化資料，跟著存檔一起存。
               角色展示、公告不需要存檔
               （角色展示直接讀player/player2
               現有資料，公告是純靜態文字）。
            */

            gold:gold,

            dailyQuestState:
                dailyQuestState,

            /*
               ★ 新增：委託任務進度跟每日任務
               一樣要存檔。
            */

            commissionQuestState:
                commissionQuestState,

            bestiaryData:
                bestiaryData,

            achievementState:
                achievementState,

            /*
               ★ 新增（依照使用者要求，離線經驗
               系統）：每次存檔都記錄「這次存檔
               當下的時間」，讀檔時拿現在時間
               去減這個時間戳記，就能算出玩家
               離開了多久，換算出離線經驗。
            */

            lastSaveTimestamp:
                Date.now(),

            selectedCreationElement:
                selectedCreationElement,

            characterEquipment:
                characterEquipment,

            /*
               ★ 修正：
               characterSkillLoadouts（已學技能、等級、
               戰鬥配裝）之前完全沒有存檔，
               玩家花技能點學的技能、升的等級，
               只要重新整理頁面就會全部消失。
               現在把它加進存檔資料裡。
            */

            characterSkillLoadouts:
                characterSkillLoadouts,

            /*
               ★ 新增：自動戰鬥設定存檔。
               這兩組原本都完全沒有存檔，
               每次重新整理/重開，
               玩家設好的自動技能/HP門檻/SP門檻
               都會被重置回預設值，
               現在兩個角色的設定都一起存起來。
            */

            autoConfig:
                autoConfig,

            autoConfig2:
                autoConfig2,

            inventoryItems:
                inventoryItems

        };


        localStorage.setItem(
            SAVE_KEY,
            JSON.stringify(
                saveData
            )
        );

    }
    catch(error){

        console.error(
            "存檔失敗：",
            error
        );

    }

}


/* =====================================================
   ★ 舊存檔修復 / 讀檔
===================================================== */

function loadGame(){

    try{

        /*
           先讀新版。
        */

        let raw =
            localStorage.getItem(
                SAVE_KEY
            );


        /*
           如果沒有新版，
           嘗試讀舊版存檔。
        */

        if(!raw){

            raw =
                localStorage.getItem(
                    "battle_full_version_save_v4"
                )||
                localStorage.getItem(
                    "battle_full_version_save_v3"
                );

        }


        if(!raw){

            showCreation();

            return false;

        }


        const data =
            JSON.parse(raw);


        if(
            !data ||
            !data.player ||
            !data.player.id
        ){

            showCreation();

            return false;

        }


        /*
           先把玩家資料載入。
        */

        Object.assign(
            player,
            data.player
        );


        /*
           ★ 舊版沒有這些能力時，
           強制補0。
        */

        const stats = [
            "attack",
            "vitality",
            "energy",
            "intelligence",
            "spirit",
            "agility"
        ];


        stats.forEach(stat=>{

            const value =
                Number(
                    player[stat]
                );


            player[stat] =
                Number.isFinite(value)
                ?
                Math.max(
                    0,
                    value
                )
                :
                0;

        });


        /*
           ★ 舊存檔可能沒有bonusHP/bonusSP，
           強制補0，避免升級公式出錯。
        */

        if(
            !Number.isFinite(
                Number(player.bonusHP)
            )
        ){

            player.bonusHP=0;

        }


        if(
            !Number.isFinite(
                Number(player.bonusSP)
            )
        ){

            player.bonusSP=0;

        }


        /*
           ★ 讀取共用經驗池，
           舊存檔沒有的話就從0開始，
           玩家身上原本卡著的exp會自動轉入經驗池。
        */

        if(
            Number.isFinite(
                Number(data.sharedExp)
            )
        ){

            sharedExp =
                Number(
                    data.sharedExp
                );

        }
        else{

            sharedExp=0;

        }


        /* V93：舊 V92 的 permanentTestExpPool 欄位刻意忽略，
           測試 EXP 已改為每按一次直接追加，不再自動補回。 */



        /*
           ★ 新增（依照使用者要求，主城
           新增的六個功能）：
           讀取金幣/每日任務/圖鑑/成就，
           舊存檔沒有這些欄位的話就用預設值，
           不會讓讀檔整個失敗。
        */

        if(
            Number.isFinite(
                Number(data.gold)
            )
        ){

            gold=
                Number(
                    data.gold
                );

        }


        if(
            data.dailyQuestState &&
            typeof data.dailyQuestState===
            "object"
        ){

            Object.assign(
                dailyQuestState,
                data.dailyQuestState
            );

        }


        if(
            data.commissionQuestState &&
            typeof data.commissionQuestState===
            "object"
        ){

            Object.assign(
                commissionQuestState,
                data.commissionQuestState
            );

        }


        if(
            data.bestiaryData &&
            typeof data.bestiaryData===
            "object"
        ){

            Object.assign(
                bestiaryData,
                data.bestiaryData
            );

        }


        if(
            data.achievementState &&
            typeof data.achievementState===
            "object"
        ){

            Object.assign(
                achievementState,
                data.achievementState
            );

        }


        /*
           ★ 修正（依照使用者回報，統一改用
           共用函式calculateOfflineExpSince()，
           跟「切回前景」那個時機共用同一份
           邏輯，不要各自維護一份幾乎一樣
           的計算）：
           讀檔的時候，拿現在時間減掉上次
           存檔的時間戳記，換算出玩家離開了
           幾分鐘，算出這次「可以領取」的
           離線經驗，存進pendingOfflineExp
           （不會自動加進經驗池，要玩家自己
           去主城「離線經驗」那裡按按鈕才會
           真的入帳）。

           OFFLINE_EXP_PER_MINUTE：每離線
           1分鐘可以領到的經驗值。
           OFFLINE_EXP_MAX_MINUTES：離線經驗
           最多只算到這個分鐘數（480分鐘＝
           8小時），超過8小時不會領到更多，
           避免玩家放著角色不管好幾天，
           一次回來就直接把等級衝到頂。
        */

        if(
            Number.isFinite(
                Number(data.lastSaveTimestamp)
            )
        ){

            calculateOfflineExpSince(
                Number(
                    data.lastSaveTimestamp
                )
            );


            lastOfflineCheckTimestamp=
                Date.now();

        }


        if(
            Number.isFinite(
                Number(player.exp)
            ) &&
            player.exp>0
        ){

            sharedExp +=
                Number(player.exp);


            player.exp=0;

        }


        /*
           舊版可能還有
           defense / maxHP / maxSP
           這些舊欄位，
           新系統不直接使用。
        */


        if(
            !player.element ||
            !elementDatabase[
                player.element
            ]
        ){

            player.element =
                "fire";

        }


        if(
            !Number.isFinite(
                Number(player.level)
            )
        ){

            player.level=1;

        }


        if(
            !Number.isFinite(
                Number(player.exp)
            )
        ){

            player.exp=0;

        }


        if(
            !Number.isFinite(
                Number(player.expNext)
            ) ||
            player.expNext<=0
        ){

            player.expNext=100;

        }


        if(
            !Number.isFinite(
                Number(
                    player.attributePoints
                )
            )
        ){

            player.attributePoints=0;

        }


        if(
            !Number.isFinite(
                Number(
                    player.skillPoints
                )
            )
        ){

            player.skillPoints=0;

        }


        /*
           ★ 自動戰鬥設定讀檔（新增）。
           跟player2一樣，舊存檔不會有這兩個欄位，
           這種情況直接維持程式碼一開始
           宣告的預設值就好。
        */

        if(data.autoConfig){

            Object.assign(
                autoConfig,
                data.autoConfig
            );

        }


        if(data.autoConfig2){

            Object.assign(
                autoConfig2,
                data.autoConfig2
            );

        }


        /* V111：舊存檔門檻遷移到 25／50／75／90／100%。 */
        autoConfig.hp=normalizeAutoBattleThreshold(autoConfig.hp,50);
        autoConfig.sp=normalizeAutoBattleThreshold(autoConfig.sp,25);
        autoConfig2.hp=normalizeAutoBattleThreshold(autoConfig2.hp,50);
        autoConfig2.sp=normalizeAutoBattleThreshold(autoConfig2.sp,25);


        /*
           ★ 第二角色讀檔（新增）。

           舊存檔（這次更新之前存的）不會有
           data.player2這個欄位，
           這時候data.player2是undefined，
           player2維持null，等於「還沒創建過」，
           完全符合預期，不需要特別搬資料。

           如果有存過的話，除了還原player2本身，
           還要確保characters/characterEquipment/
           characterSkillLoadouts這三個結構裡
           都掛著player2對應的資料，
           不然背包頁/技能頁抓不到人。
        */

        if(data.player2){

            player2=
                data.player2;

            if(
                !characters.some(
                    c=>c.id==="player2"
                )
            ){

                characters.push({

                    id:"player2",

                    name:
                        player2.id

                });

            }


            if(
                !characterEquipment.player2
            ){

                characterEquipment.player2={
                        head:null,
                        hand:null,
                        shoulder:null,
                        armor:null,
                        shoes:null,
                        ring:null
                    };

            }


            if(
                !characterSkillLoadouts.player2
            ){

                characterSkillLoadouts.player2={

                    name:
                        player2.id,

                    skillLevels:{},

                    equippedSkills:[]

                };

            }

        }


        if(data.player3){
            player3=data.player3;
            if(!characters.some(c=>c.id==="player3")){
                characters.push({id:"player3",name:player3.id});
            }
            if(!characterEquipment.player3){
                characterEquipment.player3={head:null,hand:null,shoulder:null,armor:null,shoes:null,ring:null};
            }
            normalizeEquipmentSlots(characterEquipment.player3);
            if(!characterSkillLoadouts.player3){
                characterSkillLoadouts.player3={name:player3.id,skillLevels:{},equippedSkills:[]};
            }
        }

        /*
           ★ 技能配裝資料（新增）

           要處理兩種舊資料情況：
           1. 完全沒有 characterSkillLoadouts
              （最早的存檔版本，那時候根本沒存這個）
           2. 有存，但是舊格式
              （learnedSkills是陣列，不是skillLevels物件）
              → 這種情況直接視同沒存，
                用預設值（火焰斬1級）重新開始，
                技能點數玩家還在，可以重新學。
        */

        if(
            data.characterSkillLoadouts
        ){

            Object.keys(
                characterSkillLoadouts
            )
            .forEach(characterId=>{

                const saved =
                    data.characterSkillLoadouts[
                        characterId
                    ];


                if(
                    saved &&
                    saved.skillLevels &&
                    typeof saved.skillLevels==="object"&&
                    !Array.isArray(
                        saved.skillLevels
                    )
                ){

                    characterSkillLoadouts[
                        characterId
                    ].skillLevels =
                        saved.skillLevels;


                    if(
                        Array.isArray(
                            saved.equippedSkills
                        )
                    ){

                        characterSkillLoadouts[
                            characterId
                        ].equippedSkills =
                            saved.equippedSkills;

                    }

                }

            });

        }


        /*
           裝備資料
        */

        if(
            data.characterEquipment
        ){

            Object.keys(
                characterEquipment
            )
            .forEach(characterId=>{

                if(
                    data.characterEquipment[
                        characterId
                    ]
                ){

                    characterEquipment[
                        characterId
                    ] =
                        data
                        .characterEquipment[
                            characterId
                        ];

                }

            });

        }


        Object.keys(characterEquipment).forEach(function(characterId){
            normalizeEquipmentSlots(characterEquipment[characterId]);
        });

        /*
           背包資料
        */

        if(
            Array.isArray(
                data.inventoryItems
            )
        ){

            inventoryItems.length=0;


            data.inventoryItems
            .forEach(item=>{

                if(
                    item &&
                    item.id
                ){

                    inventoryItems.push(
                        item
                    );

                }

            });

        }


        normalizePotionInventoryFromLegacy(
            data
        );


        selectedCreationElement =
            data.selectedCreationElement ||
            player.element ||
            "fire";


        /*
           ★ 讀檔後重新計算HP/SP。
        */

        const stats2 =
            getMainCharacterStats();


        if(
            !Number.isFinite(
                Number(player.hp)
            ) ||
            player.hp<=0
        ){

            player.hp =
                stats2.maxHP;

        }
        else{

            player.hp =
                Math.min(
                    Number(player.hp),
                    stats2.maxHP
                );

        }


        if(
            !Number.isFinite(
                Number(player.sp)
            ) ||
            player.sp<0
        ){

            player.sp =
                stats2.maxSP;

        }
        else{

            player.sp =
                Math.min(
                    Number(player.sp),
                    stats2.maxSP
                );

        }


        /*
           ★ 最重要：
           讀檔成功後明確顯示遊戲。
        */

        $("creationPage")
            .style.display =
            "none";


        $("gameInterface")
            .style.display =
            "block";


        rebuildInventorySlots();

        updatePlayerHeader();


        /*
           ★ 修正（真正抓到「重新整理後主城
           標題列又跑出來」的原因）：
           homePage在HTML裡是直接寫死
           class="page active"，讀檔成功
           顯示遊戲畫面的這裡，從來沒有真的
           呼叫過showPage("home")，導致
           「主城/練功區不顯示標題列」這個
           機制（靠showPage()裡切換#app的
           no-header這個class）從來沒有
           機會執行到——只有玩家之後手動點了
           導覽列、真的觸發一次showPage()，
           標題列才會消失。這裡補上，讀檔
           成功、遊戲畫面顯示出來的同時，
           就正確套用一次。
        */

        showPage(
            "home"
        );


        updateUI();

        renderInventory();

        renderSkillLoadout();


        /*
           存成新版格式，
           讓舊資料完成升級。
        */

        saveGame();


        return true;

    }
    catch(error){

        console.error(
            "讀取存檔失敗：",
            error
        );


        /*
           不讓錯誤把整個遊戲卡死。
           讀檔失敗就回創角畫面。
        */

        $("gameInterface")
            .style.display =
            "none";


        $("creationPage")
            .style.display =
            "block";


        return false;

    }

}


function showCreation(){

    $("gameInterface")
        .style.display =
        "none";


    $("creationPage")
        .style.display =
        "block";


    updateCreationUI();

}


/* =====================================================
   清除存檔
===================================================== */

function resetGame(){

    if(
        !confirm(
            "確定要刪除角色並重新創建嗎？"
        )
    ){
        return;
    }


    localStorage.removeItem(
        SAVE_KEY
    );

    localStorage.removeItem(
        "battle_full_version_save_v4"
    );

    localStorage.removeItem(
        "battle_full_version_save_v3"
    );


    location.reload();

}


/* =====================================================
   V115 — 巡怪頁內背包浮層
   只改開啟方式；背包資料、裝備、物品詳情、出售等仍沿用原函式。
===================================================== */
let mapInventoryOverlayOpen=false;

function setMapInventoryScrollGate(enabled){
    [
        document.documentElement,
        document.body,
        document.getElementById("game-viewport"),
        document.getElementById("game-stage")
    ].forEach(function(element){
        if(element){
            element.classList.toggle("inventory-scroll-active",!!enabled);
        }
    });
}

function openMapInventoryOverlay(){
    const mapPage=$("mapPage");
    const inventoryPage=$("inventoryPage");

    if(
        battleActive ||
        !mapPage ||
        !mapPage.classList.contains("active") ||
        !inventoryPage
    ){
        return;
    }

    mapInventoryOverlayOpen=true;
    inventoryPage.classList.add("map-inventory-overlay-open");
    setMapInventoryScrollGate(true);

    if(typeof renderInventory==="function"){
        renderInventory();
    }

    const scroller=$("inventoryGridScroll");
    if(scroller){
        scroller.scrollTop=0;
    }
}

function closeMapInventoryOverlay(){
    const inventoryPage=$("inventoryPage");

    mapInventoryOverlayOpen=false;

    if(inventoryPage){
        inventoryPage.classList.remove("map-inventory-overlay-open");
    }

    if(typeof closeItemModal==="function"){
        closeItemModal();
    }
    if(typeof closeInventoryCharacterDetail==="function"){
        closeInventoryCharacterDetail();
    }

    /* 若不是正式背包頁，才關閉祖層 pan-y 放行。 */
    const directInventoryActive=
        inventoryPage && inventoryPage.classList.contains("active");

    if(!directInventoryActive){
        setMapInventoryScrollGate(false);
    }
}

/* =====================================================
   頁面
===================================================== */

function showPage(page){

    if(
        page!=="map" &&
        mapInventoryOverlayOpen
    ){
        closeMapInventoryOverlay();
    }

    if(
        battleActive &&
        page!=="battle"
    ){
        return;
    }


    document
    .querySelectorAll(".page")
    .forEach(p=>{
        p.classList.remove(
            "active"
        );
    });


    const target =
        $(page+"Page");


    if(!target){
        return;
    }


    target.classList.add(
        "active"
    );


    /*
       ★ 修正（真的抓到「練功突然不遇怪」的原因）：
       之前只有透過enterZone()（重新選擇/進入
       練功區）才會重新整理地圖上怪物圖示的
       顯示狀態，單純用showPage("map")切換
       頁面完全不會做這件事。

       如果怪物存活狀態跟畫面圖示顯示狀態
       在某個時序下不小心兜不起來（例如剛打完
       一場戰鬥、回到地圖的那個瞬間），
       單純切換頁面回地圖是沒辦法修正的——
       只有回頭重新進入練功區才會強制重置，
       這正是「亂切選單才又恢復正常」背後的
       真正原因：不是切換本身有效，是切換的
       途中剛好重新進入了練功區、觸發了完整重置。

       這裡直接讓「切換到地圖頁面」這個動作，
       每次都順便重新同步一次怪物圖示的
       顯示狀態，確保只要看得到地圖，
       畫面上顯示的怪物就一定跟實際資料一致，
       不用再特地繞去重新進入練功區才能修正。
    */

    if(
        page==="map"&&
        typeof updateMapMonsterIcons===
        "function"
    ){

        updateMapMonsterIcons();

    }


    /*
       ★ 戰鬥、背包頁面時隱藏頂部的角色資訊列，
       因為那些資訊（等級/HP/SP）
       跟這兩個頁面本身顯示的角色資訊重複，
       省下的空間讓內容可以大一點。
       用 #app 的 no-header class
       統一控制，之後如果還有其他頁面
       也想拿掉頂部列，只要把頁名加進
       hideHeaderPages 這個陣列就好。
    */

    const hideHeaderPages = [
        "battle",
        "inventory",
        "status",
        "skill",
        "home",
        "training",
        "dungeon",
        "boss"
    ];


    const appElement =
        $("app");


    if(appElement){

        if(
            hideHeaderPages.includes(
                page
            )
        ){

            appElement.classList.add(
                "no-header"
            );

        }
        else{

            appElement.classList.remove(
                "no-header"
            );

        }


        /*
           ★ 新增（依照使用者要求，地圖頁面
           標題列精簡模式）：地圖頁面現在
           只顯示地圖名稱一行文字，其他頁面
           （戰鬥/狀態/技能/背包）還是完整
           兩行角色資訊，只在真的切到map
           頁面時加上這個class。
        */

        appElement.classList.toggle(

            "map-header-compact",

            page==="map"

        );


        /*
           ★ 修正（依照使用者要求，主城新增
           「合成」「系統」變成3排卡片，
           原本「不能捲動」的限制在內容變多
           之後，風險是會把新增的第3排卡片
           直接裁掉、完全看不到——這比「偶爾
           需要滑一下」嚴重得多。改成只有
           map頁面維持不能捲動（地圖頁面
           內容量沒有變、繼續適用），主城
           拿掉這個限制，改回允許捲動，
           確保內容變多的時候都看得到，
           不會被靜靜裁掉。
        */

        /*
           V89：主城與地圖都屬於固定畫面。
           主城原本因歷史需求被排除在 no-scroll-page 之外，
           但現在主城卡片已能完整塞進固定舞台；配合 #homePage
           不再使用 100vh，正式讓 home/map 都不產生外層捲動。
        */
        appElement.classList.toggle(

            "no-scroll-page",

            page==="map" ||
            page==="home"

        );


        /*
           ★ 新增（依照使用者要求，地圖頁面
           換成專屬的角色/任務/返回導覽列）：
        */

        appElement.classList.toggle(

            "on-map-page",

            page==="map"

        );


        /*
           ★ 修正（依照使用者要求，拿掉
           主城立繪）：原本這裡每次切到
           主城頁面會呼叫showHomePortrait()
           隨機換一張立繪，圖片本身跟相關
           函式都已經整段移除，這個呼叫
           一併拿掉，不留死代碼。
        */


        /*
           ★ 新增（依照使用者要求）：
           戰鬥中把底部主城/練功區/狀態/技能/背包
           那排導覽列也一併藏起來，
           戰鬥時用不到，藏起來剛好多出一截空間，
           對「不要捲動」這個需求也有幫助。
           只在battle頁面藏，其他頁面
           （背包/狀態/技能）還是要看得到導覽列，
           不然沒辦法切換頁面。
        */

        appElement.classList.toggle(
            "in-battle",
            page==="battle"
        );

        /*
           V78：
           底部導覽列直接開啟的背包頁，
           真正 scroll owner 是 .content。
        */
        appElement.classList.toggle(
            "on-inventory-page",
            page==="inventory"
        );

        /*
           V79 ROOT FIX：
           直接由底部導覽進背包時，native scroll owner 是 .content。
           只改 .content 的 touch-action 不夠，因為 #game-viewport
           在 V5/V8 架構中長期使用 touch-action:none 鎖住整個遊戲。
           Android / Samsung Browser 會在手勢開始時把祖先 touch-action
           一起納入判定；因此這裡沿用 V64 已驗證的角色視窗做法，
           在「背包頁存在期間」同步放行 html/body/viewport/stage 的 pan-y。
           離開背包立刻移除，不改地圖、戰鬥與其他頁面的手勢政策。
        */
        const inventoryTouchMode =
            page==="inventory";

        [
            document.documentElement,
            document.body,
            document.getElementById("game-viewport"),
            document.getElementById("game-stage")
        ].forEach(function(element){
            if(!element){
                return;
            }
            element.classList.toggle(
                "inventory-scroll-active",
                inventoryTouchMode
            );
        });

    }


    /*
       ★ 新增（依照使用者要求）：
       戰鬥資訊／自動戰鬥覆蓋層只在「地圖
       （巡邏）頁面」顯示——戰鬥頁面本身
       已經有原本那份，這裡這份只負責
       「離開戰鬥、回到地圖之後還能繼續
       看到上一場戰鬥資訊」這件事，
       其他頁面（主城/練功區選擇/狀態/
       技能/背包）都不需要，一併隱藏。
    */

    const mapBattleOverlay=
        $("mapBattleOverlay");


    if(mapBattleOverlay){

        mapBattleOverlay.style.display=

            page==="map"
            ?
            "flex"
            :
            "none";

    }


    /*
       ★ 新增（依照使用者要求）：
       頁面切換的當下，立刻重新判斷最上面
       標題列要顯示「角色資訊」還是「地圖+
       怪物資訊」，不用等下一次updateUI()
       才生效，切過去的瞬間就是對的。
    */

    updateMapPageHeader();


    /*
       ★ 修正（依照使用者回報，真正抓到
       「打完一場戰鬥回地圖，巡怪動畫就壞掉、
       圖片變大」的原因）：
       原本只有enterZone()→enterMap()那條路徑
       會呼叫resetPatrolCharacterToIdle()，
       但winBattle()/loseBattle()/逃脫成功
       之後，都是直接呼叫showPage("map")
       返回地圖，完全繞過enterMap()——如果
       戰鬥剛好是在巡怪走路中、甚至是打架
       特效放大到120px的那一刻被觸發，回來
       後沒有任何東西把角色圖示的尺寸／
       位置／計時器重置乾淨，才會看到圖片
       亂跳、人物變大、巡怪中標籤消失。

       改成在showPage()這裡統一處理，
       不管是從哪裡呼叫showPage("map")，
       只要切到地圖頁面，都會依照
       autoPatrolEnabled目前的狀態，
       決定要「重新開始走路」（巡怪還開著）
       還是「回到置中靜止」（巡怪已經關了），
       兩種情況都會先把尺寸/位置重置乾淨，
       不會再殘留任何上一場戰鬥前的狀態。
    */

    if(page==="map"){

        if(autoPatrolEnabled){

            startPatrolCharacterWalking();


            /*
               ★ 修正（真正抓到「戰鬥完出來
               直接打架動畫、沒5秒又進戰鬥」
               的原因）：
               自動巡怪的「每5秒檢查一次」計時器
               （autoPatrolIntervalId），原本是
               從玩家最早按下「自動巡怪」那一刻
               開始算的固定週期，完全不管中間
               打了幾場戰鬥、每場打了多久——
               戰鬥中這個計時器照樣在背景每5秒
               跳一次（只是battleActive=true
               會讓它提早return，不會真的做事）。

               戰鬥結束、回到地圖的瞬間，如果
               剛好卡在這個計時器「這次要跳動」
               的時間點附近，就會幾乎是戰鬥一
               結束馬上又觸發下一次檢查——可能
               只間隔零點幾秒，完全跟這場戰鬥
               打了多久無關，這才是「沒5秒又
               進戰鬥」的真正原因，不是重試
               邏輯的問題。

               修法：每次真的回到地圖頁面時，
               把這個計時器清掉、重新啟動一個
               新的，讓「5秒」保證是從「回到
               地圖的這一刻」開始算，不會再
               沿用戰鬥前就已經在跑、跟這次
               戰鬥結束時間點完全無關的舊時鐘。
            */

            if(autoPatrolIntervalId){

                clearInterval(
                    autoPatrolIntervalId
                );

                autoPatrolIntervalId=null;

            }

            if(autoPatrolTimeoutId){

                clearTimeout(
                    autoPatrolTimeoutId
                );

                autoPatrolTimeoutId=null;

            }

            scheduleAutoPatrolCheck(5000);

        }
        else{

            resetPatrolCharacterToIdle();

        }

    }


    document
    .querySelectorAll(".nav-button")
    .forEach(b=>{
        b.classList.remove(
            "active"
        );
    });


    const navMap = {

        home:"homeNav",

        training:"trainingNav",

        dungeon:"dungeonNav",

        boss:"bossNav",

        inventory:"inventoryNav"

    };


    if(navMap[page]){

        $(navMap[page])
            .classList
            .add("active");

    }


    if(page==="skill"){
        renderSkillLoadout();
    }


    if(page==="inventory"){
        renderInventory();
    }


    /*
       ★ 新增：副本/BOSS頁面一開啟就顯示
       第一個分頁的內容，不用玩家自己
       先點一次分頁按鈕才看得到東西。
    */

    if(page==="dungeon"){

        switchDungeonTab(
            "daily"
        );

    }


    if(page==="boss"){

        switchBossTab(
            "personal"
        );

    }


    updateUI();

}


/* =====================================================
   地圖
===================================================== */

/*
   ★ 練功區切換。

   之前「荒漠地帶」只是規格書裡的鎖住佔位卡，
   完全沒有真正的地圖跟怪物資料。
   現在補上：達到Lv.11就能真的進去，
   怪物換成desertMonsters（明顯比新手森林硬），
   方便測試燃燒之類需要怪物撐久一點才看得出效果的技能。
*/

/*
   ★ 修正（依照使用者要求新增5個區域後，
   改用資料驅動的方式整理，避免每加一個
   區域就要在好幾個函式裡各自複製貼上
   一段幾乎一樣的if判斷，之後要再加
   第9、10區也只要在這份清單裡加一筆）。
*/

const zoneConfig = {

    forest:{
        requiredLevel:0,
        monsters:()=>forestMonsters,
        title:"新手森林",
        desc:"Lv.1～10｜一般練功區最多6隻怪物",
        levelRange:"Lv.1～10"
    },

    desert:{
        requiredLevel:11,
        monsters:()=>desertMonsters,
        title:"荒漠地帶",
        desc:"Lv.11～20｜怪物明顯較強，適合測試技能效果",
        levelRange:"Lv.11～20"
    },

    ice:{
        requiredLevel:21,
        monsters:()=>iceMountainMonsters,
        title:"冰霜山脈",
        desc:"Lv.21～30｜怪物開始有屬性、會施放技能",
        levelRange:"Lv.21～30"
    },

    zone4:{
        requiredLevel:31,
        monsters:()=>zone4Monsters,
        title:"熔岩深淵",
        desc:"Lv.31～40｜怪物技能1個，施放機率55%",
        levelRange:"Lv.31～40"
    },

    zone5:{
        requiredLevel:41,
        monsters:()=>zone5Monsters,
        title:"巨獸荒原",
        desc:"Lv.41～50｜怪物技能2個，施放機率60%",
        levelRange:"Lv.41～50"
    },

    zone6:{
        requiredLevel:51,
        monsters:()=>zone6Monsters,
        title:"修羅戰場",
        desc:"Lv.51～60｜怪物技能2個，施放機率65%",
        levelRange:"Lv.51～60"
    },

    zone7:{
        requiredLevel:61,
        monsters:()=>zone7Monsters,
        title:"魔君祭壇",
        desc:"Lv.61～70｜怪物技能3個，施放機率65%",
        levelRange:"Lv.61～70"
    },

    zone8:{
        requiredLevel:71,
        monsters:()=>zone8Monsters,
        title:"龍獄深淵",
        desc:"Lv.71～80｜怪物技能3個，施放機率70%",
        levelRange:"Lv.71～80"
    },

    zone9:{
        requiredLevel:81,
        monsters:()=>zone9Monsters,
        title:"虛空盡頭",
        desc:"Lv.81～90｜怪物技能3個，施放機率70%",
        levelRange:"Lv.81～90"
    },

    zone10:{
        requiredLevel:91,
        monsters:()=>zone10Monsters,
        title:"終焉之境",
        desc:"Lv.91～100｜怪物技能3個，施放機率70%",
        levelRange:"Lv.91～100"
    }

};


function enterZone(zoneName){

    if(battleActive){
        return;
    }


    const config=
        zoneConfig[zoneName];


    if(!config){
        return;
    }


    if(player.level<config.requiredLevel){

        alert(
            "需要達到 Lv."+
            config.requiredLevel+
            "才能進入"+
            config.title.replace(
                /^\S+\s/,
                ""
            )+
            "。"
        );

        return;

    }


    currentZone=
        zoneName;


    monsters=
        config.monsters();


    monsters.forEach(
        monster=>{

            monster.alive=true;

            monster.hp=
                monster.maxHP;

            monster.sp=
                monster.maxSP;

            monster.statusEffects=[];

        }
    );


    updateMapZoneLabels();

    updateMapMonsterIcons();

    enterMap();

}


function updateMapZoneLabels(){

    const title =
        $("mapPageTitle");


    const desc =
        $("mapPageDesc");


    /*
       ★ 修正（改用zoneConfig統一管理，
       不用再每加一個區域就複製貼上
       一整段if-else）。
    */

    const config=

        zoneConfig[currentZone]
        ||
        zoneConfig.forest;


    if(title){

        title.textContent=
            config.title;

    }


    if(desc){

        desc.textContent=
            config.desc;

    }

}


function updateMapMonsterIcons(){

    /*
       ★ 修正（地圖重新設計）：
       原本直接用element.textContent寫入emoji，
       但現在怪物卡片內部改成
       icon/name/level三個獨立的子元素，
       要分別寫入對應的欄位，
       不能再整個蓋掉（那樣名稱跟等級都會消失）。
    */

    monsters.forEach(
        (monster,index)=>{

            const element =
                $("mapMonster"+index);


            if(!element){
                return;
            }


            const icon =
                monster.name==="沙漠豺狼"
                ?
                ""
                :
                monster.name==="沙蠍"
                ?
                ""
                :
                monster.name==="史萊姆"
                ?
                ""
                :
                "";


            const iconEl=
                element.querySelector(
                    ".map-monster-icon"
                );


            const nameEl=
                element.querySelector(
                    ".map-monster-name"
                );


            const levelEl=
                element.querySelector(
                    ".map-monster-level"
                );


            if(iconEl){

                iconEl.textContent=
                    icon;

            }


            if(nameEl){

                nameEl.textContent=
                    monster.name;

            }


            if(levelEl){

                levelEl.textContent=
                    "Lv."+
                    monster.level;

            }


            /*
               ★ 修正（依照使用者要求，地圖不再
               顯示怪物圖示，改成固定時間自動
               觸發戰鬥）：
               這裡原本負責依存活狀態切換圖示
               顯示/隱藏，但現在整個.map-monster
               已經在CSS裡永久設成display:none，
               不需要再由JS這裡另外控制顯示狀態，
               也不能再設inline的display，
               不然行內樣式的優先權會蓋掉CSS的
               display:none，讓圖示又跑出來。
               這裡只保留上面icon/name/level
               文字內容的更新（雖然圖示不會顯示，
               但保留這部分邏輯以防之後又要
               重新啟用），拿掉display的設定。
            */

        }
    );

}


/*
   ★ 更新練功區列表頁面裡，荒漠地帶那張卡片的
   鎖定狀態跟按鈕。
   達到Lv.11之後卡片會解鎖、顯示「進入地圖」按鈕，
   在這之前保持原本鎖住的樣子。
*/

function updateTrainingZoneLocks(){

    /*
       ★ 修正（依照使用者要求，練功區改版，
       純文字列表取代卡片）：
       原本操作的是卡片裡的.map-desc文字/
       按鈕區塊，這些元素已經不存在了。
       改成單純切換.training-zone-item的
       .locked這個class（純CSS調暗，
       不隱藏文字本身，點下去還是能看
       資訊框、只是資訊框裡的進入按鈕會被
       換成「需要Lv.X」的提示，邏輯移到
       openTrainingZoneInfo()裡處理），
       這裡只負責「文字要不要調暗」這件事。

       id對照沿用新HTML裡的
       trainingZoneItem_desert這種命名
       規則。
    */

    const lockableZones=[

        {key:"desert",itemId:"trainingZoneItem_desert"},
        {key:"ice",itemId:"trainingZoneItem_ice"},
        {key:"zone4",itemId:"trainingZoneItem_zone4"},
        {key:"zone5",itemId:"trainingZoneItem_zone5"},
        {key:"zone6",itemId:"trainingZoneItem_zone6"},
        {key:"zone7",itemId:"trainingZoneItem_zone7"},
        {key:"zone8",itemId:"trainingZoneItem_zone8"},
        {key:"zone9",itemId:"trainingZoneItem_zone9"},
        {key:"zone10",itemId:"trainingZoneItem_zone10"}

    ];


    lockableZones.forEach(entry=>{

        const config=
            zoneConfig[entry.key];


        const item=
            $(entry.itemId);


        if(
            !config ||
            !item
        ){
            return;
        }


        item.classList.toggle(

            "locked",

            player.level<
            config.requiredLevel

        );

    });

}


/*
   ★ 第二角色解鎖提示。
   Lv.10之後、還沒創建第二角色時顯示，
   創建完成後就不會再顯示這張卡片了。
*/

function updateSecondCharacterBanner(){

    const banner=
        $("secondCharacterBanner");


    if(!banner){
        return;
    }


    banner.style.display=

        (
            player.level>=10 &&
            !player2
        )
        ?
        "block"
        :
        "none";

}


function enterMap(){

    if(battleActive){
        return;
    }


    showPage("map");


    /*
       ★ 新增（依照使用者要求，巡怪頁面
       背景依地區動態切換）：每次進入
       地圖頁面，套用目前這個地區
       （currentZone）對應的背景圖。
    */

    applyMapZoneBackground(
        currentZone
    );


    /*
       ★ 新增（依照使用者要求）：
       每次進入地圖頁面，巡怪角色圖示回到
       置中靜止、正面圖的預設狀態——不管
       上一次離開地圖時走到哪、自動巡怪
       開著還關著，這裡都重新歸零。
    */

    resetPatrolCharacterToIdle();


    /*
       ★ 每次進地圖，玩家棋盤座標重置回中央，
       跟隨方塊的路徑紀錄也一併清空，
       避免帶著上次殘留的位置資料。
    */

    playerGridCol=5;

    playerGridRow=5;

    playerPathHistory=[
        {col:5,row:5}
    ];


    const playerEl=
        $("mapPlayer");


    if(playerEl){

        const pos=
            gridCellToPercent({
                col:5,
                row:5
            });


        playerEl.style.left=
            pos.x+"%";


        playerEl.style.top=
            pos.y+"%";

    }


    updateMapPlayerCard();

    updateFollowerPosition();


    startMonsterMovement();

}


function leaveMap(){

    if(battleActive){
        return;
    }


    stopMonsterMovement();

    stopAutoPatrol();

    showPage("training");

}


/* =====================================================
   自動巡怪
===================================================== */

/*
   ★ 新增（依照使用者要求）：
   「自動巡怪」跟「自動戰鬥」是兩件獨立的事：
   自動戰鬥控制的是「戰鬥開始之後，角色要不要
   自動出手」；自動巡怪控制的是「戰鬥外，
   要不要自動去找怪物打」。兩者互不依賴，
   可以只開一個，也可以兩個都開。

   實作上很單純：按下去之後，每4秒檢查一次
   目前地圖上（monsters[0]~monsters[MAX_
   TRAINING_MONSTERS-1]）還有沒有活著的怪物，
   有的話直接呼叫startBattle()對第一隻活著的
   怪物開戰——不用真的模擬玩家在地圖上走過去，
   單純只是「定期自動觸發戰鬥」。

   如果目前已經在戰鬥中（battleActive），
   這次檢查就跳過、什麼都不做，等下一次
   4秒後再檢查——戰鬥結束後，下一次檢查
   自然就會抓到還活著的怪物繼續打，
   不需要額外處理「戰鬥結束後要不要恢復」，
   setInterval本來就會一直每4秒執行一次。
*/

let autoPatrolEnabled=
    false;

let autoPatrolIntervalId=
    null;

/*
   ★ 最終修正：自動巡怪改用「單次5秒排程 + 自我續排」
   取代單純依賴setInterval。
   這仍然維持原本「每5秒檢查一次」的遊戲機制，
   但戰鬥切頁、手機背景喚醒、計時器被清除等情況下，
   下一次檢查會重新建立，不會因計時器失效而永久停止。
*/
let autoPatrolTimeoutId=
    null;


/*
   ★ 新增（依照使用者要求，巡怪走路動畫）：
   四張圖分別是：靜止/往下走用的正面圖、
   往上走用的背面圖、進入戰鬥前特效用的
   兩張打架圖，全部轉成base64內嵌，
   單一HTML檔案不依賴外部圖片路徑。
*/

const PATROL_CHAR_FRONT_B64="assets/characters/patrol-character.png";

const PATROL_CHAR_BACK_B64="assets/characters/patrol-back.png";

const PATROL_FIGHT1_B64="assets/battle/patrol-fight-1.png";

const PATROL_FIGHT2_B64="assets/battle/patrol-fight-2.png";


let patrolWalkIntervalId=
    null;

let patrolCurrentTop=
    37;

/*
   ★ 防止「正在播放打架特效」的當下，
   剛好被巡怪走路的計時器打斷、把畫面
   換回正面/背面圖——見
   movePatrolCharacterRandomly()開頭
   的判斷。
*/

let patrolInFightAnimation=
    false;

let patrolFightAnimTimeoutIds=
    [];

/*
   ★ 新增：找到怪物、正在播1秒鐘打架特效、
   但真正的startBattle()還沒被呼叫的這段
   空檔，擋掉runAutoPatrolCheck()重複觸發。
   見runAutoPatrolCheck()開頭的判斷。
*/

let patrolBattleTransitionPending=
    false;


/*
   ★ 進入地圖頁面時（enterZone()／
   showPage()切到map的時候）呼叫，
   讓角色回到「靜止置中、正面圖」的
   預設狀態，不管之前巡怪走到哪裡去了。
*/

function resetPatrolCharacterToIdle(){

    patrolFightAnimTimeoutIds.forEach(
        id=>clearTimeout(id)
    );

    patrolFightAnimTimeoutIds=
        [];

    patrolInFightAnimation=
        false;

    patrolBattleTransitionPending=
        false;


    const wrap=
        $("patrolCharacterWrap");

    const img=
        $("patrolCharacterImg");

    const label=
        $("patrolCharacterLabel");


    if(wrap){

        wrap.style.left=
            "50%";

        /*
           ★ 修正（依照使用者要求，跟
           movePatrolCharacterRandomly()
           的22%~52%新範圍保持一致）：
           原本50%已經超出新的移動範圍，
           改成新範圍的中間值（37%），
           靜止狀態的位置也會落在合理範圍
           內，不會一開始就貼近戰鬥資訊框。
        */

        wrap.style.top=
            "37%";

    }


    if(img){

        img.style.width=
            "70px";

        img.src=
            PATROL_CHAR_FRONT_B64;

    }


    if(label){

        label.style.display=
            "none";

    }


    patrolCurrentTop=
        37;

}


/*
   ★ 巡怪走路：每隔一段時間換一個隨機座標，
   透過CSS transition自然移動過去；跟舊座標
   比較Y軸（top），變小＝往上走＝換背面圖，
   變大或不變＝往下走／原地＝換正面圖。
*/

function movePatrolCharacterRandomly(){

    if(patrolInFightAnimation){
        return;
    }


    const wrap=
        $("patrolCharacterWrap");

    const img=
        $("patrolCharacterImg");


    if(
        !wrap ||
        !img
    ){
        return;
    }


    const newLeft=
        20+
        Math.random()*60;

    /*
       ★ 修正（依照使用者要求，「巡怪
       人物不要超出戰鬥資訊的上緣」）：
       地圖頁面下方的自動戰鬥/自動巡怪/
       戰鬥資訊那個區塊是position:fixed
       貼在螢幕底部的，跟這裡用「相對
       #mapPage高度的百分比」在移動的
       巡怪角色，兩者的座標系統原本沒有
       對齊——原本56%的移動範圍，很容易
       算到貼近或蓋過那個固定區塊的上緣。
       範圍從22%~78%收窄成22%~52%，
       確保角色移動的最低點還是留在
       戰鬥資訊框上緣之上，不會疊到。
    */

    const newTop=
        22+
        Math.random()*30;

    const movingUp=
        newTop<patrolCurrentTop;


    img.src=
        (movingUp ? PATROL_CHAR_BACK_B64 : PATROL_CHAR_FRONT_B64);


    wrap.style.left=
        newLeft+"%";

    wrap.style.top=
        newTop+"%";


    patrolCurrentTop=
        newTop;

}


function startPatrolCharacterWalking(){

    /*
       ★ 修正（依照使用者回報）：
       每次真正開始走路之前，先把可能殘留
       的打架特效狀態清乾淨（尺寸放大到
       120px、還沒播完的特效計時器），
       不然剛好在特效播放中被叫回這裡
       （例如戰鬥剛結束、回到地圖時），
       角色會卡在放大的樣子繼續走。
    */

    patrolFightAnimTimeoutIds.forEach(
        id=>clearTimeout(id)
    );

    patrolFightAnimTimeoutIds=
        [];

    patrolInFightAnimation=
        false;

    patrolBattleTransitionPending=
        false;


    const img=
        $("patrolCharacterImg");


    if(img){

        img.style.width=
            "70px";

    }


    const label=
        $("patrolCharacterLabel");


    if(label){

        label.style.display=
            "inline-block";

    }


    movePatrolCharacterRandomly();


    if(patrolWalkIntervalId){

        clearInterval(
            patrolWalkIntervalId
        );

    }


    patrolWalkIntervalId=
        setInterval(
            movePatrolCharacterRandomly,
            2200
        );

}


function stopPatrolCharacterWalking(){

    if(patrolWalkIntervalId){

        clearInterval(
            patrolWalkIntervalId
        );

        patrolWalkIntervalId=
            null;

    }


    resetPatrolCharacterToIdle();

}


/*
   ★ 進入戰鬥前1秒鐘的打架特效：兩張圖
   各顯示0.5秒、靜止不動（不用CSS動畫，
   單純換圖），播完呼叫callback
   （runAutoPatrolCheck()那邊會接
   startBattle()）。
*/

function playPatrolFightAnimation(callback){

    patrolInFightAnimation=
        true;


    const img=
        $("patrolCharacterImg");

    const label=
        $("patrolCharacterLabel");


    if(label){

        label.style.display=
            "none";

    }


    if(img){

        img.style.width=
            "120px";

        img.src=
            PATROL_FIGHT1_B64;

    }


    const t1=
        setTimeout(()=>{

            if(img){

                img.src=
                    PATROL_FIGHT2_B64;

            }

        },500);


    const t2=
        setTimeout(()=>{

            patrolInFightAnimation=
                false;


            if(callback){

                callback();

            }

        },1000);


    patrolFightAnimTimeoutIds.push(
        t1,
        t2
    );

}


function toggleAutoPatrol(){

    autoPatrolEnabled=
        !autoPatrolEnabled;


    const button=
        $("autoPatrolButton");


    if(autoPatrolEnabled){

        if(button){

            button.textContent=
                "⏹ 停止巡怪";

            button.classList.add(
                "active"
            );

        }


        /*
           ★ 新增（依照使用者要求，「巡怪
           頁面左上角新增小按鈕，巡怪快捷
           開啟/停止」）：
           跟上面autoPatrolButton同一套邏輯，
           同步更新左上角這顆小快捷鈕。
        */

        const quickPatrolBtn=
            $("quickAutoPatrolToggle");


        if(quickPatrolBtn){

            /*
               ★ 修正（配合快捷鈕改成純圖示鈕）：
               不能再寫textContent，會把裡面
               開/關兩張<img>洗掉，改成只切換
               active這個class（CSS會自動決定
               顯示哪一張圖），文字說明改放到
               aria-label。
            */

            quickPatrolBtn.setAttribute(
                "aria-label",
                "自動巡怪（開啟中）"
            );

            quickPatrolBtn.classList.add(
                "active"
            );

        }


        scheduleAutoPatrolCheck(5000);


        /*
           ★ 新增（依照使用者要求）：
           按下開始巡怪的同時，讓角色開始
           在地圖上走動。
        */

        startPatrolCharacterWalking();


        addBattleLog(
            "自動巡怪開始，"+
            "每5秒自動尋找怪物戰鬥。"
        );

    }
    else{

        stopAutoPatrol();

    }

}


function stopAutoPatrol(){

    autoPatrolEnabled=
        false;


    if(autoPatrolIntervalId){

        clearInterval(
            autoPatrolIntervalId
        );

        autoPatrolIntervalId=
            null;

    }

    if(autoPatrolTimeoutId){

        clearTimeout(
            autoPatrolTimeoutId
        );

        autoPatrolTimeoutId=
            null;

    }


    const button=
        $("autoPatrolButton");


    if(button){

        button.textContent=
            "▶ 啟動";

        button.classList.remove(
            "active"
        );

    }


    /*
       ★ 新增：跟上面toggleAutoPatrol()裡
       開啟時的更新是同一組，這裡是關閉
       狀態的同步。
    */

    const quickPatrolBtn=
        $("quickAutoPatrolToggle");


    if(quickPatrolBtn){

        quickPatrolBtn.setAttribute(
            "aria-label",
            "自動巡怪（關閉）"
        );

        quickPatrolBtn.classList.remove(
            "active"
        );

    }


    /*
       ★ 新增（依照使用者要求）：
       停止巡怪的同時，讓角色停下來、
       回到置中靜止的正面圖狀態。
    */

    stopPatrolCharacterWalking();

}


function runAutoPatrolCheck(){

    /*
       ★ 除錯用（依照使用者回報，追蹤
       「戰鬥結束回地圖後，自動巡怪沒有
       繼續」的原因）：印出每次這個函式被
       呼叫時，三個關鍵旗標的當下狀態。
       如果戰鬥結束後這行完全不再出現，
       代表setInterval本身停了；如果有
       出現、但某個旗標卡在不該有的值，
       就能直接看出是哪個旗標的問題。
    */

    addBattleLog(
        "runAutoPatrolCheck，"+
        "autoPatrolEnabled="+
        autoPatrolEnabled+
        "，battleActive="+
        battleActive+
        "，patrolBattleTransitionPending="+
        patrolBattleTransitionPending+
        "，mapCooldown="+
        mapCooldown
    );


    /*
       防呆：如果人已經不在地圖頁面了
       （例如手動點了離開地圖，但因為某種
       原因stopAutoPatrol()沒被呼叫到），
       這裡額外擋一次，不會在別的頁面
       憑空觸發戰鬥。

       patrolBattleTransitionPending：
       已經找到怪物、正在播1秒鐘打架特效、
       但真正的startBattle()還沒被呼叫的
       這段空檔，battleActive還是false，
       如果不額外擋一次，剛好碰上下一次
       setInterval觸發，會重複找怪物、
       重複播特效。
    */

    if(
        !autoPatrolEnabled ||
        battleActive ||
        patrolBattleTransitionPending
    ){
        return;
    }


    /*
       ★ 關鍵修正：
       mapCooldown=true 時「只能跳過本次檢查」，
       絕對不能呼叫 stopAutoPatrol()。

       如果 cooldown 沒有任何解除計時器，代表
       某條戰鬥結束路徑遺漏了解除排程；此時在
       確認已不在戰鬥、也沒有進戰鬥過渡後，
       直接清掉這個殘留旗標，避免自動巡怪永久卡住。
    */
    if(mapCooldown){

        if(!mapCooldownTimeoutId){

            mapCooldown=false;

            addBattleLog(
                "偵測到殘留mapCooldown，自動解除，巡怪繼續。"
            );

        }
        else{

            /*
               cooldown期間只是不開戰，不是停止巡怪。
               確保冷卻期間結束後仍會有下一次檢查。
            */
            scheduleAutoPatrolCheck(5000);

            return;

        }

    }


    const mapPageElement=
        $("mapPage");


    if(
        !mapPageElement ||
        !mapPageElement.classList.contains(
            "active"
        )
    ){

        stopAutoPatrol();

        return;

    }


    /*
       ★ 自動巡怪旗標仍為true時，這裡確保
       下一個5秒檢查計時器存在。
    */
    ensureAutoPatrolInterval();


    for(
        let i=0;
        i<MAX_TRAINING_MONSTERS;
        i++
    ){

        const monster=
            monsters[i];


        if(
            monster &&
            monster.alive
        ){

            /*
               ★ 修正（依照使用者要求）：
               找到怪物不再直接開戰，先播
               1秒鐘的打架特效動畫（兩張圖
               各0.5秒），播完才真正呼叫
               startBattle()——視覺上像是
               「角色巡邏途中遇到怪物、
               打起來了，畫面才切進戰鬥」。
            */

            patrolBattleTransitionPending=
                true;


            playPatrolFightAnimation(
                ()=>{

                    patrolBattleTransitionPending=
                        false;


                    /*
                       ★ 修正（依照使用者回報，
                       上一版的快速重試改過頭了）：
                       之前在這裡加了「mapCooldown
                       一解除就立刻重試」的邏輯，
                       結果變成戰鬥結束、3秒保護期
                       一過馬上又進下一場，完全沒有
                       「巡邏走5秒再遇敵」的節奏感，
                       整個5秒週期的設計等於被架空。

                       拿掉那段輪詢，改回單純：
                       這次如果被mapCooldown擋下，
                       就讓它擋下，安分等下一次
                       5秒的setInterval自然再檢查
                       一次就好，不強行插隊。
                    */

                    startBattle(i);

                    /*
                       如果這次進入戰鬥被其他保護條件擋下，
                       不能讓自動巡怪因此失去下一次檢查。
                    */
                    if(
                        autoPatrolEnabled &&
                        !battleActive
                    ){

                        scheduleAutoPatrolCheck(5000);

                    }

                }
            );

            return;

        }

    }

    /*
       這次沒有活怪可打（例如怪物正在2秒重生），
       仍然要保留下一個5秒巡怪檢查。
    */
    scheduleAutoPatrolCheck(5000);

}


/* =====================================================
   ★ 地圖重新設計：棋盤走位系統

   把地圖切成10x10的格子（每格=10%寬高），
   玩家的座標不再是任意像素/百分比，
   而是「第幾格、第幾列」這種棋盤座標。

   點擊地圖時，不再是直接把玩家瞬間貼到
   點擊的位置，而是先算出一條「一格一格走過去」
   的路徑，然後搭配CSS的0.22秒transition，
   一步一步真正走過去，看起來才像在移動，
   不是瞬間移動。

   第二角色（存在的話）不會自己走，
   是跟在第一角色後面的「跟隨方塊」，
   讀取玩家最近走過的路徑紀錄，
   慢個幾步跟過去，像跟班跟著隊長，
   不是自己亂跑的獨立角色。
===================================================== */

const MAP_GRID_SIZE=10;

let playerGridCol=5;

let playerGridRow=5;

let isPlayerWalking=false;

let playerPathHistory=[
    {col:5,row:5}
];


function percentToGridCell(x,y){

    return {

        col:
            Math.max(
                0,
                Math.min(
                    MAP_GRID_SIZE-1,
                    Math.floor(
                        x/MAP_GRID_SIZE
                    )
                )
            ),

        row:
            Math.max(
                0,
                Math.min(
                    MAP_GRID_SIZE-1,
                    Math.floor(
                        y/MAP_GRID_SIZE
                    )
                )
            )

    };

}


function gridCellToPercent(cell){

    return {

        x:
            cell.col*MAP_GRID_SIZE+
            MAP_GRID_SIZE/2,

        y:
            cell.row*MAP_GRID_SIZE+
            MAP_GRID_SIZE/2

    };

}


/*
   一步一步逼近終點的簡單路徑生成
   （這張地圖目前沒有障礙物，
   所以用最直接的「每步同時修正橫向/縱向」
   走法就夠了，斜線最短路徑，
   之後如果地圖加了障礙物要繞路，
   這個函式可以再換成正式的A*之類的演算法）。
*/

function buildGridPath(start,end){

    const path=[];

    let col=start.col;

    let row=start.row;

    let guard=0;


    while(
        (
            col!==end.col ||
            row!==end.row
        ) &&
        guard<40
    ){

        if(col<end.col){
            col++;
        }
        else if(col>end.col){
            col--;
        }


        if(row<end.row){
            row++;
        }
        else if(row>end.row){
            row--;
        }


        path.push({
            col:col,
            row:row
        });


        guard++;

    }


    return path;

}


function movePlayer(event){

    /*
       ★ mapCooldown 只用來擋「觸發新戰鬥」，
       不擋移動本身，那個判斷在
       checkMapDistance() 裡面已經有處理。
    */

    if(
        battleActive ||
        isPlayerWalking
    ){
        return;
    }


    if(
        event.target.closest(
            ".map-monster"
        )
    ){
        return;
    }


    const map =
        $("gameMap");


    const rect =
        map.getBoundingClientRect();

    /*
       螢幕 Pointer/Tou​​ch 座標先轉成
       1080×1920 虛擬遊戲座標，再做地圖判定。
       不直接把 clientX/clientY 當成遊戲座標。
    */

    const point =
        gamePointFromClient(
            event.clientX,
            event.clientY
        );

    const mapTopLeft =
        gamePointFromClient(
            rect.left,
            rect.top
        );

    const mapBottomRight =
        gamePointFromClient(
            rect.right,
            rect.bottom
        );

    const virtualMapWidth =
        mapBottomRight.x-mapTopLeft.x;

    const virtualMapHeight =
        mapBottomRight.y-mapTopLeft.y;

    let x =
        (
            point.x-mapTopLeft.x
        )/
        virtualMapWidth*
        100;


    let y =
        (
            point.y-mapTopLeft.y
        )/
        virtualMapHeight*
        100;


    x=
        Math.max(
            0,
            Math.min(
                100,
                x
            )
        );


    y=
        Math.max(
            0,
            Math.min(
                100,
                y
            )
        );


    const targetCell=
        percentToGridCell(
            x,
            y
        );


    const path=
        buildGridPath(
            {
                col:playerGridCol,
                row:playerGridRow
            },
            targetCell
        );


    if(path.length===0){
        return;
    }


    walkPlayerPath(
        path
    );

}


/*
   把整條路徑拆成一步一步走，
   每一步之間間隔240ms，
   讓玩家看得出來角色是真的在移動，
   不是瞬間貼過去。
*/

function walkPlayerPath(path){

    isPlayerWalking=true;


    let i=0;


    function stepNext(){

        if(battleActive){

            isPlayerWalking=false;

            return;

        }


        if(i>=path.length){

            isPlayerWalking=false;


            const finalPos=
                gridCellToPercent({
                    col:playerGridCol,
                    row:playerGridRow
                });


            checkMapDistance(
                finalPos.x,
                finalPos.y
            );


            return;

        }


        const cell=
            path[i++];


        playerGridCol=
            cell.col;


        playerGridRow=
            cell.row;


        const pos=
            gridCellToPercent(
                cell
            );


        const playerEl=
            $("mapPlayer");


        if(playerEl){

            playerEl.style.left=
                pos.x+"%";


            playerEl.style.top=
                pos.y+"%";

        }


        playerPathHistory.unshift({
            col:cell.col,
            row:cell.row
        });


        if(
            playerPathHistory.length>6
        ){

            playerPathHistory.pop();

        }


        updateFollowerPosition();


        setTimeout(
            stepNext,
            240
        );

    }


    stepNext();

}


/*
   ★ 第二角色跟隨方塊的位置更新。
   不是即時貼在玩家旁邊，
   而是讀「玩家幾步之前走過的位置」，
   模擬跟在後面走的感覺，
   不會跟第一角色重疊在同一格。
*/

function updateFollowerPosition(){

    if(!player2){
        return;
    }


    const followerEl=
        $("mapFollower");


    if(!followerEl){
        return;
    }


    const laggedCell=

        playerPathHistory[
            Math.min(
                2,
                playerPathHistory.length-1
            )
        ];


    if(!laggedCell){
        return;
    }


    const pos=
        gridCellToPercent(
            laggedCell
        );


    followerEl.style.left=
        pos.x+"%";


    followerEl.style.top=
        pos.y+"%";

}


/*
   ★ 更新地圖上玩家卡片、跟隨方塊的
   名字/等級/圖示顯示，
   進地圖、升級之後都要呼叫這裡刷新一次。
*/

function updateMapPlayerCard(){

    const nameEl=
        $("mapPlayerName");


    const levelEl=
        $("mapPlayerLevel");


    const iconEl=
        $("mapPlayerIcon");


    if(nameEl){

        nameEl.textContent=

            player.id||
            "玩家";

    }


    if(levelEl){

        levelEl.textContent=

            "Lv."+
            player.level;

    }


    if(iconEl){

        iconEl.textContent=

            elementDatabase[
                player.element
            ]
            ?
            elementDatabase[
                player.element
            ].icon
            :
            "";

    }


    const followerEl=
        $("mapFollower");


    const followerIdEl=
        $("mapFollowerId");


    const followerLevelEl=
        $("mapFollowerLevel");


    if(followerEl){

        followerEl.style.display=

            player2
            ?
            "flex"
            :
            "none";

    }


    if(player2){

        if(followerIdEl){

            followerIdEl.textContent=
                player2.id;

        }


        if(followerLevelEl){

            followerLevelEl.textContent=

                "Lv."+
                player2.level;

        }

    }

}


function checkMapDistance(px,py){

    if(
        battleActive ||
        mapCooldown
    ){
        return;
    }


    for(
        let i=0;
        i<MAX_TRAINING_MONSTERS;
        i++
    ){

        const monster =
            monsters[i];


        if(
            !monster ||
            !monster.alive
        ){
            continue;
        }


        const distance =
            Math.hypot(
                px-monster.x,
                py-monster.y
            );


        if(distance<16){

            startBattle(i);

            return;

        }

    }

}


/* =====================================================
   ★ 自動巡怪／地圖冷卻統一管理

   mapCooldown 是「不能立刻開下一場戰鬥」的
   保護期，不是「停止自動巡怪」。
   所有戰鬥結束路徑都透過這個函式解除，
   避免不同結算路徑各自 setTimeout 造成
   cooldown 狀態不同步。
===================================================== */

function setMapCooldown(duration){

    if(mapCooldownTimeoutId){

        clearTimeout(
            mapCooldownTimeoutId
        );

        mapCooldownTimeoutId=null;

    }


    mapCooldown=true;


    if(!duration || duration<=0){

        mapCooldown=false;

        return;

    }


    mapCooldownTimeoutId=
        setTimeout(()=>{

            mapCooldown=false;

            mapCooldownTimeoutId=null;

        },duration);

}


/*
   ★ 防呆：自動巡怪開著、已經回到地圖、
   也沒有正在戰鬥／進戰鬥過渡時，
   確保5秒巡怪計時器存在。
*/
function scheduleAutoPatrolCheck(delay=5000){

    /*
       ★ 最終修正：自動巡怪的「排程生命週期」不能依賴
       battleActive 的當下狀態。

       舊版在戰鬥期間會停止／不建立下一個 timeout，
       然後把「戰鬥結束後一定會重新排程」寄託在各個
       結算路徑上；只要其中任何一條路徑沒有重新排程，
       自動巡怪就會永久停止。

       現在改成：只要 autoPatrolEnabled=true 且仍在地圖，
       排程器本身永遠維持；戰鬥中只是 runAutoPatrolCheck
       暫時不開戰。戰鬥結束時如果重新排程，會先清掉舊的
       timeout，因此不會產生雙重巡怪。

       這不改變遊戲機制：實際尋怪仍然維持5秒一次。
    */

    if(autoPatrolTimeoutId){

        clearTimeout(
            autoPatrolTimeoutId
        );

        autoPatrolTimeoutId=
            null;

    }

    if(!autoPatrolEnabled){
        return;
    }

    const mapPageElement=
        $("mapPage");

    if(
        !mapPageElement ||
        !mapPageElement.classList.contains("active")
    ){
        return;
    }

    autoPatrolTimeoutId=
        setTimeout(()=>{

            autoPatrolTimeoutId=
                null;

            if(!autoPatrolEnabled){
                return;
            }

            const mapPage=
                $("mapPage");

            if(
                !mapPage ||
                !mapPage.classList.contains("active")
            ){
                return;
            }

            /*
               戰鬥中／進戰鬥過渡中只跳過這一次，
               不代表停止自動巡怪；callback最後仍會
               補上下一個5秒排程。
            */
            runAutoPatrolCheck();

            if(
                autoPatrolEnabled &&
                $("mapPage") &&
                $("mapPage").classList.contains("active") &&
                !autoPatrolTimeoutId
            ){
                scheduleAutoPatrolCheck(5000);
            }

        },delay);

}


/*
   相容舊程式呼叫名稱。
   現有功能仍可呼叫ensureAutoPatrolInterval()，
   但實際上改由新的自我續排機制負責。
*/
function ensureAutoPatrolInterval(){

    if(
        !autoPatrolEnabled ||
        battleActive ||
        patrolBattleTransitionPending
    ){
        return;
    }

    const mapPageElement=
        $("mapPage");

    if(
        !mapPageElement ||
        !mapPageElement.classList.contains("active")
    ){
        return;
    }

    /*
       只要沒有下一次排程，就補回5秒。
       不使用「interval handle 是否存在」判斷，
       避免handle存在但實際循環已失效的情況。
    */
    if(!autoPatrolTimeoutId){

        scheduleAutoPatrolCheck(5000);

    }

}


/* =====================================================
   開始戰鬥
===================================================== */

function startBattle(triggerIndex){

    if(
        battleActive ||
        mapCooldown
    ){

        /*
           ★ 除錯用（依照使用者回報，追蹤
           自動巡怪找到怪物、卻沒有真的
           進入戰鬥的情況）：印出是被
           battleActive還是mapCooldown
           擋下來的。
        */

        addBattleLog(
            "startBattle被擋下，"+
            "battleActive="+
            battleActive+
            "，mapCooldown="+
            mapCooldown
        );

        return;
    }


    battleActive=true;

    /*
       進入真正戰鬥時，取消上一個地圖 cooldown
       的解除排程；戰鬥期間由 battleActive 控制
       不允許再次開戰。
    */
    if(mapCooldownTimeoutId){

        clearTimeout(
            mapCooldownTimeoutId
        );

        mapCooldownTimeoutId=null;

    }

    mapCooldown=true;

    battleToken++;


    stopMonsterMovement();

    clearInterval(timerId);


    /*
       ★ 新增（依照使用者回報）：
       進入戰鬥的當下，把巡怪走路的計時器
       暫停掉——原本這個計時器完全沒有在
       進入戰鬥時停止，只是因為戰鬥畫面把
       地圖蓋住才「看不到」而已，實際上還在
       背景每2.2秒執行一次，讀秒沒有真的
       停止。戰鬥結束回到地圖時，showPage()
       裡已經會依autoPatrolEnabled重新呼叫
       startPatrolCharacterWalking()正常
       恢復，這裡只負責「進戰鬥就先暫停」
       這一半。
    */

    if(patrolWalkIntervalId){

        clearInterval(
            patrolWalkIntervalId
        );

        patrolWalkIntervalId=
            null;

    }


    /*
       ★ 修正（防呆）：
       新戰鬥開始時，強制收合任何可能殘留
       開著的子選單（例如上一場戰鬥結束時
       忘了關的物品欄選單），確保每場戰鬥
       都是乾淨的畫面開始，不會延續上一場
       殘留的UI狀態。
    */

    closeMenus();


    selectedMonster =
        triggerIndex;


    turn=1;

    actionReady=false;

    pendingAction=null;


    /*
       ★ 新戰鬥開始，清掉上一場的buff殘留
       （例如怒火不會延續到下一場戰鬥），
       防禦狀態也一併重置，避免殘留。
    */

    player.activeBuffs=[];

    player.statusEffects=[];

    player.isDefending=false;


    /*
       ★ 新增：第二角色參戰初始化。
       如果玩家已經創建第二角色，
       每場新戰鬥開始都把他的HP/SP補滿，
       並清掉上一場可能殘留的buff，
       這樣他才能真正一起上場戰鬥。
    */

    if(player2){

        const stats2=
            getPlayer2BattleStats();


        player2.hp=
            stats2.maxHP;


        player2.sp=
            stats2.maxSP;


        player2.activeBuffs=[];

        player2.statusEffects=[];

        player2.isDefending=false;

    }


    /*
       ★ 隨機決定這場戰鬥捲入幾隻怪物（1～3隻），
       觸發的那隻一定在裡面，
       其餘從「其他還活著的怪物」裡隨機抽，
       不夠隨便你抽多少就抽多少（不會硬湊）。
       沒被抽到的怪物留在地圖上原地不動，不受影響。
    */

    const alivePool =
        monsters
        .slice(
            0,
            MAX_TRAINING_MONSTERS
        )
        .map(
            (m,i)=>
                (
                    m &&
                    m.alive &&
                    i!==triggerIndex
                )
                ?
                i
                :
                null
        )
        .filter(
            i=>i!==null
        );


    for(
        let i=
            alivePool.length-1;
        i>0;
        i--
    ){

        const j =
            Math.floor(
                Math.random()*
                (i+1)
            );

        const temp =
            alivePool[i];

        alivePool[i] =
            alivePool[j];

        alivePool[j] =
            temp;

    }


    /*
       ★ 修正（依照使用者要求）：
       從冰霜山脈開始的所有區域，怪物一次
       出現的數量改成3~6隻（原本新手森林、
       荒漠地帶維持1~3隻不變，這兩區是
       比較早期、簡單的練功區，不需要
       跟著一起變動）。
    */

    const isHighTierZone=

        currentZone!=="forest"&&
        currentZone!=="desert";


    const targetGroupSize =

        isHighTierZone
        ?
        (
            3+
            Math.floor(
                Math.random()*4
            )
        )
        :
        (
            1+
            Math.floor(
                Math.random()*3
            )
        );


    const extraCount =
        Math.min(
            targetGroupSize-1,
            alivePool.length
        );


    currentBattleMonsters = [
        triggerIndex,
        ...alivePool.slice(
            0,
            extraCount
        )
    ]
    .sort(
        (a,b)=>a-b
    );


    /*
       ★ 修正（真的抓到一個bug）：
       怪物如果在上一場戰鬥中活著逃過一劫
       （沒被打死），身上殘留的燃燒/冰封狀態
       完全沒有被清掉——respawnMonsters()
       只會清「重生的怪物」的狀態，
       這隻既沒死、也沒重生，
       狀態就一路帶到下一場戰鬥，
       畫面上會看到牠平白無故裹著一層
       燃燒的橘紅色，其實是上一場戰鬥
       殘留的燃燒特效沒消掉。
       這裡在每場新戰鬥開始時，
       把這場真正捲入戰鬥的怪物
       statusEffects都重置乾淨。
    */

    currentBattleMonsters.forEach(
        i=>{

            if(monsters[i]){

                monsters[i].statusEffects=[];

            }

        }
    );


    currentBattleMonsters
    .forEach(index=>{

        const monster =
            monsters[index];

        monster.alive=true;

        monster.hp =
            monster.maxHP;

        monster.sp =
            monster.maxSP;

        /*
           ★ 清掉上一場戰鬥可能殘留的
           燃燒之類的狀態效果，
           每場戰鬥都是全新開始。
        */

        monster.statusEffects=[];

    });


    renderBattle();

    showPage("battle");


    autoBattle =
        autoConfig.enabled;


    syncBattleAutoSettings();

    updateAutoButton();


    selectBattleTarget(
        triggerIndex
    );


    clearBattleLog();


    addBattleLog(
        "戰鬥開始！"
    );


    addBattleLog(
        "敵人共有"+
        currentBattleMonsters.length+
        "隻。"
    );


    startTurn(
        battleToken
    );

}


/* =====================================================
   回合
===================================================== */

function startTurn(token){

    if(
        !battleActive ||
        token!==battleToken
    ){
        return;
    }


    /*
       ★ 除錯用（依照使用者回報，追蹤
       「連續跳兩回合」是不是還有沒堵到的
       路徑）：印出這次呼叫的呼叫者是誰、
       呼叫當下的turn數值。等這次真的抓到
       之後可以拿掉。
    */

    const startTurnCallerLine=
        (
            (new Error()).stack||
            ""
        )
        .split("\n")[2]
        ||
        "（抓不到呼叫堆疊）";


    addBattleLog(
        "startTurn被呼叫，turn="+
        turn+
        "，呼叫者："+
        startTurnCallerLine.trim()
    );


    /*
       ★ 新增（依照使用者要求）：
       每個大回合開始的時候，在戰鬥紀錄
       加一行「第X回合，開始！」，
       讓玩家清楚看到新的一輪從這裡開始，
       跟上一輪的內容有明確分隔。
    */

    addBattleLog(
        "第"+
        turn+
        "回合，開始！"
    );


    /*
       ★ 新增（依照使用者要求）：
       「戰鬥資訊」框上方那個固定顯示的
       回合數標籤，跟著這裡同步更新——
       這個標籤不是戰鬥紀錄裡會被捲動沖掉
       的一行字，是獨立的小標籤，隨時都
       看得到目前是第幾輪，兩個地方
       （戰鬥頁面/巡邏頁面）都要一起更新。
    */

    const turnIndicator=
        $("battleTurnIndicator");


    if(turnIndicator){

        turnIndicator.textContent=
            "第"+turn+"回合";

    }


    const mapTurnIndicator=
        $("mapBattleTurnIndicator");


    if(mapTurnIndicator){

        mapTurnIndicator.textContent=
            "第"+turn+"回合";

    }


    /*
       ★ 每回合開始先處理燃燒傷害跟buff持續時間，
       這樣才會有「回合制DoT」的感覺，
       而不是燃燒只套用一次就沒事了。

       如果燃燒傷害正好把最後一隻怪打死，
       要先判斷戰鬥是否結束，
       結束的話就不要再往下開新回合。
    */

    tickStatusEffects();

    tickPlayerBuffs();


    if(
        checkBattleEnd()
    ){
        return;
    }


    /*
       ★ 修正（重新設計回合制）：
       新的一個大回合開始，不是馬上排敏捷、
       馬上開打，而是先進入「宣告階段」——
       玩家角色依序選好這回合要做什麼
       （但不會馬上執行），
       全部人都選好之後，
       才會進入「結算階段」依敏捷高低真正出手。
       這裡不再直接呼叫processNextCombatant()，
       改成呼叫beginCharacterTurn()開始宣告流程。
    */

    battlePhase=
        "declare";


    activeBattleCharacterIndex=0;


    declaredCharacterIndexes=
        new Set();


    resolutionPhaseStarted=
        false;


    turnAdvancePending=
        false;


    queuedPlayerActions={};


    updateActionHudVisibility();


    beginCharacterTurn(
        token
    );

}


/*
   ★ 新增：取得目前活著、會上場的隊伍成員，
   依序（第一角色、第二角色）排列。
   第二角色不存在或已經倒下就不會出現在這裡，
   beginCharacterTurn()用這個清單判斷
   還有沒有人沒行動過。
*/

function getLivingParty(){

    const party=[
        player
    ];


    if(
        player2 &&
        player2.hp>0
    ){

        party.push(
            player2
        );

    }


    return party;

}


/*
   ★ 新增：處理「目前這個角色」的行動階段。
   跟原本startTurn()裡直接寫死操作player的邏輯
   幾乎一樣，只是換成看
   activeBattleCharacterIndex指向誰，
   輪到第二角色時，畫面上會提示、
   也會切換技能選單顯示的技能來源。
*/

function beginCharacterTurn(token){

    if(
        !battleActive ||
        token!==battleToken
    ){
        return;
    }


    /*
       ★ 修正（真正的根源修法）：
       手機瀏覽器背景執行時setTimeout不保證
       準時觸發，可能被延後、之後又跟其他
       計時器一次補發，導致這個函式被同一個
       activeBattleCharacterIndex值呼叫
       第二次。

       這裡用declaredCharacterIndexes這個Set
       擋掉重複：如果目前這個
       activeBattleCharacterIndex在這個大回合
       裡已經真正宣告過一次，代表這次呼叫是
       計時器延遲補發的重複/過期呼叫，直接
       return，不會再讓角色索引被多推進、
       不會讓autoAction()/player2AutoAction()
       被重複呼叫，也就不會再發生「其中一個
       角色的宣告被跳過」的情況。
    */

    if(
        declaredCharacterIndexes.has(
            activeBattleCharacterIndex
        )
    ){

        addBattleLog(
            "偵測到重複的"+
            "beginCharacterTurn呼叫"+
            "（activeBattleCharacterIndex="+
            activeBattleCharacterIndex+
            "已經宣告過），已擋下。"
        );

        return;

    }


    /*
       ★ 修正（重新設計回合制）：
       這個函式現在是「宣告階段」的迴圈本體，
       每次被呼叫都代表「輪到下一個角色宣告」。
       如果活著的角色都宣告完了，
       就不再等新的輸入，直接進入結算階段。
    */

    const declarationParty=
        getLivingParty();


    if(
        activeBattleCharacterIndex>=
        declarationParty.length
    ){

        startResolutionPhase(
            token
        );

        return;

    }


    /*
       ★ 到這裡代表這個索引真的要開始宣告了，
       立刻標記起來——一定要在這裡標記
       （而不是等宣告完成才標記），因為
       重複呼叫可能發生在宣告「進行中」
       的任何時間點，越早標記越能擋住
       後續的重複呼叫。
    */

    declaredCharacterIndexes.add(
        activeBattleCharacterIndex
    );


    actionReady=false;

    pendingAction=null;

    closeMenus();
    clearBattleTargetSelectionMode();


    /*
       ★ 輪到這個角色行動時，
       把他上一次設的防禦狀態清掉——
       防禦只保護到「下一次輪到自己」為止，
       現在既然輪到自己了，這次保護已經用完，
       要嘛重新選防禦、要嘛做別的事。
    */

    const currentActingCharacter=

        activeBattleCharacterIndex===1
        ?
        player2
        :
        player;


    if(currentActingCharacter){

        currentActingCharacter.isDefending=
            false;

    }


    timer=20;


    $("turnNumber")
        .textContent =
        turn;


    updateTimer();


    const isPlayer2Turn=

        activeBattleCharacterIndex===1;


    const autoOn=

        isPlayer2Turn
        ?
        autoConfig2.enabled
        :
        autoBattle;


    /*
       ★ 修正（依照使用者要求）：
       之前不管是手動還是全自動，宣告階段
       都會先顯示「輪到誰」的黃色閃爍外框，
       而且自動判斷還要等1000ms才會真正出手，
       等於全自動模式下，每個角色出手前
       都要先閃一下、等一下，看起來像是
       「還要排隊等」，不夠俐落。

       改成：只有真正需要玩家自己選擇的時候
       （這個角色不是自動），才顯示閃爍外框，
       提醒玩家該做選擇了；如果是自動角色，
       不需要這個提醒（反正也不用玩家做任何事），
       直接跳過閃爍。
    */

    if(!autoOn){

        updateActiveCharacterHighlight();

    }


    populateSkillQuickBar();


    clearInterval(timerId);


    timerId =
        setInterval(()=>{

            if(
                !battleActive ||
                token!==battleToken
            ){

                clearInterval(
                    timerId
                );

                return;

            }


            timer--;

            updateTimer();


            if(timer<=0){

                clearInterval(
                    timerId
                );

                timeoutTurn(token);

            }

        },1000);


    /*
       ★ 修正（依照使用者要求，邏輯反過來）：
       宣告階段（等玩家選擇要做什麼）
       不應該放大戰鬥紀錄，維持小小一塊就好，
       放大交給結算階段負責
       （startResolutionPhase()那邊處理），
       這裡把原本「輪到手動角色就放大」的邏輯拿掉。
    */


    if(autoOn){

        /*
           ★ 修正（依照使用者要求，加快節奏）：
           原本1000ms才會真正出手，這是專門
           留給「玩家自己選」用的思考時間，
           全自動角色不需要這個等待，
           調快到150ms（保留極短的延遲只是
           避免瞬間觸發造成的潛在時序問題，
           不是刻意留給玩家看的等待時間）。
        */

        setTimeout(()=>{

            if(
                !battleActive ||
                token!==battleToken
            ){
                return;
            }


            /*
               ★ 新增（防護網，處理「打了幾輪
               自動戰鬥突然完全卡住不動、
               但怪物還是持續出手」的問題）：

               目前找不到讓自動判斷卡住的
               確切觸發條件，但用try-catch包住
               這裡至少能確保：萬一自動判斷內部
               真的因為某種特殊資料狀態拋出例外，
               不會整個安靜卡死、什麼都不會發生——
               會把錯誤內容印在戰鬥紀錄裡讓你看到
               （之後回報給我），並且強制呼叫
               finishPlayerAction()讓戰鬥
               繼續往下走，不會卡在原地。
            */

            try{

                if(isPlayer2Turn){

                    /*
                       ★ 修正：
                       player2AutoAction()現在自己
                       會呼叫finishPlayerAction()
                       （因為它內部有好幾條不同分支，
                       各自要在正確的時機推進），
                       這裡不能再額外呼叫一次，
                       不然會變成同一個行動
                       被結束兩次，角色索引錯亂、
                       直接跳過下一位。
                    */

                    player2AutoAction(
                        token
                    );

                }
                else{

                    autoAction(
                        token
                    );

                }

            }
            catch(error){

                console.error(
                    "自動判斷發生例外：",
                    error
                );

                addBattleLog(
                    "自動判斷發生例外（"+
                    (error&&error.message)+
                    "），已強制略過這回合。"
                );

                finishPlayerAction();

            }

        },150);

    }

}


/*
   ★ 新增：切換角色時，
   在畫面上高亮「目前正在行動」的那張卡，
   讓玩家清楚知道現在是誰的回合。
*/

/*
   ★ 新增：填入常駐技能快捷列的4個格子，
   內容是「目前輪到誰行動」那個角色裝備的技能，
   跟舊版openSkillMenu()彈窗的判斷邏輯一致
   （SP夠不夠、等級預覽），只是改成常駐顯示，
   不用另外點「技能」按鈕才看得到。
*/

function populateSkillQuickBar(){

    const overlay=
        $("skillQuickBar");

    if(overlay){
        overlay.classList.remove("show");
    }

    syncTurnTimerWithBattlePickers();

    const bar=
        $("skillQuickBarGrid");

    if(!bar){
        return;
    }

    const isPlayer2Turn=
        activeBattleCharacterIndex===1;

    const autoOn=
        isPlayer2Turn
        ? autoConfig2.enabled
        : autoBattle;

    if(
        !battleActive ||
        autoOn
    ){
        bar.innerHTML="";
        return;
    }

    const activeCharacterId=
        isPlayer2Turn
        ? "player2"
        : "fire";

    const activeCharacterObj=
        isPlayer2Turn
        ? player2
        : player;

    const character=
        characterSkillLoadouts[
            activeCharacterId
        ];

    if(
        !character ||
        !activeCharacterObj
    ){
        bar.innerHTML="";
        return;
    }

    bar.innerHTML="";

    for(let i=0;i<4;i++){

        const skillId=
            character.equippedSkills[i];

        const button=
            document.createElement("button");

        button.className=
            "skill-quick-button";

        if(!skillId){
            button.disabled=true;
            button.innerHTML=
                '<span class="sq-icon-wrap"></span>'+
                '<span class="sq-name">（空）</span>'+
                '<span class="sq-cost">—</span>';
            bar.appendChild(button);
            continue;
        }

        const skill=
            skillDatabase[skillId];

        if(!skill){
            button.disabled=true;
            button.innerHTML=
                '<span class="sq-icon-wrap"></span>'+
                '<span class="sq-name">資料錯誤</span>'+
                '<span class="sq-cost">—</span>';
            bar.appendChild(button);
            continue;
        }

        const skillLevel=
            getSkillLevel(
                activeCharacterId,
                skillId
            );

        const spCost=
            skill.spCost!==undefined
            ? skill.spCost
            : (skill.cost||0);

        const enoughSP=
            activeCharacterObj.sp>=spCost;

        button.disabled=!enoughSP;
        button.classList.toggle(
            "sp-insufficient",
            !enoughSP
        );

        const iconBackground=
            typeof getSkillIconBackgroundImage==="function"
            ? getSkillIconBackgroundImage(skillId)
            : "";

        let iconHTML="";

        if(iconBackground){
            iconHTML=
                '<span class="sq-icon-image" style="background-image:'+
                iconBackground+
                ';"></span>';
        }
        else{
            const fallback=
                typeof getElementIconHTML==="function"
                ? getElementIconHTML(skill.element)
                : "";

            iconHTML=
                '<span class="sq-icon-fallback">'+
                fallback+
                '</span>';
        }

        button.innerHTML=
            '<span class="sq-icon-wrap">'+
                iconHTML+
                (
                    enoughSP
                    ? ""
                    : '<span class="sq-sp-block">SP不足</span>'
                )+
            '</span>'+
            '<span class="sq-name">'+
                skill.name+
                (skillLevel>0 ? " Lv."+skillLevel : "")+
            '</span>'+
            '<span class="sq-cost">消耗 '+
                spCost+
                ' SP</span>';

        if(enoughSP){
            button.onclick=()=>{
                prepareAction(skillId);
            };
        }

        bar.appendChild(button);
    }
}


/*
   ★ 新增（依照使用者要求）：
   技能格改成非常駐顯示，平常收起來，
   按「✨ 技能」按鈕才會出現，
   出現時蓋住上面那排戰鬥指令按鈕；
   再按一次（或按右上角✕）就收合回去。
*/

function syncTurnTimerWithBattlePickers(){

    const skillOverlay=$("skillQuickBar");
    const itemOverlay=$("itemMenu");
    const turnRow=$("turnTargetRow");

    if(!turnRow){
        return;
    }

    const skillOpen=!!(
        skillOverlay &&
        skillOverlay.classList.contains("show")
    );

    const itemOpen=!!(
        itemOverlay &&
        itemOverlay.classList.contains("show")
    );

    turnRow.classList.toggle(
        "skill-picker-open",
        skillOpen && !itemOpen
    );

    turnRow.classList.toggle(
        "battle-item-open",
        itemOpen
    );
}


function toggleSkillQuickBar(){

    const overlay=
        $("skillQuickBar");


    if(!overlay){
        return;
    }


    const grid=
        $("skillQuickBarGrid");


    /*
       如果目前是空的（例如還沒輪到玩家、
       或是自動戰鬥開啟中，populateSkillQuickBar()
       沒有填入任何按鈕），就不要打開一個
       空空的覆蓋層。
    */

    if(
        !overlay.classList.contains("show") &&
        grid &&
        grid.innerHTML.trim()===""
    ){
        return;
    }


    overlay.classList.toggle(
        "show"
    );

    syncTurnTimerWithBattlePickers();

}


function getBattleActionDisplayName(actionType){

    if(actionType==="normal"){
        return "普通攻擊";
    }

    const skill=
        skillDatabase[actionType];

    return (
        skill && skill.name
        ? skill.name
        : actionType
    );
}


function setBattleTargetSelectionMode(actionType){

    const region=
        $("battleActionRegion");

    const promptAction=
        $("battleTargetPromptAction");

    if(region){
        region.classList.add(
            "target-selecting"
        );
    }

    if(promptAction){
        promptAction.textContent=
            "選擇 ["+
            getBattleActionDisplayName(actionType)+
            "]";
    }

    currentBattleMonsters.forEach(index=>{
        const monster=monsters[index];
        const card=$("battleMonster"+index);

        if(card){
            card.classList.toggle(
                "targetable",
                !!(monster && monster.alive)
            );
        }
    });

    const targetText=
        $("battleTarget");

    if(targetText){
        targetText.textContent=
            "目標：請選擇";
    }
}


function clearBattleTargetSelectionMode(){

    const region=$("battleActionRegion");

    if(region){
        region.classList.remove("target-selecting");
    }

    document
        .querySelectorAll(
            ".battle-monster.targetable, .battle-monster.target, "+
            ".battle-player.ally-targetable, .battle-player.ally-target"
        )
        .forEach(card=>{
            card.classList.remove(
                "targetable",
                "target",
                "ally-targetable",
                "ally-target"
            );
        });
}



/* =====================================================
   V119 — 我方單體技能目標選擇
   治療術／復活術／隱身術／萬象土盾／結界使用現有玩家卡片選人，
   不再寫死只對角色一號自己生效。全體技能仍直接宣告，不多一步選擇。
===================================================== */
function getBattleCharacterByIndex(index){
    if(index===0){ return player; }
    if(index===1){ return player2; }
    return null;
}

function isValidAllyTargetForSkill(skill,character,index){
    if(!skill || !character){ return false; }

    if(skill.targetType==="deadAlly"){
        /* 主角死亡會立即戰敗，目前能復活的場上對象是其他隊友。 */
        return index!==0 && character.hp<=0;
    }

    return character.hp>0;
}

function setBattleAllyTargetSelectionMode(actionType){
    const skill=skillDatabase[actionType];
    const region=$("battleActionRegion");
    const promptAction=$("battleTargetPromptAction");

    if(region){ region.classList.add("target-selecting"); }

    if(promptAction){
        promptAction.textContent="選擇 ["+getBattleActionDisplayName(actionType)+"] 的我方目標";
    }

    currentBattleMonsters.forEach(index=>{
        const card=$("battleMonster"+index);
        if(card){ card.classList.remove("targetable","target"); }
    });

    [0,1].forEach(index=>{
        const character=getBattleCharacterByIndex(index);
        const card=$("battlePlayerCard"+index);
        if(card){
            card.classList.toggle(
                "ally-targetable",
                isValidAllyTargetForSkill(skill,character,index)
            );
        }
    });

    const targetText=$("battleTarget");
    if(targetText){ targetText.textContent="目標：請選擇我方角色"; }
}

function selectBattleAllyTarget(index){
    if(
        !battleActive ||
        battlePhase!=="declare" ||
        !actionReady ||
        !pendingAction
    ){
        return;
    }

    const skill=skillDatabase[pendingAction];
    const character=getBattleCharacterByIndex(index);

    if(
        !skill ||
        !(skill.targetType==="ally" || skill.targetType==="deadAlly") ||
        !isValidAllyTargetForSkill(skill,character,index)
    ){
        return;
    }

    const action=pendingAction;
    actionReady=false;
    pendingAction=null;

    clearBattleTargetSelectionMode();

    queuedPlayerActions[activeBattleCharacterIndex]={…62924 tokens truncated…
        const shieldAmount=
            skill.selfShieldByLevel[
                level-1
            ];


        player2.activeBuffs=
            (player2.activeBuffs||[])
            .filter(
                b=>b.type!=="shield"
            );


        player2.activeBuffs.push({
            type:"shield",
            turnsLeft:
                skill.shieldDuration||2,
            remaining:
                shieldAmount

        });


        addBattleLog(
            ""+
            player2.id+
            "獲得"+
            shieldAmount+
            "點護盾，持續"+
            (skill.shieldDuration||2)+
            "回合。"
        );

    }


    if(skill.allyShieldByLevel){

        const shieldAmount=
            skill.allyShieldByLevel[
                level-1
            ];


        getCharacters().forEach(
            character=>{

                if(
                    character.hp<=0
                ){
                    return;
                }


                character.activeBuffs=
                    (character.activeBuffs||[])
                    .filter(
                        b=>b.type!=="shield"
                    );


                character.activeBuffs.push({
                    type:"shield",
                    turnsLeft:
                        skill.shieldDuration||2,
                    remaining:
                        shieldAmount

                });

            }
        );


        addBattleLog(
            "我方全體獲得"+
            shieldAmount+
            "點護盾，持續"+
            (skill.shieldDuration||2)+
            "回合。"
        );

    }


    updateUI();

    finishPlayerAction();

}


/* =====================================================
   V92 — 怪物金幣掉落
   基礎值跟怪物等級成長；精英/BOSS提高倍率，並保留少量隨機浮動。
===================================================== */

function getMonsterGoldDrop(monster){
    if(!monster){
        return 0;
    }

    const level=Math.max(1,Math.floor(Number(monster.level)||1));
    const rank=getMonsterRank(monster);
    const rankMultiplier=
        rank==="boss"
        ? 8
        : rank==="elite"
        ? 3
        : 1;

    const base=level*2+3;
    const variance=0.85+Math.random()*0.30;

    return Math.max(
        1,
        Math.floor(base*rankMultiplier*variance)
    );
}

function awardMonsterGoldDrop(monster){
    const amount=getMonsterGoldDrop(monster);

    if(amount<=0){
        return 0;
    }

    gold+=amount;
    updateGoldDisplay();

    addBattleLog(
        monster.name+
        "掉落 "+
        amount+
        " 金幣。"
    );

    return amount;
}


/* =====================================================
   怪物死亡
===================================================== */

function killMonster(index){

    const monster =
        monsters[index];


    if(
        !monster ||
        !monster.alive
    ){
        return;
    }


    monster.alive=false;

    monster.hp=0;

    monster.sp=0;


    const card =
        $("battleMonster"+index);


    if(card){

        /*
           ★ 修正：
           原本一擊殺死怪物的當下，
           立刻把.dead這個class（opacity:.16）
           加上去，但傷害浮動數字是這張卡片
           的「子元素」，opacity會直接連帶
           把還在飄的傷害數字一起變暗，
           剛好打死的那一下反而最不容易看清楚傷害。

           改成先加.dying（只擋點擊，不變暗），
           等傷害數字動畫（1.8秒）跑完之後
           才真正加上.dead讓卡片變暗，
           兩者順序對調就不會互相影響了。
        */

        card.classList.add(
            "dying"
        );


        setTimeout(()=>{

            card.classList.remove(
                "dying"
            );

            card.classList.add(
                "dead"
            );

        },1850);

    }


    /*
       ★ 怪物死亡後也要在地圖上隱藏，
       避免回到地圖時看到已死怪物的圖示。
    */

    const mapIcon =
        $("mapMonster"+index);


    if(mapIcon){

        mapIcon.style.display =
            "none";

    }


    addBattleLog(

        ""+
        monster.name+
        "被擊敗。"

    );


    /*
       ★ 新增（依照使用者要求，主城圖鑑/
       每日任務/成就系統）：
       這裡是「怪物真的被打死」唯一會經過
       的地方，圖鑑的擊殺數、每日任務的
       擊敗怪物進度、成就的累計擊殺數，
       全部在這裡一次記錄，不用在戰鬥的
       每個分支各自重複判斷一次。
    */

    recordMonsterKillForBestiary(
        monster
    );


    awardMonsterGoldDrop(
        monster
    );


    /* 怪物掉落與擊殺進度一起即時存檔，避免中途戰敗/切背景遺失。 */
    saveGame();


    updateMonsterUI(index);

}


/* =====================================================
   戰鬥畫面
===================================================== */

function renderBattle(){

    const area =
        $("battleMonsterArea");


    area.innerHTML="";


    currentBattleMonsters
    .forEach(
        index=>{

            const monster =
                monsters[index];


            const card =
                document.createElement(
                    "div"
                );


            card.id =
                "battleMonster"+index;


            card.className =
                "battle-monster";


            card.onclick=()=>{
                selectBattleTarget(
                    index
                );
            };


            const icon =
                monster.name==="史萊姆"
                ?
                ""
                :
                monster.name==="沙漠豺狼"
                ?
                ""
                :
                monster.name==="沙蠍"
                ?
                ""
                :
                "";


            card.innerHTML =

            `
            <div
                id="battleMonsterFreezeOverlay${index}"
                class="card-status-overlay freeze-overlay"
            ></div>

            <div
                id="battleMonsterBurnOverlay${index}"
                class="card-status-overlay burn-overlay"
            ></div>

            <div class="battle-monster-icon">
                ${icon}
            </div>

            <div class="battle-monster-name">
                ${monster.name}
            </div>

            <div class="battle-monster-level">
                Lv.${monster.level}
            </div>

            <div
                id="battleMonsterStatus${index}"
                class="monster-status-badges"
            ></div>

            <div class="monster-hp">

                <div
                    id="battleMonsterBar${index}"
                    class="monster-hp-inner"
                ></div>

                <div
                    id="battleMonsterHPText${index}"
                    class="monster-bar-text"
                ></div>

            </div>

            <div class="monster-sp">

                <div
                    id="battleMonsterSPBar${index}"
                    class="monster-sp-inner"
                ></div>

                <div
                    id="battleMonsterSPText${index}"
                    class="monster-bar-text"
                ></div>

            </div>
            `;


            area.appendChild(
                card
            );

        }
    );


    currentBattleMonsters
    .forEach(
        index=>{
            updateMonsterUI(index);
        }
    );


    renderPlayers();


    /*
       ★ 重新加回來（依照使用者指正，這是對的）：
       之前這套「JS直接量測、強制撐滿」的做法
       其實是已經驗證過準確的（曾經量到過
       正確的差距數字），拿掉是判斷錯誤——
       CSS的flex-grow在使用者的實際測試環境下
       一直不夠可靠，與其繼續信任CSS去猜，
       不如信任這個已經證實準確的量測方式，
       用實際量到的數字直接強制設定高度，
       確保戰鬥紀錄一定會貼滿到該到的地方。
    */

    /* V96：戰鬥資訊高度由 Flex 決定，不再排程二次 JS 量測。 */

}


/*
   ★ 重新加回來：量測.battle-info目前的下緣，
   跟畫面實際可視範圍下緣之間還差多少，
   直接把差距加回.battle-info的高度上，
   強制貼滿，不再單純依賴CSS flex-grow
   是否有確實生效。
*/

function fillBattleInfoGap(){
    /* V96 compatibility stub：舊函式名稱保留，避免其他舊程式參照時報錯。
       實際高度完全交給 CSS Flex，不再讀 visualViewport、不再寫 inline height。 */
}


/*
   ★ 修正（拿掉整套JS強制補高的機制）：
   這一整套「量測、補高、監聽視窗變化、
   定時重新檢查」的做法，是之前為了解決
   戰鬥紀錄下方空白反覆嘗試的其中一種手法，
   但這幾輪在使用者實際測試環境下一直沒有
   穩定生效，反而增加了程式碼複雜度、
   也讓每次updateUI()都要多做一次量測運算。

   現在改用更根本的做法：讓.turn-target-row
   （回合資訊區塊）本身就是「有多少剩餘空間
   就自動長多大」的區塊，不再需要另外用JS
   去量測、去補，這整段程式碼已經不需要了。
*/

function updateMonsterUI(index){

    const monster =
        monsters[index];


    if(!monster){
        return;
    }


    /*
       ★ 新增：燃燒狀態圖示。
       之前燃燒只有在扣血那一刻的戰鬥紀錄裡看得到，
       持續期間卡片上完全沒有任何提示，
       玩家看不出「這隻現在正在燒」。
       改成只要monster.statusEffects裡有燃燒，
       卡片上就會一直顯示一個閃爍的🔥圖示，
       直到燃燒結束才消失。
    */

    const statusArea =
        $("battleMonsterStatus"+index);


    if(statusArea){

        const hasBurn =
            monster.statusEffects &&
            monster.statusEffects.some(
                effect=>
                    effect.type==="burn"
            );


        const hasFreeze =
            isMonsterFrozen(
                monster
            );


        /*
           ★ 新增（依照使用者要求）：
           石化跟四種簡單減益效果，也一併
           顯示小圖示，玩家才看得出這隻怪物
           身上現在掛著哪些效果，不用只能
           從戰鬥紀錄裡回頭找。
        */

        const hasPetrify=

            monster.statusEffects &&
            monster.statusEffects.some(
                effect=>

                    effect.type==="petrify"&&
                    effect.turnsLeft>0

            );


        const hasAgilityDown=

            getMonsterDebuffValue(
                monster,
                "agilityDown"
            )>0;


        const hasStatDown=

            getMonsterDebuffValue(
                monster,
                "statDown"
            )>0;


        const hasDefenseDown=

            getMonsterDebuffValue(
                monster,
                "defenseDown"
            )>0;


        const hasDamageDown=

            getMonsterDebuffValue(
                monster,
                "damageDown"
            )>0;


        const hasStun=

            getMonsterDebuffValue(
                monster,
                "stun"
            )>0;


        statusArea.innerHTML =

            (
                hasBurn
                ?
                '<span class="monster-status-badge burn"title="燃燒中"></span>'
                :
                ""
            )+
            (
                hasFreeze
                ?
                '<span class="monster-status-badge freeze"title="冰封中"></span>'
                :
                ""
            )+
            (
                hasPetrify
                ?
                '<span class="monster-status-badge"title="石化中"></span>'
                :
                ""
            )+
            (
                hasAgilityDown
                ?
                '<span class="monster-status-badge"title="敏捷降低中"></span>'
                :
                ""
            )+
            (
                hasStatDown
                ?
                '<span class="monster-status-badge"title="全屬性降低中"></span>'
                :
                ""
            )+
            (
                hasDefenseDown
                ?
                '<span class="monster-status-badge"title="防禦降低中"></span>'
                :
                ""
            )+
            (
                hasDamageDown
                ?
                '<span class="monster-status-badge"title="傷害降低中"></span>'
                :
                ""
            )+
            (
                hasStun
                ?
                '<span class="monster-status-badge"title="暈眩中"></span>'
                :
                ""
            );


        /*
           ★ 新增：整張卡片的冰封/燃燒包覆效果，
           跟上面小圖示同步開關。
        */

        const freezeOverlay=
            $("battleMonsterFreezeOverlay"+index);


        const burnOverlay=
            $("battleMonsterBurnOverlay"+index);


        if(freezeOverlay){

            freezeOverlay.classList.toggle(
                "show",
                hasFreeze
            );

        }


        if(burnOverlay){

            burnOverlay.classList.toggle(
                "show",
                hasBurn
            );

        }

    }


    const hpBar =
        $("battleMonsterBar"+index);


    const spBar =
        $("battleMonsterSPBar"+index);


    const hpText =
        $("battleMonsterHPText"+index);


    const spText =
        $("battleMonsterSPText"+index);


    if(hpBar){

        hpBar.style.width =
            (
                monster.hp/
                monster.maxHP*
                100
            )+
            "%";

    }


    if(spBar){

        spBar.style.width =
            (
                monster.sp/
                monster.maxSP*
                100
            )+
            "%";

    }


    if(hpText){

        hpText.textContent =
            monster.hp+
            "/"+
            monster.maxHP;

    }


    if(spText){

        spText.textContent =
            monster.sp+
            "/"+
            monster.maxSP;

    }

}


function renderPlayers(){

    const row =
        $("battlePlayerRow");


    row.innerHTML="";


    /*
       ★ 修正：
       原本這裡固定只畫第一角色一張卡，
       現在player2存在的話會一起畫出來，
       每張卡的內部元件id都加上索引
       （0=第一角色、1=第二角色），
       避免兩張卡的血條/狀態圖示id互相打架。
    */

    const party = [

        {
            character:player,

            id:
                player.id||
                "主角",

            icon:
                elementDatabase[
                    player.element
                ].icon,

            level:
                player.level
        }

    ];


    if(player2){

        party.push({

            character:player2,

            id:player2.id,

            icon:
                elementDatabase[
                    player2.element
                ]
                ?
                elementDatabase[
                    player2.element
                ].icon
                :
                "",

            level:
                player2.level

        });

    }


    party.forEach((entry,index)=>{

        const box =
            document.createElement(
                "div"
            );


        box.className =
            "battle-player";


        box.id=
            "battlePlayerCard"+
            index;


        box.innerHTML =

        `
        <div class="battle-player-icon">
            ${entry.icon}
        </div>

        <div
            id="battlePlayerStatus${index}"
            class="monster-status-badges"
        ></div>

        <div class="hp-bar">

            <div
                id="battlePlayerHPBar${index}"
                class="hp-bar-inner"
            ></div>

            <div class="hp-bar-text"></div>

        </div>

        <div class="sp-bar">

            <div
                id="battlePlayerSPBar${index}"
                class="sp-bar-inner"
            ></div>

            <div class="sp-bar-text"></div>

        </div>

        <div class="battle-player-id"></div>
        `;


        /*
           ★ 修正（依照使用者要求）：
           等級原本獨立一行顯示在上方，
           現在改成跟底部的id合併成一行
           「角色名 Lv.X」，
           省下一行的高度，
           讓卡片下半部的資訊列可以更精簡。
        */

        box.querySelector(
            ".battle-player-id"
        ).textContent =

            entry.id+
            "Lv."+
            entry.level;


        box.addEventListener(
            "click",
            ()=>{
                if(box.classList.contains("ally-targetable")){
                    selectBattleAllyTarget(index);
                }
            }
        );


        row.appendChild(
            box
        );

    });


    updatePlayerStatusBadges();

}


/*
   ★ 玩家自己身上的buff狀態圖示
   （目前只有怒火），
   跟怪物的燃燒圖示是同一套邏輯，
   有生效中的buff就一直顯示，結束才消失。
*/

function updatePlayerStatusBadges(){

    /*
       ★ 修正：
       原本這裡只更新一張卡（固定id），
       現在改成同時更新第一角色跟第二角色
       （存在的話）各自的buff圖示。
    */

    updateSingleCharacterStatusBadge(
        0,
        player
    );


    if(player2){

        updateSingleCharacterStatusBadge(
            1,
            player2
        );

    }

}


function updateSingleCharacterStatusBadge(
    index,
    character
){

    const statusArea =
        $("battlePlayerStatus"+index);


    if(!statusArea){
        return;
    }


    const rageBuff =
        (character.activeBuffs||[])
        .find(
            b=>b.type==="rage"
        );


    statusArea.innerHTML =

        rageBuff
        ?
        '<span class="monster-status-badge rage"title="怒火生效中"></span>'
        :
        "";

}


function updateBattlePlayerBars(){

    updatePlayerStatusBadges();


    /*
       ★ 修正：
       原本這裡只更新第一角色的血條，
       而且hpText/spText是用
       document.querySelector(".hp-bar-text")
       去全域找第一個符合的元素，
       就算加了第二張卡也永遠抓到同一個。
       改成分別更新兩張卡各自的血條，
       文字元素也改成在該張卡的範圍內找，
       不會抓錯。
    */

    updateSingleCharacterBars(
        0,
        player,
        getMainCharacterStats()
    );


    if(player2){

        updateSingleCharacterBars(
            1,
            player2,
            getPlayer2BattleStats()
        );

    }

}


function updateSingleCharacterBars(
    index,
    character,
    stats
){

    const card=
        $("battlePlayerCard"+index);


    if(!card){
        return;
    }


    /*
       ★ 新增（依照使用者要求，「活著要亮，
       死亡才暗」）：
       每次血條更新的時候，順便檢查角色是否
       已經倒下（hp<=0），是的話加上.down
       讓卡片變暗，活著就把.down拿掉維持
       原本亮度。這個函式本來就是唯一負責
       同步「畫面血條」跟「角色實際hp」的
       地方，卡片的明暗其實也是同一件事的
       延伸（都是把hp狀態反映到畫面上），
       放在這裡一起處理，不用另外找地方
       重複判斷character.hp<=0。
    */

    card.classList.toggle(
        "down",
        character.hp<=0
    );


    const hpBar =
        $("battlePlayerHPBar"+index);


    const spBar =
        $("battlePlayerSPBar"+index);


    if(hpBar){

        hpBar.style.width =
            Math.max(
                0,
                Math.min(
                    100,
                    character.hp/
                    stats.maxHP*
                    100
                )
            )+
            "%";

    }


    if(spBar){

        spBar.style.width =
            Math.max(
                0,
                Math.min(
                    100,
                    character.sp/
                    stats.maxSP*
                    100
                )
            )+
            "%";

    }


    const hpText =
        card.querySelector(
            ".hp-bar-text"
        );


    const spText =
        card.querySelector(
            ".sp-bar-text"
        );


    if(hpText){

        hpText.textContent =
            character.hp+
            "/"+
            stats.maxHP;

    }


    if(spText){

        spText.textContent =
            character.sp+
            "/"+
            stats.maxSP;

    }

}


function triggerCriticalImpact(element){

    if(!element){
        return;
    }

    element.classList.remove("critical-impact");
    void element.offsetWidth;
    element.classList.add("critical-impact");

    setTimeout(()=>{
        element.classList.remove("critical-impact");
    },520);
}


function showDamagePopup(element,text,type,isCrit){

    if(!element){
        return;
    }


    const popup =
        document.createElement(
            "div"
        );


    popup.className =
        /*
           ★ 修正（依照使用者回報，「損失
           血量顯示變成在血條下面」）：
           真正原因找到了——這裡少打了
           空格，"damage-popup"直接接
           "hp-popup"變成
           "damage-popuphp-popup"這種
           class屬性根本不存在的字串，
           .damage-popup那組CSS（position:
           absolute;top:26%……原本設計
           成飄在卡片中段、技能名稱跟血條
           中間）完全沒套用到，popup變成
           一個沒有任何定位樣式的普通
           <div>，只能乖乖排在appendChild()
           放進去的地方，也就是卡片最下面、
           血條/SP條/名稱都排完之後。
           每個class之間都補上空格，
           跟前面「技能按鈕整個不能點」
           是同一種typo，這已經是這個
           檔案裡第三次抓到同樣的漏字
           bug了。
        */

        "damage-popup "+
        (
            type==="sp"
            ?
            "sp-popup"
            :
            type==="heal"
            ?
            "heal-popup"
            :
            type==="miss"
            ?
            "miss-popup"
            :
            "hp-popup"
        )+
        (
            isCrit
            ?
            " critical-popup"
            :
            ""
        );


    if(isCrit){
        /* V100：爆擊浮字只保留「爆擊 + 傷害數字」。
           showPlayerHit/showMonsterHit 傳進來的 text 可能含 -、HP/SP，
           這裡只抽出數字做顯示；不影響實際傷害值。 */
        const criticalNumberMatch =
            String(text).match(/\d+(?:\.\d+)?/);

        popup.textContent =
            "爆擊 "+
            (criticalNumberMatch ? criticalNumberMatch[0] : String(text));
    }else{
        popup.textContent = text;
    }


    if(isCrit){
        triggerCriticalImpact(element);
    }


    element.appendChild(
        popup
    );


    setTimeout(()=>{

        if(
            popup &&
            popup.parentNode
        ){

            popup.parentNode.removeChild(
                popup
            );

        }

    },1800);

}


/*
   ★ 新增（依照使用者要求）：
   冰旋一閃專屬的飛行圖示，使用者上傳的
   圖片直接轉成base64內嵌在這裡，
   跟角色圖片（battlePlayerCard0/1的
   background-image）用同一種做法——
   單一HTML檔案不依賴外部圖片檔案，
   複製這個檔案到別的地方也不會有
   圖片路徑失效、圖片消失的問題。
*/

const ICE_SPIN_PROJECTILE_IMAGE=
    "assets/battle/ice-spin-projectile.webp";


/*
   ★ 新增（依照使用者要求，冰旋一閃專屬
   攻擊動畫）：
   讓上面那張圖從施法者卡片飛到被打中的
   怪物卡片，中途旋轉、放大，抵達時淡出，
   當成這個技能的攻擊特效。

   跟showSkillNameBadge()一樣掛在
   document.body底下、用getBoundingClientRect()
   量座標，不當卡片的子元素，避免被卡片
   自己的transform動畫困住（原因見
   showSkillNameBadge()旁邊的說明）。

   casterCharacterIndex：0=第一角色、
   1=第二角色，決定飛行起點是哪張玩家卡。
   targetMonsterIndex：飛行終點是哪隻怪物卡。

   只負責「畫面上飛一下」，不做任何傷害/
   命中判定，呼叫端該打MISS還是該扣血，
   跟這個函式完全無關，兩件事分開處理。
*/

function playIceSpinProjectile(
    casterCharacterIndex,
    targetMonsterIndex
){

    const casterCard=
        $("battlePlayerCard"+
            casterCharacterIndex
        );


    const targetCard=
        $("battleMonster"+
            targetMonsterIndex
        );


    if(
        !casterCard ||
        !targetCard
    ){
        return;
    }


    const casterRect=
        casterCard.getBoundingClientRect();


    const targetRect=
        targetCard.getBoundingClientRect();


    const projectile=
        document.createElement(
            "img"
        );


    projectile.src=
        ICE_SPIN_PROJECTILE_IMAGE;

    projectile.className=
        "ice-spin-projectile";

    const startPoint =
        gamePointFromClient(
            casterRect.left+
            casterRect.width/2,
            casterRect.top+
            casterRect.height/2
        );

    const endPoint =
        gamePointFromClient(
            targetRect.left+
            targetRect.width/2,
            targetRect.top+
            targetRect.height/2
        );

    projectile.style.left=
        startPoint.x+"px";

    projectile.style.top=
        startPoint.y+"px";

    const overlayLayer =
        $("game-overlay-layer") ||
        document.getElementById("game-stage");

    overlayLayer.appendChild(
        projectile
    );


    /*
       ★ 強制觸發reflow：
       起點的left/top剛設定完，瀏覽器還沒
       真正畫出這一幀，如果馬上在同一輪
       事件循環裡把left/top改成終點座標，
       transition會直接跳過去、看不到飛行
       過程。用void projectile.offsetWidth
       強迫瀏覽器先算一次目前的版面，
       確認「起點」已經生效，接下來
       requestAnimationFrame裡改成終點座標
       才會真的觸發transition動畫。
    */

    void projectile.offsetWidth;


    requestAnimationFrame(()=>{

        projectile.style.left=
            endPoint.x+"px";

        projectile.style.top=
            endPoint.y+"px";

        projectile.classList.add(
            "arrived"
        );

    });


    setTimeout(()=>{

        if(
            projectile &&
            projectile.parentNode
        ){

            projectile.parentNode.removeChild(
                projectile
            );

        }

    },500);

}


/*
   ★ 新增（依照使用者要求，火箭技能的
   三發飛行特效，純CSS/JS動畫）：
   sourceCardId是施法者的卡片DOM id
   （例如"battlePlayerCard0"），
   targetIndexes是這次火箭實際打中的
   怪物索引陣列（最多3個，對應中/左/右）。

   每一發火箭：
   1. 從施法者卡片中心出發，用
      element.animate()（Web Animations
      API）飛向目標卡片中心，飛行過程中
      本體會依飛行方向自動旋轉，看起來
      像真的朝目標飛過去，不是死板地
      平移。
   2. 到達的瞬間，火箭本體消失，原地
      炸開一小群火花粒子（8顆，各自往
      不同角度噴射再淡出）。
   3. 三發之間故意加一點點時間差
      （每發間隔80ms才發射），不會三發
      看起來像同一發複製貼上，比較有
      「連續發射」的節奏感。

   所有動態生成的DOM元素動畫播完都會
   自己移除，不會留在畫面上累積。
*/

/*
   ★ 修正（依照使用者要求，怪物用火箭
   攻擊玩家時也要有同樣的飛行特效）：
   原本這裡只接受「怪物索引陣列」，
   寫死組出"battleMonster"+index去找
   目標元素，只能用在「玩家射怪物」這個
   方向。改成直接接受「目標DOM id的陣列」，
   打玩家（"battlePlayerCard"+index）
   跟打怪物（"battleMonster"+index）
   兩種方向都能共用同一套動畫邏輯，不用
   寫兩份幾乎一樣的程式碼。
*/

function playFireRocketAnimation(
    sourceCardId,
    targetElementIds
){

    const sourceEl=
        $(sourceCardId);


    if(!sourceEl){
        return;
    }


    const sourceRect=
        sourceEl.getBoundingClientRect();

    const sourcePoint =
        gamePointFromClient(
            sourceRect.left+
            sourceRect.width/2,
            sourceRect.top+
            sourceRect.height/2
        );

    const startX =
        sourcePoint.x;

    const startY =
        sourcePoint.y;


    targetElementIds.forEach(
        (targetElementId,i)=>{

            setTimeout(()=>{

                fireOneRocket(
                    startX,
                    startY,
                    targetElementId
                );

            },i*80);

        }
    );

}


function fireOneRocket(
    startX,
    startY,
    targetElementId
){

    const targetEl=
        $(targetElementId);


    if(!targetEl){
        return;
    }


    const targetRect=
        targetEl.getBoundingClientRect();

    const targetPoint =
        gamePointFromClient(
            targetRect.left+
            targetRect.width/2,
            targetRect.top+
            targetRect.height/2
        );

    const endX =
        targetPoint.x;

    const endY =
        targetPoint.y;


    const angleDeg=

        Math.atan2(
            endY-startY,
            endX-startX
        )*
        180/Math.PI;


    const rocket=
        document.createElement("div");

    rocket.className=
        "fire-rocket-projectile";

    rocket.style.left=
        startX+"px";

    rocket.style.top=
        startY+"px";

    rocket.style.transform=

        "translate(-50%,-50%) rotate("+
        angleDeg+
        "deg)";


    const overlayLayer =
        $("game-overlay-layer") ||
        document.getElementById("game-stage");

    overlayLayer.appendChild(
        rocket
    );


    const flightMs=
        420;


    const anim=

        rocket.animate(
            [
                {
                    left:startX+"px",
                    top:startY+"px",
                    offset:0
                },
                {
                    left:endX+"px",
                    top:endY+"px",
                    offset:1
                }
            ],
            {
                duration:flightMs,
                easing:"ease-in"
            }
        );


    anim.onfinish=()=>{

        rocket.remove();


        spawnFireSparkBurst(
            endX,
            endY
        );

    };

}


function spawnFireSparkBurst(
    x,
    y
){

    const sparkCount=
        8;


    for(
        let i=0;
        i<sparkCount;
        i++
    ){

        const spark=
            document.createElement("div");

        spark.className=
            "fire-rocket-spark";

        spark.style.left=
            x+"px";

        spark.style.top=
            y+"px";


        document.body.appendChild(
            spark
        );


        const angle=

            (
                Math.PI*2*i/
                sparkCount
            )+
            (Math.random()*0.5);


        const distance=

            18+
            Math.random()*16;


        const spread=

            spark.animate(
                [
                    {
                        left:x+"px",
                        top:y+"px",
                        opacity:1,
                        offset:0
                    },
                    {
                        left:
                            (
                                x+
                                Math.cos(angle)*distance
                            )+"px",
                        top:
                            (
                                y+
                                Math.sin(angle)*distance
                            )+"px",
                        opacity:0,
                        offset:1
                    }
                ],
                {
                    duration:380,
                    easing:"ease-out"
                }
            );


        spread.onfinish=()=>{

            spark.remove();

        };

    }

}


function showSkillNameBadge(skillName,elementType,characterIndex){

    const element =
        $("battlePlayerCard"+
            (characterIndex||0)
        );


    if(!element){
        return;
    }


    /*
       ★ 修正（真正解決「文字會先被蓋住、
       又跳到最前面」的根本原因）：
       之前把文字元素直接塞進角色卡片裡面
       當子元素。但角色卡片攻擊的瞬間會播放
       「前傾」動畫（transform位移），
       CSS規則：任何有作用中transform的元素，
       會建立一個新的疊放層，把它所有子元素的
       疊放順序關進這個局部範圍裡——不管子元素
       的z-index設多高，都跳不出這個範圍去跟
       外面的東西比較。技能名稱文字剛好是卡片的
       子元素，卡片剛好在攻擊瞬間有transform在跑，
       這就是不管z-index設多高都沒用的真正原因。

       改成不再當卡片的子元素，直接掛到
       document.body底下（不會被任何動畫
       波及的地方），用getBoundingClientRect()
       量出卡片目前在畫面上的實際座標，
       再用position:fixed把文字精準疊在
       卡片正上方——這樣文字的疊放順序
       就是相對於整個頁面在比較，
       不會再被卡片自己的動畫困住。
    */

    const rect=
        element.getBoundingClientRect();


    const badge =
        document.createElement(
            "div"
        );


    badge.className =
        "skill-name-badge badge-"+
        elementType;


    badge.textContent =
        skillName;


    
    /* V38 SOURCE-LEVEL UI SIZE FIX:
       The badge gets its final visual size at creation time.
       This is deliberately inline + !important so later CSS cannot
       silently override it. */
    badge.style.setProperty("font-size","72px","important");
    badge.style.setProperty("line-height","1.05","important");
    badge.style.setProperty("font-weight","900","important");
    badge.style.setProperty("white-space","nowrap","important");
    badge.style.setProperty("width","max-content","important");
    badge.style.setProperty("min-width","max-content","important");
    badge.style.setProperty("-webkit-text-stroke","1.8px #f2ead9","important");
const badgePoint =
        gamePointFromClient(
            rect.left+rect.width/2,
            rect.top
        );

    badge.style.position=
        "absolute";

    badge.style.left=
        badgePoint.x+"px";

    badge.style.top=
        badgePoint.y+"px";


    const overlayLayer =
        $("game-overlay-layer") ||
        document.getElementById("game-stage");

    overlayLayer.appendChild(
        badge
    );


    setTimeout(()=>{

        if(
            badge &&
            badge.parentNode
        ){

            badge.parentNode.removeChild(
                badge
            );

        }

    },2200);

}


/*
   ★ 新增（依照使用者要求，怪物施放技能時
   也要跳技能名稱）：
   跟showSkillNameBadge()幾乎一模一樣，
   唯一差別是目標元素從
   battlePlayerCard+characterIndex
   換成battleMonster+monsterIndex——
   怪物攻擊時同樣可能觸發卡片前傾動畫
   （lungeMonsterCard()），所以這裡
   一樣不當卡片的子元素、掛在
   document.body底下、用position:fixed
   疊在怪物卡片正上方，原因跟
   showSkillNameBadge()完全相同。
*/

function showMonsterSkillNameBadge(
    skillName,
    elementType,
    monsterIndex
){

    const element=
        $("battleMonster"+
            monsterIndex
        );


    if(!element){
        return;
    }


    const rect=
        element.getBoundingClientRect();


    const badge=
        document.createElement(
            "div"
        );


    badge.className=
        "skill-name-badge badge-"+
        elementType;


    badge.textContent=
        skillName;


    
    /* V38 SOURCE-LEVEL UI SIZE FIX:
       The badge gets its final visual size at creation time.
       This is deliberately inline + !important so later CSS cannot
       silently override it. */
    badge.style.setProperty("font-size","72px","important");
    badge.style.setProperty("line-height","1.05","important");
    badge.style.setProperty("font-weight","900","important");
    badge.style.setProperty("white-space","nowrap","important");
    badge.style.setProperty("width","max-content","important");
    badge.style.setProperty("min-width","max-content","important");
    badge.style.setProperty("-webkit-text-stroke","1.8px #f2ead9","important");
const badgePoint =
        gamePointFromClient(
            rect.left+rect.width/2,
            rect.top
        );

    badge.style.position=
        "absolute";

    badge.style.left=
        badgePoint.x+"px";

    badge.style.top=
        badgePoint.y+"px";


    const overlayLayer =
        $("game-overlay-layer") ||
        document.getElementById("game-stage");

    overlayLayer.appendChild(
        badge
    );


    setTimeout(()=>{

        if(
            badge &&
            badge.parentNode
        ){

            badge.parentNode.removeChild(
                badge
            );

        }

    },2200);

}


/*
   ★ 修正（依照使用者要求，拿掉施放技能時
   跳出SP消耗數字的動畫）：
   之前每次施放技能，都會另外跳出一個
   「-XXSP」的浮動文字，提醒扣了多少SP。
   使用者覺得這個提示不需要，直接拿掉。
   保留這個函式本身（讓所有呼叫的地方
   還是能正常運作、不會噴錯），
   但函式內容清空，不再做任何顯示。
*/

function showPlayerSpPopup(amount,characterIndex){

    return;

}


function lungePlayerCard(characterIndex){

    const element =
        $("battlePlayerCard"+
            (characterIndex||0)
        );


    if(!element){
        return;
    }


    element.classList.remove(
        "attacker-lunge-up"
    );


    void element.offsetWidth;


    element.classList.add(
        "attacker-lunge-up"
    );


    setTimeout(()=>{

        element.classList.remove(
            "attacker-lunge-up"
        );

    },450);

}


function lungeMonsterCard(index){

    const element =
        $("battleMonster"+index);


    if(!element){
        return;
    }


    element.classList.remove(
        "attacker-lunge-down"
    );


    void element.offsetWidth;


    element.classList.add(
        "attacker-lunge-down"
    );


    setTimeout(()=>{

        element.classList.remove(
            "attacker-lunge-down"
        );

    },450);

}


/*
   ★ 閃避動畫（新增）：
   跟lunge是同一種寫法，只是換一個class，
   套用在「躲過攻擊/抵抗異常狀態」的那個目標身上。
*/

function showDodgeAnimation(element){

    if(!element){
        return;
    }


    element.classList.remove(
        "dodge-back"
    );


    void element.offsetWidth;


    element.classList.add(
        "dodge-back"
    );


    setTimeout(()=>{

        element.classList.remove(
            "dodge-back"
        );

    },450);

}


/*
   同時處理「攻擊沒命中」跟「異常狀態沒生效」
   這兩種miss狀況：
   目標卡片播放閃避動畫，
   並跳出一個灰白色的文字提示。

   isPlayerTarget=true時對象是玩家自己的卡片，
   否則用index去抓怪物卡片。
*/

function showMissEffect(isPlayerTarget,index,text){

    /*
       ★ 修正：
       isPlayerTarget=true時，
       index現在代表「第幾張玩家卡」
       （0=第一角色、1=第二角色），
       不再永遠抓battlePlayerRow裡第一張卡，
       這樣第二角色被攻擊沒命中時，
       閃避動畫才會出現在正確的卡片上。
    */

    const element =
        isPlayerTarget
        ?
        $("battlePlayerCard"+
            (index||0)
        )
        :
        $("battleMonster"+index);


    if(!element){
        return;
    }


    showDodgeAnimation(
        element
    );


    showDamagePopup(
        element,
        text||"MISS",
        "miss"
    );

}


function showPlayerHit(amount,type,characterIndex,isPositive,isCrit){

    const element =
        $("battlePlayerCard"+
            (characterIndex||0)
        );


    if(!element){
        return;
    }


    /*
       ★ 再次修正（真的抓到遺漏的地方）：
       上次只排除了type==="heal"，但SP藥水
       恢復用的是type==="sp"，不是"heal"，
       漏網之魚，喝SP藥水恢復的時候還是會
       誤觸發震動——同一個根本問題（用資源
       種類的字串去猜測「這是正面還負面效果」
       本來就不可靠，"sp"這個字串同時代表
       「這是SP」，沒辦法同時分辨「是恢復
       還是流失」）。

       這裡連帶發現了另一個因為同樣原因造成的
       bug：下面顯示的+/-符號，也只認得
       type==="heal"，SP藥水恢復的時候
       會顯示成「-50SP」這種誤導人的負數，
       明明是在補血/補魔卻顯示負號。

       改成明確傳一個isPositive參數，
       不再靠字串去猜，這裡呼叫的每個地方
       都要自己明確講清楚「這次是正面效果
       還是負面效果」，兩個bug一次修好，
       以後也不會再有類似「type字串沒把
       某個情況考慮進去」而漏掉的狀況。
    */

    if(!isPositive){

        element.classList.remove(
            "hit",
            "red-hit"
        );


        void element.offsetWidth;


        element.classList.add(
            "hit",
            "red-hit"
        );


        /*
           ★ 修正（跟showMonsterHit()同一個
           bug，一起修）："hit"沒有跟著清掉，
           會一直殘留在classList上。
        */

        setTimeout(()=>{
            element.classList.remove(
                "hit"
            );
        },300);


        setTimeout(()=>{
            element.classList.remove(
                "red-hit"
            );
        },350);

    }


    if(
        amount!==undefined &&
        amount!==null
    ){

        const prefix =
            isPositive
            ?
            "+"
            :
            "-";


        /*
           ★ 新增（依照使用者要求，怪物打玩家
           爆擊時也要有效果，跟showMonsterHit()
           那邊玩家打怪物爆擊的呈現方式一致）：
           isCrit為true時，數字前面加💥，
           並把isCrit傳給showDamagePopup()，
           讓它套上.critical-popup樣式
           （字更大、顏色更醒目），跟玩家對
           怪物爆擊時看到的效果同一套。
        */

        showDamagePopup(
            element,
            (
                isCrit
                ?
                ""
                :
                ""
            )+
            prefix+
            amount+
            (
                type==="sp"
                ?
                "SP"
                :
                "HP"
            ),
            type,
            isCrit
        );

    }

}


function showMonsterHit(index,amount,type,isCrit){

    const element =
        $("battleMonster"+index);


    if(!element){
        return;
    }


    element.classList.remove(
        "hit",
        "red-hit"
    );


    void element.offsetWidth;


    element.classList.add(
        "hit",
        "red-hit"
    );


    /*
       ★ 修正（依照使用者要求，查修野怪攻擊/
       施放技能時偶爾左右抖動的問題）：
       "red-hit"原本就有清掉，但"hit"這個
       class（真正負責左右震動的hitAnimation）
       從來沒有被清掉過——一旦這隻怪物被打中
       一次，"hit"就會一直留在它的
       classList上，直到牠下次又被打中
       （remove再add）才會重新處理。

       雖然hitAnimation本身不是infinite、
       播完就停了，理論上留著不會一直重播，
       但這個殘留的class是個不乾淨的狀態，
       如果之後有其他地方也用同一招
       「remove某個class、強制reflow、
       再add」的手法去觸發別的動畫
       （例如攻擊方前傾的attacker-lunge-down），
       兩個class同時疊在同一個元素上，
       都在動同一個transform屬性，
       就可能互相干擾、疊出不是原本設計的
       動畫效果——這很可能就是「攻擊/施放
       技能時卡片有機率抖動」的來源。

       這裡讓"hit"也在動畫播完後（跟CSS
       設定的.3s一致）自動清掉，
       不會再有殘留的class疊在攻擊動畫上面。
    */

    setTimeout(()=>{
        element.classList.remove(
            "hit"
        );
    },300);


    setTimeout(()=>{
        element.classList.remove(
            "red-hit"
        );
    },350);


    if(
        amount!==undefined &&
        amount!==null
    ){

        const prefix =
            type==="heal"
            ?
            "+"
            :
            "-";


        showDamagePopup(
            element,
            (
                isCrit
                ?
                ""
                :
                ""
            )+
            prefix+
            amount+
            (
                type==="sp"
                ?
                "SP"
                :
                "HP"
            ),
            type,
            isCrit
        );

    }

}


/* =====================================================
   怪物重生
===================================================== */

function respawnMonsters(){

    if(battleActive){
        return;
    }


    /*
       ★ 修正：
       原本這裡不分青紅皂白，
       每次都把全部6隻怪物重置位置＋回滿血，
       現在戰鬥只會捲入1~3隻，
       其餘沒死的怪物不應該被動到
       （不然沒死的怪物也會每次戰鬥後突然跳位置）。
       改成只處理「真的已經死亡」的怪物。
    */

    monsters
    .slice(
        0,
        MAX_TRAINING_MONSTERS
    )
    .forEach(
        (monster,index)=>{

            if(
                !monster ||
                monster.alive
            ){
                return;
            }


            monster.alive=true;

            monster.hp =
                monster.maxHP;

            monster.sp =
                monster.maxSP;


            /*
               ★ 修正（清理殘留程式碼）：
               這裡原本還在重新計算怪物的x/y座標、
               更新地圖圖示的位置，但怪物已經
               不再巡邏、圖示也整個隱藏了，
               這段完全用不到了，拿掉。
               新區域（冰霜山脈之後）的怪物資料
               本來就沒有x/y這兩個欄位，
               留著這段對它們來說只會算出
               沒有意義的NaN，清掉比較乾淨。
            */

        }
    );

}


/*
   ★ 修正（依照使用者要求，這次真的統一掉了）：
   這裡之前已經被改成「進入地圖就自動每4秒
   觸發一次戰鬥」，但使用者這次明確要求：
   進入地圖後必須先按「自動巡怪」按鈕，
   才會開始每4秒自動戰鬥——這正是後來
   在toggleAutoPatrol()/runAutoPatrolCheck()
   （地圖頁面自動戰鬥面板旁邊那顆新按鈕）
   做的事，兩套邏輯做的是同一件事，卻各自
   獨立運作、互不知道對方存在，才會出現
   「自動巡怪都還沒按，就自己打起來」
   這種行為——因為真正在背景運作的其實是
   這裡這套「進地圖就自動開始」的舊邏輯，
   跟使用者按的那顆按鈕完全無關。

   函式名稱、呼叫的地方（enterZone()、
   winBattle()之後、逃脫成功之後…）都維持
   不動，但函式本體改成空的——現在
   「要不要每4秒自動戰鬥」唯一的開關是
   toggleAutoPatrol()那顆按鈕，不會再有
   進地圖就自動觸發的行為。
*/

function startMonsterMovement(){

    /*
       故意留空：自動巡怪的開關只交給
       toggleAutoPatrol()處理，這裡不再
       自動啟動任何計時器。
    */

}


function stopMonsterMovement(){

    /*
       故意留空，原因同上——真正的停止邏輯
       在stopAutoPatrol()，呼叫這裡不會
       有任何作用，純粹是為了讓舊的呼叫點
       （leaveMap()、startBattle()…）
       不用一個一個改掉、不會噴錯。
    */

}


/* =====================================================
   升級
===================================================== */

function checkLevelUp(targetCharacter){

    /*
       ★ 修正：
       原本這整個函式寫死只認player，
       第二角色沒辦法透過這裡升級。
       改成可以傳入要升級的角色物件，
       不傳的話預設還是player
       （保留舊的呼叫方式相容）。
    */

    const character=
        targetCharacter||
        player;


    let levels=0;


    /*
       ★ 新增防呆：
       正常情況下這個while最多跑1次
       （distributeExpToCharacter每次都只給
       剛好1級的量），
       但還是加一個保險上限，
       避免任何我沒預料到的資料異常
       （例如舊存檔的expNext壞掉）
       導致這裡跑出離譜的迴圈次數，
       一次爆增幾百級、灌出天文數字的技能點。
       200級對目前遊戲進度來說已經非常多，
       正常玩法不可能一次觸發到這個上限。
    */

    while(
        character.exp>=
        character.expNext &&
        levels<200
    ){

        character.exp -=
            character.expNext;


        character.level++;


        character.expNext =
            Math.max(
                character.expNext+1,
                Math.floor(
                    character.expNext*1.2
                )
            );


        character.attributePoints += 5;

        character.skillPoints += 2;


        /*
           ★ 規格要求：
           升級固定 +30 最大HP、+10 最大SP，
           跟體質/能量配點加成分開累加。
        */

        character.bonusHP += 30;

        character.bonusSP += 10;


        levels++;

    }


    if(levels>0){

        /*
           ★ 修正：
           這裡跟之前戰鬥勝利補血是同一種問題——
           升級當下直接把HP/SP強制補滿，
           跟你設定的「HP低於X%/SP低於X%」
           自動補藥水門檻完全無關，
           難怪你會覺得「明明還沒到門檻，
           它自己就補了」。

           拿掉強制補滿，只重新計算一次
           current hp/sp的上限夾住（避免超過新的maxHP/maxSP），
           不會平白無故變成全滿。

           player2沒有getMainCharacterStats()可以用
           （那個函式寫死算player的），
           改用跟getInventoryCharacterStats()
           player2分支同一套公式現算一次。
        */

        let maxHP;

        let maxSP;


        if(character===player){

            const stats =
                getMainCharacterStats();


            maxHP=
                stats.maxHP;

            maxSP=
                stats.maxSP;

        }
        else{

            const bonus2 =
                getEquipmentBonus(
                    "player2"
                );


            maxHP=
                100+
                character.vitality*50+
                character.bonusHP+
                bonus2.maxHP+
                bonus2.vitality*50;


            maxSP=
                50+
                character.energy*15+
                character.bonusSP+
                bonus2.maxSP+
                bonus2.energy*15;

        }


        character.hp =
            Math.min(
                character.hp,
                maxHP
            );


        character.sp =
            Math.min(
                character.sp,
                maxSP
            );


        /*
           ★ 修正（依照使用者要求，「經驗值
           分配升級的時候，直接點選就好，
           不要再跳出視窗顯示告知」，後續
           又補充「希望升級的時候可以跳出
           一個訊息框，顯示XXX升到XX級」）：
           checkLevelUp()目前只有一個呼叫
           來源——distributeExpToCharacter()
           （經驗池分配頁面按「分配經驗值給
           X」那個按鈕），所以這裡的修改
           只影響這個流程，不會誤傷其他
           情境。

           原本升級當下會強制跳出一個要
           手動按「確定」才能關掉的
           levelModal彈窗，玩家自己主動
           點分配、期待的就是「點下去馬上
           生效」，不需要額外再跳一層
           確認/告知視窗才能繼續操作——
           這部分維持拿掉。

           但玩家後來明確表示還是想要「有
           告知」，只是不要那種要按確定的
           形式，改成跟獲得EXP同一種輕量
           toast通知（見showLevelUpToast()），
           不擋操作、看過就自動消失。

           levelModal這個彈出視窗本身、
           closeLevelModal()都先保留在
           程式碼裡沒刪，只是不再從這裡
           觸發顯示。
        */

        showLevelUpToast(
            character===player
            ?
            (player.id||"你")
            :
            character.id,
            character.level
        );

    }


    /*
       ★ 修正（依照使用者回報，「按升級的
       時候，上面頭像框的等級沒有跟著
       增加」）：
       不管有沒有真的升級（levels>0），
       都呼叫一次，順便同步好目前的等級
       數字，成本很低（找不到元素就直接
       return），沒有副作用。
    */

    refreshCharacterAvatarLevels();


    saveGame();

    updateUI();

}


function closeLevelModal(){

    $("levelModal")
        .classList
        .remove("show");

}


/* =====================================================
   ★ 經驗池分配
=====================================================

   規格五、六：
   EXP先進入共用經驗池，
   不會戰鬥一結束就自動升級。
   玩家回到主城後，自行按「分配經驗值」
   把經驗池的EXP分給角色，
   才會真正觸發升級判定。

   目前遊戲裡唯一擁有完整等級/屬性系統的
   角色是主角（player，也就是創角時選的元素）。
   水戰士／風弓手目前只有裝備欄，
   尚未有獨立等級系統
   （規格二有註明「多角色同時戰鬥」是未來功能），
   所以分配按鈕先只開放給主角，
   其餘角色顯示「尚未開放」。

===================================================== */

let expToastTimer=null;


function showExpToast(amount){

    const toast =
        $("expToast");


    if(!toast){
        return;
    }


    toast.textContent =
        "獲得"+
        amount+
        "EXP（已存入經驗池）";


    toast.classList.add(
        "show"
    );


    clearTimeout(
        expToastTimer
    );


    expToastTimer =
        setTimeout(()=>{

            toast.classList.remove(
                "show"
            );

        },2600);

}


let levelUpToastTimer=null;


/*
   ★ 新增（依照使用者要求，「升級的時候
   可以跳出一個訊息框，顯示XXX升到XX級」）：
   跟showExpToast()同一套寫法，非阻斷、
   自動消失，不需要玩家按確定。
*/

function showLevelUpToast(characterName,level){

    const toast=
        $("levelUpToast");


    if(!toast){
        return;
    }


    toast.textContent=
        characterName+
        "升到"+
        level+
        "級！";


    toast.classList.add(
        "show"
    );


    clearTimeout(
        levelUpToastTimer
    );


    levelUpToastTimer=
        setTimeout(()=>{

            toast.classList.remove(
                "show"
            );

        },2600);

}


/*
   ★ 新增（依照使用者回報，「按升級的
   時候，上面頭像框的等級沒有跟著增加」）：
   只更新角色彈窗頭像那兩個等級文字，
   不重畫整個彈窗內容（重畫整個彈窗
   innerHTML會把玩家正在看的分頁——
   例如經驗池分配本身——一起洗掉，
   之前處理「自動戰鬥設定跳出空白
   技能頁」就是同一種bug，這裡改用
   針對性更新，安全很多）。

   角色彈窗沒開著的時候，$()會找不到
   對應id、直接return，呼叫這個函式
   不會出錯，可以放心在checkLevelUp()
   裡無條件呼叫。
*/

function refreshCharacterAvatarLevels(){

    const level0El=
        $("characterAvatarLevel0");

    if(level0El){

        level0El.textContent=
            "Lv."+
            player.level;

    }


    const level1El=
        $("characterAvatarLevel1");

    if(
        level1El &&
        player2
    ){

        level1El.textContent=
            "Lv."+
            player2.level;

    }

}


/* =====================================================
   ★ 主城休息（免費回滿HP/SP）

   之前把「戰鬥勝利/升級自動補滿HP、SP」拿掉之後，
   藥水用完就沒有其他回血手段了，
   遊戲裡目前也還沒有真正的商店/金幣系統
   可以買新藥水（「金幣」目前只是背包售出時的顯示文字，
   沒有真的被記錄、也沒地方花）。

   先用最單純的方式補上這個缺口：
   回主城可以免費休息，直接回滿HP/SP，
   不需要藥水、不需要金幣。
   之後如果要做真正的商店系統，
   這個函式可以再擴充或替換掉。
===================================================== */

/* =====================================================
   ★ 主城純文字選單——共用彈出視窗
===================================================== */

let homeFeatureBorrowedElement=
    null;

let homeFeatureBorrowedParent=
    null;

let homeFeatureBorrowedNextSibling=
    null;

/*
   ★ 新增（依照使用者要求，角色視窗隱藏
   借進來頁面裡多餘的箭頭切換區塊）：
   記住這次借頁面進來時，順手隱藏了哪一個
   「◀角色名▶」的區塊，restoreBorrowedElement()
   歸位時要負責把它的顯示狀態恢復回來，
   不然切走之後，那個頁面單獨被使用時
   （例如之後可能還有其他借用場景）會
   一直維持隱藏、找不回來。
*/

let homeFeatureHiddenSwitchCard=
    null;


/*
   ★ 新增（依照使用者要求，主城立繪隨機
   切換）：兩張圖base64內嵌，每次進入主城
   頁面時（showPage()裡呼叫，見下面
   showHomePortrait()的呼叫點）隨機挑一張
   顯示，不是戰鬥用的角色卡片圖，是額外
   準備的立繪。
*/

/* =====================================================
   V89 — 任務介面專用手勢模式
   任務使用 #questTabBody 作為唯一內層 scroll owner。
   遊戲最外層原本 touch-action:none，因此只在任務視窗
   開啟期間放行 pan-y；不新增 touch/pointer listener。
===================================================== */
function setQuestTouchMode(active){

    [
        document.documentElement,
        document.body,
        document.getElementById("game-viewport"),
        document.getElementById("game-stage")
    ].forEach(function(element){

        if(!element){
            return;
        }

        element.classList.toggle(
            "quest-scroll-active",
            !!active
        );

    });

}


function openHomeFeature(type){

    const modal=
        $("homeFeatureModal");

    const titleEl=
        $("homeFeatureModalTitle");

    const bodyEl=
        $("homeFeatureModalBody");


    if(
        !modal ||
        !titleEl ||
        !bodyEl
    ){
        return;
    }


    closeHomeFeature();


    if(type==="rest"){

        titleEl.textContent=
            "主城休息";

        /*
           ★ 修正（依照使用者回報，「巡怪
           頁面按自動戰鬥跳出空白技能頁面」，
           追查後發現同一個bug其實影響三個
           地方，這裡順便一起修掉）：
           這個分支只呼叫borrowElementIntoModal()
           把homeRestCard借進來，從來沒有
           清空過bodyEl本身的innerHTML。
           如果「上一次」開的是用innerHTML=
           整段蓋掉的類型（例如「角色」——
           裡面有頭像切換列、分頁按鈕、
           characterTabContent），那些殘留
           HTML會一直留在bodyEl裡，這次借來
           的內容只是「加」在後面，不是
           「取代」，玩家會看到上一次的舊
           畫面卡在最上面、新內容被推到
           下面看不到（要滾動很多才看得到，
           甚至看起來像整個空白，因為角色
           頁那個characterTabContent本身
           因為「分頁高度要一致」的需求，
           保留了一個固定的min-height，
           空著的時候看起來就是一大塊
           空白框框）。

           修法：跟其他用innerHTML=整段蓋掉
           的分支一樣，先清空bodyEl，保證
           每次開視窗都是乾淨的起點，不管
           上一次開的是什麼類型。
        */

        bodyEl.innerHTML=
            "";

        borrowElementIntoModal(
            $("homeRestCard"),
            bodyEl
        );

    }
    else if(type==="expPool"){

        titleEl.textContent=
            "經驗池分配";

        /*
           ★ 修正：跟上面「主城休息」同一個
           bug、同一個修法，先清空bodyEl。
        */

        bodyEl.innerHTML=
            "";

        borrowElementIntoModal(
            $("homeExpPoolCard"),
            bodyEl
        );

    }
    else if(type==="shop"){

        titleEl.textContent=
            "商店";

        bodyEl.innerHTML=
            renderShopContent();

    }
    else if(type==="character"){

        titleEl.textContent=
            "角色";


        /*
           ★ 新增：角色頁面內容比較多
           （借進來的整頁內容），套用加寬
           樣式，closeHomeFeature()關閉時
           會自動拿掉，不影響其他一般大小
           的視窗。
        */

        const box=

            modal.querySelector(
                ".home-feature-modal-box"
            );


        if(box){

            box.classList.add(
                "wide"
            );

        }


        /*
           ★ 修正（依照使用者要求，視窗要
           放大到接近滿版）：內層視窗變成
           100vw之後，外層遮罩（.home-feature-
           modal）本身還有20px的padding，
           會讓內層視窗超出螢幕、產生水平
           捲動。這裡順便把外層遮罩的padding
           也收掉，兩層一起處理才會真的貼齊
           螢幕邊緣。
        */

        modal.classList.add(
            "no-padding"
        );


        bodyEl.innerHTML=
            renderCharacterShowcaseContent();


        /*
           ★ 修正：預設一打開就選第一角色、
           顯示能力值分頁——改呼叫
           selectCharacterForTabs(0)而不是
           直接switchCharacterTab("status")，
           這樣三個頁面的角色狀態從一開始
           就是同步的，不用等玩家自己點一次
           頭像才對齊。
        */

        selectCharacterForTabs(
            0
        );

        switchCharacterTab(
            "status"
        );

        if(window.syncCharacterTouchMode){
            window.syncCharacterTouchMode();
        }

    }
    else if(type==="offlineExp"){

        titleEl.textContent=
            "離線經驗";

        bodyEl.innerHTML=
            renderOfflineExpContent();

    }
    else if(type==="quest"){

        titleEl.textContent=
            "任務";

        /*
           V89：任務不再沿用商店的一般 row/button 版型。
           只在任務開啟期間套用專用 modal 結構與手勢模式。
        */
        modal.classList.add(
            "quest-mode"
        );

        setQuestTouchMode(
            true
        );

        ensureDailyQuestsCurrent();

        dailyQuestState.progress.checkin=
            1;

        bodyEl.innerHTML=
            renderQuestTabContent(
                "daily"
            );

    }
    else if(type==="bestiary"){

        titleEl.textContent=
            "圖鑑";

        bodyEl.innerHTML=
            renderBestiaryContent();

    }
    else if(type==="achievement"){

        titleEl.textContent=
            "成就";

        bodyEl.innerHTML=
            renderAchievementContent();

    }
    else if(type==="announcement"){

        titleEl.textContent=
            "公告";

        bodyEl.innerHTML=
            renderAnnouncementContent();

    }
    else if(type==="system"){

        titleEl.textContent=
            "系統";

        bodyEl.innerHTML=
            renderSystemContent();

    }
    else if(type==="autoBattleSettings"){

        /*
           ★ 新增（依照使用者要求，「自動
           戰鬥放進下面導覽列，按下去跳出
           設定視窗」）：
           原本#autoBattleSettingsPanel
           那套是自己土法煉鋼算position:
           fixed座標、另外搬到document.body
           底下顯示，牽涉battlePage的
           display:none、行內樣式覆蓋等
           好幾層問題，查證後就是這一整套
           自訂定位邏輯本身容易在「不在
           戰鬥中」的情境出錯，才會有
           「按下去沒反應」的狀況。

           這裡不修那套舊邏輯，而是直接
           改用整個遊戲共用、已經驗證過
           很多次都正常運作的
           openHomeFeature()彈窗系統——
           借用同一個#autoBattleSettingsPanel
           （欄位/下拉選單完全不用重做），
           但用borrowElementIntoModal()
           塞進這個彈窗的body，跟「休息」
           「經驗池分配」用的是同一招，
           不再需要自己算座標、自己管
           z-index。
        */

        titleEl.textContent=
            "自動戰鬥設定";


        /*
           ★ 修正（依照使用者回報，「巡怪
           頁面按自動戰鬥跳出空白技能頁面」）：
           真正原因找到了——這個分支從頭到尾
           只用borrowElementIntoModal()把
           autoBattleSettingsPanel借進來，
           從來沒清空過bodyEl本身的innerHTML。
           如果上一次開的是「角色」（用
           innerHTML=整段蓋掉，裡面有頭像
           切換列、分頁按鈕、
           characterTabContent），closeHomeFeature()
           只會把「借走的子頁面」（例如
           skillPage）歸位，並不會清掉
           bodyEl.innerHTML本身那層——那層
           角色頁的外殼（頭像+分頁按鈕+
           一個因為「分頁要等高」而保留
           固定高度的空characterTabContent）
           會一直卡在bodyEl裡，這次借來的
           設定面板只是「加」在它後面，
           不是「取代」它。玩家看到的就是
           使用者截圖那樣：上面還是角色頁的
           分頁按鈕，下面一大塊空白（那個
           空的characterTabContent），
           設定面板本身其實還在，只是被
           推到更下面，畫面上完全看不到。

           跟「主城休息」「經驗池分配」
           同一個bug、同一個修法：先清空
           bodyEl，保證每次開視窗都是乾淨
           起點。
        */

        bodyEl.innerHTML=
            "";


        const panel=
            $("autoBattleSettingsPanel");


        if(panel){

            /*
               ★ 修正（依照使用者回報，「這些
               按鈕都沒反應」＋「設定頁面靠上面
               很醜」）：
               真正的原因找到了——上面這段只
               清掉「行內」定位樣式，但
               #autoBattleSettingsPanel這個
               元素本身的CSS class
               （.auto-settings-expanded）
               寫死了position:absolute；
               top:0；left:0；right:0；
               height:360px；z-index:98
               （原本是設計給battlePage裡
               「蓋在角色卡牌上面」那種用法）。
               行內樣式清成""之後，瀏覽器會
               fallback回這個class本身的設定，
               等於面板還是position:absolute，
               而且因為.home-feature-modal-box
               沒有設position，最近的「已定位
               祖先」變成.home-feature-modal
               本身（position:fixed;inset:0），
               面板就會整個貼齊那個全螢幕遮罩
               的左上角——這就是「靠上面很醜」
               的原因；在Samsung Browser這類
               手機瀏覽器上，這種「position:
               absolute逃出預期的排版位置」
               還常常伴隨點擊座標對不準（尤其
               網址列滑出/滑入、視窗高度浮動
               的時候），這就是「按鈕都沒反應」
               的原因。

               這裡不能只清行內樣式，要「明確
               蓋掉」class本身的設定：改成
               position:static、height:auto，
               讓面板真的回到#homeFeatureModalBody
               的正常文件流裡面，跟「休息」
               「經驗池分配」那些一樣正常顯示、
               正常吃得到點擊事件。
            */

            panel.style.position=
                "static";

            panel.style.top=
                "";

            panel.style.left=
                "";

            panel.style.right=
                "";

            panel.style.bottom=
                "";

            panel.style.height=
                "auto";

            panel.style.zIndex=
                "";

            panel.style.maxHeight=
                "";

            panel.classList.remove(
                "floating-modal"
            );


            borrowElementIntoModal(
                panel,
                bodyEl
            );


            panel.style.display=
                "flex";

        }


        /*
           ★ 新增（依照使用者要求，「自動
           戰鬥的設定頁面，緊貼戰鬥資訊框
           上緣，不然現在靠上面很醜」）：
           這個彈窗預設是「整個遮罩置中」
           （.home-feature-modal的align-items:
           center），改成幫這個彈窗加一個
           dock-bottom樣式，讓它貼著畫面
           下緣（戰鬥資訊框/導覽列上方）
           顯示，而不是飄在畫面正中央或
           （修好前）貼在最上面。
           其他功能（休息、角色、任務……）
           開啟時會在下面統一清掉這個class，
           不受影響，一樣維持原本置中顯示。
        */

        modal.classList.add(
            "dock-bottom"
        );


        const characterSelect=
            $("autoSettingsCharacterSelect");


        if(characterSelect){

            const option0=
                $("autoSettingsCharOption0");


            if(option0){

                option0.textContent=

                    player.id||
                    "角色1";

            }


            const option1=
                $("autoSettingsCharOption1");


            if(option1){

                option1.textContent=

                    player2
                    ?
                    player2.id
                    :
                    "角色2（尚未創建）";


                option1.disabled=
                    !player2;

            }


            characterSelect.value="0";

        }


        switchAutoSettingsCharacter(
            true
        );

    }


    modal.classList.add(
        "show"
    );

}


function borrowElementIntoModal(
    element,
    bodyEl
){

    if(!element){
        return;
    }


    homeFeatureBorrowedElement=
        element;

    homeFeatureBorrowedParent=
        element.parentNode;

    homeFeatureBorrowedNextSibling=
        element.nextSibling;


    bodyEl.appendChild(
        element
    );


    element.style.display=
        "block";

}


/*
   ★ 修正（依照使用者要求，角色頁面要能
   在同一個視窗裡切換分頁）：
   把「借來的元素歸位」這段邏輯抽成獨立
   函式，closeHomeFeature()（整個關視窗）
   跟switchCharacterTab()（只是換一個
   分頁、視窗還開著）都要用到同一套歸位
   邏輯，不要重複寫兩次。
*/

function restoreBorrowedElement(){

    /*
       ★ 新增：先把可能被隱藏的箭頭切換
       區塊恢復顯示，不管這次借的是哪個
       頁面，都要先處理，跟homeFeatureBorrowedElement
       是不是null無關（獨立的一份狀態）。
    */

    if(homeFeatureHiddenSwitchCard){

        homeFeatureHiddenSwitchCard.style.display=
            "";


        homeFeatureHiddenSwitchCard=
            null;

    }


    if(!homeFeatureBorrowedElement){
        return;
    }


    homeFeatureBorrowedElement.style.display=
        "none";


    if(
        homeFeatureBorrowedNextSibling &&
        homeFeatureBorrowedNextSibling.parentNode===
        homeFeatureBorrowedParent
    ){

        homeFeatureBorrowedParent.insertBefore(
            homeFeatureBorrowedElement,
            homeFeatureBorrowedNextSibling
        );

    }
    else if(homeFeatureBorrowedParent){

        homeFeatureBorrowedParent.appendChild(
            homeFeatureBorrowedElement
        );

    }


    homeFeatureBorrowedElement=
        null;

    homeFeatureBorrowedParent=
        null;

    homeFeatureBorrowedNextSibling=
        null;

}


function closeHomeFeature(){

    const modal=
        $("homeFeatureModal");


    if(modal){

        modal.classList.remove(
            "show"
        );


        /*
           ★ 新增：關閉視窗時，如果套用過
           「角色頁面用的加寬樣式」，一併
           拿掉，不會影響下次開商店/任務
           這種一般大小的視窗。
        */

        const box=

            modal.querySelector(
                ".home-feature-modal-box"
            );


        if(box){

            box.classList.remove(
                "wide"
            );

        }


        /*
           ★ 新增：跟上面加wide是同一組，
           關閉視窗時外層遮罩的no-padding
           也要一併拿掉。
        */

        modal.classList.remove(
            "no-padding"
        );


        /*
           ★ 新增：跟no-padding同一組收尾——
           自動戰鬥設定視窗用的dock-bottom
           （貼底顯示）也要一併拿掉，不會
           讓下次開商店/任務這種一般置中
           視窗被誤套用貼底樣式。
        */

        modal.classList.remove(
            "dock-bottom"
        );

        /* V89：任務專用版型與祖層 pan-y 只在任務開啟時存在。 */
        modal.classList.remove(
            "quest-mode"
        );

    }

    setQuestTouchMode(
        false
    );


    /*
       ★ 新增：跟wide/no-padding是同一組
       收尾動作，關閉視窗時把？按鈕重置回
       隱藏，避免下次開商店/任務這種一般
       視窗時殘留顯示。
    */

    const helpBtn=
        $("statusHelpButton");


    if(helpBtn){

        helpBtn.style.display=
            "none";

    }


    restoreBorrowedElement();

    if(window.syncCharacterTouchMode){
        window.syncCharacterTouchMode();
    }

}


/*
   ★ 新增（依照使用者要求，角色頁面整合
   裝備/能力值/技能三個分頁）：
   跟borrowElementIntoModal()是同一招，
   只是這次借的是整個背包/狀態/技能頁面
   （本來就存在、已經測試穩定的完整頁面，
   不是重寫一套新的），塞進角色視窗裡的
   #characterTabContent容器原地顯示。

   切換分頁時，先把「上一個分頁借走的
   頁面」歸位，再借新的頁面進來——
   同一時間只會有一個頁面被借走，不會
   兩個分頁的內容疊在一起。
*/

/*
   ★ 新增（依照使用者要求，「上面頭像
   根本沒反應」——這個問題是真的，之前
   頭像的onclick只是切換分頁，完全沒有
   真的切換角色）：
   點頭像時，把狀態/背包/技能三個頁面
   各自的「目前正在看哪個角色」狀態
   一次全部設成同一個角色，並呼叫三個
   頁面各自的畫面更新函式——不管玩家
   現在正在看哪個分頁，切好之後畫面
   都是對的，不用等玩家自己再點一次
   分頁才更新。

   三個頁面用的狀態變數格式不一樣
   （statusCharacterIndex/
   inventoryCharacterIndex是0或1的數字，
   currentSkillCharacter是"fire"／
   "player2"這種字串），這裡各自轉換
   成對的格式再賦值，不是三個都能共用
   同一個數字。
*/

function selectCharacterForTabs(targetIndex){

    if(
        targetIndex===1 &&
        !player2
    ){
        return;
    }


    statusCharacterIndex=
        targetIndex;

    Object.keys(
        pendingStats
    ).forEach(
        stat=>{

            pendingStats[stat]=
                0;

        }
    );

    updateStatusPreview();


    inventoryCharacterIndex=
        targetIndex;

    renderInventory();


    currentSkillCharacter=

        targetIndex===0
        ?
        "fire"
        :
        "player2";

    renderSkillLoadout();


    /*
       ★ 讓被選中的頭像有視覺上的區別
       （例如外圈變亮），玩家才看得出來
       目前選的是哪一個角色。
    */

    [0,1].forEach(
        i=>{

            const avatarEl=
                $("characterAvatar"+i);


            if(avatarEl){

                avatarEl.style.opacity=

                    i===targetIndex
                    ?
                    "1"
                    :
                    ".5";

            }

        }
    );

}


function switchCharacterTab(tabName){

    restoreBorrowedElement();


    /*
       ★ 新增（依照使用者要求，「返回框框
       旁邊多一個？按鈕」，只在能力值分頁
       顯示）：
       每次切分頁都重新判斷一次，切到
       "status"才顯示，切到其他分頁
       （經驗池分配/技能/背包）自動隱藏，
       不用在每個分頁各自處理。
    */

    const helpBtn=
        $("statusHelpButton");


    if(helpBtn){

        helpBtn.style.display=

            tabName==="status"
            ?
            "inline-block"
            :
            "none";

    }


    const container=
        $("characterTabContent");


    if(!container){
        return;
    }


    const pageIdMap={
        status:"statusPage",
        inventory:"inventoryPage",
        skill:"skillPage",
        expPool:"homeExpPoolCard"
    };


    const pageEl=
        $(
            pageIdMap[tabName]
        );


    if(!pageEl){
        return;
    }


    borrowElementIntoModal(
        pageEl,
        container
    );

    if(window.v78ApplyCharacterInventoryLayout){
        window.v78ApplyCharacterInventoryLayout();
    }


    /*
       ★ 新增（依照使用者要求，「上面已經
       可以切換角色了，下面箭頭那排拿掉」）：
       這三個頁面各自原本就有的「◀角色名▶」
       箭頭切換區塊，借進角色視窗之後跟
       上方新加的頭像選擇重複了，這裡把它
       隱藏掉——只在「借進角色視窗顯示」
       這個情境隱藏，頁面本身如果之後被
       單獨借用在別的地方，不受影響
       （因為是在借進來、確定要顯示的這個
       時間點才隱藏，不是寫死在頁面本身
       的CSS上）。
    */

    const switchCardIdMap={
        status:"statusCharacterSwitchCard",
        inventory:"inventoryCharacterSwitchCard",
        skill:"skillCharacterSwitchCard"
    };


    const switchCard=
        $(
            switchCardIdMap[tabName]
        );


    if(switchCard){

        switchCard.style.display=
            "none";


        homeFeatureHiddenSwitchCard=
            switchCard;

    }


    /*
       ★ 順便讓目前選中的分頁按鈕有
       視覺上的區別（例如底色反白），
       玩家才看得出來目前正在看哪個分頁。
    */

    ["ExpPool","Status","Skill"].forEach(
        name=>{

            const btn=
                $("characterTabBtn"+name);


            if(btn){

                btn.style.opacity=

                    name.toLowerCase()===
                    tabName.toLowerCase()
                    ?
                    "1"
                    :
                    ".55";

            }

        }
    );

}


function updateGoldDisplay(){

    const value=Math.max(0,Math.floor(Number(gold)||0));

    [
        $("homeGoldValue"),
        $("inventoryGoldValue")
    ].forEach(el=>{
        if(el){
            el.textContent=value.toLocaleString("zh-TW");
        }
    });

}


/* =====================================================
   ★ 商店
===================================================== */

function renderShopContent(){

    const cards=shopItems.map(shopItem=>{
        const count=getPotionCount(shopItem.id);
        const resourceLabel=shopItem.resource==="hp" ? "HP" : "SP";
        const effectText=shopItem.recoveryPercent>=100
            ? `回復所有${resourceLabel}`
            : `回復最大${resourceLabel}的 ${shopItem.recoveryPercent}%`;

        const hasPrice=Number.isFinite(shopItem.price);
        const disabled=!hasPrice || gold<shopItem.price;
        const buttonText=!hasPrice
            ? "價格待定"
            : `${shopItem.price} 金幣`;

        return `
            <div class="shop-potion-card ${shopItem.resource}">
                <div class="shop-potion-card-head">
                    <span class="shop-potion-type">${resourceLabel}</span>
                    <span class="shop-potion-stock">持有 ${count}</span>
                </div>
                <div class="shop-potion-name">${shopItem.name}</div>
                <div class="shop-potion-effect">${effectText}</div>
                <button
                    class="home-feature-buy-btn shop-potion-buy"
                    ${disabled ? "disabled" : ""}
                    onclick="buyShopItem('${shopItem.id}')"
                >${buttonText}</button>
            </div>
        `;
    }).join("");

    return `
        <div class="shop-potion-interface">
            <div class="shop-potion-note">只販售 HP／SP 回復藥水</div>
            <div class="shop-potion-list">${cards}</div>
        </div>
    `;
}


function buyShopItem(itemId){

    const shopItem=getPotionDefinition(itemId);

    if(!shopItem){
        return;
    }

    if(!Number.isFinite(shopItem.price)){
        alert("這個藥水的價格尚未設定。");
        return;
    }

    if(gold<shopItem.price){
        alert("金幣不夠。");
        return;
    }

    if(!addPotionToInventory(itemId,1)){
        alert("背包已滿，或該藥水已沒有可用的堆疊空間。");
        return;
    }

    gold=gold-shopItem.price;

    rebuildInventorySlots();
    updateGoldDisplay();
    saveGame();

    const bodyEl=$("homeFeatureModalBody");

    if(bodyEl){
        bodyEl.innerHTML=renderShopContent();
    }
}


/* =====================================================
   ★ 角色展示
===================================================== */

/*
   ★ 修正（依照使用者要求，參考圖那種
   「上面顯示已開放/未開放角色，下面切換
   裝備/能力值/技能」的角色頁面）：

   上排：角色頭像格，已創建的角色顯示
   屬性圖示+名稱+等級，還沒創建的（目前
   只有第二角色這個位置）顯示鎖頭+解鎖
   條件，點下去如果條件已經達成就直接
   跳出創建視窗。

   下排：三個按鈕（裝備/能力值/技能），
   直接導去現成的背包/狀態/技能頁面——
   這三個頁面本身已經有角色切換箭頭
   （changeInventoryCharacter/
   changeStatusCharacter/
   changeSkillCharacterArrow），不用在
   這裡重新做一套角色切換邏輯，直接沿用
   現成、已經測試過的頁面就好。
*/

function renderCharacterShowcaseContent(){

    const slots=[
        player,
        player2
    ];


    let html=

        '<div style="display:flex;gap:10px;'+
        'justify-content:center;margin-bottom:8px;">';


    slots.forEach(
        (character,slotIndex)=>{

            if(character){

                const element=

                    elementDatabase[
                        character.element
                    ]
                    ||
                    elementDatabase.fire;


                html+=

                    '<div style="width:86px;text-align:center;'+
                    'cursor:pointer;" onclick="selectCharacterForTabs('+
                    slotIndex+
                    ');">'+

                    '<div id="characterAvatar'+
                    slotIndex+
                    '" style="width:56px;height:56px;margin:0 auto;'+
                    'border-radius:50%;background:linear-gradient(160deg,#241c12,#15100a);'+
                    'border:2px solid #f0b429;display:flex;align-items:center;'+
                    'justify-content:center;font-size:18px;transition:opacity .15s;">'+
                    getElementIconHTML(
                        character.element
                    )+
                    "</div>"+

                    '<div style="font-size:11px;font-weight:bold;margin-top:2px;'+
                    'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+
                    character.id+
                    "</div>"+

                    /*
                       ★ 修正（依照使用者回報，「按升級
                       的時候，上面頭像框的等級沒有跟著
                       增加」）：
                       這個等級文字原本沒有id，純粹是
                       renderCharacterShowcaseContent()
                       組字串時當下算好直接寫死進HTML，
                       這個函式只有「打開角色彈窗那一刻」
                       會被呼叫一次，之後不管等級怎麼變
                       （例如去經驗池分配頁面按分配、
                       角色升級了），這段字串早就已經
                       釘死在畫面上，沒有人會再回來更新
                       它——不是資料沒算對，是畫面根本
                       沒被通知要重畫。

                       加一個id，讓checkLevelUp()升級
                       發生的當下可以直接找到這個元素、
                       只更新這一小塊文字，不用重畫整個
                       彈窗（重畫整個彈窗會把玩家正在看
                       的分頁內容也一起洗掉，之前才修過
                       同一類型的bug）。
                    */

                    '<div id="characterAvatarLevel'+
                    slotIndex+
                    '" style="font-size:10px;color:#b3a58c;">'+
                    "Lv."+character.level+
                    "</div>"+

                    "</div>";

            }
            else{

                const eligible=

                    player.level>=10;


                html+=

                    '<div style="width:66px;text-align:center;'+
                    'cursor:pointer;opacity:'+
                    (eligible?"1":".55")+
                    ';" onclick="'+
                    (
                        eligible
                        ?
                        "closeHomeFeature();openSecondCharacterModal();"
                        :
                        ""
                    )+
                    '">'+

                    '<div style="width:40px;height:40px;margin:0 auto;'+
                    'border-radius:50%;background:linear-gradient(160deg,#241c12,#15100a);'+
                    'border:2px dashed #8a6a3a;display:flex;align-items:center;'+
                    'justify-content:center;font-size:16px;">'+
                    ""+
                    "</div>"+

                    '<div style="font-size:11px;font-weight:bold;margin-top:2px;'+
                    'color:#8a8a8a;">'+
                    "未解鎖"+
                    "</div>"+

                    '<div style="font-size:10px;color:#7a6f5c;">'+
                    (
                        eligible
                        ?
                        "點擊創建"
                        :
                        "Lv.10解鎖"
                    )+
                    "</div>"+

                    "</div>";

            }

        }
    );


    html+=
        "</div>";


    /*
       ★ 修正（依照使用者要求，「不是要按下去
       切換到原本頁面，是要整合到同一個
       畫面裡」）：
       原本這裡是三個「導頁」按鈕，點下去會
       關掉這個視窗、跳去背包/狀態/技能
       頁面。改成三個「分頁」按鈕，點下去
       呼叫switchCharacterTab()——不會關掉
       視窗，是把對應頁面的內容「借」進
       #characterTabContent這個容器裡
       原地顯示，跟之前借用主城休息/經驗池
       卡片是同一招，只是這次借的是整頁。
    */

    html+=

        '<div style="display:flex;gap:6px;margin-bottom:6px;">'+

        '<button id="characterTabBtnExpPool" class="home-feature-buy-btn"'+
        'style="flex:1;padding:10px 6px;font-size:18px;min-height:52px;"'+
        'onclick="switchCharacterTab(\'expPool\')">'+
        "經驗池分配"+
        "</button>"+

        '<button id="characterTabBtnStatus" class="home-feature-buy-btn"'+
        'style="flex:1;padding:10px 6px;font-size:18px;min-height:52px;"'+
        'onclick="switchCharacterTab(\'status\')">'+
        "能力值"+
        "</button>"+

        '<button id="characterTabBtnSkill" class="home-feature-buy-btn"'+
        'style="flex:1;padding:10px 6px;font-size:18px;min-height:52px;"'+
        'onclick="switchCharacterTab(\'skill\')">'+
        "技能"+
        "</button>"+

        "</div>"+

        /*
           ★ 修正（依照使用者回報，「技能
           頁面不能捲動，導致下面技能看
           不到」）：
           原本min-height寫死480px，在
           手機瀏覽器（尤其網址列還顯示著
           的Samsung Browser）實際可視
           高度比較矮的時候，480px這個
           下限硬是比max-height:60dvh還
           高，CSS規則裡min-height優先權
           比max-height高，等於這個容器
           永遠至少480px高，跟外層
           .home-feature-modal-box自己
           的高度上限（80dvh／.wide時
           96dvh）擠在一起，容易兩層都
           超出、變成「外層容器+內層
           容器」兩個都要捲動的巢狀捲動，
           手機上很容易卡住、感覺完全
           捲不動。

           改成min(480px,50dvh)——內容
           較多的分頁（能力值）還是盡量
           抓滿480px這個理想值，但螢幕
           真的矮的時候會自動讓步，
           不會硬撐出兩層都要捲動的
           衝突，同時因為每次算出來的
           還是同一個固定值（不會因為
           切分頁而改變），原本「切分頁
           大小不跳動」的需求還是有保留。
        */

        '<div id="characterTabContent"'+
        'style="flex:1 1 auto;height:auto;min-height:0;max-height:none;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;overscroll-behavior-y:contain;touch-action:pan-y;box-sizing:border-box;"></div>';


    return html;

}


/* =====================================================
   ★ 每日任務
===================================================== */

/* =====================================================
   ★ 離線經驗
===================================================== */

function renderOfflineExpContent(){

    const hours=

        Math.floor(
            offlineElapsedMinutesForDisplay/60
        );

    const minutes=

        offlineElapsedMinutesForDisplay%
        60;


    const cappedNotice=

        offlineElapsedMinutesForDisplay>
        OFFLINE_EXP_MAX_MINUTES
        ?
        '<div style="font-size:11px;color:#e8836b;margin-top:4px;">'+
        "（離線經驗最多只計算8小時，超過的部分不會額外累積）"+
        "</div>"
        :
        "";


    return (

        '<div style="font-size:13px;line-height:1.8;">'+

        "離線時間："+hours+"小時"+minutes+"分鐘<br>"+

        "可領取離線經驗："+
        '<span style="color:#f0b429;font-weight:bold;">'+
        pendingOfflineExp+
        "</span>"+
        "EXP"+

        cappedNotice+

        '<div style="font-size:11px;color:#b3a58c;margin-top:8px;">'+
        "離線經驗會直接加進共用經驗池，"+
        "每分鐘"+OFFLINE_EXP_PER_MINUTE+"點，"+
        "最多計算8小時。"+
        "</div>"+

        "</div>"+

        '<button class="home-feature-buy-btn"style="width:100%;margin-top:12px;padding:10px;"'+

        (
            pendingOfflineExp<=0
            ?
            "disabled"
            :
            ""
        )+

        'onclick="claimOfflineExp()">'+

        (
            pendingOfflineExp<=0
            ?
            "目前沒有可領取的離線經驗"
            :
            "領取"+pendingOfflineExp+"離線經驗"
        )+

        "</button>"+

        /*
           ★ 新增（依照使用者要求，「看廣告
           雙倍領取」的第一個示範用法）：
           只有在有東西可以領取的時候才顯示
           這顆按鈕，呼叫showRewardedAd()，
           成功的callback裡呼叫
           claimOfflineExp(true)（多一個
           參數告訴領取函式「這次是雙倍」）。
        */

        (

            pendingOfflineExp>0
            ?
            '<button class="home-feature-buy-btn"'+
            'style="width:100%;margin-top:8px;padding:10px;'+
            'background:linear-gradient(180deg,#f0b429,#c9791e);'+
            'color:#2a1706;"'+
            'onclick="claimOfflineExpWithAd()">'+
            "看廣告雙倍領取（"+
            (pendingOfflineExp*2)+
            "EXP）"+
            "</button>"
            :
            ""

        )

    );

}


/*
   ★ 新增：看廣告雙倍領取的入口，呼叫
   通用的showRewardedAd()，成功才真的
   雙倍發放，失敗/取消的話什麼都不會
   發生（不會扣任何東西，只是沒拿到
   雙倍加成，原本沒看廣告的正常領取
   claimOfflineExp()還是可以照常使用）。
*/

function claimOfflineExpWithAd(){

    if(pendingOfflineExp<=0){
        return;
    }


    showRewardedAd(
        ()=>{

            claimOfflineExp(
                true
            );

        },
        ()=>{

            addBattleLog(
                "廣告未看完，無法領取雙倍獎勵。"
            );

        }
    );

}


function claimOfflineExp(
    isDoubled
){

    if(pendingOfflineExp<=0){
        return;
    }


    /*
       ★ 修正：加了isDoubled這個參數，
       看廣告成功時傳true，實際存入經驗池
       的數字乘以2；一般沒看廣告的領取
       維持原本數字不變。
    */

    const rewardAmount=

        isDoubled
        ?
        pendingOfflineExp*2
        :
        pendingOfflineExp;


    sharedExp=
        sharedExp+
        rewardAmount;


    addBattleLog(

        (
            isDoubled
            ?
            "廣告雙倍領取離線經驗"
            :
            "領取離線經驗"
        )+
        rewardAmount+
        "點，已存入經驗池。"

    );


    pendingOfflineExp=
        0;


    updateUI();

    saveGame();


    const bodyEl=
        $("homeFeatureModalBody");


    if(bodyEl){

        bodyEl.innerHTML=
            renderOfflineExpContent();

    }

}


/*
   ★ 修正（依照使用者要求，任務改成兩個
   分頁：每日任務／委託任務）：
   原本renderQuestContent()整段邏輯抽成
   通用版本renderQuestListGeneric()，
   吃「技能定義清單/狀態物件/領取函式
   名稱」三個參數，每日任務、委託任務
   共用同一份渲染邏輯，不用寫兩次幾乎
   一樣的程式碼。
*/

function formatQuestReward(reward){

    const parts=[];

    if(reward.gold){
        parts.push(
            "金幣 "+reward.gold
        );
    }

    if(reward.exp){
        parts.push(
            "EXP "+reward.exp
        );
    }

    return parts.join("　");

}


/* =====================================================
   V89 — 任務完成度獎勵骨架
   - 20 / 40 / 60 / 80 / 100 五階段。
   - 目前只建立 UI 與完成度計算，不發放任何獎勵、不寫入存檔。
   - 完成度依「所有任務目標的累積進度 / 所有目標總量」計算，
     讓每日 3 任務、委託 2 任務也能自然跨過 20% 階段。
===================================================== */
const QUEST_COMPLETION_MILESTONES=[
    20,40,60,80,100
];


function getQuestCompletionPercent(
    definitions,
    state
){

    let totalGoal=0;
    let totalProgress=0;

    definitions.forEach(function(quest){

        const goal=
            Math.max(
                0,
                Number(quest.goal)||0
            );

        const progress=
            Math.max(
                0,
                Number(
                    state.progress[quest.id]
                )||0
            );

        totalGoal+=goal;
        totalProgress+=
            Math.min(
                goal,
                progress
            );

    });

    if(totalGoal<=0){
        return 100;
    }

    return Math.min(
        100,
        Math.max(
            0,
            totalProgress/totalGoal*100
        )
    );

}


function renderQuestCompletionPanelContent(
    definitions,
    state
){

    const percent=
        getQuestCompletionPercent(
            definitions,
            state
        );

    const displayPercent=
        Math.floor(percent);

    const milestones=
        QUEST_COMPLETION_MILESTONES
        .map(function(threshold){

            const reached=
                percent>=threshold;

            return (
                '<div class="quest-milestone'+
                    (reached ? " reached" : "")+'">'+
                    '<div class="quest-milestone-percent">'+
                        threshold+'%'+
                    '</div>'+
                    '<div class="quest-milestone-slot" aria-label="獎勵待設定">'+
                        '<span>待定</span>'+
                    '</div>'+
                '</div>'
            );

        })
        .join("");

    return (
        '<div class="quest-completion-head">'+
            '<span>完成度獎勵</span>'+
            '<strong>'+displayPercent+'%</strong>'+
        '</div>'+

        '<div class="quest-completion-track" aria-hidden="true">'+
            '<div class="quest-completion-fill" style="width:'+percent+'%;"></div>'+
        '</div>'+

        '<div class="quest-completion-milestones">'+
            milestones+
        '</div>'
    );

}


function renderQuestListGeneric(
    definitions,
    state,
    claimFnName
){

    let html=
        '<div class="quest-list">';


    definitions.forEach(
        quest=>{

            const progress=
                state.progress[
                    quest.id
                ]||0;

            const claimed=
                !!state.claimed[
                    quest.id
                ];

            const done=
                progress>=quest.goal;

            const safeProgress=
                Math.min(
                    progress,
                    quest.goal
                );

            const percent=
                quest.goal>0
                ?
                Math.min(
                    100,
                    Math.max(
                        0,
                        (progress/quest.goal)*100
                    )
                )
                :
                100;

            const statusText=
                claimed
                ?
                "已領取"
                :
                done
                ?
                "可領取"
                :
                "進行中";

            const statusClass=
                claimed
                ?
                "claimed"
                :
                done
                ?
                "ready"
                :
                "progress";

            const buttonText=
                claimed
                ?
                "已領取"
                :
                done
                ?
                "領取"
                :
                "未達成";

            html+=
                '<section class="quest-card '+statusClass+'">'+

                    '<div class="quest-card-head">'+
                        '<div class="quest-card-name">'+
                            quest.name+
                        '</div>'+
                        '<div class="quest-status '+statusClass+'">'+
                            statusText+
                        '</div>'+
                    '</div>'+

                    '<div class="quest-card-desc">'+
                        quest.desc+
                    '</div>'+

                    '<div class="quest-progress-line">'+
                        '<span>進度</span>'+
                        '<strong>'+safeProgress+' / '+quest.goal+'</strong>'+
                    '</div>'+

                    '<div class="quest-progress-track" aria-hidden="true">'+
                        '<div class="quest-progress-fill" style="width:'+percent+'%;"></div>'+
                    '</div>'+

                    '<div class="quest-card-foot">'+
                        '<div class="quest-reward">'+
                            '<span class="quest-reward-label">獎勵</span>'+
                            '<span>'+formatQuestReward(quest.reward)+'</span>'+
                        '</div>'+

                        '<button class="quest-claim-btn"'+
                            (
                                !done || claimed
                                ?
                                " disabled"
                                :
                                ""
                            )+
                            ' onclick="'+claimFnName+'(\''+quest.id+'\')">'+
                            buttonText+
                        '</button>'+
                    '</div>'+

                '</section>';

        }
    );


    html+=
        "</div>";

    return html;

}


function renderDailyQuestListContent(){

    return renderQuestListGeneric(
        dailyQuestDefinitions,
        dailyQuestState,
        "claimDailyQuest"
    );

}


function renderCommissionQuestListContent(){

    return renderQuestListGeneric(
        commissionQuestDefinitions,
        commissionQuestState,
        "claimCommissionQuest"
    );

}


/*
   V89：任務視窗為「固定標籤列 + 內層任務清單 + 固定完成度獎勵」架構。
   #questTabBody 是任務唯一 scroll owner；標題與兩個標籤不跟著捲。
*/
function renderQuestTabContent(activeTab){

    const isCommission=
        activeTab==="commission";

    return (
        '<div class="quest-interface">'+

            '<div class="quest-tabs" role="tablist" aria-label="任務分類">'+

                '<button id="questTabBtnDaily" class="quest-tab'+
                    (!isCommission ? " active" : "")+'"'+
                    ' role="tab" aria-selected="'+(!isCommission ? "true" : "false")+'"'+
                    ' onclick="switchQuestTab(\'daily\')">'+
                    "每日任務"+
                '</button>'+

                '<button id="questTabBtnCommission" class="quest-tab'+
                    (isCommission ? " active" : "")+'"'+
                    ' role="tab" aria-selected="'+(isCommission ? "true" : "false")+'"'+
                    ' onclick="switchQuestTab(\'commission\')">'+
                    "委託任務"+
                '</button>'+

            '</div>'+

            '<div id="questTabBody" class="quest-tab-body" role="tabpanel">'+
                (
                    isCommission
                    ?
                    renderCommissionQuestListContent()
                    :
                    renderDailyQuestListContent()
                )+
            '</div>'+

            '<div id="questCompletionPanel" class="quest-completion-panel">'+
                renderQuestCompletionPanelContent(
                    isCommission
                    ? commissionQuestDefinitions
                    : dailyQuestDefinitions,
                    isCommission
                    ? commissionQuestState
                    : dailyQuestState
                )+
            '</div>'+

        '</div>'
    );

}


function switchQuestTab(tabName){

    const container=
        $("questTabBody");

    if(!container){
        return;
    }

    const isCommission=
        tabName==="commission";

    container.innerHTML=
        isCommission
        ?
        renderCommissionQuestListContent()
        :
        renderDailyQuestListContent();

    container.scrollTop=
        0;

    const completionPanel=
        $("questCompletionPanel");

    if(completionPanel){

        completionPanel.innerHTML=
            renderQuestCompletionPanelContent(
                isCommission
                ? commissionQuestDefinitions
                : dailyQuestDefinitions,
                isCommission
                ? commissionQuestState
                : dailyQuestState
            );

    }

    const dailyBtn=
        $("questTabBtnDaily");

    const commissionBtn=
        $("questTabBtnCommission");

    if(dailyBtn){
        dailyBtn.classList.toggle(
            "active",
            !isCommission
        );
        dailyBtn.setAttribute(
            "aria-selected",
            !isCommission ? "true" : "false"
        );
    }

    if(commissionBtn){
        commissionBtn.classList.toggle(
            "active",
            isCommission
        );
        commissionBtn.setAttribute(
            "aria-selected",
            isCommission ? "true" : "false"
        );
    }

}


/*
   ★ 新增（依照使用者要求，新增副本/BOSS
   兩個導覽列項目，各自2個分頁）：
   目前只先做出「分頁切換」這套骨架跟
   說明文字，實際的副本/BOSS戰鬥規則
   （怪物強度、獎勵、每天能挑戰幾次、
   跟現有練功區的差異是什麼）都還沒定案，
   等使用者提供規則後再實際接上戰鬥
   邏輯——這裡先確保切分頁的介面是
   通的，之後要換內容只需要改
   render函式，不用動HTML結構。
*/

function renderDungeonTabContent(tabName){

    if(tabName==="abyss"){

        return (

            '<div style="font-size:13px;line-height:1.8;color:#b3a58c;">'+
            "深淵副本尚未設計完成。"+
            "</div>"

        );

    }


    return (

        '<div style="font-size:13px;line-height:1.8;color:#b3a58c;">'+
        "日常副本尚未設計完成。"+
        "</div>"

    );

}


function switchDungeonTab(tabName){

    const container=
        $("dungeonTabContent");


    if(!container){
        return;
    }


    container.innerHTML=

        renderDungeonTabContent(
            tabName
        );


    ["Daily","Abyss"].forEach(
        name=>{

            const btn=
                $("dungeonTabBtn"+name);


            if(btn){

                btn.style.opacity=

                    name.toLowerCase()===
                    tabName
                    ?
                    "1"
                    :
                    ".55";

            }

        }
    );

}


function renderBossTabContent(tabName){

    if(tabName==="hell"){

        return (

            '<div style="font-size:13px;line-height:1.8;color:#b3a58c;">'+
            "地獄BOSS尚未設計完成。"+
            "</div>"

        );

    }


    return (

        '<div style="font-size:13px;line-height:1.8;color:#b3a58c;">'+
        "個人BOSS尚未設計完成。"+
        "</div>"

    );

}


function switchBossTab(tabName){

    const container=
        $("bossTabContent");


    if(!container){
        return;
    }


    container.innerHTML=

        renderBossTabContent(
            tabName
        );


    ["Personal","Hell"].forEach(
        name=>{

            const btn=
                $("bossTabBtn"+name);


            if(btn){

                btn.style.opacity=

                    name.toLowerCase()===
                    tabName
                    ?
                    "1"
                    :
                    ".55";

            }

        }
    );

}




function claimDailyQuest(questId){

    const quest=

        dailyQuestDefinitions.find(
            q=>q.id===questId
        );


    if(!quest){
        return;
    }


    const progress=

        dailyQuestState.progress[
            questId
        ]||0;


    if(
        progress<quest.goal ||
        dailyQuestState.claimed[questId]
    ){
        return;
    }


    dailyQuestState.claimed[questId]=
        true;


    if(quest.reward.gold){

        gold=
            gold+
            quest.reward.gold;

    }


    if(quest.reward.exp){

        sharedExp=
            sharedExp+
            quest.reward.exp;

    }


    updateGoldDisplay();

    updateUI();

    saveGame();


    /*
       ★ 修正：改成只重繪#questTabBody
       這個容器（維持在「每日任務」分頁），
       不再整個視窗重來——renderQuestContent()
       這個舊函式已經拆成兩個分頁各自的
       渲染函式，不存在了。
    */

    switchQuestTab(
        "daily"
    );

}


function claimCommissionQuest(questId){

    const quest=

        commissionQuestDefinitions.find(
            q=>q.id===questId
        );


    if(!quest){
        return;
    }


    const progress=

        commissionQuestState.progress[
            questId
        ]||0;


    if(
        progress<quest.goal ||
        commissionQuestState.claimed[questId]
    ){
        return;
    }


    commissionQuestState.claimed[questId]=
        true;


    if(quest.reward.gold){

        gold=
            gold+
            quest.reward.gold;

    }


    if(quest.reward.exp){

        sharedExp=
            sharedExp+
            quest.reward.exp;

    }


    updateGoldDisplay();

    updateUI();

    saveGame();


    switchQuestTab(
        "commission"
    );

}


/* =====================================================
   ★ 圖鑑
===================================================== */

function renderBestiaryContent(){

    const allZoneArrays=[
        forestMonsters,
        desertMonsters,
        iceMountainMonsters,
        zone4Monsters,
        zone5Monsters,
        zone6Monsters,
        zone7Monsters,
        zone8Monsters
    ];


    const seenNames=
        new Set();


    let html=
        "";


    allZoneArrays.forEach(
        zoneArray=>{

            zoneArray.forEach(
                monster=>{

                    if(
                        seenNames.has(
                            monster.name
                        )
                    ){
                        return;
                    }


                    seenNames.add(
                        monster.name
                    );


                    const entry=

                        bestiaryData[
                            monster.name
                        ];


                    const element=

                        elementDatabase[
                            monster.element
                        ]
                        ||
                        elementDatabase.fire;


                    html+=

                        '<div class="home-feature-row">'+

                        "<span>"+

                        (
                            entry && entry.seen
                            ?
                            getElementIconHTML(
                                monster.element
                            )+
                            ""+monster.name
                            :
                            "？？？"
                        )+

                        "</span>"+

                        "<span>"+

                        (
                            entry && entry.seen
                            ?
                            "擊殺"+(entry.kills||0)
                            :
                            "未遇見"
                        )+

                        "</span>"+

                        "</div>";

                }
            );

        }
    );


    return html;

}


/* =====================================================
   ★ 成就
===================================================== */

function renderAchievementContent(){

    let html=
        "";


    achievementDefinitions.forEach(
        achievement=>{

            const done=

                achievement.check();


            const claimed=

                achievementState[
                    achievement.id
                ];


            const rewardText=

                Object.keys(
                    achievement.reward
                )
                .map(
                    key=>
                        achievement.reward[key]+""
                )
                .join("、");


            html+=

                '<div class="home-feature-row">'+

                "<span>"+
                achievement.name+
                "<br>"+
                '<span style="font-size:11px;color:#b3a58c;">'+
                achievement.desc+
                "獎勵："+rewardText+
                "</span>"+
                "</span>"+

                '<button class="home-feature-buy-btn"'+

                (
                    !done || claimed
                    ?
                    "disabled"
                    :
                    ""
                )+

                'onclick="claimAchievement(\''+
                achievement.id+
                '\')">'+

                (
                    claimed
                    ?
                    "已領取"
                    :
                    done
                    ?
                    "領取"
                    :
                    "未達成"
                )+

                "</button>"+

                "</div>";

        }
    );


    return html;

}


function claimAchievement(achievementId){

    const achievement=

        achievementDefinitions.find(
            a=>a.id===achievementId
        );


    if(!achievement){
        return;
    }


    if(
        !achievement.check() ||
        achievementState[achievementId]
    ){
        return;
    }


    achievementState[achievementId]=
        true;


    if(achievement.reward.gold){

        gold=
            gold+
            achievement.reward.gold;

    }


    updateGoldDisplay();

    saveGame();


    const bodyEl=
        $("homeFeatureModalBody");


    if(bodyEl){

        bodyEl.innerHTML=
            renderAchievementContent();

    }

}


/* =====================================================
   ★ 公告
===================================================== */

function renderAnnouncementContent(){

    return (

        '<div style="font-size:13px;line-height:1.8;">'+

        "主城全新改版！<br>"+
        "新增商店、圖鑑、每日任務、成就系統，"+
        "歡迎慢慢逛逛。<br><br>"+

        "開發中功能：<br>"+
        "更多裝備、更多地區、更多技能，"+
        "陸續更新中。"+

        "</div>"

    );

}


function renderSystemContent(){

    return (
        '<div class="system-panel">'+
            '<div class="system-panel-row">'+
                '<div><strong>遊戲存檔</strong><small>目前遊戲會自動存檔，也可以立即手動保存。</small></div>'+
                '<button class="home-feature-buy-btn" onclick="saveGame();alert(\'已完成手動存檔。\')">立即存檔</button>'+
            '</div>'+
            '<div class="system-panel-row danger">'+
                '<div><strong>重新開始</strong><small>刪除本機角色與進度，重新建立角色。</small></div>'+
                '<button class="home-feature-buy-btn" onclick="resetGame()">刪除存檔</button>'+
            '</div>'+
        '</div>'
    );

}


function restAtHome(){

    if(battleActive){

        alert(
            "戰鬥中無法休息。"
        );

        return;

    }


    const stats =
        getMainCharacterStats();


    if(
        player.hp>=stats.maxHP &&
        player.sp>=stats.maxSP
    ){

        alert(
            "HP、SP 已經是滿的了。"
        );

        return;

    }


    player.hp =
        stats.maxHP;


    player.sp =
        stats.maxSP;


    updateUI();

    saveGame();


    alert(
        "休息完畢，HP／SP 已經全部補滿。"
    );

}


/* =====================================================
   V92 — 主城開發測試快捷鍵
===================================================== */

function grantTestGoldMillion(){
    gold=
        Math.max(0,Math.floor(Number(gold)||0))+
        TEST_GOLD_GRANT;

    updateGoldDisplay();
    updateUI();
    saveGame();

    alert(
        "金幣 +1,000,000，目前共有 "+
        gold.toLocaleString("zh-TW")+
        " 金幣。"
    );
}

function grantTestExpTenMillion(){
    sharedExp=
        Math.max(0,Math.floor(Number(sharedExp)||0))+
        TEST_EXP_POOL_GRANT;

    updateUI();
    saveGame();

    alert(
        "經驗池 +10,000,000，目前共有 "+
        sharedExp.toLocaleString("zh-TW")+
        " EXP。"
    );
}

function updateHomeTestTools(){
    const goldButton=$("testGoldMillionButton");
    const expButton=$("testExpTenMillionButton");

    if(goldButton){
        goldButton.innerHTML="金幣 <b>+100萬</b>";
    }

    if(expButton){
        expButton.innerHTML="經驗池 <b>+1000萬</b>";
    }
}


/*
   ★ 測試用：技能點 +999。

   純粹方便你測試技能效果（尤其是燃燒這種
   需要一路升級才看得出差異的技能），
   之後正式版上線前記得把這張卡片
   跟這個函式一起拿掉。
*/

function grantTestSkillPoints(){

    /*
       ★ 修正：
       原本這裡寫死只加給player（第一角色），
       第二角色永遠測試不到「給點數」這個按鈕，
       容易讓人誤以為第二角色的技能點是從別的地方
       （甚至bug）冒出來的。
       改成player2存在的話兩邊都各加999，
       測試哪個角色都方便。
    */

    player.skillPoints+=999;


    let message=

        "技能點 +999，「"+
        (player.id||"第一角色")+
        "」目前共有"+
        player.skillPoints+
        "點。";


    if(player2){

        player2.skillPoints+=999;


        message+=

            "\n「"+
            player2.id+
            "」目前共有"+
            player2.skillPoints+
            "點。";

    }


    updateUI();

    renderSkillLoadout();

    saveGame();


    alert(
        message
    );

}


/*
   ★ 新增（測試用）：經驗池 +100000。

   純粹方便測試升級、技能開放門檻這類
   需要練功練很久才看得到效果的東西，
   直接把經驗存進共用經驗池，
   之後要不要分給角色還是照原本的方式
   自己去分配。之後正式版上線前記得
   把這個按鈕跟這個函式一起拿掉。
*/

function grantTestExp(){

    sharedExp+=100000;

    updateUI();

    saveGame();


    alert(
        "經驗池 +100000，目前共有"+
        sharedExp+
        "點經驗值。"
    );

}


function distributeExpToPlayer(){

    distributeExpToCharacter(
        player
    );

}


/*
   ★ 新增：分配經驗值給第二角色。
   跟distributeExpToPlayer()是同一套邏輯，
   直接呼叫共用函式，只是換一個角色物件。
*/

function distributeExpToPlayer2(){

    if(!player2){
        return;
    }


    distributeExpToCharacter(
        player2
    );

}


/*
   把distributeExpToPlayer()原本的邏輯
   抽成通用函式，player/player2共用同一套，
   不用維護兩份幾乎一樣的程式碼。
*/

function distributeExpToCharacter(character){

    if(battleActive){

        alert(
            "戰鬥中無法分配經驗值。"
        );

        return;

    }


    if(sharedExp<=0){
        return;
    }


    /*
       ★ 修正：
       原本是把經驗池「全部」一次塞給角色，
       可能一次連續升好幾級，
       而且會把經驗池清空，
       導致玩家沒辦法把剩下的經驗
       留給其他角色。

       改成：每按一次，只轉移「剛好升上下一級」
       所需要的經驗值，一次只升一級。
       如果經驗池不夠升一級，
       就不轉移、提示還差多少，
       避免經驗值卡在一個不上不下的狀態。

       ★ 新增防呆：
       如果角色的exp不知道為什麼已經超過expNext
       （理論上不該發生，但存檔可能因為某些操作
       留下不一致的資料），needed會變成負數或0，
       這樣「sharedExp<needed」這個判斷永遠是false，
       等於白白從經驗池那裡「偷」到exp，
       還可能讓checkLevelUp()一次跑很多輪，
       灌出離譜的技能點/屬性點數字。
       這裡先把needed夾在最小1，
       徹底避免這個漏洞。
    */

    const needed =
        Math.max(
            1,
            character.expNext-
            character.exp
        );


    if(sharedExp<needed){

        alert(
            "經驗池不足以升級，還差"+
            (needed-sharedExp)+
            "EXP。"
        );

        return;

    }


    character.exp +=
        needed;

    sharedExp -=
        needed;


    checkLevelUp(
        character
    );

    updateUI();

    saveGame();

}


function renderExpDistributeList(){

    const container =
        $("expDistributeList");


    if(!container){
        return;
    }


    container.innerHTML="";


    const element =
        elementDatabase[
            player.element
        ]||
        elementDatabase.fire;


    const needed =
        Math.max(
            0,
            player.expNext-
            player.exp
        );


    const mainRow =
        document.createElement(
            "div"
        );


    mainRow.innerHTML =

        `
        <button
            id="distributeMainButton"
            class="exp-distribute-button"
        >
            <span class="exp-character-icon">${element.icon}</span>
            <span class="exp-character-copy">
                <strong>${player.id||element.character}</strong>
                <small>Lv.${player.level} → Lv.${player.level+1}</small>
            </span>
            <span class="exp-character-cost">
                <b>${needed.toLocaleString("zh-TW")}</b>
                <small>EXP</small>
            </span>
        </button>
        `;


    container.appendChild(
        mainRow
    );


    /*
       ★ 一次只升一級：
       經驗池不夠升下一級時直接鎖住按鈕，
       不會讓玩家誤按後把經驗池清空
       卻升不了級。
    */

    $("distributeMainButton")
        .disabled =
        sharedExp<needed ||
        battleActive;


    $("distributeMainButton")
        .onclick =
        distributeExpToPlayer;


    /*
       ★ 第二角色的分配按鈕（新增）。
       player2存在的話顯示真正可以按的按鈕，
       邏輯跟第一角色的按鈕完全對稱。
    */

    if(player2){

        const player2Row=
            document.createElement(
                "div"
            );


        const needed2=
            Math.max(
                0,
                player2.expNext-
                player2.exp
            );


        player2Row.innerHTML=

            `
            <button
                id="distributePlayer2Button"
                class="exp-distribute-button"
            >
                <span class="exp-character-icon">◆</span>
                <span class="exp-character-copy">
                    <strong>${player2.id}</strong>
                    <small>Lv.${player2.level} → Lv.${player2.level+1}</small>
                </span>
                <span class="exp-character-cost">
                    <b>${needed2.toLocaleString("zh-TW")}</b>
                    <small>EXP</small>
                </span>
            </button>
            `;


        container.appendChild(
            player2Row
        );


        $("distributePlayer2Button")
            .disabled=

            sharedExp<needed2 ||
            battleActive;


        $("distributePlayer2Button")
            .onclick=
            distributeExpToPlayer2;

    }


    /*
       ★ 修正：
       水戰士／風弓手這兩個鎖定佔位按鈕
       依照玩家要求整個拿掉，不再顯示，
       這兩個目前本來就沒有真正的角色資料
       （除非玩家創建第二角色時剛好選了同樣元素，
       但那個情況下實際掛的是player2，
       不是這裡的水/風佔位符），
       留著只是多餘的視覺雜訊。
    */

}


/* =====================================================
   狀態加點
===================================================== */

/*
   ★ 狀態頁切換角色（新增）。
   切換的時候要把pendingStats清空，
   不然「還沒確認的加點」會誤帶到另一個角色身上。
*/

function changeStatusCharacter(direction){

    if(!player2){
        return;
    }


    statusCharacterIndex=

        statusCharacterIndex===0
        ?
        1
        :
        0;


    Object.keys(
        pendingStats
    )
    .forEach(stat=>{

        pendingStats[stat]=0;

    });


    updateStatusPreview();

}


/*
   ★ 新增（依照使用者要求，「加點要新增
   長按快速加點比較簡單，還是雙箭頭按一下
   +10比較簡單，妳直接選一個」——選了
   長按方案）：

   共用的「長按持續觸發」小工具。按下
   （touchstart/mousedown）先等500毫秒
   （避免手滑輕點也被當成長按），接著
   每120毫秒自動呼叫一次傳進來的函式，
   直到放開/手指移出/滑走為止
   （touchend/touchcancel/mouseup/
   mouseleave全部都要清掉計時器，
   任何一種放開手指的方式都不能漏接，
   不然計時器會卡住一直加下去）。

   6組+/-按鈕（攻擊/體質/能量/智力/
   精神/敏捷）全部呼叫這個函式，不用
   每顆按鈕各寫一份長按邏輯。
*/

function attachLongPress(el,fn){

    if(!el){
        return;
    }


    let holdTimeout=null;

    let repeatInterval=null;


    function stop(){

        if(holdTimeout){
            clearTimeout(holdTimeout);
            holdTimeout=null;
        }


        if(repeatInterval){
            clearInterval(repeatInterval);
            repeatInterval=null;
        }

    }


    function start(e){

        e.preventDefault();

        fn();


        stop();


        holdTimeout=
            setTimeout(
                ()=>{

                    repeatInterval=
                        setInterval(
                            fn,
                            120
                        );

                },
                500
            );

    }


    el.addEventListener(
        "touchstart",
        start,
        {passive:false}
    );

    el.addEventListener(
        "mousedown",
        start
    );


    [
        "touchend",
        "touchcancel",
        "mouseup",
        "mouseleave"
    ].forEach(evtName=>{

        el.addEventListener(
            evtName,
            stop
        );

    });

}


function addPoint(stat){

    if(
        !Object.prototype.hasOwnProperty.call(
            pendingStats,
            stat
        )
    ){
        return;
    }


    const targetCharacter=
        getStatusCharacterObject();


    const used =
        Object.values(
            pendingStats
        )
        .reduce(
            (sum,value)=>
                sum+value,
            0
        );


    if(
        used>=
        targetCharacter.attributePoints
    ){
        return;
    }


    pendingStats[stat]++;


    updateStatusPreview();

}


/*
   ★ 新增（依照使用者指正）：
   之前這裡只有addPoint()，完全沒有對應的
   減號函式，導致狀態頁面分配升級點數的地方
   只能加、不能扣，跟創角頁面（本來就有
   加減兩顆按鈕）不一致。
   補上removePoint()，只能扣掉「這次還沒
   確認、暫存中」的點數，不會動到角色
   已經生效的屬性值，邏輯上跟創角頁面的
   creationAdd(stat,-1)是同一種做法。
*/

function removePoint(stat){

    if(
        !Object.prototype.hasOwnProperty.call(
            pendingStats,
            stat
        )
    ){
        return;
    }


    if(
        pendingStats[stat]<=0
    ){
        return;
    }


    pendingStats[stat]--;


    updateStatusPreview();

}


function updateStatusPreview(){

    /*
       ★ 修正：
       原本這整個函式都寫死認player，
       第二角色沒辦法用狀態頁加點。
       改成先抓「目前選中的角色」
       （player或player2），
       下面所有計算都對這個角色做，
       不用整個函式重寫兩份。
    */

    const targetCharacter=
        getStatusCharacterObject();


    const current = {

        attack:
            targetCharacter.attack+
            pendingStats.attack,

        vitality:
            targetCharacter.vitality+
            pendingStats.vitality,

        energy:
            targetCharacter.energy+
            pendingStats.energy,

        intelligence:
            targetCharacter.intelligence+
            pendingStats.intelligence,

        spirit:
            targetCharacter.spirit+
            pendingStats.spirit,

        agility:
            targetCharacter.agility+
            pendingStats.agility

    };


    /*
       ★ 新增（依照使用者要求，「點數分配
       顯示當前角色的HP、SP條，加點體質/
       能量時可以預覽增加的動畫，血條會
       合理縮短」）：
       maxHP/maxSP公式跟getBaseStats()
       裡的算法完全一致（1體質=+50HP，
       1能量=+15SP），只是這裡改成吃
       targetCharacter（可能是player或
       player2），不能直接呼叫
       getBaseStats()（那個函式寫死抓
       player），自己重算一次。

       目前HP/SP（targetCharacter.hp／.sp）
       不會因為預覽加點而改變，只有「上限」
       會跟著pendingStats.vitality／.energy
       即時預覽變化——這樣血條寬度
       （現在HP÷預覽後上限）就會自然
       隨著上限變大而縮短，不用另外寫
       「縮短動畫」的特殊邏輯。
    */

    const previewMaxHP=

        100+
        current.vitality*50+
        (targetCharacter.bonusHP||0);


    const previewMaxSP=

        50+
        current.energy*15+
        (targetCharacter.bonusSP||0);


    const currentHP=

        Math.min(
            targetCharacter.hp||0,
            previewMaxHP
        );


    const currentSP=

        Math.min(
            targetCharacter.sp||0,
            previewMaxSP
        );


    $("statusPreviewHpText")
        .textContent=

        currentHP+
        "／"+
        previewMaxHP;


    $("statusPreviewSpText")
        .textContent=

        currentSP+
        "／"+
        previewMaxSP;


    $("statusPreviewHpFill")
        .style.width=

        (
            previewMaxHP>0
            ?
            (currentHP/previewMaxHP*100)
            :
            0
        )+
        "%";


    $("statusPreviewSpFill")
        .style.width=

        (
            previewMaxSP>0
            ?
            (currentSP/previewMaxSP*100)
            :
            0
        )+
        "%";


    /*
       ★ 新增：
       狀態頁面現在會顯示
       「玩家點數 + 裝備加成 = 總合」，
       而不是只顯示玩家自己加點的數字。
       裝備加成抓對應角色的裝備欄
       （player→player.element、
       player2→固定"player2"這個key），
       跟主城、背包頁看到的邏輯一致。
    */

    const equipmentBonus =
        getEquipmentBonus(
            targetCharacter===player2
            ?
            "player2"
            :
            player.element
        );


    function formatStatLine(
        baseValue,
        bonusValue
    ){

        /*
           ★ 修正：
           之前裝備加成是0的時候只顯示單一數字，
           玩家沒裝備東西時完全看不出
           「有在算裝備加成」這件事，
           以為沒生效。
           改成一律顯示「基礎+裝備=總合」，
           就算裝備加成是0也一樣顯示，
           例如 9+0=9。
        */

        return (
            baseValue+
            "+"+
            bonusValue+
            "="+
            (
                baseValue+
                bonusValue
            )
        );

    }


    $("statusAttack")
        .textContent =
        formatStatLine(
            current.attack,
            equipmentBonus.attack
        );


    $("statusVitality")
        .textContent =
        formatStatLine(
            current.vitality,
            equipmentBonus.vitality
        );


    $("statusEnergy")
        .textContent =
        formatStatLine(
            current.energy,
            equipmentBonus.energy
        );


    $("statusIntelligence")
        .textContent =
        formatStatLine(
            current.intelligence,
            equipmentBonus.intelligence
        );


    $("statusSpirit")
        .textContent =
        formatStatLine(
            current.spirit,
            equipmentBonus.spirit
        );


    $("statusAgility")
        .textContent =
        formatStatLine(
            current.agility,
            equipmentBonus.agility
        );


    const used =
        Object.values(
            pendingStats
        )
        .reduce(
            (sum,value)=>
                sum+value,
            0
        );


    $("attributePoints")
        .textContent =
        Math.max(
            0,
            targetCharacter.attributePoints-used
        );


    $("confirmStatusButton")
        .disabled =
        used===0;


    /*
       ★ 修正（真正抓到「箭頭區塊怎麼關都關
       不掉」的原因）：
       這裡原本無條件依照player2存不存在
       重新設定顯示狀態，完全不知道這個
       區塊現在是不是正被角色視窗
       （switchCharacterTab()）故意借走
       隱藏——只要玩家點一次+/-按鈕，
       這裡就會把隱藏的效果蓋掉、重新
       顯示出來，這才是「怎麼隱藏都沒用」
       的真正原因。

       加一個判斷：如果這個元素正是
       homeFeatureHiddenSwitchCard記錄的
       那一個（代表目前正被角色視窗借走），
       就跳過這裡的顯示邏輯，維持隱藏，
       不要蓋掉。
    */

    const switchCard=
        $("statusCharacterSwitchCard");


    const nameBox=
        $("statusCharacterName");


    if(
        switchCard &&
        switchCard!==
        homeFeatureHiddenSwitchCard
    ){

        switchCard.style.display=

            player2
            ?
            "block"
            :
            "none";

    }


    if(nameBox){

        nameBox.textContent=

            targetCharacter===player2
            ?
            (
                ""+
                player2.id+
                "Lv."+
                player2.level
            )
            :
            (
                ""+
                (
                    player.id||
                    "冒險者"
                )+
                "Lv."+
                player.level
            );

    }

}


function confirmStatus(){

    const targetCharacter=
        getStatusCharacterObject();


    const used =
        Object.values(
            pendingStats
        )
        .reduce(
            (sum,value)=>
                sum+value,
            0
        );


    if(
        used<=0 ||
        used>
        targetCharacter.attributePoints
    ){
        return;
    }


    /*
       ★ 一次確認後全部歸零，
       不會出現之前「確認後還能亂按」造成當機。
    */

    Object.keys(
        pendingStats
    )
    .forEach(stat=>{

        targetCharacter[stat] +=
            pendingStats[stat];

        pendingStats[stat]=0;

    });


    targetCharacter.attributePoints -=
        used;


    updateStatusPreview();

    updateUI();

    saveGame();

}


/* =====================================================
   技能
===================================================== */

function changeSkillCharacterArrow(direction){

    /*
       ★ 修正：
       原本是<select>下拉選單，
       改成跟狀態頁一致的左右箭頭切換，
       水戰士/風弓手這兩個目前沒有真正角色資料的
       選項也一併拿掉，
       只在fire（第一角色）跟player2（第二角色，
       存在的話）之間切換，比較不會誤導玩家
       以為水/風也能正常用。
    */

    if(
        currentSkillCharacter==="fire"&&
        player2
    ){

        currentSkillCharacter=
            "player2";

    }
    else{

        currentSkillCharacter=
            "fire";

    }


    renderSkillLoadout();

}


function getSkillCharacterObject(characterId){

    /*
       ★ 新增：
       技能學習/升級要花的技能點，
       目前只有player（fire）跟player2
       這兩個角色有真正獨立的skillPoints，
       water/wind還只是裝備用的空殼，
       沒有背後的角色資料，回傳null，
       呼叫的地方要自己判斷null的情況。
    */

    if(characterId==="fire"){
        return player;
    }


    if(
        characterId==="player2"&&
        player2
    ){
        return player2;
    }


    return null;

}


function renderSkillLoadout(){

    /*
       ★ 修正：
       原本是更新<select>裡兩個<option>的文字，
       現在UI改成左右箭頭+一個名字方塊，
       改成直接更新那個方塊的文字，
       顯示目前選中角色的名字+等級，
       跟狀態頁的切換卡片邏輯一致。
    */

    const nameBox=
        $("skillCharacterNameBox");


    if(nameBox){

        if(
            currentSkillCharacter==="player2"&&
            player2
        ){

            nameBox.textContent=

                ""+
                player2.id+
                "Lv."+
                player2.level;

        }
        else{

            nameBox.textContent=

                ""+
                (
                    player.id||
                    "火法師"
                )+
                "Lv."+
                player.level;

        }

    }


    const character =
        characterSkillLoadouts[
            currentSkillCharacter
        ];


    if(!character){
        return;
    }


    const loadout =
        $("skillLoadout");


    const allList =
        $("allSkillsList");


    loadout.innerHTML="";

    allList.innerHTML="";


    /*
       ★ 修正（依照使用者要求，「技能配裝
       只顯示icon跟名稱，其餘都省略，一排
       四個排一起」）：
       原本每格內容一大串（分類/說明/SP/
       移除按鈕），改成只有圖示+名稱兩行，
       點格子本身直接觸發移除（有裝備時）
       ，不再需要額外的移除按鈕文字佔位置。
    */

    for(
        let i=0;
        i<4;
        i++
    ){

        const skillId =
            character.equippedSkills[i];


        const box =
            document.createElement(
                "div"
            );


        box.className =
            "skill-loadout-slot";


        if(skillId){

            const skill =
                skillDatabase[skillId];


            box.innerHTML =

            `
            <div
                id="loadoutIcon_${skillId}"
                class="skill-loadout-slot-icon"
                style="background-image:${getSkillIconBackgroundImage(skillId)};"
            ></div>
            <div class="skill-loadout-slot-name">
                ${skill.name}
            </div>
            `;


            box.onclick=
                ()=>removeEquippedSkill(i);

        }
        else{

            box.innerHTML =

            `
            <div class="skill-loadout-slot-icon"></div>
            <div
                class="skill-loadout-slot-name"
                style="color:#64748b;"
            >
                空
            </div>
            `;

        }


        loadout.appendChild(
            box
        );

    }


    /*
       ★ 修正（依照使用者要求，「不用特別
       再做一個已學會技能的框了，拿掉，
       現在技能就是用一排一排呈現，沒學習
       的就顯示未學習就好」）：
       原本「已學會技能」「可學習技能」是
       兩個各自獨立的forEach迴圈，各自
       appendChild到不同容器。合併成一個
       迴圈，一次跑過這個角色元素底下的
       全部技能，每一列自己判斷「還沒學／
       已學未滿級／已滿級」該顯示哪種狀態，
       全部append到同一個allList容器。
    */

    const skillLevels =
        character.skillLevels||
        {};


    /*
       ★ 這個角色背後真正的資料物件
       （player或player2），
       用來查詢/顯示技能點數量。
       water/wind目前還沒有真正的角色資料，
       skillOwner會是null，
       下面用到的地方都要防呆處理
       （視為0點技能點，全部技能都不能學/升）。
    */

    const skillOwner=
        getSkillCharacterObject(
            currentSkillCharacter
        );


    const availableSkillPoints=
        skillOwner
        ?
        skillOwner.skillPoints
        :
        0;


    /*
       ★ 修正（依照使用者要求，「技能排版
       增加已學習/未學習的文字分隔區塊，
       不用框線，只要文字區隔；未學習的
       技能一旦學會，自動跑到已學習那邊」）：
       原本是單一個forEach、依資料庫原始
       順序直接把每一列append上去。改成先
       篩出這個角色元素底下的全部技能id，
       分成「已學習」「未學習」兩組陣列，
       個別渲染。因為每次renderSkillLoadout()
       都是重新分組（不是存一份「已學習
       清單」快取），只要學了新技能、
       skillLevels變了，下次重繪就會自動
       被分到「已學習」那組，不用額外寫
       「搬移」的邏輯。
    */

    const matchingSkillIds=

        Object.keys(skillDatabase)
        .filter(skillId=>{

            const skill=
                skillDatabase[skillId];


            return (
                skill &&
                skill.element===
                (
                    skillOwner
                    ?
                    skillOwner.element
                    :
                    currentSkillCharacter
                )
            );

        });


    const learnedIds=

        matchingSkillIds.filter(
            skillId=>
                (skillLevels[skillId]||0)>0
        );


    const unlearnedIds=

        matchingSkillIds.filter(
            skillId=>
                !(skillLevels[skillId]>0)
        );


    /*
       ★ 把「組出一列技能row」這段邏輯抽成
       獨立函式，已學習/未學習兩組都呼叫
       同一份，不用寫兩次一樣的HTML組字串。
    */

    function buildSkillRowElement(skillId){

        const skill =
            skillDatabase[skillId];


        const level =
            skillLevels[skillId]||
            0;


        const isLearned =
            level>0;


        const equipped =
            character.equippedSkills
            .includes(skillId);


        const isMaxLevel =
            isLearned &&
            level>=
            (skill.maxLevel||1);


        const canAfford =
            availableSkillPoints>=
            (skill.learnCost||0);


        const box =
            document.createElement(
                "div"
            );


        box.className =
            "skill-row";


        let actionIcon;
        let actionLabel;
        let actionOnclick;
        let actionDisabled;


        const prereqMet =
            isSkillPrereqMet(
                skillLevels,
                skill
            );


        if(!isLearned){

            actionIcon="";


            /*
               ★ 新增（依照使用者要求，「前置
               技能要學的機制」，且要「完全不能
               點」）：
               前置沒達成時優先顯示鎖住狀態，
               蓋過原本的「學習／點數不足」
               判斷，按鈕強制disabled=true，
               玩家連點都點不了（see上面
               .skill-action-card.disabled的
               pointer-events:none，之前這裡
               有個class字串少打一個空格的
               bug，順便修掉，不然disabled
               樣式其實從來沒真的生效過）。
            */

            actionLabel=
                !prereqMet
                ?
                "🔒 未解鎖"
                :
                (
                    canAfford
                    ?
                    "學習"
                    :
                    "點數不足"
                );

            actionOnclick=
                "learnSkill('"+skillId+"')";

            actionDisabled=
                !prereqMet ||
                !canAfford;

        }
        else if(isMaxLevel){

            actionIcon="";
            actionLabel="已滿級";

            actionOnclick=
                "upgradeSkill('"+skillId+"')";

            actionDisabled=
                true;

        }
        else{

            actionIcon="";

            actionLabel=
                availableSkillPoints<1
                ?
                "點數不足"
                :
                "升級";

            actionOnclick=
                "upgradeSkill('"+skillId+"')";

            actionDisabled=
                availableSkillPoints<1;

        }


        const showEquipButton=

            isLearned &&
            (
                skill.category==="physical"||
                skill.category==="magic"||
                skill.category==="buff"||
                skill.category==="heal"||
                skill.category==="revive"
            );


        box.innerHTML =

        `
        <div
            id="skillIcon_${skillId}"
            class="skill-row-icon"
            style="background-image:${getSkillIconBackgroundImage(skillId)};"
        ></div>

        <div class="skill-row-text">
            <b>${skill.name}</b>
            ${
                isLearned
                ?
                "Lv."+level+
                (
                    skill.maxLevel
                    ?
                    "/"+skill.maxLevel
                    :
                    ""
                )
                :
                '<span style="color:#64748b;">未學習</span>'
            }
            <br>
            <span class="skill-row-desc">
                ${skill.description}
            </span>
            ${
                !isLearned &&
                !prereqMet
                ?
                `
                <br>
                <span style="color:#f59e0b;">
                    🔒 ${getSkillPrereqLabel(skill)}
                </span>
                `
                :
                ""
            }
            <span
                class="skill-row-detail-link"
                onclick="showSkillDetail('${skillId}')"
            >
                ……詳細»
            </span>
        </div>

        <div
            class="skill-action-card${
                actionDisabled
                ?
                " disabled"
                :
                ""
            }"
            onclick="${actionOnclick}"
        >
            <div class="skill-action-card-top">${actionIcon}</div>
            <div class="skill-action-card-label">
                ${actionLabel}
            </div>
        </div>

        ${
            showEquipButton
            ?
            `
            <div
                class="skill-action-card${
                    equipped
                    ?
                    " disabled"
                    :
                    ""
                }"
                onclick="equipSkill('${skillId}')"
            >
                <div class="skill-action-card-top"></div>
                <div class="skill-action-card-label">
                    ${
                        equipped
                        ?
                        "已裝備"
                        :
                        "裝備"
                    }
                </div>
            </div>
            `
            :
            ""
        }
        `;


        return box;

    }


    /*
       ★ 分隔線用的純文字標籤，故意不用
       任何框線/底色，只是一行置中的
       虛線+文字，單純視覺上區隔兩組。
    */

    function buildSkillSectionDivider(label){

        const divider=
            document.createElement(
                "div"
            );


        divider.style.cssText=

            "text-align:center;"+
            "font-size:11px;"+
            "color:#8a7a5c;"+
            "margin:10px 0 4px;";


        divider.textContent=

            "─────"+
            label+
            "─────";


        return divider;

    }


    if(learnedIds.length>0){

        allList.appendChild(
            buildSkillSectionDivider(
                "已學習"
            )
        );


        learnedIds.forEach(skillId=>{

            allList.appendChild(
                buildSkillRowElement(
                    skillId
                )
            );

        });

    }


    if(unlearnedIds.length>0){

        allList.appendChild(
            buildSkillSectionDivider(
                "未學習"
            )
        );


        unlearnedIds.forEach(skillId=>{

            allList.appendChild(
                buildSkillRowElement(
                    skillId
                )
            );

        });

    }


    /*
       ★ 每次重新渲染技能頁面時，
       順便同步一次自動戰鬥的技能下拉選單，
       這樣裝備變了、學新技能了，
       選單都會自動跟上，不用每個呼叫renderSkillLoadout()
       的地方都各自記得再呼叫一次。
    */

    populateAutoSkillOptions();

    populateAutoSkillOptions2();

}


/*
   組出技能目前等級的效果文字說明，
   用在技能配裝頁面給玩家參考。
*/

/*
   ★ 技能分類標籤（新增）：
   物理主動／法術主動／增益主動／被動，
   統一從這裡產生文字，
   技能配裝欄、已學技能、可學技能三個地方都共用，
   確保顯示方式一致。
*/

function getSkillCategoryLabel(category){

    if(category==="physical"){
        return"物理主動";
    }

    if(category==="magic"){
        return"法術主動";
    }

    if(category==="buff"){
        return"增益主動";
    }

    if(category==="heal"){
        return"治療主動";
    }

    if(category==="revive"){
        return"復活主動";
    }

    if(category==="passive"){
        return"被動";
    }

    return"";

}


function getSkillEffectPreviewText(skill,level){

    /*
       ★ 純控場技能（目前是冰封，沒有baseDamage）
       要在「有傷害的物理/法術技能」判斷之前
       先攔截處理，不然會被下面那個判斷
       誤判成「傷害0」的攻擊技能，
       顯示出「目前傷害約0」這種誤導文字。
    */

    if(
        (
            skill.category==="physical"||
            skill.category==="magic"
        ) &&
        !skill.baseDamage &&
        skill.freezeChance
    ){

        return (
            skill.freezeChance+
            "%機率冰封目標，"+
            skill.freezeDuration+
            "回合無法行動"
        );

    }


    if(
        skill.category==="physical"||
        skill.category==="magic"
    ){

        /*
           ★ 修正：
           這裡之前只顯示技能基礎傷害，
           完全沒有算進火元素EX被動的+10%加成，
           導致玩家學了被動之後，
           在這個預覽數字上完全看不出差異，
           以為被動沒有生效
           （實際上戰鬥時castDamageSkill()裡
           有正確套用，只是這個預覽數字沒跟上）。
           現在補上，讓玩家能直接在這裡
           看到學被動前後數字的變化。
        */

        /*
           ★ 修正：
           這裡之前只顯示技能基礎傷害，
           完全沒有算進元素EX被動的加成，
           導致玩家學了被動之後，
           在這個預覽數字上完全看不出差異，
           以為被動沒有生效
           （實際上戰鬥時castDamageSkill()裡
           有正確套用，只是這個預覽數字沒跟上）。
           現在補上，讓玩家能直接在這裡
           看到學被動前後數字的變化。
           跟castDamageSkill()一樣，
           改成動態用「元素+EX」查表，
           水元素EX也能正確反映在這裡。
        */

        const exSkillId =
            skill.element+
            "EX";


        const exSkill =
            skillDatabase[exSkillId];


        /*
           ★ 修正（依照使用者要求，「元素
           被動完全沒生效」，這個預覽數字
           跟castDamageSkill()犯了同一個
           bug）：
           不能用skill.element當角色欄位
           key，這裡改用currentSkillCharacter
           （目前畫面上顯示的是哪個角色的
           技能列表，"fire"或"player2"），
           跟玩家實際在看誰的技能保持一致。
        */

        const exLevel =
            getSkillLevel(
                currentSkillCharacter,
                exSkillId
            );



        const passiveMultiplier =
            (
                exSkill &&
                exLevel>0 &&
                exSkill.damageBonusPercent
            )
            ?
            1+
            exSkill.damageBonusPercent/
            100
            :
            1;


        const previewDamage =
            Math.floor(
                getSkillDamageAtLevel(
                    skill,
                    level
                )*
                passiveMultiplier
            );


        let text =
            "目前傷害約"+
            previewDamage+
            (
                passiveMultiplier>1
                ?
                "（已含"+
                (
                    exSkill
                    ?
                    exSkill.name
                    :
                    ""
                )+
                "加成）"
                :
                ""
            );


        if(skill.burnChance){

            text+=

                "｜"+
                skill.burnChance+
                "%燃燒（"+
                skill.burnPercentByLevel[
                    level-1
                ]+
                "%最大HP／回合）";

        }


        if(skill.freezeChance){

            text+=

                "｜"+
                skill.freezeChance+
                "%冰封（"+
                skill.freezeDuration+
                "回合無法行動）";

        }


        if(skill.lifestealPercentByLevel){
            text+="｜吸取"+skill.lifestealPercentByLevel[level-1]+"%傷害（回復HP/SP）";
        }
        if(skill.agilityDownByLevel){
            text+="｜"+skill.agilityDownChance+"%降敏"+skill.agilityDownByLevel[level-1]+"%（"+(skill.agilityDownDuration||2)+"回合）";
        }
        if(skill.statDownByLevel){
            text+="｜"+skill.statDownChance+"%降能力"+skill.statDownByLevel[level-1]+"%（"+(skill.statDownDuration||2)+"回合）";
        }
        if(skill.defenseDownByLevel){
            text+="｜"+skill.defenseDownChance+"%降防"+skill.defenseDownByLevel[level-1]+"%（"+(skill.defenseDownDuration||2)+"回合）";
        }
        if(skill.missBonusByLevel){
            text+="｜"+skill.stunChance+"%暈眩，MISS +"+skill.missBonusByLevel[level-1]+"%（"+(skill.stunDuration||2)+"回合）";
        }
        if(skill.petrifyChanceByLevel){
            text+="｜"+skill.petrifyChanceByLevel[level-1]+"%石化（"+(skill.petrifyDuration||2)+"回合）";
        }
        if(skill.selfShieldByLevel){
            text+="｜自身護盾 "+skill.selfShieldByLevel[level-1]+"（"+(skill.shieldDuration||2)+"回合）";
        }
        if(skill.allyShieldByLevel){
            text+="｜全體護盾 "+skill.allyShieldByLevel[level-1]+"（"+(skill.shieldDuration||2)+"回合）";
        }

        return text;

    }


    if(skill.category==="buff"){
        if(skill.critBonusByLevel){
            return "爆擊率／爆擊傷害 +"+skill.critBonusByLevel[level-1]+"%，持續"+skill.duration+"回合";
        }
        if(skill.evasionBonusPercent){
            return "閃躲率 +"+skill.evasionBonusPercent+"%，持續"+skill.duration+"回合";
        }
        if(skill.defenseBonusPercent){
            return "防禦力 +"+skill.defenseBonusPercent+"%，持續"+skill.duration+"回合";
        }
        if(skill.reflectPercent){
            return "反傷 "+skill.reflectPercent+"%，持續"+skill.duration+"回合";
        }
        if(skill.statusResistBonus){
            return "異常狀態抗性 +"+skill.statusResistBonus+"%，持續"+skill.duration+"回合";
        }
        return skill.description;
    }


    if(skill.category==="heal"){

        const healAmount =
            skill.baseHeal+
            skill.healPerLevel*
            (level-1);


        return (
            "回復HP：基礎"+
            healAmount+
            "+智力×"+
            HEALING_INT_COEFFICIENT+
            "；SP：基礎"+
            (skill.baseHealSP+(skill.healSPPerLevel||0)*(level-1))+
            "+智力×"+
            SP_HEALING_INT_COEFFICIENT+
            "（施放者本人不回復SP）"
        );

    }


    if(skill.category==="revive"){

        return (
            "復活後恢復"+
            skill.reviveHealPercentByLevel[
                level-1
            ]+
            "%血量"
        );

    }


    if(skill.category==="passive"){

        return skill.description;

    }


    return"";

}


function learnSkill(skillId){

    const character =
        characterSkillLoadouts[
            currentSkillCharacter
        ];


    const skill =
        skillDatabase[skillId];


    /*
       ★ 修正：
       原本這裡直接扣player.skillPoints，
       不管目前選的是誰，一律扣第一角色的點數。
       改成先查出「這個角色真正的資料物件」，
       water/wind目前沒有真正角色資料，
       直接擋掉不能學（顯示提示）。
    */

    const owner=
        getSkillCharacterObject(
            currentSkillCharacter
        );


    if(
        !character ||
        !skill
    ){
        return;
    }


    if(!owner){

        alert(
            "這個角色還沒有開放技能學習功能。"
        );

        return;

    }


    if(!character.skillLevels){

        character.skillLevels={};

    }


    if(
        (character.skillLevels[skillId]||0)>0
    ){
        return;
    }


    /*
       ★ 新增（依照使用者要求，「前置技能
       要學的機制」）：
       UI上已經把按鈕disabled擋住點擊了，
       這裡是第二層防護——萬一有別的地方
       繞過畫面直接呼叫learnSkill()，
       後端一樣要擋住，不能只靠前端。
    */

    if(
        !isSkillPrereqMet(
            character.skillLevels,
            skill
        )
    ){

        alert(
            getSkillPrereqLabel(skill)+
            "，才能學習「"+
            skill.name+
            "」。"
        );

        return;

    }


    if(
        owner.skillPoints<
        skill.learnCost
    ){

        alert(
            "技能點不足，需要"+
            skill.learnCost+
            "點。"
        );

        return;

    }


    owner.skillPoints-=
        skill.learnCost;


    character.skillLevels[skillId]=1;


    renderSkillLoadout();

    updateUI();

    saveGame();

}


function upgradeSkill(skillId){

    const character =
        characterSkillLoadouts[
            currentSkillCharacter
        ];


    const skill =
        skillDatabase[skillId];


    const owner=
        getSkillCharacterObject(
            currentSkillCharacter
        );


    if(
        !character ||
        !skill ||
        !character.skillLevels ||
        !owner
    ){
        return;
    }


    const currentLevel =
        character.skillLevels[
            skillId
        ]||
        0;


    if(currentLevel<=0){
        return;
    }


    const maxLevel =
        skill.maxLevel||
        1;


    if(currentLevel>=maxLevel){
        return;
    }


    if(owner.skillPoints<1){

        alert(
            "技能點不足。"
        );

        return;

    }


    owner.skillPoints-=1;


    character.skillLevels[skillId]=
        currentLevel+1;


    renderSkillLoadout();

    updateUI();

    saveGame();

}


function equipSkill(skillId){

    const character =
        characterSkillLoadouts[
            currentSkillCharacter
        ];


    if(!character){
        return;
    }


    if(
        character.equippedSkills
        .includes(skillId)
    ){
        return;
    }


    if(
        character.equippedSkills.length>=4
    ){

        alert(
            "每個角色最多只能攜帶4個技能。"
        );

        return;

    }


    character.equippedSkills
        .push(skillId);


    renderSkillLoadout();

    populateAutoSkillOptions();

    populateAutoSkillOptions2();

    saveGame();

}


function removeEquippedSkill(index){

    const character =
        characterSkillLoadouts[
            currentSkillCharacter
        ];


    if(!character){
        return;
    }


    character.equippedSkills
        .splice(
            index,
            1
        );


    renderSkillLoadout();

    populateAutoSkillOptions();

    populateAutoSkillOptions2();

    saveGame();

}


/* =====================================================
   背包角色 / 經典 RPG 背包
===================================================== */

let inventoryFilter = "equipment";
const INVENTORY_CATEGORY_SLOT_COUNT = 102;

function getBackpackPartyCharacters(){
    return [player, player2, player3];
}

function getBackpackCharacter(index){
    return getBackpackPartyCharacters()[index] || null;
}

function getBackpackEquipmentKey(index){
    if(index===0) return "fire";
    const c=getBackpackCharacter(index);
    return c ? c.id : null;
}

function getInventoryEquipmentSlot(itemType){
    const map={
        weapon:"hand",
        helmet:"head",
        head:"head",
        shoulder:"shoulder",
        armor:"armor",
        shoes:"shoes",
        accessory:"ring",
        ring:"ring"
    };
    return map[itemType] || null;
}

function getBackpackCharacterStats(index){
    const character=getBackpackCharacter(index);
    if(!character) return null;

    if(index===0) return getMainCharacterStats();

    const key=getBackpackEquipmentKey(index);
    const bonus=getEquipmentBonus(key);

    return {
        maxHP:100+(character.bonusHP||0)+character.vitality*50+bonus.maxHP+bonus.vitality*50,
        maxSP:50+(character.bonusSP||0)+character.energy*15+bonus.maxSP+bonus.energy*15,
        attack:10+character.attack*5+bonus.attack,
        defense:10+character.vitality*15+bonus.defense+bonus.vitality*15,
        vitality:character.vitality+bonus.vitality,
        energy:character.energy+bonus.energy,
        intelligence:character.intelligence+bonus.intelligence,
        spirit:character.spirit+bonus.spirit,
        agility:character.agility+bonus.agility,
        accuracy:character.spirit*2+bonus.spirit*2,
        resistance:calculateStatusResistancePercent(character.spirit+bonus.spirit),
        antiCrit:calculateAntiCritPercent(character.spirit+bonus.spirit),
        evasion:character.agility*2+bonus.agility*2
    };
}

function changeInventoryCharacter(direction){
    const party=getBackpackPartyCharacters();
    let next=inventoryCharacterIndex+direction;
    if(next<0) next=party.length-1;
    if(next>=party.length) next=0;

    // 未建立的角色仍可顯示第三格，但不能把空角色當成可裝備角色。
    inventoryCharacterIndex=next;
    renderInventory();

    if(typeof syncCharacterTabsFromInventory === "function"){
        syncCharacterTabsFromInventory(next);
    }
}

function selectInventoryCharacter(index){
    const party=getBackpackPartyCharacters();
    if(index<0 || index>=party.length) return;
    inventoryCharacterIndex=index;
    renderInventory();

    if(party[index] && typeof syncCharacterTabsFromInventory === "function"){
        syncCharacterTabsFromInventory(index);
    }
}

function syncCharacterTabsFromInventory(index){
    if(index===0 || index===1){
        if(typeof selectCharacterForTabs === "function" &&
           ((index===0) || player2)){
            // 避免 selectCharacterForTabs 再次觸發 renderInventory 形成遞迴。
            statusCharacterIndex=index;
            inventoryCharacterIndex=index;
            currentSkillCharacter=index===0 ? "fire" : "player2";
        }
    }
}

function renderInventoryCharacterTabs(){
    const wrap=$("inventoryCharacterTabs");
    if(!wrap) return;

    const charactersList=[player,player2,player3];
    const character=charactersList[inventoryCharacterIndex];

    const leftDisabled=inventoryCharacterIndex<=0;
    const rightDisabled=inventoryCharacterIndex>=charactersList.length-1 || !charactersList[inventoryCharacterIndex+1];

    wrap.innerHTML=`
        <button type="button"
            class="inventory-character-arrow"
            aria-label="上一個角色"
            ${leftDisabled ? "disabled" : ""}
            onclick="selectInventoryCharacter(${Math.max(0,inventoryCharacterIndex-1)})">‹</button>

        <div class="inventory-character-name">
            <span>${character ? (character.id || "角色"+(inventoryCharacterIndex+1)) : "角色"+(inventoryCharacterIndex+1)}</span>
            ${character ? `<small class="inventory-character-level">Lv.${character.level || 1}</small>` : `<small class="inventory-character-level">尚未建立</small>`}
        </div>

        <button type="button"
            class="inventory-character-arrow"
            aria-label="下一個角色"
            ${rightDisabled ? "disabled" : ""}
            onclick="selectInventoryCharacter(${Math.min(charactersList.length-1,inventoryCharacterIndex+1)})">›</button>
    `;
}

function renderInventoryStats(){
    const stats=getBackpackCharacterStats(inventoryCharacterIndex);
    const el=$("inventoryStats");
    if(!el) return;

    if(!stats){
        el.innerHTML='<div class="inventory-empty-character">第三角色尚未建立</div>';
        return;
    }

    /*
       V77：
       背包常駐資訊只留 HP / SP。
       其他能力改由立繪右上角放大鏡開啟詳細資訊。
    */
    el.innerHTML=`
        <div class="inventory-stat-row inventory-stat-primary">
            <span>HP</span><b>${stats.maxHP}</b>
        </div>
        <div class="inventory-stat-row inventory-stat-primary">
            <span>SP</span><b>${stats.maxSP}</b>
        </div>
    `;
}

function getInventoryCharacterCriticalStats(index){
    const character=getBackpackCharacter(index);

    if(!character){
        return null;
    }

    /*
       V118：背包詳細資料同步顯示物理／法術兩套爆擊。
       只做顯示，公式與 rollCritical() 保持一致：
       物理看 attack、法術看 intelligence。
    */
    const rageBuff=
        (
            (character&&character.activeBuffs)||
            []
        )
        .find(
            buff=>buff.type==="rage"
        );

    function buildCriticalProfile(statPoints,chancePerPoint,multiplierPerPoint){
        let critChance=
            Math.min(
                CRIT_CHANCE_MAX,
                CRIT_CHANCE_BASE+
                statPoints*
                chancePerPoint
            );

        let critMultiplier=
            Math.min(
                CRIT_MULTIPLIER_MAX,
                CRIT_MULTIPLIER_BASE+
                statPoints*
                multiplierPerPoint
            );

        if(rageBuff){
            critChance+=
                rageBuff.bonusPercent;

            critMultiplier=
                1+
                rageBuff.bonusPercent/
                100;
        }

        return {
            chance:critChance,
            multiplier:critMultiplier
        };
    }

    return {
        physical:buildCriticalProfile(
            (character.attack||0),
            CRIT_CHANCE_PER_ATTACK_POINT,
            CRIT_MULTIPLIER_PER_ATTACK_POINT
        ),
        magic:buildCriticalProfile(
            (getBackpackCharacterStats(index).intelligence||0),
            CRIT_CHANCE_PER_INTELLIGENCE_POINT,
            CRIT_MULTIPLIER_PER_INTELLIGENCE_POINT
        )
    };
}

function openInventoryCharacterDetail(){
    const modal=$("inventoryCharacterDetailModal");
    const title=$("inventoryCharacterDetailName");
    const body=$("inventoryCharacterDetailStats");

    if(!modal || !title || !body){
        return;
    }

    const character=
        getBackpackCharacter(
            inventoryCharacterIndex
        );

    const stats=
        getBackpackCharacterStats(
            inventoryCharacterIndex
        );

    const critical=
        getInventoryCharacterCriticalStats(
            inventoryCharacterIndex
        );

    if(!character || !stats || !critical){
        title.textContent="角色詳細資訊";
        body.innerHTML='<div class="inventory-empty-character">角色尚未建立</div>';
        modal.classList.add("show");
        return;
    }

    title.textContent=
        `${character.id || "角色"+(inventoryCharacterIndex+1)}　Lv.${character.level||1}`;

    const rows=[
        ["HP",stats.maxHP],
        ["SP",stats.maxSP],
        ["攻擊",stats.attack],
        ["防禦",stats.defense],
        ["智力",stats.intelligence],
        ["體質",stats.vitality],
        ["能量",stats.energy],
        ["精神",stats.spirit],
        ["敏捷",stats.agility],
        ["命中",stats.accuracy],
        ["閃避",stats.evasion],
        ["異常抗性",stats.resistance.toFixed(1)+"%"],
        ["抗暴",stats.antiCrit.toFixed(1)+"%"],
        ["物理爆擊率",critical.physical.chance.toFixed(1)+"%"],
        ["物理爆擊傷害",(critical.physical.multiplier*100).toFixed(1)+"%"],
        ["法術爆擊率",critical.magic.chance.toFixed(1)+"%"],
        ["法術爆擊傷害",(critical.magic.multiplier*100).toFixed(1)+"%"]
    ];

    body.innerHTML=
        rows.map(
            ([name,value])=>`
                <div class="inventory-character-detail-row">
                    <span>${name}</span>
                    <b>${value}</b>
                </div>
            `
        ).join("")+
        `<div class="inventory-character-detail-note">
            命中機率＝95%＋命中×0.3－目標閃避×0.3，最終限制60%～99%。<br>
            每1精神＝+0.3個百分點異常抗性、+2命中、+0.1%抗暴；每1敏捷＝+1速度、+2閃避。
        </div>`;

    modal.classList.add("show");
}

function closeInventoryCharacterDetail(){
    const modal=$("inventoryCharacterDetailModal");

    if(modal){
        modal.classList.remove("show");
    }
}

function renderEquipment(){
    const grid=$("equipmentGrid");
    if(!grid) return;
    grid.innerHTML="";

    const key=getBackpackEquipmentKey(inventoryCharacterIndex);
    const equipment=key ? characterEquipment[key] : null;

    const slots=[
        {key:"head",name:"頭"},
        {key:"hand",name:"手"},
        {key:"shoulder",name:"肩甲"},
        {key:"armor",name:"衣服"},
        {key:"shoes",name:"鞋子"},
        {key:"ring",name:"戒指"}
    ];

    slots.forEach(slot=>{
        const cell=document.createElement("div");
        cell.className="inventory-equipment-cell";

        const label=document.createElement("div");
        label.className="inventory-equipment-slot-label";
        label.textContent=slot.name;

        const box=document.createElement("div");
        box.className="inventory-equipment-slot";
        const item=equipment ? equipment[slot.key] : null;

        if(item){
            box.classList.add("has-item");
            box.innerHTML=`<div class="inventory-equipment-icon">${item.icon || "◆"}</div>`;
            box.title=item.name || slot.name;
            box.onclick=()=>openEquippedItem(item,slot.key);
        }else{
            box.innerHTML=`<div class="inventory-equipment-icon empty">＋</div>`;
        }

        cell.appendChild(label);
        cell.appendChild(box);
        grid.appendChild(cell);
    });
}

function getFilteredInventoryItems(){
    const equipmentTypes=[
        "weapon",
        "helmet",
        "head",
        "shoulder",
        "armor",
        "shoes",
        "accessory",
        "ring"
    ];

    const functionTypes=[
        "function",
        "utility",
        "key",
        "quest",
        "special"
    ];

    return inventoryItems.filter(item=>{
        if(!item) return false;

        if(inventoryFilter==="equipment"){
            return equipmentTypes.includes(item.type);
        }

        if(inventoryFilter==="material"){
            return item.type==="material";
        }

        if(inventoryFilter==="function"){
            return functionTypes.includes(item.type);
        }

        /*
           「物品」承接藥水與一般物品。
           未來如果新增尚未歸類的新 type，也先留在物品頁，
           避免因為 UI 分類更新造成既有物品憑空看不到。
        */
        return (
            !equipmentTypes.includes(item.type) &&
            item.type!=="material" &&
            !functionTypes.includes(item.type)
        );
    });
}

function setInventoryFilter(filter){
    inventoryFilter=filter;
    renderInventoryItems();

    const scroller=$("inventoryGridScroll");
    if(scroller) scroller.scrollTop=0;
}

function renderInventoryItems(){
    rebuildInventorySlots();
    const grid=$("inventoryGrid");
    if(!grid) return;
    grid.innerHTML="";

    const items=getFilteredInventoryItems().slice(0,INVENTORY_CATEGORY_SLOT_COUNT);

    for(let index=0;index<INVENTORY_CATEGORY_SLOT_COUNT;index++){
        const item=items[index] || null;
        const box=document.createElement("div");
        box.className="inventory-item inventory-item-classic "+(item ? "has-item":"empty");
        box.innerHTML=`<div class="inventory-slot-number">${index+1}</div>`;

        if(item){
            box.innerHTML+=`<div class="inventory-icon">${item.icon || "◆"}</div><div class="inventory-count">${item.count>1 ? "×"+item.count : ""}</div>`;
            const realIndex=inventoryItems.indexOf(item);
            box.onclick=()=>openItemModal(realIndex);
        }else{
            box.innerHTML+='<div class="inventory-empty-dot">·</div>';
        }
        grid.appendChild(box);
    }

    document.querySelectorAll("#inventoryCategoryTabs [data-filter]").forEach(tab=>{
        const active=tab.dataset.filter===inventoryFilter;
        tab.classList.toggle("active",active);
        tab.setAttribute("aria-selected",active ? "true" : "false");
    });
}

function renderInventory(){
    const character=getBackpackCharacter(inventoryCharacterIndex);
    const nameEl=$("inventoryCharacterName");
    if(nameEl){
        nameEl.textContent=character ? `${character.id || "角色"+(inventoryCharacterIndex+1)}　Lv.${character.level||1}` : `角色${inventoryCharacterIndex+1}　尚未建立`;
    }

    renderInventoryCharacterTabs();
    renderEquipment();
    renderInventoryItems();
}

/* =====================================================
   物品詳細
===================================================== */

function getStatText(stats){

    if(
        !stats ||
        Object.keys(stats).length===0
    ){

        return"沒有額外能力加成。";

    }


    const names = {

        attack:"攻擊",

        vitality:"體質",

        energy:"能量",

        intelligence:"智力",

        spirit:"精神",

        agility:"敏捷",

        maxHP:"最大HP",

        maxSP:"最大SP",

        defense:"防禦"

    };


    let html="";


    Object.keys(stats)
    .forEach(key=>{

        const value =
            stats[key];


        if(!value){
            return;
        }


        html +=

        `
        <div>
            ${names[key]||key}：
            <b>+${value}</b>
        </div>
        `;

    });


    return html ||
        "沒有額外能力加成。";

}


function openItemModal(
    slotIndex
){

    const item =
        inventorySlots[
            slotIndex
        ];


    if(!item){
        return;
    }


    selectedInventorySlot =
        slotIndex;


    $("itemModalIcon")
        .textContent =
        item.icon;


    $("itemModalName")
        .textContent =
        item.name;


    $("itemModalStats")
        .innerHTML =

        `
        ${
            item.type==="potion"
            ?
            `<div>效果：<b>${getPotionEffectDescription(item.id)}</b></div>`
            :
            getStatText(item.stats)
        }

        <div
            style="
                margin-top:7px;
                color:#b3a58c;
            "
        >
            售價：${item.price||0} 金幣
        </div>
        `;


    const equipButton =
        $("itemEquipButton");


    equipButton.removeAttribute(
        "data-slot"
    );


    if(item.type==="potion"){

        equipButton.disabled=true;

        equipButton.textContent =
            "不可裝備";

        equipButton.style.opacity =
            ".4";

    }
    else{

        equipButton.disabled=false;

        equipButton.textContent =
            "穿戴";

        equipButton.style.opacity =
            "1";

    }


    $("itemModal")
        .classList
        .add("show");

}


function openEquippedItem(
    item,
    slot
){

    selectedInventorySlot =
        null;


    $("itemModalIcon")
        .textContent =
        item.icon;


    $("itemModalName")
        .textContent =
        item.name+
        "（已裝備）";


    $("itemModalStats")
        .innerHTML =
        getStatText(
            item.stats
        );


    const equipButton =
        $("itemEquipButton");


    equipButton.disabled=false;

    equipButton.textContent =
        "脫下";

    equipButton.style.opacity =
        "1";


    equipButton.dataset.slot =
        slot;


    $("itemModal")
        .classList
        .add("show");

}


function closeItemModal(){

    selectedInventorySlot =
        null;


    $("itemEquipButton")
        .removeAttribute(
            "data-slot"
        );


    $("itemModal")
        .classList
        .remove("show");

}


/*
   ★ 新增（依照使用者要求，「文字太多
   塞不下，就精簡顯示，後面用……詳細
   讓玩家點擊跳出完整介紹」）：
   技能詳細資訊彈窗，跟物品詳細彈窗共用
   同一套.item-modal樣式。showSkillDetail()
   吃技能ID，自己重新查一次目前角色/等級
   狀態，組出完整說明文字（不截斷）。
*/

/*
   ★ 新增（依照使用者要求，「不管技能有沒有
   學習，詳細資訊都要把每次升級增加多少
   點傷害、機率%數怎麼提升，完整顯示」）：
   把技能從Lv.1到滿級每一級的數值都攤開來
   列出來，不管玩家目前學了沒學、學到第
   幾級，這裡都是完整的一份總表——傷害
   技能額外標出「每級+X」的固定增量，
   方便玩家一眼看出成長幅度，不用自己
   一級一級去心算差多少。
*/

function buildSkillLevelBreakdownHTML(skill){

    const maxLevel=
        skill.maxLevel||
        1;


    let lines=
        [];


    for(
        let lv=1;
        lv<=maxLevel;
        lv++
    ){

        let parts=
            [];


        if(
            (
                skill.category==="physical"||
                skill.category==="magic"
            ) &&
            skill.baseDamage
        ){

            const dmg=
                getSkillDamageAtLevel(
                    skill,
                    lv
                );


            parts.push(
                "傷害"+
                Math.floor(dmg)+

                (
                    skill.damagePerLevel
                    ?
                    "（每級+"+
                    skill.damagePerLevel+
                    "）"
                    :
                    ""
                )

            );

        }


        if(
            skill.burnChance &&
            skill.burnPercentByLevel
        ){

            parts.push(

                skill.burnChance+
                "%機率燃燒"+
                skill.burnPercentByLevel[lv-1]+
                "%最大HP／回合"

            );

        }


        if(skill.freezeChance){

            parts.push(

                skill.freezeChance+
                "%機率冰封"+
                skill.freezeDuration+
                "回合"

            );

        }


        if(skill.lifestealPercentByLevel){
            parts.push("吸取傷害"+skill.lifestealPercentByLevel[lv-1]+"%（回復HP/SP）");
        }
        if(skill.agilityDownByLevel){
            parts.push(skill.agilityDownChance+"%降敏"+skill.agilityDownByLevel[lv-1]+"%，"+(skill.agilityDownDuration||2)+"回合");
        }
        if(skill.statDownByLevel){
            parts.push(skill.statDownChance+"%降能力"+skill.statDownByLevel[lv-1]+"%，"+(skill.statDownDuration||2)+"回合");
        }
        if(skill.defenseDownByLevel){
            parts.push(skill.defenseDownChance+"%降防"+skill.defenseDownByLevel[lv-1]+"%，"+(skill.defenseDownDuration||2)+"回合");
        }
        if(skill.missBonusByLevel){
            parts.push(skill.stunChance+"%暈眩，MISS +"+skill.missBonusByLevel[lv-1]+"%，"+(skill.stunDuration||2)+"回合");
        }
        if(skill.petrifyChanceByLevel){
            parts.push(skill.petrifyChanceByLevel[lv-1]+"%石化，"+(skill.petrifyDuration||2)+"回合");
        }
        if(skill.selfShieldByLevel){
            parts.push("自身護盾"+skill.selfShieldByLevel[lv-1]+"點，"+(skill.shieldDuration||2)+"回合");
        }
        if(skill.allyShieldByLevel){
            parts.push("我方全體護盾"+skill.allyShieldByLevel[lv-1]+"點，"+(skill.shieldDuration||2)+"回合");
        }


        if(skill.category==="buff"&&skill.critBonusByLevel){
            parts.push("爆擊率／爆擊傷害 +"+skill.critBonusByLevel[lv-1]+"%，"+skill.duration+"回合");
        }
        else if(skill.category==="buff"&&skill.evasionBonusPercent){
            parts.push("閃躲率 +"+skill.evasionBonusPercent+"%，"+skill.duration+"回合");
        }
        else if(skill.category==="buff"&&skill.defenseBonusPercent){
            parts.push("防禦力 +"+skill.defenseBonusPercent+"%，"+skill.duration+"回合");
        }
        else if(skill.category==="buff"&&skill.reflectPercent){
            parts.push("反傷 "+skill.reflectPercent+"%，"+skill.duration+"回合");
        }
        else if(skill.category==="buff"&&skill.statusResistBonus){
            parts.push("異常狀態抗性 +"+skill.statusResistBonus+"%，"+skill.duration+"回合");
        }
        else if(skill.category==="buff"){
            parts.push(skill.description);
        }


        if(skill.category==="heal"){

            const healAmount=

                skill.baseHeal+
                skill.healPerLevel*
                (lv-1);


            parts.push(

                "回復HP基礎"+
                healAmount+
                "+智力×"+
                HEALING_INT_COEFFICIENT+

                (
                    skill.healPerLevel
                    ?
                    "（基礎每級+"+
                    skill.healPerLevel+
                    "）"
                    :
                    ""
                )+
                "；SP基礎"+
                (skill.baseHealSP+(skill.healSPPerLevel||0)*(lv-1))+
                (skill.healSPPerLevel ? "（基礎每級+"+skill.healSPPerLevel+"）" : "")+
                "+智力×"+
                SP_HEALING_INT_COEFFICIENT+
                "（施放者本人不回復SP）"

            );

        }


        if(
            skill.category==="revive"&&
            skill.reviveHealPercentByLevel
        ){

            parts.push(

                "復活恢復"+
                skill.reviveHealPercentByLevel[lv-1]+
                "%血量"

            );

        }


        if(
            skill.category==="passive"
        ){

            parts.push(
                skill.description
            );

        }


        if(parts.length<1){
            continue;
        }


        lines.push(

            '<div style="'+
            'display:flex;gap:6px;padding:3px 0;'+
            'border-bottom:1px solid rgba(240,180,41,.12);">'+

            '<span style="flex:0 0 40px;color:#f0b429;font-weight:bold;">'+
            "Lv."+lv+
            "</span>"+

            '<span style="flex:1;">'+
            parts.join("｜")+
            "</span>"+

            "</div>"

        );

    }


    return lines.join("");

}


function showSkillDetail(skillId){

    const skill=
        skillDatabase[skillId];


    if(!skill){
        return;
    }


    const character=
        characterSkillLoadouts[
            currentSkillCharacter
        ];


    const level=

        (
            character&&
            character.skillLevels&&
            character.skillLevels[skillId]
        )||
        0;


    const spCost=

        skill.spCost!==undefined
        ?
        skill.spCost
        :
        skill.cost;


    const iconEl=
        $("skillDetailIcon");


    if(iconEl){

        iconEl.style.backgroundImage=

            skillIconImages&&
            skillIconImages[skillId]
            ?
            "url("+
            skillIconImages[skillId]+
            ")"
            :
            "none";

        iconEl.textContent=

            skillIconImages&&
            skillIconImages[skillId]
            ?
            ""
            :
            "";

    }


    $("skillDetailName")
        .textContent=

        skill.name+

        (
            level>0
            ?
            "（Lv."+level+
            (
                skill.maxLevel
                ?
                "/"+skill.maxLevel
                :
                ""
            )+
            "）"
            :
            "（未學習）"
        );


    $("skillDetailStats")
        .innerHTML=

        `
        <div style="margin-bottom:6px;">
            <span style="
                display:inline-block;
                background:#2e2822;
                color:#f0b429;
                font-size:11px;
                font-weight:bold;
                padding:2px 7px;
                border-radius:10px;
            ">
                ${getSkillCategoryLabel(skill.category)}
            </span>
        </div>

        <div style="line-height:1.7;">
            ${skill.description}
        </div>

        <div style="margin-top:8px;color:#b3a58c;">
            ${
                skill.category==="passive"
                ?
                "被動技能，不用裝備，學了就永久生效"
                :
                spCost+"SP"
            }
            ${
                skill.learnCost
                ?
                "｜學習需要"+skill.learnCost+"技能點"
                :
                ""
            }
        </div>

        <div style="margin-top:10px;font-size:11px;color:#f0b429;font-weight:bold;">
             各等級數值
        </div>

        <div style="margin-top:4px;font-size:12px;">
            ${
                buildSkillLevelBreakdownHTML(
                    skill
                )
            }
        </div>

        `;


    const detailStats=$("skillDetailStats");

    if(detailStats){
        detailStats.scrollTop=0;
    }

    [
        document.documentElement,
        document.body,
        $("game-viewport"),
        $("game-stage")
    ].forEach(el=>{
        if(el){
            el.classList.add("skill-detail-scroll-active");
        }
    });

    $("skillDetailModal")
        .classList
        .add("show");

}


function closeSkillDetail(){

    $("skillDetailModal")
        .classList
        .remove("show");

    [
        document.documentElement,
        document.body,
        $("game-viewport"),
        $("game-stage")
    ].forEach(el=>{
        if(el){
            el.classList.remove("skill-detail-scroll-active");
        }
    });

}


/*
   ★ 新增（依照使用者要求，「返回框框
   旁邊多一個？按鈕，跳出屬性說明」）：
   彈窗內容固定寫死在HTML裡，這兩個函式
   只負責開關，跟closeSkillDetail()是
   同一種簡單模式。
*/

function showStatusHelp(){

    $("statusHelpModal")
        .classList
        .add("show");

}


function closeStatusHelp(){

    $("statusHelpModal")
        .classList
        .remove("show");

}


/* =====================================================
   穿戴
===================================================== */

function equipSelectedItem(){

    const button =
        $("itemEquipButton");


    if(button.dataset.slot){

        unequipItem(
            button.dataset.slot
        );

        return;

    }


    if(
        selectedInventorySlot===null
    ){
        return;
    }


    const item =
        inventorySlots[
            selectedInventorySlot
        ];


    if(
        !item ||
        item.type==="potion"
    ){
        return;
    }


    const character =
        getBackpackCharacter(
            inventoryCharacterIndex
        );


    if(!character){
        return;
    }


    const equipmentKey =
        getBackpackEquipmentKey(
            inventoryCharacterIndex
        );


    const equipment =
        characterEquipment[equipmentKey];


    const equipmentSlot =
        getInventoryEquipmentSlot(item.type);


    if(!equipmentSlot){
        return;
    }


    const oldItem =
        equipment[equipmentSlot];


    if(oldItem){

        inventoryItems.push(
            oldItem
        );

    }


    const actualIndex =
        inventoryItems.indexOf(
            item
        );


    if(actualIndex>=0){

        inventoryItems.splice(
            actualIndex,
            1
        );

    }


    equipment[equipmentSlot] =
        item;


    closeItemModal();

    rebuildInventorySlots();

    renderInventory();

    updateUI();

    saveGame();

}


/* =====================================================
   脫下
===================================================== */

function unequipItem(slot){

    const character =
        getBackpackCharacter(
            inventoryCharacterIndex
        );


    if(!character){
        return;
    }


    const equipmentKey =
        getBackpackEquipmentKey(
            inventoryCharacterIndex
        );


    const equipment =
        characterEquipment[equipmentKey];


    const item =
        equipment[slot];


    if(!item){
        return;
    }


    if(
        inventoryItems.length>=102
    ){

        alert(
            "背包已滿，無法脫下裝備。"
        );

        return;

    }


    inventoryItems.push(
        item
    );


    equipment[slot]=null;


    closeItemModal();

    rebuildInventorySlots();

    renderInventory();

    updateUI();

    saveGame();

}


/* =====================================================
   售出
===================================================== */

function sellSelectedItem(){

    if(
        selectedInventorySlot===null
    ){
        return;
    }


    const item =
        inventorySlots[
            selectedInventorySlot
        ];


    if(!item){
        return;
    }


    const price =
        item.price||
        0;


    if(
        !confirm(
            "確定要出售"+
            item.name+
            "？\n"+
            "獲得"+
            price+
            "金幣。"
        )
    ){
        return;
    }


    const actualIndex =
        inventoryItems.indexOf(
            item
        );


    if(actualIndex>=0){

        const storedItem=inventoryItems[actualIndex];
        const currentCount=Math.max(1,Number(storedItem.count)||1);

        if(currentCount>1){
            storedItem.count=currentCount-1;
        }else{
            inventoryItems.splice(
                actualIndex,
                1
            );
        }

    }


    /*
       ★ 修正（真正抓到問題根源）：
       之前這裡的confirm()訊息一直說「獲得
       XX金幣」，但從頭到尾沒有任何一行
       程式碼真的把這個數字加進任何地方——
       金幣系統當時根本不存在，這句話等於
       是空頭支票。現在真的有gold這個共用
       資源了，這裡補上真正的加值。
    */

    gold=
        gold+
        price;


    closeItemModal();

    rebuildInventorySlots();

    renderInventory();

    updateGoldDisplay();

    saveGame();

}


/* =====================================================
   自動戰鬥設定
===================================================== */

/*
   ★ 防呆：
   每個事件綁定都個別用try/catch包起來。
   就算某個瀏覽器上有一顆select意外抓不到，
   也不會讓後面所有事件綁定跟初始化整個中斷。
*/

function safeBind(id,handler){

    try{

        const el =
            $(id);


        if(!el){

            console.error(
                "找不到元素：",
                id
            );

            return;

        }


        el.addEventListener(
            "change",
            handler
        );

    }
    catch(error){

        console.error(
            "綁定事件失敗：",
            id,
            error
        );

    }

}


safeBind(
    "autoEnabled",
    event=>{

        autoConfig.enabled =
            event.target.checked;

    }
);


safeBind(
    "autoSkillHome",
    event=>{

        autoConfig.skill =
            event.target.value;

        syncBattleAutoSettings();

    }
);


safeBind(
    "hpUsePctHome",
    event=>{

        autoConfig.hp =
            Number(
                event.target.value
            );

        syncBattleAutoSettings();

    }
);


safeBind(
    "spUsePctHome",
    event=>{

        autoConfig.sp =
            Number(
                event.target.value
            );

        syncBattleAutoSettings();

    }
);


/*
   ★ 修正（清除殘留錯誤訊息）：
   autoSkillBattle、hpUsePctBattle、spUsePctBattle
   這三個是很早期版本、戰鬥畫面內嵌下拉選單的
   舊元素ID，後來重新設計成現在這種
   「標籤+啟動/停止+設定」的自動戰鬥面板時
   已經拿掉了，但這裡綁定事件的程式碼
   沒有跟著清乾淨，導致每次載入都會嘗試找
   這幾個不存在的元素、印出錯誤訊息
   （雖然有防呆不會讓遊戲當機，但終究是雜訊）。
   這裡直接刪掉這三段已經沒有目標可以綁的程式碼。
*/


/*
   ★ 自動戰鬥技能下拉選單改成動態產生。
   之前是寫死在HTML裡的固定選項（只有火箭、會心一擊），
   現在技能是玩家自己學、自己裝備的，
   選單要跟著「目前裝備的技能」動態更新，
   不然玩家裝備了新技能，這裡卻選不到。

   被動技能跟增益技能（怒火）不放進自動選單，
   被動技能沒有「主動使用」這回事；
   怒火如果放進自動選單，
   自動戰鬥每回合都會重新施放，
   邏輯會變得很奇怪，
   所以怒火目前先只能在戰鬥中手動點技能選單施放。
*/

function populateAutoSkillOptions(){

    const character =
        characterSkillLoadouts.fire;


    if(!character){
        return;
    }


    let optionsHTML =

        '<option value="normal">普通攻擊</option>';


    character.equippedSkills
    .forEach(skillId=>{

        const skill =
            skillDatabase[skillId];


        if(
            !skill ||
            skill.category==="buff"||
            skill.category==="passive"
        ){
            return;
        }


        optionsHTML+=

            '<option value="'+
            skillId+
            '">'+
            skill.name+
            '</option>';

    });


    const homeSelect =
        $("autoSkillHome");


    const battleSelect =
        $("autoSkillBattle");


    const previousValue =
        autoConfig.skill;


    if(homeSelect){

        homeSelect.innerHTML =
            optionsHTML;

    }


    if(battleSelect){

        battleSelect.innerHTML =
            optionsHTML;

    }


    /*
       ★ 真的抓到問題根源了：
       這裡原本只承認"normal"或「目前裝備的技能」
       是合法值，"defend"（防禦）不在這兩種情況內，
       會被這段防呆邏輯誤判成「不合法的殘留值」，
       強制退回「普通攻擊」——
       這正是「明明設定防禦，卻變成普通攻擊」
       的真正原因：confirmAutoBattleSettings()
       才剛把autoConfig.skill正確設成"defend"，
       緊接著呼叫這個函式做同步，
       這裡又把它洗回"normal"，
       等於使用者的選擇在儲存的下一刻就被覆蓋掉。

       修正：把"defend"也視為合法值。
    */

    const stillValid =
        previousValue==="normal"||
        previousValue==="defend"||
        character.equippedSkills.includes(
            previousValue
        );


    if(!stillValid){

        autoConfig.skill=
            "normal";

    }


    if(homeSelect){

        homeSelect.value =
            autoConfig.skill;

    }


    if(battleSelect){

        battleSelect.value =
            autoConfig.skill;

    }

}


/*
   ★ 新增：第二角色版本的自動技能選單同步。
   跟populateAutoSkillOptions()邏輯完全對稱，
   讀characterSkillLoadouts.player2，
   寫autoConfig2，操作的DOM元件也是
   專屬於第二角色那組id。
   同時負責顯示/隱藏整張設定卡片
   （player2不存在就不用讓玩家看到這區塊）。
*/

function populateAutoSkillOptions2(){

    const card=
        $("player2AutoSettingsCard");


    if(!card){
        return;
    }


    if(!player2){

        card.style.display=
            "none";

        return;

    }


    card.style.display=
        "block";


    const titleEl=
        $("player2AutoSettingsTitle");


    if(titleEl){

        titleEl.textContent=

            ""+
            player2.id+
            "自動戰鬥設定";

    }


    const character=
        characterSkillLoadouts.player2;


    if(!character){
        return;
    }


    let optionsHTML=

        '<option value="normal">普通攻擊</option>';


    character.equippedSkills
    .forEach(skillId=>{

        const skill=
            skillDatabase[skillId];


        if(
            !skill ||
            skill.category==="buff"||
            skill.category==="passive"||
            skill.category==="heal"||
            skill.category==="revive"
        ){
            return;
        }


        optionsHTML+=

            '<option value="'+
            skillId+
            '">'+
            skill.name+
            '</option>';

    });


    const select=
        $("autoSkillPlayer2");


    if(!select){
        return;
    }


    const previousValue=
        autoConfig2.skill;


    select.innerHTML=
        optionsHTML;


    const stillValid=
        previousValue==="normal"||
        previousValue==="defend"||
        character.equippedSkills.includes(
            previousValue
        );


    if(!stillValid){

        autoConfig2.skill=
            "normal";

    }


    select.value=
        autoConfig2.skill;


    const hpSelect=
        $("hpUsePctPlayer2");


    const spSelect=
        $("spUsePctPlayer2");


    if(hpSelect){

        hpSelect.value=
            autoConfig2.hp;

    }


    if(spSelect){

        spSelect.value=
            autoConfig2.sp;

    }


    const enabledCheckbox=
        $("autoEnabledPlayer2");


    if(enabledCheckbox){

        enabledCheckbox.checked=
            autoConfig2.enabled;

    }

}


/*
   ★ 第二角色自動戰鬥設定的下拉選單
   異動時，把值寫回autoConfig2。
*/

function updateAutoConfig2FromUI(){

    const enabledCheckbox=
        $("autoEnabledPlayer2");


    const select=
        $("autoSkillPlayer2");


    const hpSelect=
        $("hpUsePctPlayer2");


    const spSelect=
        $("spUsePctPlayer2");


    if(enabledCheckbox){

        autoConfig2.enabled=
            enabledCheckbox.checked;

    }


    if(select){

        autoConfig2.skill=
            select.value;

    }


    if(hpSelect){

        autoConfig2.hp=
            Number(
                hpSelect.value
            );

    }


    if(spSelect){

        autoConfig2.sp=
            Number(
                spSelect.value
            );

    }


    saveGame();

}


function syncBattleAutoSettings(){

    /*
       ★ 修正（真的抓到一個會當機的bug）：
       這裡原本會直接對
       autoSkillBattle/hpUsePctBattle/spUsePctBattle
       這三個舊版戰鬥畫面內嵌下拉選單設值，
       但這次改版後，這三個下拉選單已經整個拿掉
       （相關設定移到「設定」按鈕展開的
       autoBattleSettingsPanel裡了），
       DOM裡已經找不到這三個元素，
       直接對null.value賦值會直接丟出錯誤，
       導致呼叫這個函式的地方全部中斷執行——
       包括beginCharacterTurn()，
       等於每次輪到玩家行動，
       畫面都有可能因為這裡噴錯而卡住。

       新版設定面板是「點設定才展開，
       展開時才由switchAutoSettingsCharacter()
       負責帶入目前的值」，不需要在這裡
       每次都主動同步，所以直接把這三行拿掉，
       只保留同步「已學技能選項」這部分
       （populateAutoSkillOptions系列函式
       内部都已經有null檢查，不會有同樣的問題）。
    */

    populateAutoSkillOptions();

    populateAutoSkillOptions2();

}


/* =====================================================
   戰鬥資訊
===================================================== */

function clearBattleLog(){

    $("battleInfo")
        .innerHTML="";


    /*
       ★ 新增（依照使用者要求，巡邏頁面的
       戰鬥資訊覆蓋層）：
       新戰鬥開始清空紀錄的同時，
       巡邏頁面那份也要一起清空，
       不然新戰鬥打到一半，巡邏頁面卻還
       殘留著上上一場的舊紀錄，兩邊會對不起來。
    */

    const mapInfo=
        $("mapBattleInfo");


    if(mapInfo){

        mapInfo.innerHTML=
            "";

    }


    /*
       ★ 新增（依照使用者要求）：
       新戰鬥開始，固定顯示的回合數標籤
       也要重置回第1回合，不然會殘留
       上一場戰鬥結束時的回合數。
    */

    const turnIndicator=
        $("battleTurnIndicator");


    if(turnIndicator){

        turnIndicator.textContent=
            "第 1 回合";

    }


    const mapTurnIndicator=
        $("mapBattleTurnIndicator");


    if(mapTurnIndicator){

        mapTurnIndicator.textContent=
            "第 1 回合";

    }

}


/*
   ★ 新增（依照使用者要求）：
   決定回合資訊列（第X回合／倒數／目標）
   跟戰鬥指令按鈕區（技能/普通攻擊/防禦/
   物品/逃脫）現在該顯示還是該藏起來。

   規則：
   - autoBattle為true（自動戰鬥持續開著）：
     不管現在是宣告還是結算階段，一律藏起來，
     不會每個角色行動完就切換一次、頻繁閃爍。
   - autoBattle為false（手動）：
     結算階段（battlePhase==="resolve"，
     雙方正在依序真正出手）藏起來，減少畫面
     雜訊；宣告階段（battlePhase==="declare"，
     等玩家自己選擇要做什麼）顯示出來，
     不然玩家會看不到按鈕、不知道要點哪裡。

   藏起來的時候順便關閉可能還開著的技能/
   物品子選單（closeMenus()），避免按鈕區
   被藏起來、子選單卻還飄在畫面上的怪狀況。
*/

function updateActionHudVisibility(){

    const shouldHide=

        autoBattle ||

        battlePhase===
        "resolve";


    /*
       ★ 修正（依照使用者澄清，先前理解錯了）：
       回合資訊列（含回合數/計時器/目標）
       自動戰鬥時照舊整個隱藏，不特別留
       回合數在這裡——使用者要的是「戰鬥
       資訊(戰鬥紀錄框)本身」顯示目前回合數，
       不是這個按鈕列的一部分，改回原本
       的整體隱藏邏輯。
    */

    const turnRow=
        $("turnTargetRow");


    if(turnRow){

        turnRow.classList.toggle(
            "battle-hud-hidden",
            shouldHide
        );

    }


    const commandRow=
        $("battleCommandRow");


    if(commandRow){

        commandRow.classList.toggle(
            "battle-hud-hidden",
            shouldHide
        );


        if(shouldHide){

            closeMenus();

        }

    }

}


function addBattleLog(text){

    const info =
        $("battleInfo");


    if(!info){
        return;
    }


    /*
       ★ 修正（依照使用者要求）：
       之前每加一行新訊息，就強制把捲軸拉到
       最底部，導致使用者往上滑想看之前的
       紀錄時，一有新訊息進來就被強制拉回去，
       完全看不到想看的內容。

       改成先判斷「使用者現在是不是已經在
       接近底部」（容許20px的誤差），
       只有在「原本就在底部附近」的情況下，
       才自動捲到新訊息；如果使用者已經
       主動往上滑開一段距離，代表他正在
       回頭看之前的紀錄，這時候新訊息進來
       不會打斷他，捲動位置維持不變。
    */

    const wasNearBottom=

        info.scrollHeight-
        info.scrollTop-
        info.clientHeight
        <20;


    const line =
        document.createElement(
            "div"
        );


    line.className =
        "battle-line";


    line.textContent =
        text;


    info.appendChild(
        line
    );


    while(
        info.children.length>80
    ){

        info.removeChild(
            info.firstChild
        );

    }


    if(wasNearBottom){

        info.scrollTop =
            info.scrollHeight;

    }


    /*
       ★ 新增（依照使用者要求，巡邏頁面的
       戰鬥資訊覆蓋層）：
       每加一行戰鬥紀錄，同步複製一份到
       巡邏頁面那份戰鬥資訊框——這是唯一
       負責寫入戰鬥紀錄文字的地方，
       在這裡同步最單純，不用另外找
       每一個呼叫addBattleLog()的地方
       各自處理。這份不用處理「捲到底部」
       的邏輯，玩家離開戰鬥、回到地圖之後
       才會看到這份，不會有「新訊息一直
       打斷正在看的內容」的問題。
    */

    const mapInfo=
        $("mapBattleInfo");


    if(mapInfo){

        const mapLine=
            document.createElement(
                "div"
            );


        mapLine.className=
            "battle-line";


        mapLine.textContent=
            text;


        mapInfo.appendChild(
            mapLine
        );


        while(
            mapInfo.children.length>80
        ){

            mapInfo.removeChild(
                mapInfo.firstChild
            );

        }


        mapInfo.scrollTop=
            mapInfo.scrollHeight;

    }

}


/* =====================================================
   玩家資訊
===================================================== */

function updatePlayerHeader(){

    const element =
        elementDatabase[
            player.element
        ]
        ||
        elementDatabase.fire;


    /*
       ★ 修正（依照使用者要求，emoji換成
       CSS動畫圖示）：textContent改成
       innerHTML，才能真的把
       <span class="element-icon...">
       這種HTML標籤渲染出來，不然會被
       當成純文字字面顯示。
    */

    $("playerName")
        .innerHTML =

        getElementIconHTML(
            player.element
        )+
        ""+
        (
            player.id||
            element.character
        );


    $("elementText")
        .innerHTML =

        getElementIconHTML(
            player.element
        )+
        ""+
        element.name;

}


/*
   ★ 新增（依照使用者要求）：
   在巡邏／地圖頁面時，最上面那條標題列
   不顯示角色的等級/HP/SP，改顯示「地圖
   名稱」＋「怪物資訊（名稱/屬性/血量/
   敏捷）」。

   怪物資訊抓的是目前地圖上（monsters[0]~
   monsters[MAX_TRAINING_MONSTERS-1]）
   第一隻還活著的怪物——跟runAutoPatrolCheck()
   自動巡怪時「打第一隻還活著的怪物」用的
   是同一個邏輯，這裡顯示的就是「巡怪按下去
   會打到的那隻怪物」，不是隨便抓一隻。

   兩組標題列（原本的角色資訊／這裡新增的
   地圖+怪物資訊）平常只會顯示一組，
   在showPage()裡切換頁面時會呼叫這裡
   重新判斷要顯示哪一組。
*/

/*
   ★ 新增（依照使用者要求，練功區改版
   共用邏輯）：
   把「列出某個地區全部怪物種類的名稱/
   等級/敏捷」這段邏輯抽成獨立函式，
   地圖頁面的怪物清單框、練功區新的
   地圖資訊彈窗，兩邊都要用到同一套，
   不要各自寫一份幾乎一樣的程式碼。

   同名怪物（拿掉王/皇不算）只列一次，
   不列血量，用config.monsters()拿到
   整份原始名單（不是currentBattleMonsters
   這種「這場戰鬥抽到誰」的清單），
   確保就算怪物在戰鬥裡被打死，清單
   還是完整顯示這個地區「有哪些種類」。
*/

function getZoneMonsterListHTML(zoneKey){

    const config=
        zoneConfig[zoneKey];


    if(!config){
        return"";
    }


    const zoneMonsters=

        typeof config.monsters===
        "function"
        ?
        config.monsters()
        :
        [];


    const seenNames=
        new Set();


    const lines=
        [];


    zoneMonsters.forEach(
        monster=>{

            if(
                !monster ||
                seenNames.has(
                    monster.name
                )
            ){
                return;
            }


            seenNames.add(
                monster.name
            );


            lines.push(

                monster.name+
                "Lv."+
                monster.level+
                "敏捷"+
                Math.round(
                    getMonsterAgility(
                        monster
                    )
                )

            );

        }
    );


    return lines
        .map(
            line=>
                "<div>"+
                line+
                "</div>"
        )
        .join("");

}


/*
   ★ 新增（依照使用者要求，練功區改版）：
   每個地區的背景美術圖，先留空字串
   （使用者之後會補上base64或圖片網址，
   只要把對應欄位填進去就會生效，
   applyTrainingZoneBackground()跟這裡
   完全不用再改）。
*/

/*
   ★ 新增（依照使用者要求，巡怪頁面
   （#mapPage）背景改成依地區動態切換）：
   原本#mapPage的背景是寫死在CSS裡的
   單一張森林圖，不管進哪個地區都長得
   一樣。這裡改成跟練功區地圖預覽同一種
   設計——一個物件裝著每個地區各自的
   背景圖，forest/desert先放上使用者
   這次提供的圖，其餘地區留空、之後
   使用者要補圖片直接填進對應欄位就好，
   不用改任何其他程式碼。

   還沒有專屬圖片的地區，套用applyMapZoneBackground()
   時會退回顯示forest這張當預設值，
   不會出現一片黑的畫面。
*/

const mapZoneBackgroundImages={

    forest:"assets/maps/forest.jpg",
    desert:"assets/maps/desert.jpg",
    ice:"",
    zone4:"",
    zone5:"",
    zone6:"",
    zone7:"",
    zone8:"",
    zone9:"",
    zone10:""

};


function applyMapZoneBackground(zoneKey){

    /*
       ★ 修正（依照使用者回報，改成操作
       獨立的position:fixed背景圖層，
       不再直接對#mapPage本身設定
       background-image）。
    */

    const bgLayer=
        $("mapPageBgLayer");


    if(!bgLayer){
        return;
    }


    const imageUrl=

        mapZoneBackgroundImages[zoneKey]||
        mapZoneBackgroundImages.forest;


    bgLayer.style.backgroundImage=

        "url("+
        imageUrl+
        ")";

}


/*
   ★ 新增（依照使用者要求，「技能配裝
   只顯示icon，目前沒有icon圖示就先空著」）：
   技能圖示的預留查找表，key是技能ID，
   value先全部留空字串。之後要幫技能補
   圖示，直接對這個物件填入對應的
   base64或圖片網址就會生效（技能列表、
   裝備欄格子、技能詳細彈窗三個地方都
   會自動套用同一張圖，不用分別去改），
   不用改任何其他程式碼。
*/

const skillIconImages={};


const zoneBackgroundImages={

    forest:"",
    desert:"",
    ice:"",
    zone4:"",
    zone5:"",
    zone6:"",
    zone7:"",
    zone8:"",
    zone9:"",
    zone10:""

};


function applyTrainingZoneBackground(zoneKey){

    /*
       ★ 修正（依照使用者回報，改成操作
       獨立的position:fixed背景圖層）：
       這個圖層的CSS class本身已經內建了
       「調暗漸層+預設總覽圖」這個組合
       （見.training-bg-fixed-layer），
       這裡如果只用行內樣式蓋一個單純的
       url(...)上去，會把調暗漸層一起蓋掉、
       個別地區的圖片會變成沒有調暗效果，
       跟總覽圖不一致。所以這裡設定行內
       樣式時，一樣要用「漸層+圖片」的
       組合寫法，不能只寫url()。
    */

    const bgLayer=
        $("trainingPageBgLayer");


    if(!bgLayer){
        return;
    }


    const imageUrl=
        zoneBackgroundImages[zoneKey];


    if(imageUrl){

        const nextBackground=
            "linear-gradient(rgba(0,0,0,.4),rgba(0,0,0,.4)),"+
            "url("+
            imageUrl+
            ")";

        if(bgLayer.style.backgroundImage!==nextBackground){
            bgLayer.style.backgroundImage=nextBackground;
        }

    }
    else{

        /*
           V97：沒有專屬圖片時只在真的存在行內背景時才清除。
           過去每次打開地區資訊都重寫backgroundImage，配合
           Samsung Browser的transform縮放與fixed背景會觸發昂貴重繪。
           現在避免無意義的style mutation，直接沿用CSS總覽背景。
        */

        if(bgLayer.style.backgroundImage){
            bgLayer.style.removeProperty("background-image");
        }

    }

}


/*
   ★ 新增：練功區地區資訊彈窗——點文字
   時觸發，顯示這個地區的怪物清單，
   並依照目前等級決定「進入」按鈕能不能
   按。跟主城那批彈窗共用同一套
   .home-feature-modal樣式。
*/

function openTrainingZoneInfo(zoneKey){

    const config=
        zoneConfig[zoneKey];


    const modal=
        $("trainingZoneModal");

    const titleEl=
        $("trainingZoneModalTitle");

    const bodyEl=
        $("trainingZoneModalBody");


    if(
        !config ||
        !modal ||
        !titleEl ||
        !bodyEl
    ){
        return;
    }


    applyTrainingZoneBackground(
        zoneKey
    );


    titleEl.textContent=
        config.title||"地區資訊";


    const monsterListHTML=
        getZoneMonsterListHTML(
            zoneKey
        );


    const unlocked=

        player.level>=
        config.requiredLevel;


    bodyEl.innerHTML=

        '<div style="font-size:16px;color:#f0b429;margin-bottom:8px;">'+
        (config.levelRange||"")+
        "</div>"+

        '<div style="font-size:16px;line-height:1.9;margin-bottom:16px;">'+
        (
            monsterListHTML||
            '<span style="color:#b3a58c;">（尚無怪物資料）</span>'
        )+
        "</div>"+

        '<div style="display:flex;gap:8px;">'+

        (
            unlocked
            ?
            '<button class="home-feature-buy-btn"style="flex:1;padding:10px 12px;font-size:16px;min-height:46px;"'+
            'onclick="closeTrainingZoneInfo();enterZone(\''+
            zoneKey+
            '\');">'+
            "進入"+
            "</button>"
            :
            '<button class="home-feature-buy-btn"style="flex:1;padding:10px 12px;font-size:16px;min-height:46px;"disabled>'+
            "需要 Lv."+
            config.requiredLevel+
            "</button>"
        )+

        '<button class="home-feature-buy-btn"style="flex:1;padding:10px;"'+
        'onclick="closeTrainingZoneInfo();">'+
        "返回"+
        "</button>"+

        "</div>";


    modal.classList.add(
        "show"
    );

}


function closeTrainingZoneInfo(){

    const modal=
        $("trainingZoneModal");


    if(modal){

        modal.classList.remove(
            "show"
        );

    }

}


function updateMapPageHeader(){

    const mapPageElement=
        $("mapPage");


    const isMapPage=

        mapPageElement &&
        mapPageElement.classList.contains(
            "active"
        );


    /*
       ★ 修正（依照使用者要求，「不是隱藏，
       是整個拿掉，不要留一塊黑色空白」）：
       這裡原本自己土法煉鋼寫了一份「主城時
       隱藏標題列」的邏輯，只用display:none
       蓋掉內容，但.content那塊區域原本是
       用position:absolute;top:62px算好
       「扣掉標題列高度後」的位置，標題列
       消失了、.content沒有跟著補上去，
       才會空出一塊62px高的黑色區域。

       後來發現showPage()裡其實已經有一套
       完整、正確處理這件事的機制
       （#app的no-header這個class，搭配
       CSS的.content{top:0}），拿掉這裡
       整段自己寫的邏輯，改成把"home"／
       "training"加進showPage()裡的
       hideHeaderPages清單，直接用現成、
       正確的機制處理，不會再留下空白區塊。
    */


    const nameEl=
        $("playerName");

    const infoEl=
        $("playerHeaderInfo");

    const zoneEl=
        $("mapHeaderZoneName");

    const monsterInfoEl=
        $("mapHeaderMonsterInfo");


    if(nameEl){

        nameEl.style.display=

            isMapPage
            ?
            "none"
            :
            "";

    }


    if(infoEl){

        infoEl.style.display=

            isMapPage
            ?
            "none"
            :
            "";

    }


    if(zoneEl){

        zoneEl.style.display=

            isMapPage
            ?
            ""
            :
            "none";

    }


    if(monsterInfoEl){

        /*
           ★ 修正（依照使用者要求，「藍色框
           其他都不要」）：這個容器(等級範圍
           那行)不管在不在地圖頁面，一律
           隱藏，只留地圖名稱那一行。
        */

        monsterInfoEl.style.display=
            "none";

    }


    if(!isMapPage){
        return;
    }


    const config=

        zoneConfig[currentZone]
        ||
        zoneConfig.forest;


    if(zoneEl){

        /*
           ★ 修正（依照使用者要求，「上面
           藍色框只留地圖名字四個字，其他
           都不要」）：
           config.title本身帶著emoji前綴
           （例如"⛰️ 巨獸荒原"），這裡用
           正規表達式去掉開頭的emoji跟
           空白，只留下純中文地圖名稱。
           也不再自己加"🗺️ "這個前綴。
        */

        zoneEl.textContent=

            (config.title||"")
            .replace(
                /^\S+\s*/,
                ""
            );

    }


    /*
       ★ 修正（依照使用者要求，「藍色框
       其他都不要」「橘色部分可以拿掉」）：
       等級範圍文字、怪物清單框，兩個都
       整個不再顯示——mapHeaderMonsterInfo
       這個外層容器本來就在上面的isMapPage
       判斷式裡被設成一定隱藏
       （display:none），這裡不用再處理；
       怪物清單框（mapMonsterListBox）
       的內容也不用再產生，直接不寫入。
    */

}


/* =====================================================
   ★ 更新UI
===================================================== */

function updateUI(){

    updateHomeTestTools();

    /*
       ★ 每次更新畫面時，順便檢查一次
       荒漠地帶的解鎖狀態要不要更新
       （玩家升級跨過Lv.11那一刻，
       練功區列表要立刻反映出來，
       不用特地跳頁才更新）。
    */

    updateTrainingZoneLocks();

    updateSecondCharacterBanner();


    /*
       ★ 新增（依照使用者要求，主城金幣
       顯示）：金幣是共用資源，任何時候
       都可能變動（賣裝備、領任務/成就
       獎勵、商店消費），updateUI()本來
       就會在很多時機點被呼叫，一起更新
       最單純，不用另外找地方重複判斷。
    */

    updateGoldDisplay();


    /*
       ★ 新增：地圖上玩家卡片的名字/等級
       （包含跟隨方塊）要跟著同步更新，
       不然升級之後地圖上顯示的還是舊等級。
    */

    updateMapPlayerCard();


    /*
       ★ 新增：巡邏頁面標題列的怪物資訊
       （名稱/屬性/血量/敏捷）會隨著戰鬥
       進行變化（打死一隻換下一隻、
       血量減少），updateUI()本來就會在
       很多時機被呼叫，一起更新，
       不用另外找地方重複判斷。
    */

    updateMapPageHeader();


    /*
       ★ 新增：戰鬥中SP變化（用了技能、喝了藥水）
       要即時反映在技能快捷列的可用狀態上，
       不然SP扣到不夠了，按鈕卻還亮著能點。
    */

    if(battleActive){

        populateSkillQuickBar();

    }


    const stats =
        getMainCharacterStats();


    /*
       如果裝備或能力改變，
       HP/SP上限變化時不要超出上限。
    */

    player.hp =
        Math.max(
            0,
            Math.min(
                player.hp,
                stats.maxHP
            )
        );


    player.sp =
        Math.max(
            0,
            Math.min(
                player.sp,
                stats.maxSP
            )
        );


    $("playerLevel")
        .textContent =
        player.level;


    $("headerHP")
        .textContent =
        player.hp;


    $("headerSP")
        .textContent =
        player.sp;


    /*
       ★ 依照玩家要求，主城首頁的完整屬性列表
       （最大HP/SP、六圍、防禦、升級進度）
       整個拿掉了，這些資訊在「狀態」頁本來就有，
       首頁重複顯示是多餘的雜訊。
       這裡原本寫給 #homeHP 等元素的那些行也一併移除，
       不然元素不存在了，繼續寫入會直接噴錯，
       導致updateUI()後面的東西全部不會執行。
    */


    if(
        $("itemMenu") &&
        $("itemMenu").classList.contains("show")
    ){
        renderBattlePotionMenu();
    }


    $("skillPoints")
        .textContent =

        (
            getSkillCharacterObject(
                currentSkillCharacter
            )||
            player
        ).skillPoints;


    /*
       經驗池顯示
    */

    $("sharedExpValue")
        .textContent =
        Math.max(0,Math.floor(Number(sharedExp)||0))
            .toLocaleString("zh-TW");


    renderExpDistributeList();


    /*
       狀態頁
    */

    updateStatusPreview();


    /*
       戰鬥中的血條
    */

    if(battleActive){

        currentBattleMonsters
        .forEach(
            index=>{
                updateMonsterUI(
                    index
                );
            }
        );


        updateBattlePlayerBars();

    }

}


/* =====================================================
   ★ 自動存檔

   除了原本在特定動作點（升級、裝備、戰鬥勝利…）
   會存檔之外，這裡再加兩層保險：

   1. 每 20 秒定時自動存一次，
      並在畫面右下角短暫顯示「💾 已自動存檔」，
      讓玩家知道真的有在存，不是憑空放心。

   2. 切到背景（切App、切分頁、螢幕鎖定）
      的當下立刻存一次，
      這是最容易漏掉進度的情況——
      玩家很可能突然被電話打斷、
      或直接切出去回LINE，
      這時候不能只靠20秒的定時器。

   兩種情況都呼叫同一個 autoSaveNow()，
   內部本身有try/catch，
   存檔失敗不會讓遊戲當掉，
   只會在console留下錯誤訊息方便之後除錯。
===================================================== */

let autosaveIndicatorTimer=null;

let autosaveIntervalId=null;


function isGameStarted(){

    return !!(
        player &&
        player.id
    );

}


function showAutosaveIndicator(){

    const el =
        $("autosaveIndicator");


    if(!el){
        return;
    }


    el.classList.add(
        "show"
    );


    clearTimeout(
        autosaveIndicatorTimer
    );


    autosaveIndicatorTimer =
        setTimeout(()=>{

            el.classList.remove(
                "show"
            );

        },1600);

}


function autoSaveNow(showIndicator){

    if(!isGameStarted()){
        return;
    }


    try{

        saveGame();


        if(showIndicator){

            showAutosaveIndicator();

        }

    }
    catch(error){

        console.error(
            "自動存檔失敗：",
            error
        );

    }

}


function startAutoSave(){

    if(autosaveIntervalId){

        clearInterval(
            autosaveIntervalId
        );

    }


    /*
       每20秒定時存檔，
       只有真正開始遊戲（已創角）才會實際寫入，
       還在創角畫面時這裡會直接跳過。
    */

    autosaveIntervalId =
        setInterval(()=>{

            autoSaveNow(true);

        },20000);


    /*
       切到背景／切分頁時立刻存一次。
       不顯示提示，因為畫面這時候
       玩家通常已經看不到了。
    */

    document.addEventListener(
        "visibilitychange",
        ()=>{

            if(document.hidden){

                autoSaveNow(false);


                /*
                   ★ 新增（依照使用者回報，
                   「切到背景再切回來到底有沒有
                   算離線經驗」）：切到背景的
                   當下，記錄這個時間點，等
                   切回前景時才知道要從這裡
                   開始算「離開了多久」。
                */

                lastOfflineCheckTimestamp=
                    Date.now();

            }
            else{

                /*
                   ★ 新增：切回前景時，用剛剛
                   切到背景記錄的時間點，算出
                   這段離線時間對應的離線經驗——
                   這樣不用整個重新整理頁面、
                   單純切背景再切回來就會真的
                   算到，回答了使用者的疑問。
                */

                calculateOfflineExpSince(
                    lastOfflineCheckTimestamp
                );

                lastOfflineCheckTimestamp=
                    Date.now();


                /*
                   ★ 新增（依照使用者要求，嘗試處理
                   「縮小視窗/切到背景再打開會卡住」
                   的問題）：
                   之前這裡只處理了「切出去」的
                   那一半（存檔），完全沒有處理
                   「切回來」該怎麼恢復——手機瀏覽器
                   在背景時會大幅降低甚至暫停計時器
                   的執行速度，回到前景的時候，
                   遊戲內部的回合計時器、
                   setTimeout排程很可能已經跟
                   實際經過的時間對不上，變成卡住
                   不動的樣子。

                   這裡沒辦法保證100%修好每一種
                   卡住的情況（背景限制是瀏覽器
                   層級的，本來就有些狀況沒辦法
                   完全避免），但至少做了一個
                   合理的補救：回到前景時，如果
                   戰鬥還在進行、輪到需要玩家自己
                   選擇的角色，重新整理一次倒數計時
                   （給一個全新的20秒，而不是延續
                   一個可能已經在背景跑完的舊倒數），
                   並且重新整理一次畫面顯示，
                   降低卡住的機率。
                */

                if(
                    battleActive &&
                    battlePhase===
                    "declare"
                ){

                    const isPlayer2Turn=

                        activeBattleCharacterIndex
                        ===1;


                    const autoOn=

                        isPlayer2Turn
                        ?
                        autoConfig2.enabled
                        :
                        autoBattle;


                    if(!autoOn){

                        timer=20;

                        updateTimer();

                    }

                }


                if(battleActive){

                    updateUI();

                }

            }

        }
    );


    /*
       關閉分頁／重新整理前盡量存一次。
       手機瀏覽器不一定會確實觸發這個事件，
       但加了完全無害，多一層保險。
    */

    window.addEventListener(
        "beforeunload",
        ()=>{

            autoSaveNow(false);

        }
    );

}


/* =====================================================
   初始化
===================================================== */

try{

    rebuildInventorySlots();

    updateCreationUI();

    renderSkillLoadout();

    renderInventory();

    updatePlayerHeader();

    updateUI();

}
catch(error){

    console.error(
        "遊戲初始化發生錯誤：",
        error
    );

}


/*
   ★ 新增：全螢幕功能。

   重要的技術限制先說清楚：
   瀏覽器基於安全考量，「絕對不允許」網頁在
   完全沒有使用者互動的情況下自動進入全螢幕，
   一定要玩家自己點一下畫面才能觸發——
   這是Chrome、Safari、所有瀏覽器共通的限制，
   不是這個遊戲做得到或做不到的問題，
   任何網頁遊戲都繞不過這一關。

   這裡做的是「退而求其次」但最順手的做法：
   監聽玩家在畫面上「第一次」的點擊或觸控，
   那一下順便一起觸發全螢幕請求，
   玩家幾乎感覺不到多一個步驟
   （不管他點的是創角畫面的按鈕，
   還是已有存檔時主城畫面的任何地方，
   都會觸發，之後就不會再打擾）。

   如果玩家的瀏覽器不支援全螢幕API、
   或瀏覽器基於某些原因拒絕請求，
   這裡用try/catch整個包起來，
   失敗了就默默放棄，不會影響遊戲本身正常運作。
*/

function requestGameFullscreen(){

    const el=
        document.documentElement;


    const request=

        el.requestFullscreen||
        el.webkitRequestFullscreen||
        el.mozRequestFullScreen||
        el.msRequestFullscreen;


    if(!request){
        return;
    }


    try{

        const result=
            request.call(el);


        if(
            result &&
            result.catch
        ){

            result.catch(()=>{});

        }

    }
    catch(error){}

}


function enableFullscreenOnFirstTap(){

    const handler=()=>{

        requestGameFullscreen();

    };


    document.addEventListener(
        "click",
        handler,
        {once:true}
    );


    document.addEventListener(
        "touchstart",
        handler,
        {once:true}
    );

}


/*
   ★ 修正（依照使用者要求）：
   不要再強制全螢幕，這裡不呼叫
   enableFullscreenOnFirstTap()，
   函式本身保留著，之後如果想要重新打開
   這個功能，直接把下面這行取消註解即可。
*/

/* V12: Do not auto-enter browser fullscreen on first tap. */
/*
   ★ 最後才讀取存檔。
   這樣第一次啟動一定會進創角，
   有存檔則一定進遊戲。
   loadGame內部本身也有try/catch，
   這裡再包一層是雙重保險，
   確保無論如何都不會卡死整個網頁。
*/

/*
   ★ 新增（依照使用者要求）：
   把4個自動戰鬥設定面板裡的原生<select>
   換成自訂假選單。這4個元素在HTML裡
   本來就存在（不是之後才動態產生的），
   這裡可以放心在遊戲啟動時就初始化一次，
   不用等到設定面板真的被打開。
*/

try{

    [
        "autoSettingsCharacterSelect",
        "autoSettingsActionSelect",
        "autoSettingsHP",
        "autoSettingsSP"
    ].forEach(
        selectId=>{

            initCustomDropdown(
                selectId
            );

        }
    );

}
catch(error){

    console.error(
        "自訂下拉選單初始化失敗：",
        error
    );

}


try{

    /*
       ★ 新增（依照使用者要求，「加點要
       新增長按快速加點」）：
       頁面載入時，把6組屬性的+/-按鈕
       全部綁上長按持續觸發，一次性
       設定，不用在每個按鈕的HTML上
       各自寫事件。
    */

    [
        ["attack","Attack"],
        ["vitality","Vitality"],
        ["energy","Energy"],
        ["intelligence","Intelligence"],
        ["spirit","Spirit"],
        ["agility","Agility"]
    ].forEach(([statKey,idPart])=>{

        attachLongPress(
            $("statusBtn"+idPart+"Minus"),
            ()=>removePoint(statKey)
        );


        attachLongPress(
            $("statusBtn"+idPart+"Plus"),
            ()=>addPoint(statKey)
        );

    });

}
catch(error){

    console.error(
        "屬性加點長按綁定失敗：",
        error
    );

}


try{

    loadGame();

}
catch(error){

    console.error(
        "讀檔流程發生未預期錯誤：",
        error
    );


    $("gameInterface")
        .style.display =
        "none";


    $("creationPage")
        .style.display =
        "block";

}


/*
   ★ 不管創角或讀檔哪條路徑，
   最後都啟動自動存檔。
   startAutoSave() 內部的定時器
   每次觸發都會自己檢查遊戲是否已經開始，
   所以就算這時候玩家還在創角畫面，
   也不會出錯或存進空資料。
*/

try{

    startAutoSave();

}
catch(error){

    console.error(
        "自動存檔啟動失敗：",
        error
    );

}

