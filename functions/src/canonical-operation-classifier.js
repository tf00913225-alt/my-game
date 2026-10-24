"use strict";

// Sole global operations-inventory routing. This checks retained header
// identity only; every Recovery branch still invokes its original full proof.
// It has no I/O, writer dependencies or authority-bearing result.
function classifyRetainedCanonicalOperation(row,id,uid,revision,fail){
    const reject=()=>fail("data-loss","Operation inventory identity or revision is inconsistent.");
    const heroTransition=["hero-growth","hero-login-reward","hero-daily-supply"].includes(row?.kind);
    const operationId=heroTransition?row.intent?.operationId:row?.operationId;
    if(!row||typeof row!=="object"||Array.isArray(row)||row.schemaVersion!==1||row.ownerUid!==uid||
       typeof id!=="string"||!/^[A-Za-z0-9_-]{16,64}(?![\s\S])/.test(id)||
       typeof operationId!=="string"||!/^[A-Za-z0-9_-]{16,64}(?![\s\S])/.test(operationId)||
       !Number.isSafeInteger(revision)||revision<1)reject();
    let category,required;
    switch(row.kind){
    case "hero-login-observation":case "hero-chapter-ticket":case "hero-chapter-step":
        category="hero";required=["sourceRevision","serverRevision"];
        if(row.serverRevision!==row.sourceRevision+1)reject();break;
    case "hero-growth":case "hero-login-reward":case "hero-daily-supply":
        category="hero";required=["sourceRevision","serverRevision"];
        if(!Number.isSafeInteger(row.intent.expectedRevision)||row.intent.expectedRevision<1||
           row.sourceRevision>row.intent.expectedRevision||row.serverRevision!==row.intent.expectedRevision+1)reject();break;
    case "forest-patrol-settlement":category="patrol";required=["sourceRevision","envelopeRevision","resultRevision","resultEnvelopeRevision"];break;
    case "account-mode-time":category="mode";required=["sourceRevision","envelopeRevision","resultRevision","resultEnvelopeRevision"];break;
    case "shop-purchase":category="debit";required=["purchasedRevision"];break;
    case "exp-allocation":case "attribute-allocation":category="debit";required=["allocatedRevision"];break;
    case "skill-learning":category="debit";required=["sourceRevision","expectedRevision","allocatedRevision"];break;
    case "skill-loadout":category="loadout";required=["sourceRevision","expectedRevision","resultRevision"];break;
    case "canonical-current-recovery":category="recovery";required=["sourceRevision","restoredRevision"];break;
    case "initial-character-sources":category="source";required=["sourceRevision"];break;
    case "additional-character-sources":
        category="source";required=["sourceRevision","resultRevision"];
        if(!row.intent||row.intent.operationId!==id||!Number.isSafeInteger(row.intent.expectedRevision)||
           row.intent.expectedRevision<2||row.intent.expectedRevision>=revision||
           row.resultRevision!==row.intent.expectedRevision+1||row.sourceRevision>row.intent.expectedRevision)reject();
        break;
    case "daily-period-source":category="source";required=["sourceRevision"];
        if(row.periodId!==id||!/^daily-period-\d{8}(?![\s\S])/.test(id))reject();break;
    case "daily-period-observation":category="source";required=["expectedRevision"];break;
    case "daily-period-application":category="source";required=["inputRevision","appliedRevision"];
        if(row.markerId!==id||!/^daily-period-applied-\d{8}(?![\s\S])/.test(id))reject();break;
    case "daily-period-apply":category="source";required=["expectedRevision","appliedRevision"];break;
    default:fail("failed-precondition","Unsupported retained operation blocks recovery.");
    }
    if(!["daily-period-source","daily-period-application"].includes(row.kind)&&operationId!==id)reject();
    if(required.some(field=>!Number.isSafeInteger(row[field])||row[field]<1||row[field]>revision))reject();
    for(const field of ["sourceRevision","expectedRevision","envelopeRevision","resultRevision","resultEnvelopeRevision",
        "purchasedRevision","allocatedRevision","inputRevision","appliedRevision","restoredRevision"]){
        if(Object.hasOwn(row,field)&&(!Number.isSafeInteger(row[field])||row[field]<1||row[field]>revision))reject();
    }
    return category;
}
module.exports={classifyRetainedCanonicalOperation};
