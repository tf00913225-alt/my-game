"use strict";

const https=require("node:https");
const {createHash,randomBytes}=require("node:crypto");
const BUCKET="four-symbols-jianghu-recovery-private";
const MAX_BYTES=32*1024*1024,JSON_BYTES=64*1024,DEADLINE_MS=20000;
const GENERATION=/^[1-9][0-9]{0,19}(?![\s\S])/;
const NAME=/^private\/recovery-candidates\/v1\/([^/]+)\/([A-Za-z0-9_-]{16,64})\/([1-9][0-9]*)\/([A-Za-z0-9_-]{16,64})\.csra(?![\s\S])/;
const error=code=>Object.assign(new Error("Private candidate storage: "+code),{code});
function exact(value,keys){
    if(!value||typeof value!=="object"||Array.isArray(value)||
       Object.keys(value).length!==keys.length||keys.some(key=>!Object.hasOwn(value,key)))throw error("INVALID_ARGUMENT");
}
function identity(input,keys){
    exact(input,keys);
    const match=typeof input.objectName==="string"&&NAME.exec(input.objectName);
    if(input.bucketName!==BUCKET||!match||match[1].length>128||
       !Number.isSafeInteger(Number(match[3])))throw error("INVALID_ARGUMENT");
    try{encodeURIComponent(input.objectName);}catch(_){throw error("INVALID_ARGUMENT");}
    return input.objectName;
}
function metadata(value,name,generation){
    if(!value||typeof value!=="object"||Array.isArray(value)||value.bucket!==BUCKET||value.name!==name||
       typeof value.generation!=="string"||!GENERATION.test(value.generation)||
       (generation!==undefined&&value.generation!==generation)||typeof value.size!=="string"||
       !/^[1-9][0-9]*(?![\s\S])/.test(value.size)||value.size.length>8||BigInt(value.size)>BigInt(MAX_BYTES)||
       (value.contentEncoding!==undefined&&value.contentEncoding!=="identity")||
       typeof value.md5Hash!=="string"||!/^[A-Za-z0-9+/]{22}==(?![\s\S])/.test(value.md5Hash)||
       Buffer.from(value.md5Hash,"base64").toString("base64")!==value.md5Hash)throw error("DATA_LOSS");
    return {public:{bucketName:BUCKET,objectName:name,generation:value.generation,size:Number(value.size)},md5:value.md5Hash};
}
function credential(){
    const {getApp,applicationDefault}=require("firebase-admin/app");
    return getApp().options.credential||applicationDefault();
}
// One wall deadline spans credential acquisition and every response body. No
// provider error, request object, credential or raw response escapes this IO.
function operation(action){
    return new Promise((resolve,reject)=>{
        let finished=false,request,response,writeAttempted=false;
        const stop=(failure,value)=>{
            if(finished)return;finished=true;clearTimeout(timer);
            if(failure){request?.destroy();response?.destroy();reject(failure);}else resolve(value);
        };
        const timer=setTimeout(()=>stop(error(writeAttempted?"UNKNOWN_COMMIT":"DEADLINE_EXCEEDED")),DEADLINE_MS);
        const transportFailure=()=>error(writeAttempted?"UNKNOWN_COMMIT":"UNAVAILABLE");
        const call=(method,path,{body,limit=JSON_BYTES,expectedSize,expectedMd5,write=false,missing=false}={})=>new Promise((done,fail)=>{
            if(finished){fail(error("DEADLINE_EXCEEDED"));return;}
            let complete=false;
            const end=(failure,value)=>{if(complete)return;complete=true;failure?fail(failure):done(value);};
            try{
                const headers={Authorization:"Bearer "+token,"Accept-Encoding":"identity",Accept:"application/json"};
                if(body){headers["Content-Type"]=body.type;headers["Content-Length"]=String(body.length);}
                request=https.request({protocol:"https:",hostname:"storage.googleapis.com",port:443,method,path,headers},res=>{
                    response=res;
                    const status=res.statusCode,encoding=res.headers["content-encoding"];
                    const rejectResponse=code=>{end(error(code));res.destroy();};
                    if(status===401||status===403){rejectResponse(status===401?"UNAUTHENTICATED":"PERMISSION_DENIED");return;}
                    if(encoding!==undefined&&encoding!=="identity"){rejectResponse("DATA_LOSS");return;}
                    if(status===404&&missing){end(null,null);res.destroy();return;}
                    if(write&&status===412){rejectResponse("ALREADY_EXISTS");return;}
                    if(write&&(status===408||status===429||status>=500)){rejectResponse("UNKNOWN_COMMIT");return;}
                    if(!((write&&(status===200||status===201))||(!write&&status===200))){rejectResponse("PROVIDER_REJECTED");return;}
                    const length=res.headers["content-length"];
                    if(length!==undefined&&(typeof length!=="string"||!/^\d+(?![\s\S])/.test(length)||length.length>8||
                       BigInt(length)>BigInt(limit)||(expectedSize!==undefined&&BigInt(length)!==BigInt(expectedSize)))){
                        rejectResponse("RESOURCE_EXHAUSTED");return;
                    }
                    let count=0;const chunks=[],md5=expectedSize===undefined?null:createHash("md5");
                    res.on("data",chunk=>{
                        if(complete||finished)return;
                        if(!Buffer.isBuffer(chunk)||count+chunk.length>limit||
                           (expectedSize!==undefined&&count+chunk.length>expectedSize)){rejectResponse("RESOURCE_EXHAUSTED");return;}
                        count+=chunk.length;chunks.push(chunk);md5?.update(chunk);
                    });
                    res.on("error",()=>end(transportFailure()));
                    res.on("aborted",()=>end(transportFailure()));
                    res.on("end",()=>{
                        if(complete||finished)return;
                        if(!res.complete||(expectedSize!==undefined&&count!==expectedSize)){end(error("DATA_LOSS"));return;}
                        const digest=md5?.digest("base64");
                        if(expectedMd5!==undefined&&digest!==expectedMd5){end(error("DATA_LOSS"));return;}
                        // Size and MD5 both pass before materializing media.
                        end(null,{bytes:Buffer.concat(chunks,count),md5:digest});
                    });
                    res.on("close",()=>{if(!complete)end(transportFailure());});
                });
                request.on("error",()=>end(transportFailure()));
                if(write)writeAttempted=true;
                if(body){request.write(body.prefix);request.write(body.bytes);request.end(body.suffix);}else request.end();
            }catch(_){end(transportFailure());}
        });
        const json=async(method,path,options)=>{
            const result=await call(method,path,options);
            if(result===null)return null;
            try{return JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(result.bytes));}
            catch(_){throw error("DATA_LOSS");}
        };
        let token,authenticated=false;
        Promise.resolve().then(()=>credential().getAccessToken()).then(async value=>{
            if(finished)return;
            if(!value||typeof value.access_token!=="string"||!value.access_token||/[\r\n]/.test(value.access_token))throw error("UNAUTHENTICATED");
            token=value.access_token;
            authenticated=true;
            return action({call,json});
        }).then(value=>{if(!finished)stop(null,value);},failure=>{
            stop(authenticated&&failure&&["ALREADY_EXISTS","UNKNOWN_COMMIT","INVALID_ARGUMENT","DATA_LOSS","RESOURCE_EXHAUSTED",
                "UNAUTHENTICATED","PERMISSION_DENIED","PROVIDER_REJECTED","UNAVAILABLE","DEADLINE_EXCEEDED"].includes(failure.code)?
                error(failure.code):error("UNAUTHENTICATED"));
        });
    });
}
function createRecoveryCandidateStorage(){
    const path=name=>"/storage/v1/b/"+BUCKET+"/o/"+encodeURIComponent(name);
    async function lookupMetadata(input){
        const name=identity(input,["bucketName","objectName"]);
        return operation(async({json})=>{
            const row=await json("GET",path(name),{missing:true});
            return row===null?null:metadata(row,name).public;
        });
    }
    async function createOnly(input){
        const name=identity(input,["bucketName","objectName","bytes","ifGenerationMatch"]);
        if(input.ifGenerationMatch!=="0"||!Buffer.isBuffer(input.bytes)||input.bytes.length<1||input.bytes.length>MAX_BYTES)throw error("INVALID_ARGUMENT");
        const bytes=Buffer.from(input.bytes),md5=createHash("md5").update(bytes).digest("base64");
        let boundary;
        do{boundary="candidate-"+randomBytes(24).toString("hex");}while(bytes.includes(boundary));
        const prefix=Buffer.from("--"+boundary+"\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n"+
            JSON.stringify({name,contentType:"application/octet-stream",cacheControl:"no-store",md5Hash:md5})+
            "\r\n--"+boundary+"\r\nContent-Type: application/octet-stream\r\n\r\n");
        const suffix=Buffer.from("\r\n--"+boundary+"--\r\n");
        return operation(async({json})=>{
            const query=new URLSearchParams({uploadType:"multipart",ifGenerationMatch:"0",name});
            const row=metadata(await json("POST","/upload/storage/v1/b/"+BUCKET+"/o?"+query,
                {write:true,body:{prefix,bytes,suffix,type:"multipart/related; boundary="+boundary,length:prefix.length+bytes.length+suffix.length}}),name);
            if(row.md5!==md5||row.public.size!==bytes.length)throw error("DATA_LOSS");
            return row.public;
        });
    }
    async function readExact(input){
        const name=identity(input,["bucketName","objectName","generation"]);
        if(typeof input.generation!=="string"||!GENERATION.test(input.generation))throw error("INVALID_ARGUMENT");
        const generation=input.generation;
        return operation(async({call,json})=>{
            const query=new URLSearchParams({generation});
            const row=metadata(await json("GET",path(name)+"?"+query),name,generation);
            query.set("alt","media");
            const result=await call("GET",path(name)+"?"+query,{limit:MAX_BYTES,expectedSize:row.public.size,expectedMd5:row.md5});
            if(result.md5!==row.md5)throw error("DATA_LOSS");
            return {metadata:row.public,bytes:result.bytes};
        });
    }
    return Object.freeze({bucketName:BUCKET,lookupMetadata,createOnly,readExact});
}
module.exports={createRecoveryCandidateStorage};
