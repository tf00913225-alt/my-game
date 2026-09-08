Warning: truncated output (original token count: 199465)
Total output lines: 33796



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


/* =====================================================
   V173.41 — MOBILE SESSION RESUME / BACKGROUND SAVE
   - The 12~15 second startup sequence remains first-entry only.
   - A reload inside the same browser tab session skips the long overlay.
   - Android background/page suspension saves immediately before eviction.
===================================================== */
const STARTUP_SESSION_READY_KEY="sixiang_startup_session_ready_v1";

(function installMobileSessionResume(){

    if(window.v17341SessionResumeInstalled){ return; }
    window.v17341SessionResumeInstalled=true;

    function sessionHasEntered(){
        try{
            return window.sessionStorage.getItem(STARTUP_SESSION_READY_KEY)==="1";
        }catch(_){
            return false;
        }
    }

    function rememberEnteredSession(){
        try{
            window.sessionStorage.setItem(STARTUP_SESSION_READY_KEY,"1");
        }catch(_){ }
    }

    function persistBeforeSuspend(){
        try{
            if(typeof saveGame==="function"){ saveGame(); }
        }catch(_){ }
    }

    if(sessionHasEntered()){
        const startupRoot=document.getElementById("startupLoader");
        if(startupRoot){
            startupRoot.hidden=true;
            startupRoot.dataset.sessionResume="1";
            startupRoot.setAttribute("aria-hidden","true");
        }
    }

    document.addEventListener("v173.20:startup-entered",rememberEnteredSession);

    document.addEventListener("visibilitychange",function(){
        if(document.hidden){ persistBeforeSuspend(); }
    });

    window.addEventListener("pagehide",persistBeforeSuspend);

})();

let deleteAllCharactersInProgress=false;


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


/*
   V130：三個角色共用同一套創角畫面。
   1=第一角色、2=第二角色、3=第三角色。
   第二／三角色不再維護另一份縮小版 modal。
*/
let creationTargetSlot=1;


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


function normalizeCharacterIdForComparison(value){
    const trimmed=String(value||"").trim();
    const normalized=typeof trimmed.normalize==="function"
        ? trimmed.normalize("NFKC")
        : trimmed;
    return normalized.toLocaleLowerCase();
}


function isCharacterIdTaken(id){
    const normalizedId=normalizeCharacterIdForComparison(id);
    return !!normalizedId && getCharacters().some(character=>
        normalizeCharacterIdForComparison(character&&character.id)===normalizedId
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

const INITIAL_CHARACTER_SKILL_POINTS=2;

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
   金幣 +1,000,000；共用經驗池 +1,000,000,000。
   不再存在最低值、永久鎖定或自動補回機制。
===================================================== */
const TEST_GOLD_GRANT=1000000;
const TEST_EXP_POOL_GRANT=1000000000;

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
   - 其餘類型：每格最多 999 件。
   - 超過上限會自動建立下一個堆疊，不讓單格突破上限。
===================================================== */

const INVENTORY_MAX_STACK_DEFAULT=999;

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

        while(remaining>0 && normalized.length<120){
            const stackCount=Math.min(maxStack,remaining);
            normalized.push(cloneInventoryStackItem(item,stackCount));
            remaining-=stackCount;
        }

        if(remaining>0){
            console.warn(
                "背包堆疊超過120格容量，剩餘物品未能放入：",
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
    const freeSlots=Math.max(0,120-inventoryItems.length);
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

const BASE_PHYSICAL_ATTACK = 30;
const BASE_MAGIC_ATTACK = 30;
const BASE_DEFENSE = 30;
const ATTACK_PER_LEVEL = 4;
const MAGIC_ATTACK_PER_LEVEL = 4;
const DEFENSE_PER_LEVEL = 3;
const ATTACK_PER_POINT = 3;
const MAGIC_ATTACK_PER_POINT = 3;
const DEFENSE_PER_VITALITY_POINT = 4;
const HP_PER_VITALITY_POINT = 50;

function getBaseStats(){

    return {

        /*
           這裡只給角色固定基礎值。
           六項能力仍然完全由玩家配點。

           1體質 = +50HP +4防禦
           1攻擊 = +3物攻
           1智力 = +3魔攻
           每級 = +4物攻／+4魔攻／+3防禦
           1能量 = +15SP

           bonusHP / bonusSP 是每次升級
           額外固定獲得的 +30HP +10SP，
           跟體質/能量的配點加成分開計算。
        */

        maxHP:
            100+
            player.vitality*HP_PER_VITALITY_POINT+
            player.bonusHP,

        maxSP:
            50+
            player.energy*15+
            player.bonusSP,

        attack:
            BASE_PHYSICAL_ATTACK+
            Math.max(1,Number(player.level)||1)*ATTACK_PER_LEVEL+
            player.attack*ATTACK_PER_POINT,

        defense:
            BASE_DEFENSE+
            Math.max(1,Number(player.level)||1)*DEFENSE_PER_LEVEL+
            player.vitality*DEFENSE_PER_VITALITY_POINT,

        magicAttack:
            BASE_MAGIC_ATTACK+
            Math.max(1,Number(player.level)||1)*MAGIC_ATTACK_PER_LEVEL+
            player.intelligence*MAGIC_ATTACK_PER_POINT,

        accuracy:
            player.spirit*2,

        resistance:
            calculateStatusResistancePercent(player.spirit),

        antiCrit:
            calculateAntiCritPercent(player.spirit),

        speed:
            player.agility,

        evasion:
            player.agility*0.6

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
    const equipmentPoints=Number(equipmentBonus&&equipmentBonus[statName])||0;

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

const FINAL_EVASION_RATE_CAP=85;

/*
   閃躲來源採獨立機率乘算，不再直接相加或拿去放大敏捷閃躲值。
   例如風元素EX 35%與風行75%：1-(1-.35)*(1-.75)=83.75%。
*/
function combineEvasionRates(sources){
    const remainingChance=(Array.isArray(sources)?sources:[]).reduce(
        (remaining,source)=>{
            const rate=Math.max(0,Math.min(100,Number(source)||0))/100;
            return remaining*(1-rate);
        },
        1
    );
    return Math.min(FINAL_EVASION_RATE_CAP,(1-remainingChance)*100);
}

window.v173CombineEvasionRates=combineEvasionRates;

/* 氣定神閒的命中加成同時供玩家與怪物共用。鏡像顯示紀錄
   可能同時存在於 activeBuffs / v141TeamBuffs，因此取最高值而不相加。 */
function getActiveAccuracyBonusPercent(entity){
    if(!entity){ return 0; }
    const entries=(entity.activeBuffs||[]).concat(entity.v141TeamBuffs||[]);
    return entries.reduce((highest,buff)=>{
        if(!buff||Number(buff.turnsLeft)<=0){ return highest; }
        const isAccuracyState=
            buff.type==="dinghaishenzhen"||
            buff.type==="resistance"||
            buff.v141BuffType==="resistance"||
            buff.statusName==="氣定神閒";
        return isAccuracyState
            ?Math.max(highest,Number(buff.accuracyBonusPercent)||0)
            :highest;
    },0);
}

function getActiveRageCriticalBonuses(entity){
    if(!entity){ return {chance:0,damage:0}; }
    const entries=(entity.v141TeamBuffs||[]).concat(entity.activeBuffs||[]);
    return entries.reduce((result,buff)=>{
        if(!buff||Number(buff.turnsLeft)<=0){ return result; }
        const isRage=buff.type==="rage"||buff.v141BuffType==="rage"||buff.statusName==="怒火";
        if(!isRage){ return result; }
        result.chance=Math.max(result.chance,Number(buff.critChanceBonusPercent)||0);
        result.damage=Math.max(result.damage,Number(buff.critDamageBonusPercent)||0);
        return result;
    },{chance:0,damage:0});
}

window.v173GetActiveAccuracyBonusPercent=getActiveAccuracyBonusPercent;
window.v173GetActiveRageCriticalBonuses=getActiveRageCriticalBonuses;

/* =====================================================
   主角最終能力
===================================================== */

function getMainCharacterStats(){

    const bonus=getEquipmentBonus(player.element);

    /* 裝備六圍統一先進入有效屬性查詢；攻擊不再於最終物攻重複加一次。 */
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
        BASE_DEFENSE+
        Math.max(1,Number(player.level)||1)*DEFENSE_PER_LEVEL+
        effectiveVitality*DEFENSE_PER_VITALITY_POINT+
        (Number(bonus.defense)||0)
    );

    const buffedDefense=rawDefense*(
        1+(defenseBuffPercent+defensePassivePercent)/100
    );

    const rawEvasion=effectiveAgility*0.6;

    return {
        /* 暫時六圍減益不動態壓縮最大HP/SP；詳見上方統一規則。 */
        maxHP:
            100+
            (player.vitality+(Number(bonus.vitality)||0))*HP_PER_VITALITY_POINT+
            player.bonusHP+
            (Number(bonus.maxHP)||0),

        maxSP:
            50+
            (player.energy+(Number(bonus.energy)||0))*15+
            player.bonusSP+
            (Number(bonus.maxSP)||0),

        attack:
            BASE_PHYSICAL_ATTACK+
            Math.max(1,Number(player.level)||1)*ATTACK_PER_LEVEL+
            effectiveAttackPoints*ATTACK_PER_POINT,

        attackPoints:effectiveAttackPoints,

        defense:Math.max(
            0,
            Math.round(buffedDefense*(1-defenseDownPercent/100))
        ),

        magicAttack:
            BASE_MAGIC_ATTACK+
            Math.max(1,Number(player.level)||1)*MAGIC_ATTACK_PER_LEVEL+
            effectiveIntelligence*MAGIC_ATTACK_PER_POINT,
        accuracy:effectiveSpirit*2,
        resistance:calculateStatusResistancePercent(effectiveSpirit),
        antiCrit:calculateAntiCritPercent(effectiveSpirit),
        speed:effectiveAgility,

        evasion:combineEvasionRates([
            rawEvasion,
            evasionBuffPercent,
            evasionPassivePercent
        ]),

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

function getAdditionalCharacterBattleStats(character,characterKey){

    if(!character || !characterKey){ return null; }

    const bonus=getEquipmentBonus(characterKey);

    const effectiveAttackPoints=getEffectivePlayerAbilityPoints(character,bonus,"attack");
    const effectiveVitality=getEffectivePlayerAbilityPoints(character,bonus,"vitality");
    const effectiveEnergy=getEffectivePlayerAbilityPoints(character,bonus,"energy");
    const effectiveIntelligence=getEffectivePlayerAbilityPoints(character,bonus,"intelligence");
    const effectiveSpirit=getEffectivePlayerAbilityPoints(character,bonus,"spirit");
    const effectiveAgility=getEffectivePlayerAbilityPoints(character,bonus,"agility");

    const windEXLevel=getSkillLevel(characterKey,"windEX");
    const earthEXLevel=getSkillLevel(characterKey,"earthEX");

    const evasionPassivePercent=windEXLevel>0
        ? (skillDatabase.windEX.evasionBonusPercent||0)
        : 0;
    const defensePassivePercent=earthEXLevel>0
        ? (skillDatabase.earthEX.defenseBonusPercent||0)
        : 0;

    const evasionBuffPercent=getActiveBuffPer…169465 tokens truncated…      color:#b3a58c;
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
        inventoryItems.length>=120
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

async function sellSelectedItem(){

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
        typeof window.rpgConfirm!=="function" ||
        !await window.rpgConfirm(
            "確定要出售"+
            item.name+
            "？\n"+
            "獲得"+
            price+
            "金幣。",
            {
                title:"出售裝備",
                confirmText:"確定出售",
                cancelText:"返回"
            }
        )
    ){
        return;
    }

    if(
        selectedInventorySlot===null ||
        inventorySlots[selectedInventorySlot]!==item
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
       之前這裡的確認訊息一直說「獲得
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
   ★ V137（清除殘留錯誤訊息）：
   autoEnabled、autoSkillHome、hpUsePctHome、spUsePctHome
   是舊版主城內嵌自動設定的元素，現行設定已改由
   autoBattleSettingsPanel動態表單處理。舊版safeBind仍在每次載入
   主動把這四個「已知不存在」的元素記成console.error，會掩蓋真正
   的錯誤；四段無效綁定已移除。

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

    /* V173.42: Element Box can use potions while no battle is running.
       Carry those notices into the next battle-info panel exactly once. */
    const pendingElementBoxNotices=
        typeof window!=="undefined"&&Array.isArray(window.v17342PendingBattleNotices)
            ? window.v17342PendingBattleNotices.splice(0)
            : [];
    pendingElementBoxNotices.forEach(message=>addBattleLog(message));


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

    const activeAuto=
        activeBattleCharacterIndex===0
        ? autoBattle
        : getPartyAutoConfig(activeBattleCharacterIndex).enabled;

    const shouldHide=
        activeAuto || battlePhase==="resolve";


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

const skillIconImages=elementSkillIconMap;


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

                    const autoOn=
                        activeBattleCharacterIndex===0
                        ? autoBattle
                        : getPartyAutoConfig(activeBattleCharacterIndex).enabled;


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


/* Mobile hardware/browser Back guard. The first Back press asks for
   confirmation; confirming performs the real navigation, cancelling keeps
   the player in the game. */
(function installMobileBackConfirmation(){

    let allowingExit=false;
    let exitPromptOpen=false;

    window.allowGameNavigation=()=>{
        allowingExit=true;
    };

    try{
        history.pushState({rpgExitGuard:true},"",location.href);
    }
    catch(error){
        console.warn("無法建立返回防呆紀錄：",error);
    }

    window.addEventListener("popstate",async()=>{
        if(allowingExit){ return; }

        /* Native confirm used to block browser history while it was open.
           The RPG dialog is asynchronous, so immediately restore a guard
           entry before awaiting the player's choice. */
        let guardRestored=false;
        try{
            history.pushState({rpgExitGuard:true},"",location.href);
            guardRestored=true;
        }catch(_){ }

        if(exitPromptOpen){ return; }
        exitPromptOpen=true;

        const confirmed=
            typeof window.rpgConfirm==="function" &&
            await window.rpgConfirm(
                "確定要離開遊戲嗎？目前進度會先自動存檔。",
                {
                    title:"離開冒險",
                    confirmText:"儲存並離開",
                    cancelText:"繼續冒險"
                }
            );

        exitPromptOpen=false;

        if(confirmed){
            allowingExit=true;
            saveGame();
            history.go(guardRestored?-2:-1);
        }
    });

})();


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
