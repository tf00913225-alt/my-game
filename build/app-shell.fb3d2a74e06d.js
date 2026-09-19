
/* bundled source: js/00-main.js */
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
           çŽå‹µã€é€™é¡žé‚è¼¯ç¾åœ¨å°±èƒ½æ¸¬è©¦ï¼Œ
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
   V119 â€” çŽ©å®¶æˆ°é¬¥ä¸­å…­åœæ¸›ç›Šçµ±ä¸€å…¥å£

   é¢¨ç³»ã€Œé™ä½Žæ•æ·ï¼é™ä½Žæ‰€æœ‰èƒ½åŠ›å€¼ã€èˆ‡åœŸç³»ã€Œé™ä½Žé˜²ç¦¦ã€
   å…ˆå‰èƒ½å¯«é€² statusEffectsï¼Œä½†çŽ©å®¶æœ€çµ‚èƒ½åŠ›æ²’æœ‰å®Œæ•´è®€å–ï¼Œ
   é€ æˆæ€ªç‰©å°çŽ©å®¶æ–½æ”¾æ™‚çœ‹å¾—åˆ°æ–‡å­—ã€å¯¦éš›æ•¸å€¼å»æ²’æœ‰ä¸‹é™ã€‚

   é€™è£¡çµ±ä¸€è¦å‰‡ï¼š
   - statDown ç›´æŽ¥é™ä½Žå°æ‡‰å…­åœé»žæ•¸ï¼›è‹¥æŠ€èƒ½æœ‰ excludedStatsï¼Œè©²å…­åœä¸é™ã€‚
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

const FINAL_EVASION_RATE_CAP=85;

/*
   é–ƒèº²ä¾†æºæŽ¡ç¨ç«‹æ©ŸçŽ‡ä¹˜ç®—ï¼Œä¸å†ç›´æŽ¥ç›¸åŠ æˆ–æ‹¿åŽ»æ”¾å¤§æ•æ·é–ƒèº²å€¼ã€‚
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
        description:"å°å–®é«”é€ æˆ120é»žåŸºç¤Žå‚·å®³ï¼›65%æ©ŸçŽ‡ä½¿ç›®æ¨™æšˆçœ©2å›žåˆï¼Œæœ€çµ‚å‘½ä¸­çŽ‡é¡å¤–é™ä½Ž10%/20%/30%/40%/50%ã€‚",
        stunChance:65, missBonusByLevel:[10,20,30,40,50], stunDuration:2, requires:["stormFlurry"]
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
        description:"å°æ•µæ–¹å…¨é«”å„é€ æˆ48é»žåŸºç¤Žæ³•è¡“å‚·å®³ï¼›35%æ©ŸçŽ‡æšˆçœ©1å›žåˆï¼Œä½¿ç›®æ¨™MISSçŽ‡æé«˜30%/45%/50%/55%/65%ã€‚",
        stunChance:35, missBonusByLevel:[30,45,50,55,65], stunDuration:1, requires:["windHowlLightning"]
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

const forestMonsters = [

    makeZoneMonster("å“¥å¸ƒæž—",3,"fire"),
    makeZoneMonster("å²èŠå§†",2,"water"),
    makeZoneMonster("å“¥å¸ƒæž—",3,"fire"),
    makeZoneMonster("å²èŠå§†",2,"water"),
    makeZoneMonster("å“¥å¸ƒæž—",3,"fire"),
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
   é è¨­é–ƒé¿ = min(30%, ç­‰ç´šÃ—0.3%)
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
            Math.min(30,Math.max(0,Number(level)||0)*0.3),

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
                if(
                    battlePresentationLocks.size===0&&battleInputResumeToken!==null&&
                    battleActive&&battlePhase==="declare"&&battleInputResumeToken===battleToken
                ){
                    const resumeToken=battleInputResumeToken;
                    battleInputResumeToken=null;
                    beginCharacterTurn(resumeToken);
                }
            };
        },
        isPresentationActive(){ return battlePresentationLocks.size>0; },
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
           å°±æ­£ç¢ºå¥—ç”¨ä¸€æ¬¡ã€‚
        */

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

    if(battleActive){
        return;
    }


    stopMonsterMovement();

    stopAutoPatrol();

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


            playPatrolFightAnimation(
                ()=>{

                    patrolBattleTransitionPending=
                        false;


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


    /* The preceding action already owns the complete round handoff window.
       The round label renders inside that window; it has no second delay. */
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

                autoActionForCharacter(
                    activeBattleCharacterIndex,
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
                '<span class="sq-name">ï¼ˆç©ºï¼‰</span>'+
                '<span class="sq-cost">â€”</span>';
            bar.appendChild(button);
            continue;
        }

        const skill=
            skillDatabase[skillId];

        if(!skill){
            button.disabled=true;
            button.innerHTML=
                '<span class="sq-icon-wrap"></span>'+
                '<span class="sq-name">è³‡æ–™éŒ¯èª¤</span>'+
                '<span class="sq-cost">â€”</span>';
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
                    : '<span class="sq-sp-block">SPä¸è¶³</span>'
                )+
            '</span>'+
            '<span class="sq-name">'+
                skill.name+
                (skillLevel>0 ? " Lv."+skillLevel : "")+
            '</span>'+
            '<span class="sq-cost">æ¶ˆè€— '+
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
   â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼‰ï¼š
   æŠ€èƒ½æ ¼æ”¹æˆéžå¸¸é§é¡¯ç¤ºï¼Œå¹³å¸¸æ”¶èµ·ä¾†ï¼Œ
   æŒ‰ã€Œâœ¨ æŠ€èƒ½ã€æŒ‰éˆ•æ‰æœƒå‡ºç¾ï¼Œ
   å‡ºç¾æ™‚è“‹ä½ä¸Šé¢é‚£æŽ’æˆ°é¬¥æŒ‡ä»¤æŒ‰éˆ•ï¼›
   å†æŒ‰ä¸€æ¬¡ï¼ˆæˆ–æŒ‰å³ä¸Šè§’âœ•ï¼‰å°±æ”¶åˆå›žåŽ»ã€‚
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
            "é¸æ“‡ ["+
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
            "ç›®æ¨™ï¼šè«‹é¸æ“‡";
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


    actionReady=true;

    pendingAction=type;

    closeMenus();

    /* V95ï¼šé¸å¥½æ™®æ”»ï¼å‚·å®³æŠ€èƒ½å¾Œç«‹å³æŠŠæˆ°é¬¥é¸é …æ”¶èµ·ï¼Œ
       åŽŸä½ç½®é¡¯ç¤ºå…©è¡Œé¸ç›®æ¨™æç¤ºï¼ŒåŒæ™‚è®“æ‰€æœ‰å­˜æ´»æ•µäºº
       å‡ºç¾é–ƒçˆæº–æ˜Ÿã€‚å‚·å®³èˆ‡æŠ€èƒ½çµç®—è¦å‰‡å®Œå…¨ä¸æ”¹ã€‚ */
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

        updateUI();

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
   â˜… å‘½ä¸­åˆ¤å®šï¼ˆæ–°å¢žï¼‰

   åŸºç¤Žå‘½ä¸­çŽ‡ = clamp(95 + å‘½ä¸­Ã—0.3 - ç›´æŽ¥å‘½ä¸­çŽ‡é™ä½Ž, 50%, 99%)ã€‚
   æœ€çµ‚å‘½ä¸­çŽ‡ = clamp(åŸºç¤Žå‘½ä¸­çŽ‡ Ã— (1 - æœ€çµ‚é–ƒèº²çŽ‡), 1%, 99%)ã€‚
   çŽ©å®¶åŸºç¤Žé–ƒèº²ç‚ºæœ‰æ•ˆæ•æ·Ã—0.6%ï¼›æ™®é€šæ€ªç‰©é è¨­é–ƒèº²ç‚º
   min(30%, ç­‰ç´šÃ—0.3%)ï¼Œç‰¹æ®Šæ€ªç‰©æ˜Žç¢ºæŒ‡å®šçš„ evasion ä¿ç•™ã€‚
===================================================== */

const HIT_CHANCE_BASE = 95;

const HIT_CHANCE_ACCURACY_COEFFICIENT = 0.3;

const HIT_CHANCE_MIN_PERCENT = 50;

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
   é€™ä¸‰å€‹å‡½å¼ç¾åœ¨æœƒä¾åºæ‰£æŽ‰agilityDown
   ï¼ˆç›´æŽ¥é™æ•æ·çš„æŠ€èƒ½ï¼Œä¾‹å¦‚æš´é¢¨æ‹³/ç‹‚é¢¨è¡“ï¼‰ã€
   statDownï¼ˆé™å…¨å±¬æ€§çš„æŠ€èƒ½ï¼Œä¾‹å¦‚æš´é¢¨äº‚æ“Š/
   é¢¨ç„°è¡“ï¼‰ã€stunï¼ˆæé«˜MISSçŽ‡ï¼é™ä½Žå‘½ä¸­çŽ‡ï¼Œ
   ä¾‹å¦‚æšˆçœ©çŒ›æ“Š/é¢¨èµ·é›²æ¹§ï¼‰é€™å¹¾ç¨®æ¸›ç›Šæ•ˆæžœç›®å‰
   çš„ç™¾åˆ†æ¯”ï¼Œå¤šå€‹æ•ˆæžœåŒæ™‚å­˜åœ¨æœƒä¾åºç–Šä¹˜
   ï¼ˆä¸æ˜¯ç›¸åŠ ï¼‰ï¼Œè·Ÿç­‰ç´šå·®ä¿®æ­£çš„é‚è¼¯ä¸€è‡´ï¼Œ
   é¿å…ç–ŠåŠ å¤ªå¤šå€‹æ¸›ç›Šç›´æŽ¥æ­¸é›¶ã€‚
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
   â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œé‡æ–°è¨­è¨ˆæšˆçœ©
   çŒ›æ“Šçš„æšˆçœ©æ•ˆæžœç®—æ³•ï¼‰ï¼š
   åŽŸæœ¬stuné€™å€‹æ¸›ç›Šæ˜¯åœ¨é€™è£¡ï¼ˆå‘½ä¸­å€¼æœ¬èº«ï¼‰
   æ‰“æŠ˜æ‰£ï¼Œå†è®“æ‰“å®ŒæŠ˜çš„å‘½ä¸­å€¼åŽ»è·‘æ­£å¸¸çš„
   å‘½ä¸­å…¬å¼ï¼Œç­‰æ–¼æ˜¯ã€Œé–“æŽ¥ã€å½±éŸ¿æœ€çµ‚æ©ŸçŽ‡ï¼Œ
   ä½¿ç”¨è€…æœ€æ–°çµ¦çš„æ•¸å€¼æ˜¯ã€Œé™ä½Žæ©ŸçŽ‡ç”±æŠ€èƒ½
   ç­‰ç´šä½Žè‡³é«˜ç‚º-10%/â€¦/-50%ã€ï¼Œè®€èµ·ä¾†æ˜¯
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
   â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œæšˆçœ©çŒ›æ“Šé‡æ–°
   è¨­è¨ˆï¼‰ï¼šæ–°å¢žç¬¬3å€‹åƒæ•¸
   directChanceReductionPercentï¼Œç›´æŽ¥å¾ž
   ç®—å¥½çš„å‘½ä¸­æ©ŸçŽ‡ï¼ˆé‚„æ²’å¥—ç”¨60~99ä¸Šä¸‹é™
   ä¹‹å‰ï¼‰æ‰£æŽ‰é€™å€‹%æ•¸ï¼Œä»£è¡¨æšˆçœ©å¸¶ä¾†çš„
   å‘½ä¸­çŽ‡ä¸‹é™æ˜¯ã€Œæ‰£é»žæ•¸ã€ï¼Œä¸æ˜¯ã€Œæ‰“æŠ˜ã€ï¼Œ
   è·Ÿå‘½ä¸­å€¼/é–ƒé¿é€™äº›æ—¢æœ‰åŠ æˆç”¨åŒä¸€å¥—
   åŠ æ¸›é‚è¼¯ã€åŒä¸€å€‹ä¸Šä¸‹é™å¤¾ä½ï¼Œä¸æœƒå‡ºç¾
   æšˆçœ©æŠŠå‘½ä¸­çŽ‡ç›´æŽ¥ç åˆ°è² æ•¸æˆ–éœ€è¦å¦å¤–
   è™•ç†çš„æ¥µç«¯å€¼ã€‚
   ä¸å‚³é€™å€‹åƒæ•¸ï¼ˆå¤§éƒ¨åˆ†å‘¼å«çš„åœ°æ–¹éƒ½ä¸éœ€è¦ï¼‰
   çš„è©±æ•ˆæžœè·Ÿä»¥å‰å®Œå…¨ä¸€æ¨£ï¼Œåªæœ‰monster
   å‡ºæ‰‹æ”»æ“ŠçŽ©å®¶ã€ä¸”monsterèº«ä¸ŠçœŸçš„æœ‰stun
   é€™å€‹æ¸›ç›Šæ™‚æ‰æœƒå‚³é€²ä¾†ã€‚
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
   V173.38 æŠ€èƒ½å‚·å®³ï¼šæœ‰æ•ˆæ”»æ“Š Ã— damageRole ï¼‹æ­£å¼ flatDamageï¼Œ
   å†ä¸”åªäº¤çµ¦ calculateDamage() ä¸€æ¬¡ã€‚èˆŠå¼äº”åƒæ•¸å‘¼å«åŠ
   å°šæœªé·ç§»æŠ€èƒ½ä¿ç•™å›ºå®šå‚·å®³å›žé€€ï¼Œä¾›æ­·å²æµç¨‹ç›¸å®¹ã€‚
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

const GENERAL_STATUS_OFFENSE_COEFFICIENT = 0.05;
const LOCKDOWN_STATUS_SPIRIT_COEFFICIENT = 0.3;

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
       â˜… ä¿®æ­£ï¼šéŽ–æ­»è¡Œå‹•é¡žæŠ€èƒ½ï¼ˆisLockdownç‚º
       trueï¼‰çš„æ™ºåŠ›åŠ æˆæ”¹ç”¨é–‹æ ¹è™Ÿï¼Œä¸€èˆ¬
       debuffï¼ˆç‡ƒç‡’/å‰Šå¼±é¡žï¼‰ç¶­æŒåŽŸæœ¬ç·šæ€§
       å…¬å¼ï¼Œå…©è€…äº’ä¸å½±éŸ¿ã€‚
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
       â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œã€Œé™åˆ¶è¡Œå‹•çš„
       ç•°å¸¸ç‹€æ…‹å¸¸æ•¸ä¿®æ”¹ã€ï¼‰ï¼š
       éŽ–æ­»é¡žæŠ€èƒ½ä¸å†åªæœ‰ä¸€çµ„å›ºå®šä¸Šä¸‹é™ï¼Œ
       æ”¹æˆä¾targetRankï¼ˆé‡Žæ€ª/ç²¾è‹±æ€ª/BOSSï¼‰
       åŽ»LOCKDOWN_HIT_BOUNDSè£¡æŸ¥å°æ‡‰çš„
       min/maxï¼Œæ²’å‚³rankçš„è©±é è¨­ç•¶é‡Žæ€ª
       ï¼ˆæœ€å¯¬é¬†é‚£çµ„ï¼‰ï¼Œä¿ç•™èˆŠå‘¼å«æ–¹å¼çš„
       ç›¸å®¹æ€§ã€‚
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
   ä¾æŠ€èƒ½çš„ç›®æ¨™åž‹æ…‹ï¼Œç®—å‡ºé€™æ¬¡æ”»æ“Šå¯¦éš›æœƒæ‰“åˆ°å“ªäº›æ€ªç‰©
   ï¼ˆå›žå‚³çš„æ˜¯monstersé™£åˆ—çš„åŽŸå§‹indexæ¸…å–®ï¼‰ã€‚

   singleï¼šåªæ‰“é¸å®šçš„ç›®æ¨™ã€‚
   ä¸€èˆ¬æˆ°é¬¥ç”± FourSymbolsBattlefieldSlots çš„å›ºå®šåæ ¼å¿«ç…§è§£æž
   single / tri / row / column / allï¼›æ­»äº¡å¾Œä¸æœƒé‡æ–°è£œä½ã€‚
   Boss å°ˆå±¬æ¨¡å¼å‰‡å…ˆäº¤çµ¦ FourSymbolsBossBattleï¼šé™¤ all å¤–ä¸€å¾‹
   åªçµç®— primary targetã€‚é€™è£¡æ˜¯æ•µæ–¹å‚·å®³ç›®æ¨™çš„å”¯ä¸€ ownerã€‚
*/

function getSkillTargets(centerIndex,targetType){

    const bossOwner=typeof window!=="undefined"?window.FourSymbolsBossBattle:null;
    if(bossOwner&&typeof bossOwner.isActive==="function"&&bossOwner.isActive()&&
       typeof bossOwner.resolveEnemyDamageTargets==="function"){
        return bossOwner.resolveEnemyDamageTargets(centerIndex,targetType);
    }

    const slotOwner=typeof window!=="undefined"?window.FourSymbolsBattlefieldSlots:null;
    const snapshot=slotOwner&&typeof slotOwner.getActiveEnemySnapshot==="function"
        ?slotOwner.getActiveEnemySnapshot():null;
    if(slotOwner&&snapshot&&typeof slotOwner.resolveEnemyTargets==="function"&&
       ["single","tri","row","column","all"].includes(targetType)){
        return slotOwner.resolveEnemyTargets(
            snapshot,
            centerIndex,
            targetType,
            index=>!!(monsters[index]&&monsters[index].alive!==false&&Number(monsters[index].hp)>0)
        );
    }

    const alive=currentBattleMonsters.filter(
        i=>monsters[i] && monsters[i].alive
    );

    if(targetType==="single"){
        return alive.includes(centerIndex) ? [centerIndex] : [];
    }

    /*
       V119ï¼šæ•µæ–¹å›ºå®šæ¯3å€‹ã€Œå ´ä¸Šä½ç½®ã€ç‚ºä¸€æ©«æŽ’ã€‚
       ä¸èƒ½ç”¨ alive é™£åˆ—é‡æ–°æŽ’ä½ç½®ï¼Œå¦å‰‡å‰æŽ’æœ‰äººæ­»äº¡å¾Œï¼Œ
       å¾ŒæŽ’æœƒè¢«éŒ¯èª¤è£œé€²å‰æŽ’ï¼Œæ©«æŽ’æŠ€èƒ½å°±æœƒè·¨æŽ’å‘½ä¸­ã€‚
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
    burn:"ç‡ƒç‡’",
    rage:"æ€’ç«",
    phoenixMight:"é³³å¨",
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

function markPersistentStateName(entry,stateOrType){
    if(entry&&typeof entry==="object"){
        entry.statusName=getPersistentStateName(stateOrType||entry);
    }
    return entry;
}

function reportPersistentStateMiss(entity,stateOrType,targetSide,targetIndex,sourceName){
    const stateName=getPersistentStateName(stateOrType);
    if(typeof showMissEffect==="function"&&Number.isInteger(targetIndex)){
        showMissEffect(targetSide==="player",targetIndex,"ç‹€æ…‹MISS");
    }
    if(typeof addBattleLog==="function"){
        const targetName=entity&&(entity.name||entity.id)||"ç›®æ¨™";
        addBattleLog(
            (sourceName?sourceName+"ï¼š":"")+targetName+"å·²æœ‰ã€"+stateName+"ã€‘ï¼Œæ–°çš„ã€"+stateName+"ã€‘MISSã€‚"
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
   â˜… æ€ªç‰©ã€Œæœ‰æ•ˆé˜²ç¦¦åŠ›ã€â€”â€”åŽŸå§‹defenseæ‰£æŽ‰
   defenseDowné€™å€‹æ¸›ç›Šæ•ˆæžœçš„ç™¾åˆ†æ¯”ã€‚
   åœŸç³»çš„åœŸçŸ³æ–¬/æŠ•çŸ³è¡“/æ²™å¡µé¢¨æš´éƒ½æ˜¯ç”¨é€™å€‹
   é™ä½Žæ€ªç‰©é˜²ç¦¦ï¼ŒçŽ©å®¶å°é€™éš»æ€ªç‰©é€ æˆçš„
   å‚·å®³è¨ˆç®—ï¼Œå…¨éƒ¨æ”¹è®€é€™å€‹å‡½å¼ï¼Œä¸è¦ç›´æŽ¥è®€
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
   â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼ŒæŽ¥ä¸Šé¢¨ç³»/åœŸç³»
   æŠ€èƒ½çš„é™„åŠ æ•ˆæžœï¼‰ï¼š
   é€šç”¨ç‰ˆæœ¬ï¼Œè·Ÿç‡ƒç‡’/å†°å°åˆ¤å®šå…±ç”¨åŒä¸€å¥—
   rollStatusEffectHit()æ©ŸçŽ‡å…¬å¼ï¼Œä¸€æ¬¡æª¢æŸ¥
   æŠ€èƒ½è³‡æ–™è£¡å¯èƒ½å­˜åœ¨çš„äº”ç¨®é™„åŠ æ•ˆæžœæ¨™è¨˜ï¼š
   agilityDownChance/agilityDownByLevel
   ï¼ˆé™æ•æ·ï¼‰ã€statDownChance/statDownByLevel
   ï¼ˆé™å…¨å±¬æ€§ï¼‰ã€defenseDownChance/
   defenseDownByLevelï¼ˆé™é˜²ç¦¦ï¼‰ã€damageDownChance/
   damageDownByLevelï¼ˆé™ä½Žé€ æˆå‚·å®³ï¼‰ã€stunChance/
   missBonusByLevelï¼ˆæšˆçœ©ï¼æé«˜MISSçŽ‡ï¼‰ã€
   petrifyChanceByLevelï¼ˆçŸ³åŒ–ï¼‰ã€‚

   æŠ€èƒ½æ²’æœ‰å°æ‡‰æ¬„ä½å°±è‡ªå‹•è·³éŽé‚£ä¸€ç¨®æ•ˆæžœï¼Œ
   ä¸€å€‹æŠ€èƒ½å¯ä»¥åŒæ™‚æŽ›å¥½å¹¾ç¨®æ•ˆæžœï¼ˆé›–ç„¶ç›®å‰
   é¢¨ç³»/åœŸç³»æŠ€èƒ½è¡¨è¨­è¨ˆä¸Šæ¯å€‹æŠ€èƒ½éƒ½åªæœ‰ä¸€ç¨®ï¼‰ã€‚

   castDamageSkill()ï¼processSingleMonsterAttack()
   åœ¨å‘½ä¸­åˆ¤å®šé€šéŽã€å‚·å®³çµç®—å®Œä¹‹å¾Œå‘¼å«é€™è£¡ï¼Œ
   è·Ÿç‡ƒç‡’/å†°å°çš„å‘¼å«æ™‚æ©Ÿé»žä¸€è‡´ã€‚
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
                "çš„æ•æ·é™ä½Žäº†ï¼"
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
                "çš„å…¨å±¬æ€§é™ä½Žäº†ï¼"
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
                "é€ æˆçš„å‚·å®³é™ä½Žäº†ï¼"
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
                "çš„é˜²ç¦¦é™ä½Žäº†ï¼"
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
                "é™·å…¥æšˆçœ©ï¼ŒMISSçŽ‡æé«˜ï¼"
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
                "è¢«çŸ³åŒ–äº†ï¼"
            );

        }

    }

}


/*
   â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œã€Œé‡Žæ€ªç•°å¸¸
   ç‹€æ…‹ç›´æŽ¥åšï¼Œæˆ‘çµ¦ä½ åˆ†ç´šã€ï¼‰ï¼š
   è·Ÿä¸Šé¢applySkillDebuffEffects()æ˜¯é¡åƒ
   ç‰ˆæœ¬ï¼Œå·®åˆ¥åªåœ¨ç›®æ¨™å¾žmonsteræ›æˆçŽ©å®¶
   è§’è‰²ï¼ˆtargetCharacterï¼‰â€”â€”æ€ªç‰©æ”¾æŠ€èƒ½
   æ‰“çŽ©å®¶æ™‚ï¼ŒæŠ€èƒ½æœ¬èº«é™„å¸¶çš„ç•°å¸¸æ•ˆæžœ
   ï¼ˆé™æ•æ·/é™å…¨å±¬æ€§/é™é˜²ç¦¦/æšˆçœ©/çŸ³åŒ–ï¼‰
   ç¾åœ¨ä¹ŸæœƒçœŸçš„å¥—ç”¨åœ¨çŽ©å®¶èº«ä¸Šï¼Œä¸å†åªæœ‰
   å‚·å®³æ•¸å­—ã€‚

   å¥—ç”¨çš„å…±ç”¨å‡½å¼ï¼ˆapplyMonsterDebuff()ï¼
   isMonsterFrozen()ï¼isMonsterPetrified()ï¼‰
   é›–ç„¶åå­—è£¡æœ‰Monsterï¼Œä½†æœ¬ä¾†å°±åªæ“ä½œ
   å‚³é€²åŽ»çš„ç‰©ä»¶æœ¬èº«ï¼ŒçŽ©å®¶è§’è‰²ç‰©ä»¶ä¸€æ¨£èƒ½
   ç›´æŽ¥æ²¿ç”¨ï¼ˆå‰ææ˜¯çŽ©å®¶ç‰©ä»¶è¦æœ‰
   statusEffectsé™£åˆ—ï¼Œå·²ç¶“åœ¨player/player2
   çš„åˆå§‹è³‡æ–™è·Ÿé–‹æˆ°é‡ç½®é‚£è£¡è£œä¸Šäº†ï¼‰ã€‚

   â˜… é—œæ–¼éŽ–å®šé¡žæ•ˆæžœï¼ˆå†°å°/çŸ³åŒ–ï¼‰ç”¨å“ªçµ„
   ä¸Šä¸‹é™ï¼šç›®å‰çš„LOCKDOWN_HIT_BOUNDSä¸‰ç´š
   ï¼ˆæ™®é€š/ç²¾è‹±/BOSSï¼‰è¨­è¨ˆä¸Šæ˜¯çµ¦ã€ŒçŽ©å®¶
   æ‰“æ€ªç‰©ã€é€™å€‹æ–¹å‘ç”¨çš„ï¼Œç”¨ä¾†è¡¡é‡ã€Œé€™éš»
   æ€ªç‰©å¤šé›£éŽ–ã€ã€‚é€™è£¡åéŽä¾†æ˜¯ã€Œæ€ªç‰©æ‰“
   çŽ©å®¶ã€ï¼ŒçŽ©å®¶æ²’æœ‰ç¨€æœ‰åº¦å¯è¨€ï¼Œé€™è£¡å…ˆå›ºå®š
   ç”¨"regular"ï¼ˆä¸Šé™80%ï¼‰â€”â€”
   é€™æ˜¯æˆ‘å…ˆæŠ“çš„é è¨­ï¼Œå¦‚æžœä½ è¦ºå¾—çŽ©å®¶è¢«
   éŽ–å®šçš„ä¸Šé™æ‡‰è©²è·Ÿé‡Žæ€ªä¸ä¸€æ¨£ï¼ˆä¾‹å¦‚æ›´é›£
   è¢«éŽ–ï¼Œç•¢ç«Ÿæ˜¯çŽ©å®¶è§’è‰²ï¼‰ï¼Œè·Ÿæˆ‘èªªä¸€è²ï¼Œ
   åŠ ä¸€çµ„å°ˆé–€çš„çŽ©å®¶ä¸Šä¸‹é™å³å¯ã€‚
*/

/*
   V118ï¼šæ€ªç‰©å°çŽ©å®¶æ–½æ”¾ç•°å¸¸ç‹€æ…‹æ™‚ï¼Œå¿…é ˆä½¿ç”¨ã€Œæœ€çµ‚ç²¾ç¥žã€ã€‚
   ä¹Ÿå°±æ˜¯è§’è‰²åŽŸå§‹ç²¾ç¥ž + è£å‚™ç²¾ç¥žï¼Œè€Œä¸æ˜¯åªè®€ character.spiritã€‚
   é€™æ¨£è£å‚™é¢æ¿é¡¯ç¤ºçš„ç²¾ç¥žã€ç•°å¸¸æŠ—æ€§ï¼Œèˆ‡å¯¦æˆ°å®Œå…¨ä¸€è‡´ã€‚
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
        "ä½ ";

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
                "çš„æ•æ·é™ä½Žäº†ï¼"
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
                "çš„å…¨å±¬æ€§é™ä½Žäº†ï¼"
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
                "é€ æˆçš„å‚·å®³é™ä½Žäº†ï¼"
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
                "çš„é˜²ç¦¦é™ä½Žäº†ï¼"
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
                "é™·å…¥æšˆçœ©ï¼ŒMISSçŽ‡æé«˜ï¼"
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
                targetName+"è¢«å†°å°äº†ï¼"
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
                "è¢«çŸ³åŒ–äº†ï¼"
            );

        }

    }


    /*
       â˜… æ–°å¢žï¼šç‡ƒç‡’ï¼ˆflameTornadoï¼
       phoenixCryé€™é¡žæŠ€èƒ½å¸¶çš„æ•ˆæžœï¼‰è·Ÿå…¶ä»–
       äº”ç¨®debuffæ˜¯åˆ†é–‹å­˜çš„æ¬„ä½
       ï¼ˆburnChanceï¼burnPercentByLevelï¼‰ï¼Œ
       è·Ÿplayeré‚£é‚ŠcastDamageSkill()è£¡
       å¥—ç”¨ç‡ƒç‡’çš„é‚è¼¯å°ç¨±ï¼Œç”¨applyBurnEffect()
       ï¼ˆæœ¬ä¾†å°±æ˜¯é€šç”¨å‡½å¼ï¼Œç›´æŽ¥æ²¿ç”¨ï¼‰ã€‚
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
                "é™·å…¥ç‡ƒç‡’ç‹€æ…‹ï¼"
            );

        }

    }

}


/*
   æ¯å›žåˆé–‹å§‹æ™‚å‘¼å«ï¼Œè™•ç†æ‰€æœ‰ç‡ƒç‡’ä¸­æ€ªç‰©çš„æŒçºŒå‚·å®³ã€‚
   ç‡ƒç‡’å‚·å®³ä¸æœƒè¢«é–ƒé¿ã€ä¸æœƒè¢«é˜²ç¦¦åŠ›æ¸›å…ï¼Œ
   å–®ç´”æŒ‰æœ€å¤§HPçš„ç™¾åˆ†æ¯”æ‰£è¡€ã€‚
*/

function tickStatusEffects(){

    if(!battleActive){
        return;
    }


    /*
       â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼ŒæŽ¥ä¸Šé¢¨ç³»/åœŸç³»
       çš„æ–°æ¸›ç›Šæ•ˆæžœï¼‰ï¼š
       åŽŸæœ¬é€™è£¡çš„filteré‚è¼¯åªèªå¾—"freeze"
       è·Ÿ"burn"å…©ç¨®é¡žåž‹ï¼Œå…¶ä»–é¡žåž‹ä¸€å¾‹ç›´æŽ¥
       return trueï¼ˆæ°¸é ä¿ç•™ã€ä¸æœƒå€’æ•¸ï¼‰ï¼Œ
       é€™ä»£è¡¨å¦‚æžœä¸è£œä¸Šè™•ç†ï¼Œé€™æ¬¡æ–°å¢žçš„
       agilityDown/statDown/defenseDown/damageDown/stun/
       petrifyé€™å…­ç¨®æ•ˆæžœä¸€æ—¦å¥—ç”¨ä¸ŠåŽ»ï¼Œæœƒ
       æ°¸é å¡åœ¨æ€ªç‰©èº«ä¸Šã€æŒçºŒå›žåˆæ•¸å®Œå…¨ä¸æœƒ
       æ¸›å°‘ï¼Œè®Šæˆæ°¸ä¹…æ¸›ç›Šï¼Œä¸æ˜¯åŽŸæœ¬è¨­è¨ˆçš„
       ã€ŒæŒçºŒNå›žåˆã€ã€‚

       é€™è£¡è£œä¸Šï¼špetrifyæ¯”ç…§freezeï¼ˆç´”ç²¹
       å€’æ•¸ã€ä¸æ‰£è¡€ï¼ŒçœŸæ­£è·³éŽæ”»æ“Šçš„åˆ¤æ–·åœ¨
       monsterTurn()ï¼‰ï¼ŒagilityDown/
       statDown/defenseDown/damageDown/stuné€™äº”ç¨®éƒ½æ˜¯
       å–®ç´”çš„ã€Œå€’æ•¸å›žåˆæ•¸ã€æ™‚é–“åˆ°äº†ç§»é™¤ã€ï¼Œ
       ç”¨DEBUFF_LABELSé€™å€‹å°ç…§è¡¨çµ±ä¸€è™•ç†ï¼Œ
       ä¸ç”¨å››å€‹é¡žåž‹å„å¯«ä¸€æ¬¡å¹¾ä¹Žä¸€æ¨£çš„ç¨‹å¼ç¢¼ã€‚
    */

    const simpleDebuffLabels={

        agilityDown:"é‡åŠ›",
        statDown:"å…¨å±¬æ€§é™ä½Ž",
        damageDown:"æ®¤é¢¨",
        defenseDown:"ç ´é˜²",
        stun:"æšˆçœ©"

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
                               å†°å°/çŸ³åŒ–æœ¬èº«ä¸æ‰£è¡€ï¼Œ
                               é€™è£¡åªè² è²¬å€’æ•¸å›žåˆæ•¸ï¼Œ
                               çœŸæ­£ã€Œè·³éŽæ”»æ“Šã€çš„åˆ¤æ–·
                               åœ¨monsterTurn()è£¡è™•ç†ã€‚
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
                                    "çš„"+
                                    (
                                        effect.type==="freeze"
                                        ?
                                        "å†°å°"
                                        :
                                        "çŸ³åŒ–"
                                    )+
                                    "æ•ˆæžœå·²è§£é™¤ã€‚"
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
                                    "æ•ˆæžœå·²å¾ž"+
                                    monster.name+
                                    "èº«ä¸Šè§£é™¤ã€‚"

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
                            "å—åˆ°ç‡ƒç‡’å‚·å®³"+
                            burnDamage+
                            "é»žã€‚"
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
       â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œã€Œé‡Žæ€ªç•°å¸¸
       ç‹€æ…‹ç›´æŽ¥åšã€â€”â€”æ€ªç‰©ç¾åœ¨çœŸçš„èƒ½å°çŽ©å®¶
       é™„åŠ è² é¢æ•ˆæžœäº†ï¼Œé€™äº›æ•ˆæžœä¹Ÿè¦è·Ÿæ€ªç‰©
       èº«ä¸Šçš„ä¸€æ¨£ï¼Œæ¯å›žåˆæ­£ç¢ºå€’æ•¸/æ‰£è¡€ï¼Œ
       ä¸ç„¶å¥—ç”¨äº†å»æ°¸é ä¸æœƒæ¶ˆå¤±ã€ç‡ƒç‡’ä¹Ÿ
       ä¸æœƒçœŸçš„æ‰£è¡€ï¼‰ï¼š
       è·Ÿä¸Šé¢è™•ç†æ€ªç‰©çš„é‚è¼¯å¹¾ä¹Žä¸€æ¨£ï¼Œåªæ˜¯
       ç›®æ¨™æ›æˆplayerï¼player2ï¼Œæ‰£è¡€ç”¨
       showPlayerHit()ï¼ˆè·Ÿæ€ªç‰©çš„
       showMonsterHit()å°æ‡‰ï¼‰ï¼Œæ­»äº¡åˆ¤æ–·
       äº¤çµ¦battleä¸»æµç¨‹æ—¢æœ‰çš„checkBattleEnd()
       ï¼ˆé€™è£¡åªè² è²¬æŠŠhpæ‰£åˆ°0ï¼Œä¸ä¸»å‹•å‘¼å«
       loseBattle()ï¼Œé¿å…è·Ÿä¸»æµç¨‹é‡è¤‡è§¸ç™¼ï¼‰ã€‚
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
                                    (character.id||"ä½ ")+
                                    "çš„"+
                                    (
                                        effect.type==="freeze"
                                        ?
                                        "å†°å°"
                                        :
                                        "çŸ³åŒ–"
                                    )+
                                    "æ•ˆæžœå·²è§£é™¤ã€‚"
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
                                    "æ•ˆæžœå·²å¾ž"+
                                    (character.id||"ä½ ")+
                                    "èº«ä¸Šè§£é™¤ã€‚"
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
                                (character.id||"ä½ ")+
                                "å—åˆ°ç‡ƒç‡’å‚·å®³"+
                                burnDamage+
                                "é»žã€‚"
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
   çˆ†æ“Šåˆ¤å®šã€‚
   æ²’æœ‰buffæ™‚æœ‰åŸºç¤Ž10%çˆ†æ“ŠçŽ‡ã€1.5å€å‚·å®³ï¼›
   æ€’ç«ç”Ÿæ•ˆæ™‚çˆ†æ“ŠçŽ‡è·Ÿçˆ†æ“Šå‚·å®³éƒ½æœƒæé«˜
   ï¼ˆæé«˜çš„%æ•¸å°±æ˜¯æ€’ç«æŠ€èƒ½ç­‰ç´šå°æ‡‰çš„æ•¸å­—ï¼‰ã€‚
*/

/*
   V118 â€” æ­£å¼èƒ½åŠ›è¦å‰‡ï¼š
   ç‰©ç†çˆ†æ“Šç”±ã€Œæ”»æ“Šã€æ±ºå®šï¼›æ³•è¡“çˆ†æ“Šç”±ã€Œæ™ºåŠ›ã€æ±ºå®šã€‚
   å…©è€…ä½¿ç”¨å®Œå…¨ç›¸åŒçš„æˆé•·å…¬å¼ï¼š
   - çˆ†æ“ŠçŽ‡ï¼šåŸºç¤Ž10% + æ¯é»žå°æ‡‰å±¬æ€§0.12%ï¼Œä¸Šé™35%
   - çˆ†æ“Šå€çŽ‡ï¼šåŸºç¤Ž1.5å€ + æ¯é»žå°æ‡‰å±¬æ€§0.25%ï¼Œä¸Šé™2å€

   å°æ‡‰å±¬æ€§ï¼š
   - physical / æ™®é€šæ”»æ“Š => attack
   - magic              => intelligence

   æ²»ç™‚æŠ€èƒ½ä¸èµ°é€™å€‹çˆ†æ“Šå‡½å¼ï¼Œå› æ­¤ä¸æœƒå› æ™ºåŠ›æ–°å¢žæ²»ç™‚çˆ†æ“Šã€‚
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
   V118 â€” ç²¾ç¥žæ­£å¼åŠ å…¥æŠ—æš´ï¼š
   æ¯1é»žç²¾ç¥ž = +0.1%æŠ—æš´ï¼ŒæŠ—æš´ä¸Šé™25%ã€‚
   æŠ—æš´ç›´æŽ¥å¾žæ”»æ“Šæ–¹ç®—å‡ºçš„çˆ†æ“ŠçŽ‡æ‰£é™¤ï¼Œ
   ä½†æœ€çµ‚çˆ†æ“ŠçŽ‡æœ€ä½Žä»ä¿ç•™5%ã€‚
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

function rollCritical(character,category="physical",targetAntiCritPercent=0,target){
    /* Boss Shield is evaluated at the beginning of every independent damage
       packet. The packet's overflow therefore remains non-critical, while a
       later multi-hit packet may roll normally after the Shield is gone. */
    if(target&&target.vBossShield&&Number(target.vBossShield.current)>0){
        return {isCrit:false,multiplier:1};
    }

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


    /* ç«å…ƒç´ EXï¼šå±¬æ€§å…¬å¼æœ¬èº«ä»å—35%/200%ä¸Šé™ï¼Œ
       EXå±¬æ–¼è¢«å‹•é¡å¤–åŠ æˆï¼Œæ‰€ä»¥åœ¨åŸºç¤Žä¸Šé™ä¹‹å¾Œå†ç–ŠåŠ ã€‚ */
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
   é€šç”¨å‚·å®³æŠ€èƒ½æ–½æ”¾å‡½å¼ã€‚
   ç‰©ç†ç³»æŠ€èƒ½ç”¨stats.attackç•¶åŠ æˆï¼Œ
   æ³•è¡“ç³»æŠ€èƒ½ç”¨stats.magicAttackç•¶åŠ æˆï¼Œ
   è·ŸåŽŸæœ¬calculateSkillDamage()çš„è¨­è¨ˆä¸€è‡´ã€‚
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
           â˜… ä¿®æ­£ï¼ˆåŒä¸€è¼ªå¾¹åº•æª¢æŸ¥æŠ“åˆ°çš„åŒé¡žbugï¼‰ï¼š
           è·ŸSPä¸è¶³é‚£å€‹åˆ†æ”¯ä¸€æ¨£ï¼Œå°å®Œè¨Šæ¯å°±
           returnï¼Œæ²’å‘¼å«finishPlayerAction()ï¼Œ
           ä¸€æ¨£æœƒè®“æ•´æ¢çµç®—éˆå¡æ­»ã€‚ç†è«–ä¸ŠUIæœƒå…ˆ
           æ“‹æŽ‰æ²’å­¸æœƒçš„æŠ€èƒ½è®“çŽ©å®¶é»žä¸åˆ°ï¼Œä½†é˜²å‘†
           åˆ†æ”¯æœ¬ä¾†å°±è©²å‡è¨­ã€Œè¬ä¸€çœŸçš„è¢«è§¸ç™¼ã€ï¼Œ
           ä¸èƒ½è®“ä¸€æ¬¡æ„å¤–è§¸ç™¼å°±è®“æ•´å ´æˆ°é¬¥åœæ“ºã€‚
        */

        addBattleLog(
            "å°šæœªå­¸ç¿’"+
            skill.name+
            "ã€‚"
   ÛŽ{×¦òµë(š+myÖ6&Bæ6Æ74Æ—7BçFövvÆR€¢&F÷vâ"À¢6†&7FW"æ‡ÃÓ ¢“°  ¢6öç7B‡&"Ð¢B‚&&GFÆUÆ–W$…&""¶–æFW‚“°  ¢6öç7B7&"Ð¢B‚&&GFÆUÆ–W%5&""¶–æFW‚“°  ¢6öç7B6†–VÆD&"Ð¢B‚&&GFÆUÆ–W%6†–VÆD&""¶–æFW‚“°  ¢6öç7B‡W&6VçBÐ¢ÖF‚æÖ‚€¢À¢ÖF‚æÖ–â€¢À¢6†&7FW"æ‡ð¢7FG2æÖ„… ¢ ¢¢“°  ¢–b†‡&"—° ¢‡&"ç7G–ÆRçv–GF‚Ð¢‡W&6VçB°¢"R#° ¢Ð  ¢ò ¢)ˆRikZ)îûÈŽKéÞxZ~KÛþyJŽˆ^Šhk.ûÈÎ8ÎŠÛ~y»îiXŽiéÎyIþh‰y¨NŠ›ûÈÀ¢h‰ikžŠ˜xþj)ÞŠhZ)îXªzØžXÎ™[~[ªny¨Ny›Þˆ›.Š˜xþj)Þ8ÞûÈžûÉ ¢y›Þˆ›.ˆ›.Z®{x®hê^YÊŽ{H^ˆ›.Š˜xþXû>XN™h¾Zx¾ûÈ†ÆVgCÖ‡W&6VçNûÈžûÈÀ¢ZúÎ[ªnûÉÞŠÛ~y»îXšžšIŽ˜xþKÙFÖ„…y¨NjùNKè¾ûÈÎ‹yþŠj)ÞiÊÎ‹ª¾yJ€¢YÎKˆX¶Ö„…Yû®k©nhù¾zé~ûÈÎ‹h^X{®ZëžYšŽy¨N˜:ŽXˆnYºx+ ¢æ‡Ö&.iÊÎ‹ª¶÷fW&fÆ÷s¦†–FFVîiÈ>ˆz®X¹^Š*¾Š8hèžûÈÀ¢KˆÞiÈ>yZ¾X{®jÎ{y®ZIn8 ¢¢ð ¢–b‡6†–VÆD&"—° ¢6öç7B6†–VÆD'VfcÐ ¢†6†&7FW"æ7F—fT'Vfg7ÇÅµÒ¢æf–æB€¢#Óà ¢"çG—SÓÓÒ'6†–VÆB"b`¢"çGW&ç4ÆVgCãb`¢"ç&VÖ–æ–æsã  ¢“°  ¢6öç7B6†–VÆEW&6VçCÐ ¢6†–VÆD'Vf`¢ð¢ÖF‚æÖ‚€¢À¢6†–VÆD'Vfbç&VÖ–æ–ærð¢7FG2æÖ„… ¢ ¢¢ ¢°  ¢6†–VÆD&"ç7G–ÆRæÆVgCÐ¢‡W&6VçB°¢"R#° ¢6†–VÆD&"ç7G–ÆRçv–GFƒÐ¢6†–VÆEW&6VçB°¢"R#° ¢Ð  ¢–b‡7&"—° ¢7&"ç7G–ÆRçv–GF‚Ð¢ÖF‚æÖ‚€¢À¢ÖF‚æÖ–â€¢À¢6†&7FW"ç7ð¢7FG2æÖ…5 ¢ ¢¢’°¢"R#° ¢Ð  ¢6öç7B‡FW‡BÐ¢6&BçVW'•6VÆV7F÷"€¢"æ‡Ö&"×FW‡B ¢“°  ¢6öç7B7FW‡BÐ¢6&BçVW'•6VÆV7F÷"€¢"ç7Ö&"×FW‡B ¢“°  ¢–b†‡FW‡B—° ¢‡FW‡BçFW‡D6öçFVçBÐ¢6†&7FW"æ‡°¢"ò"°¢7FG2æÖ„…° ¢Ð  ¢–b‡7FW‡B—° ¢7FW‡BçFW‡D6öçFVçBÐ¢6†&7FW"ç7°¢"ò"°¢7FG2æÖ…5° ¢Ð §Ð  ¦gVæ7F–öâG&–vvW$7&—F–6Ä–×7B†VÆVÖVçB—° ¢–b‚VÆVÖVçB—°¢&WGW&ã°¢Ð ¢VÆVÖVçBæ6Æ74Æ—7Bç&VÖ÷fR‚&7&—F–6ÂÖ–×7B"“°¢fö–BVÆVÖVçBæöfg6WEv–GFƒ°¢VÆVÖVçBæ6Æ74Æ—7BæFB‚&7&—F–6ÂÖ–×7B"“° ¢6WEF–ÖV÷WB‚‚“Óç°¢VÆVÖVçBæ6Æ74Æ—7Bç&VÖ÷fR‚&7&—F–6ÂÖ–×7B"“°¢ÒÃS#“°§Ð  ¦gVæ7F–öâ6†÷tFÖvU÷W†VÆVÖVçBÇFW‡BÇG—RÆ—47&—B—° ¢–b‚VÆVÖVçB—°¢&WGW&ã°¢Ð  ¢6öç7B÷WÐ¢Fö7VÖVçBæ7&VFTVÆVÖVçB€¢&F—b ¢“°  ¢÷Wæ6Æ74æÖRÐ¢ò ¢)ˆRKúîjÚ>ûÈŽKéÞxZ~KÛþyJŽˆ^Y¹îZûÈÎ8ÎiÞZK¢Š˜xþšþzK®Šè®h‰YÊŽŠj)ÞKˆ¾™Ú.8ÞûÈžûÉ ¢yÉþjÚ>XéþYºh›îX‹K¨n(	N(	N˜	žŠ:[	h™>K¨`¢z›®jÎûÈÂ&FÖvR×÷W.y»Nhê^hêP¢&‡×÷W.Šè®h‰ ¢&FÖvR×÷W‡×÷W.˜	žzŠà¢6Æ7>[Îh
~jžiÊÎKˆÞZÙŽYÊŽy¨NZÙ~K‹.ûÈÀ¢æFÖvR×÷W˜*>{XD55>ûÈ‡÷6—F–öã ¢'6öÇWFS·F÷£#b^(
n(
nXéþiÊÎŠŠÞŠˆ€¢h‰š8NYÊŽXÚx˜~KŠÞjë^8h¨ˆ;ÞYÞz‹‹yþŠj)Ð¢KŠÞ™i>ûÈžZèÎXZŽk).ZY~yJŽX‹ûÈÇ÷WŠè®h‰ ¢KˆX¾k).iÈžK»¾KÙ^Zé®KØÞjŠ>[Èþy¨Nišî˜	 ¢ÆF—cîûÈÎXú®ˆ;ÞK™nK™nhé.YÊ†VæD6†–ÆB‚¢iKî˜.Xë¾y¨NYËikžûÈÎK™þ[iŠþXÚx˜~iÈKˆ¾™Ú.8¢Šj)Òõ5j)ÒþYÞz‹˜;Þhé.ZèÎK˜¾[èÎ8 ¢jøþX¶6Æ7>K˜¾™i>˜;ÞŠ9ÎKˆ®z›®jÎûÈÀ¢‹yþX˜Þ™Ú.8Îh¨ˆ;ÞhÈž˜‰^i[NX¾KˆÞˆ;Þ›¹î8Ð¢iŠþYÎKˆzŠçG—þûÈÎ˜	ž[{.{i>iŠþ˜	žX°¢j©NjŽŠ:zÊÎKˆžjÊh©>X‹YÎjŠ>y¨NkÈþZÙp¢'V~K¨n8 ¢¢ð ¢&FÖvR×÷W"°¢€¢G—SÓÓÒ'7 ¢ð¢'7×÷W ¢ ¢G—SÓÓÒ&†VÂ ¢ð¢&†VÂ×÷W ¢ ¢G—SÓÓÒ&Ö—72 ¢ð¢&Ö—72×÷W ¢ ¢G—SÓÓÒ'6†–VÆB ¢ð¢'6†–VÆB×÷W ¢ ¢&‡×÷W ¢’°¢€¢—47&—@¢ð¢"7&—F–6Â×÷W ¢ ¢" ¢“°  ¢–b†—47&—B—°¢ò¢cûÉ®xˆni8®kZîZÙ~Xú®KùÞyYž8Îxˆni8¢²X+~Zë>i[ŽZÙ~8Þ8 ¢6†÷uÆ–W$†—B÷6†÷tÖöç7FW$†—BX+>˜.Kèny¨BFW‡BXúþˆ;ÞY
²Þ8…õ5ûÈÀ¢˜	žŠ:Xú®h«ÞX{®i[ŽZÙ~X®šþzK®ûÉ¾KˆÞ[Û™ûþZún™©¾X+~Zë>XÎ8"¢ð¢6öç7B7&—F–6ÄçVÖ&W$ÖF6‚Ð¢7G&–ær‡FW‡B’æÖF6‚‚õÆB²ƒó¥ÂåÆB²“òò“° ¢÷WçFW‡D6öçFVçBÐ¢.xˆni8¢"°¢†7&—F–6ÄçVÖ&W$ÖF6‚ò7&—F–6ÄçVÖ&W$ÖF6…³Ò¢7G&–ær‡FW‡B’“°¢ÖVÇ6W°¢÷WçFW‡D6öçFVçBÒFW‡C°¢Ð  ¢–b†—47&—B—°¢G&–vvW$7&—F–6Ä–×7B†VÆVÖVçB“°¢Ð  ¢VÆVÖVçBæVæD6†–ÆB€¢÷W ¢“°  ¢6WEF–ÖV÷WB‚‚“Óç° ¢–b€¢÷Wb`¢÷Wç&VçDæöFP¢—° ¢÷Wç&VçDæöFRç&VÖ÷fT6†–ÆB€¢÷W ¢“° ¢Ð ¢ÒÃƒ“° §Ð  ¢ò ¢)ˆRikZ)îûÈŽKéÞxZ~KÛþyJŽˆ^Šhk.ûÈžûÉ ¢Xkix¾Kˆ™h>[Ž[Îy¨Nš9¾ŠÎYÉnzK®ûÈÎKÛþyJŽˆ^Kˆ®X+>y¨@¢YÉnx˜~y»Nhê^‹Øžh‰&6ScNXZ~[XÎYÊŽ˜	žŠ:ûÈÀ¢‹yþŠy.ˆ›.YÉnx˜~ûÈ†&GFÆUÆ–W$6&Cóy¨@¢&6¶w&÷VæBÖ–Öv^ûÈžyJŽYÎKˆzŠîX®k9^(	N(	@¢YjîKˆ…DÔÎj©NjŽKˆÞKéÞ‹;NZIn˜:ŽYÉnx˜~j©NjŽûÈÀ¢ŠH~Š;Þ˜	žX¾j©NjŽX‹XŠ^y¨NYËikžK™þKˆÞiÈ>iÈ¢YÉnx˜~‹zþ[éZKiXŽ8YÉnx˜~khŽZKy¨NYXþšÎ8 ¢¢ð ¦6öç7B”4Uõ5”åõ$ô¤T5D”ÄUô”ÔtSÐ¢&76WG2ö&GFÆRö–6R×7–â×&ö¦V7F–ÆRçvV'#°  ¢ò ¢)ˆRikZ)îûÈŽKéÞxZ~KÛþyJŽˆ^Šhk.ûÈÎXkix¾Kˆ™h>[Ž[À¢iK¾i8®X¹^yZ¾ûÈžûÉ ¢Šé>Kˆ®™Ú.˜*>[Ë^YÉn[éîikÞk9^ˆ^XÚx˜~š9¾X‹Š*¾h™>KŠÞy¨@¢h
®xšžXÚx˜~ûÈÎKŠÞ˜	Nix¾‹Øž8iKîZJ~ûÈÎh«^˜Ni˜.kzX{®ûÈÀ¢y[nh‰˜	žX¾h¨ˆ;Þy¨NiK¾i8®x›žiXŽ8  ¢‹y÷6†÷u6¶–ÆÄæÖT&FvR‚žKˆjŠ>hé¾YÊ€¢Fö7VÖVçBæ&öGž[©^Kˆ¾8yJ†vWD&÷VæF–æt6Æ–VçE&V7B‚¢˜xþ[ª~j‰žûÈÎKˆÞy[nXÚx˜~y¨NZÙXX>{JûÈÎ˜þXXÞŠ*¾XÚx˜p¢ˆz®[{y¨GG&ç6f÷&ÞX¹^yZ¾Y»KØþûÈŽXéþYºŠh°¢6†÷u6¶–ÆÄæÖT&FvR‚žix˜(®y¨NŠª®iˆîûÈž8  ¢67FW$6†&7FW$–æFWŽûÉ£ÞzÊÎKˆŠy.ˆ›.8¢ÞzÊÎK¨ÎŠy.ˆ›.ûÈÎk®Zé®š9¾ŠÎ‹[~›¹îiŠþY:®[Ë^xêžZënXÚ8 ¢F&vWDÖöç7FW$–æFWŽûÉ®š9¾ŠÎ{X.›¹îiŠþY:®™«¾h
®xšžXÚ8  ¢Xú®‹*‹*Î8ÎyZ¾™Ú.Kˆ®š9¾KˆKˆ¾8ÞûÈÎKˆÞX®K»¾KÙ^X+~Zë2ð¢YÞKŠÞXŠNZé®ûÈÎYÎXú¾zºþŠ›.h™4Ô•5>˜(NiŠþŠ›.hš>ŠûÈÀ¢‹yþ˜	žX¾X{Þ[ÈþZèÎXZŽxJ™yÎûÈÎXZžK»nK¨¾Xˆn™h¾‰™^yn8 ¢¢ð ¦gVæ7F–öâÆ”–6U7–å&ö¦V7F–ÆR€¢67FW$6†&7FW$–æFW‚À¢F&vWDÖöç7FW$–æFW€¢—° ¢6öç7B67FW$6&CÐ¢B‚&&GFÆUÆ–W$6&B"°¢67FW$6†&7FW$–æFW€¢“°  ¢6öç7BF&vWD6&CÐ¢B‚&&GFÆTÖöç7FW""°¢F&vWDÖöç7FW$–æFW€¢“°  ¢–b€¢67FW$6&BÇÀ¢F&vWD6&@¢—°¢&WGW&ã°¢Ð  ¢6öç7B67FW%&V7CÐ¢67FW$6&BævWD&÷VæF–æt6Æ–VçE&V7B‚“°  ¢6öç7BF&vWE&V7CÐ¢F&vWD6&BævWD&÷VæF–æt6Æ–VçE&V7B‚“°  ¢6öç7B&ö¦V7F–ÆSÐ¢Fö7VÖVçBæ7&VFTVÆVÖVçB€¢&–Ör ¢“°  ¢&ö¦V7F–ÆRç7&3Ð¢”4Uõ5”åõ$ô¤T5D”ÄUô”ÔtS° ¢&ö¦V7F–ÆRæ6Æ74æÖSÐ¢&–6R×7–â×&ö¦V7F–ÆR#° ¢6öç7B7F'Eö–çBÐ¢vÖUö–çDg&öÔ6Æ–VçB€¢67FW%&V7BæÆVgB°¢67FW%&V7Bçv–GF‚ó"À¢67FW%&V7BçF÷°¢67FW%&V7Bæ†V–v‡Bó ¢“° ¢6öç7BVæEö–çBÐ¢vÖUö–çDg&öÔ6Æ–VçB€¢F&vWE&V7BæÆVgB°¢F&vWE&V7Bçv–GF‚ó"À¢F&vWE&V7BçF÷°¢F&vWE&V7Bæ†V–v‡Bó ¢“° ¢&ö¦V7F–ÆRç7G–ÆRæÆVgCÐ¢7F'Eö–çBç‚²'‚#° ¢&ö¦V7F–ÆRç7G–ÆRçF÷Ð¢7F'Eö–çBç’²'‚#° ¢6öç7B÷fW&Æ”Æ–W"Ð¢B‚&vÖRÖ÷fW&Æ’ÖÆ–W""’ÇÀ¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&vÖR×7FvR"“° ¢÷fW&Æ”Æ–W"æVæD6†–ÆB€¢&ö¦V7F–ÆP¢“°  ¢ò ¢)ˆR[Ë~X‹nŠ{Žy›Ç&VfÆ÷~ûÉ ¢‹[~›¹îy¨FÆVgB÷F÷X™¾ŠŠÞZé®ZèÎûÈÎxþŠkÞYšŽ˜(Nk) ¢yÉþjÚ>yZ¾X{®˜	žKˆ[˜ûÈÎZh.iéÎšjÎKˆ®YÊŽYÎKˆ‹Ê ¢K¨¾K»n[ê®y+Š:h¨¦ÆVgB÷F÷iKžh‰{X.›¹î[ª~j‰žûÈÀ¢G&ç6—F–öîiÈ>y»Nhê^‹{>˜îXë¾8yÈ¾KˆÞX‹š9¾ŠÀ¢˜îzˆ¾8.yJ‡fö–B&ö¦V7F–ÆRæöfg6WEv–GF€¢[Ë~‹ú¾xþŠkÞYšŽXXŽzé~KˆjÊyºîX˜Þy¨Nx˜Ž™Ú.ûÈÀ¢z+®Š¨Þ8Î‹[~›¹î8Þ[{.{i>yIþiXŽûÈÎhê^Kˆ¾Kè`¢&WVW7Dæ–ÖF–öäg&Ö^Š:iKžh‰{X.›¹î[ª~j‰¢h˜ÞiÈ>yÉþy¨NŠ{Žy›ÇG&ç6—F–öîX¹^yZ¾8 ¢¢ð ¢fö–B&ö¦V7F–ÆRæöfg6WEv–GFƒ°  ¢&WVW7Dæ–ÖF–öäg&ÖR‚‚“Óç° ¢&ö¦V7F–ÆRç7G–ÆRæÆVgCÐ¢VæEö–çBç‚²'‚#° ¢&ö¦V7F–ÆRç7G–ÆRçF÷Ð¢VæEö–çBç’²'‚#° ¢&ö¦V7F–ÆRæ6Æ74Æ—7BæFB€¢&'&—fVB ¢“° ¢Ò“°  ¢6WEF–ÖV÷WB‚‚“Óç° ¢–b€¢&ö¦V7F–ÆRb`¢&ö¦V7F–ÆRç&VçDæöFP¢—° ¢&ö¦V7F–ÆRç&VçDæöFRç&VÖ÷fT6†–ÆB€¢&ö¦V7F–ÆP¢“° ¢Ð ¢ÒÃS“° §Ð  ¢ò ¢)ˆRikZ)îûÈŽKéÞxZ~KÛþyJŽˆ^Šhk.ûÈÎx¾zêÞh¨ˆ;Þy¨@¢Kˆžy›Îš9¾ŠÎx›žiXŽûÈÎ{ID552ô¥>X¹^yZ¾ûÈžûÉ ¢6÷W&6T6&D–NiŠþikÞk9^ˆ^y¨NXÚx˜tDôÒ–@¢ûÈŽKè¾Zh"&&GFÆUÆ–W$6&C.ûÈžûÈÀ¢F&vWD–æFW†W>iŠþ˜	žjÊx¾zêÞZún™©¾h™>KŠÞy¨@¢h
®xšž{J.[É^™š>X‰~ûÈŽiÈZI£>X¾ûÈÎ[ÞhxžKŠÒþ[zbþXû>ûÈž8  ¢jøþKˆy›Îx¾zêÞûÉ ¢â[éîikÞk9^ˆ^XÚx˜~KŠÞ[ø>X{®y›ÎûÈÎyJ€¢VÆVÖVçBææ–ÖFR‚žûÈ…vV"æ–ÖF–öç0¢žûÈžš9¾Y	yºîj‰žXÚx˜~KŠÞ[ø>ûÈÎš9¾ŠÎ˜îzˆ¾KŠÐ¢iÊÎš¹NiÈ>KéÞš9¾ŠÎikžY	ˆz®X¹^ix¾‹ØžûÈÎyÈ¾‹[~Kè`¢X8þyÉþy¨NiÉÞyºîj‰žš9¾˜îXë¾ûÈÎKˆÞiŠþjÛ¾iÛþYË ¢[›>z{¾8 ¢"âX‹˜Ny¨NyêÎ™i>ûÈÎx¾zêÞiÊÎš¹NkhŽZKûÈÎXéþYË ¢x+Ž™h¾Kˆ[þ{êNx¾ˆ«{).ZÙûÈƒŽšnûÈÎYNˆz®[è ¢KˆÞYÎŠy.[ªnY›N[NXhÞkzX{®ûÈž8 ¢2âKˆžy›ÎK˜¾™i>iX^hHþXªKˆ›¹î›¹îi˜.™i>[zà¢ûÈŽjøþy›Î™i>™©Cƒ×>h˜Þy›Î[NûÈžûÈÎKˆÞiÈ>Kˆžy›À¢yÈ¾‹[~KènX8þYÎKˆy›ÎŠH~Š;Þ‹+ÎKˆ®ûÈÎjùN‹È>iÈ¢8Î˜
>{¨Îy›Î[N8Þy¨NzøZXþhIþ8  ¢h˜iÈžX¹^hX¾yIþh‰y¨DDôÞXX>{JX¹^yZ¾i*ÞZèÎ˜;ÞiÈ0¢ˆz®[{z{¾™šNûÈÎKˆÞiÈ>yYžYÊŽyZ¾™Ú.Kˆ®{Jþz˜Þ8 ¢¢ð ¢ò ¢)ˆRKúîjÚ>ûÈŽKéÞxZ~KÛþyJŽˆ^Šhk.ûÈÎh
®xšžyJŽx¾zêÐ¢iK¾i8®xêžZëni˜.K™þŠhiÈžYÎjŠ>y¨Nš9¾ŠÎx›žiXŽûÈžûÉ ¢XéþiÊÎ˜	žŠ:Xú®hê^Xù~8Îh
®xšž{J.[É^™š>X‰~8ÞûÈÀ¢Zú¾jÛ¾{XNX{¢&&GFÆTÖöç7FW""¶–æFWŽXë¾h›à¢yºîj‰žXX>{JûÈÎXú®ˆ;ÞyJŽYÊŽ8ÎxêžZën[Nh
®xšž8Þ˜	žX°¢ikžY	8.iKžh‰y»Nhê^hê^Xù~8Îyºîj‰”DôÒ–Ny¨N™š>X‰~8ÞûÈÀ¢h™>xêžZënûÈ‚&&GFÆUÆ–W$6&B"¶–æFWŽûÈ¢‹yþh™>h
®xšžûÈ‚&&GFÆTÖöç7FW""¶–æFWŽûÈ¢XZžzŠîikžY	˜;Þˆ;ÞX[yJŽYÎKˆZY~X¹^yZ¾˜(þ‹ÊþûÈÎKˆÞyJ€¢Zú¾XZžK»Þ[›îK˜îKˆjŠ>y¨Nzˆ¾[Èþz+Î8 ¢¢ð ¦gVæ7F–öâÆ”f—&U&ö6¶WDæ–ÖF–öâ€¢6÷W&6T6&D–BÀ¢F&vWDVÆVÖVçD–G0¢—° ¢6öç7B6÷W&6TVÃÐ¢B‡6÷W&6T6&D–B“°  ¢–b‚6÷W&6TVÂ—°¢&WGW&ã°¢Ð  ¢6öç7B6÷W&6U&V7CÐ¢6÷W&6TVÂævWD&÷VæF–æt6Æ–VçE&V7B‚“° ¢6öç7B6÷W&6Uö–çBÐ¢vÖUö–çDg&öÔ6Æ–VçB€¢6÷W&6U&V7BæÆVgB°¢6÷W&6U&V7Bçv–GF‚ó"À¢6÷W&6U&V7BçF÷°¢6÷W&6U&V7Bæ†V–v‡Bó ¢“° ¢6öç7B7F'E‚Ð¢6÷W&6Uö–çBçƒ° ¢6öç7B7F'E’Ð¢6÷W&6Uö–çBç“°  ¢F&vWDVÆVÖVçD–G2æf÷$V6‚€¢‡F&vWDVÆVÖVçD–BÆ’“Óç° ¢6WEF–ÖV÷WB‚‚“Óç° ¢f—&TöæU&ö6¶WB€¢7F'E‚À¢7F'E’À¢F&vWDVÆVÖVçD–@¢“° ¢ÒÆ’£ƒ“° ¢Ð¢“° §Ð  ¦gVæ7F–öâf—&TöæU&ö6¶WB€¢7F'E‚À¢7F'E’À¢F&vWDVÆVÖVçD–@¢—° ¢6öç7BF&vWDVÃÐ¢B‡F&vWDVÆVÖVçD–B“°  ¢–b‚F&vWDVÂ—°¢&WGW&ã°¢Ð  ¢6öç7BF&vWE&V7CÐ¢F&vWDVÂævWD&÷VæF–æt6Æ–VçE&V7B‚“° ¢6öç7BF&vWEö–çBÐ¢vÖUö–çDg&öÔ6Æ–VçB€¢F&vWE&V7BæÆVgB°¢F&vWE&V7Bçv–GF‚ó"À¢F&vWE&V7BçF÷°¢F&vWE&V7Bæ†V–v‡Bó ¢“° ¢6öç7BVæE‚Ð¢F&vWEö–çBçƒ° ¢6öç7BVæE’Ð¢F&vWEö–çBç“°  ¢6öç7BævÆTFVsÐ ¢ÖF‚æFã"€¢VæE’×7F'E’À¢VæE‚×7F'E€¢’ ¢ƒôÖF‚å“°  ¢6öç7B&ö6¶WCÐ¢Fö7VÖVçBæ7&VFTVÆVÖVçB‚&F—b"“° ¢&ö6¶WBæ6Æ74æÖSÐ¢&f—&R×&ö6¶WB×&ö¦V7F–ÆR#° ¢&ö6¶WBç7G–ÆRæÆVgCÐ¢7F'E‚²'‚#° ¢&ö6¶WBç7G–ÆRçF÷Ð¢7F'E’²'‚#° ¢&ö6¶WBç7G–ÆRçG&ç6f÷&ÓÐ ¢'G&ç6ÆFR‚ÓSRÂÓSR’&÷FFR‚"°¢ævÆTFVr°¢&FVr’#°  ¢6öç7B÷fW&Æ”Æ–W"Ð¢B‚&vÖRÖ÷fW&Æ’ÖÆ–W""’ÇÀ¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&vÖR×7FvR"“° ¢÷fW&Æ”Æ–W"æVæD6†–ÆB€¢&ö6¶W@¢“°  ¢6öç7BfÆ–v‡D×3Ð¢C#°  ¢6öç7Bæ–ÓÐ ¢&ö6¶WBææ–ÖFR€¢°¢°¢ÆVgC§7F'E‚²'‚"À¢F÷§7F'E’²'‚"À¢öfg6WC£ ¢ÒÀ¢°¢ÆVgC¦VæE‚²'‚"À¢F÷¦VæE’²'‚"À¢öfg6WC£¢Ð¢ÒÀ¢°¢GW&F–öã¦fÆ–v‡D×2À¢V6–æs¢&V6RÖ–â ¢Ð¢“°  ¢æ–Òæöæf–æ—6ƒÒ‚“Óç° ¢&ö6¶WBç&VÖ÷fR‚“°  ¢7väf—&U7&´'W'7B€¢VæE‚À¢VæE¢“° ¢Ó° §Ð  ¦gVæ7F–öâ7väf—&U7&´'W'7B€¢‚À¢¢—° ¢6öç7B7&´6÷VçCÐ¢ƒ°  ¢f÷"€¢ÆWB“Ó°¢“Ç7&´6÷VçC°¢’²°¢—° ¢6öç7B7&³Ð¢Fö7VÖVçBæ7&VFTVÆVÖVçB‚&F—b"“° ¢7&²æ6Æ74æÖSÐ¢&f—&R×&ö6¶WB×7&²#° ¢7&²ç7G–ÆRæÆVgCÐ¢‚²'‚#° ¢7&²ç7G–ÆRçF÷Ð¢’²'‚#°  ¢Fö7VÖVçBæ&öG’æVæD6†–ÆB€¢7&°¢“°  ¢6öç7BævÆSÐ ¢€¢ÖF‚å’£"¦’ð¢7&´6÷Vç@¢’°¢„ÖF‚ç&æFöÒ‚’£ãR“°  ¢6öç7BF—7Fæ6SÐ ¢‚°¢ÖF‚ç&æFöÒ‚’£c°  ¢6öç7B7&VCÐ ¢7&²ææ–ÖFR€¢°¢°¢ÆVgC§‚²'‚"À¢F÷§’²'‚"À¢÷6—G“£À¢öfg6WC£ ¢ÒÀ¢°¢ÆVgC ¢€¢‚°¢ÖF‚æ6÷2†ævÆR’¦F—7Fæ6P¢’²'‚"À¢F÷ ¢€¢’°¢ÖF‚ç6–â†ævÆR’¦F—7Fæ6P¢’²'‚"À¢÷6—G“£À¢öfg6WC£¢Ð¢ÒÀ¢°¢GW&F–öã£3ƒÀ¢V6–æs¢&V6RÖ÷WB ¢Ð¢“°  ¢7&VBæöæf–æ—6ƒÒ‚“Óç° ¢7&²ç&VÖ÷fR‚“° ¢Ó° ¢Ð §Ð  ¦gVæ7F–öâf–æD&GFÆU6¶–ÆÄ'•&W6VçFF–öâ‡6¶–ÆÄæÖRÆVÆVÖVçEG—R—°¢–b‡G—Vöb6¶–ÆÄFF&6SÓÓÒ'VæFVf–æVB"—²&WGW&âçVÆÃ²Ð¢6öç7B–G3Ôö&¦V7Bæ¶W—2‡6¶–ÆÄFF&6R“°¢f÷"†ÆWB–æFWƒÓ¶–æFWƒÆ–G2æÆVæwFƒ¶–æFW‚²²—°¢6öç7B6¶–ÆÃ×6¶–ÆÄFF&6U¶–G5¶–æFW…ÕÓ°¢–b€¢6¶–ÆÂbg6¶–ÆÂææÖSÓÓ×6¶–ÆÄæÖRb`¢‚VÆVÖVçEG—WÇÂ6¶–ÆÂæVÆVÖVçGÇÇ6¶–ÆÂæVÆVÖVçCÓÓÖVÆVÖVçEG—R¢—°¢&WGW&â6¶–ÆÃ°¢Ð¢Ð¢&WGW&âçVÆÃ°§Ð ¦gVæ7F–öâ7F—fT&GFÆUF&vWD–G2‡6–FRÆ–æ6ÇVFTFVfVFVB—°¢–b‡6–FSÓÓÒ&Ööç7FW""—°¢&WGW&â„'&’æ—4'&’†7W'&VçD&GFÆTÖöç7FW'2“ö7W'&VçD&GFÆTÖöç7FW'3¥µÒ’æf–ÇFW"†–æFWƒÓç°¢6öç7BÖöç7FW#ÖÖöç7FW'5¶–æFW…Ó°¢&WGW&â†Ööç7FW"bb†–æ6ÇVFTFVfVFVGÇÆÖöç7FW"æÆ—fRÓÖfÇ6RbdçVÖ&W"†Ööç7FW"æ‡“ã’“°¢Ò“°¢Ð¢&WGW&âvWDW†—7F–æu'G”–æFW†W2‚’æf–ÇFW"†–æFWƒÓç°¢6öç7B6†&7FW#ÖvWE'G”6†&7FW$'”–æFW‚†–æFW‚“°¢&WGW&â†6†&7FW"bb†–æ6ÇVFTFVfVFVGÇÄçVÖ&W"†6†&7FW"æ‡“ã’“°¢Ò“°§Ð ¢ò¢6öÖ&B÷vç2F&vWB6VÆV7F–öââF†—26öçG&7B—27&VFVB&Vf÷&RcC"õcC26VP¢F†R67BÂ6òF†Rde‚'VçF–ÖRæWfW"&VG2F†R7F–öâVWVRÂ†—B÷&FW"÷"Æ—fP¢7W'f—f÷"&÷VæG2FòwVW72—G2&–Ö'’F&vWB÷"6VÖçF–2fö÷G&–çBâ¢ð¦gVæ7F–öâ7&VFT&GFÆUF&vWD6öçG&7B‡6–FRÇ6¶–ÆÄæÖRÆVÆVÖVçEG—RÆ7F÷$–æFW‚ÇF&vWD–BÇF&vWD–G2ÇF&vWE6–FT÷fW'&–FR—°¢6öç7B6¶–ÆÃ×6¶–ÆÄæÖSÓÓÒ.išî˜	®iK¾i8¢ ¢÷¶–C¢&æ÷&ÖÂ"ÇF&vWEG—S¢'6–ævÆR"Æ6FVv÷'“¢'‡—6–6Â'Ð¢¦f–æD&GFÆU6¶–ÆÄ'•&W6VçFF–öâ‡6¶–ÆÄæÖRÆVÆVÖVçEG—R“°¢6öç7BF&vWEG—SÕ7G&–ær‡6¶–ÆÂbg6¶–ÆÂçF&vWEG—WÇÂ'6–ævÆR"“°¢6öç7B6ÖU6–FSÒöÆÇ’ö’çFW7B‡F&vWEG—R—ÇÂö†VÇÇ&Wf—fWÆ'VfbòçFW7B…7G&–ær‡6¶–ÆÂbg6¶–ÆÂæ6FVv÷'—ÇÂ""’“°¢6öç7BF&vWE6–FS×F&vWE6–FT÷fW'&–FSÓÓÒ'Æ–W"'ÇÇF&vWE6–FT÷fW'&–FSÓÓÒ&Ööç7FW" ¢÷F&vWE6–FT÷fW'&–FP¢¢‡6ÖU6–FS÷6–FS¢‡6–FSÓÓÒ'Æ–W"#ò&Ööç7FW"#¢'Æ–W""’“°¢6öç7BW‡Æ–6—D–G3Ô'&’æ—4'&’‡F&vWD–G2“÷F&vWD–G2ç6Æ–6R‚“¥µÓ°¢ÆWB&–Ö'“×F&vWD–BÓ×VæFVf–æVBbgF&vWD–BÓÖçVÆÃ÷F&vWD–C¦çVÆÃ°¢ÆWB–G3ÖW‡Æ–6—D–G3° ¢–b‚–G2æÆVæwF‚—°¢ÆWBVWVVCÖçVÆÃ°¢–b‡6–FSÓÓÒ'Æ–W""bgG—VöbVWVVEÆ–W$7F–öç2ÓÒ'VæFVf–æVB"—°¢VWVVC×VWVVEÆ–W$7F–öç2bgVWVVEÆ–W$7F–öç5¶7F÷$–æFW…Ó°¢Ð¢–b‡&–Ö'“ÓÓÖçVÆÂbgVWVVB—°¢&–Ö'“×F&vWE6–FSÓÓÒ&Ööç7FW"#÷VWVVBçF&vWC§VWVVBçF&vWDÆÇ“°¢Ð¢–b‡&–Ö'“ÓÓÖçVÆÂbg6–FSÓÓÒ'Æ–W""bgF&vWE6–FSÓÓÒ&Ööç7FW""bgG—Vöb6VÆV7FVDÖöç7FW"ÓÒ'VæFVf–æVB"—°¢&–Ö'“×6VÆV7FVDÖöç7FW#°¢Ð ¢–b‡F&vWEG—SÓÓÒ&ÆÂ'ÇÇF&vWEG—SÓÓÒ&ÆÇ”ÆÂ"—°¢–G3Ö7F—fT&GFÆUF&vWD–G2‡F&vWE6–FRÆfÇ6R“°¢ÖVÇ6R–b‡F&vWE6–FSÓÓÒ&Ööç7FW""bdçVÖ&W"æ—4–çFVvW"‡&–Ö'’’bbõâ‡G&—Ç&÷wÆ6öÇVÖçÆ†÷&—¦öçFÂÓ2’Bö’çFW7B‡F&vWEG—R’—°¢–G3×G—VöbvWE6¶–ÆÅF&vWG3ÓÓÒ&gVæ7F–öâ#övWE6¶–ÆÅF&vWG2‡&–Ö'’ÇF&vWEG—R“¥·&–Ö'•Ó°¢ÖVÇ6R–b‡F&vWE6–FSÓÓÒ'Æ–W""bdçVÖ&W"æ—4–çFVvW"‡&–Ö'’’bbõâ‡G&—ÆÆÇ•G&—Ç&÷wÆ6öÇVÖâ’Bö’çFW7B‡F&vWEG—R’—°¢6öç7B÷væW#×G—Vöbv–æF÷rÓÒ'VæFVf–æVB#÷v–æF÷räf÷W%7–Ö&öÇ4&GFÆVf–VÆE6Æ÷G3¦çVÆÃ°¢6öç7Bf÷&ÖF–öãÖ÷væW"bgG—Vöb÷væW"æVç7W&TÆÇ”f÷&ÖF–öãÓÓÒ&gVæ7F–öâ ¢ö÷væW"æVç7W&TÆÇ”f÷&ÖF–öâ†vWDW†—7F–æu'G”–æFW†W2‚’“¦çVÆÃ°¢–G3Öf÷&ÖF–öâbgG—Vöb÷væW"ç&W6öÇfTÆÇ•F&vWG3ÓÓÒ&gVæ7F–öâ ¢ö÷væW"ç&W6öÇfTÆÇ•F&vWG2†f÷&ÖF–öâÇ&–Ö'’ÇF&vWEG—RÆ–æFWƒÓç°¢6öç7B6†&7FW#ÖvWE'G”6†&7FW$'”–æFW‚†–æFW‚“°¢&WGW&â†6†&7FW"bdçVÖ&W"†6†&7FW"æ‡“ã“°¢Ò“¥·&–Ö'•Ó°¢ÖVÇ6R–b‡&–Ö'’ÓÖçVÆÂbg&–Ö'’Ó×VæFVf–æVB—°¢–G3Õ·&–Ö'•Ó°¢ÖVÇ6R–b‡6ÖU6–FR—°¢–G3Ö7F—fT&GFÆUF&vWD–G2‡F&vWE6–FRÆfÇ6R“°¢&–Ö'“Ö–G2æÆVæwFƒö–G5³Ó¦çVÆÃ°¢Ð¢Ð ¢–G3Ô'&’æg&öÒ†æWr6WB†–G2æf–ÇFW"„çVÖ&W"æ—4–çFVvW"’’“°¢–b‡F&vWEG—SÓÓÒ&ÆÂ'ÇÇF&vWEG—SÓÓÒ&ÆÇ”ÆÂ"—²&–Ö'“ÖçVÆÃ²Ð¢VÇ6R–b‡&–Ö'“ÓÓÖçVÆÂbf–G2æÆVæwF‚—²&–Ö'“Ö–G5³Ó²Ð ¢&WGW&âö&¦V7Bæg&VW¦R‡°¢fW'6–öã¢&&GFÆR×F&vWBÖ6öçG&7B×c"À¢6–FS§6–FRÀ¢F&vWE6–FS§F&vWE6–FRÀ¢F&vWEG—S§F&vWEG—RÀ¢7F÷$–æFWƒ¤çVÖ&W"æ—4–çFVvW"†7F÷$–æFW‚“ö7F÷$–æFWƒ£À¢F&vWD–C§&–Ö'’À¢F&vWD–G3¤ö&¦V7Bæg&VW¦R†–G2ç6Æ–6R‚’¢Ò“°§Ð §v–æF÷räf÷W%7–Ö&öÇ4&GFÆUF&vWD6öçG&7CÔö&¦V7Bæg&VW¦R‡°¢fW'6–öã¢&&GFÆR×F&vWBÖ6öçG&7B×c"À¢7&VFS¦7&VFT&GFÆUF&vWD6öçG&7@§Ò“° ¦gVæ7F–öâvWE6¶–ÆÄæÖT&FvTGW&F–öâ‡6¶–ÆÄæÖRÆVÆVÖVçEG—R—° ¢–b€¢G—Vöbv–æF÷rÓÒ'VæFVf–æVB"b`¢G—Vöbv–æF÷rçcC$vWE6¶–ÆÄæÖTF—7Æ”GW&F–öãÓÓÒ&gVæ7F–öâ ¢—°¢6öç7BGW&F–öãÐ¢çVÖ&W"€¢v–æF÷rçcC$vWE6¶–ÆÄæÖTF—7Æ”GW&F–öâ€¢6¶–ÆÄæÖRÀ¢VÆVÖVçEG—P¢¢“° ¢–b„çVÖ&W"æ—4f–æ—FR†GW&F–öâ’bbGW&F–öãã—°¢&WGW&âÖF‚ç&÷VæB†GW&F–öâ“°¢Ð¢Ð ¢&WGW&âÖF‚ç&÷VæBƒS#£"ó2“°§Ð  ¦gVæ7F–öâ6†÷u6¶–ÆÄæÖT&FvR‡6¶–ÆÄæÖRÆVÆVÖVçEG—RÆ6†&7FW$–æFW‚ÇF&vWD–BÇF&vWD–G2ÇF&vWE6–FR—° ¢6öç7BF&vWD6öçG&7CÖ7&VFT&GFÆUF&vWD6öçG&7B€¢'Æ–W""Ç6¶–ÆÄæÖRÆVÆVÖVçEG—RÄçVÖ&W"æ—4–çFVvW"†6†&7FW$–æFW‚“ö6†&7FW$–æFWƒ£ÇF&vWD–BÇF&vWD–G2ÇF&vWE6–FP¢“° ¢6öç7BVÆVÖVçBÐ¢B‚&&GFÆUÆ–W$6&B"°¢†6†&7FW$–æFW‡ÇÃ¢“°  ¢–b‚VÆVÖVçB—°¢&WGW&ã°¢Ð  ¢ò ¢)ˆRKúîjÚ>ûÈŽyÉþjÚ>Šz>k®8Îih~ZÙ~iÈ>XXŽŠ*¾‰8¾KØþ8¢XøŽ‹{>X‹iÈX˜Þ™Ú.8Þy¨NjžiÊÎXéþYºûÈžûÉ ¢K˜¾X˜Þh¨®ih~ZÙ~XX>{Jy»Nhê^Zî˜.Šy.ˆ›.XÚx˜~Š:™Ú ¢y[nZÙXX>{J8.KØnŠy.ˆ›.XÚx˜~iK¾i8®y¨NyêÎ™i>iÈ>i*ÞiKà¢8ÎX˜ÞX+î8ÞX¹^yZ¾ûÈ‡G&ç6f÷&ÞKØÞz{¾ûÈžûÈÀ¢55>ŠhþX˜~ûÉ®K»¾KÙ^iÈžKÙÎyJŽKŠ×G&ç6f÷&Þy¨NXX>{JûÈÀ¢iÈ>[»®z¸¾KˆX¾iky¨Nyh®iKî[NûÈÎh¨®Zè>h˜iÈžZÙXX>{Jy¨@¢yh®iKîšn[¨þ™yÎ˜.˜	žX¾[˜:ŽzøNYÈÞŠ:(	N(	NKˆÞzêZÙXX>{J ¢y¨G¢Ö–æFWŽŠŠÞZI®š¹ŽûÈÎ˜;Þ‹{>KˆÞX{®˜	žX¾zøNYÈÞXë¾‹yð¢ZIn™Ú.y¨NiÛŠ[þjùN‹È>8.h¨ˆ;ÞYÞz‹ih~ZÙ~X™¾Z[ÞiŠþXÚx˜~y¨@¢ZÙXX>{JûÈÎXÚx˜~X™¾Z[ÞYÊŽiK¾i8®yêÎ™i>iÈ—G&ç6f÷&ÞYÊŽ‹yûÈÀ¢˜	ž[iŠþKˆÞzê¢Ö–æFWŽŠŠÞZI®š¹Ž˜;Þk).yJŽy¨NyÉþjÚ>XéþYº8  ¢iKžh‰KˆÞXhÞy[nXÚx˜~y¨NZÙXX>{JûÈÎy»Nhê^hé¾X‹ ¢Fö7VÖVçBæ&öGž[©^Kˆ¾ûÈŽKˆÞiÈ>Š*¾K»¾KÙ^X¹^yZ°¢k:.Xø®y¨NYËikžûÈžûÈÎyJ†vWD&÷VæF–æt6Æ–VçE&V7B‚¢˜xþX{®XÚx˜~yºîX˜ÞYÊŽyZ¾™Ú.Kˆ®y¨NZún™©¾[ª~j‰žûÈÀ¢XhÞyJ‡÷6—F–öã¦f—†VNh¨®ih~ZÙ~{+îk©nyh®YÊ€¢XÚx˜~jÚ>Kˆ®ikž(	N(	N˜	žjŠ>ih~ZÙ~y¨Nyh®iKîšn[¨ð¢[iŠþy»Ž[ÞikÎi[NX¾š™Ú.YÊŽjùN‹È>ûÈÀ¢KˆÞiÈ>XhÞŠ*¾XÚx˜~ˆz®[{y¨NX¹^yZ¾Y»KØþ8 ¢¢ð ¢6öç7B&V7CÐ¢VÆVÖVçBævWD&÷VæF–æt6Æ–VçE&V7B‚“°  ¢6öç7B&FvRÐ¢Fö7VÖVçBæ7&VFTVÆVÖVçB€¢&F—b ¢“°  ¢&FvRæ6Æ74æÖRÐ¢'6¶–ÆÂÖæÖRÖ&FvR&FvRÒ"°¢VÆVÖVçEG—S°  ¢&FvRçFW‡D6öçFVçBÐ¢6¶–ÆÄæÖS° ¢6öç7B&FvTGW&F–öãÐ¢vWE6¶–ÆÄæÖT&FvTGW&F–öâ€¢6¶–ÆÄæÖRÀ¢VÆVÖVçEG—P¢“° ¢&FvRç7G–ÆRç6WE&÷W'G’€¢"Ò×6¶–ÆÂÖæÖRÖF—7Æ’ÖGW&F–öâ"À¢&FvTGW&F–öâ²&×2 ¢“°   ¢ò¢c3‚4õU$4RÔÄUdTÂT’4•¤Rd•ƒ ¢F†R&FvRvWG2—G2f–æÂf—7VÂ6—¦RB7&VF–öâF–ÖRà¢F†—2—2FVÆ–&W&FVÇ’–æÆ–æR²–×÷'FçB6òÆFW"5526ææ÷@¢6–ÆVçFÇ’÷fW'&–FR—Bâ¢ð¢&FvRç7G–ÆRç6WE&÷W'G’‚&föçB×6—¦R"Â#s'‚"Â&–×÷'FçB"“°¢&FvRç7G–ÆRç6WE&÷W'G’‚&Æ–æRÖ†V–v‡B"Â#ãR"Â&–×÷'FçB"“°¢&FvRç7G–ÆRç6WE&÷W'G’‚&föçB×vV–v‡B"Â#“"Â&–×÷'FçB"“°¢&FvRç7G–ÆRç6WE&÷W'G’‚'v†—FR×76R"Â&æ÷w&"Â&–×÷'FçB"“°¢&FvRç7G–ÆRç6WE&÷W'G’‚'v–GF‚"Â&Ö‚Ö6öçFVçB"Â&–×÷'FçB"“°¢&FvRç7G–ÆRç6WE&÷W'G’‚&Ö–â×v–GF‚"Â&Ö‚Ö6öçFVçB"Â&–×÷'FçB"“°¢&FvRç7G–ÆRç6WE&÷W'G’‚"×vV&¶—B×FW‡B×7G&ö¶R"Â#ã‡‚6c&VC’"Â&–×÷'FçB"“°¦6öç7B&FvUö–çBÐ¢vÖUö–çDg&öÔ6Æ–VçB€¢&V7BæÆVgB·&V7Bçv–GF‚ó"À¢&V7BçF÷ ¢“° ¢&FvRç7G–ÆRç÷6—F–öãÐ¢&'6öÇWFR#° ¢&FvRç7G–ÆRæÆVgCÐ¢&FvUö–çBç‚²'‚#° ¢&FvRç7G–ÆRçF÷Ð¢&FvUö–çBç’²'‚#°  ¢6öç7B÷fW&Æ”Æ–W"Ð¢B‚&vÖRÖ÷fW&Æ’ÖÆ–W""’ÇÀ¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&vÖR×7FvR"“° ¢÷fW&Æ”Æ–W"æVæD6†–ÆB€¢&FvP¢“°  ¢6WEF–ÖV÷WB‚‚“Óç° ¢–b€¢&FvRb`¢&FvRç&VçDæöFP¢—° ¢&FvRç&VçDæöFRç&VÖ÷fT6†–ÆB€¢&FvP¢“° ¢Ð ¢ÒÆ&FvTGW&F–öâ“° ¢–b‡G—Vöbv–æF÷rÓÒ'VæFVf–æVB"bbG—Vöbv–æF÷rçcC%Æ•6¶–ÆÄæ–ÖF–öäg&öÔ&FvSÓÓÒ&gVæ7F–öâ"—°¢v–æF÷rçcC%Æ•6¶–ÆÄæ–ÖF–öäg&öÔ&FvR‚'Æ–W""Ç6¶–ÆÄæÖRÆVÆVÖVçEG—RÀ¢6†&7FW$–æFW‡ÇÃÇF&vWD6öçG&7BçF&vWD–BÇF&vWD6öçG&7BçF&vWD–G2ÇF&vWD6öçG&7@¢“°¢Ð §Ð  ¢ò ¢)ˆRikZ)îûÈŽKéÞxZ~KÛþyJŽˆ^Šhk.ûÈÎh
®xšžikÞiKîh¨ˆ;Þi˜ ¢K™þŠh‹{>h¨ˆ;ÞYÞz‹ûÈžûÉ ¢‹y÷6†÷u6¶–ÆÄæÖT&FvR‚ž[›îK˜îKˆjŠKˆjŠ>ûÈÀ¢YJþKˆ[zîXŠ^iŠþyºîj‰žXX>{J[éà¢&GFÆUÆ–W$6&B¶6†&7FW$–æFW€¢hù¾h‰&GFÆTÖöç7FW"¶Ööç7FW$–æFWŽ(	N(	@¢h
®xšžiK¾i8®i˜.YÎjŠ>Xúþˆ;ÞŠ{Žy›ÎXÚx˜~X˜ÞX+îX¹^yZ°¢ûÈ†ÇVævTÖöç7FW$6&B‚žûÈžûÈÎh˜Kº^˜	žŠ:¢KˆjŠ>KˆÞy[nXÚx˜~y¨NZÙXX>{J8hé¾YÊ€¢Fö7VÖVçBæ&öGž[©^Kˆ¾8yJ‡÷6—F–öã¦f—†V@¢yh®YÊŽh
®xšžXÚx˜~jÚ>Kˆ®ikžûÈÎXéþYº‹yð¢6†÷u6¶–ÆÄæÖT&FvR‚žZèÎXZŽy»ŽYÎ8 ¢¢ð ¦gVæ7F–öâ6†÷tÖöç7FW%6¶–ÆÄæÖT&FvR€¢6¶–ÆÄæÖRÀ¢VÆVÖVçEG—RÀ¢Ööç7FW$–æFW‚À¢F&vWD–BÀ¢F&vWD–G2À¢F&vWE6–FP¢—° ¢6öç7BF&vWD6öçG&7CÖ7&VFT&GFÆUF&vWD6öçG&7B€¢&Ööç7FW""Ç6¶–ÆÄæÖRÆVÆVÖVçEG—RÄçVÖ&W"æ—4–çFVvW"†Ööç7FW$–æFW‚“öÖöç7FW$–æFWƒ£ÇF&vWD–BÇF&vWD–G2ÇF&vWE6–FP¢“° ¢6öç7BVÆVÖVçCÐ¢B‚&&GFÆTÖöç7FW""°¢Ööç7FW$–æFW€¢“°  ¢–b‚VÆVÖVçB—°¢&WGW&ã°¢Ð  ¢6öç7B&V7CÐ¢VÆVÖVçBævWD&÷VæF–æt6Æ–VçE&V7B‚“°  ¢6öç7B&FvSÐ¢Fö7VÖVçBæ7&VFTVÆVÖVçB€¢&F—b ¢“°  ¢&FvRæ6Æ74æÖSÐ¢'6¶–ÆÂÖæÖRÖ&FvR&FvRÒ"°¢VÆVÖVçEG—S°  ¢&FvRçFW‡D6öçFVçCÐ¢6¶–ÆÄæÖS° ¢6öç7B&FvTGW&F–öãÐ¢vWE6¶–ÆÄæÖT&FvTGW&F–öâ€¢6¶–ÆÄæÖRÀ¢VÆVÖVçEG—P¢“° ¢&FvRç7G–ÆRç6WE&÷W'G’€¢"Ò×6¶–ÆÂÖæÖRÖF—7Æ’ÖGW&F–öâ"À¢&FvTGW&F–öâ²&×2 ¢“°   ¢ò¢c3‚4õU$4RÔÄUdTÂT’4•¤Rd•ƒ ¢F†R&FvRvWG2—G2f–æÂf—7VÂ6—¦RB7&VF–öâF–ÖRà¢F†—2—2FVÆ–&W&FVÇ’–æÆ–æR²–×÷'FçB6òÆFW"5526ææ÷@¢6–ÆVçFÇ’÷fW'&–FR—Bâ¢ð¢&FvRç7G–ÆRç6WE&÷W'G’‚&föçB×6—¦R"Â#s'‚"Â&–×÷'FçB"“°¢&FvRç7G–ÆRç6WE&÷W'G’‚&Æ–æRÖ†V–v‡B"Â#ãR"Â&–×÷'FçB"“°¢&FvRç7G–ÆRç6WE&÷W'G’‚&föçB×vV–v‡B"Â#“"Â&–×÷'FçB"“°¢&FvRç7G–ÆRç6WE&÷W'G’‚'v†—FR×76R"Â&æ÷w&"Â&–×÷'FçB"“°¢&FvRç7G–ÆRç6WE&÷W'G’‚'v–GF‚"Â&Ö‚Ö6öçFVçB"Â&–×÷'FçB"“°¢&FvRç7G–ÆRç6WE&÷W'G’‚&Ö–â×v–GF‚"Â&Ö‚Ö6öçFVçB"Â&–×÷'FçB"“°¢&FvRç7G–ÆRç6WE&÷W'G’‚"×vV&¶—B×FW‡B×7G&ö¶R"Â#ã‡‚6c&VC’"Â&–×÷'FçB"“°¦6öç7B&FvUö–çBÐ¢vÖUö–çDg&öÔ6Æ–VçB€¢&V7BæÆVgB·&V7Bçv–GF‚ó"À¢&V7BçF÷ ¢“° ¢&FvRç7G–ÆRç÷6—F–öãÐ¢&'6öÇWFR#° ¢&FvRç7G–ÆRæÆVgCÐ¢&FvUö–çBç‚²'‚#° ¢&FvRç7G–ÆRçF÷Ð¢&FvUö–çBç’²'‚#°  ¢6öç7B÷fW&Æ”Æ–W"Ð¢B‚&vÖRÖ÷fW&Æ’ÖÆ–W""’ÇÀ¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&vÖR×7FvR"“° ¢÷fW&Æ”Æ–W"æVæD6†–ÆB€¢&FvP¢“°  ¢6WEF–ÖV÷WB‚‚“Óç° ¢–b€¢&FvRb`¢&FvRç&VçDæöFP¢—° ¢&FvRç&VçDæöFRç&VÖ÷fT6†–ÆB€¢&FvP¢“° ¢Ð ¢ÒÆ&FvTGW&F–öâ“° ¢–b‡G—Vöbv–æF÷rÓÒ'VæFVf–æVB"bbG—Vöbv–æF÷rçcC%Æ•6¶–ÆÄæ–ÖF–öäg&öÔ&FvSÓÓÒ&gVæ7F–öâ"—°¢v–æF÷rçcC%Æ•6¶–ÆÄæ–ÖF–öäg&öÔ&FvR‚&Ööç7FW""Ç6¶–ÆÄæÖRÆVÆVÖVçEG—RÀ¢Ööç7FW$–æFW‡ÇÃÇF&vWD6öçG&7BçF&vWD–BÇF&vWD6öçG&7BçF&vWD–G2ÇF&vWD6öçG&7@¢“°¢Ð §Ð  ¢ò ¢)ˆRKúîjÚ>ûÈŽKéÞxZ~KÛþyJŽˆ^Šhk.ûÈÎh»þhèžikÞiKîh¨ˆ;Þi˜ ¢‹{>X{¥5khŽˆ	~i[ŽZÙ~y¨NX¹^yZ¾ûÈžûÉ ¢K˜¾X˜ÞjøþjÊikÞiKîh¨ˆ;ÞûÈÎ˜;ÞiÈ>XúnZIn‹{>X{®KˆX°¢8ÂÕ……58Þy¨NkZîX¹^ih~ZÙ~ûÈÎhù˜i.hš>K¨nZI®[	58 ¢KÛþyJŽˆ^Šk®[é~˜	žX¾hùzK®KˆÞ™ÈŠhûÈÎy»Nhê^h»þhèž8 ¢KùÞyYž˜	žX¾X{Þ[ÈþiÊÎ‹ª¾ûÈŽŠé>h˜iÈžYÎXú¾y¨NYËik¢˜(NiŠþˆ;ÞjÚ>[‹Ž˜¾KÙÎ8KˆÞiÈ>Y›N˜ÊþûÈžûÈÀ¢KØnX{Þ[ÈþXZ~Zëžkˆ^z›®ûÈÎKˆÞXhÞX®K»¾KÙ^šþzK®8 ¢¢ð ¦gVæ7F–öâ6†÷uÆ–W%7÷W†Ö÷VçBÆ6†&7FW$–æFW‚—° ¢&WGW&ã° §Ð  ¦gVæ7F–öâÇVævUÆ–W$6&B†6†&7FW$–æFW‚—° ¢6öç7BVÆVÖVçBÐ¢B‚&&GFÆUÆ–W$6&B"°¢†6†&7FW$–æFW‡ÇÃ¢“°  ¢–b‚VÆVÖVçB—°¢&WGW&ã°¢Ð  ¢VÆVÖVçBæ6Æ74Æ—7Bç&VÖ÷fR€¢&GF6¶W"ÖÇVævR×W ¢“°  ¢fö–BVÆVÖVçBæöfg6WEv–GFƒ°  ¢VÆVÖVçBæ6Æ74Æ—7BæFB€¢&GF6¶W"ÖÇVævR×W ¢“°  ¢6WEF–ÖV÷WB‚‚“Óç° ¢VÆVÖVçBæ6Æ74Æ—7Bç&VÖ÷fR€¢&GF6¶W"ÖÇVævR×W ¢“° ¢ÒÃCS“° §Ð  ¦gVæ7F–öâÇVævTÖöç7FW$6&B†–æFW‚—° ¢6öç7BVÆVÖVçBÐ¢B‚&&GFÆTÖöç7FW""¶–æFW‚“°  ¢–b‚VÆVÖVçB—°¢&WGW&ã°¢Ð  ¢VÆVÖVçBæ6Æ74Æ—7Bç&VÖ÷fR€¢&GF6¶W"ÖÇVævRÖF÷vâ ¢“°  ¢fö–BVÆVÖVçBæöfg6WEv–GFƒ°  ¢VÆVÖVçBæ6Æ74Æ—7BæFB€¢&GF6¶W"ÖÇVævRÖF÷vâ ¢“°  ¢6WEF–ÖV÷WB‚‚“Óç° ¢VÆVÖVçBæ6Æ74Æ—7Bç&VÖ÷fR€¢&GF6¶W"ÖÇVævRÖF÷vâ ¢“° ¢ÒÃCS“° §Ð  ¢ò ¢)ˆR™h>˜þX¹^yZ¾ûÈŽikZ)îûÈžûÉ ¢‹yöÇVæv^iŠþYÎKˆzŠîZú¾k9^ûÈÎXú®iŠþhù¾KˆX¶6Æ7>ûÈÀ¢ZY~yJŽYÊŽ8Î‹«.˜îiK¾i8¢þh«^h©~y[[‹Žx¸hX¾8Þy¨N˜*>X¾yºîj‰ž‹ª¾Kˆ®8 ¢¢ð ¦gVæ7F–öâ6†÷tFöFvTæ–ÖF–öâ†VÆVÖVçB—° ¢–b‚VÆVÖVçB—°¢&WGW&ã°¢Ð  ¢VÆVÖVçBæ6Æ74Æ—7Bç&VÖ÷fR€¢&FöFvRÖ&6² ¢“°  ¢fö–BVÆVÖVçBæöfg6WEv–GFƒ°  ¢VÆVÖVçBæ6Æ74Æ—7BæFB€¢&FöFvRÖ&6² ¢“°  ¢6WEF–ÖV÷WB‚‚“Óç° ¢VÆVÖVçBæ6Æ74Æ—7Bç&VÖ÷fR€¢&FöFvRÖ&6² ¢“° ¢ÒÃCS“° §Ð  ¢ò ¢YÎi˜.‰™^yn8ÎiK¾i8®k).YÞKŠÞ8Þ‹yþ8Îy[[‹Žx¸hX¾k).yIþiXŽ8Ð¢˜	žXZžzŠæÖ—7>x¸k8ûÉ ¢yºîj‰žXÚx˜~i*ÞiKî™h>˜þX¹^yZ¾ûÈÀ¢KŠn‹{>X{®KˆX¾xy›Þˆ›.y¨Nih~ZÙ~hùzK®8  ¢—5Æ–W%F&vWC×G'V^i˜.[Þ‹iŠþxêžZënˆz®[{y¨NXÚx˜~ûÈÀ¢Y
nX˜~yJ†–æFWŽXë¾h©>h
®xšžXÚx˜~8 ¢¢ð ¦gVæ7F–öâ6†÷tÖ—74VffV7B†—5Æ–W%F&vWBÆ–æFW‚ÇFW‡B—° ¢ò ¢)ˆRKúîjÚ>ûÉ ¢—5Æ–W%F&vWC×G'V^i˜.ûÈÀ¢–æFWŽxûîYÊŽKº>ŠŽ8ÎzÊÎ[›î[Ë^xêžZënXÚ8Ð¢ûÈƒÞzÊÎKˆŠy.ˆ›.8ÞzÊÎK¨ÎŠy.ˆ›.ûÈžûÈÀ¢KˆÞXhÞkŽ˜h©6&GFÆUÆ–W%&÷~Š:zÊÎKˆ[Ë^XÚûÈÀ¢˜	žjŠ>zÊÎK¨ÎŠy.ˆ›.Š*¾iK¾i8®k).YÞKŠÞi˜.ûÈÀ¢™h>˜þX¹^yZ¾h˜ÞiÈ>X{®xûîYÊŽjÚ>z+®y¨NXÚx˜~Kˆ®8 ¢¢ð ¢6öç7BVÆVÖVçBÐ¢—5Æ–W%F&vW@¢ð¢B‚&&GFÆUÆ–W$6&B"°¢†–æFW‡ÇÃ¢¢ ¢B‚&&GFÆTÖöç7FW""¶–æFW‚“°  ¢–b‚VÆVÖVçB—°¢&WGW&ã°¢Ð  ¢6†÷tFöFvTæ–ÖF–öâ€¢VÆVÖVç@¢“°  ¢6†÷tFÖvU÷W€¢VÆVÖVçBÀ¢FW‡GÇÂ$Ô•52"À¢&Ö—72 ¢“° §Ð  ¦gVæ7F–öâ6†÷uÆ–W$†—B†Ö÷VçBÇG—RÆ6†&7FW$–æFW‚Æ—5÷6—F—fRÆ—47&—B—° ¢6öç7BVÆVÖVçBÐ¢B‚&&GFÆUÆ–W$6&B"°¢†6†&7FW$–æFW‡ÇÃ¢“°  ¢–b‚VÆVÖVçB—°¢&WGW&ã°¢Ð  ¢ò ¢)ˆRXhÞjÊKúîjÚ>ûÈŽyÉþy¨Nh©>X‹˜®kÈþy¨NYËikžûÈžûÉ ¢Kˆ®jÊXú®hé.™šNK¨gG—SÓÓÒ&†VÂ.ûÈÎKØe5‰z^k@¢h.[êžyJŽy¨NiŠ÷G—SÓÓÒ'7.ûÈÎKˆÞiŠò&†VÂ.ûÈÀ¢kÈþ{k.K˜¾šÙ®ûÈÎYiÕ5‰z^kNh.[êžy¨Ni˜.X	ž˜(NiŠþiÈ0¢ŠªNŠ{Žy›Î™È~X¹^(	N(	NYÎKˆX¾jžiÊÎYXþšÎûÈŽyJŽ‹8~k© ¢zŠîšîy¨NZÙ~K‹.Xë¾xÉÎkŠÎ8Î˜	žiŠþjÚ>™Ú.˜(N‹*™Ú.iXŽiéÎ8Ð¢iÊÎKèn[KˆÞXúþ™ÚûÈÂ'7.˜	žX¾ZÙ~K‹.YÎi˜.Kº>Š€¢8Î˜	žiŠõ58ÞûÈÎk).‹ênk9^YÎi˜.Xˆn‹êŽ8ÎiŠþh.[ê¢˜(NiŠþkXZK8ÞûÈž8  ¢˜	žŠ:˜
>[‹ny›ÎxûîK¨nXúnKˆX¾Yºx+®YÎjŠ>XéþYº˜
h‰y¨@¢'V~ûÉ®Kˆ¾™Ú.šþzK®y¨B²òÞzÊn‰™þûÈÎK™þXú®Š¨Þ[ép¢G—SÓÓÒ&†VÂ.ûÈÅ5‰z^kNh.[êžy¨Ni˜.X	¢iÈ>šþzK®h‰8ÂÓS58Þ˜	žzŠîŠªN[îK«®y¨N‹*i[ŽûÈÀ¢iˆîiˆîiŠþYÊŽŠ9ÎŠþŠ9ÎšÙNXÛ¾šþzK®‹*‰™þ8  ¢iKžh‰iˆîz+®X+>KˆX¶—5÷6—F—f^Xø>i[ŽûÈÀ¢KˆÞXhÞ™ÚZÙ~K‹.Xë¾xÉÎûÈÎ˜	žŠ:YÎXú¾y¨NjøþX¾YËik¢˜;ÞŠhˆz®[{iˆîz+®ŠÉ¾kˆ^jY®8Î˜	žjÊiŠþjÚ>™Ú.iXŽiéÀ¢˜(NiŠþ‹*™Ú.iXŽiéÎ8ÞûÈÎXZžX¶'V~KˆjÊKúîZ[ÞûÈÀ¢Kº^[èÎK™þKˆÞiÈ>XhÞiÈžšîKËÎ8ÇG—^ZÙ~K‹.k).h¨ ¢iùX¾h8^k8ˆ>hZî˜.Xë¾8ÞˆÎkÈþhèžy¨Nx¸k88 ¢¢ð ¢ò¢FÖvR÷W7&VF–öâ—2F†R†—BÖfVVF&6²÷væW"âF†R6&B&ö÷BæWfW ¢&V6V—fW2&÷&FW"÷6†F÷r†—B7FFS²÷6—F—fR†VÂõ5fVVF&6²F†W&Vf÷&P¢6ææ÷B66–FVçFÆÇ’–æ†W&—BFÖvR6VÖçF–72â¢ð ¢–b€¢Ö÷VçBÓ×VæFVf–æVBb`¢Ö÷VçBÓÖçVÆÀ¢—° ¢6öç7B&Vf—‚Ð¢—5÷6—F—fP¢ð¢"² ¢ ¢"Ò#°  ¢ò ¢)ˆRikZ)îûÈŽKéÞxZ~KÛþyJŽˆ^Šhk.ûÈÎh
®xšžh™>xêžZë`¢xˆni8®i˜.K™þŠhiÈžiXŽiéÎûÈÎ‹y÷6†÷tÖöç7FW$†—B‚¢˜*>˜(®xêžZënh™>h
®xšžxˆni8®y¨NYŽxûîikž[ÈþKˆˆ{NûÈžûÉ ¢—47&—Nx+§G'V^i˜.ûÈÎi[ŽZÙ~X˜Þ™Ú.Xª	ù*^ûÈÀ¢KŠnh¨¦—47&—NX+>{Zg6†÷tFÖvU÷W‚žûÈÀ¢Šé>Zè>ZY~Kˆ¢æ7&—F–6Â×÷WjŠ>[Èð¢ûÈŽZÙ~i»NZJ~8šþˆ›.i»N˜i.yºîûÈžûÈÎ‹yþxêžZën[Ð¢h
®xšžxˆni8®i˜.yÈ¾X‹y¨NiXŽiéÎYÎKˆZY~8 ¢¢ð ¢6†÷tFÖvU÷W€¢VÆVÖVçBÀ¢€¢—47&—@¢ð¢" ¢ ¢" ¢’°¢&Vf—‚°¢Ö÷VçB°¢€¢G—SÓÓÒ'7 ¢ð¢%5 ¢ ¢$… ¢’À¢G—RÀ¢—47&—@¢“° ¢Ð §Ð  ¢ò ¢)ˆRikZ)îûÈŽKéÞxZ~KÛþyJŽˆ^Šhk.ûÈÎ8ÎŠÛ~y»îX+~Zë>j™þX‹bââîšþzK®y›Þˆ› ¢i[ŽZÙ~hš>™šNX¹^yZ¾ûÈÎZh.ûÉ¥²ÓScuÞ8ÞûÈžûÉ ¢‹y÷6†÷uÆ–W$†—B‚žYÎjŠ>h›æ&GFÆUÆ–W$6&NXX>{JûÈÀ¢KØnyJŽ[Ž[Îy¨G6†–VÆNšîYè¾ûÈŽy›Þˆ›.ih~ZÙ~ûÈÎŠh²æFÖvR×÷Wà¢6†–VÆB×÷WûÈžûÈÎ‹yþKˆˆŠÄ…hèžŠy¨N{H^ZÙ~iˆîz+®XØXˆn™h¾KènûÈÀ¢Kº>ŠŽ8Î˜	žiŠþŠÛ~y»îh™¾Kˆ¾Kèny¨N˜xþûÈÎKˆÞiŠþyÉþy¨Nhš>Š8Þ8 ¢¢ð¦gVæ7F–öâ6†÷u6†–VÆD'6÷&"†6†&7FW$–æFW‚Æ'6÷&&VB—° ¢–b‚'6÷&&VBÇÂ'6÷&&VCÃÓ—°¢&WGW&ã°¢Ð ¢6öç7BVÆVÖVçBÐ¢B‚&&GFÆUÆ–W$6&B"°¢†6†&7FW$–æFW‡ÇÃ¢“° ¢–b‚VÆVÖVçB—°¢&WGW&ã°¢Ð ¢6†÷tFÖvU÷W€¢VÆVÖVçBÀ¢"Ò"¶'6÷&&VBÀ¢'6†–VÆB ¢“° §Ð  ¦gVæ7F–öâ6†÷tÖöç7FW$†—B†–æFW‚ÆÖ÷VçBÇG—RÆ—47&—B—°¢6öç7BVÆVÖVçCÒB‚&&GFÆTÖöç7FW""¶–æFW‚“°¢–b‚VÆVÖVçGÇÆÖ÷VçCÓÓ×VæFVf–æVGÇÆÖ÷VçCÓÓÖçVÆÂ—²&WGW&ã²Ð ¢6öç7B&÷74÷væW#×G—Vöbv–æF÷rÓÒ'VæFVf–æVB#÷v–æF÷räf÷W%7–Ö&öÇ4&÷74&GFÆS¦çVÆÃ°¢6öç7B6WGFÆVÖVçC×G—SÓÓÒ&‡"bf&÷74÷væW"bgG—Vöb&÷74÷væW"æ6öç7VÖTFÖvU6WGFÆVÖVçCÓÓÒ&gVæ7F–öâ ¢ö&÷74÷væW"æ6öç7VÖTFÖvU6WGFÆVÖVçB†–æFW‚“¦çVÆÃ° ¢–b‡6WGFÆVÖVçB—°¢–b‡6WGFÆVÖVçBç6†–VÆD'6÷&&VCã—°¢6†÷tFÖvU÷W†VÆVÖVçBÂ"Ò"·6WGFÆVÖVçBç6†–VÆD'6÷&&VBÂ'6†–VÆB"ÆfÇ6R“°¢Ð¢–b‡6WGFÆVÖVçBæ‡FÖvSã—°¢6†÷tFÖvU÷W†VÆVÖVçBÂ"Ò"·6WGFÆVÖVçBæ‡FÖvR²$…"Â&‡"Æ—47&—B“°¢Ð¢&WGW&ã°¢Ð ¢6öç7B&Vf—ƒ×G—SÓÓÒ&†VÂ#ò"²#¢"Ò#°¢6†÷tFÖvU÷W€¢VÆVÖVçBÀ¢&Vf—‚¶Ö÷VçB²‡G—SÓÓÒ'7#ò%5#¢$…"’À¢G—RÀ¢—47&—@¢“°§Ð  ¢ò¢ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÐ¢h
®xšž˜xÞyIð£ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÒ¢ð ¦gVæ7F–öâ&W7väÖöç7FW'2‚—° ¢–b†&GFÆT7F—fR—°¢&WGW&ã°¢Ð  ¢ò ¢)ˆRKúîjÚ>ûÉ ¢XéþiÊÎ˜	žŠ:KˆÞXˆn™Ù.{H^y¨.y›ÞûÈÀ¢jøþjÊ˜;Þh¨®XZŽ˜:ƒn™«¾h
®xšž˜xÞ{ÚîKØÞ{ÚîûÈ¾Y¹îk»þŠûÈÀ¢xûîYÊŽh‹šÊ^Xú®iÈ>hÛ.XZSã>™«¾ûÈÀ¢X[nšIŽk).jÛ¾y¨Nh
®xšžKˆÞhxžŠ›.Š*¾X¹^X‹ ¢ûÈŽKˆÞxKnk).jÛ¾y¨Nh
®xšžK™þiÈ>jøþjÊh‹šÊ^[èÎz¨xKn‹{>KØÞ{ÚîûÈž8 ¢iKžh‰Xú®‰™^yn8ÎyÉþy¨N[{.{i>jÛ¾Kª8Þy¨Nh
®xšž8 ¢¢ð ¢Ööç7FW'0¢ç6Æ–6R€¢À¢Ô…õE$”ä”äuôÔôå5DU%0¢¢æf÷$V6‚€¢†Ööç7FW"Æ–æFW‚“Óç° ¢–b€¢Ööç7FW"ÇÀ¢Ööç7FW"æÆ—fP¢—°¢&WGW&ã°¢Ð  ¢Ööç7FW"æÆ—fS×G'VS° ¢Ööç7FW"æ‡Ð¢Ööç7FW"æÖ„…° ¢Ööç7FW"ç7Ð¢Ööç7FW"æÖ…5°  ¢ò ¢)ˆRKúîjÚ>ûÈŽkˆ^ynjéŽyYžzˆ¾[Èþz+ÎûÈžûÉ ¢˜	žŠ:XéþiÊÎ˜(NYÊŽ˜xÞikŠˆŽzé~h
®xšžy¨G‚÷ž[ª~j‰ž8¢i»NikYËYÉnYÉnzK®y¨NKØÞ{ÚîûÈÎKØnh
®xšž[{.{i0¢KˆÞXhÞ[z˜(þ8YÉnzK®K™þi[NX¾™«‰xþK¨nûÈÀ¢˜	žjë^ZèÎXZŽyJŽKˆÞX‹K¨nûÈÎh»þhèž8 ¢ikXØYùþûÈŽXk™ÉÎ[ˆHŽK˜¾[èÎûÈžy¨Nh
®xšž‹8~ii¢iÊÎKèn[k).iÈ—‚÷ž˜	žXZžX¾jÈNKØÞûÈÀ¢yYž‰~˜	žjë^[ÞZè>X	KènŠª®Xú®iÈ>zé~X{ ¢k).iÈžhHþ{êžy¨DæîûÈÎkˆ^hèžjùN‹È>K›îkzŽ8 ¢¢ð ¢Ð¢“° §Ð  ¢ò ¢)ˆRKúîjÚ>ûÈŽKéÞxZ~KÛþyJŽˆ^Šhk.ûÈÎ˜	žjÊyÉþy¨N{[KˆhèžK¨nûÈžûÉ ¢˜	žŠ:K˜¾X˜Þ[{.{i>Š*¾iKžh‰8Î˜.XZ^YËYÉn[ˆz®X¹^jøóNzy ¢Š{Žy›ÎKˆjÊh‹šÊ^8ÞûÈÎKØnKÛþyJŽˆ^˜	žjÊiˆîz+®Šhk.ûÉ ¢˜.XZ^YËYÉn[èÎ[ø^šŽXXŽhÈž8Îˆz®X¹^[zh
®8ÞhÈž˜‰^ûÈÀ¢h˜ÞiÈ>™h¾Zx¾jøóNzy.ˆz®X¹^h‹šÊ^(	N(	N˜	žjÚ>iŠþ[èÎKè`¢YÊ‡FövvÆTWFõG&öÂ‚’÷'VäWFõG&öÄ6†V6²‚¢ûÈŽYËYÉnš™Ú.ˆz®X¹^h‹šÊ^™Ú.iÛþix˜(®˜*>šnikhÈž˜‰^ûÈ¢X®y¨NK¨¾ûÈÎXZžZY~˜(þ‹ÊþX®y¨NiŠþYÎKˆK»nK¨¾ûÈÎXÛ¾YNˆz ¢xÚŽz¸¾˜¾KÙÎ8K©.KˆÞyú^˜>[ÞikžZÙŽYÊŽûÈÎh˜ÞiÈ>X{®xûà¢8Îˆz®X¹^[zh
®˜;Þ˜(Nk).hÈžûÈÎ[ˆz®[{h™>‹[~Kèn8Ð¢˜	žzŠîŠÎx+®(	N(	NYºx+®yÉþjÚ>YÊŽˆ8Îišþ˜¾KÙÎy¨NX[nZúniŠð¢˜	žŠ:˜	žZY~8Î˜.YËYÉn[ˆz®X¹^™h¾Zx¾8Þy¨Nˆˆ®˜(þ‹ÊþûÈÀ¢‹yþKÛþyJŽˆ^hÈžy¨N˜*>šnhÈž˜‰^ZèÎXZŽxJ™yÎ8  ¢X{Þ[ÈþYÞz‹8YÎXú¾y¨NYËikžûÈ†VçFW%¦öæR‚ž8¢v–ä&GFÆR‚žK˜¾[èÎ8˜>ˆJ¾h‰X©þK˜¾[èÎ(
nûÈž˜;Þ{jÞhÈ¢KˆÞX¹^ûÈÎKØnX{Þ[ÈþiÊÎš¹NiKžh‰z›®y¨N(	N(	NxûîYÊ€¢8ÎŠhKˆÞŠhjøóNzy.ˆz®X¹^h‹šÊ^8ÞYJþKˆy¨N™h¾™yÎiŠð¢FövvÆTWFõG&öÂ‚ž˜*>šnhÈž˜‰^ûÈÎKˆÞiÈ>XhÞiÈ¢˜.YËYÉn[ˆz®X¹^Š{Žy›Îy¨NŠÎx+®8 ¢¢ð ¦gVæ7F–öâ7F'DÖöç7FW$Ö÷fVÖVçB‚—° ¢ò ¢iX^hHþyYžz›®ûÉ®ˆz®X¹^[zh
®y¨N™h¾™yÎXú®KªN{Z`¢FövvÆTWFõG&öÂ‚ž‰™^ynûÈÎ˜	žŠ:KˆÞXhÐ¢ˆz®X¹^YYþX¹^K»¾KÙ^ŠˆŽi˜.YšŽ8 ¢¢ð §Ð  ¦gVæ7F–öâ7F÷Ööç7FW$Ö÷fVÖVçB‚—° ¢ò ¢iX^hHþyYžz›®ûÈÎXéþYºYÎKˆ®(	N(	NyÉþjÚ>y¨NXÎjÚ.˜(þ‹Êð¢YÊ‡7F÷WFõG&öÂ‚žûÈÎYÎXú¾˜	žŠ:KˆÞiÈ0¢iÈžK»¾KÙ^KÙÎyJŽûÈÎ{IN{+žiŠþx+®K¨nŠé>ˆˆ®y¨NYÎXú¾›¹à¢ûÈ†ÆVfTÖ‚ž87F'D&GFÆR‚ž(
nûÈ¢KˆÞyJŽKˆX¾KˆX¾iKžhèž8KˆÞiÈ>Y›N˜Êþ8 ¢¢ð §Ð  ¢ò¢ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÐ¢XØ~{I £ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÒ¢ð ¦gVæ7F–öâ6†V6´ÆWfVÅW‡F&vWD6†&7FW"—° ¢ò ¢)ˆRKúîjÚ>ûÉ ¢XéþiÊÎ˜	ži[NX¾X{Þ[ÈþZú¾jÛ¾Xú®Š¨×Æ–W.ûÈÀ¢zÊÎK¨ÎŠy.ˆ›.k).‹ênk9^˜þ˜î˜	žŠ:XØ~{I®8 ¢iKžh‰XúþKº^X+>XZ^ŠhXØ~{I®y¨NŠy.ˆ›.xšžK»nûÈÀ¢KˆÞX+>y¨NŠ›š	ŠŠÞ˜(NiŠ÷Æ–W ¢ûÈŽKùÞyYžˆˆ®y¨NYÎXú¾ikž[Èþy»ŽZëžûÈž8 ¢¢ð ¢6öç7B6†&7FW#Ð¢F&vWD6†&7FW'ÇÀ¢Æ–W#°  ¢ÆWBÆWfVÇ3Ó°  ¢ò ¢)ˆRikZ)î™‹.YnûÉ ¢jÚ>[‹Žh8^k8Kˆ¾˜	žX·v†–Æ^iÈZI®‹yjÊ¢ûÈ†F—7G&–'WFTW‡Fô6†&7FW.jøþjÊ˜;ÞXú®{Z`¢X™¾Z[Ó{I®y¨N˜xþûÈžûÈÀ¢KØn˜(NiŠþXªKˆX¾KùÞ™ª®Kˆ®™™ûÈÀ¢˜þXXÞK»¾KÙ^h‰k).š	iižX‹y¨N‹8~iižy[[‹€¢ûÈŽKè¾Zh.ˆˆ®ZÙŽj©Ny¨FW‡æW‡NZ9îhèžûÈ¢[îˆ{N˜	žŠ:‹yX{®™º.ŠÙÎy¨N‹ûNYÈŽjÊi[ŽûÈÀ¢KˆjÊxˆnZ)î[›îy›î{I®8xÎX{®ZJžih~i[ŽZÙ~y¨Nh¨ˆ;Þ›¹î8 ¢#{I®[ÞyºîX˜Þ˜®h‹.˜.[ªnKènŠª®[{.{i>™Ùî[‹ŽZI®ûÈÀ¢jÚ>[‹Žxêžk9^KˆÞXúþˆ;ÞKˆjÊŠ{Žy›ÎX‹˜	žX¾Kˆ®™™8 ¢¢ð ¢v†–ÆR€¢6†&7FW"æW‡ãÐ¢6†&7FW"æW‡æW‡Bb`¢ÆWfVÇ3Ã# ¢—° ¢6†&7FW"æW‡ÓÐ¢6†&7FW"æW‡æW‡C°  ¢6†&7FW"æÆWfVÂ²³°  ¢6†&7FW"æW‡æW‡BÐ¢ÖF‚æÖ‚€¢6†&7FW"æW‡æW‡B³À¢ÖF‚æfÆö÷"€¢6†&7FW"æW‡æW‡B£ã ¢¢“°  ¢6†&7FW"æGG&–'WFUö–çG2³ÒS° ¢6†&7FW"ç6¶–ÆÅö–çG2³Ò#°  ¢ò ¢)ˆRŠhþjÎŠhk.ûÉ ¢XØ~{I®Y»®Zé¢³3iÈZJt…8³iÈZJu5ûÈÀ¢‹yþš¹N‹:¢þˆ;Þ˜xþ˜XÞ›¹îXªh‰Xˆn™h¾{JþXª8 ¢¢ð ¢6†&7FW"æ&öçW4…³Ò3° ¢6†&7FW"æ&öçW55³Ò°  ¢ÆWfVÇ2²³° ¢Ð  ¢–b†ÆWfVÇ3ã—° ¢ò ¢)ˆRKúîjÚ>ûÉ ¢˜	žŠ:‹yþK˜¾X˜Þh‹šÊ^X¹ÞXŠžŠ9ÎŠiŠþYÎKˆzŠîYXþšÎ(	N(	@¢XØ~{I®y[nKˆ¾y»Nhê^h¨¤…õ5[Ë~X‹nŠ9Îk»þûÈÀ¢‹yþKÚŠŠÞZé®y¨N8Ä…KØîikÅ‚Rõ5KØîikÅ‚^8Ð¢ˆz®X¹^Š9Î‰z^kN™hj«¾ZèÎXZŽxJ™yÎûÈÀ¢™º>h
®KÚiÈ>Šk®[é~8Îiˆîiˆî˜(Nk).X‹™hj«¾ûÈÀ¢Zè>ˆz®[{[Š9ÎK¨n8Þ8  ¢h»þhèž[Ë~X‹nŠ9Îk»þûÈÎXú®˜xÞikŠˆŽzé~KˆjÊ¢7W'&VçB‡÷7y¨NKˆ®™™ZKîKØþûÈŽ˜þXXÞ‹h^˜îiky¨FÖ„…öÖ…5ûÈžûÈÀ¢KˆÞiÈ>[›>y›ÞxJiX^Šè®h‰XZŽk»þ8  ¢Æ–W#.k).iÈ–vWDÖ–ä6†&7FW%7FG2‚žXúþKº^yJ€¢ûÈŽ˜*>X¾X{Þ[ÈþZú¾jÛ¾zéwÆ–W.y¨NûÈžûÈÀ¢iKžyJŽ‹yövWD–çfVçF÷'”6†&7FW%7FG2‚¢Æ–W#.XˆniJþYÎKˆZY~XZÎ[Èþxûîzé~KˆjÊ8 ¢¢ð ¢ÆWBÖ„…° ¢ÆWBÖ…5°  ¢–b†6†&7FW#ÓÓ×Æ–W"—° ¢6öç7B7FG2Ð¢vWDÖ–ä6†&7FW%7FG2‚“°  ¢Ö„…Ð¢7FG2æÖ„…° ¢Ö…5Ð¢7FG2æÖ…5° ¢Ð¢VÇ6W° ¢6öç7B6†&7FW$–æFWƒÐ¢vWE'G”6†&7FW$–æFW‚€¢6†&7FW ¢“°  ¢6öç7B&öçW3"Ð¢vWDWV—ÖVçD&öçW2€¢vWE'G”6†&7FW$¶W’€¢6†&7FW$–æFW€¢¢“°  ¢Ö„…Ð¢°¢6†&7FW"çf—FÆ—G’£S°¢6†&7FW"æ&öçW4…°¢&öçW3"æÖ„…°¢&öçW3"çf—FÆ—G’£S°  ¢Ö…5Ð¢S°¢6†&7FW"æVæW&w’£R°¢6†&7FW"æ&öçW55°¢&öçW3"æÖ…5°¢&öçW3"æVæW&w’£S° ¢Ð  ¢6†&7FW"æ‡Ð¢ÖF‚æÖ–â€¢6†&7FW"æ‡À¢Ö„… ¢“°  ¢6†&7FW"ç7Ð¢ÖF‚æÖ–â€¢6†&7FW"ç7À¢Ö…5 ¢“°  ¢ò ¢)ˆRKúîjÚ>ûÈŽKéÞxZ~KÛþyJŽˆ^Šhk.ûÈÎ8Î{i>š™~XÀ¢Xˆn˜XÞXØ~{I®y¨Ni˜.X	žûÈÎy»Nhê^›¹î˜Ž[Z[ÞûÈÀ¢KˆÞŠhXhÞ‹{>X{®Šinz©~šþzK®Y®yú^8ÞûÈÎ[èÎ{¨À¢XøŽŠ9ÎXX^8Î[ˆÎiÉ¾XØ~{I®y¨Ni˜.X	žXúþKº^‹{>X{ ¢KˆX¾Šˆ®hþjnûÈÎšþzK¥……ŽXØ~X‹…Ž{I®8ÞûÈžûÉ ¢6†V6´ÆWfVÅW‚žyºîX˜ÞXú®iÈžKˆX¾YÎXú°¢Kènk©(	N(	FF—7G&–'WFTW‡Fô6†&7FW"‚¢ûÈŽ{i>š™~kXˆn˜XÞš™Ú.hÈž8ÎXˆn˜XÞ{i>š™~XÎ{Z`¢Ž8Þ˜*>X¾hÈž˜‰^ûÈžûÈÎh˜Kº^˜	žŠ:y¨NKúîiK¢Xú®[Û™ûþ˜	žX¾kXzˆ¾ûÈÎKˆÞiÈ>ŠªNX+~X[nK¹`¢h8^Z(>8  ¢XéþiÊÎXØ~{I®y[nKˆ¾iÈ>[Ë~X‹n‹{>X{®KˆX¾Šh¢h˜¾X¹^hÈž8Îz+®Zé®8Þh˜Þˆ;Þ™yÎhèžy¨@¢ÆWfVÄÖöFÎ[ØŽz©~ûÈÎxêžZënˆz®[{K‹¾X¹P¢›¹îXˆn˜XÞ8iÉþ[è^y¨N[iŠþ8Î›¹îKˆ¾Xë¾šjÎKˆ ¢yIþiXŽ8ÞûÈÎKˆÞ™ÈŠhšÞZInXhÞ‹{>Kˆ[@¢z+®Š¨ÒþY®yú^Šinz©~h˜Þˆ;Þ{›Î{¨Îi8ÞKÙÎ(	N(	@¢˜	ž˜:ŽXˆn{jÞhÈh»þhèž8  ¢KØnxêžZën[èÎKèniˆîz+®ŠŽzK®˜(NiŠþh;>Šh8ÎiÈ¢Y®yú^8ÞûÈÎXú®iŠþKˆÞŠh˜*>zŠîŠhhÈžz+®Zé®y¨@¢[Ú.[ÈþûÈÎiKžh‰‹yþxÛ.[étU…YÎKˆzŠî‹É^˜xð¢Fö7N˜	®yú^ûÈŽŠh·6†÷tÆWfVÅWFö7B‚žûÈžûÈÀ¢KˆÞi8¾i8ÞKÙÎ8yÈ¾˜î[ˆz®X¹^khŽZK8  ¢ÆWfVÄÖöFÎ˜	žX¾[ØŽX{®Šinz©~iÊÎ‹ª¾8¢6Æ÷6TÆWfVÄÖöFÂ‚ž˜;ÞXXŽKùÞyYžYÊ€¢zˆ¾[Èþz+ÎŠ:k).XŠ®ûÈÎXú®iŠþKˆÞXhÞ[éî˜	žŠ:¢Š{Žy›ÎšþzK®8 ¢¢ð ¢6†÷tÆWfVÅWFö7B€¢6†&7FW#ÓÓ×Æ–W ¢ð¢‡Æ–W"æ–GÇÂ.KÚ"¢ ¢6†&7FW"æ–BÀ¢6†&7FW"æÆWfVÀ¢“° ¢Ð  ¢ò ¢)ˆRKúîjÚ>ûÈŽKéÞxZ~KÛþyJŽˆ^Y¹îZûÈÎ8ÎhÈžXØ~{I®y¨@¢i˜.X	žûÈÎKˆ®™Ú.š
ÞX8þjny¨NzØž{I®k).iÈž‹yþ‰p¢Z)îXª8ÞûÈžûÉ ¢KˆÞzêiÈžk).iÈžyÉþy¨NXØ~{I®ûÈ†ÆWfVÇ3ãûÈžûÈÀ¢˜;ÞYÎXú¾KˆjÊûÈÎšnKëþYÎjÚ^Z[ÞyºîX˜Þy¨NzØž{I ¢i[ŽZÙ~ûÈÎh‰iÊÎ[èŽKØîûÈŽh›îKˆÞX‹XX>{J[y»NhêP¢&WGW&îûÈžûÈÎk).iÈžXšþKÙÎyJŽ8 ¢¢ð ¢&Vg&W6„6†&7FW$fF$ÆWfVÇ2‚“°  ¢6fTvÖR‚“° ¢WFFUT’‚“° §Ð  ¦gVæ7F–öâ6Æ÷6TÆWfVÄÖöFÂ‚—° ¢B‚&ÆWfVÄÖöFÂ"¢æ6Æ74Æ—7@¢ç&VÖ÷fR‚'6†÷r"“° §Ð  ¢ò¢ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÐ¢)ˆR{i>š™~kXˆn˜XÐ£ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÐ ¢ŠhþjÎK©N8XZÞûÉ ¢U…XXŽ˜.XZ^X[yJŽ{i>š™~kûÈÀ¢KˆÞiÈ>h‹šÊ^Kˆ{YiÙþ[ˆz®X¹^XØ~{I®8 ¢xêžZënY¹îX‹K‹¾Yøî[èÎûÈÎˆz®ŠÎhÈž8ÎXˆn˜XÞ{i>š™~XÎ8Ð¢h¨®{i>š™~ky¨DU…Xˆn{ZnŠy.ˆ›.ûÈÀ¢h˜ÞiÈ>yÉþjÚ>Š{Žy›ÎXØ~{I®XŠNZé®8  ¢yºîX˜Þ˜®h‹.Š:YJþKˆi8iÈžZèÎi[NzØž{I¢þ[Îh
~{;¾{[y¨@¢Šy.ˆ›.iŠþK‹¾Šy.ûÈ‡Æ–W.ûÈÎK™þ[iŠþX›^Šy.i˜.˜Žy¨NXX>{JûÈž8 ¢kNh‹Z:¾ûÈþš*Ž[É>h˜¾yºîX˜ÞXú®iÈžŠ9ÞX)žjÈNûÈÀ¢[	®iÊ®iÈžxÚŽz¸¾zØž{I®{;¾{[¢ûÈŽŠhþjÎK¨ÎiÈžŠ‹¾iˆî8ÎZI®Šy.ˆ›.YÎi˜.h‹šÊ^8ÞiŠþiÊ®KènX©þˆ;ÞûÈžûÈÀ¢h˜Kº^Xˆn˜XÞhÈž˜‰^XXŽXú®™h¾iKî{ZnK‹¾Šy.ûÈÀ¢X[nšIŽŠy.ˆ›.šþzK®8Î[	®iÊ®™h¾iKî8Þ8  £ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÒ¢ð ¦ÆWBW‡Fö7EF–ÖW#ÖçVÆÃ°  ¦gVæ7F–öâ6†÷tW‡Fö7B†Ö÷VçB—° ¢6öç7BFö7BÐ¢B‚&W‡Fö7B"“°  ¢–b‚Fö7B—°¢&WGW&ã°¢Ð  ¢Fö7BçFW‡D6öçFVçBÐ¢.xÛ.[ér"°¢Ö÷VçB°¢$U…ûÈŽ[{.ZÙŽXZ^{i>š™~kûÈ’#°  ¢Fö7Bæ6Æ74Æ—7BæFB€¢'6†÷r ¢“°  ¢6ÆV%F–ÖV÷WB€¢W‡Fö7EF–ÖW ¢“°  ¢W‡Fö7EF–ÖW"Ð¢6WEF–ÖV÷WB‚‚“Óç° ¢Fö7Bæ6Æ74Æ—7Bç&VÖ÷fR€¢'6†÷r ¢“° ¢ÒÃ#c“° §Ð  ¦ÆWBÆWfVÅWFö7EF–ÖW#ÖçVÆÃ°  ¢ò ¢)ˆRikZ)îûÈŽKéÞxZ~KÛþyJŽˆ^Šhk.ûÈÎ8ÎXØ~{I®y¨Ni˜.X	¢XúþKº^‹{>X{®KˆX¾Šˆ®hþjnûÈÎšþzK¥……ŽXØ~X‹…Ž{I®8ÞûÈžûÉ ¢‹y÷6†÷tW‡Fö7B‚žYÎKˆZY~Zú¾k9^ûÈÎ™Ùî™‹¾ik~8¢ˆz®X¹^khŽZKûÈÎKˆÞ™ÈŠhxêžZënhÈžz+®Zé®8 ¢¢ð ¦gVæ7F–öâ6†÷tÆWfVÅWFö7B†6†&7FW$æÖRÆÆWfVÂ—° ¢6öç7BFö7CÐ¢B‚&ÆWfVÅWFö7B"“°  ¢–b‚Fö7B—°¢&WGW&ã°¢Ð  ¢Fö7BçFW‡D6öçFVçCÐ¢6†&7FW$æÖR°¢.XØ~X‹"°¢ÆWfVÂ°¢.{I®ûÈ#°  ¢Fö7Bæ6Æ74Æ—7BæFB€¢'6†÷r ¢“°  ¢6ÆV%F–ÖV÷WB€¢ÆWfVÅWFö7EF–ÖW ¢“°  ¢ÆWfVÅWFö7EF–ÖW#Ð¢6WEF–ÖV÷WB‚‚“Óç° ¢Fö7Bæ6Æ74Æ—7Bç&VÖ÷fR€¢'6†÷r ¢“° ¢ÒÃ#c“° §Ð  ¢ò ¢)ˆRikZ)îûÈŽKéÞxZ~KÛþyJŽˆ^Y¹îZûÈÎ8ÎhÈžXØ~{I®y¨@¢i˜.X	žûÈÎKˆ®™Ú.š
ÞX8þjny¨NzØž{I®k).iÈž‹yþ‰~Z)îXª8ÞûÈžûÉ ¢Xú®i»NikŠy.ˆ›.[ØŽz©~š
ÞX8þ˜*>XZžX¾zØž{I®ih~ZÙ~ûÈÀ¢KˆÞ˜xÞyZ¾i[NX¾[ØŽz©~XZ~ZëžûÈŽ˜xÞyZ¾i[NX¾[ØŽz©p¢–ææW$…DÔÎiÈ>h¨®xêžZënjÚ>YÊŽyÈ¾y¨NXˆnš(	N(	@¢Kè¾Zh.{i>š™~kXˆn˜XÞiÊÎ‹ª¾(	N(	NKˆ‹[~kI~hèžûÈÀ¢K˜¾X˜Þ‰™^yn8Îˆz®X¹^h‹šÊ^ŠŠÞZé®‹{>X{®z›®y›Ð¢h¨ˆ;Þš8Þ[iŠþYÎKˆzŠæ'V~ûÈÎ˜	žŠ:iKžyJ€¢˜yÞ[Þh
~i»NikûÈÎZèžXZŽ[èŽZI®ûÈž8  ¢Šy.ˆ›.[ØŽz©~k).™h¾‰~y¨Ni˜.X	žûÈÂB‚žiÈ>h›îKˆÞX‹ ¢[Þhx––N8y»NhêW&WGW&îûÈÎYÎXú¾˜	žX¾X{Þ[Èð¢KˆÞiÈ>X{®˜ÊþûÈÎXúþKº^iKî[ø>YÊ†6†V6´ÆWfVÅW‚¢Š:xJj)ÞK»nYÎXú¾8 ¢¢ð ¦gVæ7F–öâ&Vg&W6„6†&7FW$fF$ÆWfVÇ2‚—°¢vWDW†—7F–æu'G”–æFW†W2‚’æf÷$V6‚†–æFWƒÓç°¢6öç7BÆWfVÄVÃÒB‚&6†&7FW$fF$ÆWfVÂ"¶–æFW‚“°¢6öç7B6†&7FW#ÖvWE'G”6†&7FW$'”–æFW‚†–æFW‚“°¢–b†ÆWfVÄVÂbb6†&7FW"—°¢ÆWfVÄVÂçFW‡D6öçFVçCÒ$Çbâ"¶6†&7FW"æÆWfVÃ°¢Ð¢Ò“° §Ð  ¢ò¢ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÐ¢)ˆRK‹¾YøîKÉhþûÈŽXXÞ‹+¾Y¹îk»ô…õ5ûÈ ¢K˜¾X˜Þh¨®8Îh‹šÊ^X¹ÞXŠ’þXØ~{I®ˆz®X¹^Š9Îk»ô…858Þh»þhèžK˜¾[èÎûÈÀ¢‰z^kNyJŽZèÎ[k).iÈžX[nK¹nY¹îŠh˜¾jë^K¨nûÈÀ¢˜®h‹.Š:yºîX˜ÞK™þ˜(Nk).iÈžyÉþjÚ>y¨NYXn[©rþ˜y[š>{;¾{[¢XúþKº^‹+~ik‰z^kNûÈŽ8Î˜y[š>8ÞyºîX˜ÞXú®iŠþˆ8ÎXÈ^YJîX{®i˜.y¨NšþzK®ih~ZÙ~ûÈÀ¢k).iÈžyÉþy¨NŠ*¾Š‰Ž˜ÈN8K™þk).YËikžˆ«ûÈž8  ¢XXŽyJŽiÈYjî{INy¨Nikž[ÈþŠ9ÎKˆ®˜	žX¾{Ë®Xú>ûÉ ¢Y¹îK‹¾YøîXúþKº^XXÞ‹+¾KÉhþûÈÎy»Nhê^Y¹îk»ô…õ5ûÈÀ¢KˆÞ™ÈŠh‰z^kN8KˆÞ™ÈŠh˜y[š>8 ¢K˜¾[èÎZh.iéÎŠhX®yÉþjÚ>y¨NYXn[©~{;¾{[ûÈÀ¢˜	žX¾X{Þ[ÈþXúþKº^XhÞi;NXX^h‰ni»þhù¾hèž8 £ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÒ¢ð ¢ò¢ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÐ¢)ˆRK‹¾Yøî{INih~ZÙ~˜ŽYjî(	N(	NX[yJŽ[ØŽX{®Šinz©p£ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÒ¢ð ¦ÆWB†öÖTfVGW&T&÷'&÷vVDVÆVÖVçCÐ¢çVÆÃ° ¦ÆWB†öÖTfVGW&T&÷'&÷vVE&VçCÐ¢çVÆÃ° ¦ÆWB†öÖTfVGW&T&÷'&÷vVDæW‡E6–&Æ–æsÐ¢çVÆÃ° ¢ò ¢)ˆRikZ)îûÈŽKéÞxZ~KÛþyJŽˆ^Šhk.ûÈÎŠy.ˆ›.Šinz©~™«‰xð¢X	þ˜.Kènš™Ú.Š:ZI®šIŽy¨NzêÞš
ÞXˆ~hù¾XØZ®ûÈžûÉ ¢Š‰ŽKØþ˜	žjÊX	þš™Ú.˜.Kèni˜.ûÈÎšnh˜¾™«‰xþK¨nY:®KˆX°¢8Î)xŠy.ˆ›.YÞ)kn8Þy¨NXØZ®ûÈÇ&W7F÷&T&÷'&÷vVDVÆVÖVçB‚¢jÛŽKØÞi˜.Šh‹*‹*Îh¨®Zè>y¨NšþzK®x¸hX¾h.[êžY¹îKènûÈÀ¢KˆÞxKnXˆ~‹[K˜¾[èÎûÈÎ˜*>X¾š™Ú.YjîxÚŽŠ*¾KÛþyJŽi˜ ¢ûÈŽKè¾Zh.K˜¾[èÎXúþˆ;Þ˜(NiÈžX[nK¹nX	þyJŽZNišþûÈžiÈ0¢Kˆy»N{jÞhÈ™«‰xþ8h›îKˆÞY¹îKèn8 ¢¢ð ¦ÆWB†öÖTfVGW&T†–FFVå7v—F6„6&CÐ¢çVÆÃ°  ¢ò ¢)ˆRikZ)îûÈŽKéÞxZ~KÛþyJŽˆ^Šhk.ûÈÎK‹¾Yøîz¸¾{š®™ªŽj™ð¢Xˆ~hù¾ûÈžûÉ®XZž[Ë^YÉf&6ScNXZ~[XÎûÈÎjøþjÊ˜.XZ^K‹¾Yøà¢š™Ú.i˜.ûÈ‡6†÷uvR‚žŠ:YÎXú¾ûÈÎŠh¾Kˆ¾™Ú ¢6†÷t†öÖU÷'G&—B‚žy¨NYÎXú¾›¹îûÈž™ªŽj™þhÉKˆ[ËP¢šþzK®ûÈÎKˆÞiŠþh‹šÊ^yJŽy¨NŠy.ˆ›.XÚx˜~YÉnûÈÎiŠþšÞZI`¢k©nX)žy¨Nz¸¾{š®8 ¢¢ð ¢ò¢ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÐ¢cƒ’(	BK»¾X¹žK¸¾™Ú.[ŽyJŽh˜¾Xº.jŠ[Èð¢K»¾X¹žKÛþyJ‚7VW7EF$&öG’KÙÎx+®YJþKˆXZ~[B67&öÆÂ÷væW.8 ¢˜®h‹.iÈZIn[NXéþiÊÂF÷V6‚Ö7F–öã¦æöæ^ûÈÎYºjÚNXú®YÊŽK»¾X¹žŠinz©p¢™h¾YYþiÉþ™i>iKîŠÂâ×žûÉ¾KˆÞikZ)âF÷V6‚÷ö–çFW"Æ—7FVæW.8 £ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÒ¢ð¦gVæ7F–öâ6WEVW7EF÷V6„ÖöFR†7F—fR—° ¢°¢Fö7VÖVçBæFö7VÖVçDVÆVÖVçBÀ¢Fö7VÖVçBæ&öG’À¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&vÖR×f–Ww÷'B"’À¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&vÖR×7FvR"¢Òæf÷$V6‚†gVæ7F–öâ†VÆVÖVçB—° ¢–b‚VÆVÖVçB—°¢&WGW&ã°¢Ð ¢VÆVÖVçBæ6Æ74Æ—7BçFövvÆR€¢'VW7B×67&öÆÂÖ7F—fR"À¢7F—fP¢“° ¢Ò“° §Ð  ¦gVæ7F–öâ÷Vä†öÖTfVGW&R‡G—R—° ¢6öç7BÖöFÃÐ¢B‚&†öÖTfVGW&TÖöFÂ"“° ¢6öç7BF—FÆTVÃÐ¢B‚&†öÖTfVGW&TÖöFÅF—FÆR"“° ¢6öç7B&öG”VÃÐ¢B‚&†öÖTfVGW&TÖöFÄ&öG’"“°  ¢–b€¢ÖöFÂÇÀ¢F—FÆTVÂÇÀ¢&öG”VÀ¢—°¢&WGW&ã°¢Ð  ¢6Æ÷6T†öÖTfVGW&R‚“°  ¢–b‡G—SÓÓÒ'&W7B"—° ¢F—FÆTVÂçFW‡D6öçFVçCÐ¢.K‹¾YøîKÉhò#° ¢ò ¢)ˆRKúîjÚ>ûÈŽKéÞxZ~KÛþyJŽˆ^Y¹îZûÈÎ8Î[zh
 ¢š™Ú.hÈžˆz®X¹^h‹šÊ^‹{>X{®z›®y›Þh¨ˆ;Þš™Ú.8ÞûÈÀ¢‹ûÞiú^[èÎy›ÎxûîYÎKˆX¶'V~X[nZún[Û™ûþKˆžX°¢YËikžûÈÎ˜	žŠ:šnKëþKˆ‹[~KúîhèžûÈžûÉ ¢˜	žX¾XˆniJþXú®YÎXú¶&÷'&÷tVÆVÖVçD–çFôÖöFÂ‚¢h¨¦†öÖU&W7D6&NX	þ˜.KènûÈÎ[éîKènk).iÈ¢kˆ^z›®˜æ&öG”VÎiÊÎ‹ª¾y¨F–ææW$…DÔÎ8 ¢Zh.iéÎ8ÎKˆ®KˆjÊ8Þ™h¾y¨NiŠþyJ†–ææW$…DÔÃÐ¢i[Një^‰8¾hèžy¨NšîYè¾ûÈŽKè¾Zh.8ÎŠy.ˆ›.8Þ(	N(	@¢Š:™Ú.iÈžš
ÞX8þXˆ~hù¾X‰~8XˆnšhÈž˜‰^8¢6†&7FW%F$6öçFVçNûÈžûÈÎ˜*>K©¾jéŽyY¢…DÔÎiÈ>Kˆy»NyYžYÊ†&öG”VÎŠ:ûÈÎ˜	žjÊX	þKè`¢y¨NXZ~ZëžXú®iŠþ8ÎXª8ÞYÊŽ[èÎ™Ú.ûÈÎKˆÞiŠð¢8ÎXùnKº>8ÞûÈÎxêžZëniÈ>yÈ¾X‹Kˆ®KˆjÊy¨Nˆˆ ¢yZ¾™Ú.XÚYÊŽiÈKˆ®™Ú.8ikXZ~ZëžŠ*¾hêŽX‹ ¢Kˆ¾™Ú.yÈ¾KˆÞX‹ûÈŽŠhk»îX¹^[èŽZI®h˜ÞyÈ¾[é~X‹ûÈÀ¢yI®ˆ{>yÈ¾‹[~KènX8þi[NX¾z›®y›ÞûÈÎYºx+®Šy.ˆ› ¢š˜*>X¶6†&7FW%F$6öçFVçNiÊÎ‹ª°¢Yºx+®8ÎXˆnšš¹Ž[ªnŠhKˆˆ{N8Þy¨N™Èk.ûÈÀ¢KùÞyYžK¨nKˆX¾Y»®Zé®y¨FÖ–âÖ†V–v‡NûÈÀ¢z›®‰~y¨Ni˜.X	žyÈ¾‹[~Kèn[iŠþKˆZJ~Z ¢z›®y›ÞjnjnûÈž8  ¢Kúîk9^ûÉ®‹yþX[nK¹nyJ†–ææW$…DÔÃÞi[Një^‰8¾hè¢y¨NXˆniJþKˆjŠ>ûÈÎXXŽkˆ^z›¦&öG”VÎûÈÎKùÞŠØ¢jøþjÊ™h¾Šinz©~˜;ÞiŠþK›îkzŽy¨N‹[~›¹îûÈÎKˆÞzê¢Kˆ®KˆjÊ™h¾y¨NiŠþK¸›«ÎšîYè¾8 ¢¢ð ¢&öG”VÂæ–ææW$…DÔÃÐ¢"#° ¢&÷'&÷tVÆVÖVçD–çFôÖöFÂ€¢B‚&†öÖU&W7D6&B"’À¢&öG”VÀ¢“° ¢Ð¢VÇ6R–b‡G—SÓÓÒ&W‡ööÂ"—° ¢F—FÆTVÂçFW‡D6öçFVçCÐ¢.{i>š™~kXˆn˜XÒ#° ¢ò ¢)ˆRKúîjÚ>ûÉ®‹yþKˆ®™Ú.8ÎK‹¾YøîKÉhþ8ÞYÎKˆX°¢'V~8YÎKˆX¾Kúîk9^ûÈÎXXŽkˆ^z›¦&öG”VÎ8 ¢¢ð ¢&öG”VÂæ–ææW$…DÔÃÐ¢"#° ¢&÷'&÷tVÆVÖVçD–çFôÖöFÂ€¢B‚&†öÖTW‡ööÄ6&B"’À¢&öG”VÀ¢“° ¢Ð¢VÇ6R–b‡G—SÓÓÒ'6†÷"—° ¢F—FÆTVÂçFW‡D6öçFVçCÐ¢.YXn[©r#° ¢&öG”VÂæ–ææW$…DÔÃÐ¢&VæFW%6†÷6öçFVçB‚“° ¢Ð¢VÇ6R–b‡G—SÓÓÒ&6†&7FW""—° ¢F—FÆTVÂçFW‡D6öçFVçCÐ¢.Šy.ˆ›"#°  ¢ò ¢)ˆRikZ)îûÉ®Šy.ˆ›.š™Ú.XZ~ZëžjùN‹È>ZI ¢ûÈŽX	þ˜.Kèny¨Ni[NšXZ~ZëžûÈžûÈÎZY~yJŽXªZúÀ¢jŠ>[ÈþûÈÆ6Æ÷6T†öÖTfVGW&R‚ž™yÎ™hži˜ ¢iÈ>ˆz®X¹^h»þhèžûÈÎKˆÞ[Û™ûþX[nK¹nKˆˆŠÎZJ~[ð¢y¨NŠinz©~8 ¢¢ð ¢6öç7B&÷ƒÐ ¢ÖöFÂçVW'•6VÆV7F÷"€¢"æ†öÖRÖfVGW&RÖÖöFÂÖ&÷‚ ¢“°  ¢–b†&÷‚—° ¢&÷‚æ6Æ74Æ—7BæFB€¢'v–FR ¢“° ¢Ð  ¢ò ¢)ˆRKúîjÚ>ûÈŽKéÞxZ~KÛþyJŽˆ^Šhk.ûÈÎŠinz©~Šh¢iKîZJ~X‹hê^‹ùk»þx˜ŽûÈžûÉ®XZ~[NŠinz©~Šè®h‰ ¢g~K˜¾[èÎûÈÎZIn[N˜î{ÚžûÈ‚æ†öÖRÖfVGW&RÐ¢ÖöFÎûÈžiÊÎ‹ª¾˜(NiÈ“#Žy¨GFF–æ~ûÈÀ¢iÈ>Šé>XZ~[NŠinz©~‹h^X{®‰ê.[™^8yJ.yIþkN[›0¢hÛ.X¹^8.˜	žŠ:šnKëþh¨®ZIn[N˜î{Úžy¨GFF–æp¢K™þiKnhèžûÈÎXZž[NKˆ‹[~‰™^ynh˜ÞiÈ>yÉþy¨N‹+Î›Ø ¢‰ê.[™^˜(®{z>8 ¢¢ð ¢ÖöFÂæ6Æ74Æ—7BæFB€¢&æò×FF–ær ¢“°  ¢&öG”VÂæ–ææW$…DÔÃÐ¢&VæFW$6†&7FW%6†÷v66T6öçFVçB‚“°  ¢ò ¢)ˆRKúîjÚ>ûÉ®š	ŠŠÞKˆh™>™h¾[˜ŽzÊÎKˆŠy.ˆ›.8¢šþzK®ˆ;ÞX©¾XÎXˆnš(	N(	NiKžYÎXú°¢6VÆV7D6†&7FW$f÷%F'2ƒžˆÎKˆÞiŠð¢y»NhêW7v—F6„6†&7FW%F"‚'7FGW2"žûÈÀ¢˜	žjŠ>KˆžX¾š™Ú.y¨NŠy.ˆ›.x¸hX¾[éîKˆ™h¾Zx°¢[iŠþYÎjÚ^y¨NûÈÎKˆÞyJŽzØžxêžZënˆz®[{›¹îKˆjÊ¢š
ÞX8þh˜Þ[Þ›Ø®8 ¢¢ð ¢6VÆV7D6†&7FW$f÷%F'2€¢ ¢“° ¢7v—F6„6†&7FW%F"€¢'7FGW2 ¢“° ¢–b‡v–æF÷rç7–æ46†&7FW%F÷V6„ÖöFR—°¢v–æF÷rç7–æ46†&7FW%F÷V6„ÖöFR‚“°¢Ð ¢Ð¢VÇ6R–b‡G—SÓÓÒ&f÷&ÖF–öâ"—°¢F—FÆTVÂçFW‡D6öçFVçCÒ.KØŽ™š2#°¢&öG”VÂæ–ææW$…DÔÃÐ¢G—Vöbv–æF÷rçdf—†VE&VæFW$ÆÇ”f÷&ÖF–öä6öçFVçCÓÓÒ&gVæ7F–öâ ¢òv–æF÷rçdf—†VE&VæFW$ÆÇ”f÷&ÖF–öä6öçFVçB‚¢¢"#°¢Ð¢VÇ6R–b‡G—SÓÓÒ&öffÆ–æTW‡"—° ¢F—FÆTVÂçFW‡D6öçFVçCÐ¢.™º.{y®{i>š™r#° ¢&öG”VÂæ–ææW$…DÔÃÐ¢&VæFW$öffÆ–æTW‡6öçFVçB‚“° ¢Ð¢VÇ6R–b‡G—SÓÓÒ'VW7B"—° ¢F—FÆTVÂçFW‡D6öçFVçCÐ¢.K»¾X¹’#° ¢ò ¢cƒžûÉ®K»¾X¹žKˆÞXhÞk+þyJŽYXn[©~y¨NKˆˆŠÂ&÷rö'WGFöâx˜ŽYè¾8 ¢Xú®YÊŽK»¾X¹ž™h¾YYþiÉþ™i>ZY~yJŽ[ŽyJ‚ÖöFÂ{Yjx¾ˆˆ~h˜¾Xº.jŠ[Èþ8 ¢¢ð¢ÖöFÂæ6Æ74Æ—7BæFB€¢'VW7BÖÖöFR ¢“° ¢6WEVW7EF÷V6„ÖöFR€¢G'VP¢“° ¢Vç7W&TF–Ç•VW7G47W'&VçB‚“° ¢F–Ç•VW7E7FFRç&öw&W72æ6†V6¶–ãÐ¢° ¢&öG”VÂæ–ææW$…DÔÃÐ¢&VæFW%VW7EF$6öçFVçB€¢&F–Ç’ ¢“° ¢Ð¢VÇ6R–b‡G—SÓÓÒ&&W7F–'’"—° ¢F—FÆTVÂçFW‡D6öçFVçCÐ¢.YÉn™#° ¢&öG”VÂæ–ææW$…DÔÃÐ¢&VæFW$&W7F–'”6öçFVçB‚“° ¢Ð¢VÇ6R–b‡G—SÓÓÒ&6†–WfVÖVçB"—° ¢F—FÆTVÂçFW‡D6öçFVçCÐ¢.h‰[#° ¢&öG”VÂæ–ææW$…DÔÃÐ¢&VæFW$6†–WfVÖVçD6öçFVçB‚“° ¢Ð¢VÇ6R–b‡G—SÓÓÒ&ææ÷Væ6VÖVçB"—° ¢F—FÆTVÂçFW‡D6öçFVçCÐ¢.XZÎY¢#° ¢&öG”VÂæ–ææW$…DÔÃÐ¢&VæFW$ææ÷Væ6VÖVçD6öçFVçB‚“° ¢Ð¢VÇ6R–b‡G—SÓÓÒ'7—7FVÒ"—° ¢F—FÆTVÂçFW‡D6öçFVçCÐ¢.{;¾{[#° ¢&öG”VÂæ–ææW$…DÔÃÐ¢&VæFW%7—7FVÔ6öçFVçB‚“° ¢Ð¢VÇ6R–b‡G—SÓÓÒ&WFô&GFÆU6WGF–æw2"—° ¢ò ¢)ˆRikZ)îûÈŽKéÞxZ~KÛþyJŽˆ^Šhk.ûÈÎ8Îˆz®X¹P¢h‹šÊ^iKî˜.Kˆ¾™Ú.[îŠkÞX‰~ûÈÎhÈžKˆ¾Xë¾‹{>X{ ¢ŠŠÞZé®Šinz©~8ÞûÈžûÉ ¢XéþiÊÂ6WFô&GFÆU6WGF–æw5æVÀ¢˜*>ZY~iŠþˆz®[{YÉþk9^xXž˜»Îzéw÷6—F–öã ¢f—†VN[ª~j‰ž8XúnZIni
ÎX‹Fö7VÖVçBæ&öG¢[©^Kˆ¾šþzK®ûÈÎx›Þkh–&GFÆUv^y¨@¢F—7Æ“¦æöæ^8ŠÎXZ~jŠ>[ÈþŠhn‰8¾zØ¢Z[Þ[›î[NYXþšÎûÈÎiú^ŠØž[èÎ[iŠþ˜	žKˆi[NZYp¢ˆz®Šˆ.Zé®KØÞ˜(þ‹ÊþiÊÎ‹ª¾Zëži‰>YÊŽ8ÎKˆÞYÊ€¢h‹šÊ^KŠÞ8Þy¨Nh8^Z(>X{®˜ÊþûÈÎh˜ÞiÈ>iÈ¢8ÎhÈžKˆ¾Xë¾k).XøÞhxž8Þy¨Nx¸k88  ¢˜	žŠ:KˆÞKúî˜*>ZY~ˆˆ®˜(þ‹ÊþûÈÎˆÎiŠþy»NhêP¢iKžyJŽi[NX¾˜®h‹.X[yJŽ8[{.{i>š™~ŠØž˜à¢[èŽZI®jÊ˜;ÞjÚ>[‹Ž˜¾KÙÎy¨@¢÷Vä†öÖTfVGW&R‚ž[ØŽz©~{;¾{[(	N(	@¢X	þyJŽYÎKˆX²6WFô&GFÆU6WGF–æw5æVÀ¢ûÈŽjÈNKØÒþKˆ¾h¸ž˜ŽYjîZèÎXZŽKˆÞyJŽ˜xÞX®ûÈžûÈÀ¢KØnyJ†&÷'&÷tVÆVÖVçD–çFôÖöFÂ‚¢Zî˜.˜	žX¾[ØŽz©~y¨F&öGžûÈÎ‹yþ8ÎKÉhþ8Ð¢8Î{i>š™~kXˆn˜XÞ8ÞyJŽy¨NiŠþYÎKˆh¹¾ûÈÀ¢KˆÞXhÞ™ÈŠhˆz®[{zé~[ª~j‰ž8ˆz®[{zê¢¢Ö–æFWŽ8 ¢¢ð ¢F—FÆTVÂçFW‡D6öçFVçCÐ¢.ˆz®X¹^h‹šÊ^ŠŠÞZé¢#°  ¢ò ¢)ˆRKúîjÚ>ûÈŽKéÞxZ~KÛþyJŽˆ^Y¹îZûÈÎ8Î[zh
 ¢š™Ú.hÈžˆz®X¹^h‹šÊ^‹{>X{®z›®y›Þh¨ˆ;Þš™Ú.8ÞûÈžûÉ ¢yÉþjÚ>XéþYºh›îX‹K¨n(	N(	N˜	žX¾XˆniJþ[éîš
ÞX‹[à¢Xú®yJ†&÷'&÷tVÆVÖVçD–çFôÖöFÂ‚žh¨ ¢WFô&GFÆU6WGF–æw5æVÎX	þ˜.KènûÈÀ¢[éîKènk).kˆ^z›®˜æ&öG”VÎiÊÎ‹ª¾y¨F–ææW$…DÔÎ8 ¢Zh.iéÎKˆ®KˆjÊ™h¾y¨NiŠþ8ÎŠy.ˆ›.8ÞûÈŽyJ€¢–ææW$…DÔÃÞi[Një^‰8¾hèžûÈÎŠ:™Ú.iÈžš
ÞX8ð¢Xˆ~hù¾X‰~8XˆnšhÈž˜‰^8¢6†&7FW%F$6öçFVçNûÈžûÈÆ6Æ÷6T†öÖTfVGW&R‚¢Xú®iÈ>h¨®8ÎX	þ‹[y¨NZÙš™Ú.8ÞûÈŽKè¾Zh ¢6¶–ÆÅv^ûÈžjÛŽKØÞûÈÎKŠnKˆÞiÈ>kˆ^hè¢&öG”VÂæ–ææW$…DÔÎiÊÎ‹ª¾˜*>[N(	N(	N˜*>[@¢Šy.ˆ›.šy¨NZInjëÎûÈŽš
ÞX8ò¾XˆnšhÈž˜‰R°¢KˆX¾Yºx+®8ÎXˆnšŠhzØžš¹Ž8ÞˆÎKùÞyY¢Y»®Zé®š¹Ž[ªny¨Nz›¦6†&7FW%F$6öçFVçNûÈ¢iÈ>Kˆy»NXÚYÊ†&öG”VÎŠ:ûÈÎ˜	žjÊX	þKèny¨@¢ŠŠÞZé®™Ú.iÛþXú®iŠþ8ÎXª8ÞYÊŽZè>[èÎ™Ú.ûÈÀ¢KˆÞiŠþ8ÎXùnKº>8ÞZè>8.xêžZënyÈ¾X‹y¨N[iŠð¢KÛþyJŽˆ^hŠ®YÉn˜*>jŠ>ûÉ®Kˆ®™Ú.˜(NiŠþŠy.ˆ›.šy¨@¢XˆnšhÈž˜‰^ûÈÎKˆ¾™Ú.KˆZJ~Z®z›®y›ÞûÈŽ˜*>X°¢z›®y¨F6†&7FW%F$6öçFVçNûÈžûÈÀ¢ŠŠÞZé®™Ú.iÛþiÊÎ‹ª¾X[nZún˜(NYÊŽûÈÎXú®iŠþŠ*°¢hêŽX‹i»NKˆ¾™Ú.ûÈÎyZ¾™Ú.Kˆ®ZèÎXZŽyÈ¾KˆÞX‹8  ¢‹yþ8ÎK‹¾YøîKÉhþ8Þ8Î{i>š™~kXˆn˜XÞ8Ð¢YÎKˆX¶'V~8YÎKˆX¾Kúîk9^ûÉ®XXŽkˆ^z› ¢&öG”VÎûÈÎKùÞŠØžjøþjÊ™h¾Šinz©~˜;ÞiŠþK›îkz€¢‹[~›¹î8 ¢¢ð ¢&öG”VÂæ–ææW$…DÔÃÐ¢"#°  ¢6öç7BæVÃÐ¢B‚&WFô&GFÆU6WGF–æw5æVÂ"“°  ¢–b‡æVÂ—° ¢ò ¢)ˆRKúîjÚ>ûÈŽKéÞxZ~KÛþyJŽˆ^Y¹îZûÈÎ8Î˜	žK©°¢hÈž˜‰^˜;Þk).XøÞhxž8ÞûÈ¾8ÎŠŠÞZé®š™Ú.™ÚKˆ®™Ú ¢[èŽ˜iÎ8ÞûÈžûÉ ¢yÉþjÚ>y¨NXéþYºh›îX‹K¨n(	N(	NKˆ®™Ú.˜	žjë^Xú ¢kˆ^hèž8ÎŠÎXZ~8ÞZé®KØÞjŠ>[ÈþûÈÎKØ`¢6WFô&GFÆU6WGF–æw5æVÎ˜	žX°¢XX>{JiÊÎ‹ª¾y¨D5526Æ70¢ûÈ‚æWFò×6WGF–æw2ÖW‡æFVNûÈ¢Zú¾jÛ¾K¨g÷6—F–öã¦'6öÇWF^ûÉ°¢F÷£ûÉ¶ÆVgC£ûÉ·&–v‡C£ûÉ°¢†V–v‡C£3cŽûÉ·¢Ö–æFWƒ£“€¢ûÈŽXéþiÊÎiŠþŠŠÞŠˆŽ{Zf&GFÆUv^Š:¢8Î‰8¾YÊŽŠy.ˆ›.XÚx˜ÎKˆ®™Ú.8Þ˜*>zŠîyJŽk9^ûÈž8 ¢ŠÎXZ~jŠ>[Èþkˆ^h‰".K˜¾[èÎûÈÎxþŠkÞYšŽiÈ0¢fÆÆ&6¾Y¹î˜	žX¶6Æ7>iÊÎ‹ª¾y¨NŠŠÞZé®ûÈÀ¢zØžikÎ™Ú.iÛþ˜(NiŠ÷÷6—F–öã¦'6öÇWF^ûÈÀ¢ˆÎK‰NYºx+¢æ†öÖRÖfVGW&RÖÖöFÂÖ&÷€¢k).iÈžŠŠ×÷6—F–öîûÈÎiÈ‹ùy¨N8Î[{.Zé®KØÐ¢zYnXXŽ8ÞŠè®h‰æ†öÖRÖfVGW&RÖÖöFÀ¢iÊÎ‹ª¾ûÈ‡÷6—F–öã¦f—†VC¶–ç6WC£ûÈžûÈÀ¢™Ú.iÛþ[iÈ>i[NX¾‹+Î›Ø®˜*>X¾XZŽ‰ê.[™^˜î{Ú¢y¨N[znKˆ®Šy.(	N(	N˜	ž[iŠþ8Î™ÚKˆ®™Ú.[èŽ˜iÎ8Ð¢y¨NXéþYºûÉ¾YÊ…6×7Vær'&÷w6W.˜	žšà¢h˜¾j™þxþŠkÞYšŽKˆ®ûÈÎ˜	žzŠî8Ç÷6—F–öã ¢'6öÇWF^˜>X{®š	iÉþy¨Nhé.x˜ŽKØÞ{Úî8Ð¢˜(N[‹Ž[‹ŽKËN™ªŽ›¹îi8®[ª~j‰ž[ÞKˆÞk©nûÈŽ[
NX[`¢{k.YØX‰~k¹X{¢þk¹XZ^8Šinz©~š¹Ž[ªnkZîX¹P¢y¨Ni˜.X	žûÈžûÈÎ˜	ž[iŠþ8ÎhÈž˜‰^˜;Þk).XøÞhxž8Ð¢y¨NXéþYº8  ¢˜	žŠ:KˆÞˆ;ÞXú®kˆ^ŠÎXZ~jŠ>[ÈþûÈÎŠh8Îiˆîz+ ¢‰8¾hèž8Ö6Æ7>iÊÎ‹ª¾y¨NŠŠÞZé®ûÉ®iKžh‰ ¢÷6—F–öã§7FF–>8†V–v‡C¦WFþûÈÀ¢Šé>™Ú.iÛþyÉþy¨NY¹îX‹6†öÖTfVGW&TÖöFÄ&öG¢y¨NjÚ>[‹Žih~K»nkXŠ:™Ú.ûÈÎ‹yþ8ÎKÉhþ8Ð¢8Î{i>š™~kXˆn˜XÞ8Þ˜*>K©¾KˆjŠ>jÚ>[‹ŽšþzK®8¢jÚ>[‹ŽY>[é~X‹›¹îi8®K¨¾K»n8 ¢¢ð ¢æVÂç7G–ÆRç÷6—F–öãÐ¢'7FF–2#° ¢æVÂç7G–ÆRçF÷Ð¢"#° ¢æVÂç7G–ÆRæÆVgCÐ¢"#° ¢æVÂç7G–ÆRç&–v‡CÐ¢"#° ¢æVÂç7G–ÆRæ&÷GFöÓÐ¢"#° ¢æVÂç7G–ÆRæ†V–v‡CÐ¢&WFò#° ¢æVÂç7G–ÆRç¤–æFWƒÐ¢"#° ¢æVÂç7G–ÆRæÖ„†V–v‡CÐ¢"#° ¢æVÂæ6Æ74Æ—7Bç&VÖ÷fR€¢&fÆöF–ærÖÖöFÂ ¢“°  ¢&÷'&÷tVÆVÖVçD–çFôÖöFÂ€¢æVÂÀ¢&öG”VÀ¢“°  ¢æVÂç7G–ÆRæF—7Æ“Ð¢&fÆW‚#° ¢Ð  ¢ò ¢)ˆRKúîjÚ>ûÈŽKéÞxZ~KÛþyJŽˆ^iÈikŠhk.ûÈÎ8Îx+®K¸›«ÎiÈži˜.X	¢ˆz®X¹^h‹šÊ^ŠŠÞZé®š™Ú.[èŽ{ÚîKŠÞûÈÎiÈži˜.X	ž[èŽ™ÚKˆ¾™Ú.ûÈÎ˜;Þh¨ ¢Zè>Y»®Zé®{ÚîKŠÞûÉ¾h¨®i[NX¾š™Ú.iKîZJ~Šé>ih~ZÙ~˜;Þˆ;ÞZî˜.Xë¾ûÈÀ¢KˆÞŠhŠé>K¹nhÛ.X¹^8ÞûÈžûÉ ¢˜	žŠ:XéþiÊÎKéÞxZ~i»NizžKˆ‹Ê®y¨NŠhk.XªK¨fFö6²Ö&÷GFöÞjŠ>[Èð¢ûÈŽh‹šÊ^KŠÞŠé>Šinz©~‹+Î›Ø®yZ¾™Ú.Kˆ¾{z>y¨Nh‹šÊ^‹8~Šˆ®jnûÈžûÈÎ˜	žjÚ>iŠð¢8ÎiÈži˜.X	ž{ÚîKŠÞ8iÈži˜.X	ž™ÚKˆ¾™Ú.8Þy¨NXéþYº(	N(	Nh‹šÊ^KŠÞ‹+Î[©^8¢KˆÞYÊŽh‹šÊ^KŠÞ{ÚîKŠÞûÈÎXZžzŠîx¸hX¾KªNi»þX{®xûî8.KÛþyJŽˆ^xûîYÊ€¢iˆîz+®Šhk.8Î˜;ÞY»®Zé®{ÚîKŠÞ8ÞûÈÎiKžh‰ZèÎXZŽKˆÞXhÞXªFö6²Ö&÷GFöÐ¢˜	žX¶6Æ7>ûÈÎKˆÞzêYÊŽKˆÞYÊŽh‹šÊ^KŠÞ˜;Þ{jÞhÈ¢æ†öÖRÖfVGW&RÖÖöFÎš	ŠŠÞy¨N{ÚîKŠÞšþzK®8  ¢YÎi˜.h¨®Šinz©~iÊÎ‹ª¾ûÈ‚æ†öÖRÖfVGW&RÖÖöFÂÖ&÷ŽûÈžy¨@¢Ö‚Ö†V–v‡NiKîZúÎX‹“fGfŽûÈŽXéþiÊÎh‹šÊ^KŠÞXú®iÈ“ƒGfŽûÈÀ¢™Ùîh‹šÊ^KŠÞ[{.{i>iŠó“fGfŽûÈÎ˜	žŠ:{[Kˆh‰KˆÞXˆnh8^Z(>˜;ÞyJ€¢“fGfŽûÈžûÈÎyº˜xþŠé>XZ~ZëžKˆjÊ[ˆ;ÞZèÎi[NšþzK®8KˆÞyJŽhÛ.X¹^8 ¢¢ð ¢6öç7B6WGF–æw4&÷ƒÐ¢ÖöFÂçVW'•6VÆV7F÷"€¢"æ†öÖRÖfVGW&RÖÖöFÂÖ&÷‚ ¢“°  ¢–b‡6WGF–æw4&÷‚—° ¢6WGF–æw4&÷‚ç7G–ÆRç6WE&÷W'G’€¢&Ö‚Ö†V–v‡B"À¢#“fGf‚"À¢&–×÷'FçB ¢“° ¢Ð  ¢6öç7B6†&7FW%6VÆV7CÐ¢B‚&WFõ6WGF–æw46†&7FW%6VÆV7B"“°  ¢–b†6†&7FW%6VÆV7B—° ¢6öç7B÷F–öãÐ¢B‚&WFõ6WGF–æw46†$÷F–öã"“°  ¢–b†÷F–öã—° ¢÷F–öãçFW‡D6öçFVçCÐ ¢Æ–W"æ–GÇÀ¢.Šy.ˆ›##° ¢Ð  ¢6öç7B÷F–öãÐ¢B‚&WFõ6WGF–æw46†$÷F–öã"“°  ¢–b†÷F–öã—° ¢÷F–öãçFW‡D6öçFVçCÐ ¢Æ–W# ¢ð¢Æ–W#"æ–@¢ ¢.Šy.ˆ›#.ûÈŽ[	®iÊ®X›^[»®ûÈ’#°  ¢÷F–öãæF—6&ÆVCÐ¢Æ–W##° ¢Ð ¢6öç7B÷F–öã#Ð¢B‚&WFõ6WGF–æw46†$÷F–öã""“° ¢–b†÷F–öã"—°¢÷F–öã"çFW‡D6öçFVçCÐ¢Æ–W#0¢òÆ–W#2æ–@¢¢.Šy.ˆ›#>ûÈŽ[	®iÊ®X›^[»®ûÈ’#°¢÷F–öã"æF—6&ÆVCÒÆ–W#3°¢Ð  ¢6†&7FW%6VÆV7BçfÇVSÒ##° ¢Ð  ¢7v—F6„WFõ6WGF–æw46†&7FW"€¢G'VP¢“° ¢Ð  ¢ÖöFÂæ6Æ74Æ—7BæFB€¢'6†÷r ¢“° §Ð  ¦gVæ7F–öâ&÷'&÷tVÆVÖVçD–çFôÖöFÂ€¢VÆVÖVçBÀ¢&öG”VÀ¢—° ¢–b‚VÆVÖVçB—°¢&WGW&ã°¢Ð  ¢†öÖTfVGW&T&÷'&÷vVDVÆVÖVçCÐ¢VÆVÖVçC° ¢†öÖTfVGW&T&÷'&÷vVE&VçCÐ¢VÆVÖVçBç&VçDæöFS° ¢†öÖTfVGW&T&÷'&÷vVDæW‡E6–&Æ–æsÐ¢VÆVÖVçBææW‡E6–&Æ–æs°  ¢&öG”VÂæVæD6†–ÆB€¢VÆVÖVç@¢“°  ¢VÆVÖVçBç7G–ÆRæF—7Æ“Ð¢&&Æö6²#° §Ð  ¢ò ¢)ˆRKúîjÚ>ûÈŽKéÞxZ~KÛþyJŽˆ^Šhk.ûÈÎŠy.ˆ›.š™Ú.Šhˆ;Ð¢YÊŽYÎKˆX¾Šinz©~Š:Xˆ~hù¾XˆnšûÈžûÉ ¢h¨®8ÎX	þKèny¨NXX>{JjÛŽKØÞ8Þ˜	žjë^˜(þ‹Êþh«Þh‰xÚŽz¸°¢X{Þ[ÈþûÈÆ6Æ÷6T†öÖTfVGW&R‚žûÈŽi[NX¾™yÎŠinz©~ûÈ¢‹y÷7v—F6„6†&7FW%F"‚žûÈŽXú®iŠþhù¾KˆX°¢Xˆnš8Šinz©~˜(N™h¾‰~ûÈž˜;ÞŠhyJŽX‹YÎKˆZY~jÛŽKØÐ¢˜(þ‹ÊþûÈÎKˆÞŠh˜xÞŠH~Zú¾XZžjÊ8 ¢¢ð ¦gVæ7F–öâ&W7F÷&T&÷'&÷vVDVÆVÖVçB‚—° ¢ò ¢)ˆRikZ)îûÉ®XXŽh¨®Xúþˆ;ÞŠ*¾™«‰xþy¨NzêÞš
ÞXˆ~hù°¢XØZ®h.[êžšþzK®ûÈÎKˆÞzê˜	žjÊX	þy¨NiŠþY:®X°¢š™Ú.ûÈÎ˜;ÞŠhXXŽ‰™^ynûÈÎ‹yö†öÖTfVGW&T&÷'&÷vVDVÆVÖVç@¢iŠþKˆÞiŠöçVÆÎxJ™yÎûÈŽxÚŽz¸¾y¨NKˆK»Þx¸hX¾ûÈž8 ¢¢ð ¢–b††öÖTfVGW&T†–FFVå7v—F6„6&B—° ¢†öÖTfVGW&T†–FFVå7v—F6„6&Bç7G–ÆRæF—7Æ“Ð¢"#°  ¢†öÖTfVGW&T†–FFVå7v—F6„6&CÐ¢çVÆÃ° ¢Ð  ¢–b‚†öÖTfVGW&T&÷'&÷vVDVÆVÖVçB—°¢&WGW&ã°¢Ð  ¢†öÖTfVGW&T&÷'&÷vVDVÆVÖVçBç7G–ÆRæF—7Æ“Ð¢&æöæR#°  ¢–b€¢†öÖTfVGW&T&÷'&÷vVDæW‡E6–&Æ–ærb`¢†öÖTfVGW&T&÷'&÷vVDæW‡E6–&Æ–ærç&VçDæöFSÓÓÐ¢†öÖTfVGW&T&÷'&÷vVE&Vç@¢—° ¢†öÖTfVGW&T&÷'&÷vVE&VçBæ–ç6W'D&Vf÷&R€¢†öÖTfVGW&T&÷'&÷vVDVÆVÖVçBÀ¢†öÖTfVGW&T&÷'&÷vVDæW‡E6–&Æ–æp¢“° ¢Ð¢VÇ6R–b††öÖTfVGW&T&÷'&÷vVE&VçB—° ¢†öÖTfVGW&T&÷'&÷vVE&VçBæVæD6†–ÆB€¢†öÖTfVGW&T&÷'&÷vVDVÆVÖVç@¢“° ¢Ð  ¢†öÖTfVGW&T&÷'&÷vVDVÆVÖVçCÐ¢çVÆÃ° ¢†öÖTfVGW&T&÷'&÷vVE&VçCÐ¢çVÆÃ° ¢†öÖTfVGW&T&÷'&÷vVDæW‡E6–&Æ–æsÐ¢çVÆÃ° §Ð  ¦gVæ7F–öâ6Æ÷6T†öÖTfVGW&R‚—° ¢6öç7BÖöFÃÐ¢B‚&†öÖTfVGW&TÖöFÂ"“° ¢6öç7B&VÆV6UWFFSÐ¢v–æF÷räf÷W%7–Ö&öÇ5&VÆV6UWFFS° ¢–b€¢&VÆV6UWFFRb`¢G—Vöb&VÆV6UWFFRç6†÷VÆE&WfVçE6†&VDÖöFÄ6Æ÷6SÓÓÒ&gVæ7F–öâ"b`¢&VÆV6UWFFRç6†÷VÆE&WfVçE6†&VDÖöFÄ6Æ÷6R‚¢—°¢–b‡G—Vöb&VÆV6UWFFRæææ÷Væ6Tf÷&6VDÆö6³ÓÓÒ&gVæ7F–öâ"—°¢&VÆV6UWFFRæææ÷Væ6Tf÷&6VDÆö6²‚“°¢Ð¢&WGW&âfÇ6S°¢Ð ¢–b€¢&VÆV6UWFFRb`¢G—Vöb&VÆV6UWFFRæöå6†&VDÖöFÄ6Æ÷6VCÓÓÒ&gVæ7F–öâ ¢—°¢&VÆV6UWFFRæöå6†&VDÖöFÄ6Æ÷6VB‚“°¢Ð  ¢–b†ÖöFÂ—° ¢ÖöFÂæ6Æ74Æ—7Bç&VÖ÷fR€¢'6†÷r ¢“°  ¢ò ¢)ˆRikZ)îûÉ®™yÎ™hžŠinz©~i˜.ûÈÎZh.iéÎZY~yJŽ˜à¢8ÎŠy.ˆ›.š™Ú.yJŽy¨NXªZúÎjŠ>[Èþ8ÞûÈÎKˆKÛP¢h»þhèžûÈÎKˆÞiÈ>[Û™ûþKˆ¾jÊ™h¾YXn[©rþK»¾X¹¢˜	žzŠîKˆˆŠÎZJ~[þy¨NŠinz©~8 ¢¢ð ¢6öç7B&÷ƒÐ ¢ÖöFÂçVW'•6VÆV7F÷"€¢"æ†öÖRÖfVGW&RÖÖöFÂÖ&÷‚ ¢“°  ¢–b†&÷‚—° ¢&÷‚æ6Æ74Æ—7Bç&VÖ÷fR€¢'v–FR ¢“° ¢Ð  ¢ò ¢)ˆRikZ)îûÉ®‹yþKˆ®™Ú.Xªv–F^iŠþYÎKˆ{XNûÈÀ¢™yÎ™hžŠinz©~i˜.ZIn[N˜î{Úžy¨Fæò×FF–æp¢K™þŠhKˆKÛ^h»þhèž8 ¢¢ð ¢ÖöFÂæ6Æ74Æ—7Bç&VÖ÷fR€¢&æò×FF–ær ¢“°  ¢ò ¢)ˆRikZ)îûÉ®‹yöæò×FF–æ~YÎKˆ{XNiKn[î(	N(	@¢ˆz®X¹^h‹šÊ^ŠŠÞZé®Šinz©~yJŽy¨FFö6²Ö&÷GFöÐ¢ûÈŽ‹+Î[©^šþzK®ûÈžK™þŠhKˆKÛ^h»þhèžûÈÎKˆÞiÈ0¢Šé>Kˆ¾jÊ™h¾YXn[©rþK»¾X¹ž˜	žzŠîKˆˆŠÎ{ÚîKŠÐ¢Šinz©~Š*¾ŠªNZY~yJŽ‹+Î[©^jŠ>[Èþ8 ¢¢ð ¢ÖöFÂæ6Æ74Æ—7Bç&VÖ÷fR€¢&Fö6²Ö&÷GFöÒ ¢“° ¢ò¢cƒžûÉ®K»¾X¹ž[ŽyJŽx˜ŽYè¾ˆˆ~zYn[Bâ×’Xú®YÊŽK»¾X¹ž™h¾YYþi˜.ZÙŽYÊŽ8"¢ð¢ÖöFÂæ6Æ74Æ—7Bç&VÖ÷fR€¢'VW7BÖÖöFR ¢“° ¢Ð ¢6WEVW7EF÷V6„ÖöFR€¢fÇ6P¢“°  ¢ò ¢)ˆRikZ)îûÉ®‹y÷v–FRöæò×FF–æ~iŠþYÎKˆ{X@¢iKn[îX¹^KÙÎûÈÎ™yÎ™hžŠinz©~i˜.h¨®ûÉþhÈž˜‰^˜xÞ{ÚîY¹à¢™«‰xþûÈÎ˜þXXÞKˆ¾jÊ™h¾YXn[©rþK»¾X¹ž˜	žzŠîKˆˆŠÀ¢Šinz©~i˜.jéŽyYžšþzK®8 ¢¢ð ¢6öç7B†VÇ'FãÐ¢B‚'7FGW4†VÇ'WGFöâ"“°  ¢–b††VÇ'Fâ—° ¢†VÇ'Fâç7G–ÆRæF—7Æ“Ð¢&æöæR#° ¢Ð  ¢ò ¢)ˆRKúîjÚ>ûÈŽKéÞxZ~KÛþyJŽˆ^Y¹îZûÈÎ8Îˆz®X¹^h‹šÊ^y¨NjbââîZY~yJŽKŠ`¢iÉþ[è^hÈž˜‰^XhÞh‹šÊ^KŠÞjžiÊÎk).iÈžXøÞhxž8Þix˜(®˜*>[Ë^hŠ®YÉnûÈÀ¢8ÎXZŽ[Îh
~h¨ˆ;Þš	ŠkÞ8ÞhÈž˜‰^X{®xûîYÊŽˆz®X¹^h‹šÊ^ŠŠÞZé®Šinz©~Kˆ®ûÈžûÉ ¢‹yþKˆ®™Ú'7FGW4†VÇ'WGFöîYÎKˆX¶'V~8kÈþK¨nYÎKˆX¾YËik¢k).˜xÞ{Úî(	N(	G6¶–ÆÅ&Wf–Wt†VFW$'WGFöîXú®iÈžYÊ€¢7v—F6„6†&7FW%F"‚žŠ:Š*¾ŠŠÞh‰šþzK¢þ™«‰xþûÈÎXú®ŠhxêžZë`¢˜.˜îKˆjÊŠy.ˆ›.Šinz©~y¨N8Îh¨ˆ;Þ8ÞXˆnšûÈÎ˜	žšnhÈž˜‰^y¨@¢–æÆ–æR7G–ÆRæF—7ÆžiÈ>XÎYÊ‚&–æÆ–æRÖ&Æö6².ûÈÀ¢K˜¾[èÎKˆÞzê™h¾K¸›«ÎŠinz©~ûÈŽˆz®X¹^h‹šÊ^ŠŠÞZé®8YXn[©~8K»¾X¹ž(
n(
nûÈ¢˜;ÞiÈ>jéŽyYžšþzK®ûÈÎYºx+®Xˆ~Xˆnš‹yþ™yÎŠinz©~iŠþXZžj)ÞKˆÞYÎ‹zþ[éûÈÀ¢™yÎŠinz©~˜*>˜(®XéþiÊÎk).iÈž˜xÞ{ÚîX‹Zè>8.˜	žŠ:Š9ÎKˆ®‹yð¢7FGW4†VÇ'WGFöîKˆjŠ>y¨NiKn[î˜xÞ{Úî8 ¢¢ð ¢6öç7B6¶–ÆÅ&Wf–Wt'FãÐ¢B‚'6¶–ÆÅ&Wf–Wt†VFW$'WGFöâ"“°  ¢–b‡6¶–ÆÅ&Wf–Wt'Fâ—° ¢6¶–ÆÅ&Wf–Wt'Fâç7G–ÆRæF—7Æ“Ð¢&æöæR#° ¢Ð  ¢&W7F÷&T&÷'&÷vVDVÆVÖVçB‚“° ¢–b‡v–æF÷rç7–æ46†&7FW%F÷V6„ÖöFR—°¢v–æF÷rç7–æ46†&7FW%F÷V6„ÖöFR‚“°¢Ð §Ð  ¢ò ¢)ˆRikZ)îûÈŽKéÞxZ~KÛþyJŽˆ^Šhk.ûÈÎŠy.ˆ›.š™Ú.i[NY€¢Š9ÞX)’þˆ;ÞX©¾XÂþh¨ˆ;ÞKˆžX¾XˆnšûÈžûÉ ¢‹yö&÷'&÷tVÆVÖVçD–çFôÖöFÂ‚žiŠþYÎKˆh¹¾ûÈÀ¢Xú®iŠþ˜	žjÊX	þy¨NiŠþi[NX¾ˆ8ÎXÈRþx¸hX²þh¨ˆ;Þš™Ú ¢ûÈŽiÊÎKèn[ZÙŽYÊŽ8[{.{i>kŠÎŠšnzšžZé®y¨NZèÎi[Nš™Ú.ûÈÀ¢KˆÞiŠþ˜xÞZú¾KˆZY~iky¨NûÈžûÈÎZî˜.Šy.ˆ›.Šinz©~Š:y¨@¢66†&7FW%F$6öçFVçNZëžYšŽXéþYËšþzK®8  ¢Xˆ~hù¾Xˆnši˜.ûÈÎXXŽh¨®8ÎKˆ®KˆX¾XˆnšX	þ‹[y¨@¢š™Ú.8ÞjÛŽKØÞûÈÎXhÞX	þiky¨Nš™Ú.˜.Kèn(	N(	@¢YÎKˆi˜.™i>Xú®iÈ>iÈžKˆX¾š™Ú.Š*¾X	þ‹[ûÈÎKˆÞiÈ0¢XZžX¾Xˆnšy¨NXZ~Zëžyh®YÊŽKˆ‹[~8 ¢¢ð ¢ò ¢)ˆRikZ)îûÈŽKéÞxZ~KÛþyJŽˆ^Šhk.ûÈÎ8ÎKˆ®™Ú.š
ÞX8ð¢jžiÊÎk).XøÞhxž8Þ(	N(	N˜	žX¾YXþšÎiŠþyÉþy¨NûÈÎK˜¾X˜Ð¢š
ÞX8þy¨Föæ6Æ–6¾Xú®iŠþXˆ~hù¾XˆnšûÈÎZèÎXZŽk).iÈ¢yÉþy¨NXˆ~hù¾Šy.ˆ›.ûÈžûÉ ¢›¹îš
ÞX8þi˜.ûÈÎh¨®x¸hX²þˆ8ÎXÈRþh¨ˆ;ÞKˆžX¾š™Ú ¢YNˆz®y¨N8ÎyºîX˜ÞjÚ>YÊŽyÈ¾Y:®X¾Šy.ˆ›.8Þx¸hX°¢KˆjÊXZŽ˜:ŽŠŠÞh‰YÎKˆX¾Šy.ˆ›.ûÈÎKŠnYÎXú¾KˆžX°¢š™Ú.YNˆz®y¨NyZ¾™Ú.i»NikX{Þ[Èþ(	N(	NKˆÞzêxêžZë`¢xûîYÊŽjÚ>YÊŽyÈ¾Y:®X¾XˆnšûÈÎXˆ~Z[ÞK˜¾[èÎyZ¾™Ú ¢˜;ÞiŠþ[Þy¨NûÈÎKˆÞyJŽzØžxêžZënˆz®[{XhÞ›¹îKˆjÊ¢Xˆnšh˜Þi»Nik8  ¢KˆžX¾š™Ú.yJŽy¨Nx¸hX¾Šè®i[ŽjÎ[ÈþKˆÞKˆjŠ0¢ûÈ‡7FGW46†&7FW$–æFW‚ð¢–çfVçF÷'”6†&7FW$–æFWŽiŠóh‰cy¨Ni[ŽZÙ~ûÈÀ¢7W'&VçE6¶–ÆÄ6†&7FW.iŠò&f—&R.ûÈð¢'Æ–W#".˜	žzŠîZÙ~K‹.ûÈžûÈÎ˜	žŠ:YNˆz®‹Øžhù°¢h‰[Þy¨NjÎ[ÈþXhÞ‹:nXÎûÈÎKˆÞiŠþKˆžX¾˜;Þˆ;ÞX[yJ€¢YÎKˆX¾i[ŽZÙ~8 ¢¢ð ¦gVæ7F–öâ6VÆV7D6†&7FW$f÷%F'2‡F&vWD–æFW‚—° ¢6öç7BF&vWD6†&7FW#Ð¢vWE'G”6†&7FW$'”–æFW‚‡F&vWD–æFW‚“° ¢–b‚F&vWD6†&7FW"—°¢&WGW&ã°¢Ð  ¢7FGW46†&7FW$–æFWƒÐ¢F&vWD–æFWƒ° ¢ö&¦V7Bæ¶W—2€¢VæF–æu7FG0¢’æf÷$V6‚€¢7FCÓç° ¢VæF–æu7FG5·7FEÓÐ¢° ¢Ð¢“° ¢WFFU7FGW5&Wf–Wr‚“°  ¢–çfVçF÷'”6†&7FW$–æFWƒÐ¢F&vWD–æFWƒ° ¢&VæFW$–çfVçF÷'’‚“°  ¢7W'&VçE6¶–ÆÄ6†&7FW#Ð¢vWE'G”6†&7FW$¶W’‡F&vWD–æFW‚“° ¢&VæFW%6¶–ÆÄÆöF÷WB‚“°  ¢ò ¢)ˆRŠé>Š*¾˜ŽKŠÞy¨Nš
ÞX8þiÈžŠinŠk®Kˆ®y¨NXØXŠP¢ûÈŽKè¾Zh.ZInYÈŽŠè®KªîûÈžûÈÎxêžZënh˜ÞyÈ¾[é~X{®Kè`¢yºîX˜Þ˜Žy¨NiŠþY:®KˆX¾Šy.ˆ›.8 ¢¢ð ¢³ÃÃ%Òæf÷$V6‚€¢“Óç° ¢6öç7BfF$VÃÐ¢B‚&6†&7FW$fF""¶’“°  ¢–b†fF$VÂ—°¢6öç7B6VÆV7FVCÖ“ÓÓ×F&vWD–æFWƒ°¢fF$VÂç7G–ÆRæ÷6—G“×6VÆV7FVBò#"¢"ãR#°¢fF$VÂæ6Æ74Æ—7BçFövvÆR‚&—2Ö7W'&VçBÖ6†&7FW""Ç6VÆV7FVB“°¢6öç7B6†ö–6SÖfF$VÂæ6Æ÷6W7B‚"æ6†&7FW"×6†÷v66RÖ6†ö–6R"“°¢–b†6†ö–6R—²6†ö–6Ræ6Æ74Æ—7BçFövvÆR‚&—2Ö7W'&VçBÖ6†&7FW""Ç6VÆV7FVB“²Ð¢Ð ¢Ð¢“° §Ð  ¦gVæ7F–öâ7v—F6„6†&7FW%F"‡F$æÖR—° ¢&W7F÷&T&÷'&÷vVDVÆVÖVçB‚“°  ¢ò ¢)ˆRikZ)îûÈŽKéÞxZ~KÛþyJŽˆ^Šhk.ûÈÎ8Î‹ùNY¹îjnj`¢ix˜(®ZI®KˆX¾ûÉþhÈž˜‰^8ÞûÈÎXú®YÊŽˆ;ÞX©¾XÎXˆnš¢šþzK®ûÈžûÉ ¢jøþjÊXˆ~Xˆnš˜;Þ˜xÞikXŠNik~KˆjÊûÈÎXˆ~X‹ ¢'7FGW2.h˜ÞšþzK®ûÈÎXˆ~X‹X[nK¹nXˆnš¢ûÈŽ{i>š™~kXˆn˜XÒþh¨ˆ;Òþˆ8ÎXÈ^ûÈžˆz®X¹^™«‰xþûÈÀ¢KˆÞyJŽYÊŽjøþX¾XˆnšYNˆz®‰™^yn8 ¢¢ð ¢6öç7B†VÇ'FãÐ¢B‚'7FGW4†VÇ'WGFöâ"“°  ¢–b††VÇ'Fâ—° ¢†VÇ'Fâç7G–ÆRæF—7Æ“Ð ¢F$æÖSÓÓÒ'7FGW2 ¢ð¢&–æÆ–æRÖ&Æö6² ¢ ¢&æöæR#° ¢Ð  ¢ò ¢)ˆRikZ)îûÈŽKéÞxZ~KÛþyJŽˆ^Šhk.ûÈÎ8ÎXZŽh¨ˆ;Þš	ŠkÐ¢ih~ZÙ~hÈž˜‰^ûÈÎhxžŠ›.iKîYÊŽh¨ˆ;Þš™Ú.y¨N‹ùNY¹à¢Kˆ¾™Ú.8ÞûÈžûÉ ¢‹y÷7FGW4†VÇ'WGFöîYÎKˆZY~˜(þ‹ÊþûÈÎXú®iÈ¢Xˆ~X‹8Îh¨ˆ;Þ8ÞXˆnšh˜ÞšþzK®ûÈÎX[nK¹nXˆnš¢ˆz®X¹^™«‰xþ8 ¢¢ð ¢6öç7B6¶–ÆÅ&Wf–Wt'FãÐ¢B‚'6¶–ÆÅ&Wf–Wt†VFW$'WGFöâ"“°  ¢–b‡6¶–ÆÅ&Wf–Wt'Fâ—° ¢6¶–ÆÅ&Wf–Wt'Fâç7G–ÆRæF—7Æ“Ð ¢F$æÖSÓÓÒ'6¶–ÆÂ ¢ð¢&–æÆ–æRÖ&Æö6² ¢ ¢&æöæR#° ¢Ð  ¢6öç7B6öçF–æW#Ð¢B‚&6†&7FW%F$6öçFVçB"“°  ¢–b‚6öçF–æW"—°¢&WGW&ã°¢Ð  ¢6öç7BvT–DÖ×°¢7FGW3¢'7FGW5vR"À¢–çfVçF÷'“¢&–çfVçF÷'•vR"À¢6¶–ÆÃ¢'6¶–ÆÅvR"À¢W‡ööÃ¢&†öÖTW‡ööÄ6&B ¢Ó°  ¢6öç7BvTVÃÐ¢B€¢vT–DÖ·F$æÖUÐ¢“°  ¢–b‚vTVÂ—°¢&WGW&ã°¢Ð  ¢&÷'&÷tVÆVÖVçD–çFôÖöFÂ€¢vTVÂÀ¢6öçF–æW ¢“° ¢–b‡v–æF÷rçcs„Ç”6†&7FW$–çfVçF÷'”Æ–÷WB—°¢v–æF÷rçcs„Ç”6†&7FW$–çfVçF÷'”Æ–÷WB‚“°¢Ð  ¢ò ¢)ˆRikZ)îûÈŽKéÞxZ~KÛþyJŽˆ^Šhk.ûÈÎ8ÎKˆ®™Ú.[{.{i0¢XúþKº^Xˆ~hù¾Šy.ˆ›.K¨nûÈÎKˆ¾™Ú.zêÞš
Þ˜*>hé.h»þhèž8ÞûÈžûÉ ¢˜	žKˆžX¾š™Ú.YNˆz®XéþiÊÎ[iÈžy¨N8Î)xŠy.ˆ›.YÞ)kn8Ð¢zêÞš
ÞXˆ~hù¾XØZ®ûÈÎX	þ˜.Šy.ˆ›.Šinz©~K˜¾[èÎ‹yð¢Kˆ®ikžikXªy¨Nš
ÞX8þ˜Ži8~˜xÞŠH~K¨nûÈÎ˜	žŠ:h¨®Zè0¢™«‰xþhèž(	N(	NXú®YÊŽ8ÎX	þ˜.Šy.ˆ›.Šinz©~šþzK®8Ð¢˜	žX¾h8^Z(>™«‰xþûÈÎš™Ú.iÊÎ‹ª¾Zh.iéÎK˜¾[èÎŠ*°¢YjîxÚŽX	þyJŽYÊŽXŠ^y¨NYËikžûÈÎKˆÞXù~[Û™ûð¢ûÈŽYºx+®iŠþYÊŽX	þ˜.Kèn8z+®Zé®ŠhšþzK®y¨N˜	žX°¢i˜.™i>›¹îh˜Þ™«‰xþûÈÎKˆÞiŠþZú¾jÛ¾YÊŽš™Ú.iÊÎ‹ª°¢y¨D55>Kˆ®ûÈž8 ¢¢ð ¢6öç7B7v—F6„6&D–DÖ×°¢7FGW3¢'7FGW46†&7FW%7v—F6„6&B"À¢–çfVçF÷'“¢&–çfVçF÷'”6†&7FW%7v—F6„6&B"À¢6¶–ÆÃ¢'6¶–ÆÄ6†&7FW%7v—F6„6&B ¢Ó°  ¢6öç7B7v—F6„6&CÐ¢B€¢7v—F6„6&D–DÖ·F$æÖUÐ¢“°  ¢–b‡7v—F6„6&B—° ¢7v—F6„6&Bç7G–ÆRæF—7Æ“Ð¢&æöæR#°  ¢†öÖTfVGW&T†–FFVå7v—F6„6&CÐ¢7v—F6„6&C° ¢Ð  ¢ò ¢)ˆRšnKëþŠé>yºîX˜Þ˜ŽKŠÞy¨NXˆnšhÈž˜‰^iÈ¢ŠinŠk®Kˆ®y¨NXØXŠ^ûÈŽKè¾Zh.[©^ˆ›.XøÞy›ÞûÈžûÈÀ¢xêžZënh˜ÞyÈ¾[é~X{®KènyºîX˜ÞjÚ>YÊŽyÈ¾Y:®X¾Xˆnš8 ¢¢ð ¢²$W‡ööÂ"Â%7FGW2"Â%6¶–ÆÂ%Òæf÷$V6‚€¢æÖSÓç° ¢6öç7B'FãÐ¢B‚&6†&7FW%F$'Fâ"¶æÖR“°  ¢–b†'Fâ—° ¢'Fâç7G–ÆRæ÷6—G“Ð ¢æÖRçFôÆ÷vW$66R‚“ÓÓÐ¢F$æÖRçFôÆ÷vW$66R‚¢ð¢# ¢ ¢"ãSR#° ¢Ð ¢Ð¢“° §Ð  ¦gVæ7F–öâWFFTvöÆDF—7Æ’‚—° ¢6öç7BfÇVSÔÖF‚æÖ‚ƒÄÖF‚æfÆö÷"„çVÖ&W"†vöÆB—ÇÃ’“° ¢°¢B‚&†öÖTvöÆEfÇVR"’À¢B‚&–çfVçF÷'”vöÆEfÇVR"¢Òæf÷$V6‚†VÃÓç°¢–b†VÂ—°¢VÂçFW‡D6öçFVçC×fÇVRçFôÆö6ÆU7G&–ær‚'¦‚ÕEr"“°¢Ð¢Ò“° §Ð  ¢ò¢ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÐ¢)ˆRYXn[©p£ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÒ¢ð ¦gVæ7F–öâ&VæFW%6†÷6öçFVçB‚—° ¢6öç7B6&G3×6†÷—FV×2æÖ‡6†÷—FVÓÓç°¢6öç7B6÷VçCÖvWE÷F–öä6÷VçB‡6†÷—FVÒæ–B“°¢6öç7B&W6÷W&6TÆ&VÃ×6†÷—FVÒç&W6÷W&6SÓÓÒ&‡"ò$…"¢%5#°¢6öç7BVffV7EFW‡C×6†÷—FVÒç&V6÷fW'•W&6VçCãÓ ¢òY¹î[êžh˜iÈ’G·&W6÷W&6TÆ&VÇÖ ¢¢Y¹î[êžiÈZJrG·&W6÷W&6TÆ&VÇÞy¨BG·6†÷—FVÒç&V6÷fW'•W&6VçGÒV° ¢6öç7B†5&–6SÔçVÖ&W"æ—4f–æ—FR‡6†÷—FVÒç&–6R“°¢6öç7BF—6&ÆVCÒ†5&–6RÇÂvöÆCÇ6†÷—FVÒç&–6S°¢6öç7B'WGFöåFW‡CÒ†5&–6P¢ò.X;žjÎ[è^Zé¢ ¢¢G·6†÷—FVÒç&–6WÒ˜y[š6° ¢&WGW&â ¢ÆF—b6Æ73Ò'6†÷×÷F–öâÖ6&BG·6†÷—FVÒç&W6÷W&6WÒ#à¢ÆF—b6Æ73Ò'6†÷×÷F–öâÖ6&BÖ†VB#à¢Ç7â6Æ73Ò'6†÷×÷F–öâ×G—R#âG·&W6÷W&6TÆ&VÇÓÂ÷7ãà¢Ç7â6Æ73Ò'6†÷×÷F–öâ×7Fö6²#îhÈiÈ’G¶6÷VçGÓÂ÷7ãà¢ÂöF—cà¢ÆF—b6Æ73Ò'6†÷×÷F–öâÖæÖR#âG·6†÷—FVÒææÖWÓÂöF—cà¢ÆF—b6Æ73Ò'6†÷×÷F–öâÖVffV7B#âG¶VffV7EFW‡GÓÂöF—cà¢ÆF—b6Æ73Ò'6†÷×÷F–öâ×W&6†6R×&÷r#à¢ÆÆ&VÂf÷#Ò'6†÷VçF—G’ÒG·6†÷—FVÒæ–GÒ#îi[Ž˜xóÂöÆ&VÃà¢Æ–çW@¢–CÒ'6†÷VçF—G’ÒG·6†÷—FVÒæ–GÒ ¢6Æ73Ò'6†÷×÷F–öâ×VçF—G’ ¢G—SÒ&çVÖ&W" ¢–çWFÖöFSÒ&çVÖW&–2 ¢Ö–ãÒ# ¢ÖƒÒ#“““’ ¢7FWÒ# ¢fÇVSÒ# ¢à¢Æ'WGFöà¢6Æ73Ò&†öÖRÖfVGW&RÖ'W’Ö'Fâ6†÷×÷F–öâÖ'W’ ¢G¶F—6&ÆVBò&F—6&ÆVB"¢"'Ð¢öæ6Æ–6³Ò&'W•6†÷—FVÒ‚rG·6†÷—FVÒæ–GÒrÆFö7VÖVçBævWDVÆVÖVçD'”–B‚w6†÷VçF—G’ÒG·6†÷—FVÒæ–GÒr’çfÇVR’ ¢âG¶'WGFöåFW‡GÓÂö'WGFöãà¢ÂöF—cà¢ÂöF—cà¢°¢Ò’æ¦ö–â‚""“° ¢&WGW&â ¢ÆF—b6Æ73Ò'6†÷×÷F–öâÖ–çFW&f6R#à¢ÆF—b6Æ73Ò'6†÷×÷F–öâÖæ÷FR#îXú®‹*žYJâ…ûÈõ5Y¹î[êž‰z^kCÂöF—cà¢ÆF—b6Æ73Ò'6†÷×÷F–öâÖÆ—7B#âG¶6&G7ÓÂöF—cà¢ÂöF—cà¢°§Ð  ¦gVæ7F–öâ'W•6†÷—FVÒ†—FVÔ–BÇ&WVW7FVEVçF—G’—° ¢6öç7B6†÷—FVÓÖvWE÷F–öäFVf–æ—F–öâ†—FVÔ–B“° ¢–b‚6†÷—FVÒ—°¢&WGW&ã°¢Ð ¢–b‚çVÖ&W"æ—4f–æ—FR‡6†÷—FVÒç&–6R’—°¢ÆW'B‚.˜	žX¾‰z^kNy¨NX;žjÎ[	®iÊ®ŠŠÞZé®8""“°¢&WGW&ã°¢Ð ¢6öç7BVçF—G“ÔÖF‚æÖ‚€¢À¢ÖF‚æÖ–âƒ“““’ÄÖF‚æfÆö÷"„çVÖ&W"‡&WVW7FVEVçF—G’—ÇÃ’¢“° ¢6öç7BF÷FÅ&–6S×6†÷—FVÒç&–6R§VçF—G“° ¢–b†vöÆCÇF÷FÅ&–6R—°¢ÆW'B‚.˜y[š>KˆÞZJûÈÎiÊÎjÊ™ÈŠh"·F÷FÅ&–6RçFôÆö6ÆU7G&–ær‚'¦‚ÕEr"’²"˜y[š>8""“°¢&WGW&ã°¢Ð ¢–b‚FE÷F–öåFô–çfVçF÷'’†—FVÔ–BÇVçF—G’’—°¢ÆW'B‚.ˆ8ÎXÈ^[{.k»þûÈÎh‰nŠ›.‰z^kN[{.k).iÈžXúþyJŽy¨NZnyh®z›®™i>8""“°¢&WGW&ã°¢Ð ¢vöÆCÖvöÆB×F÷FÅ&–6S° ¢&V'V–ÆD–çfVçF÷'•6Æ÷G2‚“°¢WFFTvöÆDF—7Æ’‚“°¢6fTvÖR‚“° ¢6öç7B&öG”VÃÒB‚&†öÖTfVGW&TÖöFÄ&öG’"“° ¢–b†&öG”VÂ—°¢&öG”VÂæ–ææW$…DÔÃ×&VæFW%6†÷6öçFVçB‚“°¢Ð§Ð  ¢ò¢ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÐ¢)ˆRŠy.ˆ›.[^zK £ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÒ¢ð ¢ò ¢)ˆRKúîjÚ>ûÈŽKéÞxZ~KÛþyJŽˆ^Šhk.ûÈÎXø>ˆ>YÉn˜*>zŠà¢8ÎKˆ®™Ú.šþzK®[{.™h¾iKâþiÊ®™h¾iKîŠy.ˆ›.ûÈÎKˆ¾™Ú.Xˆ~hù°¢Š9ÞX)’þˆ;ÞX©¾XÂþh¨ˆ;Þ8Þy¨NŠy.ˆ›.š™Ú.ûÈžûÉ  ¢Kˆ®hé.ûÉ®Šy.ˆ›.š
ÞX8þjÎûÈÎ[{.X›^[»®y¨NŠy.ˆ›.šþzK ¢[Îh
~YÉnzK¢¾YÞz‹¾zØž{I®ûÈÎ˜(Nk).X›^[»®y¨NûÈŽyºîX˜Ð¢Xú®iÈžzÊÎK¨ÎŠy.ˆ›.˜	žX¾KØÞ{ÚîûÈžšþzK®˜énš
Ò¾Šz>˜é`¢j)ÞK»nûÈÎ›¹îKˆ¾Xë¾Zh.iéÎj)ÞK»n[{.{i>˜Nh‰[y»NhêP¢‹{>X{®X›^[»®Šinz©~8  ¢Kˆ¾hé.ûÉ®KˆžX¾hÈž˜‰^ûÈŽŠ9ÞX)’þˆ;ÞX©¾XÂþh¨ˆ;ÞûÈžûÈÀ¢y»Nhê^[îXë¾xûîh‰y¨Nˆ8ÎXÈRþx¸hX²þh¨ˆ;Þš™Ú.(	N(	@¢˜	žKˆžX¾š™Ú.iÊÎ‹ª¾[{.{i>iÈžŠy.ˆ›.Xˆ~hù¾zêÞš
Ð¢ûÈ†6†ævT–çfVçF÷'”6†&7FW"ð¢6†ævU7FGW46†&7FW"ð¢6†ævU6¶–ÆÄ6†&7FW$'&÷~ûÈžûÈÎKˆÞyJŽYÊ€¢˜	žŠ:˜xÞikX®KˆZY~Šy.ˆ›.Xˆ~hù¾˜(þ‹ÊþûÈÎy»Nhê^k+þyJ€¢xûîh‰8[{.{i>kŠÎŠšn˜îy¨Nš™Ú.[Z[Þ8 ¢¢ð ¦gVæ7F–öâ&VæFW$6†&7FW%6†÷v66T6öçFVçB‚—° ¢6öç7B6Æ÷G3Õ°¢Æ–W"À¢Æ–W#"À¢Æ–W#0¢Ó°  ¢ÆWB‡FÖÃÐ ¢sÆF—b7G–ÆSÒ&F—7Æ“¦fÆWƒ¶v£ƒ²r°¢v§W7F–g’Ö6öçFVçC¦6VçFW#¶Ö&v–âÖ&÷GFöÓ£‡ƒ²#âs°  ¢6Æ÷G2æf÷$V6‚€¢†6†&7FW"Ç6Æ÷D–æFW‚“Óç° ¢–b†6†&7FW"—°¢‡FÖÂ³Ð ¢sÆF—b6Æ73Ò&6†&7FW"×6†÷v66RÖ6†ö–6R"7G–ÆSÒ'v–GFƒ£ƒgƒ·FW‡BÖÆ–vã¦6VçFW#²r°¢v7W'6÷#§ö–çFW#²"öæ6Æ–6³Ò'6VÆV7D6†&7FW$f÷%F'2‚r°¢6Æ÷D–æFW‚°¢r“²#âr° ¢sÆF—b–CÒ&6†&7FW$fF"r°¢6Æ÷D–æFW‚°¢r"6Æ73Ò&6†&7FW"×6†÷v66RÖfF""7G–ÆSÒ'v–GFƒ£Sgƒ¶†V–v‡C£Sgƒ¶Ö&v–ã£WFó²r°¢v&÷&FW"×&F—W3£SS¶&6¶w&÷VæBÖ6öÆ÷#¢3S¶&6¶w&÷VæBÖ–ÖvS§W&Â…Ârr°¢vWD6†&7FW$'Gv÷&µF‚†6†&7FW"’°¢uÂr“¶&6¶w&÷VæB×6—¦S¦6÷fW#¶&6¶w&÷VæB×÷6—F–öã¦6VçFW"‚S²r°¢v&÷&FW#£'‚6öÆ–B6c#C#“¶F—7Æ“¦fÆWƒ¶Æ–vâÖ—FV×3¦6VçFW#²r°¢v§W7F–g’Ö6öçFVçC¦6VçFW#¶föçB×6—¦S£‡ƒ·G&ç6—F–öã¦÷6—G’ãW3²#âr°¢#ÂöF—câ"° ¢sÆF—b7G–ÆSÒ&föçB×6—¦S£ƒ¶föçB×vV–v‡C¦&öÆC¶Ö&v–â×F÷£'ƒ²r°¢wv†—FR×76S¦æ÷w&¶÷fW&fÆ÷s¦†–FFVã·FW‡BÖ÷fW&fÆ÷s¦VÆÆ—6—3²#âr°¢6†&7FW"æ–B°¢#ÂöF—câ"° ¢ò ¢)ˆRKúîjÚ>ûÈŽKéÞxZ~KÛþyJŽˆ^Y¹îZûÈÎ8ÎhÈžXØ~{I ¢y¨Ni˜.X	žûÈÎKˆ®™Ú.š
ÞX8þjny¨NzØž{I®k).iÈž‹yþ‰p¢Z)îXª8ÞûÈžûÉ ¢˜	žX¾zØž{I®ih~ZÙ~XéþiÊÎk).iÈ––NûÈÎ{IN{+žiŠð¢&VæFW$6†&7FW%6†÷v66T6öçFVçB‚¢{XNZÙ~K‹.i˜.y[nKˆ¾zé~Z[Þy»Nhê^Zú¾jÛ¾˜$…DÔÎûÈÀ¢˜	žX¾X{Þ[ÈþXú®iÈž8Îh™>™h¾Šy.ˆ›.[ØŽz©~˜*>KˆX‹¾8Ð¢iÈ>Š*¾YÎXú¾KˆjÊûÈÎK˜¾[èÎKˆÞzêzØž{I®hî›«ÎŠè ¢ûÈŽKè¾Zh.Xë¾{i>š™~kXˆn˜XÞš™Ú.hÈžXˆn˜XÞ8¢Šy.ˆ›.XØ~{I®K¨nûÈžûÈÎ˜	žjë^ZÙ~K‹.izž[[{.{i0¢˜yŽjÛ¾YÊŽyZ¾™Ú.Kˆ®ûÈÎk).iÈžK«®iÈ>XhÞY¹îKèni»Nik ¢Zè>(	N(	NKˆÞiŠþ‹8~iižk).zé~[ÞûÈÎiŠþyZ¾™Ú.jžiÊÀ¢k).Š*¾˜	®yú^Šh˜xÞyZ¾8  ¢XªKˆX¶–NûÈÎŠé66†V6´ÆWfVÅW‚žXØ~{I ¢y›ÎyIþy¨Ny[nKˆ¾XúþKº^y»Nhê^h›îX‹˜	žX¾XX>{J8¢Xú®i»Nik˜	žKˆ[þZ®ih~ZÙ~ûÈÎKˆÞyJŽ˜xÞyZ¾i[NX°¢[ØŽz©~ûÈŽ˜xÞyZ¾i[NX¾[ØŽz©~iÈ>h¨®xêžZënjÚ>YÊŽyÈ°¢y¨NXˆnšXZ~ZëžK™þKˆ‹[~kI~hèžûÈÎK˜¾X˜Þh˜ÞKúî˜à¢YÎKˆšîYè¾y¨F'V~ûÈž8 ¢¢ð ¢sÆF—b–CÒ&6†&7FW$fF$ÆWfVÂr°¢6Æ÷D–æFW‚°¢r"7G–ÆSÒ&föçB×6—¦S£ƒ¶6öÆ÷#¢6#6S†3²#âr°¢$Çbâ"¶6†&7FW"æÆWfVÂ°¢#ÂöF—câ"° ¢#ÂöF—câ#° ¢Ð¢VÇ6W° ¢6öç7BVÆ–v–&ÆSÐ¢6Æ÷D–æFWƒÓÓÓ¢òÆ–W"æÆWfVÃãÓ ¢¢—5F†—&D6†&7FW%VæÆö6¶VB‚“° ¢6öç7BVæÆö6µFW‡CÐ¢6Æ÷D–æFWƒÓÓÓ¢ò$ÇbãŠz>˜éb ¢¢.X˜ÞXZžYÞy¨bÇbãS#°  ¢‡FÖÂ³Ð ¢sÆF—b7G–ÆSÒ'v–GFƒ£cgƒ·FW‡BÖÆ–vã¦6VçFW#²r°¢v7W'6÷#§ö–çFW#¶÷6—G“¢r°¢†VÆ–v–&ÆSò##¢"ãSR"’°¢s²"öæ6Æ–6³Ò"r°¢€¢VÆ–v–&ÆP¢ð¢&6Æ÷6T†öÖTfVGW&R‚“¶÷Vä6†&7FW$7&VF–öâ‚"²‡6Æ÷D–æFW‚³’²"“² ¢ ¢" ¢’°¢r#âr° ¢sÆF—b7G–ÆSÒ'v–GFƒ£Cƒ¶†V–v‡C£Cƒ¶Ö&v–ã£WFó²r°¢v&÷&FW"×&F—W3£SS¶&6¶w&÷VæC¦Æ–æV"Öw&F–VçBƒcFVrÂ3#C3"Â3S“²r°¢v&÷&FW#£'‚F6†VB3†f6¶F—7Æ“¦fÆWƒ¶Æ–vâÖ—FV×3¦6VçFW#²r°¢v§W7F–g’Ö6öçFVçC¦6VçFW#¶föçB×6—¦S£gƒ²#âr°¢""°¢#ÂöF—câ"° ¢sÆF—b7G–ÆSÒ&föçB×6—¦S£ƒ¶föçB×vV–v‡C¦&öÆC¶Ö&v–â×F÷£'ƒ²r°¢v6öÆ÷#¢3†††²#âr°¢.iÊ®Šz>˜éb"°¢#ÂöF—câ"° ¢sÆF—b7G–ÆSÒ&föçB×6—¦S£ƒ¶6öÆ÷#¢3vfcV3²#âr°¢€¢VÆ–v–&ÆP¢ð¢.›¹îi8®X›^[»¢ ¢ ¢VæÆö6µFW‡@¢’°¢#ÂöF—câ"° ¢#ÂöF—câ#° ¢Ð ¢Ð¢“°  ¢‡FÖÂ³Ð¢#ÂöF—câ#°  ¢ò ¢)ˆRKúîjÚ>ûÈŽKéÞxZ~KÛþyJŽˆ^Šhk.ûÈÎ8ÎKˆÞiŠþŠhhÈžKˆ¾Xë°¢Xˆ~hù¾X‹XéþiÊÎš™Ú.ûÈÎiŠþŠhi[NYŽX‹YÎKˆX°¢yZ¾™Ú.Š:8ÞûÈžûÉ ¢XéþiÊÎ˜	žŠ:iŠþKˆžX¾8Î[îš8ÞhÈž˜‰^ûÈÎ›¹îKˆ¾Xë¾iÈ0¢™yÎhèž˜	žX¾Šinz©~8‹{>Xë¾ˆ8ÎXÈRþx¸hX²þh¨ˆ;Ð¢š™Ú.8.iKžh‰KˆžX¾8ÎXˆnš8ÞhÈž˜‰^ûÈÎ›¹îKˆ¾Xë°¢YÎXú·7v—F6„6†&7FW%F"‚ž(	N(	NKˆÞiÈ>™yÎhè¢Šinz©~ûÈÎiŠþh¨®[Þhxžš™Ú.y¨NXZ~Zëž8ÎX	þ8Þ˜ ¢66†&7FW%F$6öçFVçN˜	žX¾ZëžYšŽŠ:¢XéþYËšþzK®ûÈÎ‹yþK˜¾X˜ÞX	þyJŽK‹¾YøîKÉhòþ{i>š™~k ¢XÚx˜~iŠþYÎKˆh¹¾ûÈÎXú®iŠþ˜	žjÊX	þy¨NiŠþi[Nš8 ¢¢ð ¢‡FÖÂ³Ð ¢sÆF—b7G–ÆSÒ&F—7Æ“¦fÆWƒ¶v£gƒ¶Ö&v–âÖ&÷GFöÓ£gƒ²#âr° ¢sÆ'WGFöâ–CÒ&6†&7FW%F$'FäW‡ööÂ"6Æ73Ò&†öÖRÖfVGW&RÖ'W’Ö'Fâ"r°¢w7G–ÆSÒ&fÆWƒ£·FF–æs£‚gƒ¶föçB×6—¦S£‡ƒ¶Ö–âÖ†V–v‡C£S'ƒ²"r°¢vöæ6Æ–6³Ò'7v—F6„6†&7FW%F"…ÂvW‡ööÅÂr’#âr°¢.{i>š™~kXˆn˜XÒ"°¢#Âö'WGFöãâ"° ¢sÆ'WGFöâ–CÒ&6†&7FW%F$'Få7FGW2"6Æ73Ò&†öÖRÖfVGW&RÖ'W’Ö'Fâ"r°¢w7G–ÆSÒ&fÆWƒ£·FF–æs£‚gƒ¶föçB×6—¦S£‡ƒ¶Ö–âÖ†V–v‡C£S'ƒ²"r°¢vöæ6Æ–6³Ò'7v—F6„6†&7FW%F"…Âw7FGW5Âr’#âr°¢.ˆ;ÞX©¾XÂ"°¢#Âö'WGFöãâ"° ¢sÆ'WGFöâ–CÒ&6†&7FW%F$'Få6¶–ÆÂ"6Æ73Ò&†öÖRÖfVGW&RÖ'W’Ö'Fâ"r°¢w7G–ÆSÒ&fÆWƒ£·FF–æs£‚gƒ¶föçB×6—¦S£‡ƒ¶Ö–âÖ†V–v‡C£S'ƒ²"r°¢vöæ6Æ–6³Ò'7v—F6„6†&7FW%F"…Âw6¶–ÆÅÂr’#âr°¢.h¨ˆ;Ò"°¢#Âö'WGFöãâ"° ¢#ÂöF—câ"° ¢ò ¢)ˆRKúîjÚ>ûÈŽKéÞxZ~KÛþyJŽˆ^Y¹îZûÈÎ8Îh¨ˆ;Ð¢š™Ú.KˆÞˆ;ÞhÛ.X¹^ûÈÎ[îˆ{NKˆ¾™Ú.h¨ˆ;ÞyÈ°¢KˆÞX‹8ÞûÈžûÉ ¢XéþiÊÆÖ–âÖ†V–v‡NZú¾jÛ³CƒŽûÈÎYÊ€¢h˜¾j™þxþŠkÞYšŽûÈŽ[
NX[n{k.YØX‰~˜(NšþzK®‰p¢y¨E6×7Vær'&÷w6W.ûÈžZún™©¾XúþŠi`¢š¹Ž[ªnjùN‹È>yúîy¨Ni˜.X	žûÈÃCƒŽ˜	žX°¢Kˆ¾™™zÎiŠþjùFÖ‚Ö†V–v‡C£cGfŽ˜(@¢š¹ŽûÈÄ55>ŠhþX˜~Š:Ö–âÖ†V–v‡NXJ®XXŽjÈ ¢jùFÖ‚Ö†V–v‡Nš¹ŽûÈÎzØžikÎ˜	žX¾ZëžYš€¢kŽ˜ˆ{>[	CƒŽš¹ŽûÈÎ‹yþZIn[@¢æ†öÖRÖfVGW&RÖÖöFÂÖ&÷Žˆz®[{¢y¨Nš¹Ž[ªnKˆ®™™ûÈƒƒGfŽûÈòçv–F^i˜ ¢“fGfŽûÈži:YÊŽKˆ‹[~ûÈÎZëži‰>XZž[N˜;Ð¢‹h^X{®8Šè®h‰8ÎZIn[NZëžYš‚¾XZ~[@¢ZëžYšŽ8ÞXZžX¾˜;ÞŠhhÛ.X¹^y¨N[z.x¸hÛ.X¹^ûÈÀ¢h˜¾j™þKˆ®[èŽZëži‰>XÚKØþ8hIþŠk®ZèÎXZ€¢hÛ.KˆÞX¹^8  ¢iKžh‰Ö–âƒCƒ‚ÃSGf‚ž(	N(	NXZ~Zë¢‹È>ZI®y¨NXˆnšûÈŽˆ;ÞX©¾XÎûÈž˜(NiŠþyº˜xð¢h©>k»óCƒŽ˜	žX¾ynh;>XÎûÈÎKØn‰ê.[™P¢yÉþy¨Nyúîy¨Ni˜.X	žiÈ>ˆz®X¹^Šé>jÚ^ûÈÀ¢KˆÞiÈ>zÎi)X{®XZž[N˜;ÞŠhhÛ.X¹^y¨@¢ŠÞz¨ûÈÎYÎi˜.Yºx+®jøþjÊzé~X{®Kèny¨@¢˜(NiŠþYÎKˆX¾Y»®Zé®XÎûÈŽKˆÞiÈ>Yºx+ ¢Xˆ~XˆnšˆÎiKžŠè®ûÈžûÈÎXéþiÊÎ8ÎXˆ~Xˆnš¢ZJ~[þKˆÞ‹{>X¹^8Þy¨N™Èk.˜(NiŠþiÈžKùÞyYž8 ¢¢ð ¢sÆF—b–CÒ&6†&7FW%F$6öçFVçB"r°¢w7G–ÆSÒ&fÆWƒ£WFó¶†V–v‡C¦WFó¶Ö–âÖ†V–v‡C£¶Ö‚Ö†V–v‡C¦æöæS¶÷fW&fÆ÷r×“¦WFó¶÷fW&fÆ÷r×ƒ¦†–FFVã²×vV&¶—BÖ÷fW&fÆ÷r×67&öÆÆ–æs§F÷V6ƒ¶÷fW'67&öÆÂÖ&V†f–÷"×“¦6öçF–ã·F÷V6‚Ö7F–öã§â×“¶&÷‚×6—¦–æs¦&÷&FW"Ö&÷ƒ²#ãÂöF—câs°  ¢&WGW&â‡FÖÃ° §Ð  ¢ò¢ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÐ¢)ˆRjøþiz^K»¾X¹£ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÒ¢ð ¢ò¢ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÐ¢)ˆR™º.{y®{i>š™p£ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÒ¢ð ¦gVæ7F–öâ&VæFW$öffÆ–æTW‡6öçFVçB‚—° ¢6öç7B†÷W'3Ð ¢ÖF‚æfÆö÷"€¢öffÆ–æTVÆ6VDÖ–çWFW4f÷$F—7Æ’óc ¢“° ¢6öç7BÖ–çWFW3Ð ¢öffÆ–æTVÆ6VDÖ–çWFW4f÷$F—7Æ’P¢c°  ¢6öç7B6VDæ÷F–6SÐ ¢öffÆ–æTVÆ6VDÖ–çWFW4f÷$F—7Æ“à¢ôddÄ”äUôU…ôÔ…ôÔ”åUDU0¢ð¢sÆF—b7G–ÆSÒ&föçB×6—¦S£ƒ¶6öÆ÷#¢6Sƒƒ3f#¶Ö&v–â×F÷£Gƒ²#âr°¢.ûÈŽ™º.{y®{i>š™~iÈZI®Xú®ŠˆŽzésŽ[þi˜.ûÈÎ‹h^˜îy¨N˜:ŽXˆnKˆÞiÈ>šÞZIn{Jþz˜ÞûÈ’"°¢#ÂöF—câ ¢ ¢"#°  ¢&WGW&â€ ¢sÆF—b7G–ÆSÒ&föçB×6—¦S£7ƒ¶Æ–æRÖ†V–v‡C£ãƒ²#âr° ¢.™º.{y®i˜.™i>ûÉ¢"¶†÷W'2².[þi˜""¶Ö–çWFW2².Xˆn™	ƒÆ'#â"° ¢.Xúþš	ŽXùn™º.{y®{i>š™~ûÉ¢"°¢sÇ7â7G–ÆSÒ&6öÆ÷#¢6c#C#“¶föçB×vV–v‡C¦&öÆC²#âr°¢VæF–ætöffÆ–æTW‡°¢#Â÷7ãâ"°¢$U…"° ¢6VDæ÷F–6R° ¢sÆF—b7G–ÆSÒ&föçB×6—¦S£ƒ¶6öÆ÷#¢6#6S†3¶Ö&v–â×F÷£‡ƒ²#âr°¢.™º.{y®{i>š™~iÈ>y»Nhê^Xª˜.X[yJŽ{i>š™~kûÈÂ"°¢.jøþXˆn™	‚"´ôddÄ”äUôU…õU%ôÔ”åUDR².›¹îûÈÂ"°¢.iÈZI®ŠˆŽzésŽ[þi˜.8""°¢#ÂöF—câ"° ¢#ÂöF—câ"° ¢sÆ'WGFöâ6Æ73Ò&†öÖRÖfVGW&RÖ'W’Ö'Fâ'7G–ÆSÒ'v–GFƒ£S¶Ö&v–â×F÷£'ƒ·FF–æs£ƒ²"r° ¢€¢VæF–ætöffÆ–æTW‡ÃÓ ¢ð¢&F—6&ÆVB ¢ ¢" ¢’° ¢vöæ6Æ–6³Ò&6Æ–ÔöffÆ–æTW‡‚’#âr° ¢€¢VæF–ætöffÆ–æTW‡ÃÓ ¢ð¢.yºîX˜Þk).iÈžXúþš	ŽXùny¨N™º.{y®{i>š™r ¢ ¢.š	ŽXùb"·VæF–ætöffÆ–æTW‡².™º.{y®{i>š™r ¢’° ¢#Âö'WGFöãâ"° ¢ò ¢)ˆRikZ)îûÈŽKéÞxZ~KÛþyJŽˆ^Šhk.ûÈÎ8ÎyÈ¾[º>Y ¢™¹žXÞš	ŽXùn8Þy¨NzÊÎKˆX¾zK®zøNyJŽk9^ûÈžûÉ ¢Xú®iÈžYÊŽiÈžiÛŠ[þXúþKº^š	ŽXùny¨Ni˜.X	žh˜ÞšþzK ¢˜	žšnhÈž˜‰^ûÈÎYÎXú·6†÷u&Wv&FVDB‚žûÈÀ¢h‰X©þy¨F6ÆÆ&6¾Š:YÎXú°¢6Æ–ÔöffÆ–æTW‡‡G'VRžûÈŽZI®KˆX°¢Xø>i[ŽY®Š‹Nš	ŽXùnX{Þ[Èþ8Î˜	žjÊiŠþ™¹žXÞ8ÞûÈž8 ¢¢ð ¢€ ¢VæF–ætöffÆ–æTW‡ã ¢ð¢sÆ'WGFöâ6Æ73Ò&†öÖRÖfVGW&RÖ'W’Ö'Fâ"r°¢w7G–ÆSÒ'v–GFƒ£S¶Ö&v–â×F÷£‡ƒ·FF–æs£ƒ²r°¢v&6¶w&÷VæC¦Æ–æV"Öw&F–VçBƒƒFVrÂ6c#C#’Â63“s“R“²r°¢v6öÆ÷#¢3&sc²"r°¢vöæ6Æ–6³Ò&6Æ–ÔöffÆ–æTW‡v—F„B‚’#âr°¢.yÈ¾[º>Y®™¹žXÞš	ŽXùnûÈ‚"°¢‡VæF–ætöffÆ–æTW‡£"’°¢$U…ûÈ’"°¢#Âö'WGFöãâ ¢ ¢"  ¢ ¢“° §Ð  ¢ò ¢)ˆRikZ)îûÉ®yÈ¾[º>Y®™¹žXÞš	ŽXùny¨NXZ^Xú>ûÈÎYÎXú°¢˜	®yJŽy¨G6†÷u&Wv&FVDB‚žûÈÎh‰X©þh˜ÞyÉþy¨@¢™¹žXÞy›ÎiKîûÈÎZKiYrþXùnkhŽy¨NŠ›K¸›«Î˜;ÞKˆÞiÈ0¢y›ÎyIþûÈŽKˆÞiÈ>hš>K»¾KÙ^iÛŠ[þûÈÎXú®iŠþk).h»þX‹ ¢™¹žXÞXªh‰ûÈÎXéþiÊÎk).yÈ¾[º>Y®y¨NjÚ>[‹Žš	ŽXù`¢6Æ–ÔöffÆ–æTW‡‚ž˜(NiŠþXúþKº^xZ~[‹ŽKÛþyJŽûÈž8 ¢¢ð ¦gVæ7F–öâ6Æ–ÔöffÆ–æTW‡v—F„B‚—° ¢–b‡VæF–ætöffÆ–æTW‡ÃÓ—°¢&WGW&ã°¢Ð  ¢6†÷u&Wv&FVDB€¢‚“Óç° ¢6Æ–ÔöffÆ–æTW‡€¢G'VP¢“° ¢ÒÀ¢‚“Óç° ¢FD&GFÆTÆör€¢.[º>Y®iÊ®yÈ¾ZèÎûÈÎxJk9^š	ŽXùn™¹žXÞxØîX»^8" ¢“° ¢Ð¢“° §Ð  ¦gVæ7F–öâ6Æ–ÔöffÆ–æTW‡€¢—4F÷V&ÆV@¢—° ¢–b‡VæF–ætöffÆ–æTW‡ÃÓ—°¢&WGW&ã°¢Ð  ¢ò ¢)ˆRKúîjÚ>ûÉ®XªK¨f—4F÷V&ÆVN˜	žX¾Xø>i[ŽûÈÀ¢yÈ¾[º>Y®h‰X©þi˜.X+7G'V^ûÈÎZún™©¾ZÙŽXZ^{i>š™~k ¢y¨Ni[ŽZÙ~K™ŽKºS.ûÉ¾KˆˆŠÎk).yÈ¾[º>Y®y¨Nš	ŽXù`¢{jÞhÈXéþiÊÎi[ŽZÙ~KˆÞŠè®8 ¢¢ð ¢6öç7B&Wv&DÖ÷VçCÐ ¢—4F÷V&ÆV@¢ð¢VæF–ætöffÆ–æTW‡£ ¢ ¢VæF–ætöffÆ–æTW‡°  ¢6†&VDW‡Ð¢6†&VDW‡°¢&Wv&DÖ÷VçC°  ¢FD&GFÆTÆör€ ¢€¢—4F÷V&ÆV@¢ð¢.[º>Y®™¹žXÞš	ŽXùn™º.{y®{i>š™r ¢ ¢.š	ŽXùn™º.{y®{i>š™r ¢’°¢&Wv&DÖ÷VçB°¢.›¹îûÈÎ[{.ZÙŽXZ^{i>š™~k8"  ¢“°  ¢VæF–ætöffÆ–æTW‡Ð¢°  ¢WFFUT’‚“° ¢6fTvÖR‚“°  ¢6öç7B&öG”VÃÐ¢B‚&†öÖTfVGW&TÖöFÄ&öG’"“°  ¢–b†&öG”VÂ—° ¢&öG”VÂæ–ææW$…DÔÃÐ¢&VæFW$öffÆ–æTW‡6öçFVçB‚“° ¢Ð §Ð  ¢ò ¢)ˆRKúîjÚ>ûÈŽKéÞxZ~KÛþyJŽˆ^Šhk.ûÈÎK»¾X¹žiKžh‰XZžX°¢XˆnšûÉ®jøþiz^K»¾X¹žûÈþZyNŠ‰~K»¾X¹žûÈžûÉ ¢XéþiÊÇ&VæFW%VW7D6öçFVçB‚ži[Një^˜(þ‹Êþh«Þh‰ ¢˜	®yJŽx˜ŽiÊÇ&VæFW%VW7DÆ—7DvVæW&–2‚žûÈÀ¢Y>8Îh¨ˆ;ÞZé®{êžkˆ^Yjâþx¸hX¾xšžK»bþš	ŽXùnX{Þ[Èð¢YÞz‹8ÞKˆžX¾Xø>i[ŽûÈÎjøþiz^K»¾X¹ž8ZyNŠ‰~K»¾X¹¢X[yJŽYÎKˆK»Þk‹.iù>˜(þ‹ÊþûÈÎKˆÞyJŽZú¾XZžjÊ[›îK˜à¢KˆjŠ>y¨Nzˆ¾[Èþz+Î8 ¢¢ð ¦gVæ7F–öâf÷&ÖEVW7E&Wv&B‡&Wv&B—° ¢6öç7B'G3ÕµÓ° ¢–b‡&Wv&BævöÆB—°¢'G2çW6‚€¢.˜y[š2"·&Wv&BævöÆ@¢“°¢Ð ¢–b‡&Wv&BæW‡—°¢'G2çW6‚€¢$U…"·&Wv&BæW‡ ¢“°¢Ð ¢&WGW&â'G2æ¦ö–â‚.8"“° §Ð  ¢ò¢ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÐ¢cƒ’(	BK»¾X¹žZèÎh‰[ªnxØîX»^šªŽië`¢Ò#òCòcòƒòK©N™¨îjë^8 ¢ÒyºîX˜ÞXú®[»®z¸²T’ˆˆ~ZèÎh‰[ªnŠˆŽzé~ûÈÎKˆÞy›ÎiKîK»¾KÙ^xØîX»^8KˆÞZú¾XZ^ZÙŽj©N8 ¢ÒZèÎh‰[ªnKéÞ8Îh˜iÈžK»¾X¹žyºîj‰žy¨N{Jþz˜Þ˜.[ªbòh˜iÈžyºîj‰ž{‹Þ˜xþ8ÞŠˆŽzé~ûÈÀ¢Šé>jøþizR2K»¾X¹ž8ZyNŠ‰r"K»¾X¹žK™þˆ;Þˆz®xKn‹zŽ˜â#R™¨îjë^8 £ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÒ¢ð¦6öç7BTU5Eô4ôÕÄUD”ôåôÔ”ÄU5DôäU3Õ°¢#ÃCÃcÃƒÃ ¥Ó°  ¦gVæ7F–öâvWEVW7D6ö×ÆWF–öåW&6VçB€¢FVf–æ—F–öç2À¢7FFP¢—° ¢ÆWBF÷FÄvöÃÓ°¢ÆWBF÷FÅ&öw&W73Ó° ¢FVf–æ—F–öç2æf÷$V6‚†gVæ7F–öâ‡VW7B—° ¢6öç7BvöÃÐ¢ÖF‚æÖ‚€¢À¢çVÖ&W"‡VW7BævöÂ—ÇÃ ¢“° ¢6öç7B&öw&W73Ð¢ÖF‚æÖ‚€¢À¢çVÖ&W"€¢7FFRç&öw&W75·VW7Bæ–EÐ¢—ÇÃ ¢“° ¢F÷FÄvöÂ³ÖvöÃ°¢F÷FÅ&öw&W72³Ð¢ÖF‚æÖ–â€¢vöÂÀ¢&öw&W70¢“° ¢Ò“° ¢–b‡F÷FÄvöÃÃÓ—°¢&WGW&â°¢Ð ¢&WGW&âÖF‚æÖ–â€¢À¢ÖF‚æÖ‚€¢À¢F÷FÅ&öw&W72÷F÷FÄvöÂ£ ¢¢“° §Ð  ¦gVæ7F–öâ&VæFW%VW7D6ö×ÆWF–öåæVÄ6öçFVçB€¢FVf–æ—F–öç2À¢7FFP¢—° ¢6öç7BW&6VçCÐ¢vWEVW7D6ö×ÆWF–öåW&6VçB€¢FVf–æ—F–öç2À¢7FFP¢“° ¢6öç7BF—7Æ•W&6VçCÐ¢ÖF‚æfÆö÷"‡W&6VçB“° ¢6öç7BÖ–ÆW7FöæW3Ð¢TU5Eô4ôÕÄUD”ôåôÔ”ÄU5DôäU0¢æÖ†gVæ7F–öâ‡F‡&W6†öÆB—° ¢6öç7B&V6†VCÐ¢W&6VçCã×F‡&W6†öÆC° ¢&WGW&â€¢sÆF—b6Æ73Ò'VW7BÖÖ–ÆW7FöæRr°¢‡&V6†VBò"&V6†VB"¢""’²r#âr°¢sÆF—b6Æ73Ò'VW7BÖÖ–ÆW7FöæR×W&6VçB#âr°¢F‡&W6†öÆB²rRr°¢sÂöF—câr°¢sÆF—b6Æ73Ò'VW7BÖÖ–ÆW7FöæR×6Æ÷B"&–ÖÆ&VÃÒ.xØîX»^[è^ŠŠÞZé¢#âr°¢sÇ7ãî[è^Zé£Â÷7ãâr°¢sÂöF—câr°¢sÂöF—câp¢“° ¢Ò¢æ¦ö–â‚""“° ¢&WGW&â€¢sÆF—b6Æ73Ò'VW7BÖ6ö×ÆWF–öâÖ†VB#âr°¢sÇ7ãîZèÎh‰[ªnxØîX»SÂ÷7ãâr°¢sÇ7G&öæsâr¶F—7Æ•W&6VçB²rSÂ÷7G&öæsâr°¢sÂöF—câr° ¢sÆF—b6Æ73Ò'VW7BÖ6ö×ÆWF–öâ×G&6²"&–Ö†–FFVãÒ'G'VR#âr°¢sÆF—b6Æ73Ò'VW7BÖ6ö×ÆWF–öâÖf–ÆÂ"7G–ÆSÒ'v–GFƒ¢r·W&6VçB²rS²#ãÂöF—câr°¢sÂöF—câr° ¢sÆF—b6Æ73Ò'VW7BÖ6ö×ÆWF–öâÖÖ–ÆW7FöæW2#âr°¢Ö–ÆW7FöæW2°¢sÂöF—câp¢“° §Ð  ¦gVæ7F–öâ&VæFW%VW7DÆ—7DvVæW&–2€¢FVf–æ—F–öç2À¢7FFRÀ¢6Æ–ÔfäæÖP¢—° ¢ÆWB‡FÖÃÐ¢sÆF—b6Æ73Ò'VW7BÖÆ—7B#âs°  ¢FVf–æ—F–öç2æf÷$V6‚€¢VW7CÓç° ¢6öç7B&öw&W73Ð¢7FFRç&öw&W75°¢VW7Bæ–@¢×ÇÃ° ¢6öç7B6Æ–ÖVCÐ¢7FFRæ6Æ–ÖVE°¢VW7Bæ–@¢Ó° ¢6öç7BFöæSÐ¢&öw&W73ã×VW7BævöÃ° ¢6öç7B6fU&öw&W73Ð¢ÖF‚æÖ–â€¢&öw&W72À¢VW7BævöÀ¢“° ¢6öç7BW&6VçCÐ¢VW7BævöÃã ¢ð¢ÖF‚æÖ–â€¢À¢ÖF‚æÖ‚€¢À¢‡&öw&W72÷VW7BævöÂ’£ ¢¢¢ ¢° ¢6öç7B7FGW5FW‡CÐ¢6Æ–ÖV@¢ð¢.[{.š	ŽXùb ¢ ¢FöæP¢ð¢.Xúþš	ŽXùb ¢ ¢.˜.ŠÎKŠÒ#° ¢6öç7B7FGW46Æ73Ð¢6Æ–ÖV@¢ð¢&6Æ–ÖVB ¢ ¢FöæP¢ð¢'&VG’ ¢ ¢'&öw&W72#° ¢6öç7B'WGFöåFW‡CÐ¢6Æ–ÖV@¢ð¢.[{.š	ŽXùb ¢ ¢FöæP¢ð¢.š	ŽXùb ¢ ¢.iÊ®˜Nh‰#° ¢‡FÖÂ³Ð¢sÇ6V7F–öâ6Æ73Ò'VW7BÖ6&Br·7FGW46Æ72²r#âr° ¢sÆF—b6Æ73Ò'VW7BÖ6&BÖ†VB#âr°¢sÆF—b6Æ73Ò'VW7BÖ6&BÖæÖR#âr°¢VW7BææÖR°¢sÂöF—câr°¢sÆF—b6Æ73Ò'VW7B×7FGW2r·7FGW46Æ72²r#âr°¢7FGW5FW‡B°¢sÂöF—câr°¢sÂöF—câr° ¢sÆF—b6Æ73Ò'VW7BÖ6&BÖFW62#âr°¢VW7BæFW62°¢sÂöF—câr° ¢sÆF—b6Æ73Ò'VW7B×&öw&W72ÖÆ–æR#âr°¢sÇ7ãî˜.[ªcÂ÷7ãâr°¢sÇ7G&öæsâr·6fU&öw&W72²ròr·VW7BævöÂ²sÂ÷7G&öæsâr°¢sÂöF—câr° ¢sÆF—b6Æ73Ò'VW7B×&öw&W72×G&6²"&–Ö†–FFVãÒ'G'VR#âr°¢sÆF—b6Æ73Ò'VW7B×&öw&W72Öf–ÆÂ"7G–ÆSÒ'v–GFƒ¢r·W&6VçB²rS²#ãÂöF—câr°¢sÂöF—câr° ¢sÆF—b6Æ73Ò'VW7BÖ6&BÖfö÷B#âr°¢sÆF—b6Æ73Ò'VW7B×&Wv&B#âr°¢sÇ7â6Æ73Ò'VW7B×&Wv&BÖÆ&VÂ#îxØîX»SÂ÷7ãâr°¢sÇ7ãâr¶f÷&ÖEVW7E&Wv&B‡VW7Bç&Wv&B’²sÂ÷7ãâr°¢sÂöF—câr° ¢sÆ'WGFöâ6Æ73Ò'VW7BÖ6Æ–ÒÖ'Fâ"r°¢€¢FöæRÇÂ6Æ–ÖV@¢ð¢"F—6&ÆVB ¢ ¢" ¢’°¢röæ6Æ–6³Ò"r¶6Æ–ÔfäæÖR²r…Ârr·VW7Bæ–B²uÂr’#âr°¢'WGFöåFW‡B°¢sÂö'WGFöãâr°¢sÂöF—câr° ¢sÂ÷6V7F–öãâs° ¢Ð¢“°  ¢‡FÖÂ³Ð¢#ÂöF—câ#° ¢&WGW&â‡FÖÃ° §Ð  ¦gVæ7F–öâ&VæFW$F–Ç•VW7DÆ—7D6öçFVçB‚—° ¢&WGW&â&VæFW%VW7DÆ—7DvVæW&–2€¢F–Ç•VW7DFVf–æ—F–öç2À¢F–Ç•VW7E7FFRÀ¢&6Æ–ÔF–Ç•VW7B ¢“° §Ð  ¦gVæ7F–öâ&VæFW$6öÖÖ—76–öåVW7DÆ—7D6öçFVçB‚—° ¢&WGW&â&VæFW%VW7DÆ—7DvVæW&–2€¢6öÖÖ—76–öåVW7DFVf–æ—F–öç2À¢6öÖÖ—76–öåVW7E7FFRÀ¢&6Æ–Ô6öÖÖ—76–öåVW7B ¢“° §Ð ¦gVæ7F–öâvWD6Æ–Ö&ÆUVW7D–G2†FVf–æ—F–öç2Ç7FFR—°¢&WGW&â†FVf–æ—F–öç7ÇÅµÒ’æf–ÇFW"†gVæ7F–öâ‡VW7B—°¢&WGW&âVW7Bbb7FFRæ6Æ–ÖVE·VW7Bæ–EÒb`¢„çVÖ&W"‡7FFRç&öw&W75·VW7Bæ–EÒ—ÇÃ“ãÔÖF‚æÖ‚ƒÄçVÖ&W"‡VW7BævöÂ—ÇÃ“°¢Ò’æÖ†gVæ7F–öâ‡VW7B—²&WGW&âVW7Bæ–C²Ò“°§Ð ¦gVæ7F–öâcs3c7–æ5VW7D6Æ–ÔÆÄ'WGFöâ†—46öÖÖ—76–öâ—°¢6öç7B'WGFöãÒB‚'VW7D6Æ–ÔÆÄ'WGFöâ"“°¢–b‚'WGFöâ—²&WGW&ã²Ð¢6öç7BFVf–æ—F–öç3Ö—46öÖÖ—76–öãö6öÖÖ—76–öåVW7DFVf–æ—F–öç3¦F–Ç•VW7DFVf–æ—F–öç3°¢6öç7B7FFSÖ—46öÖÖ—76–öãö6öÖÖ—76–öåVW7E7FFS¦F–Ç•VW7E7FFS°¢6öç7B6÷VçCÖvWD6Æ–Ö&ÆUVW7D–G2†FVf–æ—F–öç2Ç7FFR’æÆVæwFƒ°¢'WGFöâæF—6&ÆVCÖ6÷VçCÃÓ°¢'WGFöâçFW‡D6öçFVçCÖ6÷VçCãò.Kˆ˜Û^š	ŽXùnûÈ‚"¶6÷VçB².ûÈ’#¢.Kˆ˜Û^š	ŽXùb#°¢'WGFöâæöæ6Æ–6³Ö—46öÖÖ—76–öã÷cs3c6Æ–ÔÆÄ6öÖÖ—76–öåVW7G3§cs3c6Æ–ÔÆÄF–Ç•VW7G3°§Ð ¦gVæ7F–öâcs3c&Vg&W6„÷VåVW7EvR‚—°¢6öç7B&öG“ÒB‚'VW7EF$&öG’"“°¢–b‚&öG’—²&WGW&âfÇ6S²Ð¢6öç7B6öÖÖ—76–öä'FãÒB‚'VW7EF$'Fä6öÖÖ—76–öâ"“°¢6öç7B—46öÖÖ—76–öãÒ†6öÖÖ—76–öä'Fâbf6öÖÖ—76–öä'Fâæ6Æ74Æ—7Bæ6öçF–ç2‚&7F—fR"’“°¢6öç7B67&öÆÅF÷Ö&öG’ç67&öÆÅF÷°¢&öG’æ–ææW$…DÔÃÖ—46öÖÖ—76–öã÷&VæFW$6öÖÖ—76–öåVW7DÆ—7D6öçFVçB‚“§&VæFW$F–Ç•VW7DÆ—7D6öçFVçB‚“°¢6öç7B6ö×ÆWF–öåæVÃÒB‚'VW7D6ö×ÆWF–öåæVÂ"“°¢–b†6ö×ÆWF–öåæVÂ—°¢6ö×ÆWF–öåæVÂæ–ææW$…DÔÃ×&VæFW%VW7D6ö×ÆWF–öåæVÄ6öçFVçB€¢—46öÖÖ—76–öãö6öÖÖ—76–öåVW7DFVf–æ—F–öç3¦F–Ç•VW7DFVf–æ—F–öç2À¢—46öÖÖ—76–öãö6öÖÖ—76–öåVW7E7FFS¦F–Ç•VW7E7FFP¢“°¢Ð¢&öG’ç67&öÆÅF÷×67&öÆÅF÷°¢cs3c7–æ5VW7D6Æ–ÔÆÄ'WGFöâ†—46öÖÖ—76–öâ“°¢&WGW&âG'VS°§Ð§v–æF÷rçcs3c&Vg&W6„÷VåVW7EvS×cs3c&Vg&W6„÷VåVW7EvS°   ¢ò ¢cƒžûÉ®K»¾X¹žŠinz©~x+®8ÎY»®Zé®j‰ž{NX‰r²XZ~[NK»¾X¹žkˆ^Yjâ²Y»®Zé®ZèÎh‰[ªnxØîX»^8Þiënjx¾8 ¢7VW7EF$&öG’iŠþK»¾X¹žYJþKˆ67&öÆÂ÷væW.ûÉ¾j‰žšÎˆˆ~XZžX¾j‰ž{NKˆÞ‹yþ‰~hÛ.8 ¢¢ð¦gVæ7F–öâ&VæFW%VW7EF$6öçFVçB†7F—fUF"—° ¢6öç7B—46öÖÖ—76–öãÐ¢7F—fUF#ÓÓÒ&6öÖÖ—76–öâ#° ¢&WGW&â€¢sÆF—b6Æ73Ò'VW7BÖ–çFW&f6R#âr° ¢sÆF—b6Æ73Ò'VW7B×F'2"&öÆSÒ'F&Æ—7B"&–ÖÆ&VÃÒ.K»¾X¹žXˆnšâ#âr° ¢sÆ'WGFöâ–CÒ'VW7EF$'FäF–Ç’"6Æ73Ò'VW7B×F"r°¢‚—46öÖÖ—76–öâò"7F—fR"¢""’²r"r°¢r&öÆSÒ'F""&–×6VÆV7FVCÒ"r²‚—46öÖÖ—76–öâò'G'VR"¢&fÇ6R"’²r"r°¢röæ6Æ–6³Ò'7v—F6…VW7EF"…ÂvF–Ç•Âr’#âr°¢.jøþiz^K»¾X¹’"°¢sÂö'WGFöãâr° ¢sÆ'WGFöâ–CÒ'VW7EF$'Fä6öÖÖ—76–öâ"6Æ73Ò'VW7B×F"r°¢†—46öÖÖ—76–öâò"7F—fR"¢""’²r"r°¢r&öÆSÒ'F""&–×6VÆV7FVCÒ"r²†—46öÖÖ—76–öâò'G'VR"¢&fÇ6R"’²r"r°¢röæ6Æ–6³Ò'7v—F6…VW7EF"…Âv6öÖÖ—76–öåÂr’#âr°¢.ZyNŠ‰~K»¾X¹’"°¢sÂö'WGFöãâr° ¢sÂöF—câr° ¢sÆF—b6Æ73Ò'VW7BÖ&F6‚Ö7F–öç2#âr°¢sÆ'WGFöâ–CÒ'VW7D6Æ–ÔÆÄ'WGFöâ"6Æ73Ò'VW7BÖ6Æ–ÒÖÆÂÖ'Fâ"G—SÒ&'WGFöâ"r°¢†vWD6Æ–Ö&ÆUVW7D–G2€¢—46öÖÖ—76–öãö6öÖÖ—76–öåVW7DFVf–æ—F–öç3¦F–Ç•VW7DFVf–æ—F–öç2À¢—46öÖÖ—76–öãö6öÖÖ—76–öåVW7E7FFS¦F–Ç•VW7E7FFP¢’æÆVæwFƒòrs¢vF—6&ÆVBr’°¢vöæ6Æ–6³Ò"r²†—46öÖÖ—76–öãòwcs3c6Æ–ÔÆÄ6öÖÖ—76–öåVW7G2‚’s¢wcs3c6Æ–ÔÆÄF–Ç•VW7G2‚’r’²r#îKˆ˜Û^š	ŽXùcÂö'WGFöãâr°¢sÂöF—câr° ¢sÆF—b–CÒ'VW7EF$&öG’"6Æ73Ò'VW7B×F"Ö&öG’"&öÆSÒ'F'æVÂ#âr°¢€¢—46öÖÖ—76–öà¢ð¢&VæFW$6öÖÖ—76–öåVW7DÆ—7D6öçFVçB‚¢ ¢&VæFW$F–Ç•VW7DÆ—7D6öçFVçB‚¢’°¢sÂöF—câr° ¢sÆF—b–CÒ'VW7D6ö×ÆWF–öåæVÂ"6Æ73Ò'VW7BÖ6ö×ÆWF–öâ×æVÂ#âr°¢&VæFW%VW7D6ö×ÆWF–öåæVÄ6öçFVçB€¢—46öÖÖ—76–öà¢ò6öÖÖ—76–öåVW7DFVf–æ—F–öç0¢¢F–Ç•VW7DFVf–æ—F–öç2À¢—46öÖÖ—76–öà¢ò6öÖÖ—76–öåVW7E7FFP¢¢F–Ç•VW7E7FFP¢’°¢sÂöF—câr° ¢sÂöF—câp¢“° §Ð  ¦gVæ7F–öâ7v—F6…VW7EF"‡F$æÖR—° ¢6öç7B6öçF–æW#Ð¢B‚'VW7EF$&öG’"“° ¢–b‚6öçF–æW"—°¢&WGW&ã°¢Ð ¢6öç7B—46öÖÖ—76–öãÐ¢F$æÖSÓÓÒ&6öÖÖ—76–öâ#° ¢6öçF–æW"æ–ææW$…DÔÃÐ¢—46öÖÖ—76–öà¢ð¢&VæFW$6öÖÖ—76–öåVW7DÆ—7D6öçFVçB‚¢ ¢&VæFW$F–Ç•VW7DÆ—7D6öçFVçB‚“° ¢6öçF–æW"ç67&öÆÅF÷Ð¢° ¢6öç7B6ö×ÆWF–öåæVÃÐ¢B‚'VW7D6ö×ÆWF–öåæVÂ"“° ¢–b†6ö×ÆWF–öåæVÂ—° ¢6ö×ÆWF–öåæVÂæ–ææW$…DÔÃÐ¢&VæFW%VW7D6ö×ÆWF–öåæVÄ6öçFVçB€¢—46öÖÖ—76–öà¢ò6öÖÖ—76–öåVW7DFVf–æ—F–öç0¢¢F–Ç•VW7DFVf–æ—F–öç2À¢—46öÖÖ—76–öà¢ò6öÖÖ—76–öåVW7E7FFP¢¢F–Ç•VW7E7FFP¢“° ¢Ð ¢6öç7BF–Ç”'FãÐ¢B‚'VW7EF$'FäF–Ç’"“° ¢6öç7B6öÖÖ—76–öä'FãÐ¢B‚'VW7EF$'Fä6öÖÖ—76–öâ"“° ¢–b†F–Ç”'Fâ—°¢F–Ç”'Fâæ6Æ74Æ—7BçFövvÆR€¢&7F—fR"À¢—46öÖÖ—76–öà¢“°¢F–Ç”'Fâç6WDGG&–'WFR€¢&&–×6VÆV7FVB"À¢—46öÖÖ—76–öâò'G'VR"¢&fÇ6R ¢“°¢Ð ¢–b†6öÖÖ—76–öä'Fâ—°¢6öÖÖ—76–öä'Fâæ6Æ74Æ—7BçFövvÆR€¢&7F—fR"À¢—46öÖÖ—76–öà¢“°¢6öÖÖ—76–öä'Fâç6WDGG&–'WFR€¢&&–×6VÆV7FVB"À¢—46öÖÖ—76–öâò'G'VR"¢&fÇ6R ¢“°¢Ð ¢cs3c7–æ5VW7D6Æ–ÔÆÄ'WGFöâ†—46öÖÖ—76–öâ“° §Ð  ¢ò ¢)ˆRikZ)îûÈŽKéÞxZ~KÛþyJŽˆ^Šhk.ûÈÎikZ)îXšþiÊÂô$õ50¢XZžX¾[îŠkÞX‰~š^yºîûÈÎYNˆz£.X¾XˆnšûÈžûÉ ¢yºîX˜ÞXú®XXŽX®X{®8ÎXˆnšXˆ~hù¾8Þ˜	žZY~šªŽiën‹yð¢Šª®iˆîih~ZÙ~ûÈÎZún™©¾y¨NXšþiÊÂô$õ5>h‹šÊ^ŠhþX˜p¢ûÈŽh
®xšž[Ë~[ªn8xØîX»^8jøþZJžˆ;ÞhÉh‹[›îjÊ8¢‹yþxûîiÈž{{NX©þXØy¨N[zîy[iŠþK¸›«ÎûÈž˜;Þ˜(Nk).Zé®jŽûÈÀ¢zØžKÛþyJŽˆ^hùKé¾ŠhþX˜~[èÎXhÞZún™©¾hê^Kˆ®h‹šÊP¢˜(þ‹Êþ(	N(	N˜	žŠ:XXŽz+®KùÞXˆ~Xˆnšy¨NK¸¾™Ú.iŠð¢˜	®y¨NûÈÎK˜¾[èÎŠhhù¾XZ~ZëžXú®™ÈŠhiK¢&VæFW.X{Þ[ÈþûÈÎKˆÞyJŽX¹T…DÔÎ{Yjx¾8 ¢¢ð ¦gVæ7F–öâ&VæFW$GVævVöåF$6öçFVçB‡F$æÖR—° ¢–b‡F$æÖSÓÓÒ&'—72"—° ¢&WGW&â€ ¢sÆF—b7G–ÆSÒ&föçB×6—¦S£7ƒ¶Æ–æRÖ†V–v‡C£ãƒ¶6öÆ÷#¢6#6S†3²#âr°¢.k{k{^XšþiÊÎ[	®iÊ®ŠŠÞŠˆŽZèÎh‰8""°¢#ÂöF—câ  ¢“° ¢Ð  ¢&WGW&â€ ¢sÆF—b7G–ÆSÒ&föçB×6—¦S£7ƒ¶Æ–æRÖ†V–v‡C£ãƒ¶6öÆ÷#¢6#6S†3²#âr°¢.iz^[‹ŽXšþiÊÎ[	®iÊ®ŠŠÞŠˆŽZèÎh‰8""°¢#ÂöF—câ  ¢“° §Ð  ¦gVæ7F–öâ7v—F6„GVævVöåF"‡F$æÖR—° ¢6öç7B6öçF–æW#Ð¢B‚&GVævVöåF$6öçFVçB"“°  ¢–b‚6öçF–æW"—°¢&WGW&ã°¢Ð  ¢6öçF–æW"æ–ææW$…DÔÃÐ ¢&VæFW$GVævVöåF$6öçFVçB€¢F$æÖP¢“°  ¢²$F–Ç’"Â$'—72%Òæf÷$V6‚€¢æÖSÓç° ¢6öç7B'FãÐ¢B‚&GVævVöåF$'Fâ"¶æÖR“°  ¢–b†'Fâ—° ¢'Fâç7G–ÆRæ÷6—G“Ð ¢æÖRçFôÆ÷vW$66R‚“ÓÓÐ¢F$æÖP¢ð¢# ¢ ¢"ãSR#° ¢Ð ¢Ð¢“° §Ð  ¦gVæ7F–öâ&VæFW$&÷75F$6öçFVçB‡F$æÖR—° ¢–b‡F$æÖSÓÓÒ&†VÆÂ"—° ¢&WGW&â€ ¢sÆF—b7G–ÆSÒ&föçB×6—¦S£7ƒ¶Æ–æRÖ†V–v‡C£ãƒ¶6öÆ÷#¢6#6S†3²#âr°¢.YËxØD$õ5>[	®iÊ®ŠŠÞŠˆŽZèÎh‰8""°¢#ÂöF—câ  ¢“° ¢Ð  ¢&WGW&â€ ¢sÆF—b7G–ÆSÒ&föçB×6—¦S£7ƒ¶Æ–æRÖ†V–v‡C£ãƒ¶6öÆ÷#¢6#6S†3²#âr°¢.X¾K«¤$õ5>[	®iÊ®ŠŠÞŠˆŽZèÎh‰8""°¢#ÂöF—câ  ¢“° §Ð  ¦gVæ7F–öâ7v—F6„&÷75F"‡F$æÖR—° ¢6öç7B6öçF–æW#Ð¢B‚&&÷75F$6öçFVçB"“°  ¢–b‚6öçF–æW"—°¢&WGW&ã°¢Ð  ¢6öçF–æW"æ–ææW$…DÔÃÐ ¢&VæFW$&÷75F$6öçFVçB€¢F$æÖP¢“°  ¢²%W'6öæÂ"Â$†VÆÂ%Òæf÷$V6‚€¢æÖSÓç° ¢6öç7B'FãÐ¢B‚&&÷75F$'Fâ"¶æÖR“°  ¢–b†'Fâ—° ¢'Fâç7G–ÆRæ÷6—G“Ð ¢æÖRçFôÆ÷vW$66R‚“ÓÓÐ¢F$æÖP¢ð¢# ¢ ¢"ãSR#° ¢Ð ¢Ð¢“° §Ð    ¦gVæ7F–öâ6Æ–ÔF–Ç•VW7B‡VW7D–B—° ¢6öç7BVW7CÐ ¢F–Ç•VW7DFVf–æ—F–öç2æf–æB€¢Óçæ–CÓÓ×VW7D–@¢“°  ¢–b‚VW7B—°¢&WGW&ã°¢Ð  ¢6öç7B&öw&W73Ð ¢F–Ç•VW7E7FFRç&öw&W75°¢VW7D–@¢×ÇÃ°  ¢–b€¢&öw&W73ÇVW7BævöÂÇÀ¢F–Ç•VW7E7FFRæ6Æ–ÖVE·VW7D–EÐ¢—°¢&WGW&ã°¢Ð  ¢F–Ç•VW7E7FFRæ6Æ–ÖVE·VW7D–EÓÐ¢G'VS°  ¢–b‡VW7Bç&Wv&BævöÆB—° ¢vöÆCÐ¢vöÆB°¢VW7Bç&Wv&BævöÆC° ¢Ð  ¢–b‡VW7Bç&Wv&BæW‡—° ¢6†&VDW‡Ð¢6†&VDW‡°¢VW7Bç&Wv&BæW‡° ¢Ð  ¢WFFTvöÆDF—7Æ’‚“° ¢WFFUT’‚“° ¢6fTvÖR‚“°  ¢ò ¢)ˆRKúîjÚ>ûÉ®iKžh‰Xú®˜xÞ{š¢7VW7EF$&öG¢˜	žX¾ZëžYšŽûÈŽ{jÞhÈYÊŽ8Îjøþiz^K»¾X¹ž8ÞXˆnšûÈžûÈÀ¢KˆÞXhÞi[NX¾Šinz©~˜xÞKèn(	N(	G&VæFW%VW7D6öçFVçB‚¢˜	žX¾ˆˆ®X{Þ[Èþ[{.{i>h¸nh‰XZžX¾XˆnšYNˆz®y¨@¢k‹.iù>X{Þ[ÈþûÈÎKˆÞZÙŽYÊŽK¨n8 ¢¢ð¢–b‚v–æF÷råõ÷cs3c'VÆµVW7D6Æ–Ò—²7v—F6…VW7EF"‚&F–Ç’"“²Ð §Ð  ¦gVæ7F–öâ6Æ–Ô6öÖÖ—76–öåVW7B‡VW7D–B—° ¢6öç7BVW7CÐ ¢6öÖÖ—76–öåVW7DFVf–æ—F–öç2æf–æB€¢Óçæ–CÓÓ×VW7D–@¢“°  ¢–b‚VW7B—°¢&WGW&ã°¢Ð  ¢6öç7B&öw&W73Ð ¢6öÖÖ—76–öåVW7E7FFRç&öw&W75°¢VW7D–@¢×ÇÃ°  ¢–b€¢&öw&W73ÇVW7BævöÂÇÀ¢6öÖÖ—76–öåVW7E7FFRæ6Æ–ÖVE·VW7D–EÐ¢—°¢&WGW&ã°¢Ð  ¢6öÖÖ—76–öåVW7E7FFRæ6Æ–ÖVE·VW7D–EÓÐ¢G'VS°  ¢–b‡VW7Bç&Wv&BævöÆB—° ¢vöÆCÐ¢vöÆB°¢VW7Bç&Wv&BævöÆC° ¢Ð  ¢–b‡VW7Bç&Wv&BæW‡—° ¢6†&VDW‡Ð¢6†&VDW‡°¢VW7Bç&Wv&BæW‡° ¢Ð  ¢WFFTvöÆDF—7Æ’‚“° ¢WFFUT’‚“° ¢6fTvÖR‚“°¢–b‚v–æF÷råõ÷cs3c'VÆµVW7D6Æ–Ò—²7v—F6…VW7EF"‚&6öÖÖ—76–öâ"“²Ð §Ð  ¦gVæ7F–öâcs3c6Æ–ÔÆÅVW7Dw&÷W†FVf–æ—F–öç2Ç7FFRÆ6Æ–ÔfâÇF—FÆR—°¢6öç7B–G3ÖvWD6Æ–Ö&ÆUVW7D–G2†FVf–æ—F–öç2Ç7FFR“°¢–b‚–G2æÆVæwF‚—²cs3c&Vg&W6„÷VåVW7EvR‚“²&WGW&â²Ð¢v–æF÷råõ÷cs3c'VÆµVW7D6Æ–Ó×G'VS°¢G'—²–G2æf÷$V6‚†gVæ7F–öâ†–B—²6Æ–Ôfâ†–B“²Ò“²Ð¢f–æÆÇ—²v–æF÷råõ÷cs3c'VÆµVW7D6Æ–ÓÖfÇ6S²Ð¢cs3c&Vg&W6„÷VåVW7EvR‚“°¢–b‡G—Vöbv–æF÷rç'tÆW'CÓÓÒ&gVæ7F–öâ"—°¢fö–Bv–æF÷rç'tÆW'B‚.[{.Kˆ˜Û^š	ŽXùb"¶–G2æÆVæwF‚²"X²"·F—FÆR².xØîX»^8""Ç·F—FÆS§F—FÆR².xØîX»R"Æ6öæf—&ÕFW‡C¢.yú^˜>K¨b"ÇFöæS¢'7V66W72'Ò“°¢Ð¢&WGW&â–G2æÆVæwFƒ°§Ð¦gVæ7F–öâcs3c6Æ–ÔÆÄF–Ç•VW7G2‚—°¢&WGW&âcs3c6Æ–ÔÆÅVW7Dw&÷W†F–Ç•VW7DFVf–æ—F–öç2ÆF–Ç•VW7E7FFRÆ6Æ–ÔF–Ç•VW7BÂ.jøþiz^K»¾X¹’"“°§Ð¦gVæ7F–öâcs3c6Æ–ÔÆÄ6öÖÖ—76–öåVW7G2‚—°¢&WGW&âcs3c6Æ–ÔÆÅVW7Dw&÷W†6öÖÖ—76–öåVW7DFVf–æ—F–öç2Æ6öÖÖ—76–öåVW7E7FFRÆ6Æ–Ô6öÖÖ—76–öåVW7BÂ.ZyNŠ‰~K»¾X¹’"“°§Ð§v–æF÷rçcs3c6Æ–ÔÆÄF–Ç•VW7G3×cs3c6Æ–ÔÆÄF–Ç•VW7G3°§v–æF÷rçcs3c6Æ–ÔÆÄ6öÖÖ—76–öåVW7G3×cs3c6Æ–ÔÆÄ6öÖÖ—76–öåVW7G3° ¢ò¢ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÐ¢)ˆRYÉn™£ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÒ¢ð ¦gVæ7F–öâ&VæFW$&W7F–'”6öçFVçB‚—° ¢6öç7BÆÅ¦öæT'&—3Õ°¢f÷&W7DÖöç7FW'2À¢FW6W'DÖöç7FW'2À¢–6TÖ÷VçF–äÖöç7FW'2À¢¦öæSDÖöç7FW'2À¢¦öæSTÖöç7FW'2À¢¦öæSdÖöç7FW'2À¢¦öæStÖöç7FW'2À¢¦öæS„Ööç7FW'0¢Ó°  ¢6öç7B6VVäæÖW3Ð¢æWr6WB‚“°  ¢ÆWB‡FÖÃÐ¢"#°  ¢ÆÅ¦öæT'&—2æf÷$V6‚€¢¦öæT'&“Óç° ¢¦öæT'&’æf÷$V6‚€¢Ööç7FW#Óç° ¢–b€¢6VVäæÖW2æ†2€¢Ööç7FW"ææÖP¢¢—°¢&WGW&ã°¢Ð  ¢6VVäæÖW2æFB€¢Ööç7FW"ææÖP¢“°  ¢6öç7BVçG'“Ð ¢&W7F–'”FF°¢Ööç7FW"ææÖP¢Ó°  ¢6öç7BVÆVÖVçCÐ ¢VÆVÖVçDFF&6U°¢Ööç7FW"æVÆVÖVç@¢Ð¢ÇÀ¢VÆVÖVçDFF&6Ræf—&S°  ¢‡FÖÂ³Ð ¢sÆF—b6Æ73Ò&†öÖRÖfVGW&R×&÷r#âr° ¢#Ç7ãâ"° ¢€¢VçG'’bbVçG'’ç6VVà¢ð¢vWDVÆVÖVçD–6öä…DÔÂ€¢Ööç7FW"æVÆVÖVç@¢’°¢""¶Ööç7FW"ææÖP¢ ¢.ûÉþûÉþûÉò ¢’° ¢#Â÷7ãâ"° ¢#Ç7ãâ"° ¢€¢VçG'’bbVçG'’ç6VVà¢ð¢.i8®jë¢"²†VçG'’æ¶–ÆÇ7ÇÃ¢ ¢.iÊ®˜~Šh² ¢’° ¢#Â÷7ãâ"° ¢#ÂöF—câ#° ¢Ð¢“° ¢Ð¢“°  ¢&WGW&â‡FÖÃ° §Ð  ¢ò¢ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÐ¢)ˆRh‰[£ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÒ¢ð ¦gVæ7F–öâ&VæFW$6†–WfVÖVçD6öçFVçB‚—° ¢ÆWB‡FÖÃÐ¢"#°  ¢6†–WfVÖVçDFVf–æ—F–öç2æf÷$V6‚€¢6†–WfVÖVçCÓç° ¢6öç7BFöæSÐ ¢6†–WfVÖVçBæ6†V6²‚“°  ¢6öç7B6Æ–ÖVCÐ ¢6†–WfVÖVçE7FFU°¢6†–WfVÖVçBæ–@¢Ó°  ¢6öç7B&Wv&EFW‡CÐ ¢ö&¦V7Bæ¶W—2€¢6†–WfVÖVçBç&Wv&@¢¢æÖ€¢¶W“Óà¢6†–WfVÖVçBç&Wv&E¶¶W•Ò²" ¢¢æ¦ö–â‚.8"“°  ¢‡FÖÂ³Ð ¢sÆF—b6Æ73Ò&†öÖRÖfVGW&R×&÷r#âr° ¢#Ç7ãâ"°¢6†–WfVÖVçBææÖR°¢#Æ'#â"°¢sÇ7â7G–ÆSÒ&föçB×6—¦S£ƒ¶6öÆ÷#¢6#6S†3²#âr°¢6†–WfVÖVçBæFW62°¢.xØîX»^ûÉ¢"·&Wv&EFW‡B°¢#Â÷7ãâ"°¢#Â÷7ãâ"° ¢sÆ'WGFöâ6Æ73Ò&†öÖRÖfVGW&RÖ'W’Ö'Fâ"r° ¢€¢FöæRÇÂ6Æ–ÖV@¢ð¢&F—6&ÆVB ¢ ¢" ¢’° ¢vöæ6Æ–6³Ò&6Æ–Ô6†–WfVÖVçB…Ârr°¢6†–WfVÖVçBæ–B°¢uÂr’#âr° ¢€¢6Æ–ÖV@¢ð¢.[{.š	ŽXùb ¢ ¢FöæP¢ð¢.š	ŽXùb ¢ ¢.iÊ®˜Nh‰ ¢’° ¢#Âö'WGFöãâ"° ¢#ÂöF—câ#° ¢Ð¢“°  ¢&WGW&â‡FÖÃ° §Ð  ¦gVæ7F–öâ6Æ–Ô6†–WfVÖVçB†6†–WfVÖVçD–B—° ¢6öç7B6†–WfVÖVçCÐ ¢6†–WfVÖVçDFVf–æ—F–öç2æf–æB€¢Óææ–CÓÓÖ6†–WfVÖVçD–@¢“°  ¢–b‚6†–WfVÖVçB—°¢&WGW&ã°¢Ð  ¢–b€¢6†–WfVÖVçBæ6†V6²‚’ÇÀ¢6†–WfVÖVçE7FFU¶6†–WfVÖVçD–EÐ¢—°¢&WGW&ã°¢Ð  ¢6†–WfVÖVçE7FFU¶6†–WfVÖVçD–EÓÐ¢G'VS°  ¢–b†6†–WfVÖVçBç&Wv&BævöÆB—° ¢vöÆCÐ¢vöÆB°¢6†–WfVÖVçBç&Wv&BævöÆC° ¢Ð  ¢WFFTvöÆDF—7Æ’‚“° ¢6fTvÖR‚“°  ¢6öç7B&öG”VÃÐ¢B‚&†öÖTfVGW&TÖöFÄ&öG’"“°  ¢–b†&öG”VÂ—° ¢&öG”VÂæ–ææW$…DÔÃÐ¢&VæFW$6†–WfVÖVçD6öçFVçB‚“° ¢Ð §Ð  ¢ò¢ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÐ¢)ˆRXZÎY £ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÒ¢ð ¦gVæ7F–öâ&VæFW$ææ÷Væ6VÖVçD6öçFVçB‚—° ¢6öç7B&VÆV6UWFFSÐ¢v–æF÷räf÷W%7–Ö&öÇ5&VÆV6UWFFS° ¢–b€¢&VÆV6UWFFRb`¢G—Vöb&VÆV6UWFFRç&VæFW$ææ÷Væ6VÖVçD6öçFVçCÓÓÒ&gVæ7F–öâ ¢—°¢6öç7B&VÆV6T6öçFVçCÐ¢&VÆV6UWFFRç&VæFW$ææ÷Væ6VÖVçD6öçFVçB‚“° ¢–b‡&VÆV6T6öçFVçB—°¢&WGW&â&VÆV6T6öçFVçC°¢Ð¢Ð ¢&WGW&â€ ¢sÆF—b7G–ÆSÒ&föçB×6—¦S£7ƒ¶Æ–æRÖ†V–v‡C£ãƒ²#âr° ¢.K‹¾YøîXZŽikiKžx˜ŽûÈÆ'#â"°¢.ikZ)îYXn[©~8YÉn™8jøþiz^K»¾X¹ž8h‰[{;¾{[ûÈÂ"°¢.jÚ‹øîhZ.hZ.˜	¾˜	¾8#Æ'#ãÆ'#â"° ¢.™h¾y›ÎKŠÞX©þˆ;ÞûÉ£Æ'#â"°¢.i»NZI®Š9ÞX)ž8i»NZI®YËXØ8i»NZI®h¨ˆ;ÞûÈÂ"°¢.™›Ž{¨Îi»NikKŠÞ8""° ¢#ÂöF—câ  ¢“° §Ð  ¦gVæ7F–öâ&VæFW%7—7FVÔ6öçFVçB‚—° ¢&WGW&â€¢sÆF—b6Æ73Ò'7—7FVÒ×æVÂ#âr°¢sÆF—b6Æ73Ò'7—7FVÒ×æVÂ×&÷r#âr°¢sÆF—cãÇ7G&öæsî˜®h‹.ZÙŽj©CÂ÷7G&öæsãÇ6ÖÆÃîyºîX˜Þ˜®h‹.iÈ>ˆz®X¹^ZÙŽj©NûÈÎK™þXúþKº^z¸¾XÛ>h˜¾X¹^KùÞZÙŽ8#Â÷6ÖÆÃãÂöF—câr°¢sÆ'WGFöâ6Æ73Ò&†öÖRÖfVGW&RÖ'W’Ö'Fâ"öæ6Æ–6³Ò'6fTvÖR‚“¶ÆW'B…Â~[{.ZèÎh‰h˜¾X¹^ZÙŽj©N8%Âr’#îz¸¾XÛ>ZÙŽj©CÂö'WGFöãâr°¢sÂöF—câr°¢sÆF—b6Æ73Ò'7—7FVÒ×æVÂ×&÷r#âr°¢sÆF—cãÇ7G&öæsî[‹>‰™þzêycÂ÷7G&öæsãÇ6ÖÆÃîiú^yÈ¾yºîX˜Òf—&V&6RT”N8y›¾X{®h‰nXˆ~hù¾[‹>‰™þ8#Â÷6ÖÆÃãÂöF—câr°¢sÆ'WGFöâ6Æ73Ò&†öÖRÖfVGW&RÖ'W’Ö'Fâ"öæ6Æ–6³Ò'v–æF÷räf÷W%7–Ö&öÇ57F'GWöÆ–7’bgv–æF÷räf÷W%7–Ö&öÇ57F'GWöÆ–7’æ÷Vä66÷VçDÖævW"‚’#îXˆ~hù¾[‹>‰™þûÈþ{hZé®[‹>‰™óÂö'WGFöãâr°¢sÂöF—câr°¢sÆF—b6Æ73Ò'7—7FVÒ×æVÂ×&÷r#âr°¢sÆF—cãÇ7G&öæsîZê.iÈÞKúzëÂ÷7G&öæsãÇ6ÖÆÃîiú^yÈ¾8®Y¹¾‹kþk™nX+>8¾Zê.iÈÞˆþ{Zikž[Èþ8#Â÷6ÖÆÃãÂöF—câr°¢sÆ'WGFöâ–CÒ'7—7FVÕ7W÷'DVÖ–Ä'WGFöâ"6Æ73Ò&†öÖRÖfVGW&RÖ'W’Ö'Fâ"öæ6Æ–6³Ò'v–æF÷räf÷W%7–Ö&öÇ57W÷'Bç6†÷r‚’#îiú^yÈ¾KúzëÂö'WGFöãâr°¢sÂöF—câr°¢sÆF—b6Æ73Ò'7—7FVÒ×æVÂ×&÷rFævW"#âr°¢sÆF—cãÇ7G&öæsîXŠ®™šNŠy.ˆ›#Â÷7G&öæsãÇ6ÖÆÃîXŠ®™šNXZŽ˜:ŽŠy.ˆ›.ˆˆ~˜®h‹.˜.[ªnûÈÎ‹ùNY¹îX‰ÞZx¾X›^Šy.š™Ú.8#Â÷6ÖÆÃãÂöF—câr°¢sÆ'WGFöâ6Æ73Ò&†öÖRÖfVGW&RÖ'W’Ö'Fâ"öæ6Æ–6³Ò'&W6WDvÖR‚’#îXŠ®™šNŠy.ˆ›#Âö'WGFöãâr°¢sÂöF—câr°¢sÂöF—câp¢“° §Ð  ¦gVæ7F–öâ&W7DD†öÖR‚—° ¢–b†&GFÆT7F—fR—° ¢ÆW'B€¢.h‹šÊ^KŠÞxJk9^KÉhþ8" ¢“° ¢&WGW&ã° ¢Ð  ¢6öç7BæVVG5&W7CÖvWDW†—7F–æu'G”–æFW†W2‚’ç6öÖR†–æFWƒÓç°¢6öç7B6†&7FW#ÖvWE'G”6†&7FW$'”–æFW‚†–æFW‚“°¢6öç7B7FG3ÖvWE'G”&GFÆU7FG2†–æFW‚“°¢&WGW&â6†&7FW"æ‡Ç7FG2æÖ„…ÇÂ6†&7FW"ç7Ç7FG2æÖ…5°¢Ò“° ¢–b‚æVVG5&W7B—° ¢ÆW'B€¢$…85[{.{i>iŠþk»þy¨NK¨n8" ¢“° ¢&WGW&ã° ¢Ð  ¢vWDW†—7F–æu'G”–æFW†W2‚’æf÷$V6‚†–æFWƒÓç°¢6öç7B6†&7FW#ÖvWE'G”6†&7FW$'”–æFW‚†–æFW‚“°¢6öç7B7FG3ÖvWE'G”&GFÆU7FG2†–æFW‚“°¢6†&7FW"æ‡×7FG2æÖ„…°¢6†&7FW"ç7×7FG2æÖ…5°¢Ò“°  ¢WFFUT’‚“° ¢6fTvÖR‚“°  ¢ÆW'B€¢.KÉhþZèÎyZ.ûÈÄ…ûÈõ5[{.{i>XZŽ˜:ŽŠ9Îk»þ8" ¢“° §Ð  ¢ò¢ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÐ¢c“"(	BK‹¾Yøî™h¾y›ÎkŠÎŠšn[ú¾hÛ~˜ÛP£ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÒ¢ð ¦gVæ7F–öâw&çEFW7DvöÆDÖ–ÆÆ–öâ‚—°¢vöÆCÐ¢ÖF‚æÖ‚ƒÄÖF‚æfÆö÷"„çVÖ&W"†vöÆB—ÇÃ’’°¢DU5EôtôÄEôu$åC° ¢WFFTvöÆDF—7Æ’‚“°¢WFFUT’‚“°¢6fTvÖR‚“° ¢ÆW'B€¢.˜y[š2³ÃÃûÈÎyºîX˜ÞX[iÈ’"°¢vöÆBçFôÆö6ÆU7G&–ær‚'¦‚ÕEr"’°¢"˜y[š>8" ¢“°§Ð ¦gVæ7F–öâw&çEFW7DW‡FVäÖ–ÆÆ–öâ‚—°¢6†&VDW‡Ð¢ÖF‚æÖ‚ƒÄÖF‚æfÆö÷"„çVÖ&W"‡6†&VDW‡—ÇÃ’’°¢DU5EôU…õôôÅôu$åC° ¢WFFUT’‚“°¢6fTvÖR‚“° ¢ÆW'B€¢.{i>š™~k³ÃÃÃûÈÎyºîX˜ÞX[iÈ’"°¢6†&VDW‡çFôÆö6ÆU7G&–ær‚'¦‚ÕEr"’°¢"U…8" ¢“°§Ð ¦gVæ7F–öâWFFT†öÖUFW7EFööÇ2‚—°¢6öç7BvöÆD'WGFöãÒB‚'FW7DvöÆDÖ–ÆÆ–öä'WGFöâ"“°¢6öç7BW‡'WGFöãÒB‚'FW7DW‡FVäÖ–ÆÆ–öä'WGFöâ"“° ¢–b†vöÆD'WGFöâ—°¢vöÆD'WGFöâæ–ææW$…DÔÃÒ.˜y[š2Æ#â³‰
ÃÂö#â#°¢Ð ¢–b†W‡'WGFöâ—°¢W‡'WGFöâæ–ææW$…DÔÃÒ.{i>š™~kÆ#â³XHCÂö#â#°¢Ð§Ð  ¢ò ¢)ˆRkŠÎŠšnyJŽûÉ®h¨ˆ;Þ›¹â³““ž8  ¢{IN{+žikžKëþKÚkŠÎŠšnh¨ˆ;ÞiXŽiéÎûÈŽ[
NX[niŠþxx>xy.˜	žzŠà¢™ÈŠhKˆ‹zþXØ~{I®h˜ÞyÈ¾[é~X{®[zîy[y¨Nh¨ˆ;ÞûÈžûÈÀ¢K˜¾[èÎjÚ>[Èþx˜ŽKˆ®{y®X˜ÞŠ‰Ž[é~h¨®˜	ž[Ë^XÚx˜p¢‹yþ˜	žX¾X{Þ[ÈþKˆ‹[~h»þhèž8 ¢¢ð ¦gVæ7F–öâw&çEFW7E6¶–ÆÅö–çG2‚—° ¢ò ¢)ˆRKúîjÚ>ûÉ ¢XéþiÊÎ˜	žŠ:Zú¾jÛ¾Xú®Xª{ZgÆ–W.ûÈŽzÊÎKˆŠy.ˆ›.ûÈžûÈÀ¢zÊÎK¨ÎŠy.ˆ›.kŽ˜kŠÎŠšnKˆÞX‹8Î{Zn›¹îi[Ž8Þ˜	žX¾hÈž˜‰^ûÈÀ¢Zëži‰>Šé>K«®ŠªNKº^x+®zÊÎK¨ÎŠy.ˆ›.y¨Nh¨ˆ;Þ›¹îiŠþ[éîXŠ^y¨NYËik¢ûÈŽyI®ˆ{6'V~ûÈžXi.X{®Kèny¨N8 ¢iKžh‰Æ–W#.ZÙŽYÊŽy¨NŠ›XZž˜(®˜;ÞYNXª““žûÈÀ¢kŠÎŠšnY:®X¾Šy.ˆ›.˜;ÞikžKëþ8 ¢¢ð ¢Æ–W"ç6¶–ÆÅö–çG2³Ó“““°  ¢ÆWBÖW76vSÐ ¢.h¨ˆ;Þ›¹â³““žûÈÎ8Â"°¢‡Æ–W"æ–GÇÂ.zÊÎKˆŠy.ˆ›""’°¢.8ÞyºîX˜ÞX[iÈ’"°¢Æ–W"ç6¶–ÆÅö–çG2°¢.›¹î8"#°  ¢–b‡Æ–W#"—° ¢Æ–W#"ç6¶–ÆÅö–çG2³Ó“““°  ¢ÖW76vR³Ð ¢%Æî8Â"°¢Æ–W#"æ–B°¢.8ÞyºîX˜ÞX[iÈ’"°¢Æ–W#"ç6¶–ÆÅö–çG2°¢.›¹î8"#° ¢Ð ¢–b‡Æ–W#2—° ¢Æ–W#2ç6¶–ÆÅö–çG2³Ó“““° ¢ÖW76vR³Ð¢%Æî8Â"°¢Æ–W#2æ–B°¢.8ÞyºîX˜ÞX[iÈ’"°¢Æ–W#2ç6¶–ÆÅö–çG2°¢.›¹î8"#° ¢Ð  ¢WFFUT’‚“° ¢&VæFW%6¶–ÆÄÆöF÷WB‚“° ¢6fTvÖR‚“°  ¢ÆW'B€¢ÖW76vP¢“° §Ð  ¢ò ¢)ˆRikZ)îûÈŽkŠÎŠšnyJŽûÈžûÉ®{i>š™~k³8  ¢{IN{+žikžKëþkŠÎŠšnXØ~{I®8h¨ˆ;Þ™h¾iKî™hj«¾˜	žšà¢™ÈŠh{{NX©þ{{N[èŽK˜^h˜ÞyÈ¾[é~X‹iXŽiéÎy¨NiÛŠ[þûÈÀ¢y»Nhê^h¨®{i>š™~ZÙŽ˜.X[yJŽ{i>š™~kûÈÀ¢K˜¾[èÎŠhKˆÞŠhXˆn{ZnŠy.ˆ›.˜(NiŠþxZ~XéþiÊÎy¨Nikž[Èð¢ˆz®[{Xë¾Xˆn˜XÞ8.K˜¾[èÎjÚ>[Èþx˜ŽKˆ®{y®X˜ÞŠ‰Ž[ép¢h¨®˜	žX¾hÈž˜‰^‹yþ˜	žX¾X{Þ[ÈþKˆ‹[~h»þhèž8 ¢¢ð ¦gVæ7F–öâw&çEFW7DW‡‚—° ¢6†&VDW‡³Ó° ¢WFFUT’‚“° ¢6fTvÖR‚“°  ¢ÆW'B€¢.{i>š™~k³ûÈÎyºîX˜ÞX[iÈ’"°¢6†&VDW‡°¢.›¹î{i>š™~XÎ8" ¢“° §Ð  ¦gVæ7F–öâF—7G&–'WFTW‡FõÆ–W"‚—° ¢F—7G&–'WFTW‡Fô6†&7FW"€¢Æ–W ¢“° §Ð  ¢ò ¢)ˆRikZ)îûÉ®Xˆn˜XÞ{i>š™~XÎ{ZnzÊÎK¨ÎŠy.ˆ›.8 ¢‹yöF—7G&–'WFTW‡FõÆ–W"‚žiŠþYÎKˆZY~˜(þ‹ÊþûÈÀ¢y»Nhê^YÎXú¾X[yJŽX{Þ[ÈþûÈÎXú®iŠþhù¾KˆX¾Šy.ˆ›.xšžK»n8 ¢¢ð ¦gVæ7F–öâF—7G&–'WFTW‡FõÆ–W#"‚—° ¢–b‚Æ–W#"—°¢&WGW&ã°¢Ð  ¢F—7G&–'WFTW‡Fô6†&7FW"€¢Æ–W# ¢“° §Ð  ¦gVæ7F–öâF—7G&–'WFTW‡FõÆ–W#2‚—° ¢–b‚Æ–W#2—°¢&WGW&ã°¢Ð ¢F—7G&–'WFTW‡Fô6†&7FW"€¢Æ–W#0¢“° §Ð  ¢ò ¢h¨¦F—7G&–'WFTW‡FõÆ–W"‚žXéþiÊÎy¨N˜(þ‹Êð¢h«Þh‰˜	®yJŽX{Þ[ÈþûÈÇÆ–W"÷Æ–W#.X[yJŽYÎKˆZY~ûÈÀ¢KˆÞyJŽ{jÞŠÛ~XZžK»Þ[›îK˜îKˆjŠ>y¨Nzˆ¾[Èþz+Î8 ¢¢ð ¦gVæ7F–öâF—7G&–'WFTW‡Fô6†&7FW"†6†&7FW"—° ¢–b†&GFÆT7F—fR—° ¢ÆW'B€¢.h‹šÊ^KŠÞxJk9^Xˆn˜XÞ{i>š™~XÎ8" ¢“° ¢&WGW&ã° ¢Ð  ¢–b‡6†&VDW‡ÃÓ—°¢&WGW&ã°¢Ð  ¢ò ¢)ˆRKúîjÚ>ûÉ ¢XéþiÊÎiŠþh¨®{i>š™~k8ÎXZŽ˜:Ž8ÞKˆjÊZî{ZnŠy.ˆ›.ûÈÀ¢Xúþˆ;ÞKˆjÊ˜
>{¨ÎXØ~Z[Þ[›î{I®ûÈÀ¢ˆÎK‰NiÈ>h¨®{i>š™~kkˆ^z›®ûÈÀ¢[îˆ{NxêžZënk).‹ênk9^h¨®XšžKˆ¾y¨N{i>š™p¢yYž{ZnX[nK¹nŠy.ˆ›.8  ¢iKžh‰ûÉ®jøþhÈžKˆjÊûÈÎXú®‹Øžz{¾8ÎX™¾Z[ÞXØ~Kˆ®Kˆ¾Kˆ{I®8Ð¢h˜™ÈŠhy¨N{i>š™~XÎûÈÎKˆjÊXú®XØ~Kˆ{I®8 ¢Zh.iéÎ{i>š™~kKˆÞZJXØ~Kˆ{I®ûÈÀ¢[KˆÞ‹Øžz{¾8hùzK®˜(N[zîZI®[	ûÈÀ¢˜þXXÞ{i>š™~XÎXÚYÊŽKˆX¾KˆÞKˆ®KˆÞKˆ¾y¨Nx¸hX¾8  ¢)ˆRikZ)î™‹.YnûÉ ¢Zh.iéÎŠy.ˆ›.y¨FW‡KˆÞyú^˜>x+®K¸›«Î[{.{i>‹h^˜æW‡æW‡@¢ûÈŽynŠ¹nKˆ®KˆÞŠ›.y›ÎyIþûÈÎKØnZÙŽj©NXúþˆ;ÞYºx+®iùK©¾i8ÞKÙÀ¢yYžKˆ¾KˆÞKˆˆ{Ny¨N‹8~iižûÈžûÈÆæVVFVNiÈ>Šè®h‰‹*i[Žh‰cûÈÀ¢˜	žjŠ>8Ç6†&VDW‡ÆæVVFVN8Þ˜	žX¾XŠNik~kŽ˜iŠöfÇ6^ûÈÀ¢zØžikÎy›Þy›Þ[éî{i>š™~k˜*>Š:8ÎX~8ÞX‹W‡ûÈÀ¢˜(NXúþˆ;ÞŠé66†V6´ÆWfVÅW‚žKˆjÊ‹y[èŽZI®‹Ê®ûÈÀ¢xÎX{®™º.ŠÙÎy¨Nh¨ˆ;Þ›¹âþ[Îh
~›¹îi[ŽZÙ~8 ¢˜	žŠ:XXŽh¨¦æVVFVNZKîYÊŽiÈ[óûÈÀ¢[ëž[©^˜þXXÞ˜	žX¾kÈþkIî8 ¢¢ð ¢6öç7BæVVFVBÐ¢ÖF‚æÖ‚€¢À¢6†&7FW"æW‡æW‡BÐ¢6†&7FW"æW‡ ¢“°  ¢–b‡6†&VDW‡ÆæVVFVB—° ¢ÆW'B€¢.{i>š™~kKˆÞ‹k>Kº^XØ~{I®ûÈÎ˜(N[zâ"°¢†æVVFVB×6†&VDW‡’°¢$U…8" ¢“° ¢&WGW&ã° ¢Ð  ¢6†&7FW"æW‡³Ð¢æVVFVC° ¢6†&VDW‡ÓÐ¢æVVFVC°  ¢6†V6´ÆWfVÅW€¢6†&7FW ¢“° ¢WFFUT’‚“° ¢6fTvÖR‚“° §Ð  ¦gVæ7F–öâ&VæFW$W‡F—7G&–'WFTÆ—7B‚—° ¢6öç7B6öçF–æW"Ð¢B‚&W‡F—7G&–'WFTÆ—7B"“°  ¢–b‚6öçF–æW"—°¢&WGW&ã°¢Ð  ¢6öçF–æW"æ–ææW$…DÔÃÒ"#°  ¢6öç7BVÆVÖVçBÐ¢VÆVÖVçDFF&6U°¢Æ–W"æVÆVÖVç@¢×ÇÀ¢VÆVÖVçDFF&6Ræf—&S°  ¢6öç7BæVVFVBÐ¢ÖF‚æÖ‚€¢À¢Æ–W"æW‡æW‡BÐ¢Æ–W"æW‡ ¢“°  ¢6öç7BÖ–å&÷rÐ¢Fö7VÖVçBæ7&VFTVÆVÖVçB€¢&F—b ¢“°  ¢Ö–å&÷ræ–ææW$…DÔÂÐ ¢ ¢Æ'WGFöà¢–CÒ&F—7G&–'WFTÖ–ä'WGFöâ ¢6Æ73Ò&W‡ÖF—7G&–'WFRÖ'WGFöâ ¢à¢Ç7â6Æ73Ò&W‡Ö6†&7FW"Ö–6öâ#âG¶VÆVÖVçBæ–6öçÓÂ÷7ãà¢Ç7â6Æ73Ò&W‡Ö6†&7FW"Ö6÷’#à¢Ç7G&öæsâG·Æ–W"æ–GÇÆVÆVÖVçBæ6†&7FW'ÓÂ÷7G&öæsà¢Ç6ÖÆÃäÇbâG·Æ–W"æÆWfVÇÒ(i"ÇbâG·Æ–W"æÆWfVÂ³ÓÂ÷6ÖÆÃà¢Â÷7ãà¢Ç7â6Æ73Ò&W‡Ö6†&7FW"Ö6÷7B#à¢Æ#âG¶æVVFVBçFôÆö6ÆU7G&–ær‚'¦‚ÕEr"—ÓÂö#à¢Ç6ÖÆÃäU…Â÷6ÖÆÃà¢Â÷7ãà¢Âö'WGFöãà¢°  ¢6öçF–æW"æVæD6†–ÆB€¢Ö–å&÷p¢“°  ¢ò ¢)ˆRKˆjÊXú®XØ~Kˆ{I®ûÉ ¢{i>š™~kKˆÞZJXØ~Kˆ¾Kˆ{I®i˜.y»Nhê^˜énKØþhÈž˜‰^ûÈÀ¢KˆÞiÈ>Šé>xêžZënŠªNhÈž[èÎh¨®{i>š™~kkˆ^z› ¢XÛ¾XØ~KˆÞK¨n{I®8 ¢¢ð ¢B‚&F—7G&–'WFTÖ–ä'WGFöâ"¢æF—6&ÆVBÐ¢6†&VDW‡ÆæVVFVBÇÀ¢&GFÆT7F—fS°  ¢B‚&F—7G&–'WFTÖ–ä'WGFöâ"¢æöæ6Æ–6²Ð¢F—7G&–'WFTW‡FõÆ–W#°  ¢ò ¢)ˆRzÊÎK¨ÎŠy.ˆ›.y¨NXˆn˜XÞhÈž˜‰^ûÈŽikZ)îûÈž8 ¢Æ–W#.ZÙŽYÊŽy¨NŠ›šþzK®yÉþjÚ>XúþKº^hÈžy¨NhÈž˜‰^ûÈÀ¢˜(þ‹Êþ‹yþzÊÎKˆŠy.ˆ›.y¨NhÈž˜‰^ZèÎXZŽ[Þz‹8 ¢¢ð ¢–b‡Æ–W#"—° ¢6öç7BÆ–W#%&÷sÐ¢Fö7VÖVçBæ7&VFTVÆVÖVçB€¢&F—b ¢“°  ¢6öç7BæVVFVC#Ð¢ÖF‚æÖ‚€¢À¢Æ–W#"æW‡æW‡BÐ¢Æ–W#"æW‡ ¢“°  ¢Æ–W#%&÷ræ–ææW$…DÔÃÐ ¢ ¢Æ'WGFöà¢–CÒ&F—7G&–'WFUÆ–W#$'WGFöâ ¢6Æ73Ò&W‡ÖF—7G&–'WFRÖ'WGFöâ ¢à¢Ç7â6Æ73Ò&W‡Ö6†&7FW"Ö–6öâ#î)xcÂ÷7ãà¢Ç7â6Æ73Ò&W‡Ö6†&7FW"Ö6÷’#à¢Ç7G&öæsâG·Æ–W#"æ–GÓÂ÷7G&öæsà¢Ç6ÖÆÃäÇbâG·Æ–W#"æÆWfVÇÒ(i"ÇbâG·Æ–W#"æÆWfVÂ³ÓÂ÷6ÖÆÃà¢Â÷7ãà¢Ç7â6Æ73Ò&W‡Ö6†&7FW"Ö6÷7B#à¢Æ#âG¶æVVFVC"çFôÆö6ÆU7G&–ær‚'¦‚ÕEr"—ÓÂö#à¢Ç6ÖÆÃäU…Â÷6ÖÆÃà¢Â÷7ãà¢Âö'WGFöãà¢°  ¢6öçF–æW"æVæD6†–ÆB€¢Æ–W#%&÷p¢“°  ¢B‚&F—7G&–'WFUÆ–W#$'WGFöâ"¢æF—6&ÆVCÐ ¢6†&VDW‡ÆæVVFVC"ÇÀ¢&GFÆT7F—fS°  ¢B‚&F—7G&–'WFUÆ–W#$'WGFöâ"¢æöæ6Æ–6³Ð¢F—7G&–'WFTW‡FõÆ–W##° ¢Ð  ¢–b‡Æ–W#2—° ¢6öç7BÆ–W#5&÷sÐ¢Fö7VÖVçBæ7&VFTVÆVÖVçB€¢&F—b ¢“° ¢6öç7BæVVFVC3Ð¢ÖF‚æÖ‚€¢À¢Æ–W#2æW‡æW‡BÐ¢Æ–W#2æW‡ ¢“° ¢Æ–W#5&÷ræ–ææW$…DÔÃÐ¢ ¢Æ'WGFöà¢–CÒ&F—7G&–'WFUÆ–W#4'WGFöâ ¢6Æ73Ò&W‡ÖF—7G&–'WFRÖ'WGFöâ ¢à¢Ç7â6Æ73Ò&W‡Ö6†&7FW"Ö–6öâ#î)xcÂ÷7ãà¢Ç7â6Æ73Ò&W‡Ö6†&7FW"Ö6÷’#à¢Ç7G&öæsâG·Æ–W#2æ–GÓÂ÷7G&öæsà¢Ç6ÖÆÃäÇbâG·Æ–W#2æÆWfVÇÒ(i"ÇbâG·Æ–W#2æÆWfVÂ³ÓÂ÷6ÖÆÃà¢Â÷7ãà¢Ç7â6Æ73Ò&W‡Ö6†&7FW"Ö6÷7B#à¢Æ#âG¶æVVFVC2çFôÆö6ÆU7G&–ær‚'¦‚ÕEr"—ÓÂö#à¢Ç6ÖÆÃäU…Â÷6ÖÆÃà¢Â÷7ãà¢Âö'WGFöãà¢° ¢6öçF–æW"æVæD6†–ÆB€¢Æ–W#5&÷p¢“° ¢B‚&F—7G&–'WFUÆ–W#4'WGFöâ"’æF—6&ÆVCÐ¢6†&VDW‡ÆæVVFVC2ÇÀ¢&GFÆT7F—fS° ¢B‚&F—7G&–'WFUÆ–W#4'WGFöâ"’æöæ6Æ–6³Ð¢F—7G&–'WFTW‡FõÆ–W#3° ¢Ð  ¢ò ¢)ˆRKúîjÚ>ûÉ ¢kNh‹Z:¾ûÈþš*Ž[É>h˜¾˜	žXZžX¾˜énZé®KÙNKØÞhÈž˜‰P¢KéÞxZ~xêžZënŠhk.i[NX¾h»þhèžûÈÎKˆÞXhÞšþzK®ûÈÀ¢˜	žXZžX¾yºîX˜ÞiÊÎKèn[k).iÈžyÉþjÚ>y¨NŠy.ˆ›.‹8~ii¢ûÈŽ™šN™ÙîxêžZënX›^[»®zÊÎK¨ÎŠy.ˆ›.i˜.X™¾Z[Þ˜ŽK¨nYÎjŠ>XX>{JûÈÀ¢KØn˜*>X¾h8^k8Kˆ¾Zún™©¾hé¾y¨NiŠ÷Æ–W#.ûÈÀ¢KˆÞiŠþ˜	žŠ:y¨NkBþš*ŽKÙNKØÞzÊnûÈžûÈÀ¢yYž‰~Xú®iŠþZI®šIŽy¨NŠinŠk®™¹ÎŠˆ®8 ¢¢ð §Ð  ¢ò¢ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÐ¢x¸hX¾Xª›¹à£ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÒ¢ð ¢ò ¢)ˆRx¸hX¾šXˆ~hù¾Šy.ˆ›.ûÈŽikZ)îûÈž8 ¢Xˆ~hù¾y¨Ni˜.X	žŠhh¨§VæF–æu7FG>kˆ^z›®ûÈÀ¢KˆÞxKn8Î˜(Nk).z+®Š¨Þy¨NXª›¹î8ÞiÈ>ŠªN[‹nX‹XúnKˆX¾Šy.ˆ›.‹ª¾Kˆ®8 ¢¢ð ¦gVæ7F–öâ6†ævU7FGW46†&7FW"†F—&V7F–öâ—° ¢6öç7B–æFW†W3ÖvWDW†—7F–æu'G”–æFW†W2‚“° ¢–b†–æFW†W2æÆVæwFƒÃ"—°¢&WGW&ã°¢Ð ¢6öç7B7W'&VçE÷6—F–öãÔÖF‚æÖ‚€¢À¢–æFW†W2æ–æFW„öb‡7FGW46†&7FW$–æFW‚¢“° ¢7FGW46†&7FW$–æFWƒÖ–æFW†W5°¢†7W'&VçE÷6—F–öâ¶F—&V7F–öâ¶–æFW†W2æÆVæwF‚’V–æFW†W2æÆVæwF€¢Ó°  ¢ö&¦V7Bæ¶W—2€¢VæF–æu7FG0¢¢æf÷$V6‚‡7FCÓç° ¢VæF–æu7FG5·7FEÓÓ° ¢Ò“°  ¢WFFU7FGW5&Wf–Wr‚“° §Ð  ¢ò ¢)ˆRikZ)îûÈŽKéÞxZ~KÛþyJŽˆ^Šhk.ûÈÎ8ÎXª›¹îŠhikZ)à¢™[~hÈž[ú¾˜	þXª›¹îjùN‹È>{
YjîûÈÎ˜(NiŠþ™¹žzêÞš
ÞhÈžKˆKˆ°¢³jùN‹È>{
YjîûÈÎZk>y»Nhê^˜ŽKˆX¾8Þ(	N(	N˜ŽK¨`¢™[~hÈžikžjŽûÈžûÉ  ¢X[yJŽy¨N8Î™[~hÈžhÈ{¨ÎŠ{Žy›Î8Þ[þ[z^X[~8.hÈžKˆ°¢ûÈ‡F÷V6‡7F'BöÖ÷W6VF÷vîûÈžXXŽzØ“Sjú¾zy ¢ûÈŽ˜þXXÞh˜¾k¹‹É^›¹îK™þŠ*¾y[nh‰™[~hÈžûÈžûÈÎhê^‰p¢jøó#jú¾zy.ˆz®X¹^YÎXú¾KˆjÊX+>˜.Kèny¨NX{Þ[ÈþûÈÀ¢y»NX‹iKî™h²þh˜¾hÈ~z{¾X{¢þk¹‹[x+®jÚ ¢ûÈ‡F÷V6†VæB÷F÷V6†6æ6VÂöÖ÷W6WWð¢Ö÷W6VÆVf^XZŽ˜:Ž˜;ÞŠhkˆ^hèžŠˆŽi˜.YšŽûÈÀ¢K»¾KÙ^KˆzŠîiKî™h¾h˜¾hÈ~y¨Nikž[Èþ˜;ÞKˆÞˆ;ÞkÈþhê^ûÈÀ¢KˆÞxKnŠˆŽi˜.YšŽiÈ>XÚKØþKˆy»NXªKˆ¾Xë¾ûÈž8  ¢n{XB²òÞhÈž˜‰^ûÈŽiK¾i8¢þš¹N‹:¢þˆ;Þ˜xòþi›®X©²ð¢{+îzYâþiXþhÛ~ûÈžXZŽ˜:ŽYÎXú¾˜	žX¾X{Þ[ÈþûÈÎKˆÞyJ€¢jøþšnhÈž˜‰^YNZú¾KˆK»Þ™[~hÈž˜(þ‹Êþ8 ¢¢ð ¦gVæ7F–öâGF6„Æöæu&W72†VÂÆfâ—° ¢–b‚VÂ—°¢&WGW&ã°¢Ð  ¢ÆWB†öÆEF–ÖV÷WCÖçVÆÃ° ¢ÆWB&WVD–çFW'fÃÖçVÆÃ°  ¢gVæ7F–öâ7F÷‚—° ¢–b††öÆEF–ÖV÷WB—°¢6ÆV%F–ÖV÷WB††öÆEF–ÖV÷WB“°¢†öÆEF–ÖV÷WCÖçVÆÃ°¢Ð  ¢–b‡&WVD–çFW'fÂ—°¢6ÆV$–çFW'fÂ‡&WVD–çFW'fÂ“°¢&WVD–çFW'fÃÖçVÆÃ°¢Ð ¢Ð  ¢gVæ7F–öâ7F'B†R—° ¢Rç&WfVçDFVfVÇB‚“° ¢fâ‚“°  ¢7F÷‚“°  ¢†öÆEF–ÖV÷WCÐ¢6WEF–ÖV÷WB€¢‚“Óç° ¢&WVD–çFW'fÃÐ¢6WD–çFW'fÂ€¢fâÀ¢SP¢“° ¢ÒÀ¢#S ¢“° ¢Ð  ¢VÂæFDWfVçDÆ—7FVæW"€¢'F÷V6‡7F'B"À¢7F'BÀ¢·76—fS¦fÇ6WÐ¢“° ¢VÂæFDWfVçDÆ—7FVæW"€¢&Ö÷W6VF÷vâ"À¢7F'@¢“°  ¢°¢'F÷V6†VæB"À¢'F÷V6†6æ6VÂ"À¢&Ö÷W6WW"À¢&Ö÷W6VÆVfR ¢Òæf÷$V6‚†WgDæÖSÓç° ¢VÂæFDWfVçDÆ—7FVæW"€¢WgDæÖRÀ¢7F÷ ¢“° ¢Ò“° §Ð  ¦gVæ7F–öâFEö–çB‡7FB—° ¢–b€¢ö&¦V7Bç&÷F÷G—Ræ†4÷vå&÷W'G’æ6ÆÂ€¢VæF–æu7FG2À¢7F@¢¢—°¢&WGW&ã°¢Ð  ¢6öç7BF&vWD6†&7FW#Ð¢vWE7FGW46†&7FW$ö&¦V7B‚“°  ¢6öç7BW6VBÐ¢ö&¦V7BçfÇVW2€¢VæF–æu7FG0¢¢ç&VGV6R€¢‡7VÒÇfÇVR“Óà¢7VÒ·fÇVRÀ¢ ¢“°  ¢–b€¢W6VCãÐ¢F&vWD6†&7FW"æGG&–'WFUö–çG0¢—°¢&WGW&ã°¢Ð  ¢VæF–æu7FG5·7FEÒ²³°  ¢WFFU7FGW5&Wf–Wr‚“° §Ð  ¢ò ¢)ˆRikZ)îûÈŽKéÞxZ~KÛþyJŽˆ^hÈ~jÚ>ûÈžûÉ ¢K˜¾X˜Þ˜	žŠ:Xú®iÈ–FEö–çB‚žûÈÎZèÎXZŽk).iÈž[Þhxžy¨@¢k‰¾‰™þX{Þ[ÈþûÈÎ[îˆ{Nx¸hX¾š™Ú.Xˆn˜XÞXØ~{I®›¹îi[Žy¨NYËik¢Xú®ˆ;ÞXª8KˆÞˆ;Þhš>ûÈÎ‹yþX›^Šy.š™Ú.ûÈŽiÊÎKèn[iÈ¢Xªk‰¾XZžšnhÈž˜‰^ûÈžKˆÞKˆˆ{N8 ¢Š9ÎKˆ§&VÖ÷fUö–çB‚žûÈÎXú®ˆ;Þhš>hèž8Î˜	žjÊ˜(Nk) ¢z+®Š¨Þ8iª¾ZÙŽKŠÞ8Þy¨N›¹îi[ŽûÈÎKˆÞiÈ>X¹^X‹Šy.ˆ› ¢[{.{i>yIþiXŽy¨N[Îh
~XÎûÈÎ˜(þ‹ÊþKˆ®‹yþX›^Šy.š™Ú.y¨@¢7&VF–öäFB‡7FBÂÓžiŠþYÎKˆzŠîX®k9^8 ¢¢ð ¦gVæ7F–öâ&VÖ÷fUö–çB‡7FB—° ¢–b€¢ö&¦V7Bç&÷F÷G—Ræ†4÷vå&÷W'G’æ6ÆÂ€¢VæF–æu7FG2À¢7F@¢¢—°¢&WGW&ã°¢Ð  ¢–b€¢VæF–æu7FG5·7FEÓÃÓ ¢—°¢&WGW&ã°¢Ð  ¢VæF–æu7FG5·7FEÒÒÓ°  ¢WFFU7FGW5&Wf–Wr‚“° §Ð  ¦gVæ7F–öâWFFU7FGW5&Wf–Wr‚—° ¢ò ¢)ˆRKúîjÚ>ûÉ ¢XéþiÊÎ˜	ži[NX¾X{Þ[Èþ˜;ÞZú¾jÛ¾Š¨×Æ–W.ûÈÀ¢zÊÎK¨ÎŠy.ˆ›.k).‹ênk9^yJŽx¸hX¾šXª›¹î8 ¢iKžh‰XXŽh©>8ÎyºîX˜Þ˜ŽKŠÞy¨NŠy.ˆ›.8Ð¢ûÈ‡Æ–W.h‰gÆ–W#.ûÈžûÈÀ¢Kˆ¾™Ú.h˜iÈžŠˆŽzé~˜;Þ[Þ˜	žX¾Šy.ˆ›.X®ûÈÀ¢KˆÞyJŽi[NX¾X{Þ[Èþ˜xÞZú¾XZžK»Þ8 ¢¢ð ¢6öç7BF&vWD6†&7FW#Ð¢vWE7FGW46†&7FW$ö&¦V7B‚“°  ¢6öç7B7W'&VçBÒ° ¢GF6³ ¢F&vWD6†&7FW"æGF6²°¢VæF–æu7FG2æGF6²À ¢f—FÆ—G“ ¢F&vWD6†&7FW"çf—FÆ—G’°¢VæF–æu7FG2çf—FÆ—G’À ¢VæW&w“ ¢F&vWD6†&7FW"æVæW&w’°¢VæF–æu7FG2æVæW&w’À ¢–çFVÆÆ–vVæ6S ¢F&vWD6†&7FW"æ–çFVÆÆ–vVæ6R°¢VæF–æu7FG2æ–çFVÆÆ–vVæ6RÀ ¢7—&—C ¢F&vWD6†&7FW"ç7—&—B°¢VæF–æu7FG2ç7—&—BÀ ¢v–Æ—G“ ¢F&vWD6†&7FW"æv–Æ—G’°¢VæF–æu7FG2æv–Æ—G ¢Ó°  ¢ò ¢)ˆRikZ)îûÈŽKéÞxZ~KÛþyJŽˆ^Šhk.ûÈÎ8Î›¹îi[ŽXˆn˜XÐ¢šþzK®y[nX˜ÞŠy.ˆ›.y¨D…85j)ÞûÈÎXª›¹îš¹N‹:¢ð¢ˆ;Þ˜xþi˜.XúþKº^š	ŠkÞZ)îXªy¨NX¹^yZ¾ûÈÎŠj)ÞiÈ0¢YŽyn{ŠîyúÞ8ÞûÈžûÉ ¢Ö„…öÖ…5XZÎ[Èþ‹yövWD&6U7FG2‚¢Š:y¨Nzé~k9^ZèÎXZŽKˆˆ{NûÈƒš¹N‹:£Ò³S…ûÈÀ¢ˆ;Þ˜xóÒ³U5ûÈžûÈÎXú®iŠþ˜	žŠ:iKžh‰Y0¢F&vWD6†&7FW.ûÈŽXúþˆ;ÞiŠ÷Æ–W.h‰`¢Æ–W#.ûÈžûÈÎKˆÞˆ;Þy»Nhê^YÎXú°¢vWD&6U7FG2‚žûÈŽ˜*>X¾X{Þ[ÈþZú¾jÛ¾h©0¢Æ–W.ûÈžûÈÎˆz®[{˜xÞzé~KˆjÊ8  ¢yºîX˜Ô…õ5ûÈ‡F&vWD6†&7FW"æ‡ûÈòç7ûÈ¢KˆÞiÈ>Yºx+®š	ŠkÞXª›¹îˆÎiKžŠè®ûÈÎXú®iÈž8ÎKˆ®™™8Ð¢iÈ>‹yþ‰wVæF–æu7FG2çf—FÆ—GžûÈòæVæW&w¢XÛ>i˜.š	ŠkÞŠè®XÉn(	N(	N˜	žjŠ>Šj)ÞZúÎ[ª`¢ûÈŽxûîYÊ„…;~š	ŠkÞ[èÎKˆ®™™ûÈž[iÈ>ˆz®xK`¢™ªŽ‰~Kˆ®™™Šè®ZJ~ˆÎ{ŠîyúÞûÈÎKˆÞyJŽXúnZInZú°¢8Î{ŠîyúÞX¹^yZ¾8Þy¨Nx›žjè®˜(þ‹Êþ8 ¢¢ð ¢6öç7B&Wf–WtÖ„…Ð ¢°¢7W'&VçBçf—FÆ—G’£S°¢‡F&vWD6†&7FW"æ&öçW4…ÇÃ“°  ¢6öç7B&Wf–WtÖ…5Ð ¢S°¢7W'&VçBæVæW&w’£R°¢‡F&vWD6†&7FW"æ&öçW55ÇÃ“°  ¢6öç7B7W'&VçD…Ð ¢ÖF‚æÖ–â€¢F&vWD6†&7FW"æ‡ÇÃÀ¢&Wf–WtÖ„… ¢“°  ¢6öç7B7W'&VçE5Ð ¢ÖF‚æÖ–â€¢F&vWD6†&7FW"ç7ÇÃÀ¢&Wf–WtÖ…5 ¢“°  ¢B‚'7FGW5&Wf–Wt‡FW‡B"¢çFW‡D6öçFVçCÐ ¢7W'&VçD…°¢.ûÈò"°¢&Wf–WtÖ„…°  ¢B‚'7FGW5&Wf–Wu7FW‡B"¢çFW‡D6öçFVçCÐ ¢7W'&VçE5°¢.ûÈò"°¢&Wf–WtÖ…5°  ¢B‚'7FGW5&Wf–Wt‡f–ÆÂ"¢ç7G–ÆRçv–GFƒÐ ¢€¢&Wf–WtÖ„…ã ¢ð¢†7W'&VçD…÷&Wf–WtÖ„…£¢ ¢ ¢’°¢"R#°  ¢B‚'7FGW5&Wf–Wu7f–ÆÂ"¢ç7G–ÆRçv–GFƒÐ ¢€¢&Wf–WtÖ…5ã ¢ð¢†7W'&VçE5÷&Wf–WtÖ…5£¢ ¢ ¢’°¢"R#°  ¢ò ¢)ˆRikZ)îûÉ ¢x¸hX¾š™Ú.xûîYÊŽiÈ>šþzK ¢8ÎxêžZën›¹îi[‚²Š9ÞX)žXªh‰Ò{‹ÞYŽ8ÞûÈÀ¢ˆÎKˆÞiŠþXú®šþzK®xêžZënˆz®[{Xª›¹îy¨Ni[ŽZÙ~8 ¢Š9ÞX)žXªh‰h©>[ÞhxžŠy.ˆ›.y¨NŠ9ÞX)žjÈ@¢ûÈ‡Æ–W.(i'Æ–W"æVÆVÖVçN8¢Æ–W#.(i.Y»®Zé¢'Æ–W#".˜	žX¶¶WžûÈžûÈÀ¢‹yþK‹¾Yøî8ˆ8ÎXÈ^šyÈ¾X‹y¨N˜(þ‹ÊþKˆˆ{N8 ¢¢ð ¢6öç7BWV—ÖVçD&öçW2Ð¢vWDWV—ÖVçD&öçW2€¢vWE'G”6†&7FW$¶W’€¢vWE'G”6†&7FW$–æFW‚‡F&vWD6†&7FW"¢¢“°  ¢gVæ7F–öâf÷&ÖE7FDÆ–æR€¢&6UfÇVRÀ¢&öçW5fÇVP¢—° ¢ò ¢)ˆRKúîjÚ>ûÉ ¢K˜¾X˜ÞŠ9ÞX)žXªh‰iŠóy¨Ni˜.X	žXú®šþzK®YjîKˆi[ŽZÙ~ûÈÀ¢xêžZënk).Š9ÞX)žiÛŠ[þi˜.ZèÎXZŽyÈ¾KˆÞX{ ¢8ÎiÈžYÊŽzé~Š9ÞX)žXªh‰8Þ˜	žK»nK¨¾ûÈÀ¢Kº^x+®k).yIþiXŽ8 ¢iKžh‰Kˆ[è¾šþzK®8ÎYû®zHâ¾Š9ÞX)“Þ{‹ÞYŽ8ÞûÈÀ¢[zé~Š9ÞX)žXªh‰iŠóK™þKˆjŠ>šþzK®ûÈÀ¢Kè¾Zh"’³Óž8 ¢¢ð ¢&WGW&â€¢&6UfÇVR°¢"²"°¢&öçW5fÇVR°¢#Ò"°¢€¢&6UfÇVR°¢&öçW5fÇVP¢¢“° ¢Ð  ¢B‚'7FGW4GF6²"¢çFW‡D6öçFVçBÐ¢f÷&ÖE7FDÆ–æR€¢7W'&VçBæGF6²À¢WV—ÖVçD&öçW2æGF6°¢“°  ¢B‚'7FGW5f—FÆ—G’"¢çFW‡D6öçFVçBÐ¢f÷&ÖE7FDÆ–æR€¢7W'&VçBçf—FÆ—G’À¢WV—ÖVçD&öçW2çf—FÆ—G¢“°  ¢B‚'7FGW4VæW&w’"¢çFW‡D6öçFVçBÐ¢f÷&ÖE7FDÆ–æR€¢7W'&VçBæVæW&w’À¢WV—ÖVçD&öçW2æVæW&w¢“°  ¢B‚'7FGW4–çFVÆÆ–vVæ6R"¢çFW‡D6öçFVçBÐ¢f÷&ÖE7FDÆ–æR€¢7W'&VçBæ–çFVÆÆ–vVæ6RÀ¢WV—ÖVçD&öçW2æ–çFVÆÆ–vVæ6P¢“°  ¢B‚'7FGW57—&—B"¢çFW‡D6öçFVçBÐ¢f÷&ÖE7FDÆ–æR€¢7W'&VçBç7—&—BÀ¢WV—ÖVçD&öçW2ç7—&—@¢“°  ¢B‚'7FGW4v–Æ—G’"¢çFW‡D6öçFVçBÐ¢f÷&ÖE7FDÆ–æR€¢7W'&VçBæv–Æ—G’À¢WV—ÖVçD&öçW2æv–Æ—G¢“°  ¢6öç7BW6VBÐ¢ö&¦V7BçfÇVW2€¢VæF–æu7FG0¢¢ç&VGV6R€¢‡7VÒÇfÇVR“Óà¢7VÒ·fÇVRÀ¢ ¢“°  ¢B‚&GG&–'WFUö–çG2"¢çFW‡D6öçFVçBÐ¢ÖF‚æÖ‚€¢À¢F&vWD6†&7FW"æGG&–'WFUö–çG2×W6V@¢“°  ¢B‚&6öæf—&Õ7FGW4'WGFöâ"¢æF—6&ÆVBÐ¢W6VCÓÓÓ°  ¢ò ¢)ˆRKúîjÚ>ûÈŽyÉþjÚ>h©>X‹8ÎzêÞš
ÞXØZ®hî›«Î™yÎ˜;Þ™yÀ¢KˆÞhèž8Þy¨NXéþYºûÈžûÉ ¢˜	žŠ:XéþiÊÎxJj)ÞK»nKéÞxZwÆ–W#.ZÙŽKˆÞZÙŽYÊ€¢˜xÞikŠŠÞZé®šþzK®x¸hX¾ûÈÎZèÎXZŽKˆÞyú^˜>˜	žX°¢XØZ®xûîYÊŽiŠþKˆÞiŠþjÚ>Š*¾Šy.ˆ›.Šinz©p¢ûÈ‡7v—F6„6†&7FW%F"‚žûÈžiX^hHþX	þ‹[ ¢™«‰xþ(	N(	NXú®ŠhxêžZën›¹îKˆjÊ²òÞhÈž˜‰^ûÈÀ¢˜	žŠ:[iÈ>h¨®™«‰xþy¨NiXŽiéÎ‰8¾hèž8˜xÞik ¢šþzK®X{®KènûÈÎ˜	žh˜ÞiŠþ8Îhî›«Î™«‰xþ˜;Þk).yJŽ8Ð¢y¨NyÉþjÚ>XéþYº8  ¢XªKˆX¾XŠNik~ûÉ®Zh.iéÎ˜	žX¾XX>{JjÚ>iŠð¢†öÖTfVGW&T†–FFVå7v—F6„6&NŠ‰Ž˜ÈNy¨@¢˜*>KˆX¾ûÈŽKº>ŠŽyºîX˜ÞjÚ>Š*¾Šy.ˆ›.Šinz©~X	þ‹[ûÈžûÈÀ¢[‹{>˜î˜	žŠ:y¨NšþzK®˜(þ‹ÊþûÈÎ{jÞhÈ™«‰xþûÈÀ¢KˆÞŠh‰8¾hèž8 ¢¢ð ¢6öç7B7v—F6„6&CÐ¢B‚'7FGW46†&7FW%7v—F6„6&B"“°  ¢6öç7BæÖT&÷ƒÐ¢B‚'7FGW46†&7FW$æÖR"“°  ¢–b€¢7v—F6„6&Bb`¢7v—F6„6&BÓÐ¢†öÖTfVGW&T†–FFVå7v—F6„6&@¢—° ¢7v—F6„6&Bç7G–ÆRæF—7Æ“Ð ¢vWDW†—7F–æu'G”–æFW†W2‚’æÆVæwFƒã¢ð¢&&Æö6² ¢ ¢&æöæR#° ¢Ð  ¢–b†æÖT&÷‚—° ¢æÖT&÷‚çFW‡D6öçFVçCÐ¢‡F&vWD6†&7FW"æ–GÇÂ.Xi.™ª®ˆR"’°¢"Çbâ"°¢F&vWD6†&7FW"æÆWfVÃ° ¢Ð §Ð  ¦gVæ7F–öâ6öæf—&Õ7FGW2‚—° ¢6öç7BF&vWD6†&7FW#Ð¢vWE7FGW46†&7FW$ö&¦V7B‚“°  ¢6öç7BW6VBÐ¢ö&¦V7BçfÇVW2€¢VæF–æu7FG0¢¢ç&VGV6R€¢‡7VÒÇfÇVR“Óà¢7VÒ·fÇVRÀ¢ ¢“°  ¢–b€¢W6VCÃÓÇÀ¢W6VCà¢F&vWD6†&7FW"æGG&–'WFUö–çG0¢—°¢&WGW&ã°¢Ð  ¢ò ¢)ˆRKˆjÊz+®Š¨Þ[èÎXZŽ˜:ŽjÛŽ™»nûÈÀ¢KˆÞiÈ>X{®xûîK˜¾X˜Þ8Îz+®Š¨Þ[èÎ˜(Nˆ;ÞK¨.hÈž8Þ˜
h‰y[nj™þ8 ¢¢ð ¢ö&¦V7Bæ¶W—2€¢VæF–æu7FG0¢¢æf÷$V6‚‡7FCÓç° ¢F&vWD6†&7FW%·7FEÒ³Ð¢VæF–æu7FG5·7FEÓ° ¢VæF–æu7FG5·7FEÓÓ° ¢Ò“°  ¢F&vWD6†&7FW"æGG&–'WFUö–çG2ÓÐ¢W6VC°  ¢WFFU7FGW5&Wf–Wr‚“° ¢WFFUT’‚“° ¢6fTvÖR‚“° §Ð  ¢ò¢ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÐ¢h¨ˆ;Ð£ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÒ¢ð ¦6öç7B4´”ÄÅõ$Ud”UuôTÄTÔTåE3Õ²&f—&R"Â'vFW""Â'v–æB"Â&V'F‚%Ó° ¦gVæ7F–öâvWE6¶–ÆÅ&Wf–Wu7VÖÖ'’‡6¶–ÆÂ—° ¢6öç7B66÷W3×°¢6–ævÆS¢.iK¾i8®YjîKˆi[^K«¢"À¢G&“¢.iK¾i8®y»Ž˜Ky¨NKˆhé.i[^K«¢"À¢&÷s¢.iK¾i8®Kˆi[Nhé.i[^K«¢"À¢6öÇVÖã¢.iK¾i8®YÎKˆy»NX‰~i[^K«¢"À¢ÆÃ¢.iK¾i8®i[^ikžXZŽš¹B"À¢ÆÇ“¢.iJþhûNKˆYÞXø¾ik’"À¢ÆÇ”ÆÃ¢.iJþhûNh‰ikžXZŽš¹B"À¢FVDÆÇ“¢.[êžkK¾KˆYÞX	.Kˆ¾y¨NXø¾ik’"À¢æöæS¢.Š*¾X¹^yIþiX‚ ¢Ó° ¢6öç7BVffV7G3ÕµÓ° ¢–b‡6¶–ÆÂæ6FVv÷'“ÓÓÒ'‡—6–6Â"—°¢VffV7G2çW6‚‚.˜
h‰xšžynX+~Zë2"“°¢Ð¢–b‡6¶–ÆÂæ6FVv÷'“ÓÓÒ&Öv–2"—°¢VffV7G2çW6‚‚.˜
h‰k9^Š>X+~Zë2"“°¢Ð¢–b‡6¶–ÆÂæ'W&ä6†æ6R—²VffV7G2çW6‚‚.Xúþˆ;Þ™˜NXªxx>xy""“²Ð¢–b‡6¶–ÆÂæg&VW¦T6†æ6R—²VffV7G2çW6‚‚.Xúþˆ;ÞKÛþyºîj‰žXk["“²Ð¢–b‡6¶–ÆÂç7GVä6†æ6R—²VffV7G2çW6‚‚.Xúþˆ;ÞKÛþyºîj‰ži¨ŽyÊžKŠn™˜ÞKØîYÞKŠÒ"“²Ð¢–b‡6¶–ÆÂæv–Æ—G”F÷vä6†æ6R—²VffV7G2çW6‚‚.Xúþˆ;Þ™˜ÞKØîyºîj‰žiXþhÛr"“²Ð¢–b‡6¶–ÆÂæFÖvTF÷vä6†æ6R—²VffV7G2çW6‚‚.Xúþˆ;Þ™˜ÞKØîyºîj‰ž˜
h‰y¨NX+~Zë2"“²Ð¢–b‡6¶–ÆÂæFVfVç6TF÷vä6†æ6R—²VffV7G2çW6‚‚.Xúþˆ;Þ™˜ÞKØîyºîj‰ž™‹.zjb"“²Ð¢–b‡6¶–ÆÂç7FDF÷vä6†æ6R—²VffV7G2çW6‚‚.Xúþˆ;Þ™˜ÞKØîyºîj‰žZI®š^ˆ;ÞX©²"“²Ð¢–b‡6¶–ÆÂæÆ–fW7FVÅW&6VçD'”ÆWfVÂ—²VffV7G2çW6‚‚.XúþYŽiKnX+~Zë>Y¹î[êžˆz®‹ª²"“²Ð¢–b‡6¶–ÆÂç6VÆe6†–VÆD'”ÆWfVÂ—²VffV7G2çW6‚‚.x+®ˆz®[{[»®z¸¾ŠÛ~y»â"“²Ð¢–b‡6¶–ÆÂæÆÇ•6†–VÆD'”ÆWfVÂ—²VffV7G2çW6‚‚.x+®h‰ikž[»®z¸¾ŠÛ~y»â"“²Ð ¢–b‡6¶–ÆÂæ6FVv÷'“ÓÓÒ&†VÂ"—°¢VffV7G2çW6‚‚.Y¹î[êžXø¾ikžyIþYÞˆˆ~ˆ;Þ˜xò"“°¢Ð¢–b‡6¶–ÆÂæ6FVv÷'“ÓÓÒ'&Wf—fR"—°¢VffV7G2çW6‚‚.Šé>X	.Kˆ¾y¨NXø¾ikž˜xÞikXø>h‹"“°¢Ð¢–b‡6¶–ÆÂæ6FVv÷'“ÓÓÒ'76—fR"—°¢VffV7G2çW6‚‚.kŽK˜^[Ë~XÉnŠ›.XX>{Jy¨Nh‹šÊ^x›žˆ›""“°¢Ð ¢6öç7BæÖVDVffV7G3×°¢&vS¢.hùXØ~h‰ikžxˆni8®ˆ;ÞX©²"À¢FöFvU6¶–ÆÃ¢.hùXØ~h‰ikž™h>‹«.ˆ;ÞX©²"À¢7FVÇF…6¶–ÆÃ¢.Šé>Xø¾ikž˜.XZ^™«‹ª²"À¢F–æv†—6†Vç¦†Vã¢.hùXØ~h‰ikžy[[‹Žx¸hX¾h©~h
r"À¢&ö6µvÆÃ¢.hùXØ~h‰ikž™‹.zjnˆ;ÞX©²"À¢V'F…6†–VÆC¢.‹:nK¨ŽXø¾ikžXøÞX+~iXŽiéÂ"À¢&'&–W#¢.x+®Xø¾ikž[»®z¸¾X+~Zë>{YyXÂ ¢Ó° ¢–b†æÖVDVffV7G5·6¶–ÆÂæ–EÒ—°¢VffV7G2çW6‚†æÖVDVffV7G5·6¶–ÆÂæ–EÒ“°¢Ð ¢&WGW&â°¢66÷W5·6¶–ÆÂçF&vWEG—U×ÇÂ.x›žjè®iXŽiéÂ"À¢ââæVffV7G0¢Òæf–ÇFW"„&ööÆVâ’æ¦ö–â‚.ûÉ²"’².8"#° §Ð ¦gVæ7F–öâ&VæFW$ÆÄVÆVÖVçE6¶–ÆÅ&Wf–Wr†VÆVÖVçB—° ¢6öç7B&öG“ÒB‚'6¶–ÆÅ&Wf–Wt&öG’"“°¢6öç7BF'3ÒB‚'6¶–ÆÅ&Wf–WuF'2"“° ¢–b‚&öG’ÇÂF'2—²&WGW&ã²Ð ¢6öç7B6VÆV7FVCÕ4´”ÄÅõ$Ud”UuôTÄTÔTåE2æ–æ6ÇVFW2†VÆVÖVçB¢òVÆVÖVç@¢¢&f—&R#° ¢F'2æ–ææW$…DÔÃÕ4´”ÄÅõ$Ud”UuôTÄTÔTåE2æÖ†¶W“Óç°¢6öç7BFFÖVÆVÖVçDFF&6U¶¶W•Ó°¢&WGW&âsÆ'WGFöâG—SÒ&'WGFöâ"6Æ73Ò"r°¢†¶W“ÓÓ×6VÆV7FVBò&7F—fR"¢""’°¢r"öæ6Æ–6³Ò'&VæFW$ÆÄVÆVÖVçE6¶–ÆÅ&Wf–Wr…Ârr¶¶W’²uÂr’#âr°¢FFææÖR²~[Îh
sÂö'WGFöãâs°¢Ò’æ¦ö–â‚""“° ¢6öç7B6FVv÷'”æÖW3×°¢‡—6–6Ã¢.xšžyb"À¢Öv–3¢.k9^Š2"À¢'Vfc¢.Z)îy¸¢"À¢†VÃ¢.Y¹î[ê’"À¢&Wf—fS¢.[êžkK²"À¢76—fS¢.Š*¾X¹R ¢Ó° ¢6öç7B6¶–ÆÇ3Ôö&¦V7BçfÇVW2‡6¶–ÆÄFF&6R’æf–ÇFW"€¢6¶–ÆÃÓç6¶–ÆÂæVÆVÖVçCÓÓ×6VÆV7FV@¢“° ¢&öG’æ–ææW$…DÔÃ×6¶–ÆÇ2æÖ‡6¶–ÆÃÓà¢sÆ'F–6ÆR6Æ73Ò'6¶–ÆÂ×&Wf–WrÖ6&B#âr°¢sÆF—cãÇ7G&öæsâr·6¶–ÆÂææÖR²sÂ÷7G&öæsãÇ7ãâr°¢†6FVv÷'”æÖW5·6¶–ÆÂæ6FVv÷'•×ÇÂ.x›žjè¢"’²sÂ÷7ããÂöF—câr°¢sÇâr¶vWE6¶–ÆÅ&Wf–Wu7VÖÖ'’‡6¶–ÆÂ’²sÂ÷âr°¢sÂö'F–6ÆSâp¢’æ¦ö–â‚""“° ¢&öG’ç67&öÆÅF÷Ó°§Ð ¦gVæ7F–öâ÷VäÆÄVÆVÖVçE6¶–ÆÅ&Wf–Wr‚—° ¢6öç7BÖöFÃÒB‚&ÆÄVÆVÖVçE6¶–ÆÅ&Wf–WtÖöFÂ"“°¢–b‚ÖöFÂ—²&WGW&ã²Ð ¢&VæFW$ÆÄVÆVÖVçE6¶–ÆÅ&Wf–Wr‚&f—&R"“°¢ÖöFÂæ6Æ74Æ—7BæFB‚'6†÷r"“°¢ÖöFÂç6WDGG&–'WFR‚&&–Ö†–FFVâ"Â&fÇ6R"“°§Ð ¦gVæ7F–öâ6Æ÷6TÆÄVÆVÖVçE6¶–ÆÅ&Wf–Wr‚—° ¢6öç7BÖöFÃÒB‚&ÆÄVÆVÖVçE6¶–ÆÅ&Wf–WtÖöFÂ"“°¢–b‚ÖöFÂ—²&WGW&ã²Ð ¢ÖöFÂæ6Æ74Æ—7Bç&VÖ÷fR‚'6†÷r"“°¢ÖöFÂç6WDGG&–'WFR‚&&–Ö†–FFVâ"Â'G'VR"“°§Ð ¦gVæ7F–öâ6†ævU6¶–ÆÄ6†&7FW$'&÷r†F—&V7F–öâ—° ¢ò ¢)ˆRKúîjÚ>ûÉ ¢XéþiÊÎiŠóÇ6VÆV7CîKˆ¾h¸ž˜ŽYjîûÈÀ¢iKžh‰‹yþx¸hX¾šKˆˆ{Ny¨N[znXû>zêÞš
ÞXˆ~hù¾ûÈÀ¢kNh‹Z:²þš*Ž[É>h˜¾˜	žXZžX¾yºîX˜Þk).iÈžyÉþjÚ>Šy.ˆ›.‹8~iižy¨@¢˜Žš^K™þKˆKÛ^h»þhèžûÈÀ¢Xú®YÊ†f—&^ûÈŽzÊÎKˆŠy.ˆ›.ûÈž‹y÷Æ–W#.ûÈŽzÊÎK¨ÎŠy.ˆ›.ûÈÀ¢ZÙŽYÊŽy¨NŠ›ûÈžK˜¾™i>Xˆ~hù¾ûÈÎjùN‹È>KˆÞiÈ>ŠªN[îxêžZë`¢Kº^x+®kBþš*ŽK™þˆ;ÞjÚ>[‹ŽyJŽ8 ¢¢ð ¢6öç7B¶W—3ÖvWDW†—7F–æu'G”–æFW†W2‚’æÖ€¢–æFWƒÓævWE'G”6†&7FW$¶W’†–æFW‚¢“° ¢–b†¶W—2æÆVæwFƒÃ"—°¢&WGW&ã°¢Ð ¢6öç7B7W'&VçE÷6—F–öãÔÖF‚æÖ‚€¢À¢¶W—2æ–æFW„öb†7W'&VçE6¶–ÆÄ6†&7FW"¢“° ¢7W'&VçE6¶–ÆÄ6†&7FW#Ö¶W—5°¢†7W'&VçE÷6—F–öâ¶F—&V7F–öâ¶¶W—2æÆVæwF‚’V¶W—2æÆVæwF€¢Ó°  ¢&VæFW%6¶–ÆÄÆöF÷WB‚“° §Ð  ¦gVæ7F–öâvWE6¶–ÆÄ6†&7FW$ö&¦V7B†6†&7FW$–B—° ¢ò ¢)ˆRikZ)îûÉ ¢h¨ˆ;ÞZÛŽ{ù"þXØ~{I®Šhˆ«y¨Nh¨ˆ;Þ›¹îûÈÀ¢yºîX˜ÞXú®iÈ—Æ–W.ûÈ†f—&^ûÈž‹y÷Æ–W# ¢˜	žXZžX¾Šy.ˆ›.iÈžyÉþjÚ>xÚŽz¸¾y¨G6¶–ÆÅö–çG>ûÈÀ¢vFW"÷v–æN˜(NXú®iŠþŠ9ÞX)žyJŽy¨Nz›®jëÎûÈÀ¢k).iÈžˆ8Î[èÎy¨NŠy.ˆ›.‹8~iižûÈÎY¹îX+6çVÆÎûÈÀ¢YÎXú¾y¨NYËikžŠhˆz®[{XŠNikvçVÆÎy¨Nh8^k88 ¢¢ð ¢–b†6†&7FW$–CÓÓÒ&f—&R"—°¢&WGW&âÆ–W#°¢Ð  ¢–b€¢6†&7FW$–CÓÓÒ'Æ–W#""b`¢Æ–W# ¢—°¢&WGW&âÆ–W##°¢Ð ¢–b€¢6†&7FW$–CÓÓÒ'Æ–W#2"b`¢Æ–W#0¢—°¢&WGW&âÆ–W#3°¢Ð  ¢&WGW&âçVÆÃ° §Ð  ¦gVæ7F–öâ&VæFW%6¶–ÆÄÆöF÷WB‚—° ¢ò ¢)ˆRKúîjÚ>ûÉ ¢XéþiÊÎiŠþi»NikÇ6VÆV7CîŠ:XZžX³Æ÷F–öãîy¨Nih~ZÙ~ûÈÀ¢xûîYÊ…TžiKžh‰[znXû>zêÞš
Ò¾KˆX¾YÞZÙ~ikžZ®ûÈÀ¢iKžh‰y»Nhê^i»Nik˜*>X¾ikžZ®y¨Nih~ZÙ~ûÈÀ¢šþzK®yºîX˜Þ˜ŽKŠÞŠy.ˆ›.y¨NYÞZÙr¾zØž{I®ûÈÀ¢‹yþx¸hX¾šy¨NXˆ~hù¾XÚx˜~˜(þ‹ÊþKˆˆ{N8 ¢¢ð ¢6öç7BæÖT&÷ƒÐ¢B‚'6¶–ÆÄ6†&7FW$æÖT&÷‚"“°  ¢–b†æÖT&÷‚—° ¢6öç7B6VÆV7FVD–æFWƒÐ¢7W'&VçE6¶–ÆÄ6†&7FW#ÓÓÒ'Æ–W#2 ¢ò ¢¢7W'&VçE6¶–ÆÄ6†&7FW#ÓÓÒ'Æ–W#" ¢ò¢¢° ¢6öç7B6VÆV7FVD6†&7FW#Ð¢vWE'G”6†&7FW$'”–æFW‚‡6VÆV7FVD–æFW‚—ÇÇÆ–W#° ¢æÖT&÷‚çFW‡D6öçFVçCÐ¢‡6VÆV7FVD6†&7FW"æ–GÇÂ.Šy.ˆ›""²‡6VÆV7FVD–æFW‚³’’°¢"Çbâ"°¢6VÆV7FVD6†&7FW"æÆWfVÃ° ¢Ð  ¢6öç7B6†&7FW"Ð¢6†&7FW%6¶–ÆÄÆöF÷WG5°¢7W'&VçE6¶–ÆÄ6†&7FW ¢Ó°  ¢–b‚6†&7FW"—°¢&WGW&ã°¢Ð  ¢6öç7BÆöF÷WBÐ¢B‚'6¶–ÆÄÆöF÷WB"“°  ¢6öç7BÆÄÆ—7BÐ¢B‚&ÆÅ6¶–ÆÇ4Æ—7B"“°  ¢ÆöF÷WBæ–ææW$…DÔÃÒ"#° ¢ÆÄÆ—7Bæ–ææW$…DÔÃÒ"#°  ¢ò ¢)ˆRKúîjÚ>ûÈŽKéÞxZ~KÛþyJŽˆ^Šhk.ûÈÎ8Îh¨ˆ;Þ˜XÞŠ9Ð¢Xú®šþzK¦–6öî‹yþYÞz‹ûÈÎX[nšIŽ˜;ÞyÈyZ^ûÈÎKˆhé ¢Y¹¾X¾hé.Kˆ‹[~8ÞûÈžûÉ ¢XéþiÊÎjøþjÎXZ~ZëžKˆZJ~K‹.ûÈŽXˆnšâþŠª®iˆâõ5ð¢z{¾™šNhÈž˜‰^ûÈžûÈÎiKžh‰Xú®iÈžYÉnzK¢¾YÞz‹XZžŠÎûÈÀ¢›¹îjÎZÙiÊÎ‹ª¾y»Nhê^Š{Žy›Îz{¾™šNûÈŽiÈžŠ9ÞX)ži˜.ûÈ¢ûÈÎKˆÞXhÞ™ÈŠhšÞZIny¨Nz{¾™šNhÈž˜‰^ih~ZÙ~KÙNKØÞ{Úî8 ¢¢ð ¢f÷"€¢ÆWB“Ó°¢“ÃC°¢’²°¢—° ¢6öç7B6¶–ÆÄ–BÐ¢6†&7FW"æWV—VE6¶–ÆÇ5¶•Ó°  ¢6öç7B&÷‚Ð¢Fö7VÖVçBæ7&VFTVÆVÖVçB€¢&F—b ¢“°  ¢&÷‚æ6Æ74æÖRÐ¢'6¶–ÆÂÖÆöF÷WB×6Æ÷B#°  ¢–b‡6¶–ÆÄ–Bbg6¶–ÆÄFF&6U·6¶–ÆÄ–EÒ—° ¢6öç7B6¶–ÆÂÐ¢6¶–ÆÄFF&6U·6¶–ÆÄ–EÓ°  ¢&÷‚æ–ææW$…DÔÂÐ ¢ ¢ÆF—`¢–CÒ&ÆöF÷WD–6öåòG·6¶–ÆÄ–GÒ ¢6Æ73Ò'6¶–ÆÂÖÆöF÷WB×6Æ÷BÖ–6öâ ¢7G–ÆSÒ&&6¶w&÷VæBÖ–ÖvS¢G¶vWE6¶–ÆÄ–6öä&6¶w&÷VæD–ÖvR‡6¶–ÆÄ–B—Ó² ¢ãÂöF—cà¢ÆF—b6Æ73Ò'6¶–ÆÂÖÆöF÷WB×6Æ÷BÖæÖR#à¢G·6¶–ÆÂææÖWÐ¢ÂöF—cà¢°  ¢&÷‚æöæ6Æ–6³Ð¢‚“Óç&VÖ÷fTWV—VE6¶–ÆÂ†’“° ¢Ð¢VÇ6W° ¢&÷‚æ–ææW$…DÔÂÐ ¢ ¢ÆF—b6Æ73Ò'6¶–ÆÂÖÆöF÷WB×6Æ÷BÖ–6öâ#ãÂöF—cà¢ÆF—`¢6Æ73Ò'6¶–ÆÂÖÆöF÷WB×6Æ÷BÖæÖR ¢7G–ÆSÒ&6öÆ÷#¢3cCsC†#² ¢à¢z› ¢ÂöF—cà¢° ¢Ð  ¢ÆöF÷WBæVæD6†–ÆB€¢&÷€¢“° ¢Ð  ¢ò ¢)ˆRKúîjÚ>ûÈŽKéÞxZ~KÛþyJŽˆ^Šhk.ûÈÎ8ÎKˆÞyJŽx›žXŠP¢XhÞX®KˆX¾[{.ZÛŽiÈ>h¨ˆ;Þy¨NjnK¨nûÈÎh»þhèžûÈÀ¢xûîYÊŽh¨ˆ;Þ[iŠþyJŽKˆhé.Kˆhé.YŽxûîûÈÎk).ZÛŽ{ù ¢y¨N[šþzK®iÊ®ZÛŽ{ù.[Z[Þ8ÞûÈžûÉ ¢XéþiÊÎ8Î[{.ZÛŽiÈ>h¨ˆ;Þ8Þ8ÎXúþZÛŽ{ù.h¨ˆ;Þ8ÞiŠð¢XZžX¾YNˆz®xÚŽz¸¾y¨Ff÷$V6Ž‹ûNYÈŽûÈÎYNˆz ¢VæD6†–ÆNX‹KˆÞYÎZëžYšŽ8.YŽKÛ^h‰KˆX°¢‹ûNYÈŽûÈÎKˆjÊ‹y˜î˜	žX¾Šy.ˆ›.XX>{J[©^Kˆ¾y¨@¢XZŽ˜:Žh¨ˆ;ÞûÈÎjøþKˆX‰~ˆz®[{XŠNik~8Î˜(Nk).ZÛŽûÈð¢[{.ZÛŽiÊ®k»þ{I®ûÈþ[{.k»þ{I®8ÞŠ›.šþzK®Y:®zŠîx¸hX¾ûÈÀ¢XZŽ˜:†VæNX‹YÎKˆX¶ÆÄÆ—7NZëžYšŽ8 ¢¢ð ¢6öç7B6¶–ÆÄÆWfVÇ2Ð¢6†&7FW"ç6¶–ÆÄÆWfVÇ7ÇÀ¢·Ó°  ¢ò ¢)ˆR˜	žX¾Šy.ˆ›.ˆ8Î[èÎyÉþjÚ>y¨N‹8~iižxšžK»`¢ûÈ‡Æ–W.h‰gÆ–W#.ûÈžûÈÀ¢yJŽKèniú^Šš"þšþzK®h¨ˆ;Þ›¹îi[Ž˜xþ8 ¢vFW"÷v–æNyºîX˜Þ˜(Nk).iÈžyÉþjÚ>y¨NŠy.ˆ›.‹8~iižûÈÀ¢6¶–ÆÄ÷væW.iÈ>iŠöçVÆÎûÈÀ¢Kˆ¾™Ú.yJŽX‹y¨NYËikž˜;ÞŠh™‹.Yn‰™^y`¢ûÈŽŠinx+£›¹îh¨ˆ;Þ›¹îûÈÎXZŽ˜:Žh¨ˆ;Þ˜;ÞKˆÞˆ;ÞZÛ‚þXØ~ûÈž8 ¢¢ð ¢6öç7B6¶–ÆÄ÷væW#Ð¢vWE6¶–ÆÄ6†&7FW$ö&¦V7B€¢7W'&VçE6¶–ÆÄ6†&7FW ¢“°  ¢6öç7Bf–Æ&ÆU6¶–ÆÅö–çG3ÔÖF‚æÖ‚€¢À¢çVÖ&W"‡6¶–ÆÄ÷væW"ò6¶–ÆÄ÷væW"ç6¶–ÆÅö–çG2¢—ÇÃ ¢“°  ¢ò ¢)ˆRKúîjÚ>ûÈŽKéÞxZ~KÛþyJŽˆ^Šhk.ûÈÎ8Îh¨ˆ;Þhé.x˜€¢Z)îXª[{.ZÛŽ{ù"þiÊ®ZÛŽ{ù.y¨Nih~ZÙ~Xˆn™©NXØZ®ûÈÀ¢KˆÞyJŽjn{y®ûÈÎXú®Šhih~ZÙ~XØ™©NûÉ¾iÊ®ZÛŽ{ù.y¨@¢h¨ˆ;ÞKˆiznZÛŽiÈ>ûÈÎˆz®X¹^‹yX‹[{.ZÛŽ{ù.˜*>˜(®8ÞûÈžûÉ ¢XéþiÊÎiŠþYjîKˆX¶f÷$V6Ž8KéÞ‹8~iiž[ª¾XéþZx°¢šn[¨þy»Nhê^h¨®jøþKˆX‰vVæNKˆ®Xë¾8.iKžh‰XX€¢zúžX{®˜	žX¾Šy.ˆ›.XX>{J[©^Kˆ¾y¨NXZŽ˜:Žh¨ˆ;Ö–NûÈÀ¢Xˆnh‰8Î[{.ZÛŽ{ù.8Þ8ÎiÊ®ZÛŽ{ù.8ÞXZž{XN™š>X‰~ûÈÀ¢X¾XŠ^k‹.iù>8.Yºx+®jøþjÊ&VæFW%6¶–ÆÄÆöF÷WB‚¢˜;ÞiŠþ˜xÞikXˆn{XNûÈŽKˆÞiŠþZÙŽKˆK»Þ8Î[{.ZÛŽ{ù ¢kˆ^Yjî8Þ[ú¾XùnûÈžûÈÎXú®ŠhZÛŽK¨nikh¨ˆ;Þ8¢6¶–ÆÄÆWfVÇ>Šè®K¨nûÈÎKˆ¾jÊ˜xÞ{š®[iÈ>ˆz®X¹P¢Š*¾XˆnX‹8Î[{.ZÛŽ{ù.8Þ˜*>{XNûÈÎKˆÞyJŽšÞZInZú°¢8Îi
Îz{¾8Þy¨N˜(þ‹Êþ8 ¢¢ð ¢6öç7BÖF6†–æu6¶–ÆÄ–G3Ð ¢ö&¦V7Bæ¶W—2‡6¶–ÆÄFF&6R¢æf–ÇFW"‡6¶–ÆÄ–CÓç° ¢6öç7B6¶–ÆÃÐ¢6¶–ÆÄFF&6U·6¶–ÆÄ–EÓ°  ¢&WGW&â€¢6¶–ÆÂb`¢6¶–ÆÂæVÆVÖVçCÓÓÐ¢€¢6¶–ÆÄ÷væW ¢ð¢6¶–ÆÄ÷væW"æVÆVÖVç@¢ ¢7W'&VçE6¶–ÆÄ6†&7FW ¢¢“° ¢Ò“°  ¢6öç7BÆV&æVD–G3Ð ¢ÖF6†–æu6¶–ÆÄ–G2æf–ÇFW"€¢6¶–ÆÄ–CÓà¢‡6¶–ÆÄÆWfVÇ5·6¶–ÆÄ–E×ÇÃ“ã ¢“°  ¢6öç7BVæÆV&æVD–G3Ð ¢ÖF6†–æu6¶–ÆÄ–G2æf–ÇFW"€¢6¶–ÆÄ–CÓà¢‡6¶–ÆÄÆWfVÇ5·6¶–ÆÄ–EÓã¢“°  ¢ò ¢)ˆRh¨®8Î{XNX{®KˆX‰~h¨ˆ;×&÷~8Þ˜	žjë^˜(þ‹Êþh«Þh‰ ¢xÚŽz¸¾X{Þ[ÈþûÈÎ[{.ZÛŽ{ù"þiÊ®ZÛŽ{ù.XZž{XN˜;ÞYÎXú°¢YÎKˆK»ÞûÈÎKˆÞyJŽZú¾XZžjÊKˆjŠ>y¨D…DÔÎ{XNZÙ~K‹.8 ¢¢ð ¢gVæ7F–öâ'V–ÆE6¶–ÆÅ&÷tVÆVÖVçB‡6¶–ÆÄ–B—° ¢6öç7B6¶–ÆÂÐ¢6¶–ÆÄFF&6U·6¶–ÆÄ–EÓ°  ¢6öç7BÆWfVÂÐ¢6¶–ÆÄÆWfVÇ5·6¶–ÆÄ–E×ÇÀ¢°  ¢6öç7B—4ÆV&æVBÐ¢ÆWfVÃã°  ¢6öç7BWV—VBÐ¢6†&7FW"æWV—VE6¶–ÆÇ0¢æ–æ6ÇVFW2‡6¶–ÆÄ–B“°  ¢6öç7B—4Ö„ÆWfVÂÐ¢—4ÆV&æVBb`¢ÆWfVÃãÐ¢‡6¶–ÆÂæÖ„ÆWfVÇÇÃ“°  ¢6öç7B6äff÷&BÐ¢f–Æ&ÆU6¶–ÆÅö–çG3ãÐ¢‡6¶–ÆÂæÆV&ä6÷7GÇÃ“°  ¢6öç7B&÷‚Ð¢Fö7VÖVçBæ7&VFTVÆVÖVçB€¢&F—b ¢“°  ¢&÷‚æ6Æ74æÖRÐ¢'6¶–ÆÂ×&÷r#°  ¢ÆWB7F–öä–6öã°¢ÆWB7F–öäÆ&VÃ°¢ÆWB7F–öäöæ6Æ–6³°¢ÆWB7F–öäF—6&ÆVC°  ¢6öç7B&W&WÖWBÐ¢—56¶–ÆÅ&W&WÖWB€¢6¶–ÆÄÆWfVÇ2À¢6¶–ÆÀ¢“°  ¢–b‚—4ÆV&æVB—° ¢7F–öä–6öãÒ"#°  ¢ò ¢)ˆRikZ)îûÈŽKéÞxZ~KÛþyJŽˆ^Šhk.ûÈÎ8ÎX˜Þ{Úà¢h¨ˆ;ÞŠhZÛŽy¨Nj™þX‹n8ÞûÈÎK‰NŠh8ÎZèÎXZŽKˆÞˆ;Ð¢›¹î8ÞûÈžûÉ ¢X˜Þ{Úîk).˜Nh‰i˜.XJ®XXŽšþzK®˜énKØþx¸hX¾ûÈÀ¢‰8¾˜îXéþiÊÎy¨N8ÎZÛŽ{ù.ûÈþ›¹îi[ŽKˆÞ‹k>8Ð¢XŠNik~ûÈÎhÈž˜‰^[Ë~X‹fF—6&ÆVC×G'V^ûÈÀ¢xêžZën˜
>›¹î˜;Þ›¹îKˆÞK¨nûÈ‡6V^Kˆ®™Ú ¢ç6¶–ÆÂÖ7F–öâÖ6&BæF—6&ÆVNy¨@¢ö–çFW"ÖWfVçG3¦æöæ^ûÈÎK˜¾X˜Þ˜	žŠ:¢iÈžX¶6Æ7>ZÙ~K‹.[	h™>KˆX¾z›®jÎy¨@¢'V~ûÈÎšnKëþKúîhèžûÈÎKˆÞxKfF—6&ÆV@¢jŠ>[ÈþX[nZún[éîKènk).yÉþy¨NyIþiXŽ˜îûÈž8 ¢¢ð ¢7F–öäÆ&VÃÐ¢&W&WÖW@¢ð¢/	ùI""¶vWE6¶–ÆÅ&W&WÆ&VÂ‡6¶–ÆÂ¢ ¢€¢6äff÷&@¢ð¢.ZÛŽ{ù" ¢ ¢.›¹îi[ŽKˆÞ‹k2 ¢“° ¢7F–öäöæ6Æ–6³Ð¢&ÆV&å6¶–ÆÂ‚r"·6¶–ÆÄ–B²"r’#° ¢7F–öäF—6&ÆVCÐ¢&W&WÖWBÇÀ¢6äff÷&C° ¢Ð¢VÇ6R–b†—4Ö„ÆWfVÂ—° ¢7F–öä–6öãÒ"#°¢7F–öäÆ&VÃÒ.[{.k»þ{I¢#° ¢7F–öäöæ6Æ–6³Ð¢'Ww&FU6¶–ÆÂ‚r"·6¶–ÆÄ–B²"r’#° ¢7F–öäF—6&ÆVCÐ¢G'VS° ¢Ð¢VÇ6W° ¢7F–öä–6öãÒ"#° ¢7F–öäÆ&VÃÐ¢f–Æ&ÆU6¶–ÆÅö–çG3Ã¢ð¢.›¹îi[ŽKˆÞ‹k2 ¢ ¢.XØ~{I¢#° ¢7F–öäöæ6Æ–6³Ð¢'Ww&FU6¶–ÆÂ‚r"·6¶–ÆÄ–B²"r’#° ¢7F–öäF—6&ÆVCÐ¢f–Æ&ÆU6¶–ÆÅö–çG3Ã° ¢Ð  ¢6öç7B6†÷tWV—'WGFöãÐ ¢—4ÆV&æVBb`¢€¢6¶–ÆÂæ6FVv÷'“ÓÓÒ'‡—6–6Â'ÇÀ¢6¶–ÆÂæ6FVv÷'“ÓÓÒ&Öv–2'ÇÀ¢6¶–ÆÂæ6FVv÷'“ÓÓÒ&'Vfb'ÇÀ¢6¶–ÆÂæ6FVv÷'“ÓÓÒ&†VÂ'ÇÀ¢6¶–ÆÂæ6FVv÷'“ÓÓÒ'&Wf—fR ¢“°  ¢&÷‚æ–ææW$…DÔÂÐ ¢ ¢ÆF—`¢–CÒ'6¶–ÆÄ–6öåòG·6¶–ÆÄ–GÒ ¢6Æ73Ò'6¶–ÆÂ×&÷rÖ–6öâ ¢7G–ÆSÒ&&6¶w&÷VæBÖ–ÖvS¢G¶vWE6¶–ÆÄ–6öä&6¶w&÷VæD–ÖvR‡6¶–ÆÄ–B—Ó² ¢ãÂöF—cà ¢ÆF—b6Æ73Ò'6¶–ÆÂ×&÷r×FW‡B#à¢Æ#âG·6¶–ÆÂææÖWÓÂö#à¢G°¢—4ÆV&æV@¢ð¢$Çbâ"¶ÆWfVÂ°¢€¢6¶–ÆÂæÖ„ÆWfVÀ¢ð¢"ò"·6¶–ÆÂæÖ„ÆWfVÀ¢ ¢" ¢¢ ¢sÇ7â7G–ÆSÒ&6öÆ÷#¢3cCsC†#²#îiÊ®ZÛŽ{ù#Â÷7ãâp¢Ð¢Æ'#à¢Ç7â6Æ73Ò'6¶–ÆÂ×&÷rÖFW62#à¢G·6¶–ÆÂæFW67&—F–öçÐ¢Â÷7ãà¢G°¢—4ÆV&æVBb`¢&W&WÖW@¢ð¢ ¢Æ'#à¢Ç7â7G–ÆSÒ&6öÆ÷#¢6cS–S#²#à¢	ùI"G¶vWE6¶–ÆÅ&W&WÆ&VÂ‡6¶–ÆÂ—Ð¢Â÷7ãà¢ ¢ ¢" ¢Ð¢Ç7à¢6Æ73Ò'6¶–ÆÂ×&÷rÖFWF–ÂÖÆ–æ² ¢öæ6Æ–6³Ò'6†÷u6¶–ÆÄFWF–Â‚rG·6¶–ÆÄ–GÒr’ ¢à¢(
n(
nŠ›>{K+°¢Â÷7ãà¢ÂöF—cà ¢ÆF—`¢6Æ73Ò'6¶–ÆÂÖ7F–öâÖ6&BG°¢7F–öäF—6&ÆV@¢ð¢"F—6&ÆVB ¢ ¢" ¢Ò ¢öæ6Æ–6³Ò"G¶7F–öäöæ6Æ–6·Ò ¢à¢ÆF—b6Æ73Ò'6¶–ÆÂÖ7F–öâÖ6&B×F÷#âG¶7F–öä–6öçÓÂöF—cà¢ÆF—b6Æ73Ò'6¶–ÆÂÖ7F–öâÖ6&BÖÆ&VÂ#à¢G¶7F–öäÆ&VÇÐ¢ÂöF—cà¢ÂöF—cà ¢G°¢6†÷tWV—'WGFöà¢ð¢ ¢ÆF—`¢6Æ73Ò'6¶–ÆÂÖ7F–öâÖ6&BG°¢WV—V@¢ð¢"F—6&ÆVB ¢ ¢" ¢Ò ¢öæ6Æ–6³Ò&WV—6¶–ÆÂ‚rG·6¶–ÆÄ–GÒr’ ¢à¢ÆF—b6Æ73Ò'6¶–ÆÂÖ7F–öâÖ6&B×F÷#ãÂöF—cà¢ÆF—b6Æ73Ò'6¶–ÆÂÖ7F–öâÖ6&BÖÆ&VÂ#à¢G°¢WV—V@¢ð¢.[{.Š9ÞX)’ ¢ ¢.Š9ÞX)’ ¢Ð¢ÂöF—cà¢ÂöF—cà¢ ¢ ¢" ¢Ð¢°  ¢&WGW&â&÷ƒ° ¢Ð  ¢ò ¢)ˆRXˆn™©N{y®yJŽy¨N{INih~ZÙ~j‰ž{NûÈÎiX^hHþKˆÞyJ€¢K»¾KÙ^jn{y¢þ[©^ˆ›.ûÈÎXú®iŠþKˆŠÎ{ÚîKŠÞy¨@¢‰™¾{y¢¾ih~ZÙ~ûÈÎYjî{INŠinŠk®Kˆ®XØ™©NXZž{XN8 ¢¢ð ¢gVæ7F–öâ'V–ÆE6¶–ÆÅ6V7F–öäF—f–FW"†Æ&VÂ—° ¢6öç7BF—f–FW#Ð¢Fö7VÖVçBæ7&VFTVÆVÖVçB€¢&F—b ¢“°  ¢F—f–FW"ç7G–ÆRæ775FW‡CÐ ¢'FW‡BÖÆ–vã¦6VçFW#²"°¢&föçB×6—¦S£ƒ²"°¢&6öÆ÷#¢3†vV3²"°¢&Ö&v–ã£‚Gƒ²#°  ¢F—f–FW"çFW‡D6öçFVçCÐ ¢.)H)H)H)H)H"°¢Æ&VÂ°¢.)H)H)H)H)H#°  ¢&WGW&âF—f–FW#° ¢Ð  ¢–b†ÆV&æVD–G2æÆVæwFƒã—° ¢ÆÄÆ—7BæVæD6†–ÆB€¢'V–ÆE6¶–ÆÅ6V7F–öäF—f–FW"€¢.[{.ZÛŽ{ù" ¢¢“°  ¢ÆV&æVD–G2æf÷$V6‚‡6¶–ÆÄ–CÓç° ¢ÆÄÆ—7BæVæD6†–ÆB€¢'V–ÆE6¶–ÆÅ&÷tVÆVÖVçB€¢6¶–ÆÄ–@¢¢“° ¢Ò“° ¢Ð  ¢–b‡VæÆV&æVD–G2æÆVæwFƒã—° ¢ÆÄÆ—7BæVæD6†–ÆB€¢'V–ÆE6¶–ÆÅ6V7F–öäF—f–FW"€¢.iÊ®ZÛŽ{ù" ¢¢“°  ¢VæÆV&æVD–G2æf÷$V6‚‡6¶–ÆÄ–CÓç° ¢ÆÄÆ—7BæVæD6†–ÆB€¢'V–ÆE6¶–ÆÅ&÷tVÆVÖVçB€¢6¶–ÆÄ–@¢¢“° ¢Ò“° ¢Ð  ¢ò ¢)ˆRjøþjÊ˜xÞikk‹.iù>h¨ˆ;Þš™Ú.i˜.ûÈÀ¢šnKëþYÎjÚ^KˆjÊˆz®X¹^h‹šÊ^y¨Nh¨ˆ;ÞKˆ¾h¸ž˜ŽYjîûÈÀ¢˜	žjŠ>Š9ÞX)žŠè®K¨n8ZÛŽikh¨ˆ;ÞK¨nûÈÀ¢˜ŽYjî˜;ÞiÈ>ˆz®X¹^‹yþKˆ®ûÈÎKˆÞyJŽjøþX¾YÎXú·&VæFW%6¶–ÆÄÆöF÷WB‚¢y¨NYËikž˜;ÞYNˆz®Š‰Ž[é~XhÞYÎXú¾KˆjÊ8 ¢¢ð ¢÷VÆFTWFõ6¶–ÆÄ÷F–öç2‚“° ¢÷VÆFTWFõ6¶–ÆÄ÷F–öç3"‚“° §Ð  ¢ò ¢{XNX{®h¨ˆ;ÞyºîX˜ÞzØž{I®y¨NiXŽiéÎih~ZÙ~Šª®iˆîûÈÀ¢yJŽYÊŽh¨ˆ;Þ˜XÞŠ9Þš™Ú.{ZnxêžZënXø>ˆ>8 ¢¢ð ¢ò ¢)ˆRh¨ˆ;ÞXˆnšîj‰ž{NûÈŽikZ)îûÈžûÉ ¢xšžynK‹¾X¹^ûÈþk9^Š>K‹¾X¹^ûÈþZ)îy¸®K‹¾X¹^ûÈþŠ*¾X¹^ûÈÀ¢{[Kˆ[éî˜	žŠ:yJ.yIþih~ZÙ~ûÈÀ¢h¨ˆ;Þ˜XÞŠ9ÞjÈN8[{.ZÛŽh¨ˆ;Þ8XúþZÛŽh¨ˆ;ÞKˆžX¾YËikž˜;ÞX[yJŽûÈÀ¢z+®KùÞšþzK®ikž[ÈþKˆˆ{N8 ¢¢ð ¦gVæ7F–öâvWE6¶–ÆÄ6FVv÷'”Æ&VÂ†6FVv÷'’—° ¢–b†6FVv÷'“ÓÓÒ'‡—6–6Â"—°¢&WGW&â.xšžynK‹¾X¹R#°¢Ð ¢–b†6FVv÷'“ÓÓÒ&Öv–2"—°¢&WGW&â.k9^Š>K‹¾X¹R#°¢Ð ¢–b†6FVv÷'“ÓÓÒ&'Vfb"—°¢&WGW&â.Z)îy¸®K‹¾X¹R#°¢Ð ¢–b†6FVv÷'“ÓÓÒ&†VÂ"—°¢&WGW&â.k+¾y˜.K‹¾X¹R#°¢Ð ¢–b†6FVv÷'“ÓÓÒ'&Wf—fR"—°¢&WGW&â.[êžkK¾K‹¾X¹R#°¢Ð ¢–b†6FVv÷'“ÓÓÒ'76—fR"—°¢&WGW&â.Š*¾X¹R#°¢Ð ¢&WGW&â"#° §Ð  ¦gVæ7F–öâvWE6¶–ÆÄVffV7E&Wf–WuFW‡B‡6¶–ÆÂÆÆWfVÂ—° ¢ò ¢)ˆR{INhê~ZNh¨ˆ;ÞûÈŽyºîX˜ÞiŠþXk[ûÈÎk).iÈ–&6TFÖv^ûÈ¢ŠhYÊŽ8ÎiÈžX+~Zë>y¨Nxšžybþk9^Š>h¨ˆ;Þ8ÞXŠNik~K˜¾X˜Ð¢XXŽiINhŠ®‰™^ynûÈÎKˆÞxKniÈ>Š*¾Kˆ¾™Ú.˜*>X¾XŠNikp¢ŠªNXŠNh‰8ÎX+~Zë38Þy¨NiK¾i8®h¨ˆ;ÞûÈÀ¢šþzK®X{®8ÎyºîX˜ÞX+~Zë>{HC8Þ˜	žzŠîŠªN[îih~ZÙ~8 ¢¢ð ¢–b€¢€¢6¶–ÆÂæ6FVv÷'“ÓÓÒ'‡—6–6Â'ÇÀ¢6¶–ÆÂæ6FVv÷'“ÓÓÒ&Öv–2 ¢’b`¢6¶–ÆÂæ&6TFÖvRb`¢6¶–ÆÂæg&VW¦T6†æ6P¢—° ¢&WGW&â€¢6¶–ÆÂæg&VW¦T6†æ6R°¢"^j™þxè~Xk[yºîj‰žûÈÂ"°¢6¶–ÆÂæg&VW¦TGW&F–öâ°¢.Y¹îYŽxJk9^ŠÎX¹R ¢“° ¢Ð  ¢–b€¢6¶–ÆÂæ6FVv÷'“ÓÓÒ'‡—6–6Â'ÇÀ¢6¶–ÆÂæ6FVv÷'“ÓÓÒ&Öv–2 ¢—° ¢ò ¢)ˆRKúîjÚ>ûÉ ¢˜	žŠ:K˜¾X˜ÞXú®šþzK®h¨ˆ;ÞYû®zHîX+~Zë>ûÈÀ¢ZèÎXZŽk).iÈžzé~˜.x¾XX>{JUŽŠ*¾X¹^y¨B³^Xªh‰ûÈÀ¢[îˆ{NxêžZënZÛŽK¨nŠ*¾X¹^K˜¾[èÎûÈÀ¢YÊŽ˜	žX¾š	ŠkÞi[ŽZÙ~Kˆ®ZèÎXZŽyÈ¾KˆÞX{®[zîy[ûÈÀ¢Kº^x+®Š*¾X¹^k).iÈžyIþiX€¢ûÈŽZún™©¾Kˆ®h‹šÊ^i˜&67DFÖvU6¶–ÆÂ‚žŠ:¢iÈžjÚ>z+®ZY~yJŽûÈÎXú®iŠþ˜	žX¾š	ŠkÞi[ŽZÙ~k).‹yþKˆ®ûÈž8 ¢xûîYÊŽŠ9ÎKˆ®ûÈÎŠé>xêžZënˆ;Þy»Nhê^YÊŽ˜	žŠ:¢yÈ¾X‹ZÛŽŠ*¾X¹^X˜Þ[èÎi[ŽZÙ~y¨NŠè®XÉn8 ¢¢ð ¢ò ¢)ˆRKúîjÚ>ûÉ ¢˜	žŠ:K˜¾X˜ÞXú®šþzK®h¨ˆ;ÞYû®zHîX+~Zë>ûÈÀ¢ZèÎXZŽk).iÈžzé~˜.XX>{JUŽŠ*¾X¹^y¨NXªh‰ûÈÀ¢[îˆ{NxêžZënZÛŽK¨nŠ*¾X¹^K˜¾[èÎûÈÀ¢YÊŽ˜	žX¾š	ŠkÞi[ŽZÙ~Kˆ®ZèÎXZŽyÈ¾KˆÞX{®[zîy[ûÈÀ¢Kº^x+®Š*¾X¹^k).iÈžyIþiX€¢ûÈŽZún™©¾Kˆ®h‹šÊ^i˜&67DFÖvU6¶–ÆÂ‚žŠ:¢iÈžjÚ>z+®ZY~yJŽûÈÎXú®iŠþ˜	žX¾š	ŠkÞi[ŽZÙ~k).‹yþKˆ®ûÈž8 ¢xûîYÊŽŠ9ÎKˆ®ûÈÎŠé>xêžZënˆ;Þy»Nhê^YÊŽ˜	žŠ:¢yÈ¾X‹ZÛŽŠ*¾X¹^X˜Þ[èÎi[ŽZÙ~y¨NŠè®XÉn8 ¢‹yö67DFÖvU6¶–ÆÂ‚žKˆjŠ>ûÈÀ¢iKžh‰X¹^hX¾yJŽ8ÎXX>{J´UŽ8Þiú^ŠŽûÈÀ¢kNXX>{JUŽK™þˆ;ÞjÚ>z+®XøÞiŠYÊŽ˜	žŠ:8 ¢¢ð ¢6öç7BW…6¶–ÆÄ–BÐ¢6¶–ÆÂæVÆVÖVçB°¢$U‚#°  ¢6öç7BW…6¶–ÆÂÐ¢6¶–ÆÄFF&6U¶W…6¶–ÆÄ–EÓ°  ¢ò ¢)ˆRKúîjÚ>ûÈŽKéÞxZ~KÛþyJŽˆ^Šhk.ûÈÎ8ÎXX>{J ¢Š*¾X¹^ZèÎXZŽk).yIþiXŽ8ÞûÈÎ˜	žX¾š	ŠkÞi[ŽZÙp¢‹yö67DFÖvU6¶–ÆÂ‚žxªþK¨nYÎKˆX°¢'V~ûÈžûÉ ¢KˆÞˆ;ÞyJ‡6¶–ÆÂæVÆVÖVçNy[nŠy.ˆ›.jÈNKØÐ¢¶WžûÈÎ˜	žŠ:iKžyJ†7W'&VçE6¶–ÆÄ6†&7FW ¢ûÈŽyºîX˜ÞyZ¾™Ú.Kˆ®šþzK®y¨NiŠþY:®X¾Šy.ˆ›.y¨@¢h¨ˆ;ÞX‰~ŠŽûÈÂ&f—&R.h‰b'Æ–W#".ûÈžûÈÀ¢‹yþxêžZënZún™©¾YÊŽyÈ¾Š«y¨Nh¨ˆ;ÞKùÞhÈKˆˆ{N8 ¢¢ð ¢6öç7BW„ÆWfVÂÐ¢vWE6¶–ÆÄÆWfVÂ€¢7W'&VçE6¶–ÆÄ6†&7FW"À¢W…6¶–ÆÄ–@¢“°   ¢6öç7B76—fT×VÇF—Æ–W"Ð¢€¢W…6¶–ÆÂb`¢W„ÆWfVÃãb`¢W…6¶–ÆÂæFÖvT&öçW5W&6Vç@¢¢ð¢°¢W…6¶–ÆÂæFÖvT&öçW5W&6VçBð¢ ¢ ¢°  ¢6öç7B&Wf–WtFÖvRÐ¢ÖF‚æfÆö÷"€¢vWE6¶–ÆÄFÖvTDÆWfVÂ€¢6¶–ÆÂÀ¢ÆWfVÀ¢’ ¢76—fT×VÇF—Æ–W ¢“°  ¢ÆWBFW‡BÐ¢.yºîX˜ÞX+~Zë>{HB"°¢&Wf–WtFÖvR°¢€¢76—fT×VÇF—Æ–W#ã¢ð¢.ûÈŽ[{.Y
²"°¢€¢W…6¶–ÆÀ¢ð¢W…6¶–ÆÂææÖP¢ ¢" ¢’°¢.Xªh‰ûÈ’ ¢ ¢" ¢“°  ¢–b‡6¶–ÆÂæ'W&ä6†æ6R—° ¢FW‡B³Ð ¢.ûÙÂ"°¢6¶–ÆÂæ'W&ä6†æ6R°¢"^xx>xy.ûÈ‚"°¢6¶–ÆÂæ'W&åW&6VçD'”ÆWfVÅ°¢ÆWfVÂÓ¢Ò°¢"^iÈZJt…ûÈþY¹îYŽûÈ’#° ¢Ð  ¢–b‡6¶–ÆÂæg&VW¦T6†æ6R—° ¢FW‡B³Ð ¢.ûÙÂ"°¢6¶–ÆÂæg&VW¦T6†æ6R°¢"^Xk[ûÈ‚"°¢6¶–ÆÂæg&VW¦TGW&F–öâ°¢.Y¹îYŽxJk9^ŠÎX¹^ûÈ’#° ¢Ð  ¢–b‡6¶–ÆÂæÆ–fW7FVÅW&6VçD'”ÆWfVÂ—°¢FW‡B³Ò.ûÙÎYŽXùb"·6¶–ÆÂæÆ–fW7FVÅW&6VçD'”ÆWfVÅ¶ÆWfVÂÓÒ²"^X+~Zë>ûÈŽY¹î[ê”…õ5ûÈ’#°¢Ð¢–b‡6¶–ÆÂæv–Æ—G”F÷vä'”ÆWfVÂ—°¢FW‡B³Ò.ûÙÂ"·6¶–ÆÂæv–Æ—G”F÷vä6†æ6R²"^™˜ÞiXò"·6¶–ÆÂæv–Æ—G”F÷vä'”ÆWfVÅ¶ÆWfVÂÓÒ²"^ûÈ‚"²‡6¶–ÆÂæv–Æ—G”F÷väGW&F–öçÇÃ"’².Y¹îYŽûÈ’#°¢Ð¢–b‡6¶–ÆÂç7FDF÷vä'”ÆWfVÂ—°¢FW‡B³Ò.ûÙÂ"·6¶–ÆÂç7FDF÷vä6†æ6R²"^™˜Þˆ;ÞX©²"·6¶–ÆÂç7FDF÷vä'”ÆWfVÅ¶ÆWfVÂÓÒ²"^ûÈ‚"²‡6¶–ÆÂç7FDF÷väGW&F–öçÇÃ"’².Y¹îYŽûÈ’#°¢Ð¢–b‡6¶–ÆÂæFVfVç6TF÷vä'”ÆWfVÂ—°¢FW‡B³Ò.ûÙÂ"·6¶–ÆÂæFVfVç6TF÷vä6†æ6R²"^™˜Þ™‹""·6¶–ÆÂæFVfVç6TF÷vä'”ÆWfVÅ¶ÆWfVÂÓÒ²"^ûÈ‚"²‡6¶–ÆÂæFVfVç6TF÷väGW&F–öçÇÃ"’².Y¹îYŽûÈ’#°¢Ð¢–b‡6¶–ÆÂæÖ—74&öçW4'”ÆWfVÂ—°¢FW‡B³Ò.ûÙÂ"·6¶–ÆÂç7GVä6†æ6R²"^i¨ŽyÊžûÈÄÔ•52²"·6¶–ÆÂæÖ—74&öçW4'”ÆWfVÅ¶ÆWfVÂÓÒ²"^ûÈ‚"²‡6¶–ÆÂç7GVäGW&F–öçÇÃ"’².Y¹îYŽûÈ’#°¢Ð¢–b‡6¶–ÆÂçWG&–g”6†æ6T'”ÆWfVÂ—°¢FW‡B³Ò.ûÙÂ"·6¶–ÆÂçWG&–g”6†æ6T'”ÆWfVÅ¶ÆWfVÂÓÒ²"^yû>XÉnûÈ‚"²‡6¶–ÆÂçWG&–g”GW&F–öçÇÃ"’².Y¹îYŽûÈ’#°¢Ð¢–b‡6¶–ÆÂç6VÆe6†–VÆD'”ÆWfVÂ—°¢FW‡B³Ò.ûÙÎˆz®‹ª¾ŠÛ~y»â"·6¶–ÆÂç6VÆe6†–VÆD'”ÆWfVÅ¶ÆWfVÂÓÒ².ûÈ‚"²‡6¶–ÆÂç6†–VÆDGW&F–öçÇÃ"’².Y¹îYŽûÈ’#°¢Ð¢–b‡6¶–ÆÂæÆÇ•6†–VÆD'”ÆWfVÂ—°¢FW‡B³Ò.ûÙÎXZŽš¹NŠÛ~y»â"·6¶–ÆÂæÆÇ•6†–VÆD'”ÆWfVÅ¶ÆWfVÂÓÒ².ûÈ‚"²‡6¶–ÆÂç6†–VÆDGW&F–öçÇÃ"’².Y¹îYŽûÈ’#°¢Ð ¢&WGW&âFW‡C° ¢Ð  ¢–b‡6¶–ÆÂæ6FVv÷'“ÓÓÒ&'Vfb"—°¢–b‡6¶–ÆÂæ7&—D&öçW4'”ÆWfVÂ—°¢&WGW&â.xˆni8®xè~ûÈþxˆni8®X+~Zë2²"·6¶–ÆÂæ7&—D&öçW4'”ÆWfVÅ¶ÆWfVÂÓÒ²"^ûÈÎhÈ{¨Â"·6¶–ÆÂæGW&F–öâ².Y¹îY‚#°¢Ð¢–b‡6¶–ÆÂæWf6–öä&öçW5W&6VçB—°¢&WGW&â.™h>‹«.xèr²"·6¶–ÆÂæWf6–öä&öçW5W&6VçB²"^ûÈÎhÈ{¨Â"·6¶–ÆÂæGW&F–öâ².Y¹îY‚#°¢Ð¢–b‡6¶–ÆÂæFVfVç6T&öçW5W&6VçB—°¢&WGW&â.™‹.zjnX©²²"·6¶–ÆÂæFVfVç6T&öçW5W&6VçB²"^ûÈÎhÈ{¨Â"·6¶–ÆÂæGW&F–öâ².Y¹îY‚#°¢Ð¢–b‡6¶–ÆÂç&VfÆV7EW&6VçB—°¢&WGW&â.XøÞX+r"·6¶–ÆÂç&VfÆV7EW&6VçB²"^ûÈÎhÈ{¨Â"·6¶–ÆÂæGW&F–öâ².Y¹îY‚#°¢Ð¢–b‡6¶–ÆÂç7FGW5&W6—7D&öçW2—°¢&WGW&â.y[[‹Žx¸hX¾h©~h
r²"·6¶–ÆÂç7FGW5&W6—7D&öçW2²"^ûÈÎhÈ{¨Â"·6¶–ÆÂæGW&F–öâ².Y¹îY‚#°¢Ð¢&WGW&â6¶–ÆÂæFW67&—F–öã°¢Ð  ¢–b‡6¶–ÆÂæ6FVv÷'“ÓÓÒ&†VÂ"—° ¢6öç7B†VÄÖ÷VçBÐ¢6¶–ÆÂæ&6T†VÂ°¢6¶–ÆÂæ†VÅW$ÆWfVÂ ¢†ÆWfVÂÓ“°  ¢&WGW&â€¢.Y¹î[ê”…ûÉ®Yû®zHâ"°¢†VÄÖ÷VçB°¢"¾i›®X©¼9r"°¢„TÄ”äuô”åEô4ôTdd”4”TåB°¢.ûÉµ5ûÉ®Yû®zHâ"°¢‡6¶–ÆÂæ&6T†VÅ5²‡6¶–ÆÂæ†VÅ5W$ÆWfVÇÇÃ’¢†ÆWfVÂÓ’’°¢"¾i›®X©¼9r"°¢5ô„TÄ”äuô”åEô4ôTdd”4”TåB°¢.ûÈŽikÞiKîˆ^iÊÎK«®KˆÞY¹î[ê•5ûÈ’ ¢“° ¢Ð  ¢–b‡6¶–ÆÂæ6FVv÷'“ÓÓÒ'&Wf—fR"—° ¢&WGW&â€¢.[êžkK¾[èÎh.[ê’"°¢6¶–ÆÂç&Wf—fT†VÅW&6VçD'”ÆWfVÅ°¢ÆWfVÂÓ¢Ò°¢"^Š˜xò ¢“° ¢Ð  ¢–b‡6¶–ÆÂæ6FVv÷'“ÓÓÒ'76—fR"—° ¢&WGW&â6¶–ÆÂæFW67&—F–öã° ¢Ð  ¢&WGW&â"#° §Ð  ¦gVæ7F–öâÆV&å6¶–ÆÂ‡6¶–ÆÄ–B—° ¢6öç7B6†&7FW"Ð¢6†&7FW%6¶–ÆÄÆöF÷WG5°¢7W'&VçE6¶–ÆÄ6†&7FW ¢Ó°  ¢6öç7B6¶–ÆÂÐ¢6¶–ÆÄFF&6U·6¶–ÆÄ–EÓ°  ¢ò ¢)ˆRKúîjÚ>ûÉ ¢XéþiÊÎ˜	žŠ:y»Nhê^hš7Æ–W"ç6¶–ÆÅö–çG>ûÈÀ¢KˆÞzêyºîX˜Þ˜Žy¨NiŠþŠ«ûÈÎKˆ[è¾hš>zÊÎKˆŠy.ˆ›.y¨N›¹îi[Ž8 ¢iKžh‰XXŽiú^X{®8Î˜	žX¾Šy.ˆ›.yÉþjÚ>y¨N‹8~iižxšžK»n8ÞûÈÀ¢vFW"÷v–æNyºîX˜Þk).iÈžyÉþjÚ>Šy.ˆ›.‹8~iižûÈÀ¢y»Nhê^i8¾hèžKˆÞˆ;ÞZÛŽûÈŽšþzK®hùzK®ûÈž8 ¢¢ð ¢6öç7B÷væW#Ð¢vWE6¶–ÆÄ6†&7FW$ö&¦V7B€¢7W'&VçE6¶–ÆÄ6†&7FW ¢“°  ¢–b€¢6†&7FW"ÇÀ¢6¶–ÆÀ¢—°¢&WGW&ã°¢Ð  ¢–b‚÷væW"—° ¢ÆW'B€¢.˜	žX¾Šy.ˆ›.˜(Nk).iÈž™h¾iKîh¨ˆ;ÞZÛŽ{ù.X©þˆ;Þ8" ¢“° ¢&WGW&ã° ¢Ð  ¢–b‚6†&7FW"ç6¶–ÆÄÆWfVÇ2—° ¢6†&7FW"ç6¶–ÆÄÆWfVÇ3×·Ó° ¢Ð  ¢–b€¢†6†&7FW"ç6¶–ÆÄÆWfVÇ5·6¶–ÆÄ–E×ÇÃ“ã ¢—°¢&WGW&ã°¢Ð  ¢ò ¢)ˆRikZ)îûÈŽKéÞxZ~KÛþyJŽˆ^Šhk.ûÈÎ8ÎX˜Þ{Úîh¨ˆ;Ð¢ŠhZÛŽy¨Nj™þX‹n8ÞûÈžûÉ ¢TžKˆ®[{.{i>h¨®hÈž˜‰VF—6&ÆVNi8¾KØþ›¹îi8®K¨nûÈÀ¢˜	žŠ:iŠþzÊÎK¨Î[N™‹.ŠÛ~(	N(	N‰
ÎKˆiÈžXŠ^y¨NYËik¢{™î˜îyZ¾™Ú.y»Nhê^YÎXú¶ÆV&å6¶–ÆÂ‚žûÈÀ¢[èÎzºþKˆjŠ>Šhi8¾KØþûÈÎKˆÞˆ;ÞXú®™ÚX˜Þzºþ8 ¢¢ð ¢–b€¢—56¶–ÆÅ&W&WÖWB€¢6†&7FW"ç6¶–ÆÄÆWfVÇ2À¢6¶–ÆÀ¢¢—° ¢ÆW'B€¢vWE6¶–ÆÅ&W&WÆ&VÂ‡6¶–ÆÂ’°¢.ûÈÎh˜Þˆ;ÞZÛŽ{ù.8Â"°¢6¶–ÆÂææÖR°¢.8Þ8" ¢“° ¢&WGW&ã° ¢Ð  ¢6öç7BÆV&ä6÷7CÔÖF‚æÖ‚ƒÄçVÖ&W"‡6¶–ÆÂæÆV&ä6÷7B—ÇÃ“°¢6öç7Bf–Æ&ÆUö–çG3ÔÖF‚æÖ‚ƒÄçVÖ&W"†÷væW"ç6¶–ÆÅö–çG2—ÇÃ“° ¢–b†f–Æ&ÆUö–çG3ÆÆV&ä6÷7B—°¢ÆW'B€¢.h¨ˆ;Þ›¹îKˆÞ‹k>ûÈÎ™ÈŠh"°¢ÆV&ä6÷7B°¢.›¹î8" ¢“°¢&WGW&ã°¢Ð ¢÷væW"ç6¶–ÆÅö–çG3Öf–Æ&ÆUö–çG2ÖÆV&ä6÷7C°  ¢6†&7FW"ç6¶–ÆÄÆWfVÇ5·6¶–ÆÄ–EÓÓ°  ¢&VæFW%6¶–ÆÄÆöF÷WB‚“° ¢WFFUT’‚“° ¢6fTvÖR‚“° §Ð  ¦gVæ7F–öâWw&FU6¶–ÆÂ‡6¶–ÆÄ–B—° ¢6öç7B6†&7FW"Ð¢6†&7FW%6¶–ÆÄÆöF÷WG5°¢7W'&VçE6¶–ÆÄ6†&7FW ¢Ó°  ¢6öç7B6¶–ÆÂÐ¢6¶–ÆÄFF&6U·6¶–ÆÄ–EÓ°  ¢6öç7B÷væW#Ð¢vWE6¶–ÆÄ6†&7FW$ö&¦V7B€¢7W'&VçE6¶–ÆÄ6†&7FW ¢“°  ¢–b€¢6†&7FW"ÇÀ¢6¶–ÆÂÇÀ¢6†&7FW"ç6¶–ÆÄÆWfVÇ2ÇÀ¢÷væW ¢—°¢&WGW&ã°¢Ð  ¢6öç7B7W'&VçDÆWfVÂÐ¢6†&7FW"ç6¶–ÆÄÆWfVÇ5°¢6¶–ÆÄ–@¢×ÇÀ¢°  ¢–b†7W'&VçDÆWfVÃÃÓ—°¢&WGW&ã°¢Ð  ¢6öç7BÖ„ÆWfVÂÐ¢6¶–ÆÂæÖ„ÆWfVÇÇÀ¢°  ¢–b†7W'&VçDÆWfVÃãÖÖ„ÆWfVÂ—°¢&WGW&ã°¢Ð  ¢–b†÷væW"ç6¶–ÆÅö–çG3Ã—° ¢ÆW'B€¢.h¨ˆ;Þ›¹îKˆÞ‹k>8" ¢“° ¢&WGW&ã° ¢Ð  ¢÷væW"ç6¶–ÆÅö–çG2ÓÓ°  ¢6†&7FW"ç6¶–ÆÄÆWfVÇ5·6¶–ÆÄ–EÓÐ¢7W'&VçDÆWfVÂ³°  ¢&VæFW%6¶–ÆÄÆöF÷WB‚“° ¢WFFUT’‚“° ¢6fTvÖR‚“° §Ð  ¦gVæ7F–öâWV—6¶–ÆÂ‡6¶–ÆÄ–B—° ¢6öç7B6†&7FW"Ð¢6†&7FW%6¶–ÆÄÆöF÷WG5°¢7W'&VçE6¶–ÆÄ6†&7FW ¢Ó°  ¢–b‚6†&7FW"—°¢&WGW&ã°¢Ð  ¢–b€¢6†&7FW"æWV—VE6¶–ÆÇ0¢æ–æ6ÇVFW2‡6¶–ÆÄ–B¢—°¢&WGW&ã°¢Ð  ¢–b€¢6†&7FW"æWV—VE6¶–ÆÇ2æÆVæwFƒãÓ@¢—° ¢ÆW'B€¢.jøþX¾Šy.ˆ›.iÈZI®Xú®ˆ;ÞiIÎ[‹cNX¾h¨ˆ;Þ8" ¢“° ¢&WGW&ã° ¢Ð  ¢6†&7FW"æWV—VE6¶–ÆÇ0¢çW6‚‡6¶–ÆÄ–B“°  ¢&VæFW%6¶–ÆÄÆöF÷WB‚“° ¢÷VÆFTWFõ6¶–ÆÄ÷F–öç2‚“° ¢÷VÆFTWFõ6¶–ÆÄ÷F–öç3"‚“° ¢6fTvÖR‚“° §Ð  ¦gVæ7F–öâ&VÖ÷fTWV—VE6¶–ÆÂ†–æFW‚—° ¢6öç7B6†&7FW"Ð¢6†&7FW%6¶–ÆÄÆöF÷WG5°¢7W'&VçE6¶–ÆÄ6†&7FW ¢Ó°  ¢–b‚6†&7FW"—°¢&WGW&ã°¢Ð  ¢6†&7FW"æWV—VE6¶–ÆÇ0¢ç7Æ–6R€¢–æFW‚À¢¢“°  ¢&VæFW%6¶–ÆÄÆöF÷WB‚“° ¢÷VÆFTWFõ6¶–ÆÄ÷F–öç2‚“° ¢÷VÆFTWFõ6¶–ÆÄ÷F–öç3"‚“° ¢6fTvÖR‚“° §Ð  ¢ò¢ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÐ¢ˆ8ÎXÈ^Šy.ˆ›"ò{i>X[‚%rˆ8ÎXÈP£ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÒ¢ð ¦ÆWB–çfVçF÷'”f–ÇFW"Ò&WV—ÖVçB#°¦6öç7B”ådTåDõ%•ô4DTtõ%•õ4ÄõEô4õTåBÒ#° ¦gVæ7F–öâvWD&6·6µ'G”6†&7FW'2‚—°¢&WGW&â·Æ–W"ÂÆ–W#"ÂÆ–W#5Ó°§Ð ¦gVæ7F–öâvWD&6·6´6†&7FW"†–æFW‚—°¢&WGW&âvWD&6·6µ'G”6†&7FW'2‚•¶–æFW…ÒÇÂçVÆÃ°§Ð ¦gVæ7F–öâvWD&6·6´WV—ÖVçD¶W’†–æFW‚—°¢&WGW&âvWD&6·6´6†&7FW"†–æFW‚¢òvWE'G”6†&7FW$¶W’†–æFW‚¢¢çVÆÃ°§Ð ¦gVæ7F–öâvWD–çfVçF÷'”WV—ÖVçE6Æ÷B†—FVÕG—R—°¢6öç7BÖ×°¢vVöã¢&†æB"À¢†VÆÖWC¢&†VB"À¢†VC¢&†VB"À¢6†÷VÆFW#¢'6†÷VÆFW""À¢&Ö÷#¢&&Ö÷""À¢6†öW3¢'6†öW2"À¢66W76÷'“¢'&–ær"À¢&–æs¢'&–ær ¢Ó°¢&WGW&âÖ¶—FVÕG—UÒÇÂçVÆÃ°§Ð ¦gVæ7F–öâvWD&6·6´6†&7FW%7FG2†–æFW‚—°¢6öç7B6†&7FW#ÖvWD&6·6´6†&7FW"†–æFW‚“°¢–b‚6†&7FW"’&WGW&âçVÆÃ° ¢–b†–æFWƒÓÓÓ’&WGW&âvWDÖ–ä6†&7FW%7FG2‚“° ¢6öç7B¶W“ÖvWD&6·6´WV—ÖVçD¶W’†–æFW‚“°¢6öç7B&öçW3ÖvWDWV—ÖVçD&öçW2†¶W’“° ¢&WGW&â°¢Ö„…£²†6†&7FW"æ&öçW4…ÇÃ’¶6†&7FW"çf—FÆ—G’¤…õU%õd•DÄ•E•õô”åB¶&öçW2æÖ„…¶&öçW2çf—FÆ—G’¤…õU%õd•DÄ•E•õô”åBÀ¢Ö…5£S²†6†&7FW"æ&öçW55ÇÃ’¶6†&7FW"æVæW&w’£R¶&öçW2æÖ…5¶&öçW2æVæW&w’£RÀ¢GF6³¤$4Uõ…•4”4ÅôED4²´ÖF‚æÖ‚ƒÄçVÖ&W"†6†&7FW"æÆWfVÂ—ÇÃ’¤ED4µõU%ôÄUdTÂ²†6†&7FW"æGF6²¶&öçW2æGF6²’¤ED4µõU%õô”åBÀ¢Öv–4GF6³¤$4UôÔt”5ôED4²´ÖF‚æÖ‚ƒÄçVÖ&W"†6†&7FW"æÆWfVÂ—ÇÃ’¤Ôt”5ôED4µõU%ôÄUdTÂ²†6†&7FW"æ–çFVÆÆ–vVæ6R¶&öçW2æ–çFVÆÆ–vVæ6R’¤Ôt”5ôED4µõU%õô”åBÀ¢FVfVç6S¤$4UôDTdTå4R´ÖF‚æÖ‚ƒÄçVÖ&W"†6†&7FW"æÆWfVÂ—ÇÃ’¤DTdTå4UõU%ôÄUdTÂ²†6†&7FW"çf—FÆ—G’¶&öçW2çf—FÆ—G’’¤DTdTå4UõU%õd•DÄ•E•õô”åB¶&öçW2æFVfVç6RÀ¢f—FÆ—G“¦6†&7FW"çf—FÆ—G’¶&öçW2çf—FÆ—G’À¢VæW&w“¦6†&7FW"æVæW&w’¶&öçW2æVæW&w’À¢–çFVÆÆ–vVæ6S¦6†&7FW"æ–çFVÆÆ–vVæ6R¶&öçW2æ–çFVÆÆ–vVæ6RÀ¢7—&—C¦6†&7FW"ç7—&—B¶&öçW2ç7—&—BÀ¢v–Æ—G“¦6†&7FW"æv–Æ—G’¶&öçW2æv–Æ—G’À¢67W&7“¦6†&7FW"ç7—&—B£"¶&öçW2ç7—&—B£"À¢&W6—7Fæ6S¦6Æ7VÆFU7FGW5&W6—7Fæ6UW&6VçB†6†&7FW"ç7—&—B¶&öçW2ç7—&—B’À¢çF”7&—C¦6Æ7VÆFTçF”7&—EW&6VçB†6†&7FW"ç7—&—B¶&öçW2ç7—&—B’À¢Wf6–öã¢†6†&7FW"æv–Æ—G’¶&öçW2æv–Æ—G’’£ã`¢Ó°§Ð ¦gVæ7F–öâ6†ævT–çfVçF÷'”6†&7FW"†F—&V7F–öâ—°¢6öç7B'G“ÖvWD&6·6µ'G”6†&7FW'2‚“°¢ÆWBæW‡CÖ–çfVçF÷'”6†&7FW$–æFW‚¶F—&V7F–öã°¢–b†æW‡CÃ’æW‡C×'G’æÆVæwF‚Ó°¢–b†æW‡Cã×'G’æÆVæwF‚’æW‡CÓ° ¢òòiÊ®[»®z¸¾y¨NŠy.ˆ›.K¸ÞXúþšþzK®zÊÎKˆžjÎûÈÎKØnKˆÞˆ;Þh¨®z›®Šy.ˆ›.y[nh‰XúþŠ9ÞX)žŠy.ˆ›.8 ¢–çfVçF÷'”6†&7FW$–æFWƒÖæW‡C°¢&VæFW$–çfVçF÷'’‚“° ¢–b‡G—Vöb7–æ46†&7FW%F'4g&öÔ–çfVçF÷'’ÓÓÒ&gVæ7F–öâ"—°¢7–æ46†&7FW%F'4g&öÔ–çfVçF÷'’†æW‡B“°¢Ð§Ð ¦gVæ7F–öâ6VÆV7D–çfVçF÷'”6†&7FW"†–æFW‚—°¢6öç7B'G“ÖvWD&6·6µ'G”6†&7FW'2‚“°¢–b†–æFWƒÃÇÂ–æFWƒã×'G’æÆVæwF‚’&WGW&ã°¢–çfVçF÷'”6†&7FW$–æFWƒÖ–æFWƒ°¢&VæFW$–çfVçF÷'’‚“° ¢–b‡'G•¶–æFW…ÒbbG—Vöb7–æ46†&7FW%F'4g&öÔ–çfVçF÷'’ÓÓÒ&gVæ7F–öâ"—°¢7–æ46†&7FW%F'4g&öÔ–çfVçF÷'’†–æFW‚“°¢Ð§Ð ¦gVæ7F–öâ7–æ46†&7FW%F'4g&öÔ–çfVçF÷'’†–æFW‚—°¢–b†–æFWƒÓÓÓÇÂ–æFWƒÓÓÓÇÂ–æFWƒÓÓÓ"—°¢–b‡G—Vöb6VÆV7D6†&7FW$f÷%F'2ÓÓÒ&gVæ7F–öâ"b`¢vWE'G”6†&7FW$'”–æFW‚†–æFW‚’—°¢òò˜þXXÒ6VÆV7D6†&7FW$f÷%F'2XhÞjÊŠ{Žy›Â&VæFW$–çfVçF÷'’[Ú.h‰˜î‹ûN8 ¢7FGW46†&7FW$–æFWƒÖ–æFWƒ°¢–çfVçF÷'”6†&7FW$–æFWƒÖ–æFWƒ°¢7W'&VçE6¶–ÆÄ6†&7FW#ÖvWE'G”6†&7FW$¶W’†–æFW‚“°¢Ð¢Ð§Ð ¦gVæ7F–öâ&VæFW$–çfVçF÷'”6†&7FW%F'2‚—°¢6öç7Bw&ÒB‚&–çfVçF÷'”6†&7FW%F'2"“°¢–b‚w&’&WGW&ã° ¢6öç7B6†&7FW'4Æ—7CÕ·Æ–W"ÇÆ–W#"ÇÆ–W#5Ó°¢6öç7B6†&7FW#Ö6†&7FW'4Æ—7E¶–çfVçF÷'”6†&7FW$–æFW…Ó° ¢6öç7BÆVgDF—6&ÆVCÖ–çfVçF÷'”6†&7FW$–æFWƒÃÓ°¢6öç7B&–v‡DF—6&ÆVCÖ–çfVçF÷'”6†&7FW$–æFWƒãÖ6†&7FW'4Æ—7BæÆVæwF‚ÓÇÂ6†&7FW'4Æ—7E¶–çfVçF÷'”6†&7FW$–æFW‚³Ó° ¢w&æ–ææW$…DÔÃÖ ¢Æ'WGFöâG—SÒ&'WGFöâ ¢6Æ73Ò&–çfVçF÷'’Ö6†&7FW"Ö'&÷r ¢&–ÖÆ&VÃÒ.Kˆ®KˆX¾Šy.ˆ›" ¢G¶ÆVgDF—6&ÆVBò&F—6&ÆVB"¢"'Ð¢öæ6Æ–6³Ò'6VÆV7D–çfVçF÷'”6†&7FW"‚G´ÖF‚æÖ‚ƒÆ–çfVçF÷'”6†&7FW$–æFW‚Ó—Ò’#î(“Âö'WGFöãà ¢ÆF—b6Æ73Ò&–çfVçF÷'’Ö6†&7FW"ÖæÖR#à¢Ç7ãâG¶6†&7FW"ò†6†&7FW"æ–BÇÂ.Šy.ˆ›""²†–çfVçF÷'”6†&7FW$–æFW‚³’’¢.Šy.ˆ›""²†–çfVçF÷'”6†&7FW$–æFW‚³—ÓÂ÷7ãà¢G¶6†&7FW"òÇ6ÖÆÂ6Æ73Ò&–çfVçF÷'’Ö6†&7FW"ÖÆWfVÂ#äÇbâG¶6†&7FW"æÆWfVÂÇÂÓÂ÷6ÖÆÃæ¢Ç6ÖÆÂ6Æ73Ò&–çfVçF÷'’Ö6†&7FW"ÖÆWfVÂ#î[	®iÊ®[»®z¸³Â÷6ÖÆÃæÐ¢ÂöF—cà ¢Æ'WGFöâG—SÒ&'WGFöâ ¢6Æ73Ò&–çfVçF÷'’Ö6†&7FW"Ö'&÷r ¢&–ÖÆ&VÃÒ.Kˆ¾KˆX¾Šy.ˆ›" ¢G·&–v‡DF—6&ÆVBò&F—6&ÆVB"¢"'Ð¢öæ6Æ–6³Ò'6VÆV7D–çfVçF÷'”6†&7FW"‚G´ÖF‚æÖ–â†6†&7FW'4Æ—7BæÆVæwF‚ÓÆ–çfVçF÷'”6†&7FW$–æFW‚³—Ò’#î(£Âö'WGFöãà¢°§Ð ¦gVæ7F–öâ&VæFW$–çfVçF÷'•7FG2‚—°¢6öç7B7FG3ÖvWD&6·6´6†&7FW%7FG2†–çfVçF÷'”6†&7FW$–æFW‚“°¢6öç7BVÃÒB‚&–çfVçF÷'•7FG2"“°¢–b‚VÂ’&WGW&ã° ¢–b‚7FG2—°¢VÂæ–ææW$…DÔÃÒsÆF—b6Æ73Ò&–çfVçF÷'’ÖV×G’Ö6†&7FW"#îzÊÎKˆžŠy.ˆ›.[	®iÊ®[»®z¸³ÂöF—câs°¢&WGW&ã°¢Ð ¢ò ¢cs~ûÉ ¢ˆ8ÎXÈ^[‹Žšy‹8~Šˆ®Xú®yY’…ò58 ¢X[nK¹nˆ;ÞX©¾iKžyKz¸¾{š®Xû>Kˆ®Šy.iKîZJ~˜ú™h¾YYþŠ›>{K‹8~Šˆ®8 ¢¢ð¢VÂæ–ææW$…DÔÃÖ ¢ÆF—b6Æ73Ò&–çfVçF÷'’×7FB×&÷r–çfVçF÷'’×7FB×&–Ö'’#à¢Ç7ãä…Â÷7ããÆ#âG·7FG2æÖ„…ÓÂö#à¢ÂöF—cà¢ÆF—b6Æ73Ò&–çfVçF÷'’×7FB×&÷r–çfVçF÷'’×7FB×&–Ö'’#à¢Ç7ãå5Â÷7ããÆ#âG·7FG2æÖ…5ÓÂö#à¢ÂöF—cà¢°§Ð ¦gVæ7F–öâvWD–çfVçF÷'”6†&7FW$7&—F–6Å7FG2†–æFW‚—°¢6öç7B6†&7FW#ÖvWD&6·6´6†&7FW"†–æFW‚“° ¢–b‚6†&7FW"—°¢&WGW&âçVÆÃ°¢Ð ¢ò ¢cŽûÉ®ˆ8ÎXÈ^Š›>{K‹8~iižYÎjÚ^šþzK®xšžynûÈþk9^Š>XZžZY~xˆni8®8 ¢Xú®X®šþzK®ûÈÎXZÎ[Èþˆˆr&öÆÄ7&—F–6Â‚’KùÞhÈKˆˆ{NûÉ ¢xšžynyÈ²GF6¾8k9^Š>yÈ²–çFVÆÆ–vVæ6^8 ¢¢ð¢6öç7B&vT'VfcÐ¢€¢†6†&7FW"bf6†&7FW"æ7F—fT'Vfg2—ÇÀ¢µÐ¢¢æf–æB€¢'VfcÓæ'VfbçG—SÓÓÒ'&vR ¢“° ¢gVæ7F–öâ'V–ÆD7&—F–6Å&öf–ÆR‡7FEö–çG2Æ6†æ6UW%ö–çBÆ×VÇF—Æ–W%W%ö–çB—°¢ÆWB7&—D6†æ6SÐ¢ÖF‚æÖ–â€¢5$•Eô4„ä4UôÔ‚À¢5$•Eô4„ä4Uô$4R°¢7FEö–çG2 ¢6†æ6UW%ö–ç@¢“° ¢ÆWB7&—D×VÇF—Æ–W#Ð¢ÖF‚æÖ–â€¢5$•EôÕTÅD•Ä”U%ôEE$”%UDUôÔ‚À¢5$•EôÕTÅD•Ä”U%ô$4R°¢7FEö–çG2 ¢×VÇF—Æ–W%W%ö–ç@¢“° ¢–b‡&vT'Vfb—°¢7&—D6†æ6R³Ð¢&vT'Vfbæ&öçW5W&6VçC° ¢7&—D×VÇF—Æ–W#Ð¢°¢&vT'Vfbæ&öçW5W&6VçBð¢°¢Ð ¢&WGW&â°¢6†æ6S¦7&—D6†æ6RÀ¢×VÇF—Æ–W#¦7&—D×VÇF—Æ–W ¢Ó°¢Ð ¢&WGW&â°¢‡—6–6Ã¦'V–ÆD7&—F–6Å&öf–ÆR€¢†6†&7FW"æGF6·ÇÃ’À¢5$•Eô4„ä4UõU%ôED4µõô”åBÀ¢5$•EôÕTÅD•Ä”U%õU%ôED4µõô”å@¢’À¢Öv–3¦'V–ÆD7&—F–6Å&öf–ÆR€¢†vWD&6·6´6†&7FW%7FG2†–æFW‚’æ–çFVÆÆ–vVæ6WÇÃ’À¢5$•Eô4„ä4UõU%ô”åDTÄÄ”tTä4Uõô”åBÀ¢5$•EôÕTÅD•Ä”U%õU%ô”åDTÄÄ”tTä4Uõô”å@¢¢Ó°§Ð ¦gVæ7F–öâ÷Vä–çfVçF÷'”6†&7FW$FWF–Â‚—°¢6öç7BÖöFÃÒB‚&–çfVçF÷'”6†&7FW$FWF–ÄÖöFÂ"“°¢6öç7BF—FÆSÒB‚&–çfVçF÷'”6†&7FW$FWF–ÄæÖR"“°¢6öç7B&öG“ÒB‚&–çfVçF÷'”6†&7FW$FWF–Å7FG2"“° ¢–b‚ÖöFÂÇÂF—FÆRÇÂ&öG’—°¢&WGW&ã°¢Ð ¢6öç7B6†&7FW#Ð¢vWD&6·6´6†&7FW"€¢–çfVçF÷'”6†&7FW$–æFW€¢“° ¢6öç7B7FG3Ð¢vWD&6·6´6†&7FW%7FG2€¢–çfVçF÷'”6†&7FW$–æFW€¢“° ¢6öç7B7&—F–6ÃÐ¢vWD–çfVçF÷'”6†&7FW$7&—F–6Å7FG2€¢–çfVçF÷'”6†&7FW$–æFW€¢“° ¢–b‚6†&7FW"ÇÂ7FG2ÇÂ7&—F–6Â—°¢F—FÆRçFW‡D6öçFVçCÒ.Šy.ˆ›.Š›>{K‹8~Šˆ¢#°¢&öG’æ–ææW$…DÔÃÒsÆF—b6Æ73Ò&–çfVçF÷'’ÖV×G’Ö6†&7FW"#îŠy.ˆ›.[	®iÊ®[»®z¸³ÂöF—câs°¢ÖöFÂæ6Æ74Æ—7BæFB‚'6†÷r"“°¢&WGW&ã°¢Ð ¢F—FÆRçFW‡D6öçFVçCÐ¢G¶6†&7FW"æ–BÇÂ.Šy.ˆ›""²†–çfVçF÷'”6†&7FW$–æFW‚³—Þ8ÇbâG¶6†&7FW"æÆWfVÇÇÃÖ° ¢6öç7B&÷w3Õ°¢²$…"Ç7FG2æÖ„…ÒÀ¢²%5"Ç7FG2æÖ…5ÒÀ¢².iK¾i8¢"Ç7FG2æGF6µÒÀ¢².™‹.zjb"Ç7FG2æFVfVç6UÒÀ¢².i›®X©²"Ç7FG2æ–çFVÆÆ–vVæ6UÒÀ¢².š¹N‹:¢"Ç7FG2çf—FÆ—G•ÒÀ¢².ˆ;Þ˜xò"Ç7FG2æVæW&w•ÒÀ¢².{+îzYâ"Ç7FG2ç7—&—EÒÀ¢².iXþhÛr"Ç7FG2æv–Æ—G•ÒÀ¢².YÞKŠÒ"Ç7FG2æ67W&7•ÒÀ¢².™h>˜ò"Ç7FG2æWf6–öåÒÀ¢².y[[‹Žh©~h
r"Ç7FG2ç&W6—7Fæ6RçFôf—†VBƒ’²"R%ÒÀ¢².h©~i«B"Ç7FG2æçF”7&—BçFôf—†VBƒ’²"R%ÒÀ¢².xšžynxˆni8®xèr"Æ7&—F–6Âç‡—6–6Âæ6†æ6RçFôf—†VBƒ’²"R%ÒÀ¢².xšžynxˆni8®X+~Zë2"Â†7&—F–6Âç‡—6–6Âæ×VÇF—Æ–W"£’çFôf—†VBƒ’²"R%ÒÀ¢².k9^Š>xˆni8®xèr"Æ7&—F–6ÂæÖv–2æ6†æ6RçFôf—†VBƒ’²"R%ÒÀ¢².k9^Š>xˆni8®X+~Zë2"Â†7&—F–6ÂæÖv–2æ×VÇF—Æ–W"£’çFôf—†VBƒ’²"R%Ð¢Ó° ¢&öG’æ–ææW$…DÔÃÐ¢&÷w2æÖ€¢…¶æÖRÇfÇVUÒ“Óæ ¢ÆF—b6Æ73Ò&–çfVçF÷'’Ö6†&7FW"ÖFWF–Â×&÷r#à¢Ç7ãâG¶æÖWÓÂ÷7ãà¢Æ#âG·fÇVWÓÂö#à¢ÂöF—cà¢ ¢’æ¦ö–â‚""’°¢ÆF—b6Æ73Ò&–çfVçF÷'’Ö6†&7FW"ÖFWF–ÂÖæ÷FR#à¢Yû®zHîYÞKŠÞxè~ûÉÖ6Æ×ƒ“R^ûÈ¾YÞKŠÜ9sã>ûÈÞy»Nhê^YÞKŠÞxè~™˜ÞKØâÂSRÂ“’RžûÈÎXhÞK™ŽKˆ¢ƒûÈÞyºîj‰žiÈ{X.™h>‹«.xèrž8#Æ'#à¢KˆˆŠÎy[[‹Žjøó{+îzYî™˜ÞKØãã^X¾y›îXˆn›¹îYÞKŠÞxè~ûÉ¾jøóiXþhÛ~ûÉÒ³˜	þ[ªn8³ãnX¾y›îXˆn›¹îYû®zHî™h>‹«.8 ¢ÂöF—cæ° ¢ÖöFÂæ6Æ74Æ—7BæFB‚'6†÷r"“°§Ð ¦gVæ7F–öâ6Æ÷6T–çfVçF÷'”6†&7FW$FWF–Â‚—°¢6öç7BÖöFÃÒB‚&–çfVçF÷'”6†&7FW$FWF–ÄÖöFÂ"“° ¢–b†ÖöFÂ—°¢ÖöFÂæ6Æ74Æ—7Bç&VÖ÷fR‚'6†÷r"“°¢Ð§Ð ¦gVæ7F–öâ&VæFW$WV—ÖVçB‚—°¢6öç7Bw&–CÒB‚&WV—ÖVçDw&–B"“°¢–b‚w&–B’&WGW&ã°¢w&–Bæ–ææW$…DÔÃÒ"#° ¢6öç7B¶W“ÖvWD&6·6´WV—ÖVçD¶W’†–çfVçF÷'”6†&7FW$–æFW‚“°¢6öç7BWV—ÖVçCÖ¶W’ò6†&7FW$WV—ÖVçE¶¶W•Ò¢çVÆÃ° ¢6öç7B6Æ÷G3Õ°¢¶¶W“¢&†VB"ÆæÖS¢.š
Ò'ÒÀ¢¶¶W“¢&†æB"ÆæÖS¢.h˜²'ÒÀ¢¶¶W“¢'6†÷VÆFW""ÆæÖS¢.ŠÛ~ˆYR'ÒÀ¢¶¶W“¢&&Ö÷""ÆæÖS¢.Š>iÈÒ'ÒÀ¢¶¶W“¢'6†öW2"ÆæÖS¢.™è¾ZÙ'ÒÀ¢¶¶W“¢'&–ær"ÆæÖS¢.h‰.hÈr'Ð¢Ó° ¢6Æ÷G2æf÷$V6‚‡6Æ÷CÓç°¢6öç7B6VÆÃÖFö7VÖVçBæ7&VFTVÆVÖVçB‚&F—b"“°¢6VÆÂæ6Æ74æÖSÒ&–çfVçF÷'’ÖWV—ÖVçBÖ6VÆÂ#° ¢6öç7BÆ&VÃÖFö7VÖVçBæ7&VFTVÆVÖVçB‚&F—b"“°¢Æ&VÂæ6Æ74æÖSÒ&–çfVçF÷'’ÖWV—ÖVçB×6Æ÷BÖÆ&VÂ#°¢Æ&VÂçFW‡D6öçFVçC×6Æ÷BææÖS° ¢6öç7B&÷ƒÖFö7VÖVçBæ7&VFTVÆVÖVçB‚&F—b"“°¢&÷‚æ6Æ74æÖSÒ&–çfVçF÷'’ÖWV—ÖVçB×6Æ÷B#°¢6öç7B—FVÓÖWV—ÖVçBòWV—ÖVçE·6Æ÷Bæ¶W•Ò¢çVÆÃ° ¢–b†—FVÒ—°¢&÷‚æ6Æ74Æ—7BæFB‚&†2Ö—FVÒ"“°¢&÷‚æ–ææW$…DÔÃÖÆF—b6Æ73Ò&–çfVçF÷'’ÖWV—ÖVçBÖ–6öâ#âG¶—FVÒæ–6öâÇÂ.)xb'ÓÂöF—cæ°¢&÷‚çF—FÆSÖ—FVÒææÖRÇÂ6Æ÷BææÖS°¢&÷‚æöæ6Æ–6³Ò‚“Óæ÷VäWV—VD—FVÒ†—FVÒÇ6Æ÷Bæ¶W’“°¢ÖVÇ6W°¢&÷‚æ–ææW$…DÔÃÖÆF—b6Æ73Ò&–çfVçF÷'’ÖWV—ÖVçBÖ–6öâV×G’#îûÈ³ÂöF—cæ°¢Ð ¢6VÆÂæVæD6†–ÆB†Æ&VÂ“°¢6VÆÂæVæD6†–ÆB†&÷‚“°¢w&–BæVæD6†–ÆB†6VÆÂ“°¢Ò“°§Ð ¦gVæ7F–öâvWDf–ÇFW&VD–çfVçF÷'”—FV×2‚—°¢6öç7BWV—ÖVçEG—W3Õ°¢'vVöâ"À¢&†VÆÖWB"À¢&†VB"À¢'6†÷VÆFW""À¢&&Ö÷""À¢'6†öW2"À¢&66W76÷'’"À¢'&–ær ¢Ó° ¢6öç7BgVæ7F–öåG—W3Õ°¢&gVæ7F–öâ"À¢'WF–Æ—G’"À¢&¶W’"À¢'VW7B"À¢'7V6–Â ¢Ó° ¢&WGW&â–çfVçF÷'”—FV×2æf–ÇFW"†—FVÓÓç°¢–b‚—FVÒ’&WGW&âfÇ6S° ¢–b†–çfVçF÷'”f–ÇFW#ÓÓÒ&WV—ÖVçB"—°¢&WGW&âWV—ÖVçEG—W2æ–æ6ÇVFW2†—FVÒçG—R“°¢Ð ¢–b†–çfVçF÷'”f–ÇFW#ÓÓÒ&ÖFW&–Â"—°¢&WGW&â—FVÒçG—SÓÓÒ&ÖFW&–Â#°¢Ð ¢–b†–çfVçF÷'”f–ÇFW#ÓÓÒ&gVæ7F–öâ"—°¢&WGW&âgVæ7F–öåG—W2æ–æ6ÇVFW2†—FVÒçG—R“°¢Ð ¢ò ¢8ÎxšžY88Þh›þhê^‰z^kNˆˆ~KˆˆŠÎxšžY88 ¢iÊ®KènZh.iéÎikZ)î[	®iÊ®jÛŽšîy¨NikG—^ûÈÎK™þXXŽyYžYÊŽxšžY8šûÈÀ¢˜þXXÞYºx+¢T’Xˆnšîi»Nik˜
h‰iz.iÈžxšžY8hiz›®yÈ¾KˆÞX‹8 ¢¢ð¢&WGW&â€¢WV—ÖVçEG—W2æ–æ6ÇVFW2†—FVÒçG—R’b`¢—FVÒçG—RÓÒ&ÖFW&–Â"b`¢gVæ7F–öåG—W2æ–æ6ÇVFW2†—FVÒçG—R¢“°¢Ò“°§Ð ¦gVæ7F–öâ6WD–çfVçF÷'”f–ÇFW"†f–ÇFW"—°¢–çfVçF÷'”f–ÇFW#Öf–ÇFW#°¢&VæFW$–çfVçF÷'”—FV×2‚“° ¢6öç7B67&öÆÆW#ÒB‚&–çfVçF÷'”w&–E67&öÆÂ"“°¢–b‡67&öÆÆW"’67&öÆÆW"ç67&öÆÅF÷Ó°§Ð ¦gVæ7F–öâ&VæFW$–çfVçF÷'”—FV×2‚—°¢&V'V–ÆD–çfVçF÷'•6Æ÷G2‚“°¢6öç7Bw&–CÒB‚&–çfVçF÷'”w&–B"“°¢–b‚w&–B’&WGW&ã°¢w&–Bæ–ææW$…DÔÃÒ"#° ¢6öç7B—FV×3ÖvWDf–ÇFW&VD–çfVçF÷'”—FV×2‚’ç6Æ–6RƒÄ”ådTåDõ%•ô4DTtõ%•õ4ÄõEô4õTåB“° ¢f÷"†ÆWB–æFWƒÓ¶–æFWƒÄ”ådTåDõ%•ô4DTtõ%•õ4ÄõEô4õTåC¶–æFW‚²²—°¢6öç7B—FVÓÖ—FV×5¶–æFW…ÒÇÂçVÆÃ°¢6öç7B&÷ƒÖFö7VÖVçBæ7&VFTVÆVÖVçB‚&F—b"“°¢&÷‚æ6Æ74æÖSÒ&–çfVçF÷'’Ö—FVÒ–çfVçF÷'’Ö—FVÒÖ6Æ76–2"²†—FVÒò&†2Ö—FVÒ#¢&V×G’"“°¢&÷‚æ–ææW$…DÔÃÖÆF—b6Æ73Ò&–çfVçF÷'’×6Æ÷BÖçVÖ&W"#âG¶–æFW‚³ÓÂöF—cæ° ¢–b†—FVÒ—°¢&÷‚æ–ææW$…DÔÂ³ÖÆF—b6Æ73Ò&–çfVçF÷'’Ö–6öâ#âG¶—FVÒæ–6öâÇÂ.)xb'ÓÂöF—cãÆF—b6Æ73Ò&–çfVçF÷'’Ö6÷VçB#âG¶—FVÒæ6÷VçCãò,9r"¶—FVÒæ6÷VçB¢"'ÓÂöF—cæ°¢6öç7B&VÄ–æFWƒÖ–çfVçF÷'”—FV×2æ–æFW„öb†—FVÒ“°¢&÷‚æöæ6Æ–6³Ò‚“Óæ÷Vä—FVÔÖöFÂ‡&VÄ–æFW‚“°¢ÖVÇ6W°¢&÷‚æ–ææW$…DÔÂ³ÒsÆF—b6Æ73Ò&–çfVçF÷'’ÖV×G’ÖF÷B#ì+sÂöF—câs°¢Ð¢w&–BæVæD6†–ÆB†&÷‚“°¢Ð ¢Fö7VÖVçBçVW'•6VÆV7F÷$ÆÂ‚"6–çfVçF÷'”6FVv÷'•F'2¶FFÖf–ÇFW%Ò"’æf÷$V6‚‡F#Óç°¢6öç7B7F—fS×F"æFF6WBæf–ÇFW#ÓÓÖ–çfVçF÷'”f–ÇFW#°¢F"æ6Æ74Æ—7BçFövvÆR‚&7F—fR"Æ7F—fR“°¢F"ç6WDGG&–'WFR‚&&–×6VÆV7FVB"Æ7F—fRò'G'VR"¢&fÇ6R"“°¢Ò“°§Ð ¦gVæ7F–öâ&VæFW$–çfVçF÷'’‚—°¢6öç7B6†&7FW#ÖvWD&6·6´6†&7FW"†–çfVçF÷'”6†&7FW$–æFW‚“°¢6öç7BæÖTVÃÒB‚&–çfVçF÷'”6†&7FW$æÖR"“°¢–b†æÖTVÂ—°¢æÖTVÂçFW‡D6öçFVçCÖ6†&7FW"òG¶6†&7FW"æ–BÇÂ.Šy.ˆ›""²†–çfVçF÷'”6†&7FW$–æFW‚³—Þ8ÇbâG¶6†&7FW"æÆWfVÇÇÃÖ¢Šy.ˆ›"G¶–çfVçF÷'”6†&7FW$–æFW‚³Þ8[	®iÊ®[»®z¸¶°¢Ð ¢&VæFW$–çfVçF÷'”6†&7FW%F'2‚“°¢&VæFW$WV—ÖVçB‚“°¢&VæFW$–çfVçF÷'”—FV×2‚“°§Ð ¢ò¢ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÐ¢xšžY8Š›>{K £ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÒ¢ð ¦gVæ7F–öâvWE7FEFW‡B‡7FG2—° ¢–b€¢7FG2ÇÀ¢ö&¦V7Bæ¶W—2‡7FG2’æÆVæwFƒÓÓÓ ¢—° ¢&WGW&â.k).iÈžšÞZInˆ;ÞX©¾Xªh‰8"#° ¢Ð  ¢6öç7BæÖW2Ò° ¢GF6³¢.iK¾i8¢"À ¢f—FÆ—G“¢.š¹N‹:¢"À ¢VæW&w“¢.ˆ;Þ˜xò"À ¢–çFVÆÆ–vVæ6S¢.i›®X©²"À ¢7—&—C¢.{+îzYâ"À ¢v–Æ—G“¢.iXþhÛr"À ¢Ö„…¢.iÈZJt…"À ¢Ö…5¢.iÈZJu5"À ¢FVfVç6S¢.™‹.zjb  ¢Ó°  ¢ÆWB‡FÖÃÒ"#°  ¢ö&¦V7Bæ¶W—2‡7FG2¢æf÷$V6‚†¶W“Óç° ¢6öç7BfÇVRÐ¢7FG5¶¶W•Ó°  ¢–b‚fÇVR—°¢&WGW&ã°¢Ð  ¢‡FÖÂ³Ð ¢ ¢ÆF—cà¢G¶æÖW5¶¶W•×ÇÆ¶W—ÞûÉ ¢Æ#â²G·fÇVWÓÂö#à¢ÂöF—cà¢° ¢Ò“°  ¢&WGW&â‡FÖÂÇÀ¢.k).iÈžšÞZInˆ;ÞX©¾Xªh‰8"#° §Ð  ¦gVæ7F–öâ÷Vä—FVÔÖöFÂ€¢6Æ÷D–æFW€¢—° ¢6öç7B—FVÒÐ¢–çfVçF÷'•6Æ÷G5°¢6Æ÷D–æFW€¢Ó°  ¢–b‚—FVÒ—°¢&WGW&ã°¢Ð  ¢6VÆV7FVD–çfVçF÷'•6Æ÷BÐ¢6Æ÷D–æFWƒ°  ¢B‚&—FVÔÖöFÄ–6öâ"¢çFW‡D6öçFVçBÐ¢—FVÒæ–6öã°  ¢B‚&—FVÔÖöFÄæÖR"¢çFW‡D6öçFVçBÐ¢—FVÒææÖS°  ¢B‚&—FVÔÖöFÅ7FG2"¢æ–ææW$…DÔÂÐ ¢ ¢G°¢—FVÒçG—SÓÓÒ'÷F–öâ ¢ð¢ÆF—cîiXŽiéÎûÉ£Æ#âG¶vWE÷F–öäVffV7DFW67&—F–öâ†—FVÒæ–B—ÓÂö#ãÂöF—cæ ¢ ¢vWE7FEFW‡B†—FVÒç7FG2¢Ð ¢ÆF—`¢7G–ÆSÒ ¢Ö&v–â×F÷£wƒ°¢6öÆ÷#¢6#6S†3°¢ ¢à¢YJîX;žûÉ¢G¶—FVÒç&–6WÇÃÒ˜y[š0¢ÂöF—cà¢°  ¢6öç7BWV—'WGFöâÐ¢B‚&—FVÔWV—'WGFöâ"“°  ¢WV—'WGFöâç&VÖ÷fTGG&–'WFR€¢&FF×6Æ÷B ¢“°  ¢–b†—FVÒçG—SÓÓÒ'÷F–öâ"—° ¢WV—'WGFöâæF—6&ÆVC×G'VS° ¢WV—'WGFöâçFW‡D6öçFVçBÐ¢.KˆÞXúþŠ9ÞX)’#° ¢WV—'WGFöâç7G–ÆRæ÷6—G’Ð¢"ãB#° ¢Ð¢VÇ6W° ¢WV—'WGFöâæF—6&ÆVCÖfÇ6S° ¢WV—'WGFöâçFW‡D6öçFVçBÐ¢.z›þh‹B#° ¢WV—'WGFöâç7G–ÆRæ÷6—G’Ð¢##° ¢Ð  ¢B‚&—FVÔÖöFÂ"¢æ6Æ74Æ—7@¢æFB‚'6†÷r"“° §Ð  ¦gVæ7F–öâ÷VäWV—VD—FVÒ€¢—FVÒÀ¢6Æ÷@¢—° ¢6VÆV7FVD–çfVçF÷'•6Æ÷BÐ¢çVÆÃ°  ¢B‚&—FVÔÖöFÄ–6öâ"¢çFW‡D6öçFVçBÐ¢—FVÒæ–6öã°  ¢B‚&—FVÔÖöFÄæÖR"¢çFW‡D6öçFVçBÐ¢—FVÒææÖR°¢.ûÈŽ[{.Š9ÞX)žûÈ’#°  ¢B‚&—FVÔÖöFÅ7FG2"¢æ–ææW$…DÔÂÐ¢vWE7FEFW‡B€¢—FVÒç7FG0¢“°  ¢6öç7BWV—'WGFöâÐ¢B‚&—FVÔWV—'WGFöâ"“°  ¢WV—'WGFöâæF—6&ÆVCÖfÇ6S° ¢WV—'WGFöâçFW‡D6öçFVçBÐ¢.ˆJ¾Kˆ²#° ¢WV—'WGFöâç7G–ÆRæ÷6—G’Ð¢##°  ¢WV—'WGFöâæFF6WBç6Æ÷BÐ¢6Æ÷C°  ¢B‚&—FVÔÖöFÂ"¢æ6Æ74Æ—7@¢æFB‚'6†÷r"“° §Ð  ¦gVæ7F–öâ6Æ÷6T—FVÔÖöFÂ‚—° ¢6VÆV7FVD–çfVçF÷'•6Æ÷BÐ¢çVÆÃ°  ¢B‚&—FVÔWV—'WGFöâ"¢ç&VÖ÷fTGG&–'WFR€¢&FF×6Æ÷B ¢“°  ¢B‚&—FVÔÖöFÂ"¢æ6Æ74Æ—7@¢ç&VÖ÷fR‚'6†÷r"“° §Ð  ¢ò ¢)ˆRikZ)îûÈŽKéÞxZ~KÛþyJŽˆ^Šhk.ûÈÎ8Îih~ZÙ~ZJ®ZI ¢ZîKˆÞKˆ¾ûÈÎ[{+î{
šþzK®ûÈÎ[èÎ™Ú.yJŽ(
n(
nŠ›>{K ¢Šé>xêžZën›¹îi8®‹{>X{®ZèÎi[NK¸¾{Kž8ÞûÈžûÉ ¢h¨ˆ;ÞŠ›>{K‹8~Šˆ®[ØŽz©~ûÈÎ‹yþxšžY8Š›>{K[ØŽz©~X[yJ€¢YÎKˆZYræ—FVÒÖÖöFÎjŠ>[Èþ8'6†÷u6¶–ÆÄFWF–Â‚¢Y>h¨ˆ;Ô”NûÈÎˆz®[{˜xÞikiú^KˆjÊyºîX˜ÞŠy.ˆ›"þzØž{I ¢x¸hX¾ûÈÎ{XNX{®ZèÎi[NŠª®iˆîih~ZÙ~ûÈŽKˆÞhŠ®ik~ûÈž8 ¢¢ð ¢ò ¢)ˆRikZ)îûÈŽKéÞxZ~KÛþyJŽˆ^Šhk.ûÈÎ8ÎKˆÞzêh¨ˆ;ÞiÈžk).iÈ¢ZÛŽ{ù.ûÈÎŠ›>{K‹8~Šˆ®˜;ÞŠhh¨®jøþjÊXØ~{I®Z)îXªZI®[	¢›¹îX+~Zë>8j™þxèr^i[Žhî›«ÎhùXØ~ûÈÎZèÎi[NšþzK®8ÞûÈžûÉ ¢h¨®h¨ˆ;Þ[éäÇbãX‹k»þ{I®jøþKˆ{I®y¨Ni[ŽXÎ˜;ÞiJN™h¾Kè`¢X‰~X{®KènûÈÎKˆÞzêxêžZënyºîX˜ÞZÛŽK¨nk).ZÛŽ8ZÛŽX‹zÊÀ¢[›î{I®ûÈÎ˜	žŠ:˜;ÞiŠþZèÎi[Ny¨NKˆK»Þ{‹ÞŠŽ(	N(	NX+~Zë0¢h¨ˆ;ÞšÞZInj‰žX{®8Îjøþ{I¢µŽ8Þy¨NY»®Zé®Z)î˜xþûÈÀ¢ikžKëþxêžZënKˆyËÎyÈ¾X{®h‰™[~[˜^[ªnûÈÎKˆÞyJŽˆz®[{¢Kˆ{I®Kˆ{I®Xë¾[ø>zé~[zîZI®[	8 ¢¢ð ¦gVæ7F–öâ'V–ÆE6¶–ÆÄÆWfVÄ'&V¶F÷vä…DÔÂ‡6¶–ÆÂ—° ¢6öç7BÖ„ÆWfVÃÐ¢6¶–ÆÂæÖ„ÆWfVÇÇÀ¢°  ¢ÆWBÆ–æW3Ð¢µÓ°  ¢f÷"€¢ÆWBÇcÓ°¢ÇcÃÖÖ„ÆWfVÃ°¢Çb²°¢—° ¢ÆWB'G3Ð¢µÓ°  ¢–b€¢€¢6¶–ÆÂæ6FVv÷'“ÓÓÒ'‡—6–6Â'ÇÀ¢6¶–ÆÂæ6FVv÷'“ÓÓÒ&Öv–2 ¢’b`¢6¶–ÆÂæ&6TFÖvP¢—° ¢6öç7BFÖsÐ¢vWE6¶–ÆÄFÖvTDÆWfVÂ€¢6¶–ÆÂÀ¢Ç`¢“°  ¢'G2çW6‚€¢.X+~Zë2"°¢ÖF‚æfÆö÷"†FÖr’° ¢€¢6¶–ÆÂæFÖvUW$ÆWfVÀ¢ð¢.ûÈŽjøþ{I¢²"°¢6¶–ÆÂæFÖvUW$ÆWfVÂ°¢.ûÈ’ ¢ ¢" ¢ ¢“° ¢Ð  ¢–b€¢6¶–ÆÂæ'W&ä6†æ6Rb`¢6¶–ÆÂæ'W&åW&6VçD'”ÆWfVÀ¢—° ¢'G2çW6‚€ ¢6¶–ÆÂæ'W&ä6†æ6R°¢"^j™þxè~xx>xy""°¢6¶–ÆÂæ'W&åW&6VçD'”ÆWfVÅ¶ÇbÓÒ°¢"^iÈZJt…ûÈþY¹îY‚  ¢“° ¢Ð  ¢–b‡6¶–ÆÂæg&VW¦T6†æ6R—° ¢'G2çW6‚€ ¢6¶–ÆÂæg&VW¦T6†æ6R°¢"^j™þxè~Xk["°¢6¶–ÆÂæg&VW¦TGW&F–öâ°¢.Y¹îY‚  ¢“° ¢Ð  ¢–b‡6¶–ÆÂæÆ–fW7FVÅW&6VçD'”ÆWfVÂ—°¢'G2çW6‚‚.YŽXùnX+~Zë2"·6¶–ÆÂæÆ–fW7FVÅW&6VçD'”ÆWfVÅ¶ÇbÓÒ²"^ûÈŽY¹î[ê”…õ5ûÈ’"“°¢Ð¢–b‡6¶–ÆÂæv–Æ—G”F÷vä'”ÆWfVÂ—°¢'G2çW6‚‡6¶–ÆÂæv–Æ—G”F÷vä6†æ6R²"^™˜ÞiXò"·6¶–ÆÂæv–Æ—G”F÷vä'”ÆWfVÅ¶ÇbÓÒ²"^ûÈÂ"²‡6¶–ÆÂæv–Æ—G”F÷väGW&F–öçÇÃ"’².Y¹îY‚"“°¢Ð¢–b‡6¶–ÆÂç7FDF÷vä'”ÆWfVÂ—°¢'G2çW6‚‡6¶–ÆÂç7FDF÷vä6†æ6R²"^™˜Þˆ;ÞX©²"·6¶–ÆÂç7FDF÷vä'”ÆWfVÅ¶ÇbÓÒ²"^ûÈÂ"²‡6¶–ÆÂç7FDF÷väGW&F–öçÇÃ"’².Y¹îY‚"“°¢Ð¢–b‡6¶–ÆÂæFVfVç6TF÷vä'”ÆWfVÂ—°¢'G2çW6‚‡6¶–ÆÂæFVfVç6TF÷vä6†æ6R²"^™˜Þ™‹""·6¶–ÆÂæFVfVç6TF÷vä'”ÆWfVÅ¶ÇbÓÒ²"^ûÈÂ"²‡6¶–ÆÂæFVfVç6TF÷väGW&F–öçÇÃ"’².Y¹îY‚"“°¢Ð¢–b‡6¶–ÆÂæÖ—74&öçW4'”ÆWfVÂ—°¢'G2çW6‚‡6¶–ÆÂç7GVä6†æ6R²"^i¨ŽyÊžûÈÄÔ•52²"·6¶–ÆÂæÖ—74&öçW4'”ÆWfVÅ¶ÇbÓÒ²"^ûÈÂ"²‡6¶–ÆÂç7GVäGW&F–öçÇÃ"’².Y¹îY‚"“°¢Ð¢–b‡6¶–ÆÂçWG&–g”6†æ6T'”ÆWfVÂ—°¢'G2çW6‚‡6¶–ÆÂçWG&–g”6†æ6T'”ÆWfVÅ¶ÇbÓÒ²"^yû>XÉnûÈÂ"²‡6¶–ÆÂçWG&–g”GW&F–öçÇÃ"’².Y¹îY‚"“°¢Ð¢–b‡6¶–ÆÂç6VÆe6†–VÆD'”ÆWfVÂ—°¢'G2çW6‚‚.ˆz®‹ª¾ŠÛ~y»â"·6¶–ÆÂç6VÆe6†–VÆD'”ÆWfVÅ¶ÇbÓÒ².›¹îûÈÂ"²‡6¶–ÆÂç6†–VÆDGW&F–öçÇÃ"’².Y¹îY‚"“°¢Ð¢–b‡6¶–ÆÂæÆÇ•6†–VÆD'”ÆWfVÂ—°¢'G2çW6‚‚.h‰ikžXZŽš¹NŠÛ~y»â"·6¶–ÆÂæÆÇ•6†–VÆD'”ÆWfVÅ¶ÇbÓÒ².›¹îûÈÂ"²‡6¶–ÆÂç6†–VÆDGW&F–öçÇÃ"’².Y¹îY‚"“°¢Ð  ¢–b‡6¶–ÆÂæ6FVv÷'“ÓÓÒ&'Vfb"bg6¶–ÆÂæ7&—D&öçW4'”ÆWfVÂ—°¢'G2çW6‚‚.xˆni8®xè~ûÈþxˆni8®X+~Zë2²"·6¶–ÆÂæ7&—D&öçW4'”ÆWfVÅ¶ÇbÓÒ²"^ûÈÂ"·6¶–ÆÂæGW&F–öâ².Y¹îY‚"“°¢Ð¢VÇ6R–b‡6¶–ÆÂæ6FVv÷'“ÓÓÒ&'Vfb"bg6¶–ÆÂæWf6–öä&öçW5W&6VçB—°¢'G2çW6‚‚.™h>‹«.xèr²"·6¶–ÆÂæWf6–öä&öçW5W&6VçB²"^ûÈÂ"·6¶–ÆÂæGW&F–öâ².Y¹îY‚"“°¢Ð¢VÇ6R–b‡6¶–ÆÂæ6FVv÷'“ÓÓÒ&'Vfb"bg6¶–ÆÂæFVfVç6T&öçW5W&6VçB—°¢'G2çW6‚‚.™‹.zjnX©²²"·6¶–ÆÂæFVfVç6T&öçW5W&6VçB²"^ûÈÂ"·6¶–ÆÂæGW&F–öâ².Y¹îY‚"“°¢Ð¢VÇ6R–b‡6¶–ÆÂæ6FVv÷'“ÓÓÒ&'Vfb"bg6¶–ÆÂç&VfÆV7EW&6VçB—°¢'G2çW6‚‚.XøÞX+r"·6¶–ÆÂç&VfÆV7EW&6VçB²"^ûÈÂ"·6¶–ÆÂæGW&F–öâ².Y¹îY‚"“°¢Ð¢VÇ6R–b‡6¶–ÆÂæ6FVv÷'“ÓÓÒ&'Vfb"bg6¶–ÆÂç7FGW5&W6—7D&öçW2—°¢'G2çW6‚‚.y[[‹Žx¸hX¾h©~h
r²"·6¶–ÆÂç7FGW5&W6—7D&öçW2²"^ûÈÂ"·6¶–ÆÂæGW&F–öâ².Y¹îY‚"“°¢Ð¢VÇ6R–b‡6¶–ÆÂæ6FVv÷'“ÓÓÒ&'Vfb"—°¢'G2çW6‚‡6¶–ÆÂæFW67&—F–öâ“°¢Ð  ¢–b‡6¶–ÆÂæ6FVv÷'“ÓÓÒ&†VÂ"—° ¢6öç7B†VÄÖ÷VçCÐ ¢6¶–ÆÂæ&6T†VÂ°¢6¶–ÆÂæ†VÅW$ÆWfVÂ ¢†ÇbÓ“°  ¢'G2çW6‚€ ¢.Y¹î[ê”…Yû®zHâ"°¢†VÄÖ÷VçB°¢"¾i›®X©¼9r"°¢„TÄ”äuô”åEô4ôTdd”4”TåB° ¢€¢6¶–ÆÂæ†VÅW$ÆWfVÀ¢ð¢.ûÈŽYû®zHîjøþ{I¢²"°¢6¶–ÆÂæ†VÅW$ÆWfVÂ°¢.ûÈ’ ¢ ¢" ¢’°¢.ûÉµ5Yû®zHâ"°¢‡6¶–ÆÂæ&6T†VÅ5²‡6¶–ÆÂæ†VÅ5W$ÆWfVÇÇÃ’¢†ÇbÓ’’°¢‡6¶–ÆÂæ†VÅ5W$ÆWfVÂò.ûÈŽYû®zHîjøþ{I¢²"·6¶–ÆÂæ†VÅ5W$ÆWfVÂ².ûÈ’"¢""’°¢"¾i›®X©¼9r"°¢5ô„TÄ”äuô”åEô4ôTdd”4”TåB°¢.ûÈŽikÞiKîˆ^iÊÎK«®KˆÞY¹î[ê•5ûÈ’  ¢“° ¢Ð  ¢–b€¢6¶–ÆÂæ6FVv÷'“ÓÓÒ'&Wf—fR"b`¢6¶–ÆÂç&Wf—fT†VÅW&6VçD'”ÆWfVÀ¢—° ¢'G2çW6‚€ ¢.[êžkK¾h.[ê’"°¢6¶–ÆÂç&Wf—fT†VÅW&6VçD'”ÆWfVÅ¶ÇbÓÒ°¢"^Š˜xò  ¢“° ¢Ð  ¢–b€¢6¶–ÆÂæ6FVv÷'“ÓÓÒ'76—fR ¢—° ¢'G2çW6‚€¢6¶–ÆÂæFW67&—F–öà¢“° ¢Ð  ¢–b‡'G2æÆVæwFƒÃ—°¢6öçF–çVS°¢Ð  ¢Æ–æW2çW6‚€ ¢sÆF—b7G–ÆSÒ"r°¢vF—7Æ“¦fÆWƒ¶v£gƒ·FF–æs£7‚²r°¢v&÷&FW"Ö&÷GFöÓ£‚6öÆ–B&v&ƒ#CÃƒÃCÂã"“²#âr° ¢sÇ7â7G–ÆSÒ&fÆWƒ£Cƒ¶6öÆ÷#¢6c#C#“¶föçB×vV–v‡C¦&öÆC²#âr°¢$Çbâ"¶Çb°¢#Â÷7ãâ"° ¢sÇ7â7G–ÆSÒ&fÆWƒ£²#âr°¢'G2æ¦ö–â‚.ûÙÂ"’°¢#Â÷7ãâ"° ¢#ÂöF—câ  ¢“° ¢Ð  ¢&WGW&âÆ–æW2æ¦ö–â‚""“° §Ð  ¦gVæ7F–öâ6†÷u6¶–ÆÄFWF–Â‡6¶–ÆÄ–B—° ¢6öç7B6¶–ÆÃÐ¢6¶–ÆÄFF&6U·6¶–ÆÄ–EÓ°  ¢–b‚6¶–ÆÂ—°¢&WGW&ã°¢Ð  ¢6öç7B6†&7FW#Ð¢6†&7FW%6¶–ÆÄÆöF÷WG5°¢7W'&VçE6¶–ÆÄ6†&7FW ¢Ó°  ¢6öç7BÆWfVÃÐ ¢€¢6†&7FW"b`¢6†&7FW"ç6¶–ÆÄÆWfVÇ2b`¢6†&7FW"ç6¶–ÆÄÆWfVÇ5·6¶–ÆÄ–EÐ¢—ÇÀ¢°  ¢6öç7B76÷7CÐ ¢6¶–ÆÂç76÷7BÓ×VæFVf–æV@¢ð¢6¶–ÆÂç76÷7@¢ ¢6¶–ÆÂæ6÷7C°  ¢6öç7B–6öäVÃÐ¢B‚'6¶–ÆÄFWF–Ä–6öâ"“°  ¢–b†–6öäVÂ—° ¢–6öäVÂç7G–ÆRæ&6¶w&÷VæD–ÖvSÐ ¢6¶–ÆÄ–6öä–ÖvW2b`¢6¶–ÆÄ–6öä–ÖvW5·6¶–ÆÄ–EÐ¢ð¢'W&Â‚"°¢6¶–ÆÄ–6öä–ÖvW5·6¶–ÆÄ–EÒ°¢"’ ¢ ¢&æöæR#° ¢–6öäVÂçFW‡D6öçFVçCÐ ¢6¶–ÆÄ–6öä–ÖvW2b`¢6¶–ÆÄ–6öä–ÖvW5·6¶–ÆÄ–EÐ¢ð¢" ¢ ¢"#° ¢Ð  ¢B‚'6¶–ÆÄFWF–ÄæÖR"¢çFW‡D6öçFVçCÐ ¢6¶–ÆÂææÖR° ¢€¢ÆWfVÃã ¢ð¢.ûÈ„Çbâ"¶ÆWfVÂ°¢€¢6¶–ÆÂæÖ„ÆWfVÀ¢ð¢"ò"·6¶–ÆÂæÖ„ÆWfVÀ¢ ¢" ¢’°¢.ûÈ’ ¢ ¢.ûÈŽiÊ®ZÛŽ{ù.ûÈ’ ¢“°  ¢B‚'6¶–ÆÄFWF–Å7FG2"¢æ–ææW$…DÔÃÐ ¢ ¢ÆF—b7G–ÆSÒ&Ö&v–âÖ&÷GFöÓ£gƒ²#à¢Ç7â7G–ÆSÒ ¢F—7Æ“¦–æÆ–æRÖ&Æö6³°¢&6¶w&÷VæC¢3&S#ƒ##°¢6öÆ÷#¢6c#C#“°¢föçB×6—¦S£ƒ°¢föçB×vV–v‡C¦&öÆC°¢FF–æs£'‚wƒ°¢&÷&FW"×&F—W3£ƒ°¢#à¢G¶vWE6¶–ÆÄ6FVv÷'”Æ&VÂ‡6¶–ÆÂæ6FVv÷'’—Ð¢Â÷7ãà¢ÂöF—cà ¢ÆF—b7G–ÆSÒ&Æ–æRÖ†V–v‡C£ãs²#à¢G·6¶–ÆÂæFW67&—F–öçÐ¢ÂöF—cà ¢ÆF—b7G–ÆSÒ&Ö&v–â×F÷£‡ƒ¶6öÆ÷#¢6#6S†3²#à¢G°¢6¶–ÆÂæ6FVv÷'“ÓÓÒ'76—fR ¢ð¢.Š*¾X¹^h¨ˆ;ÞûÈÎKˆÞyJŽŠ9ÞX)žûÈÎZÛŽK¨n[kŽK˜^yIþiX‚ ¢ ¢76÷7B²%5 ¢Ð¢G°¢6¶–ÆÂæÆV&ä6÷7@¢ð¢.ûÙÎZÛŽ{ù.™ÈŠh"·6¶–ÆÂæÆV&ä6÷7B².h¨ˆ;Þ›¹â ¢ ¢" ¢Ð¢ÂöF—cà ¢ÆF—b7G–ÆSÒ&Ö&v–â×F÷£ƒ¶föçB×6—¦S£ƒ¶6öÆ÷#¢6c#C#“¶föçB×vV–v‡C¦&öÆC²#à¢YNzØž{I®i[ŽXÀ¢ÂöF—cà ¢ÆF—b7G–ÆSÒ&Ö&v–â×F÷£Gƒ¶föçB×6—¦S£'ƒ²#à¢G°¢'V–ÆE6¶–ÆÄÆWfVÄ'&V¶F÷vä…DÔÂ€¢6¶–ÆÀ¢¢Ð¢ÂöF—cà ¢°  ¢6öç7BFWF–Å7FG3ÒB‚'6¶–ÆÄFWF–Å7FG2"“° ¢–b†FWF–Å7FG2—°¢FWF–Å7FG2ç67&öÆÅF÷Ó°¢Ð ¢°¢Fö7VÖVçBæFö7VÖVçDVÆVÖVçBÀ¢Fö7VÖVçBæ&öG’À¢B‚&vÖR×f–Ww÷'B"’À¢B‚&vÖR×7FvR"¢Òæf÷$V6‚†VÃÓç°¢–b†VÂ—°¢VÂæ6Æ74Æ—7BæFB‚'6¶–ÆÂÖFWF–Â×67&öÆÂÖ7F—fR"“°¢Ð¢Ò“° ¢B‚'6¶–ÆÄFWF–ÄÖöFÂ"¢æ6Æ74Æ—7@¢æFB‚'6†÷r"“° §Ð  ¦gVæ7F–öâ6Æ÷6U6¶–ÆÄFWF–Â‚—° ¢B‚'6¶–ÆÄFWF–ÄÖöFÂ"¢æ6Æ74Æ—7@¢ç&VÖ÷fR‚'6†÷r"“° ¢°¢Fö7VÖVçBæFö7VÖVçDVÆVÖVçBÀ¢Fö7VÖVçBæ&öG’À¢B‚&vÖR×f–Ww÷'B"’À¢B‚&vÖR×7FvR"¢Òæf÷$V6‚†VÃÓç°¢–b†VÂ—°¢VÂæ6Æ74Æ—7Bç&VÖ÷fR‚'6¶–ÆÂÖFWF–Â×67&öÆÂÖ7F—fR"“°¢Ð¢Ò“° §Ð  ¢ò ¢)ˆRikZ)îûÈŽKéÞxZ~KÛþyJŽˆ^Šhk.ûÈÎ8Î‹ùNY¹îjnj`¢ix˜(®ZI®KˆX¾ûÉþhÈž˜‰^ûÈÎ‹{>X{®[Îh
~Šª®iˆî8ÞûÈžûÉ ¢[ØŽz©~XZ~ZëžY»®Zé®Zú¾jÛ¾YÊ„…DÔÎŠ:ûÈÎ˜	žXZžX¾X{Þ[Èð¢Xú®‹*‹*Î™h¾™yÎûÈÎ‹yö6Æ÷6U6¶–ÆÄFWF–Â‚žiŠð¢YÎKˆzŠî{
YjîjŠ[Èþ8 ¢¢ð ¦gVæ7F–öâ6†÷u7FGW4†VÇ‚—° ¢B‚'7FGW4†VÇÖöFÂ"¢æ6Æ74Æ—7@¢æFB‚'6†÷r"“° §Ð  ¦gVæ7F–öâ6Æ÷6U7FGW4†VÇ‚—° ¢B‚'7FGW4†VÇÖöFÂ"¢æ6Æ74Æ—7@¢ç&VÖ÷fR‚'6†÷r"“° §Ð  ¢ò¢ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÐ¢z›þh‹@£ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÒ¢ð ¦gVæ7F–öâWV—6VÆV7FVD—FVÒ‚—° ¢6öç7B'WGFöâÐ¢B‚&—FVÔWV—'WGFöâ"“°  ¢–b†'WGFöâæFF6WBç6Æ÷B—° ¢VæWV——FVÒ€¢'WGFöâæFF6WBç6Æ÷@¢“° ¢&WGW&ã° ¢Ð  ¢–b€¢6VÆV7FVD–çfVçF÷'•6Æ÷CÓÓÖçVÆÀ¢—°¢&WGW&ã°¢Ð  ¢6öç7B—FVÒÐ¢–çfVçF÷'•6Æ÷G5°¢6VÆV7FVD–çfVçF÷'•6Æ÷@¢Ó°  ¢–b€¢—FVÒÇÀ¢—FVÒçG—SÓÓÒ'÷F–öâ ¢—°¢&WGW&ã°¢Ð  ¢6öç7B6†&7FW"Ð¢vWD&6·6´6†&7FW"€¢–çfVçF÷'”6†&7FW$–æFW€¢“°  ¢–b‚6†&7FW"—°¢&WGW&ã°¢Ð  ¢6öç7BWV—ÖVçD¶W’Ð¢vWD&6·6´WV—ÖVçD¶W’€¢–çfVçF÷'”6†&7FW$–æFW€¢“°  ¢6öç7BWV—ÖVçBÐ¢6†&7FW$WV—ÖVçE¶WV—ÖVçD¶W•Ó°  ¢6öç7BWV—ÖVçE6Æ÷BÐ¢vWD–çfVçF÷'”WV—ÖVçE6Æ÷B†—FVÒçG—R“°  ¢–b‚WV—ÖVçE6Æ÷B—°¢&WGW&ã°¢Ð  ¢6öç7BöÆD—FVÒÐ¢WV—ÖVçE¶WV—ÖVçE6Æ÷EÓ°  ¢–b†öÆD—FVÒ—° ¢–çfVçF÷'”—FV×2çW6‚€¢öÆD—FVÐ¢“° ¢Ð  ¢6öç7B7GVÄ–æFW‚Ð¢–çfVçF÷'”—FV×2æ–æFW„öb€¢—FVÐ¢“°  ¢–b†7GVÄ–æFWƒãÓ—° ¢–çfVçF÷'”—FV×2ç7Æ–6R€¢7GVÄ–æFW‚À¢¢“° ¢Ð  ¢WV—ÖVçE¶WV—ÖVçE6Æ÷EÒÐ¢—FVÓ°  ¢6Æ÷6T—FVÔÖöFÂ‚“° ¢&V'V–ÆD–çfVçF÷'•6Æ÷G2‚“° ¢&VæFW$–çfVçF÷'’‚“° ¢WFFUT’‚“° ¢6fTvÖR‚“° §Ð  ¢ò¢ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÐ¢ˆJ¾Kˆ°£ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÒ¢ð ¦gVæ7F–öâVæWV——FVÒ‡6Æ÷B—° ¢6öç7B6†&7FW"Ð¢vWD&6·6´6†&7FW"€¢–çfVçF÷'”6†&7FW$–æFW€¢“°  ¢–b‚6†&7FW"—°¢&WGW&ã°¢Ð  ¢6öç7BWV—ÖVçD¶W’Ð¢vWD&6·6´WV—ÖVçD¶W’€¢–çfVçF÷'”6†&7FW$–æFW€¢“°  ¢6öç7BWV—ÖVçBÐ¢6†&7FW$WV—ÖVçE¶WV—ÖVçD¶W•Ó°  ¢6öç7B—FVÒÐ¢WV—ÖVçE·6Æ÷EÓ°  ¢–b‚—FVÒ—°¢&WGW&ã°¢Ð  ¢–b€¢–çfVçF÷'”—FV×2æÆVæwFƒãÓ# ¢—° ¢ÆW'B€¢.ˆ8ÎXÈ^[{.k»þûÈÎxJk9^ˆJ¾Kˆ¾Š9ÞX)ž8" ¢“° ¢&WGW&ã° ¢Ð  ¢–çfVçF÷'”—FV×2çW6‚€¢—FVÐ¢“°  ¢WV—ÖVçE·6Æ÷EÓÖçVÆÃ°  ¢6Æ÷6T—FVÔÖöFÂ‚“° ¢&V'V–ÆD–çfVçF÷'•6Æ÷G2‚“° ¢&VæFW$–çfVçF÷'’‚“° ¢WFFUT’‚“° ¢6fTvÖR‚“° §Ð  ¢ò¢ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÐ¢YJîX{ £ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÒ¢ð ¦7–æ2gVæ7F–öâ6VÆÅ6VÆV7FVD—FVÒ‚—° ¢–b€¢6VÆV7FVD–çfVçF÷'•6Æ÷CÓÓÖçVÆÀ¢—°¢&WGW&ã°¢Ð  ¢6öç7B—FVÒÐ¢–çfVçF÷'•6Æ÷G5°¢6VÆV7FVD–çfVçF÷'•6Æ÷@¢Ó°  ¢–b‚—FVÒ—°¢&WGW&ã°¢Ð  ¢6öç7B&–6RÐ¢—FVÒç&–6WÇÀ¢°  ¢–b€¢G—Vöbv–æF÷rç't6öæf—&ÒÓÒ&gVæ7F–öâ"ÇÀ¢v—Bv–æF÷rç't6öæf—&Ò€¢.z+®Zé®ŠhX{®YJâ"°¢—FVÒææÖR°¢.ûÉõÆâ"°¢.xÛ.[ér"°¢&–6R°¢.˜y[š>8""À¢°¢F—FÆS¢.X{®YJîŠ9ÞX)’"À¢6öæf—&ÕFW‡C¢.z+®Zé®X{®YJâ"À¢6æ6VÅFW‡C¢.‹ùNY¹â ¢Ð¢¢—°¢&WGW&ã°¢Ð ¢–b€¢6VÆV7FVD–çfVçF÷'•6Æ÷CÓÓÖçVÆÂÇÀ¢–çfVçF÷'•6Æ÷G5·6VÆV7FVD–çfVçF÷'•6Æ÷EÒÓÖ—FVÐ¢—°¢&WGW&ã°¢Ð  ¢6öç7B7GVÄ–æFW‚Ð¢–çfVçF÷'”—FV×2æ–æFW„öb€¢—FVÐ¢“°  ¢–b†7GVÄ–æFWƒãÓ—° ¢6öç7B7F÷&VD—FVÓÖ–çfVçF÷'”—FV×5¶7GVÄ–æFW…Ó°¢6öç7B7W'&VçD6÷VçCÔÖF‚æÖ‚ƒÄçVÖ&W"‡7F÷&VD—FVÒæ6÷VçB—ÇÃ“° ¢–b†7W'&VçD6÷VçCã—°¢7F÷&VD—FVÒæ6÷VçCÖ7W'&VçD6÷VçBÓ°¢ÖVÇ6W°¢–çfVçF÷'”—FV×2ç7Æ–6R€¢7GVÄ–æFW‚À¢¢“°¢Ð ¢Ð  ¢ò ¢)ˆRKúîjÚ>ûÈŽyÉþjÚ>h©>X‹YXþšÎjžk©ûÈžûÉ ¢K˜¾X˜Þ˜	žŠ:y¨Nz+®Š¨ÞŠˆ®hþKˆy»NŠª®8ÎxÛ.[ép¢…Ž˜y[š>8ÞûÈÎKØn[éîš
ÞX‹[îk).iÈžK»¾KÙ^KˆŠÀ¢zˆ¾[Èþz+ÎyÉþy¨Nh¨®˜	žX¾i[ŽZÙ~Xª˜.K»¾KÙ^YËikž(	N(	@¢˜y[š>{;¾{[y[ni˜.jžiÊÎKˆÞZÙŽYÊŽûÈÎ˜	žXú^Š›zØžikÀ¢iŠþz›®š
ÞiJþzZŽ8.xûîYÊŽyÉþy¨NiÈ–vöÆN˜	žX¾X[yJ€¢‹8~k©K¨nûÈÎ˜	žŠ:Š9ÎKˆ®yÉþjÚ>y¨NXªXÎ8 ¢¢ð ¢vöÆCÐ¢vöÆB°¢&–6S°  ¢6Æ÷6T—FVÔÖöFÂ‚“° ¢&V'V–ÆD–çfVçF÷'•6Æ÷G2‚“° ¢&VæFW$–çfVçF÷'’‚“° ¢WFFTvöÆDF—7Æ’‚“° ¢6fTvÖR‚“° §Ð  ¢ò¢ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÐ¢ˆz®X¹^h‹šÊ^ŠŠÞZé £ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÒ¢ð ¢ò ¢)ˆRc3~ûÈŽkˆ^™šNjéŽyYž˜ÊþŠªNŠˆ®hþûÈžûÉ ¢WFôVæ&ÆVN8WFõ6¶–ÆÄ†öÖ^8‡W6U7D†öÖ^87W6U7D†öÖP¢iŠþˆˆ®x˜ŽK‹¾YøîXZ~[XÎˆz®X¹^ŠŠÞZé®y¨NXX>{JûÈÎxûîŠÎŠŠÞZé®[{.iKžyK¢WFô&GFÆU6WGF–æw5æVÎX¹^hX¾ŠŽYjî‰™^yn8.ˆˆ®x˜‡6fT&–æNK¸ÞYÊŽjøþjÊ‹ÈžXZP¢K‹¾X¹^h¨®˜	žY¹¾X¾8Î[{.yú^KˆÞZÙŽYÊŽ8Þy¨NXX>{JŠ‰Žh‰6öç6öÆRæW'&÷.ûÈÎiÈ>hêž‰8¾yÉþjÚ0¢y¨N˜ÊþŠªNûÉ¾Y¹¾jë^xJiXŽ{hZé®[{.z{¾™šN8  ¢WFõ6¶–ÆÄ&GFÆ^8‡W6U7D&GFÆ^87W6U7D&GFÆP¢˜	žKˆžX¾iŠþ[èŽizžiÉþx˜ŽiÊÎ8h‹šÊ^yZ¾™Ú.XZ~[XÎKˆ¾h¸ž˜ŽYjîy¨@¢ˆˆ®XX>{J”NûÈÎ[èÎKèn˜xÞikŠŠÞŠˆŽh‰xûîYÊŽ˜	žzŠà¢8Îj‰ž{B¾YYþX¹RþXÎjÚ"¾ŠŠÞZé®8Þy¨Nˆz®X¹^h‹šÊ^™Ú.iÛþi˜ ¢[{.{i>h»þhèžK¨nûÈÎKØn˜	žŠ:{hZé®K¨¾K»ny¨Nzˆ¾[Èþz+À¢k).iÈž‹yþ‰~kˆ^K›îkzŽûÈÎ[îˆ{NjøþjÊ‹ÈžXZ^˜;ÞiÈ>Y‰~Ššnh›à¢˜	ž[›îX¾KˆÞZÙŽYÊŽy¨NXX>{J8XÛX{®˜ÊþŠªNŠˆ®hð¢ûÈŽ™¹nxKniÈž™‹.YnKˆÞiÈ>Šé>˜®h‹.y[nj™þûÈÎKØn{X.z›niŠþ™¹ÎŠˆ®ûÈž8 ¢˜	žŠ:y»Nhê^XŠ®hèž˜	žKˆžjë^[{.{i>k).iÈžyºîj‰žXúþKº^{hy¨Nzˆ¾[Èþz+Î8 ¢¢ð  ¢ò ¢)ˆRˆz®X¹^h‹šÊ^h¨ˆ;ÞKˆ¾h¸ž˜ŽYjîiKžh‰X¹^hX¾yJ.yIþ8 ¢K˜¾X˜ÞiŠþZú¾jÛ¾YÊ„…DÔÎŠ:y¨NY»®Zé®˜Žš^ûÈŽXú®iÈžx¾zêÞ8iÈ>[ø>Kˆi8®ûÈžûÈÀ¢xûîYÊŽh¨ˆ;ÞiŠþxêžZënˆz®[{ZÛŽ8ˆz®[{Š9ÞX)žy¨NûÈÀ¢˜ŽYjîŠh‹yþ‰~8ÎyºîX˜ÞŠ9ÞX)žy¨Nh¨ˆ;Þ8ÞX¹^hX¾i»NikûÈÀ¢KˆÞxKnxêžZënŠ9ÞX)žK¨nikh¨ˆ;ÞûÈÎ˜	žŠ:XÛ¾˜ŽKˆÞX‹8  ¢Š*¾X¹^h¨ˆ;Þ‹yþZ)îy¸®h¨ˆ;ÞûÈŽh	.x¾ûÈžKˆÞiKî˜.ˆz®X¹^˜ŽYjîûÈÀ¢Š*¾X¹^h¨ˆ;Þk).iÈž8ÎK‹¾X¹^KÛþyJŽ8Þ˜	žY¹îK¨¾ûÉ°¢h	.x¾Zh.iéÎiKî˜.ˆz®X¹^˜ŽYjîûÈÀ¢ˆz®X¹^h‹šÊ^jøþY¹îYŽ˜;ÞiÈ>˜xÞikikÞiKîûÈÀ¢˜(þ‹ÊþiÈ>Šè®[é~[èŽZX~h
®ûÈÀ¢h˜Kº^h	.x¾yºîX˜ÞXXŽXú®ˆ;ÞYÊŽh‹šÊ^KŠÞh˜¾X¹^›¹îh¨ˆ;Þ˜ŽYjîikÞiKî8 ¢¢ð ¦gVæ7F–öâ÷VÆFTWFõ6¶–ÆÄ÷F–öç2‚—° ¢6öç7B6†&7FW"Ð¢6†&7FW%6¶–ÆÄÆöF÷WG2æf—&S°  ¢–b‚6†&7FW"—°¢&WGW&ã°¢Ð  ¢ÆWB÷F–öç4…DÔÂÐ ¢sÆ÷F–öâfÇVSÒ&æ÷&ÖÂ#îišî˜	®iK¾i8£Âö÷F–öãâs°  ¢6†&7FW"æWV—VE6¶–ÆÇ0¢æf÷$V6‚‡6¶–ÆÄ–CÓç° ¢6öç7B6¶–ÆÂÐ¢6¶–ÆÄFF&6U·6¶–ÆÄ–EÓ°  ¢–b€¢6¶–ÆÂÇÀ¢6¶–ÆÂæ6FVv÷'“ÓÓÒ&'Vfb'ÇÀ¢6¶–ÆÂæ6FVv÷'“ÓÓÒ'76—fR ¢—°¢&WGW&ã°¢Ð  ¢÷F–öç4…DÔÂ³Ð ¢sÆ÷F–öâfÇVSÒ"r°¢6¶–ÆÄ–B°¢r#âr°¢6¶–ÆÂææÖR°¢sÂö÷F–öãâs° ¢Ò“°  ¢6öç7B†öÖU6VÆV7BÐ¢B‚&WFõ6¶–ÆÄ†öÖR"“°  ¢6öç7B&GFÆU6VÆV7BÐ¢B‚&WFõ6¶–ÆÄ&GFÆR"“°  ¢6öç7B&Wf–÷W5fÇVRÐ¢WFô6öæf–rç6¶–ÆÃ°  ¢–b††öÖU6VÆV7B—° ¢†öÖU6VÆV7Bæ–ææW$…DÔÂÐ¢÷F–öç4…DÔÃ° ¢Ð  ¢–b†&GFÆU6VÆV7B—° ¢&GFÆU6VÆV7Bæ–ææW$…DÔÂÐ¢÷F–öç4…DÔÃ° ¢Ð  ¢ò ¢)ˆRyÉþy¨Nh©>X‹YXþšÎjžk©K¨nûÉ ¢˜	žŠ:XéþiÊÎXú®h›þŠ¨Ò&æ÷&ÖÂ.h‰n8ÎyºîX˜ÞŠ9ÞX)žy¨Nh¨ˆ;Þ8Ð¢iŠþYŽk9^XÎûÈÂ&FVfVæB.ûÈŽ™‹.zjnûÈžKˆÞYÊŽ˜	žXZžzŠîh8^k8XZ~ûÈÀ¢iÈ>Š*¾˜	žjë^™‹.Yn˜(þ‹ÊþŠªNXŠNh‰8ÎKˆÞYŽk9^y¨NjéŽyYžXÎ8ÞûÈÀ¢[Ë~X‹n˜Y¹î8Îišî˜	®iK¾i8®8Þ(	N(	@¢˜	žjÚ>iŠþ8ÎiˆîiˆîŠŠÞZé®™‹.zjnûÈÎXÛ¾Šè®h‰išî˜	®iK¾i8®8Ð¢y¨NyÉþjÚ>XéþYºûÉ¦6öæf—&ÔWFô&GFÆU6WGF–æw2‚¢h˜ÞX™¾h¨¦WFô6öæf–rç6¶–ÆÎjÚ>z+®ŠŠÞh‰&FVfVæB.ûÈÀ¢{x®hê^‰~YÎXú¾˜	žX¾X{Þ[ÈþX®YÎjÚ^ûÈÀ¢˜	žŠ:XøŽh¨®Zè>kI~Y¹â&æ÷&ÖÂ.ûÈÀ¢zØžikÎKÛþyJŽˆ^y¨N˜Ži8~YÊŽXK.ZÙŽy¨NKˆ¾KˆX‹¾[Š*¾Šhn‰8¾hèž8  ¢KúîjÚ>ûÉ®h¨¢&FVfVæB.K™þŠinx+®YŽk9^XÎ8 ¢¢ð ¢6öç7B7F–ÆÅfÆ–BÐ¢&Wf–÷W5fÇVSÓÓÒ&æ÷&ÖÂ'ÇÀ¢&Wf–÷W5fÇVSÓÓÒ&FVfVæB'ÇÀ¢6†&7FW"æWV—VE6¶–ÆÇ2æ–æ6ÇVFW2€¢&Wf–÷W5fÇVP¢“°  ¢–b‚7F–ÆÅfÆ–B—° ¢WFô6öæf–rç6¶–ÆÃÐ¢&æ÷&ÖÂ#° ¢Ð  ¢–b††öÖU6VÆV7B—° ¢†öÖU6VÆV7BçfÇVRÐ¢WFô6öæf–rç6¶–ÆÃ° ¢Ð  ¢–b†&GFÆU6VÆV7B—° ¢&GFÆU6VÆV7BçfÇVRÐ¢WFô6öæf–rç6¶–ÆÃ° ¢Ð §Ð  ¢ò ¢)ˆRikZ)îûÉ®zÊÎK¨ÎŠy.ˆ›.x˜ŽiÊÎy¨Nˆz®X¹^h¨ˆ;Þ˜ŽYjîYÎjÚ^8 ¢‹y÷÷VÆFTWFõ6¶–ÆÄ÷F–öç2‚ž˜(þ‹ÊþZèÎXZŽ[Þz‹ûÈÀ¢Šè6†&7FW%6¶–ÆÄÆöF÷WG2çÆ–W#.ûÈÀ¢Zú¶WFô6öæf–s.ûÈÎi8ÞKÙÎy¨DDôÞXX>K»nK™þiŠð¢[Ž[ÎikÎzÊÎK¨ÎŠy.ˆ›.˜*>{XF–N8 ¢YÎi˜.‹*‹*ÎšþzK¢þ™«‰xþi[N[Ë^ŠŠÞZé®XÚx˜p¢ûÈ‡Æ–W#.KˆÞZÙŽYÊŽ[KˆÞyJŽŠé>xêžZënyÈ¾X‹˜	žXØZ®ûÈž8 ¢¢ð ¦gVæ7F–öâ÷VÆFTWFõ6¶–ÆÄ÷F–öç3"‚—° ¢6öç7B6&CÐ¢B‚'Æ–W#$WFõ6WGF–æw46&B"“°  ¢–b‚6&B—°¢&WGW&ã°¢Ð  ¢–b‚Æ–W#"—° ¢6&Bç7G–ÆRæF—7Æ“Ð¢&æöæR#° ¢&WGW&ã° ¢Ð  ¢6&Bç7G–ÆRæF—7Æ“Ð¢&&Æö6²#°  ¢6öç7BF—FÆTVÃÐ¢B‚'Æ–W#$WFõ6WGF–æw5F—FÆR"“°  ¢–b‡F—FÆTVÂ—° ¢F—FÆTVÂçFW‡D6öçFVçCÐ ¢""°¢Æ–W#"æ–B°¢.ˆz®X¹^h‹šÊ^ŠŠÞZé¢#° ¢Ð  ¢6öç7B6†&7FW#Ð¢6†&7FW%6¶–ÆÄÆöF÷WG2çÆ–W##°  ¢–b‚6†&7FW"—°¢&WGW&ã°¢Ð  ¢ÆWB÷F–öç4…DÔÃÐ ¢sÆ÷F–öâfÇVSÒ&æ÷&ÖÂ#îišî˜	®iK¾i8£Âö÷F–öãâs°  ¢6†&7FW"æWV—VE6¶–ÆÇ0¢æf÷$V6‚‡6¶–ÆÄ–CÓç° ¢6öç7B6¶–ÆÃÐ¢6¶–ÆÄFF&6U·6¶–ÆÄ–EÓ°  ¢–b€¢6¶–ÆÂÇÀ¢6¶–ÆÂæ6FVv÷'“ÓÓÒ&'Vfb'ÇÀ¢6¶–ÆÂæ6FVv÷'“ÓÓÒ'76—fR'ÇÀ¢6¶–ÆÂæ6FVv÷'“ÓÓÒ&†VÂ'ÇÀ¢6¶–ÆÂæ6FVv÷'“ÓÓÒ'&Wf—fR ¢—°¢&WGW&ã°¢Ð  ¢÷F–öç4…DÔÂ³Ð ¢sÆ÷F–öâfÇVSÒ"r°¢6¶–ÆÄ–B°¢r#âr°¢6¶–ÆÂææÖR°¢sÂö÷F–öãâs° ¢Ò“°  ¢6öç7B6VÆV7CÐ¢B‚&WFõ6¶–ÆÅÆ–W#""“°  ¢–b‚6VÆV7B—°¢&WGW&ã°¢Ð  ¢6öç7B&Wf–÷W5fÇVSÐ¢WFô6öæf–s"ç6¶–ÆÃ°  ¢6VÆV7Bæ–ææW$…DÔÃÐ¢÷F–öç4…DÔÃ°  ¢6öç7B7F–ÆÅfÆ–CÐ¢&Wf–÷W5fÇVSÓÓÒ&æ÷&ÖÂ'ÇÀ¢&Wf–÷W5fÇVSÓÓÒ&FVfVæB'ÇÀ¢6†&7FW"æWV—VE6¶–ÆÇ2æ–æ6ÇVFW2€¢&Wf–÷W5fÇVP¢“°  ¢–b‚7F–ÆÅfÆ–B—° ¢WFô6öæf–s"ç6¶–ÆÃÐ¢&æ÷&ÖÂ#° ¢Ð  ¢6VÆV7BçfÇVSÐ¢WFô6öæf–s"ç6¶–ÆÃ°  ¢6öç7B‡6VÆV7CÐ¢B‚&‡W6U7EÆ–W#""“°  ¢6öç7B76VÆV7CÐ¢B‚'7W6U7EÆ–W#""“°  ¢–b†‡6VÆV7B—° ¢‡6VÆV7BçfÇVSÐ¢WFô6öæf–s"æ‡° ¢Ð  ¢–b‡76VÆV7B—° ¢76VÆV7BçfÇVSÐ¢WFô6öæf–s"ç7° ¢Ð  ¢6öç7BVæ&ÆVD6†V6¶&÷ƒÐ¢B‚&WFôVæ&ÆVEÆ–W#""“°  ¢–b†Væ&ÆVD6†V6¶&÷‚—° ¢Væ&ÆVD6†V6¶&÷‚æ6†V6¶VCÐ¢WFô6öæf–s"æVæ&ÆVC° ¢Ð §Ð  ¢ò ¢)ˆRzÊÎK¨ÎŠy.ˆ›.ˆz®X¹^h‹šÊ^ŠŠÞZé®y¨NKˆ¾h¸ž˜ŽYjà¢y[X¹^i˜.ûÈÎh¨®XÎZú¾Y¹æWFô6öæf–s.8 ¢¢ð ¦gVæ7F–öâWFFTWFô6öæf–s$g&öÕT’‚—° ¢6öç7BVæ&ÆVD6†V6¶&÷ƒÐ¢B‚&WFôVæ&ÆVEÆ–W#""“°  ¢6öç7B6VÆV7CÐ¢B‚&WFõ6¶–ÆÅÆ–W#""“°  ¢6öç7B‡6VÆV7CÐ¢B‚&‡W6U7EÆ–W#""“°  ¢6öç7B76VÆV7CÐ¢B‚'7W6U7EÆ–W#""“°  ¢–b†Væ&ÆVD6†V6¶&÷‚—° ¢WFô6öæf–s"æVæ&ÆVCÐ¢Væ&ÆVD6†V6¶&÷‚æ6†V6¶VC° ¢Ð  ¢–b‡6VÆV7B—° ¢WFô6öæf–s"ç6¶–ÆÃÐ¢6VÆV7BçfÇVS° ¢Ð  ¢–b†‡6VÆV7B—° ¢WFô6öæf–s"æ‡Ð¢çVÖ&W"€¢‡6VÆV7BçfÇVP¢“° ¢Ð  ¢–b‡76VÆV7B—° ¢WFô6öæf–s"ç7Ð¢çVÖ&W"€¢76VÆV7BçfÇVP¢“° ¢Ð  ¢6fTvÖR‚“° §Ð  ¦gVæ7F–öâ7–æ4&GFÆTWFõ6WGF–æw2‚—° ¢ò ¢)ˆRKúîjÚ>ûÈŽyÉþy¨Nh©>X‹KˆX¾iÈ>y[nj™þy¨F'V~ûÈžûÉ ¢˜	žŠ:XéþiÊÎiÈ>y»Nhê^[Ð¢WFõ6¶–ÆÄ&GFÆRö‡W6U7D&GFÆR÷7W6U7D&GFÆP¢˜	žKˆžX¾ˆˆ®x˜Žh‹šÊ^yZ¾™Ú.XZ~[XÎKˆ¾h¸ž˜ŽYjîŠŠÞXÎûÈÀ¢KØn˜	žjÊiKžx˜Ž[èÎûÈÎ˜	žKˆžX¾Kˆ¾h¸ž˜ŽYjî[{.{i>i[NX¾h»þhè¢ûÈŽy»Ž™yÎŠŠÞZé®z{¾X‹8ÎŠŠÞZé®8ÞhÈž˜‰^[^™h¾y¨@¢WFô&GFÆU6WGF–æw5æVÎŠ:K¨nûÈžûÈÀ¢DôÞŠ:[{.{i>h›îKˆÞX‹˜	žKˆžX¾XX>{JûÈÀ¢y»Nhê^[ÖçVÆÂçfÇV^‹:nXÎiÈ>y»Nhê^K‰þX{®˜ÊþŠªNûÈÀ¢[îˆ{NYÎXú¾˜	žX¾X{Þ[Èþy¨NYËikžXZŽ˜:ŽKŠÞik~Yû~ŠÎ(	N(	@¢XÈ^hºÆ&Vv–ä6†&7FW%GW&â‚žûÈÀ¢zØžikÎjøþjÊ‹Ê®X‹xêžZënŠÎX¹^ûÈÀ¢yZ¾™Ú.˜;ÞiÈžXúþˆ;ÞYºx+®˜	žŠ:Y›N˜ÊþˆÎXÚKØþ8  ¢ikx˜ŽŠŠÞZé®™Ú.iÛþiŠþ8Î›¹îŠŠÞZé®h˜Þ[^™h¾ûÈÀ¢[^™h¾i˜.h˜ÞyK7v—F6„WFõ6WGF–æw46†&7FW"‚¢‹*‹*Î[‹nXZ^yºîX˜Þy¨NXÎ8ÞûÈÎKˆÞ™ÈŠhYÊŽ˜	žŠ:¢jøþjÊ˜;ÞK‹¾X¹^YÎjÚ^ûÈÎh˜Kº^y»Nhê^h¨®˜	žKˆžŠÎh»þhèžûÈÀ¢Xú®KùÞyYžYÎjÚ^8Î[{.ZÛŽh¨ˆ;Þ˜Žš^8Þ˜	ž˜:ŽXˆ`¢ûÈ‡÷VÆFTWFõ6¶–ÆÄ÷F–öç>{;¾X‰~X{Þ[Èð¢Xh^˜:Ž˜;Þ[{.{i>iÈ–çVÆÎjª.iú^ûÈÎKˆÞiÈ>iÈžYÎjŠ>y¨NYXþšÎûÈž8 ¢¢ð ¢÷VÆFTWFõ6¶–ÆÄ÷F–öç2‚“° ¢÷VÆFTWFõ6¶–ÆÄ÷F–öç3"‚“° §Ð  ¢ò¢ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÐ¢h‹šÊ^‹8~Šˆ £ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÒ¢ð ¦gVæ7F–öâ6WD&GFÆT–æfôW‡æFVB†W‡æFVB—° ¢6öç7B&Vv–öãÖFö7VÖVçBçVW'•6VÆV7F÷"‚"6&GFÆUvRæ&GFÆRÖ–æfò×&Vv–öâ"“°¢6öç7BFövvÆSÒB‚&&GFÆT–æfõFövvÆR"“° ¢–b‚&Vv–öçÇÂFövvÆR—²&WGW&âfÇ6S²Ð ¢6öç7BæW‡CÒW‡æFVC°¢&Vv–öâæ6Æ74Æ—7BçFövvÆR‚&—2ÖW‡æFVB"ÆæW‡B“°¢FövvÆRç6WDGG&–'WFR‚&&–ÖW‡æFVB"ÆæW‡Cò'G'VR#¢&fÇ6R"“°¢FövvÆRç6WDGG&–'WFR‚&&–ÖÆ&VÂ"ÆæW‡Cò.iKnYŽh‹šÊ^‹8~Šˆ¢#¢.[^™h¾h‹šÊ^‹8~Šˆ¢"“°¢&WGW&âG'VS° §Ð ¦gVæ7F–öâFövvÆT&GFÆT–æfõæVÂ‚—° ¢6öç7B&Vv–öãÖFö7VÖVçBçVW'•6VÆV7F÷"‚"6&GFÆUvRæ&GFÆRÖ–æfò×&Vv–öâ"“°¢&WGW&â6WD&GFÆT–æfôW‡æFVB‚‡&Vv–öâbg&Vv–öâæ6Æ74Æ—7Bæ6öçF–ç2‚&—2ÖW‡æFVB"’’“° §Ð ¦gVæ7F–öâ6ÆV$&GFÆTÆör‚—° ¢6WD&GFÆT–æfôW‡æFVB†fÇ6R“° ¢B‚&&GFÆT–æfò"¢æ–ææW$…DÔÃÒ"#° ¢ò¢cs2ãC#¢VÆVÖVçB&÷‚6âW6R÷F–öç2v†–ÆRæò&GFÆR—2'Vææ–ærà¢6''’F†÷6Ræ÷F–6W2–çFòF†RæW‡B&GFÆRÖ–æfòæVÂW†7FÇ’öæ6Râ¢ð¢6öç7BVæF–ætVÆVÖVçD&÷„æ÷F–6W3Ð¢G—Vöbv–æF÷rÓÒ'VæFVf–æVB"bd'&’æ—4'&’‡v–æF÷rçcs3C%VæF–æt&GFÆTæ÷F–6W2¢òv–æF÷rçcs3C%VæF–æt&GFÆTæ÷F–6W2ç7Æ–6Rƒ¢¢µÓ°¢VæF–ætVÆVÖVçD&÷„æ÷F–6W2æf÷$V6‚†ÖW76vSÓæFD&GFÆTÆör†ÖW76vR’“°  ¢ò ¢)ˆRikZ)îûÈŽKéÞxZ~KÛþyJŽˆ^Šhk.ûÈÎ[z˜(þš™Ú.y¨@¢h‹šÊ^‹8~Šˆ®Šhn‰8¾[NûÈžûÉ ¢ikh‹šÊ^™h¾Zx¾kˆ^z›®{H˜ÈNy¨NYÎi˜.ûÈÀ¢[z˜(þš™Ú.˜*>K»ÞK™þŠhKˆ‹[~kˆ^z›®ûÈÀ¢KˆÞxKnikh‹šÊ^h™>X‹KˆXØ®ûÈÎ[z˜(þš™Ú.XÛ¾˜(@¢jéŽyYž‰~Kˆ®Kˆ®KˆZNy¨Nˆˆ®{H˜ÈNûÈÎXZž˜(®iÈ>[ÞKˆÞ‹[~Kèn8 ¢¢ð ¢6öç7BÖ–æfóÐ¢B‚&Ö&GFÆT–æfò"“°  ¢–b†Ö–æfò—° ¢Ö–æfòæ–ææW$…DÔÃÐ¢"#° ¢Ð  ¢ò ¢)ˆRikZ)îûÈŽKéÞxZ~KÛþyJŽˆ^Šhk.ûÈžûÉ ¢ikh‹šÊ^™h¾Zx¾ûÈÎY»®Zé®šþzK®y¨NY¹îYŽi[Žj‰ž{@¢K™þŠh˜xÞ{ÚîY¹îzÊÃY¹îYŽûÈÎKˆÞxKniÈ>jéŽyY¢Kˆ®KˆZNh‹šÊ^{YiÙþi˜.y¨NY¹îYŽi[Ž8 ¢¢ð ¢6öç7BGW&ä–æF–6F÷#Ð¢B‚&&GFÆUGW&ä–æF–6F÷""“°  ¢–b‡GW&ä–æF–6F÷"—° ¢GW&ä–æF–6F÷"çFW‡D6öçFVçCÐ¢.zÊÂY¹îY‚#° ¢Ð  ¢6öç7BÖGW&ä–æF–6F÷#Ð¢B‚&Ö&GFÆUGW&ä–æF–6F÷""“°  ¢–b†ÖGW&ä–æF–6F÷"—° ¢ÖGW&ä–æF–6F÷"çFW‡D6öçFVçCÐ¢.zÊÂY¹îY‚#° ¢Ð §Ð  ¢ò ¢)ˆRikZ)îûÈŽKéÞxZ~KÛþyJŽˆ^Šhk.ûÈžûÉ ¢k®Zé®Y¹îYŽ‹8~Šˆ®X‰~ûÈŽzÊÅŽY¹îYŽûÈþX	.i[ŽûÈþyºîj‰žûÈ¢‹yþh‹šÊ^hÈ~KºNhÈž˜‰^XØûÈŽh¨ˆ;Òþišî˜	®iK¾i8¢þ™‹.zjbð¢xšžY8þ˜>ˆJ¾ûÈžxûîYÊŽŠ›.šþzK®˜(NiŠþŠ›.‰xþ‹[~Kèn8  ¢ŠhþX˜~ûÉ ¢ÒWFô&GFÆ^x+§G'V^ûÈŽˆz®X¹^h‹šÊ^hÈ{¨Î™h¾‰~ûÈžûÉ ¢KˆÞzêxûîYÊŽiŠþZê>Y®˜(NiŠþ{Yzé~™¨îjë^ûÈÎKˆ[è¾‰xþ‹[~KènûÈÀ¢KˆÞiÈ>jøþX¾Šy.ˆ›.ŠÎX¹^ZèÎ[Xˆ~hù¾KˆjÊ8š¾{˜™h>xˆÞ8 ¢ÒWFô&GFÆ^x+¦fÇ6^ûÈŽh˜¾X¹^ûÈžûÉ ¢{Yzé~™¨îjë^ûÈ†&GFÆU†6SÓÓÒ'&W6öÇfR.ûÈÀ¢™¹žikžjÚ>YÊŽKéÞ[¨þyÉþjÚ>X{®h˜¾ûÈž‰xþ‹[~KènûÈÎk‰¾[	yZ¾™Ú ¢™¹ÎŠˆ®ûÉ¾Zê>Y®™¨îjë^ûÈ†&GFÆU†6SÓÓÒ&FV6Æ&R.ûÈÀ¢zØžxêžZënˆz®[{˜Ži8~ŠhX®K¸›«ÎûÈžšþzK®X{®KènûÈÀ¢KˆÞxKnxêžZëniÈ>yÈ¾KˆÞX‹hÈž˜‰^8KˆÞyú^˜>Šh›¹îY:®Š:8  ¢‰xþ‹[~Kèny¨Ni˜.X	žšnKëþ™yÎ™hžXúþˆ;Þ˜(N™h¾‰~y¨Nh¨ˆ;Òð¢xšžY8ZÙ˜ŽYjîûÈ†6Æ÷6TÖVçW2‚žûÈžûÈÎ˜þXXÞhÈž˜‰^XØ ¢Š*¾‰xþ‹[~Kèn8ZÙ˜ŽYjîXÛ¾˜(Nš8NYÊŽyZ¾™Ú.Kˆ®y¨Nh
®x¸k88 ¢¢ð ¦gVæ7F–öâWFFT7F–öä‡VEf—6–&–Æ—G’‚—° ¢6öç7B7F—fTWFóÐ¢7F—fT&GFÆT6†&7FW$–æFWƒÓÓÓ ¢òWFô&GFÆP¢¢vWE'G”WFô6öæf–r†7F—fT&GFÆT6†&7FW$–æFW‚’æVæ&ÆVC° ¢6öç7B&GFÆU&W6VçFF–öä7F—fSÒ€¢G—Vöbv–æF÷rÓÒ'VæFVf–æVB"b`¢v–æF÷räf÷W%7–Ö&öÇ4&GFÆTfÆ÷rb`¢G—Vöbv–æF÷räf÷W%7–Ö&öÇ4&GFÆTfÆ÷ræ—5&W6VçFF–öä7F—fSÓÓÒ&gVæ7F–öâ"b`¢v–æF÷räf÷W%7–Ö&öÇ4&GFÆTfÆ÷ræ—5&W6VçFF–öä7F—fR‚¢“° ¢6öç7B6†÷VÆD†–FSÐ¢7F—fTWFòÇÂ&GFÆU†6SÓÓÒ'&W6öÇfR"ÇÂ&GFÆU&W6VçFF–öä7F—fS°  ¢ò ¢)ˆRKúîjÚ>ûÈŽKéÞxZ~KÛþyJŽˆ^kèNkˆ^ûÈÎXXŽX˜ÞynŠz>˜ÊþK¨nûÈžûÉ ¢Y¹îYŽ‹8~Šˆ®X‰~ûÈŽY
¾Y¹îYŽi[‚þŠˆŽi˜.Yš‚þyºîj‰žûÈ¢ˆz®X¹^h‹šÊ^i˜.xZ~ˆˆ®i[NX¾™«‰xþûÈÎKˆÞx›žXŠ^yY¢Y¹îYŽi[ŽYÊŽ˜	žŠ:(	N(	NKÛþyJŽˆ^Šhy¨NiŠþ8Îh‹šÊP¢‹8~Šˆ¢Žh‹šÊ^{H˜ÈNjbžiÊÎ‹ª¾8ÞšþzK®yºîX˜ÞY¹îYŽi[ŽûÈÀ¢KˆÞiŠþ˜	žX¾hÈž˜‰^X‰~y¨NKˆ˜:ŽXˆnûÈÎiKžY¹îXéþiÊÀ¢y¨Ni[Nš¹N™«‰xþ˜(þ‹Êþ8 ¢¢ð ¢6öç7BGW&å&÷sÐ¢B‚'GW&åF&vWE&÷r"“°  ¢–b‡GW&å&÷r—° ¢GW&å&÷ræ6Æ74Æ—7BçFövvÆR€¢&&GFÆRÖ‡VBÖ†–FFVâ"À¢6†÷VÆD†–FP¢“° ¢Ð  ¢6öç7B6öÖÖæE&÷sÐ¢B‚&&GFÆT6öÖÖæE&÷r"“°  ¢–b†6öÖÖæE&÷r—° ¢6öÖÖæE&÷ræ6Æ74Æ—7BçFövvÆR€¢&&GFÆRÖ‡VBÖ†–FFVâ"À¢6†÷VÆD†–FP¢“°  ¢–b‡6†÷VÆD†–FR—° ¢6Æ÷6TÖVçW2‚“°¢6ÆV$&GFÆUF&vWE6VÆV7F–öäÖöFR‚“° ¢Ð ¢Ð §Ð  ¦gVæ7F–öâFD&GFÆTÆör‡FW‡B—° ¢6öç7B–æfòÐ¢B‚&&GFÆT–æfò"“°  ¢–b‚–æfò—°¢&WGW&ã°¢Ð  ¢ò ¢)ˆRKúîjÚ>ûÈŽKéÞxZ~KÛþyJŽˆ^Šhk.ûÈžûÉ ¢K˜¾X˜ÞjøþXªKˆŠÎikŠˆ®hþûÈÎ[[Ë~X‹nh¨®hÛ.‹»Žh¸žX‹ ¢iÈ[©^˜:ŽûÈÎ[îˆ{NKÛþyJŽˆ^[èKˆ®k¹h;>yÈ¾K˜¾X˜Þy¨@¢{H˜ÈNi˜.ûÈÎKˆiÈžikŠˆ®hþ˜.Kèn[Š*¾[Ë~X‹nh¸žY¹îXë¾ûÈÀ¢ZèÎXZŽyÈ¾KˆÞX‹h;>yÈ¾y¨NXZ~Zëž8  ¢iKžh‰XXŽXŠNik~8ÎKÛþyJŽˆ^xûîYÊŽiŠþKˆÞiŠþ[{.{i>YÊ€¢hê^‹ù[©^˜:Ž8ÞûÈŽZëžŠ‹#Žy¨NŠªN[zîûÈžûÈÀ¢Xú®iÈžYÊŽ8ÎXéþiÊÎ[YÊŽ[©^˜:Ž™˜N‹ù8Þy¨Nh8^k8Kˆ¾ûÈÀ¢h˜Þˆz®X¹^hÛ.X‹ikŠˆ®hþûÉ¾Zh.iéÎKÛþyJŽˆ^[{.{i0¢K‹¾X¹^[èKˆ®k¹™h¾Kˆjë^‹yÞ™º.ûÈÎKº>ŠŽK¹njÚ>YÊ€¢Y¹îš
ÞyÈ¾K˜¾X˜Þy¨N{H˜ÈNûÈÎ˜	ži˜.X	žikŠˆ®hþ˜.Kè`¢KˆÞiÈ>h™>ik~K¹nûÈÎhÛ.X¹^KØÞ{Úî{jÞhÈKˆÞŠè®8 ¢¢ð ¢6öç7Bv4æV$&÷GFöÓÐ ¢–æfòç67&öÆÄ†V–v‡BÐ¢–æfòç67&öÆÅF÷Ð¢–æfòæ6Æ–VçD†V–v‡@¢Ã#°  ¢6öç7BÆ–æRÐ¢Fö7VÖVçBæ7&VFTVÆVÖVçB€¢&F—b ¢“°  ¢Æ–æRæ6Æ74æÖRÐ¢&&GFÆRÖÆ–æR#°  ¢Æ–æRçFW‡D6öçFVçBÐ¢FW‡C°  ¢–æfòæVæD6†–ÆB€¢Æ–æP¢“°  ¢v†–ÆR€¢–æfòæ6†–ÆG&VâæÆVæwFƒãƒ ¢—° ¢–æfòç&VÖ÷fT6†–ÆB€¢–æfòæf—'7D6†–Æ@¢“° ¢Ð  ¢–b‡v4æV$&÷GFöÒ—° ¢–æfòç67&öÆÅF÷Ð¢–æfòç67&öÆÄ†V–v‡C° ¢Ð  ¢ò ¢)ˆRikZ)îûÈŽKéÞxZ~KÛþyJŽˆ^Šhk.ûÈÎ[z˜(þš™Ú.y¨@¢h‹šÊ^‹8~Šˆ®Šhn‰8¾[NûÈžûÉ ¢jøþXªKˆŠÎh‹šÊ^{H˜ÈNûÈÎYÎjÚ^ŠH~Š;ÞKˆK»ÞX‹ ¢[z˜(þš™Ú.˜*>K»Þh‹šÊ^‹8~Šˆ®jn(	N(	N˜	žiŠþYJþKˆ ¢‹*‹*ÎZú¾XZ^h‹šÊ^{H˜ÈNih~ZÙ~y¨NYËikžûÈÀ¢YÊŽ˜	žŠ:YÎjÚ^iÈYjî{INûÈÎKˆÞyJŽXúnZInh›à¢jøþKˆX¾YÎXú¶FD&GFÆTÆör‚žy¨NYËik¢YNˆz®‰™^yn8.˜	žK»ÞKˆÞyJŽ‰™^yn8ÎhÛ.X‹[©^˜:Ž8Ð¢y¨N˜(þ‹ÊþûÈÎxêžZën™º.™h¾h‹šÊ^8Y¹îX‹YËYÉnK˜¾[èÀ¢h˜ÞiÈ>yÈ¾X‹˜	žK»ÞûÈÎKˆÞiÈ>iÈž8ÎikŠˆ®hþKˆy»@¢h™>ik~jÚ>YÊŽyÈ¾y¨NXZ~Zëž8Þy¨NYXþšÎ8 ¢¢ð ¢6öç7BÖ–æfóÐ¢B‚&Ö&GFÆT–æfò"“°  ¢–b†Ö–æfò—° ¢6öç7BÖÆ–æSÐ¢Fö7VÖVçBæ7&VFTVÆVÖVçB€¢&F—b ¢“°  ¢ÖÆ–æRæ6Æ74æÖSÐ¢&&GFÆRÖÆ–æR#°  ¢ÖÆ–æRçFW‡D6öçFVçCÐ¢FW‡C°  ¢Ö–æfòæVæD6†–ÆB€¢ÖÆ–æP¢“°  ¢v†–ÆR€¢Ö–æfòæ6†–ÆG&VâæÆVæwFƒãƒ ¢—° ¢Ö–æfòç&VÖ÷fT6†–ÆB€¢Ö–æfòæf—'7D6†–Æ@¢“° ¢Ð  ¢Ö–æfòç67&öÆÅF÷Ð¢Ö–æfòç67&öÆÄ†V–v‡C° ¢Ð §Ð  ¢ò¢ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÐ¢xêžZën‹8~Šˆ £ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÒ¢ð ¦gVæ7F–öâWFFUÆ–W$†VFW"‚—° ¢6öç7BVÆVÖVçBÐ¢VÆVÖVçDFF&6U°¢Æ–W"æVÆVÖVç@¢Ð¢ÇÀ¢VÆVÖVçDFF&6Ræf—&S°  ¢ò ¢)ˆRKúîjÚ>ûÈŽKéÞxZ~KÛþyJŽˆ^Šhk.ûÈÆVÖö¦žhù¾h‰ ¢55>X¹^yZ¾YÉnzK®ûÈžûÉ§FW‡D6öçFVçNiKžh‰ ¢–ææW$…DÔÎûÈÎh˜Þˆ;ÞyÉþy¨Nh¨ ¢Ç7â6Æ73Ò&VÆVÖVçBÖ–6öââââ#à¢˜	žzŠä…DÔÎj‰ž{Nk‹.iù>X{®KènûÈÎKˆÞxKniÈ>Š*°¢y[nh‰{INih~ZÙ~ZÙ~™Ú.šþzK®8 ¢¢ð ¢B‚'Æ–W$æÖR"¢æ–ææW$…DÔÂÐ ¢vWDVÆVÖVçD–6öä…DÔÂ€¢Æ–W"æVÆVÖVç@¢’°¢""°¢€¢Æ–W"æ–GÇÀ¢VÆVÖVçBæ6†&7FW ¢“°  ¢B‚&VÆVÖVçEFW‡B"¢æ–ææW$…DÔÂÐ ¢vWDVÆVÖVçD–6öä…DÔÂ€¢Æ–W"æVÆVÖVç@¢’°¢""°¢VÆVÖVçBææÖS° §Ð  ¢ò ¢)ˆRikZ)îûÈŽKéÞxZ~KÛþyJŽˆ^Šhk.ûÈžûÉ ¢YÊŽ[z˜(þûÈþYËYÉnš™Ú.i˜.ûÈÎiÈKˆ®™Ú.˜*>j)Þj‰žšÎX‰p¢KˆÞšþzK®Šy.ˆ›.y¨NzØž{I¢ô…õ5ûÈÎiKžšþzK®8ÎYËYÉ`¢YÞz‹8ÞûÈ¾8Îh
®xšž‹8~Šˆ®ûÈŽYÞz‹þ[Îh
rþŠ˜xòð¢iXþhÛ~ûÈž8Þ8  ¢h
®xšž‹8~Šˆ®h©>y¨NiŠþyºîX˜ÞYËYÉnKˆ®ûÈ†Ööç7FW'5³×à¢Ööç7FW'5´Ô…õE$”ä”äuôÔôå5DU%2ÓÞûÈ¢zÊÎKˆ™«¾˜(NkK¾‰~y¨Nh
®xšž(	N(	N‹y÷'VäWFõG&öÄ6†V6²‚¢ˆz®X¹^[zh
®i˜.8Îh™>zÊÎKˆ™«¾˜(NkK¾‰~y¨Nh
®xšž8ÞyJŽy¨@¢iŠþYÎKˆX¾˜(þ‹ÊþûÈÎ˜	žŠ:šþzK®y¨N[iŠþ8Î[zh
®hÈžKˆ¾Xë°¢iÈ>h™>X‹y¨N˜*>™«¾h
®xšž8ÞûÈÎKˆÞiŠþ™ªŽKëþh©>Kˆ™«¾8  ¢XZž{XNj‰žšÎX‰~ûÈŽXéþiÊÎy¨NŠy.ˆ›.‹8~Šˆ®ûÈþ˜	žŠ:ikZ)îy¨@¢YËYÉb¾h
®xšž‹8~Šˆ®ûÈž[›>[‹ŽXú®iÈ>šþzK®Kˆ{XNûÈÀ¢YÊ‡6†÷uvR‚žŠ:Xˆ~hù¾š™Ú.i˜.iÈ>YÎXú¾˜	žŠ:¢˜xÞikXŠNik~ŠhšþzK®Y:®Kˆ{XN8 ¢¢ð ¢ò ¢)ˆRikZ)îûÈŽKéÞxZ~KÛþyJŽˆ^Šhk.ûÈÎ{{NX©þXØiKžx˜€¢X[yJŽ˜(þ‹ÊþûÈžûÉ ¢h¨®8ÎX‰~X{®iùX¾YËXØXZŽ˜:Žh
®xšžzŠîšîy¨NYÞz‹ð¢zØž{I¢þiXþhÛ~8Þ˜	žjë^˜(þ‹Êþh«Þh‰xÚŽz¸¾X{Þ[ÈþûÈÀ¢YËYÉnš™Ú.y¨Nh
®xšžkˆ^Yjîjn8{{NX©þXØiky¨@¢YËYÉn‹8~Šˆ®[ØŽz©~ûÈÎXZž˜(®˜;ÞŠhyJŽX‹YÎKˆZY~ûÈÀ¢KˆÞŠhYNˆz®Zú¾KˆK»Þ[›îK˜îKˆjŠ>y¨Nzˆ¾[Èþz+Î8  ¢YÎYÞh
®xšžûÈŽh»þhèžxè²þy¨~KˆÞzé~ûÈžXú®X‰~KˆjÊûÈÀ¢KˆÞX‰~Š˜xþûÈÎyJ†6öæf–ræÖöç7FW'2‚žh»þX‹ ¢i[NK»ÞXéþZx¾YÞYjîûÈŽKˆÞiŠö7W'&VçD&GFÆTÖöç7FW'0¢˜	žzŠî8Î˜	žZNh‹šÊ^h«ÞX‹Š«8Þy¨Nkˆ^YjîûÈžûÈÀ¢z+®KùÞ[zé~h
®xšžYÊŽh‹šÊ^Š:Š*¾h™>jÛ¾ûÈÎkˆ^Yjà¢˜(NiŠþZèÎi[NšþzK®˜	žX¾YËXØ8ÎiÈžY:®K©¾zŠîšî8Þ8 ¢¢ð ¦gVæ7F–öâvWE¦öæTÖöç7FW$Æ—7D…DÔÂ‡¦öæT¶W’—° ¢6öç7B6öæf–sÐ¢¦öæT6öæf–u·¦öæT¶W•Ó°  ¢–b‚6öæf–r—°¢&WGW&â"#°¢Ð  ¢6öç7B¦öæTÖöç7FW'3Ð ¢G—Vöb6öæf–ræÖöç7FW'3ÓÓÐ¢&gVæ7F–öâ ¢ð¢6öæf–ræÖöç7FW'2‚¢ ¢µÓ°  ¢6öç7B6VVäæÖW3Ð¢æWr6WB‚“°  ¢6öç7BÆ–æW3Ð¢µÓ°  ¢¦öæTÖöç7FW'2æf÷$V6‚€¢Ööç7FW#Óç° ¢–b€¢Ööç7FW"ÇÀ¢6VVäæÖW2æ†2€¢Ööç7FW"ææÖP¢¢—°¢&WGW&ã°¢Ð  ¢6VVäæÖW2æFB€¢Ööç7FW"ææÖP¢“°  ¢Æ–æW2çW6‚€ ¢Ööç7FW"ææÖR°¢$Çbâ"°¢Ööç7FW"æÆWfVÂ°¢.iXþhÛr"°¢ÖF‚ç&÷VæB€¢vWDÖöç7FW$v–Æ—G’€¢Ööç7FW ¢¢ ¢“° ¢Ð¢“°  ¢&WGW&âÆ–æW0¢æÖ€¢Æ–æSÓà¢#ÆF—câ"°¢Æ–æR°¢#ÂöF—câ ¢¢æ¦ö–â‚""“° §Ð  ¢ò ¢)ˆRikZ)îûÈŽKéÞxZ~KÛþyJŽˆ^Šhk.ûÈÎ{{NX©þXØiKžx˜ŽûÈžûÉ ¢jøþX¾YËXØy¨Nˆ8Îišþ{èîŠ>YÉnûÈÎXXŽyYžz›®ZÙ~K‹ ¢ûÈŽKÛþyJŽˆ^K˜¾[èÎiÈ>Š9ÎKˆ¦&6ScNh‰nYÉnx˜~{k.YØûÈÀ¢Xú®Šhh¨®[ÞhxžjÈNKØÞZ¾˜.Xë¾[iÈ>yIþiXŽûÈÀ¢Ç•G&–æ–æu¦öæT&6¶w&÷VæB‚ž‹yþ˜	žŠ:¢ZèÎXZŽKˆÞyJŽXhÞiKžûÈž8 ¢¢ð ¢ò ¢)ˆRikZ)îûÈŽKéÞxZ~KÛþyJŽˆ^Šhk.ûÈÎ[zh
®š™Ú ¢ûÈ‚6Öv^ûÈžˆ8ÎišþiKžh‰KéÞYËXØX¹^hX¾Xˆ~hù¾ûÈžûÉ ¢XéþiÊÂ6Öv^y¨Nˆ8ÎišþiŠþZú¾jÛ¾YÊ„55>Š:y¨@¢YjîKˆ[Ë^j:îié~YÉnûÈÎKˆÞzê˜.Y:®X¾YËXØ˜;Þ™[~[ép¢KˆjŠ>8.˜	žŠ:iKžh‰‹yþ{{NX©þXØYËYÉnš	ŠkÞYÎKˆzŠà¢ŠŠÞŠˆŽ(	N(	NKˆX¾xšžK»nŠ9Þ‰~jøþX¾YËXØYNˆz®y¨@¢ˆ8ÎišþYÉnûÈÆf÷&W7BöFW6W'NXXŽiKîKˆ®KÛþyJŽˆP¢˜	žjÊhùKé¾y¨NYÉnûÈÎX[nšIŽYËXØyYžz›®8K˜¾[èÀ¢KÛþyJŽˆ^ŠhŠ9ÎYÉnx˜~y»Nhê^Z¾˜.[ÞhxžjÈNKØÞ[Z[ÞûÈÀ¢KˆÞyJŽiKžK»¾KÙ^X[nK¹nzˆ¾[Èþz+Î8  ¢˜(Nk).iÈž[Ž[ÎYÉnx˜~y¨NYËXØûÈÎZY~yJ†Ç”Ö¦öæT&6¶w&÷VæB‚¢i˜.iÈ>˜Y¹îšþzK¦f÷&W7N˜	ž[Ë^y[nš	ŠŠÞXÎûÈÀ¢KˆÞiÈ>X{®xûîKˆx˜~›¹y¨NyZ¾™Ú.8 ¢¢ð ¦6öç7BÖ¦öæT&6¶w&÷VæD–ÖvW3×° ¢f÷&W7C¢&76WG2öÖ2öf÷&W7Bæ§r"À¢FW6W'C¢&76WG2öÖ2öFW6W'Bæ§r"À¢–6S¢""À¢¦öæSC¢""À¢¦öæSS¢""À¢¦öæSc¢""À¢¦öæSs¢""À¢¦öæSƒ¢""À¢¦öæS“¢""À¢¦öæS¢"  §Ó°  ¦gVæ7F–öâÇ”Ö¦öæT&6¶w&÷VæB‡¦öæT¶W’—° ¢ò ¢)ˆRKúîjÚ>ûÈŽKéÞxZ~KÛþyJŽˆ^Y¹îZûÈÎiKžh‰i8ÞKÙÀ¢xÚŽz¸¾y¨G÷6—F–öã¦f—†VNˆ8ÎišþYÉn[NûÈÀ¢KˆÞXhÞy»Nhê^[Ò6Öv^iÊÎ‹ª¾ŠŠÞZé ¢&6¶w&÷VæBÖ–Öv^ûÈž8 ¢¢ð ¢6öç7B&tÆ–W#Ð¢B‚&ÖvT&tÆ–W""“°  ¢–b‚&tÆ–W"—°¢&WGW&ã°¢Ð  ¢6öç7B–ÖvUW&ÃÐ ¢Ö¦öæT&6¶w&÷VæD–ÖvW5·¦öæT¶W•×ÇÀ¢Ö¦öæT&6¶w&÷VæD–ÖvW2æf÷&W7C°  ¢&tÆ–W"ç7G–ÆRæ&6¶w&÷VæD–ÖvSÐ ¢'W&Â‚"°¢–ÖvUW&Â°¢"’#° §Ð  ¢ò ¢)ˆRikZ)îûÈŽKéÞxZ~KÛþyJŽˆ^Šhk.ûÈÎ8Îh¨ˆ;Þ˜XÞŠ9Ð¢Xú®šþzK¦–6öîûÈÎyºîX˜Þk).iÈ––6öîYÉnzK®[XXŽz›®‰~8ÞûÈžûÉ ¢h¨ˆ;ÞYÉnzK®y¨Nš	yYžiú^h›îŠŽûÈÆ¶WžiŠþh¨ˆ;Ô”NûÈÀ¢fÇV^XXŽXZŽ˜:ŽyYžz›®ZÙ~K‹.8.K˜¾[èÎŠh[š¾h¨ˆ;ÞŠ9À¢YÉnzK®ûÈÎy»Nhê^[Þ˜	žX¾xšžK»nZ¾XZ^[Þhxžy¨@¢&6ScNh‰nYÉnx˜~{k.YØ[iÈ>yIþiXŽûÈŽh¨ˆ;ÞX‰~ŠŽ8¢Š9ÞX)žjÈNjÎZÙ8h¨ˆ;ÞŠ›>{K[ØŽz©~KˆžX¾YËikž˜;Ð¢iÈ>ˆz®X¹^ZY~yJŽYÎKˆ[Ë^YÉnûÈÎKˆÞyJŽXˆnXŠ^Xë¾iKžûÈžûÈÀ¢KˆÞyJŽiKžK»¾KÙ^X[nK¹nzˆ¾[Èþz+Î8 ¢¢ð ¦6öç7B6¶–ÆÄ–6öä–ÖvW3ÖVÆVÖVçE6¶–ÆÄ–6öäÖ°  ¦6öç7B¦öæT&6¶w&÷VæD–ÖvW3×° ¢f÷&W7C¢""À¢FW6W'C¢""À¢–6S¢""À¢¦öæSC¢""À¢¦öæSS¢""À¢¦öæSc¢""À¢¦öæSs¢""À¢¦öæSƒ¢""À¢¦öæS“¢""À¢¦öæS¢"  §Ó°  ¦gVæ7F–öâÇ•G&–æ–æu¦öæT&6¶w&÷VæB‡¦öæT¶W’—° ¢ò ¢)ˆRKúîjÚ>ûÈŽKéÞxZ~KÛþyJŽˆ^Y¹îZûÈÎiKžh‰i8ÞKÙÀ¢xÚŽz¸¾y¨G÷6—F–öã¦f—†VNˆ8ÎišþYÉn[NûÈžûÉ ¢˜	žX¾YÉn[Ny¨D5526Æ7>iÊÎ‹ª¾[{.{i>XZ~[»®K¨`¢8ÎŠ«þi©~kËŽ[B¾š	ŠŠÞ{‹ÞŠkÞYÉn8Þ˜	žX¾{XNY€¢ûÈŽŠh²çG&–æ–ærÖ&rÖf—†VBÖÆ–W.ûÈžûÈÀ¢˜	žŠ:Zh.iéÎXú®yJŽŠÎXZ~jŠ>[Èþ‰8¾KˆX¾Yjî{INy¨@¢W&Â‚âââžKˆ®Xë¾ûÈÎiÈ>h¨®Š«þi©~kËŽ[NKˆ‹[~‰8¾hèž8¢X¾XŠ^YËXØy¨NYÉnx˜~iÈ>Šè®h‰k).iÈžŠ«þi©~iXŽiéÎûÈÀ¢‹yþ{‹ÞŠkÞYÉnKˆÞKˆˆ{N8.h˜Kº^˜	žŠ:ŠŠÞZé®ŠÎXZp¢jŠ>[Èþi˜.ûÈÎKˆjŠ>ŠhyJŽ8ÎkËŽ[B¾YÉnx˜~8Þy¨@¢{XNYŽZú¾k9^ûÈÎKˆÞˆ;ÞXú®Zú·W&Â‚ž8 ¢¢ð ¢6öç7B&tÆ–W#Ð¢B‚'G&–æ–æuvT&tÆ–W""“°  ¢–b‚&tÆ–W"—°¢&WGW&ã°¢Ð  ¢6öç7B–ÖvUW&ÃÐ¢¦öæT&6¶w&÷VæD–ÖvW5·¦öæT¶W•Ó°  ¢–b†–ÖvUW&Â—° ¢6öç7BæW‡D&6¶w&÷VæCÐ¢&Æ–æV"Öw&F–VçB‡&v&ƒÃÃÂãB’Ç&v&ƒÃÃÂãB’’Â"°¢'W&Â‚"°¢–ÖvUW&Â°¢"’#° ¢–b†&tÆ–W"ç7G–ÆRæ&6¶w&÷VæD–ÖvRÓÖæW‡D&6¶w&÷VæB—°¢&tÆ–W"ç7G–ÆRæ&6¶w&÷VæD–ÖvSÖæW‡D&6¶w&÷VæC°¢Ð ¢Ð¢VÇ6W° ¢ò ¢c“~ûÉ®k).iÈž[Ž[ÎYÉnx˜~i˜.Xú®YÊŽyÉþy¨NZÙŽYÊŽŠÎXZ~ˆ8Îišþi˜.h˜Þkˆ^™šN8 ¢˜îXë¾jøþjÊh™>™h¾YËXØ‹8~Šˆ®˜;Þ˜xÞZú¶&6¶w&÷VæD–Öv^ûÈÎ˜XÞY€¢6×7Vær'&÷w6W.y¨GG&ç6f÷&Þ{ŠîiKîˆˆvf—†VNˆ8ÎišþiÈ>Š{Žy›Îiˆ.‹+N˜xÞ{š®8 ¢xûîYÊŽ˜þXXÞxJhHþ{êžy¨G7G–ÆR×WFF–öîûÈÎy»Nhê^k+þyJ„55>{‹ÞŠkÞˆ8Îišþ8 ¢¢ð ¢–b†&tÆ–W"ç7G–ÆRæ&6¶w&÷VæD–ÖvR—°¢&tÆ–W"ç7G–ÆRç&VÖ÷fU&÷W'G’‚&&6¶w&÷VæBÖ–ÖvR"“°¢Ð ¢Ð §Ð  ¢ò ¢)ˆRikZ)îûÉ®{{NX©þXØYËXØ‹8~Šˆ®[ØŽz©~(	N(	N›¹îih~ZÙp¢i˜.Š{Žy›ÎûÈÎšþzK®˜	žX¾YËXØy¨Nh
®xšžkˆ^YjîûÈÀ¢KŠnKéÞxZ~yºîX˜ÞzØž{I®k®Zé®8Î˜.XZ^8ÞhÈž˜‰^ˆ;ÞKˆÞˆ;Ð¢hÈž8.‹yþK‹¾Yøî˜*>h›ž[ØŽz©~X[yJŽYÎKˆZYp¢æ†öÖRÖfVGW&RÖÖöFÎjŠ>[Èþ8 ¢¢ð ¦gVæ7F–öâ÷VåG&–æ–æu¦öæT–æfò‡¦öæT¶W’—° ¢6öç7B6öæf–sÐ¢¦öæT6öæf–u·¦öæT¶W•Ó°  ¢6öç7BÖöFÃÐ¢B‚'G&–æ–æu¦öæTÖöFÂ"“° ¢6öç7BF—FÆTVÃÐ¢B‚'G&–æ–æu¦öæTÖöFÅF—FÆR"“° ¢6öç7B&öG”VÃÐ¢B‚'G&–æ–æu¦öæTÖöFÄ&öG’"“°  ¢–b€¢6öæf–rÇÀ¢ÖöFÂÇÀ¢F—FÆTVÂÇÀ¢&öG”VÀ¢—°¢&WGW&ã°¢Ð  ¢Ç•G&–æ–æu¦öæT&6¶w&÷VæB€¢¦öæT¶W¢“°  ¢F—FÆTVÂçFW‡D6öçFVçCÐ¢6öæf–rçF—FÆWÇÂ.YËXØ‹8~Šˆ¢#°  ¢6öç7BÖöç7FW$Æ—7D…DÔÃÐ¢vWE¦öæTÖöç7FW$Æ—7D…DÔÂ€¢¦öæT¶W¢“°  ¢6öç7BVæÆö6¶VCÐ ¢Æ–W"æÆWfVÃãÐ¢6öæf–rç&WV—&VDÆWfVÃ°  ¢&öG”VÂæ–ææW$…DÔÃÐ ¢sÆF—b7G–ÆSÒ&föçB×6—¦S£gƒ¶6öÆ÷#¢6c#C#“¶Ö&v–âÖ&÷GFöÓ£‡ƒ²#âr°¢†6öæf–ræÆWfVÅ&ævWÇÂ""’°¢#ÂöF—câ"° ¢sÆF—b7G–ÆSÒ&föçB×6—¦S£gƒ¶Æ–æRÖ†V–v‡C£ã“¶Ö&v–âÖ&÷GFöÓ£gƒ²#âr°¢€¢Ööç7FW$Æ—7D…DÔÇÇÀ¢sÇ7â7G–ÆSÒ&6öÆ÷#¢6#6S†3²#îûÈŽ[	®xJh
®xšž‹8~iižûÈ“Â÷7ãâp¢’°¢#ÂöF—câ"° ¢sÆF—b7G–ÆSÒ&F—7Æ“¦fÆWƒ¶v£‡ƒ²#âr° ¢€¢VæÆö6¶V@¢ð¢sÆ'WGFöâ6Æ73Ò&†öÖRÖfVGW&RÖ'W’Ö'Fâ'7G–ÆSÒ&fÆWƒ£·FF–æs£‚'ƒ¶föçB×6—¦S£gƒ¶Ö–âÖ†V–v‡C£Cgƒ²"r°¢vöæ6Æ–6³Ò&6Æ÷6UG&–æ–æu¦öæT–æfò‚“¶VçFW%¦öæR…Ârr°¢¦öæT¶W’°¢uÂr“²#âr°¢.˜.XZR"°¢#Âö'WGFöãâ ¢ ¢sÆ'WGFöâ6Æ73Ò&†öÖRÖfVGW&RÖ'W’Ö'Fâ'7G–ÆSÒ&fÆWƒ£·FF–æs£‚'ƒ¶föçB×6—¦S£gƒ¶Ö–âÖ†V–v‡C£Cgƒ²&F—6&ÆVCâr°¢.™ÈŠhÇbâ"°¢6öæf–rç&WV—&VDÆWfVÂ°¢#Âö'WGFöãâ ¢’° ¢sÆ'WGFöâ6Æ73Ò&†öÖRÖfVGW&RÖ'W’Ö'Fâ'7G–ÆSÒ&fÆWƒ£·FF–æs£ƒ²"r°¢vöæ6Æ–6³Ò&6Æ÷6UG&–æ–æu¦öæT–æfò‚“²#âr°¢.‹ùNY¹â"°¢#Âö'WGFöãâ"° ¢#ÂöF—câ#°  ¢ÖöFÂæ6Æ74Æ—7BæFB€¢'6†÷r ¢“° §Ð  ¦gVæ7F–öâ6Æ÷6UG&–æ–æu¦öæT–æfò‚—° ¢6öç7BÖöFÃÐ¢B‚'G&–æ–æu¦öæTÖöFÂ"“°  ¢–b†ÖöFÂ—° ¢ÖöFÂæ6Æ74Æ—7Bç&VÖ÷fR€¢'6†÷r ¢“° ¢Ð §Ð  ¦gVæ7F–öâWFFTÖvT†VFW"‚—° ¢6öç7BÖvTVÆVÖVçCÐ¢B‚&ÖvR"“°  ¢6öç7B—4ÖvSÐ ¢ÖvTVÆVÖVçBb`¢ÖvTVÆVÖVçBæ6Æ74Æ—7Bæ6öçF–ç2€¢&7F—fR ¢“°  ¢ò ¢)ˆRKúîjÚ>ûÈŽKéÞxZ~KÛþyJŽˆ^Šhk.ûÈÎ8ÎKˆÞiŠþ™«‰xþûÈÀ¢iŠþi[NX¾h»þhèžûÈÎKˆÞŠhyYžKˆZ®›¹ˆ›.z›®y›Þ8ÞûÈžûÉ ¢˜	žŠ:XéþiÊÎˆz®[{YÉþk9^xXž˜»ÎZú¾K¨nKˆK»Þ8ÎK‹¾Yøîi˜ ¢™«‰xþj‰žšÎX‰~8Þy¨N˜(þ‹ÊþûÈÎXú®yJ†F—7Æ“¦æöæP¢‰8¾hèžXZ~ZëžûÈÎKØbæ6öçFVçN˜*>Z®XØYùþXéþiÊÎiŠð¢yJ‡÷6—F–öã¦'6öÇWFS·F÷£c'Žzé~Z[Ð¢8Îhš>hèžj‰žšÎX‰~š¹Ž[ªn[èÎ8Þy¨NKØÞ{ÚîûÈÎj‰žšÎX‰p¢khŽZKK¨n8æ6öçFVçNk).iÈž‹yþ‰~Š9ÎKˆ®Xë¾ûÈÀ¢h˜ÞiÈ>z›®X{®KˆZ£c'Žš¹Žy¨N›¹ˆ›.XØYùþ8  ¢[èÎKèny›Îxûç6†÷uvR‚žŠ:X[nZún[{.{i>iÈžKˆZYp¢ZèÎi[N8jÚ>z+®‰™^yn˜	žK»nK¨¾y¨Nj™þX‹`¢ûÈ‚6y¨FæòÖ†VFW.˜	žX¶6Æ7>ûÈÎi
Þ˜XÐ¢55>y¨Bæ6öçFVçG·F÷£ÞûÈžûÈÎh»þhèž˜	žŠ:¢i[Një^ˆz®[{Zú¾y¨N˜(þ‹ÊþûÈÎiKžh‰h¨¢&†öÖR.ûÈð¢'G&–æ–ær.Xª˜'6†÷uvR‚žŠ:y¨@¢†–FT†VFW%vW>kˆ^YjîûÈÎy»Nhê^yJŽxûîh‰8¢jÚ>z+®y¨Nj™þX‹n‰™^ynûÈÎKˆÞiÈ>XhÞyYžKˆ¾z›®y›ÞXØZ®8 ¢¢ð  ¢6öç7BæÖTVÃÐ¢B‚'Æ–W$æÖR"“° ¢6öç7B–æfôVÃÐ¢B‚'Æ–W$†VFW$–æfò"“° ¢6öç7B¦öæTVÃÐ¢B‚&Ö†VFW%¦öæTæÖR"“° ¢6öç7BÖöç7FW$–æfôVÃÐ¢B‚&Ö†VFW$Ööç7FW$–æfò"“°  ¢–b†æÖTVÂ—° ¢æÖTVÂç7G–ÆRæF—7Æ“Ð ¢—4ÖvP¢ð¢&æöæR ¢ ¢"#° ¢Ð  ¢–b†–æfôVÂ—° ¢–æfôVÂç7G–ÆRæF—7Æ“Ð ¢—4ÖvP¢ð¢&æöæR ¢ ¢"#° ¢Ð  ¢–b‡¦öæTVÂ—° ¢¦öæTVÂç7G–ÆRæF—7Æ“Ð ¢—4ÖvP¢ð¢" ¢ ¢&æöæR#° ¢Ð  ¢–b†Ööç7FW$–æfôVÂ—° ¢ò ¢)ˆRKúîjÚ>ûÈŽKéÞxZ~KÛþyJŽˆ^Šhk.ûÈÎ8Î‰xÞˆ›.j`¢X[nK¹n˜;ÞKˆÞŠh8ÞûÈžûÉ®˜	žX¾ZëžYš‚ŽzØž{I®zøNYÈÐ¢˜*>ŠÂžKˆÞzêYÊŽKˆÞYÊŽYËYÉnš™Ú.ûÈÎKˆ[è°¢™«‰xþûÈÎXú®yYžYËYÉnYÞz‹˜*>KˆŠÎ8 ¢¢ð ¢Ööç7FW$–æfôVÂç7G–ÆRæF—7Æ“Ð¢&æöæR#° ¢Ð  ¢–b‚—4ÖvR—°¢&WGW&ã°¢Ð  ¢6öç7B6öæf–sÐ ¢¦öæT6öæf–u¶7W'&VçE¦öæUÐ¢ÇÀ¢¦öæT6öæf–ræf÷&W7C°  ¢–b‡¦öæTVÂ—° ¢ò ¢)ˆRKúîjÚ>ûÈŽKéÞxZ~KÛþyJŽˆ^Šhk.ûÈÎ8ÎKˆ®™Ú ¢‰xÞˆ›.jnXú®yYžYËYÉnYÞZÙ~Y¹¾X¾ZÙ~ûÈÎX[nK¹`¢˜;ÞKˆÞŠh8ÞûÈžûÉ ¢6öæf–rçF—FÆ^iÊÎ‹ª¾[‹n‰vVÖö¦žX˜Þ{k@¢ûÈŽKè¾Zh".)»ûˆò[zŽxÛŽˆÙ.Xéò.ûÈžûÈÎ˜	žŠ:yJ€¢jÚ>ŠhþŠŽ˜N[ÈþXë¾hèž™h¾š
Þy¨FVÖö¦ž‹yð¢z›®y›ÞûÈÎXú®yYžKˆ¾{INKŠÞih~YËYÉnYÞz‹8 ¢K™þKˆÞXhÞˆz®[{Xª/	ù{®ûˆò.˜	žX¾X˜Þ{kN8 ¢¢ð ¢¦öæTVÂçFW‡D6öçFVçCÐ ¢†6öæf–rçF—FÆWÇÂ""¢ç&WÆ6R€¢õåÅ2µÇ2¢òÀ¢" ¢“° ¢Ð  ¢ò ¢)ˆRKúîjÚ>ûÈŽKéÞxZ~KÛþyJŽˆ^Šhk.ûÈÎ8Î‰xÞˆ›.j`¢X[nK¹n˜;ÞKˆÞŠh8Þ8Îj™Žˆ›.˜:ŽXˆnXúþKº^h»þhèž8ÞûÈžûÉ ¢zØž{I®zøNYÈÞih~ZÙ~8h
®xšžkˆ^YjîjnûÈÎXZžX¾˜;Ð¢i[NX¾KˆÞXhÞšþzK®(	N(	FÖ†VFW$Ööç7FW$–æfð¢˜	žX¾ZIn[NZëžYšŽiÊÎKèn[YÊŽKˆ®™Ú.y¨F—4ÖvP¢XŠNik~[ÈþŠ:Š*¾ŠŠÞh‰KˆZé®™«‰xð¢ûÈ†F—7Æ“¦æöæ^ûÈžûÈÎ˜	žŠ:KˆÞyJŽXhÞ‰™^ynûÉ°¢h
®xšžkˆ^YjîjnûÈ†ÖÖöç7FW$Æ—7D&÷ŽûÈ¢y¨NXZ~ZëžK™þKˆÞyJŽXhÞyJ.yIþûÈÎy»Nhê^KˆÞZú¾XZ^8 ¢¢ð §Ð  ¢ò¢ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÐ¢)ˆRi»NikT£ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÒ¢ð ¦gVæ7F–öâWFFUT’‚—° ¢WFFT†öÖUFW7EFööÇ2‚“° ¢ò ¢)ˆRjøþjÊi»NikyZ¾™Ú.i˜.ûÈÎšnKëþjª.iú^KˆjÊ¢ˆÙ.kÊYË[‹ny¨NŠz>˜énx¸hX¾ŠhKˆÞŠhi»Nik ¢ûÈŽxêžZënXØ~{I®‹zŽ˜äÇbã˜*>KˆX‹¾ûÈÀ¢{{NX©þXØX‰~ŠŽŠhz¸¾X‹¾XøÞiŠX{®KènûÈÀ¢KˆÞyJŽx›žYË‹{>šh˜Þi»NikûÈž8 ¢¢ð ¢WFFUG&–æ–æu¦öæTÆö6·2‚“° ¢WFFU6V6öæD6†&7FW$&ææW"‚“°  ¢ò ¢)ˆRikZ)îûÈŽKéÞxZ~KÛþyJŽˆ^Šhk.ûÈÎK‹¾Yøî˜y[š0¢šþzK®ûÈžûÉ®˜y[š>iŠþX[yJŽ‹8~k©ûÈÎK»¾KÙ^i˜.X	¢˜;ÞXúþˆ;ÞŠè®X¹^ûÈŽ‹:>Š9ÞX)ž8š	ŽK»¾X¹’þh‰[¢xØîX»^8YXn[©~khŽ‹+¾ûÈžûÈÇWFFUT’‚žiÊÎKè`¢[iÈ>YÊŽ[èŽZI®i˜.j™þ›¹îŠ*¾YÎXú¾ûÈÎKˆ‹[~i»Nik ¢iÈYjî{INûÈÎKˆÞyJŽXúnZInh›îYËikž˜xÞŠH~XŠNik~8 ¢¢ð ¢WFFTvöÆDF—7Æ’‚“°  ¢ò ¢)ˆRikZ)îûÉ®YËYÉnKˆ®xêžZënXÚx˜~y¨NYÞZÙrþzØž{I ¢ûÈŽXÈ^Y
¾‹yþ™ªŽikžZ®ûÈžŠh‹yþ‰~YÎjÚ^i»NikûÈÀ¢KˆÞxKnXØ~{I®K˜¾[èÎYËYÉnKˆ®šþzK®y¨N˜(NiŠþˆˆ®zØž{I®8 ¢¢ð ¢WFFTÖÆ–W$6&B‚“°  ¢ò ¢)ˆRikZ)îûÉ®[z˜(þš™Ú.j‰žšÎX‰~y¨Nh
®xšž‹8~Šˆ ¢ûÈŽYÞz‹þ[Îh
rþŠ˜xòþiXþhÛ~ûÈžiÈ>™ªŽ‰~h‹šÊP¢˜.ŠÎŠè®XÉnûÈŽh™>jÛ¾Kˆ™«¾hù¾Kˆ¾Kˆ™«¾8¢Š˜xþk‰¾[	ûÈžûÈÇWFFUT’‚žiÊÎKèn[iÈ>YÊ€¢[èŽZI®i˜.j™þŠ*¾YÎXú¾ûÈÎKˆ‹[~i»NikûÈÀ¢KˆÞyJŽXúnZInh›îYËikž˜xÞŠH~XŠNik~8 ¢¢ð ¢WFFTÖvT†VFW"‚“°  ¢ò ¢)ˆRikZ)îûÉ®h‹šÊ^KŠÕ5Šè®XÉnûÈŽyJŽK¨nh¨ˆ;Þ8YiÞK¨n‰z^kNûÈ¢ŠhXÛ>i˜.XøÞiŠYÊŽh¨ˆ;Þ[ú¾hÛ~X‰~y¨NXúþyJŽx¸hX¾Kˆ®ûÈÀ¢KˆÞxKe5hš>X‹KˆÞZJK¨nûÈÎhÈž˜‰^XÛ¾˜(NKªî‰~ˆ;Þ›¹î8 ¢¢ð ¢–b†&GFÆT7F—fR—° ¢÷VÆFU6¶–ÆÅV–6´&"‚“° ¢Ð  ¢6öç7B7FG2Ð¢vWDÖ–ä6†&7FW%7FG2‚“°  ¢ò ¢Zh.iéÎŠ9ÞX)žh‰nˆ;ÞX©¾iKžŠè®ûÈÀ¢…õ5Kˆ®™™Šè®XÉni˜.KˆÞŠh‹h^X{®Kˆ®™™8 ¢¢ð ¢Æ–W"æ‡Ð¢ÖF‚æÖ‚€¢À¢ÖF‚æÖ–â€¢Æ–W"æ‡À¢7FG2æÖ„… ¢¢“°  ¢Æ–W"ç7Ð¢ÖF‚æÖ‚€¢À¢ÖF‚æÖ–â€¢Æ–W"ç7À¢7FG2æÖ…5 ¢¢“°  ¢B‚'Æ–W$ÆWfVÂ"¢çFW‡D6öçFVçBÐ¢Æ–W"æÆWfVÃ°  ¢B‚&†VFW$…"¢çFW‡D6öçFVçBÐ¢Æ–W"æ‡°  ¢B‚&†VFW%5"¢çFW‡D6öçFVçBÐ¢Æ–W"ç7°  ¢ò ¢)ˆRKéÞxZ~xêžZënŠhk.ûÈÎK‹¾Yøîšinšy¨NZèÎi[N[Îh
~X‰~Š€¢ûÈŽiÈZJt…õ58XZÞYÈÞ8™‹.zjn8XØ~{I®˜.[ªnûÈ¢i[NX¾h»þhèžK¨nûÈÎ˜	žK©¾‹8~Šˆ®YÊŽ8Îx¸hX¾8ÞšiÊÎKèn[iÈžûÈÀ¢šinš˜xÞŠH~šþzK®iŠþZI®šIŽy¨N™¹ÎŠˆ®8 ¢˜	žŠ:XéþiÊÎZú¾{Zb6†öÖT…zØžXX>{Jy¨N˜*>K©¾ŠÎK™þKˆKÛ^z{¾™šNûÈÀ¢KˆÞxKnXX>{JKˆÞZÙŽYÊŽK¨nûÈÎ{›Î{¨ÎZú¾XZ^iÈ>y»Nhê^Y›N˜ÊþûÈÀ¢[îˆ{GWFFUT’‚ž[èÎ™Ú.y¨NiÛŠ[þXZŽ˜:ŽKˆÞiÈ>Yû~ŠÎ8 ¢¢ð  ¢–b€¢B‚&—FVÔÖVçR"’b`¢B‚&—FVÔÖVçR"’æ6Æ74Æ—7Bæ6öçF–ç2‚'6†÷r"¢—°¢&VæFW$&GFÆU÷F–öäÖVçR‚“°¢Ð  ¢B‚'6¶–ÆÅö–çG2"¢çFW‡D6öçFVçBÐ ¢€¢vWE6¶–ÆÄ6†&7FW$ö&¦V7B€¢7W'&VçE6¶–ÆÄ6†&7FW ¢—ÇÀ¢Æ–W ¢’ç6¶–ÆÅö–çG3°  ¢ò ¢{i>š™~kšþzK ¢¢ð ¢B‚'6†&VDW‡fÇVR"¢çFW‡D6öçFVçBÐ¢ÖF‚æÖ‚ƒÄÖF‚æfÆö÷"„çVÖ&W"‡6†&VDW‡—ÇÃ’¢çFôÆö6ÆU7G&–ær‚'¦‚ÕEr"“°  ¢&VæFW$W‡F—7G&–'WFTÆ—7B‚“°  ¢ò ¢x¸hX¾š¢¢ð ¢WFFU7FGW5&Wf–Wr‚“°  ¢ò ¢h‹šÊ^KŠÞy¨NŠj)Ð¢¢ð ¢–b†&GFÆT7F—fR—° ¢7W'&VçD&GFÆTÖöç7FW'0¢æf÷$V6‚€¢–æFWƒÓç°¢WFFTÖöç7FW%T’€¢–æFW€¢“°¢Ð¢“°  ¢WFFT&GFÆUÆ–W$&'2‚“° ¢6öç7B&÷75&W6VçFF–öä÷væW#×G—Vöbv–æF÷rÓÒ'VæFVf–æVB#÷v–æF÷räf÷W%7–Ö&öÇ4&÷74&GFÆS¦çVÆÃ°¢–b†&÷75&W6VçFF–öä÷væW"bgG—Vöb&÷75&W6VçFF–öä÷væW"ç7–æ4‡VCÓÓÒ&gVæ7F–öâ"—°¢&÷75&W6VçFF–öä÷væW"ç7–æ4‡VB‚“°¢Ð ¢Ð §Ð  ¢ò¢ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÐ¢)ˆRˆz®X¹^ZÙŽj©@ ¢™šNK¨nXéþiÊÎYÊŽx›žZé®X¹^KÙÎ›¹îûÈŽXØ~{I®8Š9ÞX)ž8h‹šÊ^X¹ÞXŠž(
nûÈ¢iÈ>ZÙŽj©NK˜¾ZInûÈÎ˜	žŠ:XhÞXªXZž[NKùÞ™ª®ûÉ  ¢âjøò#zy.Zé®i˜.ˆz®X¹^ZÙŽKˆjÊûÈÀ¢KŠnYÊŽyZ¾™Ú.Xû>Kˆ¾Šy.yúÞiª¾šþzK®8Ï	ù+â[{.ˆz®X¹^ZÙŽj©N8ÞûÈÀ¢Šé>xêžZënyú^˜>yÉþy¨NiÈžYÊŽZÙŽûÈÎKˆÞiŠþhiz›®iKî[ø>8  ¢"âXˆ~X‹ˆ8ÎišþûÈŽXˆt8Xˆ~Xˆnš8‰ê.[™^˜énZé®ûÈ¢y¨Ny[nKˆ¾z¸¾X‹¾ZÙŽKˆjÊûÈÀ¢˜	žiŠþiÈZëži‰>kÈþhèž˜.[ªny¨Nh8^k8(	N(	@¢xêžZën[èŽXúþˆ;Þz¨xKnŠ*¾™»¾Š›h™>ik~8¢h‰ny»Nhê^Xˆ~X{®Xë¾Y¹äÄ”ä^ûÈÀ¢˜	ži˜.X	žKˆÞˆ;ÞXú®™Ú#zy.y¨NZé®i˜.YšŽ8  ¢XZžzŠîh8^k8˜;ÞYÎXú¾YÎKˆX²WFõ6fTæ÷r‚žûÈÀ¢XZ~˜:ŽiÊÎ‹ª¾iÈ—G'’ö6F6ŽûÈÀ¢ZÙŽj©NZKiY~KˆÞiÈ>Šé>˜®h‹.y[nhèžûÈÀ¢Xú®iÈ>YÊ†6öç6öÆ^yYžKˆ¾˜ÊþŠªNŠˆ®hþikžKëþK˜¾[èÎ™šN˜Êþ8 £ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÒ¢ð ¦ÆWBWF÷6fT–æF–6F÷%F–ÖW#ÖçVÆÃ° ¦ÆWBWF÷6fT–çFW'fÄ–CÖçVÆÃ°  ¦gVæ7F–öâ—4vÖU7F'FVB‚—° ¢&WGW&â€¢Æ–W"b`¢Æ–W"æ–@¢“° §Ð  ¦gVæ7F–öâ6†÷tWF÷6fT–æF–6F÷"‚—° ¢6öç7BVÂÐ¢B‚&WF÷6fT–æF–6F÷""“°  ¢–b‚VÂ—°¢&WGW&ã°¢Ð  ¢VÂæ6Æ74Æ—7BæFB€¢'6†÷r ¢“°  ¢6ÆV%F–ÖV÷WB€¢WF÷6fT–æF–6F÷%F–ÖW ¢“°  ¢WF÷6fT–æF–6F÷%F–ÖW"Ð¢6WEF–ÖV÷WB‚‚“Óç° ¢VÂæ6Æ74Æ—7Bç&VÖ÷fR€¢'6†÷r ¢“° ¢ÒÃc“° §Ð  ¦gVæ7F–öâWFõ6fTæ÷r‡6†÷t–æF–6F÷"—° ¢–b‚—4vÖU7F'FVB‚’—°¢&WGW&ã°¢Ð  ¢G'—° ¢6fTvÖR‚“°  ¢–b‡6†÷t–æF–6F÷"—° ¢6†÷tWF÷6fT–æF–6F÷"‚“° ¢Ð ¢Ð¢6F6‚†W'&÷"—° ¢6öç6öÆRæW'&÷"€¢.ˆz®X¹^ZÙŽj©NZKiY~ûÉ¢"À¢W'&÷ ¢“° ¢Ð §Ð  ¦gVæ7F–öâ7F'DWFõ6fR‚—° ¢–b†WF÷6fT–çFW'fÄ–B—° ¢6ÆV$–çFW'fÂ€¢WF÷6fT–çFW'fÄ–@¢“° ¢Ð  ¢ò ¢jøó#zy.Zé®i˜.ZÙŽj©NûÈÀ¢Xú®iÈžyÉþjÚ>™h¾Zx¾˜®h‹.ûÈŽ[{.X›^Šy.ûÈžh˜ÞiÈ>Zún™©¾Zú¾XZ^ûÈÀ¢˜(NYÊŽX›^Šy.yZ¾™Ú.i˜.˜	žŠ:iÈ>y»Nhê^‹{>˜î8 ¢¢ð ¢WF÷6fT–çFW'fÄ–BÐ¢6WD–çFW'fÂ‚‚“Óç° ¢WFõ6fTæ÷r‡G'VR“° ¢ÒÃ#“°  ¢ò ¢Xˆ~X‹ˆ8ÎišþûÈþXˆ~Xˆnši˜.z¸¾X‹¾ZÙŽKˆjÊ8 ¢KˆÞšþzK®hùzK®ûÈÎYºx+®yZ¾™Ú.˜	ži˜.X	¢xêžZën˜	®[‹Ž[{.{i>yÈ¾KˆÞX‹K¨n8 ¢¢ð ¢Fö7VÖVçBæFDWfVçDÆ—7FVæW"€¢'f—6–&–Æ—G–6†ævR"À¢‚“Óç° ¢–b†Fö7VÖVçBæ†–FFVâ—° ¢WFõ6fTæ÷r†fÇ6R“°  ¢ò ¢)ˆRikZ)îûÈŽKéÞxZ~KÛþyJŽˆ^Y¹îZûÈÀ¢8ÎXˆ~X‹ˆ8ÎišþXhÞXˆ~Y¹îKènX‹[©^iÈžk).iÈ¢zé~™º.{y®{i>š™~8ÞûÈžûÉ®Xˆ~X‹ˆ8Îišþy¨@¢y[nKˆ¾ûÈÎŠ‰Ž˜ÈN˜	žX¾i˜.™i>›¹îûÈÎzØ¢Xˆ~Y¹îX˜Þišþi˜.h˜Þyú^˜>Šh[éî˜	žŠ:¢™h¾Zx¾zé~8Î™º.™h¾K¨nZI®K˜^8Þ8 ¢¢ð ¢Æ7DöffÆ–æT6†V6µF–ÖW7F×Ð¢FFRææ÷r‚“° ¢Ð¢VÇ6W° ¢ò ¢)ˆRikZ)îûÉ®Xˆ~Y¹îX˜Þišþi˜.ûÈÎyJŽX™¾X™°¢Xˆ~X‹ˆ8ÎišþŠ‰Ž˜ÈNy¨Ni˜.™i>›¹îûÈÎzé~X{ ¢˜	žjë^™º.{y®i˜.™i>[Þhxžy¨N™º.{y®{i>š™~(	N(	@¢˜	žjŠ>KˆÞyJŽi[NX¾˜xÞiki[Nynš™Ú.8¢Yjî{INXˆ~ˆ8ÎišþXhÞXˆ~Y¹îKèn[iÈ>yÉþy¨@¢zé~X‹ûÈÎY¹îzÙNK¨nKÛþyJŽˆ^y¨NyiYXþ8 ¢¢ð ¢6Æ7VÆFTöffÆ–æTW‡6–æ6R€¢Æ7DöffÆ–æT6†V6µF–ÖW7F× ¢“° ¢Æ7DöffÆ–æT6†V6µF–ÖW7F×Ð¢FFRææ÷r‚“°  ¢ò ¢)ˆRikZ)îûÈŽKéÞxZ~KÛþyJŽˆ^Šhk.ûÈÎY‰~Ššn‰™^y`¢8Î{Šî[þŠinz©rþXˆ~X‹ˆ8ÎišþXhÞh™>™h¾iÈ>XÚKØþ8Ð¢y¨NYXþšÎûÈžûÉ ¢K˜¾X˜Þ˜	žŠ:Xú®‰™^ynK¨n8ÎXˆ~X{®Xë¾8Þy¨@¢˜*>KˆXØ®ûÈŽZÙŽj©NûÈžûÈÎZèÎXZŽk).iÈž‰™^y`¢8ÎXˆ~Y¹îKèn8ÞŠ›.hî›«Îh.[êž(	N(	Nh˜¾j™þxþŠkÞYš€¢YÊŽˆ8Îišþi˜.iÈ>ZJ~[˜^™˜ÞKØîyI®ˆ{>iª¾XÎŠˆŽi˜.Yš€¢y¨NYû~ŠÎ˜	þ[ªnûÈÎY¹îX‹X˜Þišþy¨Ni˜.X	žûÈÀ¢˜®h‹.XZ~˜:Žy¨NY¹îYŽŠˆŽi˜.YšŽ8¢6WEF–ÖV÷WNhé.zˆ¾[èŽXúþˆ;Þ[{.{i>‹yð¢Zún™©¾{i>˜îy¨Ni˜.™i>[ÞKˆÞKˆ®ûÈÎŠè®h‰XÚKØð¢KˆÞX¹^y¨NjŠ>ZÙ8  ¢˜	žŠ:k).‹ênk9^KùÞŠØ“^KúîZ[ÞjøþKˆzŠà¢XÚKØþy¨Nh8^k8ûÈŽˆ8Îišþ™™X‹niŠþxþŠkÞYš€¢[N{I®y¨NûÈÎiÊÎKèn[iÈžK©¾x¸k8k).‹ênk9P¢ZèÎXZŽ˜þXXÞûÈžûÈÎKØnˆ{>[	X®K¨nKˆX°¢YŽyny¨NŠ9ÎiYûÉ®Y¹îX‹X˜Þišþi˜.ûÈÎZh.iéÀ¢h‹šÊ^˜(NYÊŽ˜.ŠÎ8‹Ê®X‹™ÈŠhxêžZënˆz®[{¢˜Ži8~y¨NŠy.ˆ›.ûÈÎ˜xÞiki[NynKˆjÊX	.i[ŽŠˆŽi˜ ¢ûÈŽ{ZnKˆX¾XZŽiky¨C#zy.ûÈÎˆÎKˆÞiŠþ[»n{¨À¢KˆX¾Xúþˆ;Þ[{.{i>YÊŽˆ8Îišþ‹yZèÎy¨Nˆˆ®X	.i[ŽûÈžûÈÀ¢KŠnK‰N˜xÞiki[NynKˆjÊyZ¾™Ú.šþzK®ûÈÀ¢™˜ÞKØîXÚKØþy¨Nj™þxè~8 ¢¢ð ¢–b€¢&GFÆT7F—fRb`¢&GFÆU†6SÓÓÐ¢&FV6Æ&R ¢—° ¢6öç7BWFôöãÐ¢7F—fT&GFÆT6†&7FW$–æFWƒÓÓÓ ¢òWFô&GFÆP¢¢vWE'G”WFô6öæf–r†7F—fT&GFÆT6†&7FW$–æFW‚’æVæ&ÆVC°  ¢–b‚WFôöâ—° ¢F–ÖW#Ó#° ¢WFFUF–ÖW"‚“° ¢Ð ¢Ð  ¢–b†&GFÆT7F—fR—° ¢WFFUT’‚“° ¢Ð ¢Ð ¢Ð¢“°  ¢ò ¢™yÎ™hžXˆnšûÈþ˜xÞiki[NynX˜Þyº˜xþZÙŽKˆjÊ8 ¢h˜¾j™þxþŠkÞYšŽKˆÞKˆZé®iÈ>z+®ZúnŠ{Žy›Î˜	žX¾K¨¾K»nûÈÀ¢KØnXªK¨nZèÎXZŽxJZë>ûÈÎZI®Kˆ[NKùÞ™ª®8 ¢¢ð ¢v–æF÷ræFDWfVçDÆ—7FVæW"€¢&&Vf÷&WVæÆöB"À¢‚“Óç° ¢WFõ6fTæ÷r†fÇ6R“° ¢Ð¢“° §Ð  ¢ò¢ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÐ¢X‰ÞZx¾XÉ`£ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÒ¢ð §G'—° ¢&V'V–ÆD–çfVçF÷'•6Æ÷G2‚“° ¢WFFT7&VF–öåT’‚“° ¢&VæFW%6¶–ÆÄÆöF÷WB‚“° ¢&VæFW$–çfVçF÷'’‚“° ¢WFFUÆ–W$†VFW"‚“° ¢WFFUT’‚“° §Ð¦6F6‚†W'&÷"—° ¢6öç6öÆRæW'&÷"€¢.˜®h‹.X‰ÞZx¾XÉny›ÎyIþ˜ÊþŠªNûÉ¢"À¢W'&÷ ¢“° §Ð  ¢ò¢Öö&–ÆR†&Gv&Rö'&÷w6W"&6²wV&BâF†Rf—'7B&6²&W726·2f÷ ¢6öæf—&ÖF–öã²6öæf—&Ö–ærW&f÷&×2F†R&VÂæf–vF–öâÂ6æ6VÆÆ–ær¶VW0¢F†RÆ–W"–âF†RvÖRâ¢ð¢†gVæ7F–öâ–ç7FÆÄÖö&–ÆT&6´6öæf—&ÖF–öâ‚—° ¢ÆWBÆÆ÷v–ætW†—CÖfÇ6S°¢ÆWBW†—E&ö×D÷VãÖfÇ6S° ¢v–æF÷ræÆÆ÷tvÖTæf–vF–öãÒ‚“Óç°¢ÆÆ÷v–ætW†—C×G'VS°¢Ó° ¢G'—°¢†—7F÷'’çW6…7FFR‡·'tW†—DwV&C§G'VWÒÂ""ÆÆö6F–öâæ‡&Vb“°¢Ð¢6F6‚†W'&÷"—°¢6öç6öÆRçv&â‚.xJk9^[»®z¸¾‹ùNY¹î™‹.Yn{H˜ÈNûÉ¢"ÆW'&÷"“°¢Ð ¢v–æF÷ræFDWfVçDÆ—7FVæW"‚'÷7FFR"Æ7–æ2‚“Óç°¢–b†ÆÆ÷v–ætW†—B—²&WGW&ã²Ð ¢ò¢æF—fR6öæf—&ÒW6VBFò&Æö6²'&÷w6W"†—7F÷'’v†–ÆR—Bv2÷Vâà¢F†R%rF–Æör—27–æ6‡&öæ÷W2Â6ò–ÖÖVF–FVÇ’&W7F÷&RwV&@¢VçG'’&Vf÷&Rv—F–ærF†RÆ–W"w26†ö–6Râ¢ð¢ÆWBwV&E&W7F÷&VCÖfÇ6S°¢G'—°¢†—7F÷'’çW6…7FFR‡·'tW†—DwV&C§G'VWÒÂ""ÆÆö6F–öâæ‡&Vb“°¢wV&E&W7F÷&VC×G'VS°¢Ö6F6‚…ò—²Ð ¢–b€¢v–æF÷räf÷W%7–Ö&öÇ5&VÆV6UWFFRb`¢G—Vöbv–æF÷räf÷W%7–Ö&öÇ5&VÆV6UWFFRæ—4f÷&6VEWFFT&Æö6¶–æsÓÓÒ&gVæ7F–öâ"b`¢v–æF÷räf÷W%7–Ö&öÇ5&VÆV6UWFFRæ—4f÷&6VEWFFT&Æö6¶–ær‚¢—°¢v–æF÷räf÷W%7–Ö&öÇ5&VÆV6UWFFRæææ÷Væ6Tf÷&6VDÆö6²‚“°¢&WGW&ã°¢Ð ¢–b†W†—E&ö×D÷Vâ—²&WGW&ã²Ð¢W†—E&ö×D÷Vã×G'VS° ¢6öç7B6öæf—&ÖVCÐ¢G—Vöbv–æF÷rç't6öæf—&ÓÓÓÒ&gVæ7F–öâ"b`¢v—Bv–æF÷rç't6öæf—&Ò€¢.z+®Zé®Šh™º.™h¾˜®h‹.YxîûÉþyºîX˜Þ˜.[ªniÈ>XXŽˆz®X¹^ZÙŽj©N8""À¢°¢F—FÆS¢.™º.™h¾Xi.™ª¢"À¢6öæf—&ÕFW‡C¢.XK.ZÙŽKŠn™º.™h²"À¢6æ6VÅFW‡C¢.{›Î{¨ÎXi.™ª¢ ¢Ð¢“° ¢W†—E&ö×D÷VãÖfÇ6S° ¢–b†6öæf—&ÖVB—°¢ÆÆ÷v–ætW†—C×G'VS°¢6fTvÖR‚“°¢†—7F÷'’ævò†wV&E&W7F÷&VCòÓ#¢Ó“°¢Ð¢Ò“° §Ò’‚“°  ¢ò ¢)ˆRikZ)îûÉ®XZŽ‰ê.[™^X©þˆ;Þ8  ¢˜xÞŠhy¨Nh¨Š>™™X‹nXXŽŠª®kˆ^jY®ûÉ ¢xþŠkÞYšŽYû®ikÎZèžXZŽˆ>˜xþûÈÎ8Î{Y^[ÞKˆÞXXŠ‹8Þ{k.šYÊ€¢ZèÎXZŽk).iÈžKÛþyJŽˆ^K©.X¹^y¨Nh8^k8Kˆ¾ˆz®X¹^˜.XZ^XZŽ‰ê.[™^ûÈÀ¢KˆZé®ŠhxêžZënˆz®[{›¹îKˆKˆ¾yZ¾™Ú.h˜Þˆ;ÞŠ{Žy›Î(	N(	@¢˜	žiŠô6‡&öÖ^86f&ž8h˜iÈžxþŠkÞYšŽX[˜	®y¨N™™X‹nûÈÀ¢KˆÞiŠþ˜	žX¾˜®h‹.X®[é~X‹h‰nX®KˆÞX‹y¨NYXþšÎûÈÀ¢K»¾KÙ^{k.š˜®h‹.˜;Þ{™îKˆÞ˜î˜	žKˆ™yÎ8  ¢˜	žŠ:X®y¨NiŠþ8Î˜ˆÎk.X[njÊ8ÞKØniÈšnh˜¾y¨NX®k9^ûÉ ¢yº>ˆÞxêžZënYÊŽyZ¾™Ú.Kˆ®8ÎzÊÎKˆjÊ8Þy¨N›¹îi8®h‰nŠ{Žhê~ûÈÀ¢˜*>KˆKˆ¾šnKëþKˆ‹[~Š{Žy›ÎXZŽ‰ê.[™^Š¸¾k.ûÈÀ¢xêžZën[›îK˜îhIþŠk®KˆÞX‹ZI®KˆX¾jÚ^š™ð¢ûÈŽKˆÞzêK¹n›¹îy¨NiŠþX›^Šy.yZ¾™Ú.y¨NhÈž˜‰^ûÈÀ¢˜(NiŠþ[{.iÈžZÙŽj©Ni˜.K‹¾YøîyZ¾™Ú.y¨NK»¾KÙ^YËikžûÈÀ¢˜;ÞiÈ>Š{Žy›ÎûÈÎK˜¾[èÎ[KˆÞiÈ>XhÞh™>i;îûÈž8  ¢Zh.iéÎxêžZëny¨NxþŠkÞYšŽKˆÞiJþhûNXZŽ‰ê.[™Tž8¢h‰nxþŠkÞYšŽYû®ikÎiùK©¾XéþYºh¹.{Y^Š¸¾k.ûÈÀ¢˜	žŠ:yJ‡G'’ö6F6Ži[NX¾XÈ^‹[~KènûÈÀ¢ZKiY~K¨n[›¹Ž›¹ŽiKîj8NûÈÎKˆÞiÈ>[Û™ûþ˜®h‹.iÊÎ‹ª¾jÚ>[‹Ž˜¾KÙÎ8 ¢¢ð ¦gVæ7F–öâ&WVW7DvÖTgVÆÇ67&VVâ‚—° ¢6öç7BVÃÐ¢Fö7VÖVçBæFö7VÖVçDVÆVÖVçC°  ¢6öç7B&WVW7CÐ ¢VÂç&WVW7DgVÆÇ67&VVçÇÀ¢VÂçvV&¶—E&WVW7DgVÆÇ67&VVçÇÀ¢VÂæÖ÷¥&WVW7DgVÆÅ67&VVçÇÀ¢VÂæ×5&WVW7DgVÆÇ67&VVã°  ¢–b‚&WVW7B—°¢&WGW&ã°¢Ð  ¢G'—° ¢6öç7B&W7VÇCÐ¢&WVW7Bæ6ÆÂ†VÂ“°  ¢–b€¢&W7VÇBb`¢&W7VÇBæ6F6€¢—° ¢&W7VÇBæ6F6‚‚‚“Óç·Ò“° ¢Ð ¢Ð¢6F6‚†W'&÷"—·Ð §Ð  ¦gVæ7F–öâVæ&ÆTgVÆÇ67&VVäöäf—'7EF‚—° ¢6öç7B†æFÆW#Ò‚“Óç° ¢&WVW7DvÖTgVÆÇ67&VVâ‚“° ¢Ó°  ¢Fö7VÖVçBæFDWfVçDÆ—7FVæW"€¢&6Æ–6²"À¢†æFÆW"À¢¶öæ6S§G'VWÐ¢“°  ¢Fö7VÖVçBæFDWfVçDÆ—7FVæW"€¢'F÷V6‡7F'B"À¢†æFÆW"À¢¶öæ6S§G'VWÐ¢“° §Ð  ¢ò ¢)ˆRKúîjÚ>ûÈŽKéÞxZ~KÛþyJŽˆ^Šhk.ûÈžûÉ ¢KˆÞŠhXhÞ[Ë~X‹nXZŽ‰ê.[™^ûÈÎ˜	žŠ:KˆÞYÎXú°¢Væ&ÆTgVÆÇ67&VVäöäf—'7EF‚žûÈÀ¢X{Þ[ÈþiÊÎ‹ª¾KùÞyYž‰~ûÈÎK˜¾[èÎZh.iéÎh;>Šh˜xÞikh™>™h°¢˜	žX¾X©þˆ;ÞûÈÎy»Nhê^h¨®Kˆ¾™Ú.˜	žŠÎXùnkhŽŠ‹¾Šz>XÛ>Xúþ8 ¢¢ð ¢ò¢c#¢Fòæ÷BWFòÖVçFW"'&÷w6W"gVÆÇ67&VVâöâf—'7BFâ¢ð¢ò ¢)ˆRiÈ[èÎh˜ÞŠèXùnZÙŽj©N8 ¢˜	žjŠ>zÊÎKˆjÊYYþX¹^KˆZé®iÈ>˜.X›^Šy.ûÈÀ¢iÈžZÙŽj©NX˜~KˆZé®˜.˜®h‹.8 ¢ÆöDvÖ^XZ~˜:ŽiÊÎ‹ª¾K™þiÈ—G'’ö6F6ŽûÈÀ¢˜	žŠ:XhÞXÈ^Kˆ[NiŠþ™¹ž˜xÞKùÞ™ª®ûÈÀ¢z+®KùÞxJŠ¹nZh.KÙ^˜;ÞKˆÞiÈ>XÚjÛ¾i[NX¾{k.š8 ¢¢ð ¢ò ¢)ˆRikZ)îûÈŽKéÞxZ~KÛþyJŽˆ^Šhk.ûÈžûÉ ¢h¨£NX¾ˆz®X¹^h‹šÊ^ŠŠÞZé®™Ú.iÛþŠ:y¨NXéþyIóÇ6VÆV7Cà¢hù¾h‰ˆz®Šˆ.X~˜ŽYjî8.˜	“NX¾XX>{JYÊ„…DÔÎŠ:¢iÊÎKèn[ZÙŽYÊŽûÈŽKˆÞiŠþK˜¾[èÎh˜ÞX¹^hX¾yJ.yIþy¨NûÈžûÈÀ¢˜	žŠ:XúþKº^iKî[ø>YÊŽ˜®h‹.YYþX¹^i˜.[X‰ÞZx¾XÉnKˆjÊûÈÀ¢KˆÞyJŽzØžX‹ŠŠÞZé®™Ú.iÛþyÉþy¨NŠ*¾h™>™h¾8 ¢¢ð §G'—° ¢°¢&WFõ6WGF–æw46†&7FW%6VÆV7B"À¢&WFõ6WGF–æw47F–öå6VÆV7B"À¢&WFõ6WGF–æw4…"À¢&WFõ6WGF–æw55 ¢Òæf÷$V6‚€¢6VÆV7D–CÓç° ¢–æ—D7W7FöÔG&÷F÷vâ€¢6VÆV7D–@¢“° ¢Ð¢“° §Ð¦6F6‚†W'&÷"—° ¢6öç6öÆRæW'&÷"€¢.ˆz®Šˆ.Kˆ¾h¸ž˜ŽYjîX‰ÞZx¾XÉnZKiY~ûÉ¢"À¢W'&÷ ¢“° §Ð  §G'—° ¢ò ¢)ˆRikZ)îûÈŽKéÞxZ~KÛþyJŽˆ^Šhk.ûÈÎ8ÎXª›¹îŠh¢ikZ)î™[~hÈž[ú¾˜	þXª›¹î8ÞûÈžûÉ ¢š™Ú.‹ÈžXZ^i˜.ûÈÎh¨£n{XN[Îh
~y¨B²òÞhÈž˜‰P¢XZŽ˜:Ž{hKˆ®™[~hÈžhÈ{¨ÎŠ{Žy›ÎûÈÎKˆjÊh
p¢ŠŠÞZé®ûÈÎKˆÞyJŽYÊŽjøþX¾hÈž˜‰^y¨D…DÔÎKˆ ¢YNˆz®Zú¾K¨¾K»n8 ¢¢ð ¢°¢²&GF6²"Â$GF6²%ÒÀ¢²'f—FÆ—G’"Â%f—FÆ—G’%ÒÀ¢²&VæW&w’"Â$VæW&w’%ÒÀ¢²&–çFVÆÆ–vVæ6R"Â$–çFVÆÆ–vVæ6R%ÒÀ¢²'7—&—B"Â%7—&—B%ÒÀ¢²&v–Æ—G’"Â$v–Æ—G’%Ð¢Òæf÷$V6‚‚…·7FD¶W’Æ–E'EÒ“Óç° ¢GF6„Æöæu&W72€¢B‚'7FGW4'Fâ"¶–E'B²$Ö–çW2"’À¢‚“Óç&VÖ÷fUö–çB‡7FD¶W’¢“°  ¢GF6„Æöæu&W72€¢B‚'7FGW4'Fâ"¶–E'B²%ÇW2"’À¢‚“ÓæFEö–çB‡7FD¶W’¢“° ¢Ò“° §Ð¦6F6‚†W'&÷"—° ¢6öç6öÆRæW'&÷"€¢.[Îh
~Xª›¹î™[~hÈž{hZé®ZKiY~ûÉ¢"À¢W'&÷ ¢“° §Ð  ¢ò¢7F'GW7FFTÖ6†–æR—2F†RöæÇ’÷væW"ÆÆ÷vVBFò6VÆV7BæBÆöBâ66÷VçB6fRâ¢ð  ¢ò ¢)ˆRKˆÞzêX›^Šy.h‰nŠèj©NY:®j)Þ‹zþ[éûÈÀ¢iÈ[èÎ˜;ÞYYþX¹^ˆz®X¹^ZÙŽj©N8 ¢7F'DWFõ6fR‚’XZ~˜:Žy¨NZé®i˜.Yš€¢jøþjÊŠ{Žy›Î˜;ÞiÈ>ˆz®[{jª.iú^˜®h‹.iŠþY
n[{.{i>™h¾Zx¾ûÈÀ¢h˜Kº^[zé~˜	ži˜.X	žxêžZën˜(NYÊŽX›^Šy.yZ¾™Ú.ûÈÀ¢K™þKˆÞiÈ>X{®˜Êþh‰nZÙŽ˜.z›®‹8~iiž8 ¢¢ð §G'—° ¢7F'DWFõ6fR‚“° §Ð¦6F6‚†W'&÷"—° ¢6öç6öÆRæW'&÷"€¢.ˆz®X¹^ZÙŽj©NYYþX¹^ZKiY~ûÉ¢"À¢W'&÷ ¢“° §Ð  ¢ò¢'VæFÆVB6÷W&6S¢§2ó×7FvR×c‚×F÷V6‚ÖÆö6²æ§2¢ð¢†gVæ7F–öâ‚—°¢'W6R7G&–7B#° ¢ò ¢¢cs‚$ôõBd•€¢ ¢¢ˆˆ®x˜ŽyJ‚F&vWBæ6Æ÷6W7B‚âââ’Xú®yÈ¾zÊÎKˆX¾zÊnYŽXX>{J8 ¢¢ˆ8ÎXÈ^Š:zÊÎKˆX¾zÊnYŽy¨NiŠò6–çfVçF÷'•v^ûÈÀ¢¢KØnyÉþjÚ>y¨B67&öÆÂ÷væW"iŠþZè>Kˆ®™Ú.y¨Bæ6öçFVçN8 ¢ ¢¢˜	žŠ:iKžh‰Kˆ‹zþ[èzYnXXŽ‹[ûÈÎXú®ŠhX[nKŠÞK»¾KÙ^Kˆ[@¢¢iŠþyÉþjÚ>XúþKº^Yè.y»Nh‰nkN[›>hÛ.X¹^y¨NZëžYšŽûÈÎ[XXŠ‹h˜¾Xº.˜	®˜î8 ¢¢ð¢gVæ7F–öâ—4–ç6–FTÆÆ÷vVE67&öÆÆW"‡F&vWB—°¢–b‚F&vWB—°¢&WGW&âfÇ6S°¢Ð ¢ò ¢)ˆRKúîjÚ>ûÈŽKéÞxZ~KÛþyJŽˆ^Y¹îZûÈÎ8ÎXZŽ[Îh
~h¨ˆ;Þš	ŠkÞ8Þš™Ú ¢8ÎKˆÞˆ;ÞhÛ.X¹^ûÈÎKˆ¾™Ú.yÈ¾KˆÞX‹8ÞûÈžûÉ ¢˜	žŠ:iŠþXZŽYùþy¨NŠ{Žhê~˜énûÈÆ6vÖR×7FvVŠ:K»¾KÙ^Š{Žhê~yºîj‰¢Xú®ŠhKˆÞYÊŽ˜	žK»Þy›ÞYÞYjîŠhn‰8¾y¨NXúþhÛ.X¹^ZëžYšŽXZ~ûÈÎKˆ[è°¢&WfVçDFVfVÇB‚–i8¾hèžXéþyIþhÛ.X¹^h˜¾Xº.8 ¢ç6¶–ÆÂ×&Wf–WrÖ&öG–ûÈŽXZŽ[Îh
~h¨ˆ;Þš	ŠkÞ[ØŽz©~yÉþjÚ0¢y¨NhÛ.X¹^ZëžYšŽûÈž[éîKˆ™h¾Zx¾[k).iÈžŠ*¾Xª˜.˜	žK»Þy›ÞYÞYjîûÈÀ¢zˆ¾[ÈþXÉnŠŠÞZé¦67&öÆÅF÷yÈ¾‹[~KènjÚ>[‹Ž8KØnh˜¾hÈ~yÉþy¨Nk¹X¹P¢i˜.ûÈŽyÉþjÚ>iÈ>{i>˜çF÷V6†Ö÷f^K¨¾K»nûÈžZèÎXZŽŠ*¾˜	žŠ:i8¾hèžûÈÀ¢˜	žiŠþXéþiÊÎ[ZÙŽYÊŽy¨F'V~ûÈÎXú®iŠþXZ~ZëžZÙ~{I®Šè®ZJ~8yÉþy¨N™ÈŠh¢hÛ.X¹^h˜ÞiÈ>yÈ¾X‹XZ~ZëžK˜¾[èÎh˜ÞiÈ>Š*¾‹ŠžX‹(	N(	NK˜¾X˜ÞZÙ~{I®[þ8¢XZ~ZëžX™¾Z[ÞZî[é~˜'f–Ww÷'NûÈÎ[éîKènk).yÉþy¨N™ÈŠhhÛ.X¹^˜î8  ¢cs2ãCR6†÷g&ÖR†÷Ff—ŽûÉ®YXn[©~iKžh‰Y»®Zé¢Æ&vRæVÂ[èÎûÈÀ¢yÉþjÚ>y¨NXZ~Zë’67&öÆÂ÷væW"iŠò6†öÖTfVGW&TÖöFÄ&öGž8 ¢ZInjbæ†öÖRÖfVGW&RÖÖöFÂÖ&÷‚Xú®‹*‹*ÎY»®Zé®[®ZûŽK‰B÷fW&fÆ÷s¦†–FFVîûÈÀ¢YºjÚNKˆÞˆ;ÞKº>i»þXZ~š˜	®˜îŠ{Žhê~˜énûÉ¾h¨®yÉþjÚ267&öÆÂ÷væW"{HÞXZP¢YÎKˆK»ÞjÈ®Zˆy›ÞYÞYjîûÈÎ˜þXXÞXhÞjÊX{®xûî8ÎyÈ¾[é~X‹67&öÆÆ&.8¢KØnh˜¾hÈ~k¹KˆÞX¹^8Þy¨NX~hÛ.X¹^x¸hX¾8  ¢YŽh‰Š9ÞX)ž˜Ži8~X‰~iŠþkN[›267&öÆÂ÷væW.8.ˆˆ®XŠNik~Xú®hê^Xùp¢÷fW&fÆ÷r×žûÈÎYºjÚNXÛ>KÛþyZ¾™Ú.[{.X{®xûîjš¾Y	67&öÆÆ&.ûÈÎh˜¾hÈ~[znXû0¢k¹K¸ÞiÈ>Š*¾XZŽYùòF÷V6‚Æö6²™‹¾i8¾8.xûîYÊŽYÎKˆK»ÞjÈ®ZˆXŠNik~YÎi˜ ¢hê^Xù~yÉþjÚ>XúþhÛ.X¹^y¨B‚õ’‹»ŽûÈÎ˜þXXÞXhÞx+®YjîKˆš™Ú.XúnX®K¨¾K»nŠ9ÎKˆ8  ¢Šy.ˆ›.Š›>{Kˆ;ÞX©¾Šinz©~y¨NyÉþjÚ267&öÆÂ÷væW"iŠð¢æ–çfVçF÷'’Ö6†&7FW"ÖFWF–ÂÖw&–NûÉ¾ZInj`¢æ–çfVçF÷'’Ö6†&7FW"ÖFWF–ÂÖ&÷‚iÊÎ‹ª¾iŠò÷fW&fÆ÷s¦†–FFVîûÈÀ¢KˆÞˆ;Þi»þXZ~ZëžXØ˜	®˜îŠ{Žhê~˜én8.h¨®yÉþjÚ>XZ~Zëž[NXªXZ^YÎKˆy›ÞYÞYjî8  ¢{{NX©þXØYËXØ‹8~Šˆ®iKnih.h‰ÖVF—VÒÖöFÂ[èÎûÈÎyÉþjÚ267&öÆÂ÷væW ¢iKžx+¢7G&–æ–æu¦öæTÖöFÄ&öGžûÉ¾ZInjnXú®‹*‹*ÎY»®Zé®[®ZûŽ8  ¢x¸hX¾ûÈþˆ;ÞX©¾Šª®iˆîiKnih.h‰ÖVF—VÒÖöFÂ[èÎûÈÎyÉþjÚ267&öÆÂ÷væW ¢iŠò77FGW4†VÇÖöFÂXZ~y¨Bæ—FVÒ×7FBÖÆ—7NûÉ¾ZInjnˆˆ~‹ùNY¹î˜Û^Y»®Zé®8  ¢csNûÉ®zyŽZûnšy¨NYè.y»B67&öÆÂ÷væW"iŠð¢6†öÖTfVGW&TÖöFÂçFVÒ×&VÆ–2ÖÖöFR6†öÖTfVGW&TÖöFÄ&öGžûÈÎXˆnšîX‰p¢çFVÒ×&VÆ–2×F'2X˜~iŠþkN[›267&öÆÂ÷væW.8.XZžˆ^˜;Þ[ø^šŽ˜	®˜î˜	žX°¢XZŽYùþŠ{Žhê~˜énûÉ¾Y
nX˜~h˜¾Xº.[éîXˆnšîX‰~h‰nzyŽZûnXZ~Zëž‹[~Zx¾i˜.iÈ>Š*°¢&WfVçDFVfVÇB‚žûÈÎ˜
h‰8ÎiÈži˜.ˆ;Þk¹8iÈži˜.KˆÞˆ;Þk¹8Þy¨NŠ9Þ{Úî[zîy[8  ¢f—&V&6R[‹>‰™þŠinz©~KÛþyJŽxÚŽz¸¾ikÂvÖR7FvRy¨B&W7öç6—fRf–Ww÷'@¢÷fW&ÆžûÈÎyÉþjÚ>y¨NYè.y»B67&öÆÂ÷væW"iŠòæf—&V&6RÖWF‚ÖF–Æö~ûÉ°¢YÎjŠ>Xú®YÊŽ˜	žK»ÞXZŽYùþy›ÞYÞYjîy›¾Š‰ŽKˆjÊûÈÎKˆÞx+®y›¾XZ^šXúnXªF÷V6†Ö÷fRŠ9ÎKˆ8 ¢¢ð¢6öç7BÆÆ÷vVE6VÆV7F÷"Ð¢"æ6öçFVçBÂæ6öçFVçB×67&öÆÆ&ÆRÂæ7&VF–öâ×vR×67&öÆÂÂæ7&VF–öâ×&öÆRÖ6&BÂæ–çfVçF÷'’Öw&–B×67&öÆÂÂçVW7B×F"Ö&öG’Âæ&GFÆRÖ—FVÒÖÆ—7BÂ"°¢"æ6†&7FW%F$6öçFVçBÂ66†&7FW%F$6öçFVçBÂ6–çfVçF÷'•vRÂ"°¢"æGfVçGW&R×f–WrÂ"°¢"æ†öÖRÖfVGW&RÖÖöFÂÖ&÷‚Â6†öÖTfVGW&TÖöFÄ&öG’Â6†öÖTfVGW&TÖöFÂçFVÒ×&VÆ–2ÖÖöFR6†öÖTfVGW&TÖöFÄ&öG’ÂçFVÒ×&VÆ–2×F'2ÂçcC×7–çF†W6—2Ö&öG’Â7G&–æ–æu¦öæTÖöFÄ&öG’ÂæWFò×6WGF–æw2ÖW‡æFVBÂ"°¢"æ–çfVçF÷'’Ö6†&7FW"ÖFWF–ÂÖ&÷‚Âæ–çfVçF÷'’Ö6†&7FW"ÖFWF–ÂÖw&–BÂæ—FVÒÖÖöFÂÖ&÷‚Â6—FVÔÖöFÅ7FG2Â76¶–ÆÄFWF–Å7FG2Â"°¢"77FGW4†VÇÖöFÂæ—FVÒ×7FBÖÆ—7BÂç6¶–ÆÂ×&Wf–WrÖ&öG’Âæ7&VF–öâ×6¶–ÆÂÖFWF–ÂÖÆWfVÇ2Â6GVævVöåF$6öçFVçBÂævÖWÆ’×æVÂ×67&öÆÂÂçcs3C"Ö'—72Ö&GFÆRÖÆörÂçcC2Ö—FVÒ×–6¶W"Âçcs3S‚×&Vf÷&vR×F–W'2Âçcs3c2ÖvÖR×6VÆV7BÖÖVçRÂçcs3SÖ6ö×&R×7FG2Âæf—&V&6RÖWF‚ÖF–ÆörÂ"°¢'FW‡F&VÂ6VÆV7BÂ–çWB#° ¢ÆWBæöFRÐ¢F&vWBææöFUG—SÓÓÓ¢òF&vW@¢¢F&vWBç&VçDVÆVÖVçC° ¢v†–ÆR†æöFRbbæöFRÓÖFö7VÖVçBæFö7VÖVçDVÆVÖVçB—° ¢–b€¢æöFRæÖF6†W2b`¢æöFRæÖF6†W2†ÆÆ÷vVE6VÆV7F÷"¢—°¢6öç7B7G–ÆRÐ¢v–æF÷rævWD6ö×WFVE7G–ÆR†æöFR“° ¢6öç7B6å67&öÆÅ’Ð¢€¢7G–ÆRæ÷fW&fÆ÷u“ÓÓÒ&WFò"ÇÀ¢7G–ÆRæ÷fW&fÆ÷u“ÓÓÒ'67&öÆÂ ¢’b`¢æöFRç67&öÆÄ†V–v‡Bà¢æöFRæ6Æ–VçD†V–v‡B²° ¢6öç7B6å67&öÆÅ‚Ð¢€¢7G–ÆRæ÷fW&fÆ÷uƒÓÓÒ&WFò"ÇÀ¢7G–ÆRæ÷fW&fÆ÷uƒÓÓÒ'67&öÆÂ ¢’b`¢æöFRç67&öÆÅv–GF‚à¢æöFRæ6Æ–VçEv–GF‚²° ¢–b†6å67&öÆÅ’ÇÂ6å67&öÆÅ‚—°¢&WGW&âG'VS°¢Ð¢Ð ¢æöFSÖæöFRç&VçDVÆVÖVçC°¢Ð ¢&WGW&âfÇ6S°¢Ð ¢Fö7VÖVçBæFDWfVçDÆ—7FVæW"€¢'F÷V6†Ö÷fR"À¢gVæ7F–öâ†WfVçB—°¢6öç7BvÖU7W&f6RÐ¢WfVçBçF&vWBb`¢WfVçBçF&vWBæ6Æ÷6W7Bb`¢WfVçBçF&vWBæ6Æ÷6W7B‚"6vÖR×7FvR"“° ¢–b€¢vÖU7W&f6Rb`¢WfVçBçF÷V6†W2b`¢WfVçBçF÷V6†W2æÆVæwFƒã¢—°¢WfVçBç&WfVçDFVfVÇB‚“°¢&WGW&ã°¢Ð ¢–b€¢vÖU7W&f6Rb`¢—4–ç6–FTÆÆ÷vVE67&öÆÆW"€¢WfVçBçF&vW@¢¢—°¢WfVçBç&WfVçDFVfVÇB‚“°¢Ð¢ÒÀ¢·76—fS¦fÇ6WÐ¢“° ¢Fö7VÖVçBæFDWfVçDÆ—7FVæW"€¢'ö–çFW&Ö÷fR"À¢gVæ7F–öâ†WfVçB—°¢–b€¢WfVçBçö–çFW%G—SÓÓÒ'F÷V6‚"b`¢WfVçBçF&vWBb`¢WfVçBçF&vWBæ6Æ÷6W7Bb`¢WfVçBçF&vWBæ6Æ÷6W7B‚"6vÖR×7FvR"’b`¢—4–ç6–FTÆÆ÷vVE67&öÆÆW"€¢WfVçBçF&vW@¢¢—°¢WfVçBç&WfVçDFVfVÇB‚“°¢Ð¢ÒÀ¢·76—fS¦fÇ6WÐ¢“° ¢ò ¢XZŽ˜®h‹.xþŠkÞYšŽXéþyIþK©.X¹^˜énûÉ ¢ÒYjîhÈ~K¸ÞKéÞiz.iÈ’67&öÆÂv†—FVÆ—7BjÚ>[‹ŽhÛ.X¹^8 ¢ÒXZžhÈ~Kº^Kˆ®kŽ˜KˆÞKªN{ZnxþŠkÞYšŽX¢–æ6‚¦ööÞ8 ¢Ò™Ùîih~ZÙ~‹ËŽXZRT’KˆÞ™h¾YYþ™[~hÈ’6öçFW‡BÖVç^8KˆÞXéþyIþh¹ni»>8KˆÞih~ZÙ~˜ŽXùn8 ¢˜	žiŠþXZŽYùò÷væW.ûÈÎzhjÚ.YNšXúnyh®™[~hÈžûÈþ{ŠîiKîŠ9ÎKˆ8 ¢¢ð¢gVæ7F–öâ—4vÖU7W&f6UF&vWB‡F&vWB—°¢&WGW&â€¢F&vWBb`¢F&vWBæ6Æ÷6W7Bb`¢F&vWBæ6Æ÷6W7B‚"6vÖR×7FvR"¢“°¢Ð ¢gVæ7F–öâ—4VF—F&ÆTvÖT6öçG&öÂ‡F&vWB—°¢&WGW&â€¢F&vWBb`¢F&vWBæ6Æ÷6W7Bb`¢F&vWBæ6Æ÷6W7B‚v–çWBÂFW‡F&VÂ¶6öçFVçFVF—F&ÆSÒ'G'VR%Òr¢“°¢Ð  ¢Fö7VÖVçBæFDWfVçDÆ—7FVæW"€¢&6öçFW‡FÖVçR"À¢gVæ7F–öâ†WfVçB—°¢–b€¢—4vÖU7W&f6UF&vWB†WfVçBçF&vWB’b`¢—4VF—F&ÆTvÖT6öçG&öÂ†WfVçBçF&vWB¢—°¢WfVçBç&WfVçDFVfVÇB‚“°¢Ð¢ÒÀ¢¶6GW&S§G'VWÐ¢“° ¢Fö7VÖVçBæFDWfVçDÆ—7FVæW"€¢&G&w7F'B"À¢gVæ7F–öâ†WfVçB—°¢–b€¢—4vÖU7W&f6UF&vWB†WfVçBçF&vWB’b`¢—4VF—F&ÆTvÖT6öçG&öÂ†WfVçBçF&vWB¢—°¢WfVçBç&WfVçDFVfVÇB‚“°¢Ð¢ÒÀ¢¶6GW&S§G'VWÐ¢“° ¢Fö7VÖVçBæFDWfVçDÆ—7FVæW"€¢'6VÆV7G7F'B"À¢gVæ7F–öâ†WfVçB—°¢–b€¢—4vÖU7W&f6UF&vWB†WfVçBçF&vWB’b`¢—4VF—F&ÆTvÖT6öçG&öÂ†WfVçBçF&vWB¢—°¢WfVçBç&WfVçDFVfVÇB‚“°¢Ð¢ÒÀ¢¶6GW&S§G'VWÐ¢“° ¢Fö7VÖVçBæFDWfVçDÆ—7FVæW"€¢'v†VVÂ"À¢gVæ7F–öâ†WfVçB—°¢–b€¢WfVçBæ7G&Ä¶W’b`¢—4vÖU7W&f6UF&vWB†WfVçBçF&vWB¢—°¢WfVçBç&WfVçDFVfVÇB‚“°¢Ð¢ÒÀ¢¶6GW&S§G'VRÇ76—fS¦fÇ6WÐ¢“° ¢v–æF÷ræFDWfVçDÆ—7FVæW"€¢&vW7GW&W7F'B"À¢gVæ7F–öâ†WfVçB—°¢–b€¢WfVçBçF&vWBb`¢WfVçBçF&vWBæ6Æ÷6W7Bb`¢WfVçBçF&vWBæ6Æ÷6W7B‚"6vÖR×7FvR"¢—°¢WfVçBç&WfVçDFVfVÇB‚“°¢Ð¢ÒÀ¢·76—fS¦fÇ6WÐ¢“° ¢v–æF÷ræFDWfVçDÆ—7FVæW"€¢&vW7GW&V6†ævR"À¢gVæ7F–öâ†WfVçB—°¢–b€¢WfVçBçF&vWBb`¢WfVçBçF&vWBæ6Æ÷6W7Bb`¢WfVçBçF&vWBæ6Æ÷6W7B‚"6vÖR×7FvR"¢—°¢WfVçBç&WfVçDFVfVÇB‚“°¢Ð¢ÒÀ¢·76—fS¦fÇ6WÐ¢“° ¢v–æF÷ræ—4–ç6–FTÆÆ÷vVE67&öÆÆW%cs‚Ð¢—4–ç6–FTÆÆ÷vVE67&öÆÆW#°§Ò’‚“°  ¢ò¢'VæFÆVB6÷W&6S¢§2ó"×7FvR×c’ÖæF—fRÖ6ö÷&F–æFRÖ’æ§2¢ð¢ò¢ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÐ¢c’(	BäD•dRƒ9s“#4ôõ$D”äDR ¢æWrfVGW&W2ÕU5BW6RF†W6R†VÇW'2–ç7FVBöb'&÷w6W ¢f–Ww÷'B6ö÷&F–æFW2à ¢W†—7F–ærvÖRÆöv–2—2–çFVçF–öæÆÇ’VçF÷V6†VBà£ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÒ¢ð¢†gVæ7F–öâ–ç7FÆÄæF—fTvÖT6ö÷&F–æFT’‚—°¢6öç7BtÔUõrÒƒ°¢6öç7BtÔUô‚Ò“#° ¢gVæ7F–öâvWE7FvR‚—°¢&WGW&âFö7VÖVçBævWDVÆVÖVçD'”–B‚&vÖR×7FvR"“°¢Ð ¢gVæ7F–öâvWD÷fW&Æ’‚—°¢&WGW&âFö7VÖVçBævWDVÆVÖVçD'”–B‚&vÖRÖ÷fW&Æ’ÖÆ–W""“°¢Ð ¢gVæ7F–öâ67&VVåFôvÖR†6Æ–VçE‚Â6Æ–VçE’—°¢6öç7B7FvRÒvWE7FvR‚“°¢–b‚7FvR—°¢&WGW&â·ƒ¢6Æ–VçE‚Â“¢6Æ–VçE—Ó°¢Ð ¢6öç7B&V7BÒ7FvRævWD&÷VæF–æt6Æ–VçE&V7B‚“°¢6öç7B66ÆRÒv–æF÷rævÖU7FvU66ÆRÇÂ° ¢&WGW&â°¢ƒ¢†6Æ–VçE‚Ò&V7BæÆVgB’ò66ÆRÀ¢“¢†6Æ–VçE’Ò&V7BçF÷’ò66ÆP¢Ó°¢Ð ¢gVæ7F–öâvÖUFõ67&VVâ‡‚Â’—°¢6öç7B7FvRÒvWE7FvR‚“°¢–b‚7FvR—°¢&WGW&â·‚Â—Ó°¢Ð ¢6öç7B&V7BÒ7FvRævWD&÷VæF–æt6Æ–VçE&V7B‚“° ¢&WGW&â°¢ƒ¢&V7BæÆVgB²‚¢‡&V7Bçv–GF‚òtÔUõr’À¢“¢&V7BçF÷²’¢‡&V7Bæ†V–v‡BòtÔUô‚¢Ó°¢Ð ¢gVæ7F–öâWfVçEFôvÖR†WfVçB—°¢6öç7Bö–çBÒWfVçBçF÷V6†W2bbWfVçBçF÷V6†W2æÆVæwF€¢òWfVçBçF÷V6†W5³Ð¢¢WfVçBæ6†ævVEF÷V6†W2bbWfVçBæ6†ævVEF÷V6†W2æÆVæwF€¢òWfVçBæ6†ævVEF÷V6†W5³Ð¢¢WfVçC° ¢&WGW&â67&VVåFôvÖR‡ö–çBæ6Æ–VçE‚Âö–çBæ6Æ–VçE’“°¢Ð ¢gVæ7F–öâ7&VFTæF—fTVÆVÖVçB†6Æ74æÖR—°¢6öç7B÷fW&Æ’ÒvWD÷fW&Æ’‚“°¢–b‚÷fW&Æ’—°¢&WGW&âçVÆÃ°¢Ð ¢6öç7BVÂÒFö7VÖVçBæ7&VFTVÆVÖVçB‚&F—b"“°¢VÂæ6Æ74æÖRÒ&vÖRÖæF—fRÖVÆVÖVçB"²†6Æ74æÖRÇÂ""“°¢÷fW&Æ’æVæD6†–ÆB†VÂ“°¢&WGW&âVÃ°¢Ð ¢gVæ7F–öâ6WDæF—fU&V7B†VÂÂ‚Â’Âv–GF‚Â†V–v‡B—°¢–b‚VÂ’&WGW&ã° ¢VÂç7G–ÆRç÷6—F–öâÒ&'6öÇWFR#°¢VÂç7G–ÆRæÆVgBÒ‚²'‚#°¢VÂç7G–ÆRçF÷Ò’²'‚#°¢VÂç7G–ÆRçv–GF‚Òv–GF‚²'‚#°¢VÂç7G–ÆRæ†V–v‡BÒ†V–v‡B²'‚#°¢Ð ¢gVæ7F–öâ6WDæF—fU÷6—F–öâ†VÂÂ‚Â’—°¢–b‚VÂ’&WGW&ã° ¢VÂç7G–ÆRç÷6—F–öâÒ&'6öÇWFR#°¢VÂç7G–ÆRæÆVgBÒ‚²'‚#°¢VÂç7G–ÆRçF÷Ò’²'‚#°¢Ð ¢v–æF÷rätÔUôäD•dUõt”ED‚ÒtÔUõs°¢v–æF÷rätÔUôäD•dUô„T”t…BÒtÔUôƒ° ¢v–æF÷rç67&VVåFôvÖRÒ67&VVåFôvÖS°¢v–æF÷rævÖUFõ67&VVâÒvÖUFõ67&VVã°¢v–æF÷ræWfVçEFôvÖRÒWfVçEFôvÖS°¢v–æF÷ræ7&VFTæF—fTvÖTVÆVÖVçBÒ7&VFTæF—fTVÆVÖVçC°¢v–æF÷rç6WDæF—fTvÖU&V7BÒ6WDæF—fU&V7C°¢v–æF÷rç6WDæF—fTvÖU÷6—F–öâÒ6WDæF—fU÷6—F–öã°§Ò’‚“°  ¢ò¢'VæFÆVB6÷W&6S¢§2ó2×7FvR×cÖ&GFÆRÖÆör×67&öÆÂ×'VçF–ÖRæ§2¢ð¢†gVæ7F–öâ‚—°¢'W6R7G&–7B#° ¢gVæ7F–öâf–æE67&öÆÆ&ÆT&GFÆUæVÂ‡F&vWB—°¢–b‚F&vWBÇÂF&vWBæ6Æ÷6W7B’&WGW&âçVÆÃ° ¢&WGW&âF&vWBæ6Æ÷6W7B€¢u¶FFÖ&GFÆRÖÆör×67&öÆÅÒÂr°¢ræ&GFÆRÖÆör×67&öÆÆ&ÆRÂr°¢ræ&GFÆRÖÆörÂr°¢ræ&GFÆRÖ–æfòÂr°¢ræ&GFÆRÖ–æfòÖ&÷‚Âr°¢ræ&GFÆRÖÆörÖ&÷‚Âr°¢ræ&GFÆRÖÆörÖ6öçF–æW"Âr°¢ræ6öÖ&BÖÆörÂr°¢ræ6öÖ&BÖÆörÖ&÷‚Âr°¢ræ&GFÆR×FW‡BÂr°¢ræ&GFÆRÖÖW76vRÖÆ—7Bp¢“°¢Ð ¢gVæ7F–öâ6å67&öÆÅfW'F–6ÆÇ’†VÂ—°¢–b‚VÂ’&WGW&âfÇ6S° ¢6öç7B7G–ÆRÒv–æF÷rævWD6ö×WFVE7G–ÆR†VÂ“°¢6öç7B÷fW&fÆ÷u’Ò7G–ÆRæ÷fW&fÆ÷u“° ¢&WGW&â€¢†÷fW&fÆ÷u’ÓÓÒ&WFò"ÇÂ÷fW&fÆ÷u’ÓÓÒ'67&öÆÂ"’b`¢VÂç67&öÆÄ†V–v‡BâVÂæ6Æ–VçD†V–v‡B²¢“°¢Ð ¢ò ¢¢Ö&²F†R7GVÂ67&öÆÆ&ÆR&GFÆRÆör6òF†RW†—7F–ærvÆö&À¢¢F÷V6‚Æö6²6â&V6övæ—¦R—Bà¢¢ð¢gVæ7F–öâÖ&´&GFÆU67&öÆÆW'2‚—°¢6öç7B6VÆV7F÷'2Ò°¢u¶6Æ72£Ò&&GFÆR%Õ¶6Æ72£Ò&Æör%ÒrÀ¢u¶6Æ72£Ò&&GFÆR%Õ¶6Æ72£Ò&–æfò%ÒrÀ¢u¶6Æ72£Ò&6öÖ&B%Õ¶6Æ72£Ò&Æör%ÒrÀ¢u¶–B£Ò&&GFÆR%Õ¶–B£Ò&Æör%ÒrÀ¢u¶–B£Ò&&GFÆR%Õ¶–B£Ò&–æfò%ÒrÀ¢u¶–B£Ò&6öÖ&B%Õ¶–B£Ò&Æör%Òp¢Ó° ¢Fö7VÖVçBçVW'•6VÆV7F÷$ÆÂ‡6VÆV7F÷'2æ¦ö–â‚"Â"’’æf÷$V6‚†gVæ7F–öâ†VÂ—°¢–b†6å67&öÆÅfW'F–6ÆÇ’†VÂ’—°¢VÂç6WDGG&–'WFR‚&FFÖ&GFÆRÖÆör×67&öÆÂ"Â'G'VR"“°¢VÂç7G–ÆRçF÷V6„7F–öâÒ'â×’#°¢Ð¢Ò“°¢Ð ¢ò ¢¢6GW&R×†6RÆ—7FVæW"'Vç2&Vf÷&RF†RöÆBvÆö&ÂF÷V6‚Æö6²à¢¢f÷"F†R7GVÂ&GFÆRÆörÂÆÆ÷rF†R'&÷w6W"w2fW'F–6Â67&öÆÂà¢¢f÷"WfW'—F†–ærVÇ6RÂF†RW†—7F–ærvÖR×v–FRÆö6²&VÖ–ç2Væ6†ævVBà¢¢ð¢Fö7VÖVçBæFDWfVçDÆ—7FVæW"‚'F÷V6†Ö÷fR"ÂgVæ7F–öâ†WfVçB—°¢6öç7B67&öÆÆW"Òf–æE67&öÆÆ&ÆT&GFÆUæVÂ†WfVçBçF&vWB“° ¢–b‡67&öÆÆW"bb6å67&öÆÅfW'F–6ÆÇ’‡67&öÆÆW"’—°¢WfVçBç7F÷–ÖÖVF–FU&÷vF–öâ‚“°¢&WGW&ã°¢Ð¢ÒÂ¶6GW&S§G'VRÂ76—fS¦fÇ6WÒ“° ¢Fö7VÖVçBæFDWfVçDÆ—7FVæW"‚'ö–çFW&Ö÷fR"ÂgVæ7F–öâ†WfVçB—°¢–b†WfVçBçö–çFW%G—RÓÒ'F÷V6‚"’&WGW&ã° ¢6öç7B67&öÆÆW"Òf–æE67&öÆÆ&ÆT&GFÆUæVÂ†WfVçBçF&vWB“° ¢–b‡67&öÆÆW"bb6å67&öÆÅfW'F–6ÆÇ’‡67&öÆÆW"’—°¢WfVçBç7F÷–ÖÖVF–FU&÷vF–öâ‚“°¢&WGW&ã°¢Ð¢ÒÂ¶6GW&S§G'VRÂ76—fS¦fÇ6WÒ“° ¢Ö&´&GFÆU67&öÆÆW'2‚“° ¢6öç7Bö'6W'fW"ÒæWr×WFF–öäö'6W'fW"†gVæ7F–öâ‚—°¢Ö&´&GFÆU67&öÆÆW'2‚“°¢Ò“° ¢ö'6W'fW"æö'6W'fR†Fö7VÖVçBæ&öG’Â°¢6†–ÆDÆ—7C§G'VRÀ¢7V'G&VS§G'VRÀ¢GG&–'WFW3§G'VRÀ¢GG&–'WFTf–ÇFW#¥²&6Æ72"Â'7G–ÆR%Ð¢Ò“° ¢v–æF÷ræFDWfVçDÆ—7FVæW"‚'&W6—¦R"ÂÖ&´&GFÆU67&öÆÆW'2Â·76—fS§G'VWÒ“°§Ò’‚“°  ¢ò¢'VæFÆVB6÷W&6S¢§2óB×7FvR×cÖæF—fRÖ&÷GFöÒÖæb×'VçF–ÖRæ§2¢ð¢†gVæ7F–öâ‚—°¢'W6R7G&–7B#° ¢ò ¢¢6öçfW'BF†RW†—7F–ær&÷GFöÒæf–vF–öâ–çFòæF—fRÖ6ö÷&F–æFP¢¢÷fW&Æ’v—F†÷WB6†æv–ær—G26Æ–6²†æFÆW'2÷"vÖRÆöv–2à¢ ¢¢vR6ÆöæRæò'WGFöç2æBFòæ÷B&WÆ6RW†—7F–ærWfVçBÆ—7FVæW'2à¢¢F†R÷&–v–æÂæb—2Ö÷fVB–çFòF†RæF—fR÷fW&Æ’Æ–W"à¢¢ð¢gVæ7F–öâÖ–w&FT&÷GFöÔæb‚—°¢6öç7B÷fW&Æ’ÒFö7VÖVçBævWDVÆVÖVçD'”–B‚&vÖRÖ÷fW&Æ’ÖÆ–W""“°¢–b‚÷fW&Æ’’&WGW&ã° ¢6öç7B6æF–FFW2Ò°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&&÷GFöÔæb"’À¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&ÖvTæb"’À¢Fö7VÖVçBçVW'•6VÆV7F÷"‚"6vÖRÖ6öçFVçBæ&÷GFöÒÖæb"¢Òæf–ÇFW"„&ööÆVâ“° ¢6æF–FFW2æf÷$V6‚†gVæ7F–öâ†æb—°¢–b‚æbÇÂæbæFF6WBææF—fUcÓÓÒ'G'VR"’&WGW&ã° ¢ò ¢¢öæÇ’Ö–w&FRæbVÆVÖVçG2F†B&R7GVÂvÖRæf–vF–öâà¢¢Fòæ÷BF÷V6‚Vç&VÆFVBf—†VB6öçG&öÇ2à¢¢ð¢6öç7B—4&÷GFöÔæbÐ¢æbæ–BÓÓÒ&&÷GFöÔæb"ÇÀ¢æbæ–BÓÓÒ&ÖvTæb"ÇÀ¢æbæ6Æ74Æ—7Bæ6öçF–ç2‚&&÷GFöÒÖæb"“° ¢–b‚—4&÷GFöÔæb’&WGW&ã° ¢6öç7Bw&W"ÒFö7VÖVçBæ7&VFTVÆVÖVçB‚&F—b"“°¢w&W"æ6Æ74æÖRÒ&æF—fRÖ&÷GFöÒÖæbÖÆ–W"#°¢w&W"æFF6WBææF—fUcÒ'G'VR#° ¢6öç7BæF—fTæbÒFö7VÖVçBæ7&VFTVÆVÖVçB‚&F—b"“°¢æF—fTæbæ6Æ74æÖRÒ&æF—fRÖ&÷GFöÒÖæb#°¢æF—fTæbæFF6WBææF—fUcÒ'G'VR#° ¢ò ¢¢Ö÷fRF†RW†—7F–ærVÆVÖVçBÂ&W6W'f–ær—G2W†—7F–ærDôÒÀ¢¢6†–ÆG&VâÂ”G2ÂæBWfVçBÆ—7FVæW'2à¢¢ð¢æbç&VçDæöFRæ–ç6W'D&Vf÷&R‡w&W"Âæb“°¢w&W"æVæD6†–ÆB†æF—fTæb“°¢æF—fTæbæVæD6†–ÆB†æb“° ¢ò ¢¢&VÖ÷fRÆVv7’f–Ww÷'B÷6—F–öæ–ærg&öÒF†RÖ÷fVBVÆVÖVçBà¢¢—G2f—7VÂ6—¦R—2&W6W'fVB'’F†RW†—7F–ær6†–ÆB7G–ÆW2à¢¢ð¢æbç7G–ÆRç÷6—F–öâÒ'&VÆF—fR#°¢æbç7G–ÆRæÆVgBÒ&WFò#°¢æbç7G–ÆRç&–v‡BÒ&WFò#°¢æbç7G–ÆRçF÷Ò&WFò#°¢æbç7G–ÆRæ&÷GFöÒÒ&WFò#°¢æbç7G–ÆRçG&ç6f÷&ÒÒ&æöæR#°¢æbç7G–ÆRæÖ&v–äÆVgBÒ##°¢æbç7G–ÆRæÖ&v–å&–v‡BÒ##°¢æbç7G–ÆRçv–GF‚Ò#R#° ¢æbæFF6WBææF—fUcÒ'G'VR#°¢Ò“°¢Ð ¢ò ¢¢'VâgFW"W†—7F–ær–æ—F–Æ—¦F–öâæBgFW"DôÒ6†ævW2à¢¢F†—2—2Ö–w&F–öâÖöæÇ“²—BFöW2æ÷BÇFW"vÖRÖV6†æ–72à¢¢ð¢–b†Fö7VÖVçBç&VG•7FFRÓÓÒ&ÆöF–ær"—°¢Fö7VÖVçBæFDWfVçDÆ—7FVæW"‚$DôÔ6öçFVçDÆöFVB"ÂÖ–w&FT&÷GFöÔæbÂ¶öæ6S§G'VWÒ“°¢ÖVÇ6W°¢Ö–w&FT&÷GFöÔæb‚“°¢Ð ¢6öç7Bö'6W'fW"ÒæWr×WFF–öäö'6W'fW"†gVæ7F–öâ‚—°¢Ö–w&FT&÷GFöÔæb‚“°¢Ò“° ¢ö'6W'fW"æö'6W'fR†Fö7VÖVçBæ&öG’Â°¢6†–ÆDÆ—7C§G'VRÀ¢7V'G&VS§G'VP¢Ò“° ¢v–æF÷ræÖ–w&FT&÷GFöÔæeFôæF—fSƒÒÖ–w&FT&÷GFöÔæc°§Ò’‚“°  ¢ò¢'VæFÆVB6÷W&6S¢§2óR×7FvR×c2ÖæF—fRÖÖÖæb×'VçF–ÖRæ§2¢ð¢†gVæ7F–öâ‚—°¢'W6R7G&–7B#° ¢gVæ7F–öâÖ–w&FTÖæb‚—°¢6öç7B÷fW&Æ’ÒFö7VÖVçBævWDVÆVÖVçD'”–B‚&vÖRÖ÷fW&Æ’ÖÆ–W""“°¢–b‚÷fW&Æ’’&WGW&ã° ¢6öç7BæbÒFö7VÖVçBævWDVÆVÖVçD'”–B‚&ÖvTæb"“°¢–b‚æbÇÂæbæFF6WBææF—fUc2ÓÓÒ'G'VR"’&WGW&ã° ¢ò ¢¢öæÇ’Ö–w&FRF†RÖ÷G&–æ–æræf–vF–öâà¢¢W†—7F–ærDôÒÂ6†–ÆG&VâÂ”G2æBWfVçBÆ—7FVæW'2&R&W6W'fVBà¢¢ð¢6öç7Bw&W"ÒFö7VÖVçBæ7&VFTVÆVÖVçB‚&F—b"“°¢w&W"æ6Æ74æÖRÒ&æF—fRÖÖÖæbÖÆ–W"#°¢w&W"æFF6WBææF—fUc2Ò'G'VR#° ¢6öç7BæF—fTæbÒFö7VÖVçBæ7&VFTVÆVÖVçB‚&F—b"“°¢æF—fTæbæ6Æ74æÖRÒ&æF—fRÖÖÖæb#°¢æF—fTæbæFF6WBææF—fUc2Ò'G'VR#° ¢æbç&VçDæöFRæ–ç6W'D&Vf÷&R‡w&W"Âæb“°¢w&W"æVæD6†–ÆB†æF—fTæb“°¢æF—fTæbæVæD6†–ÆB†æb“° ¢æbç7G–ÆRç÷6—F–öâÒ'&VÆF—fR#°¢æbç7G–ÆRæÆVgBÒ&WFò#°¢æbç7G–ÆRç&–v‡BÒ&WFò#°¢æbç7G–ÆRçF÷Ò&WFò#°¢æbç7G–ÆRæ&÷GFöÒÒ&WFò#°¢æbç7G–ÆRçG&ç6f÷&ÒÒ&æöæR#°¢æbç7G–ÆRæÖ&v–äÆVgBÒ##°¢æbç7G–ÆRæÖ&v–å&–v‡BÒ##°¢æbç7G–ÆRçv–GF‚Ò#R#° ¢æbæFF6WBææF—fUc2Ò'G'VR#°¢Ð ¢–b†Fö7VÖVçBç&VG•7FFRÓÓÒ&ÆöF–ær"—°¢Fö7VÖVçBæFDWfVçDÆ—7FVæW"‚$DôÔ6öçFVçDÆöFVB"ÂÖ–w&FTÖæbÂ¶öæ6S§G'VWÒ“°¢ÖVÇ6W°¢Ö–w&FTÖæb‚“°¢Ð ¢6öç7Bö'6W'fW"ÒæWr×WFF–öäö'6W'fW"†gVæ7F–öâ‚—°¢Ö–w&FTÖæb‚“°¢Ò“° ¢ö'6W'fW"æö'6W'fR†Fö7VÖVçBæ&öG’Â°¢6†–ÆDÆ—7C§G'VRÀ¢7V'G&VS§G'VP¢Ò“° ¢v–æF÷ræÖ–w&FTÖæeFôæF—fSƒÒÖ–w&FTÖæc°§Ò’‚“°  ¢ò¢'VæFÆVB6÷W&6S¢§2ób×7FvR×c3’Ö&GFÆRÖÖÖ&6¶w&÷VæB×'VçF–ÖRæ§2¢ð¢†gVæ7F–öâ‚—°¢'W6R7G&–7B#° ¢v–æF÷rätÔUôäD•dUô4ôäd•$ÔTEô$4TÄ”äRÒ%c3‚#°¢v–æF÷rätÔUôäD•dUô5U%$TåEõdU%4”ôâÒ%c3’#° ¢ò ¢¢c3’ÖÖ&6¶w&÷VæB'&–FvRà¢ ¢¢&–÷&—G“ ¢¢’W†—7F–ær7W'&VçBG&öÂöÖ&6¶w&÷VæBVÆVÖVçBw26ö×WFVBö7W'&Vç@¢¢&6¶w&÷VæB–ÖvRà¢¢"’W†—7F–ærÖFFö&6¶w&÷VæBf&–&ÆW2–bW‡÷6VB'’F†RvÖRà¢ ¢¢vRFòæ÷B&WÆ6RF†RvÖRw2Ö7FFR÷"&GFÆR7FFRà¢¢ð ¢gVæ7F–öâvWD&GFÆUvR‚—°¢&WGW&âFö7VÖVçBævWDVÆVÖVçD'”–B‚&&GFÆUvR"“°¢Ð ¢gVæ7F–öâvWEG&öÄÖ&6¶w&÷VæB‚—°¢6öç7B6æF–FFW2Ò°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚'G&öÅvR"’À¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&ÖvR"’À¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚'G&–æ–æuvR"’À¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&Ö&6¶w&÷VæB"’À¢Fö7VÖVçBçVW'•6VÆV7F÷"‚"6vÖRÖ6öçFVçBæÖÖ&6¶w&÷VæB"’À¢Fö7VÖVçBçVW'•6VÆV7F÷"‚"6vÖRÖ6öçFVçBçG&öÂÖ&6¶w&÷VæB"’À¢Fö7VÖVçBçVW'•6VÆV7F÷"‚"6vÖRÖ6öçFVçBçG&–æ–ærÖ&6¶w&÷VæB"¢Òæf–ÇFW"„&ööÆVâ“° ¢f÷"†6öç7BVÂöb6æF–FFW2—°¢6öç7B72ÒvWD6ö×WFVE7G–ÆR†VÂ“°¢6öç7B&rÒ72æ&6¶w&÷VæD–ÖvS°¢–b†&rbb&rÓÒ&æöæR"—°¢&WGW&â&s°¢Ð¢6öç7B–æÆ–æRÒVÂç7G–ÆRæ&6¶w&÷VæD–ÖvS°¢–b†–æÆ–æR—°¢&WGW&â–æÆ–æS°¢Ð¢Ð¢&WGW&âçVÆÃ°¢Ð ¢gVæ7F–öâÇ”7W'&VçDÖ&6¶w&÷VæB‚—°¢6öç7B&GFÆRÒvWD&GFÆUvR‚“°¢–b‚&GFÆR’&WGW&âfÇ6S° ¢6öç7B&rÒvWEG&öÄÖ&6¶w&÷VæB‚“°¢–b‚&r’&WGW&âfÇ6S° ¢&GFÆRç7G–ÆRç6WE&÷W'G’‚&&6¶w&÷VæBÖ–ÖvR"Â&rÂ&–×÷'FçB"“°¢&GFÆRç7G–ÆRç6WE&÷W'G’‚&&6¶w&÷VæB×6—¦R"Â&6÷fW""Â&–×÷'FçB"“°¢&GFÆRç7G–ÆRç6WE&÷W'G’‚&&6¶w&÷VæB×÷6—F–öâ"Â&6VçFW""Â&–×÷'FçB"“°¢&GFÆRç7G–ÆRç6WE&÷W'G’‚&&6¶w&÷VæB×&WVB"Â&æò×&WVB"Â&–×÷'FçB"“° ¢&WGW&âG'VS°¢Ð ¢ò ¢¢&GFÆRÖ’&R&VæFW&VBgFW"Öæf–vF–öââö'6W'fRöæÇ’F†P¢¢vÖRÖ6öçFVçB7V'G&VRf÷"&GFÆUvRöÖ×vR6†ævW2æB&VÇ¢¢F†R7W'&VçBÖ–ÖvRâF†—2FöW2æ÷BÇFW"&GFÆRÖV6†æ–72à¢¢ð¢gVæ7F–öâ–æ—B‚—°¢Ç”7W'&VçDÖ&6¶w&÷VæB‚“° ¢6öç7B&ö÷BÒFö7VÖVçBævWDVÆVÖVçD'”–B‚&vÖRÖ6öçFVçB"’ÇÀ¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&vÖR×7FvR"“°¢–b‚&ö÷B’&WGW&ã° ¢6öç7Bö'6W'fW"ÒæWr×WFF–öäö'6W'fW"†gVæ7F–öâ‚—°¢–b†Fö7VÖVçBævWDVÆVÖVçD'”–B‚&&GFÆUvR"’—°¢Ç”7W'&VçDÖ&6¶w&÷VæB‚“°¢Ð¢Ò“° ¢ö'6W'fW"æö'6W'fR‡&ö÷BÂ¶6†–ÆDÆ—7C§G'VRÂ7V'G&VS§G'VWÒ“° ¢v–æF÷ræFDWfVçDÆ—7FVæW"‚'&W6—¦R"ÂÇ”7W'&VçDÖ&6¶w&÷VæB“°¢Ð ¢v–æF÷rç7–æ4&GFÆT&6¶w&÷VæEFô7W'&VçDÖÒÇ”7W'&VçDÖ&6¶w&÷VæC° ¢–b†Fö7VÖVçBç&VG•7FFRÓÓÒ&ÆöF–ær"—°¢Fö7VÖVçBæFDWfVçDÆ—7FVæW"‚$DôÔ6öçFVçDÆöFVB"Â–æ—BÂ¶öæ6S§G'VWÒ“°¢ÖVÇ6W°¢–æ—B‚“°¢Ð§Ò’‚“°  ¢ò¢'VæFÆVB6÷W&6S¢§2ór×7FvR×cC×&ö÷BÖ&GFÆRÖ&6¶w&÷VæB×'VçF–ÖRæ§2¢ð¢†gVæ7F–öâ‚—°¢'W6R7G&–7B#° ¢v–æF÷rätÔUôäD•dUô4ôäd•$ÔTEô$4TÄ”äRÒ%c3’#°¢v–æF÷rätÔUôäD•dUô5U%$TåEõdU%4”ôâÒ%cC#° ¢6öç7BÄTt5•õt”ED‚ÒC#°¢6öç7BäD•dUõt”ED‚Òƒ°¢6öç7B4„$5DU%ô4$EôÄTt5•õt”ED‚Ò#C°¢6öç7B45Eô$DtUôäD•dUõt”ED‚Ð¢4„$5DU%ô4$EôÄTt5•õt”ED‚¢„äD•dUõt”ED‚òÄTt5•õt”ED‚“° ¢gVæ7F–öâVç7W&T&GFÆT&6¶w&÷VæDÆ–W"‚—°¢6öç7B&GFÆRÒFö7VÖVçBævWDVÆVÖVçD'”–B‚&&GFÆUvR"“°¢–b‚&GFÆR’&WGW&âçVÆÃ° ¢ÆWBÆ–W"Ò&GFÆRçVW'•6VÆV7F÷"‚#§66÷Râæ&GFÆRÖ&r×6†&VB"“°¢–b‚Æ–W"—°¢Æ–W"ÒFö7VÖVçBæ7&VFTVÆVÖVçB‚&F—b"“°¢Æ–W"æ6Æ74æÖRÒ&&GFÆRÖ&r×6†&VB#°¢Æ–W"ç6WDGG&–'WFR‚&&–Ö†–FFVâ"Â'G'VR"“°¢&GFÆRæ–ç6W'D&Vf÷&R†Æ–W"Â&GFÆRæf—'7D6†–ÆB“°¢Ð¢&WGW&âÆ–W#°¢Ð ¢gVæ7F–öâvWD7GVÅG&öÄ&6¶w&÷VæB‚—°¢ò ¢¢4õU$4RôbE%UDƒ ¢¢VçFW$Ö‚’6ÆÇ2Ç”Ö¦öæT&6¶w&÷VæB†7W'&VçE¦öæR’À¢¢v†–6‚w&—FW2F†R7W'&VçBÖ–ÖvRFò6ÖvT&tÆ–W"à¢ ¢¢vR&VBF†BW†7B&VæFW&VBÆ–W"&F†W"F†âwVW76–æp¢¢g&öÒ6ÖvR—G6VÆbà¢¢ð¢6öç7BÖÆ–W"ÒFö7VÖVçBævWDVÆVÖVçD'”–B‚&ÖvT&tÆ–W""“°¢–b†ÖÆ–W"—°¢6öç7B&rÒvWD6ö×WFVE7G–ÆR†ÖÆ–W"’æ&6¶w&÷VæD–ÖvS°¢–b†&rbb&rÓÒ&æöæR"—°¢&WGW&â&s°¢Ð¢–b†ÖÆ–W"ç7G–ÆRæ&6¶w&÷VæD–ÖvR—°¢&WGW&âÖÆ–W"ç7G–ÆRæ&6¶w&÷VæD–ÖvS°¢Ð¢Ð ¢ò ¢¢fÆÆ&6²öæÇ’–bF†RÖÆ–W"—2æ÷Bf–Æ&ÆS ¢¢W6RF†RvÖRw27GVÂÖ×¦öæRF&ÆRæB7W'&VçE¦öæRà¢¢ð¢G'—°¢–b‡G—VöbÖ¦öæT&6¶w&÷VæD–ÖvW2ÓÒ'VæFVf–æVB"—°¢6öç7BW&ÂÒÖ¦öæT&6¶w&÷VæD–ÖvW5¶7W'&VçE¦öæUÒÇÀ¢Ö¦öæT&6¶w&÷VæD–ÖvW2æf÷&W7C°¢–b‡W&Â—°¢&WGW&â'W&Â‚"²W&Â²"’#°¢Ð¢Ð¢Ö6F6‚†R—·Ð ¢&WGW&âçVÆÃ°¢Ð ¢gVæ7F–öâ7–æ4&GFÆT&6¶w&÷VæEFô7W'&VçDÖ‚—°¢6öç7BÆ–W"ÒVç7W&T&GFÆT&6¶w&÷VæDÆ–W"‚“°¢–b‚Æ–W"’&WGW&âfÇ6S° ¢6öç7B&rÒvWD7GVÅG&öÄ&6¶w&÷VæB‚“°¢–b‚&r’&WGW&âfÇ6S° ¢Æ–W"ç7G–ÆRç6WE&÷W'G’‚&&6¶w&÷VæBÖ–ÖvR"Â&Æ–æV"Öw&F–VçB‡&v&ƒÃÃÂãS"’Â&v&ƒÃÃÂãS"’’Â"²&rÂ&–×÷'FçB"“°¢Æ–W"ç7G–ÆRç6WE&÷W'G’‚&&6¶w&÷VæB×6—¦R"Â&6÷fW""Â&–×÷'FçB"“°¢Æ–W"ç7G–ÆRç6WE&÷W'G’‚&&6¶w&÷VæB×÷6—F–öâ"Â&6VçFW"F÷"Â&–×÷'FçB"“°¢Æ–W"ç7G–ÆRç6WE&÷W'G’‚&&6¶w&÷VæB×&WVB"Â&æò×&WVB"Â&–×÷'FçB"“° ¢&WGW&âG'VS°¢Ð ¢gVæ7F–öâVç7W&T67D&FvU6÷W&6U6—¦R†&FvR—°¢–b‚&FvRÇÂ&FvRæ6Æ74Æ—7Bæ6öçF–ç2‚'6¶–ÆÂÖæÖRÖ&FvR"’’&WGW&ã°¢ò ¢¢F†—2—2æF—fRÖ÷fW&Æ’76RÂ6òÖF6‚F†RÆVv7’6&C ¢¢#BÆVv7’‚9r"ãSsC#‚âââÒ3‚ãƒSræF—fR‚à¢¢ð¢&FvRç7G–ÆRç6WE&÷W'G’€¢'v–GF‚"À¢45Eô$DtUôäD•dUõt”ED‚²'‚"À¢&–×÷'FçB ¢“°¢&FvRç7G–ÆRç6WE&÷W'G’€¢&Ö–â×v–GF‚"À¢45Eô$DtUôäD•dUõt”ED‚²'‚"À¢&–×÷'FçB ¢“°¢&FvRç7G–ÆRç6WE&÷W'G’€¢&Ö‚×v–GF‚"À¢45Eô$DtUôäD•dUõt”ED‚²'‚"À¢&–×÷'FçB ¢“°¢&FvRç7G–ÆRç6WE&÷W'G’‚&föçB×6—¦R"Â#s'‚"Â&–×÷'FçB"“°¢&FvRç7G–ÆRç6WE&÷W'G’‚&föçB×vV–v‡B"Â#“"Â&–×÷'FçB"“°¢&FvRç7G–ÆRç6WE&÷W'G’‚'FW‡BÖÆ–vâ"Â&6VçFW""Â&–×÷'FçB"“°¢&FvRç7G–ÆRç6WE&÷W'G’‚'v†—FR×76R"Â&æ÷w&"Â&–×÷'FçB"“°¢Ð ¢ò ¢¢F†R6¶–ÆÂ&FvR—2G–æÖ–6ÆÇ’7&VFVB'¢¢6†÷u6¶–ÆÄæÖT&FvR‚’÷6†÷tÖöç7FW%6¶–ÆÄæÖT&FvR‚’à¢¢6F6‚F†R&VÂæöFRB7&VF–öâF–ÖRà¢¢ð¢gVæ7F–öâvF6„÷fW&Æ’‚—°¢6öç7B÷fW&Æ’ÒFö7VÖVçBævWDVÆVÖVçD'”–B‚&vÖRÖ÷fW&Æ’ÖÆ–W""“°¢–b‚÷fW&Æ’’&WGW&ã° ¢÷fW&Æ’çVW'•6VÆV7F÷$ÆÂ‚"ç6¶–ÆÂÖæÖRÖ&FvR"¢æf÷$V6‚†Vç7W&T67D&FvU6÷W&6U6—¦R“° ¢6öç7Bö'6W'fW"ÒæWr×WFF–öäö'6W'fW"†gVæ7F–öâ†×WFF–öç2—°¢×WFF–öç2æf÷$V6‚†gVæ7F–öâ†×WFF–öâ—°¢×WFF–öâæFFVDæöFW2æf÷$V6‚†gVæ7F–öâ†æöFR—°¢–b†æöFRææöFUG—RÓÒ’&WGW&ã°¢–b†æöFRæ6Æ74Æ—7Bb`¢æöFRæ6Æ74Æ—7Bæ6öçF–ç2‚'6¶–ÆÂÖæÖRÖ&FvR"’—°¢Vç7W&T67D&FvU6÷W&6U6—¦R†æöFR“°¢Ð¢–b†æöFRçVW'•6VÆV7F÷$ÆÂ—°¢æöFRçVW'•6VÆV7F÷$ÆÂ‚"ç6¶–ÆÂÖæÖRÖ&FvR"¢æf÷$V6‚†Vç7W&T67D&FvU6÷W&6U6—¦R“°¢Ð¢Ò“°¢Ò“°¢Ò“°¢ö'6W'fW"æö'6W'fR†÷fW&Æ’Ç¶6†–ÆDÆ—7C§G'VRÇ7V'G&VS§G'VWÒ“°¢Ð ¢gVæ7F–öâ–æ—B‚—°¢Vç7W&T&GFÆT&6¶w&÷VæDÆ–W"‚“°¢7–æ4&GFÆT&6¶w&÷VæEFô7W'&VçDÖ‚“°¢vF6„÷fW&Æ’‚“° ¢ò ¢¢v†Vâ7W'&VçE¦öæRöÖ&6¶w&÷VæB6†ævW2Â6ÖvT&tÆ–W"—0¢¢WFFVB'’Ç”Ö¦öæT&6¶w&÷VæB‚’â×WFF–öäö'6W'fW"öâF†P¢¢7G–ÆRGG&–'WFRwV&çFVW2&GFÆR&V6V—fW2F†R6ÖR–ÖvRà¢¢ð¢6öç7BÖÆ–W"ÒFö7VÖVçBævWDVÆVÖVçD'”–B‚&ÖvT&tÆ–W""“°¢–b†ÖÆ–W"—°¢6öç7BÖö'6W'fW"ÒæWr×WFF–öäö'6W'fW"€¢7–æ4&GFÆT&6¶w&÷VæEFô7W'&VçDÖ ¢“°¢Öö'6W'fW"æö'6W'fR†ÖÆ–W"Ç¶GG&–'WFW3§G'VRÆGG&–'WFTf–ÇFW#¥²'7G–ÆR%×Ò“°¢Ð ¢ò ¢¢Ç6ò&W7–æ2v†VâF†R&GFÆRvR—2&VæFW&VBö7F—fFVBà¢¢ð¢6öç7B6öçFVçBÒFö7VÖVçBævWDVÆVÖVçD'”–B‚&vÖRÖ6öçFVçB"“°¢–b†6öçFVçB—°¢6öç7BvTö'6W'fW"ÒæWr×WFF–öäö'6W'fW"†gVæ7F–öâ‚—°¢–b†Fö7VÖVçBævWDVÆVÖVçD'”–B‚&&GFÆUvR"’—°¢7–æ4&GFÆT&6¶w&÷VæEFô7W'&VçDÖ‚“°¢Ð¢Ò“°¢vTö'6W'fW"æö'6W'fR†6öçFVçBÇ¶6†–ÆDÆ—7C§G'VRÇ7V'G&VS§G'VWÒ“°¢Ð ¢v–æF÷rç7–æ4&GFÆT&6¶w&÷VæEFô7W'&VçDÖÐ¢7–æ4&GFÆT&6¶w&÷VæEFô7W'&VçDÖ°¢Ð ¢v–æF÷rævWEcC&GFÆUf—7VÄF–væ÷7F–72ÒgVæ7F–öâ‚—°¢6öç7BÆ–W"ÒFö7VÖVçBçVW'•6VÆV7F÷"€¢"6vÖR×7FvRâ6â6vÖRÖ6öçFVçB6&GFÆUvRâæ&GFÆRÖ&r×6†&VB ¢“°¢6öç7B&FvRÒFö7VÖVçBçVW'•6VÆV7F÷"€¢"6vÖR×7FvRâ6vÖRÖ÷fW&Æ’ÖÆ–W"ç6¶–ÆÂÖæÖRÖ&FvR ¢“°¢&WGW&â°¢7W'&VçE¦öæS ¢‡G—Vöb7W'&VçE¦öæRÓÒ'VæFVf–æVB"ò7W'&VçE¦öæR¢çVÆÂ’À¢&GFÆT&6¶w&÷VæC ¢Æ–W"òvWD6ö×WFVE7G–ÆR†Æ–W"’æ&6¶w&÷VæD–ÖvR¢çVÆÂÀ¢&FvTföçC ¢&FvRòvWD6ö×WFVE7G–ÆR†&FvR’æföçE6—¦R¢çVÆÂÀ¢&FvUv–GFƒ ¢&FvRò&FvRævWD&÷VæF–æt6Æ–VçE&V7B‚’çv–GF‚¢çVÆÂÀ¢&FvUFW‡C ¢&FvRò&FvRçFW‡D6öçFVçB¢çVÆÀ¢Ó°¢Ó° ¢–b†Fö7VÖVçBç&VG•7FFRÓÓÒ&ÆöF–ær"—°¢Fö7VÖVçBæFDWfVçDÆ—7FVæW"‚$DôÔ6öçFVçDÆöFVB"Æ–æ—BÇ¶öæ6S§G'VWÒ“°¢ÖVÇ6W°¢–æ—B‚“°¢Ð§Ò’‚“°  ¢ò¢'VæFÆVB6÷W&6S¢§2ó‚×7FvR×cC×'VçF–ÖRæ§2¢ð¢†gVæ7F–öâ‚—°¢'W6R7G&–7B#°¢v–æF÷rätÔUôäD•dUô4ôäd•$ÔTEô$4TÄ”äRÒ%cC#°¢v–æF÷rätÔUôäD•dUô5U%$TåEõdU%4”ôâÒ%cC#°§Ò’‚“°  ¢ò¢'VæFÆVB6÷W&6S¢§2ó’×7FvR×cCR×'VçF–ÖRæ§2¢ð¢†gVæ7F–öâ‚—°¢'W6R7G&–7B#°¢v–æF÷rätÔUôäD•dUô4ôäd•$ÔTEô$4TÄ”äRÒ%cC#°¢v–æF÷rätÔUôäD•dUô5U%$TåEõdU%4”ôâÒ%cCR#°¢v–æF÷rätÔUô$EDÄUô$4´u$õTäEõD”åBÒ'&v&ƒÃÃÂã3‚’#°¢v–æF÷rätÔUô45Eõ4´”ÄÅô$DtUôdôåEõ4•¤RÒ#g‚#°§Ò’‚“°  ¢ò¢'VæFÆVB6÷W&6S¢§2ó×7FvR×cCb×'VçF–ÖRæ§2¢ð¢†gVæ7F–öâ‚—°¢'W6R7G&–7B#°¢v–æF÷rätÔUôäD•dUô4ôäd•$ÔTEô$4TÄ”äRÒ%cCR#°¢v–æF÷rätÔUôäD•dUô5U%$TåEõdU%4”ôâÒ%cCb#°¢v–æF÷rätÔUô$EDÄUô$4´u$õTäEõD”åBÒ'&v&ƒÃÃÂãS"’#°¢v–æF÷rätÔUô45Eõ4´”ÄÅô$DtUôdôåEõ4•¤RÒ#3'‚#°§Ò’‚“°  ¢ò¢'VæFÆVB6÷W&6S¢§2ó×7FvR×cCr×'VçF–ÖRæ§2¢ð¢†gVæ7F–öâ‚—°¢'W6R7G&–7B#°¢v–æF÷rätÔUôäD•dUô4ôäd•$ÔTEô$4TÄ”äRÒ%cCb#°¢v–æF÷rätÔUôäD•dUô5U%$TåEõdU%4”ôâÒ%cCr#°¢v–æF÷rätÔUô45Eõ4´”ÄÅô$DtUõ4õU$4UôdôåEõ4•¤RÒ#S‚#°¢v–æF÷rätÔUô45Eõ4´”ÄÅô$DtUõ4õU$4Uõt”ED‚Ò#“‚#°§Ò’‚“°  ¢ò¢'VæFÆVB6÷W&6S¢§2ó"×7FvR×cC‚×'VçF–ÖRæ§2¢ð¢†gVæ7F–öâ‚—°¢'W6R7G&–7B#°¢v–æF÷rätÔUôäD•dUô4ôäd•$ÔTEô$4TÄ”äRÒ%cCr#°¢v–æF÷rätÔUôäD•dUô5U%$TåEõdU%4”ôâÒ%cC‚#°¢v–æF÷rätÔUô45Eõ4´”ÄÅô$DtUôdôåEõ4•¤RÒ#s'‚#°¢v–æF÷rätÔUô45Eõ4´”ÄÅô$DtUõ5E$ô´RÒ&æöæR#°§Ò’‚“°  ¢ò¢'VæFÆVB6÷W&6S¢§2ó2×7FvR×cC’×'VçF–ÖRæ§2¢ð¢†gVæ7F–öâ‚—°¢'W6R7G&–7B#°¢v–æF÷rätÔUôäD•dUô4ôäd•$ÔTEô$4TÄ”äRÒ%cC‚#°¢v–æF÷rätÔUôäD•dUô5U%$TåEõdU%4”ôâÒ%cC’#°¢v–æF÷rätÔUô45Eõ4´”ÄÅô$DtUõ5E$ô´RÒ&æöæR#° ¢gVæ7F–öâ&VÖ÷fU6¶–ÆÅv†—FU7G&ö¶R‚—°¢Fö7VÖVçBçVW'•6VÆV7F÷$ÆÂ‚"ç6¶–ÆÂÖæÖRÖ&FvR"’æf÷$V6‚†gVæ7F–öâ†VÂ—°¢VÂç7G–ÆRç6WE&÷W'G’‚"×vV&¶—B×FW‡B×7G&ö¶R"Â#"Â&–×÷'FçB"“°¢VÂç7G–ÆRç6WE&÷W'G’‚'FW‡B×7G&ö¶R"Â#"Â&–×÷'FçB"“°¢VÂç7G–ÆRç6WE&÷W'G’‚&&÷&FW""Â#"Â&–×÷'FçB"“°¢VÂç7G–ÆRç6WE&÷W'G’‚&÷WFÆ–æR"Â#"Â&–×÷'FçB"“°¢Ò“°¢Ð ¢–b†Fö7VÖVçBç&VG•7FFRÓÓÒ&ÆöF–ær"—°¢Fö7VÖVçBæFDWfVçDÆ—7FVæW"‚$DôÔ6öçFVçDÆöFVB"Â&VÖ÷fU6¶–ÆÅv†—FU7G&ö¶RÂ¶öæ6S§G'VWÒ“°¢ÖVÇ6W°¢&VÖ÷fU6¶–ÆÅv†—FU7G&ö¶R‚“°¢Ð§Ò’‚“°  ¢ò¢'VæFÆVB6÷W&6S¢§2óB×7FvR×cS×'VçF–ÖRæ§2¢ð¢†gVæ7F–öâ‚—°¢'W6R7G&–7B#°¢v–æF÷rätÔUôäD•dUô4ôäd•$ÔTEô$4TÄ”äRÒ%cC’#°¢v–æF÷rätÔUôäD•dUô5U%$TåEõdU%4”ôâÒ%cS#° ¢gVæ7F–öâf—„&GFÆT&6¶w&÷VæDVFvR‚—°¢6öç7B7FvRÒFö7VÖVçBævWDVÆVÖVçD'”–B‚&vÖR×7FvR"“°¢6öç7B&GFÆRÒFö7VÖVçBævWDVÆVÖVçD'”–B‚&&GFÆUvR"“°¢6öç7B&rÒ&GFÆRbb&GFÆRçVW'•6VÆV7F÷"‚"æ&GFÆRÖ&r×6†&VB"“°¢–b‚7FvRÇÂ&GFÆRÇÂ&r’&WGW&ã° ¢ò¢W6RF†R7GVÂ&GFÆRf–Ww÷'BF–ÖVç6–öç2ÂæWfW"ÆVv7’C#‚â¢ð¢&rç7G–ÆRç6WE&÷W'G’‚&ÆVgB"Â#"Â&–×÷'FçB"“°¢&rç7G–ÆRç6WE&÷W'G’‚'F÷"Â#"Â&–×÷'FçB"“°¢&rç7G–ÆRç6WE&÷W'G’‚'v–GF‚"Â#R"Â&–×÷'FçB"“°¢&rç7G–ÆRç6WE&÷W'G’‚&†V–v‡B"Â#R"Â&–×÷'FçB"“°¢&rç7G–ÆRç6WE&÷W'G’‚'&–v‡B"Â#"Â&–×÷'FçB"“°¢&rç7G–ÆRç6WE&÷W'G’‚&&÷GFöÒ"Â#"Â&–×÷'FçB"“°¢&rç7G–ÆRç6WE&÷W'G’‚&&÷&FW""Â#"Â&–×÷'FçB"“°¢&rç7G–ÆRç6WE&÷W'G’‚&÷WFÆ–æR"Â#"Â&–×÷'FçB"“°¢&rç7G–ÆRç6WE&÷W'G’‚&&÷‚×6†F÷r"Â&æöæR"Â&–×÷'FçB"“° ¢&GFÆRç7G–ÆRç6WE&÷W'G’‚&÷fW&fÆ÷r"Â&†–FFVâ"Â&–×÷'FçB"“°¢Ð ¢–b†Fö7VÖVçBç&VG•7FFRÓÓÒ&ÆöF–ær"—°¢Fö7VÖVçBæFDWfVçDÆ—7FVæW"‚$DôÔ6öçFVçDÆöFVB"Âf—„&GFÆT&6¶w&÷VæDVFvRÂ¶öæ6S§G'VWÒ“°¢ÖVÇ6W°¢f—„&GFÆT&6¶w&÷VæDVFvR‚“°¢Ð§Ò’‚“°  ¢ò¢'VæFÆVB6÷W&6S¢§2óR×7FvR×cS×'VçF–ÖRæ§2¢ð¢†gVæ7F–öâ‚—°¢'W6R7G&–7B#°¢v–æF÷rätÔUôäD•dUô4ôäd•$ÔTEô$4TÄ”äRÒ%cS#°¢v–æF÷rätÔUôäD•dUô5U%$TåEõdU%4”ôâÒ%c“2#° ¢ò ¢&W7F÷&Rv†—FR÷WFÆ–æRöæÇ’öâ6öÖ&B&W7VÇBæöFW2à¢Fòæ÷BF÷V6‚6¶–ÆÂÖæÖRÖ&FvRà¢¢ð¢6öç7B6öÖ&E&W7VÇE6VÆV7F÷"Ò°¢"æ&GFÆRÖFÖvR"À¢"æ&GFÆRÖFÖvRÖçVÖ&W""À¢"æFÖvRÖçVÖ&W""À¢"æFÖvR×FW‡B"À¢"æ6öÖ&BÖFÖvR"À¢"æ6öÖ&B×&W7VÇB"À¢"æ6öÖ&B×&W7VÇB×FW‡B"À¢"æ&GFÆRÖÖ—72"À¢"æÖ—72×FW‡B"À¢"æ&GFÆRÖ†VÂ"À¢"æ†VÂÖçVÖ&W""À¢"æ‡Ö6†ævR"À¢"æ‡Ö6†ævRÖçVÖ&W" ¢Òæ¦ö–â‚"Â"“° ¢gVæ7F–öâÇ”6öÖ&E&W7VÇE7G&ö¶R‡&ö÷B—°¢6öç7B&6RÒ&ö÷Bbb&ö÷BçVW'•6VÆV7F÷$ÆÂò&ö÷B¢Fö7VÖVçC°¢&6RçVW'•6VÆV7F÷$ÆÂ†6öÖ&E&W7VÇE6VÆV7F÷"’æf÷$V6‚†gVæ7F–öâ†VÂ—°¢VÂç7G–ÆRç6WE&÷W'G’‚"×vV&¶—B×FW‡B×7G&ö¶R"Â#7‚6fffffb"Â&–×÷'FçB"“°¢VÂç7G–ÆRç6WE&÷W'G’‚'FW‡B×7G&ö¶R"Â#7‚6fffffb"Â&–×÷'FçB"“°¢Ò“°¢Ð ¢gVæ7F–öâ–æ—B‚—°¢Ç”6öÖ&E&W7VÇE7G&ö¶R†Fö7VÖVçB“° ¢6öç7B7FvRÒFö7VÖVçBævWDVÆVÖVçD'”–B‚&vÖR×7FvR"“°¢–b‡7FvR—°¢æWr×WFF–öäö'6W'fW"†gVæ7F–öâ‚—°¢Ç”6öÖ&E&W7VÇE7G&ö¶R‡7FvR“°¢Ò’æö'6W'fR‡7FvRÂ¶6†–ÆDÆ—7C§G'VRÂ7V'G&VS§G'VWÒ“°¢Ð¢Ð ¢–b†Fö7VÖVçBç&VG•7FFRÓÓÒ&ÆöF–ær"—°¢Fö7VÖVçBæFDWfVçDÆ—7FVæW"‚$DôÔ6öçFVçDÆöFVB"Â–æ—BÂ¶öæ6S§G'VWÒ“°¢ÖVÇ6W°¢–æ—B‚“°¢Ð§Ò’‚“°  ¢ò¢'VæFÆVB6÷W&6S¢§2ób×7FvR×cSBÖÖ–âÖ6—G’×'VçF–ÖRæ§2¢ð¢†gVæ7F–öâ‚—°¢'W6R7G&–7B#°¢v–æF÷rätÔUôäD•dUô4ôäd•$ÔTEô$4TÄ”äRÒ%cS#°¢v–æF÷rätÔUôäD•dUô5U%$TåEõdU%4”ôâÒ%cSB#°¢v–æF÷rätÔUôäD•dUôÄ5Eõ44õRÒ&Ö–âÖ6—G’ÖÖöFW&FR×66ÆR#° ¢6öç7BEôe$TUôÔôDUô4Ä53Ò&BÖg&VR×6W'f–6RÖ–æfòÖÖöFR#°¢6öç7BEôe$TUô4ôäd”uô´U“Ò%4•„”äuôEôe$TUõ4U%d”4Uô4ôäd”r#°¢6öç7BEôe$TUôD•5Ä•õôÄ”5“Ôö&¦V7Bæg&VW¦R‡¶ÖöFS¢&WfW'’ÖVçG'’'Ò“°¢6öç7BDTdTÅEôEôe$TUô4ôäd”sÔö&¦V7Bæg&VW¦R‡°¢7W÷'DVÖ–Ã¢""À¢&VgVæEöÆ–7•W&Ã¢""À¢FW&×5W&Ã¢""À¢&—f7•öÆ–7•W&Ã¢""À¢W&6†6UW&Ã¢""À¢W&6†6TVæ&ÆVC¦fÇ6P¢Ò“°¢6öç7BDg&VU7FFS×°¢6†÷våF†—4VçG'“¦fÇ6RÀ¢ö'6W'fW#¦çVÆÂÀ¢&ÖVC¦fÇ6P¢Ó° ¢gVæ7F–öâÇ’‚—°¢6öç7B†öÖRÒFö7VÖVçBævWDVÆVÖVçD'”–B‚&†öÖUvR"“°¢–b‚†öÖR’&WGW&ã°¢†öÖRæ6Æ74Æ—7BæFB‚&Ö–âÖ6—G’ÖÆö&'’×&VG’"“°¢Ð ¢gVæ7F–öâVç7W&TDg&VT6öæf–r‚—°¢6öç7Bf÷&ÖÅ7W÷'DVÖ–ÃÕ7G&–ær‡v–æF÷räf÷W%7–Ö&öÇ57W÷'Bbgv–æF÷räf÷W%7–Ö&öÇ57W÷'BæVÖ–ÇÇÂ""’çG&–Ò‚“°¢6öç7BW†—7F–æs×v–æF÷u´Eôe$TUô4ôäd”uô´U•ÒbgG—Vöbv–æF÷u´Eôe$TUô4ôäd”uô´U•ÓÓÓÒ&ö&¦V7B ¢òv–æF÷u´Eôe$TUô4ôäd”uô´U•Ð¢¢·Ó°¢6öç7B6öæf–sÔö&¦V7Bæ76–vâ‡·ÒÄDTdTÅEôEôe$TUô4ôäd”rÆW†—7F–ær“°¢–b†f÷&ÖÅ7W÷'DVÖ–Â—²6öæf–rç7W÷'DVÖ–ÃÖf÷&ÖÅ7W÷'DVÖ–Ã²Ð¢v–æF÷u´Eôe$TUô4ôäd”uô´U•ÓÖ6öæf–s°¢&WGW&â6öæf–s°¢Ð ¢gVæ7F–öâvWDÖöFÅ'G2‚—°¢6öç7BÖöFÃÖFö7VÖVçBævWDVÆVÖVçD'”–B‚&†öÖTfVGW&TÖöFÂ"“°¢–b‚ÖöFÂ—²&WGW&âçVÆÃ²Ð¢6öç7B&÷ƒÖÖöFÂçVW'•6VÆV7F÷"‚"æ†öÖRÖfVGW&RÖÖöFÂÖ&÷‚"“°¢6öç7BF—FÆSÖFö7VÖVçBævWDVÆVÖVçD'”–B‚&†öÖTfVGW&TÖöFÅF—FÆR"“°¢6öç7B&öG“ÖFö7VÖVçBævWDVÆVÖVçD'”–B‚&†öÖTfVGW&TÖöFÄ&öG’"“°¢–b‚&÷‡ÇÂF—FÆWÇÂ&öG’—²&WGW&âçVÆÃ²Ð¢&WGW&â¶ÖöFÂÆ&÷‚ÇF—FÆRÆ&öG—Ó°¢Ð ¢gVæ7F–öâ&W6öÇfT6öæf–wW&VEW&Â‡fÇVR—°¢6öç7B&sÕ7G&–ær‡fÇVWÇÂ""’çG&–Ò‚“°¢–b‚&r—²&WGW&â"#²Ð¢G'—°¢6öç7BW&ÃÖæWrU$Â‡&rÇv–æF÷ræÆö6F–öâæ‡&Vb“°¢&WGW&âW&Âç&÷Fö6öÃÓÓÒ&‡GG3¢'ÇÇW&Âç&÷Fö6öÃÓÓÒ&‡GG¢"òW&Âæ‡&Vb¢"#°¢Ö6F6‚…ò—°¢&WGW&â"#°¢Ð¢Ð ¢gVæ7F–öâ6öæf–wW&UöÆ–7”'WGFöâ†'WGFöä–BÆ6öæf–wW&VEW&ÂÇFöFôÆ&VÂ—°¢6öç7B'WGFöãÖFö7VÖVçBævWDVÆVÖVçD'”–B†'WGFöä–B“°¢–b‚'WGFöâ—²&WGW&ã²Ð¢6öç7BW&Ã×&W6öÇfT6öæf–wW&VEW&Â†6öæf–wW&VEW&Â“°¢–b‚W&Â—°¢'WGFöâæF—6&ÆVC×G'VS°¢'WGFöâçF—FÆSÒ%DôDþûÉ®[è^hê^jÚ>[Èò"·FöFôÆ&VÂ².š™Ú"#°¢&WGW&ã°¢Ð¢'WGFöâæF—6&ÆVCÖfÇ6S°¢'WGFöâçF—FÆSÒ"#°¢'WGFöâæFDWfVçDÆ—7FVæW"‚&6Æ–6²"ÆgVæ7F–öâ‚—°¢v–æF÷ræ÷Vâ‡W&ÂÂ%ö&Ææ²"Â&æö÷VæW"Ææ÷&VfW'&W""“°¢Ò“°¢Ð ¢gVæ7F–öâ&VæFW$Dg&VU6W'f–6T&öG’†&öG’—°¢6öç7B6öæf–sÖVç7W&TDg&VT6öæf–r‚“°¢6öç7B6öæf–wW&VDVÖ–ÃÕ7G&–ær†6öæf–rç7W÷'DVÖ–ÇÇÂ""’çG&–Ò‚“°¢&öG’æ–ææW$…DÔÃÕ°¢sÇ6V7F–öâ6Æ73Ò&BÖg&VR×6W'f–6R×æVÂ"FFÖBÖg&VR×6W'f–6RÖ–æfóÒ'G'VR#ârÀ¢sÆF—b6Æ73Ò&BÖg&VR×6W'f–6RÖ†W&ò#ârÀ¢sÆF—b6Æ73Ò&BÖg&VR×6W'f–6R×7V'F—FÆR#ã3ZJžXXÞ[º>Y®iÈÞX¹“ÂöF—cârÀ¢sÆF—b6Æ73Ò&BÖg&VR×6W'f–6R×&–6R"&–ÖÆ&VÃÒ.X;žjÂåBC“’#äåBC““ÂöF—cârÀ¢sÆF—b6Æ73Ò&BÖg&VR×6W'f–6RÖ&FvR#îYjîjÊ‹;Î‹+~8;¾™Ùîˆz®X¹^{¨ÎŠˆ#ÂöF—cârÀ¢sÂöF—cârÀ¢sÆF—b6Æ73Ò&BÖg&VR×6W'f–6RÖ6÷’#ârÀ¢sÇîKˆjÊK¹ŽjËîûÈÎhùKé²3ZJžXXÞ[º>Y®jÈ®y¸®8#Â÷ârÀ¢sÇîiÊÎiÈÞX¹žx+®YjîjÊ‹;Î‹+~ûÈÎKˆÞiÈ>ˆz®X¹^{¨ÎŠˆ.8#Â÷ârÀ¢sÇî‹;Î‹+~h‰X©þ[èÎûÈÎXXÞ[º>Y®jÈ®y¸®[~{hZé®xêžZën[‹>‰™þûÈÎˆz®K¹ŽjËîh‰X©þ‹[~yIþiX‚3ZJž8#Â÷ârÀ¢sÇîjÚNiÈÞX¹žKˆÞhùKé¾šÞZInŠy.ˆ›.8Š9ÞX)ž8ˆ;ÞX©¾8˜®h‹.[š>h‰nX[nK¹nh‹X©¾Xªh‰8#Â÷ârÀ¢sÂöF—cârÀ¢sÇ6V7F–öâ6Æ73Ò&BÖg&VR×6W'f–6R×7W÷'B"&–ÖÆ&VÃÒ.Zê.iÈÞˆˆ~j)ÞjËâ#ârÀ¢sÆF—b6Æ73Ò&BÖg&VR×6W'f–6R×7W÷'B×&÷r#ârÀ¢sÇ7ãîZê.iÈÒVÖ–ÎûÉ£Â÷7ãârÀ¢sÆ"–CÒ&Dg&VU7W÷'DVÖ–Â#âr¶6öæf–wW&VDVÖ–Â²sÂö#ârÀ¢sÂöF—cârÀ¢sÆF—b6Æ73Ò&BÖg&VR×6W'f–6R×öÆ–7’Ö7F–öç2#ârÀ¢sÆ'WGFöâ–CÒ&Dg&VU&VgVæEöÆ–7”'WGFöâ"G—SÒ&'WGFöâ#îiú^yÈ¾˜jËîŠhþX˜sÂö'WGFöãârÀ¢sÆ'WGFöâ–CÒ&Dg&VUFW&×4'WGFöâ"G—SÒ&'WGFöâ#îiú^yÈ¾iÈÞX¹žj)ÞjËãÂö'WGFöãârÀ¢sÆ'WGFöâ–CÒ&Dg&VU&—f7”'WGFöâ"G—SÒ&'WGFöâ#îiú^yÈ¾™«zxjÈ®iKþzÙcÂö'WGFöãârÀ¢sÂöF—cârÀ¢sÇ6Æ73Ò&BÖg&VR×6W'f–6R×FöFòÖæ÷FR#î˜jËîŠhþX˜~8iÈÞX¹žj)ÞjËîˆˆ~™«zxjÈ®iKþzÙnš™Ú.[	®[è^ŠŠÞZé®ûÉ¾iÊ®ŠŠÞZé®X˜ÞKˆÞiÈ>[îY	KˆÞZÙŽYÊŽy¨N{k.YØ8#Â÷ârÀ¢sÂ÷6V7F–öãârÀ¢sÆF—b6Æ73Ò&BÖg&VR×6W'f–6RÖ7F–öç2#ârÀ¢sÆ'WGFöâ–CÒ&Dg&VUW&6†6T'WGFöâ"6Æ73Ò&BÖg&VR×6W'f–6R×W&6†6R"G—SÒ&'WGFöâ"F—6&ÆVB&–ÖÆ&VÃÒ.‹;Î‹+r3ZJžXXÞ[º>Y¢åBC“žûÈÎyºîX˜ÞK¹ŽjËîiÈÞX¹žk©nX)žKŠÒ#îK¹ŽjËîiÈÞX¹žk©nX)žKŠÓÂö'WGFöãârÀ¢sÆ'WGFöâ–CÒ&Dg&VT6¶æ÷vÆVFvT'WGFöâ"6Æ73Ò&BÖg&VR×6W'f–6RÖ6¶æ÷vÆVFvR"G—SÒ&'WGFöâ#îh‰yú^˜>K¨cÂö'WGFöãârÀ¢sÂöF—cârÀ¢sÂ÷6V7F–öãâp¢Òæ¦ö–â‚""“° ¢6öç7B7W÷'DVÖ–ÃÖFö7VÖVçBævWDVÆVÖVçD'”–B‚&Dg&VU7W÷'DVÖ–Â"“°¢–b‡7W÷'DVÖ–Â—°¢7W÷'DVÖ–ÂçFW‡D6öçFVçCÖ6öæf–wW&VDVÖ–Ã°¢7W÷'DVÖ–ÂæFF6WBçFöFóÒ&fÇ6R#°¢Ð ¢6öæf–wW&UöÆ–7”'WGFöâ‚&Dg&VU&VgVæEöÆ–7”'WGFöâ"Æ6öæf–rç&VgVæEöÆ–7•W&ÂÂ.˜jËîŠhþX˜r"“°¢6öæf–wW&UöÆ–7”'WGFöâ‚&Dg&VUFW&×4'WGFöâ"Æ6öæf–rçFW&×5W&ÂÂ.iÈÞX¹žj)ÞjËâ"“°¢6öæf–wW&UöÆ–7”'WGFöâ‚&Dg&VU&—f7”'WGFöâ"Æ6öæf–rç&—f7•öÆ–7•W&ÂÂ.™«zxjÈ®iKþzÙb"“° ¢6öç7BW&6†6T'WGFöãÖFö7VÖVçBævWDVÆVÖVçD'”–B‚&Dg&VUW&6†6T'WGFöâ"“°¢6öç7BW&6†6UW&Ã×&W6öÇfT6öæf–wW&VEW&Â†6öæf–rçW&6†6UW&Â“°¢–b‡W&6†6T'WGFöâbf6öæf–rçW&6†6TVæ&ÆVCÓÓ×G'VRbgW&6†6UW&Â—°¢W&6†6T'WGFöâæF—6&ÆVCÖfÇ6S°¢W&6†6T'WGFöâçFW‡D6öçFVçCÒ.‹;Î‹+r3ZJžXXÞ[º>Y¢åBC“’#°¢W&6†6T'WGFöâç6WDGG&–'WFR‚&&–ÖÆ&VÂ"Â.‹;Î‹+r3ZJžXXÞ[º>Y¢åBC“’"“°¢W&6†6T'WGFöâæFDWfVçDÆ—7FVæW"‚&6Æ–6²"ÆgVæ7F–öâ‚—°¢v–æF÷ræ÷Vâ‡W&6†6UW&ÂÂ%ö&Ææ²"Â&æö÷VæW"Ææ÷&VfW'&W""“°¢Ò“°¢Ð ¢6öç7B6¶æ÷vÆVFvT'WGFöãÖFö7VÖVçBævWDVÆVÖVçD'”–B‚&Dg&VT6¶æ÷vÆVFvT'WGFöâ"“°¢–b†6¶æ÷vÆVFvT'WGFöâ—°¢6¶æ÷vÆVFvT'WGFöâæFDWfVçDÆ—7FVæW"‚&6Æ–6²"Æ6Æ÷6TDg&VU6W'f–6T–æfôÖöFÂ“°¢Ð ¢òòDôDò„T5’“¢Z¾XZ^jÚ>[Èþ˜jËîŠhþX˜~8iÈÞX¹žj)ÞjËî8™«zxjÈ®iKþzÙn{k.YØ8 ¢òòDôDò„T5’“¢ZèÎh‰{jyXÎK¹ŽjËîˆˆ~K¹ŽjËî{YiéÎš™~ŠØž[èÎûÈÎh˜ÞXúþŠŠÞZé¢W&6†6TVæ&ÆVC×G'VRˆˆrW&6†6UW&Î8 ¢Ð ¢gVæ7F–öâF—66öææV7DDg&VTö'6W'fW"‚—°¢–b†Dg&VU7FFRæö'6W'fW"—°¢Dg&VU7FFRæö'6W'fW"æF—66öææV7B‚“°¢Dg&VU7FFRæö'6W'fW#ÖçVÆÃ°¢Ð¢Ð ¢gVæ7F–öâ÷VäDg&VU6W'f–6T–æfôÖöFÂ†÷F–öç2—°¢6öç7BÖçVÃÔ&ööÆVâ†÷F–öç2bf÷F–öç2æÖçVÂ“°¢–b‚ÖçVÂbfDg&VU7FFRç6†÷våF†—4VçG'’—²&WGW&âfÇ6S²Ð¢6öç7B'G3ÖvWDÖöFÅ'G2‚“°¢–b‚'G2—²&WGW&âfÇ6S²Ð¢–b‡'G2æÖöFÂæ6Æ74Æ—7Bæ6öçF–ç2‚'6†÷r"’bb'G2æÖöFÂæ6Æ74Æ—7Bæ6öçF–ç2„Eôe$TUôÔôDUô4Ä52’—°¢&WGW&âfÇ6S°¢Ð ¢'G2çF—FÆRçFW‡D6öçFVçCÒ.8®Y¹¾‹kþk™nX+>8²#°¢&VæFW$Dg&VU6W'f–6T&öG’‡'G2æ&öG’“°¢'G2æ&öG’ç67&öÆÅF÷Ó°¢'G2æÖöFÂæ6Æ74Æ—7BæFB„Eôe$TUôÔôDUô4Ä52“°¢'G2æÖöFÂç6WDGG&–'WFR‚'&öÆR"Â&F–Æör"“°¢'G2æÖöFÂç6WDGG&–'WFR‚&&–ÖÖöFÂ"Â'G'VR"“°¢'G2æÖöFÂç6WDGG&–'WFR‚&&–ÖÆ&VÆÆVF'’"Â&†öÖTfVGW&TÖöFÅF—FÆR"“°¢'G2æÖöFÂæ6Æ74Æ—7BæFB‚'6†÷r"“°¢Dg&VU7FFRç6†÷våF†—4VçG'“×G'VS°¢F—66öææV7DDg&VTö'6W'fW"‚“°¢&WGW&âG'VS°¢Ð ¢gVæ7F–öâ6Æ÷6TDg&VU6W'f–6T–æfôÖöFÂ‚—°¢6öç7B'G3ÖvWDÖöFÅ'G2‚“°¢–b‚'G7ÇÂ'G2æÖöFÂæ6Æ74Æ—7Bæ6öçF–ç2„Eôe$TUôÔôDUô4Ä52’—²&WGW&âfÇ6S²Ð¢–b‡G—Vöbv–æF÷ræ6Æ÷6T†öÖTfVGW&SÓÓÒ&gVæ7F–öâ"—°¢v–æF÷ræ6Æ÷6T†öÖTfVGW&R‚“°¢ÖVÇ6W°¢'G2æÖöFÂæ6Æ74Æ—7Bç&VÖ÷fR‚'6†÷r"“°¢Ð¢'G2æÖöFÂæ6Æ74Æ—7Bç&VÖ÷fR„Eôe$TUôÔôDUô4Ä52“°¢'G2æÖöFÂç&VÖ÷fTGG&–'WFR‚'&öÆR"“°¢'G2æÖöFÂç&VÖ÷fTGG&–'WFR‚&&–ÖÖöFÂ"“°¢'G2æÖöFÂç&VÖ÷fTGG&–'WFR‚&&–ÖÆ&VÆÆVF'’"“°¢&WGW&âG'VS°¢Ð ¢gVæ7F–öâ—5f—6–&ÆR†VÆVÖVçB—°¢–b‚VÆVÖVçGÇÆVÆVÖVçBæ†–FFVâ—²&WGW&âfÇ6S²Ð¢–b‡G—Vöbv–æF÷rævWD6ö×WFVE7G–ÆRÓÒ&gVæ7F–öâ"—²&WGW&âG'VS²Ð¢6öç7B7G–ÆS×v–æF÷rævWD6ö×WFVE7G–ÆR†VÆVÖVçB“°¢&WGW&â7G–ÆRæF—7Æ’ÓÒ&æöæR"bg7G–ÆRçf—6–&–Æ—G’ÓÒ&†–FFVâ#°¢Ð ¢gVæ7F–öâ6†÷VÆDWFõ6†÷tDg&VU6W'f–6T–æfò‚—°¢&WGW&âEôe$TUôD•5Ä•õôÄ”5’æÖöFSÓÓÒ&WfW'’ÖVçG'’"bbDg&VU7FFRç6†÷våF†—4VçG'“°¢Ð ¢gVæ7F–öâ—4†öÖU&VG”f÷$Dg&VTF—66Æ÷7W&R‚—°¢6öç7B7F'GWÖFö7VÖVçBævWDVÆVÖVçD'”–B‚'7F'GWÆöFW""“°¢6öç7BvÖSÖFö7VÖVçBævWDVÆVÖVçD'”–B‚&vÖT–çFW&f6R"“°¢6öç7B†öÖSÖFö7VÖVçBævWDVÆVÖVçD'”–B‚&†öÖUvR"“°¢6öç7BÖöFÃÖFö7VÖVçBævWDVÆVÖVçD'”–B‚&†öÖTfVGW&TÖöFÂ"“°¢–b‡7F'GWbf—5f—6–&ÆR‡7F'GW’—²&WGW&âfÇ6S²Ð¢–b‚—5f—6–&ÆR†vÖR’—²&WGW&âfÇ6S²Ð¢–b‚†öÖWÇÂ†öÖRæ6Æ74Æ—7Bæ6öçF–ç2‚&7F—fR"’—²&WGW&âfÇ6S²Ð¢–b†ÖöFÂbfÖöFÂæ6Æ74Æ—7Bæ6öçF–ç2‚'6†÷r"’—²&WGW&âfÇ6S²Ð¢&WGW&âG'VS°¢Ð ¢gVæ7F–öâG'”WFõ6†÷tDg&VU6W'f–6T–æfò‚—°¢–b‚6†÷VÆDWFõ6†÷tDg&VU6W'f–6T–æfò‚—ÇÂ—4†öÖU&VG”f÷$Dg&VTF—66Æ÷7W&R‚’—°¢&WGW&âfÇ6S°¢Ð¢&WGW&â÷VäDg&VU6W'f–6T–æfôÖöFÂ‡¶ÖçVÃ¦fÇ6WÒ“°¢Ð ¢gVæ7F–öâ66†VGVÆTWFõ6†÷tDg&VU6W'f–6T–æfò‚—°¢–b‚6†÷VÆDWFõ6†÷tDg&VU6W'f–6T–æfò‚’—²&WGW&ã²Ð¢–b‡G—Vöbv–æF÷rç&WVW7Dæ–ÖF–öäg&ÖSÓÓÒ&gVæ7F–öâ"—°¢v–æF÷rç&WVW7Dæ–ÖF–öäg&ÖR‡G'”WFõ6†÷tDg&VU6W'f–6T–æfò“°¢ÖVÇ6W°¢v–æF÷rç6WEF–ÖV÷WB‡G'”WFõ6†÷tDg&VU6W'f–6T–æfòÃ“°¢Ð¢Ð ¢gVæ7F–öâ&ÔDg&VU6W'f–6T–æfò‚—°¢–b†Dg&VU7FFRæ&ÖVB—²&WGW&ã²Ð¢Dg&VU7FFRæ&ÖVC×G'VS°¢Vç7W&TDg&VT6öæf–r‚“° ¢Fö7VÖVçBæFDWfVçDÆ—7FVæW"‚'cs2ã#§7F'GWÖVçFW&VB"Ç66†VGVÆTWFõ6†÷tDg&VU6W'f–6T–æfò“°¢v–æF÷ræFDWfVçDÆ—7FVæW"‚'vW6†÷r"Ç66†VGVÆTWFõ6†÷tDg&VU6W'f–6T–æfò“° ¢–b‡G—Vöb×WFF–öäö'6W'fW#ÓÓÒ&gVæ7F–öâ"—°¢6öç7Bö'6W'fW#ÖæWr×WFF–öäö'6W'fW"‡66†VGVÆTWFõ6†÷tDg&VU6W'f–6T–æfò“°¢²'7F'GWÆöFW""Â&vÖT–çFW&f6R"Â&†öÖUvR"Â&†öÖTfVGW&TÖöFÂ%Òæf÷$V6‚†gVæ7F–öâ†–B—°¢6öç7BVÆVÖVçCÖFö7VÖVçBævWDVÆVÖVçD'”–B†–B“°¢–b†VÆVÖVçB—°¢ö'6W'fW"æö'6W'fR†VÆVÖVçBÇ¶GG&–'WFW3§G'VRÆGG&–'WFTf–ÇFW#¥²&6Æ72"Â'7G–ÆR"Â&†–FFVâ%×Ò“°¢Ð¢Ò“°¢Dg&VU7FFRæö'6W'fW#Öö'6W'fW#°¢Ð ¢66†VGVÆTWFõ6†÷tDg&VU6W'f–6T–æfò‚“°¢Ð ¢v–æF÷räEôe$TUõ4U%d”4UôD•5Ä•õôÄ”5“ÔEôe$TUôD•5Ä•õôÄ”5“°¢v–æF÷ræ÷VäDg&VU6W'f–6T–æfôÖöFÃÖgVæ7F–öâ‚—°¢&WGW&â÷VäDg&VU6W'f–6T–æfôÖöFÂ‡¶ÖçVÃ§G'VWÒ“°¢Ó°¢v–æF÷ræ6Æ÷6TDg&VU6W'f–6T–æfôÖöFÃÖ6Æ÷6TDg&VU6W'f–6T–æfôÖöFÃ°  ¢gVæ7F–öâ&÷7FW$çVÖ&W"‡fÇVR—°¢6öç7BçVÖ&W#ÔçVÖ&W"‡fÇVR“°¢&WGW&âçVÖ&W"æ—4f–æ—FR†çVÖ&W"“öçVÖ&W#£°¢Ð¢gVæ7F–öâ&÷7FW$W66R‡fÇVR—°¢&WGW&â7G&–ær‡fÇVSÓÖçVÆÃò"#§fÇVR¢ç&WÆ6R‚òbörÂ"f×²"’ç&WÆ6R‚óÂörÂ"fÇC²"’ç&WÆ6R‚óâörÂ"fwC²"¢ç&WÆ6R‚õÂ"örÂ"gV÷C²"’ç&WÆ6R‚òrörÂ"b33“²"“°¢Ð¢gVæ7F–öâ&÷7FW%&W6÷W&6UFW‡B‡fÇVR—°¢6öç7Bv†öÆSÔÖF‚æÖ‚ƒÄÖF‚æfÆö÷"‡&÷7FW$çVÖ&W"‡fÇVR’’“°¢–b‡v†öÆSãÓ—°¢6öç7B6ö×7C×v†öÆRó°¢&WGW&â6ö×7BçFôf—†VB†6ö×7CãÓó£"’ç&WÆ6R‚õÂãó²BörÂ""’².XHB#°¢Ð¢–b‡v†öÆSãÓ—²&WGW&âÖF‚æfÆö÷"‡v†öÆRó’².‰
Â#²Ð¢&WGW&âv†öÆRçFôÆö6ÆU7G&–ær‚'¦‚ÕEr"“°¢Ð¢gVæ7F–öâ7–æ5&÷7FW%&W6÷W&6R†æöFRÇfÇVR—°¢–b‚æöFR—²&WGW&ã²Ð¢6öç7Bv†öÆSÔÖF‚æÖ‚ƒÄÖF‚æfÆö÷"‡&÷7FW$çVÖ&W"‡fÇVR’’“°¢6öç7BgVÆÃ×v†öÆRçFôÆö6ÆU7G&–ær‚'¦‚ÕEr"“°¢æöFRçFW‡D6öçFVçC×&÷7FW%&W6÷W&6UFW‡B‡v†öÆR“°¢æöFRçF—FÆSÖgVÆÃ²æöFRç6WDGG&–'WFR‚&&–ÖÆ&VÂ"ÆgVÆÂ“°¢Ð¢gVæ7F–öâ&VæFW$†öÖU&÷7FW"‚—°¢6öç7BvSÖFö7VÖVçBævWDVÆVÖVçD'”–B‚&†öÖUvR"“°¢6öç7Bw&–C×vRbgvRçVW'•6VÆV7F÷"‚"æ†öÖRÖ6&BÖw&–B"“°¢–b‚vWÇÂw&–GÇÇG—VöbvWDW†—7F–æu'G”–æFW†W2ÓÒ&gVæ7F–öâ"—²&WGW&âfÇ6S²Ð¢6öç7B'G”–æFW†W3ÖvWDW†—7F–æu'G”–æFW†W2‚’ç6Æ–6RƒÃ2“°¢6öç7Bf–Æ&ÆTW‡×G—Vöbv–æF÷rçcs4vWDf–Æ&ÆTW‡ööÃÓÓÒ&gVæ7F–öâ ¢÷v–æF÷rçcs4vWDf–Æ&ÆTW‡ööÂ„FFRææ÷r‚’¢¢‡G—Vöb6†&VDW‡ÓÒ'VæFVf–æVB#÷6†&VDW‡£“°¢7–æ5&÷7FW%&W6÷W&6R†Fö7VÖVçBævWDVÆVÖVçD'”–B‚&†öÖT‡VDvöÆEfÇVR"’ÇG—VöbvöÆBÓÒ'VæFVf–æVB#övöÆC£“°¢7–æ5&÷7FW%&W6÷W&6R†Fö7VÖVçBævWDVÆVÖVçD'”–B‚&†öÖT‡VDW‡fÇVR"’Æf–Æ&ÆTW‡“°¢ÆWB&÷7FW#ÖFö7VÖVçBævWDVÆVÖVçD'”–B‚'cCd†öÖU&÷7FW""“°¢–b‚&÷7FW"—°¢&÷7FW#ÖFö7VÖVçBæ7&VFTVÆVÖVçB‚'6V7F–öâ"“°¢&÷7FW"æ–CÒ'cCd†öÖU&÷7FW"#²&÷7FW"æ6Æ74æÖSÒ'cCbÖ†öÖR×&÷7FW"#°¢&÷7FW"ç6WDGG&–'WFR‚&&–ÖÆ&VÂ"Â.Xi.™ª®™¨®KÈÒ"“°¢w&–Bæ–ç6W'DF¦6VçDVÆVÖVçB‚&gFW&VæB"Ç&÷7FW"“°¢Ð¢6öç7B6&G3×'G”–æFW†W2æÖ†–æFWƒÓç°¢6öç7B6†&7FW#×G—VöbvWE'G”6†&7FW$'”–æFWƒÓÓÒ&gVæ7F–öâ#övWE'G”6†&7FW$'”–æFW‚†–æFW‚“¦çVÆÃ°¢6öç7B7FG3×G—VöbvWE'G”&GFÆU7FG3ÓÓÒ&gVæ7F–öâ#övWE'G”&GFÆU7FG2†–æFW‚“¦çVÆÃ°¢–b‚6†&7FW'ÇÂ7FG2—²&WGW&â"#²Ð¢6öç7B‡ÔÖF‚æÖ‚ƒÄÖF‚æÖ–â‡&÷7FW$çVÖ&W"‡7FG2æÖ„…’Ç&÷7FW$çVÖ&W"†6†&7FW"æ‡’’“°¢6öç7B7ÔÖF‚æÖ‚ƒÄÖF‚æÖ–â‡&÷7FW$çVÖ&W"‡7FG2æÖ…5’Ç&÷7FW$çVÖ&W"†6†&7FW"ç7’’“°¢6öç7B‡W&6VçC×&÷7FW$çVÖ&W"‡7FG2æÖ„…“ãö‡÷&÷7FW$çVÖ&W"‡7FG2æÖ„…’££°¢6öç7B7W&6VçC×&÷7FW$çVÖ&W"‡7FG2æÖ…5“ã÷7÷&÷7FW$çVÖ&W"‡7FG2æÖ…5’££°¢6öç7B'Gv÷&³×G—VöbvWD6†&7FW$'Gv÷&µFƒÓÓÒ&gVæ7F–öâ#övWD6†&7FW$'Gv÷&µF‚†6†&7FW"“¢"#°¢&WGW&âsÆ'F–6ÆR6Æ73Ò'cCbÖ†öÖRÖ6†&7FW""FFÖVÆVÖVçCÒ"r·&÷7FW$W66R†6†&7FW"æVÆVÖVçGÇÂ&f—&R"’²r#âr°¢sÆF—b6Æ73Ò'cCbÖ†öÖRÖfF"#ãÆ–Ör7&3Ò"r·&÷7FW$W66R†'Gv÷&²’²r"ÇCÒ"r·&÷7FW$W66R†6†&7FW"æ–GÇÂ.Šy.ˆ›""’²~š
ÞX8ò#ãÂöF—câr°¢sÆF—b6Æ73Ò'cCbÖ†öÖRÖ6†&7FW"ÖÖ–â#ãÆF—cãÆ#âr·&÷7FW$W66R†6†&7FW"æ–GÇÂ‚.Šy.ˆ›""²†–æFW‚³’’’²sÂö#ãÇ7ãäÇbâr´ÖF‚æÖ‚ƒÄÖF‚æfÆö÷"‡&÷7FW$çVÖ&W"†6†&7FW"æÆWfVÂ—ÇÃ’’²sÂ÷7ããÂöF—câr°¢sÆF—b6Æ73Ò'cCbÖ†öÖR×&W6÷W&6R‡#ãÆ’7G–ÆSÒ'v–GFƒ¢r¶‡W&6VçB²rR#ãÂö“ãÇ7G&öæsä…r´ÖF‚æfÆö÷"†‡’²ròr´ÖF‚æfÆö÷"‡&÷7FW$çVÖ&W"‡7FG2æÖ„…’’²sÂ÷7G&öæsãÂöF—câr°¢sÆF—b6Æ73Ò'cCbÖ†öÖR×&W6÷W&6R7#ãÆ’7G–ÆSÒ'v–GFƒ¢r·7W&6VçB²rR#ãÂö“ãÇ7G&öæså5r´ÖF‚æfÆö÷"‡7’²ròr´ÖF‚æfÆö÷"‡&÷7FW$çVÖ&W"‡7FG2æÖ…5’’²sÂ÷7G&öæsãÂöF—cãÂöF—cãÂö'F–6ÆSâs°¢Ò’æ¦ö–â‚""“°¢&÷7FW"æ–ææW$…DÔÃÒsÆ†VFW#ãÆ#îXi.™ª®™¨®KÈÓÂö#ãÇ7ãî™¨®KÈÒr·'G”–æFW†W2æÆVæwF‚²ròcÂ÷7ããÆ'WGFöâG—SÒ&'WGFöâ"6Æ73Ò'bÖf—†VBÖf÷&ÖF–öâÖVçG'’"FFÖfVGW&SÒ&vÖWÆ’Ö6÷&R"öæ6Æ–6³Ò&÷Vä†öÖTfVGW&R…Âvf÷&ÖF–öåÂr’#îKØŽ™š3Âö'WGFöããÂö†VFW#âr¶6&G3°¢&÷7FW"æFF6WBç&VG“Ò'G'VR#°¢&WGW&âG'VS°¢Ð¢v–æF÷rçcSE&VæFW$†öÖU&÷7FW#×&VæFW$†öÖU&÷7FW#°¢Fö7VÖVçBæFDWfVçDÆ—7FVæW"‚&f÷W"×7–Ö&öÇ3§7F'GW×&VG’"Ç&VæFW$†öÖU&÷7FW"“° ¢gVæ7F–öâ&ö÷B‚—°¢Ç’‚“°¢&ÔDg&VU6W'f–6T–æfò‚“°¢Ð ¢–b†Fö7VÖVçBç&VG•7FFRÓÓÒ&ÆöF–ær"—°¢Fö7VÖVçBæFDWfVçDÆ—7FVæW"‚$DôÔ6öçFVçDÆöFVB"Æ&ö÷BÇ¶öæ6S§G'VWÒ“°¢ÖVÇ6W°¢&ö÷B‚“°¢Ð§Ò’‚“°  ¢ò¢'VæFÆVB6÷W&6S¢§2ór×7FvR×cc×G&–æ–ær×&VæFW"ÖwV&Bæ§2¢ð¢†gVæ7F–öâ‚—°¢'W6R7G&–7B#°§v–æF÷rätÔUôäD•dUô4ôäd•$ÔTEô$4TÄ”äSÒ%cSB#°§v–æF÷rätÔUôäD•dUô5U%$TåEõdU%4”ôãÒ%cc#°§v–æF÷rätÔUôäD•dUôÄ5Eõ44õSÒ'G&–æ–ærÖgVÆÂ×6÷W&6RÖVF—B#° ¦6öç7Bcs3CEõ¤ôäUô%C×°¢FW6W'C¢&76WG2öÖ2öFW6W'B×cs3CBçær"À¢–6S¢&76WG2öÖ2ö–6R×cs3CBçær"À¢¦öæSC¢&76WG2öÖ2÷¦öæSB×cs3CBçær"À¢¦öæSS¢&76WG2öÖ2÷¦öæSR×cs3CBçær"À¢¦öæSc¢&76WG2öÖ2÷¦öæSb×cs3CBçær"À¢¦öæSs¢&76WG2öÖ2÷¦öæSr×cs3CBçær"À¢¦öæSƒ¢&76WG2öÖ2÷¦öæS‚×cs3CBçær"À¢¦öæS“¢&76WG2öÖ2÷¦öæS’×cs3CBçær"À¢¦öæS¢&76WG2öÖ2÷¦öæS×cs3CBçær §Ó°§G'—²–b‡G—Vöb¦öæT&6¶w&÷VæD–ÖvW2ÓÒ'VæFVf–æVB"—²ö&¦V7Bæ76–vâ‡¦öæT&6¶w&÷VæD–ÖvW2Åcs3CEõ¤ôäUô%B“²ÒÖ6F6‚…ò—²Ð§G'—²–b‡G—VöbÖ¦öæT&6¶w&÷VæD–ÖvW2ÓÒ'VæFVf–æVB"—²ö&¦V7Bæ76–vâ†Ö¦öæT&6¶w&÷VæD–ÖvW2Åcs3CEõ¤ôäUô%B“²ÒÖ6F6‚…ò—²Ð ¦gVæ7F–öâVæf÷&6UG&–æ–æu&VæFW"‚—°¢6öç7BvSÖFö7VÖVçBævWDVÆVÖVçD'”–B‚'G&–æ–æuvR"“°¢–b‡vR—°¢vRçVW'•6VÆV7F÷$ÆÂ‚"çG&–æ–ær×¦öæRÖ—FVÒ"’æf÷$V6‚†gVæ7F–öâ†VÂ—°¢VÂç7G–ÆRç6WE&÷W'G’‚&föçB×6—¦R"Â##‚"Â&–×÷'FçB"“°¢VÂç7G–ÆRç6WE&÷W'G’‚'FF–ær"Â#g‚G‚"Â&–×÷'FçB"“°¢VÂç7G–ÆRç6WE&÷W'G’‚&Ö–âÖ†V–v‡B"Â#C'‚"Â&–×÷'FçB"“°¢VÂç7G–ÆRç6WE&÷W'G’‚&Æ–æRÖ†V–v‡B"Â#ãR"Â&–×÷'FçB"“°¢VÂç7G–ÆRç6WE&÷W'G’‚&&÷‚×6—¦–ær"Â&&÷&FW"Ö&÷‚"Â&–×÷'FçB"“°¢Ò“°¢Ð ¢ò ¢F†RG&–æ–ær¦öæR–æf÷&ÖF–öâÖöFÂW6VBFò&V6V—fRv–GF‚öÖ‚Ö†V–v‡Bð¢÷fW&fÆ÷r–æÆ–æR7G–ÆW2†W&RâF†÷6RFV6Æ&F–öç2f÷Vv‡BF†R6†&VBT¢6—¦–ærWF†÷&—G’æBÖFRF†Rv†öÆRg&ÖRF†R67&öÆÂ÷væW"âvVöÖWG'’—0¢æ÷r÷væVB'’772ó#×7FvR×cc×G&–æ–ærÖöæÇ’×6fWG’æ773²F†—2'VçF–ÖRwV&@¢–çFVçF–öæÆÇ’F÷V6†W2öæÇ’F†RG&–æ–ær×¦öæRÆ—7B—FV×2&÷fRà¢¢ð§Ð¦–b†Fö7VÖVçBç&VG•7FFSÓÓÒ&ÆöF–ær"—°¢Fö7VÖVçBæFDWfVçDÆ—7FVæW"‚$DôÔ6öçFVçDÆöFVB"ÆVæf÷&6UG&–æ–æu&VæFW"Ç¶öæ6S§G'VWÒ“°§ÖVÇ6W°¢Væf÷&6UG&–æ–æu&VæFW"‚“°§Ð§Ò’‚“°  ¢ò¢'VæFÆVB6÷W&6S¢§2ó‚×7FvR×ccBÖ6†&7FW"×F÷V6‚Ö7F–öâ×'VçF–ÖRæ§2¢ð¢†gVæ7F–öâ‚—°¢'W6R7G&–7B#°¦gVæ7F–öâ6WD6†&7FW%F÷V6„ÖöFR†7F—fR—°¢6öç7B&ö÷CÖFö7VÖVçBæFö7VÖVçDVÆVÖVçC°¢6öç7B&öG“ÖFö7VÖVçBæ&öG“°¢6öç7Bf–Ww÷'CÖFö7VÖVçBævWDVÆVÖVçD'”–B‚&vÖR×f–Ww÷'B"“°¢6öç7B7FvSÖFö7VÖVçBævWDVÆVÖVçD'”–B‚&vÖR×7FvR"“°¢·&ö÷BÆ&öG’Çf–Ww÷'BÇ7FvUÒæf÷$V6‚†gVæ7F–öâ†VÂ—°¢–b‚VÂ—&WGW&ã°¢VÂæ6Æ74Æ—7BçFövvÆR‚&6†&7FW"×67&öÆÂÖ7F—fR"Â7F—fR“°¢Ò“°§Ð¦gVæ7F–öâ7–æ46†&7FW%F÷V6„ÖöFR‚—°¢6öç7BÖöFÃÖFö7VÖVçBævWDVÆVÖVçD'”–B‚&†öÖTfVGW&TÖöFÂ"“°¢6öç7BF'3ÖFö7VÖVçBævWDVÆVÖVçD'”–B‚&6†&7FW%F$6öçFVçB"“°¢6öç7B7F—fSÒ†ÖöFÂbbF'2bbvWD6ö×WFVE7G–ÆR†ÖöFÂ’æF—7Æ’ÓÒ&æöæR"bbÖöFÂæ6Æ74Æ—7Bæ6öçF–ç2‚'6†÷r"’“°¢6WD6†&7FW%F÷V6„ÖöFR†7F—fR“°§Ð¦–b†Fö7VÖVçBç&VG•7FFSÓÓÒ&ÆöF–ær"–Fö7VÖVçBæFDWfVçDÆ—7FVæW"‚$DôÔ6öçFVçDÆöFVB"Ç7–æ46†&7FW%F÷V6„ÖöFRÇ¶öæ6S§G'VWÒ“°¦VÇ6R7–æ46†&7FW%F÷V6„ÖöFR‚“°¦6öç7Bö'6W'fW#ÖæWr×WFF–öäö'6W'fW"‡7–æ46†&7FW%F÷V6„ÖöFR“°¦ö'6W'fW"æö'6W'fR†Fö7VÖVçBæ&öG’Ç·7V'G&VS§G'VRÆ6†–ÆDÆ—7C§G'VRÆGG&–'WFW3§G'VRÆGG&–'WFTf–ÇFW#¥²&6Æ72"Â'7G–ÆR%×Ò“°§v–æF÷rç7–æ46†&7FW%F÷V6„ÖöFS×7–æ46†&7FW%F÷V6„ÖöFS°§Ò’‚“°  ¢ò¢'VæFÆVB6÷W&6S¢§2ó’×7FvR×cs‚Ö6†&7FW"Ö–çfVçF÷'’×'VçF–ÖRæ§2¢ð¢†gVæ7F–öâ‚—°¢'W6R7G&–7B#° ¦ÆWB&d–CÓ° ¦gVæ7F–öâvWE7FvU66ÆR‚—°¢6öç7B7FvSÐ¢Fö7VÖVçBævWDVÆVÖVçD'”–B€¢&vÖR×7FvR ¢“° ¢–b‚7FvR—°¢&WGW&â°¢Ð ¢6öç7B&V7CÐ¢7FvRævWD&÷VæF–æt6Æ–VçE&V7B‚“° ¢6öç7B66ÆSÐ¢&V7Bçv–GF‚óƒ° ¢&WGW&â€¢çVÖ&W"æ—4f–æ—FR‡66ÆR’b`¢66ÆSã ¢¢ò66ÆP¢¢°§Ð ¦gVæ7F–öâ&VÆV6T6†&7FW$Æ–÷WD÷væW'6†—†ÖöFÂÆ&öG’Ç&ö÷BÆ–çfVçF÷'’Æf÷&6R—°¢–b€¢ÖöFÂÇÀ¢‚f÷&6RbbÖöFÂæFF6WBçcs„6†&7FW$Æ–÷WD7F—fRÓÒ#"¢—°¢&WGW&ã°¢Ð ¢6öç7B&÷ƒÖÖöFÂçVW'•6VÆV7F÷"‚"æ†öÖRÖfVGW&RÖÖöFÂÖ&÷‚çv–FR"“°¢–b†&÷‚—°¢°¢&F—7Æ’"Â&fÆW‚ÖF—&V7F–öâ"Â'v–GF‚"Â&Ö‚×v–GF‚"Â&†V–v‡B"À¢&Ö‚Ö†V–v‡B"Â&Ö–âÖ†V–v‡B"Â&÷fW&fÆ÷r ¢Òæf÷$V6‚‡&÷W'G“Óæ&÷‚ç7G–ÆRç&VÖ÷fU&÷W'G’‡&÷W'G’’“°¢Ð ¢–b†&öG’—°¢°¢&F—7Æ’"Â&fÆW‚ÖF—&V7F–öâ"Â&fÆW‚"Â&†V–v‡B"Â&Ö–âÖ†V–v‡B"Â&÷fW&fÆ÷r ¢Òæf÷$V6‚‡&÷W'G“Óæ&öG’ç7G–ÆRç&VÖ÷fU&÷W'G’‡&÷W'G’’“°¢Ð ¢–b‡&ö÷B—°¢°¢&fÆW‚"Â&†V–v‡B"Â&Ö‚Ö†V–v‡B"Â&Ö–âÖ†V–v‡B"Â&÷fW&fÆ÷r×’"Â&÷fW&fÆ÷r×‚"À¢"×vV&¶—BÖ÷fW&fÆ÷r×67&öÆÆ–ær"Â&÷fW'67&öÆÂÖ&V†f–÷"×’"Â'F÷V6‚Ö7F–öâ"À¢'67&öÆÆ&"ÖwWGFW" ¢Òæf÷$V6‚‡&÷W'G“Óç&ö÷Bç7G–ÆRç&VÖ÷fU&÷W'G’‡&÷W'G’’“°¢Ð ¢–b†–çfVçF÷'’—°¢²&÷fW&fÆ÷r"Â'G&ç6f÷&Ò%Òæf÷$V6‚‡&÷W'G“Óæ–çfVçF÷'’ç7G–ÆRç&VÖ÷fU&÷W'G’‡&÷W'G’’“°¢Ð ¢FVÆWFRÖöFÂæFF6WBçcs„6†&7FW$Æ–÷WD7F—fS°§Ð ¦gVæ7F–öâÇ”æ÷r‚—°¢6öç7BÖöFÃÐ¢Fö7VÖVçBævWDVÆVÖVçD'”–B€¢&†öÖTfVGW&TÖöFÂ ¢“° ¢6öç7B&öG“Ð¢Fö7VÖVçBævWDVÆVÖVçD'”–B€¢&†öÖTfVGW&TÖöFÄ&öG’ ¢“° ¢6öç7B&ö÷CÐ¢Fö7VÖVçBævWDVÆVÖVçD'”–B€¢&6†&7FW%F$6öçFVçB ¢“° ¢6öç7B–çfVçF÷'“Ð¢Fö7VÖVçBævWDVÆVÖVçD'”–B€¢&–çfVçF÷'•vR ¢“° ¢–b€¢ÖöFÂÇÀ¢&öG’ÇÀ¢ÖöFÂæ6Æ74Æ—7Bæ6öçF–ç2‚'6†÷r"¢—°¢&WGW&ã°¢Ð ¢ò ¢FVÒ&VÆ–2÷vç2F†R6†&VBÖöFÂ&öG’2—G2fW'F–6Â67&öÆÂ6öçF–æW"à¢—G26Æ726â&RÆ–VB&Vf÷&R66†&7FW%F$6öçFVçB—2‡—6–6ÆÇ¢&WÆ6VBÂ6ò6öçF–æÖVçBÆöæR—2æ÷B7Vff–6–VçB÷væW'6†—FW7Bà¢&VÆ–çV—6‚F†R6†&7FW"Æ–÷WB7–æ6‡&öæ÷W6Ç’26ööâ2F†R&VÆ–2ÖöFÀ¢6Æ72V'3²f÷&6RÇ6ò6ÆV'2ç’7FÆR–æÆ–æR–×÷'FçB7G–ÆW2ÆVg@¢'’âöÆFW"6†&7FW"f–WrWfVâ–bF†RFF6WBÖ&¶W"v2Æ÷7Bà¢¢ð¢6öç7B&VÆ–4÷vç56†&VDÖöFÃÐ¢ÖöFÂæ6Æ74Æ—7Bæ6öçF–ç2‚'FVÒ×&VÆ–2ÖÖöFÂ"’ÇÀ¢ÖöFÂæ6Æ74Æ—7Bæ6öçF–ç2‚'FVÒ×&VÆ–2ÖÖöFR"“° ¢–b‡&VÆ–4÷vç56†&VDÖöFÂ—°¢&VÆV6T6†&7FW$Æ–÷WD÷væW'6†—€¢ÖöFÂÀ¢&öG’À¢&ö÷BÀ¢–çfVçF÷'’À¢G'VP¢“°¢&WGW&ã°¢Ð ¢ò ¢F†—2÷væW"—2öæÇ’fÆ–Bv†–ÆRF†R6†&7FW"÷7FGW2÷6¶–ÆÂö–çfVçF÷'¢6†VÆÂ—27GVÆÇ’Ö÷VçFVB–ç6–FRF†R6†&VBÖöFÂ&öG’âF†R6ÖRÖöFÀ¢—2&WW6VB'’6†÷ÂVW7G2Â7–çF†W6—2æBFVÒ&VÆ–2â&Wf–÷W6Ç’F†—0¢gVæ7F–öâ¶WBw&—F–ær–æÆ–æR–×÷'FçB÷fW&fÆ÷s¦†–FFVâFòF†R6†&V@¢&öG’WfVâgFW"æ÷F†W"fVGW&RFöö²÷væW'6†—Âv†–6‚6÷VÆB÷fW'&–FP¢FVÒ&VÆ–2w2ÆVv—F–ÖFR÷fW&fÆ÷r×“¦WFòæB&öGV6R–çFW&Ö—GFVçBÖö&–ÆP¢67&öÆÆ–ærFWVæF–æröâ×WFF–öäö'6W'fW"F–Ö–ærà ¢F†R&ö÷B6â&R6ö×ÆWFVÇ’&VÖ÷fVBv†Vâæ÷F†W"fVGW&R&WÆ6W2F†P¢ÖöFÂ&öG’Â6ò&VÆV6R×W7BÇ6ò'Vâv†Vâ66†&7FW%F$6öçFVçBæòÆöævW ¢W†—7G2BÆÃ²&WGW&æ–ærV&Ç’öâ&ö÷Bv÷VÆBÆVfRF†R7FÆR–æÆ–æP¢7G–ÆW2&V†–æB–æFVf–æ—FVÇ’âDôÒFW7BF÷V&ÆW2W6VB'’F†R&W÷6—F÷'’Fð¢æ÷BÆÂ–×ÆVÖVçBVÆVÖVçBæ6öçF–ç2‚’Â6òF†R&VÂ6öçF–æÖVçB6†V6²—0¢W6VBv†Vâf–Æ&ÆRæB÷F†W'v—6RfÆÇ2&6²FòF†R†—7F÷&–6ÂÖ÷VçFV@¢77V×F–öâf÷"F†÷6R—6öÆFVBf—‡GW&W2à¢¢ð¢6öç7B6†&7FW%&ö÷DÖ÷VçFVCÒ&ö÷Bbb€¢G—Vöb&öG’æ6öçF–ç3ÓÓÒ&gVæ7F–öâ ¢ö&öG’æ6öçF–ç2‡&ö÷B¢§G'VP¢“°¢–b‚6†&7FW%&ö÷DÖ÷VçFVB—°¢&VÆV6T6†&7FW$Æ–÷WD÷væW'6†—†ÖöFÂÆ&öG’Ç&ö÷BÆ–çfVçF÷'’“°¢&WGW&ã°¢Ð ¢6öç7B&÷ƒÐ¢ÖöFÂçVW'•6VÆV7F÷"€¢"æ†öÖRÖfVGW&RÖÖöFÂÖ&÷‚çv–FR ¢“° ¢–b‚&÷‚—°¢&WGW&ã°¢Ð ¢ÖöFÂæFF6WBçcs„6†&7FW$Æ–÷WD7F—fSÒ##° ¢&÷‚ç7G–ÆRç6WE&÷W'G’€¢&F—7Æ’"À¢&fÆW‚"À¢&–×÷'FçB ¢“° ¢&÷‚ç7G–ÆRç6WE&÷W'G’€¢&fÆW‚ÖF—&V7F–öâ"À¢&6öÇVÖâ"À¢&–×÷'FçB ¢“° ¢ò ¢cs2ãc2f—6–&ÆRÖÆ–÷WBWF†÷&—G“ ¢6†&7FW"÷7FGW2÷6¶–ÆÂö–çfVçF÷'’6†&RF†RÖ†–×VÒÖö&–ÆR6çf2à¢F†Rf÷&ÖW"3“b9rc#–æÆ–æRÆ&vRæVÂfÇVW2÷fW'&öFRF†Rcs2ãc ¢7G–ÆW6†VWBÂ6òF†R67&VVâæWfW"7GVÆÇ’W‡æFVBöâ†öæW2â¶VWöæP¢f—†VB÷WFW"g&ÖR†W&RæBÆWBöæÇ’F†R–ææW"F"6öçFVçB67&öÆÂà¢¢ð¢&÷‚ç7G–ÆRç6WE&÷W'G’€¢'v–GF‚"À¢&6Æ2ƒRÒ‡‚’"À¢&–×÷'FçB ¢“° ¢&÷‚ç7G–ÆRç6WE&÷W'G’€¢&Ö‚×v–GF‚"À¢&æöæR"À¢&–×÷'FçB ¢“° ¢&÷‚ç7G–ÆRç6WE&÷W'G’€¢&†V–v‡B"À¢&6Æ2ƒRÒ‡‚’"À¢&–×÷'FçB ¢“° ¢&÷‚ç7G–ÆRç6WE&÷W'G’€¢&Ö‚Ö†V–v‡B"À¢&6Æ2ƒRÒ‡‚’"À¢&–×÷'FçB ¢“° ¢&÷‚ç7G–ÆRç6WE&÷W'G’€¢&Ö–âÖ†V–v‡B"À¢#"À¢&–×÷'FçB ¢“° ¢&÷‚ç7G–ÆRç6WE&÷W'G’€¢&÷fW&fÆ÷r"À¢&†–FFVâ"À¢&–×÷'FçB ¢“° ¢&öG’ç7G–ÆRç6WE&÷W'G’€¢&F—7Æ’"À¢&fÆW‚"À¢&–×÷'FçB ¢“° ¢&öG’ç7G–ÆRç6WE&÷W'G’€¢&fÆW‚ÖF—&V7F–öâ"À¢&6öÇVÖâ"À¢&–×÷'FçB ¢“° ¢&öG’ç7G–ÆRç6WE&÷W'G’€¢&fÆW‚"À¢#WFò"À¢&–×÷'FçB ¢“° ¢&öG’ç7G–ÆRç6WE&÷W'G’€¢&†V–v‡B"À¢&WFò"À¢&–×÷'FçB ¢“° ¢&öG’ç7G–ÆRç6WE&÷W'G’€¢&Ö–âÖ†V–v‡B"À¢#"À¢&–×÷'FçB ¢“° ¢&öG’ç7G–ÆRç6WE&÷W'G’€¢&÷fW&fÆ÷r"À¢&†–FFVâ"À¢&–×÷'FçB ¢“° ¢&ö÷Bç7G–ÆRç6WE&÷W'G’€¢&fÆW‚"À¢#WFò"À¢&–×÷'FçB ¢“° ¢&ö÷Bç7G–ÆRç6WE&÷W'G’€¢&†V–v‡B"À¢&WFò"À¢&–×÷'FçB ¢“° ¢&ö÷Bç7G–ÆRç6WE&÷W'G’€¢&Ö‚Ö†V–v‡B"À¢&æöæR"À¢&–×÷'FçB ¢“° ¢&ö÷Bç7G–ÆRç6WE&÷W'G’€¢&Ö–âÖ†V–v‡B"À¢#"À¢&–×÷'FçB ¢“° ¢6öç7B–çfVçF÷'”÷vç567&öÆÃÐ¢€¢–çfVçF÷'’b`¢–çfVçF÷'’ç&VçDVÆVÖVçCÓÓ×&ö÷@¢“° ¢&ö÷Bç7G–ÆRç6WE&÷W'G’€¢&÷fW&fÆ÷r×’"À¢–çfVçF÷'”÷vç567&öÆÀ¢ò&†–FFVâ ¢¢'67&öÆÂ"À¢&–×÷'FçB ¢“° ¢&ö÷Bç7G–ÆRç6WE&÷W'G’€¢&÷fW&fÆ÷r×‚"À¢&†–FFVâ"À¢&–×÷'FçB ¢“° ¢&ö÷Bç7G–ÆRç6WE&÷W'G’€¢"×vV&¶—BÖ÷fW&fÆ÷r×67&öÆÆ–ær"À¢'F÷V6‚"À¢&–×÷'FçB ¢“° ¢&ö÷Bç7G–ÆRç6WE&÷W'G’€¢&÷fW'67&öÆÂÖ&V†f–÷"×’"À¢&6öçF–â"À¢&–×÷'FçB ¢“° ¢&ö÷Bç7G–ÆRç6WE&÷W'G’€¢'F÷V6‚Ö7F–öâ"À¢'â×’"À¢&–×÷'FçB ¢“° ¢&ö÷Bç7G–ÆRç6WE&÷W'G’€¢'67&öÆÆ&"ÖwWGFW""À¢'7F&ÆR"À¢&–×÷'FçB ¢“° ¢–b†–çfVçF÷'”÷vç567&öÆÂ—°¢–çfVçF÷'’ç7G–ÆRç6WE&÷W'G’€¢&÷fW&fÆ÷r"À¢'f—6–&ÆR"À¢&–×÷'FçB ¢“° ¢–çfVçF÷'’ç7G–ÆRç6WE&÷W'G’€¢'G&ç6f÷&Ò"À¢&æöæR"À¢&–×÷'FçB ¢“° ¢ò ¢csry¨Bó2XhÞ{Šî[òó>ûÉ ¢ó29r"ó2Ò"ó’XúþŠinš¹Ž[ªn8 ¢¢ð¢6öç7B7FvT†V–v‡CÐ¢ÖF‚æÖ‚€¢ƒÀ¢ÖF‚æÖ–â€¢3À¢ÖF‚ç&÷VæB€¢ÖF‚æÖ‚€¢ƒÀ¢&ö÷Bæ6Æ–VçD†V–v‡@¢’ ¢"ó¢¢¢“° ¢–çfVçF÷'’ç7G–ÆRç6WE&÷W'G’€¢"ÒÖ–çfVçF÷'’×7FvRÖ†V–v‡B"À¢7FvT†V–v‡B²'‚ ¢“°¢Ð§Ð ¦gVæ7F–öâ66†VGVÆR‚—°¢–b‡&d–B—°¢6æ6VÄæ–ÖF–öäg&ÖR€¢&d–@¢“°¢Ð ¢&d–CÐ¢&WVW7Dæ–ÖF–öäg&ÖR€¢gVæ7F–öâ‚—°¢&d–CÓ°¢Ç”æ÷r‚“°¢Ð¢“°§Ð ¢ò¢ÆFRfVGW&R'VçF–ÖW2&R&öGV7F–öâ'VæFÆW2÷væVB'’f÷W%7–Ö&öÇ4fVGW&W2â¢ð ¦–b€¢Fö7VÖVçBç&VG•7FFSÓÓÐ¢&ÆöF–ær ¢—°¢Fö7VÖVçBæFDWfVçDÆ—7FVæW"€¢$DôÔ6öçFVçDÆöFVB"À¢gVæ7F–öâ‚—°¢66†VGVÆR‚“°¢ÒÀ¢¶öæ6S§G'VWÐ¢“°§Ð¦VÇ6W°¢66†VGVÆR‚“°§Ð ¦6öç7Bö'6W'fW#Ð¢æWr×WFF–öäö'6W'fW"€¢66†VGVÆP¢“° ¦ö'6W'fW"æö'6W'fR€¢Fö7VÖVçBæ&öG’À¢°¢6†–ÆDÆ—7C§G'VRÀ¢7V'G&VS§G'VRÀ¢GG&–'WFW3§G'VRÀ¢GG&–'WFTf–ÇFW#¥²&6Æ72%Ð¢Ð¢“° ¦Fö7VÖVçBæFDWfVçDÆ—7FVæW"€¢&6Æ–6²"À¢66†VGVÆRÀ¢·76—fS§G'VWÐ¢“° §v–æF÷ræFDWfVçDÆ—7FVæW"€¢'&W6—¦R"À¢66†VGVÆRÀ¢·76—fS§G'VWÐ¢“° §v–æF÷rçcs„Ç”6†&7FW$–çfVçF÷'”Æ–÷WCÐ¢66†VGVÆS°§Ò’‚“°  ¢ò¢'VæFÆVB6÷W&6S¢§2ó#2×c#RÖ6†&7FW"Ö7&VF–öâÖ&ö÷G7G&æ§2¢ð¢ò¢ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÐ¢csB(	B$RÕ”åB4„$5DU"5$TD”ôâ$ôõE5E$²4dRuT$@¢F†R7&VF–öâvR7F'G2–ç6–FR6f÷"ÆVv7’…DÔÂ6ö×F–&–Æ—G’à ¢”Õõ%DåC ¢ÒF†—2&ö÷G7G&öæÇ’&W&W2F†RDôÒÆö6F–öââ—BæWfW"FV6–FW2F†@¢6†&7FW"7&VF–öâ—27F—fR&Vf÷&RW'6—7FVBFF†2&VVâ&W7F÷&VBà¢Òf–ÂÖ6Æ÷6VB&–Ö'’Ö6†&7FW"wV&B&WfVçG2â66–FVçFÂ7&VF–öà¢67&VVâgFW"&VÆöBg&öÒ÷fW'w&—F–ærâW†—7F–ær6fVB6Æ÷BÓ6†&7FW"à£ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÒ¢ð¢†gVæ7F–öâ&ö÷G7G&æF—fT7&VF–öåvR‚—°¢'W6R7G&–7B#° ¢6öç7BvSÖFö7VÖVçBævWDVÆVÖVçD'”–B‚&7&VF–öåvR"“°¢6öç7B÷fW&Æ“ÖFö7VÖVçBævWDVÆVÖVçD'”–B‚&vÖRÖ÷fW&Æ’ÖÆ–W""“° ¢–b‡vRbf÷fW&Æ’bgvRç&VçDVÆVÖVçBÓÖ÷fW&Æ’—°¢÷fW&Æ’æVæD6†–ÆB‡vR“°¢Ð¢–b‡vR—°¢vRæFF6WBææF—fU&W–çCÒ'csBÖFöÒÖöæÇ’#°¢Ð ¢gVæ7F–öâÆöD7&—F–6ÅV•7G–ÆR‚—°¢ò¢&öGV7F–öâ×6†VÆÂ552÷vç2F†—27G–ÆS²æò'VçF–ÖR7G–ÆW6†VWB&WVW7Bâ¢ð¢&WGW&âG'VS°¢Ð ¢gVæ7F–öâ&–Ö'•7FFR‡7FFRÇ&–Ö'’Ç&V6öâ—°¢&WGW&â·7FFRÇ&–Ö'“§&–Ö'—ÇÆçVÆÂÇ&V6öã§&V6öçÇÂ"'Ó°¢Ð ¢gVæ7F–öâ&VEW'6—7FVE&–Ö'”6†&7FW"‚—°¢ÆWB&sÒ"#°¢G'—°¢6öç7B&W÷6—F÷'“×v–æF÷räf÷W%7–Ö&öÇ466÷VçE6fS°¢6öç7B7F—fS×&W÷6—F÷'’bg&W÷6—F÷'’ç&VD7F—fR‚“°¢–b‚7F—fWÇÆ7F—fRç7FGW3ÓÓÒ&–æ7F—fR"—²&WGW&â&–Ö'•7FFR‚'Vç6fR"ÆçVÆÂÂ&66÷VçB×Vç&W6öÇfVB"“²Ð¢–b†7F—fRç7FGW3ÓÓÒ&V×G’"—²&WGW&â&–Ö'•7FFR‚&V×G’"ÆçVÆÂÂ&æòÖ66÷VçB×6fR"“²Ð¢&sÔ¥4ôâç7G&–æv–g’†7F—fRç6fR“°¢Ö6F6‚…ò—°¢ò¢7F÷&vR&V–ærVç&VF&ÆR×W7BæWfW"GW&â–çFòW&Ö—76–öâFð¢÷fW'w&—FR6†&7FW"FFâF†—2—2–çFVçF–öæÆÇ’f–ÂÖ6Æ÷6VBâ¢ð¢&WGW&â&–Ö'•7FFR‚'Vç6fR"ÆçVÆÂÂ'7F÷&vR×Vç&VF&ÆR"“°¢Ð ¢–b‚&r—°¢&WGW&â&–Ö'•7FFR‚&V×G’"ÆçVÆÂÂ&æò×6fR"“°¢Ð ¢ÆWB6fVCÖçVÆÃ°¢G'—°¢6fVCÔ¥4ôâç'6R‡&r“°¢Ö6F6‚…ò—°¢&WGW&â&–Ö'•7FFR‚'Vç6fR"ÆçVÆÂÂ'6fRÖ§6öâÖ–çfÆ–B"“°¢Ð ¢–b‚6fVGÇÇG—Vöb6fVBÓÒ&ö&¦V7B'ÇÄ'&’æ—4'&’‡6fVB’—°¢&WGW&â&–Ö'•7FFR‚'Vç6fR"ÆçVÆÂÂ'6fR×6†RÖ–çfÆ–B"“°¢Ð ¢6öç7B&–Ö'“×6fVBçÆ–W#°¢–b‡&–Ö'“ÓÓ×VæFVf–æVGÇÇ&–Ö'“ÓÓÖçVÆÂ—°¢ò¢âV×G’ö&¦V7B—2fÆ–B&RÖ6†&7FW"7FFR–â†—7F÷&–6À¢7F'GW÷FW7BfÆ÷w2â¢ð¢&WGW&â&–Ö'•7FFR‚&V×G’"ÆçVÆÂÂ&æò×&–Ö'’"“°¢Ð¢–b‡G—Vöb&–Ö'’ÓÒ&ö&¦V7B'ÇÄ'&’æ—4'&’‡&–Ö'’’—°¢&WGW&â&–Ö'•7FFR‚'Vç6fR"ÆçVÆÂÂ'&–Ö'’×6†RÖ–çfÆ–B"“°¢Ð ¢ò¢6†&7FW"”B—2F†R6æöæ–6Â7&VF–öâ–FVçF—G’âöæ6R—BW†—7G2À¢6Æ÷B—2ö67W–VB&Vv&FÆW72öbv†WF†W"æ÷F†W"f–VÆB†f÷"W†×ÆP¢ÆWfVÂ’†2&V6öÖRÖÆf÷&ÖVBâæWfW"&WV—&RÆWfVÂFò&R†VÇF‡’–à¢÷&FW"Fò&÷FV7BâW†—7F–ær6†&7FW"â¢ð¢6öç7B–CÕ7G&–ær‡&–Ö'’æ–GÇÂ""’çG&–Ò‚“°¢–b†–B—°¢&WGW&â&–Ö'•7FFR‚&ö67W–VB"Ç&–Ö'’Â'&–Ö'’Ö–B×&W6VçB"“°¢Ð ¢ò¢F†R6æöæ–6ÂVæ7&VFVBFV×ÆFR—2–C¢""ÂÆWfVÃ£ÂW‡£à¢–b–FVçF—G’—2Ö—76–ær'WB&öw&W72÷6V6öæF'’Ö6†&7FW"Wf–FVæ6R—0¢&W6VçBÂG&VBF†R6fR2Vç6fR–ç7FVBöb77VÖ–ærF†R6Æ÷B—0¢g&VRâF†—2&WfVçG2'F–ÆÇ’FÖvVB6fRg&öÒ&V–ær÷fW'w&—GFVââ¢ð¢6öç7BÆWfVÃÔçVÖ&W"‡&–Ö'’æÆWfVÂ“°¢6öç7BW‡ÔçVÖ&W"‡&–Ö'’æW‡“°¢6öç7B&öw&W76VCÒ„çVÖ&W"æ—4f–æ—FR†ÆWfVÂ’bfÆWfVÃã—ÇÂ„çVÖ&W"æ—4f–æ—FR†W‡’bfW‡ã“°¢6öç7B†56V6öæF'“Ò€¢6fVBçÆ–W#"bgG—Vöb6fVBçÆ–W##ÓÓÒ&ö&¦V7B"be7G&–ær‡6fVBçÆ–W#"æ–GÇÂ""’çG&–Ò‚¢—ÇÂ€¢6fVBçÆ–W#2bgG—Vöb6fVBçÆ–W#3ÓÓÒ&ö&¦V7B"be7G&–ær‡6fVBçÆ–W#2æ–GÇÂ""’çG&–Ò‚¢“° ¢–b‡&öw&W76VGÇÆ†56V6öæF'’—°¢&WGW&â&–Ö'•7FFR‚'Vç6fR"Ç&–Ö'’Â'&–Ö'’Ö–FVçF—G’ÖÖ—76–ær"“°¢Ð ¢&WGW&â&–Ö'•7FFR‚&V×G’"Ç&–Ö'’Â&&Ææ²×&–Ö'’×FV×ÆFR"“°¢Ð ¢gVæ7F–öâ6†÷u&–Ö'•&÷FV7F–öâ‡7FFR—°¢6öç7B&–Ö'“×7FFRbg7FFRç&–Ö'“°¢6öç7B–CÕ7G&–ær‡&–Ö'’bg&–Ö'’æ–GÇÂ""’çG&–Ò‚“°¢6öç7BÆWfVÃÔçVÖ&W"‡&–Ö'’bg&–Ö'’æÆWfVÂ“°¢6öç7Bö67W–VC×7FFRbg7FFRç7FFSÓÓÒ&ö67W–VB#°¢6öç7BÖW76vSÖö67W–V@¢ò‚.X^kŠÎX‹iz.iÈžK‹¾Šy.ˆ›.ZÙŽj©N8Â"¶–B².8Ò"°¢„çVÖ&W"æ—4f–æ—FR†ÆWfVÂ’bfÆWfVÃãÓò$Çbâ"´ÖF‚æfÆö÷"†ÆWfVÂ“¢""’².8.x+®˜þXXÞŠhnZú¾XéþŠy.ˆ›.ûÈÎiÊÎjÊX›^[»®[{.XùnkhŽûÉ¾Š¸¾˜xÞiki[Nyn[èÎ{›Î{¨Î˜®h‹.8""¢¢.X^kŠÎX‹Šy.ˆ›.ZÙŽj©NŠèXùny[[‹Žh‰niz.iÈžŠy.ˆ›.yy^‹z8.x+®˜þXXÞK»¾KÙ^Šy.ˆ›.‹8~iižŠ*¾ŠhnZú¾ûÈÎiÊÎjÊX›^[»®[{.XùnkhŽûÉ¾Š¸¾XXŽ˜xÞiki[NynûÈÎˆº^K¸ÞX{®xûîjÚNŠˆ®hþŠ¸¾KùÞyYžZÙŽj©NKŠnXÎjÚ.[»®z¸¾Šy.ˆ›.8"#°¢–b‡G—Vöbv–æF÷rç'tÆW'CÓÓÒ&gVæ7F–öâ"—°¢fö–Bv–æF÷rç'tÆW'B†ÖW76vRÇ·F—FÆS¢.Šy.ˆ›.ZÙŽj©NKùÞŠÛr"Æ6öæf—&ÕFW‡C¢.yú^˜>K¨b"ÆFævW#§G'VWÒ“°¢ÖVÇ6R–b‡G—Vöbv–æF÷ræÆW'CÓÓÒ&gVæ7F–öâ"—°¢v–æF÷ræÆW'B†ÖW76vR“°¢Ð¢Ð ¢gVæ7F–öâ–ç7FÆÅ&–Ö'”7&VF–öå6fTwV&B‚—°¢6öç7B7W'&VçC×v–æF÷ræ7&VFT6†&7FW#°¢–b‡G—Vöb7W'&VçBÓÒ&gVæ7F–öâ'ÇÆ7W'&VçBåõ÷csEW'6—7FVE&–Ö'”wV&CÓÓ×G'VR—°¢&WGW&ã°¢Ð ¢gVæ7F–öâwV&FVD7&VFT6†&7FW"‚—°¢ÆWBF&vWE6Æ÷CÓ°¢G'—°¢–b‡G—Vöb7&VF–öåF&vWE6Æ÷BÓÒ'VæFVf–æVB"—°¢F&vWE6Æ÷CÔÖF‚æÖ‚ƒÄÖF‚æfÆö÷"„çVÖ&W"†7&VF–öåF&vWE6Æ÷B—ÇÃ’“°¢Ð¢Ö6F6‚…ò—²Ð ¢6öç7BW'6—7FVC×&VEW'6—7FVE&–Ö'”6†&7FW"‚“° ¢ò¢âVç&VF&ÆRö6÷''WB6æöæ–6Â6fR&Æö6·2WfW'’6†&7FW ¢7&VF–öâF‚Â&V6W6R7&VFTFF—F–öæÄ6†&7FW"WfVçGVÆÇ¢6fW2F‡&÷Vv‚F†R6ÖR6æöæ–6Â¶W’â†VÇF‡’ö67W–VB&–Ö'¢&Æö6·2öæÇ’6Æ÷B²6Æ÷B"ó2&VÖ–âÆVv—F–ÖFRFF—F–öç2â¢ð¢–b€¢W'6—7FVBç7FFSÓÓÒ'Vç6fR'ÇÀ¢‡F&vWE6Æ÷CÓÓÓbgW'6—7FVBç7FFSÓÓÒ&ö67W–VB"¢—°¢6†÷u&–Ö'•&÷FV7F–öâ‡W'6—7FVB“°¢&WGW&âfÇ6S°¢Ð ¢&WGW&â7W'&VçBæÇ’‡F†—2Æ&wVÖVçG2“°¢Ð ¢wV&FVD7&VFT6†&7FW"åõ÷csEW'6—7FVE&–Ö'”wV&C×G'VS°¢wV&FVD7&VFT6†&7FW"åõ÷csD÷&–v–æÄ7&VFT6†&7FW#Ö7W'&VçC°¢v–æF÷ræ7&VFT6†&7FW#ÖwV&FVD7&VFT6†&7FW#°¢Ð ¢gVæ7F–öâf–æÆ—¦T&ö÷G7G&‚—°¢–ç7FÆÅ&–Ö'”7&VF–öå6fTwV&B‚“°¢Ð ¢ÆöD7&—F–6ÅV•7G–ÆR‚“° ¢–b†Fö7VÖVçBç&VG•7FFSÓÓÒ&ÆöF–ær"—°¢Fö7VÖVçBæFDWfVçDÆ—7FVæW"‚$DôÔ6öçFVçDÆöFVB"Æf–æÆ—¦T&ö÷G7G&Ç¶öæ6S§G'VWÒ“°¢ÖVÇ6W°¢f–æÆ—¦T&ö÷G7G&‚“°¢Ð§Ò’‚“°  ¢ò¢'VæFÆVB6÷W&6S¢§2ó#B×c#RÖ6†&7FW"Ö7&VF–öâÖæF—fR×'VçF–ÖRæ§2¢ð¢ò¢ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÐ¢c#‚(	Bd•„TBEtòÕ5DUƒ9r“#4„$5DU"5$TD”ôâ%TåD”ÔP¢ÒW6W2F†Rc#‚&R×–çBæF—fR&ö÷G7G&²&W&VçF–ær—2öæÇ’fÆÆ&6°¢ÒW6W2&VÂæF—fR6ö×öæVçBF–ÖVç6–öç2ÂæWfW"Ö–w&F–öâ66ÆP¢ÒvVæFW"ò÷'G&—B7v—F6†–æp¢ÒVÆVÖVçB÷6—F–öæ–ærv—F‚Æ&vW"VÆVÖVçBFW67&—F–öç0¢Òf—†VBæG&ö–B6‡&öÖR6çf2v—F‚æòvR67&öÆÂ÷"–æ6‚¦ööÐ¢ÒGvò×7FW7&VF–öâfÆ÷s²&–Æ—G’ÆÆö6F–öâÆ—fW2öâvRGvð¢W†—7F–ær6öÖ&B÷7FB÷6¶–ÆÂf÷&×VÆ2&Ræ÷B6†ævVBà£ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÒ¢ð¢†gVæ7F–öâ‚—°¢'W6R7G&–7B#° ¢6öç7Bõ%E$•E3×°¢fVÖÆS§°¢f—&S¢&76WG2ö6†&7FW'2öfVÖÆUöf—&Ræ§r"À¢vFW#¢&76WG2ö6†&7FW'2öfVÖÆU÷vFW"æ§r"À¢v–æC¢&76WG2ö6†&7FW'2öfVÖÆU÷v–æBæ§r"À¢V'Fƒ¢&76WG2ö6†&7FW'2öfVÖÆUöV'F‚æ§r ¢ÒÀ¢ÖÆS§°¢f—&S¢&76WG2ö6†&7FW'2öÖÆUöf—&Ræ§r"À¢vFW#¢&76WG2ö6†&7FW'2öÖÆU÷vFW"æ§r"À¢v–æC¢&76WG2ö6†&7FW'2öÖÆU÷v–æBæ§r"À¢V'Fƒ¢&76WG2ö6†&7FW'2öÖÆUöV'F‚æ§r ¢Ð¢Ó° ¢6öç7BÔUD×°¢f—&S§°¢vÇ—ƒ¢.x²"À¢F—FÆS¢.x8ŽxKK˜¾˜2"À¢&öÆS¢.xˆny›Î‹ËŽX{¢+rxˆni8¢+rxx>xy""À¢FW67&—F–öã¢.Kº^š¹Žxˆny›Î8xˆni8®ˆˆ~xx>xy.hÈ{¨ÎX+~Zë>Z9>X‹ni[^K«®ûÈÎxšžynˆˆ~k9^Š>XZžj)Þ‹zþ{y®˜;ÞXþY	K‹¾X¹^˜.iK¾8""À¢Fw3¥².š¹Žxˆny›Â"Â.xˆni8®[Ë~XÉb"Â.xx>xy.X+~Zë2%Ð¢ÒÀ¢vFW#§°¢vÇ—ƒ¢.kB"À¢F—FÆS¢.Zù.kNK˜¾˜2"À¢&öÆS¢.YŽXùnY¹î[ê’+rXk[+rk+¾y˜.[êžkK²"À¢FW67&—F–öã¢.X[ÎX[~{¨ÎˆŠ®8hê~ZNˆˆ~™¨®KÈÞY¹î[êžûÉ¾iK¾i8®h¨ˆ;ÞXúþYŽXùd…ˆˆu5ûÈÎKŠni8iÈžXk[8k+¾y˜.ˆˆ~[êžkK¾ˆ;ÞX©¾8""À¢Fw3¥²$…õ5YŽXùb"Â.Xk[hê~ZB"Â.k+¾y˜.[êžkK²%Ð¢ÒÀ¢v–æC§°¢vÇ—ƒ¢.š*‚"À¢F—FÆS¢.ykîš*ŽK˜¾˜2"À¢&öÆS¢.˜	þ[ªn[›.i;â+rX+~Zë>X˜®[Ë+r™h>˜þhê~ZB"À¢FW67&—F–öã¢.˜þ˜îiXþhÛ~8™h>˜þˆˆ~YN[Èþ[›.i;îhèÎhúh‹šÊ^zøZXþûÈÎXúþ™˜ÞKØîi[^ikžˆ;ÞX©¾8X+~Zë>ˆˆ~YÞKŠÞKŠnikÞXªi¨ŽyÊž8""À¢Fw3¥².iXþhÛ~[›.i;â"Â.™h>˜þ[Ë~XÉb"Â.i¨ŽyÊžûÈþ™˜ÞX+r%Ð¢ÒÀ¢V'Fƒ§°¢vÇ—ƒ¢.YÉò"À¢F—FÆS¢.Xé®YÉþK˜¾˜2"À¢&öÆS¢.ŠÛ~y»î™‹.zjb+r™˜Þ™‹"+ryû>XÉnXøÞX+r"À¢FW67&—F–öã¢.˜xÞŠinyIþZÙŽˆˆ~™¨®KÈÞ™‹.ŠÛ~ûÈÎˆ;Þ[»®z¸¾ŠÛ~y»î8XøÞX+~ˆˆ~{YyXÎûÈÎYÎi˜.Kº^™˜Þ™‹.ˆˆ~yû>XÉnhê~X‹ni[^ikž8""À¢Fw3¥².ŠÛ~y»î™‹.ŠÛr"Â.™˜Þ™‹.yû>XÉb"Â.XøÞX+~{YyXÂ%Ð¢Ð¢Ó° ¢ÆWB6VÆV7FVDvVæFW#Ò&fVÖÆR#°¢ÆWB6VÆV7FVD7&VF–öå7FWÓ° ¢gVæ7F–öâ'”–B†–B—°¢&WGW&âFö7VÖVçBævWDVÆVÖVçD'”–B†–B“°¢Ð ¢gVæ7F–öâÖ–w&FT7&VF–öåvUFôæF—fTÆ–W"‚—°¢6öç7BvSÖ'”–B‚&7&VF–öåvR"“°¢6öç7B÷fW&Æ“Ö'”–B‚&vÖRÖ÷fW&Æ’ÖÆ–W""“°¢–b‚vRÇÂ÷fW&Æ’—·&WGW&âçVÆÃ·Ð ¢–b‡vRç&VçDVÆVÖVçBÓÖ÷fW&Æ’—°¢÷fW&Æ’æVæD6†–ÆB‡vR“°¢Ð ¢vRæ6Æ74Æ—7BæFB‚&æF—fRÖ7&VF–öâ×vR"Â&vÖRÖæF—fR×V’"“°¢vRæFF6WBææF—fUv–GFƒÒ#ƒ#°¢vRæFF6WBææF—fT†V–v‡CÒ#“##°¢vRæFF6WBææF—fTÖ–w&F–öãÒ&7GVÂÖF–ÖVç6–öç2#° ¢°¢&ÆVgB"Â'F÷"Â'&–v‡B"Â&&÷GFöÒ"Â'v–GF‚"Â&†V–v‡B"À¢&Ö–â×v–GF‚"Â&Ö–âÖ†V–v‡B"Â&Ö‚×v–GF‚"Â&Ö‚Ö†V–v‡B"À¢&Ö&v–â"Â'G&ç6f÷&Ò"Â'G&ç6f÷&ÒÖ÷&–v–â ¢Òæf÷$V6‚†gVæ7F–öâ‡&÷W'G’—°¢vRç7G–ÆRç&VÖ÷fU&÷W'G’‡&÷W'G’“°¢Ò“° ¢ò¢F†—2Æ–W"6öçF–ç2–çFW&7F—fRæF—fRT’Â6ò—B6ææ÷B7F¢†–FFVâg&öÒ66W76–&–Æ—G’—2âö–çFW"÷væW'6†—&VÖ–ç2öà¢67&VF–öåvS²F†R÷fW&Æ’—G6VÆb7F–ÆÂW6W2ö–çFW"ÖWfVçG3¦æöæRâ¢ð¢÷fW&Æ’ç&VÖ÷fTGG&–'WFR‚&&–Ö†–FFVâ"“°¢&WGW&âvS°¢Ð ¢gVæ7F–öâ6WD7&VF–öåF÷V6„ÖöFR†7F—fR—°¢6öç7Bf—†VDæöFW3Õ°¢Fö7VÖVçBæFö7VÖVçDVÆVÖVçBÀ¢Fö7VÖVçBæ&öG’À¢'”–B‚&vÖR×f–Ww÷'B"’À¢'”–B‚&vÖR×7FvR"’À¢'”–B‚&vÖRÖ÷fW&Æ’ÖÆ–W""¢Ó° ¢f—†VDæöFW2æf÷$V6‚†gVæ7F–öâ†æöFR—°¢–b†æöFR—°¢æöFRæ6Æ74Æ—7Bç&VÖ÷fR‚&7&VF–öâ×67&öÆÂÖ7F—fR"“°¢æöFRæ6Æ74Æ—7BçFövvÆR‚&7&VF–öâÖf—†VBÖ7F—fR"Â7F—fR“°¢Ð¢Ò“° ¢–b†7F—fR—°¢f—†VDæöFW2æ6öæ6B†'”–B‚&7&VF–öåvR"’’æf÷$V6‚†gVæ7F–öâ†æöFR—°¢–b†æöFR—°¢æöFRç67&öÆÅF÷Ó°¢æöFRç67&öÆÄÆVgCÓ°¢Ð¢Ò“°¢Ð ¢6öç7B7FvSÖ'”–B‚&vÖR×7FvR"“°¢6öç7BÖ'”–B‚&"“° ¢–b‡7FvR—°¢7FvRæ6Æ74Æ—7BçFövvÆR‚&7&VF–öâÖæF—fRÖ7F—fR"Â7F—fR“°¢Ð ¢–b†—°¢æ–æW'CÒ7F—fS°¢–b†7F—fR—°¢ç6WDGG&–'WFR‚&&–Ö†–FFVâ"Â'G'VR"“°¢ÖVÇ6W°¢ç&VÖ÷fTGG&–'WFR‚&&–Ö†–FFVâ"“°¢Ð¢Ð ¢–b†7F—fR—°¢v–æF÷rç67&öÆÅFòƒÃ“°¢Ð¢Ð ¢gVæ7F–öâ7–æ47&VF–öåF÷V6„ÖöFR‚—°¢6öç7BvSÖÖ–w&FT7&VF–öåvUFôæF—fTÆ–W"‚“°¢6öç7Bf—6–&ÆSÒvRbbv–æF÷rævWD6ö×WFVE7G–ÆR‡vR’æF—7Æ’ÓÒ&æöæR#°¢6WD7&VF–öåF÷V6„ÖöFR‡f—6–&ÆR“°¢Ð ¢gVæ7F–öâ–ç7FÆÄ7&VF–öävW7GW&TÆö6²‚—°¢6öç7BvSÖ'”–B‚&7&VF–öåvR"“°¢–b‚vRÇÂvRæFF6WBævW7GW&TÆö6µ&VG“ÓÓÒ'G'VR"—°¢&WGW&ã°¢Ð ¢²'F÷V6†Ö÷fR"Â'v†VVÂ"Â&vW7GW&W7F'B"Â&vW7GW&V6†ævR"Â&vW7GW&VVæB%Òæf÷$V6‚†gVæ7F–öâ†WfVçDæÖR—°¢vRæFDWfVçDÆ—7FVæW"†WfVçDæÖRÆgVæ7F–öâ†WfVçB—°¢WfVçBç&WfVçDFVfVÇB‚“°¢ÒÇ·76—fS¦fÇ6WÒ“°¢Ò“° ¢vRæFF6WBævW7GW&TÆö6µ&VG“Ò'G'VR#°¢Ð ¢gVæ7F–öâÇ”7&VF–öå7FW‡7FW—°¢6öç7BvSÖ'”–B‚&7&VF–öåvR"“°¢6öç7Bæ÷&ÖÆ—¦VCÔçVÖ&W"‡7FW“ÓÓÓ#ó#£°¢6VÆV7FVD7&VF–öå7FWÖæ÷&ÖÆ—¦VC° ¢Fö7VÖVçBçVW'•6VÆV7F÷$ÆÂ‚"67&VF–öåvR¶FFÖ7&VF–öâ×7FWÒ"’æf÷$V6‚†gVæ7F–öâ‡æVÂ—°¢6öç7B7F—fSÔçVÖ&W"‡æVÂæFF6WBæ7&VF–öå7FW“ÓÓÖæ÷&ÖÆ—¦VC°¢æVÂæ6Æ74Æ—7BçFövvÆR‚&—2Ö7F—fR"Æ7F—fR“°¢æVÂæ†–FFVãÒ7F—fS°¢æVÂç6WDGG&–'WFR‚&&–Ö†–FFVâ"Æ7F—fSò&fÇ6R#¢'G'VR"“°¢Ò“° ¢Fö7VÖVçBçVW'•6VÆV7F÷$ÆÂ‚"67&VF–öåvR¶FFÖ7&VF–öâ×7FWÖ–æF–6F÷%Ò"’æf÷$V6‚†gVæ7F–öâ†–æF–6F÷"—°¢6öç7B7F—fSÔçVÖ&W"†–æF–6F÷"æFF6WBæ7&VF–öå7FW–æF–6F÷"“ÓÓÖæ÷&ÖÆ—¦VC°¢–æF–6F÷"æ6Æ74Æ—7BçFövvÆR‚&—2Ö7F—fR"Æ7F—fR“°¢–b†7F—fR—°¢–æF–6F÷"ç6WDGG&–'WFR‚&&–Ö7W'&VçB"Â'7FW"“°¢ÖVÇ6W°¢–æF–6F÷"ç&VÖ÷fTGG&–'WFR‚&&–Ö7W'&VçB"“°¢Ð¢Ò“° ¢–b‡vR—°¢vRæFF6WBç7FWÕ7G&–ær†æ÷&ÖÆ—¦VB“°¢vRç67&öÆÅF÷Ó°¢Ð ¢²&vÖR×f–Ww÷'B"Â&vÖR×7FvR"Â&vÖRÖ÷fW&Æ’ÖÆ–W"%Òæf÷$V6‚†gVæ7F–öâ†–B—°¢6öç7BæöFSÖ'”–B†–B“°¢–b†æöFR—°¢æöFRç67&öÆÅF÷Ó°¢æöFRç67&öÆÄÆVgCÓ°¢Ð¢Ò“° ¢–b†Fö7VÖVçBæ7F—fTVÆVÖVçBbbG—VöbFö7VÖVçBæ7F—fTVÆVÖVçBæ&ÇW#ÓÓÒ&gVæ7F–öâ"—°¢Fö7VÖVçBæ7F—fTVÆVÖVçBæ&ÇW"‚“°¢Ð¢v–æF÷rç67&öÆÅFòƒÃ“°¢Ð ¢v–æF÷rç6WD7&VF–öå7FWÖgVæ7F–öâ‡7FW—°¢Ç”7&VF–öå7FW‡7FW“°¢Ó° ¢gVæ7F–öâ÷&FW&VE6¶–ÆÇ2†VÆVÖVçBÆ6FVv÷'’—°¢–b‡G—Vöb6¶–ÆÄFF&6SÓÓÒ'VæFVf–æVB"—°¢&WGW&âµÓ°¢Ð¢&WGW&âö&¦V7Bæ¶W—2‡6¶–ÆÄFF&6R¢æÖ†gVæ7F–öâ†–B—·&WGW&â6¶–ÆÄFF&6U¶–EÓ·Ò¢æf–ÇFW"†gVæ7F–öâ‡6¶–ÆÂ—°¢&WGW&â6¶–ÆÂbb6¶–ÆÂæVÆVÖVçCÓÓÖVÆVÖVçBbb6¶–ÆÂæ6FVv÷'“ÓÓÖ6FVv÷'“°¢Ò¢ç6÷'B†gVæ7F–öâ†Æ"—°¢&WGW&âçVÖ&W"†çF–W'ÇÃ“’’ÔçVÖ&W"†"çF–W'ÇÃ“’“°¢Ò“°¢Ð ¢gVæ7F–öâ7V6–Å6¶–ÆÇ2†VÆVÖVçB—°¢–b‡G—Vöb6¶–ÆÄFF&6SÓÓÒ'VæFVf–æVB"—°¢&WGW&âµÓ°¢Ð¢6öç7B÷&FW#×¶'Vfc£Æ†VÃ£"Ç&Wf—fS£2Ç76—fS£GÓ°¢&WGW&âö&¦V7Bæ¶W—2‡6¶–ÆÄFF&6R¢æÖ†gVæ7F–öâ†–B—·&WGW&â6¶–ÆÄFF&6U¶–EÓ·Ò¢æf–ÇFW"†gVæ7F–öâ‡6¶–ÆÂ—°¢&WGW&â6¶–ÆÂbb6¶–ÆÂæVÆVÖVçCÓÓÖVÆVÖVçBbb÷&FW%·6¶–ÆÂæ6FVv÷'•Ó°¢Ò¢ç6÷'B†gVæ7F–öâ†Æ"—°¢6öç7B6CÒ†÷&FW%¶æ6FVv÷'•×ÇÃ“’’Ò†÷&FW%¶"æ6FVv÷'•×ÇÃ“’“°¢–b†6BÓÓ—·&WGW&â6C·Ð¢&WGW&âçVÖ&W"†çF–W'ÇÃ“’’ÔçVÖ&W"†"çF–W'ÇÃ“’“°¢Ò“°¢Ð ¢gVæ7F–öâ&VæFW%6¶–ÆÄ6†—2†6öçF–æW$–BÇ6¶–ÆÇ2—°¢6öç7B&÷ƒÖ'”–B†6öçF–æW$–B“°¢–b‚&÷‚—·&WGW&ã·Ð¢&÷‚æ–ææW$…DÔÃÒ"#°¢6¶–ÆÇ2æf÷$V6‚†gVæ7F–öâ‡6¶–ÆÂÆ–æFW‚—°¢6öç7B6†—ÖFö7VÖVçBæ7&VFTVÆVÖVçB‚&'WGFöâ"“°¢6†—çG—SÒ&'WGFöâ#°¢6†—æ6Æ74æÖSÒ&7&VF–öâ×6¶–ÆÂÖ6†—"²†–æFWƒÓÓ×6¶–ÆÇ2æÆVæwF‚Óò"6–væGW&R#¢""“°¢6†—æFF6WBç6¶–ÆÄ–C×6¶–ÆÂæ–C°¢6†—çFW‡D6öçFVçC×6¶–ÆÂææÖS°¢6†—çF—FÆS×6¶–ÆÂæFW67&—F–öçÇÇ6¶–ÆÂææÖS°¢6†—ç6WDGG&–'WFR‚&&–Ö†7÷W"Â&F–Æör"“°¢6†—ç6WDGG&–'WFR‚&&–ÖÆ&VÂ"Ç6¶–ÆÂææÖR².ûÈÎ›¹îi8®iú^yÈ¾Š›>{KK¸¾{K’"“°¢6†—æFDWfVçDÆ—7FVæW"‚&6Æ–6²"ÆgVæ7F–öâ‚—°¢v–æF÷rç6†÷t7&VF–öå6¶–ÆÄFWF–Â‡6¶–ÆÂæ–B“°¢Ò“°¢&÷‚æVæD6†–ÆB†6†—“°¢Ò“°¢Ð ¢gVæ7F–öâW66T…DÔÂ‡fÇVR—°¢&WGW&â7G&–ær‡fÇVSÓÓ×VæFVf–æVGÇÇfÇVSÓÓÖçVÆÃò"#§fÇVR¢ç&WÆ6R‚òbörÂ"f×²"¢ç&WÆ6R‚óÂörÂ"fÇC²"¢ç&WÆ6R‚óâörÂ"fwC²"¢ç&WÆ6R‚ò"örÂ"gV÷C²"¢ç&WÆ6R‚òrörÂ"b33“²"“°¢Ð ¢gVæ7F–öâfÇVTDÆWfVÂ‡fÇVW2ÆÆWfVÂ—°¢–b‚'&’æ—4'&’‡fÇVW2’ÇÂfÇVW2æÆVæwFƒÃ—°¢&WGW&âVæFVf–æVC°¢Ð¢&WGW&âfÇVW5´ÖF‚æÖ–â†ÆWfVÂÓÇfÇVW2æÆVæwF‚Ó•Ó°¢Ð ¢gVæ7F–öâ7&VF–öå6¶–ÆÄ6FVv÷'”Æ&VÂ†6FVv÷'’—°¢G'—°¢–b‡G—VöbvWE6¶–ÆÄ6FVv÷'”Æ&VÃÓÓÒ&gVæ7F–öâ"—°¢&WGW&âvWE6¶–ÆÄ6FVv÷'”Æ&VÂ†6FVv÷'’“°¢Ð¢Ö6F6‚†W'&÷"—·Ð ¢6öç7BÆ&VÇ3×°¢‡—6–6Ã¢.xšžyb"À¢Öv–3¢.k9^Š2"À¢'Vfc¢.Z)îy¸¢"À¢†VÃ¢.Y¹î[ê’"À¢&Wf—fS¢.[êžkK²"À¢76—fS¢.Š*¾X¹R ¢Ó°¢&WGW&âÆ&VÇ5¶6FVv÷'•×ÇÂ.h¨ˆ;Ò#°¢Ð ¢gVæ7F–öâ7&VF–öå6¶–ÆÅF&vWDÆ&VÂ‡F&vWEG—R—°¢6öç7BÆ&VÇ3×°¢6–ævÆS¢.Yjîš¹Ni[^K«¢"À¢G&“¢.YÎjš¾hé.iÈZI£>YÞi[^K«¢"À¢&÷s¢.K»¾Kˆi[^ikžjš¾hé""À¢ÆÃ¢.i[^ikžXZŽš¹B"À¢ÆÇ“¢.YjîKˆXø¾ik’"À¢ÆÇ”ÆÃ¢.h‰ikžXZŽš¹B"À¢FVDÆÇ“¢.jÛ¾KªXø¾ik’"À¢æöæS¢.kŽK˜^Š*¾X¹R ¢Ó°¢&WGW&âÆ&VÇ5·F&vWEG—U×ÇÂ.KéÞh¨ˆ;ÞŠhþX˜r#°¢Ð ¢gVæ7F–öâ6¶–ÆÄÆWfVÅ'G2‡6¶–ÆÂÆÆWfVÂ—°¢6öç7B'G3ÕµÓ° ¢–b€¢‡6¶–ÆÂæ6FVv÷'“ÓÓÒ'‡—6–6Â"ÇÂ6¶–ÆÂæ6FVv÷'“ÓÓÒ&Öv–2"’b`¢6¶–ÆÂæ&6TFÖvRÓ×VæFVf–æV@¢—°¢ÆWBFÖvSÔçVÖ&W"‡6¶–ÆÂæ&6TFÖvWÇÃ’´çVÖ&W"‡6¶–ÆÂæFÖvUW$ÆWfVÇÇÃ’¢†ÆWfVÂÓ“°¢G'—°¢–b‡G—VöbvWE6¶–ÆÄFÖvTDÆWfVÃÓÓÒ&gVæ7F–öâ"—°¢FÖvSÖvWE6¶–ÆÄFÖvTDÆWfVÂ‡6¶–ÆÂÆÆWfVÂ“°¢Ð¢Ö6F6‚†W'&÷"—·Ð ¢'G2çW6‚€¢.X+~Zë2"´ÖF‚æfÆö÷"†FÖvR’°¢‡6¶–ÆÂæFÖvUW$ÆWfVÂò.ûÈŽjøþ{I¢²"·6¶–ÆÂæFÖvUW$ÆWfVÂ².ûÈ’"¢""¢“°¢Ð ¢6öç7B'W&åW&6VçC×fÇVTDÆWfVÂ‡6¶–ÆÂæ'W&åW&6VçD'”ÆWfVÂÆÆWfVÂ“°¢–b‡6¶–ÆÂæ'W&ä6†æ6RÓ×VæFVf–æVBbb'W&åW&6VçBÓ×VæFVf–æVB—°¢'G2çW6‚€¢6¶–ÆÂæ'W&ä6†æ6R²"^j™þxè~xx>xy""°¢‡6¶–ÆÂæ'W&äGW&F–öçÇÃ"’².Y¹îYŽûÈÎjøþY¹îYŽ˜
h‰iÈZJt…"°¢'W&åW&6VçB²"^X+~Zë2 ¢“°¢Ð ¢–b‡6¶–ÆÂæg&VW¦T6†æ6RÓ×VæFVf–æVB—°¢'G2çW6‚€¢6¶–ÆÂæg&VW¦T6†æ6R²"^j™þxè~Xk["°¢‡6¶–ÆÂæg&VW¦TGW&F–öçÇÃ’².Y¹îY‚ ¢“°¢Ð ¢6öç7BÆ–fW7FVÃ×fÇVTDÆWfVÂ‡6¶–ÆÂæÆ–fW7FVÅW&6VçD'”ÆWfVÂÆÆWfVÂ“°¢–b†Æ–fW7FVÂÓ×VæFVf–æVB—°¢'G2çW6‚‚.YŽXùnX+~Zë2"¶Æ–fW7FVÂ²"^ûÈÎzØž˜xþY¹î[êžˆz®‹ª´…ˆˆu5"“°¢Ð ¢6öç7Bv–Æ—G”F÷vã×fÇVTDÆWfVÂ‡6¶–ÆÂæv–Æ—G”F÷vä'”ÆWfVÂÆÆWfVÂ“°¢–b†v–Æ—G”F÷vâÓ×VæFVf–æVB—°¢'G2çW6‚€¢6¶–ÆÂæv–Æ—G”F÷vä6†æ6R²"^j™þxè~™˜ÞKØîiXþhÛr"°¢v–Æ—G”F÷vâ²"^ûÈÎhÈ{¨Â"²‡6¶–ÆÂæv–Æ—G”F÷väGW&F–öçÇÃ"’².Y¹îY‚ ¢“°¢Ð ¢6öç7B7FDF÷vã×fÇVTDÆWfVÂ‡6¶–ÆÂç7FDF÷vä'”ÆWfVÂÆÆWfVÂ“°¢–b‡7FDF÷vâÓ×VæFVf–æVB—°¢'G2çW6‚€¢6¶–ÆÂç7FDF÷vä6†æ6R²"^j™þxè~™˜ÞKØîh˜iÈžˆ;ÞX©²"°¢7FDF÷vâ²"^ûÈÎhÈ{¨Â"²‡6¶–ÆÂç7FDF÷väGW&F–öçÇÃ"’².Y¹îY‚ ¢“°¢Ð ¢6öç7BFÖvTF÷vã×fÇVTDÆWfVÂ‡6¶–ÆÂæFÖvTF÷vä'”ÆWfVÂÆÆWfVÂ“°¢–b†FÖvTF÷vâÓ×VæFVf–æVB—°¢'G2çW6‚€¢6¶–ÆÂæFÖvTF÷vä6†æ6R²"^j™þxè~™˜ÞKØî˜
h‰X+~Zë2"°¢FÖvTF÷vâ²"^ûÈÎhÈ{¨Â"²‡6¶–ÆÂæFÖvTF÷väGW&F–öçÇÃ’².Y¹îY‚ ¢“°¢Ð ¢6öç7BFVfVç6TF÷vã×fÇVTDÆWfVÂ‡6¶–ÆÂæFVfVç6TF÷vä'”ÆWfVÂÆÆWfVÂ“°¢–b†FVfVç6TF÷vâÓ×VæFVf–æVB—°¢'G2çW6‚€¢6¶–ÆÂæFVfVç6TF÷vä6†æ6R²"^j™þxè~™˜ÞKØî™‹.zjb"°¢FVfVç6TF÷vâ²"^ûÈÎhÈ{¨Â"²‡6¶–ÆÂæFVfVç6TF÷väGW&F–öçÇÃ"’².Y¹îY‚ ¢“°¢Ð ¢6öç7BÖ—74&öçW3×fÇVTDÆWfVÂ‡6¶–ÆÂæÖ—74&öçW4'”ÆWfVÂÆÆWfVÂ“°¢–b†Ö—74&öçW2Ó×VæFVf–æVB—°¢'G2çW6‚€¢6¶–ÆÂç7GVä6†æ6R²"^j™þxè~i¨ŽyÊ’"°¢‡6¶–ÆÂç7GVäGW&F–öçÇÃ"’².Y¹îYŽûÈÄÔ•5>xè~hùš¹‚"¶Ö—74&öçW2²"R ¢“°¢Ð ¢6öç7BWG&–g”6†æ6S×fÇVTDÆWfVÂ‡6¶–ÆÂçWG&–g”6†æ6T'”ÆWfVÂÆÆWfVÂ“°¢–b‡WG&–g”6†æ6RÓ×VæFVf–æVB—°¢'G2çW6‚€¢WG&–g”6†æ6R²"^j™þxè~yû>XÉb"°¢‡6¶–ÆÂçWG&–g”GW&F–öçÇÃ"’².Y¹îY‚ ¢“°¢Ð ¢6öç7B6VÆe6†–VÆC×fÇVTDÆWfVÂ‡6¶–ÆÂç6VÆe6†–VÆD'”ÆWfVÂÆÆWfVÂ“°¢–b‡6VÆe6†–VÆBÓ×VæFVf–æVB—°¢'G2çW6‚€¢.ˆz®‹ª¾ŠÛ~y»â"·6VÆe6†–VÆB².›¹îûÈÎhÈ{¨Â"°¢‡6¶–ÆÂç6†–VÆDGW&F–öçÇÃ"’².Y¹îY‚ ¢“°¢Ð ¢6öç7BÆÇ•6†–VÆC×fÇVTDÆWfVÂ‡6¶–ÆÂæÆÇ•6†–VÆD'”ÆWfVÂÆÆWfVÂ“°¢–b†ÆÇ•6†–VÆBÓ×VæFVf–æVB—°¢'G2çW6‚€¢.h‰ikžXZŽš¹NŠÛ~y»â"¶ÆÇ•6†–VÆB².›¹îûÈÎhÈ{¨Â"°¢‡6¶–ÆÂç6†–VÆDGW&F–öçÇÃ"’².Y¹îY‚ ¢“°¢Ð ¢6öç7B7&—D&öçW3×fÇVTDÆWfVÂ‡6¶–ÆÂæ7&—D&öçW4'”ÆWfVÂÆÆWfVÂ“°¢–b‡6¶–ÆÂæ6FVv÷'“ÓÓÒ&'Vfb"bb7&—D&öçW2Ó×VæFVf–æVB—°¢'G2çW6‚€¢.h‰ikžxˆni8®xè~ˆˆ~xˆni8®X+~Zë2²"¶7&—D&öçW2°¢"^ûÈÎhÈ{¨Â"·6¶–ÆÂæGW&F–öâ².Y¹îY‚ ¢“°¢Ð¢VÇ6R–b‡6¶–ÆÂæ6FVv÷'“ÓÓÒ&'Vfb"bb6¶–ÆÂæWf6–öä&öçW5W&6VçBÓ×VæFVf–æVB—°¢'G2çW6‚€¢.™h>‹«.xèr²"·6¶–ÆÂæWf6–öä&öçW5W&6VçB°¢"^ûÈÎhÈ{¨Â"·6¶–ÆÂæGW&F–öâ².Y¹îY‚ ¢“°¢Ð¢VÇ6R–b‡6¶–ÆÂæ6FVv÷'“ÓÓÒ&'Vfb"bb6¶–ÆÂæFVfVç6T&öçW5W&6VçBÓ×VæFVf–æVB—°¢'G2çW6‚€¢.™‹.zjnX©²²"·6¶–ÆÂæFVfVç6T&öçW5W&6VçB°¢"^ûÈÎhÈ{¨Â"·6¶–ÆÂæGW&F–öâ².Y¹îY‚ ¢“°¢Ð¢VÇ6R–b‡6¶–ÆÂæ6FVv÷'“ÓÓÒ&'Vfb"bb6¶–ÆÂç&VfÆV7EW&6VçBÓ×VæFVf–æVB—°¢'G2çW6‚€¢.XøÞX+r"·6¶–ÆÂç&VfÆV7EW&6VçB°¢"^ûÈÎhÈ{¨Â"·6¶–ÆÂæGW&F–öâ².Y¹îY‚ ¢“°¢Ð¢VÇ6R–b‡6¶–ÆÂæ6FVv÷'“ÓÓÒ&'Vfb"bb6¶–ÆÂç7FGW5&W6—7D&öçW2Ó×VæFVf–æVB—°¢'G2çW6‚€¢.y[[‹Žx¸hX¾h©~h
r²"·6¶–ÆÂç7FGW5&W6—7D&öçW2°¢"^ûÈÎhÈ{¨Â"·6¶–ÆÂæGW&F–öâ².Y¹îY‚ ¢“°¢Ð¢VÇ6R–b‡6¶–ÆÂæ6FVv÷'“ÓÓÒ&'Vfb"—°¢'G2çW6‚‡6¶–ÆÂæFW67&—F–öâ“°¢Ð ¢–b‡6¶–ÆÂæ6FVv÷'“ÓÓÒ&†VÂ"—°¢ÆWB‡6öVff–6–VçCÓã#S°¢ÆWB76öVff–6–VçCÒãS°¢G'—°¢–b‡G—Vöb„TÄ”äuô”åEô4ôTdd”4”TåBÓÒ'VæFVf–æVB"—°¢‡6öVff–6–VçCÔ„TÄ”äuô”åEô4ôTdd”4”TåC°¢Ð¢–b‡G—Vöb5ô„TÄ”äuô”åEô4ôTdd”4”TåBÓÒ'VæFVf–æVB"—°¢76öVff–6–VçCÕ5ô„TÄ”äuô”åEô4ôTdd”4”TåC°¢Ð¢Ö6F6‚†W'&÷"—·Ð ¢6öç7B‡&6SÔçVÖ&W"‡6¶–ÆÂæ&6T†VÇÇÃ’´çVÖ&W"‡6¶–ÆÂæ†VÅW$ÆWfVÇÇÃ’¢†ÆWfVÂÓ“°¢6öç7B7&6SÔçVÖ&W"‡6¶–ÆÂæ&6T†VÅ5ÇÃ’´çVÖ&W"‡6¶–ÆÂæ†VÅ5W$ÆWfVÇÇÃ’¢†ÆWfVÂÓ“°¢'G2çW6‚€¢.Y¹î[ê”…ûÉ®Yû®zHâ"¶‡&6R².ûÈ¾i›®X©¼9r"¶‡6öVff–6–VçB°¢.ûÉ¾Y¹î[ê•5ûÉ®Yû®zHâ"·7&6R².ûÈ¾i›®X©¼9r"·76öVff–6–VçB°¢.ûÈŽikÞiKîˆ^iÊÎK«®KˆÞY¹î[ê•5ûÈ’ ¢“°¢Ð ¢6öç7B&Wf—fUW&6VçC×fÇVTDÆWfVÂ‡6¶–ÆÂç&Wf—fT†VÅW&6VçD'”ÆWfVÂÆÆWfVÂ“°¢–b‡6¶–ÆÂæ6FVv÷'“ÓÓÒ'&Wf—fR"bb&Wf—fUW&6VçBÓ×VæFVf–æVB—°¢'G2çW6‚‚.[êžkK¾KŠnh.[ê’"·&Wf—fUW&6VçB²"^iÈZJt…"“°¢Ð ¢–b‡6¶–ÆÂæ6FVv÷'“ÓÓÒ'76—fR"—°¢'G2çW6‚‡6¶–ÆÂæFW67&—F–öâ“°¢Ð ¢–b‡'G2æÆVæwFƒÃ—°¢'G2çW6‚‡6¶–ÆÂæFW67&—F–öçÇÂ.KéÞh¨ˆ;ÞŠª®iˆîyIþiXŽ8""“°¢Ð ¢&WGW&â'&’æg&öÒ†æWr6WB‡'G2æf–ÇFW"„&ööÆVâ’’“°¢Ð ¢gVæ7F–öâ'V–ÆD7&VF–öå6¶–ÆÄÆWfVÅ&÷w2‡6¶–ÆÂ—°¢6öç7BÖ„ÆWfVÃÔÖF‚æÖ‚ƒÄçVÖ&W"‡6¶–ÆÂæÖ„ÆWfVÂ—ÇÃ“°¢6öç7B&÷w3ÕµÓ° ¢f÷"†ÆWBÆWfVÃÓ¶ÆWfVÃÃÖÖ„ÆWfVÃ¶ÆWfVÂ²²—°¢6öç7BFWF–Ç3×6¶–ÆÄÆWfVÅ'G2‡6¶–ÆÂÆÆWfVÂ“°¢&÷w2çW6‚€¢sÆF—b6Æ73Ò&7&VF–öâ×6¶–ÆÂÖFWF–ÂÖÆWfVÂ×&÷r#âr°¢sÆ#äÇbâr¶ÆWfVÂ²sÂö#âr°¢sÇ7ãâr¶FWF–Ç2æÖ†W66T…DÔÂ’æ¦ö–â‚.ûÙÂ"’²sÂ÷7ãâr°¢sÂöF—câp¢“°¢Ð ¢&WGW&â&÷w2æ¦ö–â‚""“°¢Ð ¢gVæ7F–öâVç7W&T7&VF–öå6¶–ÆÄFWF–ÄÖöFÂ‚—°¢ÆWBÖöFÃÖ'”–B‚&7&VF–öå6¶–ÆÄFWF–ÄÖöFÂ"“°¢–b†ÖöFÂ—°¢&WGW&âÖöFÃ°¢Ð ¢6öç7B÷fW&Æ“Ö'”–B‚&vÖRÖ÷fW&Æ’ÖÆ–W""“°¢–b‚÷fW&Æ’—°¢&WGW&âçVÆÃ°¢Ð ¢ÖöFÃÖFö7VÖVçBæ7&VFTVÆVÖVçB‚&F—b"“°¢ÖöFÂæ–CÒ&7&VF–öå6¶–ÆÄFWF–ÄÖöFÂ#°¢ÖöFÂç6WDGG&–'WFR‚'&öÆR"Â&F–Æör"“°¢ÖöFÂç6WDGG&–'WFR‚&&–ÖÖöFÂ"Â'G'VR"“°¢ÖöFÂç6WDGG&–'WFR‚&&–Ö†–FFVâ"Â'G'VR"“°¢ÖöFÂç6WDGG&–'WFR‚&&–ÖÆ&VÆÆVF'’"Â&7&VF–öå6¶–ÆÄFWF–ÄæÖR"“°¢ÖöFÂæ–ææW$…DÔÃÐ¢sÆF—b6Æ73Ò&7&VF–öâ×6¶–ÆÂÖFWF–ÂÖ&÷‚#âr°¢sÆF—b6Æ73Ò&7&VF–öâ×6¶–ÆÂÖFWF–ÂÖ†VFW"#âr°¢sÆF—b–CÒ&7&VF–öå6¶–ÆÄFWF–ÄvÇ—‚"6Æ73Ò&7&VF–öâ×6¶–ÆÂÖFWF–ÂÖvÇ—‚#îh¨ÂöF—câr°¢sÆF—b6Æ73Ò&7&VF–öâ×6¶–ÆÂÖFWF–ÂÖ†VF–ær#âr°¢sÆF—b–CÒ&7&VF–öå6¶–ÆÄFWF–ÄæÖR"6Æ73Ò&7&VF–öâ×6¶–ÆÂÖFWF–ÂÖæÖR#îh¨ˆ;ÞK¸¾{K“ÂöF—câr°¢sÆF—b–CÒ&7&VF–öå6¶–ÆÄFWF–ÅF‚"6Æ73Ò&7&VF–öâ×6¶–ÆÂÖFWF–Â×F‚#ãÂöF—câr°¢sÂöF—câr°¢sÆ'WGFöâ–CÒ&7&VF–öå6¶–ÆÄFWF–Å‚"6Æ73Ò&7&VF–öâ×6¶–ÆÂÖFWF–Â×‚"G—SÒ&'WGFöâ"&–ÖÆ&VÃÒ.™yÎ™hžh¨ˆ;ÞK¸¾{K’#ì9sÂö'WGFöãâr°¢sÂöF—câr°¢sÆF—b–CÒ&7&VF–öå6¶–ÆÄFWF–ÅFw2"6Æ73Ò&7&VF–öâ×6¶–ÆÂÖFWF–Â×Fw2#ãÂöF—câr°¢sÆF—b–CÒ&7&VF–öå6¶–ÆÄFWF–ÄFW67&—F–öâ"6Æ73Ò&7&VF–öâ×6¶–ÆÂÖFWF–ÂÖFW67&—F–öâ#ãÂöF—câr°¢sÆF—b–CÒ&7&VF–öå6¶–ÆÄFWF–ÄÖWF"6Æ73Ò&7&VF–öâ×6¶–ÆÂÖFWF–ÂÖÖWF#ãÂöF—câr°¢sÆF—b6Æ73Ò&7&VF–öâ×6¶–ÆÂÖFWF–Â×6V7F–öâ×F—FÆR#îYNzØž{I®i[ŽXÃÂöF—câr°¢sÆF—b–CÒ&7&VF–öå6¶–ÆÄFWF–ÄÆWfVÇ2"6Æ73Ò&7&VF–öâ×6¶–ÆÂÖFWF–ÂÖÆWfVÇ2#ãÂöF—câr°¢sÆ'WGFöâ–CÒ&7&VF–öå6¶–ÆÄFWF–Ä6Æ÷6R"6Æ73Ò&7&VF–öâ×6¶–ÆÂÖFWF–ÂÖ6Æ÷6R"G—SÒ&'WGFöâ#î™yÎ™h“Âö'WGFöãâr°¢sÂöF—câs° ¢÷fW&Æ’æVæD6†–ÆB†ÖöFÂ“° ¢ÖöFÂæFDWfVçDÆ—7FVæW"‚&6Æ–6²"ÆgVæ7F–öâ†WfVçB—°¢–b†WfVçBçF&vWCÓÓÖÖöFÂ—°¢v–æF÷ræ6Æ÷6T7&VF–öå6¶–ÆÄFWF–Â‚“°¢Ð¢Ò“° ¢'”–B‚&7&VF–öå6¶–ÆÄFWF–Å‚"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Çv–æF÷ræ6Æ÷6T7&VF–öå6¶–ÆÄFWF–Â“°¢'”–B‚&7&VF–öå6¶–ÆÄFWF–Ä6Æ÷6R"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Çv–æF÷ræ6Æ÷6T7&VF–öå6¶–ÆÄFWF–Â“°¢&WGW&âÖöFÃ°¢Ð ¢ÆWB7&VF–öå6¶–ÆÄFWF–Å&WGW&äfö7W3ÖçVÆÃ° ¢v–æF÷rç6†÷t7&VF–öå6¶–ÆÄFWF–ÃÖgVæ7F–öâ‡6¶–ÆÄ–B—°¢–b‡G—Vöb6¶–ÆÄFF&6SÓÓÒ'VæFVf–æVB"—°¢&WGW&ã°¢Ð ¢6öç7B6¶–ÆÃ×6¶–ÆÄFF&6U·6¶–ÆÄ–EÓ°¢6öç7BÖöFÃÖVç7W&T7&VF–öå6¶–ÆÄFWF–ÄÖöFÂ‚“°¢6öç7BvSÖ'”–B‚&7&VF–öåvR"“°¢–b‚6¶–ÆÂÇÂÖöFÂÇÂvR—°¢&WGW&ã°¢Ð ¢7&VF–öå6¶–ÆÄFWF–Å&WGW&äfö7W3ÖFö7VÖVçBæ7F—fTVÆVÖVçC°¢ÖöFÂæFF6WBæVÆVÖVçC×6¶–ÆÂæVÆVÖVçGÇÂ&f—&R#° ¢6öç7BVÆVÖVçDÆ&VÇ3×¶f—&S¢.x²"ÇvFW#¢.kB"Çv–æC¢.š*‚"ÆV'Fƒ¢.YÉò'Ó°¢'”–B‚&7&VF–öå6¶–ÆÄFWF–ÄvÇ—‚"’çFW‡D6öçFVçCÖVÆVÖVçDÆ&VÇ5·6¶–ÆÂæVÆVÖVçE×ÇÂ.h¨#°¢'”–B‚&7&VF–öå6¶–ÆÄFWF–ÄæÖR"’çFW‡D6öçFVçC×6¶–ÆÂææÖS°¢'”–B‚&7&VF–öå6¶–ÆÄFWF–ÅF‚"’çFW‡D6öçFVçCÐ¢†VÆVÖVçDÆ&VÇ5·6¶–ÆÂæVÆVÖVçE×ÇÂ.XX>{J"’².{;²+r"°¢7&VF–öå6¶–ÆÄ6FVv÷'”Æ&VÂ‡6¶–ÆÂæ6FVv÷'’“°¢'”–B‚&7&VF–öå6¶–ÆÄFWF–ÄFW67&—F–öâ"’çFW‡D6öçFVçC×6¶–ÆÂæFW67&—F–öçÇÂ"#° ¢6öç7BFw3Õ°¢7&VF–öå6¶–ÆÄ6FVv÷'”Æ&VÂ‡6¶–ÆÂæ6FVv÷'’’À¢7&VF–öå6¶–ÆÅF&vWDÆ&VÂ‡6¶–ÆÂçF&vWEG—R’À¢.iÈš¹‚Çbâ"²‡6¶–ÆÂæÖ„ÆWfVÇÇÃ¢Ó°¢'”–B‚&7&VF–öå6¶–ÆÄFWF–ÅFw2"’æ–ææW$…DÔÃ×Fw0¢æÖ†gVæ7F–öâ‡FW‡B—°¢&WGW&âsÇ7â6Æ73Ò&7&VF–öâ×6¶–ÆÂÖFWF–Â×Fr#âr¶W66T…DÔÂ‡FW‡B’²sÂ÷7ãâs°¢Ò¢æ¦ö–â‚""“° ¢6öç7BÖWFÕµÓ°¢6öç7B76÷7C×6¶–ÆÂç76÷7BÓ×VæFVf–æVC÷6¶–ÆÂç76÷7C§6¶–ÆÂæ6÷7C°¢–b‡6¶–ÆÂæ6FVv÷'“ÓÓÒ'76—fR"—°¢ÖWFçW6‚‚.Š*¾X¹^h¨ˆ;ÞûÈÎKˆÞyJŽŠ9ÞX)žûÈÎZÛŽ{ù.[èÎkŽK˜^yIþiX‚"“°¢Ð¢VÇ6R–b‡76÷7BÓ×VæFVf–æVB—°¢ÖWFçW6‚‚.khŽˆ	r"·76÷7B²"5"“°¢Ð¢–b‡6¶–ÆÂæÆV&ä6÷7BÓ×VæFVf–æVB—°¢ÖWFçW6‚‚.ZÛŽ{ù.™ÈŠh"·6¶–ÆÂæÆV&ä6÷7B²"h¨ˆ;Þ›¹â"“°¢Ð¢–b„'&’æ—4'&’‡6¶–ÆÂç&WV—&W2’bb6¶–ÆÂç&WV—&W2æÆVæwF‚—°¢ÖWFçW6‚€¢.X˜Þ{Úîh¨ˆ;ÞûÉ¢"·6¶–ÆÂç&WV—&W0¢æÖ†gVæ7F–öâ†–B—°¢&WGW&â6¶–ÆÄFF&6U¶–EÓ÷6¶–ÆÄFF&6U¶–EÒææÖS¦–C°¢Ò¢æ¦ö–â‚.8"¢“°¢Ð¢'”–B‚&7&VF–öå6¶–ÆÄFWF–ÄÖWF"’çFW‡D6öçFVçCÖÖWFæ¦ö–â‚.ûÙÂ"“°¢'”–B‚&7&VF–öå6¶–ÆÄFWF–ÄÆWfVÇ2"’æ–ææW$…DÔÃÖ'V–ÆD7&VF–öå6¶–ÆÄÆWfVÅ&÷w2‡6¶–ÆÂ“°¢'”–B‚&7&VF–öå6¶–ÆÄFWF–ÄÆWfVÇ2"’ç67&öÆÅF÷Ó° ¢vRæ6Æ74Æ—7BæFB‚&7&VF–öâ×6¶–ÆÂÖFWF–ÂÖ÷Vâ"“°¢vRæ–æW'C×G'VS°¢vRç6WDGG&–'WFR‚&&–Ö†–FFVâ"Â'G'VR"“°¢ÖöFÂæ6Æ74Æ—7BæFB‚'6†÷r"“°¢ÖöFÂç6WDGG&–'WFR‚&&–Ö†–FFVâ"Â&fÇ6R"“° ¢v–æF÷rç6WEF–ÖV÷WB†gVæ7F–öâ‚—°¢6öç7B6Æ÷6T'WGFöãÖ'”–B‚&7&VF–öå6¶–ÆÄFWF–Å‚"“°¢–b†6Æ÷6T'WGFöâ—°¢6Æ÷6T'WGFöâæfö7W2‡·&WfVçE67&öÆÃ§G'VWÒ“°¢Ð¢ÒÃ“°¢Ó° ¢v–æF÷ræ6Æ÷6T7&VF–öå6¶–ÆÄFWF–ÃÖgVæ7F–öâ‚—°¢6öç7BÖöFÃÖ'”–B‚&7&VF–öå6¶–ÆÄFWF–ÄÖöFÂ"“°¢6öç7BvSÖ'”–B‚&7&VF–öåvR"“° ¢–b†ÖöFÂ—°¢ÖöFÂæ6Æ74Æ—7Bç&VÖ÷fR‚'6†÷r"“°¢ÖöFÂç6WDGG&–'WFR‚&&–Ö†–FFVâ"Â'G'VR"“°¢Ð ¢–b‡vR—°¢vRæ6Æ74Æ—7Bç&VÖ÷fR‚&7&VF–öâ×6¶–ÆÂÖFWF–ÂÖ÷Vâ"“°¢vRæ–æW'CÖfÇ6S°¢vRç&VÖ÷fTGG&–'WFR‚&&–Ö†–FFVâ"“°¢Ð ¢6öç7Bfö7W5F&vWCÖ7&VF–öå6¶–ÆÄFWF–Å&WGW&äfö7W3°¢7&VF–öå6¶–ÆÄFWF–Å&WGW&äfö7W3ÖçVÆÃ°¢v–æF÷rç6WEF–ÖV÷WB†gVæ7F–öâ‚—°¢–b€¢fö7W5F&vWBb`¢fö7W5F&vWBæ—46öææV7FVBb`¢vRb`¢v–æF÷rævWD6ö×WFVE7G–ÆR‡vR’æF—7Æ’ÓÒ&æöæR ¢—°¢fö7W5F&vWBæfö7W2‡·&WfVçE67&öÆÃ§G'VWÒ“°¢Ð¢ÒÃ“°¢Ó° ¢Fö7VÖVçBæFDWfVçDÆ—7FVæW"‚&¶W–F÷vâ"ÆgVæ7F–öâ†WfVçB—°¢6öç7BÖöFÃÖ'”–B‚&7&VF–öå6¶–ÆÄFWF–ÄÖöFÂ"“°¢–b†WfVçBæ¶W“ÓÓÒ$W66R"bbÖöFÂbbÖöFÂæ6Æ74Æ—7Bæ6öçF–ç2‚'6†÷r"’—°¢WfVçBç&WfVçDFVfVÇB‚“°¢v–æF÷ræ6Æ÷6T7&VF–öå6¶–ÆÄFWF–Â‚“°¢Ð¢Ò“° ¢gVæ7F–öâ&VæFW$7&VF–öå6†÷v66R†VÆVÖVçB—°¢6öç7BvSÖ'”–B‚&7&VF–öåvR"“°¢–b‚vR—·&WGW&ã·Ð ¢6öç7B6†÷6VãÔÔUD¶VÆVÖVçEÓöVÆVÖVçC¢&f—&R#°¢6öç7BÖWFÔÔUD¶6†÷6VåÓ°¢vRæFF6WBæVÆVÖVçCÖ6†÷6Vã°¢vRæFF6WBævVæFW#×6VÆV7FVDvVæFW#° ¢6öç7B÷'G&—CÖ'”–B‚&7&VF–öå÷'G&—B"“°¢–b‡÷'G&—B—°¢÷'G&—Bç7&3Õõ%E$•E5·6VÆV7FVDvVæFW%Õ¶6†÷6VåÓ°¢÷'G&—BæÇCÒ†6†÷6VãÓÓÒ&f—&R#ò.x²#¦6†÷6VãÓÓÒ'vFW"#ò.kB#¦6†÷6VãÓÓÒ'v–æB#ò.š*‚#¢.YÉò"’°¢.XX>{J"²‡6VÆV7FVDvVæFW#ÓÓÒ&ÖÆR#ò.yK~h
r#¢.Z[>h
r"’².Šy.ˆ›.z¸¾{š¢#°¢Ð ¢6öç7BÆ&VÄÖ×¶f—&S¢.x¾XX>{J"ÇvFW#¢.kNXX>{J"Çv–æC¢.š*ŽXX>{J"ÆV'Fƒ¢.YÉþXX>{J'Ó°¢–b†'”–B‚&7&VF–öå÷'G&—DVÆVÖVçB"’—¶'”–B‚&7&VF–öå÷'G&—DVÆVÖVçB"’çFW‡D6öçFVçCÖÆ&VÄÖ¶6†÷6VåÓ·Ð¢–b†'”–B‚&7&VF–öå÷'G&—DvVæFW""’—¶'”–B‚&7&VF–öå÷'G&—DvVæFW""’çFW‡D6öçFVçC×6VÆV7FVDvVæFW#ÓÓÒ&ÖÆR#ò.[	Kú#¢.Z[>Kú#·Ð¢–b†'”–B‚&7&VF–öäVÆVÖVçD&FvR"’—¶'”–B‚&7&VF–öäVÆVÖVçD&FvR"’çFW‡D6öçFVçCÖÖWFævÇ—ƒ·Ð¢–b†'”–B‚&7&VF–öäVÆVÖVçEF—FÆR"’—¶'”–B‚&7&VF–öäVÆVÖVçEF—FÆR"’çFW‡D6öçFVçCÖÖWFçF—FÆS·Ð¢–b†'”–B‚&7&VF–öäVÆVÖVçE&öÆR"’—¶'”–B‚&7&VF–öäVÆVÖVçE&öÆR"’çFW‡D6öçFVçCÖÖWFç&öÆS·Ð¢–b†'”–B‚&7&VF–öäVÆVÖVçDFW67&—F–öâ"’—¶'”–B‚&7&VF–öäVÆVÖVçDFW67&—F–öâ"’çFW‡D6öçFVçCÖÖWFæFW67&—F–öã·Ð ¢6öç7BFw3Ö'”–B‚&7&VF–öäVÆVÖVçEFw2"“°¢–b‡Fw2—°¢Fw2æ–ææW$…DÔÃÒ"#°¢ÖWFçFw2æf÷$V6‚†gVæ7F–öâ‡FW‡B—°¢6öç7BFsÖFö7VÖVçBæ7&VFTVÆVÖVçB‚'7â"“°¢Fræ6Æ74æÖSÒ&7&VF–öâ×&öÆR×Fr#°¢FrçFW‡D6öçFVçC×FW‡C°¢Fw2æVæD6†–ÆB‡Fr“°¢Ò“°¢Ð ¢Ð ¢v–æF÷rç6VÆV7D7&VF–öävVæFW#ÖgVæ7F–öâ†vVæFW"—°¢6VÆV7FVDvVæFW#ÖvVæFW#ÓÓÒ&ÖÆR#ò&ÖÆR#¢&fVÖÆR#° ¢6öç7BfVÖÆSÖ'”–B‚&7&VF–öävVæFW$fVÖÆR"“°¢6öç7BÖÆSÖ'”–B‚&7&VF–öävVæFW$ÖÆR"“°¢–b†fVÖÆR—¶fVÖÆRæ6Æ74Æ—7BçFövvÆR‚'6VÆV7FVB"Ç6VÆV7FVDvVæFW#ÓÓÒ&fVÖÆR"“·Ð¢–b†ÖÆR—¶ÖÆRæ6Æ74Æ—7BçFövvÆR‚'6VÆV7FVB"Ç6VÆV7FVDvVæFW#ÓÓÒ&ÖÆR"“·Ð ¢ÆWBVÆVÖVçCÒ&f—&R#°¢G'—°¢–b‡G—Vöb6VÆV7FVD7&VF–öäVÆVÖVçBÓÒ'VæFVf–æVB"bbÔUD·6VÆV7FVD7&VF–öäVÆVÖVçEÒ—°¢VÆVÖVçC×6VÆV7FVD7&VF–öäVÆVÖVçC°¢Ð¢Ö6F6‚†W'&÷"—·Ð¢&VæFW$7&VF–öå6†÷v66R†VÆVÖVçB“°¢Ó° ¢ò¢¶VWöæR6÷W&6RöbG'WF‚f÷"VÆVÖVçBÖV6†æ–73¢W6RF†RW†—7F–ær6VÆV7DVÆVÖVçB‚’à¢F†—2w&W"öæÇ’FG2F†RæWr7&VF–öâ×vRf—7VÂ&Vg&W6‚â¢ð¢–b‡G—Vöbv–æF÷rç6VÆV7DVÆVÖVçCÓÓÒ&gVæ7F–öâ"—°¢6öç7B÷&–v–æÅ6VÆV7DVÆVÖVçC×v–æF÷rç6VÆV7DVÆVÖVçC°¢v–æF÷rç6VÆV7DVÆVÖVçCÖgVæ7F–öâ†VÆVÖVçB—°¢6öç7B&W7VÇCÖ÷&–v–æÅ6VÆV7DVÆVÖVçBæÇ’‡F†—2Æ&wVÖVçG2“°¢&VæFW$7&VF–öå6†÷v66R†VÆVÖVçB“°¢&WGW&â&W7VÇC°¢Ó°¢Ð ¢ò¢vVæFW"—2&W6VçFF–öâ÷&öf–ÆRFFöæÇ’â—BFöW2æ÷BÇFW"ç’f÷&×VÆ2à¢76–vâ&Vf÷&RF†RW†—7F–ær7&VFT6†&7FW"‚’6fW2Æ–W"â¢ð¢–b‡G—Vöbv–æF÷ræ7&VFT6†&7FW#ÓÓÒ&gVæ7F–öâ"—°¢6öç7B÷&–v–æÄ7&VFT6†&7FW#×v–æF÷ræ7&VFT6†&7FW#°¢v–æF÷ræ7&VFT6†&7FW#ÖgVæ7F–öâ‚—°¢G'—°¢–b€¢G—VöbÆ–W"ÓÒ'VæFVf–æVB"b`¢€¢G—Vöb7&VF–öåF&vWE6Æ÷CÓÓÒ'VæFVf–æVB"ÇÀ¢7&VF–öåF&vWE6Æ÷CÓÓÓ¢¢—°¢Æ–W"ævVæFW#×6VÆV7FVDvVæFW#°¢Ð¢Ö6F6‚†W'&÷"—·Ð¢G'—°¢&WGW&â÷&–v–æÄ7&VFT6†&7FW"æÇ’‡F†—2Æ&wVÖVçG2“°¢Öf–æÆÇ—°¢ò¢š™~ŠØžZKiY~i˜.X›^Šy.šK¸ÞiÈ>šþzK®ûÈÎKˆÞˆ;ÞhùX˜Þ™yÎhèžh˜¾j™þYè.y»Nk¹X¹^8"¢ð¢7–æ47&VF–öåF÷V6„ÖöFR‚“°¢Ð¢Ó°¢Ð ¢–b‡G—Vöbv–æF÷rç6†÷t7&VF–öãÓÓÒ&gVæ7F–öâ"—°¢6öç7B÷&–v–æÅ6†÷t7&VF–öã×v–æF÷rç6†÷t7&VF–öã°¢v–æF÷rç6†÷t7&VF–öãÖgVæ7F–öâ‚—°¢Ö–w&FT7&VF–öåvUFôæF—fTÆ–W"‚“°¢G'—°¢&WGW&â÷&–v–æÅ6†÷t7&VF–öâæÇ’‡F†—2Æ&wVÖVçG2“°¢Öf–æÆÇ—°¢6WD7&VF–öåF÷V6„ÖöFR‡G'VR“°¢–ç7FÆÄ7&VF–öävW7GW&TÆö6²‚“°¢Ç”7&VF–öå7FWƒ“°¢&VæFW$7&VF–öå6†÷v66R€¢‡G—Vöb6VÆV7FVD7&VF–öäVÆVÖVçBÓÒ'VæFVf–æVB"bbÔUD·6VÆV7FVD7&VF–öäVÆVÖVçEÒ¢ò6VÆV7FVD7&VF–öäVÆVÖVç@¢¢&f—&R ¢“°¢Ð¢Ó°¢Ð ¢ò¢W†—7F–ær6fW2Fòæ÷B6öçF–âvVæFW"âFVfVÇF–ærFòfVÖÆR—2&6·v&BÖ6ö×F–&ÆRâ¢ð¢G'—°¢–b‡G—VöbÆ–W"ÓÒ'VæFVf–æVB"bbÆ–W"bb‡Æ–W"ævVæFW#ÓÓÒ&ÖÆR"ÇÂÆ–W"ævVæFW#ÓÓÒ&fVÖÆR"’—°¢6VÆV7FVDvVæFW#×Æ–W"ævVæFW#°¢Ð¢Ö6F6‚†W'&÷"—·Ð ¢6öç7B–æ—F–ÄVÆVÖVçCÒ†gVæ7F–öâ‚—°¢G'—°¢&WGW&â‡G—Vöb6VÆV7FVD7&VF–öäVÆVÖVçBÓÒ'VæFVf–æVB"bbÔUD·6VÆV7FVD7&VF–öäVÆVÖVçEÒ¢ò6VÆV7FVD7&VF–öäVÆVÖVç@¢¢&f—&R#°¢Ö6F6‚†W'&÷"—°¢&WGW&â&f—&R#°¢Ð¢Ò’‚“° ¢Ö–w&FT7&VF–öåvUFôæF—fTÆ–W"‚“°¢–ç7FÆÄ7&VF–öävW7GW&TÆö6²‚“°¢Ç”7&VF–öå7FWƒ“°¢v–æF÷rç6VÆV7D7&VF–öävVæFW"‡6VÆV7FVDvVæFW"“°¢&VæFW$7&VF–öå6†÷v66R†–æ—F–ÄVÆVÖVçB“°¢7–æ47&VF–öåF÷V6„ÖöFR‚“° ¢v–æF÷rævWD7&VF–öäæF—fTÆ–÷WDF–væ÷7F–73ÖgVæ7F–öâ‚—°¢6öç7BvSÖÖ–w&FT7&VF–öåvUFôæF—fTÆ–W"‚“°¢6öç7B6†VÆÃ×vRbbvRçVW'•6VÆV7F÷"‚"æ7&VF–öâ×&VÖ—VÒ×6†VÆÂ"“°¢–b‚vR—·&WGW&âçVÆÃ·Ð¢6öç7BvU7G–ÆS×v–æF÷rævWD6ö×WFVE7G–ÆR‡vR“°¢6öç7B6†VÆÅ7G–ÆS×6†VÆÃ÷v–æF÷rævWD6ö×WFVE7G–ÆR‡6†VÆÂ“¦çVÆÃ°¢&WGW&â°¢&VçD–C§vRç&VçDVÆVÖVçC÷vRç&VçDVÆVÖVçBæ–C¦çVÆÂÀ¢æF—fUv–GFƒ§vU7G–ÆRçv–GF‚À¢æF—fT†V–v‡C§vU7G–ÆRæ†V–v‡BÀ¢G&ç6f÷&Ó§vU7G–ÆRçG&ç6f÷&ÒÀ¢÷fW&fÆ÷u“§vU7G–ÆRæ÷fW&fÆ÷u’À¢ö–çFW$WfVçG3§vU7G–ÆRçö–çFW$WfVçG2À¢6†VÆÅFF–æs§6†VÆÅ7G–ÆS÷6†VÆÅ7G–ÆRçFF–æs¦çVÆÂÀ¢Ö–w&F–öã§vRæFF6WBææF—fTÖ–w&F–öçÇÆçVÆÂÀ¢&W–çC§vRæFF6WBææF—fU&W–çGÇÆçVÆÂÀ¢f—†VDÖöFS¦Fö7VÖVçBæFö7VÖVçDVÆVÖVçBæ6Æ74Æ—7Bæ6öçF–ç2‚&7&VF–öâÖf—†VBÖ7F—fR"’À¢7FW§6VÆV7FVD7&VF–öå7FWÀ¢6¶–ÆÅ&Wf–Wu&W6VçC¢'”–B‚&7&VF–öå‡—6–6Å6¶–ÆÇ2"¢Ó°¢Ó° ¢ò¢zÊÎK¨ÎûÈþKˆžŠy.ˆ›.X[yJŽX›^Šy.ši˜.ûÈÎXùnkhŽh‰nZèÎh‰[èÎK™þŠhˆ;ÞK‹¾X¹^Šz>™š@¢æG&ö–By¨NY»®Zé®X›^Šy.h˜¾Xº.jŠ[Èþ8"¢ð¢v–æF÷rç7–æ47&VF–öåF÷V6„ÖöFS×7–æ47&VF–öåF÷V6„ÖöFS° ¢ò¢æò×WFF–öäö'6W'fW"òW‡G&F÷V6‚Æ—7FVæW'2à¢6V6öæB7–æ2gFW"7W'&VçB6ÆÂ7F6²6÷fW'2ÆöDvÖR‚’F–Ö–ær6fVÇ’â¢ð¢v–æF÷rç6WEF–ÖV÷WB‡7–æ47&VF–öåF÷V6„ÖöFRÃ“°§Ò’‚“°  ¢ò¢'VæFÆVB6÷W&6S¢§2ó#Öæöç–Ö÷W2Ó#æ§2¢ð¢ò¢7&—F–6ÂöfVGW&R&÷VæF'’÷væW"âæòvÆö&Â–çWBÆö6²æBæòæWGv÷&²Ö÷&FW"F6‚6†–ââ¢ð¦6öç7Beô54UEõdU%4”ôãÒ#s2ãcR#° ¢†gVæ7F–öâ–ç7FÆÄfVGW&T–çFVçD&÷VæF'’‚—°¢'W6R7G&–7B#°¢–b‡v–æF÷råõöf÷W%7–Ö&öÇ4fVGW&T–çFVçD–ç7FÆÆVB—²&WGW&ã²Ð¢v–æF÷råõöf÷W%7–Ö&öÇ4fVGW&T–çFVçD–ç7FÆÆVC×G'VS° ¢6öç7B'VÆW3Õ°¢·GFW&ã¢÷6†÷uvUÂ…²r%ÖÖÆ÷VäÖÇG&öÂö’ÆfVGW&S¢'G&öÂ"ÆÆ&VÃ¢.[zh
¢'ÒÀ¢·GFW&ã¢÷6†÷uvUÂ…²r%Ö–çfVçF÷'—Æ÷Vââ¦–çfVçF÷'—Æ&6·6²ö’ÆfVGW&S¢&–çfVçF÷'’"ÆÆ&VÃ¢.ˆ8ÎXÈR'ÒÀ¢·GFW&ã¢öWV—ÖVçGÇ&Vf÷&vRö’ÆfVGW&S¢&WV—ÖVçB"ÆÆ&VÃ¢.Š9ÞX)’'ÒÀ¢·GFW&ã¢÷6†÷uvUÂ…²r%ÖGVævVöçÆGVævVöâö’ÆfVGW&S¢&GVævVöâ"ÆÆ&VÃ¢.XšþiÊÂ'ÒÀ¢·GFW&ã¢ö'—72ö’ÆfVGW&S¢&'—72"ÆÆ&VÃ¢.k{k{R'ÒÀ¢·GFW&ã¢ö&÷77ÇF÷vW"ö’ÆfVGW&S¢&&÷72×F÷vW""ÆÆ&VÃ¢.Y¹¾‹ZB'ÒÀ¢·GFW&ã¢÷&VÆ–2ö’ÆfVGW&S¢'&VÆ–2"ÆÆ&VÃ¢.zyŽZûb'ÒÀ¢·GFW&ã¢÷6¶–ÆÂö’ÆfVGW&S¢'6¶–ÆÂ"ÆÆ&VÃ¢.h¨ˆ;Ò'ÒÀ¢·GFW&ã¢÷6†÷ö’ÆfVGW&S¢'6†÷"ÆÆ&VÃ¢.YXn[©r'ÒÀ¢·GFW&ã¢÷7–çF‚ö’ÆfVGW&S¢'7–çF†W6—2"ÆÆ&VÃ¢.YŽh‰'ÒÀ¢·GFW&ã¢ö&GFÆRö’ÆfVGW&S¢&&GFÆR"ÆÆ&VÃ¢.h‹šÊR'Ð¢Ó°¢gVæ7F–öâF&vWB†WfVçB—²&WGW&âWfVçBçF&vWBbfWfVçBçF&vWBæ6Æ÷6W7BbfWfVçBçF&vWBæ6Æ÷6W7B‚&'WGFöâÆÅ¶FFÖfVGW&UÒ"“²Ð¢gVæ7F–öâ—4W‡ööÄ–çFW&7F–öâ†VÆVÖVçB—°¢&WGW&â†VÆVÖVçBbfVÆVÖVçBæ6Æ÷6W7BbfVÆVÖVçBæ6Æ÷6W7B‚"6†öÖTW‡ööÄ6&B"’“°¢Ð¢gVæ7F–öâFW67&—F÷"†VÆVÖVçB—°¢–b‚VÆVÖVçB—²&WGW&âçVÆÃ²Ð¢ò¢{i>š™~kiÊÎ‹ª¾[ÎikÎK‹¾Yøâ×6†VÆÎûÈÎKØn8Îš	ŠkÞXØ~{I®ûÈ¾K¨ÎjÊz+®Š¨Þ8Ö÷væW"YÊ€¢vÖWÆ’Ö6÷&^8.ˆz®[éâvÖWÆ’Ö6÷&RiKžh‰Æ§’[èÎûÈÎˆº^KˆÞXXŽ‹ÈžXZR÷væW.ûÈÀ¢ˆˆ®y¨NXÛ>i˜.Xˆn˜XÞhÈž˜‰^[Xúþˆ;ÞYÊŽ™‹.YnZèžŠ9ÞX˜ÞŠ*¾›¹îX‹8"¢ð¢–b†—4W‡ööÄ–çFW&7F–öâ†VÆVÖVçB’—°¢&WGW&â¶fVGW&S¢&&GFÆR"ÆÆ&VÃ¢.{i>š™~kZèžXZŽXØ~{I¢"ÆW‡ööÃ§G'VWÓ°¢Ð¢6öç7BW‡Æ–6—CÖVÆVÖVçBæFF6WBbfVÆVÖVçBæFF6WBæfVGW&S°¢–b†W‡Æ–6—B—²&WGW&â¶fVGW&S¦W‡Æ–6—BÆÆ&VÃ¦VÆVÖVçBævWDGG&–'WFR‚&&–ÖÆ&VÂ"—ÇÆVÆVÖVçBçFW‡D6öçFVçGÇÆW‡Æ–6—GÓ²Ð¢6öç7B6–væGW&SÕ¶VÆVÖVçBæ–BÆVÆVÖVçBæ6Æ74æÖRÆVÆVÖVçBævWDGG&–'WFRbfVÆVÖVçBævWDGG&–'WFR‚&öæ6Æ–6²"’ÆVÆVÖVçBçFW‡D6öçFVçEÒæ¦ö–â‚""“°¢&WGW&â'VÆW2æf–æB‡'VÆSÓç'VÆRçGFW&âçFW7B‡6–væGW&R’—ÇÆçVÆÃ°¢Ð¢gVæ7F–öâÆöFW"‚—²&WGW&âv–æF÷räf÷W%7–Ö&öÇ4fVGW&W3²Ð¢gVæ7F–öâ6WDÆö6ÄÆöF–ær†VÆVÖVçBÆ7F—fRÆÆ&VÂ—°¢–b‚VÆVÖVçB—²&WGW&ã²Ð¢VÆVÖVçBæ6Æ74Æ—7BçFövvÆR‚&—2ÖfVGW&RÖÆöF–ær"Æ7F—fR“°¢VÆVÖVçBç6WDGG&–'WFR‚&&–Ö'W7’"Æ7F—fSò'G'VR#¢&fÇ6R"“°¢–b†7F—fR—²VÆVÖVçBæFF6WBæfVGW&TÆöF–ætÆ&VÃÒ.jÚ>YÊŽ‹ÈžXZR"²†Æ&VÇÇÂ.X©þˆ;Ò"’².(
b#²Ð¢VÇ6W²FVÆWFRVÆVÖVçBæFF6WBæfVGW&TÆöF–ætÆ&VÃ²Ð¢Ð ¢ÆWBW‡ööÅ&–ÖU&öÖ—6SÖçVÆÃ°¢ÆWBW‡ööÅ6fWG•V•&VG“ÖfÇ6S°¢gVæ7F–öâ&Vg&W6„W‡ööÅ6fWG•V”öæ6R‚—°¢–b†W‡ööÅ6fWG•V•&VG’—²&WGW&ã²Ð¢W‡ööÅ6fWG•V•&VG“×G'VS°¢–b‡G—Vöbv–æF÷rç&VæFW$W‡F—7G&–'WFTÆ—7CÓÓÒ&gVæ7F–öâ"—°¢v–æF÷rç&VæFW$W‡F—7G&–'WFTÆ—7B‚“°¢Ð¢–b‡G—Vöbv–æF÷rçcs4FV6÷&FTW‡ööÄF—7G&–'WF–öåV“ÓÓÒ&gVæ7F–öâ"—°¢v–æF÷rçcs4FV6÷&FTW‡ööÄF—7G&–'WF–öåV’‚“°¢Ð¢6öç7BööÃÖFö7VÖVçBævWDVÆVÖVçD'”–B‚&†öÖTW‡ööÄ6&B"“°¢–b‡ööÂ—²ööÂæFF6WBæW‡6fWG”÷væW#Ò'&VG’#²Ð¢Ð¢gVæ7F–öâ&–ÖTW‡ööÅ6fWG’‚—°¢6öç7BööÃÖFö7VÖVçBævWDVÆVÖVçD'”–B‚&†öÖTW‡ööÄ6&B"“°¢6öç7B“ÖÆöFW"‚“°¢–b‚ööÇÇÂ’—²&WGW&ã²Ð¢6öç7Bf—6–&ÆSÒööÂæ†–FFVâbgv–æF÷rævWD6ö×WFVE7G–ÆR‡ööÂ’æF—7Æ’ÓÒ&æöæR"bgööÂævWD6Æ–VçE&V7G2‚’æÆVæwFƒã°¢–b‚f—6–&ÆR—²&WGW&ã²Ð¢–b†’æ—5&VG’‚&&GFÆR"’—°¢&Vg&W6„W‡ööÅ6fWG•V”öæ6R‚“°¢&WGW&ã°¢Ð¢–b†W‡ööÅ&–ÖU&öÖ—6R—²&WGW&ã²Ð¢6WDÆö6ÄÆöF–ær‡ööÂÇG'VRÂ.{i>š™~kZèžXZŽXØ~{I¢"“°¢W‡ööÅ&–ÖU&öÖ—6SÖ’æVç7W&R‚&&GFÆR"Â&W‡×ööÂ×6fWG’"’çF†Vâ‚‚“Óç°¢6WDÆö6ÄÆöF–ær‡ööÂÆfÇ6R“°¢&Vg&W6„W‡ööÅ6fWG•V”öæ6R‚“°¢Ò’æ6F6‚†W'&÷#Óç°¢6WDÆö6ÄÆöF–ær‡ööÂÆfÇ6R“°¢6öç6öÆRæW'&÷"‚$U…ööÂ6fWG’÷væW"f–ÆVBFòÆöC¢"ÆW'&÷"“°¢Fö7VÖVçBæF—7F6„WfVçB†æWr7W7FöÔWfVçB‚&f÷W"×7–Ö&öÇ3¦fVGW&RÖÆö6ÂÖW'&÷""Ç¶FWF–Ã§¶fVGW&S¢&&GFÆR"ÆW'&÷'×Ò’“°¢Ò’æf–æÆÇ’‚‚“Óç²W‡ööÅ&–ÖU&öÖ—6SÖçVÆÃ²Ò“°¢Ð¢gVæ7F–öâ&VfWF6‚†WfVçB—°¢6öç7BVÆVÖVçC×F&vWB†WfVçB“²6öç7B–æfóÖFW67&—F÷"†VÆVÖVçB“²6öç7B“ÖÆöFW"‚“°¢–b†–æfòbf’bb’æ—5&VG’†–æfòæfVGW&R’—²fö–B’ç&VfWF6‚†–æfòæfVGW&RÆWfVçBçG—R“²Ð¢Ð¢gVæ7F–öâVçFW"†WfVçB—°¢6öç7BVÆVÖVçC×F&vWB†WfVçB“²6öç7B–æfóÖFW67&—F÷"†VÆVÖVçB“²6öç7B“ÖÆöFW"‚“°¢–b‚–æf÷ÇÂ—ÇÆ’æ—5&VG’†–æfòæfVGW&R—ÇÆVÆVÖVçBæFF6WBæfVGW&U&WÆ“ÓÓÒ#"—²&WGW&ã²Ð¢WfVçBç&WfVçDFVfVÇB‚“²WfVçBç7F÷–ÖÖVF–FU&÷vF–öâ‚“°¢–b†VÆVÖVçBæFF6WBæfVGW&TÆöF–æsÓÓÒ#"—²&WGW&ã²Ð¢VÆVÖVçBæFF6WBæfVGW&TÆöF–æsÒ##²6WDÆö6ÄÆöF–ær†VÆVÖVçBÇG'VRÆ–æfòæÆ&VÂ“°¢’æVç7W&R†–æfòæfVGW&RÆ–æfòæW‡ööÃò&W‡×ööÂ×6fWG’#¢&æf–vF–öâ"’çF†Vâ‚‚“Óç°¢FVÆWFRVÆVÖVçBæFF6WBæfVGW&TÆöF–æs²6WDÆö6ÄÆöF–ær†VÆVÖVçBÆfÇ6R“°¢–b†–æfòæW‡ööÂ—°¢ò¢KˆÒ&WÆ’ˆˆ¢DôÒKˆ®Xúþˆ;ÞK¸ÞhÈ~Y	–ÖÖVF–FRF—7G&–'WFRy¨B†æFÆW.8 ¢XXŽyKjÚ>[Èò÷væW"˜xÞ{š®h‰8Îš	ŠkÒ(i"z+®Š¨Þ8ÕTžûÈÎxêžZënXhÞ›¹îKˆjÊh˜ÞiÈ>ˆ«U…8"¢ð¢&Vg&W6„W‡ööÅ6fWG•V”öæ6R‚“°¢&WGW&ã°¢Ð¢VÆVÖVçBæFF6WBæfVGW&U&WÆ“Ò##²VÆVÖVçBæ6Æ–6²‚“²FVÆWFRVÆVÖVçBæFF6WBæfVGW&U&WÆ“°¢Ò’æ6F6‚†W'&÷#Óç°¢FVÆWFRVÆVÖVçBæFF6WBæfVGW&TÆöF–æs²6WDÆö6ÄÆöF–ær†VÆVÖVçBÆfÇ6R“°¢6öç6öÆRæW'&÷"‚$fVGW&Rf–ÆVBFòÆöC¢"Æ–æfòæfVGW&RÆW'&÷"“°¢Fö7VÖVçBæF—7F6„WfVçB†æWr7W7FöÔWfVçB‚&f÷W"×7–Ö&öÇ3¦fVGW&RÖÆö6ÂÖW'&÷""Ç¶FWF–Ã§¶fVGW&S¦–æfòæfVGW&RÆW'&÷'×Ò’“°¢Ò“°¢Ð¢Fö7VÖVçBæFDWfVçDÆ—7FVæW"‚'ö–çFW&F÷vâ"Ç&VfWF6‚Ç¶6GW&S§G'VRÇ76—fS§G'VWÒ“°¢Fö7VÖVçBæFDWfVçDÆ—7FVæW"‚'F÷V6‡7F'B"Ç&VfWF6‚Ç¶6GW&S§G'VRÇ76—fS§G'VWÒ“°¢Fö7VÖVçBæFDWfVçDÆ—7FVæW"‚&6Æ–6²"ÆVçFW"ÇG'VR“°¢Fö7VÖVçBæFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚“Óç6WEF–ÖV÷WB‡&–ÖTW‡ööÅ6fWG’Ã’ÇG'VR“°¢Fö7VÖVçBæFDWfVçDÆ—7FVæW"‚&f÷W"×7–Ö&öÇ3§7F'GW×&VG’"Â‚“Óç°¢6öç7B“ÖÆöFW"‚“°¢–b†’—²’æ–FÆR‚“²Ð¢&–ÖTW‡ööÅ6fWG’‚“°¢ÒÇ¶öæ6S§G'VWÒ“° ¢gVæ7F–öâ–ç7FÆÄW‡ööÅf—6–&–Æ—G”ö'6W'fW"‚—°¢–b‚Fö7VÖVçBæ&öG—ÇÇG—Vöb×WFF–öäö'6W'fW#ÓÓÒ'VæFVf–æVB"—²&WGW&ã²Ð¢6öç7Bö'6W'fW#ÖæWr×WFF–öäö'6W'fW"‚‚“Óç°¢–b†W‡ööÅ6fWG•V•&VG’—²&WGW&ã²Ð¢&–ÖTW‡ööÅ6fWG’‚“°¢Ò“°¢ö'6W'fW"æö'6W'fR†Fö7VÖVçBæ&öG’Ç·7V'G&VS§G'VRÆ6†–ÆDÆ—7C§G'VRÆGG&–'WFW3§G'VRÆGG&–'WFTf–ÇFW#¥²&6Æ72"Â'7G–ÆR"Â&†–FFVâ%×Ò“°¢&–ÖTW‡ööÅ6fWG’‚“°¢Ð¢–b†Fö7VÖVçBç&VG•7FFSÓÓÒ&ÆöF–ær"—°¢Fö7VÖVçBæFDWfVçDÆ—7FVæW"‚$DôÔ6öçFVçDÆöFVB"Æ–ç7FÆÄW‡ööÅf—6–&–Æ—G”ö'6W'fW"Ç¶öæ6S§G'VWÒ“°¢ÖVÇ6W°¢–ç7FÆÄW‡ööÅf—6–&–Æ—G”ö'6W'fW"‚“°¢Ð§Ò’‚“° ¢†gVæ7F–öâ–æ—D&GFÆTVÆVÖVçD&÷„G&r‚—°¢gVæ7F–öâ&–æB‚—°¢6öç7B'WGFöãÖFö7VÖVçBævWDVÆVÖVçD'”–B‚&&GFÆTVÆVÖVçD&÷„'WGFöâ"“°¢6öç7BvSÖFö7VÖVçBævWDVÆVÖVçD'”–B‚&&GFÆUvR"“°¢–b‚'WGFöçÇÂvWÇÆ'WGFöâæFF6WBæG&u&VG“ÓÓÒ#"—²&WGW&ã²Ð¢'WGFöâæFF6WBæG&u&VG“Ò##°¢ÆWBG&sÖçVÆÃ²ÆWB7W&W746Æ–6³ÖfÇ6S²6öç7BF‡&W6†öÆCÓS°¢gVæ7F–öâÆöv–6Å66ÆR‚—°¢6öç7B&V7C×vRævWD&÷VæF–æt6Æ–VçE&V7B‚“°¢&WGW&â·&V7BÇ7ƒ§&V7Bçv–GFƒ÷vRæ6Æ–VçEv–GF‚÷&V7Bçv–GFƒ£Ç7“§&V7Bæ†V–v‡C÷vRæ6Æ–VçD†V–v‡B÷&V7Bæ†V–v‡C£Ó°¢Ð¢'WGFöâæFDWfVçDÆ—7FVæW"‚'ö–çFW&F÷vâ"ÆWfVçCÓç°¢–b†WfVçBçö–çFW%G—SÓÓÒ&Ö÷W6R"bfWfVçBæ'WGFöâÓÓ—²&WGW&ã²Ð¢6öç7B66ÆSÖÆöv–6Å66ÆR‚“²6öç7B&÷VæG3Ö'WGFöâævWD&÷VæF–æt6Æ–VçE&V7B‚“°¢G&s×·ö–çFW$–C¦WfVçBçö–çFW$–BÇƒ¦WfVçBæ6Æ–VçE‚Ç“¦WfVçBæ6Æ–VçE’ÆÆVgC¢†&÷VæG2æÆVgB×66ÆRç&V7BæÆVgB’§66ÆRç7‚ÇF÷¢†&÷VæG2çF÷×66ÆRç&V7BçF÷’§66ÆRç7’Ç7ƒ§66ÆRç7‚Ç7“§66ÆRç7’ÆÖ÷fVC¦fÇ6WÓ°¢7W&W746Æ–6³ÖfÇ6S²'WGFöâæ6Æ74Æ—7BæFB‚&G&vv–ær"“°¢G'—²'WGFöâç6WEö–çFW$6GW&R†WfVçBçö–çFW$–B“²Ö6F6‚…ò—²Ð¢WfVçBç&WfVçDFVfVÇB‚“°¢Ò“°¢'WGFöâæFDWfVçDÆ—7FVæW"‚'ö–çFW&Ö÷fR"ÆWfVçCÓç°¢–b‚G&wÇÆWfVçBçö–çFW$–BÓÖG&rçö–çFW$–B—²&WGW&ã²Ð¢6öç7BGƒÖWfVçBæ6Æ–VçE‚ÖG&rç‚ÆG“ÖWfVçBæ6Æ–VçE’ÖG&rç“°¢–b‚G&ræÖ÷fVBbdÖF‚æ‡—÷B†G‚ÆG’“ã×F‡&W6†öÆB—²G&ræÖ÷fVC×G'VS²Ð¢–b‚G&ræÖ÷fVB—²&WGW&ã²Ð¢6öç7BÆVgCÔÖF‚æÖ‚ƒÄÖF‚æÖ–â„ÖF‚æÖ‚ƒÇvRæ6Æ–VçEv–GF‚Ö'WGFöâæöfg6WEv–GF‚’ÆG&ræÆVgB¶G‚¦G&rç7‚’“°¢6öç7BF÷ÔÖF‚æÖ‚ƒÄÖF‚æÖ–â„ÖF‚æÖ‚ƒÇvRæ6Æ–VçD†V–v‡BÖ'WGFöâæöfg6WD†V–v‡B’ÆG&rçF÷¶G’¦G&rç7’’“°¢'WGFöâç7G–ÆRç6WE&÷W'G’‚&ÆVgB"ÆÆVgB²'‚"Â&–×÷'FçB"“²'WGFöâç7G–ÆRç6WE&÷W'G’‚'F÷"ÇF÷²'‚"Â&–×÷'FçB"“°¢'WGFöâç7G–ÆRç6WE&÷W'G’‚&&÷GFöÒ"Â&WFò"Â&–×÷'FçB"“²WfVçBç&WfVçDFVfVÇB‚“°¢Ò“°¢gVæ7F–öâf–æ—6‚†WfVçB—°¢–b‚G&wÇÆWfVçBçö–çFW$–BÓÖG&rçö–çFW$–B—²&WGW&ã²Ð¢7W&W746Æ–6³ÖG&ræÖ÷fVC²G&sÖçVÆÃ²'WGFöâæ6Æ74Æ—7Bç&VÖ÷fR‚&G&vv–ær"“²WfVçBç&WfVçDFVfVÇB‚“°¢Ð¢'WGFöâæFDWfVçDÆ—7FVæW"‚'ö–çFW'W"Æf–æ—6‚“²'WGFöâæFDWfVçDÆ—7FVæW"‚'ö–çFW&6æ6VÂ"Æf–æ—6‚“°¢'WGFöâæFDWfVçDÆ—7FVæW"‚&6Æ–6²"ÆWfVçCÓç°¢–b‡7W&W746Æ–6²—²7W&W746Æ–6³ÖfÇ6S²WfVçBç&WfVçDFVfVÇB‚“²WfVçBç7F÷&÷vF–öâ‚“²&WGW&ã²Ð¢–b‡G—Vöb÷Vä†öÖTfVGW&SÓÓÒ&gVæ7F–öâ"—²÷Vä†öÖTfVGW&R‚&WFô&GFÆU6WGF–æw2"“²Ð¢Ò“°¢'WGFöâæFDWfVçDÆ—7FVæW"‚&G&w7F'B"ÆWfVçCÓæWfVçBç&WfVçDFVfVÇB‚’“°¢Ð¢–b†Fö7VÖVçBç&VG•7FFSÓÓÒ&ÆöF–ær"—²Fö7VÖVçBæFDWfVçDÆ—7FVæW"‚$DôÔ6öçFVçDÆöFVB"Æ&–æBÇ¶öæ6S§G'VWÒ“²ÖVÇ6W²&–æB‚“²Ð§Ò’‚“°  ¢ò¢'VæFÆVB6÷W&6S¢§2óc×csB×V’×&Vw&W76–öâÖwV&G2æ§2¢ð¢ò¢ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÐ¢csB(	BG–æÖ–2T’&Vw&W76–öâwV&G0¢÷væW"f÷"7&÷72Ö7WGF–ærT’–çf&–çG27&VFVB'’×VÇF—ÆRÆFR'VçF–ÖW3 ¢’6¶–ÆÂÆV&â÷Ww&FR7F–öâ6&G2×W7B7F’6ö×7C°¢"’F&²FW‡Böâ'&–v‡BvöÆB÷–VÆÆ÷r'WGFöç2×W7Bæ÷B†fRFW‡B6†F÷s°¢2’7—7FVÒ6fRöFVÆWFR7V&fÆ÷w2×W7BÇv—2öffW"âW‡Æ–6—B&WGW&âF‚à ¢æòvÖWÆ’Â6fRÂ&GFÆRÂ6¶–ÆÂÖ6÷7B÷"WV—ÖVçB'W6–æW72'VÆW2Æ—fR†W&Rà£ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÒ¢ð¢†gVæ7F–öâ–ç7FÆÅcsEV•&Vw&W76–öäwV&G2‚—°¢'W6R7G&–7B#° ¢–b‡G—Vöbv–æF÷sÓÓÒ'VæFVf–æVB'ÇÇG—VöbFö7VÖVçCÓÓÒ'VæFVf–æVB'ÇÇv–æF÷råõ÷csEV•&Vw&W76–öäwV&G4–ç7FÆÆVB—°¢&WGW&ã°¢Ð¢v–æF÷råõ÷csEV•&Vw&W76–öäwV&G4–ç7FÆÆVC×G'VS° ¢ÆWB&d–CÓ° ¢gVæ7F–öâ6ö×7E6¶–ÆÄ7F–öäÆ&VÂ‡6÷W&6R—°¢6öç7BFW‡CÕ7G&–ær‡6÷W&6WÇÂ""’ç&WÆ6R‚õÇ2²örÂ""’çG&–Ò‚“°¢–b‚FW‡B—²&WGW&âFW‡C²Ð ¢ÆWBÖF6ƒ×FW‡BæÖF6‚‚õîŠy.ˆ›%Ç2¤ÇeÇ2¢…ÆB²•Ç2®XúþXØ~ˆ{>h¨ˆ;ÕÇ2¤ÇeÇ2¢…ÆB²’ö’“°¢–b†ÖF6‚—²&WGW&â$Çb"¶ÖF6…³Ò²"Šz>˜éb#²Ð ¢ÖF6ƒ×FW‡BæÖF6‚‚õîXØ~ˆ{5Ç2¤ÇeÇ2¢…ÆB²•Ç2®™ÈŠhÇ2¢…ÆB²•Ç2®h¨ˆ;Þ›¹âö’“°¢–b†ÖF6‚—²&WGW&â.™È"¶ÖF6…³%Ò²"›¹â#²Ð ¢ÖF6ƒ×FW‡BæÖF6‚‚õîXØ~ˆ{5Ç2¤ÇeÇ2¢…ÆB²•Ç2¥¾8;¼+uÕÇ2¢…ÆB²•Ç2®›¹âö’“°¢–b†ÖF6‚—²&WGW&â.XØrÇb"¶ÖF6…³Ò².8;²"¶ÖF6…³%Ò².›¹â#²Ð ¢ÖF6ƒ×FW‡BæÖF6‚‚õîZÛŽ{ù%Ç2¥¾8;¼+uÕÇ2¢…ÆB²•Ç2®›¹âö’“°¢–b†ÖF6‚—²&WGW&â.ZÛŽ{ù.8;²"¶ÖF6…³Ò².›¹â#²Ð ¢ÖF6ƒ×FW‡BæÖF6‚‚ôÇeÇ2¢…ÆB²•Ç2®Šz>˜ébö’“°¢–b†ÖF6‚—²&WGW&â$Çb"¶ÖF6…³Ò²"Šz>˜éb#²Ð ¢ÖF6ƒ×FW‡BæÖF6‚‚þ™ÈŠhÇ2¢…ÆB²•Ç2®h¨ˆ;Þ›¹âö’“°¢–b†ÖF6‚—²&WGW&â.™È"¶ÖF6…³Ò²"›¹â#²Ð ¢–b‚þX˜Þ{Úå³®ûÉ¥ÒòçFW7B‡FW‡B’—²&WGW&â.™ÈX˜Þ{Úâ#²Ð¢&WGW&âFW‡C°¢Ð ¢gVæ7F–öâæ÷&ÖÆ—¦U6¶–ÆÄ7F–öä6&G2‚—°¢6öç7BÆ&VÇ3ÖFö7VÖVçBçVW'•6VÆV7F÷$ÆÂ‚"6ÆÅ6¶–ÆÇ4Æ—7Bç6¶–ÆÂÖ7F–öâÖ6&Bç6¶–ÆÂÖ7F–öâÖ6&BÖÆ&VÂ"“°¢Æ&VÇ2æf÷$V6‚†Æ&VÃÓç°¢6öç7B6&CÖÆ&VÂæ6Æ÷6W7B‚"ç6¶–ÆÂÖ7F–öâÖ6&B"“°¢–b‚6&B—²&WGW&ã²Ð ¢6öç7B7W'&VçCÕ7G&–ær†Æ&VÂçFW‡D6öçFVçGÇÂ""’ç&WÆ6R‚õÇ2²örÂ""’çG&–Ò‚“°¢6öç7B&Wf–÷W46ö×7CÖÆ&VÂæFF6WBçcsD6ö×7DÆ&VÇÇÂ"#°¢–b†7W'&VçBÓ×&Wf–÷W46ö×7B—°¢6öç7BgVÆÃÖ7W'&VçC°¢6öç7B6ö×7CÖ6ö×7E6¶–ÆÄ7F–öäÆ&VÂ†gVÆÂ“°¢Æ&VÂæFF6WBçcsDgVÆÄÆ&VÃÖgVÆÃ°¢Æ&VÂæFF6WBçcsD6ö×7DÆ&VÃÖ6ö×7C°¢–b†6ö×7BÓÖgVÆÂ—²Æ&VÂçFW‡D6öçFVçCÖ6ö×7C²Ð¢6&BçF—FÆSÖgVÆÃ°¢6&Bç6WDGG&–'WFR‚&&–ÖÆ&VÂ"ÆgVÆÂ“°¢Ð ¢–b†6&Bç7G–ÆRævWE&÷W'G•fÇVR‚'v–GF‚"’ÓÒ#G‚'ÇÆ6&Bç7G–ÆRævWE&÷W'G•&–÷&—G’‚'v–GF‚"’ÓÒ&–×÷'FçB"—°¢6&Bç7G–ÆRç6WE&÷W'G’‚'v–GF‚"Â#G‚"Â&–×÷'FçB"“°¢6&Bç7G–ÆRç6WE&÷W'G’‚&Ö‚×v–GF‚"Â#G‚"Â&–×÷'FçB"“°¢6&Bç7G–ÆRç6WE&÷W'G’‚&Ö–â×v–GF‚"Â#ƒG‚"Â&–×÷'FçB"“°¢6&Bç7G–ÆRç6WE&÷W'G’‚&fÆW‚Ö&6—2"Â#G‚"Â&–×÷'FçB"“°¢Ð¢Ò“°¢Ð ¢gVæ7F–öâ6öÆ÷%G&—ÆW2‡fÇVR—°¢6öç7BG&—ÆW3ÕµÓ°¢7G&–ær‡fÇVWÇÂ""’ç&WÆ6R‚÷&v&õÂ…Ç2¢…ÆB²ƒó¥ÂåÆB²“ò•Ç2¥²ÂÕÇ2¢…ÆB²ƒó¥ÂåÆB²“ò•Ç2¥²ÂÕÇ2¢…ÆB²ƒó¥ÂåÆB²“ò’ƒó¥Ç2¥²ÂõÕÇ2¢…ÆB¢ƒó¥ÂåÆB²“ò’“õÇ2¥Â’öv’À¢gVæ7F–öâ…òÇ"ÆrÆ"Æ—°¢6öç7BÇ†ÖÓÓÒ"'ÇÆÓÓ×VæFVf–æVCó¤çVÖ&W"†“°¢G&—ÆW2çW6‚‡·#¤çVÖ&W"‡"’Æs¤çVÖ&W"†r’Æ#¤çVÖ&W"†"’Æ¤çVÖ&W"æ—4f–æ—FR†Ç†“öÇ†£Ò“°¢&WGW&âó°¢Ð¢“°¢&WGW&âG&—ÆW3°¢Ð ¢gVæ7F–öâÇVÖ–ææ6R†6öÆ÷"—°¢&WGW&â6öÆ÷"ç"¢ã##b¶6öÆ÷"ær¢ãsS"¶6öÆ÷"æ"¢ãs##°¢Ð ¢gVæ7F–öâ—4'&–v‡DvöÆB†6öÆ÷"—°¢&WGW&â6öÆ÷"æâãRb`¢6öÆ÷"ç#ãÓCRb`¢6öÆ÷"æsãÓ“b`¢6öÆ÷"æsÃÓ##Rb`¢6öÆ÷"æ#ÃÓCRb`¢6öÆ÷"ç#ãÖ6öÆ÷"ærb`¢ÇVÖ–ææ6R†6öÆ÷"“ãÓS°¢Ð ¢gVæ7F–öâ—4F&µFW‡B†6öÆ÷"—°¢&WGW&â6öÆ÷"bf6öÆ÷"æâãRbfÇVÖ–ææ6R†6öÆ÷"“ÃÓS°¢Ð ¢gVæ7F–öâæ÷&ÖÆ—¦TvöÆD'WGFöåFW‡E6†F÷w2‚—°¢Fö7VÖVçBçVW'•6VÆV7F÷$ÆÂ‚"6vÖR×7FvR'WGFöâÂ67&VF–öåvR'WGFöâ"’æf÷$V6‚†'WGFöãÓç°¢6öç7B7G–ÆS×v–æF÷rævWD6ö×WFVE7G–ÆR†'WGFöâ“°¢6öç7BFW‡D6öÆ÷#Ö6öÆ÷%G&—ÆW2‡7G–ÆRæ6öÆ÷"•³Ó°¢6öç7B&6¶w&÷VæD6öÆ÷'3Ö6öÆ÷%G&—ÆW2‡7G–ÆRæ&6¶w&÷VæD6öÆ÷"²""·7G–ÆRæ&6¶w&÷VæD–ÖvR“°¢6öç7BVÆ–f–W3Ö—4F&µFW‡B‡FW‡D6öÆ÷"’bf&6¶w&÷VæD6öÆ÷'2ç6öÖR†—4'&–v‡DvöÆB“° ¢–b‡VÆ–f–W2—°¢–b†'WGFöâæFF6WBçcsDF&´vöÆE6†F÷rÓÒ#'ÇÇ7G–ÆRçFW‡E6†F÷rÓÒ&æöæR"—°¢'WGFöâç7G–ÆRç6WE&÷W'G’‚'FW‡B×6†F÷r"Â&æöæR"Â&–×÷'FçB"“°¢'WGFöâæFF6WBçcsDF&´vöÆE6†F÷sÒ##°¢Ð¢ÖVÇ6R–b†'WGFöâæFF6WBçcsDF&´vöÆE6†F÷sÓÓÒ#"—°¢'WGFöâç7G–ÆRç&VÖ÷fU&÷W'G’‚'FW‡B×6†F÷r"“°¢FVÆWFR'WGFöâæFF6WBçcsDF&´vöÆE6†F÷s°¢Ð¢Ò“°¢Ð ¢gVæ7F–öâVç7W&U7G–ÆW6†VWDÆ7B‚—°¢6öç7BÆ–æ³ÖFö7VÖVçBævWDVÆVÖVçD'”–B‚'csBÖ7&—F–6Â×V’×&Vw&W76–öâ×7G–ÆR"“°¢–b†Æ–æ²bfÆ–æ²ç&VçDVÆVÖVçCÓÓÖFö7VÖVçBæ†VBbfÆ–æ²ÓÖFö7VÖVçBæ†VBæÆ7DVÆVÖVçD6†–ÆB—°¢Fö7VÖVçBæ†VBæVæD6†–ÆB†Æ–æ²“°¢Ð¢Ð ¢gVæ7F–öâ7—7FVÕ&÷uF—FÆR†'WGFöâ—°¢6öç7B&÷sÖ'WGFöâbf'WGFöâæ6Æ÷6W7Bbf'WGFöâæ6Æ÷6W7B‚"ç7—7FVÒ×æVÂ×&÷r"“°¢6öç7BF—FÆS×&÷rbg&÷rçVW'•6VÆV7F÷"‚'7G&öær"“°¢&WGW&â7G&–ær‡F—FÆRbgF—FÆRçFW‡D6öçFVçGÇÂ""’çG&–Ò‚“°¢Ð ¢7–æ2gVæ7F–öâVç7W&U'tF–Æöt÷væW"‡&V6öâ—°¢–b‡G—Vöbv–æF÷rç'tÆW'CÓÓÒ&gVæ7F–öâ"bgG—Vöbv–æF÷rç't6öæf—&ÓÓÓÒ&gVæ7F–öâ"—²&WGW&âG'VS²Ð¢–b‡v–æF÷räf÷W%7–Ö&öÇ4fVGW&W2bgG—Vöbv–æF÷räf÷W%7–Ö&öÇ4fVGW&W2æVç7W&SÓÓÒ&gVæ7F–öâ"—°¢G'—²v—Bv–æF÷räf÷W%7–Ö&öÇ4fVGW&W2æVç7W&R‚&vÖWÆ’Ö6÷&R"Ç&V6öçÇÂ'7—7FVÒÖF–Æör"“²Ð¢6F6‚†W'&÷"—²6öç6öÆRæW'&÷"‚%7—7FVÒF–Æör÷væW"f–ÆVBFòÆöC¢"ÆW'&÷"“²Ð¢Ð¢&WGW&âG—Vöbv–æF÷rç'tÆW'CÓÓÒ&gVæ7F–öâ"bgG—Vöbv–æF÷rç't6öæf—&ÓÓÓÒ&gVæ7F–öâ#°¢Ð ¢7–æ2gVæ7F–öâ'Vå7—7FVÕ6fT7F–öâ†'WGFöâ—°¢–b†'WGFöâæFF6WBçcsE7—7FVÔ'W7“ÓÓÒ#"—²&WGW&ã²Ð¢'WGFöâæFF6WBçcsE7—7FVÔ'W7“Ò##°¢'WGFöâæF—6&ÆVC×G'VS°¢G'—°¢6öç7B6fVC×G—Vöbv–æF÷rç6fTvÖSÓÓÒ&gVæ7F–öâ#÷v–æF÷rç6fTvÖR‚“¦fÇ6S°¢6öç7B&VG“Öv—BVç7W&U'tF–Æöt÷væW"‚'7—7FVÒ×6fRÖfVVF&6²"“°¢6öç7B7V66W73×6fVBÓÖfÇ6S°¢–b‡&VG’—°¢v—Bv–æF÷rç'tÆW'B€¢7V66W73ò.[{.ZèÎh‰h˜¾X¹^ZÙŽj©N8"#¢.yºîX˜ÞxJk9^ZèÎh‰h˜¾X¹^ZÙŽj©N8""À¢·F—FÆS¢.˜®h‹.ZÙŽj©B"Æ6öæf—&ÕFW‡C¢.‹ùNY¹î{;¾{["ÇFöæS§7V66W73ò'7V66W72#¢&æ÷&ÖÂ'Ð¢“°¢ÖVÇ6R–b‡G—Vöbv–æF÷ræÆW'CÓÓÒ&gVæ7F–öâ"—°¢v–æF÷ræÆW'B‡7V66W73ò.[{.ZèÎh‰h˜¾X¹^ZÙŽj©N8"#¢.yºîX˜ÞxJk9^ZèÎh‰h˜¾X¹^ZÙŽj©N8""“°¢Ð¢Öf–æÆÇ—°¢FVÆWFR'WGFöâæFF6WBçcsE7—7FVÔ'W7“°¢'WGFöâæF—6&ÆVCÖfÇ6S°¢Ð¢Ð ¢7–æ2gVæ7F–öâ'Vå7—7FVÔFVÆWFT7F–öâ†'WGFöâ—°¢–b†'WGFöâæFF6WBçcsE7—7FVÔ'W7“ÓÓÒ#"—²&WGW&ã²Ð¢'WGFöâæFF6WBçcsE7—7FVÔ'W7“Ò##°¢'WGFöâæF—6&ÆVC×G'VS°¢G'—°¢6öç7B&VG“Öv—BVç7W&U'tF–Æöt÷væW"‚'7—7FVÒÖFVÆWFRÖ6öæf—&Ò"“°¢–b‡&VG’bgG—Vöbv–æF÷rç&W6WDvÖSÓÓÒ&gVæ7F–öâ"—°¢v—Bv–æF÷rç&W6WDvÖR‚“°¢Ð¢Öf–æÆÇ—°¢FVÆWFR'WGFöâæFF6WBçcsE7—7FVÔ'W7“°¢'WGFöâæF—6&ÆVCÖfÇ6S°¢Ð¢Ð ¢gVæ7F–öâ–çFW&6WE7—7FVÔ7F–öâ†WfVçB—°¢6öç7B'WGFöãÖWfVçBçF&vWBbfWfVçBçF&vWBæ6Æ÷6W7BbfWfVçBçF&vWBæ6Æ÷6W7B‚"ç7—7FVÒ×æVÂ×&÷ræ†öÖRÖfVGW&RÖ'W’Ö'Fâ"“°¢–b‚'WGFöâ—²&WGW&ã²Ð¢6öç7BF—FÆS×7—7FVÕ&÷uF—FÆR†'WGFöâ“°¢–b‡F—FÆRÓÒ.˜®h‹.ZÙŽj©B"bgF—FÆRÓÒ.XŠ®™šNŠy.ˆ›""—²&WGW&ã²Ð ¢WfVçBç&WfVçDFVfVÇB‚“°¢WfVçBç7F÷&÷vF–öâ‚“°¢WfVçBç7F÷–ÖÖVF–FU&÷vF–öâ‚“°¢–b‡F—FÆSÓÓÒ.˜®h‹.ZÙŽj©B"—²fö–B'Vå7—7FVÕ6fT7F–öâ†'WGFöâ“²Ð¢VÇ6W²fö–B'Vå7—7FVÔFVÆWFT7F–öâ†'WGFöâ“²Ð¢Ð ¢gVæ7F–öâæ÷&ÖÆ—¦U7—7FVÔF–Æötæf–vF–öâ‚—°¢6öç7BÆ–W#ÖFö7VÖVçBævWDVÆVÖVçD'”–B‚'cc•'tF–ÆötÆ–W""“°¢–b‚Æ–W'ÇÂÆ–W"æ6Æ74Æ—7Bæ6öçF–ç2‚'6†÷r"’—²&WGW&ã²Ð¢6öç7BF—FÆSÖÆ–W"çVW'•6VÆV7F÷"‚"7cc•'tF–ÆöuF—FÆR"“°¢–b…7G&–ær‡F—FÆRbgF—FÆRçFW‡D6öçFVçGÇÂ""’çG&–Ò‚’ÓÒ.XŠ®™šNŠy.ˆ›""—²&WGW&ã²Ð¢6öç7B6æ6VÃÖÆ–W"çVW'•6VÆV7F÷"‚"çcc’×'rÖF–ÆörÖ7F–öç2çcc’×'rÖF–ÆörÖ'WGFöâç6V6öæF'’"“°¢–b†6æ6VÂbb6æ6VÂæ†–FFVâbf6æ6VÂçFW‡D6öçFVçBÓÒ.‹ùNY¹î{;¾{["—°¢6æ6VÂçFW‡D6öçFVçCÒ.‹ùNY¹î{;¾{[#°¢6æ6VÂç6WDGG&–'WFR‚&&–ÖÆ&VÂ"Â.‹ùNY¹î{;¾{[ûÈÎKˆÞXŠ®™šNŠy.ˆ›""“°¢Ð¢Ð ¢gVæ7F–öâÇ’‚—°¢æ÷&ÖÆ—¦U6¶–ÆÄ7F–öä6&G2‚“°¢æ÷&ÖÆ—¦TvöÆD'WGFöåFW‡E6†F÷w2‚“°¢æ÷&ÖÆ—¦U7—7FVÔF–Æötæf–vF–öâ‚“°¢Vç7W&U7G–ÆW6†VWDÆ7B‚“°¢Ð ¢gVæ7F–öâ66†VGVÆR‚—°¢–b‡&d–B—²&WGW&ã²Ð¢&d–C×&WVW7Dæ–ÖF–öäg&ÖR‚‚“Óç°¢&d–CÓ°¢Ç’‚“°¢Ò“°¢Ð ¢6öç7Bö'6W'fW#ÖæWr×WFF–öäö'6W'fW"‡66†VGVÆR“°¢ö'6W'fW"æö'6W'fR†Fö7VÖVçBæ&öG’Ç°¢6†–ÆDÆ—7C§G'VRÀ¢7V'G&VS§G'VRÀ¢6†&7FW$FF§G'VRÀ¢GG&–'WFW3§G'VRÀ¢GG&–'WFTf–ÇFW#¥²&6Æ72"Â'7G–ÆR"Â&F—6&ÆVB%Ð¢Ò“° ¢Fö7VÖVçBæFDWfVçDÆ—7FVæW"‚&6Æ–6²"Æ–çFW&6WE7—7FVÔ7F–öâÇG'VR“°¢Fö7VÖVçBæFDWfVçDÆ—7FVæW"‚&6Æ–6²"Ç66†VGVÆRÇ·76—fS§G'VWÒ“°¢Fö7VÖVçBæFDWfVçDÆ—7FVæW"‚'cs3§'VçF–ÖR×&VG’"Ç66†VGVÆRÇ·76—fS§G'VWÒ“°¢v–æF÷ræFDWfVçDÆ—7FVæW"‚'&W6—¦R"Ç66†VGVÆRÇ·76—fS§G'VWÒ“° ¢–b†Fö7VÖVçBç&VG•7FFSÓÓÒ&ÆöF–ær"—°¢Fö7VÖVçBæFDWfVçDÆ—7FVæW"‚$DôÔ6öçFVçDÆöFVB"Ç66†VGVÆRÇ¶öæ6S§G'VWÒ“°¢ÖVÇ6W°¢66†VGVÆR‚“°¢Ð ¢v–æF÷rçcsDÇ•V•&Vw&W76–öäwV&G3×66†VGVÆS°§Ò’‚“°  ¢ò¢'VæFÆVB6÷W&6S¢§2÷&VÆV6R×WFFRÖæ÷F–f–6F–öâæ§2¢ð¢ò ¢&VÆV6RWFFRæ÷F–f–6F–öâ7—7FVÐ¢ÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÐ¢Æ–W"Öf6–ær&VÆV6Ræ÷F–6W2&R÷væVB'’&VÆV6R÷&VÆV6R×WFFRæ§6öâà¢F†—2×6†VÆÂÖöGVÆRFVÆ–&W&FVÇ’&WW6W26†öÖTfVGW&TÖöFÂæBF†RæF—fP¢6vÖRÖ÷fW&Æ’ÖÆ–W#²—BFöW2æ÷B–çG&öGV6R6V6öæBÖöFÂ÷"ææ÷Væ6VÖVç@¢g&ÖWv÷&²à¢¢ð¢†gVæ7F–öâ–ç7FÆÅ&VÆV6UWFFTæ÷F–f–6F–öâ†vÆö&Â—°¢'W6R7G&–7B#° ¢–b‚vÆö&ÇÇÆvÆö&Âäf÷W%7–Ö&öÇ5&VÆV6UWFFR—²&WGW&ã²Ð ¢6öç7B$TÄT4UôäõD”4UõDƒÒ'&VÆV6R÷&VÆV6R×WFFRæ§6öâ#°¢6öç7B4„T4µô”åDU%dÅôÕ3ÓB£c£°¢6öç7BÔ”åô4„T4µôtôÕ3ÓCR£°¢6öç7B$TÔ”äDU%ô4ôôÄDõtåôÕ3Ó#£c£°¢6öç7B$UTU5EõD”ÔTõUEôÕ3Óƒ°¢6öç7BTäD”äuõ$T4„T4µôÕ3ÓS°¢6öç7B5Dõ$tUôäÔU54SÒ&f÷W"×7–Ö&öÇ3§&VÆV6R×WFFS¢#° ¢6öç7B7FFS×°¢7F'FVC¦fÇ6RÀ¢6†V6¶–æs¦çVÆÂÀ¢Æ7D6†V6´C£À¢Öæ–fW7C¦çVÆÂÀ¢ÆöFVE&VÆV6UfW'6–öã¦çVÆÂÀ¢Ö'VVS¦çVÆÂÀ¢öÆÅF–ÖW#¦çVÆÂÀ¢VæF–æuF–ÖW#¦çVÆÂÀ¢VæF–ætæ÷&ÖÅ&VÆöC¦fÇ6RÀ¢VæF–ætf÷&6VEWFFS¦fÇ6RÀ¢VæF–ætææ÷Væ6VÖVçC¦fÇ6RÀ¢f÷&6VDÖöFÄÆö6³¦fÇ6RÀ¢ÖöFÄ÷Vã¦fÇ6RÀ¢ÖöFÄ¶–æC¦çVÆÂÀ¢7&—F–6Ä÷W&F–öç3¦æWrÖ‚’À¢æW‡D÷W&F–öä–C£¢Ó° ¢gVæ7F–öâæ÷r‚—²&WGW&âFFRææ÷r‚“²Ð ¢gVæ7F–öâæ÷&ÖÆ—¦UfW'6–öâ‡fÇVR—°¢6öç7B&sÕ7G&–ær‡fÇVSÓÖçVÆÃò"#§fÇVR’çG&–Ò‚’ç&WÆ6R‚õåbö’Â""“°¢&WGW&â&rò%b"·&r¢"#°¢Ð ¢gVæ7F–öâ'6UfW'6–öâ‡fÇVR—°¢6öç7Bæ÷&ÖÆ—¦VCÖæ÷&ÖÆ—¦UfW'6–öâ‡fÇVR’ç&WÆ6R‚õåbòÂ""“°¢–b‚õåÆB²ƒó¥ÂåÆB²’²BòçFW7B†æ÷&ÖÆ—¦VB’—²&WGW&âçVÆÃ²Ð¢&WGW&âæ÷&ÖÆ—¦VBç7Æ—B‚"â"’æÖ‡'CÓäçVÖ&W"‡'B’“°¢Ð ¢gVæ7F–öâ6ö×&UfW'6–öç2†ÆVgBÇ&–v‡B—°¢6öç7B×'6UfW'6–öâ†ÆVgB“°¢6öç7B#×'6UfW'6–öâ‡&–v‡B“°¢–b‚ÇÂ"—²&WGW&âçVÆÃ²Ð¢6öç7BÆVæwFƒÔÖF‚æÖ‚†æÆVæwF‚Æ"æÆVæwF‚“°¢f÷"†ÆWB–æFWƒÓ¶–æFWƒÆÆVæwFƒ¶–æFW‚²²—°¢6öç7BFVÇFÒ†¶–æFW…×ÇÃ’Ò†%¶–æFW…×ÇÃ“°¢–b†FVÇFÓÓ—²&WGW&âFVÇFãó¢Ó²Ð¢Ð¢&WGW&â°¢Ð ¢gVæ7F–öâW66T‡FÖÂ‡fÇVR—°¢&WGW&â7G&–ær‡fÇVSÓÖçVÆÃò"#§fÇVR¢ç&WÆ6R‚òbörÂ"f×²"¢ç&WÆ6R‚óÂörÂ"fÇC²"¢ç&WÆ6R‚óâörÂ"fwC²"¢ç&WÆ6R‚õÂ"örÂ"gV÷C²"¢ç&WÆ6R‚òrörÂ"b33“²"“°¢Ð ¢gVæ7F–öâvWDÆöFVE&VÆV6UfW'6–öâ‚—°¢6öç7B'V–ÆCÖvÆö&ÂåõôdõU%õ5”Ô$ôÅ5ô%T”ÄEõó°¢6öç7BfÇVSÖ'V–ÆBbf'V–ÆBç&VÆV6S°¢&WGW&âæ÷&ÖÆ—¦UfW'6–öâ‡fÇVR“°¢Ð ¢gVæ7F–öâvWE7F÷&vR‚—°¢G'—²&WGW&âvÆö&ÂæÆö6Å7F÷&vWÇÆçVÆÃ²Ð¢6F6‚…ò—²&WGW&âçVÆÃ²Ð¢Ð ¢gVæ7F–öâ7F÷&vT¶W’‡7Vff—‚—°¢6öç7B&W÷6—F÷'“ÖvÆö&Âäf÷W%7–Ö&öÇ466÷VçE6fS°¢G'—°¢–b‡&W÷6—F÷'’bgG—Vöb&W÷6—F÷'’æ66÷VçD¶W“ÓÓÒ&gVæ7F–öâ"—°¢&WGW&â&W÷6—F÷'’æ66÷VçD¶W’‚'&VÆV6R×WFFRÒ"·7Vff—‚“°¢Ð¢Ö6F6‚…ò—²Ð¢&WGW&â5Dõ$tUôäÔU54R·7Vff—ƒ°¢Ð ¢gVæ7F–öâ&VE7F÷&vR‡7Vff—‚—°¢6öç7B7F÷&vSÖvWE7F÷&vR‚“°¢–b‚7F÷&vR—²&WGW&âçVÆÃ²Ð¢G'—²&WGW&â7F÷&vRævWD—FVÒ‡7F÷&vT¶W’‡7Vff—‚’“²Ð¢6F6‚…ò—²&WGW&âçVÆÃ²Ð¢Ð ¢gVæ7F–öâw&—FU7F÷&vR‡7Vff—‚ÇfÇVR—°¢6öç7B7F÷&vSÖvWE7F÷&vR‚“°¢–b‚7F÷&vR—²&WGW&ã²Ð¢G'—²7F÷&vRç6WD—FVÒ‡7F÷&vT¶W’‡7Vff—‚’Å7G&–ær‡fÇVR’“²Ð¢6F6‚…ò—²Ð¢Ð ¢gVæ7F–öâfÆ–FFTÖæ–fW7B‡fÇVR—°¢–b‚fÇVWÇÇG—VöbfÇVRÓÒ&ö&¦V7B'ÇÄ'&’æ—4'&’‡fÇVR’—²&WGW&âçVÆÃ²Ð¢6öç7B&VÆV6UfW'6–öãÖæ÷&ÖÆ—¦UfW'6–öâ‡fÇVRç&VÆV6UfW'6–öâ“°¢6öç7BWFFTÖöFS×fÇVRçWFFTÖöFS°¢6öç7BÖ–æ–×VÕfW'6–öã×fÇVRæÖ–æ–×VÕfW'6–öãÓÓÖçVÆÇÇÇfÇVRæÖ–æ–×VÕfW'6–öãÓÓ×VæFVf–æVGÇÇfÇVRæÖ–æ–×VÕfW'6–öãÓÓÒ" ¢òçVÆÀ¢¢æ÷&ÖÆ—¦UfW'6–öâ‡fÇVRæÖ–æ–×VÕfW'6–öâ“°¢6öç7B6öçFVçCÔ'&’æ—4'&’‡fÇVRæ6öçFVçB“÷fÇVRæ6öçFVçC¦çVÆÃ°¢–b€¢fÇVRç66†VÖfW'6–öâÓÓÇÀ¢G—VöbfÇVRçV&Æ–4æ÷F–6RÓÒ&&ööÆVâ'ÇÀ¢'6UfW'6–öâ‡&VÆV6UfW'6–öâ—ÇÀ¢G—VöbfÇVRææ÷F–6T–BÓÒ'7G&–ær'ÇÂfÇVRææ÷F–6T–BçG&–Ò‚—ÇÀ¢G—VöbfÇVRçF—FÆRÓÒ'7G&–ær'ÇÂfÇVRçF—FÆRçG&–Ò‚—ÇÀ¢G—VöbfÇVRç7VÖÖ'’ÓÒ'7G&–ær'ÇÂfÇVRç7VÖÖ'’çG&–Ò‚—ÇÀ¢6öçFVçGÇÆ6öçFVçBæÆVæwFƒÓÓÓÇÆ6öçFVçBç6öÖR†—FVÓÓçG—Vöb—FVÒÓÒ'7G&–ær'ÇÂ—FVÒçG&–Ò‚’—ÇÀ¢G—VöbfÇVRçV&Æ—6†VDBÓÒ'7G&–ær'ÇÂfÇVRçV&Æ—6†VDBçG&–Ò‚—ÇÀ¢çVÖ&W"æ—4f–æ—FR„FFRç'6R‡fÇVRçV&Æ—6†VDB’—ÇÀ¢‡WFFTÖöFRÓÒ&æ÷&ÖÂ"bgWFFTÖöFRÓÒ&f÷&6VB"—ÇÀ¢†Ö–æ–×VÕfW'6–öâÓÖçVÆÂbb'6UfW'6–öâ†Ö–æ–×VÕfW'6–öâ’¢—°¢&WGW&âçVÆÃ°¢Ð¢&WGW&â°¢66†VÖfW'6–öã£À¢V&Æ–4æ÷F–6S§fÇVRçV&Æ–4æ÷F–6RÀ¢&VÆV6UfW'6–öâÀ¢æ÷F–6T–C§fÇVRææ÷F–6T–BçG&–Ò‚’À¢F—FÆS§fÇVRçF—FÆRçG&–Ò‚’À¢7VÖÖ'“§fÇVRç7VÖÖ'’çG&–Ò‚’À¢6öçFVçC¦6öçFVçBæÖ†—FVÓÓæ—FVÒçG&–Ò‚’’À¢V&Æ—6†VDC§fÇVRçV&Æ—6†VDBÀ¢WFFTÖöFRÀ¢Ö–æ–×VÕfW'6–öà¢Ó°¢Ð ¢gVæ7F–öâ†5Vç&VE&VÆV6Tæ÷F–6R‚—°¢6öç7BÖæ–fW7C×7FFRæÖæ–fW7C°¢6öç7BÆöFVC×7FFRæÆöFVE&VÆV6UfW'6–öçÇÆvWDÆöFVE&VÆV6UfW'6–öâ‚“°¢–b‚Öæ–fW7GÇÂÖæ–fW7BçV&Æ–4æ÷F–6WÇÂÆöFVB—²&WGW&âfÇ6S²Ð¢–b†6ö×&UfW'6–öç2†ÆöFVBÆÖæ–fW7Bç&VÆV6UfW'6–öâ’ÓÓ—²&WGW&âfÇ6S²Ð¢&WGW&â€¢&VE7F÷&vR‚&Æ7B×6VVâ×fW'6–öâ"’ÓÖÖæ–fW7Bç&VÆV6UfW'6–öçÇÀ¢&VE7F÷&vR‚&Æ7B×6VVâÖæ÷F–6R"’ÓÖÖæ–fW7Bææ÷F–6T–@¢“°¢Ð ¢gVæ7F–öâÖ&´7W'&VçDæ÷F–6U6VVâ‚—°¢6öç7BÖæ–fW7C×7FFRæÖæ–fW7C°¢–b‚Öæ–fW7B—²&WGW&ã²Ð¢w&—FU7F÷&vR‚&Æ7B×6VVâ×fW'6–öâ"ÆÖæ–fW7Bç&VÆV6UfW'6–öâ“°¢w&—FU7F÷&vR‚&Æ7B×6VVâÖæ÷F–6R"ÆÖæ–fW7Bææ÷F–6T–B“°¢&Vg&W6„æ÷F–f–6F–öäF÷G2‚“°¢Ð ¢gVæ7F–öâ&VE&VÖ–æFW"‚—°¢G'—°¢6öç7BfÇVSÔ¥4ôâç'6R‡&VE7F÷&vR‚&Æ7B×&VÖ–æFW""—ÇÂ&çVÆÂ"“°¢&WGW&âfÇVRbgG—VöbfÇVSÓÓÒ&ö&¦V7B#÷fÇVS¦çVÆÃ°¢Ö6F6‚…ò—²&WGW&âçVÆÃ²Ð¢Ð ¢gVæ7F–öâ6†÷VÆE6†÷u&VÖ–æFW"†Öæ–fW7B—°¢6öç7B&VÖ–æFW#×&VE&VÖ–æFW"‚“°¢&WGW&â&VÖ–æFW'ÇÇ&VÖ–æFW"ææ÷F–6T–BÓÖÖæ–fW7Bææ÷F–6T–GÇÆæ÷r‚’ÔçVÖ&W"‡&VÖ–æFW"æGÇÃ“ãÕ$TÔ”äDU%ô4ôôÄDõtåôÕ3°¢Ð ¢gVæ7F–öâ&VÖVÖ&W%&VÖ–æFW"†Öæ–fW7B—°¢w&—FU7F÷&vR‚&Æ7B×&VÖ–æFW""Ä¥4ôâç7G&–æv–g’‡¶æ÷F–6T–C¦Öæ–fW7Bææ÷F–6T–BÆC¦æ÷r‚—Ò’“°¢Ð ¢gVæ7F–öâvWEVç6fU&V6öç2‚—°¢6öç7B&V6öç3ÕµÓ°¢G'—°¢–b‡G—Vöb&GFÆT7F—fRÓÒ'VæFVf–æVB"bf&GFÆT7F—fR—²&V6öç2çW6‚‚&&GFÆR"“²Ð¢–b‡G—Vöb&GFÆU†6RÓÒ'VæFVf–æVB"bf&GFÆU†6SÓÓÒ'&W6öÇfR"—²&V6öç2çW6‚‚&&GFÆR×&W6öÇWF–öâ"“²Ð¢Ö6F6‚…ò—²Ð¢G'—°¢–b€¢vÆö&Âäf÷W%7–Ö&öÇ4&GFÆTfÆ÷rb`¢G—VöbvÆö&Âäf÷W%7–Ö&öÇ4&GFÆTfÆ÷ræ—5&W6VçFF–öä7F—fSÓÓÒ&gVæ7F–öâ"b`¢vÆö&Âäf÷W%7–Ö&öÇ4&GFÆTfÆ÷ræ—5&W6VçFF–öä7F—fR‚¢—°¢&V6öç2çW6‚‚&&GFÆR×&W6VçFF–öâ"“°¢Ð¢Ö6F6‚…ò—²Ð¢–b‡7FFRæ7&—F–6Ä÷W&F–öç2ç6—¦R—²&V6öç2çW6‚‚&7&—F–6ÂÖ÷W&F–öâ"“²Ð ¢6öç7BFö7VÖVçE&VcÖvÆö&ÂæFö7VÖVçC°¢–b‚Fö7VÖVçE&VgÇÇG—VöbFö7VÖVçE&VbævWDVÆVÖVçD'”–BÓÒ&gVæ7F–öâ"—²&WGW&â&V6öç3²Ð¢6öç7B&Wv&CÖFö7VÖVçE&VbævWDVÆVÖVçD'”–B‚'c3%&Wv&DÖöFÂ"“°¢–b‡&Wv&Bbg&Wv&Bæ6Æ74Æ—7Bbg&Wv&Bæ6Æ74Æ—7Bæ6öçF–ç2‚'6†÷r"’—²&V6öç2çW6‚‚'&Wv&B"“²Ð¢6öç7BF–ÆösÖFö7VÖVçE&VbævWDVÆVÖVçD'”–B‚'cc•'tF–ÆötÆ–W""“°¢–b†F–ÆörbfF–Æöræ6Æ74Æ—7BbfF–Æöræ6Æ74Æ—7Bæ6öçF–ç2‚'6†÷r"’—²&V6öç2çW6‚‚'G&ç67F–öâÖF–Æör"“²Ð¢6öç7BÖöFÃÖFö7VÖVçE&VbævWDVÆVÖVçD'”–B‚&†öÖTfVGW&TÖöFÂ"“°¢–b€¢ÖöFÂbfÖöFÂæ6Æ74Æ—7BbfÖöFÂæ6Æ74Æ—7Bæ6öçF–ç2‚'6†÷r"’b`¢ÖöFÂæ6Æ74Æ—7Bæ6öçF–ç2‚'&VÆV6R×WFFRÖÖöFÂ"’b`¢€¢ÖöFÂæ6Æ74Æ—7Bæ6öçF–ç2‚'cC×7–çF†W6—2ÖÖöFÂ"—ÇÀ¢ÖöFÂæ6Æ74Æ—7Bæ6öçF–ç2‚'c3×6†÷Ö÷Vâ"—ÇÀ¢ÖöFÂæ6Æ74Æ—7Bæ6öçF–ç2‚'FVÒ×&VÆ–2ÖÖöFÂ"¢¢—°¢&V6öç2çW6‚‚&†–v‚×fÇVRÖfVGW&R"“°¢Ð¢&WGW&â&V6öç3°¢Ð ¢gVæ7F–öâ6å6fVÇ•&VÆöDf÷%WFFR‚—°¢&WGW&âvWEVç6fU&V6öç2‚’æÆVæwFƒÓÓÓ°¢Ð ¢gVæ7F–öâ&Vv–ä7&—F–6Ä÷W&F–öâ†Æ&VÂ—°¢6öç7B÷W&F–öä–C×7FFRææW‡D÷W&F–öä–B²³°¢ÆWB7F—fS×G'VS°¢7FFRæ7&—F–6Ä÷W&F–öç2ç6WB†÷W&F–öä–BÅ7G&–ær†Æ&VÇÇÂ&7&—F–6ÂÖ÷W&F–öâ"’“°¢&WGW&âgVæ7F–öâVæD7&—F–6Ä÷W&F–öâ‚—°¢–b‚7F—fR—²&WGW&ã²Ð¢7F—fSÖfÇ6S°¢7FFRæ7&—F–6Ä÷W&F–öç2æFVÆWFR†÷W&F–öä–B“°¢&W6öÇfUVæF–æuv†Vå6fR‚“°¢Ó°¢Ð ¢gVæ7F–öâvWD÷fW&Æ”Æ–W"‚—°¢6öç7BFö7VÖVçE&VcÖvÆö&ÂæFö7VÖVçC°¢&WGW&âFö7VÖVçE&VbbfFö7VÖVçE&VbævWDVÆVÖVçD'”–@¢òFö7VÖVçE&VbævWDVÆVÖVçD'”–B‚&vÖRÖ÷fW&Æ’ÖÆ–W""¢¢çVÆÃ°¢Ð ¢gVæ7F–öâVç7W&TÖ'VVR‚—°¢–b‡7FFRæÖ'VVRbg7FFRæÖ'VVRæ—46öææV7FVBÓÖfÇ6R—²&WGW&â7FFRæÖ'VVS²Ð¢6öç7BFö7VÖVçE&VcÖvÆö&ÂæFö7VÖVçC°¢6öç7BÆ–W#ÖvWD÷fW&Æ”Æ–W"‚“°¢–b‚Fö7VÖVçE&VgÇÂÆ–W'ÇÇG—VöbFö7VÖVçE&Vbæ7&VFTVÆVÖVçBÓÒ&gVæ7F–öâ"—²&WGW&âçVÆÃ²Ð¢6öç7BÖ'VVSÖFö7VÖVçE&Vbæ7&VFTVÆVÖVçB‚&'WGFöâ"“°¢Ö'VVRçG—SÒ&'WGFöâ#°¢Ö'VVRæ–CÒ'&VÆV6UWFFTÖ'VVR#°¢Ö'VVRæ6Æ74æÖSÒ'&VÆV6R×WFFRÖÖ'VVR#°¢Ö'VVRç6WDGG&–'WFR‚&&–ÖÆ—fR"Â'öÆ—FR"“°¢Ö'VVRç6WDGG&–'WFR‚&&–ÖÆ&VÂ"Â.iú^yÈ¾x˜ŽiÊÎi»NikXZ~Zë’"“°¢Ö'VVRæ–ææW$…DÔÃÐ¢sÇ7â6Æ73Ò'&VÆV6R×WFFRÖÖ'VVR×Fr#îi»NikÂ÷7ãâr°¢sÇ7â6Æ73Ò'&VÆV6R×WFFRÖÖ'VVR×FW‡B#ãÂ÷7ãâr°¢sÇ7â6Æ73Ò'&VÆV6R×WFFRÖÖ'VVRÖ7F–öâ#îiú^yÈ³Â÷7ãâs°¢Ö'VVRæFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚“Óç°¢6öç7BÖæ–fW7C×7FFRæÖæ–fW7C°¢–b‚Öæ–fW7B—²&WGW&ã²Ð¢–b†—4f÷&6VDf÷$ÆöFVEfW'6–öâ†Öæ–fW7B’bb6å6fVÇ•&VÆöDf÷%WFFR‚’—°¢6†÷tÖ'VVR†Öæ–fW7BÂ&f÷&6VB×VæF–ær"“°¢66†VGVÆUVæF–æu&W6öÇWF–öâ‚“°¢&WGW&ã°¢Ð¢÷Vå&VÆV6TFWF–Â†—4f÷&6VDf÷$ÆöFVEfW'6–öâ†Öæ–fW7B“ò&f÷&6VB#¢'WFFR"“°¢Ò“°¢Æ–W"æVæD6†–ÆB†Ö'VVR“°¢7FFRæÖ'VVSÖÖ'VVS°¢&WGW&âÖ'VVS°¢Ð ¢gVæ7F–öâ6†÷tÖ'VVR†Öæ–fW7BÆ¶–æB—°¢6öç7BÖ'VVSÖVç7W&TÖ'VVR‚“°¢–b‚Ö'VVWÇÂÖæ–fW7B—²&WGW&ã²Ð¢6öç7BFsÖÖ'VVRçVW'•6VÆV7F÷"‚"ç&VÆV6R×WFFRÖÖ'VVR×Fr"“°¢6öç7BFW‡CÖÖ'VVRçVW'•6VÆV7F÷"‚"ç&VÆV6R×WFFRÖÖ'VVR×FW‡B"“°¢6öç7B7F–öãÖÖ'VVRçVW'•6VÆV7F÷"‚"ç&VÆV6R×WFFRÖÖ'VVRÖ7F–öâ"“°¢6öç7BVæF–æsÖ¶–æCÓÓÒ&æ÷&ÖÂ×VæF–ær'ÇÆ¶–æCÓÓÒ&f÷&6VB×VæF–ær#°¢–b‡Fr—²FrçFW‡D6öçFVçCÖ¶–æBbf¶–æBæ–æFW„öb‚&f÷&6VB"“ÓÓÓò.˜xÞŠhi»Nik#¢.i»Nik#²Ð¢–b‡FW‡B—°¢FW‡BçFW‡D6öçFVçC×VæF–æp¢òÖæ–fW7Bç&VÆV6UfW'6–öâ²"[{.y›Î[ˆ>ûÉ¾yºîX˜Þi8ÞKÙÎZèÎh‰[èÎ[~ˆz®X¹^˜.ŠÎi»Nik8" ¢¢Öæ–fW7Bç&VÆV6UfW'6–öâ²"[{.y›Î[ˆ>ûÈÂ"¶Öæ–fW7Bç7VÖÖ'“°¢Ð¢–b†7F–öâ—²7F–öâçFW‡D6öçFVçC×VæF–æsò.[è^i»Nik#¢.iú^yÈ²#²Ð¢Ö'VVRæ6Æ74Æ—7BçFövvÆR‚&—2Öf÷&6VB"Æ¶–æBbf¶–æBæ–æFW„öb‚&f÷&6VB"“ÓÓÓ“°¢Ö'VVRæ6Æ74Æ—7BçFövvÆR‚&—2×VæF–ær"ÂVæF–ær“°¢Ö'VVRæ†–FFVãÖfÇ6S°¢Ð ¢gVæ7F–öâ†–FTÖ'VVR‚—°¢–b‡7FFRæÖ'VVR—²7FFRæÖ'VVRæ†–FFVã×G'VS²Ð¢Ð ¢gVæ7F–öâ—4f÷&6VDf÷$ÆöFVEfW'6–öâ†Öæ–fW7B—°¢6öç7BÆöFVC×7FFRæÆöFVE&VÆV6UfW'6–öçÇÆvWDÆöFVE&VÆV6UfW'6–öâ‚“°¢–b‚Öæ–fW7GÇÂÆöFVB—²&WGW&âfÇ6S²Ð¢–b†Öæ–fW7BçWFFTÖöFSÓÓÒ&f÷&6VB"—²&WGW&âG'VS²Ð¢&WGW&â€¢Öæ–fW7BæÖ–æ–×VÕfW'6–öâb`¢6ö×&UfW'6–öç2†ÆöFVBÆÖæ–fW7BæÖ–æ–×VÕfW'6–öâ’ÓÖçVÆÂb`¢6ö×&UfW'6–öç2†ÆöFVBÆÖæ–fW7BæÖ–æ–×VÕfW'6–öâ“Ã ¢“°¢Ð ¢gVæ7F–öâvWE6†&VDÖöFÅ'G2‚—°¢6öç7BFö7VÖVçE&VcÖvÆö&ÂæFö7VÖVçC°¢–b‚Fö7VÖVçE&VgÇÇG—VöbFö7VÖVçE&VbævWDVÆVÖVçD'”–BÓÒ&gVæ7F–öâ"—²&WGW&âçVÆÃ²Ð¢6öç7BÖöFÃÖFö7VÖVçE&VbævWDVÆVÖVçD'”–B‚&†öÖTfVGW&TÖöFÂ"“°¢6öç7BF—FÆSÖFö7VÖVçE&VbævWDVÆVÖVçD'”–B‚&†öÖTfVGW&TÖöFÅF—FÆR"“°¢6öç7B&öG“ÖFö7VÖVçE&VbævWDVÆVÖVçD'”–B‚&†öÖTfVGW&TÖöFÄ&öG’"“°¢–b‚ÖöFÇÇÂF—FÆWÇÂ&öG’—²&WGW&âçVÆÃ²Ð¢&WGW&â¶ÖöFÂÇF—FÆRÆ&öG—Ó°¢Ð ¢gVæ7F–öâ&VæFW%&VÆV6T6öçFVçB†Öæ–fW7BÆ¶–æB—°¢6öç7Bf÷&6VCÖ¶–æCÓÓÒ&f÷&6VB#°¢6öç7BWFFSÖ¶–æCÓÓÒ'WFFR#°¢6öç7B–çG&óÖf÷&6V@¢ò.yºîX˜Þx˜ŽiÊÎ[{.XÎjÚ.KÛþyJŽûÈÎŠ¸¾i»Nik[èÎ{›Î{¨Î˜®h‹.8" ¢¢WFFP¢ò.y›Îxûîikx˜ŽiÊÎ8.KÚXúþXXŽZèÎh‰yºîX˜Þi8ÞKÙÎûÈÎXhÞi»Nikˆ{>iÈikx˜ŽiÊÎ8" ¢¢.Kº^Kˆ¾iŠþiÊÎjÊjÚ>[Èþx˜ŽiÊÎi»NikXZ~Zëž8"#°¢6öç7Bæ÷FW3ÖÖæ–fW7Bæ6öçFVçBæÖ†—FVÓÓâ#ÆÆ“â"¶W66T‡FÖÂ†—FVÒ’²#ÂöÆ“â"’æ¦ö–â‚""“°¢6öç7B7F–öç3Öf÷&6V@¢òsÆF—b6Æ73Ò'&VÆV6R×WFFRÖ7F–öç2#ãÆ'WGFöâG—SÒ&'WGFöâ"6Æ73Ò'&VÆV6R×WFFR×&–Ö'’"FF×&VÆV6R×WFFRÖ7F–öãÒ'&VÆöB#îz¸¾XÛ>i»NikÂö'WGFöããÂöF—câp¢¢WFFP¢òsÆF—b6Æ73Ò'&VÆV6R×WFFRÖ7F–öç2#ãÆ'WGFöâG—SÒ&'WGFöâ"FF×&VÆV6R×WFFRÖ7F–öãÒ&ÆFW"#îzˆÞ[èÎi»NikÂö'WGFöããÆ'WGFöâG—SÒ&'WGFöâ"6Æ73Ò'&VÆV6R×WFFR×&–Ö'’"FF×&VÆV6R×WFFRÖ7F–öãÒ'&VÆöB#îz¸¾XÛ>i»NikÂö'WGFöããÂöF—câp¢¢sÆF—b6Æ73Ò'&VÆV6R×WFFRÖ7F–öç2#ãÆ'WGFöâG—SÒ&'WGFöâ"6Æ73Ò'&VÆV6R×WFFR×&–Ö'’"FF×&VÆV6R×WFFRÖ7F–öãÒ&6¶æ÷vÆVFvR#îh‰yú^˜>K¨cÂö'WGFöããÂöF—câs°¢&WGW&â€¢sÇ6V7F–öâ6Æ73Ò'&VÆV6R×WFFRÖFWF–Â"FF×&VÆV6R×WFFRÖ¶–æCÒ"r¶W66T‡FÖÂ†¶–æB’²r#âr°¢sÇ6Æ73Ò'&VÆV6R×WFFR×fW'6–öâ#âr¶W66T‡FÖÂ†Öæ–fW7Bç&VÆV6UfW'6–öâ’²~8r¶W66T‡FÖÂ†Öæ–fW7Bç7VÖÖ'’’²sÂ÷âr°¢sÇ6Æ73Ò'&VÆV6R×WFFRÖ–çG&ò#âr¶W66T‡FÖÂ†–çG&ò’²sÂ÷âr°¢sÆƒ3îi»NikXZ~Zë“Âöƒ3âr°¢sÇVÂ6Æ73Ò'&VÆV6R×WFFRÖæ÷FW2#âr¶æ÷FW2²sÂ÷VÃâr°¢sÇ6Æ73Ò'&VÆV6R×WFFR×V&Æ—6†VB#îy›Î[ˆ>i˜.™i>ûÉ¢r¶W66T‡FÖÂ†f÷&ÖEV&Æ—6†VDB†Öæ–fW7BçV&Æ—6†VDB’’²sÂ÷âr°¢7F–öç2°¢sÂ÷6V7F–öãâp¢“°¢Ð ¢gVæ7F–öâf÷&ÖEV&Æ—6†VDB‡fÇVR—°¢6öç7BFFSÖæWrFFR‡fÇVR“°¢–b„çVÖ&W"æ—4æâ†FFRævWEF–ÖR‚’’—²&WGW&âfÇVS²Ð¢6öç7B———“ÖFFRævWDgVÆÅ–V"‚“°¢6öç7BÖÓÕ7G&–ær†FFRævWDÖöçF‚‚’³’çE7F'Bƒ"Â#"“°¢6öç7BFCÕ7G&–ær†FFRævWDFFR‚’’çE7F'Bƒ"Â#"“°¢&WGW&â———’²"Ò"¶ÖÒ²"Ò"¶FC°¢Ð ¢gVæ7F–öâ&–æE&VÆV6T7F–öç2†&öG’Æ¶–æB—°¢–b‚&öG—ÇÇG—Vöb&öG’çVW'•6VÆV7F÷$ÆÂÓÒ&gVæ7F–öâ"—²&WGW&ã²Ð¢&öG’çVW'•6VÆV7F÷$ÆÂ‚%¶FF×&VÆV6R×WFFRÖ7F–öåÒ"’æf÷$V6‚†'WGFöãÓç°¢'WGFöâæFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚“Óç°¢6öç7B7F–öãÖ'WGFöâævWDGG&–'WFR‚&FF×&VÆV6R×WFFRÖ7F–öâ"“°¢–b†7F–öãÓÓÒ'&VÆöB"—²&WVW7E&VÆöB‚“²Ð¢VÇ6R–b†7F–öãÓÓÒ&ÆFW""—²FVfW$æ÷&ÖÅWFFR‚“²Ð¢VÇ6R–b†7F–öãÓÓÒ&6¶æ÷vÆVFvR"—²6¶æ÷vÆVFvT7W'&VçE&VÆV6R‚“²Ð¢Ò“°¢Ò“°¢Ð ¢gVæ7F–öâ÷Vå&VÆV6TFWF–Â†¶–æB—°¢6öç7BÖæ–fW7C×7FFRæÖæ–fW7C°¢6öç7B'G3ÖvWE6†&VDÖöFÅ'G2‚“°¢–b‚Öæ–fW7GÇÂ'G2—²&WGW&âfÇ6S²Ð¢6öç7Bf÷&6VCÖ¶–æCÓÓÒ&f÷&6VB#°¢–b†f÷&6VBbb6å6fVÇ•&VÆöDf÷%WFFR‚’—°¢7FFRçVæF–ætf÷&6VEWFFS×G'VS°¢6†÷tÖ'VVR†Öæ–fW7BÂ&f÷&6VB×VæF–ær"“°¢66†VGVÆUVæF–æu&W6öÇWF–öâ‚“°¢&WGW&âfÇ6S°¢Ð ¢ò¢W†—7F–ær÷væW"W&f÷&×2—G2æ÷&ÖÂ&÷'&÷vVBÖVÆVÖVçB6ÆVçWf—'7Bâ¢ð¢7FFRæf÷&6VDÖöFÄÆö6³ÖfÇ6S°¢–b‡G—VöbvÆö&Âæ6Æ÷6T†öÖTfVGW&SÓÓÒ&gVæ7F–öâ"—°¢vÆö&Âæ6Æ÷6T†öÖTfVGW&R‚“°¢ÖVÇ6W°¢'G2æÖöFÂæ6Æ74Æ—7Bç&VÖ÷fR‚'6†÷r"“°¢Ð ¢'G2æÖöFÂæ6Æ74Æ—7BæFB‚'&VÆV6R×WFFRÖÖöFÂ"“°¢'G2æÖöFÂæ6Æ74Æ—7BçFövvÆR‚'&VÆV6R×WFFRÖf÷&6VB"Æf÷&6VB“°¢'G2çF—FÆRçFW‡D6öçFVçCÖÖæ–fW7BçF—FÆS°¢'G2æ&öG’æ–ææW$…DÔÃ×&VæFW%&VÆV6T6öçFVçB†Öæ–fW7BÆ¶–æB“°¢'G2æÖöFÂæ6Æ74Æ—7BæFB‚'6†÷r"“°¢7FFRæÖöFÄ÷Vã×G'VS°¢7FFRæÖöFÄ¶–æCÖ¶–æC°¢7FFRæf÷&6VDÖöFÄÆö6³Öf÷&6VC°¢&–æE&VÆV6T7F–öç2‡'G2æ&öG’Æ¶–æB“°¢–b†f÷&6VB—°¢6öç7B&–Ö'“×'G2æ&öG’çVW'•6VÆV7F÷"‚"ç&VÆV6R×WFFR×&–Ö'’"“°¢–b‡&–Ö'’bgG—Vöb&–Ö'’æfö7W3ÓÓÒ&gVæ7F–öâ"—²&–Ö'’æfö7W2‚“²Ð¢Ð¢&WGW&âG'VS°¢Ð ¢gVæ7F–öâöå6†&VDÖöFÄ6Æ÷6VB‚—°¢6öç7B'G3ÖvWE6†&VDÖöFÅ'G2‚“°¢–b‡'G2—°¢'G2æÖöFÂæ6Æ74Æ—7Bç&VÖ÷fR‚'&VÆV6R×WFFRÖÖöFÂ"Â'&VÆV6R×WFFRÖf÷&6VB"“°¢Ð¢7FFRæÖöFÄ÷VãÖfÇ6S°¢7FFRæÖöFÄ¶–æCÖçVÆÃ°¢7FFRæf÷&6VDÖöFÄÆö6³ÖfÇ6S°¢Ð ¢gVæ7F–öâ6†÷VÆE&WfVçE6†&VDÖöFÄ6Æ÷6R‚—°¢&WGW&â7FFRæf÷&6VDÖöFÄÆö6²bg7FFRæÖöFÄ÷Vã°¢Ð ¢gVæ7F–öâ—4f÷&6VEWFFT&Æö6¶–ær‚—°¢&WGW&â6†÷VÆE&WfVçE6†&VDÖöFÄ6Æ÷6R‚“°¢Ð ¢gVæ7F–öâææ÷Væ6Tf÷&6VDÆö6²‚—°¢6öç7B'G3ÖvWE6†&VDÖöFÅ'G2‚“°¢–b‡'G2bg'G2æÖöFÂæ6Æ74Æ—7Bæ6öçF–ç2‚'&VÆV6R×WFFRÖf÷&6VB"’—°¢6öç7B&–Ö'“×'G2æ&öG’çVW'•6VÆV7F÷"‚"ç&VÆV6R×WFFR×&–Ö'’"“°¢–b‡&–Ö'’bgG—Vöb&–Ö'’æfö7W3ÓÓÒ&gVæ7F–öâ"—²&–Ö'’æfö7W2‚“²Ð¢Ð¢Ð ¢gVæ7F–öâ6Æ÷6U&VÆV6TFWF–Â‚—°¢7FFRæf÷&6VDÖöFÄÆö6³ÖfÇ6S°¢–b‡G—VöbvÆö&Âæ6Æ÷6T†öÖTfVGW&SÓÓÒ&gVæ7F–öâ"—°¢vÆö&Âæ6Æ÷6T†öÖTfVGW&R‚“°¢ÖVÇ6W°¢6öç7B'G3ÖvWE6†&VDÖöFÅ'G2‚“°¢–b‡'G2—²'G2æÖöFÂæ6Æ74Æ—7Bç&VÖ÷fR‚'6†÷r"“²Ð¢öå6†&VDÖöFÄ6Æ÷6VB‚“°¢Ð¢Ð ¢gVæ7F–öâ6¶æ÷vÆVFvT7W'&VçE&VÆV6R‚—°¢Ö&´7W'&VçDæ÷F–6U6VVâ‚“°¢7FFRçVæF–ætææ÷Væ6VÖVçCÖfÇ6S°¢6Æ÷6U&VÆV6TFWF–Â‚“°¢&Vg&W6„æ÷F–f–6F–öäF÷G2‚“°¢Ð ¢gVæ7F–öâFVfW$æ÷&ÖÅWFFR‚—°¢6öç7BÖæ–fW7C×7FFRæÖæ–fW7C°¢–b‚Öæ–fW7B—²&WGW&ã²Ð¢Ö&´7W'&VçDæ÷F–6U6VVâ‚“°¢†–FTÖ'VVR‚“°¢6Æ÷6U&VÆV6TFWF–Â‚“°¢&Vg&W6„æ÷F–f–6F–öäF÷G2‚“°¢Ð ¢gVæ7F–öâW&f÷&Õ&VÆöB‚—°¢G'—°¢–b†vÆö&ÂæÆö6F–öâbgG—VöbvÆö&ÂæÆö6F–öâç&VÆöCÓÓÒ&gVæ7F–öâ"—°¢vÆö&ÂæÆö6F–öâç&VÆöB‚“°¢Ð¢Ö6F6‚…ò—²Ð¢Ð ¢gVæ7F–öâ&WVW7E&VÆöB‚—°¢6öç7BÖæ–fW7C×7FFRæÖæ–fW7C°¢–b‚Öæ–fW7B—²&WGW&âfÇ6S²Ð¢Ö&´7W'&VçDæ÷F–6U6VVâ‚“°¢6öç7Bf÷&6VCÖ—4f÷&6VDf÷$ÆöFVEfW'6–öâ†Öæ–fW7B“°¢–b‚6å6fVÇ•&VÆöDf÷%WFFR‚’—°¢–b†f÷&6VB—²7FFRçVæF–ætf÷&6VEWFFS×G'VS²Ð¢VÇ6W²7FFRçVæF–ætæ÷&ÖÅ&VÆöC×G'VS²Ð¢7FFRæf÷&6VDÖöFÄÆö6³ÖfÇ6S°¢6Æ÷6U&VÆV6TFWF–Â‚“°¢6†÷tÖ'VVR†Öæ–fW7BÆf÷&6VCò&f÷&6VB×VæF–ær#¢&æ÷&ÖÂ×VæF–ær"“°¢66†VGVÆUVæF–æu&W6öÇWF–öâ‚“°¢&WGW&âfÇ6S°¢Ð¢W&f÷&Õ&VÆöB‚“°¢&WGW&âG'VS°¢Ð ¢gVæ7F–öâ†5VæF–æuv÷&²‚—°¢&WGW&â7FFRçVæF–ætf÷&6VEWFFWÇÇ7FFRçVæF–ætæ÷&ÖÅ&VÆöGÇÇ7FFRçVæF–ætææ÷Væ6VÖVçC°¢Ð ¢gVæ7F–öâ66†VGVÆUVæF–æu&W6öÇWF–öâ‚—°¢–b‚†5VæF–æuv÷&²‚—ÇÇ7FFRçVæF–æuF–ÖW"ÓÖçVÆÂ—²&WGW&ã²Ð¢7FFRçVæF–æuF–ÖW#ÖvÆö&Âç6WEF–ÖV÷WB‚‚“Óç°¢7FFRçVæF–æuF–ÖW#ÖçVÆÃ°¢&W6öÇfUVæF–æuv†Vå6fR‚“°¢ÒÅTäD”äuõ$T4„T4µôÕ2“°¢Ð ¢gVæ7F–öâ&W6öÇfUVæF–æuv†Vå6fR‚—°¢–b‚†5VæF–æuv÷&²‚’—²&WGW&ã²Ð¢–b‚6å6fVÇ•&VÆöDf÷%WFFR‚’—°¢66†VGVÆUVæF–æu&W6öÇWF–öâ‚“°¢&WGW&ã°¢Ð¢–b‡7FFRçVæF–ætf÷&6VEWFFR—°¢7FFRçVæF–ætf÷&6VEWFFSÖfÇ6S°¢÷Vå&VÆV6TFWF–Â‚&f÷&6VB"“°¢&WGW&ã°¢Ð¢–b‡7FFRçVæF–ætæ÷&ÖÅ&VÆöB—°¢7FFRçVæF–ætæ÷&ÖÅ&VÆöCÖfÇ6S°¢W&f÷&Õ&VÆöB‚“°¢&WGW&ã°¢Ð¢–b‡7FFRçVæF–ætææ÷Væ6VÖVçBbf†5Vç&VE&VÆV6Tæ÷F–6R‚’—°¢7FFRçVæF–ætææ÷Væ6VÖVçCÖfÇ6S°¢÷Vå&VÆV6TFWF–Â‚&6¶æ÷vÆVFvR"“°¢Ð¢Ð ¢gVæ7F–öâ&Vg&W6„æ÷F–f–6F–öäF÷G2‚—°¢G'—°¢–b‡G—VöbvÆö&ÂçcCWFFTæ÷F–f–6F–öäF÷G3ÓÓÒ&gVæ7F–öâ"—°¢vÆö&ÂçcCWFFTæ÷F–f–6F–öäF÷G2‚“°¢Ð¢Ö6F6‚…ò—²Ð¢Ð ¢gVæ7F–öâ&Vg&W6„ææ÷Væ6VÖVçE7W&f6R‚—°¢6öç7B'G3ÖvWE6†&VDÖöFÅ'G2‚“°¢–b€¢'G7ÇÇ7FFRæÖöFÄ÷VçÇÂ'G2æÖöFÂæ6Æ74Æ—7Bæ6öçF–ç2‚'6†÷r"—ÇÀ¢'G2çF—FÆRçFW‡D6öçFVçBÓÒ.XZÎY¢ ¢—°¢&WGW&ã°¢Ð¢6öç7B6öçFVçC×&VæFW$ææ÷Væ6VÖVçD6öçFVçB‚“°¢–b†6öçFVçB—²'G2æ&öG’æ–ææW$…DÔÃÖ6öçFVçC²Ð¢Ð ¢gVæ7F–öâ&VæFW$ææ÷Væ6VÖVçD6öçFVçB‚—°¢6öç7BÖæ–fW7C×7FFRæÖæ–fW7C°¢–b‚Öæ–fW7GÇÂÖæ–fW7BçV&Æ–4æ÷F–6R—²&WGW&â"#²Ð¢6öç7BÆöFVC×7FFRæÆöFVE&VÆV6UfW'6–öçÇÆvWDÆöFVE&VÆV6UfW'6–öâ‚“°¢6öç7B6ö×&—6öãÖÆöFVCö6ö×&UfW'6–öç2†ÆöFVBÆÖæ–fW7Bç&VÆV6UfW'6–öâ“¦çVÆÃ°¢6öç7BæVVG5WFFSÖ6ö×&—6öâÓÖçVÆÂbf6ö×&—6öãÃ°¢6öç7B7F–öäÆ&VÃÖæVVG5WFFSò.iú^yÈ¾i»NikXZ~Zë’#¢.iú^yÈ¾iÊÎjÊi»Nik#°¢6öç7B7FGW3ÖæVVG5WFFP¢ò.[{.iÈžikx˜ŽiÊÎXúþi»NikûÉ¾ZèÎh‰yºîX˜Þi8ÞKÙÎ[èÎXÛ>Xúþi»Nik8" ¢¢.yºîX˜ÞjÚ>[Èþx˜ŽiÊÎy¨Ni»NikXZ~Zëž8"#°¢&WGW&â€¢sÇ6V7F–öâ6Æ73Ò'&VÆV6R×WFFRÖææ÷Væ6VÖVçB#âr°¢sÇ6Æ73Ò'&VÆV6R×WFFRÖææ÷Væ6VÖVçB×fW'6–öâ#âr¶W66T‡FÖÂ†Öæ–fW7Bç&VÆV6UfW'6–öâ’²ri»NikÂ÷âr°¢sÇâr¶W66T‡FÖÂ†Öæ–fW7Bç7VÖÖ'’’²sÂ÷âr°¢sÇ6Æ73Ò'&VÆV6R×WFFRÖææ÷Væ6VÖVçB×7FGW2#âr¶W66T‡FÖÂ‡7FGW2’²sÂ÷âr°¢sÆ'WGFöâG—SÒ&'WGFöâ"6Æ73Ò'&VÆV6R×WFFR×&–Ö'’"öæ6Æ–6³Ò'v–æF÷räf÷W%7–Ö&öÇ5&VÆV6UWFFRæ÷Väg&öÔææ÷Væ6VÖVçB‚’#âr¶7F–öäÆ&VÂ²sÂö'WGFöãâr°¢sÂ÷6V7F–öãâp¢“°¢Ð ¢gVæ7F–öâ÷Väg&öÔææ÷Væ6VÖVçB‚—°¢6öç7BÖæ–fW7C×7FFRæÖæ–fW7C°¢–b‚Öæ–fW7B—²&WGW&âfÇ6S²Ð¢6öç7BÆöFVC×7FFRæÆöFVE&VÆV6UfW'6–öçÇÆvWDÆöFVE&VÆV6UfW'6–öâ‚“°¢6öç7BæVVG5WFFSÖÆöFVBbf6ö×&UfW'6–öç2†ÆöFVBÆÖæ–fW7Bç&VÆV6UfW'6–öâ“Ã°¢&WGW&â÷Vå&VÆV6TFWF–Â†æVVG5WFFRbf—4f÷&6VDf÷$ÆöFVEfW'6–öâ†Öæ–fW7B“ò&f÷&6VB#¦æVVG5WFFSò'WFFR#¢&6¶æ÷vÆVFvR"“°¢Ð ¢7–æ2gVæ7F–öâfWF6„Öæ–fW7B‚—°¢6öç7BfWF6†W#×G—VöbvÆö&ÂæfWF6ƒÓÓÒ&gVæ7F–öâ#övÆö&ÂæfWF6‚æ&–æB†vÆö&Â“¦çVÆÃ°¢–b‚fWF6†W"—²&WGW&âçVÆÃ²Ð¢ÆWBF–ÖV÷WD–CÖçVÆÃ°¢ÆWB6öçG&öÆÆW#ÖçVÆÃ°¢G'—°¢–b‡G—VöbvÆö&Âä&÷'D6öçG&öÆÆW#ÓÓÒ&gVæ7F–öâ"—°¢6öçG&öÆÆW#ÖæWrvÆö&Âä&÷'D6öçG&öÆÆW"‚“°¢F–ÖV÷WD–CÖvÆö&Âç6WEF–ÖV÷WB‚‚“Óæ6öçG&öÆÆW"æ&÷'B‚’Å$UTU5EõD”ÔTõUEôÕ2“°¢Ð¢ÆWBW&ÃÕ$TÄT4UôäõD”4UõDƒ°¢G'—°¢6öç7B&6SÒ†vÆö&ÂæFö7VÖVçBbfvÆö&ÂæFö7VÖVçBæ&6UU$’—ÇÂ†vÆö&ÂæÆö6F–öâbfvÆö&ÂæÆö6F–öâæ‡&Vb—ÇÇVæFVf–æVC°¢6öç7B'6VCÖæWrU$Â…$TÄT4UôäõD”4UõD‚Æ&6R“°¢'6VBç6V&6…&×2ç6WB‚'&VÆV6R×WFFRÖ6†V6²"Å7G&–ær†æ÷r‚’’“°¢W&Ã×'6VBçFõ7G&–ær‚“°¢Ö6F6‚…ò—°¢W&ÃÕ$TÄT4UôäõD”4UõD‚²#÷&VÆV6R×WFFRÖ6†V6³Ò"¶æ÷r‚“°¢Ð¢6öç7B&W7öç6SÖv—BfWF6†W"‡W&ÂÇ°¢66†S¢&æò×7F÷&R"À¢†VFW'3§²$66†RÔ6öçG&öÂ#¢&æòÖ66†R'ÒÀ¢âââ†6öçG&öÆÆW#÷·6–væÃ¦6öçG&öÆÆW"ç6–væÇÓ§·Ò¢Ò“°¢–b‚&W7öç6WÇÇ&W7öç6Ræö³ÓÓÖfÇ6WÇÇG—Vöb&W7öç6Ræ§6öâÓÒ&gVæ7F–öâ"—²&WGW&âçVÆÃ²Ð¢&WGW&âfÆ–FFTÖæ–fW7B†v—B&W7öç6Ræ§6öâ‚’“°¢Ö6F6‚…ò—°¢ò¢öffÆ–æRÂF–ÖV÷WBÂÖÆf÷&ÖVB¥4ôâæBFV×÷&'’FWÆ÷’v2×W7BæWfW"&Æö6²Æ’â¢ð¢&WGW&âçVÆÃ°¢Öf–æÆÇ—°¢–b‡F–ÖV÷WD–BÓÖçVÆÂ—²vÆö&Âæ6ÆV%F–ÖV÷WB‡F–ÖV÷WD–B“²Ð¢Ð¢Ð ¢gVæ7F–öâ†æFÆTÖæ–fW7B†Öæ–fW7B—°¢–b‚Öæ–fW7B—²&WGW&ã²Ð¢7FFRæÖæ–fW7CÖÖæ–fW7C°¢7FFRæÆöFVE&VÆV6UfW'6–öãÖvWDÆöFVE&VÆV6UfW'6–öâ‚“°¢–b‚Öæ–fW7BçV&Æ–4æ÷F–6WÇÂ7FFRæÆöFVE&VÆV6UfW'6–öâ—°¢†–FTÖ'VVR‚“°¢&WGW&ã°¢Ð¢6öç7B6ö×&—6öãÖ6ö×&UfW'6–öç2‡7FFRæÆöFVE&VÆV6UfW'6–öâÆÖæ–fW7Bç&VÆV6UfW'6–öâ“°¢–b†6ö×&—6öãÓÓÖçVÆÇÇÆ6ö×&—6öãã—²&WGW&ã²Ð¢–b†6ö×&—6öãÓÓÓ—°¢&Vg&W6„ææ÷Væ6VÖVçE7W&f6R‚“°¢&Vg&W6„æ÷F–f–6F–öäF÷G2‚“°¢6öç7B6†&VDÖöFÃÖvWE6†&VDÖöFÅ'G2‚“°¢–b€¢†5Vç&VE&VÆV6Tæ÷F–6R‚’b`¢7FFRæÖöFÄ÷Vâb`¢‡6†&VDÖöFÂbg6†&VDÖöFÂæÖöFÂæ6Æ74Æ—7Bæ6öçF–ç2‚'6†÷r"’¢—°¢–b†6å6fVÇ•&VÆöDf÷%WFFR‚’—°¢÷Vå&VÆV6TFWF–Â‚&6¶æ÷vÆVFvR"“°¢ÖVÇ6W°¢7FFRçVæF–ætææ÷Væ6VÖVçC×G'VS°¢6†÷tÖ'VVR†Öæ–fW7BÂ&ææ÷Væ6VÖVçB×VæF–ær"“°¢66†VGVÆUVæF–æu&W6öÇWF–öâ‚“°¢Ð¢Ð¢&WGW&ã°¢Ð ¢6öç7Bf÷&6VCÖ—4f÷&6VDf÷$ÆöFVEfW'6–öâ†Öæ–fW7B“°¢–b†f÷&6VB—°¢–b†—4f÷&6VEWFFT&Æö6¶–ær‚’—²&WGW&ã²Ð¢7FFRçVæF–ætf÷&6VEWFFS×G'VS°¢6†÷tÖ'VVR†Öæ–fW7BÆ6å6fVÇ•&VÆöDf÷%WFFR‚“ò&f÷&6VB#¢&f÷&6VB×VæF–ær"“°¢–b†6å6fVÇ•&VÆöDf÷%WFFR‚’—°¢&W6öÇfUVæF–æuv†Vå6fR‚“°¢ÖVÇ6W°¢66†VGVÆUVæF–æu&W6öÇWF–öâ‚“°¢Ð¢&WGW&ã°¢Ð ¢–b‡6†÷VÆE6†÷u&VÖ–æFW"†Öæ–fW7B’—°¢&VÖVÖ&W%&VÖ–æFW"†Öæ–fW7B“°¢6†÷tÖ'VVR†Öæ–fW7BÂ'WFFR"“°¢Ð¢&Vg&W6„ææ÷Væ6VÖVçE7W&f6R‚“°¢&Vg&W6„æ÷F–f–6F–öäF÷G2‚“°¢Ð ¢gVæ7F–öâ6†V6´f÷%WFFR‡&V6öâÆ÷F–öç2—°¢6öç7Bf÷&6SÒ†÷F–öç2bf÷F–öç2æf÷&6R“°¢–b‡7FFRæ6†V6¶–ær—²&WGW&â7FFRæ6†V6¶–æs²Ð¢–b‚f÷&6Rbg7FFRæÆ7D6†V6´Bbfæ÷r‚’×7FFRæÆ7D6†V6´CÄÔ”åô4„T4µôtôÕ2—°¢&WGW&â&öÖ—6Rç&W6öÇfR†çVÆÂ“°¢Ð¢7FFRæÆ7D6†V6´CÖæ÷r‚“°¢7FFRæ6†V6¶–æsÖfWF6„Öæ–fW7B‚’çF†Vâ†Öæ–fW7CÓç°¢–b†Öæ–fW7B—²†æFÆTÖæ–fW7B†Öæ–fW7BÇ&V6öâ“²Ð¢&WGW&âÖæ–fW7C°¢Ò’æf–æÆÇ’‚‚“Óç°¢7FFRæ6†V6¶–æsÖçVÆÃ°¢Ò“°¢&WGW&â7FFRæ6†V6¶–æs°¢Ð ¢gVæ7F–öâ7F'B‚—°¢–b‡7FFRç7F'FVB—²&WGW&ã²Ð¢7FFRç7F'FVC×G'VS°¢6†V6´f÷%WFFR‚&&ö÷B"Ç¶f÷&6S§G'VWÒ“°¢7FFRçöÆÅF–ÖW#ÖvÆö&Âç6WD–çFW'fÂ‚‚“Óæ6†V6´f÷%WFFR‚'öÆÂ"’Ä4„T4µô”åDU%dÅôÕ2“°¢6öç7BFö7VÖVçE&VcÖvÆö&ÂæFö7VÖVçC°¢–b†Fö7VÖVçE&VbbgG—VöbFö7VÖVçE&VbæFDWfVçDÆ—7FVæW#ÓÓÒ&gVæ7F–öâ"—°¢Fö7VÖVçE&VbæFDWfVçDÆ—7FVæW"‚'f—6–&–Æ—G–6†ævR"Â‚“Óç°¢–b†Fö7VÖVçE&Vbæ†–FFVçÇÆFö7VÖVçE&Vbçf—6–&–Æ—G•7FFSÓÓÒ&†–FFVâ"—²&WGW&ã²Ð¢6†V6´f÷%WFFR‚'f—6–&–Æ—G’"“°¢Ò“°¢Fö7VÖVçE&VbæFDWfVçDÆ—7FVæW"‚&¶W–F÷vâ"ÆWfVçCÓç°¢–b†WfVçBbfWfVçBæ¶W“ÓÓÒ$W66R"bf—4f÷&6VEWFFT&Æö6¶–ær‚’—°¢WfVçBç&WfVçDFVfVÇB‚“°¢–b‡G—VöbWfVçBç7F÷–ÖÖVF–FU&÷vF–öãÓÓÒ&gVæ7F–öâ"—²WfVçBç7F÷–ÖÖVF–FU&÷vF–öâ‚“²Ð¢ææ÷Væ6Tf÷&6VDÆö6²‚“°¢Ð¢ÒÇG'VR“°¢Ð¢–b‡G—VöbvÆö&ÂæFDWfVçDÆ—7FVæW#ÓÓÒ&gVæ7F–öâ"—°¢vÆö&ÂæFDWfVçDÆ—7FVæW"‚&öæÆ–æR"Â‚“Óæ6†V6´f÷%WFFR‚&öæÆ–æR"’“°¢Ð¢Ð ¢gVæ7F–öâ7F÷‚—°¢–b‡7FFRçöÆÅF–ÖW"ÓÖçVÆÂ—²vÆö&Âæ6ÆV$–çFW'fÂ‡7FFRçöÆÅF–ÖW"“²7FFRçöÆÅF–ÖW#ÖçVÆÃ²Ð¢–b‡7FFRçVæF–æuF–ÖW"ÓÖçVÆÂ—²vÆö&Âæ6ÆV%F–ÖV÷WB‡7FFRçVæF–æuF–ÖW"“²7FFRçVæF–æuF–ÖW#ÖçVÆÃ²Ð¢7FFRç7F'FVCÖfÇ6S°¢Ð ¢gVæ7F–öâvWE7FFR‚—°¢&WGW&â°¢ÆöFVE&VÆV6UfW'6–öã§7FFRæÆöFVE&VÆV6UfW'6–öçÇÆvWDÆöFVE&VÆV6UfW'6–öâ‚’À¢f–Æ&ÆU&VÆV6UfW'6–öã§7FFRæÖæ–fW7Bbg7FFRæÖæ–fW7Bç&VÆV6UfW'6–öçÇÆçVÆÂÀ¢æ÷F–6T–C§7FFRæÖæ–fW7Bbg7FFRæÖæ–fW7Bææ÷F–6T–GÇÆçVÆÂÀ¢VæF–ætæ÷&ÖÅ&VÆöC§7FFRçVæF–ætæ÷&ÖÅ&VÆöBÀ¢VæF–ætf÷&6VEWFFS§7FFRçVæF–ætf÷&6VEWFFRÀ¢VæF–ætææ÷Væ6VÖVçC§7FFRçVæF–ætææ÷Væ6VÖVçBÀ¢7&—F–6Ä÷W&F–öä6÷VçC§7FFRæ7&—F–6Ä÷W&F–öç2ç6—¦RÀ¢Vç6fU&V6öç3¦vWEVç6fU&V6öç2‚’ç6Æ–6R‚’À¢öÆÄ–çFW'fÄ×3¤4„T4µô”åDU%dÅôÕ2À¢Ö–æ–×VÔ6†V6´v×3¤Ô”åô4„T4µôtôÕ0¢Ó°¢Ð ¢vÆö&Âäf÷W%7–Ö&öÇ5&VÆV6UWFFSÔö&¦V7Bæg&VW¦R‡°¢7F'BÀ¢7F÷À¢6†V6´f÷%WFFRÀ¢vWE7FFRÀ¢'6UfW'6–öâÀ¢6ö×&UfW'6–öç2À¢6å6fVÇ•&VÆöDf÷%WFFRÀ¢&Vv–ä7&—F–6Ä÷W&F–öâÀ¢æ÷F–g•6fU7FFS§&W6öÇfUVæF–æuv†Vå6fRÀ¢†5Vç&VE&VÆV6Tæ÷F–6RÀ¢&VæFW$ææ÷Væ6VÖVçD6öçFVçBÀ¢÷Väg&öÔææ÷Væ6VÖVçBÀ¢÷Vå&VÆV6TFWF–ÂÀ¢&WVW7E&VÆöBÀ¢—4f÷&6VEWFFT&Æö6¶–ærÀ¢6†÷VÆE&WfVçE6†&VDÖöFÄ6Æ÷6RÀ¢ææ÷Væ6Tf÷&6VDÆö6²À¢öå6†&VDÖöFÄ6Æ÷6V@¢Ò“°¢vÆö&Âæ6å6fVÇ•&VÆöDf÷%WFFSÖ6å6fVÇ•&VÆöDf÷%WFFS° ¢6öç7BFö7VÖVçE&VcÖvÆö&ÂæFö7VÖVçC°¢–b†Fö7VÖVçE&VbbgG—VöbFö7VÖVçE&VbæFDWfVçDÆ—7FVæW#ÓÓÒ&gVæ7F–öâ"—°¢Fö7VÖVçE&VbæFDWfVçDÆ—7FVæW"‚&f÷W"×7–Ö&öÇ3§7F'GW×&VG’"Ç7F'BÇ¶öæ6S§G'VWÒ“°¢Ð¢G'—°¢6öç7B7F'GW7FFSÖvÆö&Âäf÷W%7–Ö&öÇ57F'GWöÆ–7’bfvÆö&Âäf÷W%7–Ö&öÇ57F'GWöÆ–7’ævWE7FFRbfvÆö&Âäf÷W%7–Ö&öÇ57F'GWöÆ–7’ævWE7FFR‚“°¢–b‡7F'GW7FFSÓÓÒ%$TE’'ÇÇ7F'GW7FFSÓÓÒ$ôddÄ”äUõ$TE’"—°¢vÆö&Âç6WEF–ÖV÷WB‡7F'BÃ“°¢Ð¢Ö6F6‚…ò—²Ð §Ò’‡v–æF÷r“° 