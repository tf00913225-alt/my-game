"use strict";

const {createHash}=require("node:crypto");
const {isUtf8}=require("node:buffer");
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
function admitRecoveryAuditAssemblyBytes(token,length){
    const state=assemblyCharge(token);
    if(!Number.isSafeInteger(length)||length<0)bad("assembly allocation length");
    if(state.bytes+state.reserved+length>ASSEMBLY_LIMITS.bytes)
        assemblyCharge(token,"bytes",length); // Sticky exhaustion before allocation.
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
// Canonical syntax qualifications only, never source/proof/restore authority.
// They are scoped to one original assembly token and never serialized.
const indexedRawRows=new WeakMap();
function proofPayloadEncoding(payload,assemblyBudget){
    const tree=encodedValue(payload,0,{nodes:0},assemblyBudget),text=JSON.stringify(tree);
    assemblyCharge(assemblyBudget,"bytes",Buffer.byteLength(text,"utf8"));
    const bytes=Buffer.from(text,"utf8");
    if(!bytes.length||bytes.length>PATROL_PROOF_LIMITS.bytes)bad("Patrol proof payload size");
    return {bytes,tree};
}
function encodeProofPayload(payload,assemblyBudget){return proofPayloadEncoding(payload,assemblyBudget).bytes;}
function decodeProofPayloadInternal(bytes,assemblyBudget,reserved,indexRaw){
    if(!Buffer.isBuffer(bytes)||!bytes.length||bytes.length>PATROL_PROOF_LIMITS.bytes)bad("Patrol proof payload size");
    assemblyDecodeBytes(assemblyBudget,bytes.length,reserved);
    let parsed;try{parsed=JSON.parse(bytes.toString("utf8"));}catch(_){bad("Patrol proof JSON");}
    if(assemblyBudget)assemblyParsedNodes(parsed,assemblyBudget);
    const result=value(parsed);
    const encoded=proofPayloadEncoding(result,assemblyBudget);
    if(!encoded.bytes.equals(bytes))bad("Patrol proof encoding");
    if(!indexRaw)return result;
    if(result?.schemaVersion!==3||!Array.isArray(result.documents)||encoded.tree[0]!=="object")bad("raw document span shape");
    // Walk the same canonical typed tree, not a second JSON parser or a search
    // for matching text. UTF8 lengths include every preceding typed sibling.
    let offset=Buffer.byteLength('["object",['),found=false;const spans=[];
    for(const [position,entry] of encoded.tree[1].entries()){
        if(position)offset++;
        const [key,node]=entry;
        if(key!=="documents"){
            const text=JSON.stringify(entry);assemblyCharge(assemblyBudget,"bytes",Buffer.byteLength(text));
            assemblyParsedNodes(entry,assemblyBudget);offset+=Buffer.byteLength(text);continue;
        }
        if(found||node[0]!=="array"||node[1].length!==result.documents.length)bad("raw document array span");
        found=true;offset+=Buffer.byteLength('['+JSON.stringify(key)+',["array",[');
        for(const [index,row] of node[1].entries()){
            if(index)offset++;
            const text=JSON.stringify(row),length=Buffer.byteLength(text);assemblyCharge(assemblyBudget,"bytes",length);
            assemblyParsedNodes(row,assemblyBudget);
            const raw=bytes.subarray(offset,offset+length);
            if(raw.length!==length||!raw.equals(Buffer.from(text)))bad("raw document span differs");
            spans.push(Object.freeze({start:offset,length,sha256:createHash("sha256").update(raw).digest("hex")}));offset+=length;
        }
        if(!bytes.subarray(offset,offset+3).equals(Buffer.from(']]]')))bad("raw document array closure");
        offset+=3;
    }
    if(!found||offset+2!==bytes.length||!bytes.subarray(offset).equals(Buffer.from(']]')))bad("raw document framing");
    assemblyCharge(assemblyBudget);
    if(!assemblyBudgets.has(assemblyBudget))bad("raw row requires an assembly budget");
    const qualified=spans.map((span,index)=>{
        const qualification=Object.freeze({});
        indexedRawRows.set(qualification,{budget:assemblyBudget,version:3,path:result.documents[index].path,
            length:span.length,sha256:span.sha256});
        return Object.freeze({...span,qualification});
    });
    return {payload:result,spans:Object.freeze(qualified)};
}
function decodeProofPayload(bytes,assemblyBudget,reserved=false){return decodeProofPayloadInternal(bytes,assemblyBudget,reserved,false);}
function indexRawProofPayload(bytes,assemblyBudget,reserved=false){return decodeProofPayloadInternal(bytes,assemblyBudget,reserved,true);}
function decodeIndexedRawProofRow(bytes,qualification,assemblyBudget){
    assemblyCharge(assemblyBudget); // Sticky failure and real deadline precede hash/parse.
    const row=indexedRawRows.get(qualification);
    if(!row||row.budget!==assemblyBudget||row.version!==3||!Buffer.isBuffer(bytes)||bytes.length!==row.length)
        bad("raw row qualification differs");
    assemblyDecodeBytes(assemblyBudget,bytes.length,false);
    if(createHash("sha256").update(bytes).digest("hex")!==row.sha256)bad("raw row bytes differ");
    let parsed;try{parsed=JSON.parse(bytes.toString("utf8"));}catch(_){bad("raw row JSON");}
    assemblyParsedNodes(parsed,assemblyBudget);
    const result=value(parsed);
    if(result?.path!==row.path)bad("raw row identity differs");
    assemblyCharge(assemblyBudget);
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
function candidateFrameText(frame,token){
    assemblyCharge(token,"nodes",1);
    const text=JSON.stringify(frame),length=Buffer.byteLength(text,"utf8");
    if(!length||length>LIMITS.frameBytes)bad("frame size");
    return {text,length};
}
function encodeRecoveryAuditCandidate({uid,expectedRevision,auditControl,documents,namespaces,absences},token){
    finishRecoveryAuditRawInputs(token);
    assemblyCharge(token,"passes",1);
    if(!Array.isArray(documents)||!Array.isArray(namespaces)||!Array.isArray(absences)||
       documents.length+absences.length>LIMITS.documents)bad("document limit");
    const texts=[];let size=MAGIC.length;
    const add=frame=>{
        const {text,length}=candidateFrameText(frame,token);
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
function writeCandidateFrames(buffer,offset,frames,token){
    for(const {text,length} of frames){
        assemblyCharge(token);
        buffer.writeUInt32BE(length,offset);offset+=4;
        offset+=buffer.write(text,offset,length,"utf8");
    }
    return offset;
}
function fixedCandidateEncoder(prefix,suffix,documentCount,fixedFrameCount,token){
    // Only fixed bytes/counts and this one budget survive. There is no input
    // identity memo, mutable source reference, authority or lookup reader.
    return Object.freeze(function encode(absences){
        if(arguments.length!==1)bad("prepared encoding accepts only absences");
        finishRecoveryAuditRawInputs(token);assemblyCharge(token,"passes",1);
        if(!Array.isArray(absences)||documentCount+absences.length>LIMITS.documents)bad("document limit");
        let size=prefix.length+suffix.length;
        const frames=[];
        const add=frame=>{
            const encoded=candidateFrameText(frame,token);size+=encoded.length+4;
            if(size>LIMITS.bytes||fixedFrameCount+frames.length>=LIMITS.frames)bad("bytes or frame limit");
            frames.push(encoded);
        };
        for(const path of absences)add({type:"absence",path});
        add({type:"footer",frameCount:fixedFrameCount+frames.length+1,documentCount,absenceCount:absences.length});
        // Every round pays its complete output, including copies of all fixed
        // bytes, before allocation. Cache construction is a separate charge.
        assemblyCharge(token,"bytes",size);
        const bytes=Buffer.alloc(size);prefix.copy(bytes);
        let offset=writeCandidateFrames(bytes,prefix.length,frames.slice(0,-1),token);
        suffix.copy(bytes,offset);offset+=suffix.length;
        offset=writeCandidateFrames(bytes,offset,frames.slice(-1),token);
        if(offset!==size)bad("prepared encoding length");
        assemblyCharge(token);return bytes;
    });
}
function prepareRecoveryAuditCandidateEncoding({uid,expectedRevision,auditControl,documents,namespaces},token){
    if(arguments.length!==2||!assemblyBudgets.has(token))bad("unknown assembly budget");
    finishRecoveryAuditRawInputs(token);
    if(!Array.isArray(documents)||!Array.isArray(namespaces)||documents.length>LIMITS.documents)bad("document limit");
    const prefix=[],suffix=[];let size=MAGIC.length;
    const add=(frames,frame)=>{
        const encoded=candidateFrameText(frame,token);size+=encoded.length+4;
        if(size>LIMITS.bytes||prefix.length+suffix.length>=LIMITS.frames)bad("bytes or frame limit");
        frames.push(encoded);
    };
    add(prefix,{type:"header",schemaVersion:2,ownerUid:uid,expectedRevision,auditControl});
    for(const row of documents)add(prefix,{type:"document",path:row.path,data:encodedValue(row.data,0,{nodes:0},token)});
    for(const row of namespaces)add(suffix,{type:"namespace",path:row.path,ids:row.ids,terminalEmpty:row.terminalEmpty});
    // As in the fresh formatter, JSON strings are bounded by typed nodes/depth
    // and frame limits. Exact cache bytes are charged before any cache Buffer.
    assemblyCharge(token,"bytes",size);
    const prefixLength=MAGIC.length+prefix.reduce((sum,row)=>sum+row.length+4,0);
    const prefixBytes=Buffer.alloc(prefixLength),suffixBytes=Buffer.alloc(size-prefixLength);
    MAGIC.copy(prefixBytes);writeCandidateFrames(prefixBytes,MAGIC.length,prefix,token);
    writeCandidateFrames(suffixBytes,0,suffix,token);assemblyCharge(token);
    return fixedCandidateEncoder(prefixBytes,suffixBytes,documents.length,prefix.length+suffix.length,token);
}
// Fixed original query surface shared by strict readonly verification modes.
// No caller-supplied query evaluator or data-loader contract.
function recoveryAuditQueryShapes(root){
    const field=(row,key)=>key.split(".").reduce((v,k)=>v?.[k],row);
    const queries=[],add=(query,name,filter=()=>true,maximum=Infinity,order=null)=>queries.push({query,name,filter,maximum,order});
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
    return queries;
}
// Version3 is a syntax-only container for the original raw material. It does
// not run Recovery source/receipt-chain/rights proof or issue a trusted point.
const RAW_ARCHIVE_SHAPES=Object.freeze({
    header:["type","schemaVersion","kind","binding"],control:["type","name","data"],
    "inventory-page":["type","id","metadata","payloadBase64","sha256"],
    "raw-receipt":["type","id","data"],"raw-chunk":["type","id","metadata","payloadBase64","sha256"],
    footer:["type","frameCount","inventoryPageCount","receiptCount","chunkCount","payloadByteLength","framesSha256"]
});
const RAW_CONTROL_NAMES=Object.freeze(["run","inventoryState","rawState"]);
const RAW_GROUPS=Object.freeze([["inventoryPages","inventory-page",317,128*1024],["rawReceipts","raw-receipt",4096,0],
    ["rawChunks","raw-chunk",4096*8,256*1024]]);
function rawArchiveBudget(token){if(!assemblyBudgets.has(token))bad("unknown assembly budget");assemblyCharge(token);}
function rawArchiveObject(row){
    if(!row||![Object.prototype,null].includes(Object.getPrototypeOf(row)))bad("raw archive object");
    for(const key of Object.keys(row))if(!Object.hasOwn(Object.getOwnPropertyDescriptor(row,key),"value"))bad("raw archive accessor");
}
function rawArchiveID(id,previous,token){
    if(typeof id!=="string"||!id||id.includes("/")||!id.isWellFormed())bad("raw archive entry order or ID");
    if(previous!==null){assemblyCharge(token,"bytes",Buffer.byteLength(previous,"utf8")+Buffer.byteLength(id,"utf8"));
        if(compareNames(previous,id)>=0)bad("raw archive entry order or ID");}
}
function rawArchiveTyped(node,token){
    const decoded=value(node),tree=encodedValue(decoded,0,{nodes:0},token),a=rawArchiveJSONMetrics(tree,token),b=rawArchiveJSONMetrics(node,token);
    assemblyCharge(token,"bytes",a.length+b.length);
    const canonical=JSON.stringify(tree),original=JSON.stringify(node);
    if(canonical!==original)bad("raw archive typed encoding");
    return decoded;
}
function rawArchiveBase64(text,maximum,token){
    if(typeof text!=="string"||!text.length||text.length%4||! /^[A-Za-z0-9+/]*={0,2}$/.test(text))bad("raw archive base64");
    const alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    if((text.endsWith("==")&&(alphabet.indexOf(text.at(-3))&15))||
       (!text.endsWith("==")&&text.endsWith("=")&&(alphabet.indexOf(text.at(-2))&3)))bad("raw archive base64");
    const length=text.length/4*3-(text.endsWith("==")?2:text.endsWith("=")?1:0);
    if(length<1||length>maximum)bad("raw archive payload size");
    assemblyCharge(token,"bytes",length);
    const bytes=Buffer.from(text,"base64");
    assemblyCharge(token); // Preserve sticky/deadline checks after decoding.
    // Alphabet, padding and zero pad bits uniquely determine canonical base64.
    if(bytes.length!==length)bad("raw archive base64");
    return bytes;
}
// Resource oracle only: it emits no JSON/bytes and changes no value semantics.
// Native candidateFrameText remains the only frame serializer.
function rawArchiveJSONMetrics(input,token){
    let nodes=0;const active=new WeakSet(),maximum=LIMITS.frameBytes;
    const bounded=length=>{if(length>maximum)bad("frame size");return length;};
    const stringLength=text=>{
        let length=2;
        for(let i=0;i<text.length;i++){
            if((i&1023)===0)assemblyCharge(token);
            const code=text.charCodeAt(i);
            if(code===34||code===92)length+=2;
            else if(code<32)length+=(code===8||code===9||code===10||code===12||code===13)?2:6;
            else if(code<128)length++;
            else if(code<2048)length+=2;
            else if(code>=55296&&code<=56319){const next=text.charCodeAt(i+1);
                if(next>=56320&&next<=57343){length+=4;i++;}else length+=6;
            }else length+=code>=56320&&code<=57343?6:3;
            bounded(length);
        }
        return length;
    };
    const visit=(row,depth)=>{
        assemblyCharge(token,"nodes",1);nodes++;
        if(nodes>LIMITS.nodes||depth>LIMITS.depth*3+8)bad("parsed node or depth limit");
        if(row===null)return 4;
        if(typeof row==="string")return stringLength(row);
        if(typeof row==="boolean")return row?4:5;
        if(typeof row==="number"&&Number.isFinite(row)){
            // Native finite JSON-number spelling is at most24 ASCII bytes.
            admitRecoveryAuditAssemblyBytes(token,24);const text=String(row);assemblyCharge(token,"bytes",text.length);return text.length;
        }
        if(!row||typeof row!=="object"||active.has(row)||
           (!Array.isArray(row)&&![Object.prototype,null].includes(Object.getPrototypeOf(row))))bad("raw archive JSON resource shape");
        active.add(row);let length=2;
        const array=Array.isArray(row),keys=array?null:Object.keys(row);
        if(array){let seen=0;for(const key in row){const index=Number(key);
            if(!Object.hasOwn(row,key)||!Number.isSafeInteger(index)||index<0||index>=row.length||String(index)!==key)bad("raw archive array shape");
            seen++;if((seen&1023)===0)assemblyCharge(token);}
            if(seen!==row.length)bad("raw archive array shape");}
        for(let i=0;i<(array?row.length:keys.length);i++){
            const key=array?String(i):keys[i],descriptor=Object.getOwnPropertyDescriptor(row,key);
            if(!descriptor||!Object.hasOwn(descriptor,"value"))bad("raw archive accessor");
            if(i)length++;
            if(!Array.isArray(row))length+=stringLength(key)+1;
            length+=visit(descriptor.value,depth+1);bounded(length);
        }
        active.delete(row);return length;
    };
    return {length:visit(input,0),nodes};
}
function rawArchiveTypedEncode(row,token){
    const active=new WeakSet();
    const check=(value,depth)=>{
        assemblyCharge(token,"nodes",1);if(depth>LIMITS.depth)bad("typed value or resource limit");
        if(!value||typeof value!=="object")return;
        if(active.has(value)||Buffer.isBuffer(value))bad("raw archive data cycle or shape");
        active.add(value);
        let keys;
        if(Array.isArray(value)){
            if(Object.getPrototypeOf(value)!==Array.prototype||value.length>LIMITS.nodes)bad("raw archive array shape");
            keys=Reflect.ownKeys(value);
            if(keys.length!==value.length+1)bad("raw archive array shape");
            for(const key of keys){
                const descriptor=Object.getOwnPropertyDescriptor(value,key);
                if(typeof key!=="string"||!descriptor)bad("raw archive array shape");
                if(!Object.hasOwn(descriptor,"value"))bad("raw archive accessor");
                if(key==="length")continue;
                const index=Number(key);
                if(!Number.isSafeInteger(index)||index<0||index>=value.length||String(index)!==key)bad("raw archive array shape");
            }
            keys=keys.filter(key=>key!=="length");
        }else keys=Object.keys(value);
        for(const key of keys){const descriptor=Object.getOwnPropertyDescriptor(value,key);
            if(!descriptor||!Object.hasOwn(descriptor,"value"))bad("raw archive accessor");check(descriptor.value,depth+1);}
        // Do not execute a caller getter while the original typed Owner tests
        // its Timestamp interface. Real Timestamp prototype methods are kept.
        for(let proto=value;proto;proto=Object.getPrototypeOf(proto)){
            const descriptor=Object.getOwnPropertyDescriptor(proto,"toMillis");if(descriptor){if(!Object.hasOwn(descriptor,"value"))bad("raw archive accessor");break;}}
        active.delete(value);
    };
    check(row,0);return encodedValue(row,0,{nodes:0},token);
}
function encodeRawRecoveryArchive(material,token){
    rawArchiveBudget(token);assemblyCharge(token,"passes",1);
    exact(material,["binding","run","inventoryState","inventoryPages","rawState","rawReceipts","rawChunks"]);
    rawArchiveObject(material);rawArchiveObject(material.binding);
    exact(material.binding,["ownerUid","auditId","epoch","sourceRevision","inventoryStateSha256"]);
    const plan=[];let size=MAGIC.length,payloadByteLength=0,base64Work=0,jsonWork=0,idWork=0,outerNodes=0;
    const add=(frame,payloadBytes)=>{
        const metric=rawArchiveJSONMetrics(frame,token),base64Length=payloadBytes?4*Math.ceil(payloadBytes.length/3):0,length=metric.length+base64Length;
        if(length>LIMITS.frameBytes)bad("frame size");
        if(size+length+4>LIMITS.bytes||plan.length>=LIMITS.frames)bad("bytes or frame limit");
        if((outerNodes+=metric.nodes)>LIMITS.nodes)bad("parsed node or depth limit");
        plan.push({frame,payloadBytes,length});size+=length+4;jsonWork+=length;base64Work+=base64Length;
    };
    add({type:"header",schemaVersion:3,kind:"canonical-recovery-raw-archive",binding:rawArchiveTypedEncode(material.binding,token)});
    for(const name of RAW_CONTROL_NAMES){rawArchiveObject(material[name]);add({type:"control",name,data:rawArchiveTypedEncode(material[name],token)});}
    for(const [key,type,maximum,leafMaximum] of RAW_GROUPS){
        const entries=material[key];if(!Array.isArray(entries)||entries.length>maximum)bad("raw archive entry count");let previous=null;
        for(const entry of entries){
            assemblyCharge(token,"operations",1);rawArchiveObject(entry);exact(entry,["id","row"]);rawArchiveID(entry.id,null,token);
            if(previous!==null)idWork+=Buffer.byteLength(previous,"utf8")+Buffer.byteLength(entry.id,"utf8");previous=entry.id;
            rawArchiveObject(entry.row);
            if(!leafMaximum){add({type,id:entry.id,data:rawArchiveTypedEncode(entry.row,token)});continue;}
            const {payloadBytes,...metadata}=entry.row;
            if(!Buffer.isBuffer(payloadBytes)||!payloadBytes.length||payloadBytes.length>leafMaximum)bad("raw archive payload size");
            payloadByteLength+=payloadBytes.length;
            add({type,id:entry.id,metadata:rawArchiveTypedEncode(metadata,token),payloadBase64:"",sha256:"0".repeat(64)},payloadBytes);
        }
    }
    add({type:"footer",frameCount:plan.length+1,inventoryPageCount:material.inventoryPages.length,
        receiptCount:material.rawReceipts.length,chunkCount:material.rawChunks.length,payloadByteLength,framesSha256:"0".repeat(64)});
    // All frame/base64 lengths and the outer parsed-node count are known before
    // any JSON/base64/Buffer output allocation. Admission cannot spend raw reservations.
    admitRecoveryAuditAssemblyBytes(token,base64Work+jsonWork+size+4+idWork);
    for(const [key] of RAW_GROUPS){let previous=null;for(const entry of material[key]){rawArchiveID(entry.id,previous,token);previous=entry.id;}}
    assemblyCharge(token,"bytes",4);const prefix=Buffer.alloc(4),hash=createHash("sha256").update(MAGIC),frames=[];
    for(let i=0;i<plan.length;i++){
        assemblyCharge(token,"operations",1);const {frame,payloadBytes,length}=plan[i];
        if(payloadBytes){assemblyCharge(token,"bytes",4*Math.ceil(payloadBytes.length/3));frame.payloadBase64=payloadBytes.toString("base64");
            frame.sha256=createHash("sha256").update(payloadBytes).digest("hex");}
        if(i===plan.length-1)frame.framesSha256=hash.digest("hex");
        assemblyCharge(token,"bytes",length);const encoded=candidateFrameText(frame,token);
        if(encoded.length!==length)bad("raw archive resource length differs");frames.push(encoded);
        if(i<plan.length-1){prefix.writeUInt32BE(length);hash.update(prefix).update(encoded.text,"utf8");}
    }
    assemblyCharge(token,"bytes",size);const bytes=Buffer.alloc(size);MAGIC.copy(bytes);writeCandidateFrames(bytes,MAGIC.length,frames,token);return bytes;
}
function decodeRawRecoveryArchive(input,token,expectedSha256){
    rawArchiveBudget(token);assemblyCharge(token,"passes",1);
    if(expectedSha256!==undefined&&(typeof expectedSha256!=="string"||expectedSha256.length!==64||!/^[a-f0-9]{64}$/.test(expectedSha256)))
        bad("raw archive expected hash");
    const {frames,bytes}=readRecoveryFrames(input,token,true,expectedSha256);
    if(frames.length<5)bad("raw archive header/footer");
    const header=frames[0],footer=frames.at(-1);
    if(header.type!=="header"||header.schemaVersion!==3||header.kind!=="canonical-recovery-raw-archive")bad("raw archive version");
    if(footer.type!=="footer"||footer.frameCount!==frames.length)bad("raw archive footer");
    const binding=rawArchiveTyped(header.binding,token);rawArchiveObject(binding);exact(binding,["ownerUid","auditId","epoch","sourceRevision","inventoryStateSha256"]);
    const material={binding};let index=1,payloadByteLength=0;
    for(const name of RAW_CONTROL_NAMES){const frame=frames[index++];
        if(frame?.type!=="control"||frame.name!==name)bad("raw archive control order");material[name]=rawArchiveTyped(frame.data,token);rawArchiveObject(material[name]);}
    for(const [key,type,maximum,leafMaximum] of RAW_GROUPS){
        const entries=[];let previous=null;
        while(index<frames.length-1&&frames[index].type===type){
            assemblyCharge(token,"operations",1);const frame=frames[index++];if(entries.length>=maximum)bad("raw archive entry count");
            rawArchiveID(frame.id,previous,token);previous=frame.id;let row;
            if(leafMaximum){
                const metadata=rawArchiveTyped(frame.metadata,token);rawArchiveObject(metadata);
                if(Object.hasOwn(metadata,"payloadBytes"))bad("raw archive duplicate payload");
                const payloadBytes=rawArchiveBase64(frame.payloadBase64,leafMaximum,token);
                if(typeof frame.sha256!=="string"||! /^[a-f0-9]{64}$/.test(frame.sha256)||createHash("sha256").update(payloadBytes).digest("hex")!==frame.sha256)bad("raw archive payload hash");
                payloadByteLength+=payloadBytes.length;row={...metadata,payloadBytes};
            }else{row=rawArchiveTyped(frame.data,token);rawArchiveObject(row);}
            entries.push({id:frame.id,row});
        }
        material[key]=entries;
    }
    if(index!==frames.length-1||footer.inventoryPageCount!==material.inventoryPages.length||footer.receiptCount!==material.rawReceipts.length||
       footer.chunkCount!==material.rawChunks.length||footer.payloadByteLength!==payloadByteLength)bad("raw archive order or counts");
    let footerOffset=MAGIC.length;for(let i=0;i<frames.length-1;i++){assemblyCharge(token);footerOffset+=4+bytes.readUInt32BE(footerOffset);}
    if(typeof footer.framesSha256!=="string"||! /^[a-f0-9]{64}$/.test(footer.framesSha256)||
       createHash("sha256").update(bytes.subarray(0,footerOffset)).digest("hex")!==footer.framesSha256)bad("raw archive frames hash");
    return material;
}
function readRecoveryFrames(bytes,assemblyBudget,rawArchive=false,expectedSha256){
    if(!Buffer.isBuffer(bytes)||bytes.length>LIMITS.bytes||!bytes.subarray(0,MAGIC.length).equals(MAGIC))bad("bytes or magic");
    assemblyDecodeBytes(assemblyBudget,bytes.length,false);
    // Copy before parsing: a caller cannot mutate the verified byte array later.
    if(rawArchive)assemblyCharge(assemblyBudget,"bytes",bytes.length);
    bytes=Buffer.from(bytes);
    if(expectedSha256!==undefined){
        assemblyCharge(assemblyBudget,"bytes",bytes.length);
        if(createHash("sha256").update(bytes).digest("hex")!==expectedSha256)bad("raw archive expected hash differs");
    }
    const frames=[];let offset=MAGIC.length,nodeCount=0;
    while(offset<bytes.length){
        if(frames.length>=LIMITS.frames||offset+4>bytes.length)bad("frame boundary");
        const size=bytes.readUInt32BE(offset);offset+=4;
        if(!size||size>LIMITS.frameBytes||offset+size>bytes.length)bad("frame size");
        if(rawArchive)assemblyCharge(assemblyBudget,"operations",1);
        const raw=bytes.subarray(offset,offset+size),text=raw.toString("utf8");offset+=size;
        let frame;try{frame=JSON.parse(text);}catch(_){bad("frame JSON");}
        const shapes=rawArchive?RAW_ARCHIVE_SHAPES:{header:frame?.schemaVersion===2?["type","schemaVersion","ownerUid","expectedRevision","auditControl"]:
            ["type","schemaVersion","ownerUid","expectedRevision"],
            footer:["type","frameCount","documentCount","absenceCount"],document:["type","path","data"],
            absence:["type","path"],namespace:["type","path","ids","terminalEmpty"]};
        if(rawArchive)charge(frame,0);
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
        if(!rawArchive)charge(frame,0);
        // Canonical JSON also rejects duplicate JSON keys and malformed UTF-8.
        if(rawArchive){
            const metric=rawArchiveJSONMetrics(frame,assemblyBudget),length=metric.length;
            assemblyCharge(assemblyBudget,"bytes",length);
            const canonical=JSON.stringify(frame);
            if(canonical!==text)bad("noncanonical JSON");
            // Valid UTF-8 has one byte encoding; canonical===text above already
            // proves the decoded spelling without another encoded Buffer.
            // Node22: https://github.com/nodejs/node/blob/v22.x/doc/api/buffer.md#bufferisutf8input
            assemblyCharge(assemblyBudget);
            const validUtf8=isUtf8(raw);
            assemblyCharge(assemblyBudget);
            if(!validUtf8)bad("noncanonical JSON");
        }else if(JSON.stringify(frame)!==text||!Buffer.from(text).equals(raw))bad("noncanonical JSON");
        frames.push(frame);
    }
    return {frames,bytes};
}
function decodeRecoveryAuditArtifact(input,{uid,expectedRevision,db},assemblyBudget){
    const {frames,bytes}=readRecoveryFrames(input,assemblyBudget);
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
    queries.push(...recoveryAuditQueryShapes(root));
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
    chargeRecoveryAuditAssembly:assemblyCharge,admitRecoveryAuditAssemblyBytes,recoveryAuditQueryShapes,
    encodeRawRecoveryArchive,decodeRawRecoveryArchive,encodeRecoveryAuditCandidate,prepareRecoveryAuditCandidateEncoding,decodeRecoveryAuditArtifact,drainAndCloseRecoveryAuditLookups,recoveryAuditNamespaces,encodeInventoryPayload,decodeInventoryPayload,
    inventoryDocumentMetadata,INVENTORY_LIMITS,encodeProofPayload,decodeProofPayload,indexRawProofPayload,decodeIndexedRawProofRow,PATROL_PROOF_LIMITS};
