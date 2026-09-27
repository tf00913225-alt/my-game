µ¨¥zºè¯
â¶)à²Ö§uªİ¢ëiºĞk¢G§¦*^
/* bundled source: js/00-main.js */
/* =====================================================
   â˜… 1080 Ã— 1920 æ•´é«”ç­‰æ¯”ä¾‹ç¸®æ”¾æ§åˆ¶å™¨
   - éŠæˆ²é‚è¼¯èˆå°å›ºå®š 1080 Ã— 1920
   - ä¸ä¾è³´ vw / vh æ”¹è®ŠéŠæˆ²å…§å°ºå¯¸
   - å¯¦éš›è¢å¹•åªæ±ºå®š stage scale
   - letterbox è‡ªç„¶ç•™åœ¨ stage å¤–
===================================================== */


/* =====================================================
   â˜… COMPLETE 1080Ã—1920 STAGE CONTENT WRAPPER
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
 * 1080Ã—1920 is the official coordinate standard for all NEW systems.
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
       Center the 1080Ã—1920 stage inside the actual viewport.
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

    /* Keep the existing 420Ã—746.6667 legacy design surface intact.
       It is scaled once inside the 1080Ã—1920 virtual stage. */
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


/* Convert any Pointer/Touch/Mouse event into 1080Ã—1920
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
   â˜… COMPLETE virtual-stage validation helpers
   These expose one consistent 1080Ã—1920 coordinate system
   for future Hotspots, Canvas/VFX and pointer interactions.
*/
window.GAME_VIRTUAL_WIDTH = GAME_WIDTH;
window.GAME_VIRTUAL_HEIGHT = GAME_HEIGHT;
window.gameToScreenPoint = clientPointFromGame;
window.screenToGamePoint = gamePointFromClient;
window.eventToGamePoint = getGamePointFromEvent;


/* =====================================================
   åŸºæœ¬è¨­å®š
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
   V173.41 â€” MOBILE SESSION RESUME / BACKGROUND SAVE
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
   â˜… å…­é …èƒ½åŠ›å€¼
=====================================================

   attack      = æ”»æ“Š
   vitality    = é«”è³ª
   energy      = èƒ½é‡
   intelligence= æ™ºåŠ›
   spirit      = ç²¾ç¥
   agility     = æ•æ·

===================================================== */

const STAT_NAMES = {

    attack:"æ”»æ“Š",
    vitality:"é«”è³ª",
    energy:"èƒ½é‡",
    intelligence:"æ™ºåŠ›",
    spirit:"ç²¾ç¥",
    agility:"æ•æ·"

};


/* =====================================================
   å…ƒç´ 
===================================================== */

const elementDatabase = {

    fire:{
        name:"ç«",
        icon:"",
        character:"ç«æ³•å¸«"
    },

    wind:{
        name:"é¢¨",
        icon:"",
        character:"é¢¨å¼“æ‰‹"
    },

    earth:{
        name:"åœŸ",
        icon:"",
        character:"åœŸé¨å£«"
    },

    water:{
        name:"æ°´",
        icon:"",
        character:"æ°´æˆ°å£«"
    }

};


/*
   â˜… æ–°å¢ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œemojiæ›æˆCSS
   å‹•ç•«åœ–ç¤ºï¼‰ï¼š
   çµ„å‡º<span class="elem-icon elem-icon-ç«/æ°´/é¢¨/åœŸ">
   é€™ç¨®HTMLç‰‡æ®µçš„å°å·¥å…·ï¼Œå–ä»£åŸæœ¬ç›´æ¥æŠŠ
   element.iconï¼ˆemojiå­—å…ƒï¼‰å¡é€²å­—ä¸²è£¡
   çš„å¯«æ³•ã€‚

   ä»»ä½•åœ°æ–¹åŸæœ¬å¯«ã€Œelement.icon+" "+xxxã€
   é€™ç¨®å­—ä¸²çµ„åˆã€è€Œä¸”æ˜¯ç”¨innerHTMLï¼
   .innerHTML=é¡¯ç¤ºå‡ºä¾†ï¼ˆä¸æ˜¯textContentï¼‰ï¼Œ
   éƒ½å¯ä»¥æ”¹æˆå‘¼å«é€™è£¡ï¼Œç›´æ¥æ‹¿åˆ°å«CSSåœ–ç¤º
   çš„HTMLå­—ä¸²ã€‚
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
   V130ï¼šä¸‰å€‹è§’è‰²å…±ç”¨åŒä¸€å¥—å‰µè§’ç•«é¢ã€‚
   1=ç¬¬ä¸€è§’è‰²ã€2=ç¬¬äºŒè§’è‰²ã€3=ç¬¬ä¸‰è§’è‰²ã€‚
   ç¬¬äºŒï¼ä¸‰è§’è‰²ä¸å†ç¶­è­·å¦ä¸€ä»½ç¸®å°ç‰ˆ modalã€‚
*/
let creationTargetSlot=1;


/* =====================================================
   å‰µè§’èƒ½åŠ›
   â˜… å…¨éƒ¨å¾0é–‹å§‹
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
   â˜… ç¬¬äºŒè§’è‰²ï¼ˆLv.10è§£é–ï¼‰

   è·Ÿç¬¬ä¸€åè§’è‰²ï¼ˆplayerï¼‰çµæ§‹å®Œå…¨å°ç¨±ï¼Œ
   ç¨ç«‹çš„ç­‰ç´š/ç¶“é©—/å±¬æ€§/HP/SPï¼Œ
   å½¼æ­¤ä¸å…±ç”¨ï¼Œåªå…±ç”¨ç¶“é©—æ± ï¼ˆåˆ†é…æ™‚è‡ªå·±é¸è¦çµ¦èª°ï¼‰ã€‚

   player2åœ¨é‚„æ²’å‰µå»ºä¹‹å‰æ˜¯nullï¼Œ
   å­˜æª”/è®€æª”ã€UIæ¸²æŸ“éƒ½è¦å…ˆåˆ¤æ–·é€™å€‹æ˜¯ä¸æ˜¯nullã€‚
===================================================== */

let player2 = null;

/* ç¬¬ä¸‰è§’è‰²è³‡æ–™æ§½ï¼šç›®å‰å…ˆä¿ç•™ç‚º nullï¼Œä¸è‡ªè¡Œç™¼æ˜è§£é–/å‰µè§’æ¢ä»¶ã€‚èƒŒåŒ… UI å·²å®Œæ•´æ”¯æ´ç¬¬ä¸‰è§’è‰²è³‡æ–™ã€‚ */
let player3 = null;


/*
   â˜… æ–°å¢ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œè§’è‰²é™£åˆ—é‡æ§‹
   ç¬¬ä¸€éšæ®µï¼‰ï¼š
   ä½¿ç”¨è€…æ˜ç¢ºè¡¨ç¤ºä¹‹å¾Œæœƒé–‹ç™¼ç¬¬ä¸‰åè§’è‰²ï¼Œ
   ç¾åœ¨çš„player/player2å…©å€‹å„è‡ªç¨ç«‹è®Šæ•¸ã€
   æ¯å€‹è§’è‰²ä¸€å¥—å‡½å¼ï¼ˆcastDamageSkill/
   castPlayer2Skillã€getMainCharacterStats/
   getPlayer2BattleStatsâ€¦â€¦ï¼‰çš„å¯«æ³•ï¼Œ
   ä¹‹å¾Œæ¯åŠ ä¸€å€‹è§’è‰²éƒ½è¦å†è¤‡è£½ä¸€ä»½ï¼Œ
   é•·æœŸæ˜¯æŠ€è¡“å‚µã€‚

   å®Œæ•´é‡æ§‹æˆcharacters[]é™£åˆ—é¢¨éšªå¾ˆé«˜
   ï¼ˆç¾æœ‰30å¹¾å€‹å‡½å¼éƒ½è¦è·Ÿè‘—å¤§æ”¹ï¼‰ï¼Œé€™æ¬¡
   å…ˆåšä½é¢¨éšªçš„ç¬¬ä¸€éšæ®µï¼šæ–°å¢é€™å€‹
   getCharacters()è¼”åŠ©å‡½å¼ï¼Œä¹‹å¾Œæ–°å¯«çš„
   é€šç”¨é‚è¼¯ï¼ˆä¾‹å¦‚é€™æ¬¡çš„buff/debuffç³»çµ±ï¼‰
   ä¸€å¾‹å‘¼å«é€™è£¡å–å¾—ã€Œç›®å‰å­˜åœ¨çš„å…¨éƒ¨è§’è‰²ã€ï¼Œ
   ä¸è¦å†å„è‡ªç¡¬å¯«[player,player2]ã€‚

   æ•…æ„å¯«æˆã€Œæ¯æ¬¡å‘¼å«éƒ½é‡æ–°è®€å–ã€çš„å‡½å¼ï¼Œ
   ä¸æ˜¯å®£å‘Šä¸€æ¬¡çš„éœæ…‹é™£åˆ—â€”â€”å¦‚æœå®£å‘Šæˆ
   éœæ…‹é™£åˆ—ï¼Œplayer2å¾nullè¢«è³¦å€¼æˆçœŸæ­£çš„
   è§’è‰²ç‰©ä»¶é‚£ä¸€åˆ»ï¼Œé™£åˆ—è£¡å­˜çš„é‚„æ˜¯èˆŠçš„null
   åƒç…§ï¼Œä¸æœƒè‡ªå‹•æ›´æ–°ã€‚ç”¨å‡½å¼ç¾å ´çµ„é™£åˆ—
   å°±æ²’æœ‰é€™å€‹å•é¡Œï¼Œplayer2æ™šä¸€é»æ‰å‰µå»º
   ä¹Ÿä¸€æ¨£æŠ“å¾—åˆ°æœ€æ–°ç‹€æ…‹ã€‚

   ä¹‹å¾ŒçœŸçš„è¦åŠ ç¬¬ä¸‰è§’è‰²æ™‚ï¼Œåªè¦åœ¨é€™å€‹é™£åˆ—
   åŠ ä¸€è¡Œã€æŠŠè§’è‰²å‰µå»º/å­˜è®€æª”é‚è¼¯æ¯”ç…§
   player2çš„æ¨¡å¼åšä¸€ä»½ï¼Œã€Œæ–°åŠŸèƒ½ã€çš„éƒ¨åˆ†
   ï¼ˆåªè¦æœ‰ç”¨é€™å€‹å‡½å¼çš„ï¼‰å¹¾ä¹ä¸ç”¨å†æ”¹ã€‚
   ã€ŒèˆŠåŠŸèƒ½ã€ï¼ˆcastDamageSkillé€™é¡é‚„æ²’
   é€šç”¨åŒ–çš„æ ¸å¿ƒå‡½å¼ï¼‰åˆ°æ™‚å€™æ‰éœ€è¦é€æ­¥é·ç§»ï¼Œ
   ä¸æ˜¯é€™æ¬¡çš„ç¯„åœã€‚
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
   ç©å®¶
===================================================== */

const INITIAL_CHARACTER_SKILL_POINTS=2;

const player = {

    id:"",

    element:"fire",

    level:1,

    exp:0,

    expNext:100,

    /*
       å…­é …æ ¸å¿ƒèƒ½åŠ›
    */

    attack:0,

    vitality:0,

    energy:0,

    intelligence:0,

    spirit:0,

    agility:0,

    /*
       æ¯æ¬¡å‡ç´šå›ºå®šç²å¾—çš„é¡å¤–HP/SP
       ï¼ˆä¸ç®—åœ¨é«”è³ª/èƒ½é‡å…¬å¼å…§ï¼Œ
       å–®ç¨ç´¯åŠ ï¼Œç¬¦åˆè¦æ ¼ã€Œå‡ç´š +30HP +10SPã€ï¼‰
    */

    bonusHP:0,

    bonusSP:0,

    /*
       ç‹€æ…‹
    */

    hp:100,

    sp:50,

    attributePoints:0,

    skillPoints:0,

    /*
       â˜… æ–°å¢ï¼šæŠ€èƒ½buffè¿½è¹¤ï¼ˆä¾‹å¦‚æ€’ç«ï¼‰ã€‚
       é™£åˆ—å­˜æ”¾ç›®å‰ç”Ÿæ•ˆä¸­çš„buffï¼Œ
       æ¯å€‹å›åˆæœƒéæ¸›turnsLeftï¼Œæ­¸é›¶å°±ç§»é™¤ã€‚
    */

    activeBuffs:[],

    /*
       â˜… æ–°å¢ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œã€Œé‡æ€ªç•°å¸¸
       ç‹€æ…‹ç›´æ¥åšã€â€”â€”æ€ªç‰©çµ‚æ–¼å¯ä»¥å°ç©å®¶
       é™„åŠ è² é¢æ•ˆæœäº†ï¼‰ï¼šè·Ÿæ€ªç‰©èº«ä¸Šçš„
       monster.statusEffectsæ˜¯åŒä¸€å¥—è³‡æ–™
       çµæ§‹ã€åŒä¸€å¥—å…±ç”¨å‡½å¼
       ï¼ˆapplyMonsterDebuff()/
       getMonsterDebuffValue()/
       isMonsterFrozen()/isMonsterPetrified()
       é›–ç„¶åå­—è£¡æœ‰ã€ŒMonsterã€ï¼Œä½†é€™äº›å‡½å¼
       æœ¬ä¾†å°±åªæ“ä½œå‚³é€²å»çš„ç‰©ä»¶æœ¬èº«ï¼Œæ²’æœ‰
       ä»»ä½•å¯«æ­»monsterå°ˆå±¬çš„æ¬„ä½ï¼Œç©å®¶è§’è‰²
       ç‰©ä»¶ä¸€æ¨£èƒ½ç›´æ¥æ²¿ç”¨ï¼Œä¸ç”¨é‡å¯«ä¸€å¥—ï¼‰ã€‚
    */

    statusEffects:[],

    /*
       â˜… æ–°å¢ï¼šé˜²ç¦¦ç‹€æ…‹ã€‚
       é¸æ“‡é˜²ç¦¦ä¹‹å¾Œè¨­ç‚ºtrueï¼Œ
       ä¸‹æ¬¡è¼ªåˆ°è‡ªå·±è¡Œå‹•æ™‚ï¼ˆbeginCharacterTurn()ï¼‰
       æœƒé‡ç½®å›falseã€‚
    */

    isDefending:false

};


/*
   â˜… å…±ç”¨ç¶“é©—æ± 
   æˆ°é¬¥ç²å¾—çš„EXPå…ˆé€²é€™è£¡ï¼Œ
   ç©å®¶è‡ªè¡ŒæŒ‰æŒ‰éˆ•åˆ†é…çµ¦è§’è‰²å‡ç´šã€‚
*/

let sharedExp = 0;

/*
   â˜… æ–°å¢ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œä¸»åŸæ–°å¢å•†åº—
   ç³»çµ±ï¼‰ï¼šé‡‘å¹£æ˜¯è·Ÿç¶“é©—æ± ä¸€æ¨£çš„ã€Œå…±ç”¨è³‡æºã€ï¼Œ
   ä¸åˆ†è§’è‰²ï¼Œè³£è£å‚™/å®Œæˆä»»å‹™/æˆå°±ç²å¾—çš„
   é‡‘å¹£å…¨éƒ¨é€²åŒä¸€å€‹æ± å­ï¼Œå•†åº—æ¶ˆè²»ä¹Ÿæ˜¯å¾
   é€™è£¡æ‰£ï¼Œè·ŸsharedExpç”¨åŒä¸€ç¨®è¨­è¨ˆé‚è¼¯ã€‚
*/

let gold = 300;

/* =====================================================
   V93 â€” é–‹ç™¼æ¸¬è©¦è³‡æº
   æ¸¬è©¦æŒ‰éˆ•æ”¹æˆã€Œæ¯æŒ‰ä¸€æ¬¡å°±ç›´æ¥è¿½åŠ ã€ï¼š
   é‡‘å¹£ +1,000,000ï¼›å…±ç”¨ç¶“é©—æ±  +1,000,000,000ã€‚
   ä¸å†å­˜åœ¨æœ€ä½å€¼ã€æ°¸ä¹…é–å®šæˆ–è‡ªå‹•è£œå›æ©Ÿåˆ¶ã€‚
===================================================== */
const TEST_GOLD_GRANT=1000000;
const TEST_EXP_POOL_GRANT=1000000000;

/*
   â˜… æ–°å¢ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œä¸»åŸæ–°å¢å…­å€‹
   åŠŸèƒ½ï¼šå•†åº—/è§’è‰²å±•ç¤º/æ¯æ—¥ä»»å‹™/åœ–é‘‘/æˆå°±/
   å…¬å‘Šï¼‰ï¼š
   é€™è£¡çµ±ä¸€å®£å‘Šé€™å¹¾å€‹åŠŸèƒ½éœ€è¦çš„æŒä¹…åŒ–è³‡æ–™
   è·Ÿéœæ…‹è¨­å®šè³‡æ–™ã€‚

   dailyQuestStateï¼šæ¯æ—¥ä»»å‹™é€²åº¦ï¼Œ
   dateè¨˜éŒ„ã€Œä¸Šæ¬¡é‡ç½®æ˜¯å“ªä¸€å¤©ã€ï¼Œæ¯æ¬¡ç©å®¶
   æ‰“é–‹ä»»å‹™æ¸…å–®æ™‚æœƒæª¢æŸ¥ä»Šå¤©çš„æ—¥æœŸè·Ÿé€™å€‹
   dateæ˜¯å¦ç›¸åŒï¼Œä¸åŒçš„è©±ä»£è¡¨è·¨å¤©äº†ï¼Œ
   é€²åº¦/é ˜å–ç‹€æ…‹å…¨éƒ¨é‡ç½®ã€‚

   bestiaryDataï¼šåœ–é‘‘ï¼Œkeyæ˜¯æ€ªç‰©åç¨±ï¼Œ
   ç´€éŒ„æœ‰æ²’æœ‰è¦‹éã€ç´¯è¨ˆæ“Šæ®ºæ•¸ã€‚

   achievementStateï¼šæˆå°±ï¼Œkeyæ˜¯æˆå°±idï¼Œ
   ç´€éŒ„æœ‰æ²’æœ‰å·²ç¶“é ˜å–éçå‹µ
   ï¼ˆæˆå°±æœ¬èº«é”æˆèˆ‡å¦æ˜¯å³æ™‚ç”¨
   checkAchievementCondition()åˆ¤æ–·ï¼Œ
   ä¸éœ€è¦å¦å¤–å­˜ã€Œæœ‰æ²’æœ‰é”æˆã€ï¼Œåªéœ€è¦å­˜
   ã€Œæœ‰æ²’æœ‰é ˜éã€ï¼Œä¸ç„¶é‡è¤‡åˆ¤æ–·é‚è¼¯æœƒ
   åˆ†æ•£åœ¨å­˜æª”/è®€æª”/ç•«é¢ä¸‰å€‹åœ°æ–¹ï¼‰ã€‚
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
        name:"ä»Šæ—¥ç°½åˆ°",
        desc:"æ‰“é–‹æ¯æ—¥ä»»å‹™æ¸…å–®å³å®Œæˆ",
        goal:1,
        reward:{gold:50}
    },

    {
        id:"killMonsters",
        name:"æ“Šæ•—5éš»æ€ªç‰©",
        desc:"ä»Šå¤©ç´¯è¨ˆæ“Šæ•—5éš»æ€ªç‰©",
        goal:5,
        reward:{gold:100,exp:50}
    },

    {
        id:"winBattle",
        name:"æ‰“è´1å ´æˆ°é¬¥",
        desc:"ä»Šå¤©æ‰“è´ä¸€å ´å®Œæ•´æˆ°é¬¥",
        goal:1,
        reward:{gold:80}
    }

];


/*
   â˜… æ–°å¢ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œä»»å‹™æ”¹æˆå…©å€‹
   åˆ†é ï¼šæ¯æ—¥ä»»å‹™ï¼å§”è¨—ä»»å‹™ï¼‰ï¼š
   å§”è¨—ä»»å‹™è·Ÿæ¯æ—¥ä»»å‹™å…±ç”¨åŒä¸€å¥—ã€Œæ¯å¤©
   é‡ç½®ã€çš„é€±æœŸï¼ˆensureDailyQuestsCurrent()
   æœƒä¸€èµ·è™•ç†å…©é‚Šï¼‰ï¼Œå·®åˆ¥åªåœ¨ç›®æ¨™æ•¸å­—
   è¨‚å¾—æ›´é«˜ã€çå‹µæ›´å¥½ï¼Œé¼“å‹µç©å®¶çœŸçš„èŠ±
   å¿ƒåŠ›å»é”æˆï¼Œä¸æ˜¯æ¯æ—¥ä»»å‹™é‚£ç¨®è¼•é¬†
   éš¨æ‰‹å®Œæˆçš„ç­‰ç´šã€‚

   é€²åº¦ä¾†æºåˆ»æ„æ²¿ç”¨è·Ÿæ¯æ—¥ä»»å‹™ä¸€æ¨£çš„
   killMonsters/winBattleäº‹ä»¶ï¼ˆè¦‹
   recordMonsterKillForBestiary()ï¼
   winBattle()è£¡ï¼Œå…©é‚Šçš„é€²åº¦æœƒåŒæ™‚è¢«
   ç´¯åŠ ï¼‰ï¼Œä¸ç”¨å¦å¤–è¨­è¨ˆã€å¦å¤–åŸ‹æ–°çš„
   è¿½è¹¤é‰¤å­ã€‚
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
        name:"å§”è¨—ï¼šæ“Šæ•—15éš»æ€ªç‰©",
        desc:"ä»Šå¤©ç´¯è¨ˆæ“Šæ•—15éš»æ€ªç‰©",
        goal:15,
        reward:{gold:250}
    },

    {
        id:"winBattle",
        name:"å§”è¨—ï¼šæ‰“è´3å ´æˆ°é¬¥",
        desc:"ä»Šå¤©æ‰“è´ä¸‰å ´å®Œæ•´æˆ°é¬¥",
        goal:3,
        reward:{gold:200,exp:150}
    }

];


let bestiaryData={};


let achievementState={};


/*
   â˜… æ–°å¢ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œé›¢ç·šç¶“é©—ç³»çµ±ï¼‰ï¼š
   é›¢ç·šç¶“é©—çš„æ ¸å¿ƒåƒæ•¸è·Ÿç‹€æ…‹ï¼ŒloadGame()
   è®€æª”æ™‚æœƒä¾ç…§ä¸Šæ¬¡å­˜æª”æ™‚é–“ç®—å‡º
   pendingOfflineExpï¼Œç©å®¶åœ¨ä¸»åŸã€Œé›¢ç·š
   ç¶“é©—ã€é‚£å¼µå¡ç‰‡æŒ‰ä¸‹é ˜å–æ‰æœƒçœŸçš„åŠ é€²
   ç¶“é©—æ± ã€‚
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
   â˜… æ–°å¢ï¼ˆä¾ç…§ä½¿ç”¨è€…å›å ±ï¼Œã€Œåˆ‡åˆ°èƒŒæ™¯
   å†åˆ‡å›ä¾†ï¼Œåˆ°åº•æœ‰æ²’æœ‰ç®—é›¢ç·šç¶“é©—ã€ï¼‰ï¼š
   åŸæœ¬é›¢ç·šç¶“é©—çš„è¨ˆç®—é‚è¼¯æ•´æ®µå¯«æ­»åœ¨
   loadGame()è£¡ï¼Œåªæœ‰ç¶²é ã€Œç¬¬ä¸€æ¬¡è¼‰å…¥ã€
   æ‰æœƒåŸ·è¡Œåˆ°â€”â€”å–®ç´”åˆ‡åˆ°èƒŒæ™¯ã€å†åˆ‡å›
   å‰æ™¯ï¼ˆæ²’æœ‰çœŸçš„é—œé–‰åˆ†é é‡æ–°æ•´ç†ï¼‰ï¼Œ
   å®Œå…¨ä¸æœƒè§¸ç™¼è¨ˆç®—ï¼Œé€™æ˜¯ä½¿ç”¨è€…ç™¼ç¾çš„
   çœŸå¯¦æ¼æ´ï¼Œä¸æ˜¯èª¤æœƒã€‚

   æŠŠè¨ˆç®—é‚è¼¯æŠ½æˆé€™å€‹å…±ç”¨å‡½å¼ï¼Œ
   loadGame()ï¼ˆç¶²é ç¬¬ä¸€æ¬¡è¼‰å…¥ï¼‰è·Ÿ
   visibilitychangeåˆ‡å›å‰æ™¯é€™å…©å€‹æ™‚æ©Ÿ
   éƒ½æœƒå‘¼å«é€™è£¡ï¼Œå…©ç¨®æƒ…æ³éƒ½èƒ½æ­£ç¢ºç´¯ç©
   é›¢ç·šç¶“é©—ï¼Œä¸ç”¨æ•´å€‹é‡æ–°æ•´ç†é é¢æ‰ç®—ã€‚

   å¤šæ¬¡è§¸ç™¼ä¹Ÿä¸æœƒé‡è¤‡å¤šç®—ï¼šæ¯æ¬¡éƒ½æ˜¯
   æ‹¿ã€Œç¾åœ¨æ™‚é–“ã€æ¸›ã€Œä¸Šä¸€æ¬¡è¨˜éŒ„çš„æ™‚é–“é»ã€ï¼Œ
   ç®—å®Œç«‹åˆ»æŠŠæ™‚é–“é»æ›´æ–°æˆç¾åœ¨ï¼Œä¸‹ä¸€æ¬¡
   è§¸ç™¼åªæœƒç®—ã€Œé€™ä¸€æ®µæ–°çš„é›¢ç·šæ™‚é–“ã€ï¼Œ
   ä¸æœƒæŠŠä¹‹å‰å·²ç¶“ç®—éçš„å€é–“å†ç®—ä¸€æ¬¡ã€‚
*/

let lastOfflineCheckTimestamp=
    Date.now();


/* =====================================================
   â˜… æ–°å¢ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œã€Œå¾ˆå¤šåœ°æ–¹éƒ½è¦
   åŠ çœ‹å»£å‘Šã€ï¼Œå…ˆåšå¥½é€šç”¨æ¶æ§‹ï¼‰ï¼š

   showRewardedAd(onSuccess, onFail)â€”â€”
   å…¨éŠæˆ²ã€Œçœ‹å»£å‘Šæ›çå‹µã€å”¯ä¸€çš„å…¥å£ï¼Œ
   ä¸ç®¡æ˜¯é›¢ç·šç¶“é©—é›™å€ã€ä¹‹å¾Œä»»å‹™åŠ æˆã€
   å•†åº—é¡å¤–é“å…·â€¦â€¦ä»»ä½•æƒ³åŠ ã€Œçœ‹å»£å‘Šã€çš„
   åœ°æ–¹ï¼Œéƒ½å‘¼å«é€™ä¸€å€‹å‡½å¼ï¼Œå·®åˆ¥åªåœ¨
   çµ¦çš„onSuccessï¼ˆå»£å‘Šçœ‹å®Œå¾Œè¦åšä»€éº¼ï¼‰
   ä¸ä¸€æ¨£ã€‚

   â˜… é‡è¦ï¼šç›®å‰AD_SYSTEM_READYæ˜¯falseï¼Œ
   ä»£è¡¨é‚„æ²’ç”³è«‹åˆ°çœŸçš„AdSense/AdMobå¸³è™Ÿï¼Œ
   é€™è£¡å…ˆç”¨ã€Œæ¨¡æ“¬æ’­æ”¾ã€é ‚è‘—ï¼ˆé¡¯ç¤ºæç¤ºã€
   ç­‰1.5ç§’ã€ç›´æ¥ç•¶ä½œçœ‹å®Œï¼‰ï¼Œè®“ä½ å¯ä»¥å…ˆ
   æ¸¬è©¦ã€Œé›™å€çå‹µã€é€™é¡é‚è¼¯å°ä¸å°ï¼Œä¸ç”¨
   ç­‰å»£å‘Šå¸³è™Ÿç”³è«‹ä¸‹ä¾†æ‰èƒ½æ¸¬ã€‚

   â˜… ä¹‹å¾Œç”³è«‹åˆ°çœŸçš„å»£å‘Šå¸³è™Ÿï¼ŒæŠŠ
   AD_SYSTEM_READYæ”¹æˆtrueï¼Œä¸¦ä¸”æŠŠ
   ä¸‹é¢æ¨™ç¤ºã€ŒçœŸæ­£ä¸²æ¥å»£å‘ŠAPIçš„åœ°æ–¹ã€
   é‚£ä¸€æ®µï¼Œæ›æˆçœŸæ­£å‘¼å«Google Ad
   Placement APIçš„adBreak()ï¼ˆæˆ–ä½ æœ€å¾Œ
   é¸ç”¨çš„å»£å‘Šæœå‹™å•†çš„APIï¼‰â€”â€”åªè¦æ”¹é€™è£¡
   ä¸€å€‹å‡½å¼ï¼Œå…¨éŠæˆ²æ‰€æœ‰ç”¨åˆ°
   showRewardedAd()çš„åœ°æ–¹æœƒä¸€èµ·è‡ªå‹•
   è®ŠæˆçœŸå»£å‘Šï¼Œä¸ç”¨ä¸€å€‹å€‹åŠŸèƒ½åˆ†åˆ¥å»æ”¹ã€‚
*/

const AD_SYSTEM_READY=
    false;


function showRewardedAd(
    onSuccess,
    onFail
){

    if(!AD_SYSTEM_READY){

        /*
           â˜… æ¨¡æ“¬å»£å‘Šæ’­æ”¾ï¼ˆç›®å‰ç‹€æ…‹ï¼‰ï¼š
           é¡¯ç¤ºæç¤ºã€ç­‰1.5ç§’ã€ç›´æ¥è¦–ç‚º
           çœ‹å®ŒæˆåŠŸã€‚ç´”ç²¹æ˜¯ç‚ºäº†è®“ã€Œé›™å€
           çå‹µã€é€™é¡é‚è¼¯ç¾åœ¨å°±èƒ½æ¸¬è©¦ï¼Œ           ä¸æ˜¯çœŸçš„å»£å‘Šã€‚
        */

        addBattleLog(
            "ï¼ˆæ¨¡æ“¬ï¼‰å»£å‘Šæ’­æ”¾ä¸­â€¦"
        );


        setTimeout(()=>{

            addBattleLog(
                "ï¼ˆæ¨¡æ“¬ï¼‰å»£å‘Šæ’­æ”¾å®Œæˆï¼"
            );


            if(onSuccess){

                onSuccess();

            }

        },1500);


        return;

    }


    /*
       â˜… çœŸæ­£ä¸²æ¥å»£å‘ŠAPIçš„åœ°æ–¹ï¼ˆç­‰ç”³è«‹åˆ°
       AdSense/AdMobå¸³è™Ÿå¾Œï¼ŒæŠŠä¸‹é¢é€™æ®µ
       æ›æˆçœŸæ­£çš„å‘¼å«ï¼‰ï¼š

       ç¯„ä¾‹ï¼ˆGoogle Ad Placement APIï¼Œ
       ç´”ç¶²é ç‰ˆï¼‰ï¼š

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
       åˆ‡èƒŒæ™¯æ™‚é–“å¤ªçŸ­ï¼ˆå°‘æ–¼1åˆ†é˜ï¼‰ä¸ç‰¹åˆ¥
       è™•ç†ï¼Œé¿å…ç©å®¶åªæ˜¯åˆ‡å‡ºå»çœ‹ä¸€ä¸‹
       é€šçŸ¥é¦¬ä¸Šåˆ‡å›ä¾†ï¼Œä¹Ÿè·³å‡ºä¸€å‰‡ã€Œé›¢ç·š
       ç¶“é©—ã€çš„è¨Šæ¯ï¼Œæ„Ÿè¦ºå¾ˆé›œè¨Šã€‚
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
        name:"åˆæ¬¡äº¤æ‰‹",
        desc:"ç´¯è¨ˆæ“Šæ•—1éš»æ€ªç‰©",
        reward:{gold:20},
        check:()=>
            getTotalMonsterKills()>=1
    },

    {
        id:"kill50",
        name:"å°æœ‰æˆ°ç¸¾",
        desc:"ç´¯è¨ˆæ“Šæ•—50éš»æ€ªç‰©",
        reward:{gold:100},
        check:()=>
            getTotalMonsterKills()>=50
    },

    {
        id:"kill200",
        name:"èº«ç¶“ç™¾æˆ°",
        desc:"ç´¯è¨ˆæ“Šæ•—200éš»æ€ªç‰©",
        reward:{gold:300},
        check:()=>
            getTotalMonsterKills()>=200
    },

    {
        id:"level20",
        name:"å¶„éœ²é ­è§’",
        desc:"ä»»ä¸€è§’è‰²ç­‰ç´šé”åˆ°20",
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
        name:"ç¨ç•¶ä¸€é¢",
        desc:"ä»»ä¸€è§’è‰²ç­‰ç´šé”åˆ°50",
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
        name:"é›™äººæˆè¡Œ",
        desc:"å‰µå»ºç¬¬äºŒä½è§’è‰²",
        reward:{gold:100},
        check:()=>
            !!player2
    },

    {
        id:"gold1000",
        name:"å°å¯Œç¿",
        desc:"é‡‘å¹£é”åˆ°1000",
        reward:{gold:100},
        check:()=>
            gold>=1000
    }

];


/* =====================================================
   V91 â€” çµ±ä¸€è—¥æ°´è³‡æ–™ä¾†æº

   å•†åº—ã€èƒŒåŒ…ã€æˆ°é¬¥éƒ½åªèªé€™å…­å€‹ potionDefinitionsã€‚
   ä¸å†ä½¿ç”¨ player.hpPotions / player.spPotions
   é€™å¥—ç¨ç«‹æˆ°é¬¥åº«å­˜ã€‚
===================================================== */

const potionDefinitions=[
    {
        id:"hpPotion10",
        name:"å›å¾©10%HPè—¥æ°´",
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
        name:"å›å¾©10%SPè—¥æ°´",
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
        name:"å›å¾©50%çš„HPè—¥æ°´",
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
        name:"å›å¾©50%çš„SPè—¥æ°´",
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
        name:"å›å¾©æ‰€æœ‰HPçš„è—¥æ°´",
        shortName:"HP å…¨å›å¾©",
        icon:"",
        type:"potion",
        resource:"hp",
        recoveryPercent:100,
        price:180,
        stats:{}
    },
    {
        id:"spPotion100",
        name:"å›å¾©æ‰€æœ‰SPçš„è—¥æ°´",
        shortName:"SP å…¨å›å¾©",
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
   V92 â€” èƒŒåŒ…å †ç–Šè¦å‰‡
   - è£å‚™é¡ï¼šæ¯æ ¼æœ€å¤š 1 ä»¶ã€‚
   - å…¶é¤˜é¡å‹ï¼šæ¯æ ¼æœ€å¤š 999 ä»¶ã€‚
   - è¶…éä¸Šé™æœƒè‡ªå‹•å»ºç«‹ä¸‹ä¸€å€‹å †ç–Šï¼Œä¸è®“å–®æ ¼çªç ´ä¸Šé™ã€‚
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
                "èƒŒåŒ…å †ç–Šè¶…é120æ ¼å®¹é‡ï¼Œå‰©é¤˜ç‰©å“æœªèƒ½æ”¾å…¥ï¼š",
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
        return "æœªçŸ¥æ•ˆæœ";
    }

    const resourceLabel=definition.resource==="hp" ? "HP" : "SP";
    return definition.recoveryPercent>=100
        ? `å›å¾©æ‰€æœ‰${resourceLabel}`
        : `å›å¾©æœ€å¤§${resourceLabel}çš„ ${definition.recoveryPercent}%`;
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
   èˆŠ V90 å­˜æª”æœ‰å…©å¥—è—¥æ°´åº«å­˜ï¼š
   inventoryItems è£¡çš„ hpPotion/spPotionï¼Œ
   ä»¥åŠ player.hpPotions/player.spPotionsã€‚
   V92 ä»æœƒæŠŠå®ƒå€‘å®‰å…¨æ˜ å°„æˆ 10% è—¥æ°´ï¼Œä¸¦éµå®ˆæ¯ç–Š100ä¸Šé™ã€‚
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
                    <strong>ç›®å‰æ²’æœ‰è£œå“</strong>
                    <span>å•†åº—è³¼è²·çš„ HPï¼SP è—¥æ°´æœƒç›´æ¥é¡¯ç¤ºåœ¨é€™è£¡ã€‚</span>
                </div>
            `;
            return;
        }

        list.innerHTML=available.map(definition=>{
            const count=getPotionCount(definition.id);
            const resourceLabel=definition.resource==="hp" ? "HP" : "SP";
            const effectLabel=definition.recoveryPercent>=100
                ? `${resourceLabel} å…¨å›å¾©`
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
                    <span class="battle-item-count">Ã—${count}</span>
                </button>
            `;
        }).join("");

        return;
    }

    const talismans=getBattleTalismanInventoryItems();

    if(talismans.length===0){
        list.innerHTML=`
            <div class="battle-item-empty">
                <strong>ç›®å‰æ²’æœ‰ç¬¦å’’</strong>
                <span>ä¹‹å¾Œå–å¾—å†°å°ç¬¦ã€çµç•Œç¬¦ç­‰æˆ°é¬¥ç¬¦å’’æ™‚ï¼Œæœƒé¡¯ç¤ºåœ¨é€™å€‹é ç±¤ã€‚</span>
            </div>
        `;
        return;
    }

    /*
       ç›®å‰å°ˆæ¡ˆé‚„æ²’æœ‰æ­£å¼ç¬¦å’’ç‰©å“è¦æ ¼ï¼ˆskillIdã€æŠ€èƒ½ç­‰ç´šã€
       æ˜¯å¦æ¶ˆè€—SPã€ç›®æ¨™è¦å‰‡å°šæœªå¯«å…¥ Project Knowledgeï¼‰ï¼Œ
       æ‰€ä»¥é€™è£¡åªå¿ å¯¦åˆ—å‡ºåº«å­˜ï¼Œä¸æ“…è‡ªè®“å®ƒæ–½æ”¾æŸå€‹æŠ€èƒ½ã€‚
       ç­‰ç¬¬ä¸€å¼µæ­£å¼ç¬¦å’’è¦æ ¼ç¢ºå®šå¾Œï¼Œå†æŠŠé»æ“Šè¡Œç‚ºæ¥é€²æ—¢æœ‰
       æŠ€èƒ½å¼•æ“ï¼Œé¿å…å…ˆå¯«ä¸€å¥—éŒ¯çš„ç¬¦å’’å…¬å¼ã€‚
    */
    list.innerHTML=talismans.map(item=>{
        const linkedSkill=item.skillId && skillDatabase[item.skillId]
            ? skillDatabase[item.skillId]
            : null;
        const skillLabel=linkedSkill
            ? linkedSkill.name+(item.skillLevel ? ` Lv.${item.skillLevel}` : "")
            : "å°šæœªè¨­å®šæŠ€èƒ½";

        return `
            <button
                type="button"
                class="battle-item-card talisman"
                disabled
                title="${item.name||item.id}"
            >
                <span class="battle-item-badge">ç¬¦</span>
                <span class="battle-item-name">${item.name||item.id}</span>
                <span class="battle-item-effect">${skillLabel}</span>
                <span class="battle-item-count">Ã—${item.count}</span>
            </button>
        `;
    }).join("");
}

/* ä¿ç•™èˆŠå‡½å¼åç¨±ï¼Œé¿å…æ—¢æœ‰ usePotion() çš„åº«å­˜åˆ·æ–°è·¯å¾‘å¤±æ•ˆã€‚ */
function renderBattlePotionMenu(){
    battleItemCategory="potion";
    renderBattleItemMenu();
}


/*
   â˜… åœ–é‘‘æ“Šæ®ºç´€éŒ„â€”â€”killMonster()è£¡å”¯ä¸€çš„
   å‘¼å«é»ï¼Œè¦‹ä¸Šé¢killMonster()çš„ä¿®æ”¹ã€‚
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
       â˜… æ–°å¢ï¼šå§”è¨—ä»»å‹™çš„æ“Šæ®ºé€²åº¦ï¼Œ
       è·Ÿæ¯æ—¥ä»»å‹™åŒä¸€å€‹äº‹ä»¶ä¾†æºï¼Œä¸€èµ·
       ç´¯åŠ ï¼Œä¸ç”¨å¦å¤–åŸ‹é‰¤å­ã€‚
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
   â˜… æ¯å¤©ç¬¬ä¸€æ¬¡æ‰“é–‹æ¯æ—¥ä»»å‹™æ¸…å–®ï¼Œæˆ–æ¯å¤©
   ç¬¬ä¸€æ¬¡æ“Šæ®ºæ€ªç‰©/æ‰“è´æˆ°é¬¥æ™‚éƒ½æœƒå‘¼å«é€™è£¡ï¼Œ
   ç¢ºä¿ã€Œä»Šå¤©ã€çš„é€²åº¦ä¸æœƒæ²¿ç”¨åˆ°ã€Œæ˜¨å¤©ã€ã€‚
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
       â˜… æ–°å¢ï¼šå§”è¨—ä»»å‹™è·Ÿæ¯æ—¥ä»»å‹™å…±ç”¨
       åŒä¸€å€‹ã€Œä»Šå¤©ã€çš„æ—¥æœŸåˆ¤æ–·ï¼Œå„è‡ª
       æœ‰è‡ªå·±ç¨ç«‹çš„é€²åº¦/é ˜å–ç‹€æ…‹ï¼Œ
       äº’ä¸å½±éŸ¿ã€‚
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
   â˜… åŸºç¤èƒ½åŠ›è¨ˆç®—
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
           é€™è£¡åªçµ¦è§’è‰²å›ºå®šåŸºç¤å€¼ã€‚
           å…­é …èƒ½åŠ›ä»ç„¶å®Œå…¨ç”±ç©å®¶é…é»ã€‚

           1é«”è³ª = +50HP +4é˜²ç¦¦
           1æ”»æ“Š = +3ç‰©æ”»
           1æ™ºåŠ› = +3é­”æ”»
           æ¯ç´š = +4ç‰©æ”»ï¼+4é­”æ”»ï¼+3é˜²ç¦¦
           1èƒ½é‡ = +15SP

           bonusHP / bonusSP æ˜¯æ¯æ¬¡å‡ç´š
           é¡å¤–å›ºå®šç²å¾—çš„ +30HP +10SPï¼Œ
           è·Ÿé«”è³ª/èƒ½é‡çš„é…é»åŠ æˆåˆ†é–‹è¨ˆç®—ã€‚
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
   è£å‚™
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
   è£å‚™åŠ æˆ
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
   V119 â€” ç©å®¶æˆ°é¬¥ä¸­å…­åœæ¸›ç›Šçµ±ä¸€å…¥å£

   é¢¨ç³»ã€Œé™ä½æ•æ·ã€èˆ‡åœŸç³»ã€Œé™ä½é˜²ç¦¦ã€ï¼Œä»¥åŠæ­·å²ç›¸å®¹çš„
   statDownï¼ˆå…¨å±¬æ€§é™ä½ï¼‰ï¼Œéƒ½å…±ç”¨ statusEffects ç‹€æ…‹ç®¡ç·šã€‚
   å…ˆå‰ç©å®¶æœ€çµ‚èƒ½åŠ›æ²’æœ‰å®Œæ•´è®€å–é€™äº›æ¸›ç›Šï¼Œé€ æˆæ€ªç‰©å°ç©å®¶æ–½æ”¾æ™‚
   çœ‹å¾—åˆ°æ–‡å­—ã€å¯¦éš›æ•¸å€¼å»æ²’æœ‰ä¸‹é™ã€‚

   é€™è£¡çµ±ä¸€è¦å‰‡ï¼š
   - statDown ç‚ºæ­·å²ç›¸å®¹ç‹€æ…‹ï¼›ç¾å½¹ç©å®¶æŠ€èƒ½ç›®å‰æœªä½¿ç”¨ã€‚è‹¥èˆŠè³‡æ–™æˆ–æ€ªç‰©æŠ€èƒ½å¸¶å…¥ï¼Œ
     ä»é™ä½å°æ‡‰å…­åœé»æ•¸ï¼›è‹¥æŠ€èƒ½æœ‰ excludedStatsï¼Œè©²å…­åœä¸é™ã€‚
   - agilityDown å†é¡å¤–é™ä½æœ‰æ•ˆæ•æ·ã€‚
   - defenseDown åœ¨æ‰€æœ‰é˜²ç¦¦åŠ æˆç®—å®Œå¾Œå†é™ä½æœ€çµ‚é˜²ç¦¦ã€‚
   - æš«æ™‚æ€§çš„ vitality / energy é™ä½ã€Œä¸å‹•æ…‹ç¸®æ¸› maxHP / maxSPã€ï¼Œ
     é¿å…æ¸›ç›Šå‘½ä¸­ç¬é–“æŠŠç¾æœ‰ HP/SP å¼·åˆ¶è£æ‰ï¼›é«”è³ªä»æœƒé™ä½æˆ°é¬¥é˜²ç¦¦ã€‚
     é€™æ˜¯æ²¿ç”¨æœ¬å°ˆæ¡ˆå…ˆå‰å·²ç¢ºèªçš„æˆ°é¬¥è³‡æºç©©å®šåŸå‰‡ï¼Œä¸æ–°å¢éš±æ€§æ‰£è¡€/æ‰£SPã€‚
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
   é–ƒèº²ä¾†æºä¸€å¾‹ä»¥æœ€çµ‚ç™¾åˆ†é»ç›¸åŠ ï¼ç›¸æ¸›ã€‚
   ç©å®¶çœ‹åˆ°ã€Œé–ƒèº² +10%ã€å°±æ˜¯æœ€çµ‚é–ƒèº² +10 å€‹ç™¾åˆ†é»ï¼›
   ã€Œå‡å‚·ï¼šé–ƒèº² -25%ã€å°±æ˜¯æœ€çµ‚é–ƒèº² -25 å€‹ç™¾åˆ†é»ã€‚
   ä¸å†æŠŠå¤šå€‹é–ƒèº²ä¾†æºé€å±¤ä¹˜ç®—ã€‚
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

/* æ°£å®šç¥é–’çš„å‘½ä¸­åŠ æˆåŒæ™‚ä¾›ç©å®¶èˆ‡æ€ªç‰©å…±ç”¨ã€‚é¡åƒé¡¯ç¤ºç´€éŒ„
   å¯èƒ½åŒæ™‚å­˜åœ¨æ–¼ activeBuffs / v141TeamBuffsï¼Œå› æ­¤å–æœ€é«˜å€¼è€Œä¸ç›¸åŠ ã€‚ */
function getActiveAccuracyBonusPercent(entity){
    if(!entity){ return 0; }
    const entries=(entity.activeBuffs||[]).concat(entity.v141TeamBuffs||[]);
    return entries.reduce((highest,buff)=>{
        if(!buff||Number(buff.turnsLeft)<=0){ return highest; }
        const isAccuracyState=
            buff.type==="dinghaishenzhen"||
            buff.type==="resistance"||
            buff.v141BuffType==="resistance"||
            buff.statusName==="æ°£å®šç¥é–’";
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
        const isRage=buff.type==="rage"||buff.v141BuffType==="rage"||buff.statusName==="æ€’ç«";
        if(!isRage){ return result; }
        result.chance=Math.max(result.chance,Number(buff.critChanceBonusPercent)||0);
        result.damage=Math.max(result.damage,Number(buff.critDamageBonusPercent)||0);
        return result;
    },{chance:0,damage:0});
}

window.v173GetActiveAccuracyBonusPercent=getActiveAccuracyBonusPercent;
window.v173GetActiveRageCriticalBonuses=getActiveRageCriticalBonuses;

/* =====================================================
   ä¸»è§’æœ€çµ‚èƒ½åŠ›
===================================================== */

function getMainCharacterStats(){

    const bonus=getEquipmentBonus(player.element);

    /* è£å‚™å…­åœçµ±ä¸€å…ˆé€²å…¥æœ‰æ•ˆå±¬æ€§æŸ¥è©¢ï¼›æ”»æ“Šä¸å†æ–¼æœ€çµ‚ç‰©æ”»é‡è¤‡åŠ ä¸€æ¬¡ã€‚ */
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
        /* æš«æ™‚å…­åœæ¸›ç›Šä¸å‹•æ…‹å£“ç¸®æœ€å¤§HP/SPï¼›è©³è¦‹ä¸Šæ–¹çµ±ä¸€è¦å‰‡ã€‚ */
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
   â˜… æ–°å¢ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼‰ï¼š
   é€šç”¨ç‰ˆæœ¬ï¼Œè®€å–è§’è‰²èº«ä¸ŠæŸå€‹buffç›®å‰çš„
   ç™¾åˆ†æ¯”æ•¸å€¼ï¼ˆæ²’æœ‰é€™å€‹buffçš„è©±å›å‚³0ï¼‰ï¼Œ
   è·Ÿæ€ªç‰©é‚£é‚Šçš„getMonsterDebuffValue()æ˜¯
   å°ç¨±è¨­è¨ˆï¼Œä¸€å€‹è®€activeBuffsï¼ˆç©å®¶çš„
   å¢ç›Šï¼‰ï¼Œä¸€å€‹è®€statusEffectsï¼ˆæ€ªç‰©çš„
   æ¸›ç›Šï¼‰ã€‚
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
   â˜… æ–°å¢ï¼šç¬¬äºŒè§’è‰²çš„å®Œæ•´æˆ°é¬¥æ•¸å€¼ã€‚
   è·ŸgetMainCharacterStats()ç®—æ³•å®Œå…¨å°ç¨±ï¼Œ
   åªæ˜¯baseç›´æ¥ç”¨player2è‡ªå·±çš„å…­åœç®—ï¼Œ
   è£å‚™åŠ æˆæŠ“å›ºå®šçš„"player2"é€™å€‹key
   ï¼ˆä¸æ˜¯player2.elementï¼Œ
   å› ç‚ºè£å‚™æ¬„æ˜¯ç”¨è§’è‰²idå­˜çš„ï¼Œä¸æ˜¯å…ƒç´ ï¼‰ã€‚
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
   æ€ªç‰©
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
   æœ€æ–°å››å…ƒç´ æŠ€èƒ½è¦æ ¼å·²å¥—ç”¨ï¼›èˆŠ ID å„ªå…ˆä¿ç•™ä»¥ç¶­æŒå­˜æª”ç›¸å®¹ã€‚
   V120ï¼šé¢¨ç„°è¡“ï¼é¢¨å“®é›»æ“Šæ”¹ç‚ºã€Œé™ä½ç›®æ¨™é€ æˆçš„å‚·å®³ã€ï¼›
   è½çŸ³è¡“ï¼æ»¾çŸ³è¡“ï¼åœ°ç‰›çŒ›è¥²çš„é™é˜²æŒçºŒæ™‚é–“æ­£å¼å®šç‚º1å›åˆã€‚
*/
const skillDatabase = {

    /* =====================================================
       V120 æ­£å¼æŠ€èƒ½è¦æ ¼
       - æ•¸å€¼ã€å‰ç½®ã€SPã€ç¯„åœä¾ä½¿ç”¨è€… 2026-08-24 æœ€æ–°è¡¨
       - èˆŠæŠ€èƒ½ ID èƒ½æ²¿ç”¨å°±æ²¿ç”¨ï¼Œé¿å…ç ´å£æ—¢æœ‰å­˜æª”/é…è£
       - æ–°å¢æŠ€èƒ½æ‰å»ºç«‹æ–° ID
    ===================================================== */

    /* ===== ç«ç³»ï¼šç‰©ç† ===== */
    flameSlash:{
        id:"flameSlash", tier:1, name:"ç«ç„°æ–¬", element:"fire", category:"physical", targetType:"single",
        learnCost:2, maxLevel:5, baseDamage:17, damagePerLevel:10, spCost:8,
        description:"å°å–®é«”é€ æˆ17é»åŸºç¤å‚·å®³ï¼Œæœ€é«˜5ç´šï¼Œæ¯å‡1ç´šå‚·å®³+10ã€‚"
    },
    fireCritical:{
        id:"fireCritical", tier:2, name:"æœƒå¿ƒä¸€æ“Š", element:"fire", category:"physical", targetType:"single",
        learnCost:10, maxLevel:5, baseDamage:39, damagePerLevel:13, spCost:15,
        description:"å°å–®é«”é€ æˆ39é»åŸºç¤å‚·å®³ï¼Œæœ€é«˜5ç´šï¼Œæ¯å‡1ç´šå‚·å®³+13ã€‚", requires:["flameSlash"]
    },
    explosiveFlurry:{
        id:"explosiveFlurry", tier:3, name:"ç«çˆ†äº‚æ“Š", element:"fire", category:"physical", targetType:"tri",
        learnCost:20, maxLevel:5, baseDamage:35, damagePerLevel:15, spCost:22,
        description:"å°åŒä¸€æ©«æ’å·¦ã€ä¸­ã€å³æœ€å¤š3åç›®æ¨™å„é€ æˆ35é»åŸºç¤å‚·å®³ï¼Œæœ€é«˜5ç´šï¼Œæ¯å‡1ç´šå‚·å®³+15ã€‚", requires:["fireCritical"]
    },
    dragonSlash:{
        id:"dragonSlash", tier:4, name:"éœ¸é¾è£‚å¤©æ–¬", element:"fire", category:"physical", targetType:"single",
        learnCost:45, maxLevel:5, baseDamage:145, damagePerLevel:25, spCost:55,
        description:"å°å–®é«”é€ æˆ145é»åŸºç¤å‚·å®³ï¼Œæœ€é«˜5ç´šï¼Œæ¯å‡1ç´šå‚·å®³+25ã€‚", requires:["explosiveFlurry"]
    },

    /* ===== ç«ç³»ï¼šæ³•è¡“ ===== */
    fireRocket:{
        id:"fireRocket", tier:1, name:"ç«ç®­", element:"fire", category:"magic", targetType:"tri",
        learnCost:2, maxLevel:5, baseDamage:22, damagePerLevel:8, spCost:8,
        description:"å°åŒä¸€æ©«æ’å·¦ã€ä¸­ã€å³æœ€å¤š3åç›®æ¨™å„é€ æˆ22é»åŸºç¤æ³•è¡“å‚·å®³ï¼Œæœ€é«˜5ç´šï¼Œæ¯å‡1ç´šå‚·å®³+8ã€‚"
    },
    blazeSpell:{
        id:"blazeSpell", tier:2, name:"çƒˆç«è¡“", element:"fire", category:"magic", targetType:"single",
        learnCost:10, maxLevel:5, baseDamage:42, damagePerLevel:15, spCost:15,
        description:"å°å–®é«”é€ æˆ42é»åŸºç¤æ³•è¡“å‚·å®³ï¼Œæœ€é«˜5ç´šï¼Œæ¯å‡1ç´šå‚·å®³+15ã€‚", requires:["fireRocket"]
    },
    flameTornado:{
        id:"flameTornado", tier:3, name:"çƒˆç„°é¾æ²", element:"fire", category:"magic", targetType:"row",
        learnCost:30, maxLevel:5, baseDamage:40, damagePerLevel:13, spCost:38,
        description:"å°ä»»ä¸€æ©«æ’ç›®æ¨™å„é€ æˆ40é»åŸºç¤æ³•è¡“å‚·å®³ï¼›30%æ©Ÿç‡ç‡ƒç‡’2å›åˆï¼Œæ¯å›åˆé€ æˆç›®æ¨™æœ€å¤§HPçš„5%/7%/12%/18%/25%å‚·å®³ã€‚",
        burnChance:30, burnDuration:2, burnPercentByLevel:[5,7,12,18,25], requires:["blazeSpell"]
    },
    phoenixCry:{
        id:"phoenixCry", tier:4, name:"ç«é³³å¤©é³´", element:"fire", category:"magic", targetType:"all",
        learnCost:45, maxLevel:5, baseDamage:53, damagePerLevel:15, spCost:62,
        description:"å°æ•µæ–¹å…¨é«”å„é€ æˆ53é»åŸºç¤æ³•è¡“å‚·å®³ï¼›50%æ©Ÿç‡ç‡ƒç‡’2å›åˆï¼Œæ¯å›åˆé€ æˆç›®æ¨™æœ€å¤§HPçš„12%/18%/25%/30%/35%å‚·å®³ã€‚",
        burnChance:50, burnDuration:2, burnPercentByLevel:[12,18,25,30,35], requires:["flameTornado"]
    },

    /* ===== ç«ç³»ï¼šå¢ç›Š ===== */
    rage:{
        id:"rage", name:"æ€’ç«", element:"fire", category:"buff", targetType:"allyAll",
        learnCost:25, maxLevel:5, spCost:50, duration:2,
        description:"æé«˜æˆ‘æ–¹æœ€å¤š3åå­˜æ´»è§’è‰²çš„çˆ†æ“Šç‡èˆ‡çˆ†æ“Šå‚·å®³ï¼ŒæŒçºŒ2å›åˆï¼›æå‡å¹…åº¦ä¾ç­‰ç´šç‚º10%/20%/30%/40%/50%ã€‚",
        critBonusByLevel:[10,20,30,40,50], requires:["explosiveFlurry","flameTornado"]
    },

    /* ===== ç«ç³»ï¼šè¢«å‹• ===== */
    fireEX:{
        id:"fireEX", name:"ç«å…ƒç´ EX", element:"fire", category:"passive", targetType:"none",
        learnCost:25, maxLevel:1,
        description:"æ°¸ä¹…æå‡ç«å…ƒç´ å‚·å®³10%ã€çˆ†æ“Šç‡5%ã€çˆ†æ“Šå‚·å®³5%ã€‚",
        damageBonusPercent:10, critChanceBonusPercent:5, critDamageBonusPercent:5
    },

    /* ===== æ°´ç³»ï¼šç‰©ç† ===== */
    waterKnife:{
        id:"waterKnife", tier:1, name:"æ°´åˆ€æ–¬", element:"water", category:"physical", targetType:"single",
        learnCost:2, maxLevel:5, baseDamage:13, damagePerLevel:3, spCost:6,
        description:"å°å–®é«”é€ æˆ13é»åŸºç¤å‚·å®³ï¼›å¸å–å‚·å®³çš„1%/1%/1%/2%/3%ï¼Œç­‰é‡æ¢å¾©è‡ªèº«HPèˆ‡SPã€‚",
        lifestealPercentByLevel:[1,1,1,2,3]
    },
    frostPunch:{
        id:"frostPunch", tier:2, name:"å†°éœœæ‹³", element:"water", category:"physical", targetType:"single",
        learnCost:10, maxLevel:5, baseDamage:30, damagePerLevel:5, spCost:17,
        description:"å°å–®é«”é€ æˆ30é»åŸºç¤å‚·å®³ï¼›å¸å–å‚·å®³çš„1%/1%/1%/2%/3%ï¼Œç­‰é‡æ¢å¾©è‡ªèº«HPèˆ‡SPã€‚",
        lifestealPercentByLevel:[1,1,1,2,3], requires:["waterKnife"]
    },
    iceSpin:{
        id:"iceSpin", tier:3, name:"å†°æ—‹ä¸€é–ƒ", element:"water", category:"physical", targetType:"tri",
        learnCost:20, maxLevel:5, baseDamage:25, damagePerLevel:7, spCost:20,
        description:"å°åŒä¸€æ©«æ’å·¦ã€ä¸­ã€å³æœ€å¤š3åç›®æ¨™å„é€ æˆ25é»åŸºç¤å‚·å®³ï¼›å¸å–å‚·å®³çš„1%ï¼Œç­‰é‡æ¢å¾©è‡ªèº«HPèˆ‡SPã€‚",
        lifestealPercentByLevel:[1,1,1,1,1], requires:["frostPunch"]
    },
    frostCrush:{
        id:"frostCrush", tier:4, name:"å†°å°é‡æ“Š", element:"water", category:"physical", targetType:"single",
        learnCost:30, maxLevel:5, baseDamage:100, damagePerLevel:15, spCost:50,
        description:"å°å–®é«”é€ æˆ100é»åŸºç¤å‚·å®³ï¼›45%æ©Ÿç‡å†°å°1å›åˆï¼›å¸å–å‚·å®³çš„1%/1%/1%/2%/3%ï¼Œç­‰é‡æ¢å¾©è‡ªèº«HPèˆ‡SPã€‚",
        freezeChance:45, freezeDuration:1, lifestealPercentByLevel:[1,1,1,2,3], requires:["iceSpin"]
    },

    /* ===== æ°´ç³»ï¼šæ³•è¡“ ===== */
    waterBall:{
        id:"waterBall", tier:1, name:"æ°´çƒè¡“", element:"water", category:"magic", targetType:"tri",
        learnCost:2, maxLevel:5, baseDamage:17, damagePerLevel:3, spCost:8,
        description:"å°åŒä¸€æ©«æ’å·¦ã€ä¸­ã€å³æœ€å¤š3åç›®æ¨™å„é€ æˆ17é»åŸºç¤æ³•è¡“å‚·å®³ï¼›å¸å–å‚·å®³çš„1%/1%/1%/2%/3%ï¼Œç­‰é‡æ¢å¾©è‡ªèº«HPèˆ‡SPã€‚",
        lifestealPercentByLevel:[1,1,1,2,3]
    },
    floodBeast:{
        id:"floodBeast", tier:2, name:"æ´ªæ°´çŒ›ç¸", element:"water", category:"magic", targetType:"single",
        learnCost:15, maxLevel:5, baseDamage:35, damagePerLevel:8, spCost:15,
        description:"å°å–®é«”é€ æˆ35é»åŸºç¤æ³•è¡“å‚·å®³ï¼›å¸å–å‚·å®³çš„1%ï¼Œç­‰é‡æ¢å¾©è‡ªèº«HPèˆ‡SPã€‚",
        lifestealPercentByLevel:[1,1,1,1,1], requires:["waterBall"]
    },
    iceArrowRain:{
        id:"iceArrowRain", tier:3, name:"å†°éœœç®­é›¨", element:"water", category:"magic", targetType:"all",
        learnCost:20, maxLevel:5, baseDamage:30, damagePerLevel:12, spCost:50,
        description:"å°æ•µæ–¹å…¨é«”å„é€ æˆ30é»åŸºç¤æ³•è¡“å‚·å®³ï¼›å¸å–å‚·å®³çš„1%ï¼Œç­‰é‡æ¢å¾©è‡ªèº«HPèˆ‡SPã€‚",
        lifestealPercentByLevel:[1,1,1,1,1], requires:["floodBeast"]
    },
    freeze:{
        id:"freeze", tier:4, name:"å†°å°", element:"water", category:"magic", targetType:"single",
        learnCost:25, maxLevel:1, spCost:22,
        description:"65%æ©Ÿç‡å†°å°å–®ä¸€ç›®æ¨™ï¼Œä½¿å…¶ç„¡æ³•è¡Œå‹•4å›åˆï¼›ç´”æ§å ´æŠ€èƒ½ï¼Œä¸é€ æˆå‚·å®³ã€‚",
        freezeChance:65, freezeDuration:4, requires:["iceArrowRain"]
    },

    /* ===== æ°´ç³»ï¼šå¢ç›Š/å›å¾© ===== */
    healSpell:{
        id:"healSpell", name:"æ²»ç™‚è¡“", element:"water", category:"heal", targetType:"ally",
        learnCost:20, maxLevel:5, baseHeal:40, healPerLevel:5, baseHealSP:15, healSPPerLevel:5, spCost:30,
        description:"æ“‡ä¸€å‹æ–¹ç›®æ¨™ï¼Œæ¢å¾©HPèˆ‡SPã€‚HPåŸºç¤40ã€SPåŸºç¤15ï¼Œå…©è€…æ¯å‡1ç´šåŸºç¤æ¢å¾©é‡+5ï¼›å¦åŠ HPæ™ºåŠ›Ã—1.25ã€SPæ™ºåŠ›Ã—0.5ï¼›æ–½æ”¾è€…æœ¬äººä¸å›å¾©SPã€‚",
        requires:["iceArrowRain","iceSpin"]
    },
    revive:{
        id:"revive", name:"å¾©æ´»è¡“", element:"water", category:"revive", targetType:"deadAlly",
        learnCost:20, maxLevel:5, spCost:45,
        description:"æ“‡ä¸€å‹æ–¹æ­»äº¡ç›®æ¨™åŸåœ°å¾©æ´»ï¼Œä¾ç­‰ç´šæ¢å¾©20%/40%/60%/80%/100%æœ€å¤§HPã€‚",
        reviveHealPercentByLevel:[20,40,60,80,100], requires:["healSpell"]
    },

    /* ===== æ°´ç³»ï¼šè¢«å‹• ===== */
    waterEX:{
        id:"waterEX", name:"æ°´å…ƒç´ EX", element:"water", category:"passive", targetType:"none",
        learnCost:25, maxLevel:1,
        description:"æ°¸ä¹…æå‡æ°´å…ƒç´ å‚·å®³5%ã€å›å¾©ç³»æŠ€èƒ½å›å¾©é‡5%ã€ç•°å¸¸ç‹€æ…‹æŠ—æ€§+10%ã€‚",
        damageBonusPercent:5, healBonusPercent:5, statusResistBonus:10
    },

    /* ===== é¢¨ç³»ï¼šç‰©ç† ===== */
    stormFist:{
        id:"stormFist", tier:1, name:"æš´é¢¨æ‹³", element:"wind", category:"physical", targetType:"single",
        learnCost:2, maxLevel:5, baseDamage:14, damagePerLevel:2, spCost:7,
        description:"å°å–®é«”é€ æˆ14é»åŸºç¤å‚·å®³ï¼›50%æ©Ÿç‡é™ä½æ•æ·1å›åˆï¼Œé™ä½50%/60%/70%/80%/90%ã€‚",
        agilityDownChance:50, agilityDownByLevel:[50,60,70,80,90], agilityDownDuration:1
    },
    stormFlurry:{
        id:"stormFlurry", tier:2, name:"æš´é¢¨äº‚æ“Š", element:"wind", category:"physical", targetType:"tri",
        learnCost:10, maxLevel:5, baseDamage:28, damagePerLevel:7, spCost:20,
        description:"å°åŒä¸€æ©«æ’å·¦ã€ä¸­ã€å³æœ€å¤š3åç›®æ¨™å„é€ æˆ28é»åŸºç¤å‚·å®³ï¼›50%æ©Ÿç‡é™ä½ç›®æ¨™é€ æˆçš„å‚·å®³1å›åˆï¼Œé™ä½15%/18%/21%/25%/30%ã€‚",
        damageDownChance:50, damageDownByLevel:[15,18,21,25,30], damageDownDuration:1, requires:["stormFist"]
    },
    windCrossSlash:{
        id:"windCrossSlash", tier:3, name:"é¢¨æ—‹åå­—æ–¬", element:"wind", category:"physical", targetType:"single",
        learnCost:15, maxLevel:5, baseDamage:90, damagePerLevel:12, spCost:39,
        description:"å°å–®é«”é€ æˆ90é»åŸºç¤å‚·å®³ï¼›65%æ©Ÿç‡é™ä½ç›®æ¨™é€ æˆçš„å‚·å®³1å›åˆï¼Œé™ä½15%/20%/25%/30%/35%ã€‚",
        damageDownChance:65, damageDownByLevel:[15,20,25,30,35], damageDownDuration:1, requires:["stormFlurry"]
    },
    dizzyFist:{
        id:"dizzyFist", tier:4, name:"æšˆçœ©çŒ›æ“Š", element:"wind", category:"physical", targetType:"single",
        learnCost:30, maxLevel:5, baseDamage:120, damagePerLevel:15, spCost:55,
        description:"å°å–®é«”é€ æˆ120é»åŸºç¤å‚·å®³ï¼›65%æ©Ÿç‡ä½¿ç›®æ¨™æšˆçœ©2å›åˆï¼Œä½¿ç›®æ¨™æœ€çµ‚å‘½ä¸­ç‡é™ä½15%/20%/25%/30%/35%ã€‚",
        stunChance:65, missBonusByLevel:[15,20,25,30,35], stunDuration:2, requires:["stormFlurry"]
    },

    /* ===== é¢¨ç³»ï¼šæ³•è¡“ ===== */
    windSpell:{
        id:"windSpell", tier:1, name:"ç‹‚é¢¨è¡“", element:"wind", category:"magic", targetType:"tri",
        learnCost:2, maxLevel:5, baseDamage:18, damagePerLevel:2, spCost:9,
        description:"å°åŒä¸€æ©«æ’å·¦ã€ä¸­ã€å³æœ€å¤š3åç›®æ¨™å„é€ æˆ18é»åŸºç¤æ³•è¡“å‚·å®³ï¼›50%æ©Ÿç‡é™ä½æ•æ·1å›åˆï¼Œé™ä½10%/20%/30%/40%/50%ã€‚",
        agilityDownChance:50, agilityDownByLevel:[10,20,30,40,50], agilityDownDuration:1
    },
    stormCircle:{
        id:"stormCircle", tier:2, name:"é¢¨ç„°è¡“", element:"wind", category:"magic", targetType:"row",
        learnCost:10, maxLevel:5, baseDamage:38, damagePerLevel:9, spCost:18,
        description:"å°ä»»ä¸€æ©«æ’å„é€ æˆ38é»åŸºç¤æ³•è¡“å‚·å®³ï¼›55%æ©Ÿç‡é™ä½ç›®æ¨™é€ æˆçš„å‚·å®³1å›åˆï¼Œé™ä½15%/18%/21%/25%/30%ã€‚",
        damageDownChance:55, damageDownByLevel:[15,18,21,25,30], damageDownDuration:1, requires:["windSpell"]
    },
    windHowlLightning:{
        id:"windHowlLightning", tier:3, name:"é¢¨å“®é›»æ“Š", element:"wind", category:"magic", targetType:"single",
        learnCost:15, maxLevel:5, baseDamage:95, damagePerLevel:12, spCost:39,
        description:"å°å–®é«”é€ æˆ95é»åŸºç¤æ³•è¡“å‚·å®³ï¼›65%æ©Ÿç‡é™ä½ç›®æ¨™é€ æˆçš„å‚·å®³1å›åˆï¼Œé™ä½15%/20%/25%/30%/35%ã€‚",
        damageDownChance:65, damageDownByLevel:[15,20,25,30,35], damageDownDuration:1, requires:["stormCircle"]
    },
    stormRain:{
        id:"stormRain", tier:4, name:"é¢¨èµ·é›²æ¹§", element:"wind", category:"magic", targetType:"all",
        learnCost:30, maxLevel:5, baseDamage:48, damagePerLevel:14, spCost:55,
        description:"å°æ•µæ–¹å…¨é«”å„é€ æˆ48é»åŸºç¤æ³•è¡“å‚·å®³ï¼›35%æ©Ÿç‡æšˆçœ©1å›åˆï¼Œä½¿ç›®æ¨™æœ€çµ‚å‘½ä¸­ç‡é™ä½15%/20%/25%/30%/35%ã€‚",
        stunChance:35, missBonusByLevel:[15,20,25,30,35], stunDuration:1, requires:["windHowlLightning"]
    },

    /* ===== é¢¨ç³»ï¼šå¢ç›Š ===== */
    dodgeSkill:{
        id:"dodgeSkill", name:"é–ƒèº²è¡“", element:"wind", category:"buff", targetType:"allyAll",
        learnCost:10, maxLevel:1, spCost:20, duration:2,
        description:"ä½¿æˆ‘æ–¹å…¨é«”é–ƒèº²ç‡æå‡30%ï¼ŒæŒçºŒ2å›åˆã€‚", evasionBonusPercent:30,
        requires:["windCrossSlash","windHowlLightning"]
    },
    stealthSkill:{
        id:"stealthSkill", name:"éš±èº«è¡“", element:"wind", category:"buff", targetType:"ally",
        learnCost:15, maxLevel:1, spCost:25, duration:2,
        description:"ä½¿æˆ‘æ–¹å–®ä¸€ç›®æ¨™éš±èº«2å›åˆï¼›ç„¡æ³•è¢«å–®é«”æŠ€èƒ½é¸ä¸­ï¼Œä½†ä»æœƒå—åˆ°ç¯„åœæŠ€èƒ½æ³¢åŠã€‚", requires:["dodgeSkill"]
    },
    dinghaishenzhen:{
        id:"dinghaishenzhen", name:"æ°£å®šç¥é–’", element:"wind", category:"buff", targetType:"allyAll",
        learnCost:20, maxLevel:1, spCost:55, duration:3,
        description:"ä½¿æˆ‘æ–¹å…¨é«”ç•°å¸¸ç‹€æ…‹æŠ—æ€§æå‡35%ï¼ŒæŒçºŒ3å›åˆã€‚", statusResistBonus:35,
        requires:["stealthSkill"]
    },

    /* ===== é¢¨ç³»ï¼šè¢«å‹• ===== */
    windEX:{
        id:"windEX", name:"é¢¨å…ƒç´ EX", element:"wind", category:"passive", targetType:"none",
        learnCost:25, maxLevel:1,
        description:"æ°¸ä¹…æå‡é¢¨å…ƒç´ è§’è‰²çš„é–ƒèº²ç‡15%ã€‚", evasionBonusPercent:15
    },

    /* ===== åœŸç³»ï¼šç‰©ç† ===== */
    stoneSlash:{
        id:"stoneSlash", tier:1, name:"åœŸçŸ³æ–¬", element:"earth", category:"physical", targetType:"single",
        learnCost:2, maxLevel:5, baseDamage:14, damagePerLevel:2, spCost:7,
        description:"å°å–®é«”é€ æˆ14é»åŸºç¤å‚·å®³ï¼›65%æ©Ÿç‡é™ä½é˜²ç¦¦1å›åˆï¼Œé™ä½10%/20%/30%/40%/50%ã€‚",
        defenseDownChance:65, defenseDownByLevel:[10,20,30,40,50], defenseDownDuration:1
    },
    petrifyFist:{
        id:"petrifyFist", tier:2, name:"çŸ³ç›¾æ‹³", element:"earth", category:"physical", targetType:"tri",
        learnCost:10, maxLevel:5, baseDamage:28, damagePerLevel:7, spCost:26,
        description:"å°åŒä¸€æ©«æ’å·¦ã€ä¸­ã€å³æœ€å¤š3åç›®æ¨™å„é€ æˆ28é»åŸºç¤å‚·å®³ï¼›ç‚ºæˆ‘æ–¹å…¨é«”å¢åŠ 100/125/150/175/200é»è­·ç›¾ï¼ŒæŒçºŒ2å›åˆã€‚",
        allyShieldByLevel:[100,125,150,175,200], shieldDuration:2, requires:["stoneSlash"]
    },
    stoneBreakSky:{
        id:"stoneBreakSky", tier:3, name:"çŸ³ç ´å¤©é©š", element:"earth", category:"physical", targetType:"single",
        learnCost:15, maxLevel:5, baseDamage:55, damagePerLevel:7, spCost:42,
        description:"å°å–®é«”é€ æˆ55é»åŸºç¤å‚·å®³ï¼›ç‚ºæˆ‘æ–¹å…¨é«”å¢åŠ 100/125/150/175/200é»è­·ç›¾ï¼ŒæŒçºŒ2å›åˆã€‚",
        allyShieldByLevel:[100,125,150,175,200], shieldDuration:2, requires:["petrifyFist"]
    },
    earthquakeCrush:{
        id:"earthquakeCrush", tier:4, name:"åœ°è£‚é‡æ‹³", element:"earth", category:"physical", targetType:"tri",
        learnCost:30, maxLevel:5, baseDamage:48, damagePerLevel:14, spCost:55,
        description:"å°åŒä¸€æ©«æ’å·¦ã€ä¸­ã€å³æœ€å¤š3åç›®æ¨™å„é€ æˆ48é»åŸºç¤å‚·å®³ï¼›ç‚ºè‡ªèº«å¢åŠ 100/150/200/250/300é»è­·ç›¾ï¼ŒæŒçºŒ2å›åˆã€‚",
        selfShieldByLevel:[100,150,200,250,300], shieldDuration:2, requires:["stoneBreakSky"]
    },

    /* ===== åœŸç³»ï¼šæ³•è¡“ ===== */
    stoneThrow:{
        id:"stoneThrow", tier:1, name:"è½çŸ³è¡“", element:"earth", category:"magic", targetType:"tri",
        learnCost:2, maxLevel:5, baseDamage:14, damagePerLevel:2, spCost:7,
        description:"å°åŒä¸€æ©«æ’å·¦ã€ä¸­ã€å³æœ€å¤š3åç›®æ¨™å„é€ æˆ14é»åŸºç¤æ³•è¡“å‚·å®³ï¼›65%æ©Ÿç‡é™ä½é˜²ç¦¦1å›åˆï¼Œé™ä½10%/20%/30%/40%/50%ã€‚",
        defenseDownChance:65, defenseDownByLevel:[10,20,30,40,50], defenseDownDuration:1
    },
    sandWind:{
        id:"sandWind", tier:2, name:"æ»¾çŸ³è¡“", element:"earth", category:"magic", targetType:"row",
        learnCost:10, maxLevel:5, baseDamage:17, damagePerLevel:5, spCost:19,
        description:"å°ä»»ä¸€æ©«æ’å„é€ æˆ17é»åŸºç¤æ³•è¡“å‚·å®³ï¼›65%æ©Ÿç‡é™ä½é˜²ç¦¦1å›åˆï¼Œé™ä½10%/20%/30%/40%/50%ã€‚",
        defenseDownChance:65, defenseDownByLevel:[10,20,30,40,50], defenseDownDuration:1, requires:["stoneThrow"]
    },
    flyingSandStrike:{
        id:"flyingSandStrike", tier:3, name:"é£›æ²™ç¬æ“Š", element:"earth", category:"magic", targetType:"all",
        learnCost:15, maxLevel:5, baseDamage:20, damagePerLevel:8, spCost:26,
        description:"å°æ•µæ–¹å…¨é«”å„é€ æˆ20é»åŸºç¤æ³•è¡“å‚·å®³ï¼›ä¾ç­‰ç´š25%/35%/45%/55%/65%æ©Ÿç‡çŸ³åŒ–ç›®æ¨™2å›åˆï¼Œä½¿å…¶ç„¡æ³•è¡Œå‹•ã€‚",
        petrifyChanceByLevel:[25,35,45,55,65], petrifyDuration:2, requires:["sandWind"]
    },
    dustStorm:{
        id:"dustStorm", tier:4, name:"åœ°ç‰›çŒ›è¥²", element:"earth", category:"magic", targetType:"all",
        learnCost:30, maxLevel:5, baseDamage:48, damagePerLevel:14, spCost:55,
        description:"å°æ•µæ–¹å…¨é«”å„é€ æˆ48é»åŸºç¤æ³•è¡“å‚·å®³ï¼›60%æ©Ÿç‡é™ä½é˜²ç¦¦1å›åˆï¼Œé™ä½10%/15%/20%/25%/30%ã€‚",
        defenseDownChance:60, defenseDownByLevel:[10,15,20,25,30], defenseDownDuration:1, requires:["flyingSandStrike"]
    },

    /* ===== åœŸç³»ï¼šå¢ç›Š ===== */
    earthShield:{
        id:"earthShield", name:"è¬è±¡åœŸç›¾", element:"earth", category:"buff", targetType:"ally",
        learnCost:10, maxLevel:1, spCost:32, duration:3,
        description:"ä½¿æˆ‘æ–¹å–®ä¸€ç›®æ¨™ç²å¾—50%åå‚·åœŸç›¾ï¼ŒæŒçºŒ3å›åˆã€‚", reflectPercent:50,
        requires:["stoneBreakSky","flyingSandStrike"]
    },
    rockWall:{
        id:"rockWall", name:"å²©çŸ³å£å£˜", element:"earth", category:"buff", targetType:"allyAll",
        learnCost:15, maxLevel:1, spCost:45, duration:3,
        description:"ä½¿æˆ‘æ–¹å…¨é«”é˜²ç¦¦åŠ›æå‡30%ï¼ŒæŒçºŒ3å›åˆã€‚", defenseBonusPercent:30,
        requires:["barrier"]
    },
    barrier:{
        id:"barrier", name:"çµç•Œ", element:"earth", category:"buff", targetType:"ally",
        learnCost:20, maxLevel:1, spCost:28, duration:4,
        description:"ä½¿æˆ‘æ–¹å–®ä¸€ç›®æ¨™ç²å¾—å®Œå…¨é˜²è­·ç½©ï¼Œå¯æŠµæ“‹æ‰€æœ‰å‚·å®³ï¼ŒæŒçºŒ4å›åˆã€‚", requires:["earthShield"]
    },

    /* ===== åœŸç³»ï¼šè¢«å‹• ===== */
    earthEX:{
        id:"earthEX", name:"åœŸå…ƒç´ EX", element:"earth", category:"passive", targetType:"none",
        learnCost:25, maxLevel:1,
        description:"æ°¸ä¹…æå‡åœŸå…ƒç´ è§’è‰²çš„é˜²ç¦¦åŠ›15%ã€‚", defenseBonusPercent:15
    }
};

/* =====================================================
   V126 â€” MONSTER BOOTSTRAP CONSTANT ORDER
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
   æ€ªç‰©é è¨­é–ƒèº²å”¯ä¸€ Owner
   forestMonsters / desertMonsters ç­‰å€åŸŸ roster æœƒåœ¨ App Shell é ‚å±¤
   ç«‹å³å‘¼å« makeZoneMonster()ï¼Œå› æ­¤å¸¸æ•¸å¿…é ˆåœ¨ç¬¬ä¸€å€‹ roster å»ºç«‹å‰
   å®Œæˆåˆå§‹åŒ–ã€‚æ­£å¼å€¼ï¼šlevelÃ—0.1%ï¼Œæœ€é«˜10%ã€‚
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

    makeZoneMonster("å“¥å¸ƒæ—",3,"fire"),
    makeZoneMonster("å²èŠå§†",2,"water"),
    makeZoneMonster("å“¥å¸ƒæ—",3,"fire"),
    makeZoneMonster("å²èŠå§†",2,"water"),    makeZoneMonster("å“¥å¸ƒæ—",3,"fire"),
    makeZoneMonster("å²èŠå§†",2,"water")

];

forestMonsters.forEach(monster=>{
    monster.agilityPoints=0;
    monster.agility=0;
    monster.v173BeginnerForest=true;
});


/*
   â˜… è’æ¼ åœ°å¸¶ï¼ˆç¬¬äºŒå€ï¼‰æ€ªç‰©è³‡æ–™ã€‚
   æ•¸å€¼æ˜é¡¯æ¯”æ–°æ‰‹æ£®æ—ç¡¬ï¼Œ
   ä¸»è¦æ˜¯ç‚ºäº†è®“ç©å®¶èƒ½å¯¦éš›æ¸¬è©¦
   ç‡ƒç‡’é€™é¡ã€ŒæŒçºŒå‚·å®³ã€æ•ˆæœâ€”â€”
   æ–°æ‰‹æ£®æ—çš„æ€ªå¤ªè„†ï¼Œé€šå¸¸ä¸€å…©ä¸‹å°±æ­»äº†ï¼Œ
   æ ¹æœ¬æ’ä¸åˆ°ç‡ƒç‡’è·³å®Œ2å›åˆã€‚
*/

const desertMonsters = [

    makeZoneMonster("æ²™æ¼ è±ºç‹¼",16,"fire"),
    makeZoneMonster("æ²™è ",15,"water"),
    makeZoneMonster("æ²™æ¼ è±ºç‹¼",16,"fire"),
    makeZoneMonster("æ²™è ",15,"water"),
    makeZoneMonster("æ²™æ¼ è±ºç‹¼",16,"fire"),
    makeZoneMonster("æ²™è ",15,"water")

];


/*
   â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼‰ï¼š
   å†°éœœå±±è„ˆï¼ˆç¬¬ä¸‰å€ï¼‰æ€ªç‰©è³‡æ–™ï¼ŒLv.21~30ã€‚

   1. æŠ€èƒ½æ”¹æˆå¼•ç”¨skillDatabaseè£¡ã€ŒçœŸçš„å­˜åœ¨ã€
      çš„æŠ€èƒ½IDï¼Œä¸å†è‡ªå·±äº‚å–åå­—â€”â€”ç©å®¶è‡ªå·±
      ä¹Ÿæœƒç”¨åˆ°ç«ç„°æ–¬ã€æ°´åˆ€æ–¬é€™äº›æŠ€èƒ½ï¼Œ
      æ€ªç‰©ç”¨åŒä¸€æ‹›ï¼Œç©å®¶ä¸€çœ‹å°±æ‡‚ï¼Œ
      ä¸æœƒè¢«å…©å¥—ä¸åŒåå­—çš„æŠ€èƒ½ææ··ã€‚
   2. skillIdsæ”¹æˆé™£åˆ—ï¼ˆå°±ç®—ç›®å‰åªæ”¾1å€‹ï¼‰ï¼Œ
      ä¹‹å¾Œé«˜ç­‰ç´šå€åŸŸè¦æ”¾2ã€3å€‹æŠ€èƒ½æ™‚ï¼Œ
      ç›´æ¥å¾€é™£åˆ—è£¡åŠ å°±å¥½ï¼Œä¸ç”¨æ”¹è³‡æ–™çµæ§‹ã€‚
   3. æ–°å¢skillChanceï¼ˆæŠ€èƒ½é‡‹æ”¾æ©Ÿç‡ï¼‰ï¼Œ
      æ¯å€‹å€åŸŸçš„æ©Ÿç‡ä¸ä¸€æ¨£ï¼Œç›´æ¥å¯«åœ¨
      æ€ªç‰©è³‡æ–™è£¡ï¼Œè®€å–çš„åœ°æ–¹ä¸ç”¨å¦å¤–åˆ¤æ–·
      ç¾åœ¨æ˜¯å“ªå€‹å€åŸŸã€‚
*/

const iceMountainMonsters = [

    makeZoneMonster("ç†¾ç„°ç‹¼",22,"fire"),
    makeZoneMonster("å¯’å†°é­”",23,"water"),
    makeZoneMonster("ç†¾ç„°ç‹¼",22,"fire"),
    makeZoneMonster("å¯’å†°é­”",23,"water"),
    makeZoneMonster("ç†¾ç„°ç‹¼ç‹",27,"fire"),
    makeZoneMonster("å¯’å†°é­”ç‹",28,"water")

];


/*
   â˜… æ–°å¢ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼‰ï¼š
   ç¬¬å››ï½å…«å€æ€ªç‰©è³‡æ–™ï¼ŒLv.31~80ï¼Œ
   æ¯å€æŠ€èƒ½æ•¸é‡ã€æŠ€èƒ½é‡‹æ”¾æ©Ÿç‡éƒ½ä¸ä¸€æ¨£ï¼š

   31~40ï¼š1å€‹æŠ€èƒ½ï¼Œ55%æ©Ÿç‡
   41~50ï¼š2å€‹æŠ€èƒ½ï¼Œ60%æ©Ÿç‡
   51~60ï¼š2å€‹æŠ€èƒ½ï¼Œ65%æ©Ÿç‡
   61~70ï¼š3å€‹æŠ€èƒ½ï¼Œ65%æ©Ÿç‡
   71~80ï¼š3å€‹æŠ€èƒ½ï¼Œ70%æ©Ÿç‡

   æŠ€èƒ½æ± çµ±ä¸€å¾skillDatabaseè£¡æŒ‘é¸
   ç«/æ°´ç³»çš„å‚·å®³é¡æŠ€èƒ½ï¼Œç­‰ç´šè¶Šé«˜çš„å€åŸŸ
   æŠ€èƒ½æ± è£¡çš„æ‹›å¼ä¹Ÿè¶Šå¤šæ¨£ã€è¶Šå¼·ã€‚

   â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œã€Œé‡æ€ªç•°å¸¸
   ç‹€æ…‹ç›´æ¥åšï¼Œæˆ‘çµ¦ä½ åˆ†ç´šã€ï¼‰ï¼š
   é€™äº›æ‰‹å‹•æ’çš„æŠ€èƒ½æ± é™£åˆ—å·²ç¶“è¢«
   getMonsterSkillPoolForLevel()é€™å€‹
   çµ±ä¸€è¦å‰‡å–ä»£ï¼ˆè¦‹makeZoneMonster()
   é™„è¿‘ï¼‰ï¼Œä¸æœƒå†ç”¨åˆ°ï¼Œæ•´çµ„æ‹¿æ‰ã€‚
*/


/*
   â˜… æ–°å¢ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œæ€ªç‰©å…­åœç³»çµ±ï¼Œ
   å®Œå…¨æ¯”ç…§ç©å®¶çš„èƒ½åŠ›é»åˆ†é…/æ›ç®—å…¬å¼ï¼Œ
   ä¸å†æ˜¯æ‰‹å‹•å¡«æ­»çš„HP/SP/æ”»æ“Š/é˜²ç¦¦æ•¸å­—ï¼‰ï¼š

   ç¸½èƒ½åŠ›é» = 10 + ç­‰ç´šÃ—2
   æ•æ·é»æ•¸ = round(ç­‰ç´šÃ·3)ï¼Œå¾ç¸½èƒ½åŠ›é»è£¡æ‰£é™¤
   å¯åˆ†é…é»æ•¸ = ç¸½èƒ½åŠ›é» âˆ’ æ•æ·é»æ•¸
   é«”è³ªé»æ•¸ = round(å¯åˆ†é…é»æ•¸ Ã— 10%)ï¼Œå›ºå®š
   å‰©é¤˜é»æ•¸å¹³å‡åˆ†é…çµ¦æ”»æ“Šï¼èƒ½é‡ï¼æ™ºåŠ›ï¼ç²¾ç¥ï¼Œ
   é¤˜æ•¸ä¾å›ºå®šé †åºè£œå…¥ï¼Œç¢ºä¿åŒååŒç´šæ€ªç‰©æ•¸å€¼ä¸€è‡´ã€‚

   æ›ç®—æˆå¯¦éš›æ•¸å€¼æ™‚ï¼Œç›´æ¥å¥—ç”¨è·Ÿç©å®¶
   getBaseStats()å®Œå…¨ç›¸åŒçš„å…¬å¼ï¼š
   maxHP    = 100 + é«”è³ªÃ—50
   maxSP    = 50  + èƒ½é‡Ã—15
   æ”»æ“ŠåŠ›    = 10  + æ”»æ“ŠÃ—8
   é˜²ç¦¦     = 10  + é«”è³ªÃ—6
   æ³•è¡“æ”»æ“Š  = 10  + æ™ºåŠ›Ã—8
   å‘½ä¸­ = ç²¾ç¥Ã—2
   ä¸€èˆ¬ç•°å¸¸æŠ—æ€§ = ç²¾ç¥Ã—0.05ï¼ˆç™¾åˆ†é»ï¼‰
   é è¨­é–ƒé¿ = min(10%, ç­‰ç´šÃ—0.1%)
   é€Ÿåº¦(è¡Œå‹•é †åºç”¨) = æ•æ·ï¼ˆåŸå§‹é»æ•¸ï¼Œä¸é¡å¤–ä¹˜ï¼‰
*/

/*
   â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œã€ŒåŒä¸€å€åŒä¸€å€‹
   æ€ªç‰©åç¨±ï¼Œç­‰ç´šå°±è¦ä¸€æ¨£ï¼Œèƒ½åŠ›å€¼ä¹Ÿéƒ½è¦
   ä¸€æ¨£ã€ï¼‰ï¼š
   é€™å€‹å‡½å¼åŸæœ¬ç”¨Math.random()æ±ºå®šæ”»æ“Š/
   èƒ½é‡/æ™ºåŠ›/ç²¾ç¥å››é …æ€éº¼åˆ†é…ï¼Œä»£è¡¨å°±ç®—
   åç¨±ã€ç­‰ç´šå®Œå…¨ç›¸åŒçš„æ€ªç‰©ï¼ˆä¾‹å¦‚åŒä¸€å€
   æ”¾äº†ä¸‰éš»ã€Œå“¥å¸ƒæ— Lv.3ã€ï¼‰ï¼Œæ¯ä¸€éš»å¯¦éš›
   ç®—å‡ºä¾†çš„æ”»æ“ŠåŠ›/é­”æ”»/å‘½ä¸­/é–ƒé¿é‚„æ˜¯æœƒ
   å„è‡ªä¸åŒâ€”â€”ä¸æ˜¯ç­‰ç´šæ²’å°é½Šï¼Œæ˜¯ã€Œç­‰ç´š
   å°é½Šäº†ï¼Œä½†é»æ•¸åˆ†é…æ˜¯éš¨æ©Ÿéª°çš„ã€ï¼Œä¸€æ¨£
   æœƒè®“ç©å®¶è¦ºå¾—ã€ŒåŒååŒç­‰ç´šçš„æ€ªï¼Œæ•¸å€¼
   å»ä¸ä¸€æ¨£ã€ä¸åˆç†ã€‚

   æ”¹æˆå›ºå®šã€Œå¹³å‡åˆ†é…ã€ï¼ˆå››é …å¹³åˆ†ï¼Œåˆ†ä¸
   å®Œçš„é¤˜æ•¸ä¾å›ºå®šé †åºï¼Œä¸æ˜¯éš¨æ©Ÿé †åºï¼Œ
   è£œçµ¦å‰é¢å¹¾é …ï¼‰ï¼Œé€™æ¨£åŒä¸€å€‹ç­‰ç´šä¸ç®¡
   ç®—å¹¾æ¬¡ã€ç®—å¹¾éš»ï¼Œçµæœæ°¸é ä¸€æ¨¡ä¸€æ¨£ï¼Œ
   è·Ÿé«”è³ªé‚£é …ã€Œå›ºå®š10%ã€ä¸å†åƒèˆ‡éš¨æ©Ÿã€
   æ˜¯åŒä¸€å€‹ç²¾ç¥ï¼Œåªæ˜¯é€™è£¡æ“´å¤§åˆ°å…¨éƒ¨
   å››é …éƒ½å›ºå®šï¼Œä¸ç•™ä»»ä½•éš¨æ©Ÿæˆåˆ†ã€‚

   å‡½å¼åç¨±ä¿ç•™æ²’æ”¹ï¼ˆæ€•æ¼æ”¹åˆ°å…¶ä»–å‘¼å«
   çš„åœ°æ–¹ï¼‰ï¼Œä½†å‡½å¼æœ¬é«”å·²ç¶“ä¸å†éš¨æ©Ÿã€‚
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
       â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œé…é»è¦å‰‡
       ç¬¬äºŒæ¬¡èª¿æ•´ï¼‰ï¼š
       é«”è³ªæ”¹æˆã€Œå›ºå®š10%ã€ï¼Œä¸å†æ˜¯ã€Œä¿åº•
       40%+éš¨æ©ŸåŠ ç¢¼ã€â€”â€”é«”è³ªä¸æœƒå†å¾éš¨æ©Ÿæ± 
       è£¡å¤šæ‹¿åˆ°é¡å¤–é»æ•¸ï¼Œå°±æ˜¯å–®ç´”çš„10%ï¼Œ
       å…¶é¤˜90%ï¼ˆåŸæœ¬èƒ½é‡å›ºå®š20%çš„è¦å‰‡ä¹Ÿ
       å–æ¶ˆäº†ï¼‰å…¨éƒ¨ä¸Ÿé€²éš¨æ©Ÿæ± ï¼Œç”±ã€Œæ”»æ“Š/
       èƒ½é‡/æ™ºåŠ›/ç²¾ç¥ã€å››é …å‡ç­‰ç«¶çˆ­ã€‚
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
       éš¨æ©Ÿåˆ†é…çš„å››é …é †åºå›ºå®šï¼š
       [0]æ”»æ“Š [1]èƒ½é‡ [2]æ™ºåŠ› [3]ç²¾ç¥
       ï¼ˆé«”è³ªå·²ç¶“å›µ¨¥zºè¯
â¶)à²Ö§uªİ¢ëiºĞk¢G§¦*^ºå®š10%ï¼Œä¸å†åƒèˆ‡é€™è£¡çš„
       éš¨æ©Ÿç«¶çˆ­ï¼‰
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
   â˜… æ–°å¢ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œã€Œé‡æ€ªç•°å¸¸ç‹€æ…‹
   ç›´æ¥åšï¼Œæˆ‘çµ¦ä½ åˆ†ç´šã€ï¼‰ï¼š
   é‡æ€ªæŠ€èƒ½åˆ†ç´šè¦å‰‡ï¼Œçµ±ä¸€ç”±ç­‰ç´šæ±ºå®šé‡æ€ª
   ã€Œæ‹¿å¾—åˆ°å“ªäº›æŠ€èƒ½ã€è·Ÿã€Œæ”¾æŠ€èƒ½çš„æ©Ÿç‡ã€ï¼Œ
   ä¸ç”¨åƒä»¥å‰é‚£æ¨£æ¯å€‹å€åŸŸæ‰‹å‹•æ’æŠ€èƒ½ID
   é™£åˆ—ã€æ‰‹å‹•æŠ“æ©Ÿç‡æ•¸å­—ï¼Œåªè¦çµ¦å°element+
   levelï¼Œå…¶ä»–è‡ªå‹•ç®—å¥½ï¼š

   Lv.1~10ã€€ã€€åªæœƒæ™®é€šæ”»æ“Šï¼Œä¸æœƒæ”¾æŠ€èƒ½
   Lv.11~40ã€€å¯ä»¥æ”¾åˆ°ã€Œç¬¬1ç´šã€æŠ€èƒ½ï¼Œ35%æ©Ÿç‡
   Lv.41~70ã€€å¯ä»¥æ”¾åˆ°ã€Œç¬¬2ç´šã€æŠ€èƒ½ï¼Œ45%æ©Ÿç‡
   Lv.71~100ã€€å¯ä»¥æ”¾åˆ°ã€Œç¬¬3ç´šã€æŠ€èƒ½ï¼Œ55%æ©Ÿç‡

   ã€Œç¬¬Nç´šã€æ˜¯ç´¯åŠ çš„ï¼ˆä¸æ˜¯åªçµ¦é‚£ä¸€ç´šï¼Œæ˜¯
   å¾ç¬¬1ç´šåˆ°ç¬¬Nç´šå…¨éƒ¨éƒ½å¯èƒ½æ”¾ï¼‰ï¼Œè·ŸæŠ€èƒ½
   æœ¬èº«åœ¨ç‰©ç†/æ³•è¡“éˆä¸Šç¬¬å¹¾æ‹›å°æ‡‰ï¼ˆè¦‹
   skillDatabaseè£¡æ¯å€‹æ”»æ“ŠæŠ€èƒ½æ–°å¢çš„tier
   æ¬„ä½ï¼Œ1=å…¥é–€ã€2=ç¬¬äºŒæ‹›ã€3=ç¬¬ä¸‰æ‹›ã€
   4=æœ€å¼·æ‹›â€”â€”é‡æ€ªæœ€é«˜åªåˆ°3ç´šï¼Œ4ç´šçš„
   çµ‚æ¥µæŠ€èƒ½ä¸æœƒå‡ºç¾åœ¨é‡æ€ªèº«ä¸Šï¼‰ã€‚
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
       â˜… ä¿®æ­£ï¼šskillIdsï¼skillChanceä¸å†
       ç”±å‘¼å«çš„åœ°æ–¹æ‰‹å‹•å‚³å…¥ï¼Œæ”¹æˆå‘¼å«
       getMonsterSkillPoolForLevel()ï¼
       getMonsterSkillTierAndChance()
       è‡ªå‹•ä¾level+elementç®—å¥½ï¼Œä¿è­‰åŒä¸€å€‹
       ç­‰ç´šçš„æ€ªç‰©ï¼Œä¸ç®¡åœ¨å“ªå€‹å€åŸŸã€å“ªæ¬¡
       å‘¼å«ï¼Œæ‹¿åˆ°çš„æŠ€èƒ½æ± ï¼æ–½æ”¾æ©Ÿç‡æ°¸é 
       ä¸€è‡´ï¼Œä¸æœƒæœ‰äº›å€åŸŸæ‰‹å‹•æ¼æ”¹ã€æ•¸å­—
       å°ä¸ä¸Šåˆ†ç´šè¦å‰‡çš„æƒ…æ³ã€‚
    */

    return {

        name:name,
        level:level,

        maxHP:maxHP,
        hp:maxHP,

        maxSP:maxSP,
        sp:maxSP,

        /*
           â˜… å…­åœåŸå§‹é»æ•¸ä¹Ÿä¸€èµ·å­˜èµ·ä¾†ï¼Œ
           æ–¹ä¾¿ä¹‹å¾ŒæŸ¥çœ‹/é™¤éŒ¯ï¼Œæˆ°é¬¥å¯¦éš›
           è®€å–çš„æ˜¯ä¸‹é¢æ›ç®—å¥½çš„attack/
           defense/magicAttack/accuracy/
           resistance/evasioné€™äº›ã€Œæœ€çµ‚æ•¸å€¼ã€ï¼Œ
           ä¸æ˜¯é€™å¹¾å€‹åŸå§‹é»æ•¸ã€‚
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
            getDefaultMonsterEvasion(level),

        agility:
            points.agility,


        alive:true,
        element:element,

        /*
           â˜… æ–°å¢ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œã€Œä»¥å¾Œ
           ç²¾è‹±æ€ªè·ŸBOSSçš„åç¨±ä¸æœƒæœ‰ç‹æˆ–çš‡ï¼Œ
           æˆ‘æœƒç›´æ¥è·Ÿå¦³èªªèª°èª°èª°å°±æ˜¯å¥—ç”¨
           ä»€éº¼æ€ªã€ï¼‰ï¼š
           æ–°å¢ç¬¬4å€‹åƒæ•¸rankï¼Œç›´æ¥æ˜ç¢ºæŒ‡å®š
           "elite"ï¼"boss"ï¼Œä¸ç”¨å†é åå­—
           çµå°¾çŒœã€‚getMonsterRank()åŸæœ¬å°±
           å·²ç¶“å¯«æˆã€Œå„ªå…ˆçœ‹monster.rankæ¬„ä½ï¼Œ
           æ²’æœ‰æ‰é€€å›çœ‹åå­—çµå°¾ã€ï¼Œé€™è£¡æ¥ä¸Š
           ä¹‹å¾Œï¼Œå¾€å¾Œæ–°æ€ªç‰©åªè¦åœ¨
           makeZoneMonster()å‘¼å«æ™‚å¤šè£œä¸€å€‹
           åƒæ•¸å°±å¥½ï¼Œä¾‹å¦‚ï¼š
           makeZoneMonster("ç†”å²©é­”åƒ",45,
           "fire","elite")
           ä¸å¯«é€™å€‹åƒæ•¸ï¼ˆç¶­æŒ3å€‹åƒæ•¸ï¼‰çš„è©±ï¼Œ
           ç…§èˆŠç”±getMonsterRank()é€€å›çœ‹
           åå­—çµå°¾åˆ¤æ–·ï¼ŒèˆŠè³‡æ–™å®Œå…¨ä¸ç”¨æ”¹ã€‚
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

    makeZoneMonster("çƒˆç„°å·¨é­”",32,"fire"),
    makeZoneMonster("æ·±æ·µæ°´éˆ",33,"water"),
    makeZoneMonster("çƒˆç„°å·¨é­”",32,"fire"),
    makeZoneMonster("æ·±æ·µæ°´éˆ",33,"water"),
    makeZoneMonster("çƒˆç„°å·¨é­”ç‹",38,"fire"),
    makeZoneMonster("æ·±æ·µæ°´éˆç‹",40,"water")

];


const zone5Monsters = [

    makeZoneMonster("ç†”å²©å·¨ç¸",42,"fire"),
    makeZoneMonster("å¯’æ½®å·¨ç¸",43,"water"),
    makeZoneMonster("ç†”å²©å·¨ç¸",42,"fire"),
    makeZoneMonster("å¯’æ½®å·¨ç¸",43,"water"),
    makeZoneMonster("ç†”å²©å·¨ç¸ç‹",48,"fire"),
    makeZoneMonster("å¯’æ½®å·¨ç¸ç‹",50,"water")

];


const zone6Monsters = [

    makeZoneMonster("èµ¤ç‚ä¿®ç¾…",52,"fire"),
    makeZoneMonster("ç„å†°ä¿®ç¾…",53,"water"),
    makeZoneMonster("èµ¤ç‚ä¿®ç¾…",52,"fire"),
    makeZoneMonster("ç„å†°ä¿®ç¾…",53,"water"),
    makeZoneMonster("èµ¤ç‚ä¿®ç¾…ç‹",58,"fire"),
    makeZoneMonster("ç„å†°ä¿®ç¾…ç‹",60,"water")

];


const zone7Monsters = [

    makeZoneMonster("æ¥­ç«é­”å›",62,"fire"),
    makeZoneMonster("çµ•å†°é­”å›",63,"water"),
    makeZoneMonster("æ¥­ç«é­”å›",62,"fire"),
    makeZoneMonster("çµ•å†°é­”å›",63,"water"),
    makeZoneMonster("æ¥­ç«é­”å›ç‹",68,"fire"),
    makeZoneMonster("çµ•å†°é­”å›ç‹",70,"water")

];


const zone8Monsters = [

    makeZoneMonster("ç„šå¤©é¾ç„",72,"fire"),
    makeZoneMonster("æ¥µå¯’é¾ç„",73,"water"),
    makeZoneMonster("ç„šå¤©é¾ç„",72,"fire"),
    makeZoneMonster("æ¥µå¯’é¾ç„",73,"water"),
    makeZoneMonster("ç„šå¤©é¾ç„çš‡",78,"fire"),
    makeZoneMonster("æ¥µå¯’é¾ç„çš‡",80,"water")

];


/*
   â˜… æ–°å¢ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œæ–°å¢81ï½90ã€
   91ï½100å…©å€‹åœ°å€ï¼‰ï¼š
   å»¶çºŒzone4~8çš„ç­‰ç´š/æŠ€èƒ½æ± åˆ†é…è¦å¾‹
   ï¼ˆæ¯å€è·¨10ç´šã€ç‹ç´šæ¯”ä¸€èˆ¬é«˜6~8ç´šã€
   æŠ€èƒ½æ± æ²¿ç”¨åŒä¸€ç³»åˆ—çš„ç¬¬3æ± â€”â€”ç›®å‰
   FIRE_SKILL_POOL_3/WATER_SKILL_POOL_3
   æ˜¯æœ€é«˜éšçš„æŠ€èƒ½æ± ï¼Œæ²’æœ‰æ›´é«˜ä¸€éšçš„æ± å­ï¼Œ
   é€™å…©å€‹æ–°åœ°å€å»¶çºŒä½¿ç”¨åŒä¸€çµ„ï¼Œç­‰ä¹‹å¾Œ
   æœ‰éœ€è¦å†æ“´å……æ–°çš„æŠ€èƒ½æ± ï¼‰ã€‚
*/

const zone9Monsters = [

    makeZoneMonster("è™›ç©ºç…‰ç„",82,"fire"),
    makeZoneMonster("æ°¸å‡æ·±æ·µ",83,"water"),
    makeZoneMonster("è™›ç©ºç…‰ç„",82,"fire"),
    makeZoneMonster("æ°¸å‡æ·±æ·µ",83,"water"),
    makeZoneMonster("è™›ç©ºç…‰ç„çš‡",88,"fire"),
    makeZoneMonster("æ°¸å‡æ·±æ·µçš‡",90,"water")

];


const zone10Monsters = [

    makeZoneMonster("çµ‚ç„‰ç¥é­”",92,"fire"),
    makeZoneMonster("æœ«ä¸–å¯’ç¥",93,"water"),
    makeZoneMonster("çµ‚ç„‰ç¥é­”",92,"fire"),
    makeZoneMonster("æœ«ä¸–å¯’ç¥",93,"water"),
    makeZoneMonster("çµ‚ç„‰ç¥é­”çš‡",98,"fire"),
    makeZoneMonster("æœ«ä¸–å¯’ç¥çš‡",100,"water")

];



/*
   â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œã€Œæ•´å€‹æ›æ‰ï¼Œ
   ä»¥å¾Œéƒ½å¥—ç”¨ã€ï¼‰ï¼š
   èˆŠçš„ã€Œç²¾è‹±æ€ªåŸºæº–å€¼ Ã— 0.25ã€é€™å¥—æŠ˜æ‰£
   æ©Ÿåˆ¶ï¼Œå·²ç¶“è¢«ä¸Šé¢å…¨æ–°çš„å…­åœèƒ½åŠ›é»åˆ†é…
   å…¬å¼å®Œå…¨å–ä»£â€”â€”makeZoneMonster()ç¾åœ¨
   ç›´æ¥ä¾ç…§ç­‰ç´šç®—å‡ºæœ€çµ‚æ•¸å€¼ï¼Œä¸å†éœ€è¦
   é¡å¤–ç–ŠåŠ ä¸€å±¤ç¸®æ”¾ä¿‚æ•¸ï¼Œé€™è£¡æ•´æ®µæ‹¿æ‰ã€‚
*/


/*
   â˜… ç›®å‰æ‰€åœ¨å€åŸŸçš„æ€ªç‰©è³‡æ–™ï¼Œ
   é€²å…¥ä¸åŒç·´åŠŸå€æ™‚æœƒé‡æ–°æŒ‡å‘å°æ‡‰çš„é™£åˆ—ã€‚
   å…¶ä»–æ‰€æœ‰å‡½å¼ï¼ˆrenderBattleã€monsterTurnã€
   respawnMonstersâ€¦ï¼‰éƒ½æ˜¯ç›´æ¥è®€é€™å€‹è®Šæ•¸ï¼Œ
   ä¸éœ€è¦å¦å¤–æ”¹ï¼Œåˆ‡æ›å€åŸŸåªè¦é‡æ–°è³¦å€¼å°±å¥½ã€‚
*/

let monsters =
    forestMonsters;


let currentZone =
    "forest";


/* =====================================================
   æŠ€èƒ½
===================================================== */




/*
   â˜… æ–°å¢ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œã€ŒæŠŠç«å…ƒç´ æŠ€èƒ½
   iconæ”¾å°çš„ä½ç½®ã€ï¼‰ï¼š
   10å€‹ç«ç³»æŠ€èƒ½çš„iconåœ–ç‰‡ï¼ˆä½¿ç”¨è€…ä¸Šå‚³çš„
   AIç”Ÿæˆæ’åœ–ï¼Œå·²è£åˆ‡æˆæ­£æ–¹å½¢ä¸¦å£“ç¸®æˆ
   base64å…§åµŒï¼‰ï¼Œå°æ‡‰è¦å‰‡ä¾ç…§åœ–ç‰‡å…§å®¹
   è·ŸæŠ€èƒ½åç¨±/æ•ˆæœé…å°ï¼š
   flameSlashï¼ˆç«ç„°æ–¬ï¼Œå…¥é–€å–®é«”æ–¬æ“Šï¼‰
     â†’ ç«ç„°åŠèº«+å¼§å½¢ç«ç—•ï¼Œæœ€åŸºæœ¬çš„
       ã€ŒåŠ+ç«ã€ç•«é¢
   fireCriticalï¼ˆæœƒå¿ƒä¸€æ“Šï¼Œé«˜å‚·å®³å–®é«”ï¼‰
     â†’ åŠæ’åœ°ã€å‘¨åœçˆ†ç™¼ç’°ç‹€ç´…è‰²å…‰æ³¢ï¼Œ
       ä»£è¡¨çˆ†æ“Šç¬é–“çš„å¼·çƒˆè¡æ“Šæ„Ÿ
   explosiveFlurryï¼ˆç«çˆ†äº‚æ“Šï¼Œä¸‰äººäº‚æ“Šï¼‰
     â†’ è§’è‰²é›™åˆ€çˆ†è£‚æ®ç ï¼Œå°æ‡‰ã€Œäº‚æ“Šã€
       çš„å‹•æ…‹æ„Ÿ
   dragonSlashï¼ˆéœ¸é¾è£‚å¤©æ–¬ï¼Œå–®é«”å¤§å‚·å®³ï¼‰
     â†’ é¾é ­+æ’•è£‚å¤©éš›çš„å…‰æŸæ–¬ï¼Œå‘¼æ‡‰
       æŠ€èƒ½åè£¡çš„ã€Œé¾ã€èˆ‡ã€Œè£‚å¤©ã€
   fireRocketï¼ˆç«ç®­ï¼Œä¸‰äººæ³•è¡“å‚·å®³ï¼‰
     â†’ å¼“+ç‡ƒç‡’çš„ç®­ï¼Œç›´æ¥å°æ‡‰ã€Œç®­ã€
       é€™å€‹æŠ€èƒ½å
   blazeSpellï¼ˆçƒˆç«è¡“ï¼Œå–®é«”æ³•è¡“ï¼‰
     â†’ ç´”ç²¹çš„ç«ç„°æ¼©æ¸¦æ³•é™£ï¼Œä»£è¡¨
       æ–½æ³•ç”¢ç”Ÿçš„ç«ç³»æ³•è¡“æ•ˆæœ
   flameTornadoï¼ˆçƒˆç„°é¾æ²ï¼Œæ•´æ’+ç‡ƒç‡’ï¼‰
     â†’ ç«é¾ç›¤æ—‹æˆé¾æ²é¢¨çš„å½¢ç‹€ï¼Œ
       å°æ‡‰æŠ€èƒ½åè£¡çš„ã€Œé¾æ²ã€
   phoenixCryï¼ˆç«é³³å¤©é³´ï¼Œå…¨é«”+ç‡ƒç‡’ï¼‰
     â†’ ç«é³³å‡°å±•ç¿…å˜¶é³´ï¼Œç›´æ¥å°æ‡‰
       æŠ€èƒ½åã€Œç«é³³ã€
   rageï¼ˆæ€’ç«ï¼Œçˆ†æ“Šç‡/å‚·å®³å¢ç›Šï¼‰
     â†’ å’†å“®çš„ç«ç„°æƒ¡é­”è‡‰ï¼Œä»£è¡¨ã€Œæ€’ç«ã€
       ä¸­ç‡’çš„æ†¤æ€’æ„Ÿï¼ˆä¾ä½¿ç”¨è€…å›å ±ï¼Œ
       è·Ÿæœƒå¿ƒä¸€æ“ŠåŸæœ¬é…åäº†ï¼Œé€™è£¡
       å·²ç¶“å°èª¿ï¼‰
   fireEXï¼ˆç«å…ƒç´ EXï¼Œè¢«å‹•ï¼‰
     â†’ åœ–ç‰‡æœ¬èº«å°±å¯«è‘—ã€ŒEXã€å­—æ¨£ï¼Œ
       ç›´æ¥å°æ‡‰
*/

const elementSkillIconMap = {
    flameSlash:"assets/skills/fire-flame-slash.jpg",
    dragonSlash:"assets/skills/fire-dragon-slash.jpg",
    explosiveFlurry:"assets/skills/fire-explosive-flurry.jpg",
    rage:"assets/skills/fire-rage.jpg",
    fireSoulResonance:"assets/skills/fire-soul-resonance.webp",
    bloodBurnArt:"assets/skills/fire-blood-burn.webp",
    blazeSpell:"assets/skills/fire-blaze-spell.jpg",
    fireCritical:"assets/skills/fire-critical.jpg",
    fireRocket:"assets/skills/fire-rocket.jpg",
    phoenixCry:"assets/skills/fire-phoenix-cry.jpg",
    flameTornado:"assets/skills/fire-flame-tornado.jpg",
    fireEX:"assets/skills/fire-ex.jpg",

    /*
       â˜… æ–°å¢ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œã€Œæ›æ°´å…ƒç´ ã€ï¼‰ï¼š
       10å€‹æ°´ç³»æŠ€èƒ½çš„iconï¼Œé…å°ä¾ç…§åœ–ç‰‡å…§å®¹
       è·ŸæŠ€èƒ½åç¨±/æ•ˆæœï¼š
       waterKnifeï¼ˆæ°´åˆ€æ–¬ï¼Œå…¥é–€å–®é«”ï¼‰
         â†’ ä¸€é“éŠ³åˆ©çš„æ°´/å†°åˆƒæ–œåŠˆè€Œé
       frostPunchï¼ˆå†°éœœæ‹³ï¼Œå–®é«”ç‰©ç†ï¼‰
         â†’ ä¸€è¨˜å†°éœœæ‹³é ­æ­£é¢æ®å‡º
       iceSpinï¼ˆå†°æ—‹ä¸€é–ƒï¼Œä¸‰äººç‰©ç†ï¼‰
         â†’ æ—‹è½‰çš„å†°ç³»é£›é¢/æ‰‹è£åŠé€ å‹ï¼Œ
           å‘¼æ‡‰æŠ€èƒ½åè£¡çš„ã€Œæ—‹ã€
       frostCrushï¼ˆå†°å°é‡æ“Šï¼Œå–®é«”å¤§å‚·å®³ï¼‰
         â†’ å†°è£½æˆ°éšé‡é‡ç ¸ä¸‹ï¼Œå°æ‡‰
           æŠ€èƒ½åè£¡çš„ã€Œé‡æ“Šã€
       waterBallï¼ˆæ°´çƒè¡“ï¼Œä¸‰äººæ³•è¡“ï¼‰
         â†’ ä¸€é¡†æ¼©æ¸¦ç‹€æ°´çƒï¼Œç›´æ¥å°æ‡‰
           æŠ€èƒ½åã€Œæ°´çƒã€
       floodBeastï¼ˆæ´ªæ°´çŒ›ç¸ï¼Œå–®é«”æ³•è¡“ï¼‰
         â†’ å·¨å¤§çš„æ°´ç³»æ€ªç¸å’†å“®ï¼Œç›´æ¥å°æ‡‰
           æŠ€èƒ½åã€ŒçŒ›ç¸ã€
       freezeï¼ˆå†°å°ï¼Œç´”æ§å ´ç„¡å‚·å®³ï¼‰
         â†’ å†°æ™¶å°–åˆºå¾å–®ä¸€åœ°é»çˆ†ç™¼è€Œå‡ºï¼Œ
           å‘¼æ‡‰ã€Œå†°å°ã€å›°ä½ç›®æ¨™çš„ç•«é¢
       reviveï¼ˆå¾©æ´»è¡“ï¼Œå¾©æ´»å‹æ–¹ï¼‰
         â†’ æ„›å¿ƒ+åå­—+äººå½¢å‰ªå½±ï¼Œç›´æ¥å°æ‡‰
           ã€Œå¾©æ´»ã€çš„é‡ç”Ÿæ„è±¡
       healSpellï¼ˆæ²»ç™‚è¡“ï¼Œæ¢å¾©HP/SPï¼‰
         â†’ é›™æ‰‹æ§è‘—ç¶ é‡‘è‰²å…‰èŠ’ï¼Œä»£è¡¨
           æ²»ç™‚çš„æº«æš–æ„Ÿè¦º
       waterEXï¼ˆæ°´å…ƒç´ EXï¼Œè¢«å‹•ï¼‰
         â†’ åœ–ç‰‡æœ¬èº«å¯«è‘—ã€ŒEXã€å­—æ¨£

       å¦å¤–ä½¿ç”¨è€…é€™æ¬¡ä¸Šå‚³äº†11å¼µåœ–ï¼Œ
       ä½†æ°´ç³»åªæœ‰10å€‹æŠ€èƒ½ï¼Œå…¶ä¸­ä¸€å¼µ
       ï¼ˆæˆç‰‡å†°ç®­å¾å¤©è€Œé™çš„ç•«é¢ï¼‰ç›®å‰
       æ²’æœ‰å°æ‡‰çš„æŠ€èƒ½å¯ä»¥æ”¾ï¼Œå…ˆæ²’æœ‰
       ä½¿ç”¨ï¼Œå¦‚æœä¹‹å¾Œæ°´ç³»æ–°å¢æŠ€èƒ½
       ï¼ˆä¾‹å¦‚ç¾¤é«”æ”»æ“ŠæŠ€ï¼‰å¯ä»¥å†ç”¨ä¸Šã€‚
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
    purifyMind:"assets/skills/water-purify-mind.webp",
    floodBeast:"assets/skills/water-flood-beast.jpg",

    /*
       â˜… æ–°å¢ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œã€Œæ°´å…ƒç´ 
       11æ‹›ã€æ–°å¢çš„å†°éœœç®­é›¨æŠ€èƒ½ï¼‰ï¼š
       iceArrowRainï¼ˆå†°éœœç®­é›¨ï¼Œå…¨é«”æ³•è¡“ï¼‰
         â†’ æˆç‰‡å†°ç®­å¾å¤©è€Œé™ï¼Œç›´æ¥å°æ‡‰
           ã€Œç®­é›¨ã€é€™å€‹æŠ€èƒ½åï¼Œé€™å¼µåœ–
           ä¸Šæ¬¡ä¸Šå‚³æ°´ç³»iconæ™‚å°±æœ‰çµ¦ï¼Œ
           ç•¶æ™‚æ°´ç³»åªæœ‰10æ‹›æ²’æœ‰ä½ç½®æ”¾ï¼Œ
           é€™æ¬¡å‰›å¥½ç”¨ä¸Š
    */

    iceArrowRain:"assets/skills/water-ice-arrow-rain.jpg",

    /* V173.22ï¼šè£œä¸Šç‹‚é¢¨è¡“ï¼›åˆ†èº«è¡“åœ–å°æ‡‰é–ƒèº²è¡“ã€‚ */
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
       â˜… æ–°å¢ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼ŒåœŸç³»æŠ€èƒ½iconï¼‰ï¼š
       é€™æ¬¡ä½¿ç”¨è€…ä¸Šå‚³äº†15å¼µåœ–ï¼Œå…¶ä¸­4å¼µæ˜¯ç”·è§’Qç‰ˆå·¡æ€ªèƒŒé¢ç«‹ç¹ª
       ï¼ˆä¸æ˜¯æŠ€èƒ½iconï¼Œå¦å¤–è™•ç†ï¼‰ï¼Œå‰©ä¸‹11å¼µæ˜¯æŠ€èƒ½iconå€™é¸ã€‚
       åœŸç³»ç¸½å…±12å€‹æŠ€èƒ½ï¼Œé€å¼µæ¯”å°åç¨±/æŠ€èƒ½æè¿°å¾Œé…å°ï¼š

       â˜… ä¿®æ­£ï¼ˆ2026-08-25ï¼Œä½¿ç”¨è€…æä¾›å¸¶åç¨±æ¨™ç±¤çš„åƒè€ƒåœ–é‡æ–°æ ¸å°ï¼‰ï¼š
       ä½¿ç”¨è€…æŠŠ8å¼µå€™é¸åœ–å„è‡ªæ¨™ä¸Šæ­£ç¢ºçš„æŠ€èƒ½åç¨±å‚³å›ä¾†ï¼Œ
       ç”¨åƒç´ æ¯”å°ï¼ˆä¸æ˜¯è‚‰çœ¼çŒœï¼‰ç¢ºèªæ¯å¼µæ¨™ç±¤åœ–å°æ‡‰åˆ°
       åŸå§‹å€™é¸åœ–è£¡çš„å“ªä¸€å¼µï¼ŒæŠ“å‡ºå¯¦éš›é…éŒ¯çš„4å€‹ï¼Œ
       ä¸¦è£œä¸Šä¸€å¼µå…¨æ–°çš„earthEXå°ˆç”¨åœ–ï¼ˆåœ–ä¸Šç›´æ¥å¯«è‘—
       ã€ŒEXã€å­—æ¨£ï¼Œè·Ÿfire-ex.jpgï¼water-ex.jpgåŒæ¬¾å¼ï¼‰ï¼š

       petrifyFistï¼ˆçŸ³ç›¾æ‹³ï¼Œç‰©ç†ï¼Œé€ æˆå‚·å®³+å…¨é«”è­·ç›¾ï¼‰
         â†’ æ‹³é ­å‡ºæ“Šã€èº«å¾Œæœ‰å²©çŸ³è­·ç›¾å…‰ç’°çš„ç•«é¢ã€‚åŸæœ¬é…å°æ­£ç¢ºï¼Œ
           æ²’æœ‰è®Šå‹•ã€‚
       stoneBreakSkyï¼ˆçŸ³ç ´å¤©é©šï¼Œç‰©ç†ï¼Œå–®é«”å¤§å‚·å®³+è­·ç›¾ï¼‰
         â†’ å·¨å¤§å²©çŸ³è£‚é–‹ã€å…‰èŠ’ç‚¸é–‹çš„ç•«é¢ï¼ˆå¸¶æ¼©æ¸¦å…‰ç’°é‚£å¼µï¼‰ã€‚
           â˜…åŸæœ¬èª¤é…åˆ°ã€ŒåœŸçŸ³æ–¬ã€ç”¨çš„é‚£å¼µåœ–ï¼Œé€™æ¬¡ä¿®æ­£ã€‚
       earthquakeCrushï¼ˆåœ°è£‚é‡æ‹³ï¼Œç‰©ç†ï¼Œä¸‰äººå‚·å®³+è‡ªèº«è­·ç›¾ï¼‰
         â†’ å·¨å¤§æ‹³é ­å½¢å²©å±¤è£‚é–‹ã€é‡‘å…‰å››å°„çš„ç•«é¢ã€‚
           â˜…åŸæœ¬èª¤é…åˆ°ã€Œé£›æ²™ç¬æ“Šã€ç”¨çš„é‚£å¼µåœ–ï¼Œé€™æ¬¡ä¿®æ­£ã€‚
       stoneThrowï¼ˆè½çŸ³è¡“ï¼Œæ³•è¡“ï¼Œä¸‰äººå‚·å®³+é™é˜²ï¼‰
         â†’ å·¨çŸ³å¾å¤©è€Œé™çš„ç•«é¢ï¼Œç›´æ¥å°æ‡‰ã€Œè½çŸ³ã€ã€‚åŸæœ¬é…å°
           æ­£ç¢ºï¼Œæ²’æœ‰è®Šå‹•ã€‚
       sandWindï¼ˆæ»¾çŸ³è¡“ï¼Œæ³•è¡“ï¼Œæ©«æ’å‚·å®³+é™é˜²ï¼‰
         â†’ å·¨çŸ³æ»¾å‹•ã€æ‹–å‡ºå…‰è·¡çš„ç•«é¢ï¼Œå°æ‡‰ã€Œæ»¾çŸ³ã€ã€‚
           â˜…åŸæœ¬èª¤é…åˆ°ã€Œé£›æ²™ç¬æ“Šã€ç”¨çš„é‚£å¼µåœ–ï¼Œé€™æ¬¡ä¿®æ­£ã€‚
       flyingSandStrikeï¼ˆé£›æ²™ç¬æ“Šï¼Œæ³•è¡“ï¼Œå…¨é«”å‚·å®³+æ©Ÿç‡çŸ³åŒ–ï¼‰
         â†’ é‡‘è‰²æ²™å¡µ/èƒ½é‡æ¼©æ¸¦ç•«é¢ï¼Œå°æ‡‰ã€Œé£›æ²™ã€ã€‚
           â˜…åŸæœ¬èª¤é…åˆ°ã€Œæ»¾çŸ³è¡“ã€ç”¨çš„é‚£å¼µåœ–ï¼Œé€™æ¬¡ä¿®æ­£ã€‚
       dustStormï¼ˆåœ°ç‰›çŒ›è¥²ï¼Œæ³•è¡“ï¼Œå…¨é«”å‚·å®³+é™é˜²ï¼‰
         â†’ å²©çŸ³å·¨ç‰›è¡é‹’çš„ç•«é¢ï¼Œç›´æ¥å°æ‡‰ã€Œåœ°ç‰›ã€ã€‚åŸæœ¬é…å°
           æ­£ç¢ºï¼Œæ²’æœ‰è®Šå‹•ã€‚
       rockWallï¼ˆå²©çŸ³å£å£˜ï¼Œå¢ç›Šï¼Œå…¨é«”é˜²ç¦¦æå‡ï¼‰
         â†’ ä¸€æ•´æ’å²©çŸ³å°–å¡”ä¸¦åˆ—çš„ç•«é¢ï¼Œç›´æ¥å°æ‡‰ã€Œå£å£˜ã€ã€‚åŸæœ¬
           é…å°æ­£ç¢ºï¼Œæ²’æœ‰è®Šå‹•ã€‚
       barrierï¼ˆçµç•Œï¼Œå¢ç›Šï¼Œå–®é«”å®Œå…¨é˜²è­·ï¼‰
         â†’ ç™¼å…‰çš„é­”æ³•é™£åœ“é ‚çµç•Œç•«é¢ï¼Œç›´æ¥å°æ‡‰ã€Œçµç•Œã€ã€‚åŸæœ¬
           é…å°æ­£ç¢ºï¼Œæ²’æœ‰è®Šå‹•ã€‚
       stoneSlashï¼ˆåœŸçŸ³æ–¬ï¼Œå…¥é–€å–®é«”ç‰©ç†æŠ€èƒ½ï¼‰
         â†’ ä½¿ç”¨è€…æ¨™æ˜æ˜¯ã€Œå²©çŸ³è£‚é–‹ã€å…‰æŸæ–œåŠˆã€é‚£å¼µåœ–
           ï¼ˆåŸæœ¬èª¤é…åˆ°ã€Œåœ°è£‚é‡æ‹³ã€ï¼Œç¾åœ¨è£œå›æ­£ç¢ºä½ç½®ï¼‰ã€‚
       earthEXï¼ˆåœŸå…ƒç´ EXï¼Œè¢«å‹•ï¼‰
         â†’ ä½¿ç”¨è€…æ–°æä¾›çš„å°ˆç”¨ã€ŒEXã€å­—æ¨£åœ–ï¼Œè·Ÿ
           fire-ex.jpgï¼water-ex.jpgåŒæ¬¾å¼ã€‚

       â˜… earthShieldï¼ˆè¬è±¡åœŸç›¾ï¼Œå¢ç›Šï¼Œå–®é«”åå‚·è­·ç›¾ï¼‰
       ä½¿ç”¨è€…é‡æ–°æä¾›ä¸¦æ¨™æ˜ã€Œè¬è±¡åœŸç›¾ã€å°ˆç”¨åœ–ï¼ˆé‡‘è‰²åœŸç›¾æ­£é¢
       ç‰¹å¯«ï¼‰ï¼Œè£œå›é€™å€‹keyã€‚
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
   â˜… æ–°å¢ï¼šå–å¾—æŠ€èƒ½iconçš„CSSèƒŒæ™¯åœ–ç‰‡å­—ä¸²ï¼Œ
   ç›®å‰åªæœ‰ç«ç³»10å€‹æŠ€èƒ½æœ‰åœ–ï¼Œå…¶ä»–å…ƒç´ 
   ï¼ˆæ°´/é¢¨/åœŸï¼‰é‚„æ²’æœ‰iconï¼Œé€™è£¡çµ±ä¸€åš
   nullä¿è­·ï¼Œæ²’æœ‰å°æ‡‰åœ–ç‰‡å°±å›å‚³ç©ºå­—ä¸²ï¼Œ
   è®“é‚£æ ¼iconæ¡†ä¿æŒåŸæœ¬çš„ç©ºç™½æ¨£å¼ï¼Œ
   ä¸æœƒå› ç‚ºæ‰¾ä¸åˆ°åœ–è€Œå ±éŒ¯ã€‚
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
   â˜… æ–°å¢ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œã€Œå‰ç½®æŠ€èƒ½è¦
   å­¸å¾—æ©Ÿåˆ¶ã€ï¼Œç›®å‰åªå¥—ç”¨åœ¨ç«/æ°´å…©ç³»ï¼Œ
   é¢¨/åœŸç³»skillDatabaseé‚„æ²’æœ‰requires
   æ¬„ä½ï¼Œä¹‹å¾Œè¦åšå†è£œï¼‰ï¼š

   æ¯å€‹æŠ€èƒ½å¯ä»¥æœ‰ä¸€å€‹requiresé™£åˆ—ï¼Œè£¡é¢
   æ”¾ã€Œéœ€è¦å“ªäº›æŠ€èƒ½idã€ï¼Œè¦å‰‡çµ±ä¸€æ˜¯
   ã€ŒORã€ï¼ˆä»»ä¸€ï¼‰é—œä¿‚â€”â€”é™£åˆ—è£¡åªè¦æœ‰
   ä»»ä½•ä¸€å€‹æŠ€èƒ½ç­‰ç´š>0ï¼Œå‰ç½®å°±ç®—é€šéã€‚
   å–®ä¸€å‰ç½®ç›´æ¥å¯«æˆé•·åº¦1çš„é™£åˆ—å³å¯
   ï¼ˆ['flameSlash']é€™ç¨®ï¼‰ï¼Œæ•ˆæœç­‰åŒ
   ã€Œä¸€å®šè¦å­¸é€™å€‹ã€ï¼›æ²’æœ‰requiresæ¬„ä½
   æˆ–ç©ºé™£åˆ—ï¼Œä»£è¡¨æ²’æœ‰å‰ç½®é™åˆ¶ã€‚

   ä¹‹æ‰€ä»¥çµ±ä¸€ç”¨ORã€ä¸ç‰¹åˆ¥æ”¯æ´ANDï¼Œæ˜¯å› ç‚º
   ä½¿ç”¨è€…æä¾›çš„æŠ€èƒ½è¡¨è£¡ï¼Œæ‰€æœ‰å¤šé‡å‰ç½®
   çš„æ¡ˆä¾‹ï¼ˆä¾‹å¦‚ã€Œç«çˆ†äº‚æ“Šæˆ–çƒˆç„°é¾æ²å…¶ä¸€ã€ï¼‰
   å…¨éƒ¨éƒ½æ˜¯ã€ŒäºŒé¸ä¸€ã€ï¼Œæ²’æœ‰ã€Œå…©å€‹éƒ½è¦ã€
   çš„æ¡ˆä¾‹ï¼Œç”¨ä¸€ç¨®æ ¼å¼å°±å¤ ã€‚
*/

const characterSkillLoadouts = {

    fire:{
        name:"ç«æ³•å¸«",
        /*
           â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼‰ï¼š
           ä¹‹å‰é€™è£¡æ•…æ„è®“æ–°è§’è‰²é è¨­å…ˆå­¸æœƒ
           ç«ç„°æ–¬1ç´šï¼Œç†ç”±æ˜¯ã€Œä¸æƒ³è¦æŠ€èƒ½æ¬„
           ç©ºç©ºçš„ã€ã€‚ä½†ä½¿ç”¨è€…ç¾åœ¨æ˜ç¢ºè¡¨ç¤º
           ä¸å¸Œæœ›å‰µè§’æ™‚è‡ªå‹•å¹«ä»–é¸æŠ€èƒ½ï¼Œ
           è¦è‡ªå·±æ±ºå®šå­¸ä»€éº¼â€”â€”æ”¹æˆå®Œå…¨ç©ºç™½ï¼Œ
           ä¸å†è‡ªå‹•å¡ä»»ä½•æŠ€èƒ½é€²å»ã€‚
        */
        skillLevels:{},
        equippedSkills:[]
    },

    water:{
        name:"æ°´æˆ°å£«",
        skillLevels:{},
        equippedSkills:[]
    },

    wind:{
        name:"é¢¨å¼“æ‰‹",
        skillLevels:{},
        equippedSkills:[]
    },

    earth:{
        name:"åœŸé¨å£«",
        skillLevels:{},
        equippedSkills:[]
    }

};


/* =====================================================   è§’è‰²
===================================================== */

const characters = [

    {
        id:"fire",
        name:"ç«æ³•å¸«"
    },

    {
        id:"water",
        name:"æ°´æˆ°å£«"
    },

    {
        id:"wind",
        name:"é¢¨å¼“æ‰‹"
    }

];


let inventoryCharacterIndex = 0;


/* =====================================================
   èƒŒåŒ…
===================================================== */

const inventoryItems = [

    {
        id:"ironSword",
        name:"éµåŠ",
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
        name:"æœ¨æ³•æ–",
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
        name:"çš®å¸½",
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
        name:"çš®ç”²",
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
        name:"çš®é‹",
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
        name:"å›å¾©10%HPè—¥æ°´",
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
        name:"å›å¾©10%SPè—¥æ°´",
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
   æˆ°é¬¥ç‹€æ…‹
===================================================== */

let battleActive=false;

let battleToken=0;

let selectedMonster=null;

/*
   â˜… æ–°å¢ï¼šé€™å ´æˆ°é¬¥å¯¦éš›æ²å…¥çš„æ€ªç‰©ã€ŒåŸå§‹é™£åˆ—ç´¢å¼•ã€æ¸…å–®ã€‚
   éš¨æ©Ÿ1~3éš»ï¼Œä¸å†æ˜¯æ¯å ´éƒ½å›ºå®šæŠŠæ•´æ‰¹æ€ªéƒ½æ‹–é€²ä¾†æ‰“ã€‚
   å…¶ä»–å‡½å¼ï¼ˆæ¸²æŸ“ã€ç›®æ¨™é¸æ“‡ã€å›åˆã€çµç®—ï¼‰
   éƒ½æ”¹æˆåªèªé€™å€‹æ¸…å–®è£¡çš„æ€ªç‰©ï¼Œ
   ä¸åœ¨æ¸…å–®å…§çš„æ€ªç‰©ç¹¼çºŒç•™åœ¨åœ°åœ–ä¸Šï¼Œä¸æœƒè¢«æ‰“ã€‚
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

function battleDurationNumber(value){
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
        catch(error){ console.error("æŒçºŒå¢ç›Šåˆ°æœŸè™•ç†å™¨å¤±æ•—ï¼š",error); }
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
        addBattleLog("â³"+(buff.statusName||buff.type)+"æ•ˆæœå·²çµæŸã€‚");
    }
}
function expireBattleActionStatus(entity,effect){
    if(!entity||!effect||!Array.isArray(entity.statusEffects)){ return; }
    effect.turnsLeft=Math.max(0,battleDurationNumber(effect.turnsLeft)-1);
    if(effect.turnsLeft>0){ return; }
    entity.statusEffects=entity.statusEffects.filter(item=>item!==effect);
    if(typeof addBattleLog==="function"){
        const name=effect.type==="freeze"?"å†°å°":effect.type==="petrify"?"çŸ³åŒ–":effect.type==="frostbite"?"å‡å‚·":effect.type;
        addBattleLog((entity.id||entity.name||"ç›®æ¨™")+"çš„"+name+"æ•ˆæœå·²è§£é™¤ã€‚");
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
            battlePresentationLocks.add(lock);
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

    prompt.textContent="ç¬¬ "+Math.max(1,Math.floor(Number(turn)||1))+" å›åˆ";
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
    const identity=String(character.id||("è§’è‰²"+(characterIndex+1)));
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

    const sourceId=entry.type==="player"&&typeof owner.getCombatantIdByBattleIndex==="function"
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
        catch(error){ console.error("æˆ°é¬¥è¡Œå‹•å®Œæˆè§€å¯Ÿå™¨å¤±æ•—ï¼š",error); }
    });
}
function interceptBattleActionFinish(){
    for(let index=battleActionFinishInterceptors.length-1;index>=0;index--){
        try{
            if(battleActionFinishInterceptors[index]()===true){ return true; }
        }catch(error){
            console.error("æˆ°é¬¥è¡Œå‹•å®Œæˆæ””æˆªå™¨å¤±æ•—ï¼š",error);
        }
    }
    return false;
}
function notifyBeforeCombatant(token){
    const event={token:token,turn:turn,index:initiativeIndex,queue:initiativeQueue};
    beginBattleDurationAction(event);
    battleBeforeCombatantObservers.forEach(observer=>{
        try{ observer(event); }
        catch(error){ console.error("æˆ°é¬¥ä½‡åˆ—è§€å¯Ÿå™¨å¤±æ•—ï¼š",error); }
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
        catch(error){ console.error("æˆ°é¬¥å›åˆé‚Šç•Œè§€å¯Ÿå™¨å¤±æ•—ï¼š",error); }
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

function armBattleActionWatchdog(token,index){
    clearBattleActionWatchdog();
    battleActionWatchdogTimeoutId=setTimeout(()=>{
        battleActionWatchdogTimeoutId=null;
        if(!battleActive||token!==battleToken||index!==initiativeIndex||battleAdvanceScheduled){ return; }
        console.error("æˆ°é¬¥è¡Œå‹•è¶…éå®‰å…¨æœŸé™ï¼Œå·²é‡‹æ”¾æµç¨‹é–˜é–€ã€‚",{token:token,initiativeIndex:index});
        addBattleLog("æœ¬æ¬¡è¡Œå‹•æœªæ­£å¸¸å›æ”¶ï¼Œå·²ç”±å®‰å…¨é–˜é–€å¼·åˆ¶ç¹¼çºŒã€‚");
        const director=typeof window!=="undefined"?window.v142SkillAnimationDirector:null;
        const gate=director&&typeof director.getActive==="function"?director.getActive():null;
        if(gate&&!gate.done&&typeof gate.complete==="function"){ gate.complete("combat-action-watchdog"); }
        finishPlayerAction();
    },BATTLE_ACTION_WATCHDOG_MS);
}

let monsterMoveId=null;

let respawnId=null;

/*
   â˜… æ–°å¢ï¼šç›®å‰è¼ªåˆ°èª°æ‰‹å‹•è¡Œå‹•
   ï¼ˆ0=ç¬¬ä¸€è§’è‰²ã€1=ç¬¬äºŒè§’è‰²ï¼‰ã€‚
   æ¯æ¬¡startTurn()é‡ç½®å›0ï¼Œ
   finishPlayerAction()çµæŸä¸€å€‹è§’è‰²çš„è¡Œå‹•å¾Œ
   å¾€å¾Œæ¨ä¸€æ ¼ï¼Œç›´åˆ°æ´»è‘—çš„è§’è‰²éƒ½è¡Œå‹•éï¼Œ
   æ‰æœƒé€²å…¥æ€ªç‰©å›åˆã€‚
*/

let activeBattleCharacterIndex=0;

/*
   â˜… æ–°å¢ï¼ˆçœŸæ­£æŠ“åˆ°ã€Œå®£å‘Šéšæ®µè¢«é‡è¤‡è™•ç†ã€
   çš„æ ¹æºä¹‹å¾Œè£œä¸Šçš„é˜²è­·ï¼‰ï¼š

   æ‰‹æ©Ÿç€è¦½å™¨èƒŒæ™¯åŸ·è¡Œæ™‚ï¼ŒsetTimeoutä¸ä¿è­‰
   æº–æ™‚è§¸ç™¼ï¼Œå¯èƒ½è¢«ç³»çµ±å»¶å¾Œã€ä¹‹å¾Œåˆè·Ÿå…¶ä»–
   è¨ˆæ™‚å™¨ã€Œä¸€æ¬¡è£œç™¼ã€ï¼Œå°è‡´beginCharacterTurn()
   è¢«åŒä¸€å€‹activeBattleCharacterIndexå€¼
   å‘¼å«å…©æ¬¡â€”â€”é€™ä¸æ˜¯ç¨‹å¼é‚è¼¯å¯«éŒ¯ï¼Œæ˜¯è¨ˆæ™‚å™¨
   æœ¬èº«ä¸å¯é ï¼Œå…‰é battleToken/tokenæ¯”å°
   æ“‹ä¸ä½ï¼ˆåŒä¸€å ´æˆ°é¬¥ã€tokenæ²’è®Šï¼Œåªæ˜¯
   åŒä¸€å€‹å®£å‘Šæ­¥é©Ÿè¢«è§¸ç™¼äº†å…©æ¬¡ï¼‰ã€‚

   ç”¨é€™å€‹Setè¨˜éŒ„ã€Œé€™å€‹å¤§å›åˆè£¡ï¼Œå“ªäº›
   activeBattleCharacterIndexå·²ç¶“çœŸæ­£
   å®£å‘Šéã€ï¼ŒbeginCharacterTurn()ä¸€é–‹å§‹
   å¦‚æœç™¼ç¾ç•¶ä¸‹é€™å€‹ç´¢å¼•å·²ç¶“åœ¨æ¸…å–®è£¡ï¼Œ
   ä»£è¡¨æ˜¯é‡è¤‡/å»¶é²è£œç™¼çš„å‘¼å«ï¼Œç›´æ¥è·³éã€
   ä¸åšä»»ä½•äº‹ï¼Œä¸æœƒè®“è§’è‰²ç´¢å¼•è¢«å¤šæ¨é€²ã€
   ä¸æœƒè®“è‡ªå‹•åˆ¤æ–·å‡½å¼è¢«é‡è¤‡å‘¼å«ã€‚
   æ¯æ¬¡startTurn()é–‹æ–°çš„å¤§å›åˆæ™‚æ¸…ç©ºã€‚
*/

let declaredCharacterIndexes=
    new Set();

/*
   â˜… æ–°å¢ï¼ˆçœŸæ­£è£œä¸Šå‰©ä¸‹é‚£å€‹æ¼æ´ï¼‰ï¼š
   declaredCharacterIndexesåªæ“‹å¾—ä½
   ã€ŒåŒä¸€å€‹è§’è‰²è¢«é‡è¤‡å®£å‘Šã€ï¼Œæ²’æ“‹åˆ°
   ã€Œå®£å‘Šéšæ®µçµæŸã€è¦è·³é€²çµç®—éšæ®µã€é€™å€‹
   è½‰æ›é»æœ¬èº«è¢«é‡è¤‡è§¸ç™¼â€”â€”beginCharacterTurn()
   åœ¨activeBattleCharacterIndexè¶…å‡ºéšŠä¼
   é•·åº¦æ™‚æœƒå‘¼å«startResolutionPhase()ï¼Œ
   ä½†é€™å€‹è½‰æ›æ²’æœ‰è¢«è¨˜éŒ„é€²é˜²é‡è¤‡æ¸…å–®ï¼Œ
   åªè¦é€™æ¬¡å‘¼å«å› ç‚ºæ‰‹æ©Ÿç€è¦½å™¨è¨ˆæ™‚å™¨å»¶é²/
   è£œç™¼è¢«å¤šè§¸ç™¼ä¸€æ¬¡ï¼Œå°±æœƒæŠŠinitiativeQueueã€
   initiativeIndexã€processedInitiativeIndexes
   å…¨éƒ¨é‡æ–°è“‹éå»ã€ç æ‰é‡ç·´ï¼Œç­‰æ–¼çµç®—éšæ®µ
   å¾é ­é‡æ–°é–‹å§‹ä¸€æ¬¡ï¼Œå·²ç¶“è™•ç†éçš„æ€ªç‰©/è§’è‰²
   è¡Œå‹•æœƒè¢«é‡è¤‡åŸ·è¡Œâ€”â€”é€™æ­£æ˜¯ã€ŒåŒä¸€éš»æ€ªç‰©
   ä¸€å€‹å›åˆæ”»æ“Šå…©æ¬¡ã€ã€Œé€£çºŒè·³å…©å€‹å›åˆã€
   çš„çœŸæ­£åŸå› ã€‚

   ç”¨é€™å€‹æ——æ¨™è¨˜éŒ„ã€Œé€™å€‹å¤§å›åˆçš„çµç®—éšæ®µ
   æ˜¯ä¸æ˜¯å·²ç¶“çœŸçš„é–‹å§‹éäº†ã€ï¼Œ
   startResolutionPhase()ä¸€é–‹å§‹å¦‚æœç™¼ç¾
   å·²ç¶“é–‹å§‹éï¼Œä»£è¡¨æ˜¯é‡è¤‡/å»¶é²è£œç™¼çš„å‘¼å«ï¼Œ
   ç›´æ¥è·³éã€ä¸æœƒé‡å»ºä½‡åˆ—ã€‚
   æ¯æ¬¡startTurn()é–‹æ–°çš„å¤§å›åˆæ™‚é‡ç½®ç‚ºfalseã€‚
*/

let resolutionPhaseStarted=
    false;

/*
   â˜… æ–°å¢ï¼ˆçœŸæ­£è£œä¸Šæœ€å¾Œä¸€å€‹æ¼æ´ï¼‰ï¼š
   è·ŸresolutionPhaseStartedåŒæ¨£çš„é“ç†ï¼Œ
   processNextCombatant()è£¡ã€Œé€™å€‹å¤§å›åˆ
   çµç®—å®Œç•¢ã€è¦è·³åˆ°ä¸‹ä¸€å€‹å¤§å›åˆã€çš„åˆ†æ”¯
   ï¼ˆinitiativeIndex>=initiativeQueue.length
   æ™‚turn++; startTurn(token)ï¼‰å®Œå…¨æ²’æœ‰
   é˜²é‡è¤‡ä¿è­·â€”â€”é€™å€‹åˆ†æ”¯æœ¬èº«ä¸å±¬æ–¼ä»»ä½•
   ä¸€å€‹ã€Œå·²è™•ç†çš„initiativeIndexã€ï¼Œ
   processedInitiativeIndexesé‚£å€‹Set
   æ“‹ä¸åˆ°å®ƒã€‚åªè¦é€™æ¬¡å‘¼å«å› ç‚ºæ‰‹æ©Ÿç€è¦½å™¨
   è¨ˆæ™‚å™¨å»¶é²/è£œç™¼è¢«å¤šè§¸ç™¼ä¸€æ¬¡ï¼Œå°±æœƒ
   turn++å…©æ¬¡ã€startTurn()è¢«å‘¼å«å…©æ¬¡ï¼Œ
   ç•«é¢ä¸Šæœƒçœ‹åˆ°ã€Œç¬¬8å›åˆï¼Œé–‹å§‹ï¼
   ç¬¬9å›åˆï¼Œé–‹å§‹ï¼ã€é€™ç¨®é€£çºŒè·³å…©è¼ªã€
   ä¸­é–“å®Œå…¨æ²’æœ‰ä»»ä½•è§’è‰²/æ€ªç‰©è¡Œå‹•çš„æƒ…æ³ã€‚

   ç”¨é€™å€‹æ——æ¨™è¨˜éŒ„ã€Œé€™å€‹å¤§å›åˆæ˜¯ä¸æ˜¯å·²ç¶“
   çœŸçš„è§¸ç™¼éã€è·³åˆ°ä¸‹ä¸€è¼ªã€ã€ï¼Œé‡è¤‡å‘¼å«
   ç›´æ¥æ“‹ä¸‹ã€‚æ¯æ¬¡startTurn()çœŸæ­£é–‹å§‹
   æ–°çš„ä¸€è¼ªæ™‚é‡ç½®ç‚ºfalseã€‚
*/

let turnAdvancePending=
    false;

/*
   â˜… æ–°å¢ï¼ˆé‡æ–°è¨­è¨ˆå›åˆåˆ¶ï¼‰ï¼š
   ä½¿ç”¨è€…æ˜ç¢ºæŒ‡å‡ºï¼šæ­£ç¢ºçš„å›åˆåˆ¶æ‡‰è©²æ˜¯
   ã€Œé›™æ–¹å…ˆå„è‡ªè¨­å®šå¥½é€™å›åˆè¦åšä»€éº¼ï¼Œ
   å…¨éƒ¨è¨­å®šå®Œï¼Œæ‰ä¾æ•æ·é«˜ä½é–‹å§‹åŸ·è¡Œã€ï¼Œ
   ä¸æ˜¯ã€Œèª°å¿«èª°å…ˆåšï¼Œå…¶ä»–äººé€£é¸éƒ½é‚„æ²’é¸ã€ã€‚

   battlePhaseç´€éŒ„ç›®å‰é€™å€‹å¤§å›åˆèµ°åˆ°å“ªå€‹éšæ®µï¼š
   "declare" = å®£å‘Šéšæ®µï¼Œç©å®¶è§’è‰²ä¾åºé¸å¥½
   é€™å›åˆè¦åšä»€éº¼ï¼ˆæ™®é€šæ”»æ“Š/æŠ€èƒ½ï¼Œå«é¸ç›®æ¨™ï¼‰ï¼Œ
   é¸å®Œå…ˆã€Œè¨˜ä½ã€ï¼Œä¸æœƒé¦¬ä¸Šå‡ºæ‰‹ã€‚

   "resolve" = çµç®—éšæ®µï¼ŒæŠŠæ‰€æœ‰å·²å®£å‘Šçš„ç©å®¶è¡Œå‹•
   è·Ÿæ€ªç‰©æ··åœ¨ä¸€èµ·ï¼Œä¾æ•æ·é«˜ä½æ’åºï¼Œ
   ä¸€å€‹ä¸€å€‹çœŸæ­£åŸ·è¡Œã€æ‰£è¡€ã€‚

   åªæœ‰ã€Œæ™®é€šæ”»æ“Šã€ã€Œå‚·å®³æŠ€èƒ½ã€é€™ç¨®æœƒå½±éŸ¿åˆ°æ€ªç‰©ã€
   è·Ÿæ€ªç‰©å‡ºæ‰‹é †åºæœ‰æ„ç¾©é—œè¯çš„è¡Œå‹•éœ€è¦é€²åˆ°å®£å‘Š/çµç®—
   å…©éšæ®µï¼›é˜²ç¦¦ã€ç‰©å“ã€å¢ç›Šã€æ²»ç™‚é€™é¡ä¸ç‰½æ¶‰
   è·Ÿæ€ªç‰©æ¯”å¿«æ…¢çš„è¡Œå‹•ï¼Œç¶­æŒåŸæœ¬ã€Œé¸äº†å°±ç«‹åˆ»ç”Ÿæ•ˆã€ï¼Œ
   ä¸éœ€è¦é¡å¤–ç­‰å¾…ï¼Œé€™æ¨£æ‰ä¸æœƒè®“é˜²ç¦¦é€™ç¨®
   ã€Œé¦¬ä¸Šå°±è¦ç”Ÿæ•ˆã€çš„å‹•ä½œä¹Ÿè¢«è¿«å»¶é²ã€‚
*/

let battlePhase="declare";

let queuedPlayerActions={};

let mapCooldown=false;

/*
   â˜… è‡ªå‹•å·¡æ€ªé˜²å¡æ­»ï¼š
   mapCooldown åªä»£è¡¨ã€Œæš«æ™‚ç¦æ­¢é–‹æˆ°ã€ï¼Œ
   ä¸æ‡‰è©²ç›´æ¥ç­‰åŒæ–¼ã€Œåœæ­¢è‡ªå‹•å·¡æ€ªã€ã€‚
   å¦å¤–ä¿ç•™ timeout handleï¼Œè®“æˆ‘å€‘å¯ä»¥åˆ¤æ–·
   cooldown æ˜¯å¦çœŸçš„æœ‰ä¸€å€‹è§£é™¤æ’ç¨‹ã€‚
*/
let mapCooldownTimeoutId=null;

let autoBattle=false;

let actionReady=false;

let pendingAction=null;

/*
   â˜… æ–°å¢ï¼ˆä¿®æ­£è¨­å®šé¢æ¿åˆ‡æ›è§’è‰²æœƒéºå¤±æœªå„²å­˜è®Šæ›´çš„bugï¼‰ï¼š
   è¨˜éŒ„è¨­å®šé¢æ¿ç›®å‰é¡¯ç¤ºçš„æ˜¯ã€Œå“ªå€‹è§’è‰²ã€çš„è³‡æ–™ï¼Œ
   æ¯æ¬¡åˆ‡æ›è§’è‰²ä¹‹å‰ï¼Œå…ˆæŠŠç›®å‰ç•«é¢ä¸Šçš„å€¼
   å­˜å›é€™å€‹è§’è‰²èº«ä¸Šï¼Œå†æ›é¡¯ç¤ºæ–°è§’è‰²çš„è³‡æ–™ï¼Œ
   é€™æ¨£ä½¿ç”¨è€…å¯ä»¥è‡ªç”±åˆ‡æ›Aã€Bå…©å€‹è§’è‰²èª¿æ•´ï¼Œ
   æœ€å¾Œçµ±ä¸€æŒ‰ä¸€æ¬¡ç¢ºå®šå°±å¥½ï¼Œä¸ç”¨æ¯æ›ä¸€å€‹è§’è‰²
   å°±è¦å…ˆæŒ‰ä¸€æ¬¡ç¢ºå®šï¼Œä¸ç„¶åˆ‡æ›é‚£ä¸€åˆ»
   é‚„æ²’å„²å­˜çš„èª¿æ•´æœƒç›´æ¥æ¶ˆå¤±ã€‚
*/

let autoSettingsCurrentCharacter=0;


const autoConfig = {

    enabled:false,

    skill:"normal",

    hp:50,

    sp:25,

    /*
       â˜… æ–°å¢ï¼šæ²’è—¥æ°´çš„è©±è‡ªå‹•å›ä¸»åŸã€‚
       æˆ°é¬¥çµæŸã€å›åˆ°ç·´åŠŸå€åœ°åœ–ä¹‹å¾Œï¼Œ
       å¦‚æœåµæ¸¬åˆ°HP/SPè—¥æ°´éƒ½ç”¨å®Œäº†ï¼Œ
       è‡ªå‹•å¹«ç©å®¶å°å›ä¸»åŸï¼Œ
       ä¸ç”¨è‡ªå·±è¨˜å¾—è¦å›å»è£œè²¨ã€‚
    */

    returnToCityWhenEmpty:false

};


/*
   â˜… æ–°å¢ï¼šç¬¬äºŒè§’è‰²å°ˆå±¬çš„è‡ªå‹•æˆ°é¬¥è¨­å®šã€‚
   è·Ÿç¬¬ä¸€è§’è‰²çš„autoConfigçµæ§‹ä¸€æ¨£ï¼Œ
   ä½†å®Œå…¨ç¨ç«‹ï¼Œå› ç‚ºç¬¬äºŒè§’è‰²æ˜¯è‡ªå‹•ä½œæˆ°çš„éšŠå‹ï¼Œ
   ä¸€å®šè¦æœ‰è‡ªå·±çš„æŠ€èƒ½/HPé–€æª»/SPé–€æª»è¨­å®šï¼Œ
   ä¸èƒ½å…±ç”¨ç¬¬ä¸€è§’è‰²é‚£çµ„ï¼ˆæŠ€èƒ½éƒ½ä¸ä¸€æ¨£ï¼‰ã€‚
*/

/*
   â˜… ä¿®æ­£ï¼š
   ä¹‹å‰ç¬¬äºŒè§’è‰²æ°¸é è‡ªå‹•è¡Œå‹•ï¼Œæ²’æœ‰æ‰‹å‹•é¸é …ï¼Œ
   æ‰€ä»¥é€™è£¡åŸæœ¬æ²’æœ‰enabledæ¬„ä½ã€‚
   ç¾åœ¨ç¬¬äºŒè§’è‰²ä¹Ÿèƒ½æ‰‹å‹•æ“ä½œäº†ï¼Œ
   é è¨­enabled:falseï¼ˆæ‰‹å‹•ï¼‰ï¼Œ
   è·Ÿç¬¬ä¸€è§’è‰²çš„é è¨­è¡Œç‚ºä¸€è‡´ï¼Œ
   ç©å®¶å¯ä»¥è‡ªå·±é¸è¦æ‰‹å‹•æ§åˆ¶é‚„æ˜¯äº¤çµ¦AIæ‰“ã€‚
*/

const autoConfig2 = {

    enabled:false,

    skill:"normal",

    hp:50,

    sp:25,

    returnToCityWhenEmpty:false

};


/* ç¬¬ä¸‰è§’è‰²ä½¿ç”¨ç¨ç«‹çš„è‡ªå‹•æˆ°é¬¥ï¼æˆ°å¾Œè£œçµ¦è¨­å®šã€‚ */
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


/* V111ï¼šHPï¼SP è‡ªå‹•è£œçµ¦é–€æª»çµ±ä¸€ç‚º 25ï¼50ï¼75ï¼90ï¼100%ã€‚
   èˆŠå­˜æª”å¯èƒ½ä»ä¿å­˜ 20ã€30ã€40ã€60ã€70ã€80 ç­‰å€¼ï¼›
   è®€åˆ°èˆŠå€¼æ™‚å–æœ€æ¥è¿‘çš„æ–°é–€æª»ï¼Œé¿å…ä¸‹æ‹‰é¸å–®å‡ºç¾ç©ºç™½ã€‚ */
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
   â˜… ç‹€æ…‹é è§’è‰²åˆ‡æ›ï¼ˆæ–°å¢ï¼‰ã€‚
   0=ç¬¬ä¸€è§’è‰²ï¼ˆplayerï¼‰ï¼Œ1=ç¬¬äºŒè§’è‰²ï¼ˆplayer2ï¼‰ã€‚
   player2ä¸å­˜åœ¨æ™‚æ°¸é åœåœ¨0ï¼Œ
   åˆ‡æ›æŒ‰éˆ•æœƒè¢«æ“‹æ‰ã€‚
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
   V130 â€” ä¸‰è§’è‰²å…±ç”¨ç´¢å¼•ï¼æˆ°é¬¥è³‡æ–™
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
    return [0,1,2,3,4,5].filter(index=>!!getPartyCharacterByIndex(index));
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
   â˜… æ–°å¢ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œã€Œç©å®¶æˆ°é¬¥ç«‹ç¹ªèƒ½å¦å»èƒŒã€ï¼‰ï¼š
   è·ŸgetCharacterArtworkPath()å…±ç”¨åŒä¸€çµ„gender/element
   åˆ¤æ–·é‚è¼¯ï¼Œä½†å›å‚³çš„æ˜¯å¦å¤–ç”¨rembgå»èƒŒéçš„é€æ˜PNG
   ï¼ˆassets/characters/battle_æ€§åˆ¥_å…ƒç´ .pngï¼‰ï¼Œåªçµ¦æˆ°é¬¥
   å¡ç‰‡ï¼ˆ.battle-playerçš„background-imageï¼‰é€™ä¸€å€‹ç”¨é€”
   ä½¿ç”¨ã€‚è§’è‰²å‰µå»ºé è¦½ã€èƒŒåŒ…ç«‹ç¹ªé é¢çš„å¤§åœ–ä»ç„¶å‘¼å«
   getCharacterArtworkPath()ã€ç¹¼çºŒé¡¯ç¤ºåŸæœ¬å¸¶å ´æ™¯èƒŒæ™¯çš„
   ç‰ˆæœ¬â€”â€”é€™å…©å€‹åœ°æ–¹çš„åœ–ç‰‡æœ¬ä¾†å°±æ˜¯åŒä¸€ä»½ç´ æå…±ç”¨ï¼Œ
   ç›´æ¥æŠŠä¾†æºæª”æ¡ˆæ•´å€‹æ›æˆå»èƒŒç‰ˆæœƒé€£å¸¶å½±éŸ¿åˆ°é‚£äº›å…¶å¯¦
   ä½¿ç”¨è€…æ²’æœ‰è¦æ±‚æ”¹çš„ç•«é¢ï¼Œæ‰€ä»¥å¦å¤–é–‹ä¸€å€‹å‡½å¼ã€
   åªåœ¨æˆ°é¬¥å¡ç‰‡é‚£ä¸€è™•å‘¼å«ï¼Œå…¶é¤˜åœ°æ–¹å®Œå…¨ä¸å—å½±éŸ¿ã€‚
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
    return character ? (character.id||("è§’è‰²"+(index+1))) : ("è§’è‰²"+(index+1));
}


/* =====================================================
   â˜… æŒ‰éˆ•æ³¢ç´‹æ“´æ•£æ•ˆæœï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼‰
===================================================== */

/*
   å…¨åŸŸç›£è½æ•´å€‹æ–‡ä»¶çš„é»æ“Š/è§¸ç¢°äº‹ä»¶ï¼Œåªè¦
   é»åˆ°çš„ç›®æ¨™æ˜¯<button>ï¼ˆæˆ–æŒ‰éˆ•å…§éƒ¨çš„
   å­å…ƒç´ ï¼Œä¾‹å¦‚æŒ‰éˆ•è£¡çš„æ–‡å­—/åœ–ç¤ºï¼‰ï¼Œå°±åœ¨
   è§¸ç¢°åº§æ¨™çš„ä½ç½®å‹•æ…‹ç”Ÿæˆä¸€å€‹æœƒæ“´æ•£æ¶ˆå¤±çš„
   å°åœ“é»ï¼Œ0.5ç§’å¾Œè‡ªå‹•ç§»é™¤è‡ªå·±ï¼Œä¸æœƒç•™ä¸‹
   ä»»ä½•æ®˜ç•™çš„DOMåƒåœ¾ã€‚

   ç”¨äº‹ä»¶ä»£ç†ï¼ˆç›£è½documentã€ä¸æ˜¯å€‹åˆ¥
   æŒ‰éˆ•ï¼‰çš„å¥½è™•ï¼šç¾åœ¨95å€‹æŒ‰éˆ•ã€ä»¥å¾Œä¸ç®¡
   å†æ–°å¢å¹¾å€‹æŒ‰éˆ•ï¼Œå®Œå…¨ä¸ç”¨å¦å¤–å¯«ä¸€è¡Œ
   ç¨‹å¼ç¢¼ï¼Œå…¨éƒ¨è‡ªå‹•å¥—ç”¨åˆ°ï¼Œä¹Ÿä¸æœƒå› ç‚º
   ä¹‹å¾Œåˆå¿˜è¨˜åŠ è€Œæ¼æ‰ã€‚

   åŒæ™‚æ”¯æ´touchstartï¼ˆæ‰‹æ©Ÿè§¸æ§ï¼‰å’Œ
   mousedownï¼ˆæ»‘é¼ é»æ“Šï¼Œæ–¹ä¾¿æ¡Œæ©Ÿç€è¦½å™¨
   æ¸¬è©¦ï¼‰ï¼Œè§¸æ§è£ç½®ä¸Šå…©å€‹äº‹ä»¶é€šå¸¸éƒ½æœƒ
   è§¸ç™¼ï¼Œé€™è£¡ç”¨æ——æ¨™é¿å…åŒä¸€æ¬¡é»æ“Š
   é‡è¤‡ç”Ÿæˆå…©å€‹æ³¢ç´‹ã€‚
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
   â˜… è‡ªè¨‚ä¸‹æ‹‰é¸å–®ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œå–ä»£åŸç”Ÿ<select>ï¼‰
===================================================== */

/*
   registryï¼šè¨˜ä½æ¯ä¸€å€‹è¢«æ¥ç®¡çš„<select>ï¼Œ
   å°æ‡‰åˆ°å®ƒç”¢ç”Ÿå‡ºä¾†çš„é‚£çµ„å‡é¸å–®DOM
   ï¼ˆwrapper/label/listï¼‰ï¼Œ
   é—œé–‰å…¶ä»–é¸å–®ã€åŒæ­¥ç•«é¢æ™‚éƒ½è¦ç”¨åˆ°ã€‚
*/

const customDropdownRegistry={};


/*
   â˜… æ ¸å¿ƒæŠ€å·§ï¼šç”¨Object.defineProperty
   åœ¨é€™å€‹<select>ã€Œé€™ä¸€å€‹å¯¦é«”ã€ä¸Šè¦†è“‹æ‰
   valueé€™å€‹å±¬æ€§ï¼Œè®Šæˆæœ‰è‡ªå·±çš„get/setã€‚

   é€™æ¨£ä¸ç®¡ç¨‹å¼ç¢¼åœ¨å“ªè£¡ã€ç”¨ä»€éº¼æ–¹å¼å¯«
   select.value = "xxx"ï¼ˆç¾æœ‰å¹¾åè™•
   è®€å¯«é€™å¹¾å€‹selectçš„ç¨‹å¼ç¢¼å®Œå…¨ä¸ç”¨
   æ”¹ä¸€è¡Œï¼‰ï¼Œé€™è£¡éƒ½æ””å¾—åˆ°ï¼Œé †ä¾¿åŒæ­¥
   æ›´æ–°å‡é¸å–®çš„é¡¯ç¤ºæ–‡å­—/é¸ä¸­ç‹€æ…‹â€”â€”
   ä¸ç”¨ä¸€å€‹ä¸€å€‹å»æ‰¾ç¨‹å¼ç¢¼è£¡åˆ°åº•å“ªè£¡
   å¯«äº†.value=ï¼Œé‚£æ¨£å¾ˆå®¹æ˜“æ¼æ‰ã€
   è€Œä¸”ä»¥å¾Œæ–°å¢çš„ç¨‹å¼ç¢¼ä¹Ÿå¯èƒ½æ¼æ¥ã€‚

   çœŸæ­£çš„<option selected>ç‹€æ…‹ä¹Ÿæœƒ
   ä¸€èµ·åŒæ­¥æ›´æ–°ï¼Œä¿ç•™è·ŸåŸç”Ÿ<select>
   å®Œå…¨ä¸€è‡´çš„è¡Œç‚ºï¼Œåªæ˜¯å¤–è§€æ›æ‰ã€‚
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
   æŠŠä¸€å€‹åŸç”Ÿ<select>ï¼ˆselectIdï¼‰æ›æˆ
   è‡ªè¨‚å‡é¸å–®ã€‚åŸæœ¬çš„<select>é‚„åœ¨DOMè£¡ã€
   ç¹¼çºŒç•¶ä½œçœŸæ­£çš„è³‡æ–™ä¾†æºï¼ˆåªæ˜¯éš±è—ï¼‰ï¼Œ
   changeäº‹ä»¶ç…§æ¨£æœƒåœ¨é¸é …æ”¹è®Šæ™‚çœŸçš„è¢«
   è§¸ç™¼ï¼Œæ‰€æœ‰ç¾æœ‰çš„onchangeç›£è½/
   .valueè®€å–å®Œå…¨ä¸ç”¨æ”¹ã€‚
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
        "â–¾";


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
       é¸é …æœ¬èº«çš„valueæœ‰è®Šï¼ˆä¾‹å¦‚åˆ‡æ›è§’è‰²
       æ™‚ï¼Œç•«é¢ä¸Šé‚£é¡†selectè¢«ç¨‹å¼ç¢¼æ”¹äº†
       é¸ä¸­å€¼ï¼‰ï¼Œé€™è£¡çµ±ä¸€æ””æˆªåŒæ­¥ï¼Œ
       è¦‹ä¸Šé¢makeSelectValueReactive()
       çš„èªªæ˜ã€‚
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
   ä¾ç…§ç›®å‰<select>è£¡çš„<option>æ¸…å–®ï¼Œ
   é‡æ–°ç•«ä¸€æ¬¡å‡é¸å–®çš„æ¸…å–®å…§å®¹è·ŸæŒ‰éˆ•ä¸Š
   é¡¯ç¤ºçš„æ–‡å­—â€”â€”åˆå§‹åŒ–æ™‚å‘¼å«ä¸€æ¬¡ï¼Œ
   ä¹‹å¾Œ<select>çš„valueè¢«æ”¹è®Š
   ï¼ˆä¸ç®¡æ˜¯ç©å®¶é»äº†å‡é¸å–®ã€é‚„æ˜¯ç¨‹å¼ç¢¼
   ç›´æ¥è³¦å€¼ï¼‰éƒ½æœƒé‡æ–°å‘¼å«é€™è£¡åŒæ­¥ç•«é¢ã€‚
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
                       æ‰‹å‹•è§¸ç™¼ä¸€æ¬¡changeäº‹ä»¶ï¼Œ
                       è·ŸåŸç”Ÿ<select>è¢«ä½¿ç”¨è€…
                       é¸äº†æ–°é¸é …æ™‚çš„è¡Œç‚ºä¸€è‡´ï¼Œ
                       ç¾æœ‰æ›åœ¨é€™å¹¾å€‹selectä¸Šçš„
                       onchangeç›£è½ï¼ˆä¾‹å¦‚
                       switchAutoSettingsCharacter()ï¼‰
                       æ‰æœƒè¢«æ­£å¸¸å‘¼å«åˆ°ã€‚
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
       æ‰“é–‹ä¸€å€‹ä¹‹å‰ï¼Œå…ˆæŠŠå…¶ä»–æ‰€æœ‰å·²ç¶“
       æ‰“é–‹çš„å‡é¸å–®é—œæ‰ï¼ŒåŒä¸€æ™‚é–“ç•«é¢ä¸Š
       åªæœƒæœ‰ä¸€å€‹å±•é–‹ï¼Œä¸æœƒç–Šåœ¨ä¸€èµ·ã€‚
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
           â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…å¯¦æ¸¬ç™¼ç¾çš„å•é¡Œï¼‰ï¼š
           è‡ªå‹•æˆ°é¬¥è¨­å®šé¢æ¿æœ¬èº«æœ‰
           overflow-y:autoï¼ˆè¦å¡å…­åˆ—å…§å®¹ã€
           é¢æ¿é«˜åº¦æœ‰é™ï¼Œæœ¬ä¾†å°±éœ€è¦èƒ½æ²å‹•ï¼‰ï¼Œ
           é€™ä»£è¡¨å¦‚æœæ¸…å–®ç•™åœ¨é¢æ¿è£¡é¢ç”¨
           position:absoluteå±•é–‹ï¼Œè¶…å‡ºé¢æ¿
           ç¯„åœçš„éƒ¨åˆ†æœƒç›´æ¥è¢«è£æ‰ï¼Œçœ‹èµ·ä¾†
           åƒé¸å–®ã€Œå±•ä¸é–‹ã€ã€‚

           è·Ÿä¹‹å‰æ¬å‹•æ•´å€‹è¨­å®šé¢æ¿æ˜¯åŒä¸€æ‹›ï¼š
           å±•é–‹çš„ç•¶ä¸‹ï¼ŒæŠŠæ¸…å–®æš«æ™‚æ¬åˆ°
           document.bodyï¼Œæ”¹ç”¨position:fixed
           é…åˆgetBoundingClientRect()é‡å‡º
           æŒ‰éˆ•çš„å¯¦éš›ä½ç½®ï¼Œè²¼è‘—æŒ‰éˆ•æ­£ä¸‹æ–¹
           é¡¯ç¤ºï¼Œä¸å†å—é¢æ¿çš„overflowé™åˆ¶ï¼›
           é—œé–‰æ™‚æ¬å›åŸæœ¬åœ¨DOMè£¡çš„ä½ç½®ï¼Œ
           ç¢ºä¿ä¸‹æ¬¡é¢æ¿é‡æ–°æ‰“é–‹æ™‚ï¼Œæ¸…å–®
           é‚„æ˜¯ä¹–ä¹–è·Ÿè‘—å°çš„æŒ‰éˆ•ï¼Œä¸æœƒæ®˜ç•™
           åœ¨bodyåº•ä¸‹åˆ°è™•äº‚é£„ã€‚
        */

        moveDropdownListToBody(
            selectId
        );

    }

}


/*
   æŠŠæ¸…å–®å…ƒç´ å¾åŸæœ¬çš„ä½ç½®ï¼ˆé¢æ¿è£¡é¢ï¼‰
   æ¬åˆ°document.bodyï¼Œä¸¦ä¸”ç”¨fixedå®šä½
   è²¼é½ŠlabelæŒ‰éˆ•çš„å¯¦éš›ç•«é¢åº§æ¨™â€”â€”
   é€™æ¨£ä¸ç®¡å¤–å±¤å®¹å™¨æœ‰æ²’æœ‰overflow:hidden/
   autoï¼Œéƒ½ä¸æœƒè¢«è£åˆ‡ã€‚
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
       â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…å›å ±ï¼Œã€Œè‡ªå‹•æˆ°é¬¥
       è¨­å®šï¼ŒæŒ‰ä¸‹å»é¸å–®ç®­é ­æœ‰åæ‡‰ï¼Œä½†å°±æ˜¯
       æ²’æœ‰ä¸‹æ‹‰æ¸…å–®å¯ä»¥é¸ã€ï¼‰ï¼š
       çœŸæ­£åŸå› æ‰¾åˆ°äº†â€”â€”é€™å€‹æ¸…å–®è¢«æ¬åˆ°
       document.bodyä¹‹å¾Œï¼Œz-indexå¯«æ­»
       5000ï¼Œé€™åœ¨ç•¶åˆï¼ˆ.home-feature-modal
       é‚„æ˜¯3200çš„å¹´ä»£ï¼‰è¶³å¤ é«˜ã€æ²’å•é¡Œã€‚
       ä½†å¾Œä¾†å› ç‚ºå¦ä¸€å€‹bugï¼ˆè¨­å®šè¦–çª—è¢«
       creationPageçš„z-index:5000è“‹ä½ï¼‰ï¼Œ
       æŠŠ.home-feature-modalæœ¬èº«æ‹‰é«˜åˆ°
       6000ï¼Œé€™å€‹æ¸…å–®çš„5000åè€Œè®Šæˆæ¯”
       å½ˆçª—æœ¬èº«çš„æ·±è‰²é®ç½©ï¼ˆz-index:6000ï¼‰
       é‚„ä½â€”â€”æ¸…å–®å…¶å¯¦æœ‰æ­£å¸¸å±•é–‹ã€ä½ç½®
       ä¹Ÿç®—å°ï¼Œåªæ˜¯æ•´å€‹è¢«å½ˆçª—è‡ªå·±çš„
       åŠé€æ˜é»‘è‰²èƒŒæ™¯è“‹åœ¨ä¸Šé¢ï¼Œç•«é¢ä¸Š
       å®Œå…¨çœ‹ä¸åˆ°ï¼Œè·Ÿã€Œæ²’æœ‰æ¸…å–®å¯ä»¥é¸ã€
       çš„ç—‡ç‹€ä¸€æ¨¡ä¸€æ¨£ã€‚

       é€™è£¡æ‹‰é«˜åˆ°6100ï¼Œè“‹éç›®å‰å½ˆçª—ç³»çµ±
       ç”¨åˆ°çš„æ‰€æœ‰z-indexï¼ˆ6000ï½6060ï¼‰ã€‚
       â˜… æé†’ï¼šé€™å€‹æ¸…å–®æ˜¯ç”¨JSé‡measured
       getBoundingClientRect()+position:
       fixedæ¬åˆ°bodyé¡¯ç¤ºçš„ï¼ˆè¦‹ä¸Šé¢
       moveDropdownListToBody()ï¼‰ï¼Œé€™æ•´å¥—
       æ‰‹æ³•æœ¬èº«åœ¨é€™å€‹å°ˆæ¡ˆè£¡å·²ç¶“ä¸åªä¸€æ¬¡
       æ˜¯bugçš„ä¾†æºï¼Œä¹‹å¾Œå¦‚æœåˆè¦èª¿æ•´å½ˆçª—
       ç–Šå±¤ï¼Œè¨˜å¾—å›ä¾†æª¢æŸ¥é€™è£¡çš„z-index
       æœ‰æ²’æœ‰è·Ÿè‘—èª¿æ•´éã€‚
    */

    list.style.zIndex=
        "6100";


    /*
       â˜… æ–°å¢ï¼ˆä¾ç…§ä½¿ç”¨è€…å›å ±ï¼Œã€ŒæŒ‰ä¸‹å»
       é‚„æ˜¯æ²’åæ‡‰ã€ï¼Œé€™æ¬¡çœŸçš„æŒ–åˆ°æœ€åº•å±¤
       åŸå› äº†ï¼‰ï¼š
       åªæ¬ä½ç½®ã€åªä¿®z-indexéƒ½é‚„ä¸å¤ â€”â€”
       æ¸…å–®åŸæœ¬é CSSè¦å‰‡ã€Œ.custom-dropdown.
       open .custom-dropdown-listã€æ§åˆ¶
       å±•é–‹æ™‚çš„max-height/opacityï¼Œé€™æ¢
       è¦å‰‡è¦æ±‚æ¸…å–®é‚„ã€Œç•™åœ¨ã€.custom-dropdown
       è£¡é¢æ‰æœƒç”Ÿæ•ˆã€‚æ¸…å–®è¢«æ¬åˆ°
       document.bodyä¹‹å¾Œï¼Œä¸å†æ˜¯
       .custom-dropdown.opençš„å­å…ƒç´ ï¼Œ
       é€™æ¢è¦å‰‡ç›´æ¥å¤±æ•ˆï¼Œæ¸…å–®æ‰“å›é è¨­çš„
       max-height:0ã€opacity:0ï¼Œç­‰æ–¼
       å®Œå…¨æ”¶åˆâ€”â€”é€™æ‰æ˜¯çœŸæ­£çš„åŸå› ï¼Œ
       z-indexåªæ˜¯å¦ä¸€å€‹ç–ŠåŠ çš„å•é¡Œï¼Œ
       å…©å€‹ä¸€èµ·ä¿®æ‰æœƒçœŸçš„çœ‹åˆ°æ¸…å–®ã€‚

       é€™è£¡è®“æ¸…å–®è‡ªå·±èº«ä¸Šä¹Ÿå¸¶ä¸€å€‹"open"
       classï¼ˆCSSé‚£é‚Šæ–°å¢äº†å°æ‡‰çš„
       .custom-dropdown-list.openè¦å‰‡ï¼‰ï¼Œ
       ä¸ç®¡æ¸…å–®current DOMä½ç½®åœ¨å“ªè£¡éƒ½èƒ½
       æ­£ç¢ºå±•é–‹ã€‚
    */

    list.classList.add(
        "open"
    );

}


/*
   æŠŠæ¸…å–®æ¬å›å®ƒåŸæœ¬åœ¨DOMè£¡çš„ä½ç½®ï¼Œ
   æ¸…æ‰fixedå®šä½ç›¸é—œçš„è¡Œå…§æ¨£å¼ï¼Œ
   æ¢å¾©æˆåŸæœ¬é CSS classæ§åˆ¶çš„æ¨£å­ã€‚
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
           â˜… æ–°å¢ï¼šè·ŸmoveDropdownListToBody()
           è£¡åŠ çš„list.classList.add("open")
           å°æ‡‰ï¼Œé—œé–‰æ™‚è¦è¨˜å¾—æ‹¿æ‰ï¼Œä¸ç„¶æ¸…å–®
           è¢«æ¬å›åŸä½ä¹‹å¾Œstillå¸¶è‘—"open"ï¼Œ
           ä¸‹æ¬¡é‚„æ²’é»é–‹å°±å·²ç¶“æ˜¯å±•é–‹ç‹€æ…‹ï¼Œ
           ç•«é¢æœƒæ€ªæ€ªçš„ã€‚
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
   é»ç•«é¢ä¸Šä»»ä½•å‡é¸å–®ä»¥å¤–çš„åœ°æ–¹ï¼Œ
   å…¨éƒ¨æ”¶åˆèµ·ä¾†ï¼Œè·ŸåŸç”Ÿ<select>é»
   å¤–é¢æœƒè‡ªå‹•é—œé–‰æ˜¯ä¸€æ¨£çš„è¡Œç‚ºã€‚
*/

document.addEventListener(
    "click",
    event=>{
        if(event&&event.target&&typeof event.target.closest==="function"&&event.target.closest("#battlePage")){
            return;
        }

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
   â˜… å‰µè§’
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
           åªèƒ½æ‰£æ‰ç©å®¶è‡ªå·±å‰›å‰›åˆ†é…çš„é»ã€‚
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
   â˜… ä»¥ä¸‹æ˜¯ç¬¬äºŒè§’è‰²å‰µå»ºç”¨çš„å°æ‡‰å‡½å¼ï¼Œ
   é‚è¼¯è·Ÿä¸Šé¢ä¸‰å€‹å®Œå…¨ä¸€æ¨£ï¼Œåªæ˜¯æ“ä½œ
   creationStats2/creationPoints2/
   selectedCreationElement2 é€™çµ„ç¨ç«‹è®Šæ•¸ï¼Œ
   ä¸æœƒå½±éŸ¿ç¬¬ä¸€åè§’è‰²çš„å‰µè§’è³‡æ–™ã€‚
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
        ? "ç¬¬ä¸‰å"
        : creationTargetSlot===2
        ? "ç¬¬äºŒå"
        : "ç¬¬ä¸€å";

    if(subtitle){
        subtitle.textContent=
            "é¸æ“‡ä½ çš„å…ƒç´ ä¹‹é“ï¼Œå»ºç«‹"+ordinal+"å†’éšªè€…";
    }

    if(submitLabel){
        submitLabel.textContent=
            creationTargetSlot===1
            ? "é–‹å§‹å†’éšª"
            : "å®Œæˆå‰µå»º";
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
            alert("ç¬¬ä¸€è§’è‰²é”åˆ° Lv.10 å¾Œæ‰èƒ½å»ºç«‹ç¬¬äºŒè§’è‰²ã€‚");
            return;
        }
    }

    if(slot===3){
        if(player3){ return; }
        if(!isThirdCharacterUnlocked()){
            alert("ç¬¬ä¸€ã€ç¬¬äºŒè§’è‰²éƒ½é”åˆ° Lv.50 å¾Œæ‰èƒ½å»ºç«‹ç¬¬ä¸‰è§’è‰²ã€‚");
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
        alert("è«‹å…ˆè¼¸å…¥è§’è‰² IDã€‚");
        return;
    }

    if(id.length<2){
        alert("IDè‡³å°‘éœ€è¦2å€‹å­—å…ƒã€‚");
        return;
    }

    if(isCharacterIdTaken(id)){
        alert("è§’è‰² ID ä¸èƒ½èˆ‡ç¾æœ‰è§’è‰²é‡è¤‡ã€‚");
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

    alert("ã€Œ"+character.id+"ã€å‰µå»ºå®Œæˆï¼");
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
       æ¯æ¬¡æ‰“é–‹éƒ½é‡ç½®æˆåˆå§‹ç‹€æ…‹ï¼Œ
       é¿å…ä¸Šæ¬¡æ²’å‰µå»ºå®Œã€å–æ¶ˆæ‰çš„æ®˜ç•™æ•¸å€¼
       å½±éŸ¿ä¸‹ä¸€æ¬¡æ‰“é–‹ã€‚
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
   â˜… å»ºç«‹ç¬¬äºŒè§’è‰²ã€‚

   è·ŸcreateCharacter()é‚è¼¯å°æ‡‰ï¼Œ
   ä½†å­˜é€²player2è€Œä¸æ˜¯playerï¼Œ
   è€Œä¸”ä¸æœƒå‹•åˆ°ç›®å‰çš„éŠæˆ²ç•«é¢
   ï¼ˆä¸éœ€è¦åˆ‡æ›å‰µè§’é /éŠæˆ²é ï¼Œ
   é—œæ‰modalå°±å¥½ï¼Œäººé‚„åœ¨ä¸»åŸï¼‰ã€‚
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
            "è«‹å…ˆè¼¸å…¥è§’è‰² IDã€‚"
        );

        return;

    }


    if(id.length<2){

        alert(
            "IDè‡³å°‘éœ€è¦2å€‹å­—å…ƒã€‚"
        );

        return;

    }


    if(isCharacterIdTaken(id)){

        alert(
            "è§’è‰² ID ä¸èƒ½èˆ‡ç¾æœ‰è§’è‰²é‡è¤‡ã€‚"
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
       â˜… æ–°å¢ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œã€Œé‡æ€ªç•°å¸¸
       ç‹€æ…‹ç›´æ¥åšã€â€”â€”æ€ªç‰©çµ‚æ–¼å¯ä»¥å°ç©å®¶
       é™„åŠ è² é¢æ•ˆæœäº†ï¼‰ï¼šè·Ÿæ€ªç‰©èº«ä¸Šçš„
       monster.statusEffectsæ˜¯åŒä¸€å¥—è³‡æ–™
       çµæ§‹ã€åŒä¸€å¥—å…±ç”¨å‡½å¼
       ï¼ˆapplyMonsterDebuff()/
       getMonsterDebuffValue()/
       isMonsterFrozen()/isMonsterPetrified()
       é›–ç„¶åå­—è£¡æœ‰ã€ŒMonsterã€ï¼Œä½†é€™äº›å‡½å¼
       æœ¬ä¾†å°±åªæ“ä½œå‚³é€²å»çš„ç‰©ä»¶æœ¬èº«ï¼Œæ²’æœ‰
       ä»»ä½•å¯«æ­»monsterå°ˆå±¬çš„æ¬„ä½ï¼Œç©å®¶è§’è‰²
       ç‰©ä»¶ä¸€æ¨£èƒ½ç›´æ¥æ²¿ç”¨ï¼Œä¸ç”¨é‡å¯«ä¸€å¥—ï¼‰ã€‚
    */

    statusEffects:[],

        /*
           â˜… æ–°å¢ï¼šé˜²ç¦¦ç‹€æ…‹ï¼Œè·Ÿplayerçµæ§‹ä¸€è‡´ã€‚
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
       â˜… æŠŠç¬¬äºŒè§’è‰²æ›é€²æ—¢æœ‰çš„
       characters / characterEquipment /
       characterSkillLoadouts é€™ä¸‰å€‹çµæ§‹ï¼Œ
       ç”¨å›ºå®šid"player2"ç•¶key
       ï¼ˆä¸ç”¨å…ƒç´ ç•¶keyï¼Œ
       é€™æ¨£å°±ç®—å…ƒç´ è·Ÿç¬¬ä¸€åè§’è‰²é‡è¤‡ä¹Ÿä¸æœƒäº’ç›¸è¦†è“‹ï¼‰ã€‚
       é€™ä¸‰å€‹çµæ§‹åŸæœ¬å°±æ˜¯èƒŒåŒ…é /æŠ€èƒ½é åœ¨è®€çš„è³‡æ–™ä¾†æºï¼Œ
       æ›é€²å»ä¹‹å¾Œé‚£å…©å€‹é é¢æ‰æŠ“å¾—åˆ°ç¬¬äºŒè§’è‰²ã€‚
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
        "ã€Œ"+
        player2.id+
        "ã€å‰µå»ºå®Œæˆï¼å¯ä»¥åˆ°èƒŒåŒ…é è·ŸæŠ€èƒ½é æŸ¥çœ‹ã€‚"
    );

}


/* =====================================================
   â˜… å‰µè§’å®Œæˆ
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
            "è«‹å…ˆè¼¸å…¥è§’è‰² IDã€‚"
        );

        return;

    }


    if(id.length<2){

        alert(
            "IDè‡³å°‘éœ€è¦2å€‹å­—å…ƒã€‚"
        );

        return;

    }


    /*
       ç¢ºä¿å…­é …èƒ½åŠ›éƒ½æ˜¯åˆæ³•æ•¸å€¼ã€‚
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
       ä¾å…­é …èƒ½åŠ›è¨ˆç®—åˆå§‹HP/SPã€‚
       ç”¨try/catchåŒ…èµ·ä¾†ï¼Œ
       å°±ç®—é€™è£¡æ„å¤–å‡ºéŒ¯ï¼Œ
       ç•«é¢ä¹Ÿå·²ç¶“åˆ‡æ›éå»äº†ã€‚
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
            "å‰µè§’å¾ŒçºŒåˆå§‹åŒ–ç™¼ç”ŸéŒ¯èª¤ï¼š",
            error
        );

    }


    if(saveGame()!==true){
        Object.keys(player).forEach(key=>delete player[key]);
        Object.assign(player,previousPlayer);
        console.error("å‰µè§’å­˜æª”å¤±æ•—ï¼›è§’è‰²æœªå»ºç«‹ã€‚",
            new Error("Account save commit failed."));
        return false;
    }

    window.FourSymbolsStartupPolicy.notifyCharacterCreated();
    $("creationPage").style.display="none";
    $("gameInterface").style.display="block";
    return true;

}


/* =====================================================
   å­˜æª”
===================================================== */

function saveGame(options={}){

    if(deleteAllCharactersInProgress){
        return false;
    }

    const repository=window.FourSymbolsAccountSave;
    const activeUid=repository&&repository.getActiveUid();
    if(!repository||!activeUid||SAVE_KEY!==repository.saveKey(activeUid)){
        console.error("å­˜æª”å¤±æ•—ï¼šå°šæœªå»ºç«‹å¯é©—è­‰çš„ UID ownerã€‚");
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
               â˜… ç¬¬äºŒè§’è‰²å­˜æª”ï¼ˆæ–°å¢ï¼‰ã€‚
               player2åœ¨æ²’å‰µå»ºä¹‹å‰æ˜¯nullï¼Œ
               JSON.stringify(null)æ²’å•é¡Œï¼Œ
               è®€æª”æ™‚åªè¦åˆ¤æ–·é€™å€‹æ¬„ä½æ˜¯ä¸æ˜¯nullå°±å¥½ã€‚
            */

            player2:player2,
            player3:player3,

            sharedExp:sharedExp,

            /*
               â˜… æ–°å¢ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œä¸»åŸ
               æ–°å¢çš„å…­å€‹åŠŸèƒ½ï¼šå•†åº—/è§’è‰²å±•ç¤º/
               æ¯æ—¥ä»»å‹™/åœ–é‘‘/æˆå°±/å…¬å‘Šï¼‰ï¼š
               é‡‘å¹£ã€æ¯æ—¥ä»»å‹™é€²åº¦ã€åœ–é‘‘æ“Šæ®º
               ç´€éŒ„ã€æˆå°±å®Œæˆç‹€æ…‹ï¼Œéƒ½æ˜¯æ–°å¢çš„
               æŒä¹…åŒ–è³‡æ–™ï¼Œè·Ÿè‘—å­˜æª”ä¸€èµ·å­˜ã€‚
               è§’è‰²å±•ç¤ºã€å…¬å‘Šä¸éœ€è¦å­˜æª”
               ï¼ˆè§’è‰²å±•ç¤ºç›´æ¥è®€player/player2
               ç¾æœ‰è³‡æ–™ï¼Œå…¬å‘Šæ˜¯ç´”éœæ…‹æ–‡å­—ï¼‰ã€‚
            */

            gold:gold,

            dailyQuestState:
                dailyQuestState,

            /*
               â˜… æ–°å¢ï¼šå§”è¨—ä»»å‹™é€²åº¦è·Ÿæ¯æ—¥ä»»å‹™
               ä¸€æ¨£è¦å­˜æª”ã€‚
            */

            commissionQuestState:
                commissionQuestState,
            bestiaryData:
                bestiaryData,

            achievementState:
                achievementState,

            /*
               â˜… æ–°å¢ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œé›¢ç·šç¶“é©—
               ç³»çµ±ï¼‰ï¼šæ¯æ¬¡å­˜æª”éƒ½è¨˜éŒ„ã€Œé€™æ¬¡å­˜æª”
               ç•¶ä¸‹çš„æ™‚é–“ã€ï¼Œè®€æª”æ™‚æ‹¿ç¾åœ¨æ™‚é–“
               å»æ¸›é€™å€‹æ™‚é–“æˆ³è¨˜ï¼Œå°±èƒ½ç®—å‡ºç©å®¶
               é›¢é–‹äº†å¤šä¹…ï¼Œæ›ç®—å‡ºé›¢ç·šç¶“é©—ã€‚
            */

            lastSaveTimestamp:
                Date.now(),

            selectedCreationElement:
                selectedCreationElement,

            characterEquipment:
                characterEquipment,

            /*
               â˜… ä¿®æ­£ï¼š
               characterSkillLoadoutsï¼ˆå·²å­¸æŠ€èƒ½ã€ç­‰ç´šã€
               æˆ°é¬¥é…è£ï¼‰ä¹‹å‰å®Œå…¨æ²’æœ‰å­˜æª”ï¼Œ
               ç©å®¶èŠ±æŠ€èƒ½é»å­¸çš„æŠ€èƒ½ã€å‡çš„ç­‰ç´šï¼Œ
               åªè¦é‡æ–°æ•´ç†é é¢å°±æœƒå…¨éƒ¨æ¶ˆå¤±ã€‚
               ç¾åœ¨æŠŠå®ƒåŠ é€²å­˜æª”è³‡æ–™è£¡ã€‚
            */

            characterSkillLoadouts:
                characterSkillLoadouts,

            /*
               â˜… æ–°å¢ï¼šè‡ªå‹•æˆ°é¬¥è¨­å®šå­˜æª”ã€‚
               é€™å…©çµ„åŸæœ¬éƒ½å®Œå…¨æ²’æœ‰å­˜æª”ï¼Œ
               æ¯æ¬¡é‡æ–°æ•´ç†/é‡é–‹ï¼Œ
               ç©å®¶è¨­å¥½çš„è‡ªå‹•æŠ€èƒ½/HPé–€æª»/SPé–€æª»
               éƒ½æœƒè¢«é‡ç½®å›é è¨­å€¼ï¼Œ
               ç¾åœ¨å…©å€‹è§’è‰²çš„è¨­å®šéƒ½ä¸€èµ·å­˜èµ·ä¾†ã€‚
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
        let endReleaseSaveOperation=null;
        try{
            if(
                window.FourSymbolsReleaseUpdate&&
                typeof window.FourSymbolsReleaseUpdate.beginCriticalOperation==="function"
            ){
                endReleaseSaveOperation=
                    window.FourSymbolsReleaseUpdate.beginCriticalOperation("account-save-write");
            }
        }catch(_){ }
        try{
            repository.writeForUid(activeUid,saveData,{
                source:String(persistenceOptions.source||"gameplay"),
                ...(typeof persistenceOptions.localDirty==="boolean"?{localDirty:persistenceOptions.localDirty}:{})
            });
        }finally{
            if(typeof endReleaseSaveOperation==="function"){
                endReleaseSaveOperation();
            }
        }
        return true;

    }
    catch(error){

        console.error(
            "å­˜æª”å¤±æ•—ï¼š",
            error
        );

        return false;

    }

}


/* =====================================================
   â˜… èˆŠå­˜æª”ä¿®å¾© / è®€æª”
===================================================== */

/* =====================================================
   èˆŠå­˜æª”æŠ€èƒ½å¼•ç”¨ç›¸å®¹
   - V152 æ›¾æŠŠèª¤åŠ å…¥ç©å®¶æŠ€èƒ½æ± çš„ fireBurstStrike é€€å½¹ã€‚
   - å¾Œå±¤ gameplay runtime ä»æœƒæ¸…ç†æ€ªç‰©èˆ‡åŸ·è¡Œéšæ®µè³‡æ–™ï¼Œ
     ä½†å¸³è™Ÿ hydration å¿…é ˆåœ¨ç¬¬ä¸€æ¬¡æŠ€èƒ½ UI render å‰å…ˆæ¸…ç†ç©å®¶å­˜æª”å¼•ç”¨ã€‚
===================================================== */
function normalizeHydratedRetiredSkillReferences(){

    const retiredPlayerSkillIds=new Set([
        "fireBurstStrike"
    ]);

    Object.values(characterSkillLoadouts||{}).forEach(loadout=>{
        if(!loadout||typeof loadout!=="object"){ return; }

        if(loadout.skillLevels&&typeof loadout.skillLevels==="object"&&!Array.isArray(loadout.skillLevels)){
            retiredPlayerSkillIds.forEach(skillId=>delete loadout.skillLevels[skillId]);
        }

        if(Array.isArray(loadout.equippedSkills)){
            loadout.equippedSkills=loadout.equippedSkills.filter(skillId=>{
                if(retiredPlayerSkillIds.has(skillId)){ return false; }
                const skill=skillDatabase&&skillDatabase[skillId];
                return !!(skill&&skill.monsterOnly!==true);
            });
        }
    });

    [autoConfig,autoConfig2,autoConfig3].forEach(config=>{
        if(config&&retiredPlayerSkillIds.has(config.skill)){
            config.skill="normal";
        }
    });
}


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
           å…ˆæŠŠç©å®¶è³‡æ–™è¼‰å…¥ã€‚
        */

        Object.assign(
            player,
            data.player
        );


        /*
           â˜… èˆŠç‰ˆæ²’æœ‰é€™äº›èƒ½åŠ›æ™‚ï¼Œ
           å¼·åˆ¶è£œ0ã€‚
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
           â˜… èˆŠå­˜æª”å¯èƒ½æ²’æœ‰bonusHP/bonusSPï¼Œ
           å¼·åˆ¶è£œ0ï¼Œé¿å…å‡ç´šå…¬å¼å‡ºéŒ¯ã€‚
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
           â˜… è®€å–å…±ç”¨ç¶“é©—æ± ï¼Œ
           èˆŠå­˜æª”æ²’æœ‰çš„è©±å°±å¾0é–‹å§‹ï¼Œ
           ç©å®¶èº«ä¸ŠåŸæœ¬å¡è‘—çš„expæœƒè‡ªå‹•è½‰å…¥ç¶“é©—æ± ã€‚
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


        /* V93ï¼šèˆŠ V92 çš„ permanentTestExpPool æ¬„ä½åˆ»æ„å¿½ç•¥ï¼Œ
           æ¸¬è©¦ EXP å·²æ”¹ç‚ºæ¯æŒ‰ä¸€æ¬¡ç›´æ¥è¿½åŠ ï¼Œä¸å†è‡ªå‹•è£œå›ã€‚ */



        /*
           â˜… æ–°å¢ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œä¸»åŸ
           æ–°å¢çš„å…­å€‹åŠŸèƒ½ï¼‰ï¼š
           è®€å–é‡‘å¹£/æ¯æ—¥ä»»å‹™/åœ–é‘‘/æˆå°±ï¼Œ
           èˆŠå­˜æª”æ²’æœ‰é€™äº›æ¬„ä½çš„è©±å°±ç”¨é è¨­å€¼ï¼Œ
           ä¸æœƒè®“è®€æª”æ•´å€‹å¤±æ•—ã€‚
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
            typeof data.achievemeµ¨¥zºè¯
â¶)à²Ö§uªİ¢ëiºĞk¢G§¦*^ntState===
            "object"
        ){

            Object.assign(
                achievementState,
                data.achievementState
            );

        }


        /*
           â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…å›å ±ï¼Œçµ±ä¸€æ”¹ç”¨
           å…±ç”¨å‡½å¼calculateOfflineExpSince()ï¼Œ
           è·Ÿã€Œåˆ‡å›å‰æ™¯ã€é‚£å€‹æ™‚æ©Ÿå…±ç”¨åŒä¸€ä»½
           é‚è¼¯ï¼Œä¸è¦å„è‡ªç¶­è­·ä¸€ä»½å¹¾ä¹ä¸€æ¨£
           çš„è¨ˆç®—ï¼‰ï¼š
           è®€æª”çš„æ™‚å€™ï¼Œæ‹¿ç¾åœ¨æ™‚é–“æ¸›æ‰ä¸Šæ¬¡
           å­˜æª”çš„æ™‚é–“æˆ³è¨˜ï¼Œæ›ç®—å‡ºç©å®¶é›¢é–‹äº†
           å¹¾åˆ†é˜ï¼Œç®—å‡ºé€™æ¬¡ã€Œå¯ä»¥é ˜å–ã€çš„
           é›¢ç·šç¶“é©—ï¼Œå­˜é€²pendingOfflineExp
           ï¼ˆä¸æœƒè‡ªå‹•åŠ é€²ç¶“é©—æ± ï¼Œè¦ç©å®¶è‡ªå·±
           å»ä¸»åŸã€Œé›¢ç·šç¶“é©—ã€é‚£è£¡æŒ‰æŒ‰éˆ•æ‰æœƒ
           çœŸçš„å…¥å¸³ï¼‰ã€‚

           OFFLINE_EXP_PER_MINUTEï¼šæ¯é›¢ç·š
           1åˆ†é˜å¯ä»¥é ˜åˆ°çš„ç¶“é©—å€¼ã€‚
           OFFLINE_EXP_MAX_MINUTESï¼šé›¢ç·šç¶“é©—
           æœ€å¤šåªç®—åˆ°é€™å€‹åˆ†é˜æ•¸ï¼ˆ480åˆ†é˜ï¼
           8å°æ™‚ï¼‰ï¼Œè¶…é8å°æ™‚ä¸æœƒé ˜åˆ°æ›´å¤šï¼Œ
           é¿å…ç©å®¶æ”¾è‘—è§’è‰²ä¸ç®¡å¥½å¹¾å¤©ï¼Œ
           ä¸€æ¬¡å›ä¾†å°±ç›´æ¥æŠŠç­‰ç´šè¡åˆ°é ‚ã€‚
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
           èˆŠç‰ˆå¯èƒ½é‚„æœ‰
           defense / maxHP / maxSP
           é€™äº›èˆŠæ¬„ä½ï¼Œ
           æ–°ç³»çµ±ä¸ç›´æ¥ä½¿ç”¨ã€‚
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
           â˜… è‡ªå‹•æˆ°é¬¥è¨­å®šè®€æª”ï¼ˆæ–°å¢ï¼‰ã€‚
           è·Ÿplayer2ä¸€æ¨£ï¼ŒèˆŠå­˜æª”ä¸æœƒæœ‰é€™å…©å€‹æ¬„ä½ï¼Œ
           é€™ç¨®æƒ…æ³ç›´æ¥ç¶­æŒç¨‹å¼ç¢¼ä¸€é–‹å§‹
           å®£å‘Šçš„é è¨­å€¼å°±å¥½ã€‚
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


        /* V111ï¼šèˆŠå­˜æª”é–€æª»é·ç§»åˆ° 25ï¼50ï¼75ï¼90ï¼100%ã€‚ */
        autoConfig.hp=normalizeAutoBattleThreshold(autoConfig.hp,50);
        autoConfig.sp=normalizeAutoBattleThreshold(autoConfig.sp,25);
        autoConfig2.hp=normalizeAutoBattleThreshold(autoConfig2.hp,50);
        autoConfig2.sp=normalizeAutoBattleThreshold(autoConfig2.sp,25);
        autoConfig3.hp=normalizeAutoBattleThreshold(autoConfig3.hp,50);
        autoConfig3.sp=normalizeAutoBattleThreshold(autoConfig3.sp,25);


        /*
           â˜… ç¬¬äºŒè§’è‰²è®€æª”ï¼ˆæ–°å¢ï¼‰ã€‚

           èˆŠå­˜æª”ï¼ˆé€™æ¬¡æ›´æ–°ä¹‹å‰å­˜çš„ï¼‰ä¸æœƒæœ‰
           data.player2é€™å€‹æ¬„ä½ï¼Œ
           é€™æ™‚å€™data.player2æ˜¯undefinedï¼Œ
           player2ç¶­æŒnullï¼Œç­‰æ–¼ã€Œé‚„æ²’å‰µå»ºéã€ï¼Œ
           å®Œå…¨ç¬¦åˆé æœŸï¼Œä¸éœ€è¦ç‰¹åˆ¥æ¬è³‡æ–™ã€‚

           å¦‚æœæœ‰å­˜éçš„è©±ï¼Œé™¤äº†é‚„åŸplayer2æœ¬èº«ï¼Œ
           é‚„è¦ç¢ºä¿characters/characterEquipment/
           characterSkillLoadoutsé€™ä¸‰å€‹çµæ§‹è£¡
           éƒ½æ›è‘—player2å°æ‡‰çš„è³‡æ–™ï¼Œ
           ä¸ç„¶èƒŒåŒ…é /æŠ€èƒ½é æŠ“ä¸åˆ°äººã€‚
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
           â˜… æŠ€èƒ½é…è£è³‡æ–™ï¼ˆæ–°å¢ï¼‰

           è¦è™•ç†å…©ç¨®èˆŠè³‡æ–™æƒ…æ³ï¼š
           1. å®Œå…¨æ²’æœ‰ characterSkillLoadouts
              ï¼ˆæœ€æ—©çš„å­˜æª”ç‰ˆæœ¬ï¼Œé‚£æ™‚å€™æ ¹æœ¬æ²’å­˜é€™å€‹ï¼‰
           2. æœ‰å­˜ï¼Œä½†æ˜¯èˆŠæ ¼å¼
              ï¼ˆlearnedSkillsæ˜¯é™£åˆ—ï¼Œä¸æ˜¯skillLevelsç‰©ä»¶ï¼‰
              â†’ é€™ç¨®æƒ…æ³ç›´æ¥è¦–åŒæ²’å­˜ï¼Œ
                ç”¨é è¨­å€¼ï¼ˆç«ç„°æ–¬1ç´šï¼‰é‡æ–°é–‹å§‹ï¼Œ
                æŠ€èƒ½é»æ•¸ç©å®¶é‚„åœ¨ï¼Œå¯ä»¥é‡æ–°å­¸ã€‚
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
           è£å‚™è³‡æ–™
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
           èƒŒåŒ…è³‡æ–™
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
           â˜… è®€æª”å¾Œé‡æ–°è¨ˆç®—HP/SPã€‚
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
           V137ï¼šè®€æª”åŸæœ¬åªæ ¡æ­£ä¸»è§’HP/SPï¼Œç¬¬äºŒã€ç¬¬ä¸‰è§’è‰²è‹¥æ˜¯èˆŠå­˜æª”
           ç¼ºæ¬„ä½ã€NaNæˆ–è¶…éè£å‚™å¾Œçš„æ–°ä¸Šé™ï¼Œè¦ç­‰åˆ°é€²æˆ°é¬¥æ‰æœƒè¢«ä¿®æ­£ï¼Œ
           è§’è‰²ï¼èƒŒåŒ…é åœ¨é‚£ä¹‹å‰å¯èƒ½é¡¯ç¤ºNaNæˆ–éŒ¯èª¤æ¯”ä¾‹ã€‚ä¸‰åè§’è‰²ä½¿ç”¨
           åŒä¸€å¥—è®€æª”æ­£è¦åŒ–è¦å‰‡ã€‚
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
           â˜… æœ€é‡è¦ï¼š
           è®€æª”æˆåŠŸå¾Œæ˜ç¢ºé¡¯ç¤ºéŠæˆ²ã€‚
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
           â˜… ä¿®æ­£ï¼ˆçœŸæ­£æŠ“åˆ°ã€Œé‡æ–°æ•´ç†å¾Œä¸»åŸ
           æ¨™é¡Œåˆ—åˆè·‘å‡ºä¾†ã€çš„åŸå› ï¼‰ï¼š
           homePageåœ¨HTMLè£¡æ˜¯ç›´æ¥å¯«æ­»
           class="page active"ï¼Œè®€æª”æˆåŠŸ
           é¡¯ç¤ºéŠæˆ²ç•«é¢çš„é€™è£¡ï¼Œå¾ä¾†æ²’æœ‰çœŸçš„
           å‘¼å«éshowPage("home")ï¼Œå°è‡´
           ã€Œä¸»åŸ/ç·´åŠŸå€ä¸é¡¯ç¤ºæ¨™é¡Œåˆ—ã€é€™å€‹
           æ©Ÿåˆ¶ï¼ˆé showPage()è£¡åˆ‡æ›#appçš„
           no-headeré€™å€‹classï¼‰å¾ä¾†æ²’æœ‰
           æ©ŸæœƒåŸ·è¡Œåˆ°â€”â€”åªæœ‰ç©å®¶ä¹‹å¾Œæ‰‹å‹•é»äº†
           å°è¦½åˆ—ã€çœŸçš„è§¸ç™¼ä¸€æ¬¡showPage()ï¼Œ
           æ¨™é¡Œåˆ—æ‰æœƒæ¶ˆå¤±ã€‚é€™è£¡è£œä¸Šï¼Œè®€æª”
           æˆåŠŸã€éŠæˆ²ç•«é¢é¡¯ç¤ºå‡ºä¾†çš„åŒæ™‚ï¼Œ
           å°±æ­£ç¢ºå¥—ç”¨ä¸€æ¬¡ã€‚        */

        showPage(
            "home"
        );


        updateUI();

        renderInventory();

        renderSkillLoadout();


        /*
           å­˜æˆæ–°ç‰ˆæ ¼å¼ï¼Œ
           è®“èˆŠè³‡æ–™å®Œæˆå‡ç´šã€‚
        */

        saveGame({source:"hydration-normalization"});


        return true;

    }
    catch(error){

        console.error(
            "è®€å–å­˜æª”å¤±æ•—ï¼š",
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
   æ¸…é™¤å­˜æª”
===================================================== */

async function resetGame(){

    if(
        typeof window.rpgConfirm!=="function" ||
        !await window.rpgConfirm(
            "ç¢ºå®šè¦åˆªé™¤è§’è‰²ä¸¦é‡æ–°å‰µå»ºå—ï¼Ÿ",
            {
                title:"åˆªé™¤è§’è‰²",
                confirmText:"ç¢ºå®šåˆªé™¤",
                cancelText:"ä¿ç•™è§’è‰²",
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
   V115 â€” å·¡æ€ªé å…§èƒŒåŒ…æµ®å±¤
   åªæ”¹é–‹å•Ÿæ–¹å¼ï¼›èƒŒåŒ…è³‡æ–™ã€è£å‚™ã€ç‰©å“è©³æƒ…ã€å‡ºå”®ç­‰ä»æ²¿ç”¨åŸå‡½å¼ã€‚
===================================================== */
let inventoryOpenContext=null;

function inventoryContextSnapshot(context){
    const sourcePage=String(context&&context.sourcePage||"map");
    return Object.freeze({
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
   é é¢
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
       â˜… ä¿®æ­£ï¼ˆçœŸçš„æŠ“åˆ°ã€Œç·´åŠŸçªç„¶ä¸é‡æ€ªã€çš„åŸå› ï¼‰ï¼š
       ä¹‹å‰åªæœ‰é€éenterZone()ï¼ˆé‡æ–°é¸æ“‡/é€²å…¥
       ç·´åŠŸå€ï¼‰æ‰æœƒé‡æ–°æ•´ç†åœ°åœ–ä¸Šæ€ªç‰©åœ–ç¤ºçš„
       é¡¯ç¤ºç‹€æ…‹ï¼Œå–®ç´”ç”¨showPage("map")åˆ‡æ›
       é é¢å®Œå…¨ä¸æœƒåšé€™ä»¶äº‹ã€‚

       å¦‚æœæ€ªç‰©å­˜æ´»ç‹€æ…‹è·Ÿç•«é¢åœ–ç¤ºé¡¯ç¤ºç‹€æ…‹
       åœ¨æŸå€‹æ™‚åºä¸‹ä¸å°å¿ƒå…œä¸èµ·ä¾†ï¼ˆä¾‹å¦‚å‰›æ‰“å®Œ
       ä¸€å ´æˆ°é¬¥ã€å›åˆ°åœ°åœ–çš„é‚£å€‹ç¬é–“ï¼‰ï¼Œ
       å–®ç´”åˆ‡æ›é é¢å›åœ°åœ–æ˜¯æ²’è¾¦æ³•ä¿®æ­£çš„â€”â€”
       åªæœ‰å›é ­é‡æ–°é€²å…¥ç·´åŠŸå€æ‰æœƒå¼·åˆ¶é‡ç½®ï¼Œ
       é€™æ­£æ˜¯ã€Œäº‚åˆ‡é¸å–®æ‰åˆæ¢å¾©æ­£å¸¸ã€èƒŒå¾Œçš„
       çœŸæ­£åŸå› ï¼šä¸æ˜¯åˆ‡æ›æœ¬èº«æœ‰æ•ˆï¼Œæ˜¯åˆ‡æ›çš„
       é€”ä¸­å‰›å¥½é‡æ–°é€²å…¥äº†ç·´åŠŸå€ã€è§¸ç™¼äº†å®Œæ•´é‡ç½®ã€‚

       é€™è£¡ç›´æ¥è®“ã€Œåˆ‡æ›åˆ°åœ°åœ–é é¢ã€é€™å€‹å‹•ä½œï¼Œ
       æ¯æ¬¡éƒ½é †ä¾¿é‡æ–°åŒæ­¥ä¸€æ¬¡æ€ªç‰©åœ–ç¤ºçš„
       é¡¯ç¤ºç‹€æ…‹ï¼Œç¢ºä¿åªè¦çœ‹å¾—åˆ°åœ°åœ–ï¼Œ
       ç•«é¢ä¸Šé¡¯ç¤ºçš„æ€ªç‰©å°±ä¸€å®šè·Ÿå¯¦éš›è³‡æ–™ä¸€è‡´ï¼Œ
       ä¸ç”¨å†ç‰¹åœ°ç¹å»é‡æ–°é€²å…¥ç·´åŠŸå€æ‰èƒ½ä¿®æ­£ã€‚
    */

    if(
        page==="map"&&
        typeof updateMapMonsterIcons===
        "function"
    ){

        updateMapMonsterIcons();

    }


    /*
       â˜… æˆ°é¬¥ã€èƒŒåŒ…é é¢æ™‚éš±è—é ‚éƒ¨çš„è§’è‰²è³‡è¨Šåˆ—ï¼Œ
       å› ç‚ºé‚£äº›è³‡è¨Šï¼ˆç­‰ç´š/HP/SPï¼‰
       è·Ÿé€™å…©å€‹é é¢æœ¬èº«é¡¯ç¤ºçš„è§’è‰²è³‡è¨Šé‡è¤‡ï¼Œ
       çœä¸‹çš„ç©ºé–“è®“å…§å®¹å¯ä»¥å¤§ä¸€é»ã€‚
       ç”¨ #app çš„ no-header class
       çµ±ä¸€æ§åˆ¶ï¼Œä¹‹å¾Œå¦‚æœé‚„æœ‰å…¶ä»–é é¢
       ä¹Ÿæƒ³æ‹¿æ‰é ‚éƒ¨åˆ—ï¼Œåªè¦æŠŠé ååŠ é€²
       hideHeaderPages é€™å€‹é™£åˆ—å°±å¥½ã€‚
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
           â˜… æ–°å¢ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œåœ°åœ–é é¢
           æ¨™é¡Œåˆ—ç²¾ç°¡æ¨¡å¼ï¼‰ï¼šåœ°åœ–é é¢ç¾åœ¨
           åªé¡¯ç¤ºåœ°åœ–åç¨±ä¸€è¡Œæ–‡å­—ï¼Œå…¶ä»–é é¢
           ï¼ˆæˆ°é¬¥/ç‹€æ…‹/æŠ€èƒ½/èƒŒåŒ…ï¼‰é‚„æ˜¯å®Œæ•´
           å…©è¡Œè§’è‰²è³‡è¨Šï¼Œåªåœ¨çœŸçš„åˆ‡åˆ°map
           é é¢æ™‚åŠ ä¸Šé€™å€‹classã€‚
        */

        appElement.classList.toggle(

            "map-header-compact",

            page==="map"

        );


        /*
           â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œä¸»åŸæ–°å¢
           ã€Œåˆæˆã€ã€Œç³»çµ±ã€è®Šæˆ3æ’å¡ç‰‡ï¼Œ
           åŸæœ¬ã€Œä¸èƒ½æ²å‹•ã€çš„é™åˆ¶åœ¨å…§å®¹è®Šå¤š
           ä¹‹å¾Œï¼Œé¢¨éšªæ˜¯æœƒæŠŠæ–°å¢çš„ç¬¬3æ’å¡ç‰‡
           ç›´æ¥è£æ‰ã€å®Œå…¨çœ‹ä¸åˆ°â€”â€”é€™æ¯”ã€Œå¶çˆ¾
           éœ€è¦æ»‘ä¸€ä¸‹ã€åš´é‡å¾—å¤šã€‚æ”¹æˆåªæœ‰
           mapé é¢ç¶­æŒä¸èƒ½æ²å‹•ï¼ˆåœ°åœ–é é¢
           å…§å®¹é‡æ²’æœ‰è®Šã€ç¹¼çºŒé©ç”¨ï¼‰ï¼Œä¸»åŸ
           æ‹¿æ‰é€™å€‹é™åˆ¶ï¼Œæ”¹å›å…è¨±æ²å‹•ï¼Œ
           ç¢ºä¿å…§å®¹è®Šå¤šçš„æ™‚å€™éƒ½çœ‹å¾—åˆ°ï¼Œ
           ä¸æœƒè¢«éœéœè£æ‰ã€‚
        */

        /*
           V89ï¼šä¸»åŸèˆ‡åœ°åœ–éƒ½å±¬æ–¼å›ºå®šç•«é¢ã€‚
           ä¸»åŸåŸæœ¬å› æ­·å²éœ€æ±‚è¢«æ’é™¤åœ¨ no-scroll-page ä¹‹å¤–ï¼Œ
           ä½†ç¾åœ¨ä¸»åŸå¡ç‰‡å·²èƒ½å®Œæ•´å¡é€²å›ºå®šèˆå°ï¼›é…åˆ #homePage
           ä¸å†ä½¿ç”¨ 100vhï¼Œæ­£å¼è®“ home/map éƒ½ä¸ç”¢ç”Ÿå¤–å±¤æ²å‹•ã€‚
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
           â˜… æ–°å¢ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œåœ°åœ–é é¢
           æ›æˆå°ˆå±¬çš„è§’è‰²/ä»»å‹™/è¿”å›å°è¦½åˆ—ï¼‰ï¼š
        */

        appElement.classList.toggle(

            "on-map-page",

            page==="map"

        );


        /*
           â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œæ‹¿æ‰
           ä¸»åŸç«‹ç¹ªï¼‰ï¼šåŸæœ¬é€™è£¡æ¯æ¬¡åˆ‡åˆ°
           ä¸»åŸé é¢æœƒå‘¼å«showHomePortrait()
           éš¨æ©Ÿæ›ä¸€å¼µç«‹ç¹ªï¼Œåœ–ç‰‡æœ¬èº«è·Ÿç›¸é—œ
           å‡½å¼éƒ½å·²ç¶“æ•´æ®µç§»é™¤ï¼Œé€™å€‹å‘¼å«
           ä¸€ä½µæ‹¿æ‰ï¼Œä¸ç•™æ­»ä»£ç¢¼ã€‚
        */


        /*
           â˜… æ–°å¢ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼‰ï¼š
           æˆ°é¬¥ä¸­æŠŠåº•éƒ¨ä¸»åŸ/ç·´åŠŸå€/ç‹€æ…‹/æŠ€èƒ½/èƒŒåŒ…
           é‚£æ’å°è¦½åˆ—ä¹Ÿä¸€ä½µè—èµ·ä¾†ï¼Œ
           æˆ°é¬¥æ™‚ç”¨ä¸åˆ°ï¼Œè—èµ·ä¾†å‰›å¥½å¤šå‡ºä¸€æˆªç©ºé–“ï¼Œ
           å°ã€Œä¸è¦æ²å‹•ã€é€™å€‹éœ€æ±‚ä¹Ÿæœ‰å¹«åŠ©ã€‚
           åªåœ¨battleé é¢è—ï¼Œå…¶ä»–é é¢
           ï¼ˆèƒŒåŒ…/ç‹€æ…‹/æŠ€èƒ½ï¼‰é‚„æ˜¯è¦çœ‹å¾—åˆ°å°è¦½åˆ—ï¼Œ
           ä¸ç„¶æ²’è¾¦æ³•åˆ‡æ›é é¢ã€‚
        */

        appElement.classList.toggle(
            "in-battle",
            page==="battle"
        );

        /*
           V78ï¼š
           åº•éƒ¨å°è¦½åˆ—ç›´æ¥é–‹å•Ÿçš„èƒŒåŒ…é ï¼Œ
           çœŸæ­£ scroll owner æ˜¯ .contentã€‚
        */
        appElement.classList.toggle(
            "on-inventory-page",
            page==="inventory"
        );

        /*
           V79 ROOT FIXï¼š
           ç›´æ¥ç”±åº•éƒ¨å°è¦½é€²èƒŒåŒ…æ™‚ï¼Œnative scroll owner æ˜¯ .contentã€‚
           åªæ”¹ .content çš„ touch-action ä¸å¤ ï¼Œå› ç‚º #game-viewport
           åœ¨ V5/V8 æ¶æ§‹ä¸­é•·æœŸä½¿ç”¨ touch-action:none é–ä½æ•´å€‹éŠæˆ²ã€‚
           Android / Samsung Browser æœƒåœ¨æ‰‹å‹¢é–‹å§‹æ™‚æŠŠç¥–å…ˆ touch-action
           ä¸€èµ·ç´å…¥åˆ¤å®šï¼›å› æ­¤é€™è£¡æ²¿ç”¨ V64 å·²é©—è­‰çš„è§’è‰²è¦–çª—åšæ³•ï¼Œ
           åœ¨ã€ŒèƒŒåŒ…é å­˜åœ¨æœŸé–“ã€åŒæ­¥æ”¾è¡Œ html/body/viewport/stage çš„ pan-yã€‚
           é›¢é–‹èƒŒåŒ…ç«‹åˆ»ç§»é™¤ï¼Œä¸æ”¹åœ°åœ–ã€æˆ°é¬¥èˆ‡å…¶ä»–é é¢çš„æ‰‹å‹¢æ”¿ç­–ã€‚
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
       â˜… æ–°å¢ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼‰ï¼š
       æˆ°é¬¥è³‡è¨Šï¼è‡ªå‹•æˆ°é¬¥è¦†è“‹å±¤åªåœ¨ã€Œåœ°åœ–
       ï¼ˆå·¡é‚ï¼‰é é¢ã€é¡¯ç¤ºâ€”â€”æˆ°é¬¥é é¢æœ¬èº«
       å·²ç¶“æœ‰åŸæœ¬é‚£ä»½ï¼Œé€™è£¡é€™ä»½åªè² è²¬
       ã€Œé›¢é–‹æˆ°é¬¥ã€å›åˆ°åœ°åœ–ä¹‹å¾Œé‚„èƒ½ç¹¼çºŒ
       çœ‹åˆ°ä¸Šä¸€å ´æˆ°é¬¥è³‡è¨Šã€é€™ä»¶äº‹ï¼Œ
       å…¶ä»–é é¢ï¼ˆä¸»åŸ/ç·´åŠŸå€é¸æ“‡/ç‹€æ…‹/
       æŠ€èƒ½/èƒŒåŒ…ï¼‰éƒ½ä¸éœ€è¦ï¼Œä¸€ä½µéš±è—ã€‚
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
       â˜… æ–°å¢ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼‰ï¼š
       é é¢åˆ‡æ›çš„ç•¶ä¸‹ï¼Œç«‹åˆ»é‡æ–°åˆ¤æ–·æœ€ä¸Šé¢
       æ¨™é¡Œåˆ—è¦é¡¯ç¤ºã€Œè§’è‰²è³‡è¨Šã€é‚„æ˜¯ã€Œåœ°åœ–+
       æ€ªç‰©è³‡è¨Šã€ï¼Œä¸ç”¨ç­‰ä¸‹ä¸€æ¬¡updateUI()
       æ‰ç”Ÿæ•ˆï¼Œåˆ‡éå»çš„ç¬é–“å°±æ˜¯å°çš„ã€‚
    */

    updateMapPageHeader();


    /*
       â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…å›å ±ï¼ŒçœŸæ­£æŠ“åˆ°
       ã€Œæ‰“å®Œä¸€å ´æˆ°é¬¥å›åœ°åœ–ï¼Œå·¡æ€ªå‹•ç•«å°±å£æ‰ã€
       åœ–ç‰‡è®Šå¤§ã€çš„åŸå› ï¼‰ï¼š
       åŸæœ¬åªæœ‰enterZone()â†’enterMap()é‚£æ¢è·¯å¾‘
       æœƒå‘¼å«resetPatrolCharacterToIdle()ï¼Œ
       ä½†winBattle()/loseBattle()/é€ƒè„«æˆåŠŸ
       ä¹‹å¾Œï¼Œéƒ½æ˜¯ç›´æ¥å‘¼å«showPage("map")
       è¿”å›åœ°åœ–ï¼Œå®Œå…¨ç¹éenterMap()â€”â€”å¦‚æœ
       æˆ°é¬¥å‰›å¥½æ˜¯åœ¨å·¡æ€ªèµ°è·¯ä¸­ã€ç”šè‡³æ˜¯æ‰“æ¶
       ç‰¹æ•ˆæ”¾å¤§åˆ°120pxçš„é‚£ä¸€åˆ»è¢«è§¸ç™¼ï¼Œå›ä¾†
       å¾Œæ²’æœ‰ä»»ä½•æ±è¥¿æŠŠè§’è‰²åœ–ç¤ºçš„å°ºå¯¸ï¼
       ä½ç½®ï¼è¨ˆæ™‚å™¨é‡ç½®ä¹¾æ·¨ï¼Œæ‰æœƒçœ‹åˆ°åœ–ç‰‡
       äº‚è·³ã€äººç‰©è®Šå¤§ã€å·¡æ€ªä¸­æ¨™ç±¤æ¶ˆå¤±ã€‚

       æ”¹æˆåœ¨showPage()é€™è£¡çµ±ä¸€è™•ç†ï¼Œ
       ä¸ç®¡æ˜¯å¾å“ªè£¡å‘¼å«showPage("map")ï¼Œ
       åªè¦åˆ‡åˆ°åœ°åœ–é é¢ï¼Œéƒ½æœƒä¾ç…§
       autoPatrolEnabledç›®å‰çš„ç‹€æ…‹ï¼Œ
       æ±ºå®šè¦ã€Œé‡æ–°é–‹å§‹èµ°è·¯ã€ï¼ˆå·¡æ€ªé‚„é–‹è‘—ï¼‰
       é‚„æ˜¯ã€Œå›åˆ°ç½®ä¸­éœæ­¢ã€ï¼ˆå·¡æ€ªå·²ç¶“é—œäº†ï¼‰ï¼Œ
       å…©ç¨®æƒ…æ³éƒ½æœƒå…ˆæŠŠå°ºå¯¸/ä½ç½®é‡ç½®ä¹¾æ·¨ï¼Œ
       ä¸æœƒå†æ®˜ç•™ä»»ä½•ä¸Šä¸€å ´æˆ°é¬¥å‰çš„ç‹€æ…‹ã€‚
    */

    if(page==="map"){

        if(autoPatrolEnabled){

            startPatrolCharacterWalking();


            /*
               â˜… ä¿®æ­£ï¼ˆçœŸæ­£æŠ“åˆ°ã€Œæˆ°é¬¥å®Œå‡ºä¾†
               ç›´æ¥æ‰“æ¶å‹•ç•«ã€æ²’5ç§’åˆé€²æˆ°é¬¥ã€
               çš„åŸå› ï¼‰ï¼š
               è‡ªå‹•å·¡æ€ªçš„ã€Œæ¯5ç§’æª¢æŸ¥ä¸€æ¬¡ã€è¨ˆæ™‚å™¨
               ï¼ˆautoPatrolIntervalIdï¼‰ï¼ŒåŸæœ¬æ˜¯
               å¾ç©å®¶æœ€æ—©æŒ‰ä¸‹ã€Œè‡ªå‹•å·¡æ€ªã€é‚£ä¸€åˆ»
               é–‹å§‹ç®—çš„å›ºå®šé€±æœŸï¼Œå®Œå…¨ä¸ç®¡ä¸­é–“
               æ‰“äº†å¹¾å ´æˆ°é¬¥ã€æ¯å ´æ‰“äº†å¤šä¹…â€”â€”
               æˆ°é¬¥ä¸­é€™å€‹è¨ˆæ™‚å™¨ç…§æ¨£åœ¨èƒŒæ™¯æ¯5ç§’
               è·³ä¸€æ¬¡ï¼ˆåªæ˜¯battleActive=true
               æœƒè®“å®ƒææ—©returnï¼Œä¸æœƒçœŸçš„åšäº‹ï¼‰ã€‚

               æˆ°é¬¥çµæŸã€å›åˆ°åœ°åœ–çš„ç¬é–“ï¼Œå¦‚æœ
               å‰›å¥½å¡åœ¨é€™å€‹è¨ˆæ™‚å™¨ã€Œé€™æ¬¡è¦è·³å‹•ã€
               çš„æ™‚é–“é»é™„è¿‘ï¼Œå°±æœƒå¹¾ä¹æ˜¯æˆ°é¬¥ä¸€
               çµæŸé¦¬ä¸Šåˆè§¸ç™¼ä¸‹ä¸€æ¬¡æª¢æŸ¥â€”â€”å¯èƒ½
               åªé–“éš”é›¶é»å¹¾ç§’ï¼Œå®Œå…¨è·Ÿé€™å ´æˆ°é¬¥
               æ‰“äº†å¤šä¹…ç„¡é—œï¼Œé€™æ‰æ˜¯ã€Œæ²’5ç§’åˆ
               é€²æˆ°é¬¥ã€çš„çœŸæ­£åŸå› ï¼Œä¸æ˜¯é‡è©¦
               é‚è¼¯çš„å•é¡Œã€‚

               ä¿®æ³•ï¼šæ¯æ¬¡çœŸçš„å›åˆ°åœ°åœ–é é¢æ™‚ï¼Œ
               æŠŠé€™å€‹è¨ˆæ™‚å™¨æ¸…æ‰ã€é‡æ–°å•Ÿå‹•ä¸€å€‹
               æ–°çš„ï¼Œè®“ã€Œ5ç§’ã€ä¿è­‰æ˜¯å¾ã€Œå›åˆ°
               åœ°åœ–çš„é€™ä¸€åˆ»ã€é–‹å§‹ç®—ï¼Œä¸æœƒå†
               æ²¿ç”¨æˆ°é¬¥å‰å°±å·²ç¶“åœ¨è·‘ã€è·Ÿé€™æ¬¡
               æˆ°é¬¥çµæŸæ™‚é–“é»å®Œå…¨ç„¡é—œçš„èˆŠæ™‚é˜ã€‚
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
       â˜… æ–°å¢ï¼šå‰¯æœ¬/BOSSé é¢ä¸€é–‹å•Ÿå°±é¡¯ç¤º
       ç¬¬ä¸€å€‹åˆ†é çš„å…§å®¹ï¼Œä¸ç”¨ç©å®¶è‡ªå·±
       å…ˆé»ä¸€æ¬¡åˆ†é æŒ‰éˆ•æ‰çœ‹å¾—åˆ°æ±è¥¿ã€‚
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
   åœ°åœ–
===================================================== */

/*
   â˜… ç·´åŠŸå€åˆ‡æ›ã€‚

   ä¹‹å‰ã€Œè’æ¼ åœ°å¸¶ã€åªæ˜¯è¦æ ¼æ›¸è£¡çš„é–ä½ä½”ä½å¡ï¼Œ
   å®Œå…¨æ²’æœ‰çœŸæ­£çš„åœ°åœ–è·Ÿæ€ªç‰©è³‡æ–™ã€‚
   ç¾åœ¨è£œä¸Šï¼šé”åˆ°Lv.11å°±èƒ½çœŸçš„é€²å»ï¼Œ
   æ€ªç‰©æ›æˆdesertMonstersï¼ˆæ˜é¡¯æ¯”æ–°æ‰‹æ£®æ—ç¡¬ï¼‰ï¼Œ
   æ–¹ä¾¿æ¸¬è©¦ç‡ƒç‡’ä¹‹é¡éœ€è¦æ€ªç‰©æ’ä¹…ä¸€é»æ‰çœ‹å¾—å‡ºæ•ˆæœçš„æŠ€èƒ½ã€‚
*/

/*
   â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚æ–°å¢5å€‹å€åŸŸå¾Œï¼Œ
   æ”¹ç”¨è³‡æ–™é©…å‹•çš„æ–¹å¼æ•´ç†ï¼Œé¿å…æ¯åŠ ä¸€å€‹
   å€åŸŸå°±è¦åœ¨å¥½å¹¾å€‹å‡½å¼è£¡å„è‡ªè¤‡è£½è²¼ä¸Š
   ä¸€æ®µå¹¾ä¹ä¸€æ¨£çš„ifåˆ¤æ–·ï¼Œä¹‹å¾Œè¦å†åŠ 
   ç¬¬9ã€10å€ä¹Ÿåªè¦åœ¨é€™ä»½æ¸…å–®è£¡åŠ ä¸€ç­†ï¼‰ã€‚
*/

const zoneConfig = {

    forest:{
        requiredLevel:0,
        monsters:()=>forestMonsters,
        title:"æ–°æ‰‹æ£®æ—",
        desc:"Lv.1ï½10ï½œä¸€èˆ¬ç·´åŠŸå€æœ€å¤š6éš»æ€ªç‰©",
        levelRange:"Lv.1ï½10"
    },

    desert:{
        requiredLevel:11,
        monsters:()=>desertMonsters,
        title:"è’æ¼ åœ°å¸¶",
        desc:"Lv.11ï½20ï½œæ€ªç‰©æ˜é¡¯è¼ƒå¼·ï¼Œé©åˆæ¸¬è©¦æŠ€èƒ½æ•ˆæœ",
        levelRange:"Lv.11ï½20"
    },

    ice:{
        requiredLevel:21,
        monsters:()=>iceMountainMonsters,
        title:"å†°éœœå±±è„ˆ",
        desc:"Lv.21ï½30ï½œæ€ªç‰©é–‹å§‹æœ‰å±¬æ€§ã€æœƒæ–½æ”¾æŠ€èƒ½",
        levelRange:"Lv.21ï½30"
    },

    zone4:{
        requiredLevel:31,
        monsters:()=>zone4Monsters,
        title:"ç†”å²©æ·±æ·µ",
        desc:"Lv.31ï½40ï½œæ€ªç‰©æŠ€èƒ½1å€‹ï¼Œæ–½æ”¾æ©Ÿç‡55%",
        levelRange:"Lv.31ï½40"
    },

    zone5:{
        requiredLevel:41,
        monsters:()=>zone5Monsters,
        title:"å·¨ç¸è’åŸ",
        desc:"Lv.41ï½50ï½œæ€ªç‰©æŠ€èƒ½2å€‹ï¼Œæ–½æ”¾æ©Ÿç‡60%",
        levelRange:"Lv.41ï½50"
    },

    zone6:{
        requiredLevel:51,
        monsters:()=>zone6Monsters,
        title:"ä¿®ç¾…æˆ°å ´",
        desc:"Lv.51ï½60ï½œæ€ªç‰©æŠ€èƒ½2å€‹ï¼Œæ–½æ”¾æ©Ÿç‡65%",
        levelRange:"Lv.51ï½60"
    },

    zone7:{
        requiredLevel:61,
        monsters:()=>zone7Monsters,
        title:"é­”å›ç¥­å£‡",
        desc:"Lv.61ï½70ï½œæ€ªç‰©æŠ€èƒ½3å€‹ï¼Œæ–½æ”¾æ©Ÿç‡65%",
        levelRange:"Lv.61ï½70"
    },

    zone8:{
        requiredLevel:71,
        monsters:()=>zone8Monsters,
        title:"é¾ç„æ·±æ·µ",
        desc:"Lv.71ï½80ï½œæ€ªç‰©æŠ€èƒ½3å€‹ï¼Œæ–½æ”¾æ©Ÿç‡70%",
        levelRange:"Lv.71ï½80"
    },

    zone9:{
        requiredLevel:81,
        monsters:()=>zone9Monsters,
        title:"è™›ç©ºç›¡é ­",
        desc:"Lv.81ï½90ï½œæ€ªç‰©æŠ€èƒ½3å€‹ï¼Œæ–½æ”¾æ©Ÿç‡70%",
        levelRange:"Lv.81ï½90"
    },

    zone10:{
        requiredLevel:91,
        monsters:()=>zone10Monsters,
        title:"çµ‚ç„‰ä¹‹å¢ƒ",
        desc:"Lv.91ï½100ï½œæ€ªç‰©æŠ€èƒ½3å€‹ï¼Œæ–½æ”¾æ©Ÿç‡70%",
        levelRange:"Lv.91ï½100"
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
            "éœ€è¦é”åˆ° Lv."+
            config.requiredLevel+
            "æ‰èƒ½é€²å…¥"+
            config.title.replace(
                /^\S+\s/,
                ""
            )+
            "ã€‚"
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
       â˜… ä¿®æ­£ï¼ˆæ”¹ç”¨zoneConfigçµ±ä¸€ç®¡ç†ï¼Œ
       ä¸ç”¨å†æ¯åŠ ä¸€å€‹å€åŸŸå°±è¤‡è£½è²¼ä¸Š
       ä¸€æ•´æ®µif-elseï¼‰ã€‚
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
       â˜… ä¿®æ­£ï¼ˆåœ°åœ–é‡æ–°è¨­è¨ˆï¼‰ï¼š
       åŸæœ¬ç›´æ¥ç”¨element.textContentå¯«å…¥emojiï¼Œ
       ä½†ç¾åœ¨æ€ªç‰©å¡ç‰‡å…§éƒ¨æ”¹æˆ
       icon/name/levelä¸‰å€‹ç¨ç«‹çš„å­å…ƒç´ ï¼Œ
       è¦åˆ†åˆ¥å¯«å…¥å°æ‡‰çš„æ¬„ä½ï¼Œ
       ä¸èƒ½å†æ•´å€‹è“‹æ‰ï¼ˆé‚£æ¨£åç¨±è·Ÿç­‰ç´šéƒ½æœƒæ¶ˆå¤±ï¼‰ã€‚
    */

    monsters.forEach(
        (monster,index)=>{

            const element =
                $("mapMonster"+index);


            if(!element){
                return;
            }


            const icon =
                monster.name==="æ²™æ¼ è±ºç‹¼"
                ?
                ""
                :
                monster.name==="æ²™è "
                ?
                ""
                :
                monster.name==="å²èŠå§†"
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
               â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œåœ°åœ–ä¸å†
               é¡¯ç¤ºæ€ªç‰©åœ–ç¤ºï¼Œæ”¹æˆå›ºå®šæ™‚é–“è‡ªå‹•
               è§¸ç™¼æˆ°é¬¥ï¼‰ï¼š
               é€™è£¡åŸæœ¬è² è²¬ä¾å­˜æ´»ç‹€æ…‹åˆ‡æ›åœ–ç¤º
               é¡¯ç¤º/éš±è—ï¼Œä½†ç¾åœ¨æ•´å€‹.map-monster
               å·²ç¶“åœ¨CSSè£¡æ°¸ä¹…è¨­æˆdisplay:noneï¼Œ
               ä¸éœ€è¦å†ç”±JSé€™è£¡å¦å¤–æ§åˆ¶é¡¯ç¤ºç‹€æ…‹ï¼Œ
               ä¹Ÿä¸èƒ½å†è¨­inlineçš„displayï¼Œ
               ä¸ç„¶è¡Œå…§æ¨£å¼çš„å„ªå…ˆæ¬Šæœƒè“‹æ‰CSSçš„
               display:noneï¼Œè®“åœ–ç¤ºåˆè·‘å‡ºä¾†ã€‚
               é€™è£¡åªä¿ç•™ä¸Šé¢icon/name/level
               æ–‡å­—å…§å®¹çš„æ›´æ–°ï¼ˆé›–ç„¶åœ–ç¤ºä¸æœƒé¡¯ç¤ºï¼Œ
               ä½†ä¿ç•™é€™éƒ¨åˆ†é‚è¼¯ä»¥é˜²ä¹‹å¾Œåˆè¦
               é‡æ–°å•Ÿç”¨ï¼‰ï¼Œæ‹¿æ‰displayçš„è¨­å®šã€‚
            */

        }
    );

}


/*
   â˜… æ›´æ–°ç·´åŠŸå€åˆ—è¡¨é é¢è£¡ï¼Œè’æ¼ åœ°å¸¶é‚£å¼µå¡ç‰‡çš„
   é–å®šç‹€æ…‹è·ŸæŒ‰éˆ•ã€‚
   é”åˆ°Lv.11ä¹‹å¾Œå¡ç‰‡æœƒè§£é–ã€é¡¯ç¤ºã€Œé€²å…¥åœ°åœ–ã€æŒ‰éˆ•ï¼Œ
   åœ¨é€™ä¹‹å‰ä¿æŒåŸæœ¬é–ä½çš„æ¨£å­ã€‚
*/

function updateTrainingZoneLocks(){

    /*
       â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œç·´åŠŸå€æ”¹ç‰ˆï¼Œ
       ç´”æ–‡å­—åˆ—è¡¨å–ä»£å¡ç‰‡ï¼‰ï¼š
       åŸæœ¬æ“ä½œçš„æ˜¯å¡ç‰‡è£¡çš„.map-descæ–‡å­—/
       æŒ‰éˆ•å€å¡Šï¼Œé€™äº›å…ƒç´ å·²ç¶“ä¸å­˜åœ¨äº†ã€‚
       æ”¹æˆå–®ç´”åˆ‡æ›.training-zone-itemçš„
       .lockedé€™å€‹classï¼ˆç´”CSSèª¿æš—ï¼Œ
       ä¸éš±è—æ–‡å­—æœ¬èº«ï¼Œé»ä¸‹å»é‚„æ˜¯èƒ½çœ‹
       è³‡è¨Šæ¡†ã€åªæ˜¯è³‡è¨Šæ¡†è£¡çš„é€²å…¥æŒ‰éˆ•æœƒè¢«
       æ›æˆã€Œéœ€è¦Lv.Xã€çš„æç¤ºï¼Œé‚è¼¯ç§»åˆ°
       openTrainingZoneInfo()è£¡è™•ç†ï¼‰ï¼Œ
       é€™è£¡åªè² è²¬ã€Œæ–‡å­—è¦ä¸è¦èª¿æš—ã€é€™ä»¶äº‹ã€‚

       idå°ç…§æ²¿ç”¨æ–°HTMLè£¡çš„
       trainingZoneItem_deserté€™ç¨®å‘½å
       è¦å‰‡ã€‚
    */

    const lockableZones=[

        {key:"desert",itemId:"trainingZoneItem_desert"},        {key:"ice",itemId:"trainingZoneItem_ice"},
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
   â˜… ç¬¬äºŒè§’è‰²è§£é–æç¤ºã€‚
   Lv.10ä¹‹å¾Œã€é‚„æ²’å‰µå»ºç¬¬äºŒè§’è‰²æ™‚é¡¯ç¤ºï¼Œ
   å‰µå»ºå®Œæˆå¾Œå°±ä¸æœƒå†é¡¯ç¤ºé€™å¼µå¡ç‰‡äº†ã€‚
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
       â˜… æ–°å¢ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œå·¡æ€ªé é¢
       èƒŒæ™¯ä¾åœ°å€å‹•æ…‹åˆ‡æ›ï¼‰ï¼šæ¯æ¬¡é€²å…¥
       åœ°åœ–é é¢ï¼Œå¥—ç”¨ç›®å‰é€™å€‹åœ°å€
       ï¼ˆcurrentZoneï¼‰å°æ‡‰çš„èƒŒæ™¯åœ–ã€‚
    */

    applyMapZoneBackground(
        currentZone
    );


    /*
       â˜… æ–°å¢ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼‰ï¼š
       æ¯æ¬¡é€²å…¥åœ°åœ–é é¢ï¼Œå·¡æ€ªè§’è‰²åœ–ç¤ºå›åˆ°
       ç½®ä¸­éœæ­¢ã€æ­£é¢åœ–çš„é è¨­ç‹€æ…‹â€”â€”ä¸ç®¡
       ä¸Šä¸€æ¬¡é›¢é–‹åœ°åœ–æ™‚èµ°åˆ°å“ªã€è‡ªå‹•å·¡æ€ª
       é–‹è‘—é‚„é—œè‘—ï¼Œé€™è£¡éƒ½é‡æ–°æ­¸é›¶ã€‚
    */

    resetPatrolCharacterToIdle();


    /*
       â˜… æ¯æ¬¡é€²åœ°åœ–ï¼Œç©å®¶æ£‹ç›¤åº§æ¨™é‡ç½®å›ä¸­å¤®ï¼Œ
       è·Ÿéš¨æ–¹å¡Šçš„è·¯å¾‘ç´€éŒ„ä¹Ÿä¸€ä½µæ¸…ç©ºï¼Œ
       é¿å…å¸¶è‘—ä¸Šæ¬¡æ®˜ç•™çš„ä½ç½®è³‡æ–™ã€‚
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
   è‡ªå‹•å·¡æ€ª
===================================================== */

/*
   â˜… æ–°å¢ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼‰ï¼š
   ã€Œè‡ªå‹•å·¡æ€ªã€è·Ÿã€Œè‡ªå‹•æˆ°é¬¥ã€æ˜¯å…©ä»¶ç¨ç«‹çš„äº‹ï¼š
   è‡ªå‹•æˆ°é¬¥æ§åˆ¶çš„æ˜¯ã€Œæˆ°é¬¥é–‹å§‹ä¹‹å¾Œï¼Œè§’è‰²è¦ä¸è¦
   è‡ªå‹•å‡ºæ‰‹ã€ï¼›è‡ªå‹•å·¡æ€ªæ§åˆ¶çš„æ˜¯ã€Œæˆ°é¬¥å¤–ï¼Œ
   è¦ä¸è¦è‡ªå‹•å»æ‰¾æ€ªç‰©æ‰“ã€ã€‚å…©è€…äº’ä¸ä¾è³´ï¼Œ
   å¯ä»¥åªé–‹ä¸€å€‹ï¼Œä¹Ÿå¯ä»¥å…©å€‹éƒ½é–‹ã€‚

   å¯¦ä½œä¸Šå¾ˆå–®ç´”ï¼šæŒ‰ä¸‹å»ä¹‹å¾Œï¼Œæ¯4ç§’æª¢æŸ¥ä¸€æ¬¡
   ç›®å‰åœ°åœ–ä¸Šï¼ˆmonsters[0]~monsters[MAX_
   TRAINING_MONSTERS-1]ï¼‰é‚„æœ‰æ²’æœ‰æ´»è‘—çš„æ€ªç‰©ï¼Œ
   æœ‰çš„è©±ç›´æ¥å‘¼å«startBattle()å°ç¬¬ä¸€éš»æ´»è‘—çš„
   æ€ªç‰©é–‹æˆ°â€”â€”ä¸ç”¨çœŸçš„æ¨¡æ“¬ç©å®¶åœ¨åœ°åœ–ä¸Šèµ°éå»ï¼Œ
   å–®ç´”åªæ˜¯ã€Œå®šæœŸè‡ªå‹•è§¸ç™¼æˆ°é¬¥ã€ã€‚

   å¦‚æœç›®å‰å·²ç¶“åœ¨æˆ°é¬¥ä¸­ï¼ˆbattleActiveï¼‰ï¼Œ
   é€™æ¬¡æª¢æŸ¥å°±è·³éã€ä»€éº¼éƒ½ä¸åšï¼Œç­‰ä¸‹ä¸€æ¬¡
   4ç§’å¾Œå†æª¢æŸ¥â€”â€”æˆ°é¬¥çµæŸå¾Œï¼Œä¸‹ä¸€æ¬¡æª¢æŸ¥
   è‡ªç„¶å°±æœƒæŠ“åˆ°é‚„æ´»è‘—çš„æ€ªç‰©ç¹¼çºŒæ‰“ï¼Œ
   ä¸éœ€è¦é¡å¤–è™•ç†ã€Œæˆ°é¬¥çµæŸå¾Œè¦ä¸è¦æ¢å¾©ã€ï¼Œ
   setIntervalæœ¬ä¾†å°±æœƒä¸€ç›´æ¯4ç§’åŸ·è¡Œä¸€æ¬¡ã€‚
*/

let autoPatrolEnabled=
    false;

let autoPatrolIntervalId=
    null;

/*
   â˜… æœ€çµ‚ä¿®æ­£ï¼šè‡ªå‹•å·¡æ€ªæ”¹ç”¨ã€Œå–®æ¬¡5ç§’æ’ç¨‹ + è‡ªæˆ‘çºŒæ’ã€
   å–ä»£å–®ç´”ä¾è³´setIntervalã€‚
   é€™ä»ç„¶ç¶­æŒåŸæœ¬ã€Œæ¯5ç§’æª¢æŸ¥ä¸€æ¬¡ã€çš„éŠæˆ²æ©Ÿåˆ¶ï¼Œ
   ä½†æˆ°é¬¥åˆ‡é ã€æ‰‹æ©ŸèƒŒæ™¯å–šé†’ã€è¨ˆæ™‚å™¨è¢«æ¸…é™¤ç­‰æƒ…æ³ä¸‹ï¼Œ
   ä¸‹ä¸€æ¬¡æª¢æŸ¥æœƒé‡æ–°å»ºç«‹ï¼Œä¸æœƒå› è¨ˆæ™‚å™¨å¤±æ•ˆè€Œæ°¸ä¹…åœæ­¢ã€‚
*/
let autoPatrolTimeoutId=
    null;


/*
   â˜… æ–°å¢ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œå·¡æ€ªèµ°è·¯å‹•ç•«ï¼‰ï¼š
   å››å¼µåœ–åˆ†åˆ¥æ˜¯ï¼šéœæ­¢/å¾€ä¸‹èµ°ç”¨çš„æ­£é¢åœ–ã€
   å¾€ä¸Šèµ°ç”¨çš„èƒŒé¢åœ–ã€é€²å…¥æˆ°é¬¥å‰ç‰¹æ•ˆç”¨çš„
   å…©å¼µæ‰“æ¶åœ–ï¼Œå…¨éƒ¨è½‰æˆbase64å…§åµŒï¼Œ
   å–®ä¸€HTMLæª”æ¡ˆä¸ä¾è³´å¤–éƒ¨åœ–ç‰‡è·¯å¾‘ã€‚
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
   â˜… é˜²æ­¢ã€Œæ­£åœ¨æ’­æ”¾æ‰“æ¶ç‰¹æ•ˆã€çš„ç•¶ä¸‹ï¼Œ
   å‰›å¥½è¢«å·¡æ€ªèµ°è·¯çš„è¨ˆæ™‚å™¨æ‰“æ–·ã€æŠŠç•«é¢
   æ›å›æ­£é¢/èƒŒé¢åœ–â€”â€”è¦‹
   movePatrolCharacterRandomly()é–‹é ­
   çš„åˆ¤æ–·ã€‚
*/

let patrolInFightAnimation=
    false;

let patrolFightAnimTimeoutIds=
    [];

/*
   â˜… æ–°å¢ï¼šæ‰¾åˆ°æ€ªç‰©ã€æ­£åœ¨æ’­1ç§’é˜æ‰“æ¶ç‰¹æ•ˆã€
   ä½†çœŸæ­£çš„startBattle()é‚„æ²’è¢«å‘¼å«çš„é€™æ®µ
   ç©ºæª”ï¼Œæ“‹æ‰runAutoPatrolCheck()é‡è¤‡è§¸ç™¼ã€‚
   è¦‹runAutoPatrolCheck()é–‹é ­çš„åˆ¤æ–·ã€‚
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
   â˜… é€²å…¥åœ°åœ–é é¢æ™‚ï¼ˆenterZone()ï¼
   showPage()åˆ‡åˆ°mapçš„æ™‚å€™ï¼‰å‘¼å«ï¼Œ
   è®“è§’è‰²å›åˆ°ã€Œéœæ­¢ç½®ä¸­ã€æ­£é¢åœ–ã€çš„
   é è¨­ç‹€æ…‹ï¼Œä¸ç®¡ä¹‹å‰å·¡æ€ªèµ°åˆ°å“ªè£¡å»äº†ã€‚
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
           â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œè·Ÿ
           movePatrolCharacterRandomly()
           çš„22%~52%æ–°ç¯„åœä¿æŒä¸€è‡´ï¼‰ï¼š
           åŸæœ¬50%å·²ç¶“è¶…å‡ºæ–°çš„ç§»å‹•ç¯„åœï¼Œ
           æ”¹æˆæ–°ç¯„åœçš„ä¸­é–“å€¼ï¼ˆ37%ï¼‰ï¼Œ
           éœæ­¢ç‹€æ…‹çš„ä½ç½®ä¹Ÿæœƒè½åœ¨åˆç†ç¯„åœ
           å…§ï¼Œä¸æœƒä¸€é–‹å§‹å°±è²¼è¿‘æˆ°é¬¥è³‡è¨Šæ¡†ã€‚
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
   â˜… å·¡æ€ªèµ°è·¯ï¼šæ¯éš”ä¸€æ®µæ™‚é–“æ›ä¸€å€‹éš¨æ©Ÿåº§æ¨™ï¼Œ
   é€éCSS transitionè‡ªç„¶ç§»å‹•éå»ï¼›è·ŸèˆŠåº§æ¨™
   æ¯”è¼ƒYè»¸ï¼ˆtopï¼‰ï¼Œè®Šå°ï¼å¾€ä¸Šèµ°ï¼æ›èƒŒé¢åœ–ï¼Œ
   è®Šå¤§æˆ–ä¸è®Šï¼å¾€ä¸‹èµ°ï¼åŸåœ°ï¼æ›æ­£é¢åœ–ã€‚
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
       â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œã€Œå·¡æ€ª
       äººç‰©ä¸è¦è¶…å‡ºæˆ°é¬¥è³‡è¨Šçš„ä¸Šç·£ã€ï¼‰ï¼š
       åœ°åœ–é é¢ä¸‹æ–¹çš„è‡ªå‹•æˆ°é¬¥/è‡ªå‹•å·¡æ€ª/
       æˆ°é¬¥è³‡è¨Šé‚£å€‹å€å¡Šæ˜¯position:fixed
       è²¼åœ¨è¢å¹•åº•éƒ¨çš„ï¼Œè·Ÿé€™è£¡ç”¨ã€Œç›¸å°
       #mapPageé«˜åº¦çš„ç™¾åˆ†æ¯”ã€åœ¨ç§»å‹•çš„
       å·¡æ€ªè§’è‰²ï¼Œå…©è€…çš„åº§æ¨™ç³»çµ±åŸæœ¬æ²’æœ‰
       å°é½Šâ€”â€”åŸæœ¬56%çš„ç§»å‹•ç¯„åœï¼Œå¾ˆå®¹æ˜“
       ç®—åˆ°è²¼è¿‘æˆ–è“‹éé‚£å€‹å›ºå®šå€å¡Šçš„ä¸Šç·£ã€‚
       ç¯„åœå¾22%~78%æ”¶çª„æˆ22%~52%ï¼Œ
       ç¢ºä¿è§’è‰²ç§»å‹•çš„æœ€ä½é»é‚„æ˜¯ç•™åœ¨
       æˆ°é¬¥è³‡è¨Šæ¡†ä¸Šç·£ä¹‹ä¸Šï¼Œä¸æœƒç–Šåˆ°ã€‚
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
       â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…å›å ±ï¼‰ï¼š
       æ¯æ¬¡çœŸæ­£é–‹å§‹èµ°è·¯ä¹‹å‰ï¼Œå…ˆæŠŠå¯èƒ½æ®˜ç•™
       çš„æ‰“æ¶ç‰¹æ•ˆç‹€æ…‹æ¸…ä¹¾æ·¨ï¼ˆå°ºå¯¸æ”¾å¤§åˆ°
       120pxã€é‚„æ²’æ’­å®Œçš„ç‰¹æ•ˆè¨ˆæ™‚å™¨ï¼‰ï¼Œ
       ä¸ç„¶å‰›å¥½åœ¨ç‰¹æ•ˆæ’­æ”¾ä¸­è¢«å«å›é€™è£¡
       ï¼ˆä¾‹å¦‚æˆ°é¬¥å‰›çµæŸã€å›åˆ°åœ°åœ–æ™‚ï¼‰ï¼Œ
       è§’è‰²æœƒå¡åœ¨æ”¾å¤§çš„æ¨£å­ç¹¼çºŒèµ°ã€‚
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
   â˜… é€²å…¥æˆ°é¬¥å‰1ç§’é˜çš„æ‰“æ¶ç‰¹æ•ˆï¼šå…©å¼µåœ–
   å„é¡¯ç¤º0.5ç§’ã€éœæ­¢ä¸å‹•ï¼ˆä¸ç”¨CSSå‹•ç•«ï¼Œ
   å–®ç´”æ›åœ–ï¼‰ï¼Œæ’­å®Œå‘¼å«callback
   ï¼ˆrunAutoPatrolCheck()é‚£é‚Šæœƒæ¥
   startBattle()ï¼‰ã€‚
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
                "â¹ åœæ­¢å·¡æ€ª";

            button.classList.add(
                "active"
            );

        }


        /*
           â˜… æ–°å¢ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œã€Œå·¡æ€ª
           é é¢å·¦ä¸Šè§’æ–°å¢å°æŒ‰éˆ•ï¼Œå·¡æ€ªå¿«æ·
           é–‹å•Ÿ/åœæ­¢ã€ï¼‰ï¼š
           è·Ÿä¸Šé¢autoPatrolButtonåŒä¸€å¥—é‚è¼¯ï¼Œ
           åŒæ­¥æ›´æ–°å·¦ä¸Šè§’é€™é¡†å°å¿«æ·éˆ•ã€‚
        */

        const quickPatrolBtn=
            $("quickAutoPatrolToggle");


        if(quickPatrolBtn){

            /*
               â˜… ä¿®æ­£ï¼ˆé…åˆå¿«æ·éˆ•æ”¹æˆç´”åœ–ç¤ºéˆ•ï¼‰ï¼š
               ä¸èƒ½å†å¯«textContentï¼ŒæœƒæŠŠè£¡é¢
               é–‹/é—œå…©å¼µ<img>æ´—æ‰ï¼Œæ”¹æˆåªåˆ‡æ›
               activeé€™å€‹classï¼ˆCSSæœƒè‡ªå‹•æ±ºå®š
               é¡¯ç¤ºå“ªä¸€å¼µåœ–ï¼‰ï¼Œæ–‡å­—èªªæ˜æ”¹æ”¾åˆ°
               aria-labelã€‚
            */

            quickPatrolBtn.setAttribute(
                "aria-label",
                "è‡ªå‹•å·¡æ€ªï¼ˆé–‹å•Ÿä¸­ï¼‰"
            );

            quickPatrolBtn.classList.add(
                "active"
            );

        }


        scheduleAutoPatrolCheck(5000);


        /*
           â˜… æ–°å¢ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼‰ï¼š
           æŒ‰ä¸‹é–‹å§‹å·¡æ€ªçš„åŒæ™‚ï¼Œè®“è§’è‰²é–‹å§‹
           åœ¨åœ°åœ–ä¸Šèµ°å‹•ã€‚
        */

        startPatrolCharacterWalking();


        addBattleLog(
            "è‡ªå‹•å·¡æ€ªé–‹å§‹ï¼Œ"+
            "æ¯5ç§’è‡ªå‹•å°‹æ‰¾æ€ªç‰©æˆ°é¬¥ã€‚"
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
            "â–¶ å•Ÿå‹•";

        button.classList.remove(
            "active"
        );

    }


    /*
       â˜… æ–°å¢ï¼šè·Ÿä¸Šé¢toggleAutoPatrol()è£¡
       é–‹å•Ÿæ™‚çš„æ›´æ–°æ˜¯åŒä¸€çµ„ï¼Œé€™è£¡æ˜¯é—œé–‰
       ç‹€æ…‹çš„åŒæ­¥ã€‚
    */

    const quickPatrolBtn=
        $("quickAutoPatrolToggle");


    if(quickPatrolBtn){

        quickPatrolBtn.setAttribute(
            "aria-label",
            "è‡ªå‹•å·¡æ€ªï¼ˆé—œé–‰ï¼‰"
        );

        quickPatrolBtn.classList.remove(
            "active"
        );

    }


    /*
       â˜… æ–°å¢ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼‰ï¼š
       åœæ­¢å·¡æ€ªçš„åŒæ™‚ï¼Œè®“è§’è‰²åœä¸‹ä¾†ã€
       å›åˆ°ç½®ä¸­éœæ­¢çš„æ­£é¢åœ–ç‹€æ…‹ã€‚
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
       â˜… é™¤éŒ¯ç”¨ï¼ˆä¾ç…§ä½¿ç”¨è€…å›å ±ï¼Œè¿½è¹¤
       ã€Œæˆ°é¬¥çµæŸå›åœ°åœ–å¾Œï¼Œè‡ªå‹•å·¡æ€ªæ²’æœ‰
       ç¹¼çºŒã€çš„åŸå› ï¼‰ï¼šå°å‡ºæ¯æ¬¡é€™å€‹å‡½å¼è¢«
       å‘¼å«æ™‚ï¼Œä¸‰å€‹é—œéµæ——æ¨™çš„ç•¶ä¸‹ç‹€æ…‹ã€‚
       å¦‚æœæˆ°é¬¥çµæŸå¾Œé€™è¡Œå®Œå…¨ä¸å†å‡ºç¾ï¼Œ
       ä»£è¡¨setIntervalæœ¬èº«åœäº†ï¼›å¦‚æœæœ‰
       å‡ºç¾ã€ä½†æŸå€‹æ——æ¨™å¡åœ¨ä¸è©²æœ‰çš„å€¼ï¼Œ
       å°±èƒ½ç›´æ¥çœ‹å‡ºæ˜¯å“ªå€‹æ——æ¨™çš„å•é¡Œã€‚
    */

    addBattleLog(
        "runAutoPatrolCheckï¼Œ"+
        "autoPatrolEnabled="+
        autoPatrolEnabled+
        "ï¼ŒbattleActive="+
        battleActive+
        "ï¼ŒpatrolBattleTransitionPending="+
        patrolBattleTransitionPending+
        "ï¼ŒmapCooldown="+
        mapCooldown
    );


    /*
       é˜²å‘†ï¼šå¦‚æœäººå·²ç¶“ä¸åœ¨åœ°åœ–é é¢äº†
       ï¼ˆä¾‹å¦‚æ‰‹å‹•é»äº†é›¢é–‹åœ°åœ–ï¼Œä½†å› ç‚ºæŸç¨®
       åŸå› stopAutoPatrol()æ²’è¢«å‘¼å«åˆ°ï¼‰ï¼Œ
       é€™è£¡é¡å¤–æ“‹ä¸€æ¬¡ï¼Œä¸æœƒåœ¨åˆ¥çš„é é¢
       æ†‘ç©ºè§¸ç™¼æˆ°é¬¥ã€‚

       patrolBattleTransitionPendingï¼š
       å·²ç¶“æ‰¾åˆ°æ€ªç‰©ã€æ­£åœ¨æ’­1ç§’é˜æ‰“æ¶ç‰¹æ•ˆã€
       ä½†çœŸæ­£çš„startBattle()é‚„æ²’è¢«å‘¼å«çš„
       é€™æ®µç©ºæª”ï¼ŒbattleActiveé‚„æ˜¯falseï¼Œ
       å¦‚æœä¸é¡å¤–æ“‹ä¸€æ¬¡ï¼Œå‰›å¥½ç¢°ä¸Šä¸‹ä¸€æ¬¡
       setIntervalè§¸ç™¼ï¼Œæœƒé‡è¤‡æ‰¾æ€ªç‰©ã€
       é‡è¤‡æ’­ç‰¹æ•ˆã€‚
    */

    if(
        !autoPatrolEnabled ||
        battleActive ||
        patrolBattleTransitionPending
    ){
        return;
    }


    /*
       â˜… é—œéµä¿®æ­£ï¼š
       mapCooldown=true æ™‚ã€Œåªèƒ½è·³éæœ¬æ¬¡æª¢æŸ¥ã€ï¼Œ
       çµ•å°ä¸èƒ½å‘¼å« stopAutoPatrol()ã€‚

       å¦‚æœ cooldown æ²’æœ‰ä»»ä½•è§£é™¤è¨ˆæ™‚å™¨ï¼Œä»£è¡¨
       æŸæ¢æˆ°é¬¥çµæŸè·¯å¾‘éºæ¼äº†è§£é™¤æ’ç¨‹ï¼›æ­¤æ™‚åœ¨
       ç¢ºèªå·²ä¸åœ¨æˆ°é¬¥ã€ä¹Ÿæ²’æœ‰é€²æˆ°é¬¥éæ¸¡å¾Œï¼Œ
       ç›´æ¥æ¸…æ‰é€™å€‹æ®˜ç•™æ——æ¨™ï¼Œé¿å…è‡ªå‹•å·¡æ€ªæ°¸ä¹…å¡ä½ã€‚
    */
    if(mapCooldown){

        if(!mapCooldownTimeoutId){

            mapCooldown=false;

            addBattleLog(
                "åµæ¸¬åˆ°æ®˜ç•™mapCooldownï¼Œè‡ªå‹•è§£é™¤ï¼Œå·¡æ€ªç¹¼çºŒã€‚"
            );

        }
        else{

            /*
               cooldownæœŸé–“åªæ˜¯ä¸é–‹æˆ°ï¼Œä¸æ˜¯åœæ­¢å·¡æ€ªã€‚
               ç¢ºä¿å†·å»æœŸé–“çµæŸå¾Œä»æœƒæœ‰ä¸‹ä¸€æ¬¡æª¢æŸ¥ã€‚
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
       â˜… è‡ªå‹•å·¡æ€ªæ——æ¨™ä»ç‚ºtrueæ™‚ï¼Œé€™è£¡ç¢ºä¿
       ä¸‹ä¸€å€‹5ç§’æª¢æŸ¥è¨ˆæ™‚å™¨å­˜åœ¨ã€‚
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
               â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼‰ï¼š
               æ‰¾åˆ°æ€ªç‰©ä¸å†ç›´æ¥é–‹æˆ°ï¼Œå…ˆæ’­
               1ç§’é˜çš„æ‰“æ¶ç‰¹æ•ˆå‹•ç•«ï¼ˆå…©å¼µåœ–
               å„0.5ç§’ï¼‰ï¼Œæ’­å®Œæ‰çœŸæ­£å‘¼å«
               startBattle()â€”â€”è¦–è¦ºä¸Šåƒæ˜¯
               ã€Œè§’è‰²å·¡é‚é€”ä¸­é‡åˆ°æ€ªç‰©ã€
               æ‰“èµ·ä¾†äº†ï¼Œç•«é¢æ‰åˆ‡é€²æˆ°é¬¥ã€ã€‚
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
                        transitionGeneration!==patrolLifecycleGeneration ||
                        !autoPatrolEnabled ||
                        !isPatrolMapActive()
                    ){                        return;
                    }

                    /*
                       â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…å›å ±ï¼Œ
                       ä¸Šä¸€ç‰ˆçš„å¿«é€Ÿé‡è©¦æ”¹éé ­äº†ï¼‰ï¼š
                       ä¹‹å‰åœ¨é€™è£¡åŠ äº†ã€ŒmapCooldown
                       ä¸€è§£é™¤å°±ç«‹åˆ»é‡è©¦ã€çš„é‚è¼¯ï¼Œ
                       çµæœè®Šæˆæˆ°é¬¥çµæŸã€3ç§’ä¿è­·æœŸ
                       ä¸€éé¦¬ä¸Šåˆé€²ä¸‹ä¸€å ´ï¼Œå®Œå…¨æ²’æœ‰
                       ã€Œå·¡é‚èµ°5ç§’å†é‡æ•µã€çš„ç¯€å¥æ„Ÿï¼Œ
                       æ•´å€‹5ç§’é€±æœŸçš„è¨­è¨ˆç­‰æ–¼è¢«æ¶ç©ºã€‚

                       æ‹¿æ‰é‚£æ®µè¼ªè©¢ï¼Œæ”¹å›å–®ç´”ï¼š
                       é€™æ¬¡å¦‚æœè¢«mapCooldownæ“‹ä¸‹ï¼Œ
                       å°±è®“å®ƒæ“‹ä¸‹ï¼Œå®‰åˆ†ç­‰ä¸‹ä¸€æ¬¡
                       5ç§’çš„setIntervalè‡ªç„¶å†æª¢æŸ¥
                       ä¸€æ¬¡å°±å¥½ï¼Œä¸å¼·è¡Œæ’éšŠã€‚
                    */

                    startBattle(i);

                    /*
                       å¦‚æœé€™æ¬¡é€²å…¥æˆ°é¬¥è¢«å…¶ä»–ä¿è­·æ¢ä»¶æ“‹ä¸‹ï¼Œ
                       ä¸èƒ½è®“è‡ªå‹•å·¡æ€ªå› æ­¤å¤±å»ä¸‹ä¸€æ¬¡æª¢æŸ¥ã€‚
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
       é€™æ¬¡æ²’æœ‰æ´»æ€ªå¯æ‰“ï¼ˆä¾‹å¦‚æ€ªç‰©æ­£åœ¨2ç§’é‡ç”Ÿï¼‰ï¼Œ
       ä»ç„¶è¦ä¿ç•™ä¸‹ä¸€å€‹5ç§’å·¡æ€ªæª¢æŸ¥ã€‚
    */
    scheduleAutoPatrolCheck(5000);

}


/* =====================================================
   â˜… åœ°åœ–é‡æ–°è¨­è¨ˆï¼šæ£‹ç›¤èµ°ä½ç³»çµ±

   æŠŠåœ°åœ–åˆ‡æˆ10x10çš„æ ¼å­ï¼ˆæ¯æ ¼=10%å¯¬é«˜ï¼‰ï¼Œ
   ç©å®¶çš„åº§æ¨™ä¸å†æ˜¯ä»»æ„åƒç´ /ç™¾åˆ†æ¯”ï¼Œ
   è€Œæ˜¯ã€Œç¬¬å¹¾æ ¼ã€ç¬¬å¹¾åˆ—ã€é€™ç¨®æ£‹ç›¤åº§æ¨™ã€‚

   é»æ“Šåœ°åœ–æ™‚ï¼Œä¸å†æ˜¯ç›´æ¥æŠŠç©å®¶ç¬é–“è²¼åˆ°
   é»æ“Šçš„ä½ç½®ï¼Œè€Œæ˜¯å…ˆç®—å‡ºä¸€æ¢ã€Œä¸€æ ¼ä¸€æ ¼èµ°éå»ã€
   çš„è·¯å¾‘ï¼Œç„¶å¾Œæ­é…CSSçš„0.22ç§’transitionï¼Œ
   ä¸€æ­¥ä¸€æ­¥çœŸæ­£èµ°éå»ï¼Œçœ‹èµ·ä¾†æ‰åƒåœ¨ç§»å‹•ï¼Œ
   ä¸æ˜¯ç¬é–“ç§»å‹•ã€‚

   ç¬¬äºŒè§’è‰²ï¼ˆå­˜åœ¨çš„è©±ï¼‰ä¸æœƒè‡ªå·±èµ°ï¼Œ
   æ˜¯è·Ÿåœ¨ç¬¬ä¸€è§’è‰²å¾Œé¢çš„ã€Œè·Ÿéš¨æ–¹å¡Šã€ï¼Œ
   è®€å–ç©å®¶æœ€è¿‘èµ°éçš„è·¯å¾‘ç´€éŒ„ï¼Œ
   æ…¢å€‹å¹¾æ­¥è·Ÿéå»ï¼Œåƒè·Ÿç­è·Ÿè‘—éšŠé•·ï¼Œ
   ä¸æ˜¯è‡ªå·±äº‚è·‘çš„ç¨ç«‹è§’è‰²ã€‚
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
   ä¸€æ­¥ä¸€æ­¥é€¼è¿‘çµ‚é»çš„ç°¡å–®è·¯å¾‘ç”Ÿæˆ
   ï¼ˆé€™å¼µåœ°åœ–ç›®å‰æ²’æœ‰éšœç¤™ç‰©ï¼Œ
   æ‰€ä»¥ç”¨æœ€ç›´æ¥çš„ã€Œæ¯æ­¥åŒæ™‚ä¿®æ­£æ©«å‘/ç¸±å‘ã€
   èµ°æ³•å°±å¤ äº†ï¼Œæ–œç·šæœ€çŸ­è·¯å¾‘ï¼Œ
   ä¹‹å¾Œå¦‚æœåœ°åœ–åŠ äº†éšœç¤™ç‰©è¦ç¹è·¯ï¼Œ
   é€™å€‹å‡½å¼å¯ä»¥å†æ›æˆæ­£å¼çš„A*ä¹‹é¡çš„æ¼”ç®—æ³•ï¼‰ã€‚
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
       â˜… mapCooldown åªç”¨ä¾†æ“‹ã€Œè§¸ç™¼æ–°æˆ°é¬¥ã€ï¼Œ
       ä¸æ“‹ç§»å‹•æœ¬èº«ï¼Œé‚£å€‹åˆ¤æ–·åœ¨
       checkMapDistance() è£¡é¢å·²ç¶“æœ‰è™•ç†ã€‚
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
       è¢å¹• Pointer/Touâ€‹â€‹ch åº§æ¨™å…ˆè½‰æˆ
       1080Ã—1920 è™›æ“¬éŠæˆ²åº§æ¨™ï¼Œå†åšåœ°åœ–åˆ¤å®šã€‚
       ä¸ç›´æ¥æŠŠ clientX/clientY ç•¶æˆéŠæˆ²åº§æ¨™ã€‚
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
   æŠŠæ•´æ¢è·¯å¾‘æ‹†æˆä¸€æ­¥ä¸€æ­¥èµ°ï¼Œ
   æ¯ä¸€æ­¥ä¹‹é–“é–“éš”240msï¼Œ
   è®“ç©å®¶çœ‹å¾—å‡ºä¾†è§’è‰²æ˜¯çœŸçš„åœ¨ç§»å‹•ï¼Œ
   ä¸æ˜¯ç¬é–“è²¼éå»ã€‚
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
   â˜… ç¬¬äºŒè§’è‰²è·Ÿéš¨æ–¹å¡Šçš„ä½ç½®æ›´æ–°ã€‚
   ä¸æ˜¯å³æ™‚è²¼åœ¨ç©å®¶æ—é‚Šï¼Œ
   è€Œæ˜¯è®€ã€Œç©å®¶å¹¾æ­¥ä¹‹å‰èµ°éçš„ä½ç½®ã€ï¼Œ
   æ¨¡æ“¬è·Ÿåœ¨å¾Œé¢èµ°çš„æ„Ÿè¦ºï¼Œ
   ä¸æœƒè·Ÿç¬¬ä¸€è§’è‰²é‡ç–Šåœ¨åŒä¸€æ ¼ã€‚
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
   â˜… æ›´æ–°åœ°åœ–ä¸Šç©å®¶å¡ç‰‡ã€è·Ÿéš¨æ–¹å¡Šçš„
   åå­—/ç­‰ç´š/åœ–ç¤ºé¡¯ç¤ºï¼Œ
   é€²åœ°åœ–ã€å‡ç´šä¹‹å¾Œéƒ½è¦å‘¼å«é€™è£¡åˆ·æ–°ä¸€æ¬¡ã€‚
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
            "ç©å®¶";

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
   â˜… è‡ªå‹•å·¡æ€ªï¼åœ°åœ–å†·å»çµ±ä¸€ç®¡ç†

   mapCooldown æ˜¯ã€Œä¸èƒ½ç«‹åˆ»é–‹ä¸‹ä¸€å ´æˆ°é¬¥ã€çš„
   ä¿è­·æœŸï¼Œä¸æ˜¯ã€Œåœæ­¢è‡ªå‹•å·¡æ€ªã€ã€‚
   æ‰€æœ‰æˆ°é¬¥çµæŸè·¯å¾‘éƒ½é€éé€™å€‹å‡½å¼è§£é™¤ï¼Œ
   é¿å…ä¸åŒçµç®—è·¯å¾‘å„è‡ª setTimeout é€ æˆ
   cooldown ç‹€æ…‹ä¸åŒæ­¥ã€‚
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
   â˜… é˜²å‘†ï¼šè‡ªå‹•å·¡æ€ªé–‹è‘—ã€å·²ç¶“å›åˆ°åœ°åœ–ã€
   ä¹Ÿæ²’æœ‰æ­£åœ¨æˆ°é¬¥ï¼é€²æˆ°é¬¥éæ¸¡æ™‚ï¼Œ
   ç¢ºä¿5ç§’å·¡æ€ªè¨ˆæ™‚å™¨å­˜åœ¨ã€‚
*/
function scheduleAutoPatrolCheck(delay=5000){

    /*
       â˜… æœ€çµ‚ä¿®æ­£ï¼šè‡ªå‹•å·¡æ€ªçš„ã€Œæ’ç¨‹ç”Ÿå‘½é€±æœŸã€ä¸èƒ½ä¾è³´
       battleActive çš„ç•¶ä¸‹ç‹€æ…‹ã€‚

       èˆŠç‰ˆåœ¨æˆ°é¬¥æœŸé–“æœƒåœæ­¢ï¼ä¸å»ºç«‹ä¸‹ä¸€å€‹ timeoutï¼Œ
       ç„¶å¾ŒæŠŠã€Œæˆ°é¬¥çµæŸå¾Œä¸€å®šæœƒé‡æ–°æ’ç¨‹ã€å¯„è¨—åœ¨å„å€‹
       çµç®—è·¯å¾‘ä¸Šï¼›åªè¦å…¶ä¸­ä»»ä½•ä¸€æ¢è·¯å¾‘æ²’æœ‰é‡æ–°æ’ç¨‹ï¼Œ
       è‡ªå‹•å·¡æ€ªå°±æœƒæ°¸ä¹…åœæ­¢ã€‚

       ç¾åœ¨æ”¹æˆï¼šåªè¦ autoPatrolEnabled=true ä¸”ä»åœ¨åœ°åœ–ï¼Œ
       æ’ç¨‹å™¨æœ¬èº«æ°¸é ç¶­æŒï¼›æˆ°é¬¥ä¸­åªæ˜¯ runAutoPatrolCheck
       æš«æ™‚ä¸é–‹æˆ°ã€‚æˆ°é¬¥çµæŸæ™‚å¦‚æœé‡æ–°æ’ç¨‹ï¼Œæœƒå…ˆæ¸…æ‰èˆŠçš„
       timeoutï¼Œå› æ­¤ä¸æœƒç”¢ç”Ÿé›™é‡å·¡æ€ªã€‚

       é€™ä¸æ”¹è®ŠéŠæˆ²æ©Ÿåˆ¶ï¼šå¯¦éš›å°‹æ€ªä»ç„¶ç¶­æŒ5ç§’ä¸€æ¬¡ã€‚
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
               æˆ°é¬¥ä¸­ï¼é€²æˆ°é¬¥éæ¸¡ä¸­åªè·³éé€™ä¸€æ¬¡ï¼Œ
               ä¸ä»£è¡¨åœæ­¢è‡ªå‹•å·¡æ€ªï¼›callbackæœ€å¾Œä»æœƒ
               è£œä¸Šä¸‹ä¸€å€‹5ç§’æ’ç¨‹ã€‚
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
   ç›¸å®¹èˆŠç¨‹å¼å‘¼å«åç¨±ã€‚
   ç¾æœ‰åŠŸèƒ½ä»å¯å‘¼å«ensureAutoPatrolInterval()ï¼Œ
   ä½†å¯¦éš›ä¸Šæ”¹ç”±æ–°çš„è‡ªæˆ‘çºŒæ’æ©Ÿåˆ¶è² è²¬ã€‚
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
       åªè¦æ²’æœ‰ä¸‹ä¸€æ¬¡æ’ç¨‹ï¼Œå°±è£œå›5ç§’ã€‚
       ä¸ä½¿ç”¨ã€Œinterval handle æ˜¯å¦å­˜åœ¨ã€åˆ¤æ–·ï¼Œ
       é¿å…handleå­˜åœ¨ä½†å¯¦éš›å¾ªç’°å·²å¤±æ•ˆçš„æƒ…æ³ã€‚
    */
    if(!autoPatrolTimeoutId){

        scheduleAutoPatrolCheck(5000);

    }

}


/* =====================================================
   é–‹å§‹æˆ°é¬¥
===================================================== */

function clearTransientBattlePresentation(){
    if(typeof window==="undefined"){ return; }
    const feedback=window.FourSymbolsBattleFloatingFeedback;
    if(feedback&&typeof feedback.clear==="function"){ feedback.clear(); }
    const presentation=window.FourSymbolsBattlePresentation;
    if(presentation&&typeof presentation.cleanupEscape==="function"){ presentation.cleanupEscape(); }
}

function startBattle(triggerIndex){

    if(
        battleActive ||
        mapCooldown
    ){

        /*
           â˜… é™¤éŒ¯ç”¨ï¼ˆä¾ç…§ä½¿ç”¨è€…å›å ±ï¼Œè¿½è¹¤
           è‡ªå‹•å·¡æ€ªæ‰¾åˆ°æ€ªç‰©ã€å»æ²’æœ‰çœŸçš„
           é€²å…¥æˆ°é¬¥çš„æƒ…æ³ï¼‰ï¼šå°å‡ºæ˜¯è¢«
           battleActiveé‚„æ˜¯mapCooldown
           æ“‹ä¸‹ä¾†çš„ã€‚
        */

        addBattleLog(
            "startBattleè¢«æ“‹ä¸‹ï¼Œ"+
            "battleActive="+
            battleActive+
            "ï¼ŒmapCooldown="+
            mapCooldown
        );

        return;
    }


    battleActive=true;

    /*
       é€²å…¥çœŸæ­£æˆ°é¬¥æ™‚ï¼Œå–æ¶ˆä¸Šä¸€å€‹åœ°åœ– cooldown
       çš„è§£é™¤æ’ç¨‹ï¼›æˆ°é¬¥æœŸé–“ç”± battleActive æ§åˆ¶
       ä¸å…è¨±å†æ¬¡é–‹æˆ°ã€‚
    */
    if(mapCooldownTimeoutId){

        clearTimeout(
            mapCooldownTimeoutId
        );

        mapCooldownTimeoutId=null;

    }

    mapCooldown=true;

    battleToken++;
    clearTransientBattlePresentation();
    battleRoundBoundaryKeys=new Set();
    battlePresentationLocks.clear();
    battleInputResumeToken=null;
    battleResolutionResumeToken=null;
    battleAutoActionResume=null;
    battleResolutionResumeToken=null;
    clearBattleRoundPrompt();


    stopMonsterMovement();

    clearInterval(timerId);

    if(battleAdvanceTimeoutId){
        clearTimeout(battleAdvanceTimeoutId);
        battleAdvanceTimeoutId=null;
    }
    clearBattleActionWatchdog();
    battleAdvanceScheduled=false;


    /*
       â˜… æ–°å¢ï¼ˆä¾ç…§ä½¿ç”¨è€…å›å ±ï¼‰ï¼š
       é€²å…¥æˆ°é¬¥çš„ç•¶ä¸‹ï¼ŒæŠŠå·¡æ€ªèµ°è·¯çš„è¨ˆæ™‚å™¨
       æš«åœæ‰â€”â€”åŸæœ¬é€™å€‹è¨ˆæ™‚å™¨å®Œå…¨æ²’æœ‰åœ¨
       é€²å…¥æˆ°é¬¥æ™‚åœæ­¢ï¼Œåªæ˜¯å› ç‚ºæˆ°é¬¥ç•«é¢æŠŠ
       åœ°åœ–è“‹ä½æ‰ã€Œçœ‹ä¸åˆ°ã€è€Œå·²ï¼Œå¯¦éš›ä¸Šé‚„åœ¨
       èƒŒæ™¯æ¯2.2ç§’åŸ·è¡Œä¸€æ¬¡ï¼Œè®€ç§’æ²’æœ‰çœŸçš„
       åœæ­¢ã€‚æˆ°é¬¥çµæŸå›åˆ°åœ°åœ–æ™‚ï¼ŒshowPage()
       è£¡å·²ç¶“æœƒä¾autoPatrolEnabledé‡æ–°å‘¼å«
       startPatrolCharacterWalking()æ­£å¸¸
       æ¢å¾©ï¼Œé€™è£¡åªè² è²¬ã€Œé€²æˆ°é¬¥å°±å…ˆæš«åœã€
       é€™ä¸€åŠã€‚
    */

    if(patrolWalkIntervalId){

        clearInterval(
            patrolWalkIntervalId
        );

        patrolWalkIntervalId=
            null;

    }


    /*
       â˜… ä¿®æ­£ï¼ˆé˜²å‘†ï¼‰ï¼š
       æ–°æˆ°é¬¥é–‹å§‹æ™‚ï¼Œå¼·åˆ¶æ”¶åˆä»»ä½•å¯èƒ½æ®˜ç•™
       é–‹è‘—çš„å­é¸å–®ï¼ˆä¾‹å¦‚ä¸Šä¸€å ´æˆ°é¬¥çµæŸæ™‚
       å¿˜äº†é—œçš„ç‰©å“æ¬„é¸å–®ï¼‰ï¼Œç¢ºä¿æ¯å ´æˆ°é¬¥
       éƒ½æ˜¯ä¹¾æ·¨çš„ç•«é¢é–‹å§‹ï¼Œä¸æœƒå»¶çºŒä¸Šä¸€å ´
       æ®˜ç•™çš„UIç‹€æ…‹ã€‚
    */

    closeMenus();


    selectedMonster =
        triggerIndex;


    turn=1;

    actionReady=false;

    pendingAction=null;


    /*
       â˜… æ–°æˆ°é¬¥é–‹å§‹ï¼Œæ¸…æ‰ä¸Šä¸€å ´çš„buffæ®˜ç•™
       ï¼ˆä¾‹å¦‚æ€’ç«ä¸æœƒå»¶çºŒåˆ°ä¸‹ä¸€å ´æˆ°é¬¥ï¼‰ï¼Œ
       é˜²ç¦¦ç‹€æ…‹ä¹Ÿä¸€ä½µé‡ç½®ï¼Œé¿å…æ®˜ç•™ã€‚
    */

    player.activeBuffs=[];

    player.statusEffects=[];

    player.isDefending=false;


    /*
       â˜… æ–°å¢ï¼šç¬¬äºŒè§’è‰²åƒæˆ°åˆå§‹åŒ–ã€‚
       å¦‚æœç©å®¶å·²ç¶“å‰µå»ºç¬¬äºŒè§’è‰²ï¼Œ
       æ¯å ´æ–°æˆ°é¬¥é–‹å§‹éƒ½æŠŠä»–çš„HP/SPè£œæ»¿ï¼Œ
       ä¸¦æ¸…æ‰ä¸Šä¸€å ´å¯èƒ½æ®˜ç•™çš„buffï¼Œ
       é€™æ¨£ä»–æ‰èƒ½çœŸæ­£ä¸€èµ·ä¸Šå ´æˆ°é¬¥ã€‚
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
       â˜… éš¨æ©Ÿæ±ºå®šé€™å ´æˆ°é¬¥æ²å…¥å¹¾éš»æ€ªç‰©ï¼ˆ1ï½3éš»ï¼‰ï¼Œ
       è§¸ç™¼çš„é‚£éš»ä¸€å®šåœ¨è£¡é¢ï¼Œ
       å…¶é¤˜å¾ã€Œå…¶ä»–é‚„æ´»è‘—çš„æ€ªç‰©ã€è£¡éš¨æ©ŸæŠ½ï¼Œ
       ä¸å¤ éš¨ä¾¿ä½ æŠ½å¤šå°‘å°±æŠ½å¤šå°‘ï¼ˆä¸æœƒç¡¬æ¹Šï¼‰ã€‚
       æ²’è¢«æŠ½åˆ°çš„æ€ªç‰©ç•™åœ¨åœ°åœ–ä¸ŠåŸåœ°ä¸å‹•ï¼Œä¸å—å½±éŸ¿ã€‚
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
       â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼‰ï¼š
       å¾å†°éœœå±±è„ˆé–‹å§‹çš„æ‰€æœ‰å€åŸŸï¼Œæ€ªç‰©ä¸€æ¬¡
       å‡ºç¾çš„æ•¸é‡æ”¹æˆ3~6éš»ï¼ˆåŸæœ¬æ–°æ‰‹æ£®æ—ã€
       è’æ¼ åœ°å¸¶ç¶­æŒ1~3éš»ä¸è®Šï¼Œé€™å…©å€æ˜¯
       æ¯”è¼ƒæ—©æœŸã€ç°¡å–®çš„ç·´åŠŸå€ï¼Œä¸éœ€è¦
       è·Ÿè‘—ä¸€èµ·è®Šå‹•ï¼‰ã€‚
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
       â˜… ä¿®æ­£ï¼ˆçœŸçš„æŠ“åˆ°ä¸€å€‹bugï¼‰ï¼š
       æ€ªç‰©å¦‚æœåœ¨ä¸Šä¸€å ´æˆ°é¬¥ä¸­æ´»è‘—é€ƒéä¸€åŠ«
       ï¼ˆæ²’è¢«æ‰“æ­»ï¼‰ï¼Œèº«ä¸Šæ®˜ç•™çš„ç‡ƒç‡’/å†°å°ç‹€æ…‹
       å®Œå…¨æ²’æœ‰è¢«æ¸…æ‰â€”â€”respawnMonsters()
       åªæœƒæ¸…ã€Œé‡ç”Ÿçš„æ€ªç‰©ã€çš„ç‹€æ…‹ï¼Œ
       é€™éš»æ—¢æ²’æ­»ã€ä¹Ÿæ²’é‡ç”Ÿï¼Œ
       ç‹€æ…‹å°±ä¸€è·¯å¸¶åˆ°ä¸‹ä¸€å ´æˆ°é¬¥ï¼Œ
       ç•«é¢ä¸Šæœƒçœ‹åˆ°ç‰ å¹³ç™½ç„¡æ•…è£¹è‘—ä¸€å±¤
       ç‡ƒç‡’çš„æ©˜ç´…è‰²ï¼Œå…¶å¯¦æ˜¯ä¸Šä¸€å ´æˆ°é¬¥
       æ®˜ç•™çš„ç‡ƒç‡’ç‰¹æ•ˆæ²’æ¶ˆæ‰ã€‚
       é€™è£¡åœ¨æ¯å ´æ–°æˆ°é¬¥é–‹å§‹æ™‚ï¼Œ
       æŠŠé€™å ´çœŸæ­£æ²å…¥æˆ°é¬¥çš„æ€ªç‰©
       statusEffectséƒ½é‡ç½®ä¹¾æ·¨ã€‚
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
           â˜… æ¸…æ‰ä¸Šä¸€å ´æˆ°é¬¥å¯èƒ½æ®˜ç•™çš„
           ç‡ƒç‡’ä¹‹é¡çš„ç‹€æ…‹æ•ˆæœï¼Œ
           æ¯å ´æˆ°é¬¥éƒ½æ˜¯å…¨æ–°é–‹å§‹ã€‚
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
        "æˆ°é¬¥é–‹å§‹ï¼"
    );


    addBattleLog(
        "æ•µäººå…±æœ‰"+
        currentBattleMonsters.length+
        "éš»ã€‚"
    );


    startTurn(
        battleToken
    );

}


/* =====================================================
   å›åˆ
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
       â˜… æ–°å¢ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼‰ï¼š
       æ¯å€‹å¤§å›åˆé–‹å§‹çš„æ™‚å€™ï¼Œåœ¨æˆ°é¬¥ç´€éŒ„
       åŠ ä¸€è¡Œã€Œç¬¬Xå›åˆï¼Œé–‹å§‹ï¼ã€ï¼Œ
       è®“ç©å®¶æ¸…æ¥šçœ‹åˆ°æ–°çš„ä¸€è¼ªå¾é€™è£¡é–‹å§‹ï¼Œ
       è·Ÿä¸Šä¸€è¼ªçš„å…§å®¹æœ‰æ˜ç¢ºåˆ†éš”ã€‚
    */

    addBattleLog(
        "ç¬¬"+
        turn+
        "å›åˆï¼Œé–‹å§‹ï¼"
    );


    /*
       â˜… æ–°å¢ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼‰ï¼š
       ã€Œæˆ°é¬¥è³‡è¨Šã€æ¡†ä¸Šæ–¹é‚£å€‹å›ºå®šé¡¯ç¤ºçš„
       å›åˆæ•¸æ¨™ç±¤ï¼Œè·Ÿè‘—é€™è£¡åŒæ­¥æ›´æ–°â€”â€”
       é€™å€‹æ¨™ç±¤ä¸æ˜¯æˆ°é¬¥ç´€éŒ„è£¡æœƒè¢«æ²å‹•æ²–æ‰
       çš„ä¸€è¡Œå­—ï¼Œæ˜¯ç¨ç«‹çš„å°æ¨™ç±¤ï¼Œéš¨æ™‚éƒ½
       çœ‹å¾—åˆ°ç›®å‰æ˜¯ç¬¬å¹¾è¼ªï¼Œå…©å€‹åœ°æ–¹
       ï¼ˆæˆ°é¬¥é é¢/å·¡é‚é é¢ï¼‰éƒ½è¦ä¸€èµ·æ›´æ–°ã€‚
    */

    const turnIndicator=
        $("battleTurnIndicator");


    if(turnIndicator){

        turnIndicator.textContent=
            "ç¬¬"+turn+"å›åˆ";

    }


    const mapTurnIndicator=
        $("mapBattleTurnIndicator");


    if(mapTurnIndicator){

        mapTurnIndicator.textContent=
            "ç¬¬"+turn+"å›åˆ";

    }


    /*
       â˜… æ¯å›åˆé–‹å§‹å…ˆè™•ç†ç‡ƒç‡’å‚·å®³è·ŸbuffæŒçºŒæ™‚é–“ï¼Œ
       é€™æ¨£æ‰æœƒæœ‰ã€Œå›åˆåˆ¶DoTã€çš„æ„Ÿè¦ºï¼Œ
       è€Œä¸æ˜¯ç‡ƒç‡’åªå¥—ç”¨ä¸€æ¬¡å°±æ²’äº‹äº†ã€‚

       å¦‚æœç‡ƒç‡’å‚·å®³æ­£å¥½æŠŠæœ€å¾Œä¸€éš»æ€ªæ‰“æ­»ï¼Œ
       è¦å…ˆåˆ¤æ–·æˆ°é¬¥æ˜¯å¦çµæŸï¼Œ
       çµæŸçš„è©±å°±ä¸è¦å†å¾€ä¸‹é–‹æ–°å›åˆã€‚
    */

    tickStatusEffects();

    tickPlayerBuffs();

    if(
        typeof window!=="undefined" &&
        typeof window.v143SyncStatusVisualEffects==="function"
    ){
        window.v143SyncStatusVisualEffects();
    }


    if(
        checkBattleEnd()
    ){
        return;
    }


    /*
       â˜… ä¿®æ­£ï¼ˆé‡æ–°è¨­è¨ˆå›åˆåˆ¶ï¼‰ï¼š
       æ–°çš„ä¸€å€‹å¤§å›åˆé–‹å§‹ï¼Œä¸æ˜¯é¦¬ä¸Šæ’æ•æ·ã€
       é¦¬ä¸Šé–‹æ‰“ï¼Œè€Œæ˜¯å…ˆé€²å…¥ã€Œå®£å‘Šéšæ®µã€â€”â€”
       ç©å®¶è§’è‰²ä¾åºé¸å¥½é€™å›åˆè¦åšä»€éº¼
       ï¼ˆä½†ä¸æœƒé¦¬ä¸ŠåŸ·è¡Œï¼‰ï¼Œ
       å…¨éƒ¨äººéƒ½é¸å¥½ä¹‹å¾Œï¼Œ
       æ‰æœƒé€²å…¥ã€Œçµç®—éšæ®µã€ä¾æ•æ·é«˜ä½çœŸæ­£å‡ºæ‰‹ã€‚
       é€™è£¡ä¸å†ç›´æ¥å‘¼å«processNextCombatant()ï¼Œ
       æ”¹æˆå‘¼å«beginCharacterTurn()é–‹å§‹å®£å‘Šæµç¨‹ã€‚
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


    /* Auto Battle owns a short, tracked presentation lock before the first
       declaration/action of the newly established round. Manual battle keeps
       the existing timing unchanged. */
    showAutoBattleRoundPrompt(token);
    beginCharacterTurn(token);

}


/*
   â˜… æ–°å¢ï¼šå–å¾—ç›®å‰æ´»è‘—ã€æœƒä¸Šå ´çš„éšŠä¼æˆå“¡ï¼Œ
   ä¾åºï¼ˆç¬¬ä¸€è§’è‰²ã€ç¬¬äºŒè§’è‰²ï¼‰æ’åˆ—ã€‚
   ç¬¬äºŒè§’è‰²ä¸å­˜åœ¨æˆ–å·²ç¶“å€’ä¸‹å°±ä¸æœƒå‡ºç¾åœ¨é€™è£¡ï¼Œ
   beginCharacterTurn()ç”¨é€™å€‹æ¸…å–®åˆ¤æ–·
   é‚„æœ‰æ²’æœ‰äººæ²’è¡Œå‹•éã€‚
*/

function getLivingParty(){
    return getExistingPartyIndexes().filter(index=>{
        const character=getPartyCharacterByIndex(index);
        return character && character.hp>0;
    });

}


/*
   â˜… æ–°å¢ï¼šè™•ç†ã€Œç›®å‰é€™å€‹è§’è‰²ã€çš„è¡Œå‹•éšæ®µã€‚
   è·ŸåŸæœ¬startTurn()è£¡ç›´æ¥å¯«æ­»æ“ä½œplayerçš„é‚è¼¯
   å¹¾ä¹ä¸€æ¨£ï¼Œåªæ˜¯æ›æˆçœ‹
   activeBattleCharacterIndexæŒ‡å‘èª°ï¼Œ
   è¼ªåˆ°ç¬¬äºŒè§’è‰²æ™‚ï¼Œç•«é¢ä¸Šæœƒæç¤ºã€
   ä¹Ÿæœƒåˆ‡æ›æŠ€èƒ½é¸å–®é¡¯ç¤ºçš„æŠ€èƒ½ä¾†æºã€‚
*/

function beginCharacterTurn(token){

    if(
        !battleActive ||
        token!==battleToken
    ){
        return;
    }

    if(battlePresentationLocks.size>0){
        battleInputResumeToken=token;
        updateActionHudVisibility();
        return;
    }


    /*
       â˜… ä¿®æ­£ï¼ˆçœŸæ­£çš„æ ¹æºä¿®æ³•ï¼‰ï¼š
       æ‰‹æ©Ÿç€è¦½å™¨èƒŒæ™¯åŸ·è¡Œæ™‚setTimeoutä¸ä¿è­‰
       æº–æ™‚è§¸ç™¼ï¼Œå¯èƒ½è¢«å»¶å¾Œã€ä¹‹å¾Œåˆè·Ÿå…¶ä»–
       è¨ˆæ™‚å™¨ä¸€æ¬¡è£œç™¼ï¼Œå°è‡´é€™å€‹å‡½å¼è¢«åŒä¸€å€‹
       activeBattleCharacterIndexå€¼å‘¼å«
       ç¬¬äºŒæ¬¡ã€‚

       é€™è£¡ç”¨declaredCharacterIndexesé€™å€‹Set
       æ“‹æ‰é‡è¤‡ï¼šå¦‚æœç›®å‰é€™å€‹
       activeBattleCharacterIndexåœ¨é€™å€‹å¤§å›åˆ
       è£¡å·²ç¶“çœŸæ­£å®£å‘Šéä¸€æ¬¡ï¼Œä»£è¡¨é€™æ¬¡å‘¼å«æ˜¯
       è¨ˆæ™‚å™¨å»¶é²è£œç™¼çš„é‡è¤‡/éæœŸå‘¼å«ï¼Œç›´æ¥
       returnï¼Œä¸æœƒå†è®“è§’è‰²ç´¢å¼•è¢«å¤šæ¨é€²ã€
       ä¸æœƒè®“autoAction()/player2AutoAction()
       è¢«é‡è¤‡å‘¼å«ï¼Œä¹Ÿå°±ä¸æœƒå†ç™¼ç”Ÿã€Œå…¶ä¸­ä¸€å€‹
       è§’è‰²çš„å®£å‘Šè¢«è·³éã€çš„æƒ…æ³ã€‚
    */

    if(
        declaredCharacterIndexes.has(
            activeBattleCharacterIndex
        )
    ){

        addBattleLog(
            "åµæ¸¬åˆ°é‡è¤‡çš„"+
            "beginCharacterTurnå‘¼å«"+
            "ï¼ˆactiveBattleCharacterIndex="+
            activeBattleCharacterIndex+
            "å·²ç¶“å®£å‘Šéï¼‰ï¼Œå·²æ“‹ä¸‹ã€‚"
        );

        return;

    }


    /*
       â˜… ä¿®æ­£ï¼ˆé‡æ–°è¨­è¨ˆå›åˆåˆ¶ï¼‰ï¼š
       é€™å€‹å‡½å¼ç¾åœ¨æ˜¯ã€Œå®£å‘Šéšæ®µã€çš„è¿´åœˆæœ¬é«”ï¼Œ
       æ¯æ¬¡è¢«å‘¼å«éƒ½ä»£è¡¨ã€Œè¼ªåˆ°ä¸‹ä¸€å€‹è§’è‰²å®£å‘Šã€ã€‚
       å¦‚æœæ´»è‘—çš„è§’è‰²éƒ½å®£å‘Šå®Œäº†ï¼Œ
       å°±ä¸å†ç­‰æ–°çš„è¼¸å…¥ï¼Œç›´æ¥é€²å…¥çµç®—éšæ®µã€‚
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
       â˜… åˆ°é€™è£¡ä»£è¡¨é€™å€‹ç´¢å¼•çœŸçš„è¦é–‹å§‹å®£å‘Šäº†ï¼Œ
       ç«‹åˆ»æ¨™è¨˜èµ·ä¾†â€”â€”ä¸€å®šè¦åœ¨é€™è£¡æ¨™è¨˜
       ï¼ˆè€Œä¸æ˜¯ç­‰å®£å‘Šå®Œæˆæ‰æ¨™è¨˜ï¼‰ï¼Œå› ç‚º
       é‡è¤‡å‘¼å«å¯èƒ½ç™¼ç”Ÿåœ¨å®£å‘Šã€Œé€²è¡Œä¸­ã€
       çš„ä»»ä½•æ™‚é–“é»ï¼Œè¶Šæ—©æ¨™è¨˜è¶Šèƒ½æ“‹ä½
       å¾ŒçºŒçš„é‡è¤‡å‘¼å«ã€‚
    */

    declaredCharacterIndexes.add(
        activeBattleCharacterIndex
    );


    actionReady=false;

    pendingAction=null;

    closeMenus();
    clearBattleTargetSelectionMode();


    /*
       â˜… è¼ªåˆ°é€™å€‹è§’è‰²è¡Œå‹•æ™‚ï¼Œ
       æŠŠä»–ä¸Šä¸€æ¬¡è¨­çš„é˜²ç¦¦ç‹€æ…‹æ¸…æ‰â€”â€”
       é˜²ç¦¦åªä¿è­·åˆ°ã€Œä¸‹ä¸€æ¬¡è¼ªåˆ°è‡ªå·±ã€ç‚ºæ­¢ï¼Œ
       ç¾åœ¨æ—¢ç„¶è¼ªåˆ°è‡ªå·±äº†ï¼Œé€™æ¬¡ä¿è­·å·²ç¶“ç”¨å®Œï¼Œ
       è¦å˜›é‡æ–°é¸é˜²ç¦¦ã€è¦å˜›åšåˆ¥çš„äº‹ã€‚
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
       â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼‰ï¼š
       ä¹‹å‰ä¸ç®¡æ˜¯æ‰‹å‹•é‚„æ˜¯å…¨è‡ªå‹•ï¼Œå®£å‘Šéšæ®µ
       éƒ½æœƒå…ˆé¡¯ç¤ºã€Œè¼ªåˆ°èª°ã€çš„é»ƒè‰²é–ƒçˆå¤–æ¡†ï¼Œ
       è€Œä¸”è‡ªå‹•åˆ¤æ–·é‚„è¦ç­‰1000msæ‰æœƒçœŸæ­£å‡ºæ‰‹ï¼Œ
       ç­‰æ–¼å…¨è‡ªå‹•æ¨¡å¼ä¸‹ï¼Œæ¯å€‹è§’è‰²å‡ºæ‰‹å‰
       éƒ½è¦å…ˆé–ƒä¸€ä¸‹ã€ç­‰ä¸€ä¸‹ï¼Œçœ‹èµ·ä¾†åƒæ˜¯
       ã€Œé‚„è¦æ’éšŠç­‰ã€ï¼Œä¸å¤ ä¿è½ã€‚

       æ”¹æˆï¼šåªæœ‰çœŸæ­£éœ€è¦ç©å®¶è‡ªå·±é¸æ“‡çš„æ™‚å€™
       ï¼ˆé€™å€‹è§’è‰²ä¸æ˜¯è‡ªå‹•ï¼‰ï¼Œæ‰é¡¯ç¤ºé–ƒçˆå¤–æ¡†ï¼Œ
       æé†’ç©å®¶è©²åšé¸æ“‡äº†ï¼›å¦‚æœæ˜¯è‡ªå‹•è§’è‰²ï¼Œ
       ä¸éœ€è¦é€™å€‹æé†’ï¼ˆåæ­£ä¹Ÿä¸ç”¨ç©å®¶åšä»»ä½•äº‹ï¼‰ï¼Œ
       ç›´æ¥è·³éé–ƒçˆã€‚
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
       â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œé‚è¼¯åéä¾†ï¼‰ï¼š
       å®£å‘Šéšæ®µï¼ˆç­‰ç©å®¶é¸æ“‡è¦åšä»€éº¼ï¼‰
       ä¸æ‡‰è©²æ”¾å¤§æˆ°é¬¥ç´€éŒ„ï¼Œç¶­æŒå°å°ä¸€å¡Šå°±å¥½ï¼Œ
       æ”¾å¤§äº¤çµ¦çµç®—éšæ®µè² è²¬
       ï¼ˆstartResolutionPhase()é‚£é‚Šè™•ç†ï¼‰ï¼Œ
       é€™è£¡æŠŠåŸæœ¬ã€Œè¼ªåˆ°æ‰‹å‹•è§’è‰²å°±æ”¾å¤§ã€çš„é‚è¼¯æ‹¿æ‰ã€‚
    */


    if(autoOn){

        const scheduledAutoCharacterIndex=activeBattleCharacterIndex;

        /*
           â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼ŒåŠ å¿«ç¯€å¥ï¼‰ï¼š
           åŸæœ¬1000msæ‰æœƒçœŸæ­£å‡ºæ‰‹ï¼Œé€™æ˜¯å°ˆé–€
           ç•™çµ¦ã€Œç©å®¶è‡ªå·±é¸ã€ç”¨çš„æ€è€ƒæ™‚é–“ï¼Œ
           å…¨è‡ªå‹•è§’è‰²ä¸éœ€è¦é€™å€‹ç­‰å¾…ï¼Œ
           èª¿å¿«åˆ°150msï¼ˆä¿ç•™æ¥µçŸ­çš„å»¶é²åªæ˜¯
           é¿å…ç¬é–“è§¸ç™¼é€ æˆçš„æ½›åœ¨æ™‚åºå•é¡Œï¼Œ
           ä¸æ˜¯åˆ»æ„ç•™çµ¦ç©å®¶çœ‹çš„ç­‰å¾…æ™‚é–“ï¼‰ã€‚
        */

        setTimeout(()=>{

            if(
                !battleActive ||
                token!==battleToken
            ){
                return;
            }

            if(battlePresentationLocks.size>0){
                battleAutoActionResume={
                    token:token,
                    characterIndex:scheduledAutoCharacterIndex
                };
                return;
            }


            /*
               â˜… æ–°å¢ï¼ˆé˜²è­·ç¶²ï¼Œè™•ç†ã€Œæ‰“äº†å¹¾è¼ª
               è‡ªå‹•æˆ°é¬¥çªç„¶å®Œå…¨å¡ä½ä¸å‹•ã€
               ä½†æ€ªç‰©é‚„æ˜¯æŒçºŒå‡ºæ‰‹ã€çš„å•é¡Œï¼‰ï¼š

               ç›®å‰æ‰¾ä¸åˆ°è®“è‡ªå‹•åˆ¤æ–·å¡ä½çš„
               ç¢ºåˆ‡è§¸ç™¼æ¢ä»¶ï¼Œä½†ç”¨try-catchåŒ…ä½
               é€™è£¡è‡³å°‘èƒ½ç¢ºä¿ï¼šè¬ä¸€è‡ªå‹•åˆ¤æ–·å…§éƒ¨
               çœŸçš„å› ç‚ºæŸç¨®ç‰¹æ®Šè³‡æ–™ç‹€æ…‹æ‹‹å‡ºä¾‹å¤–ï¼Œ
               ä¸æœƒæ•´å€‹å®‰éœå¡æ­»ã€ä»€éº¼éƒ½ä¸æœƒç™¼ç”Ÿâ€”â€”
               æœƒæŠŠéŒ¯èª¤å…§å®¹å°åœ¨æˆ°é¬¥ç´€éŒ„è£¡è®“ä½ çœ‹åˆ°
               ï¼ˆä¹‹å¾Œå›å ±çµ¦æˆ‘ï¼‰ï¼Œä¸¦ä¸”å¼·åˆ¶å‘¼å«
               finishPlayerAction()è®“æˆ°é¬¥
               ç¹¼çºŒå¾€ä¸‹èµ°ï¼Œä¸æœƒå¡åœ¨åŸåœ°ã€‚
            */

            try{

                battleStatisticsBeginAction({
                    type:"player",
                    characterIndex:scheduledAutoCharacterIndex
                });

                autoActionForCharacter(
                    scheduledAutoCharacterIndex,
                    token
                );

            }
            catch(error){

                console.error(
                    "è‡ªå‹•åˆ¤æ–·ç™¼ç”Ÿä¾‹å¤–ï¼š",
                    error
                );

                addBattleLog(
                    "è‡ªå‹•åˆ¤æ–·ç™¼ç”Ÿä¾‹å¤–ï¼ˆ"+
                    (error&&error.message)+
                    "ï¼‰ï¼Œå·²å¼·åˆ¶ç•¥éé€™å›åˆã€‚"
                );

                finishPlayerAction();

            }

        },150);

    }

}


/*
   â˜… æ–°å¢ï¼šåˆ‡æ›è§’è‰²æ™‚ï¼Œ
   åœ¨ç•«é¢ä¸Šé«˜äº®ã€Œç›®å‰æ­£åœ¨è¡Œå‹•ã€çš„é‚£å¼µå¡ï¼Œ
   è®“ç©å®¶æ¸…æ¥šçŸ¥é“ç¾åœ¨æ˜¯èª°çš„å›åˆã€‚
*/

/*
   â˜… æ–°å¢ï¼šå¡«å…¥å¸¸é§æŠ€èƒ½å¿«æ·åˆ—çš„4å€‹æ ¼å­ï¼Œ
   å…§å®¹æ˜¯ã€Œç›®å‰è¼ªåˆ°èª°è¡Œå‹•ã€é‚£å€‹è§’è‰²è£å‚™çš„æŠ€èƒ½ï¼Œ
   è·ŸèˆŠç‰ˆopenSkillMenu()å½ˆçª—çš„åˆ¤æ–·é‚è¼¯ä¸€è‡´
   ï¼ˆSPå¤ ä¸å¤ ã€ç­‰ç´šé è¦½ï¼‰ï¼Œåªæ˜¯æ”¹æˆå¸¸é§é¡¯ç¤ºï¼Œ
   ä¸ç”¨å¦å¤–é»ã€ŒæŠ€èƒ½ã€æŒ‰éˆ•æ‰çœ‹å¾—åˆ°ã€‚
*/

function bumpBattleRuntimeMetric(name,amount){
    if(typeof window==="undefined"){ return; }
    const metrics=window.FourSymbolsBattleRuntimeMetrics;
    if(!metrics||metrics.enabled!==true||!metrics.counters){ return; }
    const delta=Number.isFinite(Number(amount))?Number(amount):1;
    metrics.counters[name]=(Number(metrics.counters[name])||0)+delta;
}

if(typeof window!=="undefined"&&!window.FourSymbolsBattleRuntimeMetrics){
    const counters={
        updateUI:0,
        updateMonsterUI:0,
        syncMonsterPortraits:0,
        quickBarPopulate:0,
        quickBarRebuild:0,
        repairScheduler:0
    };
    window.FourSymbolsBattleRuntimeMetrics={
        enabled:false,
        counters:counters,
        reset:function(){ Object.keys(counters).forEach(key=>{ counters[key]=0; }); },
        snapshot:function(){ return Object.assign({},counters); }
    };
}

function isCanonicalSkillQuickBarButton(button){
    if(!button||!button.classList||!button.classList.contains("skill-quick-button")){ return false; }
    return [
        ".sq-icon-wrap",".sq-icon-image",".sq-icon-fallback",".sq-sp-block",
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
            '<span class="sq-icon-wrap"><span class="sq-icon-image"></span><span class="sq-icon-fallback"></span><span class="sq-sp-block" hidden>SPä¸è¶³</span></span>'+
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
        if(nameNode){ nameNode.textContent=skillId?"è³‡æ–™éŒ¯èª¤":"ï¼ˆç©ºï¼‰"; }
        if(costNode){ costNode.textContent="â€”"; }
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
        const text="æ¶ˆè€— "+spCost+" SP";
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

    bumpBattleRuntimeMetric("quickBarPopulate");

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
       å¦‚æœç›®å‰æ˜¯ç©ºçš„ï¼ˆä¾‹å¦‚é‚„æ²’è¼ªåˆ°ç©å®¶ã€
       æˆ–æ˜¯è‡ªå‹•æˆ°é¬¥é–‹å•Ÿä¸­ï¼ŒpopulateSkillQuickBar()
       æ²’æœ‰å¡«å…¥ä»»ä½•æŒ‰éˆ•ï¼‰ï¼Œå°±ä¸è¦æ‰“é–‹ä¸€å€‹
       ç©ºç©ºçš„è¦†è“‹å±¤ã€‚
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
        return "æ™®é€šæ”»æ“Š";
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
    if(promptAction){ promptAction.textContent="é¸æ“‡ ["+getBattleActionDisplayName(actionType)+"]"; }
    currentBattleMonsters.forEach(index=>{
        const card=$("battleMonster"+index);
        if(card){ card.classList.toggle("targetable",canSelectHostileBattlePrimary("monster",index,targetType)); }
    });
    const targetText=$("battleTarget");
    if(targetText){ targetText.textContent="ç›®æ¨™ï¼šè«‹é¸æ“‡"; }
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
   V119 â€” æˆ‘æ–¹å–®é«”æŠ€èƒ½ç›®æ¨™é¸æ“‡
   æ²»ç™‚è¡“ï¼å¾©æ´»è¡“ï¼éš±èº«è¡“ï¼è¬è±¡åœŸç›¾ï¼çµç•Œä½¿ç”¨ç¾æœ‰ç©å®¶å¡ç‰‡é¸äººï¼Œ
   ä¸å†å¯«æ­»åªå°è§’è‰²ä¸€è™Ÿè‡ªå·±ç”Ÿæ•ˆã€‚å…¨é«”æŠ€èƒ½ä»ç›´æ¥å®£å‘Šï¼Œä¸å¤šä¸€æ­¥é¸æ“‡ã€‚
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
        promptAction.textContent="é¸æ“‡ ["+getBattleActionDisplayName(actionType)+"] çš„æˆ‘æ–¹ç›®æ¨™";
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
    if(targetText){ targetText.textContent="ç›®æ¨™ï¼šè«‹é¸æ“‡æˆ‘æ–¹è§’è‰²"; }
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


/* V99 â€” åœ¨å·²é¸æŠ€èƒ½ã€ç­‰å¾…é»æ€ªç‰©ç›®æ¨™çš„éšæ®µå…è¨±ã€Œè¿”å›ã€ã€‚
   åªå–æ¶ˆå°šæœªé€é€² queuedPlayerActions çš„æš«å­˜å®£å‘Šï¼Œä¸æ¨é€²å›åˆã€
   ä¸é‡è¨­è¨ˆæ™‚å™¨ï¼Œä¹Ÿä¸æ‰£ SPï¼›è‹¥å‰›æ‰èª¤é¸çš„æ˜¯æŠ€èƒ½ï¼Œå°±ç›´æ¥å›åˆ°
   åŒä¸€è§’è‰²çš„æŠ€èƒ½é¸æ“‡æ¡†ï¼Œæ™®é€šæ”»æ“Šå‰‡å›åˆ°äº”é¡†æˆ°é¬¥æŒ‡ä»¤ã€‚ */
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
        targetText.textContent="ç›®æ¨™ï¼šå°šæœªé¸æ“‡";
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
       â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œç‰ˆé¢é‡æ–°è¨­è¨ˆï¼‰ï¼š
       åŸæœ¬é€™è£¡æœƒæ‰¾å·¦å´ç›´æ›¸çš„activeTurnLabel
       çª„æ¢ï¼ŒæŠŠç›®å‰è¼ªåˆ°èª°çš„åå­—å¯«é€²å»ã€‚
       é€™å€‹å…ƒç´ å·²ç¶“æ‹¿æ‰ï¼ˆæ”¹æˆã€ŒæŠ€èƒ½ã€æŒ‰éˆ•ï¼‰ï¼Œ
       ç¾åœ¨ã€Œè¼ªåˆ°èª°ã€å–®ç´”é ä¸Šé¢
       battlePlayerCardçš„active-turnå¤–æ¡†
       é«˜äº®é¡¯ç¤ºï¼Œä¸éœ€è¦å¦å¤–çš„æ–‡å­—æ¨™ç±¤ã€‚
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
       â˜… æ–°å¢ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼‰ï¼š
       æ¯è®€ç§’ä¸€æ¬¡ï¼Œæ•¸å­—å°±çªç„¶æ”¾å¤§å†ç¬é–“ç¸®å°ï¼Œ
       è£½é€ ã€Œè·³å‹•ã€çš„æ„Ÿè¦ºï¼Œè®“å€’æ•¸è¨ˆæ™‚
       æ›´é¡¯çœ¼ã€æ›´å®¹æ˜“æ³¨æ„åˆ°æ™‚é–“åœ¨æµé€ã€‚
       ç”¨ç§»é™¤å†å¼·åˆ¶è§¸ç™¼reflowå†åŠ å›classçš„
       æ–¹å¼ï¼Œç¢ºä¿é€£çºŒå…©æ¬¡éƒ½æ˜¯åŒä¸€å€‹æ•¸å­—
       ï¼ˆä¾‹å¦‚éƒ½è·³é5ç§’çš„é–€æª»ï¼‰æ™‚ï¼Œ
       å‹•ç•«é‚„æ˜¯èƒ½é‡æ–°æ’­æ”¾ä¸€æ¬¡ï¼Œä¸æœƒå› ç‚º
       classæ²’æœ‰è®ŠåŒ–è€Œè¢«ç€è¦½å™¨å¿½ç•¥ã€‚
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
        "â° æ™‚é–“åˆ°ï¼Œæœ¬å›åˆæ²’æœ‰è¡Œå‹•ã€‚"
    );


    actionReady=false;

    pendingAction=null;


    /*
       â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œå¾¹åº•æª¢æŸ¥å¾Œ
       æŠ“åˆ°çš„å¦ä¸€å€‹æ½›åœ¨é¢¨éšªï¼‰ï¼š
       é€™è£¡åŸæœ¬è‡ªå·±åˆé‡å¯«äº†ä¸€æ¬¡ã€Œå®£å‘Šé€¾æ™‚
       å¾€ä¸‹ä¸€ä½ã€è·Ÿã€Œçµç®—é€¾æ™‚å¾€ä¸‹ä¸€å€‹
       initiativeIndexã€çš„é‚è¼¯ï¼Œè·Ÿ
       finishPlayerAction()è£¡è™•ç†çš„æ˜¯åŒä¸€ä»¶äº‹ï¼Œ
       å»æ˜¯å…©ä»½å®Œå…¨ç¨ç«‹ã€äº’ä¸çŸ¥æƒ…çš„å¯¦ä½œ
       ï¼ˆé€£delayæ™‚é–“éƒ½ä¸ä¸€æ¨£ï¼Œä¸€å€‹120msã€
       ä¸€å€‹1200ms/1700msï¼‰ã€‚

       å…©å¥—å¯¦ä½œå„è‡ªç¶­è­·åŒä¸€ä»½ç‹€æ…‹
       ï¼ˆactiveBattleCharacterIndexï¼
       initiativeIndexï¼‰ï¼Œåªè¦æ—¥å¾Œæ”¹ä¸€é‚Šã€
       å¿˜äº†æ”¹å¦ä¸€é‚Šï¼Œæˆ–æ˜¯é€™è£¡çœŸçš„è¢«è§¸ç™¼åˆ°
       è·ŸfinishPlayerAction()åŒæ™‚æ¶è‘—æ¨é€²ï¼Œ
       å°±æœƒè£½é€ å‡ºç´¢å¼•è¢«æ¨é€²å…©æ¬¡ã€
       æŸå€‹è§’è‰²æˆ–æ€ªç‰©çš„è¡Œå‹•è¢«è·³éçš„é‚£é¡å•é¡Œ
       â€”â€”é€™æ­£æ˜¯é€™å¹¾è¼ªä¸€ç›´åœ¨æŠ“çš„bugå‹æ…‹ã€‚

       æ”¹æˆç›´æ¥å‘¼å«finishPlayerAction()ï¼Œ
       è®“ã€Œæ€éº¼æ¨é€²åˆ°ä¸‹ä¸€ä½ã€æ°¸é åªæœ‰
       ä¸€å€‹åœ°æ–¹åœ¨åšæ±ºå®šï¼Œé€™è£¡ä¸å†è‡ªå·±ç¶­è­·
       ç¬¬äºŒå¥—é‚è¼¯ã€‚
    */

    finishPlayerAction();

}


/* =====================================================
   è¡Œå‹•
===================================================== */

function prepareAction(type){

    /*
       â˜… ä¿®æ­£ï¼š
       åŸæœ¬é€™è£¡æ°¸é æª¢æŸ¥player.spã€
       æ°¸é å‡è¨­æ“ä½œçš„æ˜¯ç¬¬ä¸€è§’è‰²ã€‚
       ç¾åœ¨æ”¹æˆå…ˆçœ‹
       activeBattleCharacterIndexæ˜¯èª°çš„å›åˆï¼Œ
       ç”¨å°æ‡‰è§’è‰²çš„æŠ€èƒ½é»/SP/è‡ªå‹•ç‹€æ…‹ä¾†åˆ¤æ–·ã€‚
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

    const activeSkillKey=getPartyCharacterKey(activeBattleCharacterIndex);
    const activeLoadout=characterSkillLoadouts[activeSkillKey];


    if(
        type!=="normal"&&
        skill
    ){
        if(!activeLoadout||!(activeLoadout.skillLevels&&Number(activeLoadout.skillLevels[type])>0)||
            !Array.isArray(activeLoadout.equippedSkills)||!activeLoadout.equippedSkills.includes(type)){
            addBattleLog("å°šæœªå­¸æœƒæˆ–è£å‚™ã€Œ"+skill.name+"ã€ã€‚");
            return;
        }

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
                "SPä¸è¶³ï¼Œç„¡æ³•ä½¿ç”¨"+
                skill.name
            );

            return;

        }


        /*
           â˜… ä¿®æ­£ï¼ˆé‡è¦ï¼Œä¾ç…§ä½¿ç”¨è€…æ˜ç¢ºæŒ‡æ­£ï¼‰ï¼š
           å¢ç›Š/æ²»ç™‚/å¾©æ´»é€™é¡æŠ€èƒ½ä¹‹å‰æ˜¯ã€Œé¸äº†å°±ç«‹åˆ»ç”Ÿæ•ˆã€ï¼Œ
           å®Œå…¨ç¹éå®£å‘Š/çµç®—æ©Ÿåˆ¶ã€‚

           ä½†ç©å®¶æ˜ç¢ºæŒ‡å‡ºï¼šå›åˆåˆ¶çš„æ ¸å¿ƒç²¾ç¥æ˜¯
           ã€Œæ‰€æœ‰è¡Œå‹•éƒ½è¦ç…§æ•æ·é †åºçµç®—ã€ï¼Œ
           æ²»ç™‚/å¢ç›Šä¹Ÿä¸ä¾‹å¤–â€”â€”æ•æ·å¤ªä½çš„è©±ï¼Œ
           æƒ³å¹«éšŠå‹è£œè¡€ï¼Œå¯èƒ½é‚„æ²’è¼ªåˆ°ä½ ï¼Œ
           éšŠå‹å·²ç¶“è¢«æ‰“æ­»äº†ï¼Œé€™æ‰æ˜¯æ•æ·é€™å€‹æ•¸å€¼
           è©²æœ‰çš„é‡è¦æ€§ï¼Œä¸èƒ½è®“æ²»ç™‚/å¢ç›Šè®Šæˆ
           ã€Œç„¡è¦–é †åºã€é»äº†å°±ç”Ÿæ•ˆã€çš„ç‰¹ä¾‹ã€‚

           æ”¹æˆè·Ÿå‚·å®³æŠ€èƒ½ä¸€æ¨£ï¼Œå…ˆã€Œå®£å‘Šã€å­˜èµ·ä¾†ï¼Œ
           ç­‰çµç®—éšæ®µç…§æ•æ·é †åºæ‰çœŸæ­£ç”Ÿæ•ˆã€‚
        */

        if(
            skill.category==="buff"||
            skill.category==="heal"||
            skill.category==="revive"
        ){

            if(activeBattleCharacterIndex!==0){
                addBattleLog(
                    "è¿½åŠ è§’è‰²ç›®å‰åƒ…æ”¯æ´æ‰‹å‹•æ–½æ”¾æ”»æ“ŠæŠ€èƒ½ã€‚"
                );
                return;
            }

            /* å–®é«”æˆ‘æ–¹æŠ€èƒ½å…ˆé¸è§’è‰²ï¼›å…¨é«”æŠ€èƒ½ç¶­æŒç›´æ¥å®£å‘Šã€‚ */
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
                        ? "ç›®å‰æ²’æœ‰é™£äº¡çš„éšŠå‹å¯ä¾›å¾©æ´»ã€‚"
                        : "ç›®å‰æ²’æœ‰å¯é¸æ“‡çš„å‹æ–¹ç›®æ¨™ã€‚"
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


    const hostileTargetType=getBattleActionTargetType(type,activeBattleCharacterIndex);

    if(hostileTargetType==="all"){
        queuedPlayerActions[activeBattleCharacterIndex]={action:type,target:null};
        closeMenus();
        updateUI();
        finishPlayerAction();
        return;
    }

    const hasSelectablePrimary=currentBattleMonsters.some(index=>
        canSelectHostileBattlePrimary("monster",index,hostileTargetType)
    );
    if(!hasSelectablePrimary){
        addBattleLog("ç›®å‰æ²’æœ‰å¯è¢«"+getBattleActionDisplayName(type)+"é¸ä¸­çš„ç›®æ¨™ã€‚");
        return;
    }

    actionReady=true;
    pendingAction=type;
    closeMenus();
    setBattleTargetSelectionMode(type);

}


function selectBattleTarget(index){

    if(
        !battleActive ||
        !monsters[index] ||
        !monsters[index].alive
    ){
        return;
    }

    /* During a real hostile-target declaration, Stealth and the formal
       Target Shape gate primary selection. Outside declaration mode this
       helper may still project an already-resolved/programmatic target
       (Boss objects, QA, replay/presentation) without inventing an action. */
    if(actionReady&&pendingAction){
        const targetType=getBattleActionTargetType(pendingAction,activeBattleCharacterIndex);
        if(!canSelectHostileBattlePrimary("monster",index,targetType)){ return; }
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

        "ç›®æ¨™ï¼š"+
        monsters[index].name;


    /*
       â˜… ä¿®æ­£ï¼š
       åŸæœ¬åªæª¢æŸ¥å…¨åŸŸçš„autoBattleï¼Œ
       ç¾åœ¨è¦çœ‹ç›®å‰è¼ªåˆ°èª°çš„å›åˆï¼Œ
       ç”¨å°æ‡‰è§’è‰²çš„è‡ªå‹•é–‹é—œä¾†åˆ¤æ–·ã€‚
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
           â˜… ä¿®æ­£ï¼ˆé‡æ–°è¨­è¨ˆå›åˆåˆ¶ï¼‰ï¼š
           é»é¸ç›®æ¨™ä¹‹å¾Œï¼Œä¸å†é¦¬ä¸ŠåŸ·è¡Œæ”»æ“Šï¼Œ
           è€Œæ˜¯å…ˆæŠŠã€Œé€™å€‹è§’è‰²æ±ºå®šè¦åšçš„äº‹ã€
           å­˜é€²queuedPlayerActionsï¼Œ
           ç­‰æ‰€æœ‰æ´»è‘—çš„è§’è‰²éƒ½é¸å¥½äº†ï¼Œ
           æ‰æœƒåœ¨çµç®—éšæ®µä¾æ•æ·é †åºçœŸæ­£å‡ºæ‰‹ã€‚
        */

        queuedPlayerActions[
            activeBattleCharacterIndex
        ]={

            action:action,

            target:index

        };


        /*
           â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼‰ï¼š
           ä¸éœ€è¦åœ¨å®£å‘Šéšæ®µå°±å…ˆå°ä¸€è¡Œ
           ã€Œå·²é¸æ“‡XXï¼Œç›®æ¨™ï¼šYYã€æµªè²»ç•«é¢ç©ºé–“ã€
           æµªè²»æ™‚é–“è®“ç©å®¶ç­‰ï¼Œç›´æ¥é€²çµç®—éšæ®µï¼Œ
           ç­‰çœŸæ­£é€ æˆå‚·å®³çš„é‚£ä¸€åˆ»ï¼Œ
           å†é¡¯ç¤ºã€Œèª°ç”¨äº†ä»€éº¼æŠ€èƒ½æ‰“äº†èª°ã€
           é€ æˆå¤šå°‘å‚·å®³ã€åˆä½µæˆä¸€è¡Œå°±å¥½ã€‚
        */

        finishPlayerAction();

    }

}


function executeAction(action){

    /*
       â˜… ä¿®æ­£ï¼š
       åŸæœ¬é€™è£¡æ°¸é æ“ä½œç¬¬ä¸€è§’è‰²ã€‚
       ç¾åœ¨å…ˆåˆ¤æ–·ç›®å‰æ˜¯ä¸æ˜¯ç¬¬äºŒè§’è‰²çš„å›åˆï¼Œ
       æ˜¯çš„è©±èµ°player2å°ˆå±¬çš„æ–½æ”¾å‡½å¼
       ï¼ˆcastPlayer2Skill/player2NormalAttackï¼‰ï¼Œ
       ä¸¦ä¸”è¦è‡ªå·±å‘¼å«finishPlayerAction()
       å¾€ä¸‹æ¨é€²åˆ°ä¸‹ä¸€ä½è§’è‰²/æ€ªç‰©å›åˆ
       ï¼ˆplayer2çš„å‡½å¼æœ¬èº«ä¸æœƒè‡ªå‹•å‘¼å«é€™å€‹ï¼Œ
       å› ç‚ºè‡ªå‹•æ¨¡å¼é‚£é‚Šä¹Ÿæ˜¯å‘¼å«å®Œæ‰å‘¼å«ä¸€æ¬¡ï¼Œ
       æ‰‹å‹•é€™é‚Šè¦å°ç¨±è™•ç†ï¼‰ã€‚
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
       â˜… æ–°ç‰ˆè³‡æ–™é©…å‹•æŠ€èƒ½ï¼ˆç«ç³»10å€‹æŠ€èƒ½è£¡ï¼Œ
       æœ‰å‚·å®³è¼¸å‡ºçš„8å€‹éƒ½æœƒèµ°é€™è£¡ï¼Œ
       æ°´ç³»çš„å‚·å®³æŠ€èƒ½ä¹‹å¾Œä¹Ÿæœƒèµ°é€™è£¡ï¼‰ã€‚
       æ€’ç«ï¼ˆbuffï¼‰ã€æ²»ç™‚è¡“ï¼ˆhealï¼‰ã€
       å¾©æ´»è¡“ï¼ˆreviveï¼‰éƒ½ä¸æœƒèµ°åˆ°é€™è£¡ï¼Œ
       å› ç‚ºprepareAction()å·²ç¶“æŠŠå®ƒå€‘æ””æˆªæ‰äº†ï¼Œ
       é€™è£¡å¤šæ’é™¤ä¸€æ¬¡ç´”ç²¹æ˜¯é˜²å‘†ï¼Œ
       é¿å…è¬ä¸€æœ‰æŠ€èƒ½ç¹éprepareAction()
       èª¤æŠŠæ²»ç™‚/å¾©æ´»æŠ€èƒ½ç•¶æˆå‚·å®³æŠ€èƒ½ä¾†æ‰“ã€‚
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
   å‚·å®³
===================================================== */

/*
   V173.38ï¼šç©å®¶ã€æ€ªç‰©ã€æ™®é€šæ”»æ“Šèˆ‡æŠ€èƒ½å…±ç”¨å”¯ä¸€æ­£å¼å‚·å®³ ownerã€‚
   é †åºï¼šç­‰ç´šã€å…ƒç´ ã€é˜²ç¦¦ã€æ™®é€šå¢å‚·åŠ ç®—æ¡¶ã€çˆ†æ“Šã€æ•µæ–¹å£“åŠ›ã€
   æŠ€èƒ½å‚·å®³é ç®—ã€95%ï½105% æµ®å‹•ã€‚
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
    if(attacker&&typeof window!=="undefined"&&window.FourSymbolsSkillDamageContext&&
        window.FourSymbolsSkillDamageContext.attacker===attacker&&
        window.FourSymbolsSkillDamageContext.skill===skill){
        total+=Number(window.FourSymbolsSkillDamageContext.directSkillBonusPercent)||0;
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
    /* Element counter is character DNA, never the skill visual identity. */
    const attacker=getDamageContextAttacker(options);
    const elementFactor=getElementalDamageMultiplier((attacker&&attacker.element)||casterElement,targetElement);
    const formulaConstant=getDamageFormulaConstant(targetLevel);
    const defenseFactor=formulaConstant/(formulaConstant+safeDefense);
    const ordinaryFactor=getOrdinaryDamageMultiplier(options);
    const requestedCrit=Number(options.critMultiplier);
    const criticalFactor=Number.isFinite(requestedCrit)
        ?Math.max(1,Math.min(FINAL_CRITICAL_MULTIPLIER_MAX,requestedCrit))
        :1;
    const pressureFactor=getEnemyPressureMultiplier(attacker,options.target||null);
    const bossOwner=typeof window!=="undefined"?window.FourSymbolsBossBattle:null;
    const bossDamageFactor=bossOwner&&typeof bossOwner.getOutgoingDamageMultiplier==="function"
        ?Math.max(0,Number(bossOwner.getOutgoingDamageMultiplier(attacker))||0):1;
    const budgetFactor=getDamageBudgetMultiplier(options);
    const randomFactor=0.95+Math.random()*0.10;

    const result=
        safeAttack*levelFactor*elementFactor*defenseFactor*
        ordinaryFactor*criticalFactor*pressureFactor*bossDamageFactor*budgetFactor*randomFactor;

    if(!Number.isFinite(result)){ return 1; }
    return Math.max(1,Math.round(result));
}

/* =====================================================
   å‘½ä¸­ï¼é–ƒèº²å”¯ä¸€æ­£å¼å…¬å¼ Owner

   æœ€çµ‚å‘½ä¸­ç‡ =
   95 + å‘½ä¸­Ã—0.15 + æœ€çµ‚å‘½ä¸­åŠ æˆ
   - ç›®æ¨™æœ€çµ‚é–ƒèº² - æœ€çµ‚å‘½ä¸­ä¸‹é™ã€‚

   æ‰€æœ‰ç™¾åˆ†æ¯”æ•ˆæœçš†æ˜¯ã€Œæœ€çµ‚ç™¾åˆ†é»ã€åŠ æ¸›ï¼Œä¸å†å…ˆå°é ‚å‘½ä¸­å¾Œ
   ä¹˜ä¸Š (1 - é–ƒèº²ç‡)ã€‚æœ€å¾Œçµ±ä¸€é™åˆ¶åœ¨ 70%ï½99%ã€‚
   æ™®é€šæ€ªç‰©æœªæ˜ç¢ºæŒ‡å®š evasion æ™‚ï¼Œä½¿ç”¨ min(10%, ç­‰ç´šÃ—0.1%)ã€‚
===================================================== */

const HIT_CHANCE_BASE = 95;
const HIT_CHANCE_ACCURACY_COEFFICIENT = 0.15;
const HIT_CHANCE_MIN_PERCENT = 70;
const HIT_CHANCE_MAX_PERCENT = 99;


/*
   â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œæ€ªç‰©å…­åœç³»çµ±
   å®Œæˆå¾Œï¼Œé€™ä¸‰å€‹å‡½å¼æ”¹æˆç›´æ¥è®€æ€ªç‰©èº«ä¸Š
   çœŸæ­£ç®—å¥½çš„æ•¸å€¼ï¼Œä¸å†ç”¨ç­‰ç´šæ¦‚ç•¥æ›ç®—ï¼‰ï¼š
   makeZoneMonster()å·²ç¶“æŠŠevasion/accuracy/
   resistance/agilityé€™äº›æœ€çµ‚æ•¸å€¼ç®—å¥½å­˜åœ¨
   æ€ªç‰©ç‰©ä»¶ä¸Šäº†ï¼ˆè·Ÿç©å®¶getBaseStats()åŒä¸€å¥—
   å…¬å¼ï¼šé è¨­é–ƒé¿=min(30%,ç­‰ç´šÃ—0.3%)ã€å‘½ä¸­=ç²¾ç¥Ã—2ã€ä¸€èˆ¬ç•°å¸¸æŠ—æ€§=ç²¾ç¥Ã—0.05ã€
   è¡Œå‹•é †åºç”¨çš„é€Ÿåº¦=æ•æ·åŸå§‹é»æ•¸ï¼‰ï¼Œ
   é€™è£¡ç›´æ¥è®€å‡ºä¾†ï¼Œä¸ç”¨å†å¦å¤–ç®—ä¸€æ¬¡ã€‚

   ä¿ç•™monster.xxx===undefinedæ™‚çš„èˆŠå…¬å¼
   ç•¶ä½œé˜²å‘†å‚™æ´ï¼Œç†è«–ä¸Šä¸æœƒç”¨åˆ°ï¼ˆç¾åœ¨
   makeZoneMonster()ä¸€å®šæœƒçµ¦é€™äº›æ¬„ä½ï¼‰ï¼Œ
   ç´”ç²¹é¿å…è¬ä¸€æœ‰æ¼ç¶²çš„æ€ªç‰©è³‡æ–™æ ¼å¼æ²’å°é½Š
   è€Œæ•´å€‹å£æ‰ã€‚
*/

/*
   â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œæ¥ä¸Šé¢¨ç³»/åœŸç³»
   æŠ€èƒ½çš„æ¸›ç›Šæ•ˆæœï¼‰ï¼š
   æ•æ·èˆ‡å‘½ä¸­å±¬æ€§å±¤åªè™•ç† agilityDown èˆ‡
   statDown ç­‰çœŸæ­£æœƒä¿®æ”¹èƒ½åŠ›å€¼çš„æ¸›ç›Šã€‚
   stunï¼ˆæšˆçœ©ï¼‰ä¸å†ä¿®æ”¹å‘½ä¸­å±¬æ€§æœ¬èº«ï¼›å®ƒæœƒåœ¨
   rollHitChance() çš„æœ€å¾Œä¸€æ­¥ï¼Œç›´æ¥é™ä½æœ€çµ‚å‘½ä¸­ç‡ï¼Œ
   è®“æŠ€èƒ½æè¿°èˆ‡å¯¦æˆ°è¨ˆç®—ä¸€è‡´ã€‚
*/

function getMonsterEvasion(monster){

    if(!monster){ return 0; }

    const base=monster.evasion!==undefined
        ?Number(monster.evasion)||0
        :getDefaultMonsterEvasion(monster.level);

    const agilityDown=getMonsterDebuffValue(monster,"agilityDown");
    const statDown=getStatDownPercentFor(monster,"agility");
    const frostbitePenalty=getFrostbiteFinalPercentPointPenalty(monster);

    return combineEvasionRates([
        base,
        -agilityDown,
        -statDown,
        -frostbitePenalty
    ]);

}


/*
   â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œé‡æ–°è¨­è¨ˆæšˆçœ©
   çŒ›æ“Šçš„æšˆçœ©æ•ˆæœç®—æ³•ï¼‰ï¼š
   åŸæœ¬stuné€™å€‹æ¸›ç›Šæ˜¯åœ¨é€™è£¡ï¼ˆå‘½ä¸­å€¼æœ¬èº«ï¼‰
   æ‰“æŠ˜æ‰£ï¼Œå†è®“æ‰“å®ŒæŠ˜çš„å‘½ä¸­å€¼å»è·‘æ­£å¸¸çš„
   å‘½ä¸­å…¬å¼ï¼Œç­‰æ–¼æ˜¯ã€Œé–“æ¥ã€å½±éŸ¿æœ€çµ‚æ©Ÿç‡ï¼Œ
   ä½¿ç”¨è€…æœ€æ–°çµ¦çš„æ•¸å€¼æ˜¯ã€Œé™ä½æ©Ÿç‡ç”±æŠ€èƒ½
   ç­‰ç´šä½è‡³é«˜ç‚º-15%/-20%/-25%/-30%/-35%ã€ï¼Œè®€èµ·ä¾†æ˜¯
   ç›´æ¥å¾æœ€çµ‚å‘½ä¸­æ©Ÿç‡æ‰£æ‰é€™å€‹%æ•¸ï¼Œä¸æ˜¯
   åœ¨å‘½ä¸­å€¼é€™å±¤æ‰“æŠ˜â€”â€”å…©ç¨®ç®—æ³•ç®—å‡ºä¾†çš„
   æœ€çµ‚å‘½ä¸­ç‡ä¸ä¸€æ¨£ï¼Œç…§å­—é¢æ„æ€æ”¹æˆ
   ã€Œç›´æ¥æ‰£ã€ï¼Œé€™è£¡æ‹¿æ‰stunï¼Œåªç•™
   statDownï¼ˆå…¨å±¬æ€§ä¸‹é™é¡debuffæ‰æœƒå‹•åˆ°
   å‘½ä¸­å€¼æœ¬èº«ï¼‰ï¼Œæšˆçœ©çš„æ‰£æ¸›ç§»åˆ°
   rollHitChance()è£¡è™•ç†ï¼ˆè¦‹è©²å‡½å¼æ—çš„
   èªªæ˜ï¼‰ï¼Œå‘¼å«æ™‚æ©Ÿæ˜¯ã€Œé€™éš»æ€ªç‰©çœŸçš„è¦
   å‡ºæ‰‹æ”»æ“Šã€çš„é‚£ä¸€åˆ»ï¼Œæ¯”è¼ƒç¬¦åˆã€Œå‘½ä¸­ç‡
   é™ä½ã€é€™å€‹æè¿°çš„å­—é¢æ„æ€ã€‚
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
        base*(1-statDown/100)
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
   â˜… æ–°å¢ï¼ˆé‡è¦ï¼‰ï¼šæ•æ·æ’åºçš„è¡Œå‹•é †åºç³»çµ±ã€‚

   è¦æ ¼ï¼šã€Œé›™æ–¹ä¾æ•æ·é«˜ä½é †åºå…ˆå¾Œå‡ºæ‰‹è¡Œå‹•ã€â€”â€”
   ä¹‹å‰æ˜¯ã€Œç©å®¶å…¨éƒ¨è¡Œå‹•å®Œï¼Œæ€ªç‰©æ‰é–‹å§‹æ”»æ“Šã€ï¼Œ
   å…©é‚Šå„è‡ªä¸€æ‰¹ï¼Œç¾åœ¨æ”¹æˆç©å®¶è·Ÿæ€ªç‰©æ··åœ¨ä¸€èµ·ï¼Œ
   ä¾æ•æ·ï¼ˆå«è£å‚™åŠ æˆï¼‰ç”±é«˜åˆ°ä½æ’ä¸€ä»½è¡Œå‹•æ¸…å–®ï¼Œ
   é€™ä»½æ¸…å–®åœ¨æ¯å€‹ã€Œå¤§å›åˆã€é–‹å§‹æ™‚é‡æ–°ç®—ä¸€æ¬¡
   ï¼ˆinitiativeQueueï¼‰ï¼Œ
   ç„¶å¾Œä¸€å€‹ä¸€å€‹ç…§é †åºè™•ç†ï¼ˆprocessNextCombatant()ï¼‰ï¼Œ
   è¼ªåˆ°èª°ã€èª°æ‰è¡Œå‹•ã€‚

   æ•æ·ç›¸åŒæ™‚ä½ è¦æ±‚ã€Œä¸€æ¨£å°±æ˜¯éš¨æ©Ÿã€ï¼Œ
   æ‰€ä»¥æ’åºæ™‚é¡å¤–åŠ ä¸€å€‹å°çš„éš¨æ©Ÿäº‚æ•¸å†æ¯”è¼ƒï¼Œ
   æ•æ·ç›¸åŒçš„æƒ…æ³ä¸‹é †åºæœƒéš¨æ©Ÿæ´—ç‰Œï¼Œ
   ä¸æœƒæ¯æ¬¡éƒ½å›ºå®šåŒä¸€å€‹äººå…ˆæ‰‹ã€‚
*/

let initiativeQueue=[];

/*
   â˜… æ–°å¢ï¼šè·ŸdeclaredCharacterIndexesåŒä¸€ç¨®
   é˜²è­·ï¼Œæ“‹æ‰æ‰‹æ©Ÿç€è¦½å™¨è¨ˆæ™‚å™¨å»¶é²/è£œç™¼
   å°è‡´processNextCombatant()è¢«åŒä¸€å€‹
   initiativeIndexé‡è¤‡å‘¼å«çš„å•é¡Œã€‚
   æ¯æ¬¡startResolutionPhase()é–‹å§‹æ–°çš„
   çµç®—éšæ®µæ™‚æ¸…ç©ºã€‚
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
                monsters[i].alive &&
                monsters[i].canAct!==false
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
       â˜… ä¿®æ­£ï¼ˆé‡æ–°è¨­è¨ˆå›åˆåˆ¶ä¹‹å¾Œï¼Œé€™è£¡æ”¹å›å–®ç´”æ’åºï¼‰ï¼š
       ä¹‹å‰é€™è£¡æœ‰å€‹ã€Œç¬¬ä¸€å›åˆå¼·åˆ¶ç©å®¶æ’æœ€å‰é¢ã€çš„
       ç‰¹æ®Šè™•ç†ï¼Œæ˜¯åœ¨é‚„æ²’æœ‰å®£å‘Š/çµç®—å…©éšæ®µä¹‹å‰
       çš„æš«æ™‚è§£æ³•ã€‚

       ç¾åœ¨æœ‰äº†å®£å‘Šéšæ®µï¼Œç©å®¶æœ¬ä¾†å°±ä¸€å®šæœƒåœ¨
       çµç®—é–‹å§‹ã€Œä¹‹å‰ã€æŠŠé€™å›åˆè¦åšä»€éº¼æ±ºå®šå¥½ï¼Œ
       ä¸ç®¡ç¬¬å¹¾å›åˆéƒ½ä¸€æ¨£ï¼Œæ‰€ä»¥é€™å€‹ç‰¹æ®Šè™•ç†
       å·²ç¶“ä¸éœ€è¦äº†â€”â€”çµç®—éšæ®µå–®ç´”ä¾æ•æ·é«˜ä½æ’åºå°±å¥½ï¼Œ
       æ•æ·å¿«çš„æ€ªç‰©ä¾ç„¶å¯ä»¥æ¶åˆ°ã€Œçµç®—é †åºã€çš„å…ˆæ‰‹ï¼Œ
       ä½†é‚£å·²ç¶“æ˜¯ç©å®¶æ±ºå®šå¥½è¡Œå‹•ä¹‹å¾Œçš„äº‹äº†ï¼Œ
       ä¸æœƒå†æœ‰ã€Œé‚„æ²’è¨­å®šå°±å…ˆæŒ¨æ‰“ã€çš„å•é¡Œã€‚
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
   â˜… æ–°å¢ï¼šæ•´å€‹å›åˆçš„ç¸½èª¿åº¦å™¨ã€‚
   æ¯æ¬¡ä¸€å€‹combatantï¼ˆä¸ç®¡æ˜¯è§’è‰²é‚„æ˜¯æ€ªç‰©ï¼‰
   è¡Œå‹•çµæŸï¼Œéƒ½æœƒå‘¼å«é€™è£¡ï¼Œ
   å¾€initiativeQueueçš„ä¸‹ä¸€ä½æ¨é€²ã€‚
   æ¸…å–®è·‘å®Œå°±ä»£è¡¨é€™å€‹å¤§å›åˆçµæŸï¼Œ
   é–‹ä¸‹ä¸€è¼ªï¼ˆå›åˆæ•¸+1ã€é‡æ–°çµç®—ç‡ƒç‡’/buffã€
   é‡æ–°æ’ä¸€æ¬¡æ–°çš„è¡Œå‹•é †åºï¼‰ã€‚
*/

/*
   â˜… æ–°å¢ï¼šé–‹å§‹çµç®—éšæ®µã€‚
   å®£å‘Šéšæ®µå…¨éƒ¨äººéƒ½é¸å¥½ä¹‹å¾Œæ‰æœƒå‘¼å«é€™è£¡ï¼Œ
   æŠŠã€Œå·²å®£å‘Šçš„ç©å®¶è¡Œå‹•ã€è·Ÿã€Œæ€ªç‰©ã€
   æ··åœ¨ä¸€èµ·ï¼Œä¾æ•æ·é«˜ä½æ’ä¸€ä»½åŸ·è¡Œé †åºï¼Œ
   ç„¶å¾Œé–‹å§‹ä¸€å€‹ä¸€å€‹çœŸæ­£åŸ·è¡Œã€‚
*/

function startResolutionPhase(token){

    if(
        !battleActive ||
        token!==battleToken
    ){
        return;
    }


    /*
       â˜… ä¿®æ­£ï¼ˆçœŸæ­£æŠ“åˆ°ã€ŒåŒä¸€éš»æ€ªç‰©ä¸€å€‹å›åˆ
       æ”»æ“Šå…©æ¬¡ã€ã€Œé€£çºŒè·³å…©å€‹å›åˆã€çš„æ ¹æºï¼‰ï¼š
       é€™è£¡å¦‚æœå·²ç¶“çœŸçš„åŸ·è¡Œéä¸€æ¬¡ï¼Œä»£è¡¨é€™æ¬¡
       å‘¼å«æ˜¯æ‰‹æ©Ÿç€è¦½å™¨è¨ˆæ™‚å™¨å»¶é²/è£œç™¼é€ æˆçš„
       é‡è¤‡å‘¼å«â€”â€”ç›´æ¥æ“‹ä¸‹ï¼Œä¸æœƒé‡æ–°å»ºç«‹
       initiativeQueueã€ä¸æœƒæŠŠinitiativeIndex
       è·ŸprocessedInitiativeIndexesç æ‰é‡ç·´ï¼Œ
       å·²ç¶“åœ¨é€²è¡Œä¸­çš„çµç®—éšæ®µä¸æœƒè¢«æ‰“æ–·ã€
       é‡æ–°å¾é ­é–‹å§‹ä¸€æ¬¡ã€‚
    */

    if(resolutionPhaseStarted){

        addBattleLog(
            "åµæ¸¬åˆ°é‡è¤‡çš„"+
            "startResolutionPhaseå‘¼å«ï¼Œ"+
            "å·²æ“‹ä¸‹ã€‚"
        );

        return;

    }


    resolutionPhaseStarted=
        true;


    battlePhase=
        "resolve";


    updateActionHudVisibility();


    /*
       â˜… æ–°å¢ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼‰ï¼š
       å®£å‘Šéšæ®µçµæŸã€çœŸæ­£é€²å…¥çµç®—éšæ®µï¼ˆé–‹å§‹
       ä¾æ•æ·é †åºå‡ºæ‰‹ï¼‰çš„é€™ä¸€åˆ»ï¼ŒæŠŠå…©å¼µç©å®¶
       å¡ç‰‡ä¸Šã€Œè¼ªåˆ°èª°å®£å‘Šã€çš„é»ƒè‰²é–ƒçˆå¤–æ¡†
       å…¨éƒ¨æ‹¿æ‰â€”â€”å®£å‘Šå·²ç¶“çµæŸäº†ï¼Œé€™å€‹æç¤º
       çš„ä»»å‹™ä¹ŸçµæŸäº†ï¼Œç¹¼çºŒé–ƒçˆåè€Œè®“äººæä¸æ¸…æ¥š
       ã€Œç¾åœ¨åˆ°åº•æ˜¯èª°åœ¨è¡Œå‹•ã€ï¼Œæ‹¿æ‰ä¹‹å¾Œç•«é¢
       æ›´ä¹¾æ·¨ï¼Œä¹Ÿä¸æœƒå†è·Ÿæ”»æ“Š/å—æ“Šå‹•ç•«çš„
       ç–Šæ”¾é †åºæ‰“æ¶ã€‚
    */

    clearActiveCharacterHighlight();
    clearBattleTargetSelectionMode();


    /*
       â˜… ä¿®æ­£ï¼ˆçœŸçš„æŠ“åˆ°ä¸€å€‹åš´é‡bugï¼Œæ„Ÿè¬ä½ æŠ“å‡ºä¾†ï¼‰ï¼š

       é˜²ç¦¦åŸæœ¬è·Ÿæ”»æ“Šä¸€æ¨£ï¼Œè¢«æ’é€²ä¾æ•æ·é«˜ä½
       åŸ·è¡Œçš„çµç®—ä½‡åˆ—è£¡â€”â€”é€™æ˜¯éŒ¯çš„ã€‚
       å¦‚æœé˜²ç¦¦è§’è‰²çš„æ•æ·æ¯”æ”»æ“Šä»–çš„æ€ªç‰©ä½ï¼Œ
       æ•æ·æ’åºæœƒè®“æ€ªç‰©ã€Œå…ˆã€å‡ºæ‰‹ã€
       é˜²ç¦¦è§’è‰²ã€Œå¾Œã€å‡ºæ‰‹ï¼Œ
       ç­‰æ–¼è§’è‰²çš„é˜²ç¦¦å§¿æ…‹æ ¹æœ¬é‚„æ²’ç”Ÿæ•ˆï¼Œ
       æ”»æ“Šå°±å·²ç¶“æ‰“å®Œäº†ï¼Œé˜²ç¦¦å½¢åŒè™›è¨­ï¼Œ
       é€™æ­£æ˜¯ã€Œæœ‰é˜²ç¦¦è·Ÿæ²’é˜²ç¦¦å‚·å®³ä¸€æ¨£ã€çš„çœŸæ­£åŸå› ã€‚

       é˜²ç¦¦çš„æœ¬è³ªæ˜¯ã€Œé€™æ•´å€‹å›åˆéƒ½è¦ç”Ÿæ•ˆçš„ä¿è­·ã€ï¼Œ
       ä¸æ‡‰è©²è·Ÿæ”»æ“Šä¸€æ¨£å—æ•æ·é †åºå½±éŸ¿â€”â€”
       ä¸ç®¡èª°å¿«èª°æ…¢ï¼Œåªè¦é€™å›åˆå®£å‘Šäº†é˜²ç¦¦ï¼Œ
       å°±æ‡‰è©²åœ¨æ€ªç‰©å‡ºæ‰‹ã€Œä¹‹å‰ã€å°±å·²ç¶“ç”Ÿæ•ˆã€‚

       ä¿®æ­£æ–¹å¼ï¼šåœ¨çµç®—éšæ®µçœŸæ­£é–‹å§‹ï¼ˆæ’æ€ªç‰©å‡ºæ‰‹ï¼‰
       ä¹‹å‰ï¼Œå…ˆè·‘ä¸€æ¬¡ã€Œé˜²ç¦¦é å…ˆå¥—ç”¨ã€ï¼Œ
       æŠŠæ‰€æœ‰é€™å›åˆå®£å‘Šé˜²ç¦¦çš„è§’è‰²ç›´æ¥å¥—ç”¨é˜²ç¦¦ç‹€æ…‹ï¼Œ
       ä¹‹å¾Œæ‰æ’æ•æ·é †åºã€è™•ç†æ€ªç‰©æ”»æ“Šâ€”â€”
       é€™æ¨£é˜²ç¦¦ä¸€å®šæœƒåœ¨ä»»ä½•æ€ªç‰©å‡ºæ‰‹ä¹‹å‰å°±å·²ç¶“ç”Ÿæ•ˆã€‚
    */

    getExistingPartyIndexes().forEach(
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
       â˜… æ–°å¢ï¼ˆè·Ÿå®£å‘Šéšæ®µç”¨åŒä¸€å¥—é˜²è­·ï¼Œ
       åŸå› ä¸€æ¨£ï¼šæ‰‹æ©Ÿç€è¦½å™¨èƒŒæ™¯åŸ·è¡Œæ™‚
       setTimeoutå¯èƒ½è¢«å»¶é²ã€è£œç™¼ï¼Œå°è‡´
       processNextCombatant()è¢«åŒä¸€å€‹
       initiativeIndexå‘¼å«å…©æ¬¡â€”â€”é€™æ¥µå¯èƒ½
       å°±æ˜¯ã€ŒåŒä¸€éš»æ€ªç‰©åŒä¸€å€‹ä½ç½®é€£çºŒæ”»æ“Š
       å…©æ¬¡ã€çš„çœŸæ­£åŸå› ï¼Œä¸æ˜¯æ€ªç‰©è³‡æ–™
       æˆ–æ©Ÿç‡çš„å•é¡Œã€‚
    */

    processedInitiativeIndexes=
        new Set();


    /*
       â˜… æ–°å¢ï¼ˆè£œä¸Šé˜²è­·ç¶²çš„ç¼ºå£ï¼‰ï¼š
       ä¹‹å‰çš„try-catché˜²è­·ç¶²åªåŒ…ä½å®£å‘Šéšæ®µ
       å‰å…©ä½è§’è‰²çš„è‡ªå‹•åˆ¤æ–·ï¼Œç¬¬ä¸‰æ¬¡å‘¼å«
       beginCharacterTurn()ï¼ˆç´¢å¼•è¶…ééšŠä¼é•·åº¦ã€
       æº–å‚™è·³ä¾†é€™è£¡ï¼‰æ˜¯é€éå¦ä¸€å€‹ç¨ç«‹çš„è¨ˆæ™‚å™¨
       åŸ·è¡Œçš„ï¼Œä¸åœ¨åŸæœ¬çš„ä¿è­·ç¯„åœå…§â€”â€”å¦‚æœ
       processNextCombatant()ä¸€é–‹å§‹åŸ·è¡Œå°±å‡ºéŒ¯ï¼Œ
       é€™å€‹éŒ¯èª¤æœƒè¢«å®Œå…¨åæ‰ã€ä¸æœƒé¡¯ç¤ºåœ¨ç•«é¢ä¸Šï¼Œ
       ç©å®¶åªæœƒçœ‹åˆ°ã€Œè·³å»çµç®—éšæ®µã€ä¹‹å¾Œ
       ä»€éº¼éƒ½æ²’æœ‰ç™¼ç”Ÿï¼Œé€™æ­£æ˜¯é€™æ¬¡é™¤éŒ¯è¨Šæ¯
       åœåœ¨é€™è£¡çš„çœŸæ­£åŸå› ã€‚

       é€™è£¡è£œä¸ŠåŒæ¨£çš„try-catchï¼Œç¢ºä¿çµç®—éšæ®µ
       ä¸ç®¡åœ¨å“ªå€‹ç’°ç¯€å‡ºéŒ¯ï¼Œéƒ½æœƒé¡¯ç¤ºå‡ºä¾†ã€
       ä¸¦ä¸”ç›¡é‡è®“éŠæˆ²ç¹¼çºŒå¾€ä¸‹èµ°ã€‚
    */

    try{

        processNextCombatant(
            token
        );

    }
    catch(error){

        console.error(
            "çµç®—éšæ®µç™¼ç”Ÿä¾‹å¤–ï¼š",
            error
        );

        addBattleLog(
            "çµç®—éšæ®µç™¼ç”Ÿä¾‹å¤–ï¼ˆ"+
            (error&&error.message)+
            "ï¼‰ï¼Œå˜—è©¦å¼·åˆ¶ç¹¼çºŒã€‚"
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

    if(battlePresentationLocks.size>0&&battlePhase==="resolve"){
        battleResolutionResumeToken=token;
        updateActionHudVisibility();
        return;
    }
    battleResolutionResumeToken=null;

    notifyBeforeCombatant(token);

    if(checkBattleEnd()){
        return;
    }


    if(
        initiativeIndex>=
        initiativeQueue.length
    ){

        /*
           â˜… ä¿®æ­£ï¼ˆè£œä¸Šæœ€å¾Œä¸€å€‹æ¼æ´ï¼Œè¦‹ä¸Šé¢
           turnAdvancePendingå®£å‘Šè™•çš„èªªæ˜ï¼‰ï¼š
           é€™å€‹è½‰æ›å¦‚æœå·²ç¶“è§¸ç™¼éï¼Œä»£è¡¨é€™æ¬¡
           å‘¼å«æ˜¯è¨ˆæ™‚å™¨å»¶é²è£œç™¼çš„é‡è¤‡å‘¼å«ï¼Œ
           ç›´æ¥æ“‹ä¸‹ï¼Œä¸æœƒturn++å…©æ¬¡ã€
           startTurn()ä¸æœƒè¢«å‘¼å«å…©æ¬¡ã€‚
        */

        if(turnAdvancePending){

            addBattleLog(
                "åµæ¸¬åˆ°é‡è¤‡çš„"+
                "ã€Œè·³åˆ°ä¸‹ä¸€è¼ªã€å‘¼å«ï¼Œ"+
                "å·²æ“‹ä¸‹ã€‚"
            );

            return;

        }


        turnAdvancePending=
            true;


        notifyBattleRoundBoundary("round_end",token);

        if(checkBattleEnd()){
            return;
        }


        turn++;

        startTurn(token);

        return;

    }


    /*
       â˜… ä¿®æ­£ï¼ˆçœŸæ­£çš„æ ¹æºä¿®æ³•ï¼Œè·Ÿå®£å‘Šéšæ®µ
       åŒä¸€å¥—é‚è¼¯ï¼‰ï¼š
       æ‰‹æ©Ÿç€è¦½å™¨èƒŒæ™¯åŸ·è¡Œæ™‚setTimeoutå¯èƒ½è¢«
       å»¶é²ã€ä¹‹å¾Œè£œç™¼ï¼Œå°è‡´é€™å€‹å‡½å¼è¢«åŒä¸€å€‹
       initiativeIndexå‘¼å«ç¬¬äºŒæ¬¡â€”â€”é€™æ­£æ˜¯
       ã€ŒåŒä¸€éš»æ€ªç‰©åŒä¸€å€‹ä½ç½®é€£çºŒæ”»æ“Šå…©æ¬¡ã€
       çš„çœŸæ­£åŸå› ã€‚é€™è£¡æ“‹æ‰é‡è¤‡ï¼šé€™å€‹
       initiativeIndexå¦‚æœå·²ç¶“è™•ç†éï¼Œä»£è¡¨
       é€™æ¬¡å‘¼å«æ˜¯å»¶é²è£œç™¼çš„é‡è¤‡å‘¼å«ï¼Œç›´æ¥
       returnï¼Œä¸æœƒè®“åŒä¸€ä½æ€ªç‰©/ç©å®¶çš„è¡Œå‹•
       è¢«åŸ·è¡Œç¬¬äºŒæ¬¡ã€‚
    */

    if(
        processedInitiativeIndexes.has(
            initiativeIndex
        )
    ){

        addBattleLog(
            "åµæ¸¬åˆ°é‡è¤‡çš„"+
            "processNextCombatantå‘¼å«"+
            "ï¼ˆinitiativeIndex="+
            initiativeIndex+
            "å·²ç¶“è™•ç†éï¼‰ï¼Œå·²æ“‹ä¸‹ã€‚"
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
           é€™å€‹è§’è‰²æœ‰å¯èƒ½åœ¨é€™å€‹å¤§å›åˆ
           æ›´æ—©ä¹‹å‰å°±å·²ç¶“é™£äº¡
           ï¼ˆè¢«æ€ªç‰©æ‰“æ­»ï¼Œæˆ–ç¬¬äºŒè§’è‰²å€’ä¸‹ï¼‰ï¼Œ
           ç›´æ¥è·³éï¼Œä¸ä½”ç”¨è¡Œå‹•ã€‚
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
                (character.id||"ä½ ")+
                "è¢«å†°å°ï¼Œç„¡æ³•è¡Œå‹•ã€‚"
            );

            finishPlayerAction();

            return;
        }

        if(isMonsterPetrified(character)){

            addBattleLog(
                (character.id||"ä½ ")+
                "è¢«çŸ³åŒ–ï¼Œç„¡æ³•è¡Œå‹•ã€‚"
            );

            finishPlayerAction();

            return;
        }


        activeBattleCharacterIndex=

            entry.characterIndex;


        /*
           â˜… ä¿®æ­£ï¼ˆé‡æ–°è¨­è¨ˆå›åˆåˆ¶ï¼‰ï¼š
           çµç®—éšæ®µä¸å†é‡æ–°å‘¼å«
           beginCharacterTurn()ç­‰æ–°çš„è¼¸å…¥ï¼Œ
           è€Œæ˜¯æŠŠé€™å€‹è§’è‰²åœ¨å®£å‘Šéšæ®µ
           å·²ç¶“é¸å¥½çš„è¡Œå‹•ï¼ˆqueuedPlayerActionsï¼‰
           çœŸæ­£æ‹¿å‡ºä¾†åŸ·è¡Œã€‚
        */

        battleStatisticsBeginAction({
            type:"player",
            characterIndex:entry.characterIndex
        });

        try{
            resolveQueuedPlayerAction(
                entry.characterIndex,
                token
            );
        }catch(error){
            console.error("çµç®—ç©å®¶è¡Œå‹•æ™‚ç™¼ç”Ÿæœªæ””æˆªä¾‹å¤–ï¼š",error);
            addBattleLog("çµç®—ç©å®¶è¡Œå‹•æ™‚ç™¼ç”Ÿä¾‹å¤–ï¼Œå·²ç”±å®‰å…¨é–˜é–€ç¹¼çºŒã€‚");
            finishPlayerAction();
        }

    }
    else{

        const actingMonster=monsters[entry.monsterIndex];
        if(!actingMonster||!actingMonster.alive||actingMonster.canAct===false){
            initiativeIndex++;
            processNextCombatant(token);
            return;
        }

        battleStatisticsBeginAction({
            type:"monster",
            monsterIndex:entry.monsterIndex
        });

        try{
            processSingleMonsterAttack(
                entry.monsterIndex,
                token
            );
        }catch(error){
            console.error("çµç®—æ•µæ–¹è¡Œå‹•æ™‚ç™¼ç”Ÿæœªæ””æˆªä¾‹å¤–ï¼š",error);
            addBattleLog("çµç®—æ•µæ–¹è¡Œå‹•æ™‚ç™¼ç”Ÿä¾‹å¤–ï¼Œå·²ç”±å®‰å…¨é–˜é–€ç¹¼çºŒã€‚");
            finishPlayerAction();
        }

    }

}


/*
   â˜… æ–°å¢ï¼šæŠŠå®£å‘Šéšæ®µé¸å¥½ã€å­˜èµ·ä¾†çš„è¡Œå‹•
   çœŸæ­£æ‹¿å‡ºä¾†åŸ·è¡Œã€‚

   è‡ªå‹•æˆ°é¬¥çš„è§’è‰²ä¸æœƒèµ°åˆ°é€™è£¡â€”â€”ä»–å€‘åœ¨
   å®£å‘Šéšæ®µè¼ªåˆ°è‡ªå·±æ™‚å°±å·²ç¶“ç›´æ¥åŸ·è¡Œå®Œäº†
   ï¼ˆautoAction()/player2AutoAction()ï¼‰ï¼Œ
   é€™è£¡è™•ç†çš„éƒ½æ˜¯æ‰‹å‹•è§’è‰²å®£å‘Šéšæ®µ
   å­˜ä¸‹ä¾†çš„æ™®é€šæ”»æ“Š/å‚·å®³æŠ€èƒ½ã€‚
*/

function resolveQueuedPlayerAction(characterIndex,token){

    const queued=

        queuedPlayerActions[
            characterIndex
        ];


    if(!queued){

        /*
           é˜²å‘†ï¼šç†è«–ä¸Šå®£å‘Šéšæ®µæ¯å€‹æ´»è‘—çš„
           æ‰‹å‹•è§’è‰²éƒ½æ‡‰è©²æœ‰å­˜åˆ°ä¸€ç­†è¡Œå‹•ï¼Œ
           è¬ä¸€çœŸçš„æ²’æœ‰ï¼ˆä¾‹å¦‚é€¾æ™‚æ²’é¸ï¼‰ï¼Œ
           ç›´æ¥è·³éï¼Œä¸å¡ä½çµç®—æµç¨‹ã€‚
        */

        finishPlayerAction();

        return;

    }


    const isAdditionalCharacter=
        characterIndex>0;


    /*
       â˜… ä¿®æ­£ï¼ˆé‡è¦ï¼Œä¾ç…§ä½¿ç”¨è€…æ˜ç¢ºæŒ‡æ­£ï¼‰ï¼š
       é˜²ç¦¦ã€è—¥æ°´ã€å¢ç›Š/æ²»ç™‚/å¾©æ´»é€™å¹¾ç¨®
       ä¹‹å‰éƒ½æ˜¯ã€Œé¸äº†å°±ç«‹åˆ»ç”Ÿæ•ˆã€ï¼Œ
       ç¾åœ¨å…¨éƒ¨æ”¹æˆè·Ÿæ”»æ“Šä¸€æ¨£å…ˆå®£å‘Šå†çµç®—ï¼Œ
       é€™è£¡è¦è£œä¸Šå°æ‡‰çš„åŸ·è¡Œåˆ†æ”¯ã€‚

       é€™å¹¾ç¨®éƒ½ä¸éœ€è¦ç›®æ¨™ï¼ˆtargetæ˜¯nullï¼‰ï¼Œ
       è·Ÿéœ€è¦é¸æ€ªç‰©ç•¶ç›®æ¨™çš„æ™®é€šæ”»æ“Š/å‚·å®³æŠ€èƒ½
       åˆ†é–‹è™•ç†ã€‚
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
           ç›®å‰å¢ç›Š/æ²»ç™‚/å¾©æ´»åªæ”¯æ´ç¬¬ä¸€è§’è‰²ï¼Œ
           è·ŸprepareAction()è£¡çš„é™åˆ¶ä¸€è‡´ã€‚
        */

        activeBattleCharacterIndex=
            characterIndex;


        /*
           â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œæ¥ä¸Šæ–°å¢çš„
           é¢¨ç³»/åœŸç³»å¢ç›ŠæŠ€èƒ½ï¼‰ï¼š
           åŸæœ¬é€™è£¡ä¸ç®¡æ’çš„æ˜¯å“ªå€‹å¢ç›ŠæŠ€èƒ½ï¼Œ
           ä¸€å¾‹ç¡¬å‘¼å«castRageBuff()â€”â€”é€™ä»£è¡¨
           å¦‚æœç©å®¶æ’çš„æ˜¯æ–°å¢çš„é–ƒèº²è¡“/å²©çŸ³
           å£å£˜/è¬è±¡åœŸç›¾/çµç•Œ/éš±èº«è¡“/ç³§è‰
           å…ˆè¡Œï¼Œå¯¦éš›ä¸ŠæœƒéŒ¯èª¤åœ°åŸ·è¡Œã€Œæ€’ç«ã€
           çš„é‚è¼¯ï¼Œä¸æ˜¯ç©å®¶çœŸæ­£é¸çš„æŠ€èƒ½ã€‚

           æ”¹æˆæŠŠqueued.actionï¼ˆçœŸæ­£çš„æŠ€èƒ½IDï¼‰
           å‚³é€²å»ï¼ŒcastBuffSkill()å…§éƒ¨æœƒä¾
           æŠ€èƒ½IDåˆ†æµåˆ°æ­£ç¢ºçš„æ•ˆæœã€‚
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
               â˜… æ–°å¢ï¼ˆé˜²è­·ç¶²è£œåˆ°æœ€å¾Œä¸€å€‹ç¼ºå£ï¼‰ï¼š
               processNextCombatant()ã€
               beginCharacterTurn()çš„è‡ªå‹•åˆ¤æ–·
               éƒ½å·²ç¶“æœ‰try-catchï¼Œå”¯ç¨ã€Œçµç®—éšæ®µ
               çœŸæ­£åŸ·è¡Œç©å®¶/ç¬¬äºŒè§’è‰²è¡Œå‹•ã€é€™ä¸€æ®µ
               å®Œå…¨æ²’æœ‰â€”â€”ä»»ä½•ä¸€å€‹æŠ€èƒ½æ–½æ”¾å‡½å¼
               è£¡é¢ï¼Œåªè¦æœ‰ä»»ä½•ä¸€è¡Œæ„å¤–æ‹‹å‡ºä¾‹å¤–
               ï¼ˆä¾‹å¦‚è³‡æ–™æ²’å°é½Šã€undefinedå­˜å–ï¼‰ï¼Œ
               æ•´æ¢çµç®—éˆå°±æœƒåœ¨é€™ä¸€åˆ»ç„¡è²æ–·æ‰ï¼Œ
               ç©å®¶åªæœƒçœ‹åˆ°ç•«é¢åœä½ï¼Œä»€éº¼æç¤º
               éƒ½æ²’æœ‰ï¼Œç—‡ç‹€è·Ÿã€Œå¡ä½ä¸å‹•ã€ä¸€æ¨¡ä¸€æ¨£ã€‚

               è£œä¸Šè·Ÿå…¶ä»–åœ°æ–¹ä¸€è‡´çš„é˜²è­·ï¼šå°å‡º
               çœŸæ­£çš„éŒ¯èª¤å…§å®¹åˆ°æˆ°é¬¥ç´€éŒ„ï¼ˆä¸ç”¨å†
               é çŒœçš„ï¼‰ï¼Œä¸¦å¼·åˆ¶å‘¼å«
               finishPlayerAction()è®“æˆ°é¬¥
               ç¹¼çºŒå¾€ä¸‹èµ°ï¼Œä¸æœƒå¡æ­»åœ¨é€™ä¸€æ­¥ã€‚
            */

            console.error(
                "çµç®—ç¬¬äºŒè§’è‰²è¡Œå‹•æ™‚ç™¼ç”Ÿä¾‹å¤–ï¼š",
                error
            );

            addBattleLog(
                "çµç®—è¡Œå‹•æ™‚ç™¼ç”Ÿä¾‹å¤–ï¼ˆ"+
                (error&&error.message)+
                "ï¼‰ï¼Œå·²å¼·åˆ¶ç¹¼çºŒã€‚"
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
                "çµç®—ç¬¬ä¸€è§’è‰²è¡Œå‹•æ™‚ç™¼ç”Ÿä¾‹å¤–ï¼š",
                error
            );

            addBattleLog(
                "çµç®—è¡Œå‹•æ™‚ç™¼ç”Ÿä¾‹å¤–ï¼ˆ"+
                (error&&error.message)+
                "ï¼‰ï¼Œå·²å¼·åˆ¶ç¹¼çºŒã€‚"
            );

            finishPlayerAction();

        }

    }

}


/*
   å‘½ä¸­åˆ¤å®šçš„æ‰€æœ‰åŠ æ¸›æ•ˆæœéƒ½åœ¨æœ€å¾Œä»¥ç™¾åˆ†é»çµç®—ã€‚
   directChanceReductionPercent æ˜¯æœ€çµ‚å‘½ä¸­ä¸‹é™ï¼Œ
   directChanceBonusPercent æ˜¯æœ€çµ‚å‘½ä¸­æå‡ã€‚
   ç›®æ¨™é–ƒèº²åŒæ¨£ç›´æ¥æ‰£é™¤ç™¾åˆ†é»ï¼Œæœ€å¾Œæ‰çµ±ä¸€ clamp 70%ï½99%ã€‚
*/

function calculateHitChancePercent(
    casterAccuracy,
    targetEvasion,
    directChanceReductionPercent,
    directChanceBonusPercent,
    targetCharacter
){
    const chance=
        HIT_CHANCE_BASE+
        Math.max(0,Number(casterAccuracy)||0)*HIT_CHANCE_ACCURACY_COEFFICIENT+
        (Number(directChanceBonusPercent)||0)-
        Math.max(0,Number(targetEvasion)||0)-
        Math.max(0,Number(directChanceReductionPercent)||0);

    const normalFinalChance=Math.max(
        HIT_CHANCE_MIN_PERCENT,
        Math.min(HIT_CHANCE_MAX_PERCENT,chance)
    );
    const windEx=targetCharacter&&targetCharacter.element==="wind"
        ?getLearnedElementEX(targetCharacter,"wind"):null;
    const lowHp=targetCharacter&&Number(targetCharacter.hp)<Number(getPartyBattleStats(getPartyCharacterIndex(targetCharacter))?.maxHP)*0.25;
    return windEx&&lowHp
        ?Math.min(normalFinalChance,Number(windEx.lowHpFinalHitCapPercent)||50)
        :normalFinalChance;
}

function rollHitChance(
    casterAccuracy,
    targetEvasion,
    directChanceReductionPercent,
    directChanceBonusPercent,
    targetCharacter
){
    return Math.random()*100<calculateHitChancePercent(
        casterAccuracy,
        targetEvasion,
        directChanceReductionPercent,
        directChanceBonusPercent,
        targetCharacter
    );
}

window.v173GetHitChancePercent=calculateHitChancePercent;


/* =====================================================
   V173.38 æŠ€èƒ½å‚·å®³ï¼šæœ‰æ•ˆæ”»æ“Š Ã— damageRole ï¼‹æ­£å¼ flatDamageï¼Œ
   å†ä¸”åªäº¤çµ¦ calculateDamage() ä¸€æ¬¡ã€‚èˆŠå¼äº”åƒæ•¸å‘¼å«åŠ
   å°šæœªé·ç§»æŠ€èƒ½ä¿ç•™å›ºå®šå‚·å®³å›é€€ï¼Œä¾›æ­·å²æµç¨‹ç›¸å®¹ã€‚
===================================================== */

function getSkillRawAttack(skill,skillLevel,effectiveAttack){
    const attack=Math.max(0,Number(effectiveAttack)||0);
    const skillDamage=getSkillDamageAtLevel(skill,skillLevel);
    if(hasDamageRoleProfile(skill)){
        return attack*getSkillPowerAtLevel(skill,skillLevel)+skillDamage;
    }
    return attack+skillDamage;
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
   â˜… ç•°å¸¸ç‹€æ…‹å‘½ä¸­æ©Ÿç‡å…¬å¼ï¼ˆæ–°å¢ï¼‰

   è¦æ ¼ï¼ˆä½¿ç”¨è€…åŸè©±ï¼‰ï¼š
   ã€Œç²¾ç¥è¶Šé«˜ï¼ŒæŠ—æ€§å°±è¶Šé«˜ï¼Œå°±ä¸å®¹æ˜“è¢«ç•°å¸¸ç‹€æ…‹å‘½ä¸­ã€‚
     æ™ºåŠ›è¶Šé«˜ï¼Œç•°å¸¸ç‹€æ…‹å‘½ä¸­æ©Ÿç‡å°±è¶Šé«˜ï¼Œ
     å†åŠ ä¸Šç­‰ç´šå£“åˆ¶ä¹Ÿæœƒå½±éŸ¿æ•´é«”æ©Ÿç‡ã€

   ä¸€èˆ¬ç•°å¸¸æœ€çµ‚æ©Ÿç‡ = åŸºç¤æ©Ÿç‡Ã—ç­‰ç´šå·®å€ç‡
     + ç‰©ç†æ”»æ“ŠåŠ›æˆ–æ™ºåŠ›Ã—0.05
     - ç›®æ¨™ç²¾ç¥Ã—0.05
     - é¡å¤–ç•°å¸¸æŠ—æ€§ï¼Œæœ€å¾Œé™åˆ¶åœ¨5%ï½95%ã€‚

   å†°å°ã€çŸ³åŒ–ç­‰ç¡¬æ§ç¶­æŒç¨ç«‹å…¬å¼ï¼šå±¬æ€§åŠ æˆç‚º
   sqrt(ç‰©æ”»æˆ–æ™ºåŠ›)Ã—0.2ï¼Œç²¾ç¥èˆ‡ç¨€æœ‰åº¦ä¸Šé™æ²¿ç”¨æ—¢æœ‰è¦å‰‡ã€‚

   â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œã€Œé–æ­»è¡Œå‹•çš„
   æŠ€èƒ½ç¨ç«‹è¨­ä¸€çµ„ç¯„åœï¼Œ5%~60%ã€ï¼‰ï¼š
   åŸæœ¬å…¨éƒ¨ç•°å¸¸ç‹€æ…‹ï¼ˆç‡ƒç‡’/æ•æ·é™ä½/é˜²ç¦¦
   é™ä½/æšˆçœ©/å†°å°/çŸ³åŒ–â€¦â€¦ï¼‰å…±ç”¨åŒä¸€çµ„
   5%~95%ä¸Šä¸‹é™ï¼Œä½†å†°å°/çŸ³åŒ–é€™å…©ç¨®æ˜¯
   ã€Œæ•´å›åˆå®Œå…¨ç„¡æ³•è¡Œå‹•ã€ï¼Œè·Ÿå…¶ä»–åªæ˜¯
   å‰Šå¼±æ•¸å€¼çš„debuffï¼Œæ•ˆæœä»½é‡å·®å¤ªå¤šï¼Œ
   ä¸è©²å…±ç”¨åŒä¸€çµ„æ©Ÿç‡ä¸Šé™â€”â€”ä¸ç„¶æ™ºåŠ›
   å †ä¸€å †ï¼Œå†°å°æ©Ÿç‡ä¹Ÿèƒ½è¡åˆ°9æˆï¼Œç­‰æ–¼
   è®“å°æ‰‹æ•´å ´éƒ½å‹•ä¸äº†ï¼Œå¤ªå¼·ã€‚

   isLockdown åƒæ•¸ä¾›å†°å°ï¼çŸ³åŒ–å‘¼å«æ™‚å‚³ trueï¼›
   å…¶ä»–ä¸€èˆ¬debuffï¼ˆæ•æ·/
   é˜²ç¦¦/å…¨å±¬æ€§é™ä½ã€æšˆçœ©ï¼‰ç¶­æŒåŸæœ¬çš„
   5%~95%ï¼Œä¸å—å½±éŸ¿ã€‚
===================================================== */

const STATUS_OFFENSE_ATTRIBUTE_COEFFICIENT = 0.05;

/*
   ä¸€èˆ¬ç•°å¸¸æ¯1é»ç²¾ç¥é™ä½0.05å€‹ç™¾åˆ†é»å‘½ä¸­ç‡ï¼›
   ç¡¬æ§ä»åœ¨ç¨ç«‹å…¬å¼ä½¿ç”¨åŸæœ¬çš„0.3ä¿‚æ•¸ã€‚
*/
function calculateStatusResistancePercent(spiritPoints){
    return Math.max(0,Number(spiritPoints)||0)*STATUS_RESIST_PER_SPIRIT_POINT;
}

const STATUS_HIT_MIN_PERCENT = 5;

const STATUS_HIT_MAX_PERCENT = 95;

/*
   â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œã€Œé™åˆ¶è¡Œå‹•çš„
   ç•°å¸¸ç‹€æ…‹å¸¸æ•¸ä¿®æ”¹ã€ï¼Œæ”¹æˆä¾æ€ªç‰©ç­‰ç´š
   åˆ†ä¸‰å€‹ç­‰ç´šå„è‡ªçš„ä¸Šä¸‹é™ï¼‰ï¼š
   é–æ­»è¡Œå‹•é¡æŠ€èƒ½ï¼ˆå†°å°/çŸ³åŒ–ï¼‰ä¾ç›®æ¨™æ€ªç‰©
   ç¨€æœ‰åº¦ä½¿ç”¨æ™®é€š80%ã€ç²¾è‹±60%ã€BOSS40%çš„ä¸Šé™ã€‚
   æ€éº¼åˆ¤æ–·ä¸€éš»æ€ªç‰©æ˜¯ã€Œé‡æ€ªã€é‚„æ˜¯ã€Œç²¾è‹±æ€ªã€ï¼š
   çœ‹getMonsterRank()â€”â€”ç›®å‰è¦å‰‡å¾ˆå–®ç´”ï¼Œ
   åå­—çµå°¾æ˜¯ã€Œç‹ã€å°±ç®—ç²¾è‹±æ€ªï¼Œå…¶é¤˜éƒ½ç®—
   é‡æ€ªï¼›å¦‚æœä¹‹å¾Œæ€ªç‰©è³‡æ–™æƒ³æ›´ç²¾æº–æŒ‡å®š
   ï¼ˆä¸åªé åå­—åˆ¤æ–·ï¼‰ï¼Œå¯ä»¥é¡å¤–åŠ ä¸€å€‹
   monster.rankæ¬„ä½ï¼ŒgetMonsterRank()
   æœƒå„ªå…ˆçœ‹é€™å€‹æ¬„ä½ï¼Œæ²’æœ‰æ‰é€€å›çœ‹åå­—ã€‚
*/

const LOCKDOWN_HIT_BOUNDS = {

    regular:{
        min:5,
        max:90
    },

    elite:{
        min:5,
        max:75
    },

    boss:{
        min:5,
        max:60
    },

    /* Enemy-to-player hard control never inherits monster rank. */
    player:{
        min:5,
        max:60
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

/* The one formal category chooser for enemy skills.  Callers provide only
   legal entries, so an empty category always falls back without re-rolling. */
function chooseEnemySkillCategory(attackSkillIds,buffSkillIds,randomValue){
    const attacks=Array.isArray(attackSkillIds)?attackSkillIds.filter(Boolean):[];
    const buffs=Array.isArray(buffSkillIds)?buffSkillIds.filter(Boolean):[];
    if(!attacks.length&&!buffs.length){ return "normal"; }
    if(!attacks.length){ return "buff"; }
    if(!buffs.length){ return "attack"; }
    return Number(randomValue)<.70?"attack":"buff";
}
window.FourSymbolsEnemySkillAI=Object.freeze({
    chooseCategory:chooseEnemySkillCategory,
    healingThresholdPercent:70,
    attackWeightPercent:70,
    buffWeightPercent:30
});


/*
   â˜… æ–°å¢ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œã€Œç‰©ç†æŠ€èƒ½ï¼Œ
   å°ç²¾è‹±æ€ªå‚·å®³åŠ ä¹˜10%ï¼Œboss15%ã€ï¼Œ
   è·Ÿæ³•è¡“æŠ€èƒ½é targetTypeæ¯”è¼ƒå¯¬å»£ï¼ˆtri/
   row/allï¼‰åˆ†å·¥â€”â€”ç‰©ç†æŠ€èƒ½å°ˆç²¾å–®é«”
   ç¡¬ä»—ï¼Œé€™è£¡è£œä¸Šé€™å¡Šï¼‰ï¼š

   åªæœ‰ã€ŒæŠ€èƒ½ã€åƒå¾—åˆ°é€™å€‹åŠ æˆï¼Œæ™®é€šæ”»æ“Š
   ï¼ˆæ²’æœ‰skillç‰©ä»¶ã€æˆ–categoryä¸æ˜¯
   "physical"ï¼‰ä¸ç®—ï¼Œé€™æ˜¯ä½¿ç”¨è€…æ˜ç¢ºè¦æ±‚
   ä¿ç•™çš„å€åˆ†â€”â€”æ™®é€šæ”»æ“Šä¸æ˜¯æˆ°å£«çš„ç‰¹è‰²ï¼Œ
   ç‰©ç†æŠ€èƒ½æ‰æ˜¯ã€‚

   é‡æ€ªï¼ˆregularï¼‰æ²’æœ‰åŠ æˆï¼Œç²¾è‹±æ€ª
   ï¼ˆåå­—å¸¶ã€Œç‹ã€ï¼Œæˆ–æœªä¾†æ˜ç¢ºæ¨™è¨˜
   monster.rankï¼‰+10%ï¼ŒBOSS+15%ï¼Œè·Ÿ
   getMonsterRank()åˆ¤æ–·ç¨€æœ‰åº¦æ˜¯åŒä¸€å¥—
   è¦å‰‡ï¼Œä¸ç”¨é‡å¯«ä¸€æ¬¡åˆ¤æ–·é‚è¼¯ã€‚
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
   â˜… æ–°å¢ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œã€Œæ™ºåŠ›éæ¸›ã€
   ä¸èƒ½æ²’æœ‰ç”¨ï¼Œè€ƒæ…®åˆ°ä¹‹å¾ŒBOSSç²¾ç¥æœƒæ›´é«˜ã€ï¼‰ï¼š
   é–æ­»è¡Œå‹•é¡æŠ€èƒ½çš„æ™ºåŠ›åŠ æˆï¼Œæ”¹ç”¨é–‹æ ¹è™Ÿ
   ï¼ˆMath.sqrt(æ™ºåŠ›)Ã—ä¿‚æ•¸ï¼‰å–ä»£åŸæœ¬ä¸€èˆ¬
   debuffç”¨çš„ç·šæ€§å…¬å¼ï¼ˆæ™ºåŠ›Ã—ä¿‚æ•¸ï¼‰ã€‚

   é–‹æ ¹è™Ÿçš„æ•ˆæœæ˜¯ã€Œé‚Šéš›æ•ˆç›Šéæ¸›ã€â€”â€”æ™ºåŠ›
   è¶Šå †è¶Šé«˜ï¼Œæ¯ä¸€é»æ™ºåŠ›æ›ä¾†çš„æ©Ÿç‡å¢å¹…æœƒ
   è‡ªå‹•è®Šå°ï¼Œä¸æœƒåƒç·šæ€§å…¬å¼é‚£æ¨£ï¼Œç©å®¶
   æ™ºåŠ›é¤Šåˆ°ä¸­æœŸï¼ˆå¤§ç´„300~500ï¼‰å°±ç›´æ¥
   å¡æ­»åœ¨60%ä¸Šé™ã€ä¹‹å¾Œæ™ºåŠ›å†æ€éº¼åŠ éƒ½
   æ„Ÿå—ä¸åˆ°å·®ç•°ã€‚

   ä¿‚æ•¸ç¶­æŒ0.2ï¼›BOSSç²¾ç¥ä»æŒ‰ç¡¬æ§åŸæœ¬çš„0.3
   ä¿‚æ•¸æ‰£é™¤ï¼Œä¸å—ä¸€èˆ¬ç•°å¸¸0.05èª¿æ•´å½±éŸ¿ã€‚
*/

const LOCKDOWN_INT_COEFFICIENT = 0.2;


/*
   â˜… æ–°å¢ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œã€Œå®šæµ·ç¥é‡ï¼š
   ä½¿æˆ‘æ–¹å…¨é«”ç•°å¸¸ç‹€æ…‹æŠ—æ€§æå‡25%ã€ï¼›å¾ŒçºŒ
   ä¿®æ­£ç‚ºé€šç”¨ç‰ˆæœ¬ï¼Œå‘¼æ‡‰ã€Œæ‡‰è©²è¨­å®šåªè¦æˆ‘æ–¹
   éƒ½èƒ½åƒåˆ°æ•ˆæœï¼Œå¯«ä¸€æ¬¡å°±ä¸€å‹æ°¸é€¸ã€é€™å€‹
   è¦æ±‚ï¼‰ï¼š

   é€™å€‹å‡½å¼æ˜¯çµ¦ã€Œå°‡ä¾†æ€ªç‰©å°ç©å®¶æ–½æ”¾ç•°å¸¸
   ç‹€æ…‹ã€çš„é‚è¼¯å‘¼å«ç”¨çš„â€”â€”ç›®å‰éŠæˆ²è£¡æ€ªç‰©
   å®Œå…¨ä¸æœƒå°ç©å®¶æ–½æ”¾ç‡ƒç‡’/å†°å°/æšˆçœ©/é™é˜²ç¦¦
   é€™é¡ç•°å¸¸ç‹€æ…‹ï¼ˆprocessSingleMonsterAttack()
   æ•´æ®µæŸ¥éï¼Œåªæœ‰é€ æˆå‚·å®³ï¼Œæ²’æœ‰ä»»ä½•debuff
   åˆ¤å®šï¼‰ï¼Œæ‰€ä»¥é€™å€‹å‡½å¼ç›®å‰ä¸æœƒè¢«ä»»ä½•åœ°æ–¹
   å‘¼å«ã€25%æŠ—æ€§ç›®å‰å°å¯¦æˆ°æ²’æœ‰å½±éŸ¿ï¼Œå…ˆæŠŠ
   ã€ŒæŸ¥è©¢ç”¨çš„å‡½å¼ã€è·Ÿã€Œbuffå„²å­˜ã€éƒ½åšå°ï¼Œ
   ç­‰ä¹‹å¾ŒçœŸçš„è¦åšã€Œæ€ªç‰©å°ç©å®¶ä¸‹ç•°å¸¸ç‹€æ…‹ã€
   æ™‚ï¼Œç›´æ¥æŠŠé€™å€‹å‡½å¼å›å‚³å€¼ç•¶æˆé¡å¤–ç•°å¸¸æŠ—æ€§
   å‚³é€²æ­£å¼å…¬å¼å³å¯ã€‚

   æ”¹æˆåƒcharacteråƒæ•¸ï¼ˆè·ŸgetActiveBuffPercent()/
   hasActiveBuff()åŒä¸€ç¨®é€šç”¨è¨­è¨ˆï¼‰ï¼Œä¸å¯«æ­»
   playerï¼Œé€™æ¨£è§’è‰²äºŒè™Ÿã€ä»¥å¾Œè§’è‰²ä¸‰è™Ÿå››è™Ÿï¼Œ
   å‘¼å«é€™å€‹å‡½å¼æ™‚å‚³è‡ªå·±çš„è§’è‰²ç‰©ä»¶é€²ä¾†å°±å¥½ï¼Œ
   ä¸ç”¨å¦å¤–å¯«ä¸€ä»½player2å°ˆç”¨ç‰ˆæœ¬ã€‚

   é¡å¤–ç•°å¸¸æŠ—æ€§æ¡ç™¾åˆ†é»ç›´æ¥æ‰£é™¤ï¼Œä¸åšç¬¬äºŒæ¬¡ä¹˜ç®—ã€‚
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
       æœ€çµ‚ç•°å¸¸ï¼ç¡¬æ§æˆåŠŸç‡ =
       æŠ€èƒ½åŸºç¤æˆåŠŸç‡
       + æ–½æ”¾è€…ä¸»å±¬æ€§Ã—0.05%
       + æœ€çµ‚ç•°å¸¸å‘½ä¸­åŠ æˆ
       - ç›®æ¨™ç²¾ç¥Ã—0.05%
       - å…¶ä»–æœ€çµ‚ç•°å¸¸æŠ—æ€§ã€‚

       casterLevel / targetLevel ä¿ç•™åœ¨åƒæ•¸åˆ—åªç‚ºç›¸å®¹æ—¢æœ‰ callerï¼Œ
       æ­£å¼å…¬å¼ä¸å†ä½¿ç”¨ç­‰ç´šå·®å€ç‡ã€sqrt å±¬æ€§å…¬å¼æˆ–ç¡¬æ§å°ˆå±¬ç²¾ç¥ä¿‚æ•¸ã€‚
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
   å¯¦éš›åˆ¤å®šæ˜¯å¦å‘½ä¸­ç•°å¸¸ç‹€æ…‹æ™‚å‘¼å«é€™å€‹ï¼Œ
   å›å‚³ true/falseã€‚
   Math.random()*100 æ˜¯ 0~100 ä¹‹é–“çš„äº‚æ•¸ï¼Œ
   å°æ–¼ç®—å‡ºä¾†çš„æ©Ÿç‡å°±ç®—å‘½ä¸­ã€‚

   â˜… ä¿®æ­£ï¼šæ–°å¢isLockdownåƒæ•¸ï¼Œå†°å°/çŸ³åŒ–
   å‘¼å«æ™‚è¦è¨˜å¾—å‚³trueï¼Œæ‰æœƒå¥—ç”¨æ¯”è¼ƒåš´æ ¼
   çš„ä¸Šé™ã€‚

   â˜… å†æ¬¡ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œã€Œé™åˆ¶
   è¡Œå‹•çš„ç•°å¸¸ç‹€æ…‹å¸¸æ•¸ä¿®æ”¹ã€ï¼‰ï¼šæ–°å¢
   targetRankåƒæ•¸ï¼ˆ"regular"/"elite"/
   "boss"ï¼‰ï¼Œå†°å°/çŸ³åŒ–é€™é¡é–æ­»æŠ€èƒ½æ‰“
   åœ¨æ€ªç‰©èº«ä¸Šæ™‚ï¼Œè¨˜å¾—å‚³getMonsterRank
   (monster)ç®—å‡ºä¾†çš„ç¨€æœ‰åº¦ï¼Œæ‰æœƒå¥—ç”¨
   å°æ‡‰é‚£çµ„ä¸Šä¸‹é™ï¼ˆè¦‹calculateStatusEffectChance()
   æ—çš„LOCKDOWN_HIT_BOUNDSèªªæ˜ï¼‰ã€‚
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
   â˜… æ²»ç™‚é‡å…¬å¼ï¼ˆæ–°å¢ï¼‰

   ä½¿ç”¨è€…å•çš„æ˜¯ï¼š
   ã€Œæ™ºåŠ›å±¬æ€§è¶Šé«˜ï¼Œæ¢å¾©æŠ€èƒ½çš„é‡å°±è¶Šé«˜ï¼Œ
     é€™å€‹è©²å¦‚ä½•å»æŠ“åŸºæº–ï¼Ÿ10é»æ™ºåŠ›+1é»æ¢å¾©é‡å—ï¼Ÿã€

   æˆ‘çš„åˆ¤æ–·ï¼š10é»æ™ºåŠ›æ‰+1é»æ¢å¾©é‡å¤ªå¼±äº†ã€‚
   å°ç…§ç¾æœ‰çš„å‚·å®³å…¬å¼ï¼Œ
   æ™ºåŠ›å°ã€Œæ³•è¡“æ”»æ“Šã€æ˜¯ 1é»æ™ºåŠ› = +8é»é­”æ”»
   ï¼ˆgetBaseStats()èˆ‡æˆ°é¬¥æ•¸å€¼å…±ç”¨åŒä¸€æ›ç®—å¸¸æ•¸ï¼‰ã€‚
   å¦‚æœæ²»ç™‚åªçµ¦10é»æ™ºåŠ›+1ï¼Œ
   æœƒè®Šæˆã€Œé»æ™ºåŠ›å»æ‰“å‚·å®³ã€è·Ÿ
   ã€Œé»æ™ºåŠ›å»æ²»ç™‚ã€çš„å ±é…¬ç‡å·®è·éå¸¸æ‡¸æ®Šï¼Œ
   æ²’æœ‰äººæœƒæƒ³é»æ™ºåŠ›å»ç©è£œå¸«è·¯ç·šã€‚

   æ­£å¼æ”¹ç”¨ 1é»æ™ºåŠ› = +1.25é»æ²»ç™‚é‡ï¼Œ
   æŠ“æ¯”é­”æ”»ä¿‚æ•¸(8)ä½ï¼Œ
   æ˜¯å› ç‚ºæ²»ç™‚æŠ€èƒ½é€šå¸¸æ²’æœ‰é˜²ç¦¦åŠ›æ¸›å…é€™é“é—œå¡
   ï¼ˆæ²»ç™‚ä¸æœƒè¢«ã€Œé˜²ç¦¦åŠ›ã€æ‰“æŠ˜æ‰£ï¼‰ï¼Œ
   å¦‚æœä¿‚æ•¸è·Ÿæ”»æ“Šä¸€æ¨£é«˜ï¼Œ
   æ²»ç™‚é‡æˆé•·æ›²ç·šæœƒæ¯”å‚·å®³é‚„èª‡å¼µï¼Œ
   æ‰€ä»¥åˆ»æ„æŠ“å¾—æ¯”æ”»æ“Šä¿‚æ•¸ä½ä¸€äº›ï¼Œ
   ä½†åˆæ¯”ä½¿ç”¨è€…åŸæœ¬çŒœçš„0.1ï¼ˆ10é»æ‰+1ï¼‰åˆç†å¾ˆå¤šã€‚

   æœ€çµ‚æ²»ç™‚é‡ = æŠ€èƒ½åŸºç¤æ²»ç™‚é‡ + Math.floor(æ™ºåŠ› Ã— 1.25)
   ä¸å¥—ç”¨ç­‰ç´šå·®è·ä¿‚æ•¸ã€ä¹Ÿä¸å¥—ç”¨é˜²ç¦¦åŠ›æ¸›å…ï¼Œ
   å› ç‚ºæ²»ç™‚æ˜¯å°å·±æ–¹æ–½æ”¾ï¼Œ
   è·Ÿã€Œæ‰“è´æ•µäººã€çš„é‚è¼¯ç„¡é—œï¼Œ
   å–®ç´”çœ‹æ–½æ”¾è€…è‡ªå·±æ™ºåŠ›å¤šé«˜ã€‚

   èˆ‰ä¾‹ï¼š
   æ²»ç™‚è¡“åŸºç¤æ²»ç™‚40é»ï¼Œ
   æ–½æ”¾è€…æ™ºåŠ›34ï¼š
   40 + floor(34Ã—1.25) = 40+42 = 82é»ã€‚
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
   V118ï¼šSPæ²»ç™‚é‡æ­£å¼å—æ™ºåŠ›å½±éŸ¿ã€‚
   æ¯1é»æ™ºåŠ› = +0.5é»SPæ²»ç™‚é‡ã€‚
   æ³¨æ„ï¼šé€™æ˜¯ã€Œå¯çµ¦å‹æ–¹ç›®æ¨™çš„SPæ²»ç™‚é‡ã€ï¼›æ–½æ”¾è€…æœ¬äººä¸å›å¾©SPã€‚
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
   â˜… é€šç”¨æŠ€èƒ½æ–½æ”¾å¼•æ“

   ä¹‹å‰æ¯å€‹æŠ€èƒ½éƒ½å„è‡ªå¯«ä¸€å€‹function
   ï¼ˆrocketAttack/criticalAttack/...ï¼‰ï¼Œ
   æŠ€èƒ½ä¸€å¤šï¼ˆç¾åœ¨ç«ç³»å°±æœ‰10å€‹ï¼Œä¹‹å¾Œæ°´ç³»é‚„æœ‰10å€‹ï¼‰
   é€™æ¨£å¯«ä¸ä¸‹å»ï¼Œæ‰€ä»¥æ”¹æˆã€Œè³‡æ–™é©…å‹•ã€ï¼š
   skillDatabaseè£¡å®šç¾©å¥½æ¯å€‹æŠ€èƒ½çš„æ•¸å€¼ï¼Œ
   å…¨éƒ¨æŠ€èƒ½å…±ç”¨åŒä¸€å¥—æ–½æ”¾é‚è¼¯ã€‚

   ç›®å‰åªæœ‰ã€Œç«ã€è§’è‰²æœƒçœŸæ­£ä¸Šå ´æˆ°é¬¥
   ï¼ˆæ°´/é¢¨è§’è‰²é‚„æ˜¯è¦æ ¼è£¡çš„ã€Œæœªä¾†åŠŸèƒ½ã€ï¼‰ï¼Œ
   æ‰€ä»¥é€™å€‹å¼•æ“å…ˆæœå‹™fireè§’è‰²ï¼Œ
   ä¹‹å¾Œæ°´è§’è‰²èƒ½ä¸Šå ´æˆ°é¬¥æ™‚ï¼Œé€™å€‹å¼•æ“å¯ä»¥ç›´æ¥æ²¿ç”¨ã€‚
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
   ä¾æŠ€èƒ½çš„ç›®æ¨™å‹æ…‹ï¼Œç®—å‡ºé€™æ¬¡æ”»æ“Šå¯¦éš›æœƒæ‰“åˆ°å“ªäº›æ€ªç‰©
   ï¼ˆå›å‚³çš„æ˜¯monstersé™£åˆ—çš„åŸå§‹indexæ¸…å–®ï¼‰ã€‚

   singleï¼šåªæ‰“é¸å®šçš„ç›®æ¨™ã€‚
   ä¸€èˆ¬æˆ°é¬¥ç”± FourSymbolsBattlefieldSlots çš„å›ºå®šåæ ¼å¿«ç…§è§£æ
   single / tri / row / column / allï¼›æ­»äº¡å¾Œä¸æœƒé‡æ–°è£œä½ã€‚
   Boss å°ˆå±¬æ¨¡å¼å‰‡å…ˆäº¤çµ¦ FourSymbolsBossBattleï¼šé™¤ all å¤–ä¸€å¾‹
   åªçµç®— primary targetã€‚é€™è£¡æ˜¯æ•µæ–¹å‚·å®³ç›®æ¨™çš„å”¯ä¸€ ownerã€‚
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
            buff.type==="stealthSkill"||buff.v141BuffType==="stealthSkill"||buff.statusName==="éš±èº«"
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
    burn:"ç‡ƒç‡’",
    rage:"æ€’ç«",
    fireSoulResonance:"ç‚é­‚å…±é³´",
    bloodBurn:"ç„šè¡€",
    fireMomentum:"ç‚å‹¢",
    phoenixMight:"é³³å¨",
    yuanZuBlessing:"å…ƒç¥–è³œç¦",
    frostbite:"å‡å‚·",
    freeze:"å†°å°",
    agilityDown:"é‡åŠ›",
    damageDown:"æ®¤é¢¨",
    stun:"æšˆçœ©",
    dodgeSkill:"é¢¨è¡Œ",
    dodge:"é¢¨è¡Œ",
    stealthSkill:"éš±èº«",
    dinghaishenzhen:"æ°£å®šç¥é–’",
    resistance:"æ°£å®šç¥é–’",
    defenseDown:"ç ´é˜²",
    shield:"å²©ç›¾",
    petrify:"çŸ³åŒ–",
    earthShield:"è¬è±¡åœŸç›¾",
    rockWall:"å²©çŸ³å£å£˜",
    barrier:"çµç•Œ"
});

const EXCLUSIVE_HARD_CONTROL_STATE_NAMES=Object.freeze(["å†°å°","çŸ³åŒ–"]);

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
    if(name==="å²©ç›¾"&&Number(entry.remaining)<=0){ return false; }
    if(name==="çµç•Œ"&&entry.remainingBlocks!==undefined&&Number(entry.remainingBlocks)<=0){ return false; }
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

function getPersistentStateConflict(entity,stateOrType){
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
        showMissEffect(targetSide==="player",targetIndex,"ç‹€æ…‹MISS");
    }
    if(typeof addBattleLog==="function"){
        const targetName=entity&&(entity.name||entity.id)||"ç›®æ¨™";
        const existingPrefix=existingName===stateName?"å·²æœ‰":"ç›®å‰å·²æœ‰";
        addBattleLog(
            (sourceName?sourceName+"ï¼š":"")+targetName+existingPrefix+"ã€"+existingName+"ã€‘ï¼Œæ–°çš„ã€"+stateName+"ã€‘MISSã€‚"
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


/* ç‡ƒç‡’ï¼šåŒåç‹€æ…‹å­˜åœ¨æ™‚ç”±å‰ç½®åˆ¤å®šç›´æ¥MISSï¼Œä¸è¦†è“‹æˆ–åˆ·æ–°ã€‚ */

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
   â˜… å†°å°ç‹€æ…‹ï¼ˆæ–°å¢ï¼Œæ°´ç³»æŠ€èƒ½ç”¨ï¼‰ï¼š
   å†°å°ä¸­çš„æ€ªç‰©åœ¨monsterTurn()è£¡æœƒè¢«è·³éæ”»æ“Šï¼Œ
   ä¸æœƒæ‰£è¡€ï¼Œç´”ç²¹æ˜¯æ§å ´æ•ˆæœï¼Œ
   è·Ÿç‡ƒç‡’ï¼ˆDoTï¼‰æ˜¯ä¸åŒæ©Ÿåˆ¶ã€‚
*/

function applyFreezeEffect(monster,duration){

    const targetContext=getPersistentStateTargetContext(monster);
    if(!canApplyNamedPersistentState(
        monster,"freeze",targetContext.targetSide,targetContext.targetIndex
    )){
        return false;
    }

    if(!monster.statusEffects){

        monster.statusEffects=[];

    }


    monster.statusEffects=monster.statusEffects.filter(effect=>
        !effect||effect.type!=="freeze"||Number(effect.turnsLeft)>0
    );

    const freezeState={type:"freeze",turnsLeft:duration};
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
   â˜… æ–°å¢ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œæ¥ä¸Šé¢¨ç³»/åœŸç³»
   æŠ€èƒ½çš„æ¸›ç›Šæ•ˆæœï¼‰ï¼š
   è·ŸapplyFreezeEffect()/applyBurnEffect()
   åŒä¸€å¥—æ¶æ§‹ï¼Œé€šç”¨ç‰ˆæœ¬ï¼Œä¸€æ¬¡è™•ç†agilityDown
   ï¼ˆé™æ•æ·ï¼‰ã€statDownï¼ˆé™å…¨å±¬æ€§ï¼‰ã€
   defenseDownï¼ˆé™é˜²ç¦¦ï¼‰ã€damageDownï¼ˆé™ä½é€ æˆå‚·å®³ï¼‰ã€
   stunï¼ˆæé«˜MISSç‡ï¼‰ã€petrifyï¼ˆçŸ³åŒ–ï¼Œç„¡æ³•è¡Œå‹•ï¼‰é€™å…­ç¨®æ€ªç‰©èº«ä¸Š
   çš„æ¸›ç›Šæ•ˆæœã€‚åŒåç‹€æ…‹å­˜åœ¨æ™‚ä¸€å¾‹MISSï¼Œ
   ä¸ç–ŠåŠ ã€ä¸è¦†è“‹ã€ä¸åˆ·æ–°æŒçºŒæ™‚é–“ã€‚

   valueçš„æ„ç¾©ä¾typeè€Œä¸åŒï¼š
   agilityDown/statDown/defenseDown/damageDown/stun
   â†’ç™¾åˆ†æ¯”æ•¸å­—ï¼ˆä¾‹å¦‚50ä»£è¡¨é™ä½50%ï¼‰
   petrifyâ†’ä¸éœ€è¦valueï¼Œç´”ç²¹çœ‹æœ‰æ²’æœ‰é€™å€‹
   typeã€turnsLeft>0
*/

function applyMonsterDebuff(
    monster,
    type,
    duration,
    value,
    extraFields
){

    const persistentName=getPersistentStateName(type);
    if(EXCLUSIVE_HARD_CONTROL_STATE_NAMES.includes(persistentName)){
        const targetContext=getPersistentStateTargetContext(monster);
        if(!canApplyNamedPersistentState(
            monster,type,targetContext.targetSide,targetContext.targetIndex
        )){
            return false;
        }
    }else if(hasNamedPersistentState(monster,type)){
        return false;
    }

    if(!monster.statusEffects){

        monster.statusEffects=[];

    }


    monster.statusEffects=monster.statusEffects.filter(effect=>
        !effect||effect.type!==type||Number(effect.turnsLeft)>0
    );

    const state=Object.assign(
        {type:type,turnsLeft:duration,value:value},
        extraFields||{}
    );
    monster.statusEffects.push(markPersistentStateName(state,type));

    return true;

}


/*
   â˜… é€šç”¨ç‰ˆæœ¬ï¼šè®€å–æ€ªç‰©èº«ä¸ŠæŸå€‹æ¸›ç›Šæ•ˆæœç›®å‰
   çš„æ•¸å€¼ï¼ˆæ²’æœ‰é€™å€‹æ•ˆæœçš„è©±å›å‚³0ï¼‰ï¼Œ
   getMonsterAgility()/getMonsterAccuracy()/
   getMonsterEffectiveDefense()éƒ½æœƒå‘¼å«é€™è£¡ã€‚
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
   V120ï¼šé¢¨ç„°è¡“ï¼é¢¨å“®é›»æ“Šçš„ã€Œå‚·å®³é™ä½ã€æ­£å¼å…±ç”¨åŒä¸€å€‹è¼¸å‡ºå‚·å®³å…¥å£ã€‚
   damageDown çš„ value æ˜¯ç™¾åˆ†æ¯”ï¼Œä¾‹å¦‚30ä»£è¡¨æœ€çµ‚é€ æˆå‚·å®³é™ä½30%ã€‚
   åªå½±éŸ¿è§’è‰²ï¼æ€ªç‰©ä¸»å‹•é€ æˆçš„ç›´æ¥æ”»æ“Šèˆ‡æŠ€èƒ½å‚·å®³ï¼›
   ä¸æ”¹ç‡ƒç‡’é€™é¡ä¾ç›®æ¨™æœ€å¤§HPè¨ˆç®—çš„æŒçºŒå‚·å®³ï¼Œä¹Ÿä¸æ”¹åå‚·ã€‚
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
    if(downPercent<=0){        return Math.floor(numericDamage);
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
   â˜… æ€ªç‰©ã€Œæœ‰æ•ˆé˜²ç¦¦åŠ›ã€â€”â€”åŸå§‹defenseæ‰£æ‰
   defenseDowné€™å€‹æ¸›ç›Šæ•ˆæœçš„ç™¾åˆ†æ¯”ã€‚
   åœŸç³»çš„åœŸçŸ³æ–¬/æŠ•çŸ³è¡“/æ²™å¡µé¢¨æš´éƒ½æ˜¯ç”¨é€™å€‹
   é™ä½æ€ªç‰©é˜²ç¦¦ï¼Œç©å®¶å°é€™éš»æ€ªç‰©é€ æˆçš„
   å‚·å®³è¨ˆç®—ï¼Œå…¨éƒ¨æ”¹è®€é€™å€‹å‡½å¼ï¼Œä¸è¦ç›´æ¥è®€
   monster.defenseã€‚
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
   â˜… æ–°å¢ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œæ¥ä¸Šé¢¨ç³»/åœŸç³»
   æŠ€èƒ½çš„é™„åŠ æ•ˆæœï¼‰ï¼š
   é€šç”¨ç‰ˆæœ¬ï¼Œè·Ÿç‡ƒç‡’/å†°å°åˆ¤å®šå…±ç”¨åŒä¸€å¥—
   rollStatusEffectHit()æ©Ÿç‡å…¬å¼ï¼Œä¸€æ¬¡æª¢æŸ¥
   æŠ€èƒ½è³‡æ–™è£¡å¯èƒ½å­˜åœ¨çš„äº”ç¨®é™„åŠ æ•ˆæœæ¨™è¨˜ï¼š
   agilityDownChance/agilityDownByLevel
   ï¼ˆé™æ•æ·ï¼‰ã€statDownChance/statDownByLevel
   ï¼ˆé™å…¨å±¬æ€§ï¼‰ã€defenseDownChance/
   defenseDownByLevelï¼ˆé™é˜²ç¦¦ï¼‰ã€damageDownChance/
   damageDownByLevelï¼ˆé™ä½é€ æˆå‚·å®³ï¼‰ã€stunChance/
   missBonusByLevelï¼ˆæšˆçœ©ï¼æé«˜MISSç‡ï¼‰ã€
   petrifyChanceByLevelï¼ˆçŸ³åŒ–ï¼‰ã€‚

   æŠ€èƒ½æ²’æœ‰å°æ‡‰æ¬„ä½å°±è‡ªå‹•è·³éé‚£ä¸€ç¨®æ•ˆæœï¼Œ
   ä¸€å€‹æŠ€èƒ½å¯ä»¥åŒæ™‚æ›å¥½å¹¾ç¨®æ•ˆæœï¼ˆé›–ç„¶ç›®å‰
   é¢¨ç³»/åœŸç³»æŠ€èƒ½è¡¨è¨­è¨ˆä¸Šæ¯å€‹æŠ€èƒ½éƒ½åªæœ‰ä¸€ç¨®ï¼‰ã€‚

   castDamageSkill()ï¼processSingleMonsterAttack()
   åœ¨å‘½ä¸­åˆ¤å®šé€šéã€å‚·å®³çµç®—å®Œä¹‹å¾Œå‘¼å«é€™è£¡ï¼Œ
   è·Ÿç‡ƒç‡’/å†°å°çš„å‘¼å«æ™‚æ©Ÿé»ä¸€è‡´ã€‚
*/

function applySkillDebuffEffects(
    skill,
    level,
    monster,
    index,
    casterLevel,
    casterOffensiveAttribute
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
                casterOffensiveAttribute,getMonsterEffectiveSpiritPoints(monster)
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
                "çš„æ•æ·é™ä½äº†ï¼"
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
                casterOffensiveAttribute,getMonsterEffectiveSpiritPoints(monster)
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
                "çš„å…¨å±¬æ€§é™ä½äº†ï¼"
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
                casterOffensiveAttribute,getMonsterEffectiveSpiritPoints(monster)
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
                "é€ æˆçš„å‚·å®³é™ä½äº†ï¼"
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
                casterOffensiveAttribute,getMonsterEffectiveSpiritPoints(monster)
            ],"monstµ¨¥zºè¯
â¶)à²Ö§uªİ¢ëiºĞk¢G§¦*^o
Ú¤&§µø§vÊ.­Ç©jØÂŠä²–œ{û­«\‡ıŸyÆºy­usÚÂÃh²ç!~)^¢·b­ç-¢¼­j)^®º+Â¸­Šx,µ©İj·hºÚn´è‘ééŠ—›ÎÈY\\œÈ]\İ›İÜ˜\]Y]YH[˜İ[ÛœÈY\™[HÂˆ˜[œÛ]H]İ]H[ÈHÚ[™ÛHØ[›ÛšXØ[X]]ˆ
‹Âˆİ\œ™[˜]S[Ûœİ\œË™›Ü‘XXÚ
[™^OÂˆÛÛœİ[Ûœİ\[[Ûœİ\œÖÚ[™^NÂˆYŠ[Ûœİ\‰‰›[Ûœİ\‹˜[]™HOOY˜[ÙI‰“[X™\Š[Ûœİ\‹š
OL
^ÂˆÚ[[Ûœİ\Š[™^
NÂˆBˆJNÂ‚‚ˆÛÛœİ\QY™X]YYÙ]^\İ[™Ô\R[™^\Ê
K™]™\J[™^OÂˆÛÛœİÚ\˜Xİ\YÙ]\PÚ\˜Xİ\R[™^
[™^
NÂˆ™]\›ˆXÚ\˜Xİ\ˆÚ\˜Xİ\‹šLÂˆJNÂ‚ˆYŠ\QY™X]Y
^Â‚ˆÜÙP˜]J
NÂ‚ˆ™]\›ˆYNÂ‚ˆB‚‚ˆÛÛœİ[]™HBˆİ\œ™[˜]S[Ûœİ\œÂˆœÛÛYJˆOO‚ˆ[Ûœİ\œÖÚWH	‰‚ˆ[Ûœİ\œÖÚWK˜[]™Bˆ
NÂ‚‚ˆYŠX[]™J^Â‚ˆÚ[˜]J
NÂ‚ˆ™]\›ˆYNÂ‚ˆB‚‚ˆ™]\›ˆ˜[ÙNÂ‚ŸB‚‚™[˜İ[Ûˆ\TÜİ˜]P]]Ô™XÛİ™\J
^Â‚ˆÙ]^\İ[™Ô\R[™^\Ê
K™›Ü‘XXÚ
Ú\˜Xİ\’[™^OÂ‚ˆÛÛœİÚ\˜Xİ\YÙ]\PÚ\˜Xİ\R[™^
Ú\˜Xİ\’[™^
NÂˆÛÛœİÛÛ™šYÏYÙ]\P]]ĞÛÛ™šYÊÚ\˜Xİ\’[™^
NÂˆÛÛœİİ]ÏYÙ]\P˜]Tİ]ÊÚ\˜Xİ\’[™^
NÂ‚ˆYŠXÚ\˜Xİ\ˆÚ\˜Xİ\‹šLXÛÛ™šYË™[˜X›Y\İ]Ê^Âˆ™]\›ÂˆB‚ˆÈš‹œÜ—K™›Ü‘XXÚ
™\Ûİ\˜ÙOOÂ‚ˆÛÛœİX^˜[YO\™\Ûİ\˜ÙOOOHšˆÈİ]Ë›X^ˆİ]Ë›X^ÔÂˆÛÛœİİ\œ™[˜[YO\™\Ûİ\˜ÙOOOHšˆÈÚ\˜Xİ\‹šˆÚ\˜Xİ\‹œÜÂˆÛÛœİ™\ÚÛ[›Ü›X[^™P]]Ğ˜]U™\ÚÛ
ÛÛ™šYÖÜ™\Ûİ\˜ÙWK™\Ûİ\˜ÙOOOHšˆÈLˆJNÂ‚ˆYŠX^˜[YOLİ\œ™[˜[YO[X^˜[YHİ\œ™[˜[YKÛX^˜[YJŒL™\ÚÛ
^Âˆ™]\›ÂˆB‚ˆÛÛœİİ[Û’YYÙ]]]Ôİ[Û’Y
™\Ûİ\˜ÙJNÂˆÛÛœİYš[š][ÛYÙ]İ[Û‘Yš[š][ÛŠİ[Û’Y
NÂ‚ˆYŠYYš[š][ÛˆXÛÛœİ[YTİ[Û‘œ›ÛR[™[ÜJİ[Û’YJJ^Âˆ™]\›ÂˆB‚ˆÛÛœİ[›™YYYš[š][Û‹œ™XÛİ™\T\˜Ù[LLˆÈX^˜[YKXİ\œ™[˜[YBˆˆX]›X^
KX]œ›İ[™
X^˜[YJ™Yš[š][Û‹œ™XÛİ™\T\˜Ù[ÌL
JNÂˆÛÛœİ™XÛİ™\™YSX]›X^
X]›Z[ŠX^˜[YKXİ\œ™[˜[YK[›™Y
JNÂ‚ˆYŠ™\Ûİ\˜ÙOOOHšŠ^ÂˆÚ\˜Xİ\‹šSX]›Z[ŠX^˜[YKÚ\˜Xİ\‹š
Ü™XÛİ™\™Y
NÂˆY[Ù^ÂˆÚ\˜Xİ\‹œÜSX]›Z[ŠX^˜[YKÚ\˜Xİ\‹œÜ
Ü™XÛİ™\™Y
NÂˆB‚ˆY˜]SÙÊˆ¹¢,:k)yíd9§gùo£;ï#ŠÊÚ\˜Xİ\‹šYº)äº"lˆŠJÂˆº!ê¹båy/oùå*ŠÙYš[š][Û‹›˜[YJÈ»ï#9 h¹oªHŠÜ™XÛİ™\™Y
ÈˆŠÜ™\Ûİ\˜ÙKÕ\\Ø\ÙJ
JÈ¸à ˆ‚ˆ
NÂˆJNÂˆJNÂ‚ˆ™XZ[[™[ÜTÛİÊ
NÂŸB‚‚™[˜İ[ÛˆÚ[˜]J
^Â‚ˆYŠX˜]PXİ]™J^Âˆ™]\›ÂˆB‚‚ˆ˜]PXİ]™OY˜[ÙNÂˆÛX\˜]T›İ[™›Û\

NÂˆš[š\Ú˜]Tİ]\İXÜÔÙ\ÜÚ[ÛŠÚ[ˆŠNÂ‚ˆ]]Ğ˜]OY˜[ÙNÂ‚ˆXİ[Û”™XYOY˜[ÙNÂ‚ˆ[™[™ĞXİ[Û[[Â‚‚ˆÛX\’[\˜[
[Y\’Y
NÂ‚ˆ[Y\’Y[[Â‚ˆYŠ˜]PY˜[˜ÙU[Y[İ]Y
^ÂˆÛX\•[Y[İ]
˜]PY˜[˜ÙU[Y[İ]Y
NÂˆ˜]PY˜[˜ÙU[Y[İ]Y[[ÂˆBˆÛX\˜]PXİ[Û•Ø]ÚÙÊ
NÂˆ˜]PY˜[˜ÙTØÚY[YY˜[ÙNÂ‚‚ˆ˜]UÚÙ[ŠÊÎÂˆÛX\•˜[œÚY[˜]T™\Ù[][ÛŠ
NÂ‚ˆÊ‚ˆ8¦!H9¥¬9h§»ï"9/§yáiù/oùå*: !z) y¬`»ï#9«ãù¥éy.îùbæBˆ8à#9¢dú-#Ìyh-9¢,:k)xà#{ï"{ï&¹bçyb*yíd9ë¥ú`&z(èy¦+Âˆ9e+ù. 9§ ùí¤ú`c¹æ¡9g,9¥®{ï#9æí9£©z*&:c!:`,¹n©¸à ‚ˆ
‹Â‚ˆ[œİ\™QZ[T]Y\İĞİ\œ™[

NÂ‚ˆZ[T]Y\İİ]Kœ›ÙÜ™\ÜËÚ[˜]OBˆX]›Z[ŠˆKˆ
ˆZ[T]Y\İİ]Kœ›ÙÜ™\ÜËÚ[˜]_ˆˆ
JÌBˆ
NÂ‚‚ˆÊ‚ˆ8¦!H9¥¬9h§»ï&¹iå:*%ù.îùbæxà#9¢dú-#Ìùh-9¢,:k)xà#{ï#ˆ9d#9. 9`"ù.¢ù.í¹/¡¹®¤9. :-mùí+ùb¨8à ‚ˆ
‹Â‚ˆÛÛ[Z\ÜÚ[Û”]Y\İİ]Kœ›ÙÜ™\ÜËÚ[˜]OBˆX]›Z[Š‚ˆÛÛ[Z\ÜÚ[Û”]Y\İYš[š][ÛœË™š[™
ˆOOœKšYOOHÚ[˜]H‚ˆ
K™ÛØ[‚ˆ
ˆÛÛ[Z\ÜÚ[Û”]Y\İİ]Kœ›ÙÜ™\ÜËÚ[˜]_ˆˆ
JÌB‚ˆ
NÂ‚‚ˆÊ‚ˆ8¦!H9/ë¹«hûï"9d#9. 9`"ùecúhc9æ¡9cé¹. 9cb»ï"{ï&‚ˆ:-çÛÜÙP˜]J
y. 9ª(ûï#9bçyb*yíd9ë¥ù.gùk£9aj9¬¤¹§"Bˆ9¥-¹d"9cëú ïz`¡:e¢ú$eùæ¡9kd:`n9e«»ï#9. 9ª(ú(ç9."¸à ‚ˆ
‹Â‚ˆÛÜÙSY[\Ê
NÂ‚‚ˆY˜]SÙÊˆ¹¢`9§"y *¹âjymìº(ªù¤â¹¥eûï H‚ˆ
NÂ‚‚ˆÛÛœİ^ØZ[ˆBˆİ\œ™[˜]S[Ûœİ\œÂˆœ™YXÙJˆ
İ[JOO‚ˆİ[
Âˆ[Ûœİ\œÖÚWK›]™[
ŒLˆˆ
NÂ‚‚ˆÊ‚ˆ8¦!H9¢,:k)y.+yíeyl#y.#z ïycaùí&¸à ‚ˆV9ab:`,¹aixà#9alyå*9í¤újeù¬h8à#{ï#ˆ9ëbyãªyk­¹fç¹b,9..ùgãº!êº(c9£"xà#9b!ºacyí¤újeù`/8à#Bˆ9¢cy§ ùç'ù«hùb)9¥­ùcaùí&¸à ‚ˆ
‹Â‚ˆÚ\™Y^
ÏBˆ^ØZ[Â‚‚ˆY˜]SÙÊˆ¹ãl¹o¥ÈŠÂˆ^ØZ[ŠÂˆ‘V;ï#9mì¹kf9aiyí¤újeù¬h8à ˆ‚ˆ
NÂ‚ˆ\TÜİ˜]P]]Ô™XÛİ™\J
NÂ‚‚ˆÊ‚ˆ8¦!H9/ë¹«hûï&‚ˆ9c§ù§+V9£ä9é.»ï":nàú"l¹­k¹båz*"¹ kûï"Bˆ9g*9¢,:k)yåjúgh¹íd9§gùåm¹."ùl,yêâùb.ú-ìùaî¹/¡»ï#ˆ:-çù¢,:k)yåjúghºaãyå¢¹g*9. :-mùo¢9. ¸à ‚ˆ9¥.y¢$9ëbyåjúgh¹ç'ùæ¡9b!ùfç¹g,9g%¹.bùo£9¢czhkùé.»ï#ˆ9¥/º`,¹."úghˆÚİÔYÙJ›X\ŠH:`¨ù`"ÂˆÙ][Y[İ]Ø[˜XÚÈ:(èzgh¸à ‚ˆ
‹Â‚‚ˆÊ‚ˆ8¦!H9/ë¹«hûï&‚ˆ9c§ù§+:`&z(èy¢dú-#ùl,y§ ú!ê¹båy¢¢’ÔÔ:(ç9®ïûï#ˆ:`&y¦+ù§ 9¥êz)£ù¨/9kêùæ¡;ï"9fçº(`ùfç”Ô;ï"{ï#ˆ9/a¹kéºf¦ùãªz-mù/¡¹§ ú+¤ÒÔÔ:%éy¬-9k£9aj9¬¤¹§"y¡#ùïªx %8 %ˆ9cãy«hù¢dùk£9l,yaj9®ïûï#:%éy¬-9¨.y§+9.#yå*9å*8à ‚‚ˆ9¥.y¢$;ï&¹¢dú-#ù.bùo£ÔÔ9í«y£ y¢,:k)yíd9§gùåm¹."ùæ¡9¥n9`/;ï#ˆ9.#y§ ú!ê¹båz(ç9®ïûï#:) yf&ùn-º%éy¬-;ï#ˆ:) yf&ù.bùo£:(ç9. 9`"øà#9fç¹..ùgã¹/$y kùfçº(`8à#yæ¡9b§ú ïxà ‚‚ˆ9¢,:k)xà#9i,y¥eøà#z(ªù¤â¹¥eùæ¡:(ç:(`:`£ú/+ùí«y£ y.#z+¢‚ˆ;ï":`¨ù`"ù«å:/ ù`ãù¦+øà#:aãyå'øà#yæ¡9© ¹oí{ï#ˆ:-çú`&z(èy¢dú-#ú(ç:(`9.#y¦+ùd#9. 9.í¹.¢ûï#ˆ9¥ay¡#ùåfz$eù¬¤¹§"y. :-mù¢ïù£¢{ï"xà ‚ˆ
‹Â‚‚ˆÛX\•[Y[İ]
™\Ü]Û’Y
NÂ‚‚ˆÊ‚ˆ8¦!H9î+¹çëy *¹âjzaãyå'ù¦`ºe¤ûï&‚ˆ9c§ù§+yéä»ï#:acyd"9ãï¹g*9éîùbåymì¹í¤ú)èúc¥»ï#ˆ9ãªyk­ºi«9."¹l,z ïyg*9g,9g%¹."º-l9bå{ï#ˆ9/a¹ *¹âjz`¡:) yëbMyéä¹¢cyaî¹ãï»ï#ˆ9åjúgh¹§ ù§"y. 9«­y¦`ºe¤ù¡'ú)®¹ên¹ên¹æ¡8à ‚ˆ9¥.y¢$¹éä»ï#:jå9¡'ù."º$/ymë¹l#ùo¢9i&¸à ‚ˆ
‹Â‚ˆ™\Ü]Û’YBˆÙ][Y[İ]
ˆ™\Ü]Û“[Ûœİ\œËˆŒˆ
NÂ‚‚ˆØ]™QØ[YJ
NÂ‚‚ˆÊ‚ˆ8¦!H9/ë¹«hûï&‚ˆ9.bùbcyà®¹.¡º)èù¬n¸à#9fç¹g,9g%¹o£9 *¹âjyên¹.¡¹ioy. :fhùkd8à#Bˆ9¢¢º`&z(èyhäùb,L\ûï#ˆ9/aº`&yª(ù¢,:k)yíd9§gùno¹.c¹¦+ùç«:e¤ú-ìú-l;ï#ˆ9¥¡ùkeÔ”ùç"ù.#yb,8à#9¢dú-#ù.¡¸à#yæ¡:*"¹ kú-çùãl¹o¥ùæ¡V;ï#ˆ9k£9aj9¬¤¹§"y`g9åfy¡'øà ‚‚ˆ9ãï¹g*8à#9 *¹âjy­¢9i,yi*¹.axà#z-çøà#9éîùbåz(ªùchy/cøà#Bˆ9mì¹í¤ùå*9b)yæ¡9¥®yo#ú)èù¬n¹.¡»ï"™\Ü]Û¹î+¹b,¹éä¸à Bˆ9éîùbåy.#ya£z(ªÛX\ÛÛÛİÛ¹chy/cûï"{ï#ˆ9¢`9.éz`&z(èycëù.éy¥/¹oàù¢âzemûï#ˆ:+¤ùãªyk­¹§"y¦`ºe¤ùç"ù®!y©f¹¢,:k)z,áú*"º(èyæ¡9íd9§§8à ‚ˆ
‹Â‚ˆÙ][Y[İ]


OOÂ‚ˆÚİÔYÙJ›X\ŠNÂ‚ˆÙ]X\ÛÛÛİÛŠÌ
NÂ‚‚ˆİ\[Ûœİ\“[İ™[Y[

NÂ‚ˆØÚY[P]]Ô]›ÛÚXÚÊL
NÂ‚ˆ\]URJ
NÂ‚‚ˆÚİÑ^Ø\İ
ˆ^ØZ[‚ˆ
NÂ‚‚ˆÊ‚ˆ8¦!H9¥¬9h§»ï&¹¬¤º%éy¬-:!ê¹båyfç¹..ùgã¸à ‚ˆ9cêº) yë+9. :)äº"l¹¢%¹ë+9.£:)äº"l¹§"ybïº`n:`&y`"ú*+yk¦»ï#ˆ9¢,:k)yíd9§gùfç¹b,9g,9g%¹.bùo£;ï#ˆ9ª¨¹§éz.ªù."’ÔÔ:%éy¬-9¦+ù.#y¦+ú`ïyå*9k£9.¡»ï#ˆ:`ïyå*9k£9æ¡:*lyæí9£©zhæùfç¹..ùgã»ï#ˆ9.#yå*9ãªyk­º!ê¹mìz*&9o¥ú) yfç¹c®ú(ç:,ª8à ‚ˆ
‹Â‚ˆÚXÚĞ]]Ô™]\›•ĞÚ]J
NÂ‚ˆKŒŒ
NÂ‚ŸB‚‚‹Ê‚ˆ8¦!H9¥¬9h§»ï&¹¬¤º%éy¬-:!ê¹båyfç¹..ùgã¹æ¡9`my®+8à ‚ˆ:%éy¬-9¦+ùãªyk­¹n,ú&gùalyå*9æ¡9e«¹. 9nªùkfˆ;ï"9.#y¦+ù«ãù`"ú)äº"l¹d!:!ê¹n-¹. 9.ï{ï"{ï#ˆ9cêº) y.îù. :)äº"l¹§"ze¢ùegú`&y`"ú*+yk¦»ï#ˆ:.ªù."’8à TÔ:%éy¬-:`ïyå*9k£9.¡»ï#ˆ9l,z!ê¹båzfèºe¢ùg,9g%¸à zhæùfç¹..ùgã¸à ‚Š‹Â‚™[˜İ[ÛˆÚXÚĞ]]Ô™]\›•ĞÚ]J
^Â‚ˆÛÛœİÚİ[ÚXÚÏB‚ˆ]]ĞÛÛ™šYËœ™]\›•ĞÚ]UÚ[‘[\Hˆ
ˆ^Y\Œˆ	‰‚ˆ]]ĞÛÛ™šYÌ‹œ™]\›•ĞÚ]UÚ[‘[\Bˆ
Hˆ
ˆ^Y\ŒÈ	‰‚ˆ]]ĞÛÛ™šYÌËœ™]\›•ĞÚ]UÚ[‘[\Bˆ
NÂ‚‚ˆYŠ\Úİ[ÚXÚÊ^Âˆ™]\›ÂˆB‚‚ˆYŠˆÙ]İ[İ[ÛÛİ[

OŒˆ
^Âˆ™]\›ÂˆB‚‚ˆİÜ[Ûœİ\“[İ™[Y[

NÂ‚‚ˆÚİÔYÙJˆšÛYH‚ˆ
NÂ‚‚ˆ[\
ˆ’;ï#ÔÔ:%éy¬-:`ïyå*9k£9.¡»ï#9mìº!ê¹båz/å9fç¹..ùgã¸à ˆ‚ˆ
NÂ‚ŸB‚‚™[˜İ[ÛˆÜÙP˜]J
^Â‚ˆYŠX˜]PXİ]™J^Âˆ™]\›ÂˆB‚‚ˆ˜]PXİ]™OY˜[ÙNÂˆÛX\˜]T›İ[™›Û\

NÂˆš[š\Ú˜]Tİ]\İXÜÔÙ\ÜÚ[ÛŠ›ÜÙHŠNÂ‚ˆ]]Ğ˜]OY˜[ÙNÂ‚ˆXİ[Û”™XYOY˜[ÙNÂ‚ˆ[™[™ĞXİ[Û[[Â‚‚ˆÛX\’[\˜[
[Y\’Y
NÂ‚ˆ[Y\’Y[[Â‚ˆYŠ˜]PY˜[˜ÙU[Y[İ]Y
^ÂˆÛX\•[Y[İ]
˜]PY˜[˜ÙU[Y[İ]Y
NÂˆ˜]PY˜[˜ÙU[Y[İ]Y[[ÂˆBˆÛX\˜]PXİ[Û•Ø]ÚÙÊ
NÂˆ˜]PY˜[˜ÙTØÚY[YY˜[ÙNÂ‚‚ˆ˜]UÚÙ[ŠÊÎÂˆÛX\•˜[œÚY[˜]T™\Ù[][ÛŠ
NÂ‚‚ˆÊ‚ˆ8¦!H9/ë¹«hûï"9ç'ùæ¡9¢¤ùb,8à#9åjúgh¹."ù¥®yåfy."ù. 9i)ù¢*¹ên¹æoxà#Bˆ9æ¡9am¹.+y. 9`"ùc§ùfè;ï"{ï&‚ˆ9¢,9¥eùíd9ë¥ùk£9aj9¬¤¹§"y¢¢¹cëú ïz`¡:e¢ú$eùæ¡9kd:`n9e«‚ˆ;ï"9/¢ùi ¹âjydày«!9æ¡ÔÔ:%éy¬-:`n9e«»ï"y¥-¹d";ï#ˆ9i ¹§§9¢,9¥eùæ¡9åm¹."ùbfùioz`n9e«¹¦+úe¢ú$eùæ¡;ï#ˆ9k ùl,y§ ùchyg*9¢dúe¢ùæ¡9âà9¡bûï#:+¢¹¢$9åjúgh¹."‚ˆ9. 9i)ùhb¹ç"ú-mù/¡¹`ãøà#9ên¹æoxà#yæ¡9c`9gçûï#ˆ9am¹ké¹¦+ù. 9`"ùaiùk®yç"ú-mù/¡¹ên¹ên¹æ¡:`n9e«¹chyg*:`¨ú(èxà ‚ˆ:`&z(èz(ç9."˜ÛÜÙSY[\Ê
{ï#9è®¹/çy¢,9¥eùåjúgh‚ˆ9.o¹­ê8à y.#y§ ù«¦9åfy.îù/ez`n9e«¸à ‚ˆ
‹Â‚ˆÛÜÙSY[\Ê
NÂ‚‚ˆY˜]SÙÊˆ¹/h:(ªù¤â¹¥eù.¡¸ )¸ )ˆ‚ˆ
NÂ‚‚ˆÛÛœİİ]ÈBˆÙ]XZ[Ú\˜Xİ\”İ]Ê
NÂ‚‚ˆ^Y\‹šBˆİ]Ë›X^Â‚‚ˆ^Y\‹œÜBˆİ]Ë›X^ÔÂ‚‚ˆÊ‚ˆ8¦!H9¥¬9h§»ï&‚ˆ9ë+9. :)äº"l¹¢,9¥eù§ ú(ªøà#9¥dyfç¸à#zaãyå'ú(ç9®ïÒÔÔ;ï#ˆ9ë+9.£:)äº"l¹c§ù§+9¬¤¹§"z-çú$eù. :-mú&eyä!»ï#ˆ9§ ùn-º$eù¢,:k)y.+y«¦9åfyæ¡9/cº(`:aãú`,¹b,9."ù. 9h-9¢,:k){ï#ˆ:-çùë+9. :)äº"l¹æ¡:jå:jeù.#y. :!í8à ‚ˆ:`&z(èz+¤ù.åº-çú$eù. :-mú(ç9®ïøà ‚ˆ
‹Â‚ˆYŠ^Y\ŒŠ^Â‚ˆÛÛœİİ]ÌBˆÙ]^Y\Œ˜]Tİ]Ê
NÂ‚‚ˆ^Y\Œ‹šBˆİ]Ì‹›X^Â‚‚ˆ^Y\Œ‹œÜBˆİ]Ì‹›X^ÔÂ‚ˆB‚ˆYŠ^Y\ŒÊ^Â‚ˆÛÛœİİ]ÌÏYÙ]\P˜]Tİ]ÊŠNÂˆ^Y\ŒËš\İ]ÌË›X^Âˆ^Y\ŒËœÜ\İ]ÌË›X^ÔÂ‚ˆB‚‚ˆÙ][Y[İ]


OOÂ‚ˆÚİÔYÙJ›X\ŠNÂ‚ˆÙ]X\ÛÛÛİÛŠÌ
NÂ‚‚ˆİ\[Ûœİ\“[İ™[Y[

NÂ‚ˆØÚY[P]]Ô]›ÛÚXÚÊL
NÂ‚ˆ\]URJ
NÂ‚ˆKŒŒ
NÂ‚ŸB‚‚™[˜İ[Ûˆ][\\ØØ\J
^Â‚ˆÊ‚ˆ8¦!H9/ë¹«hûï&‚ˆ9c§ù§+9cê¹ª¨¹§éyaj9gçùæ¡]]Ğ˜]{ï#ˆ9¥.y¢$9ç"ùæë¹bcy¦+ú*¬9æ¡9fç¹d"8à Bˆ9å*9l#y¡âz)äº"l¹æ¡:!ê¹båze¢úeç9/¡¹b)9¥­Âˆ;ï":` ú!*ù¦+ù¥m9`"úf¢¹/#y. :-mú` ûï#ˆ9/a¹¤ãy/g9¦`¹ªgú`¡9¦+ú) z-çùæë¹bcyfç¹d"9æ¡ˆ9¢bùbåKú!ê¹båyâà9¡bù. :!í;ï#ˆ9.#yá-º!ê¹båz)äº"lº(c9båy.+z`%:`¡: ïz(ªú` ú!*ù£"zb%y¢dù¥­ûï"xà ‚ˆ
‹Â‚ˆÛÛœİ]]ÓÛBˆXİ]™P˜]PÚ\˜Xİ\’[™^OOLˆÈ]]Ğ˜]BˆˆÙ]\P]]ĞÛÛ™šYÊXİ]™P˜]PÚ\˜Xİ\’[™^
K™[˜X›YÂ‚‚ˆYŠˆX˜]PXİ]™Hˆ]]ÓÛˆˆXİ[Û”™XYBˆ
^Âˆ™]\›ÂˆB‚‚ˆÊ‚ˆ8¦!H9/ë¹«hûï"9ç'ùæ¡9¢¤ùb,9ajy`"ØYûï#:`ïy¦+ù/oùå*: !y£!ùaî¹æ¡;ï"{ï&‚‚ˆKˆ:`&z(èyc§ù§+9¬¤¹§"z*+yk¦˜Xİ[Û”™XYO]Y{ï#ˆ:f,¹da¹oh¹d#:&fú*+{ï#9oêú`'ú`(únç¹§ ù. 9æí:aãy¥¬ˆ9b)9k¦º` ú!*ù¢$9b§ùã¡ûï#9æí9b,9¢$9b§ùà®¹«h¸ %8 %ˆ9«hùè®º(c9à®¹¡âz*l¹¦+øà#:`&yfç¹d"9cêº ïyf%ú*i¹. 9«(xà#{ï#ˆ:nç¹."ùc®ù.bùo£9.#yë¨yíd9§§9i ¹/ez`ïz) zc¥¹/cøà ‚‚ˆ‹ˆ:` ú!*ùc§ù§+9¦+øà#9£"y."ùc®ùêâùb.ùb)9k¦¸à#{ï#ˆ9k£9aj:-ìú`c¹k¨ùdb‹ùíd9ë¥ùªgùb-¸à ‚ˆ9/oùå*: !y¦#¹è®¹£!ùaî»ï&º` ú!*ù.gú) yç"ù¥cù£mø %8 %ˆ9¥cù£mùi(9oêùæ¡:)äº"l¹ab9¥.ù¤â»ï#ˆ9¥cù£mù¡h¹æ¡:)äº"l¹¢cz/*¹b,9f%ú*iº` ú!*ûï#ˆ9i ¹§§9¥cù£mùi*¹/c¸à z` ú!*ú`¡9¬¤º/*¹b,:!ê¹mìBˆ9l,yab:(ªù¢dù«nûï#:`¨ù.gù¦+ùd"9ä!¹æ¡9íd9§§;ï#ˆ9.#y¡âz*lº+¤ú` ú!*ú+¢¹¢$8à#9.#ycåù¥cù£múfd9b-¹æ¡9âny«"¸à#xà ‚‚ˆ9¥.y¢$:-çùam¹.åº(c9båy. 9ª(ùab9k¨ùdb¸à Bˆ9íd9ë¥úf£¹«­y¢cy/§y¥cù£múh!¹n£ùç'ù«hùb)9k¦º` ú!*ù¢$9.#y¢$9b§øà ‚ˆ
‹Â‚ˆXİ[Û”™XYO]YNÂ‚‚ˆ]Y]YY^Y\Xİ[ÛœÖÂˆXİ]™P˜]PÚ\˜Xİ\’[™^ˆO^Â‚ˆXİ[Ûˆ™\ØØ\H‹‚ˆ\™Ù]›[‚ˆNÂ‚‚ˆ\]URJ
NÂ‚ˆš[š\Ú^Y\Xİ[ÛŠ
NÂ‚ŸB‚‚‹Ê‚ˆ8¦!H9¥¬9h§»ï&º` ú!*ùæ¡9ç'ù«hùb)9k¦»ï#ˆ9cê¹g*9íd9ë¥úf£¹«­z(ªÜ™\ÛÛ™T]Y]YY^Y\Xİ[ÛŠ
ydo9cêûï#ˆ:`£ú/+ùk£9aj9«å9áiùc§ù§+][\\ØØ\J
z(èyæ¡9b)9k¦¹o#ûï#ˆ9cê¹¦+ù¢¯yaî¹/¡¹íi¹íd9ë¥úf£¹«­yå*8à ‚Š‹Â‚™[˜İ[Ûˆ™\ÛÛ™Q\ØØ\P][\
Ú\˜Xİ\’[™^
^Â‚ˆÛX\’[\˜[
[Y\’Y
NÂˆ[Y\’Y[[Â‚ˆÛÛœİ[]™OXİ\œ™[˜]S[Ûœİ\œË›X\
OO›[Ûœİ\œÖÚWJK™š[\ŠOO›I‰›K˜[]™JNÂˆYŠ[]™K›[™İOOL
^ÈÚXÚĞ˜]Q[™

NÈ™]\›ÈB‚ˆÛÛœİYÚ\İ]™[SX]›X^
‹‹˜[]™K›X\
OO›K›]™[
JNÂˆÛÛœİ\ØØ\[™ĞÚ\˜Xİ\YÙ]\PÚ\˜Xİ\R[™^
Ú\˜Xİ\’[™^
_^Y\ÂˆÛÛœİÚ[˜ÙOSX]›X^
LX]›Z[ŠMKL
Ê\ØØ\[™ĞÚ\˜Xİ\‹›]™[ZYÚ\İ]™[
JJJNÂˆÛÛœİİXØÙYYYSX]œ˜[™ÛJ
JŒLÚ[˜ÙNÂˆÛÛœİ™\Ù[][Û“İÛ™\]\[ÙˆÚ[™İÈOOH[™Yš[™YİÚ[™İË‘›İ\”Ş[X›ÛĞ˜]T™\Ù[][Û›[ÂˆÛÛœİ™YY˜XÚÓİÛ™\]\[ÙˆÚ[™İÈOOH[™Yš[™YİÚ[™İË‘›İ\”Ş[X›ÛĞ˜]Q›Ø][™Ñ™YY˜XÚÎ›[ÂˆÛÛœİ[İ[Û\™\Ù[][Û“İÛ™\‰‰\[Ùˆ™\Ù[][Û“İÛ™\‹œ^Q\ØØ\OOOH™[˜İ[Ûˆ‚ˆÜ™\Ù[][Û“İÛ™\‹œ^Q\ØØ\JÚ\˜Xİ\’[™^İXØÙYYY
Bˆ”›ÛZ\ÙKœ™\ÛÛ™JYJNÂ‚ˆXİ[Û”™XYOY˜[ÙNÂˆ[™[™ĞXİ[Û[[Â‚ˆYŠ\İXØÙYYY
^ÂˆY˜]SÙÊº` ú!*ùi,y¥eûï HŠNÂˆ›ÛZ\ÙKœ™\ÛÛ™J[İ[ÛŠK[Š

OOÂˆÛÛœİ™YY˜XÚÏY™YY˜XÚÓİÛ™\‰‰\[Ùˆ™YY˜XÚÓİÛ™\‹™[Z]\ØØ\Q˜Z[\™OOOH™[˜İ[Ûˆ‚ˆÙ™YY˜XÚÓİÛ™\‹™[Z]\ØØ\Q˜Z[\™JÚ\˜Xİ\’[™^
Bˆ›[Âˆ™]\›ˆ™YY˜XÚÉ‰™™YY˜XÚËœ›ÛZ\ÙOÙ™YY˜XÚËœ›ÛZ\ÙN”›ÛZ\ÙKœ™\ÛÛ™J
NÂˆJK[Š

OOÂˆYŠ\[Ùˆ˜]PXİ]™OOOH[™Yš[™YŸ˜]PXİ]™J^Èš[š\Ú^Y\Xİ[ÛŠ
NÈBˆJK˜Ø]Ú


OOÂˆYŠ\[Ùˆ˜]PXİ]™OOOH[™Yš[™YŸ˜]PXİ]™J^Èš[š\Ú^Y\Xİ[ÛŠ
NÈBˆJNÂˆ™]\›ÂˆB‚ˆY˜]SÙÊ¹¢$9b§ú` ú!*ûï HŠNÂˆ›ÛZ\ÙKœ™\ÛÛ™J[İ[ÛŠK[Š

OOÂˆÛÛœİš[š\Ú\ØØ\T›İ]OJ
OOÂˆYŠÚ[™İËŒLÌXİ]™Q[™Ù[Û”[‰‰\[ÙˆÚ[™İËŒLÌX›Ü[™Ù[Û˜]OOOH™[˜İ[ÛˆŠ^ÂˆÚ[™İËŒLÌX›Ü[™Ù[Û˜]J™\ØØ\HŠNÂˆY[Ù^Âˆ˜]PXİ]™OY˜[ÙNÂˆ]]Ğ˜]OY˜[ÙNÂˆXİ[Û”™XYOY˜[ÙNÂˆ[™[™ĞXİ[Û[[ÂˆÛX\˜]T›İ[™›Û\

NÂˆÛX\’[\˜[
[Y\’Y
NÂˆ[Y\’Y[[ÂˆYŠ˜]PY˜[˜ÙU[Y[İ]Y
^ÂˆÛX\•[Y[İ]
˜]PY˜[˜ÙU[Y[İ]Y
NÂˆ˜]PY˜[˜ÙU[Y[İ]Y[[ÂˆBˆÛX\˜]PXİ[Û•Ø]ÚÙÊ
NÂˆ˜]PY˜[˜ÙTØÚY[YY˜[ÙNÂˆ˜]UÚÙ[ŠÊÎÂˆYŠ\[Ùˆš[š\Ú˜]Tİ]\İXÜÔÙ\ÜÚ[ÛOOH™[˜İ[ÛˆŠ^Èš[š\Ú˜]Tİ]\İXÜÔÙ\ÜÚ[ÛŠ™\ØØ\HŠNÈBˆÛÜÙSY[\Ê
NÂˆYŠÚ[™İËŒM”ÚÚ[[š[X][Û‘\™XİÜŠ^ÈÚ[™İËŒM”ÚÚ[[š[X][Û‘\™XİÜ‹™\ÜÜÙJ
NÈBˆYŠ™YY˜XÚÓİÛ™\‰‰\[Ùˆ™YY˜XÚÓİÛ™\‹˜ÛX\OOH™[˜İ[ÛˆŠ^È™YY˜XÚÓİÛ™\‹˜ÛX\Š
NÈBˆÚİÔYÙJ›X\ŠNÂˆÙ]X\ÛÛÛİÛŠÌ
NÂˆİ\[Ûœİ\“[İ™[Y[

NÂˆ[œİ\™P]]Ô]›Û[\˜[

NÂˆBˆYŠ™\Ù[][Û“İÛ™\‰‰\[Ùˆ™\Ù[][Û“İÛ™\‹˜ÛX[\\ØØ\OOOH™[˜İ[ÛˆŠ^Âˆ™\Ù[][Û“İÛ™\‹˜ÛX[\\ØØ\J
NÂˆBˆ™]\›ˆYNÂˆNÂˆYŠ\[ÙˆÚ[™İËŒMT^Q\ØØ\P˜]Q^]OOH™[˜İ[ÛˆŠ^Âˆ™]\›ˆÚ[™İËŒMT^Q\ØØ\P˜]Q^]
š[š\Ú\ØØ\T›İ]JNÂˆBˆ™]\›ˆš[š\Ú\ØØ\T›İ]J
NÂˆJK˜Ø]Ú


OOÂˆYŠ™\Ù[][Û“İÛ™\‰‰\[Ùˆ™\Ù[][Û“İÛ™\‹˜ÛX[\\ØØ\OOOH™[˜İ[ÛˆŠ^Âˆ™\Ù[][Û“İÛ™\‹˜ÛX[\\ØØ\J
NÂˆBˆJNÂŸB‚‚‹ÊˆOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOBˆ9¢ : ïz`n9e«‚OOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOH
‹Â‚™[˜İ[ÛˆÜ[”ÚÚ[Y[J
^Â‚ˆÊ‚ˆ8¦!H9/ë¹«hûï&‚ˆ9c§ù§+:`&z(èy¬.:`h:+ Ú\˜Xİ\”ÚÚ[ØYİ]Ë™š\™xà Bˆ9¬.:`h9ª¨¹§éyaj9gçùæ¡]]Ğ˜]z-çÜ^Y\‹œÜ;ï#ˆ9ãï¹g*9¥.y¢$9/§yáiØXİ]™P˜]PÚ\˜Xİ\’[™^ˆ9¬n¹k¦º) zhkùé.º*¬9æ¡9¢ : ïy«!8à z*¬9æ¡Ô8à ‚ˆ
‹Â‚ˆÛÛœİ]]ÓÛBˆXİ]™P˜]PÚ\˜Xİ\’[™^OOLˆÈ]]Ğ˜]BˆˆÙ]\P]]ĞÛÛ™šYÊXİ]™P˜]PÚ\˜Xİ\’[™^
K™[˜X›YÂ‚‚ˆYŠˆX˜]PXİ]™Hˆ]]ÓÛ‚ˆ
^Âˆ™]\›ÂˆB‚‚ˆÛÛœİXİ]™PÚ\˜Xİ\’YBˆÙ]\PÚ\˜Xİ\’Ù^JXİ]™P˜]PÚ\˜Xİ\’[™^
NÂ‚ˆÛÛœİXİ]™PÚ\˜Xİ\“ØšBˆÙ]\PÚ\˜Xİ\R[™^
Xİ]™P˜]PÚ\˜Xİ\’[™^
NÂ‚‚ˆÛÛœİÚ\˜Xİ\ˆBˆÚ\˜Xİ\”ÚÚ[ØYİ]ÖÂˆXİ]™PÚ\˜Xİ\’YˆNÂ‚‚ˆYŠˆXÚ\˜Xİ\ˆˆXXİ]™PÚ\˜Xİ\“Øš‚ˆ
^Âˆ™]\›ÂˆB‚‚ˆÛÛœİY[HBˆ	
œÚÚ[Y[HŠNÂ‚‚ˆY[Kš[›™\’SHˆÂ‚‚ˆÊ‚ˆ8¦!H9¥¬9h§»ï&¹leze¢ùª(yo#ùæ¡9ïkºh º/å9fç¹£"zb%xà ‚ˆ9¥/¹g*9®!ye«¹§ 9."ºgh»ï#9leze¢ù.bùo£9.#yå*9®äyb,9§ 9."úgh‚ˆ9¢cy¢o¹o¥ùb,:/å9fç»ï#9. 9¢dúe¢ùl,yç"ùo¥ùb,8à ‚ˆ
‹Â‚ˆÛÛœİ[›™Y˜XÚÏBˆØİ[Y[˜Ü™X]Q[[Y[
ˆ˜]Ûˆ‚ˆ
NÂ‚‚ˆ[›™Y˜XÚË˜Û\ÜÓ˜[YOBˆœİX‹[Y[K\[›™YX˜XÚÈÂ‚‚ˆ[›™Y˜XÚË^ÛÛ[Bˆº/å9fçˆÂ‚‚ˆ[›™Y˜XÚË›Û˜ÛXÚÏBˆÛÜÙSY[\ÎÂ‚‚ˆY[K˜\[™Ú[
ˆ[›™Y˜XÚÂˆ
NÂ‚‚ˆÚ\˜Xİ\‹™\]Z\YÚÚ[Âˆ™›Ü‘XXÚ
ÚÚ[YOÂ‚ˆÛÛœİÚÚ[BˆÚÚ[]X˜\ÙVÜÚÚ[YNÂ‚‚ˆYŠ\ÚÚ[
^Âˆ™]\›ÂˆB‚‚ˆÛÛœİÚÚ[]™[BˆÙ]ÚÚ[]™[
ˆXİ]™PÚ\˜Xİ\’YˆÚÚ[Yˆ
NÂ‚‚ˆÛÛœİÜÛÜİBˆÚÚ[œÜÛÜİOO][™Yš[™YˆÂˆÚÚ[œÜÛÜİˆ‚ˆÚÚ[˜ÛÜİÂ‚‚ˆÛÛœİ[›İYÚÔBˆXİ]™PÚ\˜Xİ\“Øš‹œÜBˆÜÛÜİÂ‚‚ˆÛÛœİ]ÛˆBˆØİ[Y[˜Ü™X]Q[[Y[
ˆ˜]Ûˆ‚ˆ
NÂ‚‚ˆ]Û‹˜Û\ÜÓ˜[YHBˆœİX‹X]ÛˆÂ‚‚ˆYŠY[›İYÚÔ
^Â‚ˆ]Û‹˜Û\ÜÓ\İ˜Y
ˆœÚÚ[\ÜZ[œİY™šXÚY[‚ˆ
NÂ‚‚ˆ]Û‹™\ØX›Y]YNÂ‚‚ˆ]Û‹š[›™\’SB‚ˆˆ]ˆİ[OH™\Ü^N™›^Ø[YÛ‹Z][\Î˜Ù[\Ú\İYKXÛÛ[œÜXÙKX™]ÙY[ÙØ\œÈ‚ˆÜ[ˆİ[OH™›Û\Ú^™NŒM\Ù›Û]ÙZYÚ˜›ÛÈ‚ˆ	ÜÚÚ[›˜[Y_Bˆ	ÂˆÚÚ[]™[ŒˆÂˆ“‹ˆŠÜÚÚ[]™[ˆ‚ˆˆ‚ˆBˆÜÜ[‚ˆÜ[ˆİ[OH™›Û\Ú^™NŒL\ØÛÛÜˆÎLØÍY™İÚ]K\ÜXÙN››İÜ˜\È‚ˆ	ØXİ]™PÚ\˜Xİ\“Øš‹œÜKÉÜÜÛÜİHÔˆÜÜ[‚ˆÙ]‚ˆ]ˆİ[OH™›Û\Ú^™NŒL\ØÛÛÜˆÙ˜ØMXMNÛX\™Ú[‹]ÜŒœÈ‚ˆÔ9.#z-¬ÂˆÙ]‚ˆÂ‚ˆBˆ[Ù^Â‚ˆÛÛœİ[XYÙT™]šY]ÈBˆÚÚ[˜˜\ÙQ[XYÙBˆÂˆ¹`­ùk¬ùí!ŠÂˆÙ]ÚÚ[[XYÙP]]™[
ˆÚÚ[ˆÚÚ[]™[Bˆ
JÂˆ»ïg‚ˆ‚ˆˆÂ‚‚ˆ]Û‹š[›™\’SB‚ˆˆ]ˆİ[OH™\Ü^N™›^Ø[YÛ‹Z][\Î˜Ù[\Ú\İYKXÛÛ[œÜXÙKX™]ÙY[ÙØ\œÈ‚ˆÜ[ˆİ[OH™›Û\Ú^™NŒM\Ù›Û]ÙZYÚ˜›ÛÈ‚ˆ	ÜÚÚ[›˜[Y_Bˆ	ÂˆÚÚ[]™[ŒˆÂˆ“‹ˆŠÜÚÚ[]™[ˆ‚ˆˆ‚ˆBˆÜÜ[‚ˆÜ[ˆİ[OH™›Û\Ú^™NŒL\ØÛÛÜˆÎLØÍY™İÚ]K\ÜXÙN››İÜ˜\È‚ˆ	ÜÜÛÜİHÔˆÜÜ[‚ˆÙ]‚ˆ]ˆİ[OH™›Û\Ú^™NŒL\ØÛÛÜˆÙYYÛX\™Ú[‹]ÜŒœÈ‚ˆ	Ù[XYÙT™]šY]ßIÜÚÚ[™\ØÜš\[ÛŸBˆÙ]‚ˆÂ‚‚ˆ]Û‹›Û˜ÛXÚÏJ
OOÂˆ™\\™PXİ[ÛŠˆÚÚ[šYˆ
NÂˆNÂ‚ˆB‚‚ˆY[K˜\[™Ú[
ˆ]Û‚ˆ
NÂ‚ˆJNÂ‚‚ˆÛÛœİ˜XÚÈBˆØİ[Y[˜Ü™X]Q[[Y[
ˆ˜]Ûˆ‚ˆ
NÂ‚‚ˆ˜XÚË˜Û\ÜÓ˜[YHBˆœİX‹X]ÛˆÂ‚‚ˆ˜XÚË^ÛÛ[Bˆº/å9fçˆÂ‚‚ˆ˜XÚË›Û˜ÛXÚÈBˆÛÜÙSY[\ÎÂ‚‚ˆY[K˜\[™Ú[
ˆ˜XÚÂˆ
NÂ‚‚ˆ	
›XZ[˜]SY[HŠBˆœİ[K™\Ü^HBˆ››Û™HÂ‚‚ˆ	
š][SY[HŠBˆ˜Û\ÜÓ\İˆœ™[[İ™JœÚİÈŠNÂ‚‚ˆ	
œÚÚ[Y[HŠBˆ˜Û\ÜÓ\İˆ˜Y
œÚİÈŠNÂ‚‚ˆÊ‚ˆ8¦!H9leze¢ù¢ : ïz`n9e«»ï#:$âù/cù *¹âjyc`ùfç¹d":,áú*"‹Âˆ9¢,:k)yí :c!:`¨ù. 9hb»ï#:+¤ùãªyk­¹g*9«å:/ ùi)ùæ¡9âb:gh¹."‚ˆ9£$y¢ : ï{ï#:`n9k£9¢%¹£"z/å9fç¹§ ú!ê¹båy¥-¹d"ˆ;ï"9¥-¹d":`£ú/+ùg*ÛÜÙSY[\Ê
{ï"xà ‚ˆ
‹Â‚ˆ	
œÚÚ[Y[HŠBˆ˜Û\ÜÓ\İˆ˜Y
™^[™YŠNÂ‚ŸB‚‚™[˜İ[ÛˆÜ[’][SY[J
^Â‚ˆYŠˆX˜]PXİ]™Hˆ]]Ğ˜]Bˆ
^Âˆ™]\›ÂˆB‚ˆÊˆ9¢,:k)z ã9c!y¦+ùãj9êâú)¡º$âùli;ï#9.#ya£yå*:""ˆ^[™Y9no¹/exà ˆ
‹ÂˆÛÛœİ]ZXÚĞ˜\I
œÚÚ[]ZXÚĞ˜\ˆŠNÂˆYŠ]ZXÚĞ˜\Š^Âˆ]ZXÚĞ˜\‹˜Û\ÜÓ\İœ™[[İ™JœÚİÈŠNÂˆB‚ˆ	
œÚÚ[Y[HŠBˆ˜Û\ÜÓ\İˆœ™[[İ™JœÚİÈŠNÂ‚ˆ	
œÚÚ[Y[HŠBˆ˜Û\ÜÓ\İˆœ™[[İ™J™^[™YŠNÂ‚ˆ˜]R][PØ]YÛÜOHœİ[ÛˆÂˆ™[™\˜]R][SY[J
NÂ‚ˆ	
š][SY[HŠBˆ˜Û\ÜÓ\İˆ˜Y
œÚİÈŠNÂ‚ˆŞ[˜Õ\›•[Y\•Ú]˜]TXÚÙ\œÊ
NÂ‚ŸB‚‚™[˜İ[ÛˆÛÜÙSY[\Ê
^Â‚ˆÛÛœİ]ZXÚĞ˜\Bˆ	
œÚÚ[]ZXÚĞ˜\ˆŠNÂ‚ˆYŠ]ZXÚĞ˜\Š^Âˆ]ZXÚĞ˜\‹˜Û\ÜÓ\İœ™[[İ™JˆœÚİÈ‚ˆ
NÂˆB‚ˆ	
œÚÚ[Y[HŠBˆ˜Û\ÜÓ\İˆœ™[[İ™JœÚİÈŠNÂ‚ˆ	
œÚÚ[Y[HŠBˆ˜Û\ÜÓ\İˆœ™[[İ™J™^[™YŠNÂ‚ˆÛÛœİ][SY[OI
š][SY[HŠNÂˆYŠ][SY[J^Âˆ][SY[K˜Û\ÜÓ\İœ™[[İ™JœÚİÈŠNÂˆB‚ˆŞ[˜Õ\›•[Y\•Ú]˜]TXÚÙ\œÊ
NÂ‚ŸB‚‚‹ÊˆOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOBˆ:%éy¬-OOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOH
‹Â‚‹Ê‚ˆ8¦!H9¥¬9h§»ï&ºf,¹é©¸à ‚‚ˆ:`n9¤áúf,¹é©¹æ¡:*l{ï#9§+9fç¹d"9.#y¥.ù¤â»ï#ˆ9/a¹£©y."ù/¡¹ *¹âjy¥.ù¤âºf£¹«­yl#z`&y`"ú)äº"lº`(9¢$9æ¡9`­ùk¬Âˆ9§ ùa£y¢dÍy¢¦;ï":-çúf,¹é©¹b¦ù®&ù`­ùå¢¹b¨;ï#9.#y¦+ùcå¹.èûï"xà ‚ˆ9¥b9§§9£ yî£9b,:`&y`"ú)äº"lº!ê¹mìyæ¡9."ù. 9fç¹d":e¢ùiâùà®¹«h‚ˆ;ï"™YÚ[Ú\˜Xİ\•\›Š
z(èy§ ù®!y£¢z`&y`"ùª&z*&;ï"xà ‚‚ˆ:-çİ\ÙTİ[ÛŠ
y. 9ª(ù.#yå*:`n9æë¹ª&{ï#ˆ:nç¹."ùc®ùæí9£©yå'ù¥b8à yíd9§gú`&y`"ú)äº"l¹æ¡:(c9båxà ‚Š‹Â‚‹Ê‚ˆ8¦!H9/ë¹«hûï&‚ˆ9¢¢¸à#9ç'ù«hùgíú(c:f,¹é©¸à#yæ¡:`£ú/+ù¢¯y¢$9ãj9êâùaïyo#ûï#ˆ9¢bùbåy£"zf,¹é©ºb%{ï"\ÙQY™[™

{ï#9§"zf,¹da¹ª¥9/cú!ê¹båyª(yo#ù."ú*©:)î;ï"Bˆ:-çú!ê¹båy¢,:k)z*+yk¦¹¢$:f,¹é©»ï"]]ĞXİ[ÛŠ
z(èyæí9£©ydo9cêûï"Bˆ9ajy¨§z-ëùo¤yalyå*:`&y`"ù¨.9oàú`£ú/+ûï#ˆ9.#y§ ùaî¹ãï¸à#:!ê¹båyª(yo#ú+¯¹¢$:f,¹é©¹cnú(ªúf,¹da¹¤âù/cù.#yå'ù¥b8à#yæ¡9ecúhc8à ‚Š‹Â‚‹Ê‚ˆ8¦!H9/ë¹«hûï"9ç'ùæ¡9¢¤ùb,9. 9`"ØYûï"{ï&‚ˆ^Y\Œ¹æ¡:!ê¹båy¥.ù¤â‹ù¢ : ï{ï"^Y\Œ“›Ü›X[]XÚøà BˆØ\İ^Y\Œ”ÚÚ[;ï"z`ïy.#y§ ú!ê¹mìydo9cêÂˆš[š\Ú^Y\Xİ[ÛŠ
x %8 %9å,X™YÚ[Ú\˜Xİ\•\›Š
Bˆ9æ¡:!ê¹båyb!¹­/º`£ú/+ùíly. 9g*9i%ºgh¹do9cêù. 9«(xà ‚‚ˆ9i ¹§§:`&z(èyæ¡:f,¹é©¹.gùg*9aiú`ê9do9cêÙš[š\Ú^Y\Xİ[ÛŠ
{ï#ˆ9i%ºghº`¨ù`"øà#9do9cêùk£^Y\Œ]]ĞXİ[ÛŠ
Bˆ9.bùo£9a£ydo9cêù. 9«(Yš[š\Ú^Y\Xİ[ÛŠ
xà#yæ¡:`£ú/+Âˆ9§ ú+¢¹¢$9do9cêùajy«({ï#9l#º!í:(c9båzh!¹n£ú(ªú-ìú&gøà Bˆ:)äº"l¹í(¹o%zc+ù. ¸à ‚‚ˆ9¢`9.éy¢á¹¢$9ajyli;ï&‚ˆÙ]Y™[™[™Ôİ]J
ycêº,¨:,«8à#:*+yk¦ºf,¹é©¹âà9¡bÊú*&:c!8à#{ï#ˆ9.#yë¨z`,¹.#z`,¹n©»ï&Âˆ\QY™[™Y™™Xİ

y¦+ùíi¸à#9§ ú!ê¹mìz,¨:,«9íd9§gú(c9båxà#Bˆ9æ¡9do9cêú !yå*;ï"9¢bùbåzf,¹é©¸à \^Y\Œz!ê¹båzf,¹é©»ï"{ï#ˆ9aiú`ê9¢cydo9cêÙš[š\Ú^Y\Xİ[ÛŠ
xà ‚ˆ^Y\Œ]]ĞXİ[ÛŠ
yæ¡:f,¹é©¹b!¹¥+ùbaùæí9£©ydo9cêÂˆÙ]Y™[™[™Ôİ]J
{ï#:+¤ùi%¹li9íly. 9do9cêÂˆš[š\Ú^Y\Xİ[ÛŠ
{ï#9í«y£ z-çùam¹.åœ^Y\Œ‚ˆ:!ê¹båz(c9båz-ëùo¤y. :!í9æ¡9do9cêù¥®yo#øà ‚Š‹Â‚™[˜İ[ÛˆÙ]Y™[™[™Ôİ]JÚ\˜Xİ\’[™^
^ÂˆÛÛœİXİ]™PÚ\˜Xİ\BˆÙ]\PÚ\˜Xİ\R[™^
Ú\˜Xİ\’[™^
NÂ‚‚ˆYŠXXİ]™PÚ\˜Xİ\Š^Âˆ™]\›ÂˆB‚‚ˆXİ]™PÚ\˜Xİ\‹š\ÑY™[™[™ÏBˆYNÂ‚‚ˆÊ‚ˆ8¦!H9/ë¹«hûï"9/§yáiù/oùå*: !z) y¬`»ï"{ï&‚ˆ:`&z(èyc§ù§+9§ úhcyi%¹cl9. :(c8à#9¤î¹aîºf,¹é©¹iïù¡bûï#ˆ9§+9fç¹d"9cåùb,9æ¡9`­ùk¬ù®&ùcb¸à#{ï#ˆ9/oùå*: !z)®¹o¥ù¬¤¹oáz) x %8 %:f,¹é©¹§"y¬¤¹§"yå'ù¥b;ï#ˆ9¡âz*l¹æí9£©ycãy¦(9g*8à#:(ªù¥.ù¤â¹¦`¹æ¡:`¨ù. :(c8à#{ï#ˆ9ª&z*.øà#;ï":f,¹é©¹âà9¡bù`­ùk¬ù®&ùcb»ï"xà#yl,yi(9.¡»ï#ˆ9.#zg :) ycé¹i%¹i&¹. :(c9.¢ùab9k¨ùdb¹æ¡:*"¹ køà ‚ˆ:`&z(èy¢ïù£¢z`&z(cÙûï#9¥b9§§9§+:.ªÂˆ;ï"\ÑY™[™[™Ï]Y{ï"z`¡9¦+ùáiùn.9ieùå*8à ‚ˆ
‹Â‚ˆ\]URJ
NÂ‚ŸB‚‚™[˜İ[Ûˆ\QY™[™Y™™Xİ
Ú\˜Xİ\’[™^
^Â‚ˆÙ]Y™[™[™Ôİ]JˆÚ\˜Xİ\’[™^ˆ
NÂ‚‚ˆš[š\Ú^Y\Xİ[ÛŠ
NÂ‚ŸB‚‚™[˜İ[Ûˆ\ÙQY™[™

^ÂˆÛÛœİ]]ÓÛBˆXİ]™P˜]PÚ\˜Xİ\’[™^OOLˆÈ]]Ğ˜]BˆˆÙ]\P]]ĞÛÛ™šYÊXİ]™P˜]PÚ\˜Xİ\’[™^
K™[˜X›YÂ‚ˆÛÛœİXİ]™PÚ\˜Xİ\BˆÙ]\PÚ\˜Xİ\R[™^
Xİ]™P˜]PÚ\˜Xİ\’[™^
NÂ‚‚ˆYŠˆX˜]PXİ]™Hˆ]]ÓÛˆˆXİ[Û”™XYHˆXXİ]™PÚ\˜Xİ\ˆˆXİ]™PÚ\˜Xİ\‹šLˆ
^Âˆ™]\›ÂˆB‚‚ˆÊ‚ˆ8¦!H9/ë¹«hûï"9ç'ùæ¡9¢¤ùb,9ajy`"ØYûï"{ï&‚‚ˆKˆ:`&z(èyc§ù§+9cê¸à#9ª¨¹§éxà#XXİ[Û”™XY{ï#ˆ9o§¹/¡¹¬¤¹§"xà#:*+yk¦¸à#XXİ[Û”™XYO]Y{ï#ˆ9ëby¥¯:`&z`dúf,¹da¹oh¹d#:&fú*+x %8 %ˆ9¢bù£!ù£"yoêù. :nç»ï#9ë+9.£9«(znç¹¤â¹§ ùg*ˆš[š\Ú^Y\Xİ[ÛŠ
yç'ù«hù¢¢¹âà9¡búc¥¹/cù.bùbcBˆ9l,yab:eåºeç9¢$9b§ûï#9l#º!í9d#9. 9`"ú)äº"l¹æ¡:(c9båBˆ:(ªùk¨ùdb¹ajy«(xà z`,¹n©º(ªù£ª:`,¹ajy«({ï#ˆ9o£:gh¹æ¡:)äº"l‹ù *¹âjyæ¡9gíú(c:h!¹n£ùl,y¥m9`"úc+ù. »ï#ˆ:`&y«hù¦+øà#9 *¹âjy¥.ù¤â¹ajy«(xà#z ã9o£9æ¡9ç'ù«hùc§ùfè8à ‚‚ˆ‹ˆ:)äº"l¹mì¹í¤ù«nù.¨{ï"L;ï"z`¡9¦+ú ïy£"zf,¹é©»ï#ˆ:`&z(èy.gù. 9/mz(ç9."ºf,¹da¸à ‚‚ˆ:`&z(èyg*9ç'ù«hùå'ù¥b9.bùbcyêâùb.úc¥¹/cØXİ[Û”™XY{ï#ˆ9ë+9.£9«(znç¹¤â¹§ ùæí9£©z(ªù."ºghº`¨ú`dÙİX\™9¤âù."ù/¡¸à ‚ˆ
‹Â‚ˆXİ[Û”™XYO]YNÂ‚‚ˆÊ‚ˆ8¦!H9/ë¹«hûï":aãz) {ï#9/§yáiù/oùå*: !y¦#¹è®¹£!ù«hûï"{ï&‚ˆ:f,¹é©¹.bùbcy¦+øà#9£"y.¡¹l,yêâùb.ùå'ù¥b8à#{ï#:-ìú`c¹k¨ùdb‹ùíd9ë¥ù­`yê"øà ‚ˆ9ãï¹g*9¥.y¢$:-çùam¹.åº(c9båy. 9ª(ùab9k¨ùdb¸à Bˆ9ëbyíd9ë¥úf£¹«­yáiù¥cù£múh!¹n£ù¢cyç'ù«hùå'ù¥b8 %8 %ˆ:få¹á-ºf,¹é©¹§+:.ªøà#9/çz+mùæ¡9¦+ù£©y."ù/¡¹cåùb,9æ¡9`­ùk¬øà#{ï#9.#yi*¹cåúh!¹n£ùolzgïûï#9/a¹ãªyk­¹¦#¹è®º) y¬`‚ˆ8à#9¢`9§"z(c9båz`ïz) z`myoª¹d#9. 9ieùk¨ùdb‹ùíd9ë¥ùªgùb-¸à#{ï#ˆ9.#z) y§"zf,¹é©º`&yê+¹âny/¢ûï#:`&z(èyl,yáiù`f¸à ‚ˆ
‹Â‚ˆ]Y]YY^Y\Xİ[ÛœÖÂˆXİ]™P˜]PÚ\˜Xİ\’[™^ˆO^Â‚ˆXİ[Ûˆ™Y™[™‹‚ˆ\™Ù]›[‚ˆNÂ‚‚ˆ\]URJ
NÂ‚ˆš[š\Ú^Y\Xİ[ÛŠ
NÂ‚ŸB‚‚™[˜İ[Ûˆ\ÙTİ[ÛŠİ[Û’Y
^Â‚ˆÊ‚ˆL{ï&¹¢,:k)yk¨ùdb¹æí9£©z*&9/cøà#9dê¹. 9äí¸à#z%éy¬-;ï#ˆ9.#ya£ycêº*&ÜÜ:hg¹g¢øà ¹ç'ù«hù¢hú ã9c!y¥n:aãú"!Âˆ9æo¹b!¹«å9 h¹oªy.ãyåfyg*9¥cù£mù£¤¹n£ùo£9æ¡9íd9ë¥úf£¹«­xà ‚ˆ
‹Â‚ˆÛÛœİYš[š][ÛYÙ]İ[Û‘Yš[š][ÛŠİ[Û’Y
NÂ‚ˆYŠYYš[š][ÛŠ^Âˆ™]\›ÂˆB‚ˆÛÛœİ]]ÓÛBˆXİ]™P˜]PÚ\˜Xİ\’[™^OOLˆÈ]]Ğ˜]BˆˆÙ]\P]]ĞÛÛ™šYÊXİ]™P˜]PÚ\˜Xİ\’[™^
K™[˜X›YÂ‚ˆYŠˆX˜]PXİ]™Hˆ]]ÓÛˆˆXİ[Û”™XYBˆ
^Âˆ™]\›ÂˆB‚ˆÛÛœİXİ]™PÚ\˜Xİ\BˆÙ]\PÚ\˜Xİ\R[™^
Xİ]™P˜]PÚ\˜Xİ\’[™^
NÂ‚ˆYŠˆXXİ]™PÚ\˜Xİ\ˆˆXİ]™PÚ\˜Xİ\‹šLˆ
^Âˆ™]\›ÂˆB‚ˆYŠÙ]İ[ÛÛİ[
İ[Û’Y
OL
^ÂˆY˜]SÙÊˆYš[š][Û‹›˜[YJÂˆ¹æë¹bcy¬¤¹§"ynªùkf8à ˆ‚ˆ
NÂˆ™[™\˜]Tİ[Û“Y[J
NÂˆ™]\›ÂˆB‚ˆÛÛœİİ]ÏBˆÙ]\P˜]Tİ]ÊXİ]™P˜]PÚ\˜Xİ\’[™^
NÂ‚ˆYŠˆYš[š][Û‹œ™\Ûİ\˜ÙOOOHšˆ	‰‚ˆXİ]™PÚ\˜Xİ\‹š\İ]Ë›X^ˆ
^ÂˆY˜]SÙÊ’9mì¹í¤ù¦+ù®ïùæ¡8à ˆŠNÂˆ™]\›ÂˆB‚ˆYŠˆYš[š][Û‹œ™\Ûİ\˜ÙOOOHœÜˆ	‰‚ˆXİ]™PÚ\˜Xİ\‹œÜ\İ]Ë›X^Ôˆ
^ÂˆY˜]SÙÊ”Ô9mì¹í¤ù¦+ù®ïùæ¡8à ˆŠNÂˆ™]\›ÂˆB‚ˆXİ[Û”™XYO]YNÂ‚ˆ]Y]YY^Y\Xİ[ÛœÖÂˆXİ]™P˜]PÚ\˜Xİ\’[™^ˆO^ÂˆXİ[Ûˆœİ[Ûˆ‹ˆİ[Û’Yœİ[Û’Yˆ\™Ù]›[ˆNÂ‚ˆÛÜÙSY[\Ê
NÂˆ\]URJ
NÂˆš[š\Ú^Y\Xİ[ÛŠ
NÂŸB‚‚™[˜İ[Ûˆ\Tİ[Û‘Y™™Xİ
İ[Û’YÚ\˜Xİ\’[™^
^Â‚ˆÛÛœİYš[š][ÛYÙ]İ[Û‘Yš[š][ÛŠİ[Û’Y
NÂ‚ˆYŠYYš[š][ÛŠ^ÂˆY˜]SÙÊ¹¢o¹.#yb,:`&y`"ú%éy¬-:,áù¥¦xà ˆŠNÂˆš[š\Ú^Y\Xİ[ÛŠ
NÂˆ™]\›ÂˆB‚ˆÛÛœİXİ]™PÚ\˜Xİ\BˆÙ]\PÚ\˜Xİ\R[™^
Ú\˜Xİ\’[™^
NÂ‚ˆYŠXXİ]™PÚ\˜Xİ\Š^Âˆš[š\Ú^Y\Xİ[ÛŠ
NÂˆ™]\›ÂˆB‚ˆÛÛœİİ]ÏBˆÙ]\P˜]Tİ]ÊÚ\˜Xİ\’[™^
NÂ‚ˆÛÛœİX^˜[YOBˆYš[š][Û‹œ™\Ûİ\˜ÙOOOHš‚ˆÈİ]Ë›X^ˆˆİ]Ë›X^ÔÂ‚ˆÛÛœİİ\œ™[˜[YOBˆYš[š][Û‹œ™\Ûİ\˜ÙOOOHš‚ˆÈXİ]™PÚ\˜Xİ\‹šˆˆXİ]™PÚ\˜Xİ\‹œÜÂ‚ˆYŠİ\œ™[˜[YO[X^˜[YJ^ÂˆY˜]SÙÊˆ
Yš[š][Û‹œ™\Ûİ\˜ÙOOOHšˆÈ’ˆˆ”ÔŠJÂˆ¹mì¹í¤ù¦+ù®ïùæ¡8à ˆ‚ˆ
NÂˆš[š\Ú^Y\Xİ[ÛŠ
NÂˆ™]\›ÂˆB‚ˆYŠÙ]İ[ÛÛİ[
İ[Û’Y
OL
^ÂˆY˜]SÙÊˆYš[š][Û‹›˜[YJÂˆ¹æë¹bcy¬¤¹§"ynªùkf8à ˆ‚ˆ
NÂˆš[š\Ú^Y\Xİ[ÛŠ
NÂˆ™]\›ÂˆB‚ˆ][›™Y™XÛİ™\NÂ‚ˆYŠYš[š][Û‹œ™XÛİ™\T\˜Ù[LL
^Âˆ[›™Y™XÛİ™\O[X^˜[YKXİ\œ™[˜[YNÂˆY[Ù^Âˆ[›™Y™XÛİ™\OSX]›X^
ˆKˆX]œ›İ[™
ˆX^˜[YJ‚ˆYš[š][Û‹œ™XÛİ™\T\˜Ù[ÂˆLˆ
Bˆ
NÂˆB‚ˆÛÛœİ™XÛİ™\™YSX]›X^
ˆˆX]›Z[ŠˆX^˜[YKXİ\œ™[˜[YKˆ[›™Y™XÛİ™\Bˆ
Bˆ
NÂ‚ˆYŠ™XÛİ™\™YL
^Âˆš[š\Ú^Y\Xİ[ÛŠ
NÂˆ™]\›ÂˆB‚ˆYŠXÛÛœİ[YTİ[Û‘œ›ÛR[™[ÜJİ[Û’YJJ^ÂˆY˜]SÙÊˆYš[š][Û‹›˜[YJÂˆ¹¢húfi9i,y¥eøà ˆ‚ˆ
NÂˆš[š\Ú^Y\Xİ[ÛŠ
NÂˆ™]\›ÂˆB‚ˆYŠYš[š][Û‹œ™\Ûİ\˜ÙOOOHšŠ^ÂˆXİ]™PÚ\˜Xİ\‹šSX]›Z[Šˆİ]Ë›X^ˆXİ]™PÚ\˜Xİ\‹š
Ü™XÛİ™\™Yˆ
NÂ‚ˆÚİÔ^Y\’]
ˆ™XÛİ™\™YˆšX[‹ˆÚ\˜Xİ\’[™^ˆYBˆ
NÂˆY[Ù^ÂˆXİ]™PÚ\˜Xİ\‹œÜSX]›Z[Šˆİ]Ë›X^ÔˆXİ]™PÚ\˜Xİ\‹œÜ
Ü™XÛİ™\™Yˆ
NÂ‚ˆÚİÔ^Y\’]
ˆ™XÛİ™\™YˆœÜ‹ˆÚ\˜Xİ\’[™^ˆYBˆ
NÂˆB‚ˆY˜]SÙÊˆ
Xİ]™PÚ\˜Xİ\‹šY¹/hŠJÂˆ¹/oùå*ŠÂˆYš[š][Û‹›˜[YJÂˆ»ï#9 h¹oªHŠÂˆ™XÛİ™\™Y
ÂˆˆŠÂˆYš[š][Û‹œ™\Ûİ\˜ÙKÕ\\Ø\ÙJ
JÂˆ¸à ˆ‚ˆ
NÂ‚ˆ\]URJ
NÂˆØ]™QØ[YJ
NÂˆš[š\Ú^Y\Xİ[ÛŠ
NÂŸB‚‚‹ÊˆOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOBˆ:!ê¹båy¢,:k)BOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOH
‹Â‚™[˜İ[ÛˆÙÙÛP]]Ğ˜]J
^Â‚ˆÊ‚ˆ8¦!H9/ë¹«hûï"9/§yáiù/oùå*: !z) y¬`»ï#:+¤ùmèz`£úh zgh¹æ¡ˆ:!ê¹båy¢,:k)y£"zb%y.gú ïyå*;ï"{ï&‚ˆ9c§ù§+:`&z(èze¢úh+yl,y¦+øà#9.#yg*9¢,:k)y.+yl,yæí9£©Bˆ™]\›¸à#{ï#9l#º!í9g*9g,9g%»ï#ùmèz`£úh zgh¹£"z`&zha‚ˆ9£"zb%yk£9aj9¬¤¹§"y.îù/eycãy¡âx %8 %9/a¹ãªyk­¹§ ù ìùg*ˆ9¢,:k)y.bùi%»ï#9ab9¢¢¸à#9."ù. 9h-9¢,:k)z) y.#z) z!ê¹båxà#Bˆ:`&y`"ù`cùioz*+yk¦¹io{ï#9.#zg :) yç'ùæ¡9.®¹g*9¢,:k)z(èBˆ9¢cz ïz*¯ù¥m8à ‚‚ˆ9¢ïù£¢z`&y`"úe¢úh+yæ¡9¤âù§où.bùo£;ï#9."úgh¹æ¡:`£ú/+Âˆ;ï"9¥.X]]Ğ˜]xà yd#9«iX]]ĞÛÛ™šYË™[˜X›Y;ï#Âˆ]]ĞÛÛ™šYÌ‹™[˜X›Y8à y¦í9¥¬9£"zb%y¥¡ùkeøà Bˆ9kêù. :(c9¢,:k)yí :c!;ï"yg*9.#yg*9¢,:k)y.+ygíú(c:`ïy¦+Âˆ9k¢yaj9æ¡8 %8 %]]ĞÛÛ™šYË™[˜X›Y9§+9/¡¹l,y¦+Âˆ8à#9."ù. 9h-9¢,:k)z) y¬¯ùå*9æ¡:*+yk¦¸à#{ï#İ\˜]J
Bˆ:e¢ù¥¬9¢,:k)y¦`¹§ ú!ê¹mìz+ :`&y`"ù`/;ï#9¢`9.éyg*9¢,:k)yi%‚ˆ:*¯ù¥m;ï#9¥b9§§9l,y¦+øà#9ab:*+yk¦¹io{ï#9."ù. 9h-:!ê¹båyå'ù¥b8à#{ï#ˆ:-çùc§ù§+:*+z*"9æ¡9å*:`%9k£9aj9. :!í8à ‚ˆ9§ 9."úghº`¨ù«­xà#9k¨ùdbºf£¹«­yk¢yaj9£©y¢bøà#yæ¡:`£ú/+Âˆ9§+:.ªù§"X˜]T\Ù{ï#Ø˜]PXİ]™zfæzaãyª¨¹§é{ï#ˆ9.#yg*9¢,:k)y.+ygíú(c9.gù.#y§ ù§"y.îù/eybkù/g9å*8à ‚ˆ
‹Â‚ˆ]]Ğ˜]HBˆX]]Ğ˜]NÂ‚‚ˆÊ‚ˆ8¦!H9¥¬9h§»ï"9/§yáiù/oùå*: !z) y¬`»ï"{ï&‚ˆ9b!ù£æú!ê¹båy¢,:k)yæ¡9åm¹."ûï#9êâùb.úaãy¥¬9b)9¥­Âˆ9fç¹d":,áú*"¹b%ûï#ù¢,:k)y£!ù.é9£"zb%z) y.#z) zhkùé.¸ %8 %ˆ9¢dúe¢ú!ê¹båy¢,:k)y¦`¹¡âz*lºi«9."º%ãú-mù/¡»ï"9.#yå*ˆ9ëbyb,9."ù. 9«(YXÛ\™KÜ™\ÛÛ™yb!ù£æù¢cyå'ù¥b;ï"{ï#ˆ:eç9£¢y h¹oªy¢bùbåy¦`»ï#9i ¹§§9ãï¹g*9bfùioy¦+ùk¨ùdb‚ˆ:f£¹«­xà z/*¹b,9ãªyk­º!ê¹mìz`n;ï#9.gú) yêâùb.úhkùé.‚ˆ9aî¹/¡»ï#9.#z ïz+¤ùãªyk­¹l#z$eú%ãú-mù/¡¹æ¡9£"zb%Bˆ9.#yçéz`dú) znç¹dêº(èxà ‚ˆ
‹Â‚ˆ\]PXİ[Û’Yš\ÚXš[]J
NÂ‚‚ˆÊ‚ˆ8¦!H9/ë¹«hûï&‚ˆ9c§ù§+:`&z(èycê¹¥.y.¡¹§+9h-9¢,:k)yå*9æ¡]]Ğ˜]{ï#ˆ9¬¤¹§"yd#9«iyfçˆ]]ĞÛÛ™šYË™[˜X›Y;ï#ˆ9l#º!í9."ù. 9h-9¢,:k)ze¢ùiâù¦`‚ˆİ\˜]J
H9§ ùå*9..ùgãº*+yk¦¹æ¡ˆ]]ĞÛÛ™šYË™[˜X›Y:aãy¥¬:)¡º$âûï#ˆ9i ¹§§9ãªyk­¹¬¤¹§"ycé¹i%¹c®ù..ùgã¹bïº`n;ï#ˆ9ë+9.£9h-9l,y§ ú+¢¹fç¹¢bùbå{ï#9ç"ú-mù/¡¹`ãøà#:!ê¹båy¢,:k)yi,y¥b8à#xà ‚ˆ:`&z(èyd#9«iy¦í9¥¬:*+yk¦»ï#9.)¹.%:h!¹/¯ùd#9«iBˆ9..ùgãº`¨ù`"ØÚXÚØ›Ş9æ¡9åjúgh»ï#ˆ:`&yª(ùb!ù£æù. 9«(y.bùo£9.bùo£9«ãù. 9h-:`ïy§ ù¬¯ùå*8à ‚ˆ
‹Â‚ˆ]]ĞÛÛ™šYË™[˜X›YBˆ]]Ğ˜]NÂ‚‚ˆÊ‚ˆ8¦!H9/ë¹«hûï"9ç'ùæ¡9¢¤ùb,9. 9`"ØYûï"{ï&‚ˆ:`&z(èyc§ù§+9k£9aj9¬¤¹§"ybåyb,]]ĞÛÛ™šYÌ‹™[˜X›Y;ï#ˆ9ëby¥¯:`&zha¹alyå*9æ¡8à#9egùbåKù`g9«h¸à#y£"zb%Bˆ9¬.:`h9cê¹£©ùb-¹ë+9. :)äº"l»ï#ˆ9ë+9.£:)äº"l¹æ¡:!ê¹båy¢,:k)ze¢úeç9o§ºh+yb,9l/¹¬¤º(ªùè¬:`c»ï#ˆ9. 9æí9í«y£ yg*:h$:*+yæ¡:eç:e¢yâà9¡bø %8 %ˆ:`&y«hù¦+øà#9cê¹§"zgd¹hª9§lyæ¡ù§ ú!ê¹bå{ï#:gd¹¬-9.#y§ øà#Bˆ9æ¡9ç'ù«hùc§ùfè8à ‚‚ˆ9ãï¹g*9cê¹§"y. :ha¹alyå*9£"zb%{ï#9¬¤¹§"ycé¹i%¹æ¡ˆ\‹XÚ\˜Xİ\ºe¢úeç9cëù.éyb!¹b)y£"{ï#ˆ9d"9ä!¹æ¡:(c9à®¹¡âz*l¹¦+øà#9. :cmz+¤ù¥m:f¢º`ïz!ê¹båKú`ïy¢bùbåxà#{ï#ˆ9¢`9.éz`&z(èz+¤ùë+9.£:)äº"l»ï"9i ¹§§9kf9g*;ï"Bˆ:-çú$eùë+9. :)äº"l¹æ¡9âà9¡bù. :-mùb!ù£æøà ‚ˆ
‹Â‚ˆYŠ^Y\ŒŠ^Â‚ˆ]]ĞÛÛ™šYÌ‹™[˜X›YBˆ]]Ğ˜]NÂ‚ˆB‚ˆYŠ^Y\ŒÊ^Â‚ˆ]]ĞÛÛ™šYÌË™[˜X›YBˆ]]Ğ˜]NÂ‚ˆB‚‚ˆÛÛœİÛYPÚXÚØ›ŞBˆ	
˜]]Ñ[˜X›YŠNÂ‚‚ˆYŠÛYPÚXÚØ›Ş
^Â‚ˆÛYPÚXÚØ›Ş˜ÚXÚÙYBˆ]]Ğ˜]NÂ‚ˆB‚‚ˆÛÛœİ^Y\ŒÚXÚØ›ŞBˆ	
˜]]Ñ[˜X›Y^Y\ŒˆŠNÂ‚‚ˆYŠ^Y\ŒÚXÚØ›Ş
^Â‚ˆ^Y\ŒÚXÚØ›Ş˜ÚXÚÙYBˆ]]Ğ˜]NÂ‚ˆB‚‚ˆXİ[Û”™XYOY˜[ÙNÂ‚ˆ[™[™ĞXİ[Û[[Â‚ˆYŠ]]Ğ˜]J^ÂˆÛX\˜]U\™Ù]Ù[Xİ[Û“[ÙJ
NÂˆÛX\Xİ]™PÚ\˜Xİ\’YÚYÚ

NÂˆBˆ[ÙHYŠˆ˜]PXİ]™H	‰‚ˆ˜]T\ÙOOOH™XÛ\™H‚ˆ
^ÂˆÊˆM{ï&¹o§º!ê¹båyb!ùfç¹¢bùbåy¦`»ï#9.#zaãy¥¬9egùbåyfç¹d"8à Bˆ9.#y¥.HXİ]™P˜]PÚ\˜Xİ\’[™^;ï&ùæí9£©yå*9åm¹."ùç'ù«hÂˆ9«hùg*9ëbyo¡y¤ãy/g9æ¡:)äº"lºhkùé.¹ì¥únàù¨aº"!ù¢ : ïyb%øà ˆ
‹ÂˆÛX\˜]U\™Ù]Ù[Xİ[Û“[ÙJ
NÂˆ\]PXİ]™PÚ\˜Xİ\’YÚYÚ

NÂˆÜ[]TÚÚ[]ZXÚĞ˜\Š
NÂˆB‚‚ˆ\]P]]Ğ]ÛŠ
NÂ‚‚ˆY˜]SÙÊ‚ˆ]]Ğ˜]BˆÂˆº!ê¹båy¢,:k)ze¢ùiâûï"9."ù. 9h-9.gù§ ù¬¯ùå*9«i:*+yk¦»ï"xà ˆ‚ˆ‚ˆ¸£îH9mì¹`g9«hº!ê¹båy¢,:k)xà ˆ‚‚ˆ
NÂ‚‚ˆÊ‚ˆ8¦!H9/ë¹«hûï"9ç'ùæ¡9¢¤ùb,9.¡»ï#:`&y«(yæ¡:fi:c+ú*"¹ kÂˆ9æí9£©y¢¢¹aaù¢bù¢¤ùaî¹/¡¹.¡»ï"{ï&‚‚ˆ:`&z(èyc§ù§+8à#:aãy¥¬9egùbåz!ê¹båy¢,:k)y¦`»ï#ˆ\ùo£9o-ùb-¹do9cêù. 9«(X]]ĞXİ[ÛŠ
xà#{ï#ˆ9¦+ùo¢9¥êy.bùbcyà®¹.¡º)èù¬n¸à#:!ê¹båy¢,:k)ychy/cøà#Bˆ9åfy."ùæ¡9«"¹k§9.bú*"8 %8 %9/a˜]]ĞXİ[ÛŠ
Bˆ9¦+øà#9ë+9. :)äº"l¹k¨ùdbºf£¹«­xà#yl"9å*9æ¡9aïyo#ûï#ˆ:`&z(èyk£9aj9¬¤¹§"yª¨¹§éyåm¹."ûï&‚ˆH9ãï¹g*9¦+ùk¨ùdbºf£¹«­z`¡9¦+ùíd9ë¥úf£¹«­Bˆ;ï"˜]T\Ù{ï"BˆH9ãï¹g*9ç'ùæ¡:/*¹b,9ë+9. :)äº"l¹k¨ùdb¹eã‚ˆ;ï"Xİ]™P˜]PÚ\˜Xİ\’[™^;ï"BˆH:!ê¹á-¹æ¡9­`yê"ù§+:.ªù¦+ù.#y¦+ù¨.y§+9¬¤¹chy/cûï#ˆ9cê¹¦+ùãªyk­º!ê¹mìy¢bùæh¹£"y.¡¹`g9«h‹ùegùbåB‚ˆ9cêº) yãªyk­¹g*9k¨ùdbºf£¹«­y/aº/*¹b,8à#9®!y¬-9¢,8à#Bˆ9k¨ùdb¹¦`¹£"y.¡¹`g9«h¹câ9egùbå{ï#\ùo£:`&y«­Bˆ9§ ù.#yë¨y."y. ù.£9c`y. 9æí9£©ydo9cêØ]]ĞXİ[ÛŠ
Bˆ;ï"9njùë+9. :)äº"l¹k¨ùdb¹. 9«(xà y.)¹do9cêù. 9«(Bˆš[š\Ú^Y\Xİ[ÛŠ
{ï"{ï#9ëby¥¯9g*ˆXİ]™P˜]PÚ\˜Xİ\’[™^:`¡9¬¤¹ç'ù«hÂˆ:/*¹b,9ë+9. :)äº"l¹æ¡9 áy¬ày."ûï#9èk9¦+ù¢¢¹k ùo 9bcBˆ9i&¹£ª9.¡¹. 9«ix %8 %:`&y«hù¦+øà#9k¨ùdbºf£¹«­z#ªùd#yam¹i¦Bˆ9i&¹aî¹. 9«(Yš[š\Ú^Y\Xİ[ÛŠ
xà Bˆ9®!y¬-9¢,9æ¡9k¨ùdbº(ªú-ìú`c¸à \]Y]YY:+¢¹ên¸à#Bˆ9æ¡9ç'ù«hùc§ùfè8à ¹i ¹§§9bfùioyæo9å'ùg*9íd9ë¥úf£¹«­{ï#ˆ9. 9ª(ù§ ú+¤Ú[š]X]]™R[™^:(ªùi&¹£ª9. 9«i{ï#ˆ:-ìú`cº*lº/*¹b,9æ¡9."ù. 9/cxà ‚‚ˆ9ãï¹g*9mì¹í¤ù¢¢¸à#9¢bùbåKú!ê¹båyª(yo#ù."ûï#Ô9.#z-¬øà Bˆ9l&¹§*¹kn9ïä¹ëbyb!¹¥+ù¯#ùdo9cêÙš[š\Ú^Y\Xİ[ÛŠ
xà#Bˆ:`&y.¦ùç'ù«hù§ ú+¤ù­`yê"ùchy«nùæ¡9¯#ù­'º`ïz(ç9."¹.¡»ï#ˆ9«hùn.9 áy¬ày."ú!ê¹á-¹æ¡9k¨ùdb‹ùíd9ë¥úcâ9.#y§ ùa£Bˆ9á(z l¹chy/cûï#:`&y`"øà#9i%º`ê9èk:.(¹. 9«(xà#yæ¡ˆ9«"¹k§9.bú*"9mì¹í¤ù.#zg :) xà z #9.%9¦+ù..ùbåyæ¡ˆ9clyk¬ù/¡¹®¤;ï#9æí9£©y¢ïù£¢xà ‚‚ˆ9b!ù£æú!ê¹båy¢,:k)yãï¹g*9cê¹e«¹í%9¥.Bˆ]]Ğ˜]KØ]]ĞÛÛ™šYú`&y.¦ùâà9¡bù¥åùª&{ï#ˆ9."ù. 9«(X™YÚ[Ú\˜Xİ\•\›Š
z!ê¹á-¹gíú(c9b,ˆ9æ¡9¦`¹`&{ï#9§ ú!ê¹mìz+ 9b,9¥¬9æ¡]]ÓÛ¹`/8à Bˆ9«hùè®¹b)9¥­ú) y.#z) z!ê¹båyaî¹¢bøà ‚‚ˆ8¦!H9/a»ï"9/§yáiù/oùå*: !yké¹®+9fç¹h,{ï#:(ç9fç¹. 9`"Âˆ9d"9ä!¹/aº) y`f¹l#yæ¡:(c9à®»ï"{ï&‚ˆ9i ¹§§9b!ù£æùæ¡9åm¹."ûï#9bfùioychyg*8à#9k¨ùdbºf£¹«­{ï#ˆ9«hùg*9ëby§ä9`"ú)äº"l¹¢bùbåz/.9aixà#{ï":`¨ù`"ú)äº"l¹æ¡ˆŒ9éäº*"9¦`¹fj9«hùg*:-ä{ï"{ï#9ãªyk­¹¢¢º!ê¹båy¢dúe¢ûï#ˆ9æí:)®¹§ ù§'ùo¡xà#:`&y`"ù«hùg*9ëby¢$yæ¡:)äº"l»ï#ˆ9ãï¹g*:i«9."º!ê¹båynjù¢$z`n8à#x %8 %9.#z ïy.à:n¯:`ïy.#y`f»ï#ˆ9.#yá-º) yf&ùcêº ïyëbLŒ9éäº`/¹¦`¸à z) yf&ùo¥ùab9`f¹k£ˆ:`&z/*¹¢bùbåz`n9¤áûï#:!ê¹båze¢úeç9ç"ú-mù/¡¹`ãù¬¤¹cãy¡âxà ‚‚ˆ:`&z(èz-çù¢ïù£¢yæ¡:""¹âb9§ 9i)ùmë¹b){ï&‚ˆKˆ9cê¹£©y¢bøà#9åm¹."ù«hùg*9ëbyo¡xà y.%9bfú(ªùb!ù¢$ˆ:!ê¹båxà#yæ¡:`¨ù. 9/c{ï#9.#y§ ù.#yb!ºgd¹í!yæ ¹æoBˆ9¬.:`h9do9cêÜ^Y\Œyæ¡]]ĞXİ[ÛŠ
xà ‚ˆ‹ˆ9gíú(c9bcyå*ÛÜİ\™z*&9/cùåm¹."ùæ¡ˆ˜]UÚÙ[¸à X˜]T\Ùxà BˆXİ]™P˜]PÚ\˜Xİ\’[™^;ï#ˆÙ][Y[İ]9ç'ù«hùgíú(c9æ¡:`¨ù. 9b.ûï#ˆ9."y`"ù¨§y.íº`ïz) zaãy¥¬9¨.9l#y. 9«(y¬¤¹§"z+¢º`c‚ˆ;ï"ÚÙ[¹¬¤¹£æù¥¬9¢,:k)xà z`¡9¦+ùk¨ùdbºf£¹«­xà Bˆ:`¡9¦+ùd#9. 9`"ú)äº"l¹g*9ëb{ï"x %8 %9i ¹§§9ãªyk­‚ˆ9g*:`&M\ùaiú!ê¹mìy¢bùbåz`n9k£9.¡»ï#ˆ9¢%¹­`yê"ù§+9/¡¹l,z!ê¹á-¹îo9î£9o 9."ú-l9.¡»ï#ˆ:`&z(èyæ¡9¨.9l#y§ ùi,y¥eûï#9æí9£©y.à:n¯:`ïy.#y`f»ï#ˆ9.#y§ ùæo9å'øà#9mì¹í¤ù§"y.®º`n:`c¹.¡»ï#:`&z(èBˆ9câ9èk9£ä¹. 9«(xà#yæ¡:aãz)!ù£ª:`,¸à ‚ˆ
‹Â‚ˆYŠˆ]]Ğ˜]H	‰‚ˆ˜]T\ÙOOOH™XÛ\™H‚ˆ
^Â‚ˆÛÛœİ^XİYÚÙ[Bˆ˜]UÚÙ[Â‚ˆÛÛœİ^XİYÚ\˜Xİ\’[™^BˆXİ]™P˜]PÚ\˜Xİ\’[™^Â‚ˆÙ][Y[İ]


OOÂ‚ˆYŠˆX˜]PXİ]™Hˆ˜]UÚÙ[ˆOOBˆ^XİYÚÙ[ˆˆ˜]T\ÙHOOBˆ™XÛ\™HŸˆXİ]™P˜]PÚ\˜Xİ\’[™^OOBˆ^XİYÚ\˜Xİ\’[™^ˆ
^Âˆ™]\›ÂˆB‚‚ˆ^Â‚ˆ]]ĞXİ[Û‘›ÜÚ\˜Xİ\Šˆ^XİYÚ\˜Xİ\’[™^ˆ^XİYÚÙ[‚ˆ
NÂ‚ˆBˆØ]Ú
\œ›ÜŠ^Â‚ˆÛÛœÛÛK™\œ›ÜŠˆ¹b!ù£æú!ê¹båy¢,:k)y¦`¹£©y¢bùk¨ùdb¹æo9å'ù/¢ùi%»ï&ˆ‹ˆ\œ›Ü‚ˆ
NÂ‚ˆB‚ˆK
NÂ‚ˆB‚ŸB‚‚™[˜İ[Ûˆ\]P]]Ğ]ÛŠ
^Â‚ˆÊ‚ˆ8¦!H9/ë¹«hûï"9/§yáiù/oùå*: !y£!ùk¦¹âb:gh»ï"{ï&‚ˆ9egùbåy.bùo£9£"zb%y¥¡ùkeù¥.y¢$8à#9`g9«h¸à#xà Bˆ9b¨9."˜Xİ]™yæ¡9í!z"l¹ª(ùo#ûï&Âˆ9méº`¢¹æ¡9ª&yìi9¥¡ùkeù.gú) z-çú$eù£æù¢$8à#:!ê¹båy¢,:k)y.+xà#xà ‚ˆ
‹Â‚ˆÛÛœİ]ÛBˆ	
˜]]Ğ˜]P]ÛˆŠNÂ‚‚ˆYŠ]ÛŠ^Â‚ˆ]Û‹^ÛÛ[B‚ˆ]]Ğ˜]BˆÂˆ¸£îH9`g9«hˆ‚ˆ‚ˆ¸¥­ˆ9egùbåHÂ‚‚ˆ]Û‹˜Û\ÜÓ\İÙÙÛJˆ˜Xİ]™H‹ˆ]]Ğ˜]Bˆ
NÂ‚ˆB‚‚ˆÛÛœİX™[Bˆ	
˜]]Ğ˜]SX™[ŠNÂ‚‚ˆYŠX™[
^Â‚ˆX™[^ÛÛ[B‚ˆ]]Ğ˜]BˆÂˆº!ê¹båy¢,:k)y.+H‚ˆ‚ˆº!ê¹båy¢,:k)HÂ‚ˆB‚‚ˆÊ‚ˆ8¦!H9¥¬9h§»ï"9/§yáiù/oùå*: !z) y¬`»ï#9mèz`£úh zgh¹æ¡ˆ:!ê¹båy¢,:k)zgh¹§oûï"{ï&‚ˆ:-çù."ºgh¹d#9. 9ieú`£ú/+ûï#9d#9«iy¦í9¥¬9mèz`£úh zgh‚ˆ:`¨ù.ïz!ê¹båy¢,:k)y£"zb%Kùª&yìi;ï#9è®¹/çyajz`¢‚ˆ:hkùé.¹æ¡9âà9¡bù¬.:`h9. :!í;ï#9.#y§ ùaî¹ãï¹¢,:k)Bˆ:h zghºhkùé.¸à#9`g9«h¸à#xà ymèz`£úh zgh¹cnú`¡:hkùé.‚ˆ8à#9egùbåxà#z`&yê+¹.#yd#9«iyæ¡9 áy¬àxà ‚ˆ
‹Â‚ˆÛÛœİX\]ÛBˆ	
›X\]]Ğ˜]P]ÛˆŠNÂ‚‚ˆYŠX\]ÛŠ^Â‚ˆX\]Û‹^ÛÛ[B‚ˆ]]Ğ˜]BˆÂˆ¸£îH9`g9«hˆ‚ˆ‚ˆ¸¥­ˆ9egùbåHÂ‚‚ˆX\]Û‹˜Û\ÜÓ\İÙÙÛJˆ˜Xİ]™H‹ˆ]]Ğ˜]Bˆ
NÂ‚ˆB‚‚ˆÛÛœİX\X™[Bˆ	
›X\]]Ğ˜]SX™[ŠNÂ‚‚ˆYŠX\X™[
^Â‚ˆX\X™[^ÛÛ[B‚ˆ]]Ğ˜]BˆÂˆº!ê¹båy¢,:k)y.+H‚ˆ‚ˆº!ê¹båy¢,:k)HÂ‚ˆB‚‚ˆÊ‚ˆ8¦!H9¥¬9h§»ï"9/§yáiù/oùå*: !z) y¬`»ï#8à#9mèy *ºh zgh‚ˆ9mé¹."º)ä¹¥¬9h§¹l#ù£"zb%{ï#:!ê¹båy¢,:k)yoêù£múe¢ùegËÂˆ9`g9«h¸à#{ï"{ï&‚ˆ:-çù."ºgh¹ajzha¹£"zb%yd#9. 9ieú`£ú/+ûï#9d#9«iy¦í9¥¬ˆ9mé¹."º)äº`&zha¹l#ùoêù£múb%{ï#9è®¹/çy."y`"ùg,9¥®Bˆ;ï"9¢,:k)zh zgh‹ùg,9g%º)¡º$âùliùmé¹."º)ä¹oêù£múb%{ï"Bˆ9¬.:`h:hkùé.¹. :!í9æ¡9âà9¡bøà º`&zha¹ãï¹g*9¥.y¢$ˆ9í%9g%¹é.ºb%{ï":e¢Ëúeç9d!9. 9o-y."¹`¬ùæ¡XÛÛ¹g%»ï"{ï#ˆ9.#ya£y¥/¹¥¡ùkeûï#9¥.yå*Xİ]™z`&y`"ØÛ\ÜÂˆ9b!ù£æú) zhkùé.¹dê¹. 9o-yg%»ï":)¢ĞÔÔÂˆ›X\\]ZXÚË]ÙÙÛKXˆšXÛÛ‹[Û»ï#ÂˆšXÛÛ‹[Ù™»ï"{ï#9.)ºfa9n-˜\šXK[X™[9¥®y/¯Âˆ9á(zf§9é&ze¬z+ ;ï#9.#z ïyæí9£©ykêİ^ÛÛ[ˆ;ï":`¨ùª(ù§ ù¢¢º(èzgh¹æ¡[YÏ¹kd9a`ùí(9¥m9`"Âˆ9­%ù£¢{ï#9g%¹é.¹§ ù­¢9i,{ï"xà ‚ˆ
‹Â‚ˆÛÛœİ]ZXÚĞ˜]PBˆ	
œ]ZXÚĞ]]Ğ˜]UÙÙÛHŠNÂ‚‚ˆYŠ]ZXÚĞ˜]PŠ^Â‚ˆ]ZXÚĞ˜]P‹œÙ]]šX]Jˆ˜\šXK[X™[‹‚ˆ]]Ğ˜]BˆÂˆº!ê¹båy¢,:k){ï":e¢ùegù.+{ï"H‚ˆ‚ˆº!ê¹båy¢,:k){ï":eç:e¢{ï"H‚ˆ
NÂ‚‚ˆ]ZXÚĞ˜]P‹˜Û\ÜÓ\İÙÙÛJˆ˜Xİ]™H‹ˆ]]Ğ˜]Bˆ
NÂ‚ˆB‚ŸB‚‚‹Ê‚ˆ8¦!H9¥¬9h§»ï&º!ê¹båy¢,:k)z*lùí,:*+yk¦ºgh¹§oûï"9leze¢ùâb;ï"xà ‚‚ˆÜ[]]Ğ˜]TÙ][™ÜÊ
{ï&¹leze¢úgh¹§oûï#ˆ:h$:*+yab:hkùé.¹ãªyk­Œyæ¡:*+yk¦¸à ‚‚ˆİÚ]Ú]]ÔÙ][™ÜĞÚ\˜Xİ\Š
{ï&¹b!ù£æú)äº"l¹¦`»ï#ˆ:aãy¥¬9hjùaixà#:!ê¹båz(c9båxà#y."ù¢âz`n9e«‚ˆ;ï"9¦kº`&¹¥.ù¤â‹úf,¹é©‹ú*lº)äº"lº(çy`¦yæ¡9¢ : ï{ï"{ï#ˆ9.)º/"yaiz*lº)äº"l¹æë¹bcyæ¡	KÔÔ	Kú!ê¹båyfç¹gãº*+yk¦¸à ‚‚ˆÛÛ™š\›P]]Ğ˜]TÙ][™ÜÊ
{ï&¹¢¢º(j9e«¹."¹æ¡9`/ˆ9kêùfç¹l#y¡âz)äº"l¹æ¡]]ĞÛÛ™šYËØ]]ĞÛÛ™šYÌ»ï#9kf9ª¥;ï#9¥-º-múgh¹§oøà ‚‚ˆÛÜÙP]]Ğ˜]TÙ][™ÜÊ
{ï&¹.#ya,¹kf;ï#9æí9£©y¥-º-múgh¹§oøà ‚Š‹Â‚‹Ê‚ˆ8¦!H9¥¬9h§»ï&º*&9/cú!ê¹båy¢,:k)z*+yk¦ºgh¹§oùc§ù§+ˆ;ï"9g*˜]TYÙz(è{ï"yæ¡9/cyïk»ï#Ü[]]Ğ˜]TÙ][™ÜÊ
Bˆ9¢¢¹k ù¦ªù¦`¹¤+9b,Øİ[Y[˜›Ùyn¥y."ù¦`º*&:c!;ï#ˆÛÜÙP]]Ğ˜]TÙ][™ÜÊ
zeç:e¢y¦`¹/§yáiú`&yajy`"ù`/ˆ9¤+9fç¹c§ù/cxà ‚Š‹Â‚›]]]ÔÙ][™ÜÓÜšYÚ[˜[\™[Bˆ[Â‚›]]]ÔÙ][™ÜÓÜšYÚ[˜[™^ÚX›[™ÏBˆ[Â‚‚™[˜İ[ÛˆÜ[]]Ğ˜]TÙ][™ÜÊ
^Â‚ˆÛÛœİ[™[Bˆ	
˜]]Ğ˜]TÙ][™ÜÔ[™[ŠNÂ‚‚ˆYŠ\[™[
^Âˆ™]\›ÂˆB‚‚ˆÊ‚ˆ8¦!H9¥¬9h§»ï"9/§yáiù/oùå*: !z) y¬`»ï#:+¤ùg,9g%»ï#ùmèz`£Âˆ:h zgh¹æ¡8à#:*+yk¦¸à#y£"zb%y.gú ïyå*;ï"{ï&‚ˆ:`&y`"úgh¹§oùc§ù§+9¦+Ø˜]TYÙyn¥y."ùæ¡ˆ9kd9a`ùí(;ï#9.#yg*9¢,:k)y.+yæ¡9¦`¹`&X˜]TYÙBˆ9¥m9`"Ù\Ü^N››Û™{ï#9l,yë¥ù¢¢ºgh¹§oú!ê¹mìyæ¡ˆ\Ü^y¥.y£¢{ï#9.gù§ ú(ªù¬¤¹§"Y\Ü^yæ¡ˆ9ée¹ab:$âù/cùç"ù.#z)¢ø %8 %:`&y«hù¦+øà#:*+yk¦¹£"zb%Bˆ9¬¤¹cãy¡âxà#yæ¡9ç'ù«hùc§ùfè8à ‚‚ˆ:`&z(èyg*8à#9.#yg*9¢,:k)y.+xà#yæ¡9 áy¬ày."ûï#9¢¢ºgh¹§oÂˆ:`&y`"ÑÓyëà:nç¹¦ªù¦`¹¤+9b,Øİ[Y[˜›Ùyn¥y."Âˆ;ï":` ùaî˜˜]TYÙz`¨ùli\Ü^N››Û™{ï"{ï#ˆ9.)¹ieùå*9."ºgh¹¥¬9h§¹æ¡›Ø][™Ë[[Ù[9ª(ùo#Âˆ;ï"9¥.y¢$ÜÚ][Û™š^Y8à z!ê¹mìyk¦¹/c{ï"xà ‚ˆ9¤+:-l9.bùbcyab:*&9/cùc§ù§+9æ¡9/cyïk‚ˆ;ï"]]ÔÙ][™ÜÓÜšYÚ[˜[\™[;ï#Âˆ]]ÔÙ][™ÜÓÜšYÚ[˜[™^ÚX›[™ûï"{ï#ˆÛÜÙP]]Ğ˜]TÙ][™ÜÊ
z(èy§ ù/§yáiÂˆ:`&yajy`"ù`/9¢¢¹k ù¤+9fç˜˜]TYÙyc§ù§+9æ¡ˆ9/cyïk»ï#9.#y§ ú+¤ùk ùo§¹«i9­¢9i,yg*˜]TYÙz(èxà ‚ˆ
‹Â‚ˆYŠˆX˜]PXİ]™H	‰‚ˆ[™[œ\™[›ÙHOOBˆØİ[Y[˜›ÙBˆ
^Â‚ˆ]]ÔÙ][™ÜÓÜšYÚ[˜[\™[Bˆ[™[œ\™[›ÙNÂ‚ˆ]]ÔÙ][™ÜÓÜšYÚ[˜[™^ÚX›[™ÏBˆ[™[›™^ÚX›[™ÎÂ‚‚ˆØİ[Y[˜›ÙK˜\[™Ú[
ˆ[™[ˆ
NÂ‚‚ˆ[™[˜Û\ÜÓ\İ˜Y
ˆ™›Ø][™Ë[[Ù[‚ˆ
NÂ‚ˆB‚‚ˆÛÛœİÚ\˜Xİ\”Ù[XİBˆ	
˜]]ÔÙ][™ÜĞÚ\˜Xİ\”Ù[XİŠNÂ‚‚ˆYŠÚ\˜Xİ\”Ù[Xİ
^Â‚ˆÊ‚ˆ8¦!H9/ë¹«hûï"9/§yáiù/oùå*: !y£!ù«hûï"{ï&‚ˆ9."ù¢âz`n:h!yc§ù§+9kêù«núhkùé.¸à#9ãªyk­Œxà#xà#9ãªyk­Œ¸à#{ï#ˆ:`¨ùcê¹¦+ù¢$z*ª¹¦#¹¦`º""y/¢ùå*9æ¡9.èùê,{ï#ˆ9/oùå*: !z) yæ¡9am¹ké¹¦+øà#:)äº"lº!ê¹mìyæ¡Q8à#{ï#ˆ:`&z(èy¥.y¢$9båy¡bùn-¹ai\^Y\‹šYÜ^Y\Œ‹šY8à ‚ˆ
‹Â‚ˆÛÛœİÜ[ÛŒBˆ	
˜]]ÔÙ][™ÜĞÚ\“Ü[ÛŒŠNÂ‚‚ˆYŠÜ[ÛŒ
^Â‚ˆÜ[ÛŒ^ÛÛ[B‚ˆ^Y\‹šYˆº)äº"lŒHÂ‚ˆB‚‚ˆÛÛœİÜ[ÛŒOBˆ	
˜]]ÔÙ][™ÜĞÚ\“Ü[ÛŒHŠNÂ‚‚ˆYŠÜ[ÛŒJ^Â‚ˆÜ[ÛŒK^ÛÛ[B‚ˆ^Y\Œ‚ˆÂˆ^Y\Œ‹šYˆ‚ˆº)äº"lŒ»ï"9l&¹§*¹bmynî»ï"HÂ‚ˆB‚‚ˆÊ‚ˆ9ãªyk­Œº`¡9¬¤¹bmynî¹æ¡:*l{ï#ˆ9."ù¢âz`n9e«º(èyab9.#yíiº`n;ï#ˆ:`oùacz`n9b,9. 9`"ù.#ykf9g*9æ¡:)äº"l¸à ‚ˆ
‹Â‚ˆYŠÜ[ÛŒJ^Â‚ˆÜ[ÛŒK™\ØX›YB‚ˆ\^Y\ŒÂ‚ˆB‚‚ˆÚ\˜Xİ\”Ù[Xİ˜[YOHŒÂ‚ˆB‚‚ˆÊ‚ˆ8¦!H9bfù¢dúe¢úgh¹§oûï#9åjúgh¹«!9/cy¦+ù."¹«(y«¦9åfyæ¡9aiùk®{ï#ˆ9.#y¦+ùãªyk­¹«hùg*9íê:/+ùæ¡9§lz)oûï#:`&z(èy`¬İYBˆ:-ìú`c¸à#9kf9fç¹."¹. 9`"ú)äº"l¸à#z`¨ù. 9«ixà ‚ˆ
‹Â‚ˆİÚ]Ú]]ÔÙ][™ÜĞÚ\˜Xİ\ŠYJNÂ‚‚ˆÊ‚ˆ8¦!H9/ë¹«hûï"9/§yáiù/oùå*: !z) y¬`»ï#:aãy¥¬:*+z*";ï"{ï&‚ˆ:*+yk¦ºgh¹§où¥.y¢$9ç'ù«hùæ¡8à#9§ 9."¹li:)¡º$âøà#{ï#ˆ9ëá9g#y¦+øà#9 *¹âjychyâc9."ùíèøà#yb,8à#9.®¹âjychyâc9."ùíèøà#{ï#ˆ9.#ya£y/§z,íÔÔùc®ùã':`&y`"ùëá9g#z*l¹i&ºjæ8 %8 %ˆ9æí9£©yå*”úaãùaîº`&yajy`"ú`¢¹åc9æ¡9kéºf¦ú'¨¹neyn©ùª&{ï#ˆ9å*ÜÚ][Û™š^Y9ì¯¹®¥¹l#zob»ï#ˆ9å¢¹¥/ºh!¹n£ù¢âyb,9§ :jæ;ï#9è®¹/çy. 9k¦¹§ ú$âùg*ˆ9¢`9§"y§lz)oùæ¡9§ 9."ºgh¸à ‚ˆ
‹Â‚ˆÊ‚ˆ8¦!H9/ë¹«hûï"9ç'ù«hù¢¤ùb,8à#:*+yk¦º-äyb,9§ 9."ºgh¸à#yæ¡ˆ9c§ùfè;ï"{ï&‚ˆ:`&y«­zaãù®+8à#9 *¹âjychyâc9."ùíèûïg¹.®¹âjychyâc9."ùíèøà#Bˆ9a£yå*:(c9aiùª(ùo#ùk¦¹/cyæ¡:`£ú/+ûï#9¦+ùà®¹.¡¹¢,:k)Bˆ:h zgh¹aiú*+z*"9æ¡;ï#9cnù¬¤¹§"yb)9¥­øà#9ãï¹g*9b,9n¥y¦+Âˆ9.#y¦+ùg*9¢,:k)zh zgh¸à#x %8 %9g*9g,9g%»ï#ùmèz`£úh zgh‚ˆ9¢dúe¢ú*+yk¦¹¦`»ï#˜˜]K[[Ûœİ\œûï#Âˆ˜˜]K\^Y\‹\›İú`&yajy`"ùa`ùí(:få¹á-º`¡9g*ˆÓz(è{ï#9/a˜˜]TYÙy¥m9li\Ü^N››Û™{ï#ˆ\Ü^N››Û™yæ¡9a`ùí(Ù]›İ[™[™ĞÛY[™Xİ

Bˆ:aãùaî¹/¡¹. 9o¢ù¦+ŞİÜŒ›İÛNŒ‹‹Ÿ{ï#ˆ9ëby¥¯:`&z(èy§ ù¢¢œ[™[œİ[KÜ9èk:*+y¢$ˆŒ¸à ZZYÚ:*+y¢$Œ¸ %8 %: #9.%:`&y¦+Âˆ:(c9aiùª(ùo#ûï#9a*¹ab9«"¹«å›Ø][™Ë[[Ù[:`¨ù`"ÂˆÔÔÈÛ\Üú`¡:jæ;ï#9l,yë¥ØÛ\Üù§"y«hùè®¹ieùå*;ï#ˆ9.gù§ ú(ªú`&z(èyæ¡:(c9aiùª(ùo#ú$âú`c¹c®ûï#:`&y¢cy¦+Âˆ:*+yk¦ºgh¹§oú-äyb,9åjúgh¹§ 9."ºgh¸à yç"ú-mù/¡¹ên¹ên¹æ¡ˆ9ç'ù«hùc§ùfè8à ‚‚ˆ9¥.y¢$9cê¹§"xà#9ç'ùæ¡9g*9¢,:k)y.+xà#y¢cygíú(c:`&y«­Bˆ:aãù®+9k¦¹/c{ï&ù.#yg*9¢,:k)y.+{ï"9g,9g%ºh zgh¹¢dúe¢ûï"Bˆ9æ¡:*lyk£9aj:-ìú`c»ï#9.©9íi™›Ø][™Ë[[Ù[ˆ:`¨ù`"ØÛ\Üú!ê¹mìyæ¡ÜÚ][Û™š^Y;ï#Âˆ›İÛN9c®ùk¦¹/c{ï#9.#y§ ùa£z(ªú`&z(èyæ¡ˆ:(c9aiùª(ùo#ú$âù£¢xà ‚ˆ
‹Â‚ˆYŠ˜]PXİ]™J^Â‚ˆÛÛœİ[Ûœİ\\™XOBˆØİ[Y[œ]Y\TÙ[XİÜŠˆ‹˜˜]K[[Ûœİ\œÈ‚ˆ
NÂ‚‚ˆÛÛœİ^Y\”›İÏBˆØİ[Y[œ]Y\TÙ[XİÜŠˆ‹˜˜]K\^Y\‹\›İÈ‚ˆ
NÂ‚‚ˆYŠˆ[Ûœİ\\™XH	‰‚ˆ^Y\”›İÂˆ
^Â‚ˆÛÛœİÜYÙOBˆ[Ûœİ\\™XBˆ™Ù]›İ[™[™ĞÛY[™Xİ

Bˆ˜›İÛNÂ‚‚ˆÛÛœİ›İÛQYÙOBˆ^Y\”›İÂˆ™Ù]›İ[™[™ĞÛY[™Xİ

Bˆ˜›İÛNÂ‚‚ˆ[™[œİ[KœÜÚ][ÛBˆ™š^YÂ‚ˆ[™[œİ[KÜBˆÜYÙJÈœÂ‚ˆ[™[œİ[K›YBˆœÂ‚ˆ[™[œİ[KœšYÚBˆœÂ‚ˆ[™[œİ[KšZYÚB‚ˆ
›İÛQYÙK]ÜYÙJJÂˆœÂ‚ˆ[™[œİ[K’[™^BˆNNNNHÂ‚ˆB‚ˆBˆ[Ù^Â‚ˆÊ‚ˆ8¦!H9.#yg*9¢,:k)y.+{ï&¹®!y£¢ycëú ïy«¦9åfyæ¡:(c9aiÂˆ9k¦¹/cyª(ùo#ûï"9/¢ùi ¹."¹. 9«(yg*9¢,:k)zh zghº(èBˆ9¢dúe¢ù¦`º*+z`c¹æ¡ÜÚZYÚ;ï"{ï#ˆ:+¤Ù›Ø][™Ë[[Ù[:`&y`"ØÛ\Üú ïyi(ˆ9«hùn.9å'ù¥b;ï#9.#z(ªù«¦9åfyæ¡:(c9aiùª(ùo#ùchy/cøà ‚ˆ
‹Â‚ˆ[™[œİ[KœÜÚ][ÛBˆˆÂ‚ˆ[™[œİ[KÜBˆˆÂ‚ˆ[™[œİ[K›YBˆˆÂ‚ˆ[™[œİ[KœšYÚBˆˆÂ‚ˆ[™[œİ[KšZYÚBˆˆÂ‚ˆ[™[œİ[K’[™^BˆˆÂ‚ˆB‚‚ˆ[™[œİ[K™\Ü^OBˆ™›^Â‚ŸB‚‚™[˜İ[ÛˆÛÜÙP]]Ğ˜]TÙ][™ÜÊ
^Â‚ˆÛÛœİ[™[Bˆ	
˜]]Ğ˜]TÙ][™ÜÔ[™[ŠNÂ‚‚ˆYŠ[™[
^Â‚ˆ[™[œİ[K™\Ü^OBˆ››Û™HÂ‚‚ˆÊ‚ˆ8¦!H9/ë¹«hûï"9/§yáiù/oùå*: !z) y¬`»ï#9¥.yå*ˆÜ[’ÛYQ™X]\™J
yob9ê¥úhkùé.º*+yk¦‚ˆ:gh¹§où.bùo£;ï"{ï&‚ˆ9i ¹§§:gh¹§oùæë¹bcy¦+ú(ªù`'ú`,¹ob9ê¥Âˆ;ï"ÚÛYQ™X]\™S[Ù[›Ù{ï"z(èzhkùé.¹æ¡ˆ8 %8 %9.#y¦+ú""¹æ¡Øİ[Y[˜›Ùy¤+9éîù¬åBˆ8 %8 %9£"y."øà#9è®¹k¦¸à#y¦`º) z`(ùd#9¥m9`"ùob9ê¥Âˆ9. :-múeç9£¢{ï#9.#yá-¹ob9ê¥ù§ ùåfyg*9åjúgh¹."¸à Bˆ:(èzgh¹cnù¦+ùên¹æ¡;ï":gh¹§oú(ªú*+y¢$\Ü^N‚ˆ›Û™{ï"{ï#9ç"ú-mù/¡¹`ãùchy/cøà ‚ˆ
‹Â‚ˆYŠˆ[™[œ\™[›ÙH	‰‚ˆ[™[œ\™[›ÙKšYOOBˆšÛYQ™X]\™S[Ù[›ÙH‚ˆ
^Â‚ˆÛÜÙRÛYQ™X]\™J
NÂ‚ˆ™]\›Â‚ˆB‚‚ˆÊ‚ˆ8¦!H9¥¬9h§»ï":-çÛÜ[]]Ğ˜]TÙ][™ÜÊ
Bˆ9æ¡9¤+9éîùbåy/g:acyl#{ï"{ï&‚ˆ9i ¹§§:gh¹§oùæë¹bcz(ªù¤+9b,Øİ[Y[˜›ÙBˆ9n¥y."ûï"9.èú(j9¦+ùo§¹g,9g%»ï#ùmèz`£úh zgh¹¢dúe¢ùæ¡;ï"{ï#ˆ:eç:e¢yæ¡9¦`¹`&y¤+9fç˜˜]TYÙz(èyc§ù§+9æ¡ˆ9/cyïk»ï#9.)¹¢¢™›Ø][™Ë[[Ù[:`&y`"ØÛ\ÜÂˆ9¢ïù£¢{ï#9 h¹oªy¢$9c§ù§+9g*9¢,:k)zh zghº(èBˆ9æ¡9k¦¹/cy¥®yo#øà ¹.#z`&yª(ù`f¹æ¡:*l{ï#:gh¹§où§ È9¬.:`h9åfyg*›Ùyn¥y."ûï#9."ù«(yg*9¢,:k)zh zgh‚ˆ:(èy¢dúe¢ù¦`»ï#9âb:gh¹§ ú-äy£¢xà ‚ˆ
‹Â‚ˆYŠˆ[™[œ\™[›ÙOOOBˆØİ[Y[˜›ÙH	‰‚ˆ]]ÔÙ][™ÜÓÜšYÚ[˜[\™[ˆ
^Â‚ˆYŠˆ]]ÔÙ][™ÜÓÜšYÚ[˜[™^ÚX›[™È	‰‚ˆ]]ÔÙ][™ÜÓÜšYÚ[˜[™^ÚX›[™Ëœ\™[›ÙOOOBˆ]]ÔÙ][™ÜÓÜšYÚ[˜[\™[ˆ
^Â‚ˆ]]ÔÙ][™ÜÓÜšYÚ[˜[\™[š[œÙ\™Y›Ü™Jˆ[™[ˆ]]ÔÙ][™ÜÓÜšYÚ[˜[™^ÚX›[™Âˆ
NÂ‚ˆBˆ[Ù^Â‚ˆ]]ÔÙ][™ÜÓÜšYÚ[˜[\™[˜\[™Ú[
ˆ[™[ˆ
NÂ‚ˆB‚‚ˆ[™[˜Û\ÜÓ\İœ™[[İ™Jˆ™›Ø][™Ë[[Ù[‚ˆ
NÂ‚ˆB‚ˆB‚ŸB‚‚‹Ê‚ˆ8¦!H9¥¬9h§»ï&¹¢¢¹æë¹bcz*+yk¦ºgh¹§oùåjúgh¹."ºhkùé.¹æ¡9`/;ï#ˆ9kf9fç¸à#Ú\˜Xİ\’[™^8à#z`&y`"ú)äº"l¹æ¡ˆ]]ĞÛÛ™šYËØ]]ĞÛÛ™šYÌº.ªù."¸à ‚ˆ9g*9b!ù£æú)äº"l¹.bùbcxà y.éycâ¹ç'ù«hù£"y."ùè®¹k¦¹¦`‚ˆ:`ïy§ ùdo9cêú`&z(è{ï#9è®¹/çy¬¤¹§"y.îù/ey. :`¢¹æ¡:*¯ù¥mˆ9§ ùfè9à®¹b!ù£æú)äº"lº #9.#yl#ùoàú`n¹i,xà ‚Š‹Â‚™[˜İ[ÛˆØ]™P]]ÔÙ][™ÜÑ›Ü›UĞÚ\˜Xİ\ŠÚ\˜Xİ\’[™^
^Â‚ˆÛÛœİXİ[Û”Ù[XİBˆ	
˜]]ÔÙ][™ÜĞXİ[Û”Ù[XİŠNÂ‚‚ˆÛÛœİÙ[XİBˆ	
˜]]ÔÙ][™ÜÒŠNÂ‚‚ˆÛÛœİÜÙ[XİBˆ	
˜]]ÔÙ][™ÜÔÔŠNÂ‚‚ˆÛÛœİ™]\›Ú]PÚXÚØ›ŞBˆ	
˜]]ÔÙ][™ÜÔ™]\›Ú]HŠNÂ‚‚ˆÛÛœİ\™Ù]ÛÛ™šYÏBˆÙ]\P]]ĞÛÛ™šYÊ[X™\ŠÚ\˜Xİ\’[™^
JNÂ‚‚ˆYŠXİ[Û”Ù[Xİ
^Â‚ˆ\™Ù]ÛÛ™šYËœÚÚ[BˆXİ[Û”Ù[Xİ˜[YNÂ‚ˆB‚‚ˆYŠÙ[Xİ
^Â‚ˆ\™Ù]ÛÛ™šYËšBˆ[X™\ŠÙ[Xİ˜[YJNÂ‚ˆB‚‚ˆYŠÜÙ[Xİ
^Â‚ˆ\™Ù]ÛÛ™šYËœÜBˆ[X™\ŠÜÙ[Xİ˜[YJNÂ‚ˆB‚‚ˆYŠ™]\›Ú]PÚXÚØ›Ş
^Â‚ˆ\™Ù]ÛÛ™šYËœ™]\›•ĞÚ]UÚ[‘[\OB‚ˆ™]\›Ú]PÚXÚØ›Ş˜ÚXÚÙYÂ‚ˆB‚ŸB‚‚™[˜İ[ÛˆİÚ]Ú]]ÔÙ][™ÜĞÚ\˜Xİ\ŠÚÚ\Ø]™J^Â‚ˆÊ‚ˆ8¦!H9/ë¹«hûï"9ç'ù«hú)èù¬n¸à#9b!ù£æú)äº"l¹§ ú`n¹i,Bˆ9§*¹a,¹kf:+¢¹¦í8à#yæ¡Yûï"{ï&‚ˆ9g*:+ 9cå¹¥¬:)äº"l¹æ¡:,áù¥¦xà zaãy¥¬9åjúgh¹.bùbc{ï#ˆ9ab9¢¢¸à#9æë¹bcyåjúgh¹."ºhkùé.¹æ¡9`/8à#Bˆ9kf9fç¸à#9b!ù£æùbcxà#z`¨ù`"ú)äº"lº.ªù."¸ %8 %ˆ:`&yª(ù/oùå*: !y.#yë¨yg*xà P¹ajy`"ú)äº"l¹.búe¤Âˆ9b!ù£æùno¹«(xà z*¯ù¥m9no¹«({ï#ˆ9«ãù. 9«(yb!ù£æú`ïy§ ùab9njùoæykf:-mù/¡»ï#ˆ9.#yå*9b!ù. 9`"ú)äº"l¹l,z) y£"y. 9«(yè®¹k¦»ï#ˆ9§ 9o£9íly. 9£"y. 9«(yè®¹k¦¹clùcëøà ‚‚ˆ8¦!H9/a¹§"y`"ù/¢ùi%»ï&¹bfù¢dúe¢ú*+yk¦ºgh¹§oùæ¡:`¨ù. 9b.Âˆ;ï"Ü[]]Ğ˜]TÙ][™ÜÊ
ydo9cêú`&z(èy¦`»ï"{ï#ˆ9åjúgh¹."¹æ¡9«!9/cyam¹ké¹¦+øà#9."¹. 9«(zeç:e¢y¦`‚ˆ9«¦9åfyæ¡:""¹aiùk®xà#{ï#9.#y¦+ùãªyk­¹«hùg*9íê:/+ùæ¡9§lz)oûï#ˆ:`&y¦`¹`&yi ¹§§:`¡9gíú(c8à#9kf9fç¹."¹. 9`"ú)äº"l¸à#{ï#ˆ9cãz #9§ ùå*:`&y.¦ú`c¹¦`¹æ¡9«¦9åfy`/;ï#ˆ9¢¢º)äº"l¹ç'ù«hùæ¡:*+yk¦º)¡º$âù£¢xà ‚ˆ9¢`9.éybfù¢dúe¢úgh¹§où¦`¹å*ÚÚ\Ø]™O]Yz-ìú`cº`&y. 9«i{ï#ˆ9cê¹§"yãªyk­¹g*:gh¹§oøà#9mì¹í¤ù¢dúe¢ùæ¡9âà9¡bù."øà#Bˆ9..ùbåyb!ù£æú)äº"l¹¦`»ï#9¢czg :) ya,¹kf8à ‚ˆ
‹Â‚ˆYŠ\ÚÚ\Ø]™J^Â‚ˆØ]™P]]ÔÙ][™ÜÑ›Ü›UĞÚ\˜Xİ\Šˆ]]ÔÙ][™ÜĞİ\œ™[Ú\˜Xİ\‚ˆ
NÂ‚ˆB‚‚ˆÛÛœİÚ\˜Xİ\”Ù[XİBˆ	
˜]]ÔÙ][™ÜĞÚ\˜Xİ\”Ù[XİŠNÂ‚‚ˆÛÛœİXİ[Û”Ù[XİBˆ	
˜]]ÔÙ][™ÜĞXİ[Û”Ù[XİŠNÂ‚‚ˆÛÛœİÙ[XİBˆ	
˜]]ÔÙ][™ÜÒŠNÂ‚‚ˆÛÛœİÜÙ[XİBˆ	
˜]]ÔÙ][™ÜÔÔŠNÂ‚‚ˆÛÛœİ™]\›Ú]PÚXÚØ›ŞBˆ	
˜]]ÔÙ][™ÜÔ™]\›Ú]HŠNÂ‚‚ˆYŠXÚ\˜Xİ\”Ù[Xİ
^Âˆ™]\›ÂˆB‚‚ˆ]™\]Y\İY[™^Bˆ[X™\ŠÚ\˜Xİ\”Ù[Xİ˜[YJNÂ‚ˆYŠYÙ]\PÚ\˜Xİ\R[™^
™\]Y\İY[™^
J^Â‚ˆÚ\˜Xİ\”Ù[Xİ˜[YOHŒÂˆ™\]Y\İY[™^LÂ‚ˆB‚‚ˆÛÛœİ\™Ù]ÛÛ™šYÏBˆÙ]\P]]ĞÛÛ™šYÊ™\]Y\İY[™^
NÂ‚‚ˆ\™Ù]ÛÛ™šYËš[›Ü›X[^™P]]Ğ˜]U™\ÚÛ
\™Ù]ÛÛ™šYËšL
NÂˆ\™Ù]ÛÛ™šYËœÜ[›Ü›X[^™P]]Ğ˜]U™\ÚÛ
\™Ù]ÛÛ™šYËœÜJNÂ‚‚ˆÛÛœİÚ\˜Xİ\’YBˆÙ]\PÚ\˜Xİ\’Ù^J™\]Y\İY[™^
NÂ‚‚ˆÛÛœİØYİ]BˆÚ\˜Xİ\”ÚÚ[ØYİ]ÖÂˆÚ\˜Xİ\’YˆNÂ‚‚ˆÊ‚ˆ8¦!H:!ê¹båz(c9båy."ù¢âz`n9e«»ï&‚ˆ9¦kº`&¹¥.ù¤â¸à zf,¹é©»ï#9b¨9."º*lº)äº"lº(çy`¦yæ¡ˆ9«ãù. 9¨/9¢ : ï{ï"9§ 9i&9`"ûï"xà ‚ˆ
‹Â‚ˆYŠXİ[Û”Ù[Xİ
^Â‚ˆ]Ü[ÛœÒSB‚ˆ	ÏÜ[Ûˆ˜[YOH››Ü›X[¹¦kº`&¹¥.ù¤âÛÜ[Û‰ÊÂˆ	ÏÜ[Ûˆ˜[YOH™Y™[™ºf,¹é©ÛÜ[Û‰ÎÂ‚‚ˆYŠØYİ]
^Â‚ˆØYİ]™\]Z\YÚÚ[Ë™›Ü‘XXÚ
ˆÚÚ[YOÂ‚ˆÛÛœİÚÚ[BˆÚÚ[]X˜\ÙVÜÚÚ[YNÂ‚‚ˆYŠˆ\ÚÚ[ˆÚÚ[˜Ø]YÛÜOOOH˜Y™ˆŸˆÚÚ[˜Ø]YÛÜOOOHœ\ÜÚ]™HŸˆÚÚ[˜Ø]YÛÜOOOHšX[ŸˆÚÚ[˜Ø]YÛÜOOOHœ™]š]™H‚ˆ
^Âˆ™]\›ÂˆB‚‚ˆÜ[ÛœÒS
ÏB‚ˆ	ÏÜ[Ûˆ˜[YOH‰ÊÂˆÚÚ[Y
Âˆ	È‰ÊÂˆÚÚ[›˜[YJÂˆ	ÏÛÜ[Û‰ÎÂ‚ˆBˆ
NÂ‚ˆB‚‚ˆXİ[Û”Ù[Xİš[›™\’SBˆÜ[ÛœÒSÂ‚‚ˆÛÛœİİ[˜[YB‚ˆ\œ˜^K™œ›ÛJˆXİ[Û”Ù[Xİ›Ü[ÛœÂˆ
BˆœÛÛYJˆÜO‚ˆÜ˜[YOOOBˆ\™Ù]ÛÛ™šYËœÚÚ[ˆ
NÂ‚‚ˆXİ[Û”Ù[Xİ˜[YOB‚ˆİ[˜[YˆÂˆ\™Ù]ÛÛ™šYËœÚÚ[ˆ‚ˆ››Ü›X[Â‚ˆB‚‚ˆYŠÙ[Xİ
^Â‚ˆÙ[Xİ˜[YOBˆ\™Ù]ÛÛ™šYËšÂ‚ˆB‚‚ˆYŠÜÙ[Xİ
^Â‚ˆÜÙ[Xİ˜[YOBˆ\™Ù]ÛÛ™šYËœÜÂ‚ˆB‚‚ˆYŠ™]\›Ú]PÚXÚØ›Ş
^Â‚ˆ™]\›Ú]PÚXÚØ›Ş˜ÚXÚÙYB‚ˆH]\™Ù]ÛÛ™šYËœ™]\›•ĞÚ]UÚ[‘[\NÂ‚ˆB‚‚ˆÊ‚ˆ8¦!H9¦í9¥¬:/ïz.i:+¢¹¥n;ï#:*&9/cú(j9e«¹ãï¹g*:hkùé.¹æ¡ˆ9¦+ùdê¹`"ú)äº"l»ï#9."ù«(yb!ù£æù¦`¹¢cyçéz`dÂˆ:) y¢¢º,áù¥¦ykf9fçº*¬:.ªù."¸à ‚ˆ
‹Â‚ˆ]]ÔÙ][™ÜĞİ\œ™[Ú\˜Xİ\Bˆ™\]Y\İY[™^Â‚ŸB‚‚™[˜İ[ÛˆÛÛ™š\›P]]Ğ˜]TÙ][™ÜÊ
^Â‚ˆÛÛœİÚ\˜Xİ\”Ù[XİBˆ	
˜]]ÔÙ][™ÜĞÚ\˜Xİ\”Ù[XİŠNÂ‚‚ˆYŠXÚ\˜Xİ\”Ù[Xİ
^Âˆ™]\›ÂˆB‚‚ˆÊ‚ˆ8¦!H9/ë¹«hûï&¹æí9£©ydo9cêùalyå*9æ¡9a,¹kf9aïyo#ûï#ˆ9è®¹/çz`&z(èz-çùb!ù£æú)äº"l¹¦`¹å*9æ¡9¦+ùd#9. 9ieú`£ú/+ûï#ˆ9.#y§ ùaî¹ãï¹ajz`¢¹d!9kêù. 9.ïxà y.éyo£9¥.y. :`¢¹oæ:*&9¥.Bˆ9cé¹. :`¢¹æ¡9 áy¬àxà ‚ˆ
‹Â‚ˆØ]™P]]ÔÙ][™ÜÑ›Ü›UĞÚ\˜Xİ\Šˆ[X™\ŠÚ\˜Xİ\”Ù[Xİ˜[YJBˆ
NÂ‚‚ˆÊ‚ˆ8¦!H:*+yk¦¹k£9d#9«iy. 9."ù..ùgãº`¨ú`¢¹æ¡:""¹âbRBˆ;ï"9i ¹§§9ãªyk­¹.bùo£:`¡9¦+ù§ ùc®ù..ùgãº*¯ù¥m;ï"{ï#ˆ:`oùacyajz`¢ºhkùé.¹æ¡9¥n9keùl#y.#y."¸à ‚ˆ
‹Â‚ˆYŠÚ\˜Xİ\”Ù[Xİ˜[YOOOHŒHŠ^Â‚ˆÜ[]P]]ÔÚÚ[Ü[ÛœÌŠ
NÂ‚ˆBˆ[ÙHYŠÚ\˜Xİ\”Ù[Xİ˜[YOOOHŒŠ^Â‚ˆÜ[]P]]ÔÚÚ[Ü[ÛœÊ
NÂ‚ˆB‚‚ˆØ]™QØ[YJ
NÂ‚‚ˆÛÜÙP]]Ğ˜]TÙ][™ÜÊ
NÂ‚‚ˆY˜]SÙÊˆº!ê¹båy¢,:k)z*+yk¦¹mì¹¦í9¥¬8à ˆ‚ˆ
NÂ‚ŸB‚‚‹Êˆ]]ÛX]XÈÛÛX˜]Û›HXÛ\™\ÈÛÛX˜]Xİ[ÛœËˆÔÔ™XÛİ™\H\È[™YˆÛ˜ÙHY\ˆšXİÜHH\TÜİ˜]P]]Ô™XÛİ™\J
Kˆ
‹Â™[˜İ[Ûˆ]]ĞXİ[Û‘›ÜÚ\˜Xİ\ŠÚ\˜Xİ\’[™^ÚÙ[Š^ÂˆÛÛœİÚ\˜Xİ\YÙ]\PÚ\˜Xİ\R[™^
Ú\˜Xİ\’[™^
NÂˆÛÛœİÛÛ™šYÏYÙ]\P]]ĞÛÛ™šYÊÚ\˜Xİ\’[™^
NÂˆÛÛœİ]]ÓÛXÚ\˜Xİ\’[™^OOLØ]]Ğ˜]N˜ÛÛ™šYË™[˜X›YÂ‚ˆYŠX˜]PXİ]™_XÚ\˜Xİ\ŸÚ\˜Xİ\‹šLX]]ÓÛŸÚÙ[ˆOOX˜]UÚÙ[Š^È™]\›ÈB‚ˆYŠÛÛ™šYËœÚÚ[OOH™Y™[™Š^Âˆ]Y]YY^Y\Xİ[ÛœÖØÚ\˜Xİ\’[™^O^ØXİ[Ûˆ™Y™[™‹\™Ù]›[NÂˆ\]URJ
NÈš[š\Ú^Y\Xİ[ÛŠ
NÈ™]\›ÂˆB‚ˆÛÛœİ[]™R[˜]OXİ\œ™[˜]S[Ûœİ\œË™š[\Š[™^Oš\Ğ˜]U\™Ù][]™J›[Ûœİ\ˆ‹[™^
JNÂˆYŠ[]™R[˜]K›[™İOOL
^ÈÚXÚĞ˜]Q[™

NÈ™]\›ÈB‚ˆ]Xİ[ÛXÛÛ™šYËœÚÚ[››Ü›X[Âˆ]ÚÚ[XXİ[ÛˆOOH››Ü›X[ÜÚÚ[]X˜\ÙVØXİ[Û—N›[ÂˆÛÛœİÚÚ[Ù^OYÙ]\PÚ\˜Xİ\’Ù^JÚ\˜Xİ\’[™^
NÂˆYŠXİ[ÛˆOOH››Ü›X[‰‰Šˆ\ÚÚ[ˆÙ]ÚÚ[]™[
ÚÚ[Ù^KXİ[ÛŠOLˆÚ\˜Xİ\‹œÜ
ÚÚ[œÜÛÜİOO][™Yš[™YÜÚÚ[œÜÛÜİŠÚÚ[˜ÛÜİ
J_ˆÈ˜Y™ˆ‹œ\ÜÚ]™H‹šX[‹œ™]š]™H—Kš[˜ÛY\ÊÚÚ[˜Ø]YÛÜJBˆ
J^ÂˆXİ[ÛH››Ü›X[ÂˆÚÚ[[[ÂˆB‚ˆÛÛœİÚÚ[]™[\ÚÚ[ÙÙ]ÚÚ[]™[
ÚÚ[Ù^KXİ[ÛŠNŒÂˆÛÛœİ\™Ù]\O\ÚÚ[ˆÛ›Ü›X[^™P˜]U\™Ù]\JÙ]Y™™Xİ]™TÚÚ[\™Ù]\JÚÚ[ÚÚ[]™[
JBˆˆœÚ[™ÛHÂ‚ˆYŠ\™Ù]\OOOH˜[Š^Âˆ]Y]YY^Y\Xİ[ÛœÖØÚ\˜Xİ\’[™^O^ØXİ[Û˜Xİ[Û‹\™Ù]›[NÂˆ\]URJ
NÈš[š\Ú^Y\Xİ[ÛŠ
NÈ™]\›ÂˆB‚ˆÛÛœİØ[™Y]\ÏX[]™R[˜]K™š[\Š[™^O‚ˆØ[”Ù[XİÜİ[P˜]Tš[X\J›[Ûœİ\ˆ‹[™^\™Ù]\JBˆ
NÂˆYŠXØ[™Y]\Ë›[™İ
^Âˆ]Y]YY^Y\Xİ[ÛœÖØÚ\˜Xİ\’[™^O^ØXİ[Ûˆ™Y™[™‹\™Ù]›[NÂˆY˜]SÙÊ
Ú\˜Xİ\‹šYº)äº"lˆŠJÈ¹¢o¹.#yb,9cëú(ªùe«ºjå;ï#ù£!ùk¦¹ëá9g#y¥.ù¤âº`n9.+yæ¡9æë¹ª&{ï#9¥.yà®ºf,¹é©¸à ˆŠNÂˆ\]URJ
NÈš[š\Ú^Y\Xİ[ÛŠ
NÈ™]\›ÂˆB‚ˆ]\™Ù]XØ[™Y]\ÖÌNÂˆYŠÚÚ[	‰–ÈšH‹œ›İÈ‹˜ÛÛ[[ˆ—Kš[˜ÛY\Ê\™Ù]\JJ^Âˆ]™\İÛİ[KLNÂˆØ[™Y]\Ë™›Ü‘XXÚ
Ø[™Y]OOÂˆÛÛœİ]Ûİ[YÙ]ÚÚ[\™Ù]ÊØ[™Y]K\™Ù]\JK›[™İÂˆYŠ]Ûİ[˜™\İÛİ[
^È™\İÛİ[Z]Ûİ[È\™Ù]XØ[™Y]NÈBˆJNÂˆB‚ˆ]Y]YY^Y\Xİ[ÛœÖØÚ\˜Xİ\’[™^O^ØXİ[Û˜Xİ[Û‹\™Ù]\™Ù]NÂˆ\]URJ
NÂˆš[š\Ú^Y\Xİ[ÛŠ
NÂŸB‚™[˜İ[Ûˆ]]ĞXİ[ÛŠÚÙ[Š^Âˆ™]\›ˆ]]ĞXİ[Û‘›ÜÚ\˜Xİ\ŠÚÙ[ŠNÂŸB‚‹ÊˆY][Û˜[\HY[X™\œÈÚ\™HHØ[YHXÛ\˜][ÛˆİÛ™\‹ˆ
‹Â™[˜İ[Ûˆ^Y\Œ]]ĞXİ[ÛŠÚÙ[Š^Âˆ™]\›ˆ]]ĞXİ[Û‘›ÜÚ\˜Xİ\ŠKÚÙ[ŠNÂŸB‚™[˜İ[Ûˆ^Y\ŒĞ]]ĞXİ[ÛŠÚÙ[Š^Âˆ™]\›ˆ]]ĞXİ[Û‘›ÜÚ\˜Xİ\Š‹ÚÙ[ŠNÂŸB‚‚™[˜İ[ÛˆÙXÛÛ™\PÚ\˜Xİ\“›Ü›X[]XÚÊÚ\˜Xİ\’[™^[™^
^Â‚ˆÛÛœİÚ\˜Xİ\YÙ]\PÚ\˜Xİ\R[™^
Ú\˜Xİ\’[™^
NÂˆÛÛœİİ]ÏYÙ]\P˜]Tİ]ÊÚ\˜Xİ\’[™^
NÂ‚ˆ[™^Yš[™[]™U\™Ù][™^
[™^œÚ[™ÛHŠNÂ‚ˆYŠXÚ\˜Xİ\ˆ\İ]È[™^OO[[
^Âˆš[š\Ú^Y\Xİ[ÛŠ
NÂˆ™]\›ÂˆB‚ˆÙ[XİY[Ûœİ\Z[™^ÂˆÛÛœİ[Ûœİ\[[Ûœİ\œÖÚ[™^NÂ‚ˆ[™ÙT^Y\Ø\™
Ú\˜Xİ\’[™^
NÂˆÚİÔÚÚ[˜[YP˜YÙJ¹¦kº`&¹¥.ù¤âˆ‹››Ü›X[‹Ú\˜Xİ\’[™^[™^Ú[™^JNÂ‚ˆÛÛœİ]\›Û]Ú[˜ÙJˆİ]Ë˜XØİ\˜XŞKˆÙ][Ûœİ\‘]˜\Ú[ÛŠ[Ûœİ\ŠKˆÙ][Ûœİ\‘XY™•˜[YJÚ\˜Xİ\‹œİ[ˆŠKˆÙ]Xİ]™PXØİ\˜XŞP›Û\Ô\˜Ù[
Ú\˜Xİ\ŠBˆ
NÂ‚ˆYŠZ]
^ÂˆÚİÓZ\ÜÑY™™Xİ
˜[ÙK[™^“RTÔÈŠNÂˆY˜]SÙÊ
Ú\˜Xİ\‹šYºf¢¹câÈŠJÈ¹¦kº`&¹¥.ù¤âˆŠÛ[Ûœİ\‹›˜[YJÈ»ï#9¬¤¹§"ydoy.+{ï HŠNÂˆ\]URJ
NÂˆš[š\Ú^Y\Xİ[ÛŠ
NÂˆ™]\›ÂˆB‚ˆÛÛœİÜš]™\İ[\›ÛÜš]XØ[
ˆÚ\˜Xİ\‹ˆœ\ÚXØ[‹ˆÙ][Ûœİ\‘Y™™Xİ]™P[PÜš]
[Ûœİ\ŠKˆ[Ûœİ\‚ˆ
NÂ‚ˆÛÛœİ[XYÙOXØ[İ[]Q[XYÙJˆİ]Ë˜]XÚËˆÙ][Ûœİ\‘Y™™Xİ]™QY™[œÙJ[Ûœİ\ŠKˆÚ\˜Xİ\‹›]™[ˆ[Ûœİ\‹›]™[ˆÚ\˜Xİ\‹™[[Y[ˆ[Ûœİ\‹™[[Y[ˆÂˆ]XÚÙ\˜Ú\˜Xİ\‹ˆ\™Ù]›[Ûœİ\‹ˆÜš]][\Y\˜Üš]™\İ[›][\Y\‚ˆBˆ
NÂˆ[Ûœİ\‹šSX]›X^
[Ûœİ\‹šY[XYÙJNÂ‚ˆÚİÓ[Ûœİ\’]
[™^[XYÙKš‹Üš]™\İ[š\ĞÜš]
NÂˆY˜]SÙÊˆ
Ú\˜Xİ\‹šYºf¢¹câÈŠJÈ¹¦kº`&¹¥.ù¤âˆŠÛ[Ûœİ\‹›˜[YJÂˆ
Üš]™\İ[š\ĞÜš]È»ï"9â!¹¤â»ï {ï"HˆˆˆŠJÂˆ»ï#:`(9¢$ŠÙ[XYÙJÈ¹`­ùk¬øà ˆ‚ˆ
NÂ‚ˆYŠ[Ûœİ\‹šL
^ÈÚ[[Ûœİ\Š[™^
NÈB‚ˆ\]URJ
NÂˆš[š\Ú^Y\Xİ[ÛŠ
NÂŸB‚‚™[˜İ[ÛˆØ\İÙXÛÛ™\PÚ\˜Xİ\”ÚÚ[
Ú\˜Xİ\’[™^ÚÚ[YÙ[\’[™^
^Â‚ˆÛÛœİÚ\˜Xİ\YÙ]\PÚ\˜Xİ\R[™^
Ú\˜Xİ\’[™^
NÂˆÛÛœİÚ\˜Xİ\’Ù^OYÙ]\PÚ\˜Xİ\’Ù^JÚ\˜Xİ\’[™^
NÂˆÛÛœİİ]ÏYÙ]\P˜]Tİ]ÊÚ\˜Xİ\’[™^
NÂˆÛÛœİÚÚ[\ÚÚ[]X˜\ÙVÜÚÚ[YNÂ‚ˆYŠXÚ\˜Xİ\ˆ\İ]È\ÚÚ[
^Âˆš[š\Ú^Y\Xİ[ÛŠ
NÂˆ™]\›ÂˆB‚ˆÛÛœİ]™[YÙ]ÚÚ[]™[
Ú\˜Xİ\’Ù^KÚÚ[Y
NÂˆÛÛœİÜÛÜİ\ÚÚ[œÜÛÜİOO][™Yš[™YÈÚÚ[œÜÛÜİˆ
ÚÚ[˜ÛÜİ
NÂ‚ˆYŠ]™[LÚ\˜Xİ\‹œÜÜÛÜİ
^ÂˆY˜]SÙÊˆ]™[LˆÈ
Ú\˜Xİ\‹šY
È¹l&¹§*¹kn9ïäˆŠÜÚÚ[›˜[YJÈ¸à ˆŠBˆˆ
Ú\˜Xİ\‹šY
È”Ô9.#z-¬ûï#9á(y¬åy/oùå*ŠÜÚÚ[›˜[YJÈ¸à ˆŠBˆ
NÂˆš[š\Ú^Y\Xİ[ÛŠ
NÂˆ™]\›ÂˆB‚ˆÛÛœİY™™Xİ]™U\™Ù]\OYÙ]Y™™Xİ]™TÚÚ[\™Ù]\JÚÚ[]™[
NÂˆÙ[\’[™^[›Ü›X[^™P˜]U\™Ù]\JY™™Xİ]™U\™Ù]\JOOOH˜[‚ˆÛ[ˆ™š[™[]™U\™Ù][™^
Ù[\’[™^Y™™Xİ]™U\™Ù]\JNÂ‚ˆYŠ›Ü›X[^™P˜]U\™Ù]\JY™™Xİ]™U\™Ù]\JHOOH˜[‰‰˜Ù[\’[™^OO[[
^Âˆš[š\Ú^Y\Xİ[ÛŠ
NÂˆ™]\›ÂˆB‚ˆÛÛœİ\™Ù]ÏYÙ]ÚÚ[\™Ù]ÊÙ[\’[™^Y™™Xİ]™U\™Ù]\JNÂˆYŠ]\™Ù]Ë›[™İ
^Âˆš[š\Ú^Y\Xİ[ÛŠ
NÂˆ™]\›ÂˆB‚ˆÚ\˜Xİ\‹œÜO\ÜÛÜİÂˆ[™ÙT^Y\Ø\™
Ú\˜Xİ\’[™^
NÂˆÚİÔÚÚ[˜[YP˜YÙJˆÚÚ[›˜[YKÚÚ[™[[Y[Ú\˜Xİ\’[™^ˆY™™Xİ]™U\™Ù]\OOOH˜[Û[˜Ù[\’[™^\™Ù]Ë[™Yš[™YY™™Xİ]™U\™Ù]\Bˆ
NÂˆÙ][Y[İ]


OOœÚİÔ^Y\”ÜÜ\
ÜÛÜİÚ\˜Xİ\’[™^
KL
NÂ‚ˆÛÛœİİ]›Û\Ï\ÚÚ[˜Ø]YÛÜOOOH›XYÚXÈˆÈİ]Ë›XYÚXĞ]XÚÈˆİ]Ë˜]XÚÎÂ‚ˆYŠ\ÚÚ[˜˜\ÙQ[XYÙJ^ÂˆÛÛœİœ™Y^™PÚ[˜ÙOYÙ]ÚÚ[œ™Y^™PÚ[˜ÙP]]™[
ÚÚ[]™[
NÂˆÛÛœİœ™Y^™Q\˜][ÛYÙ]ÚÚ[œ™Y^™Q\˜][Û]]™[
ÚÚ[]™[
NÂˆ\™Ù]Ë™›Ü‘XXÚ
[™^OÂˆÛÛœİ[Ûœİ\[[Ûœİ\œÖÚ[™^NÂˆYŠ[[Ûœİ\Ÿ[[Ûœİ\‹˜[]™_œ™Y^™PÚ[˜ÙOL
^È™]\›ÈBˆÛÛœİœ™Y^™T™\İ[\›Û˜[YY\œÚ\İ[İ]\ÑY™™Xİ
ˆ[Ûœİ\‹™œ™Y^™H‹Âˆœ™Y^™PÚ[˜ÙKÚ\˜Xİ\‹›]™[[Ûœİ\‹›]™[ˆİ]Ëš[[YÙ[˜ÙKÙ][Ûœİ\‘Y™™Xİ]™TÜ\š]Ú[Ê[Ûœİ\ŠKˆYKÙ][Ûœİ\”˜[šÊ[Ûœİ\ŠBˆK›[Ûœİ\ˆ‹[™^ÚÚ[›˜[YBˆ
NÂˆYŠœ™Y^™T™\İ[š]
^Âˆ\Qœ™Y^™QY™™Xİ
[Ûœİ\‹œ™Y^™Q\˜][ÛŠNÂˆY˜]SÙÊ[Ûœİ\‹›˜[YJÈº(ªùa¬9l y.¡»ï HŠNÂˆY[ÙHYŠYœ™Y^™T™\İ[™\XØ]J^ÂˆÚİÓZ\ÜÑY™™Xİ
˜[ÙK[™^¹¢­y¢¥ÈŠNÂˆY˜]SÙÊÚÚ[›˜[YJÈ¹l#HŠÛ[Ûœİ\‹›˜[YJÈ¹¬¤¹§"yå'ù¥b;ï"9¢­y¢¥ûï"xà ˆŠNÂˆBˆJNÂˆ\]URJ
NÂˆš[š\Ú^Y\Xİ[ÛŠ
NÂˆ™]\›ÂˆB‚ˆYŠÚÚ[YOOH™š\™T›ØÚÙ]Š^Âˆ^Qš\™T›ØÚÙ][š[X][ÛŠˆ˜˜]T^Y\Ø\™ŠØÚ\˜Xİ\’[™^ˆ\™Ù]Ë›X\
[™^Oˆ˜˜]S[Ûœİ\ˆŠÚ[™^
Bˆ
NÂˆB‚ˆ]İ[Y™\İX[LÂ‚ˆ\™Ù]Ë™›Ü‘XXÚ
[™^OÂˆÛÛœİ[Ûœİ\[[Ûœİ\œÖÚ[™^NÂˆYŠ[[Ûœİ\ˆ[[Ûœİ\‹˜[]™J^È™]\›ÈB‚ˆYŠÚÚ[šYOOHšXÙTÜ[ˆŠ^Âˆ^RXÙTÜ[”›Ú™Xİ[JÚ\˜Xİ\’[™^[™^
NÂˆB‚ˆÛÛœİ]\›Û]Ú[˜ÙJˆİ]Ë˜XØİ\˜XŞKˆÙ][Ûœİ\‘]˜\Ú[ÛŠ[Ûœİ\ŠKˆÙ][Ûœİ\‘XY™•˜[YJÚ\˜Xİ\‹œİ[ˆŠKˆÙ]Xİ]™PXØİ\˜XŞP›Û\Ô\˜Ù[
Ú\˜Xİ\ŠBˆ
NÂ‚ˆYŠZ]
^ÂˆÚİÓZ\ÜÑY™™Xİ
˜[ÙK[™^“RTÔÈŠNÂˆY˜]SÙÊÚÚ[›˜[YJÈ¹l#HŠÛ[Ûœİ\‹›˜[YJÈ»ï#9¬¤¹§"ydoy.+{ï HŠNÂˆ™]\›ÂˆB‚ˆÛÛœİÜš]™\İ[\›ÛÜš]XØ[
ˆÚ\˜Xİ\‹ˆÚÚ[˜Ø]YÛÜKˆÙ][Ûœİ\‘Y™™Xİ]™P[PÜš]
[Ûœİ\ŠKˆ[Ûœİ\‚ˆ
NÂ‚ˆÛÛœİ[XYÙOXØ[İ[]TÚÚ[[XYÙJÂˆÚÚ[œÚÚ[ˆÚÚ[]™[›]™[ˆY™™Xİ]™P]XÚÎœİ]›Û\Ëˆ\™Ù]›[Ûœİ\‹ˆØ\İ\“]™[˜Ú\˜Xİ\‹›]™[ˆØ\İ\‘[[Y[˜Ú\˜Xİ\‹™[[Y[ˆ]XÚÙ\˜Ú\˜Xİ\‹ˆÜš]][\Y\˜Üš]™\İ[›][\Y\‚ˆJNÂˆÛÛœİ™Y›Ü™Q\™Xİ[XYÙO[[Ûœİ\‹šÂˆ[Ûœİ\‹šSX]›X^
[Ûœİ\‹šY[XYÙJNÂ‚ˆÚİÓ[Ûœİ\’]
[™^[XYÙKš‹Üš]™\İ[š\ĞÜš]
NÂˆÛÛœİXİX[[XYÙQX[SX]›X^
™Y›Ü™Q\™Xİ[XYÙK[[Ûœİ\‹š
NÂˆY˜]SÙÊˆ
Ú\˜Xİ\‹šYºf¢¹câÈŠJÈ¹¥¯y¥/ˆŠÜÚÚ[›˜[YJÈ¹doy.+HŠÛ[Ûœİ\‹›˜[YJÂˆ
Üš]™\İ[š\ĞÜš]È»ï"9â!¹¤â»ï {ï"HˆˆˆŠJÂˆ»ï#:`(9¢$ŠÙ[XYÙJÈ¹`­ùk¬øà ˆ‚ˆ
NÂ‚ˆÛÛœİ\›”™\İ[\ÚÚ[˜\›Ú[˜ÙBˆÜ›Û˜[YY\œÚ\İ[İ]\ÑY™™Xİ
ˆ[Ûœİ\‹ˆ˜\›ˆ‹ˆÂˆÚÚ[˜\›Ú[˜ÙKÚ\˜Xİ\‹›]™[[Ûœİ\‹›]™[ˆİ]Ëš[[YÙ[˜ÙKÙ][Ûœİ\‘Y™™Xİ]™TÜ\š]Ú[Ê[Ûœİ\ŠBˆKˆ›[Ûœİ\ˆ‹ˆ[™^ˆÚÚ[›˜[YKˆÚÚ[™İX\˜[YY\›OO]YBˆ
Bˆ›[ÂˆYŠ\›”™\İ[	‰˜\›”™\İ[š]
^Âˆ\P\›‘Y™™Xİ
[Ûœİ\‹ÚÚ[˜\›‘\˜][Û‹ÚÚ[˜\›”\˜Ù[S]™[Û]™[LWJNÂˆY˜]SÙÊ[Ûœİ\‹›˜[YJÈºfmùaiyáàùáä¹âà9¡bûï HŠNÂˆB‚ˆÛÛœİœ™Y^™T™\İ[\ÚÚ[™œ™Y^™PÚ[˜ÙBˆÜ›Û˜[YY\œÚ\İ[İ]\ÑY™™Xİ
ˆ[Ûœİ\‹ˆ™œ™Y^™H‹ˆÂˆÚÚ[™œ™Y^™PÚ[˜ÙKÚ\˜Xİ\‹›]™[[Ûœİ\‹›]™[ˆİ]Ëš[[YÙ[˜ÙKÙ][Ûœİ\‘Y™™Xİ]™TÜ\š]Ú[Ê[Ûœİ\ŠKˆYKÙ][Ûœİ\”˜[šÊ[Ûœİ\ŠBˆKˆ›[Ûœİ\ˆ‹ˆ[™^ˆÚÚ[›˜[YBˆ
Bˆ›[ÂˆYŠœ™Y^™T™\İ[	‰™œ™Y^™T™\İ[š]
^Âˆ\Qœ™Y^™QY™™Xİ
[Ûœİ\‹ÚÚ[™œ™Y^™Q\˜][ÛŠNÂˆY˜]SÙÊ[Ûœİ\‹›˜[YJÈº(ªùa¬9l y.¡»ï HŠNÂˆB‚ˆ\TÚÚ[XY™‘Y™™XİÊˆÚÚ[]™[[Ûœİ\‹[™^Ú\˜Xİ\‹›]™[ˆÚÚ[˜Ø]YÛÜOOOHœ\ÚXØ[Üİ]Ë˜]XÚÔÚ[Îœİ]Ëš[[YÙ[˜ÙBˆ
NÂ‚ˆYŠÚÚ[›Y™\İX[\˜Ù[S]™[
^Èİ[Y™\İX[
ÏXXİX[[XYÙQX[ÈBˆYŠ[Ûœİ\‹šL
^ÈÚ[[Ûœİ\Š[™^
NÈBˆJNÂ‚ˆYŠÚÚ[›Y™\İX[\˜Ù[S]™[	‰ˆİ[Y™\İX[Œ
^ÂˆÛÛœİ[[İ[SX]™›ÛÜŠˆİ[Y™\İX[
™Ù]Ø]\‘^XœÛÜ˜”\˜Ù[
Ú\˜Xİ\‹ÚÚ[›Y™\İX[\˜Ù[S]™[Û]™[LWKšŠKÌLˆ
NÂˆÚ\˜Xİ\‹šSX]›Z[Šİ]Ë›X^Ú\˜Xİ\‹š
Ø[[İ[
NÂˆÚ\˜Xİ\‹œÜSX]›Z[Šİ]Ë›X^ÔÚ\˜Xİ\‹œÜ
Ø[[İ[
NÂˆÚİÔ^Y\’]
[[İ[šX[‹Ú\˜Xİ\’[™^YJNÂˆY˜]SÙÊ
Ú\˜Xİ\‹šYºf¢¹câÈŠJÈ¹d.9¥-¹`­ùk¬ù.)¹fç¹oªR:"!ÔÔ8à ˆŠNÂˆB‚ˆYŠÚÚ[œÙ[”ÚY[S]™[	‰˜Ø[\S˜[YY\œÚ\İ[İ]JˆÚ\˜Xİ\‹œÚY[‹œ^Y\ˆ‹Ú\˜Xİ\’[™^ÚÚ[›˜[YBˆ
J^ÂˆÚ\˜Xİ\‹˜Xİ]™PY™œÏJÚ\˜Xİ\‹˜Xİ]™PY™œß×JK™š[\ŠY™O‚ˆXY™ŸY™‹\HOOHœÚY[Ÿ[X™\ŠY™‹\›œÓY
OŒ	‰“[X™\ŠY™‹œ™[XZ[š[™ÊOŒˆ
NÂˆÚ\˜Xİ\‹˜Xİ]™PY™œËœ\Ú
X\šÔ\œÚ\İ[İ]S˜[YJÂˆ\NˆœÚY[‹ˆ\›œÓYœÚÚ[œÚY[\˜][ÛŸ‹ˆ™[XZ[š[™ÎœÚÚ[œÙ[”ÚY[S]™[Û]™[LWBˆKœÚY[ŠJNÂˆB‚ˆYŠÚÚ[˜[TÚY[S]™[
^ÂˆÛÛœİ[[İ[\ÚÚ[˜[TÚY[S]™[Û]™[LWNÂˆÙ]Xİ]™T^Y\Ú\˜Xİ\œÊ
K™›Ü‘XXÚ

\™Ù]\™Ù][™^
OOÂˆYŠXØ[\S˜[YY\œÚ\İ[İ]Jˆ\™Ù]œÚY[‹œ^Y\ˆ‹\™Ù][™^ÚÚ[›˜[YBˆ
J^È™]\›ÈBˆ\™Ù]˜Xİ]™PY™œÏJ\™Ù]˜Xİ]™PY™œß×JK™š[\ŠY™O‚ˆXY™ŸY™‹\HOOHœÚY[Ÿ[X™\ŠY™‹\›œÓY
OŒ	‰“[X™\ŠY™‹œ™[XZ[š[™ÊOŒˆ
NÂˆ\™Ù]˜Xİ]™PY™œËœ\Ú
X\šÔ\œÚ\İ[İ]S˜[YJÂˆ\NˆœÚY[‹ˆ\›œÓYœÚÚ[œÚY[\˜][ÛŸ‹ˆ™[XZ[š[™Î˜[[İ[ˆKœÚY[ŠJNÂˆJNÂˆB‚ˆ\]URJ
NÂˆš[š\Ú^Y\Xİ[ÛŠ
NÂŸB‚‚‹Ê‚ˆ8¦!H9ë+9.£:)äº"l¹æ¡9¦kº`&¹¥.ù¤â¸à ‚ˆ:`£ú/+ú-çÛ›Ü›X[]XÚÊ
y. :!í;ï#ˆ9/a¹k£9aj9¤ãy/g^Y\Œ‹Üİ]Ì»ï#ˆ9.#y§ ùbåyb,^Y\¸à ‚Š‹Â‚‹Ê‚ˆ8¦!H9/ë¹«hûï"9/§yáiù/oùå*: !z) y¬`»ï#:(ç9."º-çÜ^Y\ŒBˆ9d#9. 9ieøà#9æë¹ª&y«nù.¨z!ê¹båz/byàjøà#yæ¡9/çz+mûï"{ï&‚ˆ:`&y`"ùaïyo#ùdo9cêùêëûï"^Xİ]PXİ[Û‹Âˆ™\ÛÛ™T]Y]YY^Y\Xİ[Û»ï"y§+9/¡¹l,y§ ùg*ˆ9do9cêùk£9.bùo£9á(y¨§y.íº(ç9do9cêù. 9«(Bˆš[š\Ú^Y\Xİ[ÛŠ
{ï#9¢`9.éyc§ù§+8à#9æë¹ª&y«nù.¡‚ˆ9l,yæí9£©\™]\›¸à#y.)¹.#y§ ú+¤ù¢,:k)ychy/cûï#9cê¹¦+ù§ Âˆ:+¤ú`&y«(y¥.ù¤âº+¢¹¢$9¢dùên¹¬(øà y.#y§ ú!ê¹båz/byàjøà ‚‚ˆ:`&z(èy¥.yå*š[™[]™U\™Ù][™^

{ï"9í%9¢o¹æë¹ª&{ï#ˆ9.#ydo9cêÙš[š\Ú^Y\Xİ[ÛŠ
{ï"{ï#9¢o¹b,9æë¹ª&Bˆ:`¡9­.ú$eùl,y¬¯ùå*;ï#9«nù.¡¹l,z!ê¹båy¥.y¢dÂˆİ\œ™[˜]S[Ûœİ\œú(èyë+9. :f®ú`¡9­.ú$eùæ¡9 *¹âj{ï#ˆ:-çÜ^Y\Œyæ¡:(c9à®¹. :!í8à ¹ç'ùæ¡9. :f®ù *¹âjz`ïy.#ybjBˆ;ï"9aj9®á{ï"y¢c\™]\›»ï#9.©9íi¹do9cêùêëù§+9/¡¹l,y§ ú(ç9."¹æ¡ˆš[š\Ú^Y\Xİ[ÛŠ
y¥-¹l/»ï#9.#y§ ùg*:`&z(èBˆ:aãz)!ùdo9cêùë+9.£9«(xà ‚Š‹Â‚™[˜İ[Ûˆ^Y\Œ“›Ü›X[]XÚÊ[™^
^Â‚ˆ[™^Bˆš[™[]™U\™Ù][™^
ˆ[™^ˆ
NÂ‚‚ˆYŠ[™^OO[[
^Âˆ™]\›ÂˆB‚‚ˆÙ[XİY[Ûœİ\Bˆ[™^Â‚‚ˆÛÛœİ[Ûœİ\Bˆ[Ûœİ\œÖÚ[™^NÂ‚‚ˆÛÛœİİ]ÌBˆÙ]^Y\Œ˜]Tİ]Ê
NÂ‚‚ˆ[™ÙT^Y\Ø\™
JNÂ‚‚ˆÚİÔÚÚ[˜[YP˜YÙJˆ¹¦kº`&¹¥.ù¤âˆ‹ˆ››Ü›X[‹ˆKˆ[™^ˆÚ[™^Bˆ
NÂ‚‚ˆÛÛœİ]Bˆ›Û]Ú[˜ÙJˆİ]Ì‹˜XØİ\˜XŞKˆÙ][Ûœİ\‘]˜\Ú[ÛŠˆ[Ûœİ\‚ˆ
KˆÙ][Ûœİ\‘XY™•˜[YJˆ^Y\Œ‹ˆœİ[ˆ‚ˆ
KˆÙ]Xİ]™PXØİ\˜XŞP›Û\Ô\˜Ù[
^Y\ŒŠBˆ
NÂ‚‚ˆYŠZ]
^Â‚ˆÚİÓZ\ÜÑY™™Xİ
ˆ˜[ÙKˆ[™^ˆ“RTÔÈ‚ˆ
NÂ‚‚ˆY˜]SÙÊˆˆŠÂˆ^Y\Œ‹šY
Âˆ¹¦kº`&¹¥.ù¤âˆŠÂˆ[Ûœİ\‹›˜[YJÂˆ»ï#9¬¤¹§"ydoy.+{ï H‚ˆ
NÂ‚‚ˆÊ‚ˆ8¦!H9/ë¹«hûï"9ç'ùæ¡9¢o¹b,9§ 9..ú) yæ¡9chy/cùc§ùfè9.¡»ï"{ï&‚ˆ:`&y`"ùaïyo#ù¦+ù¬-9hª9æ¡9¦kº`&¹¥.ù¤â»ï#8à#9¬¤¹doy.+xà#Bˆ:-çøà#9¥.ù¤â¹k£8à#z`&yajy¨§z-ëùo¤{ï#9c§ù§+9k£9aj9¬¤¹§"Bˆ9do9cêİ\]URJ
xà Yš[š\Ú^Y\Xİ[ÛŠ
x %8 %ˆ9¦kº`&¹¥.ù¤â¹¦+ù/oùå*:h.ùã¡ù§ :jæ9æ¡9båy/g;ï#ˆ:`&y.èú(j9¬-9hª9no¹.c¹«ãù«(y¦kº`&¹¥.ù¤âº`ïy§ ú+¤Âˆ9¢,:k)ychy/cù.#ybå{ï#:`&y¡âz*l¹l,y¦+øà#9¢,:k)yb,9. 9cb‚ˆ9chy/cøà#y§ 9..ú) xà y§ 9n.9æo9å'ùæ¡9c§ùfè;ï#ˆ9.#y¦+ú ã9¦kùgíú(c9æ¡9ecúhc8à ‚‚ˆ:(ç9."º`&yajz(c;ï#9¬¤¹doy.+yæ¡9¦`¹`&y.gú) y«hùè®¹íd9§gÂˆ:`&y`"ú)äº"l¹æ¡:(c9båxà yo 9."ù. 9/cy£ª:`,¸à ‚ˆ
‹Â‚ˆ\]URJ
NÂ‚ˆš[š\Ú^Y\Xİ[ÛŠ
NÂ‚ˆ™]\›Â‚ˆB‚‚ˆÛÛœİÜš]™\İ[Bˆ›ÛÜš]XØ[
ˆ^Y\Œ‹ˆœ\ÚXØ[‹ˆÙ][Ûœİ\‘Y™™Xİ]™P[PÜš]
[Ûœİ\ŠKˆ[Ûœİ\‚ˆ
NÂ‚ˆÛÛœİ[XYÙOBˆØ[İ[]Q[XYÙJˆİ]Ì‹˜]XÚËˆÙ][Ûœİ\‘Y™™Xİ]™QY™[œÙJ[Ûœİ\ŠKˆ^Y\Œ‹›]™[ˆ[Ûœİ\‹›]™[ˆ^Y\Œ‹™[[Y[ˆ[Ûœİ\‹™[[Y[ˆÂˆ]XÚÙ\œ^Y\Œ‹ˆ\™Ù]›[Ûœİ\‹ˆÜš]][\Y\˜Üš]™\İ[›][\Y\‚ˆBˆ
NÂ‚‚ˆ[Ûœİ\‹šBˆX]›X^
ˆˆ[Ûœİ\‹šY[XYÙBˆ
NÂ‚‚ˆÚİÓ[Ûœİ\’]
ˆ[™^ˆ[XYÙKˆš‹ˆÜš]™\İ[š\ĞÜš]ˆ
NÂ‚‚ˆY˜]SÙÊ‚ˆˆŠÂˆ^Y\Œ‹šY
Âˆ¹¦kº`&¹¥.ù¤âˆŠÂˆ[Ûœİ\‹›˜[YJÂˆ
ˆÜš]™\İ[š\ĞÜš]ˆÂˆ»ï"9â!¹¤â»ï {ï"H‚ˆ‚ˆˆ‚ˆ
JÂˆ»ï#:`(9¢$ŠÂˆ[XYÙJÂˆ¹`­ùk¬øà ˆ‚‚ˆ
NÂ‚‚ˆYŠ[Ûœİ\‹šL
^ÂˆÚ[[Ûœİ\Š[™^
NÂˆB‚‚ˆÊ‚ˆ8¦!H9/ë¹«hûï"9d#9. 9`"ùaïyo#ùæ¡9cé¹. 9cb»ï#:`&z(èy.gù¯#ù£¢y.¡»ï"{ï&‚ˆ9¥.ù¤â¹doy.+xà z`(9¢$9`­ùk¬ù.bùo£;ï#9. 9ª(ùk£9aj9¬¤¹§"Bˆ9do9cêİ\]URJ
xà Yš[š\Ú^Y\Xİ[ÛŠ
{ï#ˆ:(ç9."»ï#9è®¹/çy¢dù.+yæ¡9 áy¬ày."ù¢,:k)y.gú ïy«hùè®‚ˆ9îo9î£:`,º(c8à ‚ˆ
‹Â‚ˆ\]URJ
NÂ‚ˆš[š\Ú^Y\Xİ[ÛŠ
NÂ‚ŸB‚‚‹Ê‚ˆ8¦!H9ë+9.£:)äº"l¹æ¡9¢ : ïy¥¯y¥/¸à ‚ˆ9alyå*Ø\İ[XYÙTÚÚ[

z(èymì¹í¤ù¢¯yaî¹/¡¹æ¡ˆ:`&¹å*9méyamùaïyo#ûï"Ù]ÚÚ[\™Ù]øà BˆØ[İ[]TÚÚ[[XYÙxà \›ÛÜš]XØ[8à Bˆ\P\›‘Y™™Xİ8à X\Qœ™Y^™QY™™Xİ9ëb{ï"{ï#ˆ:!ê¹mìyía9. 9.ïxà#9¤ãy/g^Y\Œ¸à#yæ¡9¥¯y¥/¹­`yê"ûï#ˆ9.#yæí9£©ydo9cêØØ\İ[XYÙTÚÚ[

Bˆ;ï":`¨ù`"ùaïyo#ùo§ºh+yb,9l/º`ïy¦+ù¤ãy/g^Y\»ï#ˆ9èk:) yalyå*:hª:fª¹«å:!ê¹mìykêù. 9.ïy¦í:jæ;ï"xà ‚Š‹Â‚™[˜İ[ÛˆØ\İ^Y\Œ”ÚÚ[
ÚÚ[YÙ[\’[™^
^Â‚ˆÛÛœİÚÚ[BˆÚÚ[]X˜\ÙVÜÚÚ[YNÂ‚‚ˆÊ‚ˆ8¦!H9/ë¹«hûï":f,¹da»ï#:`oùacyd#9. :hg˜Yùæ¡9am¹.å¹b!¹¥+ûï"{ï&‚ˆ:`&yno¹`"ù£ä9¥ê\™]\›¹æ¡9b!¹¥+ûï#9c§ù§+:`ïy¦+ùæí9£©Bˆ™]\›»ï#9k£9aj9¬¤¹§"ydo9cêÙš[š\Ú^Y\Xİ[ÛŠ
x %8 %ˆ9«hùn.9 áy¬ày."ú`&yno¹`"ù¨§y.í¹.#y¡âz*lº(ªú)î9æoˆ;ï"Ry¡âz*l¹§ ùab9¤âù£¢y¬¤¹kn9§ ËÔÔ9.#z-¬ùæ¡9¢ : ï{ï"{ï#ˆ9/aº$+9. 9ç'ùæ¡9fè9à®¹§ä9ê+¹/¢ùi%¹ áy¬à{ï"9/¢ùi º,áù¥¦Bˆ9¬¤¹l#zob¸à X]]ËX˜]yæ¡9b)9¥­ù¦`¹ªgùmë¹.¡¹. :nç»ï"Bˆ:*©:)î9æo;ï#9. 9ª(ù§ ú+¤ù¢,:k)ychy/cù.#ybå{ï#:-çú`&y«(Bˆ9¢¤ùb,9æ¡9..ú) XYù¦+ùd#9. 9ê+ºhª:fª¸à ‚‚ˆ:`&z(èynjú`&yno¹`"ùb!¹¥+ú`ïz(ç9."¸à#:!ìùl$z+¤ú(c9båBˆ9íd9§gøà y¢,:k)yîo9î£:`,º(c8à#yæ¡9/çz+mûï#9.#y§ ùa£y§"Bˆ9.îù/ey. 9¨§z-ëùo¤z+¤ú`b¹¢,¹chy«nøà ‚ˆ
‹Â‚ˆYŠ\ÚÚ[
^Â‚ˆš[š\Ú^Y\Xİ[ÛŠ
NÂ‚ˆ™]\›Â‚ˆB‚‚ˆÛÛœİ]™[BˆÙ]ÚÚ[]™[
ˆœ^Y\Œˆ‹ˆÚÚ[Yˆ
NÂ‚‚ˆYŠ]™[L
^Â‚ˆš[š\Ú^Y\Xİ[ÛŠ
NÂ‚ˆ™]\›Â‚ˆB‚‚ˆÛÛœİÜÛÜİBˆÚÚ[œÜÛÜİOO][™Yš[™YˆÂˆÚÚ[œÜÛÜİˆ‚ˆÚÚ[˜ÛÜİÂ‚ˆYŠ^Y\Œ‹œÜÜÛÜİ
^Â‚ˆš[š\Ú^Y\Xİ[ÛŠ
NÂ‚ˆ™]\›Â‚ˆB‚‚ˆÛÛœİY™™Xİ]™U\™Ù]\OYÙ]Y™™Xİ]™TÚÚ[\™Ù]\JÚÚ[]™[
NÂˆÙ[\’[™^[›Ü›X[^™P˜]U\™Ù]\JY™™Xİ]™U\™Ù]\JOOOH˜[‚ˆÛ[ˆ™š[™[]™U\™Ù][™^
Ù[\’[™^Y™™Xİ]™U\™Ù]\JNÂ‚ˆYŠ›Ü›X[^™P˜]U\™Ù]\JY™™Xİ]™U\™Ù]\JHOOH˜[‰‰˜Ù[\’[™^OO[[
^Âˆš[š\Ú^Y\Xİ[ÛŠ
NÂˆ™]\›ÂˆB‚ˆÛÛœİ\™Ù]ÏYÙ]ÚÚ[\™Ù]ÊÙ[\’[™^Y™™Xİ]™U\™Ù]\JNÂˆYŠ]\™Ù]Ë›[™İ
^Âˆš[š\Ú^Y\Xİ[ÛŠ
NÂˆ™]\›ÂˆB‚ˆ^Y\Œ‹œÜO\ÜÛÜİÂ‚‚ˆ[™ÙT^Y\Ø\™
JNÂ‚‚ˆÚİÔÚÚ[˜[YP˜YÙJˆÚÚ[›˜[YKˆÚÚ[™[[Y[ˆKˆY™™Xİ]™U\™Ù]\OOOH˜[Û[˜Ù[\’[™^ˆ\™Ù]Ëˆ[™Yš[™YˆY™™Xİ]™U\™Ù]\Bˆ
NÂ‚‚ˆÙ][Y[İ]


OOÂ‚ˆÚİÔ^Y\”ÜÜ\
ˆÜÛÜİˆBˆ
NÂ‚ˆKL
NÂ‚‚ˆÛÛœİİ]ÌBˆÙ]^Y\Œ˜]Tİ]Ê
NÂ‚‚ˆÛÛœİİ]›Û\ÏBˆÚÚ[˜Ø]YÛÜOOOH›XYÚXÈ‚ˆÂˆİ]Ì‹›XYÚXĞ]XÚÂˆ‚ˆİ]Ì‹˜]XÚÎÂ‚‚‚ˆÊ‚ˆ9í%9£©ùh-9¢ : ï{ï"9/¢ùi ¹a¬9l {ï#9¬¤¹§"X˜\ÙQ[XYÙ{ï"{ï&‚ˆ9.#z*"9ë¥ù`­ùk¬Ëùdoy.+{ï#9æí9£©z-äyål9n.9âà9¡bùdoy.+yak9o#øà ‚ˆ
‹Â‚ˆÊ‚ˆ8¦!H9/ë¹«hûï"9/§yáiù/oùå*: !z) y¬`»ï#8à#9¤¬¹ên¹l,y.#z(c8à#{ï"{ï&‚ˆ9c§ù§+:`&z(èy¦+øà#Ù[\’[™^9£!ùb,9æ¡9 *¹âjz`¡9­.ú$eÂˆ9¢cz&eyä!»ï#9«nù.¡¹l,y¥m9«­z-ìú`c¸à yæí9£©\™]\›¸à#{ï#ˆ9ëby¥¯:c¥¹k¦¹æ¡9æë¹ª&z(ªúf¢¹câùab9¢dù«nù¦`»ï#:`&y`"ù£©ùh-ˆ9¢ : ïy§ ùæí9£©y¢dùên¹¬(ûï#9ãªyk­¹¦#¹¦#º`n9.¡¹¥¯y¥/»ï#ˆ9åjúgh¹cnù.à:n¯9.¢ú`ïy¬¤¹æo9å'øà z`(ù¢,:k)yí :c!:`ïy.#y§ Âˆ9i&¹. :(c9keøà ‚‚ˆ9¥.y¢$:-çù¦kº`&¹¥.ù¤â‹ù`­ùk¬ù¢ : ïy. :!í;ï#9ab9å*ˆš[™[]™U\™Ù][™^

yè®º*£yæë¹ª&{ï#9«nù.¡‚ˆ9l,z!ê¹båz/by¢dØİ\œ™[˜]S[Ûœİ\œú(èyë+9. :f®Âˆ:`¡9­.ú$eùæ¡9 *¹âj{ï&ùç'ùæ¡9aj9®áy.¡¹¢c\™]\›‚ˆ;ï":`&z(èy.#zg :) ycé¹i%¹do9cêÙš[š\Ú^Y\Xİ[ÛŠ
{ï#ˆ9do9cêùêëØØ\İ^Y\Œ”ÚÚ[9æ¡9."¹liˆ^Xİ]PXİ[Û‹Ü™\ÛÛ™T]Y]YY^Y\Xİ[Û‚ˆ9§+9/¡¹l,y§ ùá(y¨§y.íº(ç9do9cêù. 9«({ï#9c§ùfèˆ:-çÜ^Y\Œ“›Ü›X[]XÚÊ
z`¨ù«(y/ë¹«hù. 9ª(ûï"xà ‚ˆ
‹Â‚ˆYŠ\ÚÚ[˜˜\ÙQ[XYÙJ^ÂˆÛÛœİœ™Y^™PÚ[˜ÙOYÙ]ÚÚ[œ™Y^™PÚ[˜ÙP]]™[
ÚÚ[]™[
NÂˆÛÛœİœ™Y^™Q\˜][ÛYÙ]ÚÚ[œ™Y^™Q\˜][Û]]™[
ÚÚ[]™[
NÂˆ\™Ù]Ë™›Ü‘XXÚ
[™^OÂˆÛÛœİ[Ûœİ\[[Ûœİ\œÖÚ[™^NÂˆYŠ[[Ûœİ\Ÿ[[Ûœİ\‹˜[]™_œ™Y^™PÚ[˜ÙOL
^È™]\›ÈBˆÛÛœİœ™Y^™T™\İ[\›Û˜[YY\œÚ\İ[İ]\ÑY™™Xİ
ˆ[Ûœİ\‹™œ™Y^™H‹Âˆœ™Y^™PÚ[˜ÙK^Y\Œ‹›]™[[Ûœİ\‹›]™[ˆİ]Ì‹š[[YÙ[˜ÙKÙ][Ûœİ\‘Y™™Xİ]™TÜ\š]Ú[Ê[Ûœİ\ŠKˆYKÙ][Ûœİ\”˜[šÊ[Ûœİ\ŠBˆK›[Ûœİ\ˆ‹[™^ÚÚ[›˜[YBˆ
NÂˆYŠœ™Y^™T™\İ[š]
^Âˆ\Qœ™Y^™QY™™Xİ
[Ûœİ\‹œ™Y^™Q\˜][ÛŠNÂˆY˜]SÙÊ[Ûœİ\‹›˜[YJÈº(ªùa¬9l y.¡»ï HŠNÂˆY[ÙHYŠYœ™Y^™T™\İ[™\XØ]J^ÂˆÚİÓZ\ÜÑY™™Xİ
˜[ÙK[™^¹¢­y¢¥ÈŠNÂˆY˜]SÙÊÚÚ[›˜[YJÈ¹l#HŠÛ[Ûœİ\‹›˜[YJÈ¹¬¤¹§"yå'ù¥b;ï"9¢­y¢¥ûï"xà ˆŠNÂˆBˆJNÂˆ™]\›ÂˆB‚‚ˆÊ‚ˆ8¦!H9¥¬9h§»ï"9/§yáiù/oùå*: !z) y¬`»ï#9àjùë«y¢ : ïBˆ:hæú(c9âny¥b;ï#^Y\Œ¹âb9§+;ï#:-çÜ^Y\Œyæ¡ˆØ\İ[XYÙTÚÚ[

yd#9. 9.ïz`£ú/+ûï#9/¡¹®¤ˆ9¥.y¢$˜]T^Y\Ø\™{ï"{ï&‚ˆ
‹Â‚ˆYŠÚÚ[YOOH™š\™T›ØÚÙ]Š^Â‚ˆ^Qš\™T›ØÚÙ][š[X][ÛŠˆ˜˜]T^Y\Ø\™H‹ˆ\™Ù]Ë›X\
ˆ[™^Oˆ˜˜]S[Ûœİ\ˆŠÚ[™^ˆ
Bˆ
NÂ‚ˆB‚‚ˆ]İ[Y™\İX[LÂ‚‚ˆ\™Ù]Ë™›Ü‘XXÚ
[™^OÂ‚ˆÛÛœİ[Ûœİ\Bˆ[Ûœİ\œÖÚ[™^NÂ‚‚ˆYŠˆ[[Ûœİ\ˆˆ[[Ûœİ\‹˜[]™Bˆ
^Âˆ™]\›ÂˆB‚‚ˆÊ‚ˆ8¦!H9¥¬9h§»ï"9/§yáiù/oùå*: !z) y¬`»ï"{ï&‚ˆ9a¬9¥âù. :e ùl"9lk9æ¡:hæú(c9båyåjûï#9ë+9.£:)äº"l‚ˆ9¥¯y¥/¹¦`º-múnç¹¦+Ø˜]T^Y\Ø\™{ï#ˆ:`£ú/+ú-çØØ\İ[XYÙTÚÚ[

z(èyæ¡^Y\ŒBˆ9âb9§+9k£9aj9. :!í8à ‚ˆ
‹Â‚ˆYŠÚÚ[šYOOHšXÙTÜ[ˆŠ^Â‚ˆ^RXÙTÜ[”›Ú™Xİ[JˆKˆ[™^ˆ
NÂ‚ˆB‚‚ˆÛÛœİ]Bˆ›Û]Ú[˜ÙJˆİ]Ì‹˜XØİ\˜XŞKˆÙ][Ûœİ\‘]˜\Ú[ÛŠˆ[Ûœİ\‚ˆ
KˆÙ][Ûœİ\‘XY™•˜[YJˆ^Y\Œ‹ˆœİ[ˆ‚ˆ
KˆÙ]Xİ]™PXØİ\˜XŞP›Û\Ô\˜Ù[
^Y\ŒŠBˆ
NÂ‚‚ˆYŠZ]
^Â‚ˆÚİÓZ\ÜÑY™™Xİ
ˆ˜[ÙKˆ[™^ˆ“RTÔÈ‚ˆ
NÂ‚‚ˆY˜]SÙÊˆÚÚ[›˜[YJÂˆ¹l#HŠÂˆ[Ûœİ\‹›˜[YJÂˆ»ï#9¬¤¹§"ydoy.+{ï H‚ˆ
NÂ‚ˆ™]\›Â‚ˆB‚‚ˆÛÛœİÜš]™\İ[Bˆ›ÛÜš]XØ[
ˆ^Y\Œ‹ˆÚÚ[˜Ø]YÛÜKˆÙ][Ûœİ\‘Y™™Xİ]™P[PÜš]
[Ûœİ\ŠKˆ[Ûœİ\‚ˆ
NÂ‚ˆÛÛœİ[XYÙOBˆØ[İ[]TÚÚ[[XYÙJÂˆÚÚ[œÚÚ[ˆÚÚ[]™[›]™[ˆY™™Xİ]™P]XÚÎœİ]›Û\Ëˆ\™Ù]›[Ûœİ\‹ˆØ\İ\“]™[œ^Y\Œ‹›]™[ˆØ\İ\‘[[Y[œ^Y\Œ‹™[[Y[ˆ]XÚÙ\œ^Y\Œ‹ˆÜš]][\Y\˜Üš]™\İ[›][\Y\‚ˆJNÂ‚ˆÛÛœİ™Y›Ü™Q\™Xİ[XYÙO[[Ûœİ\‹šÂ‚ˆ[Ûœİ\‹šBˆX]›X^
ˆˆ[Ûœİ\‹šY[XYÙBˆ
NÂ‚‚ˆÚİÓ[Ûœİ\’]
ˆ[™^ˆ[XYÙKˆš‹ˆÜš]™\İ[š\ĞÜš]ˆ
NÂ‚ˆÛÛœİXİX[[XYÙQX[SX]›X^
™Y›Ü™Q\™Xİ[XYÙK[[Ûœİ\‹š
NÂ‚‚ˆY˜]SÙÊ‚ˆÚÚ[›˜[YJÂˆ¹doy.+HŠÂˆ[Ûœİ\‹›˜[YJÂˆ
ˆÜš]™\İ[š\ĞÜš]ˆÂˆ»ï"9â!¹¤â»ï {ï"H‚ˆ‚ˆˆ‚ˆ
JÂˆ»ï#:`(9¢$ŠÂˆ[XYÙJÂˆ¹`­ùk¬øà ˆ‚‚ˆ
NÂ‚‚ˆYŠÚÚ[˜\›Ú[˜ÙJ^Â‚ˆÛÛœİ\›”™\İ[Bˆ›Û˜[YY\œÚ\İ[İ]\ÑY™™Xİ
ˆ[Ûœİ\‹ˆ˜\›ˆ‹ˆÂˆÚÚ[˜\›Ú[˜ÙKˆ^Y\Œ‹›]™[ˆ[Ûœİ\‹›]™[ˆİ]Ì‹š[[YÙ[˜ÙKˆÙ][Ûœİ\‘Y™™Xİ]™TÜ\š]Ú[Ê[Ûœİ\ŠBˆKˆ›[Ûœİ\ˆ‹ˆ[™^ˆÚÚ[›˜[YKˆÚÚ[™İX\˜[YY\›OO]YBˆ
NÂ‚‚ˆYŠ\›”™\İ[š]
^Â‚ˆ\P\›‘Y™™Xİ
ˆ[Ûœİ\‹ˆÚÚ[˜\›‘\˜][Û‹ˆÚÚ[˜\›”\˜Ù[S]™[Âˆ]™[LBˆBˆ
NÂ‚‚ˆY˜]SÙÊˆˆŠÂˆ[Ûœİ\‹›˜[YJÂˆºfmùaiyáàùáä¹âà9¡bûï H‚ˆ
NÂ‚ˆB‚ˆB‚‚ˆYŠÚÚ[™œ™Y^™PÚ[˜ÙJ^Â‚ˆÛÛœİœ™Y^™T™\İ[Bˆ›Û˜[YY\œÚ\İ[İ]\ÑY™™Xİ
ˆ[Ûœİ\‹ˆ™œ™Y^™H‹ˆÂˆÚÚ[™œ™Y^™PÚ[˜ÙKˆ^Y\Œ‹›]™[ˆ[Ûœİ\‹›]™[ˆİ]Ì‹š[[YÙ[˜ÙKˆÙ][Ûœİ\‘Y™™Xİ]™TÜ\š]Ú[Ê[Ûœİ\ŠKˆYKˆÙ][Ûœİ\”˜[šÊ[Ûœİ\ŠBˆKˆ›[Ûœİ\ˆ‹ˆ[™^ˆÚÚ[›˜[YBˆ
NÂ‚‚ˆYŠœ™Y^™T™\İ[š]
^Â‚ˆ\Qœ™Y^™QY™™Xİ
ˆ[Ûœİ\‹ˆÚÚ[™œ™Y^™Q\˜][Û‚ˆ
NÂ‚‚ˆY˜]SÙÊˆˆŠÂˆ[Ûœİ\‹›˜[YJÂˆº(ªùa¬9l y.¡»ï H‚ˆ
NÂ‚ˆB‚ˆB‚‚ˆÊ‚ˆ8¦!H9¥¬9h§»ï"9/§yáiù/oùå*: !z) y¬`»ï#9£©y."ºhª9ìîËÂˆ9g'ùìîù¢ : ïyæ¡:fa9b¨9¥b9§§;ï#:-çÜ^Y\Œyæ¡ˆØ\İ[XYÙTÚÚ[

y¦+ùd#9. 9.ïz`£ú/+ûï"{ï&‚ˆ
‹Â‚ˆ\TÚÚ[XY™‘Y™™XİÊˆÚÚ[ˆ]™[ˆ[Ûœİ\‹ˆ[™^ˆ^Y\Œ‹›]™[ˆÚÚ[˜Ø]YÛÜOOOHœ\ÚXØ[Üİ]Ì‹˜]XÚÔÚ[Îœİ]Ì‹š[[YÙ[˜ÙBˆ
NÂ‚‚ˆYŠÚÚ[›Y™\İX[\˜Ù[S]™[
^Â‚ˆİ[Y™\İX[
ÏBˆXİX[[XYÙQX[Â‚ˆB‚‚ˆYŠ[Ûœİ\‹šL
^ÂˆÚ[[Ûœİ\Š[™^
NÂˆB‚ˆJNÂ‚‚ˆYŠˆÚÚ[›Y™\İX[\˜Ù[S]™[	‰‚ˆİ[Y™\İX[Œˆ
^Â‚ˆÛÛœİY™\İX[\˜Ù[BˆÚÚ[›Y™\İX[\˜Ù[S]™[Âˆ]™[LBˆNÂ‚‚ˆÛÛœİY™\İX[[[İ[BˆX]™›ÛÜŠˆİ[Y™\İX[
‚ˆY™\İX[\˜Ù[ÂˆLˆ
NÂ‚‚ˆ^Y\Œ‹šBˆX]›Z[Šˆİ]Ì‹›X^ˆ^Y\Œ‹š
ÂˆY™\İX[[[İ[ˆ
NÂ‚‚ˆ^Y\Œ‹œÜBˆX]›Z[Šˆİ]Ì‹›X^Ôˆ^Y\Œ‹œÜ
ÂˆY™\İX[[[İ[ˆ
NÂ‚‚ˆÚİÔ^Y\’]
ˆY™\İX[[[İ[ˆšX[‹ˆKˆYBˆ
NÂ‚‚ˆY˜]SÙÊˆˆŠÂˆ^Y\Œ‹šY
Âˆ¹d.9¥-¹`­ùk¬ùfç¹oªy.¡ˆŠÂˆY™\İX[[[İ[
Âˆºnç’:"!ÔÔ8à ˆ‚ˆ
NÂ‚ˆB‚‚ˆÊ‚ˆ8¦!H9¥¬9h§»ï"9/§yáiù/oùå*: !z) y¬`»ï#9£©y."¹g'ùìîùæ¡ˆ:!êº.ªú+mùæï»ï#ùaj:jå:+mùæï¹¢ : ï{ï#^Y\Œ¹âb9§+;ï#ˆ:-çÜ^Y\Œyæ¡Ø\İ[XYÙTÚÚ[

y¦+ùd#9. 9.ïBˆ:`£ú/+ûï"{ï&‚ˆ
‹Â‚ˆYŠÚÚ[œÙ[”ÚY[S]™[	‰˜Ø[\S˜[YY\œÚ\İ[İ]Jˆ^Y\Œ‹œÚY[‹œ^Y\ˆ‹KÚÚ[›˜[YBˆ
J^Â‚ˆÛÛœİÚY[[[İ[BˆÚÚ[œÙ[”ÚY[S]™[Âˆ]™[LBˆNÂ‚‚ˆ^Y\Œ‹˜Xİ]™PY™œÏJ^Y\Œ‹˜Xİ]™PY™œß×JK™š[\ŠY™O‚ˆXY™ŸY™‹\HOOHœÚY[Ÿ[X™\ŠY™‹\›œÓY
OŒ	‰“[X™\ŠY™‹œ™[XZ[š[™ÊOŒˆ
NÂ‚‚ˆ^Y\Œ‹˜Xİ]™PY™œËœ\Ú
X\šÔ\œÚ\İ[İ]S˜[YJÂˆ\NˆœÚY[‹ˆ\›œÓY‚ˆÚÚ[œÚY[\˜][ÛŸ‹ˆ™[XZ[š[™Î‚ˆÚY[[[İ[‚ˆKœÚY[ŠJNÂ‚‚ˆY˜]SÙÊˆˆŠÂˆ^Y\Œ‹šY
Âˆ¹ãl¹o¥ÈŠÂˆÚY[[[İ[
Âˆºnçº+mùæï»ï#9£ yî£ŠÂˆ
ÚÚ[œÚY[\˜][ÛŸŠJÂˆ¹fç¹d"8à ˆ‚ˆ
NÂ‚ˆB‚‚ˆYŠÚÚ[˜[TÚY[S]™[
^Â‚ˆÛÛœİÚY[[[İ[BˆÚÚ[˜[TÚY[S]™[Âˆ]™[LBˆNÂ‚‚ˆÙ]Ú\˜Xİ\œÊ
K™›Ü‘XXÚ
ˆ
Ú\˜Xİ\‹\™Ù][™^
OOÂ‚ˆYŠˆÚ\˜Xİ\‹šLˆ
^Âˆ™]\›ÂˆB‚ˆYŠXØ[\S˜[YY\œÚ\İ[İ]JˆÚ\˜Xİ\‹œÚY[‹œ^Y\ˆ‹\™Ù][™^ÚÚ[›˜[YBˆ
J^È™]\›ÈB‚ˆÚ\˜Xİ\‹˜Xİ]™PY™œÏJÚ\˜Xİ\‹˜Xİ]™PY™œß×JK™š[\ŠY™O‚ˆXY™ŸY™‹\HOOHœÚY[Ÿ[X™\ŠY™‹\›œÓY
OŒ	‰“[X™\ŠY™‹œ™[XZ[š[™ÊOŒˆ
NÂ‚‚ˆÚ\˜Xİ\‹˜Xİ]™PY™œËœ\Ú
X\šÔ\œÚ\İ[İ]S˜[YJÂˆ\NˆœÚY[‹ˆ\›œÓY‚ˆÚÚ[œÚY[\˜][ÛŸ‹ˆ™[XZ[š[™Î‚ˆÚY[[[İ[‚ˆKœÚY[ŠJNÂ‚ˆBˆ
NÂ‚‚ˆY˜]SÙÊˆ¹¢$y¥®yaj:jå9ãl¹o¥ÈŠÂˆÚY[[[İ[
Âˆºnçº+mùæï»ï#9£ yî£ŠÂˆ
ÚÚ[œÚY[\˜][ÛŸŠJÂˆ¹fç¹d"8à ˆ‚ˆ
NÂ‚ˆB‚‚ˆ\]URJ
NÂ‚ˆš[š\Ú^Y\Xİ[ÛŠ
NÂ‚ŸB‚‚‹ÊˆOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOBˆLˆ8 %9 *¹âjzaäynhù£¢z$/Bˆ9gî¹é#¹`/:-çù *¹âjyëbyí&¹¢$:emûï&ùì¯º"ìKĞ“ÔÔù£ä:jæ9`#yã¡ûï#9.)¹/çyåfyl$zaãúfª9ªgù­k¹båxà ‚OOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOH
‹Â‚™[˜İ[ÛˆÙ][Ûœİ\‘ÛÛ›Ü
[Ûœİ\Š^ÂˆYŠ[[Ûœİ\Š^Âˆ™]\›ˆÂˆB‚ˆÛÛœİ]™[SX]›X^
KX]™›ÛÜŠ[X™\Š[Ûœİ\‹›]™[
_JJNÂˆÛÛœİ˜[šÏYÙ][Ûœİ\”˜[šÊ[Ûœİ\ŠNÂˆÛÛœİ˜[šÓ][\Y\Bˆ˜[šÏOOH˜›ÜÜÈ‚ˆÈˆˆ˜[šÏOOH™[]H‚ˆÈÂˆˆNÂ‚ˆÛÛœİ˜\ÙO[]™[
ŒŠÌÎÂˆÛÛœİ˜\šX[˜ÙOLJÓX]œ˜[™ÛJ
JŒŒÌÂ‚ˆ™]\›ˆX]›X^
ˆKˆX]™›ÛÜŠ˜\ÙJœ˜[šÓ][\Y\Š˜\šX[˜ÙJBˆ
NÂŸB‚™[˜İ[Ûˆ]Ø\™[Ûœİ\‘ÛÛ›Ü
[Ûœİ\Š^ÂˆÛÛœİ[[İ[YÙ][Ûœİ\‘ÛÛ›Ü
[Ûœİ\ŠNÂ‚ˆYŠ[[İ[L
^Âˆ™]\›ˆÂˆB‚ˆÛÛ
ÏX[[İ[Âˆ\]QÛÛ\Ü^J
NÂ‚ˆY˜]SÙÊˆ[Ûœİ\‹›˜[YJÂˆ¹£¢z$/HŠÂˆ[[İ[
Âˆˆ:aäynhøà ˆ‚ˆ
NÂ‚ˆ™]\›ˆ[[İ[ÂŸB‚‚‹ÊˆOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOBˆ9 *¹âjy«nù.¨BOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOH
‹Â‚™[˜İ[ÛˆÚ[[Ûœİ\Š[™^
^Â‚ˆÛÛœİ[Ûœİ\ˆBˆ[Ûœİ\œÖÚ[™^NÂ‚‚ˆYŠˆ[[Ûœİ\ˆˆ[[Ûœİ\‹˜[]™Bˆ
^Âˆ™]\›ÂˆB‚‚ˆ[Ûœİ\‹˜[]™OY˜[ÙNÂ‚ˆ[Ûœİ\‹šLÂ‚ˆ[Ûœİ\‹œÜLÂ‚‚ˆÛÛœİØ\™Bˆ	
˜˜]S[Ûœİ\ˆŠÚ[™^
NÂ‚‚ˆYŠØ\™
^Â‚ˆÊ‚ˆ8¦!H9/ë¹«hûï&‚ˆ9c§ù§+9. 9¤â¹«®¹«nù *¹âjyæ¡9åm¹."ûï#ˆ9êâùb.ù¢¢‹™XY:`&y`"ØÛ\Üûï"ÜXÚ]N‹ŒM»ï"Bˆ9b¨9."¹c®ûï#9/a¹`­ùk¬ù­k¹båy¥n9keù¦+ú`&yo-ychyâaÂˆ9æ¡8à#9kd9a`ùí(8à#{ï#ÜXÚ]y§ ùæí9£©z`(ùn-‚ˆ9¢¢º`¡9g*:há9æ¡9`­ùk¬ù¥n9keù. :-mú+¢¹¦¥ûï#ˆ9bfùioy¢dù«nùæ¡:`¨ù. 9."ùcãz #9§ 9.#yk®y¦$ùç"ù®!y©f¹`­ùk¬øà ‚‚ˆ9¥.y¢$9ab9b¨™Z[™ûï"9cê¹¤âúnç¹¤â»ï#9.#z+¢¹¦¥ûï"{ï#ˆ9ëby`­ùk¬ù¥n9keùbåyåjûï"K9éä»ï"z-äyk£9.bùo£ˆ9¢cyç'ù«hùb¨9."‹™XY:+¤ùchyâaú+¢¹¦¥ûï#ˆ9ajz !zh!¹n£ùl#z*¯ùl,y.#y§ ù.¤¹æî9olzgïù.¡¸à ‚ˆ
‹Â‚ˆØ\™˜Û\ÜÓ\İ˜Y
ˆ™Z[™È‚ˆ
NÂ‚‚ˆÙ][Y[İ]


OOÂ‚ˆØ\™˜Û\ÜÓ\İœ™[[İ™Jˆ™Z[™È‚ˆ
NÂ‚ˆØ\™˜Û\ÜÓ\İ˜Y
ˆ™XY‚ˆ
NÂ‚ˆKNL
NÂ‚ˆB‚‚ˆÊ‚ˆ8¦!H9 *¹âjy«nù.¨yo£9.gú) yg*9g,9g%¹."ºf¬z%ãûï#ˆ:`oùacyfç¹b,9g,9g%¹¦`¹ç"ùb,9mì¹«nù *¹âjyæ¡9g%¹é.¸à ‚ˆ
‹Â‚ˆÛÛœİX\XÛÛˆBˆ	
›X\[Ûœİ\ˆŠÚ[™^
NÂ‚‚ˆYŠX\XÛÛŠ^Â‚ˆX\XÛÛ‹œİ[K™\Ü^HBˆ››Û™HÂ‚ˆB‚‚ˆY˜]SÙÊ‚ˆˆŠÂˆ[Ûœİ\‹›˜[YJÂˆº(ªù¤â¹¥eøà ˆ‚‚ˆ
NÂ‚‚ˆÊ‚ˆ8¦!H9¥¬9h§»ï"9/§yáiù/oùå*: !z) y¬`»ï#9..ùgã¹g%ºddKÂˆ9«ãù¥éy.îùbæKù¢$9l,yìîùíl{ï"{ï&‚ˆ:`&z(èy¦+øà#9 *¹âjyç'ùæ¡:(ªù¢dù«nøà#ye+ù. 9§ ùí¤ú`c‚ˆ9æ¡9g,9¥®{ï#9g%ºddyæ¡9¤â¹«®¹¥n8à y«ãù¥éy.îùbæyæ¡ˆ9¤â¹¥eù *¹âjz`,¹n©¸à y¢$9l,yæ¡9í+ú*"9¤â¹«®¹¥n;ï#ˆ9aj:`ê9g*:`&z(èy. 9«(z*&:c!;ï#9.#yå*9g*9¢,:k)yæ¡ˆ9«ãù`"ùb!¹¥+ùd!:!êºaãz)!ùb)9¥­ù. 9«(xà ‚ˆ
‹Â‚ˆÛÛœİ›ÜÜÓİÛ™\]\[ÙˆÚ[™İÈOOH[™Yš[™YİÚ[™İË‘›İ\”Ş[X›ÛĞ›ÜÜĞ˜]N›[ÂˆYŠ›ÜÜÓİÛ™\‰‰\[Ùˆ›ÜÜÓİÛ™\‹›Û‘[™[^QX]OOH™[˜İ[ÛˆŠ^Âˆ›ÜÜÓİÛ™\‹›Û‘[™[^QX]
[™^[Ûœİ\ŠNÂˆB‚ˆYŠ[[Ûœİ\‹››Ô™]Ø\™Ê^Âˆ™XÛÜ™[Ûœİ\’Ú[›Ü™\İX\J[Ûœİ\ŠNÂˆ]Ø\™[Ûœİ\‘ÛÛ›Ü
[Ûœİ\ŠNÂˆÊˆ9 *¹âjy£¢z$/z"!ù¤â¹«®º`,¹n©¹. :-mùclù¦`¹kf9ª¥;ï#:`oùacy.+z`%9¢,9¥eËùb!ú ã9¦kú`n¹i,xà ˆ
‹ÂˆØ]™QØ[YJ
NÂˆB‚‚ˆ\]S[Ûœİ\•RJ[™^
NÂ‚ŸB‚‚‹ÊˆOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOBˆ9¢,:k)yåjúgh‚OOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOH
‹Â‚˜ÛÛœİUWÔ‘S‘T—ÒÓÒ×ÓÔ‘TSØš™Xİ™œ™Y^™JÂˆ™Y›Ü™N“Øš™Xİ™œ™Y^™JÂˆŒMN™\\™P˜]T™[™\ˆ‹ˆŒMT™\\™P˜]T™[™\ˆ‚ˆJKˆY\“Øš™Xİ™œ™Y^™JÂˆŒLÌPY\˜]T™[™\ˆ‹ˆŒMPY\˜]T™[™\ˆ‹ˆŒMĞY\˜]T™[™\ˆ‹ˆŒMMY\˜]T™[™\ˆ‹ˆŒMÌÍLPY\˜]T™[™\ˆ‹ˆ‘š^YÛİY\˜]T™[™\ˆ‚ˆJBŸJNÂ‚™[˜İ[Ûˆ[˜]T™[™\’ÛÚÜÊ\ÙKÛÛ^\™ÜÊ^ÂˆÛÛœİ›Ûİ]\[ÙˆÚ[™İÈOOH[™Yš[™Y‚ˆÈÚ[™İÂˆˆ
\[ÙˆÛØ˜[\ÈOOH[™Yš[™YˆÈÛØ˜[\Èˆ[
NÂˆÛÛœİÛÚÓ˜[Y\ÏPUWÔ‘S‘T—ÒÓÒ×ÓÔ‘T–Ü\ÙW_×NÂˆÛÚÓ˜[Y\Ë™›Ü‘XXÚ
˜[YOOÂˆÛÛœİÛÚÏ\›Ûİ	‰œ›ÛİÛ˜[YWNÂˆYŠ\[ÙˆÛÚÏOOH™[˜İ[ÛˆŠ^ÂˆÛÚË˜\JÛÛ^\™ÜÊNÂˆBˆJNÂŸB‚šYŠ\[ÙˆÚ[™İÈOOH[™Yš[™YŠ^ÂˆÚ[™İË‘›İ\”Ş[X›ÛĞ˜]T™[™\’ÛÚÓÜ™\PUWÔ‘S‘T—ÒÓÒ×ÓÔ‘TÂŸB‚™[˜İ[Ûˆ\Ğ˜]Tİ]\Ò[œÜXİ[Û›ØÚÙY

^ÂˆYŠX˜]PXİ]™J^È™]\›ˆYNÈBˆÛÛœİXİ[Û”™YÚ[ÛI
˜˜]PXİ[Û”™YÚ[ÛˆŠNÂˆYŠXİ[Û”™YÚ[Û‰‰˜Xİ[Û”™YÚ[Û‹˜Û\ÜÓ\İ˜ÛÛZ[œÊ\™Ù]\Ù[Xİ[™ÈŠJ^Âˆ™]\›ˆYNÂˆBˆ™]\›ˆHYØİ[Y[œ]Y\TÙ[XİÜŠˆˆØ˜]TYÙH˜˜]K[[Ûœİ\‹\™Ù]X›KØ˜]TYÙH˜˜]K\^Y\‹˜[K]\™Ù]X›H‚ˆ
NÂŸB‚™[˜İ[Ûˆ˜]Tİ]\Ñ[[Y[X™[
[]J^ÂˆÛÛœİÙ^OTİš[™Ê[]I‰™[]K™[[Y[ˆŠNÂˆYŠ\[Ùˆ[[Y[]X˜\ÙHOOH[™Yš[™Y‰‰™[[Y[]X˜\ÙI‰™[[Y[]X˜\ÙVÚÙ^WJ^Âˆ™]\›ˆ[[Y[]X˜\ÙVÚÙ^WK›˜[Y_[[Y[]X˜\ÙVÚÙ^WK›X™[ˆ
Ùš\™Nˆ¹àjÈ‹Ø]\ˆ¹¬-‹Ú[™ˆºhª‹X\ˆ¹g'È‹YÚˆ¹a`ùabHŸVÚÙ^W_Ù^_¹á(HŠNÂˆBˆ™]\›ˆ
Ùš\™Nˆ¹àjÈ‹Ø]\ˆ¹¬-‹Ú[™ˆºhª‹X\ˆ¹g'È‹YÚˆ¹a`ùabHŸVÚÙ^W_Ù^_¹á(HŠNÂŸB‚™[˜İ[Ûˆ[œİ\™P˜]Tİ]\Ñ]Z[[Ù[

^Âˆ][Ù[YØİ[Y[™Ù][[Y[RY
˜˜]Tİ]\Ñ]Z[[Ù[ŠNÂˆYŠ[Ù[
^È™]\›ˆ[Ù[ÈBˆ[Ù[YØİ[Y[˜Ü™X]Q[[Y[
™]ˆŠNÂˆ[Ù[šYH˜˜]Tİ]\Ñ]Z[[Ù[Âˆ[Ù[˜Û\ÜÓ˜[YOH˜˜]K\İ]\ËY]Z[[[Ù[Âˆ[Ù[šY[]YNÂˆ[Ù[œÙ]]šX]J˜\šXKZY[ˆ‹YHŠNÂˆ[Ù[š[›™\’SBˆ	Ï]ˆÛ\ÜÏH˜˜]K\İ]\ËY]Z[\[™[ˆ›ÛOH™X[ÙÈˆ\šXK[[Ù[HYHˆ\šXK[X™[YOH˜˜]Tİ]\Ñ]Z[]H‰ÊÂˆ	Ï]Ûˆ\OH˜]ÛˆˆÛ\ÜÏH˜˜]K\İ]\ËY]Z[XÛÜÙHˆ\šXK[X™[Hºeç:e¢H°åÏØ]Û‰ÊÂˆ	ÏÈYH˜˜]Tİ]\Ñ]Z[]H¹¢,:k)yâà9¡bÏÚÏ‰ÊÂˆ	Ï]ˆÛ\ÜÏH˜˜]K\İ]\ËY]Z[XÛÜ™H‰ÊÂˆ	ÏÜ[ˆ]KYšY[H™[[Y[ÜÜ[‰ÊÂˆ	ÏÜ[ˆ]KYšY[H›˜[YHÜÜ[‰ÊÂˆ	ÏÜ[ˆ]KYšY[HšÜÜ[‰ÊÂˆ	ÏÜ[ˆ]KYšY[HœÜÜÜ[‰ÊÂˆ	ÏÙ]‰ÊÂˆ	ÏÙXİ[Û¹h§¹æâ¹âà9¡bûï&Ú]ˆ]K[\İH˜Y™œÈˆÛ\ÜÏH˜˜]K\İ]\ËY]Z[[\İÙ]ÜÙXİ[Û‰ÊÂˆ	ÏÙXİ[Ûº,¨:gh¹âà9¡bûï&Ú]ˆ]K[\İH™XY™œÈˆÛ\ÜÏH˜˜]K\İ]\ËY]Z[[\İÙ]ÜÙXİ[Û‰ÊÂˆ	ÏÙ]‰ÎÂˆÛÛœİÜİI
˜˜]TYÙHŠ_Øİ[Y[˜›ÙNÂˆÜİ˜\[™Ú[
[Ù[
NÂˆÛÛœİÛÜÙO[[Ù[œ]Y\TÙ[XİÜŠ‹˜˜]K\İ]\ËY]Z[XÛÜÙHŠNÂˆYŠÛÜÙJ^ÈÛÜÙK˜Y]™[\İ[™\Š˜ÛXÚÈ‹ÛÜÙP˜]Tİ]\Ñ]Z[[Ù[
NÈBˆ[Ù[˜Y]™[\İ[™\Š˜ÛXÚÈ‹]™[OÂˆYŠ]™[\™Ù]OO[[Ù[
^ÈÛÜÙP˜]Tİ]\Ñ]Z[[Ù[

NÈBˆJNÂˆ™]\›ˆ[Ù[ÂŸB‚™[˜İ[ÛˆÛÜÙP˜]Tİ]\Ñ]Z[[Ù[

^ÂˆÛÛœİ[Ù[YØİ[Y[™Ù][[Y[RY
˜˜]Tİ]\Ñ]Z[[Ù[ŠNÂˆYŠ[[Ù[
^È™]\›ÈBˆ[Ù[šY[]YNÂˆ[Ù[œÙ]]šX]J˜\šXKZY[ˆ‹YHŠNÂˆŞ[˜Ğ˜]UZTš[Üš]S^Y\Š
NÂŸB‚™[˜İ[Ûˆ™[™\˜]Tİ]\Ñ]Z[\İ
Üİ][\Ê^ÂˆYŠZÜİ
^È™]\›ÈBˆÜİš[›™\’SHˆÂˆYŠP\œ˜^Kš\Ğ\œ˜^J][\Ê_][\Ë›[™İOOL
^ÂˆÛÛœİ[\OYØİ[Y[˜Ü™X]Q[[Y[
™]ˆŠNÂˆ[\K˜Û\ÜÓ˜[YOH˜˜]K\İ]\ËY]Z[Y[\HÂˆ[\K^ÛÛ[H¹á(HÂˆÜİ˜\[™Ú[
[\JNÂˆ™]\›ÂˆBˆ][\Ë™›Ü‘XXÚ
][OOÂˆÛÛœİ›İÏYØİ[Y[˜Ü™X]Q[[Y[
™]ˆŠNÂˆ›İË˜Û\ÜÓ˜[YOH˜˜]K\İ]\ËY]Z[\›İÈÂˆÛÛœİXÛÛYØİ[Y[˜Ü™X]Q[[Y[
œÜ[ˆŠNÂˆXÛÛ‹˜Û\ÜÓ˜[YOH˜˜]K\İ]\ËY]Z[ZXÛÛˆÂˆYŠ][I‰š][KšXÛÛ”Ü˜Ê^ÂˆXÛÛ‹œİ[K˜˜XÚÙÜ›İ[™[XYÙOIİ\›
‰ÊÔİš[™Ê][KšXÛÛ”Ü˜ÊKœ™\XÙJÈ‹ÙË‰LŒˆŠJÉÈŠIÎÂˆBˆXÛÛ‹œÙ]]šX]J˜\šXKZY[ˆ‹YHŠNÂˆÛÛœİ^YØİ[Y[˜Ü™X]Q[[Y[
œÜ[ˆŠNÂˆ^˜Û\ÜÓ˜[YOH˜˜]K\İ]\ËY]Z[]^ÂˆÛÛœİ˜[YOYØİ[Y[˜Ü™X]Q[[Y[
˜ˆŠNÂˆ˜[YK^ÛÛ[J][I‰š][K›˜[Y_¹âà9¡bÈŠJÈ»ï&ˆÂˆÛÛœİY™™XİYØİ[Y[˜Ü™X]Q[[Y[
œÜ[ˆŠNÂˆY™™Xİ^ÛÛ[J][I‰š][K™Y™™Xİ¹¥b9§§9å'ù¥b9.+HŠJÈ¸à 9bjzi&ŠÊ][I‰š][Kœ™[XZ[š[™Õ^Œ9fç¹d"ŠNÂˆ^˜\[™Ú[
˜[YJNÂˆ^˜\[™Ú[
Y™™Xİ
NÂˆ›İË˜\[™Ú[
XÛÛŠNÂˆ›İË˜\[™Ú[
^
NÂˆÜİ˜\[™Ú[
›İÊNÂˆJNÂŸB‚™[˜İ[ÛˆÜ[˜]Tİ]\Ñ]Z[[Ù[
ÚYK[™^
^ÂˆYŠ\Ğ˜]Tİ]\Ò[œÜXİ[Û›ØÚÙY

J^È™]\›ˆ˜[ÙNÈBˆÛÛœİ\Ó[Ûœİ\\ÚYOOOH›[Ûœİ\ˆÂˆÛÛœİ[]OZ\Ó[Ûœİ\‚ˆÊ\[Ùˆ[Ûœİ\œÈOOH[™Yš[™Y‰‰›[Ûœİ\œÖÚ[™^JBˆŠ\[ÙˆÙ]\PÚ\˜Xİ\R[™^OOH™[˜İ[ÛˆÙÙ]\PÚ\˜Xİ\R[™^
[™^
N›[
NÂˆYŠY[]J^È™]\›ˆ˜[ÙNÈB‚ˆÛÛœİ[Ù[Y[œİ\™P˜]Tİ]\Ñ]Z[[Ù[

NÂˆÛÛœİİ]ÏHZ\Ó[Ûœİ\‰‰\[ÙˆÙ]\P˜]Tİ]ÏOOH™[˜İ[ÛˆÙÙ]\P˜]Tİ]Ê[™^
N›[ÂˆÛÛœİX^Z\Ó[Ûœİ\Ó[X™\Š[]K›X^
_X]›X^
K[X™\Š[]Kš
_JN‚ˆ[X™\Šİ]É‰œİ]Ë›X^
_[X™\Š[]K›X^
_X]›X^
K[X™\Š[]Kš
_JNÂˆÛÛœİX^ÔZ\Ó[Ûœİ\Ó[X™\Š[]K›X^Ô
_X]›X^
[X™\Š[]KœÜ
_
N‚ˆ[X™\Šİ]É‰œİ]Ë›X^Ô
_[X™\Š[]K›X^Ô
_X]›X^
[X™\Š[]KœÜ
_
NÂˆÛÛœİİ[[X\O]\[ÙˆÚ[™İËŒMÑÙ]˜]Tİ]\Ôİ[[X\OOOH™[˜İ[Ûˆ‚ˆİÚ[™İËŒMÑÙ]˜]Tİ]\Ôİ[[X\J[]JBˆØY™œÎ–×KXY™œÎ–×_NÂˆÛÛœİšY[Ï^Âˆ[[Y[ˆ¹a`ùí(;ï&ˆŠØ˜]Tİ]\Ñ[[Y[X™[
[]JKˆ˜[YNˆ¹d#yê,{ï&ˆŠÔİš[™Ê[]K›˜[Y_[]KšYº)äº"lˆŠKˆˆ’;ï&ˆŠÓX]›X^
[X™\Š[]Kš
_
JÈˆÈŠÛX^ˆÜˆ”Ô;ï&ˆŠÓX]›X^
[X™\Š[]KœÜ
_
JÈˆÈŠÛX^ÔˆNÂˆØš™XİšÙ^\ÊšY[ÊK™›Ü‘XXÚ
Ù^OOÂˆÛÛœİ›ÙO[[Ù[œ]Y\TÙ[XİÜŠ	ÖÙ]KYšY[H‰ÊÚÙ^JÉÈ—IÊNÂˆYŠ›ÙJ^È›ÙK^ÛÛ[YšY[ÖÚÙ^WNÈBˆJNÂˆ™[™\˜]Tİ]\Ñ]Z[\İ
[Ù[œ]Y\TÙ[XİÜŠ	ÖÙ]K[\İH˜Y™œÈ—IÊKİ[[X\K˜Y™œÊNÂˆ™[™\˜]Tİ]\Ñ]Z[\İ
[Ù[œ]Y\TÙ[XİÜŠ	ÖÙ]K[\İH™XY™œÈ—IÊKİ[[X\K™XY™œÊNÂˆ[Ù[šY[Y˜[ÙNÂˆ[Ù[œÙ]]šX]J˜\šXKZY[ˆ‹™˜[ÙHŠNÂˆŞ[˜Ğ˜]UZTš[Üš]S^Y\Š
NÂˆ™]\›ˆYNÂŸB‚šYŠ\[ÙˆÚ[™İÈOOH[™Yš[™YŠ^ÂˆÚ[™İË›Ü[˜]Tİ]\Ñ]Z[[Ù[[Ü[˜]Tİ]\Ñ]Z[[Ù[ÂˆÚ[™İË˜ÛÜÙP˜]Tİ]\Ñ]Z[[Ù[XÛÜÙP˜]Tİ]\Ñ]Z[[Ù[ÂŸB‚™[˜İ[Ûˆ™[™\˜]J
^Â‚ˆ[˜]T™[™\’ÛÚÜÊ˜™Y›Ü™H‹\Ë\™İ[Y[ÊNÂ‚ˆÛÛœİ\™XHBˆ	
˜˜]S[Ûœİ\\™XHŠNÂ‚‚ˆ\™XKš[›™\’SHˆÂ‚‚ˆİ\œ™[˜]S[Ûœİ\œÂˆ™›Ü‘XXÚ
ˆ[™^OÂ‚ˆÛÛœİ[Ûœİ\ˆBˆ[Ûœİ\œÖÚ[™^NÂ‚‚ˆÛÛœİØ\™BˆØİ[Y[˜Ü™X]Q[[Y[
ˆ™]ˆ‚ˆ
NÂ‚‚ˆØ\™šYBˆ˜˜]S[Ûœİ\ˆŠÚ[™^Â‚‚ˆØ\™˜Û\ÜÓ˜[YHBˆ˜˜]K[[Ûœİ\ˆÂ‚‚ˆØ\™›Û˜ÛXÚÏJ
OOÂˆYŠØ\™˜Û\ÜÓ\İ˜ÛÛZ[œÊ\™Ù]X›HŠJ^ÂˆÙ[Xİ˜]U\™Ù]
[™^
NÂˆ™]\›ÂˆBˆÜ[˜]Tİ]\Ñ]Z[[Ù[
›[Ûœİ\ˆ‹[™^
NÂˆNÂ‚‚ˆÛÛœİXÛÛˆBˆ[Ûœİ\‹›˜[YOOOH¹cìº$"¹iáˆ‚ˆÂˆˆ‚ˆ‚ˆ[Ûœİ\‹›˜[YOOOH¹¬¦y¯(:,n¹âï‚ˆÂˆˆ‚ˆ›Â¶©	©íëmÊ—¨~Ê.­Ç¿ÂŠä²–œ{û­«\‡ıŸyÆºy­usÚÂÃh²ç!~)^¢·b­ç-¢¼›Â¶©	©íëmÊ—¨~Ê.­Ç¿ÂŠä²–œ{û­«\‡ıŸyÆºy­usÚÂÃh²ç!~)^¢·b­ç-¢¼­j)^®º+Â¸­Šx,µ©İj·hºÚn´è‘ééŠ—˜Y™ˆ‰‰œÚÚ[™]˜\Ú[Û›Û\Ô\˜Ù[
^Âˆ\Ëœ\Ú
ºe ú.¬¹ã¡È
ÈŠÜÚÚ[™]˜\Ú[Û›Û\Ô\˜Ù[
È‰{ï#ŠÜÚÚ[™\˜][ÛŠÈ¹fç¹d"ŠNÂˆBˆ[ÙHYŠÚÚ[˜Ø]YÛÜOOOH˜Y™ˆ‰‰œÚÚ[™Y™[œÙP›Û\Ô\˜Ù[
^Âˆ\Ëœ\Ú
ºf,¹é©¹b¦È
ÈŠÜÚÚ[™Y™[œÙP›Û\Ô\˜Ù[
È‰{ï#ŠÜÚÚ[™\˜][ÛŠÈ¹fç¹d"ŠNÂˆBˆ[ÙHYŠÚÚ[˜Ø]YÛÜOOOH˜Y™ˆ‰‰œÚÚ[œ™Y›Xİ\˜Ù[
^Âˆ\Ëœ\Ú
¹cãy`­ÈŠÜÚÚ[œ™Y›Xİ\˜Ù[
È‰{ï#ŠÜÚÚ[™\˜][ÛŠÈ¹fç¹d"ŠNÂˆBˆ[ÙHYŠÚÚ[˜Ø]YÛÜOOOH˜Y™ˆ‰‰œÚÚ[œİ]\Ô™\Ú\İ›Û\Ê^Âˆ\Ëœ\Ú
¹ål9n.9âà9¡bù¢¥ù )È
ÈŠÜÚÚ[œİ]\Ô™\Ú\İ›Û\ÊÈ‰{ï#ŠÜÚÚ[™\˜][ÛŠÈ¹fç¹d"ŠNÂˆBˆ[ÙHYŠÚÚ[˜Ø]YÛÜOOOH˜Y™ˆŠ^Âˆ\Ëœ\Ú
ÚÚ[™\ØÜš\[ÛŠNÂˆB‚‚ˆYŠÚÚ[˜Ø]YÛÜOOOHšX[Š^Â‚ˆÛÛœİX[[[İ[B‚ˆÚÚ[˜˜\ÙRX[
ÂˆÚÚ[šX[\“]™[
‚ˆ
‹LJNÂ‚‚ˆ\Ëœ\Ú
‚ˆ¹fç¹oªR9gî¹é#ˆŠÂˆX[[[İ[
ÂˆŠù¦n¹b¦ğåÈŠÂˆPSS‘×ÒS•ĞÓÑQ‘’PÒQS•
Â‚ˆ
ˆÚÚ[šX[\“]™[ˆÂˆ»ï"9gî¹é#¹«ãùí&ŠÈŠÂˆÚÚ[šX[\“]™[
Âˆ»ï"H‚ˆ‚ˆˆ‚ˆ
JÂˆ»ï&ÔÔ9gî¹é#ˆŠÂˆ
ÚÚ[˜˜\ÙRX[Ô
ÊÚÚ[šX[Ô\“]™[
JŠ‹LJJJÂˆ
ÚÚ[šX[Ô\“]™[È»ï"9gî¹é#¹«ãùí&ŠÈŠÜÚÚ[šX[Ô\“]™[
È»ï"HˆˆˆŠJÂˆŠù¦n¹b¦ğåÈŠÂˆÔÒPSS‘×ÒS•ĞÓÑQ‘’PÒQS•
Âˆ»ï"9¥¯y¥/º !y§+9.®¹.#yfç¹oªTÔ;ï"H‚‚ˆ
NÂ‚ˆB‚‚ˆYŠˆÚÚ[˜Ø]YÛÜOOOHœ™]š]™H‰‰‚ˆÚÚ[œ™]š]™RX[\˜Ù[S]™[ˆ
^Â‚ˆ\Ëœ\Ú
‚ˆ¹oªy­.ù h¹oªHŠÂˆÚÚ[œ™]š]™RX[\˜Ù[S]™[Û‹LWJÂˆ‰z(`:aãÈ‚‚ˆ
NÂ‚ˆB‚‚ˆYŠˆÚÚ[˜Ø]YÛÜOOOHœ\ÜÚ]™H‚ˆ
^Â‚ˆ\Ëœ\Ú
ˆÚÚ[™\ØÜš\[Û‚ˆ
NÂ‚ˆB‚‚ˆYŠ\Ë›[™İJ^ÂˆÛÛ[YNÂˆB‚‚ˆ[™\Ëœ\Ú
‚ˆ	Ï]ˆİ[OH‰ÊÂˆ	Ù\Ü^N™›^ÙØ\œÜY[™ÎŒÜÉÊÂˆ	Ø›Ü™\‹X›İÛNŒ\ÛÛY™Ø˜JNKŒLŠNÈ‰ÊÂ‚ˆ	ÏÜ[ˆİ[OH™›^ŒØÛÛÜˆÙŒNÙ›Û]ÙZYÚ˜›ÛÈ‰ÊÂˆ“‹ˆŠÛŠÂˆÜÜ[ˆŠÂ‚ˆ	ÏÜ[ˆİ[OH™›^ŒNÈ‰ÊÂˆ\Ëš›Ú[Š»ïgŠJÂˆÜÜ[ˆŠÂ‚ˆÙ]ˆ‚‚ˆ
NÂ‚ˆB‚‚ˆ™]\›ˆ[™\Ëš›Ú[ŠˆŠNÂ‚ŸB‚‚™[˜İ[ÛˆÚİÔÚÚ[]Z[
ÚÚ[Y
^Â‚ˆÛÛœİÚÚ[BˆÚÚ[]X˜\ÙVÜÚÚ[YNÂ‚‚ˆYŠ\ÚÚ[
^Âˆ™]\›ÂˆB‚‚ˆÛÛœİÚ\˜Xİ\BˆÚ\˜Xİ\”ÚÚ[ØYİ]ÖÂˆİ\œ™[ÚÚ[Ú\˜Xİ\‚ˆNÂ‚‚ˆÛÛœİ]™[B‚ˆ
ˆÚ\˜Xİ\‰‰‚ˆÚ\˜Xİ\‹œÚÚ[]™[É‰‚ˆÚ\˜Xİ\‹œÚÚ[]™[ÖÜÚÚ[YBˆ
_ˆÂ‚‚ˆÛÛœİÜÛÜİB‚ˆÚÚ[œÜÛÜİOO][™Yš[™YˆÂˆÚÚ[œÜÛÜİˆ‚ˆÚÚ[˜ÛÜİÂ‚‚ˆÛÛœİXÛÛ‘[Bˆ	
œÚÚ[]Z[XÛÛˆŠNÂ‚‚ˆYŠXÛÛ‘[
^Â‚ˆXÛÛ‘[œİ[K˜˜XÚÙÜ›İ[™[XYÙOB‚ˆÚÚ[XÛÛ’[XYÙ\É‰‚ˆÚÚ[XÛÛ’[XYÙ\ÖÜÚÚ[YBˆÂˆ\›
ŠÂˆÚÚ[XÛÛ’[XYÙ\ÖÜÚÚ[YJÂˆŠH‚ˆ‚ˆ››Û™HÂ‚ˆXÛÛ‘[^ÛÛ[B‚ˆÚÚ[XÛÛ’[XYÙ\É‰‚ˆÚÚ[XÛÛ’[XYÙ\ÖÜÚÚ[YBˆÂˆˆ‚ˆ‚ˆˆÂ‚ˆB‚‚ˆ	
œÚÚ[]Z[˜[YHŠBˆ^ÛÛ[B‚ˆÚÚ[›˜[YJÂ‚ˆ
ˆ]™[ŒˆÂˆ»ï"‹ˆŠÛ]™[
Âˆ
ˆÚÚ[›X^]™[ˆÂˆ‹ÈŠÜÚÚ[›X^]™[ˆ‚ˆˆ‚ˆ
JÂˆ»ï"H‚ˆ‚ˆ»ï"9§*¹kn9ïä»ï"H‚ˆ
NÂ‚‚ˆ	
œÚÚ[]Z[İ]ÈŠBˆš[›™\’SB‚ˆˆ]ˆİ[OH›X\™Ú[‹X›İÛNœÈ‚ˆÜ[ˆİ[OH‚ˆ\Ü^Nš[›[™KX›ØÚÎÂˆ˜XÚÙÜ›İ[™ˆÌ™LŒÂˆÛÛÜˆÙŒNÂˆ›Û\Ú^™NŒL\Âˆ›Û]ÙZYÚ˜›ÛÂˆY[™ÎŒœÜÂˆ›Ü™\‹\˜Y]\ÎŒLÂˆ‚ˆ	ÙÙ]ÚÚ[Ø]YÛÜSX™[
ÚÚ[˜Ø]YÛÜJ_BˆÜÜ[‚ˆÙ]‚‚ˆ]ˆİ[OH›[™KZZYÚŒKÎÈ‚ˆ	ÜÚÚ[™\ØÜš\[ÛŸBˆÙ]‚‚ˆ]ˆİ[OH›X\™Ú[‹]ÜØÛÛÜˆØŒØMNÎÈ‚ˆ	ÂˆÚÚ[˜Ø]YÛÜOOOHœ\ÜÚ]™H‚ˆÂˆº(ªùbåy¢ : ï{ï#9.#yå*:(çy`¦{ï#9kn9.¡¹l,y¬.9.ayå'ù¥b‚ˆ‚ˆÜÛÜİ
È”Ô‚ˆBˆ	ÂˆÚÚ[›X\›ÛÜİˆÂˆ»ïg:i¥¹«(ykn9ïäºg :) HŠÙÙ]ÚÚ[X\›ÛÜİ›Ü•ZJÙ]ÚÚ[Ú\˜Xİ\“Øš™Xİ
İ\œ™[ÚÚ[Ú\˜Xİ\ŠKÚÚ[
JÈºnçˆ‚ˆ‚ˆˆ‚ˆBˆÙ]‚‚ˆ]ˆİ[OH›X\™Ú[‹]ÜŒLÙ›Û\Ú^™NŒL\ØÛÛÜˆÙŒNÙ›Û]ÙZYÚ˜›ÛÈ‚ˆ9d!9ëbyí&¹¥n9`/ˆÙ]‚‚ˆ]ˆİ[OH›X\™Ú[‹]ÜÙ›Û\Ú^™NŒLœÈ‚ˆ	ÂˆZ[ÚÚ[]™[œ™XZÙİÛ’S
ˆÚÚ[ˆ
BˆBˆÙ]‚‚ˆÂ‚‚ˆÛÛœİ]Z[İ]ÏI
œÚÚ[]Z[İ]ÈŠNÂ‚ˆYŠ]Z[İ]Ê^Âˆ]Z[İ]ËœØÜ›ÛÜLÂˆB‚ˆÂˆØİ[Y[™Øİ[Y[[[Y[ˆØİ[Y[˜›ÙKˆ	
™Ø[YK]šY]ÜÜŠKˆ	
™Ø[YK\İYÙHŠBˆK™›Ü‘XXÚ
[OÂˆYŠ[
^Âˆ[˜Û\ÜÓ\İ˜Y
œÚÚ[Y]Z[\ØÜ›ÛXXİ]™HŠNÂˆBˆJNÂ‚ˆ	
œÚÚ[]Z[[Ù[ŠBˆ˜Û\ÜÓ\İˆ˜Y
œÚİÈŠNÂ‚ŸB‚‚™[˜İ[ÛˆÛÜÙTÚÚ[]Z[

^Â‚ˆ	
œÚÚ[]Z[[Ù[ŠBˆ˜Û\ÜÓ\İˆœ™[[İ™JœÚİÈŠNÂ‚ˆÂˆØİ[Y[™Øİ[Y[[[Y[ˆØİ[Y[˜›ÙKˆ	
™Ø[YK]šY]ÜÜŠKˆ	
™Ø[YK\İYÙHŠBˆK™›Ü‘XXÚ
[OÂˆYŠ[
^Âˆ[˜Û\ÜÓ\İœ™[[İ™JœÚÚ[Y]Z[\ØÜ›ÛXXİ]™HŠNÂˆBˆJNÂ‚ŸB‚‚‹Ê‚ˆ8¦!H9¥¬9h§»ï"9/§yáiù/oùå*: !z) y¬`»ï#8à#:/å9fç¹¨a¹¨a‚ˆ9¥àz`¢¹i&¹. 9`"ûï'ù£"zb%{ï#:-ìùaî¹lk9 )ú*ª¹¦#¸à#{ï"{ï&‚ˆ9ob9ê¥ùaiùk®yfî¹k¦¹kêù«nùg*S:(è{ï#:`&yajy`"ùaïyo#Âˆ9cêº,¨:,«:e¢úeç;ï#:-çØÛÜÙTÚÚ[]Z[

y¦+Âˆ9d#9. 9ê+¹ì(ye«¹ª(yo#øà ‚Š‹Â‚™[˜İ[ÛˆÚİÔİ]\Ò[

^Â‚ˆ	
œİ]\Ò[[Ù[ŠBˆ˜Û\ÜÓ\İˆ˜Y
œÚİÈŠNÂ‚ŸB‚‚™[˜İ[ÛˆÛÜÙTİ]\Ò[

^Â‚ˆ	
œİ]\Ò[[Ù[ŠBˆ˜Û\ÜÓ\İˆœ™[[İ™JœÚİÈŠNÂ‚ŸB‚‚‹ÊˆOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOBˆ9êoù¢-OOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOH
‹Â‚™[˜İ[Ûˆ\]Z\Ù[XİY][J
^Â‚ˆÛÛœİ]ÛˆBˆ	
š][Q\]Z\]ÛˆŠNÂ‚‚ˆYŠ]Û‹™]\Ù]œÛİ
^Â‚ˆ[™\]Z\][Jˆ]Û‹™]\Ù]œÛİˆ
NÂ‚ˆ™]\›Â‚ˆB‚‚ˆYŠˆÙ[XİY[™[ÜTÛİOO[[ˆ
^Âˆ™]\›ÂˆB‚‚ˆÛÛœİ][HBˆ[™[ÜTÛİÖÂˆÙ[XİY[™[ÜTÛİˆNÂ‚‚ˆYŠˆZ][Hˆ][K\OOOHœİ[Ûˆ‚ˆ
^Âˆ™]\›ÂˆB‚‚ˆÛÛœİÚ\˜Xİ\ˆBˆÙ]˜XÚÜXÚĞÚ\˜Xİ\Šˆ[™[ÜPÚ\˜Xİ\’[™^ˆ
NÂ‚‚ˆYŠXÚ\˜Xİ\Š^Âˆ™]\›ÂˆB‚‚ˆÛÛœİ\]Z\Y[Ù^HBˆÙ]˜XÚÜXÚÑ\]Z\Y[Ù^Jˆ[™[ÜPÚ\˜Xİ\’[™^ˆ
NÂ‚‚ˆÛÛœİ\]Z\Y[BˆÚ\˜Xİ\‘\]Z\Y[Ù\]Z\Y[Ù^WNÂ‚‚ˆÛÛœİ\]Z\Y[ÛİBˆÙ][™[ÜQ\]Z\Y[Ûİ
][K\JNÂ‚‚ˆYŠY\]Z\Y[Ûİ
^Âˆ™]\›ÂˆB‚‚ˆÛÛœİÛ][HBˆ\]Z\Y[Ù\]Z\Y[ÛİNÂ‚‚ˆYŠÛ][J^Â‚ˆ[™[ÜR][\Ëœ\Ú
ˆÛ][Bˆ
NÂ‚ˆB‚‚ˆÛÛœİXİX[[™^Bˆ[™[ÜR][\Ëš[™^ÙŠˆ][Bˆ
NÂ‚‚ˆYŠXİX[[™^L
^Â‚ˆ[™[ÜR][\ËœÜXÙJˆXİX[[™^ˆBˆ
NÂ‚ˆB‚‚ˆ\]Z\Y[Ù\]Z\Y[ÛİHBˆ][NÂ‚‚ˆÛÜÙR][S[Ù[

NÂ‚ˆ™XZ[[™[ÜTÛİÊ
NÂ‚ˆ™[™\’[™[ÜJ
NÂ‚ˆ\]URJ
NÂ‚ˆØ]™QØ[YJ
NÂ‚ŸB‚‚‹ÊˆOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOBˆ:!*ù."ÂOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOH
‹Â‚™[˜İ[Ûˆ[™\]Z\][JÛİ
^Â‚ˆÛÛœİÚ\˜Xİ\ˆBˆÙ]˜XÚÜXÚĞÚ\˜Xİ\Šˆ[™[ÜPÚ\˜Xİ\’[™^ˆ
NÂ‚‚ˆYŠXÚ\˜Xİ\Š^Âˆ™]\›ÂˆB‚‚ˆÛÛœİ\]Z\Y[Ù^HBˆÙ]˜XÚÜXÚÑ\]Z\Y[Ù^Jˆ[™[ÜPÚ\˜Xİ\’[™^ˆ
NÂ‚‚ˆÛÛœİ\]Z\Y[BˆÚ\˜Xİ\‘\]Z\Y[Ù\]Z\Y[Ù^WNÂ‚‚ˆÛÛœİ][HBˆ\]Z\Y[ÜÛİNÂ‚‚ˆYŠZ][J^Âˆ™]\›ÂˆB‚‚ˆYŠˆ[™[ÜR][\Ë›[™İLLŒˆ
^Â‚ˆ[\
ˆº ã9c!ymì¹®ïûï#9á(y¬åz!*ù."ú(çy`¦xà ˆ‚ˆ
NÂ‚ˆ™]\›Â‚ˆB‚‚ˆ[™[ÜR][\Ëœ\Ú
ˆ][Bˆ
NÂ‚‚ˆ\]Z\Y[ÜÛİO[[Â‚‚ˆÛÜÙR][S[Ù[

NÂ‚ˆ™XZ[[™[ÜTÛİÊ
NÂ‚ˆ™[™\’[™[ÜJ
NÂ‚ˆ\]URJ
NÂ‚ˆØ]™QØ[YJ
NÂ‚ŸB‚‚‹ÊˆOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOBˆ9e+¹aî‚OOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOH
‹Â‚˜\Ş[˜È[˜İ[ÛˆÙ[Ù[XİY][J
^Â‚ˆYŠˆÙ[XİY[™[ÜTÛİOO[[ˆ
^Âˆ™]\›ÂˆB‚‚ˆÛÛœİ][HBˆ[™[ÜTÛİÖÂˆÙ[XİY[™[ÜTÛİˆNÂ‚‚ˆYŠZ][J^Âˆ™]\›ÂˆB‚‚ˆÛÛœİšXÙHBˆ][KœšXÙ_ˆÂ‚‚ˆYŠˆ\[ÙˆÚ[™İËœœĞÛÛ™š\›HOOH™[˜İ[ÛˆˆˆX]ØZ]Ú[™İËœœĞÛÛ™š\›Jˆ¹è®¹k¦º) yaî¹e+ˆŠÂˆ][K›˜[YJÂˆ»ï'×ˆŠÂˆ¹ãl¹o¥ÈŠÂˆšXÙJÂˆºaäynhøà ˆ‹ˆÂˆ]Nˆ¹aî¹e+º(çy`¦H‹ˆÛÛ™š\›U^ˆ¹è®¹k¦¹aî¹e+ˆ‹ˆØ[˜Ù[^ˆº/å9fçˆ‚ˆBˆ
Bˆ
^Âˆ™]\›ÂˆB‚ˆYŠˆÙ[XİY[™[ÜTÛİOO[[ˆ[™[ÜTÛİÖÜÙ[XİY[™[ÜTÛİHOOZ][Bˆ
^Âˆ™]\›ÂˆB‚‚ˆÛÛœİXİX[[™^Bˆ[™[ÜR][\Ëš[™^ÙŠˆ][Bˆ
NÂ‚‚ˆYŠXİX[[™^L
^Â‚ˆÛÛœİİÜ™Y][OZ[™[ÜR][\ÖØXİX[[™^NÂˆÛÛœİİ\œ™[Ûİ[SX]›X^
K[X™\ŠİÜ™Y][K˜Ûİ[
_JNÂ‚ˆYŠİ\œ™[Ûİ[ŒJ^ÂˆİÜ™Y][K˜Ûİ[Xİ\œ™[Ûİ[LNÂˆY[Ù^Âˆ[™[ÜR][\ËœÜXÙJˆXİX[[™^ˆBˆ
NÂˆB‚ˆB‚‚ˆÊ‚ˆ8¦!H9/ë¹«hûï"9ç'ù«hù¢¤ùb,9ecúhc9¨.y®¤;ï"{ï&‚ˆ9.bùbcz`&z(èyæ¡9è®º*£z*"¹ kù. 9æí:*ª¸à#9ãl¹o¥Âˆ:aäynhøà#{ï#9/a¹o§ºh+yb,9l/¹¬¤¹§"y.îù/ey. :(cˆ9ê"ùo#ùè¯9ç'ùæ¡9¢¢º`&y`"ù¥n9keùb¨:`,¹.îù/eyg,9¥®x %8 %ˆ:aäynhùìîùílyåm¹¦`¹¨.y§+9.#ykf9g*;ï#:`&ycéz*lyëby¥¯ˆ9¦+ùênºh+y¥+ùéj8à ¹ãï¹g*9ç'ùæ¡9§"YÛÛ:`&y`"ùalyå*ˆ:,áù®¤9.¡»ï#:`&z(èz(ç9."¹ç'ù«hùæ¡9b¨9`/8à ‚ˆ
‹ÂˆÛÛBˆÛÛ
ÂˆšXÙNÂ‚‚ˆÛÜÙR][S[Ù[

NÂ‚ˆ™XZ[[™[ÜTÛİÊ
NÂ‚ˆ™[™\’[™[ÜJ
NÂ‚ˆ\]QÛÛ\Ü^J
NÂ‚ˆØ]™QØ[YJ
NÂ‚ŸB‚‚‹ÊˆOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOBˆ:!ê¹båy¢,:k)z*+yk¦‚OOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOH
‹Â‚‹Ê‚ˆ8¦!HŒLÍûï"9®!zfi9«¦9åfzc+ú*©:*"¹ kûï"{ï&‚ˆ]]Ñ[˜X›Y8à X]]ÔÚÚ[ÛYxà Z\ÙTİÛYxà \Ü\ÙTİÛYBˆ9¦+ú""¹âb9..ùgã¹aiùmc:!ê¹båz*+yk¦¹æ¡9a`ùí(;ï#9ãïº(c:*+yk¦¹mì¹¥.yå,Bˆ]]Ğ˜]TÙ][™ÜÔ[™[9båy¡bú(j9e«º&eyä!¸à º""¹âbØY™Pš[™9.ãyg*9«ãù«(z/"yaiBˆ9..ùbåy¢¢º`&yfæù`"øà#9mì¹çéy.#ykf9g*8à#yæ¡9a`ùí(:*&9¢$ÛÛœÛÛK™\œ›Ü»ï#9§ ù£ªz$âùç'ù«hÂˆ9æ¡:c+ú*©;ï&ùfæù«­yá(y¥b9í yk¦¹mì¹éîúfi8à ‚‚ˆ]]ÔÚÚ[˜]xà Z\ÙTİ˜]xà \Ü\ÙTİ˜]Bˆ:`&y."y`"ù¦+ùo¢9¥êy§'ùâb9§+8à y¢,:k)yåjúgh¹aiùmc9."ù¢âz`n9e«¹æ¡ˆ:""¹a`ùí(Q;ï#9o£9/¡ºaãy¥¬:*+z*"9¢$9ãï¹g*:`&yê+‚ˆ8à#9ª&yìi
ùegùbåKù`g9«hŠú*+yk¦¸à#yæ¡:!ê¹båy¢,:k)zgh¹§où¦`‚ˆ9mì¹í¤ù¢ïù£¢y.¡»ï#9/aº`&z(èyí yk¦¹.¢ù.í¹æ¡9ê"ùo#ùè¯ˆ9¬¤¹§"z-çú$eù®!y.o¹­ê;ï#9l#º!í9«ãù«(z/"yaiz`ïy§ ùf%ú*i¹¢o‚ˆ:`&yno¹`"ù.#ykf9g*9æ¡9a`ùí(8à ycl9aîºc+ú*©:*"¹ kÂˆ;ï":få¹á-¹§"zf,¹da¹.#y§ ú+¤ú`b¹¢,¹åm¹ªgûï#9/a¹í`¹êm¹¦+úfç:*"»ï"xà ‚ˆ:`&z(èyæí9£©yb*¹£¢z`&y."y«­ymì¹í¤ù¬¤¹§"yæë¹ª&ycëù.éyí yæ¡9ê"ùo#ùè¯8à ‚Š‹Â‚‚‹Ê‚ˆ8¦!H:!ê¹båy¢,:k)y¢ : ïy."ù¢âz`n9e«¹¥.y¢$9båy¡bùå(¹å'øà ‚ˆ9.bùbcy¦+ùkêù«nùg*S:(èyæ¡9fî¹k¦º`n:h!{ï"9cê¹§"yàjùë«xà y§ ùoàù. 9¤â»ï"{ï#ˆ9ãï¹g*9¢ : ïy¦+ùãªyk­º!ê¹mìykn8à z!ê¹mìz(çy`¦yæ¡;ï#ˆ:`n9e«º) z-çú$eøà#9æë¹bcz(çy`¦yæ¡9¢ : ïxà#ybåy¡bù¦í9¥¬;ï#ˆ9.#yá-¹ãªyk­º(çy`¦y.¡¹¥¬9¢ : ï{ï#:`&z(èycnú`n9.#yb,8à ‚‚ˆ:(ªùbåy¢ : ïz-çùh§¹æâ¹¢ : ï{ï"9 $¹àjûï"y.#y¥/º`,º!ê¹båz`n9e«»ï#ˆ:(ªùbåy¢ : ïy¬¤¹§"xà#9..ùbåy/oùå*8à#z`&yfç¹.¢ûï&Âˆ9 $¹àjùi ¹§§9¥/º`,º!ê¹båz`n9e«»ï#ˆ:!ê¹båy¢,:k)y«ãùfç¹d":`ïy§ úaãy¥¬9¥¯y¥/»ï#ˆ:`£ú/+ù§ ú+¢¹o¥ùo¢9iaù *»ï#ˆ9¢`9.éy $¹àjùæë¹bcyab9cêº ïyg*9¢,:k)y.+y¢bùbåznç¹¢ : ïz`n9e«¹¥¯y¥/¸à ‚Š‹Â‚™[˜İ[ÛˆÜ[]P]]ÔÚÚ[Ü[ÛœÊ
^Â‚ˆÛÛœİÚ\˜Xİ\ˆBˆÚ\˜Xİ\”ÚÚ[ØYİ]Ë™š\™NÂ‚‚ˆYŠXÚ\˜Xİ\Š^Âˆ™]\›ÂˆB‚‚ˆ]Ü[ÛœÒSB‚ˆ	ÏÜ[Ûˆ˜[YOH››Ü›X[¹¦kº`&¹¥.ù¤âÛÜ[Û‰ÎÂ‚‚ˆÚ\˜Xİ\‹™\]Z\YÚÚ[Âˆ™›Ü‘XXÚ
ÚÚ[YOÂ‚ˆÛÛœİÚÚ[BˆÚÚ[]X˜\ÙVÜÚÚ[YNÂ‚‚ˆYŠˆ\ÚÚ[ˆÚÚ[˜Ø]YÛÜOOOH˜Y™ˆŸˆÚÚ[˜Ø]YÛÜOOOHœ\ÜÚ]™H‚ˆ
^Âˆ™]\›ÂˆB‚‚ˆÜ[ÛœÒS
ÏB‚ˆ	ÏÜ[Ûˆ˜[YOH‰ÊÂˆÚÚ[Y
Âˆ	È‰ÊÂˆÚÚ[›˜[YJÂˆ	ÏÛÜ[Û‰ÎÂ‚ˆJNÂ‚‚ˆÛÛœİÛYTÙ[XİBˆ	
˜]]ÔÚÚ[ÛYHŠNÂ‚‚ˆÛÛœİ˜]TÙ[XİBˆ	
˜]]ÔÚÚ[˜]HŠNÂ‚‚ˆÛÛœİ™]š[İ\Õ˜[YHBˆ]]ĞÛÛ™šYËœÚÚ[Â‚‚ˆYŠÛYTÙ[Xİ
^Â‚ˆÛYTÙ[Xİš[›™\’SBˆÜ[ÛœÒSÂ‚ˆB‚‚ˆYŠ˜]TÙ[Xİ
^Â‚ˆ˜]TÙ[Xİš[›™\’SBˆÜ[ÛœÒSÂ‚ˆB‚‚ˆÊ‚ˆ8¦!H9ç'ùæ¡9¢¤ùb,9ecúhc9¨.y®¤9.¡»ï&‚ˆ:`&z(èyc§ù§+9cê¹¢oú*£H››Ü›X[¹¢%¸à#9æë¹bcz(çy`¦yæ¡9¢ : ïxà#Bˆ9¦+ùd"9¬åy`/;ï#™Y™[™»ï":f,¹é©»ï"y.#yg*:`&yajyê+¹ áy¬àyaiûï#ˆ9§ ú(ªú`&y«­zf,¹daº`£ú/+ú*©9b)9¢$8à#9.#yd"9¬åyæ¡9«¦9åfy`/8à#{ï#ˆ9o-ùb-º` 9fç¸à#9¦kº`&¹¥.ù¤â¸à#x %8 %ˆ:`&y«hù¦+øà#9¦#¹¦#º*+yk¦ºf,¹é©»ï#9cnú+¢¹¢$9¦kº`&¹¥.ù¤â¸à#Bˆ9æ¡9ç'ù«hùc§ùfè;ï&˜ÛÛ™š\›P]]Ğ˜]TÙ][™ÜÊ
Bˆ9¢cybfù¢¢˜]]ĞÛÛ™šYËœÚÚ[9«hùè®º*+y¢$™Y™[™»ï#ˆ9íâ¹£©z$eùdo9cêú`&y`"ùaïyo#ù`f¹d#9«i{ï#ˆ:`&z(èycâ9¢¢¹k ù­%ùfçˆ››Ü›X[»ï#ˆ9ëby¥¯9/oùå*: !yæ¡:`n9¤áùg*9a,¹kf9æ¡9."ù. 9b.ùl,z(ªú)¡º$âù£¢xà ‚‚ˆ9/ë¹«hûï&¹¢¢ˆ™Y™[™¹.gú)¥¹à®¹d"9¬åy`/8à ‚ˆ
‹Â‚ˆÛÛœİİ[˜[YBˆ™]š[İ\Õ˜[YOOOH››Ü›X[Ÿˆ™]š[İ\Õ˜[YOOOH™Y™[™ŸˆÚ\˜Xİ\‹™\]Z\YÚÚ[Ëš[˜ÛY\Êˆ™]š[İ\Õ˜[YBˆ
NÂ‚‚ˆYŠ\İ[˜[Y
^Â‚ˆ]]ĞÛÛ™šYËœÚÚ[Bˆ››Ü›X[Â‚ˆB‚‚ˆYŠÛYTÙ[Xİ
^Â‚ˆÛYTÙ[Xİ˜[YHBˆ]]ĞÛÛ™šYËœÚÚ[Â‚ˆB‚‚ˆYŠ˜]TÙ[Xİ
^Â‚ˆ˜]TÙ[Xİ˜[YHBˆ]]ĞÛÛ™šYËœÚÚ[Â‚ˆB‚ŸB‚‚‹Ê‚ˆ8¦!H9¥¬9h§»ï&¹ë+9.£:)äº"l¹âb9§+9æ¡:!ê¹båy¢ : ïz`n9e«¹d#9«ixà ‚ˆ:-çÜÜ[]P]]ÔÚÚ[Ü[ÛœÊ
z`£ú/+ùk£9aj9l#yê,{ï#ˆ:+ Ú\˜Xİ\”ÚÚ[ØYİ]Ëœ^Y\Œ»ï#ˆ9kêØ]]ĞÛÛ™šYÌ»ï#9¤ãy/g9æ¡Óya`ù.í¹.gù¦+Âˆ9l"9lk9¥¯9ë+9.£:)äº"lº`¨ùíaY8à ‚ˆ9d#9¦`º,¨:,«:hkùé.‹úf¬z%ãù¥m9o-z*+yk¦¹chyâaÂˆ;ï"^Y\Œ¹.#ykf9g*9l,y.#yå*:+¤ùãªyk­¹ç"ùb,:`&yc`9hb»ï"xà ‚Š‹Â‚™[˜İ[ÛˆÜ[]P]]ÔÚÚ[Ü[ÛœÌŠ
^Â‚ˆÛÛœİØ\™Bˆ	
œ^Y\Œ]]ÔÙ][™ÜĞØ\™ŠNÂ‚‚ˆYŠXØ\™
^Âˆ™]\›ÂˆB‚‚ˆYŠ\^Y\ŒŠ^Â‚ˆØ\™œİ[K™\Ü^OBˆ››Û™HÂ‚ˆ™]\›Â‚ˆB‚‚ˆØ\™œİ[K™\Ü^OBˆ˜›ØÚÈÂ‚‚ˆÛÛœİ]Q[Bˆ	
œ^Y\Œ]]ÔÙ][™ÜÕ]HŠNÂ‚‚ˆYŠ]Q[
^Â‚ˆ]Q[^ÛÛ[B‚ˆˆŠÂˆ^Y\Œ‹šY
Âˆº!ê¹båy¢,:k)z*+yk¦ˆÂ‚ˆB‚‚ˆÛÛœİÚ\˜Xİ\BˆÚ\˜Xİ\”ÚÚ[ØYİ]Ëœ^Y\ŒÂ‚‚ˆYŠXÚ\˜Xİ\Š^Âˆ™]\›ÂˆB‚‚ˆ]Ü[ÛœÒSB‚ˆ	ÏÜ[Ûˆ˜[YOH››Ü›X[¹¦kº`&¹¥.ù¤âÛÜ[Û‰ÎÂ‚‚ˆÚ\˜Xİ\‹™\]Z\YÚÚ[Âˆ™›Ü‘XXÚ
ÚÚ[YOÂ‚ˆÛÛœİÚÚ[BˆÚÚ[]X˜\ÙVÜÚÚ[YNÂ‚‚ˆYŠˆ\ÚÚ[ˆÚÚ[˜Ø]YÛÜOOOH˜Y™ˆŸˆÚÚ[˜Ø]YÛÜOOOHœ\ÜÚ]™HŸˆÚÚ[˜Ø]YÛÜOOOHšX[ŸˆÚÚ[˜Ø]YÛÜOOOHœ™]š]™H‚ˆ
^Âˆ™]\›ÂˆB‚‚ˆÜ[ÛœÒS
ÏB‚ˆ	ÏÜ[Ûˆ˜[YOH‰ÊÂˆÚÚ[Y
Âˆ	È‰ÊÂˆÚÚ[›˜[YJÂˆ	ÏÛÜ[Û‰ÎÂ‚ˆJNÂ‚‚ˆÛÛœİÙ[XİBˆ	
˜]]ÔÚÚ[^Y\ŒˆŠNÂ‚‚ˆYŠ\Ù[Xİ
^Âˆ™]\›ÂˆB‚‚ˆÛÛœİ™]š[İ\Õ˜[YOBˆ]]ĞÛÛ™šYÌ‹œÚÚ[Â‚‚ˆÙ[Xİš[›™\’SBˆÜ[ÛœÒSÂ‚‚ˆÛÛœİİ[˜[YBˆ™]š[İ\Õ˜[YOOOH››Ü›X[Ÿˆ™]š[İ\Õ˜[YOOOH™Y™[™ŸˆÚ\˜Xİ\‹™\]Z\YÚÚ[Ëš[˜ÛY\Êˆ™]š[İ\Õ˜[YBˆ
NÂ‚‚ˆYŠ\İ[˜[Y
^Â‚ˆ]]ĞÛÛ™šYÌ‹œÚÚ[Bˆ››Ü›X[Â‚ˆB‚‚ˆÙ[Xİ˜[YOBˆ]]ĞÛÛ™šYÌ‹œÚÚ[Â‚‚ˆÛÛœİÙ[XİBˆ	
š\ÙTİ^Y\ŒˆŠNÂ‚‚ˆÛÛœİÜÙ[XİBˆ	
œÜ\ÙTİ^Y\ŒˆŠNÂ‚‚ˆYŠÙ[Xİ
^Â‚ˆÙ[Xİ˜[YOBˆ]]ĞÛÛ™šYÌ‹šÂ‚ˆB‚‚ˆYŠÜÙ[Xİ
^Â‚ˆÜÙ[Xİ˜[YOBˆ]]ĞÛÛ™šYÌ‹œÜÂ‚ˆB‚‚ˆÛÛœİ[˜X›YÚXÚØ›ŞBˆ	
˜]]Ñ[˜X›Y^Y\ŒˆŠNÂ‚‚ˆYŠ[˜X›YÚXÚØ›Ş
^Â‚ˆ[˜X›YÚXÚØ›Ş˜ÚXÚÙYBˆ]]ĞÛÛ™šYÌ‹™[˜X›YÂ‚ˆB‚ŸB‚‚‹Ê‚ˆ8¦!H9ë+9.£:)äº"lº!ê¹båy¢,:k)z*+yk¦¹æ¡9."ù¢âz`n9e«‚ˆ9ål9båy¦`»ï#9¢¢¹`/9kêùfç˜]]ĞÛÛ™šYÌ¸à ‚Š‹Â‚™[˜İ[Ûˆ\]P]]ĞÛÛ™šYÌ‘œ›ÛURJ
^Â‚ˆÛÛœİ[˜X›YÚXÚØ›ŞBˆ	
˜]]Ñ[˜X›Y^Y\ŒˆŠNÂ‚‚ˆÛÛœİÙ[XİBˆ	
˜]]ÔÚÚ[^Y\ŒˆŠNÂ‚‚ˆÛÛœİÙ[XİBˆ	
š\ÙTİ^Y\ŒˆŠNÂ‚‚ˆÛÛœİÜÙ[XİBˆ	
œÜ\ÙTİ^Y\ŒˆŠNÂ‚‚ˆYŠ[˜X›YÚXÚØ›Ş
^Â‚ˆ]]ĞÛÛ™šYÌ‹™[˜X›YBˆ[˜X›YÚXÚØ›Ş˜ÚXÚÙYÂ‚ˆB‚‚ˆYŠÙ[Xİ
^Â‚ˆ]]ĞÛÛ™šYÌ‹œÚÚ[BˆÙ[Xİ˜[YNÂ‚ˆB‚‚ˆYŠÙ[Xİ
^Â‚ˆ]]ĞÛÛ™šYÌ‹šBˆ[X™\ŠˆÙ[Xİ˜[YBˆ
NÂ‚ˆB‚‚ˆYŠÜÙ[Xİ
^Â‚ˆ]]ĞÛÛ™šYÌ‹œÜBˆ[X™\ŠˆÜÙ[Xİ˜[YBˆ
NÂ‚ˆB‚‚ˆØ]™QØ[YJ
NÂ‚ŸB‚‚™[˜İ[ÛˆŞ[˜Ğ˜]P]]ÔÙ][™ÜÊ
^Â‚ˆÊ‚ˆ8¦!H9/ë¹«hûï"9ç'ùæ¡9¢¤ùb,9. 9`"ù§ ùåm¹ªgùæ¡Yûï"{ï&‚ˆ:`&z(èyc§ù§+9§ ùæí9£©yl#Bˆ]]ÔÚÚ[˜]KÚ\ÙTİ˜]KÜÜ\ÙTİ˜]Bˆ:`&y."y`"ú""¹âb9¢,:k)yåjúgh¹aiùmc9."ù¢âz`n9e«º*+y`/;ï#ˆ9/aº`&y«(y¥.yâb9o£;ï#:`&y."y`"ù."ù¢âz`n9e«¹mì¹í¤ù¥m9`"ù¢ïù£¢Bˆ;ï"9æî:eç:*+yk¦¹éîùb,8à#:*+yk¦¸à#y£"zb%yleze¢ùæ¡ˆ]]Ğ˜]TÙ][™ÜÔ[™[:(èy.¡»ï"{ï#ˆÓz(èymì¹í¤ù¢o¹.#yb,:`&y."y`"ùa`ùí(;ï#ˆ9æí9£©yl#[[˜[Yz,é¹`/9§ ùæí9£©y.'ùaîºc+ú*©;ï#ˆ9l#º!í9do9cêú`&y`"ùaïyo#ùæ¡9g,9¥®yaj:`ê9.+y¥­ùgíú(c8 %8 %ˆ9c!y¢ë™YÚ[Ú\˜Xİ\•\›Š
{ï#ˆ9ëby¥¯9«ãù«(z/*¹b,9ãªyk­º(c9bå{ï#ˆ9åjúghº`ïy§"ycëú ïyfè9à®º`&z(èyfm:c+ú #9chy/cøà ‚‚ˆ9¥¬9âb:*+yk¦ºgh¹§où¦+øà#:nçº*+yk¦¹¢cyleze¢ûï#ˆ9leze¢ù¦`¹¢cyå,\İÚ]Ú]]ÔÙ][™ÜĞÚ\˜Xİ\Š
Bˆ:,¨:,«9n-¹aiyæë¹bcyæ¡9`/8à#{ï#9.#zg :) yg*:`&z(èBˆ9«ãù«(z`ïy..ùbåyd#9«i{ï#9¢`9.éyæí9£©y¢¢º`&y."z(c9¢ïù£¢{ï#ˆ9cê¹/çyåfyd#9«ixà#9mì¹kn9¢ : ïz`n:h!xà#z`&z`ê9b!‚ˆ;ï"Ü[]P]]ÔÚÚ[Ü[Ûœùìîùb%ùaïyo#Âˆ9a¡z`ê:`ïymì¹í¤ù§"[[9ª¨¹§é{ï#9.#y§ ù§"yd#9ª(ùæ¡9ecúhc;ï"xà ‚ˆ
‹Â‚ˆÜ[]P]]ÔÚÚ[Ü[ÛœÊ
NÂ‚ˆÜ[]P]]ÔÚÚ[Ü[ÛœÌŠ
NÂ‚ŸB‚‚‹ÊˆOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOBˆ9¢,:k)z,áú*"‚OOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOH
‹Â‚™[˜İ[ÛˆŞ[˜Ğ˜]UZTš[Üš]S^Y\Š
^Â‚ˆÛÛœİİYÙOI
™Ø[YK\İYÙHŠNÂˆÛÛœİYÙOI
˜˜]TYÙHŠNÂˆYŠ\İYÙ_\YÙJ^È™]\›ˆ˜[ÙNÈB‚ˆÛÛœİİ]\Ñ]Z[\YÙKœ]Y\TÙ[XİÜŠ‹˜˜]K\İ]\ËY]Z[[[Ù[››İ
ÚY[—JHŠNÂˆÛÛœİÚYQ˜]Ù\\YÙKœ]Y\TÙ[XİÜŠ‹˜˜]KZ[œÚYÚY˜]Ù\‹›Ü[ˆŠNÂˆÛÛœİ˜]R[™›Ï\YÙKœ]Y\TÙ[XİÜŠ‹˜˜]KZ[™›Ë\™YÚ[Û‹š\ËY^[™YŠNÂˆÛÛœİXİ]™OHHJİ]\Ñ]Z[ÚYQ˜]Ù\Ÿ˜]R[™›ÊNÂ‚ˆİYÙK˜Û\ÜÓ\İÙÙÛJ˜˜]K]ZK\š[Üš]H‹Xİ]™JNÂˆYŠØİ[Y[˜›ÙJ^ÈØİ[Y[˜›ÙK˜Û\ÜÓ\İÙÙÛJŒMÍX˜]K\™XY[™Ë[Ü[ˆ‹Xİ]™JNÈBˆ™]\›ˆXİ]™NÂ‚ŸB‚šYŠ\[ÙˆÚ[™İÈOOH[™Yš[™YŠ^ÂˆÚ[™İËœŞ[˜Ğ˜]UZTš[Üš]S^Y\\Ş[˜Ğ˜]UZTš[Üš]S^Y\ÂŸB‚™[˜İ[ÛˆÙ]˜]R[™›Ñ^[™Y
^[™Y
^Â‚ˆÛÛœİ™YÚ[ÛYØİ[Y[œ]Y\TÙ[XİÜŠˆØ˜]TYÙH˜˜]KZ[™›Ë\™YÚ[ÛˆŠNÂˆÛÛœİÙÙÛOI
˜˜]R[™›ÕÙÙÛHŠNÂ‚ˆYŠ\™YÚ[ÛŸ]ÙÙÛJ^È™]\›ˆ˜[ÙNÈB‚ˆÛÛœİ™^HHY^[™YÂˆ™YÚ[Û‹˜Û\ÜÓ\İÙÙÛJš\ËY^[™Y‹™^
NÂˆÙÙÛK^ÛÛ[[™^Èº/å9fçˆˆ¹¢,:k)z,áú*"ˆÂˆÙÙÛKœÙ]]šX]J˜\šXKY^[™Y‹™^ÈYHˆ™˜[ÙHŠNÂˆÙÙÛKœÙ]]šX]J˜\šXK[X™[‹™^È¹¥-¹d"9¢,:k)z,áú*"ˆˆ¹leze¢ù¢,:k)z,áú*"ˆŠNÂˆŞ[˜Ğ˜]UZTš[Üš]S^Y\Š
NÂˆ™]\›ˆYNÂ‚ŸB‚™[˜İ[ÛˆÙÙÛP˜]R[™›Ô[™[

^Â‚ˆÛÛœİ™YÚ[ÛYØİ[Y[œ]Y\TÙ[XİÜŠˆØ˜]TYÙH˜˜]KZ[™›Ë\™YÚ[ÛˆŠNÂˆ™]\›ˆÙ]˜]R[™›Ñ^[™Y
J™YÚ[Û‰‰œ™YÚ[Û‹˜Û\ÜÓ\İ˜ÛÛZ[œÊš\ËY^[™YŠJJNÂ‚ŸB‚™[˜İ[ÛˆÛX\˜]SÙÊ
^Â‚ˆÙ]˜]R[™›Ñ^[™Y
˜[ÙJNÂ‚ˆ	
˜˜]R[™›ÈŠBˆš[›™\’SHˆÂ‚ˆÊˆŒMÌËˆ[[Y[›ŞØ[ˆ\ÙHİ[ÛœÈÚ[H›È˜]H\È[›š[™Ë‚ˆØ\œHÜÙH›İXÙ\È[ÈH™^˜]KZ[™›È[™[^XİHÛ˜ÙKˆ
‹ÂˆÛÛœİ[™[™Ñ[[Y[›Ş›İXÙ\ÏBˆ\[ÙˆÚ[™İÈOOH[™Yš[™Y‰‰\œ˜^Kš\Ğ\œ˜^JÚ[™İËŒMÌÍ”[™[™Ğ˜]S›İXÙ\ÊBˆÈÚ[™İËŒMÌÍ”[™[™Ğ˜]S›İXÙ\ËœÜXÙJ
Bˆˆ×NÂˆ[™[™Ñ[[Y[›Ş›İXÙ\Ë™›Ü‘XXÚ
Y\ÜØYÙOO˜Y˜]SÙÊY\ÜØYÙJJNÂ‚‚ˆÊ‚ˆ8¦!H9¥¬9h§»ï"9/§yáiù/oùå*: !z) y¬`»ï#9mèz`£úh zgh¹æ¡ˆ9¢,:k)z,áú*"º)¡º$âùli;ï"{ï&‚ˆ9¥¬9¢,:k)ze¢ùiâù®!yên¹í :c!9æ¡9d#9¦`»ï#ˆ9mèz`£úh zghº`¨ù.ïy.gú) y. :-mù®!yên»ï#ˆ9.#yá-¹¥¬9¢,:k)y¢dùb,9. 9cb»ï#9mèz`£úh zgh¹cnú`¡ˆ9«¦9åfz$eù."¹."¹. 9h-9æ¡:""¹í :c!;ï#9ajz`¢¹§ ùl#y.#z-mù/¡¸à ‚ˆ
‹Â‚ˆÛÛœİX\[™›ÏBˆ	
›X\˜]R[™›ÈŠNÂ‚‚ˆYŠX\[™›Ê^Â‚ˆX\[™›Ëš[›™\’SBˆˆÂ‚ˆB‚‚ˆÊ‚ˆ8¦!H9¥¬9h§»ï"9/§yáiù/oùå*: !z) y¬`»ï"{ï&‚ˆ9¥¬9¢,:k)ze¢ùiâûï#9fî¹k¦ºhkùé.¹æ¡9fç¹d"9¥n9ª&yìiˆ9.gú) zaãyïk¹fç¹ë+yfç¹d";ï#9.#yá-¹§ ù«¦9åfBˆ9."¹. 9h-9¢,:k)yíd9§gù¦`¹æ¡9fç¹d"9¥n8à ‚ˆ
‹Â‚ˆÛÛœİ\›’[™XØ]ÜBˆ	
˜˜]U\›’[™XØ]ÜˆŠNÂ‚‚ˆYŠ\›’[™XØ]ÜŠ^Â‚ˆ\›’[™XØ]Ü‹^ÛÛ[Bˆ¹ë+H9fç¹d"Â‚ˆB‚‚ˆÛÛœİX\\›’[™XØ]ÜBˆ	
›X\˜]U\›’[™XØ]ÜˆŠNÂ‚‚ˆYŠX\\›’[™XØ]ÜŠ^Â‚ˆX\\›’[™XØ]Ü‹^ÛÛ[Bˆ¹ë+H9fç¹d"Â‚ˆB‚ŸB‚‚‹Ê‚ˆ8¦!H9¥¬9h§»ï"9/§yáiù/oùå*: !z) y¬`»ï"{ï&‚ˆ9¬n¹k¦¹fç¹d":,áú*"¹b%ûï"9ë+9fç¹d";ï#ù`$¹¥n;ï#ùæë¹ª&{ï"Bˆ:-çù¢,:k)y£!ù.é9£"zb%yc`;ï"9¢ : ïKù¦kº`&¹¥.ù¤â‹úf,¹é©‹Âˆ9âjydàKú` ú!*ûï"yãï¹g*:*lºhkùé.º`¡9¦+ú*lº%ãú-mù/¡¸à ‚‚ˆ:)£ùbaûï&‚ˆH]]Ğ˜]yà®Y{ï":!ê¹båy¢,:k)y£ yî£:e¢ú$eûï"{ï&‚ˆ9.#yë¨yãï¹g*9¦+ùk¨ùdbº`¡9¦+ùíd9ë¥úf£¹«­{ï#9. 9o¢ú%ãú-mù/¡»ï#ˆ9.#y§ ù«ãù`"ú)äº"lº(c9båyk£9l,yb!ù£æù. 9«(xà zh.ùî`ze ùâ#xà ‚ˆH]]Ğ˜]yà®™˜[Ù{ï"9¢bùbå{ï"{ï&‚ˆ9íd9ë¥úf£¹«­{ï"˜]T\ÙOOOHœ™\ÛÛ™H»ï#ˆ:fæy¥®y«hùg*9/§yn£ùç'ù«hùaî¹¢bûï"z%ãú-mù/¡»ï#9®&ùl$yåjúgh‚ˆ:fç:*"»ï&ùk¨ùdbºf£¹«­{ï"˜]T\ÙOOOH™XÛ\™H»ï#ˆ9ëbyãªyk­º!ê¹mìz`n9¤áú) y`f¹.à:n¯;ï"zhkùé.¹aî¹/¡»ï#ˆ9.#yá-¹ãªyk­¹§ ùç"ù.#yb,9£"zb%xà y.#yçéz`dú) znç¹dêº(èxà ‚‚ˆ:%ãú-mù/¡¹æ¡9¦`¹`&zh!¹/¯úeç:e¢ycëú ïz`¡:e¢ú$eùæ¡9¢ : ïKÂˆ9âjydàykd:`n9e«»ï"ÛÜÙSY[\Ê
{ï"{ï#:`oùacy£"zb%yc`ˆ:(ªú%ãú-mù/¡¸à ykd:`n9e«¹cnú`¡:há9g*9åjúgh¹."¹æ¡9 *¹âà9¬àxà ‚Š‹Â‚™[˜İ[Ûˆ\]PXİ[Û’Yš\ÚXš[]J
^Â‚ˆÛÛœİXİ]™P]]ÏBˆXİ]™P˜]PÚ\˜Xİ\’[™^OOLˆÈ]]Ğ˜]BˆˆÙ]\P]]ĞÛÛ™šYÊXİ]™P˜]PÚ\˜Xİ\’[™^
K™[˜X›YÂ‚ˆÛÛœİ˜]T™\Ù[][ÛXİ]™OHHJˆ\[ÙˆÚ[™İÈOOH[™Yš[™Y‰‰‚ˆÚ[™İË‘›İ\”Ş[X›ÛĞ˜]Q›İÉ‰‚ˆ\[ÙˆÚ[™İË‘›İ\”Ş[X›ÛĞ˜]Q›İËš\Ô™\Ù[][ÛXİ]™OOOH™[˜İ[Ûˆ‰‰‚ˆÚ[™İË‘›İ\”Ş[X›ÛĞ˜]Q›İËš\Ô™\Ù[][ÛXİ]™J
Bˆ
NÂ‚ˆÛÛœİÚİ[YOBˆXİ]™P]]È˜]T\ÙOOOHœ™\ÛÛ™Hˆ˜]T™\Ù[][ÛXİ]™NÂ‚‚ˆÊ‚ˆ8¦!H9/ë¹«hûï"9/§yáiù/oùå*: !y¯¡9®!{ï#9ab9bcyä!º)èúc+ù.¡»ï"{ï&‚ˆ9fç¹d":,áú*"¹b%ûï"9d*ùfç¹d"9¥nú*"9¦`¹fjùæë¹ª&{ï"Bˆ:!ê¹båy¢,:k)y¦`¹áiú""¹¥m9`"úf¬z%ãûï#9.#yânyb)yåfBˆ9fç¹d"9¥n9g*:`&z(èx %8 %9/oùå*: !z) yæ¡9¦+øà#9¢,:k)Bˆ:,áú*"Š9¢,:k)yí :c!9¨aŠy§+:.ªøà#zhkùé.¹æë¹bcyfç¹d"9¥n;ï#ˆ9.#y¦+ú`&y`"ù£"zb%yb%ùæ¡9. :`ê9b!»ï#9¥.yfç¹c§ù§+ˆ9æ¡9¥m:jå:f¬z%ãú`£ú/+øà ‚ˆ
‹Â‚ˆÛÛœİ\›”›İÏBˆ	
\›•\™Ù]›İÈŠNÂ‚‚ˆYŠ\›”›İÊ^Â‚ˆ\›”›İË˜Û\ÜÓ\İÙÙÛJˆ˜˜]KZYZY[ˆ‹ˆÚİ[YBˆ
NÂ‚ˆB‚‚ˆÛÛœİÛÛ[X[™›İÏBˆ	
˜˜]PÛÛ[X[™›İÈŠNÂ‚‚ˆYŠÛÛ[X[™›İÊ^Â‚ˆÛÛ[X[™›İË˜Û\ÜÓ\İÙÙÛJˆ˜˜]KZYZY[ˆ‹ˆÚİ[YBˆ
NÂ‚‚ˆYŠÚİ[YJ^Â‚ˆÛÜÙSY[\Ê
NÂˆÛX\˜]U\™Ù]Ù[Xİ[Û“[ÙJ
NÂ‚ˆB‚ˆB‚ŸB‚‚™[˜İ[ÛˆY˜]SÙÊ^
^Â‚ˆÛÛœİ[™›ÈBˆ	
˜˜]R[™›ÈŠNÂ‚‚ˆYŠZ[™›Ê^Âˆ™]\›ÂˆB‚‚ˆÊ‚ˆ8¦!H9/ë¹«hûï"9/§yáiù/oùå*: !z) y¬`»ï"{ï&‚ˆ9.bùbcy«ãùb¨9. :(c9¥¬:*"¹ kûï#9l,yo-ùb-¹¢¢¹£lº.î9¢âyb,ˆ9§ 9n¥z`ê;ï#9l#º!í9/oùå*: !yo 9."¹®äy ìùç"ù.bùbcyæ¡ˆ9í :c!9¦`»ï#9. 9§"y¥¬:*"¹ kú`,¹/¡¹l,z(ªùo-ùb-¹¢âyfç¹c®ûï#ˆ9k£9aj9ç"ù.#yb,9 ìùç"ùæ¡9aiùk®xà ‚‚ˆ9¥.y¢$9ab9b)9¥­øà#9/oùå*: !yãï¹g*9¦+ù.#y¦+ùmì¹í¤ùg*ˆ9£©z/äyn¥z`ê8à#{ï"9k®z*,LŒ9æ¡:*©9më»ï"{ï#ˆ9cê¹§"yg*8à#9c§ù§+9l,yg*9n¥z`ê:fa:/äxà#yæ¡9 áy¬ày."ûï#ˆ9¢cz!ê¹båy£l¹b,9¥¬:*"¹ kûï&ùi ¹§§9/oùå*: !ymì¹í¤Âˆ9..ùbåyo 9."¹®äze¢ù. 9«­z-çzfè»ï#9.èú(j9.å¹«hùg*ˆ9fçºh+yç"ù.bùbcyæ¡9í :c!;ï#:`&y¦`¹`&y¥¬:*"¹ kú`,¹/¡‚ˆ9.#y§ ù¢dù¥­ù.å»ï#9£l¹båy/cyïk¹í«y£ y.#z+¢¸à ‚ˆ
‹Â‚ˆÛÛœİØ\Ó™X\›İÛOB‚ˆ[™›ËœØÜ›ÛZYÚBˆ[™›ËœØÜ›ÛÜBˆ[™›Ë˜ÛY[ZYÚˆŒÂ‚‚ˆÛÛœİ[™HBˆØİ[Y[˜Ü™X]Q[[Y[
ˆ™]ˆ‚ˆ
NÂ‚‚ˆ[™K˜Û\ÜÓ˜[YHBˆ˜˜]K[[™HÂ‚‚ˆ[™K^ÛÛ[Bˆ^Â‚‚ˆ[™›Ë˜\[™Ú[
ˆ[™Bˆ
NÂ‚‚ˆÚ[Jˆ[™›Ë˜Ú[™[‹›[™İˆ
^Â‚ˆ[™›Ëœ™[[İ™PÚ[
ˆ[™›Ë™š\œİÚ[ˆ
NÂ‚ˆB‚‚ˆYŠØ\Ó™X\›İÛJ^Â‚ˆ[™›ËœØÜ›ÛÜBˆ[™›ËœØÜ›ÛZYÚÂ‚ˆB‚‚ˆÊ‚ˆ8¦!H9¥¬9h§»ï"9/§yáiù/oùå*: !z) y¬`»ï#9mèz`£úh zgh¹æ¡ˆ9¢,:k)z,áú*"º)¡º$âùli;ï"{ï&‚ˆ9«ãùb¨9. :(c9¢,:k)yí :c!;ï#9d#9«iz)!ú(ïy. 9.ïyb,ˆ9mèz`£úh zghº`¨ù.ïy¢,:k)z,áú*"¹¨a¸ %8 %:`&y¦+ùe+ù. ˆ:,¨:,«9kêùaiy¢,:k)yí :c!9¥¡ùkeùæ¡9g,9¥®{ï#ˆ9g*:`&z(èyd#9«iy§ 9e«¹í%;ï#9.#yå*9cé¹i%¹¢o‚ˆ9«ãù. 9`"ùdo9cêØY˜]SÙÊ
yæ¡9g,9¥®Bˆ9d!:!êº&eyä!¸à º`&y.ïy.#yå*:&eyä!¸à#9£l¹b,9n¥z`ê8à#Bˆ9æ¡:`£ú/+ûï#9ãªyk­ºfèºe¢ù¢,:k)xà yfç¹b,9g,9g%¹.bùo£ˆ9¢cy§ ùç"ùb,:`&y.ï{ï#9.#y§ ù§"xà#9¥¬:*"¹ kù. 9æíˆ9¢dù¥­ù«hùg*9ç"ùæ¡9aiùk®xà#yæ¡9ecúhc8à ‚ˆ
‹Â‚ˆÛÛœİX\[™›ÏBˆ	
›X\˜]R[™›ÈŠNÂ‚‚ˆYŠX\[™›Ê^Â‚ˆÛÛœİX\[™OBˆØİ[Y[˜Ü™X]Q[[Y[
ˆ™]ˆ‚ˆ
NÂ‚‚ˆX\[™K˜Û\ÜÓ˜[YOBˆ˜˜]K[[™HÂ‚‚ˆX\[™K^ÛÛ[Bˆ^Â‚‚ˆX\[™›Ë˜\[™Ú[
ˆX\[™Bˆ
NÂ‚‚ˆÚ[JˆX\[™›Ë˜Ú[™[‹›[™İˆ
^Â‚ˆX\[™›Ëœ™[[İ™PÚ[
ˆX\[™›Ë™š\œİÚ[ˆ
NÂ‚ˆB‚‚ˆX\[™›ËœØÜ›ÛÜBˆX\[™›ËœØÜ›ÛZYÚÂ‚ˆB‚ŸB‚‚‹ÊˆOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOBˆ9ãªyk­º,áú*"‚OOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOH
‹Â‚™[˜İ[Ûˆ\]T^Y\’XY\Š
^Â‚ˆÛÛœİ[[Y[Bˆ[[Y[]X˜\ÙVÂˆ^Y\‹™[[Y[ˆBˆˆ[[Y[]X˜\ÙK™š\™NÂ‚‚ˆÊ‚ˆ8¦!H9/ë¹«hûï"9/§yáiù/oùå*: !z) y¬`»ï#[[Úšy£æù¢$ˆÔÔùbåyåjùg%¹é.»ï"{ï&^ÛÛ[9¥.y¢$ˆ[›™\’S;ï#9¢cz ïyç'ùæ¡9¢¢‚ˆÜ[ˆÛ\ÜÏH™[[Y[ZXÛÛ‹‹‹ˆ‚ˆ:`&yê+’S9ª&yìi9®,¹§äùaî¹/¡»ï#9.#yá-¹§ ú(ªÂˆ9åm¹¢$9í%9¥¡ùkeùkeúghºhkùé.¸à ‚ˆ
‹Â‚ˆ	
œ^Y\“˜[YHŠBˆš[›™\’SB‚ˆÙ][[Y[XÛÛ’S
ˆ^Y\‹™[[Y[ˆ
JÂˆˆŠÂˆ
ˆ^Y\‹šYˆ[[Y[˜Ú\˜Xİ\‚ˆ
NÂ‚‚ˆ	
™[[Y[^ŠBˆš[›™\’SB‚ˆÙ][[Y[XÛÛ’S
ˆ^Y\‹™[[Y[ˆ
JÂˆˆŠÂˆ[[Y[›˜[YNÂ‚ŸB‚‚‹Ê‚ˆ8¦!H9¥¬9h§»ï"9/§yáiù/oùå*: !z) y¬`»ï"{ï&‚ˆ9g*9mèz`£ûï#ùg,9g%ºh zgh¹¦`»ï#9§ 9."ºghº`¨ù¨§yª&zhc9b%Âˆ9.#zhkùé.º)äº"l¹æ¡9ëbyí&‹ÒÔÔ;ï#9¥.zhkùé.¸à#9g,9g%‚ˆ9d#yê,xà#{ï"øà#9 *¹âjz,áú*"»ï"9d#yê,Kùlk9 )Ëú(`:aãËÂˆ9¥cù£mûï"xà#xà ‚‚ˆ9 *¹âjz,áú*"¹¢¤ùæ¡9¦+ùæë¹bcyg,9g%¹."»ï"[Ûœİ\œÖÌ_‚ˆ[Ûœİ\œÖÓPVÕRS’S‘×ÓSÓ”ÕT”ËLW{ï"Bˆ9ë+9. :f®ú`¡9­.ú$eùæ¡9 *¹âjx %8 %:-çÜ[]]Ô]›ÛÚXÚÊ
Bˆ:!ê¹båymèy *¹¦`¸à#9¢dùë+9. :f®ú`¡9­.ú$eùæ¡9 *¹âjxà#yå*9æ¡ˆ9¦+ùd#9. 9`"ú`£ú/+ûï#:`&z(èzhkùé.¹æ¡9l,y¦+øà#9mèy *¹£"y."ùc®Âˆ9§ ù¢dùb,9æ¡:`¨úf®ù *¹âjxà#{ï#9.#y¦+úfª9/¯ù¢¤ù. :f®øà ‚‚ˆ9ajyía9ª&zhc9b%ûï"9c§ù§+9æ¡:)äº"lº,áú*"»ï#ú`&z(èy¥¬9h§¹æ¡ˆ9g,9g%Šù *¹âjz,áú*"»ï"ynlùn.9cê¹§ úhkùé.¹. 9ía;ï#ˆ9g*ÚİÔYÙJ
z(èyb!ù£æúh zgh¹¦`¹§ ùdo9cêú`&z(èBˆ:aãy¥¬9b)9¥­ú) zhkùé.¹dê¹. 9ía8à ‚Š‹Â‚‹Ê‚ˆ8¦!H9¥¬9h§»ï"9/§yáiù/oùå*: !z) y¬`»ï#9íí9b§ùc`9¥.yâbˆ9alyå*:`£ú/+ûï"{ï&‚ˆ9¢¢¸à#9b%ùaî¹§ä9`"ùg,9c`9aj:`ê9 *¹âjyê+ºhg¹æ¡9d#yê,KÂˆ9ëbyí&‹ù¥cù£møà#z`&y«­z`£ú/+ù¢¯y¢$9ãj9êâùaïyo#ûï#ˆ9g,9g%ºh zgh¹æ¡9 *¹âjy®!ye«¹¨a¸à yíí9b§ùc`9¥¬9æ¡ˆ9g,9g%º,áú*"¹ob9ê¥ûï#9ajz`¢º`ïz) yå*9b,9d#9. 9ieûï#ˆ9.#z) yd!:!ê¹kêù. 9.ïyno¹.c¹. 9ª(ùæ¡9ê"ùo#ùè¯8à ‚‚ˆ9d#9d#y *¹âj{ï"9¢ïù£¢yã¢Ëùæ¡ù.#yë¥ûï"ycê¹b%ù. 9«({ï#ˆ9.#yb%ú(`:aãûï#9å*ÛÛ™šYË›[Ûœİ\œÊ
y¢ïùb,ˆ9¥m9.ïyc§ùiâùd#ye«»ï"9.#y¦+Øİ\œ™[˜]S[Ûœİ\œÂˆ:`&yê+¸à#:`&yh-9¢,:k)y¢¯yb,:*¬8à#yæ¡9®!ye«»ï"{ï#ˆ9è®¹/çyl,yë¥ù *¹âjyg*9¢,:k)z(èz(ªù¢dù«nûï#9®!ye«‚ˆ:`¡9¦+ùk£9¥m:hkùé.º`&y`"ùg,9c`8à#9§"ydê¹.¦ùê+ºhg¸à#xà ‚Š‹Â‚™[˜İ[ÛˆÙ]›Û™S[Ûœİ\“\İS
›Û™RÙ^J^Â‚ˆÛÛœİÛÛ™šYÏBˆ›Û™PÛÛ™šYÖŞ›Û™RÙ^WNÂ‚‚ˆYŠXÛÛ™šYÊ^Âˆ™]\›ˆˆÂˆB‚‚ˆÛÛœİ›Û™S[Ûœİ\œÏB‚ˆ\[ÙˆÛÛ™šYË›[Ûœİ\œÏOOBˆ™[˜İ[Ûˆ‚ˆÂˆÛÛ™šYË›[Ûœİ\œÊ
Bˆ‚ˆ×NÂ‚‚ˆÛÛœİÙY[“˜[Y\ÏBˆ™]ÈÙ]

NÂ‚‚ˆÛÛœİ[™\ÏBˆ×NÂ‚‚ˆ›Û™S[Ûœİ\œË™›Ü‘XXÚ
ˆ[Ûœİ\OÂ‚ˆYŠˆ[[Ûœİ\ˆˆÙY[“˜[Y\Ëš\Êˆ[Ûœİ\‹›˜[YBˆ
Bˆ
^Âˆ™]\›ÂˆB‚‚ˆÙY[“˜[Y\Ë˜Y
ˆ[Ûœİ\‹›˜[YBˆ
NÂ‚‚ˆ[™\Ëœ\Ú
‚ˆ[Ûœİ\‹›˜[YJÂˆ“‹ˆŠÂˆ[Ûœİ\‹›]™[
Âˆ¹¥cù£mÈŠÂˆX]œ›İ[™
ˆÙ][Ûœİ\YÚ[]Jˆ[Ûœİ\‚ˆ
Bˆ
B‚ˆ
NÂ‚ˆBˆ
NÂ‚‚ˆ™]\›ˆ[™\Âˆ›X\
ˆ[™OO‚ˆ]ˆŠÂˆ[™JÂˆÙ]ˆ‚ˆ
Bˆš›Ú[ŠˆŠNÂ‚ŸB‚‚‹Ê‚ˆ8¦!H9¥¬9h§»ï"9/§yáiù/oùå*: !z) y¬`»ï#9íí9b§ùc`9¥.yâb;ï"{ï&‚ˆ9«ãù`"ùg,9c`9æ¡: ã9¦kùï£º(dùg%»ï#9ab9åfyên¹keù.,‚ˆ;ï"9/oùå*: !y.bùo£9§ ú(ç9."˜˜\ÙM9¢%¹g%¹âaùí¬¹g`;ï#ˆ9cêº) y¢¢¹l#y¡ây«!9/cyhjú`,¹c®ùl,y§ ùå'ù¥b;ï#ˆ\U˜Z[š[™Ö›Û™P˜XÚÙÜ›İ[™

z-çú`&z(èBˆ9k£9aj9.#yå*9a£y¥.{ï"xà ‚Š‹Â‚‹Ê‚ˆ8¦!H9¥¬9h§»ï"9/§yáiù/oùå*: !z) y¬`»ï#9mèy *ºh zgh‚ˆ;ï"ÛX\YÙ{ï"z ã9¦kù¥.y¢$9/§yg,9c`9båy¡bùb!ù£æûï"{ï&‚ˆ9c§ù§+ÛX\YÙyæ¡: ã9¦kù¦+ùkêù«nùg*ÔÔú(èyæ¡ˆ9e«¹. 9o-y¨ë¹§¥ùg%»ï#9.#yë¨z`,¹dê¹`"ùg,9c`:`ïzemùo¥Âˆ9. 9ª(øà º`&z(èy¥.y¢$:-çùíí9b§ùc`9g,9g%ºh$:)¯yd#9. 9ê+‚ˆ:*+z*"8 %8 %9. 9`"ùâjy.íº(çz$eù«ãù`"ùg,9c`9d!:!ê¹æ¡ˆ: ã9¦kùg%»ï#›Ü™\İÙ\Ù\9ab9¥/¹."¹/oùå*: !Bˆ:`&y«(y£ä9/¦ùæ¡9g%»ï#9amºi&9g,9c`9åfyên¸à y.bùo£ˆ9/oùå*: !z) z(ç9g%¹âaùæí9£©yhjú`,¹l#y¡ây«!9/cyl,yio{ï#ˆ9.#yå*9¥.y.îù/eyam¹.å¹ê"ùo#ùè¯8à ‚‚ˆ:`¡9¬¤¹§"yl"9lk9g%¹âaùæ¡9g,9c`;ï#9ieùå*\SX\›Û™P˜XÚÙÜ›İ[™

Bˆ9¦`¹§ ú` 9fçºhkùé.™›Ü™\İ:`&yo-yåmºh$:*+y`/;ï#ˆ9.#y§ ùaî¹ãï¹. 9âaúnäyæ¡9åjúgh¸à ‚Š‹Â‚˜ÛÛœİX\›Û™P˜XÚÙÜ›İ[™[XYÙ\Ï^Â‚ˆ›Ü™\İˆ˜\ÜÙ]ËÛX\ËÙ›Ü™\İšœÈ‹ˆ\Ù\ˆ˜\ÜÙ]ËÛX\ËÙ\Ù\šœÈ‹ˆXÙNˆˆ‹ˆ›Û™Mˆˆ‹ˆ›Û™MNˆˆ‹ˆ›Û™Mˆˆ‹ˆ›Û™MÎˆˆ‹ˆ›Û™Nˆˆ‹ˆ›Û™NNˆˆ‹ˆ›Û™LLˆˆ‚‚ŸNÂ‚‚™[˜İ[Ûˆ\SX\›Û™P˜XÚÙÜ›İ[™
›Û™RÙ^J^Â‚ˆÊ‚ˆ8¦!H9/ë¹«hûï"9/§yáiù/oùå*: !yfç¹h,{ï#9¥.y¢$9¤ãy/gˆ9ãj9êâùæ¡ÜÚ][Û™š^Y: ã9¦kùg%¹li;ï#ˆ9.#ya£yæí9£©yl#HÛX\YÙy§+:.ªú*+yk¦‚ˆ˜XÚÙÜ›İ[™Z[XYÙ{ï"xà ‚ˆ
‹Â‚ˆÛÛœİ™Ó^Y\Bˆ	
›X\YÙP™Ó^Y\ˆŠNÂ‚‚ˆYŠX™Ó^Y\Š^Âˆ™]\›ÈB‚‚ˆÛÛœİ[XYÙU\›B‚ˆX\›Û™P˜XÚÙÜ›İ[™[XYÙ\ÖŞ›Û™RÙ^W_ˆX\›Û™P˜XÚÙÜ›İ[™[XYÙ\Ë™›Ü™\İÂ‚‚ˆ™Ó^Y\‹œİ[K˜˜XÚÙÜ›İ[™[XYÙOB‚ˆ\›
ŠÂˆ[XYÙU\›
ÂˆŠHÂ‚ŸB‚‚‹Ê‚ˆ8¦!H9¥¬9h§»ï"9/§yáiù/oùå*: !z) y¬`»ï#8à#9¢ : ïzacz(çBˆ9cêºhkùé.šXÛÛ»ï#9æë¹bcy¬¤¹§"ZXÛÛ¹g%¹é.¹l,yab9ênº$eøà#{ï"{ï&‚ˆ9¢ : ïyg%¹é.¹æ¡:h$9åfy§éy¢oº(j;ï#Ù^y¦+ù¢ : ïRQ;ï#ˆ˜[Yyab9aj:`ê9åfyên¹keù.,¸à ¹.bùo£:) ynjù¢ : ïz(çˆ9g%¹é.»ï#9æí9£©yl#z`&y`"ùâjy.í¹hjùaiyl#y¡âyæ¡ˆ˜\ÙM9¢%¹g%¹âaùí¬¹g`9l,y§ ùå'ù¥b;ï"9¢ : ïyb%ú(j8à Bˆ:(çy`¦y«!9¨/9kd8à y¢ : ïz*lùí,9ob9ê¥ù."y`"ùg,9¥®z`ïBˆ9§ ú!ê¹båyieùå*9d#9. 9o-yg%»ï#9.#yå*9b!¹b)yc®ù¥.{ï"{ï#ˆ9.#yå*9¥.y.îù/eyam¹.å¹ê"ùo#ùè¯8à ‚Š‹Â‚˜ÛÛœİÚÚ[XÛÛ’[XYÙ\ÏY[[Y[ÚÚ[XÛÛ“X\Â‚‚˜ÛÛœİ›Û™P˜XÚÙÜ›İ[™[XYÙ\Ï^Â‚ˆ›Ü™\İˆˆ‹ˆ\Ù\ˆˆ‹ˆXÙNˆˆ‹ˆ›Û™Mˆˆ‹ˆ›Û™MNˆˆ‹ˆ›Û™Mˆˆ‹ˆ›Û™MÎˆˆ‹ˆ›Û™Nˆˆ‹ˆ›Û™NNˆˆ‹ˆ›Û™LLˆˆ‚‚ŸNÂ‚‚™[˜İ[Ûˆ\U˜Z[š[™Ö›Û™P˜XÚÙÜ›İ[™
›Û™RÙ^J^Â‚ˆÊ‚ˆ8¦!H9/ë¹«hûï"9/§yáiù/oùå*: !yfç¹h,{ï#9¥.y¢$9¤ãy/gˆ9ãj9êâùæ¡ÜÚ][Û™š^Y: ã9¦kùg%¹li;ï"{ï&‚ˆ:`&y`"ùg%¹li9æ¡ÔÔÈÛ\Üù§+:.ªùmì¹í¤ùaiùnî¹.¡‚ˆ8à#:*¯ù¦¥ù¯.9li
úh$:*+yî/z)¯yg%¸à#z`&y`"ùía9d"ˆ;ï":)¢Ë˜Z[š[™ËX™ËYš^Y[^Y\»ï"{ï#ˆ:`&z(èyi ¹§§9cê¹å*:(c9aiùª(ùo#ú$âù. 9`"ùe«¹í%9æ¡ˆ\›
‹‹Šy."¹c®ûï#9§ ù¢¢º*¯ù¦¥ù¯.9li9. :-mú$âù£¢xà Bˆ9`"ùb)yg,9c`9æ¡9g%¹âaù§ ú+¢¹¢$9¬¤¹§"z*¯ù¦¥ù¥b9§§;ï#ˆ:-çùî/z)¯yg%¹.#y. :!í8à ¹¢`9.éz`&z(èz*+yk¦º(c9aiÂˆ9ª(ùo#ù¦`»ï#9. 9ª(ú) yå*8à#9¯.9li
ùg%¹âaøà#yæ¡ˆ9ía9d"9kêù¬å{ï#9.#z ïycê¹kêİ\›

xà ‚ˆ
‹Â‚ˆÛÛœİ™Ó^Y\Bˆ	
˜Z[š[™ÔYÙP™Ó^Y\ˆŠNÂ‚‚ˆYŠX™Ó^Y\Š^Âˆ™]\›ÂˆB‚‚ˆÛÛœİ[XYÙU\›Bˆ›Û™P˜XÚÙÜ›İ[™[XYÙ\ÖŞ›Û™RÙ^WNÂ‚‚ˆYŠ[XYÙU\›
^Â‚ˆÛÛœİ™^˜XÚÙÜ›İ[™Bˆ›[™X\‹YÜ˜YY[
™Ø˜J
K™Ø˜J
JKŠÂˆ\›
ŠÂˆ[XYÙU\›
ÂˆŠHÂ‚ˆYŠ™Ó^Y\‹œİ[K˜˜XÚÙÜ›İ[™[XYÙHOO[™^˜XÚÙÜ›İ[™
^Âˆ™Ó^Y\‹œİ[K˜˜XÚÙÜ›İ[™[XYÙO[™^˜XÚÙÜ›İ[™ÂˆB‚ˆBˆ[Ù^Â‚ˆÊ‚ˆMûï&¹¬¤¹§"yl"9lk9g%¹âaù¦`¹cê¹g*9ç'ùæ¡9kf9g*:(c9aiú ã9¦kù¦`¹¢cy®!zfi8à ‚ˆ:`c¹c®ù«ãù«(y¢dúe¢ùg,9c`:,áú*"º`ïzaãykêØ˜XÚÙÜ›İ[™[XYÙ{ï#:acyd"ˆØ[\İ[™Èœ›İÜÙ\¹æ¡˜[œÙ›Ü›yî+¹¥/º"!Ùš^Y: ã9¦kù§ ú)î9æo9¦ º,­:aãyîj¸à ‚ˆ9ãï¹g*:`oùacyá(y¡#ùïªyæ¡İ[H]]][Û»ï#9æí9£©y¬¯ùå*ÔÔùî/z)¯z ã9¦køà ‚ˆ
‹Â‚ˆYŠ™Ó^Y\‹œİ[K˜˜XÚÙÜ›İ[™[XYÙJ^Âˆ™Ó^Y\‹œİ[Kœ™[[İ™T›Ü\J˜˜XÚÙÜ›İ[™Z[XYÙHŠNÂˆB‚ˆB‚ŸB‚‚‹Ê‚ˆ8¦!H9¥¬9h§»ï&¹íí9b§ùc`9g,9c`:,áú*"¹ob9ê¥ø %8 %:nç¹¥¡ùkeÂˆ9¦`º)î9æo;ï#:hkùé.º`&y`"ùg,9c`9æ¡9 *¹âjy®!ye«»ï#ˆ9.)¹/§yáiùæë¹bcyëbyí&¹¬n¹k¦¸à#:`,¹aixà#y£"zb%z ïy.#z ïBˆ9£"xà º-çù..ùgãº`¨ù¢nyob9ê¥ùalyå*9d#9. 9ieÂˆšÛYKY™X]\™K[[Ù[9ª(ùo#øà ‚Š‹Â‚™[˜İ[ÛˆÜ[•˜Z[š[™Ö›Û™R[™›Ê›Û™RÙ^J^Â‚ˆÛÛœİÛÛ™šYÏBˆ›Û™PÛÛ™šYÖŞ›Û™RÙ^WNÂ‚‚ˆÛÛœİ[Ù[Bˆ	
˜Z[š[™Ö›Û™S[Ù[ŠNÂ‚ˆÛÛœİ]Q[Bˆ	
˜Z[š[™Ö›Û™S[Ù[]HŠNÂ‚ˆÛÛœİ›ÙQ[Bˆ	
˜Z[š[™Ö›Û™S[Ù[›ÙHŠNÂ‚‚ˆYŠˆXÛÛ™šYÈˆ[[Ù[ˆ]]Q[ˆX›ÙQ[ˆ
^Âˆ™]\›ÂˆB‚‚ˆ\U˜Z[š[™Ö›Û™P˜XÚÙÜ›İ[™
ˆ›Û™RÙ^Bˆ
NÂ‚‚ˆ]Q[^ÛÛ[BˆÛÛ™šYË]_¹g,9c`:,áú*"ˆÂ‚‚ˆÛÛœİ[Ûœİ\“\İSBˆÙ]›Û™S[Ûœİ\“\İS
ˆ›Û™RÙ^Bˆ
NÂ‚‚ˆÛÛœİ[›ØÚÙYB‚ˆ^Y\‹›]™[BˆÛÛ™šYËœ™\]Z\™Y]™[Â‚‚ˆ›ÙQ[š[›™\’SB‚ˆ	Ï]ˆİ[OH™›Û\Ú^™NŒMœØÛÛÜˆÙŒNÛX\™Ú[‹X›İÛNÈ‰ÊÂˆ
ÛÛ™šYË›]™[˜[™Ù_ˆŠJÂˆÙ]ˆŠÂ‚ˆ	Ï]ˆİ[OH™›Û\Ú^™NŒMœÛ[™KZZYÚŒKNÛX\™Ú[‹X›İÛNŒMœÈ‰ÊÂˆ
ˆ[Ûœİ\“\İSˆ	ÏÜ[ˆİ[OH˜ÛÛÜˆØŒØMNÎÈ»ï"9l&¹á(y *¹âjz,áù¥¦{ï"OÜÜ[‰Âˆ
JÂˆÙ]ˆŠÂ‚ˆ	Ï]ˆİ[OH™\Ü^N™›^ÙØ\È‰ÊÂ‚ˆ
ˆ[›ØÚÙYˆÂˆ	Ï]ÛˆÛ\ÜÏHšÛYKY™X]\™KX^KXˆœİ[OH™›^ŒNÜY[™ÎŒLLœÙ›Û\Ú^™NŒMœÛZ[‹ZZYÚœÈ‰ÊÂˆ	ÛÛ˜ÛXÚÏH˜ÛÜÙU˜Z[š[™Ö›Û™R[™›Ê
NÙ[\–›Û™J	ÉÊÂˆ›Û™RÙ^JÂˆ	×	ÊNÈ‰ÊÂˆº`,¹aiHŠÂˆØ]Ûˆ‚ˆ‚ˆ	Ï]ÛˆÛ\ÜÏHšÛYKY™X]\™KX^KXˆœİ[OH™›^ŒNÜY[™ÎŒLLœÙ›Û\Ú^™NŒMœÛZ[‹ZZYÚœÈ™\ØX›Y‰ÊÂˆºg :) H‹ˆŠÂˆÛÛ™šYËœ™\]Z\™Y]™[
ÂˆØ]Ûˆ‚ˆ
JÂ‚ˆ	Ï]ÛˆÛ\ÜÏHšÛYKY™X]\™KX^KXˆœİ[OH™›^ŒNÜY[™ÎŒLÈ‰ÊÂˆ	ÛÛ˜ÛXÚÏH˜ÛÜÙU˜Z[š[™Ö›Û™R[™›Ê
NÈ‰ÊÂˆº/å9fçˆŠÂˆØ]ÛˆŠÂ‚ˆÙ]ˆÂ‚‚ˆ[Ù[˜Û\ÜÓ\İ˜Y
ˆœÚİÈ‚ˆ
NÂ‚ŸB‚‚™[˜İ[ÛˆÛÜÙU˜Z[š[™Ö›Û™R[™›Ê
^Â‚ˆÛÛœİ[Ù[Bˆ	
˜Z[š[™Ö›Û™S[Ù[ŠNÂ‚‚ˆYŠ[Ù[
^Â‚ˆ[Ù[˜Û\ÜÓ\İœ™[[İ™JˆœÚİÈ‚ˆ
NÂ‚ˆB‚ŸB‚‚™[˜İ[Ûˆ\]SX\YÙRXY\Š
^Â‚ˆÛÛœİX\YÙQ[[Y[Bˆ	
›X\YÙHŠNÂ‚‚ˆÛÛœİ\ÓX\YÙOB‚ˆX\YÙQ[[Y[	‰‚ˆX\YÙQ[[Y[˜Û\ÜÓ\İ˜ÛÛZ[œÊˆ˜Xİ]™H‚ˆ
NÂ‚‚ˆÊ‚ˆ8¦!H9/ë¹«hûï"9/§yáiù/oùå*: !z) y¬`»ï#8à#9.#y¦+úf¬z%ãûï#ˆ9¦+ù¥m9`"ù¢ïù£¢{ï#9.#z) yåfy. 9hbºnäz"l¹ên¹æoxà#{ï"{ï&‚ˆ:`&z(èyc§ù§+:!ê¹mìyg'ù¬åyábzbï9kêù.¡¹. 9.ïxà#9..ùgã¹¦`‚ˆ:f¬z%ãùª&zhc9b%øà#yæ¡:`£ú/+ûï#9cê¹å*\Ü^N››Û™Bˆ:$âù£¢yaiùk®{ï#9/a‹˜ÛÛ[:`¨ùhb¹c`9gçùc§ù§+9¦+Âˆ9å*ÜÚ][Û˜XœÛÛ]NİÜŒœ9ë¥ùioBˆ8à#9¢hù£¢yª&zhc9b%újæ9n©¹o£8à#yæ¡9/cyïk»ï#9ª&zhc9b%Âˆ9­¢9i,y.¡¸à K˜ÛÛ[9¬¤¹§"z-çú$eú(ç9."¹c®ûï#ˆ9¢cy§ ùên¹aî¹. 9hbŒœ:jæ9æ¡:näz"l¹c`9gçøà ‚‚ˆ9o£9/¡¹æo9ãïœÚİÔYÙJ
z(èyam¹ké¹mì¹í¤ù§"y. 9ieÂˆ9k£9¥m8à y«hùè®º&eyä!º`&y.í¹.¢ùæ¡9ªgùb-‚ˆ;ï"Ø\9æ¡›ËZXY\º`&y`"ØÛ\Üûï#9¤+zacBˆÔÔùæ¡˜ÛÛ[İÜŒ{ï"{ï#9¢ïù£¢z`&z(èBˆ9¥m9«­z!ê¹mìykêùæ¡:`£ú/+ûï#9¥.y¢$9¢¢ˆšÛYH»ï#Âˆ˜Z[š[™È¹b¨:`,œÚİÔYÙJ
z(èyæ¡ˆYRXY\”YÙ\ù®!ye«»ï#9æí9£©yå*9ãï¹¢$8à Bˆ9«hùè®¹æ¡9ªgùb-º&eyä!»ï#9.#y§ ùa£yåfy."ùên¹æoyc`9hb¸à ‚ˆ
‹Â‚‚ˆÛÛœİ˜[YQ[Bˆ	
œ^Y\“˜[YHŠNÂ‚ˆÛÛœİ[™›Ñ[Bˆ	
œ^Y\’XY\’[™›ÈŠNÂ‚ˆÛÛœİ›Û™Q[Bˆ	
›X\XY\–›Û™S˜[YHŠNÂ‚ˆÛÛœİ[Ûœİ\’[™›Ñ[Bˆ	
›X\XY\“[Ûœİ\’[™›ÈŠNÂ‚‚ˆYŠ˜[YQ[
^Â‚ˆ˜[YQ[œİ[K™\Ü^OB‚ˆ\ÓX\YÙBˆÂˆ››Û™H‚ˆ‚ˆˆÂ‚ˆB‚‚ˆYŠ[™›Ñ[
^Â‚ˆ[™›Ñ[œİ[K™\Ü^OB‚ˆ\ÓX\YÙBˆÂˆ››Û™H‚ˆ‚ˆˆÂ‚ˆB‚‚ˆYŠ›Û™Q[
^Â‚ˆ›Û™Q[œİ[K™\Ü^OB‚ˆ\ÓX\YÙBˆÂˆˆ‚ˆ‚ˆ››Û™HÂ‚ˆB‚‚ˆYŠ[Ûœİ\’[™›Ñ[
^Â‚ˆÊ‚ˆ8¦!H9/ë¹«hûï"9/§yáiù/oùå*: !z) y¬`»ï#8à#:%ãz"l¹¨a‚ˆ9am¹.åº`ïy.#z) xà#{ï"{ï&º`&y`"ùk®yfj
9ëbyí&¹ëá9g#Bˆ:`¨ú(c
y.#yë¨yg*9.#yg*9g,9g%ºh zgh»ï#9. 9o¢Âˆ:f¬z%ãûï#9cê¹åfyg,9g%¹d#yê,z`¨ù. :(c8à ‚ˆ
‹Â‚ˆ[Ûœİ\’[™›Ñ[œİ[K™\Ü^OBˆ››Û™HÂ‚ˆB‚‚ˆYŠZ\ÓX\YÙJ^Âˆ™]\›ÂˆB‚‚ˆÛÛœİÛÛ™šYÏB‚ˆ›Û™PÛÛ™šYÖØİ\œ™[›Û™WBˆˆ›Û™PÛÛ™šYË™›Ü™\İÂ‚‚ˆYŠ›Û™Q[
^Â‚ˆÊ‚ˆ8¦!H9/ë¹«hûï"9/§yáiù/oùå*: !z) y¬`»ï#8à#9."ºgh‚ˆ:%ãz"l¹¨a¹cê¹åfyg,9g%¹d#ykeùfæù`"ùkeûï#9am¹.å‚ˆ:`ïy.#z) xà#{ï"{ï&‚ˆÛÛ™šYË]y§+:.ªùn-º$eÙ[[Úšybcyí­ˆ;ï"9/¢ùi ˆ¸¦ì;î#È9mê9ãn:#d¹c§È»ï"{ï#:`&z(èyå*ˆ9«hú)£ú(j:`e9o#ùc®ù£¢ze¢úh+yæ¡[[Úšz-çÂˆ9ên¹æo{ï#9cê¹åfy."ùí%9.+y¥¡ùg,9g%¹d#yê,xà ‚ˆ9.gù.#ya£z!ê¹mìyb¨¼'åî»î#Èº`&y`"ùbcyí­8à ‚ˆ
‹Â‚ˆ›Û™Q[^ÛÛ[B‚ˆ
ÛÛ™šYË]_ˆŠBˆœ™\XÙJˆ×—Ê×Ê‹Ëˆˆ‚ˆ
NÂ‚ˆB‚‚ˆÊ‚ˆ8¦!H9/ë¹«hûï"9/§yáiù/oùå*: !z) y¬`»ï#8à#:%ãz"l¹¨a‚ˆ9am¹.åº`ïy.#z) xà#xà#9ªf:"lº`ê9b!¹cëù.éy¢ïù£¢xà#{ï"{ï&‚ˆ9ëbyí&¹ëá9g#y¥¡ùkeøà y *¹âjy®!ye«¹¨a»ï#9ajy`"ú`ïBˆ9¥m9`"ù.#ya£zhkùé.¸ %8 %X\XY\“[Ûœİ\’[™›Âˆ:`&y`"ùi%¹li9k®yfj9§+9/¡¹l,yg*9."ºgh¹æ¡\ÓX\YÙBˆ9b)9¥­ùo#ú(èz(ªú*+y¢$9. 9k¦ºf¬z%ãÂˆ;ï"\Ü^N››Û™{ï"{ï#:`&z(èy.#yå*9a£z&eyä!»ï&Âˆ9 *¹âjy®!ye«¹¨a»ï"X\[Ûœİ\“\İ›Ş;ï"Bˆ9æ¡9aiùk®y.gù.#yå*9a£yå(¹å'ûï#9æí9£©y.#ykêùaixà ‚ˆ
‹Â‚ŸB‚‚‹ÊˆOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOBˆ8¦!H9¦í9¥¬RBOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOH
‹Â‚™[˜İ[Ûˆ\]URJ
^Â‚ˆ[\˜]T[[YSY]šXÊ\]URHŠNÂ‚ˆÛÛœİİ]ÏYÙ]XZ[Ú\˜Xİ\”İ]Ê
NÂ‚ˆ^Y\‹šSX]›X^
X]›Z[Š^Y\‹šİ]Ë›X^
JNÂˆ^Y\‹œÜSX]›X^
X]›Z[Š^Y\‹œÜİ]Ë›X^Ô
JNÂ‚ˆYŠ˜]PXİ]™J^Â‚ˆÜ[]TÚÚ[]ZXÚĞ˜\Š
NÂ‚ˆYŠˆ	
š][SY[HŠI‰‚ˆ	
š][SY[HŠK˜Û\ÜÓ\İ˜ÛÛZ[œÊœÚİÈŠBˆ
^Âˆ™[™\˜]Tİ[Û“Y[J
NÂˆB‚ˆİ\œ™[˜]S[Ûœİ\œË™›Ü‘XXÚ
[™^OÂˆ\]S[Ûœİ\•RJ[™^
NÂˆJNÂ‚ˆ\]P˜]T^Y\˜\œÊ
NÂ‚ˆÛÛœİ›ÜÜÔ™\Ù[][Û“İÛ™\]\[ÙˆÚ[™İÈOOH[™Yš[™YİÚ[™İË‘›İ\”Ş[X›ÛĞ›ÜÜĞ˜]N›[ÂˆYŠ›ÜÜÔ™\Ù[][Û“İÛ™\‰‰\[Ùˆ›ÜÜÔ™\Ù[][Û“İÛ™\‹œŞ[˜ÒYOOH™[˜İ[ÛˆŠ^Âˆ›ÜÜÔ™\Ù[][Û“İÛ™\‹œŞ[˜ÒY

NÂˆB‚ˆ™]\›ÂˆB‚ˆ\]RÛYU\İÛÛÊ
NÂˆ\]U˜Z[š[™Ö›Û™SØÚÜÊ
NÂˆ\]TÙXÛÛ™Ú\˜Xİ\˜[›™\Š
NÂˆ\]QÛÛ\Ü^J
NÂˆ\]SX\^Y\Ø\™

NÂˆ\]SX\YÙRXY\Š
NÂ‚ˆ	
œ^Y\“]™[ŠK^ÛÛ[\^Y\‹›]™[Âˆ	
šXY\’ŠK^ÛÛ[\^Y\‹šÂˆ	
šXY\”ÔŠK^ÛÛ[\^Y\‹œÜÂ‚ˆ	
œÚÚ[Ú[ÈŠK^ÛÛ[Bˆ
ˆÙ]ÚÚ[Ú\˜Xİ\“Øš™Xİ
İ\œ™[ÚÚ[Ú\˜Xİ\Š_ˆ^Y\‚ˆ
KœÚÚ[Ú[ÎÂ‚ˆ	
œÚ\™Y^˜[YHŠK^ÛÛ[BˆX]›X^
X]™›ÛÜŠ[X™\ŠÚ\™Y^
_
JBˆÓØØ[Tİš[™ÊšUÈŠNÂ‚ˆ™[™\‘^\İšX]S\İ

NÂˆ\]Tİ]\Ô™]šY]Ê
NÂŸB‚‚‹ÊˆOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOBˆ8¦!H:!ê¹båykf9ª¥‚ˆ:fi9.¡¹c§ù§+9g*9ânyk¦¹båy/g:nç»ï"9caùí&¸à z(çy`¦xà y¢,:k)ybçyb*x )»ï"Bˆ9§ ùkf9ª¥9.bùi%»ï#:`&z(èya£yb¨9ajyli9/çzfª»ï&‚‚ˆKˆ9«ãÈŒ9éä¹k¦¹¦`º!ê¹båykf9. 9«({ï#ˆ9.)¹g*9åjúgh¹cìù."ú)ä¹çëy¦ªúhkùé.¸à#<'ä¯ˆ9mìº!ê¹båykf9ª¥8à#{ï#ˆ:+¤ùãªyk­¹çéz`dùç'ùæ¡9§"yg*9kf;ï#9.#y¦+ù¡¤yên¹¥/¹oàøà ‚‚ˆ‹ˆ9b!ùb,: ã9¦kûï"9b!Ğ\8à yb!ùb!ºh xà z'¨¹nezc¥¹k¦»ï"Bˆ9æ¡9åm¹."ùêâùb.ùkf9. 9«({ï#ˆ:`&y¦+ù§ 9k®y¦$ù¯#ù£¢z`,¹n©¹æ¡9 áy¬àx %8 %ˆ9ãªyk­¹o¢9cëú ïyê yá-º(ªúfîú*ly¢dù¥­øà Bˆ9¢%¹æí9£©yb!ùaî¹c®ùfç“S‘{ï#ˆ:`&y¦`¹`&y.#z ïycêºghŒ9éä¹æ¡9k¦¹¦`¹fj8à ‚‚ˆ9ajyê+¹ áy¬àz`ïydo9cêùd#9. 9`"È]]ÔØ]™S›İÊ
{ï#ˆ9aiú`ê9§+:.ªù§"]KØØ]Ú;ï#ˆ9kf9ª¥9i,y¥eù.#y§ ú+¤ú`b¹¢,¹åm¹£¢{ï#ˆ9cê¹§ ùg*ÛÛœÛÛyåfy."úc+ú*©:*"¹ kù¥®y/¯ù.bùo£:fi:c+øà ‚OOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOH
‹Â‚›]]]ÜØ]™R[™XØ]Ü•[Y\[[Â‚›]]]ÜØ]™R[\˜[Y[[Â‚‚™[˜İ[Ûˆ\ÑØ[YTİ\Y

^Â‚ˆ™]\›ˆHJˆ^Y\ˆ	‰‚ˆ^Y\‹šYˆ
NÂ‚ŸB‚‚™[˜İ[ÛˆÚİĞ]]ÜØ]™R[™XØ]ÜŠ
^Â‚ˆÛÛœİ[Bˆ	
˜]]ÜØ]™R[™XØ]ÜˆŠNÂ‚‚ˆYŠY[
^Âˆ™]\›ÂˆB‚‚ˆ[˜Û\ÜÓ\İ˜Y
ˆœÚİÈ‚ˆ
NÂ‚‚ˆÛX\•[Y[İ]
ˆ]]ÜØ]™R[™XØ]Ü•[Y\‚ˆ
NÂ‚‚ˆ]]ÜØ]™R[™XØ]Ü•[Y\ˆBˆÙ][Y[İ]


OOÂ‚ˆ[˜Û\ÜÓ\İœ™[[İ™JˆœÚİÈ‚ˆ
NÂ‚ˆKMŒ
NÂ‚ŸB‚‚™[˜İ[Ûˆ]]ÔØ]™S›İÊÚİÒ[™XØ]ÜŠ^Â‚ˆYŠZ\ÑØ[YTİ\Y

J^Âˆ™]\›ÂˆB‚‚ˆ^Â‚ˆØ]™QØ[YJ
NÂ‚‚ˆYŠÚİÒ[™XØ]ÜŠ^Â‚ˆÚİĞ]]ÜØ]™R[™XØ]ÜŠ
NÂ‚ˆB‚ˆBˆØ]Ú
\œ›ÜŠ^Â‚ˆÛÛœÛÛK™\œ›ÜŠˆº!ê¹båykf9ª¥9i,y¥eûï&ˆ‹ˆ\œ›Ü‚ˆ
NÂ‚ˆB‚ŸB‚‚™[˜İ[Ûˆİ\]]ÔØ]™J
^Â‚ˆYŠ]]ÜØ]™R[\˜[Y
^Â‚ˆÛX\’[\˜[
ˆ]]ÜØ]™R[\˜[Yˆ
NÂ‚ˆB‚‚ˆÊ‚ˆ9«ãÌŒ9éä¹k¦¹¦`¹kf9ª¥;ï#ˆ9cê¹§"yç'ù«húe¢ùiâú`b¹¢,»ï"9mì¹bmz)ä»ï"y¢cy§ ùkéºf¦ùkêùai{ï#ˆ:`¡9g*9bmz)ä¹åjúgh¹¦`º`&z(èy§ ùæí9£©z-ìú`c¸à ‚ˆ
‹Â‚ˆ]]ÜØ]™R[\˜[YBˆÙ][\˜[


OOÂ‚ˆ]]ÔØ]™S›İÊYJNÂ‚ˆKŒ
NÂ‚‚ˆÊ‚ˆ9b!ùb,: ã9¦kûï#ùb!ùb!ºh y¦`¹êâùb.ùkf9. 9«(xà ‚ˆ9.#zhkùé.¹£ä9é.»ï#9fè9à®¹åjúghº`&y¦`¹`&Bˆ9ãªyk­º`&¹n.9mì¹í¤ùç"ù.#yb,9.¡¸à ‚ˆ
‹Â‚ˆØİ[Y[˜Y]™[\İ[™\Šˆš\ÚXš[]XÚ[™ÙH‹ˆ

OOÂ‚ˆYŠØİ[Y[šY[Š^Â‚ˆ]]ÔØ]™S›İÊ˜[ÙJNÂ‚‚ˆÊ‚ˆ8¦!H9¥¬9h§»ï"9/§yáiù/oùå*: !yfç¹h,{ï#ˆ8à#9b!ùb,: ã9¦kùa£yb!ùfç¹/¡¹b,9n¥y§"y¬¤¹§"Bˆ9ë¥úfè¹íæ¹í¤újeøà#{ï"{ï&¹b!ùb,: ã9¦kùæ¡ˆ9åm¹."ûï#:*&:c!:`&y`"ù¦`ºe¤únç»ï#9ëbBˆ9b!ùfç¹bcy¦kù¦`¹¢cyçéz`dú) yo§º`&z(èBˆ:e¢ùiâùë¥øà#:fèºe¢ù.¡¹i&¹.axà#xà ‚ˆ
‹Â‚ˆ\İÙ™›[™PÚXÚÕ[Y\İ[\Bˆ]K››İÊ
NÂ‚ˆBˆ[Ù^Â‚ˆÊ‚ˆ8¦!H9¥¬9h§»ï&¹b!ùfç¹bcy¦kù¦`»ï#9å*9bfùbfÂˆ9b!ùb,: ã9¦kú*&:c!9æ¡9¦`ºe¤únç»ï#9ë¥ùaî‚ˆ:`&y«­zfè¹íæ¹¦`ºe¤ùl#y¡âyæ¡:fè¹íæ¹í¤újeø %8 %ˆ:`&yª(ù.#yå*9¥m9`"úaãy¥¬9¥m9ä!ºh zgh¸à Bˆ9e«¹í%9b!ú ã9¦kùa£yb!ùfç¹/¡¹l,y§ ùç'ùæ¡ˆ9ë¥ùb,;ï#9fç¹ëe9.¡¹/oùå*: !yæ¡9å¤yecøà ‚ˆ
‹Â‚ˆØ[İ[]SÙ™›[™Q^Ú[˜ÙJˆ\İÙ™›[™PÚXÚÕ[Y\İ[\ˆ
NÂ‚ˆ\İÙ™›[™PÚXÚÕ[Y\İ[\Bˆ]K››İÊ
NÂ‚‚ˆÊ‚ˆ8¦!H9¥¬9h§»ï"9/§yáiù/oùå*: !z) y¬`»ï#9f%ú*iº&eyä!‚ˆ8à#9î+¹l#ú)¥¹ê¥Ëùb!ùb,: ã9¦kùa£y¢dúe¢ù§ ùchy/cøà#Bˆ9æ¡9ecúhc;ï"{ï&‚ˆ9.bùbcz`&z(èycêº&eyä!¹.¡¸à#9b!ùaî¹c®øà#yæ¡ˆ:`¨ù. 9cb»ï"9kf9ª¥;ï"{ï#9k£9aj9¬¤¹§"z&eyä!‚ˆ8à#9b!ùfç¹/¡¸à#z*l¹ #ºn¯9 h¹oªx %8 %9¢bùªgùà#ú)¯yfjˆ9g*: ã9¦kù¦`¹§ ùi)ùnazfcy/c¹å&º!ìù¦ªù`g:*"9¦`¹fjˆ9æ¡9gíú(c:`'ùn©»ï#9fç¹b,9bcy¦kùæ¡9¦`¹`&{ï#ˆ:`b¹¢,¹aiú`ê9æ¡9fç¹d":*"9¦`¹fj8à BˆÙ][Y[İ]9£¤¹ê"ùo¢9cëú ïymì¹í¤ú-çÂˆ9kéºf¦ùí¤ú`c¹æ¡9¦`ºe¤ùl#y.#y."»ï#:+¢¹¢$9chy/cÂˆ9.#ybåyæ¡9ª(ùkd8à ‚‚ˆ:`&z(èy¬¤º/©¹¬åy/çz+bLL	y/ë¹ioy«ãù. 9ê+‚ˆ9chy/cùæ¡9 áy¬à{ï": ã9¦kúfd9b-¹¦+ùà#ú)¯yfjˆ9li9í&¹æ¡;ï#9§+9/¡¹l,y§"y.¦ùâà9¬ày¬¤º/©¹¬åBˆ9k£9aj:`oùac{ï"{ï#9/aº!ìùl$y`f¹.¡¹. 9`"Âˆ9d"9ä!¹æ¡:(ç9¥d{ï&¹fç¹b,9bcy¦kù¦`»ï#9i ¹§§ˆ9¢,:k)z`¡9g*:`,º(c8à z/*¹b,:g :) yãªyk­º!ê¹mìBˆ:`n9¤áùæ¡:)äº"l»ï#:aãy¥¬9¥m9ä!¹. 9«(y`$¹¥n:*"9¦`‚ˆ;ï"9íi¹. 9`"ùaj9¥¬9æ¡Œ9éä»ï#: #9.#y¦+ùní¹î£ˆ9. 9`"ùcëú ïymì¹í¤ùg*: ã9¦kú-äyk£9æ¡:""¹`$¹¥n;ï"{ï#ˆ9.)¹.%:aãy¥¬9¥m9ä!¹. 9«(yåjúghºhkùé.»ï#ˆ:fcy/c¹chy/cùæ¡9ªgùã¡øà ‚ˆ
‹Â‚ˆYŠˆ˜]PXİ]™H	‰‚ˆ˜]T\ÙOOOBˆ™XÛ\™H‚ˆ
^Â‚ˆÛÛœİ]]ÓÛBˆXİ]™P˜]PÚ\˜Xİ\’[™^OOLˆÈ]]Ğ˜]BˆˆÙ]\P]]ĞÛÛ™šYÊXİ]™P˜]PÚ\˜Xİ\’[™^
K™[˜X›YÂ‚‚ˆYŠX]]ÓÛŠ^Â‚ˆ[Y\LŒÂ‚ˆ\]U[Y\Š
NÂ‚ˆB‚ˆB‚‚ˆYŠ˜]PXİ]™J^Â‚ˆ\]URJ
NÂ‚ˆB‚ˆB‚ˆBˆ
NÂ‚‚ˆÊ‚ˆ:eç:e¢yb!ºh {ï#úaãy¥¬9¥m9ä!¹bcyæèzaãùkf9. 9«(xà ‚ˆ9¢bùªgùà#ú)¯yfj9.#y. 9k¦¹§ ùè®¹kéº)î9æo:`&y`"ù.¢ù.í»ï#ˆ9/a¹b¨9.¡¹k£9aj9á(yk¬ûï#9i&¹. 9li9/çzfª¸à ‚ˆ
‹Â‚ˆÚ[™İË˜Y]™[\İ[™\Šˆ˜™Y›Ü™][›ØY‹ˆ

OOÂ‚ˆ]]ÔØ]™S›İÊ˜[ÙJNÂ‚ˆBˆ
NÂ‚ŸB‚‚‹ÊˆOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOBˆ9b'yiâùc%‚OOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOH
‹Â‚^Â‚ˆ™XZ[[™[ÜTÛİÊ
NÂ‚ˆ\]PÜ™X][Û•RJ
NÂ‚ˆ™[™\”ÚÚ[ØYİ]

NÂ‚ˆ™[™\’[™[ÜJ
NÂ‚ˆ\]T^Y\’XY\Š
NÂ‚ˆ\]URJ
NÂ‚ŸB˜Ø]Ú
\œ›ÜŠ^Â‚ˆÛÛœÛÛK™\œ›ÜŠˆº`b¹¢,¹b'yiâùc%¹æo9å'úc+ú*©;ï&ˆ‹ˆ\œ›Ü‚ˆ
NÂ‚ŸB‚‚‹Êˆ[Øš[H\™Ø\™KØœ›İÜÙ\ˆ˜XÚÈİX\™ˆHš\œİ˜XÚÈ™\ÜÈ\ÚÜÈ›Ü‚ˆÛÛ™š\›X][ÛÈÛÛ™š\›Z[™È\™›Ü›\ÈH™X[˜]šYØ][Û‹Ø[˜Ù[[™ÈÙY\ÂˆH^Y\ˆ[ˆHØ[YKˆ
‹ÂŠ[˜İ[Ûˆ[œİ[[Øš[P˜XÚĞÛÛ™š\›X][ÛŠ
^Â‚ˆ][İÚ[™Ñ^]Y˜[ÙNÂˆ]^]›Û\Ü[Y˜[ÙNÂ‚ˆÚ[™İË˜[İÑØ[YS˜]šYØ][ÛJ
OOÂˆ[İÚ[™Ñ^]]YNÂˆNÂ‚ˆ^Âˆ\İÜKœ\Úİ]JÜœÑ^]İX\™Y_Kˆ‹ØØ][Û‹š™YŠNÂˆBˆØ]Ú
\œ›ÜŠ^ÂˆÛÛœÛÛKØ\›Š¹á(y¬åynî¹êâú/å9fçºf,¹da¹í :c!;ï&ˆ‹\œ›ÜŠNÂˆB‚ˆÚ[™İË˜Y]™[\İ[™\ŠœÜİ]H‹\Ş[˜Ê
OOÂˆYŠ[İÚ[™Ñ^]
^È™]\›ÈB‚ˆÊˆ˜]]™HÛÛ™š\›H\ÙYÈ›ØÚÈœ›İÜÙ\ˆ\İÜHÚ[H]Ø\ÈÜ[‹‚ˆH”ÈX[ÙÈ\È\Ş[˜Ú›Û›İ\ËÛÈ[[YYX][H™\İÜ™HHİX\™ˆ[H™Y›Ü™H]ØZ][™ÈH^Y\‰ÜÈÚÚXÙKˆ
‹Âˆ]İX\™™\İÜ™YY˜[ÙNÂˆ^Âˆ\İÜKœ\Úİ]JÜœÑ^]İX\™Y_Kˆ‹ØØ][Û‹š™YŠNÂˆİX\™™\İÜ™Y]YNÂˆXØ]Ú
Ê^ÈB‚ˆYŠˆÚ[™İË‘›İ\”Ş[X›ÛÔ™[X\ÙU\]I‰‚ˆ\[ÙˆÚ[™İË‘›İ\”Ş[X›ÛÔ™[X\ÙU\]Kš\Ñ›Ü˜ÙY\]P›ØÚÚ[™ÏOOH™[˜İ[Ûˆ‰‰‚ˆÚ[™İË‘›İ\”Ş[X›ÛÔ™[X\ÙU\]Kš\Ñ›Ü˜ÙY\]P›ØÚÚ[™Ê
Bˆ
^ÂˆÚ[™İË‘›İ\”Ş[X›ÛÔ™[X\ÙU\]K˜[››İ[˜ÙQ›Ü˜ÙYØÚÊ
NÂˆ™]\›ÂˆB‚ˆYŠ^]›Û\Ü[Š^È™]\›ÈBˆ^]›Û\Ü[]YNÂ‚ˆÛÛœİÛÛ™š\›YYBˆ\[ÙˆÚ[™İËœœĞÛÛ™š\›OOOH™[˜İ[Ûˆˆ	‰‚ˆ]ØZ]Ú[™İËœœĞÛÛ™š\›Jˆ¹è®¹k¦º) zfèºe¢ú`b¹¢,¹eã»ï'ùæë¹bcz`,¹n©¹§ ùab:!ê¹båykf9ª¥8à ˆ‹ˆÂˆ]Nˆºfèºe¢ùa¤ºfªˆ‹ˆÛÛ™š\›U^ˆ¹a,¹kf9.)ºfèºe¢È‹ˆØ[˜Ù[^ˆ¹îo9î£9a¤ºfªˆ‚ˆBˆ
NÂ‚ˆ^]›Û\Ü[Y˜[ÙNÂ‚ˆYŠÛÛ™š\›YY
^Âˆ[İÚ[™Ñ^]]YNÂˆØ]™QØ[YJ
NÂˆ\İÜK™ÛÊİX\™™\İÜ™YËL‹LJNÂˆBˆJNÂ‚ŸJJ
NÂ‚‚‹Ê‚ˆ8¦!H9¥¬9h§»ï&¹aj:'¨¹neyb§ú ïxà ‚‚ˆ:aãz) yæ¡9¢ :(dúfd9b-¹ab:*ª¹®!y©f»ï&‚ˆ9à#ú)¯yfj9gî¹¥¯9k¢yaj:  úaãûï#8à#9íeyl#y.#ya`z*,xà#yí¬ºh yg*ˆ9k£9aj9¬¤¹§"y/oùå*: !y.¤¹båyæ¡9 áy¬ày."ú!ê¹båz`,¹aiyaj:'¨¹ne{ï#ˆ9. 9k¦º) yãªyk­º!ê¹mìznç¹. 9."ùåjúgh¹¢cz ïz)î9æo8 %8 %ˆ:`&y¦+ĞÚ›ÛYxà TØY˜\šxà y¢`9§"yà#ú)¯yfj9alz`&¹æ¡:fd9b-»ï#ˆ9.#y¦+ú`&y`"ú`b¹¢,¹`f¹o¥ùb,9¢%¹`f¹.#yb,9æ¡9ecúhc;ï#ˆ9.îù/eyí¬ºh z`b¹¢,º`ïyîg¹.#z`cº`&y. :eç8à ‚‚ˆ:`&z(èy`f¹æ¡9¦+øà#:` : #9¬`¹am¹«(xà#y/a¹§ :h!¹¢bùæ¡9`f¹¬å{ï&‚ˆ9æèú oyãªyk­¹g*9åjúgh¹."¸à#9ë+9. 9«(xà#yæ¡:nç¹¤â¹¢%º)î9£©ûï#ˆ:`¨ù. 9."úh!¹/¯ù. :-mú)î9æo9aj:'¨¹nez*âù¬`»ï#ˆ9ãªyk­¹no¹.c¹¡'ú)®¹.#yb,9i&¹. 9`"ù«izjgÂˆ;ï"9.#yë¨y.åºnç¹æ¡9¦+ùbmz)ä¹åjúgh¹æ¡9£"zb%{ï#ˆ:`¡9¦+ùmì¹§"ykf9ª¥9¦`¹..ùgã¹åjúgh¹æ¡9.îù/eyg,9¥®{ï#ˆ:`ïy§ ú)î9æo;ï#9.bùo£9l,y.#y§ ùa£y¢dù¤ï»ï"xà ‚‚ˆ9i ¹§§9ãªyk­¹æ¡9à#ú)¯yfj9.#y¥+ù£í9aj:'¨¹nePTxà Bˆ9¢%¹à#ú)¯yfj9gî¹¥¯9§ä9.¦ùc§ùfè9¢ä¹íez*âù¬`»ï#ˆ:`&z(èyå*KØØ]Ú9¥m9`"ùc!z-mù/¡»ï#ˆ9i,y¥eù.¡¹l,znæ:næ9¥/¹¨á;ï#9.#y§ ùolzgïú`b¹¢,¹§+:.ªù«hùn.:`bù/g8à ‚Š‹Â‚™[˜İ[Ûˆ™\]Y\İØ[YQ[ØÜ™Y[Š
^Â‚ˆÛÛœİ[BˆØİ[Y[™Øİ[Y[[[Y[Â‚‚ˆÛÛœİ™\]Y\İB‚ˆ[œ™\]Y\İ[ØÜ™Y[Ÿˆ[ÙXšÚ]™\]Y\İ[ØÜ™Y[Ÿˆ[›[Ş”™\]Y\İ[ØÜ™Y[Ÿˆ[›\Ô™\]Y\İ[ØÜ™Y[Â‚‚ˆYŠ\™\]Y\İ
^Âˆ™]\›ÂˆB‚‚ˆ^Â‚ˆÛÛœİ™\İ[Bˆ™\]Y\İ˜Ø[
[
NÂ‚‚ˆYŠˆ™\İ[	‰‚ˆ™\İ[˜Ø]Úˆ
^Â‚ˆ™\İ[˜Ø]Ú


OOßJNÂ‚ˆB‚ˆBˆØ]Ú
\œ›ÜŠ^ßB‚ŸB‚‚™[˜İ[Ûˆ[˜X›Q[ØÜ™Y[“Û‘š\œİ\

^Â‚ˆÛÛœİ[™\J
OOÂ‚ˆ™\]Y\İØ[YQ[ØÜ™Y[Š
NÂ‚ˆNÂ‚‚ˆØİ[Y[˜Y]™[\İ[™\Šˆ˜ÛXÚÈ‹ˆ[™\‹ˆÛÛ˜ÙNY_Bˆ
NÂ‚‚ˆØİ[Y[˜Y]™[\İ[™\ŠˆİXÚİ\‹ˆ[™\‹ˆÛÛ˜ÙNY_Bˆ
NÂ‚ŸB‚‚‹Ê‚ˆ8¦!H9/ë¹«hûï"9/§yáiù/oùå*: !z) y¬`»ï"{ï&‚ˆ9.#z) ya£yo-ùb-¹aj:'¨¹ne{ï#:`&z(èy.#ydo9cêÂˆ[˜X›Q[ØÜ™Y[“Û‘š\œİ\

{ï#ˆ9aïyo#ù§+:.ªù/çyåfz$eûï#9.bùo£9i ¹§§9 ìú) zaãy¥¬9¢dúe¢Âˆ:`&y`"ùb§ú ï{ï#9æí9£©y¢¢¹."úghº`&z(c9cå¹­¢:*.ú)èùclùcëøà ‚Š‹Â‚‹ÊˆŒLˆÈ›İ]]ËY[\ˆœ›İÜÙ\ˆ[ØÜ™Y[ˆÛˆš\œİ\ˆ
‹Â‹Ê‚ˆ8¦!H9§ 9o£9¢cz+ 9cå¹kf9ª¥8à ‚ˆ:`&yª(ùë+9. 9«(yegùbåy. 9k¦¹§ ú`,¹bmz)ä»ï#ˆ9§"ykf9ª¥9baù. 9k¦º`,º`b¹¢,¸à ‚ˆØYØ[Yyaiú`ê9§+:.ªù.gù§"]KØØ]Ú;ï#ˆ:`&z(èya£yc!y. 9li9¦+úfæzaãy/çzfª»ï#ˆ9è®¹/çyá(z*å¹i ¹/ez`ïy.#y§ ùchy«nù¥m9`"ùí¬ºh xà ‚Š‹Â‚‹Ê‚ˆ8¦!H9¥¬9h§»ï"9/§yáiù/oùå*: !z) y¬`»ï"{ï&‚ˆ9¢¢9`"ú!ê¹båy¢,:k)z*+yk¦ºgh¹§oú(èyæ¡9c§ùå'ÏÙ[Xİ‚ˆ9£æù¢$:!êº* ¹`aú`n9e«¸à º`&M9`"ùa`ùí(9g*S:(èBˆ9§+9/¡¹l,ykf9g*;ï"9.#y¦+ù.bùo£9¢cybåy¡bùå(¹å'ùæ¡;ï"{ï#ˆ:`&z(èycëù.éy¥/¹oàùg*:`b¹¢,¹egùbåy¦`¹l,yb'yiâùc%¹. 9«({ï#ˆ9.#yå*9ëbyb,:*+yk¦ºgh¹§oùç'ùæ¡:(ªù¢dúe¢øà ‚Š‹Â‚^Â‚ˆÂˆ˜]]ÔÙ][™ÜĞÚ\˜Xİ\”Ù[Xİ‹ˆ˜]]ÔÙ][™ÜĞXİ[Û”Ù[Xİ‹ˆ˜]]ÔÙ][™ÜÒ‹ˆ˜]]ÔÙ][™ÜÔÔ‚ˆK™›Ü‘XXÚ
ˆÙ[XİYOÂ‚ˆ[š]İ\İÛQ›ÜİÛŠˆÙ[XİYˆ
NÂ‚ˆBˆ
NÂ‚ŸB˜Ø]Ú
\œ›ÜŠ^Â‚ˆÛÛœÛÛK™\œ›ÜŠˆº!êº* ¹."ù¢âz`n9e«¹b'yiâùc%¹i,y¥eûï&ˆ‹ˆ\œ›Ü‚ˆ
NÂ‚ŸB‚‚^Â‚ˆÊ‚ˆ8¦!H9¥¬9h§»ï"9/§yáiù/oùå*: !z) y¬`»ï#8à#9b¨:nçº) Bˆ9¥¬9h§ºemù£"yoêú`'ùb¨:nç¸à#{ï"{ï&‚ˆ:h zghº/"yaiy¦`»ï#9¢¢¹ía9lk9 )ùæ¡
ËËy£"zb%Bˆ9aj:`ê9í y."ºemù£"y£ yî£:)î9æo;ï#9. 9«(y )Âˆ:*+yk¦»ï#9.#yå*9g*9«ãù`"ù£"zb%yæ¡S9."‚ˆ9d!:!ê¹kêù.¢ù.í¸à ‚ˆ
‹Â‚ˆÂˆÈ˜]XÚÈ‹]XÚÈ—KˆÈš][]H‹•š][]H—KˆÈ™[™\™ŞH‹‘[™\™ŞH—KˆÈš[[YÙ[˜ÙH‹’[[YÙ[˜ÙH—KˆÈœÜ\š]‹”Ü\š]—KˆÈ˜YÚ[]H‹YÚ[]H—BˆK™›Ü‘XXÚ

Üİ]Ù^KY\JOOÂ‚ˆ]XÚÛ™Ô™\ÜÊˆ	
œİ]\ĞˆŠÚY\
È“Z[\ÈŠKˆ

OOœ™[[İ™TÚ[
İ]Ù^JBˆ
NÂ‚‚ˆ]XÚÛ™Ô™\ÜÊˆ	
œİ]\ĞˆŠÚY\
È”\ÈŠKˆ

OO˜YÚ[
İ]Ù^JBˆ
NÂ‚ˆJNÂ‚ŸB˜Ø]Ú
\œ›ÜŠ^Â‚ˆÛÛœÛÛK™\œ›ÜŠˆ¹lk9 )ùb¨:nçºemù£"yí yk¦¹i,y¥eûï&ˆ‹ˆ\œ›Ü‚ˆ
NÂ‚ŸB‚‚‹Êˆİ\\İ]SXXÚ[™H\ÈHÛ›HİÛ™\ˆ[İÙYÈÙ[Xİ[™ØY[ˆXØÛİ[Ø]™Kˆ
‹Â‚‚‹Ê‚ˆ8¦!H9.#yë¨ybmz)ä¹¢%º+ 9ª¥9dê¹¨§z-ëùo¤{ï#ˆ9§ 9o£:`ïyegùbåz!ê¹båykf9ª¥8à ‚ˆİ\]]ÔØ]™J
H9aiú`ê9æ¡9k¦¹¦`¹fjˆ9«ãù«(z)î9æo:`ïy§ ú!ê¹mìyª¨¹§éz`b¹¢,¹¦+ùd)¹mì¹í¤úe¢ùiâûï#ˆ9¢`9.éyl,yë¥ú`&y¦`¹`&yãªyk­º`¡9g*9bmz)ä¹åjúgh»ï#ˆ9.gù.#y§ ùaîºc+ù¢%¹kf:`,¹ênº,áù¥¦xà ‚Š‹Â‚^Â‚ˆİ\]]ÔØ]™J
NÂ‚ŸXØ]Ú
\œ›ÜŠ^Â‚ˆÛÛœÛÛK™\œ›ÜŠˆº!ê¹båykf9ª¥9egùbåyi,y¥eûï&ˆ‹ˆ\œ›Ü‚ˆ
NÂ‚ŸB‚‚‹Êˆ[™YÛİ\˜ÙNˆœËÌK\İYÙK]]İXÚ[ØÚËšœÈ
‹ÂŠ[˜İ[ÛŠ
^Âˆ\ÙHİšXİÂ‚ˆÊ‚ˆ
ˆÎ“ÓÕ’Vˆ
‚ˆ
ˆ:""¹âb9å*\™Ù]˜ÛÜÙ\İ
‹‹ŠH9cê¹ç"ùë+9. 9`"ùë)¹d"9a`ùí(8à ‚ˆ
ˆ: ã9c!z(èyë+9. 9`"ùë)¹d"9æ¡9¦+ÈÚ[™[ÜTYÙ{ï#ˆ
ˆ9/a¹ç'ù«hùæ¡ØÜ›ÛİÛ™\ˆ9¦+ùk ù."ºgh¹æ¡˜ÛÛ[8à ‚ˆ
‚ˆ
ˆ:`&z(èy¥.y¢$9. :-ëùo 9ée¹ab:-l;ï#9cêº) yam¹.+y.îù/ey. 9liˆ
ˆ9¦+ùç'ù«hùcëù.éyg ¹æí9¢%¹¬-9nlù£l¹båyæ¡9k®yfj;ï#9l,ya`z*,y¢bùbèº`&º`c¸à ‚ˆ
‹Âˆ[˜İ[Ûˆ\Ò[œÚYP[İÙYØÜ›Û\Š\™Ù]
^ÂˆYŠ]\™Ù]
^Âˆ™]\›ˆ˜[ÙNÂˆB‚ˆÊ‚ˆ8¦!H9/ë¹«hûï"9/§yáiù/oùå*: !yfç¹h,{ï#8à#9aj9lk9 )ù¢ : ïzh$:)¯xà#zh zgh‚ˆ8à#9.#z ïy£l¹bå{ï#9."úgh¹ç"ù.#yb,8à#{ï"{ï&‚ˆ:`&z(èy¦+ùaj9gçùæ¡:)î9£©úc¥»ï#ÙØ[YK\İYÙX:(èy.îù/ez)î9£©ùæë¹ª&Bˆ9cêº) y.#yg*:`&y.ïyæoyd#ye«º)¡º$âùæ¡9cëù£l¹båyk®yfj9aiûï#9. 9o¢Âˆ™]™[Y˜][

X9¤âù£¢yc§ùå'ù£l¹båy¢bùbè¸à ‚ˆœÚÚ[\™]šY]ËX›ÙX;ï"9aj9lk9 )ù¢ : ïzh$:)¯yob9ê¥ùç'ù«hÂˆ9æ¡9£l¹båyk®yfj;ï"yo§¹. :e¢ùiâùl,y¬¤¹§"z(ªùb¨:`,º`&y.ïyæoyd#ye«»ï#ˆ9ê"ùo#ùc%º*+yk¦˜ØÜ›ÛÜ9ç"ú-mù/¡¹«hùn.8à y/a¹¢bù£!ùç'ùæ¡9®äybåBˆ9¦`»ï"9ç'ù«hù§ ùí¤ú`cİXÚ[İ™y.¢ù.í»ï"yk£9aj:(ªú`&z(èy¤âù£¢{ï#ˆ:`&y¦+ùc§ù§+9l,ykf9g*9æ¡Yûï#9cê¹¦+ùaiùk®ykeùí&º+¢¹i)øà yç'ùæ¡:g :) Bˆ9£l¹båy¢cy§ ùç"ùb,9aiùk®y.bùo£9¢cy§ ú(ªú.*yb,8 %8 %9.bùbcykeùí&¹l#øà Bˆ9aiùk®ybfùioyhg¹o¥ú`,šY]ÜÜ;ï#9o§¹/¡¹¬¤¹ç'ùæ¡:g :) y£l¹båz`c¸à ‚‚ˆŒMÌËHÚÜœ˜[YHİš^;ï&¹ea¹n¥ù¥.y¢$9fî¹k¦ˆ\™ÙH[™[9o£;ï#ˆ9ç'ù«hùæ¡9aiùk®HØÜ›ÛİÛ™\ˆ9¦+ÈÚÛYQ™X]\™S[Ù[›Ùxà ‚ˆ9i%¹¨aˆšÛYKY™X]\™K[[Ù[X›Ş9cêº,¨:,«9fî¹k¦¹l.¹kî9.%İ™\™›İÎšY[»ï#ˆ9fè9«i9.#z ïy.èù¦ïùaiúh z`&º`cº)î9£©úc¥»ï&ù¢¢¹ç'ù«hÈØÜ›ÛİÛ™\ˆ9í#yaiBˆ9d#9. 9.ïy«"¹j yæoyd#ye«»ï#:`oùacya£y«(yaî¹ãï¸à#9ç"ùo¥ùb,ØÜ›Û˜\¸à Bˆ9/a¹¢bù£!ù®äy.#ybåxà#yæ¡9`aù£l¹båyâà9¡bøà ‚‚ˆ9d"9¢$:(çy`¦z`n9¤áùb%ù¦+ù¬-9nlÈØÜ›ÛİÛ™\¸à º""¹b)9¥­ùcê¹£©ycåÂˆİ™\™›İË^{ï#9fè9«i9clù/oùåjúgh¹mì¹aî¹ãï¹ªjùd$HØÜ›Û˜\»ï#9¢bù£!ùmé¹cìÂˆ9®äy.ãy§ ú(ªùaj9gçÈİXÚØÚÈ:f.ù¤âøà ¹ãï¹g*9d#9. 9.ïy«"¹j yb)9¥­ùd#9¦`‚ˆ9£©ycåùç'ù«hùcëù£l¹båyæ¡ÖH:.î;ï#:`oùacya£yà®¹e«¹. :h zgh¹cé¹`f¹.¢ù.íº(ç9. xà ‚‚ˆ:)äº"lº*lùí,: ïyb¦ú)¥¹ê¥ùæ¡9ç'ù«hÈØÜ›ÛİÛ™\ˆ9¦+Âˆš[™[ÜKXÚ\˜Xİ\‹Y]Z[YÜšY;ï&ùi%¹¨a‚ˆš[™[ÜKXÚ\˜Xİ\‹Y]Z[X›Ş9§+:.ªù¦+Èİ™\™›İÎšY[»ï#ˆ9.#z ïy¦ïùaiùk®yc`:`&º`cº)î9£©úc¥¸à ¹¢¢¹ç'ù«hùaiùk®yli9b¨9aiyd#9. 9æoyd#ye«¸à ‚‚ˆ9íí9b§ùc`9g,9c`:,áú*"¹¥-¹¥ ¹¢$YY][H[Ù[9o£;ï#9ç'ù«hÈØÜ›ÛİÛ™\‚ˆ9¥.yà®ˆİ˜Z[š[™Ö›Û™S[Ù[›Ù{ï&ùi%¹¨a¹cêº,¨:,«9fî¹k¦¹l.¹kî8à ‚‚ˆ9âà9¡bûï#ú ïyb¦ú*ª¹¦#¹¥-¹¥ ¹¢$YY][H[Ù[9o£;ï#9ç'ù«hÈØÜ›ÛİÛ™\‚ˆ9¦+ÈÜİ]\Ò[[Ù[9aiùæ¡š][K\İ][\İ;ï&ùi%¹¨aº"!ú/å9fçºcmyfî¹k¦¸à ‚‚ˆŒMÍ;ï&¹éæ9kíºh yæ¡9g ¹æíØÜ›ÛİÛ™\ˆ9¦+ÂˆÚÛYQ™X]\™S[Ù[X[K\™[XË[[ÙHÚÛYQ™X]\™S[Ù[›Ù{ï#9b!ºhg¹b%ÂˆX[K\™[XË]XœÈ9baù¦+ù¬-9nlÈØÜ›ÛİÛ™\¸à ¹ajz !z`ïyoázh":`&º`cº`&y`"Âˆ9aj9gçú)î9£©úc¥»ï&ùd)¹baù¢bùbè¹o§¹b!ºhg¹b%ù¢%¹éæ9kí¹aiùk®z-mùiâù¦`¹§ ú(ªÂˆ™]™[Y˜][

{ï#:`(9¢$8à#9§"y¦`º ïy®äxà y§"y¦`¹.#z ïy®äxà#yæ¡:(çyïk¹më¹ål8à ‚‚ˆš\™X˜\ÙH9n,ú&gú)¥¹ê¥ù/oùå*9ãj9êâù¥¯Ø[YHİYÙH9æ¡™\ÜÛœÚ]™HšY]ÜÜˆİ™\›^{ï#9ç'ù«hùæ¡9g ¹æíØÜ›ÛİÛ™\ˆ9¦+È™š\™X˜\ÙKX]]YX[Ùûï&Âˆ9d#9ª(ùcê¹g*:`&y.ïyaj9gçùæoyd#ye«¹ænú*&9. 9«({ï#9.#yà®¹ænùaizh ycé¹b¨İXÚ[İ™H:(ç9. xà ‚ˆ
‹ÂˆÛÛœİ[İÙYÙ[XİÜˆBˆ‹˜ÛÛ[˜ÛÛ[\ØÜ›ÛX›K˜Ü™X][Û‹\YÙK\ØÜ›Û˜Ü™X][Û‹\›ÛKXØ\™š[™[ÜKYÜšY\ØÜ›Ûœ]Y\İ]X‹X›ÙK˜˜]KZ][K[\İˆ
Âˆ‹˜Ú\˜Xİ\•XÛÛ[ØÚ\˜Xİ\•XÛÛ[Ú[™[ÜTYÙKˆ
Âˆ‹˜Y™[\™K]šY]Ëˆ
Âˆ‹šÛYKY™X]\™K[[Ù[X›ŞÚÛYQ™X]\™S[Ù[›ÙKÚÛYQ™X]\™S[Ù[X[K\™[XË[[ÙHÚÛYQ™X]\™S[Ù[›ÙKX[K\™[XË]XœËŒMK\Ş[\Ú\ËX›ÙKİ˜Z[š[™Ö›Û™S[Ù[›ÙK˜]]Ë\Ù][™ÜËY^[™Yˆ
Âˆ‹š[™[ÜKXÚ\˜Xİ\‹Y]Z[X›Şš[™[ÜKXÚ\˜Xİ\‹Y]Z[YÜšYš][K[[Ù[X›ŞÚ][S[Ù[İ]ËÜÚÚ[]Z[İ]Ëˆ
ÂˆˆÜİ]\Ò[[Ù[š][K\İ][\İœÚÚ[\™]šY]ËX›ÙK˜Ü™X][Û‹\ÚÚ[Y]Z[[]™[ËÙ[™Ù[Û•XÛÛ[™Ø[Y\^K\[™[\ØÜ›ÛŒMÌÍ‹XX\ÜËX˜]K[ÙËŒMËZ][K\XÚÙ\‹ŒMÌÍN\™Y›Ü™ÙK]Y\œËŒMÌÍŒËYØ[YK\Ù[Xİ[Y[KŒMÌÍLKXÛÛ\\™K\İ]Ë™š\™X˜\ÙKX]]YX[ÙËˆ
Âˆ^\™XKÙ[Xİ[œ]Â‚ˆ]›ÙHBˆ\™Ù]››ÙU\OOOLBˆÈ\™Ù]ˆˆ\™Ù]œ\™[[[Y[Â‚ˆÚ[J›ÙH	‰ˆ›ÙHOOYØİ[Y[™Øİ[Y[[[Y[
^Â‚ˆYŠˆ›ÙK›X]Ú\È	‰‚ˆ›ÙK›X]Ú\Ê[İÙYÙ[XİÜŠBˆ
^ÂˆÛÛœİİ[HBˆÚ[™İË™Ù]ÛÛ\]Yİ[J›ÙJNÂ‚ˆÛÛœİØ[”ØÜ›ÛHBˆ
ˆİ[K›İ™\™›İÖOOOH˜]]Èˆˆİ[K›İ™\™›İÖOOOHœØÜ›Û‚ˆ
H	‰‚ˆ›ÙKœØÜ›ÛZYÚ‚ˆ›ÙK˜ÛY[ZYÚ
ÈNÂ‚ˆÛÛœİØ[”ØÜ›ÛBˆ
ˆİ[K›İ™\™›İÖOOH˜]]Èˆˆİ[K›İ™\™›İÖOOHœØÜ›Û‚ˆ
H	‰‚ˆ›ÙKœØÜ›ÛÚY‚ˆ›ÙK˜ÛY[ÚY
ÈNÂ‚ˆYŠØ[”ØÜ›ÛHØ[”ØÜ›Û
^Âˆ™]\›ˆYNÂˆBˆB‚ˆ›ÙO[›ÙKœ\™[[[Y[ÂˆB‚ˆ™]\›ˆ˜[ÙNÂˆB‚ˆØİ[Y[˜Y]™[\İ[™\ŠˆİXÚ[İ™H‹ˆ[˜İ[ÛŠ]™[
^ÂˆÛÛœİØ[YTİ\™˜XÙHBˆ]™[\™Ù]	‰‚ˆ]™[\™Ù]˜ÛÜÙ\İ	‰‚ˆ]™[\™Ù]˜ÛÜÙ\İ
ˆÙØ[YK\İYÙHŠNÂ‚ˆYŠˆØ[YTİ\™˜XÙH	‰‚ˆ]™[İXÚ\È	‰‚ˆ]™[İXÚ\Ë›[™İŒBˆ
^Âˆ]™[œ™]™[Y˜][

NÂˆ™]\›ÂˆB‚ˆYŠˆØ[YTİ\™˜XÙH	‰‚ˆZ\Ò[œÚYP[İÙYØÜ›Û\Šˆ]™[\™Ù]ˆ
Bˆ
^Âˆ]™[œ™]™[Y˜][

NÂˆBˆKˆÜ\ÜÚ]™N™˜[Ù_Bˆ
NÂ‚ˆØİ[Y[˜Y]™[\İ[™\ŠˆœÚ[\›[İ™H‹ˆ[˜İ[ÛŠ]™[
^ÂˆYŠˆ]™[œÚ[\•\OOOHİXÚˆ	‰‚ˆ]™[\™Ù]	‰‚ˆ]™[\™Ù]˜ÛÜÙ\İ	‰‚ˆ]™[\™Ù]˜ÛÜÙ\İ
ˆÙØ[YK\İYÙHŠH	‰‚ˆZ\Ò[œÚYP[İÙYØÜ›Û\Šˆ]™[\™Ù]ˆ
Bˆ
^Âˆ]™[œ™]™[Y˜][

NÂˆBˆKˆÜ\ÜÚ]™N™˜[Ù_Bˆ
NÂ‚ˆÊ‚ˆ9aj:`b¹¢,¹à#ú)¯yfj9c§ùå'ù.¤¹båzc¥»ï&‚ˆH9e«¹£!ù.ãy/§y¥è¹§"HØÜ›ÛÚ][\İ9«hùn.9£l¹båxà ‚ˆH9ajy£!ù.éy."¹¬.:`h9.#y.©9íi¹à#ú)¯yfj9`fˆ[˜Ú›ÛÛxà ‚ˆH:gg¹¥¡ùkeú/.9aiHRH9.#ze¢ùegúemù£"HÛÛ^Y[xà y.#yc§ùå'ù¢å¹¦ìøà y.#y¥¡ùkeú`n9cå¸à ‚ˆ:`&y¦+ùaj9gçÈİÛ™\»ï#9é y«h¹d!:h ycé¹å¢ºemù£"{ï#ùî+¹¥/º(ç9. xà ‚ˆ
‹Âˆ[˜İ[Ûˆ\ÑØ[YTİ\™˜XÙU\™Ù]
\™Ù]
^Âˆ™]\›ˆHJˆ\™Ù]	‰‚ˆ\™Ù]˜ÛÜÙ\İ	‰‚ˆ\™Ù]˜ÛÜÙ\İ
ˆÙØ[YK\İYÙHŠBˆ
NÂˆB‚ˆ[˜İ[Ûˆ\ÑY]X›QØ[YPÛÛ›Û
\™Ù]
^Âˆ™]\›ˆHJˆ\™Ù]	‰‚ˆ\™Ù]˜ÛÜÙ\İ	‰‚ˆ\™Ù]˜ÛÜÙ\İ
	Ú[œ]^\™XKØÛÛ[Y]X›OHYH—IÊBˆ
NÂˆB‚‚ˆØİ[Y[˜Y]™[\İ[™\Šˆ˜ÛÛ^Y[H‹ˆ[˜İ[ÛŠ]™[
^ÂˆYŠˆ\ÑØ[YTİ\™˜XÙU\™Ù]
]™[\™Ù]
H	‰‚ˆZ\ÑY]X›QØ[YPÛÛ›Û
]™[\™Ù]
Bˆ
^Âˆ]™[œ™]™[Y˜][

NÂˆBˆKˆØØ\\™NY_Bˆ
NÂ‚ˆØİ[Y[˜Y]™[\İ[™\Šˆ™˜YÜİ\‹ˆ[˜İ[ÛŠ]™[
^ÂˆYŠˆ\ÑØ[YTİ\™˜XÙU\™Ù]
]™[\™Ù]
H	‰‚ˆZ\ÑY]X›QØ[YPÛÛ›Û
]™[\™Ù]
Bˆ
^Âˆ]™[œ™]™[Y˜][

NÂˆBˆKˆØØ\\™NY_Bˆ
NÂ‚ˆØİ[Y[˜Y]™[\İ[™\ŠˆœÙ[Xİİ\‹ˆ[˜İ[ÛŠ]™[
^ÂˆYŠˆ\ÑØ[YTİ\™˜XÙU\™Ù]
]™[\™Ù]
H	‰‚ˆZ\ÑY]X›QØ[YPÛÛ›Û
]™[\™Ù]
Bˆ
^Âˆ]™[œ™]™[Y˜][

NÂˆBˆKˆØØ\\™NY_Bˆ
NÂ‚ˆØİ[Y[˜Y]™[\İ[™\ŠˆÚY[‹ˆ[˜İ[ÛŠ]™[
^ÂˆYŠˆ]™[˜İ›Ù^H	‰‚ˆ\ÑØ[YTİ\™˜XÙU\™Ù]
]™[\™Ù]
Bˆ
^Âˆ]™[œ™]™[Y˜][

NÂˆBˆKˆØØ\\™NYK\ÜÚ]™N™˜[Ù_Bˆ
NÂ‚ˆÚ[™İË˜Y]™[\İ[™\Šˆ™Ù\İ\™\İ\‹ˆ[˜İ[ÛŠ]™[
^ÂˆYŠˆ]™[\™Ù]	‰‚ˆ]™[\™Ù]˜ÛÜÙ\İ	‰‚ˆ]™[\™Ù]˜ÛÜÙ\İ
ˆÙØ[YK\İYÙHŠBˆ
^Âˆ]™[œ™]™[Y˜][

NÂˆBˆKˆÜ\ÜÚ]™N™˜[Ù_Bˆ
NÂ‚ˆÚ[™İË˜Y]™[\İ[™\Šˆ™Ù\İ\™XÚ[™ÙH‹ˆ[˜İ[ÛŠ]™[
^ÂˆYŠˆ]™[\™Ù]	‰‚ˆ]™[\™Ù]˜ÛÜÙ\İ	‰‚ˆ]™[\™Ù]˜ÛÜÙ\İ
ˆÙØ[YK\İYÙHŠBˆ
^Âˆ]™[œ™]™[Y˜][

NÂˆBˆKˆÜ\ÜÚ]™N™˜[Ù_Bˆ
NÂ‚ˆÚ[™İËš\Ò[œÚYP[İÙYØÜ›Û\•ÎBˆ\Ò[œÚYP[İÙYØÜ›Û\ÂŸJJ
NÂ‚‚‹Êˆ[™YÛİ\˜ÙNˆœËÌ‹\İYÙK]K[˜]]™KXÛÛÜ™[˜]KX\KšœÈ
‹Â‹ÊˆOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOBˆH8 %UU‘HL0åÌNLŒÓÓÔ‘SUHTB‚ˆ™]È™X]\™\ÈUTÕ\ÙH\ÙH[\œÈ[œİXYÙˆœ›İÜÙ\‚ˆšY]ÜÜÛÛÜ™[˜]\Ë‚‚ˆ^\İ[™ÈØ[YHÙÚXÈ\È[[[Û˜[H[İXÚY‚OOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOH
‹ÂŠ[˜İ[Ûˆ[œİ[˜]]™QØ[YPÛÛÜ™[˜]PTJ
^ÂˆÛÛœİĞSQWÕÈHLÂˆÛÛœİĞSQWÒHNLŒÂ‚ˆ[˜İ[ÛˆÙ]İYÙJ
^Âˆ™]\›ˆØİ[Y[™Ù][[Y[RY
™Ø[YK\İYÙHŠNÂˆB‚ˆ[˜İ[ÛˆÙ]İ™\›^J
^Âˆ™]\›ˆØİ[Y[™Ù][[Y[RY
™Ø[YK[İ™\›^K[^Y\ˆŠNÂˆB‚ˆ[˜İ[ÛˆØÜ™Y[•ÑØ[YJÛY[ÛY[J^ÂˆÛÛœİİYÙHHÙ]İYÙJ
NÂˆYŠ\İYÙJ^Âˆ™]\›ˆŞˆÛY[NˆÛY[_NÂˆB‚ˆÛÛœİ™XİHİYÙK™Ù]›İ[™[™ĞÛY[™Xİ

NÂˆÛÛœİØØ[HHÚ[™İË™Ø[YTİYÙTØØ[HNÂ‚ˆ™]\›ˆÂˆˆ
ÛY[H™Xİ›Y
HÈØØ[KˆNˆ
ÛY[HH™XİÜ
HÈØØ[BˆNÂˆB‚ˆ[˜İ[ÛˆØ[YUÔØÜ™Y[ŠJ^ÂˆÛÛœİİYÙHHÙ]İYÙJ
NÂˆYŠ\İYÙJ^Âˆ™]\›ˆŞ_NÂˆB‚ˆÛÛœİ™XİHİYÙK™Ù]›İ[™[™ĞÛY[™Xİ

NÂ‚ˆ™]\›ˆÂˆˆ™Xİ›Y
È
ˆ
™XİÚYÈĞSQWÕÊKˆNˆ™XİÜ
ÈH
ˆ
™XİšZYÚÈĞSQWÒ
BˆNÂˆB‚ˆ[˜İ[Ûˆ]™[ÑØ[YJ]™[
^ÂˆÛÛœİÚ[H]™[İXÚ\È	‰ˆ]™[İXÚ\Ë›[™İˆÈ]™[İXÚ\ÖÌBˆˆ]™[˜Ú[™ÙYİXÚ\È	‰ˆ]™[˜Ú[™ÙYİXÚ\Ë›[™İˆÈ]™[˜Ú[™ÙYİXÚ\ÖÌBˆˆ]™[Â‚ˆ™]\›ˆØÜ™Y[•ÑØ[YJÚ[˜ÛY[Ú[˜ÛY[JNÂˆB‚ˆ[˜İ[ÛˆÜ™X]S˜]]™Q[[Y[
Û\ÜÓ˜[YJ^ÂˆÛÛœİİ™\›^HHÙ]İ™\›^J
NÂˆYŠ[İ™\›^J^Âˆ™]\›ˆ[ÂˆB‚ˆÛÛœİ[HØİ[Y[˜Ü™X]Q[[Y[
™]ˆŠNÂˆ[˜Û\ÜÓ˜[YHH™Ø[YK[˜]]™KY[[Y[ˆ
È
Û\ÜÓ˜[YHˆŠNÂˆİ™\›^K˜\[™Ú[
[
NÂˆ™]\›ˆ[ÂˆB‚ˆ[˜İ[ÛˆÙ]˜]]™T™Xİ
[KÚYZYÚ
^ÂˆYŠY[
H™]\›Â‚ˆ[œİ[KœÜÚ][ÛˆH˜XœÛÛ]HÂˆ[œİ[K›YH
ÈœÂˆ[œİ[KÜHH
ÈœÂˆ[œİ[KÚYHÚY
ÈœÂˆ[œİ[KšZYÚHZYÚ
ÈœÂˆB‚ˆ[˜İ[ÛˆÙ]˜]]™TÜÚ][ÛŠ[J^ÂˆYŠY[
H™]\›Â‚ˆ[œİ[KœÜÚ][ÛˆH˜XœÛÛ]HÂˆ[œİ[K›YH
ÈœÂˆ[œİ[KÜHH
ÈœÂˆB‚ˆÚ[™İË‘ĞSQWÓUU‘WÕÒQHĞSQWÕÎÂˆÚ[™İË‘ĞSQWÓUU‘WÒRQÒHĞSQWÒÂ‚ˆÚ[™İËœØÜ™Y[•ÑØ[YHHØÜ™Y[•ÑØ[YNÂˆÚ[™İË™Ø[YUÔØÜ™Y[ˆHØ[YUÔØÜ™Y[ÂˆÚ[™İË™]™[ÑØ[YHH]™[ÑØ[YNÂˆÚ[™İË˜Ü™X]S˜]]™QØ[YQ[[Y[HÜ™X]S˜]]™Q[[Y[ÂˆÚ[™İËœÙ]˜]]™QØ[YT™XİHÙ]˜]]™T™XİÂˆÚ[™İËœÙ]˜]]™QØ[YTÜÚ][ÛˆHÙ]˜]]™TÜÚ][ÛÂŸJJ
NÂ‚‚‹Êˆ[™YÛİ\˜ÙNˆœËÌË\İYÙK]ŒLX˜]K[ÙË\ØÜ›Û\[[YKšœÈ
‹ÂŠ[˜İ[ÛŠ
^Âˆ\ÙHİšXİÂ‚ˆ[˜İ[Ûˆš[™ØÜ›ÛX›P˜]T[™[
\™Ù]
^ÂˆYŠ]\™Ù]]\™Ù]˜ÛÜÙ\İ
H™]\›ˆ[Â‚ˆ™]\›ˆ\™Ù]˜ÛÜÙ\İ
ˆ	ÖÙ]KX˜]K[ÙË\ØÜ›ÛK	È
Âˆ	Ë˜˜]K[ÙË\ØÜ›ÛX›K	È
Âˆ	Ë˜˜]K[ÙË	È
Âˆ	Ë˜˜]KZ[™›Ë	È
Âˆ	Ë˜˜]KZ[™›ËX›Ş	È
Âˆ	Ë˜˜]K[ÙËX›Ş	È
Âˆ	Ë˜˜]K[ÙËXÛÛZ[™\‹	È
Âˆ	Ë˜ÛÛX˜][ÙË	È
Âˆ	Ë˜ÛÛX˜][ÙËX›Ş	È
Âˆ	Ë˜˜]K]^	È
Âˆ	Ë˜˜]K[Y\ÜØYÙK[\İ	Âˆ
NÂˆB‚ˆ[˜İ[ÛˆØ[”ØÜ›Û™\XØ[J[
^ÂˆYŠY[
H™]\›ˆ˜[ÙNÂ‚ˆÛÛœİİ[HHÚ[™İË™Ù]ÛÛ\]Yİ[J[
NÂˆÛÛœİİ™\™›İÖHHİ[K›İ™\™›İÖNÂ‚ˆ™]\›ˆ
ˆ
İ™\™›İÖHOOH˜]]Èˆİ™\™›İÖHOOHœØÜ›ÛŠH	‰‚ˆ[œØÜ›ÛZYÚˆ[˜ÛY[ZYÚ
ÈBˆ
NÂˆB‚ˆÊ‚ˆ
ˆX\šÈHXİX[ØÜ›ÛX›H˜]HÙÈÛÈH^\İ[™ÈÛØ˜[ˆ
ˆİXÚØÚÈØ[ˆ™XÛÙÛš^™H]‚ˆ
‹Âˆ[˜İ[ÛˆX\šĞ˜]TØÜ›Û\œÊ
^ÂˆÛÛœİÙ[XİÜœÈHÂˆ	ÖØÛ\ÜÊH˜˜]H—VØÛ\ÜÊH›ÙÈ—IËˆ	ÖØÛ\ÜÊH˜˜]H—VØÛ\ÜÊHš[™›È—IËˆ	ÖØÛ\ÜÊH˜ÛÛX˜]—VØÛ\ÜÊH›ÙÈ—IËˆ	ÖÚY
H˜˜]H—VÚY
H›ÙÈ—IËˆ	ÖÚY
H˜˜]H—VÚY
Hš[™›È—IËˆ	ÖÚY
H˜ÛÛX˜]—VÚY
H›ÙÈ—IÂˆNÂ‚ˆØİ[Y[œ]Y\TÙ[XİÜ[
Ù[XİÜœËš›Ú[Š‹ŠJK™›Ü‘XXÚ
[˜İ[ÛŠ[
^Âˆ[œÙ]]šX]J™]KX˜]K[ÙË\ØÜ›Û‹YHŠNÂˆ[œİ[KİXÚXİ[ÛˆHœ[‹^HÂˆJNÂˆB‚ˆÊ‚ˆ
ˆHØ\\™K\\ÙH\İ[™\ˆ[œÈ™Y›Ü™HHÛÛØ˜[İXÚØÚË‚ˆ
ˆ›ÜˆHXİX[˜]HÙË[İÈHœ›İÜÙ\‰ÜÈ™\XØ[ØÜ›Û‚ˆ
ˆ›Üˆ]™\][™È[ÙKH^\İ[™ÈØ[YK]ÚYHØÚÈ™[XZ[œÈ[˜Ú[™ÙY‚ˆ
‹ÂˆØİ[Y[˜Y]™[\İ[™\ŠİXÚ[İ™H‹[˜İ[ÛŠ]™[
^ÂˆÛÛœİØÜ›Û\ˆHš[™ØÜ›ÛX›P˜]T[™[
]™[\™Ù]
NÂ‚ˆYŠØÜ›Û\ˆ	‰ˆØ[”ØÜ›Û™\XØ[JØÜ›Û\ŠJ^Âˆ]™[œİÜ[[YYX]T›ÜYØ][ÛŠ
NÂˆ™]\›ÂˆBˆKØØ\\™NYK\ÜÚ]™N™˜[Ù_JNÂ‚ˆØİ[Y[˜Y]™[\İ[™\ŠœÚ[\›[İ™H‹[˜İ[ÛŠ]™[
^ÂˆYŠ]™[œÚ[\•\HOOHİXÚŠH™]\›Â‚ˆÛÛœİØÜ›Û\ˆHš[™ØÜ›ÛX›P˜]T[™[
]™[\™Ù]
NÂ‚ˆYŠØÜ›Û\ˆ	‰ˆØ[”ØÜ›Û™\XØ[JØÜ›Û\ŠJ^Âˆ]™[œİÜ[[YYX]T›ÜYØ][ÛŠ
NÂˆ™]\›ÂˆBˆKØØ\\™NYK\ÜÚ]™N™˜[Ù_JNÂ‚ˆX\šĞ˜]TØÜ›Û\œÊ
NÂ‚ˆÚ[™İË˜Y]™[\İ[™\Šœ™\Ú^™H‹X\šĞ˜]TØÜ›Û\œËÜ\ÜÚ]™NY_JNÂŸJJ
NÂ‚‚‹Êˆ[™YÛİ\˜ÙNˆœËÌ\İYÙK]ŒLK[˜]]™KX›İÛK[˜]‹\[[YKšœÈ
‹ÂŠ[˜İ[ÛŠ
^Âˆ\ÙHİšXİÂ‚ˆÊ‚ˆ
ˆÛÛ™\H^\İ[™È›İÛH˜]šYØ][Ûˆ[ÈH˜]]™KXÛÛÜ™[˜]Bˆ
ˆİ™\›^HÚ]İ]Ú[™Ú[™È]ÈÛXÚÈ[™\œÈÜˆØ[YHÙÚXË‚ˆ
‚ˆ
ˆÙHÛÛ™H›È]ÛœÈ[™È›İ™\XÙH^\İ[™È]™[\İ[™\œË‚ˆ
ˆHÜšYÚ[˜[˜]ˆ\È[İ™Y[ÈH˜]]™Hİ™\›^H^Y\‹‚ˆ
‹Âˆ[˜İ[ÛˆZYÜ˜]P›İÛS˜]Š
^ÂˆÛÛœİİ™\›^HHØİ[Y[™Ù][[Y[RY
™Ø[YK[İ™\›^K[^Y\ˆŠNÂˆYŠ[İ™\›^JH™]\›Â‚ˆÛÛœİØ[™Y]\ÈHÂˆØİ[Y[™Ù][[Y[RY
˜›İÛS˜]ˆŠKˆØİ[Y[™Ù][[Y[RY
›X\YÙS˜]ˆŠKˆØİ[Y[œ]Y\TÙ[XİÜŠˆÙØ[YKXÛÛ[˜›İÛK[˜]ˆŠBˆK™š[\Š›ÛÛX[ŠNÂ‚ˆØ[™Y]\Ë™›Ü‘XXÚ
[˜İ[ÛŠ˜]Š^ÂˆYŠ[˜]ˆ˜]‹™]\Ù]›˜]]™UŒLHOOHYHŠH™]\›Â‚ˆÊ‚ˆ
ˆÛ›HZYÜ˜]H˜]ˆ[[Y[È]\™HXİX[Ø[YH˜]šYØ][Û‹‚ˆ
ˆÈ›İİXÚ[œ™[]Yš^YÛÛ›ÛË‚ˆ
‹ÂˆÛÛœİ\Ğ›İÛS˜]ˆBˆ˜]‹šYOOH˜›İÛS˜]ˆˆˆ˜]‹šYOOH›X\YÙS˜]ˆˆˆ˜]‹˜Û\ÜÓ\İ˜ÛÛZ[œÊ˜›İÛK[˜]ˆŠNÂ‚ˆYŠZ\Ğ›İÛS˜]ŠH™]\›Â‚ˆÛÛœİÜ˜\\ˆHØİ[Y[˜Ü™X]Q[[Y[
™]ˆŠNÂˆÜ˜\\‹˜Û\ÜÓ˜[YHH›˜]]™KX›İÛK[˜]‹[^Y\ˆÂˆÜ˜\\‹™]\Ù]›˜]]™UŒLHHYHÂ‚ˆÛÛœİ˜]]™S˜]ˆHØİ[Y[˜Ü™X]Q[[Y[
™]ˆŠNÂˆ˜]]™S˜]‹˜Û\ÜÓ˜[YHH›˜]]™KX›İÛK[˜]ˆÂˆ˜]]™S˜]‹™]\Ù]›˜]]™UŒLHHYHÂ‚ˆÊ‚ˆ
ˆ[İ™HH^\İ[™È[[Y[™\Ù\š[™È]È^\İ[™ÈÓKˆ
ˆÚ[™[‹QË[™]™[\İ[™\œË‚ˆ
‹Âˆ˜]‹œ\™[›ÙKš[œÙ\™Y›Ü™JÜ˜\\‹˜]ŠNÂˆÜ˜\\‹˜\[™Ú[
˜]]™S˜]ŠNÂˆ˜]]™S˜]‹˜\[™Ú[
˜]ŠNÂ‚ˆÊ‚ˆ
ˆ™[[İ™HYØXŞHšY]ÜÜÜÚ][Ûš[™Èœ›ÛHH[İ™Y[[Y[‚ˆ
ˆ]Èš\İX[Ú^™H\È™\Ù\™YHH^\İ[™ÈÚ[İ[\Ë‚ˆ
‹Âˆ˜]‹œİ[KœÜÚ][ÛˆHœ™[]]™HÂˆ˜]‹œİ[K›YH˜]]ÈÂˆ˜]‹œİ[KœšYÚH˜]]ÈÂˆ˜]‹œİ[KÜH˜]]ÈÂˆ˜]‹œİ[K˜›İÛHH˜]]ÈÂˆ˜]‹œİ[K˜[œÙ›Ü›HH››Û™HÂˆ˜]‹œİ[K›X\™Ú[“YHŒÂˆ˜]‹œİ[K›X\™Ú[”šYÚHŒÂˆ˜]‹œİ[KÚYHŒL	HÂ‚ˆ˜]‹™]\Ù]›˜]]™UŒLHHYHÂˆJNÂˆB‚ˆÊ‚ˆ
ˆ[ˆY\ˆ^\İ[™È[š]X[^˜][Ûˆ[™Y\ˆÓHÚ[™Ù\Ë‚ˆ
ˆ\È\ÈZYÜ˜][Û‹[Û›NÈ]Ù\È›İ[\ˆØ[YHYXÚ[šXÜË‚ˆ
‹ÂˆYŠØİ[Y[œ™XYTİ]HOOH›ØY[™ÈŠ^ÂˆØİ[Y[˜Y]™[\İ[™\Š‘ÓPÛÛ[ØYY‹ZYÜ˜]P›İÛS˜]‹ÛÛ˜ÙNY_JNÂˆY[Ù^ÂˆZYÜ˜]P›İÛS˜]Š
NÂˆB‚ˆÚ[™İË›ZYÜ˜]P›İÛS˜]•Ó˜]]™LLHZYÜ˜]P›İÛS˜]ÂŸJJ
NÂ‚‚‹Êˆ[™YÛİ\˜ÙNˆœËÌK\İYÙK]ŒLË[˜]]™K[X\[˜]‹\[[YKšœÈ
‹ÂŠ[˜İ[ÛŠ
^Âˆ\ÙHİšXİÂ‚ˆ[˜İ[ÛˆZYÜ˜]SX\˜]Š
^ÂˆÛÛœİİ™\›^HHØİ[Y[™Ù][[Y[RY
™Ø[YK[İ™\›^K[^Y\ˆŠNÂˆYŠ[İ™\›^JH™]\›Â‚ˆÛÛœİ˜]ˆHØİ[Y[™Ù][[Y[RY
›X\YÙS˜]ˆŠNÂˆYŠ[˜]ˆ˜]‹™]\Ù]›˜]]™UŒLÈOOHYHŠH™]\›Â‚ˆÊ‚ˆ
ˆÛ›HZYÜ˜]HHX\İ˜Z[š[™È˜]šYØ][Û‹‚ˆ
ˆ^\İ[™ÈÓKÚ[™[‹QÈ[™]™[\İ[™\œÈ\™H™\Ù\™Y‚ˆ
‹ÂˆÛÛœİÜ˜\\ˆHØİ[Y[˜Ü™X]Q[[Y[
™]ˆŠNÂˆÜ˜\\‹˜Û\ÜÓ˜[YHH›˜]]™K[X\[˜]‹[^Y\ˆÂˆÜ˜\\‹™]\Ù]›˜]]™UŒLÈHYHÂ‚ˆÛÛœİ˜]]™S˜]ˆHØİ[Y[˜Ü™X]Q[[Y[
™]ˆŠNÂˆ˜]]™S˜]‹˜Û\ÜÓ˜[YHH›˜]]™K[X\[˜]ˆÂˆ˜]]™S˜]‹™]\Ù]›˜]]™UŒLÈHYHÂ‚ˆ˜]‹œ\™[›ÙKš[œÙ\™Y›Ü™JÜ˜\\‹˜]ŠNÂˆÜ˜\\‹˜\[™Ú[
˜]]™S˜]ŠNÂˆ˜]]™S˜]‹˜\[™Ú[
˜]ŠNÂ‚ˆ˜]‹œİ[KœÜÚ][ÛˆHœ™[]]™HÂˆ˜]‹œİ[K›YH˜]]ÈÂˆ˜]‹œİ[KœšYÚH˜]]ÈÂˆ˜]‹œİ[KÜH˜]]ÈÂˆ˜]‹œİ[K˜›İÛHH˜]]ÈÂˆ˜]‹œİ[K˜[œÙ›Ü›HH››Û™HÂˆ˜]‹œİ[K›X\™Ú[“YHŒÂˆ˜]‹œİ[K›X\™Ú[”šYÚHŒÂˆ˜]‹œİ[KÚYHŒL	HÂ‚ˆ˜]‹™]\Ù]›˜]]™UŒLÈHYHÂˆB‚ˆYŠØİ[Y[œ™XYTİ]HOOH›ØY[™ÈŠ^ÂˆØİ[Y[˜Y]™[\İ[™\Š‘ÓPÛÛ[ØYY‹ZYÜ˜]SX\˜]‹ÛÛ˜ÙNY_JNÂˆY[Ù^ÂˆZYÜ˜]SX\˜]Š
NÂˆB‚ˆÚ[™İË›ZYÜ˜]SX\˜]•Ó˜]]™LLHZYÜ˜]SX\˜]ÂŸJJ
NÂ‚‚‹Êˆ[™YÛİ\˜ÙNˆœËÌ‹\İYÙK]ŒÎKX˜]K[X\X˜XÚÙÜ›İ[™\[[YKšœÈ
‹ÂŠ[˜İ[ÛŠ
^Âˆ\ÙHİšXİÂ‚ˆÚ[™İË‘ĞSQWÓUU‘WĞÓÓ‘’T“QQĞTÑSS‘HH•ŒÎÂˆÚ[™İË‘ĞSQWÓUU‘WĞÕT”‘S•Õ‘T”ÒSÓˆH•ŒÎHÂ‚ˆÊ‚ˆ
ˆŒÎHX\X˜XÚÙÜ›İ[™œšYÙK‚ˆ
‚ˆ
ˆš[Üš]N‚ˆ
ˆJH^\İ[™Èİ\œ™[]›ÛÛX\˜XÚÙÜ›İ[™[[Y[	ÜÈÛÛ\]YØİ\œ™[ˆ
ˆ˜XÚÙÜ›İ[™[XYÙK‚ˆ
ˆŠH^\İ[™ÈX\]KØ˜XÚÙÜ›İ[™˜\šXX›\ÈYˆ^ÜÙYHHØ[YK‚ˆ
‚ˆ
ˆÙHÈ›İ™\XÙHHØ[YIÜÈX\İ]HÜˆ˜]Hİ]K‚ˆ
‹Â‚ˆ[˜İ[ÛˆÙ]˜]TYÙJ
^Âˆ™]\›ˆØİ[Y[™Ù][[Y[RY
˜˜]TYÙHŠNÂˆB‚ˆ[˜İ[ÛˆÙ]]›ÛX\˜XÚÙÜ›İ[™

^ÂˆÛÛœİØ[™Y]\ÈHÂˆØİ[Y[™Ù][[Y[RY
œ]›ÛYÙHŠKˆØİ[Y[™Ù][[Y[RY
›X\YÙHŠKˆØİ[Y[™Ù][[Y[RY
˜Z[š[™ÔYÙHŠKˆØİ[Y[™Ù][[Y[RY
›X\˜XÚÙÜ›İ[™ŠKˆØİ[Y[œ]Y\TÙ[XİÜŠˆÙØ[YKXÛÛ[›X\X˜XÚÙÜ›İ[™ŠKˆØİ[Y[œ]Y\TÙ[XİÜŠˆÙØ[YKXÛÛ[œ]›ÛX˜XÚÙÜ›İ[™ŠKˆØİ[Y[œ]Y\TÙ[XİÜŠˆÙØ[YKXÛÛ[˜Z[š[™ËX˜XÚÙÜ›İ[™ŠBˆK™š[\Š›ÛÛX[ŠNÂ‚ˆ›ÜŠÛÛœİ[ÙˆØ[™Y]\Ê^ÂˆÛÛœİÜÈHÙ]ÛÛ\]Yİ[J[
NÂˆÛÛœİ™ÈHÜË˜˜XÚÙÜ›İ[™[XYÙNÂˆYŠ™È	‰ˆ™ÈOOH››Û™HŠ^Âˆ™]\›ˆ™ÎÂˆBˆÛÛœİ[›[™HH[œİ[K˜˜XÚÙÜ›İ[™[XYÙNÂˆYŠ[›[™J^Âˆ™]\›ˆ[›[™NÂˆBˆBˆ™]\›ˆ[ÂˆB‚ˆ[˜İ[Ûˆ\Pİ\œ™[X\˜XÚÙÜ›İ[™

^ÂˆÛÛœİ˜]HHÙ]˜]TYÙJ
NÂˆYŠX˜]JH™]\›ˆ˜[ÙNÂ‚ˆÛÛœİ™ÈHÙ]]›ÛX\˜XÚÙÜ›İ[™

NÂˆYŠX™ÊH™]\›ˆ˜[ÙNÂ‚ˆ˜]Kœİ[KœÙ]›Ü\J˜˜XÚÙÜ›İ[™Z[XYÙH‹™Ëš[\Ü[ŠNÂˆ˜]Kœİ[KœÙ]›Ü\J˜˜XÚÙÜ›İ[™\Ú^™H‹˜Ûİ™\ˆ‹š[\Ü[ŠNÂˆ˜]Kœİ[KœÙ]›Ü\J˜˜XÚÙÜ›İ[™\ÜÚ][Ûˆ‹˜Ù[\ˆ‹š[\Ü[ŠNÂˆ˜]Kœİ[KœÙ]›Ü\J˜˜XÚÙÜ›İ[™\™\X]‹››Ë\™\X]‹š[\Ü[ŠNÂ‚ˆ™]\›ˆYNÂˆB‚ˆÊ‚ˆ
ˆ˜]HX^H™H™[™\™YY\ˆX\˜]šYØ][Û‹ˆØœÙ\™HÛ›HBˆ
ˆØ[YKXÛÛ[İX™YH›Üˆ˜]TYÙKÛX\\YÙHÚ[™Ù\È[™™X\Bˆ
ˆHİ\œ™[X\[XYÙKˆ\ÈÙ\È›İ[\ˆ˜]HYXÚ[šXÜË‚ˆ
‹Âˆ[˜İ[Ûˆ[š]

^Âˆ\Pİ\œ™[X\˜XÚÙÜ›İ[™

NÂ‚ˆÛÛœİ›ÛİHØİ[Y[™Ù][[Y[RY
™Ø[YKXÛÛ[ŠHˆØİ[Y[™Ù][[Y[RY
™Ø[YK\İYÙHŠNÂˆYŠ\›Ûİ
H™]\›Â‚ˆÛÛœİØœÙ\™\ˆH™]È]]][Û“ØœÙ\™\Š[˜İ[ÛŠ
^ÂˆYŠØİ[Y[™Ù][[Y[RY
˜˜]TYÙHŠJ^Âˆ\Pİ\œ™[X\˜XÚÙÜ›İ[™

NÂˆBˆJNÂ‚ˆØœÙ\™\‹›ØœÙ\™J›ÛİØÚ[\İYKİX™YNY_JNÂ‚ˆÚ[™İË˜Y]™[\İ[™\Šœ™\Ú^™H‹\Pİ\œ™[X\˜XÚÙÜ›İ[™
NÂˆB‚ˆÚ[™İËœŞ[˜Ğ˜]P˜XÚÙÜ›İ[™Ğİ\œ™[X\H\Pİ\œ™[X\˜XÚÙÜ›İ[™Â‚ˆYŠØİ[Y[œ™XYTİ]HOOH›ØY[™ÈŠ^ÂˆØİ[Y[˜Y]™[\İ[™\Š‘ÓPÛÛ[ØYY‹[š]ÛÛ˜ÙNY_JNÂˆY[Ù^Âˆ[š]

NÂˆBŸJJ
NÂ‚‚‹Êˆ[™YÛİ\˜ÙNˆœËÌË\İYÙK]\›ÛİX˜]KX˜XÚÙÜ›İ[™\[[YKšœÈ
‹ÂŠ[˜İ[ÛŠ
^Âˆ\ÙHİšXİÂ‚ˆÚ[™İË‘ĞSQWÓUU‘WĞÓÓ‘’T“QQĞTÑSS‘HH•ŒÎHÂˆÚ[™İË‘ĞSQWÓUU‘WĞÕT”‘S•Õ‘T”ÒSÓˆH•Â‚ˆÛÛœİQĞPÖWÕÒQHŒÂˆÛÛœİUU‘WÕÒQHLÂˆÛÛœİÒTPÕT—ĞĞT‘ÓQĞPÖWÕÒQHLÂˆÛÛœİĞTÕĞQÑWÓUU‘WÕÒQBˆÒTPÕT—ĞĞT‘ÓQĞPÖWÕÒQ
ˆ
UU‘WÕÒQÈQĞPÖWÕÒQ
NÂ‚ˆ[˜İ[Ûˆ[œİ\™P˜]P˜XÚÙÜ›İ[™^Y\Š
^ÂˆÛÛœİ˜]HHØİ[Y[™Ù][[Y[RY
˜˜]TYÙHŠNÂˆYŠX˜]JH™]\›ˆ[Â‚ˆ]^Y\ˆH˜]Kœ]Y\TÙ[XİÜŠœØÛÜHˆ˜˜]KX™Ë\Ú\™YŠNÂˆYŠ[^Y\Š^Âˆ^Y\ˆHØİ[Y[˜Ü™X]Q[[Y[
™]ˆŠNÂˆ^Y\‹˜Û\ÜÓ˜[YHH˜˜]KX™Ë\Ú\™YÂˆ^Y\‹œÙ]]šX]J˜\šXKZY[ˆ‹YHŠNÂˆ˜]Kš[œÙ\™Y›Ü™J^Y\‹˜]K™š\œİÚ[
NÂˆBˆ™]\›ˆ^Y\ÂˆB‚ˆ[˜İ[ÛˆÙ]XİX[]›Û˜XÚÙÜ›İ[™

^ÂˆÊ‚ˆ
ˆÓÕTÑHÑˆ•U‚ˆ
ˆ[\“X\

HØ[È\SX\›Û™P˜XÚÙÜ›İ[™
İ\œ™[›Û™JKˆ
ˆÚXÚÜš]\ÈHİ\œ™[X\[XYÙHÈÛX\YÙP™Ó^Y\‹‚ˆ
‚ˆ
ˆÙH™XY]^Xİ™[™\™Y^Y\ˆ˜]\ˆ[ˆİY\ÜÚ[™Âˆ
ˆœ›ÛHÛX\YÙH]Ù[‹‚ˆ
‹ÂˆÛÛœİX\^Y\ˆHØİ[Y[™Ù][[Y[RY
›X\YÙP™Ó^Y\ˆŠNÂˆYŠX\^Y\Š^ÂˆÛÛœİ™ÈHÙ]ÛÛ\]Yİ[JX\^Y\ŠK˜˜XÚÙÜ›İ[™[XYÙNÂˆYŠ™È	‰ˆ™ÈOOH››Û™HŠ^Âˆ™]\›ˆ™ÎÂˆBˆYŠX\^Y\‹œİ[K˜˜XÚÙÜ›İ[™[XYÙJ^Âˆ™]\›ˆX\^Y\‹œİ[K˜˜XÚÙÜ›İ[™[XYÙNÂˆBˆB‚ˆÊ‚ˆ
ˆ˜[˜XÚÈÛ›HYˆHX\^Y\ˆ\È›İ]˜Z[X›N‚ˆ
ˆ\ÙHHØ[YIÜÈXİX[X\^›Û™HX›H[™İ\œ™[›Û™K‚ˆ
‹Âˆ^ÂˆYŠ\[ÙˆX\›Û™P˜XÚÙÜ›İ[™[XYÙ\ÈOOH[™Yš[™YŠ^ÂˆÛÛœİ\›HX\›Û™P˜XÚÙÜ›İ[™[XYÙ\ÖØİ\œ™[›Û™WHˆX\›Û™P˜XÚÙÜ›İ[™[XYÙ\Ë™›Ü™\İÂˆYŠ\›
^Âˆ™]\›ˆ\›
ˆ
È\›
ÈŠHÂˆBˆBˆXØ]Ú
J^ßB‚ˆ™]\›ˆ[ÂˆB‚ˆ[˜İ[ÛˆŞ[˜Ğ˜]P˜XÚÙÜ›İ[™Ğİ\œ™[X\

^ÂˆÛÛœİ^Y\ˆH[œİ\™P˜]P˜XÚÙÜ›İ[™^Y\Š
NÂˆYŠ[^Y\ŠH™]\›ˆ˜[ÙNÂ‚ˆÛÛœİ™ÈHÙ]XİX[]›Û˜XÚÙÜ›İ[™

NÂˆYŠX™ÊH™]\›ˆ˜[ÙNÂ‚ˆ^Y\‹œİ[KœÙ]›Ü\J˜˜XÚÙÜ›İ[™Z[XYÙH‹›[™X\‹YÜ˜YY[
™Ø˜JLŠK™Ø˜JLŠJKˆ
È™Ëš[\Ü[ŠNÂˆ^Y\‹œİ[KœÙ]›Ü\J˜˜XÚÙÜ›İ[™\Ú^™H‹˜Ûİ™\ˆ‹š[\Ü[ŠNÂˆ^Y\‹œİ[KœÙ]›Ü\J˜˜XÚÙÜ›İ[™\ÜÚ][Ûˆ‹˜Ù[\ˆÜ‹š[\Ü[ŠNÂˆ^Y\‹œİ[KœÙ]›Ü\J˜˜XÚÙÜ›İ[™\™\X]‹››Ë\™\X]‹š[\Ü[ŠNÂ‚ˆ™]\›ˆYNÂˆB‚ˆ[˜İ[Ûˆ[œİ\™PØ\İ˜YÙTÛİ\˜ÙTÚ^™J˜YÙJ^ÂˆYŠX˜YÙHX˜YÙK˜Û\ÜÓ\İ˜ÛÛZ[œÊœÚÚ[[˜[YKX˜YÙHŠJH™]\›ÂˆÊ‚ˆ
ˆ\È\È˜]]™K[İ™\›^HÜXÙKÛÈX]ÚHYØXŞHØ\™‚ˆ
ˆLYØXŞH0åÈ‹MÌM‹‹ˆHÌNMÈ˜]]™H‚ˆ
‹Âˆ˜YÙKœİ[KœÙ]›Ü\JˆÚY‹ˆĞTÕĞQÑWÓUU‘WÕÒQ
Èœ‹ˆš[\Ü[‚ˆ
NÂˆ˜YÙKœİ[KœÙ]›Ü\Jˆ›Z[‹]ÚY‹ˆĞTÕĞQÑWÓUU‘WÕÒQ
Èœ‹ˆš[\Ü[‚ˆ
NÂˆ˜YÙKœİ[KœÙ]›Ü\Jˆ›X^]ÚY‹ˆĞTÕĞQÑWÓUU‘WÕÒQ
Èœ‹ˆš[\Ü[‚ˆ
NÂˆ˜YÙKœİ[KœÙ]›Ü\J™›Û\Ú^™H‹Ìœ‹š[\Ü[ŠNÂˆ˜YÙKœİ[KœÙ]›Ü\J™›Û]ÙZYÚ‹L‹š[\Ü[ŠNÂˆ˜YÙKœİ[KœÙ]›Ü\J^X[YÛˆ‹˜Ù[\ˆ‹š[\Ü[ŠNÂˆ˜YÙKœİ[KœÙ]›Ü\JÚ]K\ÜXÙH‹››İÜ˜\‹š[\Ü[ŠNÂˆB‚ˆÊ‚ˆ
ˆHÚÚ[˜YÙH\È[˜[ZXØ[HÜ™X]YBˆ
ˆÚİÔÚÚ[˜[YP˜YÙJ
KÜÚİÓ[Ûœİ\”ÚÚ[˜[YP˜YÙJ
K‚ˆ
ˆØ]ÚH™X[›ÙH]Ü™X][Ûˆ[YK‚ˆ
‹Âˆ[˜İ[ÛˆØ]Úİ™\›^J
^ÂˆÛÛœİİ™\›^HHØİ[Y[™Ù][[Y[RY
™Ø[YK[İ™\›^K[^Y\ˆŠNÂˆYŠ[İ™\›^JH™]\›Â‚ˆİ™\›^Kœ]Y\TÙ[XİÜ[
‹œÚÚ[[˜[YKX˜YÙHŠBˆ™›Ü‘XXÚ
[œİ\™PØ\İ˜YÙTÛİ\˜ÙTÚ^™JNÂ‚ˆÛÛœİØœÙ\™\ˆH™]È]]][Û“ØœÙ\™\Š[˜İ[ÛŠ]]][ÛœÊ^Âˆ]]][ÛœË™›Ü‘XXÚ
[˜İ[ÛŠ]]][ÛŠ^Âˆ]]][Û‹˜YY›Ù\Ë™›Ü‘XXÚ
[˜İ[ÛŠ›ÙJ^ÂˆYŠ›ÙK››ÙU\HOOHJH™]\›ÂˆYŠ›ÙK˜Û\ÜÓ\İ	‰‚ˆ›ÙK˜Û\ÜÓ\İ˜ÛÛZ[œÊœÚÚ[[˜[YKX˜YÙHŠJ^Âˆ[œİ\™PØ\İ˜YÙTÛİ\˜ÙTÚ^™J›ÙJNÂˆBˆYŠ›ÙKœ]Y\TÙ[XİÜ[
^Âˆ›ÙKœ]Y\TÙ[XİÜ[
‹œÚÚ[[˜[YKX˜YÙHŠBˆ™›Ü‘XXÚ
[œİ\™PØ\İ˜YÙTÛİ\˜ÙTÚ^™JNÂˆBˆJNÂˆJNÂˆJNÂˆØœÙ\™\‹›ØœÙ\™Jİ™\›^KØÚ[\İYKİX™YNY_JNÂˆB‚ˆ[˜İ[Ûˆ[š]

^Âˆ[œİ\™P˜]P˜XÚÙÜ›İ[™^Y\Š
NÂˆŞ[˜Ğ˜]P˜XÚÙÜ›İ[™Ğİ\œ™[X\

NÂˆØ]Úİ™\›^J
NÂ‚ˆÊ‚ˆ
ˆÚ[ˆİ\œ™[›Û™KÛX\˜XÚÙÜ›İ[™Ú[™Ù\ËÛX\YÙP™Ó^Y\ˆ\Âˆ
ˆ\]YH\SX\›Û™P˜XÚÙÜ›İ[™

Kˆ]]][Û“ØœÙ\™\ˆÛˆBˆ
ˆİ[H]šX]HİX\˜[Y\È˜]H™XÙZ]™\ÈHØ[YH[XYÙK‚ˆ
‹ÂˆÛÛœİX\^Y\ˆHØİ[Y[™Ù][[Y[RY
›X\YÙP™Ó^Y\ˆŠNÂˆYŠX\^Y\Š^ÂˆÛÛœİX\ØœÙ\™\ˆH™]È]]][Û“ØœÙ\™\ŠˆŞ[˜Ğ˜]P˜XÚÙÜ›İ[™Ğİ\œ™[X\ˆ
NÂˆX\ØœÙ\™\‹›ØœÙ\™JX\^Y\‹Ø]šX]\ÎYK]šX]Qš[\–Èœİ[H—_JNÂˆB‚ˆÊ‚ˆ
ˆ[ÛÈ™\Ş[˜ÈÚ[ˆH˜]HYÙH\È™[™\™YØXİ]˜]Y‚ˆ
‹ÂˆÛÛœİÛÛ[HØİ[Y[™Ù][[Y[RY
™Ø[YKXÛÛ[ŠNÂˆYŠÛÛ[
^ÂˆÛÛœİYÙSØœÙ\™\ˆH™]È]]][Û“ØœÙ\™\Š[˜İ[ÛŠ
^ÂˆYŠØİ[Y[™Ù][[Y[RY
˜˜]TYÙHŠJ^ÂˆŞ[˜Ğ˜]P˜XÚÙÜ›İ[™Ğİ\œ™[X\

NÂˆBˆJNÂˆYÙSØœÙ\™\‹›ØœÙ\™JÛÛ[ØÚ[\İYKİX™YNY_JNÂˆB‚ˆÚ[™İËœŞ[˜Ğ˜]P˜XÚÙÜ›İ[™Ğİ\œ™[X\BˆŞ[˜Ğ˜]P˜XÚÙÜ›İ[™Ğİ\œ™[X\ÂˆB‚ˆÚ[™İË™Ù]˜]Uš\İX[XYÛ›ÜİXÜÈH[˜İ[ÛŠ
^ÂˆÛÛœİ^Y\ˆHØİ[Y[œ]Y\TÙ[XİÜŠˆˆÙØ[YK\İYÙHˆØ\ˆÙØ[YKXÛÛ[Ø˜]TYÙHˆ˜˜]KX™Ë\Ú\™Y‚ˆ
NÂˆÛÛœİ˜YÙHHØİ[Y[œ]Y\TÙ[XİÜŠˆˆÙØ[YK\İYÙHˆÙØ[YK[İ™\›^K[^Y\ˆœÚÚ[[˜[YKX˜YÙH‚ˆ
NÂˆ™]\›ˆÂˆİ\œ™[›Û™N‚ˆ
\[Ùˆİ\œ™[›Û™HOOH[™Yš[™YˆÈİ\œ™[›Û™Hˆ[
Kˆ˜]P˜XÚÙÜ›İ[™‚ˆ^Y\ˆÈÙ]ÛÛ\]Yİ[J^Y\ŠK˜˜XÚÙÜ›İ[™[XYÙHˆ[ˆ˜YÙQ›Û‚ˆ˜YÙHÈÙ]ÛÛ\]Yİ[J˜YÙJK™›ÛÚ^™Hˆ[ˆ˜YÙUÚY‚ˆ˜YÙHÈ˜YÙK™Ù]›İ[™[™ĞÛY[™Xİ

KÚYˆ[ˆ˜YÙU^‚ˆ˜YÙHÈ˜YÙK^ÛÛ[ˆ[ˆNÂˆNÂ‚ˆYŠØİ[Y[œ™XYTİ]HOOH›ØY[™ÈŠ^ÂˆØİ[Y[˜Y]™[\İ[™\Š‘ÓPÛÛ[ØYY‹[š]ÛÛ˜ÙNY_JNÂˆY[Ù^Âˆ[š]

NÂˆBŸJJ
NÂ‚‚‹Êˆ[™YÛİ\˜ÙNˆœËÌ\İYÙK]K\[[YKšœÈ
‹ÂŠ[˜İ[ÛŠ
^Âˆ\ÙHİšXİÂˆÚ[™İË‘ĞSQWÓUU‘WĞÓÓ‘’T“QQĞTÑSS‘HH•ÂˆÚ[™İË‘ĞSQWÓUU‘WĞÕT”‘S•Õ‘T”ÒSÓˆH•HÂŸJJ
NÂ‚‚‹Êˆ[™YÛİ\˜ÙNˆœËÌK\İYÙK]K\[[YKšœÈ
‹ÂŠ[˜İ[ÛŠ
^Âˆ\ÙHİšXİÂˆÚ[™İË‘ĞSQWÓUU‘WĞÓÓ‘’T“QQĞTÑSS‘HH•HÂˆÚ[™İË‘ĞSQWÓUU‘WĞÕT”‘S•Õ‘T”ÒSÓˆH•HÂˆÚ[™İË‘ĞSQWĞUWĞPÒÑÔ“ÕS‘ÕS•Hœ™Ø˜JŒÎ
HÂˆÚ[™İË‘ĞSQWĞĞTÕÔÒÒSĞQÑWÑ“Ó•ÔÒV‘HHŒLœÂŸJJ
NÂ‚‚‹Êˆ[™YÛİ\˜ÙNˆœËÌL\İYÙK]‹\[[YKšœÈ
‹ÂŠ[˜İ[ÛŠ
^Âˆ\ÙHİšXİÂˆÚ[™İË‘ĞSQWÓUU‘WĞÓÓ‘’T“QQĞTÑSS‘HH•HÂˆÚ[™İË‘ĞSQWÓUU‘WĞÕT”‘S•Õ‘T”ÒSÓˆH•ˆÂˆÚ[™İË‘ĞSQWĞUWĞPÒÑÔ“ÕS‘ÕS•Hœ™Ø˜JLŠHÂˆÚ[™İË‘ĞSQWĞĞTÕÔÒÒSĞQÑWÑ“Ó•ÔÒV‘HHŒLÌœÂŸJJ
NÂ‚‚‹Êˆ[™YÛİ\˜ÙNˆœËÌLK\İYÙK]Ë\[[YKšœÈ
‹ÂŠ[˜İ[ÛŠ
^Âˆ\ÙHİšXİÂˆÚ[™İË‘ĞSQWÓUU‘WĞÓÓ‘’T“QQĞTÑSS‘HH•ˆÂˆÚ[™İË‘ĞSQWÓUU‘WĞÕT”‘S•Õ‘T”ÒSÓˆH•ÈÂˆÚ[™İË‘ĞSQWĞĞTÕÔÒÒSĞQÑWÔÓÕTÑWÑ“Ó•ÔÒV‘HHŒMLÂˆÚ[™İË‘ĞSQWĞĞTÕÔÒÒSĞQÑWÔÓÕTÑWÕÒQHLÂŸJJ
NÂ‚‚‹Êˆ[™YÛİ\˜ÙNˆœËÌL‹\İYÙK]\[[YKšœÈ
‹ÂŠ[˜İ[ÛŠ
^Âˆ\ÙHİšXİÂˆÚ[™İË‘ĞSQWÓUU‘WĞÓÓ‘’T“QQĞTÑSS‘HH•ÈÂˆÚ[™İË‘ĞSQWÓUU‘WĞÕT”‘S•Õ‘T”ÒSÓˆH•ÂˆÚ[™İË‘ĞSQWĞĞTÕÔÒÒSĞQÑWÑ“Ó•ÔÒV‘HHÌœÂˆÚ[™İË‘ĞSQWĞĞTÕÔÒÒSĞQÑWÔÕ“ÒÑHH››Û™HÂŸJJ
NÂ‚‚‹Êˆ[™YÛİ\˜ÙNˆœËÌLË\İYÙK]K\[[YKšœÈ
‹ÂŠ[˜İ[ÛŠ
^Âˆ\ÙHİšXİÂˆÚ[™İË‘ĞSQWÓUU‘WĞÓÓ‘’T“QQĞTÑSS‘HH•ÂˆÚ[™İË‘ĞSQWÓUU‘WĞÕT”‘S•Õ‘T”ÒSÓˆH•HÂˆÚ[™İË‘ĞSQWĞĞTÕÔÒÒSĞQÑWÔÕ“ÒÑHH››Û™HÂ‚ˆ[˜İ[Ûˆ™[[İ™TÚÚ[Ú]Tİ›ÚÙJ
^ÂˆØİ[Y[œ]Y\TÙ[XİÜ[
‹œÚÚ[[˜[YKX˜YÙHŠK™›Ü‘XXÚ
[˜İ[ÛŠ[
^Âˆ[œİ[KœÙ]›Ü\J‹]ÙXšÚ]]^\İ›ÚÙH‹Œ‹š[\Ü[ŠNÂˆ[œİ[KœÙ]›Ü\J^\İ›ÚÙH‹Œ‹š[\Ü[ŠNÂˆ[œİ[KœÙ]›Ü\J˜›Ü™\ˆ‹Œ‹š[\Ü[ŠNÂˆ[œİ[KœÙ]›Ü\J›İ][™H‹Œ‹š[\Ü[ŠNÂˆJNÂˆB‚ˆYŠØİ[Y[œ™XYTİ]HOOH›ØY[™ÈŠ^ÂˆØİ[Y[˜Y]™[\İ[™\Š‘ÓPÛÛ[ØYY‹™[[İ™TÚÚ[Ú]Tİ›ÚÙKÛÛ˜ÙNY_JNÂˆY[Ù^Âˆ™[[İ™TÚÚ[Ú]Tİ›ÚÙJ
NÂˆBŸJJ
NÂ‚‚‹Êˆ[™YÛİ\˜ÙNˆœËÌM\İYÙK]L\[[YKšœÈ
‹ÂŠ[˜İ[ÛŠ
^Âˆ\ÙHİšXİÂˆÚ[™İË‘ĞSQWÓUU‘WĞÓÓ‘’T“QQĞTÑSS‘HH•HÂˆÚ[™İË‘ĞSQWÓUU‘WĞÕT”‘S•Õ‘T”ÒSÓˆH•LÂ‚ˆ[˜İ[Ûˆš^˜]P˜XÚÙÜ›İ[™YÙJ
^ÂˆÛÛœİİYÙHHØİ[Y[™Ù][[Y[RY
™Ø[YK\İYÙHŠNÂˆÛÛœİ˜]HHØİ[Y[™Ù][[Y[RY
˜˜]TYÙHŠNÂˆÛÛœİ™ÈH˜]H	‰ˆ˜]Kœ]Y\TÙ[XİÜŠ‹˜˜]KX™Ë\Ú\™YŠNÂˆYŠ\İYÙHX˜]HX™ÊH™]\›Â‚ˆÊˆ\ÙHHXİX[˜]HšY]ÜÜ[Y[œÚ[ÛœË™]™\ˆYØXŞHŒˆ
‹Âˆ™Ëœİ[KœÙ]›Ü\J›Y‹Œ‹š[\Ü[ŠNÂˆ™Ëœİ[KœÙ]›Ü\JÜ‹Œ‹š[\Ü[ŠNÂˆ™Ëœİ[KœÙ]›Ü\JÚY‹ŒL	H‹š[\Ü[ŠNÂˆ™Ëœİ[KœÙ]›Ü\JšZYÚ‹ŒL	H‹š[\Ü[ŠNÂˆ™Ëœİ[KœÙ]›Ü\JœšYÚ‹Œ‹š[\Ü[ŠNÂˆ™Ëœİ[KœÙ]›Ü\J˜›İÛH‹Œ‹š[\Ü[ŠNÂˆ™Ëœİ[KœÙ]›Ü\J˜›Ü™\ˆ‹Œ‹š[\Ü[ŠNÂˆ™Ëœİ[KœÙ]›Ü\J›İ][™H‹Œ‹š[\Ü[ŠNÂˆ™Ëœİ[KœÙ]›Ü\J˜›Ş\ÚYİÈ‹››Û™H‹š[\Ü[ŠNÂ‚ˆ˜]Kœİ[KœÙ]›Ü\J›İ™\™›İÈ‹šY[ˆ‹š[\Ü[ŠNÂˆB‚ˆYŠØİ[Y[œ™XYTİ]HOOH›ØY[™ÈŠ^ÂˆØİ[Y[˜Y]™[\İ[™\Š‘ÓPÛÛ[ØYY‹š^˜]P˜XÚÙÜ›İ[™YÙKÛÛ˜ÙNY_JNÂˆY[Ù^Âˆš^˜]P˜XÚÙÜ›İ[™YÙJ
NÂˆBŸJJ
NÂ‚‚‹Êˆ[™YÛİ\˜ÙNˆœËÌMK\İYÙK]LK\[[YKšœÈ
‹ÂŠ[˜İ[ÛŠ
^Âˆ\ÙHİšXİÂˆÚ[™İË‘ĞSQWÓUU‘WĞÓÓ‘’T“QQĞTÑSS‘HH•LÂˆÚ[™İË‘ĞSQWÓUU‘WĞÕT”‘S•Õ‘T”ÒSÓˆH•LÈÂ‚ˆÊ‚ˆ™\İÜ™HÚ]Hİ][™HÛ›HÛˆÛÛX˜]™\İ[›Ù\Ë‚ˆÈ›İİXÚÚÚ[[˜[YKX˜YÙK‚ˆ
‹ÂˆÛÛœİÛÛX˜]™\İ[Ù[XİÜˆHÂˆ‹˜˜]KY[XYÙH‹ˆ‹˜˜]KY[XYÙK[[X™\ˆ‹ˆ‹™[XYÙK[[X™\ˆ‹ˆ‹™[XYÙK]^‹ˆ‹˜ÛÛX˜]Y[XYÙH‹ˆ‹˜ÛÛX˜]\™\İ[‹ˆ‹˜ÛÛX˜]\™\İ[]^‹ˆ‹˜˜]K[Z\ÜÈ‹ˆ‹›Z\ÜË]^‹ˆ‹˜˜]KZX[‹ˆ‹šX[[[X™\ˆ‹ˆ‹šXÚ[™ÙH‹ˆ‹šXÚ[™ÙK[[X™\ˆ‚ˆKš›Ú[Š‹ŠNÂ‚ˆ[˜İ[Ûˆ\PÛÛX˜]™\İ[İ›ÚÙJ›Ûİ
^ÂˆÛÛœİ˜\ÙHH›Ûİ	‰ˆ›Ûİœ]Y\TÙ[XİÜ[È›ÛİˆØİ[Y[Âˆ˜\ÙKœ]Y\TÙ[XİÜ[
ÛÛX˜]™\İ[Ù[XİÜŠK™›Ü‘XXÚ
[˜İ[ÛŠ[
^Âˆ[œİ[KœÙ]›Ü\J‹]ÙXšÚ]]^\İ›ÚÙH‹ŒÜÙ™™™™™ˆ‹š[\Ü[ŠNÂˆ[œİ[KœÙ]›Ü\J^\İ›ÚÙH‹ŒÜÙ™™™™™ˆ‹š[\Ü[ŠNÂˆJNÂˆB‚ˆ[˜İ[Ûˆ[š]

^Âˆ\PÛÛX˜]™\İ[İ›ÚÙJØİ[Y[
NÂ‚ˆÛÛœİİYÙHHØİ[Y[™Ù][[Y[RY
™Ø[YK\İYÙHŠNÂˆYŠİYÙJ^Âˆ™]È]]][Û“ØœÙ\™\Š[˜İ[ÛŠ
^Âˆ\PÛÛX˜]™\İ[İ›ÚÙJİYÙJNÂˆJK›ØœÙ\™JİYÙKØÚ[\İYKİX™YNY_JNÂˆBˆB‚ˆYŠØİ[Y[œ™XYTİ]HOOH›ØY[™ÈŠ^ÂˆØİ[Y[˜Y]™[\İ[™\Š‘ÓPÛÛ[ØYY‹[š]ÛÛ˜ÙNY_JNÂˆY[Ù^Âˆ[š]

NÂˆBŸJJ
NÂ‚‚‹Êˆ[™YÛİ\˜ÙNˆœËÜ™[XË\İ[[X\KXØ][ÙËšœÈ
‹Â‹Êˆš\œİ\ØÜ™Y[‹\ØY™HX[H™[XÈİ[[X\HØ][ÙË‚ˆİÛœÈÛ›HHİ]XÈšY[È™\]Z\™YHHXZ[‹XÚ]Hİ[[X\H[™H[™[XÈØ][ÙËˆ
‹ÂŠ[˜İ[Ûˆ[œİ[™[XÔİ[[X\PØ][ÙÊÛØ˜[
^Âˆ\ÙHİšXİÂˆYŠYÛØ˜[ÛØ˜[‘›İ\”Ş[X›ÛÔ™[XÔİ[[X\PØ][ÙÊ^È™]\›ÈBˆÛÛœİ[šY\ÏVÂˆÈœ™[X×ÜZX[šİ[—Ù›\ÚÈ‹¹.o¹gi9ã¢yhîˆ‹¹iaù¥n9fç¹d"9íd9§gù¦`ˆ—KˆÈœ™[X×Üİ[—ÛÜ˜ˆ‹¹àâ:foyég¹ãè‹¹`m¹¥n9fç¹d":e¢ùiâù¦`ˆ—KˆÈœ™[X×ŞX[İWÜÙX[‹¹ã¡9«iºgb9cl‹¹«ãùë+ùfç¹d":e¢ùiâù¦`ˆ—KˆÈœ™[X×ÜÛİ[Ø™[‹ºc«ºk`¹cé:d&‹¹«ãùë+9fç¹d":e¢ùiâù¦`ˆ—KˆÈœ™[X×İX[™Ø[™×Ø˜[›™\ˆ‹¹i*yïhy¢,9¥åÈ‹¹¢$y¥®yí+ùêcycåùb,¹«(y¥my¥®y§"y¥b9¥.ù¤â¹o£—KˆÈœ™[X×Ûš[™WÙ˜YÛÛ—Ùš\™H‹¹.gzo£yég¹àjùïjH‹¹¥my¥®yí+ùêcyk£9¢$ù«(y§"y¥b:(c9båyo£—KˆÈœ™[X×ØÛÛÜÜš[™×Ú˜YH‹¹kä¹¬âyã¢yãëˆ‹¹.îù. 9¢$y¥®z)äº"l’9å,LÍIy.éy."ºfcz!ìÌÍIy.éy."ù¦`ˆ—KˆÈœ™[X×ÜZ[™Û[—Ù™X]\ˆ‹ºgd¹md9ï¯yë)ˆ‹¹¢,:k)ze¢ùiâù¦`ˆ—KˆÈœ™[X×Ü›ØÚ×Û[İ[Z[—ÜÙX[‹¹lªyl¬úc«¹cl‹ºe¢ùh-;ï&ùcé¹¥¯9¢$y¥®yí+ùêcycåÎ9«(y§"y¥b9¥.ù¤â¹¦`ˆ—KˆÈœ™[X×Ü™]\›š[™×İÚY[‹¹fç¹i*ykíº/*ˆ‹¹§+9h-9ë+9. 9«(y§"y¢$y¥®z)äº"l¹l!ùcåùb,:!í9doy`­ùk¬ù¦`ˆ—KˆÈœ™[X×ÛÜšYÚ[—İ[\ÛX[ˆ‹¹i*¹b'z e¹ë)ˆ‹¹«ãùë+9fç¹d"9íd9§gÈ—KˆÈœ™[X×Øœ›ÚÙ[—Ø\›^WÜØÜ›Û‹¹è-:.ãy«¦9cmÈ‹º)äº"l¹¥.ù¤â»ï#ù¢ : ïy¤â¹¥eù¥my.®¹o£—KˆÈœ™[X×Ü™YÜÚŞWİØ\—ÛX\šÈ‹º-i:g!9¢,9í"È‹¹¢,:k)ze¢ùiâù¦`ˆ—KˆÈœ™[X×ÚXÙWÛZ\œ›Ü—ÚX\‹¹ã¡9a¬:cèyoàÈ‹¹«ãùë+ùfç¹d"9íd9§gÈ—KˆÈœ™[X×İÚ[™ØÚ\Ú[™×İ[\ÛX[ˆ‹º/ïzhª:(c9ë)ˆ‹¹«ãùë+ùfç¹d":e¢ùiâÈ—KˆÈœ™[X×Û[İ[Z[—Üš]™\—ØØ][›Ûˆ‹¹lly¬¬ùkíºo#ˆ‹¹¢$y¥®yí+ùêcycåÍù«(y§"y¥b9¥.ù¤â¹o£—KˆÈœ™[X×Ø\›š[™×Üİ\—ÛX\šÈ‹¹á&¹¦'ù«¦9cl‹¹`m¹¥n9fç¹d"9íd9§gÈ—KˆÈœ™[X×ÜÜ\š]ÜÜš[™×Ø›İH‹ºgb9¬ây¬åyäíˆ‹¹«ãùë+ùfç¹d"9íd9§gÈ—KˆÈœ™[X×Ù[[Û—Üİ\™\ÜÚ[™×ÜÙX[‹¹/#úke:aäycl‹¹¢,:k)ze¢ùiâûï&úi¥¹«(y¢$9b§ùcåùb,9. :"+:,¨:gh¹âà9¡bÈ—KˆÈœ™[X×Ø[Ü™]\›š[™×Ø\œ˜^H‹º$+:,hy«n9a`ùæé‹¹«ãùë+9fç¹d":e¢ùiâÈ—BˆNÂˆÛØ˜[‘›İ\”Ş[X›ÛÔ™[XÔİ[[X\PØ][ÙÏSØš™Xİ™œ™Y^™JØš™Xİ™œ›ÛQ[šY\Ê[šY\Ë›X\
[OO–Âˆ[VÌKˆØš™Xİ™œ™Y^™JÚY™[VÌK˜[YN™[VÌWKšYÙÙ\•^™[VÌ—_JBˆJJJNÂŸJJ\[ÙˆÚ[™İÈOOH[™Yš[™YİÚ[™İÎ™ÛØ˜[\ÊNÂ‚‚‹Êˆ[™YÛİ\˜ÙNˆœËÌM‹\İYÙK]M[XZ[‹XÚ]K\[[YKšœÈ
‹ÂŠ[˜İ[ÛŠ
^Âˆ\ÙHİšXİÂˆÚ[™İË‘ĞSQWÓUU‘WĞÓÓ‘’T“QQĞTÑSS‘HH•LHÂˆÚ[™İË‘ĞSQWÓUU‘WĞÕT”‘S•Õ‘T”ÒSÓˆH•MÂˆÚ[™İË‘ĞSQWÓUU‘WÓTÕÔĞÓÔHH›XZ[‹XÚ]K[[Ù\˜]K\ØØ[HÂ‚ˆÛÛœİQÑ”‘QWÓSÑWĞÓTÔÏH˜YYœ™YK\Ù\šXÙKZ[™›Ë[[ÙHÂˆÛÛœİQÑ”‘QWĞÓÓ‘’Q×ÒÑVOH”ÒVPS‘×ĞQÑ”‘QWÔÑT•’PÑWĞÓÓ‘’QÈÂˆÛÛœİQÑ”‘QWÑTÔVWÔÓPÖOSØš™Xİ™œ™Y^™JÛ[ÙNˆ›X[X[ŸJNÂˆÛÛœİQUSĞQÑ”‘QWĞÓÓ‘’QÏSØš™Xİ™œ™Y^™JÂˆİ\Ü[XZ[ˆˆ‹ˆ™Y[™ÛXŞU\›ˆˆ‹ˆ\›\Õ\›ˆˆ‹ˆš]˜XŞTÛXŞU\›ˆˆ‹ˆ\˜Ú\ÙU\›ˆˆ‹ˆ\˜Ú\ÙQ[˜X›Y™˜[ÙBˆJNÂ‚ˆ[˜İ[Ûˆ\J
^ÂˆÛÛœİÛYHHØİ[Y[™Ù][[Y[RY
šÛYTYÙHŠNÂˆYŠZÛYJH™]\›ÂˆÛYK˜Û\ÜÓ\İ˜Y
›XZ[‹XÚ]K[Ø˜K\™XYHŠNÂˆB‚ˆ[˜İ[Ûˆ[œİ\™PYœ™YPÛÛ™šYÊ
^ÂˆÛÛœİ›Ü›X[İ\Ü[XZ[Tİš[™ÊÚ[™İË‘›İ\”Ş[X›ÛÔİ\Ü	‰Ú[™İË‘›İ\”Ş[X›ÛÔİ\Ü™[XZ[ˆŠKš[J
NÂˆÛÛœİ^\İ[™Ï]Ú[™İÖĞQÑ”‘QWĞÓÓ‘’Q×ÒÑVWI‰\[ÙˆÚ[™İÖĞQÑ”‘QWĞÓÓ‘’Q×ÒÑVWOOOH›Øš™Xİ‚ˆÈÚ[™İÖĞQÑ”‘QWĞÓÓ‘’Q×ÒÑVWBˆˆßNÂˆÛÛœİÛÛ™šYÏSØš™Xİ˜\ÜÚYÛŠßKQUSĞQÑ”‘QWĞÓÓ‘’QË^\İ[™ÊNÂˆYŠ›Ü›X[İ\Ü[XZ[
^ÈÛÛ™šYËœİ\Ü[XZ[Y›Ü›X[İ\Ü[XZ[ÈBˆÚ[™İÖĞQÑ”‘QWĞÓÓ‘’Q×ÒÑVWOXÛÛ™šYÎÂˆ™]\›ˆÛÛ™šYÎÂˆB‚ˆ[˜İ[ÛˆÙ][Ù[\Ê
^ÂˆÛÛœİ[Ù[YØİ[Y[™Ù][[Y[RY
šÛYQ™X]\™S[Ù[ŠNÂˆYŠ[[Ù[
^È™]\›ˆ[ÈBˆÛÛœİ›Ş[[Ù[œ]Y\TÙ[XİÜŠ‹šÛYKY™X]\™K[[Ù[X›ŞŠNÂˆÛÛœİ]OYØİ[Y[™Ù][[Y[RY
šÛYQ™X]\™S[Ù[]HŠNÂˆÛÛœİ›ÙOYØİ[Y[™Ù][[Y[RY
šÛYQ™X]\™S[Ù[›ÙHŠNÂˆYŠX›Ş]]_X›ÙJ^È™]\›ˆ[ÈBˆ™]\›ˆÛ[Ù[›Ş]K›Ù_NÂˆB‚ˆ[˜İ[Ûˆ™\ÛÛ™PÛÛ™šYİ\™Y\›
˜[YJ^ÂˆÛÛœİ˜]ÏTİš[™Ê˜[Y_ˆŠKš[J
NÂˆYŠ\˜]Ê^È™]\›ˆˆÈBˆ^ÂˆÛÛœİ\›[™]ÈT“
˜]ËÚ[™İË›ØØ][Û‹š™YŠNÂˆ™]\›ˆ\›œ›İØÛÛOOHšÎˆŸ\›œ›İØÛÛOOHšˆˆÈ\›š™YˆˆˆÂˆXØ]Ú
Ê^Âˆ™]\›ˆˆÂˆBˆB‚ˆ[˜İ[ÛˆÛÛ™šYİ\™TÛXŞP]ÛŠ]Û’YÛÛ™šYİ\™Y\›ÙÓX™[
^ÂˆÛÛœİ]ÛYØİ[Y[™Ù][[Y[RY
]Û’Y
NÂˆYŠX]ÛŠ^È™]\›ÈBˆÛÛœİ\›\™\ÛÛ™PÛÛ™šYİ\™Y\›
ÛÛ™šYİ\™Y\›
NÂˆYŠ]\›
^Âˆ]Û‹™\ØX›Y]YNÂˆ]Û‹]OH•Ñûï&¹o¡y£©y«hùo#ÈŠİÙÓX™[
Èºh zghˆÂˆ™]\›ÂˆBˆ]Û‹™\ØX›YY˜[ÙNÂˆ]Û‹]OHˆÂˆ]Û‹˜Y]™[\İ[™\Š˜ÛXÚÈ‹[˜İ[ÛŠ
^ÂˆÚ[™İË›Ü[Š\›—Ø›[šÈ‹››ÛÜ[™\‹›Ü™Y™\œ™\ˆŠNÂˆJNÂˆB‚ˆ[˜İ[Ûˆ™[™\Yœ™YTÙ\šXÙP›ÙJ›ÙJ^ÂˆÛÛœİÛÛ™šYÏY[œİ\™PYœ™YPÛÛ™šYÊ
NÂˆÛÛœİÛÛ™šYİ\™Y[XZ[Tİš[™ÊÛÛ™šYËœİ\Ü[XZ[ˆŠKš[J
NÂˆ›ÙKš[›™\’SVÂˆ	ÏÙXİ[ÛˆÛ\ÜÏH˜YYœ™YK\Ù\šXÙK\[™[ˆ]KXYYœ™YK\Ù\šXÙKZ[™›ÏHYH‰Ëˆ	Ï]ˆÛ\ÜÏH˜YYœ™YK\Ù\šXÙKZ\›È‰Ëˆ	Ï]ˆÛ\ÜÏH˜YYœ™YK\Ù\šXÙK\İX]HŒÌ9i*yacynèùdb¹§#ybæOÙ]‰Ëˆ	Ï]ˆÛ\ÜÏH˜YYœ™YK\Ù\šXÙK\šXÙHˆ\šXK[X™[H¹`îy¨/•	NH“•	NOÙ]‰Ëˆ	Ï]ˆÛ\ÜÏH˜YYœ™YK\Ù\šXÙKX˜YÙH¹e«¹«(z,ï:,­øàîúggº!ê¹båyî£:* Ù]‰Ëˆ	ÏÙ]‰Ëˆ	Ï]ˆÛ\ÜÏH˜YYœ™YK\Ù\šXÙKXÛÜH‰Ëˆ	Ï¹. 9«(y.æ9«/»ï#9£ä9/¦ÈÌ9i*yacynèùdb¹«"¹æâ¸à Ü‰Ëˆ	Ï¹§+9§#ybæyà®¹e«¹«(z,ï:,­ûï#9.#y§ ú!ê¹båyî£:* ¸à Ü‰Ëˆ	Ïº,ï:,­ù¢$9b§ùo£;ï#9acynèùdb¹«"¹æâ¹l!ùí yk¦¹ãªyk­¹n,ú&gûï#:!ê¹.æ9«/¹¢$9b§ú-mùå'ù¥bÌ9i*xà Ü‰Ëˆ	Ï¹«i9§#ybæy.#y£ä9/¦úhcyi%º)äº"l¸à z(çy`¦xà z ïyb¦øà z`b¹¢,¹nhù¢%¹am¹.å¹¢,9b¦ùb¨9¢$8à Ü‰Ëˆ	ÏÙ]‰Ëˆ	ÏÙXİ[ÛˆÛ\ÜÏH˜YYœ™YK\Ù\šXÙK\İ\Üˆ\šXK[X™[H¹k¨¹§#z"!ù¨§y«/ˆ‰Ëˆ	Ï]ˆÛ\ÜÏH˜YYœ™YK\Ù\šXÙK\İ\Ü\›İÈ‰Ëˆ	ÏÜ[¹k¨¹§#H[XZ[;ï&ÜÜ[‰Ëˆ	ÏˆYH˜Yœ™YTİ\Ü[XZ[‰ÊØÛÛ™šYİ\™Y[XZ[
ÉÏØ‰Ëˆ	ÏÙ]‰Ëˆ	Ï]ˆÛ\ÜÏH˜YYœ™YK\Ù\šXÙK\ÛXŞKXXİ[ÛœÈ‰Ëˆ	Ï]ÛˆYH˜Yœ™YT™Y[™ÛXŞP]Ûˆˆ\OH˜]Ûˆ¹§éyç"ú` 9«/º)£ùbaÏØ]Û‰Ëˆ	Ï]ÛˆYH˜Yœ™YU\›\Ğ]Ûˆˆ\OH˜]Ûˆ¹§éyç"ù§#ybæy¨§y«/Ø]Û‰Ëˆ	Ï]ÛˆYH˜Yœ™YTš]˜XŞP]Ûˆˆ\OH˜]Ûˆ¹§éyç"úf¬yéày«"¹¥/ùëeØ]Û‰Ëˆ	ÏÙ]‰Ëˆ	ÏÛ\ÜÏH˜YYœ™YK\Ù\šXÙK]ÙË[›İHº` 9«/º)£ùbaøà y§#ybæy¨§y«/º"!úf¬yéày«"¹¥/ùëeºh zgh¹l&¹o¡z*+yk¦»ï&ù§*º*+yk¦¹bcy.#y§ ùl#¹d$y.#ykf9g*9æ¡9í¬¹g`8à Ü‰Ëˆ	ÏÜÙXİ[Û‰Ëˆ	Ï]ˆÛ\ÜÏH˜YYœ™YK\Ù\šXÙKXXİ[ÛœÈ‰Ëˆ	Ï]ÛˆYH˜Yœ™YT\˜Ú\ÙP]ÛˆˆÛ\ÜÏH˜YYœ™YK\Ù\šXÙK\\˜Ú\ÙHˆ\OH˜]Ûˆˆ\ØX›Y\šXK[X™[Hº,ï:,­ÈÌ9i*yacynèùdbˆ•	N{ï#9æë¹bcy.æ9«/¹§#ybæy®¥¹`¦y.+H¹.æ9«/¹§#ybæy®¥¹`¦y.+OØ]Û‰Ëˆ	Ï]ÛˆYH˜Yœ™YPXÚÛ›İÛYÙP]ÛˆˆÛ\ÜÏH˜YYœ™YK\Ù\šXÙKXXÚÛ›İÛYÙHˆ\OH˜]Ûˆ¹¢$yçéz`dù.¡Ø]Û‰Ëˆ	ÏÙ]‰Ëˆ	ÏÜÙXİ[Û‰ÂˆKš›Ú[ŠˆŠNÂ‚ˆÛÛœİİ\Ü[XZ[YØİ[Y[™Ù][[Y[RY
˜Yœ™YTİ\Ü[XZ[ŠNÂˆYŠİ\Ü[XZ[
^Âˆİ\Ü[XZ[^ÛÛ[XÛÛ™šYİ\™Y[XZ[Âˆİ\Ü[XZ[™]\Ù]ÙÏH™˜[ÙHÂˆB‚ˆÛÛ™šYİ\™TÛXŞP]ÛŠ˜Yœ™YT™Y[™ÛXŞP]Ûˆ‹ÛÛ™šYËœ™Y[™ÛXŞU\›º` 9«/º)£ùbaÈŠNÂˆÛÛ™šYİ\™TÛXŞP]ÛŠ˜Yœ™YU\›\Ğ]Ûˆ‹ÛÛ™šYË\›\Õ\›¹§#ybæy¨§y«/ˆŠNÂˆÛÛ™šYİ\™TÛXŞP]ÛŠ˜Yœ™YTš]˜XŞP]Ûˆ‹ÛÛ™šYËœš]˜XŞTÛXŞU\›ºf¬yéày«"¹¥/ùëeˆŠNÂ‚ˆÛÛœİ\˜Ú\ÙP]ÛYØİ[Y[™Ù][[Y[RY
˜Yœ™YT\˜Ú\ÙP]ÛˆŠNÂˆÛÛœİ\˜Ú\ÙU\›\™\ÛÛ™PÛÛ™šYİ\™Y\›
ÛÛ™šYËœ\˜Ú\ÙU\›
NÂˆYŠ\˜Ú\ÙP]Û‰‰˜ÛÛ™šYËœ\˜Ú\ÙQ[˜X›YOO]YI‰œ\˜Ú\ÙU\›
^Âˆ\˜Ú\ÙP]Û‹™\ØX›YY˜[ÙNÂˆ\˜Ú\ÙP]Û‹^ÛÛ[Hº,ï:,­ÈÌ9i*yacynèùdbˆ•	NHÂˆ\˜Ú\ÙP]Û‹œÙ]]šX]J˜\šXK[X™[‹º,ï:,­ÈÌ9i*yacynèùdbˆ•	NHŠNÂˆ\˜Ú\ÙP]Û‹˜Y]™[\İ[™\Š˜ÛXÚÈ‹[˜İ[ÛŠ
^ÂˆÚ[™İË›Ü[Š\˜Ú\ÙU\›—Ø›[šÈ‹››ÛÜ[™\‹›Ü™Y™\œ™\ˆŠNÂˆJNÂˆB‚ˆÛÛœİXÚÛ›İÛYÙP]ÛYØİ[Y[™Ù][[Y[RY
˜Yœ™YPXÚÛ›İÛYÙP]ÛˆŠNÂˆYŠXÚÛ›İÛYÙP]ÛŠ^ÂˆXÚÛ›İÛYÙP]Û‹˜Y]™[\İ[™\Š˜ÛXÚÈ‹ÛÜÙPYœ™YTÙ\šXÙR[™›Ó[Ù[
NÂˆB‚ˆËÈÑÊPÔ^JNˆ9hjùaiy«hùo#ú` 9«/º)£ùbaøà y§#ybæy¨§y«/¸à zf¬yéày«"¹¥/ùëe¹í¬¹g`8à ‚ˆËÈÑÊPÔ^JNˆ9k£9¢$9í¨9åc9.æ9«/º"!ù.æ9«/¹íd9§§:jeú+byo£;ï#9¢cycëú*+yk¦ˆ\˜Ú\ÙQ[˜X›Y]YH:"!È\˜Ú\ÙU\›8à ‚ˆB‚ˆ[˜İ[ÛˆÜ[Yœ™YTÙ\šXÙR[™›Ó[Ù[

^ÂˆÛÛœİ\ÏYÙ][Ù[\Ê
NÂˆYŠ\\Ê^È™]\›ˆ˜[ÙNÈBˆYŠ\Ë›[Ù[˜Û\ÜÓ\İ˜ÛÛZ[œÊœÚİÈŠI‰ˆ\\Ë›[Ù[˜Û\ÜÓ\İ˜ÛÛZ[œÊQÑ”‘QWÓSÑWĞÓTÔÊJ^Âˆ™]\›ˆ˜[ÙNÂˆB‚ˆ\Ë]K^ÛÛ[H¸à"¹fæú,hy¬gù®e¹`¬øà"ÈÂˆ™[™\Yœ™YTÙ\šXÙP›ÙJ\Ë˜›ÙJNÂˆ\Ë˜›ÙKœØÜ›ÛÜLÂˆ\Ë›[Ù[˜Û\ÜÓ\İ˜Y
QÑ”‘QWÓSÑWĞÓTÔÊNÂˆ\Ë›[Ù[œÙ]]šX]Jœ›ÛH‹™X[ÙÈŠNÂˆ\Ë›[Ù[œÙ]]šX]J˜\šXK[[Ù[‹YHŠNÂˆ\Ë›[Ù[œÙ]]šX]J˜\šXK[X™[YH‹šÛYQ™X]\™S[Ù[]HŠNÂˆ\Ë›[Ù[˜Û\ÜÓ\İ˜Y
œÚİÈŠNÂˆ™]\›ˆYNÂˆB‚ˆ[˜İ[ÛˆÛÜÙPYœ™YTÙ\šXÙR[™›Ó[Ù[

^ÂˆÛÛœİ\ÏYÙ][Ù[\Ê
NÂˆYŠ\\ß\\Ë›[Ù[˜Û\ÜÓ\İ˜ÛÛZ[œÊQÑ”‘QWÓSÑWĞÓTÔÊJ^È™]\›ˆ˜[ÙNÈBˆYŠ\[ÙˆÚ[™İË˜ÛÜÙRÛYQ™X]\™OOOH™[˜İ[ÛˆŠ^ÂˆÚ[™İË˜ÛÜÙRÛYQ™X]\™J
NÂˆY[Ù^Âˆ\Ë›[Ù[˜Û\ÜÓ\İœ™[[İ™JœÚİÈŠNÂˆBˆ\Ë›[Ù[˜Û\ÜÓ\İœ™[[İ™JQÑ”‘QWÓSÑWĞÓTÔÊNÂˆ\Ë›[Ù[œ™[[İ™P]šX]Jœ›ÛHŠNÂˆ\Ë›[Ù[œ™[[İ™P]šX]J˜\šXK[[Ù[ŠNÂˆ\Ë›[Ù[œ™[[İ™P]šX]J˜\šXK[X™[YHŠNÂˆ™]\›ˆYNÂˆB‚ˆÚ[™İËQÑ”‘QWÔÑT•’PÑWÑTÔVWÔÓPÖOPQÑ”‘QWÑTÔVWÔÓPÖNÂˆÚ[™İË›Ü[Yœ™YTÙ\šXÙR[™›Ó[Ù[[Ü[Yœ™YTÙ\šXÙR[™›Ó[Ù[ÂˆÚ[™İË˜ÛÜÙPYœ™YTÙ\šXÙR[™›Ó[Ù[XÛÜÙPYœ™YTÙ\šXÙR[™›Ó[Ù[Â‚‚ˆ[˜İ[Ûˆ›Üİ\“[X™\Š˜[YJ^ÂˆÛÛœİ[X™\S[X™\Š˜[YJNÂˆ™]\›ˆ[X™\‹š\Ñš[š]J[X™\ŠOÛ[X™\ŒÂˆBˆ[˜İ[Ûˆ›Üİ\‘\ØØ\J˜[YJ^Âˆ™]\›ˆİš[™Ê˜[YOO[[Èˆ˜[YJBˆœ™\XÙJÉ‹ÙË‰˜[\ÈŠKœ™\XÙJÏÙË‰›ÈŠKœ™\XÙJÏ‹ÙË‰™İÈŠBˆœ™\XÙJ×‹ÙË‰œ][İÈŠKœ™\XÙJÉËÙË‰ˆÌÎNÈŠNÂˆBˆ[˜İ[Ûˆ›Üİ\”™\Ûİ\˜ÙU^
˜[YJ^ÂˆÛÛœİÚÛOSX]›X^
X]™›ÛÜŠ›Üİ\“[X™\Š˜[YJJJNÂˆYŠÚÛOLL
^ÂˆÛÛœİÛÛ\Xİ]ÚÛKÌLÂˆ™]\›ˆÛÛ\XİÑš^Y
ÛÛ\XİLLÌNŒŠKœ™\XÙJ×Ì
ÉÙËˆŠJÈ¹a!ÂˆBˆYŠÚÛOLL
^È™]\›ˆX]™›ÛÜŠÚÛKÌL
JÈº$+ÈBˆ™]\›ˆÚÛKÓØØ[Tİš[™ÊšUÈŠNÂˆBˆ[˜İ[ÛˆŞ[˜Ô›Üİ\”™\Ûİ\˜ÙJ›ÙK˜[YJ^ÂˆYŠ[›ÙJ^È™]\››Â¶©	©íëmÊ—¨~Ê.­Ç¿ÂŠä²–œ{û­«\‡ıŸyÆºy­usÚÂÃh²ç!~)^¢·b­ç-¢¼›Â¶©	©íëmÊ—¨~Ê.­Ç¿ÂŠä²–œ{û­«\‡ıŸyÆºy­usÚÂÃh²ç!~)^¢·b­ç-¢¼