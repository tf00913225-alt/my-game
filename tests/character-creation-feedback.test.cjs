'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/00-main.js','utf8');
const declaration=name=>{const m=source.match(new RegExp('^(?:async )?function '+name+'\\([\\s\\S]*?^\\}','m'));assert.ok(m,name);return m[0];};
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
function fixture(){
 const bootstrap=deferred(),commit=deferred(),button={disabled:false,attrs:{},setAttribute(k,v){this.attrs[k]=v;}},label={},pages={creationPage:{style:{}},gameInterface:{style:{}}};let uid='qa-owner',bootstrapCalls=0,commitCalls=0,saves=0,ready=0;const alerts=[];
 const c={window:null,console:{error(){}},Math,Number,Object,JSON,Promise,creationTargetSlot:1,creationStats:{attack:3,vitality:2,energy:1,intelligence:2,defensePoints:1,agility:1},creationPoints:0,selectedCreationElement:'fire',player:{id:'',gender:'female'},INITIAL_CHARACTER_SKILL_POINTS:5,
  $:id=>id==='creationId'?{value:'測試角色'}:id==='creationSubmitButton'?button:id==='creationSubmitLabel'?label:pages[id],alert:m=>alerts.push(m),getBaseStats:()=>({maxHP:100,maxSP:30}),updatePlayerHeader(){},updateUI(){},renderInventory(){},renderSkillLoadout(){},saveGame(){saves++;return true;},
  FourSymbolsStartupPolicy:{canCreateCharacter:()=>uid==='qa-owner',getUid:()=>uid,notifyCharacterCreated(){ready++;}},
  FourSymbolsAccountSave:{readForUid:()=>({status:'empty'}),inspectLegacy:()=>({status:'none'}),getActiveUid:()=>uid},
  FourSymbolsFirebase:{bootstrapCloudSave(){bootstrapCalls++;return bootstrap.promise;},createInitialCanonicalCharacter(){commitCalls++;return commit.promise;}}};
 c.window=c;vm.createContext(c);vm.runInContext('let initialCharacterCreationPending=false;'+['updateInitialCharacterCreationFeedback','createCharacter'].map(declaration).join('\n'),c);
 return {c,button,label,bootstrap,commit,alerts,calls:()=>({bootstrapCalls,commitCalls,saves,ready}),changeUid:()=>uid='other'};
}
test('first click immediately reports real phases and prevents duplicate cloud creation until committed',async()=>{
 const f=fixture(),pending=f.c.createCharacter();assert.equal(f.button.disabled,true);assert.equal(f.button.attrs['aria-busy'],'true');assert.equal(f.label.textContent,'正在確認帳號…');assert.equal(await f.c.createCharacter(),false);assert.equal(f.calls().bootstrapCalls,1);assert.equal(f.c.player.id,'');
 f.bootstrap.resolve({serverRevision:0});await new Promise(resolve=>setImmediate(resolve));assert.equal(f.label.textContent,'正在建立角色…');assert.equal(f.calls().commitCalls,1);assert.equal(f.calls().saves,0);assert.equal(f.calls().ready,0);
 f.commit.resolve({authoritativeStateReady:false,sourceRevision:1});assert.equal(await pending,true);assert.equal(f.button.disabled,false);assert.equal(f.button.attrs['aria-busy'],'false');assert.equal(f.label.textContent,'開始冒險');assert.equal(f.calls().saves,1);assert.equal(f.calls().ready,1);
});
test('cloud rejection restores retry feedback without creating or saving a local character',async()=>{
 const f=fixture(),pending=f.c.createCharacter();f.bootstrap.reject(Error('network'));assert.equal(await pending,false);assert.equal(f.button.disabled,false);assert.equal(f.label.textContent,'創角未完成，請重試');assert.equal(f.alerts.length,1);assert.equal(f.c.player.id,'');assert.equal(f.calls().saves,0);
});
test('account change during request remains fail closed and restores button',async()=>{
 const f=fixture(),pending=f.c.createCharacter();f.changeUid();f.bootstrap.resolve({serverRevision:0});assert.equal(await pending,false);assert.equal(f.calls().commitCalls,0);assert.equal(f.calls().saves,0);assert.equal(f.button.disabled,false);
});
