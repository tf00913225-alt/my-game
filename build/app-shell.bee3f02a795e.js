
/* bundled source: js/00-main.js */
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
    restoreAutoBattlePreferences:(uid,preferences)=>restoreAutoBattlePreferences(uid,preferences),
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

    function navigationType(){
        try{
            const entries=window.performance&&typeof window.performance.getEntriesByType==="function"
                ?window.performance.getEntriesByType("navigation")
                :[];
            if(entries&&entries[0]&&entries[0].type){ return String(entries[0].type); }
            if(window.performance&&window.performance.navigation){
                const legacy=Number(window.performance.navigation.type);
                return legacy===1?"reload":legacy===2?"back_forward":"navigate";
            }
        }catch(_){ }
        return "unknown";
    }

    const lifecycleDiagnostics={
        wasDiscarded:document.wasDiscarded===true,
        navigationType:navigationType(),
        sessionPreviouslyEntered:sessionHasEntered(),
        lastEvent:"install",
        lastEventAt:Date.now(),
        lastPageShowPersisted:false,
        backgroundSaveCount:0,
        eventCounts:{visibilitychange:0,pagehide:0,pageshow:0,freeze:0,resume:0}
    };

    function markLifecycleEvent(name,detail){
        lifecycleDiagnostics.lastEvent=name;
        lifecycleDiagnostics.lastEventAt=Date.now();
        if(Object.prototype.hasOwnProperty.call(lifecycleDiagnostics.eventCounts,name)){
            lifecycleDiagnostics.eventCounts[name]++;
        }
        if(name==="pageshow"){
            lifecycleDiagnostics.lastPageShowPersisted=!!(detail&&detail.persisted);
        }
    }

    function rememberEnteredSession(){
        try{
            window.sessionStorage.setItem(STARTUP_SESSION_READY_KEY,"1");
        }catch(_){ }
    }

    function persistBeforeSuspend(reason){
        try{
            const startupState=window.FourSymbolsStartupPolicy?.getState?.();
            if(startupState!=="READY"&&startupState!=="OFFLINE_READY"){
                return;
            }
            if(typeof saveGame==="function"){
                const saved=saveGame({source:"mobile-"+String(reason||"background")});
                if(saved!==false){ lifecycleDiagnostics.backgroundSaveCount++; }
            }
        }catch(_){ }
    }

    if(lifecycleDiagnostics.sessionPreviouslyEntered){
        const startupRoot=document.getElementById("startupLoader");
        if(startupRoot){
            startupRoot.hidden=true;
            startupRoot.dataset.sessionResume="1";
            startupRoot.setAttribute("aria-hidden","true");
        }
    }

    document.addEventListener("v173.20:startup-entered",rememberEnteredSession);

    document.addEventListener("visibilitychange",function(){
        markLifecycleEvent("visibilitychange",{hidden:document.hidden});
        if(document.hidden){ persistBeforeSuspend("visibility-hidden"); }
    });

    window.addEventListener("pagehide",function(event){
        markLifecycleEvent("pagehide",{persisted:!!(event&&event.persisted)});
        persistBeforeSuspend("pagehide");
    });

    window.addEventListener("pageshow",function(event){
        markLifecycleEvent("pageshow",{persisted:!!(event&&event.persisted)});
        /* Normal foreground resume never re-runs Startup. A real reload/discard
           is reconstructed by the existing account-first Startup owner. */
    });

    document.addEventListener("freeze",function(){
        markLifecycleEvent("freeze");
        persistBeforeSuspend("freeze");
    });

    document.addEventListener("resume",function(){
        markLifecycleEvent("resume");
    });

    window.FourSymbolsMobileLifecycleDiagnostics=Object.freeze({
        getSnapshot:function(){
            return Object.freeze({
                wasDiscarded:lifecycleDiagnostics.wasDiscarded,
                navigationType:lifecycleDiagnostics.navigationType,
                sessionPreviouslyEntered:lifecycleDiagnostics.sessionPreviouslyEntered,
                lastEvent:lifecycleDiagnostics.lastEvent,
                lastEventAt:lifecycleDiagnostics.lastEventAt,
                lastPageShowPersisted:lifecycleDiagnostics.lastPageShowPersisted,
                backgroundSaveCount:lifecycleDiagnostics.backgroundSaveCount,
                eventCounts:Object.freeze(Object.assign({},lifecycleDiagnostics.eventCounts))
            });
        }
    });

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
           獎勵」這類邏輯現在就能測試，           不是真的廣告。
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
  ���z��
�)�֧u�ݢ�i��k�G��*^      id:"kill200",
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

/*
   50% HP/SP potions are retired from the backpack surface.
   Keep the legacy definitions readable so old saves can still be parsed
   without mutating player data; new content must not award these IDs.
*/
const RETIRED_BACKPACK_POTION_IDS=new Set([
    "hpPotion50",
    "spPotion50"
]);

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
            BASE_PHYSICAL_ATTACK+            Math.max(1,Number(player.level)||1)*ATTACK_PER_LEVEL+
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

   風系「降低敏捷」與土系「降低防禦」，以及歷史相容的
   statDown（全屬性降低），都共用 statusEffects 狀態管線。
   先前玩家最終能力沒有完整讀取這些減益，造成怪物對玩家施放時
   看得到文字、實際數值卻沒有下降。

   這裡統一規則：
   - statDown 為歷史相容狀態；現役玩家技能目前未使用。若舊資料或怪物技能帶入，
     仍降低對應六圍點數；若技能有 excludedStats，該六圍不降。
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

function getPlayerEvasionBaseAgility(character,equipmentBonus){
    if(!character){ return 0; }
    const base=(Number(character.agility)||0)+(Number(equipmentBonus&&equipmentBonus.agility)||0);
    const statDown=getStatDownPercentFor(character,"agility");
    return Math.max(0,base*(1-statDown/100));
}

function getPlayerFinalEvasionReductionPercent(character){
    return Math.max(0,getMonsterDebuffValue(character,"agilityDown"));
}

const FINAL_EVASION_RATE_CAP=85;
const FROSTBITE_FINAL_PERCENT_POINT_PENALTY=25;

/*
   閃躲來源一律以最終百分點相加／相減。
   玩家看到「閃躲 +10%」就是最終閃躲 +10 個百分點；
   「凍傷：閃躲 -25%」就是最終閃躲 -25 個百分點。
   不再把多個閃躲來源逐層乘算。
*/
function combineEvasionRates(sources){
    const total=(Array.isArray(sources)?sources:[]).reduce(
        (sum,source)=>sum+(Number(source)||0),
        0
    );
    return Math.max(0,Math.min(FINAL_EVASION_RATE_CAP,total));
}

function getFrostbiteFinalPercentPointPenalty(entity){
    return entity&&Array.isArray(entity.statusEffects)&&entity.statusEffects.some(effect=>
        effect&&effect.type==="frostbite"&&Number(effect.turnsLeft)>0
    )
        ?FROSTBITE_FINAL_PERCENT_POINT_PENALTY
        :0;
}

window.v173CombineEvasionRates=combineEvasionRates;
window.v173FrostbiteFinalPercentPointPenalty=FROSTBITE_FINAL_PERCENT_POINT_PENALTY;

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

    const characterKey=getCharacterSkillKey(player);
    const windEXLevel=characterKey?getSkillLevel(characterKey,"windEX"):0;
    const earthEXLevel=characterKey?getSkillLevel(characterKey,"earthEX"):0;

    const evasionPassivePercent=windEXLevel>0
        ? (skillDatabase.windEX.evasionBonusPercent||0)
        : 0;
    const defensePassivePercent=earthEXLevel>0
        ? (skillDatabase.earthEX.defenseBonusPercent||0)
        : 0;
    const maxHpPassiveMultiplier=earthEXLevel>0
        ? Math.max(1,Number(skillDatabase.earthEX.maxHpMultiplier)||1)
        : 1;

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

    const rawEvasion=getPlayerEvasionBaseAgility(player,bonus)*0.6;

    return {
        /* 暫時六圍減益不動態壓縮最大HP/SP；詳見上方統一規則。 */
        maxHP:Math.round((
            100+
            (player.vitality+(Number(bonus.vitality)||0))*HP_PER_VITALITY_POINT+
            player.bonusHP+
            (Number(bonus.maxHP)||0)
        )*maxHpPassiveMultiplier),

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
        accuracy:effectiveSpirit*2+(getLearnedElementEX(player,"wind")?Number(skillDatabase.windEX.accuracyBonusPercent)||0:0),
        resistance:calculateStatusResistancePercent(effectiveSpirit),
        antiCrit:calculateAntiCritPercent(effectiveSpirit),
        speed:effectiveAgility,

        evasion:combineEvasionRates([
            rawEvasion,
            evasionBuffPercent,
            evasionPassivePercent,
            -getPlayerFinalEvasionReductionPercent(player),
            -getFrostbiteFinalPercentPointPenalty(player)
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
    const maxHpPassiveMultiplier=earthEXLevel>0
        ? Math.max(1,Number(skillDatabase.earthEX.maxHpMultiplier)||1)
        : 1;

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
    const rawEvasion=getPlayerEvasionBaseAgility(character,bonus)*0.6;

    return {
        maxHP:Math.round((
            100+
            (character.vitality+(Number(bonus.vitality)||0))*HP_PER_VITALITY_POINT+
            (Number(character.bonusHP)||0)+
            (Number(bonus.maxHP)||0)
        )*maxHpPassiveMultiplier),

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
        accuracy:effectiveSpirit*2+(getLearnedElementEX(character,"wind")?Number(skillDatabase.windEX.accuracyBonusPercent)||0:0),
        resistance:calculateStatusResistancePercent(effectiveSpirit),
        antiCrit:calculateAntiCritPercent(effectiveSpirit),
        speed:effectiveAgility,

        evasion:combineEvasionRates([
            rawEvasion,
            evasionBuffPercent,
            evasionPassivePercent,
            -getPlayerFinalEvasionReductionPercent(character),
            -getFrostbiteFinalPercentPointPenalty(character)
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
    return Number(skill.powerMultiplier);
}

function getSkillFlatDamageAtLevel(skill,level){
    return Number(skill.flatDamage);
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
        description:"對單體造成120點基礎傷害；65%機率使目標暈眩2回合，使目標最終命中率降低15%/20%/25%/30%/35%。",
        stunChance:65, missBonusByLevel:[15,20,25,30,35], stunDuration:2, requires:["stormFlurry"]
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
        description:"對敵方全體各造成48點基礎法術傷害；35%機率暈眩1回合，使目標最終命中率降低15%/20%/25%/30%/35%。",
        stunChance:35, missBonusByLevel:[15,20,25,30,35], stunDuration:1, requires:["windHowlLightning"]
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

/* =====================================================
   怪物預設閃躲唯一 Owner
   forestMonsters / desertMonsters 等區域 roster 會在 App Shell 頂層
   立即呼叫 makeZoneMonster()，因此常數必須在第一個 roster 建立前
   完成初始化。正式值：level×0.1%，最高10%。
===================================================== */
const DEFAULT_MONSTER_EVASION_PER_LEVEL = 0.1;
const DEFAULT_MONSTER_EVASION_CAP = 10;

function getDefaultMonsterEvasion(level){
    return Math.min(
        DEFAULT_MONSTER_EVASION_CAP,
        Math.max(0,Number(level)||0)*DEFAULT_MONSTER_EVASION_PER_LEVEL
    );
}

window.v173GetDefaultMonsterEvasion=getDefaultMonsterEvasion;


const forestMonsters = [

    makeZoneMonster("哥布林",3,"fire"),
    makeZoneMonster("史萊姆",2,"water"),
    makeZoneMonster("哥布林",3,"fire"),
    makeZoneMonster("史萊姆",2,"water"),    makeZoneMonster("哥布林",3,"fire"),
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
   預設閃避 = min(10%, 等級×0.1%)
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
       （體質已經固