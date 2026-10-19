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
    static fromMillis(millis){return new Timestamp(millis);}
}
class HttpsError extends Error{
    constructor(code,message){super(message);this.code=code;}
}
function copy(value){
    if(value instanceof Timestamp)return value;
    if(Array.isArray(value))return value.map(copy);
    if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,row])=>[key,copy(row)]));
    return value;
}
function storeHarness(){
    const uid='account-mode-time-uid';let clock=Date.parse('2026-10-19T00:00:00Z');
    const save=`users/${uid}/saves/current`,root=`serverUsers/${uid}`;
    const data=new Map([[save,copy(createEmptyEnvelope(uid,Timestamp.fromMillis(clock)))]]);
    const field=(row,key)=>key.split('.').reduce((value,part)=>value?.[part],row);
    const ref=path=>({path,id:path.split('/').at(-1),collection:name=>collection(`${path}/${name}`)});
    const collection=(path,filters=[],maximum=Infinity,order=null)=>({path,query:true,
        doc:id=>ref(`${path}/${id}`),limit:max=>collection(path,filters,max,order),
        where:(key,operator,value)=>{assert.equal(operator,'==');return collection(path,[...filters,[key,value]],maximum,order);},
        orderBy:(key,direction)=>collection(path,filters,maximum,[key,direction]),filters,maximum,order});
    const db={collection,doc:ref};let writes=0,commits=0,abort=false;
    let activeSession='a'.repeat(32);
    const request=()=>({auth:{uid},data:{uid,session:{sessionId:activeSession}}});
    async function runProtected(input,operation){
        if(input?.auth?.uid!==uid||input?.data?.uid!==uid||input?.data?.session?.sessionId!==activeSession){
            throw new HttpsError('permission-denied','SESSION_REVOKED_OR_UID_MISMATCH');
        }
        const pending=[];let startedWrites=false;
        const snapshot=(path,value)=>({ref:ref(path),id:path.split('/').at(-1),exists:value!==undefined,
            data:()=>copy(value),get:key=>copy(field(value,key))});
        const tx={
            async get(reference){
                assert.equal(startedWrites,false,'Firestore transactions must finish every read before the first write');
                if(reference.query){
                    const entries=[...data].filter(([key,value])=>key.startsWith(reference.path+'/')&&
                        !key.slice(reference.path.length+1).includes('/')&&
                        reference.filters.every(([name,expected])=>field(value,name)===expected));
                    if(reference.order){const [key,direction]=reference.order;
                        entries.sort((a,b)=>(field(a[1],key)-field(b[1],key))*(direction==='desc'?-1:1));}
                    const docs=entries.slice(0,reference.maximum).map(([key,value])=>snapshot(key,value));
                    return {docs,size:docs.length,empty:docs.length===0};
                }
                return snapshot(reference.path,data.get(reference.path));
            },
            create(reference,value){startedWrites=true;pending.push(['create',reference.path,copy(value)]);},
            update(reference,value){startedWrites=true;pending.push(['update',reference.path,copy(value)]);},
            set(reference,value,options){startedWrites=true;pending.push([options?.merge?'update':'set',reference.path,copy(value)]);},
            delete(reference){startedWrites=true;pending.push(['delete',reference.path]);}
        };
        const result=await operation(tx,{uid,sessionId:activeSession});
        if(abort){abort=false;throw Error('simulated rollback after staged writes');}
        const next=new Map(data);
        for(const [kind,path,value] of pending){
            if(kind==='create'){assert.equal(next.has(path),false,`duplicate document ${path}`);next.set(path,value);}
            else if(kind==='update'){assert.equal(next.has(path),true,`missing document ${path}`);next.set(path,{...next.get(path),...value});}
            else if(kind==='set')next.set(path,value);
            else next.delete(path);
        }
        if(pending.length){data.clear();for(const entry of next)data.set(...entry);writes+=pending.length;commits++;}
        return result;
    }
    db.runTransaction=operation=>runProtected(request(),operation);
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
