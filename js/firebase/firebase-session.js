/* Firebase adapter for the single game-session client owner. No game save IO. */
import {getFunctions,httpsCallable} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-functions.js";
import {getFirebaseApp,getFirebaseAuth,initializeFirebaseAuth} from "./firebase-auth.js";
import {createGameSessionClient,sessionError} from "./session-client.js";

export const CLOUD_FUNCTIONS_REGION="us-central1";
let functions=null;
async function getIdentity(){
    const user=getFirebaseAuth()?.currentUser;
    if(!user){ return null; }
    const result=await user.getIdTokenResult();
    if(getFirebaseAuth()?.currentUser!==user){ throw sessionError("ACCOUNT_CHANGED"); }
    return {uid:user.uid,authTime:result.claims.auth_time};
}
async function call(name,payload){
    const user=getFirebaseAuth()?.currentUser;
    if(!user||user.uid!==payload.uid){ throw sessionError("ACCOUNT_CHANGED"); }
    functions=functions||getFunctions(getFirebaseApp(),CLOUD_FUNCTIONS_REGION);
    const response=await httpsCallable(functions,name,{timeout:30000})(payload);
    if(getFirebaseAuth()?.currentUser!==user){ throw sessionError("ACCOUNT_CHANGED"); }
    return response.data;
}
let storage=null;
try{ storage=window.sessionStorage; }catch(_){}
const client=createGameSessionClient({getIdentity,call,storage,onState:state=>{
    window.dispatchEvent(new CustomEvent("four-symbols:game-session-state",{detail:state}));
}});
export async function synchronizeGameSession(user){
    if(!user){ client.reset(); return; }
    await initializeFirebaseAuth();
    if(getFirebaseAuth()?.currentUser?.uid!==user.uid){ throw sessionError("ACCOUNT_CHANGED"); }
    await client.ensure();
    return client.getState();
}
export async function callProtectedFunction(name,payload={},expectedUid=getFirebaseAuth()?.currentUser?.uid){
    await initializeFirebaseAuth();
    return client.invoke(name,payload,expectedUid);
}
export const protectedTest=()=>callProtectedFunction("protectedTest");
export const revokeGameSession=()=>client.revoke();
export const getGameSessionState=()=>client.getState();
