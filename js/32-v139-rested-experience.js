/*
   V139 — 休息經驗

   - 離線／切到背景每2分鐘累積1場，最多300場。
   - 一般練功勝利消耗1場，該場EXP變成2倍。
   - 元素匣啟用期間不累積；元素匣與副本也不使用、不消耗。
   - 狀態存於獨立localStorage key，不改既有主存檔結構。
*/
(function installV139RestedExperience(){
    "use strict";

    const RESTED_EXP_STORAGE_KEY="v139_rested_exp_state";
    const RESTED_EXP_MAX_BATTLES=300;
    const RESTED_EXP_MINUTES_PER_BATTLE=2;
    const RESTED_EXP_MS_PER_BATTLE=RESTED_EXP_MINUTES_PER_BATTLE*60*1000;
    const RESTED_EXP_HEARTBEAT_MS=30*1000;

    function emptyRestedState(now){
        return {
            battles:0,
            progressMs:0,
            lastSeenAt:now,
            blockedByElementBox:false
        };
    }

    function hasCreatedCharacter(){
        return typeof player!=="undefined" && !!(player && player.id);
    }

    function sanitizeRestedState(raw,now){
        const source=raw && typeof raw==="object" ? raw : {};
        return {
            battles:Math.min(
                RESTED_EXP_MAX_BATTLES,
                Math.max(0,Math.floor(Number(source.battles)||0))
            ),
            progressMs:Math.max(
                0,
                Math.min(
                    RESTED_EXP_MS_PER_BATTLE-1,
                    Math.floor(Number(source.progressMs)||0)
                )
            ),
            lastSeenAt:Number.isFinite(Number(source.lastSeenAt))
                ? Math.min(now,Number(source.lastSeenAt))
                : now,
            blockedByElementBox:source.blockedByElementBox===true
        };
    }

    function readRestedState(now){
        if(!hasCreatedCharacter()){
            try{ localStorage.removeItem(RESTED_EXP_STORAGE_KEY); }catch(_){ }
            return emptyRestedState(now);
        }
        try{
            const raw=JSON.parse(localStorage.getItem(RESTED_EXP_STORAGE_KEY)||"null");
            return sanitizeRestedState(raw,now);
        }catch(_){
            return emptyRestedState(now);
        }
    }

    let restedState=readRestedState(Date.now());

    function persistRestedState(){
        if(!hasCreatedCharacter()){
            try{ localStorage.removeItem(RESTED_EXP_STORAGE_KEY); }catch(_){ }
            return;
        }
        try{
            localStorage.setItem(
                RESTED_EXP_STORAGE_KEY,
                JSON.stringify({
                    battles:restedState.battles,
                    progressMs:restedState.progressMs,
                    lastSeenAt:restedState.lastSeenAt,
                    blockedByElementBox:restedState.blockedByElementBox
                })
            );
        }catch(_){ }
    }

    function accrueRestedMilliseconds(elapsedMs){
        const safeElapsed=Math.max(0,Math.floor(Number(elapsedMs)||0));
        if(safeElapsed<=0 || restedState.battles>=RESTED_EXP_MAX_BATTLES){
            if(restedState.battles>=RESTED_EXP_MAX_BATTLES){
                restedState.progressMs=0;
            }
            return 0;
        }

        /* 超過累積上限所需的時間沒有差別，先封頂避免異常時鐘
           產生不必要的大數字。 */
        const cappedElapsed=Math.min(
            safeElapsed,
            RESTED_EXP_MAX_BATTLES*RESTED_EXP_MS_PER_BATTLE
        );
        const totalMs=restedState.progressMs+cappedElapsed;
        const earned=Math.floor(totalMs/RESTED_EXP_MS_PER_BATTLE);
        const accepted=Math.min(
            earned,
            RESTED_EXP_MAX_BATTLES-restedState.battles
        );

        restedState.battles+=accepted;
        restedState.progressMs=restedState.battles>=RESTED_EXP_MAX_BATTLES
            ? 0
            : totalMs-earned*RESTED_EXP_MS_PER_BATTLE;
        return accepted;
    }

    function getNextRestedBattleText(){
        if(restedState.battles>=RESTED_EXP_MAX_BATTLES){
            return "已達累積上限";
        }
        const remainingMs=Math.max(
            1,
            RESTED_EXP_MS_PER_BATTLE-restedState.progressMs
        );
        return "距離下一場約 "+Math.ceil(remainingMs/60000)+" 分鐘";
    }

    function updateRestedExperienceDisplay(){
        const count=document.getElementById("v139RestedExpCount");
        const next=document.getElementById("v139RestedExpNext");
        if(count){ count.textContent=String(restedState.battles); }
        if(next){ next.textContent=getNextRestedBattleText(); }
    }

    function renderRestedExperiencePanel(){
        return (
            '<section class="v139-rested-exp-panel" aria-label="休息經驗">'+
                '<div class="v139-rested-exp-heading">休息經驗</div>'+
                '<div class="v139-rested-exp-count">'+
                    '<strong id="v139RestedExpCount">'+restedState.battles+'</strong>'+
                    '<span>／'+RESTED_EXP_MAX_BATTLES+' 場</span>'+
                '</div>'+
                '<p>一般練功勝利 EXP ×2；元素匣啟用期間不累積，元素匣與副本也不會使用或消耗。</p>'+
                '<div class="v139-rested-exp-meta">'+
                    '每離線 '+RESTED_EXP_MINUTES_PER_BATTLE+' 分鐘累積 1 場・'+
                    '<span id="v139RestedExpNext">'+getNextRestedBattleText()+'</span>'+
                '</div>'+
            '</section>'
        );
    }

    if(typeof renderOfflineExpContent==="function"){
        const originalRenderOfflineExpContent=renderOfflineExpContent;
        renderOfflineExpContent=function(){
            return originalRenderOfflineExpContent.apply(this,arguments)+
                renderRestedExperiencePanel();
        };
    }

    function isElementBoxActive(){
        if(typeof window.v131GetElementBoxState!=="function"){ return false; }
        try{
            const state=window.v131GetElementBoxState();
            return !!(state && state.active);
        }catch(_){
            return false;
        }
    }

    function syncAccrualToNow(){
        const now=Date.now();
        if(!restedState.blockedByElementBox && !isElementBoxActive()){
            accrueRestedMilliseconds(now-restedState.lastSeenAt);
        }
        restedState.lastSeenAt=now;
        restedState.blockedByElementBox=isElementBoxActive();
        persistRestedState();
        updateRestedExperienceDisplay();
    }

    /* 第一次載入時，把上次心跳到現在的時間視為離線時間。
       新系統第一次出現時沒有舊狀態，不會倒推發送不存在的場數。 */
    if(hasCreatedCharacter()){
        syncAccrualToNow();
    }

    window.v139RestedExpConfig=Object.freeze({
        maxBattles:RESTED_EXP_MAX_BATTLES,
        minutesPerBattle:RESTED_EXP_MINUTES_PER_BATTLE,
        multiplier:2
    });

    window.v139GetRestedExpState=function(){
        return {
            battles:restedState.battles,
            progressMs:restedState.progressMs,
            maxBattles:RESTED_EXP_MAX_BATTLES,
            minutesPerBattle:RESTED_EXP_MINUTES_PER_BATTLE,
            blockedByElementBox:restedState.blockedByElementBox
        };
    };

    window.v139AccrueRestedMinutes=function(minutes){
        const earned=accrueRestedMilliseconds(
            Math.max(0,Number(minutes)||0)*60*1000
        );
        restedState.lastSeenAt=Date.now();
        persistRestedState();
        updateRestedExperienceDisplay();
        return earned;
    };

    window.v139TryConsumeRestedBattle=function(){
        if(restedState.battles<=0){
            return {applied:false,remainingBattles:0};
        }
        restedState.battles--;
        restedState.lastSeenAt=Date.now();
        persistRestedState();
        updateRestedExperienceDisplay();
        return {
            applied:true,
            remainingBattles:restedState.battles
        };
    };

    document.addEventListener("visibilitychange",function(){
        if(document.hidden){
            restedState.lastSeenAt=Date.now();
            restedState.blockedByElementBox=isElementBoxActive();
            persistRestedState();
            return;
        }
        syncAccrualToNow();
    });

    function markVisibleHeartbeat(){
        if(document.hidden){ return; }
        restedState.lastSeenAt=Date.now();
        restedState.blockedByElementBox=isElementBoxActive();
        persistRestedState();
    }

    window.addEventListener("pagehide",function(){
        if(!document.hidden){ markVisibleHeartbeat(); }
    });
    window.addEventListener("beforeunload",markVisibleHeartbeat);
    setInterval(markVisibleHeartbeat,RESTED_EXP_HEARTBEAT_MS);

})();
