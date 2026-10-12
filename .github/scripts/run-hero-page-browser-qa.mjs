import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {ASSET_MANIFEST,findChrome,startServer,waitJson,Cdp,qaPrelude,QA_AUTH_PATH,QA_CLOUD_PATH,QA_SESSION_PATH,QA_AUTH_MODULE,QA_CLOUD_MODULE,QA_SESSION_MODULE} from './runtime-browser-qa-support.mjs';

// Existing production UI/roster Owners with an isolated UID and read-only transport.
// Local ownership is a pure Core fixture; live DEV uses its existing preview domain.
const OUT=path.resolve('artifacts/browser-qa/responsive-item/hero');
const ids=['divineDogHongbao','vajraHeavenlyKing'];
const pause=(ms=350)=>new Promise(r=>setTimeout(r,ms));
fs.mkdirSync(OUT,{recursive:true});
let server,proc,c,profile;const evidence=[];
try{
 const live=!!process.env.DEV_BASE_URL;let url;
 if(live){
  url=new URL('index.html',process.env.DEV_BASE_URL.replace(/\/$/,'')+'/').href;
  assert.equal(new URL(url).hostname,'dev.four-symbols-dev.pages.dev');
  assert.ok(process.env.EXPECTED_COMMIT_SHA,'live QA requires SHA');
  assert.equal((await (await fetch(new URL('release-manifest.json',url),{cache:'no-store'})).json()).commitSha,process.env.EXPECTED_COMMIT_SHA);
  assert.deepEqual(await (await fetch(new URL('build/asset-manifest.json',url),{cache:'no-store'})).json(),ASSET_MANIFEST);
 }else{server=await startServer();url=server.url;}
 profile=fs.mkdtempSync(path.join(OUT,'profile-'));
 const chrome=findChrome(),port=10300+Math.floor(Math.random()*300);
 proc=spawn(chrome,[...(chrome.includes('headless-shell')?[]:['--headless=new']),'--no-sandbox','--disable-gpu',`--remote-debugging-port=${port}`,`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
 c=new Cdp((await waitJson(`http://127.0.0.1:${port}/json/list`)).find(t=>t.type==='page').webSocketDebuggerUrl);
 await c.send('Page.enable');await c.send('Runtime.enable');
 if(live){
  const stubs=new Map([[QA_AUTH_PATH,QA_AUTH_MODULE],[QA_CLOUD_PATH,QA_CLOUD_MODULE],[QA_SESSION_PATH,QA_SESSION_MODULE]]);
  c.ws.addEventListener('message',event=>{const m=JSON.parse(String(event.data));if(m.method==='Fetch.requestPaused'){const p=m.params,body=stubs.get(new URL(p.request.url).pathname);c.send(body?'Fetch.fulfillRequest':'Fetch.continueRequest',body?{requestId:p.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'text/javascript'}],body:Buffer.from(body).toString('base64')}:{requestId:p.requestId}).catch(console.error);}});
  await c.send('Fetch.enable',{patterns:[...stubs.keys()].map(p=>({urlPattern:'*'+p+'*',resourceType:'Script'}))});
 }
 await c.send('Page.addScriptToEvaluateOnNewDocument',{source:qaPrelude().replace(/^<script>|<\/script>$/g,'')+`;window.__heroQaErrors=[];addEventListener('error',e=>{if(e.message)window.__heroQaErrors.push(e.message)});`});
 await c.send('Emulation.setTouchEmulationEnabled',{enabled:true});
 async function tap(selector){
  const p=await c.eval(`(async()=>{const n=document.querySelector(${JSON.stringify(selector)});if(!n||n.disabled)throw Error('unavailable '+${JSON.stringify(selector)});n.scrollIntoView({block:'nearest'});await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const b=n.getBoundingClientRect(),x=b.left+b.width/2,y=b.top+b.height/2,h=document.elementFromPoint(x,y);if(!b.width||!b.height||!(n===h||n.contains(h)))throw Error('occluded '+${JSON.stringify(selector)});return {x,y};})()`);
  await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p]});await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await pause();
 }
 async function verifyArtwork(){
  const image=await c.eval(`(async()=>{const img=document.querySelector('.hero-profile img');let timer;try{await Promise.race([img.decode(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Hero WebP decode timeout: '+img.src)),15000);})]);}finally{clearTimeout(timer);}return {loaded:img.complete&&img.naturalWidth>0,width:img.naturalWidth,height:img.naturalHeight};})()`);
  assert.equal(image.loaded,true,'Hero WebP must finish decoding');
  assert.equal(image.width,1086,'Hero artwork must retain its original canvas width');
  assert.equal(image.height,1448,'Hero artwork must retain its original canvas height');
 }
 async function open(){await c.eval(`closeHomeFeature();openHomeFeature('rest')`);await tap('#heroHomeEntry');await c.eval(`(async()=>{const end=Date.now()+15000;while(Date.now()<end&&!document.getElementById('heroPageContent'))await new Promise(r=>setTimeout(r,50));if(!document.getElementById('heroPageContent'))throw Error('hero entry failed');return true;})()`);}
 for(const [width,height] of [[360,640],[412,915],[1024,768]]){
  await c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true,screenWidth:width,screenHeight:height});
  if(width===360){
   await c.send('Page.navigate',{url});
   await c.eval(`(async()=>{const end=Date.now()+45000;while(Date.now()<end&&!(window.FourSymbolsStartupPolicy?.getState?.()==='READY'&&document.getElementById('startupLoader')?.hidden&&!document.getElementById('firebaseAuthOverlay')?.classList.contains('show')))await new Promise(r=>setTimeout(r,50));if(window.FourSymbolsStartupPolicy?.getState?.()!=='READY')throw Error('startup not READY');showPage('home');return true;})()`);
   await open();
   assert.equal(await c.eval(`getHeroPageSnapshot().heroes.every(h=>!h.owned)`),true,'fixture starts canonically locked');
   if(!live){
    assert.equal(await c.eval(`document.getElementById('heroRosterToggle').disabled`),true);
    await c.eval(`(()=>{for(const id of ${JSON.stringify(ids)})FourSymbolsHeroSystem.replaceAccountState(FourSymbolsHeroSystem.getDomain().unlockHeroDirect(id,20261012));refreshHeroPage();return true;})()`);
   }else assert.equal(await c.eval(`getHeroPageSnapshot().heroes.every(h=>h.eligible&&!h.owned)`),true,'DEV preview not canonical ownership');
   await c.eval(`window.__heroCanonical=JSON.stringify(FourSymbolsHeroSystem.getDomain().serialize());true`);
  }else await open();
  await c.eval(`resetHeroPageRoster();true`);
  await tap('[data-hero-id="vajraHeavenlyKing"].hero-picker-button');
  assert.equal(await c.eval(`document.querySelector('.hero-profile h3').textContent`),'金剛天王');
  assert.ok((await c.eval(`document.querySelector('.hero-profile img').getAttribute('src')`)).endsWith('assets/heroes/vajra-heavenly-king.webp'),'Vajra must use its formal Hero WebP');
  await verifyArtwork();
  await tap('[data-hero-id="divineDogHongbao"].hero-picker-button');
  assert.ok((await c.eval(`document.querySelector('.hero-profile img').getAttribute('src')`)).endsWith('assets/heroes/divine-dog-hongbao.webp'),'Hongbao must use its formal Hero WebP');
  await verifyArtwork();
  const geometry=await c.eval(`(()=>{const b=document.querySelector('.hero-panel').getBoundingClientRect(),s=document.getElementById('heroPageContent'),f=document.querySelector('.hero-page-footer').getBoundingClientRect();return {box:b.toJSON(),footer:f.toJSON(),overflow:s.scrollWidth-s.clientWidth,objectFit:getComputedStyle(document.querySelector('.hero-profile img')).objectFit,minFont:Math.min(...Array.from(document.querySelectorAll('.hero-page-shell p,.hero-page-shell small,.hero-page-shell dt,.hero-page-shell button'),n=>parseFloat(getComputedStyle(n).fontSize)))};})()`);
  assert.ok(geometry.box.left>=-1&&geometry.box.right<=width+1&&geometry.box.top>=-1&&geometry.box.bottom<=height+1,JSON.stringify(geometry));
  assert.ok(geometry.footer.bottom<=geometry.box.bottom&&geometry.overflow<=1,JSON.stringify(geometry));assert.equal(geometry.objectFit,'contain');assert.ok(geometry.minFont>=13);
  const scroller=await c.eval(`document.getElementById('heroPageContent').getBoundingClientRect().toJSON()`);
  if(await c.eval(`heroPageContent.scrollHeight>heroPageContent.clientHeight`)){
   const x=scroller.left+scroller.width*.75,y=scroller.bottom-35;
   await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
   for(let i=1;i<=8;i++){await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-i*18}]});await pause(20);}
   await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await pause(600);
   assert.ok(await c.eval(`heroPageContent.scrollTop`)>0,'native content swipe failed');
  }
  await tap('#heroRosterTab');assert.equal(await c.eval(`document.querySelectorAll('.hero-roster-slot').length`),3);
  await tap('[aria-label="金剛天王移前"]');assert.deepEqual(await c.eval(`FourSymbolsHeroBattle.getRoster()`),ids.slice().reverse());
  await tap('#heroRosterToggle');assert.equal(await c.eval(`FourSymbolsHeroBattle.getRoster().length`),1);
  await tap('[data-hero-id="vajraHeavenlyKing"].hero-picker-button');await tap('#heroRosterToggle');assert.equal(await c.eval(`FourSymbolsHeroBattle.getRoster().length`),0);
  await tap('#heroRosterToggle');assert.equal(await c.eval(`initializeHeroBattleCombatants().length`),1);
  await tap('[data-hero-id="divineDogHongbao"].hero-picker-button');await tap('#heroRosterToggle');assert.equal(await c.eval(`initializeHeroBattleCombatants().length`),2);
  await tap('.hero-default-roster');assert.deepEqual(await c.eval(`FourSymbolsHeroBattle.getRoster()`),ids);
  assert.equal(await c.eval(`(()=>{const before=JSON.stringify(FourSymbolsHeroBattle.getRoster());battleActive=true;refreshHeroPage();const disabled=heroRosterToggle.disabled;const alert=rpgAlert;rpgAlert=()=>{};try{toggleHeroPageRoster('divineDogHongbao');moveHeroPageRoster('vajraHeavenlyKing',-1);resetHeroPageRoster();}finally{rpgAlert=alert;battleActive=false;refreshHeroPage();}return disabled&&before===JSON.stringify(FourSymbolsHeroBattle.getRoster());})()`),true);
  assert.equal(await c.eval(`(()=>{saveGame();const save=JSON.parse(localStorage.getItem('four_symbols_save:skill-runtime-browser-qa'));return JSON.stringify(FourSymbolsHeroSystem.getDomain().serialize())===window.__heroCanonical&&JSON.stringify(save.heroAccount)===window.__heroCanonical&&!('heroBattleSelection' in save);})()`),true,'roster polluted actual save');
  const shot=await c.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(OUT,`hero-roster-${width}.png`),Buffer.from(shot.data,'base64'));
  await tap('.hero-page-footer [onclick="openHomeFeature(\'rest\')"]');assert.equal(await c.eval(`!!document.querySelector('#homeFeatureModalBody #heroHomeEntry')&&!document.querySelector('.hero-panel')`),true,'rest modal lifecycle');
  await tap('#heroHomeEntry');await tap('#heroDetailsTab');const detail=await c.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(OUT,`hero-details-${width}.png`),Buffer.from(detail.data,'base64'));
  await c.eval(`closeHomeFeature();true`);assert.equal(await c.eval(`document.getElementById('homeFeatureModal').classList.contains('show')`),false);
  assert.deepEqual(await c.eval(`window.__heroQaErrors`),[]);
  evidence.push({width,height,geometry,realTouch:true,roster:[0,1,2],threeSlots:true,battleGuard:true,actualSaveUnchanged:true});console.log(`PASS hero page ${width}x${height}`);
 }
 fs.writeFileSync(path.join(OUT,'evidence.json'),JSON.stringify({passed:true,environment:live?'deployed-dev':'production-local',sha:process.env.EXPECTED_COMMIT_SHA||process.env.GITHUB_SHA||null,evidence},null,2)+'\n');
}catch(error){if(c)try{const shot=await c.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(OUT,'failure.png'),Buffer.from(shot.data,'base64'));}catch{}fs.writeFileSync(path.join(OUT,'evidence.json'),JSON.stringify({passed:false,error:String(error.stack||error),evidence},null,2)+'\n');throw error;
}finally{
 c?.close();server?.server.close();if(proc){proc.kill('SIGTERM');await Promise.race([new Promise(r=>proc.once('exit',r)),pause(3000)]);}
 if(profile&&path.resolve(profile).startsWith(OUT+path.sep))for(let i=0;i<5;i++)try{fs.rmSync(profile,{recursive:true,force:true});break;}catch{await pause(250);}
}
