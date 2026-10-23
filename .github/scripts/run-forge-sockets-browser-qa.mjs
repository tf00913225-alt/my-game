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
 const artSource=v17346GenerateEquipment(()=>.2,{slot:'armor',classType:'warrior',rarity:'orange'});
 if(!artSource.icon)throw Error('formal armor art missing');
 const gear={id:'forge-qa-orange',v141Uid:'forge-qa-orange',name:'鍛造測試橙裝',type:'armor',rarityKey:'orange',tierKey:'orange',count:1,stats:{attack:5},icon:artSource.icon};
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
  url=new URL('index.html',process.env.DEV_BASE_URL.replace(/\/$/,'')+'/').href;
  assert.ok(process.env.EXPECTED_COMMIT_SHA,'live QA requires deployment SHA');
  const release=await (await fetch(new URL('release-manifest.json',url),{cache:'no-store'})).json();assert.equal(release.commitSha,process.env.EXPECTED_COMMIT_SHA,'deployed SHA mismatch');
  const manifest=await (await fetch(new URL('build/asset-manifest.json',url),{cache:'no-store'})).json();assert.deepEqual(manifest,ASSET_MANIFEST,'deployed bundles mismatch');
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
 c.ws.addEventListener('message',event=>{const m=JSON.parse(String(event.data));if(m.method==='Fetch.requestPaused'){const p=m.params,pathname=new URL(p.request.url).pathname;if(holdGameplay&&/\/build\/gameplay-core-(primary|secondary)\.[0-9a-f]{12}\.js$/.test(pathname)){heldGameplay.push(p.requestId);return;}const body=stubs.get('/'+pathname.slice(new URL('.',url).pathname.length));c.send(body?'Fetch.fulfillRequest':'Fetch.continueRequest',body?{requestId:p.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'text/javascript'}],body:Buffer.from(body).toString('base64')}:{requestId:p.requestId}).catch(error=>console.error(error));}});
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
 const viewports=JSON.parse(process.env.FORGE_QA_VIEWPORTS||'[[360,640],[393,873],[412,915],[1280,960]]');
 let firstViewport=true;
 async function captureReforge(state,width,height){
  const reading=await c.eval(`(()=>{const root=document.querySelector('#homeFeatureModal'),body=root.querySelector('.v141-synthesis-body'),footer=root.querySelector('.v141-smelting-footer');const scale=e=>e.getBoundingClientRect().width/e.offsetWidth;const texts=[];const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);while(walker.nextNode()){const n=walker.currentNode,e=n.parentElement,r=e.getBoundingClientRect(),s=getComputedStyle(e);if(!n.textContent.trim()||!r.width||!r.height||s.visibility==='hidden'||e.closest('[aria-hidden="true"]'))continue;let box=e;while(box&&!box.offsetWidth)box=box.parentElement;texts.push({text:n.textContent.trim(),font:parseFloat(s.fontSize)*(box?scale(box):1)});}const controls=[...root.querySelectorAll('button,summary')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.height}).map(e=>{const r=e.getBoundingClientRect(),visible=r.top>=0&&r.bottom<=innerHeight;const hit=visible?document.elementFromPoint(r.left+r.width/2,r.top+r.height/2):null;return {text:e.textContent.trim(),disabled:e.disabled===true,visible,hit:!!hit&&(e===hit||e.contains(hit)),height:r.height};});const f=footer.getBoundingClientRect();return {texts,controls,scrollOwners:root.querySelectorAll('.v141-synthesis-body[data-scroll-owner="y"]').length,overflow:body.scrollWidth-body.clientWidth,footer:{top:f.top,bottom:f.bottom},bodyScrollTop:body.scrollTop};})()`);
  assert.ok(reading.texts.length&&reading.texts.every(x=>x.font>=12.9),state+' text below minimum '+JSON.stringify(reading.texts.filter(x=>x.font<12.9)));
  reading.scrollOwners=await c.eval(`Array.from(document.querySelectorAll('#homeFeatureModal .v141-synthesis-body')).filter(e=>getComputedStyle(e).overflowY==='auto').length`);
  assert.equal(reading.scrollOwners,1,state+' must retain one content scroll owner');
  assert.ok(reading.overflow<=1&&reading.footer.top>=0&&reading.footer.bottom<=height+1,state+' content/footer escapes viewport');
  reading.controls=await c.eval(`Array.from(document.querySelectorAll('#homeFeatureModal button,#homeFeatureModal summary')).filter(e=>e.checkVisibility()&&!(e.closest('details:not([open])')&&e.tagName!=='SUMMARY')).map(e=>{const r=e.getBoundingClientRect(),b=e.closest('.v141-synthesis-body')?.getBoundingClientRect(),strip=e.closest('[data-scroll-owner="x"]')?.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,visible=r.width>0&&r.height>0&&r.top>=0&&r.bottom<=innerHeight&&(!b||(y>=b.top&&y<=b.bottom))&&(!strip||(r.left>=strip.left&&r.right<=strip.right)),hit=visible?document.elementFromPoint(x,y):null;return {text:e.textContent.trim(),disabled:e.disabled===true,visible,hit:!!hit&&(e===hit||e.contains(hit)),height:r.height};})`);
  assert.ok(reading.controls.filter(x=>x.visible&&!x.disabled).every(x=>x.hit),state+' visible controls covered '+JSON.stringify(reading.controls));
  const shot=await c.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(OUT,`reforge-${state}-${width}x${height}.png`),Buffer.from(shot.data,'base64'));
  evidence.push({scene:state,width,height,reading});
 }
 async function assertCompactReforge(state){
  const layout=await c.eval(`(()=>{const b=document.querySelector('.v141-synthesis-body'),f=document.querySelector('.v141-smelting-footer');return {scroll:b.scrollHeight-b.clientHeight,top:b.scrollTop,clientHeight:b.clientHeight,scrollHeight:b.scrollHeight,bodyHeight:b.getBoundingClientRect().height,footerHeight:f.getBoundingClientRect().height};})()`);
  assert.ok(layout.scroll<=1,state+' ordinary two-slot reforge must fit without vertical scrolling '+JSON.stringify(layout));
  evidence.push({scene:'compact-'+state,...await c.eval(`({width:innerWidth,height:innerHeight})`),...layout});
  return layout;
 }
 for(const [width,height] of viewports){
  await c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true,screenWidth:width,screenHeight:height});
  if(firstViewport){await c.send('Page.navigate',{url});assert.equal(await c.eval(READY),true);}
  else{assert.equal(await c.eval(`FourSymbolsStartupPolicy.getState()`),'READY');await c.eval(`showPage('home');closeHomeFeature();true`);}
  // Use the same real READY runtime across viewport resizes, matching the
  // existing Responsive Item QA. Reloading a mutated local fixture against the
  // fixed read-only cloud transport correctly enters account conflict handling.
  // Enter through the actual home card before accessing the lazy runtime.
  if(firstViewport){
   assert.equal(await c.eval(`typeof v141SwitchForgeTab`),'undefined','cold entry was preloaded');
   // The same shared modal previously displayed an announcement. Its stale
   // content must never be reopened while the forge owner is still loading.
   await c.eval(`openHomeFeature('announcement');closeHomeFeature();true`);
  }
  await tap('[onclick="openHomeFeature(\'forge\')"]');
  if(firstViewport){
   assert.equal(await c.eval(`document.getElementById('homeFeatureModal').classList.contains('show')`),false,'cold forge reopened stale announcement before owner ready');
   assert.equal(await c.eval(`document.querySelector('[aria-label="鍛造"]').getAttribute('aria-busy')`),'true','first touch did not wait for the forge owner');
   assert.ok(heldGameplay.length,'cold entry did not exercise a delayed real gameplay script');
   holdGameplay=false;for(const requestId of heldGameplay.splice(0))await c.send('Fetch.continueRequest',{requestId});
  }
  await c.eval(`(async()=>{const end=Date.now()+10000;while(Date.now()<end&&typeof v141SwitchForgeTab!=='function')await new Promise(r=>setTimeout(r,50));return true;})()`);
  assert.equal(await c.eval(`typeof v141SwitchForgeTab`),'function');
  assert.equal(await c.eval(`document.getElementById('homeFeatureModal').classList.contains('show')`),true,'first touch did not open forge after loading');
  assert.equal(await c.eval(`document.getElementById('homeFeatureModalTitle').textContent`),'鍛造','forge retains its page identity across operation tabs');
  assert.deepEqual(await c.eval(`Array.from(document.querySelectorAll('.v141-forge-tabs button'),n=>n.textContent)`),['冶煉','鑲嵌']);
  assert.equal(await c.eval(FIXTURE),true);
  await c.eval(`v141SwitchForgeTab('reforge')`);
  await c.eval(`(()=>{const original=window.alert;try{window.alert=()=>{};v141SelectReforgeItem('');}finally{window.alert=original;}return true;})()`);
  assert.equal(await c.eval(`!!document.querySelector('.v141-reforge-current')`),false,'empty picker must have no selected equipment');
  await captureReforge('empty-selection',width,height);
  assert.equal(await c.eval(`document.querySelector('.v141-smelting-picker').tagName`),'DIV','reforge uses an always-visible equipment strip');
  assert.equal(await c.eval(`document.querySelectorAll('.v141-smelting-picker .v141-forge-options[data-scroll-owner="x"]').length`),1,'equipment strip owns horizontal scrolling');
  await captureReforge('equipment-strip',width,height);
  assert.deepEqual(await c.eval(`Array.from(document.querySelectorAll('.v141-forge-tabs button'),n=>n.textContent)`),['冶煉','鑲嵌']);
  assert.equal(await c.eval(`Array.from(document.querySelectorAll('#homeFeatureModalBody select')).filter(n=>{const r=n.getBoundingClientRect();return r.width&&r.height}).length`),0,'visible native selector in forge');
  // Reforge V2 exercises the final bundled owner with disposable local assets.
  await c.eval(`(()=>{const item=inventoryItems.find(i=>i.v141Uid==='forge-qa-orange');item.reforgeAffixes=[{stat:'attack',value:40},{stat:'attack',value:35}];item.reforgeVersion=1;item.reforgeSlots=2;const ore=v132GetContentDefinitions().ores.find(i=>i.tierKey==='white');inventoryItems.push({...ore,count:1000});gold=100000;saveGame();v141SelectReforgeItem(item.v141Uid);return true;})()`);
  assert.equal(await c.eval(`document.querySelectorAll('.v17358-affix-lock').length`),2);
  await captureReforge('selected',width,height);
  const stripDrag=await c.eval(`(()=>{const e=document.querySelector('.v141-smelting-picker .v141-forge-options');e.scrollLeft=0;const r=e.getBoundingClientRect();return {x:r.right-18,to:r.left+18,y:r.top+r.height/2,selected:e.querySelector('[aria-pressed="true"]').dataset.forgeValue};})()`);
  await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:stripDrag.x,y:stripDrag.y}]});
  for(let i=1;i<=8;i++){await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:stripDrag.x+(stripDrag.to-stripDrag.x)*i/8,y:stripDrag.y}]});await new Promise(r=>setTimeout(r,20));}
  await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await pause();
  assert.equal(await c.eval(`(async()=>{const e=document.querySelector('.v141-smelting-picker .v141-forge-options'),end=Date.now()+5000;let previous=e.scrollLeft,stable=Date.now();while(Date.now()<end){await new Promise(r=>setTimeout(r,50));if(Math.abs(e.scrollLeft-previous)>.5)stable=Date.now();previous=e.scrollLeft;if(Date.now()-stable>=300)return true;}return false;})()`),true,'equipment horizontal fling did not settle');
  const stripState=await c.eval(`(()=>{const e=document.querySelector('.v141-smelting-picker .v141-forge-options');return {scrollLeft:e.scrollLeft,selected:e.querySelector('[aria-pressed="true"]').dataset.forgeValue};})()`);
  assert.ok(stripState.scrollLeft>0,'equipment strip cannot touch scroll');assert.equal(stripState.selected,stripDrag.selected,'horizontal drag selected another equipment');
  await tap('.v141-smelting-picker [data-forge-value="forge-qa-19"]');
  assert.equal(await c.eval(`document.querySelector('.v141-smelting-picker [aria-pressed="true"]').dataset.forgeValue`),'forge-qa-19','last horizontal candidate is unreachable');
  const selectedVisible=await c.eval(`(()=>{const e=document.querySelector('.v141-smelting-picker [aria-pressed="true"]'),r=e.getBoundingClientRect(),rail=e.closest('.v141-forge-options').getBoundingClientRect();return {visible:r.left>=rail.left-1&&r.right<=rail.right+1,scrollLeft:e.parentElement.scrollLeft,left:r.left,right:r.right,railLeft:rail.left,railRight:rail.right};})()`);
  assert.ok(selectedVisible.visible,'selected last equipment disappeared after render '+JSON.stringify(selectedVisible));
  await tap('.v141-smelting-picker [data-forge-value="forge-qa-orange"]');
  evidence.push({scene:'equipment-strip-touch',width,height,...stripState,lastCandidateReachable:true,selectedVisible});
  await assertCompactReforge('selected');
  await tap('.v17358-reforge-tier:nth-child(2) .v141-smelting-tier-choice');
  assert.equal(await c.eval(`document.querySelector('.v141-smelting-footer .v141-synthesis-primary').disabled`),true,'missing material must disable reforge');
  await captureReforge('material-insufficient',width,height);
  await tap('.v17358-reforge-tier:first-child .v141-smelting-tier-choice');
  assert.deepEqual(await c.eval(`Array.from(document.querySelectorAll('.v17358-reforge-tier'),tile=>({tier:tile.querySelector('[data-tier]').dataset.tier,text:tile.querySelector('.v141-smelting-tier-choice').textContent}))`),[
   {tier:'white',text:'白階1000 / 50'},{tier:'blue',text:'藍階0 / 50'},
   {tier:'purple',text:'紫階0 / 50'},{tier:'orange',text:'橙階0 / 50'}]);
  assert.equal(await c.eval(`(()=>{const source=document.querySelector('.v141-reforge-material-source');return source.dataset.tier==='white'&&!!source.querySelector('.v169-item-art')&&source.getAttribute('aria-label').includes('獲取途徑');})()`),true,'selected material retains formal art and labeled source action');
  assert.equal(await c.eval(`document.querySelector('.v141-reforge-cost').textContent.includes('金幣 1,000')`),true);
  await tap('.v141-smelting-affix:first-child .v17358-affix-lock');
  assert.equal(await c.eval(`document.querySelector('.v17358-affix-lock').getAttribute('aria-pressed')`),'true');
  await captureReforge('locked',width,height);
  await assertCompactReforge('locked');
  await c.eval(`window.__forgeQaRandom=Math.random;Math.random=()=>0;true`);
  await tap('.v141-smelting-footer .v141-synthesis-primary');
  await c.eval(`Math.random=window.__forgeQaRandom;delete window.__forgeQaRandom;true`);
  assert.equal(await c.eval(`document.querySelectorAll('.v141-smelting-affix').length`),2,'single result preserves both slot rows');
  assert.equal(await c.eval(`!!document.querySelector('.v141-reforge-compare')`),false,'no comparison panel');
  assert.deepEqual(await c.eval(`Array.from(document.querySelectorAll('.v141-reforge-old-value'),e=>e.textContent)`),['原：攻擊 +40','原：攻擊 +35'],'pending keeps original values visible');
  assert.deepEqual(await c.eval(`Array.from(document.querySelectorAll('.v141-smelting-affix>b'),e=>e.textContent)`),['新：攻擊 +40','新：攻擊 +10'],'pending shows exact new values');
  await captureReforge('pending-old-new',width,height);
  await assertCompactReforge('pending');
  assert.equal(await c.eval(`(()=>{const before=JSON.stringify({inventoryItems,gold}),value=document.querySelector('.v141-reforge-current').textContent;v141SelectReforgeItem('forge-qa-19');v141SelectReforgeMaterialTier('blue');v141ToggleReforgeLock(1);const blocked=v141StartReforge()===false;return blocked&&before===JSON.stringify({inventoryItems,gold})&&document.querySelector('.v141-reforge-current').textContent===value&&Array.from(document.querySelectorAll('.v141-smelting-picker [data-forge-value],.v141-smelting-tier-choice,.v17358-affix-lock')).every(e=>e.disabled);})()`),true,'pending guards and disabled controls preserve the paid transaction');
  const reforgeShot=await c.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(OUT,`reforge-v2-${width}.png`),Buffer.from(reforgeShot.data,'base64'));
  await tap('[onclick="v141ResolveReforge(false)"]');
  await c.eval(`(async()=>{const end=Date.now()+2000;while(Date.now()<end&&!document.getElementById('v132RewardModal')?.classList.contains('show'))await new Promise(r=>setTimeout(r,50));return true;})()`);
  await tap('#v132RewardModal [onclick="v132CloseRewardModal()"]');
  assert.deepEqual(await c.eval(`inventoryItems.find(i=>i.v141Uid==='forge-qa-orange').reforgeAffixes`),[{stat:'attack',value:40},{stat:'attack',value:35}]);
  assert.equal(await c.eval(`gold`),99000,'keep original does not refund');
  await c.eval(`window.__forgeQaRandom=Math.random;Math.random=()=>0;true`);
  await tap('.v141-smelting-footer .v141-synthesis-primary');
  await c.eval(`Math.random=window.__forgeQaRandom;delete window.__forgeQaRandom;true`);
  await tap('[onclick="v141ResolveReforge(true)"]');
  await c.eval(`(async()=>{const end=Date.now()+2000;while(Date.now()<end&&!document.getElementById('v132RewardModal')?.classList.contains('show'))await new Promise(r=>setTimeout(r,50));return true;})()`);
  await tap('#v132RewardModal [onclick="v132CloseRewardModal()"]');
  assert.deepEqual(await c.eval(`inventoryItems.find(i=>i.v141Uid==='forge-qa-orange').reforgeAffixes`),[{stat:'attack',value:40},{stat:'attack',value:10}]);
  assert.equal(await c.eval(`gold`),98000);
  assert.equal(await c.eval(`inventoryItems.find(i=>i.id===v132GetContentDefinitions().ores.find(i=>i.tierKey==='white').id).count`),800,'each one-lock transaction costs 100');
  assert.equal(await c.eval(`(()=>{const item=inventoryItems.find(i=>i.v141Uid==='forge-qa-orange');return FourSymbolsEquipmentReforge.aggregate(item).attack;})()`),50,'duplicates sum once');
  // Legacy excess slots must remain usable and visible, with one shared scroll owner.
  await c.eval(`(()=>{const item=inventoryItems.find(i=>i.v141Uid==='forge-qa-orange');item.reforgeSlots=5;item.reforgeAffixes=[{stat:'attack',value:40},{stat:'attack',value:38},{stat:'attack',value:36},{stat:'attack',value:35},null];v141SelectReforgeItem(item.v141Uid);return true;})()`);
  assert.equal(await c.eval(`document.querySelectorAll('.v17358-affix-lock').length`),4,'only real affixes have lock rows');
  assert.deepEqual(await c.eval(`[...document.querySelectorAll('.v141-smelting-affix>b')].map(n=>n.textContent)`),['攻擊 +40','攻擊 +38','攻擊 +36','攻擊 +35','[可冶煉]'],'each formal slot preserves its value or empty marker');
  const slotView=await c.eval(`(()=>{const item=inventoryItems.find(i=>i.v141Uid==='forge-qa-orange'),before=JSON.stringify(item);v17346AppendReforgeMarkers(item);return {rows:[...document.querySelectorAll('#itemModalStats [data-reforge-slot]')].map(n=>n.textContent),remaining:v17346RemainingReforgeSlots(item),unchanged:JSON.stringify(item)===before};})()`);
  assert.deepEqual(slotView,{rows:['詞條 1：攻擊 +40','詞條 2：攻擊 +38','詞條 3：攻擊 +36','詞條 4：攻擊 +35','詞條 5：[可冶煉]'],remaining:1,unchanged:true},'backpack and forge share ordered raw slots without writes');
  await tap('.v141-smelting-affix:first-child .v17358-affix-lock');await tap('.v141-smelting-affix:nth-child(2) .v17358-affix-lock');
  await tap('.v141-smelting-footer .v141-synthesis-primary');
  assert.equal(await c.eval(`document.querySelectorAll('.v141-smelting-affix').length`),5,'the roll fills the fifth formal slot');
  const excessScroll=await c.eval(`(()=>{const b=document.querySelector('.v141-synthesis-body'),last=document.querySelector('.v141-smelting-affix:last-child');last.scrollIntoView({block:'end',behavior:'instant'});const r=last.getBoundingClientRect(),box=b.getBoundingClientRect();return {overflow:b.scrollHeight-b.clientHeight,scrollTop:b.scrollTop,lastVisible:r.top>=box.top-1&&r.bottom<=box.bottom+1};})()`);
  assert.ok(excessScroll.lastVisible,'last of five historical slots is unreachable');
  if(excessScroll.overflow>1)assert.ok(excessScroll.scrollTop>0,'historical excess slots require a usable vertical escape');
  evidence.push({scene:'historical-five-slot-scroll',width,height,...excessScroll});
  assert.equal(await c.eval(`(()=>{const area=document.querySelector('.v141-synthesis-body'),action=document.querySelector('.v141-smelting-footer'),r=action.getBoundingClientRect();return area.scrollWidth<=area.clientWidth+1&&getComputedStyle(area).overflowY==='auto'&&r.top>=0&&r.bottom<=innerHeight+1;})()`),true,'single result scrolls and its actions remain visible');
  const excessShot=await c.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(OUT,`reforge-v2-excess-${width}.png`),Buffer.from(excessShot.data,'base64'));
  await tap('[onclick="v141ResolveReforge(true)"]');
  await c.eval(`(async()=>{const end=Date.now()+2000;while(Date.now()<end&&!document.getElementById('v132RewardModal')?.classList.contains('show'))await new Promise(r=>setTimeout(r,50));return true;})()`);await tap('#v132RewardModal [onclick="v132CloseRewardModal()"]');
  assert.equal(await c.eval(`inventoryItems.find(i=>i.v141Uid==='forge-qa-orange').reforgeAffixes.length`),5);
  assert.equal(await c.eval(`inventoryItems.find(i=>i.id===v132GetContentDefinitions().ores.find(i=>i.tierKey==='white').id).count`),650,'two locks cost 150');
  await tap('.v141-forge-tabs button:last-child');
  await openEquipmentPicker();await tap('[data-forge-value="forge-qa-orange"]');
  assert.equal(await c.eval(`document.querySelectorAll('.v141-socket').length`),1);
  const geometry=await c.eval(`(()=>{const card=document.querySelector('.v141-socket-card'),body=document.querySelector('.v141-synthesis-body'),r=card.getBoundingClientRect();return {left:r.left,right:r.right,overflow:card.scrollWidth-card.clientWidth,bodyOverflow:getComputedStyle(body).overflowY,fonts:[...card.querySelectorAll('summary,button,small')].filter(n=>{const a=n.getBoundingClientRect();return a.width>0&&a.height>0}).map(n=>{const a=n.getBoundingClientRect();return {tag:n.tagName,text:n.textContent,font:parseFloat(getComputedStyle(n).fontSize)*(n.offsetWidth?a.width/n.offsetWidth:1)}})};})()`);
  assert.ok(geometry.left>=-1&&geometry.right<=width+1&&geometry.overflow<=1,'forge overflow');assert.ok(geometry.fonts.length&&geometry.fonts.every(n=>n.font>=12.9),'forge text below 13px '+JSON.stringify(geometry));
  assert.equal(await c.eval(`(()=>{const b=document.querySelector('.v141-synthesis-body').getBoundingClientRect(),nav=document.getElementById('bottomNav'),shell=nav.parentElement;return shell.hidden&&getComputedStyle(shell).display==='none'&&nav.getClientRects().length===0&&b.top>=0&&b.bottom<=innerHeight+1;})()`),true,'forge must suppress navigation without a hitbox and keep its scroll area in the viewport');
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
  await c.eval(`closeHomeFeature();showPage('inventory');selectInventoryCharacter(0);true`);await pause();
  await tap('#equipmentGrid .inventory-equipment-cell:nth-child(4) .inventory-equipment-slot');
  await tap('#itemEquipButton');
  assert.equal(await c.eval(`getEquipmentBonus('fire').vitality`),0,'unequip retains gem effect');
  assert.deepEqual(await c.eval(`FourSymbolsAccountSave.readActive().save.inventoryItems.find(n=>n.v141Uid==='forge-qa-equipped').sockets`),['gemVitalityI']);
  await c.eval(`closeHomeFeature();openHomeFeature('synthesis')`);await pause();
  await tap('[onclick="v141SwitchSynthesisTab(\'material\')"]');
  await c.eval(`closeHomeFeature();openHomeFeature('forge');v141SwitchForgeTab('socket')`);await pause();
  assert.deepEqual(await c.eval(`Array.from(document.querySelectorAll('.v141-forge-tabs button'),n=>n.textContent)`),['冶煉','鑲嵌']);
  assert.equal(await c.eval(`(()=>{const repo=FourSymbolsAccountSave,s=repo.readActive();repo.writeForUid(s.uid,s.save,{source:'authoritative-cloud-read',cloudBaseFingerprint:'v1:1:00000000000000000000000000000000',localDirty:false});v141SelectSocketItem('forge-qa-equipped');const blocked=v141SocketGem();repo.writeForUid(s.uid,s.save,{source:'local',cloudBaseFingerprint:null,localDirty:true});return blocked;})()`),false,'cloud character used local socket mutation');
  const shot=await c.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(OUT,`forge-${width}.png`),Buffer.from(shot.data,'base64'));
  evidence.push({width,height,entry:firstViewport?'cold-delayed-owner-after-announcement':'warm-reentry',geometry,scrollTop,saved,equippedBonus:1,unequippedBonus:0,cloudMutationBlocked:true});console.log('PASS forge touch runtime '+width+'x'+height);firstViewport=false;
 }
 fs.writeFileSync(path.join(OUT,'evidence.json'),JSON.stringify({passed:true,environment:live?'deployed-site':'production-local',sha:process.env.EXPECTED_COMMIT_SHA||process.env.GITHUB_SHA||null,evidence},null,2)+'\n');
}catch(error){if(c){try{const shot=await c.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(OUT,'failure.png'),Buffer.from(shot.data,'base64'));}catch{}}fs.writeFileSync(path.join(OUT,'evidence.json'),JSON.stringify({passed:false,error:String(error.stack||error),evidence},null,2)+'\n');throw error;
}finally{c?.close();proc?.kill('SIGTERM');server?.server.close();if(profile)try{fs.rmSync(profile,{recursive:true,force:true});}catch{}}
