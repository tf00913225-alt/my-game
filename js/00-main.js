

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

let SAVE_KEY=null;

function activateAccountSaveOwner(uid){
    const repository=window.FourSymbolsAccountSave;
    if(!repository){ throw new Error("Account save repository is unavailable."); }
    const activeUid=repository.activate(uid);
    SAVE_KEY=repository.saveKey(activeUid);
    return SAVE_KEY;
}

function deactivateAccountSaveOwner(){
    const repository=window.FourSymbolsAccountSave;
    if(repository){ repository.deactivate(); }
    SAVE_KEY=null;
}

window.FourSymbolsGameSave=Object.freeze({
    activate:activateAccountSaveOwner,
    deactivate:deactivateAccountSaveOwner,
    getKey:()=>SAVE_KEY,
    load:()=>loadGame(),
    hydrate:save=>loadGame(save),
    save:options=>saveGame(options),
    showCreation:()=>showCreation()
});


/* =====================================================
   V173.41 — MOBILE SESSION RESUME / BACKGROUND SAVE
   - Startup readiness is always owned by the account-first state machine.
   - A reload inside the same browser tab preserves only non-authoritative UI context.
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

    const evasionBuffPercent=getActiveBuffPercent(character,"dodgeSkill");
    const defenseBuffPercent=getActiveBuffPercent(character,"rockWall");
    const defenseDownPercent=getPlayerDefenseDownPercent(character);

    const rawDefense=(
        BASE_DEFENSE+
        Math.max(1,Number(character.level)||1)*DEFENSE_PER_LEVEL+
        effectiveVitality*DEFENSE_PER_VITALITY_POINT+
        (Number(bonus.defense)||0)
    );
    const buffedDefense=rawDefense*(
        1+(defenseBuffPercent+defensePassivePercent)/100
    );
    const rawEvasion=effectiveAgility*0.6;

    return {
        maxHP:
            100+
            (character.vitality+(Number(bonus.vitality)||0))*HP_PER_VITALITY_POINT+
            (Number(character.bonusHP)||0)+
            (Number(bonus.maxHP)||0),

        maxSP:
            50+
            (character.energy+(Number(bonus.energy)||0))*15+
            (Number(character.bonusSP)||0)+
            (Number(bonus.maxSP)||0),

        attack:
            BASE_PHYSICAL_ATTACK+
            Math.max(1,Number(character.level)||1)*ATTACK_PER_LEVEL+
            effectiveAttackPoints*ATTACK_PER_POINT,

        attackPoints:effectiveAttackPoints,

        defense:Math.max(
            0,
            Math.round(buffedDefense*(1-defenseDownPercent/100))
        ),

        magicAttack:
            BASE_MAGIC_ATTACK+
            Math.max(1,Number(character.level)||1)*MAGIC_ATTACK_PER_LEVEL+
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


function getPlayer2BattleStats(){
    return getAdditionalCharacterBattleStats(player2,"player2");
}


function getPlayer3BattleStats(){
    return getAdditionalCharacterBattleStats(player3,"player3");
}


function getPartyBattleStats(index){
    if(index===0){ return getMainCharacterStats(); }
    if(index===1){ return getPlayer2BattleStats(); }
    if(index===2){ return getPlayer3BattleStats(); }
    return null;
}


/* =====================================================
   怪物
===================================================== */

const DAMAGE_ROLE_PROFILES = Object.freeze({
    single_low:Object.freeze({powerMultiplier:1.20,powerPerLevel:0.05,flatDamage:0,flatDamagePerLevel:0}),
    single_normal:Object.freeze({powerMultiplier:1.50,powerPerLevel:0.075,flatDamage:0,flatDamagePerLevel:0}),
    single_burst:Object.freeze({powerMultiplier:1.75,powerPerLevel:0.10,flatDamage:0,flatDamagePerLevel:0}),
    tri_damage:Object.freeze({powerMultiplier:0.95,powerPerLevel:0.05,flatDamage:0,flatDamagePerLevel:0}),
    aoe_damage:Object.freeze({powerMultiplier:0.70,powerPerLevel:0.04,flatDamage:0,flatDamagePerLevel:0}),
    single_control:Object.freeze({powerMultiplier:1.50,powerPerLevel:0.075,flatDamage:0,flatDamagePerLevel:0}),
    tri_control:Object.freeze({powerMultiplier:0.95,powerPerLevel:0.05,flatDamage:0,flatDamagePerLevel:0}),
    aoe_control:Object.freeze({powerMultiplier:0.70,powerPerLevel:0.04,flatDamage:0,flatDamagePerLevel:0}),
    single_dot:Object.freeze({powerMultiplier:1.50,powerPerLevel:0.075,flatDamage:0,flatDamagePerLevel:0}),
    tri_dot:Object.freeze({powerMultiplier:0.95,powerPerLevel:0.05,flatDamage:0,flatDamagePerLevel:0}),
    aoe_dot:Object.freeze({powerMultiplier:0.70,powerPerLevel:0.04,flatDamage:0,flatDamagePerLevel:0})
});

const FORMAL_DAMAGE_SKILL_ROLES = Object.freeze({
    flameSlash:"single_low",
    fireCritical:"single_normal",
    explosiveFlurry:"tri_damage",
    dragonSlash:"single_burst",
    fireRocket:"tri_dot",
    blazeSpell:"single_dot",
    flameTornado:"single_dot",
    phoenixCry:"aoe_dot",
    waterKnife:"single_low",
    frostPunch:"single_normal",
    iceSpin:"tri_damage",
    frostCrush:"single_burst",
    waterBall:"tri_damage",
    floodBeast:"single_normal",
    iceArrowRain:"aoe_damage",
    stormFist:"single_low",
    stormFlurry:"tri_damage",
    windCrossSlash:"single_normal",
    dizzyFist:"single_normal",
    windSpell:"tri_damage",
    stormCircle:"tri_damage",
    windHowlLightning:"single_normal",
    stormRain:"aoe_damage",
    stormSpell:"aoe_damage",
    stoneSlash:"single_low",
    petrifyFist:"tri_damage",
    stoneBreakSky:"single_normal",
    earthquakeCrush:"tri_control",
    stoneThrow:"tri_damage",
    sandWind:"tri_damage",
    flyingSandStrike:"aoe_damage",
    dustStorm:"single_control"
});

function applyDamageRoleProfile(skill,damageRole){
    const profile=DAMAGE_ROLE_PROFILES[damageRole];
    if(!skill||!profile){ return false; }

    skill.damageRole=damageRole;
    skill.powerMultiplier=profile.powerMultiplier;
    skill.powerPerLevel=profile.powerPerLevel;
    skill.flatDamage=profile.flatDamage;
    skill.flatDamagePerLevel=profile.flatDamagePerLevel;
    return true;
}

function applyFormalDamageRoleProfiles(skillIds){
    if(typeof skillDatabase==="undefined"){ return []; }
    const ids=Array.isArray(skillIds)?skillIds:Object.keys(FORMAL_DAMAGE_SKILL_ROLES);
    return ids.filter(skillId=>
        applyDamageRoleProfile(skillDatabase[skillId],FORMAL_DAMAGE_SKILL_ROLES[skillId])
    );
}

function hasDamageRoleProfile(skill){
    return !!(
        skill&&
        DAMAGE_ROLE_PROFILES[skill.damageRole]&&
        Number.isFinite(Number(skill.powerMultiplier))&&
        Number.isFinite(Number(skill.powerPerLevel))&&
        Number.isFinite(Number(skill.flatDamage))&&
        Number.isFinite(Number(skill.flatDamagePerLevel))
    );
}

function getSkillPowerAtLevel(skill,level){
    const resolvedLevel=Math.max(1,Math.floor(Number(level)||1));
    return Number(skill.powerMultiplier)+Number(skill.powerPerLevel)*(resolvedLevel-1);
}

function getSkillFlatDamageAtLevel(skill,level){
    const resolvedLevel=Math.max(1,Math.floor(Number(level)||1));
    return Number(skill.flatDamage)+Number(skill.flatDamagePerLevel)*(resolvedLevel-1);
}

window.v173DamageRoleProfiles=DAMAGE_ROLE_PROFILES;
window.v173FormalDamageSkillRoles=FORMAL_DAMAGE_SKILL_ROLES;
window.v173ApplyFormalDamageRoleProfiles=applyFormalDamageRoleProfiles;
window.v173HasDamageRoleProfile=hasDamageRoleProfile;
window.v173GetSkillPowerAtLevel=getSkillPowerAtLevel;
window.v173GetSkillFlatDamageAtLevel=getSkillFlatDamageAtLevel;


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
        description:"對同一橫排左、中、右最多3名目標各造成28點基礎傷害；50%機率降低目標造成的傷害1回合，降低15%/18%/21%/25%/30%。",
        damageDownChance:50, damageDownByLevel:[15,18,21,25,30], damageDownDuration:1, requires:["stormFist"]
    },
    windCrossSlash:{
        id:"windCrossSlash", tier:3, name:"風旋十字斬", element:"wind", category:"physical", targetType:"single",
        learnCost:15, maxLevel:5, baseDamage:90, damagePerLevel:12, spCost:39,
        description:"對單體造成90點基礎傷害；65%機率降低目標造成的傷害1回合，降低15%/20%/25%/30%/35%。",
        damageDownChance:65, damageDownByLevel:[15,20,25,30,35], damageDownDuration:1, requires:["stormFlurry"]
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
   resistance and anti-crit values.
===================================================== */
const STATUS_RESIST_PER_SPIRIT_POINT = 0.05;
const ANTI_CRIT_PER_SPIRIT_POINT = 0.1;
const ANTI_CRIT_MAX_PERCENT = 25;
const CRIT_CHANCE_MIN_AFTER_ANTI_CRIT = 5;

const MAX_TRAINING_MONSTERS = 8;


const BEGINNER_FOREST_NORMAL_DAMAGE_MIN=10;
const BEGINNER_FOREST_NORMAL_DAMAGE_MAX=15;

function rollBeginnerForestNormalAttackDamage(){
    return BEGINNER_FOREST_NORMAL_DAMAGE_MIN+
        Math.floor(
            Math.random()*
            (BEGINNER_FOREST_NORMAL_DAMAGE_MAX-BEGINNER_FOREST_NORMAL_DAMAGE_MIN+1)
        );
}

const forestMonsters = [

    makeZoneMonster("哥布林",3,"fire"),
    makeZoneMonster("史萊姆",2,"water"),
    makeZoneMonster("哥布林",3,"fire"),
    makeZoneMonster("史萊姆",2,"water"),
    makeZoneMonster("哥布林",3,"fire"),
    makeZoneMonster("史萊姆",2,"water")

];

forestMonsters.forEach(monster=>{
    monster.agilityPoints=0;
    monster.agility=0;
    monster.v173BeginnerForest=true;
});


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

   總能力點 = 10 + 等級×2
   敏捷點數 = round(等級÷3)，從總能力點裡扣除
   可分配點數 = 總能力點 − 敏捷點數
   體質點數 = round(可分配點數 × 10%)，固定
   剩餘點數平均分配給攻擊／能量／智力／精神，
   餘數依固定順序補入，確保同名同級怪物數值一致。

   換算成實際數值時，直接套用跟玩家
   getBaseStats()完全相同的公式：
   maxHP    = 100 + 體質×50
   maxSP    = 50  + 能量×15
   攻擊力    = 10  + 攻擊×8
   防禦     = 10  + 體質×6
   法術攻擊  = 10  + 智力×8
   命中 = 精神×2
   一般異常抗性 = 精神×0.05（百分點）
   預設閃避 = min(30%, 等級×0.3%)
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
        points.vitality*HP_PER_VITALITY_POINT;


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
            BASE_PHYSICAL_ATTACK+
            Math.max(1,Number(level)||1)*ATTACK_PER_LEVEL+
            points.attack*ATTACK_PER_POINT,

        defense:
            BASE_DEFENSE+
            Math.max(1,Number(level)||1)*DEFENSE_PER_LEVEL+
            points.vitality*DEFENSE_PER_VITALITY_POINT,

        magicAttack:
            BASE_MAGIC_ATTACK+
            Math.max(1,Number(level)||1)*MAGIC_ATTACK_PER_LEVEL+
            points.intelligence*MAGIC_ATTACK_PER_POINT,

        accuracy:
            points.spirit*2,

        resistance:
            calculateStatusResistancePercent(points.spirit),

        antiCrit:
            calculateAntiCritPercent(points.spirit),

        evasion:
            Math.min(30,Math.max(0,Number(level)||0)*0.3),

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

    iceArrowRain:"assets/skills/water-ice-arrow-rain.jpg",

    /* V173.22：補上狂風術；分身術圖對應閃躲術。 */
    windSpell:"assets/skills/wind-gale-spell.jpg",
    stormFist:"assets/skills/wind-storm-fist.jpg",
    stormFlurry:"assets/skills/wind-storm-flurry.jpg",
    windCrossSlash:"assets/skills/wind-cross-slash.jpg",
    dizzyFist:"assets/skills/wind-dizzy-fist.jpg",
    stormCircle:"assets/skills/wind-storm-circle.jpg",
    windHowlLightning:"assets/skills/wind-howl-lightning.jpg",
    stormRain:"assets/skills/wind-storm-rain.jpg",
    dodgeSkill:"assets/skills/wind-dodge.jpg",
    stealthSkill:"assets/skills/wind-stealth.jpg",
    dinghaishenzhen:"assets/skills/wind-calm-mind.jpg",
    windEX:"assets/skills/wind-ex.jpg",

    /*
       ★ 新增（依照使用者要求，土系技能icon）：
       這次使用者上傳了15張圖，其中4張是男角Q版巡怪背面立繪
       （不是技能icon，另外處理），剩下11張是技能icon候選。
       土系總共12個技能，逐張比對名稱/技能描述後配對：

       ★ 修正（2026-08-25，使用者提供帶名稱標籤的參考圖重新核對）：
       使用者把8張候選圖各自標上正確的技能名稱傳回來，
       用像素比對（不是肉眼猜）確認每張標籤圖對應到
       原始候選圖裡的哪一張，抓出實際配錯的4個，
       並補上一張全新的earthEX專用圖（圖上直接寫著
       「EX」字樣，跟fire-ex.jpg／water-ex.jpg同款式）：

       petrifyFist（石盾拳，物理，造成傷害+全體護盾）
         → 拳頭出擊、身後有岩石護盾光環的畫面。原本配對正確，
           沒有變動。
       stoneBreakSky（石破天驚，物理，單體大傷害+護盾）
         → 巨大岩石裂開、光芒炸開的畫面（帶漩渦光環那張）。
           ★原本誤配到「土石斬」用的那張圖，這次修正。
       earthquakeCrush（地裂重拳，物理，三人傷害+自身護盾）
         → 巨大拳頭形岩層裂開、金光四射的畫面。
           ★原本誤配到「飛沙瞬擊」用的那張圖，這次修正。
       stoneThrow（落石術，法術，三人傷害+降防）
         → 巨石從天而降的畫面，直接對應「落石」。原本配對
           正確，沒有變動。
       sandWind（滾石術，法術，橫排傷害+降防）
         → 巨石滾動、拖出光跡的畫面，對應「滾石」。
           ★原本誤配到「飛沙瞬擊」用的那張圖，這次修正。
       flyingSandStrike（飛沙瞬擊，法術，全體傷害+機率石化）
         → 金色沙塵/能量漩渦畫面，對應「飛沙」。
           ★原本誤配到「滾石術」用的那張圖，這次修正。
       dustStorm（地牛猛襲，法術，全體傷害+降防）
         → 岩石巨牛衝鋒的畫面，直接對應「地牛」。原本配對
           正確，沒有變動。
       rockWall（岩石壁壘，增益，全體防禦提升）
         → 一整排岩石尖塔並列的畫面，直接對應「壁壘」。原本
           配對正確，沒有變動。
       barrier（結界，增益，單體完全防護）
         → 發光的魔法陣圓頂結界畫面，直接對應「結界」。原本
           配對正確，沒有變動。
       stoneSlash（土石斬，入門單體物理技能）
         → 使用者標明是「岩石裂開、光束斜劈」那張圖
           （原本誤配到「地裂重拳」，現在補回正確位置）。
       earthEX（土元素EX，被動）
         → 使用者新提供的專用「EX」字樣圖，跟
           fire-ex.jpg／water-ex.jpg同款式。

       ★ earthShield（萬象土盾，增益，單體反傷護盾）
       使用者重新提供並標明「萬象土盾」專用圖（金色土盾正面
       特寫），補回這個key。
    */

    petrifyFist:"assets/skills/earth-petrify-fist.jpg",
    stoneBreakSky:"assets/skills/earth-stone-break-sky.jpg",
    earthquakeCrush:"assets/skills/earth-earthquake-crush.jpg",
    stoneThrow:"assets/skills/earth-stone-throw.jpg",
    sandWind:"assets/skills/earth-sand-wind.jpg",
    flyingSandStrike:"assets/skills/earth-flying-sand-strike.jpg",
    dustStorm:"assets/skills/earth-dust-storm.jpg",
    rockWall:"assets/skills/earth-rock-wall.jpg",
    barrier:"assets/skills/earth-barrier.jpg",
    stoneSlash:"assets/skills/earth-stone-slash.jpg",
    earthEX:"assets/skills/earth-ex.jpg",
    earthShield:"assets/skills/earth-shield.jpg"
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
            attack:3
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
            intelligence:3
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
            vitality:2
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
            agility:2
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
    new Array(120).fill(null);


function rebuildInventorySlots(){

    normalizeInventoryStacks();

    inventorySlots.fill(null);


    inventoryItems.forEach(
        (item,index)=>{

            if(index<120){

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

/* Every declare/resolve step owns one deterministic advance timer. */
let battleAdvanceTimeoutId=null;
let battleAdvanceScheduled=false;
const BATTLE_DECLARE_ADVANCE_MS=90;
const BATTLE_RESOLVE_ADVANCE_MS=520;
const BATTLE_ACTION_WATCHDOG_MS=7000;
let battleActionWatchdogTimeoutId=null;

function clearBattleActionWatchdog(){
    if(!battleActionWatchdogTimeoutId){ return; }
    clearTimeout(battleActionWatchdogTimeoutId);
    battleActionWatchdogTimeoutId=null;
}

function armBattleActionWatchdog(token,index){
    clearBattleActionWatchdog();
    battleActionWatchdogTimeoutId=setTimeout(()=>{
        battleActionWatchdogTimeoutId=null;
        if(!battleActive||token!==battleToken||index!==initiativeIndex||battleAdvanceScheduled){ return; }
        console.error("戰鬥行動超過安全期限，已釋放流程閘門。",{token:token,initiativeIndex:index});
        addBattleLog("本次行動未正常回收，已由安全閘門強制繼續。");
        const director=typeof window!=="undefined"?window.v142SkillAnimationDirector:null;
        const gate=director&&typeof director.getActive==="function"?director.getActive():null;
        if(gate&&!gate.done&&typeof gate.complete==="function"){ gate.complete("combat-action-watchdog"); }
        finishPlayerAction();
    },BATTLE_ACTION_WATCHDOG_MS);
}

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


/* 第三角色使用獨立的自動戰鬥／戰後補給設定。 */
const autoConfig3 = {

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

    if(statusCharacterIndex===2 && player3){
        return player3;
    }

    if(statusCharacterIndex===1 && player2){
        return player2;
    }

    return player;

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
   V130 — 三角色共用索引／戰鬥資料
===================================================== */

function getPartyCharacterByIndex(index){
    if(index===0){ return player; }
    if(index===1){ return player2; }
    if(index===2){ return player3; }
    return null;
}


function getPartyCharacterKey(index){
    if(index===0){ return "fire"; }
    if(index===1){ return "player2"; }
    if(index===2){ return "player3"; }
    return null;
}


function getPartyAutoConfig(index){
    if(index===1){ return autoConfig2; }
    if(index===2){ return autoConfig3; }
    return autoConfig;
}


function getPartyCharacterIndex(character){
    if(character===player){ return 0; }
    if(character===player2){ return 1; }
    if(character===player3){ return 2; }
    return -1;
}


function getExistingPartyIndexes(){
    return [0,1,2].filter(index=>!!getPartyCharacterByIndex(index));
}


function getCharacterArtworkPath(character){
    if(!character){ return ""; }

    const gender=character.gender==="male" ? "male" : "female";
    const element=elementDatabase[character.element]
        ? character.element
        : "fire";

    return "assets/characters/"+gender+"_"+element+".jpg";
}


/*
   ★ 新增（依照使用者要求，「玩家戰鬥立繪能否去背」）：
   跟getCharacterArtworkPath()共用同一組gender/element
   判斷邏輯，但回傳的是另外用rembg去背過的透明PNG
   （assets/characters/battle_性別_元素.png），只給戰鬥
   卡片（.battle-player的background-image）這一個用途
   使用。角色創建預覽、背包立繪頁面的大圖仍然呼叫
   getCharacterArtworkPath()、繼續顯示原本帶場景背景的
   版本——這兩個地方的圖片本來就是同一份素材共用，
   直接把來源檔案整個換成去背版會連帶影響到那些其實
   使用者沒有要求改的畫面，所以另外開一個函式、
   只在戰鬥卡片那一處呼叫，其餘地方完全不受影響。
*/
function getCharacterBattleArtworkPath(character){
    if(!character){ return ""; }

    const gender=character.gender==="male" ? "male" : "female";
    const element=elementDatabase[character.element]
        ? character.element
        : "fire";

    return "assets/characters/battle_"+gender+"_"+element+".png";
}


function getCharacterDisplayNameByIndex(index){
    const character=getPartyCharacterByIndex(index);
    return character ? (character.id||("角色"+(index+1))) : ("角色"+(index+1));
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
        String(selectEl.value);


    Object.defineProperty(
        selectEl,
        "value",
        {

            get(){
                return currentValue;
            },

            set(newValue){

                currentValue=
                    String(newValue);


                Array.from(
                    selectEl.options
                ).forEach(
                    opt=>{

                        opt.selected=
                            (
                                opt.value===
                                currentValue
                            );

                    }
                );


                onValueChanged(
                    currentValue
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


function isThirdCharacterUnlocked(){
    return !!(
        player2 &&
        player.level>=50 &&
        player2.level>=50
    );
}


function updateCreationScreenContext(){
    const subtitle=$("creationContextSubtitle");
    const submitLabel=$("creationSubmitLabel");
    const cancelButton=$("creationCancelButton");
    const primaryNextButton=$("creationPrimaryNextButton");
    const additionalStepOneActions=$("creationAdditionalStepOneActions");

    const ordinal=
        creationTargetSlot===3
        ? "第三名"
        : creationTargetSlot===2
        ? "第二名"
        : "第一名";

    if(subtitle){
        subtitle.textContent=
            "選擇你的元素之道，建立"+ordinal+"冒險者";
    }

    if(submitLabel){
        submitLabel.textContent=
            creationTargetSlot===1
            ? "開始冒險"
            : "完成創建";
    }

    if(cancelButton){
        cancelButton.hidden=creationTargetSlot===1;
    }

    if(primaryNextButton){
        primaryNextButton.hidden=creationTargetSlot!==1;
    }

    if(additionalStepOneActions){
        additionalStepOneActions.hidden=creationTargetSlot===1;
    }
}


function resetSharedCreationForm(){
    selectedCreationElement="fire";
    creationPoints=START_ATTRIBUTE_POINTS;

    Object.keys(creationStats).forEach(stat=>{
        creationStats[stat]=0;
    });

    const idInput=$("creationId");
    if(idInput){ idInput.value=""; }

    selectElement("fire");

    if(typeof selectCreationGender==="function"){
        selectCreationGender("female");
    }

    if(typeof setCreationStep==="function"){
        setCreationStep(1);
    }

    updateCreationUI();
    updateCreationScreenContext();
}


function openCharacterCreation(slotNumber){
    const slot=Number(slotNumber);

    if(battleActive || ![2,3].includes(slot)){
        return;
    }

    if(slot===2){
        if(player2){ return; }
        if(player.level<10){
            alert("第一角色達到 Lv.10 後才能建立第二角色。");
            return;
        }
    }

    if(slot===3){
        if(player3){ return; }
        if(!isThirdCharacterUnlocked()){
            alert("第一、第二角色都達到 Lv.50 後才能建立第三角色。");
            return;
        }
    }

    closeHomeFeature();
    creationTargetSlot=slot;
    resetSharedCreationForm();
    showCreation();
}


function cancelAdditionalCharacterCreation(){
    if(creationTargetSlot===1){
        return;
    }

    creationTargetSlot=1;
    $("creationPage").style.display="none";
    $("gameInterface").style.display="block";
    updateCreationScreenContext();

    if(typeof window.syncCreationTouchMode==="function"){
        window.syncCreationTouchMode();
    }

    showPage("home");
    openHomeFeature("character");
}


function buildAdditionalCharacter(id,element,gender){
    const character={
        id:id,
        element:element,
        gender:gender==="male" ? "male" : "female",
        level:1,
        exp:0,
        expNext:100,
        attack:creationStats.attack,
        vitality:creationStats.vitality,
        energy:creationStats.energy,
        intelligence:creationStats.intelligence,
        spirit:creationStats.spirit,
        agility:creationStats.agility,
        bonusHP:0,
        bonusSP:0,
        attributePoints:creationPoints,
        skillPoints:INITIAL_CHARACTER_SKILL_POINTS,
        hp:100+creationStats.vitality*50,
        sp:50+creationStats.energy*15,
        activeBuffs:[],
        statusEffects:[],
        isDefending:false
    };

    return character;
}


function registerAdditionalCharacter(slotNumber,character){
    const characterKey=slotNumber===3 ? "player3" : "player2";
    const existing=characters.find(entry=>entry.id===characterKey);

    if(existing){
        existing.name=character.id;
    }
    else{
        characters.push({id:characterKey,name:character.id});
    }

    characterEquipment[characterKey]={
        head:null,
        hand:null,
        shoulder:null,
        armor:null,
        shoes:null,
        ring:null
    };

    characterSkillLoadouts[characterKey]={
        name:character.id,
        skillLevels:{},
        equippedSkills:[]
    };
}


function createAdditionalCharacter(slotNumber){
    const id=$("creationId").value.trim();

    if(!id){
        alert("請先輸入角色 ID。");
        return;
    }

    if(id.length<2){
        alert("ID至少需要2個字元。");
        return;
    }

    if(isCharacterIdTaken(id)){
        alert("角色 ID 不能與現有角色重複。");
        return;
    }

    Object.keys(creationStats).forEach(stat=>{
        creationStats[stat]=Math.max(0,Number(creationStats[stat])||0);
    });

    const page=$("creationPage");
    const gender=page && page.dataset.gender==="male" ? "male" : "female";
    const character=buildAdditionalCharacter(
        id,
        selectedCreationElement,
        gender
    );

    if(slotNumber===3){
        player3=character;
    }
    else{
        player2=character;
    }

    registerAdditionalCharacter(slotNumber,character);

    $("creationPage").style.display="none";
    $("gameInterface").style.display="block";

    const createdSlot=slotNumber;
    creationTargetSlot=1;
    updateCreationScreenContext();

    updateUI();
    renderInventory();
    renderSkillLoadout();
    saveGame();

    if(typeof window.syncCreationTouchMode==="function"){
        window.syncCreationTouchMode();
    }

    showPage("home");
    openHomeFeature("character");
    selectCharacterForTabs(createdSlot-1);

    alert("「"+character.id+"」創建完成！");
}


function openSecondCharacterModal(){

    openCharacterCreation(2);
    return;

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


    if(isCharacterIdTaken(id)){

        alert(
            "角色 ID 不能與現有角色重複。"
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

        skillPoints:INITIAL_CHARACTER_SKILL_POINTS,

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

    if(creationTargetSlot===2 || creationTargetSlot===3){
        createAdditionalCharacter(creationTargetSlot);
        return;
    }

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


    if(!window.FourSymbolsStartupPolicy||!window.FourSymbolsStartupPolicy.canCreateCharacter()){
        console.error("Character creation refused before account/save resolution.");
        return false;
    }

    const previousPlayer=JSON.parse(JSON.stringify(player));
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

    player.skillPoints =
        INITIAL_CHARACTER_SKILL_POINTS;


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


    if(saveGame()!==true){
        Object.keys(player).forEach(key=>delete player[key]);
        Object.assign(player,previousPlayer);
        console.error("創角存檔失敗；角色未建立。",
            new Error("Account save commit failed."));
        return false;
    }

    window.FourSymbolsStartupPolicy.notifyCharacterCreated();
    $("creationPage").style.display="none";
    $("gameInterface").style.display="block";
    return true;

}


/* =====================================================
   存檔
===================================================== */

function saveGame(options={}){

    if(deleteAllCharactersInProgress){
        return false;
    }

    const repository=window.FourSymbolsAccountSave;
    const activeUid=repository&&repository.getActiveUid();
    if(!repository||!activeUid||SAVE_KEY!==repository.saveKey(activeUid)){
        console.error("存檔失敗：尚未建立可驗證的 UID owner。");
        return false;
    }

    try{

        /*
           Team Relic is intentionally loaded after the late runtime owner
           chain.  During a page reload, loadGame() reaches the core
           saveGame() once before that runtime is installed.  Preserve the
           extension fields from the existing document for that early save;
           after installation, the live window state remains authoritative.
        */

        let existingRelicSaveData=null;

        try{

            const existingRead=repository.readForUid(activeUid);
            const existingData=existingRead.status==="ready"?existingRead.save:null;

            if(
                existingData &&
                typeof existingData==="object"
            ){

                existingRelicSaveData=
                    existingData;

            }

        }
        catch(_){

            existingRelicSaveData=null;

        }

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

            autoConfig3:
                autoConfig3,

            allyFormation:
                (
                    typeof window!=="undefined" &&
                    window.FourSymbolsBattlefieldSlots &&
                    typeof window.FourSymbolsBattlefieldSlots.getSerializableAllyFormation==="function"
                )
                ? window.FourSymbolsBattlefieldSlots.getSerializableAllyFormation()
                : (
                    existingRelicSaveData &&
                    existingRelicSaveData.allyFormation
                ),

            /*
               Team Relic persistence uses this same SAVE_KEY document.
               On the first save during reload its late runtime does not
               exist yet, so retain the previous values instead of silently
               deleting them.  Later saves read the live runtime objects.
            */

            playerRelics:
                (
                    typeof window!=="undefined" &&
                    window.playerRelics &&
                    typeof window.playerRelics==="object"
                )
                ?
                window.playerRelics
                :
                (
                    existingRelicSaveData &&
                    existingRelicSaveData.playerRelics
                ),

            teamLoadout:
                (
                    typeof window!=="undefined" &&
                    window.teamLoadout &&
                    typeof window.teamLoadout==="object"
                )
                ?
                window.teamLoadout
                :
                (
                    existingRelicSaveData &&
                    existingRelicSaveData.teamLoadout
                ),

            /*
               The formal Gameplay Center and current Abyss owners are loaded
               after the core save document. Preserve their extension fields
               during the early reload save, then use their live state once
               those runtimes have hydrated. This keeps old saves compatible
               without allowing a reload to erase first-clear progress.
            */

            gameplayProgress:
                (
                    typeof window!=="undefined" &&
                    window.GameplaySystem &&
                    typeof window.GameplaySystem.getSerializableState==="function"
                )
                ?
                window.GameplaySystem.getSerializableState()
                :
                (
                    existingRelicSaveData &&
                    existingRelicSaveData.gameplayProgress
                ),

            abyssProgress:
                (
                    typeof window!=="undefined" &&
                    typeof window.v174AbyssGetRootState==="function"
                )
                ?
                window.v174AbyssGetRootState()
                :
                (
                    existingRelicSaveData &&
                    existingRelicSaveData.abyssProgress
                ),

            inventoryItems:
                inventoryItems

        };


        const persistenceOptions=options&&typeof options==="object"?options:{};
        repository.writeForUid(activeUid,saveData,{
            source:String(persistenceOptions.source||"gameplay"),
            ...(typeof persistenceOptions.localDirty==="boolean"?{localDirty:persistenceOptions.localDirty}:{})
        });
        return true;

    }
    catch(error){

        console.error(
            "存檔失敗：",
            error
        );

        return false;

    }

}


/* =====================================================
   ★ 舊存檔修復 / 讀檔
===================================================== */

function loadGame(){

    const resolvedSave=arguments[0]||null;

    try{

        /*
           Startup may already have resolved and verified the exact UID save.
           Hydrate that payload directly so READY cannot race a second repository read.
           Ordinary load callers still read the active UID repository as before.
        */

        const repository=window.FourSymbolsAccountSave;
        const activeUid=repository&&repository.getActiveUid();
        if(!repository||!activeUid||SAVE_KEY!==repository.saveKey(activeUid)){ return false; }

        let raw=null;
        if(resolvedSave&&typeof resolvedSave==="object"&&!Array.isArray(resolvedSave)){
            raw=JSON.stringify(resolvedSave);
        }else{
            const accountSave=repository.readForUid(activeUid);
            raw=accountSave.status==="ready"?JSON.stringify(accountSave.save):null;
        }

        if(!raw){

            return false;

        }


        const data =
            JSON.parse(raw);


        if(
            !data ||
            !data.player ||
            !data.player.id
        ){

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


        if(data.autoConfig3){

            Object.assign(
                autoConfig3,
                data.autoConfig3
            );

        }


        /* V111：舊存檔門檻遷移到 25／50／75／90／100%。 */
        autoConfig.hp=normalizeAutoBattleThreshold(autoConfig.hp,50);
        autoConfig.sp=normalizeAutoBattleThreshold(autoConfig.sp,25);
        autoConfig2.hp=normalizeAutoBattleThreshold(autoConfig2.hp,50);
        autoConfig2.sp=normalizeAutoBattleThreshold(autoConfig2.sp,25);
        autoConfig3.hp=normalizeAutoBattleThreshold(autoConfig3.hp,50);
        autoConfig3.sp=normalizeAutoBattleThreshold(autoConfig3.sp,25);


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

        const savedAllyFormation=
            data.allyFormation && typeof data.allyFormation==="object"
            ? data.allyFormation
            : null;
        if(
            typeof window!=="undefined" &&
            window.FourSymbolsBattlefieldSlots &&
            typeof window.FourSymbolsBattlefieldSlots.hydrateAllyFormation==="function"
        ){
            window.FourSymbolsBattlefieldSlots.hydrateAllyFormation(
                savedAllyFormation,
                getExistingPartyIndexes()
            );
        }else if(typeof window!=="undefined"){
            window.__fourSymbolsPendingAllyFormation=savedAllyFormation;
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
           V137：讀檔原本只校正主角HP/SP，第二、第三角色若是舊存檔
           缺欄位、NaN或超過裝備後的新上限，要等到進戰鬥才會被修正，
           角色／背包頁在那之前可能顯示NaN或錯誤比例。三名角色使用
           同一套讀檔正規化規則。
        */
        [1,2].forEach(characterIndex=>{
            const character=getPartyCharacterByIndex(characterIndex);
            const stats=getPartyBattleStats(characterIndex);
            if(!character || !stats){ return; }

            character.hp=(
                !Number.isFinite(Number(character.hp)) ||
                Number(character.hp)<=0
            )
                ? stats.maxHP
                : Math.min(Number(character.hp),stats.maxHP);

            character.sp=(
                !Number.isFinite(Number(character.sp)) ||
                Number(character.sp)<0
            )
                ? stats.maxSP
                : Math.min(Number(character.sp),stats.maxSP);
        });


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

        saveGame({source:"hydration-normalization"});


        return true;

    }
    catch(error){

        console.error(
            "讀取存檔失敗：",
            error
        );


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

    updateCreationScreenContext();

}


/* =====================================================
   清除存檔
===================================================== */

async function resetGame(){

    if(
        typeof window.rpgConfirm!=="function" ||
        !await window.rpgConfirm(
            "確定要刪除角色並重新創建嗎？",
            {
                title:"刪除角色",
                confirmText:"確定刪除",
                cancelText:"保留角色",
                danger:true
            }
        )
    ){
        return;
    }

    deleteAllCharactersInProgress=true;

    if(autosaveIntervalId){
        clearInterval(autosaveIntervalId);
        autosaveIntervalId=null;
    }

    if(window.FourSymbolsAccountSave){ window.FourSymbolsAccountSave.removeActive(); }

    /* Abyss keeps a compatibility sidecar for pre-V173.64 saves. It belongs
       to the same single-player save and must be removed with the character. */
    try{
        const repository=window.FourSymbolsAccountSave;
        const uid=repository&&repository.getActiveUid();
        if(uid){ localStorage.removeItem(repository.accountKey("abyss-state",uid)); }
    }catch(_){ }

    creationTargetSlot=1;

    if(typeof window.allowGameNavigation==="function"){
        window.allowGameNavigation();
    }

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
        "gameplay",
        "boss",
        "tower"
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
            page==="home" ||
            page==="gameplay" ||
            page==="boss" ||
            page==="tower"

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

        gameplay:"bossNav",

        boss:"bossNav",

        tower:"bossNav",

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

const PATROL_FIGHT1_B64="assets/battle/patrol-fight-1-v173.21.webp";

const PATROL_FIGHT2_B64="assets/battle/patrol-fight-2-v173.21.webp";


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

        img.style.transform=
            "none";

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


    img.style.transform=
        "none";

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

        img.style.transform=
            "rotate(90deg)";

        img.src=
            PATROL_FIGHT1_B64;

    }


    const t1=
        setTimeout(()=>{

            if(img){

                img.style.transform=
                    "rotate(90deg)";

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

    if(battleAdvanceTimeoutId){
        clearTimeout(battleAdvanceTimeoutId);
        battleAdvanceTimeoutId=null;
    }
    clearBattleActionWatchdog();
    battleAdvanceScheduled=false;


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


        player2.hp=Number.isFinite(Number(player2.hp))
            ? Math.max(0,Math.min(stats2.maxHP,Number(player2.hp)))
            : stats2.maxHP;

        player2.sp=Number.isFinite(Number(player2.sp))
            ? Math.max(0,Math.min(stats2.maxSP,Number(player2.sp)))
            : stats2.maxSP;


        player2.activeBuffs=[];

        player2.statusEffects=[];

        player2.isDefending=false;

    }

    if(player3){

        const stats3=
            getPartyBattleStats(2);

        player3.hp=Number.isFinite(Number(player3.hp))
            ? Math.max(0,Math.min(stats3.maxHP,Number(player3.hp)))
            : stats3.maxHP;
        player3.sp=Number.isFinite(Number(player3.sp))
            ? Math.max(0,Math.min(stats3.maxSP,Number(player3.sp)))
            : stats3.maxSP;
        player3.activeBuffs=[];
        player3.statusEffects=[];
        player3.isDefending=false;

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
        typeof window!=="undefined" &&
        typeof window.v143SyncStatusSpriteEffects==="function"
    ){
        window.v143SyncStatusSpriteEffects();
    }


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
    return getExistingPartyIndexes().filter(index=>{
        const character=getPartyCharacterByIndex(index);
        return character && character.hp>0;
    });

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

    while(activeBattleCharacterIndex<3){
        const candidate=getPartyCharacterByIndex(activeBattleCharacterIndex);
        if(candidate && candidate.hp>0){
            break;
        }
        activeBattleCharacterIndex++;
    }

    if(activeBattleCharacterIndex>=3){

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
        getPartyCharacterByIndex(activeBattleCharacterIndex);


    if(currentActingCharacter){

        currentActingCharacter.isDefending=
            false;

    }


    timer=20;


    $("turnNumber")
        .textContent =
        turn;


    updateTimer();


    const autoOn=
        activeBattleCharacterIndex===0
        ? autoBattle
        : getPartyAutoConfig(activeBattleCharacterIndex).enabled;


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

                autoActionForCharacter(
                    activeBattleCharacterIndex,
                    token
                );

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

    const autoOn=
        activeBattleCharacterIndex===0
        ? autoBattle
        : getPartyAutoConfig(activeBattleCharacterIndex).enabled;

    if(
        !battleActive ||
        autoOn
    ){
        bar.innerHTML="";
        return;
    }

    const activeCharacterId=
        getPartyCharacterKey(activeBattleCharacterIndex);

    const activeCharacterObj=
        getPartyCharacterByIndex(activeBattleCharacterIndex);

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
    return getPartyCharacterByIndex(index);
}

function isValidAllyTargetForSkill(skill,character,index){
    if(!skill || !character){ return false; }

    if(skill.targetType==="deadAlly"){
        return character.hp<=0;
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

    [0,1,2].forEach(index=>{
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
        !(skill.targetType==="ally" || skill.targetType==="allyTri" || skill.targetType==="deadAlly") ||
        !isValidAllyTargetForSkill(skill,character,index)
    ){
        return;
    }

    const action=pendingAction;
    actionReady=false;
    pendingAction=null;

    clearBattleTargetSelectionMode();

    queuedPlayerActions[activeBattleCharacterIndex]={
        action:action,
        target:null,
        targetAlly:index
    };

    finishPlayerAction();
}


/* V99 — 在已選技能、等待點怪物目標的階段允許「返回」。
   只取消尚未送進 queuedPlayerActions 的暫存宣告，不推進回合、
   不重設計時器，也不扣 SP；若剛才誤選的是技能，就直接回到
   同一角色的技能選擇框，普通攻擊則回到五顆戰鬥指令。 */
function returnFromBattleTargetSelection(){

    if(
        !battleActive ||
        battlePhase!=="declare" ||
        !actionReady ||
        !pendingAction
    ){
        return;
    }

    const cancelledAction=pendingAction;

    actionReady=false;
    pendingAction=null;

    clearBattleTargetSelectionMode();

    const targetText=$("battleTarget");
    if(targetText){
        targetText.textContent="目標：尚未選擇";
    }

    if(cancelledAction!=="normal" && skillDatabase[cancelledAction]){
        populateSkillQuickBar();
        const overlay=$("skillQuickBar");
        if(overlay){
            overlay.classList.add("show");
        }
        syncTurnTimerWithBattlePickers();
    }
}


function clearActiveCharacterHighlight(){

    [0,1,2].forEach(i=>{
        const card=$("battlePlayerCard"+i);
        if(card){
            card.classList.remove(
                "active-turn"
            );
        }
    });
}


function updateActiveCharacterHighlight(){

    for(
        let i=0;
        i<3;
        i++
    ){

        const card=
            $("battlePlayerCard"+i);


        if(!card){
            continue;
        }


        card.classList.toggle(
            "active-turn",
            i===
            activeBattleCharacterIndex
        );

    }

    /*
       ★ 修正（依照使用者要求，版面重新設計）：
       原本這裡會找左側直書的activeTurnLabel
       窄條，把目前輪到誰的名字寫進去。
       這個元素已經拿掉（改成「技能」按鈕），
       現在「輪到誰」單純靠上面
       battlePlayerCard的active-turn外框
       高亮顯示，不需要另外的文字標籤。
    */

}


function updateTimer(){

    const timerEl=
        $("timer");


    timerEl.textContent =
        timer;


    timerEl.classList
        .toggle(
            "danger",
            timer<=5
        );


    /*
       ★ 新增（依照使用者要求）：
       每讀秒一次，數字就突然放大再瞬間縮小，
       製造「跳動」的感覺，讓倒數計時
       更顯眼、更容易注意到時間在流逝。
       用移除再強制觸發reflow再加回class的
       方式，確保連續兩次都是同一個數字
       （例如都跳過5秒的門檻）時，
       動畫還是能重新播放一次，不會因為
       class沒有變化而被瀏覽器忽略。
    */

    timerEl.classList
        .remove("timer-tick");


    void timerEl.offsetWidth;


    timerEl.classList
        .add("timer-tick");

}


function timeoutTurn(token){

    if(
        !battleActive ||
        token!==battleToken
    ){
        return;
    }


    addBattleLog(
        "⏰ 時間到，本回合沒有行動。"
    );


    actionReady=false;

    pendingAction=null;


    /*
       ★ 修正（依照使用者要求，徹底檢查後
       抓到的另一個潛在風險）：
       這裡原本自己又重寫了一次「宣告逾時
       往下一位」跟「結算逾時往下一個
       initiativeIndex」的邏輯，跟
       finishPlayerAction()裡處理的是同一件事，
       卻是兩份完全獨立、互不知情的實作
       （連delay時間都不一樣，一個120ms、
       一個1200ms/1700ms）。

       兩套實作各自維護同一份狀態
       （activeBattleCharacterIndex／
       initiativeIndex），只要日後改一邊、
       忘了改另一邊，或是這裡真的被觸發到
       跟finishPlayerAction()同時搶著推進，
       就會製造出索引被推進兩次、
       某個角色或怪物的行動被跳過的那類問題
       ——這正是這幾輪一直在抓的bug型態。

       改成直接呼叫finishPlayerAction()，
       讓「怎麼推進到下一位」永遠只有
       一個地方在做決定，這裡不再自己維護
       第二套邏輯。
    */

    finishPlayerAction();

}


/* =====================================================
   行動
===================================================== */

function prepareAction(type){

    /*
       ★ 修正：
       原本這裡永遠檢查player.sp、
       永遠假設操作的是第一角色。
       現在改成先看
       activeBattleCharacterIndex是誰的回合，
       用對應角色的技能點/SP/自動狀態來判斷。
    */

    const activeCharacter=
        getPartyCharacterByIndex(activeBattleCharacterIndex);

    const autoOn=
        activeBattleCharacterIndex===0
        ? autoBattle
        : getPartyAutoConfig(activeBattleCharacterIndex).enabled;


    if(
        !battleActive ||
        !activeCharacter ||
        activeCharacter.hp<=0 ||
        autoOn ||
        actionReady
    ){
        return;
    }


    const skill =
        skillDatabase[type];


    if(
        type!=="normal"&&
        skill
    ){

        const spCost =
            skill.spCost!==undefined
            ?
            skill.spCost
            :
            skill.cost;


        if(
            activeCharacter.sp<spCost
        ){

            addBattleLog(
                "SP不足，無法使用"+
                skill.name
            );

            return;

        }


        /*
           ★ 修正（重要，依照使用者明確指正）：
           增益/治療/復活這類技能之前是「選了就立刻生效」，
           完全繞過宣告/結算機制。

           但玩家明確指出：回合制的核心精神是
           「所有行動都要照敏捷順序結算」，
           治療/增益也不例外——敏捷太低的話，
           想幫隊友補血，可能還沒輪到你，
           隊友已經被打死了，這才是敏捷這個數值
           該有的重要性，不能讓治療/增益變成
           「無視順序、點了就生效」的特例。

           改成跟傷害技能一樣，先「宣告」存起來，
           等結算階段照敏捷順序才真正生效。
        */

        if(
            skill.category==="buff"||
            skill.category==="heal"||
            skill.category==="revive"
        ){

            if(activeBattleCharacterIndex!==0){
                addBattleLog(
                    "追加角色目前僅支援手動施放攻擊技能。"
                );
                return;
            }

            /* 單體我方技能先選角色；全體技能維持直接宣告。 */
            if(skill.targetType==="ally" || skill.targetType==="allyTri" || skill.targetType==="deadAlly"){

                const hasValidTarget=[0,1,2].some(index=>
                    isValidAllyTargetForSkill(
                        skill,
                        getBattleCharacterByIndex(index),
                        index
                    )
                );

                if(!hasValidTarget){
                    addBattleLog(
                        skill.targetType==="deadAlly"
                        ? "目前沒有陣亡的隊友可供復活。"
                        : "目前沒有可選擇的友方目標。"
                    );
                    return;
                }

                actionReady=true;
                pendingAction=type;
                closeMenus();
                setBattleAllyTargetSelectionMode(type);
                return;
            }

            actionReady=true;

            queuedPlayerActions[activeBattleCharacterIndex]={
                action:type,
                target:null,
                targetAlly:null
            };

            closeMenus();
            updateUI();
            finishPlayerAction();
            return;
        }

    }


    actionReady=true;

    pendingAction=type;

    closeMenus();

    /* V95：選好普攻／傷害技能後立即把戰鬥選項收起，
       原位置顯示兩行選目標提示，同時讓所有存活敵人
       出現閃爍準星。傷害與技能結算規則完全不改。 */
    setBattleTargetSelectionMode(
        type
    );

}


function selectBattleTarget(index){

    if(
        !battleActive ||
        !monsters[index] ||
        !monsters[index].alive
    ){
        return;
    }


    selectedMonster=index;


    document
    .querySelectorAll(
        ".battle-monster"
    )
    .forEach(card=>{
        card.classList.remove(
            "target"
        );
    });


    const target =
        $("battleMonster"+index);


    if(target){

        target.classList.add(
            "target"
        );

    }


    $("battleTarget")
        .textContent =

        "目標："+
        monsters[index].name;


    /*
       ★ 修正：
       原本只檢查全域的autoBattle，
       現在要看目前輪到誰的回合，
       用對應角色的自動開關來判斷。
    */

    const autoOn=
        activeBattleCharacterIndex===0
        ? autoBattle
        : getPartyAutoConfig(activeBattleCharacterIndex).enabled;


    if(
        actionReady &&
        pendingAction &&
        !autoOn
    ){

        const action =
            pendingAction;


        actionReady=false;

        pendingAction=null;

        clearBattleTargetSelectionMode();


        /*
           ★ 修正（重新設計回合制）：
           點選目標之後，不再馬上執行攻擊，
           而是先把「這個角色決定要做的事」
           存進queuedPlayerActions，
           等所有活著的角色都選好了，
           才會在結算階段依敏捷順序真正出手。
        */

        queuedPlayerActions[
            activeBattleCharacterIndex
        ]={

            action:action,

            target:index

        };


        /*
           ★ 修正（依照使用者要求）：
           不需要在宣告階段就先印一行
           「已選擇XX，目標：YY」浪費畫面空間、
           浪費時間讓玩家等，直接進結算階段，
           等真正造成傷害的那一刻，
           再顯示「誰用了什麼技能打了誰、
           造成多少傷害」合併成一行就好。
        */

        updateUI();

        finishPlayerAction();

    }

}


function executeAction(action){

    /*
       ★ 修正：
       原本這裡永遠操作第一角色。
       現在先判斷目前是不是第二角色的回合，
       是的話走player2專屬的施放函式
       （castPlayer2Skill/player2NormalAttack），
       並且要自己呼叫finishPlayerAction()
       往下推進到下一位角色/怪物回合
       （player2的函式本身不會自動呼叫這個，
       因為自動模式那邊也是呼叫完才呼叫一次，
       手動這邊要對稱處理）。
    */

    const isPlayer2Turn=

        activeBattleCharacterIndex===1;


    if(isPlayer2Turn){

        if(action==="normal"){

            player2NormalAttack(
                selectedMonster
            );


            updateUI();

            finishPlayerAction();

            return;

        }


        const skill2=
            skillDatabase[action];


        if(
            skill2 &&
            skill2.category!=="buff"&&
            skill2.category!=="passive"&&
            skill2.category!=="heal"&&
            skill2.category!=="revive"
        ){

            castPlayer2Skill(
                action,
                selectedMonster
            );


            updateUI();

            finishPlayerAction();

            return;

        }


        return;

    }


    if(action==="normal"){
        normalAttack();
        return;
    }

    if(action==="windArrow"){
        windArrowAttack();
        return;
    }


    /*
       ★ 新版資料驅動技能（火系10個技能裡，
       有傷害輸出的8個都會走這裡，
       水系的傷害技能之後也會走這裡）。
       怒火（buff）、治療術（heal）、
       復活術（revive）都不會走到這裡，
       因為prepareAction()已經把它們攔截掉了，
       這裡多排除一次純粹是防呆，
       避免萬一有技能繞過prepareAction()
       誤把治療/復活技能當成傷害技能來打。
    */

    const skill =
        skillDatabase[action];


    if(
        skill &&
        skill.category!=="buff"&&
        skill.category!=="passive"&&
        skill.category!=="heal"&&
        skill.category!=="revive"
    ){

        castDamageSkill(action);

        return;

    }

}


/* =====================================================
   傷害
===================================================== */

/*
   V173.38：玩家、怪物、普通攻擊與技能共用唯一正式傷害 owner。
   順序：等級、元素、防禦、普通增傷加算桶、爆擊、敵方壓力、
   技能傷害預算、95%～105% 浮動。
*/

const LEVEL_DIFF_FACTOR_PER_LEVEL_PHYSICAL = 0.01;
const LEVEL_DIFF_FACTOR_MIN_PHYSICAL = 0.85;
const LEVEL_DIFF_FACTOR_MAX_PHYSICAL = 1.15;

const DAMAGE_FORMULA_BASE_CONSTANT = 400;
const DAMAGE_FORMULA_PER_TARGET_LEVEL = 10;
const NORMAL_DAMAGE_BONUS_MULTIPLIER_MAX = 1.50;
const FINAL_CRITICAL_MULTIPLIER_MAX = 2.25;

const ENEMY_PRESSURE_RANK_BONUS = Object.freeze({
    regular:0,
    elite:0.10,
    boss:0.20
});
const ENEMY_PRESSURE_DAILY_DUNGEON_BONUS = 0.05;
const ENEMY_PRESSURE_ABYSS_BONUS = 0.15;

function getDamageFormulaConstant(targetLevel){
    const resolvedTargetLevel=Math.max(1,Number(targetLevel)||1);
    return DAMAGE_FORMULA_BASE_CONSTANT+resolvedTargetLevel*DAMAGE_FORMULA_PER_TARGET_LEVEL;
}

function getDamageLevelMultiplier(casterLevel,targetLevel){
    const levelDiff=(Number(casterLevel)||1)-(Number(targetLevel)||1);
    return Math.max(
        LEVEL_DIFF_FACTOR_MIN_PHYSICAL,
        Math.min(LEVEL_DIFF_FACTOR_MAX_PHYSICAL,1+levelDiff*LEVEL_DIFF_FACTOR_PER_LEVEL_PHYSICAL)
    );
}

window.v173GetDamageFormulaConstant=getDamageFormulaConstant;
window.v173GetDamageLevelMultiplier=getDamageLevelMultiplier;

const ELEMENT_COUNTER_MAP = {
    earth:"water",
    water:"fire",
    fire:"wind",
    wind:"earth"
};
const ELEMENT_ADVANTAGE_MULTIPLIER = 1.20;
const ELEMENT_DISADVANTAGE_MULTIPLIER = 0.85;

function getElementalDamageMultiplier(casterElement,targetElement){
    if(!casterElement||!targetElement){ return 1; }
    if(ELEMENT_COUNTER_MAP[casterElement]===targetElement){ return ELEMENT_ADVANTAGE_MULTIPLIER; }
    if(ELEMENT_COUNTER_MAP[targetElement]===casterElement){ return ELEMENT_DISADVANTAGE_MULTIPLIER; }
    return 1;
}

function getDamageContextAttacker(options){
    if(options&&options.attacker){ return options.attacker; }
    if(typeof window.v155GetCurrentDamageActor==="function"){
        return window.v155GetCurrentDamageActor();
    }
    return window.v149CurrentDamageActor||null;
}

function getOrdinaryDamageBonusPercent(options){
    const resolved=options&&typeof options==="object"?options:{};
    const attacker=getDamageContextAttacker(resolved);
    const target=resolved.target||null;
    const skill=resolved.skill||null;
    let total=0;

    if(attacker&&typeof getElementDamagePassiveMultiplier==="function"){
        total+=(Math.max(0,Number(getElementDamagePassiveMultiplier(attacker))||1)-1)*100;
    }
    if(skill&&target&&typeof getPhysicalSkillRankBonusMultiplier==="function"){
        total+=(Math.max(0,Number(getPhysicalSkillRankBonusMultiplier(skill,target))||1)-1)*100;
    }
    if(
        attacker&&target&&attacker.element==="fire"&&
        typeof getLearnedElementEX==="function"&&getLearnedElementEX(attacker,"fire")&&
        Array.isArray(target.statusEffects)&&
        target.statusEffects.some(effect=>effect&&Number(effect.turnsLeft)>0)
    ){
        total+=Number(skillDatabase.fireEX&&skillDatabase.fireEX.statusTargetDamageBonusPercent)||0;
    }
    if(attacker&&typeof window.v155GetPhoenixMightMultiplier==="function"){
        total+=(Math.max(0,Number(window.v155GetPhoenixMightMultiplier(attacker))||1)-1)*100;
    }
    if(skill&&Number.isFinite(Number(skill.damageBonusPercent))){
        total+=Number(skill.damageBonusPercent);
    }

    const extras=Array.isArray(resolved.ordinaryDamageBonusPercent)
        ?resolved.ordinaryDamageBonusPercent
        :[resolved.ordinaryDamageBonusPercent];
    extras.forEach(value=>{
        if(Number.isFinite(Number(value))){ total+=Number(value); }
    });

    if(attacker&&typeof getOutgoingDamageDownPercent==="function"){
        total-=getOutgoingDamageDownPercent(attacker);
    }
    return Math.max(-100,Math.min(50,total));
}

function getOrdinaryDamageMultiplier(options){
    return Math.max(
        0,
        Math.min(NORMAL_DAMAGE_BONUS_MULTIPLIER_MAX,1+getOrdinaryDamageBonusPercent(options)/100)
    );
}

function isPartyDamageTarget(entity){
    return !!(
        entity&&typeof getPartyCharacterIndex==="function"&&getPartyCharacterIndex(entity)>=0
    );
}

function getEnemyPressureMultiplier(attacker,target){
    if(!attacker||!target||isPartyDamageTarget(attacker)||!isPartyDamageTarget(target)){
        return 1;
    }
    const rank=typeof getMonsterRank==="function"?getMonsterRank(attacker):"regular";
    let bonus=ENEMY_PRESSURE_RANK_BONUS[rank]||0;
    if(attacker.v141Abyss){ bonus+=ENEMY_PRESSURE_ABYSS_BONUS; }
    else if(attacker.v132Dungeon||attacker.v132EquipmentDungeon){
        bonus+=ENEMY_PRESSURE_DAILY_DUNGEON_BONUS;
    }
    return 1+bonus;
}

function getDamageBudgetMultiplier(skillOrOptions){
    const options=skillOrOptions&&typeof skillOrOptions==="object"?skillOrOptions:{};
    const skill=options.skill||options;
    const explicit=Number(options.damageBudgetMultiplier);
    const configured=Number(skill&&skill.damageBudgetMultiplier);
    if(Number.isFinite(explicit)){ return Math.max(0,explicit); }
    if(Number.isFinite(configured)){ return Math.max(0,configured); }
    return 1;
}

window.v173GetOrdinaryDamageBonusPercent=getOrdinaryDamageBonusPercent;
window.v173GetOrdinaryDamageMultiplier=getOrdinaryDamageMultiplier;
window.v173GetEnemyPressureMultiplier=getEnemyPressureMultiplier;
window.v173GetDamageBudgetMultiplier=getDamageBudgetMultiplier;

function calculateDamage(
    attack,
    defense,
    casterLevel,
    targetLevel,
    casterElement,
    targetElement,
    damageOptions
){
    const options=damageOptions&&typeof damageOptions==="object"?damageOptions:{};
    const safeAttack=Math.max(0,Number(attack)||0);
    const safeDefense=Math.max(0,Number(defense)||0);
    const levelFactor=getDamageLevelMultiplier(casterLevel,targetLevel);
    const elementFactor=getElementalDamageMultiplier(casterElement,targetElement);
    const formulaConstant=getDamageFormulaConstant(targetLevel);
    const defenseFactor=formulaConstant/(formulaConstant+safeDefense);
    const ordinaryFactor=getOrdinaryDamageMultiplier(options);
    const requestedCrit=Number(options.critMultiplier);
    const criticalFactor=Number.isFinite(requestedCrit)
        ?Math.max(1,Math.min(FINAL_CRITICAL_MULTIPLIER_MAX,requestedCrit))
        :1;
    const attacker=getDamageContextAttacker(options);
    const pressureFactor=getEnemyPressureMultiplier(attacker,options.target||null);
    const budgetFactor=getDamageBudgetMultiplier(options);
    const randomFactor=0.95+Math.random()*0.10;

    const result=
        safeAttack*levelFactor*elementFactor*defenseFactor*
        ordinaryFactor*criticalFactor*pressureFactor*budgetFactor*randomFactor;

    if(!Number.isFinite(result)){ return 1; }
    return Math.max(1,Math.round(result));
}

/* =====================================================
   ★ 命中判定（新增）

   基礎命中率 = clamp(95 + 命中×0.3 - 直接命中率降低, 50%, 99%)。
   最終命中率 = clamp(基礎命中率 × (1 - 最終閃躲率), 1%, 99%)。
   玩家基礎閃躲為有效敏捷×0.6%；普通怪物預設閃躲為
   min(30%, 等級×0.3%)，特殊怪物明確指定的 evasion 保留。
===================================================== */

const HIT_CHANCE_BASE = 95;

const HIT_CHANCE_ACCURACY_COEFFICIENT = 0.3;

const HIT_CHANCE_MIN_PERCENT = 50;

const HIT_CHANCE_MAX_PERCENT = 99;


/*
   ★ 修正（依照使用者要求，怪物六圍系統
   完成後，這三個函式改成直接讀怪物身上
   真正算好的數值，不再用等級概略換算）：
   makeZoneMonster()已經把evasion/accuracy/
   resistance/agility這些最終數值算好存在
   怪物物件上了（跟玩家getBaseStats()同一套
   公式：預設閃避=min(30%,等級×0.3%)、命中=精神×2、一般異常抗性=精神×0.05、
   行動順序用的速度=敏捷原始點數），
   這裡直接讀出來，不用再另外算一次。

   保留monster.xxx===undefined時的舊公式
   當作防呆備援，理論上不會用到（現在
   makeZoneMonster()一定會給這些欄位），
   純粹避免萬一有漏網的怪物資料格式沒對齊
   而整個壞掉。
*/

/*
   ★ 修正（依照使用者要求，接上風系/土系
   技能的減益效果）：
   這三個函式現在會依序扣掉agilityDown
   （直接降敏捷的技能，例如暴風拳/狂風術）、
   statDown（降全屬性的技能，例如暴風亂擊/
   風焰術）、stun（提高MISS率＝降低命中率，
   例如暈眩猛擊/風起雲湧）這幾種減益效果目前
   的百分比，多個效果同時存在會依序疊乘
   （不是相加），跟等級差修正的邏輯一致，
   避免疊加太多個減益直接歸零。
*/

function getMonsterEvasion(monster){

    const base=

        monster.evasion!==undefined
        ? monster.evasion
        : Math.min(30,Math.max(0,Number(monster.level)||0)*0.3);


    const agilityDown=
        getMonsterDebuffValue(
            monster,
            "agilityDown"
        );

    const statDown=
        getStatDownPercentFor(
            monster,
            "agility"
        );


    return Math.max(
        0,
        base*
        (1-agilityDown/100)*
        (1-statDown/100)
    );

}


/*
   ★ 修正（依照使用者要求，重新設計暈眩
   猛擊的暈眩效果算法）：
   原本stun這個減益是在這裡（命中值本身）
   打折扣，再讓打完折的命中值去跑正常的
   命中公式，等於是「間接」影響最終機率，
   使用者最新給的數值是「降低機率由技能
   等級低至高為-10%/…/-50%」，讀起來是
   直接從最終命中機率扣掉這個%數，不是
   在命中值這層打折——兩種算法算出來的
   最終命中率不一樣，照字面意思改成
   「直接扣」，這裡拿掉stun，只留
   statDown（全屬性下降類debuff才會動到
   命中值本身），暈眩的扣減移到
   rollHitChance()裡處理（見該函式旁的
   說明），呼叫時機是「這隻怪物真的要
   出手攻擊」的那一刻，比較符合「命中率
   降低」這個描述的字面意思。
*/

function getMonsterAccuracy(monster){

    const base=

        monster.accuracy!==undefined
        ? monster.accuracy
        : monster.level*2;


    const statDown=
        getStatDownPercentFor(
            monster,
            "spirit"
        );


    return Math.max(
        0,
        base*
        (1-statDown/100)*
        (1+getActiveAccuracyBonusPercent(monster)/100)
    );

}


function getMonsterAgility(monster){

    const base=

        monster.agility!==undefined
        ? monster.agility
        : monster.level*1.2;


    const agilityDown=
        getMonsterDebuffValue(
            monster,
            "agilityDown"
        );

    const statDown=
        getStatDownPercentFor(
            monster,
            "agility"
        );


    return Math.max(
        0,
        base*
        (1-agilityDown/100)*
        (1-statDown/100)
    );

}


/*
   ★ 新增（重要）：敏捷排序的行動順序系統。

   規格：「雙方依敏捷高低順序先後出手行動」——
   之前是「玩家全部行動完，怪物才開始攻擊」，
   兩邊各自一批，現在改成玩家跟怪物混在一起，
   依敏捷（含裝備加成）由高到低排一份行動清單，
   這份清單在每個「大回合」開始時重新算一次
   （initiativeQueue），
   然後一個一個照順序處理（processNextCombatant()），
   輪到誰、誰才行動。

   敏捷相同時你要求「一樣就是隨機」，
   所以排序時額外加一個小的隨機亂數再比較，
   敏捷相同的情況下順序會隨機洗牌，
   不會每次都固定同一個人先手。
*/

let initiativeQueue=[];

/*
   ★ 新增：跟declaredCharacterIndexes同一種
   防護，擋掉手機瀏覽器計時器延遲/補發
   導致processNextCombatant()被同一個
   initiativeIndex重複呼叫的問題。
   每次startResolutionPhase()開始新的
   結算階段時清空。
*/

let processedInitiativeIndexes=
    new Set();

let initiativeIndex=0;


function buildInitiativeQueue(){

    const list=[];

    getExistingPartyIndexes().forEach(characterIndex=>{
        const character=getPartyCharacterByIndex(characterIndex);
        if(!character || character.hp<=0){ return; }

        list.push({
            type:"player",
            characterIndex:characterIndex,
            agility:getPartyBattleStats(characterIndex).agility
        });
    });


    currentBattleMonsters.forEach(
        i=>{

            if(
                monsters[i] &&
                monsters[i].alive
            ){

                list.push({

                    type:"monster",

                    monsterIndex:i,

                    agility:
                        getMonsterAgility(
                            monsters[i]
                        )

                });

            }

        }
    );


    /*
       ★ 修正（重新設計回合制之後，這裡改回單純排序）：
       之前這裡有個「第一回合強制玩家排最前面」的
       特殊處理，是在還沒有宣告/結算兩階段之前
       的暫時解法。

       現在有了宣告階段，玩家本來就一定會在
       結算開始「之前」把這回合要做什麼決定好，
       不管第幾回合都一樣，所以這個特殊處理
       已經不需要了——結算階段單純依敏捷高低排序就好，
       敏捷快的怪物依然可以搶到「結算順序」的先手，
       但那已經是玩家決定好行動之後的事了，
       不會再有「還沒設定就先挨打」的問題。
    */

    list.sort(
        (a,b)=>

            (
                b.agility+
                Math.random()*0.01
            )-
            (
                a.agility+
                Math.random()*0.01
            )

    );


    return list;

}


/*
   ★ 新增：整個回合的總調度器。
   每次一個combatant（不管是角色還是怪物）
   行動結束，都會呼叫這裡，
   往initiativeQueue的下一位推進。
   清單跑完就代表這個大回合結束，
   開下一輪（回合數+1、重新結算燃燒/buff、
   重新排一次新的行動順序）。
*/

/*
   ★ 新增：開始結算階段。
   宣告階段全部人都選好之後才會呼叫這裡，
   把「已宣告的玩家行動」跟「怪物」
   混在一起，依敏捷高低排一份執行順序，
   然後開始一個一個真正執行。
*/

function startResolutionPhase(token){

    if(
        !battleActive ||
        token!==battleToken
    ){
        return;
    }


    /*
       ★ 修正（真正抓到「同一隻怪物一個回合
       攻擊兩次」「連續跳兩個回合」的根源）：
       這裡如果已經真的執行過一次，代表這次
       呼叫是手機瀏覽器計時器延遲/補發造成的
       重複呼叫——直接擋下，不會重新建立
       initiativeQueue、不會把initiativeIndex
       跟processedInitiativeIndexes砍掉重練，
       已經在進行中的結算階段不會被打斷、
       重新從頭開始一次。
    */

    if(resolutionPhaseStarted){

        addBattleLog(
            "偵測到重複的"+
            "startResolutionPhase呼叫，"+
            "已擋下。"
        );

        return;

    }


    resolutionPhaseStarted=
        true;


    battlePhase=
        "resolve";


    updateActionHudVisibility();


    /*
       ★ 新增（依照使用者要求）：
       宣告階段結束、真正進入結算階段（開始
       依敏捷順序出手）的這一刻，把兩張玩家
       卡片上「輪到誰宣告」的黃色閃爍外框
       全部拿掉——宣告已經結束了，這個提示
       的任務也結束了，繼續閃爍反而讓人搞不清楚
       「現在到底是誰在行動」，拿掉之後畫面
       更乾淨，也不會再跟攻擊/受擊動畫的
       疊放順序打架。
    */

    clearActiveCharacterHighlight();
    clearBattleTargetSelectionMode();


    /*
       ★ 修正（真的抓到一個嚴重bug，感謝你抓出來）：

       防禦原本跟攻擊一樣，被排進依敏捷高低
       執行的結算佇列裡——這是錯的。
       如果防禦角色的敏捷比攻擊他的怪物低，
       敏捷排序會讓怪物「先」出手、
       防禦角色「後」出手，
       等於角色的防禦姿態根本還沒生效，
       攻擊就已經打完了，防禦形同虛設，
       這正是「有防禦跟沒防禦傷害一樣」的真正原因。

       防禦的本質是「這整個回合都要生效的保護」，
       不應該跟攻擊一樣受敏捷順序影響——
       不管誰快誰慢，只要這回合宣告了防禦，
       就應該在怪物出手「之前」就已經生效。

       修正方式：在結算階段真正開始（排怪物出手）
       之前，先跑一次「防禦預先套用」，
       把所有這回合宣告防禦的角色直接套用防禦狀態，
       之後才排敏捷順序、處理怪物攻擊——
       這樣防禦一定會在任何怪物出手之前就已經生效。
    */

    [0,1,2].forEach(
        characterIndex=>{

            const queued=

                queuedPlayerActions[
                    characterIndex
                ];


            if(
                queued &&
                queued.action==="defend"
            ){

                setDefendingState(
                    characterIndex
                );


                delete queuedPlayerActions[
                    characterIndex
                ];

            }

        }
    );


    initiativeQueue=
        buildInitiativeQueue();


    initiativeIndex=0;


    /*
       ★ 新增（跟宣告階段用同一套防護，
       原因一樣：手機瀏覽器背景執行時
       setTimeout可能被延遲、補發，導致
       processNextCombatant()被同一個
       initiativeIndex呼叫兩次——這極可能
       就是「同一隻怪物同一個位置連續攻擊
       兩次」的真正原因，不是怪物資料
       或機率的問題。
    */

    processedInitiativeIndexes=
        new Set();


    /*
       ★ 新增（補上防護網的缺口）：
       之前的try-catch防護網只包住宣告階段
       前兩位角色的自動判斷，第三次呼叫
       beginCharacterTurn()（索引超過隊伍長度、
       準備跳來這裡）是透過另一個獨立的計時器
       執行的，不在原本的保護範圍內——如果
       processNextCombatant()一開始執行就出錯，
       這個錯誤會被完全吞掉、不會顯示在畫面上，
       玩家只會看到「跳去結算階段」之後
       什麼都沒有發生，這正是這次除錯訊息
       停在這裡的真正原因。

       這裡補上同樣的try-catch，確保結算階段
       不管在哪個環節出錯，都會顯示出來、
       並且盡量讓遊戲繼續往下走。
    */

    try{

        processNextCombatant(
            token
        );

    }
    catch(error){

        console.error(
            "結算階段發生例外：",
            error
        );

        addBattleLog(
            "結算階段發生例外（"+
            (error&&error.message)+
            "），嘗試強制繼續。"
        );


        initiativeIndex++;

        setTimeout(()=>{

            if(
                battleActive &&
                token===battleToken
            ){

                processNextCombatant(
                    token
                );

            }

        },500);

    }

}


function processNextCombatant(token){

    if(
        !battleActive ||
        token!==battleToken
    ){
        return;
    }


    if(
        initiativeIndex>=
        initiativeQueue.length
    ){

        /*
           ★ 修正（補上最後一個漏洞，見上面
           turnAdvancePending宣告處的說明）：
           這個轉換如果已經觸發過，代表這次
           呼叫是計時器延遲補發的重複呼叫，
           直接擋下，不會turn++兩次、
           startTurn()不會被呼叫兩次。
        */

        if(turnAdvancePending){

            addBattleLog(
                "偵測到重複的"+
                "「跳到下一輪」呼叫，"+
                "已擋下。"
            );

            return;

        }


        turnAdvancePending=
            true;


        turn++;

        startTurn(token);

        return;

    }


    /*
       ★ 修正（真正的根源修法，跟宣告階段
       同一套邏輯）：
       手機瀏覽器背景執行時setTimeout可能被
       延遲、之後補發，導致這個函式被同一個
       initiativeIndex呼叫第二次——這正是
       「同一隻怪物同一個位置連續攻擊兩次」
       的真正原因。這裡擋掉重複：這個
       initiativeIndex如果已經處理過，代表
       這次呼叫是延遲補發的重複呼叫，直接
       return，不會讓同一位怪物/玩家的行動
       被執行第二次。
    */

    if(
        processedInitiativeIndexes.has(
            initiativeIndex
        )
    ){

        addBattleLog(
            "偵測到重複的"+
            "processNextCombatant呼叫"+
            "（initiativeIndex="+
            initiativeIndex+
            "已經處理過），已擋下。"
        );

        return;

    }


    processedInitiativeIndexes.add(
        initiativeIndex
    );

    armBattleActionWatchdog(token,initiativeIndex);


    const entry=

        initiativeQueue[
            initiativeIndex
        ];


    if(entry.type==="player"){

        /*
           這個角色有可能在這個大回合
           更早之前就已經陣亡
           （被怪物打死，或第二角色倒下），
           直接跳過，不佔用行動。
        */

        const character=
            getPartyCharacterByIndex(entry.characterIndex);


        if(
            !character ||
            character.hp<=0
        ){

            initiativeIndex++;


            processNextCombatant(
                token
            );

            return;

        }


        if(isMonsterFrozen(character)){

            addBattleLog(
                (character.id||"你")+
                "被冰封，無法行動。"
            );

            finishPlayerAction();

            return;
        }

        if(isMonsterPetrified(character)){

            addBattleLog(
                (character.id||"你")+
                "被石化，無法行動。"
            );

            finishPlayerAction();

            return;
        }


        activeBattleCharacterIndex=

            entry.characterIndex;


        /*
           ★ 修正（重新設計回合制）：
           結算階段不再重新呼叫
           beginCharacterTurn()等新的輸入，
           而是把這個角色在宣告階段
           已經選好的行動（queuedPlayerActions）
           真正拿出來執行。
        */

        try{
            resolveQueuedPlayerAction(
                entry.characterIndex,
                token
            );
        }catch(error){
            console.error("結算玩家行動時發生未攔截例外：",error);
            addBattleLog("結算玩家行動時發生例外，已由安全閘門繼續。");
            finishPlayerAction();
        }

    }
    else{

        try{
            processSingleMonsterAttack(
                entry.monsterIndex,
                token
            );
        }catch(error){
            console.error("結算敵方行動時發生未攔截例外：",error);
            addBattleLog("結算敵方行動時發生例外，已由安全閘門繼續。");
            finishPlayerAction();
        }

    }

}


/*
   ★ 新增：把宣告階段選好、存起來的行動
   真正拿出來執行。

   自動戰鬥的角色不會走到這裡——他們在
   宣告階段輪到自己時就已經直接執行完了
   （autoAction()/player2AutoAction()），
   這裡處理的都是手動角色宣告階段
   存下來的普通攻擊/傷害技能。
*/

function resolveQueuedPlayerAction(characterIndex,token){

    const queued=

        queuedPlayerActions[
            characterIndex
        ];


    if(!queued){

        /*
           防呆：理論上宣告階段每個活著的
           手動角色都應該有存到一筆行動，
           萬一真的沒有（例如逾時沒選），
           直接跳過，不卡住結算流程。
        */

        finishPlayerAction();

        return;

    }


    const isAdditionalCharacter=
        characterIndex>0;


    /*
       ★ 修正（重要，依照使用者明確指正）：
       防禦、藥水、增益/治療/復活這幾種
       之前都是「選了就立刻生效」，
       現在全部改成跟攻擊一樣先宣告再結算，
       這裡要補上對應的執行分支。

       這幾種都不需要目標（target是null），
       跟需要選怪物當目標的普通攻擊/傷害技能
       分開處理。
    */

    if(queued.action==="defend"){

        applyDefendEffect(
            characterIndex
        );

        return;

    }


    if(queued.action==="escape"){

        resolveEscapeAttempt(
            characterIndex
        );

        return;

    }


    if(queued.action==="potion"){

        activeBattleCharacterIndex=
            characterIndex;


        applyPotionEffect(
            queued.potionId,
            characterIndex
        );

        return;

    }


    const queuedSkill=
        skillDatabase[
            queued.action
        ];


    if(
        queuedSkill &&
        (
            queuedSkill.category==="buff"||
            queuedSkill.category==="heal"||
            queuedSkill.category==="revive"
        )
    ){

        /*
           目前增益/治療/復活只支援第一角色，
           跟prepareAction()裡的限制一致。
        */

        activeBattleCharacterIndex=
            characterIndex;


        /*
           ★ 修正（依照使用者要求，接上新增的
           風系/土系增益技能）：
           原本這裡不管排的是哪個增益技能，
           一律硬呼叫castRageBuff()——這代表
           如果玩家排的是新增的閃躲術/岩石
           壁壘/萬象土盾/結界/隱身術/糧草
           先行，實際上會錯誤地執行「怒火」
           的邏輯，不是玩家真正選的技能。

           改成把queued.action（真正的技能ID）
           傳進去，castBuffSkill()內部會依
           技能ID分流到正確的效果。
        */

        if(queuedSkill.category==="buff"){

            castBuffSkill(
                queued.action,
                queued.targetAlly
            );

        }
        else if(queuedSkill.category==="heal"){

            castHealSkill(
                queued.action,
                queued.targetAlly
            );

        }
        else{

            castReviveSkill(
                queued.action,
                queued.targetAlly
            );

        }


        return;

    }


    if(
        queued.target!==null &&
        queued.target!==undefined
    ){

        selectedMonster=
            queued.target;

    }


    if(isAdditionalCharacter){

        try{

            if(queued.action==="normal"){

                secondaryCharacterNormalAttack(
                    characterIndex,
                    queued.target
                );

            }
            else{

                castSecondaryCharacterSkill(
                    characterIndex,
                    queued.action,
                    queued.target
                );

            }

        }
        catch(error){

            /*
               ★ 新增（防護網補到最後一個缺口）：
               processNextCombatant()、
               beginCharacterTurn()的自動判斷
               都已經有try-catch，唯獨「結算階段
               真正執行玩家/第二角色行動」這一段
               完全沒有——任何一個技能施放函式
               裡面，只要有任何一行意外拋出例外
               （例如資料沒對齊、undefined存取），
               整條結算鏈就會在這一刻無聲斷掉，
               玩家只會看到畫面停住，什麼提示
               都沒有，症狀跟「卡住不動」一模一樣。

               補上跟其他地方一致的防護：印出
               真正的錯誤內容到戰鬥紀錄（不用再
               靠猜的），並強制呼叫
               finishPlayerAction()讓戰鬥
               繼續往下走，不會卡死在這一步。
            */

            console.error(
                "結算第二角色行動時發生例外：",
                error
            );

            addBattleLog(
                "結算行動時發生例外（"+
                (error&&error.message)+
                "），已強制繼續。"
            );

            finishPlayerAction();

        }

    }
    else{

        try{

            if(queued.action==="normal"){

                normalAttack();

            }
            else{

                castDamageSkill(
                    queued.action
                );

            }

        }
        catch(error){

            console.error(
                "結算第一角色行動時發生例外：",
                error
            );

            addBattleLog(
                "結算行動時發生例外（"+
                (error&&error.message)+
                "），已強制繼續。"
            );

            finishPlayerAction();

        }

    }

}


/*
   ★ 修正（依照使用者要求，暈眩猛擊重新
   設計）：新增第3個參數
   directChanceReductionPercent，直接從
   算好的命中機率（還沒套用60~99上下限
   之前）扣掉這個%數，代表暈眩帶來的
   命中率下降是「扣點數」，不是「打折」，
   跟命中值/閃避這些既有加成用同一套
   加減邏輯、同一個上下限夾住，不會出現
   暈眩把命中率直接砍到負數或需要另外
   處理的極端值。
   不傳這個參數（大部分呼叫的地方都不需要）
   的話效果跟以前完全一樣，只有monster
   出手攻擊玩家、且monster身上真的有stun
   這個減益時才會傳進來。
*/

function rollHitChance(
    casterAccuracy,
    targetEvasion,
    directChanceReductionPercent
){

    const rawAccuracyChance =
        HIT_CHANCE_BASE+
        casterAccuracy*
        HIT_CHANCE_ACCURACY_COEFFICIENT-
        (directChanceReductionPercent||0);

    const accuracyChance =
        Math.max(
            HIT_CHANCE_MIN_PERCENT,
            Math.min(
                HIT_CHANCE_MAX_PERCENT,
                rawAccuracyChance
            )
        );

    const evasionRate=Math.max(
        0,
        Math.min(FINAL_EVASION_RATE_CAP,Number(targetEvasion)||0)
    );

    const chance=Math.max(
        1,
        Math.min(
            HIT_CHANCE_MAX_PERCENT,
            accuracyChance*(1-evasionRate/100)
        )
    );


    return (
        Math.random()*100<
        chance
    );

}


/* =====================================================
   V173.38 技能傷害：有效攻擊 × damageRole ＋正式 flatDamage，
   再且只交給 calculateDamage() 一次。舊式五參數呼叫及
   尚未遷移技能保留固定傷害回退，供歷史流程相容。
===================================================== */

function getSkillRawAttack(skill,skillLevel,effectiveAttack){
    const attack=Math.max(0,Number(effectiveAttack)||0);
    if(hasDamageRoleProfile(skill)){
        return attack*getSkillPowerAtLevel(skill,skillLevel)+
            getSkillFlatDamageAtLevel(skill,skillLevel);
    }
    return attack+getSkillDamageAtLevel(skill,skillLevel);
}

window.v173GetSkillRawAttack=getSkillRawAttack;

function calculateSkillDamage(skillOrOptions,statBonus,monster,casterLevel,casterElement){
    if(skillOrOptions&&typeof skillOrOptions==="object"&&skillOrOptions.skill){
        const options=skillOrOptions;
        const target=options.target||{};
        const explicitDefense=Number(options.targetDefense);
        const targetDefense=Number.isFinite(explicitDefense)
            ?explicitDefense
            :getMonsterEffectiveDefense(target);

        return calculateDamage(
            getSkillRawAttack(options.skill,options.skillLevel,options.effectiveAttack),
            targetDefense,
            options.casterLevel,
            target.level,
            options.casterElement,
            target.element,
            Object.assign({},options,{
                damageBudgetMultiplier:getDamageBudgetMultiplier(options)
            })
        );
    }

    return calculateDamage(
        (Number(skillOrOptions)||0)+(Number(statBonus)||0),
        getMonsterEffectiveDefense(monster),
        casterLevel,
        monster.level,
        casterElement,
        monster.element,
        {target:monster,attacker:getDamageContextAttacker({})}
    );
}


/* =====================================================
   ★ 異常狀態命中機率公式（新增）

   規格（使用者原話）：
   「精神越高，抗性就越高，就不容易被異常狀態命中。
     智力越高，異常狀態命中機率就越高，
     再加上等級壓制也會影響整體機率」

   一般異常最終機率 = 基礎機率×等級差倍率
     + 物理攻擊力或智力×0.05
     - 目標精神×0.05
     - 額外異常抗性，最後限制在5%～95%。

   冰封、石化等硬控維持獨立公式：屬性加成為
   sqrt(物攻或智力)×0.2，精神與稀有度上限沿用既有規則。

   ★ 修正（依照使用者要求，「鎖死行動的
   技能獨立設一組範圍，5%~60%」）：
   原本全部異常狀態（燃燒/敏捷降低/防禦
   降低/暈眩/冰封/石化……）共用同一組
   5%~95%上下限，但冰封/石化這兩種是
   「整回合完全無法行動」，跟其他只是
   削弱數值的debuff，效果份量差太多，
   不該共用同一組機率上限——不然智力
   堆一堆，冰封機率也能衝到9成，等於
   讓對手整場都動不了，太強。

   isLockdown 參數供冰封／石化呼叫時傳 true；
   其他一般debuff（敏捷/
   防禦/全屬性降低、暈眩）維持原本的
   5%~95%，不受影響。
===================================================== */

const GENERAL_STATUS_OFFENSE_COEFFICIENT = 0.05;
const LOCKDOWN_STATUS_SPIRIT_COEFFICIENT = 0.3;

/*
   一般異常每1點精神降低0.05個百分點命中率；
   硬控仍在獨立公式使用原本的0.3係數。
*/
function calculateStatusResistancePercent(spiritPoints){
    return Math.max(0,Number(spiritPoints)||0)*STATUS_RESIST_PER_SPIRIT_POINT;
}

const STATUS_HIT_MIN_PERCENT = 5;

const STATUS_HIT_MAX_PERCENT = 95;

/*
   ★ 修正（依照使用者要求，「限制行動的
   異常狀態常數修改」，改成依怪物等級
   分三個等級各自的上下限）：
   鎖死行動類技能（冰封/石化）依目標怪物
   稀有度使用普通80%、精英60%、BOSS40%的上限。

   怎麼判斷一隻怪物是「野怪」還是「精英怪」：
   看getMonsterRank()——目前規則很單純，
   名字結尾是「王」就算精英怪，其餘都算
   野怪；如果之後怪物資料想更精準指定
   （不只靠名字判斷），可以額外加一個
   monster.rank欄位，getMonsterRank()
   會優先看這個欄位，沒有才退回看名字。
*/

const LOCKDOWN_HIT_BOUNDS = {

    regular:{
        min:5,
        max:80
    },

    elite:{
        min:5,
        max:60
    },

    boss:{
        min:5,
        max:40
    }

};


function getMonsterRank(monster){

    if(!monster){
        return "regular";
    }


    if(
        monster.rank==="regular"||
        monster.rank==="elite"||
        monster.rank==="boss"
    ){
        return monster.rank;
    }


    return "regular";

}


/*
   ★ 新增（依照使用者要求，「物理技能，
   對精英怪傷害加乘10%，boss15%」，
   跟法術技能靠targetType比較寬廣（tri/
   row/all）分工——物理技能專精單體
   硬仗，這裡補上這塊）：

   只有「技能」吃得到這個加成，普通攻擊
   （沒有skill物件、或category不是
   "physical"）不算，這是使用者明確要求
   保留的區分——普通攻擊不是戰士的特色，
   物理技能才是。

   野怪（regular）沒有加成，精英怪
   （名字帶「王」，或未來明確標記
   monster.rank）+10%，BOSS+15%，跟
   getMonsterRank()判斷稀有度是同一套
   規則，不用重寫一次判斷邏輯。
*/

const PHYSICAL_SKILL_ELITE_BONUS_PERCENT = 10;

const PHYSICAL_SKILL_BOSS_BONUS_PERCENT = 15;


function getPhysicalSkillRankBonusMultiplier(
    skill,
    monster
){

    if(
        !skill||
        skill.category!==
        "physical"
    ){
        return 1;
    }


    const rank=
        getMonsterRank(monster);


    if(rank==="boss"){

        return 1+
            PHYSICAL_SKILL_BOSS_BONUS_PERCENT/
            100;

    }


    if(rank==="elite"){

        return 1+
            PHYSICAL_SKILL_ELITE_BONUS_PERCENT/
            100;

    }


    return 1;

}

/*
   ★ 新增（依照使用者要求，「智力遞減、
   不能沒有用，考慮到之後BOSS精神會更高」）：
   鎖死行動類技能的智力加成，改用開根號
   （Math.sqrt(智力)×係數）取代原本一般
   debuff用的線性公式（智力×係數）。

   開根號的效果是「邊際效益遞減」——智力
   越堆越高，每一點智力換來的機率增幅會
   自動變小，不會像線性公式那樣，玩家
   智力養到中期（大約300~500）就直接
   卡死在60%上限、之後智力再怎麼加都
   感受不到差異。

   係數維持0.2；BOSS精神仍按硬控原本的0.3
   係數扣除，不受一般異常0.05調整影響。
*/

const LOCKDOWN_INT_COEFFICIENT = 0.2;


/*
   ★ 新增（依照使用者要求，「定海神針：
   使我方全體異常狀態抗性提升25%」；後續
   修正為通用版本，呼應「應該設定只要我方
   都能吃到效果，寫一次就一勞永逸」這個
   要求）：

   這個函式是給「將來怪物對玩家施放異常
   狀態」的邏輯呼叫用的——目前遊戲裡怪物
   完全不會對玩家施放燃燒/冰封/暈眩/降防禦
   這類異常狀態（processSingleMonsterAttack()
   整段查過，只有造成傷害，沒有任何debuff
   判定），所以這個函式目前不會被任何地方
   呼叫、25%抗性目前對實戰沒有影響，先把
   「查詢用的函式」跟「buff儲存」都做對，
   等之後真的要做「怪物對玩家下異常狀態」
   時，直接把這個函式回傳值當成額外異常抗性
   傳進正式公式即可。

   改成吃character參數（跟getActiveBuffPercent()/
   hasActiveBuff()同一種通用設計），不寫死
   player，這樣角色二號、以後角色三號四號，
   呼叫這個函式時傳自己的角色物件進來就好，
   不用另外寫一份player2專用版本。

   額外異常抗性採百分點直接扣除，不做第二次乘算。
*/

function getPlayerStatusResistBonus(character){

    if(!character){
        return 0;
    }

    let bonus=0;

    const active=(character.activeBuffs||[]).find(
        b=>b.type==="dinghaishenzhen" && b.turnsLeft>0
    );

    if(active){
        bonus+=Number(active.resistBonus)||0;
    }

    let skillKey=null;
    if(character===player){
        skillKey="fire";
    }
    else if(character===player2){
        skillKey="player2";
    }
    else if(typeof player3!=="undefined" && character===player3){
        skillKey="player3";
    }

    if(skillKey && getSkillLevel(skillKey,"waterEX")>0){
        bonus+=Number(skillDatabase.waterEX.statusResistBonus)||0;
    }

    return bonus;
}

function calculateStatusEffectChance(
    baseChancePercent,
    casterLevel,
    targetLevel,
    casterIntelligence,
    targetSpirit,
    isLockdown,
    targetRank,
    targetBonusResistancePercent
){

    const levelDiff =
        casterLevel-
        targetLevel;


    const levelFactor =
        Math.max(
            LEVEL_DIFF_FACTOR_MIN,
            Math.min(
                LEVEL_DIFF_FACTOR_MAX,
                1+
                levelDiff*
                LEVEL_DIFF_FACTOR_PER_LEVEL
            )
        );


    /*
       ★ 修正：鎖死行動類技能（isLockdown為
       true）的智力加成改用開根號，一般
       debuff（燃燒/削弱類）維持原本線性
       公式，兩者互不影響。
    */

    const attributeBonus=

        isLockdown
        ?
        Math.sqrt(casterIntelligence)*
        LOCKDOWN_INT_COEFFICIENT
        :
        casterIntelligence*
        GENERAL_STATUS_OFFENSE_COEFFICIENT;


    const targetResistancePercent =
        Math.max(0,Number(targetSpirit)||0)*
        (isLockdown
            ?LOCKDOWN_STATUS_SPIRIT_COEFFICIENT
            :STATUS_RESIST_PER_SPIRIT_POINT);

    const rawChance =
        baseChancePercent*
        levelFactor+
        attributeBonus-
        targetResistancePercent-
        (Number(targetBonusResistancePercent)||0);


    /*
       ★ 修正（依照使用者要求，「限制行動的
       異常狀態常數修改」）：
       鎖死類技能不再只有一組固定上下限，
       改成依targetRank（野怪/精英怪/BOSS）
       去LOCKDOWN_HIT_BOUNDS裡查對應的
       min/max，沒傳rank的話預設當野怪
       （最寬鬆那組），保留舊呼叫方式的
       相容性。
    */

    const lockdownBounds=

        LOCKDOWN_HIT_BOUNDS[
            targetRank
        ]||
        LOCKDOWN_HIT_BOUNDS.regular;


    const minPercent=

        isLockdown
        ?
        lockdownBounds.min
        :
        STATUS_HIT_MIN_PERCENT;


    const maxPercent=

        isLockdown
        ?
        lockdownBounds.max
        :
        STATUS_HIT_MAX_PERCENT;


    return Math.max(
        minPercent,
        Math.min(
            maxPercent,
            rawChance
        )
    );

}


/*
   實際判定是否命中異常狀態時呼叫這個，
   回傳 true/false。
   Math.random()*100 是 0~100 之間的亂數，
   小於算出來的機率就算命中。

   ★ 修正：新增isLockdown參數，冰封/石化
   呼叫時要記得傳true，才會套用比較嚴格
   的上限。

   ★ 再次修正（依照使用者要求，「限制
   行動的異常狀態常數修改」）：新增
   targetRank參數（"regular"/"elite"/
   "boss"），冰封/石化這類鎖死技能打
   在怪物身上時，記得傳getMonsterRank
   (monster)算出來的稀有度，才會套用
   對應那組上下限（見calculateStatusEffectChance()
   旁的LOCKDOWN_HIT_BOUNDS說明）。
*/

function rollStatusEffectHit(
    baseChancePercent,
    casterLevel,
    targetLevel,
    casterIntelligence,
    targetSpirit,
    isLockdown,
    targetRank,
    targetBonusResistancePercent
){

    const chance =
        calculateStatusEffectChance(
            baseChancePercent,
            casterLevel,
            targetLevel,
            casterIntelligence,
            targetSpirit,
            isLockdown,
            targetRank,
            targetBonusResistancePercent
        );


    return (
        Math.random()*100<
        chance
    );

}


/* =====================================================
   ★ 治療量公式（新增）

   使用者問的是：
   「智力屬性越高，恢復技能的量就越高，
     這個該如何去抓基準？10點智力+1點恢復量嗎？」

   我的判斷：10點智力才+1點恢復量太弱了。
   對照現有的傷害公式，
   智力對「法術攻擊」是 1點智力 = +8點魔攻
   （getBaseStats()與戰鬥數值共用同一換算常數）。
   如果治療只給10點智力+1，
   會變成「點智力去打傷害」跟
   「點智力去治療」的報酬率差距非常懸殊，
   沒有人會想點智力去玩補師路線。

   正式改用 1點智力 = +1.25點治療量，
   抓比魔攻係數(8)低，
   是因為治療技能通常沒有防禦力減免這道關卡
   （治療不會被「防禦力」打折扣），
   如果係數跟攻擊一樣高，
   治療量成長曲線會比傷害還誇張，
   所以刻意抓得比攻擊係數低一些，
   但又比使用者原本猜的0.1（10點才+1）合理很多。

   最終治療量 = 技能基礎治療量 + Math.floor(智力 × 1.25)
   不套用等級差距係數、也不套用防禦力減免，
   因為治療是對己方施放，
   跟「打贏敵人」的邏輯無關，
   單純看施放者自己智力多高。

   舉例：
   治療術基礎治療40點，
   施放者智力34：
   40 + floor(34×1.25) = 40+42 = 82點。
===================================================== */

const HEALING_INT_COEFFICIENT = 1.25;


function calculateHealingAmount(
    baseHealAmount,
    casterIntelligence
){

    return (
        baseHealAmount+
        Math.floor(
            casterIntelligence*
            HEALING_INT_COEFFICIENT
        )
    );

}

/*
   V118：SP治療量正式受智力影響。
   每1點智力 = +0.5點SP治療量。
   注意：這是「可給友方目標的SP治療量」；施放者本人不回復SP。
*/
const SP_HEALING_INT_COEFFICIENT = 0.5;

function calculateSPHealingAmount(baseHealSP,casterIntelligence){
    return (
        baseHealSP+
        Math.floor(
            casterIntelligence*
            SP_HEALING_INT_COEFFICIENT
        )
    );
}


/* =====================================================
   ★ 通用技能施放引擎

   之前每個技能都各自寫一個function
   （rocketAttack/criticalAttack/...），
   技能一多（現在火系就有10個，之後水系還有10個）
   這樣寫不下去，所以改成「資料驅動」：
   skillDatabase裡定義好每個技能的數值，
   全部技能共用同一套施放邏輯。

   目前只有「火」角色會真正上場戰鬥
   （水/風角色還是規格裡的「未來功能」），
   所以這個引擎先服務fire角色，
   之後水角色能上場戰鬥時，這個引擎可以直接沿用。
===================================================== */

function getSkillLevel(characterId,skillId){

    const loadout =
        characterSkillLoadouts[
            characterId
        ];


    if(
        !loadout ||
        !loadout.skillLevels
    ){
        return 0;
    }


    return (
        loadout.skillLevels[
            skillId
        ]||
        0
    );

}


function getSkillDamageAtLevel(skill,level){

    if(
        level<=0 ||
        !skill.baseDamage
    ){
        return 0;
    }


    return (
        skill.baseDamage+
        skill.damagePerLevel*
        (level-1)
    );

}


/*
   依技能的目標型態，算出這次攻擊實際會打到哪些怪物
   （回傳的是monsters陣列的原始index清單）。

   single：只打選定的目標。
   tri / row：命中選定目標所在的固定3人橫排。
   all：命中目前場上全部存活敵人。
   戰鬥最多6隻怪時，前排與後排不會因死亡而重新補位。
*/

function getSkillTargets(centerIndex,targetType){

    const alive=currentBattleMonsters.filter(
        i=>monsters[i] && monsters[i].alive
    );

    if(targetType==="single"){
        return alive.includes(centerIndex) ? [centerIndex] : [];
    }

    /*
       V119：敵方固定每3個「場上位置」為一橫排。
       不能用 alive 陣列重新排位置，否則前排有人死亡後，
       後排會被錯誤補進前排，橫排技能就會跨排命中。
    */
    if(targetType==="tri" || targetType==="row"){
        const formationPosition=currentBattleMonsters.indexOf(centerIndex);
        if(formationPosition<0){ return []; }

        const rowStart=Math.floor(formationPosition/3)*3;
        return currentBattleMonsters
            .slice(rowStart,rowStart+3)
            .filter(i=>monsters[i] && monsters[i].alive);
    }

    if(targetType==="column"){
        const formationPosition=currentBattleMonsters.indexOf(centerIndex);
        if(formationPosition<0){ return []; }
        const column=formationPosition%3;
        return currentBattleMonsters.filter((index,position)=>
            position%3===column&&monsters[index]&&monsters[index].alive
        );
    }

    if(targetType==="all"){
        return alive;
    }

    return alive.includes(centerIndex) ? [centerIndex] : [];
}


/* =====================================================
   Persistent-state identity

   Every lasting effect is identified by its formal state name.  A target
   that already owns an active state with the same name rejects the new
   application before any status-chance roll is made.  The rule is shared by
   skills, monsters and talismans; instant damage/healing is settled by the
   caller before it reaches this helper.
===================================================== */

const PERSISTENT_STATE_NAMES=Object.freeze({
    burn:"燃燒",
    rage:"怒火",
    phoenixMight:"鳳威",
    frostbite:"凍傷",
    freeze:"冰封",
    agilityDown:"重力",
    damageDown:"殤風",
    stun:"暈眩",
    dodgeSkill:"風行",
    dodge:"風行",
    stealthSkill:"隱身",
    dinghaishenzhen:"氣定神閒",
    resistance:"氣定神閒",
    defenseDown:"破防",
    shield:"岩盾",
    petrify:"石化",
    earthShield:"萬象土盾",
    rockWall:"岩石壁壘",
    barrier:"結界"
});

function getPersistentStateName(stateOrType){
    const raw=stateOrType&&typeof stateOrType==="object"
        ?(
            stateOrType.statusName||
            (stateOrType.type==="v141TeamBuff"?stateOrType.v141BuffType:stateOrType.type)||
            stateOrType.v141BuffType||
            ""
        )
        :String(stateOrType||"");
    if(Object.values(PERSISTENT_STATE_NAMES).includes(raw)){ return raw; }
    return PERSISTENT_STATE_NAMES[raw]||raw;
}

function isActivePersistentStateEntry(entry){
    if(!entry){ return false; }
    if(Number(entry.turnsLeft)<=0){ return false; }
    const name=getPersistentStateName(entry);
    if(name==="岩盾"&&Number(entry.remaining)<=0){ return false; }
    if(name==="結界"&&entry.remainingBlocks!==undefined&&Number(entry.remainingBlocks)<=0){ return false; }
    return true;
}

function getPersistentStateEntries(entity){
    if(!entity){ return []; }
    const entries=[];
    if(Array.isArray(entity.statusEffects)){ entries.push(...entity.statusEffects); }
    if(Array.isArray(entity.activeBuffs)){ entries.push(...entity.activeBuffs); }
    if(Array.isArray(entity.v141TeamBuffs)){ entries.push(...entity.v141TeamBuffs); }
    if(entity.v141Shield&&Number(entity.v141Shield.turnsLeft)>0){
        entries.push(Object.assign(
            {type:entity.v141Shield.isBarrier?"barrier":"shield"},
            entity.v141Shield
        ));
    }
    return entries;
}

function hasNamedPersistentState(entity,stateOrType){
    const requestedName=getPersistentStateName(stateOrType);
    if(!requestedName){ return false; }
    return getPersistentStateEntries(entity).some(entry=>
        isActivePersistentStateEntry(entry)&&getPersistentStateName(entry)===requestedName
    );
}

function markPersistentStateName(entry,stateOrType){
    if(entry&&typeof entry==="object"){
        entry.statusName=getPersistentStateName(stateOrType||entry);
    }
    return entry;
}

function reportPersistentStateMiss(entity,stateOrType,targetSide,targetIndex,sourceName){
    const stateName=getPersistentStateName(stateOrType);
    if(typeof showMissEffect==="function"&&Number.isInteger(targetIndex)){
        showMissEffect(targetSide==="player",targetIndex,"狀態MISS");
    }
    if(typeof addBattleLog==="function"){
        const targetName=entity&&(entity.name||entity.id)||"目標";
        addBattleLog(
            (sourceName?sourceName+"：":"")+targetName+"已有【"+stateName+"】，新的【"+stateName+"】MISS。"
        );
    }
    return false;
}

function canApplyNamedPersistentState(entity,stateOrType,targetSide,targetIndex,sourceName){
    return hasNamedPersistentState(entity,stateOrType)
        ?reportPersistentStateMiss(entity,stateOrType,targetSide,targetIndex,sourceName)
        :true;
}

function getMonsterTimedStatusResistanceBonus(monster){
    if(!monster){ return 0; }
    const teamBuff=(monster.v141TeamBuffs||[]).find(buff=>
        buff&&buff.type==="resistance"&&Number(buff.turnsLeft)>0
    );
    if(teamBuff){ return Math.max(0,Number(teamBuff.amount)||0); }
    const directBuff=(monster.activeBuffs||[]).find(buff=>
        buff&&buff.type==="dinghaishenzhen"&&Number(buff.turnsLeft)>0
    );
    return directBuff?Math.max(0,Number(directBuff.resistBonus)||0):0;
}

function rollNamedPersistentStatusEffect(
    entity,
    stateOrType,
    rollArguments,
    targetSide,
    targetIndex,
    sourceName,
    guaranteedHit
){
    if(!canApplyNamedPersistentState(entity,stateOrType,targetSide,targetIndex,sourceName)){
        return {duplicate:true,hit:false};
    }
    const finalRollArguments=(rollArguments||[]).slice();
    if(targetSide==="monster"){
        if(finalRollArguments[5]===undefined){ finalRollArguments[5]=false; }
        if(finalRollArguments[6]===undefined&&typeof getMonsterRank==="function"){
            finalRollArguments[6]=getMonsterRank(entity);
        }
        finalRollArguments[7]=(Number(finalRollArguments[7])||0)+
            getMonsterTimedStatusResistanceBonus(entity);
    }
    return {
        duplicate:false,
        hit:guaranteedHit===true||(
            typeof rollStatusEffectHit==="function"&&
            rollStatusEffectHit.apply(null,finalRollArguments)
        )
    };
}

window.v173PersistentStateNames=PERSISTENT_STATE_NAMES;
window.v173GetPersistentStateName=getPersistentStateName;
window.v173HasNamedPersistentState=hasNamedPersistentState;
window.v173CanApplyNamedPersistentState=canApplyNamedPersistentState;
window.v173MarkPersistentStateName=markPersistentStateName;
window.v173RollNamedPersistentStatusEffect=rollNamedPersistentStatusEffect;
window.v173GetMonsterTimedStatusResistanceBonus=getMonsterTimedStatusResistanceBonus;


/* 燃燒：同名狀態存在時由前置判定直接MISS，不覆蓋或刷新。 */

function applyBurnEffect(monster,duration,percent){

    if(hasNamedPersistentState(monster,"burn")){
        return false;
    }

    if(!monster.statusEffects){

        monster.statusEffects=[];

    }


    monster.statusEffects=monster.statusEffects.filter(effect=>
        !effect||effect.type!=="burn"||Number(effect.turnsLeft)>0
    );

    const burnState=markPersistentStateName({
        type:"burn",
        turnsLeft:duration,
        percent:percent
    },"burn");
    const burnSource=typeof window.v155GetCurrentDamageActor==="function"
        ?window.v155GetCurrentDamageActor()
        :null;
    if(burnSource){
        Object.defineProperty(burnState,"sourceActor",{
            value:burnSource,writable:true,configurable:true,enumerable:false
        });
    }
    monster.statusEffects.push(burnState);

    return true;

}


/*
   ★ 冰封狀態（新增，水系技能用）：
   冰封中的怪物在monsterTurn()裡會被跳過攻擊，
   不會扣血，純粹是控場效果，
   跟燃燒（DoT）是不同機制。
*/

function applyFreezeEffect(monster,duration){

    if(hasNamedPersistentState(monster,"freeze")){
        return false;
    }

    if(!monster.statusEffects){

        monster.statusEffects=[];

    }


    monster.statusEffects=monster.statusEffects.filter(effect=>
        !effect||effect.type!=="freeze"||Number(effect.turnsLeft)>0
    );

    const deferredForPlayer=
        typeof getPartyCharacterIndex==="function"&&getPartyCharacterIndex(monster)>=0;

    const freezeState={type:"freeze",turnsLeft:duration};
    if(deferredForPlayer){ freezeState.deferFirstTick=true; }
    monster.statusEffects.push(markPersistentStateName(freezeState,"freeze"));

    return true;

}


function isMonsterFrozen(monster){

    return !!(
        monster.statusEffects &&
        monster.statusEffects.some(
            effect=>
                effect.type==="freeze"&&
                effect.turnsLeft>0
        )
    );

}


/*
   ★ 新增（依照使用者要求，接上風系/土系
   技能的減益效果）：
   跟applyFreezeEffect()/applyBurnEffect()
   同一套架構，通用版本，一次處理agilityDown
   （降敏捷）、statDown（降全屬性）、
   defenseDown（降防禦）、damageDown（降低造成傷害）、
   stun（提高MISS率）、petrify（石化，無法行動）這六種怪物身上
   的減益效果。同名狀態存在時一律MISS，
   不疊加、不覆蓋、不刷新持續時間。

   value的意義依type而不同：
   agilityDown/statDown/defenseDown/damageDown/stun
   →百分比數字（例如50代表降低50%）
   petrify→不需要value，純粹看有沒有這個
   type、turnsLeft>0
*/

function applyMonsterDebuff(
    monster,
    type,
    duration,
    value,
    extraFields
){

    if(hasNamedPersistentState(monster,type)){
        return false;
    }

    if(!monster.statusEffects){

        monster.statusEffects=[];

    }


    monster.statusEffects=monster.statusEffects.filter(effect=>
        !effect||effect.type!==type||Number(effect.turnsLeft)>0
    );

    const deferredForPlayer=
        typeof getPartyCharacterIndex==="function"&&getPartyCharacterIndex(monster)>=0;

    const state=Object.assign(
        {type:type,turnsLeft:duration,value:value},
        extraFields||{}
    );
    if(deferredForPlayer){ state.deferFirstTick=true; }
    monster.statusEffects.push(markPersistentStateName(state,type));

    return true;

}


/*
   ★ 通用版本：讀取怪物身上某個減益效果目前
   的數值（沒有這個效果的話回傳0），
   getMonsterAgility()/getMonsterAccuracy()/
   getMonsterEffectiveDefense()都會呼叫這裡。
*/

function getMonsterDebuffValue(
    monster,
    type
){

    if(!monster.statusEffects){
        return 0;
    }


    const effect=

        monster.statusEffects.find(
            e=>

                e.type===type &&
                e.turnsLeft>0

        );


    return (
        effect
        ?
        (effect.value||0)
        :
        0
    );

}


/*
   V120：風焰術／風哮電擊的「傷害降低」正式共用同一個輸出傷害入口。
   damageDown 的 value 是百分比，例如30代表最終造成傷害降低30%。
   只影響角色／怪物主動造成的直接攻擊與技能傷害；
   不改燃燒這類依目標最大HP計算的持續傷害，也不改反傷。
*/
function getOutgoingDamageDownPercent(attacker){
    return Math.max(
        0,
        Math.min(
            100,
            getMonsterDebuffValue(attacker,"damageDown")
        )
    );
}

function applyOutgoingDamageReduction(damage,attacker){
    const numericDamage=Number(damage)||0;
    if(numericDamage<=0){
        return 0;
    }

    const downPercent=getOutgoingDamageDownPercent(attacker);
    if(downPercent<=0){
        return Math.floor(numericDamage);
    }

    return Math.max(
        1,
        Math.floor(
            numericDamage*(1-downPercent/100)
        )
    );
}


function getMonsterDebuffEntry(target,type){
    if(!target || !target.statusEffects){
        return null;
    }
    return target.statusEffects.find(
        e=>e.type===type && e.turnsLeft>0
    )||null;
}

function getStatDownPercentFor(target,statName){
    const effect=getMonsterDebuffEntry(target,"statDown");
    if(!effect){
        return 0;
    }
    if(Array.isArray(effect.excludedStats) && effect.excludedStats.includes(statName)){
        return 0;
    }
    return Number(effect.value)||0;
}


function isMonsterPetrified(monster){

    return !!(
        monster.statusEffects &&
        monster.statusEffects.some(
            effect=>
                effect.type==="petrify"&&
                effect.turnsLeft>0
        )
    );

}


/*
   ★ 怪物「有效防禦力」——原始defense扣掉
   defenseDown這個減益效果的百分比。
   土系的土石斬/投石術/沙塵風暴都是用這個
   降低怪物防禦，玩家對這隻怪物造成的
   傷害計算，全部改讀這個函式，不要直接讀
   monster.defense。
*/

function getMonsterEffectiveAbilityPoints(monster,statName){
    if(!monster){ return 0; }

    const fieldMap={
        attack:"attackPoints",
        vitality:"vitalityPoints",
        energy:"energyPoints",
        intelligence:"intelligencePoints",
        spirit:"spiritPoints",
        agility:"agilityPoints"
    };

    const field=fieldMap[statName];
    const base=field ? (Number(monster[field])||0) : 0;
    const down=getStatDownPercentFor(monster,statName);
    return Math.max(0,base*(1-down/100));
}

function getMonsterEffectiveSpiritPoints(monster){
    return getMonsterEffectiveAbilityPoints(monster,"spirit");
}

function getMonsterEffectiveAntiCrit(monster){
    return calculateAntiCritPercent(
        getMonsterEffectiveSpiritPoints(monster)
    );
}

function getMonsterEffectiveDefense(monster){

    const downPercent=
        getMonsterDebuffValue(
            monster,
            "defenseDown"
        );

    const statDownPercent=
        getStatDownPercentFor(
            monster,
            "vitality"
        );

    return Math.max(
        0,
        Math.round(
            monster.defense*
            (1-downPercent/100)*
            (1-statDownPercent/100)
        )
    );

}


/*
   ★ 新增（依照使用者要求，接上風系/土系
   技能的附加效果）：
   通用版本，跟燃燒/冰封判定共用同一套
   rollStatusEffectHit()機率公式，一次檢查
   技能資料裡可能存在的五種附加效果標記：
   agilityDownChance/agilityDownByLevel
   （降敏捷）、statDownChance/statDownByLevel
   （降全屬性）、defenseDownChance/
   defenseDownByLevel（降防禦）、damageDownChance/
   damageDownByLevel（降低造成傷害）、stunChance/
   missBonusByLevel（暈眩＝提高MISS率）、
   petrifyChanceByLevel（石化）。

   技能沒有對應欄位就自動跳過那一種效果，
   一個技能可以同時掛好幾種效果（雖然目前
   風系/土系技能表設計上每個技能都只有一種）。

   castDamageSkill()／processSingleMonsterAttack()
   在命中判定通過、傷害結算完之後呼叫這裡，
   跟燃燒/冰封的呼叫時機點一致。
*/

function applySkillDebuffEffects(
    skill,
    level,
    monster,
    index,
    casterLevel,
    casterIntelligence
){

    if(!monster||!monster.alive){
        return;
    }


    if(
        skill.agilityDownChance &&
        skill.agilityDownByLevel
    ){

        const hit=rollNamedPersistentStatusEffect(
            monster,"agilityDown",[
                skill.agilityDownChance,casterLevel,monster.level,
                casterIntelligence,getMonsterEffectiveSpiritPoints(monster)
            ],"monster",index,skill.name
        ).hit;


        if(hit){

            applyMonsterDebuff(
                monster,
                "agilityDown",
                skill.agilityDownDuration||2,
                skill.agilityDownByLevel[
                    level-1
                ]
            );


            addBattleLog(
                ""+
                monster.name+
                "的敏捷降低了！"
            );

        }

    }


    if(
        skill.statDownChance &&
        skill.statDownByLevel
    ){

        const hit=rollNamedPersistentStatusEffect(
            monster,"statDown",[
                skill.statDownChance,casterLevel,monster.level,
                casterIntelligence,getMonsterEffectiveSpiritPoints(monster)
            ],"monster",index,skill.name
        ).hit;


        if(hit){

            applyMonsterDebuff(
                monster,
                "statDown",
                skill.statDownDuration||2,
                skill.statDownByLevel[
                    level-1
                ],
                {excludedStats:(skill.statDownExclude||[]).slice()}
            );


            addBattleLog(
                ""+
                monster.name+
                "的全屬性降低了！"
            );

        }

    }


    if(
        skill.damageDownChance &&
        skill.damageDownByLevel
    ){

        const hit=rollNamedPersistentStatusEffect(
            monster,"damageDown",[
                skill.damageDownChance,casterLevel,monster.level,
                casterIntelligence,getMonsterEffectiveSpiritPoints(monster)
            ],"monster",index,skill.name
        ).hit;


        if(hit){

            applyMonsterDebuff(
                monster,
                "damageDown",
                skill.damageDownDuration||1,
                skill.damageDownByLevel[
                    level-1
                ]
            );


            addBattleLog(
                ""+
                monster.name+
                "造成的傷害降低了！"
            );

        }

    }


    if(
        skill.defenseDownChance &&
        skill.defenseDownByLevel
    ){

        const hit=rollNamedPersistentStatusEffect(
            monster,"defenseDown",[
                skill.defenseDownChance,casterLevel,monster.level,
                casterIntelligence,getMonsterEffectiveSpiritPoints(monster)
            ],"monster",index,skill.name
        ).hit;


        if(hit){

            applyMonsterDebuff(
                monster,
                "defenseDown",
                skill.defenseDownDuration||2,
                skill.defenseDownByLevel[
                    level-1
                ]
            );


            addBattleLog(
                ""+
                monster.name+
                "的防禦降低了！"
            );

        }

    }


    if(
        skill.stunChance &&
        skill.missBonusByLevel
    ){

        const hit=rollNamedPersistentStatusEffect(
            monster,"stun",[
                skill.stunChance,casterLevel,monster.level,
                casterIntelligence,getMonsterEffectiveSpiritPoints(monster)
            ],"monster",index,skill.name
        ).hit;


        if(hit){

            applyMonsterDebuff(
                monster,
                "stun",
                skill.stunDuration||2,
                skill.missBonusByLevel[
                    level-1
                ]
            );


            addBattleLog(
                ""+
                monster.name+
                "陷入暈眩，MISS率提高！"
            );

        }

    }


    if(
        skill.petrifyChanceByLevel
    ){

        const chance=
            skill.petrifyChanceByLevel[
                level-1
            ];


        const hit=rollNamedPersistentStatusEffect(
            monster,"petrify",[
                chance,casterLevel,monster.level,casterIntelligence,
                getMonsterEffectiveSpiritPoints(monster),true,getMonsterRank(monster)
            ],"monster",index,skill.name
        ).hit;


        if(hit){

            applyMonsterDebuff(
                monster,
                "petrify",
                skill.petrifyDuration||2,
                0
            );


            addBattleLog(
                ""+
                monster.name+
                "被石化了！"
            );

        }

    }

}


/*
   ★ 新增（依照使用者要求，「野怪異常
   狀態直接做，我給你分級」）：
   跟上面applySkillDebuffEffects()是鏡像
   版本，差別只在目標從monster換成玩家
   角色（targetCharacter）——怪物放技能
   打玩家時，技能本身附帶的異常效果
   （降敏捷/降全屬性/降防禦/暈眩/石化）
   現在也會真的套用在玩家身上，不再只有
   傷害數字。

   套用的共用函式（applyMonsterDebuff()／
   isMonsterFrozen()／isMonsterPetrified()）
   雖然名字裡有Monster，但本來就只操作
   傳進去的物件本身，玩家角色物件一樣能
   直接沿用（前提是玩家物件要有
   statusEffects陣列，已經在player/player2
   的初始資料跟開戰重置那裡補上了）。

   ★ 關於鎖定類效果（冰封/石化）用哪組
   上下限：目前的LOCKDOWN_HIT_BOUNDS三級
   （普通/精英/BOSS）設計上是給「玩家
   打怪物」這個方向用的，用來衡量「這隻
   怪物多難鎖」。這裡反過來是「怪物打
   玩家」，玩家沒有稀有度可言，這裡先固定
   用"regular"（上限80%）——
   這是我先抓的預設，如果你覺得玩家被
   鎖定的上限應該跟野怪不一樣（例如更難
   被鎖，畢竟是玩家角色），跟我說一聲，
   加一組專門的玩家上下限即可。
*/

/*
   V118：怪物對玩家施放異常狀態時，必須使用「最終精神」。
   也就是角色原始精神 + 裝備精神，而不是只讀 character.spirit。
   這樣裝備面板顯示的精神、異常抗性，與實戰完全一致。
*/
function getFinalBattleSpiritForPlayerTarget(targetCharacter,targetIndex){
    const index=getPartyCharacterIndex(targetCharacter)>=0
        ? getPartyCharacterIndex(targetCharacter)
        : targetIndex;
    const stats=getPartyBattleStats(index);
    return stats ? stats.spirit : (Number(targetCharacter&&targetCharacter.spirit)||0);
}


function applySkillDebuffEffectsToPlayer(
    skill,
    level,
    targetCharacter,
    targetIndex,
    casterLevel,
    casterIntelligence
){

    if(
        !targetCharacter||
        targetCharacter.hp<=0
    ){
        return;
    }


    const targetName=
        targetCharacter.id||
        "你";

    const targetFinalSpirit=
        getFinalBattleSpiritForPlayerTarget(
            targetCharacter,
            targetIndex
        );


    if(
        skill.agilityDownChance &&
        skill.agilityDownByLevel
    ){

        const hit=rollNamedPersistentStatusEffect(
            targetCharacter,"agilityDown",[
                skill.agilityDownChance,casterLevel,targetCharacter.level,
                casterIntelligence,targetFinalSpirit,false,"regular",
                getPlayerStatusResistBonus(targetCharacter)
            ],"player",targetIndex,skill.name
        ).hit;


        if(hit){

            applyMonsterDebuff(
                targetCharacter,
                "agilityDown",
                skill.agilityDownDuration||2,
                skill.agilityDownByLevel[
                    level-1
                ]
            );


            addBattleLog(
                targetName+
                "的敏捷降低了！"
            );

        }

    }


    if(
        skill.statDownChance &&
        skill.statDownByLevel
    ){

        const hit=rollNamedPersistentStatusEffect(
            targetCharacter,"statDown",[
                skill.statDownChance,casterLevel,targetCharacter.level,
                casterIntelligence,targetFinalSpirit,false,"regular",
                getPlayerStatusResistBonus(targetCharacter)
            ],"player",targetIndex,skill.name
        ).hit;


        if(hit){

            applyMonsterDebuff(
                targetCharacter,
                "statDown",
                skill.statDownDuration||2,
                skill.statDownByLevel[
                    level-1
                ],
                {excludedStats:(skill.statDownExclude||[]).slice()}
            );


            addBattleLog(
                targetName+
                "的全屬性降低了！"
            );

        }

    }


    if(
        skill.damageDownChance &&
        skill.damageDownByLevel
    ){

        const hit=rollNamedPersistentStatusEffect(
            targetCharacter,"damageDown",[
                skill.damageDownChance,casterLevel,targetCharacter.level,
                casterIntelligence,targetFinalSpirit,false,"regular",
                getPlayerStatusResistBonus(targetCharacter)
            ],"player",targetIndex,skill.name
        ).hit;


        if(hit){

            applyMonsterDebuff(
                targetCharacter,
                "damageDown",
                skill.damageDownDuration||1,
                skill.damageDownByLevel[
                    level-1
                ]
            );


            addBattleLog(
                targetName+
                "造成的傷害降低了！"
            );

        }

    }


    if(
        skill.defenseDownChance &&
        skill.defenseDownByLevel
    ){

        const hit=rollNamedPersistentStatusEffect(
            targetCharacter,"defenseDown",[
                skill.defenseDownChance,casterLevel,targetCharacter.level,
                casterIntelligence,targetFinalSpirit,false,"regular",
                getPlayerStatusResistBonus(targetCharacter)
            ],"player",targetIndex,skill.name
        ).hit;


        if(hit){

            applyMonsterDebuff(
                targetCharacter,
                "defenseDown",
                skill.defenseDownDuration||2,
                skill.defenseDownByLevel[
                    level-1
                ]
            );


            addBattleLog(
                targetName+
                "的防禦降低了！"
            );

        }

    }


    if(
        skill.stunChance &&
        skill.missBonusByLevel
    ){

        const hit=rollNamedPersistentStatusEffect(
            targetCharacter,"stun",[
                skill.stunChance,casterLevel,targetCharacter.level,
                casterIntelligence,targetFinalSpirit,false,"regular",
                getPlayerStatusResistBonus(targetCharacter)
            ],"player",targetIndex,skill.name
        ).hit;


        if(hit){

            applyMonsterDebuff(
                targetCharacter,
                "stun",
                skill.stunDuration||2,
                skill.missBonusByLevel[
                    level-1
                ]
            );


            addBattleLog(
                targetName+
                "陷入暈眩，MISS率提高！"
            );

        }

    }


    if(skill.freezeChance){

        const hit=rollNamedPersistentStatusEffect(
            targetCharacter,"freeze",[
                skill.freezeChance,casterLevel,targetCharacter.level,
                casterIntelligence,targetFinalSpirit,true,"regular",
                getPlayerStatusResistBonus(targetCharacter)
            ],"player",targetIndex,skill.name
        ).hit;

        if(hit){
            applyFreezeEffect(
                targetCharacter,
                skill.freezeDuration||1
            );

            addBattleLog(
                targetName+"被冰封了！"
            );
        }

    }


    if(
        skill.petrifyChanceByLevel
    ){

        const chance=
            skill.petrifyChanceByLevel[
                level-1
            ];


        const hit=rollNamedPersistentStatusEffect(
            targetCharacter,"petrify",[
                chance,casterLevel,targetCharacter.level,casterIntelligence,
                targetFinalSpirit,true,"regular",getPlayerStatusResistBonus(targetCharacter)
            ],"player",targetIndex,skill.name
        ).hit;


        if(hit){

            applyMonsterDebuff(
                targetCharacter,
                "petrify",
                skill.petrifyDuration||2,
                0
            );


            addBattleLog(
                targetName+
                "被石化了！"
            );

        }

    }


    /*
       ★ 新增：燃燒（flameTornado／
       phoenixCry這類技能帶的效果）跟其他
       五種debuff是分開存的欄位
       （burnChance／burnPercentByLevel），
       跟player那邊castDamageSkill()裡
       套用燃燒的邏輯對稱，用applyBurnEffect()
       （本來就是通用函式，直接沿用）。
    */

    if(
        skill.burnChance &&
        skill.burnPercentByLevel
    ){

        const burnHit=rollNamedPersistentStatusEffect(
            targetCharacter,"burn",[
                skill.burnChance,casterLevel,targetCharacter.level,
                casterIntelligence,targetFinalSpirit,false,"regular",
                getPlayerStatusResistBonus(targetCharacter)
            ],"player",targetIndex,skill.name,skill.guaranteedBurn===true
        ).hit;


        if(burnHit){

            const burnPercent=
                skill.burnPercentByLevel[
                    level-1
                ];


            applyBurnEffect(
                targetCharacter,
                skill.burnDuration,
                burnPercent
            );


            addBattleLog(
                targetName+
                "陷入燃燒狀態！"
            );

        }

    }

}


/*
   每回合開始時呼叫，處理所有燃燒中怪物的持續傷害。
   燃燒傷害不會被閃避、不會被防禦力減免，
   單純按最大HP的百分比扣血。
*/

function tickStatusEffects(){

    if(!battleActive){
        return;
    }


    /*
       ★ 修正（依照使用者要求，接上風系/土系
       的新減益效果）：
       原本這裡的filter邏輯只認得"freeze"
       跟"burn"兩種類型，其他類型一律直接
       return true（永遠保留、不會倒數），
       這代表如果不補上處理，這次新增的
       agilityDown/statDown/defenseDown/damageDown/stun/
       petrify這六種效果一旦套用上去，會
       永遠卡在怪物身上、持續回合數完全不會
       減少，變成永久減益，不是原本設計的
       「持續N回合」。

       這裡補上：petrify比照freeze（純粹
       倒數、不扣血，真正跳過攻擊的判斷在
       monsterTurn()），agilityDown/
       statDown/defenseDown/damageDown/stun這五種都是
       單純的「倒數回合數、時間到了移除」，
       用DEBUFF_LABELS這個對照表統一處理，
       不用四個類型各寫一次幾乎一樣的程式碼。
    */

    const simpleDebuffLabels={

        agilityDown:"重力",
        statDown:"全屬性降低",
        damageDown:"殤風",
        defenseDown:"破防",
        stun:"暈眩"

    };


    currentBattleMonsters.forEach(
        index=>{

            const monster =
                monsters[index];


            if(
                !monster ||
                !monster.alive ||
                !monster.statusEffects ||
                monster.statusEffects.length===0
            ){
                return;
            }


            monster.statusEffects =
                monster.statusEffects.filter(
                    effect=>{

                        if(
                            effect.type==="freeze"||
                            effect.type==="petrify"
                        ){

                            /*
                               冰封/石化本身不扣血，
                               這裡只負責倒數回合數，
                               真正「跳過攻擊」的判斷
                               在monsterTurn()裡處理。
                            */

                            effect.turnsLeft--;


                            if(
                                effect.turnsLeft<=0
                            ){

                                addBattleLog(
                                    (
                                        effect.type==="freeze"
                                        ?
                                        ""
                                        :
                                        ""
                                    )+
                                    monster.name+
                                    "的"+
                                    (
                                        effect.type==="freeze"
                                        ?
                                        "冰封"
                                        :
                                        "石化"
                                    )+
                                    "效果已解除。"
                                );

                            }


                            return (
                                effect.turnsLeft>0
                            );

                        }


                        if(
                            simpleDebuffLabels[
                                effect.type
                            ]
                        ){

                            effect.turnsLeft--;


                            if(
                                effect.turnsLeft<=0
                            ){

                                addBattleLog(

                                    simpleDebuffLabels[
                                        effect.type
                                    ]+
                                    "效果已從"+
                                    monster.name+
                                    "身上解除。"

                                );

                            }


                            return (
                                effect.turnsLeft>0
                            );

                        }


                        if(
                            effect.type!=="burn"
                        ){
                            return true;
                        }


                        const burnMultiplier=effect.sourceActor&&
                            typeof window.v155GetPhoenixMightMultiplier==="function"
                            ?window.v155GetPhoenixMightMultiplier(effect.sourceActor)
                            :1;
                        const burnDamage =
                            Math.max(
                                1,
                                Math.floor(
                                    monster.maxHP*
                                    effect.percent/
                                    100*
                                    burnMultiplier
                                )
                            );


                        const directShield=monster.v141Shield;
                        if(directShield&&!directShield.isBarrier){
                            const remaining=Math.max(0,Number(directShield.remaining)||0);
                            const baseHp=Math.max(0,(Number(monster.hp)||0)-remaining);
                            directShield.baseHp=Math.max(0,baseHp-burnDamage);
                            monster.hp=directShield.baseHp+remaining;
                        }else{
                            monster.hp=Math.max(0,monster.hp-burnDamage);
                        }


                        showMonsterHit(
                            index,
                            burnDamage,
                            "hp"
                        );


                        addBattleLog(
                            ""+
                            monster.name+
                            "受到燃燒傷害"+
                            burnDamage+
                            "點。"
                        );


                        const hpAfterDot=monster.v141Shield
                            ?Math.max(
                                0,
                                Number.isFinite(Number(monster.v141Shield.baseHp))
                                    ?Number(monster.v141Shield.baseHp)
                                    :(Number(monster.hp)||0)-(Number(monster.v141Shield.remaining)||0)
                            )
                            :monster.hp;

                        if(hpAfterDot<=0){

                            monster.hp=0;

                            killMonster(
                                index
                            );

                        }


                        effect.turnsLeft--;


                        return (
                            effect.turnsLeft>0 &&
                            monster.hp>0
                        );

                    }
                );

        }
    );


    /*
       ★ 新增（依照使用者要求，「野怪異常
       狀態直接做」——怪物現在真的能對玩家
       附加負面效果了，這些效果也要跟怪物
       身上的一樣，每回合正確倒數/扣血，
       不然套用了卻永遠不會消失、燃燒也
       不會真的扣血）：
       跟上面處理怪物的邏輯幾乎一樣，只是
       目標換成player／player2，扣血用
       showPlayerHit()（跟怪物的
       showMonsterHit()對應），死亡判斷
       交給battle主流程既有的checkBattleEnd()
       （這裡只負責把hp扣到0，不主動呼叫
       loseBattle()，避免跟主流程重複觸發）。
    */

    getExistingPartyIndexes().map(index=>({
        character:getPartyCharacterByIndex(index),
        index:index
    })).forEach(
        entry=>{

            const character=
                entry.character;

            const charIndex=
                entry.index;


            if(
                !character ||
                character.hp<=0 ||
                !character.statusEffects ||
                character.statusEffects.length===0
            ){
                return;
            }


            character.statusEffects=
                character.statusEffects.filter(
                    effect=>{

                        if(
                            effect.type==="freeze"||
                            effect.type==="petrify"
                        ){

                            if(effect.deferFirstTick){
                                effect.deferFirstTick=false;
                                return true;
                            }

                            effect.turnsLeft--;


                            if(effect.turnsLeft<=0){

                                addBattleLog(
                                    (character.id||"你")+
                                    "的"+
                                    (
                                        effect.type==="freeze"
                                        ?
                                        "冰封"
                                        :
                                        "石化"
                                    )+
                                    "效果已解除。"
                                );

                            }


                            return (
                                effect.turnsLeft>0
                            );

                        }


                        if(
                            simpleDebuffLabels[
                                effect.type
                            ]
                        ){

                            if(effect.deferFirstTick){
                                effect.deferFirstTick=false;
                                return true;
                            }

                            effect.turnsLeft--;


                            if(effect.turnsLeft<=0){

                                addBattleLog(
                                    simpleDebuffLabels[
                                        effect.type
                                    ]+
                                    "效果已從"+
                                    (character.id||"你")+
                                    "身上解除。"
                                );

                            }


                            return (
                                effect.turnsLeft>0
                            );

                        }


                        if(effect.type!=="burn"){
                            return true;
                        }


                        const targetStats=
                            getPartyBattleStats(charIndex);


                        const burnMultiplier=effect.sourceActor&&
                            typeof window.v155GetPhoenixMightMultiplier==="function"
                            ?window.v155GetPhoenixMightMultiplier(effect.sourceActor)
                            :1;
                        const burnDamage=
                            Math.max(
                                1,
                                Math.floor(
                                    targetStats.maxHP*
                                    effect.percent/
                                    100*
                                    burnMultiplier
                                )
                            );


                        if(burnDamage>0){
                            character.hp=
                                Math.max(
                                    0,
                                    character.hp-
                                    burnDamage
                                );

                            showPlayerHit(
                                burnDamage,
                                "hp",
                                charIndex
                            );

                            addBattleLog(
                                (character.id||"你")+
                                "受到燃燒傷害"+
                                burnDamage+
                                "點。"
                            );
                        }


                        effect.turnsLeft--;


                        return (
                            effect.turnsLeft>0 &&
                            character.hp>0
                        );

                    }
                );

        }
    );


    updateUI();

}


/*
   爆擊判定。
   沒有buff時有基礎10%爆擊率、1.5倍傷害；
   怒火生效時爆擊率跟爆擊傷害都會提高
   （提高的%數就是怒火技能等級對應的數字）。
*/

/*
   V118 — 正式能力規則：
   物理爆擊由「攻擊」決定；法術爆擊由「智力」決定。
   兩者使用完全相同的成長公式：
   - 爆擊率：基礎10% + 每點對應屬性0.12%，上限35%
   - 爆擊倍率：基礎1.5倍 + 每點對應屬性0.25%，上限2倍

   對應屬性：
   - physical / 普通攻擊 => attack
   - magic              => intelligence

   治療技能不走這個爆擊函式，因此不會因智力新增治療爆擊。
*/

const CRIT_CHANCE_BASE = 10;

const CRIT_CHANCE_PER_ATTACK_POINT = 0.12;
const CRIT_CHANCE_PER_INTELLIGENCE_POINT = 0.12;

const CRIT_CHANCE_MAX = 35;

const CRIT_MULTIPLIER_BASE = 1.5;

const CRIT_MULTIPLIER_PER_ATTACK_POINT = 0.0025;
const CRIT_MULTIPLIER_PER_INTELLIGENCE_POINT = 0.0025;

const CRIT_MULTIPLIER_ATTRIBUTE_MAX = 2;
const CRIT_MULTIPLIER_MAX = 2.25;

/*
   V118 — 精神正式加入抗暴：
   每1點精神 = +0.1%抗暴，抗暴上限25%。
   抗暴直接從攻擊方算出的爆擊率扣除，
   但最終爆擊率最低仍保留5%。
*/
function calculateAntiCritPercent(spiritPoints){
    return Math.min(
        ANTI_CRIT_MAX_PERCENT,
        Math.max(0,Number(spiritPoints)||0)*ANTI_CRIT_PER_SPIRIT_POINT
    );
}

function getCriticalStatPoints(character,category){
    const partyIndex=getPartyCharacterIndex(character);
    const partyStats=partyIndex>=0
        ? getPartyBattleStats(partyIndex)
        : null;

    if(category==="magic"){
        if(partyStats){ return partyStats.intelligence||0; }
        return (character&&character.intelligence)||0;
    }

    if(partyStats){ return partyStats.attackPoints||partyStats.attack||0; }

    return (character&&character.attack)||0;
}

function getCharacterSkillKey(character){
    if(character===player){ return "fire"; }
    if(character===player2){ return "player2"; }
    if(typeof player3!=="undefined" && character===player3){ return "player3"; }
    return null;
}

function getLearnedElementEX(character,element){
    const key=getCharacterSkillKey(character);
    if(!key){ return null; }
    const exId=element+"EX";
    const ex=skillDatabase[exId];
    if(!ex || getSkillLevel(key,exId)<=0){ return null; }
    return ex;
}

function getElementDamagePassiveMultiplier(character){
    if(!character || !character.element){ return 1; }
    const ex=getLearnedElementEX(character,character.element);
    return ex && ex.damageBonusPercent
        ? 1+ex.damageBonusPercent/100
        : 1;
}

function rollCritical(character,category="physical",targetAntiCritPercent=0){

    const isMagic=
        category==="magic";

    const critStatPoints=
        getCriticalStatPoints(
            character,
            category
        );

    const chancePerPoint=
        isMagic
        ?
        CRIT_CHANCE_PER_INTELLIGENCE_POINT
        :
        CRIT_CHANCE_PER_ATTACK_POINT;

    const multiplierPerPoint=
        isMagic
        ?
        CRIT_MULTIPLIER_PER_INTELLIGENCE_POINT
        :
        CRIT_MULTIPLIER_PER_ATTACK_POINT;


    const rageBuff=

        (
            (character&&character.activeBuffs)||
            []
        )
        .find(
            b=>b.type==="rage"
        );


    let critChance=

        Math.min(
            CRIT_CHANCE_MAX,
            CRIT_CHANCE_BASE+
            critStatPoints*
            chancePerPoint
        );

    let critMultiplier=

        Math.min(
            CRIT_MULTIPLIER_ATTRIBUTE_MAX,
            CRIT_MULTIPLIER_BASE+
            critStatPoints*
            multiplierPerPoint
        );


    /* 火元素EX：屬性公式本身仍受35%/200%上限，
       EX屬於被動額外加成，所以在基礎上限之後再疊加。 */
    if(character && character.element==="fire"){
        const fireEX=getLearnedElementEX(character,"fire");
        if(fireEX){
            critChance+=Number(fireEX.critChanceBonusPercent)||0;
            critMultiplier+=(Number(fireEX.critDamageBonusPercent)||0)/100;
        }
    }


    if(rageBuff){

        critChance+=
            rageBuff.bonusPercent;

        critMultiplier+=
            rageBuff.bonusPercent/
            100;

    }

    const effectiveAntiCrit=
        Math.min(
            ANTI_CRIT_MAX_PERCENT,
            Math.max(0,Number(targetAntiCritPercent)||0)
        );

    critChance=
        Math.max(
            CRIT_CHANCE_MIN_AFTER_ANTI_CRIT,
            critChance-effectiveAntiCrit
        );


    const isCrit =
        Math.random()*100<
        critChance;

    critMultiplier=Math.min(CRIT_MULTIPLIER_MAX,critMultiplier);


    return {
        isCrit:isCrit,
        multiplier:
            isCrit
            ?
            critMultiplier
            :
            1
    };

}


/*
   通用傷害技能施放函式。
   物理系技能用stats.attack當加成，
   法術系技能用stats.magicAttack當加成，
   跟原本calculateSkillDamage()的設計一致。
*/

function castDamageSkill(skillId){

    const skill =
        skillDatabase[skillId];


    if(
        !battleActive ||
        !skill
    ){
        return;
    }


    const level =
        getSkillLevel(
            "fire",
            skillId
        );


    if(level<=0){

        /*
           ★ 修正（同一輪徹底檢查抓到的同類bug）：
           跟SP不足那個分支一樣，印完訊息就
           return，沒呼叫finishPlayerAction()，
           一樣會讓整條結算鏈卡死。理論上UI會先
           擋掉沒學會的技能讓玩家點不到，但防呆
           分支本來就該假設「萬一真的被觸發」，
           不能讓一次意外觸發就讓整場戰鬥停擺。
        */

        addBattleLog(
            "尚未學習"+
            skill.name+
            "。"
        );

        finishPlayerAction();

        return;

    }


    if(player.sp<skill.spCost){

        if(autoBattle){

            addBattleLog(
                "SP不足，改用普通攻擊。"
            );

            normalAttack();

        }
        else{

            /*
               ★ 修正（真的抓到了，感謝另一個對話
               先加的除錯訊息幫忙鎖定範圍）：
               這裡是「手動模式、SP不夠施放這個
               技能」的分支，原本只印一句
               ❌訊息就直接return，完全沒有呼叫
               finishPlayerAction()。

               一旦這個分支被觸發（例如：技能選單
               顯示的SP是宣告當下的數值，但這個
               角色實際輪到結算階段執行時，
               autoBattle剛好被使用者切換過狀態，
               或SP判定的當下不在自動模式），
               結算階段的推進鏈就會在這一步
               整個停住——不只這個角色不會再行動，
               後面所有還沒輪到的角色、怪物
               都會跟著卡住不動，因為
               processNextCombatant()再也沒有
               被呼叫過。

               這正是「兩隻人物卡著不攻擊」的
               真正原因：一旦卡住，會卡住的不只
               觸發的那個角色，是整條結算鏈從那
               一刻開始完全停止推進。

               按「停止」再按「啟動」能暫時恢復，
               不是因為問題自己好了，是因為
               toggleAutoBattle()裡有一段
               「重新開啟時強制呼叫一次
               autoAction()」的邏輯，等於從外部
               硬把新的宣告/結算鏈踢動起來，
               蓋掉了原本卡死的那條鏈——
               治標，沒有治本。

               補上finishPlayerAction()，讓這個
               分支跟其他所有「行動提前結束」的
               分支一致，行動一定會正常收尾、
               結算鏈不會再中斷。
            */

            addBattleLog(
                "SP不足，無法使用"+
                skill.name+
                "。"
            );

            finishPlayerAction();

        }

        return;

    }


    const centerIndex =
        resolveAttackTargetIndex();


    if(centerIndex===null){
        return;
    }

    const targets =
        getSkillTargets(
            centerIndex,
            skill.targetType
        );


    player.sp -=
        skill.spCost;


    lungePlayerCard();


    showSkillNameBadge(
        skill.name,
        skill.element,
        0,
        skill.targetType==="all"?null:centerIndex,
        targets
    );


    setTimeout(()=>{
        showPlayerSpPopup(
            skill.spCost
        );
    },500);


    const stats =
        getMainCharacterStats();


    const statBonus =
        skill.category==="magic"
        ?
        stats.magicAttack
        :
        stats.attack;



    /*
       ★ 新增（依照使用者要求，火箭技能
       專屬的三連發飛行特效）：
       只在放的是火箭（fireRocket）時觸發，
       其他技能不受影響。用targets這份
       「這次技能實際會打中誰」的清單，
       確保射出的火箭數量、方向都跟真正
       結算的目標一致，不會出現「畫面射了
       三發、但其實只打中一隻」這種對不上
       的情況。
    */

    if(skillId==="fireRocket"){

        playFireRocketAnimation(
            "battlePlayerCard0",
            targets.map(
                index=>"battleMonster"+index
            )
        );

    }


    let totalLifestealDamage=0;


    targets.forEach(index=>{

        const monster =
            monsters[index];


        if(
            !monster ||
            !monster.alive
        ){
            return;
        }


        /*
           ★ 新增（依照使用者要求）：
           冰旋一閃專屬的飛行動畫，放在存活
           判斷之後、命中判定之前——不管這次
           攻擊最後有沒有打中，圖示都會先飛
           過去（代表「這一擊真的出招了」），
           MISS或造成傷害的效果照舊接在後面，
           兩件事互不影響。
        */

        if(skill.id==="iceSpin"){

            playIceSpinProjectile(
                0,
                index
            );

        }


        /*
           ★ 純控場技能（冰封，沒有baseDamage）：
           不算傷害、不做命中/閃避判定，
           直接用異常狀態命中公式
           （智力/精神/等級壓制）判斷
           冰封有沒有生效，沒生效就顯示抵抗+閃避動畫。
        */

        if(!skill.baseDamage){

            if(skill.freezeChance){

                const freezeRoll=rollNamedPersistentStatusEffect(
                    monster,"freeze",[
                        skill.freezeChance,player.level,monster.level,
                        stats.intelligence,getMonsterEffectiveSpiritPoints(monster),
                        true,getMonsterRank(monster)
                    ],"monster",index,skill.name
                );


                if(freezeRoll.hit){

                    applyFreezeEffect(
                        monster,
                        skill.freezeDuration
                    );


                    addBattleLog(
                        ""+
                        monster.name+
                        "被冰封了！"
                    );

                }
                else if(!freezeRoll.duplicate){

                    showMissEffect(
                        false,
                        index,
                        "抵抗"
                    );


                    addBattleLog(
                        skill.name+
                        "對"+
                        monster.name+
                        "沒有生效（抵抗）。"
                    );

                }

            }


            return;

        }


        /*
           ★ 命中判定：
           打空的話跳MISS、播放閃避動畫，
           不計算傷害，也不會附加燃燒/冰封/吸血
           （攻擊都沒打中了，附加效果自然也不會發生）。
        */

        const hit =
            rollHitChance(
                stats.accuracy,
                getMonsterEvasion(
                    monster
                ),
                getMonsterDebuffValue(
                    player,
                    "stun"
                )
            );


        if(!hit){

            showMissEffect(
                false,
                index,
                "MISS"
            );


            addBattleLog(
                skill.name+
                "對"+
                monster.name+
                "，沒有命中！"
            );


            return;

        }


        const critResult =
            rollCritical(
                player,
                skill.category,
                getMonsterEffectiveAntiCrit(monster)
            );

        const damage =
            calculateSkillDamage({
                skill:skill,
                skillLevel:level,
                effectiveAttack:statBonus,
                target:monster,
                casterLevel:player.level,
                casterElement:player.element,
                attacker:player,
                critMultiplier:critResult.multiplier
            });

        const hpBeforeDirectDamage=monster.hp;

        monster.hp =
            Math.max(
                0,
                monster.hp-damage
            );


        showMonsterHit(
            index,
            damage,
            "hp",
            critResult.isCrit
        );

        const actualDamageDealt=Math.max(0,hpBeforeDirectDamage-monster.hp);


        addBattleLog(

            skill.name+
            "命中"+
            monster.name+
            (
                critResult.isCrit
                ?
                "（爆擊！）"
                :
                ""
            )+
            "，造成"+
            damage+
            "傷害。"

        );


        if(
            skill.burnChance
        ){

            const burnRoll=rollNamedPersistentStatusEffect(
                monster,"burn",[
                    skill.burnChance,player.level,monster.level,
                    stats.intelligence,getMonsterEffectiveSpiritPoints(monster)
                ],"monster",index,skill.name,skill.guaranteedBurn===true
            );


            if(burnRoll.hit){

                const burnPercent =
                    skill.burnPercentByLevel[
                        level-1
                    ];


                applyBurnEffect(
                    monster,
                    skill.burnDuration,
                    burnPercent
                );


                addBattleLog(
                    ""+
                    monster.name+
                    "陷入燃燒狀態！"
                );

            }
            else if(!burnRoll.duplicate){

                addBattleLog(
                    "（燃燒效果被"+
                    monster.name+
                    "抵抗了）"
                );

            }

        }


        /*
           ★ 冰封判定（水系：冰封重擊）。
           跟燃燒共用同一套機率公式
           （智力/精神/等級壓制）。
           這裡的目標已經被上面的攻擊命中過，
           冰封是「附加效果」，沒生效只提示抵抗，
           不用再跳一次閃避動畫
           （閃避動畫留給「攻擊本身沒命中」的情況）。
        */

        if(
            skill.freezeChance
        ){

            const freezeRoll=rollNamedPersistentStatusEffect(
                monster,"freeze",[
                    skill.freezeChance,player.level,monster.level,
                    stats.intelligence,getMonsterEffectiveSpiritPoints(monster),
                    true,getMonsterRank(monster)
                ],"monster",index,skill.name
            );


            if(freezeRoll.hit){

                applyFreezeEffect(
                    monster,
                    skill.freezeDuration
                );


                addBattleLog(
                    ""+
                    monster.name+
                    "被冰封了！"
                );

            }
            else if(!freezeRoll.duplicate){

                addBattleLog(
                    "（冰封效果被"+
                    monster.name+
                    "抵抗了）"
                );

            }

        }


        /*
           ★ 新增（依照使用者要求，接上風系/
           土系技能的附加效果）：跟燃燒/冰封
           同一個時機點呼叫，處理降敏捷/降全
           屬性/降防禦/暈眩/石化這五種新效果。
        */

        applySkillDebuffEffects(
            skill,
            level,
            monster,
            index,
            player.level,
            stats.intelligence
        );


        /*
           ★ 吸血（水系：冰旋一閃）。
           累加這次攻擊造成的總傷害，
           所有目標處理完之後統一結算回血，
           避免命中每個目標都各自跳一次回血訊息。
        */

        if(
            skill.lifestealPercentByLevel
        ){

            totalLifestealDamage+=
                actualDamageDealt;

        }


        if(monster.hp<=0){

            killMonster(
                index
            );

        }

    });


    if(
        skill.lifestealPercentByLevel &&
        totalLifestealDamage>0
    ){

        const lifestealPercent =
            skill.lifestealPercentByLevel[
                level-1
            ];


        const lifestealAmount =
            Math.floor(
                totalLifestealDamage*
                lifestealPercent/
                100
            );


        const currentStats =
            getMainCharacterStats();


        const healedHP =
            Math.min(
                lifestealAmount,
                currentStats.maxHP-
                player.hp
            );


        const healedSP =
            Math.min(
                lifestealAmount,
                currentStats.maxSP-
                player.sp
            );


        player.hp =
            Math.min(
                currentStats.maxHP,
                player.hp+
                lifestealAmount
            );


        player.sp =
            Math.min(
                currentStats.maxSP,
                player.sp+
                lifestealAmount
            );


        if(healedHP>0){

            showPlayerHit(
                healedHP,
                "heal",
                0,
                true
            );

        }


        addBattleLog(
            "吸收傷害的"+
            lifestealPercent+
            "%，回復了"+
            lifestealAmount+
            "點HP與SP。"
        );

    }


    /*
       ★ 新增（依照使用者要求，接上土系的
       自身護盾／全體護盾技能）：
       地裂重擊（selfShieldByLevel）只給
       自己；石盾拳／石破天驚（allyShieldByLevel）
       給場上所有還活著的角色（玩家自己+
       player2，player2不存在或已經倒下
       就跳過）。護盾用同一套activeBuffs
       陣列存放，type固定叫"shield"，
       remaining是目前還剩多少可以吸收的量。
    */

    if(skill.selfShieldByLevel){

        const shieldAmount=
            skill.selfShieldByLevel[
                level-1
            ];


        if(canApplyNamedPersistentState(player,"shield","player",0,skill.name)){
            player.activeBuffs=(player.activeBuffs||[]).filter(
                b=>!b||b.type!=="shield"||Number(b.turnsLeft)>0&&Number(b.remaining)>0
            );
            player.activeBuffs.push(markPersistentStateName({
                type:"shield",turnsLeft:skill.shieldDuration||2,remaining:shieldAmount
            },"shield"));
            addBattleLog("獲得【岩盾】"+shieldAmount+"點，持續"+(skill.shieldDuration||2)+"回合。");
        }

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


                const targetIndex=getPartyCharacterIndex(character);
                if(!canApplyNamedPersistentState(character,"shield","player",targetIndex,skill.name)){
                    return;
                }
                character.activeBuffs=(character.activeBuffs||[]).filter(
                    b=>!b||b.type!=="shield"||Number(b.turnsLeft)>0&&Number(b.remaining)>0
                );
                character.activeBuffs.push(markPersistentStateName({
                    type:"shield",turnsLeft:skill.shieldDuration||2,remaining:shieldAmount
                },"shield"));

            }
        );


        addBattleLog(
            "我方有效目標獲得【岩盾】"+
            shieldAmount+
            "點護盾，持續"+
            (skill.shieldDuration||2)+
            "回合。"
        );

    }


    updateUI();

    finishPlayerAction();

}


/*
   施放怒火（增益技能）。
   目前遊戲裡只有玩家自己一位角色會戰鬥，
   所以「我方目標1人」固定就是玩家自己，
   之後有第二名角色能一起戰鬥時，
   這裡可以改成讓玩家選要buff誰。
*/

/*
   ★ 修正（依照使用者要求，「接上」新增的
   風系/土系增益技能）：
   原本這個函式叫castRageBuff()，寫死只處理
   「怒火」這一個技能。現在改名成
   castBuffSkill(skillId)，通用處理全部
   buff類技能——共用的部分（等級檢查/SP檢查/
   扣SP/技能名稱動畫）完全不變，只有「這個
   技能實際會產生什麼效果」這段改成依skillId
   分流：

   rage（怒火）→ 提升爆擊率/爆擊傷害
   dodgeSkill（閃躲術）→ 提升閃躲率
   rockWall（岩石壁壘）→ 提升防禦力
   earthShield（萬象土盾）→ 反傷
   barrier（結界）→ 完全格擋
   stealthSkill（隱身術）→ 隱身（無法被單體技能選中）
   dinghaishenzhen（氣定神閒）→ 提升異常狀態抗性

   全部統一存進player.activeBuffs（跟怒火
   同一個陣列），每種type只保留一份、
   重複施放會刷新持續時間，不會疊加。
*/

/*
   ★ 新增（依照使用者要求，「應該設定只要
   我方都能吃到效果，不然以後開放3、4、5、6
   隻角色，妳不就都要寫一次？沒有那種寫一次
   就一勞永逸的方法嗎？」）：

   這個函式回傳「目前場上還活著的我方角色」
   清單。現在會回傳[player, player2]（player2
   不存在或已死亡就不列入），以後開放角色
   三號、四號，只要把新角色加進這個函式回傳
   的清單，「全體我方」類的增益技能
   （閃躲術/岩石壁壘/萬象土盾/結界/隱身術/
   定海神針……）就會自動套用到新角色身上，
   不用再回頭一個一個技能改。

   ★ 老實說明範圍（不要誤會這解決了全部）：
   這個做法只解決「全體我方」類buff技能的
   擴充問題。單體技能、傷害技能、每個角色
   各自的攻擊流程，因為整個戰鬥系統目前是
   用player、player2兩個各自獨立命名的
   全域變數寫的（不是一份角色陣列），以後
   開放新角色，那些地方還是要照現在的模式
   （角色一號一套、角色二號一套）另外接，
   這個函式沒辦法解決那部分。
*/

function getActivePlayerCharacters(){
    return getCharacters().filter(
        character=>character && character.hp>0
    );
}


function castBuffSkill(skillId,targetIndex){

    const skill=skillDatabase[skillId];

    if(!battleActive || !skill){ return; }

    const level=getSkillLevel("fire",skillId);

    if(level<=0){
        addBattleLog("尚未學習"+skill.name+"。");
        finishPlayerAction();
        return;
    }

    let chosenTarget=null;
    if(skill.targetType==="ally"){
        chosenTarget=getBattleCharacterByIndex(
            targetIndex===null || targetIndex===undefined ? 0 : targetIndex
        );

        if(!chosenTarget || chosenTarget.hp<=0){
            addBattleLog(skill.name+"的目標目前無法接受此效果。");
            finishPlayerAction();
            return;
        }
    }

    if(player.sp<skill.spCost){
        addBattleLog("SP不足，無法使用"+skill.name+"。");
        finishPlayerAction();
        return;
    }

    player.sp-=skill.spCost;
    lungePlayerCard();
    showSkillNameBadge(skill.name,skill.element);
    setTimeout(()=>{ showPlayerSpPopup(skill.spCost); },500);

    function pushBuff(extraFields){
        const targets=skill.targetType==="allyAll"
            ? getActivePlayerCharacters().slice(0,3)
            : [chosenTarget||player];

        targets.forEach(character=>{
            if(!character || character.hp<=0){ return; }
            const characterIndex=getPartyCharacterIndex(character);
            if(!canApplyNamedPersistentState(
                character,skillId,"player",characterIndex,skill.name
            )){ return; }
            character.activeBuffs=(character.activeBuffs||[])
                .filter(b=>!b||b.type!==skillId||Number(b.turnsLeft)>0);
            character.activeBuffs.push(markPersistentStateName(Object.assign(
                {type:skillId,turnsLeft:skill.duration},
                extraFields||{}
            ),skillId));
        });
    }

    if(skillId==="rage"){
        const bonusPercent=skill.critBonusByLevel[level-1];
        pushBuff({bonusPercent:bonusPercent});
        addBattleLog(
            "怒火生效！我方最多3人爆擊率與爆擊傷害提升"+
            bonusPercent+"%，持續"+skill.duration+"回合。"
        );
    }
    else if(skillId==="dodgeSkill"){
        pushBuff({percent:skill.evasionBonusPercent});
        addBattleLog(
            "閃躲術生效！我方全體閃躲率提升"+
            skill.evasionBonusPercent+"%，持續"+skill.duration+"回合。"
        );
    }
    else if(skillId==="rockWall"){
        pushBuff({percent:skill.defenseBonusPercent});
        addBattleLog(
            "岩石壁壘生效！我方全體防禦力提升"+
            skill.defenseBonusPercent+"%，持續"+skill.duration+"回合。"
        );
    }
    else if(skillId==="earthShield"){
        pushBuff({percent:skill.reflectPercent});
        addBattleLog(
            (chosenTarget&&chosenTarget.id ? chosenTarget.id : "目標")+
            "獲得"+skill.reflectPercent+"%反傷土盾，持續"+skill.duration+"回合。"
        );
    }
    else if(skillId==="barrier"){
        pushBuff({});
        addBattleLog(
            (chosenTarget&&chosenTarget.id ? chosenTarget.id : "目標")+
            "獲得結界，可抵擋所有傷害，持續"+skill.duration+"回合。"
        );
    }
    else if(skillId==="stealthSkill"){
        pushBuff({});
        addBattleLog(
            (chosenTarget&&chosenTarget.id ? chosenTarget.id : "目標")+
            "進入隱身，無法被單體攻擊選中，持續"+skill.duration+"回合。"
        );
    }
    else if(skillId==="dinghaishenzhen"){
        pushBuff({resistBonus:skill.statusResistBonus});
        addBattleLog(
            skill.name+"生效！我方全體異常狀態抗性提升"+
            skill.statusResistBonus+"%，持續"+skill.duration+"回合。"
        );
    }
    else{
        addBattleLog(skill.name+"的效果尚未實作。");
    }

    updateUI();
    finishPlayerAction();
}


/*
   ★ 施放治療類技能（目前是水系的治療術）。

   跟castDamageSkill()一樣不寫死角色，
   用skill.element動態查詢，
   之後水角色能上場戰鬥時可以直接沿用。

   目前遊戲裡只有玩家自己一個角色在戰鬥，
   「擇一友方目標」暫時固定就是玩家自己，
   之後有第二名角色能一起戰鬥時，
   這裡可以改成讓玩家選要治療誰。
*/

function castHealSkill(skillId,targetIndex){

    const skill=skillDatabase[skillId];
    if(!battleActive || !skill){ return; }

    const level=getSkillLevel("fire",skillId);

    if(level<=0){
        addBattleLog("尚未學習"+skill.name+"。");
        finishPlayerAction();
        return;
    }

    const resolvedTargetIndex=getBattleCharacterByIndex(targetIndex)
        ? Number(targetIndex)
        : 0;
    const targetCharacter=getBattleCharacterByIndex(resolvedTargetIndex);

    if(!targetCharacter || targetCharacter.hp<=0){
        addBattleLog(skill.name+"的目標已無法接受治療。");
        finishPlayerAction();
        return;
    }

    if(player.sp<skill.spCost){
        addBattleLog("SP不足，無法使用"+skill.name+"。");
        finishPlayerAction();
        return;
    }

    player.sp-=skill.spCost;
    lungePlayerCard();
    showSkillNameBadge(skill.name,skill.element);
    setTimeout(()=>{ showPlayerSpPopup(skill.spCost); },500);

    const casterStats=getMainCharacterStats();
    const targetStats=getPartyBattleStats(resolvedTargetIndex);

    const exSkill=skillDatabase.waterEX;
    const exLevel=getSkillLevel("fire","waterEX");
    const healBonusMultiplier=(exSkill && exLevel>0 && exSkill.healBonusPercent)
        ? 1+exSkill.healBonusPercent/100
        : 1;

    const baseHealHP=skill.baseHeal+skill.healPerLevel*(level-1);
    const healHP=Math.floor(
        calculateHealingAmount(baseHealHP,casterStats.intelligence)*healBonusMultiplier
    );

    const potentialHealSP=Math.floor(
        calculateSPHealingAmount(
            skill.baseHealSP+(skill.healSPPerLevel||0)*(level-1),
            casterStats.intelligence
        )*healBonusMultiplier
    );

    const actualHealHP=Math.max(
        0,
        Math.min(healHP,targetStats.maxHP-targetCharacter.hp)
    );

    /* 使用者正式規則：施放者本人不回復SP；治療其他隊友才恢復SP。 */
    const actualHealSP=targetCharacter===player
        ? 0
        : Math.max(0,Math.min(potentialHealSP,targetStats.maxSP-targetCharacter.sp));

    targetCharacter.hp=Math.min(targetStats.maxHP,targetCharacter.hp+healHP);

    if(targetCharacter!==player){
        targetCharacter.sp=Math.min(targetStats.maxSP,targetCharacter.sp+potentialHealSP);
    }

    if(actualHealHP>0){
        showPlayerHit(actualHealHP,"heal",resolvedTargetIndex,true);
    }

    addBattleLog(
        skill.name+"使"+(targetCharacter.id||"目標")+
        "恢復"+actualHealHP+"點HP"+
        (targetCharacter===player
            ? "；施放者本人不回復SP。"
            : "、"+actualHealSP+"點SP。")
    );

    updateUI();
    finishPlayerAction();
}


/*
   ★ 施放復活類技能（目前是水系的復活術）。

   跟castReviveSkill()原本的說明不同——
   player2現在已經是真正能一起上場戰鬥、
   會真的陣亡的角色了（前一輪修復元素
   被動bug時確認過，player2有完整的
   等級/HP系統），這裡接上真正的復活
   邏輯：

   - 復活對象固定是player2（玩家自己死亡
     會直接觸發loseBattle()、戰鬥立刻
     結束，不會有「玩家死亡但隊友還在」
     的情境，所以能被復活的只可能是
     player2，不需要額外的選擇目標UI）。
   - 沒有player2、或player2還活著，
     都視為無效施放，擋下來並提示。
   - 復活後恢復的血量％數依技能等級查
     reviveHealPercentByLevel，跟治療術
     一樣吃水元素EX的healBonusPercent
     加成。
*/

/*
   ★ 修正（依照使用者要求，「復活術不只
   玩家2可以用，改天玩家如果3隻都玩水，
   要三隻都可以用」）：
   原本寫死抓player2，改成用
   getRevivableAllySlots()這個清單去找
   「誰死了可以被復活」，不再硬綁死
   player2這一個角色。

   目前遊戲架構就只有player（一號，死亡
   直接判負，不會是復活對象）跟player2
   （二號）這兩個角色欄位，player3/
   player4還沒有真正的角色資料、創角流程、
   戰鬥卡片——這些是更大的架構工程，
   不是這次順手就能生出來的，所以這裡
   先把「可能被復活的隊友清單」抽成一個
   函式，之後真的加了player3/player4，
   只要把他們也塞進這個清單、給一張戰鬥
   卡片，復活術這裡完全不用再改一行。

   如果清單裡同時有兩個以上的人陣亡
   （現在架構下不會發生，只有player2一個
   可能死亡對象，但先寫好準備），目前先
   復活「先加入清單的那一個」，等真的有
   3人以上同時戰鬥時，這裡要另外做一個
   「選擇要復活誰」的小視窗，先在註解
   留一個提醒。
*/

function getRevivableAllySlots(){
    return getExistingPartyIndexes().map(characterIndex=>({
        character:getPartyCharacterByIndex(characterIndex),
        characterIndex:characterIndex
    }));

}


function castReviveSkill(skillId,targetIndex){

    const skill=skillDatabase[skillId];
    if(!battleActive || !skill){ return; }

    const level=getSkillLevel("fire",skillId);

    if(level<=0){
        addBattleLog("尚未學習"+skill.name+"。");
        finishPlayerAction();
        return;
    }

    const revivableSlots=getRevivableAllySlots();

    if(revivableSlots.length===0){
        addBattleLog("目前沒有其他隊友，無法使用"+skill.name+"。");
        finishPlayerAction();
        return;
    }

    let targetSlot=null;

    if(targetIndex!==null && targetIndex!==undefined){
        targetSlot=revivableSlots.find(
            slot=>slot.characterIndex===targetIndex && slot.character.hp<=0
        )||null;
    }

    if(!targetSlot){
        targetSlot=revivableSlots.find(slot=>slot.character.hp<=0)||null;
    }

    if(!targetSlot){
        addBattleLog("目前沒有陣亡的隊友，不需要"+skill.name+"。");
        finishPlayerAction();
        return;
    }

    if(player.sp<skill.spCost){
        addBattleLog("SP不足，無法使用"+skill.name+"。");
        finishPlayerAction();
        return;
    }

    const targetCharacter=targetSlot.character;
    const targetIndexResolved=targetSlot.characterIndex;

    player.sp-=skill.spCost;
    lungePlayerCard();
    showSkillNameBadge(skill.name,skill.element);
    setTimeout(()=>{ showPlayerSpPopup(skill.spCost); },500);

    const exSkill=skillDatabase.waterEX;
    const exLevel=getSkillLevel("fire","waterEX");
    const healBonusMultiplier=(exSkill && exLevel>0 && exSkill.healBonusPercent)
        ? 1+exSkill.healBonusPercent/100
        : 1;

    const revivePercent=skill.reviveHealPercentByLevel[level-1];
    const targetStats=getPartyBattleStats(targetIndexResolved);

    const reviveHP=Math.max(
        1,
        Math.floor(targetStats.maxHP*revivePercent/100*healBonusMultiplier)
    );

    targetCharacter.hp=Math.min(targetStats.maxHP,reviveHP);

    /* 最新正式規格只指定恢復血量；復活不再額外恢復SP。 */

    setTimeout(()=>{
        showPlayerHit(targetCharacter.hp,"heal",targetIndexResolved,true);
    },300);

    addBattleLog(
        (targetCharacter.id||"隊友")+"被"+skill.name+
        "復活了！恢復"+targetCharacter.hp+"點HP。"
    );

    updateUI();
    finishPlayerAction();
}


/*
   每回合開始時，buff的持續回合數要遞減，
   歸零就移除，並在戰鬥資訊留一筆紀錄。
*/

/*
   ★ 修正（依照使用者要求，接上新增的
   增益技能）：
   原本這個函式寫死「⏳ 怒火效果已結束」，
   不管過期的是哪個buff都印同一句話，
   而且只處理player.activeBuffs，player2
   的buff（例如player2學會的岩石壁壘/
   閃躲術之類）完全沒被倒數過，會變成
   永久生效、時間到了也不會消失。

   改成通用版本，用DEBUFF_LABELS這種
   對照表統一決定每種buff類型過期時要
   顯示什麼訊息，player/player2都會處理，
   跟tickStatusEffects()處理怪物減益是
   同一套設計邏輯。
*/

const BUFF_EXPIRE_LABELS={

    rage:"怒火",
    phoenixMight:"鳳威",
    dodgeSkill:"風行",
    rockWall:"岩石壁壘",
    earthShield:"萬象土盾（反傷）",
    barrier:"結界",
    stealthSkill:"隱身",
    dinghaishenzhen:"氣定神閒",
    shield:"岩盾"

};


function tickBuffsForCharacter(character){

    if(
        !character ||
        !character.activeBuffs ||
        character.activeBuffs.length===0
    ){
        return;
    }


    character.activeBuffs=
        character.activeBuffs.filter(
            buff=>{

                if(buff.type==="phoenixMight"){
                    const active=
                        buff.battleToken===battleToken&&
                        turn<Number(buff.expiresTurn);
                    if(active){
                        buff.turnsLeft=Math.max(1,Number(buff.expiresTurn)-turn);
                        return true;
                    }
                    addBattleLog("⏳鳳威效果已結束。");
                    return false;
                }

                buff.turnsLeft--;


                if(buff.turnsLeft<=0){

                    addBattleLog(

                        "⏳"+
                        (
                            BUFF_EXPIRE_LABELS[
                                buff.type
                            ]||
                            buff.type
                        )+
                        "效果已結束。"

                    );

                    return false;

                }


                return true;

            }
        );

}


function tickPlayerBuffs(){

    /*
       ★ 修正（角色陣列重構第一階段）：
       改用getCharacters()，之後加第三角色，
       這裡完全不用再改一行，自動就會一起
       處理到。
    */

    getCharacters().forEach(
        character=>{

            tickBuffsForCharacter(
                character
            );

        }
    );

}


/* =====================================================
   共用：解析目前的攻擊目標
===================================================== */

/*
   ★ 新增（修復「目標死亡但selectedMonster
   索引還沒更新，角色行動整個卡死」的bug）：

   普通攻擊、傷害技能、風之箭這三個函式，
   原本各自重複寫一次「selectedMonster指到的
   怪物還活著嗎」的判斷，一旦隊友先把這隻怪物
   打死、但這個角色鎖定的索引還沒換過，判斷
   失敗就直接return——問題是這個return沒有
   呼叫finishPlayerAction()，導致這個角色的
   行動卡在原地不會往下走。因為怪物的行動邏輯
   是獨立跑的，畫面上才會看起來像「怪物一直打、
   我方完全沒反應」，其實是我方的行動佇列被
   卡住了。

   拆成兩層：

   1. findAliveTargetIndex(preferredIndex)：
      純粹的「找目標」邏輯，不呼叫
      finishPlayerAction()、不改selectedMonster，
      單純回傳「應該打誰」或null（沒人可打）。
      這樣不管呼叫端自己有沒有處理
      finishPlayerAction()，都能安全共用同一套
      找目標規則，不會有副作用打架的問題。

   2. resolveAttackTargetIndex()：
      給player1的普通攻擊/傷害技能/風之箭用
      （這三個函式本身要自己負責呼叫
      finishPlayerAction()，呼叫端不會補），
      在findAliveTargetIndex的結果上，
      多做「同步selectedMonster」跟
      「找不到目標時呼叫finishPlayerAction()」
      這兩件事。

   兩層規則一致：
   - selectedMonster指到的怪物還活著，直接沿用，
     不改變玩家原本鎖定的目標；
   - 死了的話，自動改鎖定currentBattleMonsters裡
     第一隻還活著的怪物，讓攻擊自動接續下去；
   - 連一隻活著的怪物都找不到（敵方已團滅），
     回傳null。

   這兩個函式只處理「目標是否有效」，
   不會動到傷害公式、命中率、暴擊率等
   任何既有戰鬥數值機制。
*/

function findAliveTargetIndex(preferredIndex){

    if(
        preferredIndex!==null &&
        preferredIndex!==undefined &&
        monsters[preferredIndex] &&
        monsters[preferredIndex].alive
    ){
        return preferredIndex;
    }


    const fallbackIndex =
        currentBattleMonsters.find(
            i=>
                monsters[i] &&
                monsters[i].alive
        );


    return (
        fallbackIndex===undefined
        ?
        null
        :
        fallbackIndex
    );

}


function resolveAttackTargetIndex(){

    const index =
        findAliveTargetIndex(
            selectedMonster
        );


    if(index===null){

        finishPlayerAction();

        return null;

    }


    selectedMonster=
        index;

    return index;

}


/* =====================================================
   普通攻擊
===================================================== */

function normalAttack(){

    if(!battleActive){
        return;
    }


    const index =
        resolveAttackTargetIndex();


    if(index===null){
        return;
    }


    const monster =
        monsters[index];


    lungePlayerCard();


    showSkillNameBadge(
        "普通攻擊",
        "normal",
        0,
        index,
        [index]
    );


    const stats =
        getMainCharacterStats();


    /*
       ★ 命中判定：
       打空的話直接跳MISS、播放閃避動畫，
       不計算傷害、不扣血，
       但還是要正常結束這次行動
       （進入怪物回合），不能卡住。
    */

    const hit =
        rollHitChance(
            stats.accuracy,
            getMonsterEvasion(
                monster
            ),
            getMonsterDebuffValue(
                player,
                "stun"
            )
        );


    if(!hit){

        showMissEffect(
            false,
            index,
            "MISS"
        );


        addBattleLog(
            "普通攻擊"+
            monster.name+
            "，沒有命中！"
        );


        updateUI();

        finishPlayerAction();

        return;

    }


    const critResult =
        rollCritical(
            player,
            "physical",
            getMonsterEffectiveAntiCrit(monster)
        );

    const damage =
        calculateDamage(
            stats.attack,
            getMonsterEffectiveDefense(monster),
            player.level,
            monster.level,
            player.element,
            monster.element,
            {
                attacker:player,
                target:monster,
                critMultiplier:critResult.multiplier
            }
        );


    monster.hp =
        Math.max(
            0,
            monster.hp-damage
        );


    showMonsterHit(
        index,
        damage,
        "hp",
        critResult.isCrit
    );


    addBattleLog(

        "普通攻擊"+
        monster.name+
        (
            critResult.isCrit
            ?
            "（爆擊！）"
            :
            ""
        )+
        "，造成"+
        damage+
        "傷害。"

    );


    if(monster.hp<=0){
        killMonster(index);
    }


    updateUI();

    finishPlayerAction();

}



/* =====================================================
   風之箭
===================================================== */

function windArrowAttack(){

    if(!battleActive){
        return;
    }


    if(player.sp<10){

        if(autoBattle){

            normalAttack();

        }
        else{

            /*
               ★ 修正（跟castDamageSkill()同一種
               bug，同一次一起修掉）：
               原本這裡也是印完❌訊息就直接return，
               沒呼叫finishPlayerAction()，會讓
               結算鏈從這裡開始整個卡住，不只風之箭
               這次行動，後面所有角色/怪物的回合
               都不會再被推進。
            */

            addBattleLog(
                "SP不足，無法使用風之箭。"
            );

            finishPlayerAction();

        }

        return;

    }


    const index =
        resolveAttackTargetIndex();


    if(index===null){
        return;
    }


    player.sp -= 10;


    lungePlayerCard();


    showSkillNameBadge(
        skillDatabase.windArrow.name,
        "wind",
        0,
        index,
        [index]
    );


    setTimeout(()=>{
        showPlayerSpPopup(10);
    },500);


    const monster =
        monsters[index];


    const stats =
        getMainCharacterStats();


    const damage =
        calculateDamage(
            stats.attack+15,
            getMonsterEffectiveDefense(monster),
            player.level,
            monster.level,
            player.element,
            monster.element,
            {attacker:player,target:monster}
        );


    monster.hp =
        Math.max(
            0,
            monster.hp-damage
        );


    showMonsterHit(index,damage,"hp");


    addBattleLog(
        "風之箭命中"+
        monster.name+
        "，造成"+
        damage+
        "傷害。"
    );


    if(monster.hp<=0){
        killMonster(index);
    }


    updateUI();

    finishPlayerAction();

}


/* =====================================================
   玩家行動結束
===================================================== */

function finishPlayerAction(){

    if(!battleActive){
        return;
    }


    clearInterval(timerId);


    actionReady=false;

    pendingAction=null;
    clearBattleTargetSelectionMode();


    if(checkBattleEnd()){
        return;
    }

    /* A single action may reach this helper through animation and fallback
       paths. Only the first call is allowed to advance the queue. */
    if(battleAdvanceScheduled){
        return;
    }

    battleAdvanceScheduled=true;


    const token=
        battleToken;


    /*
       ★ 修正（重新設計回合制）：
       這個函式現在同時服務兩種情境，
       要看battlePhase決定「結束後接下來做什麼」：

       1. battlePhase==="declare"：
          代表這是宣告階段（自動角色宣告時
          直接執行、或防禦/物品/增益這類
          不需要結算排序的行動剛執行完），
          結束後要往下一個「還沒宣告的角色」推進，
          activeBattleCharacterIndex++，
          呼叫beginCharacterTurn()。

       2. battlePhase==="resolve"：
          代表這是結算階段（普通攻擊/傷害技能
          真正在依敏捷順序執行），
          結束後往initiativeIndex推進，
          呼叫processNextCombatant()。
    */

    if(battlePhase==="declare"){

        activeBattleCharacterIndex++;


        /*
           ★ 修正（依照使用者要求，這次進一步）：
           宣告階段原本還會顯示「已選擇XX」文字，
           所以留了一點延遲讓玩家看得到那行字。
           現在已經拿掉那行文字了，
           純粹換人選擇不需要再等，
           直接進下一位、幾乎感覺不到停頓。
        */

        battleAdvanceTimeoutId=setTimeout(()=>{

            battleAdvanceTimeoutId=null;
            battleAdvanceScheduled=false;

            if(
                !battleActive ||
                token!==battleToken
            ){
                return;
            }


            beginCharacterTurn(
                token
            );

        },BATTLE_DECLARE_ADVANCE_MS);

        return;

    }


    initiativeIndex++;


    /*
       ★ 修正（依照使用者要求，加快節奏）：
       原本1050ms，使用者反應「每個人行動完、
       換下一位」的間隔感覺偏久，尤其一整輪
       打完要接下一輪的時候特別明顯——
       這裡調快到700ms，動畫還是看得清楚，
       但整體節奏會俐落不少。
    */

    battleAdvanceTimeoutId=setTimeout(()=>{

        battleAdvanceTimeoutId=null;
        battleAdvanceScheduled=false;

        if(
            !battleActive ||
            token!==battleToken
        ){
            return;
        }


        /*
           ★ 新增（這裡是最關鍵的一個缺口——
           每個人行動完、換下一位，全部都要
           經過這裡，之前完全沒有保護，
           如果任何一次的processNextCombatant()
           在執行中出錯，戰鬥就會從那一刻
           開始完全靜止，玩家只會看到
           畫面停在原地，什麼提示都沒有）：
        */

        try{

            processNextCombatant(
                token
            );

        }
        catch(error){

            console.error(
                "推進下一位時發生例外：",
                error
            );

            addBattleLog(
                "推進下一位時發生例外（"+
                (error&&error.message)+
                "），嘗試強制繼續。"
            );

            initiativeIndex++;
            processNextCombatant(token);

        }

    },BATTLE_RESOLVE_ADVANCE_MS);

}


/* =====================================================
   怪物攻擊
===================================================== */

/*
   ★ 修正（敏捷排序系統）：
   原本的monsterTurn()是「一次把所有怪物
   都打過一輪」的批次處理函式，
   跟現在「玩家、怪物混在同一份行動順序清單裡
   輪流行動」的架構不相容了。
   改寫成processSingleMonsterAttack()，
   一次只處理「這一隻」怪物的攻擊，
   打完呼叫finishPlayerAction()
   （現在這個函式其實是「結束目前這位的行動」，
   不管是角色還是怪物都共用它）往下一位推進。
*/

function processSingleMonsterAttack(monsterIndex,token){

    if(
        !battleActive ||
        token!==battleToken
    ){
        return;
    }


    const monster=
        monsters[monsterIndex];


    /*
       這隻怪物有可能在這個大回合更早之前
       就已經被打死了（換敏捷排序後，
       玩家可能先手把牠殺掉），
       直接跳過，不佔用行動、不掉血。
    */

    if(
        !monster ||
        !monster.alive
    ){

        finishPlayerAction();

        return;

    }


    if(
        isMonsterFrozen(monster)
    ){

        addBattleLog(
            ""+
            monster.name+
            "被冰封，無法行動。"
        );


        finishPlayerAction();

        return;

    }


    /*
       ★ 新增（依照使用者要求，飛沙瞬擊的
       石化效果）：跟冰封同樣的「無法行動」
       判斷，只是類型不同、訊息不同。
    */

    if(
        isMonsterPetrified(monster)
    ){

        addBattleLog(
            ""+
            monster.name+
            "被石化，無法行動。"
        );


        finishPlayerAction();

        return;

    }


    lungeMonsterCard(
        monsterIndex
    );


    /*
       ★ 修正（依照使用者要求，第2、3項）：
       1. 技能名稱不再自己取，改成從技能池
          （skillIds，引用真正存在的技能）
          隨機挑一個要施放的技能ID，
          顯示的名稱直接去skillDatabase查
          真正的技能名稱，跟玩家用的是
          同一套技能、同一個名字。
       2. 技能釋放機率不再寫死50%，
          改成讀怪物資料裡各自的skillChance
          （不同區域機率不一樣），
          是一個獨立、針對「這隻怪物這一次
          攻擊」單獨骰的機率，不是跟普通攻擊
          綁在一起、互斥的兩個選項共用同一個
          判斷式而已，各區域可以自由調整
          這個數字、不影響其他地方。
    */

    /*
       ★ 修正（依照使用者要求，「SP要實際
       消耗，沒了就不能釋放技能」）：
       原本這裡只看skillChance機率、完全沒
       檢查怪物SP夠不夠，技能等於是免費的、
       SP純粹是顯示用的裝飾數字。

       現在先把「這隻怪物SP付得起」的技能
       挑出來（affordableSkillIds），只有
       挑得出至少一個付得起的技能，才會真的
       骰機率決定要不要放技能；SP不夠的技能
       不會被選到，SP整個見底的話就直接
       改普通攻擊，跟玩家「SP不足自動改用
       普通攻擊」是同一種行為。
    */

    const hasVisibleSingleTarget=getExistingPartyIndexes().some(index=>{
        const character=getPartyCharacterByIndex(index);
        return character&&character.hp>0&&!hasActiveBuff(character,"stealthSkill");
    });

    const affordableSkillIds=

        Array.isArray(monster.skillIds)
        ?
        monster.skillIds.filter(
            skillId=>{

                const data=
                    skillDatabase[skillId];


                return (
                    data &&
                    monster.sp>=data.spCost&&
                    (data.targetType!=="single"||hasVisibleSingleTarget)
                );

            }
        )
        :
        [];


    const usesSkill=

        affordableSkillIds.length>0 &&
        Math.random()<
        (
            monster.skillChance!==undefined
            ?
            monster.skillChance
            :
            0
        );


    let castSkillId=null;

    let castSkillName=null;


    if(usesSkill){

        castSkillId=

            affordableSkillIds[
                Math.floor(
                    Math.random()*
                    affordableSkillIds.length
                )
            ];


        const castSkillData=
            skillDatabase[castSkillId];


        castSkillName=

            castSkillData
            ?
            castSkillData.name
            :
            castSkillId;


        /*
           ★ 新增（依照使用者要求，SP真的要
           被扣掉）：跟玩家施放技能一樣，
           放下去就真的扣血條下面那條SP，
           不是只有畫面數字動、實際邏輯沒動。
        */

        if(castSkillData){

            monster.sp=

                Math.max(
                    0,
                    monster.sp-
                    castSkillData.spCost
                );

        }


        /*
           ★ 新增（依照使用者要求，跟玩家
           施放技能一樣，怪物施放技能時也要
           跳出技能名稱）：
           元素類別優先用技能本身的element
           （跟玩家技能徽章用的是同一套
           badge-fire/badge-water樣式），
           技能資料查不到的話退回用怪物
           自己的element，確保一定有樣式
           可以套用。
        */

    }


    /*
       ★ 修正（依照使用者要求，「怪物根本
       沒有真的釋放技能」——這個問題是真的，
       不是誤會）：

       原本這裡不管放的是哪個技能，一律套用
       固定1.3倍傷害係數，技能本身在
       skillDatabase裡定義的baseDamage／
       damagePerLevel完全沒被用到，只有
       名稱顯示是真的；而targetType:"tri"
       （火箭/水球術這類三重目標技能）
       實際上也只會打中一個隨機目標，
       跟玩家使用同一個技能時「打中/左/右
       三個目標」的效果完全不一樣。

       這裡重新設計：
       1. 技能傷害改成monster.attack加上
          技能自己的baseDamage/damagePerLevel
          （依怪物等級換算出一個合理的技能
          等級，等級越高的怪物、技能等級
          也越高），不同技能會打出真的不同
          的傷害，不是統一乘1.3。
       2. targetType==="tri"／"row"／"column" 必須由
          固定戰場 Slot owner 依實際前後排與欄位選取，
          不能把範圍技能偷換成場上所有存活角色。
       3. 每個目標各自獨立擲命中/爆擊，
          沒命中的照樣顯示MISS、有命中的
          正常扣血，跟原本單體攻擊的呈現
          方式一致，只是可能同時發生在
          兩個角色身上。
    */

    const skillTargetType=(usesSkill && castSkillId && skillDatabase[castSkillId])
        ? skillDatabase[castSkillId].targetType
        : "single";

    const isRangeSkill=["tri","row","column","all"].includes(skillTargetType);

    const livingTargets=getExistingPartyIndexes()
        .map(index=>({
            character:getPartyCharacterByIndex(index),
            stats:getPartyBattleStats(index),
            index:index
        }))
        .filter(entry=>entry.character && entry.character.hp>0);

    /* 隱身只阻止單體／普通攻擊選中；範圍技能仍會波及。 */
    const selectableSingleTargets=livingTargets.filter(
        entry=>!hasActiveBuff(entry.character,"stealthSkill")
    );

    if(!isRangeSkill && selectableSingleTargets.length===0){
        addBattleLog(monster.name+"找不到可被單體攻擊選中的目標。");
        updateUI();
        finishPlayerAction();
        return;
    }

    let attackTargets=[];
    let primaryTargetIndex=null;

    if(skillTargetType==="all"){
        attackTargets=livingTargets;
    }else if(isRangeSkill){
        /* The formal formation is already the owner for allyTri and player
           targeting. Monster range skills must resolve through that same Slot
           geometry, including a party member placed in the back row. */
        const battlefieldSlots=typeof window!=="undefined"
            ? window.FourSymbolsBattlefieldSlots
            : null;
        const primary=livingTargets[
            Math.floor(Math.random()*livingTargets.length)
        ];
        primaryTargetIndex=primary?primary.index:null;
        const formation=battlefieldSlots&&typeof battlefieldSlots.ensureAllyFormation==="function"
            ? battlefieldSlots.ensureAllyFormation(getExistingPartyIndexes())
            : null;
        const targetIndexes=primary&&formation&&typeof battlefieldSlots.resolveAllyTargets==="function"
            ? battlefieldSlots.resolveAllyTargets(
                formation,
                primary.index,
                skillTargetType,
                index=>{
                    const character=getPartyCharacterByIndex(index);
                    return !!(character&&character.hp>0);
                }
            )
            : [];
        attackTargets=targetIndexes.map(index=>
            livingTargets.find(entry=>entry.index===index)
        ).filter(Boolean);
    }else{
        const primary=selectableSingleTargets[
            Math.floor(Math.random()*selectableSingleTargets.length)
        ];
        primaryTargetIndex=primary?primary.index:null;
        attackTargets=[primary];
    }

    if(attackTargets.length===0){
        addBattleLog(monster.name+"找不到可被此技能選中的目標。");
        updateUI();
        finishPlayerAction();
        return;
    }

    const attackTargetIndexes=attackTargets.map(target=>target.index);
    if(usesSkill){
        showMonsterSkillNameBadge(
            castSkillName,
            (castSkillData&&castSkillData.element)||monster.element||"normal",
            monsterIndex,
            skillTargetType==="all"?null:primaryTargetIndex,
            attackTargetIndexes
        );
    }else{
        showMonsterSkillNameBadge(
            "普通攻擊","normal",monsterIndex,primaryTargetIndex,attackTargetIndexes
        );
    }


    /*
       ★ 新增（依照使用者要求，怪物用火箭
       攻擊玩家時，也要有三發飛行特效，
       方向相反：從怪物卡片飛向玩家卡片）。
    */

    if(castSkillId==="fireRocket"){

        playFireRocketAnimation(
            "battleMonster"+monsterIndex,
            attackTargets.map(
                target=>
                    "battlePlayerCard"+
                    target.index
            )
        );

    }


    /*
       ★ 技能等級沒有存在怪物資料裡（怪物
       不像玩家有「學會、升級技能」的概念），
       這裡用怪物等級換算出一個1~技能上限
       之間的合理技能等級，等級越高的怪物
       用起技能來威力也越強，不會所有等級
       的怪物放同一個技能都一樣強。
    */

    const castSkillData2=

        usesSkill && castSkillId
        ?
        skillDatabase[castSkillId]
        :
        null;


    const effectiveSkillLevel=

        castSkillData2
        ?
        Math.min(
            castSkillData2.maxLevel||1,
            Math.max(
                1,
                Number.isFinite(Number(monster.v141ForceSkillLevel))
                    ?Math.floor(Number(monster.v141ForceSkillLevel))
                    :Math.round(monster.level/8)
            )
        )
        :
        0;


    /*
       ★ 新增（依照使用者要求，物理/法術
       分開算，完全比照玩家castDamageSkill()
       的規則：skill.category==="magic"用
       法術攻擊，其餘（含沒放技能的普通
       攻擊）用一般攻擊力）：
    */

    /* Pure-control skills keep their status effect but never enter direct-damage settlement. */
    const isPureControlSkill=
        !!(castSkillData2 && castSkillData2.id==="freeze");

    const isMonsterMagicSkill=
        castSkillData2 &&
        castSkillData2.category==="magic";

    const baseAttackStatRaw=
        isMonsterMagicSkill
        ? monster.magicAttack
        : monster.attack;

    const offensiveStatDown=
        getStatDownPercentFor(
            monster,
            isMonsterMagicSkill ? "intelligence" : "attack"
        );

    const baseAttackStat=
        baseAttackStatRaw*(1-offensiveStatDown/100);


    let monsterLifestealDamage=0;


    attackTargets.forEach(
        targetEntry=>{

            const targetCharacter=
                targetEntry.character;

            const targetStats=
                targetEntry.stats;

            const targetIndex=
                targetEntry.index;


            const monsterHit=
                rollHitChance(
                    getMonsterAccuracy(
                        monster
                    ),
                    targetStats.evasion,
                    getMonsterDebuffValue(
                        monster,
                        "stun"
                    )
                );


            if(!monsterHit){

                showMissEffect(
                    true,
                    targetIndex,
                    "MISS"
                );


                addBattleLog(

                    ""+
                    monster.name+
                    ""+
                    (
                        usesSkill
                        ?
                        "施放"+castSkillName
                        :
                        "攻擊"
                    )+
                    ""+
                    (targetCharacter.id||"你")+
                    "，沒有命中！"

                );


                return;

            }


            const isBeginnerForestNormalAttack=
                currentZone==="forest" &&
                !castSkillData2 &&
                monster &&
                monster.v173BeginnerForest===true;

            /* 新手森林普通攻擊是教學保護值：不吃爆擊，未防禦時固定10～15。 */
            const rageCriticalBonuses=getActiveRageCriticalBonuses(monster);
            const monsterCritChance=isBeginnerForestNormalAttack
                ?0
                :Math.max(
                    CRIT_CHANCE_MIN_AFTER_ANTI_CRIT,
                    10+rageCriticalBonuses.chance-(targetStats.antiCrit||0)
                );
            const monsterCrit=!isBeginnerForestNormalAttack&&Math.random()*100<monsterCritChance;
            const monsterCritMultiplier=monsterCrit
                ?Math.min(CRIT_MULTIPLIER_MAX,1.5+rageCriticalBonuses.damage/100)
                :1;

            let damage=
                isPureControlSkill
                ?0
                :isBeginnerForestNormalAttack
                ?rollBeginnerForestNormalAttackDamage()
                :castSkillData2
                ?calculateSkillDamage({
                    skill:castSkillData2,
                    skillLevel:effectiveSkillLevel,
                    effectiveAttack:baseAttackStat,
                    target:targetCharacter,
                    targetDefense:targetStats.defense,
                    casterLevel:monster.level,
                    casterElement:monster.element,
                    attacker:monster,
                    critMultiplier:monsterCritMultiplier
                })
                :calculateDamage(
                    baseAttackStat,
                    targetStats.defense,
                    monster.level,
                    targetCharacter.level,
                    monster.element,
                    targetCharacter.element,
                    {
                        attacker:monster,
                        target:targetCharacter,
                        critMultiplier:monsterCritMultiplier
                    }
                );


            if(targetCharacter.isDefending && damage>0){

                damage=
                    Math.max(
                        1,
                        Math.floor(
                            damage*0.5
                        )
                    );

            }


            /*
               ★ 新增（依照使用者要求，接上
               結界/護盾/反傷這幾個防禦類
               增益效果）：
               結界（barrier）完全格擋，
               這次攻擊直接歸零，連護盾都
               不用消耗；沒有結界的話才檢查
               護盾（shield），護盾按剩餘
               點數吸收傷害，吸收不完的部分
               才會真的扣血；扣血之後如果
               目標身上有反傷（earthShield），
               依比例把傷害打回怪物身上。
            */

            const hasBarrier=
                hasActiveBuff(
                    targetCharacter,
                    "barrier"
                );


            if(damage>0 && hasBarrier){

                damage=0;


                addBattleLog(
                    ""+
                    (targetCharacter.id||"你")+
                    "的結界完全格擋了這次攻擊！"
                );

            }
            else{

                const shieldBuff=

                    (targetCharacter.activeBuffs||[])
                    .find(
                        b=>

                            b.type==="shield"&&
                            b.turnsLeft>0 &&
                            b.remaining>0

                    );


                if(damage>0 && shieldBuff){

                    const absorbed=

                        Math.min(
                            damage,
                            shieldBuff.remaining
                        );


                    shieldBuff.remaining-=
                        absorbed;

                    damage-=
                        absorbed;


                    if(absorbed>0){

                        addBattleLog(
                            "護盾吸收了"+
                            absorbed+
                            "點傷害（剩餘"+
                            shieldBuff.remaining+
                            "點）。"
                        );

                        showShieldAbsorb(
                            targetIndex,
                            absorbed
                        );

                    }

                }

            }


            const hpBeforeDirectDamage=Math.max(0,Number(targetCharacter.hp)||0);

            targetCharacter.hp=
                Math.max(
                    0,
                    targetCharacter.hp-
                    damage
                );

            const actualHpDamage=Math.max(0,hpBeforeDirectDamage-targetCharacter.hp);


            /*
               ★ 反傷（萬象土盾／earthShield）：
               扣完血之後才算，避免結界/護盾
               擋下的部分也被誤算進反傷裡。
            */

            const reflectPercent=

                getActiveBuffPercent(
                    targetCharacter,
                    "earthShield"
                );


            if(
                reflectPercent>0 &&
                actualHpDamage>0
            ){

                const reflectDamage=

                    Math.max(
                        1,
                        Math.floor(
                            actualHpDamage*
                            reflectPercent/
                            100
                        )
                    );


                monster.hp=
                    Math.max(
                        0,
                        monster.hp-
                        reflectDamage
                    );


                addBattleLog(
                    "反傷造成"+
                    monster.name+
                    ""+
                    reflectDamage+
                    "點傷害。"
                );


                if(monster.hp<=0){

                    killMonster(
                        monsterIndex
                    );

                }

            }


            /*
               ★ 修正（依照使用者要求，「戰鬥中擁有護盾，
               受到傷害時，扣HP的...就不用跳動，直接顯示
               白色護盾扣除的數字，除非護盾剩餘承受量小於
               傷害，那則一起顯示」）：
               上面護盾吸收的邏輯執行完之後，damage已經是
               「護盾擋不住、真正會扣血」的剩餘量——護盾
               完全擋下這次攻擊時damage會變成0，這裡原本
               不管damage是不是0都會呼叫showPlayerHit()，
               連帶觸發卡片震動效果跟「-0HP」這種沒有意義
               的紅字彈出動畫，明明血量根本沒扣、卻看起來
               又跳字又震動，跟護盾應該要有的「完全擋下」
               觀感不符。改成只有damage>0（護盾沒有完全
               擋住、真的有扣到血）才呼叫，天然就同時滿足
               「護盾夠用時只顯示白字」跟「護盾不夠用時
               白字紅字一起顯示」（因為showShieldAbsorb()
               已經在上面護盾吸收邏輯裡呼叫過了，這裡只是
               另外決定要不要「再加上」紅字HP扣血提示）。
            */
            if(damage>0){

                showPlayerHit(
                    damage,
                    "hp",
                    targetIndex,
                    false,
                    monsterCrit
                );

            }


            if(!isPureControlSkill){
                addBattleLog(

                    ""+
                    monster.name+
                    ""+
                    (
                        usesSkill
                        ?
                        "施放"+castSkillName
                        :
                        "攻擊"
                    )+
                    ""+
                    (targetCharacter.id||"你")+
                    (
                        monsterCrit
                        ?
                        "（爆擊！）"
                        :
                        ""
                    )+
                    "，造成"+
                    damage+
                    "傷害"+
                    (
                        targetCharacter.isDefending
                        ?
                        "（防禦狀態傷害減半）"
                        :
                        ""
                    )+
                    "。"

                );
            }


            /*
               ★ 新增（依照使用者要求，「野怪
               異常狀態直接做」）：
               怪物這次真的有放技能、而且技能
               本身帶有異常效果欄位的話，在
               傷害結算完、確認目標還活著的
               情況下，套用到目標玩家身上。
               跟玩家對怪物那套是同一顆函式
               家族（applySkillDebuffEffectsToPlayer()
               鏡像applySkillDebuffEffects()），
               呼叫時機也一致：命中、傷害結算
               完之後才判定附加效果。
            */

            if(
                usesSkill &&
                castSkillData2 &&
                targetCharacter.hp>0
            ){

                applySkillDebuffEffectsToPlayer(
                    castSkillData2,
                    effectiveSkillLevel,
                    targetCharacter,
                    targetIndex,
                    monster.level,
                    getMonsterEffectiveAbilityPoints(monster,"intelligence")
                );

            }

            if(
                usesSkill &&
                castSkillData2 &&
                castSkillData2.lifestealPercentByLevel &&
                damage>0
            ){
                monsterLifestealDamage+=damage;
            }

        }
    );


    if(
        usesSkill &&
        castSkillData2 &&
        castSkillData2.lifestealPercentByLevel &&
        monsterLifestealDamage>0 &&
        monster.alive
    ){
        const percent=castSkillData2.lifestealPercentByLevel[effectiveSkillLevel-1];
        const amount=Math.floor(monsterLifestealDamage*percent/100);

        if(amount>0){
            const hpRecovered=Math.max(0,Math.min(amount,monster.maxHP-monster.hp));
            const spRecovered=Math.max(0,Math.min(amount,monster.maxSP-monster.sp));

            monster.hp=Math.min(monster.maxHP,monster.hp+amount);
            monster.sp=Math.min(monster.maxSP,monster.sp+amount);

            addBattleLog(
                monster.name+"吸取傷害的"+percent+
                "%並恢復"+hpRecovered+"點HP、"+spRecovered+"點SP。"
            );
        }
    }


    updateUI();


    finishPlayerAction();

}


/* =====================================================
   戰鬥結束
===================================================== */

function checkBattleEnd(){

    if(!battleActive){
        return true;
    }


    const partyDefeated=getExistingPartyIndexes().every(index=>{
        const character=getPartyCharacterByIndex(index);
        return !character || character.hp<=0;
    });

    if(partyDefeated){

        loseBattle();

        return true;

    }


    const alive =
        currentBattleMonsters
        .some(
            i=>
                monsters[i] &&
                monsters[i].alive
        );


    if(!alive){

        winBattle();

        return true;

    }


    return false;

}


function applyPostBattleAutoRecovery(){

    getExistingPartyIndexes().forEach(characterIndex=>{

        const character=getPartyCharacterByIndex(characterIndex);
        const config=getPartyAutoConfig(characterIndex);
        const stats=getPartyBattleStats(characterIndex);

        if(!character || character.hp<=0 || !config.enabled || !stats){
            return;
        }

        ["hp","sp"].forEach(resource=>{

            const maxValue=resource==="hp" ? stats.maxHP : stats.maxSP;
            const currentValue=resource==="hp" ? character.hp : character.sp;
            const threshold=normalizeAutoBattleThreshold(config[resource],resource==="hp" ? 50 : 25);

            if(maxValue<=0 || currentValue>=maxValue || currentValue/maxValue*100>threshold){
                return;
            }

            const potionId=getAutoPotionId(resource);
            const definition=getPotionDefinition(potionId);

            if(!definition || !consumePotionFromInventory(potionId,1)){
                return;
            }

            const planned=definition.recoveryPercent>=100
                ? maxValue-currentValue
                : Math.max(1,Math.round(maxValue*definition.recoveryPercent/100));
            const recovered=Math.max(0,Math.min(maxValue-currentValue,planned));

            if(resource==="hp"){
                character.hp=Math.min(maxValue,character.hp+recovered);
            }else{
                character.sp=Math.min(maxValue,character.sp+recovered);
            }

            addBattleLog(
                "戰鬥結束後，"+(character.id||"角色")+
                "自動使用"+definition.name+"，恢復"+recovered+" "+resource.toUpperCase()+"。"
            );
        });
    });

    rebuildInventorySlots();
}


function winBattle(){

    if(!battleActive){
        return;
    }


    battleActive=false;

    autoBattle=false;

    actionReady=false;

    pendingAction=null;


    clearInterval(timerId);

    timerId=null;

    if(battleAdvanceTimeoutId){
        clearTimeout(battleAdvanceTimeoutId);
        battleAdvanceTimeoutId=null;
    }
    clearBattleActionWatchdog();
    battleAdvanceScheduled=false;


    battleToken++;


    /*
       ★ 新增（依照使用者要求，每日任務
       「打贏1場戰鬥」）：勝利結算這裡是
       唯一會經過的地方，直接記錄進度。
    */

    ensureDailyQuestsCurrent();

    dailyQuestState.progress.winBattle=
        Math.min(
            1,
            (
                dailyQuestState.progress.winBattle||
                0
            )+1
        );


    /*
       ★ 新增：委託任務「打贏3場戰鬥」，
       同一個事件來源一起累加。
    */

    commissionQuestState.progress.winBattle=
        Math.min(

            commissionQuestDefinitions.find(
                q=>q.id==="winBattle"
            ).goal,

            (
                commissionQuestState.progress.winBattle||
                0
            )+1

        );


    /*
       ★ 修正（同一個問題的另一半）：
       跟loseBattle()一樣，勝利結算也完全沒有
       收合可能還開著的子選單，一樣補上。
    */

    closeMenus();


    addBattleLog(
        "所有怪物已被擊敗！"
    );


    const expGain =
        currentBattleMonsters
        .reduce(
            (total,i)=>
                total+
                monsters[i].level*10,
            0
        );


    /*
       ★ 戰鬥中絕對不能升級。
       EXP先進入「共用經驗池」，
       等玩家回到主城自行按「分配經驗值」
       才會真正判斷升級。
    */

    sharedExp +=
        expGain;


    addBattleLog(
        "獲得"+
        expGain+
        "EXP，已存入經驗池。"
    );

    applyPostBattleAutoRecovery();


    /*
       ★ 修正：
       原本 EXP 提示（黃色浮動訊息）
       在戰鬥畫面結束當下就立刻跳出來，
       跟戰鬥畫面重疊在一起很亂。
       改成等畫面真的切回地圖之後才顯示，
       放進下面 showPage("map") 那個
       setTimeout callback 裡面。
    */


    /*
       ★ 修正：
       原本這裡打贏就會自動把HP/SP補滿，
       這是最早規格寫的（回血/回SP），
       但實際玩起來會讓HP/SP藥水完全沒有意義——
       反正打完就全滿，藥水根本不用用。

       改成：打贏之後HP/SP維持戰鬥結束當下的數值，
       不會自動補滿，要嘛帶藥水，
       要嘛之後補一個「回主城休息回血」的功能。

       戰鬥「失敗」被擊敗的補血邏輯維持不變
       （那個比較像是「重生」的概念，
       跟這裡打贏補血不是同一件事，
       故意留著沒有一起拿掉）。
    */


    clearTimeout(respawnId);


    /*
       ★ 縮短怪物重生時間：
       原本5秒，配合現在移動已經解鎖，
       玩家馬上就能在地圖上走動，
       但怪物還要等5秒才出現，
       畫面會有一段時間感覺空空的。
       改成2秒，體感上落差小很多。
    */

    respawnId =
        setTimeout(
            respawnMonsters,
            2000
        );


    saveGame();


    /*
       ★ 修正：
       之前為了解決「回地圖後怪物空了好一陣子」
       把這裡壓到250ms，
       但這樣戰鬥結束幾乎是瞬間跳走，
       文字RPG看不到「打贏了」的訊息跟獲得的EXP，
       完全沒有停留感。

       現在「怪物消失太久」跟「移動被卡住」
       已經用別的方式解決了（respawn縮到2秒、
       移動不再被mapCooldown卡住），
       所以這裡可以放心拉長，
       讓玩家有時間看清楚戰鬥資訊裡的結果。
    */

    setTimeout(()=>{

        showPage("map");

        setMapCooldown(3000);


        startMonsterMovement();

        scheduleAutoPatrolCheck(5000);

        updateUI();


        showExpToast(
            expGain
        );


        /*
           ★ 新增：沒藥水自動回主城。
           只要第一角色或第二角色有勾選這個設定，
           戰鬥結束回到地圖之後，
           檢查身上HP/SP藥水是不是都用完了，
           都用完的話直接飛回主城，
           不用玩家自己記得要回去補貨。
        */

        checkAutoReturnToCity();

    },2200);

}


/*
   ★ 新增：沒藥水自動回主城的偵測。
   藥水是玩家帳號共用的單一庫存
   （不是每個角色各自帶一份），
   只要任一角色有開啟這個設定，
   身上HP、SP藥水都用完了，
   就自動離開地圖、飛回主城。
*/

function checkAutoReturnToCity(){

    const shouldCheck=

        autoConfig.returnToCityWhenEmpty ||
        (
            player2 &&
            autoConfig2.returnToCityWhenEmpty
        ) ||
        (
            player3 &&
            autoConfig3.returnToCityWhenEmpty
        );


    if(!shouldCheck){
        return;
    }


    if(
        getTotalPotionCount()>0
    ){
        return;
    }


    stopMonsterMovement();


    showPage(
        "home"
    );


    alert(
        "HP／SP藥水都用完了，已自動返回主城。"
    );

}


function loseBattle(){

    if(!battleActive){
        return;
    }


    battleActive=false;

    autoBattle=false;

    actionReady=false;

    pendingAction=null;


    clearInterval(timerId);

    timerId=null;

    if(battleAdvanceTimeoutId){
        clearTimeout(battleAdvanceTimeoutId);
        battleAdvanceTimeoutId=null;
    }
    clearBattleActionWatchdog();
    battleAdvanceScheduled=false;


    battleToken++;


    /*
       ★ 修正（真的抓到「畫面下方留下一大截空白」
       的其中一個原因）：
       戰敗結算完全沒有把可能還開著的子選單
       （例如物品欄的HP/SP藥水選單）收合，
       如果戰敗的當下剛好選單是開著的，
       它就會卡在打開的狀態，變成畫面上
       一大塊看起來像「空白」的區域，
       其實是一個內容看起來空空的選單卡在那裡。
       這裡補上closeMenus()，確保戰敗畫面
       乾淨、不會殘留任何選單。
    */

    closeMenus();


    addBattleLog(
        "你被擊敗了……"
    );


    const stats =
        getMainCharacterStats();


    player.hp =
        stats.maxHP;


    player.sp =
        stats.maxSP;


    /*
       ★ 新增：
       第一角色戰敗會被「救回」重生補滿HP/SP，
       第二角色原本沒有跟著一起處理，
       會帶著戰鬥中殘留的低血量進到下一場戰鬥，
       跟第一角色的體驗不一致。
       這裡讓他跟著一起補滿。
    */

    if(player2){

        const stats2=
            getPlayer2BattleStats();


        player2.hp=
            stats2.maxHP;


        player2.sp=
            stats2.maxSP;

    }

    if(player3){

        const stats3=getPartyBattleStats(2);
        player3.hp=stats3.maxHP;
        player3.sp=stats3.maxSP;

    }


    setTimeout(()=>{

        showPage("map");

        setMapCooldown(3000);


        startMonsterMovement();

        scheduleAutoPatrolCheck(5000);

        updateUI();

    },2200);

}


function attemptEscape(){

    /*
       ★ 修正：
       原本只檢查全域的autoBattle，
       改成看目前是誰的回合、
       用對應角色的自動開關來判斷
       （逃脫是整個隊伍一起逃，
       但操作時機還是要跟目前回合的
       手動/自動狀態一致，
       不然自動角色行動中途還能被逃脫按鈕打斷）。
    */

    const autoOn=
        activeBattleCharacterIndex===0
        ? autoBattle
        : getPartyAutoConfig(activeBattleCharacterIndex).enabled;


    if(
        !battleActive ||
        autoOn ||
        actionReady
    ){
        return;
    }


    /*
       ★ 修正（真的抓到兩個bug，都是使用者指出的）：

       1. 這裡原本沒有設定actionReady=true，
          防呆形同虛設，快速連點會一直重新
          判定逃脫成功率，直到成功為止——
          正確行為應該是「這回合只能嘗試一次」，
          點下去之後不管結果如何都要鎖住。

       2. 逃脫原本是「按下去立刻判定」，
          完全跳過宣告/結算機制。
          使用者明確指出：逃脫也要看敏捷——
          敏捷夠快的角色先攻擊，
          敏捷慢的角色才輪到嘗試逃脫，
          如果敏捷太低、逃脫還沒輪到自己
          就先被打死，那也是合理的結果，
          不應該讓逃脫變成「不受敏捷限制的特權」。

       改成跟其他行動一樣先宣告、
       結算階段才依敏捷順序真正判定逃脫成不成功。
    */

    actionReady=true;


    queuedPlayerActions[
        activeBattleCharacterIndex
    ]={

        action:"escape",

        target:null

    };


    updateUI();

    finishPlayerAction();

}


/*
   ★ 新增：逃脫的真正判定，
   只在結算階段被resolveQueuedPlayerAction()呼叫，
   邏輯完全比照原本attemptEscape()裡的判定式，
   只是抽出來給結算階段用。
*/

function resolveEscapeAttempt(characterIndex){

    clearInterval(timerId);


    const alive =
        currentBattleMonsters
        .map(
            i=>monsters[i]
        )
        .filter(
            m=>m.alive
        );


    if(alive.length===0){

        checkBattleEnd();

        return;

    }


    const highestLevel =
        Math.max(
            ...alive.map(
                m=>m.level
            )
        );


    const escapingCharacter=getPartyCharacterByIndex(characterIndex)||player;

    const chance =
        Math.max(
            10,
            Math.min(
                95,
                50+
                (
                    escapingCharacter.level-
                    highestLevel
                )*5
            )
        );


    if(
        Math.random()*100<
        chance
    ){

        battleActive=false;

        autoBattle=false;

        battleToken++;


        addBattleLog(
            "成功逃脫！"
        );


        setTimeout(()=>{

            showPage("map");

            setMapCooldown(3000);


            startMonsterMovement();

            ensureAutoPatrolInterval();

        },1400);

    }
    else{

        addBattleLog(
            "逃脫失敗！"
        );


        finishPlayerAction();

    }

}


/* =====================================================
   技能選單
===================================================== */

function openSkillMenu(){

    /*
       ★ 修正：
       原本這裡永遠讀characterSkillLoadouts.fire、
       永遠檢查全域的autoBattle跟player.sp，
       現在改成依照activeBattleCharacterIndex
       決定要顯示誰的技能欄、誰的SP。
    */

    const autoOn=
        activeBattleCharacterIndex===0
        ? autoBattle
        : getPartyAutoConfig(activeBattleCharacterIndex).enabled;


    if(
        !battleActive ||
        autoOn
    ){
        return;
    }


    const activeCharacterId=
        getPartyCharacterKey(activeBattleCharacterIndex);

    const activeCharacterObj=
        getPartyCharacterByIndex(activeBattleCharacterIndex);


    const character =
        characterSkillLoadouts[
            activeCharacterId
        ];


    if(
        !character ||
        !activeCharacterObj
    ){
        return;
    }


    const menu =
        $("skillMenu");


    menu.innerHTML="";


    /*
       ★ 新增：展開模式的置頂返回按鈕。
       放在清單最上面，展開之後不用滑到最下面
       才找得到返回，一打開就看得到。
    */

    const pinnedBack=
        document.createElement(
            "button"
        );


    pinnedBack.className=
        "sub-menu-pinned-back";


    pinnedBack.textContent=
        "返回";


    pinnedBack.onclick=
        closeMenus;


    menu.appendChild(
        pinnedBack
    );


    character.equippedSkills
    .forEach(skillId=>{

        const skill =
            skillDatabase[skillId];


        if(!skill){
            return;
        }


        const skillLevel =
            getSkillLevel(
                activeCharacterId,
                skillId
            );


        const spCost =
            skill.spCost!==undefined
            ?
            skill.spCost
            :
            skill.cost;


        const enoughSP =
            activeCharacterObj.sp>=
            spCost;


        const button =
            document.createElement(
                "button"
            );


        button.className =
            "sub-button";


        if(!enoughSP){

            button.classList.add(
                "skill-sp-insufficient"
            );


            button.disabled=true;


            button.innerHTML =

            `
            <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;">
                <span style="font-size:15px;font-weight:bold;">
                    ${skill.name}
                    ${
                        skillLevel>0
                        ?
                        "Lv."+skillLevel
                        :
                        ""
                    }
                </span>
                <span style="font-size:11px;color:#93c5fd;white-space:nowrap;">
                    ${activeCharacterObj.sp}/${spCost} SP
                </span>
            </div>
            <div style="font-size:11px;color:#fca5a5;margin-top:2px;">
                SP不足
            </div>
            `;

        }
        else{

            const damagePreview =
                skill.baseDamage
                ?
                "傷害約"+
                getSkillDamageAtLevel(
                    skill,
                    skillLevel||1
                )+
                "｜"
                :
                "";


            button.innerHTML =

            `
            <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;">
                <span style="font-size:15px;font-weight:bold;">
                    ${skill.name}
                    ${
                        skillLevel>0
                        ?
                        "Lv."+skillLevel
                        :
                        ""
                    }
                </span>
                <span style="font-size:11px;color:#93c5fd;white-space:nowrap;">
                    ${spCost} SP
                </span>
            </div>
            <div style="font-size:11px;color:#d1d5db;margin-top:2px;">
                ${damagePreview}${skill.description}
            </div>
            `;


            button.onclick=()=>{
                prepareAction(
                    skill.id
                );
            };

        }


        menu.appendChild(
            button
        );

    });


    const back =
        document.createElement(
            "button"
        );


    back.className =
        "sub-button";


    back.textContent =
        "返回";


    back.onclick =
        closeMenus;


    menu.appendChild(
        back
    );


    $("mainBattleMenu")
        .style.display =
        "none";


    $("itemMenu")
        .classList
        .remove("show");


    $("skillMenu")
        .classList
        .add("show");


    /*
       ★ 展開技能選單，蓋住怪物區/回合資訊/
       戰鬥紀錄那一塊，讓玩家在比較大的版面上
       挑技能，選完或按返回會自動收合
       （收合邏輯在closeMenus()）。
    */

    $("skillMenu")
        .classList
        .add("expanded");

}


function openItemMenu(){

    if(
        !battleActive ||
        autoBattle
    ){
        return;
    }

    /* 戰鬥背包是獨立覆蓋層，不再用舊 expanded 幾何。 */
    const quickBar=$("skillQuickBar");
    if(quickBar){
        quickBar.classList.remove("show");
    }

    $("skillMenu")
        .classList
        .remove("show");

    $("skillMenu")
        .classList
        .remove("expanded");

    battleItemCategory="potion";
    renderBattleItemMenu();

    $("itemMenu")
        .classList
        .add("show");

    syncTurnTimerWithBattlePickers();

}


function closeMenus(){

    const quickBar=
        $("skillQuickBar");

    if(quickBar){
        quickBar.classList.remove(
            "show"
        );
    }

    $("skillMenu")
        .classList
        .remove("show");

    $("skillMenu")
        .classList
        .remove("expanded");

    const itemMenu=$("itemMenu");
    if(itemMenu){
        itemMenu.classList.remove("show");
    }

    syncTurnTimerWithBattlePickers();

}


/* =====================================================
   藥水
===================================================== */

/*
   ★ 新增：防禦。

   選擇防禦的話，本回合不攻擊，
   但接下來怪物攻擊階段對這個角色造成的傷害
   會再打5折（跟防禦力減傷疊加，不是取代）。
   效果持續到這個角色自己的下一回合開始為止
   （beginCharacterTurn()裡會清掉這個標記）。

   跟usePotion()一樣不用選目標，
   點下去直接生效、結束這個角色的行動。
*/

/*
   ★ 修正：
   把「真正執行防禦」的邏輯抽成獨立函式，
   手動按防禦鈕（useDefend()，有防呆檔住自動模式下誤觸）
   跟自動戰鬥設定成防禦（autoAction()裡直接呼叫）
   兩條路徑共用這個核心邏輯，
   不會出現「自動模式设成防禦卻被防呆擋住不生效」的問題。
*/

/*
   ★ 修正（真的抓到一個bug）：
   player2的自動攻擊/技能（player2NormalAttack、
   castPlayer2Skill）都不會自己呼叫
   finishPlayerAction()——由beginCharacterTurn()
   的自動分派邏輯統一在外面呼叫一次。

   如果這裡的防禦也在內部呼叫finishPlayerAction()，
   外面那個「呼叫完player2AutoAction()
   之後再呼叫一次finishPlayerAction()」的邏輯
   會變成呼叫兩次，導致行動順序被跳號、
   角色索引錯亂。

   所以拆成兩層：
   setDefendingState()只負責「設定防禦狀態+記錄」，
   不管進不進度；
   applyDefendEffect()是給「會自己負責結束行動」
   的呼叫者用（手動防禦、player1自動防禦），
   內部才呼叫finishPlayerAction()。
   player2AutoAction()的防禦分支則直接呼叫
   setDefendingState()，讓外層統一呼叫
   finishPlayerAction()，維持跟其他player2
   自動行動路徑一致的呼叫方式。
*/

function setDefendingState(characterIndex){
    const activeCharacter=
        getPartyCharacterByIndex(characterIndex);


    if(!activeCharacter){
        return;
    }


    activeCharacter.isDefending=
        true;


    /*
       ★ 修正（依照使用者要求）：
       這裡原本會額外印一行「擺出防禦姿態，
       本回合受到的傷害減半」，
       使用者覺得沒必要——防禦有沒有生效，
       應該直接反映在「被攻擊時的那一行」，
       標註「（防禦狀態傷害減半）」就夠了，
       不需要另外多一行事先宣告的訊息。
       這裡拿掉這行log，效果本身
       （isDefending=true）還是照常套用。
    */

    updateUI();

}


function applyDefendEffect(characterIndex){

    setDefendingState(
        characterIndex
    );


    finishPlayerAction();

}


function useDefend(){
    const autoOn=
        activeBattleCharacterIndex===0
        ? autoBattle
        : getPartyAutoConfig(activeBattleCharacterIndex).enabled;

    const activeCharacter=
        getPartyCharacterByIndex(activeBattleCharacterIndex);


    if(
        !battleActive ||
        autoOn ||
        actionReady ||
        !activeCharacter ||
        activeCharacter.hp<=0
    ){
        return;
    }


    /*
       ★ 修正（真的抓到兩個bug）：

       1. 這裡原本只「檢查」actionReady，
          從來沒有「設定」actionReady=true，
          等於這道防呆形同虛設——
          手指按快一點，第二次點擊會在
          finishPlayerAction()真正把狀態鎖住之前
          就先闖關成功，導致同一個角色的行動
          被宣告兩次、進度被推進兩次，
          後面的角色/怪物的執行順序就整個錯亂，
          這正是「怪物攻擊兩次」背後的真正原因。

       2. 角色已經死亡（HP<=0）還是能按防禦，
          這裡也一併補上防呆。

       這裡在真正生效之前立刻鎖住actionReady，
       第二次點擊會直接被上面那道guard擋下來。
    */

    actionReady=true;


    /*
       ★ 修正（重要，依照使用者明確指正）：
       防禦之前是「按了就立刻生效」，
       跳過宣告/結算流程。
       現在改成跟其他行動一樣先宣告、
       等結算階段照敏捷順序才真正生效——
       雖然防禦本身「保護的是接下來受到的傷害」，
       不太受順序影響，但玩家明確要求
       「所有行動都要遵循同一套宣告/結算機制」，
       不要有防禦這種特例，這裡就照做。
    */

    queuedPlayerActions[
        activeBattleCharacterIndex
    ]={

        action:"defend",

        target:null

    };


    updateUI();

    finishPlayerAction();

}


function usePotion(potionId){

    /*
       V91：戰鬥宣告直接記住「哪一瓶」藥水，
       不再只記 hp/sp 類型。真正扣背包數量與
       百分比恢復仍留在敏捷排序後的結算階段。
    */

    const definition=getPotionDefinition(potionId);

    if(!definition){
        return;
    }

    const autoOn=
        activeBattleCharacterIndex===0
        ? autoBattle
        : getPartyAutoConfig(activeBattleCharacterIndex).enabled;

    if(
        !battleActive ||
        autoOn ||
        actionReady
    ){
        return;
    }

    const activeCharacter=
        getPartyCharacterByIndex(activeBattleCharacterIndex);

    if(
        !activeCharacter ||
        activeCharacter.hp<=0
    ){
        return;
    }

    if(getPotionCount(potionId)<=0){
        addBattleLog(
            definition.name+
            "目前沒有庫存。"
        );
        renderBattlePotionMenu();
        return;
    }

    const stats=
        getPartyBattleStats(activeBattleCharacterIndex);

    if(
        definition.resource==="hp" &&
        activeCharacter.hp>=stats.maxHP
    ){
        addBattleLog("HP已經是滿的。");
        return;
    }

    if(
        definition.resource==="sp" &&
        activeCharacter.sp>=stats.maxSP
    ){
        addBattleLog("SP已經是滿的。");
        return;
    }

    actionReady=true;

    queuedPlayerActions[
        activeBattleCharacterIndex
    ]={
        action:"potion",
        potionId:potionId,
        target:null
    };

    closeMenus();
    updateUI();
    finishPlayerAction();
}


function applyPotionEffect(potionId,characterIndex){

    const definition=getPotionDefinition(potionId);

    if(!definition){
        addBattleLog("找不到這個藥水資料。");
        finishPlayerAction();
        return;
    }

    const activeCharacter=
        getPartyCharacterByIndex(characterIndex);

    if(!activeCharacter){
        finishPlayerAction();
        return;
    }

    const stats=
        getPartyBattleStats(characterIndex);

    const maxValue=
        definition.resource==="hp"
        ? stats.maxHP
        : stats.maxSP;

    const currentValue=
        definition.resource==="hp"
        ? activeCharacter.hp
        : activeCharacter.sp;

    if(currentValue>=maxValue){
        addBattleLog(
            (definition.resource==="hp" ? "HP" : "SP")+
            "已經是滿的。"
        );
        finishPlayerAction();
        return;
    }

    if(getPotionCount(potionId)<=0){
        addBattleLog(
            definition.name+
            "目前沒有庫存。"
        );
        finishPlayerAction();
        return;
    }

    let plannedRecovery;

    if(definition.recoveryPercent>=100){
        plannedRecovery=maxValue-currentValue;
    }else{
        plannedRecovery=Math.max(
            1,
            Math.round(
                maxValue*
                definition.recoveryPercent/
                100
            )
        );
    }

    const recovered=Math.max(
        0,
        Math.min(
            maxValue-currentValue,
            plannedRecovery
        )
    );

    if(recovered<=0){
        finishPlayerAction();
        return;
    }

    if(!consumePotionFromInventory(potionId,1)){
        addBattleLog(
            definition.name+
            "扣除失敗。"
        );
        finishPlayerAction();
        return;
    }

    if(definition.resource==="hp"){
        activeCharacter.hp=Math.min(
            stats.maxHP,
            activeCharacter.hp+recovered
        );

        showPlayerHit(
            recovered,
            "heal",
            characterIndex,
            true
        );
    }else{
        activeCharacter.sp=Math.min(
            stats.maxSP,
            activeCharacter.sp+recovered
        );

        showPlayerHit(
            recovered,
            "sp",
            characterIndex,
            true
        );
    }

    addBattleLog(
        (activeCharacter.id||"你")+
        "使用"+
        definition.name+
        "，恢復"+
        recovered+
        " "+
        definition.resource.toUpperCase()+
        "。"
    );

    updateUI();
    saveGame();
    finishPlayerAction();
}


/* =====================================================
   自動戰鬥
===================================================== */

function toggleAutoBattle(){

    /*
       ★ 修正（依照使用者要求，讓巡邏頁面的
       自動戰鬥按鈕也能用）：
       原本這裡開頭就是「不在戰鬥中就直接
       return」，導致在地圖／巡邏頁面按這顆
       按鈕完全沒有任何反應——但玩家會想在
       戰鬥之外，先把「下一場戰鬥要不要自動」
       這個偏好設定好，不需要真的人在戰鬥裡
       才能調整。

       拿掉這個開頭的擋板之後，下面的邏輯
       （改autoBattle、同步autoConfig.enabled／
       autoConfig2.enabled、更新按鈕文字、
       寫一行戰鬥紀錄）在不在戰鬥中執行都是
       安全的——autoConfig.enabled本來就是
       「下一場戰鬥要沿用的設定」，startBattle()
       開新戰鬥時會自己讀這個值，所以在戰鬥外
       調整，效果就是「先設定好，下一場自動生效」，
       跟原本設計的用途完全一致。
       最下面那段「宣告階段安全接手」的邏輯
       本身有battlePhase／battleActive雙重檢查，
       不在戰鬥中執行也不會有任何副作用。
    */

    autoBattle =
        !autoBattle;


    /*
       ★ 新增（依照使用者要求）：
       切換自動戰鬥的當下，立刻重新判斷
       回合資訊列／戰鬥指令按鈕要不要顯示——
       打開自動戰鬥時應該馬上藏起來（不用
       等到下一次declare/resolve切換才生效），
       關掉恢復手動時，如果現在剛好是宣告
       階段、輪到玩家自己選，也要立刻顯示
       出來，不能讓玩家對著藏起來的按鈕
       不知道要點哪裡。
    */

    updateActionHudVisibility();


    /*
       ★ 修正：
       原本這裡只改了本場戰鬥用的 autoBattle，
       沒有同步回 autoConfig.enabled，
       導致下一場戰鬥開始時
       startBattle() 會用主城設定的
       autoConfig.enabled 重新覆蓋，
       如果玩家沒有另外去主城勾選，
       第二場就會變回手動，看起來像「自動戰鬥失效」。
       這裡同步更新設定，並且順便同步
       主城那個checkbox的畫面，
       這樣切換一次之後之後每一場都會沿用。
    */

    autoConfig.enabled =
        autoBattle;


    /*
       ★ 修正（真的抓到一個bug）：
       這裡原本完全沒有動到autoConfig2.enabled，
       等於這顆共用的「啟動/停止」按鈕
       永遠只控制第一角色，
       第二角色的自動戰鬥開關從頭到尾沒被碰過，
       一直維持在預設的關閉狀態——
       這正是「只有青墨東皇會自動，青水不會」
       的真正原因。

       現在只有一顆共用按鈕，沒有另外的
       per-character開關可以分別按，
       合理的行為應該是「一鍵讓整隊都自動/都手動」，
       所以這裡讓第二角色（如果存在）
       跟著第一角色的狀態一起切換。
    */

    if(player2){

        autoConfig2.enabled=
            autoBattle;

    }

    if(player3){

        autoConfig3.enabled=
            autoBattle;

    }


    const homeCheckbox =
        $("autoEnabled");


    if(homeCheckbox){

        homeCheckbox.checked =
            autoBattle;

    }


    const player2Checkbox=
        $("autoEnabledPlayer2");


    if(player2Checkbox){

        player2Checkbox.checked=
            autoBattle;

    }


    actionReady=false;

    pendingAction=null;

    if(autoBattle){
        clearBattleTargetSelectionMode();
        clearActiveCharacterHighlight();
    }
    else if(
        battleActive &&
        battlePhase==="declare"
    ){
        /* V95：從自動切回手動時，不重新啟動回合、
           不改 activeBattleCharacterIndex；直接用當下真正
           正在等待操作的角色顯示粗黃框與技能列。 */
        clearBattleTargetSelectionMode();
        updateActiveCharacterHighlight();
        populateSkillQuickBar();
    }


    updateAutoButton();


    addBattleLog(

        autoBattle
        ?
        "自動戰鬥開始（下一場也會沿用此設定）。"
        :
        "⏹ 已停止自動戰鬥。"

    );


    /*
       ★ 修正（真的抓到了，這次的除錯訊息
       直接把兇手抓出來了）：

       這裡原本「重新啟動自動戰鬥時，
       400ms後強制呼叫一次autoAction()」，
       是很早之前為了解決「自動戰鬥卡住」
       留下的權宜之計——但autoAction()
       是「第一角色宣告階段」專用的函式，
       這裡完全沒有檢查當下：
       - 現在是宣告階段還是結算階段
         （battlePhase）
       - 現在真的輪到第一角色宣告嗎
         （activeBattleCharacterIndex）
       - 自然的流程本身是不是根本沒卡住，
         只是玩家自己手癢按了停止/啟動

       只要玩家在宣告階段但輪到「清水戰」
       宣告時按了停止又啟動，400ms後這段
       會不管三七二十一直接呼叫autoAction()
       （幫第一角色宣告一次、並呼叫一次
       finishPlayerAction()），等於在
       activeBattleCharacterIndex還沒真正
       輪到第一角色的情況下，硬是把它往前
       多推了一步——這正是「宣告階段莫名其妙
       多出一次finishPlayerAction()、
       清水戰的宣告被跳過、queued變空」
       的真正原因。如果剛好發生在結算階段，
       一樣會讓initiativeIndex被多推一步，
       跳過該輪到的下一位。

       現在已經把「手動/自動模式下，SP不足、
       尚未學習等分支漏呼叫finishPlayerAction()」
       這些真正會讓流程卡死的漏洞都補上了，
       正常情況下自然的宣告/結算鏈不會再
       無聲卡住，這個「外部硬踢一次」的
       權宜之計已經不需要、而且是主動的
       危害來源，直接拿掉。

       切換自動戰鬥現在只單純改
       autoBattle/autoConfig這些狀態旗標，
       下一次beginCharacterTurn()自然執行到
       的時候，會自己讀到新的autoOn值、
       正確判斷要不要自動出手。

       ★ 但（依照使用者實測回報，補回一個
       合理但要做對的行為）：
       如果切換的當下，剛好卡在「宣告階段，
       正在等某個角色手動輸入」（那個角色的
       20秒計時器正在跑），玩家把自動打開，
       直覺會期待「這個正在等我的角色，
       現在馬上自動幫我選」——不能什麼都不做，
       不然要嘛只能等20秒逾時、要嘛得先做完
       這輪手動選擇，自動開關看起來像沒反應。

       這裡跟拿掉的舊版最大差別：
       1. 只接手「當下正在等待、且剛被切成
          自動」的那一位，不會不分青紅皂白
          永遠呼叫player1的autoAction()。
       2. 執行前用closure記住當下的
          battleToken、battlePhase、
          activeBattleCharacterIndex，
          setTimeout真正執行的那一刻，
          三個條件都要重新核對一次沒有變過
          （token沒換新戰鬥、還是宣告階段、
          還是同一個角色在等）——如果玩家
          在這400ms內自己手動選完了，
          或流程本來就自然繼續往下走了，
          這裡的核對會失敗，直接什麼都不做，
          不會發生「已經有人選過了，這裡
          又硬插一次」的重複推進。
    */

    if(
        autoBattle &&
        battlePhase==="declare"
    ){

        const expectedToken=
            battleToken;

        const expectedCharacterIndex=
            activeBattleCharacterIndex;

        setTimeout(()=>{

            if(
                !battleActive ||
                battleToken!==
                expectedToken ||
                battlePhase!==
                "declare"||
                activeBattleCharacterIndex!==
                expectedCharacterIndex
            ){
                return;
            }


            try{

                autoActionForCharacter(
                    expectedCharacterIndex,
                    expectedToken
                );

            }
            catch(error){

                console.error(
                    "切換自動戰鬥時接手宣告發生例外：",
                    error
                );

            }

        },400);

    }

}


function updateAutoButton(){

    /*
       ★ 修正（依照使用者指定版面）：
       啟動之後按鈕文字改成「停止」、
       加上active的紅色樣式；
       左邊的標籤文字也要跟著換成「自動戰鬥中」。
    */

    const button=
        $("autoBattleButton");


    if(button){

        button.textContent=

            autoBattle
            ?
            "⏹ 停止"
            :
            "▶ 啟動";


        button.classList.toggle(
            "active",
            autoBattle
        );

    }


    const label=
        $("autoBattleLabel");


    if(label){

        label.textContent=

            autoBattle
            ?
            "自動戰鬥中"
            :
            "自動戰鬥";

    }


    /*
       ★ 新增（依照使用者要求，巡邏頁面的
       自動戰鬥面板）：
       跟上面同一套邏輯，同步更新巡邏頁面
       那份自動戰鬥按鈕/標籤，確保兩邊
       顯示的狀態永遠一致，不會出現戰鬥
       頁面顯示「停止」、巡邏頁面卻還顯示
       「啟動」這種不同步的情況。
    */

    const mapButton=
        $("mapAutoBattleButton");


    if(mapButton){

        mapButton.textContent=

            autoBattle
            ?
            "⏹ 停止"
            :
            "▶ 啟動";


        mapButton.classList.toggle(
            "active",
            autoBattle
        );

    }


    const mapLabel=
        $("mapAutoBattleLabel");


    if(mapLabel){

        mapLabel.textContent=

            autoBattle
            ?
            "自動戰鬥中"
            :
            "自動戰鬥";

    }


    /*
       ★ 新增（依照使用者要求，「巡怪頁面
       左上角新增小按鈕，自動戰鬥快捷開啟/
       停止」）：
       跟上面兩顆按鈕同一套邏輯，同步更新
       左上角這顆小快捷鈕，確保三個地方
       （戰鬥頁面/地圖覆蓋層/左上角快捷鈕）
       永遠顯示一致的狀態。這顆現在改成
       純圖示鈕（開/關各一張上傳的icon圖），
       不再放文字，改用active這個class
       切換要顯示哪一張圖（見CSS
       .map-quick-toggle-btn .icon-on／
       .icon-off），並附帶aria-label方便
       無障礙閱讀，不能直接寫textContent
       （那樣會把裡面的<img>子元素整個
       洗掉，圖示會消失）。
    */

    const quickBattleBtn=
        $("quickAutoBattleToggle");


    if(quickBattleBtn){

        quickBattleBtn.setAttribute(
            "aria-label",

            autoBattle
            ?
            "自動戰鬥（開啟中）"
            :
            "自動戰鬥（關閉）"
        );


        quickBattleBtn.classList.toggle(
            "active",
            autoBattle
        );

    }

}


/*
   ★ 新增：自動戰鬥詳細設定面板（展開版）。

   openAutoBattleSettings()：展開面板，
   預設先顯示玩家1的設定。

   switchAutoSettingsCharacter()：切換角色時，
   重新填入「自動行動」下拉選單
   （普通攻擊/防禦/該角色裝備的技能），
   並載入該角色目前的HP%/SP%/自動回城設定。

   confirmAutoBattleSettings()：把表單上的值
   寫回對應角色的autoConfig/autoConfig2，存檔，收起面板。

   closeAutoBattleSettings()：不儲存，直接收起面板。
*/

/*
   ★ 新增：記住自動戰鬥設定面板原本
   （在battlePage裡）的位置，openAutoBattleSettings()
   把它暫時搬到document.body底下時記錄，
   closeAutoBattleSettings()關閉時依照這兩個值
   搬回原位。
*/

let autoSettingsOriginalParent=
    null;

let autoSettingsOriginalNextSibling=
    null;


function openAutoBattleSettings(){

    const panel=
        $("autoBattleSettingsPanel");


    if(!panel){
        return;
    }


    /*
       ★ 新增（依照使用者要求，讓地圖／巡邏
       頁面的「設定」按鈕也能用）：
       這個面板原本是battlePage底下的
       子元素，不在戰鬥中的時候battlePage
       整個display:none，就算把面板自己的
       display改掉，也會被沒有display的
       祖先蓋住看不見——這正是「設定按鈕
       沒反應」的真正原因。

       這裡在「不在戰鬥中」的情況下，把面板
       這個DOM節點暫時搬到document.body底下
       （逃出battlePage那層display:none），
       並套用上面新增的floating-modal樣式
       （改成position:fixed、自己定位）。
       搬走之前先記住原本的位置
       （autoSettingsOriginalParent／
       autoSettingsOriginalNextSibling），
       closeAutoBattleSettings()裡會依照
       這兩個值把它搬回battlePage原本的
       位置，不會讓它從此消失在battlePage裡。
    */

    if(
        !battleActive &&
        panel.parentNode!==
        document.body
    ){

        autoSettingsOriginalParent=
            panel.parentNode;

        autoSettingsOriginalNextSibling=
            panel.nextSibling;


        document.body.appendChild(
            panel
        );


        panel.classList.add(
            "floating-modal"
        );

    }


    const characterSelect=
        $("autoSettingsCharacterSelect");


    if(characterSelect){

        /*
           ★ 修正（依照使用者指正）：
           下拉選項原本寫死顯示「玩家1」「玩家2」，
           那只是我說明時舉例用的代稱，
           使用者要的其實是「角色自己的ID」，
           這裡改成動態帶入player.id/player2.id。
        */

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

        }


        /*
           玩家2還沒創建的話，
           下拉選單裡先不給選，
           避免選到一個不存在的角色。
        */

        if(option1){

            option1.disabled=

                !player2;

        }


        characterSelect.value="0";

    }


    /*
       ★ 剛打開面板，畫面欄位是上次殘留的內容，
       不是玩家正在編輯的東西，這裡傳true
       跳過「存回上一個角色」那一步。
    */

    switchAutoSettingsCharacter(true);


    /*
       ★ 修正（依照使用者要求，重新設計）：
       設定面板改成真正的「最上層覆蓋」，
       範圍是「怪物卡牌下緣」到「人物卡牌下緣」，
       不再依賴CSS去猜這個範圍該多高——
       直接用JS量出這兩個邊界的實際螢幕座標，
       用position:fixed精準對齊，
       疊放順序拉到最高，確保一定會蓋在
       所有東西的最上面。
    */

    /*
       ★ 修正（真正抓到「設定跑到最上面」的
       原因）：
       這段量測「怪物卡牌下緣～人物卡牌下緣」
       再用行內樣式定位的邏輯，是為了戰鬥
       頁面內設計的，卻沒有判斷「現在到底是
       不是在戰鬥頁面」——在地圖／巡邏頁面
       打開設定時，.battle-monsters／
       .battle-player-row這兩個元素雖然還在
       DOM裡，但battlePage整層display:none，
       display:none的元素getBoundingClientRect()
       量出來一律是{top:0,bottom:0,...}，
       等於這裡會把panel.style.top硬設成
       "0px"、height設成"0px"——而且這是
       行內樣式，優先權比floating-modal那個
       CSS class還高，就算class有正確套用，
       也會被這裡的行內樣式蓋過去，這才是
       設定面板跑到畫面最上面、看起來空空的
       真正原因。

       改成只有「真的在戰鬥中」才執行這段
       量測定位；不在戰鬥中（地圖頁面打開）
       的話完全跳過，交給floating-modal
       那個class自己的position:fixed／
       bottom:80px去定位，不會再被這裡的
       行內樣式蓋掉。
    */

    if(battleActive){

        const monsterArea=
            document.querySelector(
                ".battle-monsters"
            );


        const playerRow=
            document.querySelector(
                ".battle-player-row"
            );


        if(
            monsterArea &&
            playerRow
        ){

            const topEdge=
                monsterArea
                .getBoundingClientRect()
                .bottom;


            const bottomEdge=
                playerRow
                .getBoundingClientRect()
                .bottom;


            panel.style.position=
                "fixed";

            panel.style.top=
                topEdge+"px";

            panel.style.left=
                "6px";

            panel.style.right=
                "6px";

            panel.style.height=

                (bottomEdge-topEdge)+
                "px";

            panel.style.zIndex=
                "99999";

        }

    }
    else{

        /*
           ★ 不在戰鬥中：清掉可能殘留的行內
           定位樣式（例如上一次在戰鬥頁面裡
           打開時設過的top/height），
           讓floating-modal這個class能夠
           正常生效，不被殘留的行內樣式卡住。
        */

        panel.style.position=
            "";

        panel.style.top=
            "";

        panel.style.left=
            "";

        panel.style.right=
            "";

        panel.style.height=
            "";

        panel.style.zIndex=
            "";

    }


    panel.style.display=
        "flex";

}


function closeAutoBattleSettings(){

    const panel=
        $("autoBattleSettingsPanel");


    if(panel){

        panel.style.display=
            "none";


        /*
           ★ 修正（依照使用者要求，改用
           openHomeFeature()彈窗顯示設定
           面板之後）：
           如果面板目前是被借進彈窗
           （#homeFeatureModalBody）裡顯示的
           ——不是舊的document.body搬移法
           ——按下「確定」時要連同整個彈窗
           一起關掉，不然彈窗會留在畫面上、
           裡面卻是空的（面板被設成display:
           none），看起來像卡住。
        */

        if(
            panel.parentNode &&
            panel.parentNode.id===
            "homeFeatureModalBody"
        ){

            closeHomeFeature();

            return;

        }


        /*
           ★ 新增（跟openAutoBattleSettings()
           的搬移動作配對）：
           如果面板目前被搬到document.body
           底下（代表是從地圖／巡邏頁面打開的），
           關閉的時候搬回battlePage裡原本的
           位置，並把floating-modal這個class
           拿掉，恢復成原本在戰鬥頁面裡
           的定位方式。不這樣做的話，面板會
           永遠留在body底下，下次在戰鬥頁面
           裡打開時，版面會跑掉。
        */

        if(
            panel.parentNode===
            document.body &&
            autoSettingsOriginalParent
        ){

            if(
                autoSettingsOriginalNextSibling &&
                autoSettingsOriginalNextSibling.parentNode===
                autoSettingsOriginalParent
            ){

                autoSettingsOriginalParent.insertBefore(
                    panel,
                    autoSettingsOriginalNextSibling
                );

            }
            else{

                autoSettingsOriginalParent.appendChild(
                    panel
                );

            }


            panel.classList.remove(
                "floating-modal"
            );

        }

    }

}


/*
   ★ 新增：把目前設定面板畫面上顯示的值，
   存回「characterIndex」這個角色的
   autoConfig/autoConfig2身上。
   在切換角色之前、以及真正按下確定時
   都會呼叫這裡，確保沒有任何一邊的調整
   會因為切換角色而不小心遺失。
*/

function saveAutoSettingsFormToCharacter(characterIndex){

    const actionSelect=
        $("autoSettingsActionSelect");


    const hpSelect=
        $("autoSettingsHP");


    const spSelect=
        $("autoSettingsSP");


    const returnCityCheckbox=
        $("autoSettingsReturnCity");


    const targetConfig=
        getPartyAutoConfig(Number(characterIndex));


    if(actionSelect){

        targetConfig.skill=
            actionSelect.value;

    }


    if(hpSelect){

        targetConfig.hp=
            Number(hpSelect.value);

    }


    if(spSelect){

        targetConfig.sp=
            Number(spSelect.value);

    }


    if(returnCityCheckbox){

        targetConfig.returnToCityWhenEmpty=

            returnCityCheckbox.checked;

    }

}


function switchAutoSettingsCharacter(skipSave){

    /*
       ★ 修正（真正解決「切換角色會遺失
       未儲存變更」的bug）：
       在讀取新角色的資料、重新畫面之前，
       先把「目前畫面上顯示的值」
       存回「切換前」那個角色身上——
       這樣使用者不管在A、B兩個角色之間
       切換幾次、調整幾次，
       每一次切換都會先幫忙存起來，
       不用切一個角色就要按一次確定，
       最後統一按一次確定即可。

       ★ 但有個例外：剛打開設定面板的那一刻
       （openAutoBattleSettings()呼叫這裡時），
       畫面上的欄位其實是「上一次關閉時
       殘留的舊內容」，不是玩家正在編輯的東西，
       這時候如果還執行「存回上一個角色」，
       反而會用這些過時的殘留值，
       把角色真正的設定覆蓋掉。
       所以剛打開面板時用skipSave=true跳過這一步，
       只有玩家在面板「已經打開的狀態下」
       主動切換角色時，才需要儲存。
    */

    if(!skipSave){

        saveAutoSettingsFormToCharacter(
            autoSettingsCurrentCharacter
        );

    }


    const characterSelect=
        $("autoSettingsCharacterSelect");


    const actionSelect=
        $("autoSettingsActionSelect");


    const hpSelect=
        $("autoSettingsHP");


    const spSelect=
        $("autoSettingsSP");


    const returnCityCheckbox=
        $("autoSettingsReturnCity");


    if(!characterSelect){
        return;
    }


    let requestedIndex=
        Number(characterSelect.value);

    if(!getPartyCharacterByIndex(requestedIndex)){

        characterSelect.value="0";
        requestedIndex=0;

    }


    const targetConfig=
        getPartyAutoConfig(requestedIndex);


    targetConfig.hp=normalizeAutoBattleThreshold(targetConfig.hp,50);
    targetConfig.sp=normalizeAutoBattleThreshold(targetConfig.sp,25);


    const characterId=
        getPartyCharacterKey(requestedIndex);


    const loadout=
        characterSkillLoadouts[
            characterId
        ];


    /*
       ★ 自動行動下拉選單：
       普通攻擊、防禦，加上該角色裝備的
       每一格技能（最多4個）。
    */

    if(actionSelect){

        let optionsHTML=

            '<option value="normal">普通攻擊</option>'+
            '<option value="defend">防禦</option>';


        if(loadout){

            loadout.equippedSkills.forEach(
                skillId=>{

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

                }
            );

        }


        actionSelect.innerHTML=
            optionsHTML;


        const stillValid=

            Array.from(
                actionSelect.options
            )
            .some(
                opt=>
                    opt.value===
                    targetConfig.skill
            );


        actionSelect.value=

            stillValid
            ?
            targetConfig.skill
            :
            "normal";

    }


    if(hpSelect){

        hpSelect.value=
            targetConfig.hp;

    }


    if(spSelect){

        spSelect.value=
            targetConfig.sp;

    }


    if(returnCityCheckbox){

        returnCityCheckbox.checked=

            !!targetConfig.returnToCityWhenEmpty;

    }


    /*
       ★ 更新追蹤變數，記住表單現在顯示的
       是哪個角色，下次切換時才知道
       要把資料存回誰身上。
    */

    autoSettingsCurrentCharacter=
        requestedIndex;

}


function confirmAutoBattleSettings(){

    const characterSelect=
        $("autoSettingsCharacterSelect");


    if(!characterSelect){
        return;
    }


    /*
       ★ 修正：直接呼叫共用的儲存函式，
       確保這裡跟切換角色時用的是同一套邏輯，
       不會出現兩邊各寫一份、以後改一邊忘記改
       另一邊的情況。
    */

    saveAutoSettingsFormToCharacter(
        Number(characterSelect.value)
    );


    /*
       ★ 設定完同步一下主城那邊的舊版UI
       （如果玩家之後還是會去主城調整），
       避免兩邊顯示的數字對不上。
    */

    if(characterSelect.value==="1"){

        populateAutoSkillOptions2();

    }
    else if(characterSelect.value==="0"){

        populateAutoSkillOptions();

    }


    saveGame();


    closeAutoBattleSettings();


    addBattleLog(
        "自動戰鬥設定已更新。"
    );

}


/* Automatic combat only declares combat actions. HP/SP recovery is handled
   once after victory by applyPostBattleAutoRecovery(). */
function autoActionForCharacter(characterIndex,token){

    const character=getPartyCharacterByIndex(characterIndex);
    const config=getPartyAutoConfig(characterIndex);
    const autoOn=characterIndex===0 ? autoBattle : config.enabled;

    if(
        !battleActive ||
        !character ||
        character.hp<=0 ||
        !autoOn ||
        token!==battleToken
    ){
        return;
    }

    if(config.skill==="defend"){
        queuedPlayerActions[characterIndex]={action:"defend",target:null};
        updateUI();
        finishPlayerAction();
        return;
    }

    const aliveInBattle=currentBattleMonsters.filter(
        index=>monsters[index] && monsters[index].alive
    );

    if(aliveInBattle.length===0){
        checkBattleEnd();
        return;
    }

    const skill=skillDatabase[config.skill];
    const spreads=skill && ["tri","row","column","all"].includes(skill.targetType);
    let target=aliveInBattle[0];

    /*
       V137：怪物擴充到最多10隻、並分成兩排之後，「整份存活清單的
       中間」不再等於「技能能打最多人的中心」。例如6隻怪時舊算法
       會選第一排最右邊，tri技能只打到2隻。逐一用真正的
       getSkillTargets()評估候選中心，選命中數最多的那一個，row／
       tri技能才會依目前陣形與死亡缺口正確選位。
    */
    if(spreads && typeof getSkillTargets==="function"){
        let bestCount=-1;
        aliveInBattle.forEach(candidate=>{
            const hitCount=getSkillTargets(candidate,skill.targetType).length;
            if(hitCount>bestCount){
                bestCount=hitCount;
                target=candidate;
            }
        });
    }

    let action=config.skill||"normal";
    const skillKey=getPartyCharacterKey(characterIndex);

    if(
        action!=="normal" &&
        (
            !skill ||
            getSkillLevel(skillKey,action)<=0 ||
            character.sp<(skill.spCost!==undefined ? skill.spCost : (skill.cost||0)) ||
            ["buff","passive","heal","revive"].includes(skill.category)
        )
    ){
        action="normal";
    }

    queuedPlayerActions[characterIndex]={
        action:action,
        target:target
    };

    updateUI();
    finishPlayerAction();
}


function autoAction(token){

    return autoActionForCharacter(0,token);

    if(
        !battleActive ||
        !autoBattle ||
        token!==battleToken
    ){
        return;
    }


    /*
       ★ 修正（重要，依照使用者明確指正）：
       自動戰鬥之前是「輪到自己就立刻執行」，
       完全跳過宣告/結算機制，
       等於自動角色永遠無視敏捷排序、
       永遠是宣告階段那一刻就出手。

       現在改成：自動戰鬥只負責「決定要做什麼」
       （防禦/藥水/技能+目標），
       決定好之後一樣存進queuedPlayerActions，
       真正的執行留到結算階段，
       跟手動操作的角色用同一套規則、
       同樣要看敏捷順序，不再有特例。
    */

    if(autoConfig.skill==="defend"){

        queuedPlayerActions[0]={

            action:"defend",

            target:null

        };


        updateUI();

        finishPlayerAction();

        return;

    }


    const stats =
        getMainCharacterStats();


    const hpPercent =
        player.hp/
        stats.maxHP*
        100;


    const autoHpPotionId=
        getAutoPotionId("hp");


    if(
        hpPercent<=autoConfig.hp &&
        autoHpPotionId
    ){

        queuedPlayerActions[0]={

            action:"potion",
            potionId:autoHpPotionId,
            target:null

        };


        updateUI();

        finishPlayerAction();

        return;

    }


    const spPercent =
        player.sp/
        stats.maxSP*
        100;


    const autoSpPotionId=
        getAutoPotionId("sp");


    if(
        spPercent<=autoConfig.sp &&
        autoSpPotionId
    ){

        queuedPlayerActions[0]={

            action:"potion",
            potionId:autoSpPotionId,
            target:null

        };


        updateUI();

        finishPlayerAction();

        return;

    }


    /*
       ★ 重新設計自動戰鬥選怪邏輯：

       之前不管用什麼技能，都用同一套固定優先順序選目標，
       導致範圍技能（火箭：中左右三人）
       常常選到只能打到1~2隻的位置，
       完全沒有「盡量炸到最多隻」的邏輯，這是主要的怪異之處。

       現在改成：
       - 範圍技能（目前是火箭）：
         選「目前戰鬥中還活著的怪物」正中間那一隻，
         因為火箭是「以選定目標為中心，向左右擴散」，
         打中間才能盡量涵蓋最多隻。
         由於一場戰鬥最多只有1~3隻怪，
         這樣做出來的效果自然就是：
         3隻都活著 → 全部打到；
         剩2隻 → 兩隻都打到；
         剩1隻 → 單體命中。
         正好符合「優先三連、其次兩連、最後單隻」的邏輯，
         不需要額外判斷「怪物是否連在一起」，
         因為現在整場戰鬥的怪物本來就都算「連在一起」。
       - 單體技能（普通攻擊、會心一擊）：
         直接打目前還活著的第一隻就好，
         單體技能本來就不需要考慮誰在中間。
    */

    const aliveInBattle =
        currentBattleMonsters
        .filter(
            i=>
                monsters[i] &&
                monsters[i].alive
        );


    /*
       ★ 判斷目前選定的自動技能是不是「範圍系」，
       範圍系（tri/row/all）就挑中間的怪，
       盡量炸到最多隻；
       單體技能或普通攻擊，直接打第一隻活著的就好。
       這裡改成從skillDatabase動態查詢，
       之後新增技能不用再回來改這段。
    */

    const autoSkillData =
        skillDatabase[
            autoConfig.skill
        ];


    const isSpreadSkill =
        autoSkillData &&
        (
            autoSkillData.targetType==="tri"||
            autoSkillData.targetType==="row"||
            autoSkillData.targetType==="column"||
            autoSkillData.targetType==="all"
        );


    let target;


    if(
        isSpreadSkill &&
        aliveInBattle.length>0
    ){

        const midPosition =
            Math.floor(
                (
                    aliveInBattle.length-1
                )/2
            );


        target =
            aliveInBattle[
                midPosition
            ];

    }
    else{

        target =
            aliveInBattle[0];

    }


    if(target===undefined){

        checkBattleEnd();

        return;

    }


    /*
       ★ buff類（怒火）不需要選目標，
       直接宣告「要用怒火」就好。
    */

    if(
        autoSkillData &&
        autoSkillData.category==="buff"
    ){

        queuedPlayerActions[0]={

            action:
                autoConfig.skill,

            target:null

        };


        updateUI();

        finishPlayerAction();

        return;

    }


    let chosenAction=
        autoConfig.skill;


    if(autoSkillData){

        const spCost =
            autoSkillData.spCost!==undefined
            ?
            autoSkillData.spCost
            :
            autoSkillData.cost;


        if(player.sp<spCost){

            addBattleLog(
                "SP不足，改用普通攻擊。"
            );


            chosenAction=
                "normal";

        }

    }


    queuedPlayerActions[0]={

        action:chosenAction,

        target:target

    };


    updateUI();

    finishPlayerAction();

}


/* =====================================================
   ★ 第二角色自動戰鬥（新增）

   player2沒有手動操作介面，
   每回合玩家的行動結束之後，
   會自動用他自己裝備的技能/自動設定
   （autoConfig2）打一次，
   邏輯盡量跟autoAction()對稱，
   但完全獨立運作，不會動到第一角色的任何狀態。
===================================================== */

function player2AutoAction(token){

    return autoActionForCharacter(1,token);

    if(
        !battleActive ||
        !player2 ||
        player2.hp<=0 ||
        token!==battleToken
    ){
        return;
    }


    /*
       ★ 修正（重要，依照使用者明確指正）：
       第二角色的自動戰鬥之前也是「輪到自己
       就立刻執行」，一樣違反了「所有行動都要
       照敏捷順序結算」的要求。
       改成跟player1的autoAction()一樣，
       只負責「決定要做什麼」並存進
       queuedPlayerActions，真正執行留到
       結算階段，並且這裡自己負責呼叫
       finishPlayerAction()（不再依賴
       beginCharacterTurn()那邊額外呼叫一次，
       避免重複推進）。
    */

    if(autoConfig2.skill==="defend"){

        queuedPlayerActions[1]={

            action:"defend",

            target:null

        };


        updateUI();

        finishPlayerAction();

        return;

    }


    const stats2=
        getPlayer2BattleStats();


    const hpPercent2=
        player2.hp/
        stats2.maxHP*
        100;


    const autoHpPotionId2=
        getAutoPotionId("hp");


    if(
        hpPercent2<=autoConfig2.hp &&
        autoHpPotionId2
    ){

        queuedPlayerActions[1]={

            action:"potion",
            potionId:autoHpPotionId2,
            target:null

        };


        updateUI();

        finishPlayerAction();

        return;

    }


    const spPercent2=
        player2.sp/
        stats2.maxSP*
        100;


    const autoSpPotionId2=
        getAutoPotionId("sp");


    if(
        spPercent2<=autoConfig2.sp &&
        autoSpPotionId2
    ){

        queuedPlayerActions[1]={

            action:"potion",
            potionId:autoSpPotionId2,
            target:null

        };


        updateUI();

        finishPlayerAction();

        return;

    }


    const aliveInBattle=
        currentBattleMonsters.filter(
            i=>
                monsters[i] &&
                monsters[i].alive
        );


    if(aliveInBattle.length===0){

        finishPlayerAction();

        return;

    }


    const autoSkillData=
        skillDatabase[
            autoConfig2.skill
        ];


    const isSpreadSkill=
        autoSkillData &&
        (
            autoSkillData.targetType==="tri"||
            autoSkillData.targetType==="row"||
            autoSkillData.targetType==="column"||
            autoSkillData.targetType==="all"
        );


    let target;


    if(
        isSpreadSkill &&
        aliveInBattle.length>0
    ){

        const midPosition=
            Math.floor(
                (
                    aliveInBattle.length-1
                )/2
            );


        target=
            aliveInBattle[
                midPosition
            ];

    }
    else{

        target=
            aliveInBattle[0];

    }


    if(target===undefined){

        finishPlayerAction();

        return;

    }


    let chosenAction=
        autoConfig2.skill;


    if(
        autoSkillData &&
        autoSkillData.category!=="buff"&&
        autoSkillData.category!=="passive"&&
        autoSkillData.category!=="heal"&&
        autoSkillData.category!=="revive"
    ){

        const spCost=
            autoSkillData.spCost!==undefined
            ?
            autoSkillData.spCost
            :
            autoSkillData.cost;


        if(player2.sp<spCost){

            addBattleLog(
                ""+
                player2.id+
                "SP不足，改用普通攻擊。"
            );


            chosenAction=
                "normal";

        }

    }


    queuedPlayerActions[1]={

        action:chosenAction,

        target:target

    };


    updateUI();

    finishPlayerAction();

}


function player3AutoAction(token){
    return autoActionForCharacter(2,token);
}


function secondaryCharacterNormalAttack(characterIndex,index){

    const character=getPartyCharacterByIndex(characterIndex);
    const stats=getPartyBattleStats(characterIndex);

    index=findAliveTargetIndex(index);

    if(!character || !stats || index===null){
        finishPlayerAction();
        return;
    }

    selectedMonster=index;
    const monster=monsters[index];

    lungePlayerCard(characterIndex);
    showSkillNameBadge("普通攻擊","normal",characterIndex,index,[index]);

    const hit=rollHitChance(
        stats.accuracy,
        getMonsterEvasion(monster),
        getMonsterDebuffValue(character,"stun")
    );

    if(!hit){
        showMissEffect(false,index,"MISS");
        addBattleLog((character.id||"隊友")+"普通攻擊"+monster.name+"，沒有命中！");
        updateUI();
        finishPlayerAction();
        return;
    }

    const critResult=rollCritical(
        character,
        "physical",
        getMonsterEffectiveAntiCrit(monster)
    );

    const damage=calculateDamage(
        stats.attack,
        getMonsterEffectiveDefense(monster),
        character.level,
        monster.level,
        character.element,
        monster.element,
        {
            attacker:character,
            target:monster,
            critMultiplier:critResult.multiplier
        }
    );
    monster.hp=Math.max(0,monster.hp-damage);

    showMonsterHit(index,damage,"hp",critResult.isCrit);
    addBattleLog(
        (character.id||"隊友")+"普通攻擊"+monster.name+
        (critResult.isCrit ? "（爆擊！）" : "")+
        "，造成"+damage+"傷害。"
    );

    if(monster.hp<=0){ killMonster(index); }

    updateUI();
    finishPlayerAction();
}


function castSecondaryCharacterSkill(characterIndex,skillId,centerIndex){

    const character=getPartyCharacterByIndex(characterIndex);
    const characterKey=getPartyCharacterKey(characterIndex);
    const stats=getPartyBattleStats(characterIndex);
    const skill=skillDatabase[skillId];

    if(!character || !stats || !skill){
        finishPlayerAction();
        return;
    }

    const level=getSkillLevel(characterKey,skillId);
    const spCost=skill.spCost!==undefined ? skill.spCost : (skill.cost||0);

    if(level<=0 || character.sp<spCost){
        addBattleLog(
            level<=0
            ? (character.id+"尚未學習"+skill.name+"。")
            : (character.id+"SP不足，無法使用"+skill.name+"。")
        );
        finishPlayerAction();
        return;
    }

    centerIndex=findAliveTargetIndex(centerIndex);

    if(centerIndex===null){
        finishPlayerAction();
        return;
    }

    const targets=getSkillTargets(centerIndex,skill.targetType);

    character.sp-=spCost;
    lungePlayerCard(characterIndex);
    showSkillNameBadge(
        skill.name,skill.element,characterIndex,
        skill.targetType==="all"?null:centerIndex,targets
    );
    setTimeout(()=>showPlayerSpPopup(spCost,characterIndex),500);

    const statBonus=skill.category==="magic" ? stats.magicAttack : stats.attack;

    if(!skill.baseDamage){
        const resolvedIndex=findAliveTargetIndex(centerIndex);

        if(resolvedIndex!==null && skill.freezeChance){
            const monster=monsters[resolvedIndex];
            const freezeResult=rollNamedPersistentStatusEffect(
                monster,
                "freeze",
                [
                    skill.freezeChance,
                    character.level,
                    monster.level,
                    stats.intelligence,
                    getMonsterEffectiveSpiritPoints(monster),
                    true,
                    getMonsterRank(monster)
                ],
                "monster",
                resolvedIndex,
                skill.name
            );

            if(freezeResult.hit){
                applyFreezeEffect(monster,skill.freezeDuration);
                addBattleLog(monster.name+"被冰封了！");
            }else if(!freezeResult.duplicate){
                showMissEffect(false,resolvedIndex,"抵抗");
                addBattleLog(skill.name+"對"+monster.name+"沒有生效（抵抗�