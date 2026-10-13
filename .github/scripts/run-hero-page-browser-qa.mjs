import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {ASSET_MANIFEST,findChrome,startServer,waitJson,Cdp,qaPrelude,QA_CLOUD_MODULE} from './runtime-browser-qa-support.mjs';
const require=createRequire(import.meta.url),Core=require('../../functions/src/hero-core'),Policy=require('../../functions/src/team-formation-policy');
const OUT=path.resolve('artifacts/browser-qa/responsive-item/hero'),uid='skill-runtime-browser-qa',ids=['divineDogHongbao','vajraHeavenlyKing'];
const pause=(ms=250)=>new Promise(r=>setTimeout(r,ms));
fs.mkdirSync(OUT,{recursive:true});
let server,proc,c,profile;const evidence=[];
let account=Core.normalizeAccountState(),formation=null,revision=1,pills=5;const receipts=new Map();
for(const id of ids){account.heroes[id].unlocked=true;account.heroes[id].specificFragments=500;}
const view=()=>({schemaVersion:1,ownerUid:uid,serverRevision:revision,heroAccount:account,formation,playerIndexes:[0],marrowPills:pills,authoritativeStateReady:false});
async function handleRequest(req,res){
 if(!req.url.startsWith('/__qa_hero/'))return false;
 let data;try{let raw='';for await(const chunk of req)raw+=chunk;data=raw?JSON.parse(raw):{};}catch{res.writeHead(400);res.end('{}');return true;}
 try{
  if(req.url.endsWith('/save')){
   if(data.fail)throw Error('fixture save refusal');
   const prior=receipts.get(data.operationId);
   if(prior){assert.deepEqual(data,prior);}
   else{assert.equal(data.expectedRevision,revision);formation=Policy.validate(data.formation,[0],ids);receipts.set(data.operationId,data);revision++;}
  }
  if(req.url.endsWith('/growth')){
   assert.equal(data.expectedRevision,revision);const d=Core.createDomain(account,()=>[],()=>null,()=>null);
   account=data.action==='starUp'?d.starUpHero(data.heroId):data.action==='reroll'?d.rerollHeroAllocation(data.heroId,12345,pills):d.unlockHero(data.heroId,12345);
   if(data.action==='reroll')pills--;revision++;
  }
  res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify(view()));
 }catch(error){res.writeHead(409,{'content-type':'application/json'});res.end(JSON.stringify({error:String(error)}));}
 return true;
}
let cloudModule=QA_CLOUD_MODULE;
for(const [name,body] of [
 ['readTeamFormation',`return (await fetch('/__qa_hero/read')).json();`],
 ['saveTeamFormation',`const response=await fetch('/__qa_hero/save',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...intent,fail:!!window.__qaFormationFail})});if(!response.ok)throw Object.assign(Error('QA rejected'),{code:'aborted'});const value=await response.json();if(window.__qaFormationLost){window.__qaFormationLost=false;throw Object.assign(Error('lost response'),{code:'unavailable'});}return value;`],
 ['readHeroGrowth',`return (await fetch('/__qa_hero/read')).json();`],
 ['mutateHeroGrowth',`const response=await fetch('/__qa_hero/growth',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(intent)});if(!response.ok)throw Object.assign(Error('QA rejected'),{code:'aborted'});return response.json();`]]){
 const re=new RegExp(`export async function ${name}\\(\\)\\{[^}]*\\}`);
 assert.ok(re.test(cloudModule));cloudModule=cloudModule.replace(re,`export async function ${name}(${name.startsWith('save')||name.startsWith('mutate')?'intent':''}){${body}}`);
}
try{
 const live=process.env.DEV_BASE_URL;
 if(live){
  assert.equal(new URL(live).hostname,'dev.four-symbols-dev.pages.dev');assert.ok(process.env.EXPECTED_COMMIT_SHA);
  assert.equal((await (await fetch(new URL('release-manifest.json',live))).json()).commitSha,process.env.EXPECTED_COMMIT_SHA);
  assert.deepEqual(await (await fetch(new URL('build/asset-manifest.json',live))).json(),ASSET_MANIFEST);
 }
 server=await startServer({baseUrl:live,cloudModule,handleRequest});
 profile=fs.mkdtempSync(path.join(OUT,'profile-'));const chrome=findChrome(),port=10300+Math.floor(Math.random()*300);
 proc=spawn(chrome,['--headless=new','--no-sandbox','--disable-gpu',`--remote-debugging-port=${port}`,`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
 c=new Cdp((await waitJson(`http://127.0.0.1:${port}/json/list`)).find(t=>t.type==='page').webSocketDebuggerUrl);
 await c.send('Page.enable');await c.send('Runtime.enable');await c.send('Page.setLifecycleEventsEnabled',{enabled:true});
 const loads=new Set();c.ws.addEventListener('message',event=>{const m=JSON.parse(String(event.data));if(m.method==='Page.lifecycleEvent'&&m.params.name==='load')loads.add(m.params.loaderId);});
 await c.send('Page.addScriptToEvaluateOnNewDocument',{source:qaPrelude().replace(/^<script>|<\/script>$/g,'')+`;window.__heroQaOwned=${JSON.stringify(ids)};window.__heroQaErrors=[];addEventListener('error',e=>{if(e.message)window.__heroQaErrors.push(e.message)});`});
 async function waitReady(){await c.eval(`(async()=>{const end=Date.now()+45000;while(Date.now()<end&&!(window.FourSymbolsStartupPolicy?.getState?.()==='READY'&&document.getElementById('startupLoader')?.hidden&&!document.getElementById('firebaseAuthOverlay')?.classList.contains('show')))await new Promise(r=>setTimeout(r,50));if(FourSymbolsStartupPolicy.getState()!=='READY')throw Error('startup not READY');await FourSymbolsHeroAcquisition.sync();await FourSymbolsHeroGrowth.read();await FourSymbolsTeamFormation.read();showPage('home');return true;})()`);}
 async function point(selector){return c.eval(`(async()=>{const query=${JSON.stringify(selector)},root=query.startsWith('[data-')?document.querySelector('.v-fixed-formation-panel'):document;let n=root?.querySelector(query);if(!n||n.disabled)throw Error('unavailable '+query);n.scrollIntoView({block:'nearest'});await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));n=(query.startsWith('[data-')?document.querySelector('.v-fixed-formation-panel'):document)?.querySelector(query);if(!n?.isConnected)throw Error('formation/control detached during synchronization');const b=n.getBoundingClientRect(),x=b.left+b.width/2,y=b.top+b.height/2,h=document.elementFromPoint(x,y);if(!(h===n||n.contains(h)))throw Error('occluded '+query+' '+JSON.stringify({box:b.toJSON(),hit:h?.outerHTML.slice(0,250)}));return {x,y};})()`);}
 let mobile=true;
 async function press(p){if(mobile)await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p]});else await c.send('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',clickCount:1});}
 async function release(p){if(mobile)await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});else await c.send('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'left',clickCount:1});}
 async function tap(selector){
  if(selector.startsWith('[data-'))await c.eval(`(async()=>{const end=Date.now()+15000;while(FourSymbolsTeamFormation.getStatus().busy&&Date.now()<end)await new Promise(r=>setTimeout(r,50));if(FourSymbolsTeamFormation.getStatus().busy)throw Error('formation synchronization did not finish');return true;})()`);
  const p=await point(selector);await press(p);await release(p);await pause();}
 async function drag(from,to){const a=await point(from),b=await point(to);await press(a);for(let i=1;i<=8;i++){const p={x:a.x+(b.x-a.x)*i/8,y:a.y+(b.y-a.y)*i/8};if(mobile)await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[p]});else await c.send('Input.dispatchMouseEvent',{type:'mouseMoved',...p,button:'left',buttons:1});await pause(20);}await release(b);await pause(400);}
 async function screenshot(name){fs.writeFileSync(path.join(OUT,name+'.png'),Buffer.from((await c.send('Page.captureScreenshot',{format:'png'})).data,'base64'));}
 for(const [width,height] of [[360,640],[412,915],[1280,800]]){
  mobile=width<600;
  await c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile,screenWidth:width,screenHeight:height});
  await c.send('Emulation.setTouchEmulationEnabled',{enabled:mobile});
  if(width===360){const n=await c.send('Page.navigate',{url:server.url});const end=Date.now()+45000;while(!loads.has(n.loaderId)&&Date.now()<end)await pause(50);assert.ok(loads.has(n.loaderId));await waitReady();}
  await c.eval(`closeHomeFeature();openHomeFeature('hero');true`);await pause();
  assert.equal(await c.eval(`document.querySelectorAll('.hero-card').length`),2);
  const grid=await c.eval(`(()=>{const n=document.querySelector('.hero-card-grid');return {columns:getComputedStyle(n).gridTemplateColumns.split(' ').length,overflow:n.scrollWidth-n.clientWidth};})()`);
  assert.equal(grid.columns,3);assert.ok(grid.overflow<=1);assert.equal(await c.eval(`document.querySelectorAll('.hero-element-tabs button').length`),5);
  await tap(`[onclick="filterHeroPage('fire')"]`);assert.equal(await c.eval(`document.querySelectorAll('.hero-card').length`),1);
  await tap('.hero-card');assert.equal(await c.eval(`document.querySelector('.hero-profile h3').textContent`),'神犬紅包');
  assert.ok(await c.eval(`document.querySelector('.hero-page-content').textContent.includes('怒氣技能')`));
  const image=await c.eval(`(async()=>{const n=document.querySelector('.hero-profile img');await n.decode();return {w:n.naturalWidth,h:n.naturalHeight,fit:getComputedStyle(n).objectFit};})()`);
  assert.deepEqual(image,{w:1086,h:1448,fit:'contain'});
  const geo=await c.eval(`(()=>{const b=document.querySelector('.hero-panel').getBoundingClientRect(),n=document.getElementById('heroPageContent');return {box:b.toJSON(),overflow:n.scrollWidth-n.clientWidth,minFont:Math.min(...Array.from(document.querySelectorAll('.hero-page-shell p,.hero-page-shell small,.hero-page-shell button'),n=>parseFloat(getComputedStyle(n).fontSize)))};})()`);
  assert.ok(geo.box.left>=0&&geo.box.right<=width+1&&geo.box.top>=0&&geo.box.bottom<=height+1&&geo.overflow<=1,JSON.stringify(geo));assert.ok(geo.minFont>=13);
  await screenshot('hero-details-'+width);
  if(width===360){
   await c.eval(`FourSymbolsHeroGrowth.read()`);await tap('[onclick*="HeroGrowth.mutate"][onclick*="starUp"]');assert.equal(await c.eval(`FourSymbolsHeroGrowth.getAccount().heroes.divineDogHongbao.stars`),1);
   await c.eval(`FourSymbolsTeamFormation.read()`);
  }
  await tap('.hero-detail-back');assert.equal(await c.eval(`heroPageElement`),'fire');
  await tap(`[onclick="filterHeroPage('all')"]`);await screenshot('hero-overview-'+width);
  await tap(`[onclick="openSharedFormation('hero')"]`);
  assert.equal(await c.eval(`document.querySelectorAll('.v-fixed-formation-slot').length`),6);
  if(width===360){
   await tap('[data-unit="hero:divineDogHongbao"].formation-candidate');await tap('[data-slot="ALLY_B2"]');
   await tap('[data-unit="hero:vajraHeavenlyKing"].formation-candidate');await tap('[data-slot="ALLY_B3"]');
   assert.equal(await c.eval(`FourSymbolsTeamFormation.getConfirmed().heroIdToSlot.divineDogHongbao`),'ALLY_B2');
  }
  await drag('[data-unit="hero:divineDogHongbao"].v-fixed-formation-slot','[data-unit="hero:vajraHeavenlyKing"].v-fixed-formation-slot');
  assert.equal(await c.eval(`document.querySelectorAll('.formation-drag-preview').length`),0);
  const saved=await c.eval(`FourSymbolsTeamFormation.getConfirmed()`);assert.equal(new Set([...Object.values(saved.characterIndexToSlot),...Object.values(saved.heroIdToSlot)]).size,3);
  assert.equal(await c.eval(`FourSymbolsBattlefieldSlots.getAllySlotForCharacter(3)`),Object.entries(saved.heroIdToSlot).sort((a,b)=>Policy.slots.indexOf(a[1])-Policy.slots.indexOf(b[1]))[0][1]);
  const fgeo=await c.eval(`(()=>{const box=document.querySelector('.formation-panel').getBoundingClientRect(),n=document.getElementById('formationContent');return {box:box.toJSON(),overflow:n.scrollWidth-n.clientWidth,bg:getComputedStyle(document.querySelector('.formation-battlefield')).backgroundImage};})()`);
  assert.ok(fgeo.box.right<=width+1&&fgeo.box.bottom<=height+1&&fgeo.overflow<=1,JSON.stringify(fgeo));assert.match(fgeo.bg,/forest\.jpg/);
  await screenshot('formation-'+width);
  if(width===360){
   const before=await c.eval(`JSON.stringify(FourSymbolsTeamFormation.getConfirmed())`);
   await c.eval(`window.__qaFormationFail=true;true`);await tap('[data-unit="hero:divineDogHongbao"].v-fixed-formation-slot');await tap('[data-slot="ALLY_F1"]');
   assert.equal(await c.eval(`JSON.stringify(FourSymbolsTeamFormation.getConfirmed())`),before);assert.ok(await c.eval(`FourSymbolsTeamFormation.getStatus().error`));
   await c.eval(`window.__qaFormationFail=false;FourSymbolsTeamFormation.read()`);
   await c.eval(`window.__qaFormationLost=true;true`);await tap('[data-unit="hero:divineDogHongbao"].v-fixed-formation-slot');await tap('[data-slot="ALLY_F3"]');
   assert.equal(await c.eval(`JSON.stringify(FourSymbolsTeamFormation.getConfirmed())`),before);assert.ok(await c.eval(`FourSymbolsTeamFormation.getStatus().pending`));
   await tap('[onclick="FourSymbolsTeamFormation.retry()"]');assert.equal(await c.eval(`FourSymbolsTeamFormation.getStatus().pending`),null);
   const after=await c.eval(`JSON.stringify(FourSymbolsTeamFormation.getConfirmed())`);
   // A fresh isolated device must read the protected server formation, rather
   // than bypass the existing dirty-character migration/publication gate.
   await c.send('Storage.clearDataForOrigin',{origin:new URL(server.url).origin,storageTypes:'local_storage,cache_storage'});
   await c.send('Page.reload',{ignoreCache:true});await pause(500);await waitReady();
   assert.equal(await c.eval(`JSON.stringify(FourSymbolsTeamFormation.getConfirmed())`),after,'new page restores confirmed server formation');
   await c.eval(`openSharedFormation('hero');true`);await pause();
  }
  await drag('[data-unit="hero:divineDogHongbao"].v-fixed-formation-slot','[data-remove]');
  assert.equal(await c.eval(`Object.hasOwn(FourSymbolsTeamFormation.getConfirmed().heroIdToSlot,'divineDogHongbao')`),false);
  await tap('[data-unit="hero:divineDogHongbao"].formation-candidate');await tap('[data-slot="ALLY_B2"]'); // If occupied, use next free slot.
  if(!await c.eval(`Object.hasOwn(FourSymbolsTeamFormation.getConfirmed().heroIdToSlot,'divineDogHongbao')`))await tap('[data-slot="ALLY_B1"]');
  await tap(`[onclick="returnFromFormation()"]`);assert.equal(await c.eval(`!!document.querySelector('.hero-card-grid')`),true);
  await c.eval(`closeHomeFeature();true`);await tap('.v-fixed-formation-entry');assert.equal(await c.eval(`!!document.querySelector('.formation-battlefield')`),true);
  assert.equal(await c.eval(`battleActive`),false,'preview must not start battle');
  await c.eval(`closeHomeFeature();true`);assert.deepEqual(await c.eval(`window.__heroQaErrors`),[]);
  evidence.push({width,height,grid,geo,fgeo,actualPointerInput:true,saveReload:true,swapRemove:true,sharedEntrances:true});console.log(`PASS Hero V2 ${width}x${height}`);
 }
 fs.writeFileSync(path.join(OUT,'evidence.json'),JSON.stringify({passed:true,environment:process.env.DEV_BASE_URL?'deployed-bytes-isolated-transport':'production-local',sha:process.env.EXPECTED_COMMIT_SHA||process.env.GITHUB_SHA||execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),evidence},null,2)+'\n');
}catch(error){if(c)try{fs.writeFileSync(path.join(OUT,'failure.png'),Buffer.from((await c.send('Page.captureScreenshot',{format:'png'})).data,'base64'));}catch{}fs.writeFileSync(path.join(OUT,'evidence.json'),JSON.stringify({passed:false,error:String(error.stack||error),evidence},null,2));throw error;
}finally{
 c?.close();server?.server.close();if(proc){proc.kill('SIGTERM');await Promise.race([new Promise(r=>proc.once('exit',r)),pause(3000)]);}
 if(profile&&path.resolve(profile).startsWith(OUT+path.sep))for(let i=0;i<5;i++)try{fs.rmSync(profile,{recursive:true,force:true});break;}catch{await pause(250);}
}
