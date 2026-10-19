"use strict";

const {createHash}=require("node:crypto");
const {performance}=require("node:perf_hooks");

// A candidate data format, not a trusted capture certificate or restore source.
const MAGIC=Buffer.from("CSRA1\n");
const LIMITS=Object.freeze({bytes:32*1024*1024,documents:4096,frameBytes:2*1024*1024,depth:64,frames:12288,nodes:1000000});
const NAMES=Object.freeze(["account","characters","economy","inventory","equipment","relics",
    "relicLoadout","progress","claimCheckpoints","claimRecords","playableSnapshots","recoveryArchives",
    "uniqueClaims","grantOperations","ledgerEntries","pendingGrants","rewardEvents","operations",
    "simulatedAdSources","modeTimeEvents","modeTime","patrol","patrolTickets","patrolTicketStates",
    "patrolSettlements","patrolClosures","recoveryApprovals","recoveryAudits"]);
const bad=message=>{throw Error(`Invalid recovery audit artifact: ${message}`);};
const ASSEMBLY_LIMITS=Object.freeze({bytes:256*1024*1024,nodes:16000000,operations:16384,passes:64,milliseconds:30000});
const assemblyBudgets=new WeakMap();
function createRecoveryAuditAssemblyBudget(){
    const token=Object.freeze({});
    assemblyBudgets.set(token,{bytes:0,reserved:0,nodes:0,operations:0,passes:0,startedAt:performance.now(),rawReserved:false});
    return token;
}
function assemblyCharge(token,field,amount=0){
    if(token===undefined)return;
    const state=assemblyBudgets.get(token);
    if(!state)bad("unknown assembly budget");
    if(state.failure)throw state.failure;
    const exhausted=message=>{state.failure=Error(`Invalid recovery audit artifact: ${message}`);throw state.failure;};
    if(performance.now()-state.startedAt>ASSEMBLY_LIMITS.milliseconds)exhausted("assembly deadline exceeded");
    if(field){
        if(!Number.isSafeInteger(amount)||amount<0||state[field]+amount+(field==="bytes"?state.reserved:0)>ASSEMBLY_LIMITS[field])
            exhausted(`assembly ${field} budget exceeded`);
        state[field]+=amount;
    }
    return state;
}
function reserveRecoveryAuditRawInputs(token,buffers){
    const state=assemblyCharge(token);
    if(state.rawReserved)bad("assembly raw input already reserved");
    let total=0;
    for(const buffer of buffers){
        assemblyCharge(token);
        if(!Buffer.isBuffer(buffer)||!buffer.length||buffer.length>LIMITS.frameBytes)bad("assembly raw input bytes");
        total+=buffer.length;
        if(total>ASSEMBLY_LIMITS.bytes-state.bytes-state.reserved)bad("assembly bytes budget exceeded");
    }
    state.reserved=total;state.rawReserved=true;
}
function assemblyDecodeBytes(token,length,reserved){
    const state=assemblyCharge(token);if(!state)return;
    if(reserved){
        if(!state.rawReserved||length>state.reserved)bad("assembly raw reservation differs");
        state.reserved-=length;
    }
    assemblyCharge(token,"bytes",length);
}
function finishRecoveryAuditRawInputs(token){
    const state=assemblyCharge(token);
    if(state&&(!state.rawReserved||state.reserved!==0))bad("assembly raw reservation is incomplete");
}
function recoveryAuditAssemblyUsage(token){
    const state=assemblyCharge(token);
    return Object.freeze({bytes:state.bytes,reservedBytes:state.reserved,nodes:state.nodes,operations:state.operations,
        passes:state.passes,elapsedMs:performance.now()-state.startedAt});
}
function assemblyParsedNodes(row,token,depth=0){
    if(depth>LIMITS.depth*3+8)bad("parsed node or depth limit");
    assemblyCharge(token,"nodes",1);
    if(Array.isArray(row)){for(const child of row)assemblyParsedNodes(child,token,depth+1);}
    else if(row&&typeof row==="object")for(const child of Object.values(row))assemblyParsedNodes(child,token,depth+1);
}
const lookupAttempts=new WeakMap();
async function drainAndCloseRecoveryAuditLookups(view){
    const attempt=lookupAttempts.get(view);
    if(!attempt)bad("unknown lookup view");
    if(!attempt.closed){
        attempt.open=false;
        // Only settle lookups already emitted by this exact immutable view.
        // This is not a drain of an Owner's entire asynchronous call graph;
        // later lookups remain strict but cannot change this attempt's trace.
        attempt.closed=Promise.allSettled([...attempt.pending]).then(()=>Object.freeze([...attempt.missing]));
    }
    return attempt.closed;
}
const compareNames=(a,b)=>Buffer.compare(Buffer.from(a,"utf8"),Buffer.from(b,"utf8"));
const INVENTORY_LIMITS=Object.freeze({rows:16,payloadBytes:128*1024});
function recoveryAuditNamespaces(uid,version=2){
    if(typeof uid!=="string"||!uid||uid.includes("/")||![1,2].includes(version))bad("namespace identity");
    const names=version===2?[...NAMES,"recoveryAuditFence","recoveryAuditRuns"]:NAMES;
    return Object.freeze([...names.map(name=>`serverUsers/${uid}/${name}`),`users/${uid}/saves`]);
}
const exact=(value,keys)=>{
    if(!value||Array.isArray(value)||typeof value!=="object"||
       Object.keys(value).sort().join("|")!==keys.slice().sort().join("|"))bad("frame shape");
};
class ArtifactTimestamp{
    constructor(seconds,nanoseconds){
        if(!Number.isInteger(seconds)||seconds<-62135596800||seconds>253402300799||
           !Number.isInteger(nanoseconds)||nanoseconds<0||nanoseconds>999999999)bad("timestamp");
        // Match the pinned Node Firestore Timestamp's enumerable storage and
        // rounding, including its shape under the original snapshotDigest.
        this._seconds=seconds;this._nanoseconds=nanoseconds;Object.freeze(this);
    }
    get seconds(){return this._seconds;}
    get nanoseconds(){return this._nanoseconds;}
    toMillis(){return this.seconds*1000+Math.floor(this.nanoseconds/1000000);}
    toDate(){return new Date(this.seconds*1000+Math.round(this.nanoseconds/1000000));}
    isEqual(other){return other instanceof ArtifactTimestamp&&this.seconds===other.seconds&&this.nanoseconds===other.nanoseconds;}
}
function value(node,depth=0){
    if(depth>LIMITS.depth||!Array.isArray(node))bad("typed value or depth");
    const [kind,payload,nanos]=node;
    if(kind==="null"&&node.length===1)return null;
    if(kind==="timestamp"&&node.length===3)return new ArtifactTimestamp(payload,nanos);
    if(node.length!==2)bad("typed arity");
    if(kind==="string"&&typeof payload==="string")return payload;
    if(kind==="boolean"&&typeof payload==="boolean")return payload;
    if(kind==="number"&&typeof payload==="number"&&Number.isFinite(payload))return payload;
    if(kind==="number"&&payload==="-0")return -0;
    if(kind==="array"&&Array.isArray(payload))return Object.freeze(payload.map(row=>value(row,depth+1)));
    if(kind==="object"&&Array.isArray(payload)){
        const result={};
        for(const row of payload){
            if(!Array.isArray(row)||row.length!==2||typeof row[0]!=="string"||
               Object.hasOwn(result,row[0])||["__proto__","constructor","prototype"].includes(row[0]))bad("object key");
            Object.defineProperty(result,row[0],{value:value(row[1],depth+1),enumerable:true});
        }
        return Object.freeze(result);
    }
    bad("unsupported typed value");
}
// The inverse of the same bounded typed codec used by candidate documents.
// Map order is canonical; Firestore map enumeration order is not evidence.
function encodedValue(row,depth=0,budget={nodes:0},assemblyBudget){
    assemblyCharge(assemblyBudget,"nodes",1);
    if(depth>LIMITS.depth||++budget.nodes>LIMITS.nodes)bad("typed value or resource limit");
    if(row===null)return ["null"];
    if(typeof row==="string"||typeof row==="boolean")return [typeof row,row];
    if(typeof row==="number"&&Number.isFinite(row))return ["number",Object.is(row,-0)?"-0":row];
    if(row&&typeof row.toMillis==="function"){
        const stamp=new ArtifactTimestamp(row.seconds,row.nanoseconds);
        return ["timestamp",stamp.seconds,stamp.nanoseconds];
    }
    if(Array.isArray(row)){
        for(let index=0;index<row.length;index++)if(!Object.hasOwn(row,index))bad("sparse typed array");
        return ["array",row.map(child=>encodedValue(child,depth+1,budget,assemblyBudget))];
    }
    if(row&&typeof row==="object"&&[Object.prototype,null].includes(Object.getPrototypeOf(row))){
        return ["object",Object.keys(row).sort().map(key=>{
            if(["__proto__","constructor","prototype"].includes(key)||!Object.hasOwn(Object.getOwnPropertyDescriptor(row,key),"value"))bad("object key");
            return [key,encodedValue(row[key],depth+1,budget,assemblyBudget)];
        })];
    }
    bad("unsupported typed value");
}
function encodeInventoryPayload(payload){
    const bytes=Buffer.from(JSON.stringify(encodedValue(payload)),"utf8");
    if(bytes.length>INVENTORY_LIMITS.payloadBytes)bad("inventory payload size");
    return bytes;
}
function decodeInventoryPayload(bytes,assemblyBudget,reserved=false){
    if(!Buffer.isBuffer(bytes)||!bytes.length||bytes.length>INVENTORY_LIMITS.payloadBytes)bad("inventory payload size");
    assemblyDecodeBytes(assemblyBudget,bytes.length,reserved);
    const text=bytes.toString("utf8");let parsed;
    try{parsed=JSON.parse(text);}catch(_){bad("inventory payload JSON");}
    if(assemblyBudget)assemblyParsedNodes(parsed,assemblyBudget);
    if(JSON.stringify(parsed)!==text||!Buffer.from(text).equals(bytes))bad("inventory payload encoding");
    return value(parsed);
}
const PATROL_PROOF_LIMITS=Object.freeze({bytes:2*1024*1024,chunkBytes:256*1024,chunks:8,reads:400,kernelReads:60,inventoryDocuments:4096,inventoryPages:317});
function encodeProofPayload(payload,assemblyBudget){
    const text=JSON.stringify(encodedValue(payload,0,{nodes:0},assemblyBudget));
    assemblyCharge(assemblyBudget,"bytes",Buffer.byteLength(text,"utf8"));
    const bytes=Buffer.from(text,"utf8");
    if(!bytes.length||bytes.length>PATROL_PROOF_LIMITS.bytes)bad("Patrol proof payload size");
    return bytes;
}
function decodeProofPayload(bytes,assemblyBudget,reserved=false){
    if(!Buffer.isBuffer(bytes)||!bytes.length||bytes.length>PATROL_PROOF_LIMITS.bytes)bad("Patrol proof payload size");
    assemblyDecodeBytes(assemblyBudget,bytes.length,reserved);
    let parsed;try{parsed=JSON.parse(bytes.toString("utf8"));}catch(_){bad("Patrol proof JSON");}
    if(assemblyBudget)assemblyParsedNodes(parsed,assemblyBudget);
    const result=value(parsed);
    if(!encodeProofPayload(result,assemblyBudget).equals(bytes))bad("Patrol proof encoding");
    return result;
}
function inventoryDocumentMetadata(snapshot,namespace,assemblyBudget){
    if(!snapshot?.exists||typeof snapshot.id!=="string"||!snapshot.id||snapshot.id.includes("/")||
       Buffer.from(snapshot.id,"utf8").toString("utf8")!==snapshot.id||snapshot.ref?.path!==`${namespace}/${snapshot.id}`)
        bad("inventory document identity");
    // Exact SDK versions are mandatory. No data timestamp/millisecond fallback.
    const stamp=new ArtifactTimestamp(snapshot.updateTime?.seconds,snapshot.updateTime?.nanoseconds);
    const text=JSON.stringify(encodedValue(snapshot.data(),0,{nodes:0},assemblyBudget));
    assemblyCharge(assemblyBudget,"bytes",Buffer.byteLength(text,"utf8"));
    const bytes=Buffer.from(text,"utf8");
    if(bytes.length>LIMITS.frameBytes)bad("typed document size");
    return Object.freeze({id:snapshot.id,updateTime:Object.freeze({seconds:stamp.seconds,nanoseconds:stamp.nanoseconds}),
        typedDataSha256:createHash("sha256").update(bytes).digest("hex"),typedDataByteLength:bytes.length});
}
function clone(row){
    if(row instanceof ArtifactTimestamp)return new ArtifactTimestamp(row.seconds,row.nanoseconds);
    if(Array.isArray(row))return Object.freeze(row.map(clone));
    if(row&&typeof row==="object")return Object.freeze(Object.fromEntries(Object.entries(row).map(([key,v])=>[key,clone(v)])));
    return row;
}
function encodeRecoveryAuditCandidate({uid,expectedRevision,auditControl,documents,namespaces,absences},token){
    finishRecoveryAuditRawInputs(token);
    assemblyCharge(token,"passes",1);
    if(!Array.isArray(documents)||!Array.isArray(namespaces)||!Array.isArray(absences)||
       documents.length+absences.length>LIMITS.documents)bad("document limit");
    const texts=[];let size=MAGIC.length;
    const add=frame=>{
        assemblyCharge(token,"nodes",1);
        const text=JSON.stringify(frame),length=Buffer.byteLength(text,"utf8");
        if(!length||length>LIMITS.frameBytes)bad("frame size");
        size+=length+4;
        if(size>LIMITS.bytes||texts.length>=LIMITS.frames)bad("bytes or frame limit");
        texts.push({text,length});
    };
    add({type:"header",schemaVersion:2,ownerUid:uid,expectedRevision,auditControl});
    for(const row of documents)add({type:"document",path:row.path,data:encodedValue(row.data,0,{nodes:0},token)});
    for(const path of absences)add({type:"absence",path});
    for(const row of namespaces)add({type:"namespace",path:row.path,ids:row.ids,terminalEmpty:row.terminalEmpty});
    add({type:"footer",frameCount:texts.length+1,documentCount:documents.length,absenceCount:absences.length});
    // Charge the entire exact output before allocating either frame Buffers or
    // their concatenation. Raw input reservations cannot fund this encoding.
    assemblyCharge(token,"bytes",size);
    const parts=[MAGIC];
    for(const {text,length} of texts){
        assemblyCharge(token);
        const prefix=Buffer.alloc(4);prefix.writeUInt32BE(length);parts.push(prefix,Buffer.from(text,"utf8"));
    }
    assemblyCharge(token);
    return Buffer.concat(parts,size);
}
function decodeRecoveryAuditArtifact(bytes,{uid,expectedRevision,db},assemblyBudget){
    if(!Buffer.isBuffer(bytes)||bytes.length>LIMITS.bytes||!bytes.subarray(0,MAGIC.length).equals(MAGIC))bad("bytes or magic");
    assemblyDecodeBytes(assemblyBudget,bytes.length,false);
    // Copy before parsing: a caller cannot mutate the verified byte array later.
    bytes=Buffer.from(bytes);
    const frames=[];let offset=MAGIC.length,nodeCount=0;
    while(offset<bytes.length){
        if(frames.length>=LIMITS.frames||offset+4>bytes.length)bad("frame boundary");
        const size=bytes.readUInt32BE(offset);offset+=4;
        if(!size||size>LIMITS.frameBytes||offset+size>bytes.length)bad("frame size");
        const raw=bytes.subarray(offset,offset+size),text=raw.toString("utf8");offset+=size;
        let frame;try{frame=JSON.parse(text);}catch(_){bad("frame JSON");}
        const shapes={header:frame?.schemaVersion===2?["type","schemaVersion","ownerUid","expectedRevision","auditControl"]:
            ["type","schemaVersion","ownerUid","expectedRevision"],
            footer:["type","frameCount","documentCount","absenceCount"],document:["type","path","data"],
            absence:["type","path"],namespace:["type","path","ids","terminalEmpty"]};
        if(!frame||!Object.hasOwn(shapes,frame.type))bad("unknown frame");
        exact(frame,shapes[frame.type]);
        // Bound parsed-tree overhead across frames as well as wire bytes. One
        // frame is bounded before JSON.parse; reject its shape immediately and
        // charge every parsed node before retaining any further frame.
        function charge(row,depth){
            assemblyCharge(assemblyBudget,"nodes",1);
            if(++nodeCount>LIMITS.nodes||depth>LIMITS.depth*3+8)bad("parsed node or depth limit");
            if(Array.isArray(row)){for(const child of row)charge(child,depth+1);}
            else if(row&&typeof row==="object")for(const child of Object.values(row))charge(child,depth+1);
        }
        charge(frame,0);
        // Canonical JSON also rejects duplicate JSON keys and malformed UTF-8.
        if(JSON.stringify(frame)!==text||!Buffer.from(text).equals(raw))bad("noncanonical JSON");
        frames.push(frame);
    }
    if(frames.length<2)bad("missing header/footer");
    const header=frames.shift(),footer=frames.pop();
    exact(header,header.schemaVersion===2?["type","schemaVersion","ownerUid","expectedRevision","auditControl"]:
        ["type","schemaVersion","ownerUid","expectedRevision"]);
    if(header.type!=="header"||![1,2].includes(header.schemaVersion)||header.ownerUid!==uid||
       header.expectedRevision!==expectedRevision||typeof uid!=="string"||!uid||uid.includes("/")||
       !Number.isSafeInteger(expectedRevision)||expectedRevision<2)bad("header identity");
    exact(footer,["type","frameCount","documentCount","absenceCount"]);
    if(footer.type!=="footer"||footer.frameCount!==frames.length+2)bad("footer");
    const root=db.collection("serverUsers").doc(uid),save=db.collection("users").doc(uid).collection("saves").doc("current");
    let auditControl=null;
    if(header.schemaVersion===2){
        const control=header.auditControl;
        exact(control,["auditId","epoch","sessionId","sessionRevision","recordedAt"]);
        if(!/^[A-Za-z0-9_-]{16,64}$/.test(control.auditId||"")||!Number.isSafeInteger(control.epoch)||control.epoch<1||
           !/^[A-Za-z0-9_-]{32}$/.test(control.sessionId||"")||!Number.isSafeInteger(control.sessionRevision)||control.sessionRevision<1||
           !Array.isArray(control.recordedAt)||control.recordedAt[0]!=="timestamp")bad("audit control identity");
        auditControl=Object.freeze({...control,recordedAt:value(control.recordedAt)});
    }
    const namespacePaths=recoveryAuditNamespaces(uid,header.schemaVersion);
    const allowed=new Set(namespacePaths),documents=new Map(),absences=new Set(),inventories=new Map();
    const parent=path=>typeof path==="string"?path.slice(0,path.lastIndexOf("/")):"";
    const validPath=path=>typeof path==="string"&&allowed.has(parent(path))&&path.split("/").every(part=>part.length>0);
    for(const frame of frames){
        if(frame.type==="document"||frame.type==="absence"){
            exact(frame,frame.type==="document"?["type","path","data"]:["type","path"]);
            if(!validPath(frame.path)||documents.has(frame.path)||absences.has(frame.path))bad("duplicate or foreign document");
            if(documents.size+absences.size>=LIMITS.documents)bad("document limit");
            if(frame.type==="document"){
                const decoded=value(frame.data);
                if(!decoded||Array.isArray(decoded)||typeof decoded!=="object"||decoded instanceof ArtifactTimestamp)bad("document data");
                documents.set(frame.path,decoded);
            }else absences.add(frame.path);
        }else if(frame.type==="namespace"){
            exact(frame,["type","path","ids","terminalEmpty"]);
            if(!allowed.has(frame.path)||inventories.has(frame.path)||frame.terminalEmpty!==true||!Array.isArray(frame.ids)||
               frame.ids.some(id=>typeof id!=="string"||!id||id.includes("/"))||new Set(frame.ids).size!==frame.ids.length||
               frame.ids.some((id,i)=>i>0&&compareNames(frame.ids[i-1],id)>=0))bad("namespace inventory");
            inventories.set(frame.path,Object.freeze(frame.ids.slice()));
        }else bad("unknown frame");
    }
    if(documents.size!==footer.documentCount||absences.size!==footer.absenceCount||inventories.size!==allowed.size)bad("counts or missing namespace");
    for(const [path,ids] of inventories){
        for(const id of ids)if(!documents.has(`${path}/${id}`))bad("inventory missing document");
    }
    for(const path of documents.keys())if(!inventories.get(parent(path)).includes(path.slice(path.lastIndexOf("/")+1)))bad("unindexed document");
    for(const path of absences)if(inventories.get(parent(path)).includes(path.slice(path.lastIndexOf("/")+1)))bad("contradictory absence");
    const used=new Set(),queries=[],attempt={open:true,pending:new Set(),missing:new Set(),closed:null};
    const field=(row,key)=>key.split(".").reduce((v,k)=>v?.[k],row);
    function document(path){
        if(!documents.has(path)&&!absences.has(path)){
            if(attempt.open&&validPath(path)&&!inventories.get(parent(path)).includes(path.slice(path.lastIndexOf("/")+1)))
                attempt.missing.add(path);
            bad(`unrecorded dependency ${path}`);
        }
        used.add(path);
        const data=documents.get(path);
        return Object.freeze({id:path.slice(path.lastIndexOf("/")+1),ref:db.doc(path),exists:documents.has(path),
            data:()=>clone(data),get:key=>clone(field(data,key))});
    }
    function rows(name){assemblyCharge(assemblyBudget,"operations",1);return Object.freeze(inventories.get(`${root.path}/${name}`).map(id=>document(`${root.path}/${name}/${id}`)));}
    const result=docs=>Object.freeze({docs:Object.freeze(docs),size:docs.length,empty:docs.length===0});
    const add=(query,name,filter=()=>true,maximum=Infinity,order=null)=>queries.push({query,name,filter,maximum,order});
    for(const name of ["characters","inventory","equipment","relics","claimRecords"])add(root.collection(name),name);
    for(const name of ["uniqueClaims","grantOperations","ledgerEntries","pendingGrants","rewardEvents","operations",
        "simulatedAdSources","patrolTickets","patrolTicketStates","patrolSettlements","patrolClosures"])
        add(root.collection(name).limit(401),name,()=>true,401);
    for(const name of ["pendingGrants","grantOperations","uniqueClaims","ledgerEntries","rewardEvents","simulatedAdSources",
        "patrolTickets","patrolTicketStates","patrolSettlements","patrolClosures"])
        add(root.collection(name).limit(1),name,()=>true,1);
    for(const [key,expected] of [["modeChanged",true],["schemaVersion",2],["resultOwner","forest-patrol-settlement"]])
        add(root.collection("modeTimeEvents").where(key,"==",expected).limit(401),"modeTimeEvents",row=>field(row,key)===expected,401);
    for(const name of ["operations","ledgerEntries"])
        add(root.collection(name).where("kind","==","account-mode-time").limit(1),name,row=>row.kind==="account-mode-time",1);
    add(root.collection("modeTimeEvents").orderBy("sequence","desc").limit(2),"modeTimeEvents",row=>Object.hasOwn(row,"sequence"),2,"sequence");
    const lookup=async reference=>{
        assemblyCharge(assemblyBudget,"operations",1);
        if(reference&&typeof reference.collection==="function"&&typeof reference.path==="string")return document(reference.path);
        if(typeof reference?.isEqual!=="function")bad("unsupported query API");
        const matches=queries.filter(entry=>reference.isEqual(entry.query));
        if(matches.length!==1)bad("unknown or ambiguous query");
        const entry=matches[0];let ids=inventories.get(`${root.path}/${entry.name}`).filter(id=>entry.filter(documents.get(`${root.path}/${entry.name}/${id}`)));
        if(entry.order){
            if(ids.some(id=>!Number.isSafeInteger(field(documents.get(`${root.path}/${entry.name}/${id}`),entry.order))))bad("unsupported mode sequence ordering");
            ids=ids.slice().sort((a,b)=>{
            const delta=field(documents.get(`${root.path}/${entry.name}/${b}`),entry.order)-field(documents.get(`${root.path}/${entry.name}/${a}`),entry.order);
            return delta||compareNames(b,a);
            });
        }
        return result(ids.slice(0,entry.maximum).map(id=>document(`${root.path}/${entry.name}/${id}`)));
    };
    const tx=Object.freeze({get:reference=>{
        const pending=lookup(reference);
        if(attempt.open)attempt.pending.add(pending);
        // Observe both outcomes even when an original Owner catches/replaces
        // the rejection or a sibling in Promise.all rejects first.
        void pending.then(()=>attempt.pending.delete(pending),()=>attempt.pending.delete(pending));
        return pending;
    }});
    const view=Object.freeze({root,save,tx,auditControl,rows:name=>result(rows(name)),
        finish:()=>{
            assemblyCharge(assemblyBudget);
            const unused=[...documents.keys(),...absences].filter(path=>!used.has(path));
            if(unused.length)bad(`unused dependency ${unused[0]}`);
            return Object.freeze({artifactSha256:createHash("sha256").update(bytes).digest("hex"),documentCount:documents.size,
                absenceCount:absences.size,dependencyCount:used.size});
        }});
    lookupAttempts.set(view,attempt);
    return view;
}

module.exports={createRecoveryAuditAssemblyBudget,reserveRecoveryAuditRawInputs,finishRecoveryAuditRawInputs,recoveryAuditAssemblyUsage,
    encodeRecoveryAuditCandidate,decodeRecoveryAuditArtifact,drainAndCloseRecoveryAuditLookups,recoveryAuditNamespaces,encodeInventoryPayload,decodeInventoryPayload,
    inventoryDocumentMetadata,INVENTORY_LIMITS,encodeProofPayload,decodeProofPayload,PATROL_PROOF_LIMITS};
