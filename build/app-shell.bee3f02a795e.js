tail: error writing 'standard output': Broken pipe

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
    }else if(event && event.changedTouches && evtail: error writing 'standard output': Broken pipe
ent.changedTouches.length){
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
   一律呼叫�tail: error writing 'standard output': Broken pipe
�裡取得「目前存在的全部角色」，
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
   ★ 新增�tail: error writing 'standard output': Broken pipe
tail: error writing 'standard output': Broken pipe
��依照使用者要求，任務改成兩個
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

        if(rtail: error writing 'standard output': Broken pipe
bwrap: Can't get type of source /workspace/scratch/2feca6ea11c3/.aws: No such file or directory
Number(item.count)||1));
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
   呼叫點，見上面killMonsttail: error writing 'standard output': Broken pipe
er()的修改。
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


/* ==============================================tail: error writing 'standard output': Broken pipe
bwrap: Can't find source path /workspace/scratch/2feca6ea11c3/.aws: No such file or directory
tail: error writing 'standard output': Broken pipe
==================== */

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
        ? Math.max(1,bwrap: Can't get type of source /workspace/scratch/2feca6ea11c3/.aws: No such file or directory
bwrap: Can't get type of source /workspace/scratch/2feca6ea11c3/.aws: No such file or directory
tail: error writing 'standard output': Broken pipe
�害的1%/1%/1%/2%/3%，等量恢復自身HP與SP。",
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
        description:"對同一橫排左、中�tail: error writing 'standard output': Broken pipe
��右最多3名目標各造成18點基礎法術傷害；50%機率降低敏捷1回合，降低10%/20%/30%/40%/50%。",
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
        description:"對敵方全體各造成20點基礎法���傷害；依等級25%/35%/45%/55%/65%機率石化目標2回合，使其無法行動。",
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
   技能池裡的招�tail: error writing 'standard output': Broken pipe
bwrap: Can't get type of source /workspace/scratch/2feca6ea11c3/.aws: No such file or directory
bwrap: Can't get type of source /workspace/scratch/2feca6ea11c3/.aws: No such file or directory
bwrap: Can't find source path /workspace/scratch/2feca6ea11c3/.aws: No such file or directory
bwrap: Can't find source path /workspace/scratch/2feca6ea11c3/.aws: No such file or directory
�，裡面
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


/* =====================================================   角色
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
/* Queue timing has one owner: this module. V142/V143 report visual time only. */
const MANUAL_RESOLUTION_START_MS=250;
const POST_ACTION_DELAY_MS=1150;
const BATTLE_DECLARE_ADVANCE_MS=MANUAL_RESOLUTION_START_MS;
const battleActionFinishObservers=new Set();
const battleBeforeCombatantObservers=new Set();
const battleRoundStartObservers=new Set();
const battleRoundEndObservers=new Set();
const battleActionFinishInterceptors=[];
let battleRoundBoundaryKeys=new Set();
const battlePresentationLocks=new Set();
let battleInputResumeToken=null;
let battleResolutionResumeToken=null;
let battleAutoActionResume=null;
let battleRoundPromptTimeoutId=null;
let battleRoundPromptRelease=null;
let activeBattleStatisticsAction=null;
/*
 * Persistent Effect Duration Lifecycle
 *
 * BattleFlow owns action boundaries, so duration consumption lives here rather
 * than in a late skill module. A snapshot is captured immediately before the
 * combatant acts and consumed once by the matching action-finished signal.
 * Effects created during that action are not present in the snapshot and do
 * not lose a turn immediately. Burn and explicitly charge/round-owned states
 * stay outside this action lifecycle.
 */
const BATTLE_ACTION_DURATION_STATUS_TYPES=new Set([
    "freeze","petrify","frostbite","agilityDown","statDown","damageDown","defenseDown","stun"
]);
const BATTLE_ACTION_DURATION_EXCLUDED_BUFFS=new Set(["phoenixMight","bloodBurn"]);
const battleDurationBuffExpiryHandlers=new Set();
let battleDurationAction=null;

function battleDurationNtail: error writing 'standard output': Broken pipe
umber(value){
    const number=Number(value);
    return Number.isFinite(number)?number:0;
}
function battleDurationEntityForEntry(entry){
    if(!entry){ return null; }
    if(entry.type==="player"){ return getPartyCharacterByIndex(entry.characterIndex); }
    if(entry.type==="monster"&&Array.isArray(monsters)){ return monsters[entry.monsterIndex]||null; }
    return null;
}
function snapshotBattleActionDuration(entity){
    return {
        buffs:new Set((entity&&Array.isArray(entity.activeBuffs)?entity.activeBuffs:[]).filter(buff=>
            buff&&battleDurationNumber(buff.turnsLeft)>0&&!buff.oneShot&&!BATTLE_ACTION_DURATION_EXCLUDED_BUFFS.has(buff.type)
        )),
        statuses:new Set((entity&&Array.isArray(entity.statusEffects)?entity.statusEffects:[]).filter(effect=>
            effect&&battleDurationNumber(effect.turnsLeft)>0&&BATTLE_ACTION_DURATION_STATUS_TYPES.has(effect.type)
        ))
    };
}
function runBattleDurationBuffExpiryHandlers(entity,buff,mirrored){
    battleDurationBuffExpiryHandlers.forEach(handler=>{
        try{ handler({entity:entity,buff:buff,mirrored:mirrored||null}); }
        catch(error){ console.error("持續增益到期處理器失敗：",error); }
    });
}
function expireBattleActionBuff(entity,buff){
    if(!entity||!buff||!Array.isArray(entity.activeBuffs)){ return; }
    buff.turnsLeft=Math.max(0,battleDurationNumber(buff.turnsLeft)-1);
    const mirrored=Array.isArray(entity.v141TeamBuffs)
        ?entity.v141TeamBuffs.find(item=>item&&item.displayBuff===buff):null;
    if(mirrored){ mirrored.turnsLeft=buff.turnsLeft; }
    if(buff.turnsLeft>0){ return; }

    entity.activeBuffs=entity.activeBuffs.filter(item=>item!==buff);
    if(mirrored){
        entity.v141TeamBuffs=entity.v141TeamBuffs.filter(item=>item!==mirrored);
        if(mirrored.type==="rage"){
            entity.attack=mirrored.originalAttack;
            entity.magicAttack=mirrored.originalMagicAttack;
        }else if(mirrored.type==="resistance"){
            entity.resistance=Math.max(0,battleDurationNumber(entity.resistance)-battleDurationNumber(mirrored.amount));
        }else if(mirrored.type==="dodge"){
            entity.evasion=mirrored.originalEvasion;
        }
    }

    runBattleDurationBuffExpiryHandlers(entity,buff,mirrored);
    if(typeof addBattleLog==="function"){
        addBattleLog("⏳"+(buff.statusName||buff.type)+"效果已結束。");
    }
}
function expireBattleActionStatus(entity,effect){
    if(!entity||!effect||!Array.isArray(entity.statusEffects)){ return; }
    effect.turnsLeft=Math.max(0,battleDurationNumber(effect.turnsLeft)-1);
    if(effect.turnsLeft>0){ return; }
    entity.statusEffects=entity.statusEffects.filter(item=>item!==effect);
    if(typeof addBattleLog==="function"){
        const name=effect.type==="freeze"?"冰封":effect.type==="petrify"?"石化":effect.type==="frostbite"?"凍傷":effect.type;
        addBattleLog((entity.id||entity.name||"目標")+"的"+name+"效果已解除。");
    }
}
function beginBattleDurationAction(event){
    const entry=event&&event.queue&&event.queue[event.index];
    const entity=battleDurationEntityForEntry(entry);
    if(!entity||battleDurationNumber(entity.hp)<=0){ battleDurationAction=null; return; }
    const snapshot=snapshotBattleActionDuration(entity);
    battleDurationAction={
        token:event.token,index:event.index,entry:entry,entity:entity,
        buffs:snapshot.buffs,statuses:snapshot.statuses
    };
}
function finishBattleDurationAction(){
    const action=battleDurationAction;
    battleDurationAction=null;
    if(!action){ return; }
    action.buffs.forEach(buff=>{
        if(Array.isArray(action.entity.activeBuffs)&&action.entity.activeBuffs.includes(buff)){
            expireBattleActionBuff(action.entity,buff);
        }
    });
    action.statuses.forEach(effect=>{
        if(Array.isArray(action.entity.statusEffects)&&action.entity.statusEffects.includes(effect)){
            expireBattleActionStatus(action.entity,effect);
        }
    });
    if(typeof window!=="undefined"&&typeof window.v143SyncStatusVisualEffects==="function"){
        window.v143SyncStatusVisualEffects(false);
    }
}
if(typeof window!=="undefined"){
    window.v175DurationLifecycleActive=true;
    window.FourSymbolsDurationLifecycle=Object.freeze({
        beginAction:beginBattleDurationAction,
        finishAction:finishBattleDurationAction,
        snapshotFor:entity=>snapshotBattleActionDuration(entity),
        registerBuffExpiryHandler(handler){
            if(typeof handler!=="function"){ return function(){}; }
            battleDurationBuffExpiryHandlers.add(handler);
            return function(){ battleDurationBuffExpiryHandlers.delete(handler); };
        }
    });
}

if(typeof window!=="undefined"){
    window.FourSymbolsBattleFlow=Object.freeze({
        subscribeActionFinished(observer){
            if(typeof observer!=="function"){ return function(){}; }
            battleActionFinishObservers.add(observer);
            return function(){ battleActionFinishObservers.delete(observer); };
        },
        subscribeBeforeCombatant(observer){
            if(typeof observer!=="function"){ return function(){}; }
            battleBeforeCombatantObservers.add(observer);
            return function(){ battleBeforeCombatantObservers.delete(observer); };
        },
        subscribeRoundStart(observer){
            if(typeof observer!=="function"){ return function(){}; }
            battleRoundStartObservers.add(observer);
            return function(){ battleRoundStartObservers.delete(observer); };
        },
        subscribeRoundEnd(observer){
            if(typeof observer!=="function"){ return function(){}; }
            battleRoundEndObservers.add(observer);
            return function(){ battleRoundEndObservers.delete(observer); };
        },
        acquirePresentationLock(owner){
            const lock={owner:String(owner||"battle-presentation")};
            battlePresentationLocks.tail: error writing 'standard output': Broken pipe
add(lock);
            if(typeof updateActionHudVisibility==="function"){ updateActionHudVisibility(); }
            let active=true;
            return function(){
                if(!active){ return; }
                active=false;
                battlePresentationLocks.delete(lock);
                if(typeof updateActionHudVisibility==="function"){ updateActionHudVisibility(); }
                if(battlePresentationLocks.size===0){
                    resumeBattleAfterPresentationLocks();
                }
            };
        },
        isPresentationActive(){ return battlePresentationLocks.size>0; },
        acquirePauseLock(owner){
            return window.FourSymbolsBattleFlow.acquirePresentationLock("pause:"+String(owner||"battle-flow"));
        },
        isPaused(){ return battlePresentationLocks.size>0; },
        isAutoBattle(){ return !!autoBattle; },
        isBattleActive(){ return !!battleActive; },
        interceptActionFinish(interceptor){
            if(typeof interceptor!=="function"){ return function(){}; }
            battleActionFinishInterceptors.push(interceptor);
            let active=true;
            return function(){
                if(!active){ return; }
                active=false;
                const index=battleActionFinishInterceptors.lastIndexOf(interceptor);
                if(index>=0){ battleActionFinishInterceptors.splice(index,1); }
            };
        }
    });
}

function resumeBattleAfterPresentationLocks(){
    if(battlePresentationLocks.size>0||!battleActive){ return; }

    if(
        battleAutoActionResume&&
        battleAutoActionResume.token===battleToken&&
        battlePhase==="declare"
    ){
        const pending=battleAutoActionResume;
        battleAutoActionResume=null;
        autoActionForCharacter(pending.characterIndex,pending.token);
        return;
    }

    if(
        battleInputResumeToken!==null&&
        battlePhase==="declare"&&
        battleInputResumeToken===battleToken
    ){
        const resumeToken=battleInputResumeToken;
        battleInputResumeToken=null;
        beginCharacterTurn(resumeToken);
        return;
    }

    if(
        battleResolutionResumeToken!==null&&
        battlePhase==="resolve"&&
        battleResolutionResumeToken===battleToken
    ){
        const resumeToken=battleResolutionResumeToken;
        battleResolutionResumeToken=null;
        processNextCombatant(resumeToken);
    }
}

function clearBattleRoundPrompt(){
    if(battleRoundPromptTimeoutId){
        clearTimeout(battleRoundPromptTimeoutId);
        battleRoundPromptTimeoutId=null;
    }
    const prompt=typeof document!=="undefined"
        ?document.getElementById("battleRoundPrompt")
        :null;
    if(prompt){ prompt.hidden=true; }
    if(battleRoundPromptRelease){
        const release=battleRoundPromptRelease;
        battleRoundPromptRelease=null;
        release();
    }
}

function showAutoBattleRoundPrompt(token){
    clearBattleRoundPrompt();
    if(!battleActive||token!==battleToken||!autoBattle){ return false; }

    const page=typeof document!=="undefined"?document.getElementById("battlePage"):null;
    if(!page){ return false; }

    let prompt=document.getElementById("battleRoundPrompt");
    if(!prompt){
        prompt=document.createElement("div");
        prompt.id="battleRoundPrompt";
        prompt.className="battle-round-prompt";
        prompt.setAttribute("role","status");
        prompt.setAttribute("aria-live","polite");
        page.appendChild(prompt);
    }

    prompt.textContent="第 "+Math.max(1,Math.floor(Number(turn)||1))+" 回合";
    prompt.hidden=false;

    const flow=window.FourSymbolsBattleFlow;
    battleRoundPromptRelease=flow&&typeof flow.acquirePresentationLock==="function"
        ?flow.acquirePresentationLock("auto-round-prompt")
        :null;

    battleRoundPromptTimeoutId=setTimeout(()=>{
        battleRoundPromptTimeoutId=null;
        if(prompt){ prompt.hidden=true; }
        const release=battleRoundPromptRelease;
        battleRoundPromptRelease=null;
        if(release){ release(); }
    },500);
    return true;
}

function getBattleStatisticsOwner(){
    return typeof window!=="undefined"&&window.FourSymbolsBattleStatistics
        ?window.FourSymbolsBattleStatistics
        :null;
}

function getBattleStatisticsCombatantKind(character){
    const kind=character&&String(character.combatantKind||character.unitKind||"");
    if(kind==="heroNpc"||kind==="reinforcement"){ return kind; }
    return "playerCharacter";
}

function buildBattleStatisticsCombatant(characterIndex){
    const character=getPartyCharacterByIndex(characterIndex);
    if(!character){ return null; }
    const kind=getBattleStatisticsCombatantKind(character);
    const identity=String(character.id||("角色"+(characterIndex+1)));
    return {
        id:kind+":"+characterIndex+":"+identity,
        kind:kind,
        side:"ally",
        battleIndex:characterIndex,
        name:identity,
        portrait:typeof getCharacterBattleArtworkPath==="function"
            ?getCharacterBattleArtworkPath(character)
            :""
    };
}

function beginBattleStatisticsSession(){
    activeBattleStatisticsAction=null;
    const owner=getBattleStatisticsOwner();
    if(!owner||typeof owner.begin!=="function"){ return false; }
    const combatants=getExistingPartyIndexes()
        .map(buildBattleStatisticsCombatant)
        .filter(Boolean);
    owner.begin({battleToken:battleToken,combatants:combatants});
    return true;
}

function finishBattleStatisticsSession(result){
    battleStatisticsFinishAction();
    const owner=getBattleStatisticsOwner();
    if(owner&&typeof owner.finish==="function"){
        owner.finish({result:String(result||"")});
    }
    activeBattleStatisticsAction=null;
}

function battleStatisticsBeginAction(entry){
    const owner=getBattleStatisticsOwner();
    if(!owner||!entry){ activeBattleStatisticsAction=null;return; }

    const sourceId=entry.type==="player"&&typtail: error writing 'standard output': Broken pipe
eof owner.getCombatantIdByBattleIndex==="function"
        ?owner.getCombatantIdByBattleIndex(entry.characterIndex)
        :null;
    const partyHp={};
    getExistingPartyIndexes().forEach(index=>{
        const character=getPartyCharacterByIndex(index);
        if(character){ partyHp[index]=Math.max(0,Number(character.hp)||0); }
    });
    const enemyHp={};
    currentBattleMonsters.forEach(index=>{
        const monster=monsters[index];
        if(monster){ enemyHp[index]=Math.max(0,Number(monster.hp)||0); }
    });
    activeBattleStatisticsAction={sourceId:sourceId,partyHp:partyHp,enemyHp:enemyHp};
}

function battleStatisticsFinishAction(){
    const action=activeBattleStatisticsAction;
    activeBattleStatisticsAction=null;
    const owner=getBattleStatisticsOwner();
    if(!action||!owner){ return; }

    Object.keys(action.partyHp).forEach(key=>{
        const index=Number(key);
        const character=getPartyCharacterByIndex(index);
        if(!character){ return; }
        const before=action.partyHp[key];
        const after=Math.max(0,Number(character.hp)||0);
        const targetId=typeof owner.getCombatantIdByBattleIndex==="function"
            ?owner.getCombatantIdByBattleIndex(index)
            :null;
        if(after<before&&targetId&&typeof owner.recordDamage==="function"){
            owner.recordDamage({targetId:targetId,amount:before-after});
        }else if(after>before&&action.sourceId&&typeof owner.recordHealing==="function"){
            owner.recordHealing({sourceId:action.sourceId,targetId:targetId,amount:after-before});
        }
    });

    if(action.sourceId&&typeof owner.recordDamage==="function"){
        Object.keys(action.enemyHp).forEach(key=>{
            const monster=monsters[Number(key)];
            if(!monster){ return; }
            const before=action.enemyHp[key];
            const after=Math.max(0,Number(monster.hp)||0);
            if(after<before){
                owner.recordDamage({sourceId:action.sourceId,amount:before-after});
            }
        });
    }
}

function battleStatisticsRecordCriticalByActor(character){
    const owner=getBattleStatisticsOwner();
    if(!owner||typeof owner.recordCritical!=="function"){ return; }
    const index=typeof getPartyCharacterIndex==="function"?getPartyCharacterIndex(character):-1;
    if(index<0||typeof owner.getCombatantIdByBattleIndex!=="function"){ return; }
    const id=owner.getCombatantIdByBattleIndex(index);
    if(id){ owner.recordCritical({id:id}); }
}

function battleStatisticsRecordDamageTakenByIndex(characterIndex,value){
    const owner=getBattleStatisticsOwner();
    if(!owner||typeof owner.recordDamage!=="function"||typeof owner.getCombatantIdByBattleIndex!=="function"){ return; }
    const id=owner.getCombatantIdByBattleIndex(characterIndex);
    const actual=Math.max(0,Number(value)||0);
    if(id&&actual>0){ owner.recordDamage({targetId:id,amount:actual}); }
}

function battleStatisticsRecordDamageDealtByIndex(characterIndex,value){
    const owner=getBattleStatisticsOwner();
    if(!owner||typeof owner.recordDamage!=="function"||typeof owner.getCombatantIdByBattleIndex!=="function"){ return; }
    const id=owner.getCombatantIdByBattleIndex(characterIndex);
    const actual=Math.max(0,Number(value)||0);
    if(id&&actual>0){ owner.recordDamage({sourceId:id,amount:actual}); }
}

function battleStatisticsRecordDamageDealtByActor(character,value){
    const index=typeof getPartyCharacterIndex==="function"?getPartyCharacterIndex(character):-1;
    if(index>=0){ battleStatisticsRecordDamageDealtByIndex(index,value); }
}

function notifyBattleActionFinished(){
    battleActionFinishObservers.forEach(observer=>{
        try{ observer(); }
        catch(error){ console.error("戰鬥行動完成觀察器失敗：",error); }
    });
}
function interceptBattleActionFinish(){
    for(let index=battleActionFinishInterceptors.length-1;index>=0;index--){
        try{
            if(battleActionFinishInterceptors[index]()===true){ return true; }
        }catch(error){
            console.error("戰鬥行動完成攔截器失敗：",error);
        }
    }
    return false;
}
function notifyBeforeCombatant(token){
    const event={token:token,turn:turn,index:initiativeIndex,queue:initiativeQueue};
    beginBattleDurationAction(event);
    battleBeforeCombatantObservers.forEach(observer=>{
        try{ observer(event); }
        catch(error){ console.error("戰鬥佇列觀察器失敗：",error); }
    });
}
function notifyBattleRoundBoundary(type,token){
    const roundNumber=Math.max(1,Math.floor(Number(turn)||1));
    const key=String(token)+":"+type+":"+String(roundNumber);
    if(battleRoundBoundaryKeys.has(key)){ return false; }
    battleRoundBoundaryKeys.add(key);
    const observers=type==="round_start"?battleRoundStartObservers:battleRoundEndObservers;
    observers.forEach(observer=>{
        try{ observer({token:token,turn:roundNumber,type:type}); }
        catch(error){ console.error("戰鬥回合邊界觀察器失敗：",error); }
    });
    return true;
}
function getBattleAdvanceDelay(phase){
    if(phase==="declare"){
        /* A previous VFX must never delay the last declared action. */
        return MANUAL_RESOLUTION_START_MS;
    }
    const visualRemaining=typeof window!=="undefined"&&typeof window.v142GetRemainingAnimationMs==="function"
        ?Number(window.v142GetRemainingAnimationMs())||0:0;
    /* V142/V143 only report whether the current visual gate remains active.
       This queue owner waits for that gate, then schedules exactly one formal
       post-action beat before the next combatant. */
    return Math.max(0,visualRemaining)+POST_ACTION_DELAY_MS;
}
const BATTLE_ACTION_WATCHDOG_MS=7000;
let battleActionWatchdogTimeoutId=null;

function clearBattleActionWatchdog(){
    if(!battleActionWatchdogTimeoutId){ return; }
    clearTimeout(battleActionWatchdogTimeoutId);
    battleActionWatchdogTimeoutId=null;
}

function armBattleActionWatchdog(token,indextail: error writing 'standard output': Broken pipe
bwrap: Can't get type of source /workspace/scratch/2feca6ea11c3/.aws: No such file or directory
tail: error writing 'standard output': Broken pipe
的是「哪個角色」的資料，
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

/* The only Phase 4 local restore owner: explicit, same-UID preferences only.
 * Never hydrate a partial cloud record as a full gameplay save. */
function restoreAutoBattlePreferences(uid,preferences){
    const repository=window.FourSymbolsAccountSave;
    if(!repository||!uid||repository.getActiveUid()!==uid||SAVE_KEY!==repository.saveKey(uid)){
        throw new Error("Cloud preferences cannot be applied to a different UID.");
    }
    const local=repository.readForUid(uid);
    if(local.status!=="ready"||!local.save?.player?.id||player.id!==local.save.player.id){
        throw new Error("A verified local character is required to restore preferences.");
    }
    const keys=["autoConfig","autoConfig2","autoConfig3"];
    const fields=["enabled","skill","hp","sp","returnToCityWhenEmpty"];
    if(!preferences||typeof preferences!=="object"||Array.isArray(preferences)||
       Object.keys(preferences).length!==keys.length+1||Object.keys(preferences).some(key=>key!=="characterIds"&&!keys.includes(key))||
       !Array.isArray(preferences.characterIds)||preferences.characterIds.length!==3||
       [local.save.player,local.save.player2,local.save.player3].some((character,index)=>
           (character?.id||null)!==preferences.characterIds[index])){
        throw new Error("Cloud preferences contain unsupported fields.");
    }
    const snapshot={};
    for(const key of keys){
        const value=preferences[key];
        if(!value||typeof value!=="object"||Array.isArray(value)||
           Object.keys(value).length!==fields.length||Object.keys(value).some(field=>!fields.includes(field))||
           typeof value.enabled!=="boolean"||typeof value.returnToCityWhenEmpty!=="boolean"||
           typeof value.skill!=="string"||!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(value.skill)||
           !Number.isInteger(value.hp)||value.hp<0||value.hp>100||
           !Number.isInteger(value.sp)||value.sp<0||value.sp>100){
            throw new Error("Cloud preferences are invalid.");
        }
        snapshot[key]=Object.fromEntries(fields.map(field=>[field,value[field]]));
    }
    const targets={autoConfig,autoConfig2,autoConfig3};
    const previous=Object.fromEntries(keys.map(key=>[key,{...targets[key]}]));
    try{
        for(const key of keys){ Object.assign(targets[key],snapshot[key]); }
        if(saveGame({source:"cloud-preferences-restore"})!==true){
            throw new Error("Failed to save the restored preferences locally.");
        }
        return true;
    }catch(error){
        for(const key of keys){ Object.assign(targets[key],previous[key]); }
        throw error;
    }
}


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
====================================================bwrap: Can't bind mount /oldroot/workspace/scratch/2feca6ea11c3/.aws on /newroot/workspace/scratch/2feca6ea11c3/.aws: Unable to find "/newroot/workspace/scratch/2feca6ea11c3/.aws" in mount table
entValue=
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
               tail: error writing 'standard output': Broken pipe
tail: error writing 'standard output': Broken pipe
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
bwrap: Can't get type of source /workspace/scratch/2feca6ea11c3/.aws: No such file or directory
POINTS;

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


    if(id.lengthtail: error writing 'standard output': Broken pipe
bwrap: Can't bind mount /oldroot/workspace/scratch/2feca6ea11c3/.aws on /newroot/workspace/scratch/2feca6ea11c3/.aws: Unable to find "/newroot/workspace/scratch/2feca6ea11c3/.aws" in mount table
tail: error writing 'standard output': Broken pipe
============= */

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
        bwrap: Can't get type of source /workspace/scratch/2feca6ea11c3/.aws: No such file or directory
bwrap: Can't get type of source /workspace/scratch/2feca6ea11c3/.aws: No such file or directory
tail: error writing 'standard output': Broken pipe
d(autoConfig.sp,25);
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


        normalizeHydratedRetiredSkillReferences();
        if(typeof window!=="undefined"&&typeof window.v17364NormalizeCrossElementEquips==="function"){
            window.v17364NormalizeCrossElementEquips();
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
        tail: error writing 'standard output': Broken pipe
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
           就正確套用一次。        */

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
let inventoryOpenContext=null;

function inventoryContextSnapshot(context){
    const sourcePage=String(context&&context.sourcePage||"map");
    rtail: error writing 'standard output': Broken pipe
eturn Object.freeze({
        sourcePage,
        returnAction:String(context&&context.returnAction||""),
        closeBehavior:String(context&&context.closeBehavior||"restore-source")
    });
}

function openInventoryContext(context){
    if(typeof battleActive!=="undefined"&&battleActive){ return false; }
    const normalized=inventoryContextSnapshot(context);
    showPage("inventory");
    inventoryOpenContext=normalized;
    const app=document.getElementById("app");
    if(app){ app.classList.add("inventory-context-open"); app.classList.remove("inventory-overlay-open"); }
    setMapInventoryScrollGate(true);
    return true;
}
window.openInventoryContext=openInventoryContext;

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

function openMapInventoryOverlay(context){
    return openInventoryContext(context);
}

function closeMapInventoryOverlay(){
    const context=inventoryOpenContext||inventoryContextSnapshot({sourcePage:"inventory"});
    inventoryOpenContext=null;
    const app=document.getElementById("app");
    if(app){ app.classList.remove("inventory-context-open","inventory-overlay-open"); }
    const inventoryPage=$("inventoryPage");

    if(typeof closeItemModal==="function"){
        closeItemModal();
    }
    if(typeof closeInventoryCharacterDetail==="function"){
        closeInventoryCharacterDetail();
    }

    if(context.sourcePage==="map"&&typeof leaveMap==="function"){
        leaveMap();
    }else if(["dungeon","gameplay","gameplayPage","boss","bossPage","tower","towerPage","training","trainingPage"].includes(context.sourcePage)){
        if(typeof showPage==="function"){
            const pageMap={dungeon:"gameplay",gameplay:"gameplay",gameplayPage:"gameplay",boss:"boss",bossPage:"boss",tower:"tower",towerPage:"tower",training:"training",trainingPage:"training"};
            showPage(pageMap[context.sourcePage]);
        }
    }else if(typeof showPage==="function"){
        showPage("home");
    }
}

/* =====================================================
   頁面
===================================================== */

function showPage(page){

    if(page==="inventory"&&!inventoryOpenContext){
        inventoryOpenContext=inventoryContextSnapshot({sourcePage:"inventory",closeBehavior:"navigation"});
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
           需要滑一下�bwrap: Can't bind mount /oldroot/workspace/scratch/2feca6ea11c3/.aws on /newroot/workspace/scratch/2feca6ea11c3/.aws: Unable to mount source on destination: No such file or directory
bwrap: Can't bind mount /oldroot/workspace/scratch/2feca6ea11c3/.aws on /newroot/workspace/scratch/2feca6ea11c3/.aws: Unable to mount source on destination: No such file or directory
bwrap: Can't get type of source /workspace/scratch/2feca6ea11c3/.aws: No such file or directory
圖。
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

    if(!exitPatrolContext("leave-map")){
        return;
    }

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

/*
   Patrol artwork bridge:
   - js/26-v131-patrol-appearance.js is the formal appearance owner.
   - Core patrol lifecycle may request front/back facing, but must not replace
     the selected character's gender/element artwork once that owner is ready.
   - The legacy PNG pair remains only as a pre-feature fallback.
*/
function applyPatrolCharacterArtwork(facingBack){

    const img=
        $("patrolCharacterImg");

    if(!img){
        return false;
    }

    img.style.transform=
        "none";

    if(
        typeof window!=="undefined" &&
        typeof window.v131ApplyPatrolArt==="function"
    ){

        window.v131ApplyPatrolArt(
            !!facingBack
        );

        return true;

    }

    img.src=
        facingBack
        ? PATROL_CHAR_BACK_B64
        : PATROL_CHAR_FRONT_B64;

    return false;

}



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

let patrolLifecycleGeneration=
    0;

function isPatrolMapActive(){
    const mapPageElement=$("mapPage");
    return !!(
        mapPageElement &&
        mapPageElement.classList.contains("active")
    );
}


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
           靜�tail: error writing 'standard output': Broken pipe
��狀態的位置也會落在合理範圍
           內，不會一開始就貼近戰鬥資訊框。
        */

        wrap.style.top=
            "37%";

    }


    if(img){

        img.style.width=
            "70px";

        applyPatrolCharacterArtwork(
            false
        );

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


    applyPatrolCharacterArtwork(
        movingUp
    );


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
            "none";

        img.src=
            PATROL_FIGHT1_B64;

    }


    const t1=
        setTimeout(()=>{

            patrolFightAnimTimeoutIds=
                patrolFightAnimTimeoutIds.filter(id=>id!==t1);

            if(img){

                img.style.transform=
                    "none";

                img.src=
                    PATROL_FIGHT2_B64;

            }

        },500);


    const t2=
        setTimeout(()=>{

            patrolFightAnimTimeoutIds=
                patrolFightAnimTimeoutIds.filter(id=>id!==t2);

            patrolInFightAnimation=
                false;


            if(img){

                img.style.width=
                    "70px";

                applyPatrolCharacterArtwork(
                    false
                );

            }


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
     tail: error writing 'standard output': Broken pipe
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

    patrolLifecycleGeneration++;


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


function exitPatrolContext(reason){

    if(battleActive){
        return false;
    }

    stopMonsterMovement();
    stopAutoPatrol();

    if(typeof window!=="undefined"){
        window.v173PatrolLastExitReason=String(reason||"unknown");
    }

    return true;
}

if(typeof window!=="undefined"){
    window.FourSymbolsPatrolLifecycle=Object.freeze({
        exit:exitPatrolContext,
        isActive:function(){
            return autoPatrolEnabled&&isPatrolMapActive();
        }
    });
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


    if(
        !isPatrolMapActive()
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

            const transitionGeneration=
                patrolLifecycleGeneration;


            playPatrolFightAnimation(
                ()=>{

                    patrolBattleTransitionPending=
                        false;

                    if(
                        transitionGeneration!==patrolLifecycleGeneration tail: error writing 'standard output': Broken pipe
bwrap: Can't get type of source /workspace/scratch/2feca6ea11c3/.aws: No such file or directory
nst targetCell=
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
       結算路徑上；只要其中任何一條路徑沒有重新排程�tail: error writing 'standard output': Broken pipe
bwrap: Can't get type of source /workspace/scratch/2feca6ea11c3/.aws: No such file or directory
tail: error writing 'standard output': Broken pipe
�，
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

    beginBattleStatisticsSession();


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

    notifyBattleRoundBoundary("round_start",token);

    const bossRoundOwner=typeof window!=="undefined"?window.FourSymbolsBossBattle:null;
    if(bossRoundOwner&&typeof bossRoundOwner.processRound==="function"&&
       bossRoundOwner.processRound()===true){
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
   bwrap: Can't find source path /workspace/scratch/2feca6ea11c3/.aws: No such file or directory
bwrap: Can't get type of source /workspace/scratch/2feca6ea11c3/.aws: No such file or directory
.sq-icon-wrap",".sq-icon-image",".sq-icon-fallback",".sq-sp-block",
        ".sq-name",".sq-cost",".v135-sq-scope"
    ].every(selector=>!!button.querySelector(selector));
}

function ensureSkillQuickBarButtons(bar){
    let buttons=Array.from(bar.children).filter(node=>node.classList&&node.classList.contains("skill-quick-button"));
    if(
        bar.children.length===4&&
        buttons.length===4&&
        buttons.every(isCanonicalSkillQuickBarButton)
    ){
        return buttons;
    }

    bar.replaceChildren();

    for(let i=0;i<4;i++){
        const button=document.createElement("button");
        button.className="skill-quick-button";
        button.type="button";
        button.dataset.slot=String(i);
        button.innerHTML=
            '<span class="sq-icon-wrap"><span class="sq-icon-image"></span><span class="sq-icon-fallback"></span><span class="sq-sp-block" hidden>SP不足</span></span>'+
            '<span class="sq-name"></span>'+
            '<span class="sq-cost"></span>'+
            '<span class="v135-sq-scope"></span>';
        button.onclick=()=>{
            const skillId=button.dataset.skillId||"";
            if(skillId&&!button.disabled){ prepareAction(skillId); }
        };
        bar.appendChild(button);
    }

    bumpBattleRuntimeMetric("quickBarRebuild");
    buttons=Array.from(bar.children);
    return buttons;
}

function syncSkillQuickBarButton(button,skillId,skill,skillLevel,spCost,enoughSP){
    const iconImage=button.querySelector(".sq-icon-image");
    const iconFallback=button.querySelector(".sq-icon-fallback");
    const spBlock=button.querySelector(".sq-sp-block");
    const nameNode=button.querySelector(".sq-name");
    const costNode=button.querySelector(".sq-cost");
    const scopeNode=button.querySelector(".v135-sq-scope");

    button.dataset.skillId=skillId||"";

    if(!skillId||!skill){
        button.disabled=true;
        button.classList.remove("sp-insufficient");
        if(iconImage){ iconImage.style.backgroundImage=""; iconImage.hidden=true; }
        if(iconFallback){ iconFallback.innerHTML=""; iconFallback.hidden=false; }
        if(spBlock){ spBlock.hidden=true; }
        if(nameNode){ nameNode.textContent=skillId?"資料錯誤":"（空）"; }
        if(costNode){ costNode.textContent="—"; }
        if(scopeNode){ scopeNode.textContent=""; }
        return;
    }

    button.disabled=!enoughSP;
    button.classList.toggle("sp-insufficient",!enoughSP);

    const iconBackground=typeof getSkillIconBackgroundImage==="function"
        ?getSkillIconBackgroundImage(skillId):"";

    if(iconImage){
        iconImage.hidden=!iconBackground;
        if(iconBackground&&iconImage.style.backgroundImage!==iconBackground){
            iconImage.style.backgroundImage=iconBackground;
        }else if(!iconBackground){
            iconImage.style.backgroundImage="";
        }
    }
    if(iconFallback){
        const fallback=!iconBackground&&typeof getElementIconHTML==="function"
            ?getElementIconHTML(skill.element):"";
        iconFallback.hidden=!!iconBackground;
        if(iconFallback.innerHTML!==fallback){ iconFallback.innerHTML=fallback; }
    }

    if(spBlock){ spBlock.hidden=!!enoughSP; }
    if(nameNode){
        const text=skill.name+(skillLevel>0?" Lv."+skillLevel:"");
        if(nameNode.textContent!==text){ nameNode.textContent=text; }
    }
    if(costNode){
        const text="消耗 "+spCost+" SP";
        if(costNode.textContent!==text){ costNode.textContent=text; }
    }

    const formalSpec=typeof window!=="undefined"?window.FourSymbolsSkillSpec:null;
    if(scopeNode){
        const targetLabel=formalSpec&&typeof formalSpec.targetLabel==="function"
            ?formalSpec.targetLabel(skill,Math.max(1,skillLevel||1))
            :(typeof window!=="undefined"&&typeof window.v135GetSkillTargetScopeLabel==="function"
                ?window.v135GetSkillTargetScopeLabel(skill):"");
        if(scopeNode.textContent!==targetLabel){ scopeNode.textContent=targetLabel; }
    }
}

function populateSkillQuickBar(){

    bumpBattleRuntimeMetric("quickBtail: error writing 'standard output': Broken pipe
arPopulate");

    const overlay=$("skillQuickBar");
    if(overlay){
        overlay.classList.remove("show");
    }

    syncTurnTimerWithBattlePickers();

    const bar=$("skillQuickBarGrid");
    if(!bar){
        return;
    }

    const autoOn=
        activeBattleCharacterIndex===0
        ?autoBattle
        :getPartyAutoConfig(activeBattleCharacterIndex).enabled;

    if(!battleActive||autoOn){
        return;
    }

    const activeCharacterId=getPartyCharacterKey(activeBattleCharacterIndex);
    const activeCharacterObj=getPartyCharacterByIndex(activeBattleCharacterIndex);
    const character=characterSkillLoadouts[activeCharacterId];
    const buttons=ensureSkillQuickBarButtons(bar);

    for(let i=0;i<4;i++){
        const skillId=character&&Array.isArray(character.equippedSkills)
            ?character.equippedSkills[i]
            :null;
        const skill=skillId?skillDatabase[skillId]:null;

        if(!skillId||!skill||!activeCharacterObj){
            syncSkillQuickBarButton(buttons[i],skillId,skill,0,0,false);
            continue;
        }

        const skillLevel=getSkillLevel(activeCharacterId,skillId);
        const spCost=skill.spCost!==undefined?skill.spCost:(skill.cost||0);
        const enoughSP=activeCharacterObj.sp>=spCost;
        syncSkillQuickBarButton(buttons[i],skillId,skill,skillLevel,spCost,enoughSP);
    }
}

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


function getBattleActionTargetType(actionType,characterIndex){
    if(actionType==="normal"){ return "single"; }
    const skill=skillDatabase[actionType];
    if(!skill){ return "single"; }
    const key=getPartyCharacterKey(characterIndex);
    const level=key?getSkillLevel(key,actionType):1;
    return normalizeBattleTargetType(getEffectiveSkillTargetType(skill,Math.max(1,level||1)));
}

function setBattleTargetSelectionMode(actionType){
    const region=$("battleActionRegion");
    const promptAction=$("battleTargetPromptAction");
    const targetType=getBattleActionTargetType(actionType,activeBattleCharacterIndex);

    if(region){ region.classList.add("target-selecting"); }
    if(promptAction){ promptAction.textContent="選擇 ["+getBattleActionDisplayName(actionType)+"]"; }
    currentBattleMonsters.forEach(index=>{
        const card=$("battleMonster"+index);
        if(card){ card.classList.toggle("targetable",canSelectHostileBattlePrimary("monster",index,targetType)); }
    });
    const targetText=$("battleTarget");
    if(targetText){ targetText.textContent="目標：請選擇"; }
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
        iftail: error writing 'standard output': Broken pipe
bwrap: Can't get type of source /workspace/scratch/2feca6ea11c3/.aws: No such file or directory
bwrap: Can't get type of source /workspace/scratch/2feca6ea11c3/.aws: No such file or directory
bwrap: Can't get type of source /workspace/scratch/2feca6ea11c3/.aws: No such file or directory
bwrap: Can't get type of source /workspace/scratch/2feca6ea11c3/.aws: No such file or directory
bwrap: Can't get type of source /workspace/scratch/2feca6ea11c3/.aws: No such file or directory
bwrap: Can't get type of source /workspace/scratch/2feca6ea11c3/.aws: No such file or directory
bwrap: Can't get type of source /workspace/scratch/2feca6ea11c3/.aws: No such file or directory
bwrap: Can't find source path /workspace/scratch/2feca6ea11c3/.aws: No such file or directory
bwrap: Can't get type of source /workspace/scratch/2feca6ea11c3/.aws: No such file or directory
�仍按硬控原本的0.3
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

    bonus-=getFrostbiteFinalPercentPointPenalty(character);
    return bonus;
}

function calculateStatusEffectChance(
    baseChancePercent,
    casterLevel,
    targetLevel,
    offensiveAttribute,
    targetSpirit,
    isLockdown,
    targetRank,
    targetBonusResistancePercent,
    finalStatusBonusPercent
){
    /*
       最終異常／硬控成功率 =
       技能基礎成功率
       + 施放者主屬性×0.05%
       + 最終異常命中加成
       - 目標精神×0.05%
       - 其他最終異常抗性。

       casterLevel / targetLevel 保留在參數列只為相容既有 caller，
       正式公式不再使用等級差倍率、sqrt 屬性公式或硬控專屬精神係數。
    */
    void casterLevel;
    void targetLevel;

    const attributeBonus=
        Math.max(0,Number(offensiveAttribute)||0)*
        STATUS_OFFENSE_ATTRIBUTE_COEFFICIENT;

    const spiritResistance=
        Math.max(0,Number(targetSpirit)||0)*
        STATUS_RESIST_PER_SPIRIT_POINT;

    const targetResistancePercent=Math.max(
        0,
        spiritResistance+(Number(targetBonusResistancePercent)||0)
    );

    const rawChance=
        (Number(baseChancePercent)||0)+
        attributeBonus+
        (Number(finalStatusBonusPercent)||0)-
        targetResistancePercent;

    const bounds=isLockdown
        ?(LOCKDOWN_HIT_BOUNDS[targetRank]||LOCKDOWN_HIT_BOUNDS.regular)
        :{min:STATUS_HIT_MIN_PERCENT,max:STATUS_HIT_MAX_PERCENT};

    return Math.max(bounds.min,Math.min(bounds.max,rawChance));
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
    offensiveAttribute,
    targetSpirit,
    isLockdown,
    targetRank,
    targetBonusResistancePercent,
    finalStatusBonusPercent
){

    const chance=calculateStatusEffectChance(
        baseChancePercent,
        casterLevel,
        targetLevel,
        offensiveAttribute,
        targetSpirit,
        isLockdown,
        targetRank,
        targetBonusResistancePercent,
        finalStatusBonusPercent
    );

    return Math.random()*100<chance;

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
   不套用等級差距係數、也不tail: error writing 'standard output': Broken pipe
tail: error writing 'standard output': Broken pipe
套用防禦力減免，
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

    if(!skill || level<=0 || !Number.isFinite(Number(skill.baseDamage))){
        return 0;
    }

    const resolvedLevel=Math.max(1,Math.floor(Number(level)||1));
    const growth=Number.isFinite(Number(skill.damagePerLevel))
        ?Number(skill.damagePerLevel)
        :0;
    let damage=Number(skill.baseDamage);

    for(let current=2;current<=resolvedLevel;current++){
        if(current===5 || current===10){
            damage=Math.round(damage*1.5);
        }else{
            damage+=growth;
        }
    }

    return Math.max(0,Math.round(damage));

}


/*
   依技能的目標型態，算出這次攻擊實際會打到哪些怪物
   （回傳的是monsters陣列的原始index清單）。

   single：只打選定的目標。
   一般戰鬥由 FourSymbolsBattlefieldSlots 的固定十格快照解析
   single / tri / row / column / all；死亡後不會重新補位。
   Boss 專屬模式則先交給 FourSymbolsBossBattle：除 all 外一律
   只結算 primary target。這裡是敵方傷害目標的唯一 owner。
*/

function getSkillLevelArrayValue(values,level,fallback){
    if(!Array.isArray(values)||!values.length){ return Number(fallback)||0; }
    const index=Math.max(0,Math.min(values.length-1,Math.floor(Number(level)||1)-1));
    return Number(values[index])||0;
}
function getEffectiveSkillTargetType(skill,level){
    const base=String(skill&&skill.targetType||"single");
    if(!skill||!skill.targetTypeAtMaxLevel){ return base; }
    const maxLevel=Math.max(1,Math.floor(Number(skill.maxLevel)||1));
    const resolvedLevel=Math.max(1,Math.floor(Number(level)||1));
    return resolvedLevel>=maxLevel?String(skill.targetTypeAtMaxLevel):base;
}
function getSkillFreezeChanceAtLevel(skill,level){
    return Math.max(0,getSkillLevelArrayValue(skill&&skill.freezeChanceByLevel,level,skill&&skill.freezeChance));
}
function getSkillFreezeDurationAtLevel(skill,level){
    return Math.max(1,Math.floor(getSkillLevelArrayValue(skill&&skill.freezeDurationByLevel,level,skill&&skill.freezeDuration||1)));
}
function normalizeBattleTargetType(targetType){
    const value=String(targetType||"single");
    if(value==="allyTri"||value==="horizontal-3"){ return "tri"; }
    if(value==="allyAll"||value==="enemyAll"){ return "all"; }
    if(value==="ally"||value==="normal"){ return "single"; }
    return value;
}
function getBattleTargetEntity(targetSide,index){
    if(targetSide==="player"){ return getPartyCharacterByIndex(index); }
    return Array.isArray(monsters)?monsters[index]||null:null;
}
function isBattleTargetAlive(targetSide,index){
    const entity=getBattleTargetEntity(targetSide,index);
    return !!(entity&&Number(entity.hp)>0&&(targetSide!=="monster"||entity.alive!==false));
}
function isBattleTargetStealthed(entity){
    if(!entity){ return false; }
    if(typeof hasNamedPersistentState==="function"&&hasNamedPersistentState(entity,"stealthSkill")){ return true; }
    return []
        .concat(Array.isArray(entity.activeBuffs)?entity.activeBuffs:[])
        .concat(Array.isArray(entity.v141TeamBuffs)?entity.v141TeamBuffs:[])
        .some(buff=>buff&&Number(buff.turnsLeft)>0&&(
            buff.type==="stealthSkill"||buff.v141BuffType==="stealthSkill"||buff.statusName==="隱身"
        ));
}
function canSelectHostileBattlePrimary(targetSide,index,targetType){
    const normalized=normalizeBattleTargetType(targetType);
    if(normalized==="all"||!isBattleTargetAlive(targetSide,index)){ return false; }
    return !isBattleTargetStealthed(getBattleTargetEntity(targetSide,index));
}
function resolveBattlefieldTargets(targetSide,primaryIndex,targetType,options){
    const normalized=normalizeBattleTargetType(targetType);
    const config=options&&typeof options==="object"?options:{};
    const indexes=targetSide==="player"?getExistingPartyIndexes():currentBattleMonsters.filter(Number.isInteger);
    const alive=index=>isBattleTargetAlive(targetSide,index);

    if(normalized==="all"){ return indexes.filter(alive); }
    if(!Number.isInteger(primaryIndex)||!alive(primaryIndex)){ return []; }
    if(config.hostilePrimary!==false&&!canSelectHostileBattlePrimary(targetSide,primaryIndex,normalized)){ return []; }

    const owner=typeof window!=="undefined"?window.FourSymbolsBattlefieldSlots:null;
    if(owner){
        if(targetSide==="monster"&&typeof owner.getActiveEnemySnapshot==="function"&&typeof owner.resolveEnemyTargets==="function"){
            const snapshot=owner.getActiveEnemySnapshot();
            if(snapshot){ return owner.resolveEnemyTargets(snapshot,primaryIndex,normalized,alive); }
        }
        if(targetSide==="player"&&typeof owner.ensureAllyFormation==="function"&&typeof owner.resolveAllyTargets==="function"){
            const formation=owner.ensureAllyFormation(indexes);
            return owner.resolveAllyTargets(formation,primaryIndex,normalized,alive);
        }
    }

    const position=indexes.indexOf(primaryIndex);
    if(position<0){ return []; }
    if(normalized==="single"){ return [primaryIndex]; }
    if(normalized==="tri"||normalized==="row"){
        const width=3;
        const start=Math.floor(position/width)*width;
        const row=indexes.slice(start,start+width).filter(alive);
        if(normalized==="row"){ return row; }
        const centerPosition=position-start;
        return row.filter(index=>Math.abs((indexes.indexOf(index)-start)-centerPosition)<=1);
    }
    if(normalized==="column"){
        const width=3;
        const column=position%width;
        return indexes.filter((index,slotPosition)=>slotPosition%width===column&&alive(index));
    }
    return [primaryIndex];
}
if(typeof window!=="undefined"){
    window.FourSymbolsBattleSkillTargeting=Object.freeze({
        effectiveTargetType:getEffectiveSkillTargetType,
        freezeChanceAtLevel:getSkillFreezeChanceAtLevel,
        freezeDurationAtLevel:getSkillFreezeDurationAtLevel,
        normalizeTargetType:normalizeBattleTargetType,
        isStealthed:isBattleTargetStealthed,
        canSelectHostilePrimary:canSelectHostileBattlePrimary,
        resolveTargets:resolveBattlefieldTargets
    });
}
function getSkillTargets(centerIndex,targetType){
    const normalized=normalizeBattleTargetType(targetType);
    const bossOwner=typeof window!=="undefined"?window.FourSymbolsBossBattle:null;
    if(bossOwner&&typeof bossOwner.isActive==="function"&&bossOwner.isActive()&&
       typeof bossOwner.resolveEnemyDamageTargets==="function"){
        if(normalized!=="all"&&!canSelectHostileBattlePrimary("monster",centerIndex,normalized)){ return []; }
        return bossOwner.resolveEnemyDamageTargets(centerIndex,normalized);
    }
    return resolveBattlefieldTargets("monster",centerIndex,normalized,{hostilePrimary:true});
}


/* =====================================================
   Persistent-state identity

   Every lasting effect is identified by its formal state name. A target
   that already owns an active state with the same name rejects the new
   application before any status-chance roll is made. Freeze and Petrify are
   additionally members of one exclusive hard-control group: either active
   member blocks both names until it expires or is formally removed. The rule
   is shared by skills, monsters, Boss/Abyss actions, items and relics that
   enter the canonical persistent-state pipeline.
===================================================== */

const PERSISTENT_STATE_NAMES=Object.freeze({
    burn:"燃燒",
    rage:"怒火",
    fireSoulResonance:"炎魂共鳴",
    bloodBurn:"焚血",
    fireMomentum:"炎勢",
    phoenixMight:"鳳威",
    yuanZuBlessing:"元祖賜福",
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

const EXCLUSIVE_HARD_CONTROL_STATE_NAMES=Object.freeze(["冰封","石化"]);

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

function getPersistentStateConflict(entity,statetail: error writing 'standard output': Broken pipe
OrType){
    const requestedName=getPersistentStateName(stateOrType);
    if(!requestedName){ return null; }
    const conflictNames=EXCLUSIVE_HARD_CONTROL_STATE_NAMES.includes(requestedName)
        ?EXCLUSIVE_HARD_CONTROL_STATE_NAMES
        :[requestedName];
    const entry=getPersistentStateEntries(entity).find(candidate=>
        isActivePersistentStateEntry(candidate)&&
        conflictNames.includes(getPersistentStateName(candidate))
    );
    if(!entry){ return null; }
    return {
        requestedName:requestedName,
        existingName:getPersistentStateName(entry),
        entry:entry,
        exclusiveHardControl:EXCLUSIVE_HARD_CONTROL_STATE_NAMES.includes(requestedName)
    };
}

function markPersistentStateName(entry,stateOrType){
    if(entry&&typeof entry==="object"){
        entry.statusName=getPersistentStateName(stateOrType||entry);
    }
    return entry;
}

function reportPersistentStateMiss(entity,stateOrType,targetSide,targetIndex,sourceName,conflict){
    const stateName=getPersistentStateName(stateOrType);
    const existingName=conflict&&conflict.existingName||stateName;
    if(typeof showMissEffect==="function"&&Number.isInteger(targetIndex)){
        showMissEffect(targetSide==="player",targetIndex,"狀態MISS");
    }
    if(typeof addBattleLog==="function"){
        const targetName=entity&&(entity.name||entity.id)||"目標";
        const existingPrefix=existingName===stateName?"已有":"目前已有";
        addBattleLog(
            (sourceName?sourceName+"：":"")+targetName+existingPrefix+"【"+existingName+"】，新的【"+stateName+"】MISS。"
        );
    }
    return false;
}

function canApplyNamedPersistentState(entity,stateOrType,targetSide,targetIndex,sourceName){
    const conflict=getPersistentStateConflict(entity,stateOrType);
    return conflict
        ?reportPersistentStateMiss(entity,stateOrType,targetSide,targetIndex,sourceName,conflict)
        :true;
}

function getPersistentStateTargetContext(entity){
    const partyIndex=typeof getPartyCharacterIndex==="function"
        ?getPartyCharacterIndex(entity)
        :-1;
    if(Number.isInteger(partyIndex)&&partyIndex>=0){
        return {targetSide:"player",targetIndex:partyIndex};
    }
    const monsterIndex=typeof monsters!=="undefined"&&Array.isArray(monsters)
        ?monsters.indexOf(entity)
        :-1;
    if(monsterIndex>=0){
        return {targetSide:"monster",targetIndex:monsterIndex};
    }
    return {targetSide:null,targetIndex:undefined};
}

function getMonsterTimedStatusResistanceBonus(monster){
    if(!monster){ return 0; }
    const teamBuff=(monster.v141TeamBuffs||[]).find(buff=>
        buff&&buff.type==="resistance"&&Number(buff.turnsLeft)>0
    );
    const directBuff=(monster.activeBuffs||[]).find(buff=>
        buff&&buff.type==="dinghaishenzhen"&&Number(buff.turnsLeft)>0
    );
    const positive=teamBuff
        ?Math.max(0,Number(teamBuff.amount)||0)
        :(directBuff?Math.max(0,Number(directBuff.resistBonus)||0):0);
    return positive-getFrostbiteFinalPercentPointPenalty(monster);
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
window.v173GetPersistentStateConflict=getPersistentStateConflict;
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

    const targetContext=getPersistentStateTargetContext(monster);
    if(!canApplyNamedPersistentState(
        monster,"freeze",targetContext.targetSide,targetContext.targetIndex
    )){
        return false;
    }

    if(!monster.stattail: error writing 'standard output': Broken pipe
bwrap: Can't get type of source /workspace/scratch/2feca6ea11c3/.aws: No such file or directory
bwrap: Can't get type of source /workspace/scratch/2feca6ea11c3/.aws: No such file or directory
新增（依照使用者要求，「野怪異常
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
    casterOffensiveAttribute
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
                casterOffensiveAttribute,targetFinalSpirit,false,"regular",
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
                casterOffensiveAttribute,targetFinalSpirit,false,"regular",
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
                casterOffensiveAttribute,targetFinalSpirit,false,"regular",
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
                casterOffensiveAttribute,targetFinalSpirit,false,"regular",
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
  tail: error writing 'standard output': Broken pipe
          targetCharacter,"stun",[
                skill.stunChance,casterLevel,targetCharacter.level,
                casterOffensiveAttribute,targetFinalSpirit,false,"regular",
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
                "陷入暈眩，最終命中率降低！"
            );

        }

    }


    if(skill.freezeChance){

        const hit=rollNamedPersistentStatusEffect(
            targetCharacter,"freeze",[
                skill.freezeChance,casterLevel,targetCharacter.level,
                casterOffensiveAttribute,targetFinalSpirit,true,"player",
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
                chance,casterLevel,targetCharacter.level,casterOffensiveAttribute,
                targetFinalSpirit,true,"player",getPlayerStatusResistBonus(targetCharacter)
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
                casterOffensiveAttribute,targetFinalSpirit,false,"regular",
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
                            return Number(effect.turnsLeft)>0;
                        }


                        if(
                            simpleDebuffLabels[
                                effect.type
                            ]
                        ){
                            return Number(effect.turnsLeft)>0;
                        }


                        if(
                            effect.type!=="burn"
                        ){
                            return true;
                        }


                        const burnMultiplier=effect.sourceAtail: error writing 'standard output': Broken pipe
bwrap: Can't get type of source /workspace/scratch/2feca6ea11c3/.aws: No such file or directory
bwrap: Can't get type of source /workspace/scratch/2feca6ea11c3/.aws: No such file or directory
bwrap: Can't find source path /workspace/scratch/2feca6ea11c3/.aws: No such file or directory
只打中一隻」這種對不上
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
            const freezeChance=getSkillFreezeChanceAtLevel(skill,level);
            const freezeDuration=getSkillFreezeDurationAtLevel(skill,level);
            if(freezeChance>0){
                const freezeRoll=rollNamedPersistentStatusEffect(
                    monster,"freeze",[
                        freezeChance,player.level,monster.level,
                        stats.intelligence,getMonsterEffectiveSpiritPoints(monster),
                        true,getMonsterRank(monster)
                    ],"monster",index,skill.name
                );
                if(freezeRoll.hit){
                    applyFreezeEffect(monster,freezeDuration);
                    addBattleLog(monster.name+"被冰封了！");
                }else if(!freezeRoll.duplicate){
                    showMissEffect(false,index,"抵抗");
                    addBattleLog(skill.name+"對"+monster.name+"沒有生效（抵抗）。");
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
                ),
                getActiveAccuracyBonusPercent(player)
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
                getMonsterEffectiveAntiCrit(monster),
                monster
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
           �tail: error writing 'standard output': Broken pipe
tail: error writing 'standard output': Broken pipe
�用再跳一次閃避動畫
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
            skill.category==="physical"?stats.attackPoints:stats.intelligence
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
                getWaterExAbsorbPercent(player,lifestealPercent,"hp")/
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
   目bwrap: Can't find source path /workspace/scratch/2feca6ea11c3/.aws: No such file or directory
�被單體攻擊選中，持續"+skill.duration+"回合。"
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
    const casterKey=getCharacterSkillKey(player);
    const exLevel=casterKey?getSkillLevel(casterKey,"waterEX"):0;
    const healBonusMultiplier=(getLearnedElementEX(player,"water") && exSkill && exLevel>0 && exSkill.healBonusPercent)
        ? 1+exSkill.healBonusPercent/100
        : 1;
    const bossOwner=typeof window!=="undefined"?window.FourSymbolsBossBattle:null;
    const bossHealingMultiplier=bossOwner&&typeof bossOwner.getHealingMultiplier==="function"
        ?Math.max(0,Number(bossOwner.getHealingMultiplier())||0):1;

    const baseHealHP=skill.baseHeal+skill.healPerLevel*(level-1);
    const healHP=Math.floor(
        calculateHealingAmount(baseHealHP,casterStats.intelligence)*healBonusMultiplier*bossHealingMultiplier
    );

    const spRestorePercent=Array.isArray(skill.spRestorePercentByLevel)
        ?Number(skill.spRestorePercentByLevel[Math.max(0,Math.min(skill.spRestorePercentByLevel.length-1,level-1))])||0
        :null;
    const potentialHealSP=spRestorePercent!==null
        ?Math.floor(targetStats.maxSP*spRestorePercent/100*healBonusMultiplier*bossHealingMultiplier)
        :Math.floor(
            calculateSPHealingAmount(
                skill.baseHealSP+(skill.healSPPerLevel||0)*(level-1),
                casterStats.intelligence
            )*healBonusMultiplier*bossHealingMultiplier
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

    if(bossHealingMultiplier<1){
        addBattleLog("【鎖脈法器】使本次治療與 SP 回復降低 40%。");
    }

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
   不是這次順手就能生出來的，所以這裡tail: error writing 'standard output': Broken pipe
bwrap: Can't find source path /workspace/scratch/2feca6ea11c3/.aws: No such file or directory
tail: error writing 'standard output': Broken pipe
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

function findAliveTargetIndex(preferredIndex,targetType){
    const resolvedTargetType=normalizeBattleTargetType(targetType||"single");
    if(resolvedTargetType==="all"){ return null; }
    if(Number.isInteger(preferredIndex)&&canSelectHostileBattlePrimary("monster",preferredIndex,resolvedTargetType)){
        return preferredIndex;
    }
    const fallbackIndex=currentBattleMonsters.find(index=>
        canSelectHostileBattlePrimary("monster",index,resolvedTargetType)
    );
    return fallbackIndex===undefined?null:fallbackIndex;
}
function resolveAttackTargetIndex(targetType){
    const index=findAliveTargetIndex(selectedMonster,targetType||"single");
    if(index===null){ finishPlayerAction(); return null; }
    selectedMonster=index;
    return index;
}


/* =====================================================
   普通攻擊/* =====================================================
   普通攻擊
===================================================== */

function normalAttack(){

    if(!battleActive){
        return;
    }


    const index =
        resolveAttackTargetIndex("single");


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
                ),
                getActiveAccuracyBonusPercent(player)
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
            getMonsterEffectiveAntiCrit(monster),
            monster
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
        skilbwrap: Can't get type of source /workspace/scratch/2feca6ea11c3/.aws: No such file or directory
bwrap: Can't get type of source /workspace/scratch/2feca6ea11c3/.aws: No such file or directory
tail: error writing 'standard output': Broken pipe
�會打中一個隨機目標，
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

    const effectiveSkillLevel=
        castSkillData
        ?Math.min(
            castSkillData.maxLevel||1,
            Math.max(
                1,
                Number.isFinite(Number(monster.v141ForceSkillLevel))
                    ?Math.floor(Number(monster.v141ForceSkillLevel))
                    :Math.round(monster.level/8)
            )
        )
        :0;

    const skillTargetType=usesSkill&&castSkillData
        ?getEffectiveSkillTargetType(castSkillData,effectiveSkillLevel)
        :"single";

    const isRangeSkill=["tri","row","column","all"].includes(skillTargetType);

    const livingTargets=getExistingPartyIndexes()
        .map(index=>({
            character:getPartyCharacterByIndex(index),
            stats:getPartyBattleStats(index),
            index:index
        }))
        .filter(entry=>entry.character && entry.character.hp>0);

    /* Stealth blocks primary selection for every targeted hostile shape.
       Range skills still include stealthed units when they are collateral. */
    const selectablePrimaryTargets=livingTargets.filter(entry=>
        canSelectHostileBattlePrimary("player",entry.index,skillTargetType)
    );

    if(skillTargetType!=="all"&&selectablePrimaryTargets.length===0){
        addBattleLog(monster.name+"找不到可被此攻擊選中的目標。");
        updateUI();
        finishPlayerAction();
        return;
    }

    let attackTargets=[];
    let primaryTargetIndex=null;

    if(skillTargetType==="all"){
        attackTargets=livingTargets;
    }else{
        const primary=selectablePrimaryTargets[
            Math.floor(Math.random()*selectablePrimaryTargets.length)
        ];
        primaryTargetIndex=primary?primary.index:null;
        const targetIndexes=primary
            ?resolveBattlefieldTargets("player",primary.index,skillTargetType,{hostilePrimary:true})
            :[];
        attackTargets=targetIndexes.map(index=>
            livingTargets.find(entry=>entry.index===index)
        ).filter(Boolean);
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
            attackTargetIndexes,
            "player",
            skillTargetType
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
       ★ 新增（依照使用者要求，物理/法術
       分開算，完全比照玩家castDamageSkill()
       的規則：skill.category==="magic"用
       法術攻擊，其餘（含沒放技能的普通
       攻擊）用一般攻擊力）：
    */

    /* Pure-control skills keep their status effect but never enter direct-damage settlement. */
    const isPureControlSkill=
        !!(castSkillData && castSkillData.id==="freeze");

    const isMonsterMagicSkill=
        castSkillData &&
        castSkillData.category==="magic";

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


            if(isPureControlSkill){
                const freezeChance=getSkillFreezeChanceAtLevel(castSkillData,effectiveSkillLevel);
                const freezeDuration=getSkillFreezeDurationAtLevel(castSkillData,effectiveSkillLevel);
                const targetFinalSpirit=getFinalBattleSpiritForPlayerTarget(targetCharacter,targetIndex);
                const freezeResult=rollNamedPersistentStatusEffect(
                    targetCharacter,"freeze",[
                        freezeChance,monster.level,targetCharacter.level,
                        getMonsterEffectiveAbilityPoints(monster,"intelligence"),
                        targetFinalSpirit,true,"player",getPlayerStatusResistBonus(targetCharacter)
                    ],"player",targetIndex,castSkillName
                );
                if(freezeResult.hit){
                    applyFreezeEffect(targetCharacter,freezeDuration);
                    addBattleLog((targetCharacter.id||"你")+"被冰封了！");
                }else if(!freezeResult.duplicate){
                    showMissEffect(true,targetIndex,"抵抗");
                    addBattleLog(castSkillName+"對"+(targetCharacter.id||"你")+"沒有生效（抵抗）。");
                }
                return;
            }


            const monsterHit=
                rollHitChance(
                    getMonsterAccuracy(
                        monster
                    ),
                    targetStats.evasion,
                    getMonsterDebuffValue(
                        monster,
                        "stun"
                    ),
                    getActiveAccuracyBonusPercent(monster)
                    ,targetCharacter
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
                !castSkillData &&
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
                :castSkillData
                ?calculateSkillDamage({
                    skill:castSkillData,
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

            let earthShieldReduction=0;


            if(damage>0 && hasBarrier){

                damage=0;


                addBattleLog(
                    ""+
                    (targetCharacter.id||"你")+
                    "的結界完全格擋了這次攻擊！"
                );

            }
            else{

                const earthShieldBuff=(targetCharacter.activeBuffs||[]).find(buff=>
                    buff&&buff.type==="earthShield"&&Number(buff.turnsLeft)>0&&Number(buff.remainingBlocks)>0
                );
                if(damage>0&&earthShieldBuff){
                    const percent=Math.max(0,Math.min(100,Number(earthShieldBuff.percent)||0));
                    earthShieldReduction=Math.max(0,Math.floor(damage*percent/100));
                    damage=Math.max(0,damage-earthShieldReduction);
                    earthShieldBuff.remainingBlocks=Math.max(0,Number(earthShieldBuff.remainingBlocks)-1);
                    if(earthShieldBuff.remainingBlocks<=0){
                        targetCharacter.activeBuffs=targetCharacter.activeBuffs.filter(bufftail: error writing 'standard output': Broken pipe
tail: error writing 'standard output': Broken pipe
=>buff!==earthShieldBuff);
                    }
                }

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

            if(earthShieldReduction>0){

                const reflectDamage=earthShieldReduction;


                const hpBeforeReflect=Math.max(0,Number(monster.hp)||0);
                monster.hp=
                    Math.max(
                        0,
                        monster.hp-
                        reflectDamage
                    );
                battleStatisticsRecordDamageDealtByIndex(
                    targetIndex,
                    Math.max(0,hpBeforeReflect-monster.hp)
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
  tail: error writing 'standard output': Broken pipe
              castSkillData &&
                targetCharacter.hp>0
            ){

                applySkillDebuffEffectsToPlayer(
                    castSkillData,
                    effectiveSkillLevel,
                    targetCharacter,
                    targetIndex,
                    monster.level,
                    getMonsterEffectiveAbilityPoints(
                        monster,
                        castSkillData.category==="physical"?"attack":"intelligence"
                    )
                );

            }

            if(
                usesSkill &&
                castSkillData &&
                castSkillData.lifestealPercentByLevel &&
                damage>0
            ){
                monsterLifestealDamage+=damage;
            }

        }
    );


    if(
        usesSkill &&
        castSkillData &&
        castSkillData.lifestealPercentByLevel &&
        monsterLifestealDamage>0 &&
        monster.alive
    ){
        const percent=castSkillData.lifestealPercentByLevel[effectiveSkillLevel-1];
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

    /* HP settlement belongs to the core battle flow. Any damage source may
       reduce HP to zero; adapters must not wrap queue functions merely to
       translate that state into the single canonical death path. */
    currentBattleMonsters.forEach(index=>{
        const monster=monsters[index];
        if(monster&&monster.alive!==false&&Number(monster.hp)<=0){
            killMonster(index);
        }
    });


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
    clearBattleRoundPrompt();
    finishBattleStatisticsSession("win");

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
    clearTransientBattlePresentation();

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
  tail: error writing 'standard output': Broken pipe
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
    clearBattleRoundPrompt();
    finishBattleStatisticsSession("lose");

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
    clearTransientBattlePresentation();


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
         tail: error writing 'standard output': Broken pipe
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
    timerId=null;

    const alive=currentBattleMonsters.map(i=>monsters[i]).filter(m=>m&&m.alive);
    if(alive.length===0){ checkBattleEnd(); return; }

    const highestLevel=Math.max(...alive.map(m=>m.level));
    const escapingCharacter=getPartyCharacterByIndex(characterIndex)||player;
    const chance=Math.max(10,Math.min(95,50+(escapingCharacter.level-highestLevel)*5));
    const succeeded=Math.random()*100<chance;
    const presentationOwner=typeof window!=="undefined"?window.FourSymbolsBattlePresentation:null;
    const feedbackOwner=typeof window!=="undefined"?window.FourSymbolsBattleFloatingFeedback:null;
    const motion=presentationOwner&&typeof presentationOwner.playEscape==="function"
        ?presentationOwner.playEscape(characterIndex,succeeded)
        :Promise.resolve(true);

    actionReady=false;
    pendingAction=null;

    if(!succeeded){
        addBattleLog("逃脫失敗！");
        Promise.resolve(motion).then(()=>{
            const feedback=feedbackOwner&&typeof feedbackOwner.emitEscapeFailure==="function"
                ?feedbackOwner.emitEscapeFailure(characterIndex)
                :null;
            return feedback&&feedback.promise?feedback.promise:Promise.resolve();
        }).then(()=>{
            if(typeof battleActive==="undefined"||battleActive){ finishPlayerAction(); }
        }).catch(()=>{
            if(typeof battleActive==="undefined"||battleActive){ finishPlayerAction(); }
        });
        return;
    }

    addBattleLog("成功逃脫！");
    Promise.resolve(motion).then(()=>{
        const finishEscapeRoute=()=>{
            if(window.v132ActiveDungeonRun&&typeof window.v132AbortDungeonBattle==="function"){
                window.v132AbortDungeonBattle("escape");
            }else{
                battleActive=false;
                autoBattle=false;
                actionReady=false;
                pendingAction=null;
                clearBattleRoundPrompt();
                clearInterval(timerId);
                timerId=null;
                if(battleAdvanceTimeoutId){
                    clearTimeout(battleAdvanceTimeoutId);
                    battleAdvanceTimeoutId=null;
                }
                clearBattleActionWatchdog();
                battleAdvanceScheduled=false;
                battleToken++;
                if(typeof finishBattleStatisticsSession==="function"){ finishBattleStatisticsSession("escape"); }
                closeMenus();
                if(window.v142SkillAnimationDirector){ window.v142SkillAnimationDirector.dispose(); }
                if(feedbackOwner&&typeof feedbackOwner.clear==="function"){ feedbackOwner.clear(); }
                showPage("map");
                setMapCooldown(3000);
                startMonsterMovement();
                ensureAutoPatrolInterval();
            }
            if(presentationOwner&&typeof presentationOwner.cleanupEscape==="function"){
                presentationOwner.cleanupEscape();
            }
            return true;
        };
        if(typeof window.v141PlayEscapeBattleExit==="function"){
            return window.v141PlayEscapeBattleExit(finishEscapeRoute);
        }
        return finishEscapeRoute();
    }).catch(()=>{
        if(presentationOwner&&typeof presentationOwner.cleanupEscape==="function"){
            presentationOwner.cleanupEscape();
        }
    });
}


/* =====================================================
   技能選單
===================================================== */

function openSkillMenu(){

    /*
       ★ 修正：
       ��本這裡永遠讀characterSkillLoadouts.fire、
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
        itemMenu.classList.remove("stail: error writing 'standard output': Broken pipe
bwrap: Can't get type of source /workspace/scratch/2feca6ea11c3/.aws: No such file or directory
bwrap: Can't get type of source /workspace/scratch/2feca6ea11c3/.aws: No such file or directory
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
   tail: error writing 'standard output': Broken pipe
bwrap: Can't get type of source /workspace/scratch/2feca6ea11c3/.aws: No such file or directory
bwrap: Can't get type of source /workspace/scratch/2feca6ea11c3/.aws: No such file or directory
�的
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

tail: error writing 'standard output': Broken pipe
tail: error writing 'standard output': Broken pipe

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
    const autoOn=characterIndex===0?autoBattle:config.enabled;

    if(!battleActive||!character||character.hp<=0||!autoOn||token!==battleToken){ return; }

    if(config.skill==="defend"){
        queuedPlayerActions[characterIndex]={action:"defend",target:null};
        updateUI(); finishPlayerAction(); return;
    }

    const aliveInBattle=currentBattleMonsters.filter(index=>isBattleTargetAlive("monster",index));
    if(aliveInBattle.length===0){ checkBattleEnd(); return; }

    let action=config.skill||"normal";
    let skill=action!=="normal"?skillDatabase[action]:null;
    const skillKey=getPartyCharacterKey(characterIndex);
    if(action!=="normal"&&(
        !skill||
        getSkillLevel(skillKey,action)<=0||
        character.sp<(skill.spCost!==undefined?skill.spCost:(skill.cost||0))||
        ["buff","passive","heal","revive"].includes(skill.category)
    )){
        action="normal";
        skill=null;
    }

    const skillLevel=skill?getSkillLevel(skillKey,action):0;
    const targetType=skill
        ?normalizeBattleTargetType(getEffectiveSkillTargetType(skill,skillLevel))
        :"single";

    if(targetType==="all"){
        queuedPlayerActions[characterIndex]={action:action,target:null};
        updateUI(); finishPlayerAction(); return;
    }

    const candidates=aliveInBattle.filter(index=>
        canSelectHostileBattlePrimary("monster",index,targetType)
    );
    if(!candidates.length){
        queuedPlayerActions[characterIndex]={action:"defend",target:null};
        addBattleLog((character.id||"角色")+"找不到可被單體／指定範圍攻擊選中的目標，改為防禦。");
        updateUI(); finishPlayerAction(); return;
    }

    let target=candidates[0];
    if(skill&&["tri","row","column"].includes(targetType)){
        let bestCount=-1;
        candidates.forEach(candidate=>{
            const hitCount=getSkillTargets(candidate,targetType).length;
            if(hitCount>bestCount){ bestCount=hitCount; target=candidate; }
        });
    }

    queuedPlayerActions[characterIndex]={action:action,target:target};
    updateUI();
    finishPlayerAction();
}

function autoAction(token){
    return autoActionForCharacter(0,token);
}

/* Additional party members share the same declaration owner. */
function player2AutoAction(token){
    return autoActionForCharacter(1,token);
}

function player3AutoAction(token){
    return autoActionForCharacter(2,token);
}


function secondaryCharacterNormalAttack(characterIndex,index){

    const character=getPartyCharacterByIndex(characterIndex);
    const stats=getPartyBattleStats(characterIndex);

    index=findAliveTargetIndex(index,"single");

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
        getMonsterDebuffValue(character,"stun"),
        getActiveAccuracyBonusPercent(character)
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
        getMonsterEffectiveAntiCrit(monster),
        monster
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

    const effectiveTargetType=getEffectiveSkillTargetType(skill,level);
    centerIndex=normalizeBattleTargetType(effectiveTargetType)==="all"
        ?null
        :findAliveTargetIndex(centerIndex,effectiveTargetType);

    if(normalizeBattleTargetType(effectiveTargetType)!=="all"&&centerIndex===null){
        finishPlayerAction();
        return;
    }

    const targets=getSkillTargets(centerIndex,effectiveTargetType);
    if(!targets.length){
        finishPlayerAction();
        return;
    }

    character.sp-=spCost;
    lungePlayerCard(characterIndex);
    showSkillNameBadge(
        skill.name,skill.element,characterIndex,
        effectiveTargetType==="all"?null:centerIndex,targets,undefined,effectiveTargetType
    );
    setTimeout(()=>showPlayerSpPopup(spCost,characterIndex),500);

    const statBonus=skill.category==="magic" ? stats.magicAttack : stats.attack;

    if(!skill.baseDamage){
        const freezeChance=getSkillFreezeChanceAtLevel(skill,level);
        const freezeDuration=getSkillFreezeDurationAtLevel(skill,level);
        targets.forEach(index=>{
            const monster=monsters[index];
            if(!monster||!monster.alive||freezeChance<=0){ return; }
            const freezeResult=rollNamedPersistentStatusEffect(
                monster,"freeze",[
                    freezeChance,character.level,monster.level,
                    stats.intelligence,getMonsterEffectiveSpiritPoints(monster),
                    true,getMonsterRank(monster)
                ],"monster",index,skill.name
            );
            if(freezeResult.hit){
                applyFreezeEffect(monster,freezeDuration);
                addBattleLog(monster.name+"被冰封了！");
            }else if(!freezeResult.duplicate){
                showMissEffect(false,index,"抵抗");
                addBattleLog(skill.name+"對"+monster.name+"沒有生效（抵抗）。");
            }
        });
        updateUI();
        finishPlayerAction();
        return;
    }

    if(skillId==="fireRocket"){
        playFireRocketAnimation(
            "battlePlayerCard"+characterIndex,
            targets.map(index=>"battleMonster"+index)
        );
    }

    let totalLifesteal=0;

    targets.forEach(index=>{
        const monster=monsters[index];
        if(!monster || !monster.alive){ return; }

        if(skill.id==="iceSpin"){
            playIceSpinProjectile(characterIndex,index);
        }

        const hit=rollHitChance(
            stats.accuracy,
            getMonsterEvasion(monster),
            getMonsterDebuffValue(character,"stun"),
        getActiveAccuracyBonusPercent(character)
    );

        if(!hit){
            showMissEffect(false,index,"MISS");
            addBattleLog(skill.name+"對"+monster.name+"，沒有命中！");
            return;
        }

        const critResult=rollCritical(
            character,
            skill.category,
            getMonsterEffectiveAntiCrit(monster),
            monster
        );

        const damage=calculateSkillDamage({
            skill:skill,
            skillLevel:level,
            effectiveAttack:statBonus,
            target:monster,
            casterLevel:character.level,
            casterElement:character.element,
            attacker:character,
            critMultiplier:critResult.multiplier
        });
        const hpBeforeDirectDamage=monster.hp;
        monster.hp=Math.max(0,monster.hp-damage);

        showMonsterHit(index,damage,"hp",critResult.isCrit);
        const actualDamageDealt=Math.max(0,hpBeforeDirectDamage-monster.hp);
        addBattleLog(
            (character.id||"隊友")+"施放"+skill.name+"命中"+monster.name+
            (critResult.isCrit ? "（爆擊！）" : "")+
            "，造成"+damage+"傷害。"
        );

        const burnResult=skill.burnChance
            ?rollNamedPersistentStatusEffect(
                monster,
                "burn",
                [
                    skill.burnChance,character.level,monster.level,
                    stats.intelligence,getMonsterEffectiveSpiritPoints(monster)
                ],
                "monster",
                index,
                skill.name,
                skill.guaranteedBurn===true
            )
            :null;
        if(burnResult&&burnResult.hit){
            applyBurnEffect(monster,skill.burnDuration,skill.burnPercentByLevel[level-1]);
            addBattleLog(monster.name+"陷入燃燒狀態！");
        }

        const freezeResult=skill.freezeChance
            ?rollNamedPersistentStatusEffect(
                monster,
                "freeze",
                [
                    skill.freezeChance,character.level,monster.level,
                    stats.intelligence,getMonsterEffectiveSpiritPoints(monster),
                    true,getMonsterRank(monster)
                ],
                "monster",
                index,
                skill.name
            )
            :null;
        if(freezeResult&&freezeResult.hit){
            applyFreezeEffect(monster,skill.freezeDuration);
            addBattleLog(monster.name+"被冰封了！");
        }

        applySkillDebuffEffects(
            skill,level,monster,index,character.level,
            skill.category==="physical"?stats.attackPoints:stats.intelligence
        );

        if(skill.lifestealPercentByLevel){ totalLifesteal+=actualDamageDealt; }
        if(monster.hp<=0){ killMonster(index); }
    });

    if(skill.lifestealPercentByLevel && totalLifesteal>0){
        const amount=Math.floor(
            totalLifesteal*getWaterExAbsorbPercent(character,skill.lifestealPercentByLevel[level-1],"hp")/100
        );
        character.hp=Math.min(stats.maxHP,character.hp+amount);
        character.sp=Math.min(stats.maxSP,character.sp+amount);
        showPlayerHit(amount,"heal",characterIndex,true);
        addBattleLog((character.id||"隊友")+"吸收傷害並回復HP與SP。");
    }

    if(skill.selfShieldByLevel&&canApplyNamedPersistentState(
        character,"shield","player",characterIndex,skill.name
    )){
        character.activeBuffs=(character.activeBuffs||[]).filter(buff=>
            !buff||buff.type!=="shield"||Number(buff.turnsLeft)>0&&Number(buff.remaining)>0
        );
        character.activeBuffs.push(markPersistentStateName({
            type:"shield",
            turnsLeft:skill.shieldDuration||2,
            remaining:skill.selfShieldByLevel[level-1]
        },"shield"));
    }

    if(skill.allyShieldByLevel){
        const amount=skill.allyShieldByLevel[level-1]tail: error writing 'standard output': Broken pipe
tail: error writing 'standard output': Broken pipe
;
        getActivePlayerCharacters().forEach((target,targetIndex)=>{
            if(!canApplyNamedPersistentState(
                target,"shield","player",targetIndex,skill.name
            )){ return; }
            target.activeBuffs=(target.activeBuffs||[]).filter(buff=>
                !buff||buff.type!=="shield"||Number(buff.turnsLeft)>0&&Number(buff.remaining)>0
            );
            target.activeBuffs.push(markPersistentStateName({
                type:"shield",
                turnsLeft:skill.shieldDuration||2,
                remaining:amount
            },"shield"));
        });
    }

    updateUI();
    finishPlayerAction();
}


/*
   ★ 第二角色的普通攻擊。
   邏輯跟normalAttack()一致，
   但完全操作player2/stats2，
   不會動到player。
*/

/*
   ★ 修正（依照使用者要求，補上跟player1
   同一套「目標死亡自動轉火」的保護）：
   這個函式呼叫端（executeAction/
   resolveQueuedPlayerAction）本來就會在
   呼叫完之後無條件補呼叫一次
   finishPlayerAction()，所以原本「目標死了
   就直接return」並不會讓戰鬥卡住，只是會
   讓這次攻擊變成打空氣、不會自動轉火。

   這裡改用findAliveTargetIndex()（純找目標，
   不呼叫finishPlayerAction()），找到目標
   還活著就沿用，死了就自動改打
   currentBattleMonsters裡第一隻還活著的怪物，
   跟player1的行為一致。真的一隻怪物都不剩
   （全滅）才return，交給呼叫端本來就會補上的
   finishPlayerAction()收尾，不會在這裡
   重複呼叫第二次。
*/

function player2NormalAttack(index){

    index=
        findAliveTargetIndex(
            index
        );


    if(index===null){
        return;
    }


    selectedMonster=
        index;


    const monster=
        monsters[index];


    const stats2=
        getPlayer2BattleStats();


    lungePlayerCard(1);


    showSkillNameBadge(
        "普通攻擊",
        "normal",
        1,
        index,
        [index]
    );


    const hit=
        rollHitChance(
            stats2.accuracy,
            getMonsterEvasion(
                monster
            ),
            getMonsterDebuffValue(
                    player2,
                    "stun"
                ),
                getActiveAccuracyBonusPercent(player2)
            );


    if(!hit){

        showMissEffect(
            false,
            index,
            "MISS"
        );


        addBattleLog(
            ""+
            player2.id+
            "普通攻擊"+
            monster.name+
            "，沒有命中！"
        );


        /*
           ★ 修正（真的找到最主要的卡住原因了）：
           這個函式是水墨的普通攻擊，「沒命中」
           跟「攻擊完」這兩條路徑，原本完全沒有
           呼叫updateUI()、finishPlayerAction()——
           普通攻擊是使用頻率最高的動作，
           這代表水墨幾乎每次普通攻擊都會讓
           戰鬥卡住不動，這應該就是「戰鬥到一半
           卡住」最主要、最常發生的原因，
           不是背景執行的問題。

           補上這兩行，沒命中的時候也要正確結束
           這個角色的行動、往下一位推進。
        */

        updateUI();

        finishPlayerAction();

        return;

    }


    const critResult=
        rollCritical(
            player2,
            "physical",
            getMonsterEffectiveAntiCrit(monster),
            monster
        );

    const damage=
        calculateDamage(
            stats2.attack,
            getMonsterEffectiveDefense(monster),
            player2.level,
            monster.level,
            player2.element,
            monster.element,
            {
                attacker:player2,
                target:monster,
                critMultiplier:critResult.multiplier
            }
        );


    monster.hp=
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

        ""+
        player2.id+
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


    /*
       ★ 修正（同一個函式的另一半，這裡也漏掉了）：
       攻擊命中、造成傷害之後，一樣完全沒有
       呼叫updateUI()、finishPlayerAction()，
       補上，確保打中的情況下戰鬥也能正確
       繼續進行。
    */

    updateUI();

    finishPlayerAction();

}


/*
   ★ 第二角色的技能施放。
   共用castDamageSkill()裡已經抽出來的
   通用工具函式（getSkillTargets、
   calculateSkillDamage、rollCritical、
   applyBurnEffect、applyFreezeEffect等），
   自己組一份「操作player2」的施放流程，
   不直接呼叫castDamageSkill()
   （那個函式從頭到尾都是操作player，
   硬要共用風險比自己寫一份更高）。
*/

function castPlayer2Skill(skillId,centerIndex){

    const skill=
        skillDatabase[skillId];


    /*
       ★ 修正（防呆，避免同一類bug的其他分支）：
       這幾個提早return的分支，原本都是直接
       return，完全沒有呼叫finishPlayerAction()——
       正常情況下這幾個條件不應該被觸發
       （UI應該會先擋掉沒學會/SP不足的技能），
       但萬一真的因為某種例外情況（例如資料
       沒對齊、auto-battle的判斷時機差了一點）
       誤觸發，一樣會讓戰鬥卡住不動，跟這次
       抓到的主要bug是同一種風險。

       這裡幫這幾個分支都補上「至少讓行動
       結束���戰鬥繼續進行」的保護，不會再有
       任何一條路徑讓遊戲卡死。
    */

    if(!skill){

        finishPlayerAction();

        return;

    }


    const level=
        getSkillLevel(
            "player2",
            skillId
        );


    if(level<=0){

        finishPlayerAction();

        return;

    }


    const spCost=
        skill.spCost!==undefined
        ?
        skill.spCost
        :
        skill.cost;

    if(player2.sp<spCost){

        finishPlayerAction();

        return;

    }


    const effectiveTargetType=getEffectiveSkillTargetType(skill,level);
    centerIndex=normalizeBattleTargetType(effectiveTargetType)==="all"
        ?null
        :findAliveTargetIndex(centerIndex,effectiveTargetType);

    if(normalizeBattleTargetType(effectiveTargetType)!=="all"&&centerIndex===null){
        finishPlayerAction();
        return;
    }

    const targets=getSkillTargets(centerIndex,effectiveTargetType);
    if(!targets.length){
        finishPlayerAction();
        return;
    }

    player2.sp-=spCost;


    lungePlayerCard(1);


    showSkillNameBadge(
        skill.name,
        skill.element,
        1,
        effectiveTargetType==="all"?null:centerIndex,
        targets,
        undefined,
        effectiveTargetType
    );


    setTimeout(()=>{

        showPlayerSpPopup(
            spCost,
            1
        );

    },500);


    const stats2=
        getPlayer2BattleStats();


    const statBonus=
        skill.category==="magic"
        ?
        stats2.magicAttack
        :
        stats2.attack;



    /*
       純控場技能（例如冰封，沒有baseDamage）：
       不計算傷害/命中，直接跑異常狀態命中公式。
    */

    /*
       ★ 修正（依照使用者要求，「撲空就不行」）：
       原本這裡是「centerIndex指到的怪物還活著
       才處理，死了就整段跳過、直接return」，
       等於鎖定的目標被隊友先打死時，這個控場
       技能會直接打空氣，玩家明明選了施放，
       畫面卻什麼事都沒發生、連戰鬥紀錄都不會
       多一行字。

       改成跟普通攻擊/傷害技能一致，先用
       findAliveTargetIndex()確認目標，死了
       就自動轉打currentBattleMonsters裡第一隻
       還活著的怪物；真的全滅了才return
       （這裡不需要另外呼叫finishPlayerAction()，
       呼叫端castPlayer2Skill的上層
       executeAction/resolveQueuedPlayerAction
       本來就會無條件補呼叫一次，原因
       跟player2NormalAttack()那次修正一樣）。
    */

    if(!skill.baseDamage){
        const freezeChance=getSkillFreezeChanceAtLevel(skill,level);
        const freezeDuration=getSkillFreezeDurationAtLevel(skill,level);
        targets.forEach(index=>{
            const monster=monsters[index];
            if(!monster||!monster.alive||freezeChance<=0){ return; }
            const freezeResult=rollNamedPersistentStatusEffect(
                monster,"freeze",[
                    freezeChance,player2.level,monster.level,
                    stats2.intelligence,getMonsterEffectiveSpiritPoints(monster),
                    true,getMonsterRank(monster)
                ],"monster",index,skill.name
            );
            if(freezeResult.hit){
                applyFreezeEffect(monster,freezeDuration);
                addBattleLog(monster.name+"被冰封了！");
            }else if(!freezeResult.duplicate){
                showMissEffect(false,index,"抵抗");
                addBattleLog(skill.name+"對"+monster.name+"沒有生效（抵抗）。");
            }
        });
        return;
    }


    /*
       ★ 新增（依照使用者要求，火箭技能
       飛行特效，player2版本，跟player1的
       castDamageSkill()同一份邏輯，來源
       改成battlePlayerCard1）：
    */

    if(skillId==="fireRocket"){

        playFireRocketAnimation(
            "battlePlayerCard1",
            targets.map(
                index=>"battleMonster"+index
            )
        );

    }


    let totalLifesteal=0;


    targets.forEach(index=>{

        const monster=
            monsters[index];


        if(
            !monster ||
            !monster.alive
        ){
            return;
        }


        /*
           ★ 新增（依照使用者要求）：
           冰旋一閃專屬的飛行動畫，第二角色
           施放時起點是battlePlayerCard1，
           邏輯跟castDamageSkill()裡的player1
           版本完全一致。
        */

        if(skill.id==="iceSpin"){

            playIceSpinProjectile(
                1,
                index
            );

        }


        const hit=
            rollHitChance(
                stats2.accuracy,
                getMonsterEvasion(
                    monster
                ),
                getMonsterDebuffValue(
                    player2,
                    "stun"
                ),
                getActiveAccuracyBonusPercent(player2)
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


        const critResult=
            rollCritical(
                player2,
                skill.category,
                getMonsterEffectiveAntiCrit(monster),
                monster
            );

        const damage=
            calculateSkillDamage({
                skill:skill,
                skillLevel:level,
                effectiveAttack:statBonus,
                target:monster,
                casterLevel:player2.level,
                casterElement:player2.element,
                attacker:player2,
                critMultiplier:critResult.multiplier
         tail: error writing 'standard output': Broken pipe
tail: error writing 'standard output': Broken pipe
   });

        const hpBeforeDirectDamage=monster.hp;

        monster.hp=
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


        if(skill.burnChance){

            const burnResult=
                rollNamedPersistentStatusEffect(
                    monster,
                    "burn",
                    [
                        skill.burnChance,
                        player2.level,
                        monster.level,
                        stats2.intelligence,
                        getMonsterEffectiveSpiritPoints(monster)
                    ],
                    "monster",
                    index,
                    skill.name,
                    skill.guaranteedBurn===true
                );


            if(burnResult.hit){

                applyBurnEffect(
                    monster,
                    skill.burnDuration,
                    skill.burnPercentByLevel[
                        level-1
                    ]
                );


                addBattleLog(
                    ""+
                    monster.name+
                    "陷入燃燒狀態！"
                );

            }

        }


        if(skill.freezeChance){

            const freezeResult=
                rollNamedPersistentStatusEffect(
                    monster,
                    "freeze",
                    [
                        skill.freezeChance,
                        player2.level,
                        monster.level,
                        stats2.intelligence,
                        getMonsterEffectiveSpiritPoints(monster),
                        true,
                        getMonsterRank(monster)
                    ],
                    "monster",
                    index,
                    skill.name
                );


            if(freezeResult.hit){

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

        }


        /*
           ★ 新增（依照使用者要求，接上風系/
           土系技能的附加效果，跟player1的
           castDamageSkill()是同一份邏輯）：
        */

        applySkillDebuffEffects(
            skill,
            level,
            monster,
            index,
            player2.level,
            skill.category==="physical"?stats2.attackPoints:stats2.intelligence
        );


        if(skill.lifestealPercentByLevel){

            totalLifesteal+=
                actualDamageDealt;

        }


        if(monster.hp<=0){
            killMonster(index);
        }

    });


    if(
        skill.lifestealPercentByLevel &&
        totalLifesteal>0
    ){

        const lifestealPercent=
            skill.lifestealPercentByLevel[
                level-1
            ];


        const lifestealAmount=
            Math.floor(
                totalLifesteal*
                lifestealPercent/
                100
            );


        player2.hp=
            Math.min(
                stats2.maxHP,
                player2.hp+
                lifestealAmount
            );


        player2.sp=
            Math.min(
                stats2.maxSP,
                player2.sp+
                lifestealAmount
            );


        showPlayerHit(
            lifestealAmount,
            "heal",
            1,
            true
        );


        addBattleLog(
            ""+
            player2.id+
            "吸收傷害回復了"+
            lifestealAmount+
            "點HP與SP。"
        );

    }


    /*
       ★ 新增（依照使用者要求，接上土系的
       自身護盾／全體護盾技能，player2版本，
       跟player1的castDamageSkill()是同一份
       邏輯）：
    */

    if(skill.selfShieldByLevel&&canApplyNamedPersistentState(
        player2,"shield","player",1,skill.name
    )){

        const shieldAmount=
            skill.selfShieldByLevel[
                level-1
            ];


        player2.activeBuffs=(player2.activeBuffs||[]).filter(buff=>
            !buff||buff.type!=="shield"||Number(buff.turnsLeft)>0&&Number(buff.remaining)>0
        );


        player2.activeBuffs.push(markPersistentStateName({
            type:"shield",
            turnsLeft:
                skill.shieldDuration||2,
            remaining:
                shieldAmount

        },"shield"));


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
            (character,targetIndex)=>{

                if(
                    character.hp<=0
                ){
                    return;
                }

                if(!canApplyNamedPersistentState(
                    character,"shield","player",targetIndex,skill.name
                )){ return; }

                character.activeBuffs=(character.activeBuffs||[]).filter(buff=>
                    !buff||buff.type!=="shield"||Number(buff.turnsLeft)>0&&Number(buff.remainingbwrap: Can't find source path /workspace/scratch/2feca6ea11c3/.aws: No such file or directory
t.getElementById("battleStatusDetailModal");
    if(modal){ return modal; }
    modal=document.createElement("div");
    modal.id="battleStatusDetailModal";
    modal.className="battle-status-detail-modal";
    modal.hidden=true;
    modal.setAttribute("aria-hidden","true");
    modal.innerHTML=
        '<div class="battle-status-detail-panel" role="dialog" aria-modal="true" aria-labelledby="battleStatusDetailTitle">'+
            '<button type="button" class="battle-status-detail-close" aria-label="關閉">×</button>'+
            '<h3 id="battleStatusDetailTitle">戰鬥狀態</h3>'+
            '<div class="battle-status-detail-core">'+
                '<span data-field="element"></span>'+
                '<span data-field="name"></span>'+
                '<span data-field="hp"></span>'+
                '<span data-field="sp"></span>'+
            '</div>'+
            '<section><h4>增益狀態：</h4><div data-list="buffs" class="battle-status-detail-list"></div></section>'+
            '<section><h4>負面狀態：</h4><div data-list="debuffs" class="battle-status-detail-list"></div></section>'+
        '</div>';
    const host=$("battlePage")||document.body;
    host.appendChild(modal);
    const close=modal.querySelector(".battle-status-detail-close");
    if(close){ close.addEventListener("click",closeBattleStatusDetailModal); }
    modal.addEventListener("click",event=>{
        if(event.target===modal){ closeBattleStatusDetailModal(); }
    });
    return modal;
}

function closeBattleStatusDetailModal(){
    const modal=document.getElementById("battleStatusDetailModal");
    if(!modal){ return; }
    modal.hidden=true;
    modal.setAttribute("aria-hidden","true");
    syncBattleUiPriorityLayer();
}

function renderBattleStatusDetailList(host,items){
    if(!host){ return; }
    host.innerHTML="";
    if(!Array.isArray(items)||items.length===0){
        const empty=document.createElement("div");
        empty.className="battle-status-detail-empty";
        empty.textContent="無";
        host.appendChild(empty);
        return;
    }
    items.forEach(item=>{
        const row=document.createElement("div");
        row.className="battle-status-detail-row";
        const icon=document.createElement("span");
        icon.className="battle-status-detail-icon";
        if(item&&item.iconSrc){
            icon.style.backgroundImage='url("'+String(item.iconSrc).replace(/"/g,"%22")+'")';
        }
        icon.setAttribute("aria-hidden","true");
        const text=document.createElement("span");
        text.className="battle-status-detail-text";
        const name=document.createElement("b");
        name.textContent=(item&&item.name||"狀態")+"：";
        const effect=document.createElement("span");
        effect.textContent=(item&&item.effect||"效果生效中")+"　剩餘 "+(item&&item.remainingText||"0 回合");
        text.appendChild(name);
        text.appendChild(effect);
        row.appendChild(icon);
        row.appendChild(text);
        host.appendChild(row);
    });
}

function openBattleStatusDetailModal(side,index){
    if(isBattleStatusInspectionBlocked()){ return false; }
    const isMonster=side==="monster";
    const entity=isMonster
        ?(typeof monsters!=="undefined"&&monsters[index])
        :(typeof getPartyCharacterByIndex==="function"?getPartyCharacterByIndex(index):null);
    if(!entity){ return false; }

    const modal=ensureBattleStatusDetailModal();
    const stats=!isMonster&&typeof getPartyBattleStats==="function"?getPartyBattleStats(index):null;
    const maxHP=isMonster?Number(entity.maxHP)||Math.max(1,Number(entity.hp)||1):
        Number(stats&&stats.maxHP)||Number(entity.maxHP)||Math.max(1,Number(entity.hp)||1);
    const maxSP=isMonster?Number(entity.maxSP)||Math.max(0,Number(entity.sp)||0):
        Number(stats&&stats.maxSP)||Number(entity.maxSP)||Math.max(0,Number(entity.sp)||0);
    const summary=typeof window.v143GetBattleStatusSummary==="function"
        ?window.v143GetBattleStatusSummary(entity)
        :{buffs:[],debuffs:[]};
    const fields={
        element:"元素："+battleStatusElementLabel(entity),
        name:"名稱："+String(entity.name||entity.id||"角色"),
        hp:"HP："+Math.max(0,Number(entity.hp)||0)+" / "+maxHP,
        sp:"SP："+Math.max(0,Number(entity.sp)||0)+" / "+maxSP
    };
    Object.keys(fields).forEach(key=>{
        const node=modal.querySelector('[data-field="'+key+'"]');
        if(node){ node.textContent=fields[key]; }
    });
    renderBattleStatusDetailList(modal.querySelector('[data-list="buffs"]'),summary.buffs);
    renderBattleStatusDetailList(modal.querySelector('[data-list="debuffs"]'),summary.debuffs);
    modal.hidden=false;
    modal.setAttribute("aria-hidden","false");
    syncBattleUiPriorityLayer();
    return true;
}

if(typeof window!=="undefined"){
    window.openBattleStatusDetailModal=openBattleStatusDetailModal;
    window.closeBattleStatusDetailModal=closeBattleStatusDetailModal;
}

function renderBattle(){

    runBattleRenderHooks("before",this,arguments);

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
                if(card.classList.contains("targetable")){
                    selectBattleTarget(index);
                    return;
                }
                openBattleStatusDetailModal("monster",index);
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
     tail: error writing 'standard output': Broken pipe
           monster.name==="沙蠍"
                ?
                ""
                :
                "";


            card.innerHTML =

            `            <div class="battle-monster-icon">
                ${icon}
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

            <div class="battle-monster-name">
                ${monster.name}
            </div>

            <div class="battle-monster-level">
                Lv.${monster.level}
            </div>
            `;


            area.appendChild(
                card
            );

            const presentation=typeof window!=="undefined"?window.FourSymbolsBattlePresentation:null;
            if(presentation&&typeof presentation.applyUnit==="function"){
                presentation.applyUnit(card,"monster");
            }

        }
    );


    currentBattleMonsters
    .forEach(
        index=>{
            updateMonsterUI(index);
        }
    );


    renderPlayers();
    const bossPresentationOwner=typeof window!=="undefined"?window.FourSymbolsBossBattle:null;
    if(bossPresentationOwner&&typeof bossPresentationOwner.syncHud==="function"){
        bossPresentationOwner.syncHud();
    }

    runBattleRenderHooks("after",this,arguments);


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

function runBattleMonsterUiHook(name,index,monster){
    if(typeof window==="undefined"){ return; }
    const hook=window[name];
    if(typeof hook!=="function"){ return; }
    try{
        hook(index,monster);
    }catch(error){
        console.error("Battle monster UI hook failed:",name,error);
    }
}

function applyMonsterUiUpdate(index){

    const monster=monsters[index];
    if(!monster){
        return;
    }

    runBattleMonsterUiHook("v141BeforeMonsterUiUpdate",index,monster);

    const hpBar=$("battleMonsterBar"+index);
    const spBar=$("battleMonsterSPBar"+index);
    const hpText=$("battleMonsterHPText"+index);
    const spText=$("battleMonsterSPText"+index);

    if(hpBar){
        hpBar.style.width=(monster.hp/monster.maxHP*100)+"%";
    }

    if(spBar){
        spBar.style.width=(monster.sp/monster.maxSP*100)+"%";
    }

    if(hpText){
        hpText.textContent=monster.hp+"/"+monster.maxHP;
    }

    if(spText){
        spText.textContent=monster.sp+"/"+monster.maxSP;
    }

    runBattleMonsterUiHook("v141AfterMonsterUiUpdate",index,monster);
    runBattleMonsterUiHook("v143SystemAfterMonsterUiUpdate",index,monster);
    runBattleMonsterUiHook("v149AfterMonsterUiUpdate",index,monster);
    runBattleMonsterUiHook("v143StatusAfterMonsterUiUpdate",index,monster);
}

function updateMonsterUI(index){

    bumpBattleRuntimeMetric("updateMonsterUI");

    const scheduler=typeof window!=="undefined"?window.v143ScheduleMonsterUiUpdate:null;
    if(typeof scheduler==="function"){
        return scheduler(index,()=>applyMonsterUiUpdate(index));
    }

    return applyMonsterUiUpdate(index);
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

    const party=getExistingPartyIndexes().map(characterIndex=>{
        const character=getPartyCharacterByIndex(charactertail: error writing 'standard output': Broken pipe
Index);
        return {
            character:character,
            characterIndex:characterIndex,
            id:character.id||("角色"+(characterIndex+1)),
            icon:elementDatabase[character.element]
                ? elementDatabase[character.element].icon
                : "",
            level:character.level
        };
    });


    party.forEach(entry=>{

        const index=entry.characterIndex;

        const box =
            document.createElement(
                "div"
            );


        box.className =
            "battle-player";


        box.id=
            "battlePlayerCard"+
            index;

        box.style.backgroundImage=
            "url('"+getCharacterBattleArtworkPath(entry.character)+"')";


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

            <div
                id="battlePlayerShieldBar${index}"
                class="hp-bar-shield-overlay"
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
            " Lv."+
            entry.level;


        box.addEventListener(
            "click",
            ()=>{
                if(box.classList.contains("ally-targetable")){
                    selectBattleAllyTarget(index);
                    return;
                }
                openBattleStatusDetailModal("player",index);
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

    getExistingPartyIndexes().forEach(index=>{
        updateSingleCharacterStatusBadge(
            index,
            getPartyCharacterByIndex(index)
        );
    });

}


function updateSingleCharacterStatusBadge(
    index,
    character
){

    const statusArea=$("battlePlayerStatus"+index);
    if(!statusArea){
        return;
    }

    const applyStatus=()=>{
        if(
            typeof window!=="undefined"&&
            typeof window.v143StatusAfterPlayerUiUpdate==="function"
        ){
            window.v143StatusAfterPlayerUiUpdate(index,character);
        }
    };

    const scheduler=typeof window!=="undefined"?window.v143SchedulePlayerStatusUiUpdate:null;
    if(typeof scheduler==="function"){
        return scheduler(index,applyStatus);
    }

    return applyStatus();
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

    getExistingPartyIndexes().forEach(index=>{
        updateSingleCharacterBars(
            index,
            getPartyCharacterByIndex(index),
            getPartyBattleStats(index)
        );
    });

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


    const shieldBar =
        $("battlePlayerShieldBar"+index);


    const hpPercent =
        Math.max(
            0,
            Math.min(
                100,
                character.hp/
                stats.maxHP*
                100
            )
        );


    if(hpBar){

        hpBar.style.width =
            hpPercent+
            "%";

    }


    /*
       ★ 新增（依照使用者要求，「護盾效果生成的話，
       我方血量條要增加等值長度的白色血量條」）：
       白色色塊緊接在紅色血量右側開始（left=hpPercent），
       寬度＝護盾剩餘量佔maxtail: error writing 'standard output': Broken pipe
HP的比例，跟血條本身用
       同一個maxHP基準換算，超出容器的部分因為
       .hp-bar本身overflow:hidden會自動被裁掉，
       不會畫出格線外。
    */

    if(shieldBar){

        const shieldBuff=

            (character.activeBuffs||[])
            .find(
                b=>

                    b.type==="shield"&&
                    b.turnsLeft>0&&
                    b.remaining>0

            );


        const shieldPercent=

            shieldBuff
            ?
            Math.max(
                0,
                shieldBuff.remaining/
                stats.maxHP*
                100
            )
            :
            0;


        shieldBar.style.left=
            hpPercent+
            "%";

        shieldBar.style.width=
            shieldPercent+
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


function showDamagePopup(element,text,type,isCrit){

    const feedback=typeof window!=="undefined"
        ?window.FourSymbolsBattleFloatingFeedback
        :null;

    if(!feedback||typeof feedback.emit!=="function"||!element){
        return null;
    }

    const unit=typeof feedback.identifyUnit==="function"
        ?feedback.identifyUnit(element)
        :null;

    if(!unit){
        return null;
    }


    return feedback.emit({
        side:unit.side,
        index:unit.index,
        kind:type==="heal"
            ?"heal"
            :type==="sp"
                ?"sp"
                :type==="miss"
                    ?"miss"
                    :type==="shield"
                        ?"shield"
                        :"damage",
        text:text,
        critical:!!isCrit,
        source:"core-entry"
    });

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
            )tail: error writing 'standard output': Broken pipe
;

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


function findBattleSkillByPresentation(skillName,elementType){
    if(typeof skillDatabase==="undefined"){ return null; }
    const ids=Object.keys(skillDatabase);
    for(let index=0;index<ids.length;index++){
        const skill=skillDatabase[ids[index]];
        if(
            skill&&skill.name===skilltail: error writing 'standard output': Broken pipe
bwrap: Can't get type of source /workspace/scratch/2feca6ea11c3/.aws: No such file or directory
tail: error writing 'standard output': Broken pipe
�
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

    const badgeDuration=
        getSkillNameBadgeDuration(
            skillName,
            elementType
        );

    badge.style.setProperty(
        "--skill-name-display-duration",
        badgeDuration+"ms"
    );



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

    },badgeDuration);

    if(typeof window!=="undefined" && typeof window.v142PlaySkillAnimationFromBadge==="function"){
        window.v142PlaySkillAnimationFromBadge("player",skillName,elementType,
            characterIndex||0,targetContract.targetId,targetContract.targetIds,targetContract
        );
    }

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
    monsterIndex,
    targetId,
    targetIds,
    targetSide,
    targetTypeOverride
){

    const targetContract=createBattleTargetContract(
        "monster",skillName,elementType,Number.isInteger(monsterIndex)?monsterIndex:0,targetId,targetIds,targetSide,targetTypeOverride
    );

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

    const badgeDuration=
        getSkillNameBadgeDuration(
            skillName,
            elementType
        );

    badge.style.setProperty(
        "--skill-name-display-duration",
        badgeDuration+"ms"
    );



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

    },badgeDuration);

    if(typeof window!=="undefined" && typeof window.v142PlaySkillAnimationFromBadge==="function"){
        window.v142PlaySkillAnimationFromBadge("monster",skillName,elementType,
            monsterIndex||0,targetContract.targetId,targetContract.targetIds,targetContract
        );
    }

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

    /* Damage popup creation is the hit-feedback owner. The card root never
       receives a border/shadow hit state; positive Heal/SP feedback therefore
       cannot accidentally inherit damage semantics. */

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


/*
   ★ 新增（依照使用者要求，「護盾傷害機制...顯示白色
   數字扣除動畫，如：[-567]」）：
   跟showPlayerHit()同樣找battlePlayerCard元素，
   但用專屬的shield類型（白色文字，見.damage-popup.
   shield-popup），跟一般HP掉血的紅字明確區分開來，
   代表「這是護盾扛下來的量，不是真的扣血」。
*/
function showShieldAbsorb(characterIndex,absorbed){

    if(!absorbed || absorbed<=0){
        return;
    }

    const element =
        $("battlePlayerCard"+
            (characterIndex||0)
        );

    if(!element){
        return;
    }

    showDamagePopup(
        element,
        "-"+absorbed,
        "shield"
    );

}


function showMonsterHit(index,amount,type,isCrit){
    const element=$("battleMonster"+index);
    if(!element||amount===undefined||amount===null){ return; }

    const bossOwner=typeof window!=="undefined"?window.FourSymbolsBossBattle:null;
    const settlement=type==="hp"&&bossOwner&&typeof bossOwner.cotail: error writing 'standard output': Broken pipe
bwrap: Can't get type of source /workspace/scratch/2feca6ea11c3/.aws: No such file or directory
bwrap: Can't find source path /workspace/scratch/2feca6ea11c3/.aws: No such file or directory
��彈窗沒開著的時候，$()會找不到
   對應id、直接return，呼叫這個函式
   不會出錯，可以放心在checkLevelUp()
   裡無條件呼叫。
*/

function refreshCharacterAvatarLevels(){
    getExistingPartyIndexes().forEach(index=>{
        const levelEl=$("characterAvatarLevel"+index);
        const character=getPartyCharacterByIndex(index);
        if(levelEl && character){
            levelEl.textContent="Lv."+character.level;
        }
    });

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

           tail: error writing 'standard output': Broken pipe
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
    else if(type==="formation"){
        titleEl.textContent="佈陣";
        bodyEl.innerHTML=
            typeof window.vFixedRenderAllyFormationContent==="function"
            ? window.vFixedRenderAllyFormationContent()
            : "";
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
              tail: error writing 'standard output': Broken pipe
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
           ★ 修正（依照使用者最新要求，「為什麼有時候
           自動戰鬥設定頁面很置中，有時候很靠下面，都把
           它固定置中；把整個頁面放大讓文字都能塞進去，
           不要讓他捲動」）：
           這裡原本依照更早一輪的要求加了dock-bottom樣式
           （戰鬥中讓視窗貼齊畫面下緣的戰鬥資訊框），這正是
           「有時候置中、有時候靠下面」的原因——戰鬥中貼底、
           不在戰鬥中置中，兩種狀態交替出現。使用者現在
           明確要求「都固定置中」，改成完全不再加dock-bottom
           這個class，不管在不在戰鬥中都維持
           .home-feature-modal預設的置中顯示。

           同時把視窗本身（.home-feature-modal-box）的
           max-height放寬到96dvh（原本戰鬥中只有80dvh，
           非戰鬥中已經是96dvh，這裡統一成不分情境都用
           96dvh），盡量讓內容一次就能完整顯示、不用捲動。
        */

        const settingsBox=
            modal.querySelector(
                ".home-feature-modal-box"
            );


        if(settingsBox){

            settingsBox.style.setProperty(
                "max-height",
                "96dvh",
                "important"
            );

        }


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

            const option2=
                $("autoSettingsCharOption2");

            if(option2){
                option2.textContent=
                    player3
                    ? player3.id
                    : "角色3（尚未創建）";
                option2.disabled=!player3;
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

    if(homeFtail: error writing 'standard output': Broken pipe
tail: error writing 'standard output': Broken pipe
eatureHiddenSwitchCard){

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

    const releaseUpdate=
        window.FourSymbolsReleaseUpdate;
    if(
        releaseUpdate&&
        typeof releaseUpdate.shouldPreventSharedModalClose==="function"&&
        releaseUpdate.shouldPreventSharedModalClose()
    ){
        if(typeof releaseUpdate.announceForcedLock==="function"){
            releaseUpdate.announceForcedLock();
        }
        return false;
    }

    if(
        releaseUpdate&&
        typeof releaseUpdate.onSharedModalClosed==="function"
    ){
        releaseUpdate.onSharedModalClosed();
    }


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


    /*
       ★ 修正（依照使用者回報，「自動戰鬥的框...套用並
       期待按鈕再戰鬥中根本沒有反應」旁邊那張截圖，
       「全屬性技能預覽」按鈕出現在自動戰鬥設定視窗上）：
       跟上面statusHelpButton同一個bug、漏了同一個地方
       沒重置——skillPreviewHeaderButton只有在
       switchCharacterTab()裡被設成顯示/隱藏，只要玩家
       進過一次角色視窗的「技能」分頁，這顆按鈕的
       inline style.display會停在"inline-block"，
       之後不管開什麼視窗（自動戰鬥設定、商店、任務……）
       都會殘留顯示，因為切分頁跟關視窗是兩條不同路徑，
       關視窗那邊原本沒有重置到它。這裡補上跟
       statusHelpButton一樣的收尾重置。
    */

    const skillPreviewBtn=
        $("skillPreviewHeaderButton");


    if(skillPreviewBtn){

        skillPreviewBtn.style.display=
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

    const targetCharacter=
        getPartyCharacterByIndex(targetIndex);

    if(!targetCharacter){
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
        getPartyCharacterKey(targetIndex);

    renderSkillLoadout();


    /*
       ★ 讓被選中的頭像有視覺上的區別
       （例如外圈變亮），玩家才看得出來
       目前選的是哪一個角色。
    */

    [0,1,2].forEach(
        i=>{

            const avatarEl=
                $("characterAvatar"+i);


            if(avatarEl){
                const selected=i===targetIndex;
                avatarEl.style.opacity=selected ? "1" : ".5";
                avatarEl.classList.toggle("is-current-character",selected);
                const choice=avatarEl.closest(".character-showcase-choice");
                if(choice){ choice.classList.toggle("is-current-character",selected); }
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


    /*
       ★ 新增（依照使用者要求，「全技能預覽
       文字按鈕，應該放在技能頁面的返回
       下面」）：
       跟statusHelpButton同一套邏輯，只有
       切到「技能」分頁才顯示，其他分頁
       自動隱藏。
    */

    const skillPreviewBtn=
        $("skillPreviewHeaderButton");


    if(skillPreviewBtn){

        skillPreviewBtn.style.display=

            tabName==="skill"
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
        $("inventoryGoldValue"),
        $("v146HomeRosterGoldValue")
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
                <div class="shop-potion-purchase-row">
                    <label for="shopQuantity-${shopItem.id}">數量</label>
                    <input
                        id="shopQuantity-${shopItem.id}"
                       tail: error writing 'standard output': Broken pipe
tail: error writing 'standard output': Broken pipe
 class="shop-potion-quantity"
                        type="number"
                        inputmode="numeric"
                        min="1"
                        max="9999"
                        step="1"
                        value="1"
                    >
                    <button
                        class="home-feature-buy-btn shop-potion-buy"
                        ${disabled ? "disabled" : ""}
                        onclick="buyShopItem('${shopItem.id}',document.getElementById('shopQuantity-${shopItem.id}').value)"
                    >${buttonText}</button>
                </div>
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


function buyShopItem(itemId,requestedQuantity){

    const shopItem=getPotionDefinition(itemId);

    if(!shopItem){
        return;
    }

    if(!Number.isFinite(shopItem.price)){
        alert("這個藥水的價格尚未設定。");
        return;
    }

    const quantity=Math.max(
        1,
        Math.min(9999,Math.floor(Number(requestedQuantity)||1))
    );

    const totalPrice=shopItem.price*quantity;

    if(gold<totalPrice){
        alert("金幣不夠，本次需要 "+totalPrice.toLocaleString("zh-TW")+" 金幣。");
        return;
    }

    if(!addPotionToInventory(itemId,quantity)){
        alert("背包已滿，或該藥水已沒有可用的堆疊空間。");
        return;
    }

    gold=gold-totalPrice;

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
        player2,
        player3
    ];


    let html=

        '<div style="display:flex;gap:10px;'+
        'justify-content:center;margin-bottom:8px;">';


    slots.forEach(
        (character,slotIndex)=>{

            if(character){
                html+=

                    '<div class="character-showcase-choice" style="width:86px;text-align:center;'+
                    'cursor:pointer;" onclick="selectCharacterForTabs('+
                    slotIndex+
                    ');">'+

                    '<div id="characterAvatar'+
                    slotIndex+
                    '" class="character-showcase-avatar" style="width:56px;height:56px;margin:0 auto;'+
                    'border-radius:50%;background-color:#15100a;background-image:url(\''+
                    getCharacterArtworkPath(character)+
                    '\');background-size:cover;background-position:center 18%;'+
                    'border:2px solid #f0b429;display:flex;align-items:center;'+
                    'justify-content:center;font-size:18px;transition:opacity .15s;">'+
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
                    slotIndex===1
                    ? player.level>=10
                    : isThirdCharacterUnlocked();

                const unlockText=
                    slotIndex===1
                    ? "Lv.10解鎖"
   tail: error writing 'standard output': Broken pipe
                 : "前兩名皆 Lv.50";


                html+=

                    '<div style="width:66px;text-align:center;'+
                    'cursor:pointer;opacity:'+
                    (eligible?"1":".55")+
                    ';" onclick="'+
                    (
                        eligible
                        ?
                        "closeHomeFeature();openCharacterCreation("+(slotIndex+1)+");"
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
                        unlockText
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
   bwrap: Can't get type of source /workspace/scratch/2feca6ea11c3/.aws: No such file or directory
>'+
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

function getClaimableQuestIds(definitions,state){
    return (definitions||[]).filter(function(quest){
        return quest && !state.claimed[quest.id] &&
            (Number(state.progress[quest.id])||0)>=Math.max(1,Number(quest.goal)||1);
    }).map(function(quest){ return quest.id; });
}

function v17361SyncQuestClaimAllButton(isCommission){
    const button=$("questClaimAllButton");
    if(!button){ return; }
    const definitions=isCommission?commissionQuestDefinitions:dailyQuestDefinitions;
    const state=isCommission?commissionQuestState:dailyQuestState;
    const count=getClaimableQuestIds(definitions,state).length;
    button.disabled=count<=0;
    button.textContent=count>0?"一鍵領取（"+count+"）":"一鍵領取";
    button.onclick=isCommission?v17361ClaimAllCommissionQuests:v17361ClaimAllDailyQuests;
}

function v17361RefreshOpenQuestPage(){
    const body=$("questTabBody");
    if(!body){ return false; }
    const commissionBtn=$("questTabBtnCommission");
    const isCommission=!!(commissionBtn&&commissionBtn.classList.contains("active"));
    const scrollTop=body.scrollTop;
    body.innerHTML=isCommission?renderCommissionQuestListContent():renderDailyQuestListContent();
    const completionPanel=$("questCompletionPanel");
    if(completionPanel){
        completionPanel.innerHTML=renderQuestCompletionPanelContent(
            isCommission?commissionQuestDefinitions:dailyQuestDefinitions,
            isCommission?commissionQuestState:dailyQuestState
        );
    }
    body.scrollTop=scrollTop;
    v17361SyncQuestClaimAllButton(isCommission);
    return true;
}
window.v17361RefreshOpenQuestPage=v17361RefreshOpenQuestPage;



/*
   V89：任務視窗為「固定標籤列 + 內層任務清單 + 固定完成度獎勵」架構。
   #questTabBody 是任務唯一 scroll owner；標題與兩個標籤不跟著捲。
*/
function renderQuestTabContent(activeTab){

    const isCommission=
        activeTab==="commission";

    return (
        '<div class="quest-interface">'+

       tail: error writing 'standard output': Broken pipe
tail: error writing 'standard output': Broken pipe
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

            '<div class="quest-batch-actions">'+
                '<button id="questClaimAllButton" class="quest-claim-all-btn" type="button" '+
                    (getClaimableQuestIds(
                        isCommission?commissionQuestDefinitions:dailyQuestDefinitions,
                        isCommission?commissionQuestState:dailyQuestState
                    ).length?'':'disabled ')+
                    'onclick="'+(isCommission?'v17361ClaimAllCommissionQuests()':'v17361ClaimAllDailyQuests()')+'">一鍵領取</button>'+
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

    v17361SyncQuestClaimAllButton(isCommission);

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
     tail: error writing 'standard output': Broken pipe
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
    if(!window.__v17361BulkQuestClaim){ switchQuestTab("daily"); }

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
    if(!window.__v17361BulkQuestClaim){ switchQuestTab("commission"); }

}


function v17361ClaimAllQuestGroup(definitions,state,claimFn,title){
    const ids=getClaimableQuestIds(definitions,state);
    if(!ids.length){ v17361RefreshOpenQuestPage(); return 0; }
    window.__v17361BulkQuestClaim=true;
    try{ ids.forEach(function(id){ claimFn(id); }); }
    finally{ window.__v17361BulkQuestClaim=false; }
    v17361RefreshOpenQuestPage();
    if(typeof window.rpgAlert==="function"){
        void window.rpgAlert("已一鍵領取 "+ids.length+" 個"+title+"獎勵。",{title:title+"獎勵",confirmText:"知道了",tone:"success"});
    }
    return ids.length;
}
function v17361ClaimAllDailyQuests(){
    return v17361ClaimAllQuestGroup(dailyQuestDefinitions,dailyQuestState,claimDailyQuest,"每日任務");
}
function v17361ClaimAllCommissionQuests(){
    return v17361ClaimAllQuestGroup(commissionQuestDefinitions,commissionQuestState,claimCommissionQuest,"委託任務");
}
window.v17361ClaimAllDailyQuests=v17361ClaimAllDailyQuests;
window.v17361ClaimAllCommissionQuests=v17361ClaimAllCommissionQuests;

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
                achievement.natail: error writing 'standard output': Broken pipe
me+
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

    const releaseUpdate=
        window.FourSymbolsReleaseUpdate;

    if(
        releaseUpdate&&
        typeof releaseUpdate.renderAnnouncementContent==="function"
    ){
        const releaseContent=
            releaseUpdate.renderAnnouncementContent();

        if(releaseContent){
            return releaseContent;
        }
    }

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
            '<div class="system-panel-row">'+
                '<div><strong>帳號管理</strong><small>查看目前 Firebase UID、登出或切換帳號。</small></div>'+
                '<button class="home-feature-buy-btn" onclick="window.FourSymbolsStartupPolicy&&window.FourSymbolsStartupPolicy.openAccountManager()">切換帳號／綁定帳號</button>'+
            '</div>'+
            '<div class="system-panel-row">'+
                '<div><strong>客服信箱</strong><small>查看《四象江湖傳》客服聯絡方式。</small></div>'+
                '<button id="systemSupportEmailButton" class="home-feature-buy-btn" onclick="window.FourSymbolsSupport.show()">查看信箱</button>'+
            '</div>'+
            '<div class="system-panel-row danger">'+
                '<div><strong>刪除角色</strong><small>刪除全部角色與遊戲進度，返回初始創角頁面。</small></div>'+
                '<button class="home-feature-buy-btn" onclick="resetGame()">刪除角色</button>'+
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


    const needsRest=getExistingPartyIndexes().some(index=>{
        const character=getPartyCharacterByIndex(index);
        const stats=getPartyBattleStats(index);
        return character.hp<stats.maxHP || character.sp<stats.maxSP;
    });

    if(!needsRest){

        alert(
            "HP、SP 已經是滿的了。"
        );

        return;

    }


    getExistingPartyIndexes().forEach(index=>{
        const character=getPartyCharacterByIndex(index);
        const stats=getPartyBattleStats(index);
        character.hp=stats.maxHP;
        character.sp=stats.maxSP;
    });


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
        "經驗池 +1,000,000,000，目前共有 "+
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
        expButton.innerHTML="經驗池 <b>+10億</b>";
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

    if(player3){

        player3.skillPoints+=999;

        message+=
            "\n「"+
            player3.id+
            "」目前共有"+
            player3.skillPoints+
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


function distributeExpToPlayer3(){

    if(!player3){
        return;
    }

    distributeExpToCharacter(
        player3
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
tail: error writing 'standard output': Broken pipe


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


    if(player3){

        const player3Row=
            document.createElement(
                "div"
            );

        const needed3=
            Math.max(
                0,
                player3.expNext-
                player3.exp
            );

        player3Row.innerHTML=
            `
            <button
                id="distributePlayer3Button"
                class="exp-distribute-button"
            >
                <span class="exp-character-icon">◆</span>
                <span class="exp-character-copy">
                    <strong>${player3.id}</strong>
                    <small>Lv.${player3.level} → Lv.${player3.level+1}</small>
                </span>
                <span class="exp-character-cost">
                    <b>${needed3.toLocaleString("zh-TW")}</b>
                    <small>EXP</small>
                </span>
            </button>
            `;

        container.appendChild(
            player3Row
        );

        $("distributePlayer3Button").disabled=
            sharedExp<needed3 ||
            battleActive;

        $("distributePlayer3Button").onclick=
            distributeExpToPlayer3;

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

    const indexes=getExistingPartyIndexes();

    if(indexes.length<2){
        return;
    }

    const currentPosition=Math.max(
        0,
        indexes.indexOf(statusCharacterIndex)
    );

    statusCharacterIndex=indexes[
        (currentPosition+direction+indexes.length)%indexes.length
    ];


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
                            55
                        );

                },
                250
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
   之前�tail: error writing 'standard output': Broken pipe
tail: error writing 'standard output': Broken pipe
��裡只有addPoint()，完全沒有對應的
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

    const equipmentBonus =        getEquipmentBonus(
            getPartyCharacterKey(
                getPartyCharacterIndex(targetCharacter)
            )
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

            getExistingPartyIndexes().length>1
            ?
            "block"
            :
            "none";

    }


    if(nameBox){

        nameBox.textContent=
            (targetCharacter.id||"冒險者")+
            " Lv."+
            targetCharacter.level;

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

const SKILL_PREVIEW_ELEMENTS=["fire","water","wind","earth"];

function getSkillPreviewSummary(skill){

    const scopes={
        single:"攻擊單一敵人",
        tri:"攻擊相鄰的一排敵人",
        row:"攻擊一整排敵人",
        column:"攻擊同一直列敵人",
        all:"攻擊敵方全體",
        ally:"支援一名友方",
        allyAll:"支援我方全體",
        deadAlly:"復活一名倒下的友方",
        none:"被動生效"
    };

    const effects=[];

    if(skill.category==="physical"){
        effects.push("造成物理傷害");
    }
    if(skill.category==="magic"){
        effects.push("造成法術傷害");
    }
    if(skill.burnChance){ effects.push("可能附加燃燒"); }
    if(skill.freezeChance){ effects.push("可能使目標冰封"); }
    if(skill.stunChance){ effects.push("可能使目標暈眩並降低命中"); }
    if(skill.agilityDownChance){ effects.push("可能降低目標敏捷"); }
    if(skill.damageDownChance){ effects.push("可能降低目標造成的傷害"); }
    if(skill.defenseDownChance){ effects.push("可能降低目標防禦"); }
    if(skill.statDownChance){ effects.push("可能降低目標多項能力"); }
    if(skill.lifestealPercentByLevel){ effects.push("可吸收傷害回復自身"); }
    if(skill.selfShieldByLevel){ effects.push("為自己建立護盾"); }
    if(skill.allyShieldByLevel){ effects.push("為我方建立護盾"); }

    if(skill.category==="heal"){
        effects.push("回復友方生命與能量");
    }
    if(skill.category==="revive"){
        effects.push("讓倒下的友方重新參戰");
    }
    if(skill.category==="passive"){
        effects.push("永久強化該元素的戰鬥特色");
    }

    const namedEffects={
        rage:"提升我方爆擊能力",
        dodgeSkill:"提升我方閃躲能力",
        stealthSkill:"讓友方進入隱身",
        dinghaishenzhen:"提升我方異常狀態抗性",
        rockWall:"提升我方防禦能力",
        earthShield:"賦予友方反傷效果",
        barrier:"為友方建立傷害結界"
    };

    if(namedEffects[skill.id]){
        effects.push(namedEffects[skill.id]);
    }

    return [
        scopes[skill.targetType]||"特殊效果",
        ...effects
    ].filter(Boolean).join("；")+"。";

}

function renderAllElementSkillPreview(element){

    const body=$("skillPreviewBody");
    const tabs=$("skillPreviewTabs");

    if(!body || !tabs){ return; }

    const selected=SKILL_PREVIEW_ELEMENTS.includes(element)
        ? element
        : "fire";

    tabs.innerHTML=SKILL_PREVIEW_ELEMENTS.map(key=>{
        const data=elementDatabase[key];
        return '<button type="button" class="'+
            (key===selected ? "active" : "")+
            '" onclick="renderAllElementSkillPreview(\''+key+'\')">'+
            data.name+'屬性</button>';
    }).join("");

    const categoryNames={
        physical:"物理",
        magic:"法術",
        buff:"增益",
        heal:"回復",
        revive:"復活",
        passive:"被動"
    };

    const skills=Object.values(skillDatabase).filter(
        skill=>skill.element===selected
    );

    body.innerHTML=skills.map(skill=>
        '<article class="skill-preview-card">'+
            '<div><strong>'+skill.name+'</strong><span>'+
            (categoryNames[skill.category]||"特殊")+'</span></div>'+
            '<p>'+getSkillPreviewSummary(skill)+'</p>'+
        '</article>'
    ).join("");

    body.scrollTop=0;
}

function openAllElementSkillPreview(){

    const modal=$("allElementSkillPreviewModal");
    if(!modal){ return; }

    renderAllElementSkillPreview("fire");
    modal.classList.add("show");
    modal.stail: error writing 'standard output': Broken pipe
etAttribute("aria-hidden","false");
}

function closeAllElementSkillPreview(){

    const modal=$("allElementSkillPreviewModal");
    if(!modal){ return; }

    modal.classList.remove("show");
    modal.setAttribute("aria-hidden","true");
}

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

    const keys=getExistingPartyIndexes().map(
        index=>getPartyCharacterKey(index)
    );

    if(keys.length<2){
        return;
    }

    const currentPosition=Math.max(
        0,
        keys.indexOf(currentSkillCharacter)
    );

    currentSkillCharacter=keys[
        (currentPosition+direction+keys.length)%keys.length
    ];


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

    if(
        characterId==="player3"&&
        player3
    ){
        return player3;
    }


    return null;

}


let selectedSkillElementTab="";
let selectedSkillElementCharacterKey="";
const SKILL_ELEMENT_TAB_META=Object.freeze({
    fire:{label:"火元素",element:"fire",className:"fire"},
    water:{label:"水元素",element:"water",className:"water"},
    wind:{label:"風元素",element:"wind",className:"wind"},
    earth:{label:"土元素",element:"earth",className:"earth"}
});

function getSkillLearnCostForUi(character,skill){
    if(typeof window!=="undefined"&&typeof window.v173GetInitialLearnCost==="function"){
        return Math.max(0,Math.floor(Number(window.v173GetInitialLearnCost(character,skill))||0));
    }
    // The progression module owns the player-facing cost, including cross-element rules.
    // Keep this fallback base-only so a missing module cannot create a second formula.
    return Math.max(0,Math.floor(Number(skill&&skill.learnCost)||0));
}

function getSkillLearnEligibilityForUi(character,skill,levels){
    if(typeof window!=="undefined"&&typeof window.v173GetSkillLearnEligibility==="function"){
        return window.v173GetSkillLearnEligibility(character,skill,levels);
    }
    return {
        allowed:false,isCrossElement:false,isNativeElement:true,levelOk:false,
        prerequisiteRequired:false,prerequisiteOk:false,learnCost:0,pointsOk:false,
        crossGateOk:false,reason:"技能規則載入中"
    };
}

function renderSkillElementTabs(character,skillOwner){
    const host=$("skillElementTabs");
    if(!host){ return; }
    const nativeElement=String((skillOwner&&skillOwner.element)||(character&&character.element)||"fire");
    const characterKey=String(currentSkillCharacter||"");
    if(selectedSkillElementCharacterKey!==characterKey){
        selectedSkillElementTab=nativeElement;
        selectedSkillElementCharacterKey=characterKey;
    }
    if(!Object.prototype.hasOwnProperty.call(SKILL_ELEMENT_TAB_META,selectedSkillElementTab)){
        selectedSkillElementTab=nativeElement;
    }
    host.innerHTML=Object.keys(SKILL_ELEMENT_TAB_META).map(key=>{
        const meta=SKILL_ELEMENT_TAB_META[key];
        const active=key===selectedSkillElementTab;
        return '<button type="button" role="tab" class="skill-element-tab '+meta.className+(active?' active':'')+'" aria-selected="'+(active?'true':'false')+'" onclick="selectSkillElementTab(\''+key+'\')">'+meta.label+'</button>';
    }).join("");
}

function selectSkillElementTab(tab){
    if(!Object.prototype.hasOwnProperty.call(SKILL_ELEMENT_TAB_META,tab)){ return; }
    selectedSkillElementTab=tab;
    renderSkillLoadout();
}
window.selectSkillElementTab=selectSkillElementTab;

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

        const selectedIndex=
            currentSkillCharacter==="player3"
            ? 2
            : currentSkillCharacter==="player2"
            ? 1
            : 0;

        const selectedCharacter=
            getPartyCharacterByIndex(selectedIndex)||player;

        nameBox.textContent=
            (selectedCharacter.id||"角色"+(selectedIndex+1))+
            " Lv."+
            selectedCharacter.level;

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


        constail: error writing 'standard output': Broken pipe
tail: error writing 'standard output': Broken pipe
t box =
            document.createElement(
                "div"
            );


        box.className =
            "skill-loadout-slot";


        if(skillId&&skillDatabase[skillId]){

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

    renderSkillElementTabs(character,skillOwner);


    const availableSkillPoints=Math.max(
        0,
        Number(skillOwner ? skillOwner.skillPoints : 0)||0
    );


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


            return !!(
                skill && skill.element &&
                Object.prototype.hasOwnProperty.call(skill,"learnLevel") &&
                skill.category!=="monster" &&
                skill.element===selectedSkillElementTab
            );

        });


    const progressionOrder={physical:0,magic:1,tactical:2,ex:3};
    matchingSkillIds.sort((a,b)=>{
        const aSkill=skillDatabase[a]||{};
        const bSkill=skillDatabase[b]||{};
        const aLearned=(skillLevels[a]||0)>0;
        const bLearned=(skillLevels[b]||0)>0;
        if(aLearned!==bLearned){ return aLearned?-1:1; }
        const aGroup=progressionOrder[String(aSkill.progressionGroup||"")]??99;
        const bGroup=progressionOrder[String(bSkill.progressionGroup||"")]??99;
        if(aGroup!==bGroup){ return aGroup-bGroup; }
        const aLevel=Number(aSkill.learnLevel)||0;
        const bLevel=Number(bSkill.learnLevel)||0;
        if(aLevel!==bLevel){ return aLevel-bLevel; }
        return String(aSkill.name||a).localeCompare(String(bSkill.name||b));
    });


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


        const eligibility=getSkillLearnEligibilityForUi(skillOwner,skill,skillLevels);
        const learnCost=eligibility.learnCost;
        const canAfford=eligibility.pointsOk;


        const box =
            document.createElement(
                "div"
            );


        box.className =
            "skill-row";


        let actionLabel;
        let actionOnclick;
        let actionDisabled;


        const prereqMet=eligibility.prerequisiteOk;


        if(!isLearned){

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
            bwrap: Can't get type of source /workspace/scratch/2feca6ea11c3/.aws: No such file or directory
沒有算進火元素EX被動的+10%加成，
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
        )tail: error writing 'standard output': Broken pipe
;

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

    const eligibility=getSkillLearnEligibilityForUi(
        owner,
        skill,
        character.skillLevels
    );

    if(!eligibility.allowed){

        alert(
            eligibility.reason+
            "，才能學習「"+skill.name+"」。"
        );

        return;

    }


    const learnCost=eligibility.learnCost;
    const availablePoints=Math.max(0,Number(owner.skillPoints)||0);

    if(availablePoints<learnCost){
        alert(
            "技能點不足，需要"+
            learnCost+
            "點。"
        );
        return;
    }

    owner.skillPoints=availablePoints-learnCost;


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
const INVENTORY_CATEGORY_SLOT_COUNT = 120;

function getBackpackPartyCharacters(){
    return [player, player2, player3];
}

function getBackpackCharacter(index){
    return getBackpackPartyCharacters()[index] || null;
}

function getBackpackEquipmentKey(index){
    return getBackpackCharacter(index)
        ? getPartyCharacterKey(index)
        : null;
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
        maxHP:100+(character.bonusHP||0)+character.vitality*HP_PER_VITALITY_POINT+bonus.maxHP+bonus.vitality*HP_PER_VITALITY_POINT,
        maxSP:50+(character.bonusSP||0)+character.energy*15+bonus.maxSP+bonus.energy*15,
        attack:BASE_PHYSICAL_ATTACK+Math.max(1,Number(character.level)||1)*ATTACK_PER_LEVEL+(character.attack+bonus.attack)*ATTACK_PER_POINT,
        magicAttack:BASE_MAGIC_ATTACK+Math.max(1,Number(character.level)||1)*MAGIC_ATTACK_PER_LEVEL+(character.intelligence+bonus.intelligence)*MAGIC_ATTACK_PER_POINT,
        defense:BASE_DEFENSE+Math.max(1,Number(character.level)||1)*DEtail: error writing 'standard output': Broken pipe
bwrap: Can't get type of source /workspace/scratch/2feca6ea11c3/.aws: No such file or directory
erIndex
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
            基礎命中率＝clamp(95%＋命中×0.3, 50%, 99%)，先乘上(1－目標最終閃躲率)，最後再扣除暈眩等「最終命中率降低」效果（最低1%）。<br>
            一般異常每1精神降低0.05個百分點命中率；每1敏捷＝+1速度、+0.6個百分點基礎閃躲。
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
        {key:"shoulder",name:"護腕"},
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
        if(RETIRED_BACKPACK_POTION_IDS.has(String(item.id||""))) return false;

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
            const realIndex=inventoryItems.indexOf(item);            box.onclick=()=>openItemModal(realIndex);
        }else{
            box.innerHTML+='<div class="inventory-empty-dot">·</div>';
        }
        grid.appendChild(box);
    }

    document.querySeltail: error writing 'standard output': Broken pipe
ectorAll("#inventoryCategoryTabs [data-filter]").forEach(tab=>{
        const active=tab.dataset.filter===inventoryFilter;
        tab.classList.toggle("active",active);
        tab.setAttribute("aria-selected",active ? "true" : "false");
    });

    if(typeof window!=="undefined"&&typeof window.v17363SyncFunctionalFixes==="function"){ window.v17363SyncFunctionalFixes(); }
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
    if(typeof window!=="undefined"&&typeof window.v131SyncInventoryPortrait==="function"){
        window.v131SyncInventoryPortrait();
    }
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

           tail: error writing 'standard output': Broken pipe
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
        <div style="tail: error writing 'standard output': Broken pipe
bwrap: Can't get type of source /workspace/scratch/2feca6ea11c3/.aws: No such file or directory
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
            skill.category==="healtail: error writing 'standard output': Broken pipe
"||
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

function syncBattleUiPriorityLayer(){

    const stage=$("game-stage");
    const page=$("battlePage");
    if(!stage||!page){ return false; }

    const statusDetail=page.querySelector(".battle-status-detail-modal:not([hidden])");
    const sideDrawer=page.querySelector(".battle-insight-drawer.open");
    const battleInfo=page.querySelector(".battle-info-region.is-expanded");
    const active=!!(statusDetail||sideDrawer||battleInfo);

    stage.classList.toggle("battle-ui-priority",active);
    if(document.body){ document.body.classList.toggle("v174-battle-reading-open",active); }
    return active;

}

if(typeof window!=="undefined"){
    window.syncBattleUiPriorityLayer=syncBattleUiPriorityLayer;
}

function setBattleInfoExpanded(expanded){

    const region=document.querySelector("#battlePage .battle-info-region");
    const toggle=$("battleInfoToggle");

    if(!region||!toggle){ return false; }

    const next=!!expanded;
    region.classList.toggle("is-expanded",next);
    toggle.textContent=next?"返回":"戰鬥資訊";
    toggle.setAttribute("aria-expanded",next?"true":"false");
    toggle.setAttribute("aria-label",next?"收合戰鬥資訊":"展開戰鬥資訊");
    syncBattleUiPriorityLayer();
    return true;

}

function toggleBattleInfoPanel(){

    const region=document.querySelector("#battlePage .battle-info-region");
    return setBattleInfoExpanded(!(region&&region.classList.contains("is-expanded")));

}

function clearBattleLog(){

    setBattleInfoExpanded(false);

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


    if(turnIndicatortail: error writing 'standard output': Broken pipe
){

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

    const battlePresentationActive=!!(
        typeof window!=="undefined"&&
        window.FourSymbolsBattleFlow&&
        typeof window.FourSymbolsBattleFlow.isPresentationActive==="function"&&
        window.FourSymbolsBattleFlow.isPresentationActive()
    );

    const shouldHide=
        activeAuto || battlePhase==="resolve" || battlePresentationActive;


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
            clearBattleTargetSelectionMode();

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
        ""tail: error writing 'standard output': Broken pipe
+
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
        return;    }


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

        tail: error writing 'standard output': Broken pipe
tail: error writing 'standard output': Broken pipe
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
       這個外層容器本來�tail: error writing 'standard output': Broken pipe
��在上面的isMapPage
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

    bumpBattleRuntimeMetric("updateUI");

    const stats=getMainCharacterStats();

    player.hp=Math.max(0,Math.min(player.hp,stats.maxHP));
    player.sp=Math.max(0,Math.min(player.sp,stats.maxSP));

    if(battleActive){

        populateSkillQuickBar();

        if(
            $("itemMenu")&&
            $("itemMenu").classList.contains("show")
        ){
            renderBattlePotionMenu();
        }

        currentBattleMonsters.forEach(index=>{
            updateMonsterUI(index);
        });

        updateBattlePlayerBars();

        const bossPresentationOwner=typeof window!=="undefined"?window.FourSymbolsBossBattle:null;
        if(bossPresentationOwner&&typeof bossPresentationOwner.syncHud==="function"){
            bossPresentationOwner.syncHud();
        }

        return;
    }

    updateHomeTestTools();
    updateTrainingZoneLocks();
    updateSecondCharacterBanner();
    updateGoldDisplay();
    updateMapPlayerCard();
    updateMapPageHeader();

    $("playerLevel").textContent=player.level;
    $("headerHP").textContent=player.hp;
    $("headerSP").textContent=player.sp;

    $("skillPoints").textContent=
        (
            getSkillCharacterObject(currentSkillCharacter)||
            player
        ).skillPoints;

    $("sharedExpValue").textContent=
        Math.max(0,Math.floor(Number(sharedExp)||0))
            .toLocaleString("zh-TW");

    renderExpDistributeList();
    updateStatusPreview();
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
                   實際�tail: error writing 'standard output': Broken pipe
�過的時間對不上，變成卡住
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

        if(
            window.FourSymbolsReleaseUpdate&&
            typeof window.FourSymbolsReleaseUpdate.isForcedUpdateBlocking==="function"&&
            window.FourSymbolsReleaseUpdate.isForcedUpdateBlocking()
        ){
            window.FourSymbolsReleaseUpdate.announceForcedLock();
            return;
        }

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
   函式本身保留�tail: error writing 'standard output': Broken pipe
�，之後如果想要重新打開
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


/* StartupStateMachine is the only owner allowed to select and load an account save. */


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

}catch(error){

    console.error(
        "自動存檔啟動失敗：",
        error
    );

}


/* bundled source: js/01-stage-v8-touch-lock.js */
(function(){
    "use strict";

    /*
     * V78 ROOT FIX
     *
     * 舊版用 target.closest(...) 只看第一個符合元素。
     * 背包裡第一個符合的是 #inventoryPage，
     * 但真正的 scroll owner 是它上面的 .content。
     *
     * 這裡改成一路往祖先走，只要其中任何一層
     * 是真正可以垂直或水平捲動的容器，就允許手勢通過。
     */
    function isInsideAllowedScroller(target){
        if(!target){
            return false;
        }

        /*
           ★ 修正（依照使用者回報，「全屬性技能預覽」頁面
           「不能捲動，下面看不到」）：
           這裡是全域的觸控鎖，`#game-stage`裡任何觸控目標
           只要不在這份白名單覆蓋的可捲動容器內，一律
           `preventDefault()`擋掉原生捲動手勢。
           `.skill-preview-body`（全屬性技能預覽彈窗真正
           的捲動容器）從一開始就沒有被加進這份白名單，
           程式化設定`scrollTop`看起來正常、但手指真的滑動
           時（真正會經過touchmove事件）完全被這裡擋掉，
           這是原本就存在的bug，只是內容字級變大、真的需要
           捲動才會看到內容之後才會被踩到——之前字級小、
           內容剛好塞得進viewport，從來沒真的需要捲動過。

           V173.45 shop frame hotfix：商店改成固定 Large Panel 後，
           真正的內容 scroll owner 是 #homeFeatureModalBody。
           外框 .home-feature-modal-box 只負責固定尺寸且 overflow:hidden，
           因此不能代替內頁通過觸控鎖；把真正 scroll owner 納入
           同一份權威白名單，避免再次出現「看得到 scrollbar、
           但手指滑不動」的假捲動狀態。

           合成裝備選擇列是水平 scroll owner。舊判斷只接受
           overflow-y，因此即使畫面已出現橫向 scrollbar，手指左右
           滑仍會被全域 touch lock 阻擋。現在同一份權威判斷同時
           接受真正可捲動的 X/Y 軸，避免再為單一頁面另做事件補丁。

           角色詳細能力視窗的真正 scroll owner 是
           .inventory-character-detail-grid；外框
           .inventory-character-detail-box 本身是 overflow:hidden，
           不能替內容區通過觸控鎖。把真正內容層加入同一白名單。

           練功區地區資訊收斂成 Medium Modal 後，真正 scroll owner
           改為 #trainingZoneModalBody；外框只負責固定尺寸。

           狀態／能力說明收斂成 Medium Modal 後，真正 scroll owner
           是 #statusHelpModal 內的 .item-stat-list；外框與返回鍵固定。

           V174：秘寶頁的垂直 scroll owner 是
           #homeFeatureModal.team-relic-mode #homeFeatureModalBody，分類列
           .team-relic-tabs 則是水平 scroll owner。兩者都必須通過這個
           全域觸控鎖；否則手勢從分類列或秘寶內容起始時會被
           preventDefault()，造成「有時能滑、有時不能滑」的裝置差異。

           Firebase 帳號視窗使用獨立於 game stage 的 responsive viewport
           overlay，真正的垂直 scroll owner 是 .firebase-auth-dialog；
           同樣只在這份全域白名單登記一次，不為登入頁另加 touchmove 補丁。
        */
   tail: error writing 'standard output': Broken pipe
     const allowedSelector =
            ".content, .content-scrollable, .creation-page-scroll, .creation-role-card, .inventory-grid-scroll, .quest-tab-body, .battle-item-list, " +
            ".characterTabContent, #characterTabContent, #inventoryPage, " +
            ".adventure-view, " +
            ".home-feature-modal-box, #homeFeatureModalBody, #homeFeatureModal.team-relic-mode #homeFeatureModalBody, .team-relic-tabs, .v141-synthesis-body, #trainingZoneModalBody, .auto-settings-expanded, " +
            ".inventory-character-detail-box, .inventory-character-detail-grid, .item-modal-box, #itemModalStats, #skillDetailStats, " +
            "#statusHelpModal .item-stat-list, .skill-preview-body, .creation-skill-detail-levels, #dungeonTabContent, .gameplay-panel-scroll, .v17342-abyss-battle-log, .v143-item-picker, .v17358-reforge-tiers, .v17363-game-select-menu, .v17351-compare-stats, .firebase-auth-dialog, " +
            "textarea, select, input";

        let node =
            target.nodeType===1
            ? target
            : target.parentElement;

        while(node && node!==document.documentElement){

            if(
                node.matches &&
                node.matches(allowedSelector)
            ){
                const style =
                    window.getComputedStyle(node);

                const canScrollY =
                    (
                        style.overflowY==="auto" ||
                        style.overflowY==="scroll"
                    ) &&
                    node.scrollHeight >
                    node.clientHeight + 1;

                const canScrollX =
                    (
                        style.overflowX==="auto" ||
                        style.overflowX==="scroll"
                    ) &&
                    node.scrollWidth >
                    node.clientWidth + 1;

                if(canScrollY || canScrollX){
                    return true;
                }
            }

            node=node.parentElement;
        }

        return false;
    }

    document.addEventListener(
        "touchmove",
        function(event){
            const gameSurface =
                event.target &&
                event.target.closest &&
                event.target.closest("#game-stage");

            if(
                gameSurface &&
                event.touches &&
                event.touches.length>1
            ){
                event.preventDefault();
                return;
            }

            if(
                gameSurface &&
                !isInsideAllowedScroller(
                    event.target
                )
            ){
                event.preventDefault();
            }
        },
        {passive:false}
    );

    document.addEventListener(
        "pointermove",
        function(event){
            if(
                event.pointerType==="touch" &&
                event.target &&
                event.target.closest &&
                event.target.closest("#game-stage") &&
                !isInsideAllowedScroller(
                    event.target
                )
            ){
                event.preventDefault();
            }
        },
        {passive:false}
    );

    /*
       全遊戲瀏覽器原生互動鎖：
       - 單指仍依既有 scroll whitelist 正常捲動。
       - 兩指以上永遠不交給瀏覽器做 pinch zoom。
       - 非文字輸入 UI 不開啟長按 context menu、不原生拖曳、不文字選取。
       這是全域 owner，禁止各頁另疊長按／縮放補丁。
    */
    function isGameSurfaceTarget(target){
        return !!(
            target &&
            target.closest &&
            target.closest("#game-stage")
        );
    }

    function isEditableGameControl(target){
        return !!(
            target &&
            target.closest &&
            target.closest('input, textarea, [contenteditable="true"]')
        );
    }


    document.addEventListener(
        "contextmenu",
        function(event){
            if(
                isGameSurfaceTarget(event.target) &&
                !isEditableGameControl(event.target)
            ){
                event.preventDefault();
            }
        },
        {capture:true}
    );

    document.addEventListener(
        "dragstart",
        function(event){
            if(
                isGameSurfaceTarget(event.target) &&
                !isEditableGameControl(event.target)
            ){
                event.preventDefault();
            }
        },
        {capture:true}
    );

    document.addEventListener(
        "selectstart",
        function(event){
            if(
                isGameSurfaceTarget(event.target) &&
                !isEditableGameControl(event.target)
            ){
                event.preventDefault();
            }
        },
        {capture:true}
    );

    document.addEventListener(
        "wheel",
        function(event){
            if(
                event.ctrlKey &&
                isGameSurfaceTarget(event.target)
            ){
                event.preventDefault();
            }
        },
        {capture:true,passive:false}
    );

    window.addEventListener(
        "gesturestart",
        function(event){
            if(
                event.target &&
                event.target.closest &&
                event.target.closest("#game-stage")
            ){
                event.preventDefault();
            }
        },
        {passive:false}
    );

    window.addEventListener(
        "gesturechange",
        function(event){
            if(
                event.target &&
                event.target.closest &&
                event.target.closest("#game-stage")
            ){
                event.preventDefault();
            }
        },
        {passive:false}
    );

    window.isInsideAllowedScrollerV78 =
        isInsideAllowedScroller;
})();


/* bundled source: js/02-stage-v9-native-coordinate-api.js */
/* ============================================================
   V9 — NATIVE 1080×1920 COORDINATE API

   New features MUST use these helpers instead of browser
   viewport coordinates.

   Existing game logic is intentionally untouched.
============================================================ */
(function installNativeGameCoordinateAPI(){
    const GAME_W = 1080;
    const GAME_H = 1920;

    function getStage(){
        return document.getElementById("game-stage");
    }

    function getOverlay(){
        return document.getElementById("game-overlay-layer");
    }

    function screenToGame(clientX, clientY){
        const stage = getStage();
        if(!stage){
            return {x: clientX, y: clientY};
        }

        const rect = stage.getBoundingClientRect();
        const scale = window.gameStageScale || 1;

        return {
            x: (clientX - rect.left) / scale,
            y: (clientY - rect.top) / scale
        };
    }

    function gameToScreen(x, y){
        const stage = getStage();
        if(!stage){
            return {x, y};
        }

        const rect = stage.getBoundingClientRect();

        return {
            x: rect.left + x * (rect.width / GAME_W),
            y: rect.top + y * (rect.height / GAME_H)
        };
    }

    function eventToGame(event){
        const point = event.touches && event.touches.length
            ? event.touches[0]
            : event.changedTouches && event.changedTouches.length
                ? event.changedTouches[0]
                : event;

        return screenToGame(point.clientX, point.clientY);
    }

    function createNativeElement(className){
        const overlay = getOverlay();
        if(!overlay){
            return null;
        }

        const el = document.createElement("div");
        el.className = "game-native-element " + (className || "");
        overlay.appendChild(el);
        return el;
    }

    function setNativeRect(el, x, y, width, height){
        if(!el) return;

        el.style.position = "absolute";
        el.style.left = x + "px";
        el.style.top = y + "px";
        el.style.width = width + "px";
        el.style.height = height + "px";
    }

    function setNativePosition(el, x, y){
        if(!el) return;

        el.style.position = "absolute";
        el.style.left = x + "px";
        el.style.top = y + "px";
    }

    window.GAME_NATIVE_WIDTH = GAME_W;
    window.GAME_NATIVE_HEIGHT = GAME_H;

    window.screenToGame = screenToGame;
    window.gameToScreen = gameToScreen;
    window.eventToGame = eventToGame;
    window.createNativeGameElement = createNativeElement;
    window.setNativeGameRect = setNativeRect;
    window.setNativeGamePosition = setNativePosition;
})();


/* bundled source: js/03-stage-v10-battle-log-scroll-runtime.js */
(function(){
    "use strict";

    function findScrollableBattlePanel(target){
        if(!target || !target.closest) return null;

        return target.closest(
            '[data-battle-log-scroll],' +
            '.battle-log-scrollable,' +
            '.battle-log,' +
            '.battle-info,' +
            '.battle-info-box,' +
            '.battle-log-box,' +
            '.battle-log-container,' +
            '.combat-log,' +
            '.combat-log-box,' +
            '.battle-text,' +
            '.battle-message-list'
        );
    }

    function canScrollVertically(el){
        if(!el) return false;

        const style = window.getComputedStyle(el);
        const overflowY = style.overflowY;

        return (
            (overflowY === "auto" || overflowY === "scroll") &&
            el.scrollHeight > el.clientHeight + 1
        );
    }

    /*
     * Mark the actual scrollable battle log so the existing global
     * touch lock can recognize it.
     */
    function markBattleScrollers(){
        const selectors = [
            '[class*="battle"][class*="log"]',
            '[class*="battle"][class*="info"]',
            '[class*="combat"][class*="log"]',
            '[id*="battle"][id*="log"]',
            '[id*="battle"][id*="info"]',
            '[id*="combat"][id*="log"]'
        ];

        document.querySelectorAll(selectors.join(",")).forEach(function(el){
            el.setAttribute("data-battle-log-scroll", "true");
            el.style.touchAction = "pan-y";
        });
    }

    /*
     * A capture-phase listener runs before the old global touch lock.
     * For the actual battle log, allow the browser's vertical scroll.
     * For everything else, the existing game-wide lock remains unchanged.
     */
    document.addEventListener("touchmove", function(event){
        const scroller = findScrollableBattlePanel(event.target);

        if(scroller && canScrollVertically(scroller)){
            event.stopImmediatePropagation();
            return;
        }
    }, {capture:true, passive:false});

    document.addEventListener("pointermove", function(event){
        if(event.pointerType !== "touch") return;

        const scroller = findScrollableBattlePanel(event.target);

        if(scroller && canScrollVertically(scroller)){
            event.stopImmediatePropagation();
            return;
        }
    }, {capture:true, passive:false});

    markBattleScrollers();

    window.addEventListener("resize", markBattleScrollers, {passive:true});
})();


/* bundled source: js/04-stage-v11-native-bottom-nav-runtime.js */
(function(){
    "use strict";

    /*
     * Convert the existing bottom navigation into a native-coordinate
     * overlay without changing its click handlers or game logic.
     *
     * We clone no buttons and do not replace existing event listeners.
     * The original nav is moved into the native overlay layer.
     */
    function migrateBottomNav(){
        const overlay = document.getElementById("game-overlay-layer");
        if(!overlay) return;

        const candidates = [
            document.getElementById("bottomNav"),
            document.getElementById("mapPageNav"),
            documentail: error writing 'standard output': Broken pipe
t.querySelector("#game-content .bottom-nav")
        ].filter(Boolean);

        candidates.forEach(function(nav){
            if(!nav || nav.dataset.nativeV11 === "true") return;

            /*
             * Only migrate nav elements that are actual game navigation.
             * Do not touch unrelated fixed controls.
             */
            const isBottomNav =
                nav.id === "bottomNav" ||
                nav.id === "mapPageNav" ||
                nav.classList.contains("bottom-nav");

            if(!isBottomNav) return;

            const wrapper = document.createElement("div");
            wrapper.className = "native-bottom-nav-layer";
            wrapper.dataset.nativeV11 = "true";

            const nativeNav = document.createElement("div");
            nativeNav.className = "native-bottom-nav";
            nativeNav.dataset.nativeV11 = "true";

            /*
             * Move the existing element, preserving its existing DOM,
             * children, IDs, and event listeners.
             */
            nav.parentNode.insertBefore(wrapper, nav);
            wrapper.appendChild(nativeNav);
            nativeNav.appendChild(nav);

            /*
             * Remove legacy viewport positioning from the moved element.
             * Its visual size is preserved by the existing child styles.
             */
            nav.style.position = "relative";
            nav.style.left = "auto";
            nav.style.right = "auto";
            nav.style.top = "auto";
            nav.style.bottom = "auto";
            nav.style.transform = "none";
            nav.style.marginLeft = "0";
            nav.style.marginRight = "0";
            nav.style.width = "100%";

            nav.dataset.nativeV11 = "true";
        });
    }

    /*
     * Run after existing initialization and after DOM changes.
     * This is migration-only; it does not alter game mechanics.
     */
    if(document.readyState === "loading"){
        document.addEventListener("DOMContentLoaded", migrateBottomNav, {once:true});
    }else{
        migrateBottomNav();
    }

    window.migrateBottomNavToNative1080 = migrateBottomNav;
})();


/* bundled source: js/05-stage-v13-native-map-nav-runtime.js */
(function(){
    "use strict";

    function migrateMapNav(){
        const overlay = document.getElementById("game-overlay-layer");
        if(!overlay) return;

        const nav = document.getElementById("mapPageNav");
        if(!nav || nav.dataset.nativeV13 === "true") return;

        /*
         * Only migrate the map/training navigation.
         * Existing DOM, children, IDs and event listeners are preserved.
         */
        const wrapper = document.createElement("div");
        wrapper.className = "native-map-nav-layer";
        wrapper.dataset.nativeV13 = "true";

        const nativeNav = document.createElement("div");
        nativeNav.className = "native-map-nav";
        nativeNav.dataset.nativeV13 = "true";

        nav.parentNode.insertBefore(wrapper, nav);
        wrapper.appendChild(nativeNav);
        nativeNav.appendChild(nav);

        nav.style.position = "relative";
        nav.style.left = "auto";
        nav.style.right = "auto";
        nav.style.top = "auto";
        nav.style.bottom = "auto";
        nav.style.transform = "none";
        nav.style.marginLeft = "0";
        nav.style.marginRight = "0";
        nav.style.width = "100%";

        nav.dataset.nativeV13 = "true";
    }

    if(document.readyState === "loading"){
        document.addEventListener("DOMContentLoaded", migrateMapNav, {once:true});
    }else{
        migrateMapNav();
    }

    window.migrateMapNavToNative1080 = migrateMapNav;
})();


/* bundled source: js/06-stage-v39-battle-map-background-runtime.js */
(function(){
    "use strict";

    window.GAME_NATIVE_CONFIRMED_BASELINE = "V38";
    window.GAME_NATIVE_CURRENT_VERSION = "V39";

    /*
     * V39 map-background bridge.
     *
     * Priority:
     *  1) Existing current patrol/map background element's computed/current
     *     background image.
     *  2) Existing map data/background variables if exposed by the game.
     *
     * We do not replace the game's map state or battle state.
     */

    function getBattlePage(){
        return document.getElementById("battlePage");
    }

    function getPatrolMapBackground(){
        const candidates = [
            document.getElementById("patrolPage"),
            document.getElementById("mapPage"),
            document.getElementById("trainingPage"),
            document.getElementById("mapBackground"),
            document.querySelector("#game-content .map-background"),
            document.querySelector("#game-content .patrol-background"),
            document.querySelector("#game-content .training-background")
        ].filter(Boolean);

        for(const el of candidates){
            const cs = getComputedStyle(el);
            const bg = cs.backgroundImage;
            if(bg && bg !== "none"){
                return bg;
            }
            const inline = el.style.backgroundImage;
            if(inline){
                return inline;
            }
        }
        return null;
    }

    function applyCurrentMapBackground(){
        const battle = getBattlePage();
        if(!battle) return false;

        const bg = getPatrolMapBackground();
        if(!bg) return false;

        battle.style.setProperty("background-image", bg, "important");
        battle.style.setProperty("background-size", "cover", "important");
        battle.style.setProperty("background-position", "center", "important");
        battle.style.setProperty("background-repeat", "no-repeat", "important");

        return true;
    }

    /*
     * Battle may be rendered after map navigation. Observe only the
     * game-content subtree for battlePage/map-page changes and reapply
     * the current map image. This does not alter battle mechanics.
     */
    function init(){
        applyCurrentMapBackground();
tail: error writing 'standard output': Broken pipe

        const root = document.getElementById("game-content") ||
                     document.getElementById("game-stage");
        if(!root) return;

        const observer = new MutationObserver(function(){
            if(document.getElementById("battlePage")){
                applyCurrentMapBackground();
            }
        });

        observer.observe(root, {childList:true, subtree:true});

        window.addEventListener("resize", applyCurrentMapBackground);
    }

    window.syncBattleBackgroundToCurrentMap = applyCurrentMapBackground;

    if(document.readyState === "loading"){
        document.addEventListener("DOMContentLoaded", init, {once:true});
    }else{
        init();
    }
})();


/* bundled source: js/07-stage-v40-root-battle-background-runtime.js */
(function(){
    "use strict";

    window.GAME_NATIVE_CONFIRMED_BASELINE = "V39";
    window.GAME_NATIVE_CURRENT_VERSION = "V40";

    const LEGACY_WIDTH = 420;
    const NATIVE_WIDTH = 1080;
    const CHARACTER_CARD_LEGACY_WIDTH = 124;
    const CAST_BADGE_NATIVE_WIDTH =
        CHARACTER_CARD_LEGACY_WIDTH * (NATIVE_WIDTH / LEGACY_WIDTH);

    function ensureBattleBackgroundLayer(){
        const battle = document.getElementById("battlePage");
        if(!battle) return null;

        let layer = battle.querySelector(":scope > .battle-bg-shared");
        if(!layer){
            layer = document.createElement("div");
            layer.className = "battle-bg-shared";
            layer.setAttribute("aria-hidden","true");
            battle.insertBefore(layer, battle.firstChild);
        }
        return layer;
    }

    function getActualPatrolBackground(){
        /*
         * SOURCE OF TRUTH:
         * enterMap() calls applyMapZoneBackground(currentZone),
         * which writes the current map image to #mapPageBgLayer.
         *
         * We read that exact rendered layer rather than guessing
         * from #mapPage itself.
         */
        const mapLayer = document.getElementById("mapPageBgLayer");
        if(mapLayer){
            const bg = getComputedStyle(mapLayer).backgroundImage;
            if(bg && bg !== "none"){
                return bg;
            }
            if(mapLayer.style.backgroundImage){
                return mapLayer.style.backgroundImage;
            }
        }

        /*
         * Fallback only if the map layer is not available:
         * use the game's actual map-zone table and currentZone.
         */
        try{
            if(typeof mapZoneBackgroundImages !== "undefined"){
                const url = mapZoneBackgroundImages[currentZone] ||
                            mapZoneBackgroundImages.forest;
                if(url){
                    return "url(" + url + ")";
                }
            }
        }catch(e){}

        return null;
    }

    function syncBattleBackgroundToCurrentMap(){
        const layer = ensureBattleBackgroundLayer();
        if(!layer) return false;

        const bg = getActualPatrolBackground();
        if(!bg) return false;

        layer.style.setProperty("background-image", "linear-gradient(rgba(0,0,0,.52), rgba(0,0,0,.52)), " + bg, "important");
        layer.style.setProperty("background-size", "cover", "important");
        layer.style.setProperty("background-position", "center top", "important");
        layer.style.setProperty("background-repeat", "no-repeat", "important");

        return true;
    }

    function ensureCastBadgeSourceSize(badge){
        if(!badge || !badge.classList.contains("skill-name-badge")) return;
        /*
         * This is native-overlay space, so match the legacy card:
         * 124 legacy px × 2.571428... = 318.857 native px.
         */
        badge.style.setProperty(
            "width",
            CAST_BADGE_NATIVE_WIDTH + "px",
            "important"
        );
        badge.style.setProperty(
            "min-width",
            CAST_BADGE_NATIVE_WIDTH + "px",
            "important"
        );
        badge.style.setProperty(
            "max-width",
            CAST_BADGE_NATIVE_WIDTH + "px",
            "important"
        );
        badge.style.setProperty("font-size","72px","important");
        badge.style.setProperty("font-weight","900","important");
        badge.style.setProperty("text-align","center","important");
        badge.style.setProperty("white-space","nowrap","important");
    }

    /*
     * The skill badge is dynamically created by
     * showSkillNameBadge()/showMonsterSkillNameBadge().
     * Catch the real node at creation time.
     */
    function watchOverlay(){
        const overlay = document.getElementById("game-overlay-layer");
        if(!overlay) return;

        overlay.querySelectorAll(".skill-name-badge")
            .forEach(ensureCastBadgeSourceSize);

        const observer = new MutationObserver(function(mutations){
            mutations.forEach(function(mutation){
                mutation.addedNodes.forEach(function(node){
                    if(node.nodeType !== 1) return;
                    if(node.classList &&
                       node.classList.contains("skill-name-badge")){
                        ensureCastBadgeSourceSize(node);
                    }
                    if(node.querySelectorAll){
                        node.querySelectorAll(".skill-name-badge")
                            .forEach(ensureCastBadgeSourceSize);
                    }
                });
            });
        });
        observer.observe(overlay,{childList:true,subtree:true});
    }

    function init(){
        ensureBattleBackgroundLayer();
        syncBattleBackgroundToCurrentMap();
        watchOverlay();

        /*
         * When currentZone/map background changes, #mapPageBgLayer is
         * updated by applyMapZoneBackground(). MutationObserver on the
         * style attribute guarantees battle receives the same image.
         */
        const mapLayer = document.getElementById("mapPageBgLayer");
        if(mapLayer){
            const mapObservetail: error writing 'standard output': Broken pipe
tail: error writing 'standard output': Broken pipe
r = new MutationObserver(
                syncBattleBackgroundToCurrentMap
            );
            mapObserver.observe(mapLayer,{attributes:true,attributeFilter:["style"]});
        }

        /*
         * Also resync when the battle page is rendered/activated.
         */
        const content = document.getElementById("game-content");
        if(content){
            const pageObserver = new MutationObserver(function(){
                if(document.getElementById("battlePage")){
                    syncBattleBackgroundToCurrentMap();
                }
            });
            pageObserver.observe(content,{childList:true,subtree:true});
        }

        window.syncBattleBackgroundToCurrentMap =
            syncBattleBackgroundToCurrentMap;
    }

    window.getV40BattleVisualDiagnostics = function(){
        const layer = document.querySelector(
            "#game-stage > #app > #game-content #battlePage > .battle-bg-shared"
        );
        const badge = document.querySelector(
            "#game-stage > #game-overlay-layer .skill-name-badge"
        );
        return {
            currentZone:
                (typeof currentZone !== "undefined" ? currentZone : null),
            battleBackground:
                layer ? getComputedStyle(layer).backgroundImage : null,
            badgeFont:
                badge ? getComputedStyle(badge).fontSize : null,
            badgeWidth:
                badge ? badge.getBoundingClientRect().width : null,
            badgeText:
                badge ? badge.textContent : null
        };
    };

    if(document.readyState === "loading"){
        document.addEventListener("DOMContentLoaded",init,{once:true});
    }else{
        init();
    }
})();


/* bundled source: js/08-stage-v41-runtime.js */
(function(){
    "use strict";
    window.GAME_NATIVE_CONFIRMED_BASELINE = "V40";
    window.GAME_NATIVE_CURRENT_VERSION = "V41";
})();


/* bundled source: js/09-stage-v45-runtime.js */
(function(){
    "use strict";
    window.GAME_NATIVE_CONFIRMED_BASELINE = "V41";
    window.GAME_NATIVE_CURRENT_VERSION = "V45";
    window.GAME_BATTLE_BACKGROUND_TINT = "rgba(0,0,0,.38)";
    window.GAME_CAST_SKILL_BADGE_FONT_SIZE = "106px";
})();


/* bundled source: js/10-stage-v46-runtime.js */
(function(){
    "use strict";
    window.GAME_NATIVE_CONFIRMED_BASELINE = "V45";
    window.GAME_NATIVE_CURRENT_VERSION = "V46";
    window.GAME_BATTLE_BACKGROUND_TINT = "rgba(0,0,0,.52)";
    window.GAME_CAST_SKILL_BADGE_FONT_SIZE = "132px";
})();


/* bundled source: js/11-stage-v47-runtime.js */
(function(){
    "use strict";
    window.GAME_NATIVE_CONFIRMED_BASELINE = "V46";
    window.GAME_NATIVE_CURRENT_VERSION = "V47";
    window.GAME_CAST_SKILL_BADGE_SOURCE_FONT_SIZE = "150px";
    window.GAME_CAST_SKILL_BADGE_SOURCE_WIDTH = "900px";
})();


/* bundled source: js/12-stage-v48-runtime.js */
(function(){
    "use strict";
    window.GAME_NATIVE_CONFIRMED_BASELINE = "V47";
    window.GAME_NATIVE_CURRENT_VERSION = "V48";
    window.GAME_CAST_SKILL_BADGE_FONT_SIZE = "72px";
    window.GAME_CAST_SKILL_BADGE_STROKE = "none";
})();


/* bundled source: js/13-stage-v49-runtime.js */
(function(){
    "use strict";
    window.GAME_NATIVE_CONFIRMED_BASELINE = "V48";
    window.GAME_NATIVE_CURRENT_VERSION = "V49";
    window.GAME_CAST_SKILL_BADGE_STROKE = "none";

    function removeSkillWhiteStroke(){
        document.querySelectorAll(".skill-name-badge").forEach(function(el){
            el.style.setProperty("-webkit-text-stroke","0","important");
            el.style.setProperty("text-stroke","0","important");
            el.style.setProperty("border","0","important");
            el.style.setProperty("outline","0","important");
        });
    }

    if(document.readyState === "loading"){
        document.addEventListener("DOMContentLoaded", removeSkillWhiteStroke, {once:true});
    }else{
        removeSkillWhiteStroke();
    }
})();


/* bundled source: js/14-stage-v50-runtime.js */
(function(){
    "use strict";
    window.GAME_NATIVE_CONFIRMED_BASELINE = "V49";
    window.GAME_NATIVE_CURRENT_VERSION = "V50";

    function fixBattleBackgroundEdge(){
        const stage = document.getElementById("game-stage");
        const battle = document.getElementById("battlePage");
        const bg = battle && battle.querySelector(".battle-bg-shared");
        if(!stage || !battle || !bg) return;

        /* Use the actual battle viewport dimensions, never Legacy 420px. */
        bg.style.setProperty("left","0","important");
        bg.style.setProperty("top","0","important");
        bg.style.setProperty("width","100%","important");
        bg.style.setProperty("height","100%","important");
        bg.style.setProperty("right","0","important");
        bg.style.setProperty("bottom","0","important");
        bg.style.setProperty("border","0","important");
        bg.style.setProperty("outline","0","important");
        bg.style.setProperty("box-shadow","none","important");

        battle.style.setProperty("overflow","hidden","important");
    }

    if(document.readyState === "loading"){
        document.addEventListener("DOMContentLoaded", fixBattleBackgroundEdge, {once:true});
    }else{
        fixBattleBackgroundEdge();
    }
})();


/* bundled source: js/15-stage-v51-runtime.js */
(function(){
    "use strict";
    window.GAME_NATIVE_CONFIRMED_BASELINE = "V50";
    window.GAME_NATIVE_CURRENT_VERSION = "V93";

    /*
      Restore white outline only on combat result nodes.
      Do not touch skill-name-badge.
    */
    const combatResultSelector = [
        ".battle-damage",
        ".battle-damage-number",
        ".damage-number",
        ".damage-text",
        ".combat-damage",
        ".combat-result",
        ".combat-result-text",
        ".battle-miss",
        ".miss-text",
        ".battle-heal",
        ".heal-number",
        ".hp-change",
        ".hp-change-number"
    ].join(",");

    function applyCombatResultStroke(root){
        const base = root && tail: error writing 'standard output': Broken pipe
root.querySelectorAll ? root : document;
        base.querySelectorAll(combatResultSelector).forEach(function(el){
            el.style.setProperty("-webkit-text-stroke","3px #ffffff","important");
            el.style.setProperty("text-stroke","3px #ffffff","important");
        });
    }

    function init(){
        applyCombatResultStroke(document);

        const stage = document.getElementById("game-stage");
        if(stage){
            new MutationObserver(function(){
                applyCombatResultStroke(stage);
            }).observe(stage, {childList:true, subtree:true});
        }
    }

    if(document.readyState === "loading"){
        document.addEventListener("DOMContentLoaded", init, {once:true});
    }else{
        init();
    }
})();


/* bundled source: js/relic-summary-catalog.js */
/* First-screen-safe Team Relic summary catalog.
   Owns only the static fields required by the main-city summary and the full relic catalog. */
(function installRelicSummaryCatalog(global){
    "use strict";
    if(!global||global.FourSymbolsRelicSummaryCatalog){ return; }
    const entries=[
        ["relic_qiankun_flask","乾坤玉壺","奇數回合結束時"],
        ["relic_sun_orb","烈陽神珠","偶數回合開始時"],
        ["relic_xuanwu_seal","玄武靈印","每第3回合開始時"],
        ["relic_soul_bell","鎮魂古鐘","每第4回合開始時"],
        ["relic_tiangang_banner","天罡戰旗","我方累積受到6次敵方有效攻擊後"],
        ["relic_nine_dragon_fire","九龍神火罩","敵方累積完成7次有效行動後"],
        ["relic_cold_spring_jade","寒泉玉珮","任一我方角色HP由35%以上降至35%以下時"],
        ["relic_qinglan_feather","青嵐羽符","戰鬥開始時"],
        ["relic_rock_mountain_seal","岩岳鎮印","開場；另於我方累積受8次有效攻擊時"],
        ["relic_returning_wheel","回天寶輪","本場第一次有我方角色將受到致命傷害時"],
        ["relic_origin_talisman","太初聖符","每第4回合結束"],
        ["relic_broken_army_scroll","破軍殘卷","角色攻擊／技能擊敗敵人後"],
        ["relic_red_sky_war_mark","赤霄戰紋","戰鬥開始時"],
        ["relic_ice_mirror_heart","玄冰鏡心","每第3回合結束"],
        ["relic_wind_chasing_talisman","追風行符","每第3回合開始"],
        ["relic_mountain_river_cauldron","山河寶鼎","我方累積受7次有效攻擊後"],
        ["relic_burning_star_mark","焚星殘印","偶數回合結束"],
        ["relic_spirit_spring_bottle","靈泉法瓶","每第3回合結束"],
        ["relic_demon_suppressing_seal","伏魔金印","戰鬥開始；首次成功受到一般負面狀態"],
        ["relic_all_returning_array","萬象歸元盤","每第4回合開始"]
    ];
    global.FourSymbolsRelicSummaryCatalog=Object.freeze(Object.fromEntries(entries.map(entry=>[
        entry[0],
        Object.freeze({id:entry[0],name:entry[1],triggerText:entry[2]})
    ])));
})(typeof window!=="undefined"?window:globalThis);


/* bundled source: js/16-stage-v54-main-city-runtime.js */
(function(){
    "use strict";
    window.GAME_NATIVE_CONFIRMED_BASELINE = "V51";
    window.GAME_NATIVE_CURRENT_VERSION = "V54";
    window.GAME_NATIVE_LAST_SCOPE = "main-city-moderate-scale";

    const AD_FREE_MODE_CLASS="ad-free-service-info-mode";
    const AD_FREE_CONFIG_KEY="SIXIANG_AD_FREE_SERVICE_CONFIG";
    const AD_FREE_DISPLAY_POLICY=Object.freeze({mode:"manual"});
    const DEFAULT_AD_FREE_CONFIG=Object.freeze({
        supportEmail:"",
        refundPolicyUrl:"",
        termsUrl:"",
        privacyPolicyUrl:"",
        purchaseUrl:"",
        purchaseEnabled:false
    });

    function apply(){
        const home = document.getElementById("homePage");
        if(!home) return;
        home.classList.add("main-city-lobby-ready");
    }

    function ensureAdFreeConfig(){
        const formalSupportEmail=String(window.FourSymbolsSupport&&window.FourSymbolsSupport.email||"").trim();
        const existing=window[AD_FREE_CONFIG_KEY]&&typeof window[AD_FREE_CONFIG_KEY]==="object"
            ? window[AD_FREE_CONFIG_KEY]
            : {};
        const config=Object.assign({},DEFAULT_AD_FREE_CONFIG,existing);
        if(formalSupportEmail){ config.supportEmail=formalSupportEmail; }
        window[AD_FREE_CONFIG_KEY]=config;
        return config;
    }

    function getModalParts(){
        const modal=document.getElementById("homeFeatureModal");
        if(!modal){ return null; }
        const box=modal.querySelector(".home-feature-modal-box");
        const title=document.getElementById("homeFeatureModalTitle");
        const body=document.getElementById("homeFeatureModalBody");
        if(!box||!title||!body){ return null; }
        return {modal,box,title,body};
    }

    function resolveConfiguredUrl(value){
        const raw=String(value||"").trim();
        if(!raw){ return ""; }
        try{
            const url=new URL(raw,window.location.href);
            return url.protocol==="https:"||url.protocol==="http:" ? url.href : "";
        }catch(_){
            return "";
        }
    }

    function configurePolicyButton(buttonId,configuredUrl,todoLabel){
        const button=document.getElementById(buttonId);
        if(!button){ return; }
        const url=resolveConfiguredUrl(configuredUrl);
        if(!url){
            button.disabled=true;
            button.title="TODO：待接正式"+todoLabel+"頁面";
            return;
        }
        button.disabled=false;
        button.title="";
        button.addEventListener("click",function(){
            window.open(url,"_blank","noopener,noreferrer");
        });
    }

    function renderAdFreeServiceBody(body){
        const config=ensureAdFreeConfig();
        const configuredEmail=String(config.supportEmail||"").trim();
        body.innerHTML=[
            '<section class="ad-free-service-panel" data-ad-free-service-info="true">',
                '<div class="ad-free-service-hero">',
                    '<div class="ad-free-service-subtitle">30 天免廣告服務</div>',
                    '<div class="ad-free-service-price" aria-label="價格 NT$99">NT$99</div>',
                    '<div class="ad-free-service-badge">單次購買・非自動續訂</div>',
                '</div>',
                '<div class="ad-free-service-copy">',
                    '<p>一次付款，提供 30 天免廣告權益。</p>',
                    '<p>本服務為單次購買，不會自動續訂。</p>',
                    '<p>購買成功後，免廣告權益將綁定玩家帳號，自付款成功起生效 30 天。</p>',
                    '<p>此服務不提供額外角色、裝備、能力、遊戲幣或其他戰力加成。</p>',
                '</div>',
                '<section class="ad-free-service-support" aria-label="客服與條款">',
                    '<div class="ad-free-service-support-row">',
                        '<span>客服 Email：</span>',
                        '<b id="adFreeSupportEmail">'+configuredEmail+'</b>',
                    '</div>',
                    '<div class="ad-free-service-policy-actions">',
                        '<button id="adFreeRefundPolicyButton" type="button">查看退款規則</button>',
                        '<button id="adFreeTermsButton" type="button">查看服務條款</button>',
                        '<button id="adFreePrivacyButton" type="button">查看隱私權政策</button>',
                    '</div>',
                    '<p class="ad-free-service-todo-note">退款規則、服務條款與隱私權政策頁面尚待設定；未設定前不會導向不存在的網址。</p>',
                '</section>',
                '<div class="ad-free-service-actions">',
                    '<button id="adFreePurchaseButton" class="ad-free-service-purchase" type="button" disabled aria-label="購買 30 天免廣告 NT$99，目前付款服務準備中">付款服務準備中</button>',
                    '<button id="adFreeAcknowledgeButton" class="ad-free-service-acknowledge" type="button">我知道了</button>',
                '</div>',
            '</section>'
        ].join("");

        const supportEmail=document.getElementById("adFreeSupportEmail");
        if(supportEmail){
            supportEmail.textContent=configuredEmail;
            supportEmail.dataset.todo="false";
        }

        configurePolicyButton("adFreeRefundPolicyButton",config.refundPolicyUrl,"退款規則");
        configurePolicyButton("adFreeTermsButton",config.termsUrl,"服務條款");
        configurePolicyButton("adFreePrivacyButton",config.privacyPolicyUrl,"隱私權政策");

        const purchaseButton=document.getElementById("adFreePurchaseButton");
        const purchaseUrl=resolveConfiguredUrl(config.purchaseUrl);
        if(purchaseButton&&config.purchaseEnabled===true&&purchaseUrl){
            purchaseButton.disabled=false;
            purchaseButton.textContent="購買 30 天免廣告 NT$99";
            purchaseButton.setAttribute("aria-label","購買 30 天免廣告 NT$99");
            purchaseButton.addEventListener("click",function(){
                window.open(purchaseUrl,"_blank","noopener,noreferrer");
            });
        }

        const acknowledgeButton=document.getElementById("adFreeAcknowledgeButton");
        if(acknowledgeButton){
            acknowledgeButton.addEventListener("click",closeAdFreeServiceInfoModal);
        }

        // TODO(ECPay): 填入正式退款規則、服務條款、隱私權政策網址。
        // TODO(ECPay): 完成綠界付款與付款結果驗證後，才可設定 purchaseEnabled=true 與 purchaseUrl。
    }

    function openAdFreeServiceInfoModal(){
        const parts=getModalParts();
        if(!parts){ return false; }
        if(parts.modal.classList.contains("show")&&!parts.modal.classList.contains(AD_FREE_MODE_CLASS)){
            return false;
        }

        parts.title.textContent="《四象江湖傳》";
        renderAdFreeServiceBody(parts.body);
        parts.body.scrollTop=0;
        parts.modal.classList.add(AD_FREE_MODE_CLASS);
        parts.modal.setAttribute("role","dialog");
        parts.modal.setAttribute("aria-modal","true");
        parts.modal.setAttribute("aria-labelledby","homeFeatureModalTitle");
        parts.modal.classList.add("show");
        return true;
    }

    function closeAdFreeServiceInfoModal(){
        const parts=getModalParts();
        if(!parts||!parts.modal.classList.contains(AD_FREE_MODE_CLASS)){ return false; }
        if(typeof window.closeHomeFeature==="function"){
            window.closeHomeFeature();
        }else{
            parts.modal.classList.remove("show");
        }
        parts.modal.classList.remove(AD_FREE_MODE_CLASS);
        parts.modal.removeAttribute("role");
        parts.modal.removeAttribute("aria-modal");
        parts.modal.removeAttribute("aria-labelledby");
        return true;
    }

    window.AD_FREE_SERVICE_DISPLAY_POLICY=AD_FREE_DISPLAY_POLICY;
    window.openAdFreeServiceInfoModal=openAdFreeServiceInfoModal;
    window.closeAdFreeServiceInfoModal=closeAdFreeServiceInfoModal;


    function rosterNumber(value){
        const number=Number(value);
        return Number.isFinite(number)?number:0;
    }
    function rosterEscape(value){
        return String(value==null?"":value)
            .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
            .replace(/\"/g,"&quot;").replace(/'/g,"&#039;");
    }
    function rosterResourceText(value){
        const whole=Math.max(0,Math.floor(rosterNumber(value)));
        if(whole>=100000000){
            const compact=whole/100000000;
            return compact.toFixed(compact>=10?1:2).replace(/\.?0+$/g,"")+"億";
        }
        if(whole>=10000){ return Math.floor(whole/10000)+"萬"; }
        return whole.toLocaleString("zh-TW");
    }
    function syncRosterResource(node,value){
        if(!node){ return; }
     tail: error writing 'standard output': Broken pipe
tail: error writing 'standard output': Broken pipe
   const whole=Math.max(0,Math.floor(rosterNumber(value)));
        const full=whole.toLocaleString("zh-TW");
        node.textContent=rosterResourceText(whole);
        node.title=full; node.setAttribute("aria-label",full);
    }
    const HOME_RELIC_SUMMARY_CATALOG=window.FourSymbolsRelicSummaryCatalog||Object.freeze({});
    let firstScreenVisualReadyPromise=null;
    function nextPaint(){ return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))); }
    function urlsFromStyle(value){
        const urls=[];
        String(value||"").replace(/url\((?:"([^"]+)"|'([^']+)'|([^\)]+))\)/g,(_all,doubleQuoted,singleQuoted,plain)=>{const url=(doubleQuoted||singleQuoted||plain||"").trim();if(url&&url!=="none"){urls.push(url);}return _all;});
        return urls;
    }
    function decodeImageUrl(url){
        return new Promise((resolve,reject)=>{const image=new Image();image.decoding="async";image.onload=()=>typeof image.decode==="function"?image.decode().then(resolve,reject):resolve();image.onerror=()=>reject(new Error("主城首屏圖片無法載入："+url));image.src=url;});
    }
    function collectFirstScreenVisualUrls(){
        const urls=new Set();
        ["#homePage","#homePage .home-bg-fixed-layer","#homePage .home-card-icon","#v146HomeRoster","#homePage img","#bottomNav img","#mainBottomNav img"].forEach(selector=>document.querySelectorAll(selector).forEach(node=>{if(node.tagName==="IMG"&&node.currentSrc){urls.add(node.currentSrc);}urlsFromStyle(getComputedStyle(node).backgroundImage).forEach(url=>urls.add(url));}));
        return [...urls];
    }
    async function prepareFirstScreenVisuals(){
        if(firstScreenVisualReadyPromise){return firstScreenVisualReadyPromise;}
        firstScreenVisualReadyPromise=(async()=>{
            const home=document.getElementById("homePage"),roster=document.getElementById("v146HomeRoster");
            if(!home||!roster||roster.dataset.ready!=="true"){throw new Error("主城首屏資料尚未完成。 ");}
            const urls=collectFirstScreenVisualUrls(); if(!urls.length){throw new Error("主城首屏圖片清單為空。 ");}
            const fonts=document.fonts&&document.fonts.ready?document.fonts.ready:Promise.resolve(); await Promise.all([fonts,...urls.map(decodeImageUrl)]); await nextPaint();
            const liveUrls=new Set(collectFirstScreenVisualUrls()); if(urls.some(url=>!liveUrls.has(url))){throw new Error("主城首屏圖片在繪製前被替換。 ");}
            try{if(performance&&typeof performance.mark==="function"){performance.mark("four-symbols:main-city-visual-ready");}}catch(_){ }
            return Object.freeze({assets:urls.length});
        })().catch(error=>{firstScreenVisualReadyPromise=null;throw error;});
        return firstScreenVisualReadyPromise;
    }

    function homeRosterPlaceholder(index){
        return '<article class="v146-home-character v146-home-character-placeholder" data-home-roster-slot="'+index+'" aria-busy="true">'+
            '<div class="v146-home-avatar" aria-hidden="true"></div>'+
            '<div class="v146-home-character-main"><div><b>隊伍資料載入中</b><span>--</span></div>'+
            '<div class="v146-home-resource hp"><i style="width:0%"></i><strong>HP --</strong></div>'+
            '<div class="v146-home-resource sp"><i style="width:0%"></i><strong>SP --</strong></div></div></article>';
    }

    function ensureHomeRosterShell(){
        const page=document.getElementById("homePage");
        const grid=page&&page.querySelector(".home-card-grid");
        if(!page||!grid){ return null; }
        let roster=document.getElementById("v146HomeRoster");
        if(!roster){
            roster=document.createElement("section");
            roster.id="v146HomeRoster";
            roster.className="v146-home-roster";
            roster.setAttribute("aria-label","冒險隊伍");
            grid.insertAdjacentElement("afterend",roster);
        }
        if(!roster.querySelector(":scope > header")){
            const header=document.createElement("header");
            const currentGold=typeof gold!=="undefined"
                ?Math.max(0,Math.floor(rosterNumber(gold))).toLocaleString("zh-TW")
                :"0";
            header.innerHTML='<b>冒險隊伍</b><span class="v146-home-roster-count">隊伍 -- / 6</span><span class="v146-home-roster-gold">金幣 <strong id="v146HomeRosterGoldValue">'+currentGold+'</strong></span><button type="button" class="v-fixed-formation-entry" data-feature="gameplay-core" onclick="openHomeFeature(\'formation\')">佈陣</button>';
            roster.appendChild(header);
        }
        if(!roster.querySelector(".v146-home-character")){
            for(let index=0;index<3;index++){
                roster.insertAdjacentHTML("beforeend",homeRosterPlaceholder(index));
            }
        }
        let relicSlot=roster.querySelector(".team-relic-loadout-slot");
        if(!relicSlot){
            relicSlot=document.createElement("div");
            relicSlot.className="team-relic-loadout-slot";
            relicSlot.dataset.ready="false";
            relicSlot.innerHTML='<span>隊伍秘寶</span><b>秘寶資料載入中</b><small>等待正式存檔完成解析</small><button type="button" data-feature="relic" onclick="openHomeFeature(\'relic\')" disabled>選擇</button>';
            roster.appendChild(relicSlot);
        }
        return roster;
    }

    function readHomeRelicSave(){
        try{
            const repository=window.FourSymbolsAccountSave;
            const uid=repository&&repository.getActiveUid();
            if(!repository||!uid){ return null; }
            const result=repository.readForUid(uid);
            return result&&result.status==="ready"&&result.save&&typeof result.save==="object"
                ?result.save
                :null;
        }catch(_){
            return null;
        }
    }

    function syncHomeRelicSummary(){
        const roster=ensureHomeRosterShell();
tail: error writing 'standard output': Broken pipe
        const slot=roster&&roster.querySelector(".team-relic-loadout-slot");
        if(!slot){ return false; }
        const save=readHomeRelicSave();
        if(!save){
            slot.dataset.ready="false";
            return false;
        }
        const relicId=save.teamLoadout&&typeof save.teamLoadout==="object"
            ?String(save.teamLoadout.relicId||"")
            :"";
        const definition=relicId?HOME_RELIC_SUMMARY_CATALOG[relicId]:null;
        const owned=relicId&&save.playerRelics&&typeof save.playerRelics==="object"
            ?save.playerRelics[relicId]
            :null;
        const level=Math.max(1,Math.min(20,Math.floor(rosterNumber(owned&&owned.level)||1)));
        slot.innerHTML=definition
            ?'<span>隊伍秘寶</span><b>'+rosterEscape(definition.name)+' Lv.'+level+'</b><small>'+rosterEscape(definition.triggerText)+'</small><button type="button" data-feature="relic" onclick="openHomeFeature(\'relic\')">更換</button>'
            :'<span>隊伍秘寶</span><b>尚未裝備</b><small>每隊僅能裝備1件秘寶</small><button type="button" data-feature="relic" onclick="openHomeFeature(\'relic\')">選擇</button>';
        slot.dataset.ready="true";
        return true;
    }

    function renderHomeRoster(){
        firstScreenVisualReadyPromise=null;
        const roster=ensureHomeRosterShell();
        if(!roster||typeof getExistingPartyIndexes!=="function"){ return false; }
        const partyIndexes=getExistingPartyIndexes().slice(0,3);
        const availableExp=typeof window.v173GetAvailableExpPool==="function"
            ?window.v173GetAvailableExpPool(Date.now())
            :(typeof sharedExp!=="undefined"?sharedExp:0);
        syncRosterResource(document.getElementById("homeHudGoldValue"),typeof gold!=="undefined"?gold:0);
        syncRosterResource(document.getElementById("homeHudExpValue"),availableExp);
        syncRosterResource(document.getElementById("v146HomeRosterGoldValue"),typeof gold!=="undefined"?gold:0);
        const count=roster.querySelector(".v146-home-roster-count");
        if(count){ count.textContent="隊伍 "+partyIndexes.length+" / 6"; }

        const cards=[];
        for(let slotIndex=0;slotIndex<3;slotIndex++){
            const index=partyIndexes[slotIndex];
            const character=typeof index==="number"&&typeof getPartyCharacterByIndex==="function"
                ?getPartyCharacterByIndex(index)
                :null;
            const stats=typeof index==="number"&&typeof getPartyBattleStats==="function"
                ?getPartyBattleStats(index)
                :null;
            if(!character||!stats){
                cards.push('<article class="v146-home-character v146-home-character-empty" data-home-roster-slot="'+slotIndex+'"><div class="v146-home-avatar" aria-hidden="true"></div><div class="v146-home-character-main"><div><b>隊伍空位</b><span>--</span></div><div class="v146-home-resource hp"><i style="width:0%"></i><strong>HP --</strong></div><div class="v146-home-resource sp"><i style="width:0%"></i><strong>SP --</strong></div></div></article>');
                continue;
            }
            const hp=Math.max(0,Math.min(rosterNumber(stats.maxHP),rosterNumber(character.hp)));
            const sp=Math.max(0,Math.min(rosterNumber(stats.maxSP),rosterNumber(character.sp)));
            const hpPercent=rosterNumber(stats.maxHP)>0?hp/rosterNumber(stats.maxHP)*100:0;
            const spPercent=rosterNumber(stats.maxSP)>0?sp/rosterNumber(stats.maxSP)*100:0;
            const artwork=typeof getCharacterArtworkPath==="function"?getCharacterArtworkPath(character):"";
            cards.push('<article class="v146-home-character" data-home-roster-slot="'+slotIndex+'" data-element="'+rosterEscape(character.element||"fire")+'">'+
                '<div class="v146-home-avatar"><img src="'+rosterEscape(artwork)+'" alt="'+rosterEscape(character.id||"角色")+'頭像"></div>'+
                '<div class="v146-home-character-main"><div><b>'+rosterEscape(character.id||("角色"+(index+1)))+'</b><span>Lv.'+Math.max(1,Math.floor(rosterNumber(character.level)||1))+'</span></div>'+
                '<div class="v146-home-resource hp"><i style="width:'+hpPercent+'%"></i><strong>HP '+Math.floor(hp)+' / '+Math.floor(rosterNumber(stats.maxHP))+'</strong></div>'+
                '<div class="v146-home-resource sp"><i style="width:'+spPercent+'%"></i><strong>SP '+Math.floor(sp)+' / '+Math.floor(rosterNumber(stats.maxSP))+'</strong></div></div></article>');
        }

        roster.querySelectorAll(".v146-home-character").forEach(node=>node.remove());
        const relicSlot=roster.querySelector(".team-relic-loadout-slot");
        if(relicSlot){ relicSlot.insertAdjacentHTML("beforebegin",cards.join("")); }
        else{ roster.insertAdjacentHTML("beforeend",cards.join("")); }
        roster.dataset.ready="true";
        syncHomeRelicSummary();
        return true;
    }
    window.v54RenderHomeRoster=renderHomeRoster;
    window.FourSymbolsHomeRelicSummary=Object.freeze({
        ensureShell:ensureHomeRosterShell,
        sync:syncHomeRelicSummary,
        prepareFirstScreenVisuals
    });
    document.addEventListener("four-symbols:startup-ready",function(){
        const roster=document.getElementById("v146HomeRoster");
        if(!roster||roster.dataset.ready!=="true"){renderHomeRoster();}
        syncHomeRelicSummary();
    });

    function boot(){
        apply();
        ensureAdFreeConfig();
        ensureHomeRosterShell();
    }

    if(document.readyState === "loading"){
        document.addEventListener("DOMContentLoaded",boot,{once:true});
    }else{
        boot();
    }
})();


/* bundled source: js/17-stage-v60-training-render-guard.js */
(function(){
"use strict";
window.GAME_NATIVE_CONFIRMED_BASELINE="V54";
window.GAME_NATIVE_CURRENT_VERSION="V60";
window.GAME_NATIVE_LAST_SCOPE="training-full-source-audit";

const V17344_ZONE_ART={
    desert:"assets/maps/desert-v17344.png",
    ice:"assets/maps/ice-v17344.png",
    zone4:"assets/maps/zone4-v17344.png",
    zone5:"assets/maps/zone5-v17344.png",
    zone6:"assets/maps/zone6-v17344.png",
    zone7:"assets/maps/zone7-v17344.png",
    zone8:"assets/maps/zone8-v17344.png",
    zone9:"assets/maps/zone9-v17344.png",
    zone10:"assets/maps/zone10-v17344.png"
};
try{ if(typeof zoneBackgroundImages!=="undefined"){ Object.assign(zoneBackgroundImages,V17344_ZONE_ART); } }catch(_){ }
try{ if(typeof mapZoneBackgroundImages!=="undefined"){ Object.assign(mapZoneBackgroundImages,V17344_ZONE_ART); } }catch(_){ }

function enforceTrainingRender(){
    const page=document.getElementById("trainingPage");
    if(page){
        page.querySelectorAll(".training-zone-item").forEach(function(el){
            el.style.setProperty("font-size","20px","important");
            el.style.setProperty("padding","6px 14px","important");
            el.style.setProperty("min-height","42px","important");
            el.style.setProperty("line-height","1.15","important");
            el.style.setProperty("box-sizing","border-box","important");
        });
    }

    /*
       The training zone information modal used to receive width/max-height/
       overflow inline styles here. Those declarations fought the shared UI
       sizing authority and made the whole frame the scroll owner. Geometry is
       now owned by css/20-stage-v60-training-only-safety.css; this runtime guard
       intentionally touches only the training-zone list items above.
    */
}
if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",enforceTrainingRender,{once:true});
}else{
    enforceTrainingRender();
}
})();


/* bundled source: js/18-stage-v64-character-touch-action-runtime.js */
(function(){
"use strict";
function setCharacterTouchMode(active){
    const root=document.documentElement;
    const body=document.body;
    const viewport=document.getElementById("game-viewport");
    const stage=document.getElementById("game-stage");
    [root,body,viewport,stage].forEach(function(el){
        if(!el)return;
        el.classList.toggle("character-scroll-active",!!active);
    });
}
function syncCharacterTouchMode(){
    const modal=document.getElementById("homeFeatureModal");
    const tabs=document.getElementById("characterTabContent");
    const active=!!(modal && tabs && getComputedStyle(modal).display!=="none" && modal.classList.contains("show"));
    setCharacterTouchMode(active);
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",syncCharacterTouchMode,{once:true});
else syncCharacterTouchMode();
const characterModal=document.getElementById("homeFeatureModal");
if(characterModal&&typeof MutationObserver!=="undefined"){
    const observer=new MutationObserver(syncCharacterTouchMode);
    observer.observe(characterModal,{subtree:true,childList:true,attributes:true,attributeFilter:["class","style"]});
}
window.syncCharacterTouchMode=syncCharacterTouchMode;
})();


/* bundled source: js/19-stage-v78-character-inventory-runtime.js */
(function(){
"use strict";

let rafId=0;

function getStageScale(){
    const stage=
        document.getElementById(
            "game-stage"
        );

    if(!stage){
        return 1;
    }

    const rect=
        stage.getBoundingClientRect();

    const scale=
        rect.width/1080;

    return (
        Number.isFinite(scale) &&
        scale>0
    )
        ? scale
        : 1;
}

function releaseCharacterLayoutOwnership(modal,body,root,inventory,force){
    if(
        !modal ||
        (!force && modal.dataset.v78CharacterLayoutActive!=="1")
    ){
        return;
    }

    const box=modal.querySelector(".home-feature-modal-box.wide");
    if(box){
        [
            "display","flex-direction","width","max-width","height",
            "max-height","min-height","overflow"
        ].forEach(property=>box.style.removeProperty(property));
    }

    if(body){
        [
            "display","flex-direction","flex","height","min-height","overflow"
        ].forEach(property=>body.style.removeProperty(property));
    }

    if(root){
        [
            "flex","height","max-height","min-height","overflow-y","overflow-x",
            "-webkit-overflow-scrolling","overscroll-behavior-y","touch-action",
            "scrollbar-gutter"
        ].forEach(property=>root.style.removeProperty(property));
    }

    if(inventory){
        ["overflow","transform"].forEach(property=>inventory.style.removeProperty(property));
    }

    delete modal.dataset.v78CharacterLayoutActive;
}

function applyNow(){
    const modal=
        document.getElementById(
            "homeFeatureModal"
        );

    const body=
        document.getElementById(
            "homeFeatureModalBody"
        );

    const root=
        document.getElementById(
            "characterTabContent"
        );

    const inventory=
        document.getElementById(
            "inventoryPage"
        );

    if(
        !modal ||
        !body ||
        !modal.classList.contains("show")
    ){
        return;
    }

    /*
       Team Relic owns the shared modal body as its vertical scroll container.
       Its class can be applied before #characterTabContent is physically
       replaced, so containment alone is not a sufficient ownership test.
       Relinquish the character layout synchronously as soon as the relic modal
       class appears; force also clears any stale inline !important styles left
       by an older character view even if the dataset marker was lost.
    */
    const relicOwnsSharedModal=
        modal.classList.contains("team-relic-modal") ||
        modal.classList.contains("team-relic-mode");

    if(relicOwnsSharedModal){
        releaseCharacterLayoutOwnership(
            modal,
            body,
            root,
            inventory,
            true
        );
        return;
    }

    /*
       This owner is only valid while the character/status/skill/inventory
       shell is actually mtail: error writing 'standard output': Broken pipe
ounted inside the shared modal body. The same modal
       is reused by shop, quests, synthesis and Team Relic. Previously this
       function kept writing inline !important overflow:hidden to the shared
       body even after another feature took ownership, which could override
       Team Relic's legitimate overflow-y:auto and produce intermittent mobile
       scrolling depending on MutationObserver timing.

       The root can be completely removed when another feature replaces the
       modal body, so release must also run when #characterTabContent no longer
       exists at all; returning early on !root would leave the stale inline
       styles behind indefinitely. DOM test doubles used by the repository do
       not all implement Element.contains(), so the real containment check is
       used when available and otherwise falls back to the historical mounted
       assumption for those isolated fixtures.
    */
    const characterRootMounted=!!root&&(
        typeof body.contains==="function"
            ?body.contains(root)
            :true
    );
    if(!characterRootMounted){
        releaseCharacterLayoutOwnership(modal,body,root,inventory);
        return;
    }

    const box=
        modal.querySelector(
            ".home-feature-modal-box.wide"
        );

    if(!box){
        return;
    }

    modal.dataset.v78CharacterLayoutActive="1";

    box.style.setProperty(
        "display",
        "flex",
        "important"
    );

    box.style.setProperty(
        "flex-direction",
        "column",
        "important"
    );

    /*
       V173.63 visible-layout authority:
       character/status/skill/inventory share the maximum mobile canvas.
       The former 396 × 620 inline Large Panel values overrode the V173.62
       stylesheet, so the screen never actually expanded on phones. Keep one
       fixed outer frame here and let only the inner tab content scroll.
    */
    box.style.setProperty(
        "width",
        "calc(100% - 8px)",
        "important"
    );

    box.style.setProperty(
        "max-width",
        "none",
        "important"
    );

    box.style.setProperty(
        "height",
        "calc(100% - 8px)",
        "important"
    );

    box.style.setProperty(
        "max-height",
        "calc(100% - 8px)",
        "important"
    );

    box.style.setProperty(
        "min-height",
        "0",
        "important"
    );

    box.style.setProperty(
        "overflow",
        "hidden",
        "important"
    );

    body.style.setProperty(
        "display",
        "flex",
        "important"
    );

    body.style.setProperty(
        "flex-direction",
        "column",
        "important"
    );

    body.style.setProperty(
        "flex",
        "1 1 auto",
        "important"
    );

    body.style.setProperty(
        "height",
        "auto",
        "important"
    );

    body.style.setProperty(
        "min-height",
        "0",
        "important"
    );

    body.style.setProperty(
        "overflow",
        "hidden",
        "important"
    );

    root.style.setProperty(
        "flex",
        "1 1 auto",
        "important"
    );

    root.style.setProperty(
        "height",
        "auto",
        "important"
    );

    root.style.setProperty(
        "max-height",
        "none",
        "important"
    );

    root.style.setProperty(
        "min-height",
        "0",
        "important"
    );

    const inventoryOwnsScroll=
        !!(
            inventory &&
            inventory.parentElement===root
        );

    root.style.setProperty(
        "overflow-y",
        inventoryOwnsScroll
            ? "hidden"
            : "scroll",
        "important"
    );

    root.style.setProperty(
        "overflow-x",
        "hidden",
        "important"
    );

    root.style.setProperty(
        "-webkit-overflow-scrolling",
        "touch",
        "important"
    );

    root.style.setProperty(
        "overscroll-behavior-y",
        "contain",
        "important"
    );

    root.style.setProperty(
        "touch-action",
        "pan-y",
        "important"
    );

    root.style.setProperty(
        "scrollbar-gutter",
        "stable",
        "important"
    );

    if(inventoryOwnsScroll){
        inventory.style.setProperty(
            "overflow",
            "visible",
            "important"
        );

        inventory.style.setProperty(
            "transform",
            "none",
            "important"
        );

        /*
           V77 的 1/3 再縮小 1/3：
           1/3 × 2/3 = 2/9 可視高度。
        */
        const stageHeight=
            Math.max(
                180,
                Math.min(
                    300,
                    Math.round(
                        Math.max(
                            180,
                            root.clientHeight
                        )*
                        2/9
                    )
                )
            );

        inventory.style.setProperty(
            "--inventory-stage-height",
            stageHeight+"px"
        );
    }
}

function schedule(){
    if(rafId){
        cancelAnimationFrame(
            rafId
        );
    }

    rafId=
        requestAnimationFrame(
            function(){
                rafId=0;
                applyNow();
            }
        );
}

/* Late feature runtimes are production bundles owned by FourSymbolsFeatures. */

if(
    document.readyState===
    "loading"
){
    document.addEventListener(
        "DOMContentLoaded",
        function(){
            schedule();
        },
        {once:true}
    );
}
else{
    schedule();
}

const characterModal=document.getElementById("homeFeatureModal");
if(characterModal&&typeof MutationObserver!=="undefined"){
    const observer=new MutationObserver(schedule);
    observer.observe(characterModal,{
        childList:true,
        subtree:true,
        attributes:true,
        attributeFilter:["class"]
    });
    characterModal.addEventtail: error writing 'standard output': Broken pipe
Listener("click",schedule,{passive:true});
}

window.addEventListener(
    "resize",
    schedule,
    {passive:true}
);

window.v78ApplyCharacterInventoryLayout=
    schedule;
})();


/* bundled source: js/23-v125-character-creation-bootstrap.js */
/* =====================================================
   V174 — PRE-PAINT CHARACTER CREATION BOOTSTRAP + SAVE GUARD
   The creation page starts inside #app for legacy HTML compatibility.

   IMPORTANT:
   - This bootstrap only prepares the DOM location. It never decides that
     character creation is active before persisted data has been restored.
   - A fail-closed primary-character guard prevents an accidental creation
     screen after reload from overwriting an existing saved slot-1 character.
===================================================== */
(function bootstrapNativeCreationPage(){
    "use strict";

    const page=document.getElementById("creationPage");
    const overlay=document.getElementById("game-overlay-layer");

    if(page&&overlay&&page.parentElement!==overlay){
        overlay.appendChild(page);
    }
    if(page){
        page.dataset.nativePrepaint="v174-dom-only";
    }

    function loadCriticalUiStyle(){
        /* Production app-shell CSS owns this style; no runtime stylesheet request. */
        return true;
    }

    function primaryState(state,primary,reason){
        return {state,primary:primary||null,reason:reason||""};
    }

    function readPersistedPrimaryCharacter(){
        let raw="";
        try{
            const repository=window.FourSymbolsAccountSave;
            const active=repository&&repository.readActive();
            if(!active||active.status==="inactive"){ return primaryState("unsafe",null,"account-unresolved"); }
            if(active.status==="empty"){ return primaryState("empty",null,"no-account-save"); }
            raw=JSON.stringify(active.save);
        }catch(_){
            /* Storage being unreadable must never turn into permission to
               overwrite character data. This is intentionally fail-closed. */
            return primaryState("unsafe",null,"storage-unreadable");
        }

        if(!raw){
            return primaryState("empty",null,"no-save");
        }

        let saved=null;
        try{
            saved=JSON.parse(raw);
        }catch(_){
            return primaryState("unsafe",null,"save-json-invalid");
        }

        if(!saved||typeof saved!=="object"||Array.isArray(saved)){
            return primaryState("unsafe",null,"save-shape-invalid");
        }

        const primary=saved.player;
        if(primary===undefined||primary===null){
            /* An empty object is a valid pre-character state in historical
               startup/test flows. */
            return primaryState("empty",null,"no-primary");
        }
        if(typeof primary!=="object"||Array.isArray(primary)){
            return primaryState("unsafe",null,"primary-shape-invalid");
        }

        /* Character ID is the canonical creation identity. Once it exists,
           slot 1 is occupied regardless of whether another field (for example
           level) has become malformed. Never require level to be healthy in
           order to protect an existing character. */
        const id=String(primary.id||"").trim();
        if(id){
            return primaryState("occupied",primary,"primary-id-present");
        }

        /* The canonical uncreated template is id:"", level:1, exp:0.
           If identity is missing but progress/secondary-character evidence is
           present, treat the save as unsafe instead of assuming the slot is
           free. This prevents a partially damaged save from being overwritten. */
        const level=Number(primary.level);
        const exp=Number(primary.exp);
        const progressed=(Number.isFinite(level)&&level>1)||(Number.isFinite(exp)&&exp>0);
        const hasSecondary=!!(
            saved.player2&&typeof saved.player2==="object"&&String(saved.player2.id||"").trim()
        )||!!(
            saved.player3&&typeof saved.player3==="object"&&String(saved.player3.id||"").trim()
        );

        if(progressed||hasSecondary){
            return primaryState("unsafe",primary,"primary-identity-missing");
        }

        return primaryState("empty",primary,"blank-primary-template");
    }

    function showPrimaryProtection(state){
        const primary=state&&state.primary;
        const id=String(primary&&primary.id||"").trim();
        const level=Number(primary&&primary.level);
        const occupied=state&&state.state==="occupied";
        const message=occupied
            ?("偵測到既有主角色存檔「"+id+"」"+
                (Number.isFinite(level)&&level>=1?"Lv."+Math.floor(level):"")+"。為避免覆寫原角色，本次創建已取消；請重新整理後繼續遊戲。")
            :"偵測到角色存檔讀取異常或既有角色痕跡。為避免任何角色資料被覆寫，本次創建已取消；請先重新整理，若仍出現此訊息請保留存檔並停止建立角色。";
        if(typeof window.rpgAlert==="function"){
            void window.rpgAlert(message,{title:"角色存檔保護",confirmText:"知道了",danger:true});
        }else if(typeof window.alert==="function"){
            window.alert(message);
        }
    }

    function installPrimaryCreationSaveGuard(){
        const current=window.createCharacter;
        if(typeof current!=="function"||current.__v174PersistedPrimaryGuard===true){
            return;
        }

        function guardedCreateCharacter(){
            let targetSlot=1;
            try{
                if(typeof creationTargetSlot!=="undefined"){
                    targetSlot=Math.max(1,Math.floor(Number(creationTargetSlot)||1));
                }
            }catch(_){ }

            const persisted=readPersistedPrimaryCharacter();

            /* An unreadable/corrupt canonical save blocks every character
               creation path, because createAddtail: error writing 'standard output': Broken pipe
tail: error writing 'standard output': Broken pipe
itionalCharacter eventually
               saves through the same canonical key. A healthy occupied primary
               blocks only slot 1; slot 2/3 remain legitimate additions. */
            if(
                persisted.state==="unsafe"||
                (targetSlot===1&&persisted.state==="occupied")
            ){
                showPrimaryProtection(persisted);
                return false;
            }

            return current.apply(this,arguments);
        }

        guardedCreateCharacter.__v174PersistedPrimaryGuard=true;
        guardedCreateCharacter.__v174OriginalCreateCharacter=current;
        window.createCharacter=guardedCreateCharacter;
    }

    function finalizeBootstrap(){
        installPrimaryCreationSaveGuard();
    }

    loadCriticalUiStyle();

    if(document.readyState==="loading"){
        document.addEventListener("DOMContentLoaded",finalizeBootstrap,{once:true});
    }else{
        finalizeBootstrap();
    }
})();


/* bundled source: js/24-v125-character-creation-native-runtime.js */
/* =====================================================
   V128 — FIXED TWO-STEP 1080 × 1920 CHARACTER CREATION RUNTIME
   - Uses the V128 pre-paint native bootstrap; reparenting is only a fallback
   - Uses real native component dimensions, never migration scale
   - Gender / portrait switching
   - Element positioning with larger element descriptions
   - Fixed Android Chrome canvas with no page scroll or pinch zoom
   - Two-step creation flow; ability allocation lives on page two
   Existing combat/stat/skill formulas are not changed.
===================================================== */
(function(){
    "use strict";

    const PORTRAITS={
        female:{
            fire:"assets/characters/female_fire.jpg",
            water:"assets/characters/female_water.jpg",
            wind:"assets/characters/female_wind.jpg",
            earth:"assets/characters/female_earth.jpg"
        },
        male:{
            fire:"assets/characters/male_fire.jpg",
            water:"assets/characters/male_water.jpg",
            wind:"assets/characters/male_wind.jpg",
            earth:"assets/characters/male_earth.jpg"
        }
    };

    const META={
        fire:{
            glyph:"火",
            title:"烈焰之道",
            role:"爆發輸出 · 爆擊 · 燃燒",
            description:"以高爆發、爆擊與燃燒持續傷害壓制敵人，物理與法術兩條路線都偏向主動進攻。",
            tags:["高爆發","爆擊強化","燃燒傷害"]
        },
        water:{
            glyph:"水",
            title:"寒水之道",
            role:"吸取回復 · 冰封 · 治療復活",
            description:"兼具續航、控場與隊伍回復；攻擊技能可吸取HP與SP，並擁有冰封、治療與復活能力。",
            tags:["HP/SP吸取","冰封控場","治療復活"]
        },
        wind:{
            glyph:"風",
            title:"疾風之道",
            role:"速度干擾 · 傷害削弱 · 閃避控場",
            description:"透過敏捷、閃避與各式干擾掌握戰鬥節奏，可降低敵方能力、傷害與命中並施加暈眩。",
            tags:["敏捷干擾","閃避強化","暈眩／降傷"]
        },
        earth:{
            glyph:"土",
            title:"厚土之道",
            role:"護盾防禦 · 降防 · 石化反傷",
            description:"重視生存與隊伍防護，能建立護盾、反傷與結界，同時以降防與石化控制敵方。",
            tags:["護盾防護","降防石化","反傷結界"]
        }
    };

    let selectedGender="female";
    let selectedCreationStep=1;

    function byId(id){
        return document.getElementById(id);
    }

    function migrateCreationPageToNativeLayer(){
        const page=byId("creationPage");
        const overlay=byId("game-overlay-layer");
        if(!page || !overlay){return null;}

        if(page.parentElement!==overlay){
            overlay.appendChild(page);
        }

        page.classList.add("native-creation-page","game-native-ui");
        page.dataset.nativeWidth="1080";
        page.dataset.nativeHeight="1920";
        page.dataset.nativeMigration="actual-dimensions";

        [
            "left","top","right","bottom","width","height",
            "min-width","min-height","max-width","max-height",
            "margin","transform","transform-origin"
        ].forEach(function(property){
            page.style.removeProperty(property);
        });

        /* This layer contains interactive native UI, so it cannot stay
           hidden from accessibility APIs. Pointer ownership remains on
           #creationPage; the overlay itself still uses pointer-events:none. */
        overlay.removeAttribute("aria-hidden");
        return page;
    }

    function setCreationTouchMode(active){
        const fixedNodes=[
            document.documentElement,
            document.body,
            byId("game-viewport"),
            byId("game-stage"),
            byId("game-overlay-layer")
        ];

        fixedNodes.forEach(function(node){
            if(node){
                node.classList.remove("creation-scroll-active");
                node.classList.toggle("creation-fixed-active",!!active);
            }
        });

        if(active){
            fixedNodes.concat(byId("creationPage")).forEach(function(node){
                if(node){
                    node.scrollTop=0;
                    node.scrollLeft=0;
                }
            });
        }

        const stage=byId("game-stage");
        const app=byId("app");

        if(stage){
            stage.classList.toggle("creation-native-active",!!active);
        }

        if(app){
            app.inert=!!active;
            if(active){
                app.setAttribute("aria-hidden","true");
            }else{
                app.removeAttribute("aria-hidden");
            }
        }

        if(active){
            window.scrollTo(0,0);
        }
    }

    function syncCreationTouchMode(){
        const page=migrateCreationPageToNativeLayer();
        const visible=!!page && window.getComputedStyle(page).display!=="none";
        setCreationTouchMode(visible);
    }

    function installCreationGestureLock(){
        const page=byId("creationPage");
        if(!page || page.dataset.gestureLockReady==="true"){
            return;
        }

        ["touchmove","wheel","gesturestart","gesturechange","gestureend"].forEach(function(eventName){
            page.addEventListener(eventName,function(event){
                event.preventDefault();
            },{passive:false});
        });

        page.dataset.gestureLockReady="true";
    }

    function applyCreationStep(step){
        const page=byId("creationPage");
        const normalized=Number(step)===2?2:1;
        selectedCreationStep=normalized;

        document.querySelectorAll("#creationPage [data-creation-step]").forEach(function(panel){
            const active=Number(panel.dataset.creationStep)===normalized;
            panel.classList.toggle("is-active",active);
            panel.hidden=!active;
            panel.setAttribute("aria-hidden",active?"false":"true");
        });

        document.querySelectorAll("#creationPage [data-creation-step-indicator]").forEach(function(indicator){
            const active=Number(indicator.dataset.creationStepIndicator)===normalized;
            indicator.classList.toggle("is-active",active);
            if(active){
                indicator.setAttribute("aria-current","step");
            }else{
                indicator.removeAttribute("aria-current");
            }
        });

        if(page){
            page.dataset.step=String(normalized);
            page.scrollTop=0;
        }

        ["game-viewport","game-stage","game-overlay-layer"].forEach(function(id){
            const node=byId(id);
            if(node){
                node.scrollTop=0;
                node.scrollLeft=0;
            }
        });

        if(document.activeElement && typeof document.activeElement.blur==="function"){
            document.activeElement.blur();
        }
        window.scrollTo(0,0);
    }

    window.setCreationStep=function(step){
        applyCreationStep(step);
    };

    function orderedSkills(element,category){
        if(typeof skillDatabase==="undefined"){
            return [];
        }
        return Object.keys(skillDatabase)
            .map(function(id){return skillDatabase[id];})
            .filter(function(skill){
                return skill && skill.element===element && skill.category===category;
            })
            .sort(function(a,b){
                return Number(a.tier||99)-Number(b.tier||99);
            });
    }

    function specialSkills(element){
        if(typeof skillDatabase==="undefined"){
            return [];
        }
        const order={buff:1,heal:2,revive:3,passive:4};
        return Object.keys(skillDatabase)
            .map(function(id){return skillDatabase[id];})
            .filter(function(skill){
                return skill && skill.element===element && order[skill.category];
            })
            .sort(function(a,b){
                const cat=(order[a.category]||99)-(order[b.category]||99);
                if(cat!==0){return cat;}
                return Number(a.tier||99)-Number(b.tier||99);
            });
    }

    function renderSkillChips(containerId,skills){
        const box=byId(containerId);
        if(!box){return;}
        box.innerHTML="";
        skills.forEach(function(skill,index){
            const chip=document.createElement("button");
            chip.type="button";
            chip.className="creation-skill-chip"+(index===skills.length-1?" signature":"");
            chip.dataset.skillId=skill.id;
            chip.textContent=skill.name;
            chip.title=skill.description||skill.name;
            chip.setAttribute("aria-haspopup","dialog");
            chip.setAttribute("aria-label",skill.name+"，點擊查看詳細介紹");
            chip.addEventListener("click",function(){
                window.showCreationSkillDetail(skill.id);
            });
            box.appendChild(chip);
        });
    }

    function escapeHTML(value){
        return String(value===undefined||value===null?"":value)
            .replace(/&/g,"&amp;")
            .replace(/</g,"&lt;")
            .replace(/>/g,"&gt;")
            .replace(/"/g,"&quot;")
            .replace(/'/g,"&#39;");
    }

    function valueAtLevel(values,level){
        if(!Array.isArray(values) || values.length<1){
            return undefined;
        }
        return values[Math.min(level-1,values.length-1)];
    }

    function creationSkillCategoryLabel(category){
        try{
            if(typeof getSkillCategoryLabel==="function"){
                return getSkillCategoryLabel(category);
            }
        }catch(error){}

        const labels={
            physical:"物理",
            magic:"法術",
            buff:"增益",
            heal:"回復",
            revive:"復活",
            passive:"被動"
        };
        return labels[category]||"技能";
    }

    function creationSkillTargetLabel(targetType){
        const labels={
            single:"單體敵人",
            tri:"同橫排最多3名敵人",
            row:"任一敵方橫排",
            all:"敵方全體",
            ally:"單一友方",
            allyAll:"我方全體",
            deadAlly:"死亡友方",
            none:"永久被動"
        };
        return labels[targetType]||"依技能規則";
    }

    function skillLevelParts(skill,level){
        const parts=[];

        if(
            (skill.category==="physical" || skill.category==="magic") &&
            skill.baseDamage!==undefined
        ){
            let damage=Number(skill.baseDamage||0)+Number(skill.damagePerLevel||0)*(level-1);
            try{
                if(typeof getSkillDamageAtLevel==="function"){
              tail: error writing 'standard output': Broken pipe
tail: error writing 'standard output': Broken pipe
      damage=getSkillDamageAtLevel(skill,level);
                }
            }catch(error){}

            parts.push(
                "傷害"+Math.floor(damage)+
                (skill.damagePerLevel ? "（每級+"+skill.damagePerLevel+"）" : "")
            );
        }

        const burnPercent=valueAtLevel(skill.burnPercentByLevel,level);
        if(skill.burnChance!==undefined && burnPercent!==undefined){
            parts.push(
                skill.burnChance+"%機率燃燒"+
                (skill.burnDuration||2)+"回合，每回合造成最大HP "+
                burnPercent+"%傷害"
            );
        }

        if(skill.freezeChance!==undefined){
            parts.push(
                skill.freezeChance+"%機率冰封"+
                (skill.freezeDuration||1)+"回合"
            );
        }

        const lifesteal=valueAtLevel(skill.lifestealPercentByLevel,level);
        if(lifesteal!==undefined){
            parts.push("吸取傷害"+lifesteal+"%，等量回復自身HP與SP");
        }

        const agilityDown=valueAtLevel(skill.agilityDownByLevel,level);
        if(agilityDown!==undefined){
            parts.push(
                skill.agilityDownChance+"%機率降低敏捷"+
                agilityDown+"%，持續"+(skill.agilityDownDuration||2)+"回合"
            );
        }

        const statDown=valueAtLevel(skill.statDownByLevel,level);
        if(statDown!==undefined){
            parts.push(
                skill.statDownChance+"%機率降低所有能力"+
                statDown+"%，持續"+(skill.statDownDuration||2)+"回合"
            );
        }

        const damageDown=valueAtLevel(skill.damageDownByLevel,level);
        if(damageDown!==undefined){
            parts.push(
                skill.damageDownChance+"%機率降低造成傷害"+
                damageDown+"%，持續"+(skill.damageDownDuration||1)+"回合"
            );
        }

        const defenseDown=valueAtLevel(skill.defenseDownByLevel,level);
        if(defenseDown!==undefined){
            parts.push(
                skill.defenseDownChance+"%機率降低防禦"+
                defenseDown+"%，持續"+(skill.defenseDownDuration||2)+"回合"
            );
        }

        const finalHitChanceDown=valueAtLevel(skill.missBonusByLevel,level);
        if(finalHitChanceDown!==undefined){
            parts.push(
                skill.stunChance+"%機率暈眩"+
                (skill.stunDuration||2)+"回合，最終命中率降低"+finalHitChanceDown+"%"
            );
        }

        const petrifyChance=valueAtLevel(skill.petrifyChanceByLevel,level);
        if(petrifyChance!==undefined){
            parts.push(
                petrifyChance+"%機率石化"+
                (skill.petrifyDuration||2)+"回合"
            );
        }

        const selfShield=valueAtLevel(skill.selfShieldByLevel,level);
        if(selfShield!==undefined){
            parts.push(
                "自身護盾"+selfShield+"點，持續"+
                (skill.shieldDuration||2)+"回合"
            );
        }

        const allyShield=valueAtLevel(skill.allyShieldByLevel,level);
        if(allyShield!==undefined){
            parts.push(
                "我方全體護盾"+allyShield+"點，持續"+
                (skill.shieldDuration||2)+"回合"
            );
        }

        const critBonus=valueAtLevel(skill.critBonusByLevel,level);
        if(skill.category==="buff" && critBonus!==undefined){
            parts.push(
                "我方爆擊率與爆擊傷害 +"+critBonus+
                "%，持續"+skill.duration+"回合"
            );
        }
        else if(skill.category==="buff" && skill.evasionBonusPercent!==undefined){
            parts.push(
                "閃躲率 +"+skill.evasionBonusPercent+
                "%，持續"+skill.duration+"回合"
            );
        }
        else if(skill.category==="buff" && skill.defenseBonusPercent!==undefined){
            parts.push(
                "防禦力 +"+skill.defenseBonusPercent+
                "%，持續"+skill.duration+"回合"
            );
        }
        else if(skill.category==="buff" && skill.reflectPercent!==undefined){
            parts.push(
                "反傷 "+skill.reflectPercent+
                "%，持續"+skill.duration+"回合"
            );
        }
        else if(skill.category==="buff" && skill.statusResistBonus!==undefined){
            parts.push(
                "異常狀態抗性 +"+skill.statusResistBonus+
                "%，持續"+skill.duration+"回合"
            );
        }
        else if(skill.category==="buff"){
            parts.push(skill.description);
        }

        if(skill.category==="heal"){
            let hpCoefficient=1.25;
            let spCoefficient=.5;
            try{
                if(typeof HEALING_INT_COEFFICIENT!=="undefined"){
                    hpCoefficient=HEALING_INT_COEFFICIENT;
                }
                if(typeof SP_HEALING_INT_COEFFICIENT!=="undefined"){
                    spCoefficient=SP_HEALING_INT_COEFFICIENT;
                }
            }catch(error){}

            const hpBase=Number(skill.baseHeal||0)+Number(skill.healPerLevel||0)*(level-1);
            const spBase=Number(skill.baseHealSP||0)+Number(skill.healSPPerLevel||0)*(level-1);
            parts.push(
                "回復HP：基礎"+hpBase+"＋智力×"+hpCoefficient+
                "；回復SP：基礎"+spBase+"＋智力×"+spCoefficient+
                "（施放者本人不回復SP）"
            );
        }

        const revivePercent=valueAtLevel(skill.reviveHealPercentByLevel,level);
        if(skill.category==="revive" && revivePercent!==undefined){
            parts.push("復活並恢復"+revivePercent+"%最大HP");
        }

        if(skill.category==="passive"){
            parts.push(skill.description);
        }

        if(parts.length<1){
            parts.push(skill.description||"依技能說明生效。");
        }

        return Array.from(new Set(parts.filter(Boolean)));
    }

    function buildCreationSkillLevelRows(skill){
        const maxLevel=Math.max(1,Number(skill.maxLevel)||1);
        const rows=[];

        for(let level=1;level<=maxLevel;level++){
            const details=skillLevelParts(skill,level);
            rows.push(
                '<div class="creation-skill-detail-level-row">'+
                    '<b>Lv.'+level+'</b>'+
                    '<span>'+details.map(escapeHTML).join("｜")+'</span>'+
                '</div>'
            );
        }

        return rows.join("");
    }

    function ensureCreationSkillDetailModal(){
        let modal=byId("creationSkillDetailModal");
        if(modal){
            return modal;
        }

        const overlay=byId("game-overlay-layer");
        if(!overlay){
            return null;
        }

        modal=document.createElement("div");
        modal.id="creationSkillDetailModal";
        modal.setAttribute("role","dialog");
        modal.setAttribute("aria-modal","true");
        modal.setAttribute("aria-hidden","true");
        modal.setAttribute("aria-labelledby","creationSkillDetailName");
        modal.innerHTML=
            '<div class="creation-skill-detail-box">'+
                '<div class="creation-skill-detail-header">'+
                    '<div id="creationSkillDetailGlyph" class="creation-skill-detail-glyph">技</div>'+
                    '<div class="creation-skill-detail-heading">'+
                        '<div id="creationSkillDetailName" class="creation-skill-detail-name">技能介紹</div>'+
                        '<div id="creationSkillDetailPath" class="creation-skill-detail-path"></div>'+
                    '</div>'+
                    '<button id="creationSkillDetailX" class="creation-skill-detail-x" type="button" aria-label="關閉技能介紹">×</button>'+
                '</div>'+
                '<div id="creationSkillDetailTags" class="creation-skill-detail-tags"></div>'+
                '<div id="creationSkillDetailDescription" class="creation-skill-detail-description"></div>'+
                '<div id="creationSkillDetailMeta" class="creation-skill-detail-meta"></div>'+
                '<div class="creation-skill-detail-section-title">各等級數值</div>'+
                '<div id="creationSkillDetailLevels" class="creation-skill-detail-levels"></div>'+
                '<button id="creationSkillDetailClose" class="creation-skill-detail-close" type="button">關閉</button>'+
            '</div>';

        overlay.appendChild(modal);

        modal.addEventListener("click",function(event){
            if(event.target===modal){
                window.closeCreationSkillDetail();
            }
        });

        byId("creationSkillDetailX").addEventListener("click",window.closeCreationSkillDetail);
        byId("creationSkillDetailClose").addEventListener("click",window.closeCreationSkillDetail);
        return modal;
    }

    let creationSkillDetailReturnFocus=null;

    window.showCreationSkillDetail=function(skillId){
        if(typeof skillDatabase==="undefined"){
            return;
        }

        const skill=skillDatabase[skillId];
        const modal=ensureCreationSkillDetailModal();
        const page=byId("creationPage");
        if(!skill || !modal || !page){
            return;
        }

        creationSkillDetailReturnFocus=document.activeElement;
        modal.dataset.element=skill.element||"fire";

        const elementLabels={fire:"火",water:"水",wind:"風",earth:"土"};
        byId("creationSkillDetailGlyph").textContent=elementLabels[skill.element]||"技";
        byId("creationSkillDetailName").textContent=skill.name;
        byId("creationSkillDetailPath").textContent=
            (elementLabels[skill.element]||"元素")+"系 · "+
            creationSkillCategoryLabel(skill.category);
        byId("creationSkillDetailDescription").textContent=skill.description||"";

        const tags=[
            creationSkillCategoryLabel(skill.category),
            creationSkillTargetLabel(skill.targetType),
            "最高 Lv."+(skill.maxLevel||1)
        ];
        byId("creationSkillDetailTags").innerHTML=tags
            .map(function(text){
                return '<span class="creation-skill-detail-tag">'+escapeHTML(text)+'</span>';
            })
            .join("");

        const meta=[];
        const spCost=skill.spCost!==undefined?skill.spCost:skill.cost;
        if(skill.category==="passive"){
            meta.push("被動技能，不用裝備，學習後永久生效");
        }
        else if(spCost!==undefined){
            meta.push("消耗 "+spCost+" SP");
        }
        if(skill.learnCost!==undefined){
            const baseLearnCost=typeof window.v173GetInitialLearnCost==="function"
                ?window.v173GetInitialLearnCost(null,skill)
                :skill.learnCost;
            meta.push("學習需要 "+baseLearnCost+" 技能點");
        }
        if(Array.isArray(skill.requires) && skill.requires.length){
            meta.push(
                "前置技能："+skill.requires
                    .map(function(id){
                        return skillDatabase[id]?skillDatabase[id].name:id;
                    })
                    .join("、")
            );
        }
        byId("creationSkillDetailMeta").textContent=meta.join("｜");
        byId("creationSkillDetailLevels").innerHTML=buildCreationSkillLevelRows(skill);
        byId("creationSkillDetailLevels").scrollTop=0;

        page.classList.add("creation-skill-detail-open");
        page.inert=true;
        page.setAttribute("aria-hidden","true");
        modal.classList.add("show");
        modal.setAttribute("aria-hidden","false");

        window.setTimeout(function(){
            const closeButton=byId("creationSkillDetailX");
            if(closeButton){
                closeButton.focus({preventScroll:true});
            }
        },0);
    };

    windowtail: write error: Broken pipe
.closeCreationSkillDetail=function(){
        const modal=byId("creationSkillDetailModal");
        const page=byId("creationPage");

        if(modal){
            modal.classList.remove("show");
            modal.setAttribute("aria-hidden","true");
        }

        if(page){
            page.classList.remove("creation-skill-detail-open");
            page.inert=false;
            page.removeAttribute("aria-hidden");
        }

        const focusTarget=creationSkillDetailReturnFocus;
        creationSkillDetailReturnFocus=null;
        window.setTimeout(function(){
            if(
                focusTarget &&
                focusTarget.isConnected &&
                page &&
                window.getComputedStyle(page).display!=="none"
            ){
                focusTarget.focus({preventScroll:true});
            }
        },0);
    };

    document.addEventListener("keydown",function(event){
        const modal=byId("creationSkillDetailModal");
        if(event.key==="Escape" && modal && modal.classList.contains("show")){
            event.preventDefault();
            window.closeCreationSkillDetail();
        }
    });

    function renderCreationShowcase(element){
        const page=byId("creationPage");
        if(!page){return;}

        const chosen=META[element]?element:"fire";
        const meta=META[chosen];
        page.dataset.element=chosen;
        page.dataset.gender=selectedGender;

        const portrait=byId("creationPortrait");
        if(portrait){
            portrait.src=PORTRAITS[selectedGender][chosen];
            portrait.alt=(chosen==="fire"?"火":chosen==="water"?"水":chosen==="wind"?"風":"土")+
                "元素"+(selectedGender==="male"?"男性":"女性")+"角色立繪";
        }

        const labelMap={fire:"火元素",water:"水元素",wind:"風元素",earth:"土元素"};
        if(byId("creationPortraitElement")){byId("creationPortraitElement").textContent=labelMap[chosen];}
        if(byId("creationPortraitGender")){byId("creationPortraitGender").textContent=selectedGender==="male"?"少俠":"女俠";}
        if(byId("creationElementBadge")){byId("creationElementBadge").textContent=meta.glyph;}
        if(byId("creationElementTitle")){byId("creationElementTitle").textContent=meta.title;}
        if(byId("creationElementRole")){byId("creationElementRole").textContent=meta.role;}
        if(byId("creationElementDescription")){byId("creationElementDescription").textContent=meta.description;}

        const tags=byId("creationElementTags");
        if(tags){
            tags.innerHTML="";
            meta.tags.forEach(function(text){
                const tag=document.createElement("span");
                tag.className="creation-role-tag";
                tag.textContent=text;
                tags.appendChild(tag);
            });
        }

    }

    window.selectCreationGender=function(gender){
        selectedGender=gender==="male"?"male":"female";

        const female=byId("creationGenderFemale");
        const male=byId("creationGenderMale");
        if(female){female.classList.toggle("selected",selectedGender==="female");}
        if(male){male.classList.toggle("selected",selectedGender==="male");}

        let element="fire";
        try{
            if(typeof selectedCreationElement!=="undefined" && META[selectedCreationElement]){
                element=selectedCreationElement;
            }
        }catch(error){}
        renderCreationShowcase(element);
    };

    /* Keep one source of truth for element mechanics: use the existing selectElement().
       This wrapper only adds the new creation-page visual refresh. */
    if(typeof window.selectElement==="function"){
        const originalSelectElement=window.selectElement;
        window.selectElement=function(element){
            const result=originalSelectElement.apply(this,arguments);
            renderCreationShowcase(element);
            return result;
        };
    }

    /* Gender is presentation/profile data only. It does not alter any formulas.
       Assign before the existing createCharacter() saves player. */
    if(typeof window.createCharacter==="function"){
        const originalCreateCharacter=window.createCharacter;
        window.createCharacter=function(){
            try{
                if(
                    typeof player!=="undefined" &&
                    (
                        typeof creationTargetSlot==="undefined" ||
                        creationTargetSlot===1
                    )
                ){
                    player.gender=selectedGender;
                }
            }catch(error){}
            try{
                return originalCreateCharacter.apply(this,arguments);
            }finally{
                /* 驗證失敗時創角頁仍會顯示，不能提前關掉手機垂直滑動。 */
                syncCreationTouchMode();
            }
        };
    }

    if(typeof window.showCreation==="function"){
        const originalShowCreation=window.showCreation;
        window.showCreation=function(){
            migrateCreationPageToNativeLayer();
            try{
                return originalShowCreation.apply(this,arguments);
            }finally{
                setCreationTouchMode(true);
                installCreationGestureLock();
                applyCreationStep(1);
                renderCreationShowcase(
                    (typeof selectedCreationElement!=="undefined" && META[selectedCreationElement])
                    ? selectedCreationElement
                    : "fire"
                );
            }
        };
    }

    /* Existing saves do not contain gender. Defaulting to female is backward-compatible. */
    try{
        if(typeof player!=="undefined" && player && (player.gender==="male" || player.gender==="female")){
            selectedGender=player.gender;
        }
    }catch(error){}

    const initialElement=(function(){
        try{
            return (typeof selectedCreationElement!=="undefined" && META[selectedCreationElement])
                ? selectedCreationElement
                : "fire";
        }catch(error){
            return "fire";
        }
    })();

    migrateCreationPageToNativeLayer();
    installCreationGestureLock();
    applyCreationStep(1);
    window.selectCreationGender(selectedGender);
    renderCreationShowcase(initialElement);
    syncCreationTouchMode();

    window.getCreationNativeLayoutDiagnostics=function(){
        const page=migrateCreationPageToNativeLayer();
        const shell=page && page.querySelector(".creation-premium-shell");
        if(!page){return null;}
        const pageStyle=window.getComputedStyle(page);
        const shellStyle=shell?window.getComputedStyle(shell):null;
        return {
            parentId:page.parentElement?page.parentElement.id:null,
            nativeWidth:pageStyle.width,
            nativeHeight:pageStyle.height,
            transform:pageStyle.transform,
            overflowY:pageStyle.overflowY,
            pointerEvents:pageStyle.pointerEvents,
            shellPadding:shellStyle?shellStyle.padding:null,
            migration:page.dataset.nativeMigration||null,
            prepaint:page.dataset.nativePrepaint||null,
            fixedMode:document.documentElement.classList.contains("creation-fixed-active"),
            step:selectedCreationStep,
            skillPreviewPresent:!!byId("creationPhysicalSkills")
        };
    };

    /* 第二／三角色共用創角頁時，取消或完成後也要能主動解除
       Android 的固定創角手勢模式。 */
    window.syncCreationTouchMode=syncCreationTouchMode;

    /* No MutationObserver / extra touch listeners.
       A second sync after current call stack covers loadGame() timing safely. */
    window.setTimeout(syncCreationTouchMode,0);
})();


/* bundled source: js/20-anonymous-20.js */
/* Critical/feature boundary owner. No global input lock and no network-order patch chain. */
const V_ASSET_VERSION="173.72";

(function installFeatureIntentBoundary(){
    "use strict";
    if(window.__fourSymbolsFeatureIntentInstalled){ return; }
    window.__fourSymbolsFeatureIntentInstalled=true;

    const rules=[
        {pattern:/showPage\(['"]map|enterZone|enterMap|openMap|patrol/i,feature:"patrol",label:"巡怪"},
        {pattern:/showPage\(['"]inventory|open.*inventory|backpack/i,feature:"inventory",label:"背包"},
        {pattern:/equipment|reforge/i,feature:"equipment",label:"裝備"},
        {pattern:/showPage\(['"]dungeon|dungeon/i,feature:"dungeon",label:"副本"},
        {pattern:/abyss/i,feature:"abyss",label:"深淵"},
        {pattern:/boss|tower/i,feature:"boss-tower",label:"四象塔"},
        {pattern:/relic/i,feature:"relic",label:"秘寶"},
        {pattern:/skill/i,feature:"skill",label:"技能"},
        {pattern:/shop/i,feature:"shop",label:"商店"},
        {pattern:/synth/i,feature:"synthesis",label:"合成"},
        {pattern:/battle/i,feature:"battle",label:"戰鬥"}
    ];
    function target(event){ return event.target&&event.target.closest&&event.target.closest("button,a,[data-feature]"); }
    function isBattleRuntimeInteraction(element){
        return !!(element&&element.closest&&element.closest("#battlePage"));
    }
    function isExpPoolInteraction(element){
        return !!(element&&element.closest&&element.closest("#homeExpPoolCard"));
    }
    function descriptor(element){
        if(!element){ return null; }
        /* 經驗池本身屬於主城 app-shell，但「預覽升級＋二次確認」owner 在
           gameplay-core。自從 gameplay-core 改成 lazy 後，若不先載入 owner，
           舊的即時分配按鈕就可能在防呆安裝前被點到。 */
        if(isExpPoolInteraction(element)){
            return {feature:"battle",label:"經驗池安全升級",expPool:true};
        }
        const explicit=element.dataset&&element.dataset.feature;
        if(explicit){ return {feature:explicit,label:element.getAttribute("aria-label")||element.textContent||explicit}; }
        const signature=[element.id,element.className,element.getAttribute&&element.getAttribute("onclick"),element.textContent].join(" ");
        return rules.find(rule=>rule.pattern.test(signature))||null;
    }
    function loader(){ return window.FourSymbolsFeatures; }
    function setLocalLoading(element,active,label){
        if(!element){ return; }
        element.classList.toggle("is-feature-loading",active);
        element.setAttribute("aria-busy",active?"true":"false");
        if(active){ element.dataset.featureLoadingLabel="正在載入"+(label||"功能")+"…"; }
        else{ delete element.dataset.featureLoadingLabel; }
    }

    let expPoolPrimePromise=null;
    let expPoolSafetyUiReady=false;
    function refreshExpPoolSafetyUiOnce(){
        if(expPoolSafetyUiReady){ return; }
        expPoolSafetyUiReady=true;
        if(typeof window.renderExpDistributeList==="function"){
            window.renderExpDistributeList();
        }
        if(typeof window.v173DecorateExpPoolDistributionUi==="function"){
            window.v173DecorateExpPoolDistributionUi();
        }
        const pool=document.getElementById("homeExpPoolCard");
        if(pool){ pool.dataset.expSafetyOwner="ready"; }
    }
    function primeExpPoolSafety(){
        const pool=document.getElementById("homeExpPoolCard");
        const api=loader();
        if(!pool||!api){ return; }
        const visible=!pool.hidden&&window.getComputedStyle(pool).display!=="none"&&pool.getClientRects().length>0;
        if(!visible){ return; }
        if(api.isReady("battle")){
            refreshExpPoolSafetyUiOnce();
            return;
        }
        if(expPoolPrimePromise){ return; }
        setLocalLoading(pool,true,"經驗池安全升級");
        expPoolPrimePromise=api.ensure("battle","exp-pool-safety").then(()=>{
            setLocalLoading(pool,false);
            refreshExpPoolSafetyUiOnce();
        }).catch(error=>{
            setLocalLoading(pool,false);
            console.error("EXP pool safety owner failed to load:",error);
            document.dispatchEvent(new CustomEvent("four-symbols:feature-local-error",{detail:{feature:"battle",error}}));
        }).finally(()=>{ expPoolPrimePromise=null; });
    }
    function prefetch(event){
        const element=target(event); if(isBattleRuntimeInteraction(element)){ return; }
        const info=descriptor(element); const api=loader();
        if(info&&api&&!api.isReady(info.feature)){ void api.prefetch(info.feature,event.type); }
    }
    function enter(event){
        const element=target(event); if(isBattleRuntimeInteraction(element)){ return; }
        const info=descriptor(element); const api=loader();
        if(!info||!api||api.isReady(info.feature)||element.dataset.featureReplay==="1"){ return; }
        event.preventDefault(); event.stopImmediatePropagation();
        if(element.dataset.featureLoading==="1"){ return; }
        element.dataset.featureLoading="1"; setLocalLoading(element,true,info.label);
        api.ensure(info.feature,info.expPool?"exp-pool-safety":"navigation").then(()=>{
            delete element.dataset.featureLoading; setLocalLoading(element,false);
            if(info.expPool){
                /* 不 replay 舊 DOM 上可能仍指向 immediate distribute 的 handler。
                   先由正式 owner 重繪成「預覽 → 確認」UI，玩家再點一次才會花 EXP。 */
                refreshExpPoolSafetyUiOnce();
                return;
            }
            element.dataset.featureReplay="1"; element.click(); delete element.dataset.featureReplay;
        }).catch(error=>{
            delete element.dataset.featureLoading; setLocalLoading(element,false);
            console.error("Feature failed to load:",info.feature,error);
            document.dispatchEvent(new CustomEvent("four-symbols:feature-local-error",{detail:{feature:info.feature,error}}));
        });
    }
    document.addEventListener("pointerdown",prefetch,{capture:true,passive:true});
    document.addEventListener("touchstart",prefetch,{capture:true,passive:true});
    document.addEventListener("click",enter,true);
    document.addEventListener("four-symbols:startup-ready",()=>{
        const api=loader();
        if(api){
            try{if(performance&&typeof performance.mark==="function"){performance.mark("four-symbols:background-prefetch-start");}}catch(_){ }
            api.idle(["inventory","shop","equipment","synthesis","relic"],["relicIcons"]).then(result=>{
                try{if(Array.isArray(result)&&result.at(-1)&&performance&&typeof performance.mark==="function"){performance.mark("four-symbols:relic-prefetch-ready");}}catch(_){ }
                return api.idle(["patrol","skill"]);
            }).then(()=>{try{if(performance&&typeof performance.mark==="function"){performance.mark("four-symbols:background-prefetch-idle");}}catch(_){ }});
        }
        primeExpPoolSafety();
    },{once:true});

    function primeExpPoolSafetyWhenDomReady(){
        primeExpPoolSafety();
    }
    if(document.readyState==="loading"){
        document.addEventListener("DOMContentLoaded",primeExpPoolSafetyWhenDomReady,{once:true});
    }else{
        primeExpPoolSafetyWhenDomReady();
    }
})();

(function initBattleElementBoxDrag(){
    function bind(){
        const button=document.getElementById("battleElementBoxButton");
        const page=document.getElementById("battlePage");
        if(!button||!page||button.dataset.dragReady==="1"){ return; }
        button.dataset.dragReady="1";
        let drag=null; let suppressClick=false; const threshold=5;
        function logicalScale(){
            const rect=page.getBoundingClientRect();
            return {rect,sx:rect.width?page.clientWidth/rect.width:1,sy:rect.height?page.clientHeight/rect.height:1};
        }
        button.addEventListener("pointerdown",event=>{
            if(event.pointerType==="mouse"&&event.button!==0){ return; }
            const scale=logicalScale(); const bounds=button.getBoundingClientRect();
            drag={pointerId:event.pointerId,x:event.clientX,y:event.clientY,left:(bounds.left-scale.rect.left)*scale.sx,top:(bounds.top-scale.rect.top)*scale.sy,sx:scale.sx,sy:scale.sy,moved:false};
            suppressClick=false; button.classList.add("dragging");
            try{ button.setPointerCapture(event.pointerId); }catch(_){ }
            event.preventDefault();
        });
        button.addEventListener("pointermove",event=>{
            if(!drag||event.pointerId!==drag.pointerId){ return; }
            const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
            if(!drag.moved&&Math.hypot(dx,dy)>=threshold){ drag.moved=true; }
            if(!drag.moved){ return; }
            const left=Math.max(0,Math.min(Math.max(0,page.clientWidth-button.offsetWidth),drag.left+dx*drag.sx));
            const top=Math.max(0,Math.min(Math.max(0,page.clientHeight-button.offsetHeight),drag.top+dy*drag.sy));
            button.style.setProperty("left",left+"px","important"); button.style.setProperty("top",top+"px","important");
            button.style.setProperty("bottom","auto","important"); event.preventDefault();
        });
        function finish(event){
            if(!drag||event.pointerId!==drag.pointerId){ return; }
            suppressClick=drag.moved; drag=null; button.classList.remove("dragging"); event.preventDefault();
        }
        button.addEventListener("pointerup",finish); button.addEventListener("pointercancel",finish);
        button.addEventListener("click",event=>{
            if(suppressClick){ suppressClick=false; event.preventDefault(); event.stopPropagation(); return; }
            if(typeof openHomeFeature==="function"){ openHomeFeature("autoBattleSettings"); }
        });
        button.addEventListener("dragstart",event=>event.preventDefault());
    }
    if(document.readyState==="loading"){ document.addEventListener("DOMContentLoaded",bind,{once:true}); }else{ bind(); }
})();


/* bundled source: js/61-v174-ui-regression-guards.js */
/* =====================================================
   V174 — dynamic UI regression guards
   Owner for cross-cutting UI invariants created by multiple late runtimes:
   1) dark text on bright gold/yellow buttons must not have a text shadow;
   3) system save/delete subflows must always offer an explicit return path.

   No gameplay, save, battle, skill-cost or equipment business rules live here.
===================================================== */
(function installV174UiRegressionGuards(){
    "use strict";

    if(typeof window==="undefined"||typeof document==="undefined"||window.__v174UiRegressionGuardsInstalled){
        return;
    }
    window.__v174UiRegressionGuardsInstalled=true;

    let rafId=0;

    function colorTriples(value){
        const triples=[];
        String(value||"").replace(/rgba?\(\s*(\d+(?:\.\d+)?)\s*[, ]\s*(\d+(?:\.\d+)?)\s*[, ]\s*(\d+(?:\.\d+)?)(?:\s*[,/]\s*(\d*(?:\.\d+)?))?\s*\)/gi,
            function(_,r,g,b,a){
                const alpha=a===""||a===undefined?1:Number(a);
                triples.push({r:Number(r),g:Number(g),b:Number(b),a:Number.isFinite(alpha)?alpha:1});
                return _;
            }
        );
        return triples;
    }

    function luminance(color){
        return color.r*.2126+color.g*.7152+color.b*.0722;
    }

    function isBrightGold(color){
        return color.a>.05&&
            color.r>=145&&
            color.g>=90&&
            color.g<=225&&
            color.b<=145&&
            color.r>=color.g&&
            luminance(color)>=115;
    }

    function isDarkText(color){
        return color&&color.a>.05&&luminance(color)<=115;
    }

    function normalizeGoldButtonTextShadows(){
        document.querySelectorAll("#homeFeatureModal button, #allSkillsList button, #v169RpgDialogLayer button, #creationPage button").forEach(button=>{
            const style=window.getComputedStyle(button);
            const textColor=colorTriples(style.color)[0];
            const backgroundColors=colorTriples(style.backgroundColor+" "+style.backgroundImage);
            const qualifies=isDarkText(textColor)&&backgroundColors.some(isBrightGold);

            if(qualifies){
                if(button.dataset.v174DarkGoldShadow!=="1"||style.textShadow!=="none"){
                    button.style.setProperty("text-shadow","none","important");
                    button.dataset.v174DarkGoldShadow="1";
                }
            }else if(button.dataset.v174DarkGoldShadow==="1"){
                button.style.removeProperty("text-shadow");
                delete button.dataset.v174DarkGoldShadow;
            }
        });
    }

    function ensureStylesheetLast(){
        const link=document.getElementById("v174-critical-ui-regression-style");
        if(link&&link.parentElement===document.head&&link!==document.head.lastElementChild){
            document.head.appendChild(link);
        }
    }

    function systemRowTitle(button){
        const row=button&&button.closest&&button.closest(".system-panel-row");
        const title=row&&row.querySelector("strong");
        return String(title&&title.textContent||"").trim();
    }

    async function ensureRpgDialogOwner(reason){
        if(typeof window.rpgAlert==="function"&&typeof window.rpgConfirm==="function"){ return true; }
        if(window.FourSymbolsFeatures&&typeof window.FourSymbolsFeatures.ensure==="function"){
            try{ await window.FourSymbolsFeatures.ensure("gameplay-core",reason||"system-dialog"); }
            catch(error){ console.error("System dialog owner failed to load:",error); }
        }
        return typeof window.rpgAlert==="function"&&typeof window.rpgConfirm==="function";
    }

    async function runSystemSaveAction(button){
        if(button.dataset.v174SystemBusy==="1"){ return; }
        button.dataset.v174SystemBusy="1";
        button.disabled=true;
        try{
            const saved=typeof window.saveGame==="function"?window.saveGame():false;
            const ready=await ensureRpgDialogOwner("system-save-feedback");
            const success=saved!==false;
            if(ready){
                await window.rpgAlert(
                    success?"已完成手動存檔。":"目前無法完成手動存檔。",
                    {title:"遊戲存檔",confirmText:"返回系統",tone:success?"success":"normal"}
                );
            }else if(typeof window.alert==="function"){
                window.alert(success?"已完成手動存檔。":"目前無法完成手動存檔。");
            }
        }finally{
            delete button.dataset.v174SystemBusy;
            button.disabled=false;
        }
    }

    async function runSystemDeleteAction(button){
        if(button.dataset.v174SystemBusy==="1"){ return; }
        button.dataset.v174SystemBusy="1";
        button.disabled=true;
        try{
            const ready=await ensureRpgDialogOwner("system-delete-confirm");
            if(ready&&typeof window.resetGame==="function"){
                await window.resetGame();
            }
        }finally{
            delete button.dataset.v174SystemBusy;
            button.disabled=false;
        }
    }

    function interceptSystemAction(event){
        const button=event.target&&event.target.closest&&event.target.closest(".system-panel-row .home-feature-buy-btn");
        if(!button){ return; }
        const title=systemRowTitle(button);
        if(title!=="遊戲存檔"&&title!=="刪除角色"){ return; }

        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        if(title==="遊戲存檔"){ void runSystemSaveAction(button); }
        else{ void runSystemDeleteAction(button); }
    }

    function normalizeSystemDialogNavigation(){
        const layer=document.getElementById("v169RpgDialogLayer");
        if(!layer||!layer.classList.contains("show")){ return; }
        const title=layer.querySelector("#v169RpgDialogTitle");
        if(String(title&&title.textContent||"").trim()!=="刪除角色"){ return; }
        const cancel=layer.querySelector(".v169-rpg-dialog-actions .v169-rpg-dialog-button.secondary");
        if(cancel&&!cancel.hidden&&cancel.textContent!=="返回系統"){
            cancel.textContent="返回系統";
            cancel.setAttribute("aria-label","返回系統，不刪除角色");
        }
    }

    function apply(){
        normalizeGoldButtonTextShadows();
        normalizeSystemDialogNavigation();
        ensureStylesheetLast();
    }

    function schedule(){
        if(rafId){ return; }
        rafId=requestAnimationFrame(()=>{
            rafId=0;
            apply();
        });
    }

    const roots=[
        document.getElementById("homeFeatureModal"),
        document.getElementById("creationPage"),
        document.getElementById("v169RpgDialogLayer")
    ].filter(Boolean);
    if(typeof MutationObserver!=="undefined"&&roots.length){
        const observer=new MutationObserver(schedule);
        roots.forEach(root=>observer.observe(root,{
            childList:true,
            subtree:true,
            characterData:true,
            attributes:true,
            attributeFilter:["class","style","disabled"]
        }));
    }

    const systemRoot=document.getElementById("homeFeatureModal");
    if(systemRoot){ systemRoot.addEventListener("click",interceptSystemAction,true); }
    document.addEventListener("v173:runtime-ready",schedule,{passive:true});
    window.addEventListener("resize",schedule,{passive:true});

    if(document.readyState==="loading"){
        document.addEventListener("DOMContentLoaded",schedule,{once:true});
    }else{
        schedule();
    }

    window.v174ApplyUiRegressionGuards=schedule;
})();


/* bundled source: js/release-update-notification.js */
/*
   Release Update Notification System
   ----------------------------------
   Player-facing release notices are owned by release/release-update.json.
   This app-shell module deliberately reuses #homeFeatureModal and the native
   #game-overlay-layer; it does not introduce a second modal or announcement
   framework.
*/
(function installReleaseUpdateNotification(global){
    "use strict";

    if(!global||global.FourSymbolsReleaseUpdate){ return; }

    const RELEASE_NOTICE_PATH="release/release-update.json";
    const CHECK_INTERVAL_MS=4*60*1000;
    const MIN_CHECK_GAP_MS=45*1000;
    const REMINDER_COOLDOWN_MS=20*60*1000;
    const REQUEST_TIMEOUT_MS=8000;
    const PENDING_RECHECK_MS=1500;
    const STORAGE_NAMESPACE="four-symbols:release-update:";
    const DEV_PREVIEW_QUERY="releaseUpdatePreview";
    const DEV_PREVIEW_HOSTS=new Set([
        "dev.four-symbols-dev.pages.dev",
        "localhost",
        "127.0.0.1",
        "::1"
    ]);

    const state={
        started:false,
        checking:null,
        lastCheckAt:0,
        manifest:null,
        loadedReleaseVersion:null,
        marquee:null,
        pollTimer:null,
        pendingTimer:null,
        pendingNormalReload:false,
        pendingForcedUpdate:false,
        pendingAnnouncement:false,
        loginAnnouncementShown:false,
        forcedModalLock:false,
        modalOpen:false,
        modalKind:null,
        devPreviewMode:null,
        criticalOperations:new Map(),
        nextOperationId:1
    };

    function now(){ return Date.now(); }

    function getLocationHostname(){
        try{
            const location=global.location;
            const hostname=String(location&&location.hostname||"")
                .trim()
                .toLowerCase()
                .replace(/^\[|\]$/g,"");
            if(hostname){ return hostname; }
            const href=String(location&&location.href||"");
            return href?new URL(href).hostname.toLowerCase().replace(/^\[|\]$/g,""):"";
        }catch(_){ return ""; }
    }

    function getDevPreviewMode(){
        if(!DEV_PREVIEW_HOSTS.has(getLocationHostname())){ return null; }
        try{
            const location=global.location;
            const base=(global.document&&global.document.baseURI)||(location&&location.href)||undefined;
            const mode=new URL(String(location&&location.href||""),base)
                .searchParams
                .get(DEV_PREVIEW_QUERY);
            return mode==="marquee"||mode==="modal"?mode:null;
        }catch(_){ return null; }
    }

    function normalizeVersion(value){
        const raw=String(value==null?"":value).trim().replace(/^V/i,"");
        return raw ? "V"+raw : "";
    }

    function parseVersion(value){
        const normalized=normalizeVersion(value).replace(/^V/,"");
        if(!/^\d+(?:\.\d+)+$/.test(normalized)){ return null; }
        return normalized.split(".").map(part=>Number(part));
    }

    function compareVersions(left,right){
        const a=parseVersion(left);
        const b=parseVersion(right);
        if(!a||!b){ return null; }
        const length=Math.max(a.length,b.length);
        for(let index=0;index<length;index++){
            const delta=(a[index]||0)-(b[index]||0);
            if(delta!==0){ return delta>0?1:-1; }
        }
        return 0;
    }

    function escapeHtml(value){
        return String(value==null?"":value)
            .replace(/&/g,"&amp;")
            .replace(/</g,"&lt;")
            .replace(/>/g,"&gt;")
            .replace(/\"/g,"&quot;")
            .replace(/'/g,"&#039;");
    }

    function getLoadedReleaseVersion(){
        const build=global.__FOUR_SYMBOLS_BUILD__;
        const value=build&&build.release;
        return normalizeVersion(value);
    }

    function getStorage(){
        try{ return global.localStorage||null; }
        catch(_){ return null; }
    }

    function storageKey(suffix){
        const repository=global.FourSymbolsAccountSave;
        try{
            if(repository&&typeof repository.accountKey==="function"){
                return repository.accountKey("release-update-"+suffix);
            }
        }catch(_){ }
        return STORAGE_NAMESPACE+suffix;
    }

    function readStorage(suffix){
        const storage=getStorage();
        if(!storage){ return null; }
        try{ return storage.getItem(storageKey(suffix)); }
        catch(_){ return null; }
    }

    function writeStorage(suffix,value){
        const storage=getStorage();
        if(!storage){ return; }
        try{ storage.setItem(storageKey(suffix),String(value)); }
        catch(_){ }
    }

    function removeStorage(suffix){
        const storage=getStorage();
        if(!storage){ return; }
        try{
            if(typeof storage.removeItem==="function"){ storage.removeItem(storageKey(suffix)); }
        }catch(_){ }
    }

    function localDateKey(value){
        const date=new Date(value==null?now():value);
        if(Number.isNaN(date.getTime())){ return ""; }
        const yyyy=date.getFullYear();
        const mm=String(date.getMonth()+1).padStart(2,"0");
        const dd=String(date.getDate()).padStart(2,"0");
        return yyyy+"-"+mm+"-"+dd;
    }

    function readTodaySuppression(){
        try{
            const value=JSON.parse(readStorage("suppress-today")||"null");
            return value&&typeof value==="object"?value:null;
        }catch(_){ return null; }
    }

    function isCurrentNoticeSuppressedToday(manifest){
        if(!manifest){ return false; }
        const value=readTodaySuppression();
        return !!(
            value&&
            value.noticeId===manifest.noticeId&&
            value.dateKey===localDateKey()
        );
    }

    function setCurrentNoticeSuppressedToday(enabled){
        const manifest=state.manifest;
        if(!manifest){ return; }
        if(enabled){
            writeStorage("suppress-today",JSON.stringify({
                noticeId:manifest.noticeId,
                dateKey:localDateKey()
            }));
        }else{
            removeStorage("suppress-today");
        }
    }

    function validateManifest(value){
        if(!value||typeof value!=="object"||Array.isArray(value)){ return null; }
        const releaseVersion=normalizeVersion(value.releaseVersion);
        const updateMode=value.updateMode;
        const minimumVersion=value.minimumVersion===null||value.minimumVersion===undefined||value.minimumVersion===""
            ? null
            : normalizeVersion(value.minimumVersion);
        const content=Array.isArray(value.content)?value.content:null;
        if(
            value.schemaVersion!==1||
            typeof value.publicNotice!=="boolean"||
            !parseVersion(releaseVersion)||
            typeof value.noticeId!=="string"||!value.noticeId.trim()||
            typeof value.title!=="string"||!value.title.trim()||
            typeof value.summary!=="string"||!value.summary.trim()||
            !content||content.length===0||content.some(item=>typeof item!=="string"||!item.trim())||
            typeof value.publishedAt!=="string"||!value.publishedAt.trim()||
            !Number.isFinite(Date.parse(value.publishedAt))||
            (updateMode!=="normal"&&updateMode!=="forced")||
            (minimumVersion!==null&&!parseVersion(minimumVersion))
        ){
            return null;
        }
        return {
            schemaVersion:1,
            publicNotice:value.publicNotice,
            releaseVersion,
            noticeId:value.noticeId.trim(),
            title:value.title.trim(),
            summary:value.summary.trim(),
            content:content.map(item=>item.trim()),
            publishedAt:value.publishedAt,
            updateMode,
            minimumVersion
        };
    }

    function hasUnreadReleaseNotice(){
        const manifest=state.manifest;
        const loaded=state.loadedReleaseVersion||getLoadedReleaseVersion();
        if(!manifest||!manifest.publicNotice||!loaded){ return false; }
        if(compareVersions(loaded,manifest.releaseVersion)!==0){ return false; }
        return (
            readStorage("last-seen-version")!==manifest.releaseVersion||
            readStorage("last-seen-notice")!==manifest.noticeId
        );
    }

    function markCurrentNoticeSeen(){
        const manifest=state.manifest;
        if(!manifest){ return; }
        writeStorage("last-seen-version",manifest.releaseVersion);
        writeStorage("last-seen-notice",manifest.noticeId);
        refreshNotificationDots();
    }

    function shouldAutoShowLoginAnnouncement(manifest){
        const loaded=state.loadedReleaseVersion||getLoadedReleaseVersion();
        if(
            state.loginAnnouncementShown||
            state.pendingAnnouncement||
            !manifest||
            !manifest.publicNotice||
            !loaded||
            compareVersions(loaded,manifest.releaseVersion)!==0
        ){
            return false;
        }
        return !isCurrentNoticeSuppressedToday(manifest);
    }

    function isSharedModalAvailableForAnnouncement(){
        const parts=getSharedModalParts();
        return !!(
            parts&&
            (!parts.modal.classList||!parts.modal.classList.contains("show"))
        );
    }

    function readReminder(){
        try{
            const value=JSON.parse(readStorage("last-reminder")||"null");
            return value&&typeof value==="object"?value:null;
        }catch(_){ return null; }
    }

    function shouldShowReminder(manifest){
        const reminder=readReminder();
        return !reminder||reminder.noticeId!==manifest.noticeId||now()-Number(reminder.at||0)>=REMINDER_COOLDOWN_MS;
    }

    function rememberReminder(manifest){
        writeStorage("last-reminder",JSON.stringify({noticeId:manifest.noticeId,at:now()}));
    }

    function getUnsafeReasons(){
        const reasons=[];
        try{
            if(typeof battleActive!=="undefined"&&battleActive){ reasons.push("battle"); }
            if(typeof battlePhase!=="undefined"&&battlePhase==="resolve"){ reasons.push("battle-resolution"); }
        }catch(_){ }
        try{
            if(
                global.FourSymbolsBattleFlow&&
                typeof global.FourSymbolsBattleFlow.isPresentationActive==="function"&&
                global.FourSymbolsBattleFlow.isPresentationActive()
            ){
                reasons.push("battle-presentation");
            }
        }catch(_){ }
        if(state.criticalOperations.size){ reasons.push("critical-operation"); }

        const documentRef=global.document;
        if(!documentRef||typeof documentRef.getElementById!=="function"){ return reasons; }
        const reward=documentRef.getElementById("v132RewardModal");
        if(reward&&reward.classList&&reward.classList.contains("show")){ reasons.push("reward"); }
        const dialog=documentRef.getElementById("v169RpgDialogLayer");
        if(dialog&&dialog.classList&&dialog.classList.contains("show")){ reasons.push("transaction-dialog"); }
        const modal=documentRef.getElementById("homeFeatureModal");
        if(
            modal&&modal.classList&&modal.classList.contains("show")&&
            !modal.classList.contains("release-update-modal")&&
            (
                modal.classList.contains("v141-synthesis-modal")||
                modal.classList.contains("v131-shop-open")||
                modal.classList.contains("team-relic-modal")
            )
        ){
            reasons.push("high-value-feature");
        }
        return reasons;
    }

    function canSafelyReloadForUpdate(){
        return getUnsafeReasons().length===0;
    }

    function beginCriticalOperation(label){
        const operationId=state.nextOperationId++;
        let active=true;
        state.criticalOperations.set(operationId,String(label||"critical-operation"));
        return function endCriticalOperation(){
            if(!active){ return; }
            active=false;
            state.criticalOperations.delete(operationId);
            resolvePendingWhenSafe();
        };
    }

    function getOverlayLayer(){
        const documentRef=global.document;
        return documentRef&&documentRef.getElementById
            ? documentRef.getElementById("game-overlay-layer")
            : null;
    }

    function ensureMarquee(){
        if(state.marquee&&state.marquee.isConnected!==false){ return state.marquee; }
        const documentRef=global.document;
        const layer=getOverlayLayer();
        if(!documentRef||!layer||typeof documentRef.createElement!=="function"){ return null; }
        const marquee=documentRef.createElement("button");
        marquee.type="button";
        marquee.id="releaseUpdateMarquee";
        marquee.className="release-update-marquee";
        marquee.setAttribute("aria-live","polite");
        marquee.setAttribute("aria-label","查看版本更新內容");
        marquee.innerHTML=
            '<span class="release-update-marquee-tag">更新</span>'+
            '<span class="release-update-marquee-text"></span>'+
            '<span class="release-update-marquee-action">查看</span>';
        marquee.addEventListener("click",()=>{
            const manifest=state.manifest;
            if(!manifest){ return; }
            if(state.devPreviewMode){
                openReleaseDetail(isForcedForLoadedVersion(manifest)?"forced":"preview");
                return;
            }
            if(isForcedForLoadedVersion(manifest)&&!canSafelyReloadForUpdate()){
                showMarquee(manifest,"forced-pending");
                schedulePendingResolution();
                return;
            }
            openReleaseDetail(isForcedForLoadedVersion(manifest)?"forced":"update");
        });
        layer.appendChild(marquee);
        state.marquee=marquee;
        return marquee;
    }

    function showMarquee(manifest,kind){
        const marquee=ensureMarquee();
        if(!marquee||!manifest){ return; }
        const tag=marquee.querySelector(".release-update-marquee-tag");
        const text=marquee.querySelector(".release-update-marquee-text");
        const action=marquee.querySelector(".release-update-marquee-action");
        const pending=kind==="normal-pending"||kind==="forced-pending";
        if(tag){ tag.textContent=kind&&kind.indexOf("forced")===0?"重要更新":"更新"; }
        if(text){
            text.textContent=pending
                ? manifest.releaseVersion+" 已發布；目前操作完成後將自動進行更新。"
                : manifest.releaseVersion+" 已發布，"+manifest.summary;
        }
        if(action){ action.textContent=pending?"待更新":"查看"; }
        marquee.classList.toggle("is-forced",kind&&kind.indexOf("forced")===0);
        marquee.classList.toggle("is-pending",!!pending);
        marquee.hidden=false;
    }

    function hideMarquee(){
        if(state.marquee){ state.marquee.hidden=true; }
    }

    function isForcedForLoadedVersion(manifest){
        const loaded=state.loadedReleaseVersion||getLoadedReleaseVersion();
        if(!manifest||!loaded){ return false; }
        if(manifest.updateMode==="forced"){ return true; }
        return !!(
            manifest.minimumVersion&&
            compareVersions(loaded,manifest.minimumVersion)!==null&&
            compareVersions(loaded,manifest.minimumVersion)<0
        );
    }

    function getSharedModalParts(){
        const documentRef=global.document;
        if(!documentRef||typeof documentRef.getElementById!=="function"){ return null; }
        const modal=documentRef.getElementById("homeFeatureModal");
        const title=documentRef.getElementById("homeFeatureModalTitle");
        const body=documentRef.getElementById("homeFeatureModalBody");
        if(!modal||!title||!body){ return null; }
        return {modal,title,body};
    }

    function renderReleaseContent(manifest,kind){
        const forced=kind==="forced";
        const preview=kind==="preview";
        const update=kind==="update";
        const intro=preview
            ? "目前為開發預覽模式；此畫面只用於檢查更新公告，不會重新載入遊戲。"
            : forced
                ? "目前版本已停止使用，請更新後繼續遊戲。"
                : update
                    ? "發現新版本。你可先完成目前操作，再更新至最新版本。"
                    : "以下是本次正式版本更新內容。";
        const notes=manifest.content.map(item=>"<li>"+escapeHtml(item)+"</li>").join("");
        const actions=preview
            ? '<div class="release-update-actions"><button type="button" class="release-update-primary" data-release-update-action="preview-close">關閉預覽</button></div>'
            : forced
                ? '<div class="release-update-actions"><button type="button" class="release-update-primary" data-release-update-action="reload">立即更新</button></div>'
                : update
                    ? '<div class="release-update-actions"><button type="button" data-release-update-action="later">稍後更新</button><button type="button" class="release-update-primary" data-release-update-action="reload">立即更新</button></div>'
                    : '<div class="release-update-actions"><button type="button" class="release-update-primary" data-release-update-action="acknowledge">我知道了</button></div>';
        const suppressToday=!forced&&!update
            ? '<label class="release-update-suppress-today"><input class="release-update-suppress-today-input" type="checkbox" data-release-update-suppress-today="true"><span>今日不再跳出提醒</span></label>'
            : '';
        return (
            '<section class="release-update-detail" data-release-update-kind="'+escapeHtml(kind)+'">'+
                '<p class="release-update-version">'+escapeHtml(manifest.releaseVersion)+'　'+escapeHtml(manifest.summary)+'</p>'+
                '<p class="release-update-intro">'+escapeHtml(intro)+'</p>'+
                '<h3>更新內容</h3>'+
                '<ul class="release-update-notes">'+notes+'</ul>'+
                '<p class="release-update-published">發布時間：'+escapeHtml(formatPublishedAt(manifest.publishedAt))+'</p>'+
                suppressToday+
                actions+
            '</section>'
        );
    }

    function formatPublishedAt(value){
        const date=new Date(value);
        if(Number.isNaN(date.getTime())){ return value; }
        const yyyy=date.getFullYear();
        const mm=String(date.getMonth()+1).padStart(2,"0");
        const dd=String(date.getDate()).padStart(2,"0");
        return yyyy+"-"+mm+"-"+dd;
    }

    function bindReleaseActions(body,kind){
        if(!body||typeof body.querySelectorAll!=="function"){ return; }
        body.querySelectorAll("[data-release-update-action]").forEach(button=>{
            button.addEventListener("click",()=>{
                const action=button.getAttribute("data-release-update-action");
                if(action==="reload"){ requestReload(); }
                else if(action==="later"){ deferNormalUpdate(); }
                else if(action==="acknowledge"){ acknowledgeCurrentRelease(); }
                else if(action==="preview-close"){ closeReleaseDetail(); }
            });
        });
    }

    function openReleaseDetail(kind){
        const manifest=state.manifest;
        const parts=getSharedModalParts();
        if(!manifest||!parts){ return false; }
        const forced=kind==="forced";
        if(forced&&!canSafelyReloadForUpdate()){
            state.pendingForcedUpdate=true;
            showMarquee(manifest,"forced-pending");
            schedulePendingResolution();
            return false;
        }

        /* Existing owner performs its normal borrowed-element cleanup first. */
        state.forcedModalLock=false;
        if(typeof global.closeHomeFeature==="function"){
            global.closeHomeFeature();
        }else{
            parts.modal.classList.remove("show");
        }

        parts.modal.classList.add("release-update-modal");
        parts.modal.classList.toggle("release-update-forced",forced);
        parts.title.textContent=manifest.title;
        parts.body.innerHTML=renderReleaseContent(manifest,kind);
        parts.modal.classList.add("show");
        state.modalOpen=true;
        state.modalKind=kind;
        state.forcedModalLock=forced;
        if(kind==="acknowledge"){ state.loginAnnouncementShown=true; }
        bindReleaseActions(parts.body,kind);
        if(forced){
            const primary=parts.body.querySelector(".release-update-primary");
            if(primary&&typeof primary.focus==="function"){ primary.focus(); }
        }
        return true;
    }

    function onSharedModalClosed(){
        const parts=getSharedModalParts();
        if(parts){
            parts.modal.classList.remove("release-update-modal","release-update-forced");
        }
        state.modalOpen=false;
        state.modalKind=null;
        state.forcedModalLock=false;
    }

    function shouldPreventSharedModalClose(){
        return state.forcedModalLock&&state.modalOpen;
    }

    function isForcedUpdateBlocking(){
        return shouldPreventSharedModalClose();
    }

    function announceForcedLock(){
        const parts=getSharedModalParts();
        if(parts&&parts.modal.classList.contains("release-update-forced")){
            const primary=parts.body.querySelector(".release-update-primary");
            if(primary&&typeof primary.focus==="function"){ primary.focus(); }
        }
    }

    function closeReleaseDetail(){
        state.forcedModalLock=false;
        if(typeof global.closeHomeFeature==="function"){
            global.closeHomeFeature();
        }else{
            const parts=getSharedModalParts();
            if(parts){ parts.modal.classList.remove("show"); }
            onSharedModalClosed();
        }
    }

    function acknowledgeCurrentRelease(){
        const parts=getSharedModalParts();
        const checkbox=parts&&parts.body&&typeof parts.body.querySelector==="function"
            ?parts.body.querySelector(".release-update-suppress-today-input")
            :null;
        setCurrentNoticeSuppressedToday(!!(checkbox&&checkbox.checked));
        markCurrentNoticeSeen();
        state.pendingAnnouncement=false;
        closeReleaseDetail();
        refreshNotificationDots();
    }

    function deferNormalUpdate(){
        const manifest=state.manifest;
        if(!manifest){ return; }
        if(state.devPreviewMode){
            closeReleaseDetail();
            return;
        }
        markCurrentNoticeSeen();
        hideMarquee();
        closeReleaseDetail();
        refreshNotificationDots();
    }

    function performReload(){
        try{
            if(global.location&&typeof global.location.reload==="function"){
                global.location.reload();
            }
        }catch(_){ }
    }

    function requestReload(){
        const manifest=state.manifest;
        if(!manifest){ return false; }
        if(state.devPreviewMode){
            closeReleaseDetail();
            return false;
        }
        markCurrentNoticeSeen();
        const forced=isForcedForLoadedVersion(manifest);
        if(!canSafelyReloadForUpdate()){
            if(forced){ state.pendingForcedUpdate=true; }
            else{ state.pendingNormalReload=true; }
            state.forcedModalLock=false;
            closeReleaseDetail();
            showMarquee(manifest,forced?"forced-pending":"normal-pending");
            schedulePendingResolution();
            return false;
        }
        performReload();
        return true;
    }

    function hasPendingWork(){
        return state.pendingForcedUpdate||state.pendingNormalReload||state.pendingAnnouncement;
    }

    function schedulePendingResolution(){
        if(!hasPendingWork()||state.pendingTimer!==null){ return; }
        state.pendingTimer=global.setTimeout(()=>{
            state.pendingTimer=null;
            resolvePendingWhenSafe();
        },PENDING_RECHECK_MS);
    }

    function resolvePendingWhenSafe(){
        if(!hasPendingWork()){ return; }
        if(!canSafelyReloadForUpdate()){
            schedulePendingResolution();
            return;
        }
        if(state.pendingForcedUpdate){
            state.pendingForcedUpdate=false;
            openReleaseDetail("forced");
            return;
        }
        if(state.pendingNormalReload){
            state.pendingNormalReload=false;
            performReload();
            return;
        }
        if(state.pendingAnnouncement){
            if(isCurrentNoticeSuppressedToday(state.manifest)){
                state.pendingAnnouncement=false;
                return;
            }
            if(!isSharedModalAvailableForAnnouncement()){
                schedulePendingResolution();
                return;
            }
            state.pendingAnnouncement=false;
            openReleaseDetail("acknowledge");
        }
    }

    function refreshNotificationDots(){
        try{
            if(typeof global.v141UpdateNotificationDots==="function"){
                global.v141UpdateNotificationDots();
            }
        }catch(_){ }
    }

    function refreshAnnouncementSurface(){
        const parts=getSharedModalParts();
        if(
            !parts||state.modalOpen||!parts.modal.classList.contains("show")||
            parts.title.textContent!=="公告"
        ){
            return;
        }
        const content=renderAnnouncementContent();
        if(content){ parts.body.innerHTML=content; }
    }

    function renderAnnouncementContent(){
        const manifest=state.manifest;
        if(!manifest||!manifest.publicNotice){ return ""; }
        const loaded=state.loadedReleaseVersion||getLoadedReleaseVersion();
        const comparison=loaded?compareVersions(loaded,manifest.releaseVersion):null;
        const needsUpdate=comparison!==null&&comparison<0;
        const actionLabel=needsUpdate?"查看更新內容":"查看本次更新";
        const status=needsUpdate
            ? "已有新版本可更新；完成目前操作後即可更新。"
            : "目前正式版本的更新內容。";
        return (
            '<section class="release-update-announcement">'+
                '<p class="release-update-announcement-version">'+escapeHtml(manifest.releaseVersion)+' 更新</p>'+
                '<p>'+escapeHtml(manifest.summary)+'</p>'+
                '<p class="release-update-announcement-status">'+escapeHtml(status)+'</p>'+
                '<button type="button" class="release-update-primary" onclick="window.FourSymbolsReleaseUpdate.openFromAnnouncement()">'+actionLabel+'</button>'+
            '</section>'
        );
    }

    function openFromAnnouncement(){
        const manifest=state.manifest;
        if(!manifest){ return false; }
        const loaded=state.loadedReleaseVersion||getLoadedReleaseVersion();
        const needsUpdate=loaded&&compareVersions(loaded,manifest.releaseVersion)<0;
        return openReleaseDetail(needsUpdate&&isForcedForLoadedVersion(manifest)?"forced":needsUpdate?"update":"acknowledge");
    }

    async function fetchManifest(){
        const fetcher=typeof global.fetch==="function"?global.fetch.bind(global):null;
        if(!fetcher){ return null; }
        let timeoutId=null;
        let controller=null;
        try{
            if(typeof global.AbortController==="function"){
                controller=new global.AbortController();
                timeoutId=global.setTimeout(()=>controller.abort(),REQUEST_TIMEOUT_MS);
            }
            let url=RELEASE_NOTICE_PATH;
            try{
                const base=(global.document&&global.document.baseURI)||(global.location&&global.location.href)||undefined;
                const parsed=new URL(RELEASE_NOTICE_PATH,base);
                parsed.searchParams.set("release-update-check",String(now()));
                url=parsed.toString();
            }catch(_){
                url=RELEASE_NOTICE_PATH+"?release-update-check="+now();
            }
            const response=await fetcher(url,{
                cache:"no-store",
                headers:{"Cache-Control":"no-cache"},
                ...(controller?{signal:controller.signal}:{})
            });
            if(!response||response.ok===false||typeof response.json!=="function"){ return null; }
            return validateManifest(await response.json());
        }catch(_){
            /* Offline, timeout, malformed JSON and temporary deploy gaps must never block play. */
            return null;
        }finally{
            if(timeoutId!==null){ global.clearTimeout(timeoutId); }
        }
    }

    function handleManifest(manifest){
        if(!manifest){ return; }
        state.manifest=manifest;
        state.loadedReleaseVersion=getLoadedReleaseVersion();
        state.devPreviewMode=null;
        if(!manifest.publicNotice||!state.loadedReleaseVersion){
            hideMarquee();
            return;
        }
        const devPreviewMode=getDevPreviewMode();
        if(devPreviewMode){
            state.devPreviewMode=devPreviewMode;
            if(devPreviewMode==="modal"){
                openReleaseDetail(isForcedForLoadedVersion(manifest)?"forced":"preview");
            }else{
                showMarquee(manifest,isForcedForLoadedVersion(manifest)?"forced":"update");
            }
            return;
        }
        const comparison=compareVersions(state.loadedReleaseVersion,manifest.releaseVersion);
        if(comparison===null||comparison>0){ return; }
        if(comparison===0){
            refreshAnnouncementSurface();
            refreshNotificationDots();
            if(shouldAutoShowLoginAnnouncement(manifest)){
                if(canSafelyReloadForUpdate()&&isSharedModalAvailableForAnnouncement()){
                    openReleaseDetail("acknowledge");
                }else{
                    state.pendingAnnouncement=true;
                    showMarquee(manifest,"announcement-pending");
                    schedulePendingResolution();
                }
            }
            return;
        }

        const forced=isForcedForLoadedVersion(manifest);
        if(forced){
            if(isForcedUpdateBlocking()){ return; }
            state.pendingForcedUpdate=true;
            showMarquee(manifest,canSafelyReloadForUpdate()?"forced":"forced-pending");
            if(canSafelyReloadForUpdate()){
                resolvePendingWhenSafe();
            }else{
                schedulePendingResolution();
            }
            return;
        }

        if(shouldShowReminder(manifest)){
            rememberReminder(manifest);
            showMarquee(manifest,"update");
        }
        refreshAnnouncementSurface();
        refreshNotificationDots();
    }

    function checkForUpdate(reason,options){
        const force=!!(options&&options.force);
        if(state.checking){ return state.checking; }
        if(!force&&state.lastCheckAt&&now()-state.lastCheckAt<MIN_CHECK_GAP_MS){
            return Promise.resolve(null);
        }
        state.lastCheckAt=now();
        state.checking=fetchManifest().then(manifest=>{
            if(manifest){ handleManifest(manifest,reason); }
            return manifest;
        }).finally(()=>{
            state.checking=null;
        });
        return state.checking;
    }

    function start(){
        if(state.started){ return; }
        state.started=true;
        checkForUpdate("boot",{force:true});
        state.pollTimer=global.setInterval(()=>checkForUpdate("poll"),CHECK_INTERVAL_MS);
        const documentRef=global.document;
        if(documentRef&&typeof documentRef.addEventListener==="function"){
            documentRef.addEventListener("visibilitychange",()=>{
                if(documentRef.hidden||documentRef.visibilityState==="hidden"){ return; }
                checkForUpdate("visibility");
            });
            documentRef.addEventListener("keydown",event=>{
                if(event&&event.key==="Escape"&&isForcedUpdateBlocking()){
                    event.preventDefault();
                    if(typeof event.stopImmediatePropagation==="function"){ event.stopImmediatePropagation(); }
                    announceForcedLock();
                }
            },true);
        }
        if(typeof global.addEventListener==="function"){
            global.addEventListener("online",()=>checkForUpdate("online"));
        }
    }

    function stop(){
        if(state.pollTimer!==null){ global.clearInterval(state.pollTimer); state.pollTimer=null; }
        if(state.pendingTimer!==null){ global.clearTimeout(state.pendingTimer); state.pendingTimer=null; }
        state.started=false;
    }

    function getState(){
        return {
            loadedReleaseVersion:state.loadedReleaseVersion||getLoadedReleaseVersion(),
            availableReleaseVersion:state.manifest&&state.manifest.releaseVersion||null,
            noticeId:state.manifest&&state.manifest.noticeId||null,
            pendingNormalReload:state.pendingNormalReload,
            pendingForcedUpdate:state.pendingForcedUpdate,
            pendingAnnouncement:state.pendingAnnouncement,
            loginAnnouncementShown:state.loginAnnouncementShown,
            suppressedToday:isCurrentNoticeSuppressedToday(state.manifest),
            criticalOperationCount:state.criticalOperations.size,
            unsafeReasons:getUnsafeReasons().slice(),
            pollIntervalMs:CHECK_INTERVAL_MS,
            minimumCheckGapMs:MIN_CHECK_GAP_MS,
            devPreviewMode:state.devPreviewMode
        };
    }

    global.FourSymbolsReleaseUpdate=Object.freeze({
        start,
        stop,
        checkForUpdate,
        getState,
        parseVersion,
        compareVersions,
        canSafelyReloadForUpdate,
        beginCriticalOperation,
        notifySafeState:resolvePendingWhenSafe,
        hasUnreadReleaseNotice,
        isCurrentNoticeSuppressedToday:()=>isCurrentNoticeSuppressedToday(state.manifest),
        renderAnnouncementContent,
        openFromAnnouncement,
        openReleaseDetail,
        requestReload,
        isForcedUpdateBlocking,
        shouldPreventSharedModalClose,
        announceForcedLock,
        onSharedModalClosed
    });
    global.canSafelyReloadForUpdate=canSafelyReloadForUpdate;

    const documentRef=global.document;
    if(documentRef&&typeof documentRef.addEventListener==="function"){
        documentRef.addEventListener("four-symbols:startup-ready",start,{once:true});
    }
    try{
        const startupState=global.FourSymbolsStartupPolicy&&global.FourSymbolsStartupPolicy.getState&&global.FourSymbolsStartupPolicy.getState();
        if(startupState==="READY"||startupState==="OFFLINE_READY"){
            global.setTimeout(start,0);
        }
    }catch(_){ }

})(window);
