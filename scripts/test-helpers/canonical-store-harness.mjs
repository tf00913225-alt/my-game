import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {createCanonicalSourceWriter}=require('../../functions/src/canonical-source-writer.js');
const {createEmptyEnvelope,inspectExistingEnvelope,nextRevision}=require('../../functions/src/cloud-save-envelope.js');

const selection={displayName:'時間測試',element:'fire',gender:'female',
    attributes:{attack:3,vitality:2,energy:1,intelligence:2,defensePoints:1,agility:1}};
class Timestamp{
    constructor(millis){this.millis=millis;Object.freeze(this);}
    toMillis(){return this.millis;}
    get seconds(){return Math.floor(this.millis/1000);}
    get nanoseconds(){return Math.round((this.millis-this.seconds*1000)*1000000);}
    static fromMillis(millis){return new Timestamp(millis);}
}
class HttpsError extends Error{
    constructor(code,message){super(message);this.code=code;}
}
function copy(value){
    if(value instanceof Timestamp)return value;
    if(Buffer.isBuffer(value))return Buffer.from(value);
    if(Array.isArray(value))return value.map(copy);
    if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,row])=>[key,copy(row)]));
    return value;
}
function storeHarness({optimisticTransactions=false}={}){
    const uid='account-mode-time-uid';let clock=Date.parse('2026-10-19T00:00:00Z');
    const save=`users/${uid}/saves/current`,root=`serverUsers/${uid}`;
    const data=new Map(),versions=new Map();let version=0;
    data.set=(key,value)=>{versions.set(key,Object.freeze({seconds:Math.floor(clock/1000),nanoseconds:++version}));return Map.prototype.set.call(data,key,value);};
    data.delete=key=>{versions.delete(key);return Map.prototype.delete.call(data,key);};
    data.clear=()=>{versions.clear();Map.prototype.clear.call(data);};
    data.set(save,copy(createEmptyEnvelope(uid,Timestamp.fromMillis(clock))));
    const field=(row,key)=>key.split('.').reduce((value,part)=>value?.[part],row);
    const ref=path=>({path,id:path.split('/').at(-1),collection:name=>collection(`${path}/${name}`)});
    const collection=(path,filters=[],maximum=Infinity,order=null,after=null)=>({path,query:true,
        doc:id=>ref(`${path}/${id}`),limit:max=>collection(path,filters,max,order,after),
        where:(key,operator,value)=>{assert.equal(operator,'==');return collection(path,[...filters,[key,value]],maximum,order,after);},
        orderBy:(key,direction)=>collection(path,filters,maximum,[key,direction],after),
        startAfter:reference=>{assert.equal(order?.[0],'__name__');return collection(path,filters,maximum,order,reference.path);},
        filters,maximum,order,after});
    const db={collection,doc:ref};let writes=0,commits=0,abort=false;
    let activeSession='a'.repeat(32);
    const request=()=>({auth:{uid},data:{uid,session:{sessionId:activeSession}}});
    async function runProtected(input,operation){
        if(input?.auth?.uid!==uid||input?.data?.uid!==uid||input?.data?.session?.sessionId!==activeSession){
            throw new HttpsError('permission-denied','SESSION_REVOKED_OR_UID_MISMATCH');
        }
        const pending=[],readVersions=new Map(),readRanges=new Map();let startedWrites=false;
        const rangeVersion=path=>JSON.stringify([...versions].filter(([key])=>key.startsWith(path+'/')&&!key.slice(path.length+1).includes('/'))
            .map(([key,value])=>[key,value]).sort((a,b)=>Buffer.compare(Buffer.from(a[0]),Buffer.from(b[0]))));
        const snapshot=(path,value)=>({ref:ref(path),id:path.split('/').at(-1),exists:value!==undefined,updateTime:versions.get(path),
            data:()=>copy(value),get:key=>copy(field(value,key))});
        const tx={
            async get(reference){
                assert.equal(startedWrites,false,'Firestore transactions must finish every read before the first write');
                if(reference.query){
                    if(optimisticTransactions)readRanges.set(reference.path,rangeVersion(reference.path));
                    const entries=[...data].filter(([key,value])=>key.startsWith(reference.path+'/')&&
                        !key.slice(reference.path.length+1).includes('/')&&
                        (reference.after===null||Buffer.compare(Buffer.from(key),Buffer.from(reference.after))>0)&&
                        reference.filters.every(([name,expected])=>field(value,name)===expected));
                    if(reference.order){const [key,direction]=reference.order;
                        entries.sort((a,b)=>(key==='__name__'?Buffer.compare(Buffer.from(a[0]),Buffer.from(b[0])):
                            field(a[1],key)-field(b[1],key))*(direction==='desc'?-1:1));}
                    const docs=entries.slice(0,reference.maximum).map(([key,value])=>snapshot(key,value));
                    return {docs,size:docs.length,empty:docs.length===0};
                }
                if(optimisticTransactions)readVersions.set(reference.path,versions.get(reference.path));
                return snapshot(reference.path,data.get(reference.path));
            },
            create(reference,value){startedWrites=true;pending.push(['create',reference.path,copy(value)]);},
            update(reference,value){startedWrites=true;pending.push(['update',reference.path,copy(value)]);},
            set(reference,value,options){startedWrites=true;pending.push([options?.merge?'update':'set',reference.path,copy(value)]);},
            delete(reference){startedWrites=true;pending.push(['delete',reference.path]);}
        };
        const result=await operation(tx,{uid,sessionId:activeSession});
        if(abort){abort=false;throw Error('simulated rollback after staged writes');}
        if(optimisticTransactions&&pending.length&&([...readVersions].some(([path,version])=>versions.get(path)!==version)||
            [...readRanges].some(([path,version])=>rangeVersion(path)!==version))){
            throw Object.assign(new Error('optimistic transaction conflict'),{code:10});
        }
        const next=new Map(data);
        for(const [kind,path,value] of pending){
            if(kind==='create'){assert.equal(next.has(path),false,`duplicate document ${path}`);next.set(path,value);}
            else if(kind==='update'){assert.equal(next.has(path),true,`missing document ${path}`);next.set(path,{...next.get(path),...value});}
            else if(kind==='set')next.set(path,value);
            else next.delete(path);
        }
        if(pending.length){
            for(const key of [...data.keys()])if(!next.has(key))data.delete(key);
            for(const [key,value] of next)if(!data.has(key)||data.get(key)!==value)data.set(key,value);
            writes+=pending.length;commits++;
        }
        return result;
    }
    db.runTransaction=async operation=>{
        for(let attempt=0;;attempt++){
            try{return await runProtected(request(),operation);}
            catch(error){if(!optimisticTransactions||error.code!==10||attempt>=4)throw error;}
        }
    };
    const dependencies={db,Timestamp,FieldValue:{serverTimestamp:()=>Timestamp.fromMillis(clock)},
        HttpsError,inspectExistingEnvelope,nextRevision,runProtected,now:()=>clock};
    const initial=createCanonicalSourceWriter(dependencies);
    return {uid,save,root,data,dependencies,initial,request,
        setClock:value=>{clock=value;},advance:delta=>{clock+=delta;},
        setSession:value=>{activeSession=value;},abortNext:()=>{abort=true;},
        get clock(){return clock;},get writes(){return writes;},get commits(){return commits;},
        get revision(){return data.get(save).serverRevision;}};
}

export {storeHarness,selection,Timestamp,HttpsError,copy};
