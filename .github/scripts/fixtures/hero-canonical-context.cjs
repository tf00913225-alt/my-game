const assert=require('node:assert/strict');
const {createHeroGrowth}=require('../../../functions/src/hero-growth');
const {makeInitialCharacterSources}=require('../../../functions/src/initial-character-sources');
const {assembleCanonicalSnapshot}=require('../../../functions/src/canonical-snapshot');
const {createRecoveryArchive}=require('../../../functions/src/canonical-recovery-archive');
const heroId='divineDogHongbao',uid='growth-fixture',root='serverUsers/'+uid,env='users/'+uid+'/saves/current';
function fixture({fragments=500,pills=2,owned=false}={}){
    const records=makeInitialCharacterSources(uid,2,"fixture-initial-0001",{
        displayName:"測試角色",element:"fire",gender:"female",attributes:{attack:3,vitality:2,
        energy:1,intelligence:2,defensePoints:1,agility:1}},{recordedAt:1700000000000});
    const account=records.progress.playableState.heroAccount;
    account.heroes[heroId].specificFragments=fragments;account.heroes[heroId].unlocked=owned;
    if(pills)records.inventory.push({schemaVersion:1,ownerUid:uid,serverRevision:2,
        provenance:"server-created",ownedItemId:"fixture-marrow-0001",location:"bag",
        state:{id:"heroMarrowPill",type:"material",count:pills}});
    const bundle=assembleCanonicalSnapshot(uid,2,records);
    const data=new Map([[env,{ownerUid:uid,serverRevision:2,authoritativeStateReady:false}]]);
    for(const key of ["account","economy","progress","relicLoadout","claimCheckpoint"]){
        data.set(`${root}/${key==="claimCheckpoint"?"claimCheckpoints":key}/current`,
            {...records[key],...(key==="account"?{snapshotSha256:bundle.sha256}:{})});
    }
    for(const key of ["characters","inventory"]){for(const row of records[key]){
        data.set(`${root}/${key}/${row.characterId||row.ownedItemId}`,row);
    }}
    data.set(`${root}/playableSnapshots/2`,bundle);
    data.set(`${root}/recoveryArchives/2`,createRecoveryArchive(uid,2,records,bundle));
    const ref=path=>({path,id:path.split("/").at(-1),collection:name=>collection(`${path}/${name}`)});
    const collection=(path,filter=null,max=Infinity,sort=null)=>({path,filter,max,sort,query:true,doc:id=>ref(`${path}/${id}`),
        where:(key,op,value)=>{assert.equal(op,"==");return collection(path,{key,value},max,sort);},
        orderBy:(key,direction)=>collection(path,filter,max,{key,direction}),
        limit:count=>collection(path,filter,count,sort)});
    let active=true,failWrites=false,tail=Promise.resolve();
    class HttpsError extends Error{constructor(code,message){super(message);this.code=code;}}
    const deps={db:{collection},FieldValue:{serverTimestamp:()=>({seconds:1})},HttpsError,
        seed:()=>123,inspectExistingEnvelope:value=>({kind:"current",data:value,serverRevision:value.serverRevision}),
        nextRevision:envelope=>envelope.serverRevision+1,
        acquisition:{readInTransaction:async()=>({entitlements:{}})},
        runProtected:(request,operation)=>{
            const run=tail.then(async()=>{
                if(!active||request.data.uid!==uid||request.data.session!=="active"){throw new HttpsError("permission-denied","SESSION_INVALID");}
                const staged=new Map(structuredClone([...data]));let writing=false;
                const snap=(path,value)=>({id:path.split("/").at(-1),ref:ref(path),exists:value!==undefined,
                    data:()=>value,get:key=>key.split(".").reduce((row,part)=>row?.[part],value)});
                const check=()=>{writing=true;if(failWrites)throw Error("transaction interrupted");};
                const tx={get:async r=>{assert.equal(writing,false);return r.query?{
                    docs:[...staged].filter(([p])=>p.startsWith(r.path+"/")&&p.split("/").length===r.path.split("/").length+1)
                        .filter(([,v])=>!r.filter||v[r.filter.key]===r.filter.value).sort((a,b)=>r.sort?(a[1][r.sort.key]-b[1][r.sort.key])*(r.sort.direction==="desc"?-1:1):0).slice(0,r.max)
                        .map(([p,v])=>snap(p,v)),get size(){return this.docs.length;}}:snap(r.path,staged.get(r.path));},
                    update:(r,v)=>{check();assert.ok(staged.has(r.path));staged.set(r.path,{...staged.get(r.path),...v});},
                    create:(r,v)=>{check();assert.equal(staged.has(r.path),false);staged.set(r.path,v);},
                    set:(r,v)=>{check();staged.set(r.path,v);},
                    delete:r=>{check();staged.delete(r.path);}};
                const value=await operation(tx,{uid,sessionId:"A".repeat(32)});
                data.clear();for(const entry of staged)data.set(...entry);return value;
            });tail=run.catch(()=>null);return run;
        }};
    const writer=createHeroGrowth(deps);
    const request=extra=>({data:{uid,session:"active",...extra}});
    const intent=(action,operationId=`growth-${action}-000001`,expectedRevision=data.get(env).serverRevision)=>
        request({action,operationId,heroId,expectedRevision});
    return {data,writer,request,intent,deps,revoke:()=>{active=false;},interrupt:()=>{failWrites=true;}};
}
module.exports={fixture,uid,heroId,root,env};
