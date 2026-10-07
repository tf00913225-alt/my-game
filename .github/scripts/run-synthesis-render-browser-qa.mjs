import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {ROOT,ASSET_MANIFEST,findChrome,startServer,waitJson,Cdp} from './runtime-browser-qa-support.mjs';

// Real production assets and owners; disposable local UID, read-only Firebase
// transports. This verifies presentation and local transactions, not backend authority.
const OUT=path.join(ROOT,'artifacts/browser-qa/synthesis-render-convergence');
fs.mkdirSync(OUT,{recursive:true});
let server,proc,c,profile;const evidence=[];
const tabs=['符咒合成','碎片合成','材料合成'];
async function tap(selector){
 const p=await c.eval(`(async()=>{const n=document.querySelector(${JSON.stringify(selector)});if(!n)throw Error('missing '+${JSON.stringify(selector)});const picker=n.closest('.v143-item-picker');if(picker){const a=n.getBoundingClientRect(),b=picker.getBoundingClientRect(),scale=b.width/picker.offsetWidth;picker.scrollLeft+=(a.left-b.left-(b.width-a.width)/2)/scale;}else{n.scrollIntoView({block:'nearest',behavior:'instant'});}await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const r=n.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,h=document.elementFromPoint(x,y);if(n.disabled||r.height<40||!h||!(h===n||n.contains(h)))throw Error('untappable '+${JSON.stringify(selector)}+' '+JSON.stringify({rect:r.toJSON(),hit:h?.className}));return {x,y};})()`);
 await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p]});await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await new Promise(r=>setTimeout(r,100));
}
async function decode(){
 const images=await c.eval(`(async()=>{const list=[...document.querySelectorAll('#homeFeatureModalBody img')];await Promise.all(list.map(n=>n.decode()));return list.map(n=>({src:n.getAttribute('src'),width:n.naturalWidth,complete:n.complete}));})()`);
 assert.ok(images.length&&images.every(n=>n.complete&&n.width>0),'image did not decode');return images;
}
async function scrollGesture(selector,horizontal){
 const p=await c.eval(`(()=>{const n=document.querySelector(${JSON.stringify(selector)}),r=n.getBoundingClientRect();return {x:${horizontal?'r.right-20':'r.right-8'},y:${horizontal?'r.top+4':'r.bottom-25'},to:${horizontal?'r.left+20':'r.top+25'},before:${horizontal?'n.scrollLeft':'n.scrollTop'}};})()`);
 await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:p.x,y:p.y}]});
 for(let i=1;i<=8;i++){await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:horizontal?p.x+(p.to-p.x)*i/8:p.x,y:horizontal?p.y:p.y+(p.to-p.y)*i/8}]});await new Promise(r=>setTimeout(r,20));}
 await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await new Promise(r=>setTimeout(r,500));
 const after=await c.eval(`document.querySelector(${JSON.stringify(selector)}).${horizontal?'scrollLeft':'scrollTop'}`);assert.ok(after>p.before,'native touch scrolling failed '+selector);return {before:p.before,after};
}
async function layout(width){
 const g=await c.eval(`(()=>{const b=document.querySelector('.v141-synthesis-body'),r=b.getBoundingClientRect();return {left:r.left,right:r.right,bottom:r.bottom,overflow:b.scrollWidth-b.clientWidth,scrollHeight:b.scrollHeight,clientHeight:b.clientHeight,overflowY:getComputedStyle(b).overflowY,native:document.querySelectorAll('#homeFeatureModalBody select').length,tabs:[...document.querySelectorAll('.v141-synthesis-tabs button')].map(n=>({text:n.textContent,height:n.getBoundingClientRect().height,font:parseFloat(getComputedStyle(n).fontSize)}))};})()`);
 assert.equal(g.native,0);assert.deepEqual(g.tabs.map(n=>n.text),tabs);assert.ok(g.tabs.every(n=>n.height>=40&&n.font>=15));assert.ok(g.left>=-1&&g.right<=width+1&&g.overflow<=1,JSON.stringify(g));assert.equal(g.overflowY,'auto');return g;
}
try{
 const baseUrl=process.env.DEV_BASE_URL;
 if(baseUrl){
  assert.ok(process.env.EXPECTED_COMMIT_SHA,'deployed QA requires exact SHA');
  const release=await(await fetch(new URL('release-manifest.json',baseUrl+'/'),{cache:'no-store'})).json();assert.equal(release.commitSha,process.env.EXPECTED_COMMIT_SHA);
  const manifest=await(await fetch(new URL('build/asset-manifest.json',baseUrl+'/'),{cache:'no-store'})).json();assert.deepEqual(manifest,ASSET_MANIFEST);
 }
 server=await startServer({baseUrl});profile=fs.mkdtempSync(path.join(os.tmpdir(),'synthesis-qa-'));
 const port=10300+Math.floor(Math.random()*300);
 proc=spawn(findChrome(),['--headless=new','--no-sandbox','--disable-gpu',`--remote-debugging-port=${port}`,`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
 const target=(await waitJson(`http://127.0.0.1:${port}/json/list`)).find(t=>t.type==='page');c=new Cdp(target.webSocketDebuggerUrl);await c.send('Page.enable');await c.send('Runtime.enable');
 await c.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
 await c.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true,screenWidth:390,screenHeight:844});
 await c.send('Page.navigate',{url:server.url});
 await c.eval(`(async()=>{const end=Date.now()+45000;while(Date.now()<end&&!(window.FourSymbolsStartupPolicy?.getState?.()==='READY'&&document.getElementById('startupLoader')?.hidden))await new Promise(r=>setTimeout(r,50));if(FourSymbolsStartupPolicy.getState()!=='READY')throw Error('startup not READY');document.getElementById('firebaseDirectEnterButton')?.click();showPage('home');return true;})()`);
 await new Promise(r=>setTimeout(r,1000));
 if(await c.eval(`!!document.querySelector('[data-release-update-action="acknowledge"]')`))await tap('[data-release-update-action="acknowledge"]');
 await tap('[onclick="openHomeFeature(\'synthesis\')"]');
 await c.eval(`(async()=>{const end=Date.now()+20000;while(Date.now()<end&&typeof v141SwitchSynthesisTab!=='function')await new Promise(r=>setTimeout(r,50));if(typeof v141SwitchSynthesisTab!=='function')throw Error('synthesis unavailable '+JSON.stringify({scripts:[...document.scripts].map(n=>n.src).filter(n=>n.includes('gameplay')),ready:FourSymbolsFeatures.isReady('synthesis'),body:document.getElementById('homeFeatureModalBody')?.textContent}));return true;})()`);
 for(const [width,height] of [[390,844],[420,900]]){
  await c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true,screenWidth:width,screenHeight:height});
  const first=await c.eval(`(()=>{closeHomeFeature();const repo=FourSymbolsAccountSave,s=repo.readActive();repo.writeForUid(s.uid,s.save,{source:'local',cloudBaseFingerprint:null,localDirty:true});const d=v132GetContentDefinitions();inventoryItems.splice(0,inventoryItems.length,...d.talismans.filter(n=>['low','mid','high','white','blue','purple'].includes(n.tierKey)).map(n=>({...n,count:12,icon:''})),...d.ores.map(n=>({...n,count:100})),...d.blueprints.filter(n=>n.setId==='setFire'&&n.blueprintSlot==='head').map(n=>({...n,count:100})),{id:'fragmentSetFire',setId:'setFire',type:'material',count:400,name:'赤炎碎片'});gold=100000;rebuildInventorySlots();v141SwitchSynthesisTab('talisman');openHomeFeature('synthesis');return {html:document.getElementById('homeFeatureModalBody').innerHTML,pickers:document.querySelectorAll('.v143-item-picker').length,native:document.querySelectorAll('#homeFeatureModalBody select').length};})()`);
  assert.equal(first.pickers,1);assert.equal(first.native,0);for(const effect of ['freeze','stealth','barrier'])assert.ok(first.html.includes(effect+'-icon.png'),'first render missing '+effect);
  const firstImages=await decode(),talismanLayout=await layout(width);
  const selectedBeforeScroll=await c.eval(`document.querySelector('.v143-item-picker .selected').dataset.pickerValue`);
  const horizontalScroll=await scrollGesture('.v143-item-picker',true);
  assert.equal(await c.eval(`document.querySelector('.v143-item-picker .selected').dataset.pickerValue`),selectedBeforeScroll,'scroll changed selection');
  const shot=await c.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(OUT,`talisman-${width}.png`),Buffer.from(shot.data,'base64'));
  await tap('[data-picker-value="barrierTalismanLow"]');
  assert.equal(await c.eval(`document.querySelector('.v143-item-picker .selected').dataset.pickerValue`),'barrierTalismanLow');
  await tap('[onclick="v141AdjustTalismanQty(1)"]');assert.equal(await c.eval(`document.querySelector('.v141-quantity strong').textContent`),'2');
  await tap('[onclick="v141AdjustTalismanQty(\'max\')"]');assert.equal(await c.eval(`document.querySelector('.v141-quantity strong').textContent`),'4');
  await tap('[onclick="v141AdjustTalismanQty(-1)"]');assert.equal(await c.eval(`document.querySelector('.v141-quantity strong').textContent`),'3');
  const counts=await c.eval(`(()=>{const count=id=>inventoryItems.filter(n=>n.id===id).reduce((s,n)=>s+n.count,0),before={source:count('barrierTalismanLow'),target:count('barrierTalismanMid'),gold};v141CraftTalismans();return {before,after:{source:count('barrierTalismanLow'),target:count('barrierTalismanMid'),gold}};})()`);
  assert.equal(counts.after.source,counts.before.source-9);assert.equal(counts.after.target,counts.before.target+3);assert.equal(counts.after.gold,counts.before.gold-900);
  await new Promise(r=>setTimeout(r,600));await c.eval(`v132CloseRewardModal();true`);
  const rollback=await c.eval(`(()=>{const holdings=()=>inventoryItems.map(n=>({id:n.id,count:n.count})).sort((a,b)=>a.id.localeCompare(b.id)),before=JSON.stringify(holdings()),g=gold,add=v132AddItemToInventory;v132AddItemToInventory=()=>false;try{v141CraftTalismans();return {inventory:JSON.stringify(holdings())===before,gold:gold===g,pickers:document.querySelectorAll('.v143-item-picker').length};}finally{v132AddItemToInventory=add;}})()`);assert.deepEqual(rollback,{inventory:true,gold:true,pickers:1});
  await c.eval(`document.querySelector('#v169RpgDialogLayer.show .v169-rpg-dialog-actions button:last-child')?.click();true`);
  await c.eval(`v141SwitchSynthesisTab('fragment');true`);const fragmentLayout=await layout(width);
  const fragment=await c.eval(`(()=>{const count=id=>inventoryItems.filter(n=>n.id===id).reduce((s,n)=>s+n.count,0),ticket=v132GetContentDefinitions().tickets.find(n=>n.setId==='setFire');v141AdjustFragmentQty('setFire',-100);v141AdjustFragmentQty('setFire',1);const before={fragment:count('fragmentSetFire'),ticket:count(ticket.id),gold};v141CraftFragmentTicket('setFire');return {before,after:{fragment:count('fragmentSetFire'),ticket:count(ticket.id),gold}};})()`);
  assert.equal(fragment.after.fragment,fragment.before.fragment-200);assert.equal(fragment.after.ticket,fragment.before.ticket+2);assert.equal(fragment.after.gold,fragment.before.gold-1000);
  await new Promise(r=>setTimeout(r,600));await c.eval(`v132CloseRewardModal();v141SwitchSynthesisTab('material');true`);
  const materialImages=await decode(),materialLayout=await layout(width);
  const verticalScroll=await scrollGesture('.v141-synthesis-body',false);
  await tap('[data-material-key="oreTier"] .v17363-game-select-trigger');
  await tap('[data-material-key="oreTier"][data-material-value="blue"]');
  assert.equal(await c.eval(`document.querySelector('[data-material-key="oreTier"] .v17363-game-select-option.selected').dataset.materialValue`),'blue');
  const material=await c.eval(`(()=>{const d=v132GetContentDefinitions(),source=d.ores.find(n=>['mid','blue'].includes(n.tierKey)),target=d.ores.find(n=>['high','purple'].includes(n.tierKey)),count=id=>inventoryItems.filter(n=>n.id===id).reduce((s,n)=>s+n.count,0),before={source:count(source.id),target:count(target.id),gold};const success=v17363CraftMaterial('ore');return {success,before,after:{source:count(source.id),target:count(target.id),gold}};})()`);
  assert.equal(material.success,true);assert.equal(material.after.source,material.before.source-50);assert.equal(material.after.target,material.before.target+10);assert.equal(material.after.gold,material.before.gold);
  await c.eval(`document.querySelector('#v169RpgDialogLayer.show .v169-rpg-dialog-actions button:last-child')?.click();true`);
  const materialShot=await c.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(OUT,`material-${width}.png`),Buffer.from(materialShot.data,'base64'));
  await c.eval(`closeHomeFeature();showPage('inventory');showPage('home');openHomeFeature('synthesis');true`);assert.equal(await c.eval(`document.querySelectorAll('.v17363-material-synthesis').length`),1);await layout(width);
  // Verify every existing material control and both transaction kinds.
  for(const [key,value] of [['blueprintSet','setWater'],['blueprintSlot','hand'],['blueprintTier','purple'],['blueprintSet','setFire'],['blueprintSlot','head'],['blueprintTier','white']]){
   await tap('[data-material-key="'+key+'"] .v17363-game-select-trigger');
   await tap('[data-material-key="'+key+'"][data-material-value="'+value+'"]');
   assert.equal(await c.eval(`document.querySelector('[data-material-key="${key}"] .v17363-game-select-option.selected').dataset.materialValue`),value);
   await decode();await layout(width);
  }
  const materialFailure=await c.eval(`(()=>{const holdings=()=>inventoryItems.map(n=>({id:n.id,count:n.count})).sort((a,b)=>a.id.localeCompare(b.id)),before=JSON.stringify(holdings()),g=gold,add=v132AddItemToInventory;v132AddItemToInventory=()=>false;try{const success=v17363CraftMaterial('blueprint');return {success,holdings:JSON.stringify(holdings())===before,gold:gold===g,body:document.querySelectorAll('.v17363-material-synthesis').length,native:document.querySelectorAll('#homeFeatureModalBody select').length};}finally{v132AddItemToInventory=add;}})()`);
  assert.deepEqual(materialFailure,{success:false,holdings:true,gold:true,body:1,native:0});
  await c.eval(`document.querySelector('#v169RpgDialogLayer.show .v169-rpg-dialog-actions button:last-child')?.click();true`);
  const blueprintPromotion=await c.eval(`(()=>{const d=v132GetContentDefinitions(),get=tier=>d.blueprints.find(n=>n.setId==='setFire'&&n.blueprintSlot==='head'&&n.tierKey===tier),source=get('white'),target=get('blue'),count=id=>inventoryItems.filter(n=>n.id===id).reduce((s,n)=>s+n.count,0),before={source:count(source.id),target:count(target.id),gold},success=v17363CraftMaterial('blueprint');return {success,before,after:{source:count(source.id),target:count(target.id),gold}};})()`);
  assert.equal(blueprintPromotion.success,true);assert.equal(blueprintPromotion.after.source,blueprintPromotion.before.source-50);assert.equal(blueprintPromotion.after.target,blueprintPromotion.before.target+10);assert.equal(blueprintPromotion.after.gold,blueprintPromotion.before.gold);
  await c.eval(`document.querySelector('#v169RpgDialogLayer.show .v169-rpg-dialog-actions button:last-child')?.click();true`);
  const fragmentFailure=await c.eval(`(()=>{v141SwitchSynthesisTab('fragment');const holdings=()=>inventoryItems.map(n=>({id:n.id,count:n.count})).sort((a,b)=>a.id.localeCompare(b.id)),before=JSON.stringify(holdings()),g=gold,add=v132AddItemToInventory;v132AddItemToInventory=()=>false;try{v141CraftFragmentTicket('setFire');return {holdings:JSON.stringify(holdings())===before,gold:gold===g,cards:document.querySelectorAll('.v141-fragment-row').length,native:document.querySelectorAll('#homeFeatureModalBody select').length};}finally{v132AddItemToInventory=add;}})()`);
  assert.equal(fragmentFailure.holdings,true);assert.equal(fragmentFailure.gold,true);assert.equal(fragmentFailure.native,0);assert.equal(fragmentFailure.cards,4);
  await c.eval(`document.querySelector('#v169RpgDialogLayer.show .v169-rpg-dialog-actions button:last-child')?.click();v141SwitchSynthesisTab('material');true`);
  console.log('PASS supplemental material controls, blueprint promotion, material/fragment rollback '+width);

  evidence.push({width,height,firstImages,talismanLayout,horizontalScroll,counts,rollback,fragmentLayout,fragment,materialImages,materialLayout,verticalScroll,material,materialFailure,blueprintPromotion,fragmentFailure,finalNativeCount:0});console.log('PASS synthesis production runtime '+width);
 }
 fs.writeFileSync(path.join(OUT,'evidence.json'),JSON.stringify({passed:true,environment:baseUrl?'exact-deployed':'production-local',sha:process.env.EXPECTED_COMMIT_SHA||null,evidence},null,2)+'\n');
}catch(error){if(c)try{const s=await c.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(OUT,'failure.png'),Buffer.from(s.data,'base64'));}catch{}const errors=c?.events.filter(e=>e.method==='Runtime.exceptionThrown'||e.method==='Runtime.consoleAPICalled'&&e.params.type==='error');console.error(JSON.stringify(errors));fs.writeFileSync(path.join(OUT,'evidence.json'),JSON.stringify({passed:false,error:String(error.stack||error),errors,evidence},null,2)+'\n');throw error;}
finally{c?.close();proc?.kill();server?.server.close();if(profile)try{fs.rmSync(profile,{recursive:true,force:true});}catch{}}
