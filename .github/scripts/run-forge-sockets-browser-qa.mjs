import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {ROOT,ASSET_MANIFEST,findChrome,startServer,waitJson,Cdp,qaPrelude,QA_AUTH_PATH,QA_CLOUD_PATH,QA_SESSION_PATH,QA_AUTH_MODULE,QA_CLOUD_MODULE,QA_SESSION_MODULE} from './runtime-browser-qa-support.mjs';

// Production loader and UI, disposable UID-local fixtures only. No player
// credentials or cloud writes; this does not certify a backend transaction.
const OUT=path.join(ROOT,'artifacts/browser-qa/responsive-item/forge');
const pause=()=>new Promise(resolve=>setTimeout(resolve,350));
const READY=`(async()=>{const end=Date.now()+45000;while(Date.now()<end&&!(window.FourSymbolsStartupPolicy?.getState?.()==='READY'&&document.getElementById('startupLoader')?.hidden&&!document.getElementById('firebaseAuthOverlay')?.classList.contains('show')))await new Promise(r=>setTimeout(r,50));if(window.FourSymbolsStartupPolicy?.getState?.()!=='READY')throw Error('startup not READY');showPage('home');closeHomeFeature();return true;})()`;
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
 const live=!!process.env.DEV_BASE_URL;let url;
 if(live){
  url=new URL('/index.html',process.env.DEV_BASE_URL).href;
  assert.ok(process.env.EXPECTED_COMMIT_SHA,'live QA requires deployment SHA');
  const release=await (await fetch(new URL('/release-manifest.json',url),{cache:'no-store'})).json();assert.equal(release.commitSha,process.env.EXPECTED_COMMIT_SHA,'deployed SHA mismatch');
  const manifest=await (await fetch(new URL('/build/asset-manifest.json',url),{cache:'no-store'})).json();assert.deepEqual(manifest,ASSET_MANIFEST,'deployed bundles mismatch');
 }else{server=await startServer();url=server.url;}
 profile=fs.mkdtempSync(path.join(os.tmpdir(),'forge-qa-'));
 const chrome=findChrome(),port=9900+Math.floor(Math.random()*300);
 proc=spawn(chrome,[...(chrome.includes('headless-shell')?[]:['--headless=new']),'--no-sandbox','--disable-gpu','--disable-dev-shm-usage',`--remote-debugging-port=${port}`,`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
 const target=(await waitJson(`http://127.0.0.1:${port}/json/list`)).find(t=>t.type==='page');c=new Cdp(target.webSocketDebuggerUrl);
 await c.send('Page.enable');await c.send('Runtime.enable');
 // Hold the real lazy script until the first home-card touch. Background idle
 // prefetch must not accidentally turn this cold-entry regression into a warm test.
 let holdGameplay=true;const heldGameplay=[];
 const stubs=new Map(live?[[QA_AUTH_PATH,QA_AUTH_MODULE],[QA_CLOUD_PATH,QA_CLOUD_MODULE],[QA_SESSION_PATH,QA_SESSION_MODULE]]:[]);
 c.ws.addEventListener('message',event=>{const m=JSON.parse(String(event.data));if(m.method==='Fetch.requestPaused'){const p=m.params,pathname=new URL(p.request.url).pathname;if(holdGameplay&&/\/build\/gameplay-core-(primary|secondary)\.[0-9a-f]{12}\.js$/.test(pathname)){heldGameplay.push(p.requestId);return;}const body=stubs.get(pathname);c.send(body?'Fetch.fulfillRequest':'Fetch.continueRequest',body?{requestId:p.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'text/javascript'}],body:Buffer.from(body).toString('base64')}:{requestId:p.requestId}).catch(error=>console.error(error));}});
 await c.send('Fetch.enable',{patterns:[{urlPattern:'*/build/gameplay-core-*.js*',resourceType:'Script'},...[...stubs.keys()].map(p=>({urlPattern:'*'+p+'*',resourceType:'Script'}))]});
 await c.send('Page.addScriptToEvaluateOnNewDocument',{source:qaPrelude().replace(/^<script>|<\/script>$/g,'')});
 async function tap(selector){
  const point=await c.eval(`(async()=>{const n=document.querySelector(${JSON.stringify(selector)});if(!n)throw Error('missing control '+${JSON.stringify(selector)});n.scrollIntoView({block:'nearest',behavior:'instant'});await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const r=n.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,h=document.elementFromPoint(x,y);if(n.disabled||!r.width||!r.height||!(h&&(n===h||n.contains(h))))throw Error('untappable control '+${JSON.stringify(selector)}+' '+JSON.stringify({rect:r.toJSON(),hit:h&&{tag:h.tagName,id:h.id,class:h.className},body:document.querySelector('.v141-synthesis-body')?.getBoundingClientRect().toJSON(),nav:document.getElementById('bottomNav')?.getBoundingClientRect().toJSON(),detailsOpen:n.closest('details')?.open,scrollTop:document.querySelector('.v141-synthesis-body')?.scrollTop}));return {x,y,summary:n.tagName==='SUMMARY',wasOpen:n.tagName==='SUMMARY'?n.parentElement.open:null};})()`);
  await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:point.x,y:point.y}]});await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await pause();
  if(point.summary){
   assert.equal(await c.eval(`(async()=>{const end=Date.now()+1500;while(Date.now()<end){const n=document.querySelector(${JSON.stringify(selector)});if(n?.parentElement.open!==${point.wasOpen})return true;await new Promise(r=>setTimeout(r,30));}return false;})()`),true,'summary touch did not toggle picker '+selector);
  }
 }
 async function openEquipmentPicker(){
  if(!await c.eval(`document.querySelector('.v141-forge-picker').open`))await tap('.v141-forge-picker summary');
  assert.equal(await c.eval(`document.querySelector('.v141-forge-picker').open`),true,'equipment picker is closed');
 }
 for(const [width,height] of [[390,844],[412,915]]){
  await c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true,screenWidth:width,screenHeight:height});
  if(width===390){await c.send('Page.navigate',{url});assert.equal(await c.eval(READY),true);}
  else{assert.equal(await c.eval(`FourSymbolsStartupPolicy.getState()`),'READY');await c.eval(`showPage('home');closeHomeFeature();true`);}
  // Use the same real READY runtime across viewport resizes, matching the
  // existing Responsive Item QA. Reloading a mutated local fixture against the
  // fixed read-only cloud transport correctly enters account conflict handling.
  // Enter through the actual home card before accessing the lazy runtime.
  if(width===390){
   assert.equal(await c.eval(`typeof v141SwitchForgeTab`),'undefined','cold entry was preloaded');
   // The same shared modal previously displayed an announcement. Its stale
   // content must never be reopened while the forge owner is still loading.
   await c.eval(`openHomeFeature('announcement');closeHomeFeature();true`);
  }
  await tap('[onclick="openHomeFeature(\'forge\')"]');
  if(width===390){
   assert.equal(await c.eval(`document.getElementById('homeFeatureModal').classList.contains('show')`),false,'cold forge reopened stale announcement before owner ready');
   assert.equal(await c.eval(`document.querySelector('[aria-label="鍛造"]').getAttribute('aria-busy')`),'true','first touch did not wait for the forge owner');
   assert.ok(heldGameplay.length,'cold entry did not exercise a delayed real gameplay script');
   holdGameplay=false;for(const requestId of heldGameplay.splice(0))await c.send('Fetch.continueRequest',{requestId});
  }
  await c.eval(`(async()=>{const end=Date.now()+10000;while(Date.now()<end&&typeof v141SwitchForgeTab!=='function')await new Promise(r=>setTimeout(r,50));return true;})()`);
  assert.equal(await c.eval(`typeof v141SwitchForgeTab`),'function');
  assert.equal(await c.eval(`document.getElementById('homeFeatureModal').classList.contains('show')`),true,'first touch did not open forge after loading');
  assert.equal(await c.eval(`document.getElementById('homeFeatureModalTitle').textContent`),'鍛造');
  assert.deepEqual(await c.eval(`Array.from(document.querySelectorAll('.v141-forge-tabs button'),n=>n.textContent)`),['冶煉','鑲嵌']);
  assert.equal(await c.eval(FIXTURE),true);
  await c.eval(`v141SwitchForgeTab('reforge')`);
  assert.deepEqual(await c.eval(`Array.from(document.querySelectorAll('.v141-forge-tabs button'),n=>n.textContent)`),['冶煉','鑲嵌']);
  assert.equal(await c.eval(`Array.from(document.querySelectorAll('#homeFeatureModalBody select')).filter(n=>{const r=n.getBoundingClientRect();return r.width&&r.height}).length`),0,'visible native selector in forge');
  await tap('.v141-forge-tabs button:last-child');
  await openEquipmentPicker();await tap('[data-forge-value="forge-qa-orange"]');
  assert.equal(await c.eval(`document.querySelectorAll('.v141-socket').length`),1);
  const geometry=await c.eval(`(()=>{const card=document.querySelector('.v141-socket-card'),body=document.querySelector('.v141-synthesis-body'),r=card.getBoundingClientRect();return {left:r.left,right:r.right,overflow:card.scrollWidth-card.clientWidth,bodyOverflow:getComputedStyle(body).overflowY,fonts:[...card.querySelectorAll('summary,button,small')].filter(n=>{const a=n.getBoundingClientRect();return a.width>0&&a.height>0}).map(n=>{const a=n.getBoundingClientRect();return {tag:n.tagName,text:n.textContent,font:parseFloat(getComputedStyle(n).fontSize)*(n.offsetWidth?a.width/n.offsetWidth:1)}})};})()`);
  assert.ok(geometry.left>=-1&&geometry.right<=width+1&&geometry.overflow<=1,'forge overflow');assert.ok(geometry.fonts.length&&geometry.fonts.every(n=>n.font>=12.9),'forge text below 13px '+JSON.stringify(geometry));
  assert.equal(await c.eval(`(()=>{const b=document.querySelector('.v141-synthesis-body').getBoundingClientRect(),nav=document.getElementById('bottomNav').getBoundingClientRect();return b.bottom<=nav.top+1;})()`),true,'forge scroll area extends behind native navigation');
  // Long choices scroll in the existing body; selecting returns to one slot.
  await openEquipmentPicker();
  const drag=await c.eval(`(()=>{const b=document.querySelector('.v141-synthesis-body'),r=b.getBoundingClientRect();b.scrollTop=0;return {x:r.left+r.width/2,y:r.bottom-25,to:r.top+25};})()`);
  await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:drag.x,y:drag.y}]});
  for(let i=1;i<=8;i++){await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:drag.x,y:drag.y+(drag.to-drag.y)*i/8}]});await new Promise(r=>setTimeout(r,20));}
  await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await pause();
  // A real fling continues after touchEnd. Its first tap stops momentum rather
  // than activates an option; begin the selection assertion only once idle.
  assert.equal(await c.eval(`(async()=>{const b=document.querySelector('.v141-synthesis-body'),end=Date.now()+5000;let previous=b.scrollTop,stable=Date.now();while(Date.now()<end){await new Promise(r=>setTimeout(r,50));const next=b.scrollTop;if(Math.abs(next-previous)>.5)stable=Date.now();previous=next;if(Date.now()-stable>=300)return true;}return false;})()`),true,'equipment scroll did not settle');
  const scrollTop=await c.eval(`document.querySelector('.v141-synthesis-body').scrollTop`);assert.ok(scrollTop>0,'equipment choices cannot touch scroll');
  assert.equal(await c.eval(`document.querySelector('.v141-forge-option.selected').dataset.forgeValue`),'forge-qa-orange','scroll selected a different item');
  await tap('[data-forge-value="forge-qa-19"]');assert.equal(await c.eval(`document.querySelector('.v141-forge-option.selected').dataset.forgeValue`),'forge-qa-19','real touch did not select the last equipment');assert.equal(await c.eval(`document.querySelectorAll('.v141-socket').length`),1);
  await openEquipmentPicker();await tap('[data-forge-value="forge-qa-orange"]');
  await tap('.v141-socket-card .v141-synthesis-primary');
  const saved=await c.eval(`(()=>{const s=FourSymbolsAccountSave.readActive().save;return {sockets:s.inventoryItems.find(n=>n.v141Uid==='forge-qa-orange').sockets,count:s.inventoryItems.find(n=>n.id==='gemVitalityI').count,blocked:v141SocketGem()===false};})()`);
  assert.deepEqual(saved,{sockets:['gemVitalityI'],count:3,blocked:true});
  await openEquipmentPicker();await tap('[data-forge-value="forge-qa-equipped"]');assert.equal(await c.eval(`document.querySelectorAll('.v141-socket').length`),2);
  await tap('.v141-socket-card .v141-synthesis-primary');
  assert.equal(await c.eval(`getEquipmentBonus('fire').vitality`),1);
  assert.equal(await c.eval(`(()=>{loadGame(JSON.parse(JSON.stringify(FourSymbolsAccountSave.readActive().save)));return getEquipmentBonus('fire').vitality;})()`),1,'hydration lost sockets');
  assert.equal(await c.eval(`(()=>{unequipItem('armor');return getEquipmentBonus('fire').vitality;})()`),0,'unequip retains gem effect');
  assert.deepEqual(await c.eval(`FourSymbolsAccountSave.readActive().save.inventoryItems.find(n=>n.v141Uid==='forge-qa-equipped').sockets`),['gemVitalityI']);
  await c.eval(`closeHomeFeature();openHomeFeature('synthesis')`);await pause();
  await tap('[data-v17363-material-tab="1"]');
  await c.eval(`closeHomeFeature();openHomeFeature('forge');v141SwitchForgeTab('socket')`);await pause();
  assert.deepEqual(await c.eval(`Array.from(document.querySelectorAll('.v141-forge-tabs button'),n=>n.textContent)`),['冶煉','鑲嵌']);
  assert.equal(await c.eval(`(()=>{const repo=FourSymbolsAccountSave,s=repo.readActive();repo.writeForUid(s.uid,s.save,{source:'authoritative-cloud-read',cloudBaseFingerprint:'v1:1:00000000000000000000000000000000',localDirty:false});v141SelectSocketItem('forge-qa-equipped');const blocked=v141SocketGem();repo.writeForUid(s.uid,s.save,{source:'local',cloudBaseFingerprint:null,localDirty:true});return blocked;})()`),false,'cloud character used local socket mutation');
  const shot=await c.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(OUT,`forge-${width}.png`),Buffer.from(shot.data,'base64'));
  evidence.push({width,height,entry:width===390?'cold-delayed-owner-after-announcement':'warm-reentry',geometry,scrollTop,saved,equippedBonus:1,unequippedBonus:0,cloudMutationBlocked:true});console.log('PASS forge touch runtime '+width+'x'+height);
 }
 fs.writeFileSync(path.join(OUT,'evidence.json'),JSON.stringify({passed:true,environment:live?'deployed-dev':'production-local',sha:process.env.EXPECTED_COMMIT_SHA||process.env.GITHUB_SHA||null,evidence},null,2)+'\n');
}catch(error){if(c){try{const shot=await c.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(OUT,'failure.png'),Buffer.from(shot.data,'base64'));}catch{}}fs.writeFileSync(path.join(OUT,'evidence.json'),JSON.stringify({passed:false,error:String(error.stack||error),evidence},null,2)+'\n');throw error;
}finally{c?.close();proc?.kill('SIGTERM');server?.server.close();if(profile)try{fs.rmSync(profile,{recursive:true,force:true});}catch{}}
