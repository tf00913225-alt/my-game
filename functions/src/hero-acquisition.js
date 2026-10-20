"use strict";

const {randomBytes}=require("node:crypto");
const {snapshotDigest:digest}=require("./canonical-snapshot");
const {taipeiDay}=require("./daily-checkin-policy");
const HeroCore=require("./hero-core");
const {createHeroChapterSource}=require("./hero-chapter-source");
const KING="vajraHeavenlyKing";
const CLAIM="hero-v1-"+KING;
const strip=data=>{const {createdAt,updatedAt,...value}=data;return value;};
const validDay=day=>{
    if(typeof day!=="string"||!/^\d{8}$/.test(day)){return false;}
    try{return taipeiDay(Date.parse(`${day.slice(0,4)}-${day.slice(4,6)}-${day.slice(6,8)}T04:00:00Z`))===day;}
    catch(_){return false;}
};

// Acquisition rights only. This is not a character save, progression writer,
// chapter victory verifier or a reader that publishes the full Cloud Save.
// Rights/receipts remain outside restored client snapshots.
function createHeroAcquisition({db,FieldValue,HttpsError,runProtected,
    inspectExistingEnvelope,nextRevision,now=Date.now,seed=()=>randomBytes(4).readUInt32BE()||1}){
    const fail=(code,message)=>{throw new HttpsError(code,message);};
    const makeClaim=(uid,heroId,operationId,revision,allocationSeed,sourceSha256)=>({
        schemaVersion:1,ownerUid:uid,kind:"hero-acquisition",heroId,
        claimKey:"hero-v1-"+heroId,operationId,serverRevision:revision,allocationSeed,sourceSha256});
    const chapterSource=createHeroChapterSource({fail,nextRevision,FieldValue,makeClaim});
    const withChapter=async(tx,context)=>({...context,chapter:await chapterSource.read(tx,context)});
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
           !state.entitlements||typeof state.entitlements!=="object"||Array.isArray(state.entitlements)||
           Object.keys(state.entitlements).some(id=>id!==KING)||
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
    async function readLoginSources(tx,uid){
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
            return {root,envelopeRef,stateRef,historyRef,claimRef,envelope,state:null,history:[]};
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
                "allocationSeed|day|entitlement|loginCount|operationId|ownerUid|previousHash|schemaVersion|serverRevision|sessionId|sourceRevision"||
               id!==String(row.serverRevision)||row.schemaVersion!==1||row.ownerUid!==uid||
               row.serverRevision<=previousRevision||row.serverRevision>envelope.serverRevision||
               !Number.isSafeInteger(row.sourceRevision)||row.sourceRevision<1||
               row.serverRevision!==row.sourceRevision+1||row.sourceRevision<previousRevision||
               !/^[A-Za-z0-9_-]{32}$/.test(row.sessionId||"")||
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
                sourceRevision:row.sourceRevision,sessionId:row.sessionId,
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
            const expected=makeClaim(uid,KING,grant.sourceId,grant.grantedRevision,grant.allocationSeed,previousHash);
            if(!claimSnap.exists||!claimSnap.data().createdAt||digest(strip(claimSnap.data()))!==digest(expected)||
               history[6].allocationSeed!==grant.allocationSeed){
                fail("data-loss","Hero claim is missing or inconsistent; it cannot be reissued.");
            }
        }else if(claimSnap.exists){fail("data-loss","Orphan Hero claim cannot be reopened.");}
        return {root,envelopeRef,stateRef,historyRef,claimRef,envelope,state,history};
    }
    async function readSources(tx,uid){return withChapter(tx,await readLoginSources(tx,uid));}
    function retainedScope(scope){
        if(!scope||scope.root?.path!=="serverUsers/"+scope.uid||!Number.isSafeInteger(scope.envelopeRevision)||
           !Number.isSafeInteger(scope.canonicalRevision)||scope.canonicalRevision<1||scope.envelopeRevision<scope.canonicalRevision)
            fail("data-loss","Retained Hero source scope is invalid.");
        return scope;
    }
    async function verifyRetainedLogin(tx,scope){
        retainedScope(scope);
        const c=await readLoginSources(tx,scope.uid);
        if(c.envelope.serverRevision!==scope.envelopeRevision)fail("data-loss","Retained Hero envelope differs.");
        return {ownerUid:scope.uid,envelopeRevision:scope.envelopeRevision,canonicalRevision:scope.canonicalRevision,...(scope.captureSha256===undefined?{}:{captureSha256:scope.captureSha256}),
            present:!!c.state,stateRevision:c.state?.serverRevision??null,stateSha256:c.state?digest(c.state):null,
            history:c.history.map(r=>({id:r.id,operationId:r.operationId,sourceRevision:r.sourceRevision,
                serverRevision:r.serverRevision,sha256:r.sha256,day:r.day,loginCount:r.loginCount,
                entitlement:r.entitlement,allocationSeed:r.allocationSeed})),
            entitlements:c.state?Object.values(c.state.entitlements).map(r=>({...r})):[],
            operationIds:c.history.map(r=>r.operationId),ledgerIds:c.history.map(r=>r.operationId),
            claimIds:c.state?.entitlements[KING]?[CLAIM]:[]};
    }
    const verifyRetainedChapterTicket=(tx,scope,id)=>chapterSource.verifyRetainedTicket(tx,retainedScope(scope),id);
    const verifyRetainedChapterStep=(tx,scope,id)=>chapterSource.verifyRetainedStep(tx,retainedScope(scope),id);
    const verifyRetainedChapterHead=(tx,scope)=>chapterSource.verifyRetainedHead(tx,retainedScope(scope));
    function closeRetainedEvidence({login,head,tickets,steps,inventory}){
        if(!login||!head||login.ownerUid!==head.ownerUid||login.envelopeRevision!==head.envelopeRevision||
           login.canonicalRevision!==head.canonicalRevision||login.captureSha256!==head.captureSha256)fail("data-loss","Retained Hero closure binding differs.");
        const equalSet=(actual,expected)=>Array.isArray(actual)&&new Set(actual).size===actual.length&&
            actual.length===expected.length&&actual.every(id=>expected.includes(id));
        if(!inventory||!equalSet(inventory.heroAcquisition,login.present?["current"]:[])||
           !equalSet(inventory.heroAcquisitionHistory,login.history.map(r=>r.id)))
            fail("data-loss","Retained Hero login inventory differs.");
        const chapter=chapterSource.closeRetainedEvidence({head,tickets,steps,inventory});
        return {ownerUid:login.ownerUid,envelopeRevision:login.envelopeRevision,canonicalRevision:login.canonicalRevision,...(login.captureSha256===undefined?{}:{captureSha256:login.captureSha256}),
            operationIds:[...login.operationIds,...chapter.operationIds],ledgerIds:[...login.ledgerIds,...chapter.ledgerIds],
            claimIds:[...login.claimIds,...chapter.claimIds],entitlements:[...login.entitlements,...chapter.entitlements],
            loginHistory:login.history,chapterTicketIds:chapter.ticketIds,chapterStepIds:chapter.stepIds};
    }
    function result(context,unchanged=true){
        return {schemaVersion:1,ownerUid:context.envelope.data.ownerUid,
            serverRevision:context.envelope.serverRevision,
            loginCount:context.state?.loginDays.length||0,
            entitlements:{...(context.state?.entitlements||{}),
                ...(context.chapter?.entitlement?{[context.chapter.entitlement.heroId]:context.chapter.entitlement}:{})},
            chapter:chapterSource.view(context.chapter),unchanged,
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
                sourceRevision:envelope.serverRevision,sessionId:session.sessionId,
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
                sourceRevision:envelope.serverRevision,sessionId:session.sessionId,
                day,loginCount:loginDays.length,entitlement:proof.entitlement,
                allocationSeed:proof.allocationSeed};
            tx.set(stateRef,{...next,updatedAt:stamp});
            tx.create(historyRef.doc(String(revision)),{...proof,sha256,createdAt:stamp});
            tx.create(receiptRef,{...operation,createdAt:stamp});
            tx.create(ledgerRef,{...operation,createdAt:stamp});
            if(awarded){tx.create(claimRef,{...makeClaim(session.uid,KING,operationId,revision,allocationSeed,sha256),createdAt:stamp});}
            tx.update(envelopeRef,{serverRevision:revision,updatedAt:stamp});
            return result({...context,state:next,envelope:{...envelope,serverRevision:revision}},false);
        });
    }
    async function ensureChapterTicket(request){
        requestShape(request,true);const time=now();
        return runProtected(request,async(tx,session)=>{
            const context=await readSources(tx,session.uid);
            const next=await chapterSource.ensure(tx,session,context,time,request.data.expectedRevision);
            return result(next,!next.changed);
        });
    }
    async function completeChapterNode(request){
        const data=request.data||{};
        if(Object.keys(data).sort().join("|")!=="choiceId|expectedRevision|nodeId|session|ticketId|uid"||
           typeof data.ticketId!=="string"||typeof data.nodeId!=="string"||
           data.nodeId.length>64||data.ticketId.length>64||
           !(data.choiceId===null||typeof data.choiceId==="string"&&data.choiceId.length<=64)||
           !Number.isSafeInteger(data.expectedRevision)||data.expectedRevision<1){
            fail("invalid-argument","Only an issued chapter node intent and expected revision are accepted.");
        }
        const time=now(),allocationSeed=seed();
        return runProtected(request,async(tx,session)=>{
            const context=await readSources(tx,session.uid);
            const next=await chapterSource.complete(tx,session,context,time,data,allocationSeed);
            return result(next,!next.changed);
        });
    }
    return Object.freeze({read,observeLogin,ensureChapterTicket,completeChapterNode,
        verifyRetainedLogin,verifyRetainedChapterTicket,verifyRetainedChapterStep,verifyRetainedChapterHead,closeRetainedEvidence,
        readInTransaction:async(tx,session)=>{
            const context=await readSources(tx,session.uid);
            return {...result(context),loginEvidence:context.state?{
                loginCount:context.state.loginDays.length,serverRevision:context.state.serverRevision,
                sha256:context.state.lastHistorySha256}:null};
        }});
}

module.exports={createHeroAcquisition};
