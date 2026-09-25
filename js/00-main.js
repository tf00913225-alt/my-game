

/* =====================================================
   â˜… 1080 Ã— 1920 æ•´é«”ç­‰æ¯”ä¾‹ç¸®æ”¾æŽ§åˆ¶å™¨
   - éŠæˆ²é‚è¼¯èˆžå°å›ºå®š 1080 Ã— 1920
   - ä¸ä¾è³´ vw / vh æ”¹è®ŠéŠæˆ²å…§å°ºå¯¸
   - å¯¦éš›èž¢å¹•åªæ±ºå®š stage scale
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
   spirit      = ç²¾ç¥ž
   agility     = æ•æ·

===================================================== */

const STAT_NAMES = {

    attack:"æ”»æ“Š",
    vitality:"é«”è³ª",
    energy:"èƒ½é‡",
    intelligence:"æ™ºåŠ›",
    spirit:"ç²¾ç¥ž",
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
        character:"åœŸé¨Žå£«"
    },

    water:{
        name:"æ°´",
        icon:"",
        character:"æ°´æˆ°å£«"
    }

};


/*
   â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œemojiæ›æˆCSS
   å‹•ç•«åœ–ç¤ºï¼‰ï¼š
   çµ„å‡º<span class="elem-icon elem-icon-ç«/æ°´/é¢¨/åœŸ">
   é€™ç¨®HTMLç‰‡æ®µçš„å°å·¥å…·ï¼Œå–ä»£åŽŸæœ¬ç›´æŽ¥æŠŠ
   element.iconï¼ˆemojiå­—å…ƒï¼‰å¡žé€²å­—ä¸²è£¡
   çš„å¯«æ³•ã€‚

   ä»»ä½•åœ°æ–¹åŽŸæœ¬å¯«ã€Œelement.icon+" "+xxxã€
   é€™ç¨®å­—ä¸²çµ„åˆã€è€Œä¸”æ˜¯ç”¨innerHTMLï¼
   .innerHTML=é¡¯ç¤ºå‡ºä¾†ï¼ˆä¸æ˜¯textContentï¼‰ï¼Œ
   éƒ½å¯ä»¥æ”¹æˆå‘¼å«é€™è£¡ï¼Œç›´æŽ¥æ‹¿åˆ°å«CSSåœ–ç¤º
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
   â˜… å…¨éƒ¨å¾ž0é–‹å§‹
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
   â˜… ç¬¬äºŒè§’è‰²ï¼ˆLv.10è§£éŽ–ï¼‰

   è·Ÿç¬¬ä¸€åè§’è‰²ï¼ˆplayerï¼‰çµæ§‹å®Œå…¨å°ç¨±ï¼Œ
   ç¨ç«‹çš„ç­‰ç´š/ç¶“é©—/å±¬æ€§/HP/SPï¼Œ
   å½¼æ­¤ä¸å…±ç”¨ï¼Œåªå…±ç”¨ç¶“é©—æ± ï¼ˆåˆ†é…æ™‚è‡ªå·±é¸è¦çµ¦èª°ï¼‰ã€‚

   player2åœ¨é‚„æ²’å‰µå»ºä¹‹å‰æ˜¯nullï¼Œ
   å­˜æª”/è®€æª”ã€UIæ¸²æŸ“éƒ½è¦å…ˆåˆ¤æ–·é€™å€‹æ˜¯ä¸æ˜¯nullã€‚
===================================================== */

let player2 = null;

/* ç¬¬ä¸‰è§’è‰²è³‡æ–™æ§½ï¼šç›®å‰å…ˆä¿ç•™ç‚º nullï¼Œä¸è‡ªè¡Œç™¼æ˜Žè§£éŽ–/å‰µè§’æ¢ä»¶ã€‚èƒŒåŒ… UI å·²å®Œæ•´æ”¯æ´ç¬¬ä¸‰è§’è‰²è³‡æ–™ã€‚ */
let player3 = null;


/*
   â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œè§’è‰²é™£åˆ—é‡æ§‹
   ç¬¬ä¸€éšŽæ®µï¼‰ï¼š
   ä½¿ç”¨è€…æ˜Žç¢ºè¡¨ç¤ºä¹‹å¾Œæœƒé–‹ç™¼ç¬¬ä¸‰åè§’è‰²ï¼Œ
   ç¾åœ¨çš„player/player2å…©å€‹å„è‡ªç¨ç«‹è®Šæ•¸ã€
   æ¯å€‹è§’è‰²ä¸€å¥—å‡½å¼ï¼ˆcastDamageSkill/
   castPlayer2Skillã€getMainCharacterStats/
   getPlayer2BattleStatsâ€¦â€¦ï¼‰çš„å¯«æ³•ï¼Œ
   ä¹‹å¾Œæ¯åŠ ä¸€å€‹è§’è‰²éƒ½è¦å†è¤‡è£½ä¸€ä»½ï¼Œ
   é•·æœŸæ˜¯æŠ€è¡“å‚µã€‚

   å®Œæ•´é‡æ§‹æˆcharacters[]é™£åˆ—é¢¨éšªå¾ˆé«˜
   ï¼ˆç¾æœ‰30å¹¾å€‹å‡½å¼éƒ½è¦è·Ÿè‘—å¤§æ”¹ï¼‰ï¼Œé€™æ¬¡
   å…ˆåšä½Žé¢¨éšªçš„ç¬¬ä¸€éšŽæ®µï¼šæ–°å¢žé€™å€‹
   getCharacters()è¼”åŠ©å‡½å¼ï¼Œä¹‹å¾Œæ–°å¯«çš„
   é€šç”¨é‚è¼¯ï¼ˆä¾‹å¦‚é€™æ¬¡çš„buff/debuffç³»çµ±ï¼‰
   ä¸€å¾‹å‘¼å«é€™è£¡å–å¾—ã€Œç›®å‰å­˜åœ¨çš„å…¨éƒ¨è§’è‰²ã€ï¼Œ
   ä¸è¦å†å„è‡ªç¡¬å¯«[player,player2]ã€‚

   æ•…æ„å¯«æˆã€Œæ¯æ¬¡å‘¼å«éƒ½é‡æ–°è®€å–ã€çš„å‡½å¼ï¼Œ
   ä¸æ˜¯å®£å‘Šä¸€æ¬¡çš„éœæ…‹é™£åˆ—â€”â€”å¦‚æžœå®£å‘Šæˆ
   éœæ…‹é™£åˆ—ï¼Œplayer2å¾žnullè¢«è³¦å€¼æˆçœŸæ­£çš„
   è§’è‰²ç‰©ä»¶é‚£ä¸€åˆ»ï¼Œé™£åˆ—è£¡å­˜çš„é‚„æ˜¯èˆŠçš„null
   åƒç…§ï¼Œä¸æœƒè‡ªå‹•æ›´æ–°ã€‚ç”¨å‡½å¼ç¾å ´çµ„é™£åˆ—
   å°±æ²’æœ‰é€™å€‹å•é¡Œï¼Œplayer2æ™šä¸€é»žæ‰å‰µå»º
   ä¹Ÿä¸€æ¨£æŠ“å¾—åˆ°æœ€æ–°ç‹€æ…‹ã€‚

   ä¹‹å¾ŒçœŸçš„è¦åŠ ç¬¬ä¸‰è§’è‰²æ™‚ï¼Œåªè¦åœ¨é€™å€‹é™£åˆ—
   åŠ ä¸€è¡Œã€æŠŠè§’è‰²å‰µå»º/å­˜è®€æª”é‚è¼¯æ¯”ç…§
   player2çš„æ¨¡å¼åšä¸€ä»½ï¼Œã€Œæ–°åŠŸèƒ½ã€çš„éƒ¨åˆ†
   ï¼ˆåªè¦æœ‰ç”¨é€™å€‹å‡½å¼çš„ï¼‰å¹¾ä¹Žä¸ç”¨å†æ”¹ã€‚
   ã€ŒèˆŠåŠŸèƒ½ã€ï¼ˆcastDamageSkillé€™é¡žé‚„æ²’
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
   çŽ©å®¶
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
       â˜… æ–°å¢žï¼šæŠ€èƒ½buffè¿½è¹¤ï¼ˆä¾‹å¦‚æ€’ç«ï¼‰ã€‚
       é™£åˆ—å­˜æ”¾ç›®å‰ç”Ÿæ•ˆä¸­çš„buffï¼Œ
       æ¯å€‹å›žåˆæœƒéžæ¸›turnsLeftï¼Œæ­¸é›¶å°±ç§»é™¤ã€‚
    */

    activeBuffs:[],

    /*
       â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œã€Œé‡Žæ€ªç•°å¸¸
       ç‹€æ…‹ç›´æŽ¥åšã€â€”â€”æ€ªç‰©çµ‚æ–¼å¯ä»¥å°çŽ©å®¶
       é™„åŠ è² é¢æ•ˆæžœäº†ï¼‰ï¼šè·Ÿæ€ªç‰©èº«ä¸Šçš„
       monster.statusEffectsæ˜¯åŒä¸€å¥—è³‡æ–™
       çµæ§‹ã€åŒä¸€å¥—å…±ç”¨å‡½å¼
       ï¼ˆapplyMonsterDebuff()/
       getMonsterDebuffValue()/
       isMonsterFrozen()/isMonsterPetrified()
       é›–ç„¶åå­—è£¡æœ‰ã€ŒMonsterã€ï¼Œä½†é€™äº›å‡½å¼
       æœ¬ä¾†å°±åªæ“ä½œå‚³é€²åŽ»çš„ç‰©ä»¶æœ¬èº«ï¼Œæ²’æœ‰
       ä»»ä½•å¯«æ­»monsterå°ˆå±¬çš„æ¬„ä½ï¼ŒçŽ©å®¶è§’è‰²
       ç‰©ä»¶ä¸€æ¨£èƒ½ç›´æŽ¥æ²¿ç”¨ï¼Œä¸ç”¨é‡å¯«ä¸€å¥—ï¼‰ã€‚
    */

    statusEffects:[],

    /*
       â˜… æ–°å¢žï¼šé˜²ç¦¦ç‹€æ…‹ã€‚
       é¸æ“‡é˜²ç¦¦ä¹‹å¾Œè¨­ç‚ºtrueï¼Œ
       ä¸‹æ¬¡è¼ªåˆ°è‡ªå·±è¡Œå‹•æ™‚ï¼ˆbeginCharacterTurn()ï¼‰
       æœƒé‡ç½®å›žfalseã€‚
    */

    isDefending:false

};


/*
   â˜… å…±ç”¨ç¶“é©—æ± 
   æˆ°é¬¥ç²å¾—çš„EXPå…ˆé€²é€™è£¡ï¼Œ
   çŽ©å®¶è‡ªè¡ŒæŒ‰æŒ‰éˆ•åˆ†é…çµ¦è§’è‰²å‡ç´šã€‚
*/

let sharedExp = 0;

/*
   â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œä¸»åŸŽæ–°å¢žå•†åº—
   ç³»çµ±ï¼‰ï¼šé‡‘å¹£æ˜¯è·Ÿç¶“é©—æ± ä¸€æ¨£çš„ã€Œå…±ç”¨è³‡æºã€ï¼Œ
   ä¸åˆ†è§’è‰²ï¼Œè³£è£å‚™/å®Œæˆä»»å‹™/æˆå°±ç²å¾—çš„
   é‡‘å¹£å…¨éƒ¨é€²åŒä¸€å€‹æ± å­ï¼Œå•†åº—æ¶ˆè²»ä¹Ÿæ˜¯å¾ž
   é€™è£¡æ‰£ï¼Œè·ŸsharedExpç”¨åŒä¸€ç¨®è¨­è¨ˆé‚è¼¯ã€‚
*/

let gold = 300;

/* =====================================================
   V93 â€” é–‹ç™¼æ¸¬è©¦è³‡æº
   æ¸¬è©¦æŒ‰éˆ•æ”¹æˆã€Œæ¯æŒ‰ä¸€æ¬¡å°±ç›´æŽ¥è¿½åŠ ã€ï¼š
   é‡‘å¹£ +1,000,000ï¼›å…±ç”¨ç¶“é©—æ±  +1,000,000,000ã€‚
   ä¸å†å­˜åœ¨æœ€ä½Žå€¼ã€æ°¸ä¹…éŽ–å®šæˆ–è‡ªå‹•è£œå›žæ©Ÿåˆ¶ã€‚
===================================================== */
const TEST_GOLD_GRANT=1000000;
const TEST_EXP_POOL_GRANT=1000000000;

/*
   â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œä¸»åŸŽæ–°å¢žå…­å€‹
   åŠŸèƒ½ï¼šå•†åº—/è§’è‰²å±•ç¤º/æ¯æ—¥ä»»å‹™/åœ–é‘‘/æˆå°±/
   å…¬å‘Šï¼‰ï¼š
   é€™è£¡çµ±ä¸€å®£å‘Šé€™å¹¾å€‹åŠŸèƒ½éœ€è¦çš„æŒä¹…åŒ–è³‡æ–™
   è·Ÿéœæ…‹è¨­å®šè³‡æ–™ã€‚

   dailyQuestStateï¼šæ¯æ—¥ä»»å‹™é€²åº¦ï¼Œ
   dateè¨˜éŒ„ã€Œä¸Šæ¬¡é‡ç½®æ˜¯å“ªä¸€å¤©ã€ï¼Œæ¯æ¬¡çŽ©å®¶
   æ‰“é–‹ä»»å‹™æ¸…å–®æ™‚æœƒæª¢æŸ¥ä»Šå¤©çš„æ—¥æœŸè·Ÿé€™å€‹
   dateæ˜¯å¦ç›¸åŒï¼Œä¸åŒçš„è©±ä»£è¡¨è·¨å¤©äº†ï¼Œ
   é€²åº¦/é ˜å–ç‹€æ…‹å…¨éƒ¨é‡ç½®ã€‚

   bestiaryDataï¼šåœ–é‘‘ï¼Œkeyæ˜¯æ€ªç‰©åç¨±ï¼Œ
   ç´€éŒ„æœ‰æ²’æœ‰è¦‹éŽã€ç´¯è¨ˆæ“Šæ®ºæ•¸ã€‚

   achievementStateï¼šæˆå°±ï¼Œkeyæ˜¯æˆå°±idï¼Œ
   ç´€éŒ„æœ‰æ²’æœ‰å·²ç¶“é ˜å–éŽçŽå‹µ
   ï¼ˆæˆå°±æœ¬èº«é”æˆèˆ‡å¦æ˜¯å³æ™‚ç”¨
   checkAchievementCondition()åˆ¤æ–·ï¼Œ
   ä¸éœ€è¦å¦å¤–å­˜ã€Œæœ‰æ²’æœ‰é”æˆã€ï¼Œåªéœ€è¦å­˜
   ã€Œæœ‰æ²’æœ‰é ˜éŽã€ï¼Œä¸ç„¶é‡è¤‡åˆ¤æ–·é‚è¼¯æœƒ
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
   â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œä»»å‹™æ”¹æˆå…©å€‹
   åˆ†é ï¼šæ¯æ—¥ä»»å‹™ï¼å§”è¨—ä»»å‹™ï¼‰ï¼š
   å§”è¨—ä»»å‹™è·Ÿæ¯æ—¥ä»»å‹™å…±ç”¨åŒä¸€å¥—ã€Œæ¯å¤©
   é‡ç½®ã€çš„é€±æœŸï¼ˆensureDailyQuestsCurrent()
   æœƒä¸€èµ·è™•ç†å…©é‚Šï¼‰ï¼Œå·®åˆ¥åªåœ¨ç›®æ¨™æ•¸å­—
   è¨‚å¾—æ›´é«˜ã€çŽå‹µæ›´å¥½ï¼Œé¼“å‹µçŽ©å®¶çœŸçš„èŠ±
   å¿ƒåŠ›åŽ»é”æˆï¼Œä¸æ˜¯æ¯æ—¥ä»»å‹™é‚£ç¨®è¼•é¬†
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
   â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œé›¢ç·šç¶“é©—ç³»çµ±ï¼‰ï¼š
   é›¢ç·šç¶“é©—çš„æ ¸å¿ƒåƒæ•¸è·Ÿç‹€æ…‹ï¼ŒloadGame()
   è®€æª”æ™‚æœƒä¾ç…§ä¸Šæ¬¡å­˜æª”æ™‚é–“ç®—å‡º
   pendingOfflineExpï¼ŒçŽ©å®¶åœ¨ä¸»åŸŽã€Œé›¢ç·š
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
   â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…å›žå ±ï¼Œã€Œåˆ‡åˆ°èƒŒæ™¯
   å†åˆ‡å›žä¾†ï¼Œåˆ°åº•æœ‰æ²’æœ‰ç®—é›¢ç·šç¶“é©—ã€ï¼‰ï¼š
   åŽŸæœ¬é›¢ç·šç¶“é©—çš„è¨ˆç®—é‚è¼¯æ•´æ®µå¯«æ­»åœ¨
   loadGame()è£¡ï¼Œåªæœ‰ç¶²é ã€Œç¬¬ä¸€æ¬¡è¼‰å…¥ã€
   æ‰æœƒåŸ·è¡Œåˆ°â€”â€”å–®ç´”åˆ‡åˆ°èƒŒæ™¯ã€å†åˆ‡å›ž
   å‰æ™¯ï¼ˆæ²’æœ‰çœŸçš„é—œé–‰åˆ†é é‡æ–°æ•´ç†ï¼‰ï¼Œ
   å®Œå…¨ä¸æœƒè§¸ç™¼è¨ˆç®—ï¼Œé€™æ˜¯ä½¿ç”¨è€…ç™¼ç¾çš„
   çœŸå¯¦æ¼æ´žï¼Œä¸æ˜¯èª¤æœƒã€‚

   æŠŠè¨ˆç®—é‚è¼¯æŠ½æˆé€™å€‹å…±ç”¨å‡½å¼ï¼Œ
   loadGame()ï¼ˆç¶²é ç¬¬ä¸€æ¬¡è¼‰å…¥ï¼‰è·Ÿ
   visibilitychangeåˆ‡å›žå‰æ™¯é€™å…©å€‹æ™‚æ©Ÿ
   éƒ½æœƒå‘¼å«é€™è£¡ï¼Œå…©ç¨®æƒ…æ³éƒ½èƒ½æ­£ç¢ºç´¯ç©
   é›¢ç·šç¶“é©—ï¼Œä¸ç”¨æ•´å€‹é‡æ–°æ•´ç†é é¢æ‰ç®—ã€‚

   å¤šæ¬¡è§¸ç™¼ä¹Ÿä¸æœƒé‡è¤‡å¤šç®—ï¼šæ¯æ¬¡éƒ½æ˜¯
   æ‹¿ã€Œç¾åœ¨æ™‚é–“ã€æ¸›ã€Œä¸Šä¸€æ¬¡è¨˜éŒ„çš„æ™‚é–“é»žã€ï¼Œ
   ç®—å®Œç«‹åˆ»æŠŠæ™‚é–“é»žæ›´æ–°æˆç¾åœ¨ï¼Œä¸‹ä¸€æ¬¡
   è§¸ç™¼åªæœƒç®—ã€Œé€™ä¸€æ®µæ–°çš„é›¢ç·šæ™‚é–“ã€ï¼Œ
   ä¸æœƒæŠŠä¹‹å‰å·²ç¶“ç®—éŽçš„å€é–“å†ç®—ä¸€æ¬¡ã€‚
*/

let lastOfflineCheckTimestamp=
    Date.now();


/* =====================================================
   â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œã€Œå¾ˆå¤šåœ°æ–¹éƒ½è¦
   åŠ çœ‹å»£å‘Šã€ï¼Œå…ˆåšå¥½é€šç”¨æž¶æ§‹ï¼‰ï¼š

   showRewardedAd(onSuccess, onFail)â€”â€”
   å…¨éŠæˆ²ã€Œçœ‹å»£å‘Šæ›çŽå‹µã€å”¯ä¸€çš„å…¥å£ï¼Œ
   ä¸ç®¡æ˜¯é›¢ç·šç¶“é©—é›™å€ã€ä¹‹å¾Œä»»å‹™åŠ æˆã€
   å•†åº—é¡å¤–é“å…·â€¦â€¦ä»»ä½•æƒ³åŠ ã€Œçœ‹å»£å‘Šã€çš„
   åœ°æ–¹ï¼Œéƒ½å‘¼å«é€™ä¸€å€‹å‡½å¼ï¼Œå·®åˆ¥åªåœ¨
   çµ¦çš„onSuccessï¼ˆå»£å‘Šçœ‹å®Œå¾Œè¦åšä»€éº¼ï¼‰
   ä¸ä¸€æ¨£ã€‚

   â˜… é‡è¦ï¼šç›®å‰AD_SYSTEM_READYæ˜¯falseï¼Œ
   ä»£è¡¨é‚„æ²’ç”³è«‹åˆ°çœŸçš„AdSense/AdMobå¸³è™Ÿï¼Œ
   é€™è£¡å…ˆç”¨ã€Œæ¨¡æ“¬æ’­æ”¾ã€é ‚è‘—ï¼ˆé¡¯ç¤ºæç¤ºã€
   ç­‰1.5ç§’ã€ç›´æŽ¥ç•¶ä½œçœ‹å®Œï¼‰ï¼Œè®“ä½ å¯ä»¥å…ˆ
   æ¸¬è©¦ã€Œé›™å€çŽå‹µã€é€™é¡žé‚è¼¯å°ä¸å°ï¼Œä¸ç”¨
   ç­‰å»£å‘Šå¸³è™Ÿç”³è«‹ä¸‹ä¾†æ‰èƒ½æ¸¬ã€‚

   â˜… ä¹‹å¾Œç”³è«‹åˆ°çœŸçš„å»£å‘Šå¸³è™Ÿï¼ŒæŠŠ
   AD_SYSTEM_READYæ”¹æˆtrueï¼Œä¸¦ä¸”æŠŠ
   ä¸‹é¢æ¨™ç¤ºã€ŒçœŸæ­£ä¸²æŽ¥å»£å‘ŠAPIçš„åœ°æ–¹ã€
   é‚£ä¸€æ®µï¼Œæ›æˆçœŸæ­£å‘¼å«Google Ad
   Placement APIçš„adBreak()ï¼ˆæˆ–ä½ æœ€å¾Œ
   é¸ç”¨çš„å»£å‘Šæœå‹™å•†çš„APIï¼‰â€”â€”åªè¦æ”¹é€™è£¡
   ä¸€å€‹å‡½å¼ï¼Œå…¨éŠæˆ²æ‰€æœ‰ç”¨åˆ°
   showRewardedAd()çš„åœ°æ–¹æœƒä¸€èµ·è‡ªå‹•
   è®ŠæˆçœŸå»£å‘Šï¼Œä¸ç”¨ä¸€å€‹å€‹åŠŸèƒ½åˆ†åˆ¥åŽ»æ”¹ã€‚
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
           é¡¯ç¤ºæç¤ºã€ç­‰1.5ç§’ã€ç›´æŽ¥è¦–ç‚º
           çœ‹å®ŒæˆåŠŸã€‚ç´”ç²¹æ˜¯ç‚ºäº†è®“ã€Œé›™å€
           çŽå‹µã€é€™é¡žé‚è¼¯ç¾åœ¨å°±èƒ½æ¸¬è©¦ï¼Œ           ä¸æ˜¯çœŸçš„å»£å‘Šã€‚
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
       â˜… çœŸæ­£ä¸²æŽ¥å»£å‘ŠAPIçš„åœ°æ–¹ï¼ˆç­‰ç”³è«‹åˆ°
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
       è™•ç†ï¼Œé¿å…çŽ©å®¶åªæ˜¯åˆ‡å‡ºåŽ»çœ‹ä¸€ä¸‹
       é€šçŸ¥é¦¬ä¸Šåˆ‡å›žä¾†ï¼Œä¹Ÿè·³å‡ºä¸€å‰‡ã€Œé›¢ç·š
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
        name:"å›žå¾©10%HPè—¥æ°´",
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
        name:"å›žå¾©10%SPè—¥æ°´",
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
        name:"å›žå¾©50%çš„HPè—¥æ°´",
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
        name:"å›žå¾©50%çš„SPè—¥æ°´",
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
        name:"å›žå¾©æ‰€æœ‰HPçš„è—¥æ°´",
        shortName:"HP å…¨å›žå¾©",
        icon:"",
        type:"potion",
        resource:"hp",
        recoveryPercent:100,
        price:180,
        stats:{}
    },
    {
        id:"spPotion100",
        name:"å›žå¾©æ‰€æœ‰SPçš„è—¥æ°´",
        shortName:"SP å…¨å›žå¾©",
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
   - è£å‚™é¡žï¼šæ¯æ ¼æœ€å¤š 1 ä»¶ã€‚
   - å…¶é¤˜é¡žåž‹ï¼šæ¯æ ¼æœ€å¤š 999 ä»¶ã€‚
   - è¶…éŽä¸Šé™æœƒè‡ªå‹•å»ºç«‹ä¸‹ä¸€å€‹å †ç–Šï¼Œä¸è®“å–®æ ¼çªç ´ä¸Šé™ã€‚
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
                "èƒŒåŒ…å †ç–Šè¶…éŽ120æ ¼å®¹é‡ï¼Œå‰©é¤˜ç‰©å“æœªèƒ½æ”¾å…¥ï¼š",
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
        return "æœªçŸ¥æ•ˆæžœ";
    }

    const resourceLabel=definition.resource==="hp" ? "HP" : "SP";
    return definition.recoveryPercent>=100
        ? `å›žå¾©æ‰€æœ‰${resourceLabel}`
        : `å›žå¾©æœ€å¤§${resourceLabel}çš„ ${definition.recoveryPercent}%`;
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
                    <span>å•†åº—è³¼è²·çš„ HPï¼SP è—¥æ°´æœƒç›´æŽ¥é¡¯ç¤ºåœ¨é€™è£¡ã€‚</span>
                </div>
            `;
            return;
        }

        list.innerHTML=available.map(definition=>{
            const count=getPotionCount(definition.id);
            const resourceLabel=definition.resource==="hp" ? "HP" : "SP";
            const effectLabel=definition.recoveryPercent>=100
                ? `${resourceLabel} å…¨å›žå¾©`
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
       ç­‰ç¬¬ä¸€å¼µæ­£å¼ç¬¦å’’è¦æ ¼ç¢ºå®šå¾Œï¼Œå†æŠŠé»žæ“Šè¡Œç‚ºæŽ¥é€²æ—¢æœ‰
       æŠ€èƒ½å¼•æ“Žï¼Œé¿å…å…ˆå¯«ä¸€å¥—éŒ¯çš„ç¬¦å’’å…¬å¼ã€‚
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
   å‘¼å«é»žï¼Œè¦‹ä¸Šé¢killMonster()çš„ä¿®æ”¹ã€‚
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
       â˜… æ–°å¢žï¼šå§”è¨—ä»»å‹™çš„æ“Šæ®ºé€²åº¦ï¼Œ
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
       â˜… æ–°å¢žï¼šå§”è¨—ä»»å‹™è·Ÿæ¯æ—¥ä»»å‹™å…±ç”¨
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
   â˜… åŸºç¤Žèƒ½åŠ›è¨ˆç®—
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
           é€™è£¡åªçµ¦è§’è‰²å›ºå®šåŸºç¤Žå€¼ã€‚
           å…­é …èƒ½åŠ›ä»ç„¶å®Œå…¨ç”±çŽ©å®¶é…é»žã€‚

           1é«”è³ª = +50HP +4é˜²ç¦¦
           1æ”»æ“Š = +3ç‰©æ”»
           1æ™ºåŠ› = +3é­”æ”»
           æ¯ç´š = +4ç‰©æ”»ï¼+4é­”æ”»ï¼+3é˜²ç¦¦
           1èƒ½é‡ = +15SP

           bonusHP / bonusSP æ˜¯æ¯æ¬¡å‡ç´š
           é¡å¤–å›ºå®šç²å¾—çš„ +30HP +10SPï¼Œ
           è·Ÿé«”è³ª/èƒ½é‡çš„é…é»žåŠ æˆåˆ†é–‹è¨ˆç®—ã€‚
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
   V119 â€” çŽ©å®¶æˆ°é¬¥ä¸­å…­åœæ¸›ç›Šçµ±ä¸€å…¥å£

   é¢¨ç³»ã€Œé™ä½Žæ•æ·ã€èˆ‡åœŸç³»ã€Œé™ä½Žé˜²ç¦¦ã€ï¼Œä»¥åŠæ­·å²ç›¸å®¹çš„
   statDownï¼ˆå…¨å±¬æ€§é™ä½Žï¼‰ï¼Œéƒ½å…±ç”¨ statusEffects ç‹€æ…‹ç®¡ç·šã€‚
   å…ˆå‰çŽ©å®¶æœ€çµ‚èƒ½åŠ›æ²’æœ‰å®Œæ•´è®€å–é€™äº›æ¸›ç›Šï¼Œé€ æˆæ€ªç‰©å°çŽ©å®¶æ–½æ”¾æ™‚
   çœ‹å¾—åˆ°æ–‡å­—ã€å¯¦éš›æ•¸å€¼å»æ²’æœ‰ä¸‹é™ã€‚

   é€™è£¡çµ±ä¸€è¦å‰‡ï¼š
   - statDown ç‚ºæ­·å²ç›¸å®¹ç‹€æ…‹ï¼›ç¾å½¹çŽ©å®¶æŠ€èƒ½ç›®å‰æœªä½¿ç”¨ã€‚è‹¥èˆŠè³‡æ–™æˆ–æ€ªç‰©æŠ€èƒ½å¸¶å…¥ï¼Œ
     ä»é™ä½Žå°æ‡‰å…­åœé»žæ•¸ï¼›è‹¥æŠ€èƒ½æœ‰ excludedStatsï¼Œè©²å…­åœä¸é™ã€‚
   - agilityDown å†é¡å¤–é™ä½Žæœ‰æ•ˆæ•æ·ã€‚
   - defenseDown åœ¨æ‰€æœ‰é˜²ç¦¦åŠ æˆç®—å®Œå¾Œå†é™ä½Žæœ€çµ‚é˜²ç¦¦ã€‚
   - æš«æ™‚æ€§çš„ vitality / energy é™ä½Žã€Œä¸å‹•æ…‹ç¸®æ¸› maxHP / maxSPã€ï¼Œ
     é¿å…æ¸›ç›Šå‘½ä¸­çž¬é–“æŠŠç¾æœ‰ HP/SP å¼·åˆ¶è£æŽ‰ï¼›é«”è³ªä»æœƒé™ä½Žæˆ°é¬¥é˜²ç¦¦ã€‚
     é€™æ˜¯æ²¿ç”¨æœ¬å°ˆæ¡ˆå…ˆå‰å·²ç¢ºèªçš„æˆ°é¬¥è³‡æºç©©å®šåŽŸå‰‡ï¼Œä¸æ–°å¢žéš±æ€§æ‰£è¡€/æ‰£SPã€‚
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
   é–ƒèº²ä¾†æºä¸€å¾‹ä»¥æœ€çµ‚ç™¾åˆ†é»žç›¸åŠ ï¼ç›¸æ¸›ã€‚
   çŽ©å®¶çœ‹åˆ°ã€Œé–ƒèº² +10%ã€å°±æ˜¯æœ€çµ‚é–ƒèº² +10 å€‹ç™¾åˆ†é»žï¼›
   ã€Œå‡å‚·ï¼šé–ƒèº² -25%ã€å°±æ˜¯æœ€çµ‚é–ƒèº² -25 å€‹ç™¾åˆ†é»žã€‚
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

/* æ°£å®šç¥žé–’çš„å‘½ä¸­åŠ æˆåŒæ™‚ä¾›çŽ©å®¶èˆ‡æ€ªç‰©å…±ç”¨ã€‚é¡åƒé¡¯ç¤ºç´€éŒ„
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
            buff.statusName==="æ°£å®šç¥žé–’";
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
        accuracy:effectiveSpirit*2,
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
   â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼‰ï¼š
   é€šç”¨ç‰ˆæœ¬ï¼Œè®€å–è§’è‰²èº«ä¸ŠæŸå€‹buffç›®å‰çš„
   ç™¾åˆ†æ¯”æ•¸å€¼ï¼ˆæ²’æœ‰é€™å€‹buffçš„è©±å›žå‚³0ï¼‰ï¼Œ
   è·Ÿæ€ªç‰©é‚£é‚Šçš„getMonsterDebuffValue()æ˜¯
   å°ç¨±è¨­è¨ˆï¼Œä¸€å€‹è®€activeBuffsï¼ˆçŽ©å®¶çš„
   å¢žç›Šï¼‰ï¼Œä¸€å€‹è®€statusEffectsï¼ˆæ€ªç‰©çš„
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
   â˜… æ–°å¢žï¼šç¬¬äºŒè§’è‰²çš„å®Œæ•´æˆ°é¬¥æ•¸å€¼ã€‚
   è·ŸgetMainCharacterStats()ç®—æ³•å®Œå…¨å°ç¨±ï¼Œ
   åªæ˜¯baseç›´æŽ¥ç”¨player2è‡ªå·±çš„å…­åœç®—ï¼Œ
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
        accuracy:effectiveSpirit*2,
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
   V120ï¼šé¢¨ç„°è¡“ï¼é¢¨å“®é›»æ“Šæ”¹ç‚ºã€Œé™ä½Žç›®æ¨™é€ æˆçš„å‚·å®³ã€ï¼›
   è½çŸ³è¡“ï¼æ»¾çŸ³è¡“ï¼åœ°ç‰›çŒ›è¥²çš„é™é˜²æŒçºŒæ™‚é–“æ­£å¼å®šç‚º1å›žåˆã€‚
*/
const skillDatabase = {

    /* =====================================================
       V120 æ­£å¼æŠ€èƒ½è¦æ ¼
       - æ•¸å€¼ã€å‰ç½®ã€SPã€ç¯„åœä¾ä½¿ç”¨è€… 2026-08-24 æœ€æ–°è¡¨
       - èˆŠæŠ€èƒ½ ID èƒ½æ²¿ç”¨å°±æ²¿ç”¨ï¼Œé¿å…ç ´å£žæ—¢æœ‰å­˜æª”/é…è£
       - æ–°å¢žæŠ€èƒ½æ‰å»ºç«‹æ–° ID
    ===================================================== */

    /* ===== ç«ç³»ï¼šç‰©ç† ===== */
    flameSlash:{
        id:"flameSlash", tier:1, name:"ç«ç„°æ–¬", element:"fire", category:"physical", targetType:"single",
        learnCost:2, maxLevel:5, baseDamage:17, damagePerLevel:10, spCost:8,
        description:"å°å–®é«”é€ æˆ17é»žåŸºç¤Žå‚·å®³ï¼Œæœ€é«˜5ç´šï¼Œæ¯å‡1ç´šå‚·å®³+10ã€‚"
    },
    fireCritical:{
        id:"fireCritical", tier:2, name:"æœƒå¿ƒä¸€æ“Š", element:"fire", category:"physical", targetType:"single",
        learnCost:10, maxLevel:5, baseDamage:39, damagePerLevel:13, spCost:15,
        description:"å°å–®é«”é€ æˆ39é»žåŸºç¤Žå‚·å®³ï¼Œæœ€é«˜5ç´šï¼Œæ¯å‡1ç´šå‚·å®³+13ã€‚", requires:["flameSlash"]
    },
    explosiveFlurry:{
        id:"explosiveFlurry", tier:3, name:"ç«çˆ†äº‚æ“Š", element:"fire", category:"physical", targetType:"tri",
        learnCost:20, maxLevel:5, baseDamage:35, damagePerLevel:15, spCost:22,
        description:"å°åŒä¸€æ©«æŽ’å·¦ã€ä¸­ã€å³æœ€å¤š3åç›®æ¨™å„é€ æˆ35é»žåŸºç¤Žå‚·å®³ï¼Œæœ€é«˜5ç´šï¼Œæ¯å‡1ç´šå‚·å®³+15ã€‚", requires:["fireCritical"]
    },
    dragonSlash:{
        id:"dragonSlash", tier:4, name:"éœ¸é¾è£‚å¤©æ–¬", element:"fire", category:"physical", targetType:"single",
        learnCost:45, maxLevel:5, baseDamage:145, damagePerLevel:25, spCost:55,
        description:"å°å–®é«”é€ æˆ145é»žåŸºç¤Žå‚·å®³ï¼Œæœ€é«˜5ç´šï¼Œæ¯å‡1ç´šå‚·å®³+25ã€‚", requires:["explosiveFlurry"]
    },

    /* ===== ç«ç³»ï¼šæ³•è¡“ ===== */
    fireRocket:{
        id:"fireRocket", tier:1, name:"ç«ç®­", element:"fire", category:"magic", targetType:"tri",
        learnCost:2, maxLevel:5, baseDamage:22, damagePerLevel:8, spCost:8,
        description:"å°åŒä¸€æ©«æŽ’å·¦ã€ä¸­ã€å³æœ€å¤š3åç›®æ¨™å„é€ æˆ22é»žåŸºç¤Žæ³•è¡“å‚·å®³ï¼Œæœ€é«˜5ç´šï¼Œæ¯å‡1ç´šå‚·å®³+8ã€‚"
    },
    blazeSpell:{
        id:"blazeSpell", tier:2, name:"çƒˆç«è¡“", element:"fire", category:"magic", targetType:"single",
        learnCost:10, maxLevel:5, baseDamage:42, damagePerLevel:15, spCost:15,
        description:"å°å–®é«”é€ æˆ42é»žåŸºç¤Žæ³•è¡“å‚·å®³ï¼Œæœ€é«˜5ç´šï¼Œæ¯å‡1ç´šå‚·å®³+15ã€‚", requires:["fireRocket"]
    },
    flameTornado:{
        id:"flameTornado", tier:3, name:"çƒˆç„°é¾æ²", element:"fire", category:"magic", targetType:"row",
        learnCost:30, maxLevel:5, baseDamage:40, damagePerLevel:13, spCost:38,
        description:"å°ä»»ä¸€æ©«æŽ’ç›®æ¨™å„é€ æˆ40é»žåŸºç¤Žæ³•è¡“å‚·å®³ï¼›30%æ©ŸçŽ‡ç‡ƒç‡’2å›žåˆï¼Œæ¯å›žåˆé€ æˆç›®æ¨™æœ€å¤§HPçš„5%/7%/12%/18%/25%å‚·å®³ã€‚",
        burnChance:30, burnDuration:2, burnPercentByLevel:[5,7,12,18,25], requires:["blazeSpell"]
    },
    phoenixCry:{
        id:"phoenixCry", tier:4, name:"ç«é³³å¤©é³´", element:"fire", category:"magic", targetType:"all",
        learnCost:45, maxLevel:5, baseDamage:53, damagePerLevel:15, spCost:62,
        description:"å°æ•µæ–¹å…¨é«”å„é€ æˆ53é»žåŸºç¤Žæ³•è¡“å‚·å®³ï¼›50%æ©ŸçŽ‡ç‡ƒç‡’2å›žåˆï¼Œæ¯å›žåˆé€ æˆç›®æ¨™æœ€å¤§HPçš„12%/18%/25%/30%/35%å‚·å®³ã€‚",
        burnChance:50, burnDuration:2, burnPercentByLevel:[12,18,25,30,35], requires:["flameTornado"]
    },

    /* ===== ç«ç³»ï¼šå¢žç›Š ===== */
    rage:{
        id:"rage", name:"æ€’ç«", element:"fire", category:"buff", targetType:"allyAll",
        learnCost:25, maxLevel:5, spCost:50, duration:2,
        description:"æé«˜æˆ‘æ–¹æœ€å¤š3åå­˜æ´»è§’è‰²çš„çˆ†æ“ŠçŽ‡èˆ‡çˆ†æ“Šå‚·å®³ï¼ŒæŒçºŒ2å›žåˆï¼›æå‡å¹…åº¦ä¾ç­‰ç´šç‚º10%/20%/30%/40%/50%ã€‚",
        critBonusByLevel:[10,20,30,40,50], requires:["explosiveFlurry","flameTornado"]
    },

    /* ===== ç«ç³»ï¼šè¢«å‹• ===== */
    fireEX:{
        id:"fireEX", name:"ç«å…ƒç´ EX", element:"fire", category:"passive", targetType:"none",
        learnCost:25, maxLevel:1,
        description:"æ°¸ä¹…æå‡ç«å…ƒç´ å‚·å®³10%ã€çˆ†æ“ŠçŽ‡5%ã€çˆ†æ“Šå‚·å®³5%ã€‚",
        damageBonusPercent:10, critChanceBonusPercent:5, critDamageBonusPercent:5
    },

    /* ===== æ°´ç³»ï¼šç‰©ç† ===== */
    waterKnife:{
        id:"waterKnife", tier:1, name:"æ°´åˆ€æ–¬", element:"water", category:"physical", targetType:"single",
        learnCost:2, maxLevel:5, baseDamage:13, damagePerLevel:3, spCost:6,
        description:"å°å–®é«”é€ æˆ13é»žåŸºç¤Žå‚·å®³ï¼›å¸å–å‚·å®³çš„1%/1%/1%/2%/3%ï¼Œç­‰é‡æ¢å¾©è‡ªèº«HPèˆ‡SPã€‚",
        lifestealPercentByLevel:[1,1,1,2,3]
    },
    frostPunch:{
        id:"frostPunch", tier:2, name:"å†°éœœæ‹³", element:"water", category:"physical", targetType:"single",
        learnCost:10, maxLevel:5, baseDamage:30, damagePerLevel:5, spCost:17,
        description:"å°å–®é«”é€ æˆ30é»žåŸºç¤Žå‚·å®³ï¼›å¸å–å‚·å®³çš„1%/1%/1%/2%/3%ï¼Œç­‰é‡æ¢å¾©è‡ªèº«HPèˆ‡SPã€‚",
        lifestealPercentByLevel:[1,1,1,2,3], requires:["waterKnife"]
    },
    iceSpin:{
        id:"iceSpin", tier:3, name:"å†°æ—‹ä¸€é–ƒ", element:"water", category:"physical", targetType:"tri",
        learnCost:20, maxLevel:5, baseDamage:25, damagePerLevel:7, spCost:20,
        description:"å°åŒä¸€æ©«æŽ’å·¦ã€ä¸­ã€å³æœ€å¤š3åç›®æ¨™å„é€ æˆ25é»žåŸºç¤Žå‚·å®³ï¼›å¸å–å‚·å®³çš„1%ï¼Œç­‰é‡æ¢å¾©è‡ªèº«HPèˆ‡SPã€‚",
        lifestealPercentByLevel:[1,1,1,1,1], requires:["frostPunch"]
    },
    frostCrush:{
        id:"frostCrush", tier:4, name:"å†°å°é‡æ“Š", element:"water", category:"physical", targetType:"single",
        learnCost:30, maxLevel:5, baseDamage:100, damagePerLevel:15, spCost:50,
        description:"å°å–®é«”é€ æˆ100é»žåŸºç¤Žå‚·å®³ï¼›45%æ©ŸçŽ‡å†°å°1å›žåˆï¼›å¸å–å‚·å®³çš„1%/1%/1%/2%/3%ï¼Œç­‰é‡æ¢å¾©è‡ªèº«HPèˆ‡SPã€‚",
        freezeChance:45, freezeDuration:1, lifestealPercentByLevel:[1,1,1,2,3], requires:["iceSpin"]
    },

    /* ===== æ°´ç³»ï¼šæ³•è¡“ ===== */
    waterBall:{
        id:"waterBall", tier:1, name:"æ°´çƒè¡“", element:"water", category:"magic", targetType:"tri",
        learnCost:2, maxLevel:5, baseDamage:17, damagePerLevel:3, spCost:8,
        description:"å°åŒä¸€æ©«æŽ’å·¦ã€ä¸­ã€å³æœ€å¤š3åç›®æ¨™å„é€ æˆ17é»žåŸºç¤Žæ³•è¡“å‚·å®³ï¼›å¸å–å‚·å®³çš„1%/1%/1%/2%/3%ï¼Œç­‰é‡æ¢å¾©è‡ªèº«HPèˆ‡SPã€‚",
        lifestealPercentByLevel:[1,1,1,2,3]
    },
    floodBeast:{
        id:"floodBeast", tier:2, name:"æ´ªæ°´çŒ›ç¸", element:"water", category:"magic", targetType:"single",
        learnCost:15, maxLevel:5, baseDamage:35, damagePerLevel:8, spCost:15,
        description:"å°å–®é«”é€ æˆ35é»žåŸºç¤Žæ³•è¡“å‚·å®³ï¼›å¸å–å‚·å®³çš„1%ï¼Œç­‰é‡æ¢å¾©è‡ªèº«HPèˆ‡SPã€‚",
        lifestealPercentByLevel:[1,1,1,1,1], requires:["waterBall"]
    },
    iceArrowRain:{
        id:"iceArrowRain", tier:3, name:"å†°éœœç®­é›¨", element:"water", category:"magic", targetType:"all",
        learnCost:20, maxLevel:5, baseDamage:30, damagePerLevel:12, spCost:50,
        description:"å°æ•µæ–¹å…¨é«”å„é€ æˆ30é»žåŸºç¤Žæ³•è¡“å‚·å®³ï¼›å¸å–å‚·å®³çš„1%ï¼Œç­‰é‡æ¢å¾©è‡ªèº«HPèˆ‡SPã€‚",
        lifestealPercentByLevel:[1,1,1,1,1], requires:["floodBeast"]
    },
    freeze:{
        id:"freeze", tier:4, name:"å†°å°", element:"water", category:"magic", targetType:"single",
        learnCost:25, maxLevel:1, spCost:22,
        description:"65%æ©ŸçŽ‡å†°å°å–®ä¸€ç›®æ¨™ï¼Œä½¿å…¶ç„¡æ³•è¡Œå‹•4å›žåˆï¼›ç´”æŽ§å ´æŠ€èƒ½ï¼Œä¸é€ æˆå‚·å®³ã€‚",
        freezeChance:65, freezeDuration:4, requires:["iceArrowRain"]
    },

    /* ===== æ°´ç³»ï¼šå¢žç›Š/å›žå¾© ===== */
    healSpell:{
        id:"healSpell", name:"æ²»ç™‚è¡“", element:"water", category:"heal", targetType:"ally",
        learnCost:20, maxLevel:5, baseHeal:40, healPerLevel:5, baseHealSP:15, healSPPerLevel:5, spCost:30,
        description:"æ“‡ä¸€å‹æ–¹ç›®æ¨™ï¼Œæ¢å¾©HPèˆ‡SPã€‚HPåŸºç¤Ž40ã€SPåŸºç¤Ž15ï¼Œå…©è€…æ¯å‡1ç´šåŸºç¤Žæ¢å¾©é‡+5ï¼›å¦åŠ HPæ™ºåŠ›Ã—1.25ã€SPæ™ºåŠ›Ã—0.5ï¼›æ–½æ”¾è€…æœ¬äººä¸å›žå¾©SPã€‚",
        requires:["iceArrowRain","iceSpin"]
    },
    revive:{
        id:"revive", name:"å¾©æ´»è¡“", element:"water", category:"revive", targetType:"deadAlly",
        learnCost:20, maxLevel:5, spCost:45,
        description:"æ“‡ä¸€å‹æ–¹æ­»äº¡ç›®æ¨™åŽŸåœ°å¾©æ´»ï¼Œä¾ç­‰ç´šæ¢å¾©20%/40%/60%/80%/100%æœ€å¤§HPã€‚",
        reviveHealPercentByLevel:[20,40,60,80,100], requires:["healSpell"]
    },

    /* ===== æ°´ç³»ï¼šè¢«å‹• ===== */
    waterEX:{
        id:"waterEX", name:"æ°´å…ƒç´ EX", element:"water", category:"passive", targetType:"none",
        learnCost:25, maxLevel:1,
        description:"æ°¸ä¹…æå‡æ°´å…ƒç´ å‚·å®³5%ã€å›žå¾©ç³»æŠ€èƒ½å›žå¾©é‡5%ã€ç•°å¸¸ç‹€æ…‹æŠ—æ€§+10%ã€‚",
        damageBonusPercent:5, healBonusPercent:5, statusResistBonus:10
    },

    /* ===== é¢¨ç³»ï¼šç‰©ç† ===== */
    stormFist:{
        id:"stormFist", tier:1, name:"æš´é¢¨æ‹³", element:"wind", category:"physical", targetType:"single",
        learnCost:2, maxLevel:5, baseDamage:14, damagePerLevel:2, spCost:7,
        description:"å°å–®é«”é€ æˆ14é»žåŸºç¤Žå‚·å®³ï¼›50%æ©ŸçŽ‡é™ä½Žæ•æ·1å›žåˆï¼Œé™ä½Ž50%/60%/70%/80%/90%ã€‚",
        agilityDownChance:50, agilityDownByLevel:[50,60,70,80,90], agilityDownDuration:1
    },
    stormFlurry:{
        id:"stormFlurry", tier:2, name:"æš´é¢¨äº‚æ“Š", element:"wind", category:"physical", targetType:"tri",
        learnCost:10, maxLevel:5, baseDamage:28, damagePerLevel:7, spCost:20,
        description:"å°åŒä¸€æ©«æŽ’å·¦ã€ä¸­ã€å³æœ€å¤š3åç›®æ¨™å„é€ æˆ28é»žåŸºç¤Žå‚·å®³ï¼›50%æ©ŸçŽ‡é™ä½Žç›®æ¨™é€ æˆçš„å‚·å®³1å›žåˆï¼Œé™ä½Ž15%/18%/21%/25%/30%ã€‚",
        damageDownChance:50, damageDownByLevel:[15,18,21,25,30], damageDownDuration:1, requires:["stormFist"]
    },
    windCrossSlash:{
        id:"windCrossSlash", tier:3, name:"é¢¨æ—‹åå­—æ–¬", element:"wind", category:"physical", targetType:"single",
        learnCost:15, maxLevel:5, baseDamage:90, damagePerLevel:12, spCost:39,
        description:"å°å–®é«”é€ æˆ90é»žåŸºç¤Žå‚·å®³ï¼›65%æ©ŸçŽ‡é™ä½Žç›®æ¨™é€ æˆçš„å‚·å®³1å›žåˆï¼Œé™ä½Ž15%/20%/25%/30%/35%ã€‚",
        damageDownChance:65, damageDownByLevel:[15,20,25,30,35], damageDownDuration:1, requires:["stormFlurry"]
    },
    dizzyFist:{
        id:"dizzyFist", tier:4, name:"æšˆçœ©çŒ›æ“Š", element:"wind", category:"physical", targetType:"single",
        learnCost:30, maxLevel:5, baseDamage:120, damagePerLevel:15, spCost:55,
        description:"å°å–®é«”é€ æˆ120é»žåŸºç¤Žå‚·å®³ï¼›65%æ©ŸçŽ‡ä½¿ç›®æ¨™æšˆçœ©2å›žåˆï¼Œä½¿ç›®æ¨™æœ€çµ‚å‘½ä¸­çŽ‡é™ä½Ž15%/20%/25%/30%/35%ã€‚",
        stunChance:65, missBonusByLevel:[15,20,25,30,35], stunDuration:2, requires:["stormFlurry"]
    },

    /* ===== é¢¨ç³»ï¼šæ³•è¡“ ===== */
    windSpell:{
        id:"windSpell", tier:1, name:"ç‹‚é¢¨è¡“", element:"wind", category:"magic", targetType:"tri",
        learnCost:2, maxLevel:5, baseDamage:18, damagePerLevel:2, spCost:9,
        description:"å°åŒä¸€æ©«æŽ’å·¦ã€ä¸­ã€å³æœ€å¤š3åç›®æ¨™å„é€ æˆ18é»žåŸºç¤Žæ³•è¡“å‚·å®³ï¼›50%æ©ŸçŽ‡é™ä½Žæ•æ·1å›žåˆï¼Œé™ä½Ž10%/20%/30%/40%/50%ã€‚",
        agilityDownChance:50, agilityDownByLevel:[10,20,30,40,50], agilityDownDuration:1
    },
    stormCircle:{
        id:"stormCircle", tier:2, name:"é¢¨ç„°è¡“", element:"wind", category:"magic", targetType:"row",
        learnCost:10, maxLevel:5, baseDamage:38, damagePerLevel:9, spCost:18,
        description:"å°ä»»ä¸€æ©«æŽ’å„é€ æˆ38é»žåŸºç¤Žæ³•è¡“å‚·å®³ï¼›55%æ©ŸçŽ‡é™ä½Žç›®æ¨™é€ æˆçš„å‚·å®³1å›žåˆï¼Œé™ä½Ž15%/18%/21%/25%/30%ã€‚",
        damageDownChance:55, damageDownByLevel:[15,18,21,25,30], damageDownDuration:1, requires:["windSpell"]
    },
    windHowlLightning:{
        id:"windHowlLightning", tier:3, name:"é¢¨å“®é›»æ“Š", element:"wind", category:"magic", targetType:"single",
        learnCost:15, maxLevel:5, baseDamage:95, damagePerLevel:12, spCost:39,
        description:"å°å–®é«”é€ æˆ95é»žåŸºç¤Žæ³•è¡“å‚·å®³ï¼›65%æ©ŸçŽ‡é™ä½Žç›®æ¨™é€ æˆçš„å‚·å®³1å›žåˆï¼Œé™ä½Ž15%/20%/25%/30%/35%ã€‚",
        damageDownChance:65, damageDownByLevel:[15,20,25,30,35], damageDownDuration:1, requires:["stormCircle"]
    },
    stormRain:{
        id:"stormRain", tier:4, name:"é¢¨èµ·é›²æ¹§", element:"wind", category:"magic", targetType:"all",
        learnCost:30, maxLevel:5, baseDamage:48, damagePerLevel:14, spCost:55,
        description:"å°æ•µæ–¹å…¨é«”å„é€ æˆ48é»žåŸºç¤Žæ³•è¡“å‚·å®³ï¼›35%æ©ŸçŽ‡æšˆçœ©1å›žåˆï¼Œä½¿ç›®æ¨™æœ€çµ‚å‘½ä¸­çŽ‡é™ä½Ž15%/20%/25%/30%/35%ã€‚",
        stunChance:35, missBonusByLevel:[15,20,25,30,35], stunDuration:1, requires:["windHowlLightning"]
    },

    /* ===== é¢¨ç³»ï¼šå¢žç›Š ===== */
    dodgeSkill:{
        id:"dodgeSkill", name:"é–ƒèº²è¡“", element:"wind", category:"buff", targetType:"allyAll",
        learnCost:10, maxLevel:1, spCost:20, duration:2,
        description:"ä½¿æˆ‘æ–¹å…¨é«”é–ƒèº²çŽ‡æå‡30%ï¼ŒæŒçºŒ2å›žåˆã€‚", evasionBonusPercent:30,
        requires:["windCrossSlash","windHowlLightning"]
    },
    stealthSkill:{
        id:"stealthSkill", name:"éš±èº«è¡“", element:"wind", category:"buff", targetType:"ally",
        learnCost:15, maxLevel:1, spCost:25, duration:2,
        description:"ä½¿æˆ‘æ–¹å–®ä¸€ç›®æ¨™éš±èº«2å›žåˆï¼›ç„¡æ³•è¢«å–®é«”æŠ€èƒ½é¸ä¸­ï¼Œä½†ä»æœƒå—åˆ°ç¯„åœæŠ€èƒ½æ³¢åŠã€‚", requires:["dodgeSkill"]
    },
    dinghaishenzhen:{
        id:"dinghaishenzhen", name:"æ°£å®šç¥žé–’", element:"wind", category:"buff", targetType:"allyAll",
        learnCost:20, maxLevel:1, spCost:55, duration:3,
        description:"ä½¿æˆ‘æ–¹å…¨é«”ç•°å¸¸ç‹€æ…‹æŠ—æ€§æå‡35%ï¼ŒæŒçºŒ3å›žåˆã€‚", statusResistBonus:35,
        requires:["stealthSkill"]
    },

    /* ===== é¢¨ç³»ï¼šè¢«å‹• ===== */
    windEX:{
        id:"windEX", name:"é¢¨å…ƒç´ EX", element:"wind", category:"passive", targetType:"none",
        learnCost:25, maxLevel:1,
        description:"æ°¸ä¹…æå‡é¢¨å…ƒç´ è§’è‰²çš„é–ƒèº²çŽ‡15%ã€‚", evasionBonusPercent:15
    },

    /* ===== åœŸç³»ï¼šç‰©ç† ===== */
    stoneSlash:{
        id:"stoneSlash", tier:1, name:"åœŸçŸ³æ–¬", element:"earth", category:"physical", targetType:"single",
        learnCost:2, maxLevel:5, baseDamage:14, damagePerLevel:2, spCost:7,
        description:"å°å–®é«”é€ æˆ14é»žåŸºç¤Žå‚·å®³ï¼›65%æ©ŸçŽ‡é™ä½Žé˜²ç¦¦1å›žåˆï¼Œé™ä½Ž10%/20%/30%/40%/50%ã€‚",
        defenseDownChance:65, defenseDownByLevel:[10,20,30,40,50], defenseDownDuration:1
    },
    petrifyFist:{
        id:"petrifyFist", tier:2, name:"çŸ³ç›¾æ‹³", element:"earth", category:"physical", targetType:"tri",
        learnCost:10, maxLevel:5, baseDamage:28, damagePerLevel:7, spCost:26,
        description:"å°åŒä¸€æ©«æŽ’å·¦ã€ä¸­ã€å³æœ€å¤š3åç›®æ¨™å„é€ æˆ28é»žåŸºç¤Žå‚·å®³ï¼›ç‚ºæˆ‘æ–¹å…¨é«”å¢žåŠ 100/125/150/175/200é»žè­·ç›¾ï¼ŒæŒçºŒ2å›žåˆã€‚",
        allyShieldByLevel:[100,125,150,175,200], shieldDuration:2, requires:["stoneSlash"]
    },
    stoneBreakSky:{
        id:"stoneBreakSky", tier:3, name:"çŸ³ç ´å¤©é©š", element:"earth", category:"physical", targetType:"single",
        learnCost:15, maxLevel:5, baseDamage:55, damagePerLevel:7, spCost:42,
        description:"å°å–®é«”é€ æˆ55é»žåŸºç¤Žå‚·å®³ï¼›ç‚ºæˆ‘æ–¹å…¨é«”å¢žåŠ 100/125/150/175/200é»žè­·ç›¾ï¼ŒæŒçºŒ2å›žåˆã€‚",
        allyShieldByLevel:[100,125,150,175,200], shieldDuration:2, requires:["petrifyFist"]
    },
    earthquakeCrush:{
        id:"earthquakeCrush", tier:4, name:"åœ°è£‚é‡æ‹³", element:"earth", category:"physical", targetType:"tri",
        learnCost:30, maxLevel:5, baseDamage:48, damagePerLevel:14, spCost:55,
        description:"å°åŒä¸€æ©«æŽ’å·¦ã€ä¸­ã€å³æœ€å¤š3åç›®æ¨™å„é€ æˆ48é»žåŸºç¤Žå‚·å®³ï¼›ç‚ºè‡ªèº«å¢žåŠ 100/150/200/250/300é»žè­·ç›¾ï¼ŒæŒçºŒ2å›žåˆã€‚",
        selfShieldByLevel:[100,150,200,250,300], shieldDuration:2, requires:["stoneBreakSky"]
    },

    /* ===== åœŸç³»ï¼šæ³•è¡“ ===== */
    stoneThrow:{
        id:"stoneThrow", tier:1, name:"è½çŸ³è¡“", element:"earth", category:"magic", targetType:"tri",
        learnCost:2, maxLevel:5, baseDamage:14, damagePerLevel:2, spCost:7,
        description:"å°åŒä¸€æ©«æŽ’å·¦ã€ä¸­ã€å³æœ€å¤š3åç›®æ¨™å„é€ æˆ14é»žåŸºç¤Žæ³•è¡“å‚·å®³ï¼›65%æ©ŸçŽ‡é™ä½Žé˜²ç¦¦1å›žåˆï¼Œé™ä½Ž10%/20%/30%/40%/50%ã€‚",
        defenseDownChance:65, defenseDownByLevel:[10,20,30,40,50], defenseDownDuration:1
    },
    sandWind:{
        id:"sandWind", tier:2, name:"æ»¾çŸ³è¡“", element:"earth", category:"magic", targetType:"row",
        learnCost:10, maxLevel:5, baseDamage:17, damagePerLevel:5, spCost:19,
        description:"å°ä»»ä¸€æ©«æŽ’å„é€ æˆ17é»žåŸºç¤Žæ³•è¡“å‚·å®³ï¼›65%æ©ŸçŽ‡é™ä½Žé˜²ç¦¦1å›žåˆï¼Œé™ä½Ž10%/20%/30%/40%/50%ã€‚",
        defenseDownChance:65, defenseDownByLevel:[10,20,30,40,50], defenseDownDuration:1, requires:["stoneThrow"]
    },
    flyingSandStrike:{
        id:"flyingSandStrike", tier:3, name:"é£›æ²™çž¬æ“Š", element:"earth", category:"magic", targetType:"all",
        learnCost:15, maxLevel:5, baseDamage:20, damagePerLevel:8, spCost:26,
        description:"å°æ•µæ–¹å…¨é«”å„é€ æˆ20é»žåŸºç¤Žæ³•è¡“å‚·å®³ï¼›ä¾ç­‰ç´š25%/35%/45%/55%/65%æ©ŸçŽ‡çŸ³åŒ–ç›®æ¨™2å›žåˆï¼Œä½¿å…¶ç„¡æ³•è¡Œå‹•ã€‚",
        petrifyChanceByLevel:[25,35,45,55,65], petrifyDuration:2, requires:["sandWind"]
    },
    dustStorm:{
        id:"dustStorm", tier:4, name:"åœ°ç‰›çŒ›è¥²", element:"earth", category:"magic", targetType:"all",
        learnCost:30, maxLevel:5, baseDamage:48, damagePerLevel:14, spCost:55,
        description:"å°æ•µæ–¹å…¨é«”å„é€ æˆ48é»žåŸºç¤Žæ³•è¡“å‚·å®³ï¼›60%æ©ŸçŽ‡é™ä½Žé˜²ç¦¦1å›žåˆï¼Œé™ä½Ž10%/15%/20%/25%/30%ã€‚",
        defenseDownChance:60, defenseDownByLevel:[10,15,20,25,30], defenseDownDuration:1, requires:["flyingSandStrike"]
    },

    /* ===== åœŸç³»ï¼šå¢žç›Š ===== */
    earthShield:{
        id:"earthShield", name:"è¬è±¡åœŸç›¾", element:"earth", category:"buff", targetType:"ally",
        learnCost:10, maxLevel:1, spCost:32, duration:3,
        description:"ä½¿æˆ‘æ–¹å–®ä¸€ç›®æ¨™ç²å¾—50%åå‚·åœŸç›¾ï¼ŒæŒçºŒ3å›žåˆã€‚", reflectPercent:50,
        requires:["stoneBreakSky","flyingSandStrike"]
    },
    rockWall:{
        id:"rockWall", name:"å²©çŸ³å£å£˜", element:"earth", category:"buff", targetType:"allyAll",
        learnCost:15, maxLevel:1, spCost:45, duration:3,
        description:"ä½¿æˆ‘æ–¹å…¨é«”é˜²ç¦¦åŠ›æå‡30%ï¼ŒæŒçºŒ3å›žåˆã€‚", defenseBonusPercent:30,
        requires:["barrier"]
    },
    barrier:{
        id:"barrier", name:"çµç•Œ", element:"earth", category:"buff", targetType:"ally",
        learnCost:20, maxLevel:1, spCost:28, duration:4,
        description:"ä½¿æˆ‘æ–¹å–®ä¸€ç›®æ¨™ç²å¾—å®Œå…¨é˜²è­·ç½©ï¼Œå¯æŠµæ“‹æ‰€æœ‰å‚·å®³ï¼ŒæŒçºŒ4å›žåˆã€‚", requires:["earthShield"]
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

    makeZoneMonster("å“¥å¸ƒæž—",3,"fire"),
    makeZoneMonster("å²èŠå§†",2,"water"),
    makeZoneMonster("å“¥å¸ƒæž—",3,"fire"),
    makeZoneMonster("å²èŠå§†",2,"water"),    makeZoneMonster("å“¥å¸ƒæž—",3,"fire"),
    makeZoneMonster("å²èŠå§†",2,"water")

];

forestMonsters.forEach(monster=>{
    monster.agilityPoints=0;
    monster.agility=0;
    monster.v173BeginnerForest=true;
});


/*
   â˜… è’æ¼ åœ°å¸¶ï¼ˆç¬¬äºŒå€ï¼‰æ€ªç‰©è³‡æ–™ã€‚
   æ•¸å€¼æ˜Žé¡¯æ¯”æ–°æ‰‹æ£®æž—ç¡¬ï¼Œ
   ä¸»è¦æ˜¯ç‚ºäº†è®“çŽ©å®¶èƒ½å¯¦éš›æ¸¬è©¦
   ç‡ƒç‡’é€™é¡žã€ŒæŒçºŒå‚·å®³ã€æ•ˆæžœâ€”â€”
   æ–°æ‰‹æ£®æž—çš„æ€ªå¤ªè„†ï¼Œé€šå¸¸ä¸€å…©ä¸‹å°±æ­»äº†ï¼Œ
   æ ¹æœ¬æ’ä¸åˆ°ç‡ƒç‡’è·³å®Œ2å›žåˆã€‚
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
      çš„æŠ€èƒ½IDï¼Œä¸å†è‡ªå·±äº‚å–åå­—â€”â€”çŽ©å®¶è‡ªå·±
      ä¹Ÿæœƒç”¨åˆ°ç«ç„°æ–¬ã€æ°´åˆ€æ–¬é€™äº›æŠ€èƒ½ï¼Œ
      æ€ªç‰©ç”¨åŒä¸€æ‹›ï¼ŒçŽ©å®¶ä¸€çœ‹å°±æ‡‚ï¼Œ
      ä¸æœƒè¢«å…©å¥—ä¸åŒåå­—çš„æŠ€èƒ½æžæ··ã€‚
   2. skillIdsæ”¹æˆé™£åˆ—ï¼ˆå°±ç®—ç›®å‰åªæ”¾1å€‹ï¼‰ï¼Œ
      ä¹‹å¾Œé«˜ç­‰ç´šå€åŸŸè¦æ”¾2ã€3å€‹æŠ€èƒ½æ™‚ï¼Œ
      ç›´æŽ¥å¾€é™£åˆ—è£¡åŠ å°±å¥½ï¼Œä¸ç”¨æ”¹è³‡æ–™çµæ§‹ã€‚
   3. æ–°å¢žskillChanceï¼ˆæŠ€èƒ½é‡‹æ”¾æ©ŸçŽ‡ï¼‰ï¼Œ
      æ¯å€‹å€åŸŸçš„æ©ŸçŽ‡ä¸ä¸€æ¨£ï¼Œç›´æŽ¥å¯«åœ¨
      æ€ªç‰©è³‡æ–™è£¡ï¼Œè®€å–çš„åœ°æ–¹ä¸ç”¨å¦å¤–åˆ¤æ–·
      ç¾åœ¨æ˜¯å“ªå€‹å€åŸŸã€‚
*/

const iceMountainMonsters = [

    makeZoneMonster("ç†¾ç„°ç‹¼",22,"fire"),
    makeZoneMonster("å¯’å†°é­”",23,"water"),
    makeZoneMonster("ç†¾ç„°ç‹¼",22,"fire"),
    makeZoneMonster("å¯’å†°é­”",23,"water"),
    makeZoneMonster("ç†¾ç„°ç‹¼çŽ‹",27,"fire"),
    makeZoneMonster("å¯’å†°é­”çŽ‹",28,"water")

];


/*
   â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼‰ï¼š
   ç¬¬å››ï½žå…«å€æ€ªç‰©è³‡æ–™ï¼ŒLv.31~80ï¼Œ
   æ¯å€æŠ€èƒ½æ•¸é‡ã€æŠ€èƒ½é‡‹æ”¾æ©ŸçŽ‡éƒ½ä¸ä¸€æ¨£ï¼š

   31~40ï¼š1å€‹æŠ€èƒ½ï¼Œ55%æ©ŸçŽ‡
   41~50ï¼š2å€‹æŠ€èƒ½ï¼Œ60%æ©ŸçŽ‡
   51~60ï¼š2å€‹æŠ€èƒ½ï¼Œ65%æ©ŸçŽ‡
   61~70ï¼š3å€‹æŠ€èƒ½ï¼Œ65%æ©ŸçŽ‡
   71~80ï¼š3å€‹æŠ€èƒ½ï¼Œ70%æ©ŸçŽ‡

   æŠ€èƒ½æ± çµ±ä¸€å¾žskillDatabaseè£¡æŒ‘é¸
   ç«/æ°´ç³»çš„å‚·å®³é¡žæŠ€èƒ½ï¼Œç­‰ç´šè¶Šé«˜çš„å€åŸŸ
   æŠ€èƒ½æ± è£¡çš„æ‹›å¼ä¹Ÿè¶Šå¤šæ¨£ã€è¶Šå¼·ã€‚

   â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œã€Œé‡Žæ€ªç•°å¸¸
   ç‹€æ…‹ç›´æŽ¥åšï¼Œæˆ‘çµ¦ä½ åˆ†ç´šã€ï¼‰ï¼š
   é€™äº›æ‰‹å‹•æŽ’çš„æŠ€èƒ½æ± é™£åˆ—å·²ç¶“è¢«
   getMonsterSkillPoolForLevel()é€™å€‹
   çµ±ä¸€è¦å‰‡å–ä»£ï¼ˆè¦‹makeZoneMonster()
   é™„è¿‘ï¼‰ï¼Œä¸æœƒå†ç”¨åˆ°ï¼Œæ•´çµ„æ‹¿æŽ‰ã€‚
*/


/*
   â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œæ€ªç‰©å…­åœç³»çµ±ï¼Œ
   å®Œå…¨æ¯”ç…§çŽ©å®¶çš„èƒ½åŠ›é»žåˆ†é…/æ›ç®—å…¬å¼ï¼Œ
   ä¸å†æ˜¯æ‰‹å‹•å¡«æ­»çš„HP/SP/æ”»æ“Š/é˜²ç¦¦æ•¸å­—ï¼‰ï¼š

   ç¸½èƒ½åŠ›é»ž = 10 + ç­‰ç´šÃ—2
   æ•æ·é»žæ•¸ = round(ç­‰ç´šÃ·3)ï¼Œå¾žç¸½èƒ½åŠ›é»žè£¡æ‰£é™¤
   å¯åˆ†é…é»žæ•¸ = ç¸½èƒ½åŠ›é»ž âˆ’ æ•æ·é»žæ•¸
   é«”è³ªé»žæ•¸ = round(å¯åˆ†é…é»žæ•¸ Ã— 10%)ï¼Œå›ºå®š
   å‰©é¤˜é»žæ•¸å¹³å‡åˆ†é…çµ¦æ”»æ“Šï¼èƒ½é‡ï¼æ™ºåŠ›ï¼ç²¾ç¥žï¼Œ
   é¤˜æ•¸ä¾å›ºå®šé †åºè£œå…¥ï¼Œç¢ºä¿åŒååŒç´šæ€ªç‰©æ•¸å€¼ä¸€è‡´ã€‚

   æ›ç®—æˆå¯¦éš›æ•¸å€¼æ™‚ï¼Œç›´æŽ¥å¥—ç”¨è·ŸçŽ©å®¶
   getBaseStats()å®Œå…¨ç›¸åŒçš„å…¬å¼ï¼š
   maxHP    = 100 + é«”è³ªÃ—50
   maxSP    = 50  + èƒ½é‡Ã—15
   æ”»æ“ŠåŠ›    = 10  + æ”»æ“ŠÃ—8
   é˜²ç¦¦     = 10  + é«”è³ªÃ—6
   æ³•è¡“æ”»æ“Š  = 10  + æ™ºåŠ›Ã—8
   å‘½ä¸­ = ç²¾ç¥žÃ—2
   ä¸€èˆ¬ç•°å¸¸æŠ—æ€§ = ç²¾ç¥žÃ—0.05ï¼ˆç™¾åˆ†é»žï¼‰
   é è¨­é–ƒé¿ = min(10%, ç­‰ç´šÃ—0.1%)
   é€Ÿåº¦(è¡Œå‹•é †åºç”¨) = æ•æ·ï¼ˆåŽŸå§‹é»žæ•¸ï¼Œä¸é¡å¤–ä¹˜ï¼‰
*/

/*
   â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œã€ŒåŒä¸€å€åŒä¸€å€‹
   æ€ªç‰©åç¨±ï¼Œç­‰ç´šå°±è¦ä¸€æ¨£ï¼Œèƒ½åŠ›å€¼ä¹Ÿéƒ½è¦
   ä¸€æ¨£ã€ï¼‰ï¼š
   é€™å€‹å‡½å¼åŽŸæœ¬ç”¨Math.random()æ±ºå®šæ”»æ“Š/
   èƒ½é‡/æ™ºåŠ›/ç²¾ç¥žå››é …æ€Žéº¼åˆ†é…ï¼Œä»£è¡¨å°±ç®—
   åç¨±ã€ç­‰ç´šå®Œå…¨ç›¸åŒçš„æ€ªç‰©ï¼ˆä¾‹å¦‚åŒä¸€å€
   æ”¾äº†ä¸‰éš»ã€Œå“¥å¸ƒæž— Lv.3ã€ï¼‰ï¼Œæ¯ä¸€éš»å¯¦éš›
   ç®—å‡ºä¾†çš„æ”»æ“ŠåŠ›/é­”æ”»/å‘½ä¸­/é–ƒé¿é‚„æ˜¯æœƒ
   å„è‡ªä¸åŒâ€”â€”ä¸æ˜¯ç­‰ç´šæ²’å°é½Šï¼Œæ˜¯ã€Œç­‰ç´š
   å°é½Šäº†ï¼Œä½†é»žæ•¸åˆ†é…æ˜¯éš¨æ©Ÿéª°çš„ã€ï¼Œä¸€æ¨£
   æœƒè®“çŽ©å®¶è¦ºå¾—ã€ŒåŒååŒç­‰ç´šçš„æ€ªï¼Œæ•¸å€¼
   å»ä¸ä¸€æ¨£ã€ä¸åˆç†ã€‚

   æ”¹æˆå›ºå®šã€Œå¹³å‡åˆ†é…ã€ï¼ˆå››é …å¹³åˆ†ï¼Œåˆ†ä¸
   å®Œçš„é¤˜æ•¸ä¾å›ºå®šé †åºï¼Œä¸æ˜¯éš¨æ©Ÿé †åºï¼Œ
   è£œçµ¦å‰é¢å¹¾é …ï¼‰ï¼Œé€™æ¨£åŒä¸€å€‹ç­‰ç´šä¸ç®¡
   ç®—å¹¾æ¬¡ã€ç®—å¹¾éš»ï¼Œçµæžœæ°¸é ä¸€æ¨¡ä¸€æ¨£ï¼Œ
   è·Ÿé«”è³ªé‚£é …ã€Œå›ºå®š10%ã€ä¸å†åƒèˆ‡éš¨æ©Ÿã€
   æ˜¯åŒä¸€å€‹ç²¾ç¥žï¼Œåªæ˜¯é€™è£¡æ“´å¤§åˆ°å…¨éƒ¨
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
       â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œé…é»žè¦å‰‡
       ç¬¬äºŒæ¬¡èª¿æ•´ï¼‰ï¼š
       é«”è³ªæ”¹æˆã€Œå›ºå®š10%ã€ï¼Œä¸å†æ˜¯ã€Œä¿åº•
       40%+éš¨æ©ŸåŠ ç¢¼ã€â€”â€”é«”è³ªä¸æœƒå†å¾žéš¨æ©Ÿæ± 
       è£¡å¤šæ‹¿åˆ°é¡å¤–é»žæ•¸ï¼Œå°±æ˜¯å–®ç´”çš„10%ï¼Œ
       å…¶é¤˜90%ï¼ˆåŽŸæœ¬èƒ½é‡å›ºå®š20%çš„è¦å‰‡ä¹Ÿ
       å–æ¶ˆäº†ï¼‰å…¨éƒ¨ä¸Ÿé€²éš¨æ©Ÿæ± ï¼Œç”±ã€Œæ”»æ“Š/
       èƒ½é‡/æ™ºåŠ›/ç²¾ç¥žã€å››é …å‡ç­‰ç«¶çˆ­ã€‚
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
       [0]æ”»æ“Š [1]èƒ½é‡ [2]æ™ºåŠ› [3]ç²¾ç¥ž
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
   â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œã€Œé‡Žæ€ªç•°å¸¸ç‹€æ…‹
   ç›´æŽ¥åšï¼Œæˆ‘çµ¦ä½ åˆ†ç´šã€ï¼‰ï¼š
   é‡Žæ€ªæŠ€èƒ½åˆ†ç´šè¦å‰‡ï¼Œçµ±ä¸€ç”±ç­‰ç´šæ±ºå®šé‡Žæ€ª
   ã€Œæ‹¿å¾—åˆ°å“ªäº›æŠ€èƒ½ã€è·Ÿã€Œæ”¾æŠ€èƒ½çš„æ©ŸçŽ‡ã€ï¼Œ
   ä¸ç”¨åƒä»¥å‰é‚£æ¨£æ¯å€‹å€åŸŸæ‰‹å‹•æŽ’æŠ€èƒ½ID
   é™£åˆ—ã€æ‰‹å‹•æŠ“æ©ŸçŽ‡æ•¸å­—ï¼Œåªè¦çµ¦å°element+
   levelï¼Œå…¶ä»–è‡ªå‹•ç®—å¥½ï¼š

   Lv.1~10ã€€ã€€åªæœƒæ™®é€šæ”»æ“Šï¼Œä¸æœƒæ”¾æŠ€èƒ½
   Lv.11~40ã€€å¯ä»¥æ”¾åˆ°ã€Œç¬¬1ç´šã€æŠ€èƒ½ï¼Œ35%æ©ŸçŽ‡
   Lv.41~70ã€€å¯ä»¥æ”¾åˆ°ã€Œç¬¬2ç´šã€æŠ€èƒ½ï¼Œ45%æ©ŸçŽ‡
   Lv.71~100ã€€å¯ä»¥æ”¾åˆ°ã€Œç¬¬3ç´šã€æŠ€èƒ½ï¼Œ55%æ©ŸçŽ‡

   ã€Œç¬¬Nç´šã€æ˜¯ç´¯åŠ çš„ï¼ˆä¸æ˜¯åªçµ¦é‚£ä¸€ç´šï¼Œæ˜¯
   å¾žç¬¬1ç´šåˆ°ç¬¬Nç´šå…¨éƒ¨éƒ½å¯èƒ½æ”¾ï¼‰ï¼Œè·ŸæŠ€èƒ½
   æœ¬èº«åœ¨ç‰©ç†/æ³•è¡“éˆä¸Šç¬¬å¹¾æ‹›å°æ‡‰ï¼ˆè¦‹
   skillDatabaseè£¡æ¯å€‹æ”»æ“ŠæŠ€èƒ½æ–°å¢žçš„tier
   æ¬„ä½ï¼Œ1=å…¥é–€ã€2=ç¬¬äºŒæ‹›ã€3=ç¬¬ä¸‰æ‹›ã€
   4=æœ€å¼·æ‹›â€”â€”é‡Žæ€ªæœ€é«˜åªåˆ°3ç´šï¼Œ4ç´šçš„
   çµ‚æ¥µæŠ€èƒ½ä¸æœƒå‡ºç¾åœ¨é‡Žæ€ªèº«ä¸Šï¼‰ã€‚
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
       å‘¼å«ï¼Œæ‹¿åˆ°çš„æŠ€èƒ½æ± ï¼æ–½æ”¾æ©ŸçŽ‡æ°¸é 
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
           â˜… å…­åœåŽŸå§‹é»žæ•¸ä¹Ÿä¸€èµ·å­˜èµ·ä¾†ï¼Œ
           æ–¹ä¾¿ä¹‹å¾ŒæŸ¥çœ‹/é™¤éŒ¯ï¼Œæˆ°é¬¥å¯¦éš›
           è®€å–çš„æ˜¯ä¸‹é¢æ›ç®—å¥½çš„attack/
           defense/magicAttack/accuracy/
           resistance/evasioné€™äº›ã€Œæœ€çµ‚æ•¸å€¼ã€ï¼Œ
           ä¸æ˜¯é€™å¹¾å€‹åŽŸå§‹é»žæ•¸ã€‚
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
           â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œã€Œä»¥å¾Œ
           ç²¾è‹±æ€ªè·ŸBOSSçš„åç¨±ä¸æœƒæœ‰çŽ‹æˆ–çš‡ï¼Œ
           æˆ‘æœƒç›´æŽ¥è·Ÿå¦³èªªèª°èª°èª°å°±æ˜¯å¥—ç”¨
           ä»€éº¼æ€ªã€ï¼‰ï¼š
           æ–°å¢žç¬¬4å€‹åƒæ•¸rankï¼Œç›´æŽ¥æ˜Žç¢ºæŒ‡å®š
           "elite"ï¼"boss"ï¼Œä¸ç”¨å†é åå­—
           çµå°¾çŒœã€‚getMonsterRank()åŽŸæœ¬å°±
           å·²ç¶“å¯«æˆã€Œå„ªå…ˆçœ‹monster.rankæ¬„ä½ï¼Œ
           æ²’æœ‰æ‰é€€å›žçœ‹åå­—çµå°¾ã€ï¼Œé€™è£¡æŽ¥ä¸Š
           ä¹‹å¾Œï¼Œå¾€å¾Œæ–°æ€ªç‰©åªè¦åœ¨
           makeZoneMonster()å‘¼å«æ™‚å¤šè£œä¸€å€‹
           åƒæ•¸å°±å¥½ï¼Œä¾‹å¦‚ï¼š
           makeZoneMonster("ç†”å²©é­”åƒ",45,
           "fire","elite")
           ä¸å¯«é€™å€‹åƒæ•¸ï¼ˆç¶­æŒ3å€‹åƒæ•¸ï¼‰çš„è©±ï¼Œ
           ç…§èˆŠç”±getMonsterRank()é€€å›žçœ‹
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
    makeZoneMonster("çƒˆç„°å·¨é­”çŽ‹",38,"fire"),
    makeZoneMonster("æ·±æ·µæ°´éˆçŽ‹",40,"water")

];


const zone5Monsters = [

    makeZoneMonster("ç†”å²©å·¨ç¸",42,"fire"),
    makeZoneMonster("å¯’æ½®å·¨ç¸",43,"water"),
    makeZoneMonster("ç†”å²©å·¨ç¸",42,"fire"),
    makeZoneMonster("å¯’æ½®å·¨ç¸",43,"water"),
    makeZoneMonster("ç†”å²©å·¨ç¸çŽ‹",48,"fire"),
    makeZoneMonster("å¯’æ½®å·¨ç¸çŽ‹",50,"water")

];


const zone6Monsters = [

    makeZoneMonster("èµ¤ç‚Žä¿®ç¾…",52,"fire"),
    makeZoneMonster("çŽ„å†°ä¿®ç¾…",53,"water"),
    makeZoneMonster("èµ¤ç‚Žä¿®ç¾…",52,"fire"),
    makeZoneMonster("çŽ„å†°ä¿®ç¾…",53,"water"),
    makeZoneMonster("èµ¤ç‚Žä¿®ç¾…çŽ‹",58,"fire"),
    makeZoneMonster("çŽ„å†°ä¿®ç¾…çŽ‹",60,"water")

];


const zone7Monsters = [

    makeZoneMonster("æ¥­ç«é­”å›",62,"fire"),
    makeZoneMonster("çµ•å†°é­”å›",63,"water"),
    makeZoneMonster("æ¥­ç«é­”å›",62,"fire"),
    makeZoneMonster("çµ•å†°é­”å›",63,"water"),
    makeZoneMonster("æ¥­ç«é­”å›çŽ‹",68,"fire"),
    makeZoneMonster("çµ•å†°é­”å›çŽ‹",70,"water")

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
   â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œæ–°å¢ž81ï½ž90ã€
   91ï½ž100å…©å€‹åœ°å€ï¼‰ï¼š
   å»¶çºŒzone4~8çš„ç­‰ç´š/æŠ€èƒ½æ± åˆ†é…è¦å¾‹
   ï¼ˆæ¯å€è·¨10ç´šã€çŽ‹ç´šæ¯”ä¸€èˆ¬é«˜6~8ç´šã€
   æŠ€èƒ½æ± æ²¿ç”¨åŒä¸€ç³»åˆ—çš„ç¬¬3æ± â€”â€”ç›®å‰
   FIRE_SKILL_POOL_3/WATER_SKILL_POOL_3
   æ˜¯æœ€é«˜éšŽçš„æŠ€èƒ½æ± ï¼Œæ²’æœ‰æ›´é«˜ä¸€éšŽçš„æ± å­ï¼Œ
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

    makeZoneMonster("çµ‚ç„‰ç¥žé­”",92,"fire"),
    makeZoneMonster("æœ«ä¸–å¯’ç¥ž",93,"water"),
    makeZoneMonster("çµ‚ç„‰ç¥žé­”",92,"fire"),
    makeZoneMonster("æœ«ä¸–å¯’ç¥ž",93,"water"),
    makeZoneMonster("çµ‚ç„‰ç¥žé­”çš‡",98,"fire"),
    makeZoneMonster("æœ«ä¸–å¯’ç¥žçš‡",100,"water")

];



/*
   â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œã€Œæ•´å€‹æ›æŽ‰ï¼Œ
   ä»¥å¾Œéƒ½å¥—ç”¨ã€ï¼‰ï¼š
   èˆŠçš„ã€Œç²¾è‹±æ€ªåŸºæº–å€¼ Ã— 0.25ã€é€™å¥—æŠ˜æ‰£
   æ©Ÿåˆ¶ï¼Œå·²ç¶“è¢«ä¸Šé¢å…¨æ–°çš„å…­åœèƒ½åŠ›é»žåˆ†é…
   å…¬å¼å®Œå…¨å–ä»£â€”â€”makeZoneMonster()ç¾åœ¨
   ç›´æŽ¥ä¾ç…§ç­‰ç´šç®—å‡ºæœ€çµ‚æ•¸å€¼ï¼Œä¸å†éœ€è¦
   é¡å¤–ç–ŠåŠ ä¸€å±¤ç¸®æ”¾ä¿‚æ•¸ï¼Œé€™è£¡æ•´æ®µæ‹¿æŽ‰ã€‚
*/


/*
   â˜… ç›®å‰æ‰€åœ¨å€åŸŸçš„æ€ªç‰©è³‡æ–™ï¼Œ
   é€²å…¥ä¸åŒç·´åŠŸå€æ™‚æœƒé‡æ–°æŒ‡å‘å°æ‡‰çš„é™£åˆ—ã€‚
   å…¶ä»–æ‰€æœ‰å‡½å¼ï¼ˆrenderBattleã€monsterTurnã€
   respawnMonstersâ€¦ï¼‰éƒ½æ˜¯ç›´æŽ¥è®€é€™å€‹è®Šæ•¸ï¼Œ
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
   â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œã€ŒæŠŠç«å…ƒç´ æŠ€èƒ½
   iconæ”¾å°çš„ä½ç½®ã€ï¼‰ï¼š
   10å€‹ç«ç³»æŠ€èƒ½çš„iconåœ–ç‰‡ï¼ˆä½¿ç”¨è€…ä¸Šå‚³çš„
   AIç”Ÿæˆæ’åœ–ï¼Œå·²è£åˆ‡æˆæ­£æ–¹å½¢ä¸¦å£“ç¸®æˆ
   base64å…§åµŒï¼‰ï¼Œå°æ‡‰è¦å‰‡ä¾ç…§åœ–ç‰‡å…§å®¹
   è·ŸæŠ€èƒ½åç¨±/æ•ˆæžœé…å°ï¼š
   flameSlashï¼ˆç«ç„°æ–¬ï¼Œå…¥é–€å–®é«”æ–¬æ“Šï¼‰
     â†’ ç«ç„°åŠèº«+å¼§å½¢ç«ç—•ï¼Œæœ€åŸºæœ¬çš„
       ã€ŒåŠ+ç«ã€ç•«é¢
   fireCriticalï¼ˆæœƒå¿ƒä¸€æ“Šï¼Œé«˜å‚·å®³å–®é«”ï¼‰
     â†’ åŠæ’åœ°ã€å‘¨åœçˆ†ç™¼ç’°ç‹€ç´…è‰²å…‰æ³¢ï¼Œ
       ä»£è¡¨çˆ†æ“Šçž¬é–“çš„å¼·çƒˆè¡æ“Šæ„Ÿ
   explosiveFlurryï¼ˆç«çˆ†äº‚æ“Šï¼Œä¸‰äººäº‚æ“Šï¼‰
     â†’ è§’è‰²é›™åˆ€çˆ†è£‚æ®ç ï¼Œå°æ‡‰ã€Œäº‚æ“Šã€
       çš„å‹•æ…‹æ„Ÿ
   dragonSlashï¼ˆéœ¸é¾è£‚å¤©æ–¬ï¼Œå–®é«”å¤§å‚·å®³ï¼‰
     â†’ é¾é ­+æ’•è£‚å¤©éš›çš„å…‰æŸæ–¬ï¼Œå‘¼æ‡‰
       æŠ€èƒ½åè£¡çš„ã€Œé¾ã€èˆ‡ã€Œè£‚å¤©ã€
   fireRocketï¼ˆç«ç®­ï¼Œä¸‰äººæ³•è¡“å‚·å®³ï¼‰
     â†’ å¼“+ç‡ƒç‡’çš„ç®­ï¼Œç›´æŽ¥å°æ‡‰ã€Œç®­ã€
       é€™å€‹æŠ€èƒ½å
   blazeSpellï¼ˆçƒˆç«è¡“ï¼Œå–®é«”æ³•è¡“ï¼‰
     â†’ ç´”ç²¹çš„ç«ç„°æ¼©æ¸¦æ³•é™£ï¼Œä»£è¡¨
       æ–½æ³•ç”¢ç”Ÿçš„ç«ç³»æ³•è¡“æ•ˆæžœ
   flameTornadoï¼ˆçƒˆç„°é¾æ²ï¼Œæ•´æŽ’+ç‡ƒç‡’ï¼‰
     â†’ ç«é¾ç›¤æ—‹æˆé¾æ²é¢¨çš„å½¢ç‹€ï¼Œ
       å°æ‡‰æŠ€èƒ½åè£¡çš„ã€Œé¾æ²ã€
   phoenixCryï¼ˆç«é³³å¤©é³´ï¼Œå…¨é«”+ç‡ƒç‡’ï¼‰
     â†’ ç«é³³å‡°å±•ç¿…å˜¶é³´ï¼Œç›´æŽ¥å°æ‡‰
       æŠ€èƒ½åã€Œç«é³³ã€
   rageï¼ˆæ€’ç«ï¼Œçˆ†æ“ŠçŽ‡/å‚·å®³å¢žç›Šï¼‰
     â†’ å’†å“®çš„ç«ç„°æƒ¡é­”è‡‰ï¼Œä»£è¡¨ã€Œæ€’ç«ã€
       ä¸­ç‡’çš„æ†¤æ€’æ„Ÿï¼ˆä¾ä½¿ç”¨è€…å›žå ±ï¼Œ
       è·Ÿæœƒå¿ƒä¸€æ“ŠåŽŸæœ¬é…åäº†ï¼Œé€™è£¡
       å·²ç¶“å°èª¿ï¼‰
   fireEXï¼ˆç«å…ƒç´ EXï¼Œè¢«å‹•ï¼‰
     â†’ åœ–ç‰‡æœ¬èº«å°±å¯«è‘—ã€ŒEXã€å­—æ¨£ï¼Œ
       ç›´æŽ¥å°æ‡‰
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
       â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œã€Œæ›æ°´å…ƒç´ ã€ï¼‰ï¼š
       10å€‹æ°´ç³»æŠ€èƒ½çš„iconï¼Œé…å°ä¾ç…§åœ–ç‰‡å…§å®¹
       è·ŸæŠ€èƒ½åç¨±/æ•ˆæžœï¼š
       waterKnifeï¼ˆæ°´åˆ€æ–¬ï¼Œå…¥é–€å–®é«”ï¼‰
         â†’ ä¸€é“éŠ³åˆ©çš„æ°´/å†°åˆƒæ–œåŠˆè€ŒéŽ
       frostPunchï¼ˆå†°éœœæ‹³ï¼Œå–®é«”ç‰©ç†ï¼‰
         â†’ ä¸€è¨˜å†°éœœæ‹³é ­æ­£é¢æ®å‡º
       iceSpinï¼ˆå†°æ—‹ä¸€é–ƒï¼Œä¸‰äººç‰©ç†ï¼‰
         â†’ æ—‹è½‰çš„å†°ç³»é£›é¢/æ‰‹è£åŠé€ åž‹ï¼Œ
           å‘¼æ‡‰æŠ€èƒ½åè£¡çš„ã€Œæ—‹ã€
       frostCrushï¼ˆå†°å°é‡æ“Šï¼Œå–®é«”å¤§å‚·å®³ï¼‰
         â†’ å†°è£½æˆ°éŽšé‡é‡ç ¸ä¸‹ï¼Œå°æ‡‰
           æŠ€èƒ½åè£¡çš„ã€Œé‡æ“Šã€
       waterBallï¼ˆæ°´çƒè¡“ï¼Œä¸‰äººæ³•è¡“ï¼‰
         â†’ ä¸€é¡†æ¼©æ¸¦ç‹€æ°´çƒï¼Œç›´æŽ¥å°æ‡‰
           æŠ€èƒ½åã€Œæ°´çƒã€
       floodBeastï¼ˆæ´ªæ°´çŒ›ç¸ï¼Œå–®é«”æ³•è¡“ï¼‰
         â†’ å·¨å¤§çš„æ°´ç³»æ€ªç¸å’†å“®ï¼Œç›´æŽ¥å°æ‡‰
           æŠ€èƒ½åã€ŒçŒ›ç¸ã€
       freezeï¼ˆå†°å°ï¼Œç´”æŽ§å ´ç„¡å‚·å®³ï¼‰
         â†’ å†°æ™¶å°–åˆºå¾žå–®ä¸€åœ°é»žçˆ†ç™¼è€Œå‡ºï¼Œ
           å‘¼æ‡‰ã€Œå†°å°ã€å›°ä½ç›®æ¨™çš„ç•«é¢
       reviveï¼ˆå¾©æ´»è¡“ï¼Œå¾©æ´»å‹æ–¹ï¼‰
         â†’ æ„›å¿ƒ+åå­—+äººå½¢å‰ªå½±ï¼Œç›´æŽ¥å°æ‡‰
           ã€Œå¾©æ´»ã€çš„é‡ç”Ÿæ„è±¡
       healSpellï¼ˆæ²»ç™‚è¡“ï¼Œæ¢å¾©HP/SPï¼‰
         â†’ é›™æ‰‹æ§è‘—ç¶ é‡‘è‰²å…‰èŠ’ï¼Œä»£è¡¨
           æ²»ç™‚çš„æº«æš–æ„Ÿè¦º
       waterEXï¼ˆæ°´å…ƒç´ EXï¼Œè¢«å‹•ï¼‰
         â†’ åœ–ç‰‡æœ¬èº«å¯«è‘—ã€ŒEXã€å­—æ¨£

       å¦å¤–ä½¿ç”¨è€…é€™æ¬¡ä¸Šå‚³äº†11å¼µåœ–ï¼Œ
       ä½†æ°´ç³»åªæœ‰10å€‹æŠ€èƒ½ï¼Œå…¶ä¸­ä¸€å¼µ
       ï¼ˆæˆç‰‡å†°ç®­å¾žå¤©è€Œé™çš„ç•«é¢ï¼‰ç›®å‰
       æ²’æœ‰å°æ‡‰çš„æŠ€èƒ½å¯ä»¥æ”¾ï¼Œå…ˆæ²’æœ‰
       ä½¿ç”¨ï¼Œå¦‚æžœä¹‹å¾Œæ°´ç³»æ–°å¢žæŠ€èƒ½
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
       â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œã€Œæ°´å…ƒç´ 
       11æ‹›ã€æ–°å¢žçš„å†°éœœç®­é›¨æŠ€èƒ½ï¼‰ï¼š
       iceArrowRainï¼ˆå†°éœœç®­é›¨ï¼Œå…¨é«”æ³•è¡“ï¼‰
         â†’ æˆç‰‡å†°ç®­å¾žå¤©è€Œé™ï¼Œç›´æŽ¥å°æ‡‰
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
       â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼ŒåœŸç³»æŠ€èƒ½iconï¼‰ï¼š
       é€™æ¬¡ä½¿ç”¨è€…ä¸Šå‚³äº†15å¼µåœ–ï¼Œå…¶ä¸­4å¼µæ˜¯ç”·è§’Qç‰ˆå·¡æ€ªèƒŒé¢ç«‹ç¹ª
       ï¼ˆä¸æ˜¯æŠ€èƒ½iconï¼Œå¦å¤–è™•ç†ï¼‰ï¼Œå‰©ä¸‹11å¼µæ˜¯æŠ€èƒ½iconå€™é¸ã€‚
       åœŸç³»ç¸½å…±12å€‹æŠ€èƒ½ï¼Œé€å¼µæ¯”å°åç¨±/æŠ€èƒ½æè¿°å¾Œé…å°ï¼š

       â˜… ä¿®æ­£ï¼ˆ2026-08-25ï¼Œä½¿ç”¨è€…æä¾›å¸¶åç¨±æ¨™ç±¤çš„åƒè€ƒåœ–é‡æ–°æ ¸å°ï¼‰ï¼š
       ä½¿ç”¨è€…æŠŠ8å¼µå€™é¸åœ–å„è‡ªæ¨™ä¸Šæ­£ç¢ºçš„æŠ€èƒ½åç¨±å‚³å›žä¾†ï¼Œ
       ç”¨åƒç´ æ¯”å°ï¼ˆä¸æ˜¯è‚‰çœ¼çŒœï¼‰ç¢ºèªæ¯å¼µæ¨™ç±¤åœ–å°æ‡‰åˆ°
       åŽŸå§‹å€™é¸åœ–è£¡çš„å“ªä¸€å¼µï¼ŒæŠ“å‡ºå¯¦éš›é…éŒ¯çš„4å€‹ï¼Œ
       ä¸¦è£œä¸Šä¸€å¼µå…¨æ–°çš„earthEXå°ˆç”¨åœ–ï¼ˆåœ–ä¸Šç›´æŽ¥å¯«è‘—
       ã€ŒEXã€å­—æ¨£ï¼Œè·Ÿfire-ex.jpgï¼water-ex.jpgåŒæ¬¾å¼ï¼‰ï¼š

       petrifyFistï¼ˆçŸ³ç›¾æ‹³ï¼Œç‰©ç†ï¼Œé€ æˆå‚·å®³+å…¨é«”è­·ç›¾ï¼‰
         â†’ æ‹³é ­å‡ºæ“Šã€èº«å¾Œæœ‰å²©çŸ³è­·ç›¾å…‰ç’°çš„ç•«é¢ã€‚åŽŸæœ¬é…å°æ­£ç¢ºï¼Œ
           æ²’æœ‰è®Šå‹•ã€‚
       stoneBreakSkyï¼ˆçŸ³ç ´å¤©é©šï¼Œç‰©ç†ï¼Œå–®é«”å¤§å‚·å®³+è­·ç›¾ï¼‰
         â†’ å·¨å¤§å²©çŸ³è£‚é–‹ã€å…‰èŠ’ç‚¸é–‹çš„ç•«é¢ï¼ˆå¸¶æ¼©æ¸¦å…‰ç’°é‚£å¼µï¼‰ã€‚
           â˜…åŽŸæœ¬èª¤é…åˆ°ã€ŒåœŸçŸ³æ–¬ã€ç”¨çš„é‚£å¼µåœ–ï¼Œé€™æ¬¡ä¿®æ­£ã€‚
       earthquakeCrushï¼ˆåœ°è£‚é‡æ‹³ï¼Œç‰©ç†ï¼Œä¸‰äººå‚·å®³+è‡ªèº«è­·ç›¾ï¼‰
         â†’ å·¨å¤§æ‹³é ­å½¢å²©å±¤è£‚é–‹ã€é‡‘å…‰å››å°„çš„ç•«é¢ã€‚
           â˜…åŽŸæœ¬èª¤é…åˆ°ã€Œé£›æ²™çž¬æ“Šã€ç”¨çš„é‚£å¼µåœ–ï¼Œé€™æ¬¡ä¿®æ­£ã€‚
       stoneThrowï¼ˆè½çŸ³è¡“ï¼Œæ³•è¡“ï¼Œä¸‰äººå‚·å®³+é™é˜²ï¼‰
         â†’ å·¨çŸ³å¾žå¤©è€Œé™çš„ç•«é¢ï¼Œç›´æŽ¥å°æ‡‰ã€Œè½çŸ³ã€ã€‚åŽŸæœ¬é…å°
           æ­£ç¢ºï¼Œæ²’æœ‰è®Šå‹•ã€‚
       sandWindï¼ˆæ»¾çŸ³è¡“ï¼Œæ³•è¡“ï¼Œæ©«æŽ’å‚·å®³+é™é˜²ï¼‰
         â†’ å·¨çŸ³æ»¾å‹•ã€æ‹–å‡ºå…‰è·¡çš„ç•«é¢ï¼Œå°æ‡‰ã€Œæ»¾çŸ³ã€ã€‚
           â˜…åŽŸæœ¬èª¤é…åˆ°ã€Œé£›æ²™çž¬æ“Šã€ç”¨çš„é‚£å¼µåœ–ï¼Œé€™æ¬¡ä¿®æ­£ã€‚
       flyingSandStrikeï¼ˆé£›æ²™çž¬æ“Šï¼Œæ³•è¡“ï¼Œå…¨é«”å‚·å®³+æ©ŸçŽ‡çŸ³åŒ–ï¼‰
         â†’ é‡‘è‰²æ²™å¡µ/èƒ½é‡æ¼©æ¸¦ç•«é¢ï¼Œå°æ‡‰ã€Œé£›æ²™ã€ã€‚
           â˜…åŽŸæœ¬èª¤é…åˆ°ã€Œæ»¾çŸ³è¡“ã€ç”¨çš„é‚£å¼µåœ–ï¼Œé€™æ¬¡ä¿®æ­£ã€‚
       dustStormï¼ˆåœ°ç‰›çŒ›è¥²ï¼Œæ³•è¡“ï¼Œå…¨é«”å‚·å®³+é™é˜²ï¼‰
         â†’ å²©çŸ³å·¨ç‰›è¡é‹’çš„ç•«é¢ï¼Œç›´æŽ¥å°æ‡‰ã€Œåœ°ç‰›ã€ã€‚åŽŸæœ¬é…å°
           æ­£ç¢ºï¼Œæ²’æœ‰è®Šå‹•ã€‚
       rockWallï¼ˆå²©çŸ³å£å£˜ï¼Œå¢žç›Šï¼Œå…¨é«”é˜²ç¦¦æå‡ï¼‰
         â†’ ä¸€æ•´æŽ’å²©çŸ³å°–å¡”ä¸¦åˆ—çš„ç•«é¢ï¼Œç›´æŽ¥å°æ‡‰ã€Œå£å£˜ã€ã€‚åŽŸæœ¬
           é…å°æ­£ç¢ºï¼Œæ²’æœ‰è®Šå‹•ã€‚
       barrierï¼ˆçµç•Œï¼Œå¢žç›Šï¼Œå–®é«”å®Œå…¨é˜²è­·ï¼‰
         â†’ ç™¼å…‰çš„é­”æ³•é™£åœ“é ‚çµç•Œç•«é¢ï¼Œç›´æŽ¥å°æ‡‰ã€Œçµç•Œã€ã€‚åŽŸæœ¬
           é…å°æ­£ç¢ºï¼Œæ²’æœ‰è®Šå‹•ã€‚
       stoneSlashï¼ˆåœŸçŸ³æ–¬ï¼Œå…¥é–€å–®é«”ç‰©ç†æŠ€èƒ½ï¼‰
         â†’ ä½¿ç”¨è€…æ¨™æ˜Žæ˜¯ã€Œå²©çŸ³è£‚é–‹ã€å…‰æŸæ–œåŠˆã€é‚£å¼µåœ–
           ï¼ˆåŽŸæœ¬èª¤é…åˆ°ã€Œåœ°è£‚é‡æ‹³ã€ï¼Œç¾åœ¨è£œå›žæ­£ç¢ºä½ç½®ï¼‰ã€‚
       earthEXï¼ˆåœŸå…ƒç´ EXï¼Œè¢«å‹•ï¼‰
         â†’ ä½¿ç”¨è€…æ–°æä¾›çš„å°ˆç”¨ã€ŒEXã€å­—æ¨£åœ–ï¼Œè·Ÿ
           fire-ex.jpgï¼water-ex.jpgåŒæ¬¾å¼ã€‚

       â˜… earthShieldï¼ˆè¬è±¡åœŸç›¾ï¼Œå¢žç›Šï¼Œå–®é«”åå‚·è­·ç›¾ï¼‰
       ä½¿ç”¨è€…é‡æ–°æä¾›ä¸¦æ¨™æ˜Žã€Œè¬è±¡åœŸç›¾ã€å°ˆç”¨åœ–ï¼ˆé‡‘è‰²åœŸç›¾æ­£é¢
       ç‰¹å¯«ï¼‰ï¼Œè£œå›žé€™å€‹keyã€‚
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
   â˜… æ–°å¢žï¼šå–å¾—æŠ€èƒ½iconçš„CSSèƒŒæ™¯åœ–ç‰‡å­—ä¸²ï¼Œ
   ç›®å‰åªæœ‰ç«ç³»10å€‹æŠ€èƒ½æœ‰åœ–ï¼Œå…¶ä»–å…ƒç´ 
   ï¼ˆæ°´/é¢¨/åœŸï¼‰é‚„æ²’æœ‰iconï¼Œé€™è£¡çµ±ä¸€åš
   nullä¿è­·ï¼Œæ²’æœ‰å°æ‡‰åœ–ç‰‡å°±å›žå‚³ç©ºå­—ä¸²ï¼Œ
   è®“é‚£æ ¼iconæ¡†ä¿æŒåŽŸæœ¬çš„ç©ºç™½æ¨£å¼ï¼Œ
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
   â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œã€Œå‰ç½®æŠ€èƒ½è¦
   å­¸å¾—æ©Ÿåˆ¶ã€ï¼Œç›®å‰åªå¥—ç”¨åœ¨ç«/æ°´å…©ç³»ï¼Œ
   é¢¨/åœŸç³»skillDatabaseé‚„æ²’æœ‰requires
   æ¬„ä½ï¼Œä¹‹å¾Œè¦åšå†è£œï¼‰ï¼š

   æ¯å€‹æŠ€èƒ½å¯ä»¥æœ‰ä¸€å€‹requiresé™£åˆ—ï¼Œè£¡é¢
   æ”¾ã€Œéœ€è¦å“ªäº›æŠ€èƒ½idã€ï¼Œè¦å‰‡çµ±ä¸€æ˜¯
   ã€ŒORã€ï¼ˆä»»ä¸€ï¼‰é—œä¿‚â€”â€”é™£åˆ—è£¡åªè¦æœ‰
   ä»»ä½•ä¸€å€‹æŠ€èƒ½ç­‰ç´š>0ï¼Œå‰ç½®å°±ç®—é€šéŽã€‚
   å–®ä¸€å‰ç½®ç›´æŽ¥å¯«æˆé•·åº¦1çš„é™£åˆ—å³å¯
   ï¼ˆ['flameSlash']é€™ç¨®ï¼‰ï¼Œæ•ˆæžœç­‰åŒ
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
   â˜… æ–°å¢žï¼šæŠŠrequiresé™£åˆ—è½‰æˆçµ¦çŽ©å®¶çœ‹çš„
   ä¸­æ–‡æç¤ºï¼Œä¾‹å¦‚ã€Œéœ€å…ˆå­¸ç¿’ï¼šæœƒå¿ƒä¸€æ“Šã€
   æˆ–ã€Œéœ€å…ˆå­¸ç¿’ï¼šç«çˆ†äº‚æ“Šæˆ–çƒˆç„°é¾æ²å…¶ä¸€ã€ï¼Œ
   æŠ“ä¸åˆ°æŠ€èƒ½åç¨±æ™‚ä¿åº•é¡¯ç¤ºidæœ¬èº«ï¼Œ
   é¿å…æ•´æ®µæ¶ˆå¤±è®“çŽ©å®¶ä¸€é ­éœ§æ°´ã€‚
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
           ç©ºç©ºçš„ã€ã€‚ä½†ä½¿ç”¨è€…ç¾åœ¨æ˜Žç¢ºè¡¨ç¤º
           ä¸å¸Œæœ›å‰µè§’æ™‚è‡ªå‹•å¹«ä»–é¸æŠ€èƒ½ï¼Œ
           è¦è‡ªå·±æ±ºå®šå­¸ä»€éº¼â€”â€”æ”¹æˆå®Œå…¨ç©ºç™½ï¼Œ
           ä¸å†è‡ªå‹•å¡žä»»ä½•æŠ€èƒ½é€²åŽ»ã€‚
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
        name:"åœŸé¨Žå£«",
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
        name:"çš®éž‹",
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
        name:"å›žå¾©10%HPè—¥æ°´",
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
        name:"å›žå¾©10%SPè—¥æ°´",
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
   â˜… æ–°å¢žï¼šé€™å ´æˆ°é¬¥å¯¦éš›æ²å…¥çš„æ€ªç‰©ã€ŒåŽŸå§‹é™£åˆ—ç´¢å¼•ã€æ¸…å–®ã€‚
   éš¨æ©Ÿ1~3éš»ï¼Œä¸å†æ˜¯æ¯å ´éƒ½å›ºå®šæŠŠæ•´æ‰¹æ€ªéƒ½æ‹–é€²ä¾†æ‰“ã€‚
   å…¶ä»–å‡½å¼ï¼ˆæ¸²æŸ“ã€ç›®æ¨™é¸æ“‡ã€å›žåˆã€çµç®—ï¼‰
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
        catch(error){ console.error("æŒçºŒå¢žç›Šåˆ°æœŸè™•ç†å™¨å¤±æ•—ï¼š",error); }
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
        addBattleLog("â³"+(buff.statusName||buff.type)+"æ•ˆæžœå·²çµæŸã€‚");
    }
}
function expireBattleActionStatus(entity,effect){
    if(!entity||!effect||!Array.isArray(entity.statusEffects)){ return; }
    effect.turnsLeft=Math.max(0,battleDurationNumber(effect.turnsLeft)-1);
    if(effect.turnsLeft>0){ return; }
    entity.statusEffects=entity.statusEffects.filter(item=>item!==effect);
    if(typeof addBattleLog==="function"){
        const name=effect.type==="freeze"?"å†°å°":effect.type==="petrify"?"çŸ³åŒ–":effect.type==="frostbite"?"å‡å‚·":effect.type;
        addBattleLog((entity.id||entity.name||"ç›®æ¨™")+"çš„"+name+"æ•ˆæžœå·²è§£é™¤ã€‚");
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

    prompt.textContent="ç¬¬ "+Math.max(1,Math.floor(Number(turn)||1))+" å›žåˆ";
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
        catch(error){ console.error("æˆ°é¬¥å›žåˆé‚Šç•Œè§€å¯Ÿå™¨å¤±æ•—ï¼š",error); }
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
        console.error("æˆ°é¬¥è¡Œå‹•è¶…éŽå®‰å…¨æœŸé™ï¼Œå·²é‡‹æ”¾æµç¨‹é–˜é–€ã€‚",{token:token,initiativeIndex:index});
        addBattleLog("æœ¬æ¬¡è¡Œå‹•æœªæ­£å¸¸å›žæ”¶ï¼Œå·²ç”±å®‰å…¨é–˜é–€å¼·åˆ¶ç¹¼çºŒã€‚");
        const director=typeof window!=="undefined"?window.v142SkillAnimationDirector:null;
        const gate=director&&typeof director.getActive==="function"?director.getActive():null;
        if(gate&&!gate.done&&typeof gate.complete==="function"){ gate.complete("combat-action-watchdog"); }
        finishPlayerAction();
    },BATTLE_ACTION_WATCHDOG_MS);
}

let monsterMoveId=null;

let respawnId=null;

/*
   â˜… æ–°å¢žï¼šç›®å‰è¼ªåˆ°èª°æ‰‹å‹•è¡Œå‹•
   ï¼ˆ0=ç¬¬ä¸€è§’è‰²ã€1=ç¬¬äºŒè§’è‰²ï¼‰ã€‚
   æ¯æ¬¡startTurn()é‡ç½®å›ž0ï¼Œ
   finishPlayerAction()çµæŸä¸€å€‹è§’è‰²çš„è¡Œå‹•å¾Œ
   å¾€å¾ŒæŽ¨ä¸€æ ¼ï¼Œç›´åˆ°æ´»è‘—çš„è§’è‰²éƒ½è¡Œå‹•éŽï¼Œ
   æ‰æœƒé€²å…¥æ€ªç‰©å›žåˆã€‚
*/

let activeBattleCharacterIndex=0;

/*
   â˜… æ–°å¢žï¼ˆçœŸæ­£æŠ“åˆ°ã€Œå®£å‘ŠéšŽæ®µè¢«é‡è¤‡è™•ç†ã€
   çš„æ ¹æºä¹‹å¾Œè£œä¸Šçš„é˜²è­·ï¼‰ï¼š

   æ‰‹æ©Ÿç€è¦½å™¨èƒŒæ™¯åŸ·è¡Œæ™‚ï¼ŒsetTimeoutä¸ä¿è­‰
   æº–æ™‚è§¸ç™¼ï¼Œå¯èƒ½è¢«ç³»çµ±å»¶å¾Œã€ä¹‹å¾Œåˆè·Ÿå…¶ä»–
   è¨ˆæ™‚å™¨ã€Œä¸€æ¬¡è£œç™¼ã€ï¼Œå°Žè‡´beginCharacterTurn()
   è¢«åŒä¸€å€‹activeBattleCharacterIndexå€¼
   å‘¼å«å…©æ¬¡â€”â€”é€™ä¸æ˜¯ç¨‹å¼é‚è¼¯å¯«éŒ¯ï¼Œæ˜¯è¨ˆæ™‚å™¨
   æœ¬èº«ä¸å¯é ï¼Œå…‰é battleToken/tokenæ¯”å°
   æ“‹ä¸ä½ï¼ˆåŒä¸€å ´æˆ°é¬¥ã€tokenæ²’è®Šï¼Œåªæ˜¯
   åŒä¸€å€‹å®£å‘Šæ­¥é©Ÿè¢«è§¸ç™¼äº†å…©æ¬¡ï¼‰ã€‚

   ç”¨é€™å€‹Setè¨˜éŒ„ã€Œé€™å€‹å¤§å›žåˆè£¡ï¼Œå“ªäº›
   activeBattleCharacterIndexå·²ç¶“çœŸæ­£
   å®£å‘ŠéŽã€ï¼ŒbeginCharacterTurn()ä¸€é–‹å§‹
   å¦‚æžœç™¼ç¾ç•¶ä¸‹é€™å€‹ç´¢å¼•å·²ç¶“åœ¨æ¸…å–®è£¡ï¼Œ
   ä»£è¡¨æ˜¯é‡è¤‡/å»¶é²è£œç™¼çš„å‘¼å«ï¼Œç›´æŽ¥è·³éŽã€
   ä¸åšä»»ä½•äº‹ï¼Œä¸æœƒè®“è§’è‰²ç´¢å¼•è¢«å¤šæŽ¨é€²ã€
   ä¸æœƒè®“è‡ªå‹•åˆ¤æ–·å‡½å¼è¢«é‡è¤‡å‘¼å«ã€‚
   æ¯æ¬¡startTurn()é–‹æ–°çš„å¤§å›žåˆæ™‚æ¸…ç©ºã€‚
*/

let declaredCharacterIndexes=
    new Set();

/*
   â˜… æ–°å¢žï¼ˆçœŸæ­£è£œä¸Šå‰©ä¸‹é‚£å€‹æ¼æ´žï¼‰ï¼š
   declaredCharacterIndexesåªæ“‹å¾—ä½
   ã€ŒåŒä¸€å€‹è§’è‰²è¢«é‡è¤‡å®£å‘Šã€ï¼Œæ²’æ“‹åˆ°
   ã€Œå®£å‘ŠéšŽæ®µçµæŸã€è¦è·³é€²çµç®—éšŽæ®µã€é€™å€‹
   è½‰æ›é»žæœ¬èº«è¢«é‡è¤‡è§¸ç™¼â€”â€”beginCharacterTurn()
   åœ¨activeBattleCharacterIndexè¶…å‡ºéšŠä¼
   é•·åº¦æ™‚æœƒå‘¼å«startResolutionPhase()ï¼Œ
   ä½†é€™å€‹è½‰æ›æ²’æœ‰è¢«è¨˜éŒ„é€²é˜²é‡è¤‡æ¸…å–®ï¼Œ
   åªè¦é€™æ¬¡å‘¼å«å› ç‚ºæ‰‹æ©Ÿç€è¦½å™¨è¨ˆæ™‚å™¨å»¶é²/
   è£œç™¼è¢«å¤šè§¸ç™¼ä¸€æ¬¡ï¼Œå°±æœƒæŠŠinitiativeQueueã€
   initiativeIndexã€processedInitiativeIndexes
   å…¨éƒ¨é‡æ–°è“‹éŽåŽ»ã€ç æŽ‰é‡ç·´ï¼Œç­‰æ–¼çµç®—éšŽæ®µ
   å¾žé ­é‡æ–°é–‹å§‹ä¸€æ¬¡ï¼Œå·²ç¶“è™•ç†éŽçš„æ€ªç‰©/è§’è‰²
   è¡Œå‹•æœƒè¢«é‡è¤‡åŸ·è¡Œâ€”â€”é€™æ­£æ˜¯ã€ŒåŒä¸€éš»æ€ªç‰©
   ä¸€å€‹å›žåˆæ”»æ“Šå…©æ¬¡ã€ã€Œé€£çºŒè·³å…©å€‹å›žåˆã€
   çš„çœŸæ­£åŽŸå› ã€‚

   ç”¨é€™å€‹æ——æ¨™è¨˜éŒ„ã€Œé€™å€‹å¤§å›žåˆçš„çµç®—éšŽæ®µ
   æ˜¯ä¸æ˜¯å·²ç¶“çœŸçš„é–‹å§‹éŽäº†ã€ï¼Œ
   startResolutionPhase()ä¸€é–‹å§‹å¦‚æžœç™¼ç¾
   å·²ç¶“é–‹å§‹éŽï¼Œä»£è¡¨æ˜¯é‡è¤‡/å»¶é²è£œç™¼çš„å‘¼å«ï¼Œ
   ç›´æŽ¥è·³éŽã€ä¸æœƒé‡å»ºä½‡åˆ—ã€‚
   æ¯æ¬¡startTurn()é–‹æ–°çš„å¤§å›žåˆæ™‚é‡ç½®ç‚ºfalseã€‚
*/

let resolutionPhaseStarted=
    false;

/*
   â˜… æ–°å¢žï¼ˆçœŸæ­£è£œä¸Šæœ€å¾Œä¸€å€‹æ¼æ´žï¼‰ï¼š
   è·ŸresolutionPhaseStartedåŒæ¨£çš„é“ç†ï¼Œ
   processNextCombatant()è£¡ã€Œé€™å€‹å¤§å›žåˆ
   çµç®—å®Œç•¢ã€è¦è·³åˆ°ä¸‹ä¸€å€‹å¤§å›žåˆã€çš„åˆ†æ”¯
   ï¼ˆinitiativeIndex>=initiativeQueue.length
   æ™‚turn++; startTurn(token)ï¼‰å®Œå…¨æ²’æœ‰
   é˜²é‡è¤‡ä¿è­·â€”â€”é€™å€‹åˆ†æ”¯æœ¬èº«ä¸å±¬æ–¼ä»»ä½•
   ä¸€å€‹ã€Œå·²è™•ç†çš„initiativeIndexã€ï¼Œ
   processedInitiativeIndexesé‚£å€‹Set
   æ“‹ä¸åˆ°å®ƒã€‚åªè¦é€™æ¬¡å‘¼å«å› ç‚ºæ‰‹æ©Ÿç€è¦½å™¨
   è¨ˆæ™‚å™¨å»¶é²/è£œç™¼è¢«å¤šè§¸ç™¼ä¸€æ¬¡ï¼Œå°±æœƒ
   turn++å…©æ¬¡ã€startTurn()è¢«å‘¼å«å…©æ¬¡ï¼Œ
   ç•«é¢ä¸Šæœƒçœ‹åˆ°ã€Œç¬¬8å›žåˆï¼Œé–‹å§‹ï¼
   ç¬¬9å›žåˆï¼Œé–‹å§‹ï¼ã€é€™ç¨®é€£çºŒè·³å…©è¼ªã€
   ä¸­é–“å®Œå…¨æ²’æœ‰ä»»ä½•è§’è‰²/æ€ªç‰©è¡Œå‹•çš„æƒ…æ³ã€‚

   ç”¨é€™å€‹æ——æ¨™è¨˜éŒ„ã€Œé€™å€‹å¤§å›žåˆæ˜¯ä¸æ˜¯å·²ç¶“
   çœŸçš„è§¸ç™¼éŽã€Žè·³åˆ°ä¸‹ä¸€è¼ªã€ã€ï¼Œé‡è¤‡å‘¼å«
   ç›´æŽ¥æ“‹ä¸‹ã€‚æ¯æ¬¡startTurn()çœŸæ­£é–‹å§‹
   æ–°çš„ä¸€è¼ªæ™‚é‡ç½®ç‚ºfalseã€‚
*/

let turnAdvancePending=
    false;

/*
   â˜… æ–°å¢žï¼ˆé‡æ–°è¨­è¨ˆå›žåˆåˆ¶ï¼‰ï¼š
   ä½¿ç”¨è€…æ˜Žç¢ºæŒ‡å‡ºï¼šæ­£ç¢ºçš„å›žåˆåˆ¶æ‡‰è©²æ˜¯
   ã€Œé›™æ–¹å…ˆå„è‡ªè¨­å®šå¥½é€™å›žåˆè¦åšä»€éº¼ï¼Œ
   å…¨éƒ¨è¨­å®šå®Œï¼Œæ‰ä¾æ•æ·é«˜ä½Žé–‹å§‹åŸ·è¡Œã€ï¼Œ
   ä¸æ˜¯ã€Œèª°å¿«èª°å…ˆåšï¼Œå…¶ä»–äººé€£é¸éƒ½é‚„æ²’é¸ã€ã€‚

   battlePhaseç´€éŒ„ç›®å‰é€™å€‹å¤§å›žåˆèµ°åˆ°å“ªå€‹éšŽæ®µï¼š
   "declare" = å®£å‘ŠéšŽæ®µï¼ŒçŽ©å®¶è§’è‰²ä¾åºé¸å¥½
   é€™å›žåˆè¦åšä»€éº¼ï¼ˆæ™®é€šæ”»æ“Š/æŠ€èƒ½ï¼Œå«é¸ç›®æ¨™ï¼‰ï¼Œ
   é¸å®Œå…ˆã€Œè¨˜ä½ã€ï¼Œä¸æœƒé¦¬ä¸Šå‡ºæ‰‹ã€‚

   "resolve" = çµç®—éšŽæ®µï¼ŒæŠŠæ‰€æœ‰å·²å®£å‘Šçš„çŽ©å®¶è¡Œå‹•
   è·Ÿæ€ªç‰©æ··åœ¨ä¸€èµ·ï¼Œä¾æ•æ·é«˜ä½ŽæŽ’åºï¼Œ
   ä¸€å€‹ä¸€å€‹çœŸæ­£åŸ·è¡Œã€æ‰£è¡€ã€‚

   åªæœ‰ã€Œæ™®é€šæ”»æ“Šã€ã€Œå‚·å®³æŠ€èƒ½ã€é€™ç¨®æœƒå½±éŸ¿åˆ°æ€ªç‰©ã€
   è·Ÿæ€ªç‰©å‡ºæ‰‹é †åºæœ‰æ„ç¾©é—œè¯çš„è¡Œå‹•éœ€è¦é€²åˆ°å®£å‘Š/çµç®—
   å…©éšŽæ®µï¼›é˜²ç¦¦ã€ç‰©å“ã€å¢žç›Šã€æ²»ç™‚é€™é¡žä¸ç‰½æ¶‰
   è·Ÿæ€ªç‰©æ¯”å¿«æ…¢çš„è¡Œå‹•ï¼Œç¶­æŒåŽŸæœ¬ã€Œé¸äº†å°±ç«‹åˆ»ç”Ÿæ•ˆã€ï¼Œ
   ä¸éœ€è¦é¡å¤–ç­‰å¾…ï¼Œé€™æ¨£æ‰ä¸æœƒè®“é˜²ç¦¦é€™ç¨®
   ã€Œé¦¬ä¸Šå°±è¦ç”Ÿæ•ˆã€çš„å‹•ä½œä¹Ÿè¢«è¿«å»¶é²ã€‚
*/

let battlePhase="declare";

let queuedPlayerActions={};

let mapCooldown=false;

/*
   â˜… è‡ªå‹•å·¡æ€ªé˜²å¡æ­»ï¼š
   mapCooldown åªä»£è¡¨ã€Œæš«æ™‚ç¦æ­¢é–‹æˆ°ã€ï¼Œ
   ä¸æ‡‰è©²ç›´æŽ¥ç­‰åŒæ–¼ã€Œåœæ­¢è‡ªå‹•å·¡æ€ªã€ã€‚
   å¦å¤–ä¿ç•™ timeout handleï¼Œè®“æˆ‘å€‘å¯ä»¥åˆ¤æ–·
   cooldown æ˜¯å¦çœŸçš„æœ‰ä¸€å€‹è§£é™¤æŽ’ç¨‹ã€‚
*/
let mapCooldownTimeoutId=null;

let autoBattle=false;

let actionReady=false;

let pendingAction=null;

/*
   â˜… æ–°å¢žï¼ˆä¿®æ­£è¨­å®šé¢æ¿åˆ‡æ›è§’è‰²æœƒéºå¤±æœªå„²å­˜è®Šæ›´çš„bugï¼‰ï¼š
   è¨˜éŒ„è¨­å®šé¢æ¿ç›®å‰é¡¯ç¤ºçš„æ˜¯ã€Œå“ªå€‹è§’è‰²ã€çš„è³‡æ–™ï¼Œ
   æ¯æ¬¡åˆ‡æ›è§’è‰²ä¹‹å‰ï¼Œå…ˆæŠŠç›®å‰ç•«é¢ä¸Šçš„å€¼
   å­˜å›žé€™å€‹è§’è‰²èº«ä¸Šï¼Œå†æ›é¡¯ç¤ºæ–°è§’è‰²çš„è³‡æ–™ï¼Œ
   é€™æ¨£ä½¿ç”¨è€…å¯ä»¥è‡ªç”±åˆ‡æ›Aã€Bå…©å€‹è§’è‰²èª¿æ•´ï¼Œ
   æœ€å¾Œçµ±ä¸€æŒ‰ä¸€æ¬¡ç¢ºå®šå°±å¥½ï¼Œä¸ç”¨æ¯æ›ä¸€å€‹è§’è‰²
   å°±è¦å…ˆæŒ‰ä¸€æ¬¡ç¢ºå®šï¼Œä¸ç„¶åˆ‡æ›é‚£ä¸€åˆ»
   é‚„æ²’å„²å­˜çš„èª¿æ•´æœƒç›´æŽ¥æ¶ˆå¤±ã€‚
*/

let autoSettingsCurrentCharacter=0;


const autoConfig = {

    enabled:false,

    skill:"normal",

    hp:50,

    sp:25,

    /*
       â˜… æ–°å¢žï¼šæ²’è—¥æ°´çš„è©±è‡ªå‹•å›žä¸»åŸŽã€‚
       æˆ°é¬¥çµæŸã€å›žåˆ°ç·´åŠŸå€åœ°åœ–ä¹‹å¾Œï¼Œ
       å¦‚æžœåµæ¸¬åˆ°HP/SPè—¥æ°´éƒ½ç”¨å®Œäº†ï¼Œ
       è‡ªå‹•å¹«çŽ©å®¶å°Žå›žä¸»åŸŽï¼Œ
       ä¸ç”¨è‡ªå·±è¨˜å¾—è¦å›žåŽ»è£œè²¨ã€‚
    */

    returnToCityWhenEmpty:false

};


/*
   â˜… æ–°å¢žï¼šç¬¬äºŒè§’è‰²å°ˆå±¬çš„è‡ªå‹•æˆ°é¬¥è¨­å®šã€‚
   è·Ÿç¬¬ä¸€è§’è‰²çš„autoConfigçµæ§‹ä¸€æ¨£ï¼Œ
   ä½†å®Œå…¨ç¨ç«‹ï¼Œå› ç‚ºç¬¬äºŒè§’è‰²æ˜¯è‡ªå‹•ä½œæˆ°çš„éšŠå‹ï¼Œ
   ä¸€å®šè¦æœ‰è‡ªå·±çš„æŠ€èƒ½/HPé–€æª»/SPé–€æª»è¨­å®šï¼Œ
   ä¸èƒ½å…±ç”¨ç¬¬ä¸€è§’è‰²é‚£çµ„ï¼ˆæŠ€èƒ½éƒ½ä¸ä¸€æ¨£ï¼‰ã€‚
*/

/*
   â˜… ä¿®æ­£ï¼š
   ä¹‹å‰ç¬¬äºŒè§’è‰²æ°¸é è‡ªå‹•è¡Œå‹•ï¼Œæ²’æœ‰æ‰‹å‹•é¸é …ï¼Œ
   æ‰€ä»¥é€™è£¡åŽŸæœ¬æ²’æœ‰enabledæ¬„ä½ã€‚
   ç¾åœ¨ç¬¬äºŒè§’è‰²ä¹Ÿèƒ½æ‰‹å‹•æ“ä½œäº†ï¼Œ
   é è¨­enabled:falseï¼ˆæ‰‹å‹•ï¼‰ï¼Œ
   è·Ÿç¬¬ä¸€è§’è‰²çš„é è¨­è¡Œç‚ºä¸€è‡´ï¼Œ
   çŽ©å®¶å¯ä»¥è‡ªå·±é¸è¦æ‰‹å‹•æŽ§åˆ¶é‚„æ˜¯äº¤çµ¦AIæ‰“ã€‚
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
   è®€åˆ°èˆŠå€¼æ™‚å–æœ€æŽ¥è¿‘çš„æ–°é–€æª»ï¼Œé¿å…ä¸‹æ‹‰é¸å–®å‡ºç¾ç©ºç™½ã€‚ */
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
   â˜… ç‹€æ…‹é è§’è‰²åˆ‡æ›ï¼ˆæ–°å¢žï¼‰ã€‚
   0=ç¬¬ä¸€è§’è‰²ï¼ˆplayerï¼‰ï¼Œ1=ç¬¬äºŒè§’è‰²ï¼ˆplayer2ï¼‰ã€‚
   player2ä¸å­˜åœ¨æ™‚æ°¸é åœåœ¨0ï¼Œ
   åˆ‡æ›æŒ‰éˆ•æœƒè¢«æ“‹æŽ‰ã€‚
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
   â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œã€ŒçŽ©å®¶æˆ°é¬¥ç«‹ç¹ªèƒ½å¦åŽ»èƒŒã€ï¼‰ï¼š
   è·ŸgetCharacterArtworkPath()å…±ç”¨åŒä¸€çµ„gender/element
   åˆ¤æ–·é‚è¼¯ï¼Œä½†å›žå‚³çš„æ˜¯å¦å¤–ç”¨rembgåŽ»èƒŒéŽçš„é€æ˜ŽPNG
   ï¼ˆassets/characters/battle_æ€§åˆ¥_å…ƒç´ .pngï¼‰ï¼Œåªçµ¦æˆ°é¬¥
   å¡ç‰‡ï¼ˆ.battle-playerçš„background-imageï¼‰é€™ä¸€å€‹ç”¨é€”
   ä½¿ç”¨ã€‚è§’è‰²å‰µå»ºé è¦½ã€èƒŒåŒ…ç«‹ç¹ªé é¢çš„å¤§åœ–ä»ç„¶å‘¼å«
   getCharacterArtworkPath()ã€ç¹¼çºŒé¡¯ç¤ºåŽŸæœ¬å¸¶å ´æ™¯èƒŒæ™¯çš„
   ç‰ˆæœ¬â€”â€”é€™å…©å€‹åœ°æ–¹çš„åœ–ç‰‡æœ¬ä¾†å°±æ˜¯åŒä¸€ä»½ç´ æå…±ç”¨ï¼Œ
   ç›´æŽ¥æŠŠä¾†æºæª”æ¡ˆæ•´å€‹æ›æˆåŽ»èƒŒç‰ˆæœƒé€£å¸¶å½±éŸ¿åˆ°é‚£äº›å…¶å¯¦
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
   â˜… æŒ‰éˆ•æ³¢ç´‹æ“´æ•£æ•ˆæžœï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼‰
===================================================== */

/*
   å…¨åŸŸç›£è½æ•´å€‹æ–‡ä»¶çš„é»žæ“Š/è§¸ç¢°äº‹ä»¶ï¼Œåªè¦
   é»žåˆ°çš„ç›®æ¨™æ˜¯<button>ï¼ˆæˆ–æŒ‰éˆ•å…§éƒ¨çš„
   å­å…ƒç´ ï¼Œä¾‹å¦‚æŒ‰éˆ•è£¡çš„æ–‡å­—/åœ–ç¤ºï¼‰ï¼Œå°±åœ¨
   è§¸ç¢°åº§æ¨™çš„ä½ç½®å‹•æ…‹ç”Ÿæˆä¸€å€‹æœƒæ“´æ•£æ¶ˆå¤±çš„
   å°åœ“é»žï¼Œ0.5ç§’å¾Œè‡ªå‹•ç§»é™¤è‡ªå·±ï¼Œä¸æœƒç•™ä¸‹
   ä»»ä½•æ®˜ç•™çš„DOMåžƒåœ¾ã€‚

   ç”¨äº‹ä»¶ä»£ç†ï¼ˆç›£è½documentã€ä¸æ˜¯å€‹åˆ¥
   æŒ‰éˆ•ï¼‰çš„å¥½è™•ï¼šç¾åœ¨95å€‹æŒ‰éˆ•ã€ä»¥å¾Œä¸ç®¡
   å†æ–°å¢žå¹¾å€‹æŒ‰éˆ•ï¼Œå®Œå…¨ä¸ç”¨å¦å¤–å¯«ä¸€è¡Œ
   ç¨‹å¼ç¢¼ï¼Œå…¨éƒ¨è‡ªå‹•å¥—ç”¨åˆ°ï¼Œä¹Ÿä¸æœƒå› ç‚º
   ä¹‹å¾Œåˆå¿˜è¨˜åŠ è€Œæ¼æŽ‰ã€‚

   åŒæ™‚æ”¯æ´touchstartï¼ˆæ‰‹æ©Ÿè§¸æŽ§ï¼‰å’Œ
   mousedownï¼ˆæ»‘é¼ é»žæ“Šï¼Œæ–¹ä¾¿æ¡Œæ©Ÿç€è¦½å™¨
   æ¸¬è©¦ï¼‰ï¼Œè§¸æŽ§è£ç½®ä¸Šå…©å€‹äº‹ä»¶é€šå¸¸éƒ½æœƒ
   è§¸ç™¼ï¼Œé€™è£¡ç”¨æ——æ¨™é¿å…åŒä¸€æ¬¡é»žæ“Š
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
   â˜… è‡ªè¨‚ä¸‹æ‹‰é¸å–®ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œå–ä»£åŽŸç”Ÿ<select>ï¼‰
===================================================== */

/*
   registryï¼šè¨˜ä½æ¯ä¸€å€‹è¢«æŽ¥ç®¡çš„<select>ï¼Œ
   å°æ‡‰åˆ°å®ƒç”¢ç”Ÿå‡ºä¾†çš„é‚£çµ„å‡é¸å–®DOM
   ï¼ˆwrapper/label/listï¼‰ï¼Œ
   é—œé–‰å…¶ä»–é¸å–®ã€åŒæ­¥ç•«é¢æ™‚éƒ½è¦ç”¨åˆ°ã€‚
*/

const customDropdownRegistry={};


/*
   â˜… æ ¸å¿ƒæŠ€å·§ï¼šç”¨Object.defineProperty
   åœ¨é€™å€‹<select>ã€Œé€™ä¸€å€‹å¯¦é«”ã€ä¸Šè¦†è“‹æŽ‰
   valueé€™å€‹å±¬æ€§ï¼Œè®Šæˆæœ‰è‡ªå·±çš„get/setã€‚

   é€™æ¨£ä¸ç®¡ç¨‹å¼ç¢¼åœ¨å“ªè£¡ã€ç”¨ä»€éº¼æ–¹å¼å¯«
   select.value = "xxx"ï¼ˆç¾æœ‰å¹¾åè™•
   è®€å¯«é€™å¹¾å€‹selectçš„ç¨‹å¼ç¢¼å®Œå…¨ä¸ç”¨
   æ”¹ä¸€è¡Œï¼‰ï¼Œé€™è£¡éƒ½æ””å¾—åˆ°ï¼Œé †ä¾¿åŒæ­¥
   æ›´æ–°å‡é¸å–®çš„é¡¯ç¤ºæ–‡å­—/é¸ä¸­ç‹€æ…‹â€”â€”
   ä¸ç”¨ä¸€å€‹ä¸€å€‹åŽ»æ‰¾ç¨‹å¼ç¢¼è£¡åˆ°åº•å“ªè£¡
   å¯«äº†.value=ï¼Œé‚£æ¨£å¾ˆå®¹æ˜“æ¼æŽ‰ã€
   è€Œä¸”ä»¥å¾Œæ–°å¢žçš„ç¨‹å¼ç¢¼ä¹Ÿå¯èƒ½æ¼æŽ¥ã€‚

   çœŸæ­£çš„<option selected>ç‹€æ…‹ä¹Ÿæœƒ
   ä¸€èµ·åŒæ­¥æ›´æ–°ï¼Œä¿ç•™è·ŸåŽŸç”Ÿ<select>
   å®Œå…¨ä¸€è‡´çš„è¡Œç‚ºï¼Œåªæ˜¯å¤–è§€æ›æŽ‰ã€‚
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
   æŠŠä¸€å€‹åŽŸç”Ÿ<select>ï¼ˆselectIdï¼‰æ›æˆ
   è‡ªè¨‚å‡é¸å–®ã€‚åŽŸæœ¬çš„<select>é‚„åœ¨DOMè£¡ã€
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
       çš„èªªæ˜Žã€‚
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
   ï¼ˆä¸ç®¡æ˜¯çŽ©å®¶é»žäº†å‡é¸å–®ã€é‚„æ˜¯ç¨‹å¼ç¢¼
   ç›´æŽ¥è³¦å€¼ï¼‰éƒ½æœƒé‡æ–°å‘¼å«é€™è£¡åŒæ­¥ç•«é¢ã€‚
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
                       è·ŸåŽŸç”Ÿ<select>è¢«ä½¿ç”¨è€…
                       é¸äº†æ–°é¸é …æ™‚çš„è¡Œç‚ºä¸€è‡´ï¼Œ
                       ç¾æœ‰æŽ›åœ¨é€™å¹¾å€‹selectä¸Šçš„
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
       æ‰“é–‹çš„å‡é¸å–®é—œæŽ‰ï¼ŒåŒä¸€æ™‚é–“ç•«é¢ä¸Š
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
           overflow-y:autoï¼ˆè¦å¡žå…­åˆ—å…§å®¹ã€
           é¢æ¿é«˜åº¦æœ‰é™ï¼Œæœ¬ä¾†å°±éœ€è¦èƒ½æ²å‹•ï¼‰ï¼Œ
           é€™ä»£è¡¨å¦‚æžœæ¸…å–®ç•™åœ¨é¢æ¿è£¡é¢ç”¨
           position:absoluteå±•é–‹ï¼Œè¶…å‡ºé¢æ¿
           ç¯„åœçš„éƒ¨åˆ†æœƒç›´æŽ¥è¢«è£æŽ‰ï¼Œçœ‹èµ·ä¾†
           åƒé¸å–®ã€Œå±•ä¸é–‹ã€ã€‚

           è·Ÿä¹‹å‰æ¬å‹•æ•´å€‹è¨­å®šé¢æ¿æ˜¯åŒä¸€æ‹›ï¼š
           å±•é–‹çš„ç•¶ä¸‹ï¼ŒæŠŠæ¸…å–®æš«æ™‚æ¬åˆ°
           document.bodyï¼Œæ”¹ç”¨position:fixed
           é…åˆgetBoundingClientRect()é‡å‡º
           æŒ‰éˆ•çš„å¯¦éš›ä½ç½®ï¼Œè²¼è‘—æŒ‰éˆ•æ­£ä¸‹æ–¹
           é¡¯ç¤ºï¼Œä¸å†å—é¢æ¿çš„overflowé™åˆ¶ï¼›
           é—œé–‰æ™‚æ¬å›žåŽŸæœ¬åœ¨DOMè£¡çš„ä½ç½®ï¼Œ
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
   æŠŠæ¸…å–®å…ƒç´ å¾žåŽŸæœ¬çš„ä½ç½®ï¼ˆé¢æ¿è£¡é¢ï¼‰
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
       â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…å›žå ±ï¼Œã€Œè‡ªå‹•æˆ°é¬¥
       è¨­å®šï¼ŒæŒ‰ä¸‹åŽ»é¸å–®ç®­é ­æœ‰åæ‡‰ï¼Œä½†å°±æ˜¯
       æ²’æœ‰ä¸‹æ‹‰æ¸…å–®å¯ä»¥é¸ã€ï¼‰ï¼š
       çœŸæ­£åŽŸå› æ‰¾åˆ°äº†â€”â€”é€™å€‹æ¸…å–®è¢«æ¬åˆ°
       document.bodyä¹‹å¾Œï¼Œz-indexå¯«æ­»
       5000ï¼Œé€™åœ¨ç•¶åˆï¼ˆ.home-feature-modal
       é‚„æ˜¯3200çš„å¹´ä»£ï¼‰è¶³å¤ é«˜ã€æ²’å•é¡Œã€‚
       ä½†å¾Œä¾†å› ç‚ºå¦ä¸€å€‹bugï¼ˆè¨­å®šè¦–çª—è¢«
       creationPageçš„z-index:5000è“‹ä½ï¼‰ï¼Œ
       æŠŠ.home-feature-modalæœ¬èº«æ‹‰é«˜åˆ°
       6000ï¼Œé€™å€‹æ¸…å–®çš„5000åè€Œè®Šæˆæ¯”
       å½ˆçª—æœ¬èº«çš„æ·±è‰²é®ç½©ï¼ˆz-index:6000ï¼‰
       é‚„ä½Žâ€”â€”æ¸…å–®å…¶å¯¦æœ‰æ­£å¸¸å±•é–‹ã€ä½ç½®
       ä¹Ÿç®—å°ï¼Œåªæ˜¯æ•´å€‹è¢«å½ˆçª—è‡ªå·±çš„
       åŠé€æ˜Žé»‘è‰²èƒŒæ™¯è“‹åœ¨ä¸Šé¢ï¼Œç•«é¢ä¸Š
       å®Œå…¨çœ‹ä¸åˆ°ï¼Œè·Ÿã€Œæ²’æœ‰æ¸…å–®å¯ä»¥é¸ã€
       çš„ç—‡ç‹€ä¸€æ¨¡ä¸€æ¨£ã€‚

       é€™è£¡æ‹‰é«˜åˆ°6100ï¼Œè“‹éŽç›®å‰å½ˆçª—ç³»çµ±
       ç”¨åˆ°çš„æ‰€æœ‰z-indexï¼ˆ6000ï½ž6060ï¼‰ã€‚
       â˜… æé†’ï¼šé€™å€‹æ¸…å–®æ˜¯ç”¨JSé‡measured
       getBoundingClientRect()+position:
       fixedæ¬åˆ°bodyé¡¯ç¤ºçš„ï¼ˆè¦‹ä¸Šé¢
       moveDropdownListToBody()ï¼‰ï¼Œé€™æ•´å¥—
       æ‰‹æ³•æœ¬èº«åœ¨é€™å€‹å°ˆæ¡ˆè£¡å·²ç¶“ä¸åªä¸€æ¬¡
       æ˜¯bugçš„ä¾†æºï¼Œä¹‹å¾Œå¦‚æžœåˆè¦èª¿æ•´å½ˆçª—
       ç–Šå±¤ï¼Œè¨˜å¾—å›žä¾†æª¢æŸ¥é€™è£¡çš„z-index
       æœ‰æ²’æœ‰è·Ÿè‘—èª¿æ•´éŽã€‚
    */

    list.style.zIndex=
        "6100";


    /*
       â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…å›žå ±ï¼Œã€ŒæŒ‰ä¸‹åŽ»
       é‚„æ˜¯æ²’åæ‡‰ã€ï¼Œé€™æ¬¡çœŸçš„æŒ–åˆ°æœ€åº•å±¤
       åŽŸå› äº†ï¼‰ï¼š
       åªæ¬ä½ç½®ã€åªä¿®z-indexéƒ½é‚„ä¸å¤ â€”â€”
       æ¸…å–®åŽŸæœ¬é CSSè¦å‰‡ã€Œ.custom-dropdown.
       open .custom-dropdown-listã€æŽ§åˆ¶
       å±•é–‹æ™‚çš„max-height/opacityï¼Œé€™æ¢
       è¦å‰‡è¦æ±‚æ¸…å–®é‚„ã€Œç•™åœ¨ã€.custom-dropdown
       è£¡é¢æ‰æœƒç”Ÿæ•ˆã€‚æ¸…å–®è¢«æ¬åˆ°
       document.bodyä¹‹å¾Œï¼Œä¸å†æ˜¯
       .custom-dropdown.opençš„å­å…ƒç´ ï¼Œ
       é€™æ¢è¦å‰‡ç›´æŽ¥å¤±æ•ˆï¼Œæ¸…å–®æ‰“å›žé è¨­çš„
       max-height:0ã€opacity:0ï¼Œç­‰æ–¼
       å®Œå…¨æ”¶åˆâ€”â€”é€™æ‰æ˜¯çœŸæ­£çš„åŽŸå› ï¼Œ
       z-indexåªæ˜¯å¦ä¸€å€‹ç–ŠåŠ çš„å•é¡Œï¼Œ
       å…©å€‹ä¸€èµ·ä¿®æ‰æœƒçœŸçš„çœ‹åˆ°æ¸…å–®ã€‚

       é€™è£¡è®“æ¸…å–®è‡ªå·±èº«ä¸Šä¹Ÿå¸¶ä¸€å€‹"open"
       classï¼ˆCSSé‚£é‚Šæ–°å¢žäº†å°æ‡‰çš„
       .custom-dropdown-list.openè¦å‰‡ï¼‰ï¼Œ
       ä¸ç®¡æ¸…å–®current DOMä½ç½®åœ¨å“ªè£¡éƒ½èƒ½
       æ­£ç¢ºå±•é–‹ã€‚
    */

    list.classList.add(
        "open"
    );

}


/*
   æŠŠæ¸…å–®æ¬å›žå®ƒåŽŸæœ¬åœ¨DOMè£¡çš„ä½ç½®ï¼Œ
   æ¸…æŽ‰fixedå®šä½ç›¸é—œçš„è¡Œå…§æ¨£å¼ï¼Œ
   æ¢å¾©æˆåŽŸæœ¬é CSS classæŽ§åˆ¶çš„æ¨£å­ã€‚
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
           â˜… æ–°å¢žï¼šè·ŸmoveDropdownListToBody()
           è£¡åŠ çš„list.classList.add("open")
           å°æ‡‰ï¼Œé—œé–‰æ™‚è¦è¨˜å¾—æ‹¿æŽ‰ï¼Œä¸ç„¶æ¸…å–®
           è¢«æ¬å›žåŽŸä½ä¹‹å¾Œstillå¸¶è‘—"open"ï¼Œ
           ä¸‹æ¬¡é‚„æ²’é»žé–‹å°±å·²ç¶“æ˜¯å±•é–‹ç‹€æ…‹ï¼Œ
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
   é»žç•«é¢ä¸Šä»»ä½•å‡é¸å–®ä»¥å¤–çš„åœ°æ–¹ï¼Œ
   å…¨éƒ¨æ”¶åˆèµ·ä¾†ï¼Œè·ŸåŽŸç”Ÿ<select>é»ž
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
           åªèƒ½æ‰£æŽ‰çŽ©å®¶è‡ªå·±å‰›å‰›åˆ†é…çš„é»žã€‚
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
       é¿å…ä¸Šæ¬¡æ²’å‰µå»ºå®Œã€å–æ¶ˆæŽ‰çš„æ®˜ç•™æ•¸å€¼
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
   é—œæŽ‰modalå°±å¥½ï¼Œäººé‚„åœ¨ä¸»åŸŽï¼‰ã€‚
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
       â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œã€Œé‡Žæ€ªç•°å¸¸
       ç‹€æ…‹ç›´æŽ¥åšã€â€”â€”æ€ªç‰©çµ‚æ–¼å¯ä»¥å°çŽ©å®¶
       é™„åŠ è² é¢æ•ˆæžœäº†ï¼‰ï¼šè·Ÿæ€ªç‰©èº«ä¸Šçš„
       monster.statusEffectsæ˜¯åŒä¸€å¥—è³‡æ–™
       çµæ§‹ã€åŒä¸€å¥—å…±ç”¨å‡½å¼
       ï¼ˆapplyMonsterDebuff()/
       getMonsterDebuffValue()/
       isMonsterFrozen()/isMonsterPetrified()
       é›–ç„¶åå­—è£¡æœ‰ã€ŒMonsterã€ï¼Œä½†é€™äº›å‡½å¼
       æœ¬ä¾†å°±åªæ“ä½œå‚³é€²åŽ»çš„ç‰©ä»¶æœ¬èº«ï¼Œæ²’æœ‰
       ä»»ä½•å¯«æ­»monsterå°ˆå±¬çš„æ¬„ä½ï¼ŒçŽ©å®¶è§’è‰²
       ç‰©ä»¶ä¸€æ¨£èƒ½ç›´æŽ¥æ²¿ç”¨ï¼Œä¸ç”¨é‡å¯«ä¸€å¥—ï¼‰ã€‚
    */

    statusEffects:[],

        /*
           â˜… æ–°å¢žï¼šé˜²ç¦¦ç‹€æ…‹ï¼Œè·Ÿplayerçµæ§‹ä¸€è‡´ã€‚
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
       â˜… æŠŠç¬¬äºŒè§’è‰²æŽ›é€²æ—¢æœ‰çš„
       characters / characterEquipment /
       characterSkillLoadouts é€™ä¸‰å€‹çµæ§‹ï¼Œ
       ç”¨å›ºå®šid"player2"ç•¶key
       ï¼ˆä¸ç”¨å…ƒç´ ç•¶keyï¼Œ
       é€™æ¨£å°±ç®—å…ƒç´ è·Ÿç¬¬ä¸€åè§’è‰²é‡è¤‡ä¹Ÿä¸æœƒäº’ç›¸è¦†è“‹ï¼‰ã€‚
       é€™ä¸‰å€‹çµæ§‹åŽŸæœ¬å°±æ˜¯èƒŒåŒ…é /æŠ€èƒ½é åœ¨è®€çš„è³‡æ–™ä¾†æºï¼Œ
       æŽ›é€²åŽ»ä¹‹å¾Œé‚£å…©å€‹é é¢æ‰æŠ“å¾—åˆ°ç¬¬äºŒè§’è‰²ã€‚
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
       ç•«é¢ä¹Ÿå·²ç¶“åˆ‡æ›éŽåŽ»äº†ã€‚
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
               â˜… ç¬¬äºŒè§’è‰²å­˜æª”ï¼ˆæ–°å¢žï¼‰ã€‚
               player2åœ¨æ²’å‰µå»ºä¹‹å‰æ˜¯nullï¼Œ
               JSON.stringify(null)æ²’å•é¡Œï¼Œ
               è®€æª”æ™‚åªè¦åˆ¤æ–·é€™å€‹æ¬„ä½æ˜¯ä¸æ˜¯nullå°±å¥½ã€‚
            */

            player2:player2,
            player3:player3,

            sharedExp:sharedExp,

            /*
               â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œä¸»åŸŽ
               æ–°å¢žçš„å…­å€‹åŠŸèƒ½ï¼šå•†åº—/è§’è‰²å±•ç¤º/
               æ¯æ—¥ä»»å‹™/åœ–é‘‘/æˆå°±/å…¬å‘Šï¼‰ï¼š
               é‡‘å¹£ã€æ¯æ—¥ä»»å‹™é€²åº¦ã€åœ–é‘‘æ“Šæ®º
               ç´€éŒ„ã€æˆå°±å®Œæˆç‹€æ…‹ï¼Œéƒ½æ˜¯æ–°å¢žçš„
               æŒä¹…åŒ–è³‡æ–™ï¼Œè·Ÿè‘—å­˜æª”ä¸€èµ·å­˜ã€‚
               è§’è‰²å±•ç¤ºã€å…¬å‘Šä¸éœ€è¦å­˜æª”
               ï¼ˆè§’è‰²å±•ç¤ºç›´æŽ¥è®€player/player2
               ç¾æœ‰è³‡æ–™ï¼Œå…¬å‘Šæ˜¯ç´”éœæ…‹æ–‡å­—ï¼‰ã€‚
            */

            gold:gold,

            dailyQuestState:
                dailyQuestState,

            /*
               â˜… æ–°å¢žï¼šå§”è¨—ä»»å‹™é€²åº¦è·Ÿæ¯æ—¥ä»»å‹™
               ä¸€æ¨£è¦å­˜æª”ã€‚
            */

            commissionQuestState:
                commissionQuestState,
            bestiaryData:
                bestiaryData,

            achievementState:
                achievementState,

            /*
               â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œé›¢ç·šç¶“é©—
               ç³»çµ±ï¼‰ï¼šæ¯æ¬¡å­˜æª”éƒ½è¨˜éŒ„ã€Œé€™æ¬¡å­˜æª”
               ç•¶ä¸‹çš„æ™‚é–“ã€ï¼Œè®€æª”æ™‚æ‹¿ç¾åœ¨æ™‚é–“
               åŽ»æ¸›é€™å€‹æ™‚é–“æˆ³è¨˜ï¼Œå°±èƒ½ç®—å‡ºçŽ©å®¶
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
               çŽ©å®¶èŠ±æŠ€èƒ½é»žå­¸çš„æŠ€èƒ½ã€å‡çš„ç­‰ç´šï¼Œ
               åªè¦é‡æ–°æ•´ç†é é¢å°±æœƒå…¨éƒ¨æ¶ˆå¤±ã€‚
               ç¾åœ¨æŠŠå®ƒåŠ é€²å­˜æª”è³‡æ–™è£¡ã€‚
            */

            characterSkillLoadouts:
                characterSkillLoadouts,

            /*
               â˜… æ–°å¢žï¼šè‡ªå‹•æˆ°é¬¥è¨­å®šå­˜æª”ã€‚
               é€™å…©çµ„åŽŸæœ¬éƒ½å®Œå…¨æ²’æœ‰å­˜æª”ï¼Œ
               æ¯æ¬¡é‡æ–°æ•´ç†/é‡é–‹ï¼Œ
               çŽ©å®¶è¨­å¥½çš„è‡ªå‹•æŠ€èƒ½/HPé–€æª»/SPé–€æª»
               éƒ½æœƒè¢«é‡ç½®å›žé è¨­å€¼ï¼Œ
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
   - V152 æ›¾æŠŠèª¤åŠ å…¥çŽ©å®¶æŠ€èƒ½æ± çš„ fireBurstStrike é€€å½¹ã€‚
   - å¾Œå±¤ gameplay runtime ä»æœƒæ¸…ç†æ€ªç‰©èˆ‡åŸ·è¡ŒéšŽæ®µè³‡æ–™ï¼Œ
     ä½†å¸³è™Ÿ hydration å¿…é ˆåœ¨ç¬¬ä¸€æ¬¡æŠ€èƒ½ UI render å‰å…ˆæ¸…ç†çŽ©å®¶å­˜æª”å¼•ç”¨ã€‚
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
           å…ˆæŠŠçŽ©å®¶è³‡æ–™è¼‰å…¥ã€‚
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
           èˆŠå­˜æª”æ²’æœ‰çš„è©±å°±å¾ž0é–‹å§‹ï¼Œ
           çŽ©å®¶èº«ä¸ŠåŽŸæœ¬å¡è‘—çš„expæœƒè‡ªå‹•è½‰å…¥ç¶“é©—æ± ã€‚
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
           æ¸¬è©¦ EXP å·²æ”¹ç‚ºæ¯æŒ‰ä¸€æ¬¡ç›´æŽ¥è¿½åŠ ï¼Œä¸å†è‡ªå‹•è£œå›žã€‚ */



        /*
           â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œä¸»åŸŽ
           æ–°å¢žçš„å…­å€‹åŠŸèƒ½ï¼‰ï¼š
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
            typeof data.achievementState===
            "object"
        ){

            Object.assign(
                achievementState,
                data.achievementState
            );

        }


        /*
           â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…å›žå ±ï¼Œçµ±ä¸€æ”¹ç”¨
           å…±ç”¨å‡½å¼calculateOfflineExpSince()ï¼Œ
           è·Ÿã€Œåˆ‡å›žå‰æ™¯ã€é‚£å€‹æ™‚æ©Ÿå…±ç”¨åŒä¸€ä»½
           é‚è¼¯ï¼Œä¸è¦å„è‡ªç¶­è­·ä¸€ä»½å¹¾ä¹Žä¸€æ¨£
           çš„è¨ˆç®—ï¼‰ï¼š
           è®€æª”çš„æ™‚å€™ï¼Œæ‹¿ç¾åœ¨æ™‚é–“æ¸›æŽ‰ä¸Šæ¬¡
           å­˜æª”çš„æ™‚é–“æˆ³è¨˜ï¼Œæ›ç®—å‡ºçŽ©å®¶é›¢é–‹äº†
           å¹¾åˆ†é˜ï¼Œç®—å‡ºé€™æ¬¡ã€Œå¯ä»¥é ˜å–ã€çš„
           é›¢ç·šç¶“é©—ï¼Œå­˜é€²pendingOfflineExp
           ï¼ˆä¸æœƒè‡ªå‹•åŠ é€²ç¶“é©—æ± ï¼Œè¦çŽ©å®¶è‡ªå·±
           åŽ»ä¸»åŸŽã€Œé›¢ç·šç¶“é©—ã€é‚£è£¡æŒ‰æŒ‰éˆ•æ‰æœƒ
           çœŸçš„å…¥å¸³ï¼‰ã€‚

           OFFLINE_EXP_PER_MINUTEï¼šæ¯é›¢ç·š
           1åˆ†é˜å¯ä»¥é ˜åˆ°çš„ç¶“é©—å€¼ã€‚
           OFFLINE_EXP_MAX_MINUTESï¼šé›¢ç·šç¶“é©—
           æœ€å¤šåªç®—åˆ°é€™å€‹åˆ†é˜æ•¸ï¼ˆ480åˆ†é˜ï¼
           8å°æ™‚ï¼‰ï¼Œè¶…éŽ8å°æ™‚ä¸æœƒé ˜åˆ°æ›´å¤šï¼Œ
           é¿å…çŽ©å®¶æ”¾è‘—è§’è‰²ä¸ç®¡å¥½å¹¾å¤©ï¼Œ
           ä¸€æ¬¡å›žä¾†å°±ç›´æŽ¥æŠŠç­‰ç´šè¡åˆ°é ‚ã€‚
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
           æ–°ç³»çµ±ä¸ç›´æŽ¥ä½¿ç”¨ã€‚
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
           â˜… è‡ªå‹•æˆ°é¬¥è¨­å®šè®€æª”ï¼ˆæ–°å¢žï¼‰ã€‚
           è·Ÿplayer2ä¸€æ¨£ï¼ŒèˆŠå­˜æª”ä¸æœƒæœ‰é€™å…©å€‹æ¬„ä½ï¼Œ
           é€™ç¨®æƒ…æ³ç›´æŽ¥ç¶­æŒç¨‹å¼ç¢¼ä¸€é–‹å§‹
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
           â˜… ç¬¬äºŒè§’è‰²è®€æª”ï¼ˆæ–°å¢žï¼‰ã€‚

           èˆŠå­˜æª”ï¼ˆé€™æ¬¡æ›´æ–°ä¹‹å‰å­˜çš„ï¼‰ä¸æœƒæœ‰
           data.player2é€™å€‹æ¬„ä½ï¼Œ
           é€™æ™‚å€™data.player2æ˜¯undefinedï¼Œ
           player2ç¶­æŒnullï¼Œç­‰æ–¼ã€Œé‚„æ²’å‰µå»ºéŽã€ï¼Œ
           å®Œå…¨ç¬¦åˆé æœŸï¼Œä¸éœ€è¦ç‰¹åˆ¥æ¬è³‡æ–™ã€‚

           å¦‚æžœæœ‰å­˜éŽçš„è©±ï¼Œé™¤äº†é‚„åŽŸplayer2æœ¬èº«ï¼Œ
           é‚„è¦ç¢ºä¿characters/characterEquipment/
           characterSkillLoadoutsé€™ä¸‰å€‹çµæ§‹è£¡
           éƒ½æŽ›è‘—player2å°æ‡‰çš„è³‡æ–™ï¼Œ
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
           â˜… æŠ€èƒ½é…è£è³‡æ–™ï¼ˆæ–°å¢žï¼‰

           è¦è™•ç†å…©ç¨®èˆŠè³‡æ–™æƒ…æ³ï¼š
           1. å®Œå…¨æ²’æœ‰ characterSkillLoadouts
              ï¼ˆæœ€æ—©çš„å­˜æª”ç‰ˆæœ¬ï¼Œé‚£æ™‚å€™æ ¹æœ¬æ²’å­˜é€™å€‹ï¼‰
           2. æœ‰å­˜ï¼Œä½†æ˜¯èˆŠæ ¼å¼
              ï¼ˆlearnedSkillsæ˜¯é™£åˆ—ï¼Œä¸æ˜¯skillLevelsç‰©ä»¶ï¼‰
              â†’ é€™ç¨®æƒ…æ³ç›´æŽ¥è¦–åŒæ²’å­˜ï¼Œ
                ç”¨é è¨­å€¼ï¼ˆç«ç„°æ–¬1ç´šï¼‰é‡æ–°é–‹å§‹ï¼Œ
                æŠ€èƒ½é»žæ•¸çŽ©å®¶é‚„åœ¨ï¼Œå¯ä»¥é‡æ–°å­¸ã€‚
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
           V137ï¼šè®€æª”åŽŸæœ¬åªæ ¡æ­£ä¸»è§’HP/SPï¼Œç¬¬äºŒã€ç¬¬ä¸‰è§’è‰²è‹¥æ˜¯èˆŠå­˜æª”
           ç¼ºæ¬„ä½ã€NaNæˆ–è¶…éŽè£å‚™å¾Œçš„æ–°ä¸Šé™ï¼Œè¦ç­‰åˆ°é€²æˆ°é¬¥æ‰æœƒè¢«ä¿®æ­£ï¼Œ
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
           è®€æª”æˆåŠŸå¾Œæ˜Žç¢ºé¡¯ç¤ºéŠæˆ²ã€‚
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
           â˜… ä¿®æ­£ï¼ˆçœŸæ­£æŠ“åˆ°ã€Œé‡æ–°æ•´ç†å¾Œä¸»åŸŽ
           æ¨™é¡Œåˆ—åˆè·‘å‡ºä¾†ã€çš„åŽŸå› ï¼‰ï¼š
           homePageåœ¨HTMLè£¡æ˜¯ç›´æŽ¥å¯«æ­»
           class="page active"ï¼Œè®€æª”æˆåŠŸ
           é¡¯ç¤ºéŠæˆ²ç•«é¢çš„é€™è£¡ï¼Œå¾žä¾†æ²’æœ‰çœŸçš„
           å‘¼å«éŽshowPage("home")ï¼Œå°Žè‡´
           ã€Œä¸»åŸŽ/ç·´åŠŸå€ä¸é¡¯ç¤ºæ¨™é¡Œåˆ—ã€é€™å€‹
           æ©Ÿåˆ¶ï¼ˆé showPage()è£¡åˆ‡æ›#appçš„
           no-headeré€™å€‹classï¼‰å¾žä¾†æ²’æœ‰
           æ©ŸæœƒåŸ·è¡Œåˆ°â€”â€”åªæœ‰çŽ©å®¶ä¹‹å¾Œæ‰‹å‹•é»žäº†
           å°Žè¦½åˆ—ã€çœŸçš„è§¸ç™¼ä¸€æ¬¡showPage()ï¼Œ
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
            "ç¢ºå®šè¦åˆªé™¤è§’è‰²ä¸¦é‡æ–°å‰µå»ºå—Žï¼Ÿ",
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
   åªæ”¹é–‹å•Ÿæ–¹å¼ï¼›èƒŒåŒ…è³‡æ–™ã€è£å‚™ã€ç‰©å“è©³æƒ…ã€å‡ºå”®ç­‰ä»æ²¿ç”¨åŽŸå‡½å¼ã€‚
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

    /* è‹¥ä¸æ˜¯æ­£å¼èƒŒåŒ…é ï¼Œæ‰é—œé–‰ç¥–å±¤ pan-y æ”¾è¡Œã€‚ */
    const directInventoryActive=
        inventoryPage && inventoryPage.classList.contains("active");

    if(!directInventoryActive){
        setMapInventoryScrollGate(false);
    }
}

/* =====================================================
   é é¢
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
       â˜… ä¿®æ­£ï¼ˆçœŸçš„æŠ“åˆ°ã€Œç·´åŠŸçªç„¶ä¸é‡æ€ªã€çš„åŽŸå› ï¼‰ï¼š
       ä¹‹å‰åªæœ‰é€éŽenterZone()ï¼ˆé‡æ–°é¸æ“‡/é€²å…¥
       ç·´åŠŸå€ï¼‰æ‰æœƒé‡æ–°æ•´ç†åœ°åœ–ä¸Šæ€ªç‰©åœ–ç¤ºçš„
       é¡¯ç¤ºç‹€æ…‹ï¼Œå–®ç´”ç”¨showPage("map")åˆ‡æ›
       é é¢å®Œå…¨ä¸æœƒåšé€™ä»¶äº‹ã€‚

       å¦‚æžœæ€ªç‰©å­˜æ´»ç‹€æ…‹è·Ÿç•«é¢åœ–ç¤ºé¡¯ç¤ºç‹€æ…‹
       åœ¨æŸå€‹æ™‚åºä¸‹ä¸å°å¿ƒå…œä¸èµ·ä¾†ï¼ˆä¾‹å¦‚å‰›æ‰“å®Œ
       ä¸€å ´æˆ°é¬¥ã€å›žåˆ°åœ°åœ–çš„é‚£å€‹çž¬é–“ï¼‰ï¼Œ
       å–®ç´”åˆ‡æ›é é¢å›žåœ°åœ–æ˜¯æ²’è¾¦æ³•ä¿®æ­£çš„â€”â€”
       åªæœ‰å›žé ­é‡æ–°é€²å…¥ç·´åŠŸå€æ‰æœƒå¼·åˆ¶é‡ç½®ï¼Œ
       é€™æ­£æ˜¯ã€Œäº‚åˆ‡é¸å–®æ‰åˆæ¢å¾©æ­£å¸¸ã€èƒŒå¾Œçš„
       çœŸæ­£åŽŸå› ï¼šä¸æ˜¯åˆ‡æ›æœ¬èº«æœ‰æ•ˆï¼Œæ˜¯åˆ‡æ›çš„
       é€”ä¸­å‰›å¥½é‡æ–°é€²å…¥äº†ç·´åŠŸå€ã€è§¸ç™¼äº†å®Œæ•´é‡ç½®ã€‚

       é€™è£¡ç›´æŽ¥è®“ã€Œåˆ‡æ›åˆ°åœ°åœ–é é¢ã€é€™å€‹å‹•ä½œï¼Œ
       æ¯æ¬¡éƒ½é †ä¾¿é‡æ–°åŒæ­¥ä¸€æ¬¡æ€ªç‰©åœ–ç¤ºçš„
       é¡¯ç¤ºç‹€æ…‹ï¼Œç¢ºä¿åªè¦çœ‹å¾—åˆ°åœ°åœ–ï¼Œ
       ç•«é¢ä¸Šé¡¯ç¤ºçš„æ€ªç‰©å°±ä¸€å®šè·Ÿå¯¦éš›è³‡æ–™ä¸€è‡´ï¼Œ
       ä¸ç”¨å†ç‰¹åœ°ç¹žåŽ»é‡æ–°é€²å…¥ç·´åŠŸå€æ‰èƒ½ä¿®æ­£ã€‚
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
       çœä¸‹çš„ç©ºé–“è®“å…§å®¹å¯ä»¥å¤§ä¸€é»žã€‚
       ç”¨ #app çš„ no-header class
       çµ±ä¸€æŽ§åˆ¶ï¼Œä¹‹å¾Œå¦‚æžœé‚„æœ‰å…¶ä»–é é¢
       ä¹Ÿæƒ³æ‹¿æŽ‰é ‚éƒ¨åˆ—ï¼Œåªè¦æŠŠé ååŠ é€²
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
           â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œåœ°åœ–é é¢
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
           â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œä¸»åŸŽæ–°å¢ž
           ã€Œåˆæˆã€ã€Œç³»çµ±ã€è®Šæˆ3æŽ’å¡ç‰‡ï¼Œ
           åŽŸæœ¬ã€Œä¸èƒ½æ²å‹•ã€çš„é™åˆ¶åœ¨å…§å®¹è®Šå¤š
           ä¹‹å¾Œï¼Œé¢¨éšªæ˜¯æœƒæŠŠæ–°å¢žçš„ç¬¬3æŽ’å¡ç‰‡
           ç›´æŽ¥è£æŽ‰ã€å®Œå…¨çœ‹ä¸åˆ°â€”â€”é€™æ¯”ã€Œå¶çˆ¾
           éœ€è¦æ»‘ä¸€ä¸‹ã€åš´é‡å¾—å¤šã€‚æ”¹æˆåªæœ‰
           mapé é¢ç¶­æŒä¸èƒ½æ²å‹•ï¼ˆåœ°åœ–é é¢
           å…§å®¹é‡æ²’æœ‰è®Šã€ç¹¼çºŒé©ç”¨ï¼‰ï¼Œä¸»åŸŽ
           æ‹¿æŽ‰é€™å€‹é™åˆ¶ï¼Œæ”¹å›žå…è¨±æ²å‹•ï¼Œ
           ç¢ºä¿å…§å®¹è®Šå¤šçš„æ™‚å€™éƒ½çœ‹å¾—åˆ°ï¼Œ
           ä¸æœƒè¢«éœéœè£æŽ‰ã€‚
        */

        /*
           V89ï¼šä¸»åŸŽèˆ‡åœ°åœ–éƒ½å±¬æ–¼å›ºå®šç•«é¢ã€‚
           ä¸»åŸŽåŽŸæœ¬å› æ­·å²éœ€æ±‚è¢«æŽ’é™¤åœ¨ no-scroll-page ä¹‹å¤–ï¼Œ
           ä½†ç¾åœ¨ä¸»åŸŽå¡ç‰‡å·²èƒ½å®Œæ•´å¡žé€²å›ºå®šèˆžå°ï¼›é…åˆ #homePage
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
           â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œåœ°åœ–é é¢
           æ›æˆå°ˆå±¬çš„è§’è‰²/ä»»å‹™/è¿”å›žå°Žè¦½åˆ—ï¼‰ï¼š
        */

        appElement.classList.toggle(

            "on-map-page",

            page==="map"

        );


        /*
           â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œæ‹¿æŽ‰
           ä¸»åŸŽç«‹ç¹ªï¼‰ï¼šåŽŸæœ¬é€™è£¡æ¯æ¬¡åˆ‡åˆ°
           ä¸»åŸŽé é¢æœƒå‘¼å«showHomePortrait()
           éš¨æ©Ÿæ›ä¸€å¼µç«‹ç¹ªï¼Œåœ–ç‰‡æœ¬èº«è·Ÿç›¸é—œ
           å‡½å¼éƒ½å·²ç¶“æ•´æ®µç§»é™¤ï¼Œé€™å€‹å‘¼å«
           ä¸€ä½µæ‹¿æŽ‰ï¼Œä¸ç•™æ­»ä»£ç¢¼ã€‚
        */


        /*
           â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼‰ï¼š
           æˆ°é¬¥ä¸­æŠŠåº•éƒ¨ä¸»åŸŽ/ç·´åŠŸå€/ç‹€æ…‹/æŠ€èƒ½/èƒŒåŒ…
           é‚£æŽ’å°Žè¦½åˆ—ä¹Ÿä¸€ä½µè—èµ·ä¾†ï¼Œ
           æˆ°é¬¥æ™‚ç”¨ä¸åˆ°ï¼Œè—èµ·ä¾†å‰›å¥½å¤šå‡ºä¸€æˆªç©ºé–“ï¼Œ
           å°ã€Œä¸è¦æ²å‹•ã€é€™å€‹éœ€æ±‚ä¹Ÿæœ‰å¹«åŠ©ã€‚
           åªåœ¨battleé é¢è—ï¼Œå…¶ä»–é é¢
           ï¼ˆèƒŒåŒ…/ç‹€æ…‹/æŠ€èƒ½ï¼‰é‚„æ˜¯è¦çœ‹å¾—åˆ°å°Žè¦½åˆ—ï¼Œ
           ä¸ç„¶æ²’è¾¦æ³•åˆ‡æ›é é¢ã€‚
        */

        appElement.classList.toggle(
            "in-battle",
            page==="battle"
        );

        /*
           V78ï¼š
           åº•éƒ¨å°Žè¦½åˆ—ç›´æŽ¥é–‹å•Ÿçš„èƒŒåŒ…é ï¼Œ
           çœŸæ­£ scroll owner æ˜¯ .contentã€‚
        */
        appElement.classList.toggle(
            "on-inventory-page",
            page==="inventory"
        );

        /*
           V79 ROOT FIXï¼š
           ç›´æŽ¥ç”±åº•éƒ¨å°Žè¦½é€²èƒŒåŒ…æ™‚ï¼Œnative scroll owner æ˜¯ .contentã€‚
           åªæ”¹ .content çš„ touch-action ä¸å¤ ï¼Œå› ç‚º #game-viewport
           åœ¨ V5/V8 æž¶æ§‹ä¸­é•·æœŸä½¿ç”¨ touch-action:none éŽ–ä½æ•´å€‹éŠæˆ²ã€‚
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
       â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼‰ï¼š
       æˆ°é¬¥è³‡è¨Šï¼è‡ªå‹•æˆ°é¬¥è¦†è“‹å±¤åªåœ¨ã€Œåœ°åœ–
       ï¼ˆå·¡é‚ï¼‰é é¢ã€é¡¯ç¤ºâ€”â€”æˆ°é¬¥é é¢æœ¬èº«
       å·²ç¶“æœ‰åŽŸæœ¬é‚£ä»½ï¼Œé€™è£¡é€™ä»½åªè² è²¬
       ã€Œé›¢é–‹æˆ°é¬¥ã€å›žåˆ°åœ°åœ–ä¹‹å¾Œé‚„èƒ½ç¹¼çºŒ
       çœ‹åˆ°ä¸Šä¸€å ´æˆ°é¬¥è³‡è¨Šã€é€™ä»¶äº‹ï¼Œ
       å…¶ä»–é é¢ï¼ˆä¸»åŸŽ/ç·´åŠŸå€é¸æ“‡/ç‹€æ…‹/
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
       â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼‰ï¼š
       é é¢åˆ‡æ›çš„ç•¶ä¸‹ï¼Œç«‹åˆ»é‡æ–°åˆ¤æ–·æœ€ä¸Šé¢
       æ¨™é¡Œåˆ—è¦é¡¯ç¤ºã€Œè§’è‰²è³‡è¨Šã€é‚„æ˜¯ã€Œåœ°åœ–+
       æ€ªç‰©è³‡è¨Šã€ï¼Œä¸ç”¨ç­‰ä¸‹ä¸€æ¬¡updateUI()
       æ‰ç”Ÿæ•ˆï¼Œåˆ‡éŽåŽ»çš„çž¬é–“å°±æ˜¯å°çš„ã€‚
    */

    updateMapPageHeader();


    /*
       â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…å›žå ±ï¼ŒçœŸæ­£æŠ“åˆ°
       ã€Œæ‰“å®Œä¸€å ´æˆ°é¬¥å›žåœ°åœ–ï¼Œå·¡æ€ªå‹•ç•«å°±å£žæŽ‰ã€
       åœ–ç‰‡è®Šå¤§ã€çš„åŽŸå› ï¼‰ï¼š
       åŽŸæœ¬åªæœ‰enterZone()â†’enterMap()é‚£æ¢è·¯å¾‘
       æœƒå‘¼å«resetPatrolCharacterToIdle()ï¼Œ
       ä½†winBattle()/loseBattle()/é€ƒè„«æˆåŠŸ
       ä¹‹å¾Œï¼Œéƒ½æ˜¯ç›´æŽ¥å‘¼å«showPage("map")
       è¿”å›žåœ°åœ–ï¼Œå®Œå…¨ç¹žéŽenterMap()â€”â€”å¦‚æžœ
       æˆ°é¬¥å‰›å¥½æ˜¯åœ¨å·¡æ€ªèµ°è·¯ä¸­ã€ç”šè‡³æ˜¯æ‰“æž¶
       ç‰¹æ•ˆæ”¾å¤§åˆ°120pxçš„é‚£ä¸€åˆ»è¢«è§¸ç™¼ï¼Œå›žä¾†
       å¾Œæ²’æœ‰ä»»ä½•æ±è¥¿æŠŠè§’è‰²åœ–ç¤ºçš„å°ºå¯¸ï¼
       ä½ç½®ï¼è¨ˆæ™‚å™¨é‡ç½®ä¹¾æ·¨ï¼Œæ‰æœƒçœ‹åˆ°åœ–ç‰‡
       äº‚è·³ã€äººç‰©è®Šå¤§ã€å·¡æ€ªä¸­æ¨™ç±¤æ¶ˆå¤±ã€‚

       æ”¹æˆåœ¨showPage()é€™è£¡çµ±ä¸€è™•ç†ï¼Œ
       ä¸ç®¡æ˜¯å¾žå“ªè£¡å‘¼å«showPage("map")ï¼Œ
       åªè¦åˆ‡åˆ°åœ°åœ–é é¢ï¼Œéƒ½æœƒä¾ç…§
       autoPatrolEnabledç›®å‰çš„ç‹€æ…‹ï¼Œ
       æ±ºå®šè¦ã€Œé‡æ–°é–‹å§‹èµ°è·¯ã€ï¼ˆå·¡æ€ªé‚„é–‹è‘—ï¼‰
       é‚„æ˜¯ã€Œå›žåˆ°ç½®ä¸­éœæ­¢ã€ï¼ˆå·¡æ€ªå·²ç¶“é—œäº†ï¼‰ï¼Œ
       å…©ç¨®æƒ…æ³éƒ½æœƒå…ˆæŠŠå°ºå¯¸/ä½ç½®é‡ç½®ä¹¾æ·¨ï¼Œ
       ä¸æœƒå†æ®˜ç•™ä»»ä½•ä¸Šä¸€å ´æˆ°é¬¥å‰çš„ç‹€æ…‹ã€‚
    */

    if(page==="map"){

        if(autoPatrolEnabled){

            startPatrolCharacterWalking();


            /*
               â˜… ä¿®æ­£ï¼ˆçœŸæ­£æŠ“åˆ°ã€Œæˆ°é¬¥å®Œå‡ºä¾†
               ç›´æŽ¥æ‰“æž¶å‹•ç•«ã€æ²’5ç§’åˆé€²æˆ°é¬¥ã€
               çš„åŽŸå› ï¼‰ï¼š
               è‡ªå‹•å·¡æ€ªçš„ã€Œæ¯5ç§’æª¢æŸ¥ä¸€æ¬¡ã€è¨ˆæ™‚å™¨
               ï¼ˆautoPatrolIntervalIdï¼‰ï¼ŒåŽŸæœ¬æ˜¯
               å¾žçŽ©å®¶æœ€æ—©æŒ‰ä¸‹ã€Œè‡ªå‹•å·¡æ€ªã€é‚£ä¸€åˆ»
               é–‹å§‹ç®—çš„å›ºå®šé€±æœŸï¼Œå®Œå…¨ä¸ç®¡ä¸­é–“
               æ‰“äº†å¹¾å ´æˆ°é¬¥ã€æ¯å ´æ‰“äº†å¤šä¹…â€”â€”
               æˆ°é¬¥ä¸­é€™å€‹è¨ˆæ™‚å™¨ç…§æ¨£åœ¨èƒŒæ™¯æ¯5ç§’
               è·³ä¸€æ¬¡ï¼ˆåªæ˜¯battleActive=true
               æœƒè®“å®ƒææ—©returnï¼Œä¸æœƒçœŸçš„åšäº‹ï¼‰ã€‚

               æˆ°é¬¥çµæŸã€å›žåˆ°åœ°åœ–çš„çž¬é–“ï¼Œå¦‚æžœ
               å‰›å¥½å¡åœ¨é€™å€‹è¨ˆæ™‚å™¨ã€Œé€™æ¬¡è¦è·³å‹•ã€
               çš„æ™‚é–“é»žé™„è¿‘ï¼Œå°±æœƒå¹¾ä¹Žæ˜¯æˆ°é¬¥ä¸€
               çµæŸé¦¬ä¸Šåˆè§¸ç™¼ä¸‹ä¸€æ¬¡æª¢æŸ¥â€”â€”å¯èƒ½
               åªé–“éš”é›¶é»žå¹¾ç§’ï¼Œå®Œå…¨è·Ÿé€™å ´æˆ°é¬¥
               æ‰“äº†å¤šä¹…ç„¡é—œï¼Œé€™æ‰æ˜¯ã€Œæ²’5ç§’åˆ
               é€²æˆ°é¬¥ã€çš„çœŸæ­£åŽŸå› ï¼Œä¸æ˜¯é‡è©¦
               é‚è¼¯çš„å•é¡Œã€‚

               ä¿®æ³•ï¼šæ¯æ¬¡çœŸçš„å›žåˆ°åœ°åœ–é é¢æ™‚ï¼Œ
               æŠŠé€™å€‹è¨ˆæ™‚å™¨æ¸…æŽ‰ã€é‡æ–°å•Ÿå‹•ä¸€å€‹
               æ–°çš„ï¼Œè®“ã€Œ5ç§’ã€ä¿è­‰æ˜¯å¾žã€Œå›žåˆ°
               åœ°åœ–çš„é€™ä¸€åˆ»ã€é–‹å§‹ç®—ï¼Œä¸æœƒå†
               æ²¿ç”¨æˆ°é¬¥å‰å°±å·²ç¶“åœ¨è·‘ã€è·Ÿé€™æ¬¡
               æˆ°é¬¥çµæŸæ™‚é–“é»žå®Œå…¨ç„¡é—œçš„èˆŠæ™‚é˜ã€‚
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
       â˜… æ–°å¢žï¼šå‰¯æœ¬/BOSSé é¢ä¸€é–‹å•Ÿå°±é¡¯ç¤º
       ç¬¬ä¸€å€‹åˆ†é çš„å…§å®¹ï¼Œä¸ç”¨çŽ©å®¶è‡ªå·±
       å…ˆé»žä¸€æ¬¡åˆ†é æŒ‰éˆ•æ‰çœ‹å¾—åˆ°æ±è¥¿ã€‚
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

   ä¹‹å‰ã€Œè’æ¼ åœ°å¸¶ã€åªæ˜¯è¦æ ¼æ›¸è£¡çš„éŽ–ä½ä½”ä½å¡ï¼Œ
   å®Œå…¨æ²’æœ‰çœŸæ­£çš„åœ°åœ–è·Ÿæ€ªç‰©è³‡æ–™ã€‚
   ç¾åœ¨è£œä¸Šï¼šé”åˆ°Lv.11å°±èƒ½çœŸçš„é€²åŽ»ï¼Œ
   æ€ªç‰©æ›æˆdesertMonstersï¼ˆæ˜Žé¡¯æ¯”æ–°æ‰‹æ£®æž—ç¡¬ï¼‰ï¼Œ
   æ–¹ä¾¿æ¸¬è©¦ç‡ƒç‡’ä¹‹é¡žéœ€è¦æ€ªç‰©æ’ä¹…ä¸€é»žæ‰çœ‹å¾—å‡ºæ•ˆæžœçš„æŠ€èƒ½ã€‚
*/

/*
   â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚æ–°å¢ž5å€‹å€åŸŸå¾Œï¼Œ
   æ”¹ç”¨è³‡æ–™é©…å‹•çš„æ–¹å¼æ•´ç†ï¼Œé¿å…æ¯åŠ ä¸€å€‹
   å€åŸŸå°±è¦åœ¨å¥½å¹¾å€‹å‡½å¼è£¡å„è‡ªè¤‡è£½è²¼ä¸Š
   ä¸€æ®µå¹¾ä¹Žä¸€æ¨£çš„ifåˆ¤æ–·ï¼Œä¹‹å¾Œè¦å†åŠ 
   ç¬¬9ã€10å€ä¹Ÿåªè¦åœ¨é€™ä»½æ¸…å–®è£¡åŠ ä¸€ç­†ï¼‰ã€‚
*/

const zoneConfig = {

    forest:{
        requiredLevel:0,
        monsters:()=>forestMonsters,
        title:"æ–°æ‰‹æ£®æž—",
        desc:"Lv.1ï½ž10ï½œä¸€èˆ¬ç·´åŠŸå€æœ€å¤š6éš»æ€ªç‰©",
        levelRange:"Lv.1ï½ž10"
    },

    desert:{
        requiredLevel:11,
        monsters:()=>desertMonsters,
        title:"è’æ¼ åœ°å¸¶",
        desc:"Lv.11ï½ž20ï½œæ€ªç‰©æ˜Žé¡¯è¼ƒå¼·ï¼Œé©åˆæ¸¬è©¦æŠ€èƒ½æ•ˆæžœ",
        levelRange:"Lv.11ï½ž20"
    },

    ice:{
        requiredLevel:21,
        monsters:()=>iceMountainMonsters,
        title:"å†°éœœå±±è„ˆ",
        desc:"Lv.21ï½ž30ï½œæ€ªç‰©é–‹å§‹æœ‰å±¬æ€§ã€æœƒæ–½æ”¾æŠ€èƒ½",
        levelRange:"Lv.21ï½ž30"
    },

    zone4:{
        requiredLevel:31,
        monsters:()=>zone4Monsters,
        title:"ç†”å²©æ·±æ·µ",
        desc:"Lv.31ï½ž40ï½œæ€ªç‰©æŠ€èƒ½1å€‹ï¼Œæ–½æ”¾æ©ŸçŽ‡55%",
        levelRange:"Lv.31ï½ž40"
    },

    zone5:{
        requiredLevel:41,
        monsters:()=>zone5Monsters,
        title:"å·¨ç¸è’åŽŸ",
        desc:"Lv.41ï½ž50ï½œæ€ªç‰©æŠ€èƒ½2å€‹ï¼Œæ–½æ”¾æ©ŸçŽ‡60%",
        levelRange:"Lv.41ï½ž50"
    },

    zone6:{
        requiredLevel:51,
        monsters:()=>zone6Monsters,
        title:"ä¿®ç¾…æˆ°å ´",
        desc:"Lv.51ï½ž60ï½œæ€ªç‰©æŠ€èƒ½2å€‹ï¼Œæ–½æ”¾æ©ŸçŽ‡65%",
        levelRange:"Lv.51ï½ž60"
    },

    zone7:{
        requiredLevel:61,
        monsters:()=>zone7Monsters,
        title:"é­”å›ç¥­å£‡",
        desc:"Lv.61ï½ž70ï½œæ€ªç‰©æŠ€èƒ½3å€‹ï¼Œæ–½æ”¾æ©ŸçŽ‡65%",
        levelRange:"Lv.61ï½ž70"
    },

    zone8:{
        requiredLevel:71,
        monsters:()=>zone8Monsters,
        title:"é¾ç„æ·±æ·µ",
        desc:"Lv.71ï½ž80ï½œæ€ªç‰©æŠ€èƒ½3å€‹ï¼Œæ–½æ”¾æ©ŸçŽ‡70%",
        levelRange:"Lv.71ï½ž80"
    },

    zone9:{
        requiredLevel:81,
        monsters:()=>zone9Monsters,
        title:"è™›ç©ºç›¡é ­",
        desc:"Lv.81ï½ž90ï½œæ€ªç‰©æŠ€èƒ½3å€‹ï¼Œæ–½æ”¾æ©ŸçŽ‡70%",
        levelRange:"Lv.81ï½ž90"
    },

    zone10:{
        requiredLevel:91,
        monsters:()=>zone10Monsters,
        title:"çµ‚ç„‰ä¹‹å¢ƒ",
        desc:"Lv.91ï½ž100ï½œæ€ªç‰©æŠ€èƒ½3å€‹ï¼Œæ–½æ”¾æ©ŸçŽ‡70%",
        levelRange:"Lv.91ï½ž100"
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
       åŽŸæœ¬ç›´æŽ¥ç”¨element.textContentå¯«å…¥emojiï¼Œ
       ä½†ç¾åœ¨æ€ªç‰©å¡ç‰‡å…§éƒ¨æ”¹æˆ
       icon/name/levelä¸‰å€‹ç¨ç«‹çš„å­å…ƒç´ ï¼Œ
       è¦åˆ†åˆ¥å¯«å…¥å°æ‡‰çš„æ¬„ä½ï¼Œ
       ä¸èƒ½å†æ•´å€‹è“‹æŽ‰ï¼ˆé‚£æ¨£åç¨±è·Ÿç­‰ç´šéƒ½æœƒæ¶ˆå¤±ï¼‰ã€‚
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
               é€™è£¡åŽŸæœ¬è² è²¬ä¾å­˜æ´»ç‹€æ…‹åˆ‡æ›åœ–ç¤º
               é¡¯ç¤º/éš±è—ï¼Œä½†ç¾åœ¨æ•´å€‹.map-monster
               å·²ç¶“åœ¨CSSè£¡æ°¸ä¹…è¨­æˆdisplay:noneï¼Œ
               ä¸éœ€è¦å†ç”±JSé€™è£¡å¦å¤–æŽ§åˆ¶é¡¯ç¤ºç‹€æ…‹ï¼Œ
               ä¹Ÿä¸èƒ½å†è¨­inlineçš„displayï¼Œ
               ä¸ç„¶è¡Œå…§æ¨£å¼çš„å„ªå…ˆæ¬Šæœƒè“‹æŽ‰CSSçš„
               display:noneï¼Œè®“åœ–ç¤ºåˆè·‘å‡ºä¾†ã€‚
               é€™è£¡åªä¿ç•™ä¸Šé¢icon/name/level
               æ–‡å­—å…§å®¹çš„æ›´æ–°ï¼ˆé›–ç„¶åœ–ç¤ºä¸æœƒé¡¯ç¤ºï¼Œ
               ä½†ä¿ç•™é€™éƒ¨åˆ†é‚è¼¯ä»¥é˜²ä¹‹å¾Œåˆè¦
               é‡æ–°å•Ÿç”¨ï¼‰ï¼Œæ‹¿æŽ‰displayçš„è¨­å®šã€‚
            */

        }
    );

}


/*
   â˜… æ›´æ–°ç·´åŠŸå€åˆ—è¡¨é é¢è£¡ï¼Œè’æ¼ åœ°å¸¶é‚£å¼µå¡ç‰‡çš„
   éŽ–å®šç‹€æ…‹è·ŸæŒ‰éˆ•ã€‚
   é”åˆ°Lv.11ä¹‹å¾Œå¡ç‰‡æœƒè§£éŽ–ã€é¡¯ç¤ºã€Œé€²å…¥åœ°åœ–ã€æŒ‰éˆ•ï¼Œ
   åœ¨é€™ä¹‹å‰ä¿æŒåŽŸæœ¬éŽ–ä½çš„æ¨£å­ã€‚
*/

function updateTrainingZoneLocks(){

    /*
       â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œç·´åŠŸå€æ”¹ç‰ˆï¼Œ
       ç´”æ–‡å­—åˆ—è¡¨å–ä»£å¡ç‰‡ï¼‰ï¼š
       åŽŸæœ¬æ“ä½œçš„æ˜¯å¡ç‰‡è£¡çš„.map-descæ–‡å­—/
       æŒ‰éˆ•å€å¡Šï¼Œé€™äº›å…ƒç´ å·²ç¶“ä¸å­˜åœ¨äº†ã€‚
       æ”¹æˆå–®ç´”åˆ‡æ›.training-zone-itemçš„
       .lockedé€™å€‹classï¼ˆç´”CSSèª¿æš—ï¼Œ
       ä¸éš±è—æ–‡å­—æœ¬èº«ï¼Œé»žä¸‹åŽ»é‚„æ˜¯èƒ½çœ‹
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
   â˜… ç¬¬äºŒè§’è‰²è§£éŽ–æç¤ºã€‚
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
       â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œå·¡æ€ªé é¢
       èƒŒæ™¯ä¾åœ°å€å‹•æ…‹åˆ‡æ›ï¼‰ï¼šæ¯æ¬¡é€²å…¥
       åœ°åœ–é é¢ï¼Œå¥—ç”¨ç›®å‰é€™å€‹åœ°å€
       ï¼ˆcurrentZoneï¼‰å°æ‡‰çš„èƒŒæ™¯åœ–ã€‚
    */

    applyMapZoneBackground(
        currentZone
    );


    /*
       â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼‰ï¼š
       æ¯æ¬¡é€²å…¥åœ°åœ–é é¢ï¼Œå·¡æ€ªè§’è‰²åœ–ç¤ºå›žåˆ°
       ç½®ä¸­éœæ­¢ã€æ­£é¢åœ–çš„é è¨­ç‹€æ…‹â€”â€”ä¸ç®¡
       ä¸Šä¸€æ¬¡é›¢é–‹åœ°åœ–æ™‚èµ°åˆ°å“ªã€è‡ªå‹•å·¡æ€ª
       é–‹è‘—é‚„é—œè‘—ï¼Œé€™è£¡éƒ½é‡æ–°æ­¸é›¶ã€‚
    */

    resetPatrolCharacterToIdle();


    /*
       â˜… æ¯æ¬¡é€²åœ°åœ–ï¼ŒçŽ©å®¶æ£‹ç›¤åº§æ¨™é‡ç½®å›žä¸­å¤®ï¼Œ
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
   â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼‰ï¼š
   ã€Œè‡ªå‹•å·¡æ€ªã€è·Ÿã€Œè‡ªå‹•æˆ°é¬¥ã€æ˜¯å…©ä»¶ç¨ç«‹çš„äº‹ï¼š
   è‡ªå‹•æˆ°é¬¥æŽ§åˆ¶çš„æ˜¯ã€Œæˆ°é¬¥é–‹å§‹ä¹‹å¾Œï¼Œè§’è‰²è¦ä¸è¦
   è‡ªå‹•å‡ºæ‰‹ã€ï¼›è‡ªå‹•å·¡æ€ªæŽ§åˆ¶çš„æ˜¯ã€Œæˆ°é¬¥å¤–ï¼Œ
   è¦ä¸è¦è‡ªå‹•åŽ»æ‰¾æ€ªç‰©æ‰“ã€ã€‚å…©è€…äº’ä¸ä¾è³´ï¼Œ
   å¯ä»¥åªé–‹ä¸€å€‹ï¼Œä¹Ÿå¯ä»¥å…©å€‹éƒ½é–‹ã€‚

   å¯¦ä½œä¸Šå¾ˆå–®ç´”ï¼šæŒ‰ä¸‹åŽ»ä¹‹å¾Œï¼Œæ¯4ç§’æª¢æŸ¥ä¸€æ¬¡
   ç›®å‰åœ°åœ–ä¸Šï¼ˆmonsters[0]~monsters[MAX_
   TRAINING_MONSTERS-1]ï¼‰é‚„æœ‰æ²’æœ‰æ´»è‘—çš„æ€ªç‰©ï¼Œ
   æœ‰çš„è©±ç›´æŽ¥å‘¼å«startBattle()å°ç¬¬ä¸€éš»æ´»è‘—çš„
   æ€ªç‰©é–‹æˆ°â€”â€”ä¸ç”¨çœŸçš„æ¨¡æ“¬çŽ©å®¶åœ¨åœ°åœ–ä¸Šèµ°éŽåŽ»ï¼Œ
   å–®ç´”åªæ˜¯ã€Œå®šæœŸè‡ªå‹•è§¸ç™¼æˆ°é¬¥ã€ã€‚

   å¦‚æžœç›®å‰å·²ç¶“åœ¨æˆ°é¬¥ä¸­ï¼ˆbattleActiveï¼‰ï¼Œ
   é€™æ¬¡æª¢æŸ¥å°±è·³éŽã€ä»€éº¼éƒ½ä¸åšï¼Œç­‰ä¸‹ä¸€æ¬¡
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
   â˜… æœ€çµ‚ä¿®æ­£ï¼šè‡ªå‹•å·¡æ€ªæ”¹ç”¨ã€Œå–®æ¬¡5ç§’æŽ’ç¨‹ + è‡ªæˆ‘çºŒæŽ’ã€
   å–ä»£å–®ç´”ä¾è³´setIntervalã€‚
   é€™ä»ç„¶ç¶­æŒåŽŸæœ¬ã€Œæ¯5ç§’æª¢æŸ¥ä¸€æ¬¡ã€çš„éŠæˆ²æ©Ÿåˆ¶ï¼Œ
   ä½†æˆ°é¬¥åˆ‡é ã€æ‰‹æ©ŸèƒŒæ™¯å–šé†’ã€è¨ˆæ™‚å™¨è¢«æ¸…é™¤ç­‰æƒ…æ³ä¸‹ï¼Œ
   ä¸‹ä¸€æ¬¡æª¢æŸ¥æœƒé‡æ–°å»ºç«‹ï¼Œä¸æœƒå› è¨ˆæ™‚å™¨å¤±æ•ˆè€Œæ°¸ä¹…åœæ­¢ã€‚
*/
let autoPatrolTimeoutId=
    null;


/*
   â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œå·¡æ€ªèµ°è·¯å‹•ç•«ï¼‰ï¼š
   å››å¼µåœ–åˆ†åˆ¥æ˜¯ï¼šéœæ­¢/å¾€ä¸‹èµ°ç”¨çš„æ­£é¢åœ–ã€
   å¾€ä¸Šèµ°ç”¨çš„èƒŒé¢åœ–ã€é€²å…¥æˆ°é¬¥å‰ç‰¹æ•ˆç”¨çš„
   å…©å¼µæ‰“æž¶åœ–ï¼Œå…¨éƒ¨è½‰æˆbase64å…§åµŒï¼Œ
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
   â˜… é˜²æ­¢ã€Œæ­£åœ¨æ’­æ”¾æ‰“æž¶ç‰¹æ•ˆã€çš„ç•¶ä¸‹ï¼Œ
   å‰›å¥½è¢«å·¡æ€ªèµ°è·¯çš„è¨ˆæ™‚å™¨æ‰“æ–·ã€æŠŠç•«é¢
   æ›å›žæ­£é¢/èƒŒé¢åœ–â€”â€”è¦‹
   movePatrolCharacterRandomly()é–‹é ­
   çš„åˆ¤æ–·ã€‚
*/

let patrolInFightAnimation=
    false;

let patrolFightAnimTimeoutIds=
    [];

/*
   â˜… æ–°å¢žï¼šæ‰¾åˆ°æ€ªç‰©ã€æ­£åœ¨æ’­1ç§’é˜æ‰“æž¶ç‰¹æ•ˆã€
   ä½†çœŸæ­£çš„startBattle()é‚„æ²’è¢«å‘¼å«çš„é€™æ®µ
   ç©ºæª”ï¼Œæ“‹æŽ‰runAutoPatrolCheck()é‡è¤‡è§¸ç™¼ã€‚
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
   è®“è§’è‰²å›žåˆ°ã€Œéœæ­¢ç½®ä¸­ã€æ­£é¢åœ–ã€çš„
   é è¨­ç‹€æ…‹ï¼Œä¸ç®¡ä¹‹å‰å·¡æ€ªèµ°åˆ°å“ªè£¡åŽ»äº†ã€‚
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
           åŽŸæœ¬50%å·²ç¶“è¶…å‡ºæ–°çš„ç§»å‹•ç¯„åœï¼Œ
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
   é€éŽCSS transitionè‡ªç„¶ç§»å‹•éŽåŽ»ï¼›è·ŸèˆŠåº§æ¨™
   æ¯”è¼ƒYè»¸ï¼ˆtopï¼‰ï¼Œè®Šå°ï¼å¾€ä¸Šèµ°ï¼æ›èƒŒé¢åœ–ï¼Œ
   è®Šå¤§æˆ–ä¸è®Šï¼å¾€ä¸‹èµ°ï¼åŽŸåœ°ï¼æ›æ­£é¢åœ–ã€‚
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
       è²¼åœ¨èž¢å¹•åº•éƒ¨çš„ï¼Œè·Ÿé€™è£¡ç”¨ã€Œç›¸å°
       #mapPageé«˜åº¦çš„ç™¾åˆ†æ¯”ã€åœ¨ç§»å‹•çš„
       å·¡æ€ªè§’è‰²ï¼Œå…©è€…çš„åº§æ¨™ç³»çµ±åŽŸæœ¬æ²’æœ‰
       å°é½Šâ€”â€”åŽŸæœ¬56%çš„ç§»å‹•ç¯„åœï¼Œå¾ˆå®¹æ˜“
       ç®—åˆ°è²¼è¿‘æˆ–è“‹éŽé‚£å€‹å›ºå®šå€å¡Šçš„ä¸Šç·£ã€‚
       ç¯„åœå¾ž22%~78%æ”¶çª„æˆ22%~52%ï¼Œ
       ç¢ºä¿è§’è‰²ç§»å‹•çš„æœ€ä½Žé»žé‚„æ˜¯ç•™åœ¨
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
       â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…å›žå ±ï¼‰ï¼š
       æ¯æ¬¡çœŸæ­£é–‹å§‹èµ°è·¯ä¹‹å‰ï¼Œå…ˆæŠŠå¯èƒ½æ®˜ç•™
       çš„æ‰“æž¶ç‰¹æ•ˆç‹€æ…‹æ¸…ä¹¾æ·¨ï¼ˆå°ºå¯¸æ”¾å¤§åˆ°
       120pxã€é‚„æ²’æ’­å®Œçš„ç‰¹æ•ˆè¨ˆæ™‚å™¨ï¼‰ï¼Œ
       ä¸ç„¶å‰›å¥½åœ¨ç‰¹æ•ˆæ’­æ”¾ä¸­è¢«å«å›žé€™è£¡
       ï¼ˆä¾‹å¦‚æˆ°é¬¥å‰›çµæŸã€å›žåˆ°åœ°åœ–æ™‚ï¼‰ï¼Œ
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
   â˜… é€²å…¥æˆ°é¬¥å‰1ç§’é˜çš„æ‰“æž¶ç‰¹æ•ˆï¼šå…©å¼µåœ–
   å„é¡¯ç¤º0.5ç§’ã€éœæ­¢ä¸å‹•ï¼ˆä¸ç”¨CSSå‹•ç•«ï¼Œ
   å–®ç´”æ›åœ–ï¼‰ï¼Œæ’­å®Œå‘¼å«callback
   ï¼ˆrunAutoPatrolCheck()é‚£é‚ŠæœƒæŽ¥
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
           â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œã€Œå·¡æ€ª
           é é¢å·¦ä¸Šè§’æ–°å¢žå°æŒ‰éˆ•ï¼Œå·¡æ€ªå¿«æ·
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
               é–‹/é—œå…©å¼µ<img>æ´—æŽ‰ï¼Œæ”¹æˆåªåˆ‡æ›
               activeé€™å€‹classï¼ˆCSSæœƒè‡ªå‹•æ±ºå®š
               é¡¯ç¤ºå“ªä¸€å¼µåœ–ï¼‰ï¼Œæ–‡å­—èªªæ˜Žæ”¹æ”¾åˆ°
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
           â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼‰ï¼š
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
       â˜… æ–°å¢žï¼šè·Ÿä¸Šé¢toggleAutoPatrol()è£¡
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
       â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼‰ï¼š
       åœæ­¢å·¡æ€ªçš„åŒæ™‚ï¼Œè®“è§’è‰²åœä¸‹ä¾†ã€
       å›žåˆ°ç½®ä¸­éœæ­¢çš„æ­£é¢åœ–ç‹€æ…‹ã€‚
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
       â˜… é™¤éŒ¯ç”¨ï¼ˆä¾ç…§ä½¿ç”¨è€…å›žå ±ï¼Œè¿½è¹¤
       ã€Œæˆ°é¬¥çµæŸå›žåœ°åœ–å¾Œï¼Œè‡ªå‹•å·¡æ€ªæ²’æœ‰
       ç¹¼çºŒã€çš„åŽŸå› ï¼‰ï¼šå°å‡ºæ¯æ¬¡é€™å€‹å‡½å¼è¢«
       å‘¼å«æ™‚ï¼Œä¸‰å€‹é—œéµæ——æ¨™çš„ç•¶ä¸‹ç‹€æ…‹ã€‚
       å¦‚æžœæˆ°é¬¥çµæŸå¾Œé€™è¡Œå®Œå…¨ä¸å†å‡ºç¾ï¼Œ
       ä»£è¡¨setIntervalæœ¬èº«åœäº†ï¼›å¦‚æžœæœ‰
       å‡ºç¾ã€ä½†æŸå€‹æ——æ¨™å¡åœ¨ä¸è©²æœ‰çš„å€¼ï¼Œ
       å°±èƒ½ç›´æŽ¥çœ‹å‡ºæ˜¯å“ªå€‹æ——æ¨™çš„å•é¡Œã€‚
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
       é˜²å‘†ï¼šå¦‚æžœäººå·²ç¶“ä¸åœ¨åœ°åœ–é é¢äº†
       ï¼ˆä¾‹å¦‚æ‰‹å‹•é»žäº†é›¢é–‹åœ°åœ–ï¼Œä½†å› ç‚ºæŸç¨®
       åŽŸå› stopAutoPatrol()æ²’è¢«å‘¼å«åˆ°ï¼‰ï¼Œ
       é€™è£¡é¡å¤–æ“‹ä¸€æ¬¡ï¼Œä¸æœƒåœ¨åˆ¥çš„é é¢
       æ†‘ç©ºè§¸ç™¼æˆ°é¬¥ã€‚

       patrolBattleTransitionPendingï¼š
       å·²ç¶“æ‰¾åˆ°æ€ªç‰©ã€æ­£åœ¨æ’­1ç§’é˜æ‰“æž¶ç‰¹æ•ˆã€
       ä½†çœŸæ­£çš„startBattle()é‚„æ²’è¢«å‘¼å«çš„
       é€™æ®µç©ºæª”ï¼ŒbattleActiveé‚„æ˜¯falseï¼Œ
       å¦‚æžœä¸é¡å¤–æ“‹ä¸€æ¬¡ï¼Œå‰›å¥½ç¢°ä¸Šä¸‹ä¸€æ¬¡
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
       mapCooldown=true æ™‚ã€Œåªèƒ½è·³éŽæœ¬æ¬¡æª¢æŸ¥ã€ï¼Œ
       çµ•å°ä¸èƒ½å‘¼å« stopAutoPatrol()ã€‚

       å¦‚æžœ cooldown æ²’æœ‰ä»»ä½•è§£é™¤è¨ˆæ™‚å™¨ï¼Œä»£è¡¨
       æŸæ¢æˆ°é¬¥çµæŸè·¯å¾‘éºæ¼äº†è§£é™¤æŽ’ç¨‹ï¼›æ­¤æ™‚åœ¨
       ç¢ºèªå·²ä¸åœ¨æˆ°é¬¥ã€ä¹Ÿæ²’æœ‰é€²æˆ°é¬¥éŽæ¸¡å¾Œï¼Œ
       ç›´æŽ¥æ¸…æŽ‰é€™å€‹æ®˜ç•™æ——æ¨™ï¼Œé¿å…è‡ªå‹•å·¡æ€ªæ°¸ä¹…å¡ä½ã€‚
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
               æ‰¾åˆ°æ€ªç‰©ä¸å†ç›´æŽ¥é–‹æˆ°ï¼Œå…ˆæ’­
               1ç§’é˜çš„æ‰“æž¶ç‰¹æ•ˆå‹•ç•«ï¼ˆå…©å¼µåœ–
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
                       â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…å›žå ±ï¼Œ
                       ä¸Šä¸€ç‰ˆçš„å¿«é€Ÿé‡è©¦æ”¹éŽé ­äº†ï¼‰ï¼š
                       ä¹‹å‰åœ¨é€™è£¡åŠ äº†ã€ŒmapCooldown
                       ä¸€è§£é™¤å°±ç«‹åˆ»é‡è©¦ã€çš„é‚è¼¯ï¼Œ
                       çµæžœè®Šæˆæˆ°é¬¥çµæŸã€3ç§’ä¿è­·æœŸ
                       ä¸€éŽé¦¬ä¸Šåˆé€²ä¸‹ä¸€å ´ï¼Œå®Œå…¨æ²’æœ‰
                       ã€Œå·¡é‚èµ°5ç§’å†é‡æ•µã€çš„ç¯€å¥æ„Ÿï¼Œ
                       æ•´å€‹5ç§’é€±æœŸçš„è¨­è¨ˆç­‰æ–¼è¢«æž¶ç©ºã€‚

                       æ‹¿æŽ‰é‚£æ®µè¼ªè©¢ï¼Œæ”¹å›žå–®ç´”ï¼š
                       é€™æ¬¡å¦‚æžœè¢«mapCooldownæ“‹ä¸‹ï¼Œ
                       å°±è®“å®ƒæ“‹ä¸‹ï¼Œå®‰åˆ†ç­‰ä¸‹ä¸€æ¬¡
                       5ç§’çš„setIntervalè‡ªç„¶å†æª¢æŸ¥
                       ä¸€æ¬¡å°±å¥½ï¼Œä¸å¼·è¡Œæ’éšŠã€‚
                    */

                    startBattle(i);

                    /*
                       å¦‚æžœé€™æ¬¡é€²å…¥æˆ°é¬¥è¢«å…¶ä»–ä¿è­·æ¢ä»¶æ“‹ä¸‹ï¼Œ
                       ä¸èƒ½è®“è‡ªå‹•å·¡æ€ªå› æ­¤å¤±åŽ»ä¸‹ä¸€æ¬¡æª¢æŸ¥ã€‚
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
   çŽ©å®¶çš„åº§æ¨™ä¸å†æ˜¯ä»»æ„åƒç´ /ç™¾åˆ†æ¯”ï¼Œ
   è€Œæ˜¯ã€Œç¬¬å¹¾æ ¼ã€ç¬¬å¹¾åˆ—ã€é€™ç¨®æ£‹ç›¤åº§æ¨™ã€‚

   é»žæ“Šåœ°åœ–æ™‚ï¼Œä¸å†æ˜¯ç›´æŽ¥æŠŠçŽ©å®¶çž¬é–“è²¼åˆ°
   é»žæ“Šçš„ä½ç½®ï¼Œè€Œæ˜¯å…ˆç®—å‡ºä¸€æ¢ã€Œä¸€æ ¼ä¸€æ ¼èµ°éŽåŽ»ã€
   çš„è·¯å¾‘ï¼Œç„¶å¾Œæ­é…CSSçš„0.22ç§’transitionï¼Œ
   ä¸€æ­¥ä¸€æ­¥çœŸæ­£èµ°éŽåŽ»ï¼Œçœ‹èµ·ä¾†æ‰åƒåœ¨ç§»å‹•ï¼Œ
   ä¸æ˜¯çž¬é–“ç§»å‹•ã€‚

   ç¬¬äºŒè§’è‰²ï¼ˆå­˜åœ¨çš„è©±ï¼‰ä¸æœƒè‡ªå·±èµ°ï¼Œ
   æ˜¯è·Ÿåœ¨ç¬¬ä¸€è§’è‰²å¾Œé¢çš„ã€Œè·Ÿéš¨æ–¹å¡Šã€ï¼Œ
   è®€å–çŽ©å®¶æœ€è¿‘èµ°éŽçš„è·¯å¾‘ç´€éŒ„ï¼Œ
   æ…¢å€‹å¹¾æ­¥è·ŸéŽåŽ»ï¼Œåƒè·Ÿç­è·Ÿè‘—éšŠé•·ï¼Œ
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
   ä¸€æ­¥ä¸€æ­¥é€¼è¿‘çµ‚é»žçš„ç°¡å–®è·¯å¾‘ç”Ÿæˆ
   ï¼ˆé€™å¼µåœ°åœ–ç›®å‰æ²’æœ‰éšœç¤™ç‰©ï¼Œ
   æ‰€ä»¥ç”¨æœ€ç›´æŽ¥çš„ã€Œæ¯æ­¥åŒæ™‚ä¿®æ­£æ©«å‘/ç¸±å‘ã€
   èµ°æ³•å°±å¤ äº†ï¼Œæ–œç·šæœ€çŸ­è·¯å¾‘ï¼Œ
   ä¹‹å¾Œå¦‚æžœåœ°åœ–åŠ äº†éšœç¤™ç‰©è¦ç¹žè·¯ï¼Œ
   é€™å€‹å‡½å¼å¯ä»¥å†æ›æˆæ­£å¼çš„A*ä¹‹é¡žçš„æ¼”ç®—æ³•ï¼‰ã€‚
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
       èž¢å¹• Pointer/Touâ€‹â€‹ch åº§æ¨™å…ˆè½‰æˆ
       1080Ã—1920 è™›æ“¬éŠæˆ²åº§æ¨™ï¼Œå†åšåœ°åœ–åˆ¤å®šã€‚
       ä¸ç›´æŽ¥æŠŠ clientX/clientY ç•¶æˆéŠæˆ²åº§æ¨™ã€‚
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
   è®“çŽ©å®¶çœ‹å¾—å‡ºä¾†è§’è‰²æ˜¯çœŸçš„åœ¨ç§»å‹•ï¼Œ
   ä¸æ˜¯çž¬é–“è²¼éŽåŽ»ã€‚
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
   ä¸æ˜¯å³æ™‚è²¼åœ¨çŽ©å®¶æ—é‚Šï¼Œ
   è€Œæ˜¯è®€ã€ŒçŽ©å®¶å¹¾æ­¥ä¹‹å‰èµ°éŽçš„ä½ç½®ã€ï¼Œ
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
   â˜… æ›´æ–°åœ°åœ–ä¸ŠçŽ©å®¶å¡ç‰‡ã€è·Ÿéš¨æ–¹å¡Šçš„
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
            "çŽ©å®¶";

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
   æ‰€æœ‰æˆ°é¬¥çµæŸè·¯å¾‘éƒ½é€éŽé€™å€‹å‡½å¼è§£é™¤ï¼Œ
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
   â˜… é˜²å‘†ï¼šè‡ªå‹•å·¡æ€ªé–‹è‘—ã€å·²ç¶“å›žåˆ°åœ°åœ–ã€
   ä¹Ÿæ²’æœ‰æ­£åœ¨æˆ°é¬¥ï¼é€²æˆ°é¬¥éŽæ¸¡æ™‚ï¼Œ
   ç¢ºä¿5ç§’å·¡æ€ªè¨ˆæ™‚å™¨å­˜åœ¨ã€‚
*/
function scheduleAutoPatrolCheck(delay=5000){

    /*
       â˜… æœ€çµ‚ä¿®æ­£ï¼šè‡ªå‹•å·¡æ€ªçš„ã€ŒæŽ’ç¨‹ç”Ÿå‘½é€±æœŸã€ä¸èƒ½ä¾è³´
       battleActive çš„ç•¶ä¸‹ç‹€æ…‹ã€‚

       èˆŠç‰ˆåœ¨æˆ°é¬¥æœŸé–“æœƒåœæ­¢ï¼ä¸å»ºç«‹ä¸‹ä¸€å€‹ timeoutï¼Œ
       ç„¶å¾ŒæŠŠã€Œæˆ°é¬¥çµæŸå¾Œä¸€å®šæœƒé‡æ–°æŽ’ç¨‹ã€å¯„è¨—åœ¨å„å€‹
       çµç®—è·¯å¾‘ä¸Šï¼›åªè¦å…¶ä¸­ä»»ä½•ä¸€æ¢è·¯å¾‘æ²’æœ‰é‡æ–°æŽ’ç¨‹ï¼Œ
       è‡ªå‹•å·¡æ€ªå°±æœƒæ°¸ä¹…åœæ­¢ã€‚

       ç¾åœ¨æ”¹æˆï¼šåªè¦ autoPatrolEnabled=true ä¸”ä»åœ¨åœ°åœ–ï¼Œ
       æŽ’ç¨‹å™¨æœ¬èº«æ°¸é ç¶­æŒï¼›æˆ°é¬¥ä¸­åªæ˜¯ runAutoPatrolCheck
       æš«æ™‚ä¸é–‹æˆ°ã€‚æˆ°é¬¥çµæŸæ™‚å¦‚æžœé‡æ–°æŽ’ç¨‹ï¼Œæœƒå…ˆæ¸…æŽ‰èˆŠçš„
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
               æˆ°é¬¥ä¸­ï¼é€²æˆ°é¬¥éŽæ¸¡ä¸­åªè·³éŽé€™ä¸€æ¬¡ï¼Œ
               ä¸ä»£è¡¨åœæ­¢è‡ªå‹•å·¡æ€ªï¼›callbackæœ€å¾Œä»æœƒ
               è£œä¸Šä¸‹ä¸€å€‹5ç§’æŽ’ç¨‹ã€‚
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
   ä½†å¯¦éš›ä¸Šæ”¹ç”±æ–°çš„è‡ªæˆ‘çºŒæŽ’æ©Ÿåˆ¶è² è²¬ã€‚
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
       åªè¦æ²’æœ‰ä¸‹ä¸€æ¬¡æŽ’ç¨‹ï¼Œå°±è£œå›ž5ç§’ã€‚
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

function startBattle(triggerIndex){

    if(
        battleActive ||
        mapCooldown
    ){

        /*
           â˜… é™¤éŒ¯ç”¨ï¼ˆä¾ç…§ä½¿ç”¨è€…å›žå ±ï¼Œè¿½è¹¤
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
       çš„è§£é™¤æŽ’ç¨‹ï¼›æˆ°é¬¥æœŸé–“ç”± battleActive æŽ§åˆ¶
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
       â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…å›žå ±ï¼‰ï¼š
       é€²å…¥æˆ°é¬¥çš„ç•¶ä¸‹ï¼ŒæŠŠå·¡æ€ªèµ°è·¯çš„è¨ˆæ™‚å™¨
       æš«åœæŽ‰â€”â€”åŽŸæœ¬é€™å€‹è¨ˆæ™‚å™¨å®Œå…¨æ²’æœ‰åœ¨
       é€²å…¥æˆ°é¬¥æ™‚åœæ­¢ï¼Œåªæ˜¯å› ç‚ºæˆ°é¬¥ç•«é¢æŠŠ
       åœ°åœ–è“‹ä½æ‰ã€Œçœ‹ä¸åˆ°ã€è€Œå·²ï¼Œå¯¦éš›ä¸Šé‚„åœ¨
       èƒŒæ™¯æ¯2.2ç§’åŸ·è¡Œä¸€æ¬¡ï¼Œè®€ç§’æ²’æœ‰çœŸçš„
       åœæ­¢ã€‚æˆ°é¬¥çµæŸå›žåˆ°åœ°åœ–æ™‚ï¼ŒshowPage()
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
       â˜… æ–°æˆ°é¬¥é–‹å§‹ï¼Œæ¸…æŽ‰ä¸Šä¸€å ´çš„buffæ®˜ç•™
       ï¼ˆä¾‹å¦‚æ€’ç«ä¸æœƒå»¶çºŒåˆ°ä¸‹ä¸€å ´æˆ°é¬¥ï¼‰ï¼Œ
       é˜²ç¦¦ç‹€æ…‹ä¹Ÿä¸€ä½µé‡ç½®ï¼Œé¿å…æ®˜ç•™ã€‚
    */

    player.activeBuffs=[];

    player.statusEffects=[];

    player.isDefending=false;


    /*
       â˜… æ–°å¢žï¼šç¬¬äºŒè§’è‰²åƒæˆ°åˆå§‹åŒ–ã€‚
       å¦‚æžœçŽ©å®¶å·²ç¶“å‰µå»ºç¬¬äºŒè§’è‰²ï¼Œ
       æ¯å ´æ–°æˆ°é¬¥é–‹å§‹éƒ½æŠŠä»–çš„HP/SPè£œæ»¿ï¼Œ
       ä¸¦æ¸…æŽ‰ä¸Šä¸€å ´å¯èƒ½æ®˜ç•™çš„buffï¼Œ
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
       â˜… éš¨æ©Ÿæ±ºå®šé€™å ´æˆ°é¬¥æ²å…¥å¹¾éš»æ€ªç‰©ï¼ˆ1ï½ž3éš»ï¼‰ï¼Œ
       è§¸ç™¼çš„é‚£éš»ä¸€å®šåœ¨è£¡é¢ï¼Œ
       å…¶é¤˜å¾žã€Œå…¶ä»–é‚„æ´»è‘—çš„æ€ªç‰©ã€è£¡éš¨æ©ŸæŠ½ï¼Œ
       ä¸å¤ éš¨ä¾¿ä½ æŠ½å¤šå°‘å°±æŠ½å¤šå°‘ï¼ˆä¸æœƒç¡¬æ¹Šï¼‰ã€‚
       æ²’è¢«æŠ½åˆ°çš„æ€ªç‰©ç•™åœ¨åœ°åœ–ä¸ŠåŽŸåœ°ä¸å‹•ï¼Œä¸å—å½±éŸ¿ã€‚
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
       å¾žå†°éœœå±±è„ˆé–‹å§‹çš„æ‰€æœ‰å€åŸŸï¼Œæ€ªç‰©ä¸€æ¬¡
       å‡ºç¾çš„æ•¸é‡æ”¹æˆ3~6éš»ï¼ˆåŽŸæœ¬æ–°æ‰‹æ£®æž—ã€
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
       æ€ªç‰©å¦‚æžœåœ¨ä¸Šä¸€å ´æˆ°é¬¥ä¸­æ´»è‘—é€ƒéŽä¸€åŠ«
       ï¼ˆæ²’è¢«æ‰“æ­»ï¼‰ï¼Œèº«ä¸Šæ®˜ç•™çš„ç‡ƒç‡’/å†°å°ç‹€æ…‹
       å®Œå…¨æ²’æœ‰è¢«æ¸…æŽ‰â€”â€”respawnMonsters()
       åªæœƒæ¸…ã€Œé‡ç”Ÿçš„æ€ªç‰©ã€çš„ç‹€æ…‹ï¼Œ
       é€™éš»æ—¢æ²’æ­»ã€ä¹Ÿæ²’é‡ç”Ÿï¼Œ
       ç‹€æ…‹å°±ä¸€è·¯å¸¶åˆ°ä¸‹ä¸€å ´æˆ°é¬¥ï¼Œ
       ç•«é¢ä¸Šæœƒçœ‹åˆ°ç‰ å¹³ç™½ç„¡æ•…è£¹è‘—ä¸€å±¤
       ç‡ƒç‡’çš„æ©˜ç´…è‰²ï¼Œå…¶å¯¦æ˜¯ä¸Šä¸€å ´æˆ°é¬¥
       æ®˜ç•™çš„ç‡ƒç‡’ç‰¹æ•ˆæ²’æ¶ˆæŽ‰ã€‚
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
           â˜… æ¸…æŽ‰ä¸Šä¸€å ´æˆ°é¬¥å¯èƒ½æ®˜ç•™çš„
           ç‡ƒç‡’ä¹‹é¡žçš„ç‹€æ…‹æ•ˆæžœï¼Œ
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
   å›žåˆ
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
       â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼‰ï¼š
       æ¯å€‹å¤§å›žåˆé–‹å§‹çš„æ™‚å€™ï¼Œåœ¨æˆ°é¬¥ç´€éŒ„
       åŠ ä¸€è¡Œã€Œç¬¬Xå›žåˆï¼Œé–‹å§‹ï¼ã€ï¼Œ
       è®“çŽ©å®¶æ¸…æ¥šçœ‹åˆ°æ–°çš„ä¸€è¼ªå¾žé€™è£¡é–‹å§‹ï¼Œ
       è·Ÿä¸Šä¸€è¼ªçš„å…§å®¹æœ‰æ˜Žç¢ºåˆ†éš”ã€‚
    */

    addBattleLog(
        "ç¬¬"+
        turn+
        "å›žåˆï¼Œé–‹å§‹ï¼"
    );


    /*
       â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼‰ï¼š
       ã€Œæˆ°é¬¥è³‡è¨Šã€æ¡†ä¸Šæ–¹é‚£å€‹å›ºå®šé¡¯ç¤ºçš„
       å›žåˆæ•¸æ¨™ç±¤ï¼Œè·Ÿè‘—é€™è£¡åŒæ­¥æ›´æ–°â€”â€”
       é€™å€‹æ¨™ç±¤ä¸æ˜¯æˆ°é¬¥ç´€éŒ„è£¡æœƒè¢«æ²å‹•æ²–æŽ‰
       çš„ä¸€è¡Œå­—ï¼Œæ˜¯ç¨ç«‹çš„å°æ¨™ç±¤ï¼Œéš¨æ™‚éƒ½
       çœ‹å¾—åˆ°ç›®å‰æ˜¯ç¬¬å¹¾è¼ªï¼Œå…©å€‹åœ°æ–¹
       ï¼ˆæˆ°é¬¥é é¢/å·¡é‚é é¢ï¼‰éƒ½è¦ä¸€èµ·æ›´æ–°ã€‚
    */

    const turnIndicator=
        $("battleTurnIndicator");


    if(turnIndicator){

        turnIndicator.textContent=
            "ç¬¬"+turn+"å›žåˆ";

    }


    const mapTurnIndicator=
        $("mapBattleTurnIndicator");


    if(mapTurnIndicator){

        mapTurnIndicator.textContent=
            "ç¬¬"+turn+"å›žåˆ";

    }


    /*
       â˜… æ¯å›žåˆé–‹å§‹å…ˆè™•ç†ç‡ƒç‡’å‚·å®³è·ŸbuffæŒçºŒæ™‚é–“ï¼Œ
       é€™æ¨£æ‰æœƒæœ‰ã€Œå›žåˆåˆ¶DoTã€çš„æ„Ÿè¦ºï¼Œ
       è€Œä¸æ˜¯ç‡ƒç‡’åªå¥—ç”¨ä¸€æ¬¡å°±æ²’äº‹äº†ã€‚

       å¦‚æžœç‡ƒç‡’å‚·å®³æ­£å¥½æŠŠæœ€å¾Œä¸€éš»æ€ªæ‰“æ­»ï¼Œ
       è¦å…ˆåˆ¤æ–·æˆ°é¬¥æ˜¯å¦çµæŸï¼Œ
       çµæŸçš„è©±å°±ä¸è¦å†å¾€ä¸‹é–‹æ–°å›žåˆã€‚
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
       â˜… ä¿®æ­£ï¼ˆé‡æ–°è¨­è¨ˆå›žåˆåˆ¶ï¼‰ï¼š
       æ–°çš„ä¸€å€‹å¤§å›žåˆé–‹å§‹ï¼Œä¸æ˜¯é¦¬ä¸ŠæŽ’æ•æ·ã€
       é¦¬ä¸Šé–‹æ‰“ï¼Œè€Œæ˜¯å…ˆé€²å…¥ã€Œå®£å‘ŠéšŽæ®µã€â€”â€”
       çŽ©å®¶è§’è‰²ä¾åºé¸å¥½é€™å›žåˆè¦åšä»€éº¼
       ï¼ˆä½†ä¸æœƒé¦¬ä¸ŠåŸ·è¡Œï¼‰ï¼Œ
       å…¨éƒ¨äººéƒ½é¸å¥½ä¹‹å¾Œï¼Œ
       æ‰æœƒé€²å…¥ã€Œçµç®—éšŽæ®µã€ä¾æ•æ·é«˜ä½ŽçœŸæ­£å‡ºæ‰‹ã€‚
       é€™è£¡ä¸å†ç›´æŽ¥å‘¼å«processNextCombatant()ï¼Œ
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
   â˜… æ–°å¢žï¼šå–å¾—ç›®å‰æ´»è‘—ã€æœƒä¸Šå ´çš„éšŠä¼æˆå“¡ï¼Œ
   ä¾åºï¼ˆç¬¬ä¸€è§’è‰²ã€ç¬¬äºŒè§’è‰²ï¼‰æŽ’åˆ—ã€‚
   ç¬¬äºŒè§’è‰²ä¸å­˜åœ¨æˆ–å·²ç¶“å€’ä¸‹å°±ä¸æœƒå‡ºç¾åœ¨é€™è£¡ï¼Œ
   beginCharacterTurn()ç”¨é€™å€‹æ¸…å–®åˆ¤æ–·
   é‚„æœ‰æ²’æœ‰äººæ²’è¡Œå‹•éŽã€‚
*/

function getLivingParty(){
    return getExistingPartyIndexes().filter(index=>{
        const character=getPartyCharacterByIndex(index);
        return character && character.hp>0;
    });

}


/*
   â˜… æ–°å¢žï¼šè™•ç†ã€Œç›®å‰é€™å€‹è§’è‰²ã€çš„è¡Œå‹•éšŽæ®µã€‚
   è·ŸåŽŸæœ¬startTurn()è£¡ç›´æŽ¥å¯«æ­»æ“ä½œplayerçš„é‚è¼¯
   å¹¾ä¹Žä¸€æ¨£ï¼Œåªæ˜¯æ›æˆçœ‹
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
       è¨ˆæ™‚å™¨ä¸€æ¬¡è£œç™¼ï¼Œå°Žè‡´é€™å€‹å‡½å¼è¢«åŒä¸€å€‹
       activeBattleCharacterIndexå€¼å‘¼å«
       ç¬¬äºŒæ¬¡ã€‚

       é€™è£¡ç”¨declaredCharacterIndexesé€™å€‹Set
       æ“‹æŽ‰é‡è¤‡ï¼šå¦‚æžœç›®å‰é€™å€‹
       activeBattleCharacterIndexåœ¨é€™å€‹å¤§å›žåˆ
       è£¡å·²ç¶“çœŸæ­£å®£å‘ŠéŽä¸€æ¬¡ï¼Œä»£è¡¨é€™æ¬¡å‘¼å«æ˜¯
       è¨ˆæ™‚å™¨å»¶é²è£œç™¼çš„é‡è¤‡/éŽæœŸå‘¼å«ï¼Œç›´æŽ¥
       returnï¼Œä¸æœƒå†è®“è§’è‰²ç´¢å¼•è¢«å¤šæŽ¨é€²ã€
       ä¸æœƒè®“autoAction()/player2AutoAction()
       è¢«é‡è¤‡å‘¼å«ï¼Œä¹Ÿå°±ä¸æœƒå†ç™¼ç”Ÿã€Œå…¶ä¸­ä¸€å€‹
       è§’è‰²çš„å®£å‘Šè¢«è·³éŽã€çš„æƒ…æ³ã€‚
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
            "å·²ç¶“å®£å‘ŠéŽï¼‰ï¼Œå·²æ“‹ä¸‹ã€‚"
        );

        return;

    }


    /*
       â˜… ä¿®æ­£ï¼ˆé‡æ–°è¨­è¨ˆå›žåˆåˆ¶ï¼‰ï¼š
       é€™å€‹å‡½å¼ç¾åœ¨æ˜¯ã€Œå®£å‘ŠéšŽæ®µã€çš„è¿´åœˆæœ¬é«”ï¼Œ
       æ¯æ¬¡è¢«å‘¼å«éƒ½ä»£è¡¨ã€Œè¼ªåˆ°ä¸‹ä¸€å€‹è§’è‰²å®£å‘Šã€ã€‚
       å¦‚æžœæ´»è‘—çš„è§’è‰²éƒ½å®£å‘Šå®Œäº†ï¼Œ
       å°±ä¸å†ç­‰æ–°çš„è¼¸å…¥ï¼Œç›´æŽ¥é€²å…¥çµç®—éšŽæ®µã€‚
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
       çš„ä»»ä½•æ™‚é–“é»žï¼Œè¶Šæ—©æ¨™è¨˜è¶Šèƒ½æ“‹ä½
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
       æŠŠä»–ä¸Šä¸€æ¬¡è¨­çš„é˜²ç¦¦ç‹€æ…‹æ¸…æŽ‰â€”â€”
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
       ä¹‹å‰ä¸ç®¡æ˜¯æ‰‹å‹•é‚„æ˜¯å…¨è‡ªå‹•ï¼Œå®£å‘ŠéšŽæ®µ
       éƒ½æœƒå…ˆé¡¯ç¤ºã€Œè¼ªåˆ°èª°ã€çš„é»ƒè‰²é–ƒçˆå¤–æ¡†ï¼Œ
       è€Œä¸”è‡ªå‹•åˆ¤æ–·é‚„è¦ç­‰1000msæ‰æœƒçœŸæ­£å‡ºæ‰‹ï¼Œ
       ç­‰æ–¼å…¨è‡ªå‹•æ¨¡å¼ä¸‹ï¼Œæ¯å€‹è§’è‰²å‡ºæ‰‹å‰
       éƒ½è¦å…ˆé–ƒä¸€ä¸‹ã€ç­‰ä¸€ä¸‹ï¼Œçœ‹èµ·ä¾†åƒæ˜¯
       ã€Œé‚„è¦æŽ’éšŠç­‰ã€ï¼Œä¸å¤ ä¿è½ã€‚

       æ”¹æˆï¼šåªæœ‰çœŸæ­£éœ€è¦çŽ©å®¶è‡ªå·±é¸æ“‡çš„æ™‚å€™
       ï¼ˆé€™å€‹è§’è‰²ä¸æ˜¯è‡ªå‹•ï¼‰ï¼Œæ‰é¡¯ç¤ºé–ƒçˆå¤–æ¡†ï¼Œ
       æé†’çŽ©å®¶è©²åšé¸æ“‡äº†ï¼›å¦‚æžœæ˜¯è‡ªå‹•è§’è‰²ï¼Œ
       ä¸éœ€è¦é€™å€‹æé†’ï¼ˆåæ­£ä¹Ÿä¸ç”¨çŽ©å®¶åšä»»ä½•äº‹ï¼‰ï¼Œ
       ç›´æŽ¥è·³éŽé–ƒçˆã€‚
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
       â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œé‚è¼¯åéŽä¾†ï¼‰ï¼š
       å®£å‘ŠéšŽæ®µï¼ˆç­‰çŽ©å®¶é¸æ“‡è¦åšä»€éº¼ï¼‰
       ä¸æ‡‰è©²æ”¾å¤§æˆ°é¬¥ç´€éŒ„ï¼Œç¶­æŒå°å°ä¸€å¡Šå°±å¥½ï¼Œ
       æ”¾å¤§äº¤çµ¦çµç®—éšŽæ®µè² è²¬
       ï¼ˆstartResolutionPhase()é‚£é‚Šè™•ç†ï¼‰ï¼Œ
       é€™è£¡æŠŠåŽŸæœ¬ã€Œè¼ªåˆ°æ‰‹å‹•è§’è‰²å°±æ”¾å¤§ã€çš„é‚è¼¯æ‹¿æŽ‰ã€‚
    */


    if(autoOn){

        const scheduledAutoCharacterIndex=activeBattleCharacterIndex;

        /*
           â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼ŒåŠ å¿«ç¯€å¥ï¼‰ï¼š
           åŽŸæœ¬1000msæ‰æœƒçœŸæ­£å‡ºæ‰‹ï¼Œé€™æ˜¯å°ˆé–€
           ç•™çµ¦ã€ŒçŽ©å®¶è‡ªå·±é¸ã€ç”¨çš„æ€è€ƒæ™‚é–“ï¼Œ
           å…¨è‡ªå‹•è§’è‰²ä¸éœ€è¦é€™å€‹ç­‰å¾…ï¼Œ
           èª¿å¿«åˆ°150msï¼ˆä¿ç•™æ¥µçŸ­çš„å»¶é²åªæ˜¯
           é¿å…çž¬é–“è§¸ç™¼é€ æˆçš„æ½›åœ¨æ™‚åºå•é¡Œï¼Œ
           ä¸æ˜¯åˆ»æ„ç•™çµ¦çŽ©å®¶çœ‹çš„ç­‰å¾…æ™‚é–“ï¼‰ã€‚
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
               â˜… æ–°å¢žï¼ˆé˜²è­·ç¶²ï¼Œè™•ç†ã€Œæ‰“äº†å¹¾è¼ª
               è‡ªå‹•æˆ°é¬¥çªç„¶å®Œå…¨å¡ä½ä¸å‹•ã€
               ä½†æ€ªç‰©é‚„æ˜¯æŒçºŒå‡ºæ‰‹ã€çš„å•é¡Œï¼‰ï¼š

               ç›®å‰æ‰¾ä¸åˆ°è®“è‡ªå‹•åˆ¤æ–·å¡ä½çš„
               ç¢ºåˆ‡è§¸ç™¼æ¢ä»¶ï¼Œä½†ç”¨try-catchåŒ…ä½
               é€™è£¡è‡³å°‘èƒ½ç¢ºä¿ï¼šè¬ä¸€è‡ªå‹•åˆ¤æ–·å…§éƒ¨
               çœŸçš„å› ç‚ºæŸç¨®ç‰¹æ®Šè³‡æ–™ç‹€æ…‹æ‹‹å‡ºä¾‹å¤–ï¼Œ
               ä¸æœƒæ•´å€‹å®‰éœå¡æ­»ã€ä»€éº¼éƒ½ä¸æœƒç™¼ç”Ÿâ€”â€”
               æœƒæŠŠéŒ¯èª¤å…§å®¹å°åœ¨æˆ°é¬¥ç´€éŒ„è£¡è®“ä½ çœ‹åˆ°
               ï¼ˆä¹‹å¾Œå›žå ±çµ¦æˆ‘ï¼‰ï¼Œä¸¦ä¸”å¼·åˆ¶å‘¼å«
               finishPlayerAction()è®“æˆ°é¬¥
               ç¹¼çºŒå¾€ä¸‹èµ°ï¼Œä¸æœƒå¡åœ¨åŽŸåœ°ã€‚
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
                    "ï¼‰ï¼Œå·²å¼·åˆ¶ç•¥éŽé€™å›žåˆã€‚"
                );

                finishPlayerAction();

            }

        },150);

    }

}


/*
   â˜… æ–°å¢žï¼šåˆ‡æ›è§’è‰²æ™‚ï¼Œ
   åœ¨ç•«é¢ä¸Šé«˜äº®ã€Œç›®å‰æ­£åœ¨è¡Œå‹•ã€çš„é‚£å¼µå¡ï¼Œ
   è®“çŽ©å®¶æ¸…æ¥šçŸ¥é“ç¾åœ¨æ˜¯èª°çš„å›žåˆã€‚
*/

/*
   â˜… æ–°å¢žï¼šå¡«å…¥å¸¸é§æŠ€èƒ½å¿«æ·åˆ—çš„4å€‹æ ¼å­ï¼Œ
   å…§å®¹æ˜¯ã€Œç›®å‰è¼ªåˆ°èª°è¡Œå‹•ã€é‚£å€‹è§’è‰²è£å‚™çš„æŠ€èƒ½ï¼Œ
   è·ŸèˆŠç‰ˆopenSkillMenu()å½ˆçª—çš„åˆ¤æ–·é‚è¼¯ä¸€è‡´
   ï¼ˆSPå¤ ä¸å¤ ã€ç­‰ç´šé è¦½ï¼‰ï¼Œåªæ˜¯æ”¹æˆå¸¸é§é¡¯ç¤ºï¼Œ
   ä¸ç”¨å¦å¤–é»žã€ŒæŠ€èƒ½ã€æŒ‰éˆ•æ‰çœ‹å¾—åˆ°ã€‚
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
        ".sq-name",".sq-cost",".v135-sq-scope",".sq-description"
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
            '<span class="v135-sq-scope"></span>'+
            '<span class="sq-description"></span>';
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
    const descriptionNode=button.querySelector(".sq-description");

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
        if(descriptionNode){ descriptionNode.textContent=""; }
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
    if(descriptionNode){
        const explanation=formalSpec&&typeof formalSpec.effectText==="function"
            ?formalSpec.effectText(skill,Math.max(1,skillLevel||1))
            :String(skill.description||"");
        if(descriptionNode.textContent!==explanation){ descriptionNode.textContent=explanation; }
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
       å¦‚æžœç›®å‰æ˜¯ç©ºçš„ï¼ˆä¾‹å¦‚é‚„æ²’è¼ªåˆ°çŽ©å®¶ã€
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
   æ²»ç™‚è¡“ï¼å¾©æ´»è¡“ï¼éš±èº«è¡“ï¼è¬è±¡åœŸç›¾ï¼çµç•Œä½¿ç”¨ç¾æœ‰çŽ©å®¶å¡ç‰‡é¸äººï¼Œ
   ä¸å†å¯«æ­»åªå°è§’è‰²ä¸€è™Ÿè‡ªå·±ç”Ÿæ•ˆã€‚å…¨é«”æŠ€èƒ½ä»ç›´æŽ¥å®£å‘Šï¼Œä¸å¤šä¸€æ­¥é¸æ“‡ã€‚
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


/* V99 â€” åœ¨å·²é¸æŠ€èƒ½ã€ç­‰å¾…é»žæ€ªç‰©ç›®æ¨™çš„éšŽæ®µå…è¨±ã€Œè¿”å›žã€ã€‚
   åªå–æ¶ˆå°šæœªé€é€² queuedPlayerActions çš„æš«å­˜å®£å‘Šï¼Œä¸æŽ¨é€²å›žåˆã€
   ä¸é‡è¨­è¨ˆæ™‚å™¨ï¼Œä¹Ÿä¸æ‰£ SPï¼›è‹¥å‰›æ‰èª¤é¸çš„æ˜¯æŠ€èƒ½ï¼Œå°±ç›´æŽ¥å›žåˆ°
   åŒä¸€è§’è‰²çš„æŠ€èƒ½é¸æ“‡æ¡†ï¼Œæ™®é€šæ”»æ“Šå‰‡å›žåˆ°äº”é¡†æˆ°é¬¥æŒ‡ä»¤ã€‚ */
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
       åŽŸæœ¬é€™è£¡æœƒæ‰¾å·¦å´ç›´æ›¸çš„activeTurnLabel
       çª„æ¢ï¼ŒæŠŠç›®å‰è¼ªåˆ°èª°çš„åå­—å¯«é€²åŽ»ã€‚
       é€™å€‹å…ƒç´ å·²ç¶“æ‹¿æŽ‰ï¼ˆæ”¹æˆã€ŒæŠ€èƒ½ã€æŒ‰éˆ•ï¼‰ï¼Œ
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
       â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼‰ï¼š
       æ¯è®€ç§’ä¸€æ¬¡ï¼Œæ•¸å­—å°±çªç„¶æ”¾å¤§å†çž¬é–“ç¸®å°ï¼Œ
       è£½é€ ã€Œè·³å‹•ã€çš„æ„Ÿè¦ºï¼Œè®“å€’æ•¸è¨ˆæ™‚
       æ›´é¡¯çœ¼ã€æ›´å®¹æ˜“æ³¨æ„åˆ°æ™‚é–“åœ¨æµé€ã€‚
       ç”¨ç§»é™¤å†å¼·åˆ¶è§¸ç™¼reflowå†åŠ å›žclassçš„
       æ–¹å¼ï¼Œç¢ºä¿é€£çºŒå…©æ¬¡éƒ½æ˜¯åŒä¸€å€‹æ•¸å­—
       ï¼ˆä¾‹å¦‚éƒ½è·³éŽ5ç§’çš„é–€æª»ï¼‰æ™‚ï¼Œ
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
        "â° æ™‚é–“åˆ°ï¼Œæœ¬å›žåˆæ²’æœ‰è¡Œå‹•ã€‚"
    );


    actionReady=false;

    pendingAction=null;


    /*
       â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œå¾¹åº•æª¢æŸ¥å¾Œ
       æŠ“åˆ°çš„å¦ä¸€å€‹æ½›åœ¨é¢¨éšªï¼‰ï¼š
       é€™è£¡åŽŸæœ¬è‡ªå·±åˆé‡å¯«äº†ä¸€æ¬¡ã€Œå®£å‘Šé€¾æ™‚
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
       è·ŸfinishPlayerAction()åŒæ™‚æ¶è‘—æŽ¨é€²ï¼Œ
       å°±æœƒè£½é€ å‡ºç´¢å¼•è¢«æŽ¨é€²å…©æ¬¡ã€
       æŸå€‹è§’è‰²æˆ–æ€ªç‰©çš„è¡Œå‹•è¢«è·³éŽçš„é‚£é¡žå•é¡Œ
       â€”â€”é€™æ­£æ˜¯é€™å¹¾è¼ªä¸€ç›´åœ¨æŠ“çš„bugåž‹æ…‹ã€‚

       æ”¹æˆç›´æŽ¥å‘¼å«finishPlayerAction()ï¼Œ
       è®“ã€Œæ€Žéº¼æŽ¨é€²åˆ°ä¸‹ä¸€ä½ã€æ°¸é åªæœ‰
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
       åŽŸæœ¬é€™è£¡æ°¸é æª¢æŸ¥player.spã€
       æ°¸é å‡è¨­æ“ä½œçš„æ˜¯ç¬¬ä¸€è§’è‰²ã€‚
       ç¾åœ¨æ”¹æˆå…ˆçœ‹
       activeBattleCharacterIndexæ˜¯èª°çš„å›žåˆï¼Œ
       ç”¨å°æ‡‰è§’è‰²çš„æŠ€èƒ½é»ž/SP/è‡ªå‹•ç‹€æ…‹ä¾†åˆ¤æ–·ã€‚
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
           â˜… ä¿®æ­£ï¼ˆé‡è¦ï¼Œä¾ç…§ä½¿ç”¨è€…æ˜Žç¢ºæŒ‡æ­£ï¼‰ï¼š
           å¢žç›Š/æ²»ç™‚/å¾©æ´»é€™é¡žæŠ€èƒ½ä¹‹å‰æ˜¯ã€Œé¸äº†å°±ç«‹åˆ»ç”Ÿæ•ˆã€ï¼Œ
           å®Œå…¨ç¹žéŽå®£å‘Š/çµç®—æ©Ÿåˆ¶ã€‚

           ä½†çŽ©å®¶æ˜Žç¢ºæŒ‡å‡ºï¼šå›žåˆåˆ¶çš„æ ¸å¿ƒç²¾ç¥žæ˜¯
           ã€Œæ‰€æœ‰è¡Œå‹•éƒ½è¦ç…§æ•æ·é †åºçµç®—ã€ï¼Œ
           æ²»ç™‚/å¢žç›Šä¹Ÿä¸ä¾‹å¤–â€”â€”æ•æ·å¤ªä½Žçš„è©±ï¼Œ
           æƒ³å¹«éšŠå‹è£œè¡€ï¼Œå¯èƒ½é‚„æ²’è¼ªåˆ°ä½ ï¼Œ
           éšŠå‹å·²ç¶“è¢«æ‰“æ­»äº†ï¼Œé€™æ‰æ˜¯æ•æ·é€™å€‹æ•¸å€¼
           è©²æœ‰çš„é‡è¦æ€§ï¼Œä¸èƒ½è®“æ²»ç™‚/å¢žç›Šè®Šæˆ
           ã€Œç„¡è¦–é †åºã€é»žäº†å°±ç”Ÿæ•ˆã€çš„ç‰¹ä¾‹ã€‚

           æ”¹æˆè·Ÿå‚·å®³æŠ€èƒ½ä¸€æ¨£ï¼Œå…ˆã€Œå®£å‘Šã€å­˜èµ·ä¾†ï¼Œ
           ç­‰çµç®—éšŽæ®µç…§æ•æ·é †åºæ‰çœŸæ­£ç”Ÿæ•ˆã€‚
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

            /* å–®é«”æˆ‘æ–¹æŠ€èƒ½å…ˆé¸è§’è‰²ï¼›å…¨é«”æŠ€èƒ½ç¶­æŒç›´æŽ¥å®£å‘Šã€‚ */
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
       åŽŸæœ¬åªæª¢æŸ¥å…¨åŸŸçš„autoBattleï¼Œ
       ç¾åœ¨è¦çœ‹ç›®å‰è¼ªåˆ°èª°çš„å›žåˆï¼Œ
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
           â˜… ä¿®æ­£ï¼ˆé‡æ–°è¨­è¨ˆå›žåˆåˆ¶ï¼‰ï¼š
           é»žé¸ç›®æ¨™ä¹‹å¾Œï¼Œä¸å†é¦¬ä¸ŠåŸ·è¡Œæ”»æ“Šï¼Œ
           è€Œæ˜¯å…ˆæŠŠã€Œé€™å€‹è§’è‰²æ±ºå®šè¦åšçš„äº‹ã€
           å­˜é€²queuedPlayerActionsï¼Œ
           ç­‰æ‰€æœ‰æ´»è‘—çš„è§’è‰²éƒ½é¸å¥½äº†ï¼Œ
           æ‰æœƒåœ¨çµç®—éšŽæ®µä¾æ•æ·é †åºçœŸæ­£å‡ºæ‰‹ã€‚
        */

        queuedPlayerActions[
            activeBattleCharacterIndex
        ]={

            action:action,

            target:index

        };


        /*
           â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼‰ï¼š
           ä¸éœ€è¦åœ¨å®£å‘ŠéšŽæ®µå°±å…ˆå°ä¸€è¡Œ
           ã€Œå·²é¸æ“‡XXï¼Œç›®æ¨™ï¼šYYã€æµªè²»ç•«é¢ç©ºé–“ã€
           æµªè²»æ™‚é–“è®“çŽ©å®¶ç­‰ï¼Œç›´æŽ¥é€²çµç®—éšŽæ®µï¼Œ
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
       åŽŸæœ¬é€™è£¡æ°¸é æ“ä½œç¬¬ä¸€è§’è‰²ã€‚
       ç¾åœ¨å…ˆåˆ¤æ–·ç›®å‰æ˜¯ä¸æ˜¯ç¬¬äºŒè§’è‰²çš„å›žåˆï¼Œ
       æ˜¯çš„è©±èµ°player2å°ˆå±¬çš„æ–½æ”¾å‡½å¼
       ï¼ˆcastPlayer2Skill/player2NormalAttackï¼‰ï¼Œ
       ä¸¦ä¸”è¦è‡ªå·±å‘¼å«finishPlayerAction()
       å¾€ä¸‹æŽ¨é€²åˆ°ä¸‹ä¸€ä½è§’è‰²/æ€ªç‰©å›žåˆ
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
       å› ç‚ºprepareAction()å·²ç¶“æŠŠå®ƒå€‘æ””æˆªæŽ‰äº†ï¼Œ
       é€™è£¡å¤šæŽ’é™¤ä¸€æ¬¡ç´”ç²¹æ˜¯é˜²å‘†ï¼Œ
       é¿å…è¬ä¸€æœ‰æŠ€èƒ½ç¹žéŽprepareAction()
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
   V173.38ï¼šçŽ©å®¶ã€æ€ªç‰©ã€æ™®é€šæ”»æ“Šèˆ‡æŠ€èƒ½å…±ç”¨å”¯ä¸€æ­£å¼å‚·å®³ ownerã€‚
   é †åºï¼šç­‰ç´šã€å…ƒç´ ã€é˜²ç¦¦ã€æ™®é€šå¢žå‚·åŠ ç®—æ¡¶ã€çˆ†æ“Šã€æ•µæ–¹å£“åŠ›ã€
   æŠ€èƒ½å‚·å®³é ç®—ã€95%ï½ž105% æµ®å‹•ã€‚
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

   æœ€çµ‚å‘½ä¸­çŽ‡ =
   95 + å‘½ä¸­Ã—0.15 + æœ€çµ‚å‘½ä¸­åŠ æˆ
   - ç›®æ¨™æœ€çµ‚é–ƒèº² - æœ€çµ‚å‘½ä¸­ä¸‹é™ã€‚

   æ‰€æœ‰ç™¾åˆ†æ¯”æ•ˆæžœçš†æ˜¯ã€Œæœ€çµ‚ç™¾åˆ†é»žã€åŠ æ¸›ï¼Œä¸å†å…ˆå°é ‚å‘½ä¸­å¾Œ
   ä¹˜ä¸Š (1 - é–ƒèº²çŽ‡)ã€‚æœ€å¾Œçµ±ä¸€é™åˆ¶åœ¨ 70%ï½ž99%ã€‚
   æ™®é€šæ€ªç‰©æœªæ˜Žç¢ºæŒ‡å®š evasion æ™‚ï¼Œä½¿ç”¨ min(10%, ç­‰ç´šÃ—0.1%)ã€‚
===================================================== */

const HIT_CHANCE_BASE = 95;
const HIT_CHANCE_ACCURACY_COEFFICIENT = 0.15;
const HIT_CHANCE_MIN_PERCENT = 70;
const HIT_CHANCE_MAX_PERCENT = 99;


/*
   â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œæ€ªç‰©å…­åœç³»çµ±
   å®Œæˆå¾Œï¼Œé€™ä¸‰å€‹å‡½å¼æ”¹æˆç›´æŽ¥è®€æ€ªç‰©èº«ä¸Š
   çœŸæ­£ç®—å¥½çš„æ•¸å€¼ï¼Œä¸å†ç”¨ç­‰ç´šæ¦‚ç•¥æ›ç®—ï¼‰ï¼š
   makeZoneMonster()å·²ç¶“æŠŠevasion/accuracy/
   resistance/agilityé€™äº›æœ€çµ‚æ•¸å€¼ç®—å¥½å­˜åœ¨
   æ€ªç‰©ç‰©ä»¶ä¸Šäº†ï¼ˆè·ŸçŽ©å®¶getBaseStats()åŒä¸€å¥—
   å…¬å¼ï¼šé è¨­é–ƒé¿=min(30%,ç­‰ç´šÃ—0.3%)ã€å‘½ä¸­=ç²¾ç¥žÃ—2ã€ä¸€èˆ¬ç•°å¸¸æŠ—æ€§=ç²¾ç¥žÃ—0.05ã€
   è¡Œå‹•é †åºç”¨çš„é€Ÿåº¦=æ•æ·åŽŸå§‹é»žæ•¸ï¼‰ï¼Œ
   é€™è£¡ç›´æŽ¥è®€å‡ºä¾†ï¼Œä¸ç”¨å†å¦å¤–ç®—ä¸€æ¬¡ã€‚

   ä¿ç•™monster.xxx===undefinedæ™‚çš„èˆŠå…¬å¼
   ç•¶ä½œé˜²å‘†å‚™æ´ï¼Œç†è«–ä¸Šä¸æœƒç”¨åˆ°ï¼ˆç¾åœ¨
   makeZoneMonster()ä¸€å®šæœƒçµ¦é€™äº›æ¬„ä½ï¼‰ï¼Œ
   ç´”ç²¹é¿å…è¬ä¸€æœ‰æ¼ç¶²çš„æ€ªç‰©è³‡æ–™æ ¼å¼æ²’å°é½Š
   è€Œæ•´å€‹å£žæŽ‰ã€‚
*/

/*
   â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼ŒæŽ¥ä¸Šé¢¨ç³»/åœŸç³»
   æŠ€èƒ½çš„æ¸›ç›Šæ•ˆæžœï¼‰ï¼š
   æ•æ·èˆ‡å‘½ä¸­å±¬æ€§å±¤åªè™•ç† agilityDown èˆ‡
   statDown ç­‰çœŸæ­£æœƒä¿®æ”¹èƒ½åŠ›å€¼çš„æ¸›ç›Šã€‚
   stunï¼ˆæšˆçœ©ï¼‰ä¸å†ä¿®æ”¹å‘½ä¸­å±¬æ€§æœ¬èº«ï¼›å®ƒæœƒåœ¨
   rollHitChance() çš„æœ€å¾Œä¸€æ­¥ï¼Œç›´æŽ¥é™ä½Žæœ€çµ‚å‘½ä¸­çŽ‡ï¼Œ
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
   çŒ›æ“Šçš„æšˆçœ©æ•ˆæžœç®—æ³•ï¼‰ï¼š
   åŽŸæœ¬stuné€™å€‹æ¸›ç›Šæ˜¯åœ¨é€™è£¡ï¼ˆå‘½ä¸­å€¼æœ¬èº«ï¼‰
   æ‰“æŠ˜æ‰£ï¼Œå†è®“æ‰“å®ŒæŠ˜çš„å‘½ä¸­å€¼åŽ»è·‘æ­£å¸¸çš„
   å‘½ä¸­å…¬å¼ï¼Œç­‰æ–¼æ˜¯ã€Œé–“æŽ¥ã€å½±éŸ¿æœ€çµ‚æ©ŸçŽ‡ï¼Œ
   ä½¿ç”¨è€…æœ€æ–°çµ¦çš„æ•¸å€¼æ˜¯ã€Œé™ä½Žæ©ŸçŽ‡ç”±æŠ€èƒ½
   ç­‰ç´šä½Žè‡³é«˜ç‚º-15%/-20%/-25%/-30%/-35%ã€ï¼Œè®€èµ·ä¾†æ˜¯
   ç›´æŽ¥å¾žæœ€çµ‚å‘½ä¸­æ©ŸçŽ‡æ‰£æŽ‰é€™å€‹%æ•¸ï¼Œä¸æ˜¯
   åœ¨å‘½ä¸­å€¼é€™å±¤æ‰“æŠ˜â€”â€”å…©ç¨®ç®—æ³•ç®—å‡ºä¾†çš„
   æœ€çµ‚å‘½ä¸­çŽ‡ä¸ä¸€æ¨£ï¼Œç…§å­—é¢æ„æ€æ”¹æˆ
   ã€Œç›´æŽ¥æ‰£ã€ï¼Œé€™è£¡æ‹¿æŽ‰stunï¼Œåªç•™
   statDownï¼ˆå…¨å±¬æ€§ä¸‹é™é¡ždebuffæ‰æœƒå‹•åˆ°
   å‘½ä¸­å€¼æœ¬èº«ï¼‰ï¼Œæšˆçœ©çš„æ‰£æ¸›ç§»åˆ°
   rollHitChance()è£¡è™•ç†ï¼ˆè¦‹è©²å‡½å¼æ—çš„
   èªªæ˜Žï¼‰ï¼Œå‘¼å«æ™‚æ©Ÿæ˜¯ã€Œé€™éš»æ€ªç‰©çœŸçš„è¦
   å‡ºæ‰‹æ”»æ“Šã€çš„é‚£ä¸€åˆ»ï¼Œæ¯”è¼ƒç¬¦åˆã€Œå‘½ä¸­çŽ‡
   é™ä½Žã€é€™å€‹æè¿°çš„å­—é¢æ„æ€ã€‚
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
   â˜… æ–°å¢žï¼ˆé‡è¦ï¼‰ï¼šæ•æ·æŽ’åºçš„è¡Œå‹•é †åºç³»çµ±ã€‚

   è¦æ ¼ï¼šã€Œé›™æ–¹ä¾æ•æ·é«˜ä½Žé †åºå…ˆå¾Œå‡ºæ‰‹è¡Œå‹•ã€â€”â€”
   ä¹‹å‰æ˜¯ã€ŒçŽ©å®¶å…¨éƒ¨è¡Œå‹•å®Œï¼Œæ€ªç‰©æ‰é–‹å§‹æ”»æ“Šã€ï¼Œ
   å…©é‚Šå„è‡ªä¸€æ‰¹ï¼Œç¾åœ¨æ”¹æˆçŽ©å®¶è·Ÿæ€ªç‰©æ··åœ¨ä¸€èµ·ï¼Œ
   ä¾æ•æ·ï¼ˆå«è£å‚™åŠ æˆï¼‰ç”±é«˜åˆ°ä½ŽæŽ’ä¸€ä»½è¡Œå‹•æ¸…å–®ï¼Œ
   é€™ä»½æ¸…å–®åœ¨æ¯å€‹ã€Œå¤§å›žåˆã€é–‹å§‹æ™‚é‡æ–°ç®—ä¸€æ¬¡
   ï¼ˆinitiativeQueueï¼‰ï¼Œ
   ç„¶å¾Œä¸€å€‹ä¸€å€‹ç…§é †åºè™•ç†ï¼ˆprocessNextCombatant()ï¼‰ï¼Œ
   è¼ªåˆ°èª°ã€èª°æ‰è¡Œå‹•ã€‚

   æ•æ·ç›¸åŒæ™‚ä½ è¦æ±‚ã€Œä¸€æ¨£å°±æ˜¯éš¨æ©Ÿã€ï¼Œ
   æ‰€ä»¥æŽ’åºæ™‚é¡å¤–åŠ ä¸€å€‹å°çš„éš¨æ©Ÿäº‚æ•¸å†æ¯”è¼ƒï¼Œ
   æ•æ·ç›¸åŒçš„æƒ…æ³ä¸‹é †åºæœƒéš¨æ©Ÿæ´—ç‰Œï¼Œ
   ä¸æœƒæ¯æ¬¡éƒ½å›ºå®šåŒä¸€å€‹äººå…ˆæ‰‹ã€‚
*/

let initiativeQueue=[];

/*
   â˜… æ–°å¢žï¼šè·ŸdeclaredCharacterIndexesåŒä¸€ç¨®
   é˜²è­·ï¼Œæ“‹æŽ‰æ‰‹æ©Ÿç€è¦½å™¨è¨ˆæ™‚å™¨å»¶é²/è£œç™¼
   å°Žè‡´processNextCombatant()è¢«åŒä¸€å€‹
   initiativeIndexé‡è¤‡å‘¼å«çš„å•é¡Œã€‚
   æ¯æ¬¡startResolutionPhase()é–‹å§‹æ–°çš„
   çµç®—éšŽæ®µæ™‚æ¸…ç©ºã€‚
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
       â˜… ä¿®æ­£ï¼ˆé‡æ–°è¨­è¨ˆå›žåˆåˆ¶ä¹‹å¾Œï¼Œé€™è£¡æ”¹å›žå–®ç´”æŽ’åºï¼‰ï¼š
       ä¹‹å‰é€™è£¡æœ‰å€‹ã€Œç¬¬ä¸€å›žåˆå¼·åˆ¶çŽ©å®¶æŽ’æœ€å‰é¢ã€çš„
       ç‰¹æ®Šè™•ç†ï¼Œæ˜¯åœ¨é‚„æ²’æœ‰å®£å‘Š/çµç®—å…©éšŽæ®µä¹‹å‰
       çš„æš«æ™‚è§£æ³•ã€‚

       ç¾åœ¨æœ‰äº†å®£å‘ŠéšŽæ®µï¼ŒçŽ©å®¶æœ¬ä¾†å°±ä¸€å®šæœƒåœ¨
       çµç®—é–‹å§‹ã€Œä¹‹å‰ã€æŠŠé€™å›žåˆè¦åšä»€éº¼æ±ºå®šå¥½ï¼Œ
       ä¸ç®¡ç¬¬å¹¾å›žåˆéƒ½ä¸€æ¨£ï¼Œæ‰€ä»¥é€™å€‹ç‰¹æ®Šè™•ç†
       å·²ç¶“ä¸éœ€è¦äº†â€”â€”çµç®—éšŽæ®µå–®ç´”ä¾æ•æ·é«˜ä½ŽæŽ’åºå°±å¥½ï¼Œ
       æ•æ·å¿«çš„æ€ªç‰©ä¾ç„¶å¯ä»¥æ¶åˆ°ã€Œçµç®—é †åºã€çš„å…ˆæ‰‹ï¼Œ
       ä½†é‚£å·²ç¶“æ˜¯çŽ©å®¶æ±ºå®šå¥½è¡Œå‹•ä¹‹å¾Œçš„äº‹äº†ï¼Œ
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
   â˜… æ–°å¢žï¼šæ•´å€‹å›žåˆçš„ç¸½èª¿åº¦å™¨ã€‚
   æ¯æ¬¡ä¸€å€‹combatantï¼ˆä¸ç®¡æ˜¯è§’è‰²é‚„æ˜¯æ€ªç‰©ï¼‰
   è¡Œå‹•çµæŸï¼Œéƒ½æœƒå‘¼å«é€™è£¡ï¼Œ
   å¾€initiativeQueueçš„ä¸‹ä¸€ä½æŽ¨é€²ã€‚
   æ¸…å–®è·‘å®Œå°±ä»£è¡¨é€™å€‹å¤§å›žåˆçµæŸï¼Œ
   é–‹ä¸‹ä¸€è¼ªï¼ˆå›žåˆæ•¸+1ã€é‡æ–°çµç®—ç‡ƒç‡’/buffã€
   é‡æ–°æŽ’ä¸€æ¬¡æ–°çš„è¡Œå‹•é †åºï¼‰ã€‚
*/

/*
   â˜… æ–°å¢žï¼šé–‹å§‹çµç®—éšŽæ®µã€‚
   å®£å‘ŠéšŽæ®µå…¨éƒ¨äººéƒ½é¸å¥½ä¹‹å¾Œæ‰æœƒå‘¼å«é€™è£¡ï¼Œ
   æŠŠã€Œå·²å®£å‘Šçš„çŽ©å®¶è¡Œå‹•ã€è·Ÿã€Œæ€ªç‰©ã€
   æ··åœ¨ä¸€èµ·ï¼Œä¾æ•æ·é«˜ä½ŽæŽ’ä¸€ä»½åŸ·è¡Œé †åºï¼Œ
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
       â˜… ä¿®æ­£ï¼ˆçœŸæ­£æŠ“åˆ°ã€ŒåŒä¸€éš»æ€ªç‰©ä¸€å€‹å›žåˆ
       æ”»æ“Šå…©æ¬¡ã€ã€Œé€£çºŒè·³å…©å€‹å›žåˆã€çš„æ ¹æºï¼‰ï¼š
       é€™è£¡å¦‚æžœå·²ç¶“çœŸçš„åŸ·è¡ŒéŽä¸€æ¬¡ï¼Œä»£è¡¨é€™æ¬¡
       å‘¼å«æ˜¯æ‰‹æ©Ÿç€è¦½å™¨è¨ˆæ™‚å™¨å»¶é²/è£œç™¼é€ æˆçš„
       é‡è¤‡å‘¼å«â€”â€”ç›´æŽ¥æ“‹ä¸‹ï¼Œä¸æœƒé‡æ–°å»ºç«‹
       initiativeQueueã€ä¸æœƒæŠŠinitiativeIndex
       è·ŸprocessedInitiativeIndexesç æŽ‰é‡ç·´ï¼Œ
       å·²ç¶“åœ¨é€²è¡Œä¸­çš„çµç®—éšŽæ®µä¸æœƒè¢«æ‰“æ–·ã€
       é‡æ–°å¾žé ­é–‹å§‹ä¸€æ¬¡ã€‚
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
       â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼‰ï¼š
       å®£å‘ŠéšŽæ®µçµæŸã€çœŸæ­£é€²å…¥çµç®—éšŽæ®µï¼ˆé–‹å§‹
       ä¾æ•æ·é †åºå‡ºæ‰‹ï¼‰çš„é€™ä¸€åˆ»ï¼ŒæŠŠå…©å¼µçŽ©å®¶
       å¡ç‰‡ä¸Šã€Œè¼ªåˆ°èª°å®£å‘Šã€çš„é»ƒè‰²é–ƒçˆå¤–æ¡†
       å…¨éƒ¨æ‹¿æŽ‰â€”â€”å®£å‘Šå·²ç¶“çµæŸäº†ï¼Œé€™å€‹æç¤º
       çš„ä»»å‹™ä¹ŸçµæŸäº†ï¼Œç¹¼çºŒé–ƒçˆåè€Œè®“äººæžä¸æ¸…æ¥š
       ã€Œç¾åœ¨åˆ°åº•æ˜¯èª°åœ¨è¡Œå‹•ã€ï¼Œæ‹¿æŽ‰ä¹‹å¾Œç•«é¢
       æ›´ä¹¾æ·¨ï¼Œä¹Ÿä¸æœƒå†è·Ÿæ”»æ“Š/å—æ“Šå‹•ç•«çš„
       ç–Šæ”¾é †åºæ‰“æž¶ã€‚
    */

    clearActiveCharacterHighlight();
    clearBattleTargetSelectionMode();


    /*
       â˜… ä¿®æ­£ï¼ˆçœŸçš„æŠ“åˆ°ä¸€å€‹åš´é‡bugï¼Œæ„Ÿè¬ä½ æŠ“å‡ºä¾†ï¼‰ï¼š

       é˜²ç¦¦åŽŸæœ¬è·Ÿæ”»æ“Šä¸€æ¨£ï¼Œè¢«æŽ’é€²ä¾æ•æ·é«˜ä½Ž
       åŸ·è¡Œçš„çµç®—ä½‡åˆ—è£¡â€”â€”é€™æ˜¯éŒ¯çš„ã€‚
       å¦‚æžœé˜²ç¦¦è§’è‰²çš„æ•æ·æ¯”æ”»æ“Šä»–çš„æ€ªç‰©ä½Žï¼Œ
       æ•æ·æŽ’åºæœƒè®“æ€ªç‰©ã€Œå…ˆã€å‡ºæ‰‹ã€
       é˜²ç¦¦è§’è‰²ã€Œå¾Œã€å‡ºæ‰‹ï¼Œ
       ç­‰æ–¼è§’è‰²çš„é˜²ç¦¦å§¿æ…‹æ ¹æœ¬é‚„æ²’ç”Ÿæ•ˆï¼Œ
       æ”»æ“Šå°±å·²ç¶“æ‰“å®Œäº†ï¼Œé˜²ç¦¦å½¢åŒè™›è¨­ï¼Œ
       é€™æ­£æ˜¯ã€Œæœ‰é˜²ç¦¦è·Ÿæ²’é˜²ç¦¦å‚·å®³ä¸€æ¨£ã€çš„çœŸæ­£åŽŸå› ã€‚

       é˜²ç¦¦çš„æœ¬è³ªæ˜¯ã€Œé€™æ•´å€‹å›žåˆéƒ½è¦ç”Ÿæ•ˆçš„ä¿è­·ã€ï¼Œ
       ä¸æ‡‰è©²è·Ÿæ”»æ“Šä¸€æ¨£å—æ•æ·é †åºå½±éŸ¿â€”â€”
       ä¸ç®¡èª°å¿«èª°æ…¢ï¼Œåªè¦é€™å›žåˆå®£å‘Šäº†é˜²ç¦¦ï¼Œ
       å°±æ‡‰è©²åœ¨æ€ªç‰©å‡ºæ‰‹ã€Œä¹‹å‰ã€å°±å·²ç¶“ç”Ÿæ•ˆã€‚

       ä¿®æ­£æ–¹å¼ï¼šåœ¨çµç®—éšŽæ®µçœŸæ­£é–‹å§‹ï¼ˆæŽ’æ€ªç‰©å‡ºæ‰‹ï¼‰
       ä¹‹å‰ï¼Œå…ˆè·‘ä¸€æ¬¡ã€Œé˜²ç¦¦é å…ˆå¥—ç”¨ã€ï¼Œ
       æŠŠæ‰€æœ‰é€™å›žåˆå®£å‘Šé˜²ç¦¦çš„è§’è‰²ç›´æŽ¥å¥—ç”¨é˜²ç¦¦ç‹€æ…‹ï¼Œ
       ä¹‹å¾Œæ‰æŽ’æ•æ·é †åºã€è™•ç†æ€ªç‰©æ”»æ“Šâ€”â€”
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
       â˜… æ–°å¢žï¼ˆè·Ÿå®£å‘ŠéšŽæ®µç”¨åŒä¸€å¥—é˜²è­·ï¼Œ
       åŽŸå› ä¸€æ¨£ï¼šæ‰‹æ©Ÿç€è¦½å™¨èƒŒæ™¯åŸ·è¡Œæ™‚
       setTimeoutå¯èƒ½è¢«å»¶é²ã€è£œç™¼ï¼Œå°Žè‡´
       processNextCombatant()è¢«åŒä¸€å€‹
       initiativeIndexå‘¼å«å…©æ¬¡â€”â€”é€™æ¥µå¯èƒ½
       å°±æ˜¯ã€ŒåŒä¸€éš»æ€ªç‰©åŒä¸€å€‹ä½ç½®é€£çºŒæ”»æ“Š
       å…©æ¬¡ã€çš„çœŸæ­£åŽŸå› ï¼Œä¸æ˜¯æ€ªç‰©è³‡æ–™
       æˆ–æ©ŸçŽ‡çš„å•é¡Œã€‚
    */

    processedInitiativeIndexes=
        new Set();


    /*
       â˜… æ–°å¢žï¼ˆè£œä¸Šé˜²è­·ç¶²çš„ç¼ºå£ï¼‰ï¼š
       ä¹‹å‰çš„try-catché˜²è­·ç¶²åªåŒ…ä½å®£å‘ŠéšŽæ®µ
       å‰å…©ä½è§’è‰²çš„è‡ªå‹•åˆ¤æ–·ï¼Œç¬¬ä¸‰æ¬¡å‘¼å«
       beginCharacterTurn()ï¼ˆç´¢å¼•è¶…éŽéšŠä¼é•·åº¦ã€
       æº–å‚™è·³ä¾†é€™è£¡ï¼‰æ˜¯é€éŽå¦ä¸€å€‹ç¨ç«‹çš„è¨ˆæ™‚å™¨
       åŸ·è¡Œçš„ï¼Œä¸åœ¨åŽŸæœ¬çš„ä¿è­·ç¯„åœå…§â€”â€”å¦‚æžœ
       processNextCombatant()ä¸€é–‹å§‹åŸ·è¡Œå°±å‡ºéŒ¯ï¼Œ
       é€™å€‹éŒ¯èª¤æœƒè¢«å®Œå…¨åžæŽ‰ã€ä¸æœƒé¡¯ç¤ºåœ¨ç•«é¢ä¸Šï¼Œ
       çŽ©å®¶åªæœƒçœ‹åˆ°ã€Œè·³åŽ»çµç®—éšŽæ®µã€ä¹‹å¾Œ
       ä»€éº¼éƒ½æ²’æœ‰ç™¼ç”Ÿï¼Œé€™æ­£æ˜¯é€™æ¬¡é™¤éŒ¯è¨Šæ¯
       åœåœ¨é€™è£¡çš„çœŸæ­£åŽŸå› ã€‚

       é€™è£¡è£œä¸ŠåŒæ¨£çš„try-catchï¼Œç¢ºä¿çµç®—éšŽæ®µ
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
            "çµç®—éšŽæ®µç™¼ç”Ÿä¾‹å¤–ï¼š",
            error
        );

        addBattleLog(
            "çµç®—éšŽæ®µç™¼ç”Ÿä¾‹å¤–ï¼ˆ"+
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
           â˜… ä¿®æ­£ï¼ˆè£œä¸Šæœ€å¾Œä¸€å€‹æ¼æ´žï¼Œè¦‹ä¸Šé¢
           turnAdvancePendingå®£å‘Šè™•çš„èªªæ˜Žï¼‰ï¼š
           é€™å€‹è½‰æ›å¦‚æžœå·²ç¶“è§¸ç™¼éŽï¼Œä»£è¡¨é€™æ¬¡
           å‘¼å«æ˜¯è¨ˆæ™‚å™¨å»¶é²è£œç™¼çš„é‡è¤‡å‘¼å«ï¼Œ
           ç›´æŽ¥æ“‹ä¸‹ï¼Œä¸æœƒturn++å…©æ¬¡ã€
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
       â˜… ä¿®æ­£ï¼ˆçœŸæ­£çš„æ ¹æºä¿®æ³•ï¼Œè·Ÿå®£å‘ŠéšŽæ®µ
       åŒä¸€å¥—é‚è¼¯ï¼‰ï¼š
       æ‰‹æ©Ÿç€è¦½å™¨èƒŒæ™¯åŸ·è¡Œæ™‚setTimeoutå¯èƒ½è¢«
       å»¶é²ã€ä¹‹å¾Œè£œç™¼ï¼Œå°Žè‡´é€™å€‹å‡½å¼è¢«åŒä¸€å€‹
       initiativeIndexå‘¼å«ç¬¬äºŒæ¬¡â€”â€”é€™æ­£æ˜¯
       ã€ŒåŒä¸€éš»æ€ªç‰©åŒä¸€å€‹ä½ç½®é€£çºŒæ”»æ“Šå…©æ¬¡ã€
       çš„çœŸæ­£åŽŸå› ã€‚é€™è£¡æ“‹æŽ‰é‡è¤‡ï¼šé€™å€‹
       initiativeIndexå¦‚æžœå·²ç¶“è™•ç†éŽï¼Œä»£è¡¨
       é€™æ¬¡å‘¼å«æ˜¯å»¶é²è£œç™¼çš„é‡è¤‡å‘¼å«ï¼Œç›´æŽ¥
       returnï¼Œä¸æœƒè®“åŒä¸€ä½æ€ªç‰©/çŽ©å®¶çš„è¡Œå‹•
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
            "å·²ç¶“è™•ç†éŽï¼‰ï¼Œå·²æ“‹ä¸‹ã€‚"
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
           é€™å€‹è§’è‰²æœ‰å¯èƒ½åœ¨é€™å€‹å¤§å›žåˆ
           æ›´æ—©ä¹‹å‰å°±å·²ç¶“é™£äº¡
           ï¼ˆè¢«æ€ªç‰©æ‰“æ­»ï¼Œæˆ–ç¬¬äºŒè§’è‰²å€’ä¸‹ï¼‰ï¼Œ
           ç›´æŽ¥è·³éŽï¼Œä¸ä½”ç”¨è¡Œå‹•ã€‚
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
           â˜… ä¿®æ­£ï¼ˆé‡æ–°è¨­è¨ˆå›žåˆåˆ¶ï¼‰ï¼š
           çµç®—éšŽæ®µä¸å†é‡æ–°å‘¼å«
           beginCharacterTurn()ç­‰æ–°çš„è¼¸å…¥ï¼Œ
           è€Œæ˜¯æŠŠé€™å€‹è§’è‰²åœ¨å®£å‘ŠéšŽæ®µ
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
            console.error("çµç®—çŽ©å®¶è¡Œå‹•æ™‚ç™¼ç”Ÿæœªæ””æˆªä¾‹å¤–ï¼š",error);
            addBattleLog("çµç®—çŽ©å®¶è¡Œå‹•æ™‚ç™¼ç”Ÿä¾‹å¤–ï¼Œå·²ç”±å®‰å…¨é–˜é–€ç¹¼çºŒã€‚");
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
   â˜… æ–°å¢žï¼šæŠŠå®£å‘ŠéšŽæ®µé¸å¥½ã€å­˜èµ·ä¾†çš„è¡Œå‹•
   çœŸæ­£æ‹¿å‡ºä¾†åŸ·è¡Œã€‚

   è‡ªå‹•æˆ°é¬¥çš„è§’è‰²ä¸æœƒèµ°åˆ°é€™è£¡â€”â€”ä»–å€‘åœ¨
   å®£å‘ŠéšŽæ®µè¼ªåˆ°è‡ªå·±æ™‚å°±å·²ç¶“ç›´æŽ¥åŸ·è¡Œå®Œäº†
   ï¼ˆautoAction()/player2AutoAction()ï¼‰ï¼Œ
   é€™è£¡è™•ç†çš„éƒ½æ˜¯æ‰‹å‹•è§’è‰²å®£å‘ŠéšŽæ®µ
   å­˜ä¸‹ä¾†çš„æ™®é€šæ”»æ“Š/å‚·å®³æŠ€èƒ½ã€‚
*/

function resolveQueuedPlayerAction(characterIndex,token){

    const queued=

        queuedPlayerActions[
            characterIndex
        ];


    if(!queued){

        /*
           é˜²å‘†ï¼šç†è«–ä¸Šå®£å‘ŠéšŽæ®µæ¯å€‹æ´»è‘—çš„
           æ‰‹å‹•è§’è‰²éƒ½æ‡‰è©²æœ‰å­˜åˆ°ä¸€ç­†è¡Œå‹•ï¼Œ
           è¬ä¸€çœŸçš„æ²’æœ‰ï¼ˆä¾‹å¦‚é€¾æ™‚æ²’é¸ï¼‰ï¼Œ
           ç›´æŽ¥è·³éŽï¼Œä¸å¡ä½çµç®—æµç¨‹ã€‚
        */

        finishPlayerAction();

        return;

    }


    const isAdditionalCharacter=
        characterIndex>0;


    /*
       â˜… ä¿®æ­£ï¼ˆé‡è¦ï¼Œä¾ç…§ä½¿ç”¨è€…æ˜Žç¢ºæŒ‡æ­£ï¼‰ï¼š
       é˜²ç¦¦ã€è—¥æ°´ã€å¢žç›Š/æ²»ç™‚/å¾©æ´»é€™å¹¾ç¨®
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
           ç›®å‰å¢žç›Š/æ²»ç™‚/å¾©æ´»åªæ”¯æ´ç¬¬ä¸€è§’è‰²ï¼Œ
           è·ŸprepareAction()è£¡çš„é™åˆ¶ä¸€è‡´ã€‚
        */

        activeBattleCharacterIndex=
            characterIndex;


        /*
           â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼ŒæŽ¥ä¸Šæ–°å¢žçš„
           é¢¨ç³»/åœŸç³»å¢žç›ŠæŠ€èƒ½ï¼‰ï¼š
           åŽŸæœ¬é€™è£¡ä¸ç®¡æŽ’çš„æ˜¯å“ªå€‹å¢žç›ŠæŠ€èƒ½ï¼Œ
           ä¸€å¾‹ç¡¬å‘¼å«castRageBuff()â€”â€”é€™ä»£è¡¨
           å¦‚æžœçŽ©å®¶æŽ’çš„æ˜¯æ–°å¢žçš„é–ƒèº²è¡“/å²©çŸ³
           å£å£˜/è¬è±¡åœŸç›¾/çµç•Œ/éš±èº«è¡“/ç³§è‰
           å…ˆè¡Œï¼Œå¯¦éš›ä¸ŠæœƒéŒ¯èª¤åœ°åŸ·è¡Œã€Œæ€’ç«ã€
           çš„é‚è¼¯ï¼Œä¸æ˜¯çŽ©å®¶çœŸæ­£é¸çš„æŠ€èƒ½ã€‚

           æ”¹æˆæŠŠqueued.actionï¼ˆçœŸæ­£çš„æŠ€èƒ½IDï¼‰
           å‚³é€²åŽ»ï¼ŒcastBuffSkill()å…§éƒ¨æœƒä¾
           æŠ€èƒ½IDåˆ†æµåˆ°æ­£ç¢ºçš„æ•ˆæžœã€‚
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
               â˜… æ–°å¢žï¼ˆé˜²è­·ç¶²è£œåˆ°æœ€å¾Œä¸€å€‹ç¼ºå£ï¼‰ï¼š
               processNextCombatant()ã€
               beginCharacterTurn()çš„è‡ªå‹•åˆ¤æ–·
               éƒ½å·²ç¶“æœ‰try-catchï¼Œå”¯ç¨ã€Œçµç®—éšŽæ®µ
               çœŸæ­£åŸ·è¡ŒçŽ©å®¶/ç¬¬äºŒè§’è‰²è¡Œå‹•ã€é€™ä¸€æ®µ
               å®Œå…¨æ²’æœ‰â€”â€”ä»»ä½•ä¸€å€‹æŠ€èƒ½æ–½æ”¾å‡½å¼
               è£¡é¢ï¼Œåªè¦æœ‰ä»»ä½•ä¸€è¡Œæ„å¤–æ‹‹å‡ºä¾‹å¤–
               ï¼ˆä¾‹å¦‚è³‡æ–™æ²’å°é½Šã€undefinedå­˜å–ï¼‰ï¼Œ
               æ•´æ¢çµç®—éˆå°±æœƒåœ¨é€™ä¸€åˆ»ç„¡è²æ–·æŽ‰ï¼Œ
               çŽ©å®¶åªæœƒçœ‹åˆ°ç•«é¢åœä½ï¼Œä»€éº¼æç¤º
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
   å‘½ä¸­åˆ¤å®šçš„æ‰€æœ‰åŠ æ¸›æ•ˆæžœéƒ½åœ¨æœ€å¾Œä»¥ç™¾åˆ†é»žçµç®—ã€‚
   directChanceReductionPercent æ˜¯æœ€çµ‚å‘½ä¸­ä¸‹é™ï¼Œ
   directChanceBonusPercent æ˜¯æœ€çµ‚å‘½ä¸­æå‡ã€‚
   ç›®æ¨™é–ƒèº²åŒæ¨£ç›´æŽ¥æ‰£é™¤ç™¾åˆ†é»žï¼Œæœ€å¾Œæ‰çµ±ä¸€ clamp 70%ï½ž99%ã€‚
*/

function calculateHitChancePercent(
    casterAccuracy,
    targetEvasion,
    directChanceReductionPercent,
    directChanceBonusPercent
){
    const chance=
        HIT_CHANCE_BASE+
        Math.max(0,Number(casterAccuracy)||0)*HIT_CHANCE_ACCURACY_COEFFICIENT+
        (Number(directChanceBonusPercent)||0)-
        Math.max(0,Number(targetEvasion)||0)-
        Math.max(0,Number(directChanceReductionPercent)||0);

    return Math.max(
        HIT_CHANCE_MIN_PERCENT,
        Math.min(HIT_CHANCE_MAX_PERCENT,chance)
    );
}

function rollHitChance(
    casterAccuracy,
    targetEvasion,
    directChanceReductionPercent,
    directChanceBonusPercent
){
    return Math.random()*100<calculateHitChancePercent(
        casterAccuracy,
        targetEvasion,
        directChanceReductionPercent,
        directChanceBonusPercent
    );
}

window.v173GetHitChancePercent=calculateHitChancePercent;


/* =====================================================
   V173.38 æŠ€èƒ½å‚·å®³ï¼šæœ‰æ•ˆæ”»æ“Š Ã— damageRole ï¼‹æ­£å¼ flatDamageï¼Œ
   å†ä¸”åªäº¤çµ¦ calculateDamage() ä¸€æ¬¡ã€‚èˆŠå¼äº”åƒæ•¸å‘¼å«åŠ
   å°šæœªé·ç§»æŠ€èƒ½ä¿ç•™å›ºå®šå‚·å®³å›žé€€ï¼Œä¾›æ­·å²æµç¨‹ç›¸å®¹ã€‚
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
   â˜… ç•°å¸¸ç‹€æ…‹å‘½ä¸­æ©ŸçŽ‡å…¬å¼ï¼ˆæ–°å¢žï¼‰

   è¦æ ¼ï¼ˆä½¿ç”¨è€…åŽŸè©±ï¼‰ï¼š
   ã€Œç²¾ç¥žè¶Šé«˜ï¼ŒæŠ—æ€§å°±è¶Šé«˜ï¼Œå°±ä¸å®¹æ˜“è¢«ç•°å¸¸ç‹€æ…‹å‘½ä¸­ã€‚
     æ™ºåŠ›è¶Šé«˜ï¼Œç•°å¸¸ç‹€æ…‹å‘½ä¸­æ©ŸçŽ‡å°±è¶Šé«˜ï¼Œ
     å†åŠ ä¸Šç­‰ç´šå£“åˆ¶ä¹Ÿæœƒå½±éŸ¿æ•´é«”æ©ŸçŽ‡ã€

   ä¸€èˆ¬ç•°å¸¸æœ€çµ‚æ©ŸçŽ‡ = åŸºç¤Žæ©ŸçŽ‡Ã—ç­‰ç´šå·®å€çŽ‡
     + ç‰©ç†æ”»æ“ŠåŠ›æˆ–æ™ºåŠ›Ã—0.05
     - ç›®æ¨™ç²¾ç¥žÃ—0.05
     - é¡å¤–ç•°å¸¸æŠ—æ€§ï¼Œæœ€å¾Œé™åˆ¶åœ¨5%ï½ž95%ã€‚

   å†°å°ã€çŸ³åŒ–ç­‰ç¡¬æŽ§ç¶­æŒç¨ç«‹å…¬å¼ï¼šå±¬æ€§åŠ æˆç‚º
   sqrt(ç‰©æ”»æˆ–æ™ºåŠ›)Ã—0.2ï¼Œç²¾ç¥žèˆ‡ç¨€æœ‰åº¦ä¸Šé™æ²¿ç”¨æ—¢æœ‰è¦å‰‡ã€‚

   â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œã€ŒéŽ–æ­»è¡Œå‹•çš„
   æŠ€èƒ½ç¨ç«‹è¨­ä¸€çµ„ç¯„åœï¼Œ5%~60%ã€ï¼‰ï¼š
   åŽŸæœ¬å…¨éƒ¨ç•°å¸¸ç‹€æ…‹ï¼ˆç‡ƒç‡’/æ•æ·é™ä½Ž/é˜²ç¦¦
   é™ä½Ž/æšˆçœ©/å†°å°/çŸ³åŒ–â€¦â€¦ï¼‰å…±ç”¨åŒä¸€çµ„
   5%~95%ä¸Šä¸‹é™ï¼Œä½†å†°å°/çŸ³åŒ–é€™å…©ç¨®æ˜¯
   ã€Œæ•´å›žåˆå®Œå…¨ç„¡æ³•è¡Œå‹•ã€ï¼Œè·Ÿå…¶ä»–åªæ˜¯
   å‰Šå¼±æ•¸å€¼çš„debuffï¼Œæ•ˆæžœä»½é‡å·®å¤ªå¤šï¼Œ
   ä¸è©²å…±ç”¨åŒä¸€çµ„æ©ŸçŽ‡ä¸Šé™â€”â€”ä¸ç„¶æ™ºåŠ›
   å †ä¸€å †ï¼Œå†°å°æ©ŸçŽ‡ä¹Ÿèƒ½è¡åˆ°9æˆï¼Œç­‰æ–¼
   è®“å°æ‰‹æ•´å ´éƒ½å‹•ä¸äº†ï¼Œå¤ªå¼·ã€‚

   isLockdown åƒæ•¸ä¾›å†°å°ï¼çŸ³åŒ–å‘¼å«æ™‚å‚³ trueï¼›
   å…¶ä»–ä¸€èˆ¬debuffï¼ˆæ•æ·/
   é˜²ç¦¦/å…¨å±¬æ€§é™ä½Žã€æšˆçœ©ï¼‰ç¶­æŒåŽŸæœ¬çš„
   5%~95%ï¼Œä¸å—å½±éŸ¿ã€‚
===================================================== */

const STATUS_OFFENSE_ATTRIBUTE_COEFFICIENT = 0.05;

/*
   ä¸€èˆ¬ç•°å¸¸æ¯1é»žç²¾ç¥žé™ä½Ž0.05å€‹ç™¾åˆ†é»žå‘½ä¸­çŽ‡ï¼›
   ç¡¬æŽ§ä»åœ¨ç¨ç«‹å…¬å¼ä½¿ç”¨åŽŸæœ¬çš„0.3ä¿‚æ•¸ã€‚
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
   éŽ–æ­»è¡Œå‹•é¡žæŠ€èƒ½ï¼ˆå†°å°/çŸ³åŒ–ï¼‰ä¾ç›®æ¨™æ€ªç‰©
   ç¨€æœ‰åº¦ä½¿ç”¨æ™®é€š80%ã€ç²¾è‹±60%ã€BOSS40%çš„ä¸Šé™ã€‚
   æ€Žéº¼åˆ¤æ–·ä¸€éš»æ€ªç‰©æ˜¯ã€Œé‡Žæ€ªã€é‚„æ˜¯ã€Œç²¾è‹±æ€ªã€ï¼š
   çœ‹getMonsterRank()â€”â€”ç›®å‰è¦å‰‡å¾ˆå–®ç´”ï¼Œ
   åå­—çµå°¾æ˜¯ã€ŒçŽ‹ã€å°±ç®—ç²¾è‹±æ€ªï¼Œå…¶é¤˜éƒ½ç®—
   é‡Žæ€ªï¼›å¦‚æžœä¹‹å¾Œæ€ªç‰©è³‡æ–™æƒ³æ›´ç²¾æº–æŒ‡å®š
   ï¼ˆä¸åªé åå­—åˆ¤æ–·ï¼‰ï¼Œå¯ä»¥é¡å¤–åŠ ä¸€å€‹
   monster.rankæ¬„ä½ï¼ŒgetMonsterRank()
   æœƒå„ªå…ˆçœ‹é€™å€‹æ¬„ä½ï¼Œæ²’æœ‰æ‰é€€å›žçœ‹åå­—ã€‚
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
   â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œã€Œç‰©ç†æŠ€èƒ½ï¼Œ
   å°ç²¾è‹±æ€ªå‚·å®³åŠ ä¹˜10%ï¼Œboss15%ã€ï¼Œ
   è·Ÿæ³•è¡“æŠ€èƒ½é targetTypeæ¯”è¼ƒå¯¬å»£ï¼ˆtri/
   row/allï¼‰åˆ†å·¥â€”â€”ç‰©ç†æŠ€èƒ½å°ˆç²¾å–®é«”
   ç¡¬ä»—ï¼Œé€™è£¡è£œä¸Šé€™å¡Šï¼‰ï¼š

   åªæœ‰ã€ŒæŠ€èƒ½ã€åƒå¾—åˆ°é€™å€‹åŠ æˆï¼Œæ™®é€šæ”»æ“Š
   ï¼ˆæ²’æœ‰skillç‰©ä»¶ã€æˆ–categoryä¸æ˜¯
   "physical"ï¼‰ä¸ç®—ï¼Œé€™æ˜¯ä½¿ç”¨è€…æ˜Žç¢ºè¦æ±‚
   ä¿ç•™çš„å€åˆ†â€”â€”æ™®é€šæ”»æ“Šä¸æ˜¯æˆ°å£«çš„ç‰¹è‰²ï¼Œ
   ç‰©ç†æŠ€èƒ½æ‰æ˜¯ã€‚

   é‡Žæ€ªï¼ˆregularï¼‰æ²’æœ‰åŠ æˆï¼Œç²¾è‹±æ€ª
   ï¼ˆåå­—å¸¶ã€ŒçŽ‹ã€ï¼Œæˆ–æœªä¾†æ˜Žç¢ºæ¨™è¨˜
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
   â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œã€Œæ™ºåŠ›éžæ¸›ã€
   ä¸èƒ½æ²’æœ‰ç”¨ï¼Œè€ƒæ…®åˆ°ä¹‹å¾ŒBOSSç²¾ç¥žæœƒæ›´é«˜ã€ï¼‰ï¼š
   éŽ–æ­»è¡Œå‹•é¡žæŠ€èƒ½çš„æ™ºåŠ›åŠ æˆï¼Œæ”¹ç”¨é–‹æ ¹è™Ÿ
   ï¼ˆMath.sqrt(æ™ºåŠ›)Ã—ä¿‚æ•¸ï¼‰å–ä»£åŽŸæœ¬ä¸€èˆ¬
   debuffç”¨çš„ç·šæ€§å…¬å¼ï¼ˆæ™ºåŠ›Ã—ä¿‚æ•¸ï¼‰ã€‚

   é–‹æ ¹è™Ÿçš„æ•ˆæžœæ˜¯ã€Œé‚Šéš›æ•ˆç›Šéžæ¸›ã€â€”â€”æ™ºåŠ›
   è¶Šå †è¶Šé«˜ï¼Œæ¯ä¸€é»žæ™ºåŠ›æ›ä¾†çš„æ©ŸçŽ‡å¢žå¹…æœƒ
   è‡ªå‹•è®Šå°ï¼Œä¸æœƒåƒç·šæ€§å…¬å¼é‚£æ¨£ï¼ŒçŽ©å®¶
   æ™ºåŠ›é¤Šåˆ°ä¸­æœŸï¼ˆå¤§ç´„300~500ï¼‰å°±ç›´æŽ¥
   å¡æ­»åœ¨60%ä¸Šé™ã€ä¹‹å¾Œæ™ºåŠ›å†æ€Žéº¼åŠ éƒ½
   æ„Ÿå—ä¸åˆ°å·®ç•°ã€‚

   ä¿‚æ•¸ç¶­æŒ0.2ï¼›BOSSç²¾ç¥žä»æŒ‰ç¡¬æŽ§åŽŸæœ¬çš„0.3
   ä¿‚æ•¸æ‰£é™¤ï¼Œä¸å—ä¸€èˆ¬ç•°å¸¸0.05èª¿æ•´å½±éŸ¿ã€‚
*/

const LOCKDOWN_INT_COEFFICIENT = 0.2;


/*
   â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œã€Œå®šæµ·ç¥žé‡ï¼š
   ä½¿æˆ‘æ–¹å…¨é«”ç•°å¸¸ç‹€æ…‹æŠ—æ€§æå‡25%ã€ï¼›å¾ŒçºŒ
   ä¿®æ­£ç‚ºé€šç”¨ç‰ˆæœ¬ï¼Œå‘¼æ‡‰ã€Œæ‡‰è©²è¨­å®šåªè¦æˆ‘æ–¹
   éƒ½èƒ½åƒåˆ°æ•ˆæžœï¼Œå¯«ä¸€æ¬¡å°±ä¸€å‹žæ°¸é€¸ã€é€™å€‹
   è¦æ±‚ï¼‰ï¼š

   é€™å€‹å‡½å¼æ˜¯çµ¦ã€Œå°‡ä¾†æ€ªç‰©å°çŽ©å®¶æ–½æ”¾ç•°å¸¸
   ç‹€æ…‹ã€çš„é‚è¼¯å‘¼å«ç”¨çš„â€”â€”ç›®å‰éŠæˆ²è£¡æ€ªç‰©
   å®Œå…¨ä¸æœƒå°çŽ©å®¶æ–½æ”¾ç‡ƒç‡’/å†°å°/æšˆçœ©/é™é˜²ç¦¦
   é€™é¡žç•°å¸¸ç‹€æ…‹ï¼ˆprocessSingleMonsterAttack()
   æ•´æ®µæŸ¥éŽï¼Œåªæœ‰é€ æˆå‚·å®³ï¼Œæ²’æœ‰ä»»ä½•debuff
   åˆ¤å®šï¼‰ï¼Œæ‰€ä»¥é€™å€‹å‡½å¼ç›®å‰ä¸æœƒè¢«ä»»ä½•åœ°æ–¹
   å‘¼å«ã€25%æŠ—æ€§ç›®å‰å°å¯¦æˆ°æ²’æœ‰å½±éŸ¿ï¼Œå…ˆæŠŠ
   ã€ŒæŸ¥è©¢ç”¨çš„å‡½å¼ã€è·Ÿã€Œbuffå„²å­˜ã€éƒ½åšå°ï¼Œ
   ç­‰ä¹‹å¾ŒçœŸçš„è¦åšã€Œæ€ªç‰©å°çŽ©å®¶ä¸‹ç•°å¸¸ç‹€æ…‹ã€
   æ™‚ï¼Œç›´æŽ¥æŠŠé€™å€‹å‡½å¼å›žå‚³å€¼ç•¶æˆé¡å¤–ç•°å¸¸æŠ—æ€§
   å‚³é€²æ­£å¼å…¬å¼å³å¯ã€‚

   æ”¹æˆåƒcharacteråƒæ•¸ï¼ˆè·ŸgetActiveBuffPercent()/
   hasActiveBuff()åŒä¸€ç¨®é€šç”¨è¨­è¨ˆï¼‰ï¼Œä¸å¯«æ­»
   playerï¼Œé€™æ¨£è§’è‰²äºŒè™Ÿã€ä»¥å¾Œè§’è‰²ä¸‰è™Ÿå››è™Ÿï¼Œ
   å‘¼å«é€™å€‹å‡½å¼æ™‚å‚³è‡ªå·±çš„è§’è‰²ç‰©ä»¶é€²ä¾†å°±å¥½ï¼Œ
   ä¸ç”¨å¦å¤–å¯«ä¸€ä»½player2å°ˆç”¨ç‰ˆæœ¬ã€‚

   é¡å¤–ç•°å¸¸æŠ—æ€§æŽ¡ç™¾åˆ†é»žç›´æŽ¥æ‰£é™¤ï¼Œä¸åšç¬¬äºŒæ¬¡ä¹˜ç®—ã€‚
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
       æœ€çµ‚ç•°å¸¸ï¼ç¡¬æŽ§æˆåŠŸçŽ‡ =
       æŠ€èƒ½åŸºç¤ŽæˆåŠŸçŽ‡
       + æ–½æ”¾è€…ä¸»å±¬æ€§Ã—0.05%
       + æœ€çµ‚ç•°å¸¸å‘½ä¸­åŠ æˆ
       - ç›®æ¨™ç²¾ç¥žÃ—0.05%
       - å…¶ä»–æœ€çµ‚ç•°å¸¸æŠ—æ€§ã€‚

       casterLevel / targetLevel ä¿ç•™åœ¨åƒæ•¸åˆ—åªç‚ºç›¸å®¹æ—¢æœ‰ callerï¼Œ
       æ­£å¼å…¬å¼ä¸å†ä½¿ç”¨ç­‰ç´šå·®å€çŽ‡ã€sqrt å±¬æ€§å…¬å¼æˆ–ç¡¬æŽ§å°ˆå±¬ç²¾ç¥žä¿‚æ•¸ã€‚
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
   å›žå‚³ true/falseã€‚
   Math.random()*100 æ˜¯ 0~100 ä¹‹é–“çš„äº‚æ•¸ï¼Œ
   å°æ–¼ç®—å‡ºä¾†çš„æ©ŸçŽ‡å°±ç®—å‘½ä¸­ã€‚

   â˜… ä¿®æ­£ï¼šæ–°å¢žisLockdownåƒæ•¸ï¼Œå†°å°/çŸ³åŒ–
   å‘¼å«æ™‚è¦è¨˜å¾—å‚³trueï¼Œæ‰æœƒå¥—ç”¨æ¯”è¼ƒåš´æ ¼
   çš„ä¸Šé™ã€‚

   â˜… å†æ¬¡ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œã€Œé™åˆ¶
   è¡Œå‹•çš„ç•°å¸¸ç‹€æ…‹å¸¸æ•¸ä¿®æ”¹ã€ï¼‰ï¼šæ–°å¢ž
   targetRankåƒæ•¸ï¼ˆ"regular"/"elite"/
   "boss"ï¼‰ï¼Œå†°å°/çŸ³åŒ–é€™é¡žéŽ–æ­»æŠ€èƒ½æ‰“
   åœ¨æ€ªç‰©èº«ä¸Šæ™‚ï¼Œè¨˜å¾—å‚³getMonsterRank
   (monster)ç®—å‡ºä¾†çš„ç¨€æœ‰åº¦ï¼Œæ‰æœƒå¥—ç”¨
   å°æ‡‰é‚£çµ„ä¸Šä¸‹é™ï¼ˆè¦‹calculateStatusEffectChance()
   æ—çš„LOCKDOWN_HIT_BOUNDSèªªæ˜Žï¼‰ã€‚
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
   â˜… æ²»ç™‚é‡å…¬å¼ï¼ˆæ–°å¢žï¼‰

   ä½¿ç”¨è€…å•çš„æ˜¯ï¼š
   ã€Œæ™ºåŠ›å±¬æ€§è¶Šé«˜ï¼Œæ¢å¾©æŠ€èƒ½çš„é‡å°±è¶Šé«˜ï¼Œ
     é€™å€‹è©²å¦‚ä½•åŽ»æŠ“åŸºæº–ï¼Ÿ10é»žæ™ºåŠ›+1é»žæ¢å¾©é‡å—Žï¼Ÿã€

   æˆ‘çš„åˆ¤æ–·ï¼š10é»žæ™ºåŠ›æ‰+1é»žæ¢å¾©é‡å¤ªå¼±äº†ã€‚
   å°ç…§ç¾æœ‰çš„å‚·å®³å…¬å¼ï¼Œ
   æ™ºåŠ›å°ã€Œæ³•è¡“æ”»æ“Šã€æ˜¯ 1é»žæ™ºåŠ› = +8é»žé­”æ”»
   ï¼ˆgetBaseStats()èˆ‡æˆ°é¬¥æ•¸å€¼å…±ç”¨åŒä¸€æ›ç®—å¸¸æ•¸ï¼‰ã€‚
   å¦‚æžœæ²»ç™‚åªçµ¦10é»žæ™ºåŠ›+1ï¼Œ
   æœƒè®Šæˆã€Œé»žæ™ºåŠ›åŽ»æ‰“å‚·å®³ã€è·Ÿ
   ã€Œé»žæ™ºåŠ›åŽ»æ²»ç™‚ã€çš„å ±é…¬çŽ‡å·®è·éžå¸¸æ‡¸æ®Šï¼Œ
   æ²’æœ‰äººæœƒæƒ³é»žæ™ºåŠ›åŽ»çŽ©è£œå¸«è·¯ç·šã€‚

   æ­£å¼æ”¹ç”¨ 1é»žæ™ºåŠ› = +1.25é»žæ²»ç™‚é‡ï¼Œ
   æŠ“æ¯”é­”æ”»ä¿‚æ•¸(8)ä½Žï¼Œ
   æ˜¯å› ç‚ºæ²»ç™‚æŠ€èƒ½é€šå¸¸æ²’æœ‰é˜²ç¦¦åŠ›æ¸›å…é€™é“é—œå¡
   ï¼ˆæ²»ç™‚ä¸æœƒè¢«ã€Œé˜²ç¦¦åŠ›ã€æ‰“æŠ˜æ‰£ï¼‰ï¼Œ
   å¦‚æžœä¿‚æ•¸è·Ÿæ”»æ“Šä¸€æ¨£é«˜ï¼Œ
   æ²»ç™‚é‡æˆé•·æ›²ç·šæœƒæ¯”å‚·å®³é‚„èª‡å¼µï¼Œ
   æ‰€ä»¥åˆ»æ„æŠ“å¾—æ¯”æ”»æ“Šä¿‚æ•¸ä½Žä¸€äº›ï¼Œ
   ä½†åˆæ¯”ä½¿ç”¨è€…åŽŸæœ¬çŒœçš„0.1ï¼ˆ10é»žæ‰+1ï¼‰åˆç†å¾ˆå¤šã€‚

   æœ€çµ‚æ²»ç™‚é‡ = æŠ€èƒ½åŸºç¤Žæ²»ç™‚é‡ + Math.floor(æ™ºåŠ› Ã— 1.25)
   ä¸å¥—ç”¨ç­‰ç´šå·®è·ä¿‚æ•¸ã€ä¹Ÿä¸å¥—ç”¨é˜²ç¦¦åŠ›æ¸›å…ï¼Œ
   å› ç‚ºæ²»ç™‚æ˜¯å°å·±æ–¹æ–½æ”¾ï¼Œ
   è·Ÿã€Œæ‰“è´æ•µäººã€çš„é‚è¼¯ç„¡é—œï¼Œ
   å–®ç´”çœ‹æ–½æ”¾è€…è‡ªå·±æ™ºåŠ›å¤šé«˜ã€‚

   èˆ‰ä¾‹ï¼š
   æ²»ç™‚è¡“åŸºç¤Žæ²»ç™‚40é»žï¼Œ
   æ–½æ”¾è€…æ™ºåŠ›34ï¼š
   40 + floor(34Ã—1.25) = 40+42 = 82é»žã€‚
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
   æ¯1é»žæ™ºåŠ› = +0.5é»žSPæ²»ç™‚é‡ã€‚
   æ³¨æ„ï¼šé€™æ˜¯ã€Œå¯çµ¦å‹æ–¹ç›®æ¨™çš„SPæ²»ç™‚é‡ã€ï¼›æ–½æ”¾è€…æœ¬äººä¸å›žå¾©SPã€‚
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
   â˜… é€šç”¨æŠ€èƒ½æ–½æ”¾å¼•æ“Ž

   ä¹‹å‰æ¯å€‹æŠ€èƒ½éƒ½å„è‡ªå¯«ä¸€å€‹function
   ï¼ˆrocketAttack/criticalAttack/...ï¼‰ï¼Œ
   æŠ€èƒ½ä¸€å¤šï¼ˆç¾åœ¨ç«ç³»å°±æœ‰10å€‹ï¼Œä¹‹å¾Œæ°´ç³»é‚„æœ‰10å€‹ï¼‰
   é€™æ¨£å¯«ä¸ä¸‹åŽ»ï¼Œæ‰€ä»¥æ”¹æˆã€Œè³‡æ–™é©…å‹•ã€ï¼š
   skillDatabaseè£¡å®šç¾©å¥½æ¯å€‹æŠ€èƒ½çš„æ•¸å€¼ï¼Œ
   å…¨éƒ¨æŠ€èƒ½å…±ç”¨åŒä¸€å¥—æ–½æ”¾é‚è¼¯ã€‚

   ç›®å‰åªæœ‰ã€Œç«ã€è§’è‰²æœƒçœŸæ­£ä¸Šå ´æˆ°é¬¥
   ï¼ˆæ°´/é¢¨è§’è‰²é‚„æ˜¯è¦æ ¼è£¡çš„ã€Œæœªä¾†åŠŸèƒ½ã€ï¼‰ï¼Œ
   æ‰€ä»¥é€™å€‹å¼•æ“Žå…ˆæœå‹™fireè§’è‰²ï¼Œ
   ä¹‹å¾Œæ°´è§’è‰²èƒ½ä¸Šå ´æˆ°é¬¥æ™‚ï¼Œé€™å€‹å¼•æ“Žå¯ä»¥ç›´æŽ¥æ²¿ç”¨ã€‚
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
   ä¾æŠ€èƒ½çš„ç›®æ¨™åž‹æ…‹ï¼Œç®—å‡ºé€™æ¬¡æ”»æ“Šå¯¦éš›æœƒæ‰“åˆ°å“ªäº›æ€ªç‰©
   ï¼ˆå›žå‚³çš„æ˜¯monstersé™£åˆ—çš„åŽŸå§‹indexæ¸…å–®ï¼‰ã€‚

   singleï¼šåªæ‰“é¸å®šçš„ç›®æ¨™ã€‚
   ä¸€èˆ¬æˆ°é¬¥ç”± FourSymbolsBattlefieldSlots çš„å›ºå®šåæ ¼å¿«ç…§è§£æž
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
    fireSoulResonance:"ç‚Žé­‚å…±é³´",
    bloodBurn:"ç„šè¡€",
    fireMomentum:"ç‚Žå‹¢",
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
    dinghaishenzhen:"æ°£å®šç¥žé–’",
    resistance:"æ°£å®šç¥žé–’",
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


/* ç‡ƒç‡’ï¼šåŒåç‹€æ…‹å­˜åœ¨æ™‚ç”±å‰ç½®åˆ¤å®šç›´æŽ¥MISSï¼Œä¸è¦†è“‹æˆ–åˆ·æ–°ã€‚ */

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
   â˜… å†°å°ç‹€æ…‹ï¼ˆæ–°å¢žï¼Œæ°´ç³»æŠ€èƒ½ç”¨ï¼‰ï¼š
   å†°å°ä¸­çš„æ€ªç‰©åœ¨monsterTurn()è£¡æœƒè¢«è·³éŽæ”»æ“Šï¼Œ
   ä¸æœƒæ‰£è¡€ï¼Œç´”ç²¹æ˜¯æŽ§å ´æ•ˆæžœï¼Œ
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
   â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼ŒæŽ¥ä¸Šé¢¨ç³»/åœŸç³»
   æŠ€èƒ½çš„æ¸›ç›Šæ•ˆæžœï¼‰ï¼š
   è·ŸapplyFreezeEffect()/applyBurnEffect()
   åŒä¸€å¥—æž¶æ§‹ï¼Œé€šç”¨ç‰ˆæœ¬ï¼Œä¸€æ¬¡è™•ç†agilityDown
   ï¼ˆé™æ•æ·ï¼‰ã€statDownï¼ˆé™å…¨å±¬æ€§ï¼‰ã€
   defenseDownï¼ˆé™é˜²ç¦¦ï¼‰ã€damageDownï¼ˆé™ä½Žé€ æˆå‚·å®³ï¼‰ã€
   stunï¼ˆæé«˜MISSçŽ‡ï¼‰ã€petrifyï¼ˆçŸ³åŒ–ï¼Œç„¡æ³•è¡Œå‹•ï¼‰é€™å…­ç¨®æ€ªç‰©èº«ä¸Š
   çš„æ¸›ç›Šæ•ˆæžœã€‚åŒåç‹€æ…‹å­˜åœ¨æ™‚ä¸€å¾‹MISSï¼Œ
   ä¸ç–ŠåŠ ã€ä¸è¦†è“‹ã€ä¸åˆ·æ–°æŒçºŒæ™‚é–“ã€‚

   valueçš„æ„ç¾©ä¾typeè€Œä¸åŒï¼š
   agilityDown/statDown/defenseDown/damageDown/stun
   â†’ç™¾åˆ†æ¯”æ•¸å­—ï¼ˆä¾‹å¦‚50ä»£è¡¨é™ä½Ž50%ï¼‰
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
   â˜… é€šç”¨ç‰ˆæœ¬ï¼šè®€å–æ€ªç‰©èº«ä¸ŠæŸå€‹æ¸›ç›Šæ•ˆæžœç›®å‰
   çš„æ•¸å€¼ï¼ˆæ²’æœ‰é€™å€‹æ•ˆæžœçš„è©±å›žå‚³0ï¼‰ï¼Œ
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
   V120ï¼šé¢¨ç„°è¡“ï¼é¢¨å“®é›»æ“Šçš„ã€Œå‚·å®³é™ä½Žã€æ­£å¼å…±ç”¨åŒä¸€å€‹è¼¸å‡ºå‚·å®³å…¥å£ã€‚
   damageDown çš„ value æ˜¯ç™¾åˆ†æ¯”ï¼Œä¾‹å¦‚30ä»£è¡¨æœ€çµ‚é€ æˆå‚·å®³é™ä½Ž30%ã€‚
   åªå½±éŸ¿è§’è‰²ï¼æ€ªç‰©ä¸»å‹•é€ æˆçš„ç›´æŽ¥æ”»æ“Šèˆ‡æŠ€èƒ½å‚·å®³ï¼›
   ä¸æ”¹ç‡ƒç‡’é€™é¡žä¾ç›®æ¨™æœ€å¤§HPè¨ˆç®—çš„æŒçºŒå‚·å®³ï¼Œä¹Ÿä¸æ”¹åå‚·ã€‚
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
    return tó­µÙ¼­zÊ&ŠÛ^u•È¹¡À¬‹¦îy!CŽˆ(€€€€¤ì((€€€ÕÁ‘…Ñ•U$ ¤ì(€€€™¥¹¥Í¡A±…å•ÉÑ¥½¸ ¤ì)ô(((¼¨(€€ƒš¾?–n{–B#¦Z/–ž/šf¾ò1‰Õ™›žjš2žê3–n{–B#šVã¢š¦{šâo¾ò0(€€ƒš¶ã¦nÛ–ÂÇžžï¦f“¾ò3’â›–r£š"Ã¦²—¢Î¢¢+žVg’âž¶žÒ¦2Ž(¨¼((¼¨(€€ƒŠbƒ’þ»š¶¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3š:—’â+šZÃ–Š{žj(€€ƒ–Š{žn+š*¢÷¾ò'¾òh(€€ƒ–:šr³¦g–/–÷–ò?–¾¯š¶ïŽ3Š>ÌƒšKž¯šV#šzs–ÞËžÖCšvŽ7¾ò0(€€ƒ’â7žº‡¦;šržjšb¿–N«–-‰Õ™›¦÷–6Ã–B3’â–>—¢¦Ç¾ò0(€€ƒ¢3’âS–>«¢fWžBÁ±…å•È¹…Ñ¥Ù•	Õ™™Ï¾ò1Á±…å•ÈÈ(€€ƒžj‰Õ™›¾ò#’ú/–š	Á±…å•ÈË–¶ãšržj–Ê§ž~Ï–Ž–Ž`¼(€€ƒ¦Z¢êË¢†O’æ/¦†{¾ò'–º3–£šÊK¢Š¯–KšVã¦;¾ò3šr¢º+š"@(€€ƒšÂã’æžRšV#Žšf¦ZO–"Ã’ê’æ’â7šršÚ#–’ÇŽ((€€ƒšRçš"C¦kžR£ž&#šr³¾ò3žR¡	U}1	1O¦gž¢¸(€€ƒ–Â7žŸ¢†£žÖÇ’âšÆë–ºkš¾?ž¢¹‰Õ™›¦†{–z/¦;šršf¢š(€€ƒ¦†¿ž’ë’î¦êó¢¢+š¿¾ò1Á±…å•È½Á±…å•ÈË¦÷šr¢fWžB¾ò0(€€ƒ¢Þ}Ñ¥­MÑ…ÑÕÍ™™•ÑÌ §¢fWžBš«ž&§šâožn+šb¼(€€ƒ–B3’â––_¢¢·¢¢#¦
?¢ò¿Ž(¨¼()½¹ÍÐ	U}aA%I}1	1Lõì((€€€É…”è‹šKž¬ˆ°(€€€Á¡½•¹¥á5¥¡Ðè‹¦ÎÏ–¢ˆ°(€€€‘½‘•M­¥±°è‹¦Š£¢†0ˆ°(€€€É½­]…±°è‹–Ê§ž~Ï–Ž–Ž`ˆ°(€€€•…ÉÑ¡M¡¥•±è‹¢B³¢Æ‡–ržnû¾ò#–>7–
ß¾ò$ˆ°(€€€‰…ÉÉ¥•Èè‹žÖCžV0ˆ°(€€€ÍÑ•…±Ñ¡M­¥±°è‹¦jÇ¢ê¬ˆ°(€€€‘¥¹¡…¥Í¡•¹é¡•¸è‹šÂ–ºkž–{¦ZHˆ°(€€€Í¡¥•±è‹–Ê§žnøˆ()ôì(()™Õ¹Ñ¥½¸Ñ¥­	Õ™™Í½É¡…É…Ñ•È¡¡…É…Ñ•È¥ì((€€€¥˜ (€€€€€€€€…¡…É…Ñ•Èñð(€€€€€€€€…¡…É…Ñ•È¹…Ñ¥Ù•	Õ™™Ìñð(€€€€€€€¡…É…Ñ•È¹…Ñ¥Ù•	Õ™™Ì¹±•¹Ñ ôôôÀ(€€€€¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€¡…É…Ñ•È¹…Ñ¥Ù•	Õ™™Ìô(€€€€€€€¡…É…Ñ•È¹…Ñ¥Ù•	Õ™™Ì¹™¥±Ñ•È (€€€€€€€€€€€‰Õ™˜ôùì((€€€€€€€€€€€€€€€¥˜¡‰Õ™˜¹ÑåÁ”ôôô‰Á¡½•¹¥á5¥¡Ðˆ¥ì(€€€€€€€€€€€€€€€€€€€½¹ÍÐ…Ñ¥Ù”ô(€€€€€€€€€€€€€€€€€€€€€€€‰Õ™˜¹‰…ÑÑ±•Q½­•¸ôôõ‰…ÑÑ±•Q½­•¸˜˜(€€€€€€€€€€€€€€€€€€€€€€€ÑÕÉ¸ñ9Õµ‰•È¡‰Õ™˜¹•áÁ¥É•ÍQÕÉ¸¤ì(€€€€€€€€€€€€€€€€€€€¥˜¡…Ñ¥Ù”¥ì(€€€€€€€€€€€€€€€€€€€€€€€‰Õ™˜¹ÑÕÉ¹Í1•™Ðõ5…Ñ ¹µ…à Ä±9Õµ‰•È¡‰Õ™˜¹•áÁ¥É•ÍQÕÉ¸¤µÑÕÉ¸¤ì(€€€€€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€…‘‘	…ÑÑ±•1½œ ‹Š>Ï¦ÎÏ–¢šV#šzs–ÞËžÖCšvŽˆ¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€€¼¨Q¥µ•‰Õ™™Ì½¹ÍÕµ”½¸Ñ¡¥Ì¡…É…Ñ•ÈÌ™½Éµ…°…Ñ¥½¸(€€€€€€€€€€€€€€€€€€‰½Õ¹‘…ÉäÑ¡É½Õ ½ÕÉMåµ‰½±ÍÕÉ…Ñ¥½¹1¥™•å±”¸€¨¼(€€€€€€€€€€€€€€€É•ÑÕÉ¸9Õµ‰•È¡‰Õ™˜¹ÑÕÉ¹Í1•™Ð¤øÀì((€€€€€€€€€€€ô(€€€€€€€€¤ì()ô(()™Õ¹Ñ¥½¸Ñ¥­A±…å•É	Õ™™Ì ¥ì((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾ò#¢žK¢&Ë¦f–"_¦7šž/ž²³’â¦j;šº×¾ò'¾òh(€€€€€€ƒšRçžR¡•Ñ¡…É…Ñ•ÉÌ §¾ò3’æ/–ú3–*ƒž²³’â'¢žK¢&Ë¾ò0(€€€€€€ƒ¦g¢Ž‡–º3–£’â7žR£–7šRç’â¢†3¾ò3¢«–.W–ÂÇšr’â¢ÖÜ(€€€€€€ƒ¢fWžB–"ÃŽ(€€€€¨¼((€€€•Ñ¡…É…Ñ•ÉÌ ¤¹™½É…  (€€€€€€€¡…É…Ñ•Èôùì((€€€€€€€€€€€Ñ¥­	Õ™™Í½É¡…É…Ñ•È (€€€€€€€€€€€€€€€¡…É…Ñ•È(€€€€€€€€€€€€¤ì((€€€€€€€ô(€€€€¤ì()ô(((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€ƒ–ÇžR£¾òk¢žšzCžn»–&7žjšRïšN+žn»š¢d(ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼((¼¨(€€ƒŠbƒšZÃ–Š{¾ò#’þ»–ú§Ž3žn»š¢gš¶ï’ê‡’öÍ•±•Ñ•‘5½¹ÍÑ•È(€€ƒžÒ‹–òW¦
šÊKšnÓšZÃ¾ò3¢žK¢&Ë¢†3–.WšVÓ–/–6‡š¶ïŽ7žj‰ÕŸ¾ò'¾òh((€€ƒšf»¦kšRïšN+Ž–
ß–ºÏš*¢÷Ž¦Š£’æ/žº·¦g’â'–/–÷–ò?¾ò0(€€ƒ–:šr³–B¢«¦7¢’–¾¯’âš²‡Ž1Í•±•Ñ•‘5½¹ÍÑ•Ëš2–"Ãžj(€€ƒš«ž&§¦
šÒï¢F_–^;Ž7žj–"“šZß¾ò3’âš^›¦j+–>/–#š*+¦g¦jïš«ž&¤(€€ƒš&Oš¶ïŽ’ö¦g–/¢žK¢&Ë¦:[–ºkžjžÒ‹–òW¦
šÊKš>o¦;¾ò3–"“šZÜ(€€ƒ–’ÇšV_–ÂÇžnÓš:•É•ÑÕÉ»ŠSŠS–V?¦†3šb¿¦g–-É•ÑÕÉ»šÊKšr$(€€ƒ–Fó–>­™¥¹¥Í¡A±…å•ÉÑ¥½¸ §¾ò3–Â;¢Ó¦g–/¢žK¢&Ëžj(€€ƒ¢†3–.W–6‡–r£–:–rÃ’â7šr–ú’â/¢ÖÃŽ–nƒž
ëš«ž&§žj¢†3–.W¦
?¢ò¼(€€ƒšb¿ž6£ž®/¢ÞGžj¾ò3žV¯¦v‹’â+š&7šržr/¢Öß’ú–?Ž3š«ž&§’âžnÓš&OŽ(€€ƒš"GšZç–º3–£šÊK–>7š'Ž7¾ò3–Û–¾›šb¿š"GšZçžj¢†3–.W’ö–"_¢Š¬(€€ƒ–6‡’ö?’êŽ((€€ƒš.š"C–§–Æ“¾òh((€€€Ä¸™¥¹‘±¥Ù•Q…É•Ñ%¹‘•à¡ÁÉ•™•ÉÉ•‘%¹‘•à§¾òh(€€€€€ƒžÒSžÊçžjŽ3š&ûžn»š¢gŽ7¦
?¢ò¿¾ò3’â7–Fó–>¬(€€€€€™¥¹¥Í¡A±…å•ÉÑ¥½¸ §Ž’â7šRåÍ•±•Ñ•‘5½¹ÍÑ•Ë¾ò0(€€€€€ƒ–Z»žÒS–n{–
ÏŽ3š'¢¦Ëš&O¢ªÃŽ7š"Y¹Õ±³¾ò#šÊK’êë–>¿š&O¾ò'Ž(€€€€€ƒ¦gš¢’â7žº‡–Fó–>¯ž®¿¢«–ÞÇšr'šÊKšr'¢fWžB(€€€€€™¥¹¥Í¡A±…å•ÉÑ¥½¸ §¾ò3¦÷¢÷–º'–£–ÇžR£–B3’â––\(€€€€€ƒš&ûžn»š¢g¢š?–&¾ò3’â7šršr'–&¿’ösžR£š&OšzÛžj–V?¦†3Ž((€€€È¸É•Í½±Ù•ÑÑ…­Q…É•Ñ%¹‘•à §¾òh(€€€€€ƒžÖ™Á±…å•ÈÇžjšf»¦kšRïšN(¿–
ß–ºÏš*¢ô¿¦Š£’æ/žº·žR (€€€€€ƒ¾ò#¦g’â'–/–÷–ò?šr³¢ê¯¢š¢«–ÞÇ¢Êƒ¢Ê³–Fó–>¬(€€€€€™¥¹¥Í¡A±…å•ÉÑ¥½¸ §¾ò3–Fó–>¯ž®¿’â7šr¢Žs¾ò'¾ò0(€€€€€ƒ–r¡™¥¹‘±¥Ù•Q…É•Ñ%¹‘•ãžjžÖCšzs’â+¾ò0(€€€€€ƒ–’k–kŽ3–B3š¶•Í•±•Ñ•‘5½¹ÍÑ•ËŽ7¢Þ|(€€€€€ƒŽ3š&û’â7–"Ãžn»š¢gšf–Fó–>­™¥¹¥Í¡A±…å•ÉÑ¥½¸ §Ž4(€€€€€ƒ¦g–§’îÛ’ê/Ž((€€ƒ–§–Æ“¢š?–&’â¢Ó¾òh(€€€´Í•±•Ñ•‘5½¹ÍÑ•Ëš2–"Ãžjš«ž&§¦
šÒï¢F_¾ò3žnÓš:—šÊÿžR£¾ò0(€€€€ƒ’â7šRç¢º+ž:§–ºÛ–:šr³¦:[–ºkžjžn»š¢g¾òl(€€€´ƒš¶ï’êžj¢¦Ç¾ò3¢«–.WšRç¦:[–ºiÕÉÉ•¹Ñ	…ÑÑ±•5½¹ÍÑ•ÉÏ¢Ž„(€€€€ƒž²³’â¦jï¦
šÒï¢F_žjš«ž&§¾ò3¢ºOšRïšN+¢«–.Wš:—žê3’â/–:ï¾òl(€€€´ƒ¦’â¦jïšÒï¢F_žjš«ž&§¦÷š&û’â7–"Ã¾ò#šV×šZç–ÞË–rcšî¾ò'¾ò0(€€€€ƒ–n{–
Í¹Õ±³Ž((€€ƒ¦g–§–/–÷–ò?–>«¢fWžBŽ3žn»š¢gšb¿–B›šr'šV#Ž7¾ò0(€€ƒ’â7šr–.W–"Ã–
ß–ºÏ–³–ò?Ž–F÷’â·ž:ŽšjÓšN+ž:ž¶$(€€ƒ’îï’öWš^‹šr'š"Ã¦²—šVã–óš¦–"ÛŽ(¨¼()™Õ¹Ñ¥½¸™¥¹‘±¥Ù•Q…É•Ñ%¹‘•à¡ÁÉ•™•ÉÉ•‘%¹‘•à±Ñ…É•ÑQåÁ”¥ì(€€€½¹ÍÐÉ•Í½±Ù•‘Q…É•ÑQåÁ”õ¹½Éµ…±¥é•	…ÑÑ±•Q…É•ÑQåÁ”¡Ñ…É•ÑQåÁ•ñð‰Í¥¹±”ˆ¤ì(€€€¥˜¡É•Í½±Ù•‘Q…É•ÑQåÁ”ôôô‰…±°ˆ¥ìÉ•ÑÕÉ¸¹Õ±°ìô(€€€¥˜¡9Õµ‰•È¹¥Í%¹Ñ••È¡ÁÉ•™•ÉÉ•‘%¹‘•à¤˜™…¹M•±•Ñ!½ÍÑ¥±•	…ÑÑ±•AÉ¥µ…Éä ‰µ½¹ÍÑ•Èˆ±ÁÉ•™•ÉÉ•‘%¹‘•à±É•Í½±Ù•‘Q…É•ÑQåÁ”¤¥ì(€€€€€€€É•ÑÕÉ¸ÁÉ•™•ÉÉ•‘%¹‘•àì(€€€ô(€€€½¹ÍÐ™…±±‰…­%¹‘•àõÕÉÉ•¹Ñ	…ÑÑ±•5½¹ÍÑ•ÉÌ¹™¥¹¡¥¹‘•àôø(€€€€€€€…¹M•±•Ñ!½ÍÑ¥±•	…ÑÑ±•AÉ¥µ…Éä ‰µ½¹ÍÑ•Èˆ±¥¹‘•à±É•Í½±Ù•‘Q…É•ÑQåÁ”¤(€€€€¤ì(€€€É•ÑÕÉ¸™…±±‰…­%¹‘•àôôõÕ¹‘•™¥¹•ý¹Õ±°é™…±±‰…­%¹‘•àì)ô)™Õ¹Ñ¥½¸É•Í½±Ù•ÑÑ…­Q…É•Ñ%¹‘•à¡Ñ…É•ÑQåÁ”¥ì(€€€½¹ÍÐ¥¹‘•àõ™¥¹‘±¥Ù•Q…É•Ñ%¹‘•à¡Í•±•Ñ•‘5½¹ÍÑ•È±Ñ…É•ÑQåÁ•ñð‰Í¥¹±”ˆ¤ì(€€€¥˜¡¥¹‘•àôôõ¹Õ±°¥ì™¥¹¥Í¡A±…å•ÉÑ¥½¸ ¤ìÉ•ÑÕÉ¸¹Õ±°ìô(€€€Í•±•Ñ•‘5½¹ÍÑ•Èõ¥¹‘•àì(€€€É•ÑÕÉ¸¥¹‘•àì)ô(((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€ƒšf»¦kšRïšN(¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€ƒšf»¦kšRïšN((ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼()™Õ¹Ñ¥½¸¹½Éµ…±ÑÑ…¬ ¥ì((€€€¥˜ …‰…ÑÑ±•Ñ¥Ù”¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€½¹ÍÐ¥¹‘•à€ô(€€€€€€€É•Í½±Ù•ÑÑ…­Q…É•Ñ%¹‘•à ‰Í¥¹±”ˆ¤ì(((€€€¥˜¡¥¹‘•àôôõ¹Õ±°¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€½¹ÍÐµ½¹ÍÑ•È€ô(€€€€€€€µ½¹ÍÑ•ÉÍm¥¹‘•átì(((€€€±Õ¹•A±…å•É…É ¤ì(((€€€Í¡½ÝM­¥±±9…µ•	…‘” (€€€€€€€€‹šf»¦kšRïšN(ˆ°(€€€€€€€€‰¹½Éµ…°ˆ°(€€€€€€€€À°(€€€€€€€¥¹‘•à°(€€€€€€€m¥¹‘•át(€€€€¤ì(((€€€½¹ÍÐÍÑ…ÑÌ€ô(€€€€€€€•Ñ5…¥¹¡…É…Ñ•ÉMÑ…ÑÌ ¤ì(((€€€€¼¨(€€€€€€ƒŠbƒ–F÷’â·–"“–ºk¾òh(€€€€€€ƒš&Ož¦ëžj¢¦ÇžnÓš:—¢ÞÍ5%MOŽšJ·šRû¦Z¦ÿ–.WžV¯¾ò0(€€€€€€ƒ’â7¢¢#žº_–
ß–ºÏŽ’â7š&¢†¾ò0(€€€€€€ƒ’ö¦
šb¿¢šš¶–âãžÖCšv¦gš²‡¢†3–.T(€€€€€€ƒ¾ò#¦Ë–—š«ž&§–n{–B#¾ò'¾ò3’â7¢÷–6‡’ö?Ž(€€€€¨¼((€€€½¹ÍÐ¡¥Ð€ô(€€€€€€€É½±±!¥Ñ¡…¹” (€€€€€€€€€€€ÍÑ…ÑÌ¹…ÕÉ…ä°(€€€€€€€€€€€•Ñ5½¹ÍÑ•ÉÙ…Í¥½¸ (€€€€€€€€€€€€€€€µ½¹ÍÑ•È(€€€€€€€€€€€€¤°(€€€€€€€€€€€•Ñ5½¹ÍÑ•É•‰Õ™™Y…±Õ” (€€€€€€€€€€€€€€€€€€€Á±…å•È°(€€€€€€€€€€€€€€€€€€€€‰ÍÑÕ¸ˆ(€€€€€€€€€€€€€€€€¤°(€€€€€€€€€€€€€€€•ÑÑ¥Ù•ÕÉ…å	½¹ÕÍA•É•¹Ð¡Á±…å•È¤(€€€€€€€€€€€€¤ì(((€€€¥˜ …¡¥Ð¥ì((€€€€€€€Í¡½Ý5¥ÍÍ™™•Ð (€€€€€€€€€€€™…±Í”°(€€€€€€€€€€€¥¹‘•à°(€€€€€€€€€€€€‰5%MLˆ(€€€€€€€€¤ì(((€€€€€€€…‘‘	…ÑÑ±•1½œ (€€€€€€€€€€€€‹šf»¦kšRïšN(ˆ¬(€€€€€€€€€€€µ½¹ÍÑ•È¹¹…µ”¬(€€€€€€€€€€€€‹¾ò3šÊKšr'–F÷’â·¾òˆ(€€€€€€€€¤ì(((€€€€€€€ÕÁ‘…Ñ•U$ ¤ì((€€€€€€€™¥¹¥Í¡A±…å•ÉÑ¥½¸ ¤ì((€€€€€€€É•ÑÕÉ¸ì((€€€ô(((€€€½¹ÍÐÉ¥ÑI•ÍÕ±Ð€ô(€€€€€€€É½±±É¥Ñ¥…° (€€€€€€€€€€€Á±…å•È°(€€€€€€€€€€€€‰Á¡åÍ¥…°ˆ°(€€€€€€€€€€€•Ñ5½¹ÍÑ•É™™•Ñ¥Ù•¹Ñ¥É¥Ð¡µ½¹ÍÑ•È¤°(€€€€€€€€€€€µ½¹ÍÑ•È(€€€€€€€€¤ì((€€€½¹ÍÐ‘…µ…”€ô(€€€€€€€…±Õ±…Ñ•…µ…” (€€€€€€€€€€€ÍÑ…ÑÌ¹…ÑÑ…¬°(€€€€€€€€€€€•Ñ5½¹ÍÑ•É™™•Ñ¥Ù••™•¹Í”¡µ½¹ÍÑ•È¤°(€€€€€€€€€€€Á±…å•È¹±•Ù•°°(€€€€€€€€€€€µ½¹ÍÑ•È¹±•Ù•°°(€€€€€€€€€€€Á±…å•È¹•±•µ•¹Ð°(€€€€€€€€€€€µ½¹ÍÑ•È¹•±•µ•¹Ð°(€€€€€€€€€€€ì(€€€€€€€€€€€€€€€…ÑÑ…­•ÈéÁ±…å•È°(€€€€€€€€€€€€€€€Ñ…É•Ðéµ½¹ÍÑ•È°(€€€€€€€€€€€€€€€É¥Ñ5Õ±Ñ¥Á±¥•ÈéÉ¥ÑI•ÍÕ±Ð¹µÕ±Ñ¥Á±¥•È(€€€€€€€€€€€ô(€€€€€€€€¤ì(((€€€µ½¹ÍÑ•È¹¡À€ô(€€€€€€€5…Ñ ¹µ…à (€€€€€€€€€€€€À°(€€€€€€€€€€€µ½¹ÍÑ•È¹¡Àµ‘…µ…”(€€€€€€€€¤ì(((€€€Í¡½Ý5½¹ÍÑ•É!¥Ð (€€€€€€€¥¹‘•à°(€€€€€€€‘…µ…”°(€€€€€€€€‰¡Àˆ°(€€€€€€€É¥ÑI•ÍÕ±Ð¹¥ÍÉ¥Ð(€€€€¤ì(((€€€…‘‘	…ÑÑ±•1½œ ((€€€€€€€€‹šf»¦kšRïšN(ˆ¬(€€€€€€€µ½¹ÍÑ•È¹¹…µ”¬(€€€€€€€€ (€€€€€€€€€€€É¥ÑI•ÍÕ±Ð¹¥ÍÉ¥Ð(€€€€€€€€€€€€ü(€€€€€€€€€€€€‹¾ò#ž"šN+¾ò¾ò$ˆ(€€€€€€€€€€€€è(€€€€€€€€€€€€ˆˆ(€€€€€€€€¤¬(€€€€€€€€‹¾ò3¦ƒš"@ˆ¬(€€€€€€€‘…µ…”¬(€€€€€€€€‹–
ß–ºÏŽˆ((€€€€¤ì(((€€€¥˜¡µ½¹ÍÑ•È¹¡ÀðôÀ¥ì(€€€€€€€­¥±±5½¹ÍÑ•È¡¥¹‘•à¤ì(€€€ô(((€€€ÕÁ‘…Ñ•U$ ¤ì((€€€™¥¹¥Í¡A±…å•ÉÑ¥½¸ ¤ì()ô((((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€ƒ¦Š£’æ/žº´(ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼()™Õ¹Ñ¥½¸Ý¥¹‘ÉÉ½ÝÑÑ…¬ ¥ì((€€€¥˜ …‰…ÑÑ±•Ñ¥Ù”¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€¥˜¡Á±…å•È¹ÍÀðÄÀ¥ì((€€€€€€€¥˜¡…ÕÑ½	…ÑÑ±”¥ì((€€€€€€€€€€€¹½Éµ…±ÑÑ…¬ ¤ì((€€€€€€€ô(€€€€€€€•±Í•ì((€€€€€€€€€€€€¼¨(€€€€€€€€€€€€€€ƒŠbƒ’þ»š¶¾ò#¢Þ}…ÍÑ…µ…•M­¥±° §–B3’âž¢¸(€€€€€€€€€€€€€€‰ÕŸ¾ò3–B3’âš²‡’â¢Öß’þ»š:'¾ò'¾òh(€€€€€€€€€€€€€€ƒ–:šr³¦g¢Ž‡’æšb¿–6Ã–º3Šv3¢¢+š¿–ÂÇžnÓš:•É•ÑÕÉ»¾ò0(€€€€€€€€€€€€€€ƒšÊK–Fó–>­™¥¹¥Í¡A±…å•ÉÑ¥½¸ §¾ò3šr¢ºL(€€€€€€€€€€€€€€ƒžÖCžº_¦>#–ú{¦g¢Ž‡¦Z/–ž/šVÓ–/–6‡’ö?¾ò3’â7–>«¦Š£’æ/žº´(€€€€€€€€€€€€€€ƒ¦gš²‡¢†3–.W¾ò3–ú3¦v‹š&šr'¢žK¢&È¿š«ž&§žj–n{–B (€€€€€€€€€€€€€€ƒ¦÷’â7šr–7¢Š¯š:£¦ËŽ(€€€€€€€€€€€€¨¼((€€€€€€€€€€€…‘‘	…ÑÑ±•1½œ (€€€€€€€€€€€€€€€€‰MC’â7¢ÚÏ¾ò3ž‡šÎW’öÿžR£¦Š£’æ/žº·Žˆ(€€€€€€€€€€€€¤ì((€€€€€€€€€€€™¥¹¥Í¡A±…å•ÉÑ¥½¸ ¤ì((€€€€€€€ô((€€€€€€€É•ÑÕÉ¸ì((€€€ô(((€€€½¹ÍÐ¥¹‘•à€ô(€€€€€€€É•Í½±Ù•ÑÑ…­Q…É•Ñ%¹‘•à ¤ì(((€€€¥˜¡¥¹‘•àôôõ¹Õ±°¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€Á±…å•È¹ÍÀ€´ô€ÄÀì(((€€€±Õ¹•A±…å•É…É ¤ì(((€€€Í¡½ÝM­¥±±9…µ•	…‘” (€€€€€€€Í­¥±±…Ñ…‰…Í”¹Ý¥¹‘ÉÉ½Ü¹¹…µ”°(€€€€€€€€‰Ý¥¹ˆ°(€€€€€€€€À°(€€€€€€€¥¹‘•à°(€€€€€€€m¥¹‘•át(€€€€¤ì(((€€€Í•ÑQ¥µ•½ÕÐ  ¤ôùì(€€€€€€€Í¡½ÝA±…å•ÉMÁA½ÁÕÀ ÄÀ¤ì(€€€ô°ÔÀÀ¤ì(((€€€½¹ÍÐµ½¹ÍÑ•È€ô(€€€€€€€µ½¹ÍÑ•ÉÍm¥¹‘•átì(((€€€½¹ÍÐÍÑ…ÑÌ€ô(€€€€€€€•Ñ5…¥¹¡…É…Ñ•ÉMÑ…ÑÌ ¤ì(((€€€½¹ÍÐ‘…µ…”€ô(€€€€€€€…±Õ±…Ñ•…µ…” (€€€€€€€€€€€ÍÑ…ÑÌ¹…ÑÑ…¬¬ÄÔ°(€€€€€€€€€€€•Ñ5½¹ÍÑ•É™™•Ñ¥Ù••™•¹Í”¡µ½¹ÍÑ•È¤°(€€€€€€€€€€€Á±…å•È¹±•Ù•°°(€€€€€€€€€€€µ½¹ÍÑ•È¹±•Ù•°°(€€€€€€€€€€€Á±…å•È¹•±•µ•¹Ð°(€€€€€€€€€€€µ½¹ÍÑ•È¹•±•µ•¹Ð°(€€€€€€€€€€€í…ÑÑ…­•ÈéÁ±…å•È±Ñ…É•Ðéµ½¹ÍÑ•Éô(€€€€€€€€¤ì(((€€€µ½¹ÍÑ•È¹¡À€ô(€€€€€€€5…Ñ ¹µ…à (€€€€€€€€€€€€À°(€€€€€€€€€€€µ½¹ÍÑ•È¹¡Àµ‘…µ…”(€€€€€€€€¤ì(((€€€Í¡½Ý5½¹ÍÑ•É!¥Ð¡¥¹‘•à±‘…µ…”°‰¡Àˆ¤ì(((€€€…‘‘	…ÑÑ±•1½œ (€€€€€€€€‹¦Š£’æ/žº·–F÷’â´ˆ¬(€€€€€€€µ½¹ÍÑ•È¹¹…µ”¬(€€€€€€€€‹¾ò3¦ƒš"@ˆ¬(€€€€€€€‘…µ…”¬(€€€€€€€€‹–
ß–ºÏŽˆ(€€€€¤ì(((€€€¥˜¡µ½¹ÍÑ•È¹¡ÀðôÀ¥ì(€€€€€€€­¥±±5½¹ÍÑ•È¡¥¹‘•à¤ì(€€€ô(((€€€ÕÁ‘…Ñ•U$ ¤ì((€€€™¥¹¥Í¡A±…å•ÉÑ¥½¸ ¤ì()ô(((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€ƒž:§–ºÛ¢†3–.WžÖCšv|(ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼()™Õ¹Ñ¥½¸™¥¹¥Í¡A±…å•ÉÑ¥½¸ ¥ì((€€€‰…ÑÑ±•MÑ…Ñ¥ÍÑ¥Í¥¹¥Í¡Ñ¥½¸ ¤ì(€€€¹½Ñ¥™å	…ÑÑ±•Ñ¥½¹¥¹¥Í¡• ¤ì(€€€¥˜¡¥¹Ñ•É•ÁÑ	…ÑÑ±•Ñ¥½¹¥¹¥Í  ¤¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô((€€€€¼¨ÕÉ…Ñ¥½¸½¹ÍÕµÁÑ¥½¸‰•±½¹ÌÑ¼Ñ¡”½¹”É•…°ÅÕ•Õ”…‘Ù…¹”¸%¹Ñ•É•ÁÑ•(€€€€€€™½±±½ÜµÕÀ…ÍÑÌ…É”ÍÑ¥±°Á…ÉÐ½˜Ñ¡”Í…µ”™½Éµ…°…Ñ¥½¸…¹µÕÍÐ¹½Ð(€€€€€€½¹ÍÕµ”•áÑÉ„ÑÕÉ¹Ì¸€¨¼(€€€™¥¹¥Í¡	…ÑÑ±•ÕÉ…Ñ¥½¹Ñ¥½¸ ¤ì((€€€¥˜ …‰…ÑÑ±•Ñ¥Ù”¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€±•…É%¹Ñ•ÉÙ…°¡Ñ¥µ•É%¤ì(((€€€…Ñ¥½¹I•…‘äõ™…±Í”ì((€€€Á•¹‘¥¹Ñ¥½¸õ¹Õ±°ì(€€€±•…É	…ÑÑ±•Q…É•ÑM•±•Ñ¥½¹5½‘” ¤ì(((€€€¥˜¡¡•­	…ÑÑ±•¹ ¤¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô((€€€€¼¨Í¥¹±”…Ñ¥½¸µ…äÉ•… Ñ¡¥Ì¡•±Á•ÈÑ¡É½Õ …¹¥µ…Ñ¥½¸…¹™…±±‰…¬(€€€€€€Á…Ñ¡Ì¸=¹±äÑ¡”™¥ÉÍÐ…±°¥Ì…±±½Ý•Ñ¼…‘Ù…¹”Ñ¡”ÅÕ•Õ”¸€¨¼(€€€¥˜¡‰…ÑÑ±•‘Ù…¹•M¡•‘Õ±•¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô((€€€‰…ÑÑ±•‘Ù…¹•M¡•‘Õ±•õÑÉÕ”ì(((€€€½¹ÍÐÑ½­•¸ô(€€€€€€€‰…ÑÑ±•Q½­•¸ì(((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾ò#¦7šZÃ¢¢·¢¢#–n{–B#–"Û¾ò'¾òh(€€€€€€ƒ¦g–/–÷–ò?ž>û–r£–B3šfšr7–.g–§ž¢»š–Š¾ò0(€€€€€€ƒ¢šžr-‰…ÑÑ±•A¡…Í—šÆë–ºkŽ3žÖCšv–ú3š:—’â/’ú–k’î¦êóŽ7¾òh((€€€€€€€Ä¸‰…ÑÑ±•A¡…Í”ôôô‰‘•±…É”‹¾òh(€€€€€€€€€ƒ’î¢†£¦gšb¿–º–F+¦j;šº×¾ò#¢«–.W¢žK¢&Ë–º–F+šf(€€€€€€€€€ƒžnÓš:—–~ß¢†3Žš"[¦bËžš˜¿ž&§–N¿–Š{žn+¦g¦†x(€€€€€€€€€ƒ’â7¦r¢šžÖCžº_š:K–ê?žj¢†3–.W–&o–~ß¢†3–º3¾ò'¾ò0(€€€€€€€€€ƒžÖCšv–ú3¢š–ú’â/’â–/Ž3¦
šÊK–º–F+žj¢žK¢&ËŽ7š:£¦Ë¾ò0(€€€€€€€€€…Ñ¥Ù•	…ÑÑ±•¡…É…Ñ•É%¹‘•à¬¯¾ò0(€€€€€€€€€ƒ–Fó–>­‰•¥¹¡…É…Ñ•ÉQÕÉ¸ §Ž((€€€€€€€È¸‰…ÑÑ±•A¡…Í”ôôô‰É•Í½±Ù”‹¾òh(€€€€€€€€€ƒ’î¢†£¦gšb¿žÖCžº_¦j;šº×¾ò#šf»¦kšRïšN(¿–
ß–ºÏš*¢ô(€€€€€€€€€ƒžrš¶–r£’úwšV?š6ß¦‚–ê?–~ß¢†3¾ò'¾ò0(€€€€€€€€€ƒžÖCšv–ú3–ú¥¹¥Ñ¥…Ñ¥Ù•%¹‘•ãš:£¦Ë¾ò0(€€€€€€€€€ƒ–Fó–>­ÁÉ½•ÍÍ9•áÑ½µ‰…Ñ…¹Ð §Ž(€€€€¨¼((€€€¥˜¡‰…ÑÑ±•A¡…Í”ôôô‰‘•±…É”ˆ¥ì((€€€€€€€…Ñ¥Ù•	…ÑÑ±•¡…É…Ñ•É%¹‘•à¬¬ì(((€€€€€€€€¼¨(€€€€€€€€€€ƒŠbƒ’þ»š¶¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3¦gš²‡¦Ë’âš¶—¾ò'¾òh(€€€€€€€€€€ƒ–º–F+¦j;šº×–:šr³¦
šr¦†¿ž’ëŽ3–ÞË¦ãšNacŽ7šZ–¶_¾ò0(€€€€€€€€€€ƒš&’î—žVg’ê’â¦î{–îÛ¦Ë¢ºOž:§–ºÛžr/–ú_–"Ã¦
¢†3–¶_Ž(€€€€€€€€€€ƒž>û–r£–ÞËžÚOš.ÿš:'¦
¢†3šZ–¶_’ê¾ò0(€€€€€€€€€€ƒžÒSžÊçš>o’êë¦ãšN’â7¦r¢š–7ž¶'¾ò0(€€€€€€€€€€ƒžnÓš:—¦Ë’â/’â’ö7Ž–æû’æ;š¢šë’â7–"Ã–s¦‚OŽ(€€€€€€€€¨¼((€€€€€€€‰…ÑÑ±•‘Ù…¹•Q¥µ•½ÕÑ%õÍ•ÑQ¥µ•½ÕÐ  ¤ôùì((€€€€€€€€€€€‰…ÑÑ±•‘Ù…¹•Q¥µ•½ÕÑ%õ¹Õ±°ì(€€€€€€€€€€€‰…ÑÑ±•‘Ù…¹•M¡•‘Õ±•õ™…±Í”ì((€€€€€€€€€€€¥˜ (€€€€€€€€€€€€€€€€…‰…ÑÑ±•Ñ¥Ù”ñð(€€€€€€€€€€€€€€€Ñ½­•¸„ôõ‰…ÑÑ±•Q½­•¸(€€€€€€€€€€€€¥ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€€€€€ô(((€€€€€€€€€€€‰•¥¹¡…É…Ñ•ÉQÕÉ¸ (€€€€€€€€€€€€€€€Ñ½­•¸(€€€€€€€€€€€€¤ì((€€€€€€€ô±•Ñ	…ÑÑ±•‘Ù…¹••±…ä ‰‘•±…É”ˆ¤¤ì((€€€€€€€É•ÑÕÉ¸ì((€€€ô(((€€€¥¹¥Ñ¥…Ñ¥Ù•%¹‘•à¬¬ì(((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3–*ƒ–þ¯ž¾––?¾ò'¾òh(€€€€€€ƒ–:šr°ÄÀÔÁµÏ¾ò3’öÿžR£¢–>7š'Ž3š¾?–/’êë¢†3–.W–º3Ž(€€€€€€ƒš>o’â/’â’ö7Ž7žj¦ZO¦jSš¢šë–?’æ¾ò3–Â“–Û’âšVÓ¢ò¨(€€€€€€ƒš&O–º3¢šš:—’â/’â¢ò«žjšf–gž&ç–"—šb;¦†¿ŠSŠP(€€€€€€ƒ¦g¢Ž‡¢ªÿ–þ¯–"ÀÜÀÁµÏ¾ò3–.WžV¯¦
šb¿žr/–ú_šâš–k¾ò0(€€€€€€ƒ’öšVÓ¦®Sž¾––?šr’þC¢B÷’â7–ÂGŽ(€€€€¨¼((€€€½¹ÍÐ¹•áÑ•±…äõ•Ñ	…ÑÑ±•‘Ù…¹••±…ä ‰É•Í½±Ù”ˆ¤ì((€€€‰…ÑÑ±•‘Ù…¹•Q¥µ•½ÕÑ%õÍ•ÑQ¥µ•½ÕÐ  ¤ôùì((€€€€€€€‰…ÑÑ±•‘Ù…¹•Q¥µ•½ÕÑ%õ¹Õ±°ì(€€€€€€€‰…ÑÑ±•‘Ù…¹•M¡•‘Õ±•õ™…±Í”ì((€€€€€€€¥˜ (€€€€€€€€€€€€…‰…ÑÑ±•Ñ¥Ù”ñð(€€€€€€€€€€€Ñ½­•¸„ôõ‰…ÑÑ±•Q½­•¸(€€€€€€€€¥ì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€ô(((€€€€€€€€¼¨(€€€€€€€€€€ƒŠbƒšZÃ–Š{¾ò#¦g¢Ž‡šb¿šr¦^s¦6×žj’â–/žòë–>ŠSŠP(€€€€€€€€€€ƒš¾?–/’êë¢†3–.W–º3Žš>o’â/’â’ö7¾ò3–£¦£¦÷¢š(€€€€€€€€€€ƒžÚO¦;¦g¢Ž‡¾ò3’æ/–&7–º3–£šÊKšr'’þw¢¶ß¾ò0(€€€€€€€€€€ƒ–ššzs’îï’öW’âš²‡žjÁÉ½•ÍÍ9•áÑ½µ‰…Ñ…¹Ð ¤(€€€€€€€€€€ƒ–r£–~ß¢†3’â·–ë¦2¿¾ò3š"Ã¦²—–ÂÇšr–ú{¦
’â–"ì(€€€€€€€€€€ƒ¦Z/–ž/–º3–£¦vsš¶‹¾ò3ž:§–ºÛ–>«šržr/–"À(€€€€€€€€€€ƒžV¯¦v‹–s–r£–:–rÃ¾ò3’î¦êóš>Cž’ë¦÷šÊKšr'¾ò'¾òh(€€€€€€€€¨¼((€€€€€€€ÑÉåì((€€€€€€€€€€€ÁÉ½•ÍÍ9•áÑ½µ‰…Ñ…¹Ð (€€€€€€€€€€€€€€€Ñ½­•¸(€€€€€€€€€€€€¤ì((€€€€€€€ô(€€€€€€€…Ñ ¡•ÉÉ½È¥ì((€€€€€€€€€€€½¹Í½±”¹•ÉÉ½È (€€€€€€€€€€€€€€€€‹š:£¦Ë’â/’â’ö7šfžfóžR’ú/–’[¾òhˆ°(€€€€€€€€€€€€€€€•ÉÉ½È(€€€€€€€€€€€€¤ì((€€€€€€€€€€€…‘‘	…ÑÑ±•1½œ (€€€€€€€€€€€€€€€€‹š:£¦Ë’â/’â’ö7šfžfóžR’ú/–’[¾ò ˆ¬(€€€€€€€€€€€€€€€€¡•ÉÉ½È˜™•ÉÉ½È¹µ•ÍÍ…”¤¬(€€€€€€€€€€€€€€€€‹¾ò'¾ò3–b_¢¦›–òß–"Ûžæóžê3Žˆ(€€€€€€€€€€€€¤ì((€€€€€€€€€€€¥¹¥Ñ¥…Ñ¥Ù•%¹‘•à¬¬ì(€€€€€€€€€€€ÁÉ½•ÍÍ9•áÑ½µ‰…Ñ…¹Ð¡Ñ½­•¸¤ì((€€€€€€€ô((€€€ô±¹•áÑ•±…ä¤ì()ô(((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€ƒš«ž&§šRïšN((ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼((¼¨(€€ƒŠbƒ’þ»š¶¾ò#šV?š6ßš:K–ê?žÎïžÖÇ¾ò'¾òh(€€ƒ–:šr³žjµ½¹ÍÑ•ÉQÕÉ¸ §šb¿Ž3’âš²‡š*+š&šr'š«ž&¤(€€ƒ¦÷š&O¦;’â¢ò«Ž7žjš&çš²‡¢fWžB–÷–ò?¾ò0(€€ƒ¢Þž>û–r£Ž3ž:§–ºÛŽš«ž&§šÞß–r£–B3’â’î÷¢†3–.W¦‚–ê?šâ–Z»¢Ž„€€ƒ¢ò«šÖ¢†3–.WŽ7žjšzÛšž/’â7žnã–ºç’êŽ(€€ƒšRç–¾¯š"AÁÉ½•ÍÍM¥¹±•5½¹ÍÑ•ÉÑÑ…¬ §¾ò0(€€ƒ’âš²‡–>«¢fWžBŽ3¦g’â¦jïŽ7š«ž&§žjšRïšN+¾ò0(€€ƒš&O–º3–Fó–>­™¥¹¥Í¡A±…å•ÉÑ¥½¸ ¤(€€ƒ¾ò#ž>û–r£¦g–/–÷–ò?–Û–¾›šb¿Ž3žÖCšvžn»–&7¦g’ö7žj¢†3–.WŽ7¾ò0(€€ƒ’â7žº‡šb¿¢žK¢&Ë¦
šb¿š«ž&§¦÷–ÇžR£–º¾ò'–ú’â/’â’ö7š:£¦ËŽ(¨¼()™Õ¹Ñ¥½¸ÁÉ½•ÍÍM¥¹±•5½¹ÍÑ•ÉÑÑ…¬¡µ½¹ÍÑ•É%¹‘•à±Ñ½­•¸¥ì((€€€¥˜ (€€€€€€€€…‰…ÑÑ±•Ñ¥Ù”ñð(€€€€€€€Ñ½­•¸„ôõ‰…ÑÑ±•Q½­•¸(€€€€¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€½¹ÍÐµ½¹ÍÑ•Èô(€€€€€€€µ½¹ÍÑ•ÉÍmµ½¹ÍÑ•É%¹‘•átì(((€€€€¼¨(€€€€€€ƒ¦g¦jïš«ž&§šr'–>¿¢÷–r£¦g–/–’Ÿ–n{–B#šnÓš^§’æ/–&4(€€€€€€ƒ–ÂÇ–ÞËžÚO¢Š¯š&Oš¶ï’ê¾ò#š>ošV?š6ßš:K–ê?–ú3¾ò0(€€€€€€ƒž:§–ºÛ–>¿¢÷–#š&/š*+ž&ƒšºëš:'¾ò'¾ò0(€€€€€€ƒžnÓš:—¢ÞÏ¦;¾ò3’â7’öSžR£¢†3–.WŽ’â7š:'¢†Ž(€€€€¨¼((€€€¥˜ (€€€€€€€€…µ½¹ÍÑ•Èñð(€€€€€€€€…µ½¹ÍÑ•È¹…±¥Ù”(€€€€¥ì((€€€€€€€™¥¹¥Í¡A±…å•ÉÑ¥½¸ ¤ì((€€€€€€€É•ÑÕÉ¸ì((€€€ô(((€€€¥˜ (€€€€€€€¥Í5½¹ÍÑ•ÉÉ½é•¸¡µ½¹ÍÑ•È¤(€€€€¥ì((€€€€€€€…‘‘	…ÑÑ±•1½œ (€€€€€€€€€€€€ˆˆ¬(€€€€€€€€€€€µ½¹ÍÑ•È¹¹…µ”¬(€€€€€€€€€€€€‹¢Š¯–Ã–Â¾ò3ž‡šÎW¢†3–.WŽˆ(€€€€€€€€¤ì(((€€€€€€€™¥¹¥Í¡A±…å•ÉÑ¥½¸ ¤ì((€€€€€€€É•ÑÕÉ¸ì((€€€ô(((€€€€¼¨(€€€€€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3¦ŽošÊgžz³šN+žj(€€€€€€ƒž~Ï–2[šV#šzs¾ò'¾òk¢Þ–Ã–Â–B3š¢žjŽ3ž‡šÎW¢†3–.WŽ4(€€€€€€ƒ–"“šZß¾ò3–>«šb¿¦†{–z/’â7–B3Ž¢¢+š¿’â7–B3Ž(€€€€¨¼((€€€¥˜ (€€€€€€€¥Í5½¹ÍÑ•ÉA•ÑÉ¥™¥•¡µ½¹ÍÑ•È¤(€€€€¥ì((€€€€€€€…‘‘	…ÑÑ±•1½œ (€€€€€€€€€€€€ˆˆ¬(€€€€€€€€€€€µ½¹ÍÑ•È¹¹…µ”¬(€€€€€€€€€€€€‹¢Š¯ž~Ï–2[¾ò3ž‡šÎW¢†3–.WŽˆ(€€€€€€€€¤ì(((€€€€€€€™¥¹¥Í¡A±…å•ÉÑ¥½¸ ¤ì((€€€€€€€É•ÑÕÉ¸ì((€€€ô(((€€€±Õ¹•5½¹ÍÑ•É…É (€€€€€€€µ½¹ÍÑ•É%¹‘•à(€€€€¤ì((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3ž²°ËŽÏ¦‚¾ò'¾òh(€€€€€€€Ä¸ƒš*¢÷–B7ž¢Ç’â7–7¢«–ÞÇ–>[¾ò3šRçš"C–ú{š*¢÷šÆ€(€€€€€€€€€ƒ¾ò!Í­¥±±%‘Ï¾ò3–òWžR£žrš¶–¶c–r£žjš*¢÷¾ò$(€€€€€€€€€ƒ¦j£š¦š2G’â–/¢ššZ÷šRûžjš*¢õ%¾ò0(€€€€€€€€€ƒ¦†¿ž’ëžj–B7ž¢ÇžnÓš:—–:íÍ­¥±±…Ñ…‰…Í—š~”(€€€€€€€€€ƒžrš¶žjš*¢÷–B7ž¢Ç¾ò3¢Þž:§–ºÛžR£žjšb¼(€€€€€€€€€ƒ–B3’â––_š*¢÷Ž–B3’â–/–B7–¶_Ž(€€€€€€€È¸ƒš*¢÷¦/šRûš¦ž:’â7–7–¾¯š¶ìÔÀ—¾ò0(€€€€€€€€€ƒšRçš"C¢ºš«ž&§¢ÎšZg¢Ž‡–B¢«žjÍ­¥±±¡…¹”(€€€€€€€€€ƒ¾ò#’â7–B3–6–~š¦ž:’â7’âš¢¾ò'¾ò0(€€€€€€€€€ƒšb¿’â–/ž6£ž®/Ž¦w–Â7Ž3¦g¦jïš«ž&§¦g’âš²„(€€€€€€€€€ƒšRïšN+Ž7–Z»ž6£¦ªÃžjš¦ž:¾ò3’â7šb¿¢Þšf»¦kšRïšN((€€€€€€€€€ƒžÚ–r£’â¢ÖßŽ’êKšZ—žj–§–/¦ã¦‚–ÇžR£–B3’â–,(€€€€€€€€€ƒ–"“šZß–ò?¢3–ÞË¾ò3–B–6–~–>¿’î—¢«žRÇ¢ªÿšVÐ(€€€€€€€€€ƒ¦g–/šVã–¶_Ž’â7–öÇ¦~ÿ–Û’î[–rÃšZçŽ(€€€€¨¼((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3Ž1MC¢š–¾›¦jl(€€€€€€ƒšÚ#¢_¾ò3šÊK’ê–ÂÇ’â7¢÷¦/šRûš*¢÷Ž7¾ò'¾òh(€€€€€€ƒ–:šr³¦g¢Ž‡–>«žr-Í­¥±±¡…¹—š¦ž:Ž–º3–£šÊH(€€€€€€ƒšª‹š~—š«ž&¥MC–’ƒ’â7–’ƒ¾ò3š*¢÷ž¶'šZóšb¿–7¢ÊïžjŽ(€€€€€€MCžÒSžÊçšb¿¦†¿ž’ëžR£žj¢Žw¦ŽûšVã–¶_Ž((€€€€€€ƒž>û–r£–#š*+Ž3¦g¦jïš«ž&¥MC’îc–ú_¢ÖßŽ7žjš*¢ô(€€€€€€ƒš2G–ë’ú¾ò!…™™½É‘…‰±•M­¥±±%‘Ï¾ò'¾ò3–>«šr$(€€€€€€ƒš2G–ú_–ë¢Ï–ÂG’â–/’îc–ú_¢Ößžjš*¢÷¾ò3š&7šržržj(€€€€€€ƒ¦ªÃš¦ž:šÆë–ºk¢š’â7¢ššRûš*¢÷¾òmMC’â7–’ƒžjš*¢ô(€€€€€€ƒ’â7šr¢Š¯¦ã–"Ã¾ò1MCšVÓ–/¢š/–êWžj¢¦Ç–ÂÇžnÓš:”(€€€€€€ƒšRçšf»¦kšRïšN+¾ò3¢Þž:§–ºÛŽ1MC’â7¢ÚÏ¢«–.WšRçžR (€€€€€€ƒšf»¦kšRïšN+Ž7šb¿–B3’âž¢»¢†3ž
ëŽ(€€€€¨¼((€€€½¹ÍÐ¡…ÍY¥Í¥‰±•!½ÍÑ¥±•AÉ¥µ…Éäõ•Ñá¥ÍÑ¥¹A…ÉÑå%¹‘•á•Ì ¤¹Í½µ”¡¥¹‘•àôø(€€€€€€€…¹M•±•Ñ!½ÍÑ¥±•	…ÑÑ±•AÉ¥µ…Éä ‰Á±…å•Èˆ±¥¹‘•à°‰Í¥¹±”ˆ¤(€€€€¤ì((€€€½¹ÍÐ…™™½É‘…‰±•M­¥±±%‘Ìô((€€€€€€€ÉÉ…ä¹¥ÍÉÉ…ä¡µ½¹ÍÑ•È¹Í­¥±±%‘Ì¤(€€€€€€€€ü(€€€€€€€µ½¹ÍÑ•È¹Í­¥±±%‘Ì¹™¥±Ñ•È (€€€€€€€€€€€Í­¥±±%ôùì((€€€€€€€€€€€€€€€½¹ÍÐ‘…Ñ„ô(€€€€€€€€€€€€€€€€€€€Í­¥±±…Ñ…‰…Í•mÍ­¥±±%‘tì(((€€€€€€€€€€€€€€€¥˜ …‘…Ñ…ññµ½¹ÍÑ•È¹ÍÀñ‘…Ñ„¹ÍÁ½ÍÐ¥ìÉ•ÑÕÉ¸™…±Í”ìô(€€€€€€€€€€€€€€€½¹ÍÐ‘…Ñ…1•Ù•°õ5…Ñ ¹µ¥¸ (€€€€€€€€€€€€€€€€€€€‘…Ñ„¹µ…á1•Ù•±ñðÄ°(€€€€€€€€€€€€€€€€€€€5…Ñ ¹µ…à (€€€€€€€€€€€€€€€€€€€€€€€€Ä°(€€€€€€€€€€€€€€€€€€€€€€€9Õµ‰•È¹¥Í¥¹¥Ñ”¡9Õµ‰•È¡µ½¹ÍÑ•È¹ØÄÐÅ½É•M­¥±±1•Ù•°¤¤(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ý5…Ñ ¹™±½½È¡9Õµ‰•È¡µ½¹ÍÑ•È¹ØÄÐÅ½É•M­¥±±1•Ù•°¤¤(€€€€€€€€€€€€€€€€€€€€€€€€€€€€é5…Ñ ¹É½Õ¹¡µ½¹ÍÑ•È¹±•Ù•°¼à¤(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€½¹ÍÐÑ…É•ÑQåÁ”õ¹½Éµ…±¥é•	…ÑÑ±•Q…É•ÑQåÁ”¡•Ñ™™•Ñ¥Ù•M­¥±±Q…É•ÑQåÁ”¡‘…Ñ„±‘…Ñ…1•Ù•°¤¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸Ñ…É•ÑQåÁ”ôôô‰…±°‰ññ¡…ÍY¥Í¥‰±•!½ÍÑ¥±•AÉ¥µ…Éäì((€€€€€€€€€€€ô(€€€€€€€€¤(€€€€€€€€è(€€€€€€€mtì(((€€€½¹ÍÐ™½É•‘ÑÑ…­M­¥±±%õµ½¹ÍÑ•È¹ØÄÜÕ½É•‘ÑÑ…­M­¥±±%ì(€€€½¹ÍÐ™½É•‘ÑÑ…­%Í1•…°õ…™™½É‘…‰±•M­¥±±%‘Ì¹¥¹±Õ‘•Ì¡™½É•‘ÑÑ…­M­¥±±%¤ì(€€€‘•±•Ñ”µ½¹ÍÑ•È¹ØÄÜÕ½É•‘ÑÑ…­M­¥±±%ì(€€€½¹ÍÐÕÍ•ÍM­¥±°ô(€€€€€€€™½É•‘ÑÑ…­%Í1•…±ñð (€€€€€€€€€€€…™™½É‘…‰±•M­¥±±%‘Ì¹±•¹Ñ øÀ€˜˜(€€€€€€€€€€€5…Ñ ¹É…¹‘½´ ¤ð(€€€€€€€€€€€€ (€€€€€€€€€€€€€€€µ½¹ÍÑ•È¹Í­¥±±¡…¹”„ôõÕ¹‘•™¥¹•(€€€€€€€€€€€€€€€€ýµ½¹ÍÑ•È¹Í­¥±±¡…¹”(€€€€€€€€€€€€€€€€èÀ(€€€€€€€€€€€€¤(€€€€€€€€¤ì(((€€€±•Ð…ÍÑM­¥±±%õ¹Õ±°ì((€€€±•Ð…ÍÑM­¥±±9…µ”õ¹Õ±°ì((€€€±•Ð…ÍÑM­¥±±…Ñ„õ¹Õ±°ì(((€€€¥˜¡ÕÍ•ÍM­¥±°¥ì((€€€€€€€…ÍÑM­¥±±%õ™½É•‘ÑÑ…­%Í1•…°(€€€€€€€€€€€€ý™½É•‘ÑÑ…­M­¥±±%(€€€€€€€€€€€€é…™™½É‘…‰±•M­¥±±%‘Ím5…Ñ ¹™±½½È¡5…Ñ ¹É…¹‘½´ ¤©…™™½É‘…‰±•M­¥±±%‘Ì¹±•¹Ñ ¥tì(((€€€€€€€…ÍÑM­¥±±…Ñ„ô(€€€€€€€€€€€Í­¥±±…Ñ…‰…Í•m…ÍÑM­¥±±%‘tì(((€€€€€€€…ÍÑM­¥±±9…µ”ô((€€€€€€€€€€€…ÍÑM­¥±±…Ñ„(€€€€€€€€€€€€ü(€€€€€€€€€€€…ÍÑM­¥±±…Ñ„¹¹…µ”(€€€€€€€€€€€€è(€€€€€€€€€€€…ÍÑM­¥±±%ì(((€€€€€€€€¼¨(€€€€€€€€€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò1MCžržj¢š(€€€€€€€€€€ƒ¢Š¯š&š:'¾ò'¾òk¢Þž:§–ºÛšZ÷šRûš*¢÷’âš¢¾ò0(€€€€€€€€€€ƒšRû’â/–:ï–ÂÇžržjš&¢†šŠw’â/¦v‹¦
šŠuMC¾ò0(€€€€€€€€€€ƒ’â7šb¿–>«šr'žV¯¦v‹šVã–¶_–.WŽ–¾›¦jo¦
?¢ò¿šÊK–.WŽ(€€€€€€€€¨¼((€€€€€€€¥˜¡…ÍÑM­¥±±…Ñ„¥ì((€€€€€€€€€€€µ½¹ÍÑ•È¹ÍÀô((€€€€€€€€€€€€€€€5…Ñ ¹µ…à (€€€€€€€€€€€€€€€€€€€€À°(€€€€€€€€€€€€€€€€€€€µ½¹ÍÑ•È¹ÍÀ´(€€€€€€€€€€€€€€€€€€€…ÍÑM­¥±±…Ñ„¹ÍÁ½ÍÐ(€€€€€€€€€€€€€€€€¤ì((€€€€€€€ô(((€€€€€€€€¼¨(€€€€€€€€€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3¢Þž:§–ºØ(€€€€€€€€€€ƒšZ÷šRûš*¢÷’âš¢¾ò3š«ž&§šZ÷šRûš*¢÷šf’æ¢š(€€€€€€€€€€ƒ¢ÞÏ–ëš*¢÷–B7ž¢Ç¾ò'¾òh(€€€€€€€€€€ƒ–žÒƒ¦†{–"—–«–#žR£š*¢÷šr³¢ê¯žj•±•µ•¹Ð(€€€€€€€€€€ƒ¾ò#¢Þž:§–ºÛš*¢÷–ú÷ž®ƒžR£žjšb¿–B3’â––\(€€€€€€€€€€‰…‘”µ™¥É”½‰…‘”µÝ…Ñ•Ëš¢–ò?¾ò'¾ò0(€€€€€€€€€€ƒš*¢÷¢ÎšZgš~—’â7–"Ãžj¢¦Ç¦–n{žR£š«ž&¤(€€€€€€€€€€ƒ¢«–ÞÇžj•±•µ•¹Ó¾ò3žŠë’þw’â–ºkšr'š¢–ò<(€€€€€€€€€€ƒ–>¿’î—––_žR£Ž(€€€€€€€€¨¼((€€€ô(((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3Ž3š«ž&§š‚çšr°(€€€€€€ƒšÊKšr'žržj¦/šRûš*¢÷Ž7ŠSŠS¦g–/–V?¦†3šb¿žržj¾ò0(€€€€€€ƒ’â7šb¿¢ª“šr¾ò'¾òh((€€€€€€ƒ–:šr³¦g¢Ž‡’â7žº‡šRûžjšb¿–N«–/š*¢÷¾ò3’â–ú/––_žR (€€€€€€ƒ–në–ºhÄ¸Ï–7–
ß–ºÏ’þšVã¾ò3š*¢÷šr³¢ê¯–r (€€€€€€Í­¥±±…Ñ…‰…Í—¢Ž‡–ºkžú§žj‰…Í•…µ…—¾ò<(€€€€€€‘…µ…•A•É1•Ù•³–º3–£šÊK¢Š¯žR£–"Ã¾ò3–>«šr$(€€€€€€ƒ–B7ž¢Ç¦†¿ž’ëšb¿žržj¾òo¢1Ñ…É•ÑQåÁ”è‰ÑÉ¤ˆ(€€€€€€ƒ¾ò#ž¯žº´¿šÂÓžB¢†O¦g¦†{’â'¦7žn»š¢gš*¢÷¾ò$(€€€€€€ƒ–¾›¦jo’â+’æ–>«šrš&O’â·’â–/¦j£š¦žn»š¢g¾ò0(€€€€€€ƒ¢Þž:§–ºÛ’öÿžR£–B3’â–/š*¢÷šfŽ3š&O’â´¿–Þ˜¿–>Ì(€€€€€€ƒ’â'–/žn»š¢gŽ7žjšV#šzs–º3–£’â7’âš¢Ž((€€€€€€ƒ¦g¢Ž‡¦7šZÃ¢¢·¢¢#¾òh(€€€€€€€Ä¸ƒš*¢÷–
ß–ºÏšRçš"Aµ½¹ÍÑ•È¹…ÑÑ…¯–*ƒ’â((€€€€€€€€€ƒš*¢÷¢«–ÞÇžj‰…Í•…µ…”½‘…µ…•A•É1•Ù•°(€€€€€€€€€ƒ¾ò#’úwš«ž&§ž¶'žÒkš>ožº_–ë’â–/–B#žBžjš*¢ô(€€€€€€€€€ƒž¶'žÒk¾ò3ž¶'žÒk¢Ú+¦®cžjš«ž&§Žš*¢÷ž¶'žÒh(€€€€€€€€€ƒ’æ¢Ú+¦®c¾ò'¾ò3’â7–B3š*¢÷šrš&O–ëžržj’â7–B0(€€€€€€€€€ƒžj–
ß–ºÏ¾ò3’â7šb¿žÖÇ’â’æ`Ä¸ÏŽ(€€€€€€€È¸Ñ…É•ÑQåÁ”ôôô‰ÑÉ¤‹¾ò<‰É½Ü‹¾ò<‰½±Õµ¸ˆƒ–þ¦‚#žRÄ(€€€€€€€€€ƒ–në–ºkš"Ã–‚ÐM±½Ð½Ý¹•Èƒ’úw–¾›¦jo–&7–ú3š:K¢"š²’ö7¦ã–>[¾ò0(€€€€€€€€€ƒ’â7¢÷š*+ž¾–r7š*¢÷–ßš>oš"C–‚Ó’â+š&šr'–¶cšÒï¢žK¢&ËŽ(€€€€€€€Ì¸ƒš¾?–/žn»š¢g–B¢«ž6£ž®/šNË–F÷’â´¿ž"šN+¾ò0(€€€€€€€€€ƒšÊK–F÷’â·žjžŸš¢¦†¿ž’é5%MOŽšr'–F÷’â·žj(€€€€€€€€€ƒš¶–âãš&¢†¾ò3¢Þ–:šr³–Z»¦®SšRïšN+žj–F#ž>ø(€€€€€€€€€ƒšZç–ò?’â¢Ó¾ò3–>«šb¿–>¿¢÷–B3šfžfóžR–r (€€€€€€€€€ƒ–§–/¢žK¢&Ë¢ê¯’â+Ž(€€€€¨¼((€€€½¹ÍÐ•™™•Ñ¥Ù•M­¥±±1•Ù•°ô(€€€€€€€…ÍÑM­¥±±…Ñ„(€€€€€€€€ý5…Ñ ¹µ¥¸ (€€€€€€€€€€€…ÍÑM­¥±±…Ñ„¹µ…á1•Ù•±ñðÄ°(€€€€€€€€€€€5…Ñ ¹µ…à (€€€€€€€€€€€€€€€€Ä°(€€€€€€€€€€€€€€€9Õµ‰•È¹¥Í¥¹¥Ñ”¡9Õµ‰•È¡µ½¹ÍÑ•È¹ØÄÐÅ½É•M­¥±±1•Ù•°¤¤(€€€€€€€€€€€€€€€€€€€€ý5…Ñ ¹™±½½È¡9Õµ‰•È¡µ½¹ÍÑ•È¹ØÄÐÅ½É•M­¥±±1•Ù•°¤¤(€€€€€€€€€€€€€€€€€€€€é5…Ñ ¹É½Õ¹¡µ½¹ÍÑ•È¹±•Ù•°¼à¤(€€€€€€€€€€€€¤(€€€€€€€€¤(€€€€€€€€èÀì((€€€½¹ÍÐÍ­¥±±Q…É•ÑQåÁ”õÕÍ•ÍM­¥±°˜™…ÍÑM­¥±±…Ñ„(€€€€€€€€ý•Ñ™™•Ñ¥Ù•M­¥±±Q…É•ÑQåÁ”¡…ÍÑM­¥±±…Ñ„±•™™•Ñ¥Ù•M­¥±±1•Ù•°¤(€€€€€€€€è‰Í¥¹±”ˆì((€€€½¹ÍÐ¥ÍI…¹•M­¥±°õl‰ÑÉ¤ˆ°‰É½Üˆ°‰½±Õµ¸ˆ°‰…±°‰t¹¥¹±Õ‘•Ì¡Í­¥±±Q…É•ÑQåÁ”¤ì((€€€½¹ÍÐ±¥Ù¥¹Q…É•ÑÌõ•Ñá¥ÍÑ¥¹A…ÉÑå%¹‘•á•Ì ¤(€€€€€€€€¹µ…À¡¥¹‘•àôø¡ì(€€€€€€€€€€€¡…É…Ñ•Èé•ÑA…ÉÑå¡…É…Ñ•É	å%¹‘•à¡¥¹‘•à¤°(€€€€€€€€€€€ÍÑ…ÑÌé•ÑA…ÉÑå	…ÑÑ±•MÑ…ÑÌ¡¥¹‘•à¤°(€€€€€€€€€€€¥¹‘•àé¥¹‘•à(€€€€€€€ô¤¤(€€€€€€€€¹™¥±Ñ•È¡•¹ÑÉäôù•¹ÑÉä¹¡…É…Ñ•È€˜˜•¹ÑÉä¹¡…É…Ñ•È¹¡ÀøÀ¤ì((€€€€¼¨MÑ•…±Ñ ‰±½­ÌÁÉ¥µ…ÉäÍ•±•Ñ¥½¸™½È•Ù•ÉäÑ…É•Ñ•¡½ÍÑ¥±”Í¡…Á”¸(€€€€€€I…¹”Í­¥±±ÌÍÑ¥±°¥¹±Õ‘”ÍÑ•…±Ñ¡•Õ¹¥ÑÌÝ¡•¸Ñ¡•ä…É”½±±…Ñ•É…°¸€¨¼(€€€½¹ÍÐÍ•±•Ñ…‰±•AÉ¥µ…ÉåQ…É•ÑÌõ±¥Ù¥¹Q…É•ÑÌ¹™¥±Ñ•È¡•¹ÑÉäôø(€€€€€€€…¹M•±•Ñ!½ÍÑ¥±•	…ÑÑ±•AÉ¥µ…Éä ‰Á±…å•Èˆ±•¹ÑÉä¹¥¹‘•à±Í­¥±±Q…É•ÑQåÁ”¤(€€€€¤ì((€€€¥˜¡Í­¥±±Q…É•ÑQåÁ”„ôô‰…±°ˆ˜™Í•±•Ñ…‰±•AÉ¥µ…ÉåQ…É•ÑÌ¹±•¹Ñ ôôôÀ¥ì(€€€€€€€…‘‘	…ÑÑ±•1½œ¡µ½¹ÍÑ•È¹¹…µ”¬‹š&û’â7–"Ã–>¿¢Š¯š¶“šRïšN+¦ã’â·žjžn»š¢gŽˆ¤ì(€€€€€€€ÕÁ‘…Ñ•U$ ¤ì(€€€€€€€™¥¹¥Í¡A±…å•ÉÑ¥½¸ ¤ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô((€€€±•Ð…ÑÑ…­Q…É•ÑÌõmtì(€€€±•ÐÁÉ¥µ…ÉåQ…É•Ñ%¹‘•àõ¹Õ±°ì((€€€¥˜¡Í­¥±±Q…É•ÑQåÁ”ôôô‰…±°ˆ¥ì(€€€€€€€…ÑÑ…­Q…É•ÑÌõ±¥Ù¥¹Q…É•ÑÌì(€€€õ•±Í•ì(€€€€€€€½¹ÍÐÁÉ¥µ…ÉäõÍ•±•Ñ…‰±•AÉ¥µ…ÉåQ…É•ÑÍl(€€€€€€€€€€€5…Ñ ¹™±½½È¡5…Ñ ¹É…¹‘½´ ¤©Í•±•Ñ…‰±•AÉ¥µ…ÉåQ…É•ÑÌ¹±•¹Ñ ¤(€€€€€€€tì(€€€€€€€ÁÉ¥µ…ÉåQ…É•Ñ%¹‘•àõÁÉ¥µ…ÉäýÁÉ¥µ…Éä¹¥¹‘•àé¹Õ±°ì(€€€€€€€½¹ÍÐÑ…É•Ñ%¹‘•á•ÌõÁÉ¥µ…Éä(€€€€€€€€€€€€ýÉ•Í½±Ù•	…ÑÑ±•™¥•±‘Q…É•ÑÌ ‰Á±…å•Èˆ±ÁÉ¥µ…Éä¹¥¹‘•à±Í­¥±±Q…É•ÑQåÁ”±í¡½ÍÑ¥±•AÉ¥µ…ÉäéÑÉÕ•ô¤(€€€€€€€€€€€€émtì(€€€€€€€…ÑÑ…­Q…É•ÑÌõÑ…É•Ñ%¹‘•á•Ì¹µ…À¡¥¹‘•àôø(€€€€€€€€€€€±¥Ù¥¹Q…É•ÑÌ¹™¥¹¡•¹ÑÉäôù•¹ÑÉä¹¥¹‘•àôôõ¥¹‘•à¤(€€€€€€€€¤¹™¥±Ñ•È¡	½½±•…¸¤ì(€€€ô((€€€¥˜¡…ÑÑ…­Q…É•ÑÌ¹±•¹Ñ ôôôÀ¥ì(€€€€€€€…‘‘	…ÑÑ±•1½œ¡µ½¹ÍÑ•È¹¹…µ”¬‹š&û’â7–"Ã–>¿¢Š¯š¶“š*¢÷¦ã’â·žjžn»š¢gŽˆ¤ì(€€€€€€€ÕÁ‘…Ñ•U$ ¤ì(€€€€€€€™¥¹¥Í¡A±…å•ÉÑ¥½¸ ¤ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô((€€€½¹ÍÐ…ÑÑ…­Q…É•Ñ%¹‘•á•Ìõ…ÑÑ…­Q…É•ÑÌ¹µ…À¡Ñ…É•ÐôùÑ…É•Ð¹¥¹‘•à¤ì(€€€¥˜¡ÕÍ•ÍM­¥±°¥ì(€€€€€€€Í¡½Ý5½¹ÍÑ•ÉM­¥±±9…µ•	…‘” (€€€€€€€€€€€…ÍÑM­¥±±9…µ”°(€€€€€€€€€€€€¡…ÍÑM­¥±±…Ñ„˜™…ÍÑM­¥±±…Ñ„¹•±•µ•¹Ð¥ññµ½¹ÍÑ•È¹•±•µ•¹Ññð‰¹½Éµ…°ˆ°(€€€€€€€€€€€µ½¹ÍÑ•É%¹‘•à°(€€€€€€€€€€€Í­¥±±Q…É•ÑQåÁ”ôôô‰…±°ˆý¹Õ±°éÁÉ¥µ…ÉåQ…É•Ñ%¹‘•à°(€€€€€€€€€€€…ÑÑ…­Q…É•Ñ%¹‘•á•Ì°(€€€€€€€€€€€€‰Á±…å•Èˆ°(€€€€€€€€€€€Í­¥±±Q…É•ÑQåÁ”(€€€€€€€€¤ì(€€€õ•±Í•ì(€€€€€€€Í¡½Ý5½¹ÍÑ•ÉM­¥±±9…µ•	…‘” (€€€€€€€€€€€€‹šf»¦kšRïšN(ˆ°‰¹½Éµ…°ˆ±µ½¹ÍÑ•É%¹‘•à±ÁÉ¥µ…ÉåQ…É•Ñ%¹‘•à±…ÑÑ…­Q…É•Ñ%¹‘•á•Ì(€€€€€€€€¤ì(€€€ô(((€€€€¼¨(€€€€€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3š«ž&§žR£ž¯žº´(€€€€€€ƒšRïšN+ž:§–ºÛšf¾ò3’æ¢ššr'’â'žfó¦Žo¢†3ž&çšV#¾ò0(€€€€€€ƒšZç–BGžnã–>7¾òk–ú{š«ž&§–6‡ž&¦Žo–BGž:§–ºÛ–6‡ž&¾ò'Ž(€€€€¨¼((€€€¥˜¡…ÍÑM­¥±±%ôôô‰™¥É•I½­•Ðˆ¥ì((€€€€€€€Á±…å¥É•I½­•Ñ¹¥µ…Ñ¥½¸ (€€€€€€€€€€€€‰‰…ÑÑ±•5½¹ÍÑ•Èˆ­µ½¹ÍÑ•É%¹‘•à°(€€€€€€€€€€€…ÑÑ…­Q…É•ÑÌ¹µ…À (€€€€€€€€€€€€€€€Ñ…É•Ðôø(€€€€€€€€€€€€€€€€€€€€‰‰…ÑÑ±•A±…å•É…Éˆ¬(€€€€€€€€€€€€€€€€€€€Ñ…É•Ð¹¥¹‘•à(€€€€€€€€€€€€¤(€€€€€€€€¤ì((€€€ô(((€€€€¼¨(€€€€€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3ž&§žB¿šÎW¢†L(€€€€€€ƒ–"¦Z/žº_¾ò3–º3–£š¾SžŸž:§–ºÙ…ÍÑ…µ…•M­¥±° ¤(€€€€€€ƒžj¢š?–&¾òiÍ­¥±°¹…Ñ•½Éäôôô‰µ…¥Œ‹žR (€€€€€€ƒšÎW¢†OšRïšN+¾ò3–Û¦’c¾ò#–B¯šÊKšRûš*¢÷žjšf»¦h(€€€€€€ƒšRïšN+¾ò'žR£’â¢"³šRïšN+–*o¾ò'¾òh(€€€€¨¼((€€€€¼¨AÕÉ”µ½¹ÑÉ½°Í­¥±±Ì­••ÀÑ¡•¥ÈÍÑ…ÑÕÌ•™™•Ð‰ÕÐ¹•Ù•È•¹Ñ•È‘¥É•Ðµ‘…µ…”Í•ÑÑ±•µ•¹Ð¸€¨¼(€€€½¹ÍÐ¥ÍAÕÉ•½¹ÑÉ½±M­¥±°ô(€€€€€€€€„„¡…ÍÑM­¥±±…Ñ„€˜˜…ÍÑM­¥±±…Ñ„¹¥ôôô‰™É••é”ˆ¤ì((€€€½¹ÍÐ¥Í5½¹ÍÑ•É5…¥M­¥±°ô(€€€€€€€…ÍÑM­¥±±…Ñ„€˜˜(€€€€€€€…ÍÑM­¥±±…Ñ„¹…Ñ•½Éäôôô‰µ…¥Œˆì((€€€½¹ÍÐ‰…Í•ÑÑ…­MÑ…ÑI…Üô(€€€€€€€¥Í5½¹ÍÑ•É5…¥M­¥±°(€€€€€€€€üµ½¹ÍÑ•È¹µ…¥ÑÑ…¬(€€€€€€€€èµ½¹ÍÑ•È¹…ÑÑ…¬ì((€€€½¹ÍÐ½™™•¹Í¥Ù•MÑ…Ñ½Ý¸ô(€€€€€€€•ÑMÑ…Ñ½Ý¹A•É•¹Ñ½È (€€€€€€€€€€€µ½¹ÍÑ•È°(€€€€€€€€€€€¥Í5½¹ÍÑ•É5…¥M­¥±°€ü€‰¥¹Ñ•±±¥•¹”ˆ€è€‰…ÑÑ…¬ˆ(€€€€€€€€¤ì((€€€½¹ÍÐ‰…Í•ÑÑ…­MÑ…Ðô(€€€€€€€‰…Í•ÑÑ…­MÑ…ÑI…Ü¨ Äµ½™™•¹Í¥Ù•MÑ…Ñ½Ý¸¼ÄÀÀ¤ì(((€€€±•Ðµ½¹ÍÑ•É1¥™•ÍÑ•…±…µ…”ôÀì(((€€€…ÑÑ…­Q…É•ÑÌ¹™½É…  (€€€€€€€Ñ…É•Ñ¹ÑÉäôùì((€€€€€€€€€€€½¹ÍÐÑ…É•Ñ¡…É…Ñ•Èô(€€€€€€€€€€€€€€€Ñ…É•Ñ¹ÑÉä¹¡…É…Ñ•Èì((€€€€€€€€€€€½¹ÍÐÑ…É•ÑMÑ…ÑÌô(€€€€€€€€€€€€€€€Ñ…É•Ñ¹ÑÉä¹ÍÑ…ÑÌì((€€€€€€€€€€€½¹ÍÐÑ…É•Ñ%¹‘•àô(€€€€€€€€€€€€€€€Ñ…É•Ñ¹ÑÉä¹¥¹‘•àì(((€€€€€€€€€€€¥˜¡¥ÍAÕÉ•½¹ÑÉ½±M­¥±°¥ì(€€€€€€€€€€€€€€€½¹ÍÐ™É••é•¡…¹”õ•ÑM­¥±±É••é•¡…¹•Ñ1•Ù•°¡…ÍÑM­¥±±…Ñ„±•™™•Ñ¥Ù•M­¥±±1•Ù•°¤ì(€€€€€€€€€€€€€€€½¹ÍÐ™É••é•ÕÉ…Ñ¥½¸õ•ÑM­¥±±É••é•ÕÉ…Ñ¥½¹Ñ1•Ù•°¡…ÍÑM­¥±±…Ñ„±•™™•Ñ¥Ù•M­¥±±1•Ù•°¤ì(€€€€€€€€€€€€€€€½¹ÍÐÑ…É•Ñ¥¹…±MÁ¥É¥Ðõ•Ñ¥¹…±	…ÑÑ±•MÁ¥É¥Ñ½ÉA±…å•ÉQ…É•Ð¡Ñ…É•Ñ¡…É…Ñ•È±Ñ…É•Ñ%¹‘•à¤ì(€€€€€€€€€€€€€€€½¹ÍÐ™É••é•I•ÍÕ±ÐõÉ½±±9…µ•‘A•ÉÍ¥ÍÑ•¹ÑMÑ…ÑÕÍ™™•Ð (€€€€€€€€€€€€€€€€€€€Ñ…É•Ñ¡…É…Ñ•È°‰™É••é”ˆ±l(€€€€€€€€€€€€€€€€€€€€€€€™É••é•¡…¹”±µ½¹ÍÑ•È¹±•Ù•°±Ñ…É•Ñ¡…É…Ñ•È¹±•Ù•°°(€€€€€€€€€€€€€€€€€€€€€€€•Ñ5½¹ÍÑ•É™™•Ñ¥Ù•‰¥±¥ÑåA½¥¹ÑÌ¡µ½¹ÍÑ•È°‰¥¹Ñ•±±¥•¹”ˆ¤°(€€€€€€€€€€€€€€€€€€€€€€€Ñ…É•Ñ¥¹…±MÁ¥É¥Ð±ÑÉÕ”°‰Á±…å•Èˆ±•ÑA±…å•ÉMÑ…ÑÕÍI•Í¥ÍÑ	½¹ÕÌ¡Ñ…É•Ñ¡…É…Ñ•È¤(€€€€€€€€€€€€€€€€€€€t°‰Á±…å•Èˆ±Ñ…É•Ñ%¹‘•à±…ÍÑM­¥±±9…µ”(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€¥˜¡™É••é•I•ÍÕ±Ð¹¡¥Ð¥ì(€€€€€€€€€€€€€€€€€€€…ÁÁ±åÉ••é•™™•Ð¡Ñ…É•Ñ¡…É…Ñ•È±™É••é•ÕÉ…Ñ¥½¸¤ì(€€€€€€€€€€€€€€€€€€€…‘‘	…ÑÑ±•1½œ ¡Ñ…É•Ñ¡…É…Ñ•È¹¥‘ñð‹’ö€ˆ¤¬‹¢Š¯–Ã–Â’ê¾òˆ¤ì(€€€€€€€€€€€€€€€õ•±Í”¥˜ …™É••é•I•ÍÕ±Ð¹‘ÕÁ±¥…Ñ”¥ì(€€€€€€€€€€€€€€€€€€€Í¡½Ý5¥ÍÍ™™•Ð¡ÑÉÕ”±Ñ…É•Ñ%¹‘•à°‹š*×š*\ˆ¤ì(€€€€€€€€€€€€€€€€€€€…‘‘	…ÑÑ±•1½œ¡…ÍÑM­¥±±9…µ”¬‹–Â4ˆ¬¡Ñ…É•Ñ¡…É…Ñ•È¹¥‘ñð‹’ö€ˆ¤¬‹šÊKšr'žRšV#¾ò#š*×š*_¾ò'Žˆ¤ì(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€€€€€ô(((€€€€€€€€€€€½¹ÍÐµ½¹ÍÑ•É!¥Ðô(€€€€€€€€€€€€€€€É½±±!¥Ñ¡…¹” (€€€€€€€€€€€€€€€€€€€•Ñ5½¹ÍÑ•ÉÕÉ…ä (€€€€€€€€€€€€€€€€€€€€€€€µ½¹ÍÑ•È(€€€€€€€€€€€€€€€€€€€€¤°(€€€€€€€€€€€€€€€€€€€Ñ…É•ÑMÑ…ÑÌ¹•Ù…Í¥½¸°(€€€€€€€€€€€€€€€€€€€•Ñ5½¹ÍÑ•É•‰Õ™™Y…±Õ” (€€€€€€€€€€€€€€€€€€€€€€€µ½¹ÍÑ•È°(€€€€€€€€€€€€€€€€€€€€€€€€‰ÍÑÕ¸ˆ(€€€€€€€€€€€€€€€€€€€€¤°(€€€€€€€€€€€€€€€€€€€•ÑÑ¥Ù•ÕÉ…å	½¹ÕÍA•É•¹Ð¡µ½¹ÍÑ•È¤(€€€€€€€€€€€€€€€€¤ì(((€€€€€€€€€€€¥˜ …µ½¹ÍÑ•É!¥Ð¥ì((€€€€€€€€€€€€€€€Í¡½Ý5¥ÍÍ™™•Ð (€€€€€€€€€€€€€€€€€€€ÑÉÕ”°(€€€€€€€€€€€€€€€€€€€Ñ…É•Ñ%¹‘•à°(€€€€€€€€€€€€€€€€€€€€‰5%MLˆ(€€€€€€€€€€€€€€€€¤ì(((€€€€€€€€€€€€€€€…‘‘	…ÑÑ±•1½œ ((€€€€€€€€€€€€€€€€€€€€ˆˆ¬(€€€€€€€€€€€€€€€€€€€µ½¹ÍÑ•È¹¹…µ”¬(€€€€€€€€€€€€€€€€€€€€ˆˆ¬(€€€€€€€€€€€€€€€€€€€€ (€€€€€€€€€€€€€€€€€€€€€€€ÕÍ•ÍM­¥±°(€€€€€€€€€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€€€€€€€€€€‹šZ÷šRøˆ­…ÍÑM­¥±±9…µ”(€€€€€€€€€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€€€€€€€€€€‹šRïšN(ˆ(€€€€€€€€€€€€€€€€€€€€¤¬(€€€€€€€€€€€€€€€€€€€€ˆˆ¬(€€€€€€€€€€€€€€€€€€€€¡Ñ…É•Ñ¡…É…Ñ•È¹¥‘ñð‹’ö€ˆ¤¬(€€€€€€€€€€€€€€€€€€€€‹¾ò3šÊKšr'–F÷’â·¾òˆ((€€€€€€€€€€€€€€€€¤ì(((€€€€€€€€€€€€€€€É•ÑÕÉ¸ì((€€€€€€€€€€€ô(((€€€€€€€€€€€½¹ÍÐ¥Í	•¥¹¹•É½É•ÍÑ9½Éµ…±ÑÑ…¬ô(€€€€€€€€€€€€€€€ÕÉÉ•¹Ñi½¹”ôôô‰™½É•ÍÐˆ€˜˜(€€€€€€€€€€€€€€€€……ÍÑM­¥±±…Ñ„€˜˜(€€€€€€€€€€€€€€€µ½¹ÍÑ•È€˜˜(€€€€€€€€€€€€€€€µ½¹ÍÑ•È¹ØÄÜÍ	•¥¹¹•É½É•ÍÐôôõÑÉÕ”ì((€€€€€€€€€€€€¼¨ƒšZÃš&/šŽ»šz_šf»¦kšRïšN+šb¿šVg–¶ã’þw¢¶ß–ó¾òk’â7–Bž"šN+¾ò3šr«¦bËžš›šf–në–ºhÄÃ¾öxÄ×Ž€¨¼(€€€€€€€€€€€½¹ÍÐÉ…•É¥Ñ¥…±	½¹ÕÍ•Ìõ•ÑÑ¥Ù•I…•É¥Ñ¥…±	½¹ÕÍ•Ì¡µ½¹ÍÑ•È¤ì(€€€€€€€€€€€½¹ÍÐµ½¹ÍÑ•ÉÉ¥Ñ¡…¹”õ¥Í	•¥¹¹•É½É•ÍÑ9½Éµ…±ÑÑ…¬(€€€€€€€€€€€€€€€€üÀ(€€€€€€€€€€€€€€€€é5…Ñ ¹µ…à (€€€€€€€€€€€€€€€€€€€I%Q}!9}5%9}QI}9Q%}I%P°(€€€€€€€€€€€€€€€€€€€€ÄÀ­É…•É¥Ñ¥…±	½¹ÕÍ•Ì¹¡…¹”´¡Ñ…É•ÑMÑ…ÑÌ¹…¹Ñ¥É¥ÑñðÀ¤(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€½¹ÍÐµ½¹ÍÑ•ÉÉ¥Ðô…¥Í	•¥¹¹•É½É•ÍÑ9½Éµ…±ÑÑ…¬˜™5…Ñ ¹É…¹‘½´ ¤¨ÄÀÀñµ½¹ÍÑ•ÉÉ¥Ñ¡…¹”ì(€€€€€€€€€€€½¹ÍÐµ½¹ÍÑ•ÉÉ¥Ñ5Õ±Ñ¥Á±¥•Èõµ½¹ÍÑ•ÉÉ¥Ð(€€€€€€€€€€€€€€€€ý5…Ñ ¹µ¥¸¡I%Q}5U1Q%A1%I}5`°Ä¸Ô­É…•É¥Ñ¥…±	½¹ÕÍ•Ì¹‘…µ…”¼ÄÀÀ¤(€€€€€€€€€€€€€€€€èÄì((€€€€€€€€€€€±•Ð‘…µ…”ô(€€€€€€€€€€€€€€€¥ÍAÕÉ•½¹ÑÉ½±M­¥±°(€€€€€€€€€€€€€€€€üÀ(€€€€€€€€€€€€€€€€é¥Í	•¥¹¹•É½É•ÍÑ9½Éµ…±ÑÑ…¬(€€€€€€€€€€€€€€€€ýÉ½±±	•¥¹¹•É½É•ÍÑ9½Éµ…±ÑÑ…­…µ…” ¤(€€€€€€€€€€€€€€€€é…ÍÑM­¥±±…Ñ„(€€€€€€€€€€€€€€€€ý…±Õ±…Ñ•M­¥±±…µ…”¡ì(€€€€€€€€€€€€€€€€€€€Í­¥±°é…ÍÑM­¥±±…Ñ„°(€€€€€€€€€€€€€€€€€€€Í­¥±±1•Ù•°é•™™•Ñ¥Ù•M­¥±±1•Ù•°°(€€€€€€€€€€€€€€€€€€€•™™•Ñ¥Ù•ÑÑ…¬é‰…Í•ÑÑ…­MÑ…Ð°(€€€€€€€€€€€€€€€€€€€Ñ…É•ÐéÑ…É•Ñ¡…É…Ñ•È°(€€€€€€€€€€€€€€€€€€€Ñ…É•Ñ•™•¹Í”éÑ…É•ÑMÑ…ÑÌ¹‘•™•¹Í”°(€€€€€€€€€€€€€€€€€€€…ÍÑ•É1•Ù•°éµ½¹ÍÑ•È¹±•Ù•°°(€€€€€€€€€€€€€€€€€€€…ÍÑ•É±•µ•¹Ðéµ½¹ÍÑ•È¹•±•µ•¹Ð°(€€€€€€€€€€€€€€€€€€€…ÑÑ…­•Èéµ½¹ÍÑ•È°(€€€€€€€€€€€€€€€€€€€É¥Ñ5Õ±Ñ¥Á±¥•Èéµ½¹ÍÑ•ÉÉ¥Ñ5Õ±Ñ¥Á±¥•È(€€€€€€€€€€€€€€€ô¤(€€€€€€€€€€€€€€€€é…±Õ±…Ñ•…µ…” (€€€€€€€€€€€€€€€€€€€‰…Í•ÑÑ…­MÑ…Ð°(€€€€€€€€€€€€€€€€€€€Ñ…É•ÑMÑ…ÑÌ¹‘•™•¹Í”°(€€€€€€€€€€€€€€€€€€€µ½¹ÍÑ•È¹±•Ù•°°(€€€€€€€€€€€€€€€€€€€Ñ…É•Ñ¡…É…Ñ•È¹±•Ù•°°(€€€€€€€€€€€€€€€€€€€µ½¹ÍÑ•È¹•±•µ•¹Ð°(€€€€€€€€€€€€€€€€€€€Ñ…É•Ñ¡…É…Ñ•È¹•±•µ•¹Ð°(€€€€€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€€€€€…ÑÑ…­•Èéµ½¹ÍÑ•È°(€€€€€€€€€€€€€€€€€€€€€€€Ñ…É•ÐéÑ…É•Ñ¡…É…Ñ•È°(€€€€€€€€€€€€€€€€€€€€€€€É¥Ñ5Õ±Ñ¥Á±¥•Èéµ½¹ÍÑ•ÉÉ¥Ñ5Õ±Ñ¥Á±¥•È(€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€¤ì(((€€€€€€€€€€€¥˜¡Ñ…É•Ñ¡…É…Ñ•È¹¥Í•™•¹‘¥¹œ€˜˜‘…µ…”øÀ¥ì((€€€€€€€€€€€€€€€‘…µ…”ô(€€€€€€€€€€€€€€€€€€€5…Ñ ¹µ…à (€€€€€€€€€€€€€€€€€€€€€€€€Ä°(€€€€€€€€€€€€€€€€€€€€€€€5…Ñ ¹™±½½È (€€€€€€€€€€€€€€€€€€€€€€€€€€€‘…µ…”¨À¸Ô(€€€€€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€ô(((€€€€€€€€€€€€¼¨(€€€€€€€€€€€€€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3š:—’â((€€€€€€€€€€€€€€ƒžÖCžV0¿¢¶ßžnø¿–>7–
ß¦g–æû–/¦bËžš›¦†x(€€€€€€€€€€€€€€ƒ–Š{žn+šV#šzs¾ò'¾òh(€€€€€€€€€€€€€€ƒžÖCžV3¾ò!‰…ÉÉ¥•Ë¾ò'–º3–£š‚óšN/¾ò0(€€€€€€€€€€€€€€ƒ¦gš²‡šRïšN+žnÓš:—š¶ã¦nÛ¾ò3¦¢¶ßžnû¦ô(€€€€€€€€€€€€€€ƒ’â7žR£šÚ#¢_¾òošÊKšr'žÖCžV3žj¢¦Çš&7šª‹š~”(€€€€€€€€€€€€€€ƒ¢¶ßžnû¾ò!Í¡¥•±“¾ò'¾ò3¢¶ßžnûš2'–&§¦’`(€€€€€€€€€€€€€€ƒ¦î{šVã–BãšRÛ–
ß–ºÏ¾ò3–BãšRÛ’â7–º3žj¦£–"(€€€€€€€€€€€€€€ƒš&7šržržjš&¢†¾òoš&¢†’æ/–ú3–ššzp(€€€€€€€€€€€€€€ƒžn»š¢g¢ê¯’â+šr'–>7–
ß¾ò!•…ÉÑ¡M¡¥•±“¾ò'¾ò0(€€€€€€€€€€€€€€ƒ’úwš¾S’ú/š*+–
ß–ºÏš&O–n{š«ž&§¢ê¯’â+Ž(€€€€€€€€€€€€¨¼((€€€€€€€€€€€½¹ÍÐ¡…Í	…ÉÉ¥•Èô(€€€€€€€€€€€€€€€¡…ÍÑ¥Ù•	Õ™˜ (€€€€€€€€€€€€€€€€€€€Ñ…É•Ñ¡…É…Ñ•È°(€€€€€€€€€€€€€€€€€€€€‰‰…ÉÉ¥•Èˆ(€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€±•Ð•…ÉÑ¡M¡¥•±‘I•‘ÕÑ¥½¸ôÀì(((€€€€€€€€€€€¥˜¡‘…µ…”øÀ€˜˜¡…Í	…ÉÉ¥•È¥ì((€€€€€€€€€€€€€€€‘…µ…”ôÀì(((€€€€€€€€€€€€€€€…‘‘	…ÑÑ±•1½œ (€€€€€€€€€€€€€€€€€€€€ˆˆ¬(€€€€€€€€€€€€€€€€€€€€¡Ñ…É•Ñ¡…É…Ñ•È¹¥‘ñð‹’ö€ˆ¤¬(€€€€€€€€€€€€€€€€€€€€‹žjžÖCžV3–º3–£š‚óšN/’ê¦gš²‡šRïšN+¾òˆ(€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€ô(€€€€€€€€€€€•±Í•ì((€€€€€€€€€€€€€€€½¹ÍÐ•…ÉÑ¡M¡¥•±‘	Õ™˜ô¡Ñ…É•Ñ¡…É…Ñ•È¹…Ñ¥Ù•	Õ™™Íññmt¤¹™¥¹¡‰Õ™˜ôø(€€€€€€€€€€€€€€€€€€€‰Õ™˜˜™‰Õ™˜¹ÑåÁ”ôôô‰•…ÉÑ¡M¡¥•±ˆ˜™9Õµ‰•È¡‰Õ™˜¹ÑÕÉ¹Í1•™Ð¤øÀ˜™9Õµ‰•È¡‰Õ™˜¹É•µ…¥¹¥¹	±½­Ì¤øÀ(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€¥˜¡‘…µ…”øÀ˜™•…ÉÑ¡M¡¥•±‘	Õ™˜¥ì(€€€€€€€€€€€€€€€€€€€½¹ÍÐÁ•É•¹Ðõ5…Ñ ¹µ…à À±5…Ñ ¹µ¥¸ ÄÀÀ±9Õµ‰•È¡•…ÉÑ¡M¡¥•±‘	Õ™˜¹Á•É•¹Ð¥ñðÀ¤¤ì(€€€€€€€€€€€€€€€€€€€•…ÉÑ¡M¡¥•±‘I•‘ÕÑ¥½¸õ5…Ñ ¹µ…à À±5…Ñ ¹™±½½È¡‘…µ…”©Á•É•¹Ð¼ÄÀÀ¤¤ì(€€€€€€€€€€€€€€€€€€€‘…µ…”õ5…Ñ ¹µ…à À±‘…µ…”µ•…ÉÑ¡M¡¥•±‘I•‘ÕÑ¥½¸¤ì(€€€€€€€€€€€€€€€€€€€•…ÉÑ¡M¡¥•±‘	Õ™˜¹É•µ…¥¹¥¹	±½­Ìõ5…Ñ ¹µ…à À±9Õµ‰•È¡•…ÉÑ¡M¡¥•±‘	Õ™˜¹É•µ…¥¹¥¹	±½­Ì¤´Ä¤ì(€€€€€€€€€€€€€€€€€€€¥˜¡•…ÉÑ¡M¡¥•±‘	Õ™˜¹É•µ…¥¹¥¹	±½­ÌðôÀ¥ì(€€€€€€€€€€€€€€€€€€€€€€€Ñ…É•Ñ¡…É…Ñ•È¹…Ñ¥Ù•	Õ™™ÌõÑ…É•Ñ¡…É…Ñ•È¹…Ñ¥Ù•	Õ™™Ì¹™¥±Ñ•È¡‰Õ™˜ôù‰Õ™˜„ôõ•…ÉÑ¡M¡¥•±‘	Õ™˜¤ì(€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€½¹ÍÐÍ¡¥•±‘	Õ™˜ô((€€€€€€€€€€€€€€€€€€€€¡Ñ…É•Ñ¡…É…Ñ•È¹…Ñ¥Ù•	Õ™™Íññmt¤(€€€€€€€€€€€€€€€€€€€€¹™¥¹ (€€€€€€€€€€€€€€€€€€€€€€€ˆôø((€€€€€€€€€€€€€€€€€€€€€€€€€€€ˆ¹ÑåÁ”ôôô‰Í¡¥•±ˆ˜˜(€€€€€€€€€€€€€€€€€€€€€€€€€€€ˆ¹ÑÕÉ¹Í1•™ÐøÀ€˜˜(€€€€€€€€€€€€€€€€€€€€€€€€€€€ˆ¹É•µ…¥¹¥¹œøÀ((€€€€€€€€€€€€€€€€€€€€¤ì(((€€€€€€€€€€€€€€€¥˜¡‘…µ…”øÀ€˜˜Í¡¥•±‘	Õ™˜¥ì((€€€€€€€€€€€€€€€€€€€½¹ÍÐ…‰Í½É‰•ô((€€€€€€€€€€€€€€€€€€€€€€€5…Ñ ¹µ¥¸ (€€€€€€€€€€€€€€€€€€€€€€€€€€€‘…µ…”°(€€€€€€€€€€€€€€€€€€€€€€€€€€€Í¡¥•±‘	Õ™˜¹É•µ…¥¹¥¹œ(€€€€€€€€€€€€€€€€€€€€€€€€¤ì(((€€€€€€€€€€€€€€€€€€€Í¡¥•±‘	Õ™˜¹É•µ…¥¹¥¹œ´ô(€€€€€€€€€€€€€€€€€€€€€€€…‰Í½É‰•ì((€€€€€€€€€€€€€€€€€€€‘…µ…”´ô(€€€€€€€€€€€€€€€€€€€€€€€…‰Í½É‰•ì(((€€€€€€€€€€€€€€€€€€€¥˜¡…‰Í½É‰•øÀ¥ì((€€€€€€€€€€€€€€€€€€€€€€€…‘‘	…ÑÑ±•1½œ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€‹¢¶ßžnû–BãšRÛ’êˆ¬(€€€€€€€€€€€€€€€€€€€€€€€€€€€…‰Í½É‰•¬(€€€€€€€€€€€€€€€€€€€€€€€€€€€€‹¦î{–
ß–ºÏ¾ò#–&§¦’`ˆ¬(€€€€€€€€€€€€€€€€€€€€€€€€€€€Í¡¥•±‘	Õ™˜¹É•µ…¥¹¥¹œ¬(€€€€€€€€€€€€€€€€€€€€€€€€€€€€‹¦î{¾ò'Žˆ(€€€€€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€€€€€€€€€Í¡½ÝM¡¥•±‘‰Í½Éˆ (€€€€€€€€€€€€€€€€€€€€€€€€€€€Ñ…É•Ñ%¹‘•à°(€€€€€€€€€€€€€€€€€€€€€€€€€€€…‰Í½É‰•(€€€€€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€ô((€€€€€€€€€€€ô(((€€€€€€€€€€€½¹ÍÐ¡Á	•™½É•¥É•Ñ…µ…”õ5…Ñ ¹µ…à À±9Õµ‰•È¡Ñ…É•Ñ¡…É…Ñ•È¹¡À¥ñðÀ¤ì((€€€€€€€€€€€Ñ…É•Ñ¡…É…Ñ•È¹¡Àô(€€€€€€€€€€€€€€€5…Ñ ¹µ…à (€€€€€€€€€€€€€€€€€€€€À°(€€€€€€€€€€€€€€€€€€€Ñ…É•Ñ¡…É…Ñ•È¹¡À´(€€€€€€€€€€€€€€€€€€€‘…µ…”(€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€½¹ÍÐ…ÑÕ…±!Á…µ…”õ5…Ñ ¹µ…à À±¡Á	•™½É•¥É•Ñ…µ…”µÑ…É•Ñ¡…É…Ñ•È¹¡À¤ì(((€€€€€€€€€€€€¼¨(€€€€€€€€€€€€€€ƒŠbƒ–>7–
ß¾ò#¢B³¢Æ‡–ržnû¾ò=•…ÉÑ¡M¡¥•±“¾ò'¾òh(€€€€€€€€€€€€€€ƒš&–º3¢†’æ/–ú3š&7žº_¾ò3¦ÿ–7žÖCžV0¿¢¶ßžnø(€€€€€€€€€€€€€€ƒšN/’â/žj¦£–"’æ¢Š¯¢ª“žº_¦Ë–>7–
ß¢Ž‡Ž(€€€€€€€€€€€€¨¼((€€€€€€€€€€€¥˜¡•…ÉÑ¡M¡¥•±‘I•‘ÕÑ¥½¸øÀ¥ì((€€€€€€€€€€€€€€€½¹ÍÐÉ•™±•Ñ…µ…”õ•…ÉÑ¡M¡¥•±‘I•‘ÕÑ¥½¸ì(((€€€€€€€€€€€€€€€½¹ÍÐ¡Á	•™½É•I•™±•Ðõ5…Ñ ¹µ…à À±9Õµ‰•È¡µ½¹ÍÑ•È¹¡À¥ñðÀ¤ì(€€€€€€€€€€€€€€€µ½¹ÍÑ•È¹¡Àô(€€€€€€€€€€€€€€€€€€€5…Ñ ¹µ…à (€€€€€€€€€€€€€€€€€€€€€€€€À°(€€€€€€€€€€€€€€€€€€€€€€€µ½¹ÍÑ•È¹¡À´(€€€€€€€€€€€€€€€€€€€€€€€É•™±•Ñ…µ…”(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€‰…ÑÑ±•MÑ…Ñ¥ÍÑ¥ÍI•½É‘…µ…••…±Ñ	å%¹‘•à (€€€€€€€€€€€€€€€€€€€Ñ…É•Ñ%¹‘•à°(€€€€€€€€€€€€€€€€€€€5…Ñ ¹µ…à À±¡Á	•™½É•I•™±•Ðµµ½¹ÍÑ•È¹¡À¤(€€€€€€€€€€€€€€€€¤ì(((€€€€€€€€€€€€€€€…‘‘	…ÑÑ±•1½œ (€€€€€€€€€€€€€€€€€€€€‹–>7–
ß¦ƒš"@ˆ¬(€€€€€€€€€€€€€€€€€€€µ½¹ÍÑ•È¹¹…µ”¬(€€€€€€€€€€€€€€€€€€€€ˆˆ¬(€€€€€€€€€€€€€€€€€€€É•™±•Ñ…µ…”¬(€€€€€€€€€€€€€€€€€€€€‹¦î{–
ß–ºÏŽˆ(€€€€€€€€€€€€€€€€¤ì(((€€€€€€€€€€€€€€€¥˜¡µ½¹ÍÑ•È¹¡ÀðôÀ¥ì((€€€€€€€€€€€€€€€€€€€­¥±±5½¹ÍÑ•È (€€€€€€€€€€€€€€€€€€€€€€€µ½¹ÍÑ•É%¹‘•à(€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€ô((€€€€€€€€€€€ô(((€€€€€€€€€€€€¼¨(€€€€€€€€€€€€€€ƒŠbƒ’þ»š¶¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3Ž3š"Ã¦²—’â·šNšr'¢¶ßžnû¾ò0(€€€€€€€€€€€€€€ƒ–>_–"Ã–
ß–ºÏšf¾ò3š&!Cžj¸¸»–ÂÇ’â7žR£¢ÞÏ–.W¾ò3žnÓš:—¦†¿ž’è(€€€€€€€€€€€€€€ƒžf÷¢&Ë¢¶ßžnûš&¦f“žjšVã–¶_¾ò3¦f“¦v{¢¶ßžnû–&§¦’cš&ÿ–>_¦?–Â?šZð(€€€€€€€€€€€€€€ƒ–
ß–ºÏ¾ò3¦
–&’â¢Öß¦†¿ž’ëŽ7¾ò'¾òh(€€€€€€€€€€€€€€ƒ’â+¦v‹¢¶ßžnû–BãšRÛžj¦
?¢ò¿–~ß¢†3–º3’æ/–ú3¾ò1‘…µ…—–ÞËžÚOšb¼(€€€€€€€€€€€€€€ƒŽ3¢¶ßžnûšN/’â7’ö?Žžrš¶šrš&¢†Ž7žj–&§¦’c¦?ŠSŠS¢¶ßžnø(€€€€€€€€€€€€€€ƒ–º3–£šN/’â/¦gš²‡šRïšN+šf	‘…µ…—šr¢º+š"@Ã¾ò3¦g¢Ž‡–:šr°(€€€€€€€€€€€€€€ƒ’â7žº…‘…µ…—šb¿’â7šb¼Ã¦÷šr–Fó–>­Í¡½ÝA±…å•É!¥Ð §¾ò0(€€€€€€€€€€€€€€ƒ¦–âÛ¢žãžfó–6‡ž&¦r–.WšV#šzs¢ÞŽ0´Á!CŽ7¦gž¢»šÊKšr'š?žú¤(€€€€€€€€€€€€€€ƒžjžÒ–¶_–ö#–ë–.WžV¯¾ò3šb;šb;¢†¦?š‚çšr³šÊKš&Ž–6ïžr/¢Öß’ú(€€€€€€€€€€€€€€ƒ–>#¢ÞÏ–¶_–>#¦r–.W¾ò3¢Þ¢¶ßžnûš'¢¦Ë¢ššr'žjŽ3–º3–£šN/’â/Ž4(€€€€€€€€€€€€€€ƒ¢žš’â7ž²›ŽšRçš"C–>«šr%‘…µ…”øÃ¾ò#¢¶ßžnûšÊKšr'–º3– (€€€€€€€€€€€€€€ƒšN/’ö?Žžržjšr'š&–"Ã¢†¾ò'š&7–Fó–>¯¾ò3–’§žÛ–ÂÇ–B3šfšîÿ¢ÚÌ(€€€€€€€€€€€€€€ƒŽ3¢¶ßžnû–’ƒžR£šf–>«¦†¿ž’ëžf÷–¶_Ž7¢ÞŽ3¢¶ßžnû’â7–’ƒžR£šf(€€€€€€€€€€€€€€ƒžf÷–¶_žÒ–¶_’â¢Öß¦†¿ž’ëŽ7¾ò#–nƒž
éÍ¡½ÝM¡¥•±‘‰Í½Éˆ ¤(€€€€€€€€€€€€€€ƒ–ÞËžÚO–r£’â+¦v‹¢¶ßžnû–BãšRÛ¦
?¢ò¿¢Ž‡–Fó–>¯¦;’ê¾ò3¦g¢Ž‡–>«šb¼(€€€€€€€€€€€€€€ƒ–>›–’[šÆë–ºk¢š’â7¢šŽ3–7–*ƒ’â+Ž7žÒ–¶]!Cš&¢†š>Cž’ë¾ò'Ž(€€€€€€€€€€€€¨¼(€€€€€€€€€€€¥˜¡‘…µ…”øÀ¥ì((€€€€€€€€€€€€€€€Í¡½ÝA±…å•É!¥Ð (€€€€€€€€€€€€€€€€€€€‘…µ…”°(€€€€€€€€€€€€€€€€€€€€‰¡Àˆ°(€€€€€€€€€€€€€€€€€€€Ñ…É•Ñ%¹‘•à°(€€€€€€€€€€€€€€€€€€€™…±Í”°(€€€€€€€€€€€€€€€€€€€µ½¹ÍÑ•ÉÉ¥Ð(€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€ô(((€€€€€€€€€€€¥˜ …¥ÍAÕÉ•½¹ÑÉ½±M­¥±°¥ì(€€€€€€€€€€€€€€€…‘‘	…ÑÑ±•1½œ ((€€€€€€€€€€€€€€€€€€€€ˆˆ¬(€€€€€€€€€€€€€€€€€€€µ½¹ÍÑ•È¹¹…µ”¬(€€€€€€€€€€€€€€€€€€€€ˆˆ¬(€€€€€€€€€€€€€€€€€€€€ (€€€€€€€€€€€€€€€€€€€€€€€ÕÍ•ÍM­¥±°(€€€€€€€€€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€€€€€€€€€€‹šZ÷šRøˆ­…ÍÑM­¥±±9…µ”(€€€€€€€€€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€€€€€€€€€€‹šRïšN(ˆ(€€€€€€€€€€€€€€€€€€€€¤¬(€€€€€€€€€€€€€€€€€€€€ˆˆ¬(€€€€€€€€€€€€€€€€€€€€¡Ñ…É•Ñ¡…É…Ñ•È¹¥‘ñð‹’ö€ˆ¤¬(€€€€€€€€€€€€€€€€€€€€ (€€€€€€€€€€€€€€€€€€€€€€€µ½¹ÍÑ•ÉÉ¥Ð(€€€€€€€€€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€€€€€€€€€€‹¾ò#ž"šN+¾ò¾ò$ˆ(€€€€€€€€€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€€€€€€€€€¤¬(€€€€€€€€€€€€€€€€€€€€‹¾ò3¦ƒš"@ˆ¬(€€€€€€€€€€€€€€€€€€€‘…µ…”¬(€€€€€€€€€€€€€€€€€€€€‹–
ß–ºÌˆ¬(€€€€€€€€€€€€€€€€€€€€ (€€€€€€€€€€€€€€€€€€€€€€€Ñ…É•Ñ¡…É…Ñ•È¹¥Í•™•¹‘¥¹œ(€€€€€€€€€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€€€€€€€€€€‹¾ò#¦bËžš›ž.š/–
ß–ºÏšâo–6+¾ò$ˆ(€€€€€€€€€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€€€€€€€€€¤¬(€€€€€€€€€€€€€€€€€€€€‹Žˆ((€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô(((€€€€€€€€€€€€¼¨(€€€€€€€€€€€€€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3Ž3¦;š¨(€€€€€€€€€€€€€€ƒžVÃ–âãž.š/žnÓš:—–kŽ7¾ò'¾òh(€€€€€€€€€€€€€€ƒš«ž&§¦gš²‡žržjšr'šRûš*¢÷Ž¢3’âSš*¢ô(€€€€€€€€€€€€€€ƒšr³¢ê¯–âÛšr'žVÃ–âãšV#šzsš²’ö7žj¢¦Ç¾ò3–r (€€€€€€€€€€€€€€ƒ–
ß–ºÏžÖCžº_–º3ŽžŠë¢ª7žn»š¢g¦
šÒï¢F_žj(€€€€€€€€€€€€€€ƒššÎ’â/¾ò3––_žR£–"Ãžn»š¢gž:§–ºÛ¢ê¯’â+Ž(€€€€€€€€€€€€€€ƒ¢Þž:§–ºÛ–Â7š«ž&§¦
––_šb¿–B3’â¦†–÷–ò<(€€€€€€€€€€€€€€ƒ–ºÛš^?¾ò!…ÁÁ±åM­¥±±•‰Õ™™™™•ÑÍQ½A±…å•È ¤(€€€€€€€€€€€€€€ƒ¦>‡–=…ÁÁ±åM­¥±±•‰Õ™™™™•ÑÌ §¾ò'¾ò0(€€€€€€€€€€€€€€ƒ–Fó–>¯šfš¦’æ’â¢Ó¾òk–F÷’â·Ž–
ß–ºÏžÖCžº\(€€€€€€€€€€€€€€ƒ–º3’æ/–ú3š&7–"“–ºk¦f–*ƒšV#šzsŽ(€€€€€€€€€€€€¨¼((€€€€€€€€€€€¥˜ (€€€€€€€€€€€€€€€ÕÍ•ÍM­¥±°€˜˜(€€€€€€€€€€€€€€€…ÍÑM­¥±±…Ñ„€˜˜(€€€€€€€€€€€€€€€Ñ…É•Ñ¡…É…Ñ•È¹¡ÀøÀ(€€€€€€€€€€€€¥ì((€€€€€€€€€€€€€€€…ÁÁ±åM­¥±±•‰Õ™™™™•ÑÍQ½A±…å•È (€€€€€€€€€€€€€€€€€€€…ÍÑM­¥±±…Ñ„°(€€€€€€€€€€€€€€€€€€€•™™•Ñ¥Ù•M­¥±±1•Ù•°°(€€€€€€€€€€€€€€€€€€€Ñ…É•Ñ¡…É…Ñ•È°(€€€€€€€€€€€€€€€€€€€Ñ…É•Ñ%¹‘•à°(€€€€€€€€€€€€€€€€€€€µ½¹ÍÑ•È¹±•Ù•°°(€€€€€€€€€€€€€€€€€€€•Ñ5½¹ÍÑ•É™™•Ñ¥Ù•‰¥±¥ÑåA½¥¹ÑÌ (€€€€€€€€€€€€€€€€€€€€€€€µ½¹ÍÑ•È°(€€€€€€€€€€€€€€€€€€€€€€€…ÍÑM­¥±±…Ñ„¹…Ñ•½Éäôôô‰Á¡åÍ¥…°ˆü‰…ÑÑ…¬ˆè‰¥¹Ñ•±±¥•¹”ˆ(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€ô((€€€€€€€€€€€¥˜ (€€€€€€€€€€€€€€€ÕÍ•ÍM­¥±°€˜˜(€€€€€€€€€€€€€€€…ÍÑM­¥±±…Ñ„€˜˜(€€€€€€€€€€€€€€€…ÍÑM­¥±±…Ñ„¹±¥™•ÍÑ•…±A•É•¹Ñ	å1•Ù•°€˜˜(€€€€€€€€€€€€€€€‘…µ…”øÀ(€€€€€€€€€€€€¥ì(€€€€€€€€€€€€€€€µ½¹ÍÑ•É1¥™•ÍÑ•…±…µ…”¬õ‘…µ…”ì(€€€€€€€€€€€ô((€€€€€€€ô(€€€€¤ì(((€€€¥˜ (€€€€€€€ÕÍ•ÍM­¥±°€˜˜(€€€€€€€…ÍÑM­¥±±…Ñ„€˜˜(€€€€€€€…ÍÑM­¥±±…Ñ„¹±¥™•ÍÑ•…±A•É•¹Ñ	å1•Ù•°€˜˜(€€€€€€€µ½¹ÍÑ•É1¥™•ÍÑ•…±…µ…”øÀ€˜˜(€€€€€€€µ½¹ÍÑ•È¹…±¥Ù”(€€€€¥ì(€€€€€€€½¹ÍÐÁ•É•¹Ðõ…ÍÑM­¥±±…Ñ„¹±¥™•ÍÑ•…±A•É•¹Ñ	å1•Ù•±m•™™•Ñ¥Ù•M­¥±±1•Ù•°´Åtì(€€€€€€€½¹ÍÐ…µ½Õ¹Ðõ5…Ñ ¹™±½½È¡µ½¹ÍÑ•É1¥™•ÍÑ•…±…µ…”©Á•É•¹Ð¼ÄÀÀ¤ì((€€€€€€€¥˜¡…µ½Õ¹ÐøÀ¥ì(€€€€€€€€€€€½¹ÍÐ¡ÁI•½Ù•É•õ5…Ñ ¹µ…à À±5…Ñ ¹µ¥¸¡…µ½Õ¹Ð±µ½¹ÍÑ•È¹µ…á!@µµ½¹ÍÑ•È¹¡À¤¤ì(€€€€€€€€€€€½¹ÍÐÍÁI•½Ù•É•õ5…Ñ ¹µ…à À±5…Ñ ¹µ¥¸¡…µ½Õ¹Ð±µ½¹ÍÑ•È¹µ…áM@µµ½¹ÍÑ•È¹ÍÀ¤¤ì((€€€€€€€€€€€µ½¹ÍÑ•È¹¡Àõ5…Ñ ¹µ¥¸¡µ½¹ÍÑ•È¹µ…á!@±µ½¹ÍÑ•È¹¡À­…µ½Õ¹Ð¤ì(€€€€€€€€€€€µ½¹ÍÑ•È¹ÍÀõ5…Ñ ¹µ¥¸¡µ½¹ÍÑ•È¹µ…áM@±µ½¹ÍÑ•È¹ÍÀ­…µ½Õ¹Ð¤ì((€€€€€€€€€€€…‘‘	…ÑÑ±•1½œ (€€€€€€€€€€€€€€€µ½¹ÍÑ•È¹¹…µ”¬‹–Bã–>[–
ß–ºÏžjˆ­Á•É•¹Ð¬(€€€€€€€€€€€€€€€€ˆ—’â›š‹–ú¤ˆ­¡ÁI•½Ù•É•¬‹¦îy!CŽˆ­ÍÁI•½Ù•É•¬‹¦îyMCŽˆ(€€€€€€€€€€€€¤ì(€€€€€€€ô(€€€ô(((€€€ÕÁ‘…Ñ•U$ ¤ì(((€€€™¥¹¥Í¡A±…å•ÉÑ¥½¸ ¤ì()ô(((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€ƒš"Ã¦²—žÖCšv|(ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼()™Õ¹Ñ¥½¸¡•­	…ÑÑ±•¹ ¥ì((€€€¥˜ …‰…ÑÑ±•Ñ¥Ù”¥ì(€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€ô((€€€€¼¨!@Í•ÑÑ±•µ•¹Ð‰•±½¹ÌÑ¼Ñ¡”½É”‰…ÑÑ±”™±½Ü¸¹ä‘…µ…”Í½ÕÉ”µ…ä(€€€€€€É•‘Õ”!@Ñ¼é•É¼ì…‘…ÁÑ•ÉÌµÕÍÐ¹½ÐÝÉ…ÀÅÕ•Õ”™Õ¹Ñ¥½¹Ìµ•É•±äÑ¼(€€€€€€ÑÉ…¹Í±…Ñ”Ñ¡…ÐÍÑ…Ñ”¥¹Ñ¼Ñ¡”Í¥¹±”…¹½¹¥…°‘•…Ñ Á…Ñ ¸€¨¼(€€€ÕÉÉ•¹Ñ	…ÑÑ±•5½¹ÍÑ•ÉÌ¹™½É… ¡¥¹‘•àôùì(€€€€€€€½¹ÍÐµ½¹ÍÑ•Èõµ½¹ÍÑ•ÉÍm¥¹‘•átì(€€€€€€€¥˜¡µ½¹ÍÑ•È˜™µ½¹ÍÑ•È¹…±¥Ù”„ôõ™…±Í”˜™9Õµ‰•È¡µ½¹ÍÑ•È¹¡À¤ðôÀ¥ì(€€€€€€€€€€€­¥±±5½¹ÍÑ•È¡¥¹‘•à¤ì(€€€€€€€ô(€€€ô¤ì(((€€€½¹ÍÐÁ…ÉÑå•™•…Ñ•õ•Ñá¥ÍÑ¥¹A…ÉÑå%¹‘•á•Ì ¤¹•Ù•Éä¡¥¹‘•àôùì(€€€€€€€½¹ÍÐ¡…É…Ñ•Èõ•ÑA…ÉÑå¡…É…Ñ•É	å%¹‘•à¡¥¹‘•à¤ì(€€€€€€€É•ÑÕÉ¸€…¡…É…Ñ•Èñð¡…É…Ñ•È¹¡ÀðôÀì(€€€ô¤ì((€€€¥˜¡Á…ÉÑå•™•…Ñ•¥ì((€€€€€€€±½Í•	…ÑÑ±” ¤ì((€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì((€€€ô(((€€€½¹ÍÐ…±¥Ù”€ô(€€€€€€€ÕÉÉ•¹Ñ	…ÑÑ±•5½¹ÍÑ•ÉÌ(€€€€€€€€¹Í½µ” (€€€€€€€€€€€¤ôø(€€€€€€€€€€€€€€€µ½¹ÍÑ•ÉÍm¥t€˜˜(€€€€€€€€€€€€€€€µ½¹ÍÑ•ÉÍm¥t¹…±¥Ù”(€€€€€€€€¤ì(((€€€¥˜ ……±¥Ù”¥ì((€€€€€€€Ý¥¹	…ÑÑ±” ¤ì((€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì((€€€ô(((€€€É•ÑÕÉ¸™…±Í”ì()ô(()™Õ¹Ñ¥½¸…ÁÁ±åA½ÍÑ	…ÑÑ±•ÕÑ½I•½Ù•Éä ¥ì((€€€•Ñá¥ÍÑ¥¹A…ÉÑå%¹‘•á•Ì ¤¹™½É… ¡¡…É…Ñ•É%¹‘•àôùì((€€€€€€€½¹ÍÐ¡…É…Ñ•Èõ•ÑA…ÉÑå¡…É…Ñ•É	å%¹‘•à¡¡…É…Ñ•É%¹‘•à¤ì(€€€€€€€½¹ÍÐ½¹™¥œõ•ÑA…ÉÑåÕÑ½½¹™¥œ¡¡…É…Ñ•É%¹‘•à¤ì(€€€€€€€½¹ÍÐÍÑ…ÑÌõ•ÑA…ÉÑå	…ÑÑ±•MÑ…ÑÌ¡¡…É…Ñ•É%¹‘•à¤ì((€€€€€€€¥˜ …¡…É…Ñ•Èñð¡…É…Ñ•È¹¡ÀðôÀñð€…½¹™¥œ¹•¹…‰±•ñð€…ÍÑ…ÑÌ¥ì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€ô((€€€€€€€l‰¡Àˆ°‰ÍÀ‰t¹™½É… ¡É•Í½ÕÉ”ôùì((€€€€€€€€€€€½¹ÍÐµ…áY…±Õ”õÉ•Í½ÕÉ”ôôô‰¡Àˆ€üÍÑ…ÑÌ¹µ…á!@€èÍÑ…ÑÌ¹µ…áM@ì(€€€€€€€€€€€½¹ÍÐÕÉÉ•¹ÑY…±Õ”õÉ•Í½ÕÉ”ôôô‰¡Àˆ€ü¡…É…Ñ•È¹¡À€è¡…É…Ñ•È¹ÍÀì(€€€€€€€€€€€½¹ÍÐÑ¡É•Í¡½±õ¹½Éµ…±¥é•ÕÑ½	…ÑÑ±•Q¡É•Í¡½±¡½¹™¥mÉ•Í½ÕÉ•t±É•Í½ÕÉ”ôôô‰¡Àˆ€ü€ÔÀ€è€ÈÔ¤ì((€€€€€€€€€€€¥˜¡µ…áY…±Õ”ðôÀñðÕÉÉ•¹ÑY…±Õ”øõµ…áY…±Õ”ñðÕÉÉ•¹ÑY…±Õ”½µ…áY…±Õ”¨ÄÀÀùÑ¡É•Í¡½±¥ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€€€€€ô((€€€€€€€€€€€½¹ÍÐÁ½Ñ¥½¹%õ•ÑÕÑ½A½Ñ¥½¹%¡É•Í½ÕÉ”¤ì(€€€€€€€€€€€½¹ÍÐ‘•™¥¹¥Ñ¥½¸õ•ÑA½Ñ¥½¹•™¥¹¥Ñ¥½¸¡Á½Ñ¥½¹%¤ì((€€€€€€€€€€€¥˜ …‘•™¥¹¥Ñ¥½¸ñð€…½¹ÍÕµ•A½Ñ¥½¹É½µ%¹Ù•¹Ñ½Éä¡Á½Ñ¥½¹%°Ä¤¥ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€€€€€ô((€€€€€€€€€€€½¹ÍÐÁ±…¹¹•õ‘•™¥¹¥Ñ¥½¸¹É•½Ù•ÉåA•É•¹ÐøôÄÀÀ(€€€€€€€€€€€€€€€€üµ…áY…±Õ”µÕÉÉ•¹ÑY…±Õ”(€€€€€€€€€€€€€€€€è5…Ñ ¹µ…à Ä±5…Ñ ¹É½Õ¹¡µ…áY…±Õ”©‘•™¥¹¥Ñ¥½¸¹É•½Ù•ÉåA•É•¹Ð¼ÄÀÀ¤¤ì(€€€€€€€€€€€½¹ÍÐÉ•½Ù•É•õ5…Ñ ¹µ…à À±5…Ñ ¹µ¥¸¡µ…áY…±Õ”µÕÉÉ•¹ÑY…±Õ”±Á±…¹¹•¤¤ì((€€€€€€€€€€€¥˜¡É•Í½ÕÉ”ôôô‰¡Àˆ¥ì(€€€€€€€€€€€€€€€¡…É…Ñ•È¹¡Àõ5…Ñ ¹µ¥¸¡µ…áY…±Õ”±¡…É…Ñ•È¹¡À­É•½Ù•É•¤ì(€€€€€€€€€€€õ•±Í•ì(€€€€€€€€€€€€€€€¡…É…Ñ•È¹ÍÀõ5…Ñ ¹µ¥¸¡µ…áY…±Õ”±¡…É…Ñ•È¹ÍÀ­É•½Ù•É•¤ì(€€€€€€€€€€€ô((€€€€€€€€€€€…‘‘	…ÑÑ±•1½œ (€€€€€€€€€€€€€€€€‹š"Ã¦²—žÖCšv–ú3¾ò0ˆ¬¡¡…É…Ñ•È¹¥‘ñð‹¢žK¢&Èˆ¤¬(€€€€€€€€€€€€€€€€‹¢«–.W’öÿžR ˆ­‘•™¥¹¥Ñ¥½¸¹¹…µ”¬‹¾ò3š‹–ú¤ˆ­É•½Ù•É•¬ˆ€ˆ­É•Í½ÕÉ”¹Ñ½UÁÁ•É…Í” ¤¬‹Žˆ(€€€€€€€€€€€€¤ì(€€€€€€€ô¤ì(€€€ô¤ì((€€€É•‰Õ¥±‘%¹Ù•¹Ñ½ÉåM±½ÑÌ ¤ì)ô(()™Õ¹Ñ¥½¸Ý¥¹	…ÑÑ±” ¥ì((€€€¥˜ …‰…ÑÑ±•Ñ¥Ù”¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€‰…ÑÑ±•Ñ¥Ù”õ™…±Í”ì(€€€±•…É	…ÑÑ±•I½Õ¹‘AÉ½µÁÐ ¤ì(€€€™¥¹¥Í¡	…ÑÑ±•MÑ…Ñ¥ÍÑ¥ÍM•ÍÍ¥½¸ ‰Ý¥¸ˆ¤ì((€€€…ÕÑ½	…ÑÑ±”õ™…±Í”ì((€€€…Ñ¥½¹I•…‘äõ™…±Í”ì((€€€Á•¹‘¥¹Ñ¥½¸õ¹Õ±°ì(((€€€±•…É%¹Ñ•ÉÙ…°¡Ñ¥µ•É%¤ì((€€€Ñ¥µ•É%õ¹Õ±°ì((€€€¥˜¡‰…ÑÑ±•‘Ù…¹•Q¥µ•½ÕÑ%¥ì(€€€€€€€±•…ÉQ¥µ•½ÕÐ¡‰…ÑÑ±•‘Ù…¹•Q¥µ•½ÕÑ%¤ì(€€€€€€€‰…ÑÑ±•‘Ù…¹•Q¥µ•½ÕÑ%õ¹Õ±°ì(€€€ô(€€€±•…É	…ÑÑ±•Ñ¥½¹]…Ñ¡‘½œ ¤ì(€€€‰…ÑÑ±•‘Ù…¹•M¡•‘Õ±•õ™…±Í”ì(((€€€‰…ÑÑ±•Q½­•¸¬¬ì((€€€€¼¨(€€€€€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3š¾?š^—’îï–.d(€€€€€€ƒŽ3š&O¢Ò<Ç–‚Óš"Ã¦²—Ž7¾ò'¾òk–.w–"§žÖCžº_¦g¢Ž‡šb¼(€€€€€€ƒ–R¿’âšržÚO¦;žj–rÃšZç¾ò3žnÓš:—¢¢c¦2¦Ë–ê›Ž(€€€€¨¼((€€€•¹ÍÕÉ•…¥±åEÕ•ÍÑÍÕÉÉ•¹Ð ¤ì((€€€‘…¥±åEÕ•ÍÑMÑ…Ñ”¹ÁÉ½É•ÍÌ¹Ý¥¹	…ÑÑ±”ô(€€€€€€€5…Ñ ¹µ¥¸ (€€€€€€€€€€€€Ä°(€€€€€€€€€€€€ (€€€€€€€€€€€€€€€‘…¥±åEÕ•ÍÑMÑ…Ñ”¹ÁÉ½É•ÍÌ¹Ý¥¹	…ÑÑ±•ñð(€€€€€€€€€€€€€€€€À(€€€€€€€€€€€€¤¬Ä(€€€€€€€€¤ì(((€€€€¼¨(€€€€€€ƒŠbƒšZÃ–Š{¾òk–žS¢¢_’îï–.gŽ3š&O¢Ò<Ï–‚Óš"Ã¦²—Ž7¾ò0(€€€€€€ƒ–B3’â–/’ê/’îÛ’úšêC’â¢ÖßžÒ¿–*ƒŽ(€€€€¨¼((€€€½µµ¥ÍÍ¥½¹EÕ•ÍÑMÑ…Ñ”¹ÁÉ½É•ÍÌ¹Ý¥¹	…ÑÑ±”ô(€€€€€€€5…Ñ ¹µ¥¸ ((€€€€€€€€€€€½µµ¥ÍÍ¥½¹EÕ•ÍÑ•™¥¹¥Ñ¥½¹Ì¹™¥¹ (€€€€€€€€€€€€€€€ÄôùÄ¹¥ôôô‰Ý¥¹	…ÑÑ±”ˆ(€€€€€€€€€€€€¤¹½…°°((€€€€€€€€€€€€ (€€€€€€€€€€€€€€€½µµ¥ÍÍ¥½¹EÕ•ÍÑMÑ…Ñ”¹ÁÉ½É•ÍÌ¹Ý¥¹	…ÑÑ±•ñð(€€€€€€€€€€€€€€€€À(€€€€€€€€€€€€¤¬Ä((€€€€€€€€¤ì(((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾ò#–B3’â–/–V?¦†3žj–>›’â–6+¾ò'¾òh(€€€€€€ƒ¢Þ}±½Í•	…ÑÑ±” §’âš¢¾ò3–.w–"§žÖCžº_’æ–º3–£šÊKšr$(€€€€€€ƒšRÛ–B#–>¿¢÷¦
¦Z/¢F_žj–¶C¦ã–Z»¾ò3’âš¢¢Žs’â+Ž(€€€€¨¼((€€€±½Í•5•¹ÕÌ ¤ì(((€€€…‘‘	…ÑÑ±•1½œ (€€€€€€€€‹š&šr'š«ž&§–ÞË¢Š¯šN+šV_¾òˆ(€€€€¤ì(((€€€½¹ÍÐ•áÁ…¥¸€ô(€€€€€€€ÕÉÉ•¹Ñ	…ÑÑ±•5½¹ÍÑ•ÉÌ(€€€€€€€€¹É•‘Õ” (€€€€€€€€€€€€¡Ñ½Ñ…°±¤¤ôø(€€€€€€€€€€€€€€€Ñ½Ñ…°¬(€€€€€€€€€€€€€€€µ½¹ÍÑ•ÉÍm¥t¹±•Ù•°¨ÄÀ°(€€€€€€€€€€€€À(€€€€€€€€¤ì(((€€€€¼¨(€€€€€€ƒŠbƒš"Ã¦²—’â·žÖW–Â7’â7¢÷–6žÒkŽ(€€€€€€aC–#¦Ë–—Ž3–ÇžR£žÚO¦¦_šÆƒŽ7¾ò0(€€€€€€ƒž¶'ž:§–ºÛ–n{–"Ã’âï–~;¢«¢†3š2'Ž3–"¦7žÚO¦¦_–óŽ4(€€€€€€ƒš&7šržrš¶–"“šZß–6žÒkŽ(€€€€¨¼((€€€Í¡…É•‘áÀ€¬ô(€€€€€€€•áÁ…¥¸ì(((€€€…‘‘	…ÑÑ±•1½œ (€€€€€€€€‹ž6Ë–ú\ˆ¬(€€€€€€€•áÁ…¥¸¬(€€€€€€€€‰aC¾ò3–ÞË–¶c–—žÚO¦¦_šÆƒŽˆ(€€€€¤ì((€€€…ÁÁ±åA½ÍÑ	…ÑÑ±•ÕÑ½I•½Ù•Éä ¤ì(((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾òh(€€€€€€ƒ–:šr°a@ƒš>Cž’ë¾ò#¦î¢&ËšÖ»–.W¢¢+š¿¾ò$(€€€€€€ƒ–r£š"Ã¦²—žV¯¦v‹žÖCšvžVÛ’â/–ÂÇž®/–"ï¢ÞÏ–ë’ú¾ò0(€€€€€€ƒ¢Þš"Ã¦²—žV¯¦v‹¦7žZ+–r£’â¢Öß–ú#’êŽ(€€€€€€ƒšRçš"Cž¶'žV¯¦v‹žržj–"–n{–rÃ–r[’æ/–ú3š&7¦†¿ž’ë¾ò0(€€€€€€ƒšRû¦Ë’â/¦vˆÍ¡½ÝA…” ‰µ…Àˆ¤ƒ¦
–,(€€€€€€Í•ÑQ¥µ•½ÕÐ…±±‰…¬ƒ¢Ž‡¦v‹Ž(€€€€¨¼(((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾òh(€€€€€€ƒ–:šr³¦g¢Ž‡š&O¢Ò?–ÂÇšr¢«–.Wš*)!@½MC¢Žsšîÿ¾ò0(€€€€€€ƒ¦gšb¿šrš^§¢š?š‚ó–¾¯žj¾ò#–n{¢† ¿–nyMC¾ò'¾ò0(€€€€€€ƒ’ö–¾›¦jož:§¢Öß’úšr¢ºM!@½MC¢^—šÂÓ–º3–£šÊKšr'š?žú§ŠSŠP(€€€€€€ƒ–>7š¶š&O–º3–ÂÇ–£šîÿ¾ò3¢^—šÂÓš‚çšr³’â7žR£žR£Ž((€€€€€€ƒšRçš"C¾òkš&O¢Ò?’æ/–ú1!@½MCžÚ·š2š"Ã¦²—žÖCšvžVÛ’â/žjšVã–ó¾ò0(€€€€€€ƒ’â7šr¢«–.W¢Žsšîÿ¾ò3¢š–bo–âÛ¢^—šÂÓ¾ò0(€€€€€€ƒ¢š–bo’æ/–ú3¢Žs’â–/Ž3–n{’âï–~;’òGš¿–n{¢†Ž7žj–*¢÷Ž((€€€€€€ƒš"Ã¦²—Ž3–’ÇšV_Ž7¢Š¯šN+šV_žj¢Žs¢†¦
?¢ò¿žÚ·š2’â7¢º((€€€€€€ƒ¾ò#¦
–/š¾S¢ò–?šb¿Ž3¦7žRŽ7žjšš–þ×¾ò0(€€€€€€ƒ¢Þ¦g¢Ž‡š&O¢Ò?¢Žs¢†’â7šb¿–B3’â’îÛ’ê/¾ò0(€€€€€€ƒšVš?žVg¢F_šÊKšr'’â¢Ößš.ÿš:'¾ò'Ž(€€€€¨¼(((€€€±•…ÉQ¥µ•½ÕÐ¡É•ÍÁ…Ý¹%¤ì(((€€€€¼¨(€€€€€€ƒŠbƒžâ»ž~·š«ž&§¦7žRšf¦ZO¾òh(€€€€€€ƒ–:šr°×žžK¾ò3¦7–B#ž>û–r£žžï–.W–ÞËžÚO¢ž¦:[¾ò0(€€€€€€ƒž:§–ºÛ¦š³’â+–ÂÇ¢÷–r£–rÃ–r[’â+¢ÖÃ–.W¾ò0(€€€€€€ƒ’öš«ž&§¦
¢šž¶$×žžKš&7–ëž>û¾ò0(€€€€€€ƒžV¯¦v‹šršr'’âšº×šf¦ZOš¢šëž¦ëž¦ëžjŽ(€€€€€€ƒšRçš"@ËžžK¾ò3¦®Sš’â+¢B÷–Þ»–Â?–ú#–’kŽ(€€€€¨¼((€€€É•ÍÁ…Ý¹%€ô(€€€€€€€Í•ÑQ¥µ•½ÕÐ (€€€€€€€€€€€É•ÍÁ…Ý¹5½¹ÍÑ•ÉÌ°(€€€€€€€€€€€€ÈÀÀÀ(€€€€€€€€¤ì(((€€€Í…Ù•…µ” ¤ì(((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾òh(€€€€€€ƒ’æ/–&7ž
ë’ê¢žšÆëŽ3–n{–rÃ–r[–ú3š«ž&§ž¦ë’ê––÷’â¦f–¶CŽ4(€€€€€€ƒš*+¦g¢Ž‡–ŽO–"ÀÈÔÁµÏ¾ò0(€€€€€€ƒ’ö¦gš¢š"Ã¦²—žÖCšv–æû’æ;šb¿žz³¦ZO¢ÞÏ¢ÖÃ¾ò0(€€€€€€ƒšZ–¶]IAžr/’â7–"ÃŽ3š&O¢Ò?’êŽ7žj¢¢+š¿¢Þž6Ë–ú_žjaC¾ò0(€€€€€€ƒ–º3–£šÊKšr'–sžVgšŽ((€€€€€€ƒž>û–r£Ž3š«ž&§šÚ#–’Ç–’«’æŽ7¢ÞŽ3žžï–.W¢Š¯–6‡’ö?Ž4(€€€€€€ƒ–ÞËžÚOžR£–"—žjšZç–ò?¢žšÆë’ê¾ò!É•ÍÁ…Ý»žâ»–"ÀËžžKŽ(€€€€€€ƒžžï–.W’â7–7¢Š­µ…Á½½±‘½Ý»–6‡’ö?¾ò'¾ò0(€€€€€€ƒš&’î—¦g¢Ž‡–>¿’î—šRû–þš.'¦Vß¾ò0(€€€€€€ƒ¢ºOž:§–ºÛšr'šf¦ZOžr/šâš–kš"Ã¦²—¢Î¢¢+¢Ž‡žjžÖCšzsŽ(€€€€¨¼((€€€Í•ÑQ¥µ•½ÕÐ  ¤ôùì((€€€€€€€Í¡½ÝA…” ‰µ…Àˆ¤ì((€€€€€€€Í•Ñ5…Á½½±‘½Ý¸ ÌÀÀÀ¤ì(((€€€€€€€ÍÑ…ÉÑ5½¹ÍÑ•É5½Ù•µ•¹Ð ¤ì((€€€€€€€Í¡•‘Õ±•ÕÑ½A…ÑÉ½±¡•¬ ÔÀÀÀ¤ì((€€€€€€€ÕÁ‘…Ñ•U$ ¤ì(((€€€€€€€Í¡½ÝáÁQ½…ÍÐ (€€€€€€€€€€€•áÁ…¥¸(€€€€€€€€¤ì(((€€€€€€€€¼¨(€€€€€€€€€€ƒŠbƒšZÃ–Š{¾òkšÊK¢^—šÂÓ¢«–.W–n{’âï–~;Ž(€€€€€€€€€€ƒ–>«¢šž²³’â¢žK¢&Ëš"[ž²³’ê3¢žK¢&Ëšr'–.û¦ã¦g–/¢¢·–ºk¾ò0(€€€€€€€€€€ƒš"Ã¦²—žÖCšv–n{–"Ã–rÃ–r[’æ/–ú3¾ò0(€€€€€€€€€€ƒšª‹š~—¢ê¯’â)!@½MC¢^—šÂÓšb¿’â7šb¿¦÷žR£–º3’ê¾ò0(€€€€€€€€€€ƒ¦÷žR£–º3žj¢¦ÇžnÓš:—¦Žo–n{’âï–~;¾ò0(€€€€€€€€€€ƒ’â7žR£ž:§–ºÛ¢«–ÞÇ¢¢c–ú_¢š–n{–:ï¢Žs¢Ê£Ž(€€€€€€€€¨¼((€€€€€€€¡•­ÕÑ½I•ÑÕÉ¹Q½¥Ñä ¤ì((€€€ô°ÈÈÀÀ¤ì()ô(((¼¨(€€ƒŠbƒšZÃ–Š{¾òkšÊK¢^—šÂÓ¢«–.W–n{’âï–~;žj–×šâ³Ž(€€ƒ¢^—šÂÓšb¿ž:§–ºÛ–âÏ¢f–ÇžR£žj–Z»’â–ê¯–¶`(€€ƒ¾ò#’â7šb¿š¾?–/¢žK¢&Ë–B¢«–âÛ’â’î÷¾ò'¾ò0(€€ƒ–>«¢š’îï’â¢žK¢&Ëšr'¦Z/–V¦g–/¢¢·–ºk¾ò0(€€ƒ¢ê¯’â)!CŽMC¢^—šÂÓ¦÷žR£–º3’ê¾ò0(€€ƒ–ÂÇ¢«–.W¦n‹¦Z/–rÃ–r[Ž¦Žo–n{’âï–~;Ž(¨¼()™Õ¹Ñ¥½¸¡•­ÕÑ½I•ÑÕÉ¹Q½¥Ñä ¥ì((€€€½¹ÍÐÍ¡½Õ±‘¡•¬ô((€€€€€€€…ÕÑ½½¹™¥œ¹É•ÑÕÉ¹Q½¥Ñå]¡•¹µÁÑäñð(€€€€€€€€ (€€€€€€€€€€€Á±…å•ÈÈ€˜˜(€€€€€€€€€€€…ÕÑ½½¹™¥œÈ¹É•ÑÕÉ¹Q½¥Ñå]¡•¹µÁÑä(€€€€€€€€¤ñð(€€€€€€€€ (€€€€€€€€€€€Á±…å•ÈÌ€˜˜(€€€€€€€€€€€…ÕÑ½½¹™¥œÌ¹É•ÑÕÉ¹Q½¥Ñå]¡•¹µÁÑä(€€€€€€€€¤ì(((€€€¥˜ …Í¡½Õ±‘¡•¬¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€¥˜ (€€€€€€€•ÑQ½Ñ…±A½Ñ¥½¹½Õ¹Ð ¤øÀ(€€€€¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€ÍÑ½Á5½¹ÍÑ•É5½Ù•µ•¹Ð ¤ì(((€€€Í¡½ÝA…” (€€€€€€€€‰¡½µ”ˆ(€€€€¤ì(((€€€…±•ÉÐ (€€€€€€€€‰!C¾ò=MC¢^—šÂÓ¦÷žR£–º3’ê¾ò3–ÞË¢«–.W¢þS–n{’âï–~;Žˆ(€€€€¤ì()ô(()™Õ¹Ñ¥½¸±½Í•	…ÑÑ±” ¥ì((€€€¥˜ …‰…ÑÑ±•Ñ¥Ù”¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€‰…ÑÑ±•Ñ¥Ù”õ™…±Í”ì(€€€±•…É	…ÑÑ±•I½Õ¹‘AÉ½µÁÐ ¤ì(€€€™¥¹¥Í¡	…ÑÑ±•MÑ…Ñ¥ÍÑ¥ÍM•ÍÍ¥½¸ ‰±½Í”ˆ¤ì((€€€…ÕÑ½	…ÑÑ±”õ™…±Í”ì((€€€…Ñ¥½¹I•…‘äõ™…±Í”ì((€€€Á•¹‘¥¹Ñ¥½¸õ¹Õ±°ì(((€€€±•…É%¹Ñ•ÉÙ…°¡Ñ¥µ•É%¤ì((€€€Ñ¥µ•É%õ¹Õ±°ì((€€€¥˜¡‰…ÑÑ±•‘Ù…¹•Q¥µ•½ÕÑ%¥ì(€€€€€€€±•…ÉQ¥µ•½ÕÐ¡‰…ÑÑ±•‘Ù…¹•Q¥µ•½ÕÑ%¤ì(€€€€€€€‰…ÑÑ±•‘Ù…¹•Q¥µ•½ÕÑ%õ¹Õ±°ì(€€€ô(€€€±•…É	…ÑÑ±•Ñ¥½¹]…Ñ¡‘½œ ¤ì(€€€‰…ÑÑ±•‘Ù…¹•M¡•‘Õ±•õ™…±Í”ì(((€€€‰…ÑÑ±•Q½­•¸¬¬ì(((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾ò#žržjš*O–"ÃŽ3žV¯¦v‹’â/šZçžVg’â/’â–’Ÿš"«ž¦ëžf÷Ž4(€€€€€€ƒžj–Û’â·’â–/–:–nƒ¾ò'¾òh(€€€€€€ƒš"ÃšV_žÖCžº_–º3–£šÊKšr'š*+–>¿¢÷¦
¦Z/¢F_žj–¶C¦ã–Z¸(€€€€€€ƒ¾ò#’ú/–šž&§–Nš²žj!@½MC¢^—šÂÓ¦ã–Z»¾ò'šRÛ–B#¾ò0(€€€€€€ƒ–ššzsš"ÃšV_žjžVÛ’â/–&o––÷¦ã–Z»šb¿¦Z/¢F_žj¾ò0(€€€€€€ƒ–º–ÂÇšr–6‡–r£š&O¦Z/žjž.š/¾ò3¢º+š"CžV¯¦v‹’â((€€€€€€ƒ’â–’Ÿ–†+žr/¢Öß’ú–?Ž3ž¦ëžf÷Ž7žj–6–~¾ò0(€€€€€€ƒ–Û–¾›šb¿’â–/–Ÿ–ºçžr/¢Öß’úž¦ëž¦ëžj¦ã–Z»–6‡–r£¦
¢Ž‡Ž(€€€€€€ƒ¦g¢Ž‡¢Žs’â)±½Í•5•¹ÕÌ §¾ò3žŠë’þwš"ÃšV_žV¯¦vˆ(€€€€€€ƒ’æûšÞ£Ž’â7šršºcžVg’îï’öW¦ã–Z»Ž(€€€€¨¼((€€€±½Í•5•¹ÕÌ ¤ì(((€€€…‘‘	…ÑÑ±•1½œ (€€€€€€€€‹’öƒ¢Š¯šN+šV_’êŠ›Š˜ˆ(€€€€¤ì(((€€€½¹ÍÐÍÑ…ÑÌ€ô(€€€€€€€•Ñ5…¥¹¡…É…Ñ•ÉMÑ…ÑÌ ¤ì(((€€€Á±…å•È¹¡À€ô(€€€€€€€ÍÑ…ÑÌ¹µ…á!@ì(((€€€Á±…å•È¹ÍÀ€ô(€€€€€€€ÍÑ…ÑÌ¹µ…áM@ì(((€€€€¼¨(€€€€€€ƒŠbƒšZÃ–Š{¾òh(€€€€€€ƒž²³’â¢žK¢&Ëš"ÃšV_šr¢Š¯Ž3šVG–n{Ž7¦7žR¢Žsšîý!@½MC¾ò0(€€€€€€ƒž²³’ê3¢žK¢&Ë–:šr³šÊKšr'¢Þ¢F_’â¢Öß¢fWžB¾ò0(€€€€€€ƒšr–âÛ¢F_š"Ã¦²—’â·šºcžVgžj’ö;¢†¦?¦Ë–"Ã’â/’â–‚Óš"Ã¦²—¾ò0(€€€€€€ƒ¢Þž²³’â¢žK¢&Ëžj¦®S¦¦_’â7’â¢ÓŽ(€€€€€€ƒ¦g¢Ž‡¢ºO’î[¢Þ¢F_’â¢Öß¢ŽsšîÿŽ(€€€€¨¼((€€€¥˜¡Á±…å•ÈÈ¥ì((€€€€€€€½¹ÍÐÍÑ…ÑÌÈô(€€€€€€€€€€€•ÑA±…å•ÈÉ	…ÑÑ±•MÑ…ÑÌ ¤ì(((€€€€€€€Á±…å•ÈÈ¹¡Àô(€€€€€€€€€€€ÍÑ…ÑÌÈ¹µ…á!@ì(((€€€€€€€Á±…å•ÈÈ¹ÍÀô(€€€€€€€€€€€ÍÑ…ÑÌÈ¹µ…áM@ì((€€€ô((€€€¥˜¡Á±…å•ÈÌ¥ì((€€€€€€€½¹ÍÐÍÑ…ÑÌÌõ•ÑA…ÉÑå	…ÑÑ±•MÑ…ÑÌ È¤ì(€€€€€€€Á±…å•ÈÌ¹¡ÀõÍÑ…ÑÌÌ¹µ…á!@ì(€€€€€€€Á±…å•ÈÌ¹ÍÀõÍÑ…ÑÌÌ¹µ…áM@ì((€€€ô(((€€€Í•ÑQ¥µ•½ÕÐ  ¤ôùì((€€€€€€€Í¡½ÝA…” ‰µ…Àˆ¤ì((€€€€€€€Í•Ñ5…Á½½±‘½Ý¸ ÌÀÀÀ¤ì(((€€€€€€€ÍÑ…ÉÑ5½¹ÍÑ•É5½Ù•µ•¹Ð ¤ì((€€€€€€€Í¡•‘Õ±•ÕÑ½A…ÑÉ½±¡•¬ ÔÀÀÀ¤ì((€€€€€€€ÕÁ‘…Ñ•U$ ¤ì((€€€ô°ÈÈÀÀ¤ì()ô(()™Õ¹Ñ¥½¸…ÑÑ•µÁÑÍ…Á” ¥ì((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾òh(€€€€€€ƒ–:šr³–>«šª‹š~—–£–~žj…ÕÑ½	…ÑÑ±—¾ò0(€€€€€€ƒšRçš"Cžr/žn»–&7šb¿¢ªÃžj–n{–B#Ž(€€€€€€ƒžR£–Â7š'¢žK¢&Ëžj¢«–.W¦Z/¦^s’ú–"“šZÜ(€€€€€€ƒ¾ò#¦¢¯šb¿šVÓ–/¦j+’ò7’â¢Öß¦¾ò0(€€€€€€ƒ’öšN7’ösšfš¦¦
šb¿¢š¢Þžn»–&7–n{–B#žj(€€€€€€ƒš&/–.T¿¢«–.Wž.š/’â¢Ó¾ò0(€€€€€€ƒ’â7žÛ¢«–.W¢žK¢&Ë¢†3–.W’â·¦S¦
¢÷¢Š¯¦¢¯š2'¦"Wš&OšZß¾ò'Ž(€€€€¨¼((€€€½¹ÍÐ…ÕÑ½=¸ô(€€€€€€€…Ñ¥Ù•	…ÑÑ±•¡…É…Ñ•É%¹‘•àôôôÀ(€€€€€€€€ü…ÕÑ½	…ÑÑ±”(€€€€€€€€è•ÑA…ÉÑåÕÑ½½¹™¥œ¡…Ñ¥Ù•	…ÑÑ±•¡…É…Ñ•É%¹‘•à¤¹•¹…‰±•ì(((€€€¥˜ (€€€€€€€€…‰…ÑÑ±•Ñ¥Ù”ñð(€€€€€€€…ÕÑ½=¸ñð(€€€€€€€…Ñ¥½¹I•…‘ä(€€€€¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾ò#žržjš*O–"Ã–§–-‰ÕŸ¾ò3¦÷šb¿’öÿžR£¢š2–ëžj¾ò'¾òh((€€€€€€€Ä¸ƒ¦g¢Ž‡–:šr³šÊKšr'¢¢·–ºi…Ñ¥½¹I•…‘äõÑÉÕ—¾ò0(€€€€€€€€€ƒ¦bË–F–ö‹–B3¢fo¢¢·¾ò3–þ¯¦¦¦î{šr’âžnÓ¦7šZÀ(€€€€€€€€€ƒ–"“–ºk¦¢¯š"C–*ž:¾ò3žnÓ–"Ãš"C–*ž
ëš¶‹ŠSŠP(€€€€€€€€€ƒš¶žŠë¢†3ž
ëš'¢¦Ëšb¿Ž3¦g–n{–B#–>«¢÷–b_¢¦›’âš²‡Ž7¾ò0(€€€€€€€€€ƒ¦î{’â/–:ï’æ/–ú3’â7žº‡žÖCšzs–š’öW¦÷¢š¦:[’ö?Ž((€€€€€€€È¸ƒ¦¢¯–:šr³šb¿Ž3š2'’â/–:ïž®/–"ï–"“–ºkŽ7¾ò0(€€€€€€€€€ƒ–º3–£¢ÞÏ¦;–º–F(¿žÖCžº_š¦–"ÛŽ(€€€€€€€€€ƒ’öÿžR£¢šb;žŠëš2–ë¾òk¦¢¯’æ¢šžr/šV?š6ßŠSŠP(€€€€€€€€€ƒšV?š6ß–’ƒ–þ¯žj¢žK¢&Ë–#šRïšN+¾ò0(€€€€€€€€€ƒšV?š6ßš‹žj¢žK¢&Ëš&7¢ò«–"Ã–b_¢¦›¦¢¯¾ò0(€€€€€€€€€ƒ–ššzsšV?š6ß–’«’ö;Ž¦¢¯¦
šÊK¢ò«–"Ã¢«–ÞÄ(€€€€€€€€€ƒ–ÂÇ–#¢Š¯š&Oš¶ï¾ò3¦
’æšb¿–B#žBžjžÖCšzs¾ò0(€€€€€€€€€ƒ’â7š'¢¦Ë¢ºO¦¢¯¢º+š"CŽ3’â7–>_šV?š6ß¦fC–"Ûžjž&çš²+Ž7Ž((€€€€€€ƒšRçš"C¢Þ–Û’î[¢†3–.W’âš¢–#–º–F+Ž(€€€€€€ƒžÖCžº_¦j;šº×š&7’úwšV?š6ß¦‚–ê?žrš¶–"“–ºk¦¢¯š"C’â7š"C–*Ž(€€€€¨¼((€€€…Ñ¥½¹I•…‘äõÑÉÕ”ì(((€€€ÅÕ•Õ•‘A±…å•ÉÑ¥½¹Íl(€€€€€€€…Ñ¥Ù•	…ÑÑ±•¡…É…Ñ•É%¹‘•à(€€€tõì((€€€€€€€…Ñ¥½¸è‰•Í…Á”ˆ°((€€€€€€€Ñ…É•Ðé¹Õ±°((€€€ôì(((€€€ÕÁ‘…Ñ•U$ ¤ì((€€€™¥¹¥Í¡A±…å•ÉÑ¥½¸ ¤ì()ô(((¼¨(€€ƒŠbƒšZÃ–Š{¾òk¦¢¯žjžrš¶–"“–ºk¾ò0(€€ƒ–>«–r£žÖCžº_¦j;šº×¢Š­É•Í½±Ù•EÕ•Õ•‘A±…å•ÉÑ¥½¸ §–Fó–>¯¾ò0(€€ƒ¦
?¢ò¿–º3–£š¾SžŸ–:šr±…ÑÑ•µÁÑÍ…Á” §¢Ž‡žj–"“–ºk–ò?¾ò0(€€ƒ–>«šb¿š*÷–ë’úžÖ›žÖCžº_¦j;šº×žR£Ž(¨¼()™Õ¹Ñ¥½¸É•Í½±Ù•Í…Á•ÑÑ•µÁÐ¡¡…É…Ñ•É%¹‘•à¥ì((€€€±•…É%¹Ñ•ÉÙ…°¡Ñ¥µ•É%¤ì(((€€€½¹ÍÐ…±¥Ù”€ô(€€€€€€€ÕÉÉ•¹Ñ	…ÑÑ±•5½¹ÍÑ•ÉÌ(€€€€€€€€¹µ…À (€€€€€€€€€€€¤ôùµ½¹ÍÑ•ÉÍm¥t(€€€€€€€€¤(€€€€€€€€¹™¥±Ñ•È (€€€€€€€€€€€´ôù´¹…±¥Ù”(€€€€€€€€¤ì(((€€€¥˜¡…±¥Ù”¹±•¹Ñ ôôôÀ¥ì((€€€€€€€¡•­	…ÑÑ±•¹ ¤ì((€€€€€€€É•ÑÕÉ¸ì((€€€ô(((€€€½¹ÍÐ¡¥¡•ÍÑ1•Ù•°€ô(€€€€€€€5…Ñ ¹µ…à (€€€€€€€€€€€€¸¸¹…±¥Ù”¹µ…À (€€€€€€€€€€€€€€€´ôù´¹±•Ù•°(€€€€€€€€€€€€¤(€€€€€€€€¤ì(((€€€½¹ÍÐ•Í…Á¥¹¡…É…Ñ•Èõ•ÑA…ÉÑå¡…É…Ñ•É	å%¹‘•à¡¡…É…Ñ•É%¹‘•à¥ññÁ±…å•Èì((€€€½¹ÍÐ¡…¹”€ô(€€€€€€€5…Ñ ¹µ…à (€€€€€€€€€€€€ÄÀ°(€€€€€€€€€€€5…Ñ ¹µ¥¸ (€€€€€€€€€€€€€€€€äÔ°(€€€€€€€€€€€€€€€€ÔÀ¬(€€€€€€€€€€€€€€€€ (€€€€€€€€€€€€€€€€€€€•Í…Á¥¹¡…É…Ñ•È¹±•Ù•°´(€€€€€€€€€€€€€€€€€€€¡¥¡•ÍÑ1•Ù•°(€€€€€€€€€€€€€€€€¤¨Ô(€€€€€€€€€€€€¤(€€€€€€€€¤ì(((€€€¥˜ (€€€€€€€5…Ñ ¹É…¹‘½´ ¤¨ÄÀÀð(€€€€€€€¡…¹”(€€€€¥ì((€€€€€€€‰…ÑÑ±•Ñ¥Ù”õ™…±Í”ì((€€€€€€€…ÕÑ½	…ÑÑ±”õ™…±Í”ì((€€€€€€€‰…ÑÑ±•Q½­•¸¬¬ì(((€€€€€€€…‘‘	…ÑÑ±•1½œ (€€€€€€€€€€€€‹š"C–*¦¢¯¾òˆ(€€€€€€€€¤ì(((€€€€€€€Í•ÑQ¥µ•½ÕÐ  ¤ôùì((€€€€€€€€€€€Í¡½ÝA…” ‰µ…Àˆ¤ì((€€€€€€€€€€€Í•Ñ5…Á½½±‘½Ý¸ ÌÀÀÀ¤ì(((€€€€€€€€€€€ÍÑ…ÉÑ5½¹ÍÑ•É5½Ù•µ•¹Ð ¤ì((€€€€€€€€€€€•¹ÍÕÉ•ÕÑ½A…ÑÉ½±%¹Ñ•ÉÙ…° ¤ì((€€€€€€€ô°ÄÐÀÀ¤ì((€€€ô(€€€•±Í•ì((€€€€€€€…‘‘	…ÑÑ±•1½œ (€€€€€€€€€€€€‹¦¢¯–’ÇšV_¾òˆ(€€€€€€€€¤ì(((€€€€€€€™¥¹¥Í¡A±…å•ÉÑ¥½¸ ¤ì((€€€ô()ô(((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€ƒš*¢÷¦ã–Z¸(ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼()™Õ¹Ñ¥½¸½Á•¹M­¥±±5•¹Ô ¥ì((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾òh(€€€€€€ƒ–:šr³¦g¢Ž‡šÂã¦ƒ¢º¡…É…Ñ•ÉM­¥±±1½…‘½ÕÑÌ¹™¥É—Ž(€€€€€€ƒšÂã¦ƒšª‹š~—–£–~žj…ÕÑ½	…ÑÑ±—¢Þ}Á±…å•È¹ÍÃ¾ò0(€€€€€€ƒž>û–r£šRçš"C’úwž…Ñ¥Ù•	…ÑÑ±•¡…É…Ñ•É%¹‘•à(€€€€€€ƒšÆë–ºk¢š¦†¿ž’ë¢ªÃžjš*¢÷š²Ž¢ªÃžjMCŽ(€€€€¨¼((€€€½¹ÍÐ…ÕÑ½=¸ô(€€€€€€€…Ñ¥Ù•	…ÑÑ±•¡…É…Ñ•É%¹‘•àôôôÀ(€€€€€€€€ü…ÕÑ½	…ÑÑ±”(€€€€€€€€è•ÑA…ÉÑåÕÑ½½¹™¥œ¡…Ñ¥Ù•	…ÑÑ±•¡…É…Ñ•É%¹‘•à¤¹•¹…‰±•ì(((€€€¥˜ (€€€€€€€€…‰…ÑÑ±•Ñ¥Ù”ñð(€€€€€€€…ÕÑ½=¸(€€€€¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€½¹ÍÐ…Ñ¥Ù•¡…É…Ñ•É%ô(€€€€€€€•ÑA…ÉÑå¡…É…Ñ•É-•ä¡…Ñ¥Ù•	…ÑÑ±•¡…É…Ñ•É%¹‘•à¤ì((€€€½¹ÍÐ…Ñ¥Ù•¡…É…Ñ•É=‰¨ô(€€€€€€€•ÑA…ÉÑå¡…É…Ñ•É	å%¹‘•à¡…Ñ¥Ù•	…ÑÑ±•¡…É…Ñ•É%¹‘•à¤ì(((€€€½¹ÍÐ¡…É…Ñ•È€ô(€€€€€€€¡…É…Ñ•ÉM­¥±±1½…‘½ÕÑÍl(€€€€€€€€€€€…Ñ¥Ù•¡…É…Ñ•É%(€€€€€€€tì(((€€€¥˜ (€€€€€€€€…¡…É…Ñ•Èñð(€€€€€€€€……Ñ¥Ù•¡…É…Ñ•É=‰¨(€€€€¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€½¹ÍÐµ•¹Ô€ô(€€€€€€€€ ‰Í­¥±±5•¹Ôˆ¤ì(((€€€µ•¹Ô¹¥¹¹•É!Q50ôˆˆì(((€€€€¼¨(€€€€€€ƒŠbƒšZÃ–Š{¾òk–ÆW¦Z/š¢‡–ò?žjžö»¦‚¢þS–n{š2'¦"WŽ(€€€€€€ƒšRû–r£šâ–Z»šr’â+¦v‹¾ò3–ÆW¦Z/’æ/–ú3’â7žR£šîG–"Ãšr’â/¦vˆ(€€€€€€ƒš&7š&û–ú_–"Ã¢þS–n{¾ò3’âš&O¦Z/–ÂÇžr/–ú_–"ÃŽ(€€€€¨¼((€€€½¹ÍÐÁ¥¹¹•‘	…¬ô(€€€€€€€‘½Õµ•¹Ð¹É•…Ñ•±•µ•¹Ð (€€€€€€€€€€€€‰‰ÕÑÑ½¸ˆ(€€€€€€€€¤ì(((€€€Á¥¹¹•‘	…¬¹±…ÍÍ9…µ”ô(€€€€€€€€‰ÍÕˆµµ•¹ÔµÁ¥¹¹•µ‰…¬ˆì(((€€€Á¥¹¹•‘	…¬¹Ñ•áÑ½¹Ñ•¹Ðô(€€€€€€€€‹¢þS–nxˆì(((€€€Á¥¹¹•‘	…¬¹½¹±¥¬ô(€€€€€€€±½Í•5•¹ÕÌì(((€€€µ•¹Ô¹…ÁÁ•¹‘¡¥± (€€€€€€€Á¥¹¹•‘	…¬(€€€€¤ì(((€€€¡…É…Ñ•È¹•ÅÕ¥ÁÁ•‘M­¥±±Ì(€€€€¹™½É… ¡Í­¥±±%ôùì((€€€€€€€½¹ÍÐÍ­¥±°€ô(€€€€€€€€€€€Í­¥±±…Ñ…‰…Í•mÍ­¥±±%‘tì(((€€€€€€€¥˜ …Í­¥±°¥ì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€ô(((€€€€€€€½¹ÍÐÍ­¥±±1•Ù•°€ô(€€€€€€€€€€€•ÑM­¥±±1•Ù•° (€€€€€€€€€€€€€€€…Ñ¥Ù•¡…É…Ñ•É%°(€€€€€€€€€€€€€€€Í­¥±±%(€€€€€€€€€€€€¤ì(((€€€€€€€½¹ÍÐÍÁ½ÍÐ€ô(€€€€€€€€€€€Í­¥±°¹ÍÁ½ÍÐ„ôõÕ¹‘•™¥¹•(€€€€€€€€€€€€ü(€€€€€€€€€€€Í­¥±°¹ÍÁ½ÍÐ(€€€€€€€€€€€€è(€€€€€€€€€€€Í­¥±°¹½ÍÐì(((€€€€€€€½¹ÍÐ•¹½Õ¡M@€ô(€€€€€€€€€€€…Ñ¥Ù•¡…É…Ñ•É=‰¨¹ÍÀøô(€€€€€€€€€€€ÍÁ½ÍÐì(((€€€€€€€½¹ÍÐ‰ÕÑÑ½¸€ô(€€€€€€€€€€€‘½Õµ•¹Ð¹É•…Ñ•±•µ•¹Ð (€€€€€€€€€€€€€€€€‰‰ÕÑÑ½¸ˆ(€€€€€€€€€€€€¤ì(((€€€€€€€‰ÕÑÑ½¸¹±…ÍÍ9…µ”€ô(€€€€€€€€€€€€‰ÍÕˆµ‰ÕÑÑ½¸ˆì(((€€€€€€€¥˜ …•¹½Õ¡M@¥ì((€€€€€€€€€€€‰ÕÑÑ½¸¹±…ÍÍ1¥ÍÐ¹…‘ (€€€€€€€€€€€€€€€€‰Í­¥±°µÍÀµ¥¹ÍÕ™™¥¥•¹Ðˆ(€€€€€€€€€€€€¤ì(((€€€€€€€€€€€‰ÕÑÑ½¸¹‘¥Í…‰±•õÑÉÕ”ì(((€€€€€€€€€€€‰ÕÑÑ½¸¹¥¹¹•É!Q50€ô((€€€€€€€€€€€€(€€€€€€€€€€€€ñ‘¥ØÍÑå±”ô‰‘¥ÍÁ±…äé™±•àí…±¥¸µ¥Ñ•µÌé•¹Ñ•Èí©ÕÍÑ¥™äµ½¹Ñ•¹ÐéÍÁ…”µ‰•ÑÝ••¸í…ÀèÙÁàìˆø(€€€€€€€€€€€€€€€€ñÍÁ…¸ÍÑå±”ô‰™½¹ÐµÍ¥é”èÄÕÁàí™½¹ÐµÝ•¥¡Ðé‰½±ìˆø(€€€€€€€€€€€€€€€€€€€€‘íÍ­¥±°¹¹…µ•ô(€€€€€€€€€€€€€€€€€€€€‘ì(€€€€€€€€€€€€€€€€€€€€€€€Í­¥±±1•Ù•°øÀ(€€€€€€€€€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€€€€€€€€€€‰1Ø¸ˆ­Í­¥±±1•Ù•°(€€€€€€€€€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€ð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€ñÍÁ…¸ÍÑå±”ô‰™½¹ÐµÍ¥é”èÄÅÁàí½±½ÈèŒäÍŒÕ™íÝ¡¥Ñ”µÍÁ…”é¹½ÝÉ…Àìˆø(€€€€€€€€€€€€€€€€€€€€‘í…Ñ¥Ù•¡…É…Ñ•É=‰¨¹ÍÁô¼‘íÍÁ½ÍÑôM@(€€€€€€€€€€€€€€€€ð½ÍÁ…¸ø(€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€ñ‘¥ØÍÑå±”ô‰™½¹ÐµÍ¥é”èÄÅÁàí½±½Èè™„Õ„Ôíµ…É¥¸µÑ½ÀèÉÁàìˆø(€€€€€€€€€€€€€€€MC’â7¢ÚÌ(€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€ì((€€€€€€€ô(€€€€€€€•±Í•ì((€€€€€€€€€€€½¹ÍÐ‘…µ…•AÉ•Ù¥•Ü€ô(€€€€€€€€€€€€€€€Í­¥±°¹‰…Í•…µ…”(€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€€‹–
ß–ºÏžÒˆ¬(€€€€€€€€€€€€€€€•ÑM­¥±±…µ…•Ñ1•Ù•° (€€€€€€€€€€€€€€€€€€€Í­¥±°°(€€€€€€€€€€€€€€€€€€€Í­¥±±1•Ù•±ñðÄ(€€€€€€€€€€€€€€€€¤¬(€€€€€€€€€€€€€€€€‹¾öpˆ(€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€€ˆˆì(((€€€€€€€€€€€‰ÕÑÑ½¸¹¥¹¹•É!Q50€ô((€€€€€€€€€€€€(€€€€€€€€€€€€ñ‘¥ØÍÑå±”ô‰‘¥ÍÁ±…äé™±•àí…±¥¸µ¥Ñ•µÌé•¹Ñ•Èí©ÕÍÑ¥™äµ½¹Ñ•¹ÐéÍÁ…”µ‰•ÑÝ••¸í…ÀèÙÁàìˆø(€€€€€€€€€€€€€€€€ñÍÁ…¸ÍÑå±”ô‰™½¹ÐµÍ¥é”èÄÕÁàí™½¹ÐµÝ•¥¡Ðé‰½±ìˆø(€€€€€€€€€€€€€€€€€€€€‘íÍ­¥±°¹¹…µ•ô(€€€€€€€€€€€€€€€€€€€€‘ì(€€€€€€€€€€€€€€€€€€€€€€€Í­¥±±1•Ù•°øÀ(€€€€€€€€€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€€€€€€€€€€‰1Ø¸ˆ­Í­¥±±1•Ù•°(€€€€€€€€€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€ð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€ñÍÁ…¸ÍÑå±”ô‰™½¹ÐµÍ¥é”èÄÅÁàí½±½ÈèŒäÍŒÕ™íÝ¡¥Ñ”µÍÁ…”é¹½ÝÉ…Àìˆø(€€€€€€€€€€€€€€€€€€€€‘íÍÁ½ÍÑôM@(€€€€€€€€€€€€€€€€ð½ÍÁ…¸ø(€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€ñ‘¥ØÍÑå±”ô‰™½¹ÐµÍ¥é”èÄÅÁàí½±½ÈèÅÕ‘ˆíµ…É¥¸µÑ½ÀèÉÁàìˆø(€€€€€€€€€€€€€€€€‘í‘…µ…•AÉ•Ù¥•Ýô‘íÍ­¥±°¹‘•ÍÉ¥ÁÑ¥½¹ô(€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€ì(((€€€€€€€€€€€‰ÕÑÑ½¸¹½¹±¥¬ô ¤ôùì(€€€€€€€€€€€€€€€ÁÉ•Á…É•Ñ¥½¸ (€€€€€€€€€€€€€€€€€€€Í­¥±°¹¥(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ôì((€€€€€€€ô(((€€€€€€€µ•¹Ô¹…ÁÁ•¹‘¡¥± (€€€€€€€€€€€‰ÕÑÑ½¸(€€€€€€€€¤ì((€€€ô¤ì(((€€€½¹ÍÐ‰…¬€ô(€€€€€€€‘½Õµ•¹Ð¹É•…Ñ•±•µ•¹Ð (€€€€€€€€€€€€‰‰ÕÑÑ½¸ˆ(€€€€€€€€¤ì(((€€€‰…¬¹±…ÍÍ9…µ”€ô(€€€€€€€€‰ÍÕˆµ‰ÕÑÑ½¸ˆì(((€€€‰…¬¹Ñ•áÑ½¹Ñ•¹Ð€ô(€€€€€€€€‹¢þS–nxˆì(((€€€‰…¬¹½¹±¥¬€ô(€€€€€€€±½Í•5•¹ÕÌì(((€€€µ•¹Ô¹…ÁÁ•¹‘¡¥± (€€€€€€€‰…¬(€€€€¤ì(((€€€€ ‰µ…¥¹	…ÑÑ±•5•¹Ôˆ¤(€€€€€€€€¹ÍÑå±”¹‘¥ÍÁ±…ä€ô(€€€€€€€€‰¹½¹”ˆì(((€€€€ ‰¥Ñ•µ5•¹Ôˆ¤(€€€€€€€€¹±…ÍÍ1¥ÍÐ(€€€€€€€€¹É•µ½Ù” ‰Í¡½Üˆ¤ì(((€€€€ ‰Í­¥±±5•¹Ôˆ¤(€€€€€€€€¹±…ÍÍ1¥ÍÐ(€€€€€€€€¹…‘ ‰Í¡½Üˆ¤ì(((€€€€¼¨(€€€€€€ƒŠbƒ–ÆW¦Z/š*¢÷¦ã–Z»¾ò3¢N/’ö?š«ž&§–6 ¿–n{–B#¢Î¢¢(¼(€€€€€€ƒš"Ã¦²—žÒ¦2¦
’â–†+¾ò3¢ºOž:§–ºÛ–r£š¾S¢ò–’Ÿžjž&#¦v‹’â((€€€€€€ƒš2Gš*¢÷¾ò3¦ã–º3š"[š2'¢þS–n{šr¢«–.WšRÛ–B (€€€€€€ƒ¾ò#šRÛ–B#¦
?¢ò¿–r¡±½Í•5•¹ÕÌ §¾ò'Ž(€€€€¨¼((€€€€ ‰Í­¥±±5•¹Ôˆ¤(€€€€€€€€¹±…ÍÍ1¥ÍÐ(€€€€€€€€¹…‘ ‰•áÁ…¹‘•ˆ¤ì()ô(()™Õ¹Ñ¥½¸½Á•¹%Ñ•µ5•¹Ô ¥ì((€€€¥˜ (€€€€€€€€…‰…ÑÑ±•Ñ¥Ù”ñð(€€€€€€€…ÕÑ½	…ÑÑ±”(€€€€¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô((€€€€¼¨ƒš"Ã¦²—¢3–2šb¿ž6£ž®/¢š¢N/–Æ“¾ò3’â7–7žR£¢"(•áÁ…¹‘•ƒ–æû’öWŽ€¨¼(€€€½¹ÍÐÅÕ¥­	…Èô ‰Í­¥±±EÕ¥­	…Èˆ¤ì(€€€¥˜¡ÅÕ¥­	…È¥ì(€€€€€€€ÅÕ¥­	…È¹±…ÍÍ1¥ÍÐ¹É•µ½Ù” ‰Í¡½Üˆ¤ì(€€€ô((€€€€ ‰Í­¥±±5•¹Ôˆ¤(€€€€€€€€¹±…ÍÍ1¥ÍÐ(€€€€€€€€¹É•µ½Ù” ‰Í¡½Üˆ¤ì((€€€€ ‰Í­¥±±5•¹Ôˆ¤(€€€€€€€€¹±…ÍÍ1¥ÍÐ(€€€€€€€€¹É•µ½Ù” ‰•áÁ…¹‘•ˆ¤ì((€€€‰…ÑÑ±•%Ñ•µ…Ñ•½Éäô‰Á½Ñ¥½¸ˆì(€€€É•¹‘•É	…ÑÑ±•%Ñ•µ5•¹Ô ¤ì((€€€€ ‰¥Ñ•µ5•¹Ôˆ¤(€€€€€€€€¹±…ÍÍ1¥ÍÐ(€€€€€€€€¹…‘ ‰Í¡½Üˆ¤ì((€€€Íå¹QÕÉ¹Q¥µ•É]¥Ñ¡	…ÑÑ±•A¥­•ÉÌ ¤ì()ô(()™Õ¹Ñ¥½¸±½Í•5•¹ÕÌ ¥ì((€€€½¹ÍÐÅÕ¥­	…Èô(€€€€€€€€ ‰Í­¥±±EÕ¥­	…Èˆ¤ì((€€€¥˜¡ÅÕ¥­	…È¥ì(€€€€€€€ÅÕ¥­	…È¹±…ÍÍ1¥ÍÐ¹É•µ½Ù” (€€€€€€€€€€€€‰Í¡½Üˆ(€€€€€€€€¤ì(€€€ô((€€€€ ‰Í­¥±±5•¹Ôˆ¤(€€€€€€€€¹±…ÍÍ1¥ÍÐ(€€€€€€€€¹É•µ½Ù” ‰Í¡½Üˆ¤ì((€€€€ ‰Í­¥±±5•¹Ôˆ¤(€€€€€€€€¹±…ÍÍ1¥ÍÐ(€€€€€€€€¹É•µ½Ù” ‰•áÁ…¹‘•ˆ¤ì((€€€½¹ÍÐ¥Ñ•µ5•¹Ôô ‰¥Ñ•µ5•¹Ôˆ¤ì(€€€¥˜¡¥Ñ•µ5•¹Ô¥ì(€€€€€€€¥Ñ•µ5•¹Ô¹±…ÍÍ1¥ÍÐ¹É•µ½Ù” ‰Í¡½Üˆ¤ì(€€€ô((€€€Íå¹QÕÉ¹Q¥µ•É]¥Ñ¡	…ÑÑ±•A¥­•ÉÌ ¤ì()ô(((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€ƒ¢^—šÂÐ(ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼((¼¨(€€ƒŠbƒšZÃ–Š{¾òk¦bËžš›Ž((€€ƒ¦ãšN¦bËžš›žj¢¦Ç¾ò3šr³–n{–B#’â7šRïšN+¾ò0(€€ƒ’öš:—’â/’úš«ž&§šRïšN+¦j;šº×–Â7¦g–/¢žK¢&Ë¦ƒš"Cžj–
ß–ºÌ(€€ƒšr–7š&L×š*c¾ò#¢Þ¦bËžš›–*ošâo–
ßžZ+–*ƒ¾ò3’â7šb¿–>[’î¾ò'Ž(€€ƒšV#šzsš2žê3–"Ã¦g–/¢žK¢&Ë¢«–ÞÇžj’â/’â–n{–B#¦Z/–ž/ž
ëš¶ˆ(€€ƒ¾ò!‰•¥¹¡…É…Ñ•ÉQÕÉ¸ §¢Ž‡šršâš:'¦g–/š¢g¢¢c¾ò'Ž((€€ƒ¢Þ}ÕÍ•A½Ñ¥½¸ §’âš¢’â7žR£¦ãžn»š¢g¾ò0(€€ƒ¦î{’â/–:ïžnÓš:—žRšV#ŽžÖCšv¦g–/¢žK¢&Ëžj¢†3–.WŽ(¨¼((¼¨(€€ƒŠbƒ’þ»š¶¾òh(€€ƒš*+Ž3žrš¶–~ß¢†3¦bËžš›Ž7žj¦
?¢ò¿š*÷š"Cž6£ž®/–÷–ò?¾ò0(€€ƒš&/–.Wš2'¦bËžš›¦"W¾ò!ÕÍ••™•¹ §¾ò3šr'¦bË–FšªS’ö?¢«–.Wš¢‡–ò?’â/¢ª“¢žã¾ò$(€€ƒ¢Þ¢«–.Wš"Ã¦²—¢¢·–ºkš"C¦bËžš›¾ò!…ÕÑ½Ñ¥½¸ §¢Ž‡žnÓš:—–Fó–>¯¾ò$(€€ƒ–§šŠw¢Þ¿–úG–ÇžR£¦g–/š‚ã–þ¦
?¢ò¿¾ò0(€€ƒ’â7šr–ëž>ûŽ3¢«–.Wš¢‡–ò?¢ºûš"C¦bËžš›–6ï¢Š¯¦bË–FšN/’ö?’â7žRšV#Ž7žj–V?¦†3Ž(¨¼((¼¨(€€ƒŠbƒ’þ»š¶¾ò#žržjš*O–"Ã’â–-‰ÕŸ¾ò'¾òh(€€Á±…å•ÈËžj¢«–.WšRïšN(¿š*¢÷¾ò!Á±…å•ÈÉ9½Éµ…±ÑÑ…¯Ž(€€…ÍÑA±…å•ÈÉM­¥±³¾ò'¦÷’â7šr¢«–ÞÇ–Fó–>¬(€€™¥¹¥Í¡A±…å•ÉÑ¥½¸ §ŠSŠSžRÅ‰•¥¹¡…É…Ñ•ÉQÕÉ¸ ¤(€€ƒžj¢«–.W–"šÒû¦
?¢ò¿žÖÇ’â–r£–’[¦v‹–Fó–>¯’âš²‡Ž((€€ƒ–ššzs¦g¢Ž‡žj¦bËžš›’æ–r£–Ÿ¦£–Fó–>­™¥¹¥Í¡A±…å•ÉÑ¥½¸ §¾ò0(€€ƒ–’[¦v‹¦
–/Ž3–Fó–>¯–º1Á±…å•ÈÉÕÑ½Ñ¥½¸ ¤(€€ƒ’æ/–ú3–7–Fó–>¯’âš²…™¥¹¥Í¡A±…å•ÉÑ¥½¸ §Ž7žj¦
?¢ò¼(€€ƒšr¢º+š"C–Fó–>¯–§š²‡¾ò3–Â;¢Ó¢†3–.W¦‚–ê?¢Š¯¢ÞÏ¢fŽ(€€ƒ¢žK¢&ËžÒ‹–òW¦2¿’êŽ((€€ƒš&’î—š.š"C–§–Æ“¾òh(€€Í•Ñ•™•¹‘¥¹MÑ…Ñ” §–>«¢Êƒ¢Ê³Ž3¢¢·–ºk¦bËžš›ž.š,¯¢¢c¦2Ž7¾ò0(€€ƒ’â7žº‡¦Ë’â7¦Ë–ê›¾òl(€€…ÁÁ±å•™•¹‘™™•Ð §šb¿žÖ›Ž3šr¢«–ÞÇ¢Êƒ¢Ê³žÖCšv¢†3–.WŽ4(€€ƒžj–Fó–>¯¢žR£¾ò#š&/–.W¦bËžš›ŽÁ±…å•ÈÇ¢«–.W¦bËžš›¾ò'¾ò0(€€ƒ–Ÿ¦£š&7–Fó–>­™¥¹¥Í¡A±…å•ÉÑ¥½¸ §Ž(€€Á±…å•ÈÉÕÑ½Ñ¥½¸ §žj¦bËžš›–"šR¿–&žnÓš:—–Fó–>¬(€€Í•Ñ•™•¹‘¥¹MÑ…Ñ” §¾ò3¢ºO–’[–Æ“žÖÇ’â–Fó–>¬(€€™¥¹¥Í¡A±…å•ÉÑ¥½¸ §¾ò3žÚ·š2¢Þ–Û’îYÁ±…å•ÈÈ(€€ƒ¢«–.W¢†3–.W¢Þ¿–úG’â¢Óžj–Fó–>¯šZç–ò?Ž(¨¼()™Õ¹Ñ¥½¸Í•Ñ•™•¹‘¥¹MÑ…Ñ”¡¡…É…Ñ•É%¹‘•à¥ì(€€€½¹ÍÐ…Ñ¥Ù•¡…É…Ñ•Èô(€€€€€€€•ÑA…ÉÑå¡…É…Ñ•É	å%¹‘•à¡¡…É…Ñ•É%¹‘•à¤ì(((€€€¥˜ ……Ñ¥Ù•¡…É…Ñ•È¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€…Ñ¥Ù•¡…É…Ñ•È¹¥Í•™•¹‘¥¹œô(€€€€€€€ÑÉÕ”ì(((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò'¾òh(€€€€€€ƒ¦g¢Ž‡–:šr³šr¦†7–’[–6Ã’â¢†3Ž3šNë–ë¦bËžš›–žÿš/¾ò0(€€€€€€ƒšr³–n{–B#–>_–"Ãžj–
ß–ºÏšâo–6+Ž7¾ò0(€€€€€€ƒ’öÿžR£¢¢šë–ú_šÊK–þ¢šŠSŠS¦bËžš›šr'šÊKšr'žRšV#¾ò0(€€€€€€ƒš'¢¦ËžnÓš:—–>7šbƒ–r£Ž3¢Š¯šRïšN+šfžj¦
’â¢†3Ž7¾ò0(€€€€€€ƒš¢g¢¢ïŽ3¾ò#¦bËžš›ž.š/–
ß–ºÏšâo–6+¾ò'Ž7–ÂÇ–’ƒ’ê¾ò0(€€€€€€ƒ’â7¦r¢š–>›–’[–’k’â¢†3’ê/–#–º–F+žj¢¢+š¿Ž(€€€€€€ƒ¦g¢Ž‡š.ÿš:'¦g¢†1±½Ÿ¾ò3šV#šzsšr³¢ê¬(€€€€€€ƒ¾ò!¥Í•™•¹‘¥¹œõÑÉÕ—¾ò'¦
šb¿žŸ–âã––_žR£Ž(€€€€¨¼((€€€ÕÁ‘…Ñ•U$ ¤ì()ô(()™Õ¹Ñ¥½¸…ÁÁ±å•™•¹‘™™•Ð¡¡…É…Ñ•É%¹‘•à¥ì((€€€Í•Ñ•™•¹‘¥¹MÑ…Ñ” (€€€€€€€¡…É…Ñ•É%¹‘•à(€€€€¤ì(((€€€™¥¹¥Í¡A±…å•ÉÑ¥½¸ ¤ì()ô(()™Õ¹Ñ¥½¸ÕÍ••™•¹ ¥ì(€€€½¹ÍÐ…ÕÑ½=¸ô(€€€€€€€…Ñ¥Ù•	…ÑÑ±•¡…É…Ñ•É%¹‘•àôôôÀ(€€€€€€€€ü…ÕÑ½	…ÑÑ±”(€€€€€€€€è•ÑA…ÉÑåÕÑ½½¹™¥œ¡…Ñ¥Ù•	…ÑÑ±•¡…É…Ñ•É%¹‘•à¤¹•¹…‰±•ì((€€€½¹ÍÐ…Ñ¥Ù•¡…É…Ñ•Èô(€€€€€€€•ÑA…ÉÑå¡…É…Ñ•É	å%¹‘•à¡…Ñ¥Ù•	…ÑÑ±•¡…É…Ñ•É%¹‘•à¤ì(((€€€¥˜ (€€€€€€€€…‰…ÑÑ±•Ñ¥Ù”ñð(€€€€€€€…ÕÑ½=¸ñð(€€€€€€€…Ñ¥½¹I•…‘äñð(€€€€€€€€……Ñ¥Ù•¡…É…Ñ•Èñð(€€€€€€€…Ñ¥Ù•¡…É…Ñ•È¹¡ÀðôÀ(€€€€¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾ò#žržjš*O–"Ã–§–-‰ÕŸ¾ò'¾òh((€€€€€€€Ä¸ƒ¦g¢Ž‡–:šr³–>«Ž3šª‹š~—Ž5…Ñ¥½¹I•…‘ç¾ò0(€€€€€€€€€ƒ–ú{’úšÊKšr'Ž3¢¢·–ºkŽ5…Ñ¥½¹I•…‘äõÑÉÕ—¾ò0(€€€€€€€€€ƒž¶'šZó¦g¦O¦bË–F–ö‹–B3¢fo¢¢·ŠSŠP(€€€€€€€€€ƒš&/š2š2'–þ¯’â¦î{¾ò3ž²³’ê3š²‡¦î{šN+šr–r (€€€€€€€€€™¥¹¥Í¡A±…å•ÉÑ¥½¸ §žrš¶š*+ž.š/¦:[’ö?’æ/–&4(€€€€€€€€€ƒ–ÂÇ–#¦^[¦^sš"C–*¾ò3–Â;¢Ó–B3’â–/¢žK¢&Ëžj¢†3–.T(€€€€€€€€€ƒ¢Š¯–º–F+–§š²‡Ž¦Ë–ê›¢Š¯š:£¦Ë–§š²‡¾ò0(€€€€€€€€€ƒ–ú3¦v‹žj¢žK¢&È¿š«ž&§žj–~ß¢†3¦‚–ê?–ÂÇšVÓ–/¦2¿’ê¾ò0(€€€€€€€€€ƒ¦gš¶šb¿Ž3š«ž&§šRïšN+–§š²‡Ž7¢3–ú3žjžrš¶–:–nƒŽ((€€€€€€€È¸ƒ¢žK¢&Ë–ÞËžÚOš¶ï’ê‡¾ò!!@ðôÃ¾ò'¦
šb¿¢÷š2'¦bËžš›¾ò0(€€€€€€€€€ƒ¦g¢Ž‡’æ’â’ö×¢Žs’â+¦bË–FŽ((€€€€€€ƒ¦g¢Ž‡–r£žrš¶žRšV#’æ/–&7ž®/–"ï¦:[’ö=…Ñ¥½¹I•…‘ç¾ò0(€€€€€€ƒž²³’ê3š²‡¦î{šN+šržnÓš:—¢Š¯’â+¦v‹¦
¦MÕ…É“šN/’â/’úŽ(€€€€¨¼((€€€…Ñ¥½¹I•…‘äõÑÉÕ”ì(((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾ò#¦7¢š¾ò3’úwžŸ’öÿžR£¢šb;žŠëš2š¶¾ò'¾òh(€€€€€€ƒ¦bËžš›’æ/–&7šb¿Ž3š2'’ê–ÂÇž®/–"ïžRšV#Ž7¾ò0€€€€€€ƒ¢ÞÏ¦;–º–F(¿žÖCžº_šÖž¢/Ž(€€€€€€ƒž>û–r£šRçš"C¢Þ–Û’î[¢†3–.W’âš¢–#–º–F+Ž(€€€€€€ƒž¶'žÖCžº_¦j;šº×žŸšV?š6ß¦‚–ê?š&7žrš¶žRšV#ŠSŠP(€€€€€€ƒ¦n[žÛ¦bËžš›šr³¢ê¯Ž3’þw¢¶ßžjšb¿š:—’â/’ú–>_–"Ãžj–
ß–ºÏŽ7¾ò0€€€€€€ƒ’â7–’«–>_¦‚–ê?–öÇ¦~ÿ¾ò3’öž:§–ºÛšb;žŠë¢ššÆ(€€€€€€ƒŽ3š&šr'¢†3–.W¦÷¢š¦×–ú«–B3’â––_–º–F(¿žÖCžº_š¦–"ÛŽ7¾ò0(€€€€€€ƒ’â7¢ššr'¦bËžš›¦gž¢»ž&ç’ú/¾ò3¦g¢Ž‡–ÂÇžŸ–kŽ(€€€€¨¼((€€€ÅÕ•Õ•‘A±…å•ÉÑ¥½¹Íl(€€€€€€€…Ñ¥Ù•	…ÑÑ±•¡…É…Ñ•É%¹‘•à(€€€tõì((€€€€€€€…Ñ¥½¸è‰‘•™•¹ˆ°((€€€€€€€Ñ…É•Ðé¹Õ±°((€€€ôì(((€€€ÕÁ‘…Ñ•U$ ¤ì((€€€™¥¹¥Í¡A±…å•ÉÑ¥½¸ ¤ì()ô(()™Õ¹Ñ¥½¸ÕÍ•A½Ñ¥½¸¡Á½Ñ¥½¹%¥ì((€€€€¼¨(€€€€€€XäÇ¾òkš"Ã¦²—–º–F+žnÓš:—¢¢c’ö?Ž3–N«’âžNÛŽ7¢^—šÂÓ¾ò0(€€€€€€ƒ’â7–7–>«¢¢`¡À½ÍÀƒ¦†{–z/Žžrš¶š&¢3–2šVã¦?¢"(€€€€€€ƒžfû–"š¾Sš‹–ú§’î7žVg–r£šV?š6ßš:K–ê?–ú3žjžÖCžº_¦j;šº×Ž(€€€€¨¼((€€€½¹ÍÐ‘•™¥¹¥Ñ¥½¸õ•ÑA½Ñ¥½¹•™¥¹¥Ñ¥½¸¡Á½Ñ¥½¹%¤ì((€€€¥˜ …‘•™¥¹¥Ñ¥½¸¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô((€€€½¹ÍÐ…ÕÑ½=¸ô(€€€€€€€…Ñ¥Ù•	…ÑÑ±•¡…É…Ñ•É%¹‘•àôôôÀ(€€€€€€€€ü…ÕÑ½	…ÑÑ±”(€€€€€€€€è•ÑA…ÉÑåÕÑ½½¹™¥œ¡…Ñ¥Ù•	…ÑÑ±•¡…É…Ñ•É%¹‘•à¤¹•¹…‰±•ì((€€€¥˜ (€€€€€€€€…‰…ÑÑ±•Ñ¥Ù”ñð(€€€€€€€…ÕÑ½=¸ñð(€€€€€€€…Ñ¥½¹I•…‘ä(€€€€¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô((€€€½¹ÍÐ…Ñ¥Ù•¡…É…Ñ•Èô(€€€€€€€•ÑA…ÉÑå¡…É…Ñ•É	å%¹‘•à¡…Ñ¥Ù•	…ÑÑ±•¡…É…Ñ•É%¹‘•à¤ì((€€€¥˜ (€€€€€€€€……Ñ¥Ù•¡…É…Ñ•Èñð(€€€€€€€…Ñ¥Ù•¡…É…Ñ•È¹¡ÀðôÀ(€€€€¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô((€€€¥˜¡•ÑA½Ñ¥½¹½Õ¹Ð¡Á½Ñ¥½¹%¤ðôÀ¥ì(€€€€€€€…‘‘	…ÑÑ±•1½œ (€€€€€€€€€€€‘•™¥¹¥Ñ¥½¸¹¹…µ”¬(€€€€€€€€€€€€‹žn»–&7šÊKšr'–ê¯–¶cŽˆ(€€€€€€€€¤ì(€€€€€€€É•¹‘•É	…ÑÑ±•A½Ñ¥½¹5•¹Ô ¤ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô((€€€½¹ÍÐÍÑ…ÑÌô(€€€€€€€•ÑA…ÉÑå	…ÑÑ±•MÑ…ÑÌ¡…Ñ¥Ù•	…ÑÑ±•¡…É…Ñ•É%¹‘•à¤ì((€€€¥˜ (€€€€€€€‘•™¥¹¥Ñ¥½¸¹É•Í½ÕÉ”ôôô‰¡Àˆ€˜˜(€€€€€€€…Ñ¥Ù•¡…É…Ñ•È¹¡ÀøõÍÑ…ÑÌ¹µ…á!@(€€€€¥ì(€€€€€€€…‘‘	…ÑÑ±•1½œ ‰!C–ÞËžÚOšb¿šîÿžjŽˆ¤ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô((€€€¥˜ (€€€€€€€‘•™¥¹¥Ñ¥½¸¹É•Í½ÕÉ”ôôô‰ÍÀˆ€˜˜(€€€€€€€…Ñ¥Ù•¡…É…Ñ•È¹ÍÀøõÍÑ…ÑÌ¹µ…áM@(€€€€¥ì(€€€€€€€…‘‘	…ÑÑ±•1½œ ‰MC–ÞËžÚOšb¿šîÿžjŽˆ¤ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô((€€€…Ñ¥½¹I•…‘äõÑÉÕ”ì((€€€ÅÕ•Õ•‘A±…å•ÉÑ¥½¹Íl(€€€€€€€…Ñ¥Ù•	…ÑÑ±•¡…É…Ñ•É%¹‘•à(€€€tõì(€€€€€€€…Ñ¥½¸è‰Á½Ñ¥½¸ˆ°(€€€€€€€Á½Ñ¥½¹%éÁ½Ñ¥½¹%°(€€€€€€€Ñ…É•Ðé¹Õ±°(€€€ôì((€€€±½Í•5•¹ÕÌ ¤ì(€€€ÕÁ‘…Ñ•U$ ¤ì(€€€™¥¹¥Í¡A±…å•ÉÑ¥½¸ ¤ì)ô(()™Õ¹Ñ¥½¸…ÁÁ±åA½Ñ¥½¹™™•Ð¡Á½Ñ¥½¹%±¡…É…Ñ•É%¹‘•à¥ì((€€€½¹ÍÐ‘•™¥¹¥Ñ¥½¸õ•ÑA½Ñ¥½¹•™¥¹¥Ñ¥½¸¡Á½Ñ¥½¹%¤ì((€€€¥˜ …‘•™¥¹¥Ñ¥½¸¥ì(€€€€€€€…‘‘	…ÑÑ±•1½œ ‹š&û’â7–"Ã¦g–/¢^—šÂÓ¢ÎšZgŽˆ¤ì(€€€€€€€™¥¹¥Í¡A±…å•ÉÑ¥½¸ ¤ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô((€€€½¹ÍÐ…Ñ¥Ù•¡…É…Ñ•Èô(€€€€€€€•ÑA…ÉÑå¡…É…Ñ•É	å%¹‘•à¡¡…É…Ñ•É%¹‘•à¤ì((€€€¥˜ ……Ñ¥Ù•¡…É…Ñ•È¥ì(€€€€€€€™¥¹¥Í¡A±…å•ÉÑ¥½¸ ¤ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô((€€€½¹ÍÐÍÑ…ÑÌô(€€€€€€€•ÑA…ÉÑå	…ÑÑ±•MÑ…ÑÌ¡¡…É…Ñ•É%¹‘•à¤ì((€€€½¹ÍÐµ…áY…±Õ”ô(€€€€€€€‘•™¥¹¥Ñ¥½¸¹É•Í½ÕÉ”ôôô‰¡Àˆ(€€€€€€€€üÍÑ…ÑÌ¹µ…á!@(€€€€€€€€èÍÑ…ÑÌ¹µ…áM@ì((€€€½¹ÍÐÕÉÉ•¹ÑY…±Õ”ô(€€€€€€€‘•™¥¹¥Ñ¥½¸¹É•Í½ÕÉ”ôôô‰¡Àˆ(€€€€€€€€ü…Ñ¥Ù•¡…É…Ñ•È¹¡À(€€€€€€€€è…Ñ¥Ù•¡…É…Ñ•È¹ÍÀì((€€€¥˜¡ÕÉÉ•¹ÑY…±Õ”øõµ…áY…±Õ”¥ì(€€€€€€€…‘‘	…ÑÑ±•1½œ (€€€€€€€€€€€€¡‘•™¥¹¥Ñ¥½¸¹É•Í½ÕÉ”ôôô‰¡Àˆ€ü€‰!@ˆ€è€‰M@ˆ¤¬(€€€€€€€€€€€€‹–ÞËžÚOšb¿šîÿžjŽˆ(€€€€€€€€¤ì(€€€€€€€™¥¹¥Í¡A±…å•ÉÑ¥½¸ ¤ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô((€€€¥˜¡•ÑA½Ñ¥½¹½Õ¹Ð¡Á½Ñ¥½¹%¤ðôÀ¥ì(€€€€€€€…‘‘	…ÑÑ±•1½œ (€€€€€€€€€€€‘•™¥¹¥Ñ¥½¸¹¹…µ”¬(€€€€€€€€€€€€‹žn»–&7šÊKšr'–ê¯–¶cŽˆ(€€€€€€€€¤ì(€€€€€€€™¥¹¥Í¡A±…å•ÉÑ¥½¸ ¤ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô((€€€±•ÐÁ±…¹¹•‘I•½Ù•Éäì((€€€¥˜¡‘•™¥¹¥Ñ¥½¸¹É•½Ù•ÉåA•É•¹ÐøôÄÀÀ¥ì(€€€€€€€Á±…¹¹•‘I•½Ù•Éäõµ…áY…±Õ”µÕÉÉ•¹ÑY…±Õ”ì(€€€õ•±Í•ì(€€€€€€€Á±…¹¹•‘I•½Ù•Éäõ5…Ñ ¹µ…à (€€€€€€€€€€€€Ä°(€€€€€€€€€€€5…Ñ ¹É½Õ¹ (€€€€€€€€€€€€€€€µ…áY…±Õ”¨(€€€€€€€€€€€€€€€‘•™¥¹¥Ñ¥½¸¹É•½Ù•ÉåA•É•¹Ð¼(€€€€€€€€€€€€€€€€ÄÀÀ(€€€€€€€€€€€€¤(€€€€€€€€¤ì(€€€ô((€€€½¹ÍÐÉ•½Ù•É•õ5…Ñ ¹µ…à (€€€€€€€€À°(€€€€€€€5…Ñ ¹µ¥¸ (€€€€€€€€€€€µ…áY…±Õ”µÕÉÉ•¹ÑY…±Õ”°(€€€€€€€€€€€Á±…¹¹•‘I•½Ù•Éä(€€€€€€€€¤(€€€€¤ì((€€€¥˜¡É•½Ù•É•ðôÀ¥ì(€€€€€€€™¥¹¥Í¡A±…å•ÉÑ¥½¸ ¤ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô((€€€¥˜ …½¹ÍÕµ•A½Ñ¥½¹É½µ%¹Ù•¹Ñ½Éä¡Á½Ñ¥½¹%°Ä¤¥ì(€€€€€€€…‘‘	…ÑÑ±•1½œ (€€€€€€€€€€€‘•™¥¹¥Ñ¥½¸¹¹…µ”¬(€€€€€€€€€€€€‹š&¦f“–’ÇšV_Žˆ(€€€€€€€€¤ì(€€€€€€€™¥¹¥Í¡A±…å•ÉÑ¥½¸ ¤ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô((€€€¥˜¡‘•™¥¹¥Ñ¥½¸¹É•Í½ÕÉ”ôôô‰¡Àˆ¥ì(€€€€€€€…Ñ¥Ù•¡…É…Ñ•È¹¡Àõ5…Ñ ¹µ¥¸ (€€€€€€€€€€€ÍÑ…ÑÌ¹µ…á!@°(€€€€€€€€€€€…Ñ¥Ù•¡…É…Ñ•È¹¡À­É•½Ù•É•(€€€€€€€€¤ì((€€€€€€€Í¡½ÝA±…å•É!¥Ð (€€€€€€€€€€€É•½Ù•É•°(€€€€€€€€€€€€‰¡•…°ˆ°(€€€€€€€€€€€¡…É…Ñ•É%¹‘•à°(€€€€€€€€€€€ÑÉÕ”(€€€€€€€€¤ì(€€€õ•±Í•ì(€€€€€€€…Ñ¥Ù•¡…É…Ñ•È¹ÍÀõ5…Ñ ¹µ¥¸ (€€€€€€€€€€€ÍÑ…ÑÌ¹µ…áM@°(€€€€€€€€€€€…Ñ¥Ù•¡…É…Ñ•È¹ÍÀ­É•½Ù•É•(€€€€€€€€¤ì((€€€€€€€Í¡½ÝA±…å•É!¥Ð (€€€€€€€€€€€É•½Ù•É•°(€€€€€€€€€€€€‰ÍÀˆ°(€€€€€€€€€€€¡…É…Ñ•É%¹‘•à°(€€€€€€€€€€€ÑÉÕ”(€€€€€€€€¤ì(€€€ô((€€€…‘‘	…ÑÑ±•1½œ (€€€€€€€€¡…Ñ¥Ù•¡…É…Ñ•È¹¥‘ñð‹’ö€ˆ¤¬(€€€€€€€€‹’öÿžR ˆ¬(€€€€€€€‘•™¥¹¥Ñ¥½¸¹¹…µ”¬(€€€€€€€€‹¾ò3š‹–ú¤ˆ¬(€€€€€€€É•½Ù•É•¬(€€€€€€€€ˆ€ˆ¬(€€€€€€€‘•™¥¹¥Ñ¥½¸¹É•Í½ÕÉ”¹Ñ½UÁÁ•É…Í” ¤¬(€€€€€€€€‹Žˆ(€€€€¤ì((€€€ÕÁ‘…Ñ•U$ ¤ì(€€€Í…Ù•…µ” ¤ì(€€€™¥¹¥Í¡A±…å•ÉÑ¥½¸ ¤ì)ô(((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€ƒ¢«–.Wš"Ã¦²”(ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼()™Õ¹Ñ¥½¸Ñ½±•ÕÑ½	…ÑÑ±” ¥ì((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3¢ºO–Þ‡¦
?¦‚¦v‹žj(€€€€€€ƒ¢«–.Wš"Ã¦²—š2'¦"W’æ¢÷žR£¾ò'¾òh(€€€€€€ƒ–:šr³¦g¢Ž‡¦Z/¦‚·–ÂÇšb¿Ž3’â7–r£š"Ã¦²—’â·–ÂÇžnÓš:”(€€€€€€É•ÑÕÉ»Ž7¾ò3–Â;¢Ó–r£–rÃ–r[¾ò?–Þ‡¦
?¦‚¦v‹š2'¦g¦†(€€€€€€ƒš2'¦"W–º3–£šÊKšr'’îï’öW–>7š'ŠSŠS’öž:§–ºÛšršÏ–r (€€€€€€ƒš"Ã¦²—’æ/–’[¾ò3–#š*+Ž3’â/’â–‚Óš"Ã¦²—¢š’â7¢š¢«–.WŽ4(€€€€€€ƒ¦g–/–?––÷¢¢·–ºk––÷¾ò3’â7¦r¢šžržj’êë–r£š"Ã¦²—¢Ž„(€€€€€€ƒš&7¢÷¢ªÿšVÓŽ((€€€€€€ƒš.ÿš:'¦g–/¦Z/¦‚·žjšN/švÿ’æ/–ú3¾ò3’â/¦v‹žj¦
?¢ò¼(€€€€€€ƒ¾ò#šRå…ÕÑ½	…ÑÑ±—Ž–B3š¶•…ÕÑ½½¹™¥œ¹•¹…‰±•“¾ò<(€€€€€€…ÕÑ½½¹™¥œÈ¹•¹…‰±•“ŽšnÓšZÃš2'¦"WšZ–¶_Ž(€€€€€€ƒ–¾¯’â¢†3š"Ã¦²—žÒ¦2¾ò'–r£’â7–r£š"Ã¦²—’â·–~ß¢†3¦÷šb¼(€€€€€€ƒ–º'–£žjŠSŠQ…ÕÑ½½¹™¥œ¹•¹…‰±•“šr³’ú–ÂÇšb¼(€€€€€€ƒŽ3’â/’â–‚Óš"Ã¦²—¢ššÊÿžR£žj¢¢·–ºkŽ7¾ò1ÍÑ…ÉÑ	…ÑÑ±” ¤(€€€€€€ƒ¦Z/šZÃš"Ã¦²—šfšr¢«–ÞÇ¢º¦g–/–ó¾ò3š&’î—–r£š"Ã¦²—–’X(€€€€€€ƒ¢ªÿšVÓ¾ò3šV#šzs–ÂÇšb¿Ž3–#¢¢·–ºk––÷¾ò3’â/’â–‚Ó¢«–.WžRšV#Ž7¾ò0(€€€€€€ƒ¢Þ–:šr³¢¢·¢¢#žjžR£¦S–º3–£’â¢ÓŽ(€€€€€€ƒšr’â/¦v‹¦
šº×Ž3–º–F+¦j;šº×–º'–£š:—š&/Ž7žj¦
?¢ò¼(€€€€€€ƒšr³¢ê¯šr%‰…ÑÑ±•A¡…Í—¾ò=‰…ÑÑ±•Ñ¥Ù—¦ng¦7šª‹š~—¾ò0(€€€€€€ƒ’â7–r£š"Ã¦²—’â·–~ß¢†3’æ’â7šršr'’îï’öW–&¿’ösžR£Ž(€€€€¨¼((€€€…ÕÑ½	…ÑÑ±”€ô(€€€€€€€€……ÕÑ½	…ÑÑ±”ì(((€€€€¼¨(€€€€€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò'¾òh(€€€€€€ƒ–"š>o¢«–.Wš"Ã¦²—žjžVÛ’â/¾ò3ž®/–"ï¦7šZÃ–"“šZÜ(€€€€€€ƒ–n{–B#¢Î¢¢+–"_¾ò?š"Ã¦²—š2’î“š2'¦"W¢š’â7¢š¦†¿ž’ëŠSŠP(€€€€€€ƒš&O¦Z/¢«–.Wš"Ã¦²—šfš'¢¦Ë¦š³’â+¢^?¢Öß’ú¾ò#’â7žR (€€€€€€ƒž¶'–"Ã’â/’âš²…‘•±…É”½É•Í½±Ù—–"š>oš&7žRšV#¾ò'¾ò0(€€€€€€ƒ¦^sš:'š‹–ú§š&/–.Wšf¾ò3–ššzsž>û–r£–&o––÷šb¿–º–F((€€€€€€ƒ¦j;šº×Ž¢ò«–"Ãž:§–ºÛ¢«–ÞÇ¦ã¾ò3’æ¢šž®/–"ï¦†¿ž’è(€€€€€€ƒ–ë’ú¾ò3’â7¢÷¢ºOž:§–ºÛ–Â7¢F_¢^?¢Öß’úžjš2'¦"T(€€€€€€ƒ’â7ž~—¦O¢š¦î{–N«¢Ž‡Ž(€€€€¨¼((€€€ÕÁ‘…Ñ•Ñ¥½¹!Õ‘Y¥Í¥‰¥±¥Ñä ¤ì(((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾òh(€€€€€€ƒ–:šr³¦g¢Ž‡–>«šRç’êšr³–‚Óš"Ã¦²—žR£žj…ÕÑ½	…ÑÑ±—¾ò0(€€€€€€ƒšÊKšr'–B3š¶—–nx…ÕÑ½½¹™¥œ¹•¹…‰±•“¾ò0(€€€€€€ƒ–Â;¢Ó’â/’â–‚Óš"Ã¦²—¦Z/–ž/šf(€€€€€€ÍÑ…ÉÑ	…ÑÑ±” ¤ƒšržR£’âï–~;¢¢·–ºkžj(€€€€€€…ÕÑ½½¹™¥œ¹•¹…‰±•ƒ¦7šZÃ¢š¢N/¾ò0(€€€€€€ƒ–ššzsž:§–ºÛšÊKšr'–>›–’[–:ï’âï–~;–.û¦ã¾ò0(€€€€€€ƒž²³’ê3–‚Ó–ÂÇšr¢º+–n{š&/–.W¾ò3žr/¢Öß’ú–?Ž3¢«–.Wš"Ã¦²—–’ÇšV#Ž7Ž(€€€€€€ƒ¦g¢Ž‡–B3š¶—šnÓšZÃ¢¢·–ºk¾ò3’â›’âS¦‚’úÿ–B3š¶”(€€€€€€ƒ’âï–~;¦
–-¡•­‰½ãžjžV¯¦v‹¾ò0(€€€€€€ƒ¦gš¢–"š>o’âš²‡’æ/–ú3’æ/–ú3š¾?’â–‚Ó¦÷šršÊÿžR£Ž(€€€€¨¼((€€€…ÕÑ½½¹™¥œ¹•¹…‰±•€ô(€€€€€€€…ÕÑ½	…ÑÑ±”ì(((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾ò#žržjš*O–"Ã’â–-‰ÕŸ¾ò'¾òh(€€€€€€ƒ¦g¢Ž‡–:šr³–º3–£šÊKšr'–.W–"Á…ÕÑ½½¹™¥œÈ¹•¹…‰±•“¾ò0(€€€€€€ƒž¶'šZó¦g¦†–ÇžR£žjŽ3–V–.T¿–sš¶‹Ž7š2'¦"T(€€€€€€ƒšÂã¦ƒ–>«š:Ÿ–"Ûž²³’â¢žK¢&Ë¾ò0(€€€€€€ƒž²³’ê3¢žK¢&Ëžj¢«–.Wš"Ã¦²—¦Z/¦^s–ú{¦‚·–"Ã–ÂûšÊK¢Š¯žŠÃ¦;¾ò0(€€€€€€ƒ’âžnÓžÚ·š2–r£¦‚C¢¢·žj¦^s¦Z'ž.š/ŠSŠP(€€€€€€ƒ¦gš¶šb¿Ž3–>«šr'¦vK–Š£švÇžjšr¢«–.W¾ò3¦vKšÂÓ’â7šrŽ4(€€€€€€ƒžjžrš¶–:–nƒŽ((€€€€€€ƒž>û–r£–>«šr'’â¦†–ÇžR£š2'¦"W¾ò3šÊKšr'–>›–’[žj(€€€€€€Á•Èµ¡…É…Ñ•Ë¦Z/¦^s–>¿’î—–"–"—š2'¾ò0(€€€€€€ƒ–B#žBžj¢†3ž
ëš'¢¦Ëšb¿Ž3’â¦6×¢ºOšVÓ¦j+¦÷¢«–.T¿¦÷š&/–.WŽ7¾ò0(€€€€€€ƒš&’î—¦g¢Ž‡¢ºOž²³’ê3¢žK¢&Ë¾ò#–ššzs–¶c–r£¾ò$(€€€€€€ƒ¢Þ¢F_ž²³’â¢žK¢&Ëžjž.š/’â¢Öß–"š>oŽ(€€€€¨¼((€€€¥˜¡Á±…å•ÈÈ¥ì((€€€€€€€…ÕÑ½½¹™¥œÈ¹•¹…‰±•ô(€€€€€€€€€€€…ÕÑ½	…ÑÑ±”ì((€€€ô((€€€¥˜¡Á±…å•ÈÌ¥ì((€€€€€€€…ÕÑ½½¹™¥œÌ¹•¹…‰±•ô(€€€€€€€€€€€…ÕÑ½	…ÑÑ±”ì((€€€ô(((€€€½¹ÍÐ¡½µ•¡•­‰½à€ô(€€€€€€€€ ‰…ÕÑ½¹…‰±•ˆ¤ì(((€€€¥˜¡¡½µ•¡•­‰½à¥ì((€€€€€€€¡½µ•¡•­‰½à¹¡•­•€ô(€€€€€€€€€€€…ÕÑ½	…ÑÑ±”ì((€€€ô(((€€€½¹ÍÐÁ±…å•ÈÉ¡•­‰½àô(€€€€€€€€ ‰…ÕÑ½¹…‰±•‘A±…å•ÈÈˆ¤ì(((€€€¥˜¡Á±…å•ÈÉ¡•­‰½à¥ì((€€€€€€€Á±…å•ÈÉ¡•­‰½à¹¡•­•ô(€€€€€€€€€€€…ÕÑ½	…ÑÑ±”ì((€€€ô(((€€€…Ñ¥½¹I•…‘äõ™…±Í”ì((€€€Á•¹‘¥¹Ñ¥½¸õ¹Õ±°ì((€€€¥˜¡…ÕÑ½	…ÑÑ±”¥ì(€€€€€€€±•…É	…ÑÑ±•Q…É•ÑM•±•Ñ¥½¹5½‘” ¤ì(€€€€€€€±•…ÉÑ¥Ù•¡…É…Ñ•É!¥¡±¥¡Ð ¤ì(€€€ô(€€€•±Í”¥˜ (€€€€€€€‰…ÑÑ±•Ñ¥Ù”€˜˜(€€€€€€€‰…ÑÑ±•A¡…Í”ôôô‰‘•±…É”ˆ(€€€€¥ì(€€€€€€€€¼¨Xä×¾òk–ú{¢«–.W–"–n{š&/–.Wšf¾ò3’â7¦7šZÃ–V–.W–n{–B#Ž(€€€€€€€€€€ƒ’â7šRä…Ñ¥Ù•	…ÑÑ±•¡…É…Ñ•É%¹‘•ã¾òožnÓš:—žR£žVÛ’â/žrš¶Œ(€€€€€€€€€€ƒš¶–r£ž¶'–úšN7’ösžj¢žK¢&Ë¦†¿ž’ëžÊ_¦îš†¢"š*¢÷–"_Ž€¨¼(€€€€€€€±•…É	…ÑÑ±•Q…É•ÑM•±•Ñ¥½¹5½‘” ¤ì(€€€€€€€ÕÁ‘…Ñ•Ñ¥Ù•¡…É…Ñ•É!¥¡±¥¡Ð ¤ì(€€€€€€€Á½ÁÕ±…Ñ•M­¥±±EÕ¥­	…È ¤ì(€€€ô(((€€€ÕÁ‘…Ñ•ÕÑ½	ÕÑÑ½¸ ¤ì(((€€€…‘‘	…ÑÑ±•1½œ ((€€€€€€€…ÕÑ½	…ÑÑ±”(€€€€€€€€ü(€€€€€€€€‹¢«–.Wš"Ã¦²—¦Z/–ž/¾ò#’â/’â–‚Ó’æšršÊÿžR£š¶“¢¢·–ºk¾ò'Žˆ(€€€€€€€€è(€€€€€€€€‹Š>äƒ–ÞË–sš¶‹¢«–.Wš"Ã¦²—Žˆ((€€€€¤ì(((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾ò#žržjš*O–"Ã’ê¾ò3¦gš²‡žj¦f“¦2¿¢¢+š¼(€€€€€€ƒžnÓš:—š*+–š&/š*O–ë’ú’ê¾ò'¾òh((€€€€€€ƒ¦g¢Ž‡–:šr³Ž3¦7šZÃ–V–.W¢«–.Wš"Ã¦²—šf¾ò0(€€€€€€€ÐÀÁµÏ–ú3–òß–"Û–Fó–>¯’âš²……ÕÑ½Ñ¥½¸ §Ž7¾ò0(€€€€€€ƒšb¿–ú#š^§’æ/–&7ž
ë’ê¢žšÆëŽ3¢«–.Wš"Ã¦²—–6‡’ö?Ž4(€€€€€€ƒžVg’â/žjš²+–ºs’æ/¢¢#ŠSŠS’ö…ÕÑ½Ñ¥½¸ ¤(€€€€€€ƒšb¿Ž3ž²³’â¢žK¢&Ë–º–F+¦j;šº×Ž7–Â#žR£žj–÷–ò?¾ò0(€€€€€€ƒ¦g¢Ž‡–º3–£šÊKšr'šª‹š~—žVÛ’â/¾òh(€€€€€€€´ƒž>û–r£šb¿–º–F+¦j;šº×¦
šb¿žÖCžº_¦j;šºÔ(€€€€€€€€ƒ¾ò!‰…ÑÑ±•A¡…Í—¾ò$(€€€€€€€´ƒž>û–r£žržj¢ò«–"Ãž²³’â¢žK¢&Ë–º–F+–^8(€€€€€€€€ƒ¾ò!…Ñ¥Ù•	…ÑÑ±•¡…É…Ñ•É%¹‘•ã¾ò$(€€€€€€€´ƒ¢«žÛžjšÖž¢/šr³¢ê¯šb¿’â7šb¿š‚çšr³šÊK–6‡’ö?¾ò0(€€€€€€€€ƒ–>«šb¿ž:§–ºÛ¢«–ÞÇš&/žf‹š2'’ê–sš¶ˆ¿–V–.T((€€€€€€ƒ–>«¢šž:§–ºÛ–r£–º–F+¦j;šº×’ö¢ò«–"ÃŽ3šâšÂÓš"ÃŽ4(€€€€€€ƒ–º–F+šfš2'’ê–sš¶‹–>#–V–.W¾ò0ÐÀÁµÏ–ú3¦gšºÔ(€€€€€€ƒšr’â7žº‡’â'’â’ê3–6’âžnÓš:—–Fó–>­…ÕÑ½Ñ¥½¸ ¤(€€€€€€ƒ¾ò#–æ¯ž²³’â¢žK¢&Ë–º–F+’âš²‡Ž’â›–Fó–>¯’âš²„(€€€€€€™¥¹¥Í¡A±…å•ÉÑ¥½¸ §¾ò'¾ò3ž¶'šZó–r (€€€€€€…Ñ¥Ù•	…ÑÑ±•¡…É…Ñ•É%¹‘•ã¦
šÊKžrš¶Œ(€€€€€€ƒ¢ò«–"Ãž²³’â¢žK¢&ËžjššÎ’â/¾ò3ž†³šb¿š*+–º–ú–&4(€€€€€€ƒ–’kš:£’ê’âš¶—ŠSŠS¦gš¶šb¿Ž3–º–F+¦j;šº×¢:¯–B7–Û–šd(€€€€€€ƒ–’k–ë’âš²…™¥¹¥Í¡A±…å•ÉÑ¥½¸ §Ž(€€€€€€ƒšâšÂÓš"Ãžj–º–F+¢Š¯¢ÞÏ¦;ŽÅÕ•Õ•“¢º+ž¦ëŽ4(€€€€€€ƒžjžrš¶–:–nƒŽ–ššzs–&o––÷žfóžR–r£žÖCžº_¦j;šº×¾ò0(€€€€€€ƒ’âš¢šr¢ºM¥¹¥Ñ¥…Ñ¥Ù•%¹‘•ã¢Š¯–’kš:£’âš¶—¾ò0(€€€€€€ƒ¢ÞÏ¦;¢¦Ë¢ò«–"Ãžj’â/’â’ö7Ž((€€€€€€ƒž>û–r£–ÞËžÚOš*+Ž3š&/–.T¿¢«–.Wš¢‡–ò?’â/¾ò1MC’â7¢ÚÏŽ(€€€€€€ƒ–Âkšr«–¶ãžþKž¶'–"šR¿šò?–Fó–>­™¥¹¥Í¡A±…å•ÉÑ¥½¸ §Ž4(€€€€€€ƒ¦g’êožrš¶šr¢ºOšÖž¢/–6‡š¶ïžjšò?šÒ{¦÷¢Žs’â+’ê¾ò0(€€€€€€ƒš¶–âãššÎ’â/¢«žÛžj–º–F(¿žÖCžº_¦>#’â7šr–4(€€€€€€ƒž‡¢Ë–6‡’ö?¾ò3¦g–/Ž3–’[¦£ž†³¢â‹’âš²‡Ž7žj(€€€€€€ƒš²+–ºs’æ/¢¢#–ÞËžÚO’â7¦r¢šŽ¢3’âSšb¿’âï–.Wžj(€€€€€€ƒ–6Ç–ºÏ’úšêC¾ò3žnÓš:—š.ÿš:'Ž((€€€€€€ƒ–"š>o¢«–.Wš"Ã¦²—ž>û–r£–>«–Z»žÒSšRä(€€€€€€…ÕÑ½	…ÑÑ±”½…ÕÑ½½¹™¥Ÿ¦g’êož.š/š^_š¢g¾ò0(€€€€€€ƒ’â/’âš²…‰•¥¹¡…É…Ñ•ÉQÕÉ¸ §¢«žÛ–~ß¢†3–"À(€€€€€€ƒžjšf–g¾ò3šr¢«–ÞÇ¢º–"ÃšZÃžj…ÕÑ½=»–óŽ(€€€€€€ƒš¶žŠë–"“šZß¢š’â7¢š¢«–.W–ëš&/Ž((€€€€€€ƒŠbƒ’ö¾ò#’úwžŸ’öÿžR£¢–¾›šâ³–n{–‚Ç¾ò3¢Žs–n{’â–,(€€€€€€ƒ–B#žB’ö¢š–k–Â7žj¢†3ž
ë¾ò'¾òh(€€€€€€ƒ–ššzs–"š>ožjžVÛ’â/¾ò3–&o––÷–6‡–r£Ž3–º–F+¦j;šº×¾ò0(€€€€€€ƒš¶–r£ž¶'š~C–/¢žK¢&Ëš&/–.W¢òã–—Ž7¾ò#¦
–/¢žK¢&Ëžj(€€€€€€€ÈÃžžK¢¢#šf–f£š¶–r£¢ÞG¾ò'¾ò3ž:§–ºÛš*+¢«–.Wš&O¦Z/¾ò0(€€€€€€ƒžnÓ¢šëšršr–úŽ3¦g–/š¶–r£ž¶'š"Gžj¢žK¢&Ë¾ò0(€€€€€€ƒž>û–r£¦š³’â+¢«–.W–æ¯š"G¦ãŽ7ŠSŠS’â7¢÷’î¦êó¦÷’â7–k¾ò0(€€€€€€ƒ’â7žÛ¢š–bo–>«¢÷ž¶$ÈÃžžK¦ûšfŽ¢š–bo–ú_–#–k–º0(€€€€€€ƒ¦g¢ò«š&/–.W¦ãšN¾ò3¢«–.W¦Z/¦^sžr/¢Öß’ú–?šÊK–>7š'Ž((€€€€€€ƒ¦g¢Ž‡¢Þš.ÿš:'žj¢"+ž&#šr–’Ÿ–Þ»–"—¾òh(€€€€€€€Ä¸ƒ–>«š:—š&/Ž3žVÛ’â/š¶–r£ž¶'–úŽ’âS–&o¢Š¯–"š"@(€€€€€€€€€ƒ¢«–.WŽ7žj¦
’â’ö7¾ò3’â7šr’â7–"¦vKžÒžjžfô(€€€€€€€€€ƒšÂã¦ƒ–Fó–>­Á±…å•ÈÇžj…ÕÑ½Ñ¥½¸ §Ž(€€€€€€€È¸ƒ–~ß¢†3–&7žR¡±½ÍÕÉ—¢¢c’ö?žVÛ’â/žj(€€€€€€€€€‰…ÑÑ±•Q½­•»Ž‰…ÑÑ±•A¡…Í—Ž(€€€€€€€€€…Ñ¥Ù•	…ÑÑ±•¡…É…Ñ•É%¹‘•ã¾ò0(€€€€€€€€€Í•ÑQ¥µ•½ÕÓžrš¶–~ß¢†3žj¦
’â–"ï¾ò0(€€€€€€€€€ƒ’â'–/šŠw’îÛ¦÷¢š¦7šZÃš‚ã–Â7’âš²‡šÊKšr'¢º+¦8(€€€€€€€€€ƒ¾ò!Ñ½­•»šÊKš>ošZÃš"Ã¦²—Ž¦
šb¿–º–F+¦j;šº×Ž(€€€€€€€€€ƒ¦
šb¿–B3’â–/¢žK¢&Ë–r£ž¶'¾ò'ŠSŠS–ššzsž:§–ºØ(€€€€€€€€€ƒ–r£¦dÐÀÁµÏ–Ÿ¢«–ÞÇš&/–.W¦ã–º3’ê¾ò0(€€€€€€€€€ƒš"[šÖž¢/šr³’ú–ÂÇ¢«žÛžæóžê3–ú’â/¢ÖÃ’ê¾ò0(€€€€€€€€€ƒ¦g¢Ž‡žjš‚ã–Â7šr–’ÇšV_¾ò3žnÓš:—’î¦êó¦÷’â7–k¾ò0(€€€€€€€€€ƒ’â7šržfóžRŽ3–ÞËžÚOšr'’êë¦ã¦;’ê¾ò3¦g¢Ž„(€€€€€€€€€ƒ–>#ž†³š>K’âš²‡Ž7žj¦7¢’š:£¦ËŽ(€€€€¨¼((€€€¥˜ (€€€€€€€…ÕÑ½	…ÑÑ±”€˜˜(€€€€€€€‰…ÑÑ±•A¡…Í”ôôô‰‘•±…É”ˆ(€€€€¥ì((€€€€€€€½¹ÍÐ•áÁ•Ñ•‘Q½­•¸ô(€€€€€€€€€€€‰…ÑÑ±•Q½­•¸ì((€€€€€€€½¹ÍÐ•áÁ•Ñ•‘¡…É…Ñ•É%¹‘•àô(€€€€€€€€€€€…Ñ¥Ù•	…ÑÑ±•¡…É…Ñ•É%¹‘•àì((€€€€€€€Í•ÑQ¥µ•½ÕÐ  ¤ôùì((€€€€€€€€€€€¥˜ (€€€€€€€€€€€€€€€€…‰…ÑÑ±•Ñ¥Ù”ñð(€€€€€€€€€€€€€€€‰…ÑÑ±•Q½­•¸„ôô(€€€€€€€€€€€€€€€•áÁ•Ñ•‘Q½­•¸ñð(€€€€€€€€€€€€€€€‰…ÑÑ±•A¡…Í”„ôô(€€€€€€€€€€€€€€€€‰‘•±…É”‰ñð(€€€€€€€€€€€€€€€…Ñ¥Ù•	…ÑÑ±•¡…É…Ñ•É%¹‘•à„ôô(€€€€€€€€€€€€€€€•áÁ•Ñ•‘¡…É…Ñ•É%¹‘•à(€€€€€€€€€€€€¥ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€€€€€ô(((€€€€€€€€€€€ÑÉåì((€€€€€€€€€€€€€€€…ÕÑ½Ñ¥½¹½É¡…É…Ñ•È (€€€€€€€€€€€€€€€€€€€•áÁ•Ñ•‘¡…É…Ñ•É%¹‘•à°(€€€€€€€€€€€€€€€€€€€•áÁ•Ñ•‘Q½­•¸(€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€ô(€€€€€€€€€€€…Ñ ¡•ÉÉ½È¥ì((€€€€€€€€€€€€€€€½¹Í½±”¹•ÉÉ½È (€€€€€€€€€€€€€€€€€€€€‹–"š>o¢«–.Wš"Ã¦²—šfš:—š&/–º–F+žfóžR’ú/–’[¾òhˆ°(€€€€€€€€€€€€€€€€€€€•ÉÉ½È(€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€ô((€€€€€€€ô°ÐÀÀ¤ì((€€€ô()ô(()™Õ¹Ñ¥½¸ÕÁ‘…Ñ•ÕÑ½	ÕÑÑ½¸ ¥ì((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾ò#’úwžŸ’öÿžR£¢š2–ºkž&#¦v‹¾ò'¾òh(€€€€€€ƒ–V–.W’æ/–ú3š2'¦"WšZ–¶_šRçš"CŽ3–sš¶‹Ž7Ž(€€€€€€ƒ–*ƒ’â)…Ñ¥Ù—žjžÒ¢&Ëš¢–ò?¾òl(€€€€€€ƒ–Þ›¦
+žjš¢gžÆ“šZ–¶_’æ¢š¢Þ¢F_š>oš"CŽ3¢«–.Wš"Ã¦²—’â·Ž7Ž(€€€€¨¼((€€€½¹ÍÐ‰ÕÑÑ½¸ô(€€€€€€€€ ‰…ÕÑ½	…ÑÑ±•	ÕÑÑ½¸ˆ¤ì(((€€€¥˜¡‰ÕÑÑ½¸¥ì((€€€€€€€‰ÕÑÑ½¸¹Ñ•áÑ½¹Ñ•¹Ðô((€€€€€€€€€€€…ÕÑ½	…ÑÑ±”(€€€€€€€€€€€€ü(€€€€€€€€€€€€‹Š>äƒ–sš¶ˆˆ(€€€€€€€€€€€€è(€€€€€€€€€€€€‹ŠZØƒ–V–.Tˆì(((€€€€€€€‰ÕÑÑ½¸¹±…ÍÍ1¥ÍÐ¹Ñ½±” (€€€€€€€€€€€€‰…Ñ¥Ù”ˆ°(€€€€€€€€€€€…ÕÑ½	…ÑÑ±”(€€€€€€€€¤ì((€€€ô(((€€€½¹ÍÐ±…‰•°ô(€€€€€€€€ ‰…ÕÑ½	…ÑÑ±•1…‰•°ˆ¤ì(((€€€¥˜¡±…‰•°¥ì((€€€€€€€±…‰•°¹Ñ•áÑ½¹Ñ•¹Ðô((€€€€€€€€€€€…ÕÑ½	…ÑÑ±”(€€€€€€€€€€€€ü(€€€€€€€€€€€€‹¢«–.Wš"Ã¦²—’â´ˆ(€€€€€€€€€€€€è(€€€€€€€€€€€€‹¢«–.Wš"Ã¦²”ˆì((€€€ô(((€€€€¼¨(€€€€€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3–Þ‡¦
?¦‚¦v‹žj(€€€€€€ƒ¢«–.Wš"Ã¦²—¦v‹švÿ¾ò'¾òh(€€€€€€ƒ¢Þ’â+¦v‹–B3’â––_¦
?¢ò¿¾ò3–B3š¶—šnÓšZÃ–Þ‡¦
?¦‚¦vˆ(€€€€€€ƒ¦
’î÷¢«–.Wš"Ã¦²—š2'¦"T¿š¢gžÆ“¾ò3žŠë’þw–§¦
((€€€€€€ƒ¦†¿ž’ëžjž.š/šÂã¦ƒ’â¢Ó¾ò3’â7šr–ëž>ûš"Ã¦²”(€€€€€€ƒ¦‚¦v‹¦†¿ž’ëŽ3–sš¶‹Ž7Ž–Þ‡¦
?¦‚¦v‹–6ï¦
¦†¿ž’è(€€€€€€ƒŽ3–V–.WŽ7¦gž¢»’â7–B3š¶—žjššÎŽ(€€€€¨¼((€€€½¹ÍÐµ…Á	ÕÑÑ½¸ô(€€€€€€€€ ‰µ…ÁÕÑ½	…ÑÑ±•	ÕÑÑ½¸ˆ¤ì(((€€€¥˜¡µ…Á	ÕÑÑ½¸¥ì((€€€€€€€µ…Á	ÕÑÑ½¸¹Ñ•áÑ½¹Ñ•¹Ðô((€€€€€€€€€€€…ÕÑ½	…ÑÑ±”(€€€€€€€€€€€€ü(€€€€€€€€€€€€‹Š>äƒ–sš¶ˆˆ(€€€€€€€€€€€€è(€€€€€€€€€€€€‹ŠZØƒ–V–.Tˆì(((€€€€€€€µ…Á	ÕÑÑ½¸¹±…ÍÍ1¥ÍÐ¹Ñ½±” (€€€€€€€€€€€€‰…Ñ¥Ù”ˆ°(€€€€€€€€€€€…ÕÑ½	…ÑÑ±”(€€€€€€€€¤ì((€€€ô(((€€€½¹ÍÐµ…Á1…‰•°ô(€€€€€€€€ ‰µ…ÁÕÑ½	…ÑÑ±•1…‰•°ˆ¤ì(((€€€¥˜¡µ…Á1…‰•°¥ì((€€€€€€€µ…Á1…‰•°¹Ñ•áÑ½¹Ñ•¹Ðô((€€€€€€€€€€€…ÕÑ½	…ÑÑ±”(€€€€€€€€€€€€ü(€€€€€€€€€€€€‹¢«–.Wš"Ã¦²—’â´ˆ(€€€€€€€€€€€€è(€€€€€€€€€€€€‹¢«–.Wš"Ã¦²”ˆì((€€€ô(((€€€€¼¨(€€€€€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3Ž3–Þ‡š«¦‚¦vˆ(€€€€€€ƒ–Þ›’â+¢žKšZÃ–Š{–Â?š2'¦"W¾ò3¢«–.Wš"Ã¦²—–þ¯š6ß¦Z/–V|¼(€€€€€€ƒ–sš¶‹Ž7¾ò'¾òh(€€€€€€ƒ¢Þ’â+¦v‹–§¦†š2'¦"W–B3’â––_¦
?¢ò¿¾ò3–B3š¶—šnÓšZÀ(€€€€€€ƒ–Þ›’â+¢žK¦g¦†–Â?–þ¯š6ß¦"W¾ò3žŠë’þw’â'–/–rÃšZä(€€€€€€ƒ¾ò#š"Ã¦²—¦‚¦vˆ¿–rÃ–r[¢š¢N/–Æ¿–Þ›’â+¢žK–þ¯š6ß¦"W¾ò$(€€€€€€ƒšÂã¦ƒ¦†¿ž’ë’â¢Óžjž.š/Ž¦g¦†ž>û–r£šRçš"@(€€€€€€ƒžÒS–r[ž’ë¦"W¾ò#¦Z,¿¦^s–B’â–ò×’â+–
Ïžj¥½»–r[¾ò'¾ò0(€€€€€€ƒ’â7–7šRûšZ–¶_¾ò3šRçžR¡…Ñ¥Ù—¦g–-±…ÍÌ(€€€€€€ƒ–"š>o¢š¦†¿ž’ë–N«’â–ò×–r[¾ò#¢š-ML(€€€€€€€¹µ…ÀµÅÕ¥¬µÑ½±”µ‰Ñ¸€¹¥½¸µ½»¾ò<(€€€€€€€¹¥½¸µ½™›¾ò'¾ò3’â›¦f–âÙ…É¥„µ±…‰•³šZç’úü(€€€€€€ƒž‡¦jsž’g¦ZÇ¢º¾ò3’â7¢÷žnÓš:—–¾­Ñ•áÑ½¹Ñ•¹Ð(€€€€€€ƒ¾ò#¦
š¢šrš*+¢Ž‡¦v‹žjñ¥µœû–¶C–žÒƒšVÓ–,(€€€€€€ƒšÒ_š:'¾ò3–r[ž’ëšršÚ#–’Ç¾ò'Ž(€€€€¨¼((€€€½¹ÍÐÅÕ¥­	…ÑÑ±•	Ñ¸ô(€€€€€€€€ ‰ÅÕ¥­ÕÑ½	…ÑÑ±•Q½±”ˆ¤ì(((€€€¥˜¡ÅÕ¥­	…ÑÑ±•	Ñ¸¥ì((€€€€€€€ÅÕ¥­	…ÑÑ±•	Ñ¸¹Í•ÑÑÑÉ¥‰ÕÑ” (€€€€€€€€€€€€‰…É¥„µ±…‰•°ˆ°((€€€€€€€€€€€…ÕÑ½	…ÑÑ±”(€€€€€€€€€€€€ü(€€€€€€€€€€€€‹¢«–.Wš"Ã¦²—¾ò#¦Z/–V’â·¾ò$ˆ(€€€€€€€€€€€€è(€€€€€€€€€€€€‹¢«–.Wš"Ã¦²—¾ò#¦^s¦Z'¾ò$ˆ(€€€€€€€€¤ì(((€€€€€€€ÅÕ¥­	…ÑÑ±•	Ñ¸¹±…ÍÍ1¥ÍÐ¹Ñ½±” (€€€€€€€€€€€€‰…Ñ¥Ù”ˆ°(€€€€€€€€€€€…ÕÑ½	…ÑÑ±”(€€€€€€€€¤ì((€€€ô()ô(((¼¨(€€ƒŠbƒšZÃ–Š{¾òk¢«–.Wš"Ã¦²—¢¦ÏžÒÃ¢¢·–ºk¦v‹švÿ¾ò#–ÆW¦Z/ž&#¾ò'Ž((€€½Á•¹ÕÑ½	…ÑÑ±•M•ÑÑ¥¹Ì §¾òk–ÆW¦Z/¦v‹švÿ¾ò0(€€ƒ¦‚C¢¢·–#¦†¿ž’ëž:§–ºØÇžj¢¢·–ºkŽ((€€ÍÝ¥Ñ¡ÕÑ½M•ÑÑ¥¹Í¡…É…Ñ•È §¾òk–"š>o¢žK¢&Ëšf¾ò0(€€ƒ¦7šZÃ–†¯–—Ž3¢«–.W¢†3–.WŽ7’â/š.'¦ã–Z¸(€€ƒ¾ò#šf»¦kšRïšN(¿¦bËžš˜¿¢¦Ë¢žK¢&Ë¢Žw–
gžjš*¢÷¾ò'¾ò0(€€ƒ’â›¢ò'–—¢¦Ë¢žK¢&Ëžn»–&7žj!@”½M@”¿¢«–.W–n{–~;¢¢·–ºkŽ((€€½¹™¥ÉµÕÑ½	…ÑÑ±•M•ÑÑ¥¹Ì §¾òkš*+¢†£–Z»’â+žj–ð(€€ƒ–¾¯–n{–Â7š'¢žK¢&Ëžj…ÕÑ½½¹™¥œ½…ÕÑ½½¹™¥œË¾ò3–¶cšªS¾ò3šRÛ¢Öß¦v‹švÿŽ((€€±½Í•ÕÑ½	…ÑÑ±•M•ÑÑ¥¹Ì §¾òk’â7–Ë–¶c¾ò3žnÓš:—šRÛ¢Öß¦v‹švÿŽ(¨¼((¼¨(€€ƒŠbƒšZÃ–Š{¾òk¢¢c’ö?¢«–.Wš"Ã¦²—¢¢·–ºk¦v‹švÿ–:šr°(€€ƒ¾ò#–r¡‰…ÑÑ±•A…—¢Ž‡¾ò'žj’ö7žö»¾ò1½Á•¹ÕÑ½	…ÑÑ±•M•ÑÑ¥¹Ì ¤(€€ƒš*+–ºšj¯šfšB³–"Á‘½Õµ•¹Ð¹‰½‘ç–êW’â/šf¢¢c¦2¾ò0(€€±½Í•ÕÑ½	…ÑÑ±•M•ÑÑ¥¹Ì §¦^s¦Z'šf’úwžŸ¦g–§–/–ð(€€ƒšB³–n{–:’ö7Ž(¨¼()±•Ð…ÕÑ½M•ÑÑ¥¹Í=É¥¥¹…±A…É•¹Ðô(€€€¹Õ±°ì()±•Ð…ÕÑ½M•ÑÑ¥¹Í=É¥¥¹…±9•áÑM¥‰±¥¹œô(€€€¹Õ±°ì(()™Õ¹Ñ¥½¸½Á•¹ÕÑ½	…ÑÑ±•M•ÑÑ¥¹Ì ¥ì((€€€½¹ÍÐÁ…¹•°ô(€€€€€€€€ ‰…ÕÑ½	…ÑÑ±•M•ÑÑ¥¹ÍA…¹•°ˆ¤ì(((€€€¥˜ …Á…¹•°¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€€¼¨(€€€€€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3¢ºO–rÃ–r[¾ò?–Þ‡¦
<(€€€€€€ƒ¦‚¦v‹žjŽ3¢¢·–ºkŽ7š2'¦"W’æ¢÷žR£¾ò'¾òh(€€€€€€ƒ¦g–/¦v‹švÿ–:šr³šb½‰…ÑÑ±•A…—–êW’â/žj(€€€€€€ƒ–¶C–žÒƒ¾ò3’â7–r£š"Ã¦²—’â·žjšf–e‰…ÑÑ±•A…”(€€€€€€ƒšVÓ–-‘¥ÍÁ±…äé¹½¹—¾ò3–ÂÇžº_š*+¦v‹švÿ¢«–ÞÇžj(€€€€€€‘¥ÍÁ±…çšRçš:'¾ò3’æšr¢Š¯šÊKšr%‘¥ÍÁ±…çžj(€€€€€€ƒž–[–#¢N/’ö?žr/’â7¢š/ŠSŠS¦gš¶šb¿Ž3¢¢·–ºkš2'¦"T(€€€€€€ƒšÊK–>7š'Ž7žjžrš¶–:–nƒŽ((€€€€€€ƒ¦g¢Ž‡–r£Ž3’â7–r£š"Ã¦²—’â·Ž7žjššÎ’â/¾ò3š*+¦v‹švü(€€€€€€ƒ¦g–-=7ž¾¦î{šj¯šfšB³–"Á‘½Õµ•¹Ð¹‰½‘ç–êW’â,(€€€€€€ƒ¾ò#¦–é‰…ÑÑ±•A…—¦
–Æ‘‘¥ÍÁ±…äé¹½¹—¾ò'¾ò0(€€€€€€ƒ’â›––_žR£’â+¦v‹šZÃ–Š{žj™±½…Ñ¥¹œµµ½‘…³š¢–ò<(€€€€€€ƒ¾ò#šRçš"AÁ½Í¥Ñ¥½¸é™¥á•“Ž¢«–ÞÇ–ºk’ö7¾ò'Ž(€€€€€€ƒšB³¢ÖÃ’æ/–&7–#¢¢c’ö?–:šr³žj’ö7žö¸(€€€€€€ƒ¾ò!…ÕÑ½M•ÑÑ¥¹Í=É¥¥¹…±A…É•¹Ó¾ò<(€€€€€€…ÕÑ½M•ÑÑ¥¹Í=É¥¥¹…±9•áÑM¥‰±¥¹Ÿ¾ò'¾ò0(€€€€€€±½Í•ÕÑ½	…ÑÑ±•M•ÑÑ¥¹Ì §¢Ž‡šr’úwžœ(€€€€€€ƒ¦g–§–/–óš*+–ºšB³–ny‰…ÑÑ±•A…—–:šr³žj(€€€€€€ƒ’ö7žö»¾ò3’â7šr¢ºO–º–ú{š¶“šÚ#–’Ç–r¡‰…ÑÑ±•A…—¢Ž‡Ž(€€€€¨¼((€€€¥˜ (€€€€€€€€…‰…ÑÑ±•Ñ¥Ù”€˜˜(€€€€€€€Á…¹•°¹Á…É•¹Ñ9½‘”„ôô(€€€€€€€‘½Õµ•¹Ð¹‰½‘ä(€€€€¥ì((€€€€€€€…ÕÑ½M•ÑÑ¥¹Í=É¥¥¹…±A…É•¹Ðô(€€€€€€€€€€€Á…¹•°¹Á…É•¹Ñ9½‘”ì((€€€€€€€…ÕÑ½M•ÑÑ¥¹Í=É¥¥¹…±9•áÑM¥‰±¥¹œô(€€€€€€€€€€€Á…¹•°¹¹•áÑM¥‰±¥¹œì(((€€€€€€€‘½Õµ•¹Ð¹‰½‘ä¹…ÁÁ•¹‘¡¥± (€€€€€€€€€€€Á…¹•°(€€€€€€€€¤ì(((€€€€€€€Á…¹•°¹±…ÍÍ1¥ÍÐ¹…‘ (€€€€€€€€€€€€‰™±½…Ñ¥¹œµµ½‘…°ˆ(€€€€€€€€¤ì((€€€ô(((€€€½¹ÍÐ¡…É…Ñ•ÉM•±•Ðô(€€€€€€€€ ‰…ÕÑ½M•ÑÑ¥¹Í¡…É…Ñ•ÉM•±•Ðˆ¤ì(((€€€¥˜¡¡…É…Ñ•ÉM•±•Ð¥ì((€€€€€€€€¼¨(€€€€€€€€€€ƒŠbƒ’þ»š¶¾ò#’úwžŸ’öÿžR£¢š2š¶¾ò'¾òh(€€€€€€€€€€ƒ’â/š.'¦ã¦‚–:šr³–¾¯š¶ï¦†¿ž’ëŽ3ž:§–ºØÇŽ7Ž3ž:§–ºØËŽ7¾ò0(€€€€€€€€€€ƒ¦
–>«šb¿š"G¢ª«šb;šf¢"'’ú/žR£žj’îž¢Ç¾ò0(€€€€€€€€€€ƒ’öÿžR£¢¢šžj–Û–¾›šb¿Ž3¢žK¢&Ë¢«–ÞÇžj%Ž7¾ò0(€€€€€€€€€€ƒ¦g¢Ž‡šRçš"C–.Wš/–âÛ–•Á±…å•È¹¥½Á±…å•ÈÈ¹¥“Ž(€€€€€€€€¨¼((€€€€€€€½¹ÍÐ½ÁÑ¥½¸Àô(€€€€€€€€€€€€ ‰…ÕÑ½M•ÑÑ¥¹Í¡…É=ÁÑ¥½¸Àˆ¤ì(((€€€€€€€¥˜¡½ÁÑ¥½¸À¥ì((€€€€€€€€€€€½ÁÑ¥½¸À¹Ñ•áÑ½¹Ñ•¹Ðô((€€€€€€€€€€€€€€€Á±…å•È¹¥‘ñð(€€€€€€€€€€€€€€€€‹¢žK¢&ÈÄˆì((€€€€€€€ô(((€€€€€€€½¹ÍÐ½ÁÑ¥½¸Äô(€€€€€€€€€€€€ ‰…ÕÑ½M•ÑÑ¥¹Í¡…É=ÁÑ¥½¸Äˆ¤ì(((€€€€€€€¥˜¡½ÁÑ¥½¸Ä¥ì((€€€€€€€€€€€½ÁÑ¥½¸Ä¹Ñ•áÑ½¹Ñ•¹Ðô((€€€€€€€€€€€€€€€Á±…å•ÈÈ(€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€Á±…å•ÈÈ¹¥(€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€€‹¢žK¢&ÈË¾ò#–Âkšr«–&×–îë¾ò$ˆì((€€€€€€€ô(((€€€€€€€€¼¨(€€€€€€€€€€ƒž:§–ºØË¦
šÊK–&×–îëžj¢¦Ç¾ò0(€€€€€€€€€€ƒ’â/š.'¦ã–Z»¢Ž‡–#’â7žÖ›¦ã¾ò0(€€€€€€€€€€ƒ¦ÿ–7¦ã–"Ã’â–/’â7–¶c–r£žj¢žK¢&ËŽ(€€€€€€€€¨¼((€€€€€€€¥˜¡½ÁÑ¥½¸Ä¥ì((€€€€€€€€€€€½ÁÑ¥½¸Ä¹‘¥Í…‰±•ô((€€€€€€€€€€€€€€€€…Á±…å•ÈÈì((€€€€€€€ô(((€€€€€€€¡…É…Ñ•ÉM•±•Ð¹Ù…±Õ”ôˆÀˆì((€€€ô(((€€€€¼¨(€€€€€€ƒŠbƒ–&oš&O¦Z/¦v‹švÿ¾ò3žV¯¦v‹š²’ö7šb¿’â+š²‡šºcžVgžj–Ÿ–ºç¾ò0(€€€€€€ƒ’â7šb¿ž:§–ºÛš¶–r£žÞ£¢ò¿žjšvÇ¢–ÿ¾ò3¦g¢Ž‡–
ÍÑÉÕ”(€€€€€€ƒ¢ÞÏ¦;Ž3–¶c–n{’â+’â–/¢žK¢&ËŽ7¦
’âš¶—Ž(€€€€¨¼((€€€ÍÝ¥Ñ¡ÕÑ½M•ÑÑ¥¹Í¡…É…Ñ•È¡ÑÉÕ”¤ì(((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3¦7šZÃ¢¢·¢¢#¾ò'¾òh(€€€€€€ƒ¢¢·–ºk¦v‹švÿšRçš"Cžrš¶žjŽ3šr’â+–Æ“¢š¢N/Ž7¾ò0(€€€€€€ƒž¾–r7šb¿Ž3š«ž&§–6‡ž&3’â/žÞŽ7–"ÃŽ3’êëž&§–6‡ž&3’â/žÞŽ7¾ò0(€€€€€€ƒ’â7–7’úw¢ÎÑMO–:ïž2s¦g–/ž¾–r7¢¦Ë–’k¦®cŠSŠP(€€€€€€ƒžnÓš:—žR¡)O¦?–ë¦g–§–/¦
+žV3žj–¾›¦jo¢z‹–æW–êŸš¢g¾ò0(€€€€€€ƒžR¡Á½Í¥Ñ¥½¸é™¥á•“žÊûšê[–Â7¦ö+¾ò0(€€€€€€ƒžZ+šRû¦‚–ê?š.'–"Ãšr¦®c¾ò3žŠë’þw’â–ºkšr¢N/–r (€€€€€€ƒš&šr'švÇ¢–ÿžjšr’â+¦v‹Ž(€€€€¨¼((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾ò#žrš¶š*O–"ÃŽ3¢¢·–ºk¢ÞG–"Ãšr’â+¦v‹Ž7žj(€€€€€€ƒ–:–nƒ¾ò'¾òh(€€€€€€ƒ¦gšº×¦?šâ³Ž3š«ž&§–6‡ž&3’â/žÞ¾ö{’êëž&§–6‡ž&3’â/žÞŽ4(€€€€€€ƒ–7žR£¢†3–Ÿš¢–ò?–ºk’ö7žj¦
?¢ò¿¾ò3šb¿ž
ë’êš"Ã¦²”(€€€€€€ƒ¦‚¦v‹–Ÿ¢¢·¢¢#žj¾ò3–6ïšÊKšr'–"“šZßŽ3ž>û–r£–"Ã–êWšb¼(€€€€€€ƒ’â7šb¿–r£š"Ã¦²—¦‚¦v‹Ž7ŠSŠS–r£–rÃ–r[¾ò?–Þ‡¦
?¦‚¦vˆ(€€€€€€ƒš&O¦Z/¢¢·–ºkšf¾ò0¹‰…ÑÑ±”µµ½¹ÍÑ•ÉÏ¾ò<(€€€€€€€¹‰…ÑÑ±”µÁ±…å•ÈµÉ½ß¦g–§–/–žÒƒ¦n[žÛ¦
–r (€€€€€€=7¢Ž‡¾ò3’ö‰…ÑÑ±•A…—šVÓ–Æ‘‘¥ÍÁ±…äé¹½¹—¾ò0(€€€€€€‘¥ÍÁ±…äé¹½¹—žj–žÒ•Ñ	½Õ¹‘¥¹±¥•¹ÑI•Ð ¤(€€€€€€ƒ¦?–ë’ú’â–ú/šb½íÑ½ÀèÀ±‰½ÑÑ½´èÀ°¸¸¹÷¾ò0(€€€€€€ƒž¶'šZó¦g¢Ž‡šrš*)Á…¹•°¹ÍÑå±”¹Ñ½Ãž†³¢¢·š"@(€€€€€€€ˆÁÁà‹Ž¡•¥¡Ó¢¢·š"@ˆÁÁà‹ŠSŠS¢3’âS¦gšb¼(€€€€€€ƒ¢†3–Ÿš¢–ò?¾ò3–«–#š²+š¾Q™±½…Ñ¥¹œµµ½‘…³¦
–,(€€€€€€ML±…ÍÏ¦
¦®c¾ò3–ÂÇžº]±…ÍÏšr'š¶žŠë––_žR£¾ò0(€€€€€€ƒ’æšr¢Š¯¦g¢Ž‡žj¢†3–Ÿš¢–ò?¢N/¦;–:ï¾ò3¦gš&7šb¼(€€€€€€ƒ¢¢·–ºk¦v‹švÿ¢ÞG–"ÃžV¯¦v‹šr’â+¦v‹Žžr/¢Öß’úž¦ëž¦ëžj(€€€€€€ƒžrš¶–:–nƒŽ((€€€€€€ƒšRçš"C–>«šr'Ž3žržj–r£š"Ã¦²—’â·Ž7š&7–~ß¢†3¦gšºÔ(€€€€€€ƒ¦?šâ³–ºk’ö7¾òo’â7–r£š"Ã¦²—’â·¾ò#–rÃ–r[¦‚¦v‹š&O¦Z/¾ò$(€€€€€€ƒžj¢¦Ç–º3–£¢ÞÏ¦;¾ò3’ê“žÖ™™±½…Ñ¥¹œµµ½‘…°(€€€€€€ƒ¦
–-±…ÍÏ¢«–ÞÇžjÁ½Í¥Ñ¥½¸é™¥á•“¾ò<(€€€€€€‰½ÑÑ½´èàÁÁã–:ï–ºk’ö7¾ò3’â7šr–7¢Š¯¦g¢Ž‡žj(€€€€€€ƒ¢†3–Ÿš¢–ò?¢N/š:'Ž(€€€€¨¼((€€€¥˜¡‰…ÑÑ±•Ñ¥Ù”¥ì((€€€€€€€½¹ÍÐµ½¹ÍÑ•ÉÉ•„ô(€€€€€€€€€€€‘½Õµ•¹Ð¹ÅÕ•ÉåM•±•Ñ½È (€€€€€€€€€€€€€€€€ˆ¹‰…ÑÑ±”µµ½¹ÍÑ•ÉÌˆ(€€€€€€€€€€€€¤ì(((€€€€€€€½¹ÍÐÁ±…å•ÉI½Üô(€€€€€€€€€€€‘½Õµ•¹Ð¹ÅÕ•ÉåM•±•Ñ½È (€€€€€€€€€€€€€€€€ˆ¹‰…ÑÑ±”µÁ±…å•ÈµÉ½Üˆ(€€€€€€€€€€€€¤ì(((€€€€€€€¥˜ (€€€€€€€€€€€µ½¹ÍÑ•ÉÉ•„€˜˜(€€€€€€€€€€€Á±…å•ÉI½Ü(€€€€€€€€¥ì((€€€€€€€€€€€½¹ÍÐÑ½Á‘”ô(€€€€€€€€€€€€€€€µ½¹ÍÑ•ÉÉ•„(€€€€€€€€€€€€€€€€¹•Ñ	½Õ¹‘¥¹±¥•¹ÑI•Ð ¤(€€€€€€€€€€€€€€€€¹‰½ÑÑ½´ì(((€€€€€€€€€€€½¹ÍÐ‰½ÑÑ½µ‘”ô(€€€€€€€€€€€€€€€Á±…å•ÉI½Ü(€€€€€€€€€€€€€€€€¹•Ñ	½Õ¹‘¥¹±¥•¹ÑI•Ð ¤(€€€€€€€€€€€€€€€€¹‰½ÑÑ½´ì(((€€€€€€€€€€€Á…¹•°¹ÍÑå±”¹Á½Í¥Ñ¥½¸ô(€€€€€€€€€€€€€€€€‰™¥á•ˆì((€€€€€€€€€€€Á…¹•°¹ÍÑå±”¹Ñ½Àô(€€€€€€€€€€€€€€€Ñ½Á‘”¬‰Áàˆì((€€€€€€€€€€€Á…¹•°¹ÍÑå±”¹±•™Ðô(€€€€€€€€€€€€€€€€ˆÙÁàˆì((€€€€€€€€€€€Á…¹•°¹ÍÑå±”¹É¥¡Ðô(€€€€€€€€€€€€€€€€ˆÙÁàˆì((€€€€€€€€€€€Á…¹•°¹ÍÑå±”¹¡•¥¡Ðô((€€€€€€€€€€€€€€€€¡‰½ÑÑ½µ‘”µÑ½Á‘”¤¬(€€€€€€€€€€€€€€€€‰Áàˆì((€€€€€€€€€€€Á…¹•°¹ÍÑå±”¹é%¹‘•àô(€€€€€€€€€€€€€€€€ˆäääääˆì((€€€€€€€ô((€€€ô(€€€•±Í•ì((€€€€€€€€¼¨(€€€€€€€€€€ƒŠbƒ’â7–r£š"Ã¦²—’â·¾òkšâš:'–>¿¢÷šºcžVgžj¢†3–œ(€€€€€€€€€€ƒ–ºk’ö7š¢–ò?¾ò#’ú/–š’â+’âš²‡–r£š"Ã¦²—¦‚¦v‹¢Ž„(€€€€€€€€€€ƒš&O¦Z/šf¢¢·¦;žjÑ½À½¡•¥¡Ó¾ò'¾ò0(€€€€€€€€€€ƒ¢ºM™±½…Ñ¥¹œµµ½‘…³¦g–-±…ÍÏ¢÷–’€(€€€€€€€€€€ƒš¶–âãžRšV#¾ò3’â7¢Š¯šºcžVgžj¢†3–Ÿš¢–ò?–6‡’ö?Ž(€€€€€€€€¨¼((€€€€€€€Á…¹•°¹ÍÑå±”¹Á½Í¥Ñ¥½¸ô(€€€€€€€€€€€€ˆˆì((€€€€€€€Á…¹•°¹ÍÑå±”¹Ñ½Àô(€€€€€€€€€€€€ˆˆì((€€€€€€€Á…¹•°¹ÍÑå±”¹±•™Ðô(€€€€€€€€€€€€ˆˆì((€€€€€€€Á…¹•°¹ÍÑå±”¹É¥¡Ðô(€€€€€€€€€€€€ˆˆì((€€€€€€€Á…¹•°¹ÍÑå±”¹¡•¥¡Ðô(€€€€€€€€€€€€ˆˆì((€€€€€€€Á…¹•°¹ÍÑå±”¹é%¹‘•àô(€€€€€€€€€€€€ˆˆì((€€€ô(((€€€Á…¹•°¹ÍÑå±”¹‘¥ÍÁ±…äô(€€€€€€€€‰™±•àˆì()ô(()™Õ¹Ñ¥½¸±½Í•ÕÑ½	…ÑÑ±•M•ÑÑ¥¹Ì ¥ì((€€€½¹ÍÐÁ…¹•°ô(€€€€€€€€ ‰…ÕÑ½	…ÑÑ±•M•ÑÑ¥¹ÍA…¹•°ˆ¤ì(((€€€¥˜¡Á…¹•°¥ì((€€€€€€€Á…¹•°¹ÍÑå±”¹‘¥ÍÁ±…äô(€€€€€€€€€€€€‰¹½¹”ˆì(((€€€€€€€€¼¨(€€€€€€€€€€ƒŠbƒ’þ»š¶¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3šRçžR (€€€€€€€€€€½Á•¹!½µ••…ÑÕÉ” §–ö#žª_¦†¿ž’ë¢¢·–ºh(€€€€€€€€€€ƒ¦v‹švÿ’æ/–ú3¾ò'¾òh(€€€€€€€€€€ƒ–ššzs¦v‹švÿžn»–&7šb¿¢Š¯–¦Ë–ö#žª\(€€€€€€€€€€ƒ¾ò ¡½µ••…ÑÕÉ•5½‘…±	½‘ç¾ò'¢Ž‡¦†¿ž’ëžj(€€€€€€€€€€ƒŠSŠS’â7šb¿¢"+žj‘½Õµ•¹Ð¹‰½‘çšB³žžïšÎT(€€€€€€€€€€ƒŠSŠSš2'’â/Ž3žŠë–ºkŽ7šf¢š¦–B3šVÓ–/–ö#žª\(€€€€€€€€€€ƒ’â¢Öß¦^sš:'¾ò3’â7žÛ–ö#žª_šržVg–r£žV¯¦v‹’â+Ž(€€€€€€€€€€ƒ¢Ž‡¦v‹–6ïšb¿ž¦ëžj¾ò#¦v‹švÿ¢Š¯¢¢·š"A‘¥ÍÁ±…äè(€€€€€€€€€€¹½¹—¾ò'¾ò3žr/¢Öß’ú–?–6‡’ö?Ž(€€€€€€€€¨¼((€€€€€€€¥˜ (€€€€€€€€€€€Á…¹•°¹Á…É•¹Ñ9½‘”€˜˜(€€€€€€€€€€€Á…¹•°¹Á…É•¹Ñ9½‘”¹¥ôôô(€€€€€€€€€€€€‰¡½µ••…ÑÕÉ•5½‘…±	½‘äˆ(€€€€€€€€¥ì((€€€€€€€€€€€±½Í•!½µ••…ÑÕÉ” ¤ì((€€€€€€€€€€€É•ÑÕÉ¸ì((€€€€€€€ô(((€€€€€€€€¼¨(€€€€€€€€€€ƒŠbƒšZÃ–Š{¾ò#¢Þ}½Á•¹ÕÑ½	…ÑÑ±•M•ÑÑ¥¹Ì ¤(€€€€€€€€€€ƒžjšB³žžï–.W’ös¦7–Â7¾ò'¾òh(€€€€€€€€€€ƒ–ššzs¦v‹švÿžn»–&7¢Š¯šB³–"Á‘½Õµ•¹Ð¹‰½‘ä(€€€€€€€€€€ƒ–êW’â/¾ò#’î¢†£šb¿–ú{–rÃ–r[¾ò?–Þ‡¦
?¦‚¦v‹š&O¦Z/žj¾ò'¾ò0(€€€€€€€€€€ƒ¦^s¦Z'žjšf–gšB³–ny‰…ÑÑ±•A…—¢Ž‡–:šr³žj(€€€€€€€€€€ƒ’ö7žö»¾ò3’â›š*)™±½…Ñ¥¹œµµ½‘…³¦g–-±…ÍÌ(€€€€€€€€€€ƒš.ÿš:'¾ò3š‹–ú§š"C–:šr³–r£š"Ã¦²—¦‚¦v‹¢Ž„(€€€€€€€€€€ƒžj–ºk’ö7šZç–ò?Ž’â7¦gš¢–kžj¢¦Ç¾ò3¦v‹švÿšr€€€€€€€€€€ƒšÂã¦ƒžVg–r¡‰½‘ç–êW’â/¾ò3’â/š²‡–r£š"Ã¦²—¦‚¦vˆ(€€€€€€€€€€ƒ¢Ž‡š&O¦Z/šf¾ò3ž&#¦v‹šr¢ÞGš:'Ž(€€€€€€€€¨¼((€€€€€€€¥˜ (€€€€€€€€€€€Á…¹•°¹Á…É•¹Ñ9½‘”ôôô(€€€€€€€€€€€‘½Õµ•¹Ð¹‰½‘ä€˜˜(€€€€€€€€€€€…ÕÑ½M•ÑÑ¥¹Í=É¥¥¹…±A…É•¹Ð(€€€€€€€€¥ì((€€€€€€€€€€€¥˜ (€€€€€€€€€€€€€€€…ÕÑ½M•ÑÑ¥¹Í=É¥¥¹…±9•áÑM¥‰±¥¹œ€˜˜(€€€€€€€€€€€€€€€…ÕÑ½M•ÑÑ¥¹Í=É¥¥¹…±9•áÑM¥‰±¥¹œ¹Á…É•¹Ñ9½‘”ôôô(€€€€€€€€€€€€€€€…ÕÑ½M•ÑÑ¥¹Í=É¥¥¹…±A…É•¹Ð(€€€€€€€€€€€€¥ì((€€€€€€€€€€€€€€€…ÕÑ½M•ÑÑ¥¹Í=É¥¥¹…±A…É•¹Ð¹¥¹Í•ÉÑ	•™½É” (€€€€€€€€€€€€€€€€€€€Á…¹•°°(€€€€€€€€€€€€€€€€€€€…ÕÑ½M•ÑÑ¥¹Í=É¥¥¹…±9•áÑM¥‰±¥¹œ(€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€ô(€€€€€€€€€€€•±Í•ì((€€€€€€€€€€€€€€€…ÕÑ½M•ÑÑ¥¹Í=É¥¥¹…±A…É•¹Ð¹…ÁÁ•¹‘¡¥± (€€€€€€€€€€€€€€€€€€€Á…¹•°(€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€ô(((€€€€€€€€€€€Á…¹•°¹±…ÍÍ1¥ÍÐ¹É•µ½Ù” (€€€€€€€€€€€€€€€€‰™±½…Ñ¥¹œµµ½‘…°ˆ(€€€€€€€€€€€€¤ì((€€€€€€€ô((€€€ô()ô(((¼¨(€€ƒŠbƒšZÃ–Š{¾òkš*+žn»–&7¢¢·–ºk¦v‹švÿžV¯¦v‹’â+¦†¿ž’ëžj–ó¾ò0(€€ƒ–¶c–n{Ž1¡…É…Ñ•É%¹‘•ãŽ7¦g–/¢žK¢&Ëžj(€€…ÕÑ½½¹™¥œ½…ÕÑ½½¹™¥œË¢ê¯’â+Ž(€€ƒ–r£–"š>o¢žK¢&Ë’æ/–&7Ž’î—–>+žrš¶š2'’â/žŠë–ºkšf(€€ƒ¦÷šr–Fó–>¯¦g¢Ž‡¾ò3žŠë’þwšÊKšr'’îï’öW’â¦
+žj¢ªÿšVÐ(€€ƒšr–nƒž
ë–"š>o¢žK¢&Ë¢3’â7–Â?–þ¦ë–’ÇŽ(¨¼()™Õ¹Ñ¥½¸Í…Ù•ÕÑ½M•ÑÑ¥¹Í½ÉµQ½¡…É…Ñ•È¡¡…É…Ñ•É%¹‘•à¥ì((€€€½¹ÍÐ…Ñ¥½¹M•±•Ðô(€€€€€€€€ ‰…ÕÑ½M•ÑÑ¥¹ÍÑ¥½¹M•±•Ðˆ¤ì(((€€€½¹ÍÐ¡ÁM•±•Ðô(€€€€€€€€ ‰…ÕÑ½M•ÑÑ¥¹Í!@ˆ¤ì(((€€€½¹ÍÐÍÁM•±•Ðô(€€€€€€€€ ‰…ÕÑ½M•ÑÑ¥¹ÍM@ˆ¤ì(((€€€½¹ÍÐÉ•ÑÕÉ¹¥Ñå¡•­‰½àô(€€€€€€€€ ‰…ÕÑ½M•ÑÑ¥¹ÍI•ÑÕÉ¹¥Ñäˆ¤ì(((€€€½¹ÍÐÑ…É•Ñ½¹™¥œô(€€€€€€€•ÑA…ÉÑåÕÑ½½¹™¥œ¡9Õµ‰•È¡¡…É…Ñ•É%¹‘•à¤¤ì(((€€€¥˜¡…Ñ¥½¹M•±•Ð¥ì((€€€€€€€Ñ…É•Ñ½¹™¥œ¹Í­¥±°ô(€€€€€€€€€€€…Ñ¥½¹M•±•Ð¹Ù…±Õ”ì((€€€ô(((€€€¥˜¡¡ÁM•±•Ð¥ì((€€€€€€€Ñ…É•Ñ½¹™¥œ¹¡Àô(€€€€€€€€€€€9Õµ‰•È¡¡ÁM•±•Ð¹Ù…±Õ”¤ì((€€€ô(((€€€¥˜¡ÍÁM•±•Ð¥ì((€€€€€€€Ñ…É•Ñ½¹™¥œ¹ÍÀô(€€€€€€€€€€€9Õµ‰•È¡ÍÁM•±•Ð¹Ù…±Õ”¤ì((€€€ô(((€€€¥˜¡É•ÑÕÉ¹¥Ñå¡•­‰½à¥ì((€€€€€€€Ñ…É•Ñ½¹™¥œ¹É•ÑÕÉ¹Q½¥Ñå]¡•¹µÁÑäô((€€€€€€€€€€€É•ÑÕÉ¹¥Ñå¡•­‰½à¹¡•­•ì((€€€ô()ô(()™Õ¹Ñ¥½¸ÍÝ¥Ñ¡ÕÑ½M•ÑÑ¥¹Í¡…É…Ñ•È¡Í­¥ÁM…Ù”¥ì((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾ò#žrš¶¢žšÆëŽ3–"š>o¢žK¢&Ëšr¦ë–’Ä(€€€€€€ƒšr«–Ë–¶c¢º+šnÓŽ7žj‰ÕŸ¾ò'¾òh(€€€€€€ƒ–r£¢º–>[šZÃ¢žK¢&Ëžj¢ÎšZgŽ¦7šZÃžV¯¦v‹’æ/–&7¾ò0(€€€€€€ƒ–#š*+Ž3žn»–&7žV¯¦v‹’â+¦†¿ž’ëžj–óŽ4(€€€€€€ƒ–¶c–n{Ž3–"š>o–&7Ž7¦
–/¢žK¢&Ë¢ê¯’â+ŠSŠP(€€€€€€ƒ¦gš¢’öÿžR£¢’â7žº‡–r¡Ž–§–/¢žK¢&Ë’æ/¦ZL(€€€€€€ƒ–"š>o–æûš²‡Ž¢ªÿšVÓ–æûš²‡¾ò0(€€€€€€ƒš¾?’âš²‡–"š>o¦÷šr–#–æ¯–þg–¶c¢Öß’ú¾ò0(€€€€€€ƒ’â7žR£–"’â–/¢žK¢&Ë–ÂÇ¢šš2'’âš²‡žŠë–ºk¾ò0(€€€€€€ƒšr–ú3žÖÇ’âš2'’âš²‡žŠë–ºk–6Ï–>¿Ž((€€€€€€ƒŠbƒ’öšr'–/’ú/–’[¾òk–&oš&O¦Z/¢¢·–ºk¦v‹švÿžj¦
’â–"ì(€€€€€€ƒ¾ò!½Á•¹ÕÑ½	…ÑÑ±•M•ÑÑ¥¹Ì §–Fó–>¯¦g¢Ž‡šf¾ò'¾ò0(€€€€€€ƒžV¯¦v‹’â+žjš²’ö7–Û–¾›šb¿Ž3’â+’âš²‡¦^s¦Z'šf(€€€€€€ƒšºcžVgžj¢"+–Ÿ–ºçŽ7¾ò3’â7šb¿ž:§–ºÛš¶–r£žÞ£¢ò¿žjšvÇ¢–ÿ¾ò0(€€€€€€ƒ¦gšf–g–ššzs¦
–~ß¢†3Ž3–¶c–n{’â+’â–/¢žK¢&ËŽ7¾ò0(€€€€€€ƒ–>7¢3šržR£¦g’êo¦;šfžjšºcžVg–ó¾ò0(€€€€€€ƒš*+¢žK¢&Ëžrš¶žj¢¢·–ºk¢š¢N/š:'Ž(€€€€€€ƒš&’î—–&oš&O¦Z/¦v‹švÿšfžR¡Í­¥ÁM…Ù”õÑÉÕ—¢ÞÏ¦;¦g’âš¶—¾ò0(€€€€€€ƒ–>«šr'ž:§–ºÛ–r£¦v‹švÿŽ3–ÞËžÚOš&O¦Z/žjž.š/’â/Ž4(€€€€€€ƒ’âï–.W–"š>o¢žK¢&Ëšf¾ò3š&7¦r¢š–Ë–¶cŽ(€€€€¨¼((€€€¥˜ …Í­¥ÁM…Ù”¥ì((€€€€€€€Í…Ù•ÕÑ½M•ÑÑ¥¹Í½ÉµQ½¡…É…Ñ•È (€€€€€€€€€€€…ÕÑ½M•ÑÑ¥¹ÍÕÉÉ•¹Ñ¡…É…Ñ•È(€€€€€€€€¤ì((€€€ô(((€€€½¹ÍÐ¡…É…Ñ•ÉM•±•Ðô(€€€€€€€€ ‰…ÕÑ½M•ÑÑ¥¹Í¡…É…Ñ•ÉM•±•Ðˆ¤ì(((€€€½¹ÍÐ…Ñ¥½¹M•±•Ðô(€€€€€€€€ ‰…ÕÑ½M•ÑÑ¥¹ÍÑ¥½¹M•±•Ðˆ¤ì(((€€€½¹ÍÐ¡ÁM•±•Ðô(€€€€€€€€ ‰…ÕÑ½M•ÑÑ¥¹Í!@ˆ¤ì(((€€€½¹ÍÐÍÁM•±•Ðô(€€€€€€€€ ‰…ÕÑ½M•ÑÑ¥¹ÍM@ˆ¤ì(((€€€½¹ÍÐÉ•ÑÕÉ¹¥Ñå¡•­‰½àô(€€€€€€€€ ‰…ÕÑ½M•ÑÑ¥¹ÍI•ÑÕÉ¹¥Ñäˆ¤ì(((€€€¥˜ …¡…É…Ñ•ÉM•±•Ð¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€±•ÐÉ•ÅÕ•ÍÑ•‘%¹‘•àô(€€€€€€€9Õµ‰•È¡¡…É…Ñ•ÉM•±•Ð¹Ù…±Õ”¤ì((€€€¥˜ …•ÑA…ÉÑå¡…É…Ñ•É	å%¹‘•à¡É•ÅÕ•ÍÑ•‘%¹‘•à¤¥ì((€€€€€€€¡…É…Ñ•ÉM•±•Ð¹Ù…±Õ”ôˆÀˆì(€€€€€€€É•ÅÕ•ÍÑ•‘%¹‘•àôÀì((€€€ô(((€€€½¹ÍÐÑ…É•Ñ½¹™¥œô(€€€€€€€•ÑA…ÉÑåÕÑ½½¹™¥œ¡É•ÅÕ•ÍÑ•‘%¹‘•à¤ì(((€€€Ñ…É•Ñ½¹™¥œ¹¡Àõ¹½Éµ…±¥é•ÕÑ½	…ÑÑ±•Q¡É•Í¡½±¡Ñ…É•Ñ½¹™¥œ¹¡À°ÔÀ¤ì(€€€Ñ…É•Ñ½¹™¥œ¹ÍÀõ¹½Éµ…±¥é•ÕÑ½	…ÑÑ±•Q¡É•Í¡½±¡Ñ…É•Ñ½¹™¥œ¹ÍÀ°ÈÔ¤ì(((€€€½¹ÍÐ¡…É…Ñ•É%ô(€€€€€€€•ÑA…ÉÑå¡…É…Ñ•É-•ä¡É•ÅÕ•ÍÑ•‘%¹‘•à¤ì(((€€€½¹ÍÐ±½…‘½ÕÐô(€€€€€€€¡…É…Ñ•ÉM­¥±±1½…‘½ÕÑÍl(€€€€€€€€€€€¡…É…Ñ•É%(€€€€€€€tì(((€€€€¼¨(€€€€€€ƒŠbƒ¢«–.W¢†3–.W’â/š.'¦ã–Z»¾òh(€€€€€€ƒšf»¦kšRïšN+Ž¦bËžš›¾ò3–*ƒ’â+¢¦Ë¢žK¢&Ë¢Žw–
gžj(€€€€€€ƒš¾?’âš‚óš*¢÷¾ò#šr–’hÓ–/¾ò'Ž(€€€€¨¼((€€€¥˜¡…Ñ¥½¹M•±•Ð¥ì((€€€€€€€±•Ð½ÁÑ¥½¹Í!Q50ô((€€€€€€€€€€€€œñ½ÁÑ¥½¸Ù…±Õ”ô‰¹½Éµ…°ˆûšf»¦kšRïšN(ð½½ÁÑ¥½¸øœ¬(€€€€€€€€€€€€œñ½ÁÑ¥½¸Ù…±Õ”ô‰‘•™•¹ˆû¦bËžš˜ð½½ÁÑ¥½¸øœì(((€€€€€€€¥˜¡±½…‘½ÕÐ¥ì((€€€€€€€€€€€±½…‘½ÕÐ¹•ÅÕ¥ÁÁ•‘M­¥±±Ì¹™½É…  (€€€€€€€€€€€€€€€Í­¥±±%ôùì((€€€€€€€€€€€€€€€€€€€½¹ÍÐÍ­¥±°ô(€€€€€€€€€€€€€€€€€€€€€€€Í­¥±±…Ñ…‰…Í•mÍ­¥±±%‘tì(((€€€€€€€€€€€€€€€€€€€¥˜ (€€€€€€€€€€€€€€€€€€€€€€€€…Í­¥±°ñð(€€€€€€€€€€€€€€€€€€€€€€€Í­¥±°¹…Ñ•½Éäôôô‰‰Õ™˜‰ñð(€€€€€€€€€€€€€€€€€€€€€€€Í­¥±°¹…Ñ•½Éäôôô‰Á…ÍÍ¥Ù”‰ñð(€€€€€€€€€€€€€€€€€€€€€€€Í­¥±°¹…Ñ•½Éäôôô‰¡•…°‰ñð(€€€€€€€€€€€€€€€€€€€€€€€Í­¥±°¹…Ñ•½Éäôôô‰É•Ù¥Ù”ˆ(€€€€€€€€€€€€€€€€€€€€¥ì(€€€€€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€€€€€€€€€€€€€ô(((€€€€€€€€€€€€€€€€€€€½ÁÑ¥½¹Í!Q50¬ô((€€€€€€€€€€€€€€€€€€€€€€€€œñ½ÁÑ¥½¸Ù…±Õ”ôˆœ¬(€€€€€€€€€€€€€€€€€€€€€€€Í­¥±±%¬(€€€€€€€€€€€€€€€€€€€€€€€€œˆøœ¬(€€€€€€€€€€€€€€€€€€€€€€€Í­¥±°¹¹…µ”¬(€€€€€€€€€€€€€€€€€€€€€€€€œð½½ÁÑ¥½¸øœì((€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€¤ì((€€€€€€€ô(((€€€€€€€…Ñ¥½¹M•±•Ð¹¥¹¹•É!Q50ô(€€€€€€€€€€€½ÁÑ¥½¹Í!Q50ì(((€€€€€€€½¹ÍÐÍÑ¥±±Y…±¥ô((€€€€€€€€€€€ÉÉ…ä¹™É½´ (€€€€€€€€€€€€€€€…Ñ¥½¹M•±•Ð¹½ÁÑ¥½¹Ì(€€€€€€€€€€€€¤(€€€€€€€€€€€€¹Í½µ” (€€€€€€€€€€€€€€€½ÁÐôø(€€€€€€€€€€€€€€€€€€€½ÁÐ¹Ù…±Õ”ôôô(€€€€€€€€€€€€€€€€€€€Ñ…É•Ñ½¹™¥œ¹Í­¥±°(€€€€€€€€€€€€¤ì(((€€€€€€€…Ñ¥½¹M•±•Ð¹Ù…±Õ”ô((€€€€€€€€€€€ÍÑ¥±±Y…±¥(€€€€€€€€€€€€ü(€€€€€€€€€€€Ñ…É•Ñ½¹™¥œ¹Í­¥±°(€€€€€€€€€€€€è(€€€€€€€€€€€€‰¹½Éµ…°ˆì((€€€ô(((€€€¥˜¡¡ÁM•±•Ð¥ì((€€€€€€€¡ÁM•±•Ð¹Ù…±Õ”ô(€€€€€€€€€€€Ñ…É•Ñ½¹™¥œ¹¡Àì((€€€ô(((€€€¥˜¡ÍÁM•±•Ð¥ì((€€€€€€€ÍÁM•±•Ð¹Ù…±Õ”ô(€€€€€€€€€€€Ñ…É•Ñ½¹™¥œ¹ÍÀì((€€€ô(((€€€¥˜¡É•ÑÕÉ¹¥Ñå¡•­‰½à¥ì((€€€€€€€É•ÑÕÉ¹¥Ñå¡•­‰½à¹¡•­•ô((€€€€€€€€€€€€„…Ñ…É•Ñ½¹™¥œ¹É•ÑÕÉ¹Q½¥Ñå]¡•¹µÁÑäì((€€€ô(((€€€€¼¨(€€€€€€ƒŠbƒšnÓšZÃ¢þ÷¢æ“¢º+šVã¾ò3¢¢c’ö?¢†£–Z»ž>û–r£¦†¿ž’ëžj(€€€€€€ƒšb¿–N«–/¢žK¢&Ë¾ò3’â/š²‡–"š>ošfš&7ž~—¦L(€€€€€€ƒ¢šš*+¢ÎšZg–¶c–n{¢ªÃ¢ê¯’â+Ž(€€€€¨¼((€€€…ÕÑ½M•ÑÑ¥¹ÍÕÉÉ•¹Ñ¡…É…Ñ•Èô(€€€€€€€É•ÅÕ•ÍÑ•‘%¹‘•àì()ô(()™Õ¹Ñ¥½¸½¹™¥ÉµÕÑ½	…ÑÑ±•M•ÑÑ¥¹Ì ¥ì((€€€½¹ÍÐ¡…É…Ñ•ÉM•±•Ðô(€€€€€€€€ ‰…ÕÑ½M•ÑÑ¥¹Í¡…É…Ñ•ÉM•±•Ðˆ¤ì(((€€€¥˜ …¡…É…Ñ•ÉM•±•Ð¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾òkžnÓš:—–Fó–>¯–ÇžR£žj–Ë–¶c–÷–ò?¾ò0(€€€€€€ƒžŠë’þw¦g¢Ž‡¢Þ–"š>o¢žK¢&ËšfžR£žjšb¿–B3’â––_¦
?¢ò¿¾ò0(€€€€€€ƒ’â7šr–ëž>û–§¦
+–B–¾¯’â’î÷Ž’î—–ú3šRç’â¦
+–þc¢¢cšRä(€€€€€€ƒ–>›’â¦
+žjššÎŽ(€€€€¨¼((€€€Í…Ù•ÕÑ½M•ÑÑ¥¹Í½ÉµQ½¡…É…Ñ•È (€€€€€€€9Õµ‰•È¡¡…É…Ñ•ÉM•±•Ð¹Ù…±Õ”¤(€€€€¤ì(((€€€€¼¨(€€€€€€ƒŠbƒ¢¢·–ºk–º3–B3š¶—’â’â/’âï–~;¦
¦
+žj¢"+ž&!U$(€€€€€€ƒ¾ò#–ššzsž:§–ºÛ’æ/–ú3¦
šb¿šr–:ï’âï–~;¢ªÿšVÓ¾ò'¾ò0(€€€€€€ƒ¦ÿ–7–§¦
+¦†¿ž’ëžjšVã–¶_–Â7’â7’â+Ž(€€€€¨¼((€€€¥˜¡¡…É…Ñ•ÉM•±•Ð¹Ù…±Õ”ôôôˆÄˆ¥ì((€€€€€€€Á½ÁÕ±…Ñ•ÕÑ½M­¥±±=ÁÑ¥½¹ÌÈ ¤ì((€€€ô(€€€•±Í”¥˜¡¡…É…Ñ•ÉM•±•Ð¹Ù…±Õ”ôôôˆÀˆ¥ì((€€€€€€€Á½ÁÕ±…Ñ•ÕÑ½M­¥±±=ÁÑ¥½¹Ì ¤ì((€€€ô(((€€€Í…Ù•…µ” ¤ì(((€€€±½Í•ÕÑ½	…ÑÑ±•M•ÑÑ¥¹Ì ¤ì(((€€€…‘‘	…ÑÑ±•1½œ (€€€€€€€€‹¢«–.Wš"Ã¦²—¢¢·–ºk–ÞËšnÓšZÃŽˆ(€€€€¤ì()ô(((¼¨ÕÑ½µ…Ñ¥Œ½µ‰…Ð½¹±ä‘•±…É•Ì½µ‰…Ð…Ñ¥½¹Ì¸!@½M@É•½Ù•Éä¥Ì¡…¹‘±•(€€½¹”…™Ñ•ÈÙ¥Ñ½Éä‰ä…ÁÁ±åA½ÍÑ	…ÑÑ±•ÕÑ½I•½Ù•Éä ¤¸€¨¼)™Õ¹Ñ¥½¸…ÕÑ½Ñ¥½¹½É¡…É…Ñ•È¡¡…É…Ñ•É%¹‘•à±Ñ½­•¸¥ì(€€€½¹ÍÐ¡…É…Ñ•Èõ•ÑA…ÉÑå¡…É…Ñ•É	å%¹‘•à¡¡…É…Ñ•É%¹‘•à¤ì(€€€½¹ÍÐ½¹™¥œõ•ÑA…ÉÑåÕÑ½½¹™¥œ¡¡…É…Ñ•É%¹‘•à¤ì(€€€½¹ÍÐ…ÕÑ½=¸õ¡…É…Ñ•É%¹‘•àôôôÀý…ÕÑ½	…ÑÑ±”é½¹™¥œ¹•¹…‰±•ì((€€€¥˜ …‰…ÑÑ±•Ñ¥Ù•ñð…¡…É…Ñ•Éññ¡…É…Ñ•È¹¡ÀðôÁñð……ÕÑ½=¹ññÑ½­•¸„ôõ‰…ÑÑ±•Q½­•¸¥ìÉ•ÑÕÉ¸ìô((€€€¥˜¡½¹™¥œ¹Í­¥±°ôôô‰‘•™•¹ˆ¥ì(€€€€€€€ÅÕ•Õ•‘A±…å•ÉÑ¥½¹Ím¡…É…Ñ•É%¹‘•átõí…Ñ¥½¸è‰‘•™•¹ˆ±Ñ…É•Ðé¹Õ±±ôì(€€€€€€€ÕÁ‘…Ñ•U$ ¤ì™¥¹¥Í¡A±…å•ÉÑ¥½¸ ¤ìÉ•ÑÕÉ¸ì(€€€ô((€€€½¹ÍÐ…±¥Ù•%¹	…ÑÑ±”õÕÉÉ•¹Ñ	…ÑÑ±•5½¹ÍÑ•ÉÌ¹™¥±Ñ•È¡¥¹‘•àôù¥Í	…ÑÑ±•Q…É•Ñ±¥Ù” ‰µ½¹ÍÑ•Èˆ±¥¹‘•à¤¤ì(€€€¥˜¡…±¥Ù•%¹	…ÑÑ±”¹±•¹Ñ ôôôÀ¥ì¡•­	…ÑÑ±•¹ ¤ìÉ•ÑÕÉ¸ìô((€€€±•Ð…Ñ¥½¸õ½¹™¥œ¹Í­¥±±ñð‰¹½Éµ…°ˆì(€€€±•ÐÍ­¥±°õ…Ñ¥½¸„ôô‰¹½Éµ…°ˆýÍ­¥±±…Ñ…‰…Í•m…Ñ¥½¹té¹Õ±°ì(€€€½¹ÍÐÍ­¥±±-•äõ•ÑA…ÉÑå¡…É…Ñ•É-•ä¡¡…É…Ñ•É%¹‘•à¤ì(€€€¥˜¡…Ñ¥½¸„ôô‰¹½Éµ…°ˆ˜˜ (€€€€€€€€…Í­¥±±ñð(€€€€€€€•ÑM­¥±±1•Ù•°¡Í­¥±±-•ä±…Ñ¥½¸¤ðôÁñð(€€€€€€€¡…É…Ñ•È¹ÍÀð¡Í­¥±°¹ÍÁ½ÍÐ„ôõÕ¹‘•™¥¹•ýÍ­¥±°¹ÍÁ½ÍÐè¡Í­¥±°¹½ÍÑñðÀ¤¥ñð(€€€€€€€l‰‰Õ™˜ˆ°‰Á…ÍÍ¥Ù”ˆ°‰¡•…°ˆ°‰É•Ù¥Ù”‰t¹¥¹±Õ‘•Ì¡Í­¥±°¹…Ñ•½Éä¤(€€€€¤¥ì(€€€€€€€…Ñ¥½¸ô‰¹½Éµ…°ˆì(€€€€€€€Í­¥±°õ¹Õ±°ì(€€€ô((€€€½¹ÍÐÍ­¥±±1•Ù•°õÍ­¥±°ý•ÑM­¥±±1•Ù•°¡Í­¥±±-•ä±…Ñ¥½¸¤èÀì(€€€½¹ÍÐÑ…É•ÑQåÁ”õÍ­¥±°(€€€€€€€€ý¹½Éµ…±¥é•	…ÑÑ±•Q…É•ÑQåÁ”¡•Ñ™™•Ñ¥Ù•M­¥±±Q…É•ÑQåÁ”¡Í­¥±°±Í­¥±±1•Ù•°¤¤(€€€€€€€€è‰Í¥¹±”ˆì((€€€¥˜¡Ñ…É•ÑQåÁ”ôôô‰…±°ˆ¥ì(€€€€€€€ÅÕ•Õ•‘A±…å•ÉÑ¥½¹Ím¡…É…Ñ•É%¹‘•átõí…Ñ¥½¸é…Ñ¥½¸±Ñ…É•Ðé¹Õ±±ôì(€€€€€€€ÕÁ‘…Ñ•U$ ¤ì™¥¹¥Í¡A±…å•ÉÑ¥½¸ ¤ìÉ•ÑÕÉ¸ì(€€€ô((€€€½¹ÍÐ…¹‘¥‘…Ñ•Ìõ…±¥Ù•%¹	…ÑÑ±”¹™¥±Ñ•È¡¥¹‘•àôø(€€€€€€€…¹M•±•Ñ!½ÍÑ¥±•	…ÑÑ±•AÉ¥µ…Éä ‰µ½¹ÍÑ•Èˆ±¥¹‘•à±Ñ…É•ÑQåÁ”¤(€€€€¤ì(€€€¥˜ ……¹‘¥‘…Ñ•Ì¹±•¹Ñ ¥ì(€€€€€€€ÅÕ•Õ•‘A±…å•ÉÑ¥½¹Ím¡…É…Ñ•É%¹‘•átõí…Ñ¥½¸è‰‘•™•¹ˆ±Ñ…É•Ðé¹Õ±±ôì(€€€€€€€…‘‘	…ÑÑ±•1½œ ¡¡…É…Ñ•È¹¥‘ñð‹¢žK¢&Èˆ¤¬‹š&û’â7–"Ã–>¿¢Š¯–Z»¦®S¾ò?š2–ºkž¾–r7šRïšN+¦ã’â·žjžn»š¢g¾ò3šRçž
ë¦bËžš›Žˆ¤ì(€€€€€€€ÕÁ‘…Ñ•U$ ¤ì™¥¹¥Í¡A±…å•ÉÑ¥½¸ ¤ìÉ•ÑÕÉ¸ì(€€€ô((€€€±•ÐÑ…É•Ðõ…¹‘¥‘…Ñ•ÍlÁtì(€€€¥˜¡Í­¥±°˜™l‰ÑÉ¤ˆ°‰É½Üˆ°‰½±Õµ¸‰t¹¥¹±Õ‘•Ì¡Ñ…É•ÑQåÁ”¤¥ì(€€€€€€€±•Ð‰•ÍÑ½Õ¹Ðô´Äì(€€€€€€€…¹‘¥‘…Ñ•Ì¹™½É… ¡…¹‘¥‘…Ñ”ôùì(€€€€€€€€€€€½¹ÍÐ¡¥Ñ½Õ¹Ðõ•ÑM­¥±±Q…É•ÑÌ¡…¹‘¥‘…Ñ”±Ñ…É•ÑQåÁ”¤¹±•¹Ñ ì(€€€€€€€€€€€¥˜¡¡¥Ñ½Õ¹Ðù‰•ÍÑ½Õ¹Ð¥ì‰•ÍÑ½Õ¹Ðõ¡¥Ñ½Õ¹ÐìÑ…É•Ðõ…¹‘¥‘…Ñ”ìô(€€€€€€€ô¤ì(€€€ô((€€€ÅÕ•Õ•‘A±…å•ÉÑ¥½¹Ím¡…É…Ñ•É%¹‘•átõí…Ñ¥½¸é…Ñ¥½¸±Ñ…É•ÐéÑ…É•Ñôì(€€€ÕÁ‘…Ñ•U$ ¤ì(€€€™¥¹¥Í¡A±…å•ÉÑ¥½¸ ¤ì)ô()™Õ¹Ñ¥½¸…ÕÑ½Ñ¥½¸¡Ñ½­•¸¥ì(€€€É•ÑÕÉ¸…ÕÑ½Ñ¥½¹½É¡…É…Ñ•È À±Ñ½­•¸¤ì)ô((¼¨‘‘¥Ñ¥½¹…°Á…ÉÑäµ•µ‰•ÉÌÍ¡…É”Ñ¡”Í…µ”‘•±…É…Ñ¥½¸½Ý¹•È¸€¨¼)™Õ¹Ñ¥½¸Á±…å•ÈÉÕÑ½Ñ¥½¸¡Ñ½­•¸¥ì(€€€É•ÑÕÉ¸…ÕÑ½Ñ¥½¹½É¡…É…Ñ•È Ä±Ñ½­•¸¤ì)ô()™Õ¹Ñ¥½¸Á±…å•ÈÍÕÑ½Ñ¥½¸¡Ñ½­•¸¥ì(€€€É•ÑÕÉ¸…ÕÑ½Ñ¥½¹½É¡…É…Ñ•È È±Ñ½­•¸¤ì)ô(()™Õ¹Ñ¥½¸Í•½¹‘…Éå¡…É…Ñ•É9½Éµ…±ÑÑ…¬¡¡…É…Ñ•É%¹‘•à±¥¹‘•à¥ì((€€€½¹ÍÐ¡…É…Ñ•Èõ•ÑA…ÉÑå¡…É…Ñ•É	å%¹‘•à¡¡…É…Ñ•É%¹‘•à¤ì(€€€½¹ÍÐÍÑ…ÑÌõ•ÑA…ÉÑå	…ÑÑ±•MÑ…ÑÌ¡¡…É…Ñ•É%¹‘•à¤ì((€€€¥¹‘•àõ™¥¹‘±¥Ù•Q…É•Ñ%¹‘•à¡¥¹‘•à°‰Í¥¹±”ˆ¤ì((€€€¥˜ …¡…É…Ñ•Èñð€…ÍÑ…ÑÌñð¥¹‘•àôôõ¹Õ±°¥ì(€€€€€€€™¥¹¥Í¡A±…å•ÉÑ¥½¸ ¤ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô((€€€Í•±•Ñ•‘5½¹ÍÑ•Èõ¥¹‘•àì(€€€½¹ÍÐµ½¹ÍÑ•Èõµ½¹ÍÑ•ÉÍm¥¹‘•átì((€€€±Õ¹•A±…å•É…É¡¡…É…Ñ•É%¹‘•à¤ì(€€€Í¡½ÝM­¥±±9…µ•	…‘” ‹šf»¦kšRïšN(ˆ°‰¹½Éµ…°ˆ±¡…É…Ñ•É%¹‘•à±¥¹‘•à±m¥¹‘•át¤ì((€€€½¹ÍÐ¡¥ÐõÉ½±±!¥Ñ¡…¹” (€€€€€€€ÍÑ…ÑÌ¹…ÕÉ…ä°(€€€€€€€•Ñ5½¹ÍÑ•ÉÙ…Í¥½¸¡µ½¹ÍÑ•È¤°(€€€€€€€•Ñ5½¹ÍÑ•É•‰Õ™™Y…±Õ”¡¡…É…Ñ•È°‰ÍÑÕ¸ˆ¤°(€€€€€€€•ÑÑ¥Ù•ÕÉ…å	½¹ÕÍA•É•¹Ð¡¡…É…Ñ•È¤(€€€€¤ì((€€€¥˜ …¡¥Ð¥ì(€€€€€€€Í¡½Ý5¥ÍÍ™™•Ð¡™…±Í”±¥¹‘•à°‰5%MLˆ¤ì(€€€€€€€…‘‘	…ÑÑ±•1½œ ¡¡…É…Ñ•È¹¥‘ñð‹¦j+–>,ˆ¤¬‹šf»¦kšRïšN(ˆ­µ½¹ÍÑ•È¹¹…µ”¬‹¾ò3šÊKšr'–F÷’â·¾òˆ¤ì(€€€€€€€ÕÁ‘…Ñ•U$ ¤ì(€€€€€€€™¥¹¥Í¡A±…å•ÉÑ¥½¸ ¤ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô((€€€½¹ÍÐÉ¥ÑI•ÍÕ±ÐõÉ½±±É¥Ñ¥…° (€€€€€€€¡…É…Ñ•È°(€€€€€€€€‰Á¡åÍ¥…°ˆ°(€€€€€€€•Ñ5½¹ÍÑ•É™™•Ñ¥Ù•¹Ñ¥É¥Ð¡µ½¹ÍÑ•È¤°(€€€€€€€µ½¹ÍÑ•È(€€€€¤ì((€€€½¹ÍÐ‘…µ…”õ…±Õ±…Ñ•…µ…” (€€€€€€€ÍÑ…ÑÌ¹…ÑÑ…¬°(€€€€€€€•Ñ5½¹ÍÑ•É™™•Ñ¥Ù••™•¹Í”¡µ½¹ÍÑ•È¤°(€€€€€€€¡…É…Ñ•È¹±•Ù•°°(€€€€€€€µ½¹ÍÑ•È¹±•Ù•°°(€€€€€€€¡…É…Ñ•È¹•±•µ•¹Ð°(€€€€€€€µ½¹ÍÑ•È¹•±•µ•¹Ð°(€€€€€€€ì(€€€€€€€€€€€…ÑÑ…­•Èé¡…É…Ñ•È°(€€€€€€€€€€€Ñ…É•Ðéµ½¹ÍÑ•È°(€€€€€€€€€€€É¥Ñ5Õ±Ñ¥Á±¥•ÈéÉ¥ÑI•ÍÕ±Ð¹µÕ±Ñ¥Á±¥•È(€€€€€€€ô(€€€€¤ì(€€€µ½¹ÍÑ•È¹¡Àõ5…Ñ ¹µ…à À±µ½¹ÍÑ•È¹¡Àµ‘…µ…”¤ì((€€€Í¡½Ý5½¹ÍÑ•É!¥Ð¡¥¹‘•à±‘…µ…”°‰¡Àˆ±É¥ÑI•ÍÕ±Ð¹¥ÍÉ¥Ð¤ì(€€€…‘‘	…ÑÑ±•1½œ (€€€€€€€€¡¡…É…Ñ•È¹¥‘ñð‹¦j+–>,ˆ¤¬‹šf»¦kšRïšN(ˆ­µ½¹ÍÑ•È¹¹…µ”¬(€€€€€€€€¡É¥ÑI•ÍÕ±Ð¹¥ÍÉ¥Ð€ü€‹¾ò#ž"šN+¾ò¾ò$ˆ€è€ˆˆ¤¬(€€€€€€€€‹¾ò3¦ƒš"@ˆ­‘…µ…”¬‹–
ß–ºÏŽˆ(€€€€¤ì((€€€¥˜¡µ½¹ÍÑ•È¹¡ÀðôÀ¥ì­¥±±5½¹ÍÑ•È¡¥¹‘•à¤ìô((€€€ÕÁ‘…Ñ•U$ ¤ì(€€€™¥¹¥Í¡A±…å•ÉÑ¥½¸ ¤ì)ô(()™Õ¹Ñ¥½¸…ÍÑM•½¹‘…Éå¡…É…Ñ•ÉM­¥±°¡¡…É…Ñ•É%¹‘•à±Í­¥±±%±•¹Ñ•É%¹‘•à¥ì((€€€½¹ÍÐ¡…É…Ñ•Èõ•ÑA…ÉÑå¡…É…Ñ•É	å%¹‘•à¡¡…É…Ñ•É%¹‘•à¤ì(€€€½¹ÍÐ¡…É…Ñ•É-•äõ•ÑA…ÉÑå¡…É…Ñ•É-•ä¡¡…É…Ñ•É%¹‘•à¤ì(€€€½¹ÍÐÍÑ…ÑÌõ•ÑA…ÉÑå	…ÑÑ±•MÑ…ÑÌ¡¡…É…Ñ•É%¹‘•à¤ì(€€€½¹ÍÐÍ­¥±°õÍ­¥±±…Ñ…‰…Í•mÍ­¥±±%‘tì((€€€¥˜ …¡…É…Ñ•Èñð€…ÍÑ…ÑÌñð€…Í­¥±°¥ì(€€€€€€€™¥¹¥Í¡A±…å•ÉÑ¥½¸ ¤ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô((€€€½¹ÍÐ±•Ù•°õ•ÑM­¥±±1•Ù•°¡¡…É…Ñ•É-•ä±Í­¥±±%¤ì(€€€½¹ÍÐÍÁ½ÍÐõÍ­¥±°¹ÍÁ½ÍÐ„ôõÕ¹‘•™¥¹•€üÍ­¥±°¹ÍÁ½ÍÐ€è€¡Í­¥±°¹½ÍÑñðÀ¤ì((€€€¥˜¡±•Ù•°ðôÀñð¡…É…Ñ•È¹ÍÀñÍÁ½ÍÐ¥ì(€€€€€€€…‘‘	…ÑÑ±•1½œ (€€€€€€€€€€€±•Ù•°ðôÀ(€€€€€€€€€€€€ü€¡¡…É…Ñ•È¹¥¬‹–Âkšr«–¶ãžþHˆ­Í­¥±°¹¹…µ”¬‹Žˆ¤(€€€€€€€€€€€€è€¡¡…É…Ñ•È¹¥¬‰MC’â7¢ÚÏ¾ò3ž‡šÎW’öÿžR ˆ­Í­¥±°¹¹…µ”¬‹Žˆ¤(€€€€€€€€¤ì(€€€€€€€™¥¹¥Í¡A±…å•ÉÑ¥½¸ ¤ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô((€€€½¹ÍÐ•™™•Ñ¥Ù•Q…É•ÑQåÁ”õ•Ñ™™•Ñ¥Ù•M­¥±±Q…É•ÑQåÁ”¡Í­¥±°±±•Ù•°¤ì(€€€•¹Ñ•É%¹‘•àõ¹½Éµ…±¥é•	…ÑÑ±•Q…É•ÑQåÁ”¡•™™•Ñ¥Ù•Q…É•ÑQåÁ”¤ôôô‰…±°ˆ(€€€€€€€€ý¹Õ±°(€€€€€€€€é™¥¹‘±¥Ù•Q…É•Ñ%¹‘•à¡•¹Ñ•É%¹‘•à±•™™•Ñ¥Ù•Q…É•ÑQåÁ”¤ì((€€€¥˜¡¹½Éµ…±¥é•	…ÑÑ±•Q…É•ÑQåÁ”¡•™™•Ñ¥Ù•Q…É•ÑQåÁ”¤„ôô‰…±°ˆ˜™•¹Ñ•É%¹‘•àôôõ¹Õ±°¥ì(€€€€€€€™¥¹¥Í¡A±…å•ÉÑ¥½¸ ¤ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô((€€€½¹ÍÐÑ…É•ÑÌõ•ÑM­¥±±Q…É•ÑÌ¡•¹Ñ•É%¹‘•à±•™™•Ñ¥Ù•Q…É•ÑQåÁ”¤ì(€€€¥˜ …Ñ…É•ÑÌ¹±•¹Ñ ¥ì(€€€€€€€™¥¹¥Í¡A±…å•ÉÑ¥½¸ ¤ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô((€€€¡…É…Ñ•È¹ÍÀ´õÍÁ½ÍÐì(€€€±Õ¹•A±…å•É…É¡¡…É…Ñ•É%¹‘•à¤ì(€€€Í¡½ÝM­¥±±9…µ•	…‘” (€€€€€€€Í­¥±°¹¹…µ”±Í­¥±°¹•±•µ•¹Ð±¡…É…Ñ•É%¹‘•à°(€€€€€€€•™™•Ñ¥Ù•Q…É•ÑQåÁ”ôôô‰…±°ˆý¹Õ±°é•¹Ñ•É%¹‘•à±Ñ…É•ÑÌ±Õ¹‘•™¥¹•±•™™•Ñ¥Ù•Q…É•ÑQåÁ”(€€€€¤ì(€€€Í•ÑQ¥µ•½ÕÐ  ¤ôùÍ¡½ÝA±…å•ÉMÁA½ÁÕÀ¡ÍÁ½ÍÐ±¡…É…Ñ•É%¹‘•à¤°ÔÀÀ¤ì((€€€½¹ÍÐÍÑ…Ñ	½¹ÕÌõÍ­¥±°¹…Ñ•½Éäôôô‰µ…¥Œˆ€üÍÑ…ÑÌ¹µ…¥ÑÑ…¬€èÍÑ…ÑÌ¹…ÑÑ…¬ì((€€€¥˜ …Í­¥±°¹‰…Í•…µ…”¥ì(€€€€€€€½¹ÍÐ™É••é•¡…¹”õ•ÑM­¥±±É••é•¡…¹•Ñ1•Ù•°¡Í­¥±°±±•Ù•°¤ì(€€€€€€€½¹ÍÐ™É••é•ÕÉ…Ñ¥½¸õ•ÑM­¥±±É••é•ÕÉ…Ñ¥½¹Ñ1•Ù•°¡Í­¥±°±±•Ù•°¤ì(€€€€€€€Ñ…É•ÑÌ¹™½É… ¡¥¹‘•àôùì(€€€€€€€€€€€½¹ÍÐµ½¹ÍÑ•Èõµ½¹ÍÑ•ÉÍm¥¹‘•átì(€€€€€€€€€€€¥˜ …µ½¹ÍÑ•Éñð…µ½¹ÍÑ•È¹…±¥Ù•ññ™É••é•¡…¹”ðôÀ¥ìÉ•ÑÕÉ¸ìô(€€€€€€€€€€€½¹ÍÐ™É••é•I•ÍÕ±ÐõÉ½±±9…µ•‘A•ÉÍ¥ÍÑ•¹ÑMÑ…ÑÕÍ™™•Ð (€€€€€€€€€€€€€€€µ½¹ÍÑ•È°‰™É••é”ˆ±l(€€€€€€€€€€€€€€€€€€€™É••é•¡…¹”±¡…É…Ñ•È¹±•Ù•°±µ½¹ÍÑ•È¹±•Ù•°°(€€€€€€€€€€€€€€€€€€€ÍÑ…ÑÌ¹¥¹Ñ•±±¥•¹”±•Ñ5½¹ÍÑ•É™™•Ñ¥Ù•MÁ¥É¥ÑA½¥¹ÑÌ¡µ½¹ÍÑ•È¤°(€€€€€€€€€€€€€€€€€€€ÑÉÕ”±•Ñ5½¹ÍÑ•ÉI…¹¬¡µ½¹ÍÑ•È¤(€€€€€€€€€€€€€€€t°‰µ½¹ÍÑ•Èˆ±¥¹‘•à±Í­¥±°¹¹…µ”(€€€€€€€€€€€€¤ì(€€€€€€€€€€€¥˜¡™É••é•I•ÍÕ±Ð¹¡¥Ð¥ì(€€€€€€€€€€€€€€€…ÁÁ±åÉ••é•™™•Ð¡µ½¹ÍÑ•È±™É••é•ÕÉ…Ñ¥½¸¤ì(€€€€€€€€€€€€€€€…‘‘	…ÑÑ±•1½œ¡µ½¹ÍÑ•È¹¹…µ”¬‹¢Š¯–Ã–Â’ê¾òˆ¤ì(€€€€€€€€€€€õ•±Í”¥˜ …™É••é•I•ÍÕ±Ð¹‘ÕÁ±¥…Ñ”¥ì(€€€€€€€€€€€€€€€Í¡½Ý5¥ÍÍ™™•Ð¡™…±Í”±¥¹‘•à°‹š*×š*\ˆ¤ì(€€€€€€€€€€€€€€€…‘‘	…ÑÑ±•1½œ¡Í­¥±°¹¹…µ”¬‹–Â4ˆ­µ½¹ÍÑ•È¹¹…µ”¬‹šÊKšr'žRšV#¾ò#š*×š*_¾ò'Žˆ¤ì(€€€€€€€€€€€ô(€€€€€€€ô¤ì(€€€€€€€ÕÁ‘…Ñ•U$ ¤ì(€€€€€€€™¥¹¥Í¡A±…å•ÉÑ¥½¸ ¤ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô((€€€¥˜¡Í­¥±±%ôôô‰™¥É•I½­•Ðˆ¥ì(€€€€€€€Á±…å¥É•I½­•Ñ¹¥µ…Ñ¥½¸ (€€€€€€€€€€€€‰‰…ÑÑ±•A±…å•É…Éˆ­¡…É…Ñ•É%¹‘•à°(€€€€€€€€€€€Ñ…É•ÑÌ¹µ…À¡¥¹‘•àôø‰‰…ÑÑ±•5½¹ÍÑ•Èˆ­¥¹‘•à¤(€€€€€€€€¤ì(€€€ô((€€€±•ÐÑ½Ñ…±1¥™•ÍÑ•…°ôÀì((€€€Ñ…É•ÑÌ¹™½É… ¡¥¹‘•àôùì(€€€€€€€½¹ÍÐµ½¹ÍÑ•Èõµ½¹ÍÑ•ÉÍm¥¹‘•átì(€€€€€€€¥˜ …µ½¹ÍÑ•Èñð€…µ½¹ÍÑ•È¹…±¥Ù”¥ìÉ•ÑÕÉ¸ìô((€€€€€€€¥˜¡Í­¥±°¹¥ôôô‰¥•MÁ¥¸ˆ¥ì(€€€€€€€€€€€Á±…å%•MÁ¥¹AÉ½©•Ñ¥±”¡¡…É…Ñ•É%¹‘•à±¥¹‘•à¤ì(€€€€€€€ô((€€€€€€€½¹ÍÐ¡¥ÐõÉ½±±!¥Ñ¡…¹” (€€€€€€€€€€€ÍÑ…ÑÌ¹…ÕÉ…ä°(€€€€€€€€€€€•Ñ5½¹ÍÑ•ÉÙ…Í¥½¸¡µ½¹ÍÑ•È¤°(€€€€€€€€€€€•Ñ5½¹ÍÑ•É•‰Õ™™Y…±Õ”¡¡…É…Ñ•È°‰ÍÑÕ¸ˆ¤°(€€€€€€€•ÑÑ¥Ù•ÕÉ…å	½¹ÕÍA•É•¹Ð¡¡…É…Ñ•È¤(€€€€¤ì((€€€€€€€¥˜ …¡¥Ð¥ì(€€€€€€€€€€€Í¡½Ý5¥ÍÍ™™•Ð¡™…±Í”±¥¹‘•à°‰5%MLˆ¤ì(€€€€€€€€€€€…‘‘	…ÑÑ±•1½œ¡Í­¥±°¹¹…µ”¬‹–Â4ˆ­µ½¹ÍÑ•È¹¹…µ”¬‹¾ò3šÊKšr'–F÷’â·¾òˆ¤ì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€ô((€€€€€€€½¹ÍÐÉ¥ÑI•ÍÕ±ÐõÉ½±±É¥Ñ¥…° (€€€€€€€€€€€¡…É…Ñ•È°(€€€€€€€€€€€Í­¥±°¹…Ñ•½Éä°(€€€€€€€€€€€•Ñ5½¹ÍÑ•É™™•Ñ¥Ù•¹Ñ¥É¥Ð¡µ½¹ÍÑ•È¤°(€€€€€€€€€€€µ½¹ÍÑ•È(€€€€€€€€¤ì((€€€€€€€½¹ÍÐ‘…µ…”õ…±Õ±…Ñ•M­¥±±…µ…”¡ì(€€€€€€€€€€€Í­¥±°éÍ­¥±°°(€€€€€€€€€€€Í­¥±±1•Ù•°é±•Ù•°°(€€€€€€€€€€€•™™•Ñ¥Ù•ÑÑ…¬éÍÑ…Ñ	½¹ÕÌ°(€€€€€€€€€€€Ñ…É•Ðéµ½¹ÍÑ•È°(€€€€€€€€€€€…ÍÑ•É1•Ù•°é¡…É…Ñ•È¹±•Ù•°°(€€€€€€€€€€€…ÍÑ•É±•µ•¹Ðé¡…É…Ñ•È¹•±•µ•¹Ð°(€€€€€€€€€€€…ÑÑ…­•Èé¡…É…Ñ•È°(€€€€€€€€€€€É¥Ñ5Õ±Ñ¥Á±¥•ÈéÉ¥ÑI•ÍÕ±Ð¹µÕ±Ñ¥Á±¥•È(€€€€€€€ô¤ì(€€€€€€€½¹ÍÐ¡Á	•™½É•¥É•Ñ…µ…”õµ½¹ÍÑ•È¹¡Àì(€€€€€€€µ½¹ÍÑ•È¹¡Àõ5…Ñ ¹µ…à À±µ½¹ÍÑ•È¹¡Àµ‘…µ…”¤ì((€€€€€€€Í¡½Ý5½¹ÍÑ•É!¥Ð¡¥¹‘•à±‘…µ…”°‰¡Àˆ±É¥ÑI•ÍÕ±Ð¹¥ÍÉ¥Ð¤ì(€€€€€€€½¹ÍÐ…ÑÕ…±…µ…••…±Ðõ5…Ñ ¹µ…à À±¡Á	•™½É•¥É•Ñ…µ…”µµ½¹ÍÑ•È¹¡À¤ì(€€€€€€€…‘‘	…ÑÑ±•1½œ (€€€€€€€€€€€€¡¡…É…Ñ•È¹¥‘ñð‹¦j+–>,ˆ¤¬‹šZ÷šRøˆ­Í­¥±°¹¹…µ”¬‹–F÷’â´ˆ­µ½¹ÍÑ•È¹¹…µ”¬(€€€€€€€€€€€€¡É¥ÑI•ÍÕ±Ð¹¥ÍÉ¥Ð€ü€‹¾ò#ž"šN+¾ò¾ò$ˆ€è€ˆˆ¤¬(€€€€€€€€€€€€‹¾ò3¦ƒš"@ˆ­‘…µ…”¬‹–
ß–ºÏŽˆ(€€€€€€€€¤ì((€€€€€€€½¹ÍÐ‰ÕÉ¹I•ÍÕ±ÐõÍ­¥±°¹‰ÕÉ¹¡…¹”(€€€€€€€€€€€€ýÉ½±±9…µ•‘A•ÉÍ¥ÍÑ•¹ÑMÑ…ÑÕÍ™™•Ð (€€€€€€€€€€€€€€€µ½¹ÍÑ•È°(€€€€€€€€€€€€€€€€‰‰ÕÉ¸ˆ°(€€€€€€€€€€€€€€€l(€€€€€€€€€€€€€€€€€€€Í­¥±°¹‰ÕÉ¹¡…¹”±¡…É…Ñ•È¹±•Ù•°±µ½¹ÍÑ•È¹±•Ù•°°(€€€€€€€€€€€€€€€€€€€ÍÑ…ÑÌ¹¥¹Ñ•±±¥•¹”±•Ñ5½¹ÍÑ•É™™•Ñ¥Ù•MÁ¥É¥ÑA½¥¹ÑÌ¡µ½¹ÍÑ•È¤(€€€€€€€€€€€€€€€t°(€€€€€€€€€€€€€€€€‰µ½¹ÍÑ•Èˆ°(€€€€€€€€€€€€€€€¥¹‘•à°(€€€€€€€€€€€€€€€Í­¥±°¹¹…µ”°(€€€€€€€€€€€€€€€Í­¥±°¹Õ…É…¹Ñ••‘	ÕÉ¸ôôõÑÉÕ”(€€€€€€€€€€€€¤(€€€€€€€€€€€€é¹Õ±°ì(€€€€€€€¥˜¡‰ÕÉ¹I•ÍÕ±Ð˜™‰ÕÉ¹I•ÍÕ±Ð¹¡¥Ð¥ì(€€€€€€€€€€€…ÁÁ±å	ÕÉ¹™™•Ð¡µ½¹ÍÑ•È±Í­¥±°¹‰ÕÉ¹ÕÉ…Ñ¥½¸±Í­¥±°¹‰ÕÉ¹A•É•¹Ñ	å1•Ù•±m±•Ù•°´Åt¤ì(€€€€€€€€€€€…‘‘	…ÑÑ±•1½œ¡µ½¹ÍÑ•È¹¹…µ”¬‹¦fß–—žžKž.š/¾òˆ¤ì(€€€€€€€ô((€€€€€€€½¹ÍÐ™É••é•I•ÍÕ±ÐõÍ­¥±°¹™É••é•¡…¹”(€€€€€€€€€€€€ýÉ½±±9…µ•‘A•ÉÍ¥ÍÑ•¹ÑMÑ…ÑÕÍ™™•Ð (€€€€€€€€€€€€€€€µ½¹ÍÑ•È°(€€€€€€€€€€€€€€€€‰™É••é”ˆ°(€€€€€€€€€€€€€€€l(€€€€€€€€€€€€€€€€€€€Í­¥±°¹™É••é•¡…¹”±¡…É…Ñ•È¹±•Ù•°±µ½¹ÍÑ•È¹±•Ù•°°(€€€€€€€€€€€€€€€€€€€ÍÑ…ÑÌ¹¥¹Ñ•±±¥•¹”±•Ñ5½¹ÍÑ•É™™•Ñ¥Ù•MÁ¥É¥ÑA½¥¹ÑÌ¡µ½¹ÍÑ•È¤°(€€€€€€€€€€€€€€€€€€€ÑÉÕ”±•Ñ5½¹ÍÑ•ÉI…¹¬¡µ½¹ÍÑ•È¤(€€€€€€€€€€€€€€€t°(€€€€€€€€€€€€€€€€‰µ½¹ÍÑ•Èˆ°(€€€€€€€€€€€€€€€¥¹‘•à°(€€€€€€€€€€€€€€€Í­¥±°¹¹…µ”(€€€€€€€€€€€€¤(€€€€€€€€€€€€é¹Õ±°ì(€€€€€€€¥˜¡™É••é•I•ÍÕ±Ð˜™™É••é•I•ÍÕ±Ð¹¡¥Ð¥ì(€€€€€€€€€€€…ÁÁ±åÉ••é•™™•Ð¡µ½¹ÍÑ•È±Í­¥±°¹™É••é•ÕÉ…Ñ¥½¸¤ì(€€€€€€€€€€€…‘‘	…ÑÑ±•1½œ¡µ½¹ÍÑ•È¹¹…µ”¬‹¢Š¯–Ã–Â’ê¾òˆ¤ì(€€€€€€€ô((€€€€€€€…ÁÁ±åM­¥±±•‰Õ™™™™•ÑÌ (€€€€€€€€€€€Í­¥±°±±•Ù•°±µ½¹ÍÑ•È±¥¹‘•à±¡…É…Ñ•È¹±•Ù•°°(€€€€€€€€€€€Í­¥±°¹…Ñ•½Éäôôô‰Á¡åÍ¥…°ˆýÍÑ…ÑÌ¹…ÑÑ…­A½¥¹ÑÌéÍÑ…ÑÌ¹¥¹Ñ•±±¥•¹”(€€€€€€€€¤ì((€€€€€€€¥˜¡Í­¥±°¹±¥™•ÍÑ•…±A•É•¹Ñ	å1•Ù•°¥ìÑ½Ñ…±1¥™•ÍÑ•…°¬õ…ÑÕ…±…µ…••…±Ðìô(€€€€€€€¥˜¡µ½¹ÍÑ•È¹¡ÀðôÀ¥ì­¥±±5½¹ÍÑ•È¡¥¹‘•à¤ìô(€€€ô¤ì((€€€¥˜¡Í­¥±°¹±¥™•ÍÑ•…±A•É•¹Ñ	å1•Ù•°€˜˜Ñ½Ñ…±1¥™•ÍÑ•…°øÀ¥ì(€€€€€€€½¹ÍÐ…µ½Õ¹Ðõ5…Ñ ¹™±½½È (€€€€€€€€€€€Ñ½Ñ…±1¥™•ÍÑ•…°©Í­¥±°¹±¥™•ÍÑ•…±A•É•¹Ñ	å1•Ù•±m±•Ù•°´Åt¼ÄÀÀ(€€€€€€€€¤ì(€€€€€€€¡…É…Ñ•È¹¡Àõ5…Ñ ¹µ¥¸¡ÍÑ…ÑÌ¹µ…á!@±¡…É…Ñ•È¹¡À­…µ½Õ¹Ð¤ì(€€€€€€€¡…É…Ñ•È¹ÍÀõ5…Ñ ¹µ¥¸¡ÍÑ…ÑÌ¹µ…áM@±¡…É…Ñ•È¹ÍÀ­…µ½Õ¹Ð¤ì(€€€€€€€Í¡½ÝA±…å•É!¥Ð¡…µ½Õ¹Ð°‰¡•…°ˆ±¡…É…Ñ•É%¹‘•à±ÑÉÕ”¤ì(€€€€€€€…‘‘	…ÑÑ±•1½œ ¡¡…É…Ñ•È¹¥‘ñð‹¦j+–>,ˆ¤¬‹–BãšRÛ–
ß–ºÏ’â›–n{–ú¥!C¢"MCŽˆ¤ì(€€€ô((€€€¥˜¡Í­¥±°¹Í•±™M¡¥•±‘	å1•Ù•°˜™…¹ÁÁ±å9…µ•‘A•ÉÍ¥ÍÑ•¹ÑMÑ…Ñ” (€€€€€€€¡…É…Ñ•È°‰Í¡¥•±ˆ°‰Á±…å•Èˆ±¡…É…Ñ•É%¹‘•à±Í­¥±°¹¹…µ”(€€€€¤¥ì(€€€€€€€¡…É…Ñ•È¹…Ñ¥Ù•	Õ™™Ìô¡¡…É…Ñ•È¹…Ñ¥Ù•	Õ™™Íññmt¤¹™¥±Ñ•È¡‰Õ™˜ôø(€€€€€€€€€€€€…‰Õ™™ññ‰Õ™˜¹ÑåÁ”„ôô‰Í¡¥•±‰ññ9Õµ‰•È¡‰Õ™˜¹ÑÕÉ¹Í1•™Ð¤øÀ˜™9Õµ‰•È¡‰Õ™˜¹É•µ…¥¹¥¹œ¤øÀ(€€€€€€€€¤ì(€€€€€€€¡…É…Ñ•È¹…Ñ¥Ù•	Õ™™Ì¹ÁÕÍ ¡µ…É­A•ÉÍ¥ÍÑ•¹ÑMÑ…Ñ•9…µ”¡ì(€€€€€€€€€€€ÑåÁ”è‰Í¡¥•±ˆ°(€€€€€€€€€€€ÑÕÉ¹Í1•™ÐéÍ­¥±°¹Í¡¥•±‘ÕÉ…Ñ¥½¹ñðÈ°(€€€€€€€€€€€É•µ…¥¹¥¹œéÍ­¥±°¹Í•±™M¡¥•±‘	å1•Ù•±m±•Ù•°´Åt(€€€€€€€ô°‰Í¡¥•±ˆ¤¤ì(€€€ô((€€€¥˜¡Í­¥±°¹…±±åM¡¥•±‘	å1•Ù•°¥ì(€€€€€€€½¹ÍÐ…µ½Õ¹ÐõÍ­¥±°¹…±±åM¡¥•±‘	å1•Ù•±m±•Ù•°´Åtì(€€€€€€€•ÑÑ¥Ù•A±…å•É¡…É…Ñ•ÉÌ ¤¹™½É…  ¡Ñ…É•Ð±Ñ…É•Ñ%¹‘•à¤ôùì(€€€€€€€€€€€¥˜ ……¹ÁÁ±å9…µ•‘A•ÉÍ¥ÍÑ•¹ÑMÑ…Ñ” (€€€€€€€€€€€€€€€Ñ…É•Ð°‰Í¡¥•±ˆ°‰Á±…å•Èˆ±Ñ…É•Ñ%¹‘•à±Í­¥±°¹¹…µ”(€€€€€€€€€€€€¤¥ìÉ•ÑÕÉ¸ìô(€€€€€€€€€€€Ñ…É•Ð¹…Ñ¥Ù•	Õ™™Ìô¡Ñ…É•Ð¹…Ñ¥Ù•	Õ™™Íññmt¤¹™¥±Ñ•È¡‰Õ™˜ôø(€€€€€€€€€€€€€€€€…‰Õ™™ññ‰Õ™˜¹ÑåÁ”„ôô‰Í¡¥•±‰ññ9Õµ‰•È¡‰Õ™˜¹ÑÕÉ¹Í1•™Ð¤øÀ˜™9Õµ‰•È¡‰Õ™˜¹É•µ…¥¹¥¹œ¤øÀ(€€€€€€€€€€€€¤ì(€€€€€€€€€€€Ñ…É•Ð¹…Ñ¥Ù•	Õ™™Ì¹ÁÕÍ ¡µ…É­A•ÉÍ¥ÍÑ•¹ÑMÑ…Ñ•9…µ”¡ì(€€€€€€€€€€€€€€€ÑåÁ”è‰Í¡¥•±ˆ°(€€€€€€€€€€€€€€€ÑÕÉ¹Í1•™ÐéÍ­¥±°¹Í¡¥•±‘ÕÉ…Ñ¥½¹ñðÈ°(€€€€€€€€€€€€€€€É•µ…¥¹¥¹œé…µ½Õ¹Ð(€€€€€€€€€€€ô°‰Í¡¥•±ˆ¤¤ì(€€€€€€€ô¤ì(€€€ô((€€€ÕÁ‘…Ñ•U$ ¤ì(€€€™¥¹¥Í¡A±…å•ÉÑ¥½¸ ¤ì)ô(((¼¨(€€ƒŠbƒž²³’ê3¢žK¢&Ëžjšf»¦kšRïšN+Ž(€€ƒ¦
?¢ò¿¢Þ}¹½Éµ…±ÑÑ…¬ §’â¢Ó¾ò0(€€ƒ’ö–º3–£šN7’öqÁ±…å•ÈÈ½ÍÑ…ÑÌË¾ò0(€€ƒ’â7šr–.W–"ÁÁ±…å•ËŽ(¨¼((¼¨(€€ƒŠbƒ’þ»š¶¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3¢Žs’â+¢Þ}Á±…å•ÈÄ(€€ƒ–B3’â––_Ž3žn»š¢gš¶ï’ê‡¢«–.W¢ö'ž¯Ž7žj’þw¢¶ß¾ò'¾òh(€€ƒ¦g–/–÷–ò?–Fó–>¯ž®¿¾ò!•á•ÕÑ•Ñ¥½¸¼(€€É•Í½±Ù•EÕ•Õ•‘A±…å•ÉÑ¥½»¾ò'šr³’ú–ÂÇšr–r (€€ƒ–Fó–>¯–º3’æ/–ú3ž‡šŠw’îÛ¢Žs–Fó–>¯’âš²„(€€™¥¹¥Í¡A±…å•ÉÑ¥½¸ §¾ò3š&’î—–:šr³Ž3žn»š¢gš¶ï’ê(€€ƒ–ÂÇžnÓš:•É•ÑÕÉ»Ž7’â›’â7šr¢ºOš"Ã¦²—–6‡’ö?¾ò3–>«šb¿šr(€€ƒ¢ºO¦gš²‡šRïšN+¢º+š"Cš&Ož¦ëšÂŽ’â7šr¢«–.W¢ö'ž¯Ž((€€ƒ¦g¢Ž‡šRçžR¡™¥¹‘±¥Ù•Q…É•Ñ%¹‘•à §¾ò#žÒSš&ûžn»š¢g¾ò0(€€ƒ’â7–Fó–>­™¥¹¥Í¡A±…å•ÉÑ¥½¸ §¾ò'¾ò3š&û–"Ãžn»š¢d(€€ƒ¦
šÒï¢F_–ÂÇšÊÿžR£¾ò3š¶ï’ê–ÂÇ¢«–.WšRçš&L(€€ÕÉÉ•¹Ñ	…ÑÑ±•5½¹ÍÑ•ÉÏ¢Ž‡ž²³’â¦jï¦
šÒï¢F_žjš«ž&§¾ò0(€€ƒ¢Þ}Á±…å•ÈÇžj¢†3ž
ë’â¢ÓŽžržj’â¦jïš«ž&§¦÷’â7–&¤(€€ƒ¾ò#–£šî¾ò'š&5É•ÑÕÉ»¾ò3’ê“žÖ›–Fó–>¯ž®¿šr³’ú–ÂÇšr¢Žs’â+žj(€€™¥¹¥Í¡A±…å•ÉÑ¥½¸ §šRÛ–Âû¾ò3’â7šr–r£¦g¢Ž„(€€ƒ¦7¢’–Fó–>¯ž²³’ê3š²‡Ž(¨¼()™Õ¹Ñ¥½¸Á±…å•ÈÉ9½Éµ…±ÑÑ…¬¡¥¹‘•à¥ì((€€€¥¹‘•àô(€€€€€€€™¥¹‘±¥Ù•Q…É•Ñ%¹‘•à (€€€€€€€€€€€¥¹‘•à(€€€€€€€€¤ì(((€€€¥˜¡¥¹‘•àôôõ¹Õ±°¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€Í•±•Ñ•‘5½¹ÍÑ•Èô(€€€€€€€¥¹‘•àì(((€€€½¹ÍÐµ½¹ÍÑ•Èô(€€€€€€€µ½¹ÍÑ•ÉÍm¥¹‘•átì(((€€€½¹ÍÐÍÑ…ÑÌÈô(€€€€€€€•ÑA±…å•ÈÉ	…ÑÑ±•MÑ…ÑÌ ¤ì(((€€€±Õ¹•A±…å•É…É Ä¤ì(((€€€Í¡½ÝM­¥±±9…µ•	…‘” (€€€€€€€€‹šf»¦kšRïšN(ˆ°(€€€€€€€€‰¹½Éµ…°ˆ°(€€€€€€€€Ä°(€€€€€€€¥¹‘•à°(€€€€€€€m¥¹‘•át(€€€€¤ì(((€€€½¹ÍÐ¡¥Ðô(€€€€€€€É½±±!¥Ñ¡…¹” (€€€€€€€€€€€ÍÑ…ÑÌÈ¹…ÕÉ…ä°(€€€€€€€€€€€•Ñ5½¹ÍÑ•ÉÙ…Í¥½¸ (€€€€€€€€€€€€€€€µ½¹ÍÑ•È(€€€€€€€€€€€€¤°(€€€€€€€€€€€•Ñ5½¹ÍÑ•É•‰Õ™™Y…±Õ” (€€€€€€€€€€€€€€€€€€€Á±…å•ÈÈ°(€€€€€€€€€€€€€€€€€€€€‰ÍÑÕ¸ˆ(€€€€€€€€€€€€€€€€¤°(€€€€€€€€€€€€€€€•ÑÑ¥Ù•ÕÉ…å	½¹ÕÍA•É•¹Ð¡Á±…å•ÈÈ¤(€€€€€€€€€€€€¤ì(((€€€¥˜ …¡¥Ð¥ì((€€€€€€€Í¡½Ý5¥ÍÍ™™•Ð (€€€€€€€€€€€™…±Í”°(€€€€€€€€€€€¥¹‘•à°(€€€€€€€€€€€€‰5%MLˆ(€€€€€€€€¤ì(((€€€€€€€…‘‘	…ÑÑ±•1½œ (€€€€€€€€€€€€ˆˆ¬(€€€€€€€€€€€Á±…å•ÈÈ¹¥¬(€€€€€€€€€€€€‹šf»¦kšRïšN(ˆ¬(€€€€€€€€€€€µ½¹ÍÑ•È¹¹…µ”¬(€€€€€€€€€€€€‹¾ò3šÊKšr'–F÷’â·¾òˆ(€€€€€€€€¤ì(((€€€€€€€€¼¨(€€€€€€€€€€ƒŠbƒ’þ»š¶¾ò#žržjš&û–"Ãšr’âï¢šžj–6‡’ö?–:–nƒ’ê¾ò'¾òh(€€€€€€€€€€ƒ¦g–/–÷–ò?šb¿šÂÓ–Š£žjšf»¦kšRïšN+¾ò3Ž3šÊK–F÷’â·Ž4(€€€€€€€€€€ƒ¢ÞŽ3šRïšN+–º3Ž7¦g–§šŠw¢Þ¿–úG¾ò3–:šr³–º3–£šÊKšr$(€€€€€€€€€€ƒ–Fó–>­ÕÁ‘…Ñ•U$ §Ž™¥¹¥Í¡A±…å•ÉÑ¥½¸ §ŠSŠP(€€€€€€€€€€ƒšf»¦kšRïšN+šb¿’öÿžR£¦‚ïž:šr¦®cžj–.W’ös¾ò0(€€€€€€€€€€ƒ¦g’î¢†£šÂÓ–Š£–æû’æ;š¾?š²‡šf»¦kšRïšN+¦÷šr¢ºL(€€€€€€€€€€ƒš"Ã¦²—–6‡’ö?’â7–.W¾ò3¦gš'¢¦Ë–ÂÇšb¿Ž3š"Ã¦²—–"Ã’â–6((€€€€€€€€€€ƒ–6‡’ö?Ž7šr’âï¢šŽšr–âãžfóžRžj–:–nƒ¾ò0(€€€€€€€€€€ƒ’â7šb¿¢3šf¿–~ß¢†3žj–V?¦†3Ž((€€€€€€€€€€ƒ¢Žs’â+¦g–§¢†3¾ò3šÊK–F÷’â·žjšf–g’æ¢šš¶žŠëžÖCšv|(€€€€€€€€€€ƒ¦g–/¢žK¢&Ëžj¢†3–.WŽ–ú’â/’â’ö7š:£¦ËŽ(€€€€€€€€¨¼((€€€€€€€ÕÁ‘…Ñ•U$ ¤ì((€€€€€€€™¥¹¥Í¡A±…å•ÉÑ¥½¸ ¤ì((€€€€€€€É•ÑÕÉ¸ì((€€€ô(((€€€½¹ÍÐÉ¥ÑI•ÍÕ±Ðô(€€€€€€€É½±±É¥Ñ¥…° (€€€€€€€€€€€Á±…å•ÈÈ°(€€€€€€€€€€€€‰Á¡åÍ¥…°ˆ°(€€€€€€€€€€€•Ñ5½¹ÍÑ•É™™•Ñ¥Ù•¹Ñ¥É¥Ð¡µ½¹ÍÑ•È¤°(€€€€€€€€€€€µ½¹ÍÑ•È(€€€€€€€€¤ì((€€€½¹ÍÐ‘…µ…”ô(€€€€€€€…±Õ±…Ñ•…µ…” (€€€€€€€€€€€ÍÑ…ÑÌÈ¹…ÑÑ…¬°(€€€€€€€€€€€•Ñ5½¹ÍÑ•É™™•Ñ¥Ù••™•¹Í”¡µ½¹ÍÑ•È¤°(€€€€€€€€€€€Á±…å•ÈÈ¹±•Ù•°°(€€€€€€€€€€€µ½¹ÍÑ•È¹±•Ù•°°(€€€€€€€€€€€Á±…å•ÈÈ¹•±•µ•¹Ð°(€€€€€€€€€€€µ½¹ÍÑ•È¹•±•µ•¹Ð°(€€€€€€€€€€€ì(€€€€€€€€€€€€€€€…ÑÑ…­•ÈéÁ±…å•ÈÈ°(€€€€€€€€€€€€€€€Ñ…É•Ðéµ½¹ÍÑ•È°(€€€€€€€€€€€€€€€É¥Ñ5Õ±Ñ¥Á±¥•ÈéÉ¥ÑI•ÍÕ±Ð¹µÕ±Ñ¥Á±¥•È(€€€€€€€€€€€ô(€€€€€€€€¤ì(((€€€µ½¹ÍÑ•È¹¡Àô(€€€€€€€5…Ñ ¹µ…à (€€€€€€€€€€€€À°(€€€€€€€€€€€µ½¹ÍÑ•È¹¡Àµ‘…µ…”(€€€€€€€€¤ì(((€€€Í¡½Ý5½¹ÍÑ•É!¥Ð (€€€€€€€¥¹‘•à°(€€€€€€€‘…µ…”°(€€€€€€€€‰¡Àˆ°(€€€€€€€É¥ÑI•ÍÕ±Ð¹¥ÍÉ¥Ð(€€€€¤ì(((€€€…‘‘	…ÑÑ±•1½œ ((€€€€€€€€ˆˆ¬(€€€€€€€Á±…å•ÈÈ¹¥¬(€€€€€€€€‹šf»¦kšRïšN(ˆ¬(€€€€€€€µ½¹ÍÑ•È¹¹…µ”¬(€€€€€€€€ (€€€€€€€€€€€É¥ÑI•ÍÕ±Ð¹¥ÍÉ¥Ð(€€€€€€€€€€€€ü(€€€€€€€€€€€€‹¾ò#ž"šN+¾ò¾ò$ˆ(€€€€€€€€€€€€è(€€€€€€€€€€€€ˆˆ(€€€€€€€€¤¬(€€€€€€€€‹¾ò3¦ƒš"@ˆ¬(€€€€€€€‘…µ…”¬(€€€€€€€€‹–
ß–ºÏŽˆ((€€€€¤ì(((€€€¥˜¡µ½¹ÍÑ•È¹¡ÀðôÀ¥ì(€€€€€€€­¥±±5½¹ÍÑ•È¡¥¹‘•à¤ì(€€€ô(((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾ò#–B3’â–/–÷–ò?žj–>›’â–6+¾ò3¦g¢Ž‡’æšò?š:'’ê¾ò'¾òh(€€€€€€ƒšRïšN+–F÷’â·Ž¦ƒš"C–
ß–ºÏ’æ/–ú3¾ò3’âš¢–º3–£šÊKšr$(€€€€€€ƒ–Fó–>­ÕÁ‘…Ñ•U$ §Ž™¥¹¥Í¡A±…å•ÉÑ¥½¸ §¾ò0(€€€€€€ƒ¢Žs’â+¾ò3žŠë’þwš&O’â·žjššÎ’â/š"Ã¦²—’æ¢÷š¶žŠè(€€€€€€ƒžæóžê3¦Ë¢†3Ž(€€€€¨¼((€€€ÕÁ‘…Ñ•U$ ¤ì((€€€™¥¹¥Í¡A±…å•ÉÑ¥½¸ ¤ì()ô(((¼¨(€€ƒŠbƒž²³’ê3¢žK¢&Ëžjš*¢÷šZ÷šRûŽ(€€ƒ–ÇžR¡…ÍÑ…µ…•M­¥±° §¢Ž‡–ÞËžÚOš*÷–ë’úžj(€€ƒ¦kžR£–Þ—–ß–÷–ò?¾ò!•ÑM­¥±±Q…É•ÑÏŽ(€€…±Õ±…Ñ•M­¥±±…µ…—ŽÉ½±±É¥Ñ¥…³Ž(€€…ÁÁ±å	ÕÉ¹™™•ÓŽ…ÁÁ±åÉ••é•™™•Óž¶'¾ò'¾ò0(€€ƒ¢«–ÞÇžÖ’â’î÷Ž3šN7’öqÁ±…å•ÈËŽ7žjšZ÷šRûšÖž¢/¾ò0(€€ƒ’â7žnÓš:—–Fó–>­…ÍÑ…µ…•M­¥±° ¤(€€ƒ¾ò#¦
–/–÷–ò?–ú{¦‚·–"Ã–Âû¦÷šb¿šN7’öqÁ±…å•Ë¾ò0(€€ƒž†³¢š–ÇžR£¦Š£¦j«š¾S¢«–ÞÇ–¾¯’â’î÷šnÓ¦®c¾ò'Ž(¨¼()™Õ¹Ñ¥½¸…ÍÑA±…å•ÈÉM­¥±°¡Í­¥±±%±•¹Ñ•É%¹‘•à¥ì((€€€½¹ÍÐÍ­¥±°ô(€€€€€€€Í­¥±±…Ñ…‰…Í•mÍ­¥±±%‘tì(((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾ò#¦bË–F¾ò3¦ÿ–7–B3’â¦†y‰ÕŸžj–Û’î[–"šR¿¾ò'¾òh(€€€€€€ƒ¦g–æû–/š>Cš^¥É•ÑÕÉ»žj–"šR¿¾ò3–:šr³¦÷šb¿žnÓš:”(€€€€€€É•ÑÕÉ»¾ò3–º3–£šÊKšr'–Fó–>­™¥¹¥Í¡A±…å•ÉÑ¥½¸ §ŠSŠP(€€€€€€ƒš¶–âãššÎ’â/¦g–æû–/šŠw’îÛ’â7š'¢¦Ë¢Š¯¢žãžfð(€€€€€€ƒ¾ò!U'š'¢¦Ëšr–#šN/š:'šÊK–¶ãšr½MC’â7¢ÚÏžjš*¢÷¾ò'¾ò0(€€€€€€ƒ’ö¢B³’âžržj–nƒž
ëš~Cž¢»’ú/–’[ššÎ¾ò#’ú/–š¢ÎšZd(€€€€€€ƒšÊK–Â7¦ö+Ž…ÕÑ¼µ‰…ÑÑ±—žj–"“šZßšfš¦–Þ»’ê’â¦î{¾ò$(€€€€€€ƒ¢ª“¢žãžfó¾ò3’âš¢šr¢ºOš"Ã¦²—–6‡’ö?’â7–.W¾ò3¢Þ¦gš²„(€€€€€€ƒš*O–"Ãžj’âï¢š‰ÕŸšb¿–B3’âž¢»¦Š£¦j«Ž((€€€€€€ƒ¦g¢Ž‡–æ¯¦g–æû–/–"šR¿¦÷¢Žs’â+Ž3¢Ï–ÂG¢ºO¢†3–.T(€€€€€€ƒžÖCšvŽš"Ã¦²—žæóžê3¦Ë¢†3Ž7žj’þw¢¶ß¾ò3’â7šr–7šr$(€€€€€€ƒ’îï’öW’âšŠw¢Þ¿–úG¢ºO¦+š"Ë–6‡š¶ïŽ(€€€€¨¼((€€€¥˜ …Í­¥±°¥ì((€€€€€€€™¥¹¥Í¡A±…å•ÉÑ¥½¸ ¤ì((€€€€€€€É•ÑÕÉ¸ì((€€€ô(((€€€½¹ÍÐ±•Ù•°ô(€€€€€€€•ÑM­¥±±1•Ù•° (€€€€€€€€€€€€‰Á±…å•ÈÈˆ°(€€€€€€€€€€€Í­¥±±%(€€€€€€€€¤ì(((€€€¥˜¡±•Ù•°ðôÀ¥ì((€€€€€€€™¥¹¥Í¡A±…å•ÉÑ¥½¸ ¤ì((€€€€€€€É•ÑÕÉ¸ì((€€€ô(((€€€½¹ÍÐÍÁ½ÍÐô(€€€€€€€Í­¥±°¹ÍÁ½ÍÐ„ôõÕ¹‘•™¥¹•(€€€€€€€€ü(€€€€€€€Í­¥±°¹ÍÁ½ÍÐ(€€€€€€€€è(€€€€€€€Í­¥±°¹½ÍÐì((€€€¥˜¡Á±…å•ÈÈ¹ÍÀñÍÁ½ÍÐ¥ì((€€€€€€€™¥¹¥Í¡A±…å•ÉÑ¥½¸ ¤ì((€€€€€€€É•ÑÕÉ¸ì((€€€ô(((€€€½¹ÍÐ•™™•Ñ¥Ù•Q…É•ÑQåÁ”õ•Ñ™™•Ñ¥Ù•M­¥±±Q…É•ÑQåÁ”¡Í­¥±°±±•Ù•°¤ì(€€€•¹Ñ•É%¹‘•àõ¹½Éµ…±¥é•	…ÑÑ±•Q…É•ÑQåÁ”¡•™™•Ñ¥Ù•Q…É•ÑQåÁ”¤ôôô‰…±°ˆ(€€€€€€€€ý¹Õ±°(€€€€€€€€é™¥¹‘±¥Ù•Q…É•Ñ%¹‘•à¡•¹Ñ•É%¹‘•à±•™™•Ñ¥Ù•Q…É•ÑQåÁ”¤ì((€€€¥˜¡¹½Éµ…±¥é•	…ÑÑ±•Q…É•ÑQåÁ”¡•™™•Ñ¥Ù•Q…É•ÑQåÁ”¤„ôô‰…±°ˆ˜™•¹Ñ•É%¹‘•àôôõ¹Õ±°¥ì(€€€€€€€™¥¹¥Í¡A±…å•ÉÑ¥½¸ ¤ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô((€€€½¹ÍÐÑ…É•ÑÌõ•ÑM­¥±±Q…É•ÑÌ¡•¹Ñ•É%¹‘•à±•™™•Ñ¥Ù•Q…É•ÑQåÁ”¤ì(€€€¥˜ …Ñ…É•ÑÌ¹±•¹Ñ ¥ì(€€€€€€€™¥¹¥Í¡A±…å•ÉÑ¥½¸ ¤ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô((€€€Á±…å•ÈÈ¹ÍÀ´õÍÁ½ÍÐì(((€€€±Õ¹•A±…å•É…É Ä¤ì(((€€€Í¡½ÝM­¥±±9…µ•	…‘” (€€€€€€€Í­¥±°¹¹…µ”°(€€€€€€€Í­¥±°¹•±•µ•¹Ð°(€€€€€€€€Ä°(€€€€€€€•™™•Ñ¥Ù•Q…É•ÑQåÁ”ôôô‰…±°ˆý¹Õ±°é•¹Ñ•É%¹‘•à°(€€€€€€€Ñ…É•ÑÌ°(€€€€€€€Õ¹‘•™¥¹•°(€€€€€€€•™™•Ñ¥Ù•Q…É•ÑQåÁ”(€€€€¤ì(((€€€Í•ÑQ¥µ•½ÕÐ  ¤ôùì((€€€€€€€Í¡½ÝA±…å•ÉMÁA½ÁÕÀ (€€€€€€€€€€€ÍÁ½ÍÐ°(€€€€€€€€€€€€Ä(€€€€€€€€¤ì((€€€ô°ÔÀÀ¤ì(((€€€½¹ÍÐÍÑ…ÑÌÈô(€€€€€€€•ÑA±…å•ÈÉ	…ÑÑ±•MÑ…ÑÌ ¤ì(((€€€½¹ÍÐÍÑ…Ñ	½¹ÕÌô(€€€€€€€Í­¥±°¹…Ñ•½Éäôôô‰µ…¥Œˆ(€€€€€€€€ü(€€€€€€€ÍÑ…ÑÌÈ¹µ…¥ÑÑ…¬(€€€€€€€€è(€€€€€€€ÍÑ…ÑÌÈ¹…ÑÑ…¬ì((((€€€€¼¨(€€€€€€ƒžÒSš:Ÿ–‚Óš*¢÷¾ò#’ú/–š–Ã–Â¾ò3šÊKšr%‰…Í•…µ…—¾ò'¾òh(€€€€€€ƒ’â7¢¢#žº_–
ß–ºÌ¿–F÷’â·¾ò3žnÓš:—¢ÞGžVÃ–âãž.š/–F÷’â·–³–ò?Ž(€€€€¨¼((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3Ž3šJËž¦ë–ÂÇ’â7¢†3Ž7¾ò'¾òh(€€€€€€ƒ–:šr³¦g¢Ž‡šb¿Ž1•¹Ñ•É%¹‘•ãš2–"Ãžjš«ž&§¦
šÒï¢F\(€€€€€€ƒš&7¢fWžB¾ò3š¶ï’ê–ÂÇšVÓšº×¢ÞÏ¦;ŽžnÓš:•É•ÑÕÉ»Ž7¾ò0(€€€€€€ƒž¶'šZó¦:[–ºkžjžn»š¢g¢Š¯¦j+–>/–#š&Oš¶ïšf¾ò3¦g–/š:Ÿ–‚Ð(€€€€€€ƒš*¢÷šržnÓš:—š&Ož¦ëšÂ¾ò3ž:§–ºÛšb;šb;¦ã’êšZ÷šRû¾ò0(€€€€€€ƒžV¯¦v‹–6ï’î¦êó’ê/¦÷šÊKžfóžRŽ¦š"Ã¦²—žÒ¦2¦÷’â7šr(€€€€€€ƒ–’k’â¢†3–¶_Ž((€€€€€€ƒšRçš"C¢Þšf»¦kšRïšN(¿–
ß–ºÏš*¢÷’â¢Ó¾ò3–#žR (€€€€€€™¥¹‘±¥Ù•Q…É•Ñ%¹‘•à §žŠë¢ª7žn»š¢g¾ò3š¶ï’ê(€€€€€€ƒ–ÂÇ¢«–.W¢ö'š&MÕÉÉ•¹Ñ	…ÑÑ±•5½¹ÍÑ•ÉÏ¢Ž‡ž²³’â¦jì(€€€€€€ƒ¦
šÒï¢F_žjš«ž&§¾òožržj–£šî’êš&5É•ÑÕÉ¸(€€€€€€ƒ¾ò#¦g¢Ž‡’â7¦r¢š–>›–’[–Fó–>­™¥¹¥Í¡A±…å•ÉÑ¥½¸ §¾ò0(€€€€€€ƒ–Fó–>¯ž®½…ÍÑA±…å•ÈÉM­¥±³žj’â+–Æ(€€€€€€•á•ÕÑ•Ñ¥½¸½É•Í½±Ù•EÕ•Õ•‘A±…å•ÉÑ¥½¸(€€€€€€ƒšr³’ú–ÂÇšrž‡šŠw’îÛ¢Žs–Fó–>¯’âš²‡¾ò3–:–n€(€€€€€€ƒ¢Þ}Á±…å•ÈÉ9½Éµ…±ÑÑ…¬ §¦
š²‡’þ»š¶’âš¢¾ò'Ž(€€€€¨¼((€€€¥˜ …Í­¥±°¹‰…Í•…µ…”¥ì(€€€€€€€½¹ÍÐ™É••é•¡…¹”õ•ÑM­¥±±É••é•¡…¹•Ñ1•Ù•°¡Í­¥±°±±•Ù•°¤ì(€€€€€€€½¹ÍÐ™É••é•ÕÉ…Ñ¥½¸õ•ÑM­¥±±É••é•ÕÉ…Ñ¥½¹Ñ1•Ù•°¡Í­¥±°±±•Ù•°¤ì(€€€€€€€Ñ…É•ÑÌ¹™½É… ¡¥¹‘•àôùì(€€€€€€€€€€€½¹ÍÐµ½¹ÍÑ•Èõµ½¹ÍÑ•ÉÍm¥¹‘•átì(€€€€€€€€€€€¥˜ …µ½¹ÍÑ•Éñð…µ½¹ÍÑ•È¹…±¥Ù•ññ™É••é•¡…¹”ðôÀ¥ìÉ•ÑÕÉ¸ìô(€€€€€€€€€€€½¹ÍÐ™É••é•I•ÍÕ±ÐõÉ½±±9…µ•‘A•ÉÍ¥ÍÑ•¹ÑMÑ…ÑÕÍ™™•Ð (€€€€€€€€€€€€€€€µ½¹ÍÑ•È°‰™É••é”ˆ±l(€€€€€€€€€€€€€€€€€€€™É••é•¡…¹”±Á±…å•ÈÈ¹±•Ù•°±µ½¹ÍÑ•È¹±•Ù•°°(€€€€€€€€€€€€€€€€€€€ÍÑ…ÑÌÈ¹¥¹Ñ•±±¥•¹”±•Ñ5½¹ÍÑ•É™™•Ñ¥Ù•MÁ¥É¥ÑA½¥¹ÑÌ¡µ½¹ÍÑ•È¤°(€€€€€€€€€€€€€€€€€€€ÑÉÕ”±•Ñ5½¹ÍÑ•ÉI…¹¬¡µ½¹ÍÑ•È¤(€€€€€€€€€€€€€€€t°‰µ½¹ÍÑ•Èˆ±¥¹‘•à±Í­¥±°¹¹…µ”(€€€€€€€€€€€€¤ì(€€€€€€€€€€€¥˜¡™É••é•I•ÍÕ±Ð¹¡¥Ð¥ì(€€€€€€€€€€€€€€€…ÁÁ±åÉ••é•™™•Ð¡µ½¹ÍÑ•È±™É••é•ÕÉ…Ñ¥½¸¤ì(€€€€€€€€€€€€€€€…‘‘	…ÑÑ±•1½œ¡µ½¹ÍÑ•È¹¹…µ”¬‹¢Š¯–Ã–Â’ê¾òˆ¤ì(€€€€€€€€€€€õ•±Í”¥˜ …™É••é•I•ÍÕ±Ð¹‘ÕÁ±¥…Ñ”¥ì(€€€€€€€€€€€€€€€Í¡½Ý5¥ÍÍ™™•Ð¡™…±Í”±¥¹‘•à°‹š*×š*\ˆ¤ì(€€€€€€€€€€€€€€€…‘‘	…ÑÑ±•1½œ¡Í­¥±°¹¹…µ”¬‹–Â4ˆ­µ½¹ÍÑ•È¹¹…µ”¬‹šÊKšr'žRšV#¾ò#š*×š*_¾ò'Žˆ¤ì(€€€€€€€€€€€ô(€€€€€€€ô¤ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€€¼¨(€€€€€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3ž¯žº·š*¢ô(€€€€€€ƒ¦Žo¢†3ž&çšV#¾ò1Á±…å•ÈËž&#šr³¾ò3¢Þ}Á±…å•ÈÇžj(€€€€€€…ÍÑ…µ…•M­¥±° §–B3’â’î÷¦
?¢ò¿¾ò3’úšê@(€€€€€€ƒšRçš"A‰…ÑÑ±•A±…å•É…ÉÇ¾ò'¾òh(€€€€¨¼((€€€¥˜¡Í­¥±±%ôôô‰™¥É•I½­•Ðˆ¥ì((€€€€€€€Á±…å¥É•I½­•Ñ¹¥µ…Ñ¥½¸ (€€€€€€€€€€€€‰‰…ÑÑ±•A±…å•É…ÉÄˆ°(€€€€€€€€€€€Ñ…É•ÑÌ¹µ…À (€€€€€€€€€€€€€€€¥¹‘•àôø‰‰…ÑÑ±•5½¹ÍÑ•Èˆ­¥¹‘•à(€€€€€€€€€€€€¤(€€€€€€€€¤ì((€€€ô(((€€€±•ÐÑ½Ñ…±1¥™•ÍÑ•…°ôÀì(((€€€Ñ…É•ÑÌ¹™½É… ¡¥¹‘•àôùì((€€€€€€€½¹ÍÐµ½¹ÍÑ•Èô(€€€€€€€€€€€µ½¹ÍÑ•ÉÍm¥¹‘•átì(((€€€€€€€¥˜ (€€€€€€€€€€€€…µ½¹ÍÑ•Èñð(€€€€€€€€€€€€…µ½¹ÍÑ•È¹…±¥Ù”(€€€€€€€€¥ì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€ô(((€€€€€€€€¼¨(€€€€€€€€€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò'¾òh(€€€€€€€€€€ƒ–Ãš^/’â¦Z–Â#–Æ³žj¦Žo¢†3–.WžV¯¾ò3ž²³’ê3¢žK¢&È(€€€€€€€€€€ƒšZ÷šRûšf¢Öß¦î{šb½‰…ÑÑ±•A±…å•É…ÉÇ¾ò0(€€€€€€€€€€ƒ¦
?¢ò¿¢Þ}…ÍÑ…µ…•M­¥±° §¢Ž‡žjÁ±…å•ÈÄ(€€€€€€€€€€ƒž&#šr³–º3–£’â¢ÓŽ(€€€€€€€€¨¼((€€€€€€€¥˜¡Í­¥±°¹¥ôôô‰¥•MÁ¥¸ˆ¥ì((€€€€€€€€€€€Á±…å%•MÁ¥¹AÉ½©•Ñ¥±” (€€€€€€€€€€€€€€€€Ä°(€€€€€€€€€€€€€€€¥¹‘•à(€€€€€€€€€€€€¤ì((€€€€€€€ô(((€€€€€€€½¹ÍÐ¡¥Ðô(€€€€€€€€€€€É½±±!¥Ñ¡…¹” (€€€€€€€€€€€€€€€ÍÑ…ÑÌÈ¹…ÕÉ…ä°(€€€€€€€€€€€€€€€•Ñ5½¹ÍÑ•ÉÙ…Í¥½¸ (€€€€€€€€€€€€€€€€€€€µ½¹ÍÑ•È(€€€€€€€€€€€€€€€€¤°(€€€€€€€€€€€€€€€•Ñ5½¹ÍÑ•É•‰Õ™™Y…±Õ” (€€€€€€€€€€€€€€€€€€€Á±…å•ÈÈ°(€€€€€€€€€€€€€€€€€€€€‰ÍÑÕ¸ˆ(€€€€€€€€€€€€€€€€¤°(€€€€€€€€€€€€€€€•ÑÑ¥Ù•ÕÉ…å	½¹ÕÍA•É•¹Ð¡Á±…å•ÈÈ¤(€€€€€€€€€€€€¤ì(((€€€€€€€¥˜ …¡¥Ð¥ì((€€€€€€€€€€€Í¡½Ý5¥ÍÍ™™•Ð (€€€€€€€€€€€€€€€™…±Í”°(€€€€€€€€€€€€€€€¥¹‘•à°(€€€€€€€€€€€€€€€€‰5%MLˆ(€€€€€€€€€€€€¤ì(((€€€€€€€€€€€…‘‘	…ÑÑ±•1½œ (€€€€€€€€€€€€€€€Í­¥±°¹¹…µ”¬(€€€€€€€€€€€€€€€€‹–Â4ˆ¬(€€€€€€€€€€€€€€€µ½¹ÍÑ•È¹¹…µ”¬(€€€€€€€€€€€€€€€€‹¾ò3šÊKšr'–F÷’â·¾òˆ(€€€€€€€€€€€€¤ì((€€€€€€€€€€€É•ÑÕÉ¸ì((€€€€€€€ô(((€€€€€€€½¹ÍÐÉ¥ÑI•ÍÕ±Ðô(€€€€€€€€€€€É½±±É¥Ñ¥…° (€€€€€€€€€€€€€€€Á±…å•ÈÈ°(€€€€€€€€€€€€€€€Í­¥±°¹…Ñ•½Éä°(€€€€€€€€€€€€€€€•Ñ5½¹ÍÑ•É™™•Ñ¥Ù•¹Ñ¥É¥Ð¡µ½¹ÍÑ•È¤°(€€€€€€€€€€€€€€€µ½¹ÍÑ•È(€€€€€€€€€€€€¤ì((€€€€€€€½¹ÍÐ‘…µ…”ô(€€€€€€€€€€€…±Õ±…Ñ•M­¥±±…µ…”¡ì(€€€€€€€€€€€€€€€Í­¥±°éÍ­¥±°°(€€€€€€€€€€€€€€€Í­¥±±1•Ù•°é±•Ù•°°(€€€€€€€€€€€€€€€•™™•Ñ¥Ù•ÑÑ…¬éÍÑ…Ñ	½¹ÕÌ°(€€€€€€€€€€€€€€€Ñ…É•Ðéµ½¹ÍÑ•È°(€€€€€€€€€€€€€€€…ÍÑ•É1•Ù•°éÁ±…å•ÈÈ¹±•Ù•°°(€€€€€€€€€€€€€€€…ÍÑ•É±•µ•¹ÐéÁ±…å•ÈÈ¹•±•µ•¹Ð°(€€€€€€€€€€€€€€€…ÑÑ…­•ÈéÁ±…å•ÈÈ°(€€€€€€€€€€€€€€€É¥Ñ5Õ±Ñ¥Á±¥•ÈéÉ¥ÑI•ÍÕ±Ð¹µÕ±Ñ¥Á±¥•È(€€€€€€€€€€€ô¤ì((€€€€€€€½¹ÍÐ¡Á	•™½É•¥É•Ñ…µ…”õµ½¹ÍÑ•È¹¡Àì((€€€€€€€µ½¹ÍÑ•È¹¡Àô(€€€€€€€€€€€5…Ñ ¹µ…à (€€€€€€€€€€€€€€€€À°(€€€€€€€€€€€€€€€µ½¹ÍÑ•È¹¡Àµ‘…µ…”(€€€€€€€€€€€€¤ì(((€€€€€€€Í¡½Ý5½¹ÍÑ•É!¥Ð (€€€€€€€€€€€¥¹‘•à°(€€€€€€€€€€€‘…µ…”°(€€€€€€€€€€€€‰¡Àˆ°(€€€€€€€€€€€É¥ÑI•ÍÕ±Ð¹¥ÍÉ¥Ð(€€€€€€€€¤ì((€€€€€€€½¹ÍÐ…ÑÕ…±…µ…••…±Ðõ5…Ñ ¹µ…à À±¡Á	•™½É•¥É•Ñ…µ…”µµ½¹ÍÑ•È¹¡À¤ì(((€€€€€€€…‘‘	…ÑÑ±•1½œ ((€€€€€€€€€€€Í­¥±°¹¹…µ”¬(€€€€€€€€€€€€‹–F÷’â´ˆ¬(€€€€€€€€€€€µ½¹ÍÑ•È¹¹…µ”¬(€€€€€€€€€€€€ (€€€€€€€€€€€€€€€É¥ÑI•ÍÕ±Ð¹¥ÍÉ¥Ð(€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€€‹¾ò#ž"šN+¾ò¾ò$ˆ(€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€¤¬(€€€€€€€€€€€€‹¾ò3¦ƒš"@ˆ¬(€€€€€€€€€€€‘…µ…”¬(€€€€€€€€€€€€‹–
ß–ºÏŽˆ((€€€€€€€€¤ì(((€€€€€€€¥˜¡Í­¥±°¹‰ÕÉ¹¡…¹”¥ì((€€€€€€€€€€€½¹ÍÐ‰ÕÉ¹I•ÍÕ±Ðô(€€€€€€€€€€€€€€€É½±±9…µ•‘A•ÉÍ¥ÍÑ•¹ÑMÑ…ÑÕÍ™™•Ð (€€€€€€€€€€€€€€€€€€€µ½¹ÍÑ•È°(€€€€€€€€€€€€€€€€€€€€‰‰ÕÉ¸ˆ°(€€€€€€€€€€€€€€€€€€€l(€€€€€€€€€€€€€€€€€€€€€€€Í­¥±°¹‰ÕÉ¹¡…¹”°(€€€€€€€€€€€€€€€€€€€€€€€Á±…å•ÈÈ¹±•Ù•°°(€€€€€€€€€€€€€€€€€€€€€€€µ½¹ÍÑ•È¹±•Ù•°°(€€€€€€€€€€€€€€€€€€€€€€€ÍÑ…ÑÌÈ¹¥¹Ñ•±±¥•¹”°(€€€€€€€€€€€€€€€€€€€€€€€•Ñ5½¹ÍÑ•É™™•Ñ¥Ù•MÁ¥É¥ÑA½¥¹ÑÌ¡µ½¹ÍÑ•È¤(€€€€€€€€€€€€€€€€€€€t°(€€€€€€€€€€€€€€€€€€€€‰µ½¹ÍÑ•Èˆ°(€€€€€€€€€€€€€€€€€€€¥¹‘•à°(€€€€€€€€€€€€€€€€€€€Í­¥±°¹¹…µ”°(€€€€€€€€€€€€€€€€€€€Í­¥±°¹Õ…É…¹Ñ••‘	ÕÉ¸ôôõÑÉÕ”(€€€€€€€€€€€€€€€€¤ì(((€€€€€€€€€€€¥˜¡‰ÕÉ¹I•ÍÕ±Ð¹¡¥Ð¥ì((€€€€€€€€€€€€€€€…ÁÁ±å	ÕÉ¹™™•Ð (€€€€€€€€€€€€€€€€€€€µ½¹ÍÑ•È°(€€€€€€€€€€€€€€€€€€€Í­¥±°¹‰ÕÉ¹ÕÉ…Ñ¥½¸°(€€€€€€€€€€€€€€€€€€€Í­¥±°¹‰ÕÉ¹A•É•¹Ñ	å1•Ù•±l(€€€€€€€€€€€€€€€€€€€€€€€±•Ù•°´Ä(€€€€€€€€€€€€€€€€€€€t(€€€€€€€€€€€€€€€€¤ì(((€€€€€€€€€€€€€€€…‘‘	…ÑÑ±•1½œ (€€€€€€€€€€€€€€€€€€€€ˆˆ¬(€€€€€€€€€€€€€€€€€€€µ½¹ÍÑ•È¹¹…µ”¬(€€€€€€€€€€€€€€€€€€€€‹¦fß–—žžKž.š/¾òˆ(€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€ô((€€€€€€€ô(((€€€€€€€¥˜¡Í­¥±°¹™É••é•¡…¹”¥ì((€€€€€€€€€€€½¹ÍÐ™É••é•I•ÍÕ±Ðô(€€€€€€€€€€€€€€€É½±±9…µ•‘A•ÉÍ¥ÍÑ•¹ÑMÑ…ÑÕÍ™™•Ð (€€€€€€€€€€€€€€€€€€€µ½¹ÍÑ•È°(€€€€€€€€€€€€€€€€€€€€‰™É••é”ˆ°(€€€€€€€€€€€€€€€€€€€l(€€€€€€€€€€€€€€€€€€€€€€€Í­¥±°¹™É••é•¡…¹”°(€€€€€€€€€€€€€€€€€€€€€€€Á±…å•ÈÈ¹±•Ù•°°(€€€€€€€€€€€€€€€€€€€€€€€µ½¹ÍÑ•È¹±•Ù•°°(€€€€€€€€€€€€€€€€€€€€€€€ÍÑ…ÑÌÈ¹¥¹Ñ•±±¥•¹”°(€€€€€€€€€€€€€€€€€€€€€€€•Ñ5½¹ÍÑ•É™™•Ñ¥Ù•MÁ¥É¥ÑA½¥¹ÑÌ¡µ½¹ÍÑ•È¤°(€€€€€€€€€€€€€€€€€€€€€€€ÑÉÕ”°(€€€€€€€€€€€€€€€€€€€€€€€•Ñ5½¹ÍÑ•ÉI…¹¬¡µ½¹ÍÑ•È¤(€€€€€€€€€€€€€€€€€€€t°(€€€€€€€€€€€€€€€€€€€€‰µ½¹ÍÑ•Èˆ°(€€€€€€€€€€€€€€€€€€€¥¹‘•à°(€€€€€€€€€€€€€€€€€€€Í­¥±°¹¹…µ”(€€€€€€€€€€€€€€€€¤ì(((€€€€€€€€€€€¥˜¡™É••é•I•ÍÕ±Ð¹¡¥Ð¥ì((€€€€€€€€€€€€€€€…ÁÁ±åÉ••é•™™•Ð (€€€€€€€€€€€€€€€€€€€µ½¹ÍÑ•È°(€€€€€€€€€€€€€€€€€€€Í­¥±°¹™É••é•ÕÉ…Ñ¥½¸(€€€€€€€€€€€€€€€€¤ì(((€€€€€€€€€€€€€€€…‘‘	…ÑÑ±•1½œ (€€€€€€€€€€€€€€€€€€€€ˆˆ¬(€€€€€€€€€€€€€€€€€€€µ½¹ÍÑ•È¹¹…µ”¬(€€€€€€€€€€€€€€€€€€€€‹¢Š¯–Ã–Â’ê¾òˆ(€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€ô((€€€€€€€ô(((€€€€€€€€¼¨(€€€€€€€€€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3š:—’â+¦Š£žÎì¼(€€€€€€€€€€ƒ–ržÎïš*¢÷žj¦f–*ƒšV#šzs¾ò3¢Þ}Á±…å•ÈÇžj(€€€€€€€€€€…ÍÑ…µ…•M­¥±° §šb¿–B3’â’î÷¦
?¢ò¿¾ò'¾òh(€€€€€€€€¨¼((€€€€€€€…ÁÁ±åM­¥±±•‰Õ™™™™•ÑÌ (€€€€€€€€€€€Í­¥±°°(€€€€€€€€€€€±•Ù•°°(€€€€€€€€€€€µ½¹ÍÑ•È°(€€€€€€€€€€€¥¹‘•à°(€€€€€€€€€€€Á±…å•ÈÈ¹±•Ù•°°(€€€€€€€€€€€Í­¥±°¹…Ñ•½Éäôôô‰Á¡åÍ¥…°ˆýÍÑ…ÑÌÈ¹…ÑÑ…­A½¥¹ÑÌéÍÑ…ÑÌÈ¹¥¹Ñ•±±¥•¹”(€€€€€€€€¤ì(((€€€€€€€¥˜¡Í­¥±°¹±¥™•ÍÑ•…±A•É•¹Ñ	å1•Ù•°¥ì((€€€€€€€€€€€Ñ½Ñ…±1¥™•ÍÑ•…°¬ô(€€€€€€€€€€€€€€€…ÑÕ…±…µ…••…±Ðì((€€€€€€€ô(((€€€€€€€¥˜¡µ½¹ÍÑ•È¹¡ÀðôÀ¥ì(€€€€€€€€€€€­¥±±5½¹ÍÑ•È¡¥¹‘•à¤ì(€€€€€€€ô((€€€ô¤ì(((€€€¥˜ (€€€€€€€Í­¥±°¹±¥™•ÍÑ•…±A•É•¹Ñ	å1•Ù•°€˜˜(€€€€€€€Ñ½Ñ…±1¥™•ÍÑ•…°øÀ(€€€€¥ì((€€€€€€€½¹ÍÐ±¥™•ÍÑ•…±A•É•¹Ðô(€€€€€€€€€€€Í­¥±°¹±¥™•ÍÑ•…±A•É•¹Ñ	å1•Ù•±l(€€€€€€€€€€€€€€€±•Ù•°´Ä(€€€€€€€€€€€tì(((€€€€€€€½¹ÍÐ±¥™•ÍÑ•…±µ½Õ¹Ðô(€€€€€€€€€€€5…Ñ ¹™±½½È (€€€€€€€€€€€€€€€Ñ½Ñ…±1¥™•ÍÑ•…°¨(€€€€€€€€€€€€€€€±¥™•ÍÑ•…±A•É•¹Ð¼(€€€€€€€€€€€€€€€€ÄÀÀ(€€€€€€€€€€€€¤ì(((€€€€€€€Á±…å•ÈÈ¹¡Àô(€€€€€€€€€€€5…Ñ ¹µ¥¸ (€€€€€€€€€€€€€€€ÍÑ…ÑÌÈ¹µ…á!@°(€€€€€€€€€€€€€€€Á±…å•ÈÈ¹¡À¬(€€€€€€€€€€€€€€€±¥™•ÍÑ•…±µ½Õ¹Ð(€€€€€€€€€€€€¤ì(((€€€€€€€Á±…å•ÈÈ¹ÍÀô(€€€€€€€€€€€5…Ñ ¹µ¥¸ (€€€€€€€€€€€€€€€ÍÑ…ÑÌÈ¹µ…áM@°(€€€€€€€€€€€€€€€Á±…å•ÈÈ¹ÍÀ¬(€€€€€€€€€€€€€€€±¥™•ÍÑ•…±µ½Õ¹Ð(€€€€€€€€€€€€¤ì(((€€€€€€€Í¡½ÝA±…å•É!¥Ð (€€€€€€€€€€€±¥™•ÍÑ•…±µ½Õ¹Ð°(€€€€€€€€€€€€‰¡•…°ˆ°(€€€€€€€€€€€€Ä°(€€€€€€€€€€€ÑÉÕ”(€€€€€€€€¤ì(((€€€€€€€…‘‘	…ÑÑ±•1½œ (€€€€€€€€€€€€ˆˆ¬(€€€€€€€€€€€Á±…å•ÈÈ¹¥¬(€€€€€€€€€€€€‹–BãšRÛ–
ß–ºÏ–n{–ú§’êˆ¬(€€€€€€€€€€€±¥™•ÍÑ•…±µ½Õ¹Ð¬(€€€€€€€€€€€€‹¦îy!C¢"MCŽˆ(€€€€€€€€¤ì((€€€ô(((€€€€¼¨(€€€€€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3š:—’â+–ržÎïžj(€€€€€€ƒ¢«¢ê¯¢¶ßžnû¾ò?–£¦®S¢¶ßžnûš*¢÷¾ò1Á±…å•ÈËž&#šr³¾ò0(€€€€€€ƒ¢Þ}Á±…å•ÈÇžj…ÍÑ…µ…•M­¥±° §šb¿–B3’â’îô(€€€€€€ƒ¦
?¢ò¿¾ò'¾òh(€€€€¨¼((€€€¥˜¡Í­¥±°¹Í•±™M¡¥•±‘	å1•Ù•°˜™…¹ÁÁ±å9…µ•‘A•ÉÍ¥ÍÑ•¹ÑMÑ…Ñ” (€€€€€€€Á±…å•ÈÈ°‰Í¡¥•±ˆ°‰Á±…å•Èˆ°Ä±Í­¥±°¹¹…µ”(€€€€¤¥ì((€€€€€€€½¹ÍÐÍ¡¥•±‘µ½Õ¹Ðô(€€€€€€€€€€€Í­¥±°¹Í•±™M¡¥•±‘	å1•Ù•±l(€€€€€€€€€€€€€€€±•Ù•°´Ä(€€€€€€€€€€€tì(((€€€€€€€Á±…å•ÈÈ¹…Ñ¥Ù•	Õ™™Ìô¡Á±…å•ÈÈ¹…Ñ¥Ù•	Õ™™Íññmt¤¹™¥±Ñ•È¡‰Õ™˜ôø(€€€€€€€€€€€€…‰Õ™™ññ‰Õ™˜¹ÑåÁ”„ôô‰Í¡¥•±‰ññ9Õµ‰•È¡‰Õ™˜¹ÑÕÉ¹Í1•™Ð¤øÀ˜™9Õµ‰•È¡‰Õ™˜¹É•µ…¥¹¥¹œ¤øÀ(€€€€€€€€¤ì(((€€€€€€€Á±…å•ÈÈ¹…Ñ¥Ù•	Õ™™Ì¹ÁÕÍ ¡µ…É­A•ÉÍ¥ÍÑ•¹ÑMÑ…Ñ•9…µ”¡ì(€€€€€€€€€€€ÑåÁ”è‰Í¡¥•±ˆ°(€€€€€€€€€€€ÑÕÉ¹Í1•™Ðè(€€€€€€€€€€€€€€€Í­¥±°¹Í¡¥•±‘ÕÉ…Ñ¥½¹ñðÈ°(€€€€€€€€€€€É•µ…¥¹¥¹œè(€€€€€€€€€€€€€€€Í¡¥•±‘µ½Õ¹Ð((€€€€€€€ô°‰Í¡¥•±ˆ¤¤ì(((€€€€€€€…‘‘	…ÑÑ±•1½œ (€€€€€€€€€€€€ˆˆ¬(€€€€€€€€€€€Á±…å•ÈÈ¹¥¬(€€€€€€€€€€€€‹ž6Ë–ú\ˆ¬(€€€€€€€€€€€Í¡¥•±‘µ½Õ¹Ð¬(€€€€€€€€€€€€‹¦î{¢¶ßžnû¾ò3š2žê0ˆ¬(€€€€€€€€€€€€¡Í­¥±°¹Í¡¥•±‘ÕÉ…Ñ¥½¹ñðÈ¤¬(€€€€€€€€€€€€‹–n{–B#Žˆ(€€€€€€€€¤ì((€€€ô(((€€€¥˜¡Í­¥±°¹…±±åM¡¥•±‘	å1•Ù•°¥ì((€€€€€€€½¹ÍÐÍ¡¥•±‘µ½Õ¹Ðô(€€€€€€€€€€€Í­¥±°¹…±±åM¡¥•±‘	å1•Ù•±l(€€€€€€€€€€€€€€€±•Ù•°´Ä(€€€€€€€€€€€tì(((€€€€€€€•Ñ¡…É…Ñ•ÉÌ ¤¹™½É…  (€€€€€€€€€€€€¡¡…É…Ñ•È±Ñ…É•Ñ%¹‘•à¤ôùì((€€€€€€€€€€€€€€€¥˜ (€€€€€€€€€€€€€€€€€€€¡…É…Ñ•È¹¡ÀðôÀ(€€€€€€€€€€€€€€€€¥ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€¥˜ ……¹ÁÁ±å9…µ•‘A•ÉÍ¥ÍÑ•¹ÑMÑ…Ñ” (€€€€€€€€€€€€€€€€€€€¡…É…Ñ•È°‰Í¡¥•±ˆ°‰Á±…å•Èˆ±Ñ…É•Ñ%¹‘•à±Í­¥±°¹¹…µ”(€€€€€€€€€€€€€€€€¤¥ìÉ•ÑÕÉ¸ìô((€€€€€€€€€€€€€€€¡…É…Ñ•È¹…Ñ¥Ù•	Õ™™Ìô¡¡…É…Ñ•È¹…Ñ¥Ù•	Õ™™Íññmt¤¹™¥±Ñ•È¡‰Õ™˜ôø(€€€€€€€€€€€€€€€€€€€€…‰Õ™™ññ‰Õ™˜¹ÑåÁ”„ôô‰Í¡¥•±‰ññ9Õµ‰•È¡‰Õ™˜¹ÑÕÉ¹Í1•™Ð¤øÀ˜™9Õµ‰•È¡‰Õ™˜¹É•µ…¥¹¥¹œ¤øÀ(€€€€€€€€€€€€€€€€¤ì(((€€€€€€€€€€€€€€€¡…É…Ñ•È¹…Ñ¥Ù•	Õ™™Ì¹ÁÕÍ ¡µ…É­A•ÉÍ¥ÍÑ•¹ÑMÑ…Ñ•9…µ”¡ì(€€€€€€€€€€€€€€€€€€€ÑåÁ”è‰Í¡¥•±ˆ°(€€€€€€€€€€€€€€€€€€€ÑÕÉ¹Í1•™Ðè(€€€€€€€€€€€€€€€€€€€€€€€Í­¥±°¹Í¡¥•±‘ÕÉ…Ñ¥½¹ñðÈ°(€€€€€€€€€€€€€€€€€€€É•µ…¥¹¥¹œè(€€€€€€€€€€€€€€€€€€€€€€€Í¡¥•±‘µ½Õ¹Ð((€€€€€€€€€€€€€€€ô°‰Í¡¥•±ˆ¤¤ì((€€€€€€€€€€€ô(€€€€€€€€¤ì(((€€€€€€€…‘‘	…ÑÑ±•1½œ (€€€€€€€€€€€€‹š"GšZç–£¦®Sž6Ë–ú\ˆ¬(€€€€€€€€€€€Í¡¥•±‘µ½Õ¹Ð¬(€€€€€€€€€€€€‹¦î{¢¶ßžnû¾ò3š2žê0ˆ¬(€€€€€€€€€€€€¡Í­¥±°¹Í¡¥•±‘ÕÉ…Ñ¥½¹ñðÈ¤¬(€€€€€€€€€€€€‹–n{–B#Žˆ(€€€€€€€€¤ì((€€€ô(((€€€ÕÁ‘…Ñ•U$ ¤ì((€€€™¥¹¥Í¡A±…å•ÉÑ¥½¸ ¤ì()ô(((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€XäÈƒŠPƒš«ž&§¦G–æš:'¢Bô(€€ƒ–~ëž’;–ó¢Þš«ž&§ž¶'žÒkš"C¦Vß¾òožÊû¢.Ä½	=MOš>C¦®c–7ž:¾ò3’â›’þwžVg–ÂG¦?¦j£š¦šÖ»–.WŽ(ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼()™Õ¹Ñ¥½¸•Ñ5½¹ÍÑ•É½±‘É½À¡µ½¹ÍÑ•È¥ì(€€€¥˜ …µ½¹ÍÑ•È¥ì(€€€€€€€É•ÑÕÉ¸€Àì(€€€ô((€€€½¹ÍÐ±•Ù•°õ5…Ñ ¹µ…à Ä±5…Ñ ¹™±½½È¡9Õµ‰•È¡µ½¹ÍÑ•È¹±•Ù•°¥ñðÄ¤¤ì(€€€½¹ÍÐÉ…¹¬õ•Ñ5½¹ÍÑ•ÉI…¹¬¡µ½¹ÍÑ•È¤ì(€€€½¹ÍÐÉ…¹­5Õ±Ñ¥Á±¥•Èô(€€€€€€€É…¹¬ôôô‰‰½ÍÌˆ(€€€€€€€€ü€à(€€€€€€€€èÉ…¹¬ôôô‰•±¥Ñ”ˆ(€€€€€€€€ü€Ì(€€€€€€€€è€Äì((€€€½¹ÍÐ‰…Í”õ±•Ù•°¨È¬Ìì(€€€½¹ÍÐÙ…É¥…¹”ôÀ¸àÔ­5…Ñ ¹É…¹‘½´ ¤¨À¸ÌÀì((€€€É•ÑÕÉ¸5…Ñ ¹µ…à (€€€€€€€€Ä°(€€€€€€€5…Ñ ¹™±½½È¡‰…Í”©É…¹­5Õ±Ñ¥Á±¥•È©Ù…É¥…¹”¤(€€€€¤ì)ô()™Õ¹Ñ¥½¸…Ý…É‘5½¹ÍÑ•É½±‘É½À¡µ½¹ÍÑ•È¥ì(€€€½¹ÍÐ…µ½Õ¹Ðõ•Ñ5½¹ÍÑ•É½±‘É½À¡µ½¹ÍÑ•È¤ì((€€€¥˜¡…µ½Õ¹ÐðôÀ¥ì(€€€€€€€É•ÑÕÉ¸€Àì(€€€ô((€€€½±¬õ…µ½Õ¹Ðì(€€€ÕÁ‘…Ñ•½±‘¥ÍÁ±…ä ¤ì((€€€…‘‘	…ÑÑ±•1½œ (€€€€€€€µ½¹ÍÑ•È¹¹…µ”¬(€€€€€€€€‹š:'¢Bô€ˆ¬(€€€€€€€…µ½Õ¹Ð¬(€€€€€€€€ˆƒ¦G–æŽˆ(€€€€¤ì((€€€É•ÑÕÉ¸…µ½Õ¹Ðì)ô(((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€ƒš«ž&§š¶ï’ê„(ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼()™Õ¹Ñ¥½¸­¥±±5½¹ÍÑ•È¡¥¹‘•à¥ì((€€€½¹ÍÐµ½¹ÍÑ•È€ô(€€€€€€€µ½¹ÍÑ•ÉÍm¥¹‘•átì(((€€€¥˜ (€€€€€€€€…µ½¹ÍÑ•Èñð(€€€€€€€€…µ½¹ÍÑ•È¹…±¥Ù”(€€€€¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€µ½¹ÍÑ•È¹…±¥Ù”õ™…±Í”ì((€€€µ½¹ÍÑ•È¹¡ÀôÀì((€€€µ½¹ÍÑ•È¹ÍÀôÀì(((€€€½¹ÍÐ…É€ô(€€€€€€€€ ‰‰…ÑÑ±•5½¹ÍÑ•Èˆ­¥¹‘•à¤ì(((€€€¥˜¡…É¥ì((€€€€€€€€¼¨(€€€€€€€€€€ƒŠbƒ’þ»š¶¾òh(€€€€€€€€€€ƒ–:šr³’âšN+šºëš¶ïš«ž&§žjžVÛ’â/¾ò0(€€€€€€€€€€ƒž®/–"ïš*(¹‘•…“¦g–-±…ÍÏ¾ò!½Á…¥Ñäè¸ÄÛ¾ò$(€€€€€€€€€€ƒ–*ƒ’â+–:ï¾ò3’ö–
ß–ºÏšÖ»–.WšVã–¶_šb¿¦g–ò×–6‡ž&(€€€€€€€€€€ƒžjŽ3–¶C–žÒƒŽ7¾ò1½Á…¥ÑçšržnÓš:—¦–âØ(€€€€€€€€€€ƒš*+¦
–r£¦Žžj–
ß–ºÏšVã–¶_’â¢Öß¢º+šj_¾ò0(€€€€€€€€€€ƒ–&o––÷š&Oš¶ïžj¦
’â’â/–>7¢3šr’â7–ºçšbOžr/šâš–k–
ß–ºÏŽ((€€€€€€€€€€ƒšRçš"C–#–*€¹‘å¥¹Ÿ¾ò#–>«šN/¦î{šN+¾ò3’â7¢º+šj_¾ò'¾ò0(€€€€€€€€€€ƒž¶'–
ß–ºÏšVã–¶_–.WžV¯¾ò Ä¸ãžžK¾ò'¢ÞG–º3’æ/–ú0(€€€€€€€€€€ƒš&7žrš¶–*ƒ’â(¹‘•…“¢ºO–6‡ž&¢º+šj_¾ò0(€€€€€€€€€€ƒ–§¢¦‚–ê?–Â7¢ªÿ–ÂÇ’â7šr’êKžnã–öÇ¦~ÿ’êŽ(€€€€€€€€¨¼((€€€€€€€…É¹±…ÍÍ1¥ÍÐ¹…‘ (€€€€€€€€€€€€‰‘å¥¹œˆ(€€€€€€€€¤ì(((€€€€€€€Í•ÑQ¥µ•½ÕÐ  ¤ôùì((€€€€€€€€€€€…É¹±…ÍÍ1¥ÍÐ¹É•µ½Ù” (€€€€€€€€€€€€€€€€‰‘å¥¹œˆ(€€€€€€€€€€€€¤ì((€€€€€€€€€€€…É¹±…ÍÍ1¥ÍÐ¹…‘ (€€€€€€€€€€€€€€€€‰‘•…ˆ(€€€€€€€€€€€€¤ì((€€€€€€€ô°ÄàÔÀ¤ì((€€€ô(((€€€€¼¨(€€€€€€ƒŠbƒš«ž&§š¶ï’ê‡–ú3’æ¢š–r£–rÃ–r[’â+¦jÇ¢^?¾ò0(€€€€€€ƒ¦ÿ–7–n{–"Ã–rÃ–r[šfžr/–"Ã–ÞËš¶ïš«ž&§žj–r[ž’ëŽ(€€€€¨¼((€€€½¹ÍÐµ…Á%½¸€ô(€€€€€€€€ ‰µ…Á5½¹ÍÑ•Èˆ­¥¹‘•à¤ì(((€€€¥˜¡µ…Á%½¸¥ì((€€€€€€€µ…Á%½¸¹ÍÑå±”¹‘¥ÍÁ±…ä€ô(€€€€€€€€€€€€‰¹½¹”ˆì((€€€ô(((€€€…‘‘	…ÑÑ±•1½œ ((€€€€€€€€ˆˆ¬(€€€€€€€µ½¹ÍÑ•È¹¹…µ”¬(€€€€€€€€‹¢Š¯šN+šV_Žˆ((€€€€¤ì(((€€€€¼¨(€€€€€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3’âï–~;–r[¦FD¼(€€€€€€ƒš¾?š^—’îï–.d¿š"C–ÂÇžÎïžÖÇ¾ò'¾òh(€€€€€€ƒ¦g¢Ž‡šb¿Ž3š«ž&§žržj¢Š¯š&Oš¶ïŽ7–R¿’âšržÚO¦8(€€€€€€ƒžj–rÃšZç¾ò3–r[¦FGžjšN+šºëšVãŽš¾?š^—’îï–.gžj(€€€€€€ƒšN+šV_š«ž&§¦Ë–ê›Žš"C–ÂÇžjžÒ¿¢¢#šN+šºëšVã¾ò0(€€€€€€ƒ–£¦£–r£¦g¢Ž‡’âš²‡¢¢c¦2¾ò3’â7žR£–r£š"Ã¦²—žj(€€€€€€ƒš¾?–/–"šR¿–B¢«¦7¢’–"“šZß’âš²‡Ž(€€€€¨¼((€€€½¹ÍÐ‰½ÍÍ=Ý¹•ÈõÑåÁ•½˜Ý¥¹‘½Ü„ôô‰Õ¹‘•™¥¹•ˆýÝ¥¹‘½Ü¹½ÕÉMåµ‰½±Í	½ÍÍ	…ÑÑ±”é¹Õ±°ì(€€€¥˜¡‰½ÍÍ=Ý¹•È˜™ÑåÁ•½˜‰½ÍÍ=Ý¹•È¹½¹¹•µå•…Ñ ôôô‰™Õ¹Ñ¥½¸ˆ¥ì(€€€€€€€‰½ÍÍ=Ý¹•È¹½¹¹•µå•…Ñ ¡¥¹‘•à±µ½¹ÍÑ•È¤ì(€€€ô((€€€¥˜ …µ½¹ÍÑ•È¹¹½I•Ý…É‘Ì¥ì(€€€€€€€É•½É‘5½¹ÍÑ•É-¥±±½É	•ÍÑ¥…Éä¡µ½¹ÍÑ•È¤ì(€€€€€€€…Ý…É‘5½¹ÍÑ•É½±‘É½À¡µ½¹ÍÑ•È¤ì(€€€€€€€€¼¨ƒš«ž&§š:'¢B÷¢"šN+šºë¦Ë–ê›’â¢Öß–6Ïšf–¶cšªS¾ò3¦ÿ–7’â·¦Sš"ÃšV\¿–"¢3šf¿¦ë–’ÇŽ€¨¼(€€€€€€€Í…Ù•…µ” ¤ì(€€€ô(((€€€ÕÁ‘…Ñ•5½¹ÍÑ•ÉU$¡¥¹‘•à¤ì()ô(((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€ƒš"Ã¦²—žV¯¦vˆ(ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼()½¹ÍÐ	QQ1}I9I}!==-}=IHõ=‰©•Ð¹™É••é”¡ì(€€€‰•™½É”é=‰©•Ð¹™É••é”¡l(€€€€€€€€‰ØÄÔáAÉ•Á…É•	…ÑÑ±•I•¹‘•Èˆ°(€€€€€€€€‰ØÄÐÅAÉ•Á…É•	…ÑÑ±•I•¹‘•Èˆ(€€€t¤°(€€€…™Ñ•Èé=‰©•Ð¹™É••é”¡l(€€€€€€€€‰ØÄÌÅ™Ñ•É	…ÑÑ±•I•¹‘•Èˆ°(€€€€€€€€‰ØÄÐÅ™Ñ•É	…ÑÑ±•I•¹‘•Èˆ°(€€€€€€€€‰ØÄÐÍ™Ñ•É	…ÑÑ±•I•¹‘•Èˆ°(€€€€€€€€‰ØÄÔÑ™Ñ•É	…ÑÑ±•I•¹‘•Èˆ°(€€€€€€€€‰ØÄÜÌÔÅ™Ñ•É	…ÑÑ±•I•¹‘•Èˆ°(€€€€€€€€‰Ù¥á•‘M±½Ñ™Ñ•É	…ÑÑ±•I•¹‘•Èˆ(€€€t¤)ô¤ì()™Õ¹Ñ¥½¸ÉÕ¹	…ÑÑ±•I•¹‘•É!½½­Ì¡Á¡…Í”±½¹Ñ•áÐ±…ÉÌ¥ì(€€€½¹ÍÐÉ½½ÐõÑåÁ•½˜Ý¥¹‘½Ü„ôô‰Õ¹‘•™¥¹•ˆ(€€€€€€€€üÝ¥¹‘½Ü(€€€€€€€€è€¡ÑåÁ•½˜±½‰…±Q¡¥Ì„ôô‰Õ¹‘•™¥¹•ˆ€ü±½‰…±Q¡¥Ì€è¹Õ±°¤ì(€€€½¹ÍÐ¡½½­9…µ•Ìõ	QQ1}I9I}!==-}=IImÁ¡…Í•uññmtì(€€€¡½½­9…µ•Ì¹™½É… ¡¹…µ”ôùì(€€€€€€€½¹ÍÐ¡½½¬õÉ½½Ð˜™É½½Ñm¹…µ•tì(€€€€€€€¥˜¡ÑåÁ•½˜¡½½¬ôôô‰™Õ¹Ñ¥½¸ˆ¥ì(€€€€€€€€€€€¡½½¬¹…ÁÁ±ä¡½¹Ñ•áÐ±…ÉÌ¤ì(€€€€€€€ô(€€€ô¤ì)ô()¥˜¡ÑåÁ•½˜Ý¥¹‘½Ü„ôô‰Õ¹‘•™¥¹•ˆ¥ì(€€€Ý¥¹‘½Ü¹½ÕÉMåµ‰½±Í	…ÑÑ±•I•¹‘•É!½½­=É‘•Èõ	QQ1}I9I}!==-}=IHì)ô()™Õ¹Ñ¥½¸¥Í	…ÑÑ±•MÑ…ÑÕÍ%¹ÍÁ•Ñ¥½¹	±½­• ¥ì(€€€¥˜ …‰…ÑÑ±•Ñ¥Ù”¥ìÉ•ÑÕÉ¸ÑÉÕ”ìô(€€€½¹ÍÐ…Ñ¥½¹I•¥½¸ô ‰‰…ÑÑ±•Ñ¥½¹I•¥½¸ˆ¤ì(€€€¥˜¡…Ñ¥½¹I•¥½¸˜™…Ñ¥½¹I•¥½¸¹±…ÍÍ1¥ÍÐ¹½¹Ñ…¥¹Ì ‰Ñ…É•ÐµÍ•±•Ñ¥¹œˆ¤¥ì(€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€ô(€€€É•ÑÕÉ¸€„…‘½Õµ•¹Ð¹ÅÕ•ÉåM•±•Ñ½È (€€€€€€€€ˆ‰…ÑÑ±•A…”€¹‰…ÑÑ±”µµ½¹ÍÑ•È¹Ñ…É•Ñ…‰±”°‰…ÑÑ±•A…”€¹‰…ÑÑ±”µÁ±…å•È¹…±±äµÑ…É•Ñ…‰±”ˆ(€€€€¤ì)ô()™Õ¹Ñ¥½¸‰…ÑÑ±•MÑ…ÑÕÍ±•µ•¹Ñ1…‰•°¡•¹Ñ¥Ñä¥ì(€€€½¹ÍÐ­•äõMÑÉ¥¹œ¡•¹Ñ¥Ñä˜™•¹Ñ¥Ñä¹•±•µ•¹Ññðˆˆ¤ì(€€€¥˜¡ÑåÁ•½˜•±•µ•¹Ñ…Ñ…‰…Í”„ôô‰Õ¹‘•™¥¹•ˆ˜™•±•µ•¹Ñ…Ñ…‰…Í”˜™•±•µ•¹Ñ…Ñ…‰…Í•m­•åt¥ì(€€€€€€€É•ÑÕÉ¸•±•µ•¹Ñ…Ñ…‰…Í•m­•åt¹¹…µ•ññ•±•µ•¹Ñ…Ñ…‰…Í•m­•åt¹±…‰•±ñð(€€€€€€€€€€€€¡í™¥É”è‹ž¬ˆ±Ý…Ñ•Èè‹šÂÐˆ±Ý¥¹è‹¦Š ˆ±•…ÉÑ è‹–r|ˆ±±¥¡Ðè‹––$‰õm­•åuññ­•åñð‹ž„ˆ¤ì(€€€ô(€€€É•ÑÕÉ¸€¡í™¥É”è‹ž¬ˆ±Ý…Ñ•Èè‹šÂÐˆ±Ý¥¹è‹¦Š ˆ±•…ÉÑ è‹–r|ˆ±±¥¡Ðè‹––$‰õm­•åuññ­•åñð‹ž„ˆ¤ì)ô()™Õ¹Ñ¥½¸•¹ÍÕÉ•	…ÑÑ±•MÑ…ÑÕÍ•Ñ…¥±5½‘…° ¥ì(€€€±•Ðµ½‘…°õ‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ‰‰…ÑÑ±•MÑ…ÑÕÍ•Ñ…¥±5½‘…°ˆ¤ì(€€€¥˜¡µ½‘…°¥ìÉ•ÑÕÉ¸µ½‘…°ìô(€€€µ½‘…°õ‘½Õµ•¹Ð¹É•…Ñ•±•µ•¹Ð ‰‘¥Øˆ¤ì(€€€µ½‘…°¹¥ô‰‰…ÑÑ±•MÑ…ÑÕÍ•Ñ…¥±5½‘…°ˆì(€€€µ½‘…°¹±…ÍÍ9…µ”ô‰‰…ÑÑ±”µÍÑ…ÑÕÌµ‘•Ñ…¥°µµ½‘…°ˆì(€€€µ½‘…°¹¡¥‘‘•¸õÑÉÕ”ì(€€€µ½‘…°¹Í•ÑÑÑÉ¥‰ÕÑ” ‰…É¥„µ¡¥‘‘•¸ˆ°‰ÑÉÕ”ˆ¤ì(€€€µ½‘…°¹¥¹¹•É!Q50ô(€€€€€€€€œñ‘¥Ø±…ÍÌô‰‰…ÑÑ±”µÍÑ…ÑÕÌµ‘•Ñ…¥°µÁ…¹•°ˆÉ½±”ô‰‘¥…±½œˆ…É¥„µµ½‘…°ô‰ÑÉÕ”ˆ…É¥„µ±…‰•±±•‘‰äô‰‰…ÑÑ±•MÑ…ÑÕÍ•Ñ…¥±Q¥Ñ±”ˆøœ¬(€€€€€€€€€€€€œñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÌô‰‰…ÑÑ±”µÍÑ…ÑÕÌµ‘•Ñ…¥°µ±½Í”ˆ…É¥„µ±…‰•°ô‹¦^s¦Z$ˆû\ð½‰ÕÑÑ½¸øœ¬(€€€€€€€€€€€€œñ Ì¥ô‰‰…ÑÑ±•MÑ…ÑÕÍ•Ñ…¥±Q¥Ñ±”ˆûš"Ã¦²—ž.š,ð½ Ìøœ¬(€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰‰…ÑÑ±”µÍÑ…ÑÕÌµ‘•Ñ…¥°µ½É”ˆøœ¬(€€€€€€€€€€€€€€€€œñÍÁ…¸‘…Ñ„µ™¥•±ô‰•±•µ•¹Ðˆøð½ÍÁ…¸øœ¬(€€€€€€€€€€€€€€€€œñÍÁ…¸‘…Ñ„µ™¥•±ô‰¹…µ”ˆøð½ÍÁ…¸øœ¬(€€€€€€€€€€€€€€€€œñÍÁ…¸‘…Ñ„µ™¥•±ô‰¡Àˆøð½ÍÁ…¸øœ¬(€€€€€€€€€€€€€€€€œñÍÁ…¸‘…Ñ„µ™¥•±ô‰ÍÀˆøð½ÍÁ…¸øœ¬(€€€€€€€€€€€€œð½‘¥Øøœ¬(€€€€€€€€€€€€œñÍ•Ñ¥½¸øñ Ðû–Š{žn+ž.š/¾òhð½ Ðøñ‘¥Ø‘…Ñ„µ±¥ÍÐô‰‰Õ™™Ìˆ±…ÍÌô‰‰…ÑÑ±”µÍÑ…ÑÕÌµ‘•Ñ…¥°µ±¥ÍÐˆøð½‘¥Øøð½Í•Ñ¥½¸øœ¬(€€€€€€€€€€€€œñÍ•Ñ¥½¸øñ Ðû¢Êƒ¦v‹ž.š/¾òhð½ Ðøñ‘¥Ø‘…Ñ„µ±¥ÍÐô‰‘•‰Õ™™Ìˆ±…ÍÌô‰‰…ÑÑ±”µÍÑ…ÑÕÌµ‘•Ñ…¥°µ±¥ÍÐˆøð½‘¥Øøð½Í•Ñ¥½¸øœ¬(€€€€€€€€œð½‘¥Øøœì(€€€½¹ÍÐ¡½ÍÐô ‰‰…ÑÑ±•A…”ˆ¥ññ‘½Õµ•¹Ð¹‰½‘äì(€€€¡½ÍÐ¹…ÁÁ•¹‘¡¥±¡µ½‘…°¤ì(€€€½¹ÍÐ±½Í”õµ½‘…°¹ÅÕ•ÉåM•±•Ñ½È ˆ¹‰…ÑÑ±”µÍÑ…ÑÕÌµ‘•Ñ…¥°µ±½Í”ˆ¤ì(€€€¥˜¡±½Í”¥ì±½Í”¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ±±½Í•	…ÑÑ±•MÑ…ÑÕÍ•Ñ…¥±5½‘…°¤ìô(€€€µ½‘…°¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ±•Ù•¹Ðôùì(€€€€€€€¥˜¡•Ù•¹Ð¹Ñ…É•Ðôôõµ½‘…°¥ì±½Í•	…ÑÑ±•MÑ…ÑÕÍ•Ñ…¥±5½‘…° ¤ìô(€€€ô¤ì(€€€É•ÑÕÉ¸µ½‘…°ì)ô()™Õ¹Ñ¥½¸±½Í•	…ÑÑ±•MÑ…ÑÕÍ•Ñ…¥±5½‘…° ¥ì(€€€½¹ÍÐµ½‘…°õ‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ‰‰…ÑÑ±•MÑ…ÑÕÍ•Ñ…¥±5½‘…°ˆ¤ì(€€€¥˜ …µ½‘…°¥ìÉ•ÑÕÉ¸ìô(€€€µ½‘…°¹¡¥‘‘•¸õÑÉÕ”ì(€€€µ½‘…°¹Í•ÑÑÑÉ¥‰ÕÑ” ‰…É¥„µ¡¥‘‘•¸ˆ°‰ÑÉÕ”ˆ¤ì(€€€Íå¹	…ÑÑ±•U¥AÉ¥½É¥Ñå1…å•È ¤ì)ô()™Õ¹Ñ¥½¸É•¹‘•É	…ÑÑ±•MÑ…ÑÕÍ•Ñ…¥±1¥ÍÐ¡¡½ÍÐ±¥Ñ•µÌ¥ì(€€€¥˜ …¡½ÍÐ¥ìÉ•ÑÕÉ¸ìô(€€€¡½ÍÐ¹¥¹¹•É!Q50ôˆˆì(€€€¥˜ …ÉÉ…ä¹¥ÍÉÉ…ä¡¥Ñ•µÌ¥ññ¥Ñ•µÌ¹±•¹Ñ ôôôÀ¥ì(€€€€€€€½¹ÍÐ•µÁÑäõ‘½Õµ•¹Ð¹É•…Ñ•±•µ•¹Ð ‰‘¥Øˆ¤ì(€€€€€€€•µÁÑä¹±…ÍÍ9…µ”ô‰‰…ÑÑ±”µÍÑ…ÑÕÌµ‘•Ñ…¥°µ•µÁÑäˆì(€€€€€€€•µÁÑä¹Ñ•áÑ½¹Ñ•¹Ðô‹ž„ˆì(€€€€€€€¡½ÍÐ¹…ÁÁ•¹‘¡¥±¡•µÁÑä¤ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(€€€¥Ñ•µÌ¹™½É… ¡¥Ñ•´ôùì(€€€€€€€½¹ÍÐÉ½Üõ‘½Õµ•¹Ð¹É•…Ñ•±•µ•¹Ð ‰‘¥Øˆ¤ì(€€€€€€€É½Ü¹±…ÍÍ9…µ”ô‰‰…ÑÑ±”µÍÑ…ÑÕÌµ‘•Ñ…¥°µÉ½Üˆì(€€€€€€€½¹ÍÐ¥½¸õ‘½Õµ•¹Ð¹É•…Ñ•±•µ•¹Ð ‰ÍÁ…¸ˆ¤ì(€€€€€€€¥½¸¹±…ÍÍ9…µ”ô‰‰…ÑÑ±”µÍÑ…ÑÕÌµ‘•Ñ…¥°µ¥½¸ˆì(€€€€€€€¥˜¡¥Ñ•´˜™¥Ñ•´¹¥½¹MÉŒ¥ì(€€€€€€€€€€€¥½¸¹ÍÑå±”¹‰…­É½Õ¹‘%µ…”ôÕÉ° ˆœ­MÑÉ¥¹œ¡¥Ñ•´¹¥½¹MÉŒ¤¹É•Á±…” ¼ˆ½œ°ˆ”ÈÈˆ¤¬œˆ¤œì(€€€€€€€ô(€€€€€€€¥½¸¹Í•ÑÑÑÉ¥‰ÕÑ” ‰…É¥„µ¡¥‘‘•¸ˆ°‰ÑÉÕ”ˆ¤ì(€€€€€€€½¹ÍÐÑ•áÐõ‘½Õµ•¹Ð¹É•…Ñ•±•µ•¹Ð ‰ÍÁ…¸ˆ¤ì(€€€€€€€Ñ•áÐ¹±…ÍÍ9…µ”ô‰‰…ÑÑ±”µÍÑ…ÑÕÌµ‘•Ñ…¥°µÑ•áÐˆì(€€€€€€€½¹ÍÐ¹…µ”õ‘½Õµ•¹Ð¹É•…Ñ•±•µ•¹Ð ‰ˆˆ¤ì(€€€€€€€¹…µ”¹Ñ•áÑ½¹Ñ•¹Ðô¡¥Ñ•´˜™¥Ñ•´¹¹…µ•ñð‹ž.š,ˆ¤¬‹¾òhˆì(€€€€€€€½¹ÍÐ•™™•Ðõ‘½Õµ•¹Ð¹É•…Ñ•±•µ•¹Ð ‰ÍÁ…¸ˆ¤ì(€€€€€€€•™™•Ð¹Ñ•áÑ½¹Ñ•¹Ðô¡¥Ñ•´˜™¥Ñ•´¹•™™•Ññð‹šV#šzsžRšV#’â´ˆ¤¬‹Ž–&§¦’`€ˆ¬¡¥Ñ•´˜™¥Ñ•´¹É•µ…¥¹¥¹Q•áÑñðˆÀƒ–n{–B ˆ¤ì(€€€€€€€Ñ•áÐ¹…ÁÁ•¹‘¡¥±¡¹…µ”¤ì(€€€€€€€Ñ•áÐ¹…ÁÁ•¹‘¡¥±¡•™™•Ð¤ì(€€€€€€€É½Ü¹…ÁÁ•¹‘¡¥±¡¥½¸¤ì(€€€€€€€É½Ü¹…ÁÁ•¹‘¡¥±¡Ñ•áÐ¤ì(€€€€€€€¡½ÍÐ¹…ÁÁ•¹‘¡¥±¡É½Ü¤ì(€€€ô¤ì)ô()™Õ¹Ñ¥½¸½Á•¹	…ÑÑ±•MÑ…ÑÕÍ•Ñ…¥±5½‘…°¡Í¥‘”±¥¹‘•à¥ì(€€€¥˜¡¥Í	…ÑÑ±•MÑ…ÑÕÍ%¹ÍÁ•Ñ¥½¹	±½­• ¤¥ìÉ•ÑÕÉ¸™…±Í”ìô(€€€½¹ÍÐ¥Í5½¹ÍÑ•ÈõÍ¥‘”ôôô‰µ½¹ÍÑ•Èˆì(€€€½¹ÍÐ•¹Ñ¥Ñäõ¥Í5½¹ÍÑ•È(€€€€€€€€ü¡ÑåÁ•½˜µ½¹ÍÑ•ÉÌ„ôô‰Õ¹‘•™¥¹•ˆ˜™µ½¹ÍÑ•ÉÍm¥¹‘•át¤(€€€€€€€€è¡ÑåÁ•½˜•ÑA…ÉÑå¡…É…Ñ•É	å%¹‘•àôôô‰™Õ¹Ñ¥½¸ˆý•ÑA…ÉÑå¡…É…Ñ•É	å%¹‘•à¡¥¹‘•à¤é¹Õ±°¤ì(€€€¥˜ …•¹Ñ¥Ñä¥ìÉ•ÑÕÉ¸™…±Í”ìô((€€€½¹ÍÐµ½‘…°õ•¹ÍÕÉ•	…ÑÑ±•MÑ…ÑÕÍ•Ñ…¥±5½‘…° ¤ì(€€€½¹ÍÐÍÑ…ÑÌô…¥Í5½¹ÍÑ•È˜™ÑåÁ•½˜•ÑA…ÉÑå	…ÑÑ±•MÑ…ÑÌôôô‰™Õ¹Ñ¥½¸ˆý•ÑA…ÉÑå	…ÑÑ±•MÑ…ÑÌ¡¥¹‘•à¤é¹Õ±°ì(€€€½¹ÍÐµ…á!@õ¥Í5½¹ÍÑ•Èý9Õµ‰•È¡•¹Ñ¥Ñä¹µ…á!@¥ññ5…Ñ ¹µ…à Ä±9Õµ‰•È¡•¹Ñ¥Ñä¹¡À¥ñðÄ¤è(€€€€€€€9Õµ‰•È¡ÍÑ…ÑÌ˜™ÍÑ…ÑÌ¹µ…á!@¥ññ9Õµ‰•È¡•¹Ñ¥Ñä¹µ…á!@¥ññ5…Ñ ¹µ…à Ä±9Õµ‰•È¡•¹Ñ¥Ñä¹¡À¥ñðÄ¤ì(€€€½¹ÍÐµ…áM@õ¥Í5½¹ÍÑ•Èý9Õµ‰•È¡•¹Ñ¥Ñä¹µ…áM@¥ññ5…Ñ ¹µ…à À±9Õµ‰•È¡•¹Ñ¥Ñä¹ÍÀ¥ñðÀ¤è(€€€€€€€9Õµ‰•È¡ÍÑ…ÑÌ˜™ÍÑ…ÑÌ¹µ…áM@¥ññ9Õµ‰•È¡•¹Ñ¥Ñä¹µ…áM@¥ññ5…Ñ ¹µ…à À±9Õµ‰•È¡•¹Ñ¥Ñä¹ÍÀ¥ñðÀ¤ì(€€€½¹ÍÐÍÕµµ…ÉäõÑåÁ•½˜Ý¥¹‘½Ü¹ØÄÐÍ•Ñ	…ÑÑ±•MÑ…ÑÕÍMÕµµ…Éäôôô‰™Õ¹Ñ¥½¸ˆ(€€€€€€€€ýÝ¥¹‘½Ü¹ØÄÐÍ•Ñ	…ÑÑ±•MÑ…ÑÕÍMÕµµ…Éä¡•¹Ñ¥Ñä¤(€€€€€€€€éí‰Õ™™Ìémt±‘•‰Õ™™Ìémuôì(€€€½¹ÍÐ™¥•±‘Ìõì(€€€€€€€•±•µ•¹Ðè‹–žÒƒ¾òhˆ­‰…ÑÑ±•MÑ…ÑÕÍ±•µ•¹Ñ1…‰•°¡•¹Ñ¥Ñä¤°(€€€€€€€¹…µ”è‹–B7ž¢Ç¾òhˆ­MÑÉ¥¹œ¡•¹Ñ¥Ñä¹¹…µ•ññ•¹Ñ¥Ñä¹¥‘ñð‹¢žK¢&Èˆ¤°(€€€€€€€¡Àè‰!C¾òhˆ­5…Ñ ¹µ…à À±9Õµ‰•È¡•¹Ñ¥Ñä¹¡À¥ñðÀ¤¬ˆ€¼€ˆ­µ…á!@°(€€€€€€€ÍÀè‰MC¾òhˆ­5…Ñ ¹µ…à À±9Õµ‰•È¡•¹Ñ¥Ñä¹ÍÀ¥ñðÀ¤¬ˆ€¼€ˆ­µ…áM@(€€€ôì(€€€=‰©•Ð¹­•åÌ¡™¥•±‘Ì¤¹™½É… ¡­•äôùì(€€€€€€€½¹ÍÐ¹½‘”õµ½‘…°¹ÅÕ•ÉåM•±•Ñ½È m‘…Ñ„µ™¥•±ôˆœ­­•ä¬œ‰tœ¤ì(€€€€€€€¥˜¡¹½‘”¥ì¹½‘”¹Ñ•áÑ½¹Ñ•¹Ðõ™¥•±‘Ím­•åtìô(€€€ô¤ì(€€€É•¹‘•É	…ÑÑ±•MÑ…ÑÕÍ•Ñ…¥±1¥ÍÐ¡µ½‘…°¹ÅÕ•ÉåM•±•Ñ½È m‘…Ñ„µ±¥ÍÐô‰‰Õ™™Ì‰tœ¤±ÍÕµµ…Éä¹‰Õ™™Ì¤ì(€€€É•¹‘•É	…ÑÑ±•MÑ…ÑÕÍ•Ñ…¥±1¥ÍÐ¡µ½‘…°¹ÅÕ•ÉåM•±•Ñ½È m‘…Ñ„µ±¥ÍÐô‰‘•‰Õ™™Ì‰tœ¤±ÍÕµµ…Éä¹‘•‰Õ™™Ì¤ì(€€€µ½‘…°¹¡¥‘‘•¸õ™…±Í”ì(€€€µ½‘…°¹Í•ÑÑÑÉ¥‰ÕÑ” ‰…É¥„µ¡¥‘‘•¸ˆ°‰™…±Í”ˆ¤ì(€€€Íå¹	…ÑÑ±•U¥AÉ¥½É¥Ñå1…å•È ¤ì(€€€É•ÑÕÉ¸ÑÉÕ”ì)ô()¥˜¡ÑåÁ•½˜Ý¥¹‘½Ü„ôô‰Õ¹‘•™¥¹•ˆ¥ì(€€€Ý¥¹‘½Ü¹½Á•¹	…ÑÑ±•MÑ…ÑÕÍ•Ñ…¥±5½‘…°õ½Á•¹	…ÑÑ±•MÑ…ÑÕÍ•Ñ…¥±5½‘…°ì(€€€Ý¥¹‘½Ü¹±½Í•	…ÑÑ±•MÑ…ÑÕÍ•Ñ…¥±5½‘…°õ±½Í•	…ÑÑ±•MÑ…ÑÕÍ•Ñ…¥±5½‘…°ì)ô()™Õ¹Ñ¥½¸É•¹‘•É	…ÑÑ±” ¥ì((€€€ÉÕ¹	…ÑÑ±•I•¹‘•É!½½­Ì ‰‰•™½É”ˆ±Ñ¡¥Ì±…ÉÕµ•¹ÑÌ¤ì((€€€½¹ÍÐ…É•„€ô(€€€€€€€€ ‰‰…ÑÑ±•5½¹ÍÑ•ÉÉ•„ˆ¤ì(((€€€…É•„¹¥¹¹•É!Q50ôˆˆì(((€€€ÕÉÉ•¹Ñ	…ÑÑ±•5½¹ÍÑ•ÉÌ(€€€€¹™½É…  (€€€€€€€¥¹‘•àôùì((€€€€€€€€€€€½¹ÍÐµ½¹ÍÑ•È€ô(€€€€€€€€€€€€€€€µ½¹ÍÑ•ÉÍm¥¹‘•átì(((€€€€€€€€€€€½¹ÍÐ…É€ô(€€€€€€€€€€€€€€€‘½Õµ•¹Ð¹É•…Ñ•±•µ•¹Ð (€€€€€€€€€€€€€€€€€€€€‰‘¥Øˆ(€€€€€€€€€€€€€€€€¤ì(((€€€€€€€€€€€…É¹¥€ô(€€€€€€€€€€€€€€€€‰‰…ÑÑ±•5½¹ÍÑ•Èˆ­¥¹‘•àì(((€€€€€€€€€€€…É¹±…ÍÍ9…µ”€ô(€€€€€€€€€€€€€€€€‰‰…ÑÑ±”µµ½¹ÍÑ•Èˆì(((€€€€€€€€€€€…É¹½¹±¥¬ô ¤ôùì(€€€€€€€€€€€€€€€¥˜¡…É¹±…ÍÍ1¥ÍÐ¹½¹Ñ…¥¹Ì ‰Ñ…É•Ñ…‰±”ˆ¤¥ì(€€€€€€€€€€€€€€€€€€€Í•±•Ñ	…ÑÑ±•Q…É•Ð¡¥¹‘•à¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€½Á•¹	…ÑÑ±•MÑ…ÑÕÍ•Ñ…¥±5½‘…° ‰µ½¹ÍÑ•Èˆ±¥¹‘•à¤ì(€€€€€€€€€€€ôì(((€€€€€€€€€€€½¹ÍÐ¥½¸€ô(€€€€€€€€€€€€€€€µ½¹ÍÑ•È¹¹…µ”ôôô‹–>Ë¢B+–žˆ(€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€µ½¹ÍÑ•È¹¹…µ”ôôô‹šÊgšòƒ¢Æëž.ðˆ(€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€µ½¹ÍÑ•È¹¹…µ”ôôô‹šÊg¢‚4ˆ(€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€€ˆˆì(((€€€€€€€€€€€…É¹¥¹¹•É!Q50€ô((€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÌô‰‰…ÑÑ±”µµ½¹ÍÑ•Èµ¥½¸ˆø(€€€€€€€€€€€€€€€€‘í¥½¹ô(€€€€€€€€€€€€ð½‘¥Øø((€€€€€€€€€€€€ñ‘¥Ø(€€€€€€€€€€€€€€€¥ô‰‰…ÑÑ±•5½¹ÍÑ•ÉMÑ…ÑÕÌ‘í¥¹‘•áôˆ(€€€€€€€€€€€€€€€±…ÍÌô‰µ½¹ÍÑ•ÈµÍÑ…ÑÕÌµ‰…‘•Ìˆ(€€€€€€€€€€€€øð½‘¥Øø((€€€€€€€€€€€€ñ‘¥Ø±…ÍÌô‰µ½¹ÍÑ•Èµ¡Àˆø((€€€€€€€€€€€€€€€€ñ‘¥Ø(€€€€€€€€€€€€€€€€€€€¥ô‰‰…ÑÑ±•5½¹ÍÑ•É	…È‘í¥¹‘•áôˆ(€€€€€€€€€€€€€€€€€€€±…ÍÌô‰µ½¹ÍÑ•Èµ¡Àµ¥¹¹•Èˆ(€€€€€€€€€€€€€€€€øð½‘¥Øø((€€€€€€€€€€€€€€€€ñ‘¥Ø(€€€€€€€€€€€€€€€€€€€¥ô‰‰…ÑÑ±•5½¹ÍÑ•É!AQ•áÐ‘í¥¹‘•áôˆ(€€€€€€€€€€€€€€€€€€€±…ÍÌô‰µ½¹ÍÑ•Èµ‰…ÈµÑ•áÐˆ(€€€€€€€€€€€€€€€€øð½‘¥Øø((€€€€€€€€€€€€ð½‘¥Øø((€€€€€€€€€€€€ñ‘¥Ø±…ÍÌô‰µ½¹ÍÑ•ÈµÍÀˆø((€€€€€€€€€€€€€€€€ñ‘¥Ø(€€€€€€€€€€€€€€€€€€€¥ô‰‰…ÑÑ±•5½¹ÍÑ•ÉMA	…È‘í¥¹‘•áôˆ(€€€€€€€€€€€€€€€€€€€±…ÍÌô‰µ½¹ÍÑ•ÈµÍÀµ¥¹¹•Èˆ(€€€€€€€€€€€€€€€€øð½‘¥Øø((€€€€€€€€€€€€€€€€ñ‘¥Ø(€€€€€€€€€€€€€€€€€€€¥ô‰‰…ÑÑ±•5½¹ÍÑ•ÉMAQ•áÐ‘í¥¹‘•áôˆ(€€€€€€€€€€€€€€€€€€€±…ÍÌô‰µ½¹ÍÑ•Èµ‰…ÈµÑ•áÐˆ(€€€€€€€€€€€€€€€€øð½‘¥Øø((€€€€€€€€€€€€ð½‘¥Øø((€€€€€€€€€€€€ñ‘¥Ø±…ÍÌô‰‰…ÑÑ±”µµ½¹ÍÑ•Èµ¹…µ”ˆø(€€€€€€€€€€€€€€€€‘íµ½¹ÍÑ•È¹¹…µ•ô(€€€€€€€€€€€€ð½‘¥Øø((€€€€€€€€€€€€ñ‘¥Ø±…ÍÌô‰‰…ÑÑ±”µµ½¹ÍÑ•Èµ±•Ù•°ˆø(€€€€€€€€€€€€€€€1Ø¸‘íµ½¹ÍÑ•È¹±•Ù•±ô(€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€ì(((€€€€€€€€€€€…É•„¹…ÁÁ•¹‘¡¥± (€€€€€€€€€€€€€€€…É(€€€€€€€€€€€€¤ì((€€€€€€€€€€€½¹ÍÐÁÉ•Í•¹Ñ…Ñ¥½¸õÑåÁ•½˜Ý¥¹‘½Ü„ôô‰Õ¹‘•™¥¹•ˆýÝ¥¹‘½Ü¹½ÕÉMåµ‰½±Í	…ÑÑ±•AÉ•Í•¹Ñ…Ñ¥½¸é¹Õ±°ì(€€€€€€€€€€€¥˜¡ÁÉ•Í•¹Ñ…Ñ¥½¸˜™ÑåÁ•½˜ÁÉ•Í•¹Ñ…Ñ¥½¸¹…ÁÁ±åU¹¥Ðôôô‰™Õ¹Ñ¥½¸ˆ¥ì(€€€€€€€€€€€€€€€ÁÉ•Í•¹Ñ…Ñ¥½¸¹…ÁÁ±åU¹¥Ð¡…É°‰µ½¹ÍÑ•Èˆ¤ì(€€€€€€€€€€€ô((€€€€€€€ô(€€€€¤ì(((€€€ÕÉÉ•¹Ñ	…ÑÑ±•5½¹ÍÑ•ÉÌ(€€€€¹™½É…  (€€€€€€€¥¹‘•àôùì(€€€€€€€€€€€ÕÁ‘…Ñ•5½¹ÍÑ•ÉU$¡¥¹‘•à¤ì(€€€€€€€ô(€€€€¤ì(((€€€É•¹‘•ÉA±…å•ÉÌ ¤ì(€€€½¹ÍÐ‰½ÍÍAÉ•Í•¹Ñ…Ñ¥½¹=Ý¹•ÈõÑåÁ•½˜Ý¥¹‘½Ü„ôô‰Õ¹‘•™¥¹•ˆýÝ¥¹‘½Ü¹½ÕÉMåµ‰½±Í	½ÍÍ	…ÑÑ±”é¹Õ±°ì(€€€¥˜¡‰½ÍÍAÉ•Í•¹Ñ…Ñ¥½¹=Ý¹•È˜™ÑåÁ•½˜‰½ÍÍAÉ•Í•¹Ñ…Ñ¥½¹=Ý¹•È¹Íå¹!Õôôô‰™Õ¹Ñ¥½¸ˆ¥ì(€€€€€€€‰½ÍÍAÉ•Í•¹Ñ…Ñ¥½¹=Ý¹•È¹Íå¹!Õ ¤ì(€€€ô((€€€ÉÕ¹	…ÑÑ±•I•¹‘•É!½½­Ì ‰…™Ñ•Èˆ±Ñ¡¥Ì±…ÉÕµ•¹ÑÌ¤ì(((€€€€¼¨(€€€€€€ƒŠbƒ¦7šZÃ–*ƒ–n{’ú¾ò#’úwžŸ’öÿžR£¢š2š¶¾ò3¦gšb¿–Â7žj¾ò'¾òh(€€€€€€ƒ’æ/–&7¦g––_Ž1)OžnÓš:—¦?šâ³Ž–òß–"ÛšJCšîÿŽ7žj–kšÎT(€€€€€€ƒ–Û–¾›šb¿–ÞËžÚO¦¦_¢¶'¦;šê[žŠëžj¾ò#šnûžÚO¦?–"Ã¦8(€€€€€€ƒš¶žŠëžj–Þ»¢ÞwšVã–¶_¾ò'¾ò3š.ÿš:'šb¿–"“šZß¦2¿¢ª“ŠSŠP(€€€€€€MOžj™±•àµÉ½ß–r£’öÿžR£¢žj–¾›¦jošâ³¢¦›žJÃ–Š’â,(€€€€€€ƒ’âžnÓ’â7–’ƒ–>¿¦vƒ¾ò3¢"–Ûžæóžê3’þ‡’îíMO–:ïž2s¾ò0(€€€€€€ƒ’â7–š’þ‡’îï¦g–/–ÞËžÚO¢¶'–¾›šê[žŠëžj¦?šâ³šZç–ò?¾ò0(€€€€€€ƒžR£–¾›¦jo¦?–"ÃžjšVã–¶_žnÓš:—–òß–"Û¢¢·–ºk¦®c–ê›¾ò0(€€€€€€ƒžŠë’þwš"Ã¦²—žÒ¦2’â–ºkšr¢Êóšîÿ–"Ã¢¦Ë–"Ãžj–rÃšZçŽ(€€€€¨¼((€€€€¼¨XäÛ¾òkš"Ã¦²—¢Î¢¢+¦®c–ê›žRÄ±•àƒšÆë–ºk¾ò3’â7–7š:Kž¢/’ê3š²„)Lƒ¦?šâ³Ž€¨¼()ô(((¼¨(€€ƒŠbƒ¦7šZÃ–*ƒ–n{’ú¾òk¦?šâ°¹‰…ÑÑ±”µ¥¹™¿žn»–&7žj’â/žÞ¾ò0(€€ƒ¢ÞžV¯¦v‹–¾›¦jo–>¿¢š[ž¾–r7’â/žÞ’æ/¦ZO¦
–Þ»–’k–ÂG¾ò0(€€ƒžnÓš:—š*+–Þ»¢Þw–*ƒ–nx¹‰…ÑÑ±”µ¥¹™¿žj¦®c–ê›’â+¾ò0(€€ƒ–òß–"Û¢Êóšîÿ¾ò3’â7–7–Z»žÒS’úw¢ÎÑML™±•àµÉ½Ü(€€ƒšb¿–B›šr'žŠë–¾›žRšV#Ž(¨¼()™Õ¹Ñ¥½¸™¥±±	…ÑÑ±•%¹™½…À ¥ì(€€€€¼¨XäØ½µÁ…Ñ¥‰¥±¥ÑäÍÑÕ‹¾òk¢"+–÷–ò?–B7ž¢Ç’þwžVg¾ò3¦ÿ–7–Û’î[¢"+ž¢/–ò?–>žŸšf–‚Ç¦2¿Ž(€€€€€€ƒ–¾›¦jo¦®c–ê›–º3–£’ê“žÖ˜ML±•ã¾ò3’â7–7¢º Ù¥ÍÕ…±Y¥•ÝÁ½ÉÓŽ’â7–7–¾¬¥¹±¥¹”¡•¥¡ÓŽ€¨¼)ô(((¼¨(€€ƒŠbƒ’þ»š¶¾ò#š.ÿš:'šVÓ––])O–òß–"Û¢Žs¦®cžjš¦–"Û¾ò'¾òh(€€ƒ¦g’âšVÓ––_Ž3¦?šâ³Ž¢Žs¦®cŽžn¢÷¢š[žª_¢º+–2[Ž(€€ƒ–ºkšf¦7šZÃšª‹š~—Ž7žj–kšÎW¾ò3šb¿’æ/–&7ž
ë’ê¢žšÆè(€€ƒš"Ã¦²—žÒ¦2’â/šZçž¦ëžf÷–>7¢š–b_¢¦›žj–Û’â·’âž¢»š&/šÎW¾ò0(€€ƒ’ö¦g–æû¢ò«–r£’öÿžR£¢–¾›¦jošâ³¢¦›žJÃ–Š’â/’âžnÓšÊKšr$(€€ƒž¦§–ºkžRšV#¾ò3–>7¢3–Š{–*ƒ’êž¢/–ò?žŠó¢’¦ns–ê›Ž(€€ƒ’æ¢ºOš¾?š²…ÕÁ‘…Ñ•U$ §¦÷¢š–’k–k’âš²‡¦?šâ³¦/žº_Ž((€€ƒž>û–r£šRçžR£šnÓš‚çšr³žj–kšÎW¾òk¢ºL¹ÑÕÉ¸µÑ…É•ÐµÉ½Ü(€€ƒ¾ò#–n{–B#¢Î¢¢+–6–†+¾ò'šr³¢ê¯–ÂÇšb¿Ž3šr'–’k–ÂG–&§¦’cž¦ë¦ZL(€€ƒ–ÂÇ¢«–.W¦Vß–’k–’ŸŽ7žj–6–†+¾ò3’â7–7¦r¢š–>›–’[žR¡)L(€€ƒ–:ï¦?šâ³Ž–:ï¢Žs¾ò3¦gšVÓšº×ž¢/–ò?žŠó–ÞËžÚO’â7¦r¢š’êŽ(¨¼()™Õ¹Ñ¥½¸ÉÕ¹	…ÑÑ±•5½¹ÍÑ•ÉU¥!½½¬¡¹…µ”±¥¹‘•à±µ½¹ÍÑ•È¥ì(€€€¥˜¡ÑåÁ•½˜Ý¥¹‘½Üôôô‰Õ¹‘•™¥¹•ˆ¥ìÉ•ÑÕÉ¸ìô(€€€½¹ÍÐ¡½½¬õÝ¥¹‘½Ým¹…µ•tì(€€€¥˜¡ÑåÁ•½˜¡½½¬„ôô‰™Õ¹Ñ¥½¸ˆ¥ìÉ•ÑÕÉ¸ìô(€€€ÑÉåì(€€€€€€€¡½½¬¡¥¹‘•à±µ½¹ÍÑ•È¤ì(€€€õ…Ñ ¡•ÉÉ½È¥ì(€€€€€€€½¹Í½±”¹•ÉÉ½È ‰	…ÑÑ±”µ½¹ÍÑ•ÈU$¡½½¬™…¥±•èˆ±¹…µ”±•ÉÉ½È¤ì(€€€ô)ô()™Õ¹Ñ¥½¸…ÁÁ±å5½¹ÍÑ•ÉU¥UÁ‘…Ñ”¡¥¹‘•à¥ì((€€€½¹ÍÐµ½¹ÍÑ•Èõµ½¹ÍÑ•ÉÍm¥¹‘•átì(€€€¥˜ …µ½¹ÍÑ•È¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô((€€€ÉÕ¹	…ÑÑ±•5½¹ÍÑ•ÉU¥!½½¬ ‰ØÄÐÅ	•™½É•5½¹ÍÑ•ÉU¥UÁ‘…Ñ”ˆ±¥¹‘•à±µ½¹ÍÑ•È¤ì((€€€½¹ÍÐ¡Á	…Èô ‰‰…ÑÑ±•5½¹ÍÑ•É	…Èˆ­¥¹‘•à¤ì(€€€½¹ÍÐÍÁ	…Èô ‰‰…ÑÑ±•5½¹ÍÑ•ÉMA	…Èˆ­¥¹‘•à¤ì(€€€½¹ÍÐ¡ÁQ•áÐô ‰‰…ÑÑ±•5½¹ÍÑ•É!AQ•áÐˆ­¥¹‘•à¤ì(€€€½¹ÍÐÍÁQ•áÐô ‰‰…ÑÑ±•5½¹ÍÑ•ÉMAQ•áÐˆ­¥¹‘•à¤ì((€€€¥˜¡¡Á	…È¥ì(€€€€€€€¡Á	…È¹ÍÑå±”¹Ý¥‘Ñ ô¡µ½¹ÍÑ•È¹¡À½µ½¹ÍÑ•È¹µ…á!@¨ÄÀÀ¤¬ˆ”ˆì(€€€ô((€€€¥˜¡ÍÁ	…È¥ì(€€€€€€€ÍÁ	…È¹ÍÑå±”¹Ý¥‘Ñ ô¡µ½¹ÍÑ•È¹ÍÀ½µ½¹ÍÑ•È¹µ…áM@¨ÄÀÀ¤¬ˆ”ˆì(€€€ô((€€€¥˜¡¡ÁQ•áÐ¥ì(€€€€€€€¡ÁQ•áÐ¹Ñ•áÑ½¹Ñ•¹Ðõµ½¹ÍÑ•È¹¡À¬ˆ¼ˆ­µ½¹ÍÑ•È¹µ…á!@ì(€€€ô((€€€¥˜¡ÍÁQ•áÐ¥ì(€€€€€€€ÍÁQ•áÐ¹Ñ•áÑ½¹Ñ•¹Ðõµ½¹ÍÑ•È¹ÍÀ¬ˆ¼ˆ­µ½¹ÍÑ•È¹µ…áM@ì(€€€ô((€€€ÉÕ¹	…ÑÑ±•5½¹ÍÑ•ÉU¥!½½¬ ‰ØÄÐÅ™Ñ•É5½¹ÍÑ•ÉU¥UÁ‘…Ñ”ˆ±¥¹‘•à±µ½¹ÍÑ•È¤ì(€€€ÉÕ¹	…ÑÑ±•5½¹ÍÑ•ÉU¥!½½¬ ‰ØÄÐÍMåÍÑ•µ™Ñ•É5½¹ÍÑ•ÉU¥UÁ‘…Ñ”ˆ±¥¹‘•à±µ½¹ÍÑ•È¤ì(€€€ÉÕ¹	…ÑÑ±•5½¹ÍÑ•ÉU¥!½½¬ ‰ØÄÐå™Ñ•É5½¹ÍÑ•ÉU¥UÁ‘…Ñ”ˆ±¥¹‘•à±µ½¹ÍÑ•È¤ì(€€€ÉÕ¹	…ÑÑ±•5½¹ÍÑ•ÉU¥!½½¬ ‰ØÄÐÍMÑ…ÑÕÍ™Ñ•É5½¹ÍÑ•ÉU¥UÁ‘…Ñ”ˆ±¥¹‘•à±µ½¹ÍÑ•È¤ì)ô()™Õ¹Ñ¥½¸ÕÁ‘…Ñ•5½¹ÍÑ•ÉU$¡¥¹‘•à¥ì((€€€‰ÕµÁ	…ÑÑ±•IÕ¹Ñ¥µ•5•ÑÉ¥Œ ‰ÕÁ‘…Ñ•5½¹ÍÑ•ÉU$ˆ¤ì((€€€½¹ÍÐÍ¡•‘Õ±•ÈõÑåÁ•½˜Ý¥¹‘½Ü„ôô‰Õ¹‘•™¥¹•ˆýÝ¥¹‘½Ü¹ØÄÐÍM¡•‘Õ±•5½¹ÍÑ•ÉU¥UÁ‘…Ñ”é¹Õ±°ì(€€€¥˜¡ÑåÁ•½˜Í¡•‘Õ±•Èôôô‰™Õ¹Ñ¥½¸ˆ¥ì(€€€€€€€É•ÑÕÉ¸Í¡•‘Õ±•È¡¥¹‘•à° ¤ôù…ÁÁ±å5½¹ÍÑ•ÉU¥UÁ‘…Ñ”¡¥¹‘•à¤¤ì(€€€ô((€€€É•ÑÕÉ¸…ÁÁ±å5½¹ÍÑ•ÉU¥UÁ‘…Ñ”¡¥¹‘•à¤ì)ô()™Õ¹Ñ¥½¸É•¹‘•ÉA±…å•ÉÌ ¥ì((€€€½¹ÍÐÉ½Ü€ô(€€€€€€€€ ‰‰…ÑÑ±•A±…å•ÉI½Üˆ¤ì(((€€€É½Ü¹¥¹¹•É!Q50ôˆˆì(((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾òh(€€€€€€ƒ–:šr³¦g¢Ž‡–në–ºk–>«žV¯ž²³’â¢žK¢&Ë’â–ò×–6‡¾ò0(€€€€€€ƒž>û–r¡Á±…å•ÈË–¶c–r£žj¢¦Çšr’â¢ÖßžV¯–ë’ú¾ò0(€€€€€€ƒš¾?–ò×–6‡žj–Ÿ¦£–’îÙ¥“¦÷–*ƒ’â+žÒ‹–òT(€€€€€€ƒ¾ò À÷ž²³’â¢žK¢&ËŽÄ÷ž²³’ê3¢žK¢&Ë¾ò'¾ò0(€€€€€€ƒ¦ÿ–7–§–ò×–6‡žj¢†šŠt¿ž.š/–r[ž’é¥“’êKžnãš&OšzÛŽ(€€€€¨¼((€€€½¹ÍÐÁ…ÉÑäõ•Ñá¥ÍÑ¥¹A…ÉÑå%¹‘•á•Ì ¤¹µ…À¡¡…É…Ñ•É%¹‘•àôùì(€€€€€€€½¹ÍÐ¡…É…Ñ•Èõ•ÑA…ÉÑå¡…É…Ñ•É	å%¹‘•à¡¡…É…Ñ•É%¹‘•à¤ì(€€€€€€€É•ÑÕÉ¸ì(€€€€€€€€€€€¡…É…Ñ•Èé¡…É…Ñ•È°(€€€€€€€€€€€¡…É…Ñ•É%¹‘•àé¡…É…Ñ•É%¹‘•à°(€€€€€€€€€€€¥é¡…É…Ñ•È¹¥‘ñð ‹¢žK¢&Èˆ¬¡¡…É…Ñ•É%¹‘•à¬Ä¤¤°(€€€€€€€€€€€¥½¸é•±•µ•¹Ñ…Ñ…‰…Í•m¡…É…Ñ•È¹•±•µ•¹Ñt(€€€€€€€€€€€€€€€€ü•±•µ•¹Ñ…Ñ…‰…Í•m¡…É…Ñ•È¹•±•µ•¹Ñt¹¥½¸(€€€€€€€€€€€€€€€€è€ˆˆ°(€€€€€€€€€€€±•Ù•°é¡…É…Ñ•È¹±•Ù•°(€€€€€€€ôì(€€€ô¤ì(((€€€Á…ÉÑä¹™½É… ¡•¹ÑÉäôùì((€€€€€€€½¹ÍÐ¥¹‘•àõ•¹ÑÉä¹¡…É…Ñ•É%¹‘•àì((€€€€€€€½¹ÍÐ‰½à€ô(€€€€€€€€€€€‘½Õµ•¹Ð¹É•…Ñ•±•µ•¹Ð (€€€€€€€€€€€€€€€€‰‘¥Øˆ(€€€€€€€€€€€€¤ì(((€€€€€€€‰½à¹±…ÍÍ9…µ”€ô(€€€€€€€€€€€€‰‰…ÑÑ±”µÁ±…å•Èˆì(((€€€€€€€‰½à¹¥ô(€€€€€€€€€€€€‰‰…ÑÑ±•A±…å•É…Éˆ¬(€€€€€€€€€€€¥¹‘•àì((€€€€€€€‰½à¹ÍÑå±”¹‰…­É½Õ¹‘%µ…”ô(€€€€€€€€€€€€‰ÕÉ° œˆ­•Ñ¡…É…Ñ•É	…ÑÑ±•ÉÑÝ½É­A…Ñ ¡•¹ÑÉä¹¡…É…Ñ•È¤¬ˆœ¤ˆì(((€€€€€€€‰½à¹¥¹¹•É!Q50€ô((€€€€€€€€(€€€€€€€€ñ‘¥Ø±…ÍÌô‰‰…ÑÑ±”µÁ±…å•Èµ¥½¸ˆø(€€€€€€€€€€€€‘í•¹ÑÉä¹¥½¹ô(€€€€€€€€ð½‘¥Øø((€€€€€€€€ñ‘¥Ø(€€€€€€€€€€€¥ô‰‰…ÑÑ±•A±…å•ÉMÑ…ÑÕÌ‘í¥¹‘•áôˆ(€€€€€€€€€€€±…ÍÌô‰µ½¹ÍÑ•ÈµÍÑ…ÑÕÌµ‰…‘•Ìˆ(€€€€€€€€øð½‘¥Øø((€€€€€€€€ñ‘¥Ø±…ÍÌô‰¡Àµ‰…Èˆø((€€€€€€€€€€€€ñ‘¥Ø(€€€€€€€€€€€€€€€¥ô‰‰…ÑÑ±•A±…å•É!A	…È‘í¥¹‘•áôˆ(€€€€€€€€€€€€€€€±…ÍÌô‰¡Àµ‰…Èµ¥¹¹•Èˆ(€€€€€€€€€€€€øð½‘¥Øø((€€€€€€€€€€€€ñ‘¥Ø(€€€€€€€€€€€€€€€¥ô‰‰…ÑÑ±•A±…å•ÉM¡¥•±‘	…È‘í¥¹‘•áôˆ(€€€€€€€€€€€€€€€±…ÍÌô‰¡Àµ‰…ÈµÍ¡¥•±µ½Ù•É±…äˆ(€€€€€€€€€€€€øð½‘¥Øø((€€€€€€€€€€€€ñ‘¥Ø±…ÍÌô‰¡Àµ‰…ÈµÑ•áÐˆøð½‘¥Øø((€€€€€€€€ð½‘¥Øø((€€€€€€€€ñ‘¥Ø±…ÍÌô‰ÍÀµ‰…Èˆø((€€€€€€€€€€€€ñ‘¥Ø(€€€€€€€€€€€€€€€¥ô‰‰…ÑÑ±•A±…å•ÉMA	…È‘í¥¹‘•áôˆ(€€€€€€€€€€€€€€€±…ÍÌô‰ÍÀµ‰…Èµ¥¹¹•Èˆ(€€€€€€€€€€€€øð½‘¥Øø((€€€€€€€€€€€€ñ‘¥Ø±…ÍÌô‰ÍÀµ‰…ÈµÑ•áÐˆøð½‘¥Øø((€€€€€€€€ð½‘¥Øø((€€€€€€€€ñ‘¥Ø±…ÍÌô‰‰…ÑÑ±”µÁ±…å•Èµ¥ˆøð½‘¥Øø(€€€€€€€€ì(((€€€€€€€€¼¨(€€€€€€€€€€ƒŠbƒ’þ»š¶¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò'¾òh(€€€€€€€€€€ƒž¶'žÒk–:šr³ž6£ž®/’â¢†3¦†¿ž’ë–r£’â+šZç¾ò0(€€€€€€€€€€ƒž>û–r£šRçš"C¢Þ–êW¦£žj¥“–B#’ö×š"C’â¢†0(€€€€€€€€€€ƒŽ3¢žK¢&Ë–B41Ø¹cŽ7¾ò0(€€€€€€€€€€ƒžr’â/’â¢†3žj¦®c–ê›¾ò0(€€€€€€€€€€ƒ¢ºO–6‡ž&’â/–6+¦£žj¢Î¢¢+–"_–>¿’î—šnÓžÊûžÂ‡Ž(€€€€€€€€¨¼((€€€€€€€‰½à¹ÅÕ•ÉåM•±•Ñ½È (€€€€€€€€€€€€ˆ¹‰…ÑÑ±”µÁ±…å•Èµ¥ˆ(€€€€€€€€¤¹Ñ•áÑ½¹Ñ•¹Ð€ô((€€€€€€€€€€€•¹ÑÉä¹¥¬(€€€€€€€€€€€€ˆ1Ø¸ˆ¬(€€€€€€€€€€€•¹ÑÉä¹±•Ù•°ì(((€€€€€€€‰½à¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È (€€€€€€€€€€€€‰±¥¬ˆ°(€€€€€€€€€€€€ ¤ôùì(€€€€€€€€€€€€€€€¥˜¡‰½à¹±…ÍÍ1¥ÍÐ¹½¹Ñ…¥¹Ì ‰…±±äµÑ…É•Ñ…‰±”ˆ¤¥ì(€€€€€€€€€€€€€€€€€€€Í•±•Ñ	…ÑÑ±•±±åQ…É•Ð¡¥¹‘•à¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€½Á•¹	…ÑÑ±•MÑ…ÑÕÍ•Ñ…¥±5½‘…° ‰Á±…å•Èˆ±¥¹‘•à¤ì(€€€€€€€€€€€ô(€€€€€€€€¤ì(((€€€€€€€É½Ü¹…ÁÁ•¹‘¡¥± (€€€€€€€€€€€‰½à(€€€€€€€€¤ì((€€€ô¤ì(((€€€ÕÁ‘…Ñ•A±…å•ÉMÑ…ÑÕÍ	…‘•Ì ¤ì()ô(((¼¨(€€ƒŠbƒž:§–ºÛ¢«–ÞÇ¢ê¯’â+žj‰Õ™›ž.š/–r[ž’è(€€ƒ¾ò#žn»–&7–>«šr'šKž¯¾ò'¾ò0(€€ƒ¢Þš«ž&§žjžžK–r[ž’ëšb¿–B3’â––_¦
?¢ò¿¾ò0(€€ƒšr'žRšV#’â·žj‰Õ™›–ÂÇ’âžnÓ¦†¿ž’ë¾ò3žÖCšvš&7šÚ#–’ÇŽ(¨¼()™Õ¹Ñ¥½¸ÕÁ‘…Ñ•A±…å•ÉMÑ…ÑÕÍ	…‘•Ì ¥ì((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾òh(€€€€€€ƒ–:šr³¦g¢Ž‡–>«šnÓšZÃ’â–ò×–6‡¾ò#–në–ºi¥“¾ò'¾ò0(€€€€€€ƒž>û–r£šRçš"C–B3šfšnÓšZÃž²³’â¢žK¢&Ë¢Þž²³’ê3¢žK¢&È(€€€€€€ƒ¾ò#–¶c–r£žj¢¦Ç¾ò'–B¢«žj‰Õ™›–r[ž’ëŽ(€€€€¨¼((€€€•Ñá¥ÍÑ¥¹A…ÉÑå%¹‘•á•Ì ¤¹™½É… ¡¥¹‘•àôùì(€€€€€€€ÕÁ‘…Ñ•M¥¹±•¡…É…Ñ•ÉMÑ…ÑÕÍ	…‘” (€€€€€€€€€€€¥¹‘•à°(€€€€€€€€€€€•ÑA…ÉÑå¡…É…Ñ•É	å%¹‘•à¡¥¹‘•à¤(€€€€€€€€¤ì(€€€ô¤ì()ô(()™Õ¹Ñ¥½¸ÕÁ‘…Ñ•M¥¹±•¡…É…Ñ•ÉMÑ…ÑÕÍ	…‘” (€€€¥¹‘•à°(€€€¡…É…Ñ•È(¥ì((€€€½¹ÍÐÍÑ…ÑÕÍÉ•„ô ‰‰…ÑÑ±•A±…å•ÉMÑ…ÑÕÌˆ­¥¹‘•à¤ì(€€€¥˜ …ÍÑ…ÑÕÍÉ•„¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô((€€€½¹ÍÐ…ÁÁ±åMÑ…ÑÕÌô ¤ôùì(€€€€€€€¥˜ (€€€€€€€€€€€ÑåÁ•½˜Ý¥¹‘½Ü„ôô‰Õ¹‘•™¥¹•ˆ˜˜(€€€€€€€€€€€ÑåÁ•½˜Ý¥¹‘½Ü¹ØÄÐÍMÑ…ÑÕÍ™Ñ•ÉA±…å•ÉU¥UÁ‘…Ñ”ôôô‰™Õ¹Ñ¥½¸ˆ(€€€€€€€€¥ì(€€€€€€€€€€€Ý¥¹‘½Ü¹ØÄÐÍMÑ…ÑÕÍ™Ñ•ÉA±…å•ÉU¥UÁ‘…Ñ”¡¥¹‘•à±¡…É…Ñ•È¤ì(€€€€€€€ô(€€€ôì((€€€½¹ÍÐÍ¡•‘Õ±•ÈõÑåÁ•½˜Ý¥¹‘½Ü„ôô‰Õ¹‘•™¥¹•ˆýÝ¥¹‘½Ü¹ØÄÐÍM¡•‘Õ±•A±…å•ÉMÑ…ÑÕÍU¥UÁ‘…Ñ”é¹Õ±°ì(€€€¥˜¡ÑåÁ•½˜Í¡•‘Õ±•Èôôô‰™Õ¹Ñ¥½¸ˆ¥ì(€€€€€€€É•ÑÕÉ¸Í¡•‘Õ±•È¡¥¹‘•à±…ÁÁ±åMÑ…ÑÕÌ¤ì(€€€ô((€€€É•ÑÕÉ¸…ÁÁ±åMÑ…ÑÕÌ ¤ì)ô()™Õ¹Ñ¥½¸ÕÁ‘…Ñ•	…ÑÑ±•A±…å•É	…ÉÌ ¥ì((€€€ÕÁ‘…Ñ•A±…å•ÉMÑ…ÑÕÍ	…‘•Ì ¤ì(((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾òh(€€€€€€ƒ–:šr³¦g¢Ž‡–>«šnÓšZÃž²³’â¢žK¢&Ëžj¢†šŠw¾ò0(€€€€€€ƒ¢3’âQ¡ÁQ•áÐ½ÍÁQ•áÓšb¿žR (€€€€€€‘½Õµ•¹Ð¹ÅÕ•ÉåM•±•Ñ½È ˆ¹¡Àµ‰…ÈµÑ•áÐˆ¤(€€€€€€ƒ–:ï–£–~š&ûž²³’â–/ž²›–B#žj–žÒƒ¾ò0(€€€€€€ƒ–ÂÇžº_–*ƒ’êž²³’ê3–ò×–6‡’æšÂã¦ƒš*O–"Ã–B3’â–/Ž(€€€€€€ƒšRçš"C–"–"—šnÓšZÃ–§–ò×–6‡–B¢«žj¢†šŠw¾ò0(€€€€€€ƒšZ–¶_–žÒƒ’æšRçš"C–r£¢¦Ë–ò×–6‡žjž¾–r7–Ÿš&û¾ò0(€€€€€€ƒ’â7šrš*O¦2¿Ž(€€€€¨¼((€€€•Ñá¥ÍÑ¥¹A…ÉÑå%¹‘•á•Ì ¤¹™½É… ¡¥¹‘•àôùì(€€€€€€€ÕÁ‘…Ñ•M¥¹±•¡…É…Ñ•É	…ÉÌ (€€€€€€€€€€€¥¹‘•à°(€€€€€€€€€€€•ÑA…ÉÑå¡…É…Ñ•É	å%¹‘•à¡¥¹‘•à¤°(€€€€€€€€€€€•ÑA…ÉÑå	…ÑÑ±•MÑ…ÑÌ¡¥¹‘•à¤(€€€€€€€€¤ì(€€€ô¤ì()ô(()™Õ¹Ñ¥½¸ÕÁ‘…Ñ•M¥¹±•¡…É…Ñ•É	…ÉÌ (€€€¥¹‘•à°(€€€¡…É…Ñ•È°(€€€ÍÑ…ÑÌ(¥ì((€€€½¹ÍÐ…Éô(€€€€€€€€ ‰‰…ÑÑ±•A±…å•É…Éˆ­¥¹‘•à¤ì(((€€€¥˜ ……É¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€€¼¨(€€€€€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3Ž3šÒï¢F_¢š’ê»¾ò0(€€€€€€ƒš¶ï’ê‡š&7šj_Ž7¾ò'¾òh(€€€€€€ƒš¾?š²‡¢†šŠwšnÓšZÃžjšf–g¾ò3¦‚’úÿšª‹š~—¢žK¢&Ëšb¿–B˜(€€€€€€ƒ–ÞËžÚO–K’â/¾ò!¡ÀðôÃ¾ò'¾ò3šb¿žj¢¦Ç–*ƒ’â(¹‘½Ý¸(€€€€€€ƒ¢ºO–6‡ž&¢º+šj_¾ò3šÒï¢F_–ÂÇš*(¹‘½Ý»š.ÿš:'žÚ·š2(€€€€€€ƒ–:šr³’ê»–ê›Ž¦g–/–÷–ò?šr³’ú–ÂÇšb¿–R¿’â¢Êƒ¢Ê°(€€€€€€ƒ–B3š¶—Ž3žV¯¦v‹¢†šŠwŽ7¢ÞŽ3¢žK¢&Ë–¾›¦jm¡ÃŽ7žj(€€€€€€ƒ–rÃšZç¾ò3–6‡ž&žjšb;šj_–Û–¾›’æšb¿–B3’â’îÛ’ê/žj(€€€€€€ƒ–îÛ’òã¾ò#¦÷šb¿š*)¡Ãž.š/–>7šbƒ–"ÃžV¯¦v‹’â+¾ò'¾ò0(€€€€€€ƒšRû–r£¦g¢Ž‡’â¢Öß¢fWžB¾ò3’â7žR£–>›–’[š&û–rÃšZä(€€€€€€ƒ¦7¢’–"“šZÝ¡…É…Ñ•È¹¡ÀðôÃŽ(€€€€¨¼((€€€…É¹±…ÍÍ1¥ÍÐ¹Ñ½±” (€€€€€€€€‰‘½Ý¸ˆ°(€€€€€€€¡…É…Ñ•È¹¡ÀðôÀ(€€€€¤ì(((€€€½¹ÍÐ¡Á	…È€ô(€€€€€€€€ ‰‰…ÑÑ±•A±…å•É!A	…Èˆ­¥¹‘•à¤ì(((€€€½¹ÍÐÍÁ	…È€ô(€€€€€€€€ ‰‰…ÑÑ±•A±…å•ÉMA	…Èˆ­¥¹‘•à¤ì(((€€€½¹ÍÐÍ¡¥•±‘	…È€ô(€€€€€€€€ ‰‰…ÑÑ±•A±…å•ÉM¡¥•±‘	…Èˆ­¥¹‘•à¤ì(((€€€½¹ÍÐ¡ÁA•É•¹Ð€ô(€€€€€€€5…Ñ ¹µ…à (€€€€€€€€€€€€À°(€€€€€€€€€€€5…Ñ ¹µ¥¸ (€€€€€€€€€€€€€€€€ÄÀÀ°(€€€€€€€€€€€€€€€¡…É…Ñ•È¹¡À¼(€€€€€€€€€€€€€€€ÍÑ…ÑÌ¹µ…á!@¨(€€€€€€€€€€€€€€€€ÄÀÀ(€€€€€€€€€€€€¤(€€€€€€€€¤ì(((€€€¥˜¡¡Á	…È¥ì((€€€€€€€¡Á	…È¹ÍÑå±”¹Ý¥‘Ñ €ô(€€€€€€€€€€€¡ÁA•É•¹Ð¬(€€€€€€€€€€€€ˆ”ˆì((€€€ô(((€€€€¼¨(€€€€€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3Ž3¢¶ßžnûšV#šzsžRš"Cžj¢¦Ç¾ò0(€€€€€€ƒš"GšZç¢†¦?šŠw¢š–Š{–*ƒž¶'–ó¦Vß–ê›žjžf÷¢&Ë¢†¦?šŠwŽ7¾ò'¾òh(€€€€€€ƒžf÷¢&Ë¢&Ë–†+žÞ+š:—–r£žÒ¢&Ë¢†¦?–>Ï–Ó¦Z/–ž/¾ò!±•™Ðõ¡ÁA•É•¹Ó¾ò'¾ò0(€€€€€€ƒ–¾³–ê›¾òw¢¶ßžnû–&§¦’c¦?’öQµ…á!Cžjš¾S’ú/¾ò3¢Þ¢†šŠwšr³¢ê¯žR (€€€€€€ƒ–B3’â–-µ…á!C–~ëšê[š>ožº_¾ò3¢Ú–ë–ºç–f£žj¦£–"–nƒž
è(€€€€€€€¹¡Àµ‰…Ëšr³¢ê­½Ù•É™±½Üé¡¥‘‘•»šr¢«–.W¢Š¯¢Žš:'¾ò0(€€€€€€ƒ’â7šržV¯–ëš‚óžÞk–’[Ž(€€€€¨¼((€€€¥˜¡Í¡¥•±‘	…È¥ì((€€€€€€€½¹ÍÐÍ¡¥•±‘	Õ™˜ô((€€€€€€€€€€€€¡¡…É…Ñ•È¹…Ñ¥Ù•	Õ™™Íññmt¤(€€€€€€€€€€€€¹™¥¹ (€€€€€€€€€€€€€€€ˆôø((€€€€€€€€€€€€€€€€€€€ˆ¹ÑåÁ”ôôô‰Í¡¥•±ˆ˜˜(€€€€€€€€€€€€€€€€€€€ˆ¹ÑÕÉ¹Í1•™ÐøÀ˜˜(€€€€€€€€€€€€€€€€€€€ˆ¹É•µ…¥¹¥¹œøÀ((€€€€€€€€€€€€¤ì(((€€€€€€€½¹ÍÐÍ¡¥•±‘A•É•¹Ðô((€€€€€€€€€€€Í¡¥•±‘	Õ™˜(€€€€€€€€€€€€ü(€€€€€€€€€€€5…Ñ ¹µ…à (€€€€€€€€€€€€€€€€À°(€€€€€€€€€€€€€€€Í¡¥•±‘	Õ™˜¹É•µ…¥¹¥¹œ¼(€€€€€€€€€€€€€€€ÍÑ…ÑÌ¹µ…á!@¨(€€€€€€€€€€€€€€€€ÄÀÀ(€€€€€€€€€€€€¤(€€€€€€€€€€€€è(€€€€€€€€€€€€Àì(((€€€€€€€Í¡¥•±‘	…È¹ÍÑå±”¹±•™Ðô(€€€€€€€€€€€¡ÁA•É•¹Ð¬(€€€€€€€€€€€€ˆ”ˆì((€€€€€€€Í¡¥•±‘	…È¹ÍÑå±”¹Ý¥‘Ñ ô(€€€€€€€€€€€Í¡¥•±‘A•É•¹Ð¬(€€€€€€€€€€€€ˆ”ˆì((€€€ô(((€€€¥˜¡ÍÁ	…È¥ì((€€€€€€€ÍÁ	…È¹ÍÑå±”¹Ý¥‘Ñ €ô(€€€€€€€€€€€5…Ñ ¹µ…à (€€€€€€€€€€€€€€€€À°(€€€€€€€€€€€€€€€5…Ñ ¹µ¥¸ (€€€€€€€€€€€€€€€€€€€€ÄÀÀ°(€€€€€€€€€€€€€€€€€€€¡…É…Ñ•È¹ÍÀ¼(€€€€€€€€€€€€€€€€€€€ÍÑ…ÑÌ¹µ…áM@¨(€€€€€€€€€€€€€€€€€€€€ÄÀÀ(€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€¤¬(€€€€€€€€€€€€ˆ”ˆì((€€€ô(((€€€½¹ÍÐ¡ÁQ•áÐ€ô(€€€€€€€…É¹ÅÕ•ÉåM•±•Ñ½È (€€€€€€€€€€€€ˆ¹¡Àµ‰…ÈµÑ•áÐˆ(€€€€€€€€¤ì(((€€€½¹ÍÐÍÁQ•áÐ€ô(€€€€€€€…É¹ÅÕ•ÉåM•±•Ñ½È (€€€€€€€€€€€€ˆ¹ÍÀµ‰…ÈµÑ•áÐˆ(€€€€€€€€¤ì(((€€€¥˜¡¡ÁQ•áÐ¥ì((€€€€€€€¡ÁQ•áÐ¹Ñ•áÑ½¹Ñ•¹Ð€ô(€€€€€€€€€€€¡…É…Ñ•È¹¡À¬(€€€€€€€€€€€€ˆ¼ˆ¬(€€€€€€€€€€€ÍÑ…ÑÌ¹µ…á!@ì((€€€ô(((€€€¥˜¡ÍÁQ•áÐ¥ì((€€€€€€€ÍÁQ•áÐ¹Ñ•áÑ½¹Ñ•¹Ð€ô(€€€€€€€€€€€¡…É…Ñ•È¹ÍÀ¬(€€€€€€€€€€€€ˆ¼ˆ¬(€€€€€€€€€€€ÍÑ…ÑÌ¹µ…áM@ì((€€€ô()ô(()™Õ¹Ñ¥½¸ÑÉ¥•ÉÉ¥Ñ¥…±%µÁ…Ð¡•±•µ•¹Ð¥ì((€€€¥˜ …•±•µ•¹Ð¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô((€€€•±•µ•¹Ð¹±…ÍÍ1¥ÍÐ¹É•µ½Ù” ‰É¥Ñ¥…°µ¥µÁ…Ðˆ¤ì(€€€Ù½¥•±•µ•¹Ð¹½™™Í•Ñ]¥‘Ñ ì(€€€•±•µ•¹Ð¹±…ÍÍ1¥ÍÐ¹…‘ ‰É¥Ñ¥…°µ¥µÁ…Ðˆ¤ì((€€€Í•ÑQ¥µ•½ÕÐ  ¤ôùì(€€€€€€€•±•µ•¹Ð¹±…ÍÍ1¥ÍÐ¹É•µ½Ù” ‰É¥Ñ¥…°µ¥µÁ…Ðˆ¤ì(€€€ô°ÔÈÀ¤ì)ô(()™Õ¹Ñ¥½¸Í¡½Ý…µ…•A½ÁÕÀ¡•±•µ•¹Ð±Ñ•áÐ±ÑåÁ”±¥ÍÉ¥Ð¥ì((€€€¥˜ …•±•µ•¹Ð¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€½¹ÍÐÁ½ÁÕÀ€ô(€€€€€€€‘½Õµ•¹Ð¹É•…Ñ•±•µ•¹Ð (€€€€€€€€€€€€‰‘¥Øˆ(€€€€€€€€¤ì(((€€€Á½ÁÕÀ¹±…ÍÍ9…µ”€ô(€€€€€€€€¼¨(€€€€€€€€€€ƒŠbƒ’þ»š¶¾ò#’úwžŸ’öÿžR£¢–n{–‚Ç¾ò3Ž3šB7–’Ä(€€€€€€€€€€ƒ¢†¦?¦†¿ž’ë¢º+š"C–r£¢†šŠw’â/¦v‹Ž7¾ò'¾òh(€€€€€€€€€€ƒžrš¶–:–nƒš&û–"Ã’êŠSŠS¦g¢Ž‡–ÂGš&O’ê(€€€€€€€€€€ƒž¦ëš‚ó¾ò0‰‘…µ…”µÁ½ÁÕÀ‹žnÓš:—š:”(€€€€€€€€€€€‰¡ÀµÁ½ÁÕÀ‹¢º+š"@(€€€€€€€€€€€‰‘…µ…”µÁ½ÁÕÁ¡ÀµÁ½ÁÕÀ‹¦gž¢¸(€€€€€€€€€€±…ÍÏ–Æ³šŸš‚çšr³’â7–¶c–r£žj–¶_’âË¾ò0(€€€€€€€€€€€¹‘…µ…”µÁ½ÁÕÃ¦
žÖMO¾ò!Á½Í¥Ñ¥½¸è(€€€€€€€€€€…‰Í½±ÕÑ”íÑ½ÀèÈØ—Š›Š›–:šr³¢¢·¢¢ (€€€€€€€€€€ƒš"C¦Ž–r£–6‡ž&’â·šº×Žš*¢÷–B7ž¢Ç¢Þ¢†šŠt(€€€€€€€€€€ƒ’â·¦ZO¾ò'–º3–£šÊK––_žR£–"Ã¾ò1Á½ÁÕÃ¢º+š"@(€€€€€€€€€€ƒ’â–/šÊKšr'’îï’öW–ºk’ö7š¢–ò?žjšf»¦h(€€€€€€€€€€€ñ‘¥Øû¾ò3–>«¢÷’æ[’æ[š:K–r¡…ÁÁ•¹‘¡¥± ¤(€€€€€€€€€€ƒšRû¦Ë–:ïžj–rÃšZç¾ò3’æ–ÂÇšb¿–6‡ž&šr’â/¦v‹Ž(€€€€€€€€€€ƒ¢†šŠt½MCšŠt¿–B7ž¢Ç¦÷š:K–º3’æ/–ú3Ž(€€€€€€€€€€ƒš¾?–-±…ÍÏ’æ/¦ZO¦÷¢Žs’â+ž¦ëš‚ó¾ò0(€€€€€€€€€€ƒ¢Þ–&7¦v‹Ž3š*¢÷š2'¦"WšVÓ–/’â7¢÷¦î{Ž4(€€€€€€€€€€ƒšb¿–B3’âž¢¹ÑåÁ¿¾ò3¦g–ÞËžÚOšb¿¦g–,(€€€€€€€€€€ƒšªSš†#¢Ž‡ž²³’â'š²‡š*O–"Ã–B3š¢žjšò?–¶\(€€€€€€€€€€‰ÕŸ’êŽ(€€€€€€€€¨¼((€€€€€€€€‰‘…µ…”µÁ½ÁÕÀ€ˆ¬(€€€€€€€€ (€€€€€€€€€€€ÑåÁ”ôôô‰ÍÀˆ(€€€€€€€€€€€€ü(€€€€€€€€€€€€‰ÍÀµÁ½ÁÕÀˆ(€€€€€€€€€€€€è(€€€€€€€€€€€ÑåÁ”ôôô‰¡•…°ˆ(€€€€€€€€€€€€ü(€€€€€€€€€€€€‰¡•…°µÁ½ÁÕÀˆ(€€€€€€€€€€€€è(€€€€€€€€€€€ÑåÁ”ôôô‰µ¥ÍÌˆ(€€€€€€€€€€€€ü(€€€€€€€€€€€€‰µ¥ÍÌµÁ½ÁÕÀˆ(€€€€€€€€€€€€è(€€€€€€€€€€€ÑåÁ”ôôô‰Í¡¥•±ˆ(€€€€€€€€€€€€ü(€€€€€€€€€€€€‰Í¡¥•±µÁ½ÁÕÀˆ(€€€€€€€€€€€€è(€€€€€€€€€€€€‰¡ÀµÁ½ÁÕÀˆ(€€€€€€€€¤¬(€€€€€€€€ (€€€€€€€€€€€¥ÍÉ¥Ð(€€€€€€€€€€€€ü(€€€€€€€€€€€€ˆÉ¥Ñ¥…°µÁ½ÁÕÀˆ(€€€€€€€€€€€€è(€€€€€€€€€€€€ˆˆ(€€€€€€€€¤ì(((€€€¥˜¡¥ÍÉ¥Ð¥ì(€€€€€€€€¼¨XÄÀÃ¾òkž"šN+šÖ»–¶_–>«’þwžVgŽ3ž"šN(€¬ƒ–
ß–ºÏšVã–¶_Ž7Ž(€€€€€€€€€€Í¡½ÝA±…å•É!¥Ð½Í¡½Ý5½¹ÍÑ•É!¥Ðƒ–
Ï¦Ë’úžjÑ•áÐƒ–>¿¢÷–B¬€·Ž!@½MC¾ò0(€€€€€€€€€€ƒ¦g¢Ž‡–>«š*÷–ëšVã–¶_–k¦†¿ž’ë¾òo’â7–öÇ¦~ÿ–¾›¦jo–
ß–ºÏ–óŽ€¨¼(€€€€€€€½¹ÍÐÉ¥Ñ¥…±9Õµ‰•É5…Ñ €ô(€€€€€€€€€€€MÑÉ¥¹œ¡Ñ•áÐ¤¹µ…Ñ  ½q¬ üép¹q¬¤ü¼¤ì((€€€€€€€Á½ÁÕÀ¹Ñ•áÑ½¹Ñ•¹Ð€ô(€€€€€€€€€€€€‹ž"šN(€ˆ¬(€€€€€€€€€€€€¡É¥Ñ¥…±9Õµ‰•É5…Ñ €üÉ¥Ñ¥…±9Õµ‰•É5…Ñ¡lÁt€èMÑÉ¥¹œ¡Ñ•áÐ¤¤ì(€€€õ•±Í•ì(€€€€€€€Á½ÁÕÀ¹Ñ•áÑ½¹Ñ•¹Ð€ôÑ•áÐì(€€€ô(((€€€¥˜¡¥ÍÉ¥Ð¥ì(€€€€€€€ÑÉ¥•ÉÉ¥Ñ¥…±%µÁ…Ð¡•±•µ•¹Ð¤ì(€€€ô(((€€€•±•µ•¹Ð¹…ÁÁ•¹‘¡¥± (€€€€€€€Á½ÁÕÀ(€€€€¤ì(((€€€Í•ÑQ¥µ•½ÕÐ  ¤ôùì((€€€€€€€¥˜ (€€€€€€€€€€€Á½ÁÕÀ€˜˜(€€€€€€€€€€€Á½ÁÕÀ¹Á…É•¹Ñ9½‘”(€€€€€€€€¥ì((€€€€€€€€€€€Á½ÁÕÀ¹Á…É•¹Ñ9½‘”¹É•µ½Ù•¡¥± (€€€€€€€€€€€€€€€Á½ÁÕÀ(€€€€€€€€€€€€¤ì((€€€€€€€ô((€€€ô°ÄàÀÀ¤ì()ô(((¼¨(€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò'¾òh(€€ƒ–Ãš^/’â¦Z–Â#–Æ³žj¦Žo¢†3–r[ž’ë¾ò3’öÿžR£¢’â+–
Ïžj(€€ƒ–r[ž&žnÓš:—¢ö'š"A‰…Í”ØÓ–Ÿ–Ö3–r£¦g¢Ž‡¾ò0(€€ƒ¢Þ¢žK¢&Ë–r[ž&¾ò!‰…ÑÑ±•A±…å•É…ÉÀ¼Çžj(€€‰…­É½Õ¹µ¥µ…—¾ò'žR£–B3’âž¢»–kšÎWŠSŠP(€€ƒ–Z»’â!Q53šªSš†#’â7’úw¢ÎÓ–’[¦£–r[ž&šªSš†#¾ò0(€€ƒ¢’¢Ž÷¦g–/šªSš†#–"Ã–"—žj–rÃšZç’æ’â7šršr$(€€ƒ–r[ž&¢Þ¿–úG–’ÇšV#Ž–r[ž&šÚ#–’Çžj–V?¦†3Ž(¨¼()½¹ÍÐ%}MA%9}AI=)Q%1}%5ô(€€€€‰…ÍÍ•ÑÌ½‰…ÑÑ±”½¥”µÍÁ¥¸µÁÉ½©•Ñ¥±”¹Ý•‰Àˆì(((¼¨(€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3–Ãš^/’â¦Z–Â#–Æ°(€€ƒšRïšN+–.WžV¯¾ò'¾òh(€€ƒ¢ºO’â+¦v‹¦
–ò×–r[–ú{šZ÷šÎW¢–6‡ž&¦Žo–"Ã¢Š¯š&O’â·žj(€€ƒš«ž&§–6‡ž&¾ò3’â·¦Sš^/¢ö'ŽšRû–’Ÿ¾ò3š*×¦SšfšÞ‡–ë¾ò0(€€ƒžVÛš"C¦g–/š*¢÷žjšRïšN+ž&çšV#Ž((€€ƒ¢Þ}Í¡½ÝM­¥±±9…µ•	…‘” §’âš¢š:o–r (€€‘½Õµ•¹Ð¹‰½‘ç–êW’â/ŽžR¡•Ñ	½Õ¹‘¥¹±¥•¹ÑI•Ð ¤(€€ƒ¦?–êŸš¢g¾ò3’â7žVÛ–6‡ž&žj–¶C–žÒƒ¾ò3¦ÿ–7¢Š¯–6‡ž&(€€ƒ¢«–ÞÇžjÑÉ…¹Í™½É·–.WžV¯–nÃ’ö?¾ò#–:–nƒ¢š,(€€Í¡½ÝM­¥±±9…µ•	…‘” §š^¦
+žj¢ª«šb;¾ò'Ž((€€…ÍÑ•É¡…É…Ñ•É%¹‘•ã¾òhÀ÷ž²³’â¢žK¢&ËŽ(€€€Ä÷ž²³’ê3¢žK¢&Ë¾ò3šÆë–ºk¦Žo¢†3¢Öß¦î{šb¿–N«–ò×ž:§–ºÛ–6‡Ž(€€Ñ…É•Ñ5½¹ÍÑ•É%¹‘•ã¾òk¦Žo¢†3žÖ¦î{šb¿–N«¦jïš«ž&§–6‡Ž((€€ƒ–>«¢Êƒ¢Ê³Ž3žV¯¦v‹’â+¦Žo’â’â/Ž7¾ò3’â7–k’îï’öW–
ß–ºÌ¼(€€ƒ–F÷’â·–"“–ºk¾ò3–Fó–>¯ž®¿¢¦Ëš&M5%MO¦
šb¿¢¦Ëš&¢†¾ò0(€€ƒ¢Þ¦g–/–÷–ò?–º3–£ž‡¦^s¾ò3–§’îÛ’ê/–"¦Z/¢fWžBŽ(¨¼()™Õ¹Ñ¥½¸Á±…å%•MÁ¥¹AÉ½©•Ñ¥±” (€€€…ÍÑ•É¡…É…Ñ•É%¹‘•à°(€€€Ñ…É•Ñ5½¹ÍÑ•É%¹‘•à(¥ì((€€€½¹ÍÐ…ÍÑ•É…Éô(€€€€€€€€ ‰‰…ÑÑ±•A±…å•É…Éˆ¬(€€€€€€€€€€€…ÍÑ•É¡…É…Ñ•É%¹‘•à(€€€€€€€€¤ì(((€€€½¹ÍÐÑ…É•Ñ…Éô(€€€€€€€€ ‰‰…ÑÑ±•5½¹ÍÑ•Èˆ¬(€€€€€€€€€€€Ñ…É•Ñ5½¹ÍÑ•É%¹‘•à(€€€€€€€€¤ì(((€€€¥˜ (€€€€€€€€……ÍÑ•É…Éñð(€€€€€€€€…Ñ…É•Ñ…É(€€€€¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€½¹ÍÐ…ÍÑ•ÉI•Ðô(€€€€€€€…ÍÑ•É…É¹•Ñ	½Õ¹‘¥¹±¥•¹ÑI•Ð ¤ì(((€€€½¹ÍÐÑ…É•ÑI•Ðô(€€€€€€€Ñ…É•Ñ…É¹•Ñ	½Õ¹‘¥¹±¥•¹ÑI•Ð ¤ì(((€€€½¹ÍÐÁÉ½©•Ñ¥±”ô(€€€€€€€‘½Õµ•¹Ð¹É•…Ñ•±•µ•¹Ð (€€€€€€€€€€€€‰¥µœˆ(€€€€€€€€¤ì(((€€€ÁÉ½©•Ñ¥±”¹ÍÉŒô(€€€€€€€%}MA%9}AI=)Q%1}%5ì((€€€ÁÉ½©•Ñ¥±”¹±…ÍÍ9…µ”ô(€€€€€€€€‰¥”µÍÁ¥¸µÁÉ½©•Ñ¥±”ˆì((€€€½¹ÍÐÍÑ…ÉÑA½¥¹Ð€ô(€€€€€€€…µ•A½¥¹ÑÉ½µ±¥•¹Ð (€€€€€€€€€€€…ÍÑ•ÉI•Ð¹±•™Ð¬(€€€€€€€€€€€…ÍÑ•ÉI•Ð¹Ý¥‘Ñ ¼È°(€€€€€€€€€€€…ÍÑ•ÉI•Ð¹Ñ½À¬(€€€€€€€€€€€…ÍÑ•ÉI•Ð¹¡•¥¡Ð¼È(€€€€€€€€¤ì((€€€½¹ÍÐ•¹‘A½¥¹Ð€ô(€€€€€€€…µ•A½¥¹ÑÉ½µ±¥•¹Ð (€€€€€€€€€€€Ñ…É•ÑI•Ð¹±•™Ð¬(€€€€€€€€€€€Ñ…É•ÑI•Ð¹Ý¥‘Ñ ¼È°(€€€€€€€€€€€Ñ…É•ÑI•Ð¹Ñ½À¬(€€€€€€€€€€€Ñ…É•ÑI•Ð¹¡•¥¡Ð¼È(€€€€€€€€¤ì((€€€ÁÉ½©•Ñ¥±”¹ÍÑå±”¹±•™Ðô(€€€€€€€ÍÑ…ÉÑA½¥¹Ð¹à¬‰Áàˆì((€€€ÁÉ½©•Ñ¥±”¹ÍÑå±”¹Ñ½Àô(€€€€€€€ÍÑ…ÉÑA½¥¹Ð¹ä¬‰Áàˆì((€€€½¹ÍÐ½Ù•É±…å1…å•È€ô(€€€€€€€€ ‰…µ”µ½Ù•É±…äµ±…å•Èˆ¤ñð(€€€€€€€‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ‰…µ”µÍÑ…”ˆ¤ì((€€€½Ù•É±…å1…å•È¹…ÁÁ•¹‘¡¥± (€€€€€€€ÁÉ½©•Ñ¥±”(€€€€¤ì(((€€€€¼¨(€€€€€€ƒŠbƒ–òß–"Û¢žãžfñÉ•™±½ß¾òh(€€€€€€ƒ¢Öß¦î{žj±•™Ð½Ñ½Ã–&o¢¢·–ºk–º3¾ò3ž?¢š÷–f£¦
šÊH(€€€€€€ƒžrš¶žV¯–ë¦g’â–æ¾ò3–ššzs¦š³’â+–r£–B3’â¢ò¨(€€€€€€ƒ’ê/’îÛ–ú«žJÃ¢Ž‡š*)±•™Ð½Ñ½ÃšRçš"CžÖ¦î{–êŸš¢g¾ò0(€€€€€€ÑÉ…¹Í¥Ñ¥½»šržnÓš:—¢ÞÏ¦;–:ïŽžr/’â7–"Ã¦Žo¢†0(€€€€€€ƒ¦;ž¢/ŽžR¡Ù½¥ÁÉ½©•Ñ¥±”¹½™™Í•Ñ]¥‘Ñ (€€€€€€ƒ–òß¢þ¯ž?¢š÷–f£–#žº_’âš²‡žn»–&7žjž&#¦v‹¾ò0(€€€€€€ƒžŠë¢ª7Ž3¢Öß¦î{Ž7–ÞËžÚOžRšV#¾ò3š:—’â/’ú(€€€€€€É•ÅÕ•ÍÑ¹¥µ…Ñ¥½¹É…µ—¢Ž‡šRçš"CžÖ¦î{–êŸš¢d(€€€€€€ƒš&7šržržj¢žãžfñÑÉ…¹Í¥Ñ¥½»–.WžV¯Ž(€€€€¨¼((€€€Ù½¥ÁÉ½©•Ñ¥±”¹½™™Í•Ñ]¥‘Ñ ì(((€€€É•ÅÕ•ÍÑ¹¥µ…Ñ¥½¹É…µ”  ¤ôùì((€€€€€€€ÁÉ½©•Ñ¥±”¹ÍÑå±”¹±•™Ðô(€€€€€€€€€€€•¹‘A½¥¹Ð¹à¬‰Áàˆì((€€€€€€€ÁÉ½©•Ñ¥±”¹ÍÑå±”¹Ñ½Àô(€€€€€€€€€€€•¹‘A½¥¹Ð¹ä¬‰Áàˆì((€€€€€€€ÁÉ½©•Ñ¥±”¹±…ÍÍ1¥ÍÐ¹…‘ (€€€€€€€€€€€€‰…ÉÉ¥Ù•ˆ(€€€€€€€€¤ì((€€€ô¤ì(((€€€Í•ÑQ¥µ•½ÕÐ  ¤ôùì((€€€€€€€¥˜ (€€€€€€€€€€€ÁÉ½©•Ñ¥±”€˜˜(€€€€€€€€€€€ÁÉ½©•Ñ¥±”¹Á…É•¹Ñ9½‘”(€€€€€€€€¥ì((€€€€€€€€€€€ÁÉ½©•Ñ¥±”¹Á…É•¹Ñ9½‘”¹É•µ½Ù•¡¥± (€€€€€€€€€€€€€€€ÁÉ½©•Ñ¥±”(€€€€€€€€€€€€¤ì((€€€€€€€ô((€€€ô°ÔÀÀ¤ì()ô(((¼¨(€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3ž¯žº·š*¢÷žj(€€ƒ’â'žfó¦Žo¢†3ž&çšV#¾ò3žÒQML½)O–.WžV¯¾ò'¾òh(€€Í½ÕÉ•…É‘%“šb¿šZ÷šÎW¢žj–6‡ž&=4¥(€€ƒ¾ò#’ú/–š‰‰…ÑÑ±•A±…å•É…ÉÀ‹¾ò'¾ò0(€€Ñ…É•Ñ%¹‘•á•Ïšb¿¦gš²‡ž¯žº·–¾›¦još&O’â·žj(€€ƒš«ž&§žÒ‹–òW¦f–"_¾ò#šr–’hÏ–/¾ò3–Â7š'’â´¿–Þ˜¿–>Ï¾ò'Ž((€€ƒš¾?’âžfóž¯žº·¾òh(€€€Ä¸ƒ–ú{šZ÷šÎW¢–6‡ž&’â·–þ–ëžfó¾ò3žR (€€€€€•±•µ•¹Ð¹…¹¥µ…Ñ” §¾ò!]•ˆ¹¥µ…Ñ¥½¹Ì(€€€€€A'¾ò'¦Žo–BGžn»š¢g–6‡ž&’â·–þ¾ò3¦Žo¢†3¦;ž¢/’â´(€€€€€ƒšr³¦®Sšr’úw¦Žo¢†3šZç–BG¢«–.Wš^/¢ö'¾ò3žr/¢Öß’ú(€€€€€ƒ–?žržjšrwžn»š¢g¦Žo¦;–:ï¾ò3’â7šb¿š¶ïšvÿ–rÀ(€€€€€ƒ–æÏžžïŽ(€€€È¸ƒ–"Ã¦Sžjžz³¦ZO¾ò3ž¯žº·šr³¦®SšÚ#–’Ç¾ò3–:–rÀ(€€€€€ƒž
ã¦Z/’â–Â?žú“ž¯¢*ÇžÊK–¶C¾ò ã¦†¾ò3–B¢«–ú (€€€€€ƒ’â7–B3¢žK–ê›–fÓ–Â–7šÞ‡–ë¾ò'Ž(€€€Ì¸ƒ’â'žfó’æ/¦ZOšVš?–*ƒ’â¦î{¦î{šf¦ZO–Þ¸(€€€€€ƒ¾ò#š¾?žfó¦ZO¦jPàÁµÏš&7žfó–Â¾ò'¾ò3’â7šr’â'žfð(€€€€€ƒžr/¢Öß’ú–?–B3’âžfó¢’¢Ž÷¢Êó’â+¾ò3š¾S¢òšr$(€€€€€ƒŽ3¦žê3žfó–ÂŽ7žjž¾––?šŽ((€€ƒš&šr'–.Wš/žRš"Cžj=7–žÒƒ–.WžV¯šJ·–º3¦÷šr(€€ƒ¢«–ÞÇžžï¦f“¾ò3’â7šržVg–r£žV¯¦v‹’â+žÒ¿ž¦7Ž(¨¼((¼¨(€€ƒŠbƒ’þ»š¶¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3š«ž&§žR£ž¯žº´(€€ƒšRïšN+ž:§–ºÛšf’æ¢ššr'–B3š¢žj¦Žo¢†3ž&çšV#¾ò'¾òh(€€ƒ–:šr³¦g¢Ž‡–>«š:—–>_Ž3š«ž&§žÒ‹–òW¦f–"_Ž7¾ò0(€€ƒ–¾¯š¶ïžÖ–è‰‰…ÑÑ±•5½¹ÍÑ•Èˆ­¥¹‘•ã–:ïš&ø(€€ƒžn»š¢g–žÒƒ¾ò3–>«¢÷žR£–r£Ž3ž:§–ºÛ–Âš«ž&§Ž7¦g–,(€€ƒšZç–BGŽšRçš"CžnÓš:—š:—–>_Ž3žn»š¢e=4¥“žj¦f–"_Ž7¾ò0(€€ƒš&Ož:§–ºÛ¾ò ‰‰…ÑÑ±•A±…å•É…Éˆ­¥¹‘•ã¾ò$(€€ƒ¢Þš&Oš«ž&§¾ò ‰‰…ÑÑ±•5½¹ÍÑ•Èˆ­¥¹‘•ã¾ò$(€€ƒ–§ž¢»šZç–BG¦÷¢÷–ÇžR£–B3’â––_–.WžV¯¦
?¢ò¿¾ò3’â7žR (€€ƒ–¾¯–§’î÷–æû’æ;’âš¢žjž¢/–ò?žŠóŽ(¨¼()™Õ¹Ñ¥½¸Á±…å¥É•I½­•Ñ¹¥µ…Ñ¥½¸ (€€€Í½ÕÉ•…É‘%°(€€€Ñ…É•Ñ±•µ•¹Ñ%‘Ì(¥ì((€€€½¹ÍÐÍ½ÕÉ•°ô(€€€€€€€€¡Í½ÕÉ•…É‘%¤ì(((€€€¥˜ …Í½ÕÉ•°¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€½¹ÍÐÍ½ÕÉ•I•Ðô(€€€€€€€Í½ÕÉ•°¹•Ñ	½Õ¹‘¥¹±¥•¹ÑI•Ð ¤ì((€€€½¹ÍÐÍ½ÕÉ•A½¥¹Ð€ô(€€€€€€€…µ•A½¥¹ÑÉ½µ±¥•¹Ð (€€€€€€€€€€€Í½ÕÉ•I•Ð¹±•™Ð¬(€€€€€€€€€€€Í½ÕÉ•I•Ð¹Ý¥‘Ñ ¼È°(€€€€€€€€€€€Í½ÕÉ•I•Ð¹Ñ½À¬(€€€€€€€€€€€Í½ÕÉ•I•Ð¹¡•¥¡Ð¼È(€€€€€€€€¤ì((€€€½¹ÍÐÍÑ…ÉÑ`€ô(€€€€€€€Í½ÕÉ•A½¥¹Ð¹àì((€€€½¹ÍÐÍÑ…ÉÑd€ô(€€€€€€€Í½ÕÉ•A½¥¹Ð¹äì(((€€€Ñ…É•Ñ±•µ•¹Ñ%‘Ì¹™½É…  (€€€€€€€€¡Ñ…É•Ñ±•µ•¹Ñ%±¤¤ôùì((€€€€€€€€€€€Í•ÑQ¥µ•½ÕÐ  ¤ôùì((€€€€€€€€€€€€€€€™¥É•=¹•I½­•Ð (€€€€€€€€€€€€€€€€€€€ÍÑ…ÉÑ`°(€€€€€€€€€€€€€€€€€€€ÍÑ…ÉÑd°(€€€€€€€€€€€€€€€€€€€Ñ…É•Ñ±•µ•¹Ñ%(€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€ô±¤¨àÀ¤ì((€€€€€€€ô(€€€€¤ì()ô(()™Õ¹Ñ¥½¸™¥É•=¹•I½­•Ð (€€€ÍÑ…ÉÑ`°(€€€ÍÑ…ÉÑd°(€€€Ñ…É•Ñ±•µ•¹Ñ%(¥ì((€€€½¹ÍÐÑ…É•Ñ°ô(€€€€€€€€¡Ñ…É•Ñ±•µ•¹Ñ%¤ì(((€€€¥˜ …Ñ…É•Ñ°¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€½¹ÍÐÑ…É•ÑI•Ðô(€€€€€€€Ñ…É•Ñ°¹•Ñ	½Õ¹‘¥¹±¥•¹ÑI•Ð ¤ì((€€€½¹ÍÐÑ…É•ÑA½¥¹Ð€ô(€€€€€€€…µ•A½¥¹ÑÉ½µ±¥•¹Ð (€€€€€€€€€€€Ñ…É•ÑI•Ð¹±•™Ð¬(€€€€€€€€€€€Ñ…É•ÑI•Ð¹Ý¥‘Ñ ¼È°(€€€€€€€€€€€Ñ…É•ÑI•Ð¹Ñ½À¬(€€€€€€€€€€€Ñ…É•ÑI•Ð¹¡•¥¡Ð¼È(€€€€€€€€¤ì((€€€½¹ÍÐ•¹‘`€ô(€€€€€€€Ñ…É•ÑA½¥¹Ð¹àì((€€€½¹ÍÐ•¹‘d€ô(€€€€€€€Ñ…É•ÑA½¥¹Ð¹äì(((€€€½¹ÍÐ…¹±••œô((€€€€€€€5…Ñ ¹…Ñ…¸È (€€€€€€€€€€€•¹‘dµÍÑ…ÉÑd°(€€€€€€€€€€€•¹‘`µÍÑ…ÉÑ`(€€€€€€€€¤¨(€€€€€€€€ÄàÀ½5…Ñ ¹A$ì(((€€€½¹ÍÐÉ½­•Ðô(€€€€€€€‘½Õµ•¹Ð¹É•…Ñ•±•µ•¹Ð ‰‘¥Øˆ¤ì((€€€É½­•Ð¹±…ÍÍ9…µ”ô(€€€€€€€€‰™¥É”µÉ½­•ÐµÁÉ½©•Ñ¥±”ˆì((€€€É½­•Ð¹ÍÑå±”¹±•™Ðô(€€€€€€€ÍÑ…ÉÑ`¬‰Áàˆì((€€€É½­•Ð¹ÍÑå±”¹Ñ½Àô(€€€€€€€ÍÑ…ÉÑd¬‰Áàˆì((€€€É½­•Ð¹ÍÑå±”¹ÑÉ…¹Í™½É´ô((€€€€€€€€‰ÑÉ…¹Í±…Ñ” ´ÔÀ”°´ÔÀ”¤É½Ñ…Ñ” ˆ¬(€€€€€€€…¹±••œ¬(€€€€€€€€‰‘•œ¤ˆì(((€€€½¹ÍÐ½Ù•É±…å1…å•È€ô(€€€€€€€€ ‰…µ”µ½Ù•É±…äµ±…å•Èˆ¤ñð(€€€€€€€‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ‰…µ”µÍÑ…”ˆ¤ì((€€€½Ù•É±…å1…å•È¹…ÁÁ•¹‘¡¥± (€€€€€€€É½­•Ð(€€€€¤ì(((€€€½¹ÍÐ™±¥¡Ñ5Ìô(€€€€€€€€ÐÈÀì(((€€€½¹ÍÐ…¹¥´ô((€€€€€€€É½­•Ð¹…¹¥µ…Ñ” (€€€€€€€€€€€l(€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€±•™ÐéÍÑ…ÉÑ`¬‰Áàˆ°(€€€€€€€€€€€€€€€€€€€Ñ½ÀéÍÑ…ÉÑd¬‰Áàˆ°(€€€€€€€€€€€€€€€€€€€½™™Í•ÐèÀ(€€€€€€€€€€€€€€€ô°(€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€±•™Ðé•¹‘`¬‰Áàˆ°(€€€€€€€€€€€€€€€€€€€Ñ½Àé•¹‘d¬‰Áàˆ°(€€€€€€€€€€€€€€€€€€€½™™Í•ÐèÄ(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€t°(€€€€€€€€€€€ì(€€€€€€€€€€€€€€€‘ÕÉ…Ñ¥½¸é™±¥¡Ñ5Ì°(€€€€€€€€€€€€€€€•…Í¥¹œè‰•…Í”µ¥¸ˆ(€€€€€€€€€€€ô(€€€€€€€€¤ì(((€€€…¹¥´¹½¹™¥¹¥Í ô ¤ôùì((€€€€€€€É½­•Ð¹É•µ½Ù” ¤ì(((€€€€€€€ÍÁ…Ý¹¥É•MÁ…É­	ÕÉÍÐ (€€€€€€€€€€€•¹‘`°(€€€€€€€€€€€•¹‘d(€€€€€€€€¤ì((€€€ôì()ô(()™Õ¹Ñ¥½¸ÍÁ…Ý¹¥É•MÁ…É­	ÕÉÍÐ (€€€à°(€€€ä(¥ì((€€€½¹ÍÐÍÁ…É­½Õ¹Ðô(€€€€€€€€àì((€€€™½È (€€€€€€€±•Ð¤ôÀì(€€€€€€€¤ñÍÁ…É­½Õ¹Ðì(€€€€€€€¤¬¬(€€€€¥ì((€€€€€€€½¹ÍÐÍÁ…É¬ô(€€€€€€€€€€€‘½Õµ•¹Ð¹É•…Ñ•±•µ•¹Ð ‰‘¥Øˆ¤ì((€€€€€€€ÍÁ…É¬¹±…ÍÍ9…µ”ô(€€€€€€€€€€€€‰™¥É”µÉ½­•ÐµÍÁ…É¬ˆì((€€€€€€€ÍÁ…É¬¹ÍÑå±”¹±•™Ðô(€€€€€€€€€€€à¬‰Áàˆì((€€€€€€€ÍÁ…É¬¹ÍÑå±”¹Ñ½Àô(€€€€€€€€€€€ä¬‰Áàˆì(((€€€€€€€‘½Õµ•¹Ð¹‰½‘ä¹…ÁÁ•¹‘¡¥± (€€€€€€€€€€€ÍÁ…É¬(€€€€€€€€¤ì(((€€€€€€€½¹ÍÐ…¹±”ô((€€€€€€€€€€€€ (€€€€€€€€€€€€€€€5…Ñ ¹A$¨È©¤¼(€€€€€€€€€€€€€€€ÍÁ…É­½Õ¹Ð(€€€€€€€€€€€€¤¬(€€€€€€€€€€€€¡5…Ñ ¹É…¹‘½´ ¤¨À¸Ô¤ì(((€€€€€€€½¹ÍÐ‘¥ÍÑ…¹”ô((€€€€€€€€€€€€Äà¬(€€€€€€€€€€€5…Ñ ¹É…¹‘½´ ¤¨ÄØì(((€€€€€€€½¹ÍÐÍÁÉ•…ô((€€€€€€€€€€€ÍÁ…É¬¹…¹¥µ…Ñ” (€€€€€€€€€€€€€€€l(€€€€€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€€€€€±•™Ðéà¬‰Áàˆ°(€€€€€€€€€€€€€€€€€€€€€€€Ñ½Àéä¬‰Áàˆ°(€€€€€€€€€€€€€€€€€€€€€€€½Á…¥ÑäèÄ°(€€€€€€€€€€€€€€€€€€€€€€€½™™Í•ÐèÀ(€€€€€€€€€€€€€€€€€€€ô°(€€€€€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€€€€€±•™Ðè(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€à¬(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€5…Ñ ¹½Ì¡…¹±”¤©‘¥ÍÑ…¹”(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤¬‰Áàˆ°(€€€€€€€€€€€€€€€€€€€€€€€Ñ½Àè(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ä¬(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€5…Ñ ¹Í¥¸¡…¹±”¤©‘¥ÍÑ…¹”(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤¬‰Áàˆ°(€€€€€€€€€€€€€€€€€€€€€€€½Á…¥ÑäèÀ°(€€€€€€€€€€€€€€€€€€€€€€€½™™Í•ÐèÄ(€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€t°(€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€‘ÕÉ…Ñ¥½¸èÌàÀ°(€€€€€€€€€€€€€€€€€€€•…Í¥¹œè‰•…Í”µ½ÕÐˆ(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€¤ì(((€€€€€€€ÍÁÉ•…¹½¹™¥¹¥Í ô ¤ôùì((€€€€€€€€€€€ÍÁ…É¬¹É•µ½Ù” ¤ì((€€€€€€€ôì((€€€ô()ô(()™Õ¹Ñ¥½¸™¥¹‘	…ÑÑ±•M­¥±±	åAÉ•Í•¹Ñ…Ñ¥½¸¡Í­¥±±9…µ”±•±•µ•¹ÑQåÁ”¥ì(€€€¥˜¡ÑåÁ•½˜Í­¥±±…Ñ…‰…Í”ôôô‰Õ¹‘•™¥¹•ˆ¥ìÉ•ÑÕÉ¸¹Õ±°ìô(€€€½¹ÍÐ¥‘Ìõ=‰©•Ð¹­•åÌ¡Í­¥±±…Ñ…‰…Í”¤ì(€€€™½È¡±•Ð¥¹‘•àôÀí¥¹‘•àñ¥‘Ì¹±•¹Ñ í¥¹‘•à¬¬¥ì(€€€€€€€½¹ÍÐÍ­¥±°õÍ­¥±±…Ñ…‰…Í•m¥‘Ím¥¹‘•áutì(€€€€€€€¥˜ (€€€€€€€€€€€Í­¥±°˜™Í­¥±°¹¹…µ”ôôõÍ­¥±±9…µ”˜˜(€€€€€€€€€€€€ …•±•µ•¹ÑQåÁ•ñð…Í­¥±°¹•±•µ•¹ÑññÍ­¥±°¹•±•µ•¹Ðôôõ•±•µ•¹ÑQåÁ”¤(€€€€€€€€¥ì(€€€€€€€€€€€É•ÑÕÉ¸Í­¥±°ì(€€€€€€€ô(€€€ô(€€€É•ÑÕÉ¸¹Õ±°ì)ô()™Õ¹Ñ¥½¸…Ñ¥Ù•	…ÑÑ±•Q…É•Ñ%‘Ì¡Í¥‘”±¥¹±Õ‘••™•…Ñ•¥ì(€€€¥˜¡Í¥‘”ôôô‰µ½¹ÍÑ•Èˆ¥ì(€€€€€€€É•ÑÕÉ¸€¡ÉÉ…ä¹¥ÍÉÉ…ä¡ÕÉÉ•¹Ñ	…ÑÑ±•5½¹ÍÑ•ÉÌ¤ýÕÉÉ•¹Ñ	…ÑÑ±•5½¹ÍÑ•ÉÌémt¤¹™¥±Ñ•È¡¥¹‘•àôùì(€€€€€€€€€€€½¹ÍÐµ½¹ÍÑ•Èõµ½¹ÍÑ•ÉÍm¥¹‘•átì(€€€€€€€€€€€É•ÑÕÉ¸€„„¡µ½¹ÍÑ•È˜˜¡¥¹±Õ‘••™•…Ñ•‘ññµ½¹ÍÑ•È¹…±¥Ù”„ôõ™…±Í”˜™9Õµ‰•È¡µ½¹ÍÑ•È¹¡À¤øÀ¤¤ì(€€€€€€€ô¤ì(€€€ô(€€€É•ÑÕÉ¸•Ñá¥ÍÑ¥¹A…ÉÑå%¹‘•á•Ì ¤¹™¥±Ñ•È¡¥¹‘•àôùì(€€€€€€€½¹ÍÐ¡…É…Ñ•Èõ•ÑA…ÉÑå¡…É…Ñ•É	å%¹‘•à¡¥¹‘•à¤ì(€€€€€€€É•ÑÕÉ¸€„„¡¡…É…Ñ•È˜˜¡¥¹±Õ‘••™•…Ñ•‘ññ9Õµ‰•È¡¡…É…Ñ•È¹¡À¤øÀ¤¤ì(€€€ô¤ì)ô((¼¨½µ‰…Ð½Ý¹ÌÑ…É•ÐÍ•±•Ñ¥½¸¸Q¡¥Ì½¹ÑÉ…Ð¥ÌÉ•…Ñ•‰•™½É”XÄÐÈ½XÄÐÌÍ•”(€€Ñ¡”…ÍÐ°Í¼Ñ¡”Y`ÉÕ¹Ñ¥µ”¹•Ù•ÈÉ•…‘ÌÑ¡”…Ñ¥½¸ÅÕ•Õ”°¡¥Ð½É‘•È½È±¥Ù”(€€ÍÕÉÙ¥Ù½È‰½Õ¹‘ÌÑ¼Õ•ÍÌ¥ÑÌÁÉ¥µ…ÉäÑ…É•Ð½ÈÍ•µ…¹Ñ¥Œ™½½ÑÁÉ¥¹Ð¸€¨¼)™Õ¹Ñ¥½¸É•…Ñ•	…ÑÑ±•Q…É•Ñ½¹ÑÉ…Ð¡Í¥‘”±Í­¥±±9…µ”±•±•µ•¹ÑQåÁ”±…Ñ½É%¹‘•à±Ñ…É•Ñ%±Ñ…É•Ñ%‘Ì±Ñ…É•ÑM¥‘•=Ù•ÉÉ¥‘”±Ñ…É•ÑQåÁ•=Ù•ÉÉ¥‘”¥ì(€€€½¹ÍÐÍ­¥±°õÍ­¥±±9…µ”ôôô‹šf»¦kšRïšN(ˆ(€€€€€€€€ýí¥è‰¹½Éµ…°ˆ±Ñ…É•ÑQåÁ”è‰Í¥¹±”ˆ±…Ñ•½Éäè‰Á¡åÍ¥…°‰ô(€€€€€€€€é™¥¹‘	…ÑÑ±•M­¥±±	åAÉ•Í•¹Ñ…Ñ¥½¸¡Í­¥±±9…µ”±•±•µ•¹ÑQåÁ”¤ì(€€€½¹ÍÐÑ…É•ÑQåÁ”õMÑÉ¥¹œ¡Ñ…É•ÑQåÁ•=Ù•ÉÉ¥‘•ññÍ­¥±°˜™Í­¥±°¹Ñ…É•ÑQåÁ•ñð‰Í¥¹±”ˆ¤ì(€€€½¹ÍÐÍ…µ•M¥‘”ô½…±±ä½¤¹Ñ•ÍÐ¡Ñ…É•ÑQåÁ”¥ñð½¡•…±ñÉ•Ù¥Ù•ñ‰Õ™˜¼¹Ñ•ÍÐ¡MÑÉ¥¹œ¡Í­¥±°˜™Í­¥±°¹…Ñ•½Éåñðˆˆ¤¤ì(€€€½¹ÍÐÑ…É•ÑM¥‘”õÑ…É•ÑM¥‘•=Ù•ÉÉ¥‘”ôôô‰Á±…å•È‰ññÑ…É•ÑM¥‘•=Ù•ÉÉ¥‘”ôôô‰µ½¹ÍÑ•Èˆ(€€€€€€€€ýÑ…É•ÑM¥‘•=Ù•ÉÉ¥‘”(€€€€€€€€è¡Í…µ•M¥‘”ýÍ¥‘”è¡Í¥‘”ôôô‰Á±…å•Èˆü‰µ½¹ÍÑ•Èˆè‰Á±…å•Èˆ¤¤ì(€€€½¹ÍÐ•áÁ±¥¥Ñ%‘ÌõÉÉ…ä¹¥ÍÉÉ…ä¡Ñ…É•Ñ%‘Ì¤ýÑ…É•Ñ%‘Ì¹Í±¥” ¤émtì(€€€±•ÐÁÉ¥µ…ÉäõÑ…É•Ñ%„ôõÕ¹‘•™¥¹•˜™Ñ…É•Ñ%„ôõ¹Õ±°ýÑ…É•Ñ%é¹Õ±°ì(€€€±•Ð¥‘Ìõ•áÁ±¥¥Ñ%‘Ìì((€€€¥˜¡Ñ…É•ÑQåÁ”ôôô‰Í•±˜ˆ¥ì(€€€€€€€ÁÉ¥µ…Éäõ…Ñ½É%¹‘•àì(€€€€€€€¥‘Ìõm…Ñ½É%¹‘•átì(€€€ô((€€€¥˜ …¥‘Ì¹±•¹Ñ ¥ì(€€€€€€€±•ÐÅÕ•Õ•õ¹Õ±°ì(€€€€€€€¥˜¡Í¥‘”ôôô‰Á±…å•Èˆ˜™ÑåÁ•½˜ÅÕ•Õ•‘A±…å•ÉÑ¥½¹Ì„ôô‰Õ¹‘•™¥¹•ˆ¥ì(€€€€€€€€€€€ÅÕ•Õ•õÅÕ•Õ•‘A±…å•ÉÑ¥½¹Ì˜™ÅÕ•Õ•‘A±…å•ÉÑ¥½¹Ím…Ñ½É%¹‘•átì(€€€€€€€ô(€€€€€€€¥˜¡ÁÉ¥µ…Éäôôõ¹Õ±°˜™ÅÕ•Õ•¥ì(€€€€€€€€€€€ÁÉ¥µ…ÉäõÑ…É•ÑM¥‘”ôôô‰µ½¹ÍÑ•ÈˆýÅÕ•Õ•¹Ñ…É•ÐéÅÕ•Õ•¹Ñ…É•Ñ±±äì(€€€€€€€ô(€€€€€€€¥˜¡ÁÉ¥µ…Éäôôõ¹Õ±°˜™Í¥‘”ôôô‰Á±…å•Èˆ˜™Ñ…É•ÑM¥‘”ôôô‰µ½¹ÍÑ•Èˆ˜™ÑåÁ•½˜Í•±•Ñ•‘5½¹ÍÑ•È„ôô‰Õ¹‘•™¥¹•ˆ¥ì(€€€€€€€€€€€ÁÉ¥µ…ÉäõÍ•±•Ñ•‘5½¹ÍÑ•Èì(€€€€€€€ô((€€€€€€€¥˜¡Ñ…É•ÑQåÁ”ôôô‰…±°‰ññÑ…É•ÑQåÁ”ôôô‰…±±å±°ˆ¥ì(€€€€€€€€€€€¥‘Ìõ…Ñ¥Ù•	…ÑÑ±•Q…É•Ñ%‘Ì¡Ñ…É•ÑM¥‘”±™…±Í”¤ì(€€€€€€€õ•±Í”¥˜¡Ñ…É•ÑM¥‘”ôôô‰µ½¹ÍÑ•Èˆ˜™9Õµ‰•È¹¥Í%¹Ñ••È¡ÁÉ¥µ…Éä¤˜˜½x¡ÑÉ¥ñÉ½Ýñ½±Õµ¹ñ¡½É¥é½¹Ñ…°´Ì¤½¤¹Ñ•ÍÐ¡Ñ…É•ÑQåÁ”¤¥ì(€€€€€€€€€€€¥‘ÌõÑåÁ•½˜•ÑM­¥±±Q…É•ÑÌôôô‰™Õ¹Ñ¥½¸ˆý•ÑM­¥±±Q…É•ÑÌ¡ÁÉ¥µ…Éä±Ñ…É•ÑQåÁ”¤émÁÉ¥µ…Éåtì(€€€€€€€õ•±Í”¥˜¡Ñ…É•ÑM¥‘”ôôô‰Á±…å•Èˆ˜™9Õµ‰•È¹¥Í%¹Ñ••È¡ÁÉ¥µ…Éä¤˜˜½x¡ÑÉ¥ñ…±±åQÉ¥ñÉ½Ýñ½±Õµ¸¤½¤¹Ñ•ÍÐ¡Ñ…É•ÑQåÁ”¤¥ì(€€€€€€€€€€€½¹ÍÐ½Ý¹•ÈõÑåÁ•½˜Ý¥¹‘½Ü„ôô‰Õ¹‘•™¥¹•ˆýÝ¥¹‘½Ü¹½ÕÉMåµ‰½±Í	…ÑÑ±•™¥•±‘M±½ÑÌé¹Õ±°ì(€€€€€€€€€€€½¹ÍÐ™½Éµ…Ñ¥½¸õ½Ý¹•È˜™ÑåÁ•½˜½Ý¹•È¹•¹ÍÕÉ•±±å½Éµ…Ñ¥½¸ôôô‰™Õ¹Ñ¥½¸ˆ(€€€€€€€€€€€€€€€€ý½Ý¹•È¹•¹ÍÕÉ•±±å½Éµ…Ñ¥½¸¡•Ñá¥ÍÑ¥¹A…ÉÑå%¹‘•á•Ì ¤¤é¹Õ±°ì(€€€€€€€€€€€¥‘Ìõ™½Éµ…Ñ¥½¸˜™ÑåÁ•½˜½Ý¹•È¹É•Í½±Ù•±±åQ…É•ÑÌôôô‰™Õ¹Ñ¥½¸ˆ(€€€€€€€€€€€€€€€€ý½Ý¹•È¹É•Í½±Ù•±±åQ…É•ÑÌ¡™½Éµ…Ñ¥½¸±ÁÉ¥µ…Éä±Ñ…É•ÑQåÁ”±¥¹‘•àôùì(€€€€€€€€€€€€€€€€€€€½¹ÍÐ¡…É…Ñ•Èõ•ÑA…ÉÑå¡…É…Ñ•É	å%¹‘•à¡¥¹‘•à¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸€„„¡¡…É…Ñ•È˜™9Õµ‰•È¡¡…É…Ñ•È¹¡À¤øÀ¤ì(€€€€€€€€€€€€€€€ô¤émÁÉ¥µ…Éåtì(€€€€€€€õ•±Í”¥˜¡ÁÉ¥µ…Éä„ôõ¹Õ±°˜™ÁÉ¥µ…Éä„ôõÕ¹‘•™¥¹•¥ì(€€€€€€€€€€€¥‘ÌõmÁÉ¥µ…Éåtì(€€€€€€€õ•±Í”¥˜¡Í…µ•M¥‘”¥ì(€€€€€€€€€€€¥‘Ìõ…Ñ¥Ù•	…ÑÑ±•Q…É•Ñ%‘Ì¡Ñ…É•ÑM¥‘”±™…±Í”¤ì(€€€€€€€€€€€ÁÉ¥µ…Éäõ¥‘Ì¹±•¹Ñ ý¥‘ÍlÁté¹Õ±°ì(€€€€€€€ô(€€€ô((€€€¥‘ÌõÉÉ…ä¹™É½´¡¹•ÜM•Ð¡¥‘Ì¹™¥±Ñ•È¡9Õµ‰•È¹¥Í%¹Ñ••È¤¤¤ì(€€€¥˜¡Ñ…É•ÑQåÁ”ôôô‰…±°‰ññÑ…É•ÑQåÁ”ôôô‰…±±å±°ˆ¥ìÁÉ¥µ…Éäõ¹Õ±°ìô(€€€•±Í”¥˜¡ÁÉ¥µ…Éäôôõ¹Õ±°˜™¥‘Ì¹±•¹Ñ ¥ìÁÉ¥µ…Éäõ¥‘ÍlÁtìô((€€€É•ÑÕÉ¸=‰©•Ð¹™É••é”¡ì(€€€€€€€Ù•ÉÍ¥½¸è‰‰…ÑÑ±”µÑ…É•Ðµ½¹ÑÉ…ÐµØÄˆ°(€€€€€€€Í¥‘”éÍ¥‘”°(€€€€€€€Ñ…É•ÑM¥‘”éÑ…É•ÑM¥‘”°(€€€€€€€Ñ…É•ÑQåÁ”éÑ…É•ÑQåÁ”°(€€€€€€€…Ñ½É%¹‘•àé9Õµ‰•È¹¥Í%¹Ñ••È¡…Ñ½É%¹‘•à¤ý…Ñ½É%¹‘•àèÀ°(€€€€€€€Ñ…É•Ñ%éÁÉ¥µ…Éä°(€€€€€€€Ñ…É•Ñ%‘Ìé=‰©•Ð¹™É••é”¡¥‘Ì¹Í±¥” ¤¤(€€€ô¤ì)ô()Ý¥¹‘½Ü¹½ÕÉMåµ‰½±Í	…ÑÑ±•Q…É•Ñ½¹ÑÉ…Ðõ=‰©•Ð¹™É••é”¡ì(€€€Ù•ÉÍ¥½¸è‰‰…ÑÑ±”µÑ…É•Ðµ½¹ÑÉ…ÐµØÄˆ°(€€€É•…Ñ”éÉ•…Ñ•	…ÑÑ±•Q…É•Ñ½¹ÑÉ…Ð)ô¤ì()™Õ¹Ñ¥½¸•ÑM­¥±±9…µ•	…‘•ÕÉ…Ñ¥½¸¡Í­¥±±9…µ”±•±•µ•¹ÑQåÁ”¥ì((€€€¥˜ (€€€€€€€ÑåÁ•½˜Ý¥¹‘½Ü„ôô‰Õ¹‘•™¥¹•ˆ€˜˜(€€€€€€€ÑåÁ•½˜Ý¥¹‘½Ü¹ØÄÐÉ•ÑM­¥±±9…µ•¥ÍÁ±…åÕÉ…Ñ¥½¸ôôô‰™Õ¹Ñ¥½¸ˆ(€€€€¥ì(€€€€€€€½¹ÍÐ‘ÕÉ…Ñ¥½¸ô(€€€€€€€€€€€9Õµ‰•È (€€€€€€€€€€€€€€€Ý¥¹‘½Ü¹ØÄÐÉ•ÑM­¥±±9…µ•¥ÍÁ±…åÕÉ…Ñ¥½¸ (€€€€€€€€€€€€€€€€€€€Í­¥±±9…µ”°(€€€€€€€€€€€€€€€€€€€•±•µ•¹ÑQåÁ”(€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€¤ì((€€€€€€€¥˜¡9Õµ‰•È¹¥Í¥¹¥Ñ”¡‘ÕÉ…Ñ¥½¸¤€˜˜‘ÕÉ…Ñ¥½¸øÀ¥ì(€€€€€€€€€€€É•ÑÕÉ¸5…Ñ ¹É½Õ¹¡‘ÕÉ…Ñ¥½¸¤ì(€€€€€€€ô(€€€ô((€€€É•ÑÕÉ¸5…Ñ ¹É½Õ¹ ÔÈÀ¨È¼Ì¤ì)ô(()™Õ¹Ñ¥½¸Í¡½ÝM­¥±±9…µ•	…‘”¡Í­¥±±9…µ”±•±•µ•¹ÑQåÁ”±¡…É…Ñ•É%¹‘•à±Ñ…É•Ñ%±Ñ…É•Ñ%‘Ì±Ñ…É•ÑM¥‘”±Ñ…É•ÑQåÁ•=Ù•ÉÉ¥‘”¥ì((€€€½¹ÍÐÑ…É•Ñ½¹ÑÉ…ÐõÉ•…Ñ•	…ÑÑ±•Q…É•Ñ½¹ÑÉ…Ð (€€€€€€€€‰Á±…å•Èˆ±Í­¥±±9…µ”±•±•µ•¹ÑQåÁ”±9Õµ‰•È¹¥Í%¹Ñ••È¡¡…É…Ñ•É%¹‘•à¤ý¡…É…Ñ•É%¹‘•àèÀ±Ñ…É•Ñ%±Ñ…É•Ñ%‘Ì±Ñ…É•ÑM¥‘”±Ñ…É•ÑQåÁ•=Ù•ÉÉ¥‘”(€€€€¤ì((€€€½¹ÍÐ•±•µ•¹Ð€ô(€€€€€€€€ ‰‰…ÑÑ±•A±…å•É…Éˆ¬(€€€€€€€€€€€€¡¡…É…Ñ•É%¹‘•áñðÀ¤(€€€€€€€€¤ì(((€€€¥˜ …•±•µ•¹Ð¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾ò#žrš¶¢žšÆëŽ3šZ–¶_šr–#¢Š¯¢N/’ö?Ž(€€€€€€ƒ–>#¢ÞÏ–"Ãšr–&7¦v‹Ž7žjš‚çšr³–:–nƒ¾ò'¾òh(€€€€€€ƒ’æ/–&7š*+šZ–¶_–žÒƒžnÓš:—–†{¦Ë¢žK¢&Ë–6‡ž&¢Ž‡¦vˆ(€€€€€€ƒžVÛ–¶C–žÒƒŽ’ö¢žK¢&Ë–6‡ž&šRïšN+žjžz³¦ZOšršJ·šRø(€€€€€€ƒŽ3–&7–
ûŽ7–.WžV¯¾ò!ÑÉ…¹Í™½É·’ö7žžï¾ò'¾ò0(€€€€€€MO¢š?–&¾òk’îï’öWšr'’ösžR£’âµÑÉ…¹Í™½É·žj–žÒƒ¾ò0(€€€€€€ƒšr–îëž®/’â–/šZÃžjžZ+šRû–Æ“¾ò3š*+–ºš&šr'–¶C–žÒƒžj(€€€€€€ƒžZ+šRû¦‚–ê?¦^s¦Ë¦g–/–Æ¦£ž¾–r7¢Ž‡ŠSŠS’â7žº‡–¶C–žÒ€(€€€€€€ƒžjèµ¥¹‘•ã¢¢·–’k¦®c¾ò3¦÷¢ÞÏ’â7–ë¦g–/ž¾–r7–:ï¢Þ|(€€€€€€ƒ–’[¦v‹žjšvÇ¢–ÿš¾S¢òŽš*¢÷–B7ž¢ÇšZ–¶_–&o––÷šb¿–6‡ž&žj(€€€€€€ƒ–¶C–žÒƒ¾ò3–6‡ž&–&o––÷–r£šRïšN+žz³¦ZOšr%ÑÉ…¹Í™½É·–r£¢ÞG¾ò0(€€€€€€ƒ¦g–ÂÇšb¿’â7žº…èµ¥¹‘•ã¢¢·–’k¦®c¦÷šÊKžR£žjžrš¶–:–nƒŽ((€€€€€€ƒšRçš"C’â7–7žVÛ–6‡ž&žj–¶C–žÒƒ¾ò3žnÓš:—š:o–"À(€€€€€€‘½Õµ•¹Ð¹‰½‘ç–êW’â/¾ò#’â7šr¢Š¯’îï’öW–.WžV¬(€€€€€€ƒšÎ‹–>+žj–rÃšZç¾ò'¾ò3žR¡•Ñ	½Õ¹‘¥¹±¥•¹ÑI•Ð ¤(€€€€€€ƒ¦?–ë–6‡ž&žn»–&7–r£žV¯¦v‹’â+žj–¾›¦jo–êŸš¢g¾ò0(€€€€€€ƒ–7žR¡Á½Í¥Ñ¥½¸é™¥á•“š*+šZ–¶_žÊûšê[žZ+–r (€€€€€€ƒ–6‡ž&š¶’â+šZçŠSŠS¦gš¢šZ–¶_žjžZ+šRû¦‚–ê<(€€€€€€ƒ–ÂÇšb¿žnã–Â7šZóšVÓ–/¦‚¦v‹–r£š¾S¢ò¾ò0(€€€€€€ƒ’â7šr–7¢Š¯–6‡ž&¢«–ÞÇžj–.WžV¯–nÃ’ö?Ž(€€€€¨¼((€€€½¹ÍÐÉ•Ðô(€€€€€€€•±•µ•¹Ð¹•Ñ	½Õ¹‘¥¹±¥•¹ÑI•Ð ¤ì(((€€€½¹ÍÐ‰…‘”€ô(€€€€€€€‘½Õµ•¹Ð¹É•…Ñ•±•µ•¹Ð (€€€€€€€€€€€€‰‘¥Øˆ(€€€€€€€€¤ì(((€€€‰…‘”¹±…ÍÍ9…µ”€ô(€€€€€€€€‰Í­¥±°µ¹…µ”µ‰…‘”‰…‘”´ˆ¬(€€€€€€€•±•µ•¹ÑQåÁ”ì(((€€€‰…‘”¹Ñ•áÑ½¹Ñ•¹Ð€ô(€€€€€€€Í­¥±±9…µ”ì((€€€½¹ÍÐ‰…‘•ÕÉ…Ñ¥½¸ô(€€€€€€€•ÑM­¥±±9…µ•	…‘•ÕÉ…Ñ¥½¸ (€€€€€€€€€€€Í­¥±±9…µ”°(€€€€€€€€€€€•±•µ•¹ÑQåÁ”(€€€€€€€€¤ì((€€€‰…‘”¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä (€€€€€€€€ˆ´µÍ­¥±°µ¹…µ”µ‘¥ÍÁ±…äµ‘ÕÉ…Ñ¥½¸ˆ°(€€€€€€€‰…‘•ÕÉ…Ñ¥½¸¬‰µÌˆ(€€€€¤ì((((€€€€¼¨XÌàM=UIµ1Y0U$M%i%`è(€€€€€€Q¡”‰…‘”•ÑÌ¥ÑÌ™¥¹…°Ù¥ÍÕ…°Í¥é”…ÐÉ•…Ñ¥½¸Ñ¥µ”¸(€€€€€€Q¡¥Ì¥Ì‘•±¥‰•É…Ñ•±ä¥¹±¥¹”€¬€…¥µÁ½ÉÑ…¹ÐÍ¼±…Ñ•ÈML…¹¹½Ð(€€€€€€Í¥±•¹Ñ±ä½Ù•ÉÉ¥‘”¥Ð¸€¨¼(€€€‰…‘”¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ‰™½¹ÐµÍ¥é”ˆ°ˆÜÉÁàˆ°‰¥µÁ½ÉÑ…¹Ðˆ¤ì(€€€‰…‘”¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ‰±¥¹”µ¡•¥¡Ðˆ°ˆÄ¸ÀÔˆ°‰¥µÁ½ÉÑ…¹Ðˆ¤ì(€€€‰…‘”¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ‰™½¹ÐµÝ•¥¡Ðˆ°ˆäÀÀˆ°‰¥µÁ½ÉÑ…¹Ðˆ¤ì(€€€‰…‘”¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ‰Ý¡¥Ñ”µÍÁ…”ˆ°‰¹½ÝÉ…Àˆ°‰¥µÁ½ÉÑ…¹Ðˆ¤ì(€€€‰…‘”¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ‰Ý¥‘Ñ ˆ°‰µ…àµ½¹Ñ•¹Ðˆ°‰¥µÁ½ÉÑ…¹Ðˆ¤ì(€€€‰…‘”¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ‰µ¥¸µÝ¥‘Ñ ˆ°‰µ…àµ½¹Ñ•¹Ðˆ°‰¥µÁ½ÉÑ…¹Ðˆ¤ì(€€€‰…‘”¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ˆµÝ•‰­¥ÐµÑ•áÐµÍÑÉ½­”ˆ°ˆÄ¸áÁà€˜É•…äˆ°‰¥µÁ½ÉÑ…¹Ðˆ¤ì)½¹ÍÐ‰…‘•A½¥¹Ð€ô(€€€€€€€…µ•A½¥¹ÑÉ½µ±¥•¹Ð (€€€€€€€€€€€É•Ð¹±•™Ð­É•Ð¹Ý¥‘Ñ ¼È°(€€€€€€€€€€€É•Ð¹Ñ½À(€€€€€€€€¤ì((€€€‰…‘”¹ÍÑå±”¹Á½Í¥Ñ¥½¸ô(€€€€€€€€‰…‰Í½±ÕÑ”ˆì((€€€‰…‘”¹ÍÑå±”¹±•™Ðô(€€€€€€€‰…‘•A½¥¹Ð¹à¬‰Áàˆì((€€€‰…‘”¹ÍÑå±”¹Ñ½Àô(€€€€€€€‰…‘•A½¥¹Ð¹ä¬‰Áàˆì(((€€€½¹ÍÐ½Ù•É±…å1…å•È€ô(€€€€€€€€ ‰…µ”µ½Ù•É±…äµ±…å•Èˆ¤ñð(€€€€€€€‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ‰…µ”µÍÑ…”ˆ¤ì((€€€½Ù•É±…å1…å•È¹…ÁÁ•¹‘¡¥± (€€€€€€€‰…‘”(€€€€¤ì(((€€€Í•ÑQ¥µ•½ÕÐ  ¤ôùì((€€€€€€€¥˜ (€€€€€€€€€€€‰…‘”€˜˜(€€€€€€€€€€€‰…‘”¹Á…É•¹Ñ9½‘”(€€€€€€€€¥ì((€€€€€€€€€€€‰…‘”¹Á…É•¹Ñ9½‘”¹É•µ½Ù•¡¥± (€€€€€€€€€€€€€€€‰…‘”(€€€€€€€€€€€€¤ì((€€€€€€€ô((€€€ô±‰…‘•ÕÉ…Ñ¥½¸¤ì((€€€¥˜¡ÑåÁ•½˜Ý¥¹‘½Ü„ôô‰Õ¹‘•™¥¹•ˆ€˜˜ÑåÁ•½˜Ý¥¹‘½Ü¹ØÄÐÉA±…åM­¥±±¹¥µ…Ñ¥½¹É½µ	…‘”ôôô‰™Õ¹Ñ¥½¸ˆ¥ì(€€€€€€€Ý¥¹‘½Ü¹ØÄÐÉA±…åM­¥±±¹¥µ…Ñ¥½¹É½µ	…‘” ‰Á±…å•Èˆ±Í­¥±±9…µ”±•±•µ•¹ÑQåÁ”°(€€€€€€€€€€€¡…É…Ñ•É%¹‘•áñðÀ±Ñ…É•Ñ½¹ÑÉ…Ð¹Ñ…É•Ñ%±Ñ…É•Ñ½¹ÑÉ…Ð¹Ñ…É•Ñ%‘Ì±Ñ…É•Ñ½¹ÑÉ…Ð(€€€€€€€€¤ì(€€€ô()ô(((¼¨(€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3š«ž&§šZ÷šRûš*¢÷šf(€€ƒ’æ¢š¢ÞÏš*¢÷–B7ž¢Ç¾ò'¾òh(€€ƒ¢Þ}Í¡½ÝM­¥±±9…µ•	…‘” §–æû’æ;’âš¢‡’âš¢¾ò0(€€ƒ–R¿’â–Þ»–"—šb¿žn»š¢g–žÒƒ–úx(€€‰…ÑÑ±•A±…å•É…É­¡…É…Ñ•É%¹‘•à(€€ƒš>oš"A‰…ÑÑ±•5½¹ÍÑ•È­µ½¹ÍÑ•É%¹‘•ãŠSŠP(€€ƒš«ž&§šRïšN+šf–B3š¢–>¿¢÷¢žãžfó–6‡ž&–&7–
û–.WžV¬(€€ƒ¾ò!±Õ¹•5½¹ÍÑ•É…É §¾ò'¾ò3š&’î—¦g¢Ž„(€€ƒ’âš¢’â7žVÛ–6‡ž&žj–¶C–žÒƒŽš:o–r (€€‘½Õµ•¹Ð¹‰½‘ç–êW’â/ŽžR¡Á½Í¥Ñ¥½¸é™¥á•(€€ƒžZ+–r£š«ž&§–6‡ž&š¶’â+šZç¾ò3–:–nƒ¢Þ|(€€Í¡½ÝM­¥±±9…µ•	…‘” §–º3–£žnã–B3Ž(¨¼()™Õ¹Ñ¥½¸Í¡½Ý5½¹ÍÑ•ÉM­¥±±9…µ•	…‘” (€€€Í­¥±±9…µ”°(€€€•±•µ•¹ÑQåÁ”°(€€€µ½¹ÍÑ•É%¹‘•à°(€€€Ñ…É•Ñ%°(€€€Ñ…É•Ñ%‘Ì°(€€€Ñ…É•ÑM¥‘”°(€€€Ñ…É•ÑQåÁ•=Ù•ÉÉ¥‘”(¥ì((€€€½¹ÍÐÑ…É•Ñ½¹ÑÉ…ÐõÉ•…Ñ•	…ÑÑ±•Q…É•Ñ½¹ÑÉ…Ð (€€€€€€€€‰µ½¹ÍÑ•Èˆ±Í­¥±±9…µ”±•±•µ•¹ÑQåÁ”±9Õµ‰•È¹¥Í%¹Ñ••È¡µ½¹ÍÑ•É%¹‘•à¤ýµ½¹ÍÑ•É%¹‘•àèÀ±Ñ…É•Ñ%±Ñ…É•Ñ%‘Ì±Ñ…É•ÑM¥‘”±Ñ…É•ÑQåÁ•=Ù•ÉÉ¥‘”(€€€€¤ì((€€€½¹ÍÐ•±•µ•¹Ðô(€€€€€€€€ ‰‰…ÑÑ±•5½¹ÍÑ•Èˆ¬(€€€€€€€€€€€µ½¹ÍÑ•É%¹‘•à(€€€€€€€€¤ì(((€€€¥˜ …•±•µ•¹Ð¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€½¹ÍÐÉ•Ðô(€€€€€€€•±•µ•¹Ð¹•Ñ	½Õ¹‘¥¹±¥•¹ÑI•Ð ¤ì(((€€€½¹ÍÐ‰…‘”ô(€€€€€€€‘½Õµ•¹Ð¹É•…Ñ•±•µ•¹Ð (€€€€€€€€€€€€‰‘¥Øˆ(€€€€€€€€¤ì(((€€€‰…‘”¹±…ÍÍ9…µ”ô(€€€€€€€€‰Í­¥±°µ¹…µ”µ‰…‘”‰…‘”´ˆ¬(€€€€€€€•±•µ•¹ÑQåÁ”ì(((€€€‰…‘”¹Ñ•áÑ½¹Ñ•¹Ðô(€€€€€€€Í­¥±±9…µ”ì((€€€½¹ÍÐ‰…‘•ÕÉ…Ñ¥½¸ô(€€€€€€€•ÑM­¥±±9…µ•	…‘•ÕÉ…Ñ¥½¸ (€€€€€€€€€€€Í­¥±±9…µ”°(€€€€€€€€€€€•±•µ•¹ÑQåÁ”(€€€€€€€€¤ì((€€€‰…‘”¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä (€€€€€€€€ˆ´µÍ­¥±°µ¹…µ”µ‘¥ÍÁ±…äµ‘ÕÉ…Ñ¥½¸ˆ°(€€€€€€€‰…‘•ÕÉ…Ñ¥½¸¬‰µÌˆ(€€€€¤ì((((€€€€¼¨XÌàM=UIµ1Y0U$M%i%`è(€€€€€€Q¡”‰…‘”•ÑÌ¥ÑÌ™¥¹…°Ù¥ÍÕ…°Í¥é”…ÐÉ•…Ñ¥½¸Ñ¥µ”¸(€€€€€€Q¡¥Ì¥Ì‘•±¥‰•É…Ñ•±ä¥¹±¥¹”€¬€…¥µÁ½ÉÑ…¹ÐÍ¼±…Ñ•ÈML…¹¹½Ð(€€€€€€Í¥±•¹Ñ±ä½Ù•ÉÉ¥‘”¥Ð¸€¨¼(€€€‰…‘”¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ‰™½¹ÐµÍ¥é”ˆ°ˆÜÉÁàˆ°‰¥µÁ½ÉÑ…¹Ðˆ¤ì(€€€‰…‘”¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ‰±¥¹”µ¡•¥¡Ðˆ°ˆÄ¸ÀÔˆ°‰¥µÁ½ÉÑ…¹Ðˆ¤ì(€€€‰…‘”¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ‰™½¹ÐµÝ•¥¡Ðˆ°ˆäÀÀˆ°‰¥µÁ½ÉÑ…¹Ðˆ¤ì(€€€‰…‘”¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ‰Ý¡¥Ñ”µÍÁ…”ˆ°‰¹½ÝÉ…Àˆ°‰¥µÁ½ÉÑ…¹Ðˆ¤ì(€€€‰…‘”¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ‰Ý¥‘Ñ ˆ°‰µ…àµ½¹Ñ•¹Ðˆ°‰¥µÁ½ÉÑ…¹Ðˆ¤ì(€€€‰…‘”¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ‰µ¥¸µÝ¥‘Ñ ˆ°‰µ…àµ½¹Ñ•¹Ðˆ°‰¥µÁ½ÉÑ…¹Ðˆ¤ì(€€€‰…‘”¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ˆµÝ•‰­¥ÐµÑ•áÐµÍÑÉ½­”ˆ°ˆÄ¸áÁà€˜É•…äˆ°‰¥µÁ½ÉÑ…¹Ðˆ¤ì)½¹ÍÐ‰…‘•A½¥¹Ð€ô(€€€€€€€…µ•A½¥¹ÑÉ½µ±¥•¹Ð (€€€€€€€€€€€É•Ð¹±•™Ð­É•Ð¹Ý¥‘Ñ ¼È°(€€€€€€€€€€€É•Ð¹Ñ½À(€€€€€€€€¤ì((€€€‰…‘”¹ÍÑå±”¹Á½Í¥Ñ¥½¸ô(€€€€€€€€‰…‰Í½±ÕÑ”ˆì((€€€‰…‘”¹ÍÑå±”¹±•™Ðô(€€€€€€€‰…‘•A½¥¹Ð¹à¬‰Áàˆì((€€€‰…‘”¹ÍÑå±”¹Ñ½Àô(€€€€€€€‰…‘•A½¥¹Ð¹ä¬‰Áàˆì(((€€€½¹ÍÐ½Ù•É±…å1…å•È€ô(€€€€€€€€ ‰…µ”µ½Ù•É±…äµ±…å•Èˆ¤ñð(€€€€€€€‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ‰…µ”µÍÑ…”ˆ¤ì((€€€½Ù•É±…å1…å•È¹…ÁÁ•¹‘¡¥± (€€€€€€€‰…‘”(€€€€¤ì(((€€€Í•ÑQ¥µ•½ÕÐ  ¤ôùì((€€€€€€€¥˜ (€€€€€€€€€€€‰…‘”€˜˜(€€€€€€€€€€€‰…‘”¹Á…É•¹Ñ9½‘”(€€€€€€€€¥ì((€€€€€€€€€€€‰…‘”¹Á…É•¹Ñ9½‘”¹É•µ½Ù•¡¥± (€€€€€€€€€€€€€€€‰…‘”(€€€€€€€€€€€€¤ì((€€€€€€€ô((€€€ô±‰…‘•ÕÉ…Ñ¥½¸¤ì((€€€¥˜¡ÑåÁ•½˜Ý¥¹‘½Ü„ôô‰Õ¹‘•™¥¹•ˆ€˜˜ÑåÁ•½˜Ý¥¹‘½Ü¹ØÄÐÉA±…åM­¥±±¹¥µ…Ñ¥½¹É½µ	…‘”ôôô‰™Õ¹Ñ¥½¸ˆ¥ì(€€€€€€€Ý¥¹‘½Ü¹ØÄÐÉA±…åM­¥±±¹¥µ…Ñ¥½¹É½µ	…‘” ‰µ½¹ÍÑ•Èˆ±Í­¥±±9…µ”±•±•µ•¹ÑQåÁ”°(€€€€€€€€€€€µ½¹ÍÑ•É%¹‘•áñðÀ±Ñ…É•Ñ½¹ÑÉ…Ð¹Ñ…É•Ñ%±Ñ…É•Ñ½¹ÑÉ…Ð¹Ñ…É•Ñ%‘Ì±Ñ…É•Ñ½¹ÑÉ…Ð(€€€€€€€€¤ì(€€€ô()ô(((¼¨(€€ƒŠbƒ’þ»š¶¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3š.ÿš:'šZ÷šRûš*¢÷šf(€€ƒ¢ÞÏ–éMCšÚ#¢_šVã–¶_žj–.WžV¯¾ò'¾òh(€€ƒ’æ/–&7š¾?š²‡šZ÷šRûš*¢÷¾ò3¦÷šr–>›–’[¢ÞÏ–ë’â–,(€€ƒŽ0µaaMCŽ7žjšÖ»–.WšZ–¶_¾ò3š>C¦Kš&’ê–’k–ÂEMCŽ(€€ƒ’öÿžR£¢¢šë–ú_¦g–/š>Cž’ë’â7¦r¢š¾ò3žnÓš:—š.ÿš:'Ž(€€ƒ’þwžVg¦g–/–÷–ò?šr³¢ê¯¾ò#¢ºOš&šr'–Fó–>¯žj–rÃšZä(€€ƒ¦
šb¿¢÷š¶–âã¦/’ösŽ’â7šr–fÓ¦2¿¾ò'¾ò0(€€ƒ’ö–÷–ò?–Ÿ–ºçšâž¦ë¾ò3’â7–7–k’îï’öW¦†¿ž’ëŽ(¨¼()™Õ¹Ñ¥½¸Í¡½ÝA±…å•ÉMÁA½ÁÕÀ¡…µ½Õ¹Ð±¡…É…Ñ•É%¹‘•à¥ì((€€€É•ÑÕÉ¸ì()ô(()™Õ¹Ñ¥½¸±Õ¹•A±…å•É…É¡¡…É…Ñ•É%¹‘•à¥ì((€€€½¹ÍÐ•±•µ•¹Ð€ô(€€€€€€€€ ‰‰…ÑÑ±•A±…å•É…Éˆ¬(€€€€€€€€€€€€¡¡…É…Ñ•É%¹‘•áñðÀ¤(€€€€€€€€¤ì(((€€€¥˜ …•±•µ•¹Ð¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€•±•µ•¹Ð¹±…ÍÍ1¥ÍÐ¹É•µ½Ù” (€€€€€€€€‰…ÑÑ…­•Èµ±Õ¹”µÕÀˆ(€€€€¤ì(((€€€Ù½¥•±•µ•¹Ð¹½™™Í•Ñ]¥‘Ñ ì(((€€€•±•µ•¹Ð¹±…ÍÍ1¥ÍÐ¹…‘ (€€€€€€€€‰…ÑÑ…­•Èµ±Õ¹”µÕÀˆ(€€€€¤ì(((€€€Í•ÑQ¥µ•½ÕÐ  ¤ôùì((€€€€€€€•±•µ•¹Ð¹±…ÍÍ1¥ÍÐ¹É•µ½Ù” (€€€€€€€€€€€€‰…ÑÑ…­•Èµ±Õ¹”µÕÀˆ(€€€€€€€€¤ì((€€€ô°ÐÔÀ¤ì()ô(()™Õ¹Ñ¥½¸±Õ¹•5½¹ÍÑ•É…É¡¥¹‘•à¥ì((€€€½¹ÍÐ•±•µ•¹Ð€ô(€€€€€€€€ ‰‰…ÑÑ±•5½¹ÍÑ•Èˆ­¥¹‘•à¤ì(((€€€¥˜ …•±•µ•¹Ð¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€•±•µ•¹Ð¹±…ÍÍ1¥ÍÐ¹É•µ½Ù” (€€€€€€€€‰…ÑÑ…­•Èµ±Õ¹”µ‘½Ý¸ˆ(€€€€¤ì(((€€€Ù½¥•±•µ•¹Ð¹½™™Í•Ñ]¥‘Ñ ì(((€€€•±•µ•¹Ð¹±…ÍÍ1¥ÍÐ¹…‘ (€€€€€€€€‰…ÑÑ…­•Èµ±Õ¹”µ‘½Ý¸ˆ(€€€€¤ì(((€€€Í•ÑQ¥µ•½ÕÐ  ¤ôùì((€€€€€€€•±•µ•¹Ð¹±…ÍÍ1¥ÍÐ¹É•µ½Ù” (€€€€€€€€€€€€‰…ÑÑ…­•Èµ±Õ¹”µ‘½Ý¸ˆ(€€€€€€€€¤ì((€€€ô°ÐÔÀ¤ì()ô(((¼¨(€€ƒŠbƒ¦Z¦ÿ–.WžV¯¾ò#šZÃ–Š{¾ò'¾òh(€€ƒ¢Þ}±Õ¹—šb¿–B3’âž¢»–¾¯šÎW¾ò3–>«šb¿š>o’â–-±…ÍÏ¾ò0(€€ƒ––_žR£–r£Ž3¢êË¦;šRïšN(¿š*×š*_žVÃ–âãž.š/Ž7žj¦
–/žn»š¢g¢ê¯’â+Ž(¨¼()™Õ¹Ñ¥½¸Í¡½Ý½‘•¹¥µ…Ñ¥½¸¡•±•µ•¹Ð¥ì((€€€¥˜ …•±•µ•¹Ð¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€•±•µ•¹Ð¹±…ÍÍ1¥ÍÐ¹É•µ½Ù” (€€€€€€€€‰‘½‘”µ‰…¬ˆ(€€€€¤ì(((€€€Ù½¥•±•µ•¹Ð¹½™™Í•Ñ]¥‘Ñ ì(((€€€•±•µ•¹Ð¹±…ÍÍ1¥ÍÐ¹…‘ (€€€€€€€€‰‘½‘”µ‰…¬ˆ(€€€€¤ì(((€€€Í•ÑQ¥µ•½ÕÐ  ¤ôùì((€€€€€€€•±•µ•¹Ð¹±…ÍÍ1¥ÍÐ¹É•µ½Ù” (€€€€€€€€€€€€‰‘½‘”µ‰…¬ˆ(€€€€€€€€¤ì((€€€ô°ÐÔÀ¤ì()ô(((¼¨(€€ƒ–B3šf¢fWžBŽ3šRïšN+šÊK–F÷’â·Ž7¢ÞŽ3žVÃ–âãž.š/šÊKžRšV#Ž4(€€ƒ¦g–§ž¢¹µ¥ÍÏž.šÎ¾òh(€€ƒžn»š¢g–6‡ž&šJ·šRû¦Z¦ÿ–.WžV¯¾ò0(€€ƒ’â›¢ÞÏ–ë’â–/žÃžf÷¢&ËžjšZ–¶_š>Cž’ëŽ((€€¥ÍA±…å•ÉQ…É•ÐõÑÉÕ—šf–Â7¢Æ‡šb¿ž:§–ºÛ¢«–ÞÇžj–6‡ž&¾ò0(€€ƒ–B›–&žR¡¥¹‘•ã–:ïš*Oš«ž&§–6‡ž&Ž(¨¼()™Õ¹Ñ¥½¸Í¡½Ý5¥ÍÍ™™•Ð¡¥ÍA±…å•ÉQ…É•Ð±¥¹‘•à±Ñ•áÐ¥ì((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾òh(€€€€€€¥ÍA±…å•ÉQ…É•ÐõÑÉÕ—šf¾ò0(€€€€€€¥¹‘•ãž>û–r£’î¢†£Ž3ž²³–æû–ò×ž:§–ºÛ–6‡Ž4(€€€€€€ƒ¾ò À÷ž²³’â¢žK¢&ËŽÄ÷ž²³’ê3¢žK¢&Ë¾ò'¾ò0(€€€€€€ƒ’â7–7šÂã¦ƒš*M‰…ÑÑ±•A±…å•ÉI½ß¢Ž‡ž²³’â–ò×–6‡¾ò0(€€€€€€ƒ¦gš¢ž²³’ê3¢žK¢&Ë¢Š¯šRïšN+šÊK–F÷’â·šf¾ò0(€€€€€€ƒ¦Z¦ÿ–.WžV¯š&7šr–ëž>û–r£š¶žŠëžj–6‡ž&’â+Ž(€€€€¨¼((€€€½¹ÍÐ•±•µ•¹Ð€ô(€€€€€€€¥ÍA±…å•ÉQ…É•Ð(€€€€€€€€ü(€€€€€€€€ ‰‰…ÑÑ±•A±…å•É…Éˆ¬(€€€€€€€€€€€€¡¥¹‘•áñðÀ¤(€€€€€€€€¤(€€€€€€€€è(€€€€€€€€ ‰‰…ÑÑ±•5½¹ÍÑ•Èˆ­¥¹‘•à¤ì(((€€€¥˜ …•±•µ•¹Ð¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€Í¡½Ý½‘•¹¥µ…Ñ¥½¸ (€€€€€€€•±•µ•¹Ð(€€€€¤ì(((€€€Í¡½Ý…µ…•A½ÁÕÀ (€€€€€€€•±•µ•¹Ð°(€€€€€€€Ñ•áÑñð‰5%MLˆ°(€€€€€€€€‰µ¥ÍÌˆ(€€€€¤ì()ô(()™Õ¹Ñ¥½¸Í¡½ÝA±…å•É!¥Ð¡…µ½Õ¹Ð±ÑåÁ”±¡…É…Ñ•É%¹‘•à±¥ÍA½Í¥Ñ¥Ù”±¥ÍÉ¥Ð¥ì((€€€½¹ÍÐ•±•µ•¹Ð€ô(€€€€€€€€ ‰‰…ÑÑ±•A±…å•É…Éˆ¬(€€€€€€€€€€€€¡¡…É…Ñ•É%¹‘•áñðÀ¤(€€€€€€€€¤ì(((€€€¥˜ …•±•µ•¹Ð¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€€¼¨(€€€€€€ƒŠbƒ–7š²‡’þ»š¶¾ò#žržjš*O–"Ã¦ëšò?žj–rÃšZç¾ò'¾òh(€€€€€€ƒ’â+š²‡–>«š:K¦f“’êÑåÁ”ôôô‰¡•…°‹¾ò3’öMC¢^—šÂÐ(€€€€€€ƒš‹–ú§žR£žjšb½ÑåÁ”ôôô‰ÍÀ‹¾ò3’â7šb¼‰¡•…°‹¾ò0(€€€€€€ƒšò?žÚË’æ/¦¶k¾ò3–ZuMC¢^—šÂÓš‹–ú§žjšf–g¦
šb¿šr(€€€€€€ƒ¢ª“¢žãžfó¦r–.WŠSŠS–B3’â–/š‚çšr³–V?¦†3¾ò#žR£¢Îšê@(€€€€€€ƒž¢»¦†{žj–¶_’âË–:ïž2sšâ³Ž3¦gšb¿š¶¦v‹¦
¢Êƒ¦v‹šV#šzsŽ4(€€€€€€ƒšr³’ú–ÂÇ’â7–>¿¦vƒ¾ò0‰ÍÀ‹¦g–/–¶_’âË–B3šf’î¢† (€€€€€€ƒŽ3¦gšb½MCŽ7¾ò3šÊK¢ú›šÎW–B3šf–"¢ú£Ž3šb¿š‹–ú¤(€€€€€€ƒ¦
šb¿šÖ–’ÇŽ7¾ò'Ž((€€€€€€ƒ¦g¢Ž‡¦–âÛžfóž>û’ê–>›’â–/–nƒž
ë–B3š¢–:–nƒ¦ƒš"Cžj(€€€€€€‰ÕŸ¾òk’â/¦v‹¦†¿ž’ëžj¬¼·ž²›¢f¾ò3’æ–>«¢ª7–ú\(€€€€€€ÑåÁ”ôôô‰¡•…°‹¾ò1MC¢^—šÂÓš‹–ú§žjšf–d(€€€€€€ƒšr¦†¿ž’ëš"CŽ0´ÔÁMCŽ7¦gž¢»¢ª“–Â;’êëžj¢ÊƒšVã¾ò0(€€€€€€ƒšb;šb;šb¿–r£¢Žs¢† ¿¢Žs¦¶S–6ï¦†¿ž’ë¢Êƒ¢fŽ((€€€€€€ƒšRçš"Cšb;žŠë–
Ï’â–-¥ÍA½Í¥Ñ¥Ù—–>šVã¾ò0(€€€€€€ƒ’â7–7¦vƒ–¶_’âË–:ïž2s¾ò3¦g¢Ž‡–Fó–>¯žjš¾?–/–rÃšZä(€€€€€€ƒ¦÷¢š¢«–ÞÇšb;žŠë¢²ošâš–kŽ3¦gš²‡šb¿š¶¦v‹šV#šzp(€€€€€€ƒ¦
šb¿¢Êƒ¦v‹šV#šzsŽ7¾ò3–§–-‰ÕŸ’âš²‡’þ»––÷¾ò0(€€€€€€ƒ’î—–ú3’æ’â7šr–7šr'¦†{’òóŽ1ÑåÁ—–¶_’âËšÊKš*((€€€€€€ƒš~C–/ššÎ¢š»¦Ë–:ïŽ7¢3šò?š:'žjž.šÎŽ(€€€€¨¼((€€€€¼¨…µ…”Á½ÁÕÀÉ•…Ñ¥½¸¥ÌÑ¡”¡¥Ðµ™••‘‰…¬½Ý¹•È¸Q¡”…ÉÉ½½Ð¹•Ù•È(€€€€€€É••¥Ù•Ì„‰½É‘•È½Í¡…‘½Ü¡¥ÐÍÑ…Ñ”ìÁ½Í¥Ñ¥Ù”!•…°½M@™••‘‰…¬Ñ¡•É•™½É”(€€€€€€…¹¹½Ð…¥‘•¹Ñ…±±ä¥¹¡•É¥Ð‘…µ…”Í•µ…¹Ñ¥Ì¸€¨¼((€€€¥˜ (€€€€€€€…µ½Õ¹Ð„ôõÕ¹‘•™¥¹•€˜˜(€€€€€€€…µ½Õ¹Ð„ôõ¹Õ±°(€€€€¥ì((€€€€€€€½¹ÍÐÁÉ•™¥à€ô(€€€€€€€€€€€¥ÍA½Í¥Ñ¥Ù”(€€€€€€€€€€€€ü(€€€€€€€€€€€€ˆ¬ˆ(€€€€€€€€€€€€è(€€€€€€€€€€€€ˆ´ˆì(((€€€€€€€€¼¨(€€€€€€€€€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3š«ž&§š&Ož:§–ºØ(€€€€€€€€€€ƒž"šN+šf’æ¢ššr'šV#šzs¾ò3¢Þ}Í¡½Ý5½¹ÍÑ•É!¥Ð ¤(€€€€€€€€€€ƒ¦
¦
+ž:§–ºÛš&Oš«ž&§ž"šN+žj–F#ž>ûšZç–ò?’â¢Ó¾ò'¾òh(€€€€€€€€€€¥ÍÉ¥Óž
éÑÉÕ—šf¾ò3šVã–¶_–&7¦v‹–*ƒÂ~J—¾ò0(€€€€€€€€€€ƒ’â›š*)¥ÍÉ¥Ó–
ÏžÖ™Í¡½Ý…µ…•A½ÁÕÀ §¾ò0(€€€€€€€€€€ƒ¢ºO–º––_’â(¹É¥Ñ¥…°µÁ½ÁÕÃš¢–ò<(€€€€€€€€€€ƒ¾ò#–¶_šnÓ–’ŸŽ¦†?¢&ËšnÓ¦Kžn»¾ò'¾ò3¢Þž:§–ºÛ–Â4(€€€€€€€€€€ƒš«ž&§ž"šN+šfžr/–"ÃžjšV#šzs–B3’â––_Ž(€€€€€€€€¨¼((€€€€€€€Í¡½Ý…µ…•A½ÁÕÀ (€€€€€€€€€€€•±•µ•¹Ð°(€€€€€€€€€€€€ (€€€€€€€€€€€€€€€¥ÍÉ¥Ð(€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€¤¬(€€€€€€€€€€€ÁÉ•™¥à¬(€€€€€€€€€€€…µ½Õ¹Ð¬(€€€€€€€€€€€€ (€€€€€€€€€€€€€€€ÑåÁ”ôôô‰ÍÀˆ(€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€€‰M@ˆ(€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€€‰!@ˆ(€€€€€€€€€€€€¤°(€€€€€€€€€€€ÑåÁ”°(€€€€€€€€€€€¥ÍÉ¥Ð(€€€€€€€€¤ì((€€€ô()ô(((¼¨(€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3Ž3¢¶ßžnû–
ß–ºÏš¦–"Ø¸¸»¦†¿ž’ëžf÷¢&È(€€ƒšVã–¶_š&¦f“–.WžV¯¾ò3–š¾òil´ÔØÝwŽ7¾ò'¾òh(€€ƒ¢Þ}Í¡½ÝA±…å•É!¥Ð §–B3š¢š&ù‰…ÑÑ±•A±…å•É…É“–žÒƒ¾ò0(€€ƒ’öžR£–Â#–Æ³žjÍ¡¥•±“¦†{–z/¾ò#žf÷¢&ËšZ–¶_¾ò3¢š,¹‘…µ…”µÁ½ÁÕÀ¸(€€Í¡¥•±µÁ½ÁÕÃ¾ò'¾ò3¢Þ’â¢"±!Cš:'¢†žjžÒ–¶_šb;žŠë–6–"¦Z/’ú¾ò0(€€ƒ’î¢†£Ž3¦gšb¿¢¶ßžnûš&o’â/’úžj¦?¾ò3’â7šb¿žržjš&¢†Ž7Ž(¨¼)™Õ¹Ñ¥½¸Í¡½ÝM¡¥•±‘‰Í½Éˆ¡¡…É…Ñ•É%¹‘•à±…‰Í½É‰•¥ì((€€€¥˜ ……‰Í½É‰•ñð…‰Í½É‰•ðôÀ¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô((€€€½¹ÍÐ•±•µ•¹Ð€ô(€€€€€€€€ ‰‰…ÑÑ±•A±…å•É…Éˆ¬(€€€€€€€€€€€€¡¡…É…Ñ•É%¹‘•áñðÀ¤(€€€€€€€€¤ì((€€€¥˜ …•±•µ•¹Ð¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô((€€€Í¡½Ý…µ…•A½ÁÕÀ (€€€€€€€•±•µ•¹Ð°(€€€€€€€€ˆ´ˆ­…‰Í½É‰•°(€€€€€€€€‰Í¡¥•±ˆ(€€€€¤ì()ô(()™Õ¹Ñ¥½¸Í¡½Ý5½¹ÍÑ•É!¥Ð¡¥¹‘•à±…µ½Õ¹Ð±ÑåÁ”±¥ÍÉ¥Ð¥ì(€€€½¹ÍÐ•±•µ•¹Ðô ‰‰…ÑÑ±•5½¹ÍÑ•Èˆ­¥¹‘•à¤ì(€€€¥˜ …•±•µ•¹Ñññ…µ½Õ¹ÐôôõÕ¹‘•™¥¹•‘ññ…µ½Õ¹Ðôôõ¹Õ±°¥ìÉ•ÑÕÉ¸ìô((€€€½¹ÍÐ‰½ÍÍ=Ý¹•ÈõÑåÁ•½˜Ý¥¹‘½Ü„ôô‰Õ¹‘•™¥¹•ˆýÝ¥¹‘½Ü¹½ÕÉMåµ‰½±Í	½ÍÍ	…ÑÑ±”é¹Õ±°ì(€€€½¹ÍÐÍ•ÑÑ±•µ•¹ÐõÑåÁ”ôôô‰¡Àˆ˜™‰½ÍÍ=Ý¹•È˜™ÑåÁ•½˜‰½ÍÍ=Ý¹•È¹½¹ÍÕµ•…µ…•M•ÑÑ±•µ•¹Ðôôô‰™Õ¹Ñ¥½¸ˆ(€€€€€€€€ý‰½ÍÍ=Ý¹•È¹½¹ÍÕµ•…µ…•M•ÑÑ±•µ•¹Ð¡¥¹‘•à¤é¹Õ±°ì((€€€¥˜¡Í•ÑÑ±•µ•¹Ð¥ì(€€€€€€€¥˜¡Í•ÑÑ±•µ•¹Ð¹Í¡¥•±‘‰Í½É‰•øÀ¥ì(€€€€€€€€€€€Í¡½Ý…µ…•A½ÁÕÀ¡•±•µ•¹Ð°ˆ´ˆ­Í•ÑÑ±•µ•¹Ð¹Í¡¥•±‘‰Í½É‰•°‰Í¡¥•±ˆ±™…±Í”¤ì(€€€€€€€ô(€€€€€€€¥˜¡Í•ÑÑ±•µ•¹Ð¹¡Á…µ…”øÀ¥ì(€€€€€€€€€€€Í¡½Ý…µ…•A½ÁÕÀ¡•±•µ•¹Ð°ˆ´ˆ­Í•ÑÑ±•µ•¹Ð¹¡Á…µ…”¬‰!@ˆ°‰¡Àˆ±¥ÍÉ¥Ð¤ì(€€€€€€€ô(€€€€€€€É•ÑÕÉ¸ì(€€€ô((€€€½¹ÍÐÁÉ•™¥àõÑåÁ”ôôô‰¡•…°ˆüˆ¬ˆèˆ´ˆì(€€€Í¡½Ý…µ…•A½ÁÕÀ (€€€€€€€•±•µ•¹Ð°(€€€€€€€ÁÉ•™¥à­…µ½Õ¹Ð¬¡ÑåÁ”ôôô‰ÍÀˆü‰M@ˆè‰!@ˆ¤°(€€€€€€€ÑåÁ”°(€€€€€€€¥ÍÉ¥Ð(€€€€¤ì)ô(((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€ƒš«ž&§¦7žR|(ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼()™Õ¹Ñ¥½¸É•ÍÁ…Ý¹5½¹ÍÑ•ÉÌ ¥ì((€€€¥˜¡‰…ÑÑ±•Ñ¥Ù”¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾òh(€€€€€€ƒ–:šr³¦g¢Ž‡’â7–"¦vKžÒžjžf÷¾ò0(€€€€€€ƒš¾?š²‡¦÷š*+–£¦ Û¦jïš«ž&§¦7žö»’ö7žö»¾ò/–n{šîÿ¢†¾ò0(€€€€€€ƒž>û–r£š"Ã¦²—–>«šrš6Ë–”ÅøÏ¦jï¾ò0(€€€€€€ƒ–Û¦’cšÊKš¶ïžjš«ž&§’â7š'¢¦Ë¢Š¯–.W–"À(€€€€€€ƒ¾ò#’â7žÛšÊKš¶ïžjš«ž&§’æšrš¾?š²‡š"Ã¦²—–ú3žªžÛ¢ÞÏ’ö7žö»¾ò'Ž(€€€€€€ƒšRçš"C–>«¢fWžBŽ3žržj–ÞËžÚOš¶ï’ê‡Ž7žjš«ž&§Ž(€€€€¨¼((€€€µ½¹ÍÑ•ÉÌ(€€€€¹Í±¥” (€€€€€€€€À°(€€€€€€€5a}QI%9%9}5=9MQIL(€€€€¤(€€€€¹™½É…  (€€€€€€€€¡µ½¹ÍÑ•È±¥¹‘•à¤ôùì((€€€€€€€€€€€¥˜ (€€€€€€€€€€€€€€€€…µ½¹ÍÑ•Èñð(€€€€€€€€€€€€€€€µ½¹ÍÑ•È¹…±¥Ù”(€€€€€€€€€€€€¥ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€€€€€ô(((€€€€€€€€€€€µ½¹ÍÑ•È¹…±¥Ù”õÑÉÕ”ì((€€€€€€€€€€€µ½¹ÍÑ•È¹¡À€ô(€€€€€€€€€€€€€€€µ½¹ÍÑ•È¹µ…á!@ì((€€€€€€€€€€€µ½¹ÍÑ•È¹ÍÀ€ô(€€€€€€€€€€€€€€€µ½¹ÍÑ•È¹µ…áM@ì(((€€€€€€€€€€€€¼¨(€€€€€€€€€€€€€€ƒŠbƒ’þ»š¶¾ò#šâžBšºcžVgž¢/–ò?žŠó¾ò'¾òh(€€€€€€€€€€€€€€ƒ¦g¢Ž‡–:šr³¦
–r£¦7šZÃ¢¢#žº_š«ž&§žjà½ç–êŸš¢gŽ(€€€€€€€€€€€€€€ƒšnÓšZÃ–rÃ–r[–r[ž’ëžj’ö7žö»¾ò3’öš«ž&§–ÞËžÚL(€€€€€€€€€€€€€€ƒ’â7–7–Þ‡¦
?Ž–r[ž’ë’æšVÓ–/¦jÇ¢^?’ê¾ò0(€€€€€€€€€€€€€€ƒ¦gšº×–º3–£žR£’â7–"Ã’ê¾ò3š.ÿš:'Ž(€€€€€€€€€€€€€€ƒšZÃ–6–~¾ò#–Ã¦rs–ÆÇ¢#’æ/–ú3¾ò'žjš«ž&§¢ÎšZd(€€€€€€€€€€€€€€ƒšr³’ú–ÂÇšÊKšr%à½ç¦g–§–/š²’ö7¾ò0(€€€€€€€€€€€€€€ƒžVg¢F_¦gšº×–Â7–º–G’ú¢ª«–>«šržº_–è(€€€€€€€€€€€€€€ƒšÊKšr'š?žú§žj9…;¾ò3šâš:'š¾S¢ò’æûšÞ£Ž(€€€€€€€€€€€€¨¼((€€€€€€€ô(€€€€¤ì()ô(((¼¨(€€ƒŠbƒ’þ»š¶¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3¦gš²‡žržjžÖÇ’âš:'’ê¾ò'¾òh(€€ƒ¦g¢Ž‡’æ/–&7–ÞËžÚO¢Š¯šRçš"CŽ3¦Ë–—–rÃ–r[–ÂÇ¢«–.Wš¾<ÓžžH(€€ƒ¢žãžfó’âš²‡š"Ã¦²—Ž7¾ò3’ö’öÿžR£¢¦gš²‡šb;žŠë¢ššÆ¾òh(€€ƒ¦Ë–—–rÃ–r[–ú3–þ¦‚#–#š2'Ž3¢«–.W–Þ‡š«Ž7š2'¦"W¾ò0(€€ƒš&7šr¦Z/–ž/š¾<ÓžžK¢«–.Wš"Ã¦²—ŠSŠS¦gš¶šb¿–ú3’ú(€€ƒ–r¡Ñ½±•ÕÑ½A…ÑÉ½° ¤½ÉÕ¹ÕÑ½A…ÑÉ½±¡•¬ ¤(€€ƒ¾ò#–rÃ–r[¦‚¦v‹¢«–.Wš"Ã¦²—¦v‹švÿš^¦
+¦
¦†šZÃš2'¦"W¾ò$(€€ƒ–kžj’ê/¾ò3–§––_¦
?¢ò¿–kžjšb¿–B3’â’îÛ’ê/¾ò3–6ï–B¢¨(€€ƒž6£ž®/¦/’ösŽ’êK’â7ž~—¦O–Â7šZç–¶c–r£¾ò3š&7šr–ëž>ø(€€ƒŽ3¢«–.W–Þ‡š«¦÷¦
šÊKš2'¾ò3–ÂÇ¢«–ÞÇš&O¢Öß’úŽ4(€€ƒ¦gž¢»¢†3ž
ëŠSŠS–nƒž
ëžrš¶–r£¢3šf¿¦/’ösžj–Û–¾›šb¼(€€ƒ¦g¢Ž‡¦g––_Ž3¦Ë–rÃ–r[–ÂÇ¢«–.W¦Z/–ž/Ž7žj¢"+¦
?¢ò¿¾ò0(€€ƒ¢Þ’öÿžR£¢š2'žj¦
¦†š2'¦"W–º3–£ž‡¦^sŽ((€€ƒ–÷–ò?–B7ž¢ÇŽ–Fó–>¯žj–rÃšZç¾ò!•¹Ñ•Éi½¹” §Ž(€€Ý¥¹	…ÑÑ±” §’æ/–ú3Ž¦¢¯š"C–*’æ/–ú3Š›¾ò'¦÷žÚ·š2(€€ƒ’â7–.W¾ò3’ö–÷–ò?šr³¦®SšRçš"Cž¦ëžjŠSŠSž>û–r (€€ƒŽ3¢š’â7¢šš¾<ÓžžK¢«–.Wš"Ã¦²—Ž7–R¿’âžj¦Z/¦^sšb¼(€€Ñ½±•ÕÑ½A…ÑÉ½° §¦
¦†š2'¦"W¾ò3’â7šr–7šr$(€€ƒ¦Ë–rÃ–r[–ÂÇ¢«–.W¢žãžfóžj¢†3ž
ëŽ(¨¼()™Õ¹Ñ¥½¸ÍÑ…ÉÑ5½¹ÍÑ•É5½Ù•µ•¹Ð ¥ì((€€€€¼¨(€€€€€€ƒšVš?žVgž¦ë¾òk¢«–.W–Þ‡š«žj¦Z/¦^s–>«’ê“žÖ˜(€€€€€€Ñ½±•ÕÑ½A…ÑÉ½° §¢fWžB¾ò3¦g¢Ž‡’â7–4(€€€€€€ƒ¢«–.W–V–.W’îï’öW¢¢#šf–f£Ž(€€€€¨¼()ô(()™Õ¹Ñ¥½¸ÍÑ½Á5½¹ÍÑ•É5½Ù•µ•¹Ð ¥ì((€€€€¼¨(€€€€€€ƒšVš?žVgž¦ë¾ò3–:–nƒ–B3’â+ŠSŠSžrš¶žj–sš¶‹¦
?¢ò¼(€€€€€€ƒ–r¡ÍÑ½ÁÕÑ½A…ÑÉ½° §¾ò3–Fó–>¯¦g¢Ž‡’â7šr(€€€€€€ƒšr'’îï’öW’ösžR£¾ò3žÒSžÊçšb¿ž
ë’ê¢ºO¢"+žj–Fó–>¯¦îx(€€€€€€ƒ¾ò!±•…Ù•5…À §ŽÍÑ…ÉÑ	…ÑÑ±” §Š›¾ò$(€€€€€€ƒ’â7žR£’â–/’â–/šRçš:'Ž’â7šr–fÓ¦2¿Ž(€€€€¨¼()ô(((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€ƒ–6žÒh(ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼()™Õ¹Ñ¥½¸¡•­1•Ù•±UÀ¡Ñ…É•Ñ¡…É…Ñ•È¥ì((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾òh(€€€€€€ƒ–:šr³¦gšVÓ–/–÷–ò?–¾¯š¶ï–>«¢ª5Á±…å•Ë¾ò0(€€€€€€ƒž²³’ê3¢žK¢&ËšÊK¢ú›šÎW¦?¦;¦g¢Ž‡–6žÒkŽ(€€€€€€ƒšRçš"C–>¿’î—–
Ï–—¢š–6žÒkžj¢žK¢&Ëž&§’îÛ¾ò0(€€€€€€ƒ’â7–
Ïžj¢¦Ç¦‚C¢¢·¦
šb½Á±…å•È(€€€€€€ƒ¾ò#’þwžVg¢"+žj–Fó–>¯šZç–ò?žnã–ºç¾ò'Ž(€€€€¨¼((€€€½¹ÍÐ¡…É…Ñ•Èô(€€€€€€€Ñ…É•Ñ¡…É…Ñ•Éñð(€€€€€€€Á±…å•Èì(((€€€±•Ð±•Ù•±ÌôÀì(((€€€€¼¨(€€€€€€ƒŠbƒšZÃ–Š{¦bË–F¾òh(€€€€€€ƒš¶–âãššÎ’â/¦g–-Ý¡¥±—šr–’k¢ÞDÇš²„(€€€€€€ƒ¾ò!‘¥ÍÑÉ¥‰ÕÑ•áÁQ½¡…É…Ñ•Ëš¾?š²‡¦÷–>«žÖ˜(€€€€€€ƒ–&o––ôÇžÒkžj¦?¾ò'¾ò0(€€€€€€ƒ’ö¦
šb¿–*ƒ’â–/’þw¦j«’â+¦fC¾ò0(€€€€€€ƒ¦ÿ–7’îï’öWš"GšÊK¦‚CšZg–"Ãžj¢ÎšZgžVÃ–âà(€€€€€€ƒ¾ò#’ú/–š¢"+–¶cšªSžj•áÁ9•áÓ–Ž{š:'¾ò$(€€€€€€ƒ–Â;¢Ó¦g¢Ž‡¢ÞG–ë¦n‹¢¶sžj¢þÓ–r#š²‡šVã¾ò0(€€€€€€ƒ’âš²‡ž"–Š{–æûžfûžÒkŽž3–ë–’§šZšVã–¶_žjš*¢÷¦î{Ž(€€€€€€€ÈÀÃžÒk–Â7žn»–&7¦+š"Ë¦Ë–ê›’ú¢ª«–ÞËžÚO¦v{–âã–’k¾ò0(€€€€€€ƒš¶–âãž:§šÎW’â7–>¿¢÷’âš²‡¢žãžfó–"Ã¦g–/’â+¦fCŽ(€€€€¨¼((€€€Ý¡¥±” (€€€€€€€¡…É…Ñ•È¹•áÀøô(€€€€€€€¡…É…Ñ•È¹•áÁ9•áÐ€˜˜(€€€€€€€±•Ù•±ÌðÈÀÀ(€€€€¥ì((€€€€€€€¡…É…Ñ•È¹•áÀ€´ô(€€€€€€€€€€€¡…É…Ñ•È¹•áÁ9•áÐì(((€€€€€€€¡…É…Ñ•È¹±•Ù•°¬¬ì(((€€€€€€€¡…É…Ñ•È¹•áÁ9•áÐ€ô(€€€€€€€€€€€5…Ñ ¹µ…à (€€€€€€€€€€€€€€€¡…É…Ñ•È¹•áÁ9•áÐ¬Ä°(€€€€€€€€€€€€€€€5…Ñ ¹™±½½È (€€€€€€€€€€€€€€€€€€€¡…É…Ñ•È¹•áÁ9•áÐ¨Ä¸È(€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€¤ì(((€€€€€€€¡…É…Ñ•È¹…ÑÑÉ¥‰ÕÑ•A½¥¹ÑÌ€¬ô€Ôì((€€€€€€€¡…É…Ñ•È¹Í­¥±±A½¥¹ÑÌ€¬ô€Èì(((€€€€€€€€¼¨(€€€€€€€€€€ƒŠbƒ¢š?š‚ó¢ššÆ¾òh(€€€€€€€€€€ƒ–6žÒk–në–ºh€¬ÌÀƒšr–’!CŽ¬ÄÀƒšr–’MC¾ò0(€€€€€€€€€€ƒ¢Þ¦®S¢Î¨¿¢÷¦?¦7¦î{–*ƒš"C–"¦Z/žÒ¿–*ƒŽ(€€€€€€€€¨¼((€€€€€€€¡…É…Ñ•È¹‰½¹ÕÍ!@€¬ô€ÌÀì((€€€€€€€¡…É…Ñ•È¹‰½¹ÕÍM@€¬ô€ÄÀì(((€€€€€€€±•Ù•±Ì¬¬ì((€€€ô(((€€€¥˜¡±•Ù•±ÌøÀ¥ì((€€€€€€€€¼¨(€€€€€€€€€€ƒŠbƒ’þ»š¶¾òh€€€€€€€€€€ƒ¦g¢Ž‡¢Þ’æ/–&7š"Ã¦²—–.w–"§¢Žs¢†šb¿–B3’âž¢»–V?¦†3ŠSŠP(€€€€€€€€€€ƒ–6žÒkžVÛ’â/žnÓš:—š*)!@½MC–òß–"Û¢Žsšîÿ¾ò0(€€€€€€€€€€ƒ¢Þ’öƒ¢¢·–ºkžjŽ1!C’ö;šZñ`”½MC’ö;šZñ`—Ž4(€€€€€€€€€€ƒ¢«–.W¢Žs¢^—šÂÓ¦Zšªï–º3–£ž‡¦^s¾ò0(€€€€€€€€€€ƒ¦nš«’öƒšr¢šë–ú_Ž3šb;šb;¦
šÊK–"Ã¦Zšªï¾ò0€€€€€€€€€€ƒ–º¢«–ÞÇ–ÂÇ¢Žs’êŽ7Ž((€€€€€€€€€€ƒš.ÿš:'–òß–"Û¢Žsšîÿ¾ò3–>«¦7šZÃ¢¢#žº_’âš²„(€€€€€€€€€€ÕÉÉ•¹Ð¡À½ÍÃžj’â+¦fC–’û’ö?¾ò#¦ÿ–7¢Ú¦;šZÃžjµ…á!@½µ…áMC¾ò'¾ò0(€€€€€€€€€€ƒ’â7šr–æÏžf÷ž‡šV¢º+š"C–£šîÿŽ((€€€€€€€€€€Á±…å•ÈËšÊKšr%•Ñ5…¥¹¡…É…Ñ•ÉMÑ…ÑÌ §–>¿’î—žR (€€€€€€€€€€ƒ¾ò#¦
–/–÷–ò?–¾¯š¶ïžº]Á±…å•Ëžj¾ò'¾ò0(€€€€€€€€€€ƒšRçžR£¢Þ}•Ñ%¹Ù•¹Ñ½Éå¡…É…Ñ•ÉMÑ…ÑÌ ¤(€€€€€€€€€€Á±…å•ÈË–"šR¿–B3’â––_–³–ò?ž>ûžº_’âš²‡Ž(€€€€€€€€¨¼((€€€€€€€±•Ðµ…á!@ì((€€€€€€€±•Ðµ…áM@ì(((€€€€€€€¥˜¡¡…É…Ñ•ÈôôõÁ±…å•È¥ì((€€€€€€€€€€€½¹ÍÐÍÑ…ÑÌ€ô(€€€€€€€€€€€€€€€•Ñ5…¥¹¡…É…Ñ•ÉMÑ…ÑÌ ¤ì(((€€€€€€€€€€€µ…á!@ô(€€€€€€€€€€€€€€€ÍÑ…ÑÌ¹µ…á!@ì((€€€€€€€€€€€µ…áM@ô(€€€€€€€€€€€€€€€ÍÑ…ÑÌ¹µ…áM@ì((€€€€€€€ô(€€€€€€€•±Í•ì((€€€€€€€€€€€½¹ÍÐ¡…É…Ñ•É%¹‘•àô(€€€€€€€€€€€€€€€•ÑA…ÉÑå¡…É…Ñ•É%¹‘•à (€€€€€€€€€€€€€€€€€€€¡…É…Ñ•È(€€€€€€€€€€€€€€€€¤ì(((€€€€€€€€€€€½¹ÍÐ‰½¹ÕÌÈ€ô(€€€€€€€€€€€€€€€•ÑÅÕ¥Áµ•¹Ñ	½¹ÕÌ (€€€€€€€€€€€€€€€€€€€•ÑA…ÉÑå¡…É…Ñ•É-•ä (€€€€€€€€€€€€€€€€€€€€€€€¡…É…Ñ•É%¹‘•à(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€¤ì(((€€€€€€€€€€€µ…á!@ô(€€€€€€€€€€€€€€€€ÄÀÀ¬(€€€€€€€€€€€€€€€¡…É…Ñ•È¹Ù¥Ñ…±¥Ñä¨ÔÀ¬(€€€€€€€€€€€€€€€¡…É…Ñ•È¹‰½¹ÕÍ!@¬(€€€€€€€€€€€€€€€‰½¹ÕÌÈ¹µ…á!@¬(€€€€€€€€€€€€€€€‰½¹ÕÌÈ¹Ù¥Ñ…±¥Ñä¨ÔÀì(((€€€€€€€€€€€µ…áM@ô(€€€€€€€€€€€€€€€€ÔÀ¬(€€€€€€€€€€€€€€€¡…É…Ñ•È¹•¹•Éä¨ÄÔ¬(€€€€€€€€€€€€€€€¡…É…Ñ•È¹‰½¹ÕÍM@¬(€€€€€€€€€€€€€€€‰½¹ÕÌÈ¹µ…áM@¬(€€€€€€€€€€€€€€€‰½¹ÕÌÈ¹•¹•Éä¨ÄÔì((€€€€€€€ô(((€€€€€€€¡…É…Ñ•È¹¡À€ô(€€€€€€€€€€€5…Ñ ¹µ¥¸ (€€€€€€€€€€€€€€€¡…É…Ñ•È¹¡À°(€€€€€€€€€€€€€€€µ…á!@(€€€€€€€€€€€€¤ì(((€€€€€€€¡…É…Ñ•È¹ÍÀ€ô(€€€€€€€€€€€5…Ñ ¹µ¥¸ (€€€€€€€€€€€€€€€¡…É…Ñ•È¹ÍÀ°(€€€€€€€€€€€€€€€µ…áM@(€€€€€€€€€€€€¤ì(((€€€€€€€€¼¨(€€€€€€€€€€ƒŠbƒ’þ»š¶¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3Ž3žÚO¦¦_–ð(€€€€€€€€€€ƒ–"¦7–6žÒkžjšf–g¾ò3žnÓš:—¦î{¦ã–ÂÇ––÷¾ò0(€€€€€€€€€€ƒ’â7¢š–7¢ÞÏ–ë¢š[žª_¦†¿ž’ë–F+ž~—Ž7¾ò3–ú3žê0(€€€€€€€€€€ƒ–>#¢Žs–Ž3–â3šro–6žÒkžjšf–g–>¿’î—¢ÞÏ–è(€€€€€€€€€€ƒ’â–/¢¢+š¿š†¾ò3¦†¿ž’éaac–6–"ÁacžÒkŽ7¾ò'¾òh(€€€€€€€€€€¡•­1•Ù•±UÀ §žn»–&7–>«šr'’â–/–Fó–>¬(€€€€€€€€€€ƒ’úšêCŠSŠQ‘¥ÍÑÉ¥‰ÕÑ•áÁQ½¡…É…Ñ•È ¤(€€€€€€€€€€ƒ¾ò#žÚO¦¦_šÆƒ–"¦7¦‚¦v‹š2'Ž3–"¦7žÚO¦¦_–óžÖ˜(€€€€€€€€€€cŽ7¦
–/š2'¦"W¾ò'¾ò3š&’î—¦g¢Ž‡žj’þ»šRä(€€€€€€€€€€ƒ–>«–öÇ¦~ÿ¦g–/šÖž¢/¾ò3’â7šr¢ª“–
ß–Û’îX(€€€€€€€€€€ƒš–ŠŽ((€€€€€€€€€€ƒ–:šr³–6žÒkžVÛ’â/šr–òß–"Û¢ÞÏ–ë’â–/¢š(€€€€€€€€€€ƒš&/–.Wš2'Ž3žŠë–ºkŽ7š&7¢÷¦^sš:'žj(€€€€€€€€€€±•Ù•±5½‘…³–ö#žª_¾ò3ž:§–ºÛ¢«–ÞÇ’âï–.T(€€€€€€€€€€ƒ¦î{–"¦7Žšr–úžj–ÂÇšb¿Ž3¦î{’â/–:ï¦š³’â((€€€€€€€€€€ƒžRšV#Ž7¾ò3’â7¦r¢š¦†7–’[–7¢ÞÏ’â–Æ(€€€€€€€€€€ƒžŠë¢ª4¿–F+ž~—¢š[žª_š&7¢÷žæóžê3šN7’ösŠSŠP(€€€€€€€€€€ƒ¦g¦£–"žÚ·š2š.ÿš:'Ž((€€€€€€€€€€ƒ’öž:§–ºÛ–ú3’úšb;žŠë¢†£ž’ë¦
šb¿šÏ¢šŽ3šr$(€€€€€€€€€€ƒ–F+ž~—Ž7¾ò3–>«šb¿’â7¢š¦
ž¢»¢šš2'žŠë–ºkžj(€€€€€€€€€€ƒ–ö‹–ò?¾ò3šRçš"C¢Þž6Ë–ú]aC–B3’âž¢»¢òW¦<(€€€€€€€€€€Ñ½…ÍÓ¦kž~—¾ò#¢š-Í¡½Ý1•Ù•±UÁQ½…ÍÐ §¾ò'¾ò0(€€€€€€€€€€ƒ’â7šN/šN7’ösŽžr/¦;–ÂÇ¢«–.WšÚ#–’ÇŽ((€€€€€€€€€€±•Ù•±5½‘…³¦g–/–ö#–ë¢š[žª_šr³¢ê¯Ž(€€€€€€€€€€±½Í•1•Ù•±5½‘…° §¦÷–#’þwžVg–r (€€€€€€€€€€ƒž¢/–ò?žŠó¢Ž‡šÊK–"«¾ò3–>«šb¿’â7–7–ú{¦g¢Ž„(€€€€€€€€€€ƒ¢žãžfó¦†¿ž’ëŽ(€€€€€€€€¨¼((€€€€€€€Í¡½Ý1•Ù•±UÁQ½…ÍÐ (€€€€€€€€€€€¡…É…Ñ•ÈôôõÁ±…å•È(€€€€€€€€€€€€ü(€€€€€€€€€€€€¡Á±…å•È¹¥‘ñð‹’ö€ˆ¤(€€€€€€€€€€€€è(€€€€€€€€€€€¡…É…Ñ•È¹¥°(€€€€€€€€€€€¡…É…Ñ•È¹±•Ù•°(€€€€€€€€¤ì((€€€ô(((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾ò#’úwžŸ’öÿžR£¢–n{–‚Ç¾ò3Ž3š2'–6žÒkžj(€€€€€€ƒšf–g¾ò3’â+¦v‹¦‚·–?š†žjž¶'žÒkšÊKšr'¢Þ¢F\(€€€€€€ƒ–Š{–*ƒŽ7¾ò'¾òh(€€€€€€ƒ’â7žº‡šr'šÊKšr'žržj–6žÒk¾ò!±•Ù•±ÌøÃ¾ò'¾ò0(€€€€€€ƒ¦÷–Fó–>¯’âš²‡¾ò3¦‚’úÿ–B3š¶—––÷žn»–&7žjž¶'žÒh(€€€€€€ƒšVã–¶_¾ò3š"Cšr³–ú#’ö;¾ò#š&û’â7–"Ã–žÒƒ–ÂÇžnÓš:”(€€€€€€É•ÑÕÉ»¾ò'¾ò3šÊKšr'–&¿’ösžR£Ž(€€€€¨¼((€€€É•™É•Í¡¡…É…Ñ•ÉÙ…Ñ…É1•Ù•±Ì ¤ì(((€€€Í…Ù•…µ” ¤ì((€€€ÕÁ‘…Ñ•U$ ¤ì()ô(()™Õ¹Ñ¥½¸±½Í•1•Ù•±5½‘…° ¥ì((€€€€ ‰±•Ù•±5½‘…°ˆ¤(€€€€€€€€¹±…ÍÍ1¥ÍÐ(€€€€€€€€¹É•µ½Ù” ‰Í¡½Üˆ¤ì()ô(((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€ƒŠbƒžÚO¦¦_šÆƒ–"¦4(ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô((€€ƒ¢š?š‚ó’êSŽ–·¾òh(€€aC–#¦Ë–—–ÇžR£žÚO¦¦_šÆƒ¾ò0(€€ƒ’â7šrš"Ã¦²—’âžÖCšv–ÂÇ¢«–.W–6žÒkŽ(€€ƒž:§–ºÛ–n{–"Ã’âï–~;–ú3¾ò3¢«¢†3š2'Ž3–"¦7žÚO¦¦_–óŽ4(€€ƒš*+žÚO¦¦_šÆƒžjaC–"žÖ›¢žK¢&Ë¾ò0(€€ƒš&7šržrš¶¢žãžfó–6žÒk–"“–ºkŽ((€€ƒžn»–&7¦+š"Ë¢Ž‡–R¿’âšNšr'–º3šVÓž¶'žÒh¿–Æ³šŸžÎïžÖÇžj(€€ƒ¢žK¢&Ëšb¿’âï¢žK¾ò!Á±…å•Ë¾ò3’æ–ÂÇšb¿–&×¢žKšf¦ãžj–žÒƒ¾ò'Ž(€€ƒšÂÓš"Ã–Ž¯¾ò?¦Š£–òOš&/žn»–&7–>«šr'¢Žw–
gš²¾ò0(€€ƒ–Âkšr«šr'ž6£ž®/ž¶'žÒkžÎïžÖÄ(€€ƒ¾ò#¢š?š‚ó’ê3šr'¢¢ïšb;Ž3–’k¢žK¢&Ë–B3šfš"Ã¦²—Ž7šb¿šr«’ú–*¢÷¾ò'¾ò0(€€ƒš&’î—–"¦7š2'¦"W–#–>«¦Z/šRûžÖ›’âï¢žK¾ò0(€€ƒ–Û¦’c¢žK¢&Ë¦†¿ž’ëŽ3–Âkšr«¦Z/šRûŽ7Ž((ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼()±•Ð•áÁQ½…ÍÑQ¥µ•Èõ¹Õ±°ì(()™Õ¹Ñ¥½¸Í¡½ÝáÁQ½…ÍÐ¡…µ½Õ¹Ð¥ì((€€€½¹ÍÐÑ½…ÍÐ€ô(€€€€€€€€ ‰•áÁQ½…ÍÐˆ¤ì(((€€€¥˜ …Ñ½…ÍÐ¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€Ñ½…ÍÐ¹Ñ•áÑ½¹Ñ•¹Ð€ô(€€€€€€€€‹ž6Ë–ú\ˆ¬(€€€€€€€…µ½Õ¹Ð¬(€€€€€€€€‰aC¾ò#–ÞË–¶c–—žÚO¦¦_šÆƒ¾ò$ˆì(((€€€Ñ½…ÍÐ¹±…ÍÍ1¥ÍÐ¹…‘ (€€€€€€€€‰Í¡½Üˆ(€€€€¤ì(((€€€±•…ÉQ¥µ•½ÕÐ (€€€€€€€•áÁQ½…ÍÑQ¥µ•È(€€€€¤ì(((€€€•áÁQ½…ÍÑQ¥µ•È€ô(€€€€€€€Í•ÑQ¥µ•½ÕÐ  ¤ôùì((€€€€€€€€€€€Ñ½…ÍÐ¹±…ÍÍ1¥ÍÐ¹É•µ½Ù” (€€€€€€€€€€€€€€€€‰Í¡½Üˆ(€€€€€€€€€€€€¤ì((€€€€€€€ô°ÈØÀÀ¤ì()ô(()±•Ð±•Ù•±UÁQ½…ÍÑQ¥µ•Èõ¹Õ±°ì(((¼¨(€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3Ž3–6žÒkžjšf–d(€€ƒ–>¿’î—¢ÞÏ–ë’â–/¢¢+š¿š†¾ò3¦†¿ž’éaac–6–"ÁacžÒkŽ7¾ò'¾òh(€€ƒ¢Þ}Í¡½ÝáÁQ½…ÍÐ §–B3’â––_–¾¯šÎW¾ò3¦v{¦bïšZßŽ(€€ƒ¢«–.WšÚ#–’Ç¾ò3’â7¦r¢šž:§–ºÛš2'žŠë–ºkŽ(¨¼()™Õ¹Ñ¥½¸Í¡½Ý1•Ù•±UÁQ½…ÍÐ¡¡…É…Ñ•É9…µ”±±•Ù•°¥ì((€€€½¹ÍÐÑ½…ÍÐô(€€€€€€€€ ‰±•Ù•±UÁQ½…ÍÐˆ¤ì(((€€€¥˜ …Ñ½…ÍÐ¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€Ñ½…ÍÐ¹Ñ•áÑ½¹Ñ•¹Ðô(€€€€€€€¡…É…Ñ•É9…µ”¬(€€€€€€€€‹–6–"Àˆ¬(€€€€€€€±•Ù•°¬(€€€€€€€€‹žÒk¾òˆì(((€€€Ñ½…ÍÐ¹±…ÍÍ1¥ÍÐ¹…‘ (€€€€€€€€‰Í¡½Üˆ(€€€€¤ì(((€€€±•…ÉQ¥µ•½ÕÐ (€€€€€€€±•Ù•±UÁQ½…ÍÑQ¥µ•È(€€€€¤ì(((€€€±•Ù•±UÁQ½…ÍÑQ¥µ•Èô(€€€€€€€Í•ÑQ¥µ•½ÕÐ  ¤ôùì((€€€€€€€€€€€Ñ½…ÍÐ¹±…ÍÍ1¥ÍÐ¹É•µ½Ù” (€€€€€€€€€€€€€€€€‰Í¡½Üˆ(€€€€€€€€€€€€¤ì((€€€€€€€ô°ÈØÀÀ¤ì()ô(((¼¨(€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢–n{–‚Ç¾ò3Ž3š2'–6žÒkžj(€€ƒšf–g¾ò3’â+¦v‹¦‚·–?š†žjž¶'žÒkšÊKšr'¢Þ¢F_–Š{–*ƒŽ7¾ò'¾òh(€€ƒ–>«šnÓšZÃ¢žK¢&Ë–ö#žª_¦‚·–?¦
–§–/ž¶'žÒkšZ–¶_¾ò0(€€ƒ’â7¦7žV¯šVÓ–/–ö#žª_–Ÿ–ºç¾ò#¦7žV¯šVÓ–/–ö#žª\(€€¥¹¹•É!Q53šrš*+ž:§–ºÛš¶–r£žr/žj–"¦‚ŠSŠP(€€ƒ’ú/–šžÚO¦¦_šÆƒ–"¦7šr³¢ê¯ŠSŠS’â¢ÖßšÒ_š:'¾ò0(€€ƒ’æ/–&7¢fWžBŽ3¢«–.Wš"Ã¦²—¢¢·–ºk¢ÞÏ–ëž¦ëžfô(€€ƒš*¢÷¦‚Ž7–ÂÇšb¿–B3’âž¢¹‰ÕŸ¾ò3¦g¢Ž‡šRçžR (€€ƒ¦w–Â7šŸšnÓšZÃ¾ò3–º'–£–ú#–’k¾ò'Ž((€€ƒ¢žK¢&Ë–ö#žª_šÊK¦Z/¢F_žjšf–g¾ò0 §šrš&û’â7–"À(€€ƒ–Â7š%¥“ŽžnÓš:•É•ÑÕÉ»¾ò3–Fó–>¯¦g–/–÷–ò<(€€ƒ’â7šr–ë¦2¿¾ò3–>¿’î—šRû–þ–r¡¡•­1•Ù•±UÀ ¤(€€ƒ¢Ž‡ž‡šŠw’îÛ–Fó–>¯Ž(¨¼()™Õ¹Ñ¥½¸É•™É•Í¡¡…É…Ñ•ÉÙ…Ñ…É1•Ù•±Ì ¥ì(€€€•Ñá¥ÍÑ¥¹A…ÉÑå%¹‘•á•Ì ¤¹™½É… ¡¥¹‘•àôùì(€€€€€€€½¹ÍÐ±•Ù•±°ô ‰¡…É…Ñ•ÉÙ…Ñ…É1•Ù•°ˆ­¥¹‘•à¤ì(€€€€€€€½¹ÍÐ¡…É…Ñ•Èõ•ÑA…ÉÑå¡…É…Ñ•É	å%¹‘•à¡¥¹‘•à¤ì(€€€€€€€¥˜¡±•Ù•±°€˜˜¡…É…Ñ•È¥ì(€€€€€€€€€€€±•Ù•±°¹Ñ•áÑ½¹Ñ•¹Ðô‰1Ø¸ˆ­¡…É…Ñ•È¹±•Ù•°ì(€€€€€€€ô(€€€ô¤ì()ô(((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€ƒŠbƒ’âï–~;’òGš¿¾ò#–7¢Êï–n{šîý!@½MC¾ò$((€€ƒ’æ/–&7š*+Ž3š"Ã¦²—–.w–"¤¿–6žÒk¢«–.W¢Žsšîý!CŽMCŽ7š.ÿš:'’æ/–ú3¾ò0(€€ƒ¢^—šÂÓžR£–º3–ÂÇšÊKšr'–Û’î[–n{¢†š&/šº×’ê¾ò0(€€ƒ¦+š"Ë¢Ž‡žn»–&7’æ¦
šÊKšr'žrš¶žj–V–ê\¿¦G–æžÎïžÖÄ(€€ƒ–>¿’î—¢ÊßšZÃ¢^—šÂÓ¾ò#Ž3¦G–æŽ7žn»–&7–>«šb¿¢3–2–R»–ëšfžj¦†¿ž’ëšZ–¶_¾ò0(€€ƒšÊKšr'žržj¢Š¯¢¢c¦2Ž’æšÊK–rÃšZç¢*Ç¾ò'Ž((€€ƒ–#žR£šr–Z»žÒSžjšZç–ò?¢Žs’â+¦g–/žòë–>¾òh(€€ƒ–n{’âï–~;–>¿’î—–7¢Êï’òGš¿¾ò3žnÓš:—–n{šîý!@½MC¾ò0(€€ƒ’â7¦r¢š¢^—šÂÓŽ’â7¦r¢š¦G–æŽ(€€ƒ’æ/–ú3–ššzs¢š–kžrš¶žj–V–ê_žÎïžÖÇ¾ò0(€€ƒ¦g–/–÷–ò?–>¿’î—–7šNÓ–š"[šnÿš>oš:'Ž(ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€ƒŠbƒ’âï–~;žÒSšZ–¶_¦ã–Z»ŠSŠS–ÇžR£–ö#–ë¢š[žª\(ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼()±•Ð¡½µ••…ÑÕÉ•	½ÉÉ½Ý•‘±•µ•¹Ðô(€€€¹Õ±°ì()±•Ð¡½µ••…ÑÕÉ•	½ÉÉ½Ý•‘A…É•¹Ðô(€€€¹Õ±°ì()±•Ð¡½µ••…ÑÕÉ•	½ÉÉ½Ý•‘9•áÑM¥‰±¥¹œô(€€€¹Õ±°ì((¼¨(€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3¢žK¢&Ë¢š[žª_¦jÇ¢^<(€€ƒ–¦Ë’ú¦‚¦v‹¢Ž‡–’k¦’cžjžº·¦‚·–"š>o–6–†+¾ò'¾òh(€€ƒ¢¢c’ö?¦gš²‡–¦‚¦v‹¦Ë’úšf¾ò3¦‚š&/¦jÇ¢^?’ê–N«’â–,(€€ƒŽ3Š^¢žK¢&Ë–B7ŠZÛŽ7žj–6–†+¾ò1É•ÍÑ½É•	½ÉÉ½Ý•‘±•µ•¹Ð ¤(€€ƒš¶ã’ö7šf¢š¢Êƒ¢Ê³š*+–ºžj¦†¿ž’ëž.š/š‹–ú§–n{’ú¾ò0(€€ƒ’â7žÛ–"¢ÖÃ’æ/–ú3¾ò3¦
–/¦‚¦v‹–Z»ž6£¢Š¯’öÿžR£šf(€€ƒ¾ò#’ú/–š’æ/–ú3–>¿¢÷¦
šr'–Û’î[–žR£–‚Óšf¿¾ò'šr(€€ƒ’âžnÓžÚ·š2¦jÇ¢^?Žš&û’â7–n{’úŽ(¨¼()±•Ð¡½µ••…ÑÕÉ•!¥‘‘•¹MÝ¥Ñ¡…Éô(€€€¹Õ±°ì(((¼¨(€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3’âï–~;ž®/žæ«¦j£š¦|(€€ƒ–"š>o¾ò'¾òk–§–ò×–rY‰…Í”ØÓ–Ÿ–Ö3¾ò3š¾?š²‡¦Ë–—’âï–~8(€€ƒ¦‚¦v‹šf¾ò!Í¡½ÝA…” §¢Ž‡–Fó–>¯¾ò3¢š/’â/¦vˆ(€€Í¡½Ý!½µ•A½ÉÑÉ…¥Ð §žj–Fó–>¯¦î{¾ò'¦j£š¦š2G’â–òÔ(€€ƒ¦†¿ž’ë¾ò3’â7šb¿š"Ã¦²—žR£žj¢žK¢&Ë–6‡ž&–r[¾ò3šb¿¦†7–’X(€€ƒšê[–
gžjž®/žæ«Ž(¨¼((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€XàäƒŠPƒ’îï–.g’î/¦v‹–Â#žR£š&/–.‹š¢‡–ò<(€€ƒ’îï–.g’öÿžR €ÅÕ•ÍÑQ…‰	½‘äƒ’ösž
ë–R¿’â–Ÿ–ÆÍÉ½±°½Ý¹•ËŽ(€€ƒ¦+š"Ëšr–’[–Æ“–:šr°Ñ½Õ µ…Ñ¥½¸é¹½¹—¾ò3–nƒš¶“–>«–r£’îï–.g¢š[žª\(€€ƒ¦Z/–Všr¦ZOšRû¢†0Á…¸µç¾òo’â7šZÃ–ŠxÑ½Õ ½Á½¥¹Ñ•È±¥ÍÑ•¹•ËŽ(ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼)™Õ¹Ñ¥½¸Í•ÑEÕ•ÍÑQ½Õ¡5½‘”¡…Ñ¥Ù”¥ì((€€€l(€€€€€€€‘½Õµ•¹Ð¹‘½Õµ•¹Ñ±•µ•¹Ð°(€€€€€€€‘½Õµ•¹Ð¹‰½‘ä°(€€€€€€€‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ‰…µ”µÙ¥•ÝÁ½ÉÐˆ¤°(€€€€€€€‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ‰…µ”µÍÑ…”ˆ¤(€€€t¹™½É… ¡™Õ¹Ñ¥½¸¡•±•µ•¹Ð¥ì((€€€€€€€¥˜ …•±•µ•¹Ð¥ì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€ô((€€€€€€€•±•µ•¹Ð¹±…ÍÍ1¥ÍÐ¹Ñ½±” (€€€€€€€€€€€€‰ÅÕ•ÍÐµÍÉ½±°µ…Ñ¥Ù”ˆ°(€€€€€€€€€€€€„……Ñ¥Ù”(€€€€€€€€¤ì((€€€ô¤ì()ô(()™Õ¹Ñ¥½¸½Á•¹!½µ••…ÑÕÉ”¡ÑåÁ”¥ì((€€€½¹ÍÐµ½‘…°ô(€€€€€€€€ ‰¡½µ••…ÑÕÉ•5½‘…°ˆ¤ì((€€€½¹ÍÐÑ¥Ñ±•°ô(€€€€€€€€ ‰¡½µ••…ÑÕÉ•5½‘…±Q¥Ñ±”ˆ¤ì((€€€½¹ÍÐ‰½‘å°ô(€€€€€€€€ ‰¡½µ••…ÑÕÉ•5½‘…±	½‘äˆ¤ì(((€€€¥˜ (€€€€€€€€…µ½‘…°ñð(€€€€€€€€…Ñ¥Ñ±•°ñð(€€€€€€€€…‰½‘å°(€€€€¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€±½Í•!½µ••…ÑÕÉ” ¤ì(((€€€¥˜¡ÑåÁ”ôôô‰É•ÍÐˆ¥ì((€€€€€€€Ñ¥Ñ±•°¹Ñ•áÑ½¹Ñ•¹Ðô(€€€€€€€€€€€€‹’âï–~;’òGš¼ˆì((€€€€€€€€¼¨(€€€€€€€€€€ƒŠbƒ’þ»š¶¾ò#’úwžŸ’öÿžR£¢–n{–‚Ç¾ò3Ž3–Þ‡š¨(€€€€€€€€€€ƒ¦‚¦v‹š2'¢«–.Wš"Ã¦²—¢ÞÏ–ëž¦ëžf÷š*¢÷¦‚¦v‹Ž7¾ò0(€€€€€€€€€€ƒ¢þ÷š~—–ú3žfóž>û–B3’â–-‰ÕŸ–Û–¾›–öÇ¦~ÿ’â'–,(€€€€€€€€€€ƒ–rÃšZç¾ò3¦g¢Ž‡¦‚’úÿ’â¢Öß’þ»š:'¾ò'¾òh(€€€€€€€€€€ƒ¦g–/–"šR¿–>«–Fó–>­‰½ÉÉ½Ý±•µ•¹Ñ%¹Ñ½5½‘…° ¤(€€€€€€€€€€ƒš*)¡½µ•I•ÍÑ…É“–¦Ë’ú¾ò3–ú{’úšÊKšr$(€€€€€€€€€€ƒšâž¦ë¦9‰½‘å³šr³¢ê¯žj¥¹¹•É!Q53Ž(€€€€€€€€€€ƒ–ššzsŽ3’â+’âš²‡Ž7¦Z/žjšb¿žR¡¥¹¹•É!Q50ô(€€€€€€€€€€ƒšVÓšº×¢N/š:'žj¦†{–z/¾ò#’ú/–šŽ3¢žK¢&ËŽ7ŠSŠP(€€€€€€€€€€ƒ¢Ž‡¦v‹šr'¦‚·–?–"š>o–"_Ž–"¦‚š2'¦"WŽ(€€€€€€€€€€¡…É…Ñ•ÉQ…‰½¹Ñ•¹Ó¾ò'¾ò3¦
’êošºcžVd(€€€€€€€€€€!Q53šr’âžnÓžVg–r¡‰½‘å³¢Ž‡¾ò3¦gš²‡–’ú(€€€€€€€€€€ƒžj–Ÿ–ºç–>«šb¿Ž3–*ƒŽ7–r£–ú3¦v‹¾ò3’â7šb¼(€€€€€€€€€€ƒŽ3–>[’îŽ7¾ò3ž:§–ºÛšržr/–"Ã’â+’âš²‡žj¢"((€€€€€€€€€€ƒžV¯¦v‹–6‡–r£šr’â+¦v‹ŽšZÃ–Ÿ–ºç¢Š¯š:£–"À(€€€€€€€€€€ƒ’â/¦v‹žr/’â7–"Ã¾ò#¢ššîû–.W–ú#–’kš&7žr/–ú_–"Ã¾ò0(€€€€€€€€€€ƒžRk¢Ïžr/¢Öß’ú–?šVÓ–/ž¦ëžf÷¾ò3–nƒž
ë¢žK¢&È(€€€€€€€€€€ƒ¦‚¦
–-¡…É…Ñ•ÉQ…‰½¹Ñ•¹Óšr³¢ê¬(€€€€€€€€€€ƒ–nƒž
ëŽ3–"¦‚¦®c–ê›¢š’â¢ÓŽ7žj¦ršÆ¾ò0(€€€€€€€€€€ƒ’þwžVg’ê’â–/–në–ºkžjµ¥¸µ¡•¥¡Ó¾ò0(€€€€€€€€€€ƒž¦ë¢F_žjšf–gžr/¢Öß’ú–ÂÇšb¿’â–’Ÿ–†((€€€€€€€€€€ƒž¦ëžf÷š†š†¾ò'Ž((€€€€€€€€€€ƒ’þ»šÎW¾òk¢Þ–Û’î[žR¡¥¹¹•É!Q50÷šVÓšº×¢N/š:$(€€€€€€€€€€ƒžj–"šR¿’âš¢¾ò3–#šâž¦é‰½‘å³¾ò3’þw¢¶$(€€€€€€€€€€ƒš¾?š²‡¦Z/¢š[žª_¦÷šb¿’æûšÞ£žj¢Öß¦î{¾ò3’â7žº„(€€€€€€€€€€ƒ’â+’âš²‡¦Z/žjšb¿’î¦êó¦†{–z/Ž(€€€€€€€€¨¼((€€€€€€€‰½‘å°¹¥¹¹•É!Q50ô(€€€€€€€€€€€€ˆˆì((€€€€€€€‰½ÉÉ½Ý±•µ•¹Ñ%¹Ñ½5½‘…° (€€€€€€€€€€€€ ‰¡½µ•I•ÍÑ…Éˆ¤°(€€€€€€€€€€€‰½‘å°(€€€€€€€€¤ì((€€€ô(€€€•±Í”¥˜¡ÑåÁ”ôôô‰•áÁA½½°ˆ¥ì((€€€€€€€Ñ¥Ñ±•°¹Ñ•áÑ½¹Ñ•¹Ðô(€€€€€€€€€€€€‹žÚO¦¦_šÆƒ–"¦4ˆì((€€€€€€€€¼¨(€€€€€€€€€€ƒŠbƒ’þ»š¶¾òk¢Þ’â+¦v‹Ž3’âï–~;’òGš¿Ž7–B3’â–,(€€€€€€€€€€‰ÕŸŽ–B3’â–/’þ»šÎW¾ò3–#šâž¦é‰½‘å³Ž(€€€€€€€€¨¼((€€€€€€€‰½‘å°¹¥¹¹•É!Q50ô(€€€€€€€€€€€€ˆˆì((€€€€€€€‰½ÉÉ½Ý±•µ•¹Ñ%¹Ñ½5½‘…° (€€€€€€€€€€€€ ‰¡½µ•áÁA½½±…Éˆ¤°(€€€€€€€€€€€‰½‘å°(€€€€€€€€¤ì((€€€ô(€€€•±Í”¥˜¡ÑåÁ”ôôô‰Í¡½Àˆ¥ì((€€€€€€€Ñ¥Ñ±•°¹Ñ•áÑ½¹Ñ•¹Ðô(€€€€€€€€€€€€‹–V–ê\ˆì((€€€€€€€‰½‘å°¹¥¹¹•É!Q50ô(€€€€€€€€€€€É•¹‘•ÉM¡½Á½¹Ñ•¹Ð ¤ì((€€€ô(€€€•±Í”¥˜¡ÑåÁ”ôôô‰¡…É…Ñ•Èˆ¥ì((€€€€€€€Ñ¥Ñ±•°¹Ñ•áÑ½¹Ñ•¹Ðô(€€€€€€€€€€€€‹¢žK¢&Èˆì(((€€€€€€€€¼¨(€€€€€€€€€€ƒŠbƒšZÃ–Š{¾òk¢žK¢&Ë¦‚¦v‹–Ÿ–ºçš¾S¢ò–’h(€€€€€€€€€€ƒ¾ò#–¦Ë’úžjšVÓ¦‚–Ÿ–ºç¾ò'¾ò3––_žR£–*ƒ–¾°(€€€€€€€€€€ƒš¢–ò?¾ò1±½Í•!½µ••…ÑÕÉ” §¦^s¦Z'šf(€€€€€€€€€€ƒšr¢«–.Wš.ÿš:'¾ò3’â7–öÇ¦~ÿ–Û’î[’â¢"³–’Ÿ–Â<(€€€€€€€€€€ƒžj¢š[žª_Ž(€€€€€€€€¨¼((€€€€€€€½¹ÍÐ‰½àô((€€€€€€€€€€€µ½‘…°¹ÅÕ•ÉåM•±•Ñ½È (€€€€€€€€€€€€€€€€ˆ¹¡½µ”µ™•…ÑÕÉ”µµ½‘…°µ‰½àˆ(€€€€€€€€€€€€¤ì(((€€€€€€€¥˜¡‰½à¥ì((€€€€€€€€€€€‰½à¹±…ÍÍ1¥ÍÐ¹…‘ (€€€€€€€€€€€€€€€€‰Ý¥‘”ˆ(€€€€€€€€€€€€¤ì((€€€€€€€ô(((€€€€€€€€¼¨(€€€€€€€€€€ƒŠbƒ’þ»š¶¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3¢š[žª_¢š(€€€€€€€€€€ƒšRû–’Ÿ–"Ãš:—¢þGšîÿž&#¾ò'¾òk–Ÿ–Æ“¢š[žª_¢º+š"@(€€€€€€€€€€€ÄÀÁÙß’æ/–ú3¾ò3–’[–Æ“¦»žö§¾ò ¹¡½µ”µ™•…ÑÕÉ”´(€€€€€€€€€€µ½‘…³¾ò'šr³¢ê¯¦
šr$ÈÁÁãžjÁ…‘‘¥¹Ÿ¾ò0(€€€€€€€€€€ƒšr¢ºO–Ÿ–Æ“¢š[žª_¢Ú–ë¢z‹–æWŽžR‹žRšÂÓ–æÌ(€€€€€€€€€€ƒš6Ë–.WŽ¦g¢Ž‡¦‚’úÿš*+–’[–Æ“¦»žö§žjÁ…‘‘¥¹œ(€€€€€€€€€€ƒ’æšRÛš:'¾ò3–§–Æ“’â¢Öß¢fWžBš&7šržržj¢Êó¦ö((€€€€€€€€€€ƒ¢z‹–æW¦
+žÞŽ(€€€€€€€€¨¼((€€€€€€€µ½‘…°¹±…ÍÍ1¥ÍÐ¹…‘ (€€€€€€€€€€€€‰¹¼µÁ…‘‘¥¹œˆ(€€€€€€€€¤ì(((€€€€€€€‰½‘å°¹¥¹¹•É!Q50ô(€€€€€€€€€€€É•¹‘•É¡…É…Ñ•ÉM¡½Ý…Í•½¹Ñ•¹Ð ¤ì(((€€€€€€€€¼¨(€€€€€€€€€€ƒŠbƒ’þ»š¶¾òk¦‚C¢¢·’âš&O¦Z/–ÂÇ¦ãž²³’â¢žK¢&ËŽ(€€€€€€€€€€ƒ¦†¿ž’ë¢÷–*o–ó–"¦‚ŠSŠSšRç–Fó–>¬(€€€€€€€€€€Í•±•Ñ¡…É…Ñ•É½ÉQ…‰Ì À§¢3’â7šb¼(€€€€€€€€€€ƒžnÓš:•ÍÝ¥Ñ¡¡…É…Ñ•ÉQ…ˆ ‰ÍÑ…ÑÕÌˆ§¾ò0(€€€€€€€€€€ƒ¦gš¢’â'–/¦‚¦v‹žj¢žK¢&Ëž.š/–ú{’â¦Z/–ž,(€€€€€€€€€€ƒ–ÂÇšb¿–B3š¶—žj¾ò3’â7žR£ž¶'ž:§–ºÛ¢«–ÞÇ¦î{’âš²„(€€€€€€€€€€ƒ¦‚·–?š&7–Â7¦ö+Ž(€€€€€€€€¨¼((€€€€€€€Í•±•Ñ¡…É…Ñ•É½ÉQ…‰Ì (€€€€€€€€€€€€À(€€€€€€€€¤ì((€€€€€€€ÍÝ¥Ñ¡¡…É…Ñ•ÉQ…ˆ (€€€€€€€€€€€€‰ÍÑ…ÑÕÌˆ(€€€€€€€€¤ì((€€€€€€€¥˜¡Ý¥¹‘½Ü¹Íå¹¡…É…Ñ•ÉQ½Õ¡5½‘”¥ì(€€€€€€€€€€€Ý¥¹‘½Ü¹Íå¹¡…É…Ñ•ÉQ½Õ¡5½‘” ¤ì(€€€€€€€ô((€€€ô(€€€•±Í”¥˜¡ÑåÁ”ôôô‰™½Éµ…Ñ¥½¸ˆ¥ì(€€€€€€€Ñ¥Ñ±•°¹Ñ•áÑ½¹Ñ•¹Ðô‹’ö#¦fŒˆì(€€€€€€€‰½‘å°¹¥¹¹•É!Q50ô(€€€€€€€€€€€ÑåÁ•½˜Ý¥¹‘½Ü¹Ù¥á•‘I•¹‘•É±±å½Éµ…Ñ¥½¹½¹Ñ•¹Ðôôô‰™Õ¹Ñ¥½¸ˆ(€€€€€€€€€€€€üÝ¥¹‘½Ü¹Ù¥á•‘I•¹‘•É±±å½Éµ…Ñ¥½¹½¹Ñ•¹Ð ¤(€€€€€€€€€€€€è€ˆˆì(€€€ô(€€€•±Í”¥˜¡ÑåÁ”ôôô‰½™™±¥¹•áÀˆ¥ì((€€€€€€€Ñ¥Ñ±•°¹Ñ•áÑ½¹Ñ•¹Ðô(€€€€€€€€€€€€‹¦n‹žÞkžÚO¦¦\ˆì((€€€€€€€‰½‘å°¹¥¹¹•É!Q50ô(€€€€€€€€€€€É•¹‘•É=™™±¥¹•áÁ½¹Ñ•¹Ð ¤ì((€€€ô(€€€•±Í”¥˜¡ÑåÁ”ôôô‰ÅÕ•ÍÐˆ¥ì((€€€€€€€Ñ¥Ñ±•°¹Ñ•áÑ½¹Ñ•¹Ðô(€€€€€€€€€€€€‹’îï–.dˆì((€€€€€€€€¼¨(€€€€€€€€€€Xàç¾òk’îï–.g’â7–7šÊÿžR£–V–ê_žj’â¢"°É½Ü½‰ÕÑÑ½¸ƒž&#–z/Ž(€€€€€€€€€€ƒ–>«–r£’îï–.g¦Z/–Všr¦ZO––_žR£–Â#žR µ½‘…°ƒžÖCšž/¢"š&/–.‹š¢‡–ò?Ž(€€€€€€€€¨¼(€€€€€€€µ½‘…°¹±…ÍÍ1¥ÍÐ¹…‘ (€€€€€€€€€€€€‰ÅÕ•ÍÐµµ½‘”ˆ(€€€€€€€€¤ì((€€€€€€€Í•ÑEÕ•ÍÑQ½Õ¡5½‘” (€€€€€€€€€€€ÑÉÕ”(€€€€€€€€¤ì((€€€€€€€•¹ÍÕÉ•…¥±åEÕ•ÍÑÍÕÉÉ•¹Ð ¤ì((€€€€€€€‘…¥±åEÕ•ÍÑMÑ…Ñ”¹ÁÉ½É•ÍÌ¹¡•­¥¸ô(€€€€€€€€€€€€Äì((€€€€€€€‰½‘å°¹¥¹¹•É!Q50ô(€€€€€€€€€€€É•¹‘•ÉEÕ•ÍÑQ…‰½¹Ñ•¹Ð (€€€€€€€€€€€€€€€€‰‘…¥±äˆ(€€€€€€€€€€€€¤ì((€€€ô(€€€•±Í”¥˜¡ÑåÁ”ôôô‰‰•ÍÑ¥…Éäˆ¥ì((€€€€€€€Ñ¥Ñ±•°¹Ñ•áÑ½¹Ñ•¹Ðô(€€€€€€€€€€€€‹–r[¦FDˆì((€€€€€€€‰½‘å°¹¥¹¹•É!Q50ô(€€€€€€€€€€€É•¹‘•É	•ÍÑ¥…Éå½¹Ñ•¹Ð ¤ì((€€€ô(€€€•±Í”¥˜¡ÑåÁ”ôôô‰…¡¥•Ù•µ•¹Ðˆ¥ì((€€€€€€€Ñ¥Ñ±•°¹Ñ•áÑ½¹Ñ•¹Ðô(€€€€€€€€€€€€‹š"C–ÂÄˆì((€€€€€€€‰½‘å°¹¥¹¹•É!Q50ô(€€€€€€€€€€€É•¹‘•É¡¥•Ù•µ•¹Ñ½¹Ñ•¹Ð ¤ì((€€€ô(€€€•±Í”¥˜¡ÑåÁ”ôôô‰…¹¹½Õ¹•µ•¹Ðˆ¥ì((€€€€€€€Ñ¥Ñ±•°¹Ñ•áÑ½¹Ñ•¹Ðô(€€€€€€€€€€€€‹–³–F(ˆì((€€€€€€€‰½‘å°¹¥¹¹•É!Q50ô(€€€€€€€€€€€É•¹‘•É¹¹½Õ¹•µ•¹Ñ½¹Ñ•¹Ð ¤ì((€€€ô(€€€•±Í”¥˜¡ÑåÁ”ôôô‰ÍåÍÑ•´ˆ¥ì((€€€€€€€Ñ¥Ñ±•°¹Ñ•áÑ½¹Ñ•¹Ðô(€€€€€€€€€€€€‹žÎïžÖÄˆì((€€€€€€€‰½‘å°¹¥¹¹•É!Q50ô(€€€€€€€€€€€É•¹‘•ÉMåÍÑ•µ½¹Ñ•¹Ð ¤ì((€€€ô(€€€•±Í”¥˜¡ÑåÁ”ôôô‰…ÕÑ½	…ÑÑ±•M•ÑÑ¥¹Ìˆ¥ì((€€€€€€€€¼¨(€€€€€€€€€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3Ž3¢«–.T(€€€€€€€€€€ƒš"Ã¦²—šRû¦Ë’â/¦v‹–Â;¢š÷–"_¾ò3š2'’â/–:ï¢ÞÏ–è(€€€€€€€€€€ƒ¢¢·–ºk¢š[žª_Ž7¾ò'¾òh(€€€€€€€€€€ƒ–:šr°…ÕÑ½	…ÑÑ±•M•ÑÑ¥¹ÍA…¹•°(€€€€€€€€€€ƒ¦
––_šb¿¢«–ÞÇ–ršÎWž'¦.óžº]Á½Í¥Ñ¥½¸è(€€€€€€€€€€™¥á•“–êŸš¢gŽ–>›–’[šB³–"Á‘½Õµ•¹Ð¹‰½‘ä(€€€€€€€€€€ƒ–êW’â/¦†¿ž’ë¾ò3ž&÷šÚ%‰…ÑÑ±•A…—žj(€€€€€€€€€€‘¥ÍÁ±…äé¹½¹—Ž¢†3–Ÿš¢–ò?¢š¢N/ž¶$(€€€€€€€€€€ƒ––÷–æû–Æ“–V?¦†3¾ò3š~—¢¶'–ú3–ÂÇšb¿¦g’âšVÓ––\(€€€€€€€€€€ƒ¢«¢¢–ºk’ö7¦
?¢ò¿šr³¢ê¯–ºçšbO–r£Ž3’â7–r (€€€€€€€€€€ƒš"Ã¦²—’â·Ž7žjš–Š–ë¦2¿¾ò3š&7šršr$(€€€€€€€€€€ƒŽ3š2'’â/–:ïšÊK–>7š'Ž7žjž.šÎŽ((€€€€€€€€€€ƒ¦g¢Ž‡’â7’þ»¦
––_¢"+¦
?¢ò¿¾ò3¢3šb¿žnÓš:”(€€€€€€€€€€ƒšRçžR£šVÓ–/¦+š"Ë–ÇžR£Ž–ÞËžÚO¦¦_¢¶'¦8(€€€€€€€€€€ƒ–ú#–’kš²‡¦÷š¶–âã¦/’ösžj(€€€€€€€€€€½Á•¹!½µ••…ÑÕÉ” §–ö#žª_žÎïžÖÇŠSŠP(€€€€€€€€€€ƒ–žR£–B3’â–,…ÕÑ½	…ÑÑ±•M•ÑÑ¥¹ÍA…¹•°(€€€€€€€€€€ƒ¾ò#š²’ö4¿’â/š.'¦ã–Z»–º3–£’â7žR£¦7–k¾ò'¾ò0(€€€€€€€€€€ƒ’öžR¡‰½ÉÉ½Ý±•µ•¹Ñ%¹Ñ½5½‘…° ¤(€€€€€€€€€€ƒ–†{¦Ë¦g–/–ö#žª_žj‰½‘ç¾ò3¢ÞŽ3’òGš¿Ž4(€€€€€€€€€€ƒŽ3žÚO¦¦_šÆƒ–"¦7Ž7žR£žjšb¿–B3’âš.o¾ò0(€€€€€€€€€€ƒ’â7–7¦r¢š¢«–ÞÇžº_–êŸš¢gŽ¢«–ÞÇžº„(€€€€€€€€€€èµ¥¹‘•ãŽ(€€€€€€€€¨¼((€€€€€€€Ñ¥Ñ±•°¹Ñ•áÑ½¹Ñ•¹Ðô(€€€€€€€€€€€€‹¢«–.Wš"Ã¦²—¢¢·–ºhˆì(((€€€€€€€€¼¨(€€€€€€€€€€ƒŠbƒ’þ»š¶¾ò#’úwžŸ’öÿžR£¢–n{–‚Ç¾ò3Ž3–Þ‡š¨(€€€€€€€€€€ƒ¦‚¦v‹š2'¢«–.Wš"Ã¦²—¢ÞÏ–ëž¦ëžf÷š*¢÷¦‚¦v‹Ž7¾ò'¾òh(€€€€€€€€€€ƒžrš¶–:–nƒš&û–"Ã’êŠSŠS¦g–/–"šR¿–ú{¦‚·–"Ã–Âø(€€€€€€€€€€ƒ–>«žR¡‰½ÉÉ½Ý±•µ•¹Ñ%¹Ñ½5½‘…° §š*((€€€€€€€€€€…ÕÑ½	…ÑÑ±•M•ÑÑ¥¹ÍA…¹•³–¦Ë’ú¾ò0(€€€€€€€€€€ƒ–ú{’úšÊKšâž¦ë¦9‰½‘å³šr³¢ê¯žj¥¹¹•É!Q53Ž(€€€€€€€€€€ƒ–ššzs’â+’âš²‡¦Z/žjšb¿Ž3¢žK¢&ËŽ7¾ò#žR (€€€€€€€€€€¥¹¹•É!Q50÷šVÓšº×¢N/š:'¾ò3¢Ž‡¦v‹šr'¦‚·–<(€€€€€€€€€€ƒ–"š>o–"_Ž–"¦‚š2'¦"WŽ(€€€€€€€€€€¡…É…Ñ•ÉQ…‰½¹Ñ•¹Ó¾ò'¾ò1±½Í•!½µ••…ÑÕÉ” ¤(€€€€€€€€€€ƒ–>«šrš*+Ž3–¢ÖÃžj–¶C¦‚¦v‹Ž7¾ò#’ú/–š(€€€€€€€€€€Í­¥±±A…—¾ò'š¶ã’ö7¾ò3’â›’â7šršâš:$(€€€€€€€€€€‰½‘å°¹¥¹¹•É!Q53šr³¢ê¯¦
–Æ“ŠSŠS¦
–Æ(€€€€€€€€€€ƒ¢žK¢&Ë¦‚žj–’[šºó¾ò#¦‚·–<¯–"¦‚š2'¦"T¬(€€€€€€€€€€ƒ’â–/–nƒž
ëŽ3–"¦‚¢šž¶'¦®cŽ7¢3’þwžVd(€€€€€€€€€€ƒ–në–ºk¦®c–ê›žjž¦é¡…É…Ñ•ÉQ…‰½¹Ñ•¹Ó¾ò$(€€€€€€€€€€ƒšr’âžnÓ–6‡–r¡‰½‘å³¢Ž‡¾ò3¦gš²‡–’úžj(€€€€€€€€€€ƒ¢¢·–ºk¦v‹švÿ–>«šb¿Ž3–*ƒŽ7–r£–º–ú3¦v‹¾ò0(€€€€€€€€€€ƒ’â7šb¿Ž3–>[’îŽ7–ºŽž:§–ºÛžr/–"Ãžj–ÂÇšb¼(€€€€€€€€€€ƒ’öÿžR£¢š"«–r[¦
š¢¾òk’â+¦v‹¦
šb¿¢žK¢&Ë¦‚žj(€€€€€€€€€€ƒ–"¦‚š2'¦"W¾ò3’â/¦v‹’â–’Ÿ–†+ž¦ëžf÷¾ò#¦
–,(€€€€€€€€€€ƒž¦ëžj¡…É…Ñ•ÉQ…‰½¹Ñ•¹Ó¾ò'¾ò0(€€€€€€€€€€ƒ¢¢·–ºk¦v‹švÿšr³¢ê¯–Û–¾›¦
–r£¾ò3–>«šb¿¢Š¬(€€€€€€€€€€ƒš:£–"ÃšnÓ’â/¦v‹¾ò3žV¯¦v‹’â+–º3–£žr/’â7–"ÃŽ((€€€€€€€€€€ƒ¢ÞŽ3’âï–~;’òGš¿Ž7Ž3žÚO¦¦_šÆƒ–"¦7Ž4(€€€€€€€€€€ƒ–B3’â–-‰ÕŸŽ–B3’â–/’þ»šÎW¾òk–#šâž¦è(€€€€€€€€€€‰½‘å³¾ò3’þw¢¶'š¾?š²‡¦Z/¢š[žª_¦÷šb¿’æûšÞ (€€€€€€€€€€ƒ¢Öß¦î{Ž(€€€€€€€€¨¼((€€€€€€€‰½‘å°¹¥¹¹•É!Q50ô(€€€€€€€€€€€€ˆˆì(((€€€€€€€½¹ÍÐÁ…¹•°ô(€€€€€€€€€€€€ ‰…ÕÑ½	…ÑÑ±•M•ÑÑ¥¹ÍA…¹•°ˆ¤ì(((€€€€€€€¥˜¡Á…¹•°¥ì((€€€€€€€€€€€€¼¨(€€€€€€€€€€€€€€ƒŠbƒ’þ»š¶¾ò#’úwžŸ’öÿžR£¢–n{–‚Ç¾ò3Ž3¦g’êl(€€€€€€€€€€€€€€ƒš2'¦"W¦÷šÊK–>7š'Ž7¾ò/Ž3¢¢·–ºk¦‚¦v‹¦vƒ’â+¦vˆ(€€€€€€€€€€€€€€ƒ–ú#¦sŽ7¾ò'¾òh(€€€€€€€€€€€€€€ƒžrš¶žj–:–nƒš&û–"Ã’êŠSŠS’â+¦v‹¦gšº×–>¨(€€€€€€€€€€€€€€ƒšâš:'Ž3¢†3–ŸŽ7–ºk’ö7š¢–ò?¾ò3’ö(€€€€€€€€€€€€€€€…ÕÑ½	…ÑÑ±•M•ÑÑ¥¹ÍA…¹•³¦g–,(€€€€€€€€€€€€€€ƒ–žÒƒšr³¢ê¯žjML±…ÍÌ(€€€€€€€€€€€€€€ƒ¾ò ¹…ÕÑ¼µÍ•ÑÑ¥¹Ìµ•áÁ…¹‘•“¾ò$(€€€€€€€€€€€€€€ƒ–¾¯š¶ï’êÁ½Í¥Ñ¥½¸é…‰Í½±ÕÑ—¾òl(€€€€€€€€€€€€€€Ñ½ÀèÃ¾òm±•™ÐèÃ¾òmÉ¥¡ÐèÃ¾òl(€€€€€€€€€€€€€€¡•¥¡ÐèÌØÁÁã¾òmèµ¥¹‘•àèäà(€€€€€€€€€€€€€€ƒ¾ò#–:šr³šb¿¢¢·¢¢#žÖ™‰…ÑÑ±•A…—¢Ž„(€€€€€€€€€€€€€€ƒŽ3¢N/–r£¢žK¢&Ë–6‡ž&3’â+¦v‹Ž7¦
ž¢»žR£šÎW¾ò'Ž(€€€€€€€€€€€€€€ƒ¢†3–Ÿš¢–ò?šâš"@ˆ‹’æ/–ú3¾ò3ž?¢š÷–f£šr(€€€€€€€€€€€€€€™…±±‰…¯–n{¦g–-±…ÍÏšr³¢ê¯žj¢¢·–ºk¾ò0(€€€€€€€€€€€€€€ƒž¶'šZó¦v‹švÿ¦
šb½Á½Í¥Ñ¥½¸é…‰Í½±ÕÑ—¾ò0(€€€€€€€€€€€€€€ƒ¢3’âS–nƒž
è¹¡½µ”µ™•…ÑÕÉ”µµ½‘…°µ‰½à(€€€€€€€€€€€€€€ƒšÊKšr'¢¢µÁ½Í¥Ñ¥½»¾ò3šr¢þGžjŽ3–ÞË–ºk’ö4(€€€€€€€€€€€€€€ƒž–[–#Ž7¢º+š"@¹¡½µ”µ™•…ÑÕÉ”µµ½‘…°(€€€€€€€€€€€€€€ƒšr³¢ê¯¾ò!Á½Í¥Ñ¥½¸é™¥á•í¥¹Í•ÐèÃ¾ò'¾ò0(€€€€€€€€€€€€€€ƒ¦v‹švÿ–ÂÇšršVÓ–/¢Êó¦ö+¦
–/–£¢z‹–æW¦»žö¤(€€€€€€€€€€€€€€ƒžj–Þ›’â+¢žKŠSŠS¦g–ÂÇšb¿Ž3¦vƒ’â+¦v‹–ú#¦sŽ4(€€€€€€€€€€€€€€ƒžj–:–nƒ¾òo–r¡M…µÍÕ¹œ	É½ÝÍ•Ë¦g¦†x(€€€€€€€€€€€€€€ƒš&/š¦ž?¢š÷–f£’â+¾ò3¦gž¢»Ž1Á½Í¥Ñ¥½¸è(€€€€€€€€€€€€€€…‰Í½±ÕÑ—¦–ë¦‚Cšržjš:Kž&#’ö7žö»Ž4(€€€€€€€€€€€€€€ƒ¦
–âã–âã’òÓ¦j£¦î{šN+–êŸš¢g–Â7’â7šê[¾ò#–Â“–Ø(€€€€€€€€€€€€€€ƒžÚË–v–"_šîG–è¿šîG–—Ž¢š[žª_¦®c–ê›šÖ»–.T(€€€€€€€€€€€€€€ƒžjšf–g¾ò'¾ò3¦g–ÂÇšb¿Ž3š2'¦"W¦÷šÊK–>7š'Ž4(€€€€€€€€€€€€€€ƒžj–:–nƒŽ((€€€€€€€€€€€€€€ƒ¦g¢Ž‡’â7¢÷–>«šâ¢†3–Ÿš¢–ò?¾ò3¢šŽ3šb;žŠè(€€€€€€€€€€€€€€ƒ¢N/š:'Ž5±…ÍÏšr³¢ê¯žj¢¢·–ºk¾òkšRçš"@(€€€€€€€€€€€€€€Á½Í¥Ñ¥½¸éÍÑ…Ñ¥Ž¡•¥¡Ðé…ÕÑ¿¾ò0(€€€€€€€€€€€€€€ƒ¢ºO¦v‹švÿžržj–n{–"À¡½µ••…ÑÕÉ•5½‘…±	½‘ä(€€€€€€€€€€€€€€ƒžjš¶–âãšZ’îÛšÖ¢Ž‡¦v‹¾ò3¢ÞŽ3’òGš¿Ž4(€€€€€€€€€€€€€€ƒŽ3žÚO¦¦_šÆƒ–"¦7Ž7¦
’êo’âš¢š¶–âã¦†¿ž’ëŽ(€€€€€€€€€€€€€€ƒš¶–âã–B–ú_–"Ã¦î{šN+’ê/’îÛŽ(€€€€€€€€€€€€¨¼((€€€€€€€€€€€Á…¹•°¹ÍÑå±”¹Á½Í¥Ñ¥½¸ô(€€€€€€€€€€€€€€€€‰ÍÑ…Ñ¥Œˆì((€€€€€€€€€€€Á…¹•°¹ÍÑå±”¹Ñ½Àô(€€€€€€€€€€€€€€€€ˆˆì((€€€€€€€€€€€Á…¹•°¹ÍÑå±”¹±•™Ðô(€€€€€€€€€€€€€€€€ˆˆì((€€€€€€€€€€€Á…¹•°¹ÍÑå±”¹É¥¡Ðô(€€€€€€€€€€€€€€€€ˆˆì((€€€€€€€€€€€Á…¹•°¹ÍÑå±”¹‰½ÑÑ½´ô(€€€€€€€€€€€€€€€€ˆˆì((€€€€€€€€€€€Á…¹•°¹ÍÑå±”¹¡•¥¡Ðô(€€€€€€€€€€€€€€€€‰…ÕÑ¼ˆì((€€€€€€€€€€€Á…¹•°¹ÍÑå±”¹é%¹‘•àô(€€€€€€€€€€€€€€€€ˆˆì((€€€€€€€€€€€Á…¹•°¹ÍÑå±”¹µ…á!•¥¡Ðô(€€€€€€€€€€€€€€€€ˆˆì((€€€€€€€€€€€Á…¹•°¹±…ÍÍ1¥ÍÐ¹É•µ½Ù” (€€€€€€€€€€€€€€€€‰™±½…Ñ¥¹œµµ½‘…°ˆ(€€€€€€€€€€€€¤ì(((€€€€€€€€€€€‰½ÉÉ½Ý±•µ•¹Ñ%¹Ñ½5½‘…° (€€€€€€€€€€€€€€€Á…¹•°°(€€€€€€€€€€€€€€€‰½‘å°(€€€€€€€€€€€€¤ì(((€€€€€€€€€€€Á…¹•°¹ÍÑå±”¹‘¥ÍÁ±…äô(€€€€€€€€€€€€€€€€‰™±•àˆì((€€€€€€€ô(((€€€€€€€€¼¨(€€€€€€€€€€ƒŠbƒ’þ»š¶¾ò#’úwžŸ’öÿžR£¢šršZÃ¢ššÆ¾ò3Ž3ž
ë’î¦êóšr'šf–d(€€€€€€€€€€ƒ¢«–.Wš"Ã¦²—¢¢·–ºk¦‚¦v‹–ú#žö»’â·¾ò3šr'šf–g–ú#¦vƒ’â/¦v‹¾ò3¦÷š*((€€€€€€€€€€ƒ–º–në–ºkžö»’â·¾òoš*+šVÓ–/¦‚¦v‹šRû–’Ÿ¢ºOšZ–¶_¦÷¢÷–†{¦Ë–:ï¾ò0(€€€€€€€€€€ƒ’â7¢š¢ºO’î[š6Ë–.WŽ7¾ò'¾òh(€€€€€€€€€€ƒ¦g¢Ž‡–:šr³’úwžŸšnÓš^§’â¢ò«žj¢ššÆ–*ƒ’ê‘½¬µ‰½ÑÑ½·š¢–ò<(€€€€€€€€€€ƒ¾ò#š"Ã¦²—’â·¢ºO¢š[žª_¢Êó¦ö+žV¯¦v‹’â/žÞžjš"Ã¦²—¢Î¢¢+š†¾ò'¾ò3¦gš¶šb¼(€€€€€€€€€€ƒŽ3šr'šf–gžö»’â·Žšr'šf–g¦vƒ’â/¦v‹Ž7žj–:–nƒŠSŠSš"Ã¦²—’â·¢Êó–êWŽ(€€€€€€€€€€ƒ’â7–r£š"Ã¦²—’â·žö»’â·¾ò3–§ž¢»ž.š/’ê“šnÿ–ëž>ûŽ’öÿžR£¢ž>û–r (€€€€€€€€€€ƒšb;žŠë¢ššÆŽ3¦÷–në–ºkžö»’â·Ž7¾ò3šRçš"C–º3–£’â7–7–*‘½¬µ‰½ÑÑ½´(€€€€€€€€€€ƒ¦g–-±…ÍÏ¾ò3’â7žº‡–r£’â7–r£š"Ã¦²—’â·¦÷žÚ·š2(€€€€€€€€€€€¹¡½µ”µ™•…ÑÕÉ”µµ½‘…³¦‚C¢¢·žjžö»’â·¦†¿ž’ëŽ((€€€€€€€€€€ƒ–B3šfš*+¢š[žª_šr³¢ê¯¾ò ¹¡½µ”µ™•…ÑÕÉ”µµ½‘…°µ‰½ã¾ò'žj(€€€€€€€€€€µ…àµ¡•¥¡ÓšRû–¾³–"ÀäÙ‘Ù£¾ò#–:šr³š"Ã¦²—’â·–>«šr$àÁ‘Ù£¾ò0(€€€€€€€€€€ƒ¦v{š"Ã¦²—’â·–ÞËžÚOšb¼äÙ‘Ù£¾ò3¦g¢Ž‡žÖÇ’âš"C’â7–"š–Š¦÷žR (€€€€€€€€€€€äÙ‘Ù£¾ò'¾ò3žn‡¦?¢ºO–Ÿ–ºç’âš²‡–ÂÇ¢÷–º3šVÓ¦†¿ž’ëŽ’â7žR£š6Ë–.WŽ(€€€€€€€€¨¼((€€€€€€€½¹ÍÐÍ•ÑÑ¥¹Í	½àô(€€€€€€€€€€€µ½‘…°¹ÅÕ•ÉåM•±•Ñ½È (€€€€€€€€€€€€€€€€ˆ¹¡½µ”µ™•…ÑÕÉ”µµ½‘…°µ‰½àˆ(€€€€€€€€€€€€¤ì(((€€€€€€€¥˜¡Í•ÑÑ¥¹Í	½à¥ì((€€€€€€€€€€€Í•ÑÑ¥¹Í	½à¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä (€€€€€€€€€€€€€€€€‰µ…àµ¡•¥¡Ðˆ°(€€€€€€€€€€€€€€€€ˆäÙ‘Ù ˆ°(€€€€€€€€€€€€€€€€‰¥µÁ½ÉÑ…¹Ðˆ(€€€€€€€€€€€€¤ì((€€€€€€€ô(((€€€€€€€½¹ÍÐ¡…É…Ñ•ÉM•±•Ðô(€€€€€€€€€€€€ ‰…ÕÑ½M•ÑÑ¥¹Í¡…É…Ñ•ÉM•±•Ðˆ¤ì(((€€€€€€€¥˜¡¡…É…Ñ•ÉM•±•Ð¥ì((€€€€€€€€€€€½¹ÍÐ½ÁÑ¥½¸Àô(€€€€€€€€€€€€€€€€ ‰…ÕÑ½M•ÑÑ¥¹Í¡…É=ÁÑ¥½¸Àˆ¤ì(((€€€€€€€€€€€¥˜¡½ÁÑ¥½¸À¥ì((€€€€€€€€€€€€€€€½ÁÑ¥½¸À¹Ñ•áÑ½¹Ñ•¹Ðô((€€€€€€€€€€€€€€€€€€€Á±…å•È¹¥‘ñð(€€€€€€€€€€€€€€€€€€€€‹¢žK¢&ÈÄˆì((€€€€€€€€€€€ô(((€€€€€€€€€€€½¹ÍÐ½ÁÑ¥½¸Äô(€€€€€€€€€€€€€€€€ ‰…ÕÑ½M•ÑÑ¥¹Í¡…É=ÁÑ¥½¸Äˆ¤ì(((€€€€€€€€€€€¥˜¡½ÁÑ¥½¸Ä¥ì((€€€€€€€€€€€€€€€½ÁÑ¥½¸Ä¹Ñ•áÑ½¹Ñ•¹Ðô((€€€€€€€€€€€€€€€€€€€Á±…å•ÈÈ(€€€€€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€€€€€Á±…å•ÈÈ¹¥(€€€€€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€€€€€€‹¢žK¢&ÈË¾ò#–Âkšr«–&×–îë¾ò$ˆì(((€€€€€€€€€€€€€€€½ÁÑ¥½¸Ä¹‘¥Í…‰±•ô(€€€€€€€€€€€€€€€€€€€€…Á±…å•ÈÈì((€€€€€€€€€€€ô((€€€€€€€€€€€½¹ÍÐ½ÁÑ¥½¸Èô(€€€€€€€€€€€€€€€€ ‰…ÕÑ½M•ÑÑ¥¹Í¡…É=ÁÑ¥½¸Èˆ¤ì((€€€€€€€€€€€¥˜¡½ÁÑ¥½¸È¥ì(€€€€€€€€€€€€€€€½ÁÑ¥½¸È¹Ñ•áÑ½¹Ñ•¹Ðô(€€€€€€€€€€€€€€€€€€€Á±…å•ÈÌ(€€€€€€€€€€€€€€€€€€€€üÁ±…å•ÈÌ¹¥(€€€€€€€€€€€€€€€€€€€€è€‹¢žK¢&ÈÏ¾ò#–Âkšr«–&×–îë¾ò$ˆì(€€€€€€€€€€€€€€€½ÁÑ¥½¸È¹‘¥Í…‰±•ô…Á±…å•ÈÌì(€€€€€€€€€€€ô(((€€€€€€€€€€€¡…É…Ñ•ÉM•±•Ð¹Ù…±Õ”ôˆÀˆì((€€€€€€€ô(((€€€€€€€ÍÝ¥Ñ¡ÕÑ½M•ÑÑ¥¹Í¡…É…Ñ•È (€€€€€€€€€€€ÑÉÕ”(€€€€€€€€¤ì((€€€ô(((€€€µ½‘…°¹±…ÍÍ1¥ÍÐ¹…‘ (€€€€€€€€‰Í¡½Üˆ(€€€€¤ì()ô(()™Õ¹Ñ¥½¸‰½ÉÉ½Ý±•µ•¹Ñ%¹Ñ½5½‘…° (€€€•±•µ•¹Ð°(€€€‰½‘å°(¥ì((€€€¥˜ …•±•µ•¹Ð¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€¡½µ••…ÑÕÉ•	½ÉÉ½Ý•‘±•µ•¹Ðô(€€€€€€€•±•µ•¹Ðì((€€€¡½µ••…ÑÕÉ•	½ÉÉ½Ý•‘A…É•¹Ðô(€€€€€€€•±•µ•¹Ð¹Á…É•¹Ñ9½‘”ì((€€€¡½µ••…ÑÕÉ•	½ÉÉ½Ý•‘9•áÑM¥‰±¥¹œô(€€€€€€€•±•µ•¹Ð¹¹•áÑM¥‰±¥¹œì(((€€€‰½‘å°¹…ÁÁ•¹‘¡¥± (€€€€€€€•±•µ•¹Ð(€€€€¤ì(((€€€•±•µ•¹Ð¹ÍÑå±”¹‘¥ÍÁ±…äô(€€€€€€€€‰‰±½¬ˆì()ô(((¼¨(€€ƒŠbƒ’þ»š¶¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3¢žK¢&Ë¦‚¦v‹¢š¢ô(€€ƒ–r£–B3’â–/¢š[žª_¢Ž‡–"š>o–"¦‚¾ò'¾òh(€€ƒš*+Ž3–’úžj–žÒƒš¶ã’ö7Ž7¦gšº×¦
?¢ò¿š*÷š"Cž6£ž®,(€€ƒ–÷–ò?¾ò1±½Í•!½µ••…ÑÕÉ” §¾ò#šVÓ–/¦^s¢š[žª_¾ò$(€€ƒ¢Þ}ÍÝ¥Ñ¡¡…É…Ñ•ÉQ…ˆ §¾ò#–>«šb¿š>o’â–,(€€ƒ–"¦‚Ž¢š[žª_¦
¦Z/¢F_¾ò'¦÷¢šžR£–"Ã–B3’â––_š¶ã’ö4(€€ƒ¦
?¢ò¿¾ò3’â7¢š¦7¢’–¾¯–§š²‡Ž(¨¼()™Õ¹Ñ¥½¸É•ÍÑ½É•	½ÉÉ½Ý•‘±•µ•¹Ð ¥ì((€€€€¼¨(€€€€€€ƒŠbƒšZÃ–Š{¾òk–#š*+–>¿¢÷¢Š¯¦jÇ¢^?žjžº·¦‚·–"š>l(€€€€€€ƒ–6–†+š‹–ú§¦†¿ž’ë¾ò3’â7žº‡¦gš²‡–žjšb¿–N«–,(€€€€€€ƒ¦‚¦v‹¾ò3¦÷¢š–#¢fWžB¾ò3¢Þ}¡½µ••…ÑÕÉ•	½ÉÉ½Ý•‘±•µ•¹Ð(€€€€€€ƒšb¿’â7šb½¹Õ±³ž‡¦^s¾ò#ž6£ž®/žj’â’î÷ž.š/¾ò'Ž(€€€€¨¼((€€€¥˜¡¡½µ••…ÑÕÉ•!¥‘‘•¹MÝ¥Ñ¡…É¥ì((€€€€€€€¡½µ••…ÑÕÉ•!¥‘‘•¹MÝ¥Ñ¡…É¹ÍÑå±”¹‘¥ÍÁ±…äô(€€€€€€€€€€€€ˆˆì(((€€€€€€€¡½µ••…ÑÕÉ•!¥‘‘•¹MÝ¥Ñ¡…Éô(€€€€€€€€€€€¹Õ±°ì((€€€ô(((€€€¥˜ …¡½µ••…ÑÕÉ•	½ÉÉ½Ý•‘±•µ•¹Ð¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€¡½µ••…ÑÕÉ•	½ÉÉ½Ý•‘±•µ•¹Ð¹ÍÑå±”¹‘¥ÍÁ±…äô(€€€€€€€€‰¹½¹”ˆì(((€€€¥˜ (€€€€€€€¡½µ••…ÑÕÉ•	½ÉÉ½Ý•‘9•áÑM¥‰±¥¹œ€˜˜(€€€€€€€¡½µ••…ÑÕÉ•	½ÉÉ½Ý•‘9•áÑM¥‰±¥¹œ¹Á…É•¹Ñ9½‘”ôôô(€€€€€€€¡½µ••…ÑÕÉ•	½ÉÉ½Ý•‘A…É•¹Ð(€€€€¥ì((€€€€€€€¡½µ••…ÑÕÉ•	½ÉÉ½Ý•‘A…É•¹Ð¹¥¹Í•ÉÑ	•™½É” (€€€€€€€€€€€¡½µ••…ÑÕÉ•	½ÉÉ½Ý•‘±•µ•¹Ð°(€€€€€€€€€€€¡½µ••…ÑÕÉ•	½ÉÉ½Ý•‘9•áÑM¥‰±¥¹œ(€€€€€€€€¤ì((€€€ô(€€€•±Í”¥˜¡¡½µ••…ÑÕÉ•	½ÉÉ½Ý•‘A…É•¹Ð¥ì((€€€€€€€¡½µ••…ÑÕÉ•	½ÉÉ½Ý•‘A…É•¹Ð¹…ÁÁ•¹‘¡¥± (€€€€€€€€€€€¡½µ••…ÑÕÉ•	½ÉÉ½Ý•‘±•µ•¹Ð(€€€€€€€€¤ì((€€€ô(((€€€¡½µ••…ÑÕÉ•	½ÉÉ½Ý•‘±•µ•¹Ðô(€€€€€€€¹Õ±°ì((€€€¡½µ••…ÑÕÉ•	½ÉÉ½Ý•‘A…É•¹Ðô(€€€€€€€¹Õ±°ì((€€€¡½µ••…ÑÕÉ•	½ÉÉ½Ý•‘9•áÑM¥‰±¥¹œô(€€€€€€€¹Õ±°ì()ô(()™Õ¹Ñ¥½¸±½Í•!½µ••…ÑÕÉ” ¥ì((€€€½¹ÍÐµ½‘…°ô(€€€€€€€€ ‰¡½µ••…ÑÕÉ•5½‘…°ˆ¤ì((€€€½¹ÍÐÉ•±•…Í•UÁ‘…Ñ”ô(€€€€€€€Ý¥¹‘½Ü¹½ÕÉMåµ‰½±ÍI•±•…Í•UÁ‘…Ñ”ì(€€€¥˜ (€€€€€€€É•±•…Í•UÁ‘…Ñ”˜˜(€€€€€€€ÑåÁ•½˜É•±•…Í•UÁ‘…Ñ”¹Í¡½Õ±‘AÉ•Ù•¹ÑM¡…É•‘5½‘…±±½Í”ôôô‰™Õ¹Ñ¥½¸ˆ˜˜(€€€€€€€É•±•…Í•UÁ‘…Ñ”¹Í¡½Õ±‘AÉ•Ù•¹ÑM¡…É•‘5½‘…±±½Í” ¤(€€€€¥ì(€€€€€€€¥˜¡ÑåÁ•½˜É•±•…Í•UÁ‘…Ñ”¹…¹¹½Õ¹•½É•‘1½¬ôôô‰™Õ¹Ñ¥½¸ˆ¥ì(€€€€€€€€€€€É•±•…Í•UÁ‘…Ñ”¹…¹¹½Õ¹•½É•‘1½¬ ¤ì(€€€€€€€ô(€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€ô((€€€¥˜ (€€€€€€€É•±•…Í•UÁ‘…Ñ”˜˜(€€€€€€€ÑåÁ•½˜É•±•…Í•UÁ‘…Ñ”¹½¹M¡…É•‘5½‘…±±½Í•ôôô‰™Õ¹Ñ¥½¸ˆ(€€€€¥ì(€€€€€€€É•±•…Í•UÁ‘…Ñ”¹½¹M¡…É•‘5½‘…±±½Í• ¤ì(€€€ô(((€€€¥˜¡µ½‘…°¥ì((€€€€€€€µ½‘…°¹±…ÍÍ1¥ÍÐ¹É•µ½Ù” (€€€€€€€€€€€€‰Í¡½Üˆ(€€€€€€€€¤ì(((€€€€€€€€¼¨(€€€€€€€€€€ƒŠbƒšZÃ–Š{¾òk¦^s¦Z'¢š[žª_šf¾ò3–ššzs––_žR£¦8(€€€€€€€€€€ƒŽ3¢žK¢&Ë¦‚¦v‹žR£žj–*ƒ–¾³š¢–ò?Ž7¾ò3’â’öÔ(€€€€€€€€€€ƒš.ÿš:'¾ò3’â7šr–öÇ¦~ÿ’â/š²‡¦Z/–V–ê\¿’îï–.d(€€€€€€€€€€ƒ¦gž¢»’â¢"³–’Ÿ–Â?žj¢š[žª_Ž(€€€€€€€€¨¼((€€€€€€€½¹ÍÐ‰½àô((€€€€€€€€€€€µ½‘…°¹ÅÕ•ÉåM•±•Ñ½È (€€€€€€€€€€€€€€€€ˆ¹¡½µ”µ™•…ÑÕÉ”µµ½‘…°µ‰½àˆ(€€€€€€€€€€€€¤ì(((€€€€€€€¥˜¡‰½à¥ì((€€€€€€€€€€€‰½à¹±…ÍÍ1¥ÍÐ¹É•µ½Ù” (€€€€€€€€€€€€€€€€‰Ý¥‘”ˆ(€€€€€€€€€€€€¤ì((€€€€€€€ô(((€€€€€€€€¼¨(€€€€€€€€€€ƒŠbƒšZÃ–Š{¾òk¢Þ’â+¦v‹–*Ý¥‘—šb¿–B3’âžÖ¾ò0(€€€€€€€€€€ƒ¦^s¦Z'¢š[žª_šf–’[–Æ“¦»žö§žj¹¼µÁ…‘‘¥¹œ(€€€€€€€€€€ƒ’æ¢š’â’ö×š.ÿš:'Ž(€€€€€€€€¨¼((€€€€€€€µ½‘…°¹±…ÍÍ1¥ÍÐ¹É•µ½Ù” (€€€€€€€€€€€€‰¹¼µÁ…‘‘¥¹œˆ(€€€€€€€€¤ì(((€€€€€€€€¼¨(€€€€€€€€€€ƒŠbƒšZÃ–Š{¾òk¢Þ}¹¼µÁ…‘‘¥¹Ÿ–B3’âžÖšRÛ–ÂûŠSŠP(€€€€€€€€€€ƒ¢«–.Wš"Ã¦²—¢¢·–ºk¢š[žª_žR£žj‘½¬µ‰½ÑÑ½´(€€€€€€€€€€ƒ¾ò#¢Êó–êW¦†¿ž’ë¾ò'’æ¢š’â’ö×š.ÿš:'¾ò3’â7šr(€€€€€€€€€€ƒ¢ºO’â/š²‡¦Z/–V–ê\¿’îï–.g¦gž¢»’â¢"³žö»’â´(€€€€€€€€€€ƒ¢š[žª_¢Š¯¢ª“––_žR£¢Êó–êWš¢–ò?Ž(€€€€€€€€¨¼((€€€€€€€µ½‘…°¹±…ÍÍ1¥ÍÐ¹É•µ½Ù” (€€€€€€€€€€€€‰‘½¬µ‰½ÑÑ½´ˆ(€€€€€€€€¤ì((€€€€€€€€¼¨Xàç¾òk’îï–.g–Â#žR£ž&#–z/¢"ž–[–ÆÁ…¸µäƒ–>«–r£’îï–.g¦Z/–Všf–¶c–r£Ž€¨¼(€€€€€€€µ½‘…°¹±…ÍÍ1¥ÍÐ¹É•µ½Ù” (€€€€€€€€€€€€‰ÅÕ•ÍÐµµ½‘”ˆ(€€€€€€€€¤ì((€€€ô((€€€Í•ÑEÕ•ÍÑQ½Õ¡5½‘” (€€€€€€€™…±Í”(€€€€¤ì(((€€€€¼¨(€€€€€€ƒŠbƒšZÃ–Š{¾òk¢Þ}Ý¥‘”½¹¼µÁ…‘‘¥¹Ÿšb¿–B3’âžÖ(€€€€€€ƒšRÛ–Âû–.W’ös¾ò3¦^s¦Z'¢š[žª_šfš*+¾òš2'¦"W¦7žö»–nx(€€€€€€ƒ¦jÇ¢^?¾ò3¦ÿ–7’â/š²‡¦Z/–V–ê\¿’îï–.g¦gž¢»’â¢"°(€€€€€€ƒ¢š[žª_šfšºcžVg¦†¿ž’ëŽ(€€€€¨¼((€€€½¹ÍÐ¡•±Á	Ñ¸ô(€€€€€€€€ ‰ÍÑ…ÑÕÍ!•±Á	ÕÑÑ½¸ˆ¤ì(((€€€¥˜¡¡•±Á	Ñ¸¥ì((€€€€€€€¡•±Á	Ñ¸¹ÍÑå±”¹‘¥ÍÁ±…äô(€€€€€€€€€€€€‰¹½¹”ˆì((€€€ô(((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾ò#’úwžŸ’öÿžR£¢–n{–‚Ç¾ò3Ž3¢«–.Wš"Ã¦²—žjš†¸¸»––_žR£’â˜(€€€€€€ƒšr–úš2'¦"W–7š"Ã¦²—’â·š‚çšr³šÊKšr'–>7š'Ž7š^¦
+¦
–ò×š"«–r[¾ò0(€€€€€€ƒŽ3–£–Æ³šŸš*¢÷¦‚C¢š÷Ž7š2'¦"W–ëž>û–r£¢«–.Wš"Ã¦²—¢¢·–ºk¢š[žª_’â+¾ò'¾òh(€€€€€€ƒ¢Þ’â+¦v‰ÍÑ…ÑÕÍ!•±Á	ÕÑÑ½»–B3’â–-‰ÕŸŽšò?’ê–B3’â–/–rÃšZä(€€€€€€ƒšÊK¦7žö»ŠSŠQÍ­¥±±AÉ•Ù¥•Ý!•…‘•É	ÕÑÑ½»–>«šr'–r (€€€€€€ÍÝ¥Ñ¡¡…É…Ñ•ÉQ…ˆ §¢Ž‡¢Š¯¢¢·š"C¦†¿ž’è¿¦jÇ¢^?¾ò3–>«¢šž:§–ºØ(€€€€€€ƒ¦Ë¦;’âš²‡¢žK¢&Ë¢š[žª_žjŽ3š*¢÷Ž7–"¦‚¾ò3¦g¦†š2'¦"Wžj(€€€€€€¥¹±¥¹”ÍÑå±”¹‘¥ÍÁ±…çšr–s–r ‰¥¹±¥¹”µ‰±½¬‹¾ò0(€€€€€€ƒ’æ/–ú3’â7žº‡¦Z/’î¦êó¢š[žª_¾ò#¢«–.Wš"Ã¦²—¢¢·–ºkŽ–V–ê_Ž’îï–.gŠ›Š›¾ò$(€€€€€€ƒ¦÷šršºcžVg¦†¿ž’ë¾ò3–nƒž
ë–"–"¦‚¢Þ¦^s¢š[žª_šb¿–§šŠw’â7–B3¢Þ¿–úG¾ò0(€€€€€€ƒ¦^s¢š[žª_¦
¦
+–:šr³šÊKšr'¦7žö»–"Ã–ºŽ¦g¢Ž‡¢Žs’â+¢Þ|(€€€€€€ÍÑ…ÑÕÍ!•±Á	ÕÑÑ½»’âš¢žjšRÛ–Âû¦7žö»Ž(€€€€¨¼((€€€½¹ÍÐÍ­¥±±AÉ•Ù¥•Ý	Ñ¸ô(€€€€€€€€ ‰Í­¥±±AÉ•Ù¥•Ý!•…‘•É	ÕÑÑ½¸ˆ¤ì(((€€€¥˜¡Í­¥±±AÉ•Ù¥•Ý	Ñ¸¥ì((€€€€€€€Í­¥±±AÉ•Ù¥•Ý	Ñ¸¹ÍÑå±”¹‘¥ÍÁ±…äô(€€€€€€€€€€€€‰¹½¹”ˆì((€€€ô(((€€€É•ÍÑ½É•	½ÉÉ½Ý•‘±•µ•¹Ð ¤ì((€€€¥˜¡Ý¥¹‘½Ü¹Íå¹¡…É…Ñ•ÉQ½Õ¡5½‘”¥ì(€€€€€€€Ý¥¹‘½Ü¹Íå¹¡…É…Ñ•ÉQ½Õ¡5½‘” ¤ì(€€€ô()ô(((¼¨(€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3¢žK¢&Ë¦‚¦v‹šVÓ–B (€€ƒ¢Žw–
d¿¢÷–*o–ð¿š*¢÷’â'–/–"¦‚¾ò'¾òh(€€ƒ¢Þ}‰½ÉÉ½Ý±•µ•¹Ñ%¹Ñ½5½‘…° §šb¿–B3’âš.o¾ò0(€€ƒ–>«šb¿¦gš²‡–žjšb¿šVÓ–/¢3–2¿ž.š,¿š*¢÷¦‚¦vˆ(€€ƒ¾ò#šr³’ú–ÂÇ–¶c–r£Ž–ÞËžÚOšâ³¢¦›ž¦§–ºkžj–º3šVÓ¦‚¦v‹¾ò0(€€ƒ’â7šb¿¦7–¾¯’â––_šZÃžj¾ò'¾ò3–†{¦Ë¢žK¢&Ë¢š[žª_¢Ž‡žj(€€€¡…É…Ñ•ÉQ…‰½¹Ñ•¹Ó–ºç–f£–:–rÃ¦†¿ž’ëŽ((€€ƒ–"š>o–"¦‚šf¾ò3–#š*+Ž3’â+’â–/–"¦‚–¢ÖÃžj(€€ƒ¦‚¦v‹Ž7š¶ã’ö7¾ò3–7–šZÃžj¦‚¦v‹¦Ë’úŠSŠP(€€ƒ–B3’âšf¦ZO–>«šršr'’â–/¦‚¦v‹¢Š¯–¢ÖÃ¾ò3’â7šr(€€ƒ–§–/–"¦‚žj–Ÿ–ºçžZ+–r£’â¢ÖßŽ(¨¼((¼¨(€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3Ž3’â+¦v‹¦‚·–<(€€ƒš‚çšr³šÊK–>7š'Ž7ŠSŠS¦g–/–V?¦†3šb¿žržj¾ò3’æ/–&4(€€ƒ¦‚·–?žj½¹±¥¯–>«šb¿–"š>o–"¦‚¾ò3–º3–£šÊKšr$(€€ƒžržj–"š>o¢žK¢&Ë¾ò'¾òh(€€ƒ¦î{¦‚·–?šf¾ò3š*+ž.š,¿¢3–2¿š*¢÷’â'–/¦‚¦vˆ(€€ƒ–B¢«žjŽ3žn»–&7š¶–r£žr/–N«–/¢žK¢&ËŽ7ž.š,(€€ƒ’âš²‡–£¦£¢¢·š"C–B3’â–/¢žK¢&Ë¾ò3’â›–Fó–>¯’â'–,(€€ƒ¦‚¦v‹–B¢«žjžV¯¦v‹šnÓšZÃ–÷–ò?ŠSŠS’â7žº‡ž:§–ºØ(€€ƒž>û–r£š¶–r£žr/–N«–/–"¦‚¾ò3–"––÷’æ/–ú3žV¯¦vˆ(€€ƒ¦÷šb¿–Â7žj¾ò3’â7žR£ž¶'ž:§–ºÛ¢«–ÞÇ–7¦î{’âš²„(€€ƒ–"¦‚š&7šnÓšZÃŽ((€€ƒ’â'–/¦‚¦v‹žR£žjž.š/¢º+šVãš‚ó–ò?’â7’âš¢Œ(€€ƒ¾ò!ÍÑ…ÑÕÍ¡…É…Ñ•É%¹‘•à¼(€€¥¹Ù•¹Ñ½Éå¡…É…Ñ•É%¹‘•ãšb¼Ãš"XÇžjšVã–¶_¾ò0(€€ÕÉÉ•¹ÑM­¥±±¡…É…Ñ•Ëšb¼‰™¥É”‹¾ò<(€€€‰Á±…å•ÈÈ‹¦gž¢»–¶_’âË¾ò'¾ò3¦g¢Ž‡–B¢«¢ö'š>l(€€ƒš"C–Â7žjš‚ó–ò?–7¢Î›–ó¾ò3’â7šb¿’â'–/¦÷¢÷–ÇžR (€€ƒ–B3’â–/šVã–¶_Ž(¨¼()™Õ¹Ñ¥½¸Í•±•Ñ¡…É…Ñ•É½ÉQ…‰Ì¡Ñ…É•Ñ%¹‘•à¥ì((€€€½¹ÍÐÑ…É•Ñ¡…É…Ñ•Èô(€€€€€€€•ÑA…ÉÑå¡…É…Ñ•É	å%¹‘•à¡Ñ…É•Ñ%¹‘•à¤ì((€€€¥˜ …Ñ…É•Ñ¡…É…Ñ•È¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€ÍÑ…ÑÕÍ¡…É…Ñ•É%¹‘•àô(€€€€€€€Ñ…É•Ñ%¹‘•àì((€€€=‰©•Ð¹­•åÌ (€€€€€€€Á•¹‘¥¹MÑ…ÑÌ(€€€€¤¹™½É…  (€€€€€€€ÍÑ…Ðôùì((€€€€€€€€€€€Á•¹‘¥¹MÑ…ÑÍmÍÑ…Ñtô(€€€€€€€€€€€€€€€€Àì((€€€€€€€ô(€€€€¤ì((€€€ÕÁ‘…Ñ•MÑ…ÑÕÍAÉ•Ù¥•Ü ¤ì(((€€€¥¹Ù•¹Ñ½Éå¡…É…Ñ•É%¹‘•àô(€€€€€€€Ñ…É•Ñ%¹‘•àì((€€€É•¹‘•É%¹Ù•¹Ñ½Éä ¤ì(((€€€ÕÉÉ•¹ÑM­¥±±¡…É…Ñ•Èô(€€€€€€€•ÑA…ÉÑå¡…É…Ñ•É-•ä¡Ñ…É•Ñ%¹‘•à¤ì((€€€É•¹‘•ÉM­¥±±1½…‘½ÕÐ ¤ì(((€€€€¼¨(€€€€€€ƒŠbƒ¢ºO¢Š¯¦ã’â·žj¦‚·–?šr'¢š[¢šë’â+žj–6–"”(€€€€€€ƒ¾ò#’ú/–š–’[–r#¢º+’ê»¾ò'¾ò3ž:§–ºÛš&7žr/–ú_–ë’ú(€€€€€€ƒžn»–&7¦ãžjšb¿–N«’â–/¢žK¢&ËŽ(€€€€¨¼((€€€lÀ°Ä°Ét¹™½É…  (€€€€€€€¤ôùì((€€€€€€€€€€€½¹ÍÐ…Ù…Ñ…É°ô(€€€€€€€€€€€€€€€€ ‰¡…É…Ñ•ÉÙ…Ñ…Èˆ­¤¤ì(((€€€€€€€€€€€¥˜¡…Ù…Ñ…É°¥ì(€€€€€€€€€€€€€€€½¹ÍÐÍ•±•Ñ•õ¤ôôõÑ…É•Ñ%¹‘•àì(€€€€€€€€€€€€€€€…Ù…Ñ…É°¹ÍÑå±”¹½Á…¥ÑäõÍ•±•Ñ•€ü€ˆÄˆ€è€ˆ¸Ôˆì(€€€€€€€€€€€€€€€…Ù…Ñ…É°¹±…ÍÍ1¥ÍÐ¹Ñ½±” ‰¥ÌµÕÉÉ•¹Ðµ¡…É…Ñ•Èˆ±Í•±•Ñ•¤ì(€€€€€€€€€€€€€€€½¹ÍÐ¡½¥”õ…Ù…Ñ…É°¹±½Í•ÍÐ ˆ¹¡…É…Ñ•ÈµÍ¡½Ý…Í”µ¡½¥”ˆ¤ì(€€€€€€€€€€€€€€€¥˜¡¡½¥”¥ì¡½¥”¹±…ÍÍ1¥ÍÐ¹Ñ½±” ‰¥ÌµÕÉÉ•¹Ðµ¡…É…Ñ•Èˆ±Í•±•Ñ•¤ìô(€€€€€€€€€€€ô((€€€€€€€ô(€€€€¤ì()ô(()™Õ¹Ñ¥½¸ÍÝ¥Ñ¡¡…É…Ñ•ÉQ…ˆ¡Ñ…‰9…µ”¥ì((€€€É•ÍÑ½É•	½ÉÉ½Ý•‘±•µ•¹Ð ¤ì(((€€€€¼¨(€€€€€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3Ž3¢þS–n{š†š†(€€€€€€ƒš^¦
+–’k’â–/¾òš2'¦"WŽ7¾ò3–>«–r£¢÷–*o–ó–"¦‚(€€€€€€ƒ¦†¿ž’ë¾ò'¾òh(€€€€€€ƒš¾?š²‡–"–"¦‚¦÷¦7šZÃ–"“šZß’âš²‡¾ò3–"–"À(€€€€€€€‰ÍÑ…ÑÕÌ‹š&7¦†¿ž’ë¾ò3–"–"Ã–Û’î[–"¦‚(€€€€€€ƒ¾ò#žÚO¦¦_šÆƒ–"¦4¿š*¢ô¿¢3–2¾ò'¢«–.W¦jÇ¢^?¾ò0(€€€€€€ƒ’â7žR£–r£š¾?–/–"¦‚–B¢«¢fWžBŽ(€€€€¨¼((€€€½¹ÍÐ¡•±Á	Ñ¸ô(€€€€€€€€ ‰ÍÑ…ÑÕÍ!•±Á	ÕÑÑ½¸ˆ¤ì(((€€€¥˜¡¡•±Á	Ñ¸¥ì((€€€€€€€¡•±Á	Ñ¸¹ÍÑå±”¹‘¥ÍÁ±…äô((€€€€€€€€€€€Ñ…‰9…µ”ôôô‰ÍÑ…ÑÕÌˆ(€€€€€€€€€€€€ü(€€€€€€€€€€€€‰¥¹±¥¹”µ‰±½¬ˆ(€€€€€€€€€€€€è(€€€€€€€€€€€€‰¹½¹”ˆì((€€€ô(((€€€€¼¨(€€€€€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3Ž3–£š*¢÷¦‚C¢šô(€€€€€€ƒšZ–¶_š2'¦"W¾ò3š'¢¦ËšRû–r£š*¢÷¦‚¦v‹žj¢þS–nx(€€€€€€ƒ’â/¦v‹Ž7¾ò'¾òh(€€€€€€ƒ¢Þ}ÍÑ…ÑÕÍ!•±Á	ÕÑÑ½»–B3’â––_¦
?¢ò¿¾ò3–>«šr$(€€€€€€ƒ–"–"ÃŽ3š*¢÷Ž7–"¦‚š&7¦†¿ž’ë¾ò3–Û’î[–"¦‚(€€€€€€ƒ¢«–.W¦jÇ¢^?Ž(€€€€¨¼((€€€½¹ÍÐÍ­¥±±AÉ•Ù¥•Ý	Ñ¸ô(€€€€€€€€ ‰Í­¥±±AÉ•Ù¥•Ý!•…‘•É	ÕÑÑ½¸ˆ¤ì(((€€€¥˜¡Í­¥±±AÉ•Ù¥•Ý	Ñ¸¥ì((€€€€€€€Í­¥±±AÉ•Ù¥•Ý	Ñ¸¹ÍÑå±”¹‘¥ÍÁ±…äô((€€€€€€€€€€€Ñ…‰9…µ”ôôô‰Í­¥±°ˆ(€€€€€€€€€€€€ü(€€€€€€€€€€€€‰¥¹±¥¹”µ‰±½¬ˆ(€€€€€€€€€€€€è(€€€€€€€€€€€€‰¹½¹”ˆì((€€€ô(((€€€½¹ÍÐ½¹Ñ…¥¹•Èô(€€€€€€€€ ‰¡…É…Ñ•ÉQ…‰½¹Ñ•¹Ðˆ¤ì(((€€€¥˜ …½¹Ñ…¥¹•È¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€½¹ÍÐÁ…•%‘5…Àõì(€€€€€€€ÍÑ…ÑÕÌè‰ÍÑ…ÑÕÍA…”ˆ°(€€€€€€€¥¹Ù•¹Ñ½Éäè‰¥¹Ù•¹Ñ½ÉåA…”ˆ°(€€€€€€€Í­¥±°è‰Í­¥±±A…”ˆ°(€€€€€€€•áÁA½½°è‰¡½µ•áÁA½½±…Éˆ(€€€ôì(((€€€½¹ÍÐÁ…•°ô(€€€€€€€€ (€€€€€€€€€€€Á…•%‘5…ÁmÑ…‰9…µ•t(€€€€€€€€¤ì(((€€€¥˜ …Á…•°¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€‰½ÉÉ½Ý±•µ•¹Ñ%¹Ñ½5½‘…° (€€€€€€€Á…•°°(€€€€€€€½¹Ñ…¥¹•È(€€€€¤ì((€€€¥˜¡Ý¥¹‘½Ü¹ØÜáÁÁ±å¡…É…Ñ•É%¹Ù•¹Ñ½Éå1…å½ÕÐ¥ì(€€€€€€€Ý¥¹‘½Ü¹ØÜáÁÁ±å¡…É…Ñ•É%¹Ù•¹Ñ½Éå1…å½ÕÐ ¤ì(€€€ô(((€€€€¼¨(€€€€€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3Ž3’â+¦v‹–ÞËžÚL(€€€€€€ƒ–>¿’î—–"š>o¢žK¢&Ë’ê¾ò3’â/¦v‹žº·¦‚·¦
š:Kš.ÿš:'Ž7¾ò'¾òh(€€€€€€ƒ¦g’â'–/¦‚¦v‹–B¢«–:šr³–ÂÇšr'žjŽ3Š^¢žK¢&Ë–B7ŠZÛŽ4(€€€€€€ƒžº·¦‚·–"š>o–6–†+¾ò3–¦Ë¢žK¢&Ë¢š[žª_’æ/–ú3¢Þ|(€€€€€€ƒ’â+šZçšZÃ–*ƒžj¦‚·–?¦ãšN¦7¢’’ê¾ò3¦g¢Ž‡š*+–º(€€€€€€ƒ¦jÇ¢^?š:'ŠSŠS–>«–r£Ž3–¦Ë¢žK¢&Ë¢š[žª_¦†¿ž’ëŽ4(€€€€€€ƒ¦g–/š–Š¦jÇ¢^?¾ò3¦‚¦v‹šr³¢ê¯–ššzs’æ/–ú3¢Š¬(€€€€€€ƒ–Z»ž6£–žR£–r£–"—žj–rÃšZç¾ò3’â7–>_–öÇ¦~ü(€€€€€€ƒ¾ò#–nƒž
ëšb¿–r£–¦Ë’úŽžŠë–ºk¢š¦†¿ž’ëžj¦g–,(€€€€€€ƒšf¦ZO¦î{š&7¦jÇ¢^?¾ò3’â7šb¿–¾¯š¶ï–r£¦‚¦v‹šr³¢ê¬(€€€€€€ƒžjMO’â+¾ò'Ž(€€€€¨¼((€€€½¹ÍÐÍÝ¥Ñ¡…É‘%‘5…Àõì(€€€€€€€ÍÑ…ÑÕÌè‰ÍÑ…ÑÕÍ¡…É…Ñ•ÉMÝ¥Ñ¡…Éˆ°(€€€€€€€¥¹Ù•¹Ñ½Éäè‰¥¹Ù•¹Ñ½Éå¡…É…Ñ•ÉMÝ¥Ñ¡…Éˆ°(€€€€€€€Í­¥±°è‰Í­¥±±¡…É…Ñ•ÉMÝ¥Ñ¡…Éˆ(€€€ôì(((€€€½¹ÍÐÍÝ¥Ñ¡…Éô(€€€€€€€€ (€€€€€€€€€€€ÍÝ¥Ñ¡…É‘%‘5…ÁmÑ…‰9…µ•t(€€€€€€€€¤ì(((€€€¥˜¡ÍÝ¥Ñ¡…É¥ì((€€€€€€€ÍÝ¥Ñ¡…É¹ÍÑå±”¹‘¥ÍÁ±…äô(€€€€€€€€€€€€‰¹½¹”ˆì(((€€€€€€€¡½µ••…ÑÕÉ•!¥‘‘•¹MÝ¥Ñ¡…Éô(€€€€€€€€€€€ÍÝ¥Ñ¡…Éì((€€€ô(((€€€€¼¨(€€€€€€ƒŠbƒ¦‚’úÿ¢ºOžn»–&7¦ã’â·žj–"¦‚š2'¦"Wšr$(€€€€€€ƒ¢š[¢šë’â+žj–6–"—¾ò#’ú/–š–êW¢&Ë–>7žf÷¾ò'¾ò0(€€€€€€ƒž:§–ºÛš&7žr/–ú_–ë’úžn»–&7š¶–r£žr/–N«–/–"¦‚Ž(€€€€¨¼((€€€l‰áÁA½½°ˆ°‰MÑ…ÑÕÌˆ°‰M­¥±°‰t¹™½É…  (€€€€€€€¹…µ”ôùì((€€€€€€€€€€€½¹ÍÐ‰Ñ¸ô(€€€€€€€€€€€€€€€€ ‰¡…É…Ñ•ÉQ…‰	Ñ¸ˆ­¹…µ”¤ì(((€€€€€€€€€€€¥˜¡‰Ñ¸¥ì((€€€€€€€€€€€€€€€‰Ñ¸¹ÍÑå±”¹½Á…¥Ñäô((€€€€€€€€€€€€€€€€€€€¹…µ”¹Ñ½1½Ý•É…Í” ¤ôôô(€€€€€€€€€€€€€€€€€€€Ñ…‰9…µ”¹Ñ½1½Ý•É…Í” ¤(€€€€€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€€€€€€ˆÄˆ(€€€€€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€€€€€€ˆ¸ÔÔˆì((€€€€€€€€€€€ô((€€€€€€€ô(€€€€¤ì()ô(()™Õ¹Ñ¥½¸ÕÁ‘…Ñ•½±‘¥ÍÁ±…ä ¥ì((€€€½¹ÍÐÙ…±Õ”õ5…Ñ ¹µ…à À±5…Ñ ¹™±½½È¡9Õµ‰•È¡½±¥ñðÀ¤¤ì((€€€l(€€€€€€€€ ‰¡½µ•½±‘Y…±Õ”ˆ¤°(€€€€€€€€ ‰¥¹Ù•¹Ñ½Éå½±‘Y…±Õ”ˆ¤°(€€€€€€€€ ‰ØÄÐÙ!½µ•I½ÍÑ•É½±‘Y…±Õ”ˆ¤(€€€t¹™½É… ¡•°ôùì(€€€€€€€¥˜¡•°¥ì(€€€€€€€€€€€•°¹Ñ•áÑ½¹Ñ•¹ÐõÙ…±Õ”¹Ñ½1½…±•MÑÉ¥¹œ ‰é µQ\ˆ¤ì(€€€€€€€ô(€€€ô¤ì()ô(((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€ƒŠbƒ–V–ê\(ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼()™Õ¹Ñ¥½¸É•¹‘•ÉM¡½Á½¹Ñ•¹Ð ¥ì((€€€½¹ÍÐ…É‘ÌõÍ¡½Á%Ñ•µÌ¹µ…À¡Í¡½Á%Ñ•´ôùì(€€€€€€€½¹ÍÐ½Õ¹Ðõ•ÑA½Ñ¥½¹½Õ¹Ð¡Í¡½Á%Ñ•´¹¥¤ì(€€€€€€€½¹ÍÐÉ•Í½ÕÉ•1…‰•°õÍ¡½Á%Ñ•´¹É•Í½ÕÉ”ôôô‰¡Àˆ€ü€‰!@ˆ€è€‰M@ˆì(€€€€€€€½¹ÍÐ•™™•ÑQ•áÐõÍ¡½Á%Ñ•´¹É•½Ù•ÉåA•É•¹ÐøôÄÀÀ(€€€€€€€€€€€€üƒ–n{–ú§š&šr$‘íÉ•Í½ÕÉ•1…‰•±õ€(€€€€€€€€€€€€èƒ–n{–ú§šr–’œ‘íÉ•Í½ÕÉ•1…‰•±÷žj€‘íÍ¡½Á%Ñ•´¹É•½Ù•ÉåA•É•¹Ñô•€ì((€€€€€€€½¹ÍÐ¡…ÍAÉ¥”õ9Õµ‰•È¹¥Í¥¹¥Ñ”¡Í¡½Á%Ñ•´¹ÁÉ¥”¤ì(€€€€€€€½¹ÍÐ‘¥Í…‰±•ô…¡…ÍAÉ¥”ñð½±ñÍ¡½Á%Ñ•´¹ÁÉ¥”ì(€€€€€€€½¹ÍÐ‰ÕÑÑ½¹Q•áÐô…¡…ÍAÉ¥”(€€€€€€€€€€€€ü€‹–çš‚ó–ú–ºhˆ(€€€€€€€€€€€€è€‘íÍ¡½Á%Ñ•´¹ÁÉ¥•ôƒ¦G–æ€ì((€€€€€€€É•ÑÕÉ¸€(€€€€€€€€€€€€ñ‘¥Ø±…ÍÌô‰Í¡½ÀµÁ½Ñ¥½¸µ…É€‘íÍ¡½Á%Ñ•´¹É•Í½ÕÉ•ôˆø(€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÌô‰Í¡½ÀµÁ½Ñ¥½¸µ…Éµ¡•…ˆø(€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÌô‰Í¡½ÀµÁ½Ñ¥½¸µÑåÁ”ˆø‘íÉ•Í½ÕÉ•1…‰•±ôð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÌô‰Í¡½ÀµÁ½Ñ¥½¸µÍÑ½¬ˆûš2šr$€‘í½Õ¹Ñôð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÌô‰Í¡½ÀµÁ½Ñ¥½¸µ¹…µ”ˆø‘íÍ¡½Á%Ñ•´¹¹…µ•ôð½‘¥Øø(€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÌô‰Í¡½ÀµÁ½Ñ¥½¸µ•™™•Ðˆø‘í•™™•ÑQ•áÑôð½‘¥Øø(€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÌô‰Í¡½ÀµÁ½Ñ¥½¸µÁÕÉ¡…Í”µÉ½Üˆø(€€€€€€€€€€€€€€€€€€€€ñ±…‰•°™½Èô‰Í¡½ÁEÕ…¹Ñ¥Ñä´‘íÍ¡½Á%Ñ•´¹¥‘ôˆûšVã¦<ð½±…‰•°ø(€€€€€€€€€€€€€€€€€€€€ñ¥¹ÁÕÐ(€€€€€€€€€€€€€€€€€€€€€€€¥ô‰Í¡½ÁEÕ…¹Ñ¥Ñä´‘íÍ¡½Á%Ñ•´¹¥‘ôˆ(€€€€€€€€€€€€€€€€€€€€€€€±…ÍÌô‰Í¡½ÀµÁ½Ñ¥½¸µÅÕ…¹Ñ¥Ñäˆ(€€€€€€€€€€€€€€€€€€€€€€€ÑåÁ”ô‰¹Õµ‰•Èˆ(€€€€€€€€€€€€€€€€€€€€€€€¥¹ÁÕÑµ½‘”ô‰¹Õµ•É¥Œˆ(€€€€€€€€€€€€€€€€€€€€€€€µ¥¸ôˆÄˆ(€€€€€€€€€€€€€€€€€€€€€€€µ…àôˆääääˆ(€€€€€€€€€€€€€€€€€€€€€€€ÍÑ•ÀôˆÄˆ(€€€€€€€€€€€€€€€€€€€€€€€Ù…±Õ”ôˆÄˆ(€€€€€€€€€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€€€€€€€€€€€€€€€±…ÍÌô‰¡½µ”µ™•…ÑÕÉ”µ‰Õäµ‰Ñ¸Í¡½ÀµÁ½Ñ¥½¸µ‰Õäˆ(€€€€€€€€€€€€€€€€€€€€€€€€‘í‘¥Í…‰±•€ü€‰‘¥Í…‰±•ˆ€è€ˆ‰ô(€€€€€€€€€€€€€€€€€€€€€€€½¹±¥¬ô‰‰ÕåM¡½Á%Ñ•´ œ‘íÍ¡½Á%Ñ•´¹¥‘ôœ±‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% Í¡½ÁEÕ…¹Ñ¥Ñä´‘íÍ¡½Á%Ñ•´¹¥‘ôœ¤¹Ù…±Õ”¤ˆ(€€€€€€€€€€€€€€€€€€€€ø‘í‰ÕÑÑ½¹Q•áÑôð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€ì(€€€ô¤¹©½¥¸ ˆˆ¤ì((€€€É•ÑÕÉ¸€(€€€€€€€€ñ‘¥Ø±…ÍÌô‰Í¡½ÀµÁ½Ñ¥½¸µ¥¹Ñ•É™…”ˆø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÌô‰Í¡½ÀµÁ½Ñ¥½¸µ¹½Ñ”ˆû–>«¢Ê§–R¸!C¾ò=M@ƒ–n{–ú§¢^—šÂÐð½‘¥Øø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÌô‰Í¡½ÀµÁ½Ñ¥½¸µ±¥ÍÐˆø‘í…É‘Íôð½‘¥Øø(€€€€€€€€ð½‘¥Øø(€€€€ì)ô(()™Õ¹Ñ¥½¸‰ÕåM¡½Á%Ñ•´¡¥Ñ•µ%±É•ÅÕ•ÍÑ•‘EÕ…¹Ñ¥Ñä¥ì((€€€½¹ÍÐÍ¡½Á%Ñ•´õ•ÑA½Ñ¥½¹•™¥¹¥Ñ¥½¸¡¥Ñ•µ%¤ì((€€€¥˜ …Í¡½Á%Ñ•´¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô((€€€¥˜ …9Õµ‰•È¹¥Í¥¹¥Ñ”¡Í¡½Á%Ñ•´¹ÁÉ¥”¤¥ì(€€€€€€€…±•ÉÐ ‹¦g–/¢^—šÂÓžj–çš‚ó–Âkšr«¢¢·–ºkŽˆ¤ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô((€€€½¹ÍÐÅÕ…¹Ñ¥Ñäõ5…Ñ ¹µ…à (€€€€€€€€Ä°(€€€€€€€5…Ñ ¹µ¥¸ ääää±5…Ñ ¹™±½½È¡9Õµ‰•È¡É•ÅÕ•ÍÑ•‘EÕ…¹Ñ¥Ñä¥ñðÄ¤¤(€€€€¤ì((€€€½¹ÍÐÑ½Ñ…±AÉ¥”õÍ¡½Á%Ñ•´¹ÁÉ¥”©ÅÕ…¹Ñ¥Ñäì((€€€¥˜¡½±ñÑ½Ñ…±AÉ¥”¥ì(€€€€€€€…±•ÉÐ ‹¦G–æ’â7–’ƒ¾ò3šr³š²‡¦r¢š€ˆ­Ñ½Ñ…±AÉ¥”¹Ñ½1½…±•MÑÉ¥¹œ ‰é µQ\ˆ¤¬ˆƒ¦G–æŽˆ¤ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô((€€€¥˜ ……‘‘A½Ñ¥½¹Q½%¹Ù•¹Ñ½Éä¡¥Ñ•µ%±ÅÕ…¹Ñ¥Ñä¤¥ì(€€€€€€€…±•ÉÐ ‹¢3–2–ÞËšîÿ¾ò3š"[¢¦Ë¢^—šÂÓ–ÞËšÊKšr'–>¿žR£žj–‚žZ+ž¦ë¦ZOŽˆ¤ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô((€€€½±õ½±µÑ½Ñ…±AÉ¥”ì((€€€É•‰Õ¥±‘%¹Ù•¹Ñ½ÉåM±½ÑÌ ¤ì(€€€ÕÁ‘…Ñ•½±‘¥ÍÁ±…ä ¤ì(€€€Í…Ù•…µ” ¤ì((€€€½¹ÍÐ‰½‘å°ô ‰¡½µ••…ÑÕÉ•5½‘…±	½‘äˆ¤ì((€€€¥˜¡‰½‘å°¥ì(€€€€€€€‰½‘å°¹¥¹¹•É!Q50õÉ•¹‘•ÉM¡½Á½¹Ñ•¹Ð ¤ì(€€€ô)ô(((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€ƒŠbƒ¢žK¢&Ë–ÆWž’è(ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼((¼¨(€€ƒŠbƒ’þ»š¶¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3–>¢–r[¦
ž¢¸(€€ƒŽ3’â+¦v‹¦†¿ž’ë–ÞË¦Z/šRø¿šr«¦Z/šRû¢žK¢&Ë¾ò3’â/¦v‹–"š>l(€€ƒ¢Žw–
d¿¢÷–*o–ð¿š*¢÷Ž7žj¢žK¢&Ë¦‚¦v‹¾ò'¾òh((€€ƒ’â+š:K¾òk¢žK¢&Ë¦‚·–?š‚ó¾ò3–ÞË–&×–îëžj¢žK¢&Ë¦†¿ž’è(€€ƒ–Æ³šŸ–r[ž’è¯–B7ž¢Ä¯ž¶'žÒk¾ò3¦
šÊK–&×–îëžj¾ò#žn»–&4(€€ƒ–>«šr'ž²³’ê3¢žK¢&Ë¦g–/’ö7žö»¾ò'¦†¿ž’ë¦:[¦‚´¯¢ž¦:X(€€ƒšŠw’îÛ¾ò3¦î{’â/–:ï–ššzsšŠw’îÛ–ÞËžÚO¦Sš"C–ÂÇžnÓš:”(€€ƒ¢ÞÏ–ë–&×–îë¢š[žª_Ž((€€ƒ’â/š:K¾òk’â'–/š2'¦"W¾ò#¢Žw–
d¿¢÷–*o–ð¿š*¢÷¾ò'¾ò0(€€ƒžnÓš:—–Â;–:ïž>ûš"Cžj¢3–2¿ž.š,¿š*¢÷¦‚¦v‹ŠSŠP(€€ƒ¦g’â'–/¦‚¦v‹šr³¢ê¯–ÞËžÚOšr'¢žK¢&Ë–"š>ožº·¦‚´(€€ƒ¾ò!¡…¹•%¹Ù•¹Ñ½Éå¡…É…Ñ•È¼(€€¡…¹•MÑ…ÑÕÍ¡…É…Ñ•È¼(€€¡…¹•M­¥±±¡…É…Ñ•ÉÉÉ½ß¾ò'¾ò3’â7žR£–r (€€ƒ¦g¢Ž‡¦7šZÃ–k’â––_¢žK¢&Ë–"š>o¦
?¢ò¿¾ò3žnÓš:—šÊÿžR (€€ƒž>ûš"CŽ–ÞËžÚOšâ³¢¦›¦;žj¦‚¦v‹–ÂÇ––÷Ž(¨¼()™Õ¹Ñ¥½¸É•¹‘•É¡…É…Ñ•ÉM¡½Ý…Í•½¹Ñ•¹Ð ¥ì((€€€½¹ÍÐÍ±½ÑÌõl(€€€€€€€Á±…å•È°(€€€€€€€Á±…å•ÈÈ°(€€€€€€€Á±…å•ÈÌ(€€€tì(((€€€±•Ð¡Ñµ°ô((€€€€€€€€œñ‘¥ØÍÑå±”ô‰‘¥ÍÁ±…äé™±•àí…ÀèÄÁÁàìœ¬(€€€€€€€€©ÕÍÑ¥™äµ½¹Ñ•¹Ðé•¹Ñ•Èíµ…É¥¸µ‰½ÑÑ½´èáÁàìˆøœì(((€€€Í±½ÑÌ¹™½É…  (€€€€€€€€¡¡…É…Ñ•È±Í±½Ñ%¹‘•à¤ôùì((€€€€€€€€€€€¥˜¡¡…É…Ñ•È¥ì(€€€€€€€€€€€€€€€¡Ñµ°¬ô((€€€€€€€€€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰¡…É…Ñ•ÈµÍ¡½Ý…Í”µ¡½¥”ˆÍÑå±”ô‰Ý¥‘Ñ èàÙÁàíÑ•áÐµ…±¥¸é•¹Ñ•Èìœ¬(€€€€€€€€€€€€€€€€€€€€ÕÉÍ½ÈéÁ½¥¹Ñ•Èìˆ½¹±¥¬ô‰Í•±•Ñ¡…É…Ñ•É½ÉQ…‰Ì œ¬(€€€€€€€€€€€€€€€€€€€Í±½Ñ%¹‘•à¬(€€€€€€€€€€€€€€€€€€€€œ¤ìˆøœ¬((€€€€€€€€€€€€€€€€€€€€œñ‘¥Ø¥ô‰¡…É…Ñ•ÉÙ…Ñ…Èœ¬(€€€€€€€€€€€€€€€€€€€Í±½Ñ%¹‘•à¬(€€€€€€€€€€€€€€€€€€€€œˆ±…ÍÌô‰¡…É…Ñ•ÈµÍ¡½Ý…Í”µ…Ù…Ñ…ÈˆÍÑå±”ô‰Ý¥‘Ñ èÔÙÁàí¡•¥¡ÐèÔÙÁàíµ…É¥¸èÀ…ÕÑ¼ìœ¬(€€€€€€€€€€€€€€€€€€€€‰½É‘•ÈµÉ…‘¥ÕÌèÔÀ”í‰…­É½Õ¹µ½±½ÈèŒÄÔÄÀÁ„í‰…­É½Õ¹µ¥µ…”éÕÉ°¡pœœ¬(€€€€€€€€€€€€€€€€€€€•Ñ¡…É…Ñ•ÉÉÑÝ½É­A…Ñ ¡¡…É…Ñ•È¤¬(€€€€€€€€€€€€€€€€€€€€pœ¤í‰…­É½Õ¹µÍ¥é”é½Ù•Èí‰…­É½Õ¹µÁ½Í¥Ñ¥½¸é•¹Ñ•È€Äà”ìœ¬(€€€€€€€€€€€€€€€€€€€€‰½É‘•ÈèÉÁàÍ½±¥€˜ÁˆÐÈäí‘¥ÍÁ±…äé™±•àí…±¥¸µ¥Ñ•µÌé•¹Ñ•Èìœ¬(€€€€€€€€€€€€€€€€€€€€©ÕÍÑ¥™äµ½¹Ñ•¹Ðé•¹Ñ•Èí™½¹ÐµÍ¥é”èÄáÁàíÑÉ…¹Í¥Ñ¥½¸é½Á…¥Ñä€¸ÄÕÌìˆøœ¬(€€€€€€€€€€€€€€€€€€€€ˆð½‘¥Øøˆ¬((€€€€€€€€€€€€€€€€€€€€œñ‘¥ØÍÑå±”ô‰™½¹ÐµÍ¥é”èÄÅÁàí™½¹ÐµÝ•¥¡Ðé‰½±íµ…É¥¸µÑ½ÀèÉÁàìœ¬(€€€€€€€€€€€€€€€€€€€€Ý¡¥Ñ”µÍÁ…”é¹½ÝÉ…Àí½Ù•É™±½Üé¡¥‘‘•¸íÑ•áÐµ½Ù•É™±½Üé•±±¥ÁÍ¥Ììˆøœ¬(€€€€€€€€€€€€€€€€€€€¡…É…Ñ•È¹¥¬(€€€€€€€€€€€€€€€€€€€€ˆð½‘¥Øøˆ¬((€€€€€€€€€€€€€€€€€€€€¼¨(€€€€€€€€€€€€€€€€€€€€€€ƒŠbƒ’þ»š¶¾ò#’úwžŸ’öÿžR£¢–n{–‚Ç¾ò3Ž3š2'–6žÒh(€€€€€€€€€€€€€€€€€€€€€€ƒžjšf–g¾ò3’â+¦v‹¦‚·–?š†žjž¶'žÒkšÊKšr'¢Þ¢F\(€€€€€€€€€€€€€€€€€€€€€€ƒ–Š{–*ƒŽ7¾ò'¾òh(€€€€€€€€€€€€€€€€€€€€€€ƒ¦g–/ž¶'žÒkšZ–¶_–:šr³šÊKšr%¥“¾ò3žÒSžÊçšb¼(€€€€€€€€€€€€€€€€€€€€€€É•¹‘•É¡…É…Ñ•ÉM¡½Ý…Í•½¹Ñ•¹Ð ¤(€€€€€€€€€€€€€€€€€€€€€€ƒžÖ–¶_’âËšfžVÛ’â/žº_––÷žnÓš:—–¾¯š¶ï¦É!Q53¾ò0(€€€€€€€€€€€€€€€€€€€€€€ƒ¦g–/–÷–ò?–>«šr'Ž3š&O¦Z/¢žK¢&Ë–ö#žª_¦
’â–"ïŽ4(€€€€€€€€€€€€€€€€€€€€€€ƒšr¢Š¯–Fó–>¯’âš²‡¾ò3’æ/–ú3’â7žº‡ž¶'žÒkš;¦êó¢º((€€€€€€€€€€€€€€€€€€€€€€ƒ¾ò#’ú/–š–:ïžÚO¦¦_šÆƒ–"¦7¦‚¦v‹š2'–"¦7Ž(€€€€€€€€€€€€€€€€€€€€€€ƒ¢žK¢&Ë–6žÒk’ê¾ò'¾ò3¦gšº×–¶_’âËš^§–ÂÇ–ÞËžÚL(€€€€€€€€€€€€€€€€€€€€€€ƒ¦cš¶ï–r£žV¯¦v‹’â+¾ò3šÊKšr'’êëšr–7–n{’úšnÓšZÀ(€€€€€€€€€€€€€€€€€€€€€€ƒ–ºŠSŠS’â7šb¿¢ÎšZgšÊKžº_–Â7¾ò3šb¿žV¯¦v‹š‚çšr°(€€€€€€€€€€€€€€€€€€€€€€ƒšÊK¢Š¯¦kž~—¢š¦7žV¯Ž((€€€€€€€€€€€€€€€€€€€€€€ƒ–*ƒ’â–-¥“¾ò3¢ºM¡•­1•Ù•±UÀ §–6žÒh(€€€€€€€€€€€€€€€€€€€€€€ƒžfóžRžjžVÛ’â/–>¿’î—žnÓš:—š&û–"Ã¦g–/–žÒƒŽ(€€€€€€€€€€€€€€€€€€€€€€ƒ–>«šnÓšZÃ¦g’â–Â?–†+šZ–¶_¾ò3’â7žR£¦7žV¯šVÓ–,(€€€€€€€€€€€€€€€€€€€€€€ƒ–ö#žª_¾ò#¦7žV¯šVÓ–/–ö#žª_šrš*+ž:§–ºÛš¶–r£žr,(€€€€€€€€€€€€€€€€€€€€€€ƒžj–"¦‚–Ÿ–ºç’æ’â¢ÖßšÒ_š:'¾ò3’æ/–&7š&7’þ»¦8(€€€€€€€€€€€€€€€€€€€€€€ƒ–B3’â¦†{–z/žj‰ÕŸ¾ò'Ž(€€€€€€€€€€€€€€€€€€€€¨¼((€€€€€€€€€€€€€€€€€€€€œñ‘¥Ø¥ô‰¡…É…Ñ•ÉÙ…Ñ…É1•Ù•°œ¬(€€€€€€€€€€€€€€€€€€€Í±½Ñ%¹‘•à¬(€€€€€€€€€€€€€€€€€€€€œˆÍÑå±”ô‰™½¹ÐµÍ¥é”èÄÁÁàí½±½ÈèˆÍ„ÔáŒìˆøœ¬(€€€€€€€€€€€€€€€€€€€€‰1Ø¸ˆ­¡…É…Ñ•È¹±•Ù•°¬(€€€€€€€€€€€€€€€€€€€€ˆð½‘¥Øøˆ¬((€€€€€€€€€€€€€€€€€€€€ˆð½‘¥Øøˆì((€€€€€€€€€€€ô(€€€€€€€€€€€•±Í•ì((€€€€€€€€€€€€€€€½¹ÍÐ•±¥¥‰±”ô(€€€€€€€€€€€€€€€€€€€Í±½Ñ%¹‘•àôôôÄ(€€€€€€€€€€€€€€€€€€€€üÁ±…å•È¹±•Ù•°øôÄÀ(€€€€€€€€€€€€€€€€€€€€è¥ÍQ¡¥É‘¡…É…Ñ•ÉU¹±½­• ¤ì((€€€€€€€€€€€€€€€½¹ÍÐÕ¹±½­Q•áÐô(€€€€€€€€€€€€€€€€€€€Í±½Ñ%¹‘•àôôôÄ(€€€€€€€€€€€€€€€€€€€€ü€‰1Ø¸ÄÃ¢ž¦:Xˆ(€€€€€€€€€€€€€€€€€€€€è€‹–&7–§–B7žj1Ø¸ÔÀˆì(((€€€€€€€€€€€€€€€¡Ñµ°¬ô((€€€€€€€€€€€€€€€€€€€€œñ‘¥ØÍÑå±”ô‰Ý¥‘Ñ èØÙÁàíÑ•áÐµ…±¥¸é•¹Ñ•Èìœ¬(€€€€€€€€€€€€€€€€€€€€ÕÉÍ½ÈéÁ½¥¹Ñ•Èí½Á…¥Ñäèœ¬(€€€€€€€€€€€€€€€€€€€€¡•±¥¥‰±”üˆÄˆèˆ¸ÔÔˆ¤¬(€€€€€€€€€€€€€€€€€€€€œìˆ½¹±¥¬ôˆœ¬(€€€€€€€€€€€€€€€€€€€€ (€€€€€€€€€€€€€€€€€€€€€€€•±¥¥‰±”(€€€€€€€€€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€€€€€€€€€€‰±½Í•!½µ••…ÑÕÉ” ¤í½Á•¹¡…É…Ñ•ÉÉ•…Ñ¥½¸ ˆ¬¡Í±½Ñ%¹‘•à¬Ä¤¬ˆ¤ìˆ(€€€€€€€€€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€€€€€€€€€¤¬(€€€€€€€€€€€€€€€€€€€€œˆøœ¬((€€€€€€€€€€€€€€€€€€€€œñ‘¥ØÍÑå±”ô‰Ý¥‘Ñ èÐÁÁàí¡•¥¡ÐèÐÁÁàíµ…É¥¸èÀ…ÕÑ¼ìœ¬(€€€€€€€€€€€€€€€€€€€€‰½É‘•ÈµÉ…‘¥ÕÌèÔÀ”í‰…­É½Õ¹é±¥¹•…ÈµÉ…‘¥•¹Ð ÄØÁ‘•œ°ŒÈÐÅŒÄÈ°ŒÄÔÄÀÁ„¤ìœ¬(€€€€€€€€€€€€€€€€€€€€‰½É‘•ÈèÉÁà‘…Í¡•€Œá„Ù„Í„í‘¥ÍÁ±…äé™±•àí…±¥¸µ¥Ñ•µÌé•¹Ñ•Èìœ¬(€€€€€€€€€€€€€€€€€€€€©ÕÍÑ¥™äµ½¹Ñ•¹Ðé•¹Ñ•Èí™½¹ÐµÍ¥é”èÄÙÁàìˆøœ¬(€€€€€€€€€€€€€€€€€€€€ˆˆ¬(€€€€€€€€€€€€€€€€€€€€ˆð½‘¥Øøˆ¬((€€€€€€€€€€€€€€€€€€€€œñ‘¥ØÍÑå±”ô‰™½¹ÐµÍ¥é”èÄÅÁàí™½¹ÐµÝ•¥¡Ðé‰½±íµ…É¥¸µÑ½ÀèÉÁàìœ¬(€€€€€€€€€€€€€€€€€€€€½±½ÈèŒá„á„á„ìˆøœ¬(€€€€€€€€€€€€€€€€€€€€‹šr«¢ž¦:Xˆ¬(€€€€€€€€€€€€€€€€€€€€ˆð½‘¥Øøˆ¬((€€€€€€€€€€€€€€€€€€€€œñ‘¥ØÍÑå±”ô‰™½¹ÐµÍ¥é”èÄÁÁàí½±½ÈèŒÝ„Ù˜ÕŒìˆøœ¬(€€€€€€€€€€€€€€€€€€€€ (€€€€€€€€€€€€€€€€€€€€€€€•±¥¥‰±”(€€€€€€€€€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€€€€€€€€€€‹¦î{šN+–&×–îèˆ(€€€€€€€€€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€€€€€€€€€Õ¹±½­Q•áÐ(€€€€€€€€€€€€€€€€€€€€¤¬(€€€€€€€€€€€€€€€€€€€€ˆð½‘¥Øøˆ¬((€€€€€€€€€€€€€€€€€€€€ˆð½‘¥Øøˆì((€€€€€€€€€€€ô((€€€€€€€ô(€€€€¤ì(((€€€¡Ñµ°¬ô(€€€€€€€€ˆð½‘¥Øøˆì(((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3Ž3’â7šb¿¢šš2'’â/–:ì(€€€€€€ƒ–"š>o–"Ã–:šr³¦‚¦v‹¾ò3šb¿¢ššVÓ–B#–"Ã–B3’â–,(€€€€€€ƒžV¯¦v‹¢Ž‡Ž7¾ò'¾òh(€€€€€€ƒ–:šr³¦g¢Ž‡šb¿’â'–/Ž3–Â;¦‚Ž7š2'¦"W¾ò3¦î{’â/–:ïšr(€€€€€€ƒ¦^sš:'¦g–/¢š[žª_Ž¢ÞÏ–:ï¢3–2¿ž.š,¿š*¢ô(€€€€€€ƒ¦‚¦v‹ŽšRçš"C’â'–/Ž3–"¦‚Ž7š2'¦"W¾ò3¦î{’â/–:ì(€€€€€€ƒ–Fó–>­ÍÝ¥Ñ¡¡…É…Ñ•ÉQ…ˆ §ŠSŠS’â7šr¦^sš:$(€€€€€€ƒ¢š[žª_¾ò3šb¿š*+–Â7š'¦‚¦v‹žj–Ÿ–ºçŽ3–Ž7¦È(€€€€€€€¡…É…Ñ•ÉQ…‰½¹Ñ•¹Ó¦g–/–ºç–f£¢Ž„(€€€€€€ƒ–:–rÃ¦†¿ž’ë¾ò3¢Þ’æ/–&7–žR£’âï–~;’òGš¼¿žÚO¦¦_šÆ€(€€€€€€ƒ–6‡ž&šb¿–B3’âš.o¾ò3–>«šb¿¦gš²‡–žjšb¿šVÓ¦‚Ž(€€€€¨¼((€€€¡Ñµ°¬ô((€€€€€€€€œñ‘¥ØÍÑå±”ô‰‘¥ÍÁ±…äé™±•àí…ÀèÙÁàíµ…É¥¸µ‰½ÑÑ½´èÙÁàìˆøœ¬((€€€€€€€€œñ‰ÕÑÑ½¸¥ô‰¡…É…Ñ•ÉQ…‰	Ñ¹áÁA½½°ˆ±…ÍÌô‰¡½µ”µ™•…ÑÕÉ”µ‰Õäµ‰Ñ¸ˆœ¬(€€€€€€€€ÍÑå±”ô‰™±•àèÄíÁ…‘‘¥¹œèÄÁÁà€ÙÁàí™½¹ÐµÍ¥é”èÄáÁàíµ¥¸µ¡•¥¡ÐèÔÉÁàìˆœ¬(€€€€€€€€½¹±¥¬ô‰ÍÝ¥Ñ¡¡…É…Ñ•ÉQ…ˆ¡p•áÁA½½±pœ¤ˆøœ¬(€€€€€€€€‹žÚO¦¦_šÆƒ–"¦4ˆ¬(€€€€€€€€ˆð½‰ÕÑÑ½¸øˆ¬((€€€€€€€€œñ‰ÕÑÑ½¸¥ô‰¡…É…Ñ•ÉQ…‰	Ñ¹MÑ…ÑÕÌˆ±…ÍÌô‰¡½µ”µ™•…ÑÕÉ”µ‰Õäµ‰Ñ¸ˆœ¬(€€€€€€€€ÍÑå±”ô‰™±•àèÄíÁ…‘‘¥¹œèÄÁÁà€ÙÁàí™½¹ÐµÍ¥é”èÄáÁàíµ¥¸µ¡•¥¡ÐèÔÉÁàìˆœ¬(€€€€€€€€½¹±¥¬ô‰ÍÝ¥Ñ¡¡…É…Ñ•ÉQ…ˆ¡pÍÑ…ÑÕÍpœ¤ˆøœ¬(€€€€€€€€‹¢÷–*o–ðˆ¬(€€€€€€€€ˆð½‰ÕÑÑ½¸øˆ¬((€€€€€€€€œñ‰ÕÑÑ½¸¥ô‰¡…É…Ñ•ÉQ…‰	Ñ¹M­¥±°ˆ±…ÍÌô‰¡½µ”µ™•…ÑÕÉ”µ‰Õäµ‰Ñ¸ˆœ¬(€€€€€€€€ÍÑå±”ô‰™±•àèÄíÁ…‘‘¥¹œèÄÁÁà€ÙÁàí™½¹ÐµÍ¥é”èÄáÁàíµ¥¸µ¡•¥¡ÐèÔÉÁàìˆœ¬(€€€€€€€€½¹±¥¬ô‰ÍÝ¥Ñ¡¡…É…Ñ•ÉQ…ˆ¡pÍ­¥±±pœ¤ˆøœ¬(€€€€€€€€‹š*¢ôˆ¬(€€€€€€€€ˆð½‰ÕÑÑ½¸øˆ¬((€€€€€€€€ˆð½‘¥Øøˆ¬((€€€€€€€€¼¨(€€€€€€€€€€ƒŠbƒ’þ»š¶¾ò#’úwžŸ’öÿžR£¢–n{–‚Ç¾ò3Ž3š*¢ô(€€€€€€€€€€ƒ¦‚¦v‹’â7¢÷š6Ë–.W¾ò3–Â;¢Ó’â/¦v‹š*¢÷žr,(€€€€€€€€€€ƒ’â7–"ÃŽ7¾ò'¾òh(€€€€€€€€€€ƒ–:šr±µ¥¸µ¡•¥¡Ó–¾¯š¶ìÐàÁÁã¾ò3–r (€€€€€€€€€€ƒš&/š¦ž?¢š÷–f£¾ò#–Â“–ÛžÚË–v–"_¦
¦†¿ž’ë¢F\(€€€€€€€€€€ƒžjM…µÍÕ¹œ	É½ÝÍ•Ë¾ò'–¾›¦jo–>¿¢šX(€€€€€€€€€€ƒ¦®c–ê›š¾S¢òž~»žjšf–g¾ò0ÐàÁÁã¦g–,(€€€€€€€€€€ƒ’â/¦fCž†³šb¿š¾Qµ…àµ¡•¥¡ÐèØÁ‘Ù£¦
(€€€€€€€€€€ƒ¦®c¾ò1MO¢š?–&¢Ž…µ¥¸µ¡•¥¡Ó–«–#š²((€€€€€€€€€€ƒš¾Qµ…àµ¡•¥¡Ó¦®c¾ò3ž¶'šZó¦g–/–ºç–f (€€€€€€€€€€ƒšÂã¦ƒ¢Ï–ÂDÐàÁÁã¦®c¾ò3¢Þ–’[–Æ(€€€€€€€€€€€¹¡½µ”µ™•…ÑÕÉ”µµ½‘…°µ‰½ã¢«–ÞÄ(€€€€€€€€€€ƒžj¦®c–ê›’â+¦fC¾ò àÁ‘Ù£¾ò<¹Ý¥‘—šf(€€€€€€€€€€€äÙ‘Ù£¾ò'šNƒ–r£’â¢Öß¾ò3–ºçšbO–§–Æ“¦ô(€€€€€€€€€€ƒ¢Ú–ëŽ¢º+š"CŽ3–’[–Æ“–ºç–f ¯–Ÿ–Æ(€€€€€€€€€€ƒ–ºç–f£Ž7–§–/¦÷¢šš6Ë–.Wžj–Þ‹ž.š6Ë–.W¾ò0(€€€€€€€€€€ƒš&/š¦’â+–ú#–ºçšbO–6‡’ö?Žš¢šë–º3– (€€€€€€€€€€ƒš6Ë’â7–.WŽ((€€€€€€€€€€ƒšRçš"Aµ¥¸ ÐàÁÁà°ÔÁ‘Ù §ŠSŠS–Ÿ–ºä(€€€€€€€€€€ƒ¢ò–’kžj–"¦‚¾ò#¢÷–*o–ó¾ò'¦
šb¿žn‡¦<(€€€€€€€€€€ƒš*OšîüÐàÁÁã¦g–/žBšÏ–ó¾ò3’ö¢z‹–æT(€€€€€€€€€€ƒžržjž~»žjšf–gšr¢«–.W¢ºOš¶—¾ò0(€€€€€€€€€€ƒ’â7šrž†³šJC–ë–§–Æ“¦÷¢šš6Ë–.Wžj(€€€€€€€€€€ƒ¢†wžª¾ò3–B3šf–nƒž
ëš¾?š²‡žº_–ë’úžj(€€€€€€€€€€ƒ¦
šb¿–B3’â–/–në–ºk–ó¾ò#’â7šr–nƒž
è(€€€€€€€€€€ƒ–"–"¦‚¢3šRç¢º+¾ò'¾ò3–:šr³Ž3–"–"¦‚(€€€€€€€€€€ƒ–’Ÿ–Â?’â7¢ÞÏ–.WŽ7žj¦ršÆ¦
šb¿šr'’þwžVgŽ(€€€€€€€€¨¼((€€€€€€€€œñ‘¥Ø¥ô‰¡…É…Ñ•ÉQ…‰½¹Ñ•¹Ðˆœ¬(€€€€€€€€ÍÑå±”ô‰™±•àèÄ€Ä…ÕÑ¼í¡•¥¡Ðé…ÕÑ¼íµ¥¸µ¡•¥¡ÐèÀíµ…àµ¡•¥¡Ðé¹½¹”í½Ù•É™±½Üµäé…ÕÑ¼í½Ù•É™±½Üµàé¡¥‘‘•¸ìµÝ•‰­¥Ðµ½Ù•É™±½ÜµÍÉ½±±¥¹œéÑ½Õ í½Ù•ÉÍÉ½±°µ‰•¡…Ù¥½Èµäé½¹Ñ…¥¸íÑ½Õ µ…Ñ¥½¸éÁ…¸µäí‰½àµÍ¥é¥¹œé‰½É‘•Èµ‰½àìˆøð½‘¥Øøœì(((€€€É•ÑÕÉ¸¡Ñµ°ì()ô(((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€ƒŠbƒš¾?š^—’îï–.d(ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€ƒŠbƒ¦n‹žÞkžÚO¦¦\(ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼()™Õ¹Ñ¥½¸É•¹‘•É=™™±¥¹•áÁ½¹Ñ•¹Ð ¥ì((€€€½¹ÍÐ¡½ÕÉÌô((€€€€€€€5…Ñ ¹™±½½È (€€€€€€€€€€€½™™±¥¹•±…ÁÍ•‘5¥¹ÕÑ•Í½É¥ÍÁ±…ä¼ØÀ(€€€€€€€€¤ì((€€€½¹ÍÐµ¥¹ÕÑ•Ìô((€€€€€€€½™™±¥¹•±…ÁÍ•‘5¥¹ÕÑ•Í½É¥ÍÁ±…ä”(€€€€€€€€ØÀì(((€€€½¹ÍÐ…ÁÁ•‘9½Ñ¥”ô((€€€€€€€½™™±¥¹•±…ÁÍ•‘5¥¹ÕÑ•Í½É¥ÍÁ±…äø(€€€€€€€=1%9}aA}5a}5%9UQL(€€€€€€€€ü(€€€€€€€€œñ‘¥ØÍÑå±”ô‰™½¹ÐµÍ¥é”èÄÅÁàí½±½Èè”ààÌÙˆíµ…É¥¸µÑ½ÀèÑÁàìˆøœ¬(€€€€€€€€‹¾ò#¦n‹žÞkžÚO¦¦_šr–’k–>«¢¢#žº\ã–Â?šf¾ò3¢Ú¦;žj¦£–"’â7šr¦†7–’[žÒ¿ž¦7¾ò$ˆ¬(€€€€€€€€ˆð½‘¥Øøˆ(€€€€€€€€è(€€€€€€€€ˆˆì(((€€€É•ÑÕÉ¸€ ((€€€€€€€€œñ‘¥ØÍÑå±”ô‰™½¹ÐµÍ¥é”èÄÍÁàí±¥¹”µ¡•¥¡ÐèÄ¸àìˆøœ¬((€€€€€€€€‹¦n‹žÞkšf¦ZO¾òhˆ­¡½ÕÉÌ¬‹–Â?šfˆ­µ¥¹ÕÑ•Ì¬‹–"¦B`ñ‰Èøˆ¬((€€€€€€€€‹–>¿¦‚c–>[¦n‹žÞkžÚO¦¦_¾òhˆ¬(€€€€€€€€œñÍÁ…¸ÍÑå±”ô‰½±½Èè˜ÁˆÐÈäí™½¹ÐµÝ•¥¡Ðé‰½±ìˆøœ¬(€€€€€€€Á•¹‘¥¹=™™±¥¹•áÀ¬(€€€€€€€€ˆð½ÍÁ…¸øˆ¬(€€€€€€€€‰a@ˆ¬((€€€€€€€…ÁÁ•‘9½Ñ¥”¬((€€€€€€€€œñ‘¥ØÍÑå±”ô‰™½¹ÐµÍ¥é”èÄÅÁàí½±½ÈèˆÍ„ÔáŒíµ…É¥¸µÑ½ÀèáÁàìˆøœ¬(€€€€€€€€‹¦n‹žÞkžÚO¦¦_šržnÓš:—–*ƒ¦Ë–ÇžR£žÚO¦¦_šÆƒ¾ò0ˆ¬(€€€€€€€€‹š¾?–"¦B`ˆ­=1%9}aA}AI}5%9UQ¬‹¦î{¾ò0ˆ¬(€€€€€€€€‹šr–’k¢¢#žº\ã–Â?šfŽˆ¬(€€€€€€€€ˆð½‘¥Øøˆ¬((€€€€€€€€ˆð½‘¥Øøˆ¬((€€€€€€€€œñ‰ÕÑÑ½¸±…ÍÌô‰¡½µ”µ™•…ÑÕÉ”µ‰Õäµ‰Ñ¸‰ÍÑå±”ô‰Ý¥‘Ñ èÄÀÀ”íµ…É¥¸µÑ½ÀèÄÉÁàíÁ…‘‘¥¹œèÄÁÁàìˆœ¬((€€€€€€€€ (€€€€€€€€€€€Á•¹‘¥¹=™™±¥¹•áÀðôÀ(€€€€€€€€€€€€ü(€€€€€€€€€€€€‰‘¥Í…‰±•ˆ(€€€€€€€€€€€€è(€€€€€€€€€€€€ˆˆ(€€€€€€€€¤¬((€€€€€€€€½¹±¥¬ô‰±…¥µ=™™±¥¹•áÀ ¤ˆøœ¬((€€€€€€€€ (€€€€€€€€€€€Á•¹‘¥¹=™™±¥¹•áÀðôÀ(€€€€€€€€€€€€ü(€€€€€€€€€€€€‹žn»–&7šÊKšr'–>¿¦‚c–>[žj¦n‹žÞkžÚO¦¦\ˆ(€€€€€€€€€€€€è(€€€€€€€€€€€€‹¦‚c–>Xˆ­Á•¹‘¥¹=™™±¥¹•áÀ¬‹¦n‹žÞkžÚO¦¦\ˆ(€€€€€€€€¤¬((€€€€€€€€ˆð½‰ÕÑÑ½¸øˆ¬((€€€€€€€€¼¨(€€€€€€€€€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3Ž3žr/–î–F((€€€€€€€€€€ƒ¦ng–7¦‚c–>[Ž7žjž²³’â–/ž’ëž¾žR£šÎW¾ò'¾òh(€€€€€€€€€€ƒ–>«šr'–r£šr'švÇ¢–ÿ–>¿’î—¦‚c–>[žjšf–gš&7¦†¿ž’è(€€€€€€€€€€ƒ¦g¦†š2'¦"W¾ò3–Fó–>­Í¡½ÝI•Ý…É‘•‘ §¾ò0(€€€€€€€€€€ƒš"C–*žj…±±‰…¯¢Ž‡–Fó–>¬(€€€€€€€€€€±…¥µ=™™±¥¹•áÀ¡ÑÉÕ”§¾ò#–’k’â–,(€€€€€€€€€€ƒ–>šVã–F+¢¢Ó¦‚c–>[–÷–ò?Ž3¦gš²‡šb¿¦ng–7Ž7¾ò'Ž(€€€€€€€€¨¼((€€€€€€€€ ((€€€€€€€€€€€Á•¹‘¥¹=™™±¥¹•áÀøÀ(€€€€€€€€€€€€ü(€€€€€€€€€€€€œñ‰ÕÑÑ½¸±…ÍÌô‰¡½µ”µ™•…ÑÕÉ”µ‰Õäµ‰Ñ¸ˆœ¬(€€€€€€€€€€€€ÍÑå±”ô‰Ý¥‘Ñ èÄÀÀ”íµ…É¥¸µÑ½ÀèáÁàíÁ…‘‘¥¹œèÄÁÁàìœ¬(€€€€€€€€€€€€‰…­É½Õ¹é±¥¹•…ÈµÉ…‘¥•¹Ð ÄàÁ‘•œ°˜ÁˆÐÈä°ŒäÜäÅ”¤ìœ¬(€€€€€€€€€€€€½±½ÈèŒÉ„ÄÜÀØìˆœ¬(€€€€€€€€€€€€½¹±¥¬ô‰±…¥µ=™™±¥¹•áÁ]¥Ñ¡ ¤ˆøœ¬(€€€€€€€€€€€€‹žr/–î–F+¦ng–7¦‚c–>[¾ò ˆ¬(€€€€€€€€€€€€¡Á•¹‘¥¹=™™±¥¹•áÀ¨È¤¬(€€€€€€€€€€€€‰aC¾ò$ˆ¬(€€€€€€€€€€€€ˆð½‰ÕÑÑ½¸øˆ(€€€€€€€€€€€€è(€€€€€€€€€€€€ˆˆ((€€€€€€€€¤((€€€€¤ì()ô(((¼¨(€€ƒŠbƒšZÃ–Š{¾òkžr/–î–F+¦ng–7¦‚c–>[žj–—–>¾ò3–Fó–>¬(€€ƒ¦kžR£žjÍ¡½ÝI•Ý…É‘•‘ §¾ò3š"C–*š&7žržj(€€ƒ¦ng–7žfóšRû¾ò3–’ÇšV\¿–>[šÚ#žj¢¦Ç’î¦êó¦÷’â7šr(€€ƒžfóžR¾ò#’â7šrš&’îï’öWšvÇ¢–ÿ¾ò3–>«šb¿šÊKš.ÿ–"À(€€ƒ¦ng–7–*ƒš"C¾ò3–:šr³šÊKžr/–î–F+žjš¶–âã¦‚c–>X(€€±…¥µ=™™±¥¹•áÀ §¦
šb¿–>¿’î—žŸ–âã’öÿžR£¾ò'Ž(¨¼()™Õ¹Ñ¥½¸±…¥µ=™™±¥¹•áÁ]¥Ñ¡ ¥ì((€€€¥˜¡Á•¹‘¥¹=™™±¥¹•áÀðôÀ¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€Í¡½ÝI•Ý…É‘•‘ (€€€€€€€€ ¤ôùì((€€€€€€€€€€€±…¥µ=™™±¥¹•áÀ (€€€€€€€€€€€€€€€ÑÉÕ”(€€€€€€€€€€€€¤ì((€€€€€€€ô°(€€€€€€€€ ¤ôùì((€€€€€€€€€€€…‘‘	…ÑÑ±•1½œ (€€€€€€€€€€€€€€€€‹–î–F+šr«žr/–º3¾ò3ž‡šÎW¦‚c–>[¦ng–7ž6;–.×Žˆ(€€€€€€€€€€€€¤ì((€€€€€€€ô(€€€€¤ì()ô(()™Õ¹Ñ¥½¸±…¥µ=™™±¥¹•áÀ (€€€¥Í½Õ‰±•(¥ì((€€€¥˜¡Á•¹‘¥¹=™™±¥¹•áÀðôÀ¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾òk–*ƒ’ê¥Í½Õ‰±•“¦g–/–>šVã¾ò0(€€€€€€ƒžr/–î–F+š"C–*šf–
ÍÑÉÕ—¾ò3–¾›¦jo–¶c–—žÚO¦¦_šÆ€(€€€€€€ƒžjšVã–¶_’æc’î”Ë¾òo’â¢"³šÊKžr/–î–F+žj¦‚c–>X(€€€€€€ƒžÚ·š2–:šr³šVã–¶_’â7¢º+Ž(€€€€¨¼((€€€½¹ÍÐÉ•Ý…É‘µ½Õ¹Ðô((€€€€€€€¥Í½Õ‰±•(€€€€€€€€ü(€€€€€€€Á•¹‘¥¹=™™±¥¹•áÀ¨È(€€€€€€€€è(€€€€€€€Á•¹‘¥¹=™™±¥¹•áÀì(((€€€Í¡…É•‘áÀô(€€€€€€€Í¡…É•‘áÀ¬(€€€€€€€É•Ý…É‘µ½Õ¹Ðì(((€€€…‘‘	…ÑÑ±•1½œ ((€€€€€€€€ (€€€€€€€€€€€¥Í½Õ‰±•(€€€€€€€€€€€€ü(€€€€€€€€€€€€‹–î–F+¦ng–7¦‚c–>[¦n‹žÞkžÚO¦¦\ˆ(€€€€€€€€€€€€è(€€€€€€€€€€€€‹¦‚c–>[¦n‹žÞkžÚO¦¦\ˆ(€€€€€€€€¤¬(€€€€€€€É•Ý…É‘µ½Õ¹Ð¬(€€€€€€€€‹¦î{¾ò3–ÞË–¶c–—žÚO¦¦_šÆƒŽˆ((€€€€¤ì(((€€€Á•¹‘¥¹=™™±¥¹•áÀô(€€€€€€€€Àì(((€€€ÕÁ‘…Ñ•U$ ¤ì((€€€Í…Ù•…µ” ¤ì(((€€€½¹ÍÐ‰½‘å°ô(€€€€€€€€ ‰¡½µ••…ÑÕÉ•5½‘…±	½‘äˆ¤ì(((€€€¥˜¡‰½‘å°¥ì((€€€€€€€‰½‘å°¹¥¹¹•É!Q50ô(€€€€€€€€€€€É•¹‘•É=™™±¥¹•áÁ½¹Ñ•¹Ð ¤ì((€€€ô()ô(((¼¨(€€ƒŠbƒ’þ»š¶¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3’îï–.gšRçš"C–§–,(€€ƒ–"¦‚¾òkš¾?š^—’îï–.g¾ò?–žS¢¢_’îï–.g¾ò'¾òh(€€ƒ–:šr±É•¹‘•ÉEÕ•ÍÑ½¹Ñ•¹Ð §šVÓšº×¦
?¢ò¿š*÷š"@(€€ƒ¦kžR£ž&#šr±É•¹‘•ÉEÕ•ÍÑ1¥ÍÑ•¹•É¥Œ §¾ò0(€€ƒ–BŽ3š*¢÷–ºkžú§šâ–Z¸¿ž.š/ž&§’îØ¿¦‚c–>[–÷–ò<(€€ƒ–B7ž¢ÇŽ7’â'–/–>šVã¾ò3š¾?š^—’îï–.gŽ–žS¢¢_’îï–.d(€€ƒ–ÇžR£–B3’â’î÷šâËš~O¦
?¢ò¿¾ò3’â7žR£–¾¯–§š²‡–æû’æ8(€€ƒ’âš¢žjž¢/–ò?žŠóŽ(¨¼()™Õ¹Ñ¥½¸™½Éµ…ÑEÕ•ÍÑI•Ý…É¡É•Ý…É¥ì((€€€½¹ÍÐÁ…ÉÑÌõmtì((€€€¥˜¡É•Ý…É¹½±¥ì(€€€€€€€Á…ÉÑÌ¹ÁÕÍ  (€€€€€€€€€€€€‹¦G–æŒ€ˆ­É•Ý…É¹½±(€€€€€€€€¤ì€€€ô((€€€¥˜¡É•Ý…É¹•áÀ¥ì(€€€€€€€Á…ÉÑÌ¹ÁÕÍ  (€€€€€€€€€€€€‰a@€ˆ­É•Ý…É¹•áÀ(€€€€€€€€¤ì(€€€ô((€€€É•ÑÕÉ¸Á…ÉÑÌ¹©½¥¸ ‹Ž ˆ¤ì()ô(((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€XàäƒŠPƒ’îï–.g–º3š"C–ê›ž6;–.×¦ª£šzØ(€€€´€ÈÀ€¼€ÐÀ€¼€ØÀ€¼€àÀ€¼€ÄÀÀƒ’êS¦j;šº×Ž(€€€´ƒžn»–&7–>«–îëž®,U$ƒ¢"–º3š"C–ê›¢¢#žº_¾ò3’â7žfóšRû’îï’öWž6;–.×Ž’â7–¾¯–—–¶cšªSŽ(€€€´ƒ–º3š"C–ê›’úwŽ3š&šr'’îï–.gžn»š¢gžjžÒ¿ž¦7¦Ë–ê˜€¼ƒš&šr'žn»š¢gžâ÷¦?Ž7¢¢#žº_¾ò0(€€€€ƒ¢ºOš¾?š^”€Ìƒ’îï–.gŽ–žS¢¢\€Èƒ’îï–.g’æ¢÷¢«žÛ¢Þ£¦8€ÈÀ”ƒ¦j;šº×Ž(ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼)½¹ÍÐEUMQ}=5A1Q%=9}5%1MQ=9Lõl(€€€€ÈÀ°ÐÀ°ØÀ°àÀ°ÄÀÀ)tì(()™Õ¹Ñ¥½¸•ÑEÕ•ÍÑ½µÁ±•Ñ¥½¹A•É•¹Ð (€€€‘•™¥¹¥Ñ¥½¹Ì°(€€€ÍÑ…Ñ”(¥ì((€€€±•ÐÑ½Ñ…±½…°ôÀì(€€€±•ÐÑ½Ñ…±AÉ½É•ÍÌôÀì((€€€‘•™¥¹¥Ñ¥½¹Ì¹™½É… ¡™Õ¹Ñ¥½¸¡ÅÕ•ÍÐ¥ì((€€€€€€€½¹ÍÐ½…°ô(€€€€€€€€€€€5…Ñ ¹µ…à (€€€€€€€€€€€€€€€€À°(€€€€€€€€€€€€€€€9Õµ‰•È¡ÅÕ•ÍÐ¹½…°¥ñðÀ(€€€€€€€€€€€€¤ì((€€€€€€€½¹ÍÐÁÉ½É•ÍÌô(€€€€€€€€€€€5…Ñ ¹µ…à (€€€€€€€€€€€€€€€€À°(€€€€€€€€€€€€€€€9Õµ‰•È (€€€€€€€€€€€€€€€€€€€ÍÑ…Ñ”¹ÁÉ½É•ÍÍmÅÕ•ÍÐ¹¥‘t(€€€€€€€€€€€€€€€€¥ñðÀ(€€€€€€€€€€€€¤ì((€€€€€€€Ñ½Ñ…±½…°¬õ½…°ì(€€€€€€€Ñ½Ñ…±AÉ½É•ÍÌ¬ô(€€€€€€€€€€€5…Ñ ¹µ¥¸ (€€€€€€€€€€€€€€€½…°°(€€€€€€€€€€€€€€€ÁÉ½É•ÍÌ(€€€€€€€€€€€€¤ì((€€€ô¤ì((€€€¥˜¡Ñ½Ñ…±½…°ðôÀ¥ì(€€€€€€€É•ÑÕÉ¸€ÄÀÀì(€€€ô((€€€É•ÑÕÉ¸5…Ñ ¹µ¥¸ (€€€€€€€€ÄÀÀ°(€€€€€€€5…Ñ ¹µ…à (€€€€€€€€€€€€À°(€€€€€€€€€€€Ñ½Ñ…±AÉ½É•ÍÌ½Ñ½Ñ…±½…°¨ÄÀÀ(€€€€€€€€¤(€€€€¤ì()ô(()™Õ¹Ñ¥½¸É•¹‘•ÉEÕ•ÍÑ½µÁ±•Ñ¥½¹A…¹•±½¹Ñ•¹Ð (€€€‘•™¥¹¥Ñ¥½¹Ì°(€€€ÍÑ…Ñ”(¥ì((€€€½¹ÍÐÁ•É•¹Ðô(€€€€€€€•ÑEÕ•ÍÑ½µÁ±•Ñ¥½¹A•É•¹Ð (€€€€€€€€€€€‘•™¥¹¥Ñ¥½¹Ì°(€€€€€€€€€€€ÍÑ…Ñ”(€€€€€€€€¤ì((€€€½¹ÍÐ‘¥ÍÁ±…åA•É•¹Ðô(€€€€€€€5…Ñ ¹™±½½È¡Á•É•¹Ð¤ì((€€€½¹ÍÐµ¥±•ÍÑ½¹•Ìô(€€€€€€€EUMQ}=5A1Q%=9}5%1MQ=9L(€€€€€€€€¹µ…À¡™Õ¹Ñ¥½¸¡Ñ¡É•Í¡½±¥ì((€€€€€€€€€€€½¹ÍÐÉ•…¡•ô(€€€€€€€€€€€€€€€Á•É•¹ÐøõÑ¡É•Í¡½±ì((€€€€€€€€€€€É•ÑÕÉ¸€ (€€€€€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰ÅÕ•ÍÐµµ¥±•ÍÑ½¹”œ¬(€€€€€€€€€€€€€€€€€€€€¡É•…¡•€ü€ˆÉ•…¡•ˆ€è€ˆˆ¤¬œˆøœ¬(€€€€€€€€€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰ÅÕ•ÍÐµµ¥±•ÍÑ½¹”µÁ•É•¹Ðˆøœ¬(€€€€€€€€€€€€€€€€€€€€€€€Ñ¡É•Í¡½±¬œ”œ¬(€€€€€€€€€€€€€€€€€€€€œð½‘¥Øøœ¬(€€€€€€€€€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰ÅÕ•ÍÐµµ¥±•ÍÑ½¹”µÍ±½Ðˆ…É¥„µ±…‰•°ô‹ž6;–.×–ú¢¢·–ºhˆøœ¬(€€€€€€€€€€€€€€€€€€€€€€€€œñÍÁ…¸û–ú–ºhð½ÍÁ…¸øœ¬(€€€€€€€€€€€€€€€€€€€€œð½‘¥Øøœ¬(€€€€€€€€€€€€€€€€œð½‘¥Øøœ(€€€€€€€€€€€€¤ì((€€€€€€€ô¤(€€€€€€€€¹©½¥¸ ˆˆ¤ì((€€€É•ÑÕÉ¸€ (€€€€€€€€œñ‘¥Ø±…ÍÌô‰ÅÕ•ÍÐµ½µÁ±•Ñ¥½¸µ¡•…ˆøœ¬(€€€€€€€€€€€€œñÍÁ…¸û–º3š"C–ê›ž6;–.Ôð½ÍÁ…¸øœ¬(€€€€€€€€€€€€œñÍÑÉ½¹œøœ­‘¥ÍÁ±…åA•É•¹Ð¬œ”ð½ÍÑÉ½¹œøœ¬(€€€€€€€€œð½‘¥Øøœ¬((€€€€€€€€œñ‘¥Ø±…ÍÌô‰ÅÕ•ÍÐµ½µÁ±•Ñ¥½¸µÑÉ…¬ˆ…É¥„µ¡¥‘‘•¸ô‰ÑÉÕ”ˆøœ¬(€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰ÅÕ•ÍÐµ½µÁ±•Ñ¥½¸µ™¥±°ˆÍÑå±”ô‰Ý¥‘Ñ èœ­Á•É•¹Ð¬œ”ìˆøð½‘¥Øøœ¬(€€€€€€€€œð½‘¥Øøœ¬((€€€€€€€€œñ‘¥Ø±…ÍÌô‰ÅÕ•ÍÐµ½µÁ±•Ñ¥½¸µµ¥±•ÍÑ½¹•Ìˆøœ¬(€€€€€€€€€€€µ¥±•ÍÑ½¹•Ì¬(€€€€€€€€œð½‘¥Øøœ(€€€€¤ì()ô(()™Õ¹Ñ¥½¸É•¹‘•ÉEÕ•ÍÑ1¥ÍÑ•¹•É¥Œ (€€€‘•™¥¹¥Ñ¥½¹Ì°(€€€ÍÑ…Ñ”°(€€€±…¥µ¹9…µ”(¥ì((€€€±•Ð¡Ñµ°ô(€€€€€€€€œñ‘¥Ø±…ÍÌô‰ÅÕ•ÍÐµ±¥ÍÐˆøœì(((€€€‘•™¥¹¥Ñ¥½¹Ì¹™½É…  (€€€€€€€ÅÕ•ÍÐôùì((€€€€€€€€€€€½¹ÍÐÁÉ½É•ÍÌô(€€€€€€€€€€€€€€€ÍÑ…Ñ”¹ÁÉ½É•ÍÍl(€€€€€€€€€€€€€€€€€€€ÅÕ•ÍÐ¹¥(€€€€€€€€€€€€€€€uñðÀì((€€€€€€€€€€€½¹ÍÐ±…¥µ•ô(€€€€€€€€€€€€€€€€„…ÍÑ…Ñ”¹±…¥µ•‘l(€€€€€€€€€€€€€€€€€€€ÅÕ•ÍÐ¹¥(€€€€€€€€€€€€€€€tì((€€€€€€€€€€€½¹ÍÐ‘½¹”ô(€€€€€€€€€€€€€€€ÁÉ½É•ÍÌøõÅÕ•ÍÐ¹½…°ì((€€€€€€€€€€€½¹ÍÐÍ…™•AÉ½É•ÍÌô(€€€€€€€€€€€€€€€5…Ñ ¹µ¥¸ (€€€€€€€€€€€€€€€€€€€ÁÉ½É•ÍÌ°(€€€€€€€€€€€€€€€€€€€ÅÕ•ÍÐ¹½…°(€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€½¹ÍÐÁ•É•¹Ðô(€€€€€€€€€€€€€€€ÅÕ•ÍÐ¹½…°øÀ(€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€5…Ñ ¹µ¥¸ (€€€€€€€€€€€€€€€€€€€€ÄÀÀ°(€€€€€€€€€€€€€€€€€€€5…Ñ ¹µ…à (€€€€€€€€€€€€€€€€€€€€€€€€À°(€€€€€€€€€€€€€€€€€€€€€€€€¡ÁÉ½É•ÍÌ½ÅÕ•ÍÐ¹½…°¤¨ÄÀÀ(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€€ÄÀÀì((€€€€€€€€€€€½¹ÍÐÍÑ…ÑÕÍQ•áÐô(€€€€€€€€€€€€€€€±…¥µ•(€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€€‹–ÞË¦‚c–>Xˆ(€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€‘½¹”(€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€€‹–>¿¦‚c–>Xˆ(€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€€‹¦Ë¢†3’â´ˆì((€€€€€€€€€€€½¹ÍÐÍÑ…ÑÕÍ±…ÍÌô(€€€€€€€€€€€€€€€±…¥µ•(€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€€‰±…¥µ•ˆ(€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€‘½¹”(€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€€‰É•…‘äˆ(€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€€‰ÁÉ½É•ÍÌˆì((€€€€€€€€€€€½¹ÍÐ‰ÕÑÑ½¹Q•áÐô(€€€€€€€€€€€€€€€±…¥µ•(€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€€‹–ÞË¦‚c–>Xˆ(€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€‘½¹”(€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€€‹¦‚c–>Xˆ(€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€€‹šr«¦Sš"@ˆì((€€€€€€€€€€€¡Ñµ°¬ô(€€€€€€€€€€€€€€€€œñÍ•Ñ¥½¸±…ÍÌô‰ÅÕ•ÍÐµ…É€œ­ÍÑ…ÑÕÍ±…ÍÌ¬œˆøœ¬((€€€€€€€€€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰ÅÕ•ÍÐµ…Éµ¡•…ˆøœ¬(€€€€€€€€€€€€€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰ÅÕ•ÍÐµ…Éµ¹…µ”ˆøœ¬(€€€€€€€€€€€€€€€€€€€€€€€€€€€ÅÕ•ÍÐ¹¹…µ”¬(€€€€€€€€€€€€€€€€€€€€€€€€œð½‘¥Øøœ¬(€€€€€€€€€€€€€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰ÅÕ•ÍÐµÍÑ…ÑÕÌ€œ­ÍÑ…ÑÕÍ±…ÍÌ¬œˆøœ¬(€€€€€€€€€€€€€€€€€€€€€€€€€€€ÍÑ…ÑÕÍQ•áÐ¬(€€€€€€€€€€€€€€€€€€€€€€€€œð½‘¥Øøœ¬(€€€€€€€€€€€€€€€€€€€€œð½‘¥Øøœ¬((€€€€€€€€€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰ÅÕ•ÍÐµ…Éµ‘•ÍŒˆøœ¬(€€€€€€€€€€€€€€€€€€€€€€€ÅÕ•ÍÐ¹‘•ÍŒ¬(€€€€€€€€€€€€€€€€€€€€œð½‘¥Øøœ¬((€€€€€€€€€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰ÅÕ•ÍÐµÁÉ½É•ÍÌµ±¥¹”ˆøœ¬(€€€€€€€€€€€€€€€€€€€€€€€€œñÍÁ…¸û¦Ë–ê˜ð½ÍÁ…¸øœ¬(€€€€€€€€€€€€€€€€€€€€€€€€œñÍÑÉ½¹œøœ­Í…™•AÉ½É•ÍÌ¬œ€¼€œ­ÅÕ•ÍÐ¹½…°¬œð½ÍÑÉ½¹œøœ¬(€€€€€€€€€€€€€€€€€€€€œð½‘¥Øøœ¬((€€€€€€€€€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰ÅÕ•ÍÐµÁÉ½É•ÍÌµÑÉ…¬ˆ…É¥„µ¡¥‘‘•¸ô‰ÑÉÕ”ˆøœ¬(€€€€€€€€€€€€€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰ÅÕ•ÍÐµÁÉ½É•ÍÌµ™¥±°ˆÍÑå±”ô‰Ý¥‘Ñ èœ­Á•É•¹Ð¬œ”ìˆøð½‘¥Øøœ¬(€€€€€€€€€€€€€€€€€€€€œð½‘¥Øøœ¬((€€€€€€€€€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰ÅÕ•ÍÐµ…Éµ™½½Ðˆøœ¬(€€€€€€€€€€€€€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰ÅÕ•ÍÐµÉ•Ý…Éˆøœ¬(€€€€€€€€€€€€€€€€€€€€€€€€€€€€œñÍÁ…¸±…ÍÌô‰ÅÕ•ÍÐµÉ•Ý…Éµ±…‰•°ˆûž6;–.Ôð½ÍÁ…¸øœ¬(€€€€€€€€€€€€€€€€€€€€€€€€€€€€œñÍÁ…¸øœ­™½Éµ…ÑEÕ•ÍÑI•Ý…É¡ÅÕ•ÍÐ¹É•Ý…É¤¬œð½ÍÁ…¸øœ¬(€€€€€€€€€€€€€€€€€€€€€€€€œð½‘¥Øøœ¬((€€€€€€€€€€€€€€€€€€€€€€€€œñ‰ÕÑÑ½¸±…ÍÌô‰ÅÕ•ÍÐµ±…¥´µ‰Ñ¸ˆœ¬(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€…‘½¹”ñð±…¥µ•(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ˆ‘¥Í…‰±•ˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤¬(€€€€€€€€€€€€€€€€€€€€€€€€€€€€œ½¹±¥¬ôˆœ­±…¥µ¹9…µ”¬œ¡pœœ­ÅÕ•ÍÐ¹¥¬pœ¤ˆøœ¬(€€€€€€€€€€€€€€€€€€€€€€€€€€€‰ÕÑÑ½¹Q•áÐ¬(€€€€€€€€€€€€€€€€€€€€€€€€œð½‰ÕÑÑ½¸øœ¬(€€€€€€€€€€€€€€€€€€€€œð½‘¥Øøœ¬((€€€€€€€€€€€€€€€€œð½Í•Ñ¥½¸øœì((€€€€€€€ô(€€€€¤ì(((€€€¡Ñµ°¬ô(€€€€€€€€ˆð½‘¥Øøˆì((€€€É•ÑÕÉ¸¡Ñµ°ì()ô(()™Õ¹Ñ¥½¸É•¹‘•É…¥±åEÕ•ÍÑ1¥ÍÑ½¹Ñ•¹Ð ¥ì((€€€É•ÑÕÉ¸É•¹‘•ÉEÕ•ÍÑ1¥ÍÑ•¹•É¥Œ (€€€€€€€‘…¥±åEÕ•ÍÑ•™¥¹¥Ñ¥½¹Ì°(€€€€€€€‘…¥±åEÕ•ÍÑMÑ…Ñ”°(€€€€€€€€‰±…¥µ…¥±åEÕ•ÍÐˆ(€€€€¤ì()ô(()™Õ¹Ñ¥½¸É•¹‘•É½µµ¥ÍÍ¥½¹EÕ•ÍÑ1¥ÍÑ½¹Ñ•¹Ð ¥ì((€€€É•ÑÕÉ¸É•¹‘•ÉEÕ•ÍÑ1¥ÍÑ•¹•É¥Œ (€€€€€€€½µµ¥ÍÍ¥½¹EÕ•ÍÑ•™¥¹¥Ñ¥½¹Ì°(€€€€€€€½µµ¥ÍÍ¥½¹EÕ•ÍÑMÑ…Ñ”°(€€€€€€€€‰±…¥µ½µµ¥ÍÍ¥½¹EÕ•ÍÐˆ(€€€€¤ì()ô()™Õ¹Ñ¥½¸•Ñ±…¥µ…‰±•EÕ•ÍÑ%‘Ì¡‘•™¥¹¥Ñ¥½¹Ì±ÍÑ…Ñ”¥ì(€€€É•ÑÕÉ¸€¡‘•™¥¹¥Ñ¥½¹Íññmt¤¹™¥±Ñ•È¡™Õ¹Ñ¥½¸¡ÅÕ•ÍÐ¥ì(€€€€€€€É•ÑÕÉ¸ÅÕ•ÍÐ€˜˜€…ÍÑ…Ñ”¹±…¥µ•‘mÅÕ•ÍÐ¹¥‘t€˜˜(€€€€€€€€€€€€¡9Õµ‰•È¡ÍÑ…Ñ”¹ÁÉ½É•ÍÍmÅÕ•ÍÐ¹¥‘t¥ñðÀ¤øõ5…Ñ ¹µ…à Ä±9Õµ‰•È¡ÅÕ•ÍÐ¹½…°¥ñðÄ¤ì(€€€ô¤¹µ…À¡™Õ¹Ñ¥½¸¡ÅÕ•ÍÐ¥ìÉ•ÑÕÉ¸ÅÕ•ÍÐ¹¥ìô¤ì)ô()™Õ¹Ñ¥½¸ØÄÜÌØÅMå¹EÕ•ÍÑ±…¥µ±±	ÕÑÑ½¸¡¥Í½µµ¥ÍÍ¥½¸¥ì(€€€½¹ÍÐ‰ÕÑÑ½¸ô ‰ÅÕ•ÍÑ±…¥µ±±	ÕÑÑ½¸ˆ¤ì(€€€¥˜ …‰ÕÑÑ½¸¥ìÉ•ÑÕÉ¸ìô(€€€½¹ÍÐ‘•™¥¹¥Ñ¥½¹Ìõ¥Í½µµ¥ÍÍ¥½¸ý½µµ¥ÍÍ¥½¹EÕ•ÍÑ•™¥¹¥Ñ¥½¹Ìé‘…¥±åEÕ•ÍÑ•™¥¹¥Ñ¥½¹Ìì(€€€½¹ÍÐÍÑ…Ñ”õ¥Í½µµ¥ÍÍ¥½¸ý½µµ¥ÍÍ¥½¹EÕ•ÍÑMÑ…Ñ”é‘…¥±åEÕ•ÍÑMÑ…Ñ”ì(€€€½¹ÍÐ½Õ¹Ðõ•Ñ±…¥µ…‰±•EÕ•ÍÑ%‘Ì¡‘•™¥¹¥Ñ¥½¹Ì±ÍÑ…Ñ”¤¹±•¹Ñ ì(€€€‰ÕÑÑ½¸¹‘¥Í…‰±•õ½Õ¹ÐðôÀì(€€€‰ÕÑÑ½¸¹Ñ•áÑ½¹Ñ•¹Ðõ½Õ¹ÐøÀü‹’â¦6×¦‚c–>[¾ò ˆ­½Õ¹Ð¬‹¾ò$ˆè‹’â¦6×¦‚c–>Xˆì(€€€‰ÕÑÑ½¸¹½¹±¥¬õ¥Í½µµ¥ÍÍ¥½¸ýØÄÜÌØÅ±…¥µ±±½µµ¥ÍÍ¥½¹EÕ•ÍÑÌéØÄÜÌØÅ±…¥µ±±…¥±åEÕ•ÍÑÌì)ô()™Õ¹Ñ¥½¸ØÄÜÌØÅI•™É•Í¡=Á•¹EÕ•ÍÑA…” ¥ì(€€€½¹ÍÐ‰½‘äô ‰ÅÕ•ÍÑQ…‰	½‘äˆ¤ì(€€€¥˜ …‰½‘ä¥ìÉ•ÑÕÉ¸™…±Í”ìô(€€€½¹ÍÐ½µµ¥ÍÍ¥½¹	Ñ¸ô ‰ÅÕ•ÍÑQ…‰	Ñ¹½µµ¥ÍÍ¥½¸ˆ¤ì(€€€½¹ÍÐ¥Í½µµ¥ÍÍ¥½¸ô„„¡½µµ¥ÍÍ¥½¹	Ñ¸˜™½µµ¥ÍÍ¥½¹	Ñ¸¹±…ÍÍ1¥ÍÐ¹½¹Ñ…¥¹Ì ‰…Ñ¥Ù”ˆ¤¤ì(€€€½¹ÍÐÍÉ½±±Q½Àõ‰½‘ä¹ÍÉ½±±Q½Àì(€€€‰½‘ä¹¥¹¹•É!Q50õ¥Í½µµ¥ÍÍ¥½¸ýÉ•¹‘•É½µµ¥ÍÍ¥½¹EÕ•ÍÑ1¥ÍÑ½¹Ñ•¹Ð ¤éÉ•¹‘•É…¥±åEÕ•ÍÑ1¥ÍÑ½¹Ñ•¹Ð ¤ì(€€€½¹ÍÐ½µÁ±•Ñ¥½¹A…¹•°ô ‰ÅÕ•ÍÑ½µÁ±•Ñ¥½¹A…¹•°ˆ¤ì(€€€¥˜¡½µÁ±•Ñ¥½¹A…¹•°¥ì(€€€€€€€½µÁ±•Ñ¥½¹A…¹•°¹¥¹¹•É!Q50õÉ•¹‘•ÉEÕ•ÍÑ½µÁ±•Ñ¥½¹A…¹•±½¹Ñ•¹Ð (€€€€€€€€€€€¥Í½µµ¥ÍÍ¥½¸ý½µµ¥ÍÍ¥½¹EÕ•ÍÑ•™¥¹¥Ñ¥½¹Ìé‘…¥±åEÕ•ÍÑ•™¥¹¥Ñ¥½¹Ì°(€€€€€€€€€€€¥Í½µµ¥ÍÍ¥½¸ý½µµ¥ÍÍ¥½¹EÕ•ÍÑMÑ…Ñ”é‘…¥±åEÕ•ÍÑMÑ…Ñ”(€€€€€€€€¤ì(€€€ô(€€€‰½‘ä¹ÍÉ½±±Q½ÀõÍÉ½±±Q½Àì(€€€ØÄÜÌØÅMå¹EÕ•ÍÑ±…¥µ±±	ÕÑÑ½¸¡¥Í½µµ¥ÍÍ¥½¸¤ì(€€€É•ÑÕÉ¸ÑÉÕ”ì)ô)Ý¥¹‘½Ü¹ØÄÜÌØÅI•™É•Í¡=Á•¹EÕ•ÍÑA…”õØÄÜÌØÅI•™É•Í¡=Á•¹EÕ•ÍÑA…”ì((((¼¨(€€Xàç¾òk’îï–.g¢š[žª_ž
ëŽ3–në–ºkš¢gžÆ“–"\€¬ƒ–Ÿ–Æ“’îï–.gšâ–Z¸€¬ƒ–në–ºk–º3š"C–ê›ž6;–.×Ž7šzÛšž/Ž(€€€ÅÕ•ÍÑQ…‰	½‘äƒšb¿’îï–.g–R¿’â ÍÉ½±°½Ý¹•Ë¾òoš¢g¦†3¢"–§–/š¢gžÆ“’â7¢Þ¢F_š6ËŽ(¨¼)™Õ¹Ñ¥½¸É•¹‘•ÉEÕ•ÍÑQ…‰½¹Ñ•¹Ð¡…Ñ¥Ù•Q…ˆ¥ì((€€€½¹ÍÐ¥Í½µµ¥ÍÍ¥½¸ô(€€€€€€€…Ñ¥Ù•Q…ˆôôô‰½µµ¥ÍÍ¥½¸ˆì((€€€É•ÑÕÉ¸€ (€€€€€€€€œñ‘¥Ø±…ÍÌô‰ÅÕ•ÍÐµ¥¹Ñ•É™…”ˆøœ¬((€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰ÅÕ•ÍÐµÑ…‰ÌˆÉ½±”ô‰Ñ…‰±¥ÍÐˆ…É¥„µ±…‰•°ô‹’îï–.g–"¦†xˆøœ¬((€€€€€€€€€€€€€€€€œñ‰ÕÑÑ½¸¥ô‰ÅÕ•ÍÑQ…‰	Ñ¹…¥±äˆ±…ÍÌô‰ÅÕ•ÍÐµÑ…ˆœ¬(€€€€€€€€€€€€€€€€€€€€ …¥Í½µµ¥ÍÍ¥½¸€ü€ˆ…Ñ¥Ù”ˆ€è€ˆˆ¤¬œˆœ¬(€€€€€€€€€€€€€€€€€€€€œÉ½±”ô‰Ñ…ˆˆ…É¥„µÍ•±•Ñ•ôˆœ¬ …¥Í½µµ¥ÍÍ¥½¸€ü€‰ÑÉÕ”ˆ€è€‰™…±Í”ˆ¤¬œˆœ¬(€€€€€€€€€€€€€€€€€€€€œ½¹±¥¬ô‰ÍÝ¥Ñ¡EÕ•ÍÑQ…ˆ¡p‘…¥±åpœ¤ˆøœ¬(€€€€€€€€€€€€€€€€€€€€‹š¾?š^—’îï–.dˆ¬(€€€€€€€€€€€€€€€€œð½‰ÕÑÑ½¸øœ¬((€€€€€€€€€€€€€€€€œñ‰ÕÑÑ½¸¥ô‰ÅÕ•ÍÑQ…‰	Ñ¹½µµ¥ÍÍ¥½¸ˆ±…ÍÌô‰ÅÕ•ÍÐµÑ…ˆœ¬(€€€€€€€€€€€€€€€€€€€€¡¥Í½µµ¥ÍÍ¥½¸€ü€ˆ…Ñ¥Ù”ˆ€è€ˆˆ¤¬œˆœ¬(€€€€€€€€€€€€€€€€€€€€œÉ½±”ô‰Ñ…ˆˆ…É¥„µÍ•±•Ñ•ôˆœ¬¡¥Í½µµ¥ÍÍ¥½¸€ü€‰ÑÉÕ”ˆ€è€‰™…±Í”ˆ¤¬œˆœ¬(€€€€€€€€€€€€€€€€€€€€œ½¹±¥¬ô‰ÍÝ¥Ñ¡EÕ•ÍÑQ…ˆ¡p½µµ¥ÍÍ¥½¹pœ¤ˆøœ¬(€€€€€€€€€€€€€€€€€€€€‹–žS¢¢_’îï–.dˆ¬(€€€€€€€€€€€€€€€€œð½‰ÕÑÑ½¸øœ¬((€€€€€€€€€€€€œð½‘¥Øøœ¬((€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰ÅÕ•ÍÐµ‰…Ñ µ…Ñ¥½¹Ìˆøœ¬(€€€€€€€€€€€€€€€€œñ‰ÕÑÑ½¸¥ô‰ÅÕ•ÍÑ±…¥µ±±	ÕÑÑ½¸ˆ±…ÍÌô‰ÅÕ•ÍÐµ±…¥´µ…±°µ‰Ñ¸ˆÑåÁ”ô‰‰ÕÑÑ½¸ˆ€œ¬(€€€€€€€€€€€€€€€€€€€€¡•Ñ±…¥µ…‰±•EÕ•ÍÑ%‘Ì (€€€€€€€€€€€€€€€€€€€€€€€¥Í½µµ¥ÍÍ¥½¸ý½µµ¥ÍÍ¥½¹EÕ•ÍÑ•™¥¹¥Ñ¥½¹Ìé‘…¥±åEÕ•ÍÑ•™¥¹¥Ñ¥½¹Ì°(€€€€€€€€€€€€€€€€€€€€€€€¥Í½µµ¥ÍÍ¥½¸ý½µµ¥ÍÍ¥½¹EÕ•ÍÑMÑ…Ñ”é‘…¥±åEÕ•ÍÑMÑ…Ñ”(€€€€€€€€€€€€€€€€€€€€¤¹±•¹Ñ üœœè‘¥Í…‰±•€œ¤¬(€€€€€€€€€€€€€€€€€€€€½¹±¥¬ôˆœ¬¡¥Í½µµ¥ÍÍ¥½¸üØÄÜÌØÅ±…¥µ±±½µµ¥ÍÍ¥½¹EÕ•ÍÑÌ ¤œèØÄÜÌØÅ±…¥µ±±…¥±åEÕ•ÍÑÌ ¤œ¤¬œˆû’â¦6×¦‚c–>Xð½‰ÕÑÑ½¸øœ¬(€€€€€€€€€€€€œð½‘¥Øøœ¬((€€€€€€€€€€€€œñ‘¥Ø¥ô‰ÅÕ•ÍÑQ…‰	½‘äˆ±…ÍÌô‰ÅÕ•ÍÐµÑ…ˆµ‰½‘äˆÉ½±”ô‰Ñ…‰Á…¹•°ˆøœ¬(€€€€€€€€€€€€€€€€ (€€€€€€€€€€€€€€€€€€€¥Í½µµ¥ÍÍ¥½¸(€€€€€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€€€€€É•¹‘•É½µµ¥ÍÍ¥½¹EÕ•ÍÑ1¥ÍÑ½¹Ñ•¹Ð ¤(€€€€€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€€€€€É•¹‘•É…¥±åEÕ•ÍÑ1¥ÍÑ½¹Ñ•¹Ð ¤(€€€€€€€€€€€€€€€€¤¬(€€€€€€€€€€€€œð½‘¥Øøœ¬((€€€€€€€€€€€€œñ‘¥Ø¥ô‰ÅÕ•ÍÑ½µÁ±•Ñ¥½¹A…¹•°ˆ±…ÍÌô‰ÅÕ•ÍÐµ½µÁ±•Ñ¥½¸µÁ…¹•°ˆøœ¬(€€€€€€€€€€€€€€€É•¹‘•ÉEÕ•ÍÑ½µÁ±•Ñ¥½¹A…¹•±½¹Ñ•¹Ð (€€€€€€€€€€€€€€€€€€€¥Í½µµ¥ÍÍ¥½¸(€€€€€€€€€€€€€€€€€€€€ü½µµ¥ÍÍ¥½¹EÕ•ÍÑ•™¥¹¥Ñ¥½¹Ì(€€€€€€€€€€€€€€€€€€€€è‘…¥±åEÕ•ÍÑ•™¥¹¥Ñ¥½¹Ì°(€€€€€€€€€€€€€€€€€€€¥Í½µµ¥ÍÍ¥½¸(€€€€€€€€€€€€€€€€€€€€ü½µµ¥ÍÍ¥½¹EÕ•ÍÑMÑ…Ñ”(€€€€€€€€€€€€€€€€€€€€è‘…¥±åEÕ•ÍÑMÑ…Ñ”(€€€€€€€€€€€€€€€€¤¬(€€€€€€€€€€€€œð½‘¥Øøœ¬((€€€€€€€€œð½‘¥Øøœ(€€€€¤ì()ô(()™Õ¹Ñ¥½¸ÍÝ¥Ñ¡EÕ•ÍÑQ…ˆ¡Ñ…‰9…µ”¥ì((€€€½¹ÍÐ½¹Ñ…¥¹•Èô(€€€€€€€€ ‰ÅÕ•ÍÑQ…‰	½‘äˆ¤ì((€€€¥˜ …½¹Ñ…¥¹•È¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô((€€€½¹ÍÐ¥Í½µµ¥ÍÍ¥½¸ô(€€€€€€€Ñ…‰9…µ”ôôô‰½µµ¥ÍÍ¥½¸ˆì((€€€½¹Ñ…¥¹•È¹¥¹¹•É!Q50ô(€€€€€€€¥Í½µµ¥ÍÍ¥½¸(€€€€€€€€ü(€€€€€€€É•¹‘•É½µµ¥ÍÍ¥½¹EÕ•ÍÑ1¥ÍÑ½¹Ñ•¹Ð ¤(€€€€€€€€è(€€€€€€€É•¹‘•É…¥±åEÕ•ÍÑ1¥ÍÑ½¹Ñ•¹Ð ¤ì((€€€½¹Ñ…¥¹•È¹ÍÉ½±±Q½Àô(€€€€€€€€Àì((€€€½¹ÍÐ½µÁ±•Ñ¥½¹A…¹•°ô(€€€€€€€€ ‰ÅÕ•ÍÑ½µÁ±•Ñ¥½¹A…¹•°ˆ¤ì((€€€¥˜¡½µÁ±•Ñ¥½¹A…¹•°¥ì((€€€€€€€½µÁ±•Ñ¥½¹A…¹•°¹¥¹¹•É!Q50ô(€€€€€€€€€€€É•¹‘•ÉEÕ•ÍÑ½µÁ±•Ñ¥½¹A…¹•±½¹Ñ•¹Ð (€€€€€€€€€€€€€€€¥Í½µµ¥ÍÍ¥½¸(€€€€€€€€€€€€€€€€ü½µµ¥ÍÍ¥½¹EÕ•ÍÑ•™¥¹¥Ñ¥½¹Ì(€€€€€€€€€€€€€€€€è‘…¥±åEÕ•ÍÑ•™¥¹¥Ñ¥½¹Ì°(€€€€€€€€€€€€€€€¥Í½µµ¥ÍÍ¥½¸(€€€€€€€€€€€€€€€€ü½µµ¥ÍÍ¥½¹EÕ•ÍÑMÑ…Ñ”(€€€€€€€€€€€€€€€€è‘…¥±åEÕ•ÍÑMÑ…Ñ”(€€€€€€€€€€€€¤ì((€€€ô((€€€½¹ÍÐ‘…¥±å	Ñ¸ô(€€€€€€€€ ‰ÅÕ•ÍÑQ…‰	Ñ¹…¥±äˆ¤ì((€€€½¹ÍÐ½µµ¥ÍÍ¥½¹	Ñ¸ô(€€€€€€€€ ‰ÅÕ•ÍÑQ…‰	Ñ¹½µµ¥ÍÍ¥½¸ˆ¤ì((€€€¥˜¡‘…¥±å	Ñ¸¥ì(€€€€€€€‘…¥±å	Ñ¸¹±…ÍÍ1¥ÍÐ¹Ñ½±” (€€€€€€€€€€€€‰…Ñ¥Ù”ˆ°(€€€€€€€€€€€€…¥Í½µµ¥ÍÍ¥½¸(€€€€€€€€¤ì(€€€€€€€‘…¥±å	Ñ¸¹Í•ÑÑÑÉ¥‰ÕÑ” (€€€€€€€€€€€€‰…É¥„µÍ•±•Ñ•ˆ°(€€€€€€€€€€€€…¥Í½µµ¥ÍÍ¥½¸€ü€‰ÑÉÕ”ˆ€è€‰™…±Í”ˆ(€€€€€€€€¤ì(€€€ô((€€€¥˜¡½µµ¥ÍÍ¥½¹	Ñ¸¥ì(€€€€€€€½µµ¥ÍÍ¥½¹	Ñ¸¹±…ÍÍ1¥ÍÐ¹Ñ½±” (€€€€€€€€€€€€‰…Ñ¥Ù”ˆ°(€€€€€€€€€€€¥Í½µµ¥ÍÍ¥½¸(€€€€€€€€¤ì(€€€€€€€½µµ¥ÍÍ¥½¹	Ñ¸¹Í•ÑÑÑÉ¥‰ÕÑ” (€€€€€€€€€€€€‰…É¥„µÍ•±•Ñ•ˆ°(€€€€€€€€€€€¥Í½µµ¥ÍÍ¥½¸€ü€‰ÑÉÕ”ˆ€è€‰™…±Í”ˆ(€€€€€€€€¤ì(€€€ô((€€€ØÄÜÌØÅMå¹EÕ•ÍÑ±…¥µ±±	ÕÑÑ½¸¡¥Í½µµ¥ÍÍ¥½¸¤ì()ô(((¼¨(€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3šZÃ–Š{–&¿šr°½	=ML(€€ƒ–§–/–Â;¢š÷–"_¦‚žn»¾ò3–B¢¨Ë–/–"¦‚¾ò'¾òh(€€ƒžn»–&7–>«–#–k–ëŽ3–"¦‚–"š>oŽ7¦g––_¦ª£šzÛ¢Þ|(€€ƒ¢ª«šb;šZ–¶_¾ò3–¾›¦jožj–&¿šr°½	=MOš"Ã¦²—¢š?–&(€€ƒ¾ò#š«ž&§–òß–ê›Žž6;–.×Žš¾?–’§¢÷š2Gš"Ã–æûš²‡Ž(€€ƒ¢Þž>ûšr'žÞÓ–*–6žj–Þ»žVÃšb¿’î¦êó¾ò'¦÷¦
šÊK–ºkš†#¾ò0(€€ƒž¶'’öÿžR£¢š>C’úo¢š?–&–ú3–7–¾›¦još:—’â+š"Ã¦²”(€€ƒ¦
?¢ò¿ŠSŠS¦g¢Ž‡–#žŠë’þw–"–"¦‚žj’î/¦v‹šb¼(€€ƒ¦kžj¾ò3’æ/–ú3¢šš>o–Ÿ–ºç–>«¦r¢ššRä(€€É•¹‘•Ë–÷–ò?¾ò3’â7žR£–.U!Q53žÖCšž/Ž(¨¼()™Õ¹Ñ¥½¸É•¹‘•ÉÕ¹•½¹Q…‰½¹Ñ•¹Ð¡Ñ…‰9…µ”¥ì((€€€¥˜¡Ñ…‰9…µ”ôôô‰…‰åÍÌˆ¥ì((€€€€€€€É•ÑÕÉ¸€ ((€€€€€€€€€€€€œñ‘¥ØÍÑå±”ô‰™½¹ÐµÍ¥é”èÄÍÁàí±¥¹”µ¡•¥¡ÐèÄ¸àí½±½ÈèˆÍ„ÔáŒìˆøœ¬(€€€€€€€€€€€€‹šÞÇšÞ×–&¿šr³–Âkšr«¢¢·¢¢#–º3š"CŽˆ¬(€€€€€€€€€€€€ˆð½‘¥Øøˆ((€€€€€€€€¤ì((€€€ô(((€€€É•ÑÕÉ¸€ ((€€€€€€€€œñ‘¥ØÍÑå±”ô‰™½¹ÐµÍ¥é”èÄÍÁàí±¥¹”µ¡•¥¡ÐèÄ¸àí½±½ÈèˆÍ„ÔáŒìˆøœ¬(€€€€€€€€‹š^—–âã–&¿šr³–Âkšr«¢¢·¢¢#–º3š"CŽˆ¬(€€€€€€€€ˆð½‘¥Øøˆ((€€€€¤ì()ô(()™Õ¹Ñ¥½¸ÍÝ¥Ñ¡Õ¹•½¹Q…ˆ¡Ñ…‰9…µ”¥ì((€€€½¹ÍÐ½¹Ñ…¥¹•Èô(€€€€€€€€ ‰‘Õ¹•½¹Q…‰½¹Ñ•¹Ðˆ¤ì(((€€€¥˜ …½¹Ñ…¥¹•È¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€½¹Ñ…¥¹•È¹¥¹¹•É!Q50ô((€€€€€€€É•¹‘•ÉÕ¹•½¹Q…‰½¹Ñ•¹Ð (€€€€€€€€€€€Ñ…‰9…µ”(€€€€€€€€¤ì(((€€€l‰…¥±äˆ°‰‰åÍÌ‰t¹™½É…  (€€€€€€€¹…µ”ôùì((€€€€€€€€€€€½¹ÍÐ‰Ñ¸ô(€€€€€€€€€€€€€€€€ ‰‘Õ¹•½¹Q…‰	Ñ¸ˆ­¹…µ”¤ì(((€€€€€€€€€€€¥˜¡‰Ñ¸¥ì((€€€€€€€€€€€€€€€‰Ñ¸¹ÍÑå±”¹½Á…¥Ñäô((€€€€€€€€€€€€€€€€€€€¹…µ”¹Ñ½1½Ý•É…Í” ¤ôôô(€€€€€€€€€€€€€€€€€€€Ñ…‰9…µ”(€€€€€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€€€€€€ˆÄˆ(€€€€€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€€€€€€ˆ¸ÔÔˆì((€€€€€€€€€€€ô((€€€€€€€ô(€€€€¤ì()ô(()™Õ¹Ñ¥½¸É•¹‘•É	½ÍÍQ…‰½¹Ñ•¹Ð¡Ñ…‰9…µ”¥ì((€€€¥˜¡Ñ…‰9…µ”ôôô‰¡•±°ˆ¥ì((€€€€€€€É•ÑÕÉ¸€ ((€€€€€€€€€€€€œñ‘¥ØÍÑå±”ô‰™½¹ÐµÍ¥é”èÄÍÁàí±¥¹”µ¡•¥¡ÐèÄ¸àí½±½ÈèˆÍ„ÔáŒìˆøœ¬(€€€€€€€€€€€€‹–rÃž6	=MO–Âkšr«¢¢·¢¢#–º3š"CŽˆ¬(€€€€€€€€€€€€ˆð½‘¥Øøˆ((€€€€€€€€¤ì((€€€ô(((€€€É•ÑÕÉ¸€ ((€€€€€€€€œñ‘¥ØÍÑå±”ô‰™½¹ÐµÍ¥é”èÄÍÁàí±¥¹”µ¡•¥¡ÐèÄ¸àí½±½ÈèˆÍ„ÔáŒìˆøœ¬(€€€€€€€€‹–/’êé	=MO–Âkšr«¢¢·¢¢#–º3š"CŽˆ¬(€€€€€€€€ˆð½‘¥Øøˆ((€€€€¤ì()ô(()™Õ¹Ñ¥½¸ÍÝ¥Ñ¡	½ÍÍQ…ˆ¡Ñ…‰9…µ”¥ì((€€€½¹ÍÐ½¹Ñ…¥¹•Èô(€€€€€€€€ ‰‰½ÍÍQ…‰½¹Ñ•¹Ðˆ¤ì(((€€€¥˜ …½¹Ñ…¥¹•È¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€½¹Ñ…¥¹•È¹¥¹¹•É!Q50ô((€€€€€€€É•¹‘•É	½ÍÍQ…‰½¹Ñ•¹Ð (€€€€€€€€€€€Ñ…‰9…µ”(€€€€€€€€¤ì(((€€€l‰A•ÉÍ½¹…°ˆ°‰!•±°‰t¹™½É…  (€€€€€€€¹…µ”ôùì((€€€€€€€€€€€½¹ÍÐ‰Ñ¸ô(€€€€€€€€€€€€€€€€ ‰‰½ÍÍQ…‰	Ñ¸ˆ­¹…µ”¤ì(((€€€€€€€€€€€¥˜¡‰Ñ¸¥ì((€€€€€€€€€€€€€€€‰Ñ¸¹ÍÑå±”¹½Á…¥Ñäô((€€€€€€€€€€€€€€€€€€€¹…µ”¹Ñ½1½Ý•É…Í” ¤ôôô(€€€€€€€€€€€€€€€€€€€Ñ…‰9…µ”(€€€€€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€€€€€€ˆÄˆ(€€€€€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€€€€€€ˆ¸ÔÔˆì((€€€€€€€€€€€ô((€€€€€€€ô(€€€€¤ì()ô(((()™Õ¹Ñ¥½¸±…¥µ…¥±åEÕ•ÍÐ¡ÅÕ•ÍÑ%¥ì((€€€½¹ÍÐÅÕ•ÍÐô((€€€€€€€‘…¥±åEÕ•ÍÑ•™¥¹¥Ñ¥½¹Ì¹™¥¹ (€€€€€€€€€€€ÄôùÄ¹¥ôôõÅÕ•ÍÑ%(€€€€€€€€¤ì(((€€€¥˜ …ÅÕ•ÍÐ¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€½¹ÍÐÁÉ½É•ÍÌô((€€€€€€€‘…¥±åEÕ•ÍÑMÑ…Ñ”¹ÁÉ½É•ÍÍl(€€€€€€€€€€€ÅÕ•ÍÑ%(€€€€€€€uñðÀì(((€€€¥˜ (€€€€€€€ÁÉ½É•ÍÌñÅÕ•ÍÐ¹½…°ñð(€€€€€€€‘…¥±åEÕ•ÍÑMÑ…Ñ”¹±…¥µ•‘mÅÕ•ÍÑ%‘t(€€€€¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€‘…¥±åEÕ•ÍÑMÑ…Ñ”¹±…¥µ•‘mÅÕ•ÍÑ%‘tô(€€€€€€€ÑÉÕ”ì(((€€€¥˜¡ÅÕ•ÍÐ¹É•Ý…É¹½±¥ì((€€€€€€€½±ô(€€€€€€€€€€€½±¬(€€€€€€€€€€€ÅÕ•ÍÐ¹É•Ý…É¹½±ì((€€€ô(((€€€¥˜¡ÅÕ•ÍÐ¹É•Ý…É¹•áÀ¥ì((€€€€€€€Í¡…É•‘áÀô(€€€€€€€€€€€Í¡…É•‘áÀ¬(€€€€€€€€€€€ÅÕ•ÍÐ¹É•Ý…É¹•áÀì((€€€ô(((€€€ÕÁ‘…Ñ•½±‘¥ÍÁ±…ä ¤ì((€€€ÕÁ‘…Ñ•U$ ¤ì((€€€Í…Ù•…µ” ¤ì(((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾òkšRçš"C–>«¦7žæ¨ÅÕ•ÍÑQ…‰	½‘ä(€€€€€€ƒ¦g–/–ºç–f£¾ò#žÚ·š2–r£Ž3š¾?š^—’îï–.gŽ7–"¦‚¾ò'¾ò0(€€€€€€ƒ’â7–7šVÓ–/¢š[žª_¦7’úŠSŠQÉ•¹‘•ÉEÕ•ÍÑ½¹Ñ•¹Ð ¤(€€€€€€ƒ¦g–/¢"+–÷–ò?–ÞËžÚOš.š"C–§–/–"¦‚–B¢«žj(€€€€€€ƒšâËš~O–÷–ò?¾ò3’â7–¶c–r£’êŽ(€€€€¨¼(€€€¥˜ …Ý¥¹‘½Ü¹}}ØÄÜÌØÅ	Õ±­EÕ•ÍÑ±…¥´¥ìÍÝ¥Ñ¡EÕ•ÍÑQ…ˆ ‰‘…¥±äˆ¤ìô()ô(()™Õ¹Ñ¥½¸±…¥µ½µµ¥ÍÍ¥½¹EÕ•ÍÐ¡ÅÕ•ÍÑ%¥ì((€€€½¹ÍÐÅÕ•ÍÐô((€€€€€€€½µµ¥ÍÍ¥½¹EÕ•ÍÑ•™¥¹¥Ñ¥½¹Ì¹™¥¹ (€€€€€€€€€€€ÄôùÄ¹¥ôôõÅÕ•ÍÑ%(€€€€€€€€¤ì(((€€€¥˜ …ÅÕ•ÍÐ¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€½¹ÍÐÁÉ½É•ÍÌô((€€€€€€€½µµ¥ÍÍ¥½¹EÕ•ÍÑMÑ…Ñ”¹ÁÉ½É•ÍÍl(€€€€€€€€€€€ÅÕ•ÍÑ%(€€€€€€€uñðÀì(((€€€¥˜ (€€€€€€€ÁÉ½É•ÍÌñÅÕ•ÍÐ¹½…°ñð(€€€€€€€½µµ¥ÍÍ¥½¹EÕ•ÍÑMÑ…Ñ”¹±…¥µ•‘mÅÕ•ÍÑ%‘t(€€€€¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€½µµ¥ÍÍ¥½¹EÕ•ÍÑMÑ…Ñ”¹±…¥µ•‘mÅÕ•ÍÑ%‘tô(€€€€€€€ÑÉÕ”ì(((€€€¥˜¡ÅÕ•ÍÐ¹É•Ý…É¹½±¥ì((€€€€€€€½±ô(€€€€€€€€€€€½±¬(€€€€€€€€€€€ÅÕ•ÍÐ¹É•Ý…É¹½±ì((€€€ô(((€€€¥˜¡ÅÕ•ÍÐ¹É•Ý…É¹•áÀ¥ì((€€€€€€€Í¡…É•‘áÀô(€€€€€€€€€€€Í¡…É•‘áÀ¬(€€€€€€€€€€€ÅÕ•ÍÐ¹É•Ý…É¹•áÀì((€€€ô(((€€€ÕÁ‘…Ñ•½±‘¥ÍÁ±…ä ¤ì((€€€ÕÁ‘…Ñ•U$ ¤ì((€€€Í…Ù•…µ” ¤ì(€€€¥˜ …Ý¥¹‘½Ü¹}}ØÄÜÌØÅ	Õ±­EÕ•ÍÑ±…¥´¥ìÍÝ¥Ñ¡EÕ•ÍÑQ…ˆ ‰½µµ¥ÍÍ¥½¸ˆ¤ìô()ô(()™Õ¹Ñ¥½¸ØÄÜÌØÅ±…¥µ±±EÕ•ÍÑÉ½ÕÀ¡‘•™¥¹¥Ñ¥½¹Ì±ÍÑ…Ñ”±±…¥µ¸±Ñ¥Ñ±”¥ì(€€€½¹ÍÐ¥‘Ìõ•Ñ±…¥µ…‰±•EÕ•ÍÑ%‘Ì¡‘•™¥¹¥Ñ¥½¹Ì±ÍÑ…Ñ”¤ì(€€€¥˜ …¥‘Ì¹±•¹Ñ ¥ìØÄÜÌØÅI•™É•Í¡=Á•¹EÕ•ÍÑA…” ¤ìÉ•ÑÕÉ¸€Àìô(€€€Ý¥¹‘½Ü¹}}ØÄÜÌØÅ	Õ±­EÕ•ÍÑ±…¥´õÑÉÕ”ì(€€€ÑÉåì¥‘Ì¹™½É… ¡™Õ¹Ñ¥½¸¡¥¥ì±…¥µ¸¡¥¤ìô¤ìô(€€€™¥¹…±±åìÝ¥¹‘½Ü¹}}ØÄÜÌØÅ	Õ±­EÕ•ÍÑ±…¥´õ™…±Í”ìô(€€€ØÄÜÌØÅI•™É•Í¡=Á•¹EÕ•ÍÑA…” ¤ì(€€€¥˜¡ÑåÁ•½˜Ý¥¹‘½Ü¹ÉÁ±•ÉÐôôô‰™Õ¹Ñ¥½¸ˆ¥ì(€€€€€€€Ù½¥Ý¥¹‘½Ü¹ÉÁ±•ÉÐ ‹–ÞË’â¦6×¦‚c–>X€ˆ­¥‘Ì¹±•¹Ñ ¬ˆƒ–,ˆ­Ñ¥Ñ±”¬‹ž6;–.×Žˆ±íÑ¥Ñ±”éÑ¥Ñ±”¬‹ž6;–.Ôˆ±½¹™¥ÉµQ•áÐè‹ž~—¦O’êˆ±Ñ½¹”è‰ÍÕ•ÍÌ‰ô¤ì(€€€ô(€€€É•ÑÕÉ¸¥‘Ì¹±•¹Ñ ì)ô)™Õ¹Ñ¥½¸ØÄÜÌØÅ±…¥µ±±…¥±åEÕ•ÍÑÌ ¥ì(€€€É•ÑÕÉ¸ØÄÜÌØÅ±…¥µ±±EÕ•ÍÑÉ½ÕÀ¡‘…¥±åEÕ•ÍÑ•™¥¹¥Ñ¥½¹Ì±‘…¥±åEÕ•ÍÑMÑ…Ñ”±±…¥µ…¥±åEÕ•ÍÐ°‹š¾?š^—’îï–.dˆ¤ì)ô)™Õ¹Ñ¥½¸ØÄÜÌØÅ±…¥µ±±½µµ¥ÍÍ¥½¹EÕ•ÍÑÌ ¥ì(€€€É•ÑÕÉ¸ØÄÜÌØÅ±…¥µ±±EÕ•ÍÑÉ½ÕÀ¡½µµ¥ÍÍ¥½¹EÕ•ÍÑ•™¥¹¥Ñ¥½¹Ì±½µµ¥ÍÍ¥½¹EÕ•ÍÑMÑ…Ñ”±±…¥µ½µµ¥ÍÍ¥½¹EÕ•ÍÐ°‹–žS¢¢_’îï–.dˆ¤ì)ô)Ý¥¹‘½Ü¹ØÄÜÌØÅ±…¥µ±±…¥±åEÕ•ÍÑÌõØÄÜÌØÅ±…¥µ±±…¥±åEÕ•ÍÑÌì)Ý¥¹‘½Ü¹ØÄÜÌØÅ±…¥µ±±½µµ¥ÍÍ¥½¹EÕ•ÍÑÌõØÄÜÌØÅ±…¥µ±±½µµ¥ÍÍ¥½¹EÕ•ÍÑÌì((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€ƒŠbƒ–r[¦FD(ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼()™Õ¹Ñ¥½¸É•¹‘•É	•ÍÑ¥…Éå½¹Ñ•¹Ð ¥ì((€€€½¹ÍÐ…±±i½¹•ÉÉ…åÌõl(€€€€€€€™½É•ÍÑ5½¹ÍÑ•ÉÌ°(€€€€€€€‘•Í•ÉÑ5½¹ÍÑ•ÉÌ°(€€€€€€€¥•5½Õ¹Ñ…¥¹5½¹ÍÑ•ÉÌ°(€€€€€€€é½¹”Ñ5½¹ÍÑ•ÉÌ°(€€€€€€€é½¹”Õ5½¹ÍÑ•ÉÌ°(€€€€€€€é½¹”Ù5½¹ÍÑ•ÉÌ°(€€€€€€€é½¹”Ý5½¹ÍÑ•ÉÌ°(€€€€€€€é½¹”á5½¹ÍÑ•ÉÌ(€€€tì(((€€€½¹ÍÐÍ••¹9…µ•Ìô(€€€€€€€¹•ÜM•Ð ¤ì(((€€€±•Ð¡Ñµ°ô(€€€€€€€€ˆˆì(((€€€…±±i½¹•ÉÉ…åÌ¹™½É…  (€€€€€€€é½¹•ÉÉ…äôùì((€€€€€€€€€€€é½¹•ÉÉ…ä¹™½É…  (€€€€€€€€€€€€€€€µ½¹ÍÑ•Èôùì((€€€€€€€€€€€€€€€€€€€¥˜ (€€€€€€€€€€€€€€€€€€€€€€€Í••¹9…µ•Ì¹¡…Ì (€€€€€€€€€€€€€€€€€€€€€€€€€€€µ½¹ÍÑ•È¹¹…µ”(€€€€€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€¥ì(€€€€€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€€€€€€€€€€€€€ô(((€€€€€€€€€€€€€€€€€€€Í••¹9…µ•Ì¹…‘ (€€€€€€€€€€€€€€€€€€€€€€€µ½¹ÍÑ•È¹¹…µ”(€€€€€€€€€€€€€€€€€€€€¤ì(((€€€€€€€€€€€€€€€€€€€½¹ÍÐ•¹ÑÉäô((€€€€€€€€€€€€€€€€€€€€€€€‰•ÍÑ¥…Éå…Ñ…l(€€€€€€€€€€€€€€€€€€€€€€€€€€€µ½¹ÍÑ•È¹¹…µ”(€€€€€€€€€€€€€€€€€€€€€€€tì(((€€€€€€€€€€€€€€€€€€€½¹ÍÐ•±•µ•¹Ðô((€€€€€€€€€€€€€€€€€€€€€€€•±•µ•¹Ñ…Ñ…‰…Í•l(€€€€€€€€€€€€€€€€€€€€€€€€€€€µ½¹ÍÑ•È¹•±•µ•¹Ð(€€€€€€€€€€€€€€€€€€€€€€€t(€€€€€€€€€€€€€€€€€€€€€€€ñð(€€€€€€€€€€€€€€€€€€€€€€€•±•µ•¹Ñ…Ñ…‰…Í”¹™¥É”ì(((€€€€€€€€€€€€€€€€€€€¡Ñµ°¬ô((€€€€€€€€€€€€€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰¡½µ”µ™•…ÑÕÉ”µÉ½Üˆøœ¬((€€€€€€€€€€€€€€€€€€€€€€€€ˆñÍÁ…¸øˆ¬((€€€€€€€€€€€€€€€€€€€€€€€€ (€€€€€€€€€€€€€€€€€€€€€€€€€€€•¹ÑÉä€˜˜•¹ÑÉä¹Í••¸(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€€€€€€€€€€€€€•Ñ±•µ•¹Ñ%½¹!Q50 (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€µ½¹ÍÑ•È¹•±•µ•¹Ð(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤¬(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ˆˆ­µ½¹ÍÑ•È¹¹…µ”(€€€€€€€€€€€€€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€‹¾ò¾ò¾ò|ˆ(€€€€€€€€€€€€€€€€€€€€€€€€¤¬((€€€€€€€€€€€€€€€€€€€€€€€€ˆð½ÍÁ…¸øˆ¬((€€€€€€€€€€€€€€€€€€€€€€€€ˆñÍÁ…¸øˆ¬((€€€€€€€€€€€€€€€€€€€€€€€€ (€€€€€€€€€€€€€€€€€€€€€€€€€€€•¹ÑÉä€˜˜•¹ÑÉä¹Í••¸(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€€€€€€€€€€€€€€‹šN+šºèˆ¬¡•¹ÑÉä¹­¥±±ÍñðÀ¤(€€€€€€€€€€€€€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€‹šr«¦¢š,ˆ(€€€€€€€€€€€€€€€€€€€€€€€€¤¬((€€€€€€€€€€€€€€€€€€€€€€€€ˆð½ÍÁ…¸øˆ¬((€€€€€€€€€€€€€€€€€€€€€€€€ˆð½‘¥Øøˆì((€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€¤ì((€€€€€€€ô(€€€€¤ì(((€€€É•ÑÕÉ¸¡Ñµ°ì()ô(((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€ƒŠbƒš"C–ÂÄ(ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼()™Õ¹Ñ¥½¸É•¹‘•É¡¥•Ù•µ•¹Ñ½¹Ñ•¹Ð ¥ì((€€€±•Ð¡Ñµ°ô(€€€€€€€€ˆˆì(((€€€…¡¥•Ù•µ•¹Ñ•™¥¹¥Ñ¥½¹Ì¹™½É…  (€€€€€€€…¡¥•Ù•µ•¹Ðôùì((€€€€€€€€€€€½¹ÍÐ‘½¹”ô((€€€€€€€€€€€€€€€…¡¥•Ù•µ•¹Ð¹¡•¬ ¤ì(((€€€€€€€€€€€½¹ÍÐ±…¥µ•ô((€€€€€€€€€€€€€€€…¡¥•Ù•µ•¹ÑMÑ…Ñ•l(€€€€€€€€€€€€€€€€€€€…¡¥•Ù•µ•¹Ð¹¥(€€€€€€€€€€€€€€€tì(((€€€€€€€€€€€½¹ÍÐÉ•Ý…É‘Q•áÐô((€€€€€€€€€€€€€€€=‰©•Ð¹­•åÌ (€€€€€€€€€€€€€€€€€€€…¡¥•Ù•µ•¹Ð¹É•Ý…É(€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€¹µ…À (€€€€€€€€€€€€€€€€€€€­•äôø(€€€€€€€€€€€€€€€€€€€€€€€…¡¥•Ù•µ•¹Ð¹É•Ý…É‘m­•åt¬ˆˆ(€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€¹©½¥¸ ‹Žˆ¤ì(((€€€€€€€€€€€¡Ñµ°¬ô((€€€€€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰¡½µ”µ™•…ÑÕÉ”µÉ½Üˆøœ¬((€€€€€€€€€€€€€€€€ˆñÍÁ…¸øˆ¬(€€€€€€€€€€€€€€€…¡¥•Ù•µ•¹Ð¹¹…µ”¬(€€€€€€€€€€€€€€€€ˆñ‰Èøˆ¬(€€€€€€€€€€€€€€€€œñÍÁ…¸ÍÑå±”ô‰™½¹ÐµÍ¥é”èÄÅÁàí½±½ÈèˆÍ„ÔáŒìˆøœ¬(€€€€€€€€€€€€€€€…¡¥•Ù•µ•¹Ð¹‘•ÍŒ¬(€€€€€€€€€€€€€€€€‹ž6;–.×¾òhˆ­É•Ý…É‘Q•áÐ¬(€€€€€€€€€€€€€€€€ˆð½ÍÁ…¸øˆ¬(€€€€€€€€€€€€€€€€ˆð½ÍÁ…¸øˆ¬((€€€€€€€€€€€€€€€€œñ‰ÕÑÑ½¸±…ÍÌô‰¡½µ”µ™•…ÑÕÉ”µ‰Õäµ‰Ñ¸ˆœ¬((€€€€€€€€€€€€€€€€ (€€€€€€€€€€€€€€€€€€€€…‘½¹”ñð±…¥µ•(€€€€€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€€€€€€‰‘¥Í…‰±•ˆ(€€€€€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€€€€€¤¬((€€€€€€€€€€€€€€€€½¹±¥¬ô‰±…¥µ¡¥•Ù•µ•¹Ð¡pœœ¬(€€€€€€€€€€€€€€€…¡¥•Ù•µ•¹Ð¹¥¬(€€€€€€€€€€€€€€€€pœ¤ˆøœ¬((€€€€€€€€€€€€€€€€ (€€€€€€€€€€€€€€€€€€€±…¥µ•(€€€€€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€€€€€€‹–ÞË¦‚c–>Xˆ(€€€€€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€€€€€‘½¹”(€€€€€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€€€€€€‹¦‚c–>Xˆ(€€€€€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€€€€€€‹šr«¦Sš"@ˆ(€€€€€€€€€€€€€€€€¤¬((€€€€€€€€€€€€€€€€ˆð½‰ÕÑÑ½¸øˆ¬((€€€€€€€€€€€€€€€€ˆð½‘¥Øøˆì((€€€€€€€ô(€€€€¤ì(((€€€É•ÑÕÉ¸¡Ñµ°ì()ô(()™Õ¹Ñ¥½¸±…¥µ¡¥•Ù•µ•¹Ð¡…¡¥•Ù•µ•¹Ñ%¥ì((€€€½¹ÍÐ…¡¥•Ù•µ•¹Ðô((€€€€€€€…¡¥•Ù•µ•¹Ñ•™¥¹¥Ñ¥½¹Ì¹™¥¹ (€€€€€€€€€€€„ôù„¹¥ôôõ…¡¥•Ù•µ•¹Ñ%(€€€€€€€€¤ì(((€€€¥˜ ……¡¥•Ù•µ•¹Ð¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€¥˜ (€€€€€€€€……¡¥•Ù•µ•¹Ð¹¡•¬ ¤ñð(€€€€€€€…¡¥•Ù•µ•¹ÑMÑ…Ñ•m…¡¥•Ù•µ•¹Ñ%‘t(€€€€¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€…¡¥•Ù•µ•¹ÑMÑ…Ñ•m…¡¥•Ù•µ•¹Ñ%‘tô(€€€€€€€ÑÉÕ”ì(((€€€¥˜¡…¡¥•Ù•µ•¹Ð¹É•Ý…É¹½±¥ì((€€€€€€€½±ô(€€€€€€€€€€€½±¬(€€€€€€€€€€€…¡¥•Ù•µ•¹Ð¹É•Ý…É¹½±ì((€€€ô((€€€ÕÁ‘…Ñ•½±‘¥ÍÁ±…ä ¤ì((€€€Í…Ù•…µ” ¤ì(((€€€½¹ÍÐ‰½‘å°ô(€€€€€€€€ ‰¡½µ••…ÑÕÉ•5½‘…±	½‘äˆ¤ì(((€€€¥˜¡‰½‘å°¥ì((€€€€€€€‰½‘å°¹¥¹¹•É!Q50ô(€€€€€€€€€€€É•¹‘•É¡¥•Ù•µ•¹Ñ½¹Ñ•¹Ð ¤ì((€€€ô()ô(((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€ƒŠbƒ–³–F((ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼()™Õ¹Ñ¥½¸É•¹‘•É¹¹½Õ¹•µ•¹Ñ½¹Ñ•¹Ð ¥ì((€€€½¹ÍÐÉ•±•…Í•UÁ‘…Ñ”ô(€€€€€€€Ý¥¹‘½Ü¹½ÕÉMåµ‰½±ÍI•±•…Í•UÁ‘…Ñ”ì((€€€¥˜ (€€€€€€€É•±•…Í•UÁ‘…Ñ”˜˜(€€€€€€€ÑåÁ•½˜É•±•…Í•UÁ‘…Ñ”¹É•¹‘•É¹¹½Õ¹•µ•¹Ñ½¹Ñ•¹Ðôôô‰™Õ¹Ñ¥½¸ˆ(€€€€¥ì(€€€€€€€½¹ÍÐÉ•±•…Í•½¹Ñ•¹Ðô(€€€€€€€€€€€É•±•…Í•UÁ‘…Ñ”¹É•¹‘•É¹¹½Õ¹•µ•¹Ñ½¹Ñ•¹Ð ¤ì((€€€€€€€¥˜¡É•±•…Í•½¹Ñ•¹Ð¥ì(€€€€€€€€€€€É•ÑÕÉ¸É•±•…Í•½¹Ñ•¹Ðì(€€€€€€€ô(€€€ô((€€€É•ÑÕÉ¸€ ((€€€€€€€€œñ‘¥ØÍÑå±”ô‰™½¹ÐµÍ¥é”èÄÍÁàí±¥¹”µ¡•¥¡ÐèÄ¸àìˆøœ¬((€€€€€€€€‹’âï–~;–£šZÃšRçž&#¾òñ‰Èøˆ¬(€€€€€€€€‹šZÃ–Š{–V–ê_Ž–r[¦FGŽš¾?š^—’îï–.gŽš"C–ÂÇžÎïžÖÇ¾ò0ˆ¬(€€€€€€€€‹š¶‡¢þ;š‹š‹¦o¦oŽñ‰Èøñ‰Èøˆ¬((€€€€€€€€‹¦Z/žfó’â·–*¢÷¾òhñ‰Èøˆ¬(€€€€€€€€‹šnÓ–’k¢Žw–
gŽšnÓ–’k–rÃ–6ŽšnÓ–’kš*¢÷¾ò0ˆ¬(€€€€€€€€‹¦fãžê3šnÓšZÃ’â·Žˆ¬((€€€€€€€€ˆð½‘¥Øøˆ((€€€€¤ì()ô(()™Õ¹Ñ¥½¸É•¹‘•ÉMåÍÑ•µ½¹Ñ•¹Ð ¥ì((€€€É•ÑÕÉ¸€ (€€€€€€€€œñ‘¥Ø±…ÍÌô‰ÍåÍÑ•´µÁ…¹•°ˆøœ¬(€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰ÍåÍÑ•´µÁ…¹•°µÉ½Üˆøœ¬(€€€€€€€€€€€€€€€€œñ‘¥ØøñÍÑÉ½¹œû¦+š"Ë–¶cšªPð½ÍÑÉ½¹œøñÍµ…±°ûžn»–&7¦+š"Ëšr¢«–.W–¶cšªS¾ò3’æ–>¿’î—ž®/–6Ïš&/–.W’þw–¶cŽð½Íµ…±°øð½‘¥Øøœ¬(€€€€€€€€€€€€€€€€œñ‰ÕÑÑ½¸±…ÍÌô‰¡½µ”µ™•…ÑÕÉ”µ‰Õäµ‰Ñ¸ˆ½¹±¥¬ô‰Í…Ù•…µ” ¤í…±•ÉÐ¡pŸ–ÞË–º3š"Cš&/–.W–¶cšªSŽ	pœ¤ˆûž®/–6Ï–¶cšªPð½‰ÕÑÑ½¸øœ¬(€€€€€€€€€€€€œð½‘¥Øøœ¬(€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰ÍåÍÑ•´µÁ…¹•°µÉ½Üˆøœ¬(€€€€€€€€€€€€€€€€œñ‘¥ØøñÍÑÉ½¹œû–âÏ¢fžº‡žBð½ÍÑÉ½¹œøñÍµ…±°ûš~—žr/žn»–&4¥É•‰…Í”U%Žžfï–ëš"[–"š>o–âÏ¢fŽð½Íµ…±°øð½‘¥Øøœ¬(€€€€€€€€€€€€€€€€œñ‰ÕÑÑ½¸±…ÍÌô‰¡½µ”µ™•…ÑÕÉ”µ‰Õäµ‰Ñ¸ˆ½¹±¥¬ô‰Ý¥¹‘½Ü¹½ÕÉMåµ‰½±ÍMÑ…ÉÑÕÁA½±¥ä˜™Ý¥¹‘½Ü¹½ÕÉMåµ‰½±ÍMÑ…ÉÑÕÁA½±¥ä¹½Á•¹½Õ¹Ñ5…¹…•È ¤ˆû–"š>o–âÏ¢f¾ò?žÚ–ºk–âÏ¢f|ð½‰ÕÑÑ½¸øœ¬(€€€€€€€€€€€€œð½‘¥Øøœ¬(€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰ÍåÍÑ•´µÁ…¹•°µÉ½Üˆøœ¬(€€€€€€€€€€€€€€€€œñ‘¥ØøñÍÑÉ½¹œû–º‹šr7’þ‡žºÄð½ÍÑÉ½¹œøñÍµ…±°ûš~—žr/Ž+–no¢Æ‡šÆšæ[–
ÏŽ/–º‹šr7¢¿žÖ‡šZç–ò?Žð½Íµ…±°øð½‘¥Øøœ¬(€€€€€€€€€€€€€€€€œñ‰ÕÑÑ½¸¥ô‰ÍåÍÑ•µMÕÁÁ½ÉÑµ…¥±	ÕÑÑ½¸ˆ±…ÍÌô‰¡½µ”µ™•…ÑÕÉ”µ‰Õäµ‰Ñ¸ˆ½¹±¥¬ô‰Ý¥¹‘½Ü¹½ÕÉMåµ‰½±ÍMÕÁÁ½ÉÐ¹Í¡½Ü ¤ˆûš~—žr/’þ‡žºÄð½‰ÕÑÑ½¸øœ¬(€€€€€€€€€€€€œð½‘¥Øøœ¬(€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰ÍåÍÑ•´µÁ…¹•°µÉ½Ü‘…¹•Èˆøœ¬(€€€€€€€€€€€€€€€€œñ‘¥ØøñÍÑÉ½¹œû–"«¦f“¢žK¢&Èð½ÍÑÉ½¹œøñÍµ…±°û–"«¦f“–£¦£¢žK¢&Ë¢"¦+š"Ë¦Ë–ê›¾ò3¢þS–n{–"w–ž/–&×¢žK¦‚¦v‹Žð½Íµ…±°øð½‘¥Øøœ¬(€€€€€€€€€€€€€€€€œñ‰ÕÑÑ½¸±…ÍÌô‰¡½µ”µ™•…ÑÕÉ”µ‰Õäµ‰Ñ¸ˆ½¹±¥¬ô‰É•Í•Ñ…µ” ¤ˆû–"«¦f“¢žK¢&Èð½‰ÕÑÑ½¸øœ¬(€€€€€€€€€€€€œð½‘¥Øøœ¬(€€€€€€€€œð½‘¥Øøœ(€€€€¤ì()ô(()™Õ¹Ñ¥½¸É•ÍÑÑ!½µ” ¥ì((€€€¥˜¡‰…ÑÑ±•Ñ¥Ù”¥ì((€€€€€€€…±•ÉÐ (€€€€€€€€€€€€‹š"Ã¦²—’â·ž‡šÎW’òGš¿Žˆ(€€€€€€€€¤ì((€€€€€€€É•ÑÕÉ¸ì((€€€ô(((€€€½¹ÍÐ¹••‘ÍI•ÍÐõ•Ñá¥ÍÑ¥¹A…ÉÑå%¹‘•á•Ì ¤¹Í½µ”¡¥¹‘•àôùì(€€€€€€€½¹ÍÐ¡…É…Ñ•Èõ•ÑA…ÉÑå¡…É…Ñ•É	å%¹‘•à¡¥¹‘•à¤ì(€€€€€€€½¹ÍÐÍÑ…ÑÌõ•ÑA…ÉÑå	…ÑÑ±•MÑ…ÑÌ¡¥¹‘•à¤ì(€€€€€€€É•ÑÕÉ¸¡…É…Ñ•È¹¡ÀñÍÑ…ÑÌ¹µ…á!@ñð¡…É…Ñ•È¹ÍÀñÍÑ…ÑÌ¹µ…áM@ì(€€€ô¤ì((€€€¥˜ …¹••‘ÍI•ÍÐ¥ì((€€€€€€€…±•ÉÐ (€€€€€€€€€€€€‰!CŽM@ƒ–ÞËžÚOšb¿šîÿžj’êŽˆ(€€€€€€€€¤ì((€€€€€€€É•ÑÕÉ¸ì((€€€ô(((€€€•Ñá¥ÍÑ¥¹A…ÉÑå%¹‘•á•Ì ¤¹™½É… ¡¥¹‘•àôùì(€€€€€€€½¹ÍÐ¡…É…Ñ•Èõ•ÑA…ÉÑå¡…É…Ñ•É	å%¹‘•à¡¥¹‘•à¤ì(€€€€€€€½¹ÍÐÍÑ…ÑÌõ•ÑA…ÉÑå	…ÑÑ±•MÑ…ÑÌ¡¥¹‘•à¤ì(€€€€€€€¡…É…Ñ•È¹¡ÀõÍÑ…ÑÌ¹µ…á!@ì(€€€€€€€¡…É…Ñ•È¹ÍÀõÍÑ…ÑÌ¹µ…áM@ì(€€€ô¤ì(((€€€ÕÁ‘…Ñ•U$ ¤ì((€€€Í…Ù•…µ” ¤ì(((€€€…±•ÉÐ (€€€€€€€€‹’òGš¿–º3žV‹¾ò1!C¾ò=M@ƒ–ÞËžÚO–£¦£¢ŽsšîÿŽˆ(€€€€¤ì()ô(((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€XäÈƒŠPƒ’âï–~;¦Z/žfóšâ³¢¦›–þ¯š6ß¦6Ô(ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼()™Õ¹Ñ¥½¸É…¹ÑQ•ÍÑ½±‘5¥±±¥½¸ ¥ì(€€€½±ô(€€€€€€€5…Ñ ¹µ…à À±5…Ñ ¹™±½½È¡9Õµ‰•È¡½±¥ñðÀ¤¤¬(€€€€€€€QMQ}=1}I9Pì((€€€ÕÁ‘…Ñ•½±‘¥ÍÁ±…ä ¤ì(€€€ÕÁ‘…Ñ•U$ ¤ì(€€€Í…Ù•…µ” ¤ì((€€€…±•ÉÐ (€€€€€€€€‹¦G–æŒ€¬Ä°ÀÀÀ°ÀÀÃ¾ò3žn»–&7–Çšr$€ˆ¬(€€€€€€€½±¹Ñ½1½…±•MÑÉ¥¹œ ‰é µQ\ˆ¤¬(€€€€€€€€ˆƒ¦G–æŽˆ(€€€€¤ì)ô()™Õ¹Ñ¥½¸É…¹ÑQ•ÍÑáÁQ•¹5¥±±¥½¸ ¥ì(€€€Í¡…É•‘áÀô(€€€€€€€5…Ñ ¹µ…à À±5…Ñ ¹™±½½È¡9Õµ‰•È¡Í¡…É•‘áÀ¥ñðÀ¤¤¬(€€€€€€€QMQ}aA}A==1}I9Pì((€€€ÕÁ‘…Ñ•U$ ¤ì(€€€Í…Ù•…µ” ¤ì((€€€…±•ÉÐ (€€€€€€€€‹žÚO¦¦_šÆ€€¬Ä°ÀÀÀ°ÀÀÀ°ÀÀÃ¾ò3žn»–&7–Çšr$€ˆ¬(€€€€€€€Í¡…É•‘áÀ¹Ñ½1½…±•MÑÉ¥¹œ ‰é µQ\ˆ¤¬(€€€€€€€€ˆaCŽˆ(€€€€¤ì)ô()™Õ¹Ñ¥½¸ÕÁ‘…Ñ•!½µ•Q•ÍÑQ½½±Ì ¥ì(€€€½¹ÍÐ½±‘	ÕÑÑ½¸ô ‰Ñ•ÍÑ½±‘5¥±±¥½¹	ÕÑÑ½¸ˆ¤ì(€€€½¹ÍÐ•áÁ	ÕÑÑ½¸ô ‰Ñ•ÍÑáÁQ•¹5¥±±¥½¹	ÕÑÑ½¸ˆ¤ì((€€€¥˜¡½±‘	ÕÑÑ½¸¥ì(€€€€€€€½±‘	ÕÑÑ½¸¹¥¹¹•É!Q50ô‹¦G–æŒ€ñˆø¬ÄÀÃ¢B°ð½ˆøˆì(€€€ô((€€€¥˜¡•áÁ	ÕÑÑ½¸¥ì(€€€€€€€•áÁ	ÕÑÑ½¸¹¥¹¹•É!Q50ô‹žÚO¦¦_šÆ€€ñˆø¬ÄÃ–ð½ˆøˆì(€€€ô)ô(((¼¨(€€ƒŠbƒšâ³¢¦›žR£¾òkš*¢÷¦îx€¬ääçŽ((€€ƒžÒSžÊçšZç’úÿ’öƒšâ³¢¦›š*¢÷šV#šzs¾ò#–Â“–Ûšb¿žžK¦gž¢¸(€€ƒ¦r¢š’â¢Þ¿–6žÒkš&7žr/–ú_–ë–Þ»žVÃžjš*¢÷¾ò'¾ò0(€€ƒ’æ/–ú3š¶–ò?ž&#’â+žÞk–&7¢¢c–ú_š*+¦g–ò×–6‡ž&(€€ƒ¢Þ¦g–/–÷–ò?’â¢Ößš.ÿš:'Ž(¨¼()™Õ¹Ñ¥½¸É…¹ÑQ•ÍÑM­¥±±A½¥¹ÑÌ ¥ì((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾òh(€€€€€€ƒ–:šr³¦g¢Ž‡–¾¯š¶ï–>«–*ƒžÖ™Á±…å•Ë¾ò#ž²³’â¢žK¢&Ë¾ò'¾ò0(€€€€€€ƒž²³’ê3¢žK¢&ËšÂã¦ƒšâ³¢¦›’â7–"ÃŽ3žÖ›¦î{šVãŽ7¦g–/š2'¦"W¾ò0(€€€€€€ƒ–ºçšbO¢ºO’êë¢ª“’î—ž
ëž²³’ê3¢žK¢&Ëžjš*¢÷¦î{šb¿–ú{–"—žj–rÃšZä(€€€€€€ƒ¾ò#žRk¢Í‰ÕŸ¾ò'–K–ë’úžjŽ(€€€€€€ƒšRçš"AÁ±…å•ÈË–¶c–r£žj¢¦Ç–§¦
+¦÷–B–*€ääç¾ò0(€€€€€€ƒšâ³¢¦›–N«–/¢žK¢&Ë¦÷šZç’úÿŽ(€€€€¨¼((€€€Á±…å•È¹Í­¥±±A½¥¹ÑÌ¬ôäääì(((€€€±•Ðµ•ÍÍ…”ô((€€€€€€€€‹š*¢÷¦îx€¬ääç¾ò3Ž0ˆ¬(€€€€€€€€¡Á±…å•È¹¥‘ñð‹ž²³’â¢žK¢&Èˆ¤¬(€€€€€€€€‹Ž7žn»–&7–Çšr$ˆ¬(€€€€€€€Á±…å•È¹Í­¥±±A½¥¹ÑÌ¬(€€€€€€€€‹¦î{Žˆì(((€€€¥˜¡Á±…å•ÈÈ¥ì((€€€€€€€Á±…å•ÈÈ¹Í­¥±±A½¥¹ÑÌ¬ôäääì(((€€€€€€€µ•ÍÍ…”¬ô((€€€€€€€€€€€€‰q»Ž0ˆ¬(€€€€€€€€€€€Á±…å•ÈÈ¹¥¬(€€€€€€€€€€€€‹Ž7žn»–&7–Çšr$ˆ¬(€€€€€€€€€€€Á±…å•ÈÈ¹Í­¥±±A½¥¹ÑÌ¬(€€€€€€€€€€€€‹¦î{Žˆì((€€€ô((€€€¥˜¡Á±…å•ÈÌ¥ì((€€€€€€€Á±…å•ÈÌ¹Í­¥±±A½¥¹ÑÌ¬ôäääì((€€€€€€€µ•ÍÍ…”¬ô(€€€€€€€€€€€€‰q»Ž0ˆ¬(€€€€€€€€€€€Á±…å•ÈÌ¹¥¬(€€€€€€€€€€€€‹Ž7žn»–&7–Çšr$ˆ¬(€€€€€€€€€€€Á±…å•ÈÌ¹Í­¥±±A½¥¹ÑÌ¬(€€€€€€€€€€€€‹¦î{Žˆì((€€€ô(((€€€ÕÁ‘…Ñ•U$ ¤ì((€€€É•¹‘•ÉM­¥±±1½…‘½ÕÐ ¤ì((€€€Í…Ù•…µ” ¤ì(((€€€…±•ÉÐ (€€€€€€€µ•ÍÍ…”(€€€€¤ì()ô(((¼¨(€€ƒŠbƒšZÃ–Š{¾ò#šâ³¢¦›žR£¾ò'¾òkžÚO¦¦_šÆ€€¬ÄÀÀÀÀÃŽ((€€ƒžÒSžÊçšZç’úÿšâ³¢¦›–6žÒkŽš*¢÷¦Z/šRû¦Zšªï¦g¦†x(€€ƒ¦r¢šžÞÓ–*žÞÓ–ú#’æš&7žr/–ú_–"ÃšV#šzsžjšvÇ¢–ÿ¾ò0(€€ƒžnÓš:—š*+žÚO¦¦_–¶c¦Ë–ÇžR£žÚO¦¦_šÆƒ¾ò0(€€ƒ’æ/–ú3¢š’â7¢š–"žÖ›¢žK¢&Ë¦
šb¿žŸ–:šr³žjšZç–ò<(€€ƒ¢«–ÞÇ–:ï–"¦7Ž’æ/–ú3š¶–ò?ž&#’â+žÞk–&7¢¢c–ú\(€€ƒš*+¦g–/š2'¦"W¢Þ¦g–/–÷–ò?’â¢Ößš.ÿš:'Ž(¨¼()™Õ¹Ñ¥½¸É…¹ÑQ•ÍÑáÀ ¥ì((€€€Í¡…É•‘áÀ¬ôÄÀÀÀÀÀì((€€€ÕÁ‘…Ñ•U$ ¤ì((€€€Í…Ù•…µ” ¤ì(((€€€…±•ÉÐ (€€€€€€€€‹žÚO¦¦_šÆ€€¬ÄÀÀÀÀÃ¾ò3žn»–&7–Çšr$ˆ¬(€€€€€€€Í¡…É•‘áÀ¬(€€€€€€€€‹¦î{žÚO¦¦_–óŽˆ(€€€€¤ì()ô(()™Õ¹Ñ¥½¸‘¥ÍÑÉ¥‰ÕÑ•áÁQ½A±…å•È ¥ì((€€€‘¥ÍÑÉ¥‰ÕÑ•áÁQ½¡…É…Ñ•È (€€€€€€€Á±…å•È(€€€€¤ì()ô(((¼¨(€€ƒŠbƒšZÃ–Š{¾òk–"¦7žÚO¦¦_–óžÖ›ž²³’ê3¢žK¢&ËŽ(€€ƒ¢Þ}‘¥ÍÑÉ¥‰ÕÑ•áÁQ½A±…å•È §šb¿–B3’â––_¦
?¢ò¿¾ò0(€€ƒžnÓš:—–Fó–>¯–ÇžR£–÷–ò?¾ò3–>«šb¿š>o’â–/¢žK¢&Ëž&§’îÛŽ(¨¼()™Õ¹Ñ¥½¸‘¥ÍÑÉ¥‰ÕÑ•áÁQ½A±…å•ÈÈ ¥ì((€€€¥˜ …Á±…å•ÈÈ¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€‘¥ÍÑÉ¥‰ÕÑ•áÁQ½¡…É…Ñ•È (€€€€€€€Á±…å•ÈÈ(€€€€¤ì()ô(()™Õ¹Ñ¥½¸‘¥ÍÑÉ¥‰ÕÑ•áÁQ½A±…å•ÈÌ ¥ì((€€€¥˜ …Á±…å•ÈÌ¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô((€€€‘¥ÍÑÉ¥‰ÕÑ•áÁQ½¡…É…Ñ•È (€€€€€€€Á±…å•ÈÌ(€€€€¤ì()ô(((¼¨(€€ƒš*)‘¥ÍÑÉ¥‰ÕÑ•áÁQ½A±…å•È §–:šr³žj¦
?¢ò¼(€€ƒš*÷š"C¦kžR£–÷–ò?¾ò1Á±…å•È½Á±…å•ÈË–ÇžR£–B3’â––_¾ò0(€€ƒ’â7žR£žÚ·¢¶ß–§’î÷–æû’æ;’âš¢žjž¢/–ò?žŠóŽ(¨¼()™Õ¹Ñ¥½¸‘¥ÍÑÉ¥‰ÕÑ•áÁQ½¡…É…Ñ•È¡¡…É…Ñ•È¥ì((€€€¥˜¡‰…ÑÑ±•Ñ¥Ù”¥ì((€€€€€€€…±•ÉÐ (€€€€€€€€€€€€‹š"Ã¦²—’â·ž‡šÎW–"¦7žÚO¦¦_–óŽˆ(€€€€€€€€¤ì((€€€€€€€É•ÑÕÉ¸ì((€€€ô(((€€€¥˜¡Í¡…É•‘áÀðôÀ¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾òh(€€€€€€ƒ–:šr³šb¿š*+žÚO¦¦_šÆƒŽ3–£¦£Ž7’âš²‡–†{žÖ›¢žK¢&Ë¾ò0(€€€€€€ƒ–>¿¢÷’âš²‡¦žê3–6––÷–æûžÒk¾ò0(€€€€€€ƒ¢3’âSšrš*+žÚO¦¦_šÆƒšâž¦ë¾ò0(€€€€€€ƒ–Â;¢Óž:§–ºÛšÊK¢ú›šÎWš*+–&§’â/žjžÚO¦¦\(€€€€€€ƒžVgžÖ›–Û’î[¢žK¢&ËŽ((€€€€€€ƒšRçš"C¾òkš¾?š2'’âš²‡¾ò3–>«¢ö'žžïŽ3–&o––÷–6’â+’â/’âžÒkŽ4(€€€€€€ƒš&¦r¢šžjžÚO¦¦_–ó¾ò3’âš²‡–>«–6’âžÒkŽ(€€€€€€ƒ–ššzsžÚO¦¦_šÆƒ’â7–’ƒ–6’âžÒk¾ò0(€€€€€€ƒ–ÂÇ’â7¢ö'žžïŽš>Cž’ë¦
–Þ»–’k–ÂG¾ò0(€€€€€€ƒ¦ÿ–7žÚO¦¦_–ó–6‡–r£’â–/’â7’â+’â7’â/žjž.š/Ž((€€€€€€ƒŠbƒšZÃ–Š{¦bË–F¾òh(€€€€€€ƒ–ššzs¢žK¢&Ëžj•áÃ’â7ž~—¦Ož
ë’î¦êó–ÞËžÚO¢Ú¦9•áÁ9•áÐ(€€€€€€ƒ¾ò#žB¢®[’â+’â7¢¦ËžfóžR¾ò3’ö–¶cšªS–>¿¢÷–nƒž
ëš~C’êošN7’öp(€€€€€€ƒžVg’â/’â7’â¢Óžj¢ÎšZg¾ò'¾ò1¹••‘•“šr¢º+š"C¢ÊƒšVãš"XÃ¾ò0(€€€€€€ƒ¦gš¢Ž1Í¡…É•‘áÀñ¹••‘•“Ž7¦g–/–"“šZßšÂã¦ƒšb½™…±Í—¾ò0(€€€€€€ƒž¶'šZóžf÷žf÷–ú{žÚO¦¦_šÆƒ¦
¢Ž‡Ž3–ßŽ7–"Á•áÃ¾ò0(€€€€€€ƒ¦
–>¿¢÷¢ºM¡•­1•Ù•±UÀ §’âš²‡¢ÞG–ú#–’k¢ò«¾ò0(€€€€€€ƒž3–ë¦n‹¢¶sžjš*¢÷¦îx¿–Æ³šŸ¦î{šVã–¶_Ž(€€€€€€ƒ¦g¢Ž‡–#š*)¹••‘•“–’û–r£šr–Â<Ç¾ò0(€€€€€€ƒ–úç–êW¦ÿ–7¦g–/šò?šÒ{Ž(€€€€¨¼((€€€½¹ÍÐ¹••‘•€ô(€€€€€€€5…Ñ ¹µ…à (€€€€€€€€€€€€Ä°(€€€€€€€€€€€¡…É…Ñ•È¹•áÁ9•áÐ´(€€€€€€€€€€€¡…É…Ñ•È¹•áÀ(€€€€€€€€¤ì(((€€€¥˜¡Í¡…É•‘áÀñ¹••‘•¥ì((€€€€€€€…±•ÉÐ (€€€€€€€€€€€€‹žÚO¦¦_šÆƒ’â7¢ÚÏ’î—–6žÒk¾ò3¦
–Þ¸ˆ¬(€€€€€€€€€€€€¡¹••‘•µÍ¡…É•‘áÀ¤¬(€€€€€€€€€€€€‰aCŽˆ(€€€€€€€€¤ì((€€€€€€€É•ÑÕÉ¸ì((€€€ô(((€€€¡…É…Ñ•È¹•áÀ€¬ô(€€€€€€€¹••‘•ì((€€€Í¡…É•‘áÀ€´ô(€€€€€€€¹••‘•ì(((€€€¡•­1•Ù•±UÀ (€€€€€€€¡…É…Ñ•È(€€€€¤ì((€€€ÕÁ‘…Ñ•U$ ¤ì((€€€Í…Ù•…µ” ¤ì()ô(()™Õ¹Ñ¥½¸É•¹‘•ÉáÁ¥ÍÑÉ¥‰ÕÑ•1¥ÍÐ ¥ì((€€€½¹ÍÐ½¹Ñ…¥¹•È€ô(€€€€€€€€ ‰•áÁ¥ÍÑÉ¥‰ÕÑ•1¥ÍÐˆ¤ì(((€€€¥˜ …½¹Ñ…¥¹•È¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€½¹Ñ…¥¹•È¹¥¹¹•É!Q50ôˆˆì(((€€€½¹ÍÐ•±•µ•¹Ð€ô(€€€€€€€•±•µ•¹Ñ…Ñ…‰…Í•l(€€€€€€€€€€€Á±…å•È¹•±•µ•¹Ð(€€€€€€€uñð(€€€€€€€•±•µ•¹Ñ…Ñ…‰…Í”¹™¥É”ì(((€€€½¹ÍÐ¹••‘•€ô(€€€€€€€5…Ñ ¹µ…à (€€€€€€€€€€€€À°(€€€€€€€€€€€Á±…å•È¹•áÁ9•áÐ´(€€€€€€€€€€€Á±…å•È¹•áÀ(€€€€€€€€¤ì(((€€€½¹ÍÐµ…¥¹I½Ü€ô(€€€€€€€‘½Õµ•¹Ð¹É•…Ñ•±•µ•¹Ð (€€€€€€€€€€€€‰‘¥Øˆ(€€€€€€€€¤ì(((€€€µ…¥¹I½Ü¹¥¹¹•É!Q50€ô((€€€€€€€€(€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€€€¥ô‰‘¥ÍÑÉ¥‰ÕÑ•5…¥¹	ÕÑÑ½¸ˆ(€€€€€€€€€€€±…ÍÌô‰•áÀµ‘¥ÍÑÉ¥‰ÕÑ”µ‰ÕÑÑ½¸ˆ(€€€€€€€€ø(€€€€€€€€€€€€ñÍÁ…¸±…ÍÌô‰•áÀµ¡…É…Ñ•Èµ¥½¸ˆø‘í•±•µ•¹Ð¹¥½¹ôð½ÍÁ…¸ø(€€€€€€€€€€€€ñÍÁ…¸±…ÍÌô‰•áÀµ¡…É…Ñ•Èµ½Áäˆø(€€€€€€€€€€€€€€€€ñÍÑÉ½¹œø‘íÁ±…å•È¹¥‘ññ•±•µ•¹Ð¹¡…É…Ñ•Éôð½ÍÑÉ½¹œø(€€€€€€€€€€€€€€€€ñÍµ…±°ù1Ø¸‘íÁ±…å•È¹±•Ù•±ôƒŠH1Ø¸‘íÁ±…å•È¹±•Ù•°¬Åôð½Íµ…±°ø(€€€€€€€€€€€€ð½ÍÁ…¸ø(€€€€€€€€€€€€ñÍÁ…¸±…ÍÌô‰•áÀµ¡…É…Ñ•Èµ½ÍÐˆø(€€€€€€€€€€€€€€€€ñˆø‘í¹••‘•¹Ñ½1½…±•MÑÉ¥¹œ ‰é µQ\ˆ¥ôð½ˆø(€€€€€€€€€€€€€€€€ñÍµ…±°ùa@ð½Íµ…±°ø(€€€€€€€€€€€€ð½ÍÁ…¸ø(€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€€€ì(((€€€½¹Ñ…¥¹•È¹…ÁÁ•¹‘¡¥± (€€€€€€€µ…¥¹I½Ü(€€€€¤ì(((€€€€¼¨(€€€€€€ƒŠbƒ’âš²‡–>«–6’âžÒk¾òh(€€€€€€ƒžÚO¦¦_šÆƒ’â7–’ƒ–6’â/’âžÒkšfžnÓš:—¦:[’ö?š2'¦"W¾ò0(€€€€€€ƒ’â7šr¢ºOž:§–ºÛ¢ª“š2'–ú3š*+žÚO¦¦_šÆƒšâž¦è(€€€€€€ƒ–6ï–6’â7’êžÒkŽ(€€€€¨¼((€€€€ ‰‘¥ÍÑÉ¥‰ÕÑ•5…¥¹	ÕÑÑ½¸ˆ¤(€€€€€€€€¹‘¥Í…‰±•€ô(€€€€€€€Í¡…É•‘áÀñ¹••‘•ñð(€€€€€€€‰…ÑÑ±•Ñ¥Ù”ì(((€€€€ ‰‘¥ÍÑÉ¥‰ÕÑ•5…¥¹	ÕÑÑ½¸ˆ¤(€€€€€€€€¹½¹±¥¬€ô(€€€€€€€‘¥ÍÑÉ¥‰ÕÑ•áÁQ½A±…å•Èì(((€€€€¼¨(€€€€€€ƒŠbƒž²³’ê3¢žK¢&Ëžj–"¦7š2'¦"W¾ò#šZÃ–Š{¾ò'Ž(€€€€€€Á±…å•ÈË–¶c–r£žj¢¦Ç¦†¿ž’ëžrš¶–>¿’î—š2'žjš2'¦"W¾ò0(€€€€€€ƒ¦
?¢ò¿¢Þž²³’â¢žK¢&Ëžjš2'¦"W–º3–£–Â7ž¢ÇŽ(€€€€¨¼((€€€¥˜¡Á±…å•ÈÈ¥ì((€€€€€€€½¹ÍÐÁ±…å•ÈÉI½Üô(€€€€€€€€€€€‘½Õµ•¹Ð¹É•…Ñ•±•µ•¹Ð (€€€€€€€€€€€€€€€€‰‘¥Øˆ(€€€€€€€€€€€€¤ì(((€€€€€€€½¹ÍÐ¹••‘•Èô(€€€€€€€€€€€5…Ñ ¹µ…à (€€€€€€€€€€€€€€€€À°(€€€€€€€€€€€€€€€Á±…å•ÈÈ¹•áÁ9•áÐ´(€€€€€€€€€€€€€€€Á±…å•ÈÈ¹•áÀ(€€€€€€€€€€€€¤ì(((€€€€€€€Á±…å•ÈÉI½Ü¹¥¹¹•É!Q50ô((€€€€€€€€€€€€(€€€€€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€€€€€€€¥ô‰‘¥ÍÑÉ¥‰ÕÑ•A±…å•ÈÉ	ÕÑÑ½¸ˆ(€€€€€€€€€€€€€€€±…ÍÌô‰•áÀµ‘¥ÍÑÉ¥‰ÕÑ”µ‰ÕÑÑ½¸ˆ(€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÌô‰•áÀµ¡…É…Ñ•Èµ¥½¸ˆûŠ^ð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÌô‰•áÀµ¡…É…Ñ•Èµ½Áäˆø(€€€€€€€€€€€€€€€€€€€€ñÍÑÉ½¹œø‘íÁ±…å•ÈÈ¹¥‘ôð½ÍÑÉ½¹œø(€€€€€€€€€€€€€€€€€€€€ñÍµ…±°ù1Ø¸‘íÁ±…å•ÈÈ¹±•Ù•±ôƒŠH1Ø¸‘íÁ±…å•ÈÈ¹±•Ù•°¬Åôð½Íµ…±°ø(€€€€€€€€€€€€€€€€ð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÌô‰•áÀµ¡…É…Ñ•Èµ½ÍÐˆø(€€€€€€€€€€€€€€€€€€€€ñˆø‘í¹••‘•È¹Ñ½1½…±•MÑÉ¥¹œ ‰é µQ\ˆ¥ôð½ˆø(€€€€€€€€€€€€€€€€€€€€ñÍµ…±°ùa@ð½Íµ…±°ø(€€€€€€€€€€€€€€€€ð½ÍÁ…¸ø(€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€ì(((€€€€€€€½¹Ñ…¥¹•È¹…ÁÁ•¹‘¡¥± (€€€€€€€€€€€Á±…å•ÈÉI½Ü(€€€€€€€€¤ì(((€€€€€€€€ ‰‘¥ÍÑÉ¥‰ÕÑ•A±…å•ÈÉ	ÕÑÑ½¸ˆ¤(€€€€€€€€€€€€¹‘¥Í…‰±•ô((€€€€€€€€€€€Í¡…É•‘áÀñ¹••‘•Èñð(€€€€€€€€€€€‰…ÑÑ±•Ñ¥Ù”ì(((€€€€€€€€ ‰‘¥ÍÑÉ¥‰ÕÑ•A±…å•ÈÉ	ÕÑÑ½¸ˆ¤(€€€€€€€€€€€€¹½¹±¥¬ô(€€€€€€€€€€€‘¥ÍÑÉ¥‰ÕÑ•áÁQ½A±…å•ÈÈì((€€€ô(((€€€¥˜¡Á±…å•ÈÌ¥ì((€€€€€€€½¹ÍÐÁ±…å•ÈÍI½Üô(€€€€€€€€€€€‘½Õµ•¹Ð¹É•…Ñ•±•µ•¹Ð (€€€€€€€€€€€€€€€€‰‘¥Øˆ(€€€€€€€€€€€€¤ì((€€€€€€€½¹ÍÐ¹••‘•Ìô(€€€€€€€€€€€5…Ñ ¹µ…à (€€€€€€€€€€€€€€€€À°(€€€€€€€€€€€€€€€Á±…å•ÈÌ¹•áÁ9•áÐ´(€€€€€€€€€€€€€€€Á±…å•ÈÌ¹•áÀ(€€€€€€€€€€€€¤ì((€€€€€€€Á±…å•ÈÍI½Ü¹¥¹¹•É!Q50ô(€€€€€€€€€€€€(€€€€€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€€€€€€€¥ô‰‘¥ÍÑÉ¥‰ÕÑ•A±…å•ÈÍ	ÕÑÑ½¸ˆ(€€€€€€€€€€€€€€€±…ÍÌô‰•áÀµ‘¥ÍÑÉ¥‰ÕÑ”µ‰ÕÑÑ½¸ˆ(€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÌô‰•áÀµ¡…É…Ñ•Èµ¥½¸ˆûŠ^ð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÌô‰•áÀµ¡…É…Ñ•Èµ½Áäˆø(€€€€€€€€€€€€€€€€€€€€ñÍÑÉ½¹œø‘íÁ±…å•ÈÌ¹¥‘ôð½ÍÑÉ½¹œø(€€€€€€€€€€€€€€€€€€€€ñÍµ…±°ù1Ø¸‘íÁ±…å•ÈÌ¹±•Ù•±ôƒŠH1Ø¸‘íÁ±…å•ÈÌ¹±•Ù•°¬Åôð½Íµ…±°ø(€€€€€€€€€€€€€€€€ð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÌô‰•áÀµ¡…É…Ñ•Èµ½ÍÐˆø(€€€€€€€€€€€€€€€€€€€€ñˆø‘í¹••‘•Ì¹Ñ½1½…±•MÑÉ¥¹œ ‰é µQ\ˆ¥ôð½ˆø(€€€€€€€€€€€€€€€€€€€€ñÍµ…±°ùa@ð½Íµ…±°ø(€€€€€€€€€€€€€€€€ð½ÍÁ…¸ø(€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€ì((€€€€€€€½¹Ñ…¥¹•È¹…ÁÁ•¹‘¡¥± (€€€€€€€€€€€Á±…å•ÈÍI½Ü(€€€€€€€€¤ì((€€€€€€€€ ‰‘¥ÍÑÉ¥‰ÕÑ•A±…å•ÈÍ	ÕÑÑ½¸ˆ¤¹‘¥Í…‰±•ô(€€€€€€€€€€€Í¡…É•‘áÀñ¹••‘•Ìñð(€€€€€€€€€€€‰…ÑÑ±•Ñ¥Ù”ì((€€€€€€€€ ‰‘¥ÍÑÉ¥‰ÕÑ•A±…å•ÈÍ	ÕÑÑ½¸ˆ¤¹½¹±¥¬ô(€€€€€€€€€€€‘¥ÍÑÉ¥‰ÕÑ•áÁQ½A±…å•ÈÌì((€€€ô(((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾òh(€€€€€€ƒšÂÓš"Ã–Ž¯¾ò?¦Š£–òOš&/¦g–§–/¦:[–ºk’öS’ö7š2'¦"T(€€€€€€ƒ’úwžŸž:§–ºÛ¢ššÆšVÓ–/š.ÿš:'¾ò3’â7–7¦†¿ž’ë¾ò0(€€€€€€ƒ¦g–§–/žn»–&7šr³’ú–ÂÇšÊKšr'žrš¶žj¢žK¢&Ë¢ÎšZd(€€€€€€ƒ¾ò#¦f“¦v{ž:§–ºÛ–&×–îëž²³’ê3¢žK¢&Ëšf–&o––÷¦ã’ê–B3š¢–žÒƒ¾ò0(€€€€€€ƒ’ö¦
–/ššÎ’â/–¾›¦još:ožjšb½Á±…å•ÈË¾ò0(€€€€€€ƒ’â7šb¿¦g¢Ž‡žjšÂÐ¿¦Š£’öS’ö7ž²›¾ò'¾ò0(€€€€€€ƒžVg¢F_–>«šb¿–’k¦’cžj¢š[¢šë¦ns¢¢+Ž(€€€€¨¼()ô(((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€ƒž.š/–*ƒ¦îx(ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼((¼¨(€€ƒŠbƒž.š/¦‚–"š>o¢žK¢&Ë¾ò#šZÃ–Š{¾ò'Ž(€€ƒ–"š>ožjšf–g¢šš*)Á•¹‘¥¹MÑ…ÑÏšâž¦ë¾ò0(€€ƒ’â7žÛŽ3¦
šÊKžŠë¢ª7žj–*ƒ¦î{Ž7šr¢ª“–âÛ–"Ã–>›’â–/¢žK¢&Ë¢ê¯’â+Ž(¨¼()™Õ¹Ñ¥½¸¡…¹•MÑ…ÑÕÍ¡…É…Ñ•È¡‘¥É•Ñ¥½¸¥ì((€€€½¹ÍÐ¥¹‘•á•Ìõ•Ñá¥ÍÑ¥¹A…ÉÑå%¹‘•á•Ì ¤ì((€€€¥˜¡¥¹‘•á•Ì¹±•¹Ñ ðÈ¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô((€€€½¹ÍÐÕÉÉ•¹ÑA½Í¥Ñ¥½¸õ5…Ñ ¹µ…à (€€€€€€€€À°(€€€€€€€¥¹‘•á•Ì¹¥¹‘•á=˜¡ÍÑ…ÑÕÍ¡…É…Ñ•É%¹‘•à¤(€€€€¤ì((€€€ÍÑ…ÑÕÍ¡…É…Ñ•É%¹‘•àõ¥¹‘•á•Íl(€€€€€€€€¡ÕÉÉ•¹ÑA½Í¥Ñ¥½¸­‘¥É•Ñ¥½¸­¥¹‘•á•Ì¹±•¹Ñ ¤•¥¹‘•á•Ì¹±•¹Ñ (€€€tì(((€€€=‰©•Ð¹­•åÌ (€€€€€€€Á•¹‘¥¹MÑ…ÑÌ(€€€€¤(€€€€¹™½É… ¡ÍÑ…Ðôùì((€€€€€€€Á•¹‘¥¹MÑ…ÑÍmÍÑ…ÑtôÀì((€€€ô¤ì(((€€€ÕÁ‘…Ñ•MÑ…ÑÕÍAÉ•Ù¥•Ü ¤ì()ô(((¼¨(€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3Ž3–*ƒ¦î{¢ššZÃ–Šx(€€ƒ¦Vßš2'–þ¯¦–*ƒ¦î{š¾S¢òžÂ‡–Z»¾ò3¦
šb¿¦ngžº·¦‚·š2'’â’â,(€€€¬ÄÃš¾S¢òžÂ‡–Z»¾ò3–šÏžnÓš:—¦ã’â–/Ž7ŠSŠS¦ã’ê(€€ƒ¦Vßš2'šZçš†#¾ò'¾òh((€€ƒ–ÇžR£žjŽ3¦Vßš2'š2žê3¢žãžfóŽ7–Â?–Þ—–ßŽš2'’â,(€€ƒ¾ò!Ñ½Õ¡ÍÑ…ÉÐ½µ½ÕÍ•‘½Ý»¾ò'–#ž¶$ÔÀÃš¾¯žžH(€€ƒ¾ò#¦ÿ–7š&/šîG¢òW¦î{’æ¢Š¯žVÛš"C¦Vßš2'¾ò'¾ò3š:—¢F\(€€ƒš¾<ÄÈÃš¾¯žžK¢«–.W–Fó–>¯’âš²‡–
Ï¦Ë’úžj–÷–ò?¾ò0(€€ƒžnÓ–"ÃšRû¦Z,¿š&/š2žžï–è¿šîG¢ÖÃž
ëš¶ˆ(€€ƒ¾ò!Ñ½Õ¡•¹½Ñ½Õ¡…¹•°½µ½ÕÍ•ÕÀ¼(€€µ½ÕÍ•±•…Ù—–£¦£¦÷¢ššâš:'¢¢#šf–f£¾ò0(€€ƒ’îï’öW’âž¢»šRû¦Z/š&/š2žjšZç–ò?¦÷’â7¢÷šò?š:—¾ò0(€€ƒ’â7žÛ¢¢#šf–f£šr–6‡’ö?’âžnÓ–*ƒ’â/–:ï¾ò'Ž((€€€ÛžÖ¬¼·š2'¦"W¾ò#šRïšN(¿¦®S¢Î¨¿¢÷¦<¿šfë–*l¼(€€ƒžÊûž–x¿šV?š6ß¾ò'–£¦£–Fó–>¯¦g–/–÷–ò?¾ò3’â7žR (€€ƒš¾?¦†š2'¦"W–B–¾¯’â’î÷¦Vßš2'¦
?¢ò¿Ž(¨¼()™Õ¹Ñ¥½¸…ÑÑ…¡1½¹AÉ•ÍÌ¡•°±™¸¥ì((€€€¥˜ …•°¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€±•Ð¡½±‘Q¥µ•½ÕÐõ¹Õ±°ì((€€€±•ÐÉ•Á•…Ñ%¹Ñ•ÉÙ…°õ¹Õ±°ì(((€€€™Õ¹Ñ¥½¸ÍÑ½À ¥ì((€€€€€€€¥˜¡¡½±‘Q¥µ•½ÕÐ¥ì(€€€€€€€€€€€±•…ÉQ¥µ•½ÕÐ¡¡½±‘Q¥µ•½ÕÐ¤ì(€€€€€€€€€€€¡½±‘Q¥µ•½ÕÐõ¹Õ±°ì(€€€€€€€ô(((€€€€€€€¥˜¡É•Á•…Ñ%¹Ñ•ÉÙ…°¥ì(€€€€€€€€€€€±•…É%¹Ñ•ÉÙ…°¡É•Á•…Ñ%¹Ñ•ÉÙ…°¤ì(€€€€€€€€€€€É•Á•…Ñ%¹Ñ•ÉÙ…°õ¹Õ±°ì(€€€€€€€ô((€€€ô(((€€€™Õ¹Ñ¥½¸ÍÑ…ÉÐ¡”¥ì((€€€€€€€”¹ÁÉ•Ù•¹Ñ•™…Õ±Ð ¤ì((€€€€€€€™¸ ¤ì(((€€€€€€€ÍÑ½À ¤ì(((€€€€€€€¡½±‘Q¥µ•½ÕÐô(€€€€€€€€€€€Í•ÑQ¥µ•½ÕÐ (€€€€€€€€€€€€€€€€ ¤ôùì((€€€€€€€€€€€€€€€€€€€É•Á•…Ñ%¹Ñ•ÉÙ…°ô(€€€€€€€€€€€€€€€€€€€€€€€Í•Ñ%¹Ñ•ÉÙ…° (€€€€€€€€€€€€€€€€€€€€€€€€€€€™¸°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÔÔ(€€€€€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€ô°(€€€€€€€€€€€€€€€€ÈÔÀ(€€€€€€€€€€€€¤ì((€€€ô(((€€€•°¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È (€€€€€€€€‰Ñ½Õ¡ÍÑ…ÉÐˆ°(€€€€€€€ÍÑ…ÉÐ°(€€€€€€€íÁ…ÍÍ¥Ù”é™…±Í•ô(€€€€¤ì((€€€•°¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È (€€€€€€€€‰µ½ÕÍ•‘½Ý¸ˆ°(€€€€€€€ÍÑ…ÉÐ(€€€€¤ì(((€€€l(€€€€€€€€‰Ñ½Õ¡•¹ˆ°(€€€€€€€€‰Ñ½Õ¡…¹•°ˆ°(€€€€€€€€‰µ½ÕÍ•ÕÀˆ°(€€€€€€€€‰µ½ÕÍ•±•…Ù”ˆ(€€€t¹™½É… ¡•ÙÑ9…µ”ôùì((€€€€€€€•°¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È (€€€€€€€€€€€•ÙÑ9…µ”°(€€€€€€€€€€€ÍÑ½À(€€€€€€€€¤ì((€€€ô¤ì()ô(()™Õ¹Ñ¥½¸…‘‘A½¥¹Ð¡ÍÑ…Ð¥ì((€€€¥˜ (€€€€€€€€…=‰©•Ð¹ÁÉ½Ñ½ÑåÁ”¹¡…Í=Ý¹AÉ½Á•ÉÑä¹…±° (€€€€€€€€€€€Á•¹‘¥¹MÑ…ÑÌ°(€€€€€€€€€€€ÍÑ…Ð(€€€€€€€€¤(€€€€¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€½¹ÍÐÑ…É•Ñ¡…É…Ñ•Èô(€€€€€€€•ÑMÑ…ÑÕÍ¡…É…Ñ•É=‰©•Ð ¤ì(((€€€½¹ÍÐÕÍ•€ô(€€€€€€€=‰©•Ð¹Ù…±Õ•Ì (€€€€€€€€€€€Á•¹‘¥¹MÑ…ÑÌ(€€€€€€€€¤(€€€€€€€€¹É•‘Õ” (€€€€€€€€€€€€¡ÍÕ´±Ù…±Õ”¤ôø(€€€€€€€€€€€€€€€ÍÕ´­Ù…±Õ”°(€€€€€€€€€€€€À(€€€€€€€€¤ì(((€€€¥˜ (€€€€€€€ÕÍ•øô(€€€€€€€Ñ…É•Ñ¡…É…Ñ•È¹…ÑÑÉ¥‰ÕÑ•A½¥¹ÑÌ(€€€€¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€Á•¹‘¥¹MÑ…ÑÍmÍÑ…Ñt¬¬ì(((€€€ÕÁ‘…Ñ•MÑ…ÑÕÍAÉ•Ù¥•Ü ¤ì()ô(((¼¨(€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢š2š¶¾ò'¾òh(€€ƒ’æ/–&7¦g¢Ž‡–>«šr%…‘‘A½¥¹Ð §¾ò3–º3–£šÊKšr'–Â7š'žj(€€ƒšâo¢f–÷–ò?¾ò3–Â;¢Óž.š/¦‚¦v‹–"¦7–6žÒk¦î{šVãžj–rÃšZä(€€ƒ–>«¢÷–*ƒŽ’â7¢÷š&¾ò3¢Þ–&×¢žK¦‚¦v‹¾ò#šr³’ú–ÂÇšr$(€€ƒ–*ƒšâo–§¦†š2'¦"W¾ò'’â7’â¢ÓŽ(€€ƒ¢Žs’â)É•µ½Ù•A½¥¹Ð §¾ò3–>«¢÷š&š:'Ž3¦gš²‡¦
šÊH(€€ƒžŠë¢ª7Žšj¯–¶c’â·Ž7žj¦î{šVã¾ò3’â7šr–.W–"Ã¢žK¢&È(€€ƒ–ÞËžÚOžRšV#žj–Æ³šŸ–ó¾ò3¦
?¢ò¿’â+¢Þ–&×¢žK¦‚¦v‹žj(€€É•…Ñ¥½¹‘¡ÍÑ…Ð°´Ä§šb¿–B3’âž¢»–kšÎWŽ(¨¼()™Õ¹Ñ¥½¸É•µ½Ù•A½¥¹Ð¡ÍÑ…Ð¥ì((€€€¥˜ (€€€€€€€€…=‰©•Ð¹ÁÉ½Ñ½ÑåÁ”¹¡…Í=Ý¹AÉ½Á•ÉÑä¹…±° (€€€€€€€€€€€Á•¹‘¥¹MÑ…ÑÌ°(€€€€€€€€€€€ÍÑ…Ð(€€€€€€€€¤(€€€€¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€¥˜ (€€€€€€€Á•¹‘¥¹MÑ…ÑÍmÍÑ…ÑtðôÀ(€€€€¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€Á•¹‘¥¹MÑ…ÑÍmÍÑ…Ñt´´ì(((€€€ÕÁ‘…Ñ•MÑ…ÑÕÍAÉ•Ù¥•Ü ¤ì()ô(()™Õ¹Ñ¥½¸ÕÁ‘…Ñ•MÑ…ÑÕÍAÉ•Ù¥•Ü ¥ì((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾òh(€€€€€€ƒ–:šr³¦gšVÓ–/–÷–ò?¦÷–¾¯š¶ï¢ª5Á±…å•Ë¾ò0(€€€€€€ƒž²³’ê3¢žK¢&ËšÊK¢ú›šÎWžR£ž.š/¦‚–*ƒ¦î{Ž(€€€€€€ƒšRçš"C–#š*OŽ3žn»–&7¦ã’â·žj¢žK¢&ËŽ4(€€€€€€ƒ¾ò!Á±…å•Ëš"YÁ±…å•ÈË¾ò'¾ò0(€€€€€€ƒ’â/¦v‹š&šr'¢¢#žº_¦÷–Â7¦g–/¢žK¢&Ë–k¾ò0(€€€€€€ƒ’â7žR£šVÓ–/–÷–ò?¦7–¾¯–§’î÷Ž(€€€€¨¼((€€€½¹ÍÐÑ…É•Ñ¡…É…Ñ•Èô(€€€€€€€•ÑMÑ…ÑÕÍ¡…É…Ñ•É=‰©•Ð ¤ì(((€€€½¹ÍÐÕÉÉ•¹Ð€ôì((€€€€€€€…ÑÑ…¬è(€€€€€€€€€€€Ñ…É•Ñ¡…É…Ñ•È¹…ÑÑ…¬¬(€€€€€€€€€€€Á•¹‘¥¹MÑ…ÑÌ¹…ÑÑ…¬°((€€€€€€€Ù¥Ñ…±¥Ñäè(€€€€€€€€€€€Ñ…É•Ñ¡…É…Ñ•È¹Ù¥Ñ…±¥Ñä¬(€€€€€€€€€€€Á•¹‘¥¹MÑ…ÑÌ¹Ù¥Ñ…±¥Ñä°((€€€€€€€•¹•Éäè(€€€€€€€€€€€Ñ…É•Ñ¡…É…Ñ•È¹•¹•Éä¬(€€€€€€€€€€€Á•¹‘¥¹MÑ…ÑÌ¹•¹•Éä°((€€€€€€€¥¹Ñ•±±¥•¹”è(€€€€€€€€€€€Ñ…É•Ñ¡…É…Ñ•È¹¥¹Ñ•±±¥•¹”¬(€€€€€€€€€€€Á•¹‘¥¹MÑ…ÑÌ¹¥¹Ñ•±±¥•¹”°((€€€€€€€ÍÁ¥É¥Ðè(€€€€€€€€€€€Ñ…É•Ñ¡…É…Ñ•È¹ÍÁ¥É¥Ð¬(€€€€€€€€€€€Á•¹‘¥¹MÑ…ÑÌ¹ÍÁ¥É¥Ð°((€€€€€€€…¥±¥Ñäè(€€€€€€€€€€€Ñ…É•Ñ¡…É…Ñ•È¹…¥±¥Ñä¬(€€€€€€€€€€€Á•¹‘¥¹MÑ…ÑÌ¹…¥±¥Ñä((€€€ôì(((€€€€¼¨(€€€€€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3Ž3¦î{šVã–"¦4(€€€€€€ƒ¦†¿ž’ëžVÛ–&7¢žK¢&Ëžj!CŽMCšŠw¾ò3–*ƒ¦î{¦®S¢Î¨¼(€€€€€€ƒ¢÷¦?šf–>¿’î—¦‚C¢š÷–Š{–*ƒžj–.WžV¯¾ò3¢†šŠwšr(€€€€€€ƒ–B#žBžâ»ž~·Ž7¾ò'¾òh(€€€€€€µ…á!@½µ…áMC–³–ò?¢Þ}•Ñ	…Í•MÑ…ÑÌ ¤(€€€€€€ƒ¢Ž‡žjžº_šÎW–º3–£’â¢Ó¾ò Ç¦®S¢Î¨ô¬ÔÁ!C¾ò0(€€€€€€€Ç¢÷¦<ô¬ÄÕMC¾ò'¾ò3–>«šb¿¦g¢Ž‡šRçš"C–B(€€€€€€Ñ…É•Ñ¡…É…Ñ•Ë¾ò#–>¿¢÷šb½Á±…å•Ëš"X(€€€€€€Á±…å•ÈË¾ò'¾ò3’â7¢÷žnÓš:—–Fó–>¬(€€€€€€•Ñ	…Í•MÑ…ÑÌ §¾ò#¦
–/–÷–ò?–¾¯š¶ïš*L(€€€€€€Á±…å•Ë¾ò'¾ò3¢«–ÞÇ¦7žº_’âš²‡Ž((€€€€€€ƒžn»–&5!@½MC¾ò!Ñ…É•Ñ¡…É…Ñ•È¹¡Ã¾ò<¹ÍÃ¾ò$(€€€€€€ƒ’â7šr–nƒž
ë¦‚C¢š÷–*ƒ¦î{¢3šRç¢º+¾ò3–>«šr'Ž3’â+¦fCŽ4(€€€€€€ƒšr¢Þ¢F]Á•¹‘¥¹MÑ…ÑÌ¹Ù¥Ñ…±¥Ñç¾ò<¹•¹•Éä(€€€€€€ƒ–6Ïšf¦‚C¢š÷¢º+–2[ŠSŠS¦gš¢¢†šŠw–¾³–ê˜(€€€€€€ƒ¾ò#ž>û–r¡!Cß¦‚C¢š÷–ú3’â+¦fC¾ò'–ÂÇšr¢«žØ(€€€€€€ƒ¦j£¢F_’â+¦fC¢º+–’Ÿ¢3žâ»ž~·¾ò3’â7žR£–>›–’[–¾¬(€€€€€€ƒŽ3žâ»ž~·–.WžV¯Ž7žjž&çšº+¦
?¢ò¿Ž(€€€€¨¼((€€€½¹ÍÐÁÉ•Ù¥•Ý5…á!@ô((€€€€€€€€ÄÀÀ¬(€€€€€€€ÕÉÉ•¹Ð¹Ù¥Ñ…±¥Ñä¨ÔÀ¬(€€€€€€€€¡Ñ…É•Ñ¡…É…Ñ•È¹‰½¹ÕÍ!AñðÀ¤ì(((€€€½¹ÍÐÁÉ•Ù¥•Ý5…áM@ô((€€€€€€€€ÔÀ¬(€€€€€€€ÕÉÉ•¹Ð¹•¹•Éä¨ÄÔ¬(€€€€€€€€¡Ñ…É•Ñ¡…É…Ñ•È¹‰½¹ÕÍMAñðÀ¤ì(((€€€½¹ÍÐÕÉÉ•¹Ñ!@ô((€€€€€€€5…Ñ ¹µ¥¸ (€€€€€€€€€€€Ñ…É•Ñ¡…É…Ñ•È¹¡ÁñðÀ°(€€€€€€€€€€€ÁÉ•Ù¥•Ý5…á!@(€€€€€€€€¤ì(((€€€½¹ÍÐÕÉÉ•¹ÑM@ô((€€€€€€€5…Ñ ¹µ¥¸ (€€€€€€€€€€€Ñ…É•Ñ¡…É…Ñ•È¹ÍÁñðÀ°(€€€€€€€€€€€ÁÉ•Ù¥•Ý5…áM@(€€€€€€€€¤ì(((€€€€ ‰ÍÑ…ÑÕÍAÉ•Ù¥•Ý!ÁQ•áÐˆ¤(€€€€€€€€¹Ñ•áÑ½¹Ñ•¹Ðô((€€€€€€€ÕÉÉ•¹Ñ!@¬(€€€€€€€€‹¾ò<ˆ¬(€€€€€€€ÁÉ•Ù¥•Ý5…á!@ì(((€€€€ ‰ÍÑ…ÑÕÍAÉ•Ù¥•ÝMÁQ•áÐˆ¤(€€€€€€€€¹Ñ•áÑ½¹Ñ•¹Ðô((€€€€€€€ÕÉÉ•¹ÑM@¬(€€€€€€€€‹¾ò<ˆ¬(€€€€€€€ÁÉ•Ù¥•Ý5…áM@ì(((€€€€ ‰ÍÑ…ÑÕÍAÉ•Ù¥•Ý!Á¥±°ˆ¤(€€€€€€€€¹ÍÑå±”¹Ý¥‘Ñ ô((€€€€€€€€ (€€€€€€€€€€€ÁÉ•Ù¥•Ý5…á!@øÀ(€€€€€€€€€€€€ü(€€€€€€€€€€€€¡ÕÉÉ•¹Ñ!@½ÁÉ•Ù¥•Ý5…á!@¨ÄÀÀ¤(€€€€€€€€€€€€è(€€€€€€€€€€€€À(€€€€€€€€¤¬(€€€€€€€€ˆ”ˆì(((€€€€ ‰ÍÑ…ÑÕÍAÉ•Ù¥•ÝMÁ¥±°ˆ¤(€€€€€€€€¹ÍÑå±”¹Ý¥‘Ñ ô((€€€€€€€€ (€€€€€€€€€€€ÁÉ•Ù¥•Ý5…áM@øÀ(€€€€€€€€€€€€ü(€€€€€€€€€€€€¡ÕÉÉ•¹ÑM@½ÁÉ•Ù¥•Ý5…áM@¨ÄÀÀ¤(€€€€€€€€€€€€è(€€€€€€€€€€€€À(€€€€€€€€¤¬(€€€€€€€€ˆ”ˆì(((€€€€¼¨(€€€€€€ƒŠbƒšZÃ–Š{¾òh(€€€€€€ƒž.š/¦‚¦v‹ž>û–r£šr¦†¿ž’è(€€€€€€ƒŽ3ž:§–ºÛ¦î{šVà€¬ƒ¢Žw–
g–*ƒš"@€ôƒžâ÷–B#Ž7¾ò0(€€€€€€ƒ¢3’â7šb¿–>«¦†¿ž’ëž:§–ºÛ¢«–ÞÇ–*ƒ¦î{žjšVã–¶_Ž(€€€€€€ƒ¢Žw–
g–*ƒš"Cš*O–Â7š'¢žK¢&Ëžj¢Žw–
gš²(€€€€€€ƒ¾ò!Á±…å•ËŠIÁ±…å•È¹•±•µ•¹ÓŽ(€€€€€€Á±…å•ÈËŠK–në–ºh‰Á±…å•ÈÈ‹¦g–-­•ç¾ò'¾ò0(€€€€€€ƒ¢Þ’âï–~;Ž¢3–2¦‚žr/–"Ãžj¦
?¢ò¿’â¢ÓŽ(€€€€¨¼((€€€½¹ÍÐ•ÅÕ¥Áµ•¹Ñ	½¹ÕÌ€ô€€€€€€€•ÑÅÕ¥Áµ•¹Ñ	½¹ÕÌ (€€€€€€€€€€€•ÑA…ÉÑå¡…É…Ñ•É-•ä (€€€€€€€€€€€€€€€•ÑA…ÉÑå¡…É…Ñ•É%¹‘•à¡Ñ…É•Ñ¡…É…Ñ•È¤(€€€€€€€€€€€€¤(€€€€€€€€¤ì(((€€€™Õ¹Ñ¥½¸™½Éµ…ÑMÑ…Ñ1¥¹” (€€€€€€€‰…Í•Y…±Õ”°(€€€€€€€‰½¹ÕÍY…±Õ”(€€€€¥ì((€€€€€€€€¼¨(€€€€€€€€€€ƒŠbƒ’þ»š¶¾òh(€€€€€€€€€€ƒ’æ/–&7¢Žw–
g–*ƒš"Cšb¼Ãžjšf–g–>«¦†¿ž’ë–Z»’âšVã–¶_¾ò0(€€€€€€€€€€ƒž:§–ºÛšÊK¢Žw–
gšvÇ¢–ÿšf–º3–£žr/’â7–è(€€€€€€€€€€ƒŽ3šr'–r£žº_¢Žw–
g–*ƒš"CŽ7¦g’îÛ’ê/¾ò0(€€€€€€€€€€ƒ’î—ž
ëšÊKžRšV#Ž(€€€€€€€€€€ƒšRçš"C’â–ú/¦†¿ž’ëŽ3–~ëž’8¯¢Žw–
d÷žâ÷–B#Ž7¾ò0(€€€€€€€€€€ƒ–ÂÇžº_¢Žw–
g–*ƒš"Cšb¼Ã’æ’âš¢¦†¿ž’ë¾ò0(€€€€€€€€€€ƒ’ú/–š€ä¬ÀôçŽ(€€€€€€€€¨¼((€€€€€€€É•ÑÕÉ¸€ (€€€€€€€€€€€‰…Í•Y…±Õ”¬(€€€€€€€€€€€€ˆ¬ˆ¬(€€€€€€€€€€€‰½¹ÕÍY…±Õ”¬(€€€€€€€€€€€€ˆôˆ¬(€€€€€€€€€€€€ (€€€€€€€€€€€€€€€‰…Í•Y…±Õ”¬(€€€€€€€€€€€€€€€‰½¹ÕÍY…±Õ”(€€€€€€€€€€€€¤(€€€€€€€€¤ì((€€€ô(((€€€€ ‰ÍÑ…ÑÕÍÑÑ…¬ˆ¤(€€€€€€€€¹Ñ•áÑ½¹Ñ•¹Ð€ô(€€€€€€€™½Éµ…ÑMÑ…Ñ1¥¹” (€€€€€€€€€€€ÕÉÉ•¹Ð¹…ÑÑ…¬°(€€€€€€€€€€€•ÅÕ¥Áµ•¹Ñ	½¹ÕÌ¹…ÑÑ…¬(€€€€€€€€¤ì(((€€€€ ‰ÍÑ…ÑÕÍY¥Ñ…±¥Ñäˆ¤(€€€€€€€€¹Ñ•áÑ½¹Ñ•¹Ð€ô(€€€€€€€™½Éµ…ÑMÑ…Ñ1¥¹” (€€€€€€€€€€€ÕÉÉ•¹Ð¹Ù¥Ñ…±¥Ñä°(€€€€€€€€€€€•ÅÕ¥Áµ•¹Ñ	½¹ÕÌ¹Ù¥Ñ…±¥Ñä(€€€€€€€€¤ì(((€€€€ ‰ÍÑ…ÑÕÍ¹•Éäˆ¤(€€€€€€€€¹Ñ•áÑ½¹Ñ•¹Ð€ô(€€€€€€€™½Éµ…ÑMÑ…Ñ1¥¹” (€€€€€€€€€€€ÕÉÉ•¹Ð¹•¹•Éä°(€€€€€€€€€€€•ÅÕ¥Áµ•¹Ñ	½¹ÕÌ¹•¹•Éä(€€€€€€€€¤ì(((€€€€ ‰ÍÑ…ÑÕÍ%¹Ñ•±±¥•¹”ˆ¤(€€€€€€€€¹Ñ•áÑ½¹Ñ•¹Ð€ô(€€€€€€€™½Éµ…ÑMÑ…Ñ1¥¹” (€€€€€€€€€€€ÕÉÉ•¹Ð¹¥¹Ñ•±±¥•¹”°(€€€€€€€€€€€•ÅÕ¥Áµ•¹Ñ	½¹ÕÌ¹¥¹Ñ•±±¥•¹”(€€€€€€€€¤ì(((€€€€ ‰ÍÑ…ÑÕÍMÁ¥É¥Ðˆ¤(€€€€€€€€¹Ñ•áÑ½¹Ñ•¹Ð€ô(€€€€€€€™½Éµ…ÑMÑ…Ñ1¥¹” (€€€€€€€€€€€ÕÉÉ•¹Ð¹ÍÁ¥É¥Ð°(€€€€€€€€€€€•ÅÕ¥Áµ•¹Ñ	½¹ÕÌ¹ÍÁ¥É¥Ð(€€€€€€€€¤ì(((€€€€ ‰ÍÑ…ÑÕÍ¥±¥Ñäˆ¤(€€€€€€€€¹Ñ•áÑ½¹Ñ•¹Ð€ô(€€€€€€€™½Éµ…ÑMÑ…Ñ1¥¹” (€€€€€€€€€€€ÕÉÉ•¹Ð¹…¥±¥Ñä°(€€€€€€€€€€€•ÅÕ¥Áµ•¹Ñ	½¹ÕÌ¹…¥±¥Ñä(€€€€€€€€¤ì(((€€€½¹ÍÐÕÍ•€ô(€€€€€€€=‰©•Ð¹Ù…±Õ•Ì (€€€€€€€€€€€Á•¹‘¥¹MÑ…ÑÌ(€€€€€€€€¤(€€€€€€€€¹É•‘Õ” (€€€€€€€€€€€€¡ÍÕ´±Ù…±Õ”¤ôø(€€€€€€€€€€€€€€€ÍÕ´­Ù…±Õ”°(€€€€€€€€€€€€À(€€€€€€€€¤ì(((€€€€ ‰…ÑÑÉ¥‰ÕÑ•A½¥¹ÑÌˆ¤(€€€€€€€€¹Ñ•áÑ½¹Ñ•¹Ð€ô(€€€€€€€5…Ñ ¹µ…à (€€€€€€€€€€€€À°(€€€€€€€€€€€Ñ…É•Ñ¡…É…Ñ•È¹…ÑÑÉ¥‰ÕÑ•A½¥¹ÑÌµÕÍ•(€€€€€€€€¤ì(((€€€€ ‰½¹™¥ÉµMÑ…ÑÕÍ	ÕÑÑ½¸ˆ¤(€€€€€€€€¹‘¥Í…‰±•€ô(€€€€€€€ÕÍ•ôôôÀì(((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾ò#žrš¶š*O–"ÃŽ3žº·¦‚·–6–†+š;¦êó¦^s¦÷¦^p(€€€€€€ƒ’â7š:'Ž7žj–:–nƒ¾ò'¾òh(€€€€€€ƒ¦g¢Ž‡–:šr³ž‡šŠw’îÛ’úwžÁ±…å•ÈË–¶c’â7–¶c–r (€€€€€€ƒ¦7šZÃ¢¢·–ºk¦†¿ž’ëž.š/¾ò3–º3–£’â7ž~—¦O¦g–,(€€€€€€ƒ–6–†+ž>û–r£šb¿’â7šb¿š¶¢Š¯¢žK¢&Ë¢š[žª\(€€€€€€ƒ¾ò!ÍÝ¥Ñ¡¡…É…Ñ•ÉQ…ˆ §¾ò'šVš?–¢ÖÀ(€€€€€€ƒ¦jÇ¢^?ŠSŠS–>«¢šž:§–ºÛ¦î{’âš²„¬¼·š2'¦"W¾ò0(€€€€€€ƒ¦g¢Ž‡–ÂÇšrš*+¦jÇ¢^?žjšV#šzs¢N/š:'Ž¦7šZÀ(€€€€€€ƒ¦†¿ž’ë–ë’ú¾ò3¦gš&7šb¿Ž3š;¦êó¦jÇ¢^?¦÷šÊKžR£Ž4(€€€€€€ƒžjžrš¶–:–nƒŽ((€€€€€€ƒ–*ƒ’â–/–"“šZß¾òk–ššzs¦g–/–žÒƒš¶šb¼(€€€€€€¡½µ••…ÑÕÉ•!¥‘‘•¹MÝ¥Ñ¡…É“¢¢c¦2žj(€€€€€€ƒ¦
’â–/¾ò#’î¢†£žn»–&7š¶¢Š¯¢žK¢&Ë¢š[žª_–¢ÖÃ¾ò'¾ò0(€€€€€€ƒ–ÂÇ¢ÞÏ¦;¦g¢Ž‡žj¦†¿ž’ë¦
?¢ò¿¾ò3žÚ·š2¦jÇ¢^?¾ò0(€€€€€€ƒ’â7¢š¢N/š:'Ž(€€€€¨¼((€€€½¹ÍÐÍÝ¥Ñ¡…Éô(€€€€€€€€ ‰ÍÑ…ÑÕÍ¡…É…Ñ•ÉMÝ¥Ñ¡…Éˆ¤ì(((€€€½¹ÍÐ¹…µ•	½àô(€€€€€€€€ ‰ÍÑ…ÑÕÍ¡…É…Ñ•É9…µ”ˆ¤ì(((€€€¥˜ (€€€€€€€ÍÝ¥Ñ¡…É€˜˜(€€€€€€€ÍÝ¥Ñ¡…É„ôô(€€€€€€€¡½µ••…ÑÕÉ•!¥‘‘•¹MÝ¥Ñ¡…É(€€€€¥ì((€€€€€€€ÍÝ¥Ñ¡…É¹ÍÑå±”¹‘¥ÍÁ±…äô((€€€€€€€€€€€•Ñá¥ÍÑ¥¹A…ÉÑå%¹‘•á•Ì ¤¹±•¹Ñ øÄ(€€€€€€€€€€€€ü(€€€€€€€€€€€€‰‰±½¬ˆ(€€€€€€€€€€€€è(€€€€€€€€€€€€‰¹½¹”ˆì((€€€ô(((€€€¥˜¡¹…µ•	½à¥ì((€€€€€€€¹…µ•	½à¹Ñ•áÑ½¹Ñ•¹Ðô(€€€€€€€€€€€€¡Ñ…É•Ñ¡…É…Ñ•È¹¥‘ñð‹–K¦j«¢ˆ¤¬(€€€€€€€€€€€€ˆ1Ø¸ˆ¬(€€€€€€€€€€€Ñ…É•Ñ¡…É…Ñ•È¹±•Ù•°ì((€€€ô()ô(()™Õ¹Ñ¥½¸½¹™¥ÉµMÑ…ÑÕÌ ¥ì((€€€½¹ÍÐÑ…É•Ñ¡…É…Ñ•Èô(€€€€€€€•ÑMÑ…ÑÕÍ¡…É…Ñ•É=‰©•Ð ¤ì(((€€€½¹ÍÐÕÍ•€ô(€€€€€€€=‰©•Ð¹Ù…±Õ•Ì (€€€€€€€€€€€Á•¹‘¥¹MÑ…ÑÌ(€€€€€€€€¤(€€€€€€€€¹É•‘Õ” (€€€€€€€€€€€€¡ÍÕ´±Ù…±Õ”¤ôø(€€€€€€€€€€€€€€€ÍÕ´­Ù…±Õ”°(€€€€€€€€€€€€À(€€€€€€€€¤ì(((€€€¥˜ (€€€€€€€ÕÍ•ðôÀñð(€€€€€€€ÕÍ•ø(€€€€€€€Ñ…É•Ñ¡…É…Ñ•È¹…ÑÑÉ¥‰ÕÑ•A½¥¹ÑÌ(€€€€¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€€¼¨(€€€€€€ƒŠbƒ’âš²‡žŠë¢ª7–ú3–£¦£š¶ã¦nÛ¾ò0(€€€€€€ƒ’â7šr–ëž>û’æ/–&7Ž3žŠë¢ª7–ú3¦
¢÷’êš2'Ž7¦ƒš"CžVÛš¦Ž(€€€€¨¼((€€€=‰©•Ð¹­•åÌ (€€€€€€€Á•¹‘¥¹MÑ…ÑÌ(€€€€¤(€€€€¹™½É… ¡ÍÑ…Ðôùì((€€€€€€€Ñ…É•Ñ¡…É…Ñ•ÉmÍÑ…Ñt€¬ô(€€€€€€€€€€€Á•¹‘¥¹MÑ…ÑÍmÍÑ…Ñtì((€€€€€€€Á•¹‘¥¹MÑ…ÑÍmÍÑ…ÑtôÀì((€€€ô¤ì(((€€€Ñ…É•Ñ¡…É…Ñ•È¹…ÑÑÉ¥‰ÕÑ•A½¥¹ÑÌ€´ô(€€€€€€€ÕÍ•ì(((€€€ÕÁ‘…Ñ•MÑ…ÑÕÍAÉ•Ù¥•Ü ¤ì((€€€ÕÁ‘…Ñ•U$ ¤ì((€€€Í…Ù•…µ” ¤ì()ô(((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€ƒš*¢ô(ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼()½¹ÍÐM-%11}AIY%]}159QLõl‰™¥É”ˆ°‰Ý…Ñ•Èˆ°‰Ý¥¹ˆ°‰•…ÉÑ ‰tì()™Õ¹Ñ¥½¸•ÑM­¥±±AÉ•Ù¥•ÝMÕµµ…Éä¡Í­¥±°¥ì((€€€½¹ÍÐÍ½Á•Ìõì(€€€€€€€Í¥¹±”è‹šRïšN+–Z»’âšV×’êèˆ°(€€€€€€€ÑÉ¤è‹šRïšN+žnã¦Ãžj’âš:KšV×’êèˆ°(€€€€€€€É½Üè‹šRïšN+’âšVÓš:KšV×’êèˆ°(€€€€€€€½±Õµ¸è‹šRïšN+–B3’âžnÓ–"_šV×’êèˆ°(€€€€€€€…±°è‹šRïšN+šV×šZç–£¦®Pˆ°(€€€€€€€…±±äè‹šR¿š>Ó’â–B7–>/šZäˆ°(€€€€€€€…±±å±°è‹šR¿š>Óš"GšZç–£¦®Pˆ°(€€€€€€€‘•…‘±±äè‹–ú§šÒï’â–B7–K’â/žj–>/šZäˆ°(€€€€€€€¹½¹”è‹¢Š¯–.WžRšV ˆ(€€€ôì((€€€½¹ÍÐ•™™•ÑÌõmtì((€€€¥˜¡Í­¥±°¹…Ñ•½Éäôôô‰Á¡åÍ¥…°ˆ¥ì(€€€€€€€•™™•ÑÌ¹ÁÕÍ  ‹¦ƒš"Cž&§žB–
ß–ºÌˆ¤ì(€€€ô(€€€¥˜¡Í­¥±°¹…Ñ•½Éäôôô‰µ…¥Œˆ¥ì(€€€€€€€•™™•ÑÌ¹ÁÕÍ  ‹¦ƒš"CšÎW¢†O–
ß–ºÌˆ¤ì(€€€ô(€€€¥˜¡Í­¥±°¹‰ÕÉ¹¡…¹”¥ì•™™•ÑÌ¹ÁÕÍ  ‹–>¿¢÷¦f–*ƒžžHˆ¤ìô(€€€¥˜¡Í­¥±°¹™É••é•¡…¹”¥ì•™™•ÑÌ¹ÁÕÍ  ‹–>¿¢÷’öÿžn»š¢g–Ã–Âˆ¤ìô(€€€¥˜¡Í­¥±°¹ÍÑÕ¹¡…¹”¥ì•™™•ÑÌ¹ÁÕÍ  ‹–>¿¢÷’öÿžn»š¢gšj#žr§’â›¦f7’ö;–F÷’â´ˆ¤ìô(€€€¥˜¡Í­¥±°¹…¥±¥Ñå½Ý¹¡…¹”¥ì•™™•ÑÌ¹ÁÕÍ  ‹–>¿¢÷¦f7’ö;žn»š¢gšV?š6Üˆ¤ìô(€€€¥˜¡Í­¥±°¹‘…µ…•½Ý¹¡…¹”¥ì•™™•ÑÌ¹ÁÕÍ  ‹–>¿¢÷¦f7’ö;žn»š¢g¦ƒš"Cžj–
ß–ºÌˆ¤ìô(€€€¥˜¡Í­¥±°¹‘•™•¹Í•½Ý¹¡…¹”¥ì•™™•ÑÌ¹ÁÕÍ  ‹–>¿¢÷¦f7’ö;žn»š¢g¦bËžš˜ˆ¤ìô(€€€¥˜¡Í­¥±°¹ÍÑ…Ñ½Ý¹¡…¹”¥ì•™™•ÑÌ¹ÁÕÍ  ‹–>¿¢÷¦f7’ö;žn»š¢g–’k¦‚¢÷–*lˆ¤ìô(€€€¥˜¡Í­¥±°¹±¥™•ÍÑ•…±A•É•¹Ñ	å1•Ù•°¥ì•™™•ÑÌ¹ÁÕÍ  ‹–>¿–BãšRÛ–
ß–ºÏ–n{–ú§¢«¢ê¬ˆ¤ìô(€€€¥˜¡Í­¥±°¹Í•±™M¡¥•±‘	å1•Ù•°¥ì•™™•ÑÌ¹ÁÕÍ  ‹ž
ë¢«–ÞÇ–îëž®/¢¶ßžnøˆ¤ìô(€€€¥˜¡Í­¥±°¹…±±åM¡¥•±‘	å1•Ù•°¥ì•™™•ÑÌ¹ÁÕÍ  ‹ž
ëš"GšZç–îëž®/¢¶ßžnøˆ¤ìô((€€€¥˜¡Í­¥±°¹…Ñ•½Éäôôô‰¡•…°ˆ¥ì(€€€€€€€•™™•ÑÌ¹ÁÕÍ  ‹–n{–ú§–>/šZçžR–F÷¢"¢÷¦<ˆ¤ì(€€€ô(€€€¥˜¡Í­¥±°¹…Ñ•½Éäôôô‰É•Ù¥Ù”ˆ¥ì(€€€€€€€•™™•ÑÌ¹ÁÕÍ  ‹¢ºO–K’â/žj–>/šZç¦7šZÃ–>š"Àˆ¤ì(€€€ô(€€€¥˜¡Í­¥±°¹…Ñ•½Éäôôô‰Á…ÍÍ¥Ù”ˆ¥ì(€€€€€€€•™™•ÑÌ¹ÁÕÍ  ‹šÂã’æ–òß–2[¢¦Ë–žÒƒžjš"Ã¦²—ž&ç¢&Èˆ¤ì(€€€ô((€€€½¹ÍÐ¹…µ•‘™™•ÑÌõì(€€€€€€€É…”è‹š>C–6š"GšZçž"šN+¢÷–*lˆ°(€€€€€€€‘½‘•M­¥±°è‹š>C–6š"GšZç¦Z¢êË¢÷–*lˆ°(€€€€€€€ÍÑ•…±Ñ¡M­¥±°è‹¢ºO–>/šZç¦Ë–—¦jÇ¢ê¬ˆ°(€€€€€€€‘¥¹¡…¥Í¡•¹é¡•¸è‹š>C–6š"GšZçžVÃ–âãž.š/š*_šœˆ°(€€€€€€€É½­]…±°è‹š>C–6š"GšZç¦bËžš›¢÷–*lˆ°(€€€€€€€•…ÉÑ¡M¡¥•±è‹¢Î›’ê#–>/šZç–>7–
ßšV#šzpˆ°(€€€€€€€‰…ÉÉ¥•Èè‹ž
ë–>/šZç–îëž®/–
ß–ºÏžÖCžV0ˆ(€€€ôì((€€€¥˜¡¹…µ•‘™™•ÑÍmÍ­¥±°¹¥‘t¥ì(€€€€€€€•™™•ÑÌ¹ÁÕÍ ¡¹…µ•‘™™•ÑÍmÍ­¥±°¹¥‘t¤ì(€€€ô((€€€É•ÑÕÉ¸l(€€€€€€€Í½Á•ÍmÍ­¥±°¹Ñ…É•ÑQåÁ•uñð‹ž&çšº+šV#šzpˆ°(€€€€€€€€¸¸¹•™™•ÑÌ(€€€t¹™¥±Ñ•È¡	½½±•…¸¤¹©½¥¸ ‹¾òlˆ¤¬‹Žˆì()ô()™Õ¹Ñ¥½¸É•¹‘•É±±±•µ•¹ÑM­¥±±AÉ•Ù¥•Ü¡•±•µ•¹Ð¥ì((€€€½¹ÍÐ‰½‘äô ‰Í­¥±±AÉ•Ù¥•Ý	½‘äˆ¤ì(€€€½¹ÍÐÑ…‰Ìô ‰Í­¥±±AÉ•Ù¥•ÝQ…‰Ìˆ¤ì((€€€¥˜ …‰½‘äñð€…Ñ…‰Ì¥ìÉ•ÑÕÉ¸ìô((€€€½¹ÍÐÍ•±•Ñ•õM-%11}AIY%]}159QL¹¥¹±Õ‘•Ì¡•±•µ•¹Ð¤(€€€€€€€€ü•±•µ•¹Ð(€€€€€€€€è€‰™¥É”ˆì((€€€Ñ…‰Ì¹¥¹¹•É!Q50õM-%11}AIY%]}159QL¹µ…À¡­•äôùì(€€€€€€€½¹ÍÐ‘…Ñ„õ•±•µ•¹Ñ…Ñ…‰…Í•m­•åtì(€€€€€€€É•ÑÕÉ¸€œñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÌôˆœ¬(€€€€€€€€€€€€¡­•äôôõÍ•±•Ñ•€ü€‰…Ñ¥Ù”ˆ€è€ˆˆ¤¬(€€€€€€€€€€€€œˆ½¹±¥¬ô‰É•¹‘•É±±±•µ•¹ÑM­¥±±AÉ•Ù¥•Ü¡pœœ­­•ä¬pœ¤ˆøœ¬(€€€€€€€€€€€‘…Ñ„¹¹…µ”¬Ÿ–Æ³šœð½‰ÕÑÑ½¸øœì(€€€ô¤¹©½¥¸ ˆˆ¤ì((€€€½¹ÍÐ…Ñ•½Éå9…µ•Ìõì(€€€€€€€Á¡åÍ¥…°è‹ž&§žBˆ°(€€€€€€€µ…¥Œè‹šÎW¢†Lˆ°(€€€€€€€‰Õ™˜è‹–Š{žn(ˆ°(€€€€€€€¡•…°è‹–n{–ú¤ˆ°(€€€€€€€É•Ù¥Ù”è‹–ú§šÒìˆ°(€€€€€€€Á…ÍÍ¥Ù”è‹¢Š¯–.Tˆ(€€€ôì((€€€½¹ÍÐÍ­¥±±Ìõ=‰©•Ð¹Ù…±Õ•Ì¡Í­¥±±…Ñ…‰…Í”¤¹™¥±Ñ•È (€€€€€€€Í­¥±°ôùÍ­¥±°¹•±•µ•¹ÐôôõÍ•±•Ñ•(€€€€¤ì((€€€‰½‘ä¹¥¹¹•É!Q50õÍ­¥±±Ì¹µ…À¡Í­¥±°ôø(€€€€€€€€œñ…ÉÑ¥±”±…ÍÌô‰Í­¥±°µÁÉ•Ù¥•Üµ…Éˆøœ¬(€€€€€€€€€€€€œñ‘¥ØøñÍÑÉ½¹œøœ­Í­¥±°¹¹…µ”¬œð½ÍÑÉ½¹œøñÍÁ…¸øœ¬(€€€€€€€€€€€€¡…Ñ•½Éå9…µ•ÍmÍ­¥±°¹…Ñ•½Éåuñð‹ž&çšº(ˆ¤¬œð½ÍÁ…¸øð½‘¥Øøœ¬(€€€€€€€€€€€€œñÀøœ­•ÑM­¥±±AÉ•Ù¥•ÝMÕµµ…Éä¡Í­¥±°¤¬œð½Àøœ¬(€€€€€€€€œð½…ÉÑ¥±”øœ(€€€€¤¹©½¥¸ ˆˆ¤ì((€€€‰½‘ä¹ÍÉ½±±Q½ÀôÀì)ô()™Õ¹Ñ¥½¸½Á•¹±±±•µ•¹ÑM­¥±±AÉ•Ù¥•Ü ¥ì((€€€½¹ÍÐµ½‘…°ô ‰…±±±•µ•¹ÑM­¥±±AÉ•Ù¥•Ý5½‘…°ˆ¤ì(€€€¥˜ …µ½‘…°¥ìÉ•ÑÕÉ¸ìô((€€€É•¹‘•É±±±•µ•¹ÑM­¥±±AÉ•Ù¥•Ü ‰™¥É”ˆ¤ì(€€€µ½‘…°¹±…ÍÍ1¥ÍÐ¹…‘ ‰Í¡½Üˆ¤ì(€€€µ½‘…°¹Í•ÑÑÑÉ¥‰ÕÑ” ‰…É¥„µ¡¥‘‘•¸ˆ°‰™…±Í”ˆ¤ì)ô()™Õ¹Ñ¥½¸±½Í•±±±•µ•¹ÑM­¥±±AÉ•Ù¥•Ü ¥ì((€€€½¹ÍÐµ½‘…°ô ‰…±±±•µ•¹ÑM­¥±±AÉ•Ù¥•Ý5½‘…°ˆ¤ì(€€€¥˜ …µ½‘…°¥ìÉ•ÑÕÉ¸ìô((€€€µ½‘…°¹±…ÍÍ1¥ÍÐ¹É•µ½Ù” ‰Í¡½Üˆ¤ì(€€€µ½‘…°¹Í•ÑÑÑÉ¥‰ÕÑ” ‰…É¥„µ¡¥‘‘•¸ˆ°‰ÑÉÕ”ˆ¤ì)ô()™Õ¹Ñ¥½¸¡…¹•M­¥±±¡…É…Ñ•ÉÉÉ½Ü¡‘¥É•Ñ¥½¸¥ì((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾òh(€€€€€€ƒ–:šr³šb¼ñÍ•±•Ðû’â/š.'¦ã–Z»¾ò0(€€€€€€ƒšRçš"C¢Þž.š/¦‚’â¢Óžj–Þ›–>Ïžº·¦‚·–"š>o¾ò0(€€€€€€ƒšÂÓš"Ã–Ž¬¿¦Š£–òOš&/¦g–§–/žn»–&7šÊKšr'žrš¶¢žK¢&Ë¢ÎšZgžj(€€€€€€ƒ¦ã¦‚’æ’â’ö×š.ÿš:'¾ò0(€€€€€€ƒ–>«–r¡™¥É—¾ò#ž²³’â¢žK¢&Ë¾ò'¢Þ}Á±…å•ÈË¾ò#ž²³’ê3¢žK¢&Ë¾ò0(€€€€€€ƒ–¶c–r£žj¢¦Ç¾ò'’æ/¦ZO–"š>o¾ò3š¾S¢ò’â7šr¢ª“–Â;ž:§–ºØ(€€€€€€ƒ’î—ž
ëšÂÐ¿¦Š£’æ¢÷š¶–âãžR£Ž(€€€€¨¼((€€€½¹ÍÐ­•åÌõ•Ñá¥ÍÑ¥¹A…ÉÑå%¹‘•á•Ì ¤¹µ…À (€€€€€€€¥¹‘•àôù•ÑA…ÉÑå¡…É…Ñ•É-•ä¡¥¹‘•à¤(€€€€¤ì((€€€¥˜¡­•åÌ¹±•¹Ñ ðÈ¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô((€€€½¹ÍÐÕÉÉ•¹ÑA½Í¥Ñ¥½¸õ5…Ñ ¹µ…à (€€€€€€€€À°(€€€€€€€­•åÌ¹¥¹‘•á=˜¡ÕÉÉ•¹ÑM­¥±±¡…É…Ñ•È¤(€€€€¤ì((€€€ÕÉÉ•¹ÑM­¥±±¡…É…Ñ•Èõ­•åÍl(€€€€€€€€¡ÕÉÉ•¹ÑA½Í¥Ñ¥½¸­‘¥É•Ñ¥½¸­­•åÌ¹±•¹Ñ ¤•­•åÌ¹±•¹Ñ (€€€tì(((€€€É•¹‘•ÉM­¥±±1½…‘½ÕÐ ¤ì()ô(()™Õ¹Ñ¥½¸•ÑM­¥±±¡…É…Ñ•É=‰©•Ð¡¡…É…Ñ•É%¥ì((€€€€¼¨(€€€€€€ƒŠbƒšZÃ–Š{¾òh(€€€€€€ƒš*¢÷–¶ãžþH¿–6žÒk¢š¢*Çžjš*¢÷¦î{¾ò0(€€€€€€ƒžn»–&7–>«šr%Á±…å•Ë¾ò!™¥É—¾ò'¢Þ}Á±…å•ÈÈ(€€€€€€ƒ¦g–§–/¢žK¢&Ëšr'žrš¶ž6£ž®/žjÍ­¥±±A½¥¹ÑÏ¾ò0(€€€€€€Ý…Ñ•È½Ý¥¹“¦
–>«šb¿¢Žw–
gžR£žjž¦ëšºó¾ò0(€€€€€€ƒšÊKšr'¢3–ú3žj¢žK¢&Ë¢ÎšZg¾ò3–n{–
Í¹Õ±³¾ò0(€€€€€€ƒ–Fó–>¯žj–rÃšZç¢š¢«–ÞÇ–"“šZÝ¹Õ±³žjššÎŽ(€€€€¨¼((€€€¥˜¡¡…É…Ñ•É%ôôô‰™¥É”ˆ¥ì(€€€€€€€É•ÑÕÉ¸Á±…å•Èì(€€€ô(((€€€¥˜ (€€€€€€€¡…É…Ñ•É%ôôô‰Á±…å•ÈÈˆ˜˜(€€€€€€€Á±…å•ÈÈ(€€€€¥ì(€€€€€€€É•ÑÕÉ¸Á±…å•ÈÈì(€€€ô((€€€¥˜ (€€€€€€€¡…É…Ñ•É%ôôô‰Á±…å•ÈÌˆ˜˜(€€€€€€€Á±…å•ÈÌ(€€€€¥ì(€€€€€€€É•ÑÕÉ¸Á±…å•ÈÌì(€€€ô(((€€€É•ÑÕÉ¸¹Õ±°ì()ô(()™Õ¹Ñ¥½¸É•¹‘•ÉM­¥±±1½…‘½ÕÐ ¥ì((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾òh(€€€€€€ƒ–:šr³šb¿šnÓšZÀñÍ•±•Ðû¢Ž‡–§–,ñ½ÁÑ¥½¸ûžjšZ–¶_¾ò0(€€€€€€ƒž>û–r¡U'šRçš"C–Þ›–>Ïžº·¦‚´¯’â–/–B7–¶_šZç–†+¾ò0(€€€€€€ƒšRçš"CžnÓš:—šnÓšZÃ¦
–/šZç–†+žjšZ–¶_¾ò0(€€€€€€ƒ¦†¿ž’ëžn»–&7¦ã’â·¢žK¢&Ëžj–B7–¶\¯ž¶'žÒk¾ò0(€€€€€€ƒ¢Þž.š/¦‚žj–"š>o–6‡ž&¦
?¢ò¿’â¢ÓŽ(€€€€¨¼((€€€½¹ÍÐ¹…µ•	½àô(€€€€€€€€ ‰Í­¥±±¡…É…Ñ•É9…µ•	½àˆ¤ì(((€€€¥˜¡¹…µ•	½à¥ì((€€€€€€€½¹ÍÐÍ•±•Ñ•‘%¹‘•àô(€€€€€€€€€€€ÕÉÉ•¹ÑM­¥±±¡…É…Ñ•Èôôô‰Á±…å•ÈÌˆ(€€€€€€€€€€€€ü€È(€€€€€€€€€€€€èÕÉÉ•¹ÑM­¥±±¡…É…Ñ•Èôôô‰Á±…å•ÈÈˆ(€€€€€€€€€€€€ü€Ä(€€€€€€€€€€€€è€Àì((€€€€€€€½¹ÍÐÍ•±•Ñ•‘¡…É…Ñ•Èô(€€€€€€€€€€€•ÑA…ÉÑå¡…É…Ñ•É	å%¹‘•à¡Í•±•Ñ•‘%¹‘•à¥ññÁ±…å•Èì((€€€€€€€¹…µ•	½à¹Ñ•áÑ½¹Ñ•¹Ðô(€€€€€€€€€€€€¡Í•±•Ñ•‘¡…É…Ñ•È¹¥‘ñð‹¢žK¢&Èˆ¬¡Í•±•Ñ•‘%¹‘•à¬Ä¤¤¬(€€€€€€€€€€€€ˆ1Ø¸ˆ¬(€€€€€€€€€€€Í•±•Ñ•‘¡…É…Ñ•È¹±•Ù•°ì((€€€ô(((€€€½¹ÍÐ¡…É…Ñ•È€ô(€€€€€€€¡…É…Ñ•ÉM­¥±±1½…‘½ÕÑÍl(€€€€€€€€€€€ÕÉÉ•¹ÑM­¥±±¡…É…Ñ•È(€€€€€€€tì(((€€€¥˜ …¡…É…Ñ•È¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€½¹ÍÐ±½…‘½ÕÐ€ô(€€€€€€€€ ‰Í­¥±±1½…‘½ÕÐˆ¤ì(((€€€½¹ÍÐ…±±1¥ÍÐ€ô(€€€€€€€€ ‰…±±M­¥±±Í1¥ÍÐˆ¤ì(((€€€±½…‘½ÕÐ¹¥¹¹•É!Q50ôˆˆì((€€€…±±1¥ÍÐ¹¥¹¹•É!Q50ôˆˆì(((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3Ž3š*¢÷¦7¢Žt(€€€€€€ƒ–>«¦†¿ž’é¥½»¢Þ–B7ž¢Ç¾ò3–Û¦’c¦÷žržV—¾ò3’âš:H(€€€€€€ƒ–no–/š:K’â¢ÖßŽ7¾ò'¾òh(€€€€€€ƒ–:šr³š¾?š‚ó–Ÿ–ºç’â–’Ÿ’âË¾ò#–"¦†x¿¢ª«šb8½M@¼(€€€€€€ƒžžï¦f“š2'¦"W¾ò'¾ò3šRçš"C–>«šr'–r[ž’è¯–B7ž¢Ç–§¢†3¾ò0(€€€€€€ƒ¦î{š‚ó–¶Cšr³¢ê¯žnÓš:—¢žãžfóžžï¦f“¾ò#šr'¢Žw–
gšf¾ò$(€€€€€€ƒ¾ò3’â7–7¦r¢š¦†7–’[žjžžï¦f“š2'¦"WšZ–¶_’öS’ö7žö»Ž(€€€€¨¼((€€€™½È (€€€€€€€±•Ð¤ôÀì(€€€€€€€¤ðÐì(€€€€€€€¤¬¬(€€€€¥ì((€€€€€€€½¹ÍÐÍ­¥±±%€ô(€€€€€€€€€€€¡…É…Ñ•È¹•ÅÕ¥ÁÁ•‘M­¥±±Ím¥tì(((€€€€€€€½¹ÍÐ‰½à€ô(€€€€€€€€€€€‘½Õµ•¹Ð¹É•…Ñ•±•µ•¹Ð (€€€€€€€€€€€€€€€€‰‘¥Øˆ(€€€€€€€€€€€€¤ì(((€€€€€€€‰½à¹±…ÍÍ9…µ”€ô(€€€€€€€€€€€€‰Í­¥±°µ±½…‘½ÕÐµÍ±½Ðˆì(((€€€€€€€¥˜¡Í­¥±±%˜™Í­¥±±…Ñ…‰…Í•mÍ­¥±±%‘t¥ì((€€€€€€€€€€€½¹ÍÐÍ­¥±°€ô(€€€€€€€€€€€€€€€Í­¥±±…Ñ…‰…Í•mÍ­¥±±%‘tì(((€€€€€€€€€€€‰½à¹¥¹¹•É!Q50€ô((€€€€€€€€€€€€(€€€€€€€€€€€€ñ‘¥Ø(€€€€€€€€€€€€€€€¥ô‰±½…‘½ÕÑ%½¹|‘íÍ­¥±±%‘ôˆ(€€€€€€€€€€€€€€€±…ÍÌô‰Í­¥±°µ±½…‘½ÕÐµÍ±½Ðµ¥½¸ˆ(€€€€€€€€€€€€€€€ÍÑå±”ô‰‰…­É½Õ¹µ¥µ…”è‘í•ÑM­¥±±%½¹	…­É½Õ¹‘%µ…”¡Í­¥±±%¥ôìˆ(€€€€€€€€€€€€øð½‘¥Øø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÌô‰Í­¥±°µ±½…‘½ÕÐµÍ±½Ðµ¹…µ”ˆø(€€€€€€€€€€€€€€€€‘íÍ­¥±°¹¹…µ•ô(€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€ì(((€€€€€€€€€€€‰½à¹½¹±¥¬ô(€€€€€€€€€€€€€€€€ ¤ôùÉ•µ½Ù•ÅÕ¥ÁÁ•‘M­¥±°¡¤¤ì((€€€€€€€ô(€€€€€€€•±Í•ì((€€€€€€€€€€€‰½à¹¥¹¹•É!Q50€ô((€€€€€€€€€€€€(€€€€€€€€€€€€ñ‘¥Ø±…ÍÌô‰Í­¥±°µ±½…‘½ÕÐµÍ±½Ðµ¥½¸ˆøð½‘¥Øø(€€€€€€€€€€€€ñ‘¥Ø(€€€€€€€€€€€€€€€±…ÍÌô‰Í­¥±°µ±½…‘½ÕÐµÍ±½Ðµ¹…µ”ˆ(€€€€€€€€€€€€€€€ÍÑå±”ô‰½±½ÈèŒØÐÜÐáˆìˆ(€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€ƒž¦è(€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€ì((€€€€€€€ô(((€€€€€€€±½…‘½ÕÐ¹…ÁÁ•¹‘¡¥± (€€€€€€€€€€€‰½à(€€€€€€€€¤ì((€€€ô(((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3Ž3’â7žR£ž&ç–"”(€€€€€€ƒ–7–k’â–/–ÞË–¶ãšrš*¢÷žjš†’ê¾ò3š.ÿš:'¾ò0(€€€€€€ƒž>û–r£š*¢÷–ÂÇšb¿žR£’âš:K’âš:K–F#ž>û¾ò3šÊK–¶ãžþH(€€€€€€ƒžj–ÂÇ¦†¿ž’ëšr«–¶ãžþK–ÂÇ––÷Ž7¾ò'¾òh(€€€€€€ƒ–:šr³Ž3–ÞË–¶ãšrš*¢÷Ž7Ž3–>¿–¶ãžþKš*¢÷Ž7šb¼(€€€€€€ƒ–§–/–B¢«ž6£ž®/žj™½É…£¢þÓ–r#¾ò3–B¢¨(€€€€€€…ÁÁ•¹‘¡¥±“–"Ã’â7–B3–ºç–f£Ž–B#’ö×š"C’â–,(€€€€€€ƒ¢þÓ–r#¾ò3’âš²‡¢ÞG¦;¦g–/¢žK¢&Ë–žÒƒ–êW’â/žj(€€€€€€ƒ–£¦£š*¢÷¾ò3š¾?’â–"_¢«–ÞÇ–"“šZßŽ3¦
šÊK–¶ã¾ò<(€€€€€€ƒ–ÞË–¶ãšr«šîÿžÒk¾ò?–ÞËšîÿžÒkŽ7¢¦Ë¦†¿ž’ë–N«ž¢»ž.š/¾ò0(€€€€€€ƒ–£¦¡…ÁÁ•¹“–"Ã–B3’â–-…±±1¥ÍÓ–ºç–f£Ž(€€€€¨¼((€€€½¹ÍÐÍ­¥±±1•Ù•±Ì€ô(€€€€€€€¡…É…Ñ•È¹Í­¥±±1•Ù•±Íñð(€€€€€€€íôì(((€€€€¼¨(€€€€€€ƒŠbƒ¦g–/¢žK¢&Ë¢3–ú3žrš¶žj¢ÎšZgž&§’îØ(€€€€€€ƒ¾ò!Á±…å•Ëš"YÁ±…å•ÈË¾ò'¾ò0(€€€€€€ƒžR£’úš~—¢¦ˆ¿¦†¿ž’ëš*¢÷¦î{šVã¦?Ž(€€€€€€Ý…Ñ•È½Ý¥¹“žn»–&7¦
šÊKšr'žrš¶žj¢žK¢&Ë¢ÎšZg¾ò0(€€€€€€Í­¥±±=Ý¹•Ëšršb½¹Õ±³¾ò0(€€€€€€ƒ’â/¦v‹žR£–"Ãžj–rÃšZç¦÷¢š¦bË–F¢fWžB(€€€€€€ƒ¾ò#¢š[ž
èÃ¦î{š*¢÷¦î{¾ò3–£¦£š*¢÷¦÷’â7¢÷–¶à¿–6¾ò'Ž(€€€€¨¼((€€€½¹ÍÐÍ­¥±±=Ý¹•Èô(€€€€€€€•ÑM­¥±±¡…É…Ñ•É=‰©•Ð (€€€€€€€€€€€ÕÉÉ•¹ÑM­¥±±¡…É…Ñ•È(€€€€€€€€¤ì(((€€€½¹ÍÐ…Ù…¥±…‰±•M­¥±±A½¥¹ÑÌõ5…Ñ ¹µ…à (€€€€€€€€À°(€€€€€€€9Õµ‰•È¡Í­¥±±=Ý¹•È€üÍ­¥±±=Ý¹•È¹Í­¥±±A½¥¹ÑÌ€è€À¥ñðÀ(€€€€¤ì(((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3Ž3š*¢÷š:Kž& (€€€€€€ƒ–Š{–*ƒ–ÞË–¶ãžþH¿šr«–¶ãžþKžjšZ–¶_–"¦jS–6–†+¾ò0(€€€€€€ƒ’â7žR£š†žÞk¾ò3–>«¢ššZ–¶_–6¦jS¾òošr«–¶ãžþKžj(€€€€€€ƒš*¢÷’âš^›–¶ãšr¾ò3¢«–.W¢ÞG–"Ã–ÞË–¶ãžþK¦
¦
+Ž7¾ò'¾òh(€€€€€€ƒ–:šr³šb¿–Z»’â–-™½É…£Ž’úw¢ÎšZg–ê¯–:–ž,(€€€€€€ƒ¦‚–ê?žnÓš:—š*+š¾?’â–"]…ÁÁ•¹“’â+–:ïŽšRçš"C– (€€€€€€ƒž¾§–ë¦g–/¢žK¢&Ë–žÒƒ–êW’â/žj–£¦£š*¢õ¥“¾ò0(€€€€€€ƒ–"š"CŽ3–ÞË–¶ãžþKŽ7Ž3šr«–¶ãžþKŽ7–§žÖ¦f–"_¾ò0(€€€€€€ƒ–/–"—šâËš~OŽ–nƒž
ëš¾?š²…É•¹‘•ÉM­¥±±1½…‘½ÕÐ ¤(€€€€€€ƒ¦÷šb¿¦7šZÃ–"žÖ¾ò#’â7šb¿–¶c’â’î÷Ž3–ÞË–¶ãžþH(€€€€€€ƒšâ–Z»Ž7–þ¯–>[¾ò'¾ò3–>«¢š–¶ã’êšZÃš*¢÷Ž(€€€€€€Í­¥±±1•Ù•±Ï¢º+’ê¾ò3’â/š²‡¦7žæ«–ÂÇšr¢«–.T(€€€€€€ƒ¢Š¯–"–"ÃŽ3–ÞË–¶ãžþKŽ7¦
žÖ¾ò3’â7žR£¦†7–’[–¾¬(€€€€€€ƒŽ3šB³žžïŽ7žj¦
?¢ò¿Ž(€€€€¨¼((€€€½¹ÍÐµ…Ñ¡¥¹M­¥±±%‘Ìô((€€€€€€€=‰©•Ð¹­•åÌ¡Í­¥±±…Ñ…‰…Í”¤(€€€€€€€€¹™¥±Ñ•È¡Í­¥±±%ôùì((€€€€€€€€€€€½¹ÍÐÍ­¥±°ô(€€€€€€€€€€€€€€€Í­¥±±…Ñ…‰…Í•mÍ­¥±±%‘tì(((€€€€€€€€€€€É•ÑÕÉ¸€„„ (€€€€€€€€€€€€€€€Í­¥±°€˜˜Í­¥±°¹•±•µ•¹Ð€˜˜(€€€€€€€€€€€€€€€=‰©•Ð¹ÁÉ½Ñ½ÑåÁ”¹¡…Í=Ý¹AÉ½Á•ÉÑä¹…±°¡Í­¥±°°‰±•…É¹1•Ù•°ˆ¤€˜˜(€€€€€€€€€€€€€€€Í­¥±°¹…Ñ•½Éä„ôô‰µ½¹ÍÑ•Èˆ(€€€€€€€€€€€€¤ì((€€€€€€€ô¤ì(((€€€½¹ÍÐ±•…É¹•‘%‘Ìô((€€€€€€€µ…Ñ¡¥¹M­¥±±%‘Ì¹™¥±Ñ•È (€€€€€€€€€€€Í­¥±±%ôø(€€€€€€€€€€€€€€€€¡Í­¥±±1•Ù•±ÍmÍ­¥±±%‘uñðÀ¤øÀ(€€€€€€€€¤ì(((€€€½¹ÍÐÕ¹±•…É¹•‘%‘Ìô((€€€€€€€µ…Ñ¡¥¹M­¥±±%‘Ì¹™¥±Ñ•È (€€€€€€€€€€€Í­¥±±%ôø(€€€€€€€€€€€€€€€€„¡Í­¥±±1•Ù•±ÍmÍ­¥±±%‘tøÀ¤(€€€€€€€€¤ì(((€€€€¼¨(€€€€€€ƒŠbƒš*+Ž3žÖ–ë’â–"_š*¢õÉ½ßŽ7¦gšº×¦
?¢ò¿š*÷š"@(€€€€€€ƒž6£ž®/–÷–ò?¾ò3–ÞË–¶ãžþH¿šr«–¶ãžþK–§žÖ¦÷–Fó–>¬(€€€€€€ƒ–B3’â’î÷¾ò3’â7žR£–¾¯–§š²‡’âš¢žj!Q53žÖ–¶_’âËŽ(€€€€¨¼((€€€™Õ¹Ñ¥½¸‰Õ¥±‘M­¥±±I½Ý±•µ•¹Ð¡Í­¥±±%¥ì((€€€€€€€½¹ÍÐÍ­¥±°€ô(€€€€€€€€€€€Í­¥±±…Ñ…‰…Í•mÍ­¥±±%‘tì(((€€€€€€€½¹ÍÐ±•Ù•°€ô(€€€€€€€€€€€Í­¥±±1•Ù•±ÍmÍ­¥±±%‘uñð(€€€€€€€€€€€€Àì(((€€€€€€€½¹ÍÐ¥Í1•…É¹•€ô(€€€€€€€€€€€±•Ù•°øÀì(((€€€€€€€½¹ÍÐ•ÅÕ¥ÁÁ•€ô(€€€€€€€€€€€¡…É…Ñ•È¹•ÅÕ¥ÁÁ•‘M­¥±±Ì(€€€€€€€€€€€€¹¥¹±Õ‘•Ì¡Í­¥±±%¤ì(((€€€€€€€½¹ÍÐ¥Í5…á1•Ù•°€ô(€€€€€€€€€€€¥Í1•…É¹•€˜˜(€€€€€€€€€€€±•Ù•°øô(€€€€€€€€€€€€¡Í­¥±°¹µ…á1•Ù•±ñðÄ¤ì(((€€€€€€€½¹ÍÐ…¹™™½É€ô(€€€€€€€€€€€…Ù…¥±…‰±•M­¥±±A½¥¹ÑÌøô(€€€€€€€€€€€€¡Í­¥±°¹±•…É¹½ÍÑñðÀ¤ì(((€€€€€€€½¹ÍÐ‰½à€ô(€€€€€€€€€€€‘½Õµ•¹Ð¹É•…Ñ•±•µ•¹Ð (€€€€€€€€€€€€€€€€‰‘¥Øˆ(€€€€€€€€€€€€¤ì(((€€€€€€€‰½à¹±…ÍÍ9…µ”€ô(€€€€€€€€€€€€‰Í­¥±°µÉ½Üˆì(((€€€€€€€±•Ð…Ñ¥½¹%½¸ì(€€€€€€€±•Ð…Ñ¥½¹1…‰•°ì(€€€€€€€±•Ð…Ñ¥½¹=¹±¥¬ì(€€€€€€€±•Ð…Ñ¥½¹¥Í…‰±•ì(((€€€€€€€½¹ÍÐÁÉ•É•Å5•Ð€ô(€€€€€€€€€€€¥ÍM­¥±±AÉ•É•Å5•Ð (€€€€€€€€€€€€€€€Í­¥±±1•Ù•±Ì°(€€€€€€€€€€€€€€€Í­¥±°(€€€€€€€€€€€€¤ì(((€€€€€€€¥˜ …¥Í1•…É¹•¥ì((€€€€€€€€€€€…Ñ¥½¹%½¸ôˆˆì(((€€€€€€€€€€€€¼¨(€€€€€€€€€€€€€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3Ž3–&7žö¸(€€€€€€€€€€€€€€ƒš*¢÷¢š–¶ãžjš¦–"ÛŽ7¾ò3’âS¢šŽ3–º3–£’â7¢ô(€€€€€€€€€€€€€€ƒ¦î{Ž7¾ò'¾òh(€€€€€€€€€€€€€€ƒ–&7žö»šÊK¦Sš"Cšf–«–#¦†¿ž’ë¦:[’ö?ž.š/¾ò0(€€€€€€€€€€€€€€ƒ¢N/¦;–:šr³žjŽ3–¶ãžþK¾ò?¦î{šVã’â7¢ÚÏŽ4(€€€€€€€€€€€€€€ƒ–"“šZß¾ò3š2'¦"W–òß–"Ù‘¥Í…‰±•õÑÉÕ—¾ò0(€€€€€€€€€€€€€€ƒž:§–ºÛ¦¦î{¦÷¦î{’â7’ê¾ò!Í•—’â+¦vˆ(€€€€€€€€€€€€€€€¹Í­¥±°µ…Ñ¥½¸µ…É¹‘¥Í…‰±•“žj(€€€€€€€€€€€€€€Á½¥¹Ñ•Èµ•Ù•¹ÑÌé¹½¹—¾ò3’æ/–&7¦g¢Ž„(€€€€€€€€€€€€€€ƒšr'–-±…ÍÏ–¶_’âË–ÂGš&O’â–/ž¦ëš‚óžj(€€€€€€€€€€€€€€‰ÕŸ¾ò3¦‚’úÿ’þ»š:'¾ò3’â7žÙ‘¥Í…‰±•(€€€€€€€€€€€€€€ƒš¢–ò?–Û–¾›–ú{’úšÊKžržjžRšV#¦;¾ò'Ž(€€€€€€€€€€€€¨¼((€€€€€€€€€€€…Ñ¥½¹1…‰•°ô(€€€€€€€€€€€€€€€€…ÁÉ•É•Å5•Ð(€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€€‹Â~RH€ˆ­•ÑM­¥±±AÉ•É•Å1…‰•°¡Í­¥±°¤(€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€€ (€€€€€€€€€€€€€€€€€€€…¹™™½É(€€€€€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€€€€€€‹–¶ãžþHˆ(€€€€€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€€€€€€‹¦î{šVã’â7¢ÚÌˆ(€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€…Ñ¥½¹=¹±¥¬ô(€€€€€€€€€€€€€€€€‰±•…É¹M­¥±° œˆ­Í­¥±±%¬ˆœ¤ˆì((€€€€€€€€€€€…Ñ¥½¹¥Í…‰±•ô(€€€€€€€€€€€€€€€€…ÁÉ•É•Å5•Ðñð(€€€€€€€€€€€€€€€€……¹™™½Éì((€€€€€€€ô(€€€€€€€•±Í”¥˜¡¥Í5…á1•Ù•°¥ì((€€€€€€€€€€€…Ñ¥½¹%½¸ôˆˆì(€€€€€€€€€€€…Ñ¥½¹1…‰•°ô‹–ÞËšîÿžÒhˆì((€€€€€€€€€€€…Ñ¥½¹=¹±¥¬ô(€€€€€€€€€€€€€€€€‰ÕÁÉ…‘•M­¥±° œˆ­Í­¥±±%¬ˆœ¤ˆì((€€€€€€€€€€€…Ñ¥½¹¥Í…‰±•ô(€€€€€€€€€€€€€€€ÑÉÕ”ì((€€€€€€€ô(€€€€€€€•±Í•ì((€€€€€€€€€€€…Ñ¥½¹%½¸ôˆˆì((€€€€€€€€€€€…Ñ¥½¹1…‰•°ô(€€€€€€€€€€€€€€€…Ù…¥±…‰±•M­¥±±A½¥¹ÑÌðÄ(€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€€‹¦î{šVã’â7¢ÚÌˆ(€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€€‹–6žÒhˆì((€€€€€€€€€€€…Ñ¥½¹=¹±¥¬ô(€€€€€€€€€€€€€€€€‰ÕÁÉ…‘•M­¥±° œˆ­Í­¥±±%¬ˆœ¤ˆì((€€€€€€€€€€€…Ñ¥½¹¥Í…‰±•ô(€€€€€€€€€€€€€€€…Ù…¥±…‰±•M­¥±±A½¥¹ÑÌðÄì((€€€€€€€ô(((€€€€€€€½¹ÍÐÍ¡½ÝÅÕ¥Á	ÕÑÑ½¸ô((€€€€€€€€€€€¥Í1•…É¹•€˜˜(€€€€€€€€€€€€ (€€€€€€€€€€€€€€€Í­¥±°¹…Ñ•½Éäôôô‰Á¡åÍ¥…°‰ñð(€€€€€€€€€€€€€€€Í­¥±°¹…Ñ•½Éäôôô‰µ…¥Œ‰ñð(€€€€€€€€€€€€€€€Í­¥±°¹…Ñ•½Éäôôô‰‰Õ™˜‰ñð(€€€€€€€€€€€€€€€Í­¥±°¹…Ñ•½Éäôôô‰¡•…°‰ñð(€€€€€€€€€€€€€€€Í­¥±°¹…Ñ•½Éäôôô‰É•Ù¥Ù”ˆ(€€€€€€€€€€€€¤ì(((€€€€€€€‰½à¹¥¹¹•É!Q50€ô((€€€€€€€€(€€€€€€€€ñ‘¥Ø(€€€€€€€€€€€¥ô‰Í­¥±±%½¹|‘íÍ­¥±±%‘ôˆ(€€€€€€€€€€€±…ÍÌô‰Í­¥±°µÉ½Üµ¥½¸ˆ(€€€€€€€€€€€ÍÑå±”ô‰‰…­É½Õ¹µ¥µ…”è‘í•ÑM­¥±±%½¹	…­É½Õ¹‘%µ…”¡Í­¥±±%¥ôìˆ(€€€€€€€€øð½‘¥Øø((€€€€€€€€ñ‘¥Ø±…ÍÌô‰Í­¥±°µÉ½ÜµÑ•áÐˆø(€€€€€€€€€€€€ñˆø‘íÍ­¥±°¹¹…µ•ôð½ˆø(€€€€€€€€€€€€‘ì(€€€€€€€€€€€€€€€¥Í1•…É¹•(€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€€‰1Ø¸ˆ­±•Ù•°¬(€€€€€€€€€€€€€€€€ (€€€€€€€€€€€€€€€€€€€Í­¥±°¹µ…á1•Ù•°(€€€€€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€€€€€€ˆ¼ˆ­Í­¥±°¹µ…á1•Ù•°(€€€€€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€€œñÍÁ…¸ÍÑå±”ô‰½±½ÈèŒØÐÜÐáˆìˆûšr«–¶ãžþHð½ÍÁ…¸øœ(€€€€€€€€€€€ô(€€€€€€€€€€€€ñ‰Èø(€€€€€€€€€€€€ñÍÁ…¸±…ÍÌô‰Í­¥±°µÉ½Üµ‘•ÍŒˆø(€€€€€€€€€€€€€€€€‘íÍ­¥±°¹‘•ÍÉ¥ÁÑ¥½¹ô(€€€€€€€€€€€€ð½ÍÁ…¸ø(€€€€€€€€€€€€‘ì(€€€€€€€€€€€€€€€€…¥Í1•…É¹•€˜˜(€€€€€€€€€€€€€€€€…ÁÉ•É•Å5•Ð(€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€€(€€€€€€€€€€€€€€€€ñ‰Èø(€€€€€€€€€€€€€€€€ñÍÁ…¸ÍÑå±”ô‰½±½Èè˜Ôå”Áˆìˆø(€€€€€€€€€€€€€€€€€€€ƒÂ~RH€‘í•ÑM­¥±±AÉ•É•Å1…‰•°¡Í­¥±°¥ô(€€€€€€€€€€€€€€€€ð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€(€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€ô(€€€€€€€€€€€€ñÍÁ…¸(€€€€€€€€€€€€€€€±…ÍÌô‰Í­¥±°µÉ½Üµ‘•Ñ…¥°µ±¥¹¬ˆ(€€€€€€€€€€€€€€€½¹±¥¬ô‰Í¡½ÝM­¥±±•Ñ…¥° œ‘íÍ­¥±±%‘ôœ¤ˆ(€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€ƒŠ›Š›¢¦ÏžÒÃ
ì(€€€€€€€€€€€€ð½ÍÁ…¸ø(€€€€€€€€ð½‘¥Øø((€€€€€€€€ñ‘¥Ø(€€€€€€€€€€€±…ÍÌô‰Í­¥±°µ…Ñ¥½¸µ…É‘ì(€€€€€€€€€€€€€€€…Ñ¥½¹¥Í…‰±•(€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€€ˆ‘¥Í…‰±•ˆ(€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€ôˆ(€€€€€€€€€€€½¹±¥¬ôˆ‘í…Ñ¥½¹=¹±¥­ôˆ(€€€€€€€€ø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÌô‰Í­¥±°µ…Ñ¥½¸µ…ÉµÑ½Àˆø‘í…Ñ¥½¹%½¹ôð½‘¥Øø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÌô‰Í­¥±°µ…Ñ¥½¸µ…Éµ±…‰•°ˆø(€€€€€€€€€€€€€€€€‘í…Ñ¥½¹1…‰•±ô(€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€ð½‘¥Øø((€€€€€€€€‘ì(€€€€€€€€€€€Í¡½ÝÅÕ¥Á	ÕÑÑ½¸(€€€€€€€€€€€€ü(€€€€€€€€€€€€(€€€€€€€€€€€€ñ‘¥Ø(€€€€€€€€€€€€€€€±…ÍÌô‰Í­¥±°µ…Ñ¥½¸µ…É‘ì(€€€€€€€€€€€€€€€€€€€•ÅÕ¥ÁÁ•(€€€€€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€€€€€€ˆ‘¥Í…‰±•ˆ(€€€€€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€€€€ôˆ(€€€€€€€€€€€€€€€½¹±¥¬ô‰•ÅÕ¥ÁM­¥±° œ‘íÍ­¥±±%‘ôœ¤ˆ(€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÌô‰Í­¥±°µ…Ñ¥½¸µ…ÉµÑ½Àˆøð½‘¥Øø(€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÌô‰Í­¥±°µ…Ñ¥½¸µ…Éµ±…‰•°ˆø(€€€€€€€€€€€€€€€€€€€€‘ì(€€€€€€€€€€€€€€€€€€€€€€€•ÅÕ¥ÁÁ•(€€€€€€€€€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€€€€€€€€€€‹–ÞË¢Žw–
dˆ(€€€€€€€€€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€€€€€€€€€€‹¢Žw–
dˆ(€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€(€€€€€€€€€€€€è(€€€€€€€€€€€€ˆˆ(€€€€€€€ô(€€€€€€€€ì(((€€€€€€€É•ÑÕÉ¸‰½àì((€€€ô(((€€€€¼¨(€€€€€€ƒŠbƒ–"¦jSžÞkžR£žjžÒSšZ–¶_š¢gžÆ“¾ò3šVš?’â7žR (€€€€€€ƒ’îï’öWš†žÞh¿–êW¢&Ë¾ò3–>«šb¿’â¢†3žö»’â·žj(€€€€€€ƒ¢fožÞh¯šZ–¶_¾ò3–Z»žÒS¢š[¢šë’â+–6¦jS–§žÖŽ(€€€€¨¼((€€€™Õ¹Ñ¥½¸‰Õ¥±‘M­¥±±M•Ñ¥½¹¥Ù¥‘•È¡±…‰•°¥ì((€€€€€€€½¹ÍÐ‘¥Ù¥‘•Èô(€€€€€€€€€€€‘½Õµ•¹Ð¹É•…Ñ•±•µ•¹Ð (€€€€€€€€€€€€€€€€‰‘¥Øˆ(€€€€€€€€€€€€¤ì(((€€€€€€€‘¥Ù¥‘•È¹ÍÑå±”¹ÍÍQ•áÐô((€€€€€€€€€€€€‰Ñ•áÐµ…±¥¸é•¹Ñ•Èìˆ¬(€€€€€€€€€€€€‰™½¹ÐµÍ¥é”èÄÅÁàìˆ¬(€€€€€€€€€€€€‰½±½ÈèŒá„Ý„ÕŒìˆ¬(€€€€€€€€€€€€‰µ…É¥¸èÄÁÁà€À€ÑÁàìˆì(((€€€€€€€‘¥Ù¥‘•È¹Ñ•áÑ½¹Ñ•¹Ðô((€€€€€€€€€€€€‹ŠRŠRŠRŠRŠR ˆ¬(€€€€€€€€€€€±…‰•°¬(€€€€€€€€€€€€‹ŠRŠRŠRŠRŠR ˆì(((€€€€€€€É•ÑÕÉ¸‘¥Ù¥‘•Èì((€€€ô(((€€€¥˜¡±•…É¹•‘%‘Ì¹±•¹Ñ øÀ¥ì((€€€€€€€…±±1¥ÍÐ¹…ÁÁ•¹‘¡¥± (€€€€€€€€€€€‰Õ¥±‘M­¥±±M•Ñ¥½¹¥Ù¥‘•È (€€€€€€€€€€€€€€€€‹–ÞË–¶ãžþHˆ(€€€€€€€€€€€€¤(€€€€€€€€¤ì(((€€€€€€€±•…É¹•‘%‘Ì¹™½É… ¡Í­¥±±%ôùì((€€€€€€€€€€€…±±1¥ÍÐ¹…ÁÁ•¹‘¡¥± (€€€€€€€€€€€€€€€‰Õ¥±‘M­¥±±I½Ý±•µ•¹Ð (€€€€€€€€€€€€€€€€€€€Í­¥±±%(€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€¤ì((€€€€€€€ô¤ì((€€€ô(((€€€¥˜¡Õ¹±•…É¹•‘%‘Ì¹±•¹Ñ øÀ¥ì((€€€€€€€…±±1¥ÍÐ¹…ÁÁ•¹‘¡¥± (€€€€€€€€€€€‰Õ¥±‘M­¥±±M•Ñ¥½¹¥Ù¥‘•È (€€€€€€€€€€€€€€€€‹šr«–¶ãžþHˆ(€€€€€€€€€€€€¤(€€€€€€€€¤ì(((€€€€€€€Õ¹±•…É¹•‘%‘Ì¹™½É… ¡Í­¥±±%ôùì((€€€€€€€€€€€…±±1¥ÍÐ¹…ÁÁ•¹‘¡¥± (€€€€€€€€€€€€€€€‰Õ¥±‘M­¥±±I½Ý±•µ•¹Ð (€€€€€€€€€€€€€€€€€€€Í­¥±±%(€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€¤ì((€€€€€€€ô¤ì((€€€ô(((€€€€¼¨(€€€€€€ƒŠbƒš¾?š²‡¦7šZÃšâËš~Oš*¢÷¦‚¦v‹šf¾ò0(€€€€€€ƒ¦‚’úÿ–B3š¶—’âš²‡¢«–.Wš"Ã¦²—žjš*¢÷’â/š.'¦ã–Z»¾ò0(€€€€€€ƒ¦gš¢¢Žw–
g¢º+’êŽ–¶ãšZÃš*¢÷’ê¾ò0(€€€€€€ƒ¦ã–Z»¦÷šr¢«–.W¢Þ’â+¾ò3’â7žR£š¾?–/–Fó–>­É•¹‘•ÉM­¥±±1½…‘½ÕÐ ¤(€€€€€€ƒžj–rÃšZç¦÷–B¢«¢¢c–ú_–7–Fó–>¯’âš²‡Ž(€€€€¨¼(€€€Á½ÁÕ±…Ñ•ÕÑ½M­¥±±=ÁÑ¥½¹Ì ¤ì((€€€Á½ÁÕ±…Ñ•ÕÑ½M­¥±±=ÁÑ¥½¹ÌÈ ¤ì()ô((¼¨(€€ƒžÖ–ëš*¢÷žn»–&7ž¶'žÒkžjšV#šzsšZ–¶_¢ª«šb;¾ò0(€€ƒžR£–r£š*¢÷¦7¢Žw¦‚¦v‹žÖ›ž:§–ºÛ–>¢Ž(¨¼((¼¨(€€ƒŠbƒš*¢÷–"¦†{š¢gžÆ“¾ò#šZÃ–Š{¾ò'¾òh(€€ƒž&§žB’âï–.W¾ò?šÎW¢†O’âï–.W¾ò?–Š{žn+’âï–.W¾ò?¢Š¯–.W¾ò0(€€ƒžÖÇ’â–ú{¦g¢Ž‡žR‹žRšZ–¶_¾ò0(€€ƒš*¢÷¦7¢Žwš²Ž–ÞË–¶ãš*¢÷Ž–>¿–¶ãš*¢÷’â'–/–rÃšZç¦÷–ÇžR£¾ò0(€€ƒžŠë’þw¦†¿ž’ëšZç–ò?’â¢ÓŽ(¨¼()™Õ¹Ñ¥½¸•ÑM­¥±±…Ñ•½Éå1…‰•°¡…Ñ•½Éä¥ì((€€€¥˜¡…Ñ•½Éäôôô‰Á¡åÍ¥…°ˆ¥ì(€€€€€€€É•ÑÕÉ¸‹ž&§žB’âï–.Tˆì(€€€ô((€€€¥˜¡…Ñ•½Éäôôô‰µ…¥Œˆ¥ì(€€€€€€€É•ÑÕÉ¸‹šÎW¢†O’âï–.Tˆì(€€€ô((€€€¥˜¡…Ñ•½Éäôôô‰‰Õ™˜ˆ¥ì(€€€€€€€É•ÑÕÉ¸‹–Š{žn+’âï–.Tˆì(€€€ô((€€€¥˜¡…Ñ•½Éäôôô‰¡•…°ˆ¥ì(€€€€€€€É•ÑÕÉ¸‹šÊïžf’âï–.Tˆì(€€€ô((€€€¥˜¡…Ñ•½Éäôôô‰É•Ù¥Ù”ˆ¥ì(€€€€€€€É•ÑÕÉ¸‹–ú§šÒï’âï–.Tˆì(€€€ô((€€€¥˜¡…Ñ•½Éäôôô‰Á…ÍÍ¥Ù”ˆ¥ì(€€€€€€€É•ÑÕÉ¸‹¢Š¯–.Tˆì(€€€ô((€€€É•ÑÕÉ¸ˆˆì()ô(()™Õ¹Ñ¥½¸•ÑM­¥±±™™•ÑAÉ•Ù¥•ÝQ•áÐ¡Í­¥±°±±•Ù•°¥ì((€€€€¼¨(€€€€€€ƒŠbƒžÒSš:Ÿ–‚Óš*¢÷¾ò#žn»–&7šb¿–Ã–Â¾ò3šÊKšr%‰…Í•…µ…—¾ò$(€€€€€€ƒ¢š–r£Ž3šr'–
ß–ºÏžjž&§žB¿šÎW¢†Oš*¢÷Ž7–"“šZß’æ/–&4(€€€€€€ƒ–#šRSš"«¢fWžB¾ò3’â7žÛšr¢Š¯’â/¦v‹¦
–/–"“šZÜ(€€€€€€ƒ¢ª“–"“š"CŽ3–
ß–ºÌÃŽ7žjšRïšN+š*¢÷¾ò0(€€€€€€ƒ¦†¿ž’ë–ëŽ3žn»–&7–
ß–ºÏžÒÃŽ7¦gž¢»¢ª“–Â;šZ–¶_Ž(€€€€¨¼((€€€¥˜ (€€€€€€€€ (€€€€€€€€€€€Í­¥±°¹…Ñ•½Éäôôô‰Á¡åÍ¥…°‰ñð(€€€€€€€€€€€Í­¥±°¹…Ñ•½Éäôôô‰µ…¥Œˆ(€€€€€€€€¤€˜˜(€€€€€€€€…Í­¥±°¹‰…Í•…µ…”€˜˜(€€€€€€€Í­¥±°¹™É••é•¡…¹”(€€€€¥ì((€€€€€€€É•ÑÕÉ¸€ (€€€€€€€€€€€Í­¥±°¹™É••é•¡…¹”¬(€€€€€€€€€€€€ˆ—š¦ž:–Ã–Âžn»š¢g¾ò0ˆ¬(€€€€€€€€€€€Í­¥±°¹™É••é•ÕÉ…Ñ¥½¸¬(€€€€€€€€€€€€‹–n{–B#ž‡šÎW¢†3–.Tˆ(€€€€€€€€¤ì((€€€ô(((€€€¥˜ (€€€€€€€Í­¥±°¹…Ñ•½Éäôôô‰Á¡åÍ¥…°‰ñð(€€€€€€€Í­¥±°¹…Ñ•½Éäôôô‰µ…¥Œˆ(€€€€¥ì((€€€€€€€€¼¨(€€€€€€€€€€ƒŠbƒ’þ»š¶¾òh(€€€€€€€€€€ƒ¦g¢Ž‡’æ/–&7–>«¦†¿ž’ëš*¢÷–~ëž’;–
ß–ºÏ¾ò0(€€€€€€€€€€ƒ–º3–£šÊKšr'žº_¦Ëž¯–žÒc¢Š¯–.Wžj¬ÄÀ—–*ƒš"C¾ò0(€€€€€€€€€€ƒ–Â;¢Óž:§–ºÛ–¶ã’ê¢Š¯–.W’æ/–ú3¾ò0(€€€€€€€€€€ƒ–r£¦g–/¦‚C¢š÷šVã–¶_’â+–º3–£žr/’â7–ë–Þ»žVÃ¾ò0(€€€€€€€€€€ƒ’î—ž
ë¢Š¯–.WšÊKšr'žRšV (€€€€€€€€€€ƒ¾ò#–¾›¦jo’â+š"Ã¦²—šf	…ÍÑ…µ…•M­¥±° §¢Ž„(€€€€€€€€€€ƒšr'š¶žŠë––_žR£¾ò3–>«šb¿¦g–/¦‚C¢š÷šVã–¶_šÊK¢Þ’â+¾ò'Ž(€€€€€€€€€€ƒž>û–r£¢Žs’â+¾ò3¢ºOž:§–ºÛ¢÷žnÓš:—–r£¦g¢Ž„(€€€€€€€€€€ƒžr/–"Ã–¶ã¢Š¯–.W–&7–ú3šVã–¶_žj¢º+–2[Ž(€€€€€€€€¨¼((€€€€€€€€¼¨(€€€€€€€€€€ƒŠbƒ’þ»š¶¾òh(€€€€€€€€€€ƒ¦g¢Ž‡’æ/–&7–>«¦†¿ž’ëš*¢÷–~ëž’;–
ß–ºÏ¾ò0(€€€€€€€€€€ƒ–º3–£šÊKšr'žº_¦Ë–žÒc¢Š¯–.Wžj–*ƒš"C¾ò0(€€€€€€€€€€ƒ–Â;¢Óž:§–ºÛ–¶ã’ê¢Š¯–.W’æ/–ú3¾ò0(€€€€€€€€€€ƒ–r£¦g–/¦‚C¢š÷šVã–¶_’â+–º3–£žr/’â7–ë–Þ»žVÃ¾ò0(€€€€€€€€€€ƒ’î—ž
ë¢Š¯–.WšÊKšr'žRšV (€€€€€€€€€€ƒ¾ò#–¾›¦jo’â+š"Ã¦²—šf	…ÍÑ…µ…•M­¥±° §¢Ž„(€€€€€€€€€€ƒšr'š¶žŠë––_žR£¾ò3–>«šb¿¦g–/¦‚C¢š÷šVã–¶_šÊK¢Þ’â+¾ò'Ž(€€€€€€€€€€ƒž>û–r£¢Žs’â+¾ò3¢ºOž:§–ºÛ¢÷žnÓš:—–r£¦g¢Ž„(€€€€€€€€€€ƒžr/–"Ã–¶ã¢Š¯–.W–&7–ú3šVã–¶_žj¢º+–2[Ž(€€€€€€€€€€ƒ¢Þ}…ÍÑ…µ…•M­¥±° §’âš¢¾ò0(€€€€€€€€€€ƒšRçš"C–.Wš/žR£Ž3–žÒ€­cŽ7š~—¢†£¾ò0(€€€€€€€€€€ƒšÂÓ–žÒc’æ¢÷š¶žŠë–>7šbƒ–r£¦g¢Ž‡Ž(€€€€€€€€¨¼((€€€€€€€½¹ÍÐ•áM­¥±±%€ô(€€€€€€€€€€€Í­¥±°¹•±•µ•¹Ð¬(€€€€€€€€€€€€‰`ˆì(((€€€€€€€½¹ÍÐ•áM­¥±°€ô(€€€€€€€€€€€Í­¥±±…Ñ…‰…Í•m•áM­¥±±%‘tì(((€€€€€€€€¼¨(€€€€€€€€€€ƒŠbƒ’þ»š¶¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3Ž3–žÒ€(€€€€€€€€€€ƒ¢Š¯–.W–º3–£šÊKžRšV#Ž7¾ò3¦g–/¦‚C¢š÷šVã–¶\(€€€€€€€€€€ƒ¢Þ}…ÍÑ…µ…•M­¥±° §ž*¿’ê–B3’â–,(€€€€€€€€€€‰ÕŸ¾ò'¾òh(€€€€€€€€€€ƒ’â7¢÷žR¡Í­¥±°¹•±•µ•¹ÓžVÛ¢žK¢&Ëš²’ö4(€€€€€€€€€€­•ç¾ò3¦g¢Ž‡šRçžR¡ÕÉÉ•¹ÑM­¥±±¡…É…Ñ•È(€€€€€€€€€€ƒ¾ò#žn»–&7žV¯¦v‹’â+¦†¿ž’ëžjšb¿–N«–/¢žK¢&Ëžj(€€€€€€€€€€ƒš*¢÷–"_¢†£¾ò0‰™¥É”‹š"X‰Á±…å•ÈÈ‹¾ò'¾ò0(€€€€€€€€€€ƒ¢Þž:§–ºÛ–¾›¦jo–r£žr/¢ªÃžjš*¢÷’þwš2’â¢ÓŽ(€€€€€€€€¨¼((€€€€€€€½¹ÍÐ•á1•Ù•°€ô(€€€€€€€€€€€•ÑM­¥±±1•Ù•° (€€€€€€€€€€€€€€€ÕÉÉ•¹ÑM­¥±±¡…É…Ñ•È°(€€€€€€€€€€€€€€€•áM­¥±±%(€€€€€€€€€€€€¤ì((((€€€€€€€½¹ÍÐÁ…ÍÍ¥Ù•5Õ±Ñ¥Á±¥•È€ô(€€€€€€€€€€€€ (€€€€€€€€€€€€€€€•áM­¥±°€˜˜(€€€€€€€€€€€€€€€•á1•Ù•°øÀ€˜˜(€€€€€€€€€€€€€€€•áM­¥±°¹‘…µ…•	½¹ÕÍA•É•¹Ð(€€€€€€€€€€€€¤(€€€€€€€€€€€€ü(€€€€€€€€€€€€Ä¬(€€€€€€€€€€€•áM­¥±°¹‘…µ…•	½¹ÕÍA•É•¹Ð¼(€€€€€€€€€€€€ÄÀÀ(€€€€€€€€€€€€è(€€€€€€€€€€€€Äì(((€€€€€€€½¹ÍÐÁÉ•Ù¥•Ý…µ…”€ô(€€€€€€€€€€€5…Ñ ¹™±½½È (€€€€€€€€€€€€€€€•ÑM­¥±±…µ…•Ñ1•Ù•° (€€€€€€€€€€€€€€€€€€€Í­¥±°°(€€€€€€€€€€€€€€€€€€€±•Ù•°(€€€€€€€€€€€€€€€€¤¨(€€€€€€€€€€€€€€€Á…ÍÍ¥Ù•5Õ±Ñ¥Á±¥•È(€€€€€€€€€€€€¤ì(((€€€€€€€±•ÐÑ•áÐ€ô(€€€€€€€€€€€€‹žn»–&7–
ß–ºÏžÒˆ¬(€€€€€€€€€€€ÁÉ•Ù¥•Ý…µ…”¬(€€€€€€€€€€€€ (€€€€€€€€€€€€€€€Á…ÍÍ¥Ù•5Õ±Ñ¥Á±¥•ÈøÄ(€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€€‹¾ò#–ÞË–B¬ˆ¬(€€€€€€€€€€€€€€€€ (€€€€€€€€€€€€€€€€€€€•áM­¥±°(€€€€€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€€€€€•áM­¥±°¹¹…µ”(€€€€€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€€€€€¤¬(€€€€€€€€€€€€€€€€‹–*ƒš"C¾ò$ˆ(€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€¤ì(((€€€€€€€¥˜¡Í­¥±°¹‰ÕÉ¹¡…¹”¥ì((€€€€€€€€€€€Ñ•áÐ¬ô((€€€€€€€€€€€€€€€€‹¾öpˆ¬(€€€€€€€€€€€€€€€Í­¥±°¹‰ÕÉ¹¡…¹”¬(€€€€€€€€€€€€€€€€ˆ—žžK¾ò ˆ¬(€€€€€€€€€€€€€€€Í­¥±°¹‰ÕÉ¹A•É•¹Ñ	å1•Ù•±l(€€€€€€€€€€€€€€€€€€€±•Ù•°´Ä(€€€€€€€€€€€€€€€t¬(€€€€€€€€€€€€€€€€ˆ—šr–’!C¾ò?–n{–B#¾ò$ˆì((€€€€€€€ô(((€€€€€€€¥˜¡Í­¥±°¹™É••é•¡…¹”¥ì((€€€€€€€€€€€Ñ•áÐ¬ô((€€€€€€€€€€€€€€€€‹¾öpˆ¬(€€€€€€€€€€€€€€€Í­¥±°¹™É••é•¡…¹”¬(€€€€€€€€€€€€€€€€ˆ—–Ã–Â¾ò ˆ¬(€€€€€€€€€€€€€€€Í­¥±°¹™É••é•ÕÉ…Ñ¥½¸¬(€€€€€€€€€€€€€€€€‹–n{–B#ž‡šÎW¢†3–.W¾ò$ˆì((€€€€€€€ô(((€€€€€€€¥˜¡Í­¥±°¹±¥™•ÍÑ•…±A•É•¹Ñ	å1•Ù•°¥ì(€€€€€€€€€€€Ñ•áÐ¬ô‹¾ös–Bã–>Xˆ­Í­¥±°¹±¥™•ÍÑ•…±A•É•¹Ñ	å1•Ù•±m±•Ù•°´Åt¬ˆ—–
ß–ºÏ¾ò#–n{–ú¥!@½MC¾ò$ˆì(€€€€€€€ô(€€€€€€€¥˜¡Í­¥±°¹…¥±¥Ñå½Ý¹	å1•Ù•°¥ì(€€€€€€€€€€€Ñ•áÐ¬ô‹¾öpˆ­Í­¥±°¹…¥±¥Ñå½Ý¹¡…¹”¬ˆ—¦f7šV<ˆ­Í­¥±°¹…¥±¥Ñå½Ý¹	å1•Ù•±m±•Ù•°´Åt¬ˆ—¾ò ˆ¬¡Í­¥±°¹…¥±¥Ñå½Ý¹ÕÉ…Ñ¥½¹ñðÈ¤¬‹–n{–B#¾ò$ˆì(€€€€€€€ô(€€€€€€€¥˜¡Í­¥±°¹ÍÑ…Ñ½Ý¹	å1•Ù•°¥ì(€€€€€€€€€€€Ñ•áÐ¬ô‹¾öpˆ­Í­¥±°¹ÍÑ…Ñ½Ý¹¡…¹”¬ˆ—¦f7¢÷–*lˆ­Í­¥±°¹ÍÑ…Ñ½Ý¹	å1•Ù•±m±•Ù•°´Åt¬ˆ—¾ò ˆ¬¡Í­¥±°¹ÍÑ…Ñ½Ý¹ÕÉ…Ñ¥½¹ñðÈ¤¬‹–n{–B#¾ò$ˆì(€€€€€€€ô(€€€€€€€¥˜¡Í­¥±°¹‘•™•¹Í•½Ý¹	å1•Ù•°¥ì(€€€€€€€€€€€Ñ•áÐ¬ô‹¾öpˆ­Í­¥±°¹‘•™•¹Í•½Ý¹¡…¹”¬ˆ—¦f7¦bÈˆ­Í­¥±°¹‘•™•¹Í•½Ý¹	å1•Ù•±m±•Ù•°´Åt¬ˆ—¾ò ˆ¬¡Í­¥±°¹‘•™•¹Í•½Ý¹ÕÉ…Ñ¥½¹ñðÈ¤¬‹–n{–B#¾ò$ˆì(€€€€€€€ô(€€€€€€€¥˜¡Í­¥±°¹µ¥ÍÍ	½¹ÕÍ	å1•Ù•°¥ì(€€€€€€€€€€€Ñ•áÐ¬ô‹¾öpˆ­Í­¥±°¹ÍÑÕ¹¡…¹”¬ˆ—šj#žr§¾ò15%ML€¬ˆ­Í­¥±°¹µ¥ÍÍ	½¹ÕÍ	å1•Ù•±m±•Ù•°´Åt¬ˆ—¾ò ˆ¬¡Í­¥±°¹ÍÑÕ¹ÕÉ…Ñ¥½¹ñðÈ¤¬‹–n{–B#¾ò$ˆì(€€€€€€€ô(€€€€€€€¥˜¡Í­¥±°¹Á•ÑÉ¥™å¡…¹•	å1•Ù•°¥ì(€€€€€€€€€€€Ñ•áÐ¬ô‹¾öpˆ­Í­¥±°¹Á•ÑÉ¥™å¡…¹•	å1•Ù•±m±•Ù•°´Åt¬ˆ—ž~Ï–2[¾ò ˆ¬¡Í­¥±°¹Á•ÑÉ¥™åÕÉ…Ñ¥½¹ñðÈ¤¬‹–n{–B#¾ò$ˆì(€€€€€€€ô(€€€€€€€¥˜¡Í­¥±°¹Í•±™M¡¥•±‘	å1•Ù•°¥ì(€€€€€€€€€€€Ñ•áÐ¬ô‹¾ös¢«¢ê¯¢¶ßžnø€ˆ­Í­¥±°¹Í•±™M¡¥•±‘	å1•Ù•±m±•Ù•°´Åt¬‹¾ò ˆ¬¡Í­¥±°¹Í¡¥•±‘ÕÉ…Ñ¥½¹ñðÈ¤¬‹–n{–B#¾ò$ˆì(€€€€€€€ô(€€€€€€€¥˜¡Í­¥±°¹…±±åM¡¥•±‘	å1•Ù•°¥ì(€€€€€€€€€€€Ñ•áÐ¬ô‹¾ös–£¦®S¢¶ßžnø€ˆ­Í­¥±°¹…±±åM¡¥•±‘	å1•Ù•±m±•Ù•°´Åt¬‹¾ò ˆ¬¡Í­¥±°¹Í¡¥•±‘ÕÉ…Ñ¥½¹ñðÈ¤¬‹–n{–B#¾ò$ˆì(€€€€€€€ô((€€€€€€€É•ÑÕÉ¸Ñ•áÐì((€€€ô(((€€€¥˜¡Í­¥±°¹…Ñ•½Éäôôô‰‰Õ™˜ˆ¥ì(€€€€€€€¥˜¡Í­¥±°¹É¥Ñ	½¹ÕÍ	å1•Ù•°¥ì(€€€€€€€€€€€É•ÑÕÉ¸€‹ž"šN+ž:¾ò?ž"šN+–
ß–ºÌ€¬ˆ­Í­¥±°¹É¥Ñ	½¹ÕÍ	å1•Ù•±m±•Ù•°´Åt¬ˆ—¾ò3š2žê0ˆ­Í­¥±°¹‘ÕÉ…Ñ¥½¸¬‹–n{–B ˆì(€€€€€€€ô(€€€€€€€¥˜¡Í­¥±°¹•Ù…Í¥½¹	½¹ÕÍA•É•¹Ð¥ì(€€€€€€€€€€€É•ÑÕÉ¸€‹¦Z¢êËž:€¬ˆ­Í­¥±°¹•Ù…Í¥½¹	½¹ÕÍA•É•¹Ð¬ˆ—¾ò3š2žê0ˆ­Í­¥±°¹‘ÕÉ…Ñ¥½¸¬‹–n{–B ˆì(€€€€€€€ô(€€€€€€€¥˜¡Í­¥±°¹‘•™•¹Í•	½¹ÕÍA•É•¹Ð¥ì(€€€€€€€€€€€É•ÑÕÉ¸€‹¦bËžš›–*l€¬ˆ­Í­¥±°¹‘•™•¹Í•	½¹ÕÍA•É•¹Ð¬ˆ—¾ò3š2žê0ˆ­Í­¥±°¹‘ÕÉ…Ñ¥½¸¬‹–n{–B ˆì(€€€€€€€ô(€€€€€€€¥˜¡Í­¥±°¹É•™±•ÑA•É•¹Ð¥ì(€€€€€€€€€€€É•ÑÕÉ¸€‹–>7–
Ü€ˆ­Í­¥±°¹É•™±•ÑA•É•¹Ð¬ˆ—¾ò3š2žê0ˆ­Í­¥±°¹‘ÕÉ…Ñ¥½¸¬‹–n{–B ˆì(€€€€€€€ô(€€€€€€€¥˜¡Í­¥±°¹ÍÑ…ÑÕÍI•Í¥ÍÑ	½¹ÕÌ¥ì(€€€€€€€€€€€É•ÑÕÉ¸€‹žVÃ–âãž.š/š*_šœ€¬ˆ­Í­¥±°¹ÍÑ…ÑÕÍI•Í¥ÍÑ	½¹ÕÌ¬ˆ—¾ò3š2žê0ˆ­Í­¥±°¹‘ÕÉ…Ñ¥½¸¬‹–n{–B ˆì(€€€€€€€ô(€€€€€€€É•ÑÕÉ¸Í­¥±°¹‘•ÍÉ¥ÁÑ¥½¸ì(€€€ô(((€€€¥˜¡Í­¥±°¹…Ñ•½Éäôôô‰¡•…°ˆ¥ì((€€€€€€€½¹ÍÐ¡•…±µ½Õ¹Ð€ô(€€€€€€€€€€€Í­¥±°¹‰…Í•!•…°¬(€€€€€€€€€€€Í­¥±°¹¡•…±A•É1•Ù•°¨(€€€€€€€€€€€€¡±•Ù•°´Ä¤ì(((€€€€€€€É•ÑÕÉ¸€ (€€€€€€€€€€€€‹–n{–ú¥!C¾òk–~ëž’8ˆ¬(€€€€€€€€€€€¡•…±µ½Õ¹Ð¬(€€€€€€€€€€€€ˆ¯šfë–*o\ˆ¬(€€€€€€€€€€€!1%9}%9Q}=%%9P¬(€€€€€€€€€€€€‹¾òmMC¾òk–~ëž’8ˆ¬(€€€€€€€€€€€€¡Í­¥±°¹‰…Í•!•…±M@¬¡Í­¥±°¹¡•…±MAA•É1•Ù•±ñðÀ¤¨¡±•Ù•°´Ä¤¤¬(€€€€€€€€€€€€ˆ¯šfë–*o\ˆ¬(€€€€€€€€€€€MA}!1%9}%9Q}=%%9P¬(€€€€€€€€€€€€‹¾ò#šZ÷šRû¢šr³’êë’â7–n{–ú¥MC¾ò$ˆ(€€€€€€€€¤ì((€€€ô(((€€€¥˜¡Í­¥±°¹…Ñ•½Éäôôô‰É•Ù¥Ù”ˆ¥ì((€€€€€€€É•ÑÕÉ¸€ (€€€€€€€€€€€€‹–ú§šÒï–ú3š‹–ú¤ˆ¬(€€€€€€€€€€€Í­¥±°¹É•Ù¥Ù•!•…±A•É•¹Ñ	å1•Ù•±l(€€€€€€€€€€€€€€€±•Ù•°´Ä(€€€€€€€€€€€t¬(€€€€€€€€€€€€ˆ—¢†¦<ˆ(€€€€€€€€¤ì((€€€ô(((€€€¥˜¡Í­¥±°¹…Ñ•½Éäôôô‰Á…ÍÍ¥Ù”ˆ¥ì((€€€€€€€É•ÑÕÉ¸Í­¥±°¹‘•ÍÉ¥ÁÑ¥½¸ì((€€€ô(((€€€É•ÑÕÉ¸ˆˆì()ô(()™Õ¹Ñ¥½¸±•…É¹M­¥±°¡Í­¥±±%¥ì((€€€½¹ÍÐ¡…É…Ñ•È€ô(€€€€€€€¡…É…Ñ•ÉM­¥±±1½…‘½ÕÑÍl(€€€€€€€€€€€ÕÉÉ•¹ÑM­¥±±¡…É…Ñ•È(€€€€€€€tì(((€€€½¹ÍÐÍ­¥±°€ô(€€€€€€€Í­¥±±…Ñ…‰…Í•mÍ­¥±±%‘tì(((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾òh(€€€€€€ƒ–:šr³¦g¢Ž‡žnÓš:—š&Á±…å•È¹Í­¥±±A½¥¹ÑÏ¾ò0(€€€€€€ƒ’â7žº‡žn»–&7¦ãžjšb¿¢ªÃ¾ò3’â–ú/š&ž²³’â¢žK¢&Ëžj¦î{šVãŽ(€€€€€€ƒšRçš"C–#š~—–ëŽ3¦g–/¢žK¢&Ëžrš¶žj¢ÎšZgž&§’îÛŽ7¾ò0(€€€€€€Ý…Ñ•È½Ý¥¹“žn»–&7šÊKšr'žrš¶¢žK¢&Ë¢ÎšZg¾ò0(€€€€€€ƒžnÓš:—šN/š:'’â7¢÷–¶ã¾ò#¦†¿ž’ëš>Cž’ë¾ò'Ž(€€€€¨¼((€€€½¹ÍÐ½Ý¹•Èô(€€€€€€€•ÑM­¥±±¡…É…Ñ•É=‰©•Ð (€€€€€€€€€€€ÕÉÉ•¹ÑM­¥±±¡…É…Ñ•È(€€€€€€€€¤ì(((€€€¥˜ (€€€€€€€€…¡…É…Ñ•Èñð(€€€€€€€€…Í­¥±°(€€€€¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€¥˜ …½Ý¹•È¥ì((€€€€€€€…±•ÉÐ (€€€€€€€€€€€€‹¦g–/¢žK¢&Ë¦
šÊKšr'¦Z/šRûš*¢÷–¶ãžþK–*¢÷Žˆ(€€€€€€€€¤ì((€€€€€€€É•ÑÕÉ¸ì((€€€ô(((€€€¥˜ …¡…É…Ñ•È¹Í­¥±±1•Ù•±Ì¥ì((€€€€€€€¡…É…Ñ•È¹Í­¥±±1•Ù•±Ìõíôì((€€€ô(((€€€¥˜ (€€€€€€€€¡¡…É…Ñ•È¹Í­¥±±1•Ù•±ÍmÍ­¥±±%‘uñðÀ¤øÀ(€€€€¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€€¼¨(€€€€€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3Ž3–&7žö»š*¢ô(€€€€€€ƒ¢š–¶ãžjš¦–"ÛŽ7¾ò'¾òh(€€€€€€U'’â+–ÞËžÚOš*+š2'¦"U‘¥Í…‰±•“šN/’ö?¦î{šN+’ê¾ò0(€€€€€€ƒ¦g¢Ž‡šb¿ž²³’ê3–Æ“¦bË¢¶ßŠSŠS¢B³’âšr'–"—žj–rÃšZä(€€€€€€ƒžæ{¦;žV¯¦v‹žnÓš:—–Fó–>­±•…É¹M­¥±° §¾ò0(€€€€€€ƒ–ú3ž®¿’âš¢¢ššN/’ö?¾ò3’â7¢÷–>«¦vƒ–&7ž®¿Ž(€€€€¨¼((€€€¥˜ (€€€€€€€€…¥ÍM­¥±±AÉ•É•Å5•Ð (€€€€€€€€€€€¡…É…Ñ•È¹Í­¥±±1•Ù•±Ì°(€€€€€€€€€€€Í­¥±°(€€€€€€€€¤(€€€€¥ì((€€€€€€€…±•ÉÐ (€€€€€€€€€€€•ÑM­¥±±AÉ•É•Å1…‰•°¡Í­¥±°¤¬(€€€€€€€€€€€€‹¾ò3š&7¢÷–¶ãžþKŽ0ˆ¬(€€€€€€€€€€€Í­¥±°¹¹…µ”¬(€€€€€€€€€€€€‹Ž7Žˆ(€€€€€€€€¤ì((€€€€€€€É•ÑÕÉ¸ì((€€€ô(((€€€½¹ÍÐ±•…É¹½ÍÐõ5…Ñ ¹µ…à À±9Õµ‰•È¡Í­¥±°¹±•…É¹½ÍÐ¥ñðÀ¤ì(€€€½¹ÍÐ…Ù…¥±…‰±•A½¥¹ÑÌõ5…Ñ ¹µ…à À±9Õµ‰•È¡½Ý¹•È¹Í­¥±±A½¥¹ÑÌ¥ñðÀ¤ì((€€€¥˜¡…Ù…¥±…‰±•A½¥¹ÑÌñ±•…É¹½ÍÐ¥ì(€€€€€€€…±•ÉÐ (€€€€€€€€€€€€‹š*¢÷¦î{’â7¢ÚÏ¾ò3¦r¢šˆ¬(€€€€€€€€€€€±•…É¹½ÍÐ¬(€€€€€€€€€€€€‹¦î{Žˆ(€€€€€€€€¤ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô((€€€½Ý¹•È¹Í­¥±±A½¥¹ÑÌõ…Ù…¥±…‰±•A½¥¹ÑÌµ±•…É¹½ÍÐì(((€€€¡…É…Ñ•È¹Í­¥±±1•Ù•±ÍmÍ­¥±±%‘tôÄì(((€€€É•¹‘•ÉM­¥±±1½…‘½ÕÐ ¤ì((€€€ÕÁ‘…Ñ•U$ ¤ì((€€€Í…Ù•…µ” ¤ì()ô(()™Õ¹Ñ¥½¸ÕÁÉ…‘•M­¥±°¡Í­¥±±%¥ì((€€€½¹ÍÐ¡…É…Ñ•È€ô(€€€€€€€¡…É…Ñ•ÉM­¥±±1½…‘½ÕÑÍl(€€€€€€€€€€€ÕÉÉ•¹ÑM­¥±±¡…É…Ñ•È(€€€€€€€tì(((€€€½¹ÍÐÍ­¥±°€ô(€€€€€€€Í­¥±±…Ñ…‰…Í•mÍ­¥±±%‘tì(((€€€½¹ÍÐ½Ý¹•Èô(€€€€€€€•ÑM­¥±±¡…É…Ñ•É=‰©•Ð (€€€€€€€€€€€ÕÉÉ•¹ÑM­¥±±¡…É…Ñ•È(€€€€€€€€¤ì(((€€€¥˜ (€€€€€€€€…¡…É…Ñ•Èñð(€€€€€€€€…Í­¥±°ñð(€€€€€€€€…¡…É…Ñ•È¹Í­¥±±1•Ù•±Ìñð(€€€€€€€€…½Ý¹•È(€€€€¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€½¹ÍÐÕÉÉ•¹Ñ1•Ù•°€ô(€€€€€€€¡…É…Ñ•È¹Í­¥±±1•Ù•±Íl(€€€€€€€€€€€Í­¥±±%(€€€€€€€uñð(€€€€€€€€Àì(((€€€¥˜¡ÕÉÉ•¹Ñ1•Ù•°ðôÀ¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€½¹ÍÐµ…á1•Ù•°€ô(€€€€€€€Í­¥±°¹µ…á1•Ù•±ñð(€€€€€€€€Äì(((€€€¥˜¡ÕÉÉ•¹Ñ1•Ù•°øõµ…á1•Ù•°¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€¥˜¡½Ý¹•È¹Í­¥±±A½¥¹ÑÌðÄ¥ì((€€€€€€€…±•ÉÐ (€€€€€€€€€€€€‹š*¢÷¦î{’â7¢ÚÏŽˆ(€€€€€€€€¤ì((€€€€€€€É•ÑÕÉ¸ì((€€€ô(((€€€½Ý¹•È¹Í­¥±±A½¥¹ÑÌ´ôÄì(((€€€¡…É…Ñ•È¹Í­¥±±1•Ù•±ÍmÍ­¥±±%‘tô(€€€€€€€ÕÉÉ•¹Ñ1•Ù•°¬Äì(((€€€É•¹‘•ÉM­¥±±1½…‘½ÕÐ ¤ì((€€€ÕÁ‘…Ñ•U$ ¤ì((€€€Í…Ù•…µ” ¤ì()ô(()™Õ¹Ñ¥½¸•ÅÕ¥ÁM­¥±°¡Í­¥±±%¥ì((€€€½¹ÍÐ¡…É…Ñ•È€ô(€€€€€€€¡…É…Ñ•ÉM­¥±±1½…‘½ÕÑÍl(€€€€€€€€€€€ÕÉÉ•¹ÑM­¥±±¡…É…Ñ•È(€€€€€€€tì(((€€€¥˜ …¡…É…Ñ•È¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€¥˜ (€€€€€€€¡…É…Ñ•È¹•ÅÕ¥ÁÁ•‘M­¥±±Ì(€€€€€€€€¹¥¹±Õ‘•Ì¡Í­¥±±%¤(€€€€¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€¥˜ (€€€€€€€¡…É…Ñ•È¹•ÅÕ¥ÁÁ•‘M­¥±±Ì¹±•¹Ñ øôÐ(€€€€¥ì((€€€€€€€…±•ÉÐ (€€€€€€€€€€€€‹š¾?–/¢žK¢&Ëšr–’k–>«¢÷šRs–âØÓ–/š*¢÷Žˆ(€€€€€€€€¤ì((€€€€€€€É•ÑÕÉ¸ì((€€€ô(((€€€¡…É…Ñ•È¹•ÅÕ¥ÁÁ•‘M­¥±±Ì(€€€€€€€€¹ÁÕÍ ¡Í­¥±±%¤ì(((€€€É•¹‘•ÉM­¥±±1½…‘½ÕÐ ¤ì((€€€Á½ÁÕ±…Ñ•ÕÑ½M­¥±±=ÁÑ¥½¹Ì ¤ì((€€€Á½ÁÕ±…Ñ•ÕÑ½M­¥±±=ÁÑ¥½¹ÌÈ ¤ì((€€€Í…Ù•…µ” ¤ì()ô(()™Õ¹Ñ¥½¸É•µ½Ù•ÅÕ¥ÁÁ•‘M­¥±°¡¥¹‘•à¥ì((€€€½¹ÍÐ¡…É…Ñ•È€ô(€€€€€€€¡…É…Ñ•ÉM­¥±±1½…‘½ÕÑÍl(€€€€€€€€€€€ÕÉÉ•¹ÑM­¥±±¡…É…Ñ•È(€€€€€€€tì(((€€€¥˜ …¡…É…Ñ•È¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€¡…É…Ñ•È¹•ÅÕ¥ÁÁ•‘M­¥±±Ì(€€€€€€€€¹ÍÁ±¥” (€€€€€€€€€€€¥¹‘•à°(€€€€€€€€€€€€Ä(€€€€€€€€¤ì(((€€€É•¹‘•ÉM­¥±±1½…‘½ÕÐ ¤ì((€€€Á½ÁÕ±…Ñ•ÕÑ½M­¥±±=ÁÑ¥½¹Ì ¤ì((€€€Á½ÁÕ±…Ñ•ÕÑ½M­¥±±=ÁÑ¥½¹ÌÈ ¤ì((€€€Í…Ù•…µ” ¤ì()ô(((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€ƒ¢3–2¢žK¢&È€¼ƒžÚO–àIAƒ¢3–2(ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼()±•Ð¥¹Ù•¹Ñ½Éå¥±Ñ•È€ô€‰•ÅÕ¥Áµ•¹Ðˆì)½¹ÍÐ%9Y9Q=Ie}Q=Ie}M1=Q}=U9P€ô€ÄÈÀì()™Õ¹Ñ¥½¸•Ñ	…­Á…­A…ÉÑå¡…É…Ñ•ÉÌ ¥ì(€€€É•ÑÕÉ¸mÁ±…å•È°Á±…å•ÈÈ°Á±…å•ÈÍtì)ô()™Õ¹Ñ¥½¸•Ñ	…­Á…­¡…É…Ñ•È¡¥¹‘•à¥ì(€€€É•ÑÕÉ¸•Ñ	…­Á…­A…ÉÑå¡…É…Ñ•ÉÌ ¥m¥¹‘•átñð¹Õ±°ì)ô()™Õ¹Ñ¥½¸•Ñ	…­Á…­ÅÕ¥Áµ•¹Ñ-•ä¡¥¹‘•à¥ì(€€€É•ÑÕÉ¸•Ñ	…­Á…­¡…É…Ñ•È¡¥¹‘•à¤(€€€€€€€€ü•ÑA…ÉÑå¡…É…Ñ•É-•ä¡¥¹‘•à¤(€€€€€€€€è¹Õ±°ì)ô()™Õ¹Ñ¥½¸•Ñ%¹Ù•¹Ñ½ÉåÅÕ¥Áµ•¹ÑM±½Ð¡¥Ñ•µQåÁ”¥ì(€€€½¹ÍÐµ…Àõì(€€€€€€€Ý•…Á½¸è‰¡…¹ˆ°(€€€€€€€¡•±µ•Ðè‰¡•…ˆ°(€€€€€€€¡•…è‰¡•…ˆ°(€€€€€€€Í¡½Õ±‘•Èè‰Í¡½Õ±‘•Èˆ°(€€€€€€€…Éµ½Èè‰…Éµ½Èˆ°(€€€€€€€Í¡½•Ìè‰Í¡½•Ìˆ°(€€€€€€€…•ÍÍ½Éäè‰É¥¹œˆ°(€€€€€€€É¥¹œè‰É¥¹œˆ(€€€ôì(€€€É•ÑÕÉ¸µ…Ám¥Ñ•µQåÁ•tñð¹Õ±°ì)ô()™Õ¹Ñ¥½¸•Ñ	…­Á…­¡…É…Ñ•ÉMÑ…ÑÌ¡¥¹‘•à¥ì(€€€½¹ÍÐ¡…É…Ñ•Èõ•Ñ	…­Á…­¡…É…Ñ•È¡¥¹‘•à¤ì(€€€¥˜ …¡…É…Ñ•È¤É•ÑÕÉ¸¹Õ±°ì((€€€¥˜¡¥¹‘•àôôôÀ¤É•ÑÕÉ¸•Ñ5…¥¹¡…É…Ñ•ÉMÑ…ÑÌ ¤ì((€€€½¹ÍÐ­•äõ•Ñ	…­Á…­ÅÕ¥Áµ•¹Ñ-•ä¡¥¹‘•à¤ì(€€€½¹ÍÐ‰½¹ÕÌõ•ÑÅÕ¥Áµ•¹Ñ	½¹ÕÌ¡­•ä¤ì((€€€É•ÑÕÉ¸ì(€€€€€€€µ…á!@èÄÀÀ¬¡¡…É…Ñ•È¹‰½¹ÕÍ!AñðÀ¤­¡…É…Ñ•È¹Ù¥Ñ…±¥Ñä©!A}AI}Y%Q1%Qe}A=%9P­‰½¹ÕÌ¹µ…á!@­‰½¹ÕÌ¹Ù¥Ñ…±¥Ñä©!A}AI}Y%Q1%Qe}A=%9P°(€€€€€€€µ…áM@èÔÀ¬¡¡…É…Ñ•È¹‰½¹ÕÍMAñðÀ¤­¡…É…Ñ•È¹•¹•Éä¨ÄÔ­‰½¹ÕÌ¹µ…áM@­‰½¹ÕÌ¹•¹•Éä¨ÄÔ°(€€€€€€€…ÑÑ…¬é	M}A!eM%1}QQ,­5…Ñ ¹µ…à Ä±9Õµ‰•È¡¡…É…Ñ•È¹±•Ù•°¥ñðÄ¤©QQ-}AI}1Y0¬¡¡…É…Ñ•È¹…ÑÑ…¬­‰½¹ÕÌ¹…ÑÑ…¬¤©QQ-}AI}A=%9P°(€€€€€€€µ…¥ÑÑ…¬é	M}5%}QQ,­5…Ñ ¹µ…à Ä±9Õµ‰•È¡¡…É…Ñ•È¹±•Ù•°¥ñðÄ¤©5%}QQ-}AI}1Y0¬¡¡…É…Ñ•È¹¥¹Ñ•±±¥•¹”­‰½¹ÕÌ¹¥¹Ñ•±±¥•¹”¤©5%}QQ-}AI}A=%9P°(€€€€€€€‘•™•¹Í”é	M}9M­5…Ñ ¹µ…à Ä±9Õµ‰•È¡¡…É…Ñ•È¹±•Ù•°¥ñðÄ¤©9M}AI}1Y0¬¡¡…É…Ñ•È¹Ù¥Ñ…±¥Ñä­‰½¹ÕÌ¹Ù¥Ñ…±¥Ñä¤©9M}AI}Y%Q1%Qe}A=%9P­‰½¹ÕÌ¹‘•™•¹Í”°(€€€€€€€Ù¥Ñ…±¥Ñäé¡…É…Ñ•È¹Ù¥Ñ…±¥Ñä­‰½¹ÕÌ¹Ù¥Ñ…±¥Ñä°(€€€€€€€•¹•Éäé¡…É…Ñ•È¹•¹•Éä­‰½¹ÕÌ¹•¹•Éä°(€€€€€€€¥¹Ñ•±±¥•¹”é¡…É…Ñ•È¹¥¹Ñ•±±¥•¹”­‰½¹ÕÌ¹¥¹Ñ•±±¥•¹”°(€€€€€€€ÍÁ¥É¥Ðé¡…É…Ñ•È¹ÍÁ¥É¥Ð­‰½¹ÕÌ¹ÍÁ¥É¥Ð°(€€€€€€€…¥±¥Ñäé¡…É…Ñ•È¹…¥±¥Ñä­‰½¹ÕÌ¹…¥±¥Ñä°(€€€€€€€…ÕÉ…äé¡…É…Ñ•È¹ÍÁ¥É¥Ð¨È­‰½¹ÕÌ¹ÍÁ¥É¥Ð¨È°(€€€€€€€É•Í¥ÍÑ…¹”é…±Õ±…Ñ•MÑ…ÑÕÍI•Í¥ÍÑ…¹•A•É•¹Ð¡¡…É…Ñ•È¹ÍÁ¥É¥Ð­‰½¹ÕÌ¹ÍÁ¥É¥Ð¤°(€€€€€€€…¹Ñ¥É¥Ðé…±Õ±…Ñ•¹Ñ¥É¥ÑA•É•¹Ð¡¡…É…Ñ•È¹ÍÁ¥É¥Ð­‰½¹ÕÌ¹ÍÁ¥É¥Ð¤°(€€€€€€€•Ù…Í¥½¸è¡¡…É…Ñ•È¹…¥±¥Ñä­‰½¹ÕÌ¹…¥±¥Ñä¤¨À¸Ø(€€€ôì)ô()™Õ¹Ñ¥½¸¡…¹•%¹Ù•¹Ñ½Éå¡…É…Ñ•È¡‘¥É•Ñ¥½¸¥ì(€€€½¹ÍÐÁ…ÉÑäõ•Ñ	…­Á…­A…ÉÑå¡…É…Ñ•ÉÌ ¤ì(€€€±•Ð¹•áÐõ¥¹Ù•¹Ñ½Éå¡…É…Ñ•É%¹‘•à­‘¥É•Ñ¥½¸ì(€€€¥˜¡¹•áÐðÀ¤¹•áÐõÁ…ÉÑä¹±•¹Ñ ´Äì(€€€¥˜¡¹•áÐøõÁ…ÉÑä¹±•¹Ñ ¤¹•áÐôÀì((€€€€¼¼ƒšr«–îëž®/žj¢žK¢&Ë’î7–>¿¦†¿ž’ëž²³’â'š‚ó¾ò3’ö’â7¢÷š*+ž¦ë¢žK¢&ËžVÛš"C–>¿¢Žw–
g¢žK¢&ËŽ(€€€¥¹Ù•¹Ñ½Éå¡…É…Ñ•É%¹‘•àõ¹•áÐì(€€€É•¹‘•É%¹Ù•¹Ñ½Éä ¤ì((€€€¥˜¡ÑåÁ•½˜Íå¹¡…É…Ñ•ÉQ…‰ÍÉ½µ%¹Ù•¹Ñ½Éä€ôôô€‰™Õ¹Ñ¥½¸ˆ¥ì(€€€€€€€Íå¹¡…É…Ñ•ÉQ…‰ÍÉ½µ%¹Ù•¹Ñ½Éä¡¹•áÐ¤ì(€€€ô)ô()™Õ¹Ñ¥½¸Í•±•Ñ%¹Ù•¹Ñ½Éå¡…É…Ñ•È¡¥¹‘•à¥ì(€€€½¹ÍÐÁ…ÉÑäõ•Ñ	…­Á…­A…ÉÑå¡…É…Ñ•ÉÌ ¤ì(€€€¥˜¡¥¹‘•àðÀñð¥¹‘•àøõÁ…ÉÑä¹±•¹Ñ ¤É•ÑÕÉ¸ì(€€€¥¹Ù•¹Ñ½Éå¡…É…Ñ•É%¹‘•àõ¥¹‘•àì(€€€É•¹‘•É%¹Ù•¹Ñ½Éä ¤ì((€€€¥˜¡Á…ÉÑåm¥¹‘•át€˜˜ÑåÁ•½˜Íå¹¡…É…Ñ•ÉQ…‰ÍÉ½µ%¹Ù•¹Ñ½Éä€ôôô€‰™Õ¹Ñ¥½¸ˆ¥ì(€€€€€€€Íå¹¡…É…Ñ•ÉQ…‰ÍÉ½µ%¹Ù•¹Ñ½Éä¡¥¹‘•à¤ì(€€€ô)ô()™Õ¹Ñ¥½¸Íå¹¡…É…Ñ•ÉQ…‰ÍÉ½µ%¹Ù•¹Ñ½Éä¡¥¹‘•à¥ì(€€€¥˜¡¥¹‘•àôôôÀñð¥¹‘•àôôôÄñð¥¹‘•àôôôÈ¥ì(€€€€€€€¥˜¡ÑåÁ•½˜Í•±•Ñ¡…É…Ñ•É½ÉQ…‰Ì€ôôô€‰™Õ¹Ñ¥½¸ˆ€˜˜(€€€€€€€€€€•ÑA…ÉÑå¡…É…Ñ•É	å%¹‘•à¡¥¹‘•à¤¥ì(€€€€€€€€€€€€¼¼ƒ¦ÿ–4Í•±•Ñ¡…É…Ñ•É½ÉQ…‰Ìƒ–7š²‡¢žãžfðÉ•¹‘•É%¹Ù•¹Ñ½Éäƒ–ö‹š"C¦{¢þÓŽ(€€€€€€€€€€€ÍÑ…ÑÕÍ¡…É…Ñ•É%¹‘•àõ¥¹‘•àì(€€€€€€€€€€€¥¹Ù•¹Ñ½Éå¡…É…Ñ•É%¹‘•àõ¥¹‘•àì(€€€€€€€€€€€ÕÉÉ•¹ÑM­¥±±¡…É…Ñ•Èõ•ÑA…ÉÑå¡…É…Ñ•É-•ä¡¥¹‘•à¤ì(€€€€€€€ô(€€€ô)ô()™Õ¹Ñ¥½¸É•¹‘•É%¹Ù•¹Ñ½Éå¡…É…Ñ•ÉQ…‰Ì ¥ì(€€€½¹ÍÐÝÉ…Àô ‰¥¹Ù•¹Ñ½Éå¡…É…Ñ•ÉQ…‰Ìˆ¤ì(€€€¥˜ …ÝÉ…À¤É•ÑÕÉ¸ì((€€€½¹ÍÐ¡…É…Ñ•ÉÍ1¥ÍÐõmÁ±…å•È±Á±…å•ÈÈ±Á±…å•ÈÍtì(€€€½¹ÍÐ¡…É…Ñ•Èõ¡…É…Ñ•ÉÍ1¥ÍÑm¥¹Ù•¹Ñ½Éå¡…É…Ñ•É%¹‘•átì((€€€½¹ÍÐ±•™Ñ¥Í…‰±•õ¥¹Ù•¹Ñ½Éå¡…É…Ñ•É%¹‘•àðôÀì(€€€½¹ÍÐÉ¥¡Ñ¥Í…‰±•õ¥¹Ù•¹Ñ½Éå¡…É…Ñ•É%¹‘•àøõ¡…É…Ñ•ÉÍ1¥ÍÐ¹±•¹Ñ ´Äñð€…¡…É…Ñ•ÉÍ1¥ÍÑm¥¹Ù•¹Ñ½Éå¡…É…Ñ•É%¹‘•à¬Åtì((€€€ÝÉ…À¹¥¹¹•É!Q50õ€(€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€€€±…ÍÌô‰¥¹Ù•¹Ñ½Éäµ¡…É…Ñ•Èµ…ÉÉ½Üˆ(€€€€€€€€€€€…É¥„µ±…‰•°ô‹’â+’â–/¢žK¢&Èˆ(€€€€€€€€€€€€‘í±•™Ñ¥Í…‰±•€ü€‰‘¥Í…‰±•ˆ€è€ˆ‰ô(€€€€€€€€€€€½¹±¥¬ô‰Í•±•Ñ%¹Ù•¹Ñ½Éå¡…É…Ñ•È ‘í5…Ñ ¹µ…à À±¥¹Ù•¹Ñ½Éå¡…É…Ñ•É%¹‘•à´Ä¥ô¤ˆûŠäð½‰ÕÑÑ½¸ø((€€€€€€€€ñ‘¥Ø±…ÍÌô‰¥¹Ù•¹Ñ½Éäµ¡…É…Ñ•Èµ¹…µ”ˆø(€€€€€€€€€€€€ñÍÁ…¸ø‘í¡…É…Ñ•È€ü€¡¡…É…Ñ•È¹¥ñð€‹¢žK¢&Èˆ¬¡¥¹Ù•¹Ñ½Éå¡…É…Ñ•É%¹‘•à¬Ä¤¤€è€‹¢žK¢&Èˆ¬¡¥¹Ù•¹Ñ½Éå¡…É…Ñ•É%¹‘•à¬Ä¥ôð½ÍÁ…¸ø(€€€€€€€€€€€€‘í¡…É…Ñ•È€ü€ñÍµ…±°±…ÍÌô‰¥¹Ù•¹Ñ½Éäµ¡…É…Ñ•Èµ±•Ù•°ˆù1Ø¸‘í¡…É…Ñ•È¹±•Ù•°ñð€Åôð½Íµ…±°ù€€è€ñÍµ…±°±…ÍÌô‰¥¹Ù•¹Ñ½Éäµ¡…É…Ñ•Èµ±•Ù•°ˆû–Âkšr«–îëž®,ð½Íµ…±°ùô(€€€€€€€€ð½‘¥Øø((€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€€€±…ÍÌô‰¥¹Ù•¹Ñ½Éäµ¡…É…Ñ•Èµ…ÉÉ½Üˆ(€€€€€€€€€€€…É¥„µ±…‰•°ô‹’â/’â–/¢žK¢&Èˆ(€€€€€€€€€€€€‘íÉ¥¡Ñ¥Í…‰±•€ü€‰‘¥Í…‰±•ˆ€è€ˆ‰ô(€€€€€€€€€€€½¹±¥¬ô‰Í•±•Ñ%¹Ù•¹Ñ½Éå¡…É…Ñ•È ‘í5…Ñ ¹µ¥¸¡¡…É…Ñ•ÉÍ1¥ÍÐ¹±•¹Ñ ´Ä±¥¹Ù•¹Ñ½Éå¡…É…Ñ•É%¹‘•à¬Ä¥ô¤ˆûŠèð½‰ÕÑÑ½¸ø(€€€€ì)ô()™Õ¹Ñ¥½¸É•¹‘•É%¹Ù•¹Ñ½ÉåMÑ…ÑÌ ¥ì(€€€½¹ÍÐÍÑ…ÑÌõ•Ñ	…­Á…­¡…É…Ñ•ÉMÑ…ÑÌ¡¥¹Ù•¹Ñ½Éå¡…É…Ñ•É%¹‘•à¤ì(€€€½¹ÍÐ•°ô ‰¥¹Ù•¹Ñ½ÉåMÑ…ÑÌˆ¤ì(€€€¥˜ …•°¤É•ÑÕÉ¸ì((€€€¥˜ …ÍÑ…ÑÌ¥ì(€€€€€€€•°¹¥¹¹•É!Q50ôœñ‘¥Ø±…ÍÌô‰¥¹Ù•¹Ñ½Éäµ•µÁÑäµ¡…É…Ñ•Èˆûž²³’â'¢žK¢&Ë–Âkšr«–îëž®,ð½‘¥Øøœì(€€€€€€€É•ÑÕÉ¸ì(€€€ô((€€€€¼¨(€€€€€€XÜß¾òh(€€€€€€ƒ¢3–2–âã¦žC¢Î¢¢+–>«žVd!@€¼MCŽ(€€€€€€ƒ–Û’î[¢÷–*ošRçžRÇž®/žæ«–>Ï’â+¢žKšRû–’Ÿ¦>‡¦Z/–V¢¦ÏžÒÃ¢Î¢¢+Ž(€€€€¨¼(€€€•°¹¥¹¹•É!Q50õ€(€€€€€€€€ñ‘¥Ø±…ÍÌô‰¥¹Ù•¹Ñ½ÉäµÍÑ…ÐµÉ½Ü¥¹Ù•¹Ñ½ÉäµÍÑ…ÐµÁÉ¥µ…Éäˆø(€€€€€€€€€€€€ñÍÁ…¸ù!@ð½ÍÁ…¸øñˆø‘íÍÑ…ÑÌ¹µ…á!Aôð½ˆø(€€€€€€€€ð½‘¥Øø(€€€€€€€€ñ‘¥Ø±…ÍÌô‰¥¹Ù•¹Ñ½ÉäµÍÑ…ÐµÉ½Ü¥¹Ù•¹Ñ½ÉäµÍÑ…ÐµÁÉ¥µ…Éäˆø(€€€€€€€€€€€€ñÍÁ…¸ùM@ð½ÍÁ…¸øñˆø‘íÍÑ…ÑÌ¹µ…áMAôð½ˆø(€€€€€€€€ð½‘¥Øø(€€€€ì)ô()™Õ¹Ñ¥½¸•Ñ%¹Ù•¹Ñ½Éå¡…É…Ñ•ÉÉ¥Ñ¥…±MÑ…ÑÌ¡¥¹‘•à¥ì(€€€½¹ÍÐ¡…É…Ñ•Èõ•Ñ	…­Á…­¡…É…Ñ•È¡¥¹‘•à¤ì((€€€¥˜ …¡…É…Ñ•È¥ì(€€€€€€€É•ÑÕÉ¸¹Õ±°ì(€€€ô((€€€€¼¨(€€€€€€XÄÄã¾òk¢3–2¢¦ÏžÒÃ¢ÎšZg–B3š¶—¦†¿ž’ëž&§žB¾ò?šÎW¢†O–§––_ž"šN+Ž(€€€€€€ƒ–>«–k¦†¿ž’ë¾ò3–³–ò?¢"É½±±É¥Ñ¥…° ¤ƒ’þwš2’â¢Ó¾òh(€€€€€€ƒž&§žBžr,…ÑÑ…¯ŽšÎW¢†Ožr,¥¹Ñ•±±¥•¹—Ž(€€€€¨¼(€€€½¹ÍÐÉ…•	Õ™˜ô(€€€€€€€€ (€€€€€€€€€€€€¡¡…É…Ñ•È˜™¡…É…Ñ•È¹…Ñ¥Ù•	Õ™™Ì¥ñð(€€€€€€€€€€€mt(€€€€€€€€¤(€€€€€€€€¹™¥¹ (€€€€€€€€€€€‰Õ™˜ôù‰Õ™˜¹ÑåÁ”ôôô‰É…”ˆ(€€€€€€€€¤ì((€€€™Õ¹Ñ¥½¸‰Õ¥±‘É¥Ñ¥…±AÉ½™¥±”¡ÍÑ…ÑA½¥¹ÑÌ±¡…¹•A•ÉA½¥¹Ð±µÕ±Ñ¥Á±¥•ÉA•ÉA½¥¹Ð¥ì(€€€€€€€±•ÐÉ¥Ñ¡…¹”ô(€€€€€€€€€€€5…Ñ ¹µ¥¸ (€€€€€€€€€€€€€€€I%Q}!9}5`°(€€€€€€€€€€€€€€€I%Q}!9}	M¬(€€€€€€€€€€€€€€€ÍÑ…ÑA½¥¹ÑÌ¨(€€€€€€€€€€€€€€€¡…¹•A•ÉA½¥¹Ð(€€€€€€€€€€€€¤ì((€€€€€€€±•ÐÉ¥Ñ5Õ±Ñ¥Á±¥•Èô(€€€€€€€€€€€5…Ñ ¹µ¥¸ (€€€€€€€€€€€€€€€I%Q}5U1Q%A1%I}QQI%	UQ}5`°(€€€€€€€€€€€€€€€I%Q}5U1Q%A1%I}	M¬(€€€€€€€€€€€€€€€ÍÑ…ÑA½¥¹ÑÌ¨(€€€€€€€€€€€€€€€µÕ±Ñ¥Á±¥•ÉA•ÉA½¥¹Ð(€€€€€€€€€€€€¤ì((€€€€€€€¥˜¡É…•	Õ™˜¥ì(€€€€€€€€€€€É¥Ñ¡…¹”¬ô(€€€€€€€€€€€€€€€É…•	Õ™˜¹‰½¹ÕÍA•É•¹Ðì((€€€€€€€€€€€É¥Ñ5Õ±Ñ¥Á±¥•Èô(€€€€€€€€€€€€€€€€Ä¬(€€€€€€€€€€€€€€€É…•	Õ™˜¹‰½¹ÕÍA•É•¹Ð¼(€€€€€€€€€€€€€€€€ÄÀÀì(€€€€€€€ô((€€€€€€€É•ÑÕÉ¸ì(€€€€€€€€€€€¡…¹”éÉ¥Ñ¡…¹”°(€€€€€€€€€€€µÕ±Ñ¥Á±¥•ÈéÉ¥Ñ5Õ±Ñ¥Á±¥•È(€€€€€€€ôì(€€€ô((€€€É•ÑÕÉ¸ì(€€€€€€€Á¡åÍ¥…°é‰Õ¥±‘É¥Ñ¥…±AÉ½™¥±” (€€€€€€€€€€€€¡¡…É…Ñ•È¹…ÑÑ…­ñðÀ¤°(€€€€€€€€€€€I%Q}!9}AI}QQ-}A=%9P°(€€€€€€€€€€€I%Q}5U1Q%A1%I}AI}QQ-}A=%9P(€€€€€€€€¤°(€€€€€€€µ…¥Œé‰Õ¥±‘É¥Ñ¥…±AÉ½™¥±” (€€€€€€€€€€€€¡•Ñ	…­Á…­¡…É…Ñ•ÉMÑ…ÑÌ¡¥¹‘•à¤¹¥¹Ñ•±±¥•¹•ñðÀ¤°(€€€€€€€€€€€I%Q}!9}AI}%9Q11%9}A=%9P°(€€€€€€€€€€€I%Q}5U1Q%A1%I}AI}%9Q11%9}A=%9P(€€€€€€€€¤(€€€ôì)ô()™Õ¹Ñ¥½¸½Á•¹%¹Ù•¹Ñ½Éå¡…É…Ñ•É•Ñ…¥° ¥ì(€€€½¹ÍÐµ½‘…°ô ‰¥¹Ù•¹Ñ½Éå¡…É…Ñ•É•Ñ…¥±5½‘…°ˆ¤ì(€€€½¹ÍÐÑ¥Ñ±”ô ‰¥¹Ù•¹Ñ½Éå¡…É…Ñ•É•Ñ…¥±9…µ”ˆ¤ì(€€€½¹ÍÐ‰½‘äô ‰¥¹Ù•¹Ñ½Éå¡…É…Ñ•É•Ñ…¥±MÑ…ÑÌˆ¤ì((€€€¥˜ …µ½‘…°ñð€…Ñ¥Ñ±”ñð€…‰½‘ä¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô((€€€½¹ÍÐ¡…É…Ñ•Èô(€€€€€€€•Ñ	…­Á…­¡…É…Ñ•È (€€€€€€€€€€€¥¹Ù•¹Ñ½Éå¡…É…Ñ•É%¹‘•à(€€€€€€€€¤ì((€€€½¹ÍÐÍÑ…ÑÌô(€€€€€€€•Ñ	…­Á…­¡…É…Ñ•ÉMÑ…ÑÌ (€€€€€€€€€€€¥¹Ù•¹Ñ½Éå¡…É…Ñ•É%¹‘•à(€€€€€€€€¤ì((€€€½¹ÍÐÉ¥Ñ¥…°ô(€€€€€€€•Ñ%¹Ù•¹Ñ½Éå¡…É…Ñ•ÉÉ¥Ñ¥…±MÑ…ÑÌ (€€€€€€€€€€€¥¹Ù•¹Ñ½Éå¡…É…Ñ•É%¹‘•à(€€€€€€€€¤ì((€€€¥˜ …¡…É…Ñ•Èñð€…ÍÑ…ÑÌñð€…É¥Ñ¥…°¥ì(€€€€€€€Ñ¥Ñ±”¹Ñ•áÑ½¹Ñ•¹Ðô‹¢žK¢&Ë¢¦ÏžÒÃ¢Î¢¢(ˆì(€€€€€€€‰½‘ä¹¥¹¹•É!Q50ôœñ‘¥Ø±…ÍÌô‰¥¹Ù•¹Ñ½Éäµ•µÁÑäµ¡…É…Ñ•Èˆû¢žK¢&Ë–Âkšr«–îëž®,ð½‘¥Øøœì(€€€€€€€µ½‘…°¹±…ÍÍ1¥ÍÐ¹…‘ ‰Í¡½Üˆ¤ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô((€€€Ñ¥Ñ±”¹Ñ•áÑ½¹Ñ•¹Ðô(€€€€€€€€‘í¡…É…Ñ•È¹¥ñð€‹¢žK¢&Èˆ¬¡¥¹Ù•¹Ñ½Éå¡…É…Ñ•É%¹‘•à¬Ä¥÷Ž1Ø¸‘í¡…É…Ñ•È¹±•Ù•±ñðÅõ€ì((€€€½¹ÍÐÉ½ÝÌõl(€€€€€€€l‰!@ˆ±ÍÑ…ÑÌ¹µ…á!At°(€€€€€€€l‰M@ˆ±ÍÑ…ÑÌ¹µ…áMAt°(€€€€€€€l‹šRïšN(ˆ±ÍÑ…ÑÌ¹…ÑÑ…­t°(€€€€€€€l‹¦bËžš˜ˆ±ÍÑ…ÑÌ¹‘•™•¹Í•t°(€€€€€€€l‹šfë–*lˆ±ÍÑ…ÑÌ¹¥¹Ñ•±±¥•¹•t°(€€€€€€€l‹¦®S¢Î¨ˆ±ÍÑ…ÑÌ¹Ù¥Ñ…±¥Ñåt°(€€€€€€€l‹¢÷¦<ˆ±ÍÑ…ÑÌ¹•¹•Éåt°(€€€€€€€l‹žÊûž–xˆ±ÍÑ…ÑÌ¹ÍÁ¥É¥Ñt°(€€€€€€€l‹šV?š6Üˆ±ÍÑ…ÑÌ¹…¥±¥Ñåt°(€€€€€€€l‹–F÷’â´ˆ±ÍÑ…ÑÌ¹…ÕÉ…åt°(€€€€€€€l‹¦Z¦üˆ±ÍÑ…ÑÌ¹•Ù…Í¥½¹t°(€€€€€€€l‹žVÃ–âãš*_šœˆ±ÍÑ…ÑÌ¹É•Í¥ÍÑ…¹”¹Ñ½¥á• Ä¤¬ˆ”‰t°(€€€€€€€l‹š*_šjÐˆ±ÍÑ…ÑÌ¹…¹Ñ¥É¥Ð¹Ñ½¥á• Ä¤¬ˆ”‰t°(€€€€€€€l‹ž&§žBž"šN+ž:ˆ±É¥Ñ¥…°¹Á¡åÍ¥…°¹¡…¹”¹Ñ½¥á• Ä¤¬ˆ”‰t°(€€€€€€€l‹ž&§žBž"šN+–
ß–ºÌˆ°¡É¥Ñ¥…°¹Á¡åÍ¥…°¹µÕ±Ñ¥Á±¥•È¨ÄÀÀ¤¹Ñ½¥á• Ä¤¬ˆ”‰t°(€€€€€€€l‹šÎW¢†Ož"šN+ž:ˆ±É¥Ñ¥…°¹µ…¥Œ¹¡…¹”¹Ñ½¥á• Ä¤¬ˆ”‰t°(€€€€€€€l‹šÎW¢†Ož"šN+–
ß–ºÌˆ°¡É¥Ñ¥…°¹µ…¥Œ¹µÕ±Ñ¥Á±¥•È¨ÄÀÀ¤¹Ñ½¥á• Ä¤¬ˆ”‰t(€€€tì((€€€‰½‘ä¹¥¹¹•É!Q50ô(€€€€€€€É½ÝÌ¹µ…À (€€€€€€€€€€€€¡m¹…µ”±Ù…±Õ•t¤ôù€(€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÌô‰¥¹Ù•¹Ñ½Éäµ¡…É…Ñ•Èµ‘•Ñ…¥°µÉ½Üˆø(€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ø‘í¹…µ•ôð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€ñˆø‘íÙ…±Õ•ôð½ˆø(€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€(€€€€€€€€¤¹©½¥¸ ˆˆ¤¬(€€€€€€€€ñ‘¥Ø±…ÍÌô‰¥¹Ù•¹Ñ½Éäµ¡…É…Ñ•Èµ‘•Ñ…¥°µ¹½Ñ”ˆø(€€€€€€€€€€€ƒ–~ëž’;–F÷’â·ž:¾òu±…µÀ äÔ—¾ò/–F÷’â·\À¸Ì°€ÔÀ”°€ää”§¾ò3–#’æc’â( Ç¾ò7žn»š¢gšržÖ¦Z¢êËž:§¾ò3šr–ú3–7š&¦f“šj#žr§ž¶'Ž3šržÖ–F÷’â·ž:¦f7’ö;Ž7šV#šzs¾ò#šr’ö8Ä—¾ò'Žñ‰Èø(€€€€€€€€€€€ƒ’â¢"³žVÃ–âãš¾<ÇžÊûž–{¦f7’ö8À¸À×–/žfû–"¦î{–F÷’â·ž:¾òoš¾<ÇšV?š6ß¾òt¬Ç¦–ê›Ž¬À¸Û–/žfû–"¦î{–~ëž’;¦Z¢êËŽ(€€€€€€€€ð½‘¥Øù€ì((€€€µ½‘…°¹±…ÍÍ1¥ÍÐ¹…‘ ‰Í¡½Üˆ¤ì)ô()™Õ¹Ñ¥½¸±½Í•%¹Ù•¹Ñ½Éå¡…É…Ñ•É•Ñ…¥° ¥ì(€€€½¹ÍÐµ½‘…°ô ‰¥¹Ù•¹Ñ½Éå¡…É…Ñ•É•Ñ…¥±5½‘…°ˆ¤ì((€€€¥˜¡µ½‘…°¥ì(€€€€€€€µ½‘…°¹±…ÍÍ1¥ÍÐ¹É•µ½Ù” ‰Í¡½Üˆ¤ì(€€€ô)ô()™Õ¹Ñ¥½¸É•¹‘•ÉÅÕ¥Áµ•¹Ð ¥ì(€€€½¹ÍÐÉ¥ô ‰•ÅÕ¥Áµ•¹ÑÉ¥ˆ¤ì(€€€¥˜ …É¥¤É•ÑÕÉ¸ì(€€€É¥¹¥¹¹•É!Q50ôˆˆì((€€€½¹ÍÐ­•äõ•Ñ	…­Á…­ÅÕ¥Áµ•¹Ñ-•ä¡¥¹Ù•¹Ñ½Éå¡…É…Ñ•É%¹‘•à¤ì(€€€½¹ÍÐ•ÅÕ¥Áµ•¹Ðõ­•ä€ü¡…É…Ñ•ÉÅÕ¥Áµ•¹Ñm­•åt€è¹Õ±°ì((€€€½¹ÍÐÍ±½ÑÌõl(€€€€€€€í­•äè‰¡•…ˆ±¹…µ”è‹¦‚´‰ô°(€€€€€€€í­•äè‰¡…¹ˆ±¹…µ”è‹š&,‰ô°(€€€€€€€í­•äè‰Í¡½Õ±‘•Èˆ±¹…µ”è‹¢¶ß¢T‰ô°(€€€€€€€í­•äè‰…Éµ½Èˆ±¹…µ”è‹¢†šr4‰ô°(€€€€€€€í­•äè‰Í¡½•Ìˆ±¹…µ”è‹¦z/–¶@‰ô°(€€€€€€€í­•äè‰É¥¹œˆ±¹…µ”è‹š"Kš2‰ô(€€€tì((€€€Í±½ÑÌ¹™½É… ¡Í±½Ðôùì(€€€€€€€½¹ÍÐ•±°õ‘½Õµ•¹Ð¹É•…Ñ•±•µ•¹Ð ‰‘¥Øˆ¤ì(€€€€€€€•±°¹±…ÍÍ9…µ”ô‰¥¹Ù•¹Ñ½Éäµ•ÅÕ¥Áµ•¹Ðµ•±°ˆì((€€€€€€€½¹ÍÐ±…‰•°õ‘½Õµ•¹Ð¹É•…Ñ•±•µ•¹Ð ‰‘¥Øˆ¤ì(€€€€€€€±…‰•°¹±…ÍÍ9…µ”ô‰¥¹Ù•¹Ñ½Éäµ•ÅÕ¥Áµ•¹ÐµÍ±½Ðµ±…‰•°ˆì(€€€€€€€±…‰•°¹Ñ•áÑ½¹Ñ•¹ÐõÍ±½Ð¹¹…µ”ì((€€€€€€€½¹ÍÐ‰½àõ‘½Õµ•¹Ð¹É•…Ñ•±•µ•¹Ð ‰‘¥Øˆ¤ì(€€€€€€€‰½à¹±…ÍÍ9…µ”ô‰¥¹Ù•¹Ñ½Éäµ•ÅÕ¥Áµ•¹ÐµÍ±½Ðˆì(€€€€€€€½¹ÍÐ¥Ñ•´õ•ÅÕ¥Áµ•¹Ð€ü•ÅÕ¥Áµ•¹ÑmÍ±½Ð¹­•åt€è¹Õ±°ì((€€€€€€€¥˜¡¥Ñ•´¥ì(€€€€€€€€€€€‰½à¹±…ÍÍ1¥ÍÐ¹…‘ ‰¡…Ìµ¥Ñ•´ˆ¤ì(€€€€€€€€€€€‰½à¹¥¹¹•É!Q50õ€ñ‘¥Ø±…ÍÌô‰¥¹Ù•¹Ñ½Éäµ•ÅÕ¥Áµ•¹Ðµ¥½¸ˆø‘í¥Ñ•´¹¥½¸ñð€‹Š^‰ôð½‘¥Øù€ì(€€€€€€€€€€€‰½à¹Ñ¥Ñ±”õ¥Ñ•´¹¹…µ”ñðÍ±½Ð¹¹…µ”ì(€€€€€€€€€€€‰½à¹½¹±¥¬ô ¤ôù½Á•¹ÅÕ¥ÁÁ•‘%Ñ•´¡¥Ñ•´±Í±½Ð¹­•ä¤ì(€€€€€€€õ•±Í•ì(€€€€€€€€€€€‰½à¹¥¹¹•É!Q50õ€ñ‘¥Ø±…ÍÌô‰¥¹Ù•¹Ñ½Éäµ•ÅÕ¥Áµ•¹Ðµ¥½¸•µÁÑäˆû¾ò,ð½‘¥Øù€ì(€€€€€€€ô((€€€€€€€•±°¹…ÁÁ•¹‘¡¥±¡±…‰•°¤ì(€€€€€€€•±°¹…ÁÁ•¹‘¡¥±¡‰½à¤ì(€€€€€€€É¥¹…ÁÁ•¹‘¡¥±¡•±°¤ì(€€€ô¤ì)ô()™Õ¹Ñ¥½¸•Ñ¥±Ñ•É•‘%¹Ù•¹Ñ½Éå%Ñ•µÌ ¥ì(€€€½¹ÍÐ•ÅÕ¥Áµ•¹ÑQåÁ•Ìõl(€€€€€€€€‰Ý•…Á½¸ˆ°(€€€€€€€€‰¡•±µ•Ðˆ°(€€€€€€€€‰¡•…ˆ°(€€€€€€€€‰Í¡½Õ±‘•Èˆ°(€€€€€€€€‰…Éµ½Èˆ°(€€€€€€€€‰Í¡½•Ìˆ°(€€€€€€€€‰…•ÍÍ½Éäˆ°(€€€€€€€€‰É¥¹œˆ(€€€tì((€€€½¹ÍÐ™Õ¹Ñ¥½¹QåÁ•Ìõl(€€€€€€€€‰™Õ¹Ñ¥½¸ˆ°(€€€€€€€€‰ÕÑ¥±¥Ñäˆ°(€€€€€€€€‰­•äˆ°(€€€€€€€€‰ÅÕ•ÍÐˆ°(€€€€€€€€‰ÍÁ•¥…°ˆ(€€€tì((€€€É•ÑÕÉ¸¥¹Ù•¹Ñ½Éå%Ñ•µÌ¹™¥±Ñ•È¡¥Ñ•´ôùì(€€€€€€€¥˜ …¥Ñ•´¤É•ÑÕÉ¸™…±Í”ì(€€€€€€€¥˜¡IQ%I}	-A-}A=Q%=9}%L¹¡…Ì¡MÑÉ¥¹œ¡¥Ñ•´¹¥‘ñðˆˆ¤¤¤É•ÑÕÉ¸™…±Í”ì((€€€€€€€¥˜¡¥¹Ù•¹Ñ½Éå¥±Ñ•Èôôô‰•ÅÕ¥Áµ•¹Ðˆ¥ì(€€€€€€€€€€€É•ÑÕÉ¸•ÅÕ¥Áµ•¹ÑQåÁ•Ì¹¥¹±Õ‘•Ì¡¥Ñ•´¹ÑåÁ”¤ì(€€€€€€€ô((€€€€€€€¥˜¡¥¹Ù•¹Ñ½Éå¥±Ñ•Èôôô‰µ…Ñ•É¥…°ˆ¥ì(€€€€€€€€€€€É•ÑÕÉ¸¥Ñ•´¹ÑåÁ”ôôô‰µ…Ñ•É¥…°ˆì(€€€€€€€ô((€€€€€€€¥˜¡¥¹Ù•¹Ñ½Éå¥±Ñ•Èôôô‰™Õ¹Ñ¥½¸ˆ¥ì(€€€€€€€€€€€É•ÑÕÉ¸™Õ¹Ñ¥½¹QåÁ•Ì¹¥¹±Õ‘•Ì¡¥Ñ•´¹ÑåÁ”¤ì(€€€€€€€ô((€€€€€€€€¼¨(€€€€€€€€€€ƒŽ3ž&§–NŽ7š&ÿš:—¢^—šÂÓ¢"’â¢"³ž&§–NŽ(€€€€€€€€€€ƒšr«’ú–ššzsšZÃ–Š{–Âkšr«š¶ã¦†{žjšZÀÑåÁ—¾ò3’æ–#žVg–r£ž&§–N¦‚¾ò0(€€€€€€€€€€ƒ¦ÿ–7–nƒž
èU$ƒ–"¦†{šnÓšZÃ¦ƒš"Cš^‹šr'ž&§–NšGž¦ëžr/’â7–"ÃŽ(€€€€€€€€¨¼(€€€€€€€É•ÑÕÉ¸€ (€€€€€€€€€€€€…•ÅÕ¥Áµ•¹ÑQåÁ•Ì¹¥¹±Õ‘•Ì¡¥Ñ•´¹ÑåÁ”¤€˜˜(€€€€€€€€€€€¥Ñ•´¹ÑåÁ”„ôô‰µ…Ñ•É¥…°ˆ€˜˜(€€€€€€€€€€€€…™Õ¹Ñ¥½¹QåÁ•Ì¹¥¹±Õ‘•Ì¡¥Ñ•´¹ÑåÁ”¤(€€€€€€€€¤ì(€€€ô¤ì)ô()™Õ¹Ñ¥½¸Í•Ñ%¹Ù•¹Ñ½Éå¥±Ñ•È¡™¥±Ñ•È¥ì(€€€¥¹Ù•¹Ñ½Éå¥±Ñ•Èõ™¥±Ñ•Èì(€€€É•¹‘•É%¹Ù•¹Ñ½Éå%Ñ•µÌ ¤ì((€€€½¹ÍÐÍÉ½±±•Èô ‰¥¹Ù•¹Ñ½ÉåÉ¥‘MÉ½±°ˆ¤ì(€€€¥˜¡ÍÉ½±±•È¤ÍÉ½±±•È¹ÍÉ½±±Q½ÀôÀì)ô()™Õ¹Ñ¥½¸É•¹‘•É%¹Ù•¹Ñ½Éå%Ñ•µÌ ¥ì(€€€É•‰Õ¥±‘%¹Ù•¹Ñ½ÉåM±½ÑÌ ¤ì(€€€½¹ÍÐÉ¥ô ‰¥¹Ù•¹Ñ½ÉåÉ¥ˆ¤ì(€€€¥˜ …É¥¤É•ÑÕÉ¸ì(€€€É¥¹¥¹¹•É!Q50ôˆˆì((€€€½¹ÍÐ¥Ñ•µÌõ•Ñ¥±Ñ•É•‘%¹Ù•¹Ñ½Éå%Ñ•µÌ ¤¹Í±¥” À±%9Y9Q=Ie}Q=Ie}M1=Q}=U9P¤ì((€€€™½È¡±•Ð¥¹‘•àôÀí¥¹‘•àñ%9Y9Q=Ie}Q=Ie}M1=Q}=U9Pí¥¹‘•à¬¬¥ì(€€€€€€€½¹ÍÐ¥Ñ•´õ¥Ñ•µÍm¥¹‘•átñð¹Õ±°ì(€€€€€€€½¹ÍÐ‰½àõ‘½Õµ•¹Ð¹É•…Ñ•±•µ•¹Ð ‰‘¥Øˆ¤ì(€€€€€€€‰½à¹±…ÍÍ9…µ”ô‰¥¹Ù•¹Ñ½Éäµ¥Ñ•´¥¹Ù•¹Ñ½Éäµ¥Ñ•´µ±…ÍÍ¥Œ€ˆ¬¡¥Ñ•´€ü€‰¡…Ìµ¥Ñ•´ˆè‰•µÁÑäˆ¤ì(€€€€€€€‰½à¹¥¹¹•É!Q50õ€ñ‘¥Ø±…ÍÌô‰¥¹Ù•¹Ñ½ÉäµÍ±½Ðµ¹Õµ‰•Èˆø‘í¥¹‘•à¬Åôð½‘¥Øù€ì((€€€€€€€¥˜¡¥Ñ•´¥ì(€€€€€€€€€€€‰½à¹¥¹¹•É!Q50¬õ€ñ‘¥Ø±…ÍÌô‰¥¹Ù•¹Ñ½Éäµ¥½¸ˆø‘í¥Ñ•´¹¥½¸ñð€‹Š^‰ôð½‘¥Øøñ‘¥Ø±…ÍÌô‰¥¹Ù•¹Ñ½Éäµ½Õ¹Ðˆø‘í¥Ñ•´¹½Õ¹ÐøÄ€ü€‹\ˆ­¥Ñ•´¹½Õ¹Ð€è€ˆ‰ôð½‘¥Øù€ì(€€€€€€€€€€€½¹ÍÐÉ•…±%¹‘•àõ¥¹Ù•¹Ñ½Éå%Ñ•µÌ¹¥¹‘•á=˜¡¥Ñ•´¤ì€€€€€€€€€€€‰½à¹½¹±¥¬ô ¤ôù½Á•¹%Ñ•µ5½‘…°¡É•…±%¹‘•à¤ì(€€€€€€€õ•±Í•ì(€€€€€€€€€€€‰½à¹¥¹¹•É!Q50¬ôœñ‘¥Ø±…ÍÌô‰¥¹Ù•¹Ñ½Éäµ•µÁÑäµ‘½Ðˆû
Üð½‘¥Øøœì(€€€€€€€ô(€€€€€€€É¥¹…ÁÁ•¹‘¡¥±¡‰½à¤ì(€€€ô((€€€‘½Õµ•¹Ð¹ÅÕ•ÉåM•±•Ñ½É±° ˆ¥¹Ù•¹Ñ½Éå…Ñ•½ÉåQ…‰Ìm‘…Ñ„µ™¥±Ñ•Étˆ¤¹™½É… ¡Ñ…ˆôùì(€€€€€€€½¹ÍÐ…Ñ¥Ù”õÑ…ˆ¹‘…Ñ…Í•Ð¹™¥±Ñ•Èôôõ¥¹Ù•¹Ñ½Éå¥±Ñ•Èì(€€€€€€€Ñ…ˆ¹±…ÍÍ1¥ÍÐ¹Ñ½±” ‰…Ñ¥Ù”ˆ±…Ñ¥Ù”¤ì(€€€€€€€Ñ…ˆ¹Í•ÑÑÑÉ¥‰ÕÑ” ‰…É¥„µÍ•±•Ñ•ˆ±…Ñ¥Ù”€ü€‰ÑÉÕ”ˆ€è€‰™…±Í”ˆ¤ì(€€€ô¤ì((€€€¥˜¡ÑåÁ•½˜Ý¥¹‘½Ü„ôô‰Õ¹‘•™¥¹•ˆ˜™ÑåÁ•½˜Ý¥¹‘½Ü¹ØÄÜÌØÍMå¹Õ¹Ñ¥½¹…±¥á•Ìôôô‰™Õ¹Ñ¥½¸ˆ¥ìÝ¥¹‘½Ü¹ØÄÜÌØÍMå¹Õ¹Ñ¥½¹…±¥á•Ì ¤ìô)ô()™Õ¹Ñ¥½¸É•¹‘•É%¹Ù•¹Ñ½Éä ¥ì(€€€½¹ÍÐ¡…É…Ñ•Èõ•Ñ	…­Á…­¡…É…Ñ•È¡¥¹Ù•¹Ñ½Éå¡…É…Ñ•É%¹‘•à¤ì(€€€½¹ÍÐ¹…µ•°ô ‰¥¹Ù•¹Ñ½Éå¡…É…Ñ•É9…µ”ˆ¤ì(€€€¥˜¡¹…µ•°¥ì(€€€€€€€¹…µ•°¹Ñ•áÑ½¹Ñ•¹Ðõ¡…É…Ñ•È€ü€‘í¡…É…Ñ•È¹¥ñð€‹¢žK¢&Èˆ¬¡¥¹Ù•¹Ñ½Éå¡…É…Ñ•É%¹‘•à¬Ä¥÷Ž1Ø¸‘í¡…É…Ñ•È¹±•Ù•±ñðÅõ€€èƒ¢žK¢&È‘í¥¹Ù•¹Ñ½Éå¡…É…Ñ•É%¹‘•à¬Å÷Ž–Âkšr«–îëž®-€ì(€€€ô((€€€É•¹‘•É%¹Ù•¹Ñ½Éå¡…É…Ñ•ÉQ…‰Ì ¤ì(€€€É•¹‘•ÉÅÕ¥Áµ•¹Ð ¤ì(€€€É•¹‘•É%¹Ù•¹Ñ½Éå%Ñ•µÌ ¤ì)ô((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€ƒž&§–N¢¦ÏžÒÀ(ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼()™Õ¹Ñ¥½¸•ÑMÑ…ÑQ•áÐ¡ÍÑ…ÑÌ¥ì((€€€¥˜ (€€€€€€€€…ÍÑ…ÑÌñð(€€€€€€€=‰©•Ð¹­•åÌ¡ÍÑ…ÑÌ¤¹±•¹Ñ ôôôÀ(€€€€¥ì((€€€€€€€É•ÑÕÉ¸‹šÊKšr'¦†7–’[¢÷–*o–*ƒš"CŽˆì((€€€ô(((€€€½¹ÍÐ¹…µ•Ì€ôì((€€€€€€€…ÑÑ…¬è‹šRïšN(ˆ°((€€€€€€€Ù¥Ñ…±¥Ñäè‹¦®S¢Î¨ˆ°((€€€€€€€•¹•Éäè‹¢÷¦<ˆ°((€€€€€€€¥¹Ñ•±±¥•¹”è‹šfë–*lˆ°((€€€€€€€ÍÁ¥É¥Ðè‹žÊûž–xˆ°((€€€€€€€…¥±¥Ñäè‹šV?š6Üˆ°((€€€€€€€µ…á!@è‹šr–’!@ˆ°((€€€€€€€µ…áM@è‹šr–’M@ˆ°((€€€€€€€‘•™•¹Í”è‹¦bËžš˜ˆ((€€€ôì(((€€€±•Ð¡Ñµ°ôˆˆì(((€€€=‰©•Ð¹­•åÌ¡ÍÑ…ÑÌ¤(€€€€¹™½É… ¡­•äôùì((€€€€€€€½¹ÍÐÙ…±Õ”€ô(€€€€€€€€€€€ÍÑ…ÑÍm­•åtì(((€€€€€€€¥˜ …Ù…±Õ”¥ì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€ô(((€€€€€€€¡Ñµ°€¬ô((€€€€€€€€(€€€€€€€€ñ‘¥Øø(€€€€€€€€€€€€‘í¹…µ•Ím­•åuññ­•å÷¾òh(€€€€€€€€€€€€ñˆø¬‘íÙ…±Õ•ôð½ˆø(€€€€€€€€ð½‘¥Øø(€€€€€€€€ì((€€€ô¤ì(((€€€É•ÑÕÉ¸¡Ñµ°ñð(€€€€€€€€‹šÊKšr'¦†7–’[¢÷–*o–*ƒš"CŽˆì()ô(()™Õ¹Ñ¥½¸½Á•¹%Ñ•µ5½‘…° (€€€Í±½Ñ%¹‘•à(¥ì((€€€½¹ÍÐ¥Ñ•´€ô(€€€€€€€¥¹Ù•¹Ñ½ÉåM±½ÑÍl(€€€€€€€€€€€Í±½Ñ%¹‘•à(€€€€€€€tì(((€€€¥˜ …¥Ñ•´¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€Í•±•Ñ•‘%¹Ù•¹Ñ½ÉåM±½Ð€ô(€€€€€€€Í±½Ñ%¹‘•àì(((€€€€ ‰¥Ñ•µ5½‘…±%½¸ˆ¤(€€€€€€€€¹Ñ•áÑ½¹Ñ•¹Ð€ô(€€€€€€€¥Ñ•´¹¥½¸ì(((€€€€ ‰¥Ñ•µ5½‘…±9…µ”ˆ¤(€€€€€€€€¹Ñ•áÑ½¹Ñ•¹Ð€ô(€€€€€€€¥Ñ•´¹¹…µ”ì(((€€€€ ‰¥Ñ•µ5½‘…±MÑ…ÑÌˆ¤(€€€€€€€€¹¥¹¹•É!Q50€ô((€€€€€€€€(€€€€€€€€‘ì(€€€€€€€€€€€¥Ñ•´¹ÑåÁ”ôôô‰Á½Ñ¥½¸ˆ(€€€€€€€€€€€€ü(€€€€€€€€€€€€ñ‘¥ØûšV#šzs¾òhñˆø‘í•ÑA½Ñ¥½¹™™•Ñ•ÍÉ¥ÁÑ¥½¸¡¥Ñ•´¹¥¥ôð½ˆøð½‘¥Øù€(€€€€€€€€€€€€è(€€€€€€€€€€€•ÑMÑ…ÑQ•áÐ¡¥Ñ•´¹ÍÑ…ÑÌ¤(€€€€€€€ô((€€€€€€€€ñ‘¥Ø(€€€€€€€€€€€ÍÑå±”ôˆ(€€€€€€€€€€€€€€€µ…É¥¸µÑ½ÀèÝÁàì(€€€€€€€€€€€€€€€½±½ÈèˆÍ„ÔáŒì(€€€€€€€€€€€€ˆ(€€€€€€€€ø(€€€€€€€€€€€ƒ–R»–ç¾òh‘í¥Ñ•´¹ÁÉ¥•ñðÁôƒ¦G–æŒ(€€€€€€€€ð½‘¥Øø(€€€€€€€€ì(((€€€½¹ÍÐ•ÅÕ¥Á	ÕÑÑ½¸€ô(€€€€€€€€ ‰¥Ñ•µÅÕ¥Á	ÕÑÑ½¸ˆ¤ì(((€€€•ÅÕ¥Á	ÕÑÑ½¸¹É•µ½Ù•ÑÑÉ¥‰ÕÑ” (€€€€€€€€‰‘…Ñ„µÍ±½Ðˆ(€€€€¤ì(((€€€¥˜¡¥Ñ•´¹ÑåÁ”ôôô‰Á½Ñ¥½¸ˆ¥ì((€€€€€€€•ÅÕ¥Á	ÕÑÑ½¸¹‘¥Í…‰±•õÑÉÕ”ì((€€€€€€€•ÅÕ¥Á	ÕÑÑ½¸¹Ñ•áÑ½¹Ñ•¹Ð€ô(€€€€€€€€€€€€‹’â7–>¿¢Žw–
dˆì((€€€€€€€•ÅÕ¥Á	ÕÑÑ½¸¹ÍÑå±”¹½Á…¥Ñä€ô(€€€€€€€€€€€€ˆ¸Ðˆì((€€€ô(€€€•±Í•ì((€€€€€€€•ÅÕ¥Á	ÕÑÑ½¸¹‘¥Í…‰±•õ™…±Í”ì((€€€€€€€•ÅÕ¥Á	ÕÑÑ½¸¹Ñ•áÑ½¹Ñ•¹Ð€ô(€€€€€€€€€€€€‹ž¦ÿš"Ðˆì((€€€€€€€•ÅÕ¥Á	ÕÑÑ½¸¹ÍÑå±”¹½Á…¥Ñä€ô(€€€€€€€€€€€€ˆÄˆì((€€€ô(((€€€€ ‰¥Ñ•µ5½‘…°ˆ¤(€€€€€€€€¹±…ÍÍ1¥ÍÐ(€€€€€€€€¹…‘ ‰Í¡½Üˆ¤ì()ô(()™Õ¹Ñ¥½¸½Á•¹ÅÕ¥ÁÁ•‘%Ñ•´ (€€€¥Ñ•´°(€€€Í±½Ð(¥ì((€€€Í•±•Ñ•‘%¹Ù•¹Ñ½ÉåM±½Ð€ô(€€€€€€€¹Õ±°ì(((€€€€ ‰¥Ñ•µ5½‘…±%½¸ˆ¤(€€€€€€€€¹Ñ•áÑ½¹Ñ•¹Ð€ô(€€€€€€€¥Ñ•´¹¥½¸ì(((€€€€ ‰¥Ñ•µ5½‘…±9…µ”ˆ¤(€€€€€€€€¹Ñ•áÑ½¹Ñ•¹Ð€ô(€€€€€€€¥Ñ•´¹¹…µ”¬(€€€€€€€€‹¾ò#–ÞË¢Žw–
g¾ò$ˆì(((€€€€ ‰¥Ñ•µ5½‘…±MÑ…ÑÌˆ¤(€€€€€€€€¹¥¹¹•É!Q50€ô(€€€€€€€•ÑMÑ…ÑQ•áÐ (€€€€€€€€€€€¥Ñ•´¹ÍÑ…ÑÌ(€€€€€€€€¤ì(((€€€½¹ÍÐ•ÅÕ¥Á	ÕÑÑ½¸€ô(€€€€€€€€ ‰¥Ñ•µÅÕ¥Á	ÕÑÑ½¸ˆ¤ì(((€€€•ÅÕ¥Á	ÕÑÑ½¸¹‘¥Í…‰±•õ™…±Í”ì((€€€•ÅÕ¥Á	ÕÑÑ½¸¹Ñ•áÑ½¹Ñ•¹Ð€ô(€€€€€€€€‹¢¯’â,ˆì((€€€•ÅÕ¥Á	ÕÑÑ½¸¹ÍÑå±”¹½Á…¥Ñä€ô(€€€€€€€€ˆÄˆì(((€€€•ÅÕ¥Á	ÕÑÑ½¸¹‘…Ñ…Í•Ð¹Í±½Ð€ô(€€€€€€€Í±½Ðì(((€€€€ ‰¥Ñ•µ5½‘…°ˆ¤(€€€€€€€€¹±…ÍÍ1¥ÍÐ(€€€€€€€€¹…‘ ‰Í¡½Üˆ¤ì()ô(()™Õ¹Ñ¥½¸±½Í•%Ñ•µ5½‘…° ¥ì((€€€Í•±•Ñ•‘%¹Ù•¹Ñ½ÉåM±½Ð€ô(€€€€€€€¹Õ±°ì(((€€€€ ‰¥Ñ•µÅÕ¥Á	ÕÑÑ½¸ˆ¤(€€€€€€€€¹É•µ½Ù•ÑÑÉ¥‰ÕÑ” (€€€€€€€€€€€€‰‘…Ñ„µÍ±½Ðˆ(€€€€€€€€¤ì(((€€€€ ‰¥Ñ•µ5½‘…°ˆ¤(€€€€€€€€¹±…ÍÍ1¥ÍÐ(€€€€€€€€¹É•µ½Ù” ‰Í¡½Üˆ¤ì()ô(((¼¨(€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3Ž3šZ–¶_–’«–’h(€€ƒ–†{’â7’â/¾ò3–ÂÇžÊûžÂ‡¦†¿ž’ë¾ò3–ú3¦v‹žR£Š›Š›¢¦ÏžÒÀ(€€ƒ¢ºOž:§–ºÛ¦î{šN+¢ÞÏ–ë–º3šVÓ’î/žÒçŽ7¾ò'¾òh(€€ƒš*¢÷¢¦ÏžÒÃ¢Î¢¢+–ö#žª_¾ò3¢Þž&§–N¢¦ÏžÒÃ–ö#žª_–ÇžR (€€ƒ–B3’â––\¹¥Ñ•´µµ½‘…³š¢–ò?Ž	Í¡½ÝM­¥±±•Ñ…¥° ¤(€€ƒ–Bš*¢õ%¾ò3¢«–ÞÇ¦7šZÃš~—’âš²‡žn»–&7¢žK¢&È¿ž¶'žÒh(€€ƒž.š/¾ò3žÖ–ë–º3šVÓ¢ª«šb;šZ–¶_¾ò#’â7š"«šZß¾ò'Ž(¨¼((¼¨(€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3Ž3’â7žº‡š*¢÷šr'šÊKšr$(€€ƒ–¶ãžþK¾ò3¢¦ÏžÒÃ¢Î¢¢+¦÷¢šš*+š¾?š²‡–6žÒk–Š{–*ƒ–’k–ÂD(€€ƒ¦î{–
ß–ºÏŽš¦ž:—šVãš;¦êóš>C–6¾ò3–º3šVÓ¦†¿ž’ëŽ7¾ò'¾òh(€€ƒš*+š*¢÷–úy1Ø¸Ç–"ÃšîÿžÒkš¾?’âžÒkžjšVã–ó¦÷šR“¦Z/’ú(€€ƒ–"_–ë’ú¾ò3’â7žº‡ž:§–ºÛžn»–&7–¶ã’êšÊK–¶ãŽ–¶ã–"Ãž²°(€€ƒ–æûžÒk¾ò3¦g¢Ž‡¦÷šb¿–º3šVÓžj’â’î÷žâ÷¢†£ŠSŠS–
ß–ºÌ(€€ƒš*¢÷¦†7–’[š¢g–ëŽ3š¾?žÒh­cŽ7žj–në–ºk–Š{¦?¾ò0(€€ƒšZç’úÿž:§–ºÛ’âžróžr/–ëš"C¦Vß–æ–ê›¾ò3’â7žR£¢«–ÞÄ(€€ƒ’âžÒk’âžÒk–:ï–þžº_–Þ»–’k–ÂGŽ(¨¼()™Õ¹Ñ¥½¸‰Õ¥±‘M­¥±±1•Ù•±	É•…­‘½Ý¹!Q50¡Í­¥±°¥ì((€€€½¹ÍÐµ…á1•Ù•°ô(€€€€€€€Í­¥±°¹µ…á1•Ù•±ñð(€€€€€€€€Äì(((€€€±•Ð±¥¹•Ìô(€€€€€€€mtì(((€€€™½È (€€€€€€€±•Ð±ØôÄì(€€€€€€€±Øðõµ…á1•Ù•°ì(€€€€€€€±Ø¬¬(€€€€¥ì((€€€€€€€±•ÐÁ…ÉÑÌô(€€€€€€€€€€€mtì(((€€€€€€€¥˜ (€€€€€€€€€€€€ (€€€€€€€€€€€€€€€Í­¥±°¹…Ñ•½Éäôôô‰Á¡åÍ¥…°‰ñð(€€€€€€€€€€€€€€€Í­¥±°¹…Ñ•½Éäôôô‰µ…¥Œˆ(€€€€€€€€€€€€¤€˜˜(€€€€€€€€€€€Í­¥±°¹‰…Í•…µ…”(€€€€€€€€¥ì((€€€€€€€€€€€½¹ÍÐ‘µœô(€€€€€€€€€€€€€€€•ÑM­¥±±…µ…•Ñ1•Ù•° (€€€€€€€€€€€€€€€€€€€Í­¥±°°(€€€€€€€€€€€€€€€€€€€±Ø(€€€€€€€€€€€€€€€€¤ì(((€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ  (€€€€€€€€€€€€€€€€‹–
ß–ºÌˆ¬(€€€€€€€€€€€€€€€5…Ñ ¹™±½½È¡‘µœ¤¬((€€€€€€€€€€€€€€€€ (€€€€€€€€€€€€€€€€€€€Í­¥±°¹‘…µ…•A•É1•Ù•°(€€€€€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€€€€€€‹¾ò#š¾?žÒh¬ˆ¬(€€€€€€€€€€€€€€€€€€€Í­¥±°¹‘…µ…•A•É1•Ù•°¬(€€€€€€€€€€€€€€€€€€€€‹¾ò$ˆ(€€€€€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€€€€€¤((€€€€€€€€€€€€¤ì((€€€€€€€ô(((€€€€€€€¥˜ (€€€€€€€€€€€Í­¥±°¹‰ÕÉ¹¡…¹”€˜˜(€€€€€€€€€€€Í­¥±°¹‰ÕÉ¹A•É•¹Ñ	å1•Ù•°(€€€€€€€€¥ì((€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ  ((€€€€€€€€€€€€€€€Í­¥±°¹‰ÕÉ¹¡…¹”¬(€€€€€€€€€€€€€€€€ˆ—š¦ž:žžHˆ¬(€€€€€€€€€€€€€€€Í­¥±°¹‰ÕÉ¹A•É•¹Ñ	å1•Ù•±m±Ø´Åt¬(€€€€€€€€€€€€€€€€ˆ—šr–’!C¾ò?–n{–B ˆ((€€€€€€€€€€€€¤ì((€€€€€€€ô(((€€€€€€€¥˜¡Í­¥±°¹™É••é•¡…¹”¥ì((€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ  ((€€€€€€€€€€€€€€€Í­¥±°¹™É••é•¡…¹”¬(€€€€€€€€€€€€€€€€ˆ—š¦ž:–Ã–Âˆ¬(€€€€€€€€€€€€€€€Í­¥±°¹™É••é•ÕÉ…Ñ¥½¸¬(€€€€€€€€€€€€€€€€‹–n{–B ˆ((€€€€€€€€€€€€¤ì((€€€€€€€ô(((€€€€€€€¥˜¡Í­¥±°¹±¥™•ÍÑ•…±A•É•¹Ñ	å1•Ù•°¥ì(€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ  ‹–Bã–>[–
ß–ºÌˆ­Í­¥±°¹±¥™•ÍÑ•…±A•É•¹Ñ	å1•Ù•±m±Ø´Åt¬ˆ—¾ò#–n{–ú¥!@½MC¾ò$ˆ¤ì(€€€€€€€ô(€€€€€€€¥˜¡Í­¥±°¹…¥±¥Ñå½Ý¹	å1•Ù•°¥ì(€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ ¡Í­¥±°¹…¥±¥Ñå½Ý¹¡…¹”¬ˆ—¦f7šV<ˆ­Í­¥±°¹…¥±¥Ñå½Ý¹	å1•Ù•±m±Ø´Åt¬ˆ—¾ò0ˆ¬¡Í­¥±°¹…¥±¥Ñå½Ý¹ÕÉ…Ñ¥½¹ñðÈ¤¬‹–n{–B ˆ¤ì(€€€€€€€ô(€€€€€€€¥˜¡Í­¥±°¹ÍÑ…Ñ½Ý¹	å1•Ù•°¥ì(€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ ¡Í­¥±°¹ÍÑ…Ñ½Ý¹¡…¹”¬ˆ—¦f7¢÷–*lˆ­Í­¥±°¹ÍÑ…Ñ½Ý¹	å1•Ù•±m±Ø´Åt¬ˆ—¾ò0ˆ¬¡Í­¥±°¹ÍÑ…Ñ½Ý¹ÕÉ…Ñ¥½¹ñðÈ¤¬‹–n{–B ˆ¤ì(€€€€€€€ô(€€€€€€€¥˜¡Í­¥±°¹‘•™•¹Í•½Ý¹	å1•Ù•°¥ì(€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ ¡Í­¥±°¹‘•™•¹Í•½Ý¹¡…¹”¬ˆ—¦f7¦bÈˆ­Í­¥±°¹‘•™•¹Í•½Ý¹	å1•Ù•±m±Ø´Åt¬ˆ—¾ò0ˆ¬¡Í­¥±°¹‘•™•¹Í•½Ý¹ÕÉ…Ñ¥½¹ñðÈ¤¬‹–n{–B ˆ¤ì(€€€€€€€ô(€€€€€€€¥˜¡Í­¥±°¹µ¥ÍÍ	½¹ÕÍ	å1•Ù•°¥ì(€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ ¡Í­¥±°¹ÍÑÕ¹¡…¹”¬ˆ—šj#žr§¾ò15%ML€¬ˆ­Í­¥±°¹µ¥ÍÍ	½¹ÕÍ	å1•Ù•±m±Ø´Åt¬ˆ—¾ò0ˆ¬¡Í­¥±°¹ÍÑÕ¹ÕÉ…Ñ¥½¹ñðÈ¤¬‹–n{–B ˆ¤ì(€€€€€€€ô(€€€€€€€¥˜¡Í­¥±°¹Á•ÑÉ¥™å¡…¹•	å1•Ù•°¥ì(€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ ¡Í­¥±°¹Á•ÑÉ¥™å¡…¹•	å1•Ù•±m±Ø´Åt¬ˆ—ž~Ï–2[¾ò0ˆ¬¡Í­¥±°¹Á•ÑÉ¥™åÕÉ…Ñ¥½¹ñðÈ¤¬‹–n{–B ˆ¤ì(€€€€€€€ô(€€€€€€€¥˜¡Í­¥±°¹Í•±™M¡¥•±‘	å1•Ù•°¥ì(€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ  ‹¢«¢ê¯¢¶ßžnøˆ­Í­¥±°¹Í•±™M¡¥•±‘	å1•Ù•±m±Ø´Åt¬‹¦î{¾ò0ˆ¬¡Í­¥±°¹Í¡¥•±‘ÕÉ…Ñ¥½¹ñðÈ¤¬‹–n{–B ˆ¤ì(€€€€€€€ô(€€€€€€€¥˜¡Í­¥±°¹…±±åM¡¥•±‘	å1•Ù•°¥ì(€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ  ‹š"GšZç–£¦®S¢¶ßžnøˆ­Í­¥±°¹…±±åM¡¥•±‘	å1•Ù•±m±Ø´Åt¬‹¦î{¾ò0ˆ¬¡Í­¥±°¹Í¡¥•±‘ÕÉ…Ñ¥½¹ñðÈ¤¬‹–n{–B ˆ¤ì(€€€€€€€ô(((€€€€€€€¥˜¡Í­¥±°¹…Ñ•½Éäôôô‰‰Õ™˜ˆ˜™Í­¥±°¹É¥Ñ	½¹ÕÍ	å1•Ù•°¥ì(€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ  ‹ž"šN+ž:¾ò?ž"šN+–
ß–ºÌ€¬ˆ­Í­¥±°¹É¥Ñ	½¹ÕÍ	å1•Ù•±m±Ø´Åt¬ˆ—¾ò0ˆ­Í­¥±°¹‘ÕÉ…Ñ¥½¸¬‹–n{–B ˆ¤ì(€€€€€€€ô(€€€€€€€•±Í”¥˜¡Í­¥±°¹…Ñ•½Éäôôô‰‰Õ™˜ˆ˜™Í­¥±°¹•Ù…Í¥½¹	½¹ÕÍA•É•¹Ð¥ì(€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ  ‹¦Z¢êËž:€¬ˆ­Í­¥±°¹•Ù…Í¥½¹	½¹ÕÍA•É•¹Ð¬ˆ—¾ò0ˆ­Í­¥±°¹‘ÕÉ…Ñ¥½¸¬‹–n{–B ˆ¤ì(€€€€€€€ô(€€€€€€€•±Í”¥˜¡Í­¥±°¹…Ñ•½Éäôôô‰‰Õ™˜ˆ˜™Í­¥±°¹‘•™•¹Í•	½¹ÕÍA•É•¹Ð¥ì(€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ  ‹¦bËžš›–*l€¬ˆ­Í­¥±°¹‘•™•¹Í•	½¹ÕÍA•É•¹Ð¬ˆ—¾ò0ˆ­Í­¥±°¹‘ÕÉ…Ñ¥½¸¬‹–n{–B ˆ¤ì(€€€€€€€ô(€€€€€€€•±Í”¥˜¡Í­¥±°¹…Ñ•½Éäôôô‰‰Õ™˜ˆ˜™Í­¥±°¹É•™±•ÑA•É•¹Ð¥ì(€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ  ‹–>7–
Ü€ˆ­Í­¥±°¹É•™±•ÑA•É•¹Ð¬ˆ—¾ò0ˆ­Í­¥±°¹‘ÕÉ…Ñ¥½¸¬‹–n{–B ˆ¤ì(€€€€€€€ô(€€€€€€€•±Í”¥˜¡Í­¥±°¹…Ñ•½Éäôôô‰‰Õ™˜ˆ˜™Í­¥±°¹ÍÑ…ÑÕÍI•Í¥ÍÑ	½¹ÕÌ¥ì(€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ  ‹žVÃ–âãž.š/š*_šœ€¬ˆ­Í­¥±°¹ÍÑ…ÑÕÍI•Í¥ÍÑ	½¹ÕÌ¬ˆ—¾ò0ˆ­Í­¥±°¹‘ÕÉ…Ñ¥½¸¬‹–n{–B ˆ¤ì(€€€€€€€ô(€€€€€€€•±Í”¥˜¡Í­¥±°¹…Ñ•½Éäôôô‰‰Õ™˜ˆ¥ì(€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ ¡Í­¥±°¹‘•ÍÉ¥ÁÑ¥½¸¤ì(€€€€€€€ô(((€€€€€€€¥˜¡Í­¥±°¹…Ñ•½Éäôôô‰¡•…°ˆ¥ì((€€€€€€€€€€€½¹ÍÐ¡•…±µ½Õ¹Ðô((€€€€€€€€€€€€€€€Í­¥±°¹‰…Í•!•…°¬(€€€€€€€€€€€€€€€Í­¥±°¹¡•…±A•É1•Ù•°¨(€€€€€€€€€€€€€€€€¡±Ø´Ä¤ì(((€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ  ((€€€€€€€€€€€€€€€€‹–n{–ú¥!C–~ëž’8ˆ¬(€€€€€€€€€€€€€€€¡•…±µ½Õ¹Ð¬(€€€€€€€€€€€€€€€€ˆ¯šfë–*o\ˆ¬(€€€€€€€€€€€€€€€!1%9}%9Q}=%%9P¬((€€€€€€€€€€€€€€€€ (€€€€€€€€€€€€€€€€€€€Í­¥±°¹¡•…±A•É1•Ù•°(€€€€€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€€€€€€‹¾ò#–~ëž’;š¾?žÒh¬ˆ¬(€€€€€€€€€€€€€€€€€€€Í­¥±°¹¡•…±A•É1•Ù•°¬(€€€€€€€€€€€€€€€€€€€€‹¾ò$ˆ(€€€€€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€€€€€¤¬(€€€€€€€€€€€€€€€€‹¾òmMC–~ëž’8ˆ¬(€€€€€€€€€€€€€€€€¡Í­¥±°¹‰…Í•!•…±M@¬¡Í­¥±°¹¡•…±MAA•É1•Ù•±ñðÀ¤¨¡±Ø´Ä¤¤¬(€€€€€€€€€€€€€€€€¡Í­¥±°¹¡•…±MAA•É1•Ù•°€ü€‹¾ò#–~ëž’;š¾?žÒh¬ˆ­Í­¥±°¹¡•…±MAA•É1•Ù•°¬‹¾ò$ˆ€è€ˆˆ¤¬(€€€€€€€€€€€€€€€€ˆ¯šfë–*o\ˆ¬(€€€€€€€€€€€€€€€MA}!1%9}%9Q}=%%9P¬(€€€€€€€€€€€€€€€€‹¾ò#šZ÷šRû¢šr³’êë’â7–n{–ú¥MC¾ò$ˆ((€€€€€€€€€€€€¤ì((€€€€€€€ô(((€€€€€€€¥˜ (€€€€€€€€€€€Í­¥±°¹…Ñ•½Éäôôô‰É•Ù¥Ù”ˆ˜˜(€€€€€€€€€€€Í­¥±°¹É•Ù¥Ù•!•…±A•É•¹Ñ	å1•Ù•°(€€€€€€€€¥ì((€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ  ((€€€€€€€€€€€€€€€€‹–ú§šÒïš‹–ú¤ˆ¬(€€€€€€€€€€€€€€€Í­¥±°¹É•Ù¥Ù•!•…±A•É•¹Ñ	å1•Ù•±m±Ø´Åt¬(€€€€€€€€€€€€€€€€ˆ—¢†¦<ˆ((€€€€€€€€€€€€¤ì((€€€€€€€ô(((€€€€€€€¥˜ (€€€€€€€€€€€Í­¥±°¹…Ñ•½Éäôôô‰Á…ÍÍ¥Ù”ˆ(€€€€€€€€¥ì((€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ  (€€€€€€€€€€€€€€€Í­¥±°¹‘•ÍÉ¥ÁÑ¥½¸(€€€€€€€€€€€€¤ì((€€€€€€€ô(((€€€€€€€¥˜¡Á…ÉÑÌ¹±•¹Ñ ðÄ¥ì(€€€€€€€€€€€½¹Ñ¥¹Õ”ì(€€€€€€€ô(((€€€€€€€±¥¹•Ì¹ÁÕÍ  ((€€€€€€€€€€€€œñ‘¥ØÍÑå±”ôˆœ¬(€€€€€€€€€€€€‘¥ÍÁ±…äé™±•àí…ÀèÙÁàíÁ…‘‘¥¹œèÍÁà€Àìœ¬(€€€€€€€€€€€€‰½É‘•Èµ‰½ÑÑ½´èÅÁàÍ½±¥É‰„ ÈÐÀ°ÄàÀ°ÐÄ°¸ÄÈ¤ìˆøœ¬((€€€€€€€€€€€€œñÍÁ…¸ÍÑå±”ô‰™±•àèÀ€À€ÐÁÁàí½±½Èè˜ÁˆÐÈäí™½¹ÐµÝ•¥¡Ðé‰½±ìˆøœ¬(€€€€€€€€€€€€‰1Ø¸ˆ­±Ø¬(€€€€€€€€€€€€ˆð½ÍÁ…¸øˆ¬((€€€€€€€€€€€€œñÍÁ…¸ÍÑå±”ô‰™±•àèÄìˆøœ¬(€€€€€€€€€€€Á…ÉÑÌ¹©½¥¸ ‹¾öpˆ¤¬(€€€€€€€€€€€€ˆð½ÍÁ…¸øˆ¬((€€€€€€€€€€€€ˆð½‘¥Øøˆ((€€€€€€€€¤ì((€€€ô(((€€€É•ÑÕÉ¸±¥¹•Ì¹©½¥¸ ˆˆ¤ì()ô(()™Õ¹Ñ¥½¸Í¡½ÝM­¥±±•Ñ…¥°¡Í­¥±±%¥ì((€€€½¹ÍÐÍ­¥±°ô(€€€€€€€Í­¥±±…Ñ…‰…Í•mÍ­¥±±%‘tì(((€€€¥˜ …Í­¥±°¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€½¹ÍÐ¡…É…Ñ•Èô(€€€€€€€¡…É…Ñ•ÉM­¥±±1½…‘½ÕÑÍl(€€€€€€€€€€€ÕÉÉ•¹ÑM­¥±±¡…É…Ñ•È(€€€€€€€tì(((€€€½¹ÍÐ±•Ù•°ô((€€€€€€€€ (€€€€€€€€€€€¡…É…Ñ•È˜˜(€€€€€€€€€€€¡…É…Ñ•È¹Í­¥±±1•Ù•±Ì˜˜(€€€€€€€€€€€¡…É…Ñ•È¹Í­¥±±1•Ù•±ÍmÍ­¥±±%‘t(€€€€€€€€¥ñð(€€€€€€€€Àì(((€€€½¹ÍÐÍÁ½ÍÐô((€€€€€€€Í­¥±°¹ÍÁ½ÍÐ„ôõÕ¹‘•™¥¹•(€€€€€€€€ü(€€€€€€€Í­¥±°¹ÍÁ½ÍÐ(€€€€€€€€è(€€€€€€€Í­¥±°¹½ÍÐì(((€€€½¹ÍÐ¥½¹°ô(€€€€€€€€ ‰Í­¥±±•Ñ…¥±%½¸ˆ¤ì(((€€€¥˜¡¥½¹°¥ì((€€€€€€€¥½¹°¹ÍÑå±”¹‰…­É½Õ¹‘%µ…”ô((€€€€€€€€€€€Í­¥±±%½¹%µ…•Ì˜˜(€€€€€€€€€€€Í­¥±±%½¹%µ…•ÍmÍ­¥±±%‘t(€€€€€€€€€€€€ü(€€€€€€€€€€€€‰ÕÉ° ˆ¬(€€€€€€€€€€€Í­¥±±%½¹%µ…•ÍmÍ­¥±±%‘t¬(€€€€€€€€€€€€ˆ¤ˆ(€€€€€€€€€€€€è(€€€€€€€€€€€€‰¹½¹”ˆì((€€€€€€€¥½¹°¹Ñ•áÑ½¹Ñ•¹Ðô((€€€€€€€€€€€Í­¥±±%½¹%µ…•Ì˜˜(€€€€€€€€€€€Í­¥±±%½¹%µ…•ÍmÍ­¥±±%‘t(€€€€€€€€€€€€ü(€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€è(€€€€€€€€€€€€ˆˆì((€€€ô(((€€€€ ‰Í­¥±±•Ñ…¥±9…µ”ˆ¤(€€€€€€€€¹Ñ•áÑ½¹Ñ•¹Ðô((€€€€€€€Í­¥±°¹¹…µ”¬((€€€€€€€€ (€€€€€€€€€€€±•Ù•°øÀ(€€€€€€€€€€€€ü(€€€€€€€€€€€€‹¾ò!1Ø¸ˆ­±•Ù•°¬(€€€€€€€€€€€€ (€€€€€€€€€€€€€€€Í­¥±°¹µ…á1•Ù•°(€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€€ˆ¼ˆ­Í­¥±°¹µ…á1•Ù•°(€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€¤¬(€€€€€€€€€€€€‹¾ò$ˆ(€€€€€€€€€€€€è(€€€€€€€€€€€€‹¾ò#šr«–¶ãžþK¾ò$ˆ(€€€€€€€€¤ì(((€€€€ ‰Í­¥±±•Ñ…¥±MÑ…ÑÌˆ¤(€€€€€€€€¹¥¹¹•É!Q50ô((€€€€€€€€(€€€€€€€€ñ‘¥ØÍÑå±”ô‰µ…É¥¸µ‰½ÑÑ½´èÙÁàìˆø(€€€€€€€€€€€€ñÍÁ…¸ÍÑå±”ôˆ(€€€€€€€€€€€€€€€‘¥ÍÁ±…äé¥¹±¥¹”µ‰±½¬ì(€€€€€€€€€€€€€€€‰…­É½Õ¹èŒÉ”ÈàÈÈì(€€€€€€€€€€€€€€€½±½Èè˜ÁˆÐÈäì(€€€€€€€€€€€€€€€™½¹ÐµÍ¥é”èÄÅÁàì(€€€€€€€€€€€€€€€™½¹ÐµÝ•¥¡Ðé‰½±ì(€€€€€€€€€€€€€€€Á…‘‘¥¹œèÉÁà€ÝÁàì(€€€€€€€€€€€€€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÁÁàì(€€€€€€€€€€€€ˆø(€€€€€€€€€€€€€€€€‘í•ÑM­¥±±…Ñ•½Éå1…‰•°¡Í­¥±°¹…Ñ•½Éä¥ô(€€€€€€€€€€€€ð½ÍÁ…¸ø(€€€€€€€€ð½‘¥Øø((€€€€€€€€ñ‘¥ØÍÑå±”ô‰±¥¹”µ¡•¥¡ÐèÄ¸Üìˆø(€€€€€€€€€€€€‘íÍ­¥±°¹‘•ÍÉ¥ÁÑ¥½¹ô(€€€€€€€€ð½‘¥Øø((€€€€€€€€ñ‘¥ØÍÑå±”ô‰µ…É¥¸µÑ½ÀèáÁàí½±½ÈèˆÍ„ÔáŒìˆø(€€€€€€€€€€€€‘ì(€€€€€€€€€€€€€€€Í­¥±°¹…Ñ•½Éäôôô‰Á…ÍÍ¥Ù”ˆ(€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€€‹¢Š¯–.Wš*¢÷¾ò3’â7žR£¢Žw–
g¾ò3–¶ã’ê–ÂÇšÂã’æžRšV ˆ(€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€ÍÁ½ÍÐ¬‰M@ˆ(€€€€€€€€€€€ô(€€€€€€€€€€€€‘ì(€€€€€€€€€€€€€€€Í­¥±°¹±•…É¹½ÍÐ(€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€€‹¾ös–¶ãžþK¦r¢šˆ­Í­¥±°¹±•…É¹½ÍÐ¬‹š*¢÷¦îxˆ(€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€ô(€€€€€€€€ð½‘¥Øø((€€€€€€€€ñ‘¥ØÍÑå±”ô‰µ…É¥¸µÑ½ÀèÄÁÁàí™½¹ÐµÍ¥é”èÄÅÁàí½±½Èè˜ÁˆÐÈäí™½¹ÐµÝ•¥¡Ðé‰½±ìˆø(€€€€€€€€€€€€ƒ–Bž¶'žÒkšVã–ð(€€€€€€€€ð½‘¥Øø((€€€€€€€€ñ‘¥ØÍÑå±”ô‰µ…É¥¸µÑ½ÀèÑÁàí™½¹ÐµÍ¥é”èÄÉÁàìˆø(€€€€€€€€€€€€‘ì(€€€€€€€€€€€€€€€‰Õ¥±‘M­¥±±1•Ù•±	É•…­‘½Ý¹!Q50 (€€€€€€€€€€€€€€€€€€€Í­¥±°(€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€ô(€€€€€€€€ð½‘¥Øø((€€€€€€€€ì(((€€€½¹ÍÐ‘•Ñ…¥±MÑ…ÑÌô ‰Í­¥±±•Ñ…¥±MÑ…ÑÌˆ¤ì((€€€¥˜¡‘•Ñ…¥±MÑ…ÑÌ¥ì(€€€€€€€‘•Ñ…¥±MÑ…ÑÌ¹ÍÉ½±±Q½ÀôÀì(€€€ô((€€€l(€€€€€€€‘½Õµ•¹Ð¹‘½Õµ•¹Ñ±•µ•¹Ð°(€€€€€€€‘½Õµ•¹Ð¹‰½‘ä°(€€€€€€€€ ‰…µ”µÙ¥•ÝÁ½ÉÐˆ¤°(€€€€€€€€ ‰…µ”µÍÑ…”ˆ¤(€€€t¹™½É… ¡•°ôùì(€€€€€€€¥˜¡•°¥ì(€€€€€€€€€€€•°¹±…ÍÍ1¥ÍÐ¹…‘ ‰Í­¥±°µ‘•Ñ…¥°µÍÉ½±°µ…Ñ¥Ù”ˆ¤ì(€€€€€€€ô(€€€ô¤ì((€€€€ ‰Í­¥±±•Ñ…¥±5½‘…°ˆ¤(€€€€€€€€¹±…ÍÍ1¥ÍÐ(€€€€€€€€¹…‘ ‰Í¡½Üˆ¤ì()ô(()™Õ¹Ñ¥½¸±½Í•M­¥±±•Ñ…¥° ¥ì((€€€€ ‰Í­¥±±•Ñ…¥±5½‘…°ˆ¤(€€€€€€€€¹±…ÍÍ1¥ÍÐ(€€€€€€€€¹É•µ½Ù” ‰Í¡½Üˆ¤ì((€€€l(€€€€€€€‘½Õµ•¹Ð¹‘½Õµ•¹Ñ±•µ•¹Ð°(€€€€€€€‘½Õµ•¹Ð¹‰½‘ä°(€€€€€€€€ ‰…µ”µÙ¥•ÝÁ½ÉÐˆ¤°(€€€€€€€€ ‰…µ”µÍÑ…”ˆ¤(€€€t¹™½É… ¡•°ôùì(€€€€€€€¥˜¡•°¥ì(€€€€€€€€€€€•°¹±…ÍÍ1¥ÍÐ¹É•µ½Ù” ‰Í­¥±°µ‘•Ñ…¥°µÍÉ½±°µ…Ñ¥Ù”ˆ¤ì(€€€€€€€ô(€€€ô¤ì()ô(((¼¨(€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3Ž3¢þS–n{š†š†(€€ƒš^¦
+–’k’â–/¾òš2'¦"W¾ò3¢ÞÏ–ë–Æ³šŸ¢ª«šb;Ž7¾ò'¾òh(€€ƒ–ö#žª_–Ÿ–ºç–në–ºk–¾¯š¶ï–r¡!Q53¢Ž‡¾ò3¦g–§–/–÷–ò<(€€ƒ–>«¢Êƒ¢Ê³¦Z/¦^s¾ò3¢Þ}±½Í•M­¥±±•Ñ…¥° §šb¼(€€ƒ–B3’âž¢»žÂ‡–Z»š¢‡–ò?Ž(¨¼()™Õ¹Ñ¥½¸Í¡½ÝMÑ…ÑÕÍ!•±À ¥ì((€€€€ ‰ÍÑ…ÑÕÍ!•±Á5½‘…°ˆ¤(€€€€€€€€¹±…ÍÍ1¥ÍÐ(€€€€€€€€¹…‘ ‰Í¡½Üˆ¤ì()ô(()™Õ¹Ñ¥½¸±½Í•MÑ…ÑÕÍ!•±À ¥ì((€€€€ ‰ÍÑ…ÑÕÍ!•±Á5½‘…°ˆ¤(€€€€€€€€¹±…ÍÍ1¥ÍÐ(€€€€€€€€¹É•µ½Ù” ‰Í¡½Üˆ¤ì()ô(((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€ƒž¦ÿš"Ð(ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼()™Õ¹Ñ¥½¸•ÅÕ¥ÁM•±•Ñ•‘%Ñ•´ ¥ì((€€€½¹ÍÐ‰ÕÑÑ½¸€ô(€€€€€€€€ ‰¥Ñ•µÅÕ¥Á	ÕÑÑ½¸ˆ¤ì(((€€€¥˜¡‰ÕÑÑ½¸¹‘…Ñ…Í•Ð¹Í±½Ð¥ì((€€€€€€€Õ¹•ÅÕ¥Á%Ñ•´ (€€€€€€€€€€€‰ÕÑÑ½¸¹‘…Ñ…Í•Ð¹Í±½Ð(€€€€€€€€¤ì((€€€€€€€É•ÑÕÉ¸ì((€€€ô(((€€€¥˜ (€€€€€€€Í•±•Ñ•‘%¹Ù•¹Ñ½ÉåM±½Ðôôõ¹Õ±°(€€€€¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€½¹ÍÐ¥Ñ•´€ô(€€€€€€€¥¹Ù•¹Ñ½ÉåM±½ÑÍl(€€€€€€€€€€€Í•±•Ñ•‘%¹Ù•¹Ñ½ÉåM±½Ð(€€€€€€€tì(((€€€¥˜ (€€€€€€€€…¥Ñ•´ñð(€€€€€€€¥Ñ•´¹ÑåÁ”ôôô‰Á½Ñ¥½¸ˆ(€€€€¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€½¹ÍÐ¡…É…Ñ•È€ô(€€€€€€€•Ñ	…­Á…­¡…É…Ñ•È (€€€€€€€€€€€¥¹Ù•¹Ñ½Éå¡…É…Ñ•É%¹‘•à(€€€€€€€€¤ì(((€€€¥˜ …¡…É…Ñ•È¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€½¹ÍÐ•ÅÕ¥Áµ•¹Ñ-•ä€ô(€€€€€€€•Ñ	…­Á…­ÅÕ¥Áµ•¹Ñ-•ä (€€€€€€€€€€€¥¹Ù•¹Ñ½Éå¡…É…Ñ•É%¹‘•à(€€€€€€€€¤ì(((€€€½¹ÍÐ•ÅÕ¥Áµ•¹Ð€ô(€€€€€€€¡…É…Ñ•ÉÅÕ¥Áµ•¹Ñm•ÅÕ¥Áµ•¹Ñ-•åtì(((€€€½¹ÍÐ•ÅÕ¥Áµ•¹ÑM±½Ð€ô(€€€€€€€•Ñ%¹Ù•¹Ñ½ÉåÅÕ¥Áµ•¹ÑM±½Ð¡¥Ñ•´¹ÑåÁ”¤ì(((€€€¥˜ …•ÅÕ¥Áµ•¹ÑM±½Ð¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€½¹ÍÐ½±‘%Ñ•´€ô(€€€€€€€•ÅÕ¥Áµ•¹Ñm•ÅÕ¥Áµ•¹ÑM±½Ñtì(((€€€¥˜¡½±‘%Ñ•´¥ì((€€€€€€€¥¹Ù•¹Ñ½Éå%Ñ•µÌ¹ÁÕÍ  (€€€€€€€€€€€½±‘%Ñ•´(€€€€€€€€¤ì((€€€ô(((€€€½¹ÍÐ…ÑÕ…±%¹‘•à€ô(€€€€€€€¥¹Ù•¹Ñ½Éå%Ñ•µÌ¹¥¹‘•á=˜ (€€€€€€€€€€€¥Ñ•´(€€€€€€€€¤ì(((€€€¥˜¡…ÑÕ…±%¹‘•àøôÀ¥ì((€€€€€€€¥¹Ù•¹Ñ½Éå%Ñ•µÌ¹ÍÁ±¥” (€€€€€€€€€€€…ÑÕ…±%¹‘•à°(€€€€€€€€€€€€Ä(€€€€€€€€¤ì((€€€ô(((€€€•ÅÕ¥Áµ•¹Ñm•ÅÕ¥Áµ•¹ÑM±½Ñt€ô(€€€€€€€¥Ñ•´ì(((€€€±½Í•%Ñ•µ5½‘…° ¤ì((€€€É•‰Õ¥±‘%¹Ù•¹Ñ½ÉåM±½ÑÌ ¤ì((€€€É•¹‘•É%¹Ù•¹Ñ½Éä ¤ì((€€€ÕÁ‘…Ñ•U$ ¤ì((€€€Í…Ù•…µ” ¤ì()ô(((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€ƒ¢¯’â,(ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼()™Õ¹Ñ¥½¸Õ¹•ÅÕ¥Á%Ñ•´¡Í±½Ð¥ì((€€€½¹ÍÐ¡…É…Ñ•È€ô(€€€€€€€•Ñ	…­Á…­¡…É…Ñ•È (€€€€€€€€€€€¥¹Ù•¹Ñ½Éå¡…É…Ñ•É%¹‘•à(€€€€€€€€¤ì(((€€€¥˜ …¡…É…Ñ•È¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€½¹ÍÐ•ÅÕ¥Áµ•¹Ñ-•ä€ô(€€€€€€€•Ñ	…­Á…­ÅÕ¥Áµ•¹Ñ-•ä (€€€€€€€€€€€¥¹Ù•¹Ñ½Éå¡…É…Ñ•É%¹‘•à(€€€€€€€€¤ì(((€€€½¹ÍÐ•ÅÕ¥Áµ•¹Ð€ô(€€€€€€€¡…É…Ñ•ÉÅÕ¥Áµ•¹Ñm•ÅÕ¥Áµ•¹Ñ-•åtì(((€€€½¹ÍÐ¥Ñ•´€ô(€€€€€€€•ÅÕ¥Áµ•¹ÑmÍ±½Ñtì(((€€€¥˜ …¥Ñ•´¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€¥˜ (€€€€€€€¥¹Ù•¹Ñ½Éå%Ñ•µÌ¹±•¹Ñ øôÄÈÀ(€€€€¥ì((€€€€€€€…±•ÉÐ (€€€€€€€€€€€€‹¢3–2–ÞËšîÿ¾ò3ž‡šÎW¢¯’â/¢Žw–
gŽˆ(€€€€€€€€¤ì((€€€€€€€É•ÑÕÉ¸ì((€€€ô(((€€€¥¹Ù•¹Ñ½Éå%Ñ•µÌ¹ÁÕÍ  (€€€€€€€¥Ñ•´(€€€€¤ì(((€€€•ÅÕ¥Áµ•¹ÑmÍ±½Ñtõ¹Õ±°ì(((€€€±½Í•%Ñ•µ5½‘…° ¤ì((€€€É•‰Õ¥±‘%¹Ù•¹Ñ½ÉåM±½ÑÌ ¤ì((€€€É•¹‘•É%¹Ù•¹Ñ½Éä ¤ì((€€€ÕÁ‘…Ñ•U$ ¤ì((€€€Í…Ù•…µ” ¤ì()ô(((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€ƒ–R»–è(ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼()…Íå¹Œ™Õ¹Ñ¥½¸Í•±±M•±•Ñ•‘%Ñ•´ ¥ì((€€€¥˜ (€€€€€€€Í•±•Ñ•‘%¹Ù•¹Ñ½ÉåM±½Ðôôõ¹Õ±°(€€€€¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€½¹ÍÐ¥Ñ•´€ô(€€€€€€€¥¹Ù•¹Ñ½ÉåM±½ÑÍl(€€€€€€€€€€€Í•±•Ñ•‘%¹Ù•¹Ñ½ÉåM±½Ð(€€€€€€€tì(((€€€¥˜ …¥Ñ•´¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€½¹ÍÐÁÉ¥”€ô(€€€€€€€¥Ñ•´¹ÁÉ¥•ñð(€€€€€€€€Àì(((€€€¥˜ (€€€€€€€ÑåÁ•½˜Ý¥¹‘½Ü¹ÉÁ½¹™¥É´„ôô‰™Õ¹Ñ¥½¸ˆñð(€€€€€€€€……Ý…¥ÐÝ¥¹‘½Ü¹ÉÁ½¹™¥É´ (€€€€€€€€€€€€‹žŠë–ºk¢š–ë–R¸ˆ¬(€€€€€€€€€€€¥Ñ•´¹¹…µ”¬(€€€€€€€€€€€€‹¾ò}q¸ˆ¬(€€€€€€€€€€€€‹ž6Ë–ú\ˆ¬(€€€€€€€€€€€ÁÉ¥”¬(€€€€€€€€€€€€‹¦G–æŽˆ°(€€€€€€€€€€€ì(€€€€€€€€€€€€€€€Ñ¥Ñ±”è‹–ë–R»¢Žw–
dˆ°(€€€€€€€€€€€€€€€½¹™¥ÉµQ•áÐè‹žŠë–ºk–ë–R¸ˆ°(€€€€€€€€€€€€€€€…¹•±Q•áÐè‹¢þS–nxˆ(€€€€€€€€€€€ô(€€€€€€€€¤(€€€€¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô((€€€¥˜ (€€€€€€€Í•±•Ñ•‘%¹Ù•¹Ñ½ÉåM±½Ðôôõ¹Õ±°ñð(€€€€€€€¥¹Ù•¹Ñ½ÉåM±½ÑÍmÍ•±•Ñ•‘%¹Ù•¹Ñ½ÉåM±½Ñt„ôõ¥Ñ•´(€€€€¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€½¹ÍÐ…ÑÕ…±%¹‘•à€ô(€€€€€€€¥¹Ù•¹Ñ½Éå%Ñ•µÌ¹¥¹‘•á=˜ (€€€€€€€€€€€¥Ñ•´(€€€€€€€€¤ì(((€€€¥˜¡…ÑÕ…±%¹‘•àøôÀ¥ì((€€€€€€€½¹ÍÐÍÑ½É•‘%Ñ•´õ¥¹Ù•¹Ñ½Éå%Ñ•µÍm…ÑÕ…±%¹‘•átì(€€€€€€€½¹ÍÐÕÉÉ•¹Ñ½Õ¹Ðõ5…Ñ ¹µ…à Ä±9Õµ‰•È¡ÍÑ½É•‘%Ñ•´¹½Õ¹Ð¥ñðÄ¤ì((€€€€€€€¥˜¡ÕÉÉ•¹Ñ½Õ¹ÐøÄ¥ì(€€€€€€€€€€€ÍÑ½É•‘%Ñ•´¹½Õ¹ÐõÕÉÉ•¹Ñ½Õ¹Ð´Äì(€€€€€€€õ•±Í•ì(€€€€€€€€€€€¥¹Ù•¹Ñ½Éå%Ñ•µÌ¹ÍÁ±¥” (€€€€€€€€€€€€€€€…ÑÕ…±%¹‘•à°(€€€€€€€€€€€€€€€€Ä(€€€€€€€€€€€€¤ì(€€€€€€€ô((€€€ô(((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾ò#žrš¶š*O–"Ã–V?¦†3š‚çšêC¾ò'¾òh(€€€€€€ƒ’æ/–&7¦g¢Ž‡žjžŠë¢ª7¢¢+š¿’âžnÓ¢ª«Ž3ž6Ë–ú\(€€€€€€ac¦G–æŽ7¾ò3’ö–ú{¦‚·–"Ã–ÂûšÊKšr'’îï’öW’â¢†0(€€€€€€ƒž¢/–ò?žŠóžržjš*+¦g–/šVã–¶_–*ƒ¦Ë’îï’öW–rÃšZçŠSŠP(€€€€€€ƒ¦G–æžÎïžÖÇžVÛšfš‚çšr³’â7–¶c–r£¾ò3¦g–>—¢¦Çž¶'šZð(€€€€€€ƒšb¿ž¦ë¦‚·šR¿ž–£Žž>û–r£žržjšr%½±“¦g–/–ÇžR (€€€€€€ƒ¢ÎšêC’ê¾ò3¦g¢Ž‡¢Žs’â+žrš¶žj–*ƒ–óŽ(€€€€¨¼(€€€½±ô(€€€€€€€½±¬(€€€€€€€ÁÉ¥”ì(((€€€±½Í•%Ñ•µ5½‘…° ¤ì((€€€É•‰Õ¥±‘%¹Ù•¹Ñ½ÉåM±½ÑÌ ¤ì((€€€É•¹‘•É%¹Ù•¹Ñ½Éä ¤ì((€€€ÕÁ‘…Ñ•½±‘¥ÍÁ±…ä ¤ì((€€€Í…Ù•…µ” ¤ì()ô(((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€ƒ¢«–.Wš"Ã¦²—¢¢·–ºh(ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼((¼¨(€€ƒŠbXÄÌß¾ò#šâ¦f“šºcžVg¦2¿¢ª“¢¢+š¿¾ò'¾òh(€€…ÕÑ½¹…‰±•“Ž…ÕÑ½M­¥±±!½µ—Ž¡ÁUÍ•AÑ!½µ—ŽÍÁUÍ•AÑ!½µ”(€€ƒšb¿¢"+ž&#’âï–~;–Ÿ–Ö3¢«–.W¢¢·–ºkžj–žÒƒ¾ò3ž>û¢†3¢¢·–ºk–ÞËšRçžRÄ(€€…ÕÑ½	…ÑÑ±•M•ÑÑ¥¹ÍA…¹•³–.Wš/¢†£–Z»¢fWžBŽ¢"+ž&!Í…™•	¥¹“’î7–r£š¾?š²‡¢ò'–”(€€ƒ’âï–.Wš*+¦g–no–/Ž3–ÞËž~—’â7–¶c–r£Ž7žj–žÒƒ¢¢cš"A½¹Í½±”¹•ÉÉ½Ë¾ò3šrš:§¢N/žrš¶Œ(€€ƒžj¦2¿¢ª“¾òo–nošº×ž‡šV#žÚ–ºk–ÞËžžï¦f“Ž((€€…ÕÑ½M­¥±±	…ÑÑ±—Ž¡ÁUÍ•AÑ	…ÑÑ±—ŽÍÁUÍ•AÑ	…ÑÑ±”(€€ƒ¦g’â'–/šb¿–ú#š^§šrž&#šr³Žš"Ã¦²—žV¯¦v‹–Ÿ–Ö3’â/š.'¦ã–Z»žj(€€ƒ¢"+–žÒ%¾ò3–ú3’ú¦7šZÃ¢¢·¢¢#š"Cž>û–r£¦gž¢¸(€€ƒŽ3š¢gžÆ¯–V–.T¿–sš¶ˆ¯¢¢·–ºkŽ7žj¢«–.Wš"Ã¦²—¦v‹švÿšf(€€ƒ–ÞËžÚOš.ÿš:'’ê¾ò3’ö¦g¢Ž‡žÚ–ºk’ê/’îÛžjž¢/–ò?žŠð(€€ƒšÊKšr'¢Þ¢F_šâ’æûšÞ£¾ò3–Â;¢Óš¾?š²‡¢ò'–—¦÷šr–b_¢¦›š&ø(€€ƒ¦g–æû–/’â7–¶c–r£žj–žÒƒŽ–6Ã–ë¦2¿¢ª“¢¢+š¼(€€ƒ¾ò#¦n[žÛšr'¦bË–F’â7šr¢ºO¦+š"ËžVÛš¦¾ò3’öžÖž¦Ûšb¿¦ns¢¢+¾ò'Ž(€€ƒ¦g¢Ž‡žnÓš:—–"«š:'¦g’â'šº×–ÞËžÚOšÊKšr'žn»š¢g–>¿’î—žÚžjž¢/–ò?žŠóŽ(¨¼(((¼¨(€€ƒŠbƒ¢«–.Wš"Ã¦²—š*¢÷’â/š.'¦ã–Z»šRçš"C–.Wš/žR‹žRŽ(€€ƒ’æ/–&7šb¿–¾¯š¶ï–r¡!Q53¢Ž‡žj–në–ºk¦ã¦‚¾ò#–>«šr'ž¯žº·Žšr–þ’âšN+¾ò'¾ò0(€€ƒž>û–r£š*¢÷šb¿ž:§–ºÛ¢«–ÞÇ–¶ãŽ¢«–ÞÇ¢Žw–
gžj¾ò0(€€ƒ¦ã–Z»¢š¢Þ¢F_Ž3žn»–&7¢Žw–
gžjš*¢÷Ž7–.Wš/šnÓšZÃ¾ò0(€€ƒ’â7žÛž:§–ºÛ¢Žw–
g’êšZÃš*¢÷¾ò3¦g¢Ž‡–6ï¦ã’â7–"ÃŽ((€€ƒ¢Š¯–.Wš*¢÷¢Þ–Š{žn+š*¢÷¾ò#šKž¯¾ò'’â7šRû¦Ë¢«–.W¦ã–Z»¾ò0(€€ƒ¢Š¯–.Wš*¢÷šÊKšr'Ž3’âï–.W’öÿžR£Ž7¦g–n{’ê/¾òl(€€ƒšKž¯–ššzsšRû¦Ë¢«–.W¦ã–Z»¾ò0(€€ƒ¢«–.Wš"Ã¦²—š¾?–n{–B#¦÷šr¦7šZÃšZ÷šRû¾ò0(€€ƒ¦
?¢ò¿šr¢º+–ú_–ú#––š«¾ò0(€€ƒš&’î—šKž¯žn»–&7–#–>«¢÷–r£š"Ã¦²—’â·š&/–.W¦î{š*¢÷¦ã–Z»šZ÷šRûŽ(¨¼()™Õ¹Ñ¥½¸Á½ÁÕ±…Ñ•ÕÑ½M­¥±±=ÁÑ¥½¹Ì ¥ì((€€€½¹ÍÐ¡…É…Ñ•È€ô(€€€€€€€¡…É…Ñ•ÉM­¥±±1½…‘½ÕÑÌ¹™¥É”ì(((€€€¥˜ …¡…É…Ñ•È¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€±•Ð½ÁÑ¥½¹Í!Q50€ô((€€€€€€€€œñ½ÁÑ¥½¸Ù…±Õ”ô‰¹½Éµ…°ˆûšf»¦kšRïšN(ð½½ÁÑ¥½¸øœì(((€€€¡…É…Ñ•È¹•ÅÕ¥ÁÁ•‘M­¥±±Ì(€€€€¹™½É… ¡Í­¥±±%ôùì((€€€€€€€½¹ÍÐÍ­¥±°€ô(€€€€€€€€€€€Í­¥±±…Ñ…‰…Í•mÍ­¥±±%‘tì(((€€€€€€€¥˜ (€€€€€€€€€€€€…Í­¥±°ñð(€€€€€€€€€€€Í­¥±°¹…Ñ•½Éäôôô‰‰Õ™˜‰ñð(€€€€€€€€€€€Í­¥±°¹…Ñ•½Éäôôô‰Á…ÍÍ¥Ù”ˆ(€€€€€€€€¥ì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€ô(((€€€€€€€½ÁÑ¥½¹Í!Q50¬ô((€€€€€€€€€€€€œñ½ÁÑ¥½¸Ù…±Õ”ôˆœ¬(€€€€€€€€€€€Í­¥±±%¬(€€€€€€€€€€€€œˆøœ¬(€€€€€€€€€€€Í­¥±°¹¹…µ”¬(€€€€€€€€€€€€œð½½ÁÑ¥½¸øœì((€€€ô¤ì(((€€€½¹ÍÐ¡½µ•M•±•Ð€ô(€€€€€€€€ ‰…ÕÑ½M­¥±±!½µ”ˆ¤ì(((€€€½¹ÍÐ‰…ÑÑ±•M•±•Ð€ô(€€€€€€€€ ‰…ÕÑ½M­¥±±	…ÑÑ±”ˆ¤ì(((€€€½¹ÍÐÁÉ•Ù¥½ÕÍY…±Õ”€ô(€€€€€€€…ÕÑ½½¹™¥œ¹Í­¥±°ì(((€€€¥˜¡¡½µ•M•±•Ð¥ì((€€€€€€€¡½µ•M•±•Ð¹¥¹¹•É!Q50€ô(€€€€€€€€€€€½ÁÑ¥½¹Í!Q50ì((€€€ô(((€€€¥˜¡‰…ÑÑ±•M•±•Ð¥ì((€€€€€€€‰…ÑÑ±•M•±•Ð¹¥¹¹•É!Q50€ô(€€€€€€€€€€€½ÁÑ¥½¹Í!Q50ì((€€€ô(((€€€€¼¨(€€€€€€ƒŠbƒžržjš*O–"Ã–V?¦†3š‚çšêC’ê¾òh(€€€€€€ƒ¦g¢Ž‡–:šr³–>«š&ÿ¢ª4‰¹½Éµ…°‹š"[Ž3žn»–&7¢Žw–
gžjš*¢÷Ž4(€€€€€€ƒšb¿–B#šÎW–ó¾ò0‰‘•™•¹‹¾ò#¦bËžš›¾ò'’â7–r£¦g–§ž¢»ššÎ–Ÿ¾ò0(€€€€€€ƒšr¢Š¯¦gšº×¦bË–F¦
?¢ò¿¢ª“–"“š"CŽ3’â7–B#šÎWžjšºcžVg–óŽ7¾ò0(€€€€€€ƒ–òß–"Û¦–n{Ž3šf»¦kšRïšN+Ž7ŠSŠP(€€€€€€ƒ¦gš¶šb¿Ž3šb;šb;¢¢·–ºk¦bËžš›¾ò3–6ï¢º+š"Cšf»¦kšRïšN+Ž4(€€€€€€ƒžjžrš¶–:–nƒ¾òi½¹™¥ÉµÕÑ½	…ÑÑ±•M•ÑÑ¥¹Ì ¤(€€€€€€ƒš&7–&oš*)…ÕÑ½½¹™¥œ¹Í­¥±³š¶žŠë¢¢·š"@‰‘•™•¹‹¾ò0(€€€€€€ƒžÞ+š:—¢F_–Fó–>¯¦g–/–÷–ò?–k–B3š¶—¾ò0(€€€€€€ƒ¦g¢Ž‡–>#š*+–ºšÒ_–nx‰¹½Éµ…°‹¾ò0(€€€€€€ƒž¶'šZó’öÿžR£¢žj¦ãšN–r£–Ë–¶cžj’â/’â–"ï–ÂÇ¢Š¯¢š¢N/š:'Ž((€€€€€€ƒ’þ»š¶¾òkš*(‰‘•™•¹‹’æ¢š[ž
ë–B#šÎW–óŽ(€€€€¨¼((€€€½¹ÍÐÍÑ¥±±Y…±¥€ô(€€€€€€€ÁÉ•Ù¥½ÕÍY…±Õ”ôôô‰¹½Éµ…°‰ñð(€€€€€€€ÁÉ•Ù¥½ÕÍY…±Õ”ôôô‰‘•™•¹‰ñð(€€€€€€€¡…É…Ñ•È¹•ÅÕ¥ÁÁ•‘M­¥±±Ì¹¥¹±Õ‘•Ì (€€€€€€€€€€€ÁÉ•Ù¥½ÕÍY…±Õ”(€€€€€€€€¤ì(((€€€¥˜ …ÍÑ¥±±Y…±¥¥ì((€€€€€€€…ÕÑ½½¹™¥œ¹Í­¥±°ô(€€€€€€€€€€€€‰¹½Éµ…°ˆì((€€€ô(((€€€¥˜¡¡½µ•M•±•Ð¥ì((€€€€€€€¡½µ•M•±•Ð¹Ù…±Õ”€ô(€€€€€€€€€€€…ÕÑ½½¹™¥œ¹Í­¥±°ì((€€€ô(((€€€¥˜¡‰…ÑÑ±•M•±•Ð¥ì((€€€€€€€‰…ÑÑ±•M•±•Ð¹Ù…±Õ”€ô(€€€€€€€€€€€…ÕÑ½½¹™¥œ¹Í­¥±°ì((€€€ô()ô(((¼¨(€€ƒŠbƒšZÃ–Š{¾òkž²³’ê3¢žK¢&Ëž&#šr³žj¢«–.Wš*¢÷¦ã–Z»–B3š¶—Ž(€€ƒ¢Þ}Á½ÁÕ±…Ñ•ÕÑ½M­¥±±=ÁÑ¥½¹Ì §¦
?¢ò¿–º3–£–Â7ž¢Ç¾ò0(€€ƒ¢º¡…É…Ñ•ÉM­¥±±1½…‘½ÕÑÌ¹Á±…å•ÈË¾ò0(€€ƒ–¾­…ÕÑ½½¹™¥œË¾ò3šN7’ösžj=7–’îÛ’æšb¼(€€ƒ–Â#–Æ³šZóž²³’ê3¢žK¢&Ë¦
žÖ¥“Ž(€€ƒ–B3šf¢Êƒ¢Ê³¦†¿ž’è¿¦jÇ¢^?šVÓ–ò×¢¢·–ºk–6‡ž&(€€ƒ¾ò!Á±…å•ÈË’â7–¶c–r£–ÂÇ’â7žR£¢ºOž:§–ºÛžr/–"Ã¦g–6–†+¾ò'Ž(¨¼()™Õ¹Ñ¥½¸Á½ÁÕ±…Ñ•ÕÑ½M­¥±±=ÁÑ¥½¹ÌÈ ¥ì((€€€½¹ÍÐ…Éô(€€€€€€€€ ‰Á±…å•ÈÉÕÑ½M•ÑÑ¥¹Í…Éˆ¤ì(((€€€¥˜ ……É¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€¥˜ …Á±…å•ÈÈ¥ì((€€€€€€€…É¹ÍÑå±”¹‘¥ÍÁ±…äô(€€€€€€€€€€€€‰¹½¹”ˆì((€€€€€€€É•ÑÕÉ¸ì((€€€ô(((€€€…É¹ÍÑå±”¹‘¥ÍÁ±…äô(€€€€€€€€‰‰±½¬ˆì(((€€€½¹ÍÐÑ¥Ñ±•°ô(€€€€€€€€ ‰Á±…å•ÈÉÕÑ½M•ÑÑ¥¹ÍQ¥Ñ±”ˆ¤ì(((€€€¥˜¡Ñ¥Ñ±•°¥ì((€€€€€€€Ñ¥Ñ±•°¹Ñ•áÑ½¹Ñ•¹Ðô((€€€€€€€€€€€€ˆˆ¬(€€€€€€€€€€€Á±…å•ÈÈ¹¥¬(€€€€€€€€€€€€‹¢«–.Wš"Ã¦²—¢¢·–ºhˆì((€€€ô(((€€€½¹ÍÐ¡…É…Ñ•Èô(€€€€€€€¡…É…Ñ•ÉM­¥±±1½…‘½ÕÑÌ¹Á±…å•ÈÈì(((€€€¥˜ …¡…É…Ñ•È¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€±•Ð½ÁÑ¥½¹Í!Q50ô((€€€€€€€€œñ½ÁÑ¥½¸Ù…±Õ”ô‰¹½Éµ…°ˆûšf»¦kšRïšN(ð½½ÁÑ¥½¸øœì(((€€€¡…É…Ñ•È¹•ÅÕ¥ÁÁ•‘M­¥±±Ì(€€€€¹™½É… ¡Í­¥±±%ôùì((€€€€€€€½¹ÍÐÍ­¥±°ô(€€€€€€€€€€€Í­¥±±…Ñ…‰…Í•mÍ­¥±±%‘tì(((€€€€€€€¥˜ (€€€€€€€€€€€€…Í­¥±°ñð(€€€€€€€€€€€Í­¥±°¹…Ñ•½Éäôôô‰‰Õ™˜‰ñð(€€€€€€€€€€€Í­¥±°¹…Ñ•½Éäôôô‰Á…ÍÍ¥Ù”‰ñð(€€€€€€€€€€€Í­¥±°¹…Ñ•½Éäôôô‰¡•…°‰ñð(€€€€€€€€€€€Í­¥±°¹…Ñ•½Éäôôô‰É•Ù¥Ù”ˆ(€€€€€€€€¥ì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€ô(((€€€€€€€½ÁÑ¥½¹Í!Q50¬ô((€€€€€€€€€€€€œñ½ÁÑ¥½¸Ù…±Õ”ôˆœ¬(€€€€€€€€€€€Í­¥±±%¬(€€€€€€€€€€€€œˆøœ¬(€€€€€€€€€€€Í­¥±°¹¹…µ”¬(€€€€€€€€€€€€œð½½ÁÑ¥½¸øœì((€€€ô¤ì(((€€€½¹ÍÐÍ•±•Ðô(€€€€€€€€ ‰…ÕÑ½M­¥±±A±…å•ÈÈˆ¤ì(((€€€¥˜ …Í•±•Ð¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€½¹ÍÐÁÉ•Ù¥½ÕÍY…±Õ”ô(€€€€€€€…ÕÑ½½¹™¥œÈ¹Í­¥±°ì(((€€€Í•±•Ð¹¥¹¹•É!Q50ô(€€€€€€€½ÁÑ¥½¹Í!Q50ì(((€€€½¹ÍÐÍÑ¥±±Y…±¥ô(€€€€€€€ÁÉ•Ù¥½ÕÍY…±Õ”ôôô‰¹½Éµ…°‰ñð(€€€€€€€ÁÉ•Ù¥½ÕÍY…±Õ”ôôô‰‘•™•¹‰ñð(€€€€€€€¡…É…Ñ•È¹•ÅÕ¥ÁÁ•‘M­¥±±Ì¹¥¹±Õ‘•Ì (€€€€€€€€€€€ÁÉ•Ù¥½ÕÍY…±Õ”(€€€€€€€€¤ì(((€€€¥˜ …ÍÑ¥±±Y…±¥¥ì((€€€€€€€…ÕÑ½½¹™¥œÈ¹Í­¥±°ô(€€€€€€€€€€€€‰¹½Éµ…°ˆì((€€€ô(((€€€Í•±•Ð¹Ù…±Õ”ô(€€€€€€€…ÕÑ½½¹™¥œÈ¹Í­¥±°ì(((€€€½¹ÍÐ¡ÁM•±•Ðô(€€€€€€€€ ‰¡ÁUÍ•AÑA±…å•ÈÈˆ¤ì(((€€€½¹ÍÐÍÁM•±•Ðô(€€€€€€€€ ‰ÍÁUÍ•AÑA±…å•ÈÈˆ¤ì(((€€€¥˜¡¡ÁM•±•Ð¥ì((€€€€€€€¡ÁM•±•Ð¹Ù…±Õ”ô(€€€€€€€€€€€…ÕÑ½½¹™¥œÈ¹¡Àì((€€€ô(((€€€¥˜¡ÍÁM•±•Ð¥ì((€€€€€€€ÍÁM•±•Ð¹Ù…±Õ”ô(€€€€€€€€€€€…ÕÑ½½¹™¥œÈ¹ÍÀì((€€€ô(((€€€½¹ÍÐ•¹…‰±•‘¡•­‰½àô(€€€€€€€€ ‰…ÕÑ½¹…‰±•‘A±…å•ÈÈˆ¤ì(((€€€¥˜¡•¹…‰±•‘¡•­‰½à¥ì((€€€€€€€•¹…‰±•‘¡•­‰½à¹¡•­•ô(€€€€€€€€€€€…ÕÑ½½¹™¥œÈ¹•¹…‰±•ì((€€€ô()ô(((¼¨(€€ƒŠbƒž²³’ê3¢žK¢&Ë¢«–.Wš"Ã¦²—¢¢·–ºkžj’â/š.'¦ã–Z¸(€€ƒžVÃ–.Wšf¾ò3š*+–ó–¾¯–ny…ÕÑ½½¹™¥œËŽ(¨¼()™Õ¹Ñ¥½¸ÕÁ‘…Ñ•ÕÑ½½¹™¥œÉÉ½µU$ ¥ì((€€€½¹ÍÐ•¹…‰±•‘¡•­‰½àô(€€€€€€€€ ‰…ÕÑ½¹…‰±•‘A±…å•ÈÈˆ¤ì(((€€€½¹ÍÐÍ•±•Ðô(€€€€€€€€ ‰…ÕÑ½M­¥±±A±…å•ÈÈˆ¤ì(((€€€½¹ÍÐ¡ÁM•±•Ðô(€€€€€€€€ ‰¡ÁUÍ•AÑA±…å•ÈÈˆ¤ì(((€€€½¹ÍÐÍÁM•±•Ðô(€€€€€€€€ ‰ÍÁUÍ•AÑA±…å•ÈÈˆ¤ì(((€€€¥˜¡•¹…‰±•‘¡•­‰½à¥ì((€€€€€€€…ÕÑ½½¹™¥œÈ¹•¹…‰±•ô(€€€€€€€€€€€•¹…‰±•‘¡•­‰½à¹¡•­•ì((€€€ô(((€€€¥˜¡Í•±•Ð¥ì((€€€€€€€…ÕÑ½½¹™¥œÈ¹Í­¥±°ô(€€€€€€€€€€€Í•±•Ð¹Ù…±Õ”ì((€€€ô(((€€€¥˜¡¡ÁM•±•Ð¥ì((€€€€€€€…ÕÑ½½¹™¥œÈ¹¡Àô(€€€€€€€€€€€9Õµ‰•È (€€€€€€€€€€€€€€€¡ÁM•±•Ð¹Ù…±Õ”(€€€€€€€€€€€€¤ì((€€€ô(((€€€¥˜¡ÍÁM•±•Ð¥ì((€€€€€€€…ÕÑ½½¹™¥œÈ¹ÍÀô(€€€€€€€€€€€9Õµ‰•È (€€€€€€€€€€€€€€€ÍÁM•±•Ð¹Ù…±Õ”(€€€€€€€€€€€€¤ì((€€€ô(((€€€Í…Ù•…µ” ¤ì()ô(()™Õ¹Ñ¥½¸Íå¹	…ÑÑ±•ÕÑ½M•ÑÑ¥¹Ì ¥ì((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾ò#žržjš*O–"Ã’â–/šržVÛš¦žj‰ÕŸ¾ò'¾òh(€€€€€€ƒ¦g¢Ž‡–:šr³šržnÓš:—–Â4(€€€€€€…ÕÑ½M­¥±±	…ÑÑ±”½¡ÁUÍ•AÑ	…ÑÑ±”½ÍÁUÍ•AÑ	…ÑÑ±”(€€€€€€ƒ¦g’â'–/¢"+ž&#š"Ã¦²—žV¯¦v‹–Ÿ–Ö3’â/š.'¦ã–Z»¢¢·–ó¾ò0(€€€€€€ƒ’ö¦gš²‡šRçž&#–ú3¾ò3¦g’â'–/’â/š.'¦ã–Z»–ÞËžÚOšVÓ–/š.ÿš:$(€€€€€€ƒ¾ò#žnã¦^s¢¢·–ºkžžï–"ÃŽ3¢¢·–ºkŽ7š2'¦"W–ÆW¦Z/žj(€€€€€€…ÕÑ½	…ÑÑ±•M•ÑÑ¥¹ÍA…¹•³¢Ž‡’ê¾ò'¾ò0(€€€€€€=7¢Ž‡–ÞËžÚOš&û’â7–"Ã¦g’â'–/–žÒƒ¾ò0(€€€€€€ƒžnÓš:—–Â5¹Õ±°¹Ù…±Õ—¢Î›–óšržnÓš:—’â–ë¦2¿¢ª“¾ò0(€€€€€€ƒ–Â;¢Ó–Fó–>¯¦g–/–÷–ò?žj–rÃšZç–£¦£’â·šZß–~ß¢†3ŠSŠP(€€€€€€ƒ–2š.±‰•¥¹¡…É…Ñ•ÉQÕÉ¸ §¾ò0(€€€€€€ƒž¶'šZóš¾?š²‡¢ò«–"Ãž:§–ºÛ¢†3–.W¾ò0(€€€€€€ƒžV¯¦v‹¦÷šr'–>¿¢÷–nƒž
ë¦g¢Ž‡–fÓ¦2¿¢3–6‡’ö?Ž((€€€€€€ƒšZÃž&#¢¢·–ºk¦v‹švÿšb¿Ž3¦î{¢¢·–ºkš&7–ÆW¦Z/¾ò0(€€€€€€ƒ–ÆW¦Z/šfš&7žRÅÍÝ¥Ñ¡ÕÑ½M•ÑÑ¥¹Í¡…É…Ñ•È ¤(€€€€€€ƒ¢Êƒ¢Ê³–âÛ–—žn»–&7žj–óŽ7¾ò3’â7¦r¢š–r£¦g¢Ž„(€€€€€€ƒš¾?š²‡¦÷’âï–.W–B3š¶—¾ò3š&’î—žnÓš:—š*+¦g’â'¢†3š.ÿš:'¾ò0(€€€€€€ƒ–>«’þwžVg–B3š¶—Ž3–ÞË–¶ãš*¢÷¦ã¦‚Ž7¦g¦£–"(€€€€€€ƒ¾ò!Á½ÁÕ±…Ñ•ÕÑ½M­¥±±=ÁÑ¥½¹ÏžÎï–"_–÷–ò<(€€€€€€ƒ–¦£¦÷–ÞËžÚOšr%¹Õ±³šª‹š~—¾ò3’â7šršr'–B3š¢žj–V?¦†3¾ò'Ž(€€€€¨¼((€€€Á½ÁÕ±…Ñ•ÕÑ½M­¥±±=ÁÑ¥½¹Ì ¤ì((€€€Á½ÁÕ±…Ñ•ÕÑ½M­¥±±=ÁÑ¥½¹ÌÈ ¤ì()ô(((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€ƒš"Ã¦²—¢Î¢¢((ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼()™Õ¹Ñ¥½¸Íå¹	…ÑÑ±•U¥AÉ¥½É¥Ñå1…å•È ¥ì((€€€½¹ÍÐÍÑ…”ô ‰…µ”µÍÑ…”ˆ¤ì(€€€½¹ÍÐÁ…”ô ‰‰…ÑÑ±•A…”ˆ¤ì(€€€¥˜ …ÍÑ…•ñð…Á…”¥ìÉ•ÑÕÉ¸™…±Í”ìô((€€€½¹ÍÐÍÑ…ÑÕÍ•Ñ…¥°õÁ…”¹ÅÕ•ÉåM•±•Ñ½È ˆ¹‰…ÑÑ±”µÍÑ…ÑÕÌµ‘•Ñ…¥°µµ½‘…°é¹½Ð¡m¡¥‘‘•¹t¤ˆ¤ì(€€€½¹ÍÐÍ¥‘•É…Ý•ÈõÁ…”¹ÅÕ•ÉåM•±•Ñ½È ˆ¹‰…ÑÑ±”µ¥¹Í¥¡Ðµ‘É…Ý•È¹½Á•¸ˆ¤ì(€€€½¹ÍÐ‰…ÑÑ±•%¹™¼õÁ…”¹ÅÕ•ÉåM•±•Ñ½È ˆ¹‰…ÑÑ±”µ¥¹™¼µÉ•¥½¸¹¥Ìµ•áÁ…¹‘•ˆ¤ì(€€€½¹ÍÐ…Ñ¥Ù”ô„„¡ÍÑ…ÑÕÍ•Ñ…¥±ññÍ¥‘•É…Ý•Éññ‰…ÑÑ±•%¹™¼¤ì((€€€ÍÑ…”¹±…ÍÍ1¥ÍÐ¹Ñ½±” ‰‰…ÑÑ±”µÕ¤µÁÉ¥½É¥Ñäˆ±…Ñ¥Ù”¤ì(€€€¥˜¡‘½Õµ•¹Ð¹‰½‘ä¥ì‘½Õµ•¹Ð¹‰½‘ä¹±…ÍÍ1¥ÍÐ¹Ñ½±” ‰ØÄÜÐµ‰…ÑÑ±”µÉ•…‘¥¹œµ½Á•¸ˆ±…Ñ¥Ù”¤ìô(€€€É•ÑÕÉ¸…Ñ¥Ù”ì()ô()¥˜¡ÑåÁ•½˜Ý¥¹‘½Ü„ôô‰Õ¹‘•™¥¹•ˆ¥ì(€€€Ý¥¹‘½Ü¹Íå¹	…ÑÑ±•U¥AÉ¥½É¥Ñå1…å•ÈõÍå¹	…ÑÑ±•U¥AÉ¥½É¥Ñå1…å•Èì)ô()™Õ¹Ñ¥½¸Í•Ñ	…ÑÑ±•%¹™½áÁ…¹‘•¡•áÁ…¹‘•¥ì((€€€½¹ÍÐÉ•¥½¸õ‘½Õµ•¹Ð¹ÅÕ•ÉåM•±•Ñ½È ˆ‰…ÑÑ±•A…”€¹‰…ÑÑ±”µ¥¹™¼µÉ•¥½¸ˆ¤ì(€€€½¹ÍÐÑ½±”ô ‰‰…ÑÑ±•%¹™½Q½±”ˆ¤ì((€€€¥˜ …É•¥½¹ñð…Ñ½±”¥ìÉ•ÑÕÉ¸™…±Í”ìô((€€€½¹ÍÐ¹•áÐô„…•áÁ…¹‘•ì(€€€É•¥½¸¹±…ÍÍ1¥ÍÐ¹Ñ½±” ‰¥Ìµ•áÁ…¹‘•ˆ±¹•áÐ¤ì(€€€Ñ½±”¹Ñ•áÑ½¹Ñ•¹Ðõ¹•áÐü‹¢þS–nxˆè‹š"Ã¦²—¢Î¢¢(ˆì(€€€Ñ½±”¹Í•ÑÑÑÉ¥‰ÕÑ” ‰…É¥„µ•áÁ…¹‘•ˆ±¹•áÐü‰ÑÉÕ”ˆè‰™…±Í”ˆ¤ì(€€€Ñ½±”¹Í•ÑÑÑÉ¥‰ÕÑ” ‰…É¥„µ±…‰•°ˆ±¹•áÐü‹šRÛ–B#š"Ã¦²—¢Î¢¢(ˆè‹–ÆW¦Z/š"Ã¦²—¢Î¢¢(ˆ¤ì(€€€Íå¹	…ÑÑ±•U¥AÉ¥½É¥Ñå1…å•È ¤ì(€€€É•ÑÕÉ¸ÑÉÕ”ì()ô()™Õ¹Ñ¥½¸Ñ½±•	…ÑÑ±•%¹™½A…¹•° ¥ì((€€€½¹ÍÐÉ•¥½¸õ‘½Õµ•¹Ð¹ÅÕ•ÉåM•±•Ñ½È ˆ‰…ÑÑ±•A…”€¹‰…ÑÑ±”µ¥¹™¼µÉ•¥½¸ˆ¤ì(€€€É•ÑÕÉ¸Í•Ñ	…ÑÑ±•%¹™½áÁ…¹‘• „¡É•¥½¸˜™É•¥½¸¹±…ÍÍ1¥ÍÐ¹½¹Ñ…¥¹Ì ‰¥Ìµ•áÁ…¹‘•ˆ¤¤¤ì()ô()™Õ¹Ñ¥½¸±•…É	…ÑÑ±•1½œ ¥ì((€€€Í•Ñ	…ÑÑ±•%¹™½áÁ…¹‘•¡™…±Í”¤ì((€€€€ ‰‰…ÑÑ±•%¹™¼ˆ¤(€€€€€€€€¹¥¹¹•É!Q50ôˆˆì((€€€€¼¨XÄÜÌ¸ÐÈè±•µ•¹Ð	½à…¸ÕÍ”Á½Ñ¥½¹ÌÝ¡¥±”¹¼‰…ÑÑ±”¥ÌÉÕ¹¹¥¹œ¸(€€€€€€…ÉÉäÑ¡½Í”¹½Ñ¥•Ì¥¹Ñ¼Ñ¡”¹•áÐ‰…ÑÑ±”µ¥¹™¼Á…¹•°•á…Ñ±ä½¹”¸€¨¼(€€€½¹ÍÐÁ•¹‘¥¹±•µ•¹Ñ	½á9½Ñ¥•Ìô(€€€€€€€ÑåÁ•½˜Ý¥¹‘½Ü„ôô‰Õ¹‘•™¥¹•ˆ˜™ÉÉ…ä¹¥ÍÉÉ…ä¡Ý¥¹‘½Ü¹ØÄÜÌÐÉA•¹‘¥¹	…ÑÑ±•9½Ñ¥•Ì¤(€€€€€€€€€€€€üÝ¥¹‘½Ü¹ØÄÜÌÐÉA•¹‘¥¹	…ÑÑ±•9½Ñ¥•Ì¹ÍÁ±¥” À¤(€€€€€€€€€€€€èmtì(€€€Á•¹‘¥¹±•µ•¹Ñ	½á9½Ñ¥•Ì¹™½É… ¡µ•ÍÍ…”ôù…‘‘	…ÑÑ±•1½œ¡µ•ÍÍ…”¤¤ì(((€€€€¼¨(€€€€€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3–Þ‡¦
?¦‚¦v‹žj(€€€€€€ƒš"Ã¦²—¢Î¢¢+¢š¢N/–Æ“¾ò'¾òh(€€€€€€ƒšZÃš"Ã¦²—¦Z/–ž/šâž¦ëžÒ¦2žj–B3šf¾ò0(€€€€€€ƒ–Þ‡¦
?¦‚¦v‹¦
’î÷’æ¢š’â¢Ößšâž¦ë¾ò0(€€€€€€ƒ’â7žÛšZÃš"Ã¦²—š&O–"Ã’â–6+¾ò3–Þ‡¦
?¦‚¦v‹–6ï¦
(€€€€€€ƒšºcžVg¢F_’â+’â+’â–‚Óžj¢"+žÒ¦2¾ò3–§¦
+šr–Â7’â7¢Öß’úŽ(€€€€¨¼((€€€½¹ÍÐµ…Á%¹™¼ô(€€€€€€€€ ‰µ…Á	…ÑÑ±•%¹™¼ˆ¤ì(((€€€¥˜¡µ…Á%¹™¼¥ì((€€€€€€€µ…Á%¹™¼¹¥¹¹•É!Q50ô(€€€€€€€€€€€€ˆˆì((€€€ô(((€€€€¼¨(€€€€€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò'¾òh(€€€€€€ƒšZÃš"Ã¦²—¦Z/–ž/¾ò3–në–ºk¦†¿ž’ëžj–n{–B#šVãš¢gžÆ(€€€€€€ƒ’æ¢š¦7žö»–n{ž²°Ç–n{–B#¾ò3’â7žÛšršºcžVd(€€€€€€ƒ’â+’â–‚Óš"Ã¦²—žÖCšvšfžj–n{–B#šVãŽ(€€€€¨¼((€€€½¹ÍÐÑÕÉ¹%¹‘¥…Ñ½Èô(€€€€€€€€ ‰‰…ÑÑ±•QÕÉ¹%¹‘¥…Ñ½Èˆ¤ì(((€€€¥˜¡ÑÕÉ¹%¹‘¥…Ñ½È¥ì((€€€€€€€ÑÕÉ¹%¹‘¥…Ñ½È¹Ñ•áÑ½¹Ñ•¹Ðô(€€€€€€€€€€€€‹ž²°€Äƒ–n{–B ˆì((€€€ô(((€€€½¹ÍÐµ…ÁQÕÉ¹%¹‘¥…Ñ½Èô(€€€€€€€€ ‰µ…Á	…ÑÑ±•QÕÉ¹%¹‘¥…Ñ½Èˆ¤ì(((€€€¥˜¡µ…ÁQÕÉ¹%¹‘¥…Ñ½È¥ì((€€€€€€€µ…ÁQÕÉ¹%¹‘¥…Ñ½È¹Ñ•áÑ½¹Ñ•¹Ðô(€€€€€€€€€€€€‹ž²°€Äƒ–n{–B ˆì((€€€ô()ô(((¼¨(€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò'¾òh(€€ƒšÆë–ºk–n{–B#¢Î¢¢+–"_¾ò#ž²±c–n{–B#¾ò?–KšVã¾ò?žn»š¢g¾ò$(€€ƒ¢Þš"Ã¦²—š2’î“š2'¦"W–6¾ò#š*¢ô¿šf»¦kšRïšN(¿¦bËžš˜¼(€€ƒž&§–N¿¦¢¯¾ò'ž>û–r£¢¦Ë¦†¿ž’ë¦
šb¿¢¦Ë¢^?¢Öß’úŽ((€€ƒ¢š?–&¾òh(€€€´…ÕÑ½	…ÑÑ±—ž
éÑÉÕ—¾ò#¢«–.Wš"Ã¦²—š2žê3¦Z/¢F_¾ò'¾òh(€€€€ƒ’â7žº‡ž>û–r£šb¿–º–F+¦
šb¿žÖCžº_¦j;šº×¾ò3’â–ú/¢^?¢Öß’ú¾ò0(€€€€ƒ’â7šrš¾?–/¢žK¢&Ë¢†3–.W–º3–ÂÇ–"š>o’âš²‡Ž¦‚ïžæ¦Zž"7Ž(€€€´…ÕÑ½	…ÑÑ±—ž
é™…±Í—¾ò#š&/–.W¾ò'¾òh(€€€€ƒžÖCžº_¦j;šº×¾ò!‰…ÑÑ±•A¡…Í”ôôô‰É•Í½±Ù”‹¾ò0(€€€€ƒ¦ngšZçš¶–r£’úw–ê?žrš¶–ëš&/¾ò'¢^?¢Öß’ú¾ò3šâo–ÂGžV¯¦vˆ(€€€€ƒ¦ns¢¢+¾òo–º–F+¦j;šº×¾ò!‰…ÑÑ±•A¡…Í”ôôô‰‘•±…É”‹¾ò0(€€€€ƒž¶'ž:§–ºÛ¢«–ÞÇ¦ãšN¢š–k’î¦êó¾ò'¦†¿ž’ë–ë’ú¾ò0(€€€€ƒ’â7žÛž:§–ºÛšržr/’â7–"Ãš2'¦"WŽ’â7ž~—¦O¢š¦î{–N«¢Ž‡Ž((€€ƒ¢^?¢Öß’úžjšf–g¦‚’úÿ¦^s¦Z'–>¿¢÷¦
¦Z/¢F_žjš*¢ô¼(€€ƒž&§–N–¶C¦ã–Z»¾ò!±½Í•5•¹ÕÌ §¾ò'¾ò3¦ÿ–7š2'¦"W–6 (€€ƒ¢Š¯¢^?¢Öß’úŽ–¶C¦ã–Z»–6ï¦
¦Ž–r£žV¯¦v‹’â+žjš«ž.šÎŽ(¨¼()™Õ¹Ñ¥½¸ÕÁ‘…Ñ•Ñ¥½¹!Õ‘Y¥Í¥‰¥±¥Ñä ¥ì((€€€½¹ÍÐ…Ñ¥Ù•ÕÑ¼ô(€€€€€€€…Ñ¥Ù•	…ÑÑ±•¡…É…Ñ•É%¹‘•àôôôÀ(€€€€€€€€ü…ÕÑ½	…ÑÑ±”(€€€€€€€€è•ÑA…ÉÑåÕÑ½½¹™¥œ¡…Ñ¥Ù•	…ÑÑ±•¡…É…Ñ•É%¹‘•à¤¹•¹…‰±•ì((€€€½¹ÍÐ‰…ÑÑ±•AÉ•Í•¹Ñ…Ñ¥½¹Ñ¥Ù”ô„„ (€€€€€€€ÑåÁ•½˜Ý¥¹‘½Ü„ôô‰Õ¹‘•™¥¹•ˆ˜˜(€€€€€€€Ý¥¹‘½Ü¹½ÕÉMåµ‰½±Í	…ÑÑ±•±½Ü˜˜(€€€€€€€ÑåÁ•½˜Ý¥¹‘½Ü¹½ÕÉMåµ‰½±Í	…ÑÑ±•±½Ü¹¥ÍAÉ•Í•¹Ñ…Ñ¥½¹Ñ¥Ù”ôôô‰™Õ¹Ñ¥½¸ˆ˜˜(€€€€€€€Ý¥¹‘½Ü¹½ÕÉMåµ‰½±Í	…ÑÑ±•±½Ü¹¥ÍAÉ•Í•¹Ñ…Ñ¥½¹Ñ¥Ù” ¤(€€€€¤ì((€€€½¹ÍÐÍ¡½Õ±‘!¥‘”ô(€€€€€€€…Ñ¥Ù•ÕÑ¼ñð‰…ÑÑ±•A¡…Í”ôôô‰É•Í½±Ù”ˆñð‰…ÑÑ±•AÉ•Í•¹Ñ…Ñ¥½¹Ñ¥Ù”ì(((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾ò#’úwžŸ’öÿžR£¢šúšâ¾ò3–#–&7žB¢ž¦2¿’ê¾ò'¾òh(€€€€€€ƒ–n{–B#¢Î¢¢+–"_¾ò#–B¯–n{–B#šVà¿¢¢#šf–f ¿žn»š¢g¾ò$(€€€€€€ƒ¢«–.Wš"Ã¦²—šfžŸ¢"+šVÓ–/¦jÇ¢^?¾ò3’â7ž&ç–"—žVd(€€€€€€ƒ–n{–B#šVã–r£¦g¢Ž‡ŠSŠS’öÿžR£¢¢šžjšb¿Ž3š"Ã¦²”(€€€€€€ƒ¢Î¢¢(£š"Ã¦²—žÒ¦2š†§šr³¢ê¯Ž7¦†¿ž’ëžn»–&7–n{–B#šVã¾ò0(€€€€€€ƒ’â7šb¿¦g–/š2'¦"W–"_žj’â¦£–"¾ò3šRç–n{–:šr°(€€€€€€ƒžjšVÓ¦®S¦jÇ¢^?¦
?¢ò¿Ž(€€€€¨¼((€€€½¹ÍÐÑÕÉ¹I½Üô(€€€€€€€€ ‰ÑÕÉ¹Q…É•ÑI½Üˆ¤ì(((€€€¥˜¡ÑÕÉ¹I½Ü¥ì((€€€€€€€ÑÕÉ¹I½Ü¹±…ÍÍ1¥ÍÐ¹Ñ½±” (€€€€€€€€€€€€‰‰…ÑÑ±”µ¡Õµ¡¥‘‘•¸ˆ°(€€€€€€€€€€€Í¡½Õ±‘!¥‘”(€€€€€€€€¤ì((€€€ô(((€€€½¹ÍÐ½µµ…¹‘I½Üô(€€€€€€€€ ‰‰…ÑÑ±•½µµ…¹‘I½Üˆ¤ì(((€€€¥˜¡½µµ…¹‘I½Ü¥ì((€€€€€€€½µµ…¹‘I½Ü¹±…ÍÍ1¥ÍÐ¹Ñ½±” (€€€€€€€€€€€€‰‰…ÑÑ±”µ¡Õµ¡¥‘‘•¸ˆ°(€€€€€€€€€€€Í¡½Õ±‘!¥‘”(€€€€€€€€¤ì(((€€€€€€€¥˜¡Í¡½Õ±‘!¥‘”¥ì((€€€€€€€€€€€±½Í•5•¹ÕÌ ¤ì(€€€€€€€€€€€±•…É	…ÑÑ±•Q…É•ÑM•±•Ñ¥½¹5½‘” ¤ì((€€€€€€€ô((€€€ô()ô(()™Õ¹Ñ¥½¸…‘‘	…ÑÑ±•1½œ¡Ñ•áÐ¥ì((€€€½¹ÍÐ¥¹™¼€ô(€€€€€€€€ ‰‰…ÑÑ±•%¹™¼ˆ¤ì(((€€€¥˜ …¥¹™¼¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò'¾òh(€€€€€€ƒ’æ/–&7š¾?–*ƒ’â¢†3šZÃ¢¢+š¿¾ò3–ÂÇ–òß–"Ûš*+š6Ë¢îãš.'–"À(€€€€€€ƒšr–êW¦£¾ò3–Â;¢Ó’öÿžR£¢–ú’â+šîGšÏžr/’æ/–&7žj(€€€€€€ƒžÒ¦2šf¾ò3’âšr'šZÃ¢¢+š¿¦Ë’ú–ÂÇ¢Š¯–òß–"Ûš.'–n{–:ï¾ò0(€€€€€€ƒ–º3–£žr/’â7–"ÃšÏžr/žj–Ÿ–ºçŽ((€€€€€€ƒšRçš"C–#–"“šZßŽ3’öÿžR£¢ž>û–r£šb¿’â7šb¿–ÞËžÚO–r (€€€€€€ƒš:—¢þG–êW¦£Ž7¾ò#–ºç¢¢ÄÈÁÁãžj¢ª“–Þ»¾ò'¾ò0(€€€€€€ƒ–>«šr'–r£Ž3–:šr³–ÂÇ–r£–êW¦£¦f¢þGŽ7žjššÎ’â/¾ò0(€€€€€€ƒš&7¢«–.Wš6Ë–"ÃšZÃ¢¢+š¿¾òo–ššzs’öÿžR£¢–ÞËžÚL(€€€€€€ƒ’âï–.W–ú’â+šîG¦Z/’âšº×¢Þw¦n‹¾ò3’î¢†£’î[š¶–r (€€€€€€ƒ–n{¦‚·žr/’æ/–&7žjžÒ¦2¾ò3¦gšf–gšZÃ¢¢+š¿¦Ë’ú(€€€€€€ƒ’â7šrš&OšZß’î[¾ò3š6Ë–.W’ö7žö»žÚ·š2’â7¢º+Ž(€€€€¨¼((€€€½¹ÍÐÝ…Í9•…É	½ÑÑ½´ô((€€€€€€€¥¹™¼¹ÍÉ½±±!•¥¡Ð´(€€€€€€€¥¹™¼¹ÍÉ½±±Q½À´(€€€€€€€¥¹™¼¹±¥•¹Ñ!•¥¡Ð(€€€€€€€€ðÈÀì(((€€€½¹ÍÐ±¥¹”€ô(€€€€€€€‘½Õµ•¹Ð¹É•…Ñ•±•µ•¹Ð (€€€€€€€€€€€€‰‘¥Øˆ(€€€€€€€€¤ì(((€€€±¥¹”¹±…ÍÍ9…µ”€ô(€€€€€€€€‰‰…ÑÑ±”µ±¥¹”ˆì(((€€€±¥¹”¹Ñ•áÑ½¹Ñ•¹Ð€ô(€€€€€€€Ñ•áÐì(((€€€¥¹™¼¹…ÁÁ•¹‘¡¥± (€€€€€€€±¥¹”(€€€€¤ì(((€€€Ý¡¥±” (€€€€€€€¥¹™¼¹¡¥±‘É•¸¹±•¹Ñ øàÀ(€€€€¥ì((€€€€€€€¥¹™¼¹É•µ½Ù•¡¥± (€€€€€€€€€€€¥¹™¼¹™¥ÉÍÑ¡¥±(€€€€€€€€¤ì((€€€ô(((€€€¥˜¡Ý…Í9•…É	½ÑÑ½´¥ì((€€€€€€€¥¹™¼¹ÍÉ½±±Q½À€ô(€€€€€€€€€€€¥¹™¼¹ÍÉ½±±!•¥¡Ðì((€€€ô(((€€€€¼¨(€€€€€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3–Þ‡¦
?¦‚¦v‹žj(€€€€€€ƒš"Ã¦²—¢Î¢¢+¢š¢N/–Æ“¾ò'¾òh(€€€€€€ƒš¾?–*ƒ’â¢†3š"Ã¦²—žÒ¦2¾ò3–B3š¶—¢’¢Ž÷’â’î÷–"À(€€€€€€ƒ–Þ‡¦
?¦‚¦v‹¦
’î÷š"Ã¦²—¢Î¢¢+š†ŠSŠS¦gšb¿–R¿’â (€€€€€€ƒ¢Êƒ¢Ê³–¾¯–—š"Ã¦²—žÒ¦2šZ–¶_žj–rÃšZç¾ò0(€€€€€€ƒ–r£¦g¢Ž‡–B3š¶—šr–Z»žÒS¾ò3’â7žR£–>›–’[š&ø(€€€€€€ƒš¾?’â–/–Fó–>­…‘‘	…ÑÑ±•1½œ §žj–rÃšZä(€€€€€€ƒ–B¢«¢fWžBŽ¦g’î÷’â7žR£¢fWžBŽ3š6Ë–"Ã–êW¦£Ž4(€€€€€€ƒžj¦
?¢ò¿¾ò3ž:§–ºÛ¦n‹¦Z/š"Ã¦²—Ž–n{–"Ã–rÃ–r[’æ/–ú0(€€€€€€ƒš&7šržr/–"Ã¦g’î÷¾ò3’â7šršr'Ž3šZÃ¢¢+š¿’âžnÐ(€€€€€€ƒš&OšZßš¶–r£žr/žj–Ÿ–ºçŽ7žj–V?¦†3Ž(€€€€¨¼((€€€½¹ÍÐµ…Á%¹™¼ô(€€€€€€€€ ‰µ…Á	…ÑÑ±•%¹™¼ˆ¤ì(((€€€¥˜¡µ…Á%¹™¼¥ì((€€€€€€€½¹ÍÐµ…Á1¥¹”ô(€€€€€€€€€€€‘½Õµ•¹Ð¹É•…Ñ•±•µ•¹Ð (€€€€€€€€€€€€€€€€‰‘¥Øˆ(€€€€€€€€€€€€¤ì(((€€€€€€€µ…Á1¥¹”¹±…ÍÍ9…µ”ô(€€€€€€€€€€€€‰‰…ÑÑ±”µ±¥¹”ˆì(((€€€€€€€µ…Á1¥¹”¹Ñ•áÑ½¹Ñ•¹Ðô(€€€€€€€€€€€Ñ•áÐì(((€€€€€€€µ…Á%¹™¼¹…ÁÁ•¹‘¡¥± (€€€€€€€€€€€µ…Á1¥¹”(€€€€€€€€¤ì(((€€€€€€€Ý¡¥±” (€€€€€€€€€€€µ…Á%¹™¼¹¡¥±‘É•¸¹±•¹Ñ øàÀ(€€€€€€€€¥ì((€€€€€€€€€€€µ…Á%¹™¼¹É•µ½Ù•¡¥± (€€€€€€€€€€€€€€€µ…Á%¹™¼¹™¥ÉÍÑ¡¥±(€€€€€€€€€€€€¤ì((€€€€€€€ô(((€€€€€€€µ…Á%¹™¼¹ÍÉ½±±Q½Àô(€€€€€€€€€€€µ…Á%¹™¼¹ÍÉ½±±!•¥¡Ðì((€€€ô()ô(((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€ƒž:§–ºÛ¢Î¢¢((ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼()™Õ¹Ñ¥½¸ÕÁ‘…Ñ•A±…å•É!•…‘•È ¥ì((€€€½¹ÍÐ•±•µ•¹Ð€ô(€€€€€€€•±•µ•¹Ñ…Ñ…‰…Í•l(€€€€€€€€€€€Á±…å•È¹•±•µ•¹Ð(€€€€€€€t(€€€€€€€ñð(€€€€€€€•±•µ•¹Ñ…Ñ…‰…Í”¹™¥É”ì(((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò1•µ½©§š>oš"@(€€€€€€MO–.WžV¯–r[ž’ë¾ò'¾òiÑ•áÑ½¹Ñ•¹ÓšRçš"@(€€€€€€¥¹¹•É!Q53¾ò3š&7¢÷žržjš*((€€€€€€€ñÍÁ…¸±…ÍÌô‰•±•µ•¹Ðµ¥½¸¸¸¸ˆø(€€€€€€ƒ¦gž¢¹!Q53š¢gžÆ“šâËš~O–ë’ú¾ò3’â7žÛšr¢Š¬(€€€€€€ƒžVÛš"CžÒSšZ–¶_–¶_¦v‹¦†¿ž’ëŽ(€€€€¨¼((€€€€ ‰Á±…å•É9…µ”ˆ¤(€€€€€€€€¹¥¹¹•É!Q50€ô((€€€€€€€•Ñ±•µ•¹Ñ%½¹!Q50 (€€€€€€€€€€€Á±…å•È¹•±•µ•¹Ð(€€€€€€€€¤¬(€€€€€€€€ˆˆ¬(€€€€€€€€ (€€€€€€€€€€€Á±…å•È¹¥‘ñð(€€€€€€€€€€€•±•µ•¹Ð¹¡…É…Ñ•È(€€€€€€€€¤ì(((€€€€ ‰•±•µ•¹ÑQ•áÐˆ¤(€€€€€€€€¹¥¹¹•É!Q50€ô((€€€€€€€•Ñ±•µ•¹Ñ%½¹!Q50 (€€€€€€€€€€€Á±…å•È¹•±•µ•¹Ð(€€€€€€€€¤¬(€€€€€€€€ˆˆ¬(€€€€€€€•±•µ•¹Ð¹¹…µ”ì()ô(((¼¨(€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò'¾òh(€€ƒ–r£–Þ‡¦
?¾ò?–rÃ–r[¦‚¦v‹šf¾ò3šr’â+¦v‹¦
šŠwš¢g¦†3–"\(€€ƒ’â7¦†¿ž’ë¢žK¢&Ëžjž¶'žÒh½!@½MC¾ò3šRç¦†¿ž’ëŽ3–rÃ–rX(€€ƒ–B7ž¢ÇŽ7¾ò/Ž3š«ž&§¢Î¢¢+¾ò#–B7ž¢Ä¿–Æ³šœ¿¢†¦<¼(€€ƒšV?š6ß¾ò'Ž7Ž((€€ƒš«ž&§¢Î¢¢+š*Ožjšb¿žn»–&7–rÃ–r[’â+¾ò!µ½¹ÍÑ•ÉÍlÁuø(€€µ½¹ÍÑ•ÉÍm5a}QI%9%9}5=9MQIL´Åw¾ò$(€€ƒž²³’â¦jï¦
šÒï¢F_žjš«ž&§ŠSŠS¢Þ}ÉÕ¹ÕÑ½A…ÑÉ½±¡•¬ ¤(€€ƒ¢«–.W–Þ‡š«šfŽ3š&Ož²³’â¦jï¦
šÒï¢F_žjš«ž&§Ž7žR£žj(€€ƒšb¿–B3’â–/¦
?¢ò¿¾ò3¦g¢Ž‡¦†¿ž’ëžj–ÂÇšb¿Ž3–Þ‡š«š2'’â/–:ì(€€ƒšrš&O–"Ãžj¦
¦jïš«ž&§Ž7¾ò3’â7šb¿¦j£’úÿš*O’â¦jïŽ((€€ƒ–§žÖš¢g¦†3–"_¾ò#–:šr³žj¢žK¢&Ë¢Î¢¢+¾ò?¦g¢Ž‡šZÃ–Š{žj(€€ƒ–rÃ–rX¯š«ž&§¢Î¢¢+¾ò'–æÏ–âã–>«šr¦†¿ž’ë’âžÖ¾ò0(€€ƒ–r¡Í¡½ÝA…” §¢Ž‡–"š>o¦‚¦v‹šfšr–Fó–>¯¦g¢Ž„(€€ƒ¦7šZÃ–"“šZß¢š¦†¿ž’ë–N«’âžÖŽ(¨¼((¼¨(€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3žÞÓ–*–6šRçž& (€€ƒ–ÇžR£¦
?¢ò¿¾ò'¾òh(€€ƒš*+Ž3–"_–ëš~C–/–rÃ–6–£¦£š«ž&§ž¢»¦†{žj–B7ž¢Ä¼(€€ƒž¶'žÒh¿šV?š6ßŽ7¦gšº×¦
?¢ò¿š*÷š"Cž6£ž®/–÷–ò?¾ò0(€€ƒ–rÃ–r[¦‚¦v‹žjš«ž&§šâ–Z»š†ŽžÞÓ–*–6šZÃžj(€€ƒ–rÃ–r[¢Î¢¢+–ö#žª_¾ò3–§¦
+¦÷¢šžR£–"Ã–B3’â––_¾ò0(€€ƒ’â7¢š–B¢«–¾¯’â’î÷–æû’æ;’âš¢žjž¢/–ò?žŠóŽ((€€ƒ–B3–B7š«ž&§¾ò#š.ÿš:'ž:,¿žj’â7žº_¾ò'–>«–"_’âš²‡¾ò0(€€ƒ’â7–"_¢†¦?¾ò3žR¡½¹™¥œ¹µ½¹ÍÑ•ÉÌ §š.ÿ–"À(€€ƒšVÓ’î÷–:–ž/–B7–Z»¾ò#’â7šb½ÕÉÉ•¹Ñ	…ÑÑ±•5½¹ÍÑ•ÉÌ(€€ƒ¦gž¢»Ž3¦g–‚Óš"Ã¦²—š*÷–"Ã¢ªÃŽ7žjšâ–Z»¾ò'¾ò0(€€ƒžŠë’þw–ÂÇžº_š«ž&§–r£š"Ã¦²—¢Ž‡¢Š¯š&Oš¶ï¾ò3šâ–Z¸(€€ƒ¦
šb¿–º3šVÓ¦†¿ž’ë¦g–/–rÃ–6Ž3šr'–N«’êož¢»¦†{Ž7Ž(¨¼()™Õ¹Ñ¥½¸•Ñi½¹•5½¹ÍÑ•É1¥ÍÑ!Q50¡é½¹•-•ä¥ì((€€€½¹ÍÐ½¹™¥œô(€€€€€€€é½¹•½¹™¥mé½¹•-•åtì(((€€€¥˜ …½¹™¥œ¥ì(€€€€€€€É•ÑÕÉ¸ˆˆì(€€€ô(((€€€½¹ÍÐé½¹•5½¹ÍÑ•ÉÌô((€€€€€€€ÑåÁ•½˜½¹™¥œ¹µ½¹ÍÑ•ÉÌôôô(€€€€€€€€‰™Õ¹Ñ¥½¸ˆ(€€€€€€€€ü(€€€€€€€½¹™¥œ¹µ½¹ÍÑ•ÉÌ ¤(€€€€€€€€è(€€€€€€€mtì(((€€€½¹ÍÐÍ••¹9…µ•Ìô(€€€€€€€¹•ÜM•Ð ¤ì(((€€€½¹ÍÐ±¥¹•Ìô(€€€€€€€mtì(((€€€é½¹•5½¹ÍÑ•ÉÌ¹™½É…  (€€€€€€€µ½¹ÍÑ•Èôùì((€€€€€€€€€€€¥˜ (€€€€€€€€€€€€€€€€…µ½¹ÍÑ•Èñð(€€€€€€€€€€€€€€€Í••¹9…µ•Ì¹¡…Ì (€€€€€€€€€€€€€€€€€€€µ½¹ÍÑ•È¹¹…µ”(€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€¥ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€€€€€ô(((€€€€€€€€€€€Í••¹9…µ•Ì¹…‘ (€€€€€€€€€€€€€€€µ½¹ÍÑ•È¹¹…µ”(€€€€€€€€€€€€¤ì(((€€€€€€€€€€€±¥¹•Ì¹ÁÕÍ  ((€€€€€€€€€€€€€€€µ½¹ÍÑ•È¹¹…µ”¬(€€€€€€€€€€€€€€€€‰1Ø¸ˆ¬(€€€€€€€€€€€€€€€µ½¹ÍÑ•È¹±•Ù•°¬(€€€€€€€€€€€€€€€€‹šV?š6Üˆ¬(€€€€€€€€€€€€€€€5…Ñ ¹É½Õ¹ (€€€€€€€€€€€€€€€€€€€•Ñ5½¹ÍÑ•É¥±¥Ñä (€€€€€€€€€€€€€€€€€€€€€€€µ½¹ÍÑ•È(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€¤((€€€€€€€€€€€€¤ì((€€€€€€€ô(€€€€¤ì(((€€€É•ÑÕÉ¸±¥¹•Ì(€€€€€€€€¹µ…À (€€€€€€€€€€€±¥¹”ôø(€€€€€€€€€€€€€€€€ˆñ‘¥Øøˆ¬(€€€€€€€€€€€€€€€±¥¹”¬(€€€€€€€€€€€€€€€€ˆð½‘¥Øøˆ(€€€€€€€€¤(€€€€€€€€¹©½¥¸ ˆˆ¤ì()ô(((¼¨(€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3žÞÓ–*–6šRçž&#¾ò'¾òh(€€ƒš¾?–/–rÃ–6žj¢3šf¿žú;¢†O–r[¾ò3–#žVgž¦ë–¶_’âÈ(€€ƒ¾ò#’öÿžR£¢’æ/–ú3šr¢Žs’â)‰…Í”ØÓš"[–r[ž&žÚË–v¾ò0(€€ƒ–>«¢šš*+–Â7š'š²’ö7–†¯¦Ë–:ï–ÂÇšržRšV#¾ò0(€€…ÁÁ±åQÉ…¥¹¥¹i½¹•	…­É½Õ¹ §¢Þ¦g¢Ž„(€€ƒ–º3–£’â7žR£–7šRç¾ò'Ž(¨¼((¼¨(€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3–Þ‡š«¦‚¦vˆ(€€ƒ¾ò µ…ÁA…—¾ò'¢3šf¿šRçš"C’úw–rÃ–6–.Wš/–"š>o¾ò'¾òh(€€ƒ–:šr°µ…ÁA…—žj¢3šf¿šb¿–¾¯š¶ï–r¡MO¢Ž‡žj(€€ƒ–Z»’â–ò×šŽ»šz_–r[¾ò3’â7žº‡¦Ë–N«–/–rÃ–6¦÷¦Vß–ú\(€€ƒ’âš¢Ž¦g¢Ž‡šRçš"C¢ÞžÞÓ–*–6–rÃ–r[¦‚C¢š÷–B3’âž¢¸(€€ƒ¢¢·¢¢#ŠSŠS’â–/ž&§’îÛ¢Žw¢F_š¾?–/–rÃ–6–B¢«žj(€€ƒ¢3šf¿–r[¾ò1™½É•ÍÐ½‘•Í•ÉÓ–#šRû’â+’öÿžR£¢(€€ƒ¦gš²‡š>C’úožj–r[¾ò3–Û¦’c–rÃ–6žVgž¦ëŽ’æ/–ú0(€€ƒ’öÿžR£¢¢š¢Žs–r[ž&žnÓš:—–†¯¦Ë–Â7š'š²’ö7–ÂÇ––÷¾ò0(€€ƒ’â7žR£šRç’îï’öW–Û’î[ž¢/–ò?žŠóŽ((€€ƒ¦
šÊKšr'–Â#–Æ³–r[ž&žj–rÃ–6¾ò3––_žR¡…ÁÁ±å5…Ái½¹•	…­É½Õ¹ ¤(€€ƒšfšr¦–n{¦†¿ž’é™½É•ÍÓ¦g–ò×žVÛ¦‚C¢¢·–ó¾ò0(€€ƒ’â7šr–ëž>û’âž&¦îGžjžV¯¦v‹Ž(¨¼()½¹ÍÐµ…Ái½¹•	…­É½Õ¹‘%µ…•Ìõì((€€€™½É•ÍÐè‰…ÍÍ•ÑÌ½µ…ÁÌ½™½É•ÍÐ¹©Áœˆ°(€€€‘•Í•ÉÐè‰…ÍÍ•ÑÌ½µ…ÁÌ½‘•Í•ÉÐ¹©Áœˆ°(€€€¥”èˆˆ°(€€€é½¹”Ðèˆˆ°(€€€é½¹”Ôèˆˆ°(€€€é½¹”Øèˆˆ°(€€€é½¹”Üèˆˆ°(€€€é½¹”àèˆˆ°(€€€é½¹”äèˆˆ°(€€€é½¹”ÄÀèˆˆ()ôì(()™Õ¹Ñ¥½¸…ÁÁ±å5…Ái½¹•	…­É½Õ¹¡é½¹•-•ä¥ì((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾ò#’úwžŸ’öÿžR£¢–n{–‚Ç¾ò3šRçš"CšN7’öp(€€€€€€ƒž6£ž®/žjÁ½Í¥Ñ¥½¸é™¥á•“¢3šf¿–r[–Æ“¾ò0(€€€€€€ƒ’â7–7žnÓš:—–Â4µ…ÁA…—šr³¢ê¯¢¢·–ºh(€€€€€€‰…­É½Õ¹µ¥µ…—¾ò'Ž(€€€€¨¼((€€€½¹ÍÐ‰1…å•Èô(€€€€€€€€ ‰µ…ÁA…•	1…å•Èˆ¤ì(((€€€¥˜ …‰1…å•È¥ì(€€€€€€€É•ÑÕÉ¸ì€€€ô(((€€€½¹ÍÐ¥µ…•UÉ°ô((€€€€€€€µ…Ái½¹•	…­É½Õ¹‘%µ…•Ímé½¹•-•åuñð(€€€€€€€µ…Ái½¹•	…­É½Õ¹‘%µ…•Ì¹™½É•ÍÐì(((€€€‰1…å•È¹ÍÑå±”¹‰…­É½Õ¹‘%µ…”ô((€€€€€€€€‰ÕÉ° ˆ¬(€€€€€€€¥µ…•UÉ°¬(€€€€€€€€ˆ¤ˆì()ô(((¼¨(€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3Ž3š*¢÷¦7¢Žt(€€ƒ–>«¦†¿ž’é¥½»¾ò3žn»–&7šÊKšr%¥½»–r[ž’ë–ÂÇ–#ž¦ë¢F_Ž7¾ò'¾òh(€€ƒš*¢÷–r[ž’ëžj¦‚CžVgš~—š&û¢†£¾ò1­•çšb¿š*¢õ%¾ò0(€€Ù…±Õ—–#–£¦£žVgž¦ë–¶_’âËŽ’æ/–ú3¢š–æ¯š*¢÷¢Žp(€€ƒ–r[ž’ë¾ò3žnÓš:—–Â7¦g–/ž&§’îÛ–†¯–—–Â7š'žj(€€‰…Í”ØÓš"[–r[ž&žÚË–v–ÂÇšržRšV#¾ò#š*¢÷–"_¢†£Ž(€€ƒ¢Žw–
gš²š‚ó–¶CŽš*¢÷¢¦ÏžÒÃ–ö#žª_’â'–/–rÃšZç¦ô(€€ƒšr¢«–.W––_žR£–B3’â–ò×–r[¾ò3’â7žR£–"–"—–:ïšRç¾ò'¾ò0(€€ƒ’â7žR£šRç’îï’öW–Û’î[ž¢/–ò?žŠóŽ(¨¼()½¹ÍÐÍ­¥±±%½¹%µ…•Ìõ•±•µ•¹ÑM­¥±±%½¹5…Àì(()½¹ÍÐé½¹•	…­É½Õ¹‘%µ…•Ìõì((€€€™½É•ÍÐèˆˆ°(€€€‘•Í•ÉÐèˆˆ°(€€€¥”èˆˆ°(€€€é½¹”Ðèˆˆ°(€€€é½¹”Ôèˆˆ°(€€€é½¹”Øèˆˆ°(€€€é½¹”Üèˆˆ°(€€€é½¹”àèˆˆ°(€€€é½¹”äèˆˆ°(€€€é½¹”ÄÀèˆˆ()ôì(()™Õ¹Ñ¥½¸…ÁÁ±åQÉ…¥¹¥¹i½¹•	…­É½Õ¹¡é½¹•-•ä¥ì((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾ò#’úwžŸ’öÿžR£¢–n{–‚Ç¾ò3šRçš"CšN7’öp(€€€€€€ƒž6£ž®/žjÁ½Í¥Ñ¥½¸é™¥á•“¢3šf¿–r[–Æ“¾ò'¾òh(€€€€€€ƒ¦g–/–r[–Æ“žjML±…ÍÏšr³¢ê¯–ÞËžÚO–Ÿ–îë’ê(€€€€€€ƒŽ3¢ªÿšj_šòã–Æ¯¦‚C¢¢·žâ÷¢š÷–r[Ž7¦g–/žÖ–B (€€€€€€ƒ¾ò#¢š,¹ÑÉ…¥¹¥¹œµ‰œµ™¥á•µ±…å•Ë¾ò'¾ò0(€€€€€€ƒ¦g¢Ž‡–ššzs–>«žR£¢†3–Ÿš¢–ò?¢N/’â–/–Z»žÒSžj(€€€€€€ÕÉ° ¸¸¸§’â+–:ï¾ò3šrš*+¢ªÿšj_šòã–Æ“’â¢Öß¢N/š:'Ž(€€€€€€ƒ–/–"—–rÃ–6žj–r[ž&šr¢º+š"CšÊKšr'¢ªÿšj_šV#šzs¾ò0(€€€€€€ƒ¢Þžâ÷¢š÷–r[’â7’â¢ÓŽš&’î—¦g¢Ž‡¢¢·–ºk¢†3–œ(€€€€€€ƒš¢–ò?šf¾ò3’âš¢¢šžR£Ž3šòã–Æ¯–r[ž&Ž7žj(€€€€€€ƒžÖ–B#–¾¯šÎW¾ò3’â7¢÷–>«–¾­ÕÉ° §Ž(€€€€¨¼((€€€½¹ÍÐ‰1…å•Èô(€€€€€€€€ ‰ÑÉ…¥¹¥¹A…•	1…å•Èˆ¤ì(((€€€¥˜ …‰1…å•È¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€½¹ÍÐ¥µ…•UÉ°ô(€€€€€€€é½¹•	…­É½Õ¹‘%µ…•Ímé½¹•-•åtì(((€€€¥˜¡¥µ…•UÉ°¥ì((€€€€€€€½¹ÍÐ¹•áÑ	…­É½Õ¹ô(€€€€€€€€€€€€‰±¥¹•…ÈµÉ…‘¥•¹Ð¡É‰„ À°À°À°¸Ð¤±É‰„ À°À°À°¸Ð¤¤°ˆ¬(€€€€€€€€€€€€‰ÕÉ° ˆ¬(€€€€€€€€€€€¥µ…•UÉ°¬(€€€€€€€€€€€€ˆ¤ˆì((€€€€€€€¥˜¡‰1…å•È¹ÍÑå±”¹‰…­É½Õ¹‘%µ…”„ôõ¹•áÑ	…­É½Õ¹¥ì(€€€€€€€€€€€‰1…å•È¹ÍÑå±”¹‰…­É½Õ¹‘%µ…”õ¹•áÑ	…­É½Õ¹ì(€€€€€€€ô((€€€ô(€€€•±Í•ì((€€€€€€€€¼¨(€€€€€€€€€€Xäß¾òkšÊKšr'–Â#–Æ³–r[ž&šf–>«–r£žržj–¶c–r£¢†3–Ÿ¢3šf¿šfš&7šâ¦f“Ž(€€€€€€€€€€ƒ¦;–:ïš¾?š²‡š&O¦Z/–rÃ–6¢Î¢¢+¦÷¦7–¾­‰…­É½Õ¹‘%µ…—¾ò3¦7–B (€€€€€€€€€€M…µÍÕ¹œ	É½ÝÍ•ËžjÑÉ…¹Í™½É·žâ»šRû¢"™¥á•“¢3šf¿šr¢žãžfóšb¢ÊÓ¦7žæ«Ž(€€€€€€€€€€ƒž>û–r£¦ÿ–7ž‡š?žú§žjÍÑå±”µÕÑ…Ñ¥½»¾ò3žnÓš:—šÊÿžR¡MOžâ÷¢š÷¢3šf¿Ž(€€€€€€€€¨¼((€€€€€€€¥˜¡‰1…å•È¹ÍÑå±”¹‰…­É½Õ¹‘%µ…”¥ì(€€€€€€€€€€€‰1…å•È¹ÍÑå±”¹É•µ½Ù•AÉ½Á•ÉÑä ‰‰…­É½Õ¹µ¥µ…”ˆ¤ì(€€€€€€€ô((€€€ô()ô(((¼¨(€€ƒŠbƒšZÃ–Š{¾òkžÞÓ–*–6–rÃ–6¢Î¢¢+–ö#žª_ŠSŠS¦î{šZ–¶\(€€ƒšf¢žãžfó¾ò3¦†¿ž’ë¦g–/–rÃ–6žjš«ž&§šâ–Z»¾ò0(€€ƒ’â›’úwžŸžn»–&7ž¶'žÒkšÆë–ºkŽ3¦Ë–—Ž7š2'¦"W¢÷’â7¢ô(€€ƒš2'Ž¢Þ’âï–~;¦
š&ç–ö#žª_–ÇžR£–B3’â––\(€€€¹¡½µ”µ™•…ÑÕÉ”µµ½‘…³š¢–ò?Ž(¨¼()™Õ¹Ñ¥½¸½Á•¹QÉ…¥¹¥¹i½¹•%¹™¼¡é½¹•-•ä¥ì((€€€½¹ÍÐ½¹™¥œô(€€€€€€€é½¹•½¹™¥mé½¹•-•åtì(((€€€½¹ÍÐµ½‘…°ô(€€€€€€€€ ‰ÑÉ…¥¹¥¹i½¹•5½‘…°ˆ¤ì((€€€½¹ÍÐÑ¥Ñ±•°ô(€€€€€€€€ ‰ÑÉ…¥¹¥¹i½¹•5½‘…±Q¥Ñ±”ˆ¤ì((€€€½¹ÍÐ‰½‘å°ô(€€€€€€€€ ‰ÑÉ…¥¹¥¹i½¹•5½‘…±	½‘äˆ¤ì(((€€€¥˜ (€€€€€€€€…½¹™¥œñð(€€€€€€€€…µ½‘…°ñð(€€€€€€€€…Ñ¥Ñ±•°ñð(€€€€€€€€…‰½‘å°(€€€€¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€…ÁÁ±åQÉ…¥¹¥¹i½¹•	…­É½Õ¹ (€€€€€€€é½¹•-•ä(€€€€¤ì(((€€€Ñ¥Ñ±•°¹Ñ•áÑ½¹Ñ•¹Ðô(€€€€€€€½¹™¥œ¹Ñ¥Ñ±•ñð‹–rÃ–6¢Î¢¢(ˆì(((€€€½¹ÍÐµ½¹ÍÑ•É1¥ÍÑ!Q50ô(€€€€€€€•Ñi½¹•5½¹ÍÑ•É1¥ÍÑ!Q50 (€€€€€€€€€€€é½¹•-•ä(€€€€€€€€¤ì(((€€€½¹ÍÐÕ¹±½­•ô((€€€€€€€Á±…å•È¹±•Ù•°øô(€€€€€€€½¹™¥œ¹É•ÅÕ¥É•‘1•Ù•°ì(((€€€‰½‘å°¹¥¹¹•É!Q50ô((€€€€€€€€œñ‘¥ØÍÑå±”ô‰™½¹ÐµÍ¥é”èÄÙÁàí½±½Èè˜ÁˆÐÈäíµ…É¥¸µ‰½ÑÑ½´èáÁàìˆøœ¬(€€€€€€€€¡½¹™¥œ¹±•Ù•±I…¹•ñðˆˆ¤¬(€€€€€€€€ˆð½‘¥Øøˆ¬((€€€€€€€€œñ‘¥ØÍÑå±”ô‰™½¹ÐµÍ¥é”èÄÙÁàí±¥¹”µ¡•¥¡ÐèÄ¸äíµ…É¥¸µ‰½ÑÑ½´èÄÙÁàìˆøœ¬(€€€€€€€€ (€€€€€€€€€€€µ½¹ÍÑ•É1¥ÍÑ!Q51ñð(€€€€€€€€€€€€œñÍÁ…¸ÍÑå±”ô‰½±½ÈèˆÍ„ÔáŒìˆû¾ò#–Âkž‡š«ž&§¢ÎšZg¾ò$ð½ÍÁ…¸øœ(€€€€€€€€¤¬(€€€€€€€€ˆð½‘¥Øøˆ¬((€€€€€€€€œñ‘¥ØÍÑå±”ô‰‘¥ÍÁ±…äé™±•àí…ÀèáÁàìˆøœ¬((€€€€€€€€ (€€€€€€€€€€€Õ¹±½­•(€€€€€€€€€€€€ü(€€€€€€€€€€€€œñ‰ÕÑÑ½¸±…ÍÌô‰¡½µ”µ™•…ÑÕÉ”µ‰Õäµ‰Ñ¸‰ÍÑå±”ô‰™±•àèÄíÁ…‘‘¥¹œèÄÁÁà€ÄÉÁàí™½¹ÐµÍ¥é”èÄÙÁàíµ¥¸µ¡•¥¡ÐèÐÙÁàìˆœ¬(€€€€€€€€€€€€½¹±¥¬ô‰±½Í•QÉ…¥¹¥¹i½¹•%¹™¼ ¤í•¹Ñ•Éi½¹”¡pœœ¬(€€€€€€€€€€€é½¹•-•ä¬(€€€€€€€€€€€€pœ¤ìˆøœ¬(€€€€€€€€€€€€‹¦Ë–”ˆ¬(€€€€€€€€€€€€ˆð½‰ÕÑÑ½¸øˆ(€€€€€€€€€€€€è(€€€€€€€€€€€€œñ‰ÕÑÑ½¸±…ÍÌô‰¡½µ”µ™•…ÑÕÉ”µ‰Õäµ‰Ñ¸‰ÍÑå±”ô‰™±•àèÄíÁ…‘‘¥¹œèÄÁÁà€ÄÉÁàí™½¹ÐµÍ¥é”èÄÙÁàíµ¥¸µ¡•¥¡ÐèÐÙÁàì‰‘¥Í…‰±•øœ¬(€€€€€€€€€€€€‹¦r¢š1Ø¸ˆ¬(€€€€€€€€€€€½¹™¥œ¹É•ÅÕ¥É•‘1•Ù•°¬(€€€€€€€€€€€€ˆð½‰ÕÑÑ½¸øˆ(€€€€€€€€¤¬((€€€€€€€€œñ‰ÕÑÑ½¸±…ÍÌô‰¡½µ”µ™•…ÑÕÉ”µ‰Õäµ‰Ñ¸‰ÍÑå±”ô‰™±•àèÄíÁ…‘‘¥¹œèÄÁÁàìˆœ¬(€€€€€€€€½¹±¥¬ô‰±½Í•QÉ…¥¹¥¹i½¹•%¹™¼ ¤ìˆøœ¬(€€€€€€€€‹¢þS–nxˆ¬(€€€€€€€€ˆð½‰ÕÑÑ½¸øˆ¬((€€€€€€€€ˆð½‘¥Øøˆì(((€€€µ½‘…°¹±…ÍÍ1¥ÍÐ¹…‘ (€€€€€€€€‰Í¡½Üˆ(€€€€¤ì()ô(()™Õ¹Ñ¥½¸±½Í•QÉ…¥¹¥¹i½¹•%¹™¼ ¥ì((€€€½¹ÍÐµ½‘…°ô(€€€€€€€€ ‰ÑÉ…¥¹¥¹i½¹•5½‘…°ˆ¤ì(((€€€¥˜¡µ½‘…°¥ì((€€€€€€€µ½‘…°¹±…ÍÍ1¥ÍÐ¹É•µ½Ù” (€€€€€€€€€€€€‰Í¡½Üˆ(€€€€€€€€¤ì((€€€ô()ô(()™Õ¹Ñ¥½¸ÕÁ‘…Ñ•5…ÁA…•!•…‘•È ¥ì((€€€½¹ÍÐµ…ÁA…•±•µ•¹Ðô(€€€€€€€€ ‰µ…ÁA…”ˆ¤ì(((€€€½¹ÍÐ¥Í5…ÁA…”ô((€€€€€€€µ…ÁA…•±•µ•¹Ð€˜˜(€€€€€€€µ…ÁA…•±•µ•¹Ð¹±…ÍÍ1¥ÍÐ¹½¹Ñ…¥¹Ì (€€€€€€€€€€€€‰…Ñ¥Ù”ˆ(€€€€€€€€¤ì(((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3Ž3’â7šb¿¦jÇ¢^?¾ò0(€€€€€€ƒšb¿šVÓ–/š.ÿš:'¾ò3’â7¢šžVg’â–†+¦îG¢&Ëž¦ëžf÷Ž7¾ò'¾òh(€€€€€€ƒ¦g¢Ž‡–:šr³¢«–ÞÇ–ršÎWž'¦.ó–¾¯’ê’â’î÷Ž3’âï–~;šf(€€€€€€ƒ¦jÇ¢^?š¢g¦†3–"_Ž7žj¦
?¢ò¿¾ò3–>«žR¡‘¥ÍÁ±…äé¹½¹”(€€€€€€ƒ¢N/š:'–Ÿ–ºç¾ò3’ö¹½¹Ñ•¹Ó¦
–†+–6–~–:šr³šb¼(€€€€€€ƒžR¡Á½Í¥Ñ¥½¸é…‰Í½±ÕÑ”íÑ½ÀèØÉÁãžº_––ô(€€€€€€ƒŽ3š&š:'š¢g¦†3–"_¦®c–ê›–ú3Ž7žj’ö7žö»¾ò3š¢g¦†3–"\(€€€€€€ƒšÚ#–’Ç’êŽ¹½¹Ñ•¹ÓšÊKšr'¢Þ¢F_¢Žs’â+–:ï¾ò0(€€€€€€ƒš&7šrž¦ë–ë’â–†(ØÉÁã¦®cžj¦îG¢&Ë–6–~Ž((€€€€€€ƒ–ú3’úžfóž>ùÍ¡½ÝA…” §¢Ž‡–Û–¾›–ÞËžÚOšr'’â––\(€€€€€€ƒ–º3šVÓŽš¶žŠë¢fWžB¦g’îÛ’ê/žjš¦–"Ø(€€€€€€ƒ¾ò …ÁÃžj¹¼µ¡•…‘•Ë¦g–-±…ÍÏ¾ò3šB·¦4(€€€€€€MOžj¹½¹Ñ•¹ÑíÑ½ÀèÁ÷¾ò'¾ò3š.ÿš:'¦g¢Ž„(€€€€€€ƒšVÓšº×¢«–ÞÇ–¾¯žj¦
?¢ò¿¾ò3šRçš"Cš*(‰¡½µ”‹¾ò<(€€€€€€€‰ÑÉ…¥¹¥¹œ‹–*ƒ¦ÉÍ¡½ÝA…” §¢Ž‡žj(€€€€€€¡¥‘•!•…‘•ÉA…•Ïšâ–Z»¾ò3žnÓš:—žR£ž>ûš"CŽ(€€€€€€ƒš¶žŠëžjš¦–"Û¢fWžB¾ò3’â7šr–7žVg’â/ž¦ëžf÷–6–†+Ž(€€€€¨¼(((€€€½¹ÍÐ¹…µ•°ô(€€€€€€€€ ‰Á±…å•É9…µ”ˆ¤ì((€€€½¹ÍÐ¥¹™½°ô(€€€€€€€€ ‰Á±…å•É!•…‘•É%¹™¼ˆ¤ì((€€€½¹ÍÐé½¹•°ô(€€€€€€€€ ‰µ…Á!•…‘•Éi½¹•9…µ”ˆ¤ì((€€€½¹ÍÐµ½¹ÍÑ•É%¹™½°ô(€€€€€€€€ ‰µ…Á!•…‘•É5½¹ÍÑ•É%¹™¼ˆ¤ì(((€€€¥˜¡¹…µ•°¥ì((€€€€€€€¹…µ•°¹ÍÑå±”¹‘¥ÍÁ±…äô((€€€€€€€€€€€¥Í5…ÁA…”(€€€€€€€€€€€€ü(€€€€€€€€€€€€‰¹½¹”ˆ(€€€€€€€€€€€€è(€€€€€€€€€€€€ˆˆì((€€€ô(((€€€¥˜¡¥¹™½°¥ì((€€€€€€€¥¹™½°¹ÍÑå±”¹‘¥ÍÁ±…äô((€€€€€€€€€€€¥Í5…ÁA…”(€€€€€€€€€€€€ü(€€€€€€€€€€€€‰¹½¹”ˆ(€€€€€€€€€€€€è(€€€€€€€€€€€€ˆˆì((€€€ô(((€€€¥˜¡é½¹•°¥ì((€€€€€€€é½¹•°¹ÍÑå±”¹‘¥ÍÁ±…äô((€€€€€€€€€€€¥Í5…ÁA…”(€€€€€€€€€€€€ü(€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€è(€€€€€€€€€€€€‰¹½¹”ˆì((€€€ô(((€€€¥˜¡µ½¹ÍÑ•É%¹™½°¥ì((€€€€€€€€¼¨(€€€€€€€€€€ƒŠbƒ’þ»š¶¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3Ž3¢^7¢&Ëš†(€€€€€€€€€€ƒ–Û’î[¦÷’â7¢šŽ7¾ò'¾òk¦g–/–ºç–f £ž¶'žÒkž¾–r4(€€€€€€€€€€ƒ¦
¢†0§’â7žº‡–r£’â7–r£–rÃ–r[¦‚¦v‹¾ò3’â–ú,(€€€€€€€€€€ƒ¦jÇ¢^?¾ò3–>«žVg–rÃ–r[–B7ž¢Ç¦
’â¢†3Ž(€€€€€€€€¨¼((€€€€€€€µ½¹ÍÑ•É%¹™½°¹ÍÑå±”¹‘¥ÍÁ±…äô(€€€€€€€€€€€€‰¹½¹”ˆì((€€€ô(((€€€¥˜ …¥Í5…ÁA…”¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€½¹ÍÐ½¹™¥œô((€€€€€€€é½¹•½¹™¥mÕÉÉ•¹Ñi½¹•t(€€€€€€€ñð(€€€€€€€é½¹•½¹™¥œ¹™½É•ÍÐì(((€€€¥˜¡é½¹•°¥ì((€€€€€€€€¼¨(€€€€€€€€€€ƒŠbƒ’þ»š¶¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3Ž3’â+¦vˆ(€€€€€€€€€€ƒ¢^7¢&Ëš†–>«žVg–rÃ–r[–B7–¶_–no–/–¶_¾ò3–Û’îX(€€€€€€€€€€ƒ¦÷’â7¢šŽ7¾ò'¾òh(€€€€€€€€€€½¹™¥œ¹Ñ¥Ñ±—šr³¢ê¯–âÛ¢F]•µ½©§–&7žÚÐ(€€€€€€€€€€ƒ¾ò#’ú/–š‹ŠnÃ¾â<ƒ–Þ£ž6ã¢6K–:|‹¾ò'¾ò3¦g¢Ž‡žR (€€€€€€€€€€ƒš¶¢š?¢†£¦S–ò?–:ïš:'¦Z/¦‚·žj•µ½©§¢Þ|(€€€€€€€€€€ƒž¦ëžf÷¾ò3–>«žVg’â/žÒS’â·šZ–rÃ–r[–B7ž¢ÇŽ(€€€€€€€€€€ƒ’æ’â7–7¢«–ÞÇ–*€‹Â~^ë¾â<€‹¦g–/–&7žÚÓŽ(€€€€€€€€¨¼((€€€€€€€é½¹•°¹Ñ•áÑ½¹Ñ•¹Ðô((€€€€€€€€€€€€¡½¹™¥œ¹Ñ¥Ñ±•ñðˆˆ¤(€€€€€€€€€€€€¹É•Á±…” (€€€€€€€€€€€€€€€€½yqL­qÌ¨¼°(€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€¤ì((€€€ô(((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3Ž3¢^7¢&Ëš†(€€€€€€ƒ–Û’î[¦÷’â7¢šŽ7Ž3š¦c¢&Ë¦£–"–>¿’î—š.ÿš:'Ž7¾ò'¾òh(€€€€€€ƒž¶'žÒkž¾–r7šZ–¶_Žš«ž&§šâ–Z»š†¾ò3–§–/¦ô(€€€€€€ƒšVÓ–/’â7–7¦†¿ž’ëŠSŠQµ…Á!•…‘•É5½¹ÍÑ•É%¹™¼(€€€€€€ƒ¦g–/–’[–Æ“–ºç–f£šr³’ú–ÂÇ–r£’â+¦v‹žj¥Í5…ÁA…”(€€€€€€ƒ–"“šZß–ò?¢Ž‡¢Š¯¢¢·š"C’â–ºk¦jÇ¢^<(€€€€€€ƒ¾ò!‘¥ÍÁ±…äé¹½¹—¾ò'¾ò3¦g¢Ž‡’â7žR£–7¢fWžB¾òl(€€€€€€ƒš«ž&§šâ–Z»š†¾ò!µ…Á5½¹ÍÑ•É1¥ÍÑ	½ã¾ò$(€€€€€€ƒžj–Ÿ–ºç’æ’â7žR£–7žR‹žR¾ò3žnÓš:—’â7–¾¯–—Ž(€€€€¨¼()ô(((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€ƒŠbƒšnÓšZÁU$(ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼()™Õ¹Ñ¥½¸ÕÁ‘…Ñ•U$ ¥ì((€€€‰ÕµÁ	…ÑÑ±•IÕ¹Ñ¥µ•5•ÑÉ¥Œ ‰ÕÁ‘…Ñ•U$ˆ¤ì((€€€½¹ÍÐÍÑ…ÑÌõ•Ñ5…¥¹¡…É…Ñ•ÉMÑ…ÑÌ ¤ì((€€€Á±…å•È¹¡Àõ5…Ñ ¹µ…à À±5…Ñ ¹µ¥¸¡Á±…å•È¹¡À±ÍÑ…ÑÌ¹µ…á!@¤¤ì(€€€Á±…å•È¹ÍÀõ5…Ñ ¹µ…à À±5…Ñ ¹µ¥¸¡Á±…å•È¹ÍÀ±ÍÑ…ÑÌ¹µ…áM@¤¤ì((€€€¥˜¡‰…ÑÑ±•Ñ¥Ù”¥ì((€€€€€€€Á½ÁÕ±…Ñ•M­¥±±EÕ¥­	…È ¤ì((€€€€€€€¥˜ (€€€€€€€€€€€€ ‰¥Ñ•µ5•¹Ôˆ¤˜˜(€€€€€€€€€€€€ ‰¥Ñ•µ5•¹Ôˆ¤¹±…ÍÍ1¥ÍÐ¹½¹Ñ…¥¹Ì ‰Í¡½Üˆ¤(€€€€€€€€¥ì(€€€€€€€€€€€É•¹‘•É	…ÑÑ±•A½Ñ¥½¹5•¹Ô ¤ì(€€€€€€€ô((€€€€€€€ÕÉÉ•¹Ñ	…ÑÑ±•5½¹ÍÑ•ÉÌ¹™½É… ¡¥¹‘•àôùì(€€€€€€€€€€€ÕÁ‘…Ñ•5½¹ÍÑ•ÉU$¡¥¹‘•à¤ì(€€€€€€€ô¤ì((€€€€€€€ÕÁ‘…Ñ•	…ÑÑ±•A±…å•É	…ÉÌ ¤ì((€€€€€€€½¹ÍÐ‰½ÍÍAÉ•Í•¹Ñ…Ñ¥½¹=Ý¹•ÈõÑåÁ•½˜Ý¥¹‘½Ü„ôô‰Õ¹‘•™¥¹•ˆýÝ¥¹‘½Ü¹½ÕÉMåµ‰½±Í	½ÍÍ	…ÑÑ±”é¹Õ±°ì(€€€€€€€¥˜¡‰½ÍÍAÉ•Í•¹Ñ…Ñ¥½¹=Ý¹•È˜™ÑåÁ•½˜‰½ÍÍAÉ•Í•¹Ñ…Ñ¥½¹=Ý¹•È¹Íå¹!Õôôô‰™Õ¹Ñ¥½¸ˆ¥ì(€€€€€€€€€€€‰½ÍÍAÉ•Í•¹Ñ…Ñ¥½¹=Ý¹•È¹Íå¹!Õ ¤ì(€€€€€€€ô((€€€€€€€É•ÑÕÉ¸ì(€€€ô((€€€ÕÁ‘…Ñ•!½µ•Q•ÍÑQ½½±Ì ¤ì(€€€ÕÁ‘…Ñ•QÉ…¥¹¥¹i½¹•1½­Ì ¤ì(€€€ÕÁ‘…Ñ•M•½¹‘¡…É…Ñ•É	…¹¹•È ¤ì(€€€ÕÁ‘…Ñ•½±‘¥ÍÁ±…ä ¤ì(€€€ÕÁ‘…Ñ•5…ÁA±…å•É…É ¤ì(€€€ÕÁ‘…Ñ•5…ÁA…•!•…‘•È ¤ì((€€€€ ‰Á±…å•É1•Ù•°ˆ¤¹Ñ•áÑ½¹Ñ•¹ÐõÁ±…å•È¹±•Ù•°ì(€€€€ ‰¡•…‘•É!@ˆ¤¹Ñ•áÑ½¹Ñ•¹ÐõÁ±…å•È¹¡Àì(€€€€ ‰¡•…‘•ÉM@ˆ¤¹Ñ•áÑ½¹Ñ•¹ÐõÁ±…å•È¹ÍÀì((€€€€ ‰Í­¥±±A½¥¹ÑÌˆ¤¹Ñ•áÑ½¹Ñ•¹Ðô(€€€€€€€€ (€€€€€€€€€€€•ÑM­¥±±¡…É…Ñ•É=‰©•Ð¡ÕÉÉ•¹ÑM­¥±±¡…É…Ñ•È¥ñð(€€€€€€€€€€€Á±…å•È(€€€€€€€€¤¹Í­¥±±A½¥¹ÑÌì((€€€€ ‰Í¡…É•‘áÁY…±Õ”ˆ¤¹Ñ•áÑ½¹Ñ•¹Ðô(€€€€€€€5…Ñ ¹µ…à À±5…Ñ ¹™±½½È¡9Õµ‰•È¡Í¡…É•‘áÀ¥ñðÀ¤¤(€€€€€€€€€€€€¹Ñ½1½…±•MÑÉ¥¹œ ‰é µQ\ˆ¤ì((€€€É•¹‘•ÉáÁ¥ÍÑÉ¥‰ÕÑ•1¥ÍÐ ¤ì(€€€ÕÁ‘…Ñ•MÑ…ÑÕÍAÉ•Ù¥•Ü ¤ì)ô(((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€ƒŠbƒ¢«–.W–¶cšªP((€€ƒ¦f“’ê–:šr³–r£ž&ç–ºk–.W’ös¦î{¾ò#–6žÒkŽ¢Žw–
gŽš"Ã¦²—–.w–"§Š›¾ò$(€€ƒšr–¶cšªS’æ/–’[¾ò3¦g¢Ž‡–7–*ƒ–§–Æ“’þw¦j«¾òh((€€€Ä¸ƒš¾<€ÈÀƒžžK–ºkšf¢«–.W–¶c’âš²‡¾ò0(€€€€€ƒ’â›–r£žV¯¦v‹–>Ï’â/¢žKž~·šj¯¦†¿ž’ëŽ3Â~Jøƒ–ÞË¢«–.W–¶cšªSŽ7¾ò0(€€€€€ƒ¢ºOž:§–ºÛž~—¦Ožržjšr'–r£–¶c¾ò3’â7šb¿šGž¦ëšRû–þŽ((€€€È¸ƒ–"–"Ã¢3šf¿¾ò#–"ÁÃŽ–"–"¦‚Ž¢z‹–æW¦:[–ºk¾ò$(€€€€€ƒžjžVÛ’â/ž®/–"ï–¶c’âš²‡¾ò0(€€€€€ƒ¦gšb¿šr–ºçšbOšò?š:'¦Ë–ê›žjššÎŠSŠP(€€€€€ƒž:§–ºÛ–ú#–>¿¢÷žªžÛ¢Š¯¦nï¢¦Çš&OšZßŽ(€€€€€ƒš"[žnÓš:—–"–ë–:ï–ny1%9¾ò0(€€€€€ƒ¦gšf–g’â7¢÷–>«¦v€ÈÃžžKžj–ºkšf–f£Ž((€€ƒ–§ž¢»ššÎ¦÷–Fó–>¯–B3’â–,…ÕÑ½M…Ù•9½Ü §¾ò0(€€ƒ–Ÿ¦£šr³¢ê¯šr%ÑÉä½…Ñ£¾ò0(€€ƒ–¶cšªS–’ÇšV_’â7šr¢ºO¦+š"ËžVÛš:'¾ò0(€€ƒ–>«šr–r¡½¹Í½±—žVg’â/¦2¿¢ª“¢¢+š¿šZç’úÿ’æ/–ú3¦f“¦2¿Ž(ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼()±•Ð…ÕÑ½Í…Ù•%¹‘¥…Ñ½ÉQ¥µ•Èõ¹Õ±°ì()±•Ð…ÕÑ½Í…Ù•%¹Ñ•ÉÙ…±%õ¹Õ±°ì(()™Õ¹Ñ¥½¸¥Í…µ•MÑ…ÉÑ• ¥ì((€€€É•ÑÕÉ¸€„„ (€€€€€€€Á±…å•È€˜˜(€€€€€€€Á±…å•È¹¥(€€€€¤ì()ô(()™Õ¹Ñ¥½¸Í¡½ÝÕÑ½Í…Ù•%¹‘¥…Ñ½È ¥ì((€€€½¹ÍÐ•°€ô(€€€€€€€€ ‰…ÕÑ½Í…Ù•%¹‘¥…Ñ½Èˆ¤ì(((€€€¥˜ …•°¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€•°¹±…ÍÍ1¥ÍÐ¹…‘ (€€€€€€€€‰Í¡½Üˆ(€€€€¤ì(((€€€±•…ÉQ¥µ•½ÕÐ (€€€€€€€…ÕÑ½Í…Ù•%¹‘¥…Ñ½ÉQ¥µ•È(€€€€¤ì(((€€€…ÕÑ½Í…Ù•%¹‘¥…Ñ½ÉQ¥µ•È€ô(€€€€€€€Í•ÑQ¥µ•½ÕÐ  ¤ôùì((€€€€€€€€€€€•°¹±…ÍÍ1¥ÍÐ¹É•µ½Ù” (€€€€€€€€€€€€€€€€‰Í¡½Üˆ(€€€€€€€€€€€€¤ì((€€€€€€€ô°ÄØÀÀ¤ì()ô(()™Õ¹Ñ¥½¸…ÕÑ½M…Ù•9½Ü¡Í¡½Ý%¹‘¥…Ñ½È¥ì((€€€¥˜ …¥Í…µ•MÑ…ÉÑ• ¤¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€ÑÉåì((€€€€€€€Í…Ù•…µ” ¤ì(((€€€€€€€¥˜¡Í¡½Ý%¹‘¥…Ñ½È¥ì((€€€€€€€€€€€Í¡½ÝÕÑ½Í…Ù•%¹‘¥…Ñ½È ¤ì((€€€€€€€ô((€€€ô(€€€…Ñ ¡•ÉÉ½È¥ì((€€€€€€€½¹Í½±”¹•ÉÉ½È (€€€€€€€€€€€€‹¢«–.W–¶cšªS–’ÇšV_¾òhˆ°(€€€€€€€€€€€•ÉÉ½È(€€€€€€€€¤ì((€€€ô()ô(()™Õ¹Ñ¥½¸ÍÑ…ÉÑÕÑ½M…Ù” ¥ì((€€€¥˜¡…ÕÑ½Í…Ù•%¹Ñ•ÉÙ…±%¥ì((€€€€€€€±•…É%¹Ñ•ÉÙ…° (€€€€€€€€€€€…ÕÑ½Í…Ù•%¹Ñ•ÉÙ…±%(€€€€€€€€¤ì((€€€ô(((€€€€¼¨(€€€€€€ƒš¾<ÈÃžžK–ºkšf–¶cšªS¾ò0(€€€€€€ƒ–>«šr'žrš¶¦Z/–ž/¦+š"Ë¾ò#–ÞË–&×¢žK¾ò'š&7šr–¾›¦jo–¾¯–—¾ò0(€€€€€€ƒ¦
–r£–&×¢žKžV¯¦v‹šf¦g¢Ž‡šržnÓš:—¢ÞÏ¦;Ž(€€€€¨¼((€€€…ÕÑ½Í…Ù•%¹Ñ•ÉÙ…±%€ô(€€€€€€€Í•Ñ%¹Ñ•ÉÙ…°  ¤ôùì((€€€€€€€€€€€…ÕÑ½M…Ù•9½Ü¡ÑÉÕ”¤ì((€€€€€€€ô°ÈÀÀÀÀ¤ì(((€€€€¼¨(€€€€€€ƒ–"–"Ã¢3šf¿¾ò?–"–"¦‚šfž®/–"ï–¶c’âš²‡Ž(€€€€€€ƒ’â7¦†¿ž’ëš>Cž’ë¾ò3–nƒž
ëžV¯¦v‹¦gšf–d(€€€€€€ƒž:§–ºÛ¦k–âã–ÞËžÚOžr/’â7–"Ã’êŽ(€€€€¨¼((€€€‘½Õµ•¹Ð¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È (€€€€€€€€‰Ù¥Í¥‰¥±¥Ñå¡…¹”ˆ°(€€€€€€€€ ¤ôùì((€€€€€€€€€€€¥˜¡‘½Õµ•¹Ð¹¡¥‘‘•¸¥ì((€€€€€€€€€€€€€€€…ÕÑ½M…Ù•9½Ü¡™…±Í”¤ì(((€€€€€€€€€€€€€€€€¼¨(€€€€€€€€€€€€€€€€€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢–n{–‚Ç¾ò0(€€€€€€€€€€€€€€€€€€ƒŽ3–"–"Ã¢3šf¿–7–"–n{’ú–"Ã–êWšr'šÊKšr$(€€€€€€€€€€€€€€€€€€ƒžº_¦n‹žÞkžÚO¦¦_Ž7¾ò'¾òk–"–"Ã¢3šf¿žj(€€€€€€€€€€€€€€€€€€ƒžVÛ’â/¾ò3¢¢c¦2¦g–/šf¦ZO¦î{¾ò3ž¶$(€€€€€€€€€€€€€€€€€€ƒ–"–n{–&7šf¿šfš&7ž~—¦O¢š–ú{¦g¢Ž„(€€€€€€€€€€€€€€€€€€ƒ¦Z/–ž/žº_Ž3¦n‹¦Z/’ê–’k’æŽ7Ž(€€€€€€€€€€€€€€€€¨¼((€€€€€€€€€€€€€€€±…ÍÑ=™™±¥¹•¡•­Q¥µ•ÍÑ…µÀô(€€€€€€€€€€€€€€€€€€€…Ñ”¹¹½Ü ¤ì((€€€€€€€€€€€ô(€€€€€€€€€€€•±Í•ì((€€€€€€€€€€€€€€€€¼¨(€€€€€€€€€€€€€€€€€€ƒŠbƒšZÃ–Š{¾òk–"–n{–&7šf¿šf¾ò3žR£–&o–&l(€€€€€€€€€€€€€€€€€€ƒ–"–"Ã¢3šf¿¢¢c¦2žjšf¦ZO¦î{¾ò3žº_–è(€€€€€€€€€€€€€€€€€€ƒ¦gšº×¦n‹žÞkšf¦ZO–Â7š'žj¦n‹žÞkžÚO¦¦_ŠSŠP(€€€€€€€€€€€€€€€€€€ƒ¦gš¢’â7žR£šVÓ–/¦7šZÃšVÓžB¦‚¦v‹Ž(€€€€€€€€€€€€€€€€€€ƒ–Z»žÒS–"¢3šf¿–7–"–n{’ú–ÂÇšržržj(€€€€€€€€€€€€€€€€€€ƒžº_–"Ã¾ò3–n{ž¶S’ê’öÿžR£¢žjžZG–V?Ž(€€€€€€€€€€€€€€€€¨¼((€€€€€€€€€€€€€€€…±Õ±…Ñ•=™™±¥¹•áÁM¥¹” (€€€€€€€€€€€€€€€€€€€±…ÍÑ=™™±¥¹•¡•­Q¥µ•ÍÑ…µÀ(€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€±…ÍÑ=™™±¥¹•¡•­Q¥µ•ÍÑ…µÀô(€€€€€€€€€€€€€€€€€€€…Ñ”¹¹½Ü ¤ì(((€€€€€€€€€€€€€€€€¼¨(€€€€€€€€€€€€€€€€€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3–b_¢¦›¢fWžB(€€€€€€€€€€€€€€€€€€ƒŽ3žâ»–Â?¢š[žª\¿–"–"Ã¢3šf¿–7š&O¦Z/šr–6‡’ö?Ž4(€€€€€€€€€€€€€€€€€€ƒžj–V?¦†3¾ò'¾òh(€€€€€€€€€€€€€€€€€€ƒ’æ/–&7¦g¢Ž‡–>«¢fWžB’êŽ3–"–ë–:ïŽ7žj(€€€€€€€€€€€€€€€€€€ƒ¦
’â–6+¾ò#–¶cšªS¾ò'¾ò3–º3–£šÊKšr'¢fWžB(€€€€€€€€€€€€€€€€€€ƒŽ3–"–n{’úŽ7¢¦Ëš;¦êóš‹–ú§ŠSŠSš&/š¦ž?¢š÷–f (€€€€€€€€€€€€€€€€€€ƒ–r£¢3šf¿šfšr–’Ÿ–æ¦f7’ö;žRk¢Ïšj¯–s¢¢#šf–f (€€€€€€€€€€€€€€€€€€ƒžj–~ß¢†3¦–ê›¾ò3–n{–"Ã–&7šf¿žjšf–g¾ò0(€€€€€€€€€€€€€€€€€€ƒ¦+š"Ë–Ÿ¦£žj–n{–B#¢¢#šf–f£Ž(€€€€€€€€€€€€€€€€€€Í•ÑQ¥µ•½ÕÓš:Kž¢/–ú#–>¿¢÷–ÞËžÚO¢Þ|(€€€€€€€€€€€€€€€€€€ƒ–¾›¦jožÚO¦;žjšf¦ZO–Â7’â7’â+¾ò3¢º+š"C–6‡’ö<(€€€€€€€€€€€€€€€€€€ƒ’â7–.Wžjš¢–¶CŽ((€€€€€€€€€€€€€€€€€€ƒ¦g¢Ž‡šÊK¢ú›šÎW’þw¢¶$ÄÀÀ—’þ»––÷š¾?’âž¢¸(€€€€€€€€€€€€€€€€€€ƒ–6‡’ö?žjššÎ¾ò#¢3šf¿¦fC–"Ûšb¿ž?¢š÷–f (€€€€€€€€€€€€€€€€€€ƒ–Æ“žÒkžj¾ò3šr³’ú–ÂÇšr'’êož.šÎšÊK¢ú›šÎT(€€€€€€€€€€€€€€€€€€ƒ–º3–£¦ÿ–7¾ò'¾ò3’ö¢Ï–ÂG–k’ê’â–,(€€€€€€€€€€€€€€€€€€ƒ–B#žBžj¢ŽsšVG¾òk–n{–"Ã–&7šf¿šf¾ò3–ššzp(€€€€€€€€€€€€€€€€€€ƒš"Ã¦²—¦
–r£¦Ë¢†3Ž¢ò«–"Ã¦r¢šž:§–ºÛ¢«–ÞÄ(€€€€€€€€€€€€€€€€€€ƒ¦ãšNžj¢žK¢&Ë¾ò3¦7šZÃšVÓžB’âš²‡–KšVã¢¢#šf(€€€€€€€€€€€€€€€€€€ƒ¾ò#žÖ›’â–/–£šZÃžjÈÃžžK¾ò3¢3’â7šb¿–îÛžê0(€€€€€€€€€€€€€€€€€€ƒ’â–/–>¿¢÷–ÞËžÚO–r£¢3šf¿¢ÞG–º3žj¢"+–KšVã¾ò'¾ò0(€€€€€€€€€€€€€€€€€€ƒ’â›’âS¦7šZÃšVÓžB’âš²‡žV¯¦v‹¦†¿ž’ë¾ò0(€€€€€€€€€€€€€€€€€€ƒ¦f7’ö;–6‡’ö?žjš¦ž:Ž(€€€€€€€€€€€€€€€€¨¼((€€€€€€€€€€€€€€€¥˜ (€€€€€€€€€€€€€€€€€€€‰…ÑÑ±•Ñ¥Ù”€˜˜(€€€€€€€€€€€€€€€€€€€‰…ÑÑ±•A¡…Í”ôôô(€€€€€€€€€€€€€€€€€€€€‰‘•±…É”ˆ(€€€€€€€€€€€€€€€€¥ì((€€€€€€€€€€€€€€€€€€€½¹ÍÐ…ÕÑ½=¸ô(€€€€€€€€€€€€€€€€€€€€€€€…Ñ¥Ù•	…ÑÑ±•¡…É…Ñ•É%¹‘•àôôôÀ(€€€€€€€€€€€€€€€€€€€€€€€€ü…ÕÑ½	…ÑÑ±”(€€€€€€€€€€€€€€€€€€€€€€€€è•ÑA…ÉÑåÕÑ½½¹™¥œ¡…Ñ¥Ù•	…ÑÑ±•¡…É…Ñ•É%¹‘•à¤¹•¹…‰±•ì(((€€€€€€€€€€€€€€€€€€€¥˜ ……ÕÑ½=¸¥ì((€€€€€€€€€€€€€€€€€€€€€€€Ñ¥µ•ÈôÈÀì((€€€€€€€€€€€€€€€€€€€€€€€ÕÁ‘…Ñ•Q¥µ•È ¤ì((€€€€€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€ô(((€€€€€€€€€€€€€€€¥˜¡‰…ÑÑ±•Ñ¥Ù”¥ì((€€€€€€€€€€€€€€€€€€€ÕÁ‘…Ñ•U$ ¤ì((€€€€€€€€€€€€€€€ô((€€€€€€€€€€€ô((€€€€€€€ô(€€€€¤ì(((€€€€¼¨(€€€€€€ƒ¦^s¦Z'–"¦‚¾ò?¦7šZÃšVÓžB–&7žn‡¦?–¶c’âš²‡Ž(€€€€€€ƒš&/š¦ž?¢š÷–f£’â7’â–ºkšržŠë–¾›¢žãžfó¦g–/’ê/’îÛ¾ò0(€€€€€€ƒ’ö–*ƒ’ê–º3–£ž‡–ºÏ¾ò3–’k’â–Æ“’þw¦j«Ž(€€€€¨¼((€€€Ý¥¹‘½Ü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È (€€€€€€€€‰‰•™½É•Õ¹±½…ˆ°(€€€€€€€€ ¤ôùì((€€€€€€€€€€€…ÕÑ½M…Ù•9½Ü¡™…±Í”¤ì((€€€€€€€ô(€€€€¤ì()ô(((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€ƒ–"w–ž/–2X(ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼()ÑÉåì((€€€É•‰Õ¥±‘%¹Ù•¹Ñ½ÉåM±½ÑÌ ¤ì((€€€ÕÁ‘…Ñ•É•…Ñ¥½¹U$ ¤ì((€€€É•¹‘•ÉM­¥±±1½…‘½ÕÐ ¤ì((€€€É•¹‘•É%¹Ù•¹Ñ½Éä ¤ì((€€€ÕÁ‘…Ñ•A±…å•É!•…‘•È ¤ì((€€€ÕÁ‘…Ñ•U$ ¤ì()ô)…Ñ ¡•ÉÉ½È¥ì((€€€½¹Í½±”¹•ÉÉ½È (€€€€€€€€‹¦+š"Ë–"w–ž/–2[žfóžR¦2¿¢ª“¾òhˆ°(€€€€€€€•ÉÉ½È(€€€€¤ì()ô(((¼¨5½‰¥±”¡…É‘Ý…É”½‰É½ÝÍ•È	…¬Õ…É¸Q¡”™¥ÉÍÐ	…¬ÁÉ•ÍÌ…Í­Ì™½È(€€½¹™¥Éµ…Ñ¥½¸ì½¹™¥Éµ¥¹œÁ•É™½ÉµÌÑ¡”É•…°¹…Ù¥…Ñ¥½¸°…¹•±±¥¹œ­••ÁÌ(€€Ñ¡”Á±…å•È¥¸Ñ¡”…µ”¸€¨¼(¡™Õ¹Ñ¥½¸¥¹ÍÑ…±±5½‰¥±•	…­½¹™¥Éµ…Ñ¥½¸ ¥ì((€€€±•Ð…±±½Ý¥¹á¥Ðõ™…±Í”ì(€€€±•Ð•á¥ÑAÉ½µÁÑ=Á•¸õ™…±Í”ì((€€€Ý¥¹‘½Ü¹…±±½Ý…µ•9…Ù¥…Ñ¥½¸ô ¤ôùì(€€€€€€€…±±½Ý¥¹á¥ÐõÑÉÕ”ì(€€€ôì((€€€ÑÉåì(€€€€€€€¡¥ÍÑ½Éä¹ÁÕÍ¡MÑ…Ñ”¡íÉÁá¥ÑÕ…ÉéÑÉÕ•ô°ˆˆ±±½…Ñ¥½¸¹¡É•˜¤ì(€€€ô(€€€…Ñ ¡•ÉÉ½È¥ì(€€€€€€€½¹Í½±”¹Ý…É¸ ‹ž‡šÎW–îëž®/¢þS–n{¦bË–FžÒ¦2¾òhˆ±•ÉÉ½È¤ì(€€€ô((€€€Ý¥¹‘½Ü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰Á½ÁÍÑ…Ñ”ˆ±…Íå¹Œ ¤ôùì(€€€€€€€¥˜¡…±±½Ý¥¹á¥Ð¥ìÉ•ÑÕÉ¸ìô((€€€€€€€€¼¨9…Ñ¥Ù”½¹™¥É´ÕÍ•Ñ¼‰±½¬‰É½ÝÍ•È¡¥ÍÑ½ÉäÝ¡¥±”¥ÐÝ…Ì½Á•¸¸(€€€€€€€€€€Q¡”IA‘¥…±½œ¥Ì…Íå¹¡É½¹½ÕÌ°Í¼¥µµ•‘¥…Ñ•±äÉ•ÍÑ½É”„Õ…É(€€€€€€€€€€•¹ÑÉä‰•™½É”…Ý…¥Ñ¥¹œÑ¡”Á±…å•ÈÌ¡½¥”¸€¨¼(€€€€€€€±•ÐÕ…É‘I•ÍÑ½É•õ™…±Í”ì(€€€€€€€ÑÉåì(€€€€€€€€€€€¡¥ÍÑ½Éä¹ÁÕÍ¡MÑ…Ñ”¡íÉÁá¥ÑÕ…ÉéÑÉÕ•ô°ˆˆ±±½…Ñ¥½¸¹¡É•˜¤ì(€€€€€€€€€€€Õ…É‘I•ÍÑ½É•õÑÉÕ”ì(€€€€€€€õ…Ñ ¡|¥ìô((€€€€€€€¥˜ (€€€€€€€€€€€Ý¥¹‘½Ü¹½ÕÉMåµ‰½±ÍI•±•…Í•UÁ‘…Ñ”˜˜(€€€€€€€€€€€ÑåÁ•½˜Ý¥¹‘½Ü¹½ÕÉMåµ‰½±ÍI•±•…Í•UÁ‘…Ñ”¹¥Í½É•‘UÁ‘…Ñ•	±½­¥¹œôôô‰™Õ¹Ñ¥½¸ˆ˜˜(€€€€€€€€€€€Ý¥¹‘½Ü¹½ÕÉMåµ‰½±ÍI•±•…Í•UÁ‘…Ñ”¹¥Í½É•‘UÁ‘…Ñ•	±½­¥¹œ ¤(€€€€€€€€¥ì(€€€€€€€€€€€Ý¥¹‘½Ü¹½ÕÉMåµ‰½±ÍI•±•…Í•UÁ‘…Ñ”¹…¹¹½Õ¹•½É•‘1½¬ ¤ì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€ô((€€€€€€€¥˜¡•á¥ÑAÉ½µÁÑ=Á•¸¥ìÉ•ÑÕÉ¸ìô(€€€€€€€•á¥ÑAÉ½µÁÑ=Á•¸õÑÉÕ”ì((€€€€€€€½¹ÍÐ½¹™¥Éµ•ô(€€€€€€€€€€€ÑåÁ•½˜Ý¥¹‘½Ü¹ÉÁ½¹™¥É´ôôô‰™Õ¹Ñ¥½¸ˆ€˜˜(€€€€€€€€€€€…Ý…¥ÐÝ¥¹‘½Ü¹ÉÁ½¹™¥É´ (€€€€€€€€€€€€€€€€‹žŠë–ºk¢š¦n‹¦Z/¦+š"Ë–^;¾òžn»–&7¦Ë–ê›šr–#¢«–.W–¶cšªSŽˆ°(€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€Ñ¥Ñ±”è‹¦n‹¦Z/–K¦j¨ˆ°(€€€€€€€€€€€€€€€€€€€½¹™¥ÉµQ•áÐè‹–Ë–¶c’â›¦n‹¦Z,ˆ°(€€€€€€€€€€€€€€€€€€€…¹•±Q•áÐè‹žæóžê3–K¦j¨ˆ(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€¤ì((€€€€€€€•á¥ÑAÉ½µÁÑ=Á•¸õ™…±Í”ì((€€€€€€€¥˜¡½¹™¥Éµ•¥ì(€€€€€€€€€€€…±±½Ý¥¹á¥ÐõÑÉÕ”ì(€€€€€€€€€€€Í…Ù•…µ” ¤ì(€€€€€€€€€€€¡¥ÍÑ½Éä¹¼¡Õ…É‘I•ÍÑ½É•ü´Èè´Ä¤ì(€€€€€€€ô(€€€ô¤ì()ô¤ ¤ì(((¼¨(€€ƒŠbƒšZÃ–Š{¾òk–£¢z‹–æW–*¢÷Ž((€€ƒ¦7¢šžjš*¢†O¦fC–"Û–#¢ª«šâš–k¾òh(€€ƒž?¢š÷–f£–~ëšZó–º'–£¢¦?¾ò3Ž3žÖW–Â7’â7–¢¢ÇŽ7žÚË¦‚–r (€€ƒ–º3–£šÊKšr'’öÿžR£¢’êK–.WžjššÎ’â/¢«–.W¦Ë–—–£¢z‹–æW¾ò0(€€ƒ’â–ºk¢šž:§–ºÛ¢«–ÞÇ¦î{’â’â/žV¯¦v‹š&7¢÷¢žãžfóŠSŠP(€€ƒ¦gšb½¡É½µ—ŽM…™…É§Žš&šr'ž?¢š÷–f£–Ç¦kžj¦fC–"Û¾ò0(€€ƒ’â7šb¿¦g–/¦+š"Ë–k–ú_–"Ãš"[–k’â7–"Ãžj–V?¦†3¾ò0(€€ƒ’îï’öWžÚË¦‚¦+š"Ë¦÷žæ{’â7¦;¦g’â¦^sŽ((€€ƒ¦g¢Ž‡–kžjšb¿Ž3¦¢3šÆ–Ûš²‡Ž7’öšr¦‚š&/žj–kšÎW¾òh(€€ƒžn¢÷ž:§–ºÛ–r£žV¯¦v‹’â+Ž3ž²³’âš²‡Ž7žj¦î{šN+š"[¢žãš:Ÿ¾ò0(€€ƒ¦
’â’â/¦‚’úÿ’â¢Öß¢žãžfó–£¢z‹–æW¢®/šÆ¾ò0(€€ƒž:§–ºÛ–æû’æ;š¢šë’â7–"Ã–’k’â–/š¶—¦¦|(€€ƒ¾ò#’â7žº‡’î[¦î{žjšb¿–&×¢žKžV¯¦v‹žjš2'¦"W¾ò0(€€ƒ¦
šb¿–ÞËšr'–¶cšªSšf’âï–~;žV¯¦v‹žj’îï’öW–rÃšZç¾ò0(€€ƒ¦÷šr¢žãžfó¾ò3’æ/–ú3–ÂÇ’â7šr–7š&OšNû¾ò'Ž((€€ƒ–ššzsž:§–ºÛžjž?¢š÷–f£’â7šR¿š>Ó–£¢z‹–æUA'Ž(€€ƒš"[ž?¢š÷–f£–~ëšZóš~C’êo–:–nƒš.KžÖW¢®/šÆ¾ò0(€€ƒ¦g¢Ž‡žR¡ÑÉä½…Ñ£šVÓ–/–2¢Öß’ú¾ò0(€€ƒ–’ÇšV_’ê–ÂÇ¦îc¦îcšRûšŽ¾ò3’â7šr–öÇ¦~ÿ¦+š"Ëšr³¢ê¯š¶–âã¦/’ösŽ(¨¼()™Õ¹Ñ¥½¸É•ÅÕ•ÍÑ…µ•Õ±±ÍÉ••¸ ¥ì((€€€½¹ÍÐ•°ô(€€€€€€€‘½Õµ•¹Ð¹‘½Õµ•¹Ñ±•µ•¹Ðì(((€€€½¹ÍÐÉ•ÅÕ•ÍÐô((€€€€€€€•°¹É•ÅÕ•ÍÑÕ±±ÍÉ••¹ñð(€€€€€€€•°¹Ý•‰­¥ÑI•ÅÕ•ÍÑÕ±±ÍÉ••¹ñð(€€€€€€€•°¹µ½éI•ÅÕ•ÍÑÕ±±MÉ••¹ñð(€€€€€€€•°¹µÍI•ÅÕ•ÍÑÕ±±ÍÉ••¸ì(((€€€¥˜ …É•ÅÕ•ÍÐ¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€ÑÉåì((€€€€€€€½¹ÍÐÉ•ÍÕ±Ðô(€€€€€€€€€€€É•ÅÕ•ÍÐ¹…±°¡•°¤ì(((€€€€€€€¥˜ (€€€€€€€€€€€É•ÍÕ±Ð€˜˜(€€€€€€€€€€€É•ÍÕ±Ð¹…Ñ (€€€€€€€€¥ì((€€€€€€€€€€€É•ÍÕ±Ð¹…Ñ   ¤ôùíô¤ì((€€€€€€€ô((€€€ô(€€€…Ñ ¡•ÉÉ½È¥íô()ô(()™Õ¹Ñ¥½¸•¹…‰±•Õ±±ÍÉ••¹=¹¥ÉÍÑQ…À ¥ì((€€€½¹ÍÐ¡…¹‘±•Èô ¤ôùì((€€€€€€€É•ÅÕ•ÍÑ…µ•Õ±±ÍÉ••¸ ¤ì((€€€ôì(((€€€‘½Õµ•¹Ð¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È (€€€€€€€€‰±¥¬ˆ°(€€€€€€€¡…¹‘±•È°(€€€€€€€í½¹”éÑÉÕ•ô(€€€€¤ì(((€€€‘½Õµ•¹Ð¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È (€€€€€€€€‰Ñ½Õ¡ÍÑ…ÉÐˆ°(€€€€€€€¡…¹‘±•È°(€€€€€€€í½¹”éÑÉÕ•ô(€€€€¤ì()ô(((¼¨(€€ƒŠbƒ’þ»š¶¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò'¾òh(€€ƒ’â7¢š–7–òß–"Û–£¢z‹–æW¾ò3¦g¢Ž‡’â7–Fó–>¬(€€•¹…‰±•Õ±±ÍÉ••¹=¹¥ÉÍÑQ…À §¾ò0(€€ƒ–÷–ò?šr³¢ê¯’þwžVg¢F_¾ò3’æ/–ú3–ššzsšÏ¢š¦7šZÃš&O¦Z,(€€ƒ¦g–/–*¢÷¾ò3žnÓš:—š*+’â/¦v‹¦g¢†3–>[šÚ#¢¢ï¢ž–6Ï–>¿Ž(¨¼((¼¨XÄÈè¼¹½Ð…ÕÑ¼µ•¹Ñ•È‰É½ÝÍ•È™Õ±±ÍÉ••¸½¸™¥ÉÍÐÑ…À¸€¨¼(¼¨(€€ƒŠbƒšr–ú3š&7¢º–>[–¶cšªSŽ(€€ƒ¦gš¢ž²³’âš²‡–V–.W’â–ºkšr¦Ë–&×¢žK¾ò0(€€ƒšr'–¶cšªS–&’â–ºk¦Ë¦+š"ËŽ(€€±½…‘…µ—–Ÿ¦£šr³¢ê¯’æšr%ÑÉä½…Ñ£¾ò0(€€ƒ¦g¢Ž‡–7–2’â–Æ“šb¿¦ng¦7’þw¦j«¾ò0(€€ƒžŠë’þwž‡¢®[–š’öW¦÷’â7šr–6‡š¶ïšVÓ–/žÚË¦‚Ž(¨¼((¼¨(€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò'¾òh(€€ƒš*(Ó–/¢«–.Wš"Ã¦²—¢¢·–ºk¦v‹švÿ¢Ž‡žj–:žR|ñÍ•±•Ðø(€€ƒš>oš"C¢«¢¢–¦ã–Z»Ž¦dÓ–/–žÒƒ–r¡!Q53¢Ž„(€€ƒšr³’ú–ÂÇ–¶c–r£¾ò#’â7šb¿’æ/–ú3š&7–.Wš/žR‹žRžj¾ò'¾ò0(€€ƒ¦g¢Ž‡–>¿’î—šRû–þ–r£¦+š"Ë–V–.Wšf–ÂÇ–"w–ž/–2[’âš²‡¾ò0(€€ƒ’â7žR£ž¶'–"Ã¢¢·–ºk¦v‹švÿžržj¢Š¯š&O¦Z/Ž(¨¼()ÑÉåì((€€€l(€€€€€€€€‰…ÕÑ½M•ÑÑ¥¹Í¡…É…Ñ•ÉM•±•Ðˆ°(€€€€€€€€‰…ÕÑ½M•ÑÑ¥¹ÍÑ¥½¹M•±•Ðˆ°(€€€€€€€€‰…ÕÑ½M•ÑÑ¥¹Í!@ˆ°(€€€€€€€€‰…ÕÑ½M•ÑÑ¥¹ÍM@ˆ(€€€t¹™½É…  (€€€€€€€Í•±•Ñ%ôùì((€€€€€€€€€€€¥¹¥ÑÕÍÑ½µÉ½Á‘½Ý¸ (€€€€€€€€€€€€€€€Í•±•Ñ%(€€€€€€€€€€€€¤ì((€€€€€€€ô(€€€€¤ì()ô)…Ñ ¡•ÉÉ½È¥ì((€€€½¹Í½±”¹•ÉÉ½È (€€€€€€€€‹¢«¢¢’â/š.'¦ã–Z»–"w–ž/–2[–’ÇšV_¾òhˆ°(€€€€€€€•ÉÉ½È(€€€€¤ì()ô(()ÑÉåì((€€€€¼¨(€€€€€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3Ž3–*ƒ¦î{¢š(€€€€€€ƒšZÃ–Š{¦Vßš2'–þ¯¦–*ƒ¦î{Ž7¾ò'¾òh(€€€€€€ƒ¦‚¦v‹¢ò'–—šf¾ò3š*(ÛžÖ–Æ³šŸžj¬¼·š2'¦"T(€€€€€€ƒ–£¦£žÚ’â+¦Vßš2'š2žê3¢žãžfó¾ò3’âš²‡šœ(€€€€€€ƒ¢¢·–ºk¾ò3’â7žR£–r£š¾?–/š2'¦"Wžj!Q53’â((€€€€€€ƒ–B¢«–¾¯’ê/’îÛŽ(€€€€¨¼((€€€l(€€€€€€€l‰…ÑÑ…¬ˆ°‰ÑÑ…¬‰t°(€€€€€€€l‰Ù¥Ñ…±¥Ñäˆ°‰Y¥Ñ…±¥Ñä‰t°(€€€€€€€l‰•¹•Éäˆ°‰¹•Éä‰t°(€€€€€€€l‰¥¹Ñ•±±¥•¹”ˆ°‰%¹Ñ•±±¥•¹”‰t°(€€€€€€€l‰ÍÁ¥É¥Ðˆ°‰MÁ¥É¥Ð‰t°(€€€€€€€l‰…¥±¥Ñäˆ°‰¥±¥Ñä‰t(€€€t¹™½É…  ¡mÍÑ…Ñ-•ä±¥‘A…ÉÑt¤ôùì((€€€€€€€…ÑÑ…¡1½¹AÉ•ÍÌ (€€€€€€€€€€€€ ‰ÍÑ…ÑÕÍ	Ñ¸ˆ­¥‘A…ÉÐ¬‰5¥¹ÕÌˆ¤°(€€€€€€€€€€€€ ¤ôùÉ•µ½Ù•A½¥¹Ð¡ÍÑ…Ñ-•ä¤(€€€€€€€€¤ì(((€€€€€€€…ÑÑ…¡1½¹AÉ•ÍÌ (€€€€€€€€€€€€ ‰ÍÑ…ÑÕÍ	Ñ¸ˆ­¥‘A…ÉÐ¬‰A±ÕÌˆ¤°(€€€€€€€€€€€€ ¤ôù…‘‘A½¥¹Ð¡ÍÑ…Ñ-•ä¤(€€€€€€€€¤ì((€€€ô¤ì()ô)…Ñ ¡•ÉÉ½È¥ì((€€€½¹Í½±”¹•ÉÉ½È (€€€€€€€€‹–Æ³šŸ–*ƒ¦î{¦Vßš2'žÚ–ºk–’ÇšV_¾òhˆ°(€€€€€€€•ÉÉ½È(€€€€¤ì()ô(((¼¨MÑ…ÉÑÕÁMÑ…Ñ•5…¡¥¹”¥ÌÑ¡”½¹±ä½Ý¹•È…±±½Ý•Ñ¼Í•±•Ð…¹±½……¸…½Õ¹ÐÍ…Ù”¸€¨¼(((¼¨(€€ƒŠbƒ’â7žº‡–&×¢žKš"[¢ºšªS–N«šŠw¢Þ¿–úG¾ò0(€€ƒšr–ú3¦÷–V–.W¢«–.W–¶cšªSŽ(€€ÍÑ…ÉÑÕÑ½M…Ù” ¤ƒ–Ÿ¦£žj–ºkšf–f (€€ƒš¾?š²‡¢žãžfó¦÷šr¢«–ÞÇšª‹š~—¦+š"Ëšb¿–B›–ÞËžÚO¦Z/–ž/¾ò0(€€ƒš&’î—–ÂÇžº_¦gšf–gž:§–ºÛ¦
–r£–&×¢žKžV¯¦v‹¾ò0(€€ƒ’æ’â7šr–ë¦2¿š"[–¶c¦Ëž¦ë¢ÎšZgŽ(¨¼()ÑÉåì((€€€ÍÑ…ÉÑÕÑ½M…Ù” ¤ì()õ…Ñ ¡•ÉÉ½È¥ì((€€€½¹Í½±”¹•ÉÉ½È (€€€€€€€€‹¢«–.W–¶cšªS–V–.W–’ÇšV_¾òhˆ°(€€€€€€€•ÉÉ½È(€€€€¤ì()ô