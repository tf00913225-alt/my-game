/* Declarative startup contract shared by the state-machine owner and tests. */
(function installStartupContract(global){
    "use strict";
    if(!global||global.FourSymbolsStartupContract){ return; }

    const STATES=Object.freeze({
        BOOT_LOADING:"BOOT_LOADING",
        AUTH_RESOLVING:"AUTH_RESOLVING",
        AUTH_REQUIRED:"AUTH_REQUIRED",
        SAVE_LOADING:"SAVE_LOADING",
        MIGRATION_REQUIRED:"MIGRATION_REQUIRED",
        NEED_CHARACTER:"NEED_CHARACTER",
        READY:"READY",
        OFFLINE_READY:"OFFLINE_READY",
        ERROR:"ERROR"
    });
    const ALLOWED=Object.freeze({
        BOOT_LOADING:Object.freeze(["AUTH_RESOLVING","ERROR"]),
        AUTH_RESOLVING:Object.freeze(["AUTH_REQUIRED","SAVE_LOADING","ERROR"]),
        AUTH_REQUIRED:Object.freeze(["SAVE_LOADING","ERROR"]),
        SAVE_LOADING:Object.freeze(["AUTH_REQUIRED","MIGRATION_REQUIRED","NEED_CHARACTER","READY","OFFLINE_READY","ERROR"]),
        MIGRATION_REQUIRED:Object.freeze(["READY","AUTH_REQUIRED","ERROR"]),
        NEED_CHARACTER:Object.freeze(["READY","AUTH_REQUIRED","ERROR"]),
        READY:Object.freeze(["AUTH_REQUIRED","ERROR"]),
        OFFLINE_READY:Object.freeze(["AUTH_REQUIRED","ERROR"]),
        ERROR:Object.freeze(["AUTH_RESOLVING","SAVE_LOADING","AUTH_REQUIRED","OFFLINE_READY"])
    });
    function canTransition(from,to){
        return from===to||!!(ALLOWED[from]&&ALLOWED[from].includes(to));
    }
    function canCreateCharacter(context={}){
        return context.state===STATES.NEED_CHARACTER&&
            typeof context.userUid==="string"&&context.userUid.length>0&&
            context.userUid===context.resolvedUid&&
            context.userUid===context.activeSaveUid&&
            context.saveResolved===true;
    }
    global.FourSymbolsStartupContract=Object.freeze({STATES,ALLOWED,canTransition,canCreateCharacter});
})(typeof window!=="undefined"?window:globalThis);
