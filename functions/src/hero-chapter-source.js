"use strict";
const {randomBytes}=require("node:crypto");
const {snapshotDigest:digest}=require("./canonical-snapshot");
const catalog=require("./generated/hero-chapter-qualification.json");
const retainedV1=require("./generated/hero-chapter-qualification-v1.json");
// Exact twenty-node policy published by dev@190d249e, retained without edits.
const retainedStoryV2=require("./generated/hero-chapter-qualification-v2-20261020.json");
// Issued tickets retain their immutable route and receipts across story edits.
// Only these policies may advance or renew. Historical evidence reads keep
// their original receipt/digest validation. Never rewrite an existing ticket.
const acceptedPolicies=new Set([digest(catalog),digest(retainedV1),digest(retainedStoryV2)]);
const acceptsPolicy=policy=>!!policy&&acceptedPolicies.has(digest(policy));
const Core=require("./hero-core");
const HERO="divineDogHongbao",CLAIM="hero-v1-"+HERO,TTL=7*86400000;
const strip=data=>{const {createdAt,updatedAt,...value}=data;return value;};
const validId=id=>typeof id==="string"&&/^[A-Za-z0-9_-]{32}$/.test(id);

// Trusted bounded chapter qualification, not a Server Battle Runtime. Each
// intent consumes the next server-issued chapter position. No win flag,
// combat action, stats, RNG, gold/EXP or local completion snapshot is admitted.
function createHeroChapterSource({fail,nextRevision,FieldValue,makeClaim,
    nonce=()=>randomBytes(24).toString("base64url")}){
    function refs(root){return {marker:root.collection("heroChapter").doc("current"),
        tickets:root.collection("heroChapterTickets"),steps:root.collection("heroChapterSteps"),
        claim:root.collection("uniqueClaims").doc(CLAIM)};}
    function node(policy,id){return policy.nodes.find(row=>row.id===id);}
    function nextNode(policy,id,choice){
        const row=node(policy,id);
        if(!row){fail("data-loss","Chapter node is outside its sealed policy.");}
        if(row.type==="branch"){
            const branch=row.branches.find(entry=>entry.id===choice);
            if(!branch){fail("invalid-argument","A legal chapter branch is required.");}
            return branch.nodeId;
        }
        if(choice!==null){fail("invalid-argument","This chapter node has no branch choice.");}
        return row.type==="finish"?null:row.next;
    }
    async function evidence(tx,root,collection,id,kind,uid){
        const snap=await tx.get(root.collection(collection).doc(id));
        if(!snap.exists||!snap.data().createdAt){fail("data-loss","Chapter evidence is missing.");}
        const {sha256,...proof}=strip(snap.data());
        if(proof.schemaVersion!==1||proof.kind!==kind||proof.ownerUid!==uid||
           !Number.isSafeInteger(proof.sourceRevision)||proof.sourceRevision<1||
           proof.serverRevision!==proof.sourceRevision+1||!validId(proof.sessionId)||
           sha256!==digest(proof)){
            fail("data-loss","Chapter source or digest is inconsistent.");
        }
        const [receipt,ledger]=await Promise.all([
            tx.get(root.collection("operations").doc(proof.operationId)),
            tx.get(root.collection("ledgerEntries").doc(proof.operationId))]);
        const expected={schemaVersion:1,ownerUid:uid,kind,operationId:proof.operationId,
            sourceRevision:proof.sourceRevision,serverRevision:proof.serverRevision,
            sourceSha256:sha256,sessionId:proof.sessionId};
        if(!receipt.exists||!ledger.exists||!receipt.data().createdAt||!ledger.data().createdAt||
           digest(strip(receipt.data()))!==digest(expected)||digest(strip(ledger.data()))!==digest(expected)){
            fail("data-loss","Chapter receipt or ledger is missing or inconsistent.");
        }
        return {...proof,sha256};
    }
    function writeEvidence(tx,root,collection,id,proof){
        const sha256=digest(proof),stamp=FieldValue.serverTimestamp();
        const operation={schemaVersion:1,ownerUid:proof.ownerUid,kind:proof.kind,
            operationId:proof.operationId,sourceRevision:proof.sourceRevision,
            serverRevision:proof.serverRevision,sourceSha256:sha256,sessionId:proof.sessionId};
        tx.create(root.collection(collection).doc(id),{...proof,sha256,createdAt:stamp});
        tx.create(root.collection("operations").doc(proof.operationId),{...operation,createdAt:stamp});
        tx.create(root.collection("ledgerEntries").doc(proof.operationId),{...operation,createdAt:stamp});
        return sha256;
    }
    async function read(tx,context){
        const {root,envelope}=context,uid=envelope.data.ownerUid,r=refs(root);
        const [markerSnap,latest,claimSnap]=await Promise.all([
            tx.get(r.marker),tx.get(r.tickets.orderBy("serverRevision","desc").limit(1)),tx.get(r.claim)]);
        if(!markerSnap.exists){
            if(latest.size||claimSnap.exists){fail("data-loss","Chapter acquisition source is missing; it cannot be recreated.");}
            return {marker:null,ticket:null,rows:[],entitlement:null};
        }
        const marker=strip(markerSnap.data());
        if(Object.keys(marker).sort().join("|")!==
            "completed|nextNodeId|ownerUid|policySha256|schemaVersion|serverRevision|steps|ticketId"||
           marker.schemaVersion!==1||marker.ownerUid!==uid||!validId(marker.ticketId)||
           typeof marker.completed!=="boolean"||!Array.isArray(marker.steps)||marker.steps.length>32||
           new Set(marker.steps).size!==marker.steps.length||marker.serverRevision>envelope.serverRevision||
           !markerSnap.data().updatedAt||latest.size!==1||latest.docs[0].id!==marker.ticketId){
            fail("data-loss","Chapter acquisition checkpoint is invalid.");
        }
        const tickets=new Map();
        async function ticket(id){
            if(tickets.has(id)){return tickets.get(id);}
            if(!validId(id)){fail("data-loss","Chapter ticket identity is invalid.");}
            const value=await evidence(tx,root,"heroChapterTickets",id,"hero-chapter-ticket",uid);
            const policy=value.policy;
            if(value.ticketId!==id||value.operationId!=="hero-ticket-"+id||
               value.serverRevision>envelope.serverRevision||!Number.isSafeInteger(value.issuedAtMs)||value.issuedAtMs<1||
               value.expiresAtMs!==value.issuedAtMs+TTL||!policy||policy.schemaVersion!==1||
               policy.chapterId!==catalog.chapterId||policy.outcomeVerified!==false||
               !Array.isArray(policy.nodes)||policy.nodes.length>32||
               !node(policy,policy.startNodeId)||node(policy,policy.endNodeId)?.type!=="finish"||
               value.policySha256!==digest(policy)||value.policySha256!==marker.policySha256||
               !Number.isSafeInteger(value.startingStepCount)||value.startingStepCount<0||
               value.startingStepCount>marker.steps.length){
                fail("data-loss","Chapter ticket policy, revision or expiry is invalid.");
            }
            tickets.set(id,value);return value;
        }
        const current=await ticket(marker.ticketId),policy=current.policy;
        let cursor=policy.startNodeId,previousHash=null,previousRevision=0;
        const rows=[];
        for(const operationId of marker.steps){
            if(typeof operationId!=="string"||operationId.length>128){fail("data-loss","Chapter step identity is invalid.");}
            const row=await evidence(tx,root,"heroChapterSteps",operationId,"hero-chapter-step",uid);
            const source=await ticket(row.ticketId);
            if(row.operationId!==operationId||operationId!==`hero-node-${row.ticketId}-${row.nodeId}`||
               row.nodeId!==cursor||row.previousStepSha256!==previousHash||
               row.policySha256!==source.policySha256||row.outcomeVerified!==false||
               row.sourceRevision<source.serverRevision||row.sourceRevision<previousRevision||
               row.serverRevision>envelope.serverRevision||!Number.isSafeInteger(row.observedAtMs)||
               row.observedAtMs<source.issuedAtMs||row.observedAtMs>=source.expiresAtMs){
                fail("data-loss","Chapter steps do not form a legal issued route.");
            }
            cursor=nextNode(policy,row.nodeId,row.choiceId);
            if(cursor===null){
                if(row.nodeId!==policy.endNodeId||!Number.isSafeInteger(row.allocationSeed)||
                   row.allocationSeed<1||row.allocationSeed>0xffffffff){fail("data-loss","Chapter end entitlement is invalid.");}
            }else if(row.allocationSeed!==null){fail("data-loss","Nonterminal chapter step cannot grant a Hero.");}
            previousHash=row.sha256;previousRevision=row.serverRevision;rows.push(row);
        }
        for(const source of tickets.values()){
            const prefix=source.startingStepCount===0?null:rows[source.startingStepCount-1]?.sha256;
            if(source.startingStepSha256!==prefix){fail("data-loss","Renewed chapter ticket lacks its retained prefix.");}
        }
        if(marker.nextNodeId!==cursor||marker.completed!==(cursor===null)||
           marker.serverRevision!==Math.max(previousRevision,current.serverRevision)){
            fail("data-loss","Chapter checkpoint differs from its immutable route.");
        }
        let entitlement=null;
        if(marker.completed){
            const end=rows.at(-1),expected=makeClaim(uid,HERO,end.operationId,end.serverRevision,end.allocationSeed,end.sha256);
            if(!claimSnap.exists||!claimSnap.data().createdAt||digest(strip(claimSnap.data()))!==digest(expected)){
                fail("data-loss","Chapter Hero claim is missing or inconsistent; it cannot be reissued.");
            }
            entitlement={heroId:HERO,claimKey:CLAIM,allocationSeed:end.allocationSeed,
                sourceId:end.operationId,grantedRevision:end.serverRevision};
        }else if(claimSnap.exists){fail("data-loss","Orphan chapter Hero claim cannot be reopened.");}
        return {marker,ticket:current,rows,entitlement};
    }
    function view(source){
        return {chapterId:catalog.chapterId,ticketId:source.ticket?.ticketId||null,
            nextNodeId:source.marker?source.marker.nextNodeId:catalog.startNodeId,
            phase:source.marker?.completed?"completed":source.marker?"active":"not-started",
            expiresAtMs:source.ticket?.expiresAtMs||null,outcomeVerified:false,
            completedIntents:source.rows.map(row=>({nodeId:row.nodeId,choiceId:row.choiceId,ticketId:row.ticketId}))};
    }
    async function ensure(tx,session,context,time,expectedRevision){
        const source=context.chapter;
        if(source.marker?.completed||source.ticket&&time<source.ticket.expiresAtMs){return context;}
        if(expectedRevision!==context.envelope.serverRevision){fail("aborted","CLOUD_REVISION_CONFLICT");}
        if(source.ticket&&!acceptsPolicy(source.ticket.policy)){
            fail("failed-precondition","Chapter policy changed; the retained route requires review.");
        }
        const id=nonce();if(!validId(id)){fail("internal","Invalid server chapter nonce.");}
        const r=refs(context.root),operationId="hero-ticket-"+id;
        const [existing,operation,ledger]=await Promise.all([
            tx.get(r.tickets.doc(id)),tx.get(context.root.collection("operations").doc(operationId)),
            tx.get(context.root.collection("ledgerEntries").doc(operationId))]);
        if(existing.exists||operation.exists||ledger.exists){fail("data-loss","Chapter nonce is already in use.");}
        const revision=nextRevision(context.envelope),policy=source.ticket?.policy||catalog;
        const proof={schemaVersion:1,kind:"hero-chapter-ticket",ownerUid:session.uid,
            ticketId:id,operationId,sourceRevision:context.envelope.serverRevision,
            serverRevision:revision,sessionId:session.sessionId,issuedAtMs:time,expiresAtMs:time+TTL,
            policy,policySha256:digest(policy),startingStepCount:source.rows.length,
            startingStepSha256:source.rows.at(-1)?.sha256||null};
        const marker={schemaVersion:1,ownerUid:session.uid,serverRevision:revision,
            ticketId:id,policySha256:proof.policySha256,steps:source.marker?.steps||[],
            nextNodeId:source.marker?.nextNodeId||policy.startNodeId,completed:false};
        const stamp=FieldValue.serverTimestamp();writeEvidence(tx,context.root,"heroChapterTickets",id,proof);
        tx.set(r.marker,{...marker,updatedAt:stamp});
        tx.update(context.envelopeRef,{serverRevision:revision,updatedAt:stamp});
        return {...context,envelope:{...context.envelope,serverRevision:revision},
            chapter:{marker,ticket:proof,rows:source.rows,entitlement:null},changed:true};
    }
    async function complete(tx,session,context,time,args,allocationSeed){
        const source=context.chapter,{ticketId,nodeId,choiceId,expectedRevision}=args;
        const prior=source.rows.find(row=>row.nodeId===nodeId);
        if(prior){
            if(prior.ticketId!==ticketId||prior.choiceId!==choiceId){fail("failed-precondition","Chapter retry intent differs from its receipt.");}
            return context;
        }
        if(!source.ticket||source.marker.completed||ticketId!==source.ticket.ticketId||
           time<source.ticket.issuedAtMs||time>=source.ticket.expiresAtMs){
            fail("failed-precondition","A current unexpired chapter ticket is required.");
        }
        if(!acceptsPolicy(source.ticket.policy)){fail("failed-precondition","Chapter policy changed; qualification is blocked.");}
        if(expectedRevision!==context.envelope.serverRevision){fail("aborted","CLOUD_REVISION_CONFLICT");}
        if(nodeId!==source.marker.nextNodeId){fail("failed-precondition","Chapter node is not the issued next position.");}
        const policy=source.ticket.policy,cursor=nextNode(policy,nodeId,choiceId);
        const terminal=cursor===null,acquisition=Core.getHeroDefinition(HERO).acquisition;
        if(terminal&&(nodeId!==policy.endNodeId||acquisition.kind!=="mainStoryChapterClear"||
            acquisition.chapter!==1||!acquisition.directUnlock||!Number.isSafeInteger(allocationSeed)||
            allocationSeed<1||allocationSeed>0xffffffff)){fail("failed-precondition","Unsupported chapter entitlement policy.");}
        const operationId=`hero-node-${ticketId}-${nodeId}`,r=refs(context.root);
        const [existing,operation,ledger]=await Promise.all([
            tx.get(r.steps.doc(operationId)),tx.get(context.root.collection("operations").doc(operationId)),
            tx.get(context.root.collection("ledgerEntries").doc(operationId))]);
        if(existing.exists||operation.exists||ledger.exists){fail("data-loss","Orphan chapter step cannot be replaced.");}
        const revision=nextRevision(context.envelope),proof={schemaVersion:1,kind:"hero-chapter-step",
            ownerUid:session.uid,operationId,ticketId,nodeId,choiceId,
            sourceRevision:context.envelope.serverRevision,serverRevision:revision,
            sessionId:session.sessionId,observedAtMs:time,policySha256:source.ticket.policySha256,
            previousStepSha256:source.rows.at(-1)?.sha256||null,outcomeVerified:false,
            allocationSeed:terminal?allocationSeed:null};
        const marker={...source.marker,serverRevision:revision,
            steps:[...source.marker.steps,operationId],nextNodeId:cursor,completed:terminal};
        const stamp=FieldValue.serverTimestamp(),sha256=writeEvidence(tx,context.root,"heroChapterSteps",operationId,proof);
        tx.set(r.marker,{...marker,updatedAt:stamp});
        let entitlement=null;
        if(terminal){
            tx.create(r.claim,{...makeClaim(session.uid,HERO,operationId,revision,allocationSeed,sha256),createdAt:stamp});
            entitlement={heroId:HERO,claimKey:CLAIM,allocationSeed,sourceId:operationId,grantedRevision:revision};
        }
        tx.update(context.envelopeRef,{serverRevision:revision,updatedAt:stamp});
        return {...context,envelope:{...context.envelope,serverRevision:revision},changed:true,
            chapter:{marker,ticket:source.ticket,rows:[...source.rows,{...proof,sha256}],entitlement}};
    }
    return Object.freeze({read,view,ensure,complete});
}
module.exports={createHeroChapterSource};
