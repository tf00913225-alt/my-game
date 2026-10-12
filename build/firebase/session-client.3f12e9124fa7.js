/* Session credentials are bearer secrets, never player data or authority.
 * This owner accepts only backend decisions; retries never create a new session. */
const TERMINAL=new Set(["SESSION_REVOKED","SESSION_INVALID","SESSION_REAUTH_REQUIRED","AUTH_REQUIRED"]);
const STORAGE_PREFIX="four_symbols_game_session_v1:";
export function sessionError(code){ return Object.assign(new Error(code),{code}); }
export function createGameSessionClient({getIdentity,call,storage,onState=()=>{}}){
    let identity=null,credential=null,pending=null,epoch=0,closing=false,terminal=null;
    let state=Object.freeze({status:"signed-out",uid:null});
    const same=(a,b)=>a?.uid===b?.uid&&a?.authTime===b?.authTime;
    const key=uid=>STORAGE_PREFIX+encodeURIComponent(uid);
    function announce(status,code=null){
        state=Object.freeze({status,uid:identity?.uid||null,sessionId:credential?.sessionId||null,code});
        onState(state);
    }
    function read(uid){
        try{ return JSON.parse(storage?.getItem(key(uid))||"null"); }
        catch(_){ return null; }
    }
    function persist(value){
        try{ storage?.setItem(key(identity.uid),JSON.stringify({...identity,...value})); }
        catch(_){ /* Memory-only credential; a reload will require a new login. */ }
    }
    function forget(uid){ try{ storage?.removeItem(key(uid)); }catch(_){} }
    async function assertCurrent(token,expected){
        const actual=await getIdentity();
        if(token!==epoch||!same(actual,expected)){ throw sessionError("ACCOUNT_CHANGED"); }
    }
    function rejectSession(error){
        const code=error?.details?.code||(error?.code==="functions/unauthenticated"?"AUTH_REQUIRED":error?.code)||"SESSION_UNAVAILABLE";
        if(TERMINAL.has(code)){
            terminal=code; credential=null; persist({terminal:code}); announce("blocked",code);
        }else{ announce("unavailable","SESSION_UNAVAILABLE"); }
        return sessionError(TERMINAL.has(code)?code:"SESSION_UNAVAILABLE");
    }
    function adopt(next){
        if(same(identity,next)){ return; }
        if(identity){ forget(identity.uid); }
        epoch++; identity=next; credential=null; pending=null; terminal=null;
        if(!next){ announce("signed-out"); return; }
        const saved=read(next.uid);
        if(same(saved,next)){
            terminal=TERMINAL.has(saved.terminal)?saved.terminal:null;
            if(saved.credential?.uid===next.uid){ credential=saved.credential; }
        }
        announce(terminal?"blocked":"pending",terminal);
    }
    async function ensure(){
        if(closing){ throw sessionError("AUTH_REQUIRED"); }
        const next=await getIdentity();
        adopt(next);
        if(!identity){ throw sessionError("AUTH_REQUIRED"); }
        if(terminal){ throw sessionError(terminal); }
        if(pending){ return pending; }
        const expected=identity,token=epoch;
        const task=(async()=>{
            try{
                if(credential){
                    await call("protectedTest",{uid:expected.uid,session:credential});
                }else{
                    /* Persist before sending. An ambiguous/lost create response
                     * must not cause another takeover on retry or reload. */
                    persist({terminal:"SESSION_REAUTH_REQUIRED"});
                    const result=await call("createGameSession",{uid:expected.uid});
                    await assertCurrent(token,expected);
                    if(result?.uid!==expected.uid||result.schemaVersion!==1||result.status!=="active"||
                       !/^[A-Za-z0-9_-]{32}$/.test(result.sessionId)||!/^[A-Za-z0-9_-]{43}$/.test(result.credential)){
                        throw sessionError("SESSION_INVALID");
                    }
                    credential=result;
                }
                await assertCurrent(token,expected);
                persist({credential}); announce("active");
                return credential;
            }catch(error){
                if(token!==epoch||error.code==="ACCOUNT_CHANGED"){ throw sessionError("ACCOUNT_CHANGED"); }
                if(!credential){ terminal="SESSION_REAUTH_REQUIRED"; }
                throw rejectSession(error);
            }
        })();
        pending=task;
        try{ return await task; }
        finally{ if(pending===task){ pending=null; } }
    }
    async function invoke(name,payload={},expectedUid){
        const caller=await getIdentity();
        if(!caller||expectedUid&&caller.uid!==expectedUid){ throw sessionError("ACCOUNT_CHANGED"); }
        const session=await ensure();
        if(!same(caller,identity)){ throw sessionError("ACCOUNT_CHANGED"); }
        const expected=identity,token=epoch;
        try{
            /* UID and credential cannot be overridden by caller payload. */
            const result=await call(name,{...payload,uid:expected.uid,session});
            await assertCurrent(token,expected);
            return result;
        }catch(error){
            if(token!==epoch||error.code==="ACCOUNT_CHANGED"){ throw sessionError("ACCOUNT_CHANGED"); }
            throw rejectSession(error);
        }
    }
    async function revoke(){
        closing=true;
        try{
            if(pending){ try{ await pending; }catch(_){} }
            if(identity&&credential){
                try{ await call("revokeGameSession",{uid:identity.uid,session:credential}); }
                catch(error){
                    if(!["SESSION_REVOKED","SESSION_INVALID"].includes(error?.details?.code||error?.code)){
                        throw rejectSession(error);
                    }
                }
            }
        }finally{
            if(identity){ forget(identity.uid); }
            epoch++; identity=null; credential=null; pending=null; terminal=null;
            closing=false; announce("signed-out");
        }
    }
    function reset(){
        if(identity){ forget(identity.uid); }
        epoch++; identity=null; credential=null; pending=null; terminal=null;
        announce("signed-out");
    }
    return Object.freeze({ensure,invoke,revoke,reset,getState:()=>state});
}
