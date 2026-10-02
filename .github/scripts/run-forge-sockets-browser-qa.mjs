import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {ROOT,findChrome,startServer,waitJson,Cdp,qaPrelude} from './runtime-browser-qa-support.mjs';

// Production loader and UI, disposable UID-local fixtures only. No player
// credentials or cloud writes; this does not certify a backend transaction.
const OUT=path.join(ROOT,'artifacts/browser-qa/responsive-item/forge');
const pause=()=>new Promise(resolve=>setTimeout(resolve,150));
const READY=`(async()=>{const end=Date.now()+45000;while(Date.now()<end&&!(window.FourSymbolsStartupPolicy?.getState?.()==='READY'&&document.getElementById('startupLoader')?.hidden&&!document.getElementById('firebaseAuthOverlay')?.classList.contains('show')))await new Promise(r=>setTimeout(r,50));if(window.FourSymbolsStartupPolicy?.getState?.()!=='READY')throw Error('startup not READY');await FourSymbolsFeatures.ensure('gameplay-core','forge-qa');showPage('home');closeHomeFeature();return true;})()`;
const FIXTURE=`(()=>{
 const repo=FourSymbolsAccountSave,state=repo.readActive();
 repo.writeForUid(state.uid,state.save,{source:'local',cloudBaseFingerprint:null,localDirty:true});
 const gear={id:'forge-qa-orange',v141Uid:'forge-qa-orange',name:'鍛造測試橙裝',type:'armor',rarityKey:'orange',tierKey:'orange',count:1,stats:{attack:5},icon:'◇'};
 inventoryItems.splice(0,inventoryItems.length,gear,{...FourSymbolsEquipmentGems.definitions.gemVitalityI,count:4},...Array.from({length:20},(_,i)=>({...gear,id:'forge-qa-'+i,v141Uid:'forge-qa-'+i,name:'長名稱鍛造裝備測試'+i})));
 for(const slots of Object.values(characterEquipment))for(const slot of Object.keys(slots))slots[slot]=null;
 characterEquipment.fire.armor={...gear,id:'forge-qa-equipped',v141Uid:'forge-qa-equipped',name:'鍛造測試紅裝',rarityKey:'pink',tierKey:'pink',stats:{}};
 inventoryCharacterIndex=0;rebuildInventorySlots();saveGame();return true;
})()`;
fs.mkdirSync(OUT,{recursive:true});
let server,proc,c,profile;const evidence=[];
try{
 server=await startServer();profile=fs.mkdtempSync(path.join(os.tmpdir(),'forge-qa-'));
 const chrome=findChrome(),port=9900+Math.floor(Math.random()*300);
 proc=spawn(chrome,[...(chrome.includes('headless-shell')?[]:['--headless=new']),'--no-sandbox','--disable-gpu','--disable-dev-shm-usage',`--remote-debugging-port=${port}`,`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
 const target=(await waitJson(`http://127.0.0.1:${port}/json/list`)).find(t=>t.type==='page');c=new Cdp(target.webSocketDebuggerUrl);
 await c.send('Page.enable');await c.send('Runtime.enable');
 await c.send('Page.addScriptToEvaluateOnNewDocument',{source:qaPrelude().replace(/^<script>|<\/script>$/g,'')});
 async function tap(selector){
  const point=await c.eval(`(()=>{const n=document.querySelector(${JSON.stringify(selector)});if(!n)throw Error('missing control '+${JSON.stringify(selector)});n.scrollIntoView({block:'nearest'});const r=n.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,h=document.elementFromPoint(x,y);if(n.disabled||!r.width||!r.height||!(h&&(n===h||n.contains(h))))throw Error('untappable control '+${JSON.stringify(selector)});return {x,y};})()`);
  await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await pause();
 }
 for(const [width,height] of [[390,844],[412,915]]){
  await c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true,screenWidth:width,screenHeight:height});
  await c.send('Page.navigate',{url:server.url});assert.equal(await c.eval(READY),true);
  // Enter through the actual home card before accessing the lazy runtime.
  await tap('[onclick="openHomeFeature(\'forge\')"]');await pause();
  assert.equal(await c.eval(`typeof v141SwitchForgeTab`),'function');assert.equal(await c.eval(FIXTURE),true);
  await c.eval(`v141SwitchForgeTab('reforge')`);
  assert.deepEqual(await c.eval(`Array.from(document.querySelectorAll('.v141-forge-tabs button'),n=>n.textContent)`),['冶煉','鑲嵌']);
  assert.equal(await c.eval(`Array.from(document.querySelectorAll('#homeFeatureBody select')).filter(n=>{const r=n.getBoundingClientRect();return r.width&&r.height}).length`),0,'visible native selector in forge');
  await tap('.v141-forge-tabs button:last-child');
  assert.equal(await c.eval(`document.querySelectorAll('.v141-socket').length`),1);
  const geometry=await c.eval(`(()=>{const card=document.querySelector('.v141-socket-card'),body=document.querySelector('.v141-synthesis-body'),r=card.getBoundingClientRect();return {left:r.left,right:r.right,overflow:card.scrollWidth-card.clientWidth,bodyOverflow:getComputedStyle(body).overflowY,fonts:[...card.querySelectorAll('summary,button,small')].map(n=>{const a=n.getBoundingClientRect();return parseFloat(getComputedStyle(n).fontSize)*(n.offsetWidth?a.width/n.offsetWidth:1)})};})()`);
  assert.ok(geometry.left>=-1&&geometry.right<=width+1&&geometry.overflow<=1,'forge overflow');assert.ok(geometry.fonts.every(n=>n>=12.9),'forge text below 13px');
  // Long choices scroll in the existing body; selecting returns to one slot.
  await tap('.v141-forge-picker summary');
  await tap('[data-forge-value="forge-qa-19"]');assert.equal(await c.eval(`document.querySelectorAll('.v141-socket').length`),1);
  await tap('.v141-forge-picker summary');await tap('[data-forge-value="forge-qa-orange"]');
  await tap('.v141-socket-card .v141-synthesis-primary');
  const saved=await c.eval(`(()=>{const s=FourSymbolsAccountSave.readActive().save;return {sockets:s.inventoryItems.find(n=>n.v141Uid==='forge-qa-orange').sockets,count:s.inventoryItems.find(n=>n.id==='gemVitalityI').count,blocked:v141SocketGem()===false};})()`);
  assert.deepEqual(saved,{sockets:['gemVitalityI'],count:3,blocked:true});
  await tap('.v141-forge-picker summary');await tap('[data-forge-value="forge-qa-equipped"]');assert.equal(await c.eval(`document.querySelectorAll('.v141-socket').length`),2);
  await tap('.v141-socket-card .v141-synthesis-primary');
  assert.equal(await c.eval(`getEquipmentBonus('fire').vitality`),1);
  assert.equal(await c.eval(`(()=>{unequipItem('armor');return getEquipmentBonus('fire').vitality;})()`),0,'unequip retains gem effect');
  assert.deepEqual(await c.eval(`FourSymbolsAccountSave.readActive().save.inventoryItems.find(n=>n.v141Uid==='forge-qa-equipped').sockets`),['gemVitalityI']);
  await c.eval(`closeHomeFeature();openHomeFeature('forge');v141SwitchForgeTab('socket')`);await pause();
  assert.deepEqual(await c.eval(`Array.from(document.querySelectorAll('.v141-forge-tabs button'),n=>n.textContent)`),['冶煉','鑲嵌']);
  assert.equal(await c.eval(`(()=>{const repo=FourSymbolsAccountSave,s=repo.readActive();repo.writeForUid(s.uid,s.save,{source:'authoritative-cloud-read',cloudBaseFingerprint:'v1:1:00000000000000000000000000000000',localDirty:false});v141SelectSocketItem('forge-qa-equipped');return v141SocketGem();})()`),false,'cloud character used local socket mutation');
  const shot=await c.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(OUT,`forge-${width}.png`),Buffer.from(shot.data,'base64'));
  evidence.push({width,height,geometry,saved,equippedBonus:1,unequippedBonus:0,cloudMutationBlocked:true});console.log('PASS forge touch runtime '+width+'x'+height);
 }
 fs.writeFileSync(path.join(OUT,'evidence.json'),JSON.stringify({passed:true,sha:process.env.GITHUB_SHA||null,evidence},null,2)+'\n');
}catch(error){if(c){try{const shot=await c.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(OUT,'failure.png'),Buffer.from(shot.data,'base64'));}catch{}}fs.writeFileSync(path.join(OUT,'evidence.json'),JSON.stringify({passed:false,error:String(error.stack||error),evidence},null,2)+'\n');throw error;
}finally{c?.close();proc?.kill('SIGTERM');server?.server.close();if(profile)try{fs.rmSync(profile,{recursive:true,force:true});}catch{}}
