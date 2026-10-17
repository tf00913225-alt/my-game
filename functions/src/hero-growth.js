"use strict";
const {randomBytes}=require("node:crypto");
const Core=require("./hero-core");
const {taipeiDay}=require("./daily-checkin-policy");
const {assembleCanonicalSnapshot,verifyCanonicalSnapshotAgainstSources,snapshotDigest:digest,
    claimRecordsDigest}=require("./canonical-snapshot");
const {createRecoveryArchive,inspectRecoveryArchive}=require("./canonical-recovery-archive");
const {source,readOwnedSources,advanceOwnedRecords}=require("./canonical-owned-sources");

// Existing progress/current playableState.heroAccount and inventory remain the
// only growth/resource sources. Approved milestones and daily supply share this writer.
function createHeroGrowth({db,FieldValue,HttpsError,runProtected,inspectExistingEnvelope,
    nextRevision,acquisition,now=Date.now,seed=()=>randomBytes(4).readUInt32BE()||1}){
    const fail=(code,message)=>{throw new HttpsError(code,message);};
    const domain=account=>Core.createDomain(account,()=>[],()=>null,()=>null);
    const keys=value=>Object.keys(value||{}).sort().join("|");
    const audit=value=>{const {createdAt,updatedAt,...row}=value;return row;};
    const pillCount=records=>records.inventory.filter(item=>item.location==="bag"&&
        item.state.id===Core.contract.rerollItem.id).reduce((sum,item)=>{
            const count=sum+item.state.count;
            if(!Number.isSafeInteger(count)){fail("data-loss","Invalid resource total.");}
            return count;
        },0);
    const loginPolicies=Object.freeze([
        Object.freeze({day:3,heroId:"divineDogHongbao",fragments:25,marrowPills:1}),
        Object.freeze({day:7,heroId:"vajraHeavenlyKing",fragments:25,marrowPills:1})]);
    const rewardId=day=>"hero-login-reward-v1-day"+day;
    const dailyFragments=Object.freeze({divineDogHongbao:5,vajraHeavenlyKing:5});
    const dailyId=day=>"hero-daily-supply-v1-"+day;
    const validDay=day=>typeof day==="string"&&/^\d{8}$/.test(day)&&
        Number.isFinite(Date.parse(`${day.slice(0,4)}-${day.slice(4,6)}-${day.slice(6)}T00:00:00Z`))&&
        new Date(`${day.slice(0,4)}-${day.slice(4,6)}-${day.slice(6)}T00:00:00Z`).toISOString().slice(0,10).replaceAll("-","")===day;
    const dailyBalances=records=>({fragments:Object.fromEntries(Object.keys(dailyFragments).map(id=>
        [id,records.progress.playableState.heroAccount.heroes[id].specificFragments])),marrowPills:pillCount(records)});
    async function dailyReceipt(tx,c,day){
        const id=dailyId(day),snaps=await Promise.all(["operations","ledgerEntries","uniqueClaims"]
            .map(name=>tx.get(c.root.collection(name).doc(id))));
        if(!snaps.some(s=>s.exists))return null;
        if(snaps.some(s=>!s.exists||!s.data().createdAt)||
           snaps.some(s=>digest(audit(s.data()))!==digest(audit(snaps[0].data())))){
            fail("data-loss","Daily supply evidence missing or inconsistent.");
        }
        const r=audit(snaps[0].data());
        try{
            if(r.schemaVersion!==1||r.kind!=="hero-daily-supply"||r.ownerUid!==c.uid||
               keys(r.intent)!=="expectedRevision|operationId|periodDate"||r.intent.operationId!==id||r.intent.periodDate!==day||
               !Number.isSafeInteger(r.intent.expectedRevision)||r.intent.expectedRevision<1||
               !Number.isSafeInteger(r.sourceRevision)||r.sourceRevision<1||r.sourceRevision>r.intent.expectedRevision||
               r.serverRevision!==r.intent.expectedRevision+1||r.serverRevision>c.envelope.serverRevision||
               !Number.isSafeInteger(r.dailyEvidence?.observedAtMs)||taipeiDay(r.dailyEvidence.observedAtMs)!==day||
               r.dailyEvidence.periodDate!==day||digest(r.fragmentDeltas)!==digest(dailyFragments)||r.marrowPillDelta!==1){throw Error("receipt");}
            const [prior,priorArchive,next,nextArchive]=await Promise.all([
                tx.get(c.root.collection("playableSnapshots").doc(String(r.sourceRevision))),
                tx.get(c.root.collection("recoveryArchives").doc(String(r.sourceRevision))),
                tx.get(c.root.collection("playableSnapshots").doc(String(r.serverRevision))),
                tx.get(c.root.collection("recoveryArchives").doc(String(r.serverRevision)))]);
            if(!prior.exists||!priorArchive.exists||!next.exists||!nextArchive.exists||
               prior.data().sha256!==r.sourceSnapshotSha256||next.data().sha256!==r.snapshotSha256){throw Error("source");}
            const before=inspectRecoveryArchive(priorArchive.data(),c.uid,r.sourceRevision,prior.data());
            const after=inspectRecoveryArchive(nextArchive.data(),c.uid,r.serverRevision,next.data());
            const b=dailyBalances(before),a=dailyBalances(after);
            if(digest(b)!==digest(r.dailyBeforeResources)||digest(a)!==digest(r.dailyAfterResources)||
               Object.keys(dailyFragments).some(id=>a.fragments[id]-b.fragments[id]!==5)||
               a.marrowPills-b.marrowPills!==1||digest(after.progress.playableState.heroAccount)!==r.heroAccountSha256){throw Error("delta");}
        }catch(_){fail("data-loss","Original daily supply source/archive is incomplete.");}
        return r;
    }
    async function loginRewards(tx,c){
        const rows=[];
        for(const policy of loginPolicies){
            const id=rewardId(policy.day);
            const [op,ledger,claim]=await Promise.all(["operations","ledgerEntries","uniqueClaims"]
                .map(name=>tx.get(c.root.collection(name).doc(id))));
            if(op.exists||ledger.exists||claim.exists){
                if(!op.exists||!ledger.exists||!claim.exists||!op.data().createdAt||
                   !ledger.data().createdAt||!claim.data().createdAt||
                   digest(audit(op.data()))!==digest(audit(ledger.data()))||
                   digest(audit(op.data()))!==digest(audit(claim.data()))){
                    fail("data-loss","Login reward evidence missing or inconsistent.");
                }
                const receipt=audit(op.data());
                await verifyLoginReward(tx,c,policy,receipt);
            }
            rows.push({...policy,eligible:(c.loginEvidence?.loginCount||0)>=policy.day,claimed:op.exists});
        }
        return rows;
    }
    async function verifyLoginReward(tx,c,policy,r){
        const id=rewardId(policy.day),proof=r.loginEvidence;
        if(r.kind!=="hero-login-reward"||r.schemaVersion!==1||r.ownerUid!==c.uid||
           r.intent?.operationId!==id||r.intent?.milestoneDay!==policy.day||
           !Number.isSafeInteger(r.intent.expectedRevision)||r.intent.expectedRevision<1||
           !Number.isSafeInteger(r.sourceRevision)||r.sourceRevision<1||
           r.sourceRevision>r.intent.expectedRevision||r.serverRevision!==r.intent.expectedRevision+1||
           r.serverRevision>c.envelope.serverRevision||!proof||
           !Number.isSafeInteger(proof.serverRevision)||proof.serverRevision>r.intent.expectedRevision||
           !Number.isSafeInteger(proof.loginCount)||proof.loginCount<policy.day||proof.loginCount>7||
           r.fragmentDelta!==policy.fragments||r.marrowPillDelta!==policy.marrowPills){
            fail("data-loss","Login reward receipt is invalid.");
        }
        const [prior,priorArchive,next,nextArchive,history]=await Promise.all([
            tx.get(c.root.collection("playableSnapshots").doc(String(r.sourceRevision))),
            tx.get(c.root.collection("recoveryArchives").doc(String(r.sourceRevision))),
            tx.get(c.root.collection("playableSnapshots").doc(String(r.serverRevision))),
            tx.get(c.root.collection("recoveryArchives").doc(String(r.serverRevision))),
            tx.get(c.root.collection("heroAcquisitionHistory").doc(String(proof.serverRevision)))]);
        try{
            if(!prior.exists||!priorArchive.exists||!next.exists||!nextArchive.exists||!history.exists||
               !history.data().createdAt||prior.data().sha256!==r.sourceSnapshotSha256||
               next.data().sha256!==r.snapshotSha256){throw Error("missing");}
            const {sha256,...login}=audit(history.data());
            if(sha256!==proof.sha256||digest(login)!==sha256||login.ownerUid!==c.uid||
               login.serverRevision!==proof.serverRevision||login.loginCount!==proof.loginCount){throw Error("login");}
            const before=inspectRecoveryArchive(priorArchive.data(),c.uid,r.sourceRevision,prior.data());
            const after=inspectRecoveryArchive(nextArchive.data(),c.uid,r.serverRevision,next.data());
            const balances=records=>({specificFragments:records.progress.playableState.heroAccount.heroes[policy.heroId].specificFragments,
                marrowPills:pillCount(records)});
            if(digest(balances(before))!==digest(r.beforeResources)||digest(balances(after))!==digest(r.afterResources)||
               r.afterResources.specificFragments-r.beforeResources.specificFragments!==policy.fragments||
               r.afterResources.marrowPills-r.beforeResources.marrowPills!==policy.marrowPills||
               digest(after.progress.playableState.heroAccount)!==r.heroAccountSha256){throw Error("delta");}
        }catch(_){fail("data-loss","Original login reward source/archive is incomplete.");}
    }
    async function context(tx,session){
        const uid=session.uid,root=db.collection("serverUsers").doc(uid);
        const rights=await acquisition.readInTransaction(tx,session);
        const refs=Object.fromEntries(["account","economy","progress","relicLoadout","claimCheckpoints"]
            .map(name=>[name,root.collection(name).doc("current")]));
        const snaps=await Promise.all(Object.values(refs).map(ref=>tx.get(ref)));
        if(snaps.some(s=>!s.exists)){fail("failed-precondition","Canonical character sources required; local resources cannot be admitted.");}
        const rows=Object.fromEntries(Object.keys(refs).map((key,i)=>[key,source(snaps[i].data())]));
        const characterRefs=rows.account.slots.filter(Boolean).map(id=>root.collection("characters").doc(id));
        const characterSnaps=await Promise.all(characterRefs.map(ref=>tx.get(ref)));
        if(characterSnaps.some(s=>!s.exists)){fail("data-loss","Character source missing.");}
        const owned=await readOwnedSources(tx,root,fail);
        const records={account:rows.account,economy:rows.economy,progress:rows.progress,
            relicLoadout:rows.relicLoadout,claimCheckpoint:rows.claimCheckpoints,
            characters:characterSnaps.map(s=>source(s.data())),...owned.records};
        const revision=records.account.serverRevision;
        const [snapshot,archive,envelopeSnap]=await Promise.all([
            tx.get(root.collection("playableSnapshots").doc(String(revision))),
            tx.get(root.collection("recoveryArchives").doc(String(revision))),
            tx.get(db.collection("users").doc(uid).collection("saves").doc("current"))]);
        try{
            if(!snapshot.exists||!archive.exists||!envelopeSnap.exists){throw Error("missing");}
            verifyCanonicalSnapshotAgainstSources(snapshot.data(),uid,revision,records);
            inspectRecoveryArchive(archive.data(),uid,revision,snapshot.data());
            if(snaps[0].data().snapshotSha256!==snapshot.data().sha256){throw Error("pointer");}
        }catch(_){fail("data-loss","Canonical source/snapshot/archive is incomplete.");}
        const envelope=inspectExistingEnvelope(envelopeSnap.data(),uid);
        if(envelope.kind!=="current"||revision>envelope.serverRevision||
           envelope.data.authoritativeStateReady!==false){fail("failed-precondition","Unsupported account publication state.");}
        let account;
        try{
            const raw=records.progress.playableState.heroAccount;
            account=Core.normalizeAccountState(raw);
            if(digest(account)!==digest(raw)){throw Error("noncanonical");}
        }catch(_){fail("data-loss","Canonical Hero growth source missing or invalid.");}
        for(const [id,grant] of Object.entries(rights.entitlements)){
            if(!account.heroes[id].unlocked){account=domain(account).unlockHeroDirect(id,grant.allocationSeed);}
        }
        const c={uid,root,refs,owned,records,characterRefs,envelope,account,
            loginEvidence:rights.loginEvidence,sourceSnapshotSha256:snapshot.data().sha256};
        c.loginRewards=await loginRewards(tx,c);
        const periodDate=taipeiDay(now());
        c.dailySupply={periodDate,fragments:dailyFragments,marrowPills:1,claimed:!!await dailyReceipt(tx,c,periodDate)};
        return c;
    }
    function view(c,unchanged=true){return {schemaVersion:1,ownerUid:c.uid,
        serverRevision:c.envelope.serverRevision,heroAccount:c.account,
        marrowPills:pillCount(c.records),loginRewards:c.loginRewards,dailySupply:c.dailySupply,unchanged,authoritativeStateReady:false};}
    async function read(request){
        if(keys(request.data)!=="session|uid"){fail("invalid-argument","Only active identity/session accepted.");}
        return runProtected(request,async(tx,session)=>view(await context(tx,session)));
    }
    async function mutate(request){
        const data=request.data||{}, {operationId,expectedRevision,action,heroId}=data;
        if(keys(data)!=="action|expectedRevision|heroId|operationId|session|uid"||
            !/^[A-Za-z0-9_-]{16,64}$/.test(operationId||"")||
            !Number.isSafeInteger(expectedRevision)||expectedRevision<1||
            !["unlock","starUp","reroll"].includes(action)||
            !Core.listHeroDefinitions().some(hero=>hero.heroId===heroId)){
            fail("invalid-argument","Only growth intent, operation and revision accepted.");
        }
        const randomSeed=seed(); // Pinned once across transaction retries.
        if(!Number.isSafeInteger(randomSeed)||randomSeed<1||randomSeed>0xffffffff){fail("internal","Invalid allocation seed.");}
        return runProtected(request,async(tx,session)=>{
            const c=await context(tx,session);
            const opRef=c.root.collection("operations").doc(operationId);
            const ledgerRef=c.root.collection("ledgerEntries").doc(operationId);
            const claimRef=c.root.collection("uniqueClaims").doc("hero-fragment-v1-"+heroId);
            const [op,ledger,claim]=await Promise.all([tx.get(opRef),tx.get(ledgerRef),tx.get(claimRef)]);
            const intent={operationId,expectedRevision,action,heroId};
            if(op.exists){
                const receipt=audit(op.data());
                if(receipt.kind!=="hero-growth"||receipt.ownerUid!==c.uid||
                   digest(receipt.intent)!==digest(intent)||!ledger.exists||
                   digest(audit(ledger.data()))!==digest(receipt)||!op.data().createdAt||!ledger.data().createdAt){
                    fail("data-loss","Growth receipt/ledger mismatch.");
                }
                const [original,archive,prior,priorArchive]=await Promise.all([
                    tx.get(c.root.collection("playableSnapshots").doc(String(receipt.serverRevision))),
                    tx.get(c.root.collection("recoveryArchives").doc(String(receipt.serverRevision))),
                    tx.get(c.root.collection("playableSnapshots").doc(String(receipt.sourceRevision))),
                    tx.get(c.root.collection("recoveryArchives").doc(String(receipt.sourceRevision)))]);
                try{
                    if(!original.exists||!archive.exists||original.data().sha256!==receipt.snapshotSha256||
                       receipt.serverRevision>c.envelope.serverRevision){throw Error("missing");}
                    const stored=inspectRecoveryArchive(archive.data(),c.uid,receipt.serverRevision,original.data());
                    if(digest(stored.progress.playableState.heroAccount)!==receipt.heroAccountSha256){throw Error("hero");}
                    if(!prior.exists||!priorArchive.exists||prior.data().sha256!==receipt.sourceSnapshotSha256||
                       !Number.isSafeInteger(receipt.sourceRevision)||receipt.sourceRevision<1||
                       receipt.sourceRevision>expectedRevision||receipt.serverRevision!==expectedRevision+1){throw Error("source");}
                    const old=inspectRecoveryArchive(priorArchive.data(),c.uid,receipt.sourceRevision,prior.data());
                    const balances=records=>({specificFragments:records.progress.playableState.heroAccount.heroes[heroId].specificFragments,
                        marrowPills:pillCount(records)});
                    if(digest(balances(old))!==digest(receipt.beforeResources)||
                       digest(balances(stored))!==digest(receipt.afterResources)||
                       receipt.fragmentDelta!==receipt.afterResources.specificFragments-receipt.beforeResources.specificFragments||
                       receipt.marrowPillDelta!==receipt.afterResources.marrowPills-receipt.beforeResources.marrowPills){throw Error("delta");}
                    if(action==="unlock"&&(!claim.exists||digest(audit(claim.data()))!==digest(receipt))){throw Error("claim");}
                }catch(_){fail("data-loss","Original growth evidence missing or inconsistent.");}
                return {...view(c),receipt};
            }
            if(ledger.exists||action==="unlock"&&claim.exists){fail("data-loss","Orphan growth evidence cannot be recreated.");}
            if(c.envelope.serverRevision!==expectedRevision){fail("aborted","CLOUD_REVISION_CONFLICT");}
            const before=c.account.heroes[heroId],pills=pillCount(c.records);
            const allocationSeed=randomSeed===before.allocationSeed?(randomSeed===0xffffffff?1:randomSeed+1):randomSeed;
            let nextAccount;
            try{
                const d=domain(c.account);
                nextAccount=action==="unlock"?d.unlockHero(heroId,allocationSeed):
                    action==="starUp"?d.starUpHero(heroId):d.rerollHeroAllocation(heroId,allocationSeed,pills);
            }catch(_){fail("failed-precondition","Hero/resource eligibility failed.");}
            const revision=nextRevision(c.envelope),owned=advanceOwnedRecords(c.records,revision);
            const removed=new Set();
            if(action==="reroll"){
                const item=owned.inventory.filter(i=>i.location==="bag"&&i.state.id===Core.contract.rerollItem.id)
                    .sort((a,b)=>a.ownedItemId.localeCompare(b.ownedItemId,"en"))[0];
                if(item.state.count===1){removed.add(item.ownedItemId);owned.inventory=owned.inventory.filter(i=>i!==item);}
                else{item.state={...item.state,count:item.state.count-1};}
            }
            return commit(tx,c,{nextAccount,owned,removed,revision,before,pills,action,heroId,
                kind:"hero-growth",intent,opRef,ledgerRef,claimRef});
        });
    }

    async function commit(tx,c,{nextAccount,owned,removed,revision,before,pills,action,heroId,kind,intent,opRef,ledgerRef,claimRef,dailyEvidence}){
            const records={...c.records,...owned,
                account:{...c.records.account,serverRevision:revision},
                characters:c.records.characters.map(row=>({...row,serverRevision:revision})),
                economy:{...c.records.economy,serverRevision:revision},
                relicLoadout:{...c.records.relicLoadout,serverRevision:revision},
                progress:{...c.records.progress,serverRevision:revision,
                    playableState:{...c.records.progress.playableState,heroAccount:nextAccount}},
                claimCheckpoint:{...c.records.claimCheckpoint,serverRevision:revision,claimDigest:claimRecordsDigest(owned.claimRecords)}};
            let bundle,archive;
            try{bundle=assembleCanonicalSnapshot(c.uid,revision,records);archive=createRecoveryArchive(c.uid,revision,records,bundle);}
            catch(_){fail("data-loss","Growth cannot form canonical recovery evidence.");}
            const receipt={schemaVersion:1,ownerUid:c.uid,kind,intent,serverRevision:revision,
                sourceRevision:c.records.account.serverRevision,sourceSnapshotSha256:c.sourceSnapshotSha256,
                snapshotSha256:bundle.sha256,heroAccountSha256:digest(nextAccount),
                beforeResources:{specificFragments:before.specificFragments,marrowPills:pills},
                afterResources:{specificFragments:nextAccount.heroes[heroId].specificFragments,marrowPills:pillCount(records)},
                fragmentDelta:nextAccount.heroes[heroId].specificFragments-before.specificFragments,
                marrowPillDelta:action==="reroll"?-1:["loginReward","dailySupply"].includes(action)?1:0,
                ...(action==="dailySupply"?{dailyEvidence,fragmentDeltas:dailyFragments,
                    dailyBeforeResources:dailyBalances(c.records),dailyAfterResources:dailyBalances(records)}:{}),
                ...(action==="loginReward"?{loginEvidence:c.loginEvidence}:{})};
            const stamp=FieldValue.serverTimestamp();
            for(const [key,ref] of Object.entries(c.refs)){
                const row=key==="claimCheckpoints"?records.claimCheckpoint:records[key];
                tx.update(ref,{...row,...(key==="account"?{snapshotSha256:bundle.sha256}:{}),updatedAt:stamp});
            }
            c.characterRefs.forEach((ref,i)=>tx.update(ref,{...records.characters[i],updatedAt:stamp}));
            const ownedMap=new Map(records.inventory.map(row=>[row.ownedItemId,row]));
            for(const ref of c.owned.refs){
                if(removed.has(ref.id)){tx.delete(ref);continue;}
                const original=c.owned.records.inventory.find(i=>i.ownedItemId===ref.id);
                tx.update(ref,original?{...ownedMap.get(ref.id),updatedAt:stamp}:{serverRevision:revision,updatedAt:stamp});
            }
            for(const item of owned.inventory){
                if(!c.records.inventory.some(old=>old.ownedItemId===item.ownedItemId)){
                    tx.create(c.root.collection("inventory").doc(item.ownedItemId),{...item,createdAt:stamp,updatedAt:stamp});
                }
            }
            tx.create(c.root.collection("playableSnapshots").doc(String(revision)),{...bundle,createdAt:stamp});
            tx.create(c.root.collection("recoveryArchives").doc(String(revision)),{...archive,createdAt:stamp});
            tx.create(opRef,{...receipt,createdAt:stamp});tx.create(ledgerRef,{...receipt,createdAt:stamp});
            if(["unlock","loginReward","dailySupply"].includes(action)){tx.create(claimRef,{...receipt,createdAt:stamp});}
            tx.update(db.collection("users").doc(c.uid).collection("saves").doc("current"),{serverRevision:revision,updatedAt:stamp});
            const loginRewards=c.loginRewards.map(row=>action==="loginReward"&&row.day===intent.milestoneDay?{...row,claimed:true}:row);
            const dailySupply=action==="dailySupply"?{...c.dailySupply,claimed:true}:c.dailySupply;
            return {...view({...c,records,account:nextAccount,loginRewards,dailySupply,envelope:{...c.envelope,serverRevision:revision}},false),receipt};
    }
    async function claimLoginReward(request){
        const data=request.data||{},policy=loginPolicies.find(row=>row.day===data.milestoneDay);
        if(keys(data)!=="expectedRevision|milestoneDay|operationId|session|uid"||!policy||
           data.operationId!==rewardId(policy.day)||!Number.isSafeInteger(data.expectedRevision)||data.expectedRevision<1){
            fail("invalid-argument","Only an approved milestone, its fixed operation ID and revision accepted.");
        }
        return runProtected(request,async(tx,session)=>{
            const c=await context(tx,session),state=c.loginRewards.find(row=>row.day===policy.day);
            const opRef=c.root.collection("operations").doc(data.operationId);
            const ledgerRef=c.root.collection("ledgerEntries").doc(data.operationId);
            const claimRef=c.root.collection("uniqueClaims").doc(data.operationId);
            if(state.claimed){
                const receipt=await tx.get(opRef);return {...view(c),receipt:audit(receipt.data())};
            }
            if(!state.eligible){fail("failed-precondition","Recorded server login milestone not reached.");}
            if(c.envelope.serverRevision!==data.expectedRevision){fail("aborted","CLOUD_REVISION_CONFLICT");}
            const heroId=policy.heroId,before=c.account.heroes[heroId],pills=pillCount(c.records);
            let nextAccount;
            try{nextAccount=domain(c.account).addSpecificFragments(heroId,policy.fragments);}
            catch(_){fail("failed-precondition","Hero fragment capacity exceeded.");}
            const revision=nextRevision(c.envelope),owned=advanceOwnedRecords(c.records,revision);
            addRewardPill(c,owned,revision,data.operationId,pills,policy.marrowPills);
            const intent={operationId:data.operationId,expectedRevision:data.expectedRevision,milestoneDay:policy.day};
            return commit(tx,c,{nextAccount,owned,removed:new Set(),revision,before,pills,action:"loginReward",heroId,
                kind:"hero-login-reward",intent,opRef,ledgerRef,claimRef});
        });
    }
    async function claimDailySupply(request){
        const data=request.data||{},observedAtMs=now(),day=taipeiDay(observedAtMs);
        if(keys(data)!=="expectedRevision|operationId|periodDate|session|uid"||!validDay(data.periodDate)||
           data.operationId!==dailyId(data.periodDate)||!Number.isSafeInteger(data.expectedRevision)||data.expectedRevision<1){
            fail("invalid-argument","Only the server-projected date, fixed operation ID and revision accepted.");
        }
        return runProtected(request,async(tx,session)=>{
            const c=await context(tx,session),receipt=await dailyReceipt(tx,c,data.periodDate);
            if(receipt)return {...view(c),receipt};
            if(data.periodDate!==day||taipeiDay(now())!==day){fail("failed-precondition","Daily supply date expired; no catch-up.");}
            if(c.envelope.serverRevision!==data.expectedRevision){fail("aborted","CLOUD_REVISION_CONFLICT");}
            let nextAccount=c.account;
            try{for(const [id,amount] of Object.entries(dailyFragments)){nextAccount=domain(nextAccount).addSpecificFragments(id,amount);}}
            catch(_){fail("failed-precondition","Hero fragment capacity exceeded.");}
            const pills=pillCount(c.records),revision=nextRevision(c.envelope),owned=advanceOwnedRecords(c.records,revision);
            addRewardPill(c,owned,revision,data.operationId,pills,1);
            // No external effects inside the transaction; retries cannot roll into a new day.
            if(taipeiDay(now())!==day){fail("failed-precondition","Daily supply date expired; synchronize again.");}
            const intent={operationId:data.operationId,expectedRevision:data.expectedRevision,periodDate:day};
            return commit(tx,c,{nextAccount,owned,removed:new Set(),revision,before:c.account.heroes.divineDogHongbao,
                pills,action:"dailySupply",heroId:"divineDogHongbao",kind:"hero-daily-supply",intent,
                dailyEvidence:{periodDate:day,observedAtMs},
                opRef:c.root.collection("operations").doc(data.operationId),
                ledgerRef:c.root.collection("ledgerEntries").doc(data.operationId),
                claimRef:c.root.collection("uniqueClaims").doc(data.operationId)});
        });
    }
    function addRewardPill(c,owned,revision,operationId,pills,count){
        if(!Number.isSafeInteger(pills+count)){fail("failed-precondition","Marrow resource capacity exceeded.");}
        const item=owned.inventory.filter(row=>row.location==="bag"&&row.state.id===Core.contract.rerollItem.id)
            .sort((a,b)=>a.ownedItemId.localeCompare(b.ownedItemId,"en"))[0];
        if(item){item.state={...item.state,count:item.state.count+count};}
        else{
            if(c.owned.refs.length>=400){fail("failed-precondition","Owned source transaction budget exceeded.");}
            const ownedItemId=operationId+"-marrow";
            if(owned.inventory.some(row=>row.ownedItemId===ownedItemId)){fail("data-loss","Reward item identity conflict.");}
            owned.inventory.push({schemaVersion:1,ownerUid:c.uid,serverRevision:revision,provenance:"server-created",
                ownedItemId,location:"bag",state:{id:Core.contract.rerollItem.id,type:"material",count}});
        }
    }
    return Object.freeze({read,mutate,claimLoginReward,claimDailySupply,readInTransaction:context});
}
module.exports={createHeroGrowth};
