import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
const specs={
 observeCanonicalAccountMode:['observePresence',{operationId:'patrol-client-operation-0001',expectedRevision:2,expectedSequence:1,intent:'heartbeat',elementBox:'keep'}],
 beginCanonicalElementBoxAd:['beginSimulatedAd',{operationId:'patrol-client-operation-0002',expectedRevision:2,expectedSequence:1}],
 completeCanonicalElementBoxAd:['completeSimulatedAd',{operationId:'patrol-client-operation-0003',expectedRevision:2,expectedSequence:1,sourceId:'patrol-source-00000001'}],
 abandonCanonicalElementBoxAd:['abandonSimulatedAd',{operationId:'patrol-client-operation-0004',expectedRevision:2,expectedSequence:1,sourceId:'patrol-source-00000001'}],
 issueCanonicalPatrolTicket:['issueTicket',{operationId:'patrol-client-operation-0005',expectedRevision:2,triggerEntryId:'forest:0',availableEntryIds:['forest:0']}],
 settleCanonicalPatrolMember:['settleMember',{operationId:'patrol-client-operation-0006',expectedRevision:2,ticketId:'patrol-ticket-00000001',memberIndex:0}],
 settleCanonicalPatrolTerminal:['settleTerminal',{operationId:'patrol-client-operation-0007',expectedRevision:2,ticketId:'patrol-ticket-00000001',kind:'win'}],
 abandonCanonicalPatrolTicket:['abandonTicket',{operationId:'patrol-client-operation-0008',expectedRevision:2,ticketId:'patrol-ticket-00000001'}]
};
function backend(){
 const index=read('functions/index.js'),start=index.indexOf('function canonicalPatrolIntent('),end=index.indexOf('// No browser grant issuer',start);
 assert.ok(start>0&&end>start);
 const calls=[];let verified=0;
 class HttpsError extends Error{constructor(code,message){super(message);this.code=code;}}
 const owner=Object.fromEntries(Object.values(specs).map(([method])=>[method,async(request,args)=>{
  if(request.data.uid!==request.auth.uid||request.data.session?.valid!==true)throw new HttpsError('permission-denied','session');
  calls.push({method,args:JSON.parse(JSON.stringify(args))});return {operationId:args.operationId,authoritativeStateReady:false};
 }]));
 const sandbox=vm.createContext({exports:{},CALLABLE_OPTIONS:{},onCall:(_options,handler)=>handler,HttpsError,
  canonicalPatrol:{...owner,modeOwner:owner},asHttpsError:error=>error,
  verifyGameIdentity:async request=>{verified++;if(!request.auth?.uid)throw new HttpsError('unauthenticated','auth');return request;}});
 vm.runInContext(index.slice(start,end),sandbox);
 return {api:sandbox.exports,calls,verified:()=>verified};
}
test('actual callable adapters verify identity, reject extra/missing fields and forward only exact intents',async()=>{
 const h=backend();
 for(const [name,[method,intent]] of Object.entries(specs)){
  const request={auth:{uid:'uid-a'},data:{uid:'uid-a',session:{valid:true},...intent}};
  assert.equal((await h.api[name](request)).operationId,intent.operationId);
  assert.deepEqual(h.calls.at(-1),{method,args:intent});
  for(const key of ['amount','gold','exp','rawState','gameSave','win','serverNow']){
   const count=h.calls.length;
   await assert.rejects(h.api[name]({...request,data:{...request.data,[key]:999}}),{code:'invalid-argument'});
   assert.equal(h.calls.length,count);
  }
  const missing={...request.data};delete missing.operationId;
  await assert.rejects(h.api[name]({...request,data:missing}),{code:'invalid-argument'});
  await assert.rejects(h.api[name]({...request,auth:null}),{code:'unauthenticated'});
  await assert.rejects(h.api[name]({...request,data:{...request.data,uid:'uid-b'}}),{code:'permission-denied'});
  await assert.rejects(h.api[name]({...request,data:{...request.data,session:{valid:false}}}),{code:'permission-denied'});
 }
 assert.equal(h.verified(),Object.keys(specs).length*12);
});
function client(){
 let identity={uid:'uid-a',authTime:10},intercept=null,lost=false;const calls=[];
 const sessionContext=vm.createContext({});
 vm.runInContext(read('js/firebase/session-client.js').replace(/^export /gm,''),sessionContext);
 const sessions=sessionContext.createGameSessionClient({getIdentity:async()=>identity,call:async(name,payload)=>{
  calls.push({name,payload:JSON.parse(JSON.stringify(payload))});
  if(name==='createGameSession')return {schemaVersion:1,uid:payload.uid,status:'active',sessionId:'s'.repeat(32),credential:'c'.repeat(43)};
  if(name==='protectedTest')return {};
  if(intercept){const fn=intercept;intercept=null;await fn();}
  if(lost){lost=false;throw Error('response lost');}
  return {operationId:payload.operationId,authoritativeStateReady:false};
 }});
 const module=read('js/firebase/firebase-cloud-save.js').replace(/^import[\s\S]*?;\r?\n/gm,'')
  .replace(/^export \{[^}]*\};\r?\n/gm,'').replace(/^export /gm,'');
 const context=vm.createContext({getFirebaseAuth:()=>({currentUser:identity?{uid:identity.uid}:null}),
  callProtectedFunction:(name,args,uid)=>sessions.invoke(name,args,uid),CLOUD_FUNCTIONS_REGION:'test',window:{}});
 vm.runInContext(module,context);
 return {api:context,calls,sessions,identity:value=>{identity=value;},during:fn=>{intercept=fn;},lose:()=>{lost=true;}};
}
test('explicit Client services strip minting fields, preserve caller operation IDs and do not auto-call',async()=>{
 const h=client();assert.equal(h.calls.length,0);
 for(const [name,[,intent]] of Object.entries(specs)){
  await h.api[name]({...intent,uid:'forged',session:{},amount:999,gameSave:{gold:999}});
  assert.deepEqual(h.calls.at(-1),{name,payload:{...intent,uid:'uid-a',session:{schemaVersion:1,uid:'uid-a',status:'active',sessionId:'s'.repeat(32),credential:'c'.repeat(43)}}});
 }
 const intent=specs.settleCanonicalPatrolMember[1],before=h.calls.filter(row=>row.name==='createGameSession').length;
 h.lose();await assert.rejects(h.api.settleCanonicalPatrolMember(intent),{code:'SESSION_UNAVAILABLE'});
 await h.api.settleCanonicalPatrolMember(intent);
 assert.deepEqual(h.calls.filter(row=>row.name==='settleCanonicalPatrolMember').slice(-2).map(row=>row.payload.operationId),[intent.operationId,intent.operationId]);
 assert.equal(h.calls.filter(row=>row.name==='createGameSession').length,before);
});
test('UID, authentication epoch or session reset during a response prevents returning stale results',async()=>{
 for(const change of [h=>h.identity({uid:'uid-b',authTime:10}),h=>h.identity({uid:'uid-a',authTime:11}),h=>h.sessions.reset()]){
  const h=client();h.during(()=>change(h));
  await assert.rejects(h.api.issueCanonicalPatrolTicket(specs.issueCanonicalPatrolTicket[1]),{code:'ACCOUNT_CHANGED'});
 }
});
test('bootstrap and isolated browser QA retain the explicit eight-function export contract',()=>{
 const bootstrap=read('js/firebase/firebase-bootstrap.js');
 const names=Object.keys(specs);
 const exposed=bootstrap.slice(bootstrap.indexOf('const api=Object.freeze({'),bootstrap.indexOf('window.FourSymbolsFirebase=api'));
 for(const name of names)assert.match(exposed,new RegExp('\\b'+name+'\\b'));
 for(const file of ['.github/scripts/run-boot-architecture-browser-qa.mjs','.github/scripts/run-bottom-nav-runtime-browser-qa.mjs','.github/scripts/runtime-browser-qa-support.mjs'])
  for(const name of names)assert.ok(read(file).includes('export async function '+name+'()'),file+'/'+name);
});
