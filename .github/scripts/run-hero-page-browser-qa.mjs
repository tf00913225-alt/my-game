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
let account=Core.normalizeAccountState(),formation=null,revision=1,pills=5,dailyClaimed=false;const receipts=new Map(),loginClaims=new Set();
for(const id of ids){account.heroes[id].unlocked=true;account.heroes[id].specificFragments=500;}
const view=()=>({schemaVersion:1,ownerUid:uid,serverRevision:revision,heroAccount:account,formation,playerIndexes:[0],marrowPills:pills,loginRewards:[3,7].map((day,i)=>({day,heroId:ids[i],fragments:25,marrowPills:1,eligible:true,claimed:loginClaims.has(day)})),dailySupply:{periodDate:'20261018',fragments:{divineDogHongbao:5,vajraHeavenlyKing:5},marrowPills:1,claimed:dailyClaimed},authoritativeStateReady:false});
async function handleRequest(req,res){
 if(!req.url.startsWith('/__qa_hero/'))return false;
 let data;try{let raw='';for await(const chunk of req)raw+=chunk;data=raw?JSON.parse(raw):{};}catch{res.writeHead(400);res.end('{}');return true;}
 try{
  if(req.url.endsWith('/save')){
   if(data.fail)throw Error('fixture save refusal');
   const prior=receipts.get(data.operationId);
   if(prior){assert.deepEqual(data,prior);}
   else{
    assert.equal(data.expectedRevision,revision);const next=Policy.validate(data.formation,[0],ids);
    const removesHero=ids.some(id=>Object.hasOwn(formation?.heroIdToSlot||{},id)&&!Object.hasOwn(next.heroIdToSlot,id));
    formation=next;receipts.set(data.operationId,data);revision++;
    // Keep the committed removal response slower than the former 400ms gesture wait.
    if(removesHero)await pause(650);
   }
  }
  if(req.url.endsWith('/loginReward')){
   assert.ok([3,7].includes(data.milestoneDay));assert.equal(data.operationId,'hero-login-reward-v1-day'+data.milestoneDay);
   if(!loginClaims.has(data.milestoneDay)){
    assert.equal(data.expectedRevision,revision);const id=ids[data.milestoneDay===3?0:1];
    account=Core.createDomain(account,()=>[],()=>null,()=>null).addSpecificFragments(id,25);pills++;revision++;loginClaims.add(data.milestoneDay);
   }
  }
  if(req.url.endsWith('/dailySupply')){
   assert.equal(data.operationId,'hero-daily-supply-v1-20261018');assert.equal(data.periodDate,'20261018');
   if(!dailyClaimed){assert.equal(data.expectedRevision,revision);for(const id of ids)account=Core.createDomain(account,()=>[],()=>null,()=>null).addSpecificFragments(id,5);pills++;revision++;dailyClaimed=true;}
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
 ['claimHeroLoginReward',`const response=await fetch('/__qa_hero/loginReward',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(intent)});if(!response.ok)throw Object.assign(Error('QA rejected'),{code:'aborted'});const value=await response.json();if(window.__qaLoginLost){window.__qaLoginLost=false;throw Object.assign(Error('lost response'),{code:'unavailable'});}return value;`],
 ['readHeroGrowth',`return (await fetch('/__qa_hero/read')).json();`],
 ['claimHeroDailySupply',`const response=await fetch('/__qa_hero/dailySupply',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(intent)});if(!response.ok)throw Object.assign(Error('QA rejected'),{code:'aborted'});const value=await response.json();if(window.__qaDailyLost){window.__qaDailyLost=false;throw Object.assign(Error('lost response'),{code:'unavailable'});}return value;`],
 ['mutateHeroGrowth',`const response=await fetch('/__qa_hero/growth',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(intent)});if(!response.ok)throw Object.assign(Error('QA rejected'),{code:'aborted'});return response.json();`]]){
 const re=new RegExp(`export async function ${name}\\(\\)\\{[^}]*\\}`);
 assert.ok(re.test(cloudModule));cloudModule=cloudModule.replace(re,`export async function ${name}(${name.startsWith('save')||name.startsWith('mutate')||name.startsWith('claim')?'intent':''}){${body}}`);
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
 async function waitReady(){await c.eval(`(async()=>{const end=Date.now()+45000;while(Date.now()<end&&!(window.FourSymbolsStartupPolicy?.getState?.()==='READY'&&document.getElementById('startupLoader')?.hidden&&!document.getElementById('firebaseAuthOverlay')?.classList.contains('show')))await new Promise(r=>setTimeout(r,50));if(FourSymbolsStartupPolicy.getState()!=='READY')throw Error('startup not READY');await FourSymbolsHeroAcquisition.sync();await FourSymbolsHeroGrowth.read();await FourSymbolsTeamFormation.read();showPage('home');return true;})()`);await waitFormationIdle();}
 async function waitFormationIdle(){return c.eval(`(async()=>{const end=Date.now()+15000;while(FourSymbolsTeamFormation.getStatus().busy&&Date.now()<end)await new Promise(r=>setTimeout(r,50));const status=FourSymbolsTeamFormation.getStatus();if(status.busy)throw Error('formation synchronization did not finish '+JSON.stringify(status));return status;})()`);}
 async function point(selector){return c.eval(`(async()=>{const query=${JSON.stringify(selector)},root=query.startsWith('[data-')?document.querySelector('.v-fixed-formation-panel'):document;let n=root?.querySelector(query);if(!n||n.disabled)throw Error('unavailable '+query);if(!n.closest('.v-fixed-formation-panel'))n.scrollIntoView({block:'center',behavior:'instant'});await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));n=(query.startsWith('[data-')?document.querySelector('.v-fixed-formation-panel'):document)?.querySelector(query);if(!n?.isConnected)throw Error('formation/control detached during synchronization');const b=n.getBoundingClientRect(),x=b.left+b.width/2,y=b.top+b.height/2,h=document.elementFromPoint(x,y);if(!(h===n||n.contains(h)))throw Error('occluded '+query+' '+JSON.stringify({box:b.toJSON(),hit:h?.outerHTML.slice(0,250)}));return {x,y};})()`);}
 let mobile=true;
 async function press(p){if(mobile)await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p]});else await c.send('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',clickCount:1});}
 async function release(p){if(mobile)await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});else await c.send('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'left',clickCount:1});}
 async function tap(selector){
  const formationControl=selector.startsWith('[data-')||selector.includes('FourSymbolsTeamFormation.');
  if(formationControl)await waitFormationIdle();
  const p=await point(selector);await press(p);await release(p);await pause();if(formationControl)await waitFormationIdle();}
 async function drag(from,to){
  const before=await waitFormationIdle();assert.ok(before.ready&&!before.pending&&!before.error,JSON.stringify(before));
  const a=await point(from),b=await point(to);await press(a);for(let i=1;i<=8;i++){const p={x:a.x+(b.x-a.x)*i/8,y:a.y+(b.y-a.y)*i/8};if(mobile)await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[p]});else await c.send('Input.dispatchMouseEvent',{type:'mouseMoved',...p,button:'left',buttons:1});await pause(20);}await release(b);
  const after=await waitFormationIdle();assert.ok(after.ready&&!after.pending&&!after.error,JSON.stringify(after));}
 async function screenshot(name){fs.writeFileSync(path.join(OUT,name+'.png'),Buffer.from((await c.send('Page.captureScreenshot',{format:'png'})).data,'base64'));}
 for(const [width,height] of [[360,640],[412,915],[1280,800]]){
  mobile=width<600;
  await c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile,screenWidth:width,screenHeight:height});
  await c.send('Emulation.setTouchEmulationEnabled',{enabled:mobile});
  if(width===360){const n=await c.send('Page.navigate',{url:server.url});const end=Date.now()+45000;while(!loads.has(n.loaderId)&&Date.now()<end)await pause(50);assert.ok(loads.has(n.loaderId));await waitReady();}
  await c.eval(`closeHomeFeature();openHomeFeature('hero');true`);await pause();
  assert.equal(await c.eval(`document.querySelectorAll('.hero-card').length`),2);
  assert.equal(await c.eval(`document.querySelectorAll('.hero-login-reward').length`),2);
  if(width===360){
   const dailyBefore=await c.eval(`({fragments:Object.fromEntries(Object.entries(FourSymbolsHeroGrowth.getAccount().heroes).map(([id,h])=>[id,h.specificFragments])),pills:FourSymbolsHeroGrowth.getStatus().marrowPills})`);
   await c.eval(`window.__qaDailyLost=true;true`);await tap('[onclick="FourSymbolsHeroGrowth.claimDailySupply()"]');
   assert.equal(await c.eval(`FourSymbolsHeroGrowth.getStatus().pending.periodDate`),'20261018');
   await tap('[onclick="FourSymbolsHeroGrowth.retry()"]');
   assert.equal(await c.eval(`FourSymbolsHeroGrowth.getStatus().pending`),null);
   for(const id of ids)assert.equal(await c.eval(`FourSymbolsHeroGrowth.getAccount().heroes[${JSON.stringify(id)}].specificFragments`),dailyBefore.fragments[id]+5);
   assert.equal(await c.eval(`FourSymbolsHeroGrowth.getStatus().marrowPills`),dailyBefore.pills+1);
   await screenshot('hero-daily-supply-'+width);
   const before=await c.eval(`FourSymbolsHeroGrowth.getAccount().heroes.divineDogHongbao.specificFragments`);
   await c.eval(`window.__qaLoginLost=true;true`);await tap('[onclick="FourSymbolsHeroGrowth.claimLoginReward(3)"]');
   assert.equal(await c.eval(`FourSymbolsHeroGrowth.getStatus().pending.milestoneDay`),3);
   await tap('[onclick="FourSymbolsHeroGrowth.retry()"]');
   assert.equal(await c.eval(`FourSymbolsHeroGrowth.getStatus().pending`),null);
   assert.equal(await c.eval(`FourSymbolsHeroGrowth.getAccount().heroes.divineDogHongbao.specificFragments`),before+25);
   await tap('[onclick="FourSymbolsHeroGrowth.claimLoginReward(7)"]');
   assert.deepEqual(await c.eval(`FourSymbolsHeroGrowth.getStatus().loginRewards.map(row=>row.claimed)`),[true,true]);
   await screenshot('hero-login-rewards-'+width);
  }
  assert.equal(await c.eval(`document.querySelectorAll('.hero-login-reward button:disabled').length`),2);
  assert.equal(await c.eval(`document.querySelector('[onclick="FourSymbolsHeroGrowth.claimDailySupply()"]').disabled`),true);
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
  // The actual shared detail, comparison and equip button must remain usable
  // above the Hero page. No direct calls to the transfer Owner here.
  const gear=await c.eval(`(()=>{let item=inventoryItems.find(i=>i.type==='weapon');if(!item){item=FourSymbolsEquipmentFactory.starter('ironSword');inventoryItems.push(item);saveGame();refreshHeroPage(true);}return {uid:item.v141Uid,heroAttack:getHeroPageSnapshot().heroes[0].stats.attack};})()`);
  await tap('.hero-equipment-bag [data-uid="'+gear.uid+'"]');
  assert.equal(await c.eval(`getEquipmentSelection().heroId`),ids[0]);
  await tap('#itemEquipButton');
  assert.equal(await c.eval(`characterEquipment['heroNpc:divineDogHongbao'].hand?.v141Uid`),gear.uid);
  assert.equal(await c.eval(`inventoryItems.some(i=>i.v141Uid===${JSON.stringify(gear.uid)})`),false);
  assert.ok(await c.eval(`getHeroPageSnapshot().heroes[0].stats.attack`)>gear.heroAttack);
  assert.equal(await c.eval(`FourSymbolsEquipmentFactory.validateOwnership(inventoryItems,characterEquipment)`),true);
  await screenshot('hero-equipment-'+width);
  if(width===360){
   // Exercise the actual saved-byte reader/hydration Owner in the admitted UID
   // session. Reloading a dirty QA account is intentionally blocked by the
   // independent historical Cloud admission Gate; never weaken that Gate.
   assert.equal(await c.eval(`(()=>{const saved=FourSymbolsAccountSave.readForUid(${JSON.stringify(uid)}).save;characterEquipment['heroNpc:divineDogHongbao'].hand=null;return loadGame(saved);})()`),true);
   assert.equal(await c.eval(`characterEquipment['heroNpc:divineDogHongbao'].hand?.v141Uid`),gear.uid,'same UID hydrate restores the physical Hero loadout');
   assert.equal(await c.eval(`FourSymbolsEquipmentFactory.validateOwnership(inventoryItems,characterEquipment)`),true);
   await c.eval(`openHomeFeature('hero');selectHeroPage('divineDogHongbao');true`);await pause();
  }
  await tap('.hero-equipment-slots [data-slot="hand"]');await tap('#itemEquipButton');
  assert.equal(await c.eval(`characterEquipment['heroNpc:divineDogHongbao'].hand`),null);
  assert.equal(await c.eval(`inventoryItems.some(i=>i.v141Uid===${JSON.stringify(gear.uid)})`),true);

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
  const beforeSwap=await c.eval('FourSymbolsTeamFormation.getConfirmed()');
  await drag('[data-unit="hero:divineDogHongbao"].v-fixed-formation-slot','[data-unit="hero:vajraHeavenlyKing"].v-fixed-formation-slot');
  const afterSwap=await c.eval('FourSymbolsTeamFormation.getConfirmed()');
  assert.equal(afterSwap.heroIdToSlot.divineDogHongbao,beforeSwap.heroIdToSlot.vajraHeavenlyKing);
  assert.equal(afterSwap.heroIdToSlot.vajraHeavenlyKing,beforeSwap.heroIdToSlot.divineDogHongbao);
  assert.equal(await c.eval(`document.querySelectorAll('.formation-drag-preview').length`),0);
  const saved=await c.eval(`FourSymbolsTeamFormation.getConfirmed()`);assert.equal(new Set([...Object.values(saved.characterIndexToSlot),...Object.values(saved.heroIdToSlot)]).size,3);
  assert.equal(await c.eval(`FourSymbolsBattlefieldSlots.getAllySlotForCharacter(3)`),Object.entries(saved.heroIdToSlot).sort((a,b)=>Policy.slots.indexOf(a[1])-Policy.slots.indexOf(b[1]))[0][1]);
  const fgeo=await c.eval(`(()=>{const box=document.querySelector('.formation-panel').getBoundingClientRect(),n=document.getElementById('formationContent');return {box:box.toJSON(),overflow:n.scrollWidth-n.clientWidth,verticalOverflow:n.scrollHeight-n.clientHeight,scrollTop:n.scrollTop,bg:getComputedStyle(document.querySelector('.formation-battlefield')).backgroundImage};})()`);
  assert.ok(fgeo.box.right<=width+1&&fgeo.box.bottom<=height+1&&fgeo.overflow<=1,JSON.stringify(fgeo));assert.match(fgeo.bg,/forest\.jpg/);
  assert.ok(Math.abs(fgeo.box.width/fgeo.box.height-9/16)<0.002,JSON.stringify(fgeo));
  assert.ok(fgeo.verticalOverflow<=1&&fgeo.scrollTop===0,JSON.stringify(fgeo));
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
  await c.eval(`closeHomeFeature();showPage('inventory');selectInventoryCharacter(3);true`);await pause();
  const backpack=await c.eval(`(()=>{const character=getBackpackCharacter(inventoryCharacterIndex),img=document.querySelector('.v131-inventory-portrait');return {kind:character?.combatantKind,id:character?.heroId,key:getBackpackEquipmentKey(inventoryCharacterIndex),src:img?.getAttribute('src'),count:getBackpackPartyCharacters().filter(Boolean).length};})()`);
  assert.equal(backpack.kind,'heroNpc');assert.equal(backpack.key,'heroNpc:'+backpack.id);assert.match(backpack.src,/assets\/heroes\/.*\.webp/);assert.equal(backpack.count,3);
  const backpackGear=await c.eval(`(()=>{let item=inventoryItems.find(i=>i.type==='weapon');if(!item){item=FourSymbolsEquipmentFactory.starter('ironSword');inventoryItems.push(item);saveGame();renderInventory();}return {uid:item.v141Uid,index:getFilteredInventoryItems().indexOf(item)};})()`);
  await tap('#inventoryGrid .inventory-item:nth-child('+(backpackGear.index+1)+')');await tap('#itemEquipButton');
  assert.equal(await c.eval(`characterEquipment[getBackpackEquipmentKey(inventoryCharacterIndex)].hand?.v141Uid`),backpackGear.uid);
  await tap('#equipmentGrid .inventory-equipment-cell:nth-child(2) .inventory-equipment-slot');await tap('#itemEquipButton');
  assert.equal(await c.eval(`characterEquipment[getBackpackEquipmentKey(inventoryCharacterIndex)].hand`),null);
  await c.eval(`showPage('home');closeHomeFeature();true`);assert.deepEqual(await c.eval(`window.__heroQaErrors`),[]);
  evidence.push({width,height,grid,geo,fgeo,actualPointerInput:true,saveReload:true,swapRemove:true,sharedEntrances:true});console.log(`PASS Hero V2 ${width}x${height}`);
 }
 account=Core.normalizeAccountState();
 await c.eval(`window.__heroQaOwned=[];FourSymbolsHeroAcquisition.sync()`);await c.eval(`FourSymbolsHeroGrowth.read()`);
 await c.eval(`openHomeFeature('hero');true`);await pause();
 assert.equal(await c.eval(`document.querySelectorAll('.hero-card').length`),0);
 assert.equal(await c.eval(`document.querySelectorAll('.hero-login-reward').length`),2,'rewards accessible without owned Heroes');
 assert.equal(await c.eval(`document.querySelector('[aria-label="英雄每日補給"]')!==null`),true,'daily supply accessible without owned Heroes');
 fs.writeFileSync(path.join(OUT,'evidence.json'),JSON.stringify({passed:true,environment:process.env.DEV_BASE_URL?'deployed-bytes-isolated-transport':'production-local',sha:process.env.EXPECTED_COMMIT_SHA||process.env.GITHUB_SHA||execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),evidence},null,2)+'\n');
}catch(error){if(c)try{fs.writeFileSync(path.join(OUT,'failure.png'),Buffer.from((await c.send('Page.captureScreenshot',{format:'png'})).data,'base64'));}catch{}fs.writeFileSync(path.join(OUT,'evidence.json'),JSON.stringify({passed:false,error:String(error.stack||error),evidence},null,2));throw error;
}finally{
 c?.close();server?.server.close();if(proc){proc.kill('SIGTERM');await Promise.race([new Promise(r=>proc.once('exit',r)),pause(3000)]);}
 if(profile&&path.resolve(profile).startsWith(OUT+path.sep))for(let i=0;i<5;i++)try{fs.rmSync(profile,{recursive:true,force:true});break;}catch{await pause(250);}
}
