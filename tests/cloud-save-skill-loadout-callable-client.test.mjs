import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
const intents={mutateCanonicalSkillLoadout:{operationId:'loadout_client_operation01',expectedRevision:4,
 characterId:'stable-primary',action:'equip',skillId:'waterKnife'},readCanonicalSkillLoadout:{expectedRevision:4}};
function backend(){
 const source=read('functions/index.js'),calls=[];
 class HttpsError extends Error{constructor(code,message){super(message);this.code=code;}}
 const owner=method=>async(request,args)=>{
  if(request.auth.uid!==request.data.uid||request.data.session?.valid!==true)throw new HttpsError('permission-denied','session');
  calls.push({method,args:JSON.parse(JSON.stringify(args))});return {authoritativeStateReady:false};
 };
 const context=vm.createContext({exports:{},CALLABLE_OPTIONS:{},onCall:(_options,fn)=>fn,HttpsError,asHttpsError:error=>error,
  canonicalSkillLoadout:{mutateLoadout:owner('mutateLoadout'),readLoadout:owner('readLoadout')},
  verifyGameIdentity:async request=>{if(!request.auth?.uid)throw new HttpsError('unauthenticated','auth');return request;}});
 const start=source.indexOf('function canonicalPatrolIntent('),end=source.indexOf('exports.createAdditionalCanonicalCharacter=',start);
 vm.runInContext(source.slice(start,end),context);
 const from=source.indexOf('exports.mutateCanonicalSkillLoadout='),to=source.indexOf('exports.allocateCanonicalAttributePoint=',from);
 vm.runInContext(source.slice(from,to),context);
 return {api:context.exports,calls};
}
test('actual loadout callable entries enforce exact fields and delegate identity/session protected Owners',async()=>{
 const h=backend();
 for(const [name,intent] of Object.entries(intents)){
  const request={auth:{uid:'a'},data:{uid:'a',session:{valid:true},...intent}};
  await h.api[name](request);
  assert.deepEqual(h.calls.at(-1),{method:name.startsWith('read')?'readLoadout':'mutateLoadout',args:intent});
  for(const key of ['amount','skillLevels','equippedSkills','preferencesVersion','autoConfig','gameSave','win','authoritativeStateReady']){
   const count=h.calls.length;
   await assert.rejects(h.api[name]({...request,data:{...request.data,[key]:true}}),{code:'invalid-argument'});assert.equal(h.calls.length,count);
  }
  for(const key of Object.keys(intent)){const missing={...request.data};delete missing[key];
   await assert.rejects(h.api[name]({...request,data:missing}),{code:'invalid-argument'});}
  await assert.rejects(h.api[name]({...request,auth:null}),{code:'unauthenticated'});
  await assert.rejects(h.api[name]({...request,data:{...request.data,uid:'foreign'}}),{code:'permission-denied'});
  await assert.rejects(h.api[name]({...request,data:{...request.data,session:{valid:false}}}),{code:'permission-denied'});
 }
});
function client(){
 let identity={uid:'a',authTime:10},during=null,lost=false;const calls=[],sessionContext=vm.createContext({});
 vm.runInContext(read('js/firebase/session-client.js').replace(/^export /gm,''),sessionContext);
 const sessions=sessionContext.createGameSessionClient({getIdentity:async()=>identity,call:async(name,payload)=>{
  calls.push({name,payload:JSON.parse(JSON.stringify(payload))});
  if(name==='createGameSession')return {schemaVersion:1,uid:payload.uid,status:'active',sessionId:'s'.repeat(32),credential:'c'.repeat(43)};
  if(name==='protectedTest')return {};
  if(during){const fn=during;during=null;fn();}
  if(lost){lost=false;throw Error('response lost');}
  return {authoritativeStateReady:false};
 }});
 const context=vm.createContext({getFirebaseAuth:()=>({currentUser:identity?{uid:identity.uid}:null}),
  callProtectedFunction:(name,payload,uid)=>sessions.invoke(name,payload,uid),CLOUD_FUNCTIONS_REGION:'test',window:{}});
 vm.runInContext(read('js/firebase/firebase-cloud-save.js').replace(/^import[\s\S]*?;\r?\n/gm,'')
  .replace(/^export \{[^}]*\};\r?\n/gm,'').replace(/^export /gm,''),context);
 return {api:context,calls,sessions,identity:value=>{identity=value;},during:fn=>{during=fn;},lose:()=>{lost=true;}};
}
test('loadout services retain caller intent, never auto-apply/mint/retry and discard UID/session-switched responses',async()=>{
 const h=client();assert.equal(h.calls.length,0);
 for(const [name,intent] of Object.entries(intents)){
  await h.api[name]({...intent,uid:'forged',session:{},amount:999,gameSave:{gold:999}});
  const payload=h.calls.at(-1).payload;assert.equal(payload.uid,'a');assert.equal(payload.session.sessionId,'s'.repeat(32));
  const {uid,session,...actual}=payload;assert.deepEqual(actual,intent);
 }
 const count=h.calls.filter(row=>row.name==='mutateCanonicalSkillLoadout').length;
 h.lose();await assert.rejects(h.api.mutateCanonicalSkillLoadout(intents.mutateCanonicalSkillLoadout),{code:'SESSION_UNAVAILABLE'});
 assert.equal(h.calls.filter(row=>row.name==='mutateCanonicalSkillLoadout').length,count+1);
 await h.api.mutateCanonicalSkillLoadout(intents.mutateCanonicalSkillLoadout);
 assert.deepEqual(h.calls.filter(row=>row.name==='mutateCanonicalSkillLoadout').slice(-2).map(row=>row.payload.operationId),
  [intents.mutateCanonicalSkillLoadout.operationId,intents.mutateCanonicalSkillLoadout.operationId]);
 for(const name of Object.keys(intents))for(const change of [c=>c.identity({uid:'b',authTime:10}),c=>c.identity({uid:'a',authTime:11}),c=>c.sessions.reset()]){
  const c=client();c.during(()=>change(c));await assert.rejects(c.api[name](intents[name]),{code:'ACCOUNT_CHANGED'});
 }
});
test('bootstrap names and isolated browser modules expose only explicit loadout services',()=>{
 const bootstrap=read('js/firebase/firebase-bootstrap.js');
 const exposed=bootstrap.slice(bootstrap.indexOf('const api=Object.freeze({'),bootstrap.indexOf('window.FourSymbolsFirebase=api'));
 for(const name of Object.keys(intents)){
  assert.match(exposed,new RegExp('\\b'+name+'\\b'));
  for(const file of ['.github/scripts/run-boot-architecture-browser-qa.mjs','.github/scripts/run-bottom-nav-runtime-browser-qa.mjs','.github/scripts/runtime-browser-qa-support.mjs'])
   assert.ok(read(file).includes('export async function '+name+'(){throw new Error('));
 }
});
