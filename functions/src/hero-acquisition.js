"use strict";

const {createHash,randomBytes}=require("node:crypto");
const {taipeiDay}=require("./daily-checkin-policy");
const HeroCore=require("./hero-core");
const KING="vajraHeavenlyKing";
const CLAIM="hero-v1-"+KING;
const digest=value=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
const strip=data=>{const {createdAt,updatedAt,...value}=data;return value;};
const validDay=day=>typeof day==="string"&&/^\d{8}$/.test(day)&&
    taipeiDay(Date.parse(`${day.slice(0,4)}-${day.slice(4,6)}-${day.slice(6,8)}T04:00:00Z`))===day;

// Acquisition rights only. This is not a character save, progression writer,
// chapter victory verifier or a reader that publishes the full Cloud Save.
// Rights/receipts remain outside restored client snapshots.
function createHeroAcquisition({db,FieldValue,HttpsError,runProtected,
    inspectExistingEnvelope,nextRevision,now=Date.now,seed=()=>randomBytes(4).readUInt32BE()||1}){
    const fail=(code,message)=>{throw new HttpsError(code,message);};
    function requestShape(request,observe){
        const keys=Object.keys(request.data||{}).sort().join("|");
        if(keys!==(observe?"expectedRevision|session|uid":"session|uid")||
           observe&&(!Number.isSafeInteger(request.data.expectedRevision)||request.data.expectedRevision<1)){
            fail("invalid-argument","Only identity, active session and the expected revision are accepted.");
        }
    }
    function inspectState(state,uid){
        if(!state||Object.keys(state).sort().join("|")!==
            "entitlements|lastHistorySha256|loginDays|ownerUid|schemaVersion|serverRevision"||
           state.schemaVersion!==1||state.ownerUid!==uid||
           !Number.isSafeInteger(state.serverRevision)||state.serverRevision<1||
           !Array.isArray(state.loginDays)||state.loginDays.length<1||state.loginDays.length>7||
           state.loginDays.some((day,index)=>!validDay(day)||index>0&&day<=state.loginDays[index-1])||
           !state.entitlements||Object.keys(state.entitlements).some(id=>id!==KING)||
           !/^[a-f0-9]{64}$/.test(state.lastHistorySha256||"")){
            fail("data-loss","Hero acquisition source is invalid.");
        }
        const grant=state.entitlements[KING];
        if(state.loginDays.length===7){
            if(!grant||Object.keys(grant).sort().join("|")!==
                "allocationSeed|claimKey|grantedRevision|heroId|sourceId"||
               grant.heroId!==KING||grant.claimKey!==CLAIM||
               grant.sourceId!==`hero-login-${state.loginDays[6]}`||
               !Number.isSafeInteger(grant.allocationSeed)||grant.allocationSeed<1||grant.allocationSeed>0xffffffff||
               grant.grantedRevision!==state.serverRevision){
                fail("data-loss","Seventh-day Hero entitlement is inconsistent.");
            }
        }else if(grant){fail("data-loss","Hero entitlement has no seventh-day source.");}
        return state;
    }
    async function readSources(tx,uid){
        const root=db.collection("serverUsers").doc(uid);
        const envelopeRef=db.collection("users").doc(uid).collection("saves").doc("current");
        const stateRef=root.collection("heroAcquisition").doc("current");
        const historyRef=root.collection("heroAcquisitionHistory");
        const claimRef=root.collection("uniqueClaims").doc(CLAIM);
        const [envelopeSnap,stateSnap,historySnap,claimSnap,operationsSnap,ledgerSet]=await Promise.all([
            tx.get(envelopeRef),tx.get(stateRef),tx.get(historyRef.limit(8)),tx.get(claimRef),
            tx.get(root.collection("operations").where("kind","==","hero-login-observation").limit(8)),
            tx.get(root.collection("ledgerEntries").where("kind","==","hero-login-observation").limit(8))]);
        if(!envelopeSnap.exists){fail("failed-precondition","A bootstrapped account is required.");}
        const envelope=inspectExistingEnvelope(envelopeSnap.data(),uid);
        if(envelope.kind!=="current"){fail("failed-precondition","Current account envelope required.");}
        if(!stateSnap.exists){
            if(historySnap.size||claimSnap.exists||operationsSnap.size||ledgerSet.size){fail("data-loss","Hero acquisition source is missing; rights cannot be reinitialized.");}
            return {root,envelopeRef,stateRef,historyRef,claimRef,envelope,state:null};
        }
        const state=inspectState(strip(stateSnap.data()),uid);
        if(state.serverRevision>envelope.serverRevision||historySnap.size!==state.loginDays.length||
           operationsSnap.size!==historySnap.size||ledgerSet.size!==historySnap.size||!stateSnap.data().updatedAt){
            fail("data-loss","Hero acquisition history or revision is incomplete.");
        }
        const history=historySnap.docs.map(doc=>{
            if(!doc.data().createdAt){fail("data-loss","Hero acquisition history timestamp is missing.");}
            return {id:doc.id,...strip(doc.data())};
        })
            .sort((a,b)=>a.serverRevision-b.serverRevision);
        let previousHash=null,previousRevision=0;
        for(let index=0;index<history.length;index++){
            const row=history[index],{id,sha256,...proof}=row;
            if(Object.keys(proof).sort().join("|")!==
                "allocationSeed|day|entitlement|loginCount|operationId|ownerUid|previousHash|schemaVersion|serverRevision"||
               id!==String(row.serverRevision)||row.schemaVersion!==1||row.ownerUid!==uid||
               row.serverRevision<=previousRevision||row.serverRevision>envelope.serverRevision||
               row.previousHash!==previousHash||row.day!==state.loginDays[index]||
               row.operationId!==`hero-login-${row.day}`||row.loginCount!==index+1||
               row.entitlement!== (index===6?KING:null)||sha256!==digest(proof)){
                fail("data-loss","Hero login history is inconsistent.");
            }
            const [receiptSnap,ledgerSnap]=await Promise.all([
                tx.get(root.collection("operations").doc(row.operationId)),
                tx.get(root.collection("ledgerEntries").doc(row.operationId))]);
            const expected={schemaVersion:1,ownerUid:uid,kind:"hero-login-observation",
                operationId:row.operationId,serverRevision:row.serverRevision,
                sourceSha256:sha256,day:row.day,loginCount:row.loginCount,
                entitlement:row.entitlement,allocationSeed:row.allocationSeed};
            if(!receiptSnap.exists||!ledgerSnap.exists||!receiptSnap.data().createdAt||!ledgerSnap.data().createdAt||
               digest(strip(receiptSnap.data()))!==digest(expected)||
               digest(strip(ledgerSnap.data()))!==digest(expected)){
                fail("data-loss","Hero acquisition receipt or ledger is missing or inconsistent.");
            }
            if(index<6&&row.allocationSeed!==null){fail("data-loss","Unexpected Hero allocation seed.");}
            previousHash=sha256;previousRevision=row.serverRevision;
        }
        if(previousHash!==state.lastHistorySha256||previousRevision!==state.serverRevision){
            fail("data-loss","Hero acquisition checkpoint differs from immutable history.");
        }
        const grant=state.entitlements[KING];
        if(grant){
            const expected={schemaVersion:1,ownerUid:uid,kind:"hero-acquisition",
                heroId:KING,claimKey:CLAIM,operationId:grant.sourceId,
                serverRevision:grant.grantedRevision,allocationSeed:grant.allocationSeed,
                sourceSha256:previousHash};
            if(!claimSnap.exists||!claimSnap.data().createdAt||digest(strip(claimSnap.data()))!==digest(expected)||
               history[6].allocationSeed!==grant.allocationSeed){
                fail("data-loss","Hero claim is missing or inconsistent; it cannot be reissued.");
            }
        }else if(claimSnap.exists){fail("data-loss","Orphan Hero claim cannot be reopened.");}
        return {root,envelopeRef,stateRef,historyRef,claimRef,envelope,state};
    }
    function result(context,unchanged=true){
        return {schemaVersion:1,ownerUid:context.envelope.data.ownerUid,
            serverRevision:context.envelope.serverRevision,
            loginCount:context.state?.loginDays.length||0,
            entitlements:context.state?.entitlements||{},unchanged,
            authoritativeStateReady:false};
    }
    async function read(request){
        requestShape(request,false);
        return runProtected(request,async(tx,session)=>result(await readSources(tx,session.uid)));
    }
    async function observeLogin(request){
        requestShape(request,true);
        const day=taipeiDay(now()),allocationSeed=seed();
        if(!Number.isSafeInteger(allocationSeed)||allocationSeed<1||allocationSeed>0xffffffff){
            fail("internal","Invalid server allocation seed.");
        }
        return runProtected(request,async(tx,session)=>{
            const context=await readSources(tx,session.uid),state=context.state;
            if(state?.loginDays.includes(day)||state?.loginDays.length===7){return result(context);}
            if(state&&day<state.loginDays.at(-1)){fail("failed-precondition","Server day precedes recorded login history.");}
            if(request.data.expectedRevision!==context.envelope.serverRevision){fail("aborted","CLOUD_REVISION_CONFLICT");}
            const {root,envelopeRef,stateRef,historyRef,claimRef,envelope}=context;
            const operationId=`hero-login-${day}`;
            const receiptRef=root.collection("operations").doc(operationId);
            const ledgerRef=root.collection("ledgerEntries").doc(operationId);
            const [receipt,ledger]=await Promise.all([tx.get(receiptRef),tx.get(ledgerRef)]);
            if(receipt.exists||ledger.exists){fail("data-loss","Orphan Hero operation cannot be replaced.");}
            const revision=nextRevision(envelope),loginDays=[...(state?.loginDays||[]),day];
            const awarded=loginDays.length===7;
            const acquisition=HeroCore.getHeroDefinition(KING).acquisition;
            if(acquisition.kind!=="cumulativeLoginDay"||acquisition.day!==7||!acquisition.directUnlock){
                fail("failed-precondition","Unsupported Hero acquisition policy.");
            }
            const proof={schemaVersion:1,ownerUid:session.uid,serverRevision:revision,
                previousHash:state?.lastHistorySha256||null,day,operationId,
                loginCount:loginDays.length,entitlement:awarded?KING:null,
                allocationSeed:awarded?allocationSeed:null};
            const sha256=digest(proof);
            const entitlements=awarded?{[KING]:{heroId:KING,claimKey:CLAIM,
                allocationSeed,sourceId:operationId,grantedRevision:revision}}:{};
            const next={schemaVersion:1,ownerUid:session.uid,serverRevision:revision,
                loginDays,entitlements,lastHistorySha256:sha256};
            inspectState(next,session.uid);
            const stamp=FieldValue.serverTimestamp();
            const operation={schemaVersion:1,ownerUid:session.uid,kind:"hero-login-observation",
                operationId,serverRevision:revision,sourceSha256:sha256,
                day,loginCount:loginDays.length,entitlement:proof.entitlement,
                allocationSeed:proof.allocationSeed};
            tx.set(stateRef,{...next,updatedAt:stamp});
            tx.create(historyRef.doc(String(revision)),{...proof,sha256,createdAt:stamp});
            tx.create(receiptRef,{...operation,createdAt:stamp});
            tx.create(ledgerRef,{...operation,createdAt:stamp});
            if(awarded){tx.create(claimRef,{schemaVersion:1,ownerUid:session.uid,
                kind:"hero-acquisition",heroId:KING,claimKey:CLAIM,operationId,
                serverRevision:revision,allocationSeed,sourceSha256:sha256,createdAt:stamp});}
            tx.update(envelopeRef,{serverRevision:revision,updatedAt:stamp});
            return result({...context,state:next,envelope:{...envelope,serverRevision:revision}},false);
        });
    }
    return Object.freeze({read,observeLogin});
}

module.exports={createHeroAcquisition};
