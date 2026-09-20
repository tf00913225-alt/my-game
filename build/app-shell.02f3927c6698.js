YªçŠx-®éÜj×¢ëiºÚ+Š§j[h‘éÜ¢éíß}û÷¼ë­4o+^²‰¢¶×
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
           çå‹µã€é€™é¡é‚è¼¯ç¾åœ¨å°±èƒ½æ¸¬è©¦ï¼Œ
           ä¸æ˜¯çœŸçš„å»£å‘Šã€‚
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

   é¢¨ç³»ã€Œé™ä½æ•æ·ï¼é™ä½æ‰€æœ‰èƒ½åŠ›å€¼ã€èˆ‡åœŸç³»ã€Œé™ä½é˜²ç¦¦ã€
   å…ˆå‰èƒ½å¯«é€² statusEffectsï¼Œä½†ç©å®¶æœ€çµ‚èƒ½åŠ›æ²’æœ‰å®Œæ•´è®€å–ï¼Œ
   é€ æˆæ€ªç‰©å°ç©å®¶æ–½æ”¾æ™‚çœ‹å¾—åˆ°æ–‡å­—ã€å¯¦éš›æ•¸å€¼å»æ²’æœ‰ä¸‹é™ã€‚

   é€™è£¡çµ±ä¸€è¦å‰‡ï¼š
   - statDown ç›´æ¥é™ä½å°æ‡‰å…­åœé»æ•¸ï¼›è‹¥æŠ€èƒ½æœ‰ excludedStatsï¼Œè©²å…­åœä¸é™ã€‚
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

const FINAL_EVASION_RATE_CAP=85;

/*
   é–ƒèº²ä¾†æºæ¡ç¨ç«‹æ©Ÿç‡ä¹˜ç®—ï¼Œä¸å†ç›´æ¥ç›¸åŠ æˆ–æ‹¿å»æ”¾å¤§æ•æ·é–ƒèº²å€¼ã€‚
   ä¾‹å¦‚é¢¨å…ƒç´ EX 35%èˆ‡é¢¨è¡Œ75%ï¼š1-(1-.35)*(1-.75)=83.75%ã€‚
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
        /* æš«æ™‚å…­åœæ¸›ç›Šä¸å‹•æ…‹å£“ç¸®æœ€å¤§HP/SPï¼›è©³è¦‹ä¸Šæ–¹çµ±ä¸€è¦å‰‡ã€‚ */
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
        description:"å°å–®é«”é€ æˆ120é»åŸºç¤å‚·å®³ï¼›65%æ©Ÿç‡ä½¿ç›®æ¨™æšˆçœ©2å›åˆï¼Œæœ€çµ‚å‘½ä¸­ç‡é¡å¤–é™ä½10%/20%/30%/40%/50%ã€‚",
        stunChance:65, missBonusByLevel:[10,20,30,40,50], stunDuration:2, requires:["stormFlurry"]
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
        description:"å°æ•µæ–¹å…¨é«”å„é€ æˆ48é»åŸºç¤æ³•è¡“å‚·å®³ï¼›35%æ©Ÿç‡æšˆçœ©1å›åˆï¼Œä½¿ç›®æ¨™MISSç‡æé«˜30%/45%/50%/55%/65%ã€‚",
        stunChance:35, missBonusByLevel:[30,45,50,55,65], stunDuration:1, requires:["windHowlLightning"]
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

const forestMonsters = [

    makeZoneMonster("å“¥å¸ƒæ—",3,"fire"),
    makeZoneMonster("å²èŠå§†",2,"water"),
    makeZoneMonster("å“¥å¸ƒæ—",3,"fire"),
    makeZoneMonster("å²èŠå§†",2,"water"),
    makeZoneMonster("å“¥å¸ƒæ—",3,"fire"),
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
   é è¨­é–ƒé¿ = min(30%, ç­‰ç´šÃ—0.3%)
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
       ï¼ˆé«”è³ªå·²ç¶“å›ºå®š10%ï¼Œä¸å†åƒèˆ‡é€™è£¡çš„
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
            Math.min(30,Math.max(0,Number(level)||0)*0.3),

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
   â˜… æ–°å¢ï¼šæŠŠrequiresé™£åˆ—è½‰æˆçµ¦ç©å®¶çœ‹çš„
   ä¸­æ–‡æç¤ºï¼Œä¾‹å¦‚ã€Œéœ€å…ˆå­¸ç¿’ï¼šæœƒå¿ƒä¸€æ“Šã€
   æˆ–ã€Œéœ€å…ˆå­¸ç¿’ï¼šç«çˆ†äº‚æ“Šæˆ–çƒˆç„°é¾æ²å…¶ä¸€ã€ï¼Œ
   æŠ“ä¸åˆ°æŠ€èƒ½åç¨±æ™‚ä¿åº•é¡¯ç¤ºidæœ¬èº«ï¼Œ
   é¿å…æ•´æ®µæ¶ˆå¤±è®“ç©å®¶ä¸€é ­éœ§æ°´ã€‚
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
        "éœ€å…ˆå­¸ç¿’ï¼š"+
        names.join("æˆ–")+
        (
            names.length>1
            ?
            "å…¶ä¸€"
            :
            ""
        )
    );

}


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


/* =====================================================
   è§’è‰²
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
    battleBeforeCombatantObservers.forEach(observer=>{
        try{ observer({token:token,turn:turn,index:initiativeIndex,queue:initiativeQueue}); }
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


    if(!window.FourSymbolsStartupPolicy||!wi×µçkh‘éì¶»§q«^v:ïš:'¦Z/¦‚·j•µ½©§¢Ş|(€€€€€€€€€€ƒ¦ëf÷¾ò3–>«Vg’â/ÒS’â·šZ–rÃ–r[–B7¢Ç(€€€€€€€€€€ƒ’æ’â7–7¢«–ŞÇ–*€‹Â~^ë¾â<€‹¦g–/–&7ÚÓ(€€€€€€€€¨¼((€€€€€€€é½¹•°¹Ñ•áÑ½¹Ñ•¹Ğô((€€€€€€€€€€€€¡½¹™¥œ¹Ñ¥Ñ±•ñğˆˆ¤(€€€€€€€€€€€€¹É•Á±…” (€€€€€€€€€€€€€€€€½yqL­qÌ¨¼°(€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€¤ì((€€€ô(((€€€€¼¨(€€€€€€ƒŠbƒ’ş»š¶¾ò#’úwŸ’öÿR£¢¢ššÆ¾ò33¢^7¢&Ëš†(€€€€€€ƒ–Û’î[¦÷’â7¢š73š¦c¢&Ë¦£–"–>¿’î—š.ÿš:'7¾ò'¾òh(€€€€€€ƒ¶'Òk¾–r7šZ–¶_š«&§šâ–Z»š†¾ò3–§–/¦ô(€€€€€€ƒšVÓ–/’â7–7¦†¿’ëŠSŠQµ…Á!•…‘•É5½¹ÍÑ•É%¹™¼(€€€€€€ƒ¦g–/–’[–Æ“–ºç–f£šr³’ú–ÂÇ–r£’â+¦v‹j¥Í5…ÁA…”(€€€€€€ƒ–"“šZß–ò?¢‡¢Š¯¢¢·š"C’â–ºk¦jÇ¢^<(€€€€€€ƒ¾ò!‘¥ÍÁ±…äé¹½¹—¾ò'¾ò3¦g¢‡’â7R£–7¢fWB¾òl(€€€€€€ƒš«&§šâ–Z»š†¾ò!µ…Á5½¹ÍÑ•É1¥ÍÑ	½ã¾ò$(€€€€€€ƒj–Ÿ–ºç’æ’â7R£–7R‹R¾ò3nÓš:—’â7–¾¯–—(€€€€¨¼()ô(((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€ƒŠbƒšnÓšZÁU$(ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼()™Õ¹Ñ¥½¸ÕÁ‘…Ñ•U$ ¥ì((€€€ÕÁ‘…Ñ•!½µ•Q•ÍÑQ½½±Ì ¤ì((€€€€¼¨(€€€€€€ƒŠbƒš¾?š²‡šnÓšZÃV¯¦v‹šf¾ò3¦‚’úÿšª‹š~—’âš²„(€€€€€€ƒ¢6Kšòƒ–rÃ–âÛj¢¦:[.š/¢š’â7¢ššnÓšZÀ(€€€€€€ƒ¾ò#:§–ºÛ–6Òk¢Ş£¦91Ø¸ÄÇ¦
’â–"ï¾ò0(€€€€€€ƒŞÓ–*–6–"_¢†£¢š®/–"ï–>7šbƒ–ë’ú¾ò0(€€€€€€ƒ’â7R£&ç–rÃ¢ŞÏ¦‚š&7šnÓšZÃ¾ò'(€€€€¨¼((€€€ÕÁ‘…Ñ•QÉ…¥¹¥¹i½¹•1½­Ì ¤ì((€€€ÕÁ‘…Ñ•M•½¹‘¡…É…Ñ•É	…¹¹•È ¤ì(((€€€€¼¨(€€€€€€ƒŠbƒšZÃ–Š{¾ò#’úwŸ’öÿR£¢¢ššÆ¾ò3’âï–~;¦G–æŒ(€€€€€€ƒ¦†¿’ë¾ò'¾òk¦G–æšb¿–ÇR£¢ÎšêC¾ò3’îï’öWšf–d(€€€€€€ƒ¦÷–>¿¢÷¢º+–.W¾ò#¢Î¢w–
g¦‚c’îï–.d¿š"C–ÂÄ(€€€€€€ƒ6;–.×–V–ê_šÚ#¢Êï¾ò'¾ò1ÕÁ‘…Ñ•U$ §šr³’ú(€€€€€€ƒ–ÂÇšr–r£–ú#–’kšfš¦¦î{¢Š¯–Fó–>¯¾ò3’â¢ÖßšnÓšZÀ(€€€€€€ƒšr–Z»ÒS¾ò3’â7R£–>›–’[š&û–rÃšZç¦7¢’–"“šZß(€€€€¨¼((€€€ÕÁ‘…Ñ•½±‘¥ÍÁ±…ä ¤ì(((€€€€¼¨(€€€€€€ƒŠbƒšZÃ–Š{¾òk–rÃ–r[’â+:§–ºÛ–6‡&j–B7–¶\¿¶'Òh(€€€€€€ƒ¾ò#–2–B¯¢Ş¦j£šZç–†+¾ò'¢š¢Ş¢F_–B3š¶—šnÓšZÃ¾ò0(€€€€€€ƒ’â7Û–6Òk’æ/–ú3–rÃ–r[’â+¦†¿’ëj¦
šb¿¢"+¶'Òk(€€€€¨¼((€€€ÕÁ‘…Ñ•5…ÁA±…å•É…É ¤ì(((€€€€¼¨(€€€€€€ƒŠbƒšZÃ–Š{¾òk–Ş‡¦
?¦‚¦v‹š¢g¦†3–"_jš«&§¢Î¢¢((€€€€€€ƒ¾ò#–B7¢Ä¿–Æ³šœ¿¢†¦<¿šV?š6ß¾ò'šr¦j£¢F_š"Ã¦²”(€€€€€€ƒ¦Ë¢†3¢º+–2[¾ò#š&Oš¶ï’â¦jïš>o’â/’â¦jï(€€€€€€ƒ¢†¦?šâo–ÂG¾ò'¾ò1ÕÁ‘…Ñ•U$ §šr³’ú–ÂÇšr–r (€€€€€€ƒ–ú#–’kšfš¦¢Š¯–Fó–>¯¾ò3’â¢ÖßšnÓšZÃ¾ò0(€€€€€€ƒ’â7R£–>›–’[š&û–rÃšZç¦7¢’–"“šZß(€€€€¨¼((€€€ÕÁ‘…Ñ•5…ÁA…•!•…‘•È ¤ì(((€€€€¼¨(€€€€€€ƒŠbƒšZÃ–Š{¾òkš"Ã¦²—’âµMC¢º+–2[¾ò#R£’êš*¢÷–Zw’ê¢^—šÂÓ¾ò$(€€€€€€ƒ¢š–6Ïšf–>7šbƒ–r£š*¢÷–ş¯š6ß–"_j–>¿R£.š/’â+¾ò0(€€€€€€ƒ’â7ÙMCš&–"Ã’â7–’ƒ’ê¾ò3š2'¦"W–6ï¦
’ê»¢F_¢÷¦î{(€€€€¨¼((€€€¥˜¡‰…ÑÑ±•Ñ¥Ù”¥ì((€€€€€€€Á½ÁÕ±…Ñ•M­¥±±EÕ¥­	…È ¤ì((€€€ô(((€€€½¹ÍĞÍÑ…ÑÌ€ô(€€€€€€€•Ñ5…¥¹¡…É…Ñ•ÉMÑ…ÑÌ ¤ì(((€€€€¼¨(€€€€€€ƒ–ššzs¢w–
gš"[¢÷–*ošRç¢º+¾ò0(€€€€€€!@½MC’â+¦fC¢º+–2[šf’â7¢š¢Ú–ë’â+¦fC(€€€€¨¼((€€€Á±…å•È¹¡À€ô(€€€€€€€5…Ñ ¹µ…à (€€€€€€€€€€€€À°(€€€€€€€€€€€5…Ñ ¹µ¥¸ (€€€€€€€€€€€€€€€Á±…å•È¹¡À°(€€€€€€€€€€€€€€€ÍÑ…ÑÌ¹µ…á!@(€€€€€€€€€€€€¤(€€€€€€€€¤ì(((€€€Á±…å•È¹ÍÀ€ô(€€€€€€€5…Ñ ¹µ…à (€€€€€€€€€€€€À°(€€€€€€€€€€€5…Ñ ¹µ¥¸ (€€€€€€€€€€€€€€€Á±…å•È¹ÍÀ°(€€€€€€€€€€€€€€€ÍÑ…ÑÌ¹µ…áM@(€€€€€€€€€€€€¤(€€€€€€€€¤ì(((€€€€ ‰Á±…å•É1•Ù•°ˆ¤(€€€€€€€€¹Ñ•áÑ½¹Ñ•¹Ğ€ô(€€€€€€€Á±…å•È¹±•Ù•°ì(((€€€€ ‰¡•…‘•É!@ˆ¤(€€€€€€€€¹Ñ•áÑ½¹Ñ•¹Ğ€ô(€€€€€€€Á±…å•È¹¡Àì(((€€€€ ‰¡•…‘•ÉM@ˆ¤(€€€€€€€€¹Ñ•áÑ½¹Ñ•¹Ğ€ô(€€€€€€€Á±…å•È¹ÍÀì(((€€€€¼¨(€€€€€€ƒŠbƒ’úwŸ:§–ºÛ¢ššÆ¾ò3’âï–~;¦š[¦‚j–º3šVÓ–Æ³šŸ–"_¢† (€€€€€€ƒ¾ò#šr–’!@½MC–·–r7¦bËš›–6Òk¦Ë–ê›¾ò$(€€€€€€ƒšVÓ–/š.ÿš:'’ê¾ò3¦g’êo¢Î¢¢+–r£3.š/7¦‚šr³’ú–ÂÇšr'¾ò0(€€€€€€ƒ¦š[¦‚¦7¢’¦†¿’ëšb¿–’k¦’cj¦ns¢¢+(€€€€€€ƒ¦g¢‡–:šr³–¾¯Ö˜€¡½µ•!@ƒ¶'–Òƒj¦
’êo¢†3’æ’â’ö×ï¦f“¾ò0(€€€€€€ƒ’â7Û–Òƒ’â7–¶c–r£’ê¾ò3æóê3–¾¯–—šrnÓš:—–fÓ¦2¿¾ò0(€€€€€€ƒ–Â;¢ÑÕÁ‘…Ñ•U$ §–ú3¦v‹jšvÇ¢–ÿ–£¦£’â7šr–~ß¢†3(€€€€¨¼(((€€€¥˜ (€€€€€€€€ ‰¥Ñ•µ5•¹Ôˆ¤€˜˜(€€€€€€€€ ‰¥Ñ•µ5•¹Ôˆ¤¹±…ÍÍ1¥ÍĞ¹½¹Ñ…¥¹Ì ‰Í¡½Üˆ¤(€€€€¥ì(€€€€€€€É•¹‘•É	…ÑÑ±•A½Ñ¥½¹5•¹Ô ¤ì(€€€ô(((€€€€ ‰Í­¥±±A½¥¹ÑÌˆ¤(€€€€€€€€¹Ñ•áÑ½¹Ñ•¹Ğ€ô((€€€€€€€€ (€€€€€€€€€€€•ÑM­¥±±¡…É…Ñ•É=‰©•Ğ (€€€€€€€€€€€€€€€ÕÉÉ•¹ÑM­¥±±¡…É…Ñ•È(€€€€€€€€€€€€¥ñğ(€€€€€€€€€€€Á±…å•È(€€€€€€€€¤¹Í­¥±±A½¥¹ÑÌì(((€€€€¼¨(€€€€€€ƒÚO¦¦_šÆƒ¦†¿’è(€€€€¨¼((€€€€ ‰Í¡…É•‘áÁY…±Õ”ˆ¤(€€€€€€€€¹Ñ•áÑ½¹Ñ•¹Ğ€ô(€€€€€€€5…Ñ ¹µ…à À±5…Ñ ¹™±½½È¡9Õµ‰•È¡Í¡…É•‘áÀ¥ñğÀ¤¤(€€€€€€€€€€€€¹Ñ½1½…±•MÑÉ¥¹œ ‰é µQ\ˆ¤ì(((€€€É•¹‘•ÉáÁ¥ÍÑÉ¥‰ÕÑ•1¥ÍĞ ¤ì(((€€€€¼¨(€€€€€€ƒ.š/¦‚(€€€€¨¼((€€€ÕÁ‘…Ñ•MÑ…ÑÕÍAÉ•Ù¥•Ü ¤ì(((€€€€¼¨(€€€€€€ƒš"Ã¦²—’â·j¢†šŠt(€€€€¨¼((€€€¥˜¡‰…ÑÑ±•Ñ¥Ù”¥ì((€€€€€€€ÕÉÉ•¹Ñ	…ÑÑ±•5½¹ÍÑ•ÉÌ(€€€€€€€€¹™½É…  (€€€€€€€€€€€¥¹‘•àôùì(€€€€€€€€€€€€€€€ÕÁ‘…Ñ•5½¹ÍÑ•ÉU$ (€€€€€€€€€€€€€€€€€€€¥¹‘•à(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô(€€€€€€€€¤ì(((€€€€€€€ÕÁ‘…Ñ•	…ÑÑ±•A±…å•É	…ÉÌ ¤ì((€€€€€€€½¹ÍĞ‰½ÍÍAÉ•Í•¹Ñ…Ñ¥½¹=İ¹•ÈõÑåÁ•½˜İ¥¹‘½Ü„ôô‰Õ¹‘•™¥¹•ˆıİ¥¹‘½Ü¹½ÕÉMåµ‰½±Í	½ÍÍ	…ÑÑ±”é¹Õ±°ì(€€€€€€€¥˜¡‰½ÍÍAÉ•Í•¹Ñ…Ñ¥½¹=İ¹•È˜™ÑåÁ•½˜‰½ÍÍAÉ•Í•¹Ñ…Ñ¥½¹=İ¹•È¹Íå¹!Õôôô‰™Õ¹Ñ¥½¸ˆ¥ì(€€€€€€€€€€€‰½ÍÍAÉ•Í•¹Ñ…Ñ¥½¹=İ¹•È¹Íå¹!Õ ¤ì(€€€€€€€ô((€€€ô()ô(((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€ƒŠbƒ¢«–.W–¶cšªP((€€ƒ¦f“’ê–:šr³–r£&ç–ºk–.W’ös¦î{¾ò#–6Òk¢w–
gš"Ã¦²—–.w–"§Š›¾ò$(€€ƒšr–¶cšªS’æ/–’[¾ò3¦g¢‡–7–*ƒ–§–Æ“’şw¦j«¾òh((€€€Ä¸ƒš¾<€ÈÀƒK–ºkšf¢«–.W–¶c’âš²‡¾ò0(€€€€€ƒ’â›–r£V¯¦v‹–>Ï’â/¢K~·šj¯¦†¿’ë3Â~Jøƒ–ŞË¢«–.W–¶cšªS7¾ò0(€€€€€ƒ¢ºO:§–ºÛ~—¦Orjšr'–r£–¶c¾ò3’â7šb¿šG¦ëšRû–ş((€€€È¸ƒ–"–"Ã¢3šf¿¾ò#–"ÁÃ–"–"¦‚¢z‹–æW¦:[–ºk¾ò$(€€€€€ƒjVÛ’â/®/–"ï–¶c’âš²‡¾ò0(€€€€€ƒ¦gšb¿šr–ºçšbOšò?š:'¦Ë–ê›jššÎŠSŠP(€€€€€ƒ:§–ºÛ–ú#–>¿¢÷ªÛ¢Š¯¦nï¢¦Çš&OšZß(€€€€€ƒš"[nÓš:—–"–ë–:ï–ny1%9¾ò0(€€€€€ƒ¦gšf–g’â7¢÷–>«¦v€ÈÃKj–ºkšf–f£((€€ƒ–§¢»ššÎ¦÷–Fó–>¯–B3’â–,…ÕÑ½M…Ù•9½Ü §¾ò0(€€ƒ–Ÿ¦£šr³¢ê¯šr%ÑÉä½…Ñ£¾ò0(€€ƒ–¶cšªS–’ÇšV_’â7šr¢ºO¦+š"ËVÛš:'¾ò0(€€ƒ–>«šr–r¡½¹Í½±—Vg’â/¦2¿¢ª“¢¢+š¿šZç’úÿ’æ/–ú3¦f“¦2¿(ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼()±•Ğ…ÕÑ½Í…Ù•%¹‘¥…Ñ½ÉQ¥µ•Èõ¹Õ±°ì()±•Ğ…ÕÑ½Í…Ù•%¹Ñ•ÉÙ…±%õ¹Õ±°ì(()™Õ¹Ñ¥½¸¥Í…µ•MÑ…ÉÑ• ¥ì((€€€É•ÑÕÉ¸€„„ (€€€€€€€Á±…å•È€˜˜(€€€€€€€Á±…å•È¹¥(€€€€¤ì()ô(()™Õ¹Ñ¥½¸Í¡½İÕÑ½Í…Ù•%¹‘¥…Ñ½È ¥ì((€€€½¹ÍĞ•°€ô(€€€€€€€€ ‰…ÕÑ½Í…Ù•%¹‘¥…Ñ½Èˆ¤ì(((€€€¥˜ …•°¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€•°¹±…ÍÍ1¥ÍĞ¹…‘ (€€€€€€€€‰Í¡½Üˆ(€€€€¤ì(((€€€±•…ÉQ¥µ•½ÕĞ (€€€€€€€…ÕÑ½Í…Ù•%¹‘¥…Ñ½ÉQ¥µ•È(€€€€¤ì(((€€€…ÕÑ½Í…Ù•%¹‘¥…Ñ½ÉQ¥µ•È€ô(€€€€€€€Í•ÑQ¥µ•½ÕĞ  ¤ôùì((€€€€€€€€€€€•°¹±…ÍÍ1¥ÍĞ¹É•µ½Ù” (€€€€€€€€€€€€€€€€‰Í¡½Üˆ(€€€€€€€€€€€€¤ì((€€€€€€€ô°ÄØÀÀ¤ì()ô(()™Õ¹Ñ¥½¸…ÕÑ½M…Ù•9½Ü¡Í¡½İ%¹‘¥…Ñ½È¥ì((€€€¥˜ …¥Í…µ•MÑ…ÉÑ• ¤¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€ÑÉåì((€€€€€€€Í…Ù•…µ” ¤ì(((€€€€€€€¥˜¡Í¡½İ%¹‘¥…Ñ½È¥ì((€€€€€€€€€€€Í¡½İÕÑ½Í…Ù•%¹‘¥…Ñ½È ¤ì((€€€€€€€ô((€€€ô(€€€…Ñ ¡•ÉÉ½È¥ì((€€€€€€€½¹Í½±”¹•ÉÉ½È (€€€€€€€€€€€€‹¢«–.W–¶cšªS–’ÇšV_¾òhˆ°(€€€€€€€€€€€•ÉÉ½È(€€€€€€€€¤ì((€€€ô()ô(()™Õ¹Ñ¥½¸ÍÑ…ÉÑÕÑ½M…Ù” ¥ì((€€€¥˜¡…ÕÑ½Í…Ù•%¹Ñ•ÉÙ…±%¥ì((€€€€€€€±•…É%¹Ñ•ÉÙ…° (€€€€€€€€€€€…ÕÑ½Í…Ù•%¹Ñ•ÉÙ…±%(€€€€€€€€¤ì((€€€ô(((€€€€¼¨(€€€€€€ƒš¾<ÈÃK–ºkšf–¶cšªS¾ò0(€€€€€€ƒ–>«šr'rš¶¦Z/–/¦+š"Ë¾ò#–ŞË–&×¢K¾ò'š&7šr–¾›¦jo–¾¯–—¾ò0(€€€€€€ƒ¦
–r£–&×¢KV¯¦v‹šf¦g¢‡šrnÓš:—¢ŞÏ¦;(€€€€¨¼((€€€…ÕÑ½Í…Ù•%¹Ñ•ÉÙ…±%€ô(€€€€€€€Í•Ñ%¹Ñ•ÉÙ…°  ¤ôùì((€€€€€€€€€€€…ÕÑ½M…Ù•9½Ü¡ÑÉÕ”¤ì((€€€€€€€ô°ÈÀÀÀÀ¤ì(((€€€€¼¨(€€€€€€ƒ–"–"Ã¢3šf¿¾ò?–"–"¦‚šf®/–"ï–¶c’âš²‡(€€€€€€ƒ’â7¦†¿’ëš>C’ë¾ò3–nƒ
ëV¯¦v‹¦gšf–d(€€€€€€ƒ:§–ºÛ¦k–âã–ŞËÚOr/’â7–"Ã’ê(€€€€¨¼((€€€‘½Õµ•¹Ğ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È (€€€€€€€€‰Ù¥Í¥‰¥±¥Ñå¡…¹”ˆ°(€€€€€€€€ ¤ôùì((€€€€€€€€€€€¥˜¡‘½Õµ•¹Ğ¹¡¥‘‘•¸¥ì((€€€€€€€€€€€€€€€…ÕÑ½M…Ù•9½Ü¡™…±Í”¤ì(((€€€€€€€€€€€€€€€€¼¨(€€€€€€€€€€€€€€€€€€ƒŠbƒšZÃ–Š{¾ò#’úwŸ’öÿR£¢–n{–‚Ç¾ò0(€€€€€€€€€€€€€€€€€€ƒ3–"–"Ã¢3šf¿–7–"–n{’ú–"Ã–êWšr'šÊKšr$(€€€€€€€€€€€€€€€€€€ƒº_¦n‹ŞkÚO¦¦_7¾ò'¾òk–"–"Ã¢3šf¿j(€€€€€€€€€€€€€€€€€€ƒVÛ’â/¾ò3¢¢c¦2¦g–/šf¦ZO¦î{¾ò3¶$(€€€€€€€€€€€€€€€€€€ƒ–"–n{–&7šf¿šfš&7~—¦O¢š–ú{¦g¢„(€€€€€€€€€€€€€€€€€€ƒ¦Z/–/º_3¦n‹¦Z/’ê–’k’æ7(€€€€€€€€€€€€€€€€¨¼((€€€€€€€€€€€€€€€±…ÍÑ=™™±¥¹•¡•­Q¥µ•ÍÑ…µÀô(€€€€€€€€€€€€€€€€€€€…Ñ”¹¹½Ü ¤ì((€€€€€€€€€€€ô(€€€€€€€€€€€•±Í•ì((€€€€€€€€€€€€€€€€¼¨(€€€€€€€€€€€€€€€€€€ƒŠbƒšZÃ–Š{¾òk–"–n{–&7šf¿šf¾ò3R£–&o–&l(€€€€€€€€€€€€€€€€€€ƒ–"–"Ã¢3šf¿¢¢c¦2jšf¦ZO¦î{¾ò3º_–è(€€€€€€€€€€€€€€€€€€ƒ¦gšº×¦n‹Şkšf¦ZO–Â7š'j¦n‹ŞkÚO¦¦_ŠSŠP(€€€€€€€€€€€€€€€€€€ƒ¦gš¢’â7R£šVÓ–/¦7šZÃšVÓB¦‚¦v‹(€€€€€€€€€€€€€€€€€€ƒ–Z»ÒS–"¢3šf¿–7–"–n{’ú–ÂÇšrrj(€€€€€€€€€€€€€€€€€€ƒº_–"Ã¾ò3–n{¶S’ê’öÿR£¢jZG–V?(€€€€€€€€€€€€€€€€¨¼((€€€€€€€€€€€€€€€…±Õ±…Ñ•=™™±¥¹•áÁM¥¹” (€€€€€€€€€€€€€€€€€€€±…ÍÑ=™™±¥¹•¡•­Q¥µ•ÍÑ…µÀ(€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€±…ÍÑ=™™±¥¹•¡•­Q¥µ•ÍÑ…µÀô(€€€€€€€€€€€€€€€€€€€…Ñ”¹¹½Ü ¤ì(((€€€€€€€€€€€€€€€€¼¨(€€€€€€€€€€€€€€€€€€ƒŠbƒšZÃ–Š{¾ò#’úwŸ’öÿR£¢¢ššÆ¾ò3–b_¢¦›¢fWB(€€€€€€€€€€€€€€€€€€ƒ3â»–Â?¢š[ª\¿–"–"Ã¢3šf¿–7š&O¦Z/šr–6‡’ö?4(€€€€€€€€€€€€€€€€€€ƒj–V?¦†3¾ò'¾òh(€€€€€€€€€€€€€€€€€€ƒ’æ/–&7¦g¢‡–>«¢fWB’ê3–"–ë–:ï7j(€€€€€€€€€€€€€€€€€€ƒ¦
’â–6+¾ò#–¶cšªS¾ò'¾ò3–º3–£šÊKšr'¢fWB(€€€€€€€€€€€€€€€€€€ƒ3–"–n{’ú7¢¦Ëš;¦êóš‹–ú§ŠSŠSš&/š¦?¢š÷–f (€€€€€€€€€€€€€€€€€€ƒ–r£¢3šf¿šfšr–’Ÿ–æ¦f7’ö;Rk¢Ïšj¯–s¢¢#šf–f (€€€€€€€€€€€€€€€€€€ƒj–~ß¢†3¦–ê›¾ò3–n{–"Ã–&7šf¿jšf–g¾ò0(€€€€€€€€€€€€€€€€€€ƒ¦+š"Ë–Ÿ¦£j–n{–B#¢¢#šf–f£(€€€€€€€€€€€€€€€€€€Í•ÑQ¥µ•½ÕÓš:K¢/–ú#–>¿¢÷–ŞËÚO¢Ş|(€€€€€€€€€€€€€€€€€€ƒ–¾›¦joÚO¦;jšf¦ZO–Â7’â7’â+¾ò3¢º+š"C–6‡’ö<(€€€€€€€€€€€€€€€€€€ƒ’â7–.Wjš¢–¶C((€€€€€€€€€€€€€€€€€€ƒ¦g¢‡šÊK¢ú›šÎW’şw¢¶$ÄÀÀ—’ş»––÷š¾?’â¢¸(€€€€€€€€€€€€€€€€€€ƒ–6‡’ö?jššÎ¾ò#¢3šf¿¦fC–"Ûšb¿?¢š÷–f (€€€€€€€€€€€€€€€€€€ƒ–Æ“Òkj¾ò3šr³’ú–ÂÇšr'’êo.šÎšÊK¢ú›šÎT(€€€€€€€€€€€€€€€€€€ƒ–º3–£¦ÿ–7¾ò'¾ò3’ö¢Ï–ÂG–k’ê’â–,(€€€€€€€€€€€€€€€€€€ƒ–B#Bj¢sšVG¾òk–n{–"Ã–&7šf¿šf¾ò3–ššzp(€€€€€€€€€€€€€€€€€€ƒš"Ã¦²—¦
–r£¦Ë¢†3¢ò«–"Ã¦r¢š:§–ºÛ¢«–ŞÄ(€€€€€€€€€€€€€€€€€€ƒ¦ãšNj¢K¢&Ë¾ò3¦7šZÃšVÓB’âš²‡–KšVã¢¢#šf(€€€€€€€€€€€€€€€€€€ƒ¾ò#Ö›’â–/–£šZÃjÈÃK¾ò3¢3’â7šb¿–îÛê0(€€€€€€€€€€€€€€€€€€ƒ’â–/–>¿¢÷–ŞËÚO–r£¢3šf¿¢ŞG–º3j¢"+–KšVã¾ò'¾ò0(€€€€€€€€€€€€€€€€€€ƒ’â›’âS¦7šZÃšVÓB’âš²‡V¯¦v‹¦†¿’ë¾ò0(€€€€€€€€€€€€€€€€€€ƒ¦f7’ö;–6‡’ö?jš¦:(€€€€€€€€€€€€€€€€¨¼((€€€€€€€€€€€€€€€¥˜ (€€€€€€€€€€€€€€€€€€€‰…ÑÑ±•Ñ¥Ù”€˜˜(€€€€€€€€€€€€€€€€€€€‰…ÑÑ±•A¡…Í”ôôô(€€€€€€€€€€€€€€€€€€€€‰‘•±…É”ˆ(€€€€€€€€€€€€€€€€¥ì((€€€€€€€€€€€€€€€€€€€½¹ÍĞ…ÕÑ½=¸ô(€€€€€€€€€€€€€€€€€€€€€€€…Ñ¥Ù•	…ÑÑ±•¡…É…Ñ•É%¹‘•àôôôÀ(€€€€€€€€€€€€€€€€€€€€€€€€ü…ÕÑ½	…ÑÑ±”(€€€€€€€€€€€€€€€€€€€€€€€€è•ÑA…ÉÑåÕÑ½½¹™¥œ¡…Ñ¥Ù•	…ÑÑ±•¡…É…Ñ•É%¹‘•à¤¹•¹…‰±•ì(((€€€€€€€€€€€€€€€€€€€¥˜ ……ÕÑ½=¸¥ì((€€€€€€€€€€€€€€€€€€€€€€€Ñ¥µ•ÈôÈÀì((€€€€€€€€€€€€€€€€€€€€€€€ÕÁ‘…Ñ•Q¥µ•È ¤ì((€€€€€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€ô(((€€€€€€€€€€€€€€€¥˜¡‰…ÑÑ±•Ñ¥Ù”¥ì((€€€€€€€€€€€€€€€€€€€ÕÁ‘…Ñ•U$ ¤ì((€€€€€€€€€€€€€€€ô((€€€€€€€€€€€ô((€€€€€€€ô(€€€€¤ì(((€€€€¼¨(€€€€€€ƒ¦^s¦Z'–"¦‚¾ò?¦7šZÃšVÓB–&7n‡¦?–¶c’âš²‡(€€€€€€ƒš&/š¦?¢š÷–f£’â7’â–ºkšrŠë–¾›¢ãfó¦g–/’ê/’îÛ¾ò0(€€€€€€ƒ’ö–*ƒ’ê–º3–£‡–ºÏ¾ò3–’k’â–Æ“’şw¦j«(€€€€¨¼((€€€İ¥¹‘½Ü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È (€€€€€€€€‰‰•™½É•Õ¹±½…ˆ°(€€€€€€€€ ¤ôùì((€€€€€€€€€€€…ÕÑ½M…Ù•9½Ü¡™…±Í”¤ì((€€€€€€€ô(€€€€¤ì()ô(((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€ƒ–"w–/–2X(ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼()ÑÉåì((€€€É•‰Õ¥±‘%¹Ù•¹Ñ½ÉåM±½ÑÌ ¤ì((€€€ÕÁ‘…Ñ•É•…Ñ¥½¹U$ ¤ì((€€€É•¹‘•ÉM­¥±±1½…‘½ÕĞ ¤ì((€€€É•¹‘•É%¹Ù•¹Ñ½Éä ¤ì((€€€ÕÁ‘…Ñ•A±…å•É!•…‘•È ¤ì((€€€ÕÁ‘…Ñ•U$ ¤ì()ô)…Ñ ¡•ÉÉ½È¥ì((€€€½¹Í½±”¹•ÉÉ½È (€€€€€€€€‹¦+š"Ë–"w–/–2[fóR¦2¿¢ª“¾òhˆ°(€€€€€€€•ÉÉ½È(€€€€¤ì()ô(((¼¨5½‰¥±”¡…É‘İ…É”½‰É½İÍ•È	…¬Õ…É¸Q¡”™¥ÉÍĞ	…¬ÁÉ•ÍÌ…Í­Ì™½È(€€½¹™¥Éµ…Ñ¥½¸ì½¹™¥Éµ¥¹œÁ•É™½ÉµÌÑ¡”É•…°¹…Ù¥…Ñ¥½¸°…¹•±±¥¹œ­••ÁÌ(€€Ñ¡”Á±…å•È¥¸Ñ¡”…µ”¸€¨¼(¡™Õ¹Ñ¥½¸¥¹ÍÑ…±±5½‰¥±•	…­½¹™¥Éµ…Ñ¥½¸ ¥ì((€€€±•Ğ…±±½İ¥¹á¥Ğõ™…±Í”ì(€€€±•Ğ•á¥ÑAÉ½µÁÑ=Á•¸õ™…±Í”ì((€€€İ¥¹‘½Ü¹…±±½İ…µ•9…Ù¥…Ñ¥½¸ô ¤ôùì(€€€€€€€…±±½İ¥¹á¥ĞõÑÉÕ”ì(€€€ôì((€€€ÑÉåì(€€€€€€€¡¥ÍÑ½Éä¹ÁÕÍ¡MÑ…Ñ”¡íÉÁá¥ÑÕ…ÉéÑÉÕ•ô°ˆˆ±±½…Ñ¥½¸¹¡É•˜¤ì(€€€ô(€€€…Ñ ¡•ÉÉ½È¥ì(€€€€€€€½¹Í½±”¹İ…É¸ ‹‡šÎW–îë®/¢şS–n{¦bË–FÒ¦2¾òhˆ±•ÉÉ½È¤ì(€€€ô((€€€İ¥¹‘½Ü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰Á½ÁÍÑ…Ñ”ˆ±…Íå¹Œ ¤ôùì(€€€€€€€¥˜¡…±±½İ¥¹á¥Ğ¥ìÉ•ÑÕÉ¸ìô((€€€€€€€€¼¨9…Ñ¥Ù”½¹™¥É´ÕÍ•Ñ¼‰±½¬‰É½İÍ•È¡¥ÍÑ½Éäİ¡¥±”¥Ğİ…Ì½Á•¸¸(€€€€€€€€€€Q¡”IA‘¥…±½œ¥Ì…Íå¹¡É½¹½ÕÌ°Í¼¥µµ•‘¥…Ñ•±äÉ•ÍÑ½É”„Õ…É(€€€€€€€€€€•¹ÑÉä‰•™½É”…İ…¥Ñ¥¹œÑ¡”Á±…å•ÈÌ¡½¥”¸€¨¼(€€€€€€€±•ĞÕ…É‘I•ÍÑ½É•õ™…±Í”ì(€€€€€€€ÑÉåì(€€€€€€€€€€€¡¥ÍÑ½Éä¹ÁÕÍ¡MÑ…Ñ”¡íÉÁá¥ÑÕ…ÉéÑÉÕ•ô°ˆˆ±±½…Ñ¥½¸¹¡É•˜¤ì(€€€€€€€€€€€Õ…É‘I•ÍÑ½É•õÑÉÕ”ì(€€€€€€€õ…Ñ ¡|¥ìô((€€€€€€€¥˜ (€€€€€€€€€€€İ¥¹‘½Ü¹½ÕÉMåµ‰½±ÍI•±•…Í•UÁ‘…Ñ”˜˜(€€€€€€€€€€€ÑåÁ•½˜İ¥¹‘½Ü¹½ÕÉMåµ‰½±ÍI•±•…Í•UÁ‘…Ñ”¹¥Í½É•‘UÁ‘…Ñ•	±½­¥¹œôôô‰™Õ¹Ñ¥½¸ˆ˜˜(€€€€€€€€€€€İ¥¹‘½Ü¹½ÕÉMåµ‰½±ÍI•±•…Í•UÁ‘…Ñ”¹¥Í½É•‘UÁ‘…Ñ•	±½­¥¹œ ¤(€€€€€€€€¥ì(€€€€€€€€€€€İ¥¹‘½Ü¹½ÕÉMåµ‰½±ÍI•±•…Í•UÁ‘…Ñ”¹…¹¹½Õ¹•½É•‘1½¬ ¤ì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€ô((€€€€€€€¥˜¡•á¥ÑAÉ½µÁÑ=Á•¸¥ìÉ•ÑÕÉ¸ìô(€€€€€€€•á¥ÑAÉ½µÁÑ=Á•¸õÑÉÕ”ì((€€€€€€€½¹ÍĞ½¹™¥Éµ•ô(€€€€€€€€€€€ÑåÁ•½˜İ¥¹‘½Ü¹ÉÁ½¹™¥É´ôôô‰™Õ¹Ñ¥½¸ˆ€˜˜(€€€€€€€€€€€…İ…¥Ğİ¥¹‘½Ü¹ÉÁ½¹™¥É´ (€€€€€€€€€€€€€€€€‹Šë–ºk¢š¦n‹¦Z/¦+š"Ë–^;¾òn»–&7¦Ë–ê›šr–#¢«–.W–¶cšªSˆ°(€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€Ñ¥Ñ±”è‹¦n‹¦Z/–K¦j¨ˆ°(€€€€€€€€€€€€€€€€€€€½¹™¥ÉµQ•áĞè‹–Ë–¶c’â›¦n‹¦Z,ˆ°(€€€€€€€€€€€€€€€€€€€…¹•±Q•áĞè‹æóê3–K¦j¨ˆ(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€¤ì((€€€€€€€•á¥ÑAÉ½µÁÑ=Á•¸õ™…±Í”ì((€€€€€€€¥˜¡½¹™¥Éµ•¥ì(€€€€€€€€€€€…±±½İ¥¹á¥ĞõÑÉÕ”ì(€€€€€€€€€€€Í…Ù•…µ” ¤ì(€€€€€€€€€€€¡¥ÍÑ½Éä¹¼¡Õ…É‘I•ÍÑ½É•ü´Èè´Ä¤ì(€€€€€€€ô(€€€ô¤ì()ô¤ ¤ì(((¼¨(€€ƒŠbƒšZÃ–Š{¾òk–£¢z‹–æW–*¢÷((€€ƒ¦7¢šjš*¢†O¦fC–"Û–#¢ª«šâš–k¾òh(€€ƒ?¢š÷–f£–~ëšZó–º'–£¢¦?¾ò33ÖW–Â7’â7–¢¢Ç7ÚË¦‚–r (€€ƒ–º3–£šÊKšr'’öÿR£¢’êK–.WjššÎ’â/¢«–.W¦Ë–—–£¢z‹–æW¾ò0(€€ƒ’â–ºk¢š:§–ºÛ¢«–ŞÇ¦î{’â’â/V¯¦v‹š&7¢÷¢ãfóŠSŠP(€€ƒ¦gšb½¡É½µ—M…™…É§š&šr'?¢š÷–f£–Ç¦kj¦fC–"Û¾ò0(€€ƒ’â7šb¿¦g–/¦+š"Ë–k–ú_–"Ãš"[–k’â7–"Ãj–V?¦†3¾ò0(€€ƒ’îï’öWÚË¦‚¦+š"Ë¦÷æ{’â7¦;¦g’â¦^s((€€ƒ¦g¢‡–kjšb¿3¦¢3šÆ–Ûš²‡7’öšr¦‚š&/j–kšÎW¾òh(€€ƒn¢÷:§–ºÛ–r£V¯¦v‹’â+3²³’âš²‡7j¦î{šN+š"[¢ãš:Ÿ¾ò0(€€ƒ¦
’â’â/¦‚’úÿ’â¢Öß¢ãfó–£¢z‹–æW¢®/šÆ¾ò0(€€ƒ:§–ºÛ–æû’æ;š¢šë’â7–"Ã–’k’â–/š¶—¦¦|(€€ƒ¾ò#’â7º‡’î[¦î{jšb¿–&×¢KV¯¦v‹jš2'¦"W¾ò0(€€ƒ¦
šb¿–ŞËšr'–¶cšªSšf’âï–~;V¯¦v‹j’îï’öW–rÃšZç¾ò0(€€ƒ¦÷šr¢ãfó¾ò3’æ/–ú3–ÂÇ’â7šr–7š&OšNû¾ò'((€€ƒ–ššzs:§–ºÛj?¢š÷–f£’â7šR¿š>Ó–£¢z‹–æUA'(€€ƒš"[?¢š÷–f£–~ëšZóš~C’êo–:–nƒš.KÖW¢®/šÆ¾ò0(€€ƒ¦g¢‡R¡ÑÉä½…Ñ£šVÓ–/–2¢Öß’ú¾ò0(€€ƒ–’ÇšV_’ê–ÂÇ¦îc¦îcšRûš¾ò3’â7šr–öÇ¦~ÿ¦+š"Ëšr³¢ê¯š¶–âã¦/’ös(¨¼()™Õ¹Ñ¥½¸É•ÅÕ•ÍÑ…µ•Õ±±ÍÉ••¸ ¥ì((€€€½¹ÍĞ•°ô(€€€€€€€‘½Õµ•¹Ğ¹‘½Õµ•¹Ñ±•µ•¹Ğì(((€€€½¹ÍĞÉ•ÅÕ•ÍĞô((€€€€€€€•°¹É•ÅÕ•ÍÑÕ±±ÍÉ••¹ñğ(€€€€€€€•°¹İ•‰­¥ÑI•ÅÕ•ÍÑÕ±±ÍÉ••¹ñğ(€€€€€€€•°¹µ½éI•ÅÕ•ÍÑÕ±±MÉ••¹ñğ(€€€€€€€•°¹µÍI•ÅÕ•ÍÑÕ±±ÍÉ••¸ì(((€€€¥˜ …É•ÅÕ•ÍĞ¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€ÑÉåì((€€€€€€€½¹ÍĞÉ•ÍÕ±Ğô(€€€€€€€€€€€É•ÅÕ•ÍĞ¹…±°¡•°¤ì(((€€€€€€€¥˜ (€€€€€€€€€€€É•ÍÕ±Ğ€˜˜(€€€€€€€€€€€É•ÍÕ±Ğ¹…Ñ (€€€€€€€€¥ì((€€€€€€€€€€€É•ÍÕ±Ğ¹…Ñ   ¤ôùíô¤ì((€€€€€€€ô((€€€ô(€€€…Ñ ¡•ÉÉ½È¥íô()ô(()™Õ¹Ñ¥½¸•¹…‰±•Õ±±ÍÉ••¹=¹¥ÉÍÑQ…À ¥ì((€€€½¹ÍĞ¡…¹‘±•Èô ¤ôùì((€€€€€€€É•ÅÕ•ÍÑ…µ•Õ±±ÍÉ••¸ ¤ì((€€€ôì(((€€€‘½Õµ•¹Ğ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È (€€€€€€€€‰±¥¬ˆ°(€€€€€€€¡…¹‘±•È°(€€€€€€€í½¹”éÑÉÕ•ô(€€€€¤ì(((€€€‘½Õµ•¹Ğ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È (€€€€€€€€‰Ñ½Õ¡ÍÑ…ÉĞˆ°(€€€€€€€¡…¹‘±•È°(€€€€€€€í½¹”éÑÉÕ•ô(€€€€¤ì()ô(((¼¨(€€ƒŠbƒ’ş»š¶¾ò#’úwŸ’öÿR£¢¢ššÆ¾ò'¾òh(€€ƒ’â7¢š–7–òß–"Û–£¢z‹–æW¾ò3¦g¢‡’â7–Fó–>¬(€€•¹…‰±•Õ±±ÍÉ••¹=¹¥ÉÍÑQ…À §¾ò0(€€ƒ–÷–ò?šr³¢ê¯’şwVg¢F_¾ò3’æ/–ú3–ššzsšÏ¢š¦7šZÃš&O¦Z,(€€ƒ¦g–/–*¢÷¾ò3nÓš:—š*+’â/¦v‹¦g¢†3–>[šÚ#¢¢ï¢–6Ï–>¿(¨¼((¼¨XÄÈè¼¹½Ğ…ÕÑ¼µ•¹Ñ•È‰É½İÍ•È™Õ±±ÍÉ••¸½¸™¥ÉÍĞÑ…À¸€¨¼(¼¨(€€ƒŠbƒšr–ú3š&7¢º–>[–¶cšªS(€€ƒ¦gš¢²³’âš²‡–V–.W’â–ºkšr¦Ë–&×¢K¾ò0(€€ƒšr'–¶cšªS–&’â–ºk¦Ë¦+š"Ë(€€±½…‘…µ—–Ÿ¦£šr³¢ê¯’æšr%ÑÉä½…Ñ£¾ò0(€€ƒ¦g¢‡–7–2’â–Æ“šb¿¦ng¦7’şw¦j«¾ò0(€€ƒŠë’şw‡¢®[–š’öW¦÷’â7šr–6‡š¶ïšVÓ–/ÚË¦‚(¨¼((¼¨(€€ƒŠbƒšZÃ–Š{¾ò#’úwŸ’öÿR£¢¢ššÆ¾ò'¾òh(€€ƒš*(Ó–/¢«–.Wš"Ã¦²—¢¢·–ºk¦v‹švÿ¢‡j–:R|ñÍ•±•Ğø(€€ƒš>oš"C¢«¢¢–¦ã–Z»¦dÓ–/–Òƒ–r¡!Q53¢„(€€ƒšr³’ú–ÂÇ–¶c–r£¾ò#’â7šb¿’æ/–ú3š&7–.Wš/R‹Rj¾ò'¾ò0(€€ƒ¦g¢‡–>¿’î—šRû–ş–r£¦+š"Ë–V–.Wšf–ÂÇ–"w–/–2[’âš²‡¾ò0(€€ƒ’â7R£¶'–"Ã¢¢·–ºk¦v‹švÿrj¢Š¯š&O¦Z/(¨¼()ÑÉåì((€€€l(€€€€€€€€‰…ÕÑ½M•ÑÑ¥¹Í¡…É…Ñ•ÉM•±•Ğˆ°(€€€€€€€€‰…ÕÑ½M•ÑÑ¥¹ÍÑ¥½¹M•±•Ğˆ°(€€€€€€€€‰…ÕÑ½M•ÑÑ¥¹Í!@ˆ°(€€€€€€€€‰…ÕÑ½M•ÑÑ¥¹ÍM@ˆ(€€€t¹™½É…  (€€€€€€€Í•±•Ñ%ôùì((€€€€€€€€€€€¥¹¥ÑÕÍÑ½µÉ½Á‘½İ¸ (€€€€€€€€€€€€€€€Í•±•Ñ%(€€€€€€€€€€€€¤ì((€€€€€€€ô(€€€€¤ì()ô)…Ñ ¡•ÉÉ½È¥ì((€€€½¹Í½±”¹•ÉÉ½È (€€€€€€€€‹¢«¢¢’â/š.'¦ã–Z»–"w–/–2[–’ÇšV_¾òhˆ°(€€€€€€€•ÉÉ½È(€€€€¤ì()ô(()ÑÉåì((€€€€¼¨(€€€€€€ƒŠbƒšZÃ–Š{¾ò#’úwŸ’öÿR£¢¢ššÆ¾ò33–*ƒ¦î{¢š(€€€€€€ƒšZÃ–Š{¦Vßš2'–ş¯¦–*ƒ¦î{7¾ò'¾òh(€€€€€€ƒ¦‚¦v‹¢ò'–—šf¾ò3š*(ÛÖ–Æ³šŸj¬¼·š2'¦"T(€€€€€€ƒ–£¦£Ú’â+¦Vßš2'š2ê3¢ãfó¾ò3’âš²‡šœ(€€€€€€ƒ¢¢·–ºk¾ò3’â7R£–r£š¾?–/š2'¦"Wj!Q53’â((€€€€€€ƒ–B¢«–¾¯’ê/’îÛ(€€€€¨¼((€€€l(€€€€€€€l‰…ÑÑ…¬ˆ°‰ÑÑ…¬‰t°(€€€€€€€l‰Ù¥Ñ…±¥Ñäˆ°‰Y¥Ñ…±¥Ñä‰t°(€€€€€€€l‰•¹•Éäˆ°‰¹•Éä‰t°(€€€€€€€l‰¥¹Ñ•±±¥•¹”ˆ°‰%¹Ñ•±±¥•¹”‰t°(€€€€€€€l‰ÍÁ¥É¥Ğˆ°‰MÁ¥É¥Ğ‰t°(€€€€€€€l‰…¥±¥Ñäˆ°‰¥±¥Ñä‰t(€€€t¹™½É…  ¡mÍÑ…Ñ-•ä±¥‘A…ÉÑt¤ôùì((€€€€€€€…ÑÑ…¡1½¹AÉ•ÍÌ (€€€€€€€€€€€€ ‰ÍÑ…ÑÕÍ	Ñ¸ˆ­¥‘A…ÉĞ¬‰5¥¹ÕÌˆ¤°(€€€€€€€€€€€€ ¤ôùÉ•µ½Ù•A½¥¹Ğ¡ÍÑ…Ñ-•ä¤(€€€€€€€€¤ì(((€€€€€€€…ÑÑ…¡1½¹AÉ•ÍÌ (€€€€€€€€€€€€ ‰ÍÑ…ÑÕÍ	Ñ¸ˆ­¥‘A…ÉĞ¬‰A±ÕÌˆ¤°(€€€€€€€€€€€€ ¤ôù…‘‘A½¥¹Ğ¡ÍÑ…Ñ-•ä¤(€€€€€€€€¤ì((€€€ô¤ì()ô)…Ñ ¡•ÉÉ½È¥ì((€€€½¹Í½±”¹•ÉÉ½È (€€€€€€€€‹–Æ³šŸ–*ƒ¦î{¦Vßš2'Ú–ºk–’ÇšV_¾òhˆ°(€€€€€€€•ÉÉ½È(€€€€¤ì()ô(((¼¨MÑ…ÉÑÕÁMÑ…Ñ•5…¡¥¹”¥ÌÑ¡”½¹±ä½İ¹•È…±±½İ•Ñ¼Í•±•Ğ…¹±½……¸…½Õ¹ĞÍ…Ù”¸€¨¼(((¼¨(€€ƒŠbƒ’â7º‡–&×¢Kš"[¢ºšªS–N«šŠw¢Ş¿–úG¾ò0(€€ƒšr–ú3¦÷–V–.W¢«–.W–¶cšªS(€€ÍÑ…ÉÑÕÑ½M…Ù” ¤ƒ–Ÿ¦£j–ºkšf–f (€€ƒš¾?š²‡¢ãfó¦÷šr¢«–ŞÇšª‹š~—¦+š"Ëšb¿–B›–ŞËÚO¦Z/–/¾ò0(€€ƒš&’î—–ÂÇº_¦gšf–g:§–ºÛ¦
–r£–&×¢KV¯¦v‹¾ò0(€€ƒ’æ’â7šr–ë¦2¿š"[–¶c¦Ë¦ë¢ÎšZg(¨¼()ÑÉåì((€€€ÍÑ…ÉÑÕÑ½M…Ù” ¤ì()ô)…Ñ ¡•ÉÉ½È¥ì((€€€½¹Í½±”¹•ÉÉ½È (€€€€€€€€‹¢«–.W–¶cšªS–V–.W–’ÇšV_¾òhˆ°(€€€€€€€•ÉÉ½È(€€€€¤ì()ô(((¼¨‰Õ¹‘±•Í½ÕÉ”è©Ì¼ÀÄµÍÑ…”µØàµÑ½Õ µ±½¬¹©Ì€¨¼(¡™Õ¹Ñ¥½¸ ¥ì(€€€€‰ÕÍ”ÍÑÉ¥Ğˆì((€€€€¼¨(€€€€€¨XÜàI==P%`(€€€€€¨(€€€€€¨ƒ¢"+&#R Ñ…É•Ğ¹±½Í•ÍĞ ¸¸¸¤ƒ–>«r/²³’â–/²›–B#–Òƒ(€€€€€¨ƒ¢3–2¢‡²³’â–/²›–B#jšb¼€¥¹Ù•¹Ñ½ÉåA…—¾ò0(€€€€€¨ƒ’örš¶jÍÉ½±°½İ¹•Èƒšb¿–º’â+¦v‹j€¹½¹Ñ•¹Ó(€€€€€¨(€€€€€¨ƒ¦g¢‡šRçš"C’â¢Ş¿–ú–[–#¢ÖÃ¾ò3–>«¢š–Û’â·’îï’öW’â–Æ(€€€€€¨ƒšb¿rš¶–>¿’î—–znÓš"[šÂÓ–æÏš6Ë–.Wj–ºç–f£¾ò3–ÂÇ–¢¢Çš&/–.‹¦k¦;(€€€€€¨¼(€€€™Õ¹Ñ¥½¸¥Í%¹Í¥‘•±±½İ•‘MÉ½±±•È¡Ñ…É•Ğ¥ì(€€€€€€€¥˜ …Ñ…É•Ğ¥ì(€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€ô((€€€€€€€€¼¨(€€€€€€€€€€ƒŠbƒ’ş»š¶¾ò#’úwŸ’öÿR£¢–n{–‚Ç¾ò33–£–Æ³šŸš*¢÷¦‚C¢š÷7¦‚¦vˆ(€€€€€€€€€€ƒ3’â7¢÷š6Ë–.W¾ò3’â/¦v‹r/’â7–"Ã7¾ò'¾òh(€€€€€€€€€€ƒ¦g¢‡šb¿–£–~j¢ãš:Ÿ¦:[¾ò1€…µ”µÍÑ…•ƒ¢‡’îï’öW¢ãš:Ÿn»š¢d(€€€€€€€€€€ƒ–>«¢š’â7–r£¦g’î÷f÷–B7–Z»¢š¢N/j–>¿š6Ë–.W–ºç–f£–Ÿ¾ò3’â–ú,(€€€€€€€€€€ÁÉ•Ù•¹Ñ•™…Õ±Ğ ¥ƒšN/š:'–:Rš6Ë–.Wš&/–.‹(€€€€€€€€€€€¹Í­¥±°µÁÉ•Ù¥•Üµ‰½‘åƒ¾ò#–£–Æ³šŸš*¢÷¦‚C¢š÷–ö#ª_rš¶Œ(€€€€€€€€€€ƒjš6Ë–.W–ºç–f£¾ò'–ú{’â¦Z/–/–ÂÇšÊKšr'¢Š¯–*ƒ¦Ë¦g’î÷f÷–B7–Z»¾ò0(€€€€€€€€€€ƒ¢/–ò?–2[¢¢·–ºiÍÉ½±±Q½Áƒr/¢Öß’úš¶–âã’öš&/š2rjšîG–.T(€€€€€€€€€€ƒšf¾ò#rš¶šrÚO¦9Ñ½Õ¡µ½Ù—’ê/’îÛ¾ò'–º3–£¢Š¯¦g¢‡šN/š:'¾ò0(€€€€€€€€€€ƒ¦gšb¿–:šr³–ÂÇ–¶c–r£j‰ÕŸ¾ò3–>«šb¿–Ÿ–ºç–¶_Òk¢º+–’Ÿrj¦r¢š(€€€€€€€€€€ƒš6Ë–.Wš&7šrr/–"Ã–Ÿ–ºç’æ/–ú3š&7šr¢Š¯¢â§–"ÃŠSŠS’æ/–&7–¶_Òk–Â?(€€€€€€€€€€ƒ–Ÿ–ºç–&o––÷–†{–ú_¦ÉÙ¥•İÁ½ÉÓ¾ò3–ú{’úšÊKrj¦r¢šš6Ë–.W¦;((€€€€€€€€€€XÄÜÌ¸ĞÔÍ¡½À™É…µ”¡½Ñ™¥ã¾òk–V–ê_šRçš"C–në–ºh1…É”A…¹•°ƒ–ú3¾ò0(€€€€€€€€€€ƒrš¶j–Ÿ–ºäÍÉ½±°½İ¹•Èƒšb¼€¡½µ••…ÑÕÉ•5½‘…±	½‘ç(€€€€€€€€€€ƒ–’[š†€¹¡½µ”µ™•…ÑÕÉ”µµ½‘…°µ‰½àƒ–>«¢Êƒ¢Ê³–në–ºk–Âë–¾ã’âP½Ù•É™±½Üé¡¥‘‘•»¾ò0(€€€€€€€€€€ƒ–nƒš¶“’â7¢÷’îšnÿ–Ÿ¦‚¦k¦;¢ãš:Ÿ¦:[¾òoš*+rš¶ŒÍÉ½±°½İ¹•ÈƒÒ7–”(€€€€€€€€€€ƒ–B3’â’î÷š²+–¢f÷–B7–Z»¾ò3¦ÿ–7–7š²‡–ë>û3r/–ú_–"ÀÍÉ½±±‰…Ë(€€€€€€€€€€ƒ’öš&/š2šîG’â7–.W7j–š6Ë–.W.š/((€€€€€€€€€€ƒ–B#š"C¢w–
g¦ãšN–"_šb¿šÂÓ–æÌÍÉ½±°½İ¹•Ë¢"+–"“šZß–>«š:—–>\(€€€€€€€€€€½Ù•É™±½Üµç¾ò3–nƒš¶“–6Ï’öÿV¯¦v‹–ŞË–ë>ûš¦¯–BDÍÉ½±±‰…Ë¾ò3š&/š2–Ş›–>Ì(€€€€€€€€€€ƒšîG’î7šr¢Š¯–£–~|Ñ½Õ ±½¬ƒ¦bïšN/>û–r£–B3’â’î÷š²+–¢–"“šZß–B3šf(€€€€€€€€€€ƒš:—–>_rš¶–>¿š6Ë–.Wj`½dƒ¢îã¾ò3¦ÿ–7–7
ë–Z»’â¦‚¦v‹–>›–k’ê/’îÛ¢s’â((€€€€€€€€€€ƒ¢K¢&Ë¢¦ÏÒÃ¢÷–*o¢š[ª_jrš¶ŒÍÉ½±°½İ¹•Èƒšb¼(€€€€€€€€€€€¹¥¹Ù•¹Ñ½Éäµ¡…É…Ñ•Èµ‘•Ñ…¥°µÉ¥“¾òo–’[š†(€€€€€€€€€€€¹¥¹Ù•¹Ñ½Éäµ¡…É…Ñ•Èµ‘•Ñ…¥°µ‰½àƒšr³¢ê¯šb¼½Ù•É™±½Üé¡¥‘‘•»¾ò0(€€€€€€€€€€ƒ’â7¢÷šnÿ–Ÿ–ºç–6¦k¦;¢ãš:Ÿ¦:[š*+rš¶–Ÿ–ºç–Æ“–*ƒ–—–B3’âf÷–B7–Z»((€€€€€€€€€€ƒŞÓ–*–6–rÃ–6¢Î¢¢+šRÛšZš"@5•‘¥Õ´5½‘…°ƒ–ú3¾ò3rš¶ŒÍÉ½±°½İ¹•È(€€€€€€€€€€ƒšRç
è€ÑÉ…¥¹¥¹i½¹•5½‘…±	½‘ç¾òo–’[š†–>«¢Êƒ¢Ê³–në–ºk–Âë–¾ã((€€€€€€€€€€ƒ.š/¾ò?¢÷–*o¢ª«šb;šRÛšZš"@5•‘¥Õ´5½‘…°ƒ–ú3¾ò3rš¶ŒÍÉ½±°½İ¹•È(€€€€€€€€€€ƒšb¼€ÍÑ…ÑÕÍ!•±Á5½‘…°ƒ–Ÿj€¹¥Ñ•´µÍÑ…Ğµ±¥ÍÓ¾òo–’[š†¢"¢şS–n{¦6×–në–ºk((€€€€€€€€€€XÄÜÓ¾òkc–¾Û¦‚j–znĞÍÉ½±°½İ¹•Èƒšb¼(€€€€€€€€€€€¡½µ••…ÑÕÉ•5½‘…°¹Ñ•…´µÉ•±¥Œµµ½‘”€¡½µ••…ÑÕÉ•5½‘…±	½‘ç¾ò3–"¦†{–"\(€€€€€€€€€€€¹Ñ•…´µÉ•±¥ŒµÑ…‰Ìƒ–&šb¿šÂÓ–æÌÍÉ½±°½İ¹•Ë–§¢¦÷–ş¦‚#¦k¦;¦g–,(€€€€€€€€€€ƒ–£–~¢ãš:Ÿ¦:[¾òo–B›–&š&/–.‹–ú{–"¦†{–"_š"[c–¾Û–Ÿ–ºç¢Öß–/šfšr¢Š¬(€€€€€€€€€€ÁÉ•Ù•¹Ñ•™…Õ±Ğ §¾ò3¦ƒš"C3šr'šf¢÷šîGšr'šf’â7¢÷šîG7j¢wö»–Ş»VÃ((€€€€€€€€€€¥É•‰…Í”ƒ–âÏ¢f¢š[ª_’öÿR£6£®/šZğ…µ”ÍÑ…”ƒjÉ•ÍÁ½¹Í¥Ù”Ù¥•İÁ½ÉĞ(€€€€€€€€€€½Ù•É±…ç¾ò3rš¶j–znĞÍÉ½±°½İ¹•Èƒšb¼€¹™¥É•‰…Í”µ…ÕÑ µ‘¥…±½Ÿ¾òl(€€€€€€€€€€ƒ–B3š¢–>«–r£¦g’î÷–£–~f÷–B7–Z»fï¢¢c’âš²‡¾ò3’â7
ëfï–—¦‚–>›–*€Ñ½Õ¡µ½Ù”ƒ¢s’â(€€€€€€€€¨¼(€€€€€€€½¹ÍĞ…±±½İ•‘M•±•Ñ½È€ô(€€€€€€€€€€€€ˆ¹½¹Ñ•¹Ğ°€¹½¹Ñ•¹ĞµÍÉ½±±…‰±”°€¹É•…Ñ¥½¸µÁ…”µÍÉ½±°°€¹É•…Ñ¥½¸µÉ½±”µ…É°€¹¥¹Ù•¹Ñ½ÉäµÉ¥µÍÉ½±°°€¹ÅÕ•ÍĞµÑ…ˆµ‰½‘ä°€¹‰…ÑÑ±”µ¥Ñ•´µ±¥ÍĞ°€ˆ€¬(€€€€€€€€€€€€ˆ¹¡…É…Ñ•ÉQ…‰½¹Ñ•¹Ğ°€¡…É…Ñ•ÉQ…‰½¹Ñ•¹Ğ°€¥¹Ù•¹Ñ½ÉåA…”°€ˆ€¬(€€€€€€€€€€€€ˆ¹…‘Ù•¹ÑÕÉ”µÙ¥•Ü°€ˆ€¬(€€€€€€€€€€€€ˆ¹¡½µ”µ™•…ÑÕÉ”µµ½‘…°µ‰½à°€¡½µ••…ÑÕÉ•5½‘…±	½‘ä°€¡½µ••…ÑÕÉ•5½‘…°¹Ñ•…´µÉ•±¥Œµµ½‘”€¡½µ••…ÑÕÉ•5½‘…±	½‘ä°€¹Ñ•…´µÉ•±¥ŒµÑ…‰Ì°€¹ØÄĞÄµÍå¹Ñ¡•Í¥Ìµ‰½‘ä°€ÑÉ…¥¹¥¹i½¹•5½‘…±	½‘ä°€¹…ÕÑ¼µÍ•ÑÑ¥¹Ìµ•áÁ…¹‘•°€ˆ€¬(€€€€€€€€€€€€ˆ¹¥¹Ù•¹Ñ½Éäµ¡…É…Ñ•Èµ‘•Ñ…¥°µ‰½à°€¹¥¹Ù•¹Ñ½Éäµ¡…É…Ñ•Èµ‘•Ñ…¥°µÉ¥°€¹¥Ñ•´µµ½‘…°µ‰½à°€¥Ñ•µ5½‘…±MÑ…ÑÌ°€Í­¥±±•Ñ…¥±MÑ…ÑÌ°€ˆ€¬(€€€€€€€€€€€€ˆÍÑ…ÑÕÍ!•±Á5½‘…°€¹¥Ñ•´µÍÑ…Ğµ±¥ÍĞ°€¹Í­¥±°µÁÉ•Ù¥•Üµ‰½‘ä°€¹É•…Ñ¥½¸µÍ­¥±°µ‘•Ñ…¥°µ±•Ù•±Ì°€‘Õ¹•½¹Q…‰½¹Ñ•¹Ğ°€¹…µ•Á±…äµÁ…¹•°µÍÉ½±°°€¹ØÄÜÌĞÈµ…‰åÍÌµ‰…ÑÑ±”µ±½œ°€¹ØÄĞÌµ¥Ñ•´µÁ¥­•È°€¹ØÄÜÌÔàµÉ•™½É”µÑ¥•ÉÌ°€¹ØÄÜÌØÌµ…µ”µÍ•±•Ğµµ•¹Ô°€¹ØÄÜÌÔÄµ½µÁ…É”µÍÑ…ÑÌ°€¹™¥É•‰…Í”µ…ÕÑ µ‘¥…±½œ°€ˆ€¬(€€€€€€€€€€€€‰Ñ•áÑ…É•„°Í•±•Ğ°¥¹ÁÕĞˆì((€€€€€€€±•Ğ¹½‘”€ô(€€€€€€€€€€€Ñ…É•Ğ¹¹½‘•QåÁ”ôôôÄ(€€€€€€€€€€€€üÑ…É•Ğ(€€€€€€€€€€€€èÑ…É•Ğ¹Á…É•¹Ñ±•µ•¹Ğì((€€€€€€€İ¡¥±”¡¹½‘”€˜˜¹½‘”„ôõ‘½Õµ•¹Ğ¹‘½Õµ•¹Ñ±•µ•¹Ğ¥ì((€€€€€€€€€€€¥˜ (€€€€€€€€€€€€€€€¹½‘”¹µ…Ñ¡•Ì€˜˜(€€€€€€€€€€€€€€€¹½‘”¹µ…Ñ¡•Ì¡…±±½İ•‘M•±•Ñ½È¤(€€€€€€€€€€€€¥ì(€€€€€€€€€€€€€€€½¹ÍĞÍÑå±”€ô(€€€€€€€€€€€€€€€€€€€İ¥¹‘½Ü¹•Ñ½µÁÕÑ•‘MÑå±”¡¹½‘”¤ì((€€€€€€€€€€€€€€€½¹ÍĞ…¹MÉ½±±d€ô(€€€€€€€€€€€€€€€€€€€€ (€€€€€€€€€€€€€€€€€€€€€€€ÍÑå±”¹½Ù•É™±½İdôôô‰…ÕÑ¼ˆñğ(€€€€€€€€€€€€€€€€€€€€€€€ÍÑå±”¹½Ù•É™±½İdôôô‰ÍÉ½±°ˆ(€€€€€€€€€€€€€€€€€€€€¤€˜˜(€€€€€€€€€€€€€€€€€€€¹½‘”¹ÍÉ½±±!•¥¡Ğ€ø(€€€€€€€€€€€€€€€€€€€¹½‘”¹±¥•¹Ñ!•¥¡Ğ€¬€Äì((€€€€€€€€€€€€€€€½¹ÍĞ…¹MÉ½±±`€ô(€€€€€€€€€€€€€€€€€€€€ (€€€€€€€€€€€€€€€€€€€€€€€ÍÑå±”¹½Ù•É™±½İ`ôôô‰…ÕÑ¼ˆñğ(€€€€€€€€€€€€€€€€€€€€€€€ÍÑå±”¹½Ù•É™±½İ`ôôô‰ÍÉ½±°ˆ(€€€€€€€€€€€€€€€€€€€€¤€˜˜(€€€€€€€€€€€€€€€€€€€¹½‘”¹ÍÉ½±±]¥‘Ñ €ø(€€€€€€€€€€€€€€€€€€€¹½‘”¹±¥•¹Ñ]¥‘Ñ €¬€Äì((€€€€€€€€€€€€€€€¥˜¡…¹MÉ½±±dñğ…¹MÉ½±±`¥ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€ô((€€€€€€€€€€€¹½‘”õ¹½‘”¹Á…É•¹Ñ±•µ•¹Ğì(€€€€€€€ô((€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€ô((€€€‘½Õµ•¹Ğ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È (€€€€€€€€‰Ñ½Õ¡µ½Ù”ˆ°(€€€€€€€™Õ¹Ñ¥½¸¡•Ù•¹Ğ¥ì(€€€€€€€€€€€½¹ÍĞ…µ•MÕÉ™…”€ô(€€€€€€€€€€€€€€€•Ù•¹Ğ¹Ñ…É•Ğ€˜˜(€€€€€€€€€€€€€€€•Ù•¹Ğ¹Ñ…É•Ğ¹±½Í•ÍĞ€˜˜(€€€€€€€€€€€€€€€•Ù•¹Ğ¹Ñ…É•Ğ¹±½Í•ÍĞ ˆ…µ”µÍÑ…”ˆ¤ì((€€€€€€€€€€€¥˜ (€€€€€€€€€€€€€€€…µ•MÕÉ™…”€˜˜(€€€€€€€€€€€€€€€•Ù•¹Ğ¹Ñ½Õ¡•Ì€˜˜(€€€€€€€€€€€€€€€•Ù•¹Ğ¹Ñ½Õ¡•Ì¹±•¹Ñ øÄ(€€€€€€€€€€€€¥ì(€€€€€€€€€€€€€€€•Ù•¹Ğ¹ÁÉ•Ù•¹Ñ•™…Õ±Ğ ¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€€€€€ô((€€€€€€€€€€€¥˜ (€€€€€€€€€€€€€€€…µ•MÕÉ™…”€˜˜(€€€€€€€€€€€€€€€€…¥Í%¹Í¥‘•±±½İ•‘MÉ½±±•È (€€€€€€€€€€€€€€€€€€€•Ù•¹Ğ¹Ñ…É•Ğ(€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€¥ì(€€€€€€€€€€€€€€€•Ù•¹Ğ¹ÁÉ•Ù•¹Ñ•™…Õ±Ğ ¤ì(€€€€€€€€€€€ô(€€€€€€€ô°(€€€€€€€íÁ…ÍÍ¥Ù”é™…±Í•ô(€€€€¤ì((€€€‘½Õµ•¹Ğ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È (€€€€€€€€‰Á½¥¹Ñ•Éµ½Ù”ˆ°(€€€€€€€™Õ¹Ñ¥½¸¡•Ù•¹Ğ¥ì(€€€€€€€€€€€¥˜ (€€€€€€€€€€€€€€€•Ù•¹Ğ¹Á½¥¹Ñ•ÉQåÁ”ôôô‰Ñ½Õ ˆ€˜˜(€€€€€€€€€€€€€€€•Ù•¹Ğ¹Ñ…É•Ğ€˜˜(€€€€€€€€€€€€€€€•Ù•¹Ğ¹Ñ…É•Ğ¹±½Í•ÍĞ€˜˜(€€€€€€€€€€€€€€€•Ù•¹Ğ¹Ñ…É•Ğ¹±½Í•ÍĞ ˆ…µ”µÍÑ…”ˆ¤€˜˜(€€€€€€€€€€€€€€€€…¥Í%¹Í¥‘•±±½İ•‘MÉ½±±•È (€€€€€€€€€€€€€€€€€€€•Ù•¹Ğ¹Ñ…É•Ğ(€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€¥ì(€€€€€€€€€€€€€€€•Ù•¹Ğ¹ÁÉ•Ù•¹Ñ•™…Õ±Ğ ¤ì(€€€€€€€€€€€ô(€€€€€€€ô°(€€€€€€€íÁ…ÍÍ¥Ù”é™…±Í•ô(€€€€¤ì((€€€€¼¨(€€€€€€ƒ–£¦+š"Ë?¢š÷–f£–:R’êK–.W¦:[¾òh(€€€€€€€´ƒ–Z»š2’î7’úwš^‹šr$ÍÉ½±°İ¡¥Ñ•±¥ÍĞƒš¶–âãš6Ë–.W(€€€€€€€´ƒ–§š2’î—’â+šÂã¦ƒ’â7’ê“Ö›?¢š÷–f£–hÁ¥¹ é½½·(€€€€€€€´ƒ¦v{šZ–¶_¢òã–”U$ƒ’â7¦Z/–V¦Vßš2$½¹Ñ•áĞµ•¹×’â7–:Rš.[šnÏ’â7šZ–¶_¦ã–>[(€€€€€€ƒ¦gšb¿–£–~|½İ¹•Ë¾ò3šš¶‹–B¦‚–>›Z+¦Vßš2'¾ò?â»šRû¢s’â(€€€€¨¼(€€€™Õ¹Ñ¥½¸¥Í…µ•MÕÉ™…•Q…É•Ğ¡Ñ…É•Ğ¥ì(€€€€€€€É•ÑÕÉ¸€„„ (€€€€€€€€€€€Ñ…É•Ğ€˜˜(€€€€€€€€€€€Ñ…É•Ğ¹±½Í•ÍĞ€˜˜(€€€€€€€€€€€Ñ…É•Ğ¹±½Í•ÍĞ ˆ…µ”µÍÑ…”ˆ¤(€€€€€€€€¤ì(€€€ô((€€€™Õ¹Ñ¥½¸¥Í‘¥Ñ…‰±•…µ•½¹ÑÉ½°¡Ñ…É•Ğ¥ì(€€€€€€€É•ÑÕÉ¸€„„ (€€€€€€€€€€€Ñ…É•Ğ€˜˜(€€€€€€€€€€€Ñ…É•Ğ¹±½Í•ÍĞ€˜˜(€€€€€€€€€€€Ñ…É•Ğ¹±½Í•ÍĞ ¥¹ÁÕĞ°Ñ•áÑ…É•„°m½¹Ñ•¹Ñ•‘¥Ñ…‰±”ô‰ÑÉÕ”‰tœ¤(€€€€€€€€¤ì(€€€ô(((€€€‘½Õµ•¹Ğ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È (€€€€€€€€‰½¹Ñ•áÑµ•¹Ôˆ°(€€€€€€€™Õ¹Ñ¥½¸¡•Ù•¹Ğ¥ì(€€€€€€€€€€€¥˜ (€€€€€€€€€€€€€€€¥Í…µ•MÕÉ™…•Q…É•Ğ¡•Ù•¹Ğ¹Ñ…É•Ğ¤€˜˜(€€€€€€€€€€€€€€€€…¥Í‘¥Ñ…‰±•…µ•½¹ÑÉ½°¡•Ù•¹Ğ¹Ñ…É•Ğ¤(€€€€€€€€€€€€¥ì(€€€€€€€€€€€€€€€•Ù•¹Ğ¹ÁÉ•Ù•¹Ñ•™…Õ±Ğ ¤ì(€€€€€€€€€€€ô(€€€€€€€ô°(€€€€€€€í…ÁÑÕÉ”éÑÉÕ•ô(€€€€¤ì((€€€‘½Õµ•¹Ğ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È (€€€€€€€€‰‘É…ÍÑ…ÉĞˆ°(€€€€€€€™Õ¹Ñ¥½¸¡•Ù•¹Ğ¥ì(€€€€€€€€€€€¥˜ (€€€€€€€€€€€€€€€¥Í…µ•MÕÉ™…•Q…É•Ğ¡•Ù•¹Ğ¹Ñ…É•Ğ¤€˜˜(€€€€€€€€€€€€€€€€…¥Í‘¥Ñ…‰±•…µ•½¹ÑÉ½°¡•Ù•¹Ğ¹Ñ…É•Ğ¤(€€€€€€€€€€€€¥ì(€€€€€€€€€€€€€€€•Ù•¹Ğ¹ÁÉ•Ù•¹Ñ•™…Õ±Ğ ¤ì(€€€€€€€€€€€ô(€€€€€€€ô°(€€€€€€€í…ÁÑÕÉ”éÑÉÕ•ô(€€€€¤ì((€€€‘½Õµ•¹Ğ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È (€€€€€€€€‰Í•±•ÑÍÑ…ÉĞˆ°(€€€€€€€™Õ¹Ñ¥½¸¡•Ù•¹Ğ¥ì(€€€€€€€€€€€¥˜ (€€€€€€€€€€€€€€€¥Í…µ•MÕÉ™…•Q…É•Ğ¡•Ù•¹Ğ¹Ñ…É•Ğ¤€˜˜(€€€€€€€€€€€€€€€€…¥Í‘¥Ñ…‰±•…µ•½¹ÑÉ½°¡•Ù•¹Ğ¹Ñ…É•Ğ¤(€€€€€€€€€€€€¥ì(€€€€€€€€€€€€€€€•Ù•¹Ğ¹ÁÉ•Ù•¹Ñ•™…Õ±Ğ ¤ì(€€€€€€€€€€€ô(€€€€€€€ô°(€€€€€€€í…ÁÑÕÉ”éÑÉÕ•ô(€€€€¤ì((€€€‘½Õµ•¹Ğ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È (€€€€€€€€‰İ¡••°ˆ°(€€€€€€€™Õ¹Ñ¥½¸¡•Ù•¹Ğ¥ì(€€€€€€€€€€€¥˜ (€€€€€€€€€€€€€€€•Ù•¹Ğ¹ÑÉ±-•ä€˜˜(€€€€€€€€€€€€€€€¥Í…µ•MÕÉ™…•Q…É•Ğ¡•Ù•¹Ğ¹Ñ…É•Ğ¤(€€€€€€€€€€€€¥ì(€€€€€€€€€€€€€€€•Ù•¹Ğ¹ÁÉ•Ù•¹Ñ•™…Õ±Ğ ¤ì(€€€€€€€€€€€ô(€€€€€€€ô°(€€€€€€€í…ÁÑÕÉ”éÑÉÕ”±Á…ÍÍ¥Ù”é™…±Í•ô(€€€€¤ì((€€€İ¥¹‘½Ü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È (€€€€€€€€‰•ÍÑÕÉ•ÍÑ…ÉĞˆ°(€€€€€€€™Õ¹Ñ¥½¸¡•Ù•¹Ğ¥ì(€€€€€€€€€€€¥˜ (€€€€€€€€€€€€€€€•Ù•¹Ğ¹Ñ…É•Ğ€˜˜(€€€€€€€€€€€€€€€•Ù•¹Ğ¹Ñ…É•Ğ¹±½Í•ÍĞ€˜˜(€€€€€€€€€€€€€€€•Ù•¹Ğ¹Ñ…É•Ğ¹±½Í•ÍĞ ˆ…µ”µÍÑ…”ˆ¤(€€€€€€€€€€€€¥ì(€€€€€€€€€€€€€€€•Ù•¹Ğ¹ÁÉ•Ù•¹Ñ•™…Õ±Ğ ¤ì(€€€€€€€€€€€ô(€€€€€€€ô°(€€€€€€€íÁ…ÍÍ¥Ù”é™…±Í•ô(€€€€¤ì((€€€İ¥¹‘½Ü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È (€€€€€€€€‰•ÍÑÕÉ•¡…¹”ˆ°(€€€€€€€™Õ¹Ñ¥½¸¡•Ù•¹Ğ¥ì(€€€€€€€€€€€¥˜ (€€€€€€€€€€€€€€€•Ù•¹Ğ¹Ñ…É•Ğ€˜˜(€€€€€€€€€€€€€€€•Ù•¹Ğ¹Ñ…É•Ğ¹±½Í•ÍĞ€˜˜(€€€€€€€€€€€€€€€•Ù•¹Ğ¹Ñ…É•Ğ¹±½Í•ÍĞ ˆ…µ”µÍÑ…”ˆ¤(€€€€€€€€€€€€¥ì(€€€€€€€€€€€€€€€•Ù•¹Ğ¹ÁÉ•Ù•¹Ñ•™…Õ±Ğ ¤ì(€€€€€€€€€€€ô(€€€€€€€ô°(€€€€€€€íÁ…ÍÍ¥Ù”é™…±Í•ô(€€€€¤ì((€€€İ¥¹‘½Ü¹¥Í%¹Í¥‘•±±½İ•‘MÉ½±±•ÉXÜà€ô(€€€€€€€¥Í%¹Í¥‘•±±½İ•‘MÉ½±±•Èì)ô¤ ¤ì(((¼¨‰Õ¹‘±•Í½ÕÉ”è©Ì¼ÀÈµÍÑ…”µØäµ¹…Ñ¥Ù”µ½½É‘¥¹…Ñ”µ…Á¤¹©Ì€¨¼(¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€XäƒŠP9Q%Y€ÄÀàÃ\ÄäÈÀ==I%9QA$((€€9•Ü™•…ÑÕÉ•Ì5UMPÕÍ”Ñ¡•Í”¡•±Á•ÉÌ¥¹ÍÑ•…½˜‰É½İÍ•È(€€Ù¥•İÁ½ÉĞ½½É‘¥¹…Ñ•Ì¸((€€á¥ÍÑ¥¹œ…µ”±½¥Œ¥Ì¥¹Ñ•¹Ñ¥½¹…±±äÕ¹Ñ½Õ¡•¸(ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼(¡™Õ¹Ñ¥½¸¥¹ÍÑ…±±9…Ñ¥Ù•…µ•½½É‘¥¹…Ñ•A$ ¥ì(€€€½¹ÍĞ5}\€ô€ÄÀàÀì(€€€½¹ÍĞ5} €ô€ÄäÈÀì((€€€™Õ¹Ñ¥½¸•ÑMÑ…” ¥ì(€€€€€€€É•ÑÕÉ¸‘½Õµ•¹Ğ¹•Ñ±•µ•¹Ñ	å% ‰…µ”µÍÑ…”ˆ¤ì(€€€ô((€€€™Õ¹Ñ¥½¸•Ñ=Ù•É±…ä ¥ì(€€€€€€€É•ÑÕÉ¸‘½Õµ•¹Ğ¹•Ñ±•µ•¹Ñ	å% ‰…µ”µ½Ù•É±…äµ±…å•Èˆ¤ì(€€€ô((€€€™Õ¹Ñ¥½¸ÍÉ••¹Q½…µ”¡±¥•¹Ñ`°±¥•¹Ñd¥ì(€€€€€€€½¹ÍĞÍÑ…”€ô•ÑMÑ…” ¤ì(€€€€€€€¥˜ …ÍÑ…”¥ì(€€€€€€€€€€€É•ÑÕÉ¸íàè±¥•¹Ñ`°äè±¥•¹Ñeôì(€€€€€€€ô((€€€€€€€½¹ÍĞÉ•Ğ€ôÍÑ…”¹•Ñ	½Õ¹‘¥¹±¥•¹ÑI•Ğ ¤ì(€€€€€€€½¹ÍĞÍ…±”€ôİ¥¹‘½Ü¹…µ•MÑ…•M…±”ñğ€Äì((€€€€€€€É•ÑÕÉ¸ì(€€€€€€€€€€€àè€¡±¥•¹Ñ`€´É•Ğ¹±•™Ğ¤€¼Í…±”°(€€€€€€€€€€€äè€¡±¥•¹Ñd€´É•Ğ¹Ñ½À¤€¼Í…±”(€€€€€€€ôì(€€€ô((€€€™Õ¹Ñ¥½¸…µ•Q½MÉ••¸¡à°ä¥ì(€€€€€€€½¹ÍĞÍÑ…”€ô•ÑMÑ…” ¤ì(€€€€€€€¥˜ …ÍÑ…”¥ì(€€€€€€€€€€€É•ÑÕÉ¸íà°åôì(€€€€€€€ô((€€€€€€€½¹ÍĞÉ•Ğ€ôÍÑ…”¹•Ñ	½Õ¹‘¥¹±¥•¹ÑI•Ğ ¤ì((€€€€€€€É•ÑÕÉ¸ì(€€€€€€€€€€€àèÉ•Ğ¹±•™Ğ€¬à€¨€¡É•Ğ¹İ¥‘Ñ €¼5}\¤°(€€€€€€€€€€€äèÉ•Ğ¹Ñ½À€¬ä€¨€¡É•Ğ¹¡•¥¡Ğ€¼5} ¤(€€€€€€€ôì(€€€ô((€€€™Õ¹Ñ¥½¸•Ù•¹ÑQ½…µ”¡•Ù•¹Ğ¥ì(€€€€€€€½¹ÍĞÁ½¥¹Ğ€ô•Ù•¹Ğ¹Ñ½Õ¡•Ì€˜˜•Ù•¹Ğ¹Ñ½Õ¡•Ì¹±•¹Ñ (€€€€€€€€€€€€ü•Ù•¹Ğ¹Ñ½Õ¡•ÍlÁt(€€€€€€€€€€€€è•Ù•¹Ğ¹¡…¹•‘Q½Õ¡•Ì€˜˜•Ù•¹Ğ¹¡…¹•‘Q½Õ¡•Ì¹±•¹Ñ (€€€€€€€€€€€€€€€€ü•Ù•¹Ğ¹¡…¹•‘Q½Õ¡•ÍlÁt(€€€€€€€€€€€€€€€€è•Ù•¹Ğì((€€€€€€€É•ÑÕÉ¸ÍÉ••¹Q½…µ”¡Á½¥¹Ğ¹±¥•¹Ñ`°Á½¥¹Ğ¹±¥•¹Ñd¤ì(€€€ô((€€€™Õ¹Ñ¥½¸É•…Ñ•9…Ñ¥Ù•±•µ•¹Ğ¡±…ÍÍ9…µ”¥ì(€€€€€€€½¹ÍĞ½Ù•É±…ä€ô•Ñ=Ù•É±…ä ¤ì(€€€€€€€¥˜ …½Ù•É±…ä¥ì(€€€€€€€€€€€É•ÑÕÉ¸¹Õ±°ì(€€€€€€€ô((€€€€€€€½¹ÍĞ•°€ô‘½Õµ•¹Ğ¹É•…Ñ•±•µ•¹Ğ ‰‘¥Øˆ¤ì(€€€€€€€•°¹±…ÍÍ9…µ”€ô€‰…µ”µ¹…Ñ¥Ù”µ•±•µ•¹Ğ€ˆ€¬€¡±…ÍÍ9…µ”ñğ€ˆˆ¤ì(€€€€€€€½Ù•É±…ä¹…ÁÁ•¹‘¡¥±¡•°¤ì(€€€€€€€É•ÑÕÉ¸•°ì(€€€ô((€€€™Õ¹Ñ¥½¸Í•Ñ9…Ñ¥Ù•I•Ğ¡•°°à°ä°İ¥‘Ñ °¡•¥¡Ğ¥ì(€€€€€€€¥˜ …•°¤É•ÑÕÉ¸ì((€€€€€€€•°¹ÍÑå±”¹Á½Í¥Ñ¥½¸€ô€‰…‰Í½±ÕÑ”ˆì(€€€€€€€•°¹ÍÑå±”¹±•™Ğ€ôà€¬€‰Áàˆì(€€€€€€€•°¹ÍÑå±”¹Ñ½À€ôä€¬€‰Áàˆì(€€€€€€€•°¹ÍÑå±”¹İ¥‘Ñ €ôİ¥‘Ñ €¬€‰Áàˆì(€€€€€€€•°¹ÍÑå±”¹¡•¥¡Ğ€ô¡•¥¡Ğ€¬€‰Áàˆì(€€€ô((€€€™Õ¹Ñ¥½¸Í•Ñ9…Ñ¥Ù•A½Í¥Ñ¥½¸¡•°°à°ä¥ì(€€€€€€€¥˜ …•°¤É•ÑÕÉ¸ì((€€€€€€€•°¹ÍÑå±”¹Á½Í¥Ñ¥½¸€ô€‰…‰Í½±ÕÑ”ˆì(€€€€€€€•°¹ÍÑå±”¹±•™Ğ€ôà€¬€‰Áàˆì(€€€€€€€•°¹ÍÑå±”¹Ñ½À€ôä€¬€‰Áàˆì(€€€ô((€€€İ¥¹‘½Ü¹5}9Q%Y}]%Q €ô5}\ì(€€€İ¥¹‘½Ü¹5}9Q%Y}!%!P€ô5} ì((€€€İ¥¹‘½Ü¹ÍÉ••¹Q½…µ”€ôÍÉ••¹Q½…µ”ì(€€€İ¥¹‘½Ü¹…µ•Q½MÉ••¸€ô…µ•Q½MÉ••¸ì(€€€İ¥¹‘½Ü¹•Ù•¹ÑQ½…µ”€ô•Ù•¹ÑQ½…µ”ì(€€€İ¥¹‘½Ü¹É•…Ñ•9…Ñ¥Ù•…µ•±•µ•¹Ğ€ôÉ•…Ñ•9…Ñ¥Ù•±•µ•¹Ğì(€€€İ¥¹‘½Ü¹Í•Ñ9…Ñ¥Ù•…µ•I•Ğ€ôÍ•Ñ9…Ñ¥Ù•I•Ğì(€€€İ¥¹‘½Ü¹Í•Ñ9…Ñ¥Ù•…µ•A½Í¥Ñ¥½¸€ôÍ•Ñ9…Ñ¥Ù•A½Í¥Ñ¥½¸ì)ô¤ ¤ì(((¼¨‰Õ¹‘±•Í½ÕÉ”è©Ì¼ÀÌµÍÑ…”µØÄÀµ‰…ÑÑ±”µ±½œµÍÉ½±°µÉÕ¹Ñ¥µ”¹©Ì€¨¼(¡™Õ¹Ñ¥½¸ ¥ì(€€€€‰ÕÍ”ÍÑÉ¥Ğˆì((€€€™Õ¹Ñ¥½¸™¥¹‘MÉ½±±…‰±•	…ÑÑ±•A…¹•°¡Ñ…É•Ğ¥ì(€€€€€€€¥˜ …Ñ…É•Ğñğ€…Ñ…É•Ğ¹±½Í•ÍĞ¤É•ÑÕÉ¸¹Õ±°ì((€€€€€€€É•ÑÕÉ¸Ñ…É•Ğ¹±½Í•ÍĞ (€€€€€€€€€€€€m‘…Ñ„µ‰…ÑÑ±”µ±½œµÍÉ½±±t°œ€¬(€€€€€€€€€€€€œ¹‰…ÑÑ±”µ±½œµÍÉ½±±…‰±”°œ€¬(€€€€€€€€€€€€œ¹‰…ÑÑ±”µ±½œ°œ€¬(€€€€€€€€€€€€œ¹‰…ÑÑ±”µ¥¹™¼°œ€¬(€€€€€€€€€€€€œ¹‰…ÑÑ±”µ¥¹™¼µ‰½à°œ€¬(€€€€€€€€€€€€œ¹‰…ÑÑ±”µ±½œµ‰½à°œ€¬(€€€€€€€€€€€€œ¹‰…ÑÑ±”µ±½œµ½¹Ñ…¥¹•È°œ€¬(€€€€€€€€€€€€œ¹½µ‰…Ğµ±½œ°œ€¬(€€€€€€€€€€€€œ¹½µ‰…Ğµ±½œµ‰½à°œ€¬(€€€€€€€€€€€€œ¹‰…ÑÑ±”µÑ•áĞ°œ€¬(€€€€€€€€€€€€œ¹‰…ÑÑ±”µµ•ÍÍ…”µ±¥ÍĞœ(€€€€€€€€¤ì(€€€ô((€€€™Õ¹Ñ¥½¸…¹MÉ½±±Y•ÉÑ¥…±±ä¡•°¥ì(€€€€€€€¥˜ …•°¤É•ÑÕÉ¸™…±Í”ì((€€€€€€€½¹ÍĞÍÑå±”€ôİ¥¹‘½Ü¹•Ñ½µÁÕÑ•‘MÑå±”¡•°¤ì(€€€€€€€½¹ÍĞ½Ù•É™±½İd€ôÍÑå±”¹½Ù•É™±½İdì((€€€€€€€É•ÑÕÉ¸€ (€€€€€€€€€€€€¡½Ù•É™±½İd€ôôô€‰…ÕÑ¼ˆñğ½Ù•É™±½İd€ôôô€‰ÍÉ½±°ˆ¤€˜˜(€€€€€€€€€€€•°¹ÍÉ½±±!•¥¡Ğ€ø•°¹±¥•¹Ñ!•¥¡Ğ€¬€Ä(€€€€€€€€¤ì(€€€ô((€€€€¼¨(€€€€€¨5…É¬Ñ¡”…ÑÕ…°ÍÉ½±±…‰±”‰…ÑÑ±”±½œÍ¼Ñ¡”•á¥ÍÑ¥¹œ±½‰…°(€€€€€¨Ñ½Õ ±½¬…¸É•½¹¥é”¥Ğ¸(€€€€€¨¼(€€€™Õ¹Ñ¥½¸µ…É­	…ÑÑ±•MÉ½±±•ÉÌ ¥ì(€€€€€€€½¹ÍĞÍ•±•Ñ½ÉÌ€ôl(€€€€€€€€€€€€m±…ÍÌ¨ô‰‰…ÑÑ±”‰um±…ÍÌ¨ô‰±½œ‰tœ°(€€€€€€€€€€€€m±…ÍÌ¨ô‰‰…ÑÑ±”‰um±…ÍÌ¨ô‰¥¹™¼‰tœ°(€€€€€€€€€€€€m±…ÍÌ¨ô‰½µ‰…Ğ‰um±…ÍÌ¨ô‰±½œ‰tœ°(€€€€€€€€€€€€m¥¨ô‰‰…ÑÑ±”‰um¥¨ô‰±½œ‰tœ°(€€€€€€€€€€€€m¥¨ô‰‰…ÑÑ±”‰um¥¨ô‰¥¹™¼‰tœ°(€€€€€€€€€€€€m¥¨ô‰½µ‰…Ğ‰um¥¨ô‰±½œ‰tœ(€€€€€€€tì((€€€€€€€‘½Õµ•¹Ğ¹ÅÕ•ÉåM•±•Ñ½É±°¡Í•±•Ñ½ÉÌ¹©½¥¸ ˆ°ˆ¤¤¹™½É… ¡™Õ¹Ñ¥½¸¡•°¥ì(€€€€€€€€€€€¥˜¡…¹MÉ½±±Y•ÉÑ¥…±±ä¡•°¤¥ì(€€€€€€€€€€€€€€€•°¹Í•ÑÑÑÉ¥‰ÕÑ” ‰‘…Ñ„µ‰…ÑÑ±”µ±½œµÍÉ½±°ˆ°€‰ÑÉÕ”ˆ¤ì(€€€€€€€€€€€€€€€•°¹ÍÑå±”¹Ñ½Õ¡Ñ¥½¸€ô€‰Á…¸µäˆì(€€€€€€€€€€€ô(€€€€€€€ô¤ì(€€€ô((€€€€¼¨(€€€€€¨…ÁÑÕÉ”µÁ¡…Í”±¥ÍÑ•¹•ÈÉÕ¹Ì‰•™½É”Ñ¡”½±±½‰…°Ñ½Õ ±½¬¸(€€€€€¨½ÈÑ¡”…ÑÕ…°‰…ÑÑ±”±½œ°…±±½ÜÑ¡”‰É½İÍ•ÈÌÙ•ÉÑ¥…°ÍÉ½±°¸(€€€€€¨½È•Ù•ÉåÑ¡¥¹œ•±Í”°Ñ¡”•á¥ÍÑ¥¹œ…µ”µİ¥‘”±½¬É•µ…¥¹ÌÕ¹¡…¹•¸(€€€€€¨¼(€€€‘½Õµ•¹Ğ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰Ñ½Õ¡µ½Ù”ˆ°™Õ¹Ñ¥½¸¡•Ù•¹Ğ¥ì(€€€€€€€½¹ÍĞÍÉ½±±•È€ô™¥¹‘MÉ½±±…‰±•	…ÑÑ±•A…¹•°¡•Ù•¹Ğ¹Ñ…É•Ğ¤ì((€€€€€€€¥˜¡ÍÉ½±±•È€˜˜…¹MÉ½±±Y•ÉÑ¥…±±ä¡ÍÉ½±±•È¤¥ì(€€€€€€€€€€€•Ù•¹Ğ¹ÍÑ½Á%µµ•‘¥…Ñ•AÉ½Á……Ñ¥½¸ ¤ì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€ô(€€€ô°í…ÁÑÕÉ”éÑÉÕ”°Á…ÍÍ¥Ù”é™…±Í•ô¤ì((€€€‘½Õµ•¹Ğ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰Á½¥¹Ñ•Éµ½Ù”ˆ°™Õ¹Ñ¥½¸¡•Ù•¹Ğ¥ì(€€€€€€€¥˜¡•Ù•¹Ğ¹Á½¥¹Ñ•ÉQåÁ”€„ôô€‰Ñ½Õ ˆ¤É•ÑÕÉ¸ì((€€€€€€€½¹ÍĞÍÉ½±±•È€ô™¥¹‘MÉ½±±…‰±•	…ÑÑ±•A…¹•°¡•Ù•¹Ğ¹Ñ…É•Ğ¤ì((€€€€€€€¥˜¡ÍÉ½±±•È€˜˜…¹MÉ½±±Y•ÉÑ¥…±±ä¡ÍÉ½±±•È¤¥ì(€€€€€€€€€€€•Ù•¹Ğ¹ÍÑ½Á%µµ•‘¥…Ñ•AÉ½Á……Ñ¥½¸ ¤ì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€ô(€€€ô°í…ÁÑÕÉ”éÑÉÕ”°Á…ÍÍ¥Ù”é™…±Í•ô¤ì((€€€µ…É­	…ÑÑ±•MÉ½±±•ÉÌ ¤ì((€€€½¹ÍĞ½‰Í•ÉÙ•È€ô¹•Ü5ÕÑ…Ñ¥½¹=‰Í•ÉÙ•È¡™Õ¹Ñ¥½¸ ¥ì(€€€€€€€µ…É­	…ÑÑ±•MÉ½±±•ÉÌ ¤ì(€€€ô¤ì((€€€½‰Í•ÉÙ•È¹½‰Í•ÉÙ”¡‘½Õµ•¹Ğ¹‰½‘ä°ì(€€€€€€€¡¥±‘1¥ÍĞéÑÉÕ”°(€€€€€€€ÍÕ‰ÑÉ•”éÑÉÕ”°(€€€€€€€…ÑÑÉ¥‰ÕÑ•ÌéÑÉÕ”°(€€€€€€€…ÑÑÉ¥‰ÕÑ•¥±Ñ•Èél‰±…ÍÌˆ°‰ÍÑå±”‰t(€€€ô¤ì((€€€İ¥¹‘½Ü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰É•Í¥é”ˆ°µ…É­	…ÑÑ±•MÉ½±±•ÉÌ°íÁ…ÍÍ¥Ù”éÑÉÕ•ô¤ì)ô¤ ¤ì(((¼¨‰Õ¹‘±•Í½ÕÉ”è©Ì¼ÀĞµÍÑ…”µØÄÄµ¹…Ñ¥Ù”µ‰½ÑÑ½´µ¹…ØµÉÕ¹Ñ¥µ”¹©Ì€¨¼(¡™Õ¹Ñ¥½¸ ¥ì(€€€€‰ÕÍ”ÍÑÉ¥Ğˆì((€€€€¼¨(€€€€€¨½¹Ù•ÉĞÑ¡”•á¥ÍÑ¥¹œ‰½ÑÑ½´¹…Ù¥…Ñ¥½¸¥¹Ñ¼„¹…Ñ¥Ù”µ½½É‘¥¹…Ñ”(€€€€€¨½Ù•É±…äİ¥Ñ¡½ÕĞ¡…¹¥¹œ¥ÑÌ±¥¬¡…¹‘±•ÉÌ½È…µ”±½¥Œ¸(€€€€€¨(€€€€€¨]”±½¹”¹¼‰ÕÑÑ½¹Ì…¹‘¼¹½ĞÉ•Á±…”•á¥ÍÑ¥¹œ•Ù•¹Ğ±¥ÍÑ•¹•ÉÌ¸(€€€€€¨Q¡”½É¥¥¹…°¹…Ø¥Ìµ½Ù•¥¹Ñ¼Ñ¡”¹…Ñ¥Ù”½Ù•É±…ä±…å•È¸(€€€€€¨¼(€€€™Õ¹Ñ¥½¸µ¥É…Ñ•	½ÑÑ½µ9…Ø ¥ì(€€€€€€€½¹ÍĞ½Ù•É±…ä€ô‘½Õµ•¹Ğ¹•Ñ±•µ•¹Ñ	å% ‰…µ”µ½Ù•É±…äµ±…å•Èˆ¤ì(€€€€€€€¥˜ …½Ù•É±…ä¤É•ÑÕÉ¸ì((€€€€€€€½¹ÍĞ…¹‘¥‘…Ñ•Ì€ôl(€€€€€€€€€€€‘½Õµ•¹Ğ¹•Ñ±•µ•¹Ñ	å% ‰‰½ÑÑ½µ9…Øˆ¤°(€€€€€€€€€€€‘½Õµ•¹Ğ¹•Ñ±•µ•¹Ñ	å% ‰µ…ÁA…•9…Øˆ¤°(€€€€€€€€€€€‘½Õµ•¹Ğ¹ÅÕ•ÉåM•±•Ñ½È ˆ…µ”µ½¹Ñ•¹Ğ€¹‰½ÑÑ½´µ¹…Øˆ¤(€€€€€€€t¹™¥±Ñ•È¡	½½±•…¸¤ì((€€€€€€€…¹‘¥‘…Ñ•Ì¹™½É… ¡™Õ¹Ñ¥½¸¡¹…Ø¥ì(€€€€€€€€€€€¥˜ …¹…Øñğ¹…Ø¹‘…Ñ…Í•Ğ¹¹…Ñ¥Ù•XÄÄ€ôôô€‰ÑÉÕ”ˆ¤É•ÑÕÉ¸ì((€€€€€€€€€€€€¼¨(€€€€€€€€€€€€€¨=¹±äµ¥É…Ñ”¹…Ø•±•µ•¹ÑÌÑ¡…Ğ…É”…ÑÕ…°…µ”¹…Ù¥…Ñ¥½¸¸(€€€€€€€€€€€€€¨¼¹½ĞÑ½Õ Õ¹É•±…Ñ•™¥á•½¹ÑÉ½±Ì¸(€€€€€€€€€€€€€¨¼(€€€€€€€€€€€½¹ÍĞ¥Í	½ÑÑ½µ9…Ø€ô(€€€€€€€€€€€€€€€¹…Ø¹¥€ôôô€‰‰½ÑÑ½µ9…Øˆñğ(€€€€€€€€€€€€€€€¹…Ø¹¥€ôôô€‰µ…ÁA…•9…Øˆñğ(€€€€€€€€€€€€€€€¹…Ø¹±…ÍÍ1¥ÍĞ¹½¹Ñ…¥¹Ì ‰‰½ÑÑ½´µ¹…Øˆ¤ì((€€€€€€€€€€€¥˜ …¥Í	½ÑÑ½µ9…Ø¤É•ÑÕÉ¸ì((€€€€€€€€€€€½¹ÍĞİÉ…ÁÁ•È€ô‘½Õµ•¹Ğ¹É•…Ñ•±•µ•¹Ğ ‰‘¥Øˆ¤ì(€€€€€€€€€€€İÉ…ÁÁ•È¹±…ÍÍ9…µ”€ô€‰¹…Ñ¥Ù”µ‰½ÑÑ½´µ¹…Øµ±…å•Èˆì(€€€€€€€€€€€İÉ…ÁÁ•È¹‘…Ñ…Í•Ğ¹¹…Ñ¥Ù•XÄÄ€ô€‰ÑÉÕ”ˆì((€€€€€€€€€€€½¹ÍĞ¹…Ñ¥Ù•9…Ø€ô‘½Õµ•¹Ğ¹É•…Ñ•±•µ•¹Ğ ‰‘¥Øˆ¤ì(€€€€€€€€€€€¹…Ñ¥Ù•9…Ø¹±…ÍÍ9…µ”€ô€‰¹…Ñ¥Ù”µ‰½ÑÑ½´µ¹…Øˆì(€€€€€€€€€€€¹…Ñ¥Ù•9…Ø¹‘…Ñ…Í•Ğ¹¹…Ñ¥Ù•XÄÄ€ô€‰ÑÉÕ”ˆì((€€€€€€€€€€€€¼¨(€€€€€€€€€€€€€¨5½Ù”Ñ¡”•á¥ÍÑ¥¹œ•±•µ•¹Ğ°ÁÉ•Í•ÉÙ¥¹œ¥ÑÌ•á¥ÍÑ¥¹œ=4°(€€€€€€€€€€€€€¨¡¥±‘É•¸°%Ì°…¹•Ù•¹Ğ±¥ÍÑ•¹•ÉÌ¸(€€€€€€€€€€€€€¨¼(€€€€€€€€€€€¹…Ø¹Á…É•¹Ñ9½‘”¹¥¹Í•ÉÑ	•™½É”¡İÉ…ÁÁ•È°¹…Ø¤ì(€€€€€€€€€€€İÉ…ÁÁ•È¹…ÁÁ•¹‘¡¥±¡¹…Ñ¥Ù•9…Ø¤ì(€€€€€€€€€€€¹…Ñ¥Ù•9…Ø¹…ÁÁ•¹‘¡¥±¡¹…Ø¤ì((€€€€€€€€€€€€¼¨(€€€€€€€€€€€€€¨I•µ½Ù”±•…äÙ¥•İÁ½ÉĞÁ½Í¥Ñ¥½¹¥¹œ™É½´Ñ¡”µ½Ù••±•µ•¹Ğ¸(€€€€€€€€€€€€€¨%ÑÌÙ¥ÍÕ…°Í¥é”¥ÌÁÉ•Í•ÉÙ•‰äÑ¡”•á¥ÍÑ¥¹œ¡¥±ÍÑå±•Ì¸(€€€€€€€€€€€€€¨¼(€€€€€€€€€€€¹…Ø¹ÍÑå±”¹Á½Í¥Ñ¥½¸€ô€‰É•±…Ñ¥Ù”ˆì(€€€€€€€€€€€¹…Ø¹ÍÑå±”¹±•™Ğ€ô€‰…ÕÑ¼ˆì(€€€€€€€€€€€¹…Ø¹ÍÑå±”¹É¥¡Ğ€ô€‰…ÕÑ¼ˆì(€€€€€€€€€€€¹…Ø¹ÍÑå±”¹Ñ½À€ô€‰…ÕÑ¼ˆì(€€€€€€€€€€€¹…Ø¹ÍÑå±”¹‰½ÑÑ½´€ô€‰…ÕÑ¼ˆì(€€€€€€€€€€€¹…Ø¹ÍÑå±”¹ÑÉ…¹Í™½É´€ô€‰¹½¹”ˆì(€€€€€€€€€€€¹…Ø¹ÍÑå±”¹µ…É¥¹1•™Ğ€ô€ˆÀˆì(€€€€€€€€€€€¹…Ø¹ÍÑå±”¹µ…É¥¹I¥¡Ğ€ô€ˆÀˆì(€€€€€€€€€€€¹…Ø¹ÍÑå±”¹İ¥‘Ñ €ô€ˆÄÀÀ”ˆì((€€€€€€€€€€€¹…Ø¹‘…Ñ…Í•Ğ¹¹…Ñ¥Ù•XÄÄ€ô€‰ÑÉÕ”ˆì(€€€€€€€ô¤ì(€€€ô((€€€€¼¨(€€€€€¨IÕ¸…™Ñ•È•á¥ÍÑ¥¹œ¥¹¥Ñ¥…±¥é…Ñ¥½¸…¹…™Ñ•È=4¡…¹•Ì¸(€€€€€¨Q¡¥Ì¥Ìµ¥É…Ñ¥½¸µ½¹±äì¥Ğ‘½•Ì¹½Ğ…±Ñ•È…µ”µ•¡…¹¥Ì¸(€€€€€¨¼(€€€¥˜¡‘½Õµ•¹Ğ¹É•…‘åMÑ…Ñ”€ôôô€‰±½…‘¥¹œˆ¥ì(€€€€€€€‘½Õµ•¹Ğ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰=5½¹Ñ•¹Ñ1½…‘•ˆ°µ¥É…Ñ•	½ÑÑ½µ9…Ø°í½¹”éÑÉÕ•ô¤ì(€€€õ•±Í•ì(€€€€€€€µ¥É…Ñ•	½ÑÑ½µ9…Ø ¤ì(€€€ô((€€€½¹ÍĞ½‰Í•ÉÙ•È€ô¹•Ü5ÕÑ…Ñ¥½¹=‰Í•ÉÙ•È¡™Õ¹Ñ¥½¸ ¥ì(€€€€€€€µ¥É…Ñ•	½ÑÑ½µ9…Ø ¤ì(€€€ô¤ì((€€€½‰Í•ÉÙ•È¹½‰Í•ÉÙ”¡‘½Õµ•¹Ğ¹‰½‘ä°ì(€€€€€€€¡¥±‘1¥ÍĞéÑÉÕ”°(€€€€€€€ÍÕ‰ÑÉ•”éÑÉÕ”(€€€ô¤ì((€€€İ¥¹‘½Ü¹µ¥É…Ñ•	½ÑÑ½µ9…ÙQ½9…Ñ¥Ù”ÄÀàÀ€ôµ¥É…Ñ•	½ÑÑ½µ9…Øì)ô¤ ¤ì(((¼¨‰Õ¹‘±•Í½ÕÉ”è©Ì¼ÀÔµÍÑ…”µØÄÌµ¹…Ñ¥Ù”µµ…Àµ¹…ØµÉÕ¹Ñ¥µ”¹©Ì€¨¼(¡™Õ¹Ñ¥½¸ ¥ì(€€€€‰ÕÍ”ÍÑÉ¥Ğˆì((€€€™Õ¹Ñ¥½¸µ¥É…Ñ•5…Á9…Ø ¥ì(€€€€€€€½¹ÍĞ½Ù•É±…ä€ô‘½Õµ•¹Ğ¹•Ñ±•µ•¹Ñ	å% ‰…µ”µ½Ù•É±…äµ±…å•Èˆ¤ì(€€€€€€€¥˜ …½Ù•É±…ä¤É•ÑÕÉ¸ì((€€€€€€€½¹ÍĞ¹…Ø€ô‘½Õµ•¹Ğ¹•Ñ±•µ•¹Ñ	å% ‰µ…ÁA…•9…Øˆ¤ì(€€€€€€€¥˜ …¹…Øñğ¹…Ø¹‘…Ñ…Í•Ğ¹¹…Ñ¥Ù•XÄÌ€ôôô€‰ÑÉÕ”ˆ¤É•ÑÕÉ¸ì((€€€€€€€€¼¨(€€€€€€€€€¨=¹±äµ¥É…Ñ”Ñ¡”µ…À½ÑÉ…¥¹¥¹œ¹…Ù¥…Ñ¥½¸¸(€€€€€€€€€¨á¥ÍÑ¥¹œ=4°¡¥±‘É•¸°%Ì…¹•Ù•¹Ğ±¥ÍÑ•¹•ÉÌ…É”ÁÉ•Í•ÉÙ•¸(€€€€€€€€€¨¼(€€€€€€€½¹ÍĞİÉ…ÁÁ•È€ô‘½Õµ•¹Ğ¹É•…Ñ•±•µ•¹Ğ ‰‘¥Øˆ¤ì(€€€€€€€İÉ…ÁÁ•È¹±…ÍÍ9…µ”€ô€‰¹…Ñ¥Ù”µµ…Àµ¹…Øµ±…å•Èˆì(€€€€€€€İÉ…ÁÁ•È¹‘…Ñ…Í•Ğ¹¹…Ñ¥Ù•XÄÌ€ô€‰ÑÉÕ”ˆì((€€€€€€€½¹ÍĞ¹…Ñ¥Ù•9…Ø€ô‘½Õµ•¹Ğ¹É•…Ñ•±•µ•¹Ğ ‰‘¥Øˆ¤ì(€€€€€€€¹…Ñ¥Ù•9…Ø¹±…ÍÍ9…µ”€ô€‰¹…Ñ¥Ù”µµ…Àµ¹…Øˆì(€€€€€€€¹…Ñ¥Ù•9…Ø¹‘…Ñ…Í•Ğ¹¹…Ñ¥Ù•XÄÌ€ô€‰ÑÉÕ”ˆì((€€€€€€€¹…Ø¹Á…É•¹Ñ9½‘”¹¥¹Í•ÉÑ	•™½É”¡İÉ…ÁÁ•È°¹…Ø¤ì(€€€€€€€İÉ…ÁÁ•È¹…ÁÁ•¹‘¡¥±¡¹…Ñ¥Ù•9…Ø¤ì(€€€€€€€¹…Ñ¥Ù•9…Ø¹…ÁÁ•¹‘¡¥±¡¹…Ø¤ì((€€€€€€€¹…Ø¹ÍÑå±”¹Á½Í¥Ñ¥½¸€ô€‰É•±…Ñ¥Ù”ˆì(€€€€€€€¹…Ø¹ÍÑå±”¹±•™Ğ€ô€‰…ÕÑ¼ˆì(€€€€€€€¹…Ø¹ÍÑå±”¹É¥¡Ğ€ô€‰…ÕÑ¼ˆì(€€€€€€€¹…Ø¹ÍÑå±”¹Ñ½À€ô€‰…ÕÑ¼ˆì(€€€€€€€¹…Ø¹ÍÑå±”¹‰½ÑÑ½´€ô€‰…ÕÑ¼ˆì(€€€€€€€¹…Ø¹ÍÑå±”¹ÑÉ…¹Í™½É´€ô€‰¹½¹”ˆì(€€€€€€€¹…Ø¹ÍÑå±”¹µ…É¥¹1•™Ğ€ô€ˆÀˆì(€€€€€€€¹…Ø¹ÍÑå±”¹µ…É¥¹I¥¡Ğ€ô€ˆÀˆì(€€€€€€€¹…Ø¹ÍÑå±”¹İ¥‘Ñ €ô€ˆÄÀÀ”ˆì((€€€€€€€¹…Ø¹‘…Ñ…Í•Ğ¹¹…Ñ¥Ù•XÄÌ€ô€‰ÑÉÕ”ˆì(€€€ô((€€€¥˜¡‘½Õµ•¹Ğ¹É•…‘åMÑ…Ñ”€ôôô€‰±½…‘¥¹œˆ¥ì(€€€€€€€‘½Õµ•¹Ğ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰=5½¹Ñ•¹Ñ1½…‘•ˆ°µ¥É…Ñ•5…Á9…Ø°í½¹”éÑÉÕ•ô¤ì(€€€õ•±Í•ì(€€€€€€€µ¥É…Ñ•5…Á9…Ø ¤ì(€€€ô((€€€½¹ÍĞ½‰Í•ÉÙ•È€ô¹•Ü5ÕÑ…Ñ¥½¹=‰Í•ÉÙ•È¡™Õ¹Ñ¥½¸ ¥ì(€€€€€€€µ¥É…Ñ•5…Á9…Ø ¤ì(€€€ô¤ì((€€€½‰Í•ÉÙ•È¹½‰Í•ÉÙ”¡‘½Õµ•¹Ğ¹‰½‘ä°ì(€€€€€€€¡¥±‘1¥ÍĞéÑÉÕ”°(€€€€€€€ÍÕ‰ÑÉ•”éÑÉÕ”(€€€ô¤ì((€€€İ¥¹‘½Ü¹µ¥É…Ñ•5…Á9…ÙQ½9…Ñ¥Ù”ÄÀàÀ€ôµ¥É…Ñ•5…Á9…Øì)ô¤ ¤ì(((¼¨‰Õ¹‘±•Í½ÕÉ”è©Ì¼ÀØµÍÑ…”µØÌäµ‰…ÑÑ±”µµ…Àµ‰…­É½Õ¹µÉÕ¹Ñ¥µ”¹©Ì€¨¼(¡™Õ¹Ñ¥½¸ ¥ì(€€€€‰ÕÍ”ÍÑÉ¥Ğˆì((€€€İ¥¹‘½Ü¹5}9Q%Y}=9%I5}	M1%9€ô€‰XÌàˆì(€€€İ¥¹‘½Ü¹5}9Q%Y}UII9Q}YIM%=8€ô€‰XÌäˆì((€€€€¼¨(€€€€€¨XÌäµ…Àµ‰…­É½Õ¹‰É¥‘”¸(€€€€€¨(€€€€€¨AÉ¥½É¥Ñäè(€€€€€¨€€Ä¤á¥ÍÑ¥¹œÕÉÉ•¹ĞÁ…ÑÉ½°½µ…À‰…­É½Õ¹•±•µ•¹ĞÌ½µÁÕÑ•½ÕÉÉ•¹Ğ(€€€€€¨€€€€‰…­É½Õ¹¥µ…”¸(€€€€€¨€€È¤á¥ÍÑ¥¹œµ…À‘…Ñ„½‰…­É½Õ¹Ù…É¥…‰±•Ì¥˜•áÁ½Í•‰äÑ¡”…µ”¸(€€€€€¨(€€€€€¨]”‘¼¹½ĞÉ•Á±…”Ñ¡”…µ”Ìµ…ÀÍÑ…Ñ”½È‰…ÑÑ±”ÍÑ…Ñ”¸(€€€€€¨¼((€€€™Õ¹Ñ¥½¸•Ñ	…ÑÑ±•A…” ¥ì(€€€€€€€É•ÑÕÉ¸‘½Õµ•¹Ğ¹•Ñ±•µ•¹Ñ	å% ‰‰…ÑÑ±•A…”ˆ¤ì(€€€ô((€€€™Õ¹Ñ¥½¸•ÑA…ÑÉ½±5…Á	…­É½Õ¹ ¥ì(€€€€€€€½¹ÍĞ…¹‘¥‘…Ñ•Ì€ôl(€€€€€€€€€€€‘½Õµ•¹Ğ¹•Ñ±•µ•¹Ñ	å% ‰Á…ÑÉ½±A…”ˆ¤°(€€€€€€€€€€€‘½Õµ•¹Ğ¹•Ñ±•µ•¹Ñ	å% ‰µ…ÁA…”ˆ¤°(€€€€€€€€€€€‘½Õµ•¹Ğ¹•Ñ±•µ•¹Ñ	å% ‰ÑÉ…¥¹¥¹A…”ˆ¤°(€€€€€€€€€€€‘½Õµ•¹Ğ¹•Ñ±•µ•¹Ñ	å% ‰µ…Á	…­É½Õ¹ˆ¤°(€€€€€€€€€€€‘½Õµ•¹Ğ¹ÅÕ•ÉåM•±•Ñ½È ˆ…µ”µ½¹Ñ•¹Ğ€¹µ…Àµ‰…­É½Õ¹ˆ¤°(€€€€€€€€€€€‘½Õµ•¹Ğ¹ÅÕ•ÉåM•±•Ñ½È ˆ…µ”µ½¹Ñ•¹Ğ€¹Á…ÑÉ½°µ‰…­É½Õ¹ˆ¤°(€€€€€€€€€€€‘½Õµ•¹Ğ¹ÅÕ•ÉåM•±•Ñ½È ˆ…µ”µ½¹Ñ•¹Ğ€¹ÑÉ…¥¹¥¹œµ‰…­É½Õ¹ˆ¤(€€€€€€€t¹™¥±Ñ•È¡	½½±•…¸¤ì((€€€€€€€™½È¡½¹ÍĞ•°½˜…¹‘¥‘…Ñ•Ì¥ì(€€€€€€€€€€€½¹ÍĞÌ€ô•Ñ½µÁÕÑ•‘MÑå±”¡•°¤ì(€€€€€€€€€€€½¹ÍĞ‰œ€ôÌ¹‰…­É½Õ¹‘%µ…”ì(€€€€€€€€€€€¥˜¡‰œ€˜˜‰œ€„ôô€‰¹½¹”ˆ¥ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸‰œì(€€€€€€€€€€€ô(€€€€€€€€€€€½¹ÍĞ¥¹±¥¹”€ô•°¹ÍÑå±”¹‰…­É½Õ¹‘%µ…”ì(€€€€€€€€€€€¥˜¡¥¹±¥¹”¥ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸¥¹±¥¹”ì(€€€€€€€€€€€ô(€€€€€€€ô(€€€€€€€É•ÑÕÉ¸¹Õ±°ì(€€€ô((€€€™Õ¹Ñ¥½¸…ÁÁ±åÕÉÉ•¹Ñ5…Á	…­É½Õ¹ ¥ì(€€€€€€€½¹ÍĞ‰…ÑÑ±”€ô•Ñ	…ÑÑ±•A…” ¤ì(€€€€€€€¥˜ …‰…ÑÑ±”¤É•ÑÕÉ¸™…±Í”ì((€€€€€€€½¹ÍĞ‰œ€ô•ÑA…ÑÉ½±5…Á	…­É½Õ¹ ¤ì(€€€€€€€¥˜ …‰œ¤É•ÑÕÉ¸™…±Í”ì((€€€€€€€‰…ÑÑ±”¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ‰‰…­É½Õ¹µ¥µ…”ˆ°‰œ°€‰¥µÁ½ÉÑ…¹Ğˆ¤ì(€€€€€€€‰…ÑÑ±”¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ‰‰…­É½Õ¹µÍ¥é”ˆ°€‰½Ù•Èˆ°€‰¥µÁ½ÉÑ…¹Ğˆ¤ì(€€€€€€€‰…ÑÑ±”¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ‰‰…­É½Õ¹µÁ½Í¥Ñ¥½¸ˆ°€‰•¹Ñ•Èˆ°€‰¥µÁ½ÉÑ…¹Ğˆ¤ì(€€€€€€€‰…ÑÑ±”¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ‰‰…­É½Õ¹µÉ•Á•…Ğˆ°€‰¹¼µÉ•Á•…Ğˆ°€‰¥µÁ½ÉÑ…¹Ğˆ¤ì((€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€ô((€€€€¼¨(€€€€€¨	…ÑÑ±”µ…ä‰”É•¹‘•É•…™Ñ•Èµ…À¹…Ù¥…Ñ¥½¸¸=‰Í•ÉÙ”½¹±äÑ¡”(€€€€€¨…µ”µ½¹Ñ•¹ĞÍÕ‰ÑÉ•”™½È‰…ÑÑ±•A…”½µ…ÀµÁ…”¡…¹•Ì…¹É•…ÁÁ±ä(€€€€€¨Ñ¡”ÕÉÉ•¹Ğµ…À¥µ…”¸Q¡¥Ì‘½•Ì¹½Ğ…±Ñ•È‰…ÑÑ±”µ•¡…¹¥Ì¸(€€€€€¨¼(€€€™Õ¹Ñ¥½¸¥¹¥Ğ ¥ì(€€€€€€€…ÁÁ±åÕÉÉ•¹Ñ5…Á	…­É½Õ¹ ¤ì((€€€€€€€½¹ÍĞÉ½½Ğ€ô‘½Õµ•¹Ğ¹•Ñ±•µ•¹Ñ	å% ‰…µ”µ½¹Ñ•¹Ğˆ¤ñğ(€€€€€€€€€€€€€€€€€€€€‘½Õµ•¹Ğ¹•Ñ±•µ•¹Ñ	å% ‰…µ”µÍÑ…”ˆ¤ì(€€€€€€€¥˜ …É½½Ğ¤É•ÑÕÉ¸ì((€€€€€€€½¹ÍĞ½‰Í•ÉÙ•È€ô¹•Ü5ÕÑ…Ñ¥½¹=‰Í•ÉÙ•È¡™Õ¹Ñ¥½¸ ¥ì(€€€€€€€€€€€¥˜¡‘½Õµ•¹Ğ¹•Ñ±•µ•¹Ñ	å% ‰‰…ÑÑ±•A…”ˆ¤¥ì(€€€€€€€€€€€€€€€…ÁÁ±åÕÉÉ•¹Ñ5…Á	…­É½Õ¹ ¤ì(€€€€€€€€€€€ô(€€€€€€€ô¤ì((€€€€€€€½‰Í•ÉÙ•È¹½‰Í•ÉÙ”¡É½½Ğ°í¡¥±‘1¥ÍĞéÑÉÕ”°ÍÕ‰ÑÉ•”éÑÉÕ•ô¤ì((€€€€€€€İ¥¹‘½Ü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰É•Í¥é”ˆ°…ÁÁ±åÕÉÉ•¹Ñ5…Á	…­É½Õ¹¤ì(€€€ô((€€€İ¥¹‘½Ü¹Íå¹	…ÑÑ±•	…­É½Õ¹‘Q½ÕÉÉ•¹Ñ5…À€ô…ÁÁ±åÕÉÉ•¹Ñ5…Á	…­É½Õ¹ì((€€€¥˜¡‘½Õµ•¹Ğ¹É•…‘åMÑ…Ñ”€ôôô€‰±½…‘¥¹œˆ¥ì(€€€€€€€‘½Õµ•¹Ğ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰=5½¹Ñ•¹Ñ1½…‘•ˆ°¥¹¥Ğ°í½¹”éÑÉÕ•ô¤ì(€€€õ•±Í•ì(€€€€€€€¥¹¥Ğ ¤ì(€€€ô)ô¤ ¤ì(((¼¨‰Õ¹‘±•Í½ÕÉ”è©Ì¼ÀÜµÍÑ…”µØĞÀµÉ½½Ğµ‰…ÑÑ±”µ‰…­É½Õ¹µÉÕ¹Ñ¥µ”¹©Ì€¨¼(¡™Õ¹Ñ¥½¸ ¥ì(€€€€‰ÕÍ”ÍÑÉ¥Ğˆì((€€€İ¥¹‘½Ü¹5}9Q%Y}=9%I5}	M1%9€ô€‰XÌäˆì(€€€İ¥¹‘½Ü¹5}9Q%Y}UII9Q}YIM%=8€ô€‰XĞÀˆì((€€€½¹ÍĞ1e}]%Q €ô€ĞÈÀì(€€€½¹ÍĞ9Q%Y}]%Q €ô€ÄÀàÀì(€€€½¹ÍĞ!IQI}I}1e}]%Q €ô€ÄÈĞì(€€€½¹ÍĞMQ}	}9Q%Y}]%Q €ô(€€€€€€€!IQI}I}1e}]%Q €¨€¡9Q%Y}]%Q €¼1e}]%Q ¤ì((€€€™Õ¹Ñ¥½¸•¹ÍÕÉ•	…ÑÑ±•	…­É½Õ¹‘1…å•È ¥ì(€€€€€€€½¹ÍĞ‰…ÑÑ±”€ô‘½Õµ•¹Ğ¹•Ñ±•µ•¹Ñ	å% ‰‰…ÑÑ±•A…”ˆ¤ì(€€€€€€€¥˜ …‰…ÑÑ±”¤É•ÑÕÉ¸¹Õ±°ì((€€€€€€€±•Ğ±…å•È€ô‰…ÑÑ±”¹ÅÕ•ÉåM•±•Ñ½È ˆéÍ½Á”€ø€¹‰…ÑÑ±”µ‰œµÍ¡…É•ˆ¤ì(€€€€€€€¥˜ …±…å•È¥ì(€€€€€€€€€€€±…å•È€ô‘½Õµ•¹Ğ¹É•…Ñ•±•µ•¹Ğ ‰‘¥Øˆ¤ì(€€€€€€€€€€€±…å•È¹±…ÍÍ9…µ”€ô€‰‰…ÑÑ±”µ‰œµÍ¡…É•ˆì(€€€€€€€€€€€±…å•È¹Í•ÑÑÑÉ¥‰ÕÑ” ‰…É¥„µ¡¥‘‘•¸ˆ°‰ÑÉÕ”ˆ¤ì(€€€€€€€€€€€‰…ÑÑ±”¹¥¹Í•ÉÑ	•™½É”¡±…å•È°‰…ÑÑ±”¹™¥ÉÍÑ¡¥±¤ì(€€€€€€€ô(€€€€€€€É•ÑÕÉ¸±…å•Èì(€€€ô((€€€™Õ¹Ñ¥½¸•ÑÑÕ…±A…ÑÉ½±	…­É½Õ¹ ¥ì(€€€€€€€€¼¨(€€€€€€€€€¨M=UI=QIUQ è(€€€€€€€€€¨•¹Ñ•É5…À ¤…±±Ì…ÁÁ±å5…Ái½¹•	…­É½Õ¹¡ÕÉÉ•¹Ñi½¹”¤°(€€€€€€€€€¨İ¡¥ İÉ¥Ñ•ÌÑ¡”ÕÉÉ•¹Ğµ…À¥µ…”Ñ¼€µ…ÁA…•	1…å•È¸(€€€€€€€€€¨(€€€€€€€€€¨]”É•…Ñ¡…Ğ•á…ĞÉ•¹‘•É•±…å•ÈÉ…Ñ¡•ÈÑ¡…¸Õ•ÍÍ¥¹œ(€€€€€€€€€¨™É½´€µ…ÁA…”¥ÑÍ•±˜¸(€€€€€€€€€¨¼(€€€€€€€½¹ÍĞµ…Á1…å•È€ô‘½Õµ•¹Ğ¹•Ñ±•µ•¹Ñ	å% ‰µ…ÁA…•	1…å•Èˆ¤ì(€€€€€€€¥˜¡µ…Á1…å•È¥ì(€€€€€€€€€€€½¹ÍĞ‰œ€ô•Ñ½µÁÕÑ•‘MÑå±”¡µ…Á1…å•È¤¹‰…­É½Õ¹‘%µ…”ì(€€€€€€€€€€€¥˜¡‰œ€˜˜‰œ€„ôô€‰¹½¹”ˆ¥ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸‰œì(€€€€€€€€€€€ô(€€€€€€€€€€€¥˜¡µ…Á1…å•È¹ÍÑå±”¹‰…­É½Õ¹‘%µ…”¥ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸µ…Á1…å•È¹ÍÑå±”¹‰…­É½Õ¹‘%µ…”ì(€€€€€€€€€€€ô(€€€€€€€ô((€€€€€€€€¼¨(€€€€€€€€€¨…±±‰…¬½¹±ä¥˜Ñ¡”µ…À±…å•È¥Ì¹½Ğ…Ù…¥±…‰±”è(€€€€€€€€€¨ÕÍ”Ñ¡”…µ”Ì…ÑÕ…°µ…Àµé½¹”Ñ…‰±”…¹ÕÉÉ•¹Ñi½¹”¸(€€€€€€€€€¨¼(€€€€€€€ÑÉåì(€€€€€€€€€€€¥˜¡ÑåÁ•½˜µ…Ái½¹•	…­É½Õ¹‘%µ…•Ì€„ôô€‰Õ¹‘•™¥¹•ˆ¥ì(€€€€€€€€€€€€€€€½¹ÍĞÕÉ°€ôµ…Ái½¹•	…­É½Õ¹‘%µ…•ÍmÕÉÉ•¹Ñi½¹•tñğ(€€€€€€€€€€€€€€€€€€€€€€€€€€€µ…Ái½¹•	…­É½Õ¹‘%µ…•Ì¹™½É•ÍĞì(€€€€€€€€€€€€€€€¥˜¡ÕÉ°¥ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸€‰ÕÉ° ˆ€¬ÕÉ°€¬€ˆ¤ˆì(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€ô(€€€€€€€õ…Ñ ¡”¥íô((€€€€€€€É•ÑÕÉ¸¹Õ±°ì(€€€ô((€€€™Õ¹Ñ¥½¸Íå¹	…ÑÑ±•	…­É½Õ¹‘Q½ÕÉÉ•¹Ñ5…À ¥ì(€€€€€€€½¹ÍĞ±…å•È€ô•¹ÍÕÉ•	…ÑÑ±•	…­É½Õ¹‘1…å•È ¤ì(€€€€€€€¥˜ …±…å•È¤É•ÑÕÉ¸™…±Í”ì((€€€€€€€½¹ÍĞ‰œ€ô•ÑÑÕ…±A…ÑÉ½±	…­É½Õ¹ ¤ì(€€€€€€€¥˜ …‰œ¤É•ÑÕÉ¸™…±Í”ì((€€€€€€€±…å•È¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ‰‰…­É½Õ¹µ¥µ…”ˆ°€‰±¥¹•…ÈµÉ…‘¥•¹Ğ¡É‰„ À°À°À°¸ÔÈ¤°É‰„ À°À°À°¸ÔÈ¤¤°€ˆ€¬‰œ°€‰¥µÁ½ÉÑ…¹Ğˆ¤ì(€€€€€€€±…å•È¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ‰‰…­É½Õ¹µÍ¥é”ˆ°€‰½Ù•Èˆ°€‰¥µÁ½ÉÑ…¹Ğˆ¤ì(€€€€€€€±…å•È¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ‰‰…­É½Õ¹µÁ½Í¥Ñ¥½¸ˆ°€‰•¹Ñ•ÈÑ½Àˆ°€‰¥µÁ½ÉÑ…¹Ğˆ¤ì(€€€€€€€±…å•È¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ‰‰…­É½Õ¹µÉ•Á•…Ğˆ°€‰¹¼µÉ•Á•…Ğˆ°€‰¥µÁ½ÉÑ…¹Ğˆ¤ì((€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€ô((€€€™Õ¹Ñ¥½¸•¹ÍÕÉ•…ÍÑ	…‘•M½ÕÉ•M¥é”¡‰…‘”¥ì(€€€€€€€¥˜ …‰…‘”ñğ€…‰…‘”¹±…ÍÍ1¥ÍĞ¹½¹Ñ…¥¹Ì ‰Í­¥±°µ¹…µ”µ‰…‘”ˆ¤¤É•ÑÕÉ¸ì(€€€€€€€€¼¨(€€€€€€€€€¨Q¡¥Ì¥Ì¹…Ñ¥Ù”µ½Ù•É±…äÍÁ…”°Í¼µ…Ñ Ñ¡”±•…ä…Éè(€€€€€€€€€¨€ÄÈĞ±•…äÁàƒ\€È¸ÔÜÄĞÈà¸¸¸€ô€ÌÄà¸àÔÜ¹…Ñ¥Ù”Áà¸(€€€€€€€€€¨¼(€€€€€€€‰…‘”¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä (€€€€€€€€€€€€‰İ¥‘Ñ ˆ°(€€€€€€€€€€€MQ}	}9Q%Y}]%Q €¬€‰Áàˆ°(€€€€€€€€€€€€‰¥µÁ½ÉÑ…¹Ğˆ(€€€€€€€€¤ì(€€€€€€€‰…‘”¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä (€€€€€€€€€€€€‰µ¥¸µİ¥‘Ñ ˆ°(€€€€€€€€€€€MQ}	}9Q%Y}]%Q €¬€‰Áàˆ°(€€€€€€€€€€€€‰¥µÁ½ÉÑ…¹Ğˆ(€€€€€€€€¤ì(€€€€€€€‰…‘”¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä (€€€€€€€€€€€€‰µ…àµİ¥‘Ñ ˆ°(€€€€€€€€€€€MQ}	}9Q%Y}]%Q €¬€‰Áàˆ°(€€€€€€€€€€€€‰¥µÁ½ÉÑ…¹Ğˆ(€€€€€€€€¤ì(€€€€€€€‰…‘”¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ‰™½¹ĞµÍ¥é”ˆ°ˆÜÉÁàˆ°‰¥µÁ½ÉÑ…¹Ğˆ¤ì(€€€€€€€‰…‘”¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ‰™½¹Ğµİ•¥¡Ğˆ°ˆäÀÀˆ°‰¥µÁ½ÉÑ…¹Ğˆ¤ì(€€€€€€€‰…‘”¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ‰Ñ•áĞµ…±¥¸ˆ°‰•¹Ñ•Èˆ°‰¥µÁ½ÉÑ…¹Ğˆ¤ì(€€€€€€€‰…‘”¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ‰İ¡¥Ñ”µÍÁ…”ˆ°‰¹½İÉ…Àˆ°‰¥µÁ½ÉÑ…¹Ğˆ¤ì(€€€ô((€€€€¼¨(€€€€€¨Q¡”Í­¥±°‰…‘”¥Ì‘å¹…µ¥…±±äÉ•…Ñ•‰ä(€€€€€¨Í¡½İM­¥±±9…µ•	…‘” ¤½Í¡½İ5½¹ÍÑ•ÉM­¥±±9…µ•	…‘” ¤¸(€€€€€¨…Ñ Ñ¡”É•…°¹½‘”…ĞÉ•…Ñ¥½¸Ñ¥µ”¸(€€€€€¨¼(€€€™Õ¹Ñ¥½¸İ…Ñ¡=Ù•É±…ä ¥ì(€€€€€€€½¹ÍĞ½Ù•É±…ä€ô‘½Õµ•¹Ğ¹•Ñ±•µ•¹Ñ	å% ‰…µ”µ½Ù•É±…äµ±…å•Èˆ¤ì(€€€€€€€¥˜ …½Ù•É±…ä¤É•ÑÕÉ¸ì((€€€€€€€½Ù•É±…ä¹ÅÕ•ÉåM•±•Ñ½É±° ˆ¹Í­¥±°µ¹…µ”µ‰…‘”ˆ¤(€€€€€€€€€€€€¹™½É… ¡•¹ÍÕÉ•…ÍÑ	…‘•M½ÕÉ•M¥é”¤ì((€€€€€€€½¹ÍĞ½‰Í•ÉÙ•È€ô¹•Ü5ÕÑ…Ñ¥½¹=‰Í•ÉÙ•È¡™Õ¹Ñ¥½¸¡µÕÑ…Ñ¥½¹Ì¥ì(€€€€€€€€€€€µÕÑ…Ñ¥½¹Ì¹™½É… ¡™Õ¹Ñ¥½¸¡µÕÑ…Ñ¥½¸¥ì(€€€€€€€€€€€€€€€µÕÑ…Ñ¥½¸¹…‘‘•‘9½‘•Ì¹™½É… ¡™Õ¹Ñ¥½¸¡¹½‘”¥ì(€€€€€€€€€€€€€€€€€€€¥˜¡¹½‘”¹¹½‘•QåÁ”€„ôô€Ä¤É•ÑÕÉ¸ì(€€€€€€€€€€€€€€€€€€€¥˜¡¹½‘”¹±…ÍÍ1¥ÍĞ€˜˜(€€€€€€€€€€€€€€€€€€€€€€¹½‘”¹±…ÍÍ1¥ÍĞ¹½¹Ñ…¥¹Ì ‰Í­¥±°µ¹…µ”µ‰…‘”ˆ¤¥ì(€€€€€€€€€€€€€€€€€€€€€€€•¹ÍÕÉ•…ÍÑ	…‘•M½ÕÉ•M¥é”¡¹½‘”¤ì(€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€¥˜¡¹½‘”¹ÅÕ•ÉåM•±•Ñ½É±°¥ì(€€€€€€€€€€€€€€€€€€€€€€€¹½‘”¹ÅÕ•ÉåM•±•Ñ½É±° ˆ¹Í­¥±°µ¹…µ”µ‰…‘”ˆ¤(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹™½É… ¡•¹ÍÕÉ•…ÍÑ	…‘•M½ÕÉ•M¥é”¤ì(€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€ô¤ì(€€€€€€€€€€€ô¤ì(€€€€€€€ô¤ì(€€€€€€€½‰Í•ÉÙ•È¹½‰Í•ÉÙ”¡½Ù•É±…ä±í¡¥±‘1¥ÍĞéÑÉÕ”±ÍÕ‰ÑÉ•”éÑÉÕ•ô¤ì(€€€ô((€€€™Õ¹Ñ¥½¸¥¹¥Ğ ¥ì(€€€€€€€•¹ÍÕÉ•	…ÑÑ±•	…­É½Õ¹‘1…å•È ¤ì(€€€€€€€Íå¹	…ÑÑ±•	…­É½Õ¹‘Q½ÕÉÉ•¹Ñ5…À ¤ì(€€€€€€€İ…Ñ¡=Ù•É±…ä ¤ì((€€€€€€€€¼¨(€€€€€€€€€¨]¡•¸ÕÉÉ•¹Ñi½¹”½µ…À‰…­É½Õ¹¡…¹•Ì°€µ…ÁA…•	1…å•È¥Ì(€€€€€€€€€¨ÕÁ‘…Ñ•‰ä…ÁÁ±å5…Ái½¹•	…­É½Õ¹ ¤¸5ÕÑ…Ñ¥½¹=‰Í•ÉÙ•È½¸Ñ¡”(€€€€€€€€€¨ÍÑå±”…ÑÑÉ¥‰ÕÑ”Õ…É…¹Ñ••Ì‰…ÑÑ±”É••¥Ù•ÌÑ¡”Í…µ”¥µ…”¸(€€€€€€€€€¨¼(€€€€€€€½¹ÍĞµ…Á1…å•È€ô‘½Õµ•¹Ğ¹•Ñ±•µ•¹Ñ	å% ‰µ…ÁA…•	1…å•Èˆ¤ì(€€€€€€€¥˜¡µ…Á1…å•È¥ì(€€€€€€€€€€€½¹ÍĞµ…Á=‰Í•ÉÙ•È€ô¹•Ü5ÕÑ…Ñ¥½¹=‰Í•ÉÙ•È (€€€€€€€€€€€€€€€Íå¹	…ÑÑ±•	…­É½Õ¹‘Q½ÕÉÉ•¹Ñ5…À(€€€€€€€€€€€€¤ì(€€€€€€€€€€€µ…Á=‰Í•ÉÙ•È¹½‰Í•ÉÙ”¡µ…Á1…å•È±í…ÑÑÉ¥‰ÕÑ•ÌéÑÉÕ”±…ÑÑÉ¥‰ÕÑ•¥±Ñ•Èél‰ÍÑå±”‰uô¤ì(€€€€€€€ô((€€€€€€€€¼¨(€€€€€€€€€¨±Í¼É•Íå¹Œİ¡•¸Ñ¡”‰…ÑÑ±”Á…”¥ÌÉ•¹‘•É•½…Ñ¥Ù…Ñ•¸(€€€€€€€€€¨¼(€€€€€€€½¹ÍĞ½¹Ñ•¹Ğ€ô‘½Õµ•¹Ğ¹•Ñ±•µ•¹Ñ	å% ‰…µ”µ½¹Ñ•¹Ğˆ¤ì(€€€€€€€¥˜¡½¹Ñ•¹Ğ¥ì(€€€€€€€€€€€½¹ÍĞÁ…•=‰Í•ÉÙ•È€ô¹•Ü5ÕÑ…Ñ¥½¹=‰Í•ÉÙ•È¡™Õ¹Ñ¥½¸ ¥ì(€€€€€€€€€€€€€€€¥˜¡‘½Õµ•¹Ğ¹•Ñ±•µ•¹Ñ	å% ‰‰…ÑÑ±•A…”ˆ¤¥ì(€€€€€€€€€€€€€€€€€€€Íå¹	…ÑÑ±•	…­É½Õ¹‘Q½ÕÉÉ•¹Ñ5…À ¤ì(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€ô¤ì(€€€€€€€€€€€Á…•=‰Í•ÉÙ•È¹½‰Í•ÉÙ”¡½¹Ñ•¹Ğ±í¡¥±‘1¥ÍĞéÑÉÕ”±ÍÕ‰ÑÉ•”éÑÉÕ•ô¤ì(€€€€€€€ô((€€€€€€€İ¥¹‘½Ü¹Íå¹	…ÑÑ±•	…­É½Õ¹‘Q½ÕÉÉ•¹Ñ5…À€ô(€€€€€€€€€€€Íå¹	…ÑÑ±•	…­É½Õ¹‘Q½ÕÉÉ•¹Ñ5…Àì(€€€ô((€€€İ¥¹‘½Ü¹•ÑXĞÁ	…ÑÑ±•Y¥ÍÕ…±¥…¹½ÍÑ¥Ì€ô™Õ¹Ñ¥½¸ ¥ì(€€€€€€€½¹ÍĞ±…å•È€ô‘½Õµ•¹Ğ¹ÅÕ•ÉåM•±•Ñ½È (€€€€€€€€€€€€ˆ…µ”µÍÑ…”€ø€…ÁÀ€ø€…µ”µ½¹Ñ•¹Ğ€‰…ÑÑ±•A…”€ø€¹‰…ÑÑ±”µ‰œµÍ¡…É•ˆ(€€€€€€€€¤ì(€€€€€€€½¹ÍĞ‰…‘”€ô‘½Õµ•¹Ğ¹ÅÕ•ÉåM•±•Ñ½È (€€€€€€€€€€€€ˆ…µ”µÍÑ…”€ø€…µ”µ½Ù•É±…äµ±…å•È€¹Í­¥±°µ¹…µ”µ‰…‘”ˆ(€€€€€€€€¤ì(€€€€€€€É•ÑÕÉ¸ì(€€€€€€€€€€€ÕÉÉ•¹Ñi½¹”è(€€€€€€€€€€€€€€€€¡ÑåÁ•½˜ÕÉÉ•¹Ñi½¹”€„ôô€‰Õ¹‘•™¥¹•ˆ€üÕÉÉ•¹Ñi½¹”€è¹Õ±°¤°(€€€€€€€€€€€‰…ÑÑ±•	…­É½Õ¹è(€€€€€€€€€€€€€€€±…å•È€ü•Ñ½µÁÕÑ•‘MÑå±”¡±…å•È¤¹‰…­É½Õ¹‘%µ…”€è¹Õ±°°(€€€€€€€€€€€‰…‘•½¹Ğè(€€€€€€€€€€€€€€€‰…‘”€ü•Ñ½µÁÕÑ•‘MÑå±”¡‰…‘”¤¹™½¹ÑM¥é”€è¹Õ±°°(€€€€€€€€€€€‰…‘•]¥‘Ñ è(€€€€€€€€€€€€€€€‰…‘”€ü‰…‘”¹•Ñ	½Õ¹‘¥¹±¥•¹ÑI•Ğ ¤¹İ¥‘Ñ €è¹Õ±°°(€€€€€€€€€€€‰…‘•Q•áĞè(€€€€€€€€€€€€€€€‰…‘”€ü‰…‘”¹Ñ•áÑ½¹Ñ•¹Ğ€è¹Õ±°(€€€€€€€ôì(€€€ôì((€€€¥˜¡‘½Õµ•¹Ğ¹É•…‘åMÑ…Ñ”€ôôô€‰±½…‘¥¹œˆ¥ì(€€€€€€€‘½Õµ•¹Ğ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰=5½¹Ñ•¹Ñ1½…‘•ˆ±¥¹¥Ğ±í½¹”éÑÉÕ•ô¤ì(€€€õ•±Í•ì(€€€€€€€¥¹¥Ğ ¤ì(€€€ô)ô¤ ¤ì(((¼¨‰Õ¹‘±•Í½ÕÉ”è©Ì¼ÀàµÍÑ…”µØĞÄµÉÕ¹Ñ¥µ”¹©Ì€¨¼(¡™Õ¹Ñ¥½¸ ¥ì(€€€€‰ÕÍ”ÍÑÉ¥Ğˆì(€€€İ¥¹‘½Ü¹5}9Q%Y}=9%I5}	M1%9€ô€‰XĞÀˆì(€€€İ¥¹‘½Ü¹5}9Q%Y}UII9Q}YIM%=8€ô€‰XĞÄˆì)ô¤ ¤ì(((¼¨‰Õ¹‘±•Í½ÕÉ”è©Ì¼ÀäµÍÑ…”µØĞÔµÉÕ¹Ñ¥µ”¹©Ì€¨¼(¡™Õ¹Ñ¥½¸ ¥ì(€€€€‰ÕÍ”ÍÑÉ¥Ğˆì(€€€İ¥¹‘½Ü¹5}9Q%Y}=9%I5}	M1%9€ô€‰XĞÄˆì(€€€İ¥¹‘½Ü¹5}9Q%Y}UII9Q}YIM%=8€ô€‰XĞÔˆì(€€€İ¥¹‘½Ü¹5}	QQ1}	-I=U9}Q%9P€ô€‰É‰„ À°À°À°¸Ìà¤ˆì(€€€İ¥¹‘½Ü¹5}MQ}M-%11}	}=9Q}M%i€ô€ˆÄÀÙÁàˆì)ô¤ ¤ì(((¼¨‰Õ¹‘±•Í½ÕÉ”è©Ì¼ÄÀµÍÑ…”µØĞØµÉÕ¹Ñ¥µ”¹©Ì€¨¼(¡™Õ¹Ñ¥½¸ ¥ì(€€€€‰ÕÍ”ÍÑÉ¥Ğˆì(€€€İ¥¹‘½Ü¹5}9Q%Y}=9%I5}	M1%9€ô€‰XĞÔˆì(€€€İ¥¹‘½Ü¹5}9Q%Y}UII9Q}YIM%=8€ô€‰XĞØˆì(€€€İ¥¹‘½Ü¹5}	QQ1}	-I=U9}Q%9P€ô€‰É‰„ À°À°À°¸ÔÈ¤ˆì(€€€İ¥¹‘½Ü¹5}MQ}M-%11}	}=9Q}M%i€ô€ˆÄÌÉÁàˆì)ô¤ ¤ì(((¼¨‰Õ¹‘±•Í½ÕÉ”è©Ì¼ÄÄµÍÑ…”µØĞÜµÉÕ¹Ñ¥µ”¹©Ì€¨¼(¡™Õ¹Ñ¥½¸ ¥ì(€€€€‰ÕÍ”ÍÑÉ¥Ğˆì(€€€İ¥¹‘½Ü¹5}9Q%Y}=9%I5}	M1%9€ô€‰XĞØˆì(€€€İ¥¹‘½Ü¹5}9Q%Y}UII9Q}YIM%=8€ô€‰XĞÜˆì(€€€İ¥¹‘½Ü¹5}MQ}M-%11}	}M=UI}=9Q}M%i€ô€ˆÄÔÁÁàˆì(€€€İ¥¹‘½Ü¹5}MQ}M-%11}	}M=UI}]%Q €ô€ˆäÀÁÁàˆì)ô¤ ¤ì(((¼¨‰Õ¹‘±•Í½ÕÉ”è©Ì¼ÄÈµÍÑ…”µØĞàµÉÕ¹Ñ¥µ”¹©Ì€¨¼(¡™Õ¹Ñ¥½¸ ¥ì(€€€€‰ÕÍ”ÍÑÉ¥Ğˆì(€€€İ¥¹‘½Ü¹5}9Q%Y}=9%I5}	M1%9€ô€‰XĞÜˆì(€€€İ¥¹‘½Ü¹5}9Q%Y}UII9Q}YIM%=8€ô€‰XĞàˆì(€€€İ¥¹‘½Ü¹5}MQ}M-%11}	}=9Q}M%i€ô€ˆÜÉÁàˆì(€€€İ¥¹‘½Ü¹5}MQ}M-%11}	}MQI=-€ô€‰¹½¹”ˆì)ô¤ ¤ì(((¼¨‰Õ¹‘±•Í½ÕÉ”è©Ì¼ÄÌµÍÑ…”µØĞäµÉÕ¹Ñ¥µ”¹©Ì€¨¼(¡™Õ¹Ñ¥½¸ ¥ì(€€€€‰ÕÍ”ÍÑÉ¥Ğˆì(€€€İ¥¹‘½Ü¹5}9Q%Y}=9%I5}	M1%9€ô€‰XĞàˆì(€€€İ¥¹‘½Ü¹5}9Q%Y}UII9Q}YIM%=8€ô€‰XĞäˆì(€€€İ¥¹‘½Ü¹5}MQ}M-%11}	}MQI=-€ô€‰¹½¹”ˆì((€€€™Õ¹Ñ¥½¸É•µ½Ù•M­¥±±]¡¥Ñ•MÑÉ½­” ¥ì(€€€€€€€‘½Õµ•¹Ğ¹ÅÕ•ÉåM•±•Ñ½É±° ˆ¹Í­¥±°µ¹…µ”µ‰…‘”ˆ¤¹™½É… ¡™Õ¹Ñ¥½¸¡•°¥ì(€€€€€€€€€€€•°¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ˆµİ•‰­¥ĞµÑ•áĞµÍÑÉ½­”ˆ°ˆÀˆ°‰¥µÁ½ÉÑ…¹Ğˆ¤ì(€€€€€€€€€€€•°¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ‰Ñ•áĞµÍÑÉ½­”ˆ°ˆÀˆ°‰¥µÁ½ÉÑ…¹Ğˆ¤ì(€€€€€€€€€€€•°¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ‰‰½É‘•Èˆ°ˆÀˆ°‰¥µÁ½ÉÑ…¹Ğˆ¤ì(€€€€€€€€€€€•°¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ‰½ÕÑ±¥¹”ˆ°ˆÀˆ°‰¥µÁ½ÉÑ…¹Ğˆ¤ì(€€€€€€€ô¤ì(€€€ô((€€€¥˜¡‘½Õµ•¹Ğ¹É•…‘åMÑ…Ñ”€ôôô€‰±½…‘¥¹œˆ¥ì(€€€€€€€‘½Õµ•¹Ğ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰=5½¹Ñ•¹Ñ1½…‘•ˆ°É•µ½Ù•M­¥±±]¡¥Ñ•MÑÉ½­”°í½¹”éÑÉÕ•ô¤ì(€€€õ•±Í•ì(€€€€€€€É•µ½Ù•M­¥±±]¡¥Ñ•MÑÉ½­” ¤ì(€€€ô)ô¤ ¤ì(((¼¨‰Õ¹‘±•Í½ÕÉ”è©Ì¼ÄĞµÍÑ…”µØÔÀµÉÕ¹Ñ¥µ”¹©Ì€¨¼(¡™Õ¹Ñ¥½¸ ¥ì(€€€€‰ÕÍ”ÍÑÉ¥Ğˆì(€€€İ¥¹‘½Ü¹5}9Q%Y}=9%I5}	M1%9€ô€‰XĞäˆì(€€€İ¥¹‘½Ü¹5}9Q%Y}UII9Q}YIM%=8€ô€‰XÔÀˆì((€€€™Õ¹Ñ¥½¸™¥á	…ÑÑ±•	…­É½Õ¹‘‘” ¥ì(€€€€€€€½¹ÍĞÍÑ…”€ô‘½Õµ•¹Ğ¹•Ñ±•µ•¹Ñ	å% ‰…µ”µÍÑ…”ˆ¤ì(€€€€€€€½¹ÍĞ‰…ÑÑ±”€ô‘½Õµ•¹Ğ¹•Ñ±•µ•¹Ñ	å% ‰‰…ÑÑ±•A…”ˆ¤ì(€€€€€€€½¹ÍĞ‰œ€ô‰…ÑÑ±”€˜˜‰…ÑÑ±”¹ÅÕ•ÉåM•±•Ñ½È ˆ¹‰…ÑÑ±”µ‰œµÍ¡…É•ˆ¤ì(€€€€€€€¥˜ …ÍÑ…”ñğ€…‰…ÑÑ±”ñğ€…‰œ¤É•ÑÕÉ¸ì((€€€€€€€€¼¨UÍ”Ñ¡”…ÑÕ…°‰…ÑÑ±”Ù¥•İÁ½ÉĞ‘¥µ•¹Í¥½¹Ì°¹•Ù•È1•…ä€ĞÈÁÁà¸€¨¼(€€€€€€€‰œ¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ‰±•™Ğˆ°ˆÀˆ°‰¥µÁ½ÉÑ…¹Ğˆ¤ì(€€€€€€€‰œ¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ‰Ñ½Àˆ°ˆÀˆ°‰¥µÁ½ÉÑ…¹Ğˆ¤ì(€€€€€€€‰œ¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ‰İ¥‘Ñ ˆ°ˆÄÀÀ”ˆ°‰¥µÁ½ÉÑ…¹Ğˆ¤ì(€€€€€€€‰œ¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ‰¡•¥¡Ğˆ°ˆÄÀÀ”ˆ°‰¥µÁ½ÉÑ…¹Ğˆ¤ì(€€€€€€€‰œ¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ‰É¥¡Ğˆ°ˆÀˆ°‰¥µÁ½ÉÑ…¹Ğˆ¤ì(€€€€€€€‰œ¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ‰‰½ÑÑ½´ˆ°ˆÀˆ°‰¥µÁ½ÉÑ…¹Ğˆ¤ì(€€€€€€€‰œ¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ‰‰½É‘•Èˆ°ˆÀˆ°‰¥µÁ½ÉÑ…¹Ğˆ¤ì(€€€€€€€‰œ¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ‰½ÕÑ±¥¹”ˆ°ˆÀˆ°‰¥µÁ½ÉÑ…¹Ğˆ¤ì(€€€€€€€‰œ¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ‰‰½àµÍ¡…‘½Üˆ°‰¹½¹”ˆ°‰¥µÁ½ÉÑ…¹Ğˆ¤ì((€€€€€€€‰…ÑÑ±”¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ‰½Ù•É™±½Üˆ°‰¡¥‘‘•¸ˆ°‰¥µÁ½ÉÑ…¹Ğˆ¤ì(€€€ô((€€€¥˜¡‘½Õµ•¹Ğ¹É•…‘åMÑ…Ñ”€ôôô€‰±½…‘¥¹œˆ¥ì(€€€€€€€‘½Õµ•¹Ğ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰=5½¹Ñ•¹Ñ1½…‘•ˆ°™¥á	…ÑÑ±•	…­É½Õ¹‘‘”°í½¹”éÑÉÕ•ô¤ì(€€€õ•±Í•ì(€€€€€€€™¥á	…ÑÑ±•	…­É½Õ¹‘‘” ¤ì(€€€ô)ô¤ ¤ì(((¼¨‰Õ¹‘±•Í½ÕÉ”è©Ì¼ÄÔµÍÑ…”µØÔÄµÉÕ¹Ñ¥µ”¹©Ì€¨¼(¡™Õ¹Ñ¥½¸ ¥ì(€€€€‰ÕÍ”ÍÑÉ¥Ğˆì(€€€İ¥¹‘½Ü¹5}9Q%Y}=9%I5}	M1%9€ô€‰XÔÀˆì(€€€İ¥¹‘½Ü¹5}9Q%Y}UII9Q}YIM%=8€ô€‰XäÌˆì((€€€€¼¨(€€€€€I•ÍÑ½É”İ¡¥Ñ”½ÕÑ±¥¹”½¹±ä½¸½µ‰…ĞÉ•ÍÕ±Ğ¹½‘•Ì¸(€€€€€¼¹½ĞÑ½Õ Í­¥±°µ¹…µ”µ‰…‘”¸(€€€€¨¼(€€€½¹ÍĞ½µ‰…ÑI•ÍÕ±ÑM•±•Ñ½È€ôl(€€€€€€€€ˆ¹‰…ÑÑ±”µ‘…µ…”ˆ°(€€€€€€€€ˆ¹‰…ÑÑ±”µ‘…µ…”µ¹Õµ‰•Èˆ°(€€€€€€€€ˆ¹‘…µ…”µ¹Õµ‰•Èˆ°(€€€€€€€€ˆ¹‘…µ…”µÑ•áĞˆ°(€€€€€€€€ˆ¹½µ‰…Ğµ‘…µ…”ˆ°(€€€€€€€€ˆ¹½µ‰…ĞµÉ•ÍÕ±Ğˆ°(€€€€€€€€ˆ¹½µ‰…ĞµÉ•ÍÕ±ĞµÑ•áĞˆ°(€€€€€€€€ˆ¹‰…ÑÑ±”µµ¥ÍÌˆ°(€€€€€€€€ˆ¹µ¥ÍÌµÑ•áĞˆ°(€€€€€€€€ˆ¹‰…ÑÑ±”µ¡•…°ˆ°(€€€€€€€€ˆ¹¡•…°µ¹Õµ‰•Èˆ°(€€€€€€€€ˆ¹¡Àµ¡…¹”ˆ°(€€€€€€€€ˆ¹¡Àµ¡…¹”µ¹Õµ‰•Èˆ(€€€t¹©½¥¸ ˆ°ˆ¤ì((€€€™Õ¹Ñ¥½¸…ÁÁ±å½µ‰…ÑI•ÍÕ±ÑMÑÉ½­”¡É½½Ğ¥ì(€€€€€€€½¹ÍĞ‰…Í”€ôÉ½½Ğ€˜˜É½½Ğ¹ÅÕ•ÉåM•±•Ñ½É±°€üÉ½½Ğ€è‘½Õµ•¹Ğì(€€€€€€€‰…Í”¹ÅÕ•ÉåM•±•Ñ½É±°¡½µ‰…ÑI•ÍÕ±ÑM•±•Ñ½È¤¹™½É… ¡™Õ¹Ñ¥½¸¡•°¥ì(€€€€€€€€€€€•°¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ˆµİ•‰­¥ĞµÑ•áĞµÍÑÉ½­”ˆ°ˆÍÁà€™™™™™˜ˆ°‰¥µÁ½ÉÑ…¹Ğˆ¤ì(€€€€€€€€€€€•°¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ‰Ñ•áĞµÍÑÉ½­”ˆ°ˆÍÁà€™™™™™˜ˆ°‰¥µÁ½ÉÑ…¹Ğˆ¤ì(€€€€€€€ô¤ì(€€€ô((€€€™Õ¹Ñ¥½¸¥¹¥Ğ ¥ì(€€€€€€€…ÁÁ±å½µ‰…ÑI•ÍÕ±ÑMÑÉ½­”¡‘½Õµ•¹Ğ¤ì((€€€€€€€½¹ÍĞÍÑ…”€ô‘½Õµ•¹Ğ¹•Ñ±•µ•¹Ñ	å% ‰…µ”µÍÑ…”ˆ¤ì(€€€€€€€¥˜¡ÍÑ…”¥ì(€€€€€€€€€€€¹•Ü5ÕÑ…Ñ¥½¹=‰Í•ÉÙ•È¡™Õ¹Ñ¥½¸ ¥ì(€€€€€€€€€€€€€€€…ÁÁ±å½µ‰…ÑI•ÍÕ±ÑMÑÉ½­”¡ÍÑ…”¤ì(€€€€€€€€€€€ô¤¹½‰Í•ÉÙ”¡ÍÑ…”°í¡¥±‘1¥ÍĞéÑÉÕ”°ÍÕ‰ÑÉ•”éÑÉÕ•ô¤ì(€€€€€€€ô(€€€ô((€€€¥˜¡‘½Õµ•¹Ğ¹É•…‘åMÑ…Ñ”€ôôô€‰±½…‘¥¹œˆ¥ì(€€€€€€€‘½Õµ•¹Ğ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰=5½¹Ñ•¹Ñ1½…‘•ˆ°¥¹¥Ğ°í½¹”éÑÉÕ•ô¤ì(€€€õ•±Í•ì(€€€€€€€¥¹¥Ğ ¤ì(€€€ô)ô¤ ¤ì(((¼¨‰Õ¹‘±•Í½ÕÉ”è©Ì½É•±¥ŒµÍÕµµ…Éäµ…Ñ…±½œ¹©Ì€¨¼(¼¨¥ÉÍĞµÍÉ••¸µÍ…™”Q•…´I•±¥ŒÍÕµµ…Éä…Ñ…±½œ¸(€€=İ¹Ì½¹±äÑ¡”ÍÑ…Ñ¥Œ™¥•±‘ÌÉ•ÅÕ¥É•‰äÑ¡”µ…¥¸µ¥ÑäÍÕµµ…Éä…¹Ñ¡”™Õ±°É•±¥Œ…Ñ…±½œ¸€¨¼(¡™Õ¹Ñ¥½¸¥¹ÍÑ…±±I•±¥MÕµµ…Éå…Ñ…±½œ¡±½‰…°¥ì(€€€€‰ÕÍ”ÍÑÉ¥Ğˆì(€€€¥˜ …±½‰…±ññ±½‰…°¹½ÕÉMåµ‰½±ÍI•±¥MÕµµ…Éå…Ñ…±½œ¥ìÉ•ÑÕÉ¸ìô(€€€½¹ÍĞ•¹ÑÉ¥•Ìõl(€€€€€€€l‰É•±¥}Å¥…¹­Õ¹}™±…Í¬ˆ°‹’æû–v“:'–èˆ°‹––šVã–n{–B#ÖCšvšf‰t°(€€€€€€€l‰É•±¥}ÍÕ¹}½Éˆˆ°‹#¦f÷–{>€ˆ°‹–ÛšVã–n{–B#¦Z/–/šf‰t°(€€€€€€€l‰É•±¥}áÕ…¹İÕ}Í•…°ˆ°‹:š¶›¦v#–6Àˆ°‹š¾?²°Ï–n{–B#¦Z/–/šf‰t°(€€€€€€€l‰É•±¥}Í½Õ±}‰•±°ˆ°‹¦:»¦¶–>“¦B`ˆ°‹š¾?²°Ó–n{–B#¦Z/–/šf‰t°(€€€€€€€l‰É•±¥}Ñ¥…¹…¹}‰…¹¹•Èˆ°‹–’§ö‡š"Ãš^\ˆ°‹š"GšZçÒ¿¦7–>_–"ÀÛš²‡šV×šZçšr'šV#šRïšN+–ú0‰t°(€€€€€€€l‰É•±¥}¹¥¹•}‘É…½¹}™¥É”ˆ°‹’æw¦ú7–{¯ö¤ˆ°‹šV×šZçÒ¿¦7–º3š"@ßš²‡šr'šV#¢†3–.W–ú0‰t°(€€€€€€€l‰É•±¥}½±‘}ÍÁÉ¥¹}©…‘”ˆ°‹–¾KšÎ':'>¸ˆ°‹’îï’âš"GšZç¢K¢&Ë–r£–
ß–ºÏÖCº_–ú3’ö;šZğÌÔ—šr–’!Cšf‰t°(€€€€€€€l‰É•±¥}Å¥¹±…¹}™•…Ñ¡•Èˆ°‹¦vK–ÖCú÷²˜ˆ°‹š"Ã¦²—¦Z/–/šf‰t°(€€€€€€€l‰É•±¥}É½­}µ½Õ¹Ñ…¥¹}Í•…°ˆ°‹–Ê§–ÊÏ¦:»–6Àˆ°‹¦Z/–‚Ó¾òo–>›šZóš"GšZçÒ¿¦7–>\ãš²‡šr'šV#šRïšN+šf‰t°(€€€€€€€l‰É•±¥}É•ÑÕÉ¹¥¹}İ¡••°ˆ°‹–n{–’§–¾Û¢ò¨ˆ°‹šr³–‚Ó²³’âš²‡šr'š"GšZç¢K¢&Ë–Â–>_–"Ã¢Ó–F÷–
ß–ºÏšf‰t°(€€€€€€€l‰É•±¥}½É¥¥¹}Ñ…±¥Íµ…¸ˆ°‹–’«–"w¢[²˜ˆ°‹š¾?²°Ó–n{–B#ÖCšv|‰t°(€€€€€€€l‰É•±¥}‰É½­•¹}…Éµå}ÍÉ½±°ˆ°‹‚Ó¢î7šºc–6Üˆ°‹¢K¢&ËšRïšN+¾ò?š*¢÷šN+šV_šV×’êë–ú0‰t°(€€€€€€€l‰É•±¥}É•‘}Í­å}İ…É}µ…É¬ˆ°‹¢Ö“¦rš"ÃÒ,ˆ°‹š"Ã¦²—¦Z/–/šf‰t°(€€€€€€€l‰É•±¥}¥•}µ¥ÉÉ½É}¡•…ÉĞˆ°‹:–Ã¦>‡–şˆ°‹š¾?²°Ï–n{–B#ÖCšv|‰t°(€€€€€€€l‰É•±¥}İ¥¹‘}¡…Í¥¹}Ñ…±¥Íµ…¸ˆ°‹¢ş÷¦Š£¢†3²˜ˆ°‹š¾?²°Ï–n{–B#¦Z/–,‰t°(€€€€€€€l‰É•±¥}µ½Õ¹Ñ…¥¹}É¥Ù•É}…Õ±‘É½¸ˆ°‹–ÆÇšÊÏ–¾Û¦ò8ˆ°‹š"GšZçÒ¿¦7–>\ßš²‡šr'šV#šRïšN+–ú0‰t°(€€€€€€€l‰É•±¥}‰ÕÉ¹¥¹}ÍÑ…É}µ…É¬ˆ°‹kšbšºc–6Àˆ°‹–ÛšVã–n{–B#ÖCšv|‰t°(€€€€€€€l‰É•±¥}ÍÁ¥É¥Ñ}ÍÁÉ¥¹}‰½ÑÑ±”ˆ°‹¦v#šÎ'šÎWNØˆ°‹š¾?²°Ï–n{–B#ÖCšv|‰t°(€€€€€€€l‰É•±¥}‘•µ½¹}ÍÕÁÁÉ•ÍÍ¥¹}Í•…°ˆ°‹’ò?¦¶S¦G–6Àˆ°‹š"Ã¦²—¦Z/–/¾òo¦š[š²‡š"C–*–>_–"Ã’â¢"³¢Êƒ¦v‹.š,‰t°(€€€€€€€l‰É•±¥}…±±}É•ÑÕÉ¹¥¹}…ÉÉ…äˆ°‹¢B³¢Æ‡š¶ã–nˆ°‹š¾?²°Ó–n{–B#¦Z/–,‰t(€€€tì(€€€±½‰…°¹½ÕÉMåµ‰½±ÍI•±¥MÕµµ…Éå…Ñ…±½œõ=‰©•Ğ¹™É••é”¡=‰©•Ğ¹™É½µ¹ÑÉ¥•Ì¡•¹ÑÉ¥•Ì¹µ…À¡•¹ÑÉäôùl(€€€€€€€•¹ÑÉålÁt°(€€€€€€€=‰©•Ğ¹™É••é”¡í¥é•¹ÑÉålÁt±¹…µ”é•¹ÑÉålÅt±ÑÉ¥•ÉQ•áĞé•¹ÑÉålÉuô¤(€€€t¤¤¤ì)ô¤¡ÑåÁ•½˜İ¥¹‘½Ü„ôô‰Õ¹‘•™¥¹•ˆıİ¥¹‘½Üé±½‰…±Q¡¥Ì¤ì(((¼¨‰Õ¹‘±•Í½ÕÉ”è©Ì¼ÄØµÍÑ…”µØÔĞµµ…¥¸µ¥ÑäµÉÕ¹Ñ¥µ”¹©Ì€¨¼(¡™Õ¹Ñ¥½¸ ¥ì(€€€€‰ÕÍ”ÍÑÉ¥Ğˆì(€€€İ¥¹‘½Ü¹5}9Q%Y}=9%I5}	M1%9€ô€‰XÔÄˆì(€€€İ¥¹‘½Ü¹5}9Q%Y}UII9Q}YIM%=8€ô€‰XÔĞˆì(€€€İ¥¹‘½Ü¹5}9Q%Y}1MQ}M=A€ô€‰µ…¥¸µ¥Ñäµµ½‘•É…Ñ”µÍ…±”ˆì((€€€½¹ÍĞ}I}5=}1MLô‰…µ™É•”µÍ•ÉÙ¥”µ¥¹™¼µµ½‘”ˆì(€€€½¹ÍĞ}I}=9%}-dô‰M%a%9}}I}MIY%}=9%ˆì(€€€½¹ÍĞ}I}%MA1e}A=1%dõ=‰©•Ğ¹™É••é”¡íµ½‘”è‰µ…¹Õ…°‰ô¤ì(€€€½¹ÍĞU1Q}}I}=9%õ=‰©•Ğ¹™É••é”¡ì(€€€€€€€ÍÕÁÁ½ÉÑµ…¥°èˆˆ°(€€€€€€€É•™Õ¹‘A½±¥åUÉ°èˆˆ°(€€€€€€€Ñ•ÉµÍUÉ°èˆˆ°(€€€€€€€ÁÉ¥Ù…åA½±¥åUÉ°èˆˆ°(€€€€€€€ÁÕÉ¡…Í•UÉ°èˆˆ°(€€€€€€€ÁÕÉ¡…Í•¹…‰±•é™…±Í”(€€€ô¤ì((€€€™Õ¹Ñ¥½¸…ÁÁ±ä ¥ì(€€€€€€€½¹ÍĞ¡½µ”€ô‘½Õµ•¹Ğ¹•Ñ±•µ•¹Ñ	å% ‰¡½µ•A…”ˆ¤ì(€€€€€€€¥˜ …¡½µ”¤É•ÑÕÉ¸ì(€€€€€€€¡½µ”¹±…ÍÍ1¥ÍĞ¹…‘ ‰µ…¥¸µ¥Ñäµ±½‰‰äµÉ•…‘äˆ¤ì(€€€ô((€€€™Õ¹Ñ¥½¸•¹ÍÕÉ•‘É••½¹™¥œ ¥ì(€€€€€€€½¹ÍĞ™½Éµ…±MÕÁÁ½ÉÑµ…¥°õMÑÉ¥¹œ¡İ¥¹‘½Ü¹½ÕÉMåµ‰½±ÍMÕÁÁ½ÉĞ˜™İ¥¹‘½Ü¹½ÕÉMåµ‰½±ÍMÕÁÁ½ÉĞ¹•µ…¥±ñğˆˆ¤¹ÑÉ¥´ ¤ì(€€€€€€€½¹ÍĞ•á¥ÍÑ¥¹œõİ¥¹‘½İm}I}=9%}-et˜™ÑåÁ•½˜İ¥¹‘½İm}I}=9%}-etôôô‰½‰©•Ğˆ(€€€€€€€€€€€€üİ¥¹‘½İm}I}=9%}-et(€€€€€€€€€€€€èíôì(€€€€€€€½¹ÍĞ½¹™¥œõ=‰©•Ğ¹…ÍÍ¥¸¡íô±U1Q}}I}=9%±•á¥ÍÑ¥¹œ¤ì(€€€€€€€¥˜¡™½Éµ…±MÕÁÁ½ÉÑµ…¥°¥ì½¹™¥œ¹ÍÕÁÁ½ÉÑµ…¥°õ™½Éµ…±MÕÁÁ½ÉÑµ…¥°ìô(€€€€€€€İ¥¹‘½İm}I}=9%}-etõ½¹™¥œì(€€€€€€€É•ÑÕÉ¸½¹™¥œì(€€€ô((€€€™Õ¹Ñ¥½¸•Ñ5½‘…±A…ÉÑÌ ¥ì(€€€€€€€½¹ÍĞµ½‘…°õ‘½Õµ•¹Ğ¹•Ñ±•µ•¹Ñ	å% ‰¡½µ••…ÑÕÉ•5½‘…°ˆ¤ì(€€€€€€€¥˜ …µ½‘…°¥ìÉ•ÑÕÉ¸¹Õ±°ìô(€€€€€€€½¹ÍĞ‰½àõµ½‘…°¹ÅÕ•ÉåM•±•Ñ½È ˆ¹¡½µ”µ™•…ÑÕÉ”µµ½‘…°µ‰½àˆ¤ì(€€€€€€€½¹ÍĞÑ¥Ñ±”õ‘½Õµ•¹Ğ¹•Ñ±•µ•¹Ñ	å% ‰¡½µ••…ÑÕÉ•5½‘…±Q¥Ñ±”ˆ¤ì(€€€€€€€½¹ÍĞ‰½‘äõ‘½Õµ•¹Ğ¹•Ñ±•µ•¹Ñ	å% ‰¡½µ••…ÑÕÉ•5½‘…±	½‘äˆ¤ì(€€€€€€€¥˜ …‰½áñğ…Ñ¥Ñ±•ñğ…‰½‘ä¥ìÉ•ÑÕÉ¸¹Õ±°ìô(€€€€€€€É•ÑÕÉ¸íµ½‘…°±‰½à±Ñ¥Ñ±”±‰½‘åôì(€€€ô((€€€™Õ¹Ñ¥½¸É•Í½±Ù•½¹™¥ÕÉ•‘UÉ°¡Ù…±Õ”¥ì(€€€€€€€½¹ÍĞÉ…ÜõMÑÉ¥¹œ¡Ù…±Õ•ñğˆˆ¤¹ÑÉ¥´ ¤ì(€€€€€€€¥˜ …É…Ü¥ìÉ•ÑÕÉ¸€ˆˆìô(€€€€€€€ÑÉåì(€€€€€€€€€€€½¹ÍĞÕÉ°õ¹•ÜUI0¡É…Ü±İ¥¹‘½Ü¹±½…Ñ¥½¸¹¡É•˜¤ì(€€€€€€€€€€€É•ÑÕÉ¸ÕÉ°¹ÁÉ½Ñ½½°ôôô‰¡ÑÑÁÌè‰ññÕÉ°¹ÁÉ½Ñ½½°ôôô‰¡ÑÑÀèˆ€üÕÉ°¹¡É•˜€è€ˆˆì(€€€€€€€õ…Ñ ¡|¥ì(€€€€€€€€€€€É•ÑÕÉ¸€ˆˆì(€€€€€€€ô(€€€ô((€€€™Õ¹Ñ¥½¸½¹™¥ÕÉ•A½±¥å	ÕÑÑ½¸¡‰ÕÑÑ½¹%±½¹™¥ÕÉ•‘UÉ°±Ñ½‘½1…‰•°¥ì(€€€€€€€½¹ÍĞ‰ÕÑÑ½¸õ‘½Õµ•¹Ğ¹•Ñ±•µ•¹Ñ	å%¡‰ÕÑÑ½¹%¤ì(€€€€€€€¥˜ …‰ÕÑÑ½¸¥ìÉ•ÑÕÉ¸ìô(€€€€€€€½¹ÍĞÕÉ°õÉ•Í½±Ù•½¹™¥ÕÉ•‘UÉ°¡½¹™¥ÕÉ•‘UÉ°¤ì(€€€€€€€¥˜ …ÕÉ°¥ì(€€€€€€€€€€€‰ÕÑÑ½¸¹‘¥Í…‰±•õÑÉÕ”ì(€€€€€€€€€€€‰ÕÑÑ½¸¹Ñ¥Ñ±”ô‰Q=?¾òk–úš:—š¶–ò<ˆ­Ñ½‘½1…‰•°¬‹¦‚¦vˆˆì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€ô(€€€€€€€‰ÕÑÑ½¸¹‘¥Í…‰±•õ™…±Í”ì(€€€€€€€‰ÕÑÑ½¸¹Ñ¥Ñ±”ôˆˆì(€€€€€€€‰ÕÑÑ½¸¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ±™Õ¹Ñ¥½¸ ¥ì(€€€€€€€€€€€İ¥¹‘½Ü¹½Á•¸¡ÕÉ°°‰}‰±…¹¬ˆ°‰¹½½Á•¹•È±¹½É•™•ÉÉ•Èˆ¤ì(€€€€€€€ô¤ì(€€€ô((€€€™Õ¹Ñ¥½¸É•¹‘•É‘É••M•ÉÙ¥•	½‘ä¡‰½‘ä¥ì(€€€€€€€½¹ÍĞ½¹™¥œõ•¹ÍÕÉ•‘É••½¹™¥œ ¤ì(€€€€€€€½¹ÍĞ½¹™¥ÕÉ•‘µ…¥°õMÑÉ¥¹œ¡½¹™¥œ¹ÍÕÁÁ½ÉÑµ…¥±ñğˆˆ¤¹ÑÉ¥´ ¤ì(€€€€€€€‰½‘ä¹¥¹¹•É!Q50õl(€€€€€€€€€€€€œñÍ•Ñ¥½¸±…ÍÌô‰…µ™É•”µÍ•ÉÙ¥”µÁ…¹•°ˆ‘…Ñ„µ…µ™É•”µÍ•ÉÙ¥”µ¥¹™¼ô‰ÑÉÕ”ˆøœ°(€€€€€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰…µ™É•”µÍ•ÉÙ¥”µ¡•É¼ˆøœ°(€€€€€€€€€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰…µ™É•”µÍ•ÉÙ¥”µÍÕ‰Ñ¥Ñ±”ˆøÌÀƒ–’§–7–î–F+šr7–.dğ½‘¥Øøœ°(€€€€€€€€€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰…µ™É•”µÍ•ÉÙ¥”µÁÉ¥”ˆ…É¥„µ±…‰•°ô‹–çš‚ğ9Pääˆù9Pääğ½‘¥Øøœ°(€€€€€€€€€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰…µ™É•”µÍ•ÉÙ¥”µ‰…‘”ˆû–Z»š²‡¢Îó¢Êßï¦v{¢«–.Wê3¢¢ğ½‘¥Øøœ°(€€€€€€€€€€€€€€€€œğ½‘¥Øøœ°(€€€€€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰…µ™É•”µÍ•ÉÙ¥”µ½Áäˆøœ°(€€€€€€€€€€€€€€€€€€€€œñÀû’âš²‡’îcš²û¾ò3š>C’úl€ÌÀƒ–’§–7–î–F+š²+n+ğ½Àøœ°(€€€€€€€€€€€€€€€€€€€€œñÀûšr³šr7–.g
ë–Z»š²‡¢Îó¢Êß¾ò3’â7šr¢«–.Wê3¢¢ğ½Àøœ°(€€€€€€€€€€€€€€€€€€€€œñÀû¢Îó¢Êßš"C–*–ú3¾ò3–7–î–F+š²+n+–ÂÚ–ºk:§–ºÛ–âÏ¢f¾ò3¢«’îcš²ûš"C–*¢ÖßRšV €ÌÀƒ–’§ğ½Àøœ°(€€€€€€€€€€€€€€€€€€€€œñÀûš¶“šr7–.g’â7š>C’úo¦†7–’[¢K¢&Ë¢w–
g¢÷–*o¦+š"Ë–æš"[–Û’î[š"Ã–*o–*ƒš"Cğ½Àøœ°(€€€€€€€€€€€€€€€€œğ½‘¥Øøœ°(€€€€€€€€€€€€€€€€œñÍ•Ñ¥½¸±…ÍÌô‰…µ™É•”µÍ•ÉÙ¥”µÍÕÁÁ½ÉĞˆ…É¥„µ±…‰•°ô‹–º‹šr7¢"šŠwš²øˆøœ°(€€€€€€€€€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰…µ™É•”µÍ•ÉÙ¥”µÍÕÁÁ½ÉĞµÉ½Üˆøœ°(€€€€€€€€€€€€€€€€€€€€€€€€œñÍÁ…¸û–º‹šr4µ…¥³¾òhğ½ÍÁ…¸øœ°(€€€€€€€€€€€€€€€€€€€€€€€€œñˆ¥ô‰…‘É••MÕÁÁ½ÉÑµ…¥°ˆøœ­½¹™¥ÕÉ•‘µ…¥°¬œğ½ˆøœ°(€€€€€€€€€€€€€€€€€€€€œğ½‘¥Øøœ°(€€€€€€€€€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰…µ™É•”µÍ•ÉÙ¥”µÁ½±¥äµ…Ñ¥½¹Ìˆøœ°(€€€€€€€€€€€€€€€€€€€€€€€€œñ‰ÕÑÑ½¸¥ô‰…‘É••I•™Õ¹‘A½±¥å	ÕÑÑ½¸ˆÑåÁ”ô‰‰ÕÑÑ½¸ˆûš~—r/¦š²û¢š?–&ğ½‰ÕÑÑ½¸øœ°(€€€€€€€€€€€€€€€€€€€€€€€€œñ‰ÕÑÑ½¸¥ô‰…‘É••Q•ÉµÍ	ÕÑÑ½¸ˆÑåÁ”ô‰‰ÕÑÑ½¸ˆûš~—r/šr7–.gšŠwš²øğ½‰ÕÑÑ½¸øœ°(€€€€€€€€€€€€€€€€€€€€€€€€œñ‰ÕÑÑ½¸¥ô‰…‘É••AÉ¥Ù…å	ÕÑÑ½¸ˆÑåÁ”ô‰‰ÕÑÑ½¸ˆûš~—r/¦jÇš²+šRÿ¶Xğ½‰ÕÑÑ½¸øœ°(€€€€€€€€€€€€€€€€€€€€œğ½‘¥Øøœ°(€€€€€€€€€€€€€€€€€€€€œñÀ±…ÍÌô‰…µ™É•”µÍ•ÉÙ¥”µÑ½‘¼µ¹½Ñ”ˆû¦š²û¢š?–&šr7–.gšŠwš²û¢"¦jÇš²+šRÿ¶[¦‚¦v‹–Âk–ú¢¢·–ºk¾òošr«¢¢·–ºk–&7’â7šr–Â;–BG’â7–¶c–r£jÚË–vğ½Àøœ°(€€€€€€€€€€€€€€€€œğ½Í•Ñ¥½¸øœ°(€€€€€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰…µ™É•”µÍ•ÉÙ¥”µ…Ñ¥½¹Ìˆøœ°(€€€€€€€€€€€€€€€€€€€€œñ‰ÕÑÑ½¸¥ô‰…‘É••AÕÉ¡…Í•	ÕÑÑ½¸ˆ±…ÍÌô‰…µ™É•”µÍ•ÉÙ¥”µÁÕÉ¡…Í”ˆÑåÁ”ô‰‰ÕÑÑ½¸ˆ‘¥Í…‰±•…É¥„µ±…‰•°ô‹¢Îó¢ÊÜ€ÌÀƒ–’§–7–î–F(9Päç¾ò3n»–&7’îcš²ûšr7–.gšê[–
g’â´ˆû’îcš²ûšr7–.gšê[–
g’â´ğ½‰ÕÑÑ½¸øœ°(€€€€€€€€€€€€€€€€€€€€œñ‰ÕÑÑ½¸¥ô‰…‘É••­¹½İ±•‘•	ÕÑÑ½¸ˆ±…ÍÌô‰…µ™É•”µÍ•ÉÙ¥”µ…­¹½İ±•‘”ˆÑåÁ”ô‰‰ÕÑÑ½¸ˆûš"G~—¦O’êğ½‰ÕÑÑ½¸øœ°(€€€€€€€€€€€€€€€€œğ½‘¥Øøœ°(€€€€€€€€€€€€œğ½Í•Ñ¥½¸øœ(€€€€€€€t¹©½¥¸ ˆˆ¤ì((€€€€€€€½¹ÍĞÍÕÁÁ½ÉÑµ…¥°õ‘½Õµ•¹Ğ¹•Ñ±•µ•¹Ñ	å% ‰…‘É••MÕÁÁ½ÉÑµ…¥°ˆ¤ì(€€€€€€€¥˜¡ÍÕÁÁ½ÉÑµ…¥°¥ì(€€€€€€€€€€€ÍÕÁÁ½ÉÑµ…¥°¹Ñ•áÑ½¹Ñ•¹Ğõ½¹™¥ÕÉ•‘µ…¥°ì(€€€€€€€€€€€ÍÕÁÁ½ÉÑµ…¥°¹‘…Ñ…Í•Ğ¹Ñ½‘¼ô‰™…±Í”ˆì(€€€€€€€ô((€€€€€€€½¹™¥ÕÉ•A½±¥å	ÕÑÑ½¸ ‰…‘É••I•™Õ¹‘A½±¥å	ÕÑÑ½¸ˆ±½¹™¥œ¹É•™Õ¹‘A½±¥åUÉ°°‹¦š²û¢š?–&ˆ¤ì(€€€€€€€½¹™¥ÕÉ•A½±¥å	ÕÑÑ½¸ ‰…‘É••Q•ÉµÍ	ÕÑÑ½¸ˆ±½¹™¥œ¹Ñ•ÉµÍUÉ°°‹šr7–.gšŠwš²øˆ¤ì(€€€€€€€½¹™¥ÕÉ•A½±¥å	ÕÑÑ½¸ ‰…‘É••AÉ¥Ù…å	ÕÑÑ½¸ˆ±½¹™¥œ¹ÁÉ¥Ù…åA½±¥åUÉ°°‹¦jÇš²+šRÿ¶Xˆ¤ì((€€€€€€€½¹ÍĞÁÕÉ¡…Í•	ÕÑÑ½¸õ‘½Õµ•¹Ğ¹•Ñ±•µ•¹Ñ	å% ‰…‘É••AÕÉ¡…Í•	ÕÑÑ½¸ˆ¤ì(€€€€€€€½¹ÍĞÁÕÉ¡…Í•UÉ°õÉ•Í½±Ù•½¹™¥ÕÉ•‘UÉ°¡½¹™¥œ¹ÁÕÉ¡…Í•UÉ°¤ì(€€€€€€€¥˜¡ÁÕÉ¡…Í•	ÕÑÑ½¸˜™½¹™¥œ¹ÁÕÉ¡…Í•¹…‰±•ôôõÑÉÕ”˜™ÁÕÉ¡…Í•UÉ°¥ì(€€€€€€€€€€€ÁÕÉ¡…Í•	ÕÑÑ½¸¹‘¥Í…‰±•õ™…±Í”ì(€€€€€€€€€€€ÁÕÉ¡…Í•	ÕÑÑ½¸¹Ñ•áÑ½¹Ñ•¹Ğô‹¢Îó¢ÊÜ€ÌÀƒ–’§–7–î–F(9Pääˆì(€€€€€€€€€€€ÁÕÉ¡…Í•	ÕÑÑ½¸¹Í•ÑÑÑÉ¥‰ÕÑ” ‰…É¥„µ±…‰•°ˆ°‹¢Îó¢ÊÜ€ÌÀƒ–’§–7–î–F(9Pääˆ¤ì(€€€€€€€€€€€ÁÕÉ¡…Í•	ÕÑÑ½¸¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ±™Õ¹Ñ¥½¸ ¥ì(€€€€€€€€€€€€€€€İ¥¹‘½Ü¹½Á•¸¡ÁÕÉ¡…Í•UÉ°°‰}‰±…¹¬ˆ°‰¹½½Á•¹•È±¹½É•™•ÉÉ•Èˆ¤ì(€€€€€€€€€€€ô¤ì(€€€€€€€ô((€€€€€€€½¹ÍĞ…­¹½İ±•‘•	ÕÑÑ½¸õ‘½Õµ•¹Ğ¹•Ñ±•µ•¹Ñ	å% ‰…‘É••­¹½İ±•‘•	ÕÑÑ½¸ˆ¤ì(€€€€€€€¥˜¡…­¹½İ±•‘•	ÕÑÑ½¸¥ì(€€€€€€€€€€€…­¹½İ±•‘•	ÕÑÑ½¸¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ±±½Í•‘É••M•ÉÙ¥•%¹™½5½‘…°¤ì(€€€€€€€ô((€€€€€€€€¼¼Q=<¡A…ä¤èƒ–†¯–—š¶–ò?¦š²û¢š?–&šr7–.gšŠwš²û¦jÇš²+šRÿ¶[ÚË–v(€€€€€€€€¼¼Q=<¡A…ä¤èƒ–º3š"CÚƒV3’îcš²û¢"’îcš²ûÖCšzs¦¦_¢¶'–ú3¾ò3š&7–>¿¢¢·–ºhÁÕÉ¡…Í•¹…‰±•õÑÉÕ”ƒ¢"ÁÕÉ¡…Í•UÉ³(€€€ô((€€€™Õ¹Ñ¥½¸½Á•¹‘É••M•ÉÙ¥•%¹™½5½‘…° ¥ì(€€€€€€€½¹ÍĞÁ…ÉÑÌõ•Ñ5½‘…±A…ÉÑÌ ¤ì(€€€€€€€¥˜ …Á…ÉÑÌ¥ìÉ•ÑÕÉ¸™…±Í”ìô(€€€€€€€¥˜¡Á…ÉÑÌ¹µ½‘…°¹±…ÍÍ1¥ÍĞ¹½¹Ñ…¥¹Ì ‰Í¡½Üˆ¤˜˜…Á…ÉÑÌ¹µ½‘…°¹±…ÍÍ1¥ÍĞ¹½¹Ñ…¥¹Ì¡}I}5=}1ML¤¥ì(€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€ô((€€€€€€€Á…ÉÑÌ¹Ñ¥Ñ±”¹Ñ•áÑ½¹Ñ•¹Ğô‹+–no¢Æ‡šÆšæ[–
Ï,ˆì(€€€€€€€É•¹‘•É‘É••M•ÉÙ¥•	½‘ä¡Á…ÉÑÌ¹‰½‘ä¤ì(€€€€€€€Á…ÉÑÌ¹‰½‘ä¹ÍÉ½±±Q½ÀôÀì(€€€€€€€Á…ÉÑÌ¹µ½‘…°¹±…ÍÍ1¥ÍĞ¹…‘¡}I}5=}1ML¤ì(€€€€€€€Á…ÉÑÌ¹µ½‘…°¹Í•ÑÑÑÉ¥‰ÕÑ” ‰É½±”ˆ°‰‘¥…±½œˆ¤ì(€€€€€€€Á…ÉÑÌ¹µ½‘…°¹Í•ÑÑÑÉ¥‰ÕÑ” ‰…É¥„µµ½‘…°ˆ°‰ÑÉÕ”ˆ¤ì(€€€€€€€Á…ÉÑÌ¹µ½‘…°¹Í•ÑÑÑÉ¥‰ÕÑ” ‰…É¥„µ±…‰•±±•‘‰äˆ°‰¡½µ••…ÑÕÉ•5½‘…±Q¥Ñ±”ˆ¤ì(€€€€€€€Á…ÉÑÌ¹µ½‘…°¹±…ÍÍ1¥ÍĞ¹…‘ ‰Í¡½Üˆ¤ì(€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€ô((€€€™Õ¹Ñ¥½¸±½Í•‘É••M•ÉÙ¥•%¹™½5½‘…° ¥ì(€€€€€€€½¹ÍĞÁ…ÉÑÌõ•Ñ5½‘…±A…ÉÑÌ ¤ì(€€€€€€€¥˜ …Á…ÉÑÍñğ…Á…ÉÑÌ¹µ½‘…°¹±…ÍÍ1¥ÍĞ¹½¹Ñ…¥¹Ì¡}I}5=}1ML¤¥ìÉ•ÑÕÉ¸™…±Í”ìô(€€€€€€€¥˜¡ÑåÁ•½˜İ¥¹‘½Ü¹±½Í•!½µ••…ÑÕÉ”ôôô‰™Õ¹Ñ¥½¸ˆ¥ì(€€€€€€€€€€€İ¥¹‘½Ü¹±½Í•!½µ••…ÑÕÉ” ¤ì(€€€€€€€õ•±Í•ì(€€€€€€€€€€€Á…ÉÑÌ¹µ½‘…°¹±…ÍÍ1¥ÍĞ¹É•µ½Ù” ‰Í¡½Üˆ¤ì(€€€€€€€ô(€€€€€€€Á…ÉÑÌ¹µ½‘…°¹±…ÍÍ1¥ÍĞ¹É•µ½Ù”¡}I}5=}1ML¤ì(€€€€€€€Á…ÉÑÌ¹µ½‘…°¹É•µ½Ù•ÑÑÉ¥‰ÕÑ” ‰É½±”ˆ¤ì(€€€€€€€Á…ÉÑÌ¹µ½‘…°¹É•µ½Ù•ÑÑÉ¥‰ÕÑ” ‰…É¥„µµ½‘…°ˆ¤ì(€€€€€€€Á…ÉÑÌ¹µ½‘…°¹É•µ½Ù•ÑÑÉ¥‰ÕÑ” ‰…É¥„µ±…‰•±±•‘‰äˆ¤ì(€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€ô((€€€İ¥¹‘½Ü¹}I}MIY%}%MA1e}A=1%dõ}I}%MA1e}A=1%dì(€€€İ¥¹‘½Ü¹½Á•¹‘É••M•ÉÙ¥•%¹™½5½‘…°õ½Á•¹‘É••M•ÉÙ¥•%¹™½5½‘…°ì(€€€İ¥¹‘½Ü¹±½Í•‘É••M•ÉÙ¥•%¹™½5½‘…°õ±½Í•‘É••M•ÉÙ¥•%¹™½5½‘…°ì(((€€€™Õ¹Ñ¥½¸É½ÍÑ•É9Õµ‰•È¡Ù…±Õ”¥ì(€€€€€€€½¹ÍĞ¹Õµ‰•Èõ9Õµ‰•È¡Ù…±Õ”¤ì(€€€€€€€É•ÑÕÉ¸9Õµ‰•È¹¥Í¥¹¥Ñ”¡¹Õµ‰•È¤ı¹Õµ‰•ÈèÀì(€€€ô(€€€™Õ¹Ñ¥½¸É½ÍÑ•ÉÍ…Á”¡Ù…±Õ”¥ì(€€€€€€€É•ÑÕÉ¸MÑÉ¥¹œ¡Ù…±Õ”ôõ¹Õ±°üˆˆéÙ…±Õ”¤(€€€€€€€€€€€€¹É•Á±…” ¼˜½œ°ˆ™…µÀìˆ¤¹É•Á±…” ¼ğ½œ°ˆ™±Ğìˆ¤¹É•Á±…” ¼ø½œ°ˆ™Ğìˆ¤(€€€€€€€€€€€€¹É•Á±…” ½pˆ½œ°ˆ™ÅÕ½Ğìˆ¤¹É•Á±…” ¼œ½œ°ˆ˜ŒÀÌäìˆ¤ì(€€€ô(€€€™Õ¹Ñ¥½¸É½ÍÑ•ÉI•Í½ÕÉ•Q•áĞ¡Ù…±Õ”¥ì(€€€€€€€½¹ÍĞİ¡½±”õ5…Ñ ¹µ…à À±5…Ñ ¹™±½½È¡É½ÍÑ•É9Õµ‰•È¡Ù…±Õ”¤¤¤ì(€€€€€€€¥˜¡İ¡½±”øôÄÀÀÀÀÀÀÀÀ¥ì(€€€€€€€€€€€½¹ÍĞ½µÁ…Ğõİ¡½±”¼ÄÀÀÀÀÀÀÀÀì(€€€€€€€€€€€É•ÑÕÉ¸½µÁ…Ğ¹Ñ½¥á•¡½µÁ…ĞøôÄÀüÄèÈ¤¹É•Á±…” ½p¸üÀ¬½œ°ˆˆ¤¬‹–ˆì(€€€€€€€ô(€€€€€€€¥˜¡İ¡½±”øôÄÀÀÀÀ¥ìÉ•ÑÕÉ¸5…Ñ ¹™±½½È¡İ¡½±”¼ÄÀÀÀÀ¤¬‹¢B°ˆìô(€€€€€€€É•ÑÕÉ¸İ¡½±”¹Ñ½1½…±•MÑÉ¥¹œ ‰é µQ\ˆ¤ì(€€€ô(€€€™Õ¹Ñ¥½¸Íå¹I½ÍÑ•ÉI•Í½ÕÉ”¡¹½‘”±Ù…±Õ”¥ì(€€€€€€€¥˜ …¹½‘”¥ìÉ•ÑÕÉ¸ìô(€€€€€€€½¹ÍĞİ¡½±”õ5…Ñ ¹µ…à À±5…Ñ ¹™±½½È¡É½ÍÑ•É9Õµ‰•È¡Ù…±Õ”¤¤¤ì(€€€€€€€½¹ÍĞ™Õ±°õİ¡½±”¹Ñ½1½…±•MÑÉ¥¹œ ‰é µQ\ˆ¤ì(€€€€€€€¹½‘”¹Ñ•áÑ½¹Ñ•¹ĞõÉ½ÍÑ•ÉI•Í½ÕÉ•Q•áĞ¡İ¡½±”¤ì(€€€€€€€¹½‘”¹Ñ¥Ñ±”õ™Õ±°ì¹½‘”¹Í•ÑÑÑÉ¥‰ÕÑ” ‰…É¥„µ±…‰•°ˆ±™Õ±°¤ì(€€€ô(€€€½¹ÍĞ!=5}I1%}MU55Ie}Q1=õİ¥¹‘½Ü¹½ÕÉMåµ‰½±ÍI•±¥MÕµµ…Éå…Ñ…±½ññ=‰©•Ğ¹™É••é”¡íô¤ì(€€€±•Ğ™¥ÉÍÑMÉ••¹Y¥ÍÕ…±I•…‘åAÉ½µ¥Í”õ¹Õ±°ì(€€€™Õ¹Ñ¥½¸¹•áÑA…¥¹Ğ ¥ìÉ•ÑÕÉ¸¹•ÜAÉ½µ¥Í”¡É•Í½±Ù”ôùÉ•ÅÕ•ÍÑ¹¥µ…Ñ¥½¹É…µ”  ¤ôùÉ•ÅÕ•ÍÑ¹¥µ…Ñ¥½¹É…µ”¡É•Í½±Ù”¤¤¤ìô(€€€™Õ¹Ñ¥½¸ÕÉ±ÍÉ½µMÑå±”¡Ù…±Õ”¥ì(€€€€€€€½¹ÍĞÕÉ±Ìõmtì(€€€€€€€MÑÉ¥¹œ¡Ù…±Õ•ñğˆˆ¤¹É•Á±…” ½ÕÉ±p  üèˆ¡mx‰t¬¤‰ğœ¡mxt¬¤ğ¡myp¥t¬¤¥p¤½œ°¡}…±°±‘½Õ‰±•EÕ½Ñ•±Í¥¹±•EÕ½Ñ•±Á±…¥¸¤ôùí½¹ÍĞÕÉ°ô¡‘½Õ‰±•EÕ½Ñ•‘ññÍ¥¹±•EÕ½Ñ•‘ññÁ±…¥¹ñğˆˆ¤¹ÑÉ¥´ ¤í¥˜¡ÕÉ°˜™ÕÉ°„ôô‰¹½¹”ˆ¥íÕÉ±Ì¹ÁÕÍ ¡ÕÉ°¤íõÉ•ÑÕÉ¸}…±°íô¤ì(€€€€€€€É•ÑÕÉ¸ÕÉ±Ìì(€€€ô(€€€™Õ¹Ñ¥½¸‘•½‘•%µ…•UÉ°¡ÕÉ°¥ì(€€€€€€€É•ÑÕÉ¸¹•ÜAÉ½µ¥Í” ¡É•Í½±Ù”±É•©•Ğ¤ôùí½¹ÍĞ¥µ…”õ¹•Ü%µ…” ¤í¥µ…”¹‘•½‘¥¹œô‰…Íå¹Œˆí¥µ…”¹½¹±½…ô ¤ôùÑåÁ•½˜¥µ…”¹‘•½‘”ôôô‰™Õ¹Ñ¥½¸ˆı¥µ…”¹‘•½‘” ¤¹Ñ¡•¸¡É•Í½±Ù”±É•©•Ğ¤éÉ•Í½±Ù” ¤í¥µ…”¹½¹•ÉÉ½Èô ¤ôùÉ•©•Ğ¡¹•ÜÉÉ½È ‹’âï–~;¦š[–Æ?–r[&‡šÎW¢ò'–—¾òhˆ­ÕÉ°¤¤í¥µ…”¹ÍÉŒõÕÉ°íô¤ì(€€€ô(€€€™Õ¹Ñ¥½¸½±±•Ñ¥ÉÍÑMÉ••¹Y¥ÍÕ…±UÉ±Ì ¥ì(€€€€€€€½¹ÍĞÕÉ±Ìõ¹•ÜM•Ğ ¤ì(€€€€€€€lˆ¡½µ•A…”ˆ°ˆ¡½µ•A…”€¹¡½µ”µ‰œµ™¥á•µ±…å•Èˆ°ˆ¡½µ•A…”€¹¡½µ”µ…Éµ¥½¸ˆ°ˆØÄĞÙ!½µ•I½ÍÑ•Èˆ°ˆ¡½µ•A…”¥µœˆ°ˆ‰½ÑÑ½µ9…Ø¥µœˆ°ˆµ…¥¹	½ÑÑ½µ9…Ø¥µœ‰t¹™½É… ¡Í•±•Ñ½Èôù‘½Õµ•¹Ğ¹ÅÕ•ÉåM•±•Ñ½É±°¡Í•±•Ñ½È¤¹™½É… ¡¹½‘”ôùí¥˜¡¹½‘”¹Ñ…9…µ”ôôô‰%5ˆ˜™¹½‘”¹ÕÉÉ•¹ÑMÉŒ¥íÕÉ±Ì¹…‘¡¹½‘”¹ÕÉÉ•¹ÑMÉŒ¤íõÕÉ±ÍÉ½µMÑå±”¡•Ñ½µÁÕÑ•‘MÑå±”¡¹½‘”¤¹‰…­É½Õ¹‘%µ…”¤¹™½É… ¡ÕÉ°ôùÕÉ±Ì¹…‘¡ÕÉ°¤¤íô¤¤ì(€€€€€€€É•ÑÕÉ¸l¸¸¹ÕÉ±Ítì(€€€ô(€€€…Íå¹Œ™Õ¹Ñ¥½¸ÁÉ•Á…É•¥ÉÍÑMÉ••¹Y¥ÍÕ…±Ì ¥ì(€€€€€€€¥˜¡™¥ÉÍÑMÉ••¹Y¥ÍÕ…±I•…‘åAÉ½µ¥Í”¥íÉ•ÑÕÉ¸™¥ÉÍÑMÉ••¹Y¥ÍÕ…±I•…‘åAÉ½µ¥Í”íô(€€€€€€€™¥ÉÍÑMÉ••¹Y¥ÍÕ…±I•…‘åAÉ½µ¥Í”ô¡…Íå¹Œ ¤ôùì(€€€€€€€€€€€½¹ÍĞ¡½µ”õ‘½Õµ•¹Ğ¹•Ñ±•µ•¹Ñ	å% ‰¡½µ•A…”ˆ¤±É½ÍÑ•Èõ‘½Õµ•¹Ğ¹•Ñ±•µ•¹Ñ	å% ‰ØÄĞÙ!½µ•I½ÍÑ•Èˆ¤ì(€€€€€€€€€€€¥˜ …¡½µ•ñğ…É½ÍÑ•ÉññÉ½ÍÑ•È¹‘…Ñ…Í•Ğ¹É•…‘ä„ôô‰ÑÉÕ”ˆ¥íÑ¡É½Ü¹•ÜÉÉ½È ‹’âï–~;¦š[–Æ?¢ÎšZg–Âkšr«–º3š"C€ˆ¤íô(€€€€€€€€€€€½¹ÍĞÕÉ±Ìõ½±±•Ñ¥ÉÍÑMÉ••¹Y¥ÍÕ…±UÉ±Ì ¤ì¥˜ …ÕÉ±Ì¹±•¹Ñ ¥íÑ¡É½Ü¹•ÜÉÉ½È ‹’âï–~;¦š[–Æ?–r[&šâ–Z»
ë¦ë€ˆ¤íô(€€€€€€€€€€€½¹ÍĞ™½¹ÑÌõ‘½Õµ•¹Ğ¹™½¹ÑÌ˜™‘½Õµ•¹Ğ¹™½¹ÑÌ¹É•…‘äı‘½Õµ•¹Ğ¹™½¹ÑÌ¹É•…‘äéAÉ½µ¥Í”¹É•Í½±Ù” ¤ì…İ…¥ĞAÉ½µ¥Í”¹…±°¡m™½¹ÑÌ°¸¸¹ÕÉ±Ì¹µ…À¡‘•½‘•%µ…•UÉ°¥t¤ì…İ…¥Ğ¹•áÑA…¥¹Ğ ¤ì(€€€€€€€€€€€½¹ÍĞ±¥Ù•UÉ±Ìõ¹•ÜM•Ğ¡½±±•Ñ¥ÉÍÑMÉ••¹Y¥ÍÕ…±UÉ±Ì ¤¤ì¥˜¡ÕÉ±Ì¹Í½µ”¡ÕÉ°ôø…±¥Ù•UÉ±Ì¹¡…Ì¡ÕÉ°¤¤¥íÑ¡É½Ü¹•ÜÉÉ½È ‹’âï–~;¦š[–Æ?–r[&–r£æ«¢÷–&7¢Š¯šnÿš>o€ˆ¤íô(€€€€€€€€€€€ÑÉåí¥˜¡Á•É™½Éµ…¹”˜™ÑåÁ•½˜Á•É™½Éµ…¹”¹µ…É¬ôôô‰™Õ¹Ñ¥½¸ˆ¥íÁ•É™½Éµ…¹”¹µ…É¬ ‰™½ÕÈµÍåµ‰½±Ìéµ…¥¸µ¥ÑäµÙ¥ÍÕ…°µÉ•…‘äˆ¤íõõ…Ñ ¡|¥ìô(€€€€€€€€€€€É•ÑÕÉ¸=‰©•Ğ¹™É••é”¡í…ÍÍ•ÑÌéÕÉ±Ì¹±•¹Ñ¡ô¤ì(€€€€€€€ô¤ ¤¹…Ñ ¡•ÉÉ½Èôùí™¥ÉÍÑMÉ••¹Y¥ÍÕ…±I•…‘åAÉ½µ¥Í”õ¹Õ±°íÑ¡É½Ü•ÉÉ½Èíô¤ì(€€€€€€€É•ÑÕÉ¸™¥ÉÍÑMÉ••¹Y¥ÍÕ…±I•…‘åAÉ½µ¥Í”ì(€€€ô((€€€™Õ¹Ñ¥½¸¡½µ•I½ÍÑ•ÉA±…•¡½±‘•È¡¥¹‘•à¥ì(€€€€€€€É•ÑÕÉ¸€œñ…ÉÑ¥±”±…ÍÌô‰ØÄĞØµ¡½µ”µ¡…É…Ñ•ÈØÄĞØµ¡½µ”µ¡…É…Ñ•ÈµÁ±…•¡½±‘•Èˆ‘…Ñ„µ¡½µ”µÉ½ÍÑ•ÈµÍ±½Ğôˆœ­¥¹‘•à¬œˆ…É¥„µ‰ÕÍäô‰ÑÉÕ”ˆøœ¬(€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰ØÄĞØµ¡½µ”µ…Ù…Ñ…Èˆ…É¥„µ¡¥‘‘•¸ô‰ÑÉÕ”ˆøğ½‘¥Øøœ¬(€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰ØÄĞØµ¡½µ”µ¡…É…Ñ•Èµµ…¥¸ˆøñ‘¥Øøñˆû¦j+’ò7¢ÎšZg¢ò'–—’â´ğ½ˆøñÍÁ…¸ø´´ğ½ÍÁ…¸øğ½‘¥Øøœ¬(€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰ØÄĞØµ¡½µ”µÉ•Í½ÕÉ”¡Àˆøñ¤ÍÑå±”ô‰İ¥‘Ñ èÀ”ˆøğ½¤øñÍÑÉ½¹œù!@€´´ğ½ÍÑÉ½¹œøğ½‘¥Øøœ¬(€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰ØÄĞØµ¡½µ”µÉ•Í½ÕÉ”ÍÀˆøñ¤ÍÑå±”ô‰İ¥‘Ñ èÀ”ˆøğ½¤øñÍÑÉ½¹œùM@€´´ğ½ÍÑÉ½¹œøğ½‘¥Øøğ½‘¥Øøğ½…ÉÑ¥±”øœì(€€€ô((€€€™Õ¹Ñ¥½¸•¹ÍÕÉ•!½µ•I½ÍÑ•ÉM¡•±° ¥ì(€€€€€€€½¹ÍĞÁ…”õ‘½Õµ•¹Ğ¹•Ñ±•µ•¹Ñ	å% ‰¡½µ•A…”ˆ¤ì(€€€€€€€½¹ÍĞÉ¥õÁ…”˜™Á…”¹ÅÕ•ÉåM•±•Ñ½È ˆ¹¡½µ”µ…ÉµÉ¥ˆ¤ì(€€€€€€€¥˜ …Á…•ñğ…É¥¥ìÉ•ÑÕÉ¸¹Õ±°ìô(€€€€€€€±•ĞÉ½ÍÑ•Èõ‘½Õµ•¹Ğ¹•Ñ±•µ•¹Ñ	å% ‰ØÄĞÙ!½µ•I½ÍÑ•Èˆ¤ì(€€€€€€€¥˜ …É½ÍÑ•È¥ì(€€€€€€€€€€€É½ÍÑ•Èõ‘½Õµ•¹Ğ¹É•…Ñ•±•µ•¹Ğ ‰Í•Ñ¥½¸ˆ¤ì(€€€€€€€€€€€É½ÍÑ•È¹¥ô‰ØÄĞÙ!½µ•I½ÍÑ•Èˆì(€€€€€€€€€€€É½ÍÑ•È¹±…ÍÍ9…µ”ô‰ØÄĞØµ¡½µ”µÉ½ÍÑ•Èˆì(€€€€€€€€€€€É½ÍÑ•È¹Í•ÑÑÑÉ¥‰ÕÑ” ‰…É¥„µ±…‰•°ˆ°‹–K¦j«¦j+’ò4ˆ¤ì(€€€€€€€€€€€É¥¹¥¹Í•ÉÑ‘©…•¹Ñ±•µ•¹Ğ ‰…™Ñ•É•¹ˆ±É½ÍÑ•È¤ì(€€€€€€€ô(€€€€€€€¥˜ …É½ÍÑ•È¹ÅÕ•ÉåM•±•Ñ½È ˆéÍ½Á”€ø¡•…‘•Èˆ¤¥ì(€€€€€€€€€€€½¹ÍĞ¡•…‘•Èõ‘½Õµ•¹Ğ¹É•…Ñ•±•µ•¹Ğ ‰¡•…‘•Èˆ¤ì(€€€€€€€€€€€½¹ÍĞÕÉÉ•¹Ñ½±õÑåÁ•½˜½±„ôô‰Õ¹‘•™¥¹•ˆ(€€€€€€€€€€€€€€€€ı5…Ñ ¹µ…à À±5…Ñ ¹™±½½È¡É½ÍÑ•É9Õµ‰•È¡½±¤¤¤¹Ñ½1½…±•MÑÉ¥¹œ ‰é µQ\ˆ¤(€€€€€€€€€€€€€€€€èˆÀˆì(€€€€€€€€€€€¡•…‘•È¹¥¹¹•É!Q50ôœñˆû–K¦j«¦j+’ò4ğ½ˆøñÍÁ…¸±…ÍÌô‰ØÄĞØµ¡½µ”µÉ½ÍÑ•Èµ½Õ¹Ğˆû¦j+’ò4€´´€¼€Øğ½ÍÁ…¸øñÍÁ…¸±…ÍÌô‰ØÄĞØµ¡½µ”µÉ½ÍÑ•Èµ½±ˆû¦G–æŒ€ñÍÑÉ½¹œ¥ô‰ØÄĞÙ!½µ•I½ÍÑ•É½±‘Y…±Õ”ˆøœ­ÕÉÉ•¹Ñ½±¬œğ½ÍÑÉ½¹œøğ½ÍÁ…¸øñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÌô‰Øµ™¥á•µ™½Éµ…Ñ¥½¸µ•¹ÑÉäˆ‘…Ñ„µ™•…ÑÕÉ”ô‰…µ•Á±…äµ½É”ˆ½¹±¥¬ô‰½Á•¹!½µ••…ÑÕÉ”¡p™½Éµ…Ñ¥½¹pœ¤ˆû’ö#¦fŒğ½‰ÕÑÑ½¸øœì(€€€€€€€€€€€É½ÍÑ•È¹…ÁÁ•¹‘¡¥±¡¡•…‘•È¤ì(€€€€€€€ô(€€€€€€€¥˜ …É½ÍÑ•È¹ÅÕ•ÉåM•±•Ñ½È ˆ¹ØÄĞØµ¡½µ”µ¡…É…Ñ•Èˆ¤¥ì(€€€€€€€€€€€™½È¡±•Ğ¥¹‘•àôÀí¥¹‘•àğÌí¥¹‘•à¬¬¥ì(€€€€€€€€€€€€€€€É½ÍÑ•È¹¥¹Í•ÉÑ‘©…•¹Ñ!Q50 ‰‰•™½É••¹ˆ±¡½µ•I½ÍÑ•ÉA±…•¡½±‘•È¡¥¹‘•à¤¤ì(€€€€€€€€€€€ô(€€€€€€€ô(€€€€€€€±•ĞÉ•±¥M±½ĞõÉ½ÍÑ•È¹ÅÕ•ÉåM•±•Ñ½È ˆ¹Ñ•…´µÉ•±¥Œµ±½…‘½ÕĞµÍ±½Ğˆ¤ì(€€€€€€€¥˜ …É•±¥M±½Ğ¥ì(€€€€€€€€€€€É•±¥M±½Ğõ‘½Õµ•¹Ğ¹É•…Ñ•±•µ•¹Ğ ‰‘¥Øˆ¤ì(€€€€€€€€€€€É•±¥M±½Ğ¹±…ÍÍ9…µ”ô‰Ñ•…´µÉ•±¥Œµ±½…‘½ÕĞµÍ±½Ğˆì(€€€€€€€€€€€É•±¥M±½Ğ¹‘…Ñ…Í•Ğ¹É•…‘äô‰™…±Í”ˆì(€€€€€€€€€€€É•±¥M±½Ğ¹¥¹¹•É!Q50ôœñÍÁ…¸û¦j+’ò7c–¾Øğ½ÍÁ…¸øñˆûc–¾Û¢ÎšZg¢ò'–—’â´ğ½ˆøñÍµ…±°û¶'–úš¶–ò?–¶cšªS–º3š"C¢šz@ğ½Íµ…±°øñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ‘…Ñ„µ™•…ÑÕÉ”ô‰É•±¥Œˆ½¹±¥¬ô‰½Á•¹!½µ••…ÑÕÉ”¡pÉ•±¥pœ¤ˆ‘¥Í…‰±•û¦ãšNğ½‰ÕÑÑ½¸øœì(€€€€€€€€€€€É½ÍÑ•È¹…ÁÁ•¹‘¡¥±¡É•±¥M±½Ğ¤ì(€€€€€€€ô(€€€€€€€É•ÑÕÉ¸É½ÍÑ•Èì(€€€ô((€€€™Õ¹Ñ¥½¸É•…‘!½µ•I•±¥M…Ù” ¥ì(€€€€€€€ÑÉåì(€€€€€€€€€€€½¹ÍĞÉ•Á½Í¥Ñ½Éäõİ¥¹‘½Ü¹½ÕÉMåµ‰½±Í½Õ¹ÑM…Ù”ì(€€€€€€€€€€€½¹ÍĞÕ¥õÉ•Á½Í¥Ñ½Éä˜™É•Á½Í¥Ñ½Éä¹•ÑÑ¥Ù•U¥ ¤ì(€€€€€€€€€€€¥˜ …É•Á½Í¥Ñ½Éåñğ…Õ¥¥ìÉ•ÑÕÉ¸¹Õ±°ìô(€€€€€€€€€€€½¹ÍĞÉ•ÍÕ±ĞõÉ•Á½Í¥Ñ½Éä¹É•…‘½ÉU¥¡Õ¥¤ì(€€€€€€€€€€€É•ÑÕÉ¸É•ÍÕ±Ğ˜™É•ÍÕ±Ğ¹ÍÑ…ÑÕÌôôô‰É•…‘äˆ˜™É•ÍÕ±Ğ¹Í…Ù”˜™ÑåÁ•½˜É•ÍÕ±Ğ¹Í…Ù”ôôô‰½‰©•Ğˆ(€€€€€€€€€€€€€€€€ıÉ•ÍÕ±Ğ¹Í…Ù”(€€€€€€€€€€€€€€€€é¹Õ±°ì(€€€€€€€õ…Ñ ¡|¥ì(€€€€€€€€€€€É•ÑÕÉ¸¹Õ±°ì(€€€€€€€ô(€€€ô((€€€™Õ¹Ñ¥½¸Íå¹!½µ•I•±¥MÕµµ…Éä ¥ì(€€€€€€€½¹ÍĞÉ½ÍÑ•Èõ•¹ÍÕÉ•!½µ•I½ÍÑ•ÉM¡•±° ¤ì(€€€€€€€½¹ÍĞÍ±½ĞõÉ½ÍÑ•È˜™É½ÍÑ•È¹ÅÕ•ÉåM•±•Ñ½È ˆ¹Ñ•…´µÉ•±¥Œµ±½…‘½ÕĞµÍ±½Ğˆ¤ì(€€€€€€€¥˜ …Í±½Ğ¥ìÉ•ÑÕÉ¸™…±Í”ìô(€€€€€€€½¹ÍĞÍ…Ù”õÉ•…‘!½µ•I•±¥M…Ù” ¤ì(€€€€€€€¥˜ …Í…Ù”¥ì(€€€€€€€€€€€Í±½Ğ¹‘…Ñ…Í•Ğ¹É•…‘äô‰™…±Í”ˆì(€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€ô(€€€€€€€½¹ÍĞÉ•±¥%õÍ…Ù”¹Ñ•…µ1½…‘½ÕĞ˜™ÑåÁ•½˜Í…Ù”¹Ñ•…µ1½…‘½ÕĞôôô‰½‰©•Ğˆ(€€€€€€€€€€€€ıMÑÉ¥¹œ¡Í…Ù”¹Ñ•…µ1½…‘½ÕĞ¹É•±¥%‘ñğˆˆ¤(€€€€€€€€€€€€èˆˆì(€€€€€€€½¹ÍĞ‘•™¥¹¥Ñ¥½¸õÉ•±¥%ı!=5}I1%}MU55Ie}Q1=mÉ•±¥%‘té¹Õ±°ì(€€€€€€€½¹ÍĞ½İ¹•õÉ•±¥%˜™Í…Ù”¹Á±…å•ÉI•±¥Ì˜™ÑåÁ•½˜Í…Ù”¹Á±…å•ÉI•±¥Ìôôô‰½‰©•Ğˆ(€€€€€€€€€€€€ıÍ…Ù”¹Á±…å•ÉI•±¥ÍmÉ•±¥%‘t(€€€€€€€€€€€€é¹Õ±°ì(€€€€€€€½¹ÍĞ±•Ù•°õ5…Ñ ¹µ…à Ä±5…Ñ ¹µ¥¸ ÈÀ±5…Ñ ¹™±½½È¡É½ÍÑ•É9Õµ‰•È¡½İ¹•˜™½İ¹•¹±•Ù•°¥ñğÄ¤¤¤ì(€€€€€€€Í±½Ğ¹¥¹¹•É!Q50õ‘•™¥¹¥Ñ¥½¸(€€€€€€€€€€€€üœñÍÁ…¸û¦j+’ò7c–¾Øğ½ÍÁ…¸øñˆøœ­É½ÍÑ•ÉÍ…Á”¡‘•™¥¹¥Ñ¥½¸¹¹…µ”¤¬œ1Ø¸œ­±•Ù•°¬œğ½ˆøñÍµ…±°øœ­É½ÍÑ•ÉÍ…Á”¡‘•™¥¹¥Ñ¥½¸¹ÑÉ¥•ÉQ•áĞ¤¬œğ½Íµ…±°øñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ‘…Ñ„µ™•…ÑÕÉ”ô‰É•±¥Œˆ½¹±¥¬ô‰½Á•¹!½µ••…ÑÕÉ”¡pÉ•±¥pœ¤ˆûšnÓš>lğ½‰ÕÑÑ½¸øœ(€€€€€€€€€€€€èœñÍÁ…¸û¦j+’ò7c–¾Øğ½ÍÁ…¸øñˆû–Âkšr«¢w–
dğ½ˆøñÍµ…±°ûš¾?¦j+–¢÷¢w–
dÇ’îÛc–¾Øğ½Íµ…±°øñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ‘…Ñ„µ™•…ÑÕÉ”ô‰É•±¥Œˆ½¹±¥¬ô‰½Á•¹!½µ••…ÑÕÉ”¡pÉ•±¥pœ¤ˆû¦ãšNğ½‰ÕÑÑ½¸øœì(€€€€€€€Í±½Ğ¹‘…Ñ…Í•Ğ¹É•…‘äô‰ÑÉÕ”ˆì(€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€ô((€€€™Õ¹Ñ¥½¸É•¹‘•É!½µ•I½ÍÑ•È ¥ì(€€€€€€€™¥ÉÍÑMÉ••¹Y¥ÍÕ…±I•…‘åAÉ½µ¥Í”õ¹Õ±°ì(€€€€€€€½¹ÍĞÉ½ÍÑ•Èõ•¹ÍÕÉ•!½µ•I½ÍÑ•ÉM¡•±° ¤ì(€€€€€€€¥˜ …É½ÍÑ•ÉññÑåÁ•½˜•Ñá¥ÍÑ¥¹A…ÉÑå%¹‘•á•Ì„ôô‰™Õ¹Ñ¥½¸ˆ¥ìÉ•ÑÕÉ¸™…±Í”ìô(€€€€€€€½¹ÍĞÁ…ÉÑå%¹‘•á•Ìõ•Ñá¥ÍÑ¥¹A…ÉÑå%¹‘•á•Ì ¤¹Í±¥” À°Ì¤ì(€€€€€€€½¹ÍĞ…Ù…¥±…‰±•áÀõÑåÁ•½˜İ¥¹‘½Ü¹ØÄÜÍ•ÑÙ…¥±…‰±•áÁA½½°ôôô‰™Õ¹Ñ¥½¸ˆ(€€€€€€€€€€€€ıİ¥¹‘½Ü¹ØÄÜÍ•ÑÙ…¥±…‰±•áÁA½½°¡…Ñ”¹¹½Ü ¤¤(€€€€€€€€€€€€è¡ÑåÁ•½˜Í¡…É•‘áÀ„ôô‰Õ¹‘•™¥¹•ˆıÍ¡…É•‘áÀèÀ¤ì(€€€€€€€Íå¹I½ÍÑ•ÉI•Í½ÕÉ”¡‘½Õµ•¹Ğ¹•Ñ±•µ•¹Ñ	å% ‰¡½µ•!Õ‘½±‘Y…±Õ”ˆ¤±ÑåÁ•½˜½±„ôô‰Õ¹‘•™¥¹•ˆı½±èÀ¤ì(€€€€€€€Íå¹I½ÍÑ•ÉI•Í½ÕÉ”¡‘½Õµ•¹Ğ¹•Ñ±•µ•¹Ñ	å% ‰¡½µ•!Õ‘áÁY…±Õ”ˆ¤±…Ù…¥±…‰±•áÀ¤ì(€€€€€€€½¹ÍĞ½Õ¹ĞõÉ½ÍÑ•È¹ÅÕ•ÉåM•±•Ñ½È ˆ¹ØÄĞØµ¡½µ”µÉ½ÍÑ•Èµ½Õ¹Ğˆ¤ì(€€€€€€€¥˜¡½Õ¹Ğ¥ì½Õ¹Ğ¹Ñ•áÑ½¹Ñ•¹Ğô‹¦j+’ò4€ˆ­Á…ÉÑå%¹‘•á•Ì¹±•¹Ñ ¬ˆ€¼€Øˆìô((€€€€€€€½¹ÍĞ…É‘Ìõmtì(€€€€€€€™½È¡±•ĞÍ±½Ñ%¹‘•àôÀíÍ±½Ñ%¹‘•àğÌíÍ±½Ñ%¹‘•à¬¬¥ì(€€€€€€€€€€€½¹ÍĞ¥¹‘•àõÁ…ÉÑå%¹‘•á•ÍmÍ±½Ñ%¹‘•átì(€€€€€€€€€€€½¹ÍĞ¡…É…Ñ•ÈõÑåÁ•½˜¥¹‘•àôôô‰¹Õµ‰•Èˆ˜™ÑåÁ•½˜•ÑA…ÉÑå¡…É…Ñ•É	å%¹‘•àôôô‰™Õ¹Ñ¥½¸ˆ(€€€€€€€€€€€€€€€€ı•ÑA…ÉÑå¡…É…Ñ•É	å%¹‘•à¡¥¹‘•à¤(€€€€€€€€€€€€€€€€é¹Õ±°ì(€€€€€€€€€€€½¹ÍĞÍÑ…ÑÌõÑåÁ•½˜¥¹‘•àôôô‰¹Õµ‰•Èˆ˜™ÑåÁ•½˜•ÑA…ÉÑå	…ÑÑ±•MÑ…ÑÌôôô‰™Õ¹Ñ¥½¸ˆ(€€€€€€€€€€€€€€€€ı•ÑA…ÉÑå	…ÑÑ±•MÑ…ÑÌ¡¥¹‘•à¤(€€€€€€€€€€€€€€€€é¹Õ±°ì(€€€€€€€€€€€¥˜ …¡…É…Ñ•Éñğ…ÍÑ…ÑÌ¥ì(€€€€€€€€€€€€€€€…É‘Ì¹ÁÕÍ  œñ…ÉÑ¥±”±…ÍÌô‰ØÄĞØµ¡½µ”µ¡…É…Ñ•ÈØÄĞØµ¡½µ”µ¡…É…Ñ•Èµ•µÁÑäˆ‘…Ñ„µ¡½µ”µÉ½ÍÑ•ÈµÍ±½Ğôˆœ­Í±½Ñ%¹‘•à¬œˆøñ‘¥Ø±…ÍÌô‰ØÄĞØµ¡½µ”µ…Ù…Ñ…Èˆ…É¥„µ¡¥‘‘•¸ô‰ÑÉÕ”ˆøğ½‘¥Øøñ‘¥Ø±…ÍÌô‰ØÄĞØµ¡½µ”µ¡…É…Ñ•Èµµ…¥¸ˆøñ‘¥Øøñˆû¦j+’ò7¦ë’ö4ğ½ˆøñÍÁ…¸ø´´ğ½ÍÁ…¸øğ½‘¥Øøñ‘¥Ø±…ÍÌô‰ØÄĞØµ¡½µ”µÉ•Í½ÕÉ”¡Àˆøñ¤ÍÑå±”ô‰İ¥‘Ñ èÀ”ˆøğ½¤øñÍÑÉ½¹œù!@€´´ğ½ÍÑÉ½¹œøğ½‘¥Øøñ‘¥Ø±…ÍÌô‰ØÄĞØµ¡½µ”µÉ•Í½ÕÉ”ÍÀˆøñ¤ÍÑå±”ô‰İ¥‘Ñ èÀ”ˆøğ½¤øñÍÑÉ½¹œùM@€´´ğ½ÍÑÉ½¹œøğ½‘¥Øøğ½‘¥Øøğ½…ÉÑ¥±”øœ¤ì(€€€€€€€€€€€€€€€½¹Ñ¥¹Õ”ì(€€€€€€€€€€€ô(€€€€€€€€€€€½¹ÍĞ¡Àõ5…Ñ ¹µ…à À±5…Ñ ¹µ¥¸¡É½ÍÑ•É9Õµ‰•È¡ÍÑ…ÑÌ¹µ…á!@¤±É½ÍÑ•É9Õµ‰•È¡¡…É…Ñ•È¹¡À¤¤¤ì(€€€€€€€€€€€½¹ÍĞÍÀõ5…Ñ ¹µ…à À±5…Ñ ¹µ¥¸¡É½ÍÑ•É9Õµ‰•È¡ÍÑ…ÑÌ¹µ…áM@¤±É½ÍÑ•É9Õµ‰•È¡¡…É…Ñ•È¹ÍÀ¤¤¤ì(€€€€€€€€€€€½¹ÍĞ¡ÁA•É•¹ĞõÉ½ÍÑ•É9Õµ‰•È¡ÍÑ…ÑÌ¹µ…á!@¤øÀı¡À½É½ÍÑ•É9Õµ‰•È¡ÍÑ…ÑÌ¹µ…á!@¤¨ÄÀÀèÀì(€€€€€€€€€€€½¹ÍĞÍÁA•É•¹ĞõÉ½ÍÑ•É9Õµ‰•È¡ÍÑ…ÑÌ¹µ…áM@¤øÀıÍÀ½É½ÍÑ•É9Õµ‰•È¡ÍÑ…ÑÌ¹µ…áM@¤¨ÄÀÀèÀì(€€€€€€€€€€€½¹ÍĞ…ÉÑİ½É¬õÑåÁ•½˜•Ñ¡…É…Ñ•ÉÉÑİ½É­A…Ñ ôôô‰™Õ¹Ñ¥½¸ˆı•Ñ¡…É…Ñ•ÉÉÑİ½É­A…Ñ ¡¡…É…Ñ•È¤èˆˆì(€€€€€€€€€€€…É‘Ì¹ÁÕÍ  œñ…ÉÑ¥±”±…ÍÌô‰ØÄĞØµ¡½µ”µ¡…É…Ñ•Èˆ‘…Ñ„µ¡½µ”µÉ½ÍÑ•ÈµÍ±½Ğôˆœ­Í±½Ñ%¹‘•à¬œˆ‘…Ñ„µ•±•µ•¹Ğôˆœ­É½ÍÑ•ÉÍ…Á”¡¡…É…Ñ•È¹•±•µ•¹Ññğ‰™¥É”ˆ¤¬œˆøœ¬(€€€€€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰ØÄĞØµ¡½µ”µ…Ù…Ñ…Èˆøñ¥µœÍÉŒôˆœ­É½ÍÑ•ÉÍ…Á”¡…ÉÑİ½É¬¤¬œˆ…±Ğôˆœ­É½ÍÑ•ÉÍ…Á”¡¡…É…Ñ•È¹¥‘ñğ‹¢K¢&Èˆ¤¬Ÿ¦‚·–<ˆøğ½‘¥Øøœ¬(€€€€€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰ØÄĞØµ¡½µ”µ¡…É…Ñ•Èµµ…¥¸ˆøñ‘¥Øøñˆøœ­É½ÍÑ•ÉÍ…Á”¡¡…É…Ñ•È¹¥‘ñğ ‹¢K¢&Èˆ¬¡¥¹‘•à¬Ä¤¤¤¬œğ½ˆøñÍÁ…¸ù1Ø¸œ­5…Ñ ¹µ…à Ä±5…Ñ ¹™±½½È¡É½ÍÑ•É9Õµ‰•È¡¡…É…Ñ•È¹±•Ù•°¥ñğÄ¤¤¬œğ½ÍÁ…¸øğ½‘¥Øøœ¬(€€€€€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰ØÄĞØµ¡½µ”µÉ•Í½ÕÉ”¡Àˆøñ¤ÍÑå±”ô‰İ¥‘Ñ èœ­¡ÁA•É•¹Ğ¬œ”ˆøğ½¤øñÍÑÉ½¹œù!@€œ­5…Ñ ¹™±½½È¡¡À¤¬œ€¼€œ­5…Ñ ¹™±½½È¡É½ÍÑ•É9Õµ‰•È¡ÍÑ…ÑÌ¹µ…á!@¤¤¬œğ½ÍÑÉ½¹œøğ½‘¥Øøœ¬(€€€€€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰ØÄĞØµ¡½µ”µÉ•Í½ÕÉ”ÍÀˆøñ¤ÍÑå±”ô‰İ¥‘Ñ èœ­ÍÁA•É•¹Ğ¬œ”ˆøğ½¤øñÍÑÉ½¹œùM@€œ­5…Ñ ¹™±½½È¡ÍÀ¤¬œ€¼€œ­5…Ñ ¹™±½½È¡É½ÍÑ•É9Õµ‰•È¡ÍÑ…ÑÌ¹µ…áM@¤¤¬œğ½ÍÑÉ½¹œøğ½‘¥Øøğ½‘¥Øøğ½…ÉÑ¥±”øœ¤ì(€€€€€€€ô((€€€€€€€É½ÍÑ•È¹ÅÕ•ÉåM•±•Ñ½É±° ˆ¹ØÄĞØµ¡½µ”µ¡…É…Ñ•Èˆ¤¹™½É… ¡¹½‘”ôù¹½‘”¹É•µ½Ù” ¤¤ì(€€€€€€€½¹ÍĞÉ•±¥M±½ĞõÉ½ÍÑ•È¹ÅÕ•ÉåM•±•Ñ½È ˆ¹Ñ•…´µÉ•±¥Œµ±½…‘½ÕĞµÍ±½Ğˆ¤ì(€€€€€€€¥˜¡É•±¥M±½Ğ¥ìÉ•±¥M±½Ğ¹¥¹Í•ÉÑ‘©…•¹Ñ!Q50 ‰‰•™½É•‰•¥¸ˆ±…É‘Ì¹©½¥¸ ˆˆ¤¤ìô(€€€€€€€•±Í•ìÉ½ÍÑ•È¹¥¹Í•ÉÑ‘©…•¹Ñ!Q50 ‰‰•™½É••¹ˆ±…É‘Ì¹©½¥¸ ˆˆ¤¤ìô(€€€€€€€É½ÍÑ•È¹‘…Ñ…Í•Ğ¹É•…‘äô‰ÑÉÕ”ˆì(€€€€€€€Íå¹!½µ•I•±¥MÕµµ…Éä ¤ì(€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€ô(€€€İ¥¹‘½Ü¹ØÔÑI•¹‘•É!½µ•I½ÍÑ•ÈõÉ•¹‘•É!½µ•I½ÍÑ•Èì(€€€İ¥¹‘½Ü¹½ÕÉMåµ‰½±Í!½µ•I•±¥MÕµµ…Éäõ=‰©•Ğ¹™É••é”¡ì(€€€€€€€•¹ÍÕÉ•M¡•±°é•¹ÍÕÉ•!½µ•I½ÍÑ•ÉM¡•±°°(€€€€€€€Íå¹ŒéÍå¹!½µ•I•±¥MÕµµ…Éä°(€€€€€€€ÁÉ•Á…É•¥ÉÍÑMÉ••¹Y¥ÍÕ…±Ì(€€€ô¤ì(€€€‘½Õµ•¹Ğ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰™½ÕÈµÍåµ‰½±ÌéÍÑ…ÉÑÕÀµÉ•…‘äˆ±™Õ¹Ñ¥½¸ ¥ì(€€€€€€€½¹ÍĞÉ½ÍÑ•Èõ‘½Õµ•¹Ğ¹•Ñ±•µ•¹Ñ	å% ‰ØÄĞÙ!½µ•I½ÍÑ•Èˆ¤ì(€€€€€€€¥˜ …É½ÍÑ•ÉññÉ½ÍÑ•È¹‘…Ñ…Í•Ğ¹É•…‘ä„ôô‰ÑÉÕ”ˆ¥íÉ•¹‘•É!½µ•I½ÍÑ•È ¤íô(€€€€€€€Íå¹!½µ•I•±¥MÕµµ…Éä ¤ì(€€€ô¤ì((€€€™Õ¹Ñ¥½¸‰½½Ğ ¥ì(€€€€€€€…ÁÁ±ä ¤ì(€€€€€€€•¹ÍÕÉ•‘É••½¹™¥œ ¤ì(€€€€€€€•¹ÍÕÉ•!½µ•I½ÍÑ•ÉM¡•±° ¤ì(€€€ô((€€€¥˜¡‘½Õµ•¹Ğ¹É•…‘åMÑ…Ñ”€ôôô€‰±½…‘¥¹œˆ¥ì(€€€€€€€‘½Õµ•¹Ğ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰=5½¹Ñ•¹Ñ1½…‘•ˆ±‰½½Ğ±í½¹”éÑÉÕ•ô¤ì(€€€õ•±Í•ì(€€€€€€€‰½½Ğ ¤ì(€€€ô)ô¤ ¤ì(((¼¨‰Õ¹‘±•Í½ÕÉ”è©Ì¼ÄÜµÍÑ…”µØØÀµÑÉ…¥¹¥¹œµÉ•¹‘•ÈµÕ…É¹©Ì€¨¼(¡™Õ¹Ñ¥½¸ ¥ì(‰ÕÍ”ÍÑÉ¥Ğˆì)İ¥¹‘½Ü¹5}9Q%Y}=9%I5}	M1%9ô‰XÔĞˆì)İ¥¹‘½Ü¹5}9Q%Y}UII9Q}YIM%=8ô‰XØÀˆì)İ¥¹‘½Ü¹5}9Q%Y}1MQ}M=Aô‰ÑÉ…¥¹¥¹œµ™Õ±°µÍ½ÕÉ”µ…Õ‘¥Ğˆì()½¹ÍĞXÄÜÌĞÑ}i=9}IPõì(€€€‘•Í•ÉĞè‰…ÍÍ•ÑÌ½µ…ÁÌ½‘•Í•ÉĞµØÄÜÌĞĞ¹Á¹œˆ°(€€€¥”è‰…ÍÍ•ÑÌ½µ…ÁÌ½¥”µØÄÜÌĞĞ¹Á¹œˆ°(€€€é½¹”Ğè‰…ÍÍ•ÑÌ½µ…ÁÌ½é½¹”ĞµØÄÜÌĞĞ¹Á¹œˆ°(€€€é½¹”Ôè‰…ÍÍ•ÑÌ½µ…ÁÌ½é½¹”ÔµØÄÜÌĞĞ¹Á¹œˆ°(€€€é½¹”Øè‰…ÍÍ•ÑÌ½µ…ÁÌ½é½¹”ØµØÄÜÌĞĞ¹Á¹œˆ°(€€€é½¹”Üè‰…ÍÍ•ÑÌ½µ…ÁÌ½é½¹”ÜµØÄÜÌĞĞ¹Á¹œˆ°(€€€é½¹”àè‰…ÍÍ•ÑÌ½µ…ÁÌ½é½¹”àµØÄÜÌĞĞ¹Á¹œˆ°(€€€é½¹”äè‰…ÍÍ•ÑÌ½µ…ÁÌ½é½¹”äµØÄÜÌĞĞ¹Á¹œˆ°(€€€é½¹”ÄÀè‰…ÍÍ•ÑÌ½µ…ÁÌ½é½¹”ÄÀµØÄÜÌĞĞ¹Á¹œˆ)ôì)ÑÉåì¥˜¡ÑåÁ•½˜é½¹•	…­É½Õ¹‘%µ…•Ì„ôô‰Õ¹‘•™¥¹•ˆ¥ì=‰©•Ğ¹…ÍÍ¥¸¡é½¹•	…­É½Õ¹‘%µ…•Ì±XÄÜÌĞÑ}i=9}IP¤ìôõ…Ñ ¡|¥ìô)ÑÉåì¥˜¡ÑåÁ•½˜µ…Ái½¹•	…­É½Õ¹‘%µ…•Ì„ôô‰Õ¹‘•™¥¹•ˆ¥ì=‰©•Ğ¹…ÍÍ¥¸¡µ…Ái½¹•	…­É½Õ¹‘%µ…•Ì±XÄÜÌĞÑ}i=9}IP¤ìôõ…Ñ ¡|¥ìô()™Õ¹Ñ¥½¸•¹™½É•QÉ…¥¹¥¹I•¹‘•È ¥ì(€€€½¹ÍĞÁ…”õ‘½Õµ•¹Ğ¹•Ñ±•µ•¹Ñ	å% ‰ÑÉ…¥¹¥¹A…”ˆ¤ì(€€€¥˜¡Á…”¥ì(€€€€€€€Á…”¹ÅÕ•ÉåM•±•Ñ½É±° ˆ¹ÑÉ…¥¹¥¹œµé½¹”µ¥Ñ•´ˆ¤¹™½É… ¡™Õ¹Ñ¥½¸¡•°¥ì(€€€€€€€€€€€•°¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ‰™½¹ĞµÍ¥é”ˆ°ˆÈÁÁàˆ°‰¥µÁ½ÉÑ…¹Ğˆ¤ì(€€€€€€€€€€€•°¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ‰Á…‘‘¥¹œˆ°ˆÙÁà€ÄÑÁàˆ°‰¥µÁ½ÉÑ…¹Ğˆ¤ì(€€€€€€€€€€€•°¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ‰µ¥¸µ¡•¥¡Ğˆ°ˆĞÉÁàˆ°‰¥µÁ½ÉÑ…¹Ğˆ¤ì(€€€€€€€€€€€•°¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ‰±¥¹”µ¡•¥¡Ğˆ°ˆÄ¸ÄÔˆ°‰¥µÁ½ÉÑ…¹Ğˆ¤ì(€€€€€€€€€€€•°¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ‰‰½àµÍ¥é¥¹œˆ°‰‰½É‘•Èµ‰½àˆ°‰¥µÁ½ÉÑ…¹Ğˆ¤ì(€€€€€€€ô¤ì(€€€ô((€€€€¼¨(€€€€€€Q¡”ÑÉ…¥¹¥¹œé½¹”¥¹™½Éµ…Ñ¥½¸µ½‘…°ÕÍ•Ñ¼É••¥Ù”İ¥‘Ñ ½µ…àµ¡•¥¡Ğ¼(€€€€€€½Ù•É™±½Ü¥¹±¥¹”ÍÑå±•Ì¡•É”¸Q¡½Í”‘•±…É…Ñ¥½¹Ì™½Õ¡ĞÑ¡”Í¡…É•U$(€€€€€€Í¥é¥¹œ…ÕÑ¡½É¥Ñä…¹µ…‘”Ñ¡”İ¡½±”™É…µ”Ñ¡”ÍÉ½±°½İ¹•È¸•½µ•ÑÉä¥Ì(€€€€€€¹½Ü½İ¹•‰äÍÌ¼ÈÀµÍÑ…”µØØÀµÑÉ…¥¹¥¹œµ½¹±äµÍ…™•Ñä¹ÍÌìÑ¡¥ÌÉÕ¹Ñ¥µ”Õ…É(€€€€€€¥¹Ñ•¹Ñ¥½¹…±±äÑ½Õ¡•Ì½¹±äÑ¡”ÑÉ…¥¹¥¹œµé½¹”±¥ÍĞ¥Ñ•µÌ…‰½Ù”¸(€€€€¨¼)ô)¥˜¡‘½Õµ•¹Ğ¹É•…‘åMÑ…Ñ”ôôô‰±½…‘¥¹œˆ¥ì(€€€‘½Õµ•¹Ğ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰=5½¹Ñ•¹Ñ1½…‘•ˆ±•¹™½É•QÉ…¥¹¥¹I•¹‘•È±í½¹”éÑÉÕ•ô¤ì)õ•±Í•ì(€€€•¹™½É•QÉ…¥¹¥¹I•¹‘•È ¤ì)ô)ô¤ ¤ì(((¼¨‰Õ¹‘±•Í½ÕÉ”è©Ì¼ÄàµÍÑ…”µØØĞµ¡…É…Ñ•ÈµÑ½Õ µ…Ñ¥½¸µÉÕ¹Ñ¥µ”¹©Ì€¨¼(¡™Õ¹Ñ¥½¸ ¥ì(‰ÕÍ”ÍÑÉ¥Ğˆì)™Õ¹Ñ¥½¸Í•Ñ¡…É…Ñ•ÉQ½Õ¡5½‘”¡…Ñ¥Ù”¥ì(€€€½¹ÍĞÉ½½Ğõ‘½Õµ•¹Ğ¹‘½Õµ•¹Ñ±•µ•¹Ğì(€€€½¹ÍĞ‰½‘äõ‘½Õµ•¹Ğ¹‰½‘äì(€€€½¹ÍĞÙ¥•İÁ½ÉĞõ‘½Õµ•¹Ğ¹•Ñ±•µ•¹Ñ	å% ‰…µ”µÙ¥•İÁ½ÉĞˆ¤ì(€€€½¹ÍĞÍÑ…”õ‘½Õµ•¹Ğ¹•Ñ±•µ•¹Ñ	å% ‰…µ”µÍÑ…”ˆ¤ì(€€€mÉ½½Ğ±‰½‘ä±Ù¥•İÁ½ÉĞ±ÍÑ…•t¹™½É… ¡™Õ¹Ñ¥½¸¡•°¥ì(€€€€€€€¥˜ …•°¥É•ÑÕÉ¸ì(€€€€€€€•°¹±…ÍÍ1¥ÍĞ¹Ñ½±” ‰¡…É…Ñ•ÈµÍÉ½±°µ…Ñ¥Ù”ˆ°„……Ñ¥Ù”¤ì(€€€ô¤ì)ô)™Õ¹Ñ¥½¸Íå¹¡…É…Ñ•ÉQ½Õ¡5½‘” ¥ì(€€€½¹ÍĞµ½‘…°õ‘½Õµ•¹Ğ¹•Ñ±•µ•¹Ñ	å% ‰¡½µ••…ÑÕÉ•5½‘…°ˆ¤ì(€€€½¹ÍĞÑ…‰Ìõ‘½Õµ•¹Ğ¹•Ñ±•µ•¹Ñ	å% ‰¡…É…Ñ•ÉQ…‰½¹Ñ•¹Ğˆ¤ì(€€€½¹ÍĞ…Ñ¥Ù”ô„„¡µ½‘…°€˜˜Ñ…‰Ì€˜˜•Ñ½µÁÕÑ•‘MÑå±”¡µ½‘…°¤¹‘¥ÍÁ±…ä„ôô‰¹½¹”ˆ€˜˜µ½‘…°¹±…ÍÍ1¥ÍĞ¹½¹Ñ…¥¹Ì ‰Í¡½Üˆ¤¤ì(€€€Í•Ñ¡…É…Ñ•ÉQ½Õ¡5½‘”¡…Ñ¥Ù”¤ì)ô)¥˜¡‘½Õµ•¹Ğ¹É•…‘åMÑ…Ñ”ôôô‰±½…‘¥¹œˆ¥‘½Õµ•¹Ğ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰=5½¹Ñ•¹Ñ1½…‘•ˆ±Íå¹¡…É…Ñ•ÉQ½Õ¡5½‘”±í½¹”éÑÉÕ•ô¤ì)•±Í”Íå¹¡…É…Ñ•ÉQ½Õ¡5½‘” ¤ì)½¹ÍĞ½‰Í•ÉÙ•Èõ¹•Ü5ÕÑ…Ñ¥½¹=‰Í•ÉÙ•È¡Íå¹¡…É…Ñ•ÉQ½Õ¡5½‘”¤ì)½‰Í•ÉÙ•È¹½‰Í•ÉÙ”¡‘½Õµ•¹Ğ¹‰½‘ä±íÍÕ‰ÑÉ•”éÑÉÕ”±¡¥±‘1¥ÍĞéÑÉÕ”±…ÑÑÉ¥‰ÕÑ•ÌéÑÉÕ”±…ÑÑÉ¥‰ÕÑ•¥±Ñ•Èél‰±…ÍÌˆ°‰ÍÑå±”‰uô¤ì)İ¥¹‘½Ü¹Íå¹¡…É…Ñ•ÉQ½Õ¡5½‘”õÍå¹¡…É…Ñ•ÉQ½Õ¡5½‘”ì)ô¤ ¤ì(((¼¨‰Õ¹‘±•Í½ÕÉ”è©Ì¼ÄäµÍÑ…”µØÜàµ¡…É…Ñ•Èµ¥¹Ù•¹Ñ½ÉäµÉÕ¹Ñ¥µ”¹©Ì€¨¼(¡™Õ¹Ñ¥½¸ ¥ì(‰ÕÍ”ÍÑÉ¥Ğˆì()±•ĞÉ…™%ôÀì()™Õ¹Ñ¥½¸•ÑMÑ…•M…±” ¥ì(€€€½¹ÍĞÍÑ…”ô(€€€€€€€‘½Õµ•¹Ğ¹•Ñ±•µ•¹Ñ	å% (€€€€€€€€€€€€‰…µ”µÍÑ…”ˆ(€€€€€€€€¤ì((€€€¥˜ …ÍÑ…”¥ì(€€€€€€€É•ÑÕÉ¸€Äì(€€€ô((€€€½¹ÍĞÉ•Ğô(€€€€€€€ÍÑ…”¹•Ñ	½Õ¹‘¥¹±¥•¹ÑI•Ğ ¤ì((€€€½¹ÍĞÍ…±”ô(€€€€€€€É•Ğ¹İ¥‘Ñ ¼ÄÀàÀì((€€€É•ÑÕÉ¸€ (€€€€€€€9Õµ‰•È¹¥Í¥¹¥Ñ”¡Í…±”¤€˜˜(€€€€€€€Í…±”øÀ(€€€€¤(€€€€€€€€üÍ…±”(€€€€€€€€è€Äì)ô()™Õ¹Ñ¥½¸É•±•…Í•¡…É…Ñ•É1…å½ÕÑ=İ¹•ÉÍ¡¥À¡µ½‘…°±‰½‘ä±É½½Ğ±¥¹Ù•¹Ñ½Éä±™½É”¥ì(€€€¥˜ (€€€€€€€€…µ½‘…°ñğ(€€€€€€€€ …™½É”€˜˜µ½‘…°¹‘…Ñ…Í•Ğ¹ØÜá¡…É…Ñ•É1…å½ÕÑÑ¥Ù”„ôôˆÄˆ¤(€€€€¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô((€€€½¹ÍĞ‰½àõµ½‘…°¹ÅÕ•ÉåM•±•Ñ½È ˆ¹¡½µ”µ™•…ÑÕÉ”µµ½‘…°µ‰½à¹İ¥‘”ˆ¤ì(€€€¥˜¡‰½à¥ì(€€€€€€€l(€€€€€€€€€€€€‰‘¥ÍÁ±…äˆ°‰™±•àµ‘¥É•Ñ¥½¸ˆ°‰İ¥‘Ñ ˆ°‰µ…àµİ¥‘Ñ ˆ°‰¡•¥¡Ğˆ°(€€€€€€€€€€€€‰µ…àµ¡•¥¡Ğˆ°‰µ¥¸µ¡•¥¡Ğˆ°‰½Ù•É™±½Üˆ(€€€€€€€t¹™½É… ¡ÁÉ½Á•ÉÑäôù‰½à¹ÍÑå±”¹É•µ½Ù•AÉ½Á•ÉÑä¡ÁÉ½Á•ÉÑä¤¤ì(€€€ô((€€€¥˜¡‰½‘ä¥ì(€€€€€€€l(€€€€€€€€€€€€‰‘¥ÍÁ±…äˆ°‰™±•àµ‘¥É•Ñ¥½¸ˆ°‰™±•àˆ°‰¡•¥¡Ğˆ°‰µ¥¸µ¡•¥¡Ğˆ°‰½Ù•É™±½Üˆ(€€€€€€€t¹™½É… ¡ÁÉ½Á•ÉÑäôù‰½‘ä¹ÍÑå±”¹É•µ½Ù•AÉ½Á•ÉÑä¡ÁÉ½Á•ÉÑä¤¤ì(€€€ô((€€€¥˜¡É½½Ğ¥ì(€€€€€€€l(€€€€€€€€€€€€‰™±•àˆ°‰¡•¥¡Ğˆ°‰µ…àµ¡•¥¡Ğˆ°‰µ¥¸µ¡•¥¡Ğˆ°‰½Ù•É™±½Üµäˆ°‰½Ù•É™±½Üµàˆ°(€€€€€€€€€€€€ˆµİ•‰­¥Ğµ½Ù•É™±½ÜµÍÉ½±±¥¹œˆ°‰½Ù•ÉÍÉ½±°µ‰•¡…Ù¥½Èµäˆ°‰Ñ½Õ µ…Ñ¥½¸ˆ°(€€€€€€€€€€€€‰ÍÉ½±±‰…ÈµÕÑÑ•Èˆ(€€€€€€€t¹™½É… ¡ÁÉ½Á•ÉÑäôùÉ½½Ğ¹ÍÑå±”¹É•µ½Ù•AÉ½Á•ÉÑä¡ÁÉ½Á•ÉÑä¤¤ì(€€€ô((€€€¥˜¡¥¹Ù•¹Ñ½Éä¥ì(€€€€€€€l‰½Ù•É™±½Üˆ°‰ÑÉ…¹Í™½É´‰t¹™½É… ¡ÁÉ½Á•ÉÑäôù¥¹Ù•¹Ñ½Éä¹ÍÑå±”¹É•µ½Ù•AÉ½Á•ÉÑä¡ÁÉ½Á•ÉÑä¤¤ì(€€€ô((€€€‘•±•Ñ”µ½‘…°¹‘…Ñ…Í•Ğ¹ØÜá¡…É…Ñ•É1…å½ÕÑÑ¥Ù”ì)ô()™Õ¹Ñ¥½¸…ÁÁ±å9½Ü ¥ì(€€€½¹ÍĞµ½‘…°ô(€€€€€€€‘½Õµ•¹Ğ¹•Ñ±•µ•¹Ñ	å% (€€€€€€€€€€€€‰¡½µ••…ÑÕÉ•5½‘…°ˆ(€€€€€€€€¤ì((€€€½¹ÍĞ‰½‘äô(€€€€€€€‘½Õµ•¹Ğ¹•Ñ±•µ•¹Ñ	å% (€€€€€€€€€€€€‰¡½µ••…ÑÕÉ•5½‘…±	½‘äˆ(€€€€€€€€¤ì((€€€½¹ÍĞÉ½½Ğô(€€€€€€€‘½Õµ•¹Ğ¹•Ñ±•µ•¹Ñ	å% (€€€€€€€€€€€€‰¡…É…Ñ•ÉQ…‰½¹Ñ•¹Ğˆ(€€€€€€€€¤ì((€€€½¹ÍĞ¥¹Ù•¹Ñ½Éäô(€€€€€€€‘½Õµ•¹Ğ¹•Ñ±•µ•¹Ñ	å% (€€€€€€€€€€€€‰¥¹Ù•¹Ñ½ÉåA…”ˆ(€€€€€€€€¤ì((€€€¥˜ (€€€€€€€€…µ½‘…°ñğ(€€€€€€€€…‰½‘äñğ(€€€€€€€€…µ½‘…°¹±…ÍÍ1¥ÍĞ¹½¹Ñ…¥¹Ì ‰Í¡½Üˆ¤(€€€€¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô((€€€€¼¨(€€€€€€Q•…´I•±¥Œ½İ¹ÌÑ¡”Í¡…É•µ½‘…°‰½‘ä…Ì¥ÑÌÙ•ÉÑ¥…°ÍÉ½±°½¹Ñ…¥¹•È¸(€€€€€€%ÑÌ±…ÍÌ…¸‰”…ÁÁ±¥•‰•™½É”€¡…É…Ñ•ÉQ…‰½¹Ñ•¹Ğ¥ÌÁ¡åÍ¥…±±ä(€€€€€€É•Á±…•°Í¼½¹Ñ…¥¹µ•¹Ğ…±½¹”¥Ì¹½Ğ„ÍÕ™™¥¥•¹Ğ½İ¹•ÉÍ¡¥ÀÑ•ÍĞ¸(€€€€€€I•±¥¹ÅÕ¥Í Ñ¡”¡…É…Ñ•È±…å½ÕĞÍå¹¡É½¹½ÕÍ±ä…ÌÍ½½¸…ÌÑ¡”É•±¥Œµ½‘…°(€€€€€€±…ÍÌ…ÁÁ•…ÉÌì™½É”…±Í¼±•…ÉÌ…¹äÍÑ…±”¥¹±¥¹”€…¥µÁ½ÉÑ…¹ĞÍÑå±•Ì±•™Ğ(€€€€€€‰ä…¸½±‘•È¡…É…Ñ•ÈÙ¥•Ü•Ù•¸¥˜Ñ¡”‘…Ñ…Í•Ğµ…É­•Èİ…Ì±½ÍĞ¸(€€€€¨¼(€€€½¹ÍĞÉ•±¥=İ¹ÍM¡…É•‘5½‘…°ô(€€€€€€€µ½‘…°¹±…ÍÍ1¥ÍĞ¹½¹Ñ…¥¹Ì ‰Ñ•…´µÉ•±¥Œµµ½‘…°ˆ¤ñğ(€€€€€€€µ½‘…°¹±…ÍÍ1¥ÍĞ¹½¹Ñ…¥¹Ì ‰Ñ•…´µÉ•±¥Œµµ½‘”ˆ¤ì((€€€¥˜¡É•±¥=İ¹ÍM¡…É•‘5½‘…°¥ì(€€€€€€€É•±•…Í•¡…É…Ñ•É1…å½ÕÑ=İ¹•ÉÍ¡¥À (€€€€€€€€€€€µ½‘…°°(€€€€€€€€€€€‰½‘ä°(€€€€€€€€€€€É½½Ğ°(€€€€€€€€€€€¥¹Ù•¹Ñ½Éä°(€€€€€€€€€€€ÑÉÕ”(€€€€€€€€¤ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô((€€€€¼¨(€€€€€€Q¡¥Ì½İ¹•È¥Ì½¹±äÙ…±¥İ¡¥±”Ñ¡”¡…É…Ñ•È½ÍÑ…ÑÕÌ½Í­¥±°½¥¹Ù•¹Ñ½Éä(€€€€€€Í¡•±°¥Ì…ÑÕ…±±äµ½Õ¹Ñ•¥¹Í¥‘”Ñ¡”Í¡…É•µ½‘…°‰½‘ä¸Q¡”Í…µ”µ½‘…°(€€€€€€¥ÌÉ•ÕÍ•‰äÍ¡½À°ÅÕ•ÍÑÌ°Íå¹Ñ¡•Í¥Ì…¹Q•…´I•±¥Œ¸AÉ•Ù¥½ÕÍ±äÑ¡¥Ì(€€€€€€™Õ¹Ñ¥½¸­•ÁĞİÉ¥Ñ¥¹œ¥¹±¥¹”€…¥µÁ½ÉÑ…¹Ğ½Ù•É™±½Üé¡¥‘‘•¸Ñ¼Ñ¡”Í¡…É•(€€€€€€‰½‘ä•Ù•¸…™Ñ•È…¹½Ñ¡•È™•…ÑÕÉ”Ñ½½¬½İ¹•ÉÍ¡¥À°İ¡¥ ½Õ±½Ù•ÉÉ¥‘”(€€€€€€Q•…´I•±¥ŒÌ±•¥Ñ¥µ…Ñ”½Ù•É™±½Üµäé…ÕÑ¼…¹ÁÉ½‘Õ”¥¹Ñ•Éµ¥ÑÑ•¹Ğµ½‰¥±”(€€€€€€ÍÉ½±±¥¹œ‘•Á•¹‘¥¹œ½¸5ÕÑ…Ñ¥½¹=‰Í•ÉÙ•ÈÑ¥µ¥¹œ¸((€€€€€€Q¡”É½½Ğ…¸‰”½µÁ±•Ñ•±äÉ•µ½Ù•İ¡•¸…¹½Ñ¡•È™•…ÑÕÉ”É•Á±…•ÌÑ¡”(€€€€€€µ½‘…°‰½‘ä°Í¼É•±•…Í”µÕÍĞ…±Í¼ÉÕ¸İ¡•¸€¡…É…Ñ•ÉQ…‰½¹Ñ•¹Ğ¹¼±½¹•È(€€€€€€•á¥ÍÑÌ…Ğ…±°ìÉ•ÑÕÉ¹¥¹œ•…É±ä½¸€…É½½Ğİ½Õ±±•…Ù”Ñ¡”ÍÑ…±”¥¹±¥¹”(€€€€€€ÍÑå±•Ì‰•¡¥¹¥¹‘•™¥¹¥Ñ•±ä¸=4Ñ•ÍĞ‘½Õ‰±•ÌÕÍ•‰äÑ¡”É•Á½Í¥Ñ½Éä‘¼(€€€€€€¹½Ğ…±°¥µÁ±•µ•¹Ğ±•µ•¹Ğ¹½¹Ñ…¥¹Ì ¤°Í¼Ñ¡”É•…°½¹Ñ…¥¹µ•¹Ğ¡•¬¥Ì(€€€€€€ÕÍ•İ¡•¸…Ù…¥±…‰±”…¹½Ñ¡•Éİ¥Í”™…±±Ì‰…¬Ñ¼Ñ¡”¡¥ÍÑ½É¥…°µ½Õ¹Ñ•(€€€€€€…ÍÍÕµÁÑ¥½¸™½ÈÑ¡½Í”¥Í½±…Ñ•™¥áÑÕÉ•Ì¸(€€€€¨¼(€€€½¹ÍĞ¡…É…Ñ•ÉI½½Ñ5½Õ¹Ñ•ô„…É½½Ğ˜˜ (€€€€€€€ÑåÁ•½˜‰½‘ä¹½¹Ñ…¥¹Ìôôô‰™Õ¹Ñ¥½¸ˆ(€€€€€€€€€€€€ı‰½‘ä¹½¹Ñ…¥¹Ì¡É½½Ğ¤(€€€€€€€€€€€€éÑÉÕ”(€€€€¤ì(€€€¥˜ …¡…É…Ñ•ÉI½½Ñ5½Õ¹Ñ•¥ì(€€€€€€€É•±•…Í•¡…É…Ñ•É1…å½ÕÑ=İ¹•ÉÍ¡¥À¡µ½‘…°±‰½‘ä±É½½Ğ±¥¹Ù•¹Ñ½Éä¤ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô((€€€½¹ÍĞ‰½àô(€€€€€€€µ½‘…°¹ÅÕ•ÉåM•±•Ñ½È (€€€€€€€€€€€€ˆ¹¡½µ”µ™•…ÑÕÉ”µµ½‘…°µ‰½à¹İ¥‘”ˆ(€€€€€€€€¤ì((€€€¥˜ …‰½à¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô((€€€µ½‘…°¹‘…Ñ…Í•Ğ¹ØÜá¡…É…Ñ•É1…å½ÕÑÑ¥Ù”ôˆÄˆì((€€€‰½à¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä (€€€€€€€€‰‘¥ÍÁ±…äˆ°(€€€€€€€€‰™±•àˆ°(€€€€€€€€‰¥µÁ½ÉÑ…¹Ğˆ(€€€€¤ì((€€€‰½à¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä (€€€€€€€€‰™±•àµ‘¥É•Ñ¥½¸ˆ°(€€€€€€€€‰½±Õµ¸ˆ°(€€€€€€€€‰¥µÁ½ÉÑ…¹Ğˆ(€€€€¤ì((€€€€¼¨(€€€€€€XÄÜÌ¸ØÌÙ¥Í¥‰±”µ±…å½ÕĞ…ÕÑ¡½É¥Ñäè(€€€€€€¡…É…Ñ•È½ÍÑ…ÑÕÌ½Í­¥±°½¥¹Ù•¹Ñ½ÉäÍ¡…É”Ñ¡”µ…á¥µÕ´µ½‰¥±”…¹Ù…Ì¸(€€€€€€Q¡”™½Éµ•È€ÌäØƒ\€ØÈÀ¥¹±¥¹”1…É”A…¹•°Ù…±Õ•Ì½Ù•ÉÉ½‘”Ñ¡”XÄÜÌ¸ØÈ(€€€€€€ÍÑå±•Í¡••Ğ°Í¼Ñ¡”ÍÉ••¸¹•Ù•È…ÑÕ…±±ä•áÁ…¹‘•½¸Á¡½¹•Ì¸-••À½¹”(€€€€€€™¥á•½ÕÑ•È™É…µ”¡•É”…¹±•Ğ½¹±äÑ¡”¥¹¹•ÈÑ…ˆ½¹Ñ•¹ĞÍÉ½±°¸(€€€€¨¼(€€€‰½à¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä (€€€€€€€€‰İ¥‘Ñ ˆ°(€€€€€€€€‰…±Œ ÄÀÀ”€´€áÁà¤ˆ°(€€€€€€€€‰¥µÁ½ÉÑ…¹Ğˆ(€€€€¤ì((€€€‰½à¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä (€€€€€€€€‰µ…àµİ¥‘Ñ ˆ°(€€€€€€€€‰¹½¹”ˆ°(€€€€€€€€‰¥µÁ½ÉÑ…¹Ğˆ(€€€€¤ì((€€€‰½à¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä (€€€€€€€€‰¡•¥¡Ğˆ°(€€€€€€€€‰…±Œ ÄÀÀ”€´€áÁà¤ˆ°(€€€€€€€€‰¥µÁ½ÉÑ…¹Ğˆ(€€€€¤ì((€€€‰½à¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä (€€€€€€€€‰µ…àµ¡•¥¡Ğˆ°(€€€€€€€€‰…±Œ ÄÀÀ”€´€áÁà¤ˆ°(€€€€€€€€‰¥µÁ½ÉÑ…¹Ğˆ(€€€€¤ì((€€€‰½à¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä (€€€€€€€€‰µ¥¸µ¡•¥¡Ğˆ°(€€€€€€€€ˆÀˆ°(€€€€€€€€‰¥µÁ½ÉÑ…¹Ğˆ(€€€€¤ì((€€€‰½à¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä (€€€€€€€€‰½Ù•É™±½Üˆ°(€€€€€€€€‰¡¥‘‘•¸ˆ°(€€€€€€€€‰¥µÁ½ÉÑ…¹Ğˆ(€€€€¤ì((€€€‰½‘ä¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä (€€€€€€€€‰‘¥ÍÁ±…äˆ°(€€€€€€€€‰™±•àˆ°(€€€€€€€€‰¥µÁ½ÉÑ…¹Ğˆ(€€€€¤ì((€€€‰½‘ä¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä (€€€€€€€€‰™±•àµ‘¥É•Ñ¥½¸ˆ°(€€€€€€€€‰½±Õµ¸ˆ°(€€€€€€€€‰¥µÁ½ÉÑ…¹Ğˆ(€€€€¤ì((€€€‰½‘ä¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä (€€€€€€€€‰™±•àˆ°(€€€€€€€€ˆÄ€Ä…ÕÑ¼ˆ°(€€€€€€€€‰¥µÁ½ÉÑ…¹Ğˆ(€€€€¤ì((€€€‰½‘ä¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä (€€€€€€€€‰¡•¥¡Ğˆ°(€€€€€€€€‰…ÕÑ¼ˆ°(€€€€€€€€‰¥µÁ½ÉÑ…¹Ğˆ(€€€€¤ì((€€€‰½‘ä¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä (€€€€€€€€‰µ¥¸µ¡•¥¡Ğˆ°(€€€€€€€€ˆÀˆ°(€€€€€€€€‰¥µÁ½ÉÑ…¹Ğˆ(€€€€¤ì((€€€‰½‘ä¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä (€€€€€€€€‰½Ù•É™±½Üˆ°(€€€€€€€€‰¡¥‘‘•¸ˆ°(€€€€€€€€‰¥µÁ½ÉÑ…¹Ğˆ(€€€€¤ì((€€€É½½Ğ¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä (€€€€€€€€‰™±•àˆ°(€€€€€€€€ˆÄ€Ä…ÕÑ¼ˆ°(€€€€€€€€‰¥µÁ½ÉÑ…¹Ğˆ(€€€€¤ì((€€€É½½Ğ¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä (€€€€€€€€‰¡•¥¡Ğˆ°(€€€€€€€€‰…ÕÑ¼ˆ°(€€€€€€€€‰¥µÁ½ÉÑ…¹Ğˆ(€€€€¤ì((€€€É½½Ğ¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä (€€€€€€€€‰µ…àµ¡•¥¡Ğˆ°(€€€€€€€€‰¹½¹”ˆ°(€€€€€€€€‰¥µÁ½ÉÑ…¹Ğˆ(€€€€¤ì((€€€É½½Ğ¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä (€€€€€€€€‰µ¥¸µ¡•¥¡Ğˆ°(€€€€€€€€ˆÀˆ°(€€€€€€€€‰¥µÁ½ÉÑ…¹Ğˆ(€€€€¤ì((€€€½¹ÍĞ¥¹Ù•¹Ñ½Éå=İ¹ÍMÉ½±°ô(€€€€€€€€„„ (€€€€€€€€€€€¥¹Ù•¹Ñ½Éä€˜˜(€€€€€€€€€€€¥¹Ù•¹Ñ½Éä¹Á…É•¹Ñ±•µ•¹ĞôôõÉ½½Ğ(€€€€€€€€¤ì((€€€É½½Ğ¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä (€€€€€€€€‰½Ù•É™±½Üµäˆ°(€€€€€€€¥¹Ù•¹Ñ½Éå=İ¹ÍMÉ½±°(€€€€€€€€€€€€ü€‰¡¥‘‘•¸ˆ(€€€€€€€€€€€€è€‰ÍÉ½±°ˆ°(€€€€€€€€‰¥µÁ½ÉÑ…¹Ğˆ(€€€€¤ì((€€€É½½Ğ¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä (€€€€€€€€‰½Ù•É™±½Üµàˆ°(€€€€€€€€‰¡¥‘‘•¸ˆ°(€€€€€€€€‰¥µÁ½ÉÑ…¹Ğˆ(€€€€¤ì((€€€É½½Ğ¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä (€€€€€€€€ˆµİ•‰­¥Ğµ½Ù•É™±½ÜµÍÉ½±±¥¹œˆ°(€€€€€€€€‰Ñ½Õ ˆ°(€€€€€€€€‰¥µÁ½ÉÑ…¹Ğˆ(€€€€¤ì((€€€É½½Ğ¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä (€€€€€€€€‰½Ù•ÉÍÉ½±°µ‰•¡…Ù¥½Èµäˆ°(€€€€€€€€‰½¹Ñ…¥¸ˆ°(€€€€€€€€‰¥µÁ½ÉÑ…¹Ğˆ(€€€€¤ì((€€€É½½Ğ¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä (€€€€€€€€‰Ñ½Õ µ…Ñ¥½¸ˆ°(€€€€€€€€‰Á…¸µäˆ°(€€€€€€€€‰¥µÁ½ÉÑ…¹Ğˆ(€€€€¤ì((€€€É½½Ğ¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä (€€€€€€€€‰ÍÉ½±±‰…ÈµÕÑÑ•Èˆ°(€€€€€€€€‰ÍÑ…‰±”ˆ°(€€€€€€€€‰¥µÁ½ÉÑ…¹Ğˆ(€€€€¤ì((€€€¥˜¡¥¹Ù•¹Ñ½Éå=İ¹ÍMÉ½±°¥ì(€€€€€€€¥¹Ù•¹Ñ½Éä¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä (€€€€€€€€€€€€‰½Ù•É™±½Üˆ°(€€€€€€€€€€€€‰Ù¥Í¥‰±”ˆ°(€€€€€€€€€€€€‰¥µÁ½ÉÑ…¹Ğˆ(€€€€€€€€¤ì((€€€€€€€¥¹Ù•¹Ñ½Éä¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä (€€€€€€€€€€€€‰ÑÉ…¹Í™½É´ˆ°(€€€€€€€€€€€€‰¹½¹”ˆ°(€€€€€€€€€€€€‰¥µÁ½ÉÑ…¹Ğˆ(€€€€€€€€¤ì((€€€€€€€€¼¨(€€€€€€€€€€XÜÜƒj€Ä¼Ìƒ–7â»–Â<€Ä¼Ï¾òh(€€€€€€€€€€€Ä¼Ìƒ\€È¼Ì€ô€È¼äƒ–>¿¢š[¦®c–ê›(€€€€€€€€¨¼(€€€€€€€½¹ÍĞÍÑ…•!•¥¡Ğô(€€€€€€€€€€€5…Ñ ¹µ…à (€€€€€€€€€€€€€€€€ÄàÀ°(€€€€€€€€€€€€€€€5…Ñ ¹µ¥¸ (€€€€€€€€€€€€€€€€€€€€ÌÀÀ°(€€€€€€€€€€€€€€€€€€€5…Ñ ¹É½Õ¹ (€€€€€€€€€€€€€€€€€€€€€€€5…Ñ ¹µ…à (€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÄàÀ°(€€€€€€€€€€€€€€€€€€€€€€€€€€€É½½Ğ¹±¥•¹Ñ!•¥¡Ğ(€€€€€€€€€€€€€€€€€€€€€€€€¤¨(€€€€€€€€€€€€€€€€€€€€€€€€È¼ä(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€¤ì((€€€€€€€¥¹Ù•¹Ñ½Éä¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä (€€€€€€€€€€€€ˆ´µ¥¹Ù•¹Ñ½ÉäµÍÑ…”µ¡•¥¡Ğˆ°(€€€€€€€€€€€ÍÑ…•!•¥¡Ğ¬‰Áàˆ(€€€€€€€€¤ì(€€€ô)ô()™Õ¹Ñ¥½¸Í¡•‘Õ±” ¥ì(€€€¥˜¡É…™%¥ì(€€€€€€€…¹•±¹¥µ…Ñ¥½¹É…µ” (€€€€€€€€€€€É…™%(€€€€€€€€¤ì(€€€ô((€€€É…™%ô(€€€€€€€É•ÅÕ•ÍÑ¹¥µ…Ñ¥½¹É…µ” (€€€€€€€€€€€™Õ¹Ñ¥½¸ ¥ì(€€€€€€€€€€€€€€€É…™%ôÀì(€€€€€€€€€€€€€€€…ÁÁ±å9½Ü ¤ì(€€€€€€€€€€€ô(€€€€€€€€¤ì)ô((¼¨1…Ñ”™•…ÑÕÉ”ÉÕ¹Ñ¥µ•Ì…É”ÁÉ½‘ÕÑ¥½¸‰Õ¹‘±•Ì½İ¹•‰ä½ÕÉMåµ‰½±Í•…ÑÕÉ•Ì¸€¨¼()¥˜ (€€€‘½Õµ•¹Ğ¹É•…‘åMÑ…Ñ”ôôô(€€€€‰±½…‘¥¹œˆ(¥ì(€€€‘½Õµ•¹Ğ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È (€€€€€€€€‰=5½¹Ñ•¹Ñ1½…‘•ˆ°(€€€€€€€™Õ¹Ñ¥½¸ ¥ì(€€€€€€€€€€€Í¡•‘Õ±” ¤ì(€€€€€€€ô°(€€€€€€€í½¹”éÑÉÕ•ô(€€€€¤ì)ô)•±Í•ì(€€€Í¡•‘Õ±” ¤ì)ô()½¹ÍĞ½‰Í•ÉÙ•Èô(€€€¹•Ü5ÕÑ…Ñ¥½¹=‰Í•ÉÙ•È (€€€€€€€Í¡•‘Õ±”(€€€€¤ì()½‰Í•ÉÙ•È¹½‰Í•ÉÙ” (€€€‘½Õµ•¹Ğ¹‰½‘ä°(€€€ì(€€€€€€€¡¥±‘1¥ÍĞéÑÉÕ”°(€€€€€€€ÍÕ‰ÑÉ•”éÑÉÕ”°(€€€€€€€…ÑÑÉ¥‰ÕÑ•ÌéÑÉÕ”°(€€€€€€€…ÑÑÉ¥‰ÕÑ•¥±Ñ•Èél‰±…ÍÌ‰t(€€€ô(¤ì()‘½Õµ•¹Ğ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È (€€€€‰±¥¬ˆ°(€€€Í¡•‘Õ±”°(€€€íÁ…ÍÍ¥Ù”éÑÉÕ•ô(¤ì()İ¥¹‘½Ü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È (€€€€‰É•Í¥é”ˆ°(€€€Í¡•‘Õ±”°(€€€íÁ…ÍÍ¥Ù”éÑÉÕ•ô(¤ì()İ¥¹‘½Ü¹ØÜáÁÁ±å¡…É…Ñ•É%¹Ù•¹Ñ½Éå1…å½ÕĞô(€€€Í¡•‘Õ±”ì)ô¤ ¤ì(((¼¨‰Õ¹‘±•Í½ÕÉ”è©Ì¼ÈÌµØÄÈÔµ¡…É…Ñ•ÈµÉ•…Ñ¥½¸µ‰½½ÑÍÑÉ…À¹©Ì€¨¼(¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€XÄÜĞƒŠPAIµA%9P!IQHIQ%=8	==QMQI@€¬MYUI(€€Q¡”É•…Ñ¥½¸Á…”ÍÑ…ÉÑÌ¥¹Í¥‘”€…ÁÀ™½È±•…ä!Q50½µÁ…Ñ¥‰¥±¥Ñä¸((€€%5A=IQ9Pè(€€€´Q¡¥Ì‰½½ÑÍÑÉ…À½¹±äÁÉ•Á…É•ÌÑ¡”=4±½…Ñ¥½¸¸%Ğ¹•Ù•È‘•¥‘•ÌÑ¡…Ğ(€€€€¡…É…Ñ•ÈÉ•…Ñ¥½¸¥Ì…Ñ¥Ù”‰•™½É”Á•ÉÍ¥ÍÑ•‘…Ñ„¡…Ì‰••¸É•ÍÑ½É•¸(€€€´™…¥°µ±½Í•ÁÉ¥µ…Éäµ¡…É…Ñ•ÈÕ…ÉÁÉ•Ù•¹ÑÌ…¸…¥‘•¹Ñ…°É•…Ñ¥½¸(€€€€ÍÉ••¸…™Ñ•ÈÉ•±½…™É½´½Ù•ÉİÉ¥Ñ¥¹œ…¸•á¥ÍÑ¥¹œÍ…Ù•Í±½Ğ´Ä¡…É…Ñ•È¸(ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼(¡™Õ¹Ñ¥½¸‰½½ÑÍÑÉ…Á9…Ñ¥Ù•É•…Ñ¥½¹A…” ¥ì(€€€€‰ÕÍ”ÍÑÉ¥Ğˆì((€€€½¹ÍĞÁ…”õ‘½Õµ•¹Ğ¹•Ñ±•µ•¹Ñ	å% ‰É•…Ñ¥½¹A…”ˆ¤ì(€€€½¹ÍĞ½Ù•É±…äõ‘½Õµ•¹Ğ¹•Ñ±•µ•¹Ñ	å% ‰…µ”µ½Ù•É±…äµ±…å•Èˆ¤ì((€€€¥˜¡Á…”˜™½Ù•É±…ä˜™Á…”¹Á…É•¹Ñ±•µ•¹Ğ„ôõ½Ù•É±…ä¥ì(€€€€€€€½Ù•É±…ä¹…ÁÁ•¹‘¡¥±¡Á…”¤ì(€€€ô(€€€¥˜¡Á…”¥ì(€€€€€€€Á…”¹‘…Ñ…Í•Ğ¹¹…Ñ¥Ù•AÉ•Á…¥¹Ğô‰ØÄÜĞµ‘½´µ½¹±äˆì(€€€ô((€€€™Õ¹Ñ¥½¸±½…‘É¥Ñ¥…±U¥MÑå±” ¥ì(€€€€€€€€¼¨AÉ½‘ÕÑ¥½¸…ÁÀµÍ¡•±°ML½İ¹ÌÑ¡¥ÌÍÑå±”ì¹¼ÉÕ¹Ñ¥µ”ÍÑå±•Í¡••ĞÉ•ÅÕ•ÍĞ¸€¨¼(€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€ô((€€€™Õ¹Ñ¥½¸ÁÉ¥µ…ÉåMÑ…Ñ”¡ÍÑ…Ñ”±ÁÉ¥µ…Éä±É•…Í½¸¥ì(€€€€€€€É•ÑÕÉ¸íÍÑ…Ñ”±ÁÉ¥µ…ÉäéÁÉ¥µ…Éåññ¹Õ±°±É•…Í½¸éÉ•…Í½¹ñğˆ‰ôì(€€€ô((€€€™Õ¹Ñ¥½¸É•…‘A•ÉÍ¥ÍÑ•‘AÉ¥µ…Éå¡…É…Ñ•È ¥ì(€€€€€€€±•ĞÉ…Üôˆˆì(€€€€€€€ÑÉåì(€€€€€€€€€€€½¹ÍĞÉ•Á½Í¥Ñ½Éäõİ¥¹‘½Ü¹½ÕÉMåµ‰½±Í½Õ¹ÑM…Ù”ì(€€€€€€€€€€€½¹ÍĞ…Ñ¥Ù”õÉ•Á½Í¥Ñ½Éä˜™É•Á½Í¥Ñ½Éä¹É•…‘Ñ¥Ù” ¤ì(€€€€€€€€€€€¥˜ ……Ñ¥Ù•ññ…Ñ¥Ù”¹ÍÑ…ÑÕÌôôô‰¥¹…Ñ¥Ù”ˆ¥ìÉ•ÑÕÉ¸ÁÉ¥µ…ÉåMÑ…Ñ” ‰Õ¹Í…™”ˆ±¹Õ±°°‰…½Õ¹ĞµÕ¹É•Í½±Ù•ˆ¤ìô(€€€€€€€€€€€¥˜¡…Ñ¥Ù”¹ÍÑ…ÑÕÌôôô‰•µÁÑäˆ¥ìÉ•ÑÕÉ¸ÁÉ¥µ…ÉåMÑ…Ñ” ‰•µÁÑäˆ±¹Õ±°°‰¹¼µ…½Õ¹ĞµÍ…Ù”ˆ¤ìô(€€€€€€€€€€€É…Üõ)M=8¹ÍÑÉ¥¹¥™ä¡…Ñ¥Ù”¹Í…Ù”¤ì(€€€€€€€õ…Ñ ¡|¥ì(€€€€€€€€€€€€¼¨MÑ½É…”‰•¥¹œÕ¹É•…‘…‰±”µÕÍĞ¹•Ù•ÈÑÕÉ¸¥¹Ñ¼Á•Éµ¥ÍÍ¥½¸Ñ¼(€€€€€€€€€€€€€€½Ù•ÉİÉ¥Ñ”¡…É…Ñ•È‘…Ñ„¸Q¡¥Ì¥Ì¥¹Ñ•¹Ñ¥½¹…±±ä™…¥°µ±½Í•¸€¨¼(€€€€€€€€€€€É•ÑÕÉ¸ÁÉ¥µ…ÉåMÑ…Ñ” ‰Õ¹Í…™”ˆ±¹Õ±°°‰ÍÑ½É…”µÕ¹É•…‘…‰±”ˆ¤ì(€€€€€€€ô((€€€€€€€¥˜ …É…Ü¥ì(€€€€€€€€€€€É•ÑÕÉ¸ÁÉ¥µ…ÉåMÑ…Ñ” ‰•µÁÑäˆ±¹Õ±°°‰¹¼µÍ…Ù”ˆ¤ì(€€€€€€€ô((€€€€€€€±•ĞÍ…Ù•õ¹Õ±°ì(€€€€€€€ÑÉåì(€€€€€€€€€€€Í…Ù•õ)M=8¹Á…ÉÍ”¡É…Ü¤ì(€€€€€€€õ…Ñ ¡|¥ì(€€€€€€€€€€€É•ÑÕÉ¸ÁÉ¥µ…ÉåMÑ…Ñ” ‰Õ¹Í…™”ˆ±¹Õ±°°‰Í…Ù”µ©Í½¸µ¥¹Ù…±¥ˆ¤ì(€€€€€€€ô((€€€€€€€¥˜ …Í…Ù•‘ññÑåÁ•½˜Í…Ù•„ôô‰½‰©•Ğ‰ññÉÉ…ä¹¥ÍÉÉ…ä¡Í…Ù•¤¥ì(€€€€€€€€€€€É•ÑÕÉ¸ÁÉ¥µ…ÉåMÑ…Ñ” ‰Õ¹Í…™”ˆ±¹Õ±°°‰Í…Ù”µÍ¡…Á”µ¥¹Ù…±¥ˆ¤ì(€€€€€€€ô((€€€€€€€½¹ÍĞÁÉ¥µ…ÉäõÍ…Ù•¹Á±…å•Èì(€€€€€€€¥˜¡ÁÉ¥µ…ÉäôôõÕ¹‘•™¥¹•‘ññÁÉ¥µ…Éäôôõ¹Õ±°¥ì(€€€€€€€€€€€€¼¨¸•µÁÑä½‰©•Ğ¥Ì„Ù…±¥ÁÉ”µ¡…É…Ñ•ÈÍÑ…Ñ”¥¸¡¥ÍÑ½É¥…°(€€€€€€€€€€€€€€ÍÑ…ÉÑÕÀ½Ñ•ÍĞ™±½İÌ¸€¨¼(€€€€€€€€€€€É•ÑÕÉ¸ÁÉ¥µ…ÉåMÑ…Ñ” ‰•µÁÑäˆ±¹Õ±°°‰¹¼µÁÉ¥µ…Éäˆ¤ì(€€€€€€€ô(€€€€€€€¥˜¡ÑåÁ•½˜ÁÉ¥µ…Éä„ôô‰½‰©•Ğ‰ññÉÉ…ä¹¥ÍÉÉ…ä¡ÁÉ¥µ…Éä¤¥ì(€€€€€€€€€€€É•ÑÕÉ¸ÁÉ¥µ…ÉåMÑ…Ñ” ‰Õ¹Í…™”ˆ±¹Õ±°°‰ÁÉ¥µ…ÉäµÍ¡…Á”µ¥¹Ù…±¥ˆ¤ì(€€€€€€€ô((€€€€€€€€¼¨¡…É…Ñ•È%¥ÌÑ¡”…¹½¹¥…°É•…Ñ¥½¸¥‘•¹Ñ¥Ñä¸=¹”¥Ğ•á¥ÍÑÌ°(€€€€€€€€€€Í±½Ğ€Ä¥Ì½ÕÁ¥•É•…É‘±•ÍÌ½˜İ¡•Ñ¡•È…¹½Ñ¡•È™¥•±€¡™½È•á…µÁ±”(€€€€€€€€€€±•Ù•°¤¡…Ì‰•½µ”µ…±™½Éµ•¸9•Ù•ÈÉ•ÅÕ¥É”±•Ù•°Ñ¼‰”¡•…±Ñ¡ä¥¸(€€€€€€€€€€½É‘•ÈÑ¼ÁÉ½Ñ•Ğ…¸•á¥ÍÑ¥¹œ¡…É…Ñ•È¸€¨¼(€€€€€€€½¹ÍĞ¥õMÑÉ¥¹œ¡ÁÉ¥µ…Éä¹¥‘ñğˆˆ¤¹ÑÉ¥´ ¤ì(€€€€€€€¥˜¡¥¥ì(€€€€€€€€€€€É•ÑÕÉ¸ÁÉ¥µ…ÉåMÑ…Ñ” ‰½ÕÁ¥•ˆ±ÁÉ¥µ…Éä°‰ÁÉ¥µ…Éäµ¥µÁÉ•Í•¹Ğˆ¤ì(€€€€€€€ô((€€€€€€€€¼¨Q¡”…¹½¹¥…°Õ¹É•…Ñ•Ñ•µÁ±…Ñ”¥Ì¥èˆˆ°±•Ù•°èÄ°•áÀèÀ¸(€€€€€€€€€€%˜¥‘•¹Ñ¥Ñä¥Ìµ¥ÍÍ¥¹œ‰ÕĞÁÉ½É•ÍÌ½Í•½¹‘…Éäµ¡…É…Ñ•È•Ù¥‘•¹”¥Ì(€€€€€€€€€€ÁÉ•Í•¹Ğ°ÑÉ•…ĞÑ¡”Í…Ù”…ÌÕ¹Í…™”¥¹ÍÑ•…½˜…ÍÍÕµ¥¹œÑ¡”Í±½Ğ¥Ì(€€€€€€€€€€™É•”¸Q¡¥ÌÁÉ•Ù•¹ÑÌ„Á…ÉÑ¥…±±ä‘…µ…•Í…Ù”™É½´‰•¥¹œ½Ù•ÉİÉ¥ÑÑ•¸¸€¨¼(€€€€€€€½¹ÍĞ±•Ù•°õ9Õµ‰•È¡ÁÉ¥µ…Éä¹±•Ù•°¤ì(€€€€€€€½¹ÍĞ•áÀõ9Õµ‰•È¡ÁÉ¥µ…Éä¹•áÀ¤ì(€€€€€€€½¹ÍĞÁÉ½É•ÍÍ•ô¡9Õµ‰•È¹¥Í¥¹¥Ñ”¡±•Ù•°¤˜™±•Ù•°øÄ¥ñğ¡9Õµ‰•È¹¥Í¥¹¥Ñ”¡•áÀ¤˜™•áÀøÀ¤ì(€€€€€€€½¹ÍĞ¡…ÍM•½¹‘…Éäô„„ (€€€€€€€€€€€Í…Ù•¹Á±…å•ÈÈ˜™ÑåÁ•½˜Í…Ù•¹Á±…å•ÈÈôôô‰½‰©•Ğˆ˜™MÑÉ¥¹œ¡Í…Ù•¹Á±…å•ÈÈ¹¥‘ñğˆˆ¤¹ÑÉ¥´ ¤(€€€€€€€€¥ñğ„„ (€€€€€€€€€€€Í…Ù•¹Á±…å•ÈÌ˜™ÑåÁ•½˜Í…Ù•¹Á±…å•ÈÌôôô‰½‰©•Ğˆ˜™MÑÉ¥¹œ¡Í…Ù•¹Á±…å•ÈÌ¹¥‘ñğˆˆ¤¹ÑÉ¥´ ¤(€€€€€€€€¤ì((€€€€€€€¥˜¡ÁÉ½É•ÍÍ•‘ññ¡…ÍM•½¹‘…Éä¥ì(€€€€€€€€€€€É•ÑÕÉ¸ÁÉ¥µ…ÉåMÑ…Ñ” ‰Õ¹Í…™”ˆ±ÁÉ¥µ…Éä°‰ÁÉ¥µ…Éäµ¥‘•¹Ñ¥Ñäµµ¥ÍÍ¥¹œˆ¤ì(€€€€€€€ô((€€€€€€€É•ÑÕÉ¸ÁÉ¥µ…ÉåMÑ…Ñ” ‰•µÁÑäˆ±ÁÉ¥µ…Éä°‰‰±…¹¬µÁÉ¥µ…ÉäµÑ•µÁ±…Ñ”ˆ¤ì(€€€ô((€€€™Õ¹Ñ¥½¸Í¡½İAÉ¥µ…ÉåAÉ½Ñ•Ñ¥½¸¡ÍÑ…Ñ”¥ì(€€€€€€€½¹ÍĞÁÉ¥µ…ÉäõÍÑ…Ñ”˜™ÍÑ…Ñ”¹ÁÉ¥µ…Éäì(€€€€€€€½¹ÍĞ¥õMÑÉ¥¹œ¡ÁÉ¥µ…Éä˜™ÁÉ¥µ…Éä¹¥‘ñğˆˆ¤¹ÑÉ¥´ ¤ì(€€€€€€€½¹ÍĞ±•Ù•°õ9Õµ‰•È¡ÁÉ¥µ…Éä˜™ÁÉ¥µ…Éä¹±•Ù•°¤ì(€€€€€€€½¹ÍĞ½ÕÁ¥•õÍÑ…Ñ”˜™ÍÑ…Ñ”¹ÍÑ…Ñ”ôôô‰½ÕÁ¥•ˆì(€€€€€€€½¹ÍĞµ•ÍÍ…”õ½ÕÁ¥•(€€€€€€€€€€€€ü ‹–×šâ³–"Ãš^‹šr'’âï¢K¢&Ë–¶cšªS0ˆ­¥¬‹4ˆ¬(€€€€€€€€€€€€€€€€¡9Õµ‰•È¹¥Í¥¹¥Ñ”¡±•Ù•°¤˜™±•Ù•°øôÄü‰1Ø¸ˆ­5…Ñ ¹™±½½È¡±•Ù•°¤èˆˆ¤¬‹
ë¦ÿ–7¢š–¾¯–:¢K¢&Ë¾ò3šr³š²‡–&×–îë–ŞË–>[šÚ#¾òo¢®/¦7šZÃšVÓB–ú3æóê3¦+š"Ëˆ¤(€€€€€€€€€€€€è‹–×šâ³–"Ã¢K¢&Ë–¶cšªS¢º–>[VÃ–âãš"[š^‹šr'¢K¢&Ë^W¢Ş‡
ë¦ÿ–7’îï’öW¢K¢&Ë¢ÎšZg¢Š¯¢š–¾¯¾ò3šr³š²‡–&×–îë–ŞË–>[šÚ#¾òo¢®/–#¦7šZÃšVÓB¾ò3¢.—’î7–ë>ûš¶“¢¢+š¿¢®/’şwVg–¶cšªS’â›–sš¶‹–îë®/¢K¢&Ëˆì(€€€€€€€¥˜¡ÑåÁ•½˜İ¥¹‘½Ü¹ÉÁ±•ÉĞôôô‰™Õ¹Ñ¥½¸ˆ¥ì(€€€€€€€€€€€Ù½¥İ¥¹‘½Ü¹ÉÁ±•ÉĞ¡µ•ÍÍ…”±íÑ¥Ñ±”è‹¢K¢&Ë–¶cšªS’şw¢¶Üˆ±½¹™¥ÉµQ•áĞè‹~—¦O’êˆ±‘…¹•ÈéÑÉÕ•ô¤ì(€€€€€€€õ•±Í”¥˜¡ÑåÁ•½˜İ¥¹‘½Ü¹…±•ÉĞôôô‰™Õ¹Ñ¥½¸ˆ¥ì(€€€€€€€€€€€İ¥¹‘½Ü¹…±•ÉĞ¡µ•ÍÍ…”¤ì(€€€€€€€ô(€€€ô((€€€™Õ¹Ñ¥½¸¥¹ÍÑ…±±AÉ¥µ…ÉåÉ•…Ñ¥½¹M…Ù•Õ…É ¥ì(€€€€€€€½¹ÍĞÕÉÉ•¹Ğõİ¥¹‘½Ü¹É•…Ñ•¡…É…Ñ•Èì(€€€€€€€¥˜¡ÑåÁ•½˜ÕÉÉ•¹Ğ„ôô‰™Õ¹Ñ¥½¸‰ññÕÉÉ•¹Ğ¹}}ØÄÜÑA•ÉÍ¥ÍÑ•‘AÉ¥µ…ÉåÕ…ÉôôõÑÉÕ”¥ì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€ô((€€€€€€€™Õ¹Ñ¥½¸Õ…É‘•‘É•…Ñ•¡…É…Ñ•È ¥ì(€€€€€€€€€€€±•ĞÑ…É•ÑM±½ĞôÄì(€€€€€€€€€€€ÑÉåì(€€€€€€€€€€€€€€€¥˜¡ÑåÁ•½˜É•…Ñ¥½¹Q…É•ÑM±½Ğ„ôô‰Õ¹‘•™¥¹•ˆ¥ì(€€€€€€€€€€€€€€€€€€€Ñ…É•ÑM±½Ğõ5…Ñ ¹µ…à Ä±5…Ñ ¹™±½½È¡9Õµ‰•È¡É•…Ñ¥½¹Q…É•ÑM±½Ğ¥ñğÄ¤¤ì(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€õ…Ñ ¡|¥ìô((€€€€€€€€€€€½¹ÍĞÁ•ÉÍ¥ÍÑ•õÉ•…‘A•ÉÍ¥ÍÑ•‘AÉ¥µ…Éå¡…É…Ñ•È ¤ì((€€€€€€€€€€€€¼¨¸Õ¹É•…‘…‰±”½½ÉÉÕÁĞ…¹½¹¥…°Í…Ù”‰±½­Ì•Ù•Éä¡…É…Ñ•È(€€€€€€€€€€€€€€É•…Ñ¥½¸Á…Ñ °‰•…ÕÍ”É•…Ñ•‘‘¥Ñ¥½¹…±¡…É…Ñ•È•Ù•¹ÑÕ…±±ä(€€€€€€€€€€€€€€Í…Ù•ÌÑ¡É½Õ Ñ¡”Í…µ”…¹½¹¥…°­•ä¸¡•…±Ñ¡ä½ÕÁ¥•ÁÉ¥µ…Éä(€€€€€€€€€€€€€€‰±½­Ì½¹±äÍ±½Ğ€ÄìÍ±½Ğ€È¼ÌÉ•µ…¥¸±•¥Ñ¥µ…Ñ”…‘‘¥Ñ¥½¹Ì¸€¨¼(€€€€€€€€€€€¥˜ (€€€€€€€€€€€€€€€Á•ÉÍ¥ÍÑ•¹ÍÑ…Ñ”ôôô‰Õ¹Í…™”‰ñğ(€€€€€€€€€€€€€€€€¡Ñ…É•ÑM±½ĞôôôÄ˜™Á•ÉÍ¥ÍÑ•¹ÍÑ…Ñ”ôôô‰½ÕÁ¥•ˆ¤(€€€€€€€€€€€€¥ì(€€€€€€€€€€€€€€€Í¡½İAÉ¥µ…ÉåAÉ½Ñ•Ñ¥½¸¡Á•ÉÍ¥ÍÑ•¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€ô((€€€€€€€€€€€É•ÑÕÉ¸ÕÉÉ•¹Ğ¹…ÁÁ±ä¡Ñ¡¥Ì±…ÉÕµ•¹ÑÌ¤ì(€€€€€€€ô((€€€€€€€Õ…É‘•‘É•…Ñ•¡…É…Ñ•È¹}}ØÄÜÑA•ÉÍ¥ÍÑ•‘AÉ¥µ…ÉåÕ…ÉõÑÉÕ”ì(€€€€€€€Õ…É‘•‘É•…Ñ•¡…É…Ñ•È¹}}ØÄÜÑ=É¥¥¹…±É•…Ñ•¡…É…Ñ•ÈõÕÉÉ•¹Ğì(€€€€€€€İ¥¹‘½Ü¹É•…Ñ•¡…É…Ñ•ÈõÕ…É‘•‘É•…Ñ•¡…É…Ñ•Èì(€€€ô((€€€™Õ¹Ñ¥½¸™¥¹…±¥é•	½½ÑÍÑÉ…À ¥ì(€€€€€€€¥¹ÍÑ…±±AÉ¥µ…ÉåÉ•…Ñ¥½¹M…Ù•Õ…É ¤ì(€€€ô((€€€±½…‘É¥Ñ¥…±U¥MÑå±” ¤ì((€€€¥˜¡‘½Õµ•¹Ğ¹É•…‘åMÑ…Ñ”ôôô‰±½…‘¥¹œˆ¥ì(€€€€€€€‘½Õµ•¹Ğ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰=5½¹Ñ•¹Ñ1½…‘•ˆ±™¥¹…±¥é•	½½ÑÍÑÉ…À±í½¹”éÑÉÕ•ô¤ì(€€€õ•±Í•ì(€€€€€€€™¥¹…±¥é•	½½ÑÍÑÉ…À ¤ì(€€€ô)ô¤ ¤ì(((¼¨‰Õ¹‘±•Í½ÕÉ”è©Ì¼ÈĞµØÄÈÔµ¡…É…Ñ•ÈµÉ•…Ñ¥½¸µ¹…Ñ¥Ù”µÉÕ¹Ñ¥µ”¹©Ì€¨¼(¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€XÄÈàƒŠP%aQ]<µMQ@€ÄÀàÀƒ\€ÄäÈÀ!IQHIQ%=8IU9Q%5(€€€´UÍ•ÌÑ¡”XÄÈàÁÉ”µÁ…¥¹Ğ¹…Ñ¥Ù”‰½½ÑÍÑÉ…ÀìÉ•Á…É•¹Ñ¥¹œ¥Ì½¹±ä„™…±±‰…¬(€€€´UÍ•ÌÉ•…°¹…Ñ¥Ù”½µÁ½¹•¹Ğ‘¥µ•¹Í¥½¹Ì°¹•Ù•Èµ¥É…Ñ¥½¸Í…±”(€€€´•¹‘•È€¼Á½ÉÑÉ…¥ĞÍİ¥Ñ¡¥¹œ(€€€´±•µ•¹ĞÁ½Í¥Ñ¥½¹¥¹œİ¥Ñ ±…É•È•±•µ•¹Ğ‘•ÍÉ¥ÁÑ¥½¹Ì(€€€´¥á•¹‘É½¥¡É½µ”…¹Ù…Ìİ¥Ñ ¹¼Á…”ÍÉ½±°½ÈÁ¥¹ é½½´(€€€´Qİ¼µÍÑ•ÀÉ•…Ñ¥½¸™±½Üì…‰¥±¥Ñä…±±½…Ñ¥½¸±¥Ù•Ì½¸Á…”Ñİ¼(€€á¥ÍÑ¥¹œ½µ‰…Ğ½ÍÑ…Ğ½Í­¥±°™½ÉµÕ±…Ì…É”¹½Ğ¡…¹•¸(ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼(¡™Õ¹Ñ¥½¸ ¥ì(€€€€‰ÕÍ”ÍÑÉ¥Ğˆì((€€€½¹ÍĞA=IQI%QLõì(€€€€€€€™•µ…±”éì(€€€€€€€€€€€™¥É”è‰…ÍÍ•ÑÌ½¡…É…Ñ•ÉÌ½™•µ…±•}™¥É”¹©Áœˆ°(€€€€€€€€€€€İ…Ñ•Èè‰…ÍÍ•ÑÌ½¡…É…Ñ•ÉÌ½™•µ…±•}İ…Ñ•È¹©Áœˆ°(€€€€€€€€€€€İ¥¹è‰…ÍÍ•ÑÌ½¡…É…Ñ•ÉÌ½™•µ…±•}İ¥¹¹©Áœˆ°(€€€€€€€€€€€•…ÉÑ è‰…ÍÍ•ÑÌ½¡…É…Ñ•ÉÌ½™•µ…±•}•…ÉÑ ¹©Áœˆ(€€€€€€€ô°(€€€€€€€µ…±”éì(€€€€€€€€€€€™¥É”è‰…ÍÍ•ÑÌ½¡…É…Ñ•ÉÌ½µ…±•}™¥É”¹©Áœˆ°(€€€€€€€€€€€İ…Ñ•Èè‰…ÍÍ•ÑÌ½¡…É…Ñ•ÉÌ½µ…±•}İ…Ñ•È¹©Áœˆ°(€€€€€€€€€€€İ¥¹è‰…ÍÍ•ÑÌ½¡…É…Ñ•ÉÌ½µ…±•}İ¥¹¹©Áœˆ°(€€€€€€€€€€€•…ÉÑ è‰…ÍÍ•ÑÌ½¡…É…Ñ•ÉÌ½µ…±•}•…ÉÑ ¹©Áœˆ(€€€€€€€ô(€€€ôì((€€€½¹ÍĞ5Qõì(€€€€€€€™¥É”éì(€€€€€€€€€€€±åÁ è‹¬ˆ°(€€€€€€€€€€€Ñ¥Ñ±”è‹#Ã’æ/¦Lˆ°(€€€€€€€€€€€É½±”è‹"fó¢òã–èƒ
Üƒ"šN(ƒ
ÜƒHˆ°(€€€€€€€€€€€‘•ÍÉ¥ÁÑ¥½¸è‹’î—¦®c"fó"šN+¢"Kš2ê3–
ß–ºÏ–O–"ÛšV×’êë¾ò3&§B¢"šÎW¢†O–§šŠw¢Ş¿Şk¦÷–?–BG’âï–.W¦ËšRïˆ°(€€€€€€€€€€€Ñ…Ìél‹¦®c"fğˆ°‹"šN+–òß–2Xˆ°‹K–
ß–ºÌ‰t(€€€€€€€ô°(€€€€€€€İ…Ñ•Èéì(€€€€€€€€€€€±åÁ è‹šÂĞˆ°(€€€€€€€€€€€Ñ¥Ñ±”è‹–¾KšÂÓ’æ/¦Lˆ°(€€€€€€€€€€€É½±”è‹–Bã–>[–n{–ú¤ƒ
Üƒ–Ã–Âƒ
ÜƒšÊïf–ú§šÒìˆ°(€€€€€€€€€€€‘•ÍÉ¥ÁÑ¥½¸è‹–ó–ßê3¢"«š:Ÿ–‚Ó¢"¦j+’ò7–n{–ú§¾òošRïšN+š*¢÷–>¿–Bã–>Y!C¢"MC¾ò3’â›šNšr'–Ã–ÂšÊïf¢"–ú§šÒï¢÷–*oˆ°(€€€€€€€€€€€Ñ…Ìél‰!@½MC–Bã–>Xˆ°‹–Ã–Âš:Ÿ–‚Ğˆ°‹šÊïf–ú§šÒì‰t(€€€€€€€ô°(€€€€€€€İ¥¹éì(€€€€€€€€€€€±åÁ è‹¦Š ˆ°(€€€€€€€€€€€Ñ¥Ñ±”è‹Zû¦Š£’æ/¦Lˆ°(€€€€€€€€€€€É½±”è‹¦–ê›–æËšNøƒ
Üƒ–
ß–ºÏ–&+–òÄƒ
Üƒ¦Z¦ÿš:Ÿ–‚Ğˆ°(€€€€€€€€€€€‘•ÍÉ¥ÁÑ¥½¸è‹¦?¦;šV?š6ß¦Z¦ÿ¢"–B–ò?–æËšNûš:3š>‡š"Ã¦²—¾––?¾ò3–>¿¦f7’ö;šV×šZç¢÷–*o–
ß–ºÏ¢"–F÷’â·’â›šZ÷–*ƒšj#r§ˆ°(€€€€€€€€€€€Ñ…Ìél‹šV?š6ß–æËšNøˆ°‹¦Z¦ÿ–òß–2Xˆ°‹šj#r§¾ò?¦f7–
Ü‰t(€€€€€€€ô°(€€€€€€€•…ÉÑ éì(€€€€€€€€€€€±åÁ è‹–r|ˆ°(€€€€€€€€€€€Ñ¥Ñ±”è‹–:k–r’æ/¦Lˆ°(€€€€€€€€€€€É½±”è‹¢¶ßnû¦bËš˜ƒ
Üƒ¦f7¦bÈƒ
Üƒ~Ï–2[–>7–
Üˆ°(€€€€€€€€€€€‘•ÍÉ¥ÁÑ¥½¸è‹¦7¢š[R–¶c¢"¦j+’ò7¦bË¢¶ß¾ò3¢÷–îë®/¢¶ßnû–>7–
ß¢"ÖCV3¾ò3–B3šf’î—¦f7¦bË¢"~Ï–2[š:Ÿ–"ÛšV×šZçˆ°(€€€€€€€€€€€Ñ…Ìél‹¢¶ßnû¦bË¢¶Üˆ°‹¦f7¦bË~Ï–2Xˆ°‹–>7–
ßÖCV0‰t(€€€€€€€ô(€€€ôì((€€€±•ĞÍ•±•Ñ•‘•¹‘•Èô‰™•µ…±”ˆì(€€€±•ĞÍ•±•Ñ•‘É•…Ñ¥½¹MÑ•ÀôÄì((€€€™Õ¹Ñ¥½¸‰å%¡¥¥ì(€€€€€€€É•ÑÕÉ¸‘½Õµ•¹Ğ¹•Ñ±•µ•¹Ñ	å%¡¥¤ì(€€€ô((€€€™Õ¹Ñ¥½¸µ¥É…Ñ•É•…Ñ¥½¹A…•Q½9…Ñ¥Ù•1…å•È ¥ì(€€€€€€€½¹ÍĞÁ…”õ‰å% ‰É•…Ñ¥½¹A…”ˆ¤ì(€€€€€€€½¹ÍĞ½Ù•É±…äõ‰å% ‰…µ”µ½Ù•É±…äµ±…å•Èˆ¤ì(€€€€€€€¥˜ …Á…”ñğ€…½Ù•É±…ä¥íÉ•ÑÕÉ¸¹Õ±°íô((€€€€€€€¥˜¡Á…”¹Á…É•¹Ñ±•µ•¹Ğ„ôõ½Ù•É±…ä¥ì(€€€€€€€€€€€½Ù•É±…ä¹…ÁÁ•¹‘¡¥±¡Á…”¤ì(€€€€€€€ô((€€€€€€€Á…”¹±…ÍÍ1¥ÍĞ¹…‘ ‰¹…Ñ¥Ù”µÉ•…Ñ¥½¸µÁ…”ˆ°‰…µ”µ¹…Ñ¥Ù”µÕ¤ˆ¤ì(€€€€€€€Á…”¹‘…Ñ…Í•Ğ¹¹…Ñ¥Ù•]¥‘Ñ ôˆÄÀàÀˆì(€€€€€€€Á…”¹‘…Ñ…Í•Ğ¹¹…Ñ¥Ù•!•¥¡ĞôˆÄäÈÀˆì(€€€€€€€Á…”¹‘…Ñ…Í•Ğ¹¹…Ñ¥Ù•5¥É…Ñ¥½¸ô‰…ÑÕ…°µ‘¥µ•¹Í¥½¹Ìˆì((€€€€€€€l(€€€€€€€€€€€€‰±•™Ğˆ°‰Ñ½Àˆ°‰É¥¡Ğˆ°‰‰½ÑÑ½´ˆ°‰İ¥‘Ñ ˆ°‰¡•¥¡Ğˆ°(€€€€€€€€€€€€‰µ¥¸µİ¥‘Ñ ˆ°‰µ¥¸µ¡•¥¡Ğˆ°‰µ…àµİ¥‘Ñ ˆ°‰µ…àµ¡•¥¡Ğˆ°(€€€€€€€€€€€€‰µ…É¥¸ˆ°‰ÑÉ…¹Í™½É´ˆ°‰ÑÉ…¹Í™½É´µ½É¥¥¸ˆ(€€€€€€€t¹™½É… ¡™Õ¹Ñ¥½¸¡ÁÉ½Á•ÉÑä¥ì(€€€€€€€€€€€Á…”¹ÍÑå±”¹É•µ½Ù•AÉ½Á•ÉÑä¡ÁÉ½Á•ÉÑä¤ì(€€€€€€€ô¤ì((€€€€€€€€¼¨Q¡¥Ì±…å•È½¹Ñ…¥¹Ì¥¹Ñ•É…Ñ¥Ù”¹…Ñ¥Ù”U$°Í¼¥Ğ…¹¹½ĞÍÑ…ä(€€€€€€€€€€¡¥‘‘•¸™É½´…•ÍÍ¥‰¥±¥ÑäA%Ì¸A½¥¹Ñ•È½İ¹•ÉÍ¡¥ÀÉ•µ…¥¹Ì½¸(€€€€€€€€€€€É•…Ñ¥½¹A…”ìÑ¡”½Ù•É±…ä¥ÑÍ•±˜ÍÑ¥±°ÕÍ•ÌÁ½¥¹Ñ•Èµ•Ù•¹ÑÌé¹½¹”¸€¨¼(€€€€€€€½Ù•É±…ä¹É•µ½Ù•ÑÑÉ¥‰ÕÑ” ‰…É¥„µ¡¥‘‘•¸ˆ¤ì(€€€€€€€É•ÑÕÉ¸Á…”ì(€€€ô((€€€™Õ¹Ñ¥½¸Í•ÑÉ•…Ñ¥½¹Q½Õ¡5½‘”¡…Ñ¥Ù”¥ì(€€€€€€€½¹ÍĞ™¥á•‘9½‘•Ìõl(€€€€€€€€€€€‘½Õµ•¹Ğ¹‘½Õµ•¹Ñ±•µ•¹Ğ°(€€€€€€€€€€€‘½Õµ•¹Ğ¹‰½‘ä°(€€€€€€€€€€€‰å% ‰…µ”µÙ¥•İÁ½ÉĞˆ¤°(€€€€€€€€€€€‰å% ‰…µ”µÍÑ…”ˆ¤°(€€€€€€€€€€€‰å% ‰…µ”µ½Ù•É±…äµ±…å•Èˆ¤(€€€€€€€tì((€€€€€€€™¥á•‘9½‘•Ì¹™½É… ¡™Õ¹Ñ¥½¸¡¹½‘”¥ì(€€€€€€€€€€€¥˜¡¹½‘”¥ì(€€€€€€€€€€€€€€€¹½‘”¹±…ÍÍ1¥ÍĞ¹É•µ½Ù” ‰É•…Ñ¥½¸µÍÉ½±°µ…Ñ¥Ù”ˆ¤ì(€€€€€€€€€€€€€€€¹½‘”¹±…ÍÍ1¥ÍĞ¹Ñ½±” ‰É•…Ñ¥½¸µ™¥á•µ…Ñ¥Ù”ˆ°„……Ñ¥Ù”¤ì(€€€€€€€€€€€ô(€€€€€€€ô¤ì((€€€€€€€¥˜¡…Ñ¥Ù”¥ì(€€€€€€€€€€€™¥á•‘9½‘•Ì¹½¹…Ğ¡‰å% ‰É•…Ñ¥½¹A…”ˆ¤¤¹™½É… ¡™Õ¹Ñ¥½¸¡¹½‘”¥ì(€€€€€€€€€€€€€€€¥˜¡¹½‘”¥ì(€€€€€€€€€€€€€€€€€€€¹½‘”¹ÍÉ½±±Q½ÀôÀì(€€€€€€€€€€€€€€€€€€€¹½‘”¹ÍÉ½±±1•™ĞôÀì(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€ô¤ì(€€€€€€€ô((€€€€€€€½¹ÍĞÍÑ…”õ‰å% ‰…µ”µÍÑ…”ˆ¤ì(€€€€€€€½¹ÍĞ…ÁÀõ‰å% ‰…ÁÀˆ¤ì((€€€€€€€¥˜¡ÍÑ…”¥ì(€€€€€€€€€€€ÍÑ…”¹±…ÍÍ1¥ÍĞ¹Ñ½±” ‰É•…Ñ¥½¸µ¹…Ñ¥Ù”µ…Ñ¥Ù”ˆ°„……Ñ¥Ù”¤ì(€€€€€€€ô((€€€€€€€¥˜¡…ÁÀ¥ì(€€€€€€€€€€€…ÁÀ¹¥¹•ÉĞô„……Ñ¥Ù”ì(€€€€€€€€€€€¥˜¡…Ñ¥Ù”¥ì(€€€€€€€€€€€€€€€…ÁÀ¹Í•ÑÑÑÉ¥‰ÕÑ” ‰…É¥„µ¡¥‘‘•¸ˆ°‰ÑÉÕ”ˆ¤ì(€€€€€€€€€€€õ•±Í•ì(€€€€€€€€€€€€€€€…ÁÀ¹É•µ½Ù•ÑÑÉ¥‰ÕÑ” ‰…É¥„µ¡¥‘‘•¸ˆ¤ì(€€€€€€€€€€€ô(€€€€€€€ô((€€€€€€€¥˜¡…Ñ¥Ù”¥ì(€€€€€€€€€€€İ¥¹‘½Ü¹ÍÉ½±±Q¼ À°À¤ì(€€€€€€€ô(€€€ô((€€€™Õ¹Ñ¥½¸Íå¹É•…Ñ¥½¹Q½Õ¡5½‘” ¥ì(€€€€€€€½¹ÍĞÁ…”õµ¥É…Ñ•É•…Ñ¥½¹A…•Q½9…Ñ¥Ù•1…å•È ¤ì(€€€€€€€½¹ÍĞÙ¥Í¥‰±”ô„…Á…”€˜˜İ¥¹‘½Ü¹•Ñ½µÁÕÑ•‘MÑå±”¡Á…”¤¹‘¥ÍÁ±…ä„ôô‰¹½¹”ˆì(€€€€€€€Í•ÑÉ•…Ñ¥½¹Q½Õ¡5½‘”¡Ù¥Í¥‰±”¤ì(€€€ô((€€€™Õ¹Ñ¥½¸¥¹ÍÑ…±±É•…Ñ¥½¹•ÍÑÕÉ•1½¬ ¥ì(€€€€€€€½¹ÍĞÁ…”õ‰å% ‰É•…Ñ¥½¹A…”ˆ¤ì(€€€€€€€¥˜ …Á…”ñğÁ…”¹‘…Ñ…Í•Ğ¹•ÍÑÕÉ•1½­I•…‘äôôô‰ÑÉÕ”ˆ¥ì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€ô((€€€€€€€l‰Ñ½Õ¡µ½Ù”ˆ°‰İ¡••°ˆ°‰•ÍÑÕÉ•ÍÑ…ÉĞˆ°‰•ÍÑÕÉ•¡…¹”ˆ°‰•ÍÑÕÉ••¹‰t¹™½É… ¡™Õ¹Ñ¥½¸¡•Ù•¹Ñ9…µ”¥ì(€€€€€€€€€€€Á…”¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È¡•Ù•¹Ñ9…µ”±™Õ¹Ñ¥½¸¡•Ù•¹Ğ¥ì(€€€€€€€€€€€€€€€•Ù•¹Ğ¹ÁÉ•Ù•¹Ñ•™…Õ±Ğ ¤ì(€€€€€€€€€€€ô±íÁ…ÍÍ¥Ù”é™…±Í•ô¤ì(€€€€€€€ô¤ì((€€€€€€€Á…”¹‘…Ñ…Í•Ğ¹•ÍÑÕÉ•1½­I•…‘äô‰ÑÉÕ”ˆì(€€€ô((€€€™Õ¹Ñ¥½¸…ÁÁ±åÉ•…Ñ¥½¹MÑ•À¡ÍÑ•À¥ì(€€€€€€€½¹ÍĞÁ…”õ‰å% ‰É•…Ñ¥½¹A…”ˆ¤ì(€€€€€€€½¹ÍĞ¹½Éµ…±¥é•õ9Õµ‰•È¡ÍÑ•À¤ôôôÈüÈèÄì(€€€€€€€Í•±•Ñ•‘É•…Ñ¥½¹MÑ•Àõ¹½Éµ…±¥é•ì((€€€€€€€‘½Õµ•¹Ğ¹ÅÕ•ÉåM•±•Ñ½É±° ˆÉ•…Ñ¥½¹A…”m‘…Ñ„µÉ•…Ñ¥½¸µÍÑ•Átˆ¤¹™½É… ¡™Õ¹Ñ¥½¸¡Á…¹•°¥ì(€€€€€€€€€€€½¹ÍĞ…Ñ¥Ù”õ9Õµ‰•È¡Á…¹•°¹‘…Ñ…Í•Ğ¹É•…Ñ¥½¹MÑ•À¤ôôõ¹½Éµ…±¥é•ì(€€€€€€€€€€€Á…¹•°¹±…ÍÍ1¥ÍĞ¹Ñ½±” ‰¥Ìµ…Ñ¥Ù”ˆ±…Ñ¥Ù”¤ì(€€€€€€€€€€€Á…¹•°¹¡¥‘‘•¸ô……Ñ¥Ù”ì(€€€€€€€€€€€Á…¹•°¹Í•ÑÑÑÉ¥‰ÕÑ” ‰…É¥„µ¡¥‘‘•¸ˆ±…Ñ¥Ù”ü‰™…±Í”ˆè‰ÑÉÕ”ˆ¤ì(€€€€€€€ô¤ì((€€€€€€€‘½Õµ•¹Ğ¹ÅÕ•ÉåM•±•Ñ½É±° ˆÉ•…Ñ¥½¹A…”m‘…Ñ„µÉ•…Ñ¥½¸µÍÑ•Àµ¥¹‘¥…Ñ½Étˆ¤¹™½É… ¡™Õ¹Ñ¥½¸¡¥¹‘¥…Ñ½È¥ì(€€€€€€€€€€€½¹ÍĞ…Ñ¥Ù”õ9Õµ‰•È¡¥¹‘¥…Ñ½È¹‘…Ñ…Í•Ğ¹É•…Ñ¥½¹MÑ•Á%¹‘¥…Ñ½È¤ôôõ¹½Éµ…±¥é•ì(€€€€€€€€€€€¥¹‘¥…Ñ½È¹±…ÍÍ1¥ÍĞ¹Ñ½±” ‰¥Ìµ…Ñ¥Ù”ˆ±…Ñ¥Ù”¤ì(€€€€€€€€€€€¥˜¡…Ñ¥Ù”¥ì(€€€€€€€€€€€€€€€¥¹‘¥…Ñ½È¹Í•ÑÑÑÉ¥‰ÕÑ” ‰…É¥„µÕÉÉ•¹Ğˆ°‰ÍÑ•Àˆ¤ì(€€€€€€€€€€€õ•±Í•ì(€€€€€€€€€€€€€€€¥¹‘¥…Ñ½È¹É•µ½Ù•ÑÑÉ¥‰ÕÑ” ‰…É¥„µÕÉÉ•¹Ğˆ¤ì(€€€€€€€€€€€ô(€€€€€€€ô¤ì((€€€€€€€¥˜¡Á…”¥ì(€€€€€€€€€€€Á…”¹‘…Ñ…Í•Ğ¹ÍÑ•ÀõMÑÉ¥¹œ¡¹½Éµ…±¥é•¤ì(€€€€€€€€€€€Á…”¹ÍÉ½±±Q½ÀôÀì(€€€€€€€ô((€€€€€€€l‰…µ”µÙ¥•İÁ½ÉĞˆ°‰…µ”µÍÑ…”ˆ°‰…µ”µ½Ù•É±…äµ±…å•È‰t¹™½É… ¡™Õ¹Ñ¥½¸¡¥¥ì(€€€€€€€€€€€½¹ÍĞ¹½‘”õ‰å%¡¥¤ì(€€€€€€€€€€€¥˜¡¹½‘”¥ì(€€€€€€€€€€€€€€€¹½‘”¹ÍÉ½±±Q½ÀôÀì(€€€€€€€€€€€€€€€¹½‘”¹ÍÉ½±±1•™ĞôÀì(€€€€€€€€€€€ô(€€€€€€€ô¤ì((€€€€€€€¥˜¡‘½Õµ•¹Ğ¹…Ñ¥Ù•±•µ•¹Ğ€˜˜ÑåÁ•½˜‘½Õµ•¹Ğ¹…Ñ¥Ù•±•µ•¹Ğ¹‰±ÕÈôôô‰™Õ¹Ñ¥½¸ˆ¥ì(€€€€€€€€€€€‘½Õµ•¹Ğ¹…Ñ¥Ù•±•µ•¹Ğ¹‰±ÕÈ ¤ì(€€€€€€€ô(€€€€€€€İ¥¹‘½Ü¹ÍÉ½±±Q¼ À°À¤ì(€€€ô((€€€İ¥¹‘½Ü¹Í•ÑÉ•…Ñ¥½¹MÑ•Àõ™Õ¹Ñ¥½¸¡ÍÑ•À¥ì(€€€€€€€…ÁÁ±åÉ•…Ñ¥½¹MÑ•À¡ÍÑ•À¤ì(€€€ôì((€€€™Õ¹Ñ¥½¸½É‘•É•‘M­¥±±Ì¡•±•µ•¹Ğ±…Ñ•½Éä¥ì(€€€€€€€¥˜¡ÑåÁ•½˜Í­¥±±…Ñ…‰…Í”ôôô‰Õ¹‘•™¥¹•ˆ¥ì(€€€€€€€€€€€É•ÑÕÉ¸mtì(€€€€€€€ô(€€€€€€€É•ÑÕÉ¸=‰©•Ğ¹­•åÌ¡Í­¥±±…Ñ…‰…Í”¤(€€€€€€€€€€€€¹µ…À¡™Õ¹Ñ¥½¸¡¥¥íÉ•ÑÕÉ¸Í­¥±±…Ñ…‰…Í•m¥‘tíô¤(€€€€€€€€€€€€¹™¥±Ñ•È¡™Õ¹Ñ¥½¸¡Í­¥±°¥ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸Í­¥±°€˜˜Í­¥±°¹•±•µ•¹Ğôôõ•±•µ•¹Ğ€˜˜Í­¥±°¹…Ñ•½Éäôôõ…Ñ•½Éäì(€€€€€€€€€€€ô¤(€€€€€€€€€€€€¹Í½ÉĞ¡™Õ¹Ñ¥½¸¡„±ˆ¥ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸9Õµ‰•È¡„¹Ñ¥•Éñğää¤µ9Õµ‰•È¡ˆ¹Ñ¥•Éñğää¤ì(€€€€€€€€€€€ô¤ì(€€€ô((€€€™Õ¹Ñ¥½¸ÍÁ•¥…±M­¥±±Ì¡•±•µ•¹Ğ¥ì(€€€€€€€¥˜¡ÑåÁ•½˜Í­¥±±…Ñ…‰…Í”ôôô‰Õ¹‘•™¥¹•ˆ¥ì(€€€€€€€€€€€É•ÑÕÉ¸mtì(€€€€€€€ô(€€€€€€€½¹ÍĞ½É‘•Èõí‰Õ™˜èÄ±¡•…°èÈ±É•Ù¥Ù”èÌ±Á…ÍÍ¥Ù”èÑôì(€€€€€€€É•ÑÕÉ¸=‰©•Ğ¹­•åÌ¡Í­¥±±…Ñ…‰…Í”¤(€€€€€€€€€€€€¹µ…À¡™Õ¹Ñ¥½¸¡¥¥íÉ•ÑÕÉ¸Í­¥±±…Ñ…‰…Í•m¥‘tíô¤(€€€€€€€€€€€€¹™¥±Ñ•È¡™Õ¹Ñ¥½¸¡Í­¥±°¥ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸Í­¥±°€˜˜Í­¥±°¹•±•µ•¹Ğôôõ•±•µ•¹Ğ€˜˜½É‘•ÉmÍ­¥±°¹…Ñ•½Éåtì(€€€€€€€€€€€ô¤(€€€€€€€€€€€€¹Í½ÉĞ¡™Õ¹Ñ¥½¸¡„±ˆ¥ì(€€€€€€€€€€€€€€€½¹ÍĞ…Ğô¡½É‘•Ém„¹…Ñ•½Éåuñğää¤´¡½É‘•Émˆ¹…Ñ•½Éåuñğää¤ì(€€€€€€€€€€€€€€€¥˜¡…Ğ„ôôÀ¥íÉ•ÑÕÉ¸…Ğíô(€€€€€€€€€€€€€€€É•ÑÕÉ¸9Õµ‰•È¡„¹Ñ¥•Éñğää¤µ9Õµ‰•È¡ˆ¹Ñ¥•Éñğää¤ì(€€€€€€€€€€€ô¤ì(€€€ô((€€€™Õ¹Ñ¥½¸É•¹‘•ÉM­¥±±¡¥ÁÌ¡½¹Ñ…¥¹•É%±Í­¥±±Ì¥ì(€€€€€€€½¹ÍĞ‰½àõ‰å%¡½¹Ñ…¥¹•É%¤ì(€€€€€€€¥˜ …‰½à¥íÉ•ÑÕÉ¸íô(€€€€€€€‰½à¹¥¹¹•É!Q50ôˆˆì(€€€€€€€Í­¥±±Ì¹™½É… ¡™Õ¹Ñ¥½¸¡Í­¥±°±¥¹‘•à¥ì(€€€€€€€€€€€½¹ÍĞ¡¥Àõ‘½Õµ•¹Ğ¹É•…Ñ•±•µ•¹Ğ ‰‰ÕÑÑ½¸ˆ¤ì(€€€€€€€€€€€¡¥À¹ÑåÁ”ô‰‰ÕÑÑ½¸ˆì(€€€€€€€€€€€¡¥À¹±…ÍÍ9…µ”ô‰É•…Ñ¥½¸µÍ­¥±°µ¡¥Àˆ¬¡¥¹‘•àôôõÍ­¥±±Ì¹±•¹Ñ ´ÄüˆÍ¥¹…ÑÕÉ”ˆèˆˆ¤ì(€€€€€€€€€€€¡¥À¹‘…Ñ…Í•Ğ¹Í­¥±±%õÍ­¥±°¹¥ì(€€€€€€€€€€€¡¥À¹Ñ•áÑ½¹Ñ•¹ĞõÍ­¥±°¹¹…µ”ì(€€€€€€€€€€€¡¥À¹Ñ¥Ñ±”õÍ­¥±°¹‘•ÍÉ¥ÁÑ¥½¹ññÍ­¥±°¹¹…µ”ì(€€€€€€€€€€€¡¥À¹Í•ÑÑÑÉ¥‰ÕÑ” ‰…É¥„µ¡…ÍÁ½ÁÕÀˆ°‰‘¥…±½œˆ¤ì(€€€€€€€€€€€¡¥À¹Í•ÑÑÑÉ¥‰ÕÑ” ‰…É¥„µ±…‰•°ˆ±Í­¥±°¹¹…µ”¬‹¾ò3¦î{šN+š~—r/¢¦ÏÒÃ’î/Òäˆ¤ì(€€€€€€€€€€€¡¥À¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ±™Õ¹Ñ¥½¸ ¥ì(€€€€€€€€€€€€€€€İ¥¹‘½Ü¹Í¡½İÉ•…Ñ¥½¹M­¥±±•Ñ…¥°¡Í­¥±°¹¥¤ì(€€€€€€€€€€€ô¤ì(€€€€€€€€€€€‰½à¹…ÁÁ•¹‘¡¥±¡¡¥À¤ì(€€€€€€€ô¤ì(€€€ô((€€€™Õ¹Ñ¥½¸•Í…Á•!Q50¡Ù…±Õ”¥ì(€€€€€€€É•ÑÕÉ¸MÑÉ¥¹œ¡Ù…±Õ”ôôõÕ¹‘•™¥¹•‘ññÙ…±Õ”ôôõ¹Õ±°üˆˆéÙ…±Õ”¤(€€€€€€€€€€€€¹É•Á±…” ¼˜½œ°ˆ™…µÀìˆ¤(€€€€€€€€€€€€¹É•Á±…” ¼ğ½œ°ˆ™±Ğìˆ¤(€€€€€€€€€€€€¹É•Á±…” ¼ø½œ°ˆ™Ğìˆ¤(€€€€€€€€€€€€¹É•Á±…” ¼ˆ½œ°ˆ™ÅÕ½Ğìˆ¤(€€€€€€€€€€€€¹É•Á±…” ¼œ½œ°ˆ˜ŒÌäìˆ¤ì(€€€ô((€€€™Õ¹Ñ¥½¸Ù…±Õ•Ñ1•Ù•°¡Ù…±Õ•Ì±±•Ù•°¥ì(€€€€€€€¥˜ …ÉÉ…ä¹¥ÍÉÉ…ä¡Ù…±Õ•Ì¤ñğÙ…±Õ•Ì¹±•¹Ñ ğÄ¥ì(€€€€€€€€€€€É•ÑÕÉ¸Õ¹‘•™¥¹•ì(€€€€€€€ô(€€€€€€€É•ÑÕÉ¸Ù…±Õ•Ím5…Ñ ¹µ¥¸¡±•Ù•°´Ä±Ù…±Õ•Ì¹±•¹Ñ ´Ä¥tì(€€€ô((€€€™Õ¹Ñ¥½¸É•…Ñ¥½¹M­¥±±…Ñ•½Éå1…‰•°¡…Ñ•½Éä¥ì(€€€€€€€ÑÉåì(€€€€€€€€€€€¥˜¡ÑåÁ•½˜•ÑM­¥±±…Ñ•½Éå1…‰•°ôôô‰™Õ¹Ñ¥½¸ˆ¥ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸•ÑM­¥±±…Ñ•½Éå1…‰•°¡…Ñ•½Éä¤ì(€€€€€€€€€€€ô(€€€€€€€õ…Ñ ¡•ÉÉ½È¥íô((€€€€€€€½¹ÍĞ±…‰•±Ìõì(€€€€€€€€€€€Á¡åÍ¥…°è‹&§Bˆ°(€€€€€€€€€€€µ…¥Œè‹šÎW¢†Lˆ°(€€€€€€€€€€€‰Õ™˜è‹–Š{n(ˆ°(€€€€€€€€€€€¡•…°è‹–n{–ú¤ˆ°(€€€€€€€€€€€É•Ù¥Ù”è‹–ú§šÒìˆ°(€€€€€€€€€€€Á…ÍÍ¥Ù”è‹¢Š¯–.Tˆ(€€€€€€€ôì(€€€€€€€É•ÑÕÉ¸±…‰•±Ím…Ñ•½Éåuñğ‹š*¢ôˆì(€€€ô((€€€™Õ¹Ñ¥½¸É•…Ñ¥½¹M­¥±±Q…É•Ñ1…‰•°¡Ñ…É•ÑQåÁ”¥ì(€€€€€€€½¹ÍĞ±…‰•±Ìõì(€€€€€€€€€€€Í¥¹±”è‹–Z»¦®SšV×’êèˆ°(€€€€€€€€€€€ÑÉ¤è‹–B3š¦¯š:Kšr–’hÏ–B7šV×’êèˆ°(€€€€€€€€€€€É½Üè‹’îï’âšV×šZçš¦¯š:Hˆ°(€€€€€€€€€€€…±°è‹šV×šZç–£¦®Pˆ°(€€€€€€€€€€€…±±äè‹–Z»’â–>/šZäˆ°(€€€€€€€€€€€…±±å±°è‹š"GšZç–£¦®Pˆ°(€€€€€€€€€€€‘•…‘±±äè‹š¶ï’ê‡–>/šZäˆ°(€€€€€€€€€€€¹½¹”è‹šÂã’æ¢Š¯–.Tˆ(€€€€€€€ôì(€€€€€€€É•ÑÕÉ¸±…‰•±ÍmÑ…É•ÑQåÁ•uñğ‹’úwš*¢÷¢š?–&ˆì(€€€ô((€€€™Õ¹Ñ¥½¸Í­¥±±1•Ù•±A…ÉÑÌ¡Í­¥±°±±•Ù•°¥ì(€€€€€€€½¹ÍĞÁ…ÉÑÌõmtì((€€€€€€€¥˜ (€€€€€€€€€€€€¡Í­¥±°¹…Ñ•½Éäôôô‰Á¡åÍ¥…°ˆñğÍ­¥±°¹…Ñ•½Éäôôô‰µ…¥Œˆ¤€˜˜(€€€€€€€€€€€Í­¥±°¹‰…Í•…µ…”„ôõÕ¹‘•™¥¹•(€€€€€€€€¥ì(€€€€€€€€€€€±•Ğ‘…µ…”õ9Õµ‰•È¡Í­¥±°¹‰…Í•…µ…•ñğÀ¤­9Õµ‰•È¡Í­¥±°¹‘…µ…•A•É1•Ù•±ñğÀ¤¨¡±•Ù•°´Ä¤ì(€€€€€€€€€€€ÑÉåì(€€€€€€€€€€€€€€€¥˜¡ÑåÁ•½˜•ÑM­¥±±…µ…•Ñ1•Ù•°ôôô‰™Õ¹Ñ¥½¸ˆ¥ì(€€€€€€€€€€€€€€€€€€€‘…µ…”õ•ÑM­¥±±…µ…•Ñ1•Ù•°¡Í­¥±°±±•Ù•°¤ì(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€õ…Ñ ¡•ÉÉ½È¥íô((€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ  (€€€€€€€€€€€€€€€€‹–
ß–ºÌˆ­5…Ñ ¹™±½½È¡‘…µ…”¤¬(€€€€€€€€€€€€€€€€¡Í­¥±°¹‘…µ…•A•É1•Ù•°€ü€‹¾ò#š¾?Òh¬ˆ­Í­¥±°¹‘…µ…•A•É1•Ù•°¬‹¾ò$ˆ€è€ˆˆ¤(€€€€€€€€€€€€¤ì(€€€€€€€ô((€€€€€€€½¹ÍĞ‰ÕÉ¹A•É•¹ĞõÙ…±Õ•Ñ1•Ù•°¡Í­¥±°¹‰ÕÉ¹A•É•¹Ñ	å1•Ù•°±±•Ù•°¤ì(€€€€€€€¥˜¡Í­¥±°¹‰ÕÉ¹¡…¹”„ôõÕ¹‘•™¥¹•€˜˜‰ÕÉ¹A•É•¹Ğ„ôõÕ¹‘•™¥¹•¥ì(€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ  (€€€€€€€€€€€€€€€Í­¥±°¹‰ÕÉ¹¡…¹”¬ˆ—š¦:Hˆ¬(€€€€€€€€€€€€€€€€¡Í­¥±°¹‰ÕÉ¹ÕÉ…Ñ¥½¹ñğÈ¤¬‹–n{–B#¾ò3š¾?–n{–B#¦ƒš"Cšr–’!@€ˆ¬(€€€€€€€€€€€€€€€‰ÕÉ¹A•É•¹Ğ¬ˆ—–
ß–ºÌˆ(€€€€€€€€€€€€¤ì(€€€€€€€ô((€€€€€€€¥˜¡Í­¥±°¹™É••é•¡…¹”„ôõÕ¹‘•™¥¹•¥ì(€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ  (€€€€€€€€€€€€€€€Í­¥±°¹™É••é•¡…¹”¬ˆ—š¦:–Ã–Âˆ¬(€€€€€€€€€€€€€€€€¡Í­¥±°¹™É••é•ÕÉ…Ñ¥½¹ñğÄ¤¬‹–n{–B ˆ(€€€€€€€€€€€€¤ì(€€€€€€€ô((€€€€€€€½¹ÍĞ±¥™•ÍÑ•…°õÙ…±Õ•Ñ1•Ù•°¡Í­¥±°¹±¥™•ÍÑ•…±A•É•¹Ñ	å1•Ù•°±±•Ù•°¤ì(€€€€€€€¥˜¡±¥™•ÍÑ•…°„ôõÕ¹‘•™¥¹•¥ì(€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ  ‹–Bã–>[–
ß–ºÌˆ­±¥™•ÍÑ•…°¬ˆ—¾ò3¶'¦?–n{–ú§¢«¢ê­!C¢"M@ˆ¤ì(€€€€€€€ô((€€€€€€€½¹ÍĞ…¥±¥Ñå½İ¸õÙ…±Õ•Ñ1•Ù•°¡Í­¥±°¹…¥±¥Ñå½İ¹	å1•Ù•°±±•Ù•°¤ì(€€€€€€€¥˜¡…¥±¥Ñå½İ¸„ôõÕ¹‘•™¥¹•¥ì(€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ  (€€€€€€€€€€€€€€€Í­¥±°¹…¥±¥Ñå½İ¹¡…¹”¬ˆ—š¦:¦f7’ö;šV?š6Üˆ¬(€€€€€€€€€€€€€€€…¥±¥Ñå½İ¸¬ˆ—¾ò3š2ê0ˆ¬¡Í­¥±°¹…¥±¥Ñå½İ¹ÕÉ…Ñ¥½¹ñğÈ¤¬‹–n{–B ˆ(€€€€€€€€€€€€¤ì(€€€€€€€ô((€€€€€€€½¹ÍĞÍÑ…Ñ½İ¸õÙ…±Õ•Ñ1•Ù•°¡Í­¥±°¹ÍÑ…Ñ½İ¹	å1•Ù•°±±•Ù•°¤ì(€€€€€€€¥˜¡ÍÑ…Ñ½İ¸„ôõÕ¹‘•™¥¹•¥ì(€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ  (€€€€€€€€€€€€€€€Í­¥±°¹ÍÑ…Ñ½İ¹¡…¹”¬ˆ—š¦:¦f7’ö;š&šr'¢÷–*lˆ¬(€€€€€€€€€€€€€€€ÍÑ…Ñ½İ¸¬ˆ—¾ò3š2ê0ˆ¬¡Í­¥±°¹ÍÑ…Ñ½İ¹ÕÉ…Ñ¥½¹ñğÈ¤¬‹–n{–B ˆ(€€€€€€€€€€€€¤ì(€€€€€€€ô((€€€€€€€½¹ÍĞ‘…µ…•½İ¸õÙ…±Õ•Ñ1•Ù•°¡Í­¥±°¹‘…µ…•½İ¹	å1•Ù•°±±•Ù•°¤ì(€€€€€€€¥˜¡‘…µ…•½İ¸„ôõÕ¹‘•™¥¹•¥ì(€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ  (€€€€€€€€€€€€€€€Í­¥±°¹‘…µ…•½İ¹¡…¹”¬ˆ—š¦:¦f7’ö;¦ƒš"C–
ß–ºÌˆ¬(€€€€€€€€€€€€€€€‘…µ…•½İ¸¬ˆ—¾ò3š2ê0ˆ¬¡Í­¥±°¹‘…µ…•½İ¹ÕÉ…Ñ¥½¹ñğÄ¤¬‹–n{–B ˆ(€€€€€€€€€€€€¤ì(€€€€€€€ô((€€€€€€€½¹ÍĞ‘•™•¹Í•½İ¸õÙ…±Õ•Ñ1•Ù•°¡Í­¥±°¹‘•™•¹Í•½İ¹	å1•Ù•°±±•Ù•°¤ì(€€€€€€€¥˜¡‘•™•¹Í•½İ¸„ôõÕ¹‘•™¥¹•¥ì(€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ  (€€€€€€€€€€€€€€€Í­¥±°¹‘•™•¹Í•½İ¹¡…¹”¬ˆ—š¦:¦f7’ö;¦bËš˜ˆ¬(€€€€€€€€€€€€€€€‘•™•¹Í•½İ¸¬ˆ—¾ò3š2ê0ˆ¬¡Í­¥±°¹‘•™•¹Í•½İ¹ÕÉ…Ñ¥½¹ñğÈ¤¬‹–n{–B ˆ(€€€€€€€€€€€€¤ì(€€€€€€€ô((€€€€€€€½¹ÍĞµ¥ÍÍ	½¹ÕÌõÙ…±Õ•Ñ1•Ù•°¡Í­¥±°¹µ¥ÍÍ	½¹ÕÍ	å1•Ù•°±±•Ù•°¤ì(€€€€€€€¥˜¡µ¥ÍÍ	½¹ÕÌ„ôõÕ¹‘•™¥¹•¥ì(€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ  (€€€€€€€€€€€€€€€Í­¥±°¹ÍÑÕ¹¡…¹”¬ˆ—š¦:šj#r¤ˆ¬(€€€€€€€€€€€€€€€€¡Í­¥±°¹ÍÑÕ¹ÕÉ…Ñ¥½¹ñğÈ¤¬‹–n{–B#¾ò15%MO:š>C¦®`ˆ­µ¥ÍÍ	½¹ÕÌ¬ˆ”ˆ(€€€€€€€€€€€€¤ì(€€€€€€€ô((€€€€€€€½¹ÍĞÁ•ÑÉ¥™å¡…¹”õÙ…±Õ•Ñ1•Ù•°¡Í­¥±°¹Á•ÑÉ¥™å¡…¹•	å1•Ù•°±±•Ù•°¤ì(€€€€€€€¥˜¡Á•ÑÉ¥™å¡…¹”„ôõÕ¹‘•™¥¹•¥ì(€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ  (€€€€€€€€€€€€€€€Á•ÑÉ¥™å¡…¹”¬ˆ—š¦:~Ï–2Xˆ¬(€€€€€€€€€€€€€€€€¡Í­¥±°¹Á•ÑÉ¥™åÕÉ…Ñ¥½¹ñğÈ¤¬‹–n{–B ˆ(€€€€€€€€€€€€¤ì(€€€€€€€ô((€€€€€€€½¹ÍĞÍ•±™M¡¥•±õÙ…±Õ•Ñ1•Ù•°¡Í­¥±°¹Í•±™M¡¥•±‘	å1•Ù•°±±•Ù•°¤ì(€€€€€€€¥˜¡Í•±™M¡¥•±„ôõÕ¹‘•™¥¹•¥ì(€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ  (€€€€€€€€€€€€€€€€‹¢«¢ê¯¢¶ßnøˆ­Í•±™M¡¥•±¬‹¦î{¾ò3š2ê0ˆ¬(€€€€€€€€€€€€€€€€¡Í­¥±°¹Í¡¥•±‘ÕÉ…Ñ¥½¹ñğÈ¤¬‹–n{–B ˆ(€€€€€€€€€€€€¤ì(€€€€€€€ô((€€€€€€€½¹ÍĞ…±±åM¡¥•±õÙ…±Õ•Ñ1•Ù•°¡Í­¥±°¹…±±åM¡¥•±‘	å1•Ù•°±±•Ù•°¤ì(€€€€€€€¥˜¡…±±åM¡¥•±„ôõÕ¹‘•™¥¹•¥ì(€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ  (€€€€€€€€€€€€€€€€‹š"GšZç–£¦®S¢¶ßnøˆ­…±±åM¡¥•±¬‹¦î{¾ò3š2ê0ˆ¬(€€€€€€€€€€€€€€€€¡Í­¥±°¹Í¡¥•±‘ÕÉ…Ñ¥½¹ñğÈ¤¬‹–n{–B ˆ(€€€€€€€€€€€€¤ì(€€€€€€€ô((€€€€€€€½¹ÍĞÉ¥Ñ	½¹ÕÌõÙ…±Õ•Ñ1•Ù•°¡Í­¥±°¹É¥Ñ	½¹ÕÍ	å1•Ù•°±±•Ù•°¤ì(€€€€€€€¥˜¡Í­¥±°¹…Ñ•½Éäôôô‰‰Õ™˜ˆ€˜˜É¥Ñ	½¹ÕÌ„ôõÕ¹‘•™¥¹•¥ì(€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ  (€€€€€€€€€€€€€€€€‹š"GšZç"šN+:¢""šN+–
ß–ºÌ€¬ˆ­É¥Ñ	½¹ÕÌ¬(€€€€€€€€€€€€€€€€ˆ—¾ò3š2ê0ˆ­Í­¥±°¹‘ÕÉ…Ñ¥½¸¬‹–n{–B ˆ(€€€€€€€€€€€€¤ì(€€€€€€€ô(€€€€€€€•±Í”¥˜¡Í­¥±°¹…Ñ•½Éäôôô‰‰Õ™˜ˆ€˜˜Í­¥±°¹•Ù…Í¥½¹	½¹ÕÍA•É•¹Ğ„ôõÕ¹‘•™¥¹•¥ì(€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ  (€€€€€€€€€€€€€€€€‹¦Z¢êË:€¬ˆ­Í­¥±°¹•Ù…Í¥½¹	½¹ÕÍA•É•¹Ğ¬(€€€€€€€€€€€€€€€€ˆ—¾ò3š2ê0ˆ­Í­¥±°¹‘ÕÉ…Ñ¥½¸¬‹–n{–B ˆ(€€€€€€€€€€€€¤ì(€€€€€€€ô(€€€€€€€•±Í”¥˜¡Í­¥±°¹…Ñ•½Éäôôô‰‰Õ™˜ˆ€˜˜Í­¥±°¹‘•™•¹Í•	½¹ÕÍA•É•¹Ğ„ôõÕ¹‘•™¥¹•¥ì(€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ  (€€€€€€€€€€€€€€€€‹¦bËš›–*l€¬ˆ­Í­¥±°¹‘•™•¹Í•	½¹ÕÍA•É•¹Ğ¬(€€€€€€€€€€€€€€€€ˆ—¾ò3š2ê0ˆ­Í­¥±°¹‘ÕÉ…Ñ¥½¸¬‹–n{–B ˆ(€€€€€€€€€€€€¤ì(€€€€€€€ô(€€€€€€€•±Í”¥˜¡Í­¥±°¹…Ñ•½Éäôôô‰‰Õ™˜ˆ€˜˜Í­¥±°¹É•™±•ÑA•É•¹Ğ„ôõÕ¹‘•™¥¹•¥ì(€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ  (€€€€€€€€€€€€€€€€‹–>7–
Ü€ˆ­Í­¥±°¹É•™±•ÑA•É•¹Ğ¬(€€€€€€€€€€€€€€€€ˆ—¾ò3š2ê0ˆ­Í­¥±°¹‘ÕÉ…Ñ¥½¸¬‹–n{–B ˆ(€€€€€€€€€€€€¤ì(€€€€€€€ô(€€€€€€€•±Í”¥˜¡Í­¥±°¹…Ñ•½Éäôôô‰‰Õ™˜ˆ€˜˜Í­¥±°¹ÍÑ…ÑÕÍI•Í¥ÍÑ	½¹ÕÌ„ôõÕ¹‘•™¥¹•¥ì(€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ  (€€€€€€€€€€€€€€€€‹VÃ–âã.š/š*_šœ€¬ˆ­Í­¥±°¹ÍÑ…ÑÕÍI•Í¥ÍÑ	½¹ÕÌ¬(€€€€€€€€€€€€€€€€ˆ—¾ò3š2ê0ˆ­Í­¥±°¹‘ÕÉ…Ñ¥½¸¬‹–n{–B ˆ(€€€€€€€€€€€€¤ì(€€€€€€€ô(€€€€€€€•±Í”¥˜¡Í­¥±°¹…Ñ•½Éäôôô‰‰Õ™˜ˆ¥ì(€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ ¡Í­¥±°¹‘•ÍÉ¥ÁÑ¥½¸¤ì(€€€€€€€ô((€€€€€€€¥˜¡Í­¥±°¹…Ñ•½Éäôôô‰¡•…°ˆ¥ì(€€€€€€€€€€€±•Ğ¡Á½•™™¥¥•¹ĞôÄ¸ÈÔì(€€€€€€€€€€€±•ĞÍÁ½•™™¥¥•¹Ğô¸Ôì(€€€€€€€€€€€ÑÉåì(€€€€€€€€€€€€€€€¥˜¡ÑåÁ•½˜!1%9}%9Q}=%%9P„ôô‰Õ¹‘•™¥¹•ˆ¥ì(€€€€€€€€€€€€€€€€€€€¡Á½•™™¥¥•¹Ğõ!1%9}%9Q}=%%9Pì(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€¥˜¡ÑåÁ•½˜MA}!1%9}%9Q}=%%9P„ôô‰Õ¹‘•™¥¹•ˆ¥ì(€€€€€€€€€€€€€€€€€€€ÍÁ½•™™¥¥•¹ĞõMA}!1%9}%9Q}=%%9Pì(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€õ…Ñ ¡•ÉÉ½È¥íô((€€€€€€€€€€€½¹ÍĞ¡Á	…Í”õ9Õµ‰•È¡Í­¥±°¹‰…Í•!•…±ñğÀ¤­9Õµ‰•È¡Í­¥±°¹¡•…±A•É1•Ù•±ñğÀ¤¨¡±•Ù•°´Ä¤ì(€€€€€€€€€€€½¹ÍĞÍÁ	…Í”õ9Õµ‰•È¡Í­¥±°¹‰…Í•!•…±MAñğÀ¤­9Õµ‰•È¡Í­¥±°¹¡•…±MAA•É1•Ù•±ñğÀ¤¨¡±•Ù•°´Ä¤ì(€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ  (€€€€€€€€€€€€€€€€‹–n{–ú¥!C¾òk–~ë’8ˆ­¡Á	…Í”¬‹¾ò/šfë–*o\ˆ­¡Á½•™™¥¥•¹Ğ¬(€€€€€€€€€€€€€€€€‹¾òo–n{–ú¥MC¾òk–~ë’8ˆ­ÍÁ	…Í”¬‹¾ò/šfë–*o\ˆ­ÍÁ½•™™¥¥•¹Ğ¬(€€€€€€€€€€€€€€€€‹¾ò#šZ÷šRû¢šr³’êë’â7–n{–ú¥MC¾ò$ˆ(€€€€€€€€€€€€¤ì(€€€€€€€ô((€€€€€€€½¹ÍĞÉ•Ù¥Ù•A•É•¹ĞõÙ…±Õ•Ñ1•Ù•°¡Í­¥±°¹É•Ù¥Ù•!•…±A•É•¹Ñ	å1•Ù•°±±•Ù•°¤ì(€€€€€€€¥˜¡Í­¥±°¹…Ñ•½Éäôôô‰É•Ù¥Ù”ˆ€˜˜É•Ù¥Ù•A•É•¹Ğ„ôõÕ¹‘•™¥¹•¥ì(€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ  ‹–ú§šÒï’â›š‹–ú¤ˆ­É•Ù¥Ù•A•É•¹Ğ¬ˆ—šr–’!@ˆ¤ì(€€€€€€€ô((€€€€€€€¥˜¡Í­¥±°¹…Ñ•½Éäôôô‰Á…ÍÍ¥Ù”ˆ¥ì(€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ ¡Í­¥±°¹‘•ÍÉ¥ÁÑ¥½¸¤ì(€€€€€€€ô((€€€€€€€¥˜¡Á…ÉÑÌ¹±•¹Ñ ğÄ¥ì(€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ ¡Í­¥±°¹‘•ÍÉ¥ÁÑ¥½¹ñğ‹’úwš*¢÷¢ª«šb;RšV#ˆ¤ì(€€€€€€€ô((€€€€€€€É•ÑÕÉ¸ÉÉ…ä¹™É½´¡¹•ÜM•Ğ¡Á…ÉÑÌ¹™¥±Ñ•È¡	½½±•…¸¤¤¤ì(€€€ô((€€€™Õ¹Ñ¥½¸‰Õ¥±‘É•…Ñ¥½¹M­¥±±1•Ù•±I½İÌ¡Í­¥±°¥ì(€€€€€€€½¹ÍĞµ…á1•Ù•°õ5…Ñ ¹µ…à Ä±9Õµ‰•È¡Í­¥±°¹µ…á1•Ù•°¥ñğÄ¤ì(€€€€€€€½¹ÍĞÉ½İÌõmtì((€€€€€€€™½È¡±•Ğ±•Ù•°ôÄí±•Ù•°ğõµ…á1•Ù•°í±•Ù•°¬¬¥ì(€€€€€€€€€€€½¹ÍĞ‘•Ñ…¥±ÌõÍ­¥±±1•Ù•±A…ÉÑÌ¡Í­¥±°±±•Ù•°¤ì(€€€€€€€€€€€É½İÌ¹ÁÕÍ  (€€€€€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰É•…Ñ¥½¸µÍ­¥±°µ‘•Ñ…¥°µ±•Ù•°µÉ½Üˆøœ¬(€€€€€€€€€€€€€€€€€€€€œñˆù1Ø¸œ­±•Ù•°¬œğ½ˆøœ¬(€€€€€€€€€€€€€€€€€€€€œñÍÁ…¸øœ­‘•Ñ…¥±Ì¹µ…À¡•Í…Á•!Q50¤¹©½¥¸ ‹¾öpˆ¤¬œğ½ÍÁ…¸øœ¬(€€€€€€€€€€€€€€€€œğ½‘¥Øøœ(€€€€€€€€€€€€¤ì(€€€€€€€ô((€€€€€€€É•ÑÕÉ¸É½İÌ¹©½¥¸ ˆˆ¤ì(€€€ô((€€€™Õ¹Ñ¥½¸•¹ÍÕÉ•É•…Ñ¥½¹M­¥±±•Ñ…¥±5½‘…° ¥ì(€€€€€€€±•Ğµ½‘…°õ‰å% ‰É•…Ñ¥½¹M­¥±±•Ñ…¥±5½‘…°ˆ¤ì(€€€€€€€¥˜¡µ½‘…°¥ì(€€€€€€€€€€€É•ÑÕÉ¸µ½‘…°ì(€€€€€€€ô((€€€€€€€½¹ÍĞ½Ù•É±…äõ‰å% ‰…µ”µ½Ù•É±…äµ±…å•Èˆ¤ì(€€€€€€€¥˜ …½Ù•É±…ä¥ì(€€€€€€€€€€€É•ÑÕÉ¸¹Õ±°ì(€€€€€€€ô((€€€€€€€µ½‘…°õ‘½Õµ•¹Ğ¹É•…Ñ•±•µ•¹Ğ ‰‘¥Øˆ¤ì(€€€€€€€µ½‘…°¹¥ô‰É•…Ñ¥½¹M­¥±±•Ñ…¥±5½‘…°ˆì(€€€€€€€µ½‘…°¹Í•ÑÑÑÉ¥‰ÕÑ” ‰É½±”ˆ°‰‘¥…±½œˆ¤ì(€€€€€€€µ½‘…°¹Í•ÑÑÑÉ¥‰ÕÑ” ‰…É¥„µµ½‘…°ˆ°‰ÑÉÕ”ˆ¤ì(€€€€€€€µ½‘…°¹Í•ÑÑÑÉ¥‰ÕÑ” ‰…É¥„µ¡¥‘‘•¸ˆ°‰ÑÉÕ”ˆ¤ì(€€€€€€€µ½‘…°¹Í•ÑÑÑÉ¥‰ÕÑ” ‰…É¥„µ±…‰•±±•‘‰äˆ°‰É•…Ñ¥½¹M­¥±±•Ñ…¥±9…µ”ˆ¤ì(€€€€€€€µ½‘…°¹¥¹¹•É!Q50ô(€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰É•…Ñ¥½¸µÍ­¥±°µ‘•Ñ…¥°µ‰½àˆøœ¬(€€€€€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰É•…Ñ¥½¸µÍ­¥±°µ‘•Ñ…¥°µ¡•…‘•Èˆøœ¬(€€€€€€€€€€€€€€€€€€€€œñ‘¥Ø¥ô‰É•…Ñ¥½¹M­¥±±•Ñ…¥±±åÁ ˆ±…ÍÌô‰É•…Ñ¥½¸µÍ­¥±°µ‘•Ñ…¥°µ±åÁ ˆûš* ğ½‘¥Øøœ¬(€€€€€€€€€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰É•…Ñ¥½¸µÍ­¥±°µ‘•Ñ…¥°µ¡•…‘¥¹œˆøœ¬(€€€€€€€€€€€€€€€€€€€€€€€€œñ‘¥Ø¥ô‰É•…Ñ¥½¹M­¥±±•Ñ…¥±9…µ”ˆ±…ÍÌô‰É•…Ñ¥½¸µÍ­¥±°µ‘•Ñ…¥°µ¹…µ”ˆûš*¢÷’î/Òäğ½‘¥Øøœ¬(€€€€€€€€€€€€€€€€€€€€€€€€œñ‘¥Ø¥ô‰É•…Ñ¥½¹M­¥±±•Ñ…¥±A…Ñ ˆ±…ÍÌô‰É•…Ñ¥½¸µÍ­¥±°µ‘•Ñ…¥°µÁ…Ñ ˆøğ½‘¥Øøœ¬(€€€€€€€€€€€€€€€€€€€€œğ½‘¥Øøœ¬(€€€€€€€€€€€€€€€€€€€€œñ‰ÕÑÑ½¸¥ô‰É•…Ñ¥½¹M­¥±±•Ñ…¥±`ˆ±…ÍÌô‰É•…Ñ¥½¸µÍ­¥±°µ‘•Ñ…¥°µàˆÑåÁ”ô‰‰ÕÑÑ½¸ˆ…É¥„µ±…‰•°ô‹¦^s¦Z'š*¢÷’î/Òäˆû\ğ½‰ÕÑÑ½¸øœ¬(€€€€€€€€€€€€€€€€œğ½‘¥Øøœ¬(€€€€€€€€€€€€€€€€œñ‘¥Ø¥ô‰É•…Ñ¥½¹M­¥±±•Ñ…¥±Q…Ìˆ±…ÍÌô‰É•…Ñ¥½¸µÍ­¥±°µ‘•Ñ…¥°µÑ…Ìˆøğ½‘¥Øøœ¬(€€€€€€€€€€€€€€€€œñ‘¥Ø¥ô‰É•…Ñ¥½¹M­¥±±•Ñ…¥±•ÍÉ¥ÁÑ¥½¸ˆ±…ÍÌô‰É•…Ñ¥½¸µÍ­¥±°µ‘•Ñ…¥°µ‘•ÍÉ¥ÁÑ¥½¸ˆøğ½‘¥Øøœ¬(€€€€€€€€€€€€€€€€œñ‘¥Ø¥ô‰É•…Ñ¥½¹M­¥±±•Ñ…¥±5•Ñ„ˆ±…ÍÌô‰É•…Ñ¥½¸µÍ­¥±°µ‘•Ñ…¥°µµ•Ñ„ˆøğ½‘¥Øøœ¬(€€€€€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰É•…Ñ¥½¸µÍ­¥±°µ‘•Ñ…¥°µÍ•Ñ¥½¸µÑ¥Ñ±”ˆû–B¶'ÒkšVã–ğğ½‘¥Øøœ¬(€€€€€€€€€€€€€€€€œñ‘¥Ø¥ô‰É•…Ñ¥½¹M­¥±±•Ñ…¥±1•Ù•±Ìˆ±…ÍÌô‰É•…Ñ¥½¸µÍ­¥±°µ‘•Ñ…¥°µ±•Ù•±Ìˆøğ½‘¥Øøœ¬(€€€€€€€€€€€€€€€€œñ‰ÕÑÑ½¸¥ô‰É•…Ñ¥½¹M­¥±±•Ñ…¥±±½Í”ˆ±…ÍÌô‰É•…Ñ¥½¸µÍ­¥±°µ‘•Ñ…¥°µ±½Í”ˆÑåÁ”ô‰‰ÕÑÑ½¸ˆû¦^s¦Z$ğ½‰ÕÑÑ½¸øœ¬(€€€€€€€€€€€€œğ½‘¥Øøœì((€€€€€€€½Ù•É±…ä¹…ÁÁ•¹‘¡¥±¡µ½‘…°¤ì((€€€€€€€µ½‘…°¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ±™Õ¹Ñ¥½¸¡•Ù•¹Ğ¥ì(€€€€€€€€€€€¥˜¡•Ù•¹Ğ¹Ñ…É•Ğôôõµ½‘…°¥ì(€€€€€€€€€€€€€€€İ¥¹‘½Ü¹±½Í•É•…Ñ¥½¹M­¥±±•Ñ…¥° ¤ì(€€€€€€€€€€€ô(€€€€€€€ô¤ì((€€€€€€€‰å% ‰É•…Ñ¥½¹M­¥±±•Ñ…¥±`ˆ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ±İ¥¹‘½Ü¹±½Í•É•…Ñ¥½¹M­¥±±•Ñ…¥°¤ì(€€€€€€€‰å% ‰É•…Ñ¥½¹M­¥±±•Ñ…¥±±½Í”ˆ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ±İ¥¹‘½Ü¹±½Í•É•…Ñ¥½¹M­¥±±•Ñ…¥°¤ì(€€€€€€€É•ÑÕÉ¸µ½‘…°ì(€€€ô((€€€±•ĞÉ•…Ñ¥½¹M­¥±±•Ñ…¥±I•ÑÕÉ¹½ÕÌõ¹Õ±°ì((€€€İ¥¹‘½Ü¹Í¡½İÉ•…Ñ¥½¹M­¥±±•Ñ…¥°õ™Õ¹Ñ¥½¸¡Í­¥±±%¥ì(€€€€€€€¥˜¡ÑåÁ•½˜Í­¥±±…Ñ…‰…Í”ôôô‰Õ¹‘•™¥¹•ˆ¥ì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€ô((€€€€€€€½¹ÍĞÍ­¥±°õÍ­¥±±…Ñ…‰…Í•mÍ­¥±±%‘tì(€€€€€€€½¹ÍĞµ½‘…°õ•¹ÍÕÉ•É•…Ñ¥½¹M­¥±±•Ñ…¥±5½‘…° ¤ì(€€€€€€€½¹ÍĞÁ…”õ‰å% ‰É•…Ñ¥½¹A…”ˆ¤ì(€€€€€€€¥˜ …Í­¥±°ñğ€…µ½‘…°ñğ€…Á…”¥ì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€ô((€€€€€€€É•…Ñ¥½¹M­¥±±•Ñ…¥±I•ÑÕÉ¹½ÕÌõ‘½Õµ•¹Ğ¹…Ñ¥Ù•±•µ•¹Ğì(€€€€€€€µ½‘…°¹‘…Ñ…Í•Ğ¹•±•µ•¹ĞõÍ­¥±°¹•±•µ•¹Ññğ‰™¥É”ˆì((€€€€€€€½¹ÍĞ•±•µ•¹Ñ1…‰•±Ìõí™¥É”è‹¬ˆ±İ…Ñ•Èè‹šÂĞˆ±İ¥¹è‹¦Š ˆ±•…ÉÑ è‹–r|‰ôì(€€€€€€€‰å% ‰É•…Ñ¥½¹M­¥±±•Ñ…¥±±åÁ ˆ¤¹Ñ•áÑ½¹Ñ•¹Ğõ•±•µ•¹Ñ1…‰•±ÍmÍ­¥±°¹•±•µ•¹Ñuñğ‹š* ˆì(€€€€€€€‰å% ‰É•…Ñ¥½¹M­¥±±•Ñ…¥±9…µ”ˆ¤¹Ñ•áÑ½¹Ñ•¹ĞõÍ­¥±°¹¹…µ”ì(€€€€€€€‰å% ‰É•…Ñ¥½¹M­¥±±•Ñ…¥±A…Ñ ˆ¤¹Ñ•áÑ½¹Ñ•¹Ğô(€€€€€€€€€€€€¡•±•µ•¹Ñ1…‰•±ÍmÍ­¥±°¹•±•µ•¹Ñuñğ‹–Ò€ˆ¤¬‹Îìƒ
Ü€ˆ¬(€€€€€€€€€€€É•…Ñ¥½¹M­¥±±…Ñ•½Éå1…‰•°¡Í­¥±°¹…Ñ•½Éä¤ì(€€€€€€€‰å% ‰É•…Ñ¥½¹M­¥±±•Ñ…¥±•ÍÉ¥ÁÑ¥½¸ˆ¤¹Ñ•áÑ½¹Ñ•¹ĞõÍ­¥±°¹‘•ÍÉ¥ÁÑ¥½¹ñğˆˆì((€€€€€€€½¹ÍĞÑ…Ìõl(€€€€€€€€€€€É•…Ñ¥½¹M­¥±±…Ñ•½Éå1…‰•°¡Í­¥±°¹…Ñ•½Éä¤°(€€€€€€€€€€€É•…Ñ¥½¹M­¥±±Q…É•Ñ1…‰•°¡Í­¥±°¹Ñ…É•ÑQåÁ”¤°(€€€€€€€€€€€€‹šr¦®`1Ø¸ˆ¬¡Í­¥±°¹µ…á1•Ù•±ñğÄ¤(€€€€€€€tì(€€€€€€€‰å% ‰É•…Ñ¥½¹M­¥±±•Ñ…¥±Q…Ìˆ¤¹¥¹¹•É!Q50õÑ…Ì(€€€€€€€€€€€€¹µ…À¡™Õ¹Ñ¥½¸¡Ñ•áĞ¥ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸€œñÍÁ…¸±…ÍÌô‰É•…Ñ¥½¸µÍ­¥±°µ‘•Ñ…¥°µÑ…œˆøœ­•Í…Á•!Q50¡Ñ•áĞ¤¬œğ½ÍÁ…¸øœì(€€€€€€€€€€€ô¤(€€€€€€€€€€€€¹©½¥¸ ˆˆ¤ì((€€€€€€€½¹ÍĞµ•Ñ„õmtì(€€€€€€€½¹ÍĞÍÁ½ÍĞõÍ­¥±°¹ÍÁ½ÍĞ„ôõÕ¹‘•™¥¹•ıÍ­¥±°¹ÍÁ½ÍĞéÍ­¥±°¹½ÍĞì(€€€€€€€¥˜¡Í­¥±°¹…Ñ•½Éäôôô‰Á…ÍÍ¥Ù”ˆ¥ì(€€€€€€€€€€€µ•Ñ„¹ÁÕÍ  ‹¢Š¯–.Wš*¢÷¾ò3’â7R£¢w–
g¾ò3–¶ãşK–ú3šÂã’æRšV ˆ¤ì(€€€€€€€ô(€€€€€€€•±Í”¥˜¡ÍÁ½ÍĞ„ôõÕ¹‘•™¥¹•¥ì(€€€€€€€€€€€µ•Ñ„¹ÁÕÍ  ‹šÚ#¢\€ˆ­ÍÁ½ÍĞ¬ˆM@ˆ¤ì(€€€€€€€ô(€€€€€€€¥˜¡Í­¥±°¹±•…É¹½ÍĞ„ôõÕ¹‘•™¥¹•¥ì(€€€€€€€€€€€µ•Ñ„¹ÁÕÍ  ‹–¶ãşK¦r¢š€ˆ­Í­¥±°¹±•…É¹½ÍĞ¬ˆƒš*¢÷¦îxˆ¤ì(€€€€€€€ô(€€€€€€€¥˜¡ÉÉ…ä¹¥ÍÉÉ…ä¡Í­¥±°¹É•ÅÕ¥É•Ì¤€˜˜Í­¥±°¹É•ÅÕ¥É•Ì¹±•¹Ñ ¥ì(€€€€€€€€€€€µ•Ñ„¹ÁÕÍ  (€€€€€€€€€€€€€€€€‹–&7ö»š*¢÷¾òhˆ­Í­¥±°¹É•ÅÕ¥É•Ì(€€€€€€€€€€€€€€€€€€€€¹µ…À¡™Õ¹Ñ¥½¸¡¥¥ì(€€€€€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸Í­¥±±…Ñ…‰…Í•m¥‘tıÍ­¥±±…Ñ…‰…Í•m¥‘t¹¹…µ”é¥ì(€€€€€€€€€€€€€€€€€€€ô¤(€€€€€€€€€€€€€€€€€€€€¹©½¥¸ ‹ˆ¤(€€€€€€€€€€€€¤ì(€€€€€€€ô(€€€€€€€‰å% ‰É•…Ñ¥½¹M­¥±±•Ñ…¥±5•Ñ„ˆ¤¹Ñ•áÑ½¹Ñ•¹Ğõµ•Ñ„¹©½¥¸ ‹¾öpˆ¤ì(€€€€€€€‰å% ‰É•…Ñ¥½¹M­¥±±•Ñ…¥±1•Ù•±Ìˆ¤¹¥¹¹•É!Q50õ‰Õ¥±‘É•…Ñ¥½¹M­¥±±1•Ù•±I½İÌ¡Í­¥±°¤ì(€€€€€€€‰å% ‰É•…Ñ¥½¹M­¥±±•Ñ…¥±1•Ù•±Ìˆ¤¹ÍÉ½±±Q½ÀôÀì((€€€€€€€Á…”¹±…ÍÍ1¥ÍĞ¹…‘ ‰É•…Ñ¥½¸µÍ­¥±°µ‘•Ñ…¥°µ½Á•¸ˆ¤ì(€€€€€€€Á…”¹¥¹•ÉĞõÑÉÕ”ì(€€€€€€€Á…”¹Í•ÑÑÑÉ¥‰ÕÑ” ‰…É¥„µ¡¥‘‘•¸ˆ°‰ÑÉÕ”ˆ¤ì(€€€€€€€µ½‘…°¹±…ÍÍ1¥ÍĞ¹…‘ ‰Í¡½Üˆ¤ì(€€€€€€€µ½‘…°¹Í•ÑÑÑÉ¥‰ÕÑ” ‰…É¥„µ¡¥‘‘•¸ˆ°‰™…±Í”ˆ¤ì((€€€€€€€İ¥¹‘½Ü¹Í•ÑQ¥µ•½ÕĞ¡™Õ¹Ñ¥½¸ ¥ì(€€€€€€€€€€€½¹ÍĞ±½Í•	ÕÑÑ½¸õ‰å% ‰É•…Ñ¥½¹M­¥±±•Ñ…¥±`ˆ¤ì(€€€€€€€€€€€¥˜¡±½Í•	ÕÑÑ½¸¥ì(€€€€€€€€€€€€€€€±½Í•	ÕÑÑ½¸¹™½ÕÌ¡íÁÉ•Ù•¹ÑMÉ½±°éÑÉÕ•ô¤ì(€€€€€€€€€€€ô(€€€€€€€ô°À¤ì(€€€ôì((€€€İ¥¹‘½Ü¹±½Í•É•…Ñ¥½¹M­¥±±•Ñ…¥°õ™Õ¹Ñ¥½¸ ¥ì(€€€€€€€½¹ÍĞµ½‘…°õ‰å% ‰É•…Ñ¥½¹M­¥±±•Ñ…¥±5½‘…°ˆ¤ì(€€€€€€€½¹ÍĞÁ…”õ‰å% ‰É•…Ñ¥½¹A…”ˆ¤ì((€€€€€€€¥˜¡µ½‘…°¥ì(€€€€€€€€€€€µ½‘…°¹±…ÍÍ1¥ÍĞ¹É•µ½Ù” ‰Í¡½Üˆ¤ì(€€€€€€€€€€€µ½‘…°¹Í•ÑÑÑÉ¥‰ÕÑ” ‰…É¥„µ¡¥‘‘•¸ˆ°‰ÑÉÕ”ˆ¤ì(€€€€€€€ô((€€€€€€€¥˜¡Á…”¥ì(€€€€€€€€€€€Á…”¹±…ÍÍ1¥ÍĞ¹É•µ½Ù” ‰É•…Ñ¥½¸µÍ­¥±°µ‘•Ñ…¥°µ½Á•¸ˆ¤ì(€€€€€€€€€€€Á…”¹¥¹•ÉĞõ™…±Í”ì(€€€€€€€€€€€Á…”¹É•µ½Ù•ÑÑÉ¥‰ÕÑ” ‰…É¥„µ¡¥‘‘•¸ˆ¤ì(€€€€€€€ô((€€€€€€€½¹ÍĞ™½ÕÍQ…É•ĞõÉ•…Ñ¥½¹M­¥±±•Ñ…¥±I•ÑÕÉ¹½ÕÌì(€€€€€€€É•…Ñ¥½¹M­¥±±•Ñ…¥±I•ÑÕÉ¹½ÕÌõ¹Õ±°ì(€€€€€€€İ¥¹‘½Ü¹Í•ÑQ¥µ•½ÕĞ¡™Õ¹Ñ¥½¸ ¥ì(€€€€€€€€€€€¥˜ (€€€€€€€€€€€€€€€™½ÕÍQ…É•Ğ€˜˜(€€€€€€€€€€€€€€€™½ÕÍQ…É•Ğ¹¥Í½¹¹•Ñ•€˜˜(€€€€€€€€€€€€€€€Á…”€˜˜(€€€€€€€€€€€€€€€İ¥¹‘½Ü¹•Ñ½µÁÕÑ•‘MÑå±”¡Á…”¤¹‘¥ÍÁ±…ä„ôô‰¹½¹”ˆ(€€€€€€€€€€€€¥ì(€€€€€€€€€€€€€€€™½ÕÍQ…É•Ğ¹™½ÕÌ¡íÁÉ•Ù•¹ÑMÉ½±°éÑÉÕ•ô¤ì(€€€€€€€€€€€ô(€€€€€€€ô°À¤ì(€€€ôì((€€€‘½Õµ•¹Ğ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰­•å‘½İ¸ˆ±™Õ¹Ñ¥½¸¡•Ù•¹Ğ¥ì(€€€€€€€½¹ÍĞµ½‘…°õ‰å% ‰É•…Ñ¥½¹M­¥±±•Ñ…¥±5½‘…°ˆ¤ì(€€€€€€€¥˜¡•Ù•¹Ğ¹­•äôôô‰Í…Á”ˆ€˜˜µ½‘…°€˜˜µ½‘…°¹±…ÍÍ1¥ÍĞ¹½¹Ñ…¥¹Ì ‰Í¡½Üˆ¤¥ì(€€€€€€€€€€€•Ù•¹Ğ¹ÁÉ•Ù•¹Ñ•™…Õ±Ğ ¤ì(€€€€€€€€€€€İ¥¹‘½Ü¹±½Í•É•…Ñ¥½¹M­¥±±•Ñ…¥° ¤ì(€€€€€€€ô(€€€ô¤ì((€€€™Õ¹Ñ¥½¸É•¹‘•ÉÉ•…Ñ¥½¹M¡½İ…Í”¡•±•µ•¹Ğ¥ì(€€€€€€€½¹ÍĞÁ…”õ‰å% ‰É•…Ñ¥½¹A…”ˆ¤ì(€€€€€€€¥˜ …Á…”¥íÉ•ÑÕÉ¸íô((€€€€€€€½¹ÍĞ¡½Í•¸õ5Qm•±•µ•¹Ñtı•±•µ•¹Ğè‰™¥É”ˆì(€€€€€€€½¹ÍĞµ•Ñ„õ5Qm¡½Í•¹tì(€€€€€€€Á…”¹‘…Ñ…Í•Ğ¹•±•µ•¹Ğõ¡½Í•¸ì(€€€€€€€Á…”¹‘…Ñ…Í•Ğ¹•¹‘•ÈõÍ•±•Ñ•‘•¹‘•Èì((€€€€€€€½¹ÍĞÁ½ÉÑÉ…¥Ğõ‰å% ‰É•…Ñ¥½¹A½ÉÑÉ…¥Ğˆ¤ì(€€€€€€€¥˜¡Á½ÉÑÉ…¥Ğ¥ì(€€€€€€€€€€€Á½ÉÑÉ…¥Ğ¹ÍÉŒõA=IQI%QMmÍ•±•Ñ•‘•¹‘•Éum¡½Í•¹tì(€€€€€€€€€€€Á½ÉÑÉ…¥Ğ¹…±Ğô¡¡½Í•¸ôôô‰™¥É”ˆü‹¬ˆé¡½Í•¸ôôô‰İ…Ñ•Èˆü‹šÂĞˆé¡½Í•¸ôôô‰İ¥¹ˆü‹¦Š ˆè‹–r|ˆ¤¬(€€€€€€€€€€€€€€€€‹–Ò€ˆ¬¡Í•±•Ñ•‘•¹‘•Èôôô‰µ…±”ˆü‹Rßšœˆè‹––Ïšœˆ¤¬‹¢K¢&Ë®/æ¨ˆì(€€€€€€€ô((€€€€€€€½¹ÍĞ±…‰•±5…Àõí™¥É”è‹¯–Ò€ˆ±İ…Ñ•Èè‹šÂÓ–Ò€ˆ±İ¥¹è‹¦Š£–Ò€ˆ±•…ÉÑ è‹–r–Ò€‰ôì(€€€€€€€¥˜¡‰å% ‰É•…Ñ¥½¹A½ÉÑÉ…¥Ñ±•µ•¹Ğˆ¤¥í‰å% ‰É•…Ñ¥½¹A½ÉÑÉ…¥Ñ±•µ•¹Ğˆ¤¹Ñ•áÑ½¹Ñ•¹Ğõ±…‰•±5…Ám¡½Í•¹tíô(€€€€€€€¥˜¡‰å% ‰É•…Ñ¥½¹A½ÉÑÉ…¥Ñ•¹‘•Èˆ¤¥í‰å% ‰É•…Ñ¥½¹A½ÉÑÉ…¥Ñ•¹‘•Èˆ¤¹Ñ•áÑ½¹Ñ•¹ĞõÍ•±•Ñ•‘•¹‘•Èôôô‰µ…±”ˆü‹–ÂG’ş€ˆè‹––Ï’ş€ˆíô(€€€€€€€¥˜¡‰å% ‰É•…Ñ¥½¹±•µ•¹Ñ	…‘”ˆ¤¥í‰å% ‰É•…Ñ¥½¹±•µ•¹Ñ	…‘”ˆ¤¹Ñ•áÑ½¹Ñ•¹Ğõµ•Ñ„¹±åÁ íô(€€€€€€€¥˜¡‰å% ‰É•…Ñ¥½¹±•µ•¹ÑQ¥Ñ±”ˆ¤¥í‰å% ‰É•…Ñ¥½¹±•µ•¹ÑQ¥Ñ±”ˆ¤¹Ñ•áÑ½¹Ñ•¹Ğõµ•Ñ„¹Ñ¥Ñ±”íô(€€€€€€€¥˜¡‰å% ‰É•…Ñ¥½¹±•µ•¹ÑI½±”ˆ¤¥í‰å% ‰É•…Ñ¥½¹±•µ•¹ÑI½±”ˆ¤¹Ñ•áÑ½¹Ñ•¹Ğõµ•Ñ„¹É½±”íô(€€€€€€€¥˜¡‰å% ‰É•…Ñ¥½¹±•µ•¹Ñ•ÍÉ¥ÁÑ¥½¸ˆ¤¥í‰å% ‰É•…Ñ¥½¹±•µ•¹Ñ•ÍÉ¥ÁÑ¥½¸ˆ¤¹Ñ•áÑ½¹Ñ•¹Ğõµ•Ñ„¹‘•ÍÉ¥ÁÑ¥½¸íô((€€€€€€€½¹ÍĞÑ…Ìõ‰å% ‰É•…Ñ¥½¹±•µ•¹ÑQ…Ìˆ¤ì(€€€€€€€¥˜¡Ñ…Ì¥ì(€€€€€€€€€€€Ñ…Ì¹¥¹¹•É!Q50ôˆˆì(€€€€€€€€€€€µ•Ñ„¹Ñ…Ì¹™½É… ¡™Õ¹Ñ¥½¸¡Ñ•áĞ¥ì(€€€€€€€€€€€€€€€½¹ÍĞÑ…œõ‘½Õµ•¹Ğ¹É•…Ñ•±•µ•¹Ğ ‰ÍÁ…¸ˆ¤ì(€€€€€€€€€€€€€€€Ñ…œ¹±…ÍÍ9…µ”ô‰É•…Ñ¥½¸µÉ½±”µÑ…œˆì(€€€€€€€€€€€€€€€Ñ…œ¹Ñ•áÑ½¹Ñ•¹ĞõÑ•áĞì(€€€€€€€€€€€€€€€Ñ…Ì¹…ÁÁ•¹‘¡¥±¡Ñ…œ¤ì(€€€€€€€€€€€ô¤ì(€€€€€€€ô((€€€ô((€€€İ¥¹‘½Ü¹Í•±•ÑÉ•…Ñ¥½¹•¹‘•Èõ™Õ¹Ñ¥½¸¡•¹‘•È¥ì(€€€€€€€Í•±•Ñ•‘•¹‘•Èõ•¹‘•Èôôô‰µ…±”ˆü‰µ…±”ˆè‰™•µ…±”ˆì((€€€€€€€½¹ÍĞ™•µ…±”õ‰å% ‰É•…Ñ¥½¹•¹‘•É•µ…±”ˆ¤ì(€€€€€€€½¹ÍĞµ…±”õ‰å% ‰É•…Ñ¥½¹•¹‘•É5…±”ˆ¤ì(€€€€€€€¥˜¡™•µ…±”¥í™•µ…±”¹±…ÍÍ1¥ÍĞ¹Ñ½±” ‰Í•±•Ñ•ˆ±Í•±•Ñ•‘•¹‘•Èôôô‰™•µ…±”ˆ¤íô(€€€€€€€¥˜¡µ…±”¥íµ…±”¹±…ÍÍ1¥ÍĞ¹Ñ½±” ‰Í•±•Ñ•ˆ±Í•±•Ñ•‘•¹‘•Èôôô‰µ…±”ˆ¤íô((€€€€€€€±•Ğ•±•µ•¹Ğô‰™¥É”ˆì(€€€€€€€ÑÉåì(€€€€€€€€€€€¥˜¡ÑåÁ•½˜Í•±•Ñ•‘É•…Ñ¥½¹±•µ•¹Ğ„ôô‰Õ¹‘•™¥¹•ˆ€˜˜5QmÍ•±•Ñ•‘É•…Ñ¥½¹±•µ•¹Ñt¥ì(€€€€€€€€€€€€€€€•±•µ•¹ĞõÍ•±•Ñ•‘É•…Ñ¥½¹±•µ•¹Ğì(€€€€€€€€€€€ô(€€€€€€€õ…Ñ ¡•ÉÉ½È¥íô(€€€€€€€É•¹‘•ÉÉ•…Ñ¥½¹M¡½İ…Í”¡•±•µ•¹Ğ¤ì(€€€ôì((€€€€¼¨-••À½¹”Í½ÕÉ”½˜ÑÉÕÑ ™½È•±•µ•¹Ğµ•¡…¹¥ÌèÕÍ”Ñ¡”•á¥ÍÑ¥¹œÍ•±•Ñ±•µ•¹Ğ ¤¸(€€€€€€Q¡¥ÌİÉ…ÁÁ•È½¹±ä…‘‘ÌÑ¡”¹•ÜÉ•…Ñ¥½¸µÁ…”Ù¥ÍÕ…°É•™É•Í ¸€¨¼(€€€¥˜¡ÑåÁ•½˜İ¥¹‘½Ü¹Í•±•Ñ±•µ•¹Ğôôô‰™Õ¹Ñ¥½¸ˆ¥ì(€€€€€€€½¹ÍĞ½É¥¥¹…±M•±•Ñ±•µ•¹Ğõİ¥¹‘½Ü¹Í•±•Ñ±•µ•¹Ğì(€€€€€€€İ¥¹‘½Ü¹Í•±•Ñ±•µ•¹Ğõ™Õ¹Ñ¥½¸¡•±•µ•¹Ğ¥ì(€€€€€€€€€€€½¹ÍĞÉ•ÍÕ±Ğõ½É¥¥¹…±M•±•Ñ±•µ•¹Ğ¹…ÁÁ±ä¡Ñ¡¥Ì±…ÉÕµ•¹ÑÌ¤ì(€€€€€€€€€€€É•¹‘•ÉÉ•…Ñ¥½¹M¡½İ…Í”¡•±•µ•¹Ğ¤ì(€€€€€€€€€€€É•ÑÕÉ¸É•ÍÕ±Ğì(€€€€€€€ôì(€€€ô((€€€€¼¨•¹‘•È¥ÌÁÉ•Í•¹Ñ…Ñ¥½¸½ÁÉ½™¥±”‘…Ñ„½¹±ä¸%Ğ‘½•Ì¹½Ğ…±Ñ•È…¹ä™½ÉµÕ±…Ì¸(€€€€€€ÍÍ¥¸‰•™½É”Ñ¡”•á¥ÍÑ¥¹œÉ•…Ñ•¡…É…Ñ•È ¤Í…Ù•ÌÁ±…å•È¸€¨¼(€€€¥˜¡ÑåÁ•½˜İ¥¹‘½Ü¹É•…Ñ•¡…É…Ñ•Èôôô‰™Õ¹Ñ¥½¸ˆ¥ì(€€€€€€€½¹ÍĞ½É¥¥¹…±É•…Ñ•¡…É…Ñ•Èõİ¥¹‘½Ü¹É•…Ñ•¡…É…Ñ•Èì(€€€€€€€İ¥¹‘½Ü¹É•…Ñ•¡…É…Ñ•Èõ™Õ¹Ñ¥½¸ ¥ì(€€€€€€€€€€€ÑÉåì(€€€€€€€€€€€€€€€¥˜ (€€€€€€€€€€€€€€€€€€€ÑåÁ•½˜Á±…å•È„ôô‰Õ¹‘•™¥¹•ˆ€˜˜(€€€€€€€€€€€€€€€€€€€€ (€€€€€€€€€€€€€€€€€€€€€€€ÑåÁ•½˜É•…Ñ¥½¹Q…É•ÑM±½Ğôôô‰Õ¹‘•™¥¹•ˆñğ(€€€€€€€€€€€€€€€€€€€€€€€É•…Ñ¥½¹Q…É•ÑM±½ĞôôôÄ(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€¥ì(€€€€€€€€€€€€€€€€€€€Á±…å•È¹•¹‘•ÈõÍ•±•Ñ•‘•¹‘•Èì(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€õ…Ñ ¡•ÉÉ½È¥íô(€€€€€€€€€€€ÑÉåì(€€€€€€€€€€€€€€€É•ÑÕÉ¸½É¥¥¹…±É•…Ñ•¡…É…Ñ•È¹…ÁÁ±ä¡Ñ¡¥Ì±…ÉÕµ•¹ÑÌ¤ì(€€€€€€€€€€€õ™¥¹…±±åì(€€€€€€€€€€€€€€€€¼¨ƒ¦¦_¢¶'–’ÇšV_šf–&×¢K¦‚’î7šr¦†¿’ë¾ò3’â7¢÷š>C–&7¦^sš:'š&/š¦–znÓšîG–.W€¨¼(€€€€€€€€€€€€€€€Íå¹É•…Ñ¥½¹Q½Õ¡5½‘” ¤ì(€€€€€€€€€€€ô(€€€€€€€ôì(€€€ô((€€€¥˜¡ÑåÁ•½˜İ¥¹‘½Ü¹Í¡½İÉ•…Ñ¥½¸ôôô‰™Õ¹Ñ¥½¸ˆ¥ì(€€€€€€€½¹ÍĞ½É¥¥¹…±M¡½İÉ•…Ñ¥½¸õİ¥¹‘½Ü¹Í¡½İÉ•…Ñ¥½¸ì(€€€€€€€İ¥¹‘½Ü¹Í¡½İÉ•…Ñ¥½¸õ™Õ¹Ñ¥½¸ ¥ì(€€€€€€€€€€€µ¥É…Ñ•É•…Ñ¥½¹A…•Q½9…Ñ¥Ù•1…å•È ¤ì(€€€€€€€€€€€ÑÉåì(€€€€€€€€€€€€€€€É•ÑÕÉ¸½É¥¥¹…±M¡½İÉ•…Ñ¥½¸¹…ÁÁ±ä¡Ñ¡¥Ì±…ÉÕµ•¹ÑÌ¤ì(€€€€€€€€€€€õ™¥¹…±±åì(€€€€€€€€€€€€€€€Í•ÑÉ•…Ñ¥½¹Q½Õ¡5½‘”¡ÑÉÕ”¤ì(€€€€€€€€€€€€€€€¥¹ÍÑ…±±É•…Ñ¥½¹•ÍÑÕÉ•1½¬ ¤ì(€€€€€€€€€€€€€€€…ÁÁ±åÉ•…Ñ¥½¹MÑ•À Ä¤ì(€€€€€€€€€€€€€€€É•¹‘•ÉÉ•…Ñ¥½¹M¡½İ…Í” (€€€€€€€€€€€€€€€€€€€€¡ÑåÁ•½˜Í•±•Ñ•‘É•…Ñ¥½¹±•µ•¹Ğ„ôô‰Õ¹‘•™¥¹•ˆ€˜˜5QmÍ•±•Ñ•‘É•…Ñ¥½¹±•µ•¹Ñt¤(€€€€€€€€€€€€€€€€€€€€üÍ•±•Ñ•‘É•…Ñ¥½¹±•µ•¹Ğ(€€€€€€€€€€€€€€€€€€€€è€‰™¥É”ˆ(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô(€€€€€€€ôì(€€€ô((€€€€¼¨á¥ÍÑ¥¹œÍ…Ù•Ì‘¼¹½Ğ½¹Ñ…¥¸•¹‘•È¸•™…Õ±Ñ¥¹œÑ¼™•µ…±”¥Ì‰…­İ…Éµ½µÁ…Ñ¥‰±”¸€¨¼(€€€ÑÉåì(€€€€€€€¥˜¡ÑåÁ•½˜Á±…å•È„ôô‰Õ¹‘•™¥¹•ˆ€˜˜Á±…å•È€˜˜€¡Á±…å•È¹•¹‘•Èôôô‰µ…±”ˆñğÁ±…å•È¹•¹‘•Èôôô‰™•µ…±”ˆ¤¥ì(€€€€€€€€€€€Í•±•Ñ•‘•¹‘•ÈõÁ±…å•È¹•¹‘•Èì(€€€€€€€ô(€€€õ…Ñ ¡•ÉÉ½È¥íô((€€€½¹ÍĞ¥¹¥Ñ¥…±±•µ•¹Ğô¡™Õ¹Ñ¥½¸ ¥ì(€€€€€€€ÑÉåì(€€€€€€€€€€€É•ÑÕÉ¸€¡ÑåÁ•½˜Í•±•Ñ•‘É•…Ñ¥½¹±•µ•¹Ğ„ôô‰Õ¹‘•™¥¹•ˆ€˜˜5QmÍ•±•Ñ•‘É•…Ñ¥½¹±•µ•¹Ñt¤(€€€€€€€€€€€€€€€€üÍ•±•Ñ•‘É•…Ñ¥½¹±•µ•¹Ğ(€€€€€€€€€€€€€€€€è€‰™¥É”ˆì(€€€€€€€õ…Ñ ¡•ÉÉ½È¥ì(€€€€€€€€€€€É•ÑÕÉ¸€‰™¥É”ˆì(€€€€€€€ô(€€€ô¤ ¤ì((€€€µ¥É…Ñ•É•…Ñ¥½¹A…•Q½9…Ñ¥Ù•1…å•È ¤ì(€€€¥¹ÍÑ…±±É•…Ñ¥½¹•ÍÑÕÉ•1½¬ ¤ì(€€€…ÁÁ±åÉ•…Ñ¥½¹MÑ•À Ä¤ì(€€€İ¥¹‘½Ü¹Í•±•ÑÉ•…Ñ¥½¹•¹‘•È¡Í•±•Ñ•‘•¹‘•È¤ì(€€€É•¹‘•ÉÉ•…Ñ¥½¹M¡½İ…Í”¡¥¹¥Ñ¥…±±•µ•¹Ğ¤ì(€€€Íå¹É•…Ñ¥½¹Q½Õ¡5½‘” ¤ì((€€€İ¥¹‘½Ü¹•ÑÉ•…Ñ¥½¹9…Ñ¥Ù•1…å½ÕÑ¥…¹½ÍÑ¥Ìõ™Õ¹Ñ¥½¸ ¥ì(€€€€€€€½¹ÍĞÁ…”õµ¥É…Ñ•É•…Ñ¥½¹A…•Q½9…Ñ¥Ù•1…å•È ¤ì(€€€€€€€½¹ÍĞÍ¡•±°õÁ…”€˜˜Á…”¹ÅÕ•ÉåM•±•Ñ½È ˆ¹É•…Ñ¥½¸µÁÉ•µ¥Õ´µÍ¡•±°ˆ¤ì(€€€€€€€¥˜ …Á…”¥íÉ•ÑÕÉ¸¹Õ±°íô(€€€€€€€½¹ÍĞÁ…•MÑå±”õİ¥¹‘½Ü¹•Ñ½µÁÕÑ•‘MÑå±”¡Á…”¤ì(€€€€€€€½¹ÍĞÍ¡•±±MÑå±”õÍ¡•±°ıİ¥¹‘½Ü¹•Ñ½µÁÕÑ•‘MÑå±”¡Í¡•±°¤é¹Õ±°ì(€€€€€€€É•ÑÕÉ¸ì(€€€€€€€€€€€Á…É•¹Ñ%éÁ…”¹Á…É•¹Ñ±•µ•¹ĞıÁ…”¹Á…É•¹Ñ±•µ•¹Ğ¹¥é¹Õ±°°(€€€€€€€€€€€¹…Ñ¥Ù•]¥‘Ñ éÁ…•MÑå±”¹İ¥‘Ñ °(€€€€€€€€€€€¹…Ñ¥Ù•!•¥¡ĞéÁ…•MÑå±”¹¡•¥¡Ğ°(€€€€€€€€€€€ÑÉ…¹Í™½É´éÁ…•MÑå±”¹ÑÉ…¹Í™½É´°(€€€€€€€€€€€½Ù•É™±½İdéÁ…•MÑå±”¹½Ù•É™±½İd°(€€€€€€€€€€€Á½¥¹Ñ•ÉÙ•¹ÑÌéÁ…•MÑå±”¹Á½¥¹Ñ•ÉÙ•¹ÑÌ°(€€€€€€€€€€€Í¡•±±A…‘‘¥¹œéÍ¡•±±MÑå±”ıÍ¡•±±MÑå±”¹Á…‘‘¥¹œé¹Õ±°°(€€€€€€€€€€€µ¥É…Ñ¥½¸éÁ…”¹‘…Ñ…Í•Ğ¹¹…Ñ¥Ù•5¥É…Ñ¥½¹ññ¹Õ±°°(€€€€€€€€€€€ÁÉ•Á…¥¹ĞéÁ…”¹‘…Ñ…Í•Ğ¹¹…Ñ¥Ù•AÉ•Á…¥¹Ñññ¹Õ±°°(€€€€€€€€€€€™¥á•‘5½‘”é‘½Õµ•¹Ğ¹‘½Õµ•¹Ñ±•µ•¹Ğ¹±…ÍÍ1¥ÍĞ¹½¹Ñ…¥¹Ì ‰É•…Ñ¥½¸µ™¥á•µ…Ñ¥Ù”ˆ¤°(€€€€€€€€€€€ÍÑ•ÀéÍ•±•Ñ•‘É•…Ñ¥½¹MÑ•À°(€€€€€€€€€€€Í­¥±±AÉ•Ù¥•İAÉ•Í•¹Ğè„…‰å% ‰É•…Ñ¥½¹A¡åÍ¥…±M­¥±±Ìˆ¤(€€€€€€€ôì(€€€ôì((€€€€¼¨ƒ²³’ê3¾ò?’â'¢K¢&Ë–ÇR£–&×¢K¦‚šf¾ò3–>[šÚ#š"[–º3š"C–ú3’æ¢š¢÷’âï–.W¢¦f(€€€€€€¹‘É½¥ƒj–në–ºk–&×¢Kš&/–.‹š¢‡–ò?€¨¼(€€€İ¥¹‘½Ü¹Íå¹É•…Ñ¥½¹Q½Õ¡5½‘”õÍå¹É•…Ñ¥½¹Q½Õ¡5½‘”ì((€€€€¼¨9¼5ÕÑ…Ñ¥½¹=‰Í•ÉÙ•È€¼•áÑÉ„Ñ½Õ ±¥ÍÑ•¹•ÉÌ¸(€€€€€€Í•½¹Íå¹Œ…™Ñ•ÈÕÉÉ•¹Ğ…±°ÍÑ…¬½Ù•ÉÌ±½…‘…µ” ¤Ñ¥µ¥¹œÍ…™•±ä¸€¨¼(€€€İ¥¹‘½Ü¹Í•ÑQ¥µ•½ÕĞ¡Íå¹É•…Ñ¥½¹Q½Õ¡5½‘”°À¤ì)ô¤ ¤ì(((¼¨‰Õ¹‘±•Í½ÕÉ”è©Ì¼ÈÀµ…¹½¹åµ½ÕÌ´ÈÀ¹©Ì€¨¼(¼¨É¥Ñ¥…°½™•…ÑÕÉ”‰½Õ¹‘…Éä½İ¹•È¸9¼±½‰…°¥¹ÁÕĞ±½¬…¹¹¼¹•Ñİ½É¬µ½É‘•ÈÁ…Ñ ¡…¥¸¸€¨¼)½¹ÍĞY}MMQ}YIM%=8ôˆÄÜÌ¸Øäˆì((¡™Õ¹Ñ¥½¸¥¹ÍÑ…±±•…ÑÕÉ•%¹Ñ•¹Ñ	½Õ¹‘…Éä ¥ì(€€€€‰ÕÍ”ÍÑÉ¥Ğˆì(€€€¥˜¡İ¥¹‘½Ü¹}}™½ÕÉMåµ‰½±Í•…ÑÕÉ•%¹Ñ•¹Ñ%¹ÍÑ…±±•¥ìÉ•ÑÕÉ¸ìô(€€€İ¥¹‘½Ü¹}}™½ÕÉMåµ‰½±Í•…ÑÕÉ•%¹Ñ•¹Ñ%¹ÍÑ…±±•õÑÉÕ”ì((€€€½¹ÍĞÉÕ±•Ìõl(€€€€€€€íÁ…ÑÑ•É¸è½Í¡½İA…•p¡lœ‰uµ…Áñ½Á•¹5…ÁñÁ…ÑÉ½°½¤±™•…ÑÕÉ”è‰Á…ÑÉ½°ˆ±±…‰•°è‹–Ş‡š¨‰ô°(€€€€€€€íÁ…ÑÑ•É¸è½Í¡½İA…•p¡lœ‰u¥¹Ù•¹Ñ½Éåñ½Á•¸¸©¥¹Ù•¹Ñ½Éåñ‰…­Á…¬½¤±™•…ÑÕÉ”è‰¥¹Ù•¹Ñ½Éäˆ±±…‰•°è‹¢3–2‰ô°(€€€€€€€íÁ…ÑÑ•É¸è½•ÅÕ¥Áµ•¹ÑñÉ•™½É”½¤±™•…ÑÕÉ”è‰•ÅÕ¥Áµ•¹Ğˆ±±…‰•°è‹¢w–
d‰ô°(€€€€€€€íÁ…ÑÑ•É¸è½Í¡½İA…•p¡lœ‰u‘Õ¹•½¹ñ‘Õ¹•½¸½¤±™•…ÑÕÉ”è‰‘Õ¹•½¸ˆ±±…‰•°è‹–&¿šr°‰ô°(€€€€€€€íÁ…ÑÑ•É¸è½…‰åÍÌ½¤±™•…ÑÕÉ”è‰…‰åÍÌˆ±±…‰•°è‹šŞÇšŞÔ‰ô°(€€€€€€€íÁ…ÑÑ•É¸è½‰½ÍÍñÑ½İ•È½¤±™•…ÑÕÉ”è‰‰½ÍÌµÑ½İ•Èˆ±±…‰•°è‹–no¢Æ‡–†P‰ô°(€€€€€€€íÁ…ÑÑ•É¸è½É•±¥Œ½¤±™•…ÑÕÉ”è‰É•±¥Œˆ±±…‰•°è‹c–¾Ø‰ô°(€€€€€€€íÁ…ÑÑ•É¸è½Í­¥±°½¤±™•…ÑÕÉ”è‰Í­¥±°ˆ±±…‰•°è‹š*¢ô‰ô°(€€€€€€€íÁ…ÑÑ•É¸è½Í¡½À½¤±™•…ÑÕÉ”è‰Í¡½Àˆ±±…‰•°è‹–V–ê\‰ô°(€€€€€€€íÁ…ÑÑ•É¸è½Íå¹Ñ ½¤±™•…ÑÕÉ”è‰Íå¹Ñ¡•Í¥Ìˆ±±…‰•°è‹–B#š"@‰ô°(€€€€€€€íÁ…ÑÑ•É¸è½‰…ÑÑ±”½¤±™•…ÑÕÉ”è‰‰…ÑÑ±”ˆ±±…‰•°è‹š"Ã¦²”‰ô(€€€tì(€€€™Õ¹Ñ¥½¸Ñ…É•Ğ¡•Ù•¹Ğ¥ìÉ•ÑÕÉ¸•Ù•¹Ğ¹Ñ…É•Ğ˜™•Ù•¹Ğ¹Ñ…É•Ğ¹±½Í•ÍĞ˜™•Ù•¹Ğ¹Ñ…É•Ğ¹±½Í•ÍĞ ‰‰ÕÑÑ½¸±„±m‘…Ñ„µ™•…ÑÕÉ•tˆ¤ìô(€€€™Õ¹Ñ¥½¸¥ÍáÁA½½±%¹Ñ•É…Ñ¥½¸¡•±•µ•¹Ğ¥ì(€€€€€€€É•ÑÕÉ¸€„„¡•±•µ•¹Ğ˜™•±•µ•¹Ğ¹±½Í•ÍĞ˜™•±•µ•¹Ğ¹±½Í•ÍĞ ˆ¡½µ•áÁA½½±…Éˆ¤¤ì(€€€ô(€€€™Õ¹Ñ¥½¸‘•ÍÉ¥ÁÑ½È¡•±•µ•¹Ğ¥ì(€€€€€€€¥˜ …•±•µ•¹Ğ¥ìÉ•ÑÕÉ¸¹Õ±°ìô(€€€€€€€€¼¨ƒÚO¦¦_šÆƒšr³¢ê¯–Æ³šZó’âï–~8…ÁÀµÍ¡•±³¾ò3’ö3¦‚C¢š÷–6Òk¾ò/’ê3š²‡Šë¢ª75½İ¹•Èƒ–r (€€€€€€€€€€…µ•Á±…äµ½É—¢«–úx…µ•Á±…äµ½É”ƒšRçš"@±…éäƒ–ú3¾ò3¢.—’â7–#¢ò'–”½İ¹•Ë¾ò0(€€€€€€€€€€ƒ¢"+j–6Ïšf–"¦7š2'¦"W–ÂÇ–>¿¢÷–r£¦bË–F–º'¢w–&7¢Š¯¦î{–"Ã€¨¼(€€€€€€€¥˜¡¥ÍáÁA½½±%¹Ñ•É…Ñ¥½¸¡•±•µ•¹Ğ¤¥ì(€€€€€€€€€€€É•ÑÕÉ¸í™•…ÑÕÉ”è‰‰…ÑÑ±”ˆ±±…‰•°è‹ÚO¦¦_šÆƒ–º'–£–6Òhˆ±•áÁA½½°éÑÉÕ•ôì(€€€€€€€ô(€€€€€€€½¹ÍĞ•áÁ±¥¥Ğõ•±•µ•¹Ğ¹‘…Ñ…Í•Ğ˜™•±•µ•¹Ğ¹‘…Ñ…Í•Ğ¹™•…ÑÕÉ”ì(€€€€€€€¥˜¡•áÁ±¥¥Ğ¥ìÉ•ÑÕÉ¸í™•…ÑÕÉ”é•áÁ±¥¥Ğ±±…‰•°é•±•µ•¹Ğ¹•ÑÑÑÉ¥‰ÕÑ” ‰…É¥„µ±…‰•°ˆ¥ññ•±•µ•¹Ğ¹Ñ•áÑ½¹Ñ•¹Ñññ•áÁ±¥¥Ñôìô(€€€€€€€½¹ÍĞÍ¥¹…ÑÕÉ”õm•±•µ•¹Ğ¹¥±•±•µ•¹Ğ¹±…ÍÍ9…µ”±•±•µ•¹Ğ¹•ÑÑÑÉ¥‰ÕÑ”˜™•±•µ•¹Ğ¹•ÑÑÑÉ¥‰ÕÑ” ‰½¹±¥¬ˆ¤±•±•µ•¹Ğ¹Ñ•áÑ½¹Ñ•¹Ñt¹©½¥¸ ˆ€ˆ¤ì(€€€€€€€É•ÑÕÉ¸ÉÕ±•Ì¹™¥¹¡ÉÕ±”ôùÉÕ±”¹Á…ÑÑ•É¸¹Ñ•ÍĞ¡Í¥¹…ÑÕÉ”¤¥ññ¹Õ±°ì(€€€ô(€€€™Õ¹Ñ¥½¸±½…‘•È ¥ìÉ•ÑÕÉ¸İ¥¹‘½Ü¹½ÕÉMåµ‰½±Í•…ÑÕÉ•Ììô(€€€™Õ¹Ñ¥½¸Í•Ñ1½…±1½…‘¥¹œ¡•±•µ•¹Ğ±…Ñ¥Ù”±±…‰•°¥ì(€€€€€€€¥˜ …•±•µ•¹Ğ¥ìÉ•ÑÕÉ¸ìô(€€€€€€€•±•µ•¹Ğ¹±…ÍÍ1¥ÍĞ¹Ñ½±” ‰¥Ìµ™•…ÑÕÉ”µ±½…‘¥¹œˆ±…Ñ¥Ù”¤ì(€€€€€€€•±•µ•¹Ğ¹Í•ÑÑÑÉ¥‰ÕÑ” ‰…É¥„µ‰ÕÍäˆ±…Ñ¥Ù”ü‰ÑÉÕ”ˆè‰™…±Í”ˆ¤ì(€€€€€€€¥˜¡…Ñ¥Ù”¥ì•±•µ•¹Ğ¹‘…Ñ…Í•Ğ¹™•…ÑÕÉ•1½…‘¥¹1…‰•°ô‹š¶–r£¢ò'–”ˆ¬¡±…‰•±ñğ‹–*¢ôˆ¤¬‹Š˜ˆìô(€€€€€€€•±Í•ì‘•±•Ñ”•±•µ•¹Ğ¹‘…Ñ…Í•Ğ¹™•…ÑÕÉ•1½…‘¥¹1…‰•°ìô(€€€ô((€€€±•Ğ•áÁA½½±AÉ¥µ•AÉ½µ¥Í”õ¹Õ±°ì(€€€±•Ğ•áÁA½½±M…™•ÑåU¥I•…‘äõ™…±Í”ì(€€€™Õ¹Ñ¥½¸É•™É•Í¡áÁA½½±M…™•ÑåU¥=¹” ¥ì(€€€€€€€¥˜¡•áÁA½½±M…™•ÑåU¥I•…‘ä¥ìÉ•ÑÕÉ¸ìô(€€€€€€€•áÁA½½±M…™•ÑåU¥I•…‘äõÑÉÕ”ì(€€€€€€€¥˜¡ÑåÁ•½˜İ¥¹‘½Ü¹É•¹‘•ÉáÁ¥ÍÑÉ¥‰ÕÑ•1¥ÍĞôôô‰™Õ¹Ñ¥½¸ˆ¥ì(€€€€€€€€€€€İ¥¹‘½Ü¹É•¹‘•ÉáÁ¥ÍÑÉ¥‰ÕÑ•1¥ÍĞ ¤ì(€€€€€€€ô(€€€€€€€¥˜¡ÑåÁ•½˜İ¥¹‘½Ü¹ØÄÜÍ•½É…Ñ•áÁA½½±¥ÍÑÉ¥‰ÕÑ¥½¹U¤ôôô‰™Õ¹Ñ¥½¸ˆ¥ì(€€€€€€€€€€€İ¥¹‘½Ü¹ØÄÜÍ•½É…Ñ•áÁA½½±¥ÍÑÉ¥‰ÕÑ¥½¹U¤ ¤ì(€€€€€€€ô(€€€€€€€½¹ÍĞÁ½½°õ‘½Õµ•¹Ğ¹•Ñ±•µ•¹Ñ	å% ‰¡½µ•áÁA½½±…Éˆ¤ì(€€€€€€€¥˜¡Á½½°¥ìÁ½½°¹‘…Ñ…Í•Ğ¹•áÁM…™•Ñå=İ¹•Èô‰É•…‘äˆìô(€€€ô(€€€™Õ¹Ñ¥½¸ÁÉ¥µ•áÁA½½±M…™•Ñä ¥ì(€€€€€€€½¹ÍĞÁ½½°õ‘½Õµ•¹Ğ¹•Ñ±•µ•¹Ñ	å% ‰¡½µ•áÁA½½±…Éˆ¤ì(€€€€€€€½¹ÍĞ…Á¤õ±½…‘•È ¤ì(€€€€€€€¥˜ …Á½½±ñğ……Á¤¥ìÉ•ÑÕÉ¸ìô(€€€€€€€½¹ÍĞÙ¥Í¥‰±”ô…Á½½°¹¡¥‘‘•¸˜™İ¥¹‘½Ü¹•Ñ½µÁÕÑ•‘MÑå±”¡Á½½°¤¹‘¥ÍÁ±…ä„ôô‰¹½¹”ˆ˜™Á½½°¹•Ñ±¥•¹ÑI•ÑÌ ¤¹±•¹Ñ øÀì(€€€€€€€¥˜ …Ù¥Í¥‰±”¥ìÉ•ÑÕÉ¸ìô(€€€€€€€¥˜¡…Á¤¹¥ÍI•…‘ä ‰‰…ÑÑ±”ˆ¤¥ì(€€€€€€€€€€€É•™É•Í¡áÁA½½±M…™•ÑåU¥=¹” ¤ì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€ô(€€€€€€€¥˜¡•áÁA½½±AÉ¥µ•AÉ½µ¥Í”¥ìÉ•ÑÕÉ¸ìô(€€€€€€€Í•Ñ1½…±1½…‘¥¹œ¡Á½½°±ÑÉÕ”°‹ÚO¦¦_šÆƒ–º'–£–6Òhˆ¤ì(€€€€€€€•áÁA½½±AÉ¥µ•AÉ½µ¥Í”õ…Á¤¹•¹ÍÕÉ” ‰‰…ÑÑ±”ˆ°‰•áÀµÁ½½°µÍ…™•Ñäˆ¤¹Ñ¡•¸  ¤ôùì(€€€€€€€€€€€Í•Ñ1½…±1½…‘¥¹œ¡Á½½°±™…±Í”¤ì(€€€€€€€€€€€É•™É•Í¡áÁA½½±M…™•ÑåU¥=¹” ¤ì(€€€€€€€ô¤¹…Ñ ¡•ÉÉ½Èôùì(€€€€€€€€€€€Í•Ñ1½…±1½…‘¥¹œ¡Á½½°±™…±Í”¤ì(€€€€€€€€€€€½¹Í½±”¹•ÉÉ½È ‰a@Á½½°Í…™•Ñä½İ¹•È™…¥±•Ñ¼±½…èˆ±•ÉÉ½È¤ì(€€€€€€€€€€€‘½Õµ•¹Ğ¹‘¥ÍÁ…Ñ¡Ù•¹Ğ¡¹•ÜÕÍÑ½µÙ•¹Ğ ‰™½ÕÈµÍåµ‰½±Ìé™•…ÑÕÉ”µ±½…°µ•ÉÉ½Èˆ±í‘•Ñ…¥°éí™•…ÑÕÉ”è‰‰…ÑÑ±”ˆ±•ÉÉ½Éõô¤¤ì(€€€€€€€ô¤¹™¥¹…±±ä  ¤ôùì•áÁA½½±AÉ¥µ•AÉ½µ¥Í”õ¹Õ±°ìô¤ì(€€€ô(€€€™Õ¹Ñ¥½¸ÁÉ•™•Ñ ¡•Ù•¹Ğ¥ì(€€€€€€€½¹ÍĞ•±•µ•¹ĞõÑ…É•Ğ¡•Ù•¹Ğ¤ì½¹ÍĞ¥¹™¼õ‘•ÍÉ¥ÁÑ½È¡•±•µ•¹Ğ¤ì½¹ÍĞ…Á¤õ±½…‘•È ¤ì(€€€€€€€¥˜¡¥¹™¼˜™…Á¤˜˜……Á¤¹¥ÍI•…‘ä¡¥¹™¼¹™•…ÑÕÉ”¤¥ìÙ½¥…Á¤¹ÁÉ•™•Ñ ¡¥¹™¼¹™•…ÑÕÉ”±•Ù•¹Ğ¹ÑåÁ”¤ìô(€€€ô(€€€™Õ¹Ñ¥½¸•¹Ñ•È¡•Ù•¹Ğ¥ì(€€€€€€€½¹ÍĞ•±•µ•¹ĞõÑ…É•Ğ¡•Ù•¹Ğ¤ì½¹ÍĞ¥¹™¼õ‘•ÍÉ¥ÁÑ½È¡•±•µ•¹Ğ¤ì½¹ÍĞ…Á¤õ±½…‘•È ¤ì(€€€€€€€¥˜ …¥¹™½ñğ……Á¥ññ…Á¤¹¥ÍI•…‘ä¡¥¹™¼¹™•…ÑÕÉ”¥ññ•±•µ•¹Ğ¹‘…Ñ…Í•Ğ¹™•…ÑÕÉ•I•Á±…äôôôˆÄˆ¥ìÉ•ÑÕÉ¸ìô(€€€€€€€•Ù•¹Ğ¹ÁÉ•Ù•¹Ñ•™…Õ±Ğ ¤ì•Ù•¹Ğ¹ÍÑ½Á%µµ•‘¥…Ñ•AÉ½Á……Ñ¥½¸ ¤ì(€€€€€€€¥˜¡•±•µ•¹Ğ¹‘…Ñ…Í•Ğ¹™•…ÑÕÉ•1½…‘¥¹œôôôˆÄˆ¥ìÉ•ÑÕÉ¸ìô(€€€€€€€•±•µ•¹Ğ¹‘…Ñ…Í•Ğ¹™•…ÑÕÉ•1½…‘¥¹œôˆÄˆìÍ•Ñ1½…±1½…‘¥¹œ¡•±•µ•¹Ğ±ÑÉÕ”±¥¹™¼¹±…‰•°¤ì(€€€€€€€…Á¤¹•¹ÍÕÉ”¡¥¹™¼¹™•…ÑÕÉ”±¥¹™¼¹•áÁA½½°ü‰•áÀµÁ½½°µÍ…™•Ñäˆè‰¹…Ù¥…Ñ¥½¸ˆ¤¹Ñ¡•¸  ¤ôùì(€€€€€€€€€€€‘•±•Ñ”•±•µ•¹Ğ¹‘…Ñ…Í•Ğ¹™•…ÑÕÉ•1½…‘¥¹œìÍ•Ñ1½…±1½…‘¥¹œ¡•±•µ•¹Ğ±™…±Í”¤ì(€€€€€€€€€€€¥˜¡¥¹™¼¹•áÁA½½°¥ì(€€€€€€€€€€€€€€€€¼¨ƒ’â4É•Á±…äƒ¢"(=4ƒ’â+–>¿¢÷’î7š2–BD¥µµ•‘¥…Ñ”‘¥ÍÑÉ¥‰ÕÑ”ƒj¡…¹‘±•Ë(€€€€€€€€€€€€€€€€€€ƒ–#RÇš¶–ò<½İ¹•Èƒ¦7æ«š"C3¦‚C¢šôƒŠHƒŠë¢ª75U'¾ò3:§–ºÛ–7¦î{’âš²‡š&7šr¢*ÄaC€¨¼(€€€€€€€€€€€€€€€É•™É•Í¡áÁA½½±M…™•ÑåU¥=¹” ¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€€€€€ô(€€€€€€€€€€€•±•µ•¹Ğ¹‘…Ñ…Í•Ğ¹™•…ÑÕÉ•I•Á±…äôˆÄˆì•±•µ•¹Ğ¹±¥¬ ¤ì‘•±•Ñ”•±•µ•¹Ğ¹‘…Ñ…Í•Ğ¹™•…ÑÕÉ•I•Á±…äì(€€€€€€€ô¤¹…Ñ ¡•ÉÉ½Èôùì(€€€€€€€€€€€‘•±•Ñ”•±•µ•¹Ğ¹‘…Ñ…Í•Ğ¹™•…ÑÕÉ•1½…‘¥¹œìÍ•Ñ1½…±1½…‘¥¹œ¡•±•µ•¹Ğ±™…±Í”¤ì(€€€€€€€€€€€½¹Í½±”¹•ÉÉ½È ‰•…ÑÕÉ”™…¥±•Ñ¼±½…èˆ±¥¹™¼¹™•…ÑÕÉ”±•ÉÉ½È¤ì(€€€€€€€€€€€‘½Õµ•¹Ğ¹‘¥ÍÁ…Ñ¡Ù•¹Ğ¡¹•ÜÕÍÑ½µÙ•¹Ğ ‰™½ÕÈµÍåµ‰½±Ìé™•…ÑÕÉ”µ±½…°µ•ÉÉ½Èˆ±í‘•Ñ…¥°éí™•…ÑÕÉ”é¥¹™¼¹™•…ÑÕÉ”±•ÉÉ½Éõô¤¤ì(€€€€€€€ô¤ì(€€€ô(€€€‘½Õµ•¹Ğ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰Á½¥¹Ñ•É‘½İ¸ˆ±ÁÉ•™•Ñ ±í…ÁÑÕÉ”éÑÉÕ”±Á…ÍÍ¥Ù”éÑÉÕ•ô¤ì(€€€‘½Õµ•¹Ğ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰Ñ½Õ¡ÍÑ…ÉĞˆ±ÁÉ•™•Ñ ±í…ÁÑÕÉ”éÑÉÕ”±Á…ÍÍ¥Ù”éÑÉÕ•ô¤ì(€€€‘½Õµ•¹Ğ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ±•¹Ñ•È±ÑÉÕ”¤ì(€€€‘½Õµ•¹Ğ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ° ¤ôùÍ•ÑQ¥µ•½ÕĞ¡ÁÉ¥µ•áÁA½½±M…™•Ñä°À¤±ÑÉÕ”¤ì(€€€‘½Õµ•¹Ğ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰™½ÕÈµÍåµ‰½±ÌéÍÑ…ÉÑÕÀµÉ•…‘äˆ° ¤ôùì(€€€€€€€€¼¨Q¡”Í½±”•…ÑÕÉ”1½…‘•È…Á¤¹¥‘±” ¤½İ¹•ÈÍÑ…ÉÑÌÑ¡¥Ì±½ÜµÁÉ¥½É¥ÑäÅÕ•Õ”¸€¨¼(€€€€€€€½¹ÍĞ…Á¤õ±½…‘•È ¤ì(€€€€€€€¥˜¡…Á¤¥ì(€€€€€€€€€€€ÑÉåí¥˜¡Á•É™½Éµ…¹”˜™ÑåÁ•½˜Á•É™½Éµ…¹”¹µ…É¬ôôô‰™Õ¹Ñ¥½¸ˆ¥íÁ•É™½Éµ…¹”¹µ…É¬ ‰™½ÕÈµÍåµ‰½±Ìé‰…­É½Õ¹µÁÉ•™•Ñ µÍÑ…ÉĞˆ¤íõõ…Ñ ¡|¥ìô(€€€€€€€€€€€…Á¤¹¥‘±”¡l‰¥¹Ù•¹Ñ½Éäˆ°‰Í¡½Àˆ°‰•ÅÕ¥Áµ•¹Ğˆ°‰Íå¹Ñ¡•Í¥Ìˆ°‰É•±¥Œ‰t±l‰É•±¥%½¹Ì‰t¤¹Ñ¡•¸¡É•ÍÕ±Ğôùì(€€€€€€€€€€€€€€€ÑÉåí¥˜¡ÉÉ…ä¹¥ÍÉÉ…ä¡É•ÍÕ±Ğ¤˜™É•ÍÕ±Ğ¹…Ğ ´Ä¤˜™Á•É™½Éµ…¹”˜™ÑåÁ•½˜Á•É™½Éµ…¹”¹µ…É¬ôôô‰™Õ¹Ñ¥½¸ˆ¥íÁ•É™½Éµ…¹”¹µ…É¬ ‰™½ÕÈµÍåµ‰½±ÌéÉ•±¥ŒµÁÉ•™•Ñ µÉ•…‘äˆ¤íõõ…Ñ ¡|¥ìô(€€€€€€€€€€€€€€€É•ÑÕÉ¸…Á¤¹¥‘±”¡l‰Á…ÑÉ½°ˆ°‰Í­¥±°‰t¤ì(€€€€€€€€€€€ô¤¹Ñ¡•¸  ¤ôùíÑÉåí¥˜¡Á•É™½Éµ…¹”˜™ÑåÁ•½˜Á•É™½Éµ…¹”¹µ…É¬ôôô‰™Õ¹Ñ¥½¸ˆ¥íÁ•É™½Éµ…¹”¹µ…É¬ ‰™½ÕÈµÍåµ‰½±Ìé‰…­É½Õ¹µÁÉ•™•Ñ µ¥‘±”ˆ¤íõõ…Ñ ¡|¥ìõô¤ì(€€€€€€€ô(€€€€€€€ÁÉ¥µ•áÁA½½±M…™•Ñä ¤ì(€€€ô±í½¹”éÑÉÕ•ô¤ì((€€€™Õ¹Ñ¥½¸¥¹ÍÑ…±±áÁA½½±Y¥Í¥‰¥±¥Ñå=‰Í•ÉÙ•È ¥ì(€€€€€€€¥˜ …‘½Õµ•¹Ğ¹‰½‘åññÑåÁ•½˜5ÕÑ…Ñ¥½¹=‰Í•ÉÙ•Èôôô‰Õ¹‘•™¥¹•ˆ¥ìÉ•ÑÕÉ¸ìô(€€€€€€€½¹ÍĞ½‰Í•ÉÙ•Èõ¹•Ü5ÕÑ…Ñ¥½¹=‰Í•ÉÙ•È  ¤ôùì(€€€€€€€€€€€¥˜¡•áÁA½½±M…™•ÑåU¥I•…‘ä¥ìÉ•ÑÕÉ¸ìô(€€€€€€€€€€€ÁÉ¥µ•áÁA½½±M…™•Ñä ¤ì(€€€€€€€ô¤ì(€€€€€€€½‰Í•ÉÙ•È¹½‰Í•ÉÙ”¡‘½Õµ•¹Ğ¹‰½‘ä±íÍÕ‰ÑÉ•”éÑÉÕ”±¡¥±‘1¥ÍĞéÑÉÕ”±…ÑÑÉ¥‰ÕÑ•ÌéÑÉÕ”±…ÑÑÉ¥‰ÕÑ•¥±Ñ•Èél‰±…ÍÌˆ°‰ÍÑå±”ˆ°‰¡¥‘‘•¸‰uô¤ì(€€€€€€€ÁÉ¥µ•áÁA½½±M…™•Ñä ¤ì(€€€ô(€€€¥˜¡‘½Õµ•¹Ğ¹É•…‘åMÑ…Ñ”ôôô‰±½…‘¥¹œˆ¥ì(€€€€€€€‘½Õµ•¹Ğ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰=5½¹Ñ•¹Ñ1½…‘•ˆ±¥¹ÍÑ…±±áÁA½½±Y¥Í¥‰¥±¥Ñå=‰Í•ÉÙ•È±í½¹”éÑÉÕ•ô¤ì(€€€õ•±Í•ì(€€€€€€€¥¹ÍÑ…±±áÁA½½±Y¥Í¥‰¥±¥Ñå=‰Í•ÉÙ•È ¤ì(€€€ô)ô¤ ¤ì((¡™Õ¹Ñ¥½¸¥¹¥Ñ	…ÑÑ±•±•µ•¹Ñ	½áÉ…œ ¥ì(€€€™Õ¹Ñ¥½¸‰¥¹ ¥ì(€€€€€€€½¹ÍĞ‰ÕÑÑ½¸õ‘½Õµ•¹Ğ¹•Ñ±•µ•¹Ñ	å% ‰‰…ÑÑ±•±•µ•¹Ñ	½á	ÕÑÑ½¸ˆ¤ì(€€€€€€€½¹ÍĞÁ…”õ‘½Õµ•¹Ğ¹•Ñ±•µ•¹Ñ	å% ‰‰…ÑÑ±•A…”ˆ¤ì(€€€€€€€¥˜ …‰ÕÑÑ½¹ñğ…Á…•ññ‰ÕÑÑ½¸¹‘…Ñ…Í•Ğ¹‘É…I•…‘äôôôˆÄˆ¥ìÉ•ÑÕÉ¸ìô(€€€€€€€‰ÕÑÑ½¸¹‘…Ñ…Í•Ğ¹‘É…I•…‘äôˆÄˆì(€€€€€€€±•Ğ‘É…œõ¹Õ±°ì±•ĞÍÕÁÁÉ•ÍÍ±¥¬õ™…±Í”ì½¹ÍĞÑ¡É•Í¡½±ôÔì(€€€€€€€™Õ¹Ñ¥½¸±½¥…±M…±” ¥ì(€€€€€€€€€€€½¹ÍĞÉ•ĞõÁ…”¹•Ñ	½Õ¹‘¥¹±¥•¹ÑI•Ğ ¤ì(€€€€€€€€€€€É•ÑÕÉ¸íÉ•Ğ±ÍàéÉ•Ğ¹İ¥‘Ñ ıÁ…”¹±¥•¹Ñ]¥‘Ñ ½É•Ğ¹İ¥‘Ñ èÄ±ÍäéÉ•Ğ¹¡•¥¡ĞıÁ…”¹±¥•¹Ñ!•¥¡Ğ½É•Ğ¹¡•¥¡ĞèÅôì(€€€€€€€ô(€€€€€€€‰ÕÑÑ½¸¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰Á½¥¹Ñ•É‘½İ¸ˆ±•Ù•¹Ğôùì(€€€€€€€€€€€¥˜¡•Ù•¹Ğ¹Á½¥¹Ñ•ÉQåÁ”ôôô‰µ½ÕÍ”ˆ˜™•Ù•¹Ğ¹‰ÕÑÑ½¸„ôôÀ¥ìÉ•ÑÕÉ¸ìô(€€€€€€€€€€€½¹ÍĞÍ…±”õ±½¥…±M…±” ¤ì½¹ÍĞ‰½Õ¹‘Ìõ‰ÕÑÑ½¸¹•Ñ	½Õ¹‘¥¹±¥•¹ÑI•Ğ ¤ì(€€€€€€€€€€€‘É…œõíÁ½¥¹Ñ•É%é•Ù•¹Ğ¹Á½¥¹Ñ•É%±àé•Ù•¹Ğ¹±¥•¹Ñ`±äé•Ù•¹Ğ¹±¥•¹Ñd±±•™Ğè¡‰½Õ¹‘Ì¹±•™ĞµÍ…±”¹É•Ğ¹±•™Ğ¤©Í…±”¹Íà±Ñ½Àè¡‰½Õ¹‘Ì¹Ñ½ÀµÍ…±”¹É•Ğ¹Ñ½À¤©Í…±”¹Íä±ÍàéÍ…±”¹Íà±ÍäéÍ…±”¹Íä±µ½Ù•é™…±Í•ôì(€€€€€€€€€€€ÍÕÁÁÉ•ÍÍ±¥¬õ™…±Í”ì‰ÕÑÑ½¸¹±…ÍÍ1¥ÍĞ¹…‘ ‰‘É…¥¹œˆ¤ì(€€€€€€€€€€€ÑÉåì‰ÕÑÑ½¸¹Í•ÑA½¥¹Ñ•É…ÁÑÕÉ”¡•Ù•¹Ğ¹Á½¥¹Ñ•É%¤ìõ…Ñ ¡|¥ìô(€€€€€€€€€€€•Ù•¹Ğ¹ÁÉ•Ù•¹Ñ•™…Õ±Ğ ¤ì(€€€€€€€ô¤ì(€€€€€€€‰ÕÑÑ½¸¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰Á½¥¹Ñ•Éµ½Ù”ˆ±•Ù•¹Ğôùì(€€€€€€€€€€€¥˜ …‘É…ññ•Ù•¹Ğ¹Á½¥¹Ñ•É%„ôõ‘É…œ¹Á½¥¹Ñ•É%¥ìÉ•ÑÕÉ¸ìô(€€€€€€€€€€€½¹ÍĞ‘àõ•Ù•¹Ğ¹±¥•¹Ñ`µ‘É…œ¹à±‘äõ•Ù•¹Ğ¹±¥•¹Ñdµ‘É…œ¹äì(€€€€€€€€€€€¥˜ …‘É…œ¹µ½Ù•˜™5…Ñ ¹¡åÁ½Ğ¡‘à±‘ä¤øõÑ¡É•Í¡½±¥ì‘É…œ¹µ½Ù•õÑÉÕ”ìô(€€€€€€€€€€€¥˜ …‘É…œ¹µ½Ù•¥ìÉ•ÑÕÉ¸ìô(€€€€€€€€€€€½¹ÍĞ±•™Ğõ5…Ñ ¹µ…à À±5…Ñ ¹µ¥¸¡5…Ñ ¹µ…à À±Á…”¹±¥•¹Ñ]¥‘Ñ µ‰ÕÑÑ½¸¹½™™Í•Ñ]¥‘Ñ ¤±‘É…œ¹±•™Ğ­‘à©‘É…œ¹Íà¤¤ì(€€€€€€€€€€€½¹ÍĞÑ½Àõ5…Ñ ¹µ…à À±5…Ñ ¹µ¥¸¡5…Ñ ¹µ…à À±Á…”¹±¥•¹Ñ!•¥¡Ğµ‰ÕÑÑ½¸¹½™™Í•Ñ!•¥¡Ğ¤±‘É…œ¹Ñ½À­‘ä©‘É…œ¹Íä¤¤ì(€€€€€€€€€€€‰ÕÑÑ½¸¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ‰±•™Ğˆ±±•™Ğ¬‰Áàˆ°‰¥µÁ½ÉÑ…¹Ğˆ¤ì‰ÕÑÑ½¸¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ‰Ñ½Àˆ±Ñ½À¬‰Áàˆ°‰¥µÁ½ÉÑ…¹Ğˆ¤ì(€€€€€€€€€€€‰ÕÑÑ½¸¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ‰‰½ÑÑ½´ˆ°‰…ÕÑ¼ˆ°‰¥µÁ½ÉÑ…¹Ğˆ¤ì•Ù•¹Ğ¹ÁÉ•Ù•¹Ñ•™…Õ±Ğ ¤ì(€€€€€€€ô¤ì(€€€€€€€™Õ¹Ñ¥½¸™¥¹¥Í ¡•Ù•¹Ğ¥ì(€€€€€€€€€€€¥˜ …‘É…ññ•Ù•¹Ğ¹Á½¥¹Ñ•É%„ôõ‘É…œ¹Á½¥¹Ñ•É%¥ìÉ•ÑÕÉ¸ìô(€€€€€€€€€€€ÍÕÁÁÉ•ÍÍ±¥¬õ‘É…œ¹µ½Ù•ì‘É…œõ¹Õ±°ì‰ÕÑÑ½¸¹±…ÍÍ1¥ÍĞ¹É•µ½Ù” ‰‘É…¥¹œˆ¤ì•Ù•¹Ğ¹ÁÉ•Ù•¹Ñ•™…Õ±Ğ ¤ì(€€€€€€€ô(€€€€€€€‰ÕÑÑ½¸¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰Á½¥¹Ñ•ÉÕÀˆ±™¥¹¥Í ¤ì‰ÕÑÑ½¸¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰Á½¥¹Ñ•É…¹•°ˆ±™¥¹¥Í ¤ì(€€€€€€€‰ÕÑÑ½¸¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ±•Ù•¹Ğôùì(€€€€€€€€€€€¥˜¡ÍÕÁÁÉ•ÍÍ±¥¬¥ìÍÕÁÁÉ•ÍÍ±¥¬õ™…±Í”ì•Ù•¹Ğ¹ÁÉ•Ù•¹Ñ•™…Õ±Ğ ¤ì•Ù•¹Ğ¹ÍÑ½ÁAÉ½Á……Ñ¥½¸ ¤ìÉ•ÑÕÉ¸ìô(€€€€€€€€€€€¥˜¡ÑåÁ•½˜½Á•¹!½µ••…ÑÕÉ”ôôô‰™Õ¹Ñ¥½¸ˆ¥ì½Á•¹!½µ••…ÑÕÉ” ‰…ÕÑ½	…ÑÑ±•M•ÑÑ¥¹Ìˆ¤ìô(€€€€€€€ô¤ì(€€€€€€€‰ÕÑÑ½¸¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰‘É…ÍÑ…ÉĞˆ±•Ù•¹Ğôù•Ù•¹Ğ¹ÁÉ•Ù•¹Ñ•™…Õ±Ğ ¤¤ì(€€€ô(€€€¥˜¡‘½Õµ•¹Ğ¹É•…‘åMÑ…Ñ”ôôô‰±½…‘¥¹œˆ¥ì‘½Õµ•¹Ğ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰=5½¹Ñ•¹Ñ1½…‘•ˆ±‰¥¹±í½¹”éÑÉÕ•ô¤ìõ•±Í•ì‰¥¹ ¤ìô)ô¤ ¤ì(((¼¨‰Õ¹‘±•Í½ÕÉ”è©Ì¼ØÄµØÄÜĞµÕ¤µÉ•É•ÍÍ¥½¸µÕ…É‘Ì¹©Ì€¨¼(¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€XÄÜĞƒŠP‘å¹…µ¥ŒU$É•É•ÍÍ¥½¸Õ…É‘Ì(€€=İ¹•È™½ÈÉ½ÍÌµÕÑÑ¥¹œU$¥¹Ù…É¥…¹ÑÌÉ•…Ñ•‰äµÕ±Ñ¥Á±”±…Ñ”ÉÕ¹Ñ¥µ•Ìè(€€€Ä¤Í­¥±°±•…É¸½ÕÁÉ…‘”…Ñ¥½¸…É‘ÌµÕÍĞÍÑ…ä½µÁ…Ğì(€€€È¤‘…É¬Ñ•áĞ½¸‰É¥¡Ğ½±½å•±±½Ü‰ÕÑÑ½¹ÌµÕÍĞ¹½Ğ¡…Ù”„Ñ•áĞÍ¡…‘½Üì(€€€Ì¤ÍåÍÑ•´Í…Ù”½‘•±•Ñ”ÍÕ‰™±½İÌµÕÍĞ…±İ…åÌ½™™•È…¸•áÁ±¥¥ĞÉ•ÑÕÉ¸Á…Ñ ¸((€€9¼…µ•Á±…ä°Í…Ù”°‰…ÑÑ±”°Í­¥±°µ½ÍĞ½È•ÅÕ¥Áµ•¹Ğ‰ÕÍ¥¹•ÍÌÉÕ±•Ì±¥Ù”¡•É”¸(ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼(¡™Õ¹Ñ¥½¸¥¹ÍÑ…±±XÄÜÑU¥I•É•ÍÍ¥½¹Õ…É‘Ì ¥ì(€€€€‰ÕÍ”ÍÑÉ¥Ğˆì((€€€¥˜¡ÑåÁ•½˜İ¥¹‘½Üôôô‰Õ¹‘•™¥¹•‰ññÑåÁ•½˜‘½Õµ•¹Ğôôô‰Õ¹‘•™¥¹•‰ññİ¥¹‘½Ü¹}}ØÄÜÑU¥I•É•ÍÍ¥½¹Õ…É‘Í%¹ÍÑ…±±•¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(€€€İ¥¹‘½Ü¹}}ØÄÜÑU¥I•É•ÍÍ¥½¹Õ…É‘Í%¹ÍÑ…±±•õÑÉÕ”ì((€€€±•ĞÉ…™%ôÀì((€€€™Õ¹Ñ¥½¸½µÁ…ÑM­¥±±Ñ¥½¹1…‰•°¡Í½ÕÉ”¥ì(€€€€€€€½¹ÍĞÑ•áĞõMÑÉ¥¹œ¡Í½ÕÉ•ñğˆˆ¤¹É•Á±…” ½qÌ¬½œ°ˆ€ˆ¤¹ÑÉ¥´ ¤ì(€€€€€€€¥˜ …Ñ•áĞ¥ìÉ•ÑÕÉ¸Ñ•áĞìô((€€€€€€€±•Ğµ…Ñ õÑ•áĞ¹µ…Ñ  ½{¢K¢&ÉqÌ©1ÙqÌ¨¡q¬¥qÌ«–>¿–6¢Ïš*¢õqÌ©1ÙqÌ¨¡q¬¤½¤¤ì(€€€€€€€¥˜¡µ…Ñ ¥ìÉ•ÑÕÉ¸€‰1Øˆ­µ…Ñ¡lÅt¬ˆƒ¢¦:Xˆìô((€€€€€€€µ…Ñ õÑ•áĞ¹µ…Ñ  ½{–6¢ÍqÌ©1ÙqÌ¨¡q¬¥qÌ«¦r¢šqÌ¨¡q¬¥qÌ«š*¢÷¦îx½¤¤ì(€€€€€€€¥˜¡µ…Ñ ¥ìÉ•ÑÕÉ¸€‹¦r €ˆ­µ…Ñ¡lÉt¬ˆƒ¦îxˆìô((€€€€€€€µ…Ñ õÑ•áĞ¹µ…Ñ  ½{–6¢ÍqÌ©1ÙqÌ¨¡q¬¥qÌ©oï
İuqÌ¨¡q¬¥qÌ«¦îx½¤¤ì(€€€€€€€¥˜¡µ…Ñ ¥ìÉ•ÑÕÉ¸€‹–61Øˆ­µ…Ñ¡lÅt¬‹ìˆ­µ…Ñ¡lÉt¬‹¦îxˆìô((€€€€€€€µ…Ñ õÑ•áĞ¹µ…Ñ  ½{–¶ãşIqÌ©oï
İuqÌ¨¡q¬¥qÌ«¦îx½¤¤ì(€€€€€€€¥˜¡µ…Ñ ¥ìÉ•ÑÕÉ¸€‹–¶ãşKìˆ­µ…Ñ¡lÅt¬‹¦îxˆìô((€€€€€€€µ…Ñ õÑ•áĞ¹µ…Ñ  ½1ÙqÌ¨¡q¬¥qÌ«¢¦:X½¤¤ì(€€€€€€€¥˜¡µ…Ñ ¥ìÉ•ÑÕÉ¸€‰1Øˆ­µ…Ñ¡lÅt¬ˆƒ¢¦:Xˆìô((€€€€€€€µ…Ñ õÑ•áĞ¹µ…Ñ  ¿¦r¢šqÌ¨¡q¬¥qÌ«š*¢÷¦îx½¤¤ì(€€€€€€€¥˜¡µ…Ñ ¥ìÉ•ÑÕÉ¸€‹¦r €ˆ­µ…Ñ¡lÅt¬ˆƒ¦îxˆìô((€€€€€€€¥˜ ¿–&7ö¹lë¾òit¼¹Ñ•ÍĞ¡Ñ•áĞ¤¥ìÉ•ÑÕÉ¸€‹¦r–&7ö¸ˆìô(€€€€€€€É•ÑÕÉ¸Ñ•áĞì(€€€ô((€€€™Õ¹Ñ¥½¸¹½Éµ…±¥é•M­¥±±Ñ¥½¹…É‘Ì ¥ì(€€€€€€€½¹ÍĞ±…‰•±Ìõ‘½Õµ•¹Ğ¹ÅÕ•ÉåM•±•Ñ½É±° ˆ…±±M­¥±±Í1¥ÍĞ€¹Í­¥±°µ…Ñ¥½¸µ…É€¹Í­¥±°µ…Ñ¥½¸µ…Éµ±…‰•°ˆ¤ì(€€€€€€€±…‰•±Ì¹™½É… ¡±…‰•°ôùì(€€€€€€€€€€€½¹ÍĞ…Éõ±…‰•°¹±½Í•ÍĞ ˆ¹Í­¥±°µ…Ñ¥½¸µ…Éˆ¤ì(€€€€€€€€€€€¥˜ ……É¥ìÉ•ÑÕÉ¸ìô((€€€€€€€€€€€½¹ÍĞÕÉÉ•¹ĞõMÑÉ¥¹œ¡±…‰•°¹Ñ•áÑ½¹Ñ•¹Ññğˆˆ¤¹É•Á±…” ½qÌ¬½œ°ˆ€ˆ¤¹ÑÉ¥´ ¤ì(€€€€€€€€€€€½¹ÍĞÁÉ•Ù¥½ÕÍ½µÁ…Ğõ±…‰•°¹‘…Ñ…Í•Ğ¹ØÄÜÑ½µÁ…Ñ1…‰•±ñğˆˆì(€€€€€€€€€€€¥˜¡ÕÉÉ•¹Ğ„ôõÁÉ•Ù¥½ÕÍ½µÁ…Ğ¥ì(€€€€€€€€€€€€€€€½¹ÍĞ™Õ±°õÕÉÉ•¹Ğì(€€€€€€€€€€€€€€€½¹ÍĞ½µÁ…Ğõ½µÁ…ÑM­¥±±Ñ¥½¹1…‰•°¡™Õ±°¤ì(€€€€€€€€€€€€€€€±…‰•°¹‘…Ñ…Í•Ğ¹ØÄÜÑÕ±±1…‰•°õ™Õ±°ì(€€€€€€€€€€€€€€€±…‰•°¹‘…Ñ…Í•Ğ¹ØÄÜÑ½µÁ…Ñ1…‰•°õ½µÁ…Ğì(€€€€€€€€€€€€€€€¥˜¡½µÁ…Ğ„ôõ™Õ±°¥ì±…‰•°¹Ñ•áÑ½¹Ñ•¹Ğõ½µÁ…Ğìô(€€€€€€€€€€€€€€€…É¹Ñ¥Ñ±”õ™Õ±°ì(€€€€€€€€€€€€€€€…É¹Í•ÑÑÑÉ¥‰ÕÑ” ‰…É¥„µ±…‰•°ˆ±™Õ±°¤ì(€€€€€€€€€€€ô((€€€€€€€€€€€¥˜¡…É¹ÍÑå±”¹•ÑAÉ½Á•ÉÑåY…±Õ” ‰İ¥‘Ñ ˆ¤„ôôˆÄÀÑÁà‰ññ…É¹ÍÑå±”¹•ÑAÉ½Á•ÉÑåAÉ¥½É¥Ñä ‰İ¥‘Ñ ˆ¤„ôô‰¥µÁ½ÉÑ…¹Ğˆ¥ì(€€€€€€€€€€€€€€€…É¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ‰İ¥‘Ñ ˆ°ˆÄÀÑÁàˆ°‰¥µÁ½ÉÑ…¹Ğˆ¤ì(€€€€€€€€€€€€€€€…É¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ‰µ…àµİ¥‘Ñ ˆ°ˆÄÀÑÁàˆ°‰¥µÁ½ÉÑ…¹Ğˆ¤ì(€€€€€€€€€€€€€€€…É¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ‰µ¥¸µİ¥‘Ñ ˆ°ˆàÑÁàˆ°‰¥µÁ½ÉÑ…¹Ğˆ¤ì(€€€€€€€€€€€€€€€…É¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ‰™±•àµ‰…Í¥Ìˆ°ˆÄÀÑÁàˆ°‰¥µÁ½ÉÑ…¹Ğˆ¤ì(€€€€€€€€€€€ô(€€€€€€€ô¤ì(€€€ô((€€€™Õ¹Ñ¥½¸½±½ÉQÉ¥Á±•Ì¡Ù…±Õ”¥ì(€€€€€€€½¹ÍĞÑÉ¥Á±•Ìõmtì(€€€€€€€MÑÉ¥¹œ¡Ù…±Õ•ñğˆˆ¤¹É•Á±…” ½É‰„ıp¡qÌ¨¡q¬ üép¹q¬¤ü¥qÌ©l°uqÌ¨¡q¬ üép¹q¬¤ü¥qÌ©l°uqÌ¨¡q¬ üép¹q¬¤ü¤ üéqÌ©l°½uqÌ¨¡q¨ üép¹q¬¤ü¤¤ıqÌ©p¤½¤°(€€€€€€€€€€€™Õ¹Ñ¥½¸¡|±È±œ±ˆ±„¥ì(€€€€€€€€€€€€€€€½¹ÍĞ…±Á¡„õ„ôôôˆ‰ññ„ôôõÕ¹‘•™¥¹•üÄé9Õµ‰•È¡„¤ì(€€€€€€€€€€€€€€€ÑÉ¥Á±•Ì¹ÁÕÍ ¡íÈé9Õµ‰•È¡È¤±œé9Õµ‰•È¡œ¤±ˆé9Õµ‰•È¡ˆ¤±„é9Õµ‰•È¹¥Í¥¹¥Ñ”¡…±Á¡„¤ı…±Á¡„èÅô¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸|ì(€€€€€€€€€€€ô(€€€€€€€€¤ì(€€€€€€€É•ÑÕÉ¸ÑÉ¥Á±•Ìì(€€€ô((€€€™Õ¹Ñ¥½¸±Õµ¥¹…¹”¡½±½È¥ì(€€€€€€€É•ÑÕÉ¸½±½È¹È¨¸ÈÄÈØ­½±½È¹œ¨¸ÜÄÔÈ­½±½È¹ˆ¨¸ÀÜÈÈì(€€€ô((€€€™Õ¹Ñ¥½¸¥Í	É¥¡Ñ½±¡½±½È¥ì(€€€€€€€É•ÑÕÉ¸½±½È¹„ø¸ÀÔ˜˜(€€€€€€€€€€€½±½È¹ÈøôÄĞÔ˜˜(€€€€€€€€€€€½±½È¹œøôäÀ˜˜(€€€€€€€€€€€½±½È¹œğôÈÈÔ˜˜(€€€€€€€€€€€½±½È¹ˆğôÄĞÔ˜˜(€€€€€€€€€€€½±½È¹Èøõ½±½È¹œ˜˜(€€€€€€€€€€€±Õµ¥¹…¹”¡½±½È¤øôÄÄÔì(€€€ô((€€€™Õ¹Ñ¥½¸¥Í…É­Q•áĞ¡½±½È¥ì(€€€€€€€É•ÑÕÉ¸½±½È˜™½±½È¹„ø¸ÀÔ˜™±Õµ¥¹…¹”¡½±½È¤ğôÄÄÔì(€€€ô((€€€™Õ¹Ñ¥½¸¹½Éµ…±¥é•½±‘	ÕÑÑ½¹Q•áÑM¡…‘½İÌ ¥ì(€€€€€€€‘½Õµ•¹Ğ¹ÅÕ•ÉåM•±•Ñ½É±° ˆ…µ”µÍÑ…”‰ÕÑÑ½¸°€É•…Ñ¥½¹A…”‰ÕÑÑ½¸ˆ¤¹™½É… ¡‰ÕÑÑ½¸ôùì(€€€€€€€€€€€½¹ÍĞÍÑå±”õİ¥¹‘½Ü¹•Ñ½µÁÕÑ•‘MÑå±”¡‰ÕÑÑ½¸¤ì(€€€€€€€€€€€½¹ÍĞÑ•áÑ½±½Èõ½±½ÉQÉ¥Á±•Ì¡ÍÑå±”¹½±½È¥lÁtì(€€€€€€€€€€€½¹ÍĞ‰…­É½Õ¹‘½±½ÉÌõ½±½ÉQÉ¥Á±•Ì¡ÍÑå±”¹‰…­É½Õ¹‘½±½È¬ˆ€ˆ­ÍÑå±”¹‰…­É½Õ¹‘%µ…”¤ì(€€€€€€€€€€€½¹ÍĞÅÕ…±¥™¥•Ìõ¥Í…É­Q•áĞ¡Ñ•áÑ½±½È¤˜™‰…­É½Õ¹‘½±½ÉÌ¹Í½µ”¡¥Í	É¥¡Ñ½±¤ì((€€€€€€€€€€€¥˜¡ÅÕ…±¥™¥•Ì¥ì(€€€€€€€€€€€€€€€¥˜¡‰ÕÑÑ½¸¹‘…Ñ…Í•Ğ¹ØÄÜÑ…É­½±‘M¡…‘½Ü„ôôˆÄ‰ññÍÑå±”¹Ñ•áÑM¡…‘½Ü„ôô‰¹½¹”ˆ¥ì(€€€€€€€€€€€€€€€€€€€‰ÕÑÑ½¸¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ‰Ñ•áĞµÍ¡…‘½Üˆ°‰¹½¹”ˆ°‰¥µÁ½ÉÑ…¹Ğˆ¤ì(€€€€€€€€€€€€€€€€€€€‰ÕÑÑ½¸¹‘…Ñ…Í•Ğ¹ØÄÜÑ…É­½±‘M¡…‘½ÜôˆÄˆì(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€õ•±Í”¥˜¡‰ÕÑÑ½¸¹‘…Ñ…Í•Ğ¹ØÄÜÑ…É­½±‘M¡…‘½ÜôôôˆÄˆ¥ì(€€€€€€€€€€€€€€€‰ÕÑÑ½¸¹ÍÑå±”¹É•µ½Ù•AÉ½Á•ÉÑä ‰Ñ•áĞµÍ¡…‘½Üˆ¤ì(€€€€€€€€€€€€€€€‘•±•Ñ”‰ÕÑÑ½¸¹‘…Ñ…Í•Ğ¹ØÄÜÑ…É­½±‘M¡…‘½Üì(€€€€€€€€€€€ô(€€€€€€€ô¤ì(€€€ô((€€€™Õ¹Ñ¥½¸•¹ÍÕÉ•MÑå±•Í¡••Ñ1…ÍĞ ¥ì(€€€€€€€½¹ÍĞ±¥¹¬õ‘½Õµ•¹Ğ¹•Ñ±•µ•¹Ñ	å% ‰ØÄÜĞµÉ¥Ñ¥…°µÕ¤µÉ•É•ÍÍ¥½¸µÍÑå±”ˆ¤ì(€€€€€€€¥˜¡±¥¹¬˜™±¥¹¬¹Á…É•¹Ñ±•µ•¹Ğôôõ‘½Õµ•¹Ğ¹¡•…˜™±¥¹¬„ôõ‘½Õµ•¹Ğ¹¡•…¹±…ÍÑ±•µ•¹Ñ¡¥±¥ì(€€€€€€€€€€€‘½Õµ•¹Ğ¹¡•…¹…ÁÁ•¹‘¡¥±¡±¥¹¬¤ì(€€€€€€€ô(€€€ô((€€€™Õ¹Ñ¥½¸ÍåÍÑ•µI½İQ¥Ñ±”¡‰ÕÑÑ½¸¥ì(€€€€€€€½¹ÍĞÉ½Üõ‰ÕÑÑ½¸˜™‰ÕÑÑ½¸¹±½Í•ÍĞ˜™‰ÕÑÑ½¸¹±½Í•ÍĞ ˆ¹ÍåÍÑ•´µÁ…¹•°µÉ½Üˆ¤ì(€€€€€€€½¹ÍĞÑ¥Ñ±”õÉ½Ü˜™É½Ü¹ÅÕ•ÉåM•±•Ñ½È ‰ÍÑÉ½¹œˆ¤ì(€€€€€€€É•ÑÕÉ¸MÑÉ¥¹œ¡Ñ¥Ñ±”˜™Ñ¥Ñ±”¹Ñ•áÑ½¹Ñ•¹Ññğˆˆ¤¹ÑÉ¥´ ¤ì(€€€ô((€€€…Íå¹Œ™Õ¹Ñ¥½¸•¹ÍÕÉ•IÁ¥…±½=İ¹•È¡É•…Í½¸¥ì(€€€€€€€¥˜¡ÑåÁ•½˜İ¥¹‘½Ü¹ÉÁ±•ÉĞôôô‰™Õ¹Ñ¥½¸ˆ˜™ÑåÁ•½˜İ¥¹‘½Ü¹ÉÁ½¹™¥É´ôôô‰™Õ¹Ñ¥½¸ˆ¥ìÉ•ÑÕÉ¸ÑÉÕ”ìô(€€€€€€€¥˜¡İ¥¹‘½Ü¹½ÕÉMåµ‰½±Í•…ÑÕÉ•Ì˜™ÑåÁ•½˜İ¥¹‘½Ü¹½ÕÉMåµ‰½±Í•…ÑÕÉ•Ì¹•¹ÍÕÉ”ôôô‰™Õ¹Ñ¥½¸ˆ¥ì(€€€€€€€€€€€ÑÉåì…İ…¥Ğİ¥¹‘½Ü¹½ÕÉMåµ‰½±Í•…ÑÕÉ•Ì¹•¹ÍÕÉ” ‰…µ•Á±…äµ½É”ˆ±É•…Í½¹ñğ‰ÍåÍÑ•´µ‘¥…±½œˆ¤ìô(€€€€€€€€€€€…Ñ ¡•ÉÉ½È¥ì½¹Í½±”¹•ÉÉ½È ‰MåÍÑ•´‘¥…±½œ½İ¹•È™…¥±•Ñ¼±½…èˆ±•ÉÉ½È¤ìô(€€€€€€€ô(€€€€€€€É•ÑÕÉ¸ÑåÁ•½˜İ¥¹‘½Ü¹ÉÁ±•ÉĞôôô‰™Õ¹Ñ¥½¸ˆ˜™ÑåÁ•½˜İ¥¹‘½Ü¹ÉÁ½¹™¥É´ôôô‰™Õ¹Ñ¥½¸ˆì(€€€ô((€€€…Íå¹Œ™Õ¹Ñ¥½¸ÉÕ¹MåÍÑ•µM…Ù•Ñ¥½¸¡‰ÕÑÑ½¸¥ì(€€€€€€€¥˜¡‰ÕÑÑ½¸¹‘…Ñ…Í•Ğ¹ØÄÜÑMåÍÑ•µ	ÕÍäôôôˆÄˆ¥ìÉ•ÑÕÉ¸ìô(€€€€€€€‰ÕÑÑ½¸¹‘…Ñ…Í•Ğ¹ØÄÜÑMåÍÑ•µ	ÕÍäôˆÄˆì(€€€€€€€‰ÕÑÑ½¸¹‘¥Í…‰±•õÑÉÕ”ì(€€€€€€€ÑÉåì(€€€€€€€€€€€½¹ÍĞÍ…Ù•õÑåÁ•½˜İ¥¹‘½Ü¹Í…Ù•…µ”ôôô‰™Õ¹Ñ¥½¸ˆıİ¥¹‘½Ü¹Í…Ù•…µ” ¤é™…±Í”ì(€€€€€€€€€€€½¹ÍĞÉ•…‘äõ…İ…¥Ğ•¹ÍÕÉ•IÁ¥…±½=İ¹•È ‰ÍåÍÑ•´µÍ…Ù”µ™••‘‰…¬ˆ¤ì(€€€€€€€€€€€½¹ÍĞÍÕ•ÍÌõÍ…Ù•„ôõ™…±Í”ì(€€€€€€€€€€€¥˜¡É•…‘ä¥ì(€€€€€€€€€€€€€€€…İ…¥Ğİ¥¹‘½Ü¹ÉÁ±•ÉĞ (€€€€€€€€€€€€€€€€€€€ÍÕ•ÍÌü‹–ŞË–º3š"Cš&/–.W–¶cšªSˆè‹n»–&7‡šÎW–º3š"Cš&/–.W–¶cšªSˆ°(€€€€€€€€€€€€€€€€€€€íÑ¥Ñ±”è‹¦+š"Ë–¶cšªPˆ±½¹™¥ÉµQ•áĞè‹¢şS–n{ÎïÖÄˆ±Ñ½¹”éÍÕ•ÍÌü‰ÍÕ•ÍÌˆè‰¹½Éµ…°‰ô(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€õ•±Í”¥˜¡ÑåÁ•½˜İ¥¹‘½Ü¹…±•ÉĞôôô‰™Õ¹Ñ¥½¸ˆ¥ì(€€€€€€€€€€€€€€€İ¥¹‘½Ü¹…±•ÉĞ¡ÍÕ•ÍÌü‹–ŞË–º3š"Cš&/–.W–¶cšªSˆè‹n»–&7‡šÎW–º3š"Cš&/–.W–¶cšªSˆ¤ì(€€€€€€€€€€€ô(€€€€€€€õ™¥¹…±±åì(€€€€€€€€€€€‘•±•Ñ”‰ÕÑÑ½¸¹‘…Ñ…Í•Ğ¹ØÄÜÑMåÍÑ•µ	ÕÍäì(€€€€€€€€€€€‰ÕÑÑ½¸¹‘¥Í…‰±•õ™…±Í”ì(€€€€€€€ô(€€€ô((€€€…Íå¹Œ™Õ¹Ñ¥½¸ÉÕ¹MåÍÑ•µ•±•Ñ•Ñ¥½¸¡‰ÕÑÑ½¸¥ì(€€€€€€€¥˜¡‰ÕÑÑ½¸¹‘…Ñ…Í•Ğ¹ØÄÜÑMåÍÑ•µ	ÕÍäôôôˆÄˆ¥ìÉ•ÑÕÉ¸ìô(€€€€€€€‰ÕÑÑ½¸¹‘…Ñ…Í•Ğ¹ØÄÜÑMåÍÑ•µ	ÕÍäôˆÄˆì(€€€€€€€‰ÕÑÑ½¸¹‘¥Í…‰±•õÑÉÕ”ì(€€€€€€€ÑÉåì(€€€€€€€€€€€½¹ÍĞÉ•…‘äõ…İ…¥Ğ•¹ÍÕÉ•IÁ¥…±½=İ¹•È ‰ÍåÍÑ•´µ‘•±•Ñ”µ½¹™¥É´ˆ¤ì(€€€€€€€€€€€¥˜¡É•…‘ä˜™ÑåÁ•½˜İ¥¹‘½Ü¹É•Í•Ñ…µ”ôôô‰™Õ¹Ñ¥½¸ˆ¥ì(€€€€€€€€€€€€€€€…İ…¥Ğİ¥¹‘½Ü¹É•Í•Ñ…µ” ¤ì(€€€€€€€€€€€ô(€€€€€€€õ™¥¹…±±åì(€€€€€€€€€€€‘•±•Ñ”‰ÕÑÑ½¸¹‘…Ñ…Í•Ğ¹ØÄÜÑMåÍÑ•µ	ÕÍäì(€€€€€€€€€€€‰ÕÑÑ½¸¹‘¥Í…‰±•õ™…±Í”ì(€€€€€€€ô(€€€ô((€€€™Õ¹Ñ¥½¸¥¹Ñ•É•ÁÑMåÍÑ•µÑ¥½¸¡•Ù•¹Ğ¥ì(€€€€€€€½¹ÍĞ‰ÕÑÑ½¸õ•Ù•¹Ğ¹Ñ…É•Ğ˜™•Ù•¹Ğ¹Ñ…É•Ğ¹±½Í•ÍĞ˜™•Ù•¹Ğ¹Ñ…É•Ğ¹±½Í•ÍĞ ˆ¹ÍåÍÑ•´µÁ…¹•°µÉ½Ü€¹¡½µ”µ™•…ÑÕÉ”µ‰Õäµ‰Ñ¸ˆ¤ì(€€€€€€€¥˜ …‰ÕÑÑ½¸¥ìÉ•ÑÕÉ¸ìô(€€€€€€€½¹ÍĞÑ¥Ñ±”õÍåÍÑ•µI½İQ¥Ñ±”¡‰ÕÑÑ½¸¤ì(€€€€€€€¥˜¡Ñ¥Ñ±”„ôô‹¦+š"Ë–¶cšªPˆ˜™Ñ¥Ñ±”„ôô‹–"«¦f“¢K¢&Èˆ¥ìÉ•ÑÕÉ¸ìô((€€€€€€€•Ù•¹Ğ¹ÁÉ•Ù•¹Ñ•™…Õ±Ğ ¤ì(€€€€€€€•Ù•¹Ğ¹ÍÑ½ÁAÉ½Á……Ñ¥½¸ ¤ì(€€€€€€€•Ù•¹Ğ¹ÍÑ½Á%µµ•‘¥…Ñ•AÉ½Á……Ñ¥½¸ ¤ì(€€€€€€€¥˜¡Ñ¥Ñ±”ôôô‹¦+š"Ë–¶cšªPˆ¥ìÙ½¥ÉÕ¹MåÍÑ•µM…Ù•Ñ¥½¸¡‰ÕÑÑ½¸¤ìô(€€€€€€€•±Í•ìÙ½¥ÉÕ¹MåÍÑ•µ•±•Ñ•Ñ¥½¸¡‰ÕÑÑ½¸¤ìô(€€€ô((€€€™Õ¹Ñ¥½¸¹½Éµ…±¥é•MåÍÑ•µ¥…±½9…Ù¥…Ñ¥½¸ ¥ì(€€€€€€€½¹ÍĞ±…å•Èõ‘½Õµ•¹Ğ¹•Ñ±•µ•¹Ñ	å% ‰ØÄØåIÁ¥…±½1…å•Èˆ¤ì(€€€€€€€¥˜ …±…å•Éñğ…±…å•È¹±…ÍÍ1¥ÍĞ¹½¹Ñ…¥¹Ì ‰Í¡½Üˆ¤¥ìÉ•ÑÕÉ¸ìô(€€€€€€€½¹ÍĞÑ¥Ñ±”õ±…å•È¹ÅÕ•ÉåM•±•Ñ½È ˆØÄØåIÁ¥…±½Q¥Ñ±”ˆ¤ì(€€€€€€€¥˜¡MÑÉ¥¹œ¡Ñ¥Ñ±”˜™Ñ¥Ñ±”¹Ñ•áÑ½¹Ñ•¹Ññğˆˆ¤¹ÑÉ¥´ ¤„ôô‹–"«¦f“¢K¢&Èˆ¥ìÉ•ÑÕÉ¸ìô(€€€€€€€½¹ÍĞ…¹•°õ±…å•È¹ÅÕ•ÉåM•±•Ñ½È ˆ¹ØÄØäµÉÁœµ‘¥…±½œµ…Ñ¥½¹Ì€¹ØÄØäµÉÁœµ‘¥…±½œµ‰ÕÑÑ½¸¹Í•½¹‘…Éäˆ¤ì(€€€€€€€¥˜¡…¹•°˜˜……¹•°¹¡¥‘‘•¸˜™…¹•°¹Ñ•áÑ½¹Ñ•¹Ğ„ôô‹¢şS–n{ÎïÖÄˆ¥ì(€€€€€€€€€€€…¹•°¹Ñ•áÑ½¹Ñ•¹Ğô‹¢şS–n{ÎïÖÄˆì(€€€€€€€€€€€…¹•°¹Í•ÑÑÑÉ¥‰ÕÑ” ‰…É¥„µ±…‰•°ˆ°‹¢şS–n{ÎïÖÇ¾ò3’â7–"«¦f“¢K¢&Èˆ¤ì(€€€€€€€ô(€€€ô((€€€™Õ¹Ñ¥½¸…ÁÁ±ä ¥ì(€€€€€€€¹½Éµ…±¥é•M­¥±±Ñ¥½¹…É‘Ì ¤ì(€€€€€€€¹½Éµ…±¥é•½±‘	ÕÑÑ½¹Q•áÑM¡…‘½İÌ ¤ì(€€€€€€€¹½Éµ…±¥é•MåÍÑ•µ¥…±½9…Ù¥…Ñ¥½¸ ¤ì(€€€€€€€•¹ÍÕÉ•MÑå±•Í¡••Ñ1…ÍĞ ¤ì(€€€ô((€€€™Õ¹Ñ¥½¸Í¡•‘Õ±” ¥ì(€€€€€€€¥˜¡É…™%¥ìÉ•ÑÕÉ¸ìô(€€€€€€€É…™%õÉ•ÅÕ•ÍÑ¹¥µ…Ñ¥½¹É…µ”  ¤ôùì(€€€€€€€€€€€É…™%ôÀì(€€€€€€€€€€€…ÁÁ±ä ¤ì(€€€€€€€ô¤ì(€€€ô((€€€½¹ÍĞ½‰Í•ÉÙ•Èõ¹•Ü5ÕÑ…Ñ¥½¹=‰Í•ÉÙ•È¡Í¡•‘Õ±”¤ì(€€€½‰Í•ÉÙ•È¹½‰Í•ÉÙ”¡‘½Õµ•¹Ğ¹‰½‘ä±ì(€€€€€€€¡¥±‘1¥ÍĞéÑÉÕ”°(€€€€€€€ÍÕ‰ÑÉ•”éÑÉÕ”°(€€€€€€€¡…É…Ñ•É…Ñ„éÑÉÕ”°(€€€€€€€…ÑÑÉ¥‰ÕÑ•ÌéÑÉÕ”°(€€€€€€€…ÑÑÉ¥‰ÕÑ•¥±Ñ•Èél‰±…ÍÌˆ°‰ÍÑå±”ˆ°‰‘¥Í…‰±•‰t(€€€ô¤ì((€€€‘½Õµ•¹Ğ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ±¥¹Ñ•É•ÁÑMåÍÑ•µÑ¥½¸±ÑÉÕ”¤ì(€€€‘½Õµ•¹Ğ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ±Í¡•‘Õ±”±íÁ…ÍÍ¥Ù”éÑÉÕ•ô¤ì(€€€‘½Õµ•¹Ğ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰ØÄÜÌéÉÕ¹Ñ¥µ”µÉ•…‘äˆ±Í¡•‘Õ±”±íÁ…ÍÍ¥Ù”éÑÉÕ•ô¤ì(€€€İ¥¹‘½Ü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰É•Í¥é”ˆ±Í¡•‘Õ±”±íÁ…ÍÍ¥Ù”éÑÉÕ•ô¤ì((€€€¥˜¡‘½Õµ•¹Ğ¹É•…‘åMÑ…Ñ”ôôô‰±½…‘¥¹œˆ¥ì(€€€€€€€‘½Õµ•¹Ğ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰=5½¹Ñ•¹Ñ1½…‘•ˆ±Í¡•‘Õ±”±í½¹”éÑÉÕ•ô¤ì(€€€õ•±Í•ì(€€€€€€€Í¡•‘Õ±” ¤ì(€€€ô((€€€İ¥¹‘½Ü¹ØÄÜÑÁÁ±åU¥I•É•ÍÍ¥½¹Õ…É‘ÌõÍ¡•‘Õ±”ì)ô¤ ¤ì(((¼¨‰Õ¹‘±•Í½ÕÉ”è©Ì½É•±•…Í”µÕÁ‘…Ñ”µ¹½Ñ¥™¥…Ñ¥½¸¹©Ì€¨¼(¼¨(€€I•±•…Í”UÁ‘…Ñ”9½Ñ¥™¥…Ñ¥½¸MåÍÑ•´(€€€´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´(€€A±…å•Èµ™…¥¹œÉ•±•…Í”¹½Ñ¥•Ì…É”½İ¹•‰äÉ•±•…Í”½É•±•…Í”µÕÁ‘…Ñ”¹©Í½¸¸(€€Q¡¥Ì…ÁÀµÍ¡•±°µ½‘Õ±”‘•±¥‰•É…Ñ•±äÉ•ÕÍ•Ì€¡½µ••…ÑÕÉ•5½‘…°…¹Ñ¡”¹…Ñ¥Ù”(€€€…µ”µ½Ù•É±…äµ±…å•Èì¥Ğ‘½•Ì¹½Ğ¥¹ÑÉ½‘Õ”„Í•½¹µ½‘…°½È…¹¹½Õ¹•µ•¹Ğ(€€™É…µ•İ½É¬¸(¨¼(¡™Õ¹Ñ¥½¸¥¹ÍÑ…±±I•±•…Í•UÁ‘…Ñ•9½Ñ¥™¥…Ñ¥½¸¡±½‰…°¥ì(€€€€‰ÕÍ”ÍÑÉ¥Ğˆì((€€€¥˜ …±½‰…±ññ±½‰…°¹½ÕÉMåµ‰½±ÍI•±•…Í•UÁ‘…Ñ”¥ìÉ•ÑÕÉ¸ìô((€€€½¹ÍĞI1M}9=Q%}AQ ô‰É•±•…Í”½É•±•…Í”µÕÁ‘…Ñ”¹©Í½¸ˆì(€€€½¹ÍĞ!-}%9QIY1}5LôĞ¨ØÀ¨ÄÀÀÀì(€€€½¹ÍĞ5%9}!-}A}5LôĞÔ¨ÄÀÀÀì(€€€½¹ÍĞI5%9I}==1=]9}5LôÈÀ¨ØÀ¨ÄÀÀÀì(€€€½¹ÍĞIEUMQ}Q%5=UQ}5LôàÀÀÀì(€€€½¹ÍĞA9%9}I!-}5LôÄÔÀÀì(€€€½¹ÍĞMQ=I}95MAô‰™½ÕÈµÍåµ‰½±ÌéÉ•±•…Í”µÕÁ‘…Ñ”èˆì(€€€½¹ÍĞY}AIY%]}EUIdô‰É•±•…Í•UÁ‘…Ñ•AÉ•Ù¥•Üˆì(€€€½¹ÍĞY}AIY%]}!=MQLõ¹•ÜM•Ğ¡l(€€€€€€€€‰‘•Ø¹™½ÕÈµÍåµ‰½±Ìµ‘•Ø¹Á…•Ì¹‘•Øˆ°(€€€€€€€€‰±½…±¡½ÍĞˆ°(€€€€€€€€ˆÄÈÜ¸À¸À¸Äˆ°(€€€€€€€€ˆèèÄˆ(€€€t¤ì((€€€½¹ÍĞÍÑ…Ñ”õì(€€€€€€€ÍÑ…ÉÑ•é™…±Í”°(€€€€€€€¡•­¥¹œé¹Õ±°°(€€€€€€€±…ÍÑ¡•­ĞèÀ°(€€€€€€€µ…¹¥™•ÍĞé¹Õ±°°(€€€€€€€±½…‘•‘I•±•…Í•Y•ÉÍ¥½¸é¹Õ±°°(€€€€€€€µ…ÉÅÕ•”é¹Õ±°°(€€€€€€€Á½±±Q¥µ•Èé¹Õ±°°(€€€€€€€Á•¹‘¥¹Q¥µ•Èé¹Õ±°°(€€€€€€€Á•¹‘¥¹9½Éµ…±I•±½…é™…±Í”°(€€€€€€€Á•¹‘¥¹½É•‘UÁ‘…Ñ”é™…±Í”°(€€€€€€€Á•¹‘¥¹¹¹½Õ¹•µ•¹Ğé™…±Í”°(€€€€€€€±½¥¹¹¹½Õ¹•µ•¹ÑM¡½İ¸é™…±Í”°(€€€€€€€™½É•‘5½‘…±1½¬é™…±Í”°(€€€€€€€µ½‘…±=Á•¸é™…±Í”°(€€€€€€€µ½‘…±-¥¹é¹Õ±°°(€€€€€€€‘•ÙAÉ•Ù¥•İ5½‘”é¹Õ±°°(€€€€€€€É¥Ñ¥…±=Á•É…Ñ¥½¹Ìé¹•Ü5…À ¤°(€€€€€€€¹•áÑ=Á•É…Ñ¥½¹%èÄ(€€€ôì((€€€™Õ¹Ñ¥½¸¹½Ü ¥ìÉ•ÑÕÉ¸…Ñ”¹¹½Ü ¤ìô((€€€™Õ¹Ñ¥½¸•Ñ1½…Ñ¥½¹!½ÍÑ¹…µ” ¥ì(€€€€€€€ÑÉåì(€€€€€€€€€€€½¹ÍĞ±½…Ñ¥½¸õ±½‰…°¹±½…Ñ¥½¸ì(€€€€€€€€€€€½¹ÍĞ¡½ÍÑ¹…µ”õMÑÉ¥¹œ¡±½…Ñ¥½¸˜™±½…Ñ¥½¸¹¡½ÍÑ¹…µ•ñğˆˆ¤(€€€€€€€€€€€€€€€€¹ÑÉ¥´ ¤(€€€€€€€€€€€€€€€€¹Ñ½1½İ•É…Í” ¤(€€€€€€€€€€€€€€€€¹É•Á±…” ½yqmñqt½œ°ˆˆ¤ì(€€€€€€€€€€€¥˜¡¡½ÍÑ¹…µ”¥ìÉ•ÑÕÉ¸¡½ÍÑ¹…µ”ìô(€€€€€€€€€€€½¹ÍĞ¡É•˜õMÑÉ¥¹œ¡±½…Ñ¥½¸˜™±½…Ñ¥½¸¹¡É•™ñğˆˆ¤ì(€€€€€€€€€€€É•ÑÕÉ¸¡É•˜ı¹•ÜUI0¡¡É•˜¤¹¡½ÍÑ¹…µ”¹Ñ½1½İ•É…Í” ¤¹É•Á±…” ½yqmñqt½œ°ˆˆ¤èˆˆì(€€€€€€€õ…Ñ ¡|¥ìÉ•ÑÕÉ¸€ˆˆìô(€€€ô((€€€™Õ¹Ñ¥½¸•Ñ•ÙAÉ•Ù¥•İ5½‘” ¥ì(€€€€€€€¥˜ …Y}AIY%]}!=MQL¹¡…Ì¡•Ñ1½…Ñ¥½¹!½ÍÑ¹…µ” ¤¤¥ìÉ•ÑÕÉ¸¹Õ±°ìô(€€€€€€€ÑÉåì(€€€€€€€€€€€½¹ÍĞ±½…Ñ¥½¸õ±½‰…°¹±½…Ñ¥½¸ì(€€€€€€€€€€€½¹ÍĞ‰…Í”ô¡±½‰…°¹‘½Õµ•¹Ğ˜™±½‰…°¹‘½Õµ•¹Ğ¹‰…Í•UI$¥ñğ¡±½…Ñ¥½¸˜™±½…Ñ¥½¸¹¡É•˜¥ññÕ¹‘•™¥¹•ì(€€€€€€€€€€€½¹ÍĞµ½‘”õ¹•ÜUI0¡MÑÉ¥¹œ¡±½…Ñ¥½¸˜™±½…Ñ¥½¸¹¡É•™ñğˆˆ¤±‰…Í”¤(€€€€€€€€€€€€€€€€¹Í•…É¡A…É…µÌ(€€€€€€€€€€€€€€€€¹•Ğ¡Y}AIY%]}EUId¤ì(€€€€€€€€€€€É•ÑÕÉ¸µ½‘”ôôô‰µ…ÉÅÕ•”‰ññµ½‘”ôôô‰µ½‘…°ˆıµ½‘”é¹Õ±°ì(€€€€€€€õ…Ñ ¡|¥ìÉ•ÑÕÉ¸¹Õ±°ìô(€€€ô((€€€™Õ¹Ñ¥½¸¹½Éµ…±¥é•Y•ÉÍ¥½¸¡Ù…±Õ”¥ì(€€€€€€€½¹ÍĞÉ…ÜõMÑÉ¥¹œ¡Ù…±Õ”ôõ¹Õ±°üˆˆéÙ…±Õ”¤¹ÑÉ¥´ ¤¹É•Á±…” ½yX½¤°ˆˆ¤ì(€€€€€€€É•ÑÕÉ¸É…Ü€ü€‰Xˆ­É…Ü€è€ˆˆì(€€€ô((€€€™Õ¹Ñ¥½¸Á…ÉÍ•Y•ÉÍ¥½¸¡Ù…±Õ”¥ì(€€€€€€€½¹ÍĞ¹½Éµ…±¥é•õ¹½Éµ…±¥é•Y•ÉÍ¥½¸¡Ù…±Õ”¤¹É•Á±…” ½yX¼°ˆˆ¤ì(€€€€€€€¥˜ „½yq¬ üép¹q¬¤¬¼¹Ñ•ÍĞ¡¹½Éµ…±¥é•¤¥ìÉ•ÑÕÉ¸¹Õ±°ìô(€€€€€€€É•ÑÕÉ¸¹½Éµ…±¥é•¹ÍÁ±¥Ğ ˆ¸ˆ¤¹µ…À¡Á…ÉĞôù9Õµ‰•È¡Á…ÉĞ¤¤ì(€€€ô((€€€™Õ¹Ñ¥½¸½µÁ…É•Y•ÉÍ¥½¹Ì¡±•™Ğ±É¥¡Ğ¥ì(€€€€€€€½¹ÍĞ„õÁ…ÉÍ•Y•ÉÍ¥½¸¡±•™Ğ¤ì(€€€€€€€½¹ÍĞˆõÁ…ÉÍ•Y•ÉÍ¥½¸¡É¥¡Ğ¤ì(€€€€€€€¥˜ ……ñğ…ˆ¥ìÉ•ÑÕÉ¸¹Õ±°ìô(€€€€€€€½¹ÍĞ±•¹Ñ õ5…Ñ ¹µ…à¡„¹±•¹Ñ ±ˆ¹±•¹Ñ ¤ì(€€€€€€€™½È¡±•Ğ¥¹‘•àôÀí¥¹‘•àñ±•¹Ñ í¥¹‘•à¬¬¥ì(€€€€€€€€€€€½¹ÍĞ‘•±Ñ„ô¡…m¥¹‘•áuñğÀ¤´¡‰m¥¹‘•áuñğÀ¤ì(€€€€€€€€€€€¥˜¡‘•±Ñ„„ôôÀ¥ìÉ•ÑÕÉ¸‘•±Ñ„øÀüÄè´Äìô(€€€€€€€ô(€€€€€€€É•ÑÕÉ¸€Àì(€€€ô((€€€™Õ¹Ñ¥½¸•Í…Á•!Ñµ°¡Ù…±Õ”¥ì(€€€€€€€É•ÑÕÉ¸MÑÉ¥¹œ¡Ù…±Õ”ôõ¹Õ±°üˆˆéÙ…±Õ”¤(€€€€€€€€€€€€¹É•Á±…” ¼˜½œ°ˆ™…µÀìˆ¤(€€€€€€€€€€€€¹É•Á±…” ¼ğ½œ°ˆ™±Ğìˆ¤(€€€€€€€€€€€€¹É•Á±…” ¼ø½œ°ˆ™Ğìˆ¤(€€€€€€€€€€€€¹É•Á±…” ½pˆ½œ°ˆ™ÅÕ½Ğìˆ¤(€€€€€€€€€€€€¹É•Á±…” ¼œ½œ°ˆ˜ŒÀÌäìˆ¤ì(€€€ô((€€€™Õ¹Ñ¥½¸•Ñ1½…‘•‘I•±•…Í•Y•ÉÍ¥½¸ ¥ì(€€€€€€€½¹ÍĞ‰Õ¥±õ±½‰…°¹}}=UI}Me5	=1M}	U%1}|ì(€€€€€€€½¹ÍĞÙ…±Õ”õ‰Õ¥±˜™‰Õ¥±¹É•±•…Í”ì(€€€€€€€É•ÑÕÉ¸¹½Éµ…±¥é•Y•ÉÍ¥½¸¡Ù…±Õ”¤ì(€€€ô((€€€™Õ¹Ñ¥½¸•ÑMÑ½É…” ¥ì(€€€€€€€ÑÉåìÉ•ÑÕÉ¸±½‰…°¹±½…±MÑ½É…•ññ¹Õ±°ìô(€€€€€€€…Ñ ¡|¥ìÉ•ÑÕÉ¸¹Õ±°ìô(€€€ô((€€€™Õ¹Ñ¥½¸ÍÑ½É…•-•ä¡ÍÕ™™¥à¥ì(€€€€€€€½¹ÍĞÉ•Á½Í¥Ñ½Éäõ±½‰…°¹½ÕÉMåµ‰½±Í½Õ¹ÑM…Ù”ì(€€€€€€€ÑÉåì(€€€€€€€€€€€¥˜¡É•Á½Í¥Ñ½Éä˜™ÑåÁ•½˜É•Á½Í¥Ñ½Éä¹…½Õ¹Ñ-•äôôô‰™Õ¹Ñ¥½¸ˆ¥ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸É•Á½Í¥Ñ½Éä¹…½Õ¹Ñ-•ä ‰É•±•…Í”µÕÁ‘…Ñ”´ˆ­ÍÕ™™¥à¤ì(€€€€€€€€€€€ô(€€€€€€€õ…Ñ ¡|¥ìô(€€€€€€€É•ÑÕÉ¸MQ=I}95MA­ÍÕ™™¥àì(€€€ô((€€€™Õ¹Ñ¥½¸É•…‘MÑ½É…”¡ÍÕ™™¥à¥ì(€€€€€€€½¹ÍĞÍÑ½É…”õ•ÑMÑ½É…” ¤ì(€€€€€€€¥˜ …ÍÑ½É…”¥ìÉ•ÑÕÉ¸¹Õ±°ìô(€€€€€€€ÑÉåìÉ•ÑÕÉ¸ÍÑ½É…”¹•Ñ%Ñ•´¡ÍÑ½É…•-•ä¡ÍÕ™™¥à¤¤ìô(€€€€€€€…Ñ ¡|¥ìÉ•ÑÕÉ¸¹Õ±°ìô(€€€ô((€€€™Õ¹Ñ¥½¸İÉ¥Ñ•MÑ½É…”¡ÍÕ™™¥à±Ù…±Õ”¥ì(€€€€€€€½¹ÍĞÍÑ½É…”õ•ÑMÑ½É…” ¤ì(€€€€€€€¥˜ …ÍÑ½É…”¥ìÉ•ÑÕÉ¸ìô(€€€€€€€ÑÉåìÍÑ½É…”¹Í•Ñ%Ñ•´¡ÍÑ½É…•-•ä¡ÍÕ™™¥à¤±MÑÉ¥¹œ¡Ù…±Õ”¤¤ìô(€€€€€€€…Ñ ¡|¥ìô(€€€ô((€€€™Õ¹Ñ¥½¸É•µ½Ù•MÑ½É…”¡ÍÕ™™¥à¥ì(€€€€€€€½¹ÍĞÍÑ½É…”õ•ÑMÑ½É…” ¤ì(€€€€€€€¥˜ …ÍÑ½É…”¥ìÉ•ÑÕÉ¸ìô(€€€€€€€ÑÉåì(€€€€€€€€€€€¥˜¡ÑåÁ•½˜ÍÑ½É…”¹É•µ½Ù•%Ñ•´ôôô‰™Õ¹Ñ¥½¸ˆ¥ìÍÑ½É…”¹É•µ½Ù•%Ñ•´¡ÍÑ½É…•-•ä¡ÍÕ™™¥à¤¤ìô(€€€€€€€õ…Ñ ¡|¥ìô(€€€ô((€€€™Õ¹Ñ¥½¸±½…±…Ñ•-•ä¡Ù…±Õ”¥ì(€€€€€€€½¹ÍĞ‘…Ñ”õ¹•Ü…Ñ”¡Ù…±Õ”ôõ¹Õ±°ı¹½Ü ¤éÙ…±Õ”¤ì(€€€€€€€¥˜¡9Õµ‰•È¹¥Í9…8¡‘…Ñ”¹•ÑQ¥µ” ¤¤¥ìÉ•ÑÕÉ¸€ˆˆìô(€€€€€€€½¹ÍĞåååäõ‘…Ñ”¹•ÑÕ±±e•…È ¤ì(€€€€€€€½¹ÍĞµ´õMÑÉ¥¹œ¡‘…Ñ”¹•Ñ5½¹Ñ  ¤¬Ä¤¹Á…‘MÑ…ÉĞ È°ˆÀˆ¤ì(€€€€€€€½¹ÍĞ‘õMÑÉ¥¹œ¡‘…Ñ”¹•Ñ…Ñ” ¤¤¹Á…‘MÑ…ÉĞ È°ˆÀˆ¤ì(€€€€€€€É•ÑÕÉ¸åååä¬ˆ´ˆ­µ´¬ˆ´ˆ­‘ì(€€€ô((€€€™Õ¹Ñ¥½¸É•…‘Q½‘…åMÕÁÁÉ•ÍÍ¥½¸ ¥ì(€€€€€€€ÑÉåì(€€€€€€€€€€€½¹ÍĞÙ…±Õ”õ)M=8¹Á…ÉÍ”¡É•…‘MÑ½É…” ‰ÍÕÁÁÉ•ÍÌµÑ½‘…äˆ¥ñğ‰¹Õ±°ˆ¤ì(€€€€€€€€€€€É•ÑÕÉ¸Ù…±Õ”˜™ÑåÁ•½˜Ù…±Õ”ôôô‰½‰©•ĞˆıÙ…±Õ”é¹Õ±°ì(€€€€€€€õ…Ñ ¡|¥ìÉ•ÑÕÉ¸¹Õ±°ìô(€€€ô((€€€™Õ¹Ñ¥½¸¥ÍÕÉÉ•¹Ñ9½Ñ¥•MÕÁÁÉ•ÍÍ•‘Q½‘…ä¡µ…¹¥™•ÍĞ¥ì(€€€€€€€¥˜ …µ…¹¥™•ÍĞ¥ìÉ•ÑÕÉ¸™…±Í”ìô(€€€€€€€½¹ÍĞÙ…±Õ”õÉ•…‘Q½‘…åMÕÁÁÉ•ÍÍ¥½¸ ¤ì(€€€€€€€É•ÑÕÉ¸€„„ (€€€€€€€€€€€Ù…±Õ”˜˜(€€€€€€€€€€€Ù…±Õ”¹¹½Ñ¥•%ôôõµ…¹¥™•ÍĞ¹¹½Ñ¥•%˜˜(€€€€€€€€€€€Ù…±Õ”¹‘…Ñ•-•äôôõ±½…±…Ñ•-•ä ¤(€€€€€€€€¤ì(€€€ô((€€€™Õ¹Ñ¥½¸Í•ÑÕÉÉ•¹Ñ9½Ñ¥•MÕÁÁÉ•ÍÍ•‘Q½‘…ä¡•¹…‰±•¥ì(€€€€€€€½¹ÍĞµ…¹¥™•ÍĞõÍÑ…Ñ”¹µ…¹¥™•ÍĞì(€€€€€€€¥˜ …µ…¹¥™•ÍĞ¥ìÉ•ÑÕÉ¸ìô(€€€€€€€¥˜¡•¹…‰±•¥ì(€€€€€€€€€€€İÉ¥Ñ•MÑ½É…” ‰ÍÕÁÁÉ•ÍÌµÑ½‘…äˆ±)M=8¹ÍÑÉ¥¹¥™ä¡ì(€€€€€€€€€€€€€€€¹½Ñ¥•%éµ…¹¥™•ÍĞ¹¹½Ñ¥•%°(€€€€€€€€€€€€€€€‘…Ñ•-•äé±½…±…Ñ•-•ä ¤(€€€€€€€€€€€ô¤¤ì(€€€€€€€õ•±Í•ì(€€€€€€€€€€€É•µ½Ù•MÑ½É…” ‰ÍÕÁÁÉ•ÍÌµÑ½‘…äˆ¤ì(€€€€€€€ô(€€€ô((€€€™Õ¹Ñ¥½¸Ù…±¥‘…Ñ•5…¹¥™•ÍĞ¡Ù…±Õ”¥ì(€€€€€€€¥˜ …Ù…±Õ•ññÑåÁ•½˜Ù…±Õ”„ôô‰½‰©•Ğ‰ññÉÉ…ä¹¥ÍÉÉ…ä¡Ù…±Õ”¤¥ìÉ•ÑÕÉ¸¹Õ±°ìô(€€€€€€€½¹ÍĞÉ•±•…Í•Y•ÉÍ¥½¸õ¹½Éµ…±¥é•Y•ÉÍ¥½¸¡Ù…±Õ”¹É•±•…Í•Y•ÉÍ¥½¸¤ì(€€€€€€€½¹ÍĞÕÁ‘…Ñ•5½‘”õÙ…±Õ”¹ÕÁ‘…Ñ•5½‘”ì(€€€€€€€½¹ÍĞµ¥¹¥µÕµY•ÉÍ¥½¸õÙ…±Õ”¹µ¥¹¥µÕµY•ÉÍ¥½¸ôôõ¹Õ±±ññÙ…±Õ”¹µ¥¹¥µÕµY•ÉÍ¥½¸ôôõÕ¹‘•™¥¹•‘ññÙ…±Õ”¹µ¥¹¥µÕµY•ÉÍ¥½¸ôôôˆˆ(€€€€€€€€€€€€ü¹Õ±°(€€€€€€€€€€€€è¹½Éµ…±¥é•Y•ÉÍ¥½¸¡Ù…±Õ”¹µ¥¹¥µÕµY•ÉÍ¥½¸¤ì(€€€€€€€½¹ÍĞ½¹Ñ•¹ĞõÉÉ…ä¹¥ÍÉÉ…ä¡Ù…±Õ”¹½¹Ñ•¹Ğ¤ıÙ…±Õ”¹½¹Ñ•¹Ğé¹Õ±°ì(€€€€€€€¥˜ (€€€€€€€€€€€Ù…±Õ”¹Í¡•µ…Y•ÉÍ¥½¸„ôôÅñğ(€€€€€€€€€€€ÑåÁ•½˜Ù…±Õ”¹ÁÕ‰±¥9½Ñ¥”„ôô‰‰½½±•…¸‰ñğ(€€€€€€€€€€€€…Á…ÉÍ•Y•ÉÍ¥½¸¡É•±•…Í•Y•ÉÍ¥½¸¥ñğ(€€€€€€€€€€€ÑåÁ•½˜Ù…±Õ”¹¹½Ñ¥•%„ôô‰ÍÑÉ¥¹œ‰ñğ…Ù…±Õ”¹¹½Ñ¥•%¹ÑÉ¥´ ¥ñğ(€€€€€€€€€€€ÑåÁ•½˜Ù…±Õ”¹Ñ¥Ñ±”„ôô‰ÍÑÉ¥¹œ‰ñğ…Ù…±Õ”¹Ñ¥Ñ±”¹ÑÉ¥´ ¥ñğ(€€€€€€€€€€€ÑåÁ•½˜Ù…±Õ”¹ÍÕµµ…Éä„ôô‰ÍÑÉ¥¹œ‰ñğ…Ù…±Õ”¹ÍÕµµ…Éä¹ÑÉ¥´ ¥ñğ(€€€€€€€€€€€€…½¹Ñ•¹Ñññ½¹Ñ•¹Ğ¹±•¹Ñ ôôôÁññ½¹Ñ•¹Ğ¹Í½µ”¡¥Ñ•´ôùÑåÁ•½˜¥Ñ•´„ôô‰ÍÑÉ¥¹œ‰ñğ…¥Ñ•´¹ÑÉ¥´ ¤¥ñğ(€€€€€€€€€€€ÑåÁ•½˜Ù…±Õ”¹ÁÕ‰±¥Í¡•‘Ğ„ôô‰ÍÑÉ¥¹œ‰ñğ…Ù…±Õ”¹ÁÕ‰±¥Í¡•‘Ğ¹ÑÉ¥´ ¥ñğ(€€€€€€€€€€€€…9Õµ‰•È¹¥Í¥¹¥Ñ”¡…Ñ”¹Á…ÉÍ”¡Ù…±Õ”¹ÁÕ‰±¥Í¡•‘Ğ¤¥ñğ(€€€€€€€€€€€€¡ÕÁ‘…Ñ•5½‘”„ôô‰¹½Éµ…°ˆ˜™ÕÁ‘…Ñ•5½‘”„ôô‰™½É•ˆ¥ñğ(€€€€€€€€€€€€¡µ¥¹¥µÕµY•ÉÍ¥½¸„ôõ¹Õ±°˜˜…Á…ÉÍ•Y•ÉÍ¥½¸¡µ¥¹¥µÕµY•ÉÍ¥½¸¤¤(€€€€€€€€¥ì(€€€€€€€€€€€É•ÑÕÉ¸¹Õ±°ì(€€€€€€€ô(€€€€€€€É•ÑÕÉ¸ì(€€€€€€€€€€€Í¡•µ…Y•ÉÍ¥½¸èÄ°(€€€€€€€€€€€ÁÕ‰±¥9½Ñ¥”éÙ…±Õ”¹ÁÕ‰±¥9½Ñ¥”°(€€€€€€€€€€€É•±•…Í•Y•ÉÍ¥½¸°(€€€€€€€€€€€¹½Ñ¥•%éÙ…±Õ”¹¹½Ñ¥•%¹ÑÉ¥´ ¤°(€€€€€€€€€€€Ñ¥Ñ±”éÙ…±Õ”¹Ñ¥Ñ±”¹ÑÉ¥´ ¤°(€€€€€€€€€€€ÍÕµµ…ÉäéÙ…±Õ”¹ÍÕµµ…Éä¹ÑÉ¥´ ¤°(€€€€€€€€€€€½¹Ñ•¹Ğé½¹Ñ•¹Ğ¹µ…À¡¥Ñ•´ôù¥Ñ•´¹ÑÉ¥´ ¤¤°(€€€€€€€€€€€ÁÕ‰±¥Í¡•‘ĞéÙ…±Õ”¹ÁÕ‰±¥Í¡•‘Ğ°(€€€€€€€€€€€ÕÁ‘…Ñ•5½‘”°(€€€€€€€€€€€µ¥¹¥µÕµY•ÉÍ¥½¸(€€€€€€€ôì(€€€ô((€€€™Õ¹Ñ¥½¸¡…ÍU¹É•…‘I•±•…Í•9½Ñ¥” ¥ì(€€€€€€€½¹ÍĞµ…¹¥™•ÍĞõÍÑ…Ñ”¹µ…¹¥™•ÍĞì(€€€€€€€½¹ÍĞ±½…‘•õÍÑ…Ñ”¹±½…‘•‘I•±•…Í•Y•ÉÍ¥½¹ññ•Ñ1½…‘•‘I•±•…Í•Y•ÉÍ¥½¸ ¤ì(€€€€€€€¥˜ …µ…¹¥™•ÍÑñğ…µ…¹¥™•ÍĞ¹ÁÕ‰±¥9½Ñ¥•ñğ…±½…‘•¥ìÉ•ÑÕÉ¸™…±Í”ìô(€€€€€€€¥˜¡½µÁ…É•Y•ÉÍ¥½¹Ì¡±½…‘•±µ…¹¥™•ÍĞ¹É•±•…Í•Y•ÉÍ¥½¸¤„ôôÀ¥ìÉ•ÑÕÉ¸™…±Í”ìô(€€€€€€€É•ÑÕÉ¸€ (€€€€€€€€€€€É•…‘MÑ½É…” ‰±…ÍĞµÍ••¸µÙ•ÉÍ¥½¸ˆ¤„ôõµ…¹¥™•ÍĞ¹É•±•…Í•Y•ÉÍ¥½¹ñğ(€€€€€€€€€€€É•…‘MÑ½É…” ‰±…ÍĞµÍ••¸µ¹½Ñ¥”ˆ¤„ôõµ…¹¥™•ÍĞ¹¹½Ñ¥•%(€€€€€€€€¤ì(€€€ô((€€€™Õ¹Ñ¥½¸µ…É­ÕÉÉ•¹Ñ9½Ñ¥•M••¸ ¥ì(€€€€€€€½¹ÍĞµ…¹¥™•ÍĞõÍÑ…Ñ”¹µ…¹¥™•ÍĞì(€€€€€€€¥˜ …µ…¹¥™•ÍĞ¥ìÉ•ÑÕÉ¸ìô(€€€€€€€İÉ¥Ñ•MÑ½É…” ‰±…ÍĞµÍ••¸µÙ•ÉÍ¥½¸ˆ±µ…¹¥™•ÍĞ¹É•±•…Í•Y•ÉÍ¥½¸¤ì(€€€€€€€İÉ¥Ñ•MÑ½É…” ‰±…ÍĞµÍ••¸µ¹½Ñ¥”ˆ±µ…¹¥™•ÍĞ¹¹½Ñ¥•%¤ì(€€€€€€€É•™É•Í¡9½Ñ¥™¥…Ñ¥½¹½ÑÌ ¤ì(€€€ô((€€€™Õ¹Ñ¥½¸Í¡½Õ±‘ÕÑ½M¡½İ1½¥¹¹¹½Õ¹•µ•¹Ğ¡µ…¹¥™•ÍĞ¥ì(€€€€€€€½¹ÍĞ±½…‘•õÍÑ…Ñ”¹±½…‘•‘I•±•…Í•Y•ÉÍ¥½¹ññ•Ñ1½…‘•‘I•±•…Í•Y•ÉÍ¥½¸ ¤ì(€€€€€€€¥˜ (€€€€€€€€€€€ÍÑ…Ñ”¹±½¥¹¹¹½Õ¹•µ•¹ÑM¡½İ¹ñğ(€€€€€€€€€€€ÍÑ…Ñ”¹Á•¹‘¥¹¹¹½Õ¹•µ•¹Ññğ(€€€€€€€€€€€€…µ…¹¥™•ÍÑñğ(€€€€€€€€€€€€…µ…¹¥™•ÍĞ¹ÁÕ‰±¥9½Ñ¥•ñğ(€€€€€€€€€€€€…±½…‘•‘ñğ(€€€€€€€€€€€½µÁ…É•Y•ÉÍ¥½¹Ì¡±½…‘•±µ…¹¥™•ÍĞ¹É•±•…Í•Y•ÉÍ¥½¸¤„ôôÀ(€€€€€€€€¥ì(€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€ô(€€€€€€€É•ÑÕÉ¸€…¥ÍÕÉÉ•¹Ñ9½Ñ¥•MÕÁÁÉ•ÍÍ•‘Q½‘…ä¡µ…¹¥™•ÍĞ¤ì(€€€ô((€€€™Õ¹Ñ¥½¸¥ÍM¡…É•‘5½‘…±Ù…¥±…‰±•½É¹¹½Õ¹•µ•¹Ğ ¥ì(€€€€€€€½¹ÍĞÁ…ÉÑÌõ•ÑM¡…É•‘5½‘…±A…ÉÑÌ ¤ì(€€€€€€€É•ÑÕÉ¸€„„ (€€€€€€€€€€€Á…ÉÑÌ˜˜(€€€€€€€€€€€€ …Á…ÉÑÌ¹µ½‘…°¹±…ÍÍ1¥ÍÑñğ…Á…ÉÑÌ¹µ½‘…°¹±…ÍÍ1¥ÍĞ¹½¹Ñ…¥¹Ì ‰Í¡½Üˆ¤¤(€€€€€€€€¤ì(€€€ô((€€€™Õ¹Ñ¥½¸É•…‘I•µ¥¹‘•È ¥ì(€€€€€€€ÑÉåì(€€€€€€€€€€€½¹ÍĞÙ…±Õ”õ)M=8¹Á…ÉÍ”¡É•…‘MÑ½É…” ‰±…ÍĞµÉ•µ¥¹‘•Èˆ¥ñğ‰¹Õ±°ˆ¤ì(€€€€€€€€€€€É•ÑÕÉ¸Ù…±Õ”˜™ÑåÁ•½˜Ù…±Õ”ôôô‰½‰©•ĞˆıÙ…±Õ”é¹Õ±°ì(€€€€€€€õ…Ñ ¡|¥ìÉ•ÑÕÉ¸¹Õ±°ìô(€€€ô((€€€™Õ¹Ñ¥½¸Í¡½Õ±‘M¡½İI•µ¥¹‘•È¡µ…¹¥™•ÍĞ¥ì(€€€€€€€½¹ÍĞÉ•µ¥¹‘•ÈõÉ•…‘I•µ¥¹‘•È ¤ì(€€€€€€€É•ÑÕÉ¸€…É•µ¥¹‘•ÉññÉ•µ¥¹‘•È¹¹½Ñ¥•%„ôõµ…¹¥™•ÍĞ¹¹½Ñ¥•%‘ññ¹½Ü ¤µ9Õµ‰•È¡É•µ¥¹‘•È¹…ÑñğÀ¤øõI5%9I}==1=]9}5Lì(€€€ô((€€€™Õ¹Ñ¥½¸É•µ•µ‰•ÉI•µ¥¹‘•È¡µ…¹¥™•ÍĞ¥ì(€€€€€€€İÉ¥Ñ•MÑ½É…” ‰±…ÍĞµÉ•µ¥¹‘•Èˆ±)M=8¹ÍÑÉ¥¹¥™ä¡í¹½Ñ¥•%éµ…¹¥™•ÍĞ¹¹½Ñ¥•%±…Ğé¹½Ü ¥ô¤¤ì(€€€ô((€€€™Õ¹Ñ¥½¸•ÑU¹Í…™•I•…Í½¹Ì ¥ì(€€€€€€€½¹ÍĞÉ•…Í½¹Ìõmtì(€€€€€€€ÑÉåì(€€€€€€€€€€€¥˜¡ÑåÁ•½˜‰…ÑÑ±•Ñ¥Ù”„ôô‰Õ¹‘•™¥¹•ˆ˜™‰…ÑÑ±•Ñ¥Ù”¥ìÉ•…Í½¹Ì¹ÁÕÍ  ‰‰…ÑÑ±”ˆ¤ìô(€€€€€€€€€€€¥˜¡ÑåÁ•½˜‰…ÑÑ±•A¡…Í”„ôô‰Õ¹‘•™¥¹•ˆ˜™‰…ÑÑ±•A¡…Í”ôôô‰É•Í½±Ù”ˆ¥ìÉ•…Í½¹Ì¹ÁÕÍ  ‰‰…ÑÑ±”µÉ•Í½±ÕÑ¥½¸ˆ¤ìô(€€€€€€€õ…Ñ ¡|¥ìô(€€€€€€€ÑÉåì(€€€€€€€€€€€¥˜ (€€€€€€€€€€€€€€€±½‰…°¹½ÕÉMåµ‰½±Í	…ÑÑ±•±½Ü˜˜(€€€€€€€€€€€€€€€ÑåÁ•½˜±½‰…°¹½ÕÉMåµ‰½±Í	…ÑÑ±•±½Ü¹¥ÍAÉ•Í•¹Ñ…Ñ¥½¹Ñ¥Ù”ôôô‰™Õ¹Ñ¥½¸ˆ˜˜(€€€€€€€€€€€€€€€±½‰…°¹½ÕÉMåµ‰½±Í	…ÑÑ±•±½Ü¹¥ÍAÉ•Í•¹Ñ…Ñ¥½¹Ñ¥Ù” ¤(€€€€€€€€€€€€¥ì(€€€€€€€€€€€€€€€É•…Í½¹Ì¹ÁÕÍ  ‰‰…ÑÑ±”µÁÉ•Í•¹Ñ…Ñ¥½¸ˆ¤ì(€€€€€€€€€€€ô(€€€€€€€õ…Ñ ¡|¥ìô(€€€€€€€¥˜¡ÍÑ…Ñ”¹É¥Ñ¥…±=Á•É…Ñ¥½¹Ì¹Í¥é”¥ìÉ•…Í½¹Ì¹ÁÕÍ  ‰É¥Ñ¥…°µ½Á•É…Ñ¥½¸ˆ¤ìô((€€€€€€€½¹ÍĞ‘½Õµ•¹ÑI•˜õ±½‰…°¹‘½Õµ•¹Ğì(€€€€€€€¥˜ …‘½Õµ•¹ÑI•™ññÑåÁ•½˜‘½Õµ•¹ÑI•˜¹•Ñ±•µ•¹Ñ	å%„ôô‰™Õ¹Ñ¥½¸ˆ¥ìÉ•ÑÕÉ¸É•…Í½¹Ììô(€€€€€€€½¹ÍĞÉ•İ…Éõ‘½Õµ•¹ÑI•˜¹•Ñ±•µ•¹Ñ	å% ‰ØÄÌÉI•İ…É‘5½‘…°ˆ¤ì(€€€€€€€¥˜¡É•İ…É˜™É•İ…É¹±…ÍÍ1¥ÍĞ˜™É•İ…É¹±…ÍÍ1¥ÍĞ¹½¹Ñ…¥¹Ì ‰Í¡½Üˆ¤¥ìÉ•…Í½¹Ì¹ÁÕÍ  ‰É•İ…Éˆ¤ìô(€€€€€€€½¹ÍĞ‘¥…±½œõ‘½Õµ•¹ÑI•˜¹•Ñ±•µ•¹Ñ	å% ‰ØÄØåIÁ¥…±½1…å•Èˆ¤ì(€€€€€€€¥˜¡‘¥…±½œ˜™‘¥…±½œ¹±…ÍÍ1¥ÍĞ˜™‘¥…±½œ¹±…ÍÍ1¥ÍĞ¹½¹Ñ…¥¹Ì ‰Í¡½Üˆ¤¥ìÉ•…Í½¹Ì¹ÁÕÍ  ‰ÑÉ…¹Í…Ñ¥½¸µ‘¥…±½œˆ¤ìô(€€€€€€€½¹ÍĞµ½‘…°õ‘½Õµ•¹ÑI•˜¹•Ñ±•µ•¹Ñ	å% ‰¡½µ••…ÑÕÉ•5½‘…°ˆ¤ì(€€€€€€€¥˜ (€€€€€€€€€€€µ½‘…°˜™µ½‘…°¹±…ÍÍ1¥ÍĞ˜™µ½‘…°¹±…ÍÍ1¥ÍĞ¹½¹Ñ…¥¹Ì ‰Í¡½Üˆ¤˜˜(€€€€€€€€€€€€…µ½‘…°¹±…ÍÍ1¥ÍĞ¹½¹Ñ…¥¹Ì ‰É•±•…Í”µÕÁ‘…Ñ”µµ½‘…°ˆ¤˜˜(€€€€€€€€€€€€ (€€€€€€€€€€€€€€€µ½‘…°¹±…ÍÍ1¥ÍĞ¹½¹Ñ…¥¹Ì ‰ØÄĞÄµÍå¹Ñ¡•Í¥Ìµµ½‘…°ˆ¥ñğ(€€€€€€€€€€€€€€€µ½‘…°¹±…ÍÍ1¥ÍĞ¹½¹Ñ…¥¹Ì ‰ØÄÌÄµÍ¡½Àµ½Á•¸ˆ¥ñğ(€€€€€€€€€€€€€€€µ½‘…°¹±…ÍÍ1¥ÍĞ¹½¹Ñ…¥¹Ì ‰Ñ•…´µÉ•±¥Œµµ½‘…°ˆ¤(€€€€€€€€€€€€¤(€€€€€€€€¥ì(€€€€€€€€€€€É•…Í½¹Ì¹ÁÕÍ  ‰¡¥ µÙ…±Õ”µ™•…ÑÕÉ”ˆ¤ì(€€€€€€€ô(€€€€€€€É•ÑÕÉ¸É•…Í½¹Ìì(€€€ô((€€€™Õ¹Ñ¥½¸…¹M…™•±åI•±½…‘½ÉUÁ‘…Ñ” ¥ì(€€€€€€€É•ÑÕÉ¸•ÑU¹Í…™•I•…Í½¹Ì ¤¹±•¹Ñ ôôôÀì(€€€ô((€€€™Õ¹Ñ¥½¸‰•¥¹É¥Ñ¥…±=Á•É…Ñ¥½¸¡±…‰•°¥ì(€€€€€€€½¹ÍĞ½Á•É…Ñ¥½¹%õÍÑ…Ñ”¹¹•áÑ=Á•É…Ñ¥½¹%¬¬ì(€€€€€€€±•Ğ…Ñ¥Ù”õÑÉÕ”ì(€€€€€€€ÍÑ…Ñ”¹É¥Ñ¥…±=Á•É…Ñ¥½¹Ì¹Í•Ğ¡½Á•É…Ñ¥½¹%±MÑÉ¥¹œ¡±…‰•±ñğ‰É¥Ñ¥…°µ½Á•É…Ñ¥½¸ˆ¤¤ì(€€€€€€€É•ÑÕÉ¸™Õ¹Ñ¥½¸•¹‘É¥Ñ¥…±=Á•É…Ñ¥½¸ ¥ì(€€€€€€€€€€€¥˜ ……Ñ¥Ù”¥ìÉ•ÑÕÉ¸ìô(€€€€€€€€€€€…Ñ¥Ù”õ™…±Í”ì(€€€€€€€€€€€ÍÑ…Ñ”¹É¥Ñ¥…±=Á•É…Ñ¥½¹Ì¹‘•±•Ñ”¡½Á•É…Ñ¥½¹%¤ì(€€€€€€€€€€€É•Í½±Ù•A•¹‘¥¹]¡•¹M…™” ¤ì(€€€€€€€ôì(€€€ô((€€€™Õ¹Ñ¥½¸•Ñ=Ù•É±…å1…å•È ¥ì(€€€€€€€½¹ÍĞ‘½Õµ•¹ÑI•˜õ±½‰…°¹‘½Õµ•¹Ğì(€€€€€€€É•ÑÕÉ¸‘½Õµ•¹ÑI•˜˜™‘½Õµ•¹ÑI•˜¹•Ñ±•µ•¹Ñ	å%(€€€€€€€€€€€€ü‘½Õµ•¹ÑI•˜¹•Ñ±•µ•¹Ñ	å% ‰…µ”µ½Ù•É±…äµ±…å•Èˆ¤(€€€€€€€€€€€€è¹Õ±°ì(€€€ô((€€€™Õ¹Ñ¥½¸•¹ÍÕÉ•5…ÉÅÕ•” ¥ì(€€€€€€€¥˜¡ÍÑ…Ñ”¹µ…ÉÅÕ•”˜™ÍÑ…Ñ”¹µ…ÉÅÕ•”¹¥Í½¹¹•Ñ•„ôõ™…±Í”¥ìÉ•ÑÕÉ¸ÍÑ…Ñ”¹µ…ÉÅÕ•”ìô(€€€€€€€½¹ÍĞ‘½Õµ•¹ÑI•˜õ±½‰…°¹‘½Õµ•¹Ğì(€€€€€€€½¹ÍĞ±…å•Èõ•Ñ=Ù•É±…å1…å•È ¤ì(€€€€€€€¥˜ …‘½Õµ•¹ÑI•™ñğ…±…å•ÉññÑåÁ•½˜‘½Õµ•¹ÑI•˜¹É•…Ñ•±•µ•¹Ğ„ôô‰™Õ¹Ñ¥½¸ˆ¥ìÉ•ÑÕÉ¸¹Õ±°ìô(€€€€€€€½¹ÍĞµ…ÉÅÕ•”õ‘½Õµ•¹ÑI•˜¹É•…Ñ•±•µ•¹Ğ ‰‰ÕÑÑ½¸ˆ¤ì(€€€€€€€µ…ÉÅÕ•”¹ÑåÁ”ô‰‰ÕÑÑ½¸ˆì(€€€€€€€µ…ÉÅÕ•”¹¥ô‰É•±•…Í•UÁ‘…Ñ•5…ÉÅÕ•”ˆì(€€€€€€€µ…ÉÅÕ•”¹±…ÍÍ9…µ”ô‰É•±•…Í”µÕÁ‘…Ñ”µµ…ÉÅÕ•”ˆì(€€€€€€€µ…ÉÅÕ•”¹Í•ÑÑÑÉ¥‰ÕÑ” ‰…É¥„µ±¥Ù”ˆ°‰Á½±¥Ñ”ˆ¤ì(€€€€€€€µ…ÉÅÕ•”¹Í•ÑÑÑÉ¥‰ÕÑ” ‰…É¥„µ±…‰•°ˆ°‹š~—r/&#šr³šnÓšZÃ–Ÿ–ºäˆ¤ì(€€€€€€€µ…ÉÅÕ•”¹¥¹¹•É!Q50ô(€€€€€€€€€€€€œñÍÁ…¸±…ÍÌô‰É•±•…Í”µÕÁ‘…Ñ”µµ…ÉÅÕ•”µÑ…œˆûšnÓšZÀğ½ÍÁ…¸øœ¬(€€€€€€€€€€€€œñÍÁ…¸±…ÍÌô‰É•±•…Í”µÕÁ‘…Ñ”µµ…ÉÅÕ•”µÑ•áĞˆøğ½ÍÁ…¸øœ¬(€€€€€€€€€€€€œñÍÁ…¸±…ÍÌô‰É•±•…Í”µÕÁ‘…Ñ”µµ…ÉÅÕ•”µ…Ñ¥½¸ˆûš~—r,ğ½ÍÁ…¸øœì(€€€€€€€µ…ÉÅÕ•”¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ° ¤ôùì(€€€€€€€€€€€½¹ÍĞµ…¹¥™•ÍĞõÍÑ…Ñ”¹µ…¹¥™•ÍĞì(€€€€€€€€€€€¥˜ …µ…¹¥™•ÍĞ¥ìÉ•ÑÕÉ¸ìô(€€€€€€€€€€€¥˜¡ÍÑ…Ñ”¹‘•ÙAÉ•Ù¥•İ5½‘”¥ì(€€€€€€€€€€€€€€€½Á•¹I•±•…Í••Ñ…¥°¡¥Í½É•‘½É1½…‘•‘Y•ÉÍ¥½¸¡µ…¹¥™•ÍĞ¤ü‰™½É•ˆè‰ÁÉ•Ù¥•Üˆ¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€€€€€ô(€€€€€€€€€€€¥˜¡¥Í½É•‘½É1½…‘•‘Y•ÉÍ¥½¸¡µ…¹¥™•ÍĞ¤˜˜……¹M…™•±åI•±½…‘½ÉUÁ‘…Ñ” ¤¥ì(€€€€€€€€€€€€€€€Í¡½İ5…ÉÅÕ•”¡µ…¹¥™•ÍĞ°‰™½É•µÁ•¹‘¥¹œˆ¤ì(€€€€€€€€€€€€€€€Í¡•‘Õ±•A•¹‘¥¹I•Í½±ÕÑ¥½¸ ¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€€€€€ô(€€€€€€€€€€€½Á•¹I•±•…Í••Ñ…¥°¡¥Í½É•‘½É1½…‘•‘Y•ÉÍ¥½¸¡µ…¹¥™•ÍĞ¤ü‰™½É•ˆè‰ÕÁ‘…Ñ”ˆ¤ì(€€€€€€€ô¤ì(€€€€€€€±…å•È¹…ÁÁ•¹‘¡¥±¡µ…ÉÅÕ•”¤ì(€€€€€€€ÍÑ…Ñ”¹µ…ÉÅÕ•”õµ…ÉÅÕ•”ì(€€€€€€€É•ÑÕÉ¸µ…ÉÅÕ•”ì(€€€ô((€€€™Õ¹Ñ¥½¸Í¡½İ5…ÉÅÕ•”¡µ…¹¥™•ÍĞ±­¥¹¥ì(€€€€€€€½¹ÍĞµ…ÉÅÕ•”õ•¹ÍÕÉ•5…ÉÅÕ•” ¤ì(€€€€€€€¥˜ …µ…ÉÅÕ••ñğ…µ…¹¥™•ÍĞ¥ìÉ•ÑÕÉ¸ìô(€€€€€€€½¹ÍĞÑ…œõµ…ÉÅÕ•”¹ÅÕ•ÉåM•±•Ñ½È ˆ¹É•±•…Í”µÕÁ‘…Ñ”µµ…ÉÅÕ•”µÑ…œˆ¤ì(€€€€€€€½¹ÍĞÑ•áĞõµ…ÉÅÕ•”¹ÅÕ•ÉåM•±•Ñ½È ˆ¹É•±•…Í”µÕÁ‘…Ñ”µµ…ÉÅÕ•”µÑ•áĞˆ¤ì(€€€€€€€½¹ÍĞ…Ñ¥½¸õµ…ÉÅÕ•”¹ÅÕ•ÉåM•±•Ñ½È ˆ¹É•±•…Í”µÕÁ‘…Ñ”µµ…ÉÅÕ•”µ…Ñ¥½¸ˆ¤ì(€€€€€€€½¹ÍĞÁ•¹‘¥¹œõ­¥¹ôôô‰¹½Éµ…°µÁ•¹‘¥¹œ‰ññ­¥¹ôôô‰™½É•µÁ•¹‘¥¹œˆì(€€€€€€€¥˜¡Ñ…œ¥ìÑ…œ¹Ñ•áÑ½¹Ñ•¹Ğõ­¥¹˜™­¥¹¹¥¹‘•á=˜ ‰™½É•ˆ¤ôôôÀü‹¦7¢ššnÓšZÀˆè‹šnÓšZÀˆìô(€€€€€€€¥˜¡Ñ•áĞ¥ì(€€€€€€€€€€€Ñ•áĞ¹Ñ•áÑ½¹Ñ•¹ĞõÁ•¹‘¥¹œ(€€€€€€€€€€€€€€€€üµ…¹¥™•ÍĞ¹É•±•…Í•Y•ÉÍ¥½¸¬ˆƒ–ŞËfó–â¾òon»–&7šN7’ös–º3š"C–ú3–Â¢«–.W¦Ë¢†3šnÓšZÃˆ(€€€€€€€€€€€€€€€€èµ…¹¥™•ÍĞ¹É•±•…Í•Y•ÉÍ¥½¸¬ˆƒ–ŞËfó–â¾ò0ˆ­µ…¹¥™•ÍĞ¹ÍÕµµ…Éäì(€€€€€€€ô(€€€€€€€¥˜¡…Ñ¥½¸¥ì…Ñ¥½¸¹Ñ•áÑ½¹Ñ•¹ĞõÁ•¹‘¥¹œü‹–úšnÓšZÀˆè‹š~—r,ˆìô(€€€€€€€µ…ÉÅÕ•”¹±…ÍÍ1¥ÍĞ¹Ñ½±” ‰¥Ìµ™½É•ˆ±­¥¹˜™­¥¹¹¥¹‘•á=˜ ‰™½É•ˆ¤ôôôÀ¤ì(€€€€€€€µ…ÉÅÕ•”¹±…ÍÍ1¥ÍĞ¹Ñ½±” ‰¥ÌµÁ•¹‘¥¹œˆ°„…Á•¹‘¥¹œ¤ì(€€€€€€€µ…ÉÅÕ•”¹¡¥‘‘•¸õ™…±Í”ì(€€€ô((€€€™Õ¹Ñ¥½¸¡¥‘•5…ÉÅÕ•” ¥ì(€€€€€€€¥˜¡ÍÑ…Ñ”¹µ…ÉÅÕ•”¥ìÍÑ…Ñ”¹µ…ÉÅÕ•”¹¡¥‘‘•¸õÑÉÕ”ìô(€€€ô((€€€™Õ¹Ñ¥½¸¥Í½É•‘½É1½…‘•‘Y•ÉÍ¥½¸¡µ…¹¥™•ÍĞ¥ì(€€€€€€€½¹ÍĞ±½…‘•õÍÑ…Ñ”¹±½…‘•‘I•±•…Í•Y•ÉÍ¥½¹ññ•Ñ1½…‘•‘I•±•…Í•Y•ÉÍ¥½¸ ¤ì(€€€€€€€¥˜ …µ…¹¥™•ÍÑñğ…±½…‘•¥ìÉ•ÑÕÉ¸™…±Í”ìô(€€€€€€€¥˜¡µ…¹¥™•ÍĞ¹ÕÁ‘…Ñ•5½‘”ôôô‰™½É•ˆ¥ìÉ•ÑÕÉ¸ÑÉÕ”ìô(€€€€€€€É•ÑÕÉ¸€„„ (€€€€€€€€€€€µ…¹¥™•ÍĞ¹µ¥¹¥µÕµY•ÉÍ¥½¸˜˜(€€€€€€€€€€€½µÁ…É•Y•ÉÍ¥½¹Ì¡±½…‘•±µ…¹¥™•ÍĞ¹µ¥¹¥µÕµY•ÉÍ¥½¸¤„ôõ¹Õ±°˜˜(€€€€€€€€€€€½µÁ…É•Y•ÉÍ¥½¹Ì¡±½…‘•±µ…¹¥™•ÍĞ¹µ¥¹¥µÕµY•ÉÍ¥½¸¤ğÀ(€€€€€€€€¤ì(€€€ô((€€€™Õ¹Ñ¥½¸•ÑM¡…É•‘5½‘…±A…ÉÑÌ ¥ì(€€€€€€€½¹ÍĞ‘½Õµ•¹ÑI•˜õ±½‰…°¹‘½Õµ•¹Ğì(€€€€€€€¥˜ …‘½Õµ•¹ÑI•™ññÑåÁ•½˜‘½Õµ•¹ÑI•˜¹•Ñ±•µ•¹Ñ	å%„ôô‰™Õ¹Ñ¥½¸ˆ¥ìÉ•ÑÕÉ¸¹Õ±°ìô(€€€€€€€½¹ÍĞµ½‘…°õ‘½Õµ•¹ÑI•˜¹•Ñ±•µ•¹Ñ	å% ‰¡½µ••…ÑÕÉ•5½‘…°ˆ¤ì(€€€€€€€½¹ÍĞÑ¥Ñ±”õ‘½Õµ•¹ÑI•˜¹•Ñ±•µ•¹Ñ	å% ‰¡½µ••…ÑÕÉ•5½‘…±Q¥Ñ±”ˆ¤ì(€€€€€€€½¹ÍĞ‰½‘äõ‘½Õµ•¹ÑI•˜¹•Ñ±•µ•¹Ñ	å% ‰¡½µ••…ÑÕÉ•5½‘…±	½‘äˆ¤ì(€€€€€€€¥˜ …µ½‘…±ñğ…Ñ¥Ñ±•ñğ…‰½‘ä¥ìÉ•ÑÕÉ¸¹Õ±°ìô(€€€€€€€É•ÑÕÉ¸íµ½‘…°±Ñ¥Ñ±”±‰½‘åôì(€€€ô((€€€™Õ¹Ñ¥½¸É•¹‘•ÉI•±•…Í•½¹Ñ•¹Ğ¡µ…¹¥™•ÍĞ±­¥¹¥ì(€€€€€€€½¹ÍĞ™½É•õ­¥¹ôôô‰™½É•ˆì(€€€€€€€½¹ÍĞÁÉ•Ù¥•Üõ­¥¹ôôô‰ÁÉ•Ù¥•Üˆì(€€€€€€€½¹ÍĞÕÁ‘…Ñ”õ­¥¹ôôô‰ÕÁ‘…Ñ”ˆì(€€€€€€€½¹ÍĞ¥¹ÑÉ¼õÁÉ•Ù¥•Ü(€€€€€€€€€€€€ü€‹n»–&7
ë¦Z/fó¦‚C¢š÷š¢‡–ò?¾òoš¶“V¯¦v‹–>«R£šZóšª‹š~—šnÓšZÃ–³–F+¾ò3’â7šr¦7šZÃ¢ò'–—¦+š"Ëˆ(€€€€€€€€€€€€è™½É•(€€€€€€€€€€€€€€€€ü€‹n»–&7&#šr³–ŞË–sš¶‹’öÿR£¾ò3¢®/šnÓšZÃ–ú3æóê3¦+š"Ëˆ(€€€€€€€€€€€€€€€€èÕÁ‘…Ñ”(€€€€€€€€€€€€€€€€€€€€ü€‹fó>ûšZÃ&#šr³’öƒ–>¿–#–º3š"Cn»–&7šN7’ös¾ò3–7šnÓšZÃ¢ÏšršZÃ&#šr³ˆ(€€€€€€€€€€€€€€€€€€€€è€‹’î—’â/šb¿šr³š²‡š¶–ò?&#šr³šnÓšZÃ–Ÿ–ºçˆì(€€€€€€€½¹ÍĞ¹½Ñ•Ìõµ…¹¥™•ÍĞ¹½¹Ñ•¹Ğ¹µ…À¡¥Ñ•´ôøˆñ±¤øˆ­•Í…Á•!Ñµ°¡¥Ñ•´¤¬ˆğ½±¤øˆ¤¹©½¥¸ ˆˆ¤ì(€€€€€€€½¹ÍĞ…Ñ¥½¹ÌõÁÉ•Ù¥•Ü(€€€€€€€€€€€€ü€œñ‘¥Ø±…ÍÌô‰É•±•…Í”µÕÁ‘…Ñ”µ…Ñ¥½¹Ìˆøñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÌô‰É•±•…Í”µÕÁ‘…Ñ”µÁÉ¥µ…Éäˆ‘…Ñ„µÉ•±•…Í”µÕÁ‘…Ñ”µ…Ñ¥½¸ô‰ÁÉ•Ù¥•Üµ±½Í”ˆû¦^s¦Z'¦‚C¢šôğ½‰ÕÑÑ½¸øğ½‘¥Øøœ(€€€€€€€€€€€€è™½É•(€€€€€€€€€€€€€€€€ü€œñ‘¥Ø±…ÍÌô‰É•±•…Í”µÕÁ‘…Ñ”µ…Ñ¥½¹Ìˆøñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÌô‰É•±•…Í”µÕÁ‘…Ñ”µÁÉ¥µ…Éäˆ‘…Ñ„µÉ•±•…Í”µÕÁ‘…Ñ”µ…Ñ¥½¸ô‰É•±½…ˆû®/–6ÏšnÓšZÀğ½‰ÕÑÑ½¸øğ½‘¥Øøœ(€€€€€€€€€€€€€€€€èÕÁ‘…Ñ”(€€€€€€€€€€€€€€€€€€€€ü€œñ‘¥Ø±…ÍÌô‰É•±•…Í”µÕÁ‘…Ñ”µ…Ñ¥½¹Ìˆøñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ‘…Ñ„µÉ•±•…Í”µÕÁ‘…Ñ”µ…Ñ¥½¸ô‰±…Ñ•Èˆû¢7–ú3šnÓšZÀğ½‰ÕÑÑ½¸øñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÌô‰É•±•…Í”µÕÁ‘…Ñ”µÁÉ¥µ…Éäˆ‘…Ñ„µÉ•±•…Í”µÕÁ‘…Ñ”µ…Ñ¥½¸ô‰É•±½…ˆû®/–6ÏšnÓšZÀğ½‰ÕÑÑ½¸øğ½‘¥Øøœ(€€€€€€€€€€€€€€€€€€€€è€œñ‘¥Ø±…ÍÌô‰É•±•…Í”µÕÁ‘…Ñ”µ…Ñ¥½¹Ìˆøñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÌô‰É•±•…Í”µÕÁ‘…Ñ”µÁÉ¥µ…Éäˆ‘…Ñ„µÉ•±•…Í”µÕÁ‘…Ñ”µ…Ñ¥½¸ô‰…­¹½İ±•‘”ˆûš"G~—¦O’êğ½‰ÕÑÑ½¸øğ½‘¥Øøœì(€€€€€€€½¹ÍĞÍÕÁÁÉ•ÍÍQ½‘…äô…™½É•˜˜…ÕÁ‘…Ñ”(€€€€€€€€€€€€ü€œñ±…‰•°±…ÍÌô‰É•±•…Í”µÕÁ‘…Ñ”µÍÕÁÁÉ•ÍÌµÑ½‘…äˆøñ¥¹ÁÕĞ±…ÍÌô‰É•±•…Í”µÕÁ‘…Ñ”µÍÕÁÁÉ•ÍÌµÑ½‘…äµ¥¹ÁÕĞˆÑåÁ”ô‰¡•­‰½àˆ‘…Ñ„µÉ•±•…Í”µÕÁ‘…Ñ”µÍÕÁÁÉ•ÍÌµÑ½‘…äô‰ÑÉÕ”ˆøñÍÁ…¸û’î+š^—’â7–7¢ŞÏ–ëš>C¦Hğ½ÍÁ…¸øğ½±…‰•°øœ(€€€€€€€€€€€€è€œœì(€€€€€€€É•ÑÕÉ¸€ (€€€€€€€€€€€€œñÍ•Ñ¥½¸±…ÍÌô‰É•±•…Í”µÕÁ‘…Ñ”µ‘•Ñ…¥°ˆ‘…Ñ„µÉ•±•…Í”µÕÁ‘…Ñ”µ­¥¹ôˆœ­•Í…Á•!Ñµ°¡­¥¹¤¬œˆøœ¬(€€€€€€€€€€€€€€€€œñÀ±…ÍÌô‰É•±•…Í”µÕÁ‘…Ñ”µÙ•ÉÍ¥½¸ˆøœ­•Í…Á•!Ñµ°¡µ…¹¥™•ÍĞ¹É•±•…Í•Y•ÉÍ¥½¸¤¬Ÿ œ­•Í…Á•!Ñµ°¡µ…¹¥™•ÍĞ¹ÍÕµµ…Éä¤¬œğ½Àøœ¬(€€€€€€€€€€€€€€€€œñÀ±…ÍÌô‰É•±•…Í”µÕÁ‘…Ñ”µ¥¹ÑÉ¼ˆøœ­•Í…Á•!Ñµ°¡¥¹ÑÉ¼¤¬œğ½Àøœ¬(€€€€€€€€€€€€€€€€œñ ÌûšnÓšZÃ–Ÿ–ºäğ½ Ìøœ¬(€€€€€€€€€€€€€€€€œñÕ°±…ÍÌô‰É•±•…Í”µÕÁ‘…Ñ”µ¹½Ñ•Ìˆøœ­¹½Ñ•Ì¬œğ½Õ°øœ¬(€€€€€€€€€€€€€€€€œñÀ±…ÍÌô‰É•±•…Í”µÕÁ‘…Ñ”µÁÕ‰±¥Í¡•ˆûfó–âšf¦ZO¾òhœ­•Í…Á•!Ñµ°¡™½Éµ…ÑAÕ‰±¥Í¡•‘Ğ¡µ…¹¥™•ÍĞ¹ÁÕ‰±¥Í¡•‘Ğ¤¤¬œğ½Àøœ¬(€€€€€€€€€€€€€€€ÍÕÁÁÉ•ÍÍQ½‘…ä¬(€€€€€€€€€€€€€€€…Ñ¥½¹Ì¬(€€€€€€€€€€€€œğ½Í•Ñ¥½¸øœ(€€€€€€€€¤ì(€€€ô((€€€™Õ¹Ñ¥½¸™½Éµ…ÑAÕ‰±¥Í¡•‘Ğ¡Ù…±Õ”¥ì(€€€€€€€½¹ÍĞ‘…Ñ”õ¹•Ü…Ñ”¡Ù…±Õ”¤ì(€€€€€€€¥˜¡9Õµ‰•È¹¥Í9…8¡‘…Ñ”¹•ÑQ¥µ” ¤¤¥ìÉ•ÑÕÉ¸Ù…±Õ”ìô(€€€€€€€½¹ÍĞåååäõ‘…Ñ”¹•ÑÕ±±e•…È ¤ì(€€€€€€€½¹ÍĞµ´õMÑÉ¥¹œ¡‘…Ñ”¹•Ñ5½¹Ñ  ¤¬Ä¤¹Á…‘MÑ…ÉĞ È°ˆÀˆ¤ì(€€€€€€€½¹ÍĞ‘õMÑÉ¥¹œ¡‘…Ñ”¹•Ñ…Ñ” ¤¤¹Á…‘MÑ…ÉĞ È°ˆÀˆ¤ì(€€€€€€€É•ÑÕÉ¸åååä¬ˆ´ˆ­µ´¬ˆ´ˆ­‘ì(€€€ô((€€€™Õ¹Ñ¥½¸‰¥¹‘I•±•…Í•Ñ¥½¹Ì¡‰½‘ä±­¥¹¥ì(€€€€€€€¥˜ …‰½‘åññÑåÁ•½˜‰½‘ä¹ÅÕ•ÉåM•±•Ñ½É±°„ôô‰™Õ¹Ñ¥½¸ˆ¥ìÉ•ÑÕÉ¸ìô(€€€€€€€‰½‘ä¹ÅÕ•ÉåM•±•Ñ½É±° ‰m‘…Ñ„µÉ•±•…Í”µÕÁ‘…Ñ”µ…Ñ¥½¹tˆ¤¹™½É… ¡‰ÕÑÑ½¸ôùì(€€€€€€€€€€€‰ÕÑÑ½¸¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ° ¤ôùì(€€€€€€€€€€€€€€€½¹ÍĞ…Ñ¥½¸õ‰ÕÑÑ½¸¹•ÑÑÑÉ¥‰ÕÑ” ‰‘…Ñ„µÉ•±•…Í”µÕÁ‘…Ñ”µ…Ñ¥½¸ˆ¤ì(€€€€€€€€€€€€€€€¥˜¡…Ñ¥½¸ôôô‰É•±½…ˆ¥ìÉ•ÅÕ•ÍÑI•±½… ¤ìô(€€€€€€€€€€€€€€€•±Í”¥˜¡…Ñ¥½¸ôôô‰±…Ñ•Èˆ¥ì‘•™•É9½Éµ…±UÁ‘…Ñ” ¤ìô(€€€€€€€€€€€€€€€•±Í”¥˜¡…Ñ¥½¸ôôô‰…­¹½İ±•‘”ˆ¥ì…­¹½İ±•‘•ÕÉÉ•¹ÑI•±•…Í” ¤ìô(€€€€€€€€€€€€€€€•±Í”¥˜¡…Ñ¥½¸ôôô‰ÁÉ•Ù¥•Üµ±½Í”ˆ¥ì±½Í•I•±•…Í••Ñ…¥° ¤ìô(€€€€€€€€€€€ô¤ì(€€€€€€€ô¤ì(€€€ô((€€€™Õ¹Ñ¥½¸½Á•¹I•±•…Í••Ñ…¥°¡­¥¹¥ì(€€€€€€€½¹ÍĞµ…¹¥™•ÍĞõÍÑ…Ñ”¹µ…¹¥™•ÍĞì(€€€€€€€½¹ÍĞÁ…ÉÑÌõ•ÑM¡…É•‘5½‘…±A…ÉÑÌ ¤ì(€€€€€€€¥˜ …µ…¹¥™•ÍÑñğ…Á…ÉÑÌ¥ìÉ•ÑÕÉ¸™…±Í”ìô(€€€€€€€½¹ÍĞ™½É•õ­¥¹ôôô‰™½É•ˆì(€€€€€€€¥˜¡™½É•˜˜……¹M…™•±åI•±½…‘½ÉUÁ‘…Ñ” ¤¥ì(€€€€€€€€€€€ÍÑ…Ñ”¹Á•¹‘¥¹½É•‘UÁ‘…Ñ”õÑÉÕ”ì(€€€€€€€€€€€Í¡½İ5…ÉÅÕ•”¡µ…¹¥™•ÍĞ°‰™½É•µÁ•¹‘¥¹œˆ¤ì(€€€€€€€€€€€Í¡•‘Õ±•A•¹‘¥¹I•Í½±ÕÑ¥½¸ ¤ì(€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€ô((€€€€€€€€¼¨á¥ÍÑ¥¹œ½İ¹•ÈÁ•É™½ÉµÌ¥ÑÌ¹½Éµ…°‰½ÉÉ½İ•µ•±•µ•¹Ğ±•…¹ÕÀ™¥ÉÍĞ¸€¨¼(€€€€€€€ÍÑ…Ñ”¹™½É•‘5½‘…±1½¬õ™…±Í”ì(€€€€€€€¥˜¡ÑåÁ•½˜±½‰…°¹±½Í•!½µ••…ÑÕÉ”ôôô‰™Õ¹Ñ¥½¸ˆ¥ì(€€€€€€€€€€€±½‰…°¹±½Í•!½µ••…ÑÕÉ” ¤ì(€€€€€€€õ•±Í•ì(€€€€€€€€€€€Á…ÉÑÌ¹µ½‘…°¹±…ÍÍ1¥ÍĞ¹É•µ½Ù” ‰Í¡½Üˆ¤ì(€€€€€€€ô((€€€€€€€Á…ÉÑÌ¹µ½‘…°¹±…ÍÍ1¥ÍĞ¹…‘ ‰É•±•…Í”µÕÁ‘…Ñ”µµ½‘…°ˆ¤ì(€€€€€€€Á…ÉÑÌ¹µ½‘…°¹±…ÍÍ1¥ÍĞ¹Ñ½±” ‰É•±•…Í”µÕÁ‘…Ñ”µ™½É•ˆ±™½É•¤ì(€€€€€€€Á…ÉÑÌ¹Ñ¥Ñ±”¹Ñ•áÑ½¹Ñ•¹Ğõµ…¹¥™•ÍĞ¹Ñ¥Ñ±”ì(€€€€€€€Á…ÉÑÌ¹‰½‘ä¹¥¹¹•É!Q50õÉ•¹‘•ÉI•±•…Í•½¹Ñ•¹Ğ¡µ…¹¥™•ÍĞ±­¥¹¤ì(€€€€€€€Á…ÉÑÌ¹µ½‘…°¹±…ÍÍ1¥ÍĞ¹…‘ ‰Í¡½Üˆ¤ì(€€€€€€€ÍÑ…Ñ”¹µ½‘…±=Á•¸õÑÉÕ”ì(€€€€€€€ÍÑ…Ñ”¹µ½‘…±-¥¹õ­¥¹ì(€€€€€€€ÍÑ…Ñ”¹™½É•‘5½‘…±1½¬õ™½É•ì(€€€€€€€¥˜¡­¥¹ôôô‰…­¹½İ±•‘”ˆ¥ìÍÑ…Ñ”¹±½¥¹¹¹½Õ¹•µ•¹ÑM¡½İ¸õÑÉÕ”ìô(€€€€€€€‰¥¹‘I•±•…Í•Ñ¥½¹Ì¡Á…ÉÑÌ¹‰½‘ä±­¥¹¤ì(€€€€€€€¥˜¡™½É•¥ì(€€€€€€€€€€€½¹ÍĞÁÉ¥µ…ÉäõÁ…ÉÑÌ¹‰½‘ä¹ÅÕ•ÉåM•±•Ñ½È ˆ¹É•±•…Í”µÕÁ‘…Ñ”µÁÉ¥µ…Éäˆ¤ì(€€€€€€€€€€€¥˜¡ÁÉ¥µ…Éä˜™ÑåÁ•½˜ÁÉ¥µ…Éä¹™½ÕÌôôô‰™Õ¹Ñ¥½¸ˆ¥ìÁÉ¥µ…Éä¹™½ÕÌ ¤ìô(€€€€€€€ô(€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€ô((€€€™Õ¹Ñ¥½¸½¹M¡…É•‘5½‘…±±½Í• ¥ì(€€€€€€€½¹ÍĞÁ…ÉÑÌõ•ÑM¡…É•‘5½‘…±A…ÉÑÌ ¤ì(€€€€€€€¥˜¡Á…ÉÑÌ¥ì(€€€€€€€€€€€Á…ÉÑÌ¹µ½‘…°¹±…ÍÍ1¥ÍĞ¹É•µ½Ù” ‰É•±•…Í”µÕÁ‘…Ñ”µµ½‘…°ˆ°‰É•±•…Í”µÕÁ‘…Ñ”µ™½É•ˆ¤ì(€€€€€€€ô(€€€€€€€ÍÑ…Ñ”¹µ½‘…±=Á•¸õ™…±Í”ì(€€€€€€€ÍÑ…Ñ”¹µ½‘…±-¥¹õ¹Õ±°ì(€€€€€€€ÍÑ…Ñ”¹™½É•‘5½‘…±1½¬õ™…±Í”ì(€€€ô((€€€™Õ¹Ñ¥½¸Í¡½Õ±‘AÉ•Ù•¹ÑM¡…É•‘5½‘…±±½Í” ¥ì(€€€€€€€É•ÑÕÉ¸ÍÑ…Ñ”¹™½É•‘5½‘…±1½¬˜™ÍÑ…Ñ”¹µ½‘…±=Á•¸ì(€€€ô((€€€™Õ¹Ñ¥½¸¥Í½É•‘UÁ‘…Ñ•	±½­¥¹œ ¥ì(€€€€€€€É•ÑÕÉ¸Í¡½Õ±‘AÉ•Ù•¹ÑM¡…É•‘5½‘…±±½Í” ¤ì(€€€ô((€€€™Õ¹Ñ¥½¸…¹¹½Õ¹•½É•‘1½¬ ¥ì(€€€€€€€½¹ÍĞÁ…ÉÑÌõ•ÑM¡…É•‘5½‘…±A…ÉÑÌ ¤ì(€€€€€€€¥˜¡Á…ÉÑÌ˜™Á…ÉÑÌ¹µ½‘…°¹±…ÍÍ1¥ÍĞ¹½¹Ñ…¥¹Ì ‰É•±•…Í”µÕÁ‘…Ñ”µ™½É•ˆ¤¥ì(€€€€€€€€€€€½¹ÍĞÁÉ¥µ…ÉäõÁ…ÉÑÌ¹‰½‘ä¹ÅÕ•ÉåM•±•Ñ½È ˆ¹É•±•…Í”µÕÁ‘…Ñ”µÁÉ¥µ…Éäˆ¤ì(€€€€€€€€€€€¥˜¡ÁÉ¥µ…Éä˜™ÑåÁ•½˜ÁÉ¥µ…Éä¹™½ÕÌôôô‰™Õ¹Ñ¥½¸ˆ¥ìÁÉ¥µ…Éä¹™½ÕÌ ¤ìô(€€€€€€€ô(€€€ô((€€€™Õ¹Ñ¥½¸±½Í•I•±•…Í••Ñ…¥° ¥ì(€€€€€€€ÍÑ…Ñ”¹™½É•‘5½‘…±1½¬õ™…±Í”ì(€€€€€€€¥˜¡ÑåÁ•½˜±½‰…°¹±½Í•!½µ••…ÑÕÉ”ôôô‰™Õ¹Ñ¥½¸ˆ¥ì(€€€€€€€€€€€±½‰…°¹±½Í•!½µ••…ÑÕÉ” ¤ì(€€€€€€€õ•±Í•ì(€€€€€€€€€€€½¹ÍĞÁ…ÉÑÌõ•ÑM¡…É•‘5½‘…±A…ÉÑÌ ¤ì(€€€€€€€€€€€¥˜¡Á…ÉÑÌ¥ìÁ…ÉÑÌ¹µ½‘…°¹±…ÍÍ1¥ÍĞ¹É•µ½Ù” ‰Í¡½Üˆ¤ìô(€€€€€€€€€€€½¹M¡…É•‘5½‘…±±½Í• ¤ì(€€€€€€€ô(€€€ô((€€€™Õ¹Ñ¥½¸…­¹½İ±•‘•ÕÉÉ•¹ÑI•±•…Í” ¥ì(€€€€€€€½¹ÍĞÁ…ÉÑÌõ•ÑM¡…É•‘5½‘…±A…ÉÑÌ ¤ì(€€€€€€€½¹ÍĞ¡•­‰½àõÁ…ÉÑÌ˜™Á…ÉÑÌ¹‰½‘ä˜™ÑåÁ•½˜Á…ÉÑÌ¹‰½‘ä¹ÅÕ•ÉåM•±•Ñ½Èôôô‰™Õ¹Ñ¥½¸ˆ(€€€€€€€€€€€€ıÁ…ÉÑÌ¹‰½‘ä¹ÅÕ•ÉåM•±•Ñ½È ˆ¹É•±•…Í”µÕÁ‘…Ñ”µÍÕÁÁÉ•ÍÌµÑ½‘…äµ¥¹ÁÕĞˆ¤(€€€€€€€€€€€€é¹Õ±°ì(€€€€€€€Í•ÑÕÉÉ•¹Ñ9½Ñ¥•MÕÁÁÉ•ÍÍ•‘Q½‘…ä „„¡¡•­‰½à˜™¡•­‰½à¹¡•­•¤¤ì(€€€€€€€µ…É­ÕÉÉ•¹Ñ9½Ñ¥•M••¸ ¤ì(€€€€€€€ÍÑ…Ñ”¹Á•¹‘¥¹¹¹½Õ¹•µ•¹Ğõ™…±Í”ì(€€€€€€€±½Í•I•±•…Í••Ñ…¥° ¤ì(€€€€€€€É•™É•Í¡9½Ñ¥™¥…Ñ¥½¹½ÑÌ ¤ì(€€€ô((€€€™Õ¹Ñ¥½¸‘•™•É9½Éµ…±UÁ‘…Ñ” ¥ì(€€€€€€€½¹ÍĞµ…¹¥™•ÍĞõÍÑ…Ñ”¹µ…¹¥™•ÍĞì(€€€€€€€¥˜ …µ…¹¥™•ÍĞ¥ìÉ•ÑÕÉ¸ìô(€€€€€€€¥˜¡ÍÑ…Ñ”¹‘•ÙAÉ•Ù¥•İ5½‘”¥ì(€€€€€€€€€€€±½Í•I•±•…Í••Ñ…¥° ¤ì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€ô(€€€€€€€µ…É­ÕÉÉ•¹Ñ9½Ñ¥•M••¸ ¤ì(€€€€€€€¡¥‘•5…ÉÅÕ•” ¤ì(€€€€€€€±½Í•I•±•…Í••Ñ…¥° ¤ì(€€€€€€€É•™É•Í¡9½Ñ¥™¥…Ñ¥½¹½ÑÌ ¤ì(€€€ô((€€€™Õ¹Ñ¥½¸Á•É™½ÉµI•±½… ¥ì(€€€€€€€ÑÉåì(€€€€€€€€€€€¥˜¡±½‰…°¹±½…Ñ¥½¸˜™ÑåÁ•½˜±½‰…°¹±½…Ñ¥½¸¹É•±½…ôôô‰™Õ¹Ñ¥½¸ˆ¥ì(€€€€€€€€€€€€€€€±½‰…°¹±½…Ñ¥½¸¹É•±½… ¤ì(€€€€€€€€€€€ô(€€€€€€€õ…Ñ ¡|¥ìô(€€€ô((€€€™Õ¹Ñ¥½¸É•ÅÕ•ÍÑI•±½… ¥ì(€€€€€€€½¹ÍĞµ…¹¥™•ÍĞõÍÑ…Ñ”¹µ…¹¥™•ÍĞì(€€€€€€€¥˜ …µ…¹¥™•ÍĞ¥ìÉ•ÑÕÉ¸™…±Í”ìô(€€€€€€€¥˜¡ÍÑ…Ñ”¹‘•ÙAÉ•Ù¥•İ5½‘”¥ì(€€€€€€€€€€€±½Í•I•±•…Í••Ñ…¥° ¤ì(€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€ô(€€€€€€€µ…É­ÕÉÉ•¹Ñ9½Ñ¥•M••¸ ¤ì(€€€€€€€½¹ÍĞ™½É•õ¥Í½É•‘½É1½…‘•‘Y•ÉÍ¥½¸¡µ…¹¥™•ÍĞ¤ì(€€€€€€€¥˜ ……¹M…™•±åI•±½…‘½ÉUÁ‘…Ñ” ¤¥ì(€€€€€€€€€€€¥˜¡™½É•¥ìÍÑ…Ñ”¹Á•¹‘¥¹½É•‘UÁ‘…Ñ”õÑÉÕ”ìô(€€€€€€€€€€€•±Í•ìÍÑ…Ñ”¹Á•¹‘¥¹9½Éµ…±I•±½…õÑÉÕ”ìô(€€€€€€€€€€€ÍÑ…Ñ”¹™½É•‘5½‘…±1½¬õ™…±Í”ì(€€€€€€€€€€€±½Í•I•±•…Í••Ñ…¥° ¤ì(€€€€€€€€€€€Í¡½İ5…ÉÅÕ•”¡µ…¹¥™•ÍĞ±™½É•ü‰™½É•µÁ•¹‘¥¹œˆè‰¹½Éµ…°µÁ•¹‘¥¹œˆ¤ì(€€€€€€€€€€€Í¡•‘Õ±•A•¹‘¥¹I•Í½±ÕÑ¥½¸ ¤ì(€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€ô(€€€€€€€Á•É™½ÉµI•±½… ¤ì(€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€ô((€€€™Õ¹Ñ¥½¸¡…ÍA•¹‘¥¹]½É¬ ¥ì(€€€€€€€É•ÑÕÉ¸ÍÑ…Ñ”¹Á•¹‘¥¹½É•‘UÁ‘…Ñ•ññÍÑ…Ñ”¹Á•¹‘¥¹9½Éµ…±I•±½…‘ññÍÑ…Ñ”¹Á•¹‘¥¹¹¹½Õ¹•µ•¹Ğì(€€€ô((€€€™Õ¹Ñ¥½¸Í¡•‘Õ±•A•¹‘¥¹I•Í½±ÕÑ¥½¸ ¥ì(€€€€€€€¥˜ …¡…ÍA•¹‘¥¹]½É¬ ¥ññÍÑ…Ñ”¹Á•¹‘¥¹Q¥µ•È„ôõ¹Õ±°¥ìÉ•ÑÕÉ¸ìô(€€€€€€€ÍÑ…Ñ”¹Á•¹‘¥¹Q¥µ•Èõ±½‰…°¹Í•ÑQ¥µ•½ÕĞ  ¤ôùì(€€€€€€€€€€€ÍÑ…Ñ”¹Á•¹‘¥¹Q¥µ•Èõ¹Õ±°ì(€€€€€€€€€€€É•Í½±Ù•A•¹‘¥¹]¡•¹M…™” ¤ì(€€€€€€€ô±A9%9}I!-}5L¤ì(€€€ô((€€€™Õ¹Ñ¥½¸É•Í½±Ù•A•¹‘¥¹]¡•¹M…™” ¥ì(€€€€€€€¥˜ …¡…ÍA•¹‘¥¹]½É¬ ¤¥ìÉ•ÑÕÉ¸ìô(€€€€€€€¥˜ ……¹M…™•±åI•±½…‘½ÉUÁ‘…Ñ” ¤¥ì(€€€€€€€€€€€Í¡•‘Õ±•A•¹‘¥¹I•Í½±ÕÑ¥½¸ ¤ì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€ô(€€€€€€€¥˜¡ÍÑ…Ñ”¹Á•¹‘¥¹½É•‘UÁ‘…Ñ”¥ì(€€€€€€€€€€€ÍÑ…Ñ”¹Á•¹‘¥¹½É•‘UÁ‘…Ñ”õ™…±Í”ì(€€€€€€€€€€€½Á•¹I•±•…Í••Ñ…¥° ‰™½É•ˆ¤ì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€ô(€€€€€€€¥˜¡ÍÑ…Ñ”¹Á•¹‘¥¹9½Éµ…±I•±½…¥ì(€€€€€€€€€€€ÍÑ…Ñ”¹Á•¹‘¥¹9½Éµ…±I•±½…õ™…±Í”ì(€€€€€€€€€€€Á•É™½ÉµI•±½… ¤ì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€ô(€€€€€€€¥˜¡ÍÑ…Ñ”¹Á•¹‘¥¹¹¹½Õ¹•µ•¹Ğ¥ì(€€€€€€€€€€€¥˜¡¥ÍÕÉÉ•¹Ñ9½Ñ¥•MÕÁÁÉ•ÍÍ•‘Q½‘…ä¡ÍÑ…Ñ”¹µ…¹¥™•ÍĞ¤¥ì(€€€€€€€€€€€€€€€ÍÑ…Ñ”¹Á•¹‘¥¹¹¹½Õ¹•µ•¹Ğõ™…±Í”ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€€€€€ô(€€€€€€€€€€€¥˜ …¥ÍM¡…É•‘5½‘…±Ù…¥±…‰±•½É¹¹½Õ¹•µ•¹Ğ ¤¥ì(€€€€€€€€€€€€€€€Í¡•‘Õ±•A•¹‘¥¹I•Í½±ÕÑ¥½¸ ¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€€€€€ô(€€€€€€€€€€€ÍÑ…Ñ”¹Á•¹‘¥¹¹¹½Õ¹•µ•¹Ğõ™…±Í”ì(€€€€€€€€€€€½Á•¹I•±•…Í••Ñ…¥° ‰…­¹½İ±•‘”ˆ¤ì(€€€€€€€ô(€€€ô((€€€™Õ¹Ñ¥½¸É•™É•Í¡9½Ñ¥™¥…Ñ¥½¹½ÑÌ ¥ì(€€€€€€€ÑÉåì(€€€€€€€€€€€¥˜¡ÑåÁ•½˜±½‰…°¹ØÄĞÅUÁ‘…Ñ•9½Ñ¥™¥…Ñ¥½¹½ÑÌôôô‰™Õ¹Ñ¥½¸ˆ¥ì(€€€€€€€€€€€€€€€±½‰…°¹ØÄĞÅUÁ‘…Ñ•9½Ñ¥™¥…Ñ¥½¹½ÑÌ ¤ì(€€€€€€€€€€€ô(€€€€€€€õ…Ñ ¡|¥ìô(€€€ô((€€€™Õ¹Ñ¥½¸É•™É•Í¡¹¹½Õ¹•µ•¹ÑMÕÉ™…” ¥ì(€€€€€€€½¹ÍĞÁ…ÉÑÌõ•ÑM¡…É•‘5½‘…±A…ÉÑÌ ¤ì(€€€€€€€¥˜ (€€€€€€€€€€€€…Á…ÉÑÍññÍÑ…Ñ”¹µ½‘…±=Á•¹ñğ…Á…ÉÑÌ¹µ½‘…°¹±…ÍÍ1¥ÍĞ¹½¹Ñ…¥¹Ì ‰Í¡½Üˆ¥ñğ(€€€€€€€€€€€Á…ÉÑÌ¹Ñ¥Ñ±”¹Ñ•áÑ½¹Ñ•¹Ğ„ôô‹–³–F(ˆ(€€€€€€€€¥ì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€ô(€€€€€€€½¹ÍĞ½¹Ñ•¹ĞõÉ•¹‘•É¹¹½Õ¹•µ•¹Ñ½¹Ñ•¹Ğ ¤ì(€€€€€€€¥˜¡½¹Ñ•¹Ğ¥ìÁ…ÉÑÌ¹‰½‘ä¹¥¹¹•É!Q50õ½¹Ñ•¹Ğìô(€€€ô((€€€™Õ¹Ñ¥½¸É•¹‘•É¹¹½Õ¹•µ•¹Ñ½¹Ñ•¹Ğ ¥ì(€€€€€€€½¹ÍĞµ…¹¥™•ÍĞõÍÑ…Ñ”¹µ…¹¥™•ÍĞì(€€€€€€€¥˜ …µ…¹¥™•ÍÑñğ…µ…¹¥™•ÍĞ¹ÁÕ‰±¥9½Ñ¥”¥ìÉ•ÑÕÉ¸€ˆˆìô(€€€€€€€½¹ÍĞ±½…‘•õÍÑ…Ñ”¹±½…‘•‘I•±•…Í•Y•ÉÍ¥½¹ññ•Ñ1½…‘•‘I•±•…Í•Y•ÉÍ¥½¸ ¤ì(€€€€€€€½¹ÍĞ½µÁ…É¥Í½¸õ±½…‘•ı½µÁ…É•Y•ÉÍ¥½¹Ì¡±½…‘•±µ…¹¥™•ÍĞ¹É•±•…Í•Y•ÉÍ¥½¸¤é¹Õ±°ì(€€€€€€€½¹ÍĞ¹••‘ÍUÁ‘…Ñ”õ½µÁ…É¥Í½¸„ôõ¹Õ±°˜™½µÁ…É¥Í½¸ğÀì(€€€€€€€½¹ÍĞ…Ñ¥½¹1…‰•°õ¹••‘ÍUÁ‘…Ñ”ü‹š~—r/šnÓšZÃ–Ÿ–ºäˆè‹š~—r/šr³š²‡šnÓšZÀˆì(€€€€€€€½¹ÍĞÍÑ…ÑÕÌõ¹••‘ÍUÁ‘…Ñ”(€€€€€€€€€€€€ü€‹–ŞËšr'šZÃ&#šr³–>¿šnÓšZÃ¾òo–º3š"Cn»–&7šN7’ös–ú3–6Ï–>¿šnÓšZÃˆ(€€€€€€€€€€€€è€‹n»–&7š¶–ò?&#šr³jšnÓšZÃ–Ÿ–ºçˆì(€€€€€€€É•ÑÕÉ¸€ (€€€€€€€€€€€€œñÍ•Ñ¥½¸±…ÍÌô‰É•±•…Í”µÕÁ‘…Ñ”µ…¹¹½Õ¹•µ•¹Ğˆøœ¬(€€€€€€€€€€€€€€€€œñÀ±…ÍÌô‰É•±•…Í”µÕÁ‘…Ñ”µ…¹¹½Õ¹•µ•¹ĞµÙ•ÉÍ¥½¸ˆøœ­•Í…Á•!Ñµ°¡µ…¹¥™•ÍĞ¹É•±•…Í•Y•ÉÍ¥½¸¤¬œƒšnÓšZÀğ½Àøœ¬(€€€€€€€€€€€€€€€€œñÀøœ­•Í…Á•!Ñµ°¡µ…¹¥™•ÍĞ¹ÍÕµµ…Éä¤¬œğ½Àøœ¬(€€€€€€€€€€€€€€€€œñÀ±…ÍÌô‰É•±•…Í”µÕÁ‘…Ñ”µ…¹¹½Õ¹•µ•¹ĞµÍÑ…ÑÕÌˆøœ­•Í…Á•!Ñµ°¡ÍÑ…ÑÕÌ¤¬œğ½Àøœ¬(€€€€€€€€€€€€€€€€œñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÌô‰É•±•…Í”µÕÁ‘…Ñ”µÁÉ¥µ…Éäˆ½¹±¥¬ô‰İ¥¹‘½Ü¹½ÕÉMåµ‰½±ÍI•±•…Í•UÁ‘…Ñ”¹½Á•¹É½µ¹¹½Õ¹•µ•¹Ğ ¤ˆøœ­…Ñ¥½¹1…‰•°¬œğ½‰ÕÑÑ½¸øœ¬(€€€€€€€€€€€€œğ½Í•Ñ¥½¸øœ(€€€€€€€€¤ì(€€€ô((€€€™Õ¹Ñ¥½¸½Á•¹É½µ¹¹½Õ¹•µ•¹Ğ ¥ì(€€€€€€€½¹ÍĞµ…¹¥™•ÍĞõÍÑ…Ñ”¹µ…¹¥™•ÍĞì(€€€€€€€¥˜ …µ…¹¥™•ÍĞ¥ìÉ•ÑÕÉ¸™…±Í”ìô(€€€€€€€½¹ÍĞ±½…‘•õÍÑ…Ñ”¹±½…‘•‘I•±•…Í•Y•ÉÍ¥½¹ññ•Ñ1½…‘•‘I•±•…Í•Y•ÉÍ¥½¸ ¤ì(€€€€€€€½¹ÍĞ¹••‘ÍUÁ‘…Ñ”õ±½…‘•˜™½µÁ…É•Y•ÉÍ¥½¹Ì¡±½…‘•±µ…¹¥™•ÍĞ¹É•±•…Í•Y•ÉÍ¥½¸¤ğÀì(€€€€€€€É•ÑÕÉ¸½Á•¹I•±•…Í••Ñ…¥°¡¹••‘ÍUÁ‘…Ñ”˜™¥Í½É•‘½É1½…‘•‘Y•ÉÍ¥½¸¡µ…¹¥™•ÍĞ¤ü‰™½É•ˆé¹••‘ÍUÁ‘…Ñ”ü‰ÕÁ‘…Ñ”ˆè‰…­¹½İ±•‘”ˆ¤ì(€€€ô((€€€…Íå¹Œ™Õ¹Ñ¥½¸™•Ñ¡5…¹¥™•ÍĞ ¥ì(€€€€€€€½¹ÍĞ™•Ñ¡•ÈõÑåÁ•½˜±½‰…°¹™•Ñ ôôô‰™Õ¹Ñ¥½¸ˆı±½‰…°¹™•Ñ ¹‰¥¹¡±½‰…°¤é¹Õ±°ì(€€€€€€€¥˜ …™•Ñ¡•È¥ìÉ•ÑÕÉ¸¹Õ±°ìô(€€€€€€€±•ĞÑ¥µ•½ÕÑ%õ¹Õ±°ì(€€€€€€€±•Ğ½¹ÑÉ½±±•Èõ¹Õ±°ì(€€€€€€€ÑÉåì(€€€€€€€€€€€¥˜¡ÑåÁ•½˜±½‰…°¹‰½ÉÑ½¹ÑÉ½±±•Èôôô‰™Õ¹Ñ¥½¸ˆ¥ì(€€€€€€€€€€€€€€€½¹ÑÉ½±±•Èõ¹•Ü±½‰…°¹‰½ÉÑ½¹ÑÉ½±±•È ¤ì(€€€€€€€€€€€€€€€Ñ¥µ•½ÕÑ%õ±½‰…°¹Í•ÑQ¥µ•½ÕĞ  ¤ôù½¹ÑÉ½±±•È¹…‰½ÉĞ ¤±IEUMQ}Q%5=UQ}5L¤ì(€€€€€€€€€€€ô(€€€€€€€€€€€±•ĞÕÉ°õI1M}9=Q%}AQ ì(€€€€€€€€€€€ÑÉåì(€€€€€€€€€€€€€€€½¹ÍĞ‰…Í”ô¡±½‰…°¹‘½Õµ•¹Ğ˜™±½‰…°¹‘½Õµ•¹Ğ¹‰…Í•UI$¥ñğ¡±½‰…°¹±½…Ñ¥½¸˜™±½‰…°¹±½…Ñ¥½¸¹¡É•˜¥ññÕ¹‘•™¥¹•ì(€€€€€€€€€€€€€€€½¹ÍĞÁ…ÉÍ•õ¹•ÜUI0¡I1M}9=Q%}AQ ±‰…Í”¤ì(€€€€€€€€€€€€€€€Á…ÉÍ•¹Í•…É¡A…É…µÌ¹Í•Ğ ‰É•±•…Í”µÕÁ‘…Ñ”µ¡•¬ˆ±MÑÉ¥¹œ¡¹½Ü ¤¤¤ì(€€€€€€€€€€€€€€€ÕÉ°õÁ…ÉÍ•¹Ñ½MÑÉ¥¹œ ¤ì(€€€€€€€€€€€õ…Ñ ¡|¥ì(€€€€€€€€€€€€€€€ÕÉ°õI1M}9=Q%}AQ ¬ˆıÉ•±•…Í”µÕÁ‘…Ñ”µ¡•¬ôˆ­¹½Ü ¤ì(€€€€€€€€€€€ô(€€€€€€€€€€€½¹ÍĞÉ•ÍÁ½¹Í”õ…İ…¥Ğ™•Ñ¡•È¡ÕÉ°±ì(€€€€€€€€€€€€€€€…¡”è‰¹¼µÍÑ½É”ˆ°(€€€€€€€€€€€€€€€¡•…‘•ÉÌéì‰…¡”µ½¹ÑÉ½°ˆè‰¹¼µ…¡”‰ô°(€€€€€€€€€€€€€€€€¸¸¸¡½¹ÑÉ½±±•ÈıíÍ¥¹…°é½¹ÑÉ½±±•È¹Í¥¹…±ôéíô¤(€€€€€€€€€€€ô¤ì(€€€€€€€€€€€¥˜ …É•ÍÁ½¹Í•ññÉ•ÍÁ½¹Í”¹½¬ôôõ™…±Í•ññÑåÁ•½˜É•ÍÁ½¹Í”¹©Í½¸„ôô‰™Õ¹Ñ¥½¸ˆ¥ìÉ•ÑÕÉ¸¹Õ±°ìô(€€€€€€€€€€€É•ÑÕÉ¸Ù…±¥‘…Ñ•5…¹¥™•ÍĞ¡…İ…¥ĞÉ•ÍÁ½¹Í”¹©Í½¸ ¤¤ì(€€€€€€€õ…Ñ ¡|¥ì(€€€€€€€€€€€€¼¨=™™±¥¹”°Ñ¥µ•½ÕĞ°µ…±™½Éµ•)M=8…¹Ñ•µÁ½É…Éä‘•Á±½ä…ÁÌµÕÍĞ¹•Ù•È‰±½¬Á±…ä¸€¨¼(€€€€€€€€€€€É•ÑÕÉ¸¹Õ±°ì(€€€€€€€õ™¥¹…±±åì(€€€€€€€€€€€¥˜¡Ñ¥µ•½ÕÑ%„ôõ¹Õ±°¥ì±½‰…°¹±•…ÉQ¥µ•½ÕĞ¡Ñ¥µ•½ÕÑ%¤ìô(€€€€€€€ô(€€€ô((€€€™Õ¹Ñ¥½¸¡…¹‘±•5…¹¥™•ÍĞ¡µ…¹¥™•ÍĞ¥ì(€€€€€€€¥˜ …µ…¹¥™•ÍĞ¥ìÉ•ÑÕÉ¸ìô(€€€€€€€ÍÑ…Ñ”¹µ…¹¥™•ÍĞõµ…¹¥™•ÍĞì(€€€€€€€ÍÑ…Ñ”¹±½…‘•‘I•±•…Í•Y•ÉÍ¥½¸õ•Ñ1½…‘•‘I•±•…Í•Y•ÉÍ¥½¸ ¤ì(€€€€€€€ÍÑ…Ñ”¹‘•ÙAÉ•Ù¥•İ5½‘”õ¹Õ±°ì(€€€€€€€¥˜ …µ…¹¥™•ÍĞ¹ÁÕ‰±¥9½Ñ¥•ñğ…ÍÑ…Ñ”¹±½…‘•‘I•±•…Í•Y•ÉÍ¥½¸¥ì(€€€€€€€€€€€¡¥‘•5…ÉÅÕ•” ¤ì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€ô(€€€€€€€½¹ÍĞ‘•ÙAÉ•Ù¥•İ5½‘”õ•Ñ•ÙAÉ•Ù¥•İ5½‘” ¤ì(€€€€€€€¥˜¡‘•ÙAÉ•Ù¥•İ5½‘”¥ì(€€€€€€€€€€€ÍÑ…Ñ”¹‘•ÙAÉ•Ù¥•İ5½‘”õ‘•ÙAÉ•Ù¥•İ5½‘”ì(€€€€€€€€€€€¥˜¡‘•ÙAÉ•Ù¥•İ5½‘”ôôô‰µ½‘…°ˆ¥ì(€€€€€€€€€€€€€€€½Á•¹I•±•…Í••Ñ…¥°¡¥Í½É•‘½É1½…‘•‘Y•ÉÍ¥½¸¡µ…¹¥™•ÍĞ¤ü‰™½É•ˆè‰ÁÉ•Ù¥•Üˆ¤ì(€€€€€€€€€€€õ•±Í•ì(€€€€€€€€€€€€€€€Í¡½İ5…ÉÅÕ•”¡µ…¹¥™•ÍĞ±¥Í½É•‘½É1½…‘•‘Y•ÉÍ¥½¸¡µ…¹¥™•ÍĞ¤ü‰™½É•ˆè‰ÕÁ‘…Ñ”ˆ¤ì(€€€€€€€€€€€ô(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€ô(€€€€€€€½¹ÍĞ½µÁ…É¥Í½¸õ½µÁ…É•Y•ÉÍ¥½¹Ì¡ÍÑ…Ñ”¹±½…‘•‘I•±•…Í•Y•ÉÍ¥½¸±µ…¹¥™•ÍĞ¹É•±•…Í•Y•ÉÍ¥½¸¤ì(€€€€€€€¥˜¡½µÁ…É¥Í½¸ôôõ¹Õ±±ññ½µÁ…É¥Í½¸øÀ¥ìÉ•ÑÕÉ¸ìô(€€€€€€€¥˜¡½µÁ…É¥Í½¸ôôôÀ¥ì(€€€€€€€€€€€É•™É•Í¡¹¹½Õ¹•µ•¹ÑMÕÉ™…” ¤ì(€€€€€€€€€€€É•™É•Í¡9½Ñ¥™¥…Ñ¥½¹½ÑÌ ¤ì(€€€€€€€€€€€¥˜¡Í¡½Õ±‘ÕÑ½M¡½İ1½¥¹¹¹½Õ¹•µ•¹Ğ¡µ…¹¥™•ÍĞ¤¥ì(€€€€€€€€€€€€€€€¥˜¡…¹M…™•±åI•±½…‘½ÉUÁ‘…Ñ” ¤˜™¥ÍM¡…É•‘5½‘…±Ù…¥±…‰±•½É¹¹½Õ¹•µ•¹Ğ ¤¥ì(€€€€€€€€€€€€€€€€€€€½Á•¹I•±•…Í••Ñ…¥° ‰…­¹½İ±•‘”ˆ¤ì(€€€€€€€€€€€€€€€õ•±Í•ì(€€€€€€€€€€€€€€€€€€€ÍÑ…Ñ”¹Á•¹‘¥¹¹¹½Õ¹•µ•¹ĞõÑÉÕ”ì(€€€€€€€€€€€€€€€€€€€Í¡½İ5…ÉÅÕ•”¡µ…¹¥™•ÍĞ°‰…¹¹½Õ¹•µ•¹ĞµÁ•¹‘¥¹œˆ¤ì(€€€€€€€€€€€€€€€€€€€Í¡•‘Õ±•A•¹‘¥¹I•Í½±ÕÑ¥½¸ ¤ì(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€ô(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€ô((€€€€€€€½¹ÍĞ™½É•õ¥Í½É•‘½É1½…‘•‘Y•ÉÍ¥½¸¡µ…¹¥™•ÍĞ¤ì(€€€€€€€¥˜¡™½É•¥ì(€€€€€€€€€€€¥˜¡¥Í½É•‘UÁ‘…Ñ•	±½­¥¹œ ¤¥ìÉ•ÑÕÉ¸ìô(€€€€€€€€€€€ÍÑ…Ñ”¹Á•¹‘¥¹½É•‘UÁ‘…Ñ”õÑÉÕ”ì(€€€€€€€€€€€Í¡½İ5…ÉÅÕ•”¡µ…¹¥™•ÍĞ±…¹M…™•±åI•±½…‘½ÉUÁ‘…Ñ” ¤ü‰™½É•ˆè‰™½É•µÁ•¹‘¥¹œˆ¤ì(€€€€€€€€€€€¥˜¡…¹M…™•±åI•±½…‘½ÉUÁ‘…Ñ” ¤¥ì(€€€€€€€€€€€€€€€É•Í½±Ù•A•¹‘¥¹]¡•¹M…™” ¤ì(€€€€€€€€€€€õ•±Í•ì(€€€€€€€€€€€€€€€Í¡•‘Õ±•A•¹‘¥¹I•Í½±ÕÑ¥½¸ ¤ì(€€€€€€€€€€€ô(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€ô((€€€€€€€¥˜¡Í¡½Õ±‘M¡½İI•µ¥¹‘•È¡µ…¹¥™•ÍĞ¤¥ì(€€€€€€€€€€€É•µ•µ‰•ÉI•µ¥¹‘•È¡µ…¹¥™•ÍĞ¤ì(€€€€€€€€€€€Í¡½İ5…ÉÅÕ•”¡µ…¹¥™•ÍĞ°‰ÕÁ‘…Ñ”ˆ¤ì(€€€€€€€ô(€€€€€€€É•™É•Í¡¹¹½Õ¹•µ•¹ÑMÕÉ™…” ¤ì(€€€€€€€É•™É•Í¡9½Ñ¥™¥…Ñ¥½¹½ÑÌ ¤ì(€€€ô((€€€™Õ¹Ñ¥½¸¡•­½ÉUÁ‘…Ñ”¡É•…Í½¸±½ÁÑ¥½¹Ì¥ì(€€€€€€€½¹ÍĞ™½É”ô„„¡½ÁÑ¥½¹Ì˜™½ÁÑ¥½¹Ì¹™½É”¤ì(€€€€€€€¥˜¡ÍÑ…Ñ”¹¡•­¥¹œ¥ìÉ•ÑÕÉ¸ÍÑ…Ñ”¹¡•­¥¹œìô(€€€€€€€¥˜ …™½É”˜™ÍÑ…Ñ”¹±…ÍÑ¡•­Ğ˜™¹½Ü ¤µÍÑ…Ñ”¹±…ÍÑ¡•­Ğñ5%9}!-}A}5L¥ì(€€€€€€€€€€€É•ÑÕÉ¸AÉ½µ¥Í”¹É•Í½±Ù”¡¹Õ±°¤ì(€€€€€€€ô(€€€€€€€ÍÑ…Ñ”¹±…ÍÑ¡•­Ğõ¹½Ü ¤ì(€€€€€€€ÍÑ…Ñ”¹¡•­¥¹œõ™•Ñ¡5…¹¥™•ÍĞ ¤¹Ñ¡•¸¡µ…¹¥™•ÍĞôùì(€€€€€€€€€€€¥˜¡µ…¹¥™•ÍĞ¥ì¡…¹‘±•5…¹¥™•ÍĞ¡µ…¹¥™•ÍĞ±É•…Í½¸¤ìô(€€€€€€€€€€€É•ÑÕÉ¸µ…¹¥™•ÍĞì(€€€€€€€ô¤¹™¥¹…±±ä  ¤ôùì(€€€€€€€€€€€ÍÑ…Ñ”¹¡•­¥¹œõ¹Õ±°ì(€€€€€€€ô¤ì(€€€€€€€É•ÑÕÉ¸ÍÑ…Ñ”¹¡•­¥¹œì(€€€ô((€€€™Õ¹Ñ¥½¸ÍÑ…ÉĞ ¥ì(€€€€€€€¥˜¡ÍÑ…Ñ”¹ÍÑ…ÉÑ•¥ìÉ•ÑÕÉ¸ìô(€€€€€€€ÍÑ…Ñ”¹ÍÑ…ÉÑ•õÑÉÕ”ì(€€€€€€€¡•­½ÉUÁ‘…Ñ” ‰‰½½Ğˆ±í™½É”éÑÉÕ•ô¤ì(€€€€€€€ÍÑ…Ñ”¹Á½±±Q¥µ•Èõ±½‰…°¹Í•Ñ%¹Ñ•ÉÙ…°  ¤ôù¡•­½ÉUÁ‘…Ñ” ‰Á½±°ˆ¤±!-}%9QIY1}5L¤ì(€€€€€€€½¹ÍĞ‘½Õµ•¹ÑI•˜õ±½‰…°¹‘½Õµ•¹Ğì(€€€€€€€¥˜¡‘½Õµ•¹ÑI•˜˜™ÑåÁ•½˜‘½Õµ•¹ÑI•˜¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•Èôôô‰™Õ¹Ñ¥½¸ˆ¥ì(€€€€€€€€€€€‘½Õµ•¹ÑI•˜¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰Ù¥Í¥‰¥±¥Ñå¡…¹”ˆ° ¤ôùì(€€€€€€€€€€€€€€€¥˜¡‘½Õµ•¹ÑI•˜¹¡¥‘‘•¹ññ‘½Õµ•¹ÑI•˜¹Ù¥Í¥‰¥±¥ÑåMÑ…Ñ”ôôô‰¡¥‘‘•¸ˆ¥ìÉ•ÑÕÉ¸ìô(€€€€€€€€€€€€€€€¡•­½ÉUÁ‘…Ñ” ‰Ù¥Í¥‰¥±¥Ñäˆ¤ì(€€€€€€€€€€€ô¤ì(€€€€€€€€€€€‘½Õµ•¹ÑI•˜¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰­•å‘½İ¸ˆ±•Ù•¹Ğôùì(€€€€€€€€€€€€€€€¥˜¡•Ù•¹Ğ˜™•Ù•¹Ğ¹­•äôôô‰Í…Á”ˆ˜™¥Í½É•‘UÁ‘…Ñ•	±½­¥¹œ ¤¥ì(€€€€€€€€€€€€€€€€€€€•Ù•¹Ğ¹ÁÉ•Ù•¹Ñ•™…Õ±Ğ ¤ì(€€€€€€€€€€€€€€€€€€€¥˜¡ÑåÁ•½˜•Ù•¹Ğ¹ÍÑ½Á%µµ•‘¥…Ñ•AÉ½Á……Ñ¥½¸ôôô‰™Õ¹Ñ¥½¸ˆ¥ì•Ù•¹Ğ¹ÍÑ½Á%µµ•‘¥…Ñ•AÉ½Á……Ñ¥½¸ ¤ìô(€€€€€€€€€€€€€€€€€€€…¹¹½Õ¹•½É•‘1½¬ ¤ì(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€ô±ÑÉÕ”¤ì(€€€€€€€ô(€€€€€€€¥˜¡ÑåÁ•½˜±½‰…°¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•Èôôô‰™Õ¹Ñ¥½¸ˆ¥ì(€€€€€€€€€€€±½‰…°¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰½¹±¥¹”ˆ° ¤ôù¡•­½ÉUÁ‘…Ñ” ‰½¹±¥¹”ˆ¤¤ì(€€€€€€€ô(€€€ô((€€€™Õ¹Ñ¥½¸ÍÑ½À ¥ì(€€€€€€€¥˜¡ÍÑ…Ñ”¹Á½±±Q¥µ•È„ôõ¹Õ±°¥ì±½‰…°¹±•…É%¹Ñ•ÉÙ…°¡ÍÑ…Ñ”¹Á½±±Q¥µ•È¤ìÍÑ…Ñ”¹Á½±±Q¥µ•Èõ¹Õ±°ìô(€€€€€€€¥˜¡ÍÑ…Ñ”¹Á•¹‘¥¹Q¥µ•È„ôõ¹Õ±°¥ì±½‰…°¹±•…ÉQ¥µ•½ÕĞ¡ÍÑ…Ñ”¹Á•¹‘¥¹Q¥µ•È¤ìÍÑ…Ñ”¹Á•¹‘¥¹Q¥µ•Èõ¹Õ±°ìô(€€€€€€€ÍÑ…Ñ”¹ÍÑ…ÉÑ•õ™…±Í”ì(€€€ô((€€€™Õ¹Ñ¥½¸•ÑMÑ…Ñ” ¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€€€€€€€€€±½…‘•‘I•±•…Í•Y•ÉÍ¥½¸éÍÑ…Ñ”¹±½…‘•‘I•±•…Í•Y•ÉÍ¥½¹ññ•Ñ1½…‘•‘I•±•…Í•Y•ÉÍ¥½¸ ¤°(€€€€€€€€€€€…Ù…¥±…‰±•I•±•…Í•Y•ÉÍ¥½¸éÍÑ…Ñ”¹µ…¹¥™•ÍĞ˜™ÍÑ…Ñ”¹µ…¹¥™•ÍĞ¹É•±•…Í•Y•ÉÍ¥½¹ññ¹Õ±°°(€€€€€€€€€€€¹½Ñ¥•%éÍÑ…Ñ”¹µ…¹¥™•ÍĞ˜™ÍÑ…Ñ”¹µ…¹¥™•ÍĞ¹¹½Ñ¥•%‘ññ¹Õ±°°(€€€€€€€€€€€Á•¹‘¥¹9½Éµ…±I•±½…éÍÑ…Ñ”¹Á•¹‘¥¹9½Éµ…±I•±½…°(€€€€€€€€€€€Á•¹‘¥¹½É•‘UÁ‘…Ñ”éÍÑ…Ñ”¹Á•¹‘¥¹½É•‘UÁ‘…Ñ”°(€€€€€€€€€€€Á•¹‘¥¹¹¹½Õ¹•µ•¹ĞéÍÑ…Ñ”¹Á•¹‘¥¹¹¹½Õ¹•µ•¹Ğ°(€€€€€€€€€€€±½¥¹¹¹½Õ¹•µ•¹ÑM¡½İ¸éÍÑ…Ñ”¹±½¥¹¹¹½Õ¹•µ•¹ÑM¡½İ¸°(€€€€€€€€€€€ÍÕÁÁÉ•ÍÍ•‘Q½‘…äé¥ÍÕÉÉ•¹Ñ9½Ñ¥•MÕÁÁÉ•ÍÍ•‘Q½‘…ä¡ÍÑ…Ñ”¹µ…¹¥™•ÍĞ¤°(€€€€€€€€€€€É¥Ñ¥…±=Á•É…Ñ¥½¹½Õ¹ĞéÍÑ…Ñ”¹É¥Ñ¥…±=Á•É…Ñ¥½¹Ì¹Í¥é”°(€€€€€€€€€€€Õ¹Í…™•I•…Í½¹Ìé•ÑU¹Í…™•I•…Í½¹Ì ¤¹Í±¥” ¤°(€€€€€€€€€€€Á½±±%¹Ñ•ÉÙ…±5Ìé!-}%9QIY1}5L°(€€€€€€€€€€€µ¥¹¥µÕµ¡•­…Á5Ìé5%9}!-}A}5L°(€€€€€€€€€€€‘•ÙAÉ•Ù¥•İ5½‘”éÍÑ…Ñ”¹‘•ÙAÉ•Ù¥•İ5½‘”(€€€€€€€ôì(€€€ô((€€€±½‰…°¹½ÕÉMåµ‰½±ÍI•±•…Í•UÁ‘…Ñ”õ=‰©•Ğ¹™É••é”¡ì(€€€€€€€ÍÑ…ÉĞ°(€€€€€€€ÍÑ½À°(€€€€€€€¡•­½ÉUÁ‘…Ñ”°(€€€€€€€•ÑMÑ…Ñ”°(€€€€€€€Á…ÉÍ•Y•ÉÍ¥½¸°(€€€€€€€½µÁ…É•Y•ÉÍ¥½¹Ì°(€€€€€€€…¹M…™•±åI•±½…‘½ÉUÁ‘…Ñ”°(€€€€€€€‰•¥¹É¥Ñ¥…±=Á•É…Ñ¥½¸°(€€€€€€€¹½Ñ¥™åM…™•MÑ…Ñ”éÉ•Í½±Ù•A•¹‘¥¹]¡•¹M…™”°(€€€€€€€¡…ÍU¹É•…‘I•±•…Í•9½Ñ¥”°(€€€€€€€¥ÍÕÉÉ•¹Ñ9½Ñ¥•MÕÁÁÉ•ÍÍ•‘Q½‘…äè ¤ôù¥ÍÕÉÉ•¹Ñ9½Ñ¥•MÕÁÁÉ•ÍÍ•‘Q½‘…ä¡ÍÑ…Ñ”¹µ…¹¥™•ÍĞ¤°(€€€€€€€É•¹‘•É¹¹½Õ¹•µ•¹Ñ½¹Ñ•¹Ğ°(€€€€€€€½Á•¹É½µ¹¹½Õ¹•µ•¹Ğ°(€€€€€€€½Á•¹I•±•…Í••Ñ…¥°°(€€€€€€€É•ÅÕ•ÍÑI•±½…°(€€€€€€€¥Í½É•‘UÁ‘…Ñ•	±½­¥¹œ°(€€€€€€€Í¡½Õ±‘AÉ•Ù•¹ÑM¡…É•‘5½‘…±±½Í”°(€€€€€€€…¹¹½Õ¹•½É•‘1½¬°(€€€€€€€½¹M¡…É•‘5½‘…±±½Í•(€€€ô¤ì(€€€±½‰…°¹…¹M…™•±åI•±½…‘½ÉUÁ‘…Ñ”õ…¹M…™•±åI•±½…‘½ÉUÁ‘…Ñ”ì((€€€½¹ÍĞ‘½Õµ•¹ÑI•˜õ±½‰…°¹‘½Õµ•¹Ğì(€€€¥˜¡‘½Õµ•¹ÑI•˜˜™ÑåÁ•½˜‘½Õµ•¹ÑI•˜¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•Èôôô‰™Õ¹Ñ¥½¸ˆ¥ì(€€€€€€€‘½Õµ•¹ÑI•˜¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰™½ÕÈµÍåµ‰½±ÌéÍÑ…ÉÑÕÀµÉ•…‘äˆ±ÍÑ…ÉĞ±í½¹”éÑÉÕ•ô¤ì(€€€ô(€€€ÑÉåì(€€€€€€€½¹ÍĞÍÑ…ÉÑÕÁMÑ…Ñ”õ±½‰…°¹½ÕÉMåµ‰½±ÍMÑ…ÉÑÕÁA½±¥ä˜™±½‰…°¹½ÕÉMåµ‰½±ÍMÑ…ÉÑÕÁA½±¥ä¹•ÑMÑ…Ñ”˜™±½‰…°¹½ÕÉMåµ‰½±ÍMÑ…ÉÑÕÁA½±¥ä¹•ÑMÑ…Ñ” ¤ì(€€€€€€€¥˜¡ÍÑ…ÉÑÕÁMÑ…Ñ”ôôô‰Id‰ññÍÑ…ÉÑÕÁMÑ…Ñ”ôôô‰=1%9}Idˆ¥ì(€€€€€€€€€€€±½‰…°¹Í•ÑQ¥µ•½ÕĞ¡ÍÑ…ÉĞ°À¤ì(€€€€€€€ô(€€€õ…Ñ ¡|¥ìô()ô¤¡İ¥¹‘½Ü¤ì(