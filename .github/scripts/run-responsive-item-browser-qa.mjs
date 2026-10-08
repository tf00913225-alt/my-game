import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {ROOT,ASSET_MANIFEST,findChrome,startServer,waitJson,Cdp,qaPrelude,QA_AUTH_PATH,QA_CLOUD_PATH,QA_SESSION_PATH,QA_AUTH_MODULE,QA_CLOUD_MODULE,QA_SESSION_MODULE} from './runtime-browser-qa-support.mjs';

// Real index, loader, hashed CSS/JS and native modal lifecycle. Only the
// external account transport is the existing isolated, read-only QA seam.
const OUT=path.join(ROOT,'artifacts/browser-qa/responsive-item');
const VIEWPORTS=[[360,800],[360,640],[393,873],[393,660],[412,915],[412,680]];
const DISPLAY_VIEWPORTS=[[390,844],[412,915],[768,1024],[834,1194],[1366,768],[1536,864],[1920,1080],[2560,1440]];
const settle=()=>new Promise(resolve=>setTimeout(resolve,150));
const PREPARE=String.raw`(async()=>{
 const until=Date.now()+45000;
 while(Date.now()<until&&!(window.FourSymbolsStartupPolicy?.getState?.()==='READY'&&document.getElementById('startupLoader')?.hidden&&!document.getElementById('firebaseAuthOverlay')?.classList.contains('show'))) await new Promise(r=>setTimeout(r,50));
 if(window.FourSymbolsStartupPolicy?.getState?.()!=='READY'||document.getElementById('firebaseAuthOverlay')?.classList.contains('show')) throw Error('formal startup did not reach interactive READY');
 await FourSymbolsFeatures.ensure('gameplay-core','responsive-item-qa');
 if(typeof openItemModal!=='function'||typeof v17346PreviewEquipmentShopOffer!=='function') throw Error('formal item runtime missing');
 const art='<span class="v169-item-art v169-equipment-art"><img src="data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'900\' height=\'500\'%3E%3Crect width=\'900\' height=\'500\' fill=\'gold\'/%3E%3C/svg%3E" alt="QA"></span>';
 const stats=Object.fromEntries(Array.from({length:28},(_,i)=>['長名稱屬性測試'+i,999999+i]));
 window.__responsiveItems={
 equipment:{id:'responsive-qa-gear',name:'千年玄鐵古銅長名稱裝備測試'.repeat(3),type:'armor',count:1,price:999999,stats,icon:art,rarityKey:'white'},
 potion:{...getPotionDefinition('hpPotion10'),count:999,name:'長名稱恢復藥水測試'.repeat(3),icon:art},
 material:{id:'responsive-qa-material',name:'千年玄鐵長名稱材料'.repeat(3),type:'material',count:999,price:999999,stats,icon:art},
 chest:{id:'materialChest',name:'長名稱材料寶箱',type:'chest',count:999,stats:{},icon:art}
 };
 inventoryItems.splice(0,inventoryItems.length,...Object.values(__responsiveItems),...Array.from({length:5},(_,i)=>({...__responsiveItems.equipment,id:'responsive-qa-'+i})),...Array.from({length:110},()=>({...__responsiveItems.potion})));
 characterEquipment.fire.armor={...__responsiveItems.equipment,name:'已穿戴長名稱對照裝備',stats};
 rebuildInventorySlots();renderInventory();showPage('home');closeHomeFeature();
 return {loader:true,productionStyles:[...document.querySelectorAll('link[rel="stylesheet"]')].map(n=>new URL(n.href).pathname)};
})()`;
const INSTALL_MEASURE=`window.__responsiveMeasure=(selector)=>{
 const node=document.querySelector(selector);if(!node)throw Error('missing '+selector);
 const r=node.getBoundingClientRect(),s=getComputedStyle(node);
 const rect={left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};
 const clips=[];for(let p=node.parentElement;p;p=p.parentElement){const ps=getComputedStyle(p);if(/hidden|clip|auto|scroll/.test(ps.overflowX+' '+ps.overflowY)){const a=p.getBoundingClientRect();clips.push({left:a.left,top:a.top,right:a.right,bottom:a.bottom});}}
 const projectedFont=parseFloat(s.fontSize)*(node.offsetWidth?r.width/node.offsetWidth:1);
 return {selector,rect,clips,font:parseFloat(s.fontSize),projectedFont,display:s.display,overflowX:s.overflowX,overflowY:s.overflowY,overflow:node.scrollWidth-node.clientWidth,scrollHeight:node.scrollHeight,clientHeight:node.clientHeight,scrollTop:node.scrollTop,objectFit:s.objectFit,transform:s.transform,columns:s.gridTemplateColumns,boxSizing:s.boxSizing,padding:s.padding,width:s.width,children:[...node.children].map(n=>({tag:n.tagName,class:n.className,rect:n.getBoundingClientRect().toJSON()})),mode:node.dataset.presentationMode||null};
}; true`;
function visible(row,viewport){
 assert.notEqual(row.display,'none',row.selector+' hidden');
 const r=row.rect;assert.ok(r.width>0&&r.height>0,row.selector+' empty');
 for(const a of [{left:0,top:0,right:viewport[0],bottom:viewport[1]},...row.clips]) assert.ok(r.left>=a.left-1&&r.top>=a.top-1&&r.right<=a.right+1&&r.bottom<=a.bottom+1,row.selector+' clipped '+JSON.stringify({r,a}));
 assert.ok(row.overflow<=1,row.selector+' horizontal overflow '+row.overflow);
}
async function run(chrome,url,live){
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'responsive-item-qa-')),port=9600+Math.floor(Math.random()*300);
 const proc=spawn(chrome,[...(chrome.includes('headless-shell')?[]:['--headless=new']),'--no-sandbox','--disable-gpu','--disable-dev-shm-usage',`--remote-debugging-port=${port}`,`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','pipe']});
 let c;const evidence=[];let browserError="";proc.stderr.on("data",chunk=>{browserError=(browserError+chunk).slice(-4000)});
 try{
  const target=(await waitJson(`http://127.0.0.1:${port}/json/list`)).find(t=>t.type==='page');c=new Cdp(target.webSocketDebuggerUrl);
  await c.send('Page.enable');await c.send('Runtime.enable');
  if(live){
   const stubs=new Map([[QA_AUTH_PATH,QA_AUTH_MODULE],[QA_CLOUD_PATH,QA_CLOUD_MODULE],[QA_SESSION_PATH,QA_SESSION_MODULE]]);
   c.ws.addEventListener('message',event=>{const m=JSON.parse(String(event.data));if(m.method==='Fetch.requestPaused'){const p=m.params,body=stubs.get('/'+new URL(p.request.url).pathname.slice(new URL('.',url).pathname.length));c.send(body?'Fetch.fulfillRequest':'Fetch.continueRequest',body?{requestId:p.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'text/javascript'}],body:Buffer.from(body).toString('base64')}:{requestId:p.requestId}).catch(error=>console.error(error));}});
   await c.send('Fetch.enable',{patterns:[...stubs.keys()].map(p=>({urlPattern:'*'+p+'*',resourceType:'Script'}))});
  }
  await c.send('Page.addScriptToEvaluateOnNewDocument',{source:qaPrelude().replace(/^<script>|<\/script>$/g,'')});
  const resize=async v=>{await c.send('Emulation.setDeviceMetricsOverride',{width:v[0],height:v[1],deviceScaleFactor:1,mobile:true,screenWidth:v[0],screenHeight:v[1]});await settle();};
  await resize(VIEWPORTS[0]);await c.send('Page.navigate',{url});
  const runtime=await c.eval(PREPARE);await c.eval(INSTALL_MEASURE);
  assert.ok(runtime.productionStyles.some(p=>/build\/gameplay-core\.[a-f0-9]+\.css/.test(p)),'production CSS not loaded');
  const measure=selector=>c.eval(`__responsiveMeasure(${JSON.stringify(selector)})`);
  const actionable=async()=>{
   const controls=await c.eval(`Array.from(document.querySelectorAll('#itemModal button,#v17350BatchQuantity')).filter(n=>{const r=n.getBoundingClientRect();return r.width>0&&r.height>0&&!n.disabled}).map(n=>{const r=n.getBoundingClientRect(),h=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return {text:n.textContent||n.value,hit:!!(h&&(h===n||n.contains(h)))}})`);
   assert.ok(controls.length,'item controls missing');
   for(const control of controls)assert.ok(control.hit,'item control covered '+control.text);
   return controls;
  };
  const check=async(selector,v,text=false)=>{const row=await measure(selector);try{visible(row,v);}catch(error){console.error('FAILED geometry '+JSON.stringify(row));throw error;}if(text)assert.ok(row.projectedFont>=13-0.1,selector+' rendered font '+row.projectedFont);return row;};
  const click=async(selector,v)=>{
   const row=await check(selector,v),x=row.rect.left+row.rect.width/2,y=row.rect.top+row.rect.height/2;
   const hit=await c.eval(`(()=>{const n=document.querySelector(${JSON.stringify(selector)}),h=document.elementFromPoint(${x},${y});return !!(h&&(n===h||n.contains(h)))})()`);
   assert.ok(hit,selector+' is covered and cannot be clicked');
   await c.send('Input.dispatchMouseEvent',{type:'mouseMoved',x,y});
   await c.send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1});
   await c.send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1});await settle();
  };
  const screenshot=async name=>{const shot=await c.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(OUT,name+'.png'),Buffer.from(shot.data,'base64'));};
  const checkDisplay=async label=>{
   const row=await c.eval(`(()=>{
    const api=window.FourSymbolsDisplay;if(!api)throw Error('display owner missing');
    const stage=document.getElementById('game-stage'),content=document.getElementById('game-content'),r=stage.getBoundingClientRect(),cr=content.getBoundingClientRect();
    const aliases=screenToGame===screenToGamePoint&&gameToScreen===gameToScreenPoint&&eventToGame===eventToGamePoint;
    if(!aliases)throw Error('coordinate aliases have diverged');
    let count=0,maxError=0;
    for(const surface of ['browser','native','legacy']){
     const width=surface==='legacy'?api.dimensions.legacyWidth:api.dimensions.nativeWidth;
     const height=surface==='legacy'?api.dimensions.legacyHeight:api.dimensions.nativeHeight;
     for(const [x,y] of [[0,0],[width,0],[0,height],[width,height],[width/2,height/2]]){
      const p=api.surfaceToClient(surface,x,y),q=api.clientToSurface(surface,p.x,p.y);
      maxError=Math.max(maxError,Math.abs(q.x-x),Math.abs(q.y-y));count++;
      if(surface==='browser'&&(p.x!==x||p.y!==y))throw Error('browser domain scaled');
     }
    }
    const center=screenToGame(r.left+r.width/2,r.top+r.height/2);
    const s=getComputedStyle(document.documentElement),safe=Object.fromEntries(['top','right','bottom','left'].map(k=>[k,parseFloat(s.getPropertyValue('--safe-'+k))||0]));
    return {count,maxError,center,stage:r.toJSON(),content:cr.toJSON(),inlineLegacyTransform:content.style.transform,
     viewportScroll:{left:document.getElementById('game-viewport').scrollLeft,top:document.getElementById('game-viewport').scrollTop},
     viewport:{width:innerWidth,height:innerHeight},safe,diagnostics:{left:GAME_STAGE_LEFT,top:GAME_STAGE_TOP,scale:GAME_STAGE_SCALE},
     document:{width:document.documentElement.clientWidth,height:document.documentElement.clientHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight}};
   })()`);
   assert.ok(row.maxError<1e-6,label+' coordinate roundtrip '+row.maxError);
   assert.ok(Math.abs(row.center.x-1080/2)<1e-6&&Math.abs(row.center.y-1920/2)<1e-6,label+' native center');
   assert.equal(row.inlineLegacyTransform,'',label+' competing runtime legacy scale');
   assert.deepEqual(row.viewportScroll,{left:0,top:0},label+' viewport must not become a programmatic scroller');
   assert.ok(Math.abs(row.stage.left-row.diagnostics.left)<0.1&&Math.abs(row.stage.top-row.diagnostics.top)<0.1,label+' stale diagnostics');
   assert.ok(Math.abs(row.stage.left+row.stage.width/2-(row.safe.left+(row.viewport.width-row.safe.left-row.safe.right)/2))<1,label+' asymmetric safe-area horizontal centering');
   assert.ok(Math.abs(row.stage.top+row.stage.height/2-(row.safe.top+(row.viewport.height-row.safe.top-row.safe.bottom)/2))<1,label+' asymmetric safe-area vertical centering');
   assert.ok(row.document.scrollWidth<=row.document.width+1&&row.document.scrollHeight<=row.document.height+1,label+' document overflow');
   evidence.push({display:label,...row});return row;
  };
  for(const v of DISPLAY_VIEWPORTS){await resize(v);await checkDisplay(v.join('x'));}
  await c.eval(`for(const el of [document.documentElement,document.body])for(const [side,value]of Object.entries({top:20,right:41,bottom:31,left:17}))el.style.setProperty('--safe-'+side,value+'px');window.dispatchEvent(new Event('resize'));`);
  await settle();await checkDisplay('asymmetric-safe-area');
  await c.eval(`for(const el of [document.documentElement,document.body])for(const side of ['top','right','bottom','left'])el.style.removeProperty('--safe-'+side);window.dispatchEvent(new Event('resize'));`);
  const scroll=async(selector)=>{
   const before=await measure(selector);assert.ok(before.overflow<=1,selector+' content overflows horizontally');assert.ok(before.clientHeight>24,selector+' has no usable content');
   if(before.scrollHeight>before.clientHeight+1){
    const x=before.rect.left+before.rect.width/2,y=before.rect.top+before.rect.height/2;
    await c.eval(`document.querySelector(${JSON.stringify(selector)}).scrollTop=0`);
    await c.send('Input.dispatchMouseEvent',{type:'mouseMoved',x,y});await c.send('Input.dispatchMouseEvent',{type:'mouseWheel',x,y,deltaX:0,deltaY:300});await new Promise(r=>setTimeout(r,300));
    const wheel=await measure(selector);const hit=await c.eval(`(()=>{const n=document.elementFromPoint(${x},${y});return {hit:n?.outerHTML.slice(0,300),modal:document.getElementById('homeFeatureModal').className}})()`);assert.ok(wheel.scrollTop>0,selector+' wheel did not scroll '+JSON.stringify({before,wheel,hit}));
    const last=await c.eval(`(()=>{const n=document.querySelector(${JSON.stringify(selector)});n.scrollTop=n.scrollHeight;return {top:n.scrollTop,max:n.scrollHeight-n.clientHeight}})()`);
    assert.ok(last.top>0&&Math.abs(last.top-last.max)<=1,selector+' cannot reach content end');return {wheel:wheel.scrollTop,end:last.top};
   }
   return {needed:false};
  };
  for(const v of VIEWPORTS){
   await resize(v);await c.eval(`closeItemModal();showPage('home');showPage('inventory')`);await settle();
   const backpack=[];
   for(const selector of ['.inventory-title-plate','.map-inventory-overlay-close','.inventory-bottom-actions','.inventory-wallet-label','.inventory-wallet-value',...Array.from({length:6},(_,i)=>'.inventory-equipment-cell:nth-child('+(i+1)+') .inventory-equipment-slot-label')]) backpack.push(await check(selector,v,selector.includes('label')||selector.includes('value')||selector.includes('close')));
   const backpackControlHits=await c.eval(`Array.from(document.querySelectorAll('.inventory-bottom-actions button')).filter(n=>{const r=n.getBoundingClientRect();return r.width>0&&r.height>0&&!n.disabled&&getComputedStyle(n).visibility!=='hidden'}).map(n=>{const r=n.getBoundingClientRect(),h=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return {text:n.textContent,hit:!!(h&&(h===n||n.contains(h)))}})`);
   assert.ok(backpackControlHits.length,'backpack operations missing');for(const control of backpackControlHits)assert.ok(control.hit,'backpack operation covered '+control.text);
   const tabFrame=await measure('.inventory-classic-shell');
   for(const filter of ['item','material','function','equipment']){
    await click('#inventoryCategoryTabs [data-filter="'+filter+'"]',v);
    const after=await measure('.inventory-classic-shell');assert.deepEqual(after.rect,tabFrame.rect,'tab changed inventory frame');
   }
   await resize([v[0],v[1]-80]);await check('.inventory-bottom-actions',[v[0],v[1]-80]);await check('.map-inventory-overlay-close',[v[0],v[1]-80],true);await resize(v);
   const grid=await check('#inventoryGridScroll',v);assert.equal(grid.overflowY,'auto');
   const gridScroll=await scroll('#inventoryGridScroll');
   await c.eval(`openEquippedItem({...__responsiveItems.equipment,name:'鐵甲',stats:{attack:1}},'armor')`);await settle();
   const shortFrame=await check('#itemModal .item-modal-box',v);await click('#itemModal .close-item-button',v);
   const modes=[];
   for(const mode of ['equipment','comparison','potion','material','chest']){
    await c.eval(`closeItemModal();(()=>{const item=__responsiveItems[${JSON.stringify(mode==='comparison'?'equipment':mode)}];if(${JSON.stringify(mode)}==='equipment')openEquippedItem(item,'armor');else {const i=inventorySlots.findIndex(n=>n?.id===item.id);if(i<0)throw Error('missing QA item');openItemModal(i);}})()`);await settle();
    const frame=await check('#itemModal .item-modal-box',v),state=await measure('#itemModal');
    const expected=mode==='comparison'?'comparison':mode==='equipment'?'equipment':'compact';assert.equal(state.mode,expected);
    if(mode==='equipment')assert.ok(frame.rect.height>shortFrame.rect.height+20,'short content did not contract naturally');
    const contents=mode==='comparison'?'.v17351-compare-grid':'#itemModalStats';
    const actions=await check('#itemModal .item-modal-buttons',v);
    const back=await check(mode==='comparison'?'.v17351-compare-back':'#itemModal .close-item-button',v,true);
    const names=await check(mode==='comparison'?'.v17351-compare-pane>strong':'#itemModalName',v,true);
    const art=await check(mode==='comparison'?'.v17351-compare-art':'#itemModalIcon',v);
    assert.ok(Math.abs(art.rect.width-art.rect.height)<1,'art is not square '+mode+' '+JSON.stringify(art));
    const images=await c.eval(`Array.from(document.querySelectorAll(${JSON.stringify(mode==='comparison'?'.v17351-compare-art img':'#itemModalIcon img')})).map(n=>({fit:getComputedStyle(n).objectFit,loaded:n.complete&&n.naturalWidth>0,transform:getComputedStyle(n).transform}))`);
    assert.ok(images.length>0,mode+' art missing');for(const img of images){assert.equal(img.fit,'contain');assert.ok(img.loaded,'image decode');assert.equal(img.transform,'none');}
    if(mode==='comparison'&&v[0]<=374)assert.equal((await measure(contents)).columns.split(' ').length,1,'comparison must stack');
    const batch=(mode==='potion'||mode==='chest')?await check('#v17350BatchAction',v):null;
    if(mode==='potion'||mode==='material')assert.ok(await c.eval(`document.getElementById('itemEquipButton').disabled`),'non-equipment must not offer equip');
    if(mode==='potion')assert.ok(await c.eval(`Number(document.getElementById('v17350BatchQuantity').max)>=100000`),'large owned count not exercised');
    const textSizes=await c.eval(`Array.from(document.querySelectorAll('#itemModalName,#itemModalStats div,#itemModalStats b,.v17351-compare-stat span,.v17351-compare-stat b,.v17351-compare-pane>strong,#v17350BatchAction label,#v17350BatchAction input,#v17350BatchAction span,#v17350BatchAction button,#itemModal .item-modal-buttons button')).filter(n=>n.getBoundingClientRect().width>0).map(n=>({text:(n.textContent||n.value||'').slice(0,40),size:parseFloat(getComputedStyle(n).fontSize)*n.getBoundingClientRect().width/n.offsetWidth}))`);for(const t of textSizes)assert.ok(t.size>=12.9,'unreadable text '+JSON.stringify(t));
    const controlHits=await actionable();await screenshot(mode+'-'+v.join('x'));
    await check('#itemAcquisitionButton',v,true);
    const beforeAcquisition=await c.eval('JSON.stringify({items:inventoryItems,gold,party:getExistingPartyIndexes().map(getPartyCharacterByIndex)})');
    await click('#itemAcquisitionButton',v);
    const acquisition=await check('#v132RewardModal .v132-reward-modal-inner',v);
    const sourceText=await c.eval("document.getElementById('v132RewardModal').textContent");
    if(mode==='chest')assert.ok(sourceText.includes('材料副本'),'chest true origin missing');
    if(mode==='potion')assert.ok(sourceText.includes('材料寶箱')&&sourceText.includes('商店')&&sourceText.includes('材料副本'),'multiple sources / ancestry missing');
    if(mode==='material')assert.ok(sourceText.includes('目前版本尚無正式取得途徑'),'missing source state not shown');
    assert.equal(await c.eval('JSON.stringify({items:inventoryItems,gold,party:getExistingPartyIndexes().map(getPartyCharacterByIndex)})'),beforeAcquisition,'read-only acquisition changed player state');
    await scroll('#v132RewardModal .v132-preview-list-scroll');await screenshot('acquisition-'+mode+'-'+v.join('x'));
    await c.eval('v132CloseRewardModal()');await settle();

    const contentScroll=await scroll(contents);modes.push({mode,frame,actions,back,names,art,batch,contentScroll,textSizes,controlHits});
    // Resize while open; the state and fixed controls must survive.
    await resize([v[0],v[1]-80]);await check('#itemModal .item-modal-buttons',[v[0],v[1]-80]);await actionable();assert.equal((await measure('#itemModal')).mode,expected);await resize(v);
    await click(mode==='comparison'?'.v17351-compare-back':'#itemModal .close-item-button',v);
    const clean=await c.eval(`({show:document.getElementById('itemModal').classList.contains('show'),mode:document.getElementById('itemModal').dataset.presentationMode,compare:!!document.getElementById('v17351EquipmentCompare'),batch:!!document.getElementById('v17350BatchAction')})`);
    assert.equal(clean.show,false);assert.equal(clean.mode,undefined);assert.equal(clean.compare,false);assert.equal(clean.batch,false);
   }
   // Supplement synthetic aspect-ratio stress with the real equipment generator,
   // formal rarity markup and production artwork on both detail paths.
   await c.eval(`window.__realGear=v17346GenerateEquipment(()=>0.2,{slot:'armor',classType:'warrior',rarity:'white'});characterEquipment.fire.armor=__realGear;inventoryItems[0]=v17346GenerateEquipment(()=>0.2,{slot:'armor',classType:'warrior',rarity:'orange'});rebuildInventorySlots();renderInventory();openEquippedItem(__realGear,'armor')`);await settle();
   await check('#itemModal .item-modal-box',v);await check('#itemModalIcon',v);await check('#itemEquipButton',v,true);assert.equal(await c.eval(`document.getElementById('itemEquipButton').textContent.trim()`),'脫下');await check('#itemModal .close-item-button',v,true);
   const realImage=await c.eval(`(async()=>{const n=document.querySelector('#itemModalIcon img');await n.decode();return {src:n.getAttribute('src'),fit:getComputedStyle(n).objectFit,loaded:n.naturalWidth>0}})()`);assert.ok(realImage.src.startsWith('assets/equipment/'));assert.equal(realImage.fit,'contain');assert.ok(realImage.loaded);await screenshot('equipment-real-'+v.join('x'));await click('#itemModal .close-item-button',v);
   await c.eval(`openItemModal(inventorySlots.findIndex(i=>i?.id===inventoryItems[0].id))`);await settle();await check('.v17351-compare-grid',v);await check('.v17351-compare-back',v,true);await screenshot('comparison-real-'+v.join('x'));await click('.v17351-compare-back',v);
   await c.eval(`showPage('home');openHomeFeature('shop');v17346PreviewEquipmentShopOffer(0)`);await settle();
   const shop=await check('.v17346-shop-preview-modal',v),shopArt=await check('.v17346-shop-preview-art',v),shopBack=await check('.v17346-shop-preview-modal .v132-reward-actions button',v,true);
   assert.ok(Math.abs(shopArt.rect.width-shopArt.rect.height)<1,'shop art distorted');
   const shopImages=await c.eval(`Array.from(document.querySelectorAll('.v17346-shop-preview-art img')).map(n=>({fit:getComputedStyle(n).objectFit,loaded:n.complete&&n.naturalWidth>0}))`);assert.ok(shopImages.length);for(const img of shopImages){assert.equal(img.fit,'contain');assert.ok(img.loaded);}
   await resize([v[0],v[1]-80]);await check('.v17346-shop-preview-modal .v132-reward-actions button',[v[0],v[1]-80]);await screenshot('shop-short-'+v.join('x'));await resize(v);await screenshot('shop-'+v.join('x'));
   await click('.v17346-shop-preview-modal .v132-reward-actions button',v);await c.eval(`closeHomeFeature()`);
   // Load later feature styles before re-entering the same inventory owner.
   await c.eval(`(async()=>{await FourSymbolsFeatures.ensure('skill','responsive-item-qa');await FourSymbolsFeatures.ensure('relic','responsive-item-qa')})()`);
   const entrances=[];
   for(const source of ['home','map','gameplay','boss','tower','training']){
    await c.eval(`showPage(${JSON.stringify(source)})`);await settle();
    const selected=await c.eval(`(()=>{const all=[...document.querySelectorAll(${JSON.stringify(source==='home'?'#bottomNav [onclick*="inventory"]':'[onclick*="v148OpenContextInventory"],[onclick*="openMapInventoryOverlay"]')})];const n=all.find(n=>{const r=n.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(n).visibility!=='hidden'});if(!n)throw Error('missing visible inventory entrance '+${JSON.stringify(source)});n.dataset.responsiveQaEntrance='active';return {selector:'[data-responsive-qa-entrance="active"]',handler:n.getAttribute('onclick')}})()`);
    await click(selected.selector,v);
    await check('.inventory-title-plate',v);await check('.inventory-bottom-actions',v);
    await click('.map-inventory-overlay-close',v);
    const closed=await c.eval(`!document.getElementById('app').classList.contains('on-inventory-page')`);assert.ok(closed,'inventory did not restore '+source);
    await c.eval(`document.querySelectorAll('[data-responsive-qa-entrance="active"]').forEach(n=>n.removeAttribute('data-responsive-qa-entrance'))`);
    // Re-enter from the same existing entrance after its formal source restore.
    await c.eval(`showPage(${JSON.stringify(source)})`);await settle();
    const again=await c.eval(`(()=>{const nodes=[...document.querySelectorAll(${JSON.stringify(source==='home'?'#bottomNav [onclick*="inventory"]':'[onclick*="v148OpenContextInventory"],[onclick*="openMapInventoryOverlay"]')})];const n=nodes.find(n=>{const r=n.getBoundingClientRect();return r.width>0&&r.height>0});if(!n)throw Error('missing re-entry');n.dataset.responsiveQaEntrance='active';return true})()`);
    assert.ok(again);await click(selected.selector,v);await check('.inventory-bottom-actions',v);await click('.map-inventory-overlay-close',v);
    await c.eval(`document.querySelectorAll('[data-responsive-qa-entrance="active"]').forEach(n=>n.removeAttribute('data-responsive-qa-entrance'))`);
    entrances.push({source,handler:selected.handler,closed,reentered:true});
   }
   evidence.push({viewport:v,backpack,backpackControlHits,grid,gridScroll,modes,realImage,shop,shopArt,shopBack,entrances});
   await c.eval(`showPage('inventory')`);await settle();const shot=await c.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(OUT,`backpack-${v.join('x')}.png`),Buffer.from(shot.data,'base64'));
   console.log('PASS responsive production runtime '+v.join('x')+' modes + resize + entrances + late styles');
  }
  const revive=await c.eval(`(async()=>{
   const wait=async(predicate,label)=>{const end=Date.now()+15000;while(!predicate()&&Date.now()<end)await new Promise(r=>setTimeout(r,30));if(!predicate())throw Error(label);};
   closeItemModal();closeHomeFeature();
   player2=buildAdditionalCharacter('Revival QA ally','water','male');registerAdditionalCharacter(2,player2);
   autoBattle=false;autoConfig.enabled=false;autoConfig2.enabled=false;autoConfig3.enabled=false;
   player.hp=getPartyBattleStats(0).maxHP;
   const enemy=MonsterBalance.build({monsterKey:'qa.revival',name:'Revival QA enemy',level:10,element:'fire',archetype:'balanced',rank:'regular',mode:'wild',context:'qa/revival'});
   Object.assign(enemy,{hp:100000,maxHP:100000,skillIds:[],v132FixedSkillLoadout:true});monsters=[enemy];currentZone='forest';mapCooldown=false;
   const originalSave=saveGame;let releasePause,releaseFinish;
   try{
    startBattle(0);await wait(()=>battleActive&&turn>=1,'revival battle start');clearInterval(timerId);
    releasePause=FourSymbolsBattleFlow.acquirePauseLock('revival-item-qa');
    player2.hp=0;player2.sp=17;updateUI();await new Promise(requestAnimationFrame);battlePhase='declare';activeBattleCharacterIndex=0;actionReady=false;pendingAction=null;queuedPlayerActions={};
    saveGame=()=>true;addPotionToInventory('revivalPill',2);const count=getPotionCount('revivalPill');
    usePotion('revivalPill');const card=document.getElementById('battlePlayerCard1');
    const marked=card.classList.contains('ally-targetable')&&card.classList.contains('v148-revive-target');
    selectBattleAllyTarget(0);const rejected=!queuedPlayerActions[0]&&getPotionCount('revivalPill')===count;
    let finishes=0;releaseFinish=FourSymbolsBattleFlow.interceptActionFinish(()=>{finishes++;return true;});
    selectBattleAllyTarget(1);const queued=queuedPlayerActions[0];
    applyPotionEffect(queued.potionId,0,queued.targetAlly);
    await wait(()=>player2.hp===35,'shared revival impact');await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);
    const revived={hp:player2.hp,sp:player2.sp,count:getPotionCount('revivalPill'),marked,rejected,finished:finishes,defeated:document.getElementById('battlePlayerCard1').classList.contains('v146-defeated'),living:getLivingParty().includes(1),initiative:buildInitiativeQueue().some(row=>row.type==='player'&&row.characterIndex===1),auto:getAutoPotionId('revive')};
    await wait(()=>!window.v142SkillAnimationDirector?.getActive?.()||window.v142SkillAnimationDirector.getActive().done,'revival animation complete');return {...revived,beforeCount:count};
   }finally{saveGame=originalSave;battleActive=false;battleToken++;clearInterval(timerId);releaseFinish?.();releasePause?.();window.v142SkillAnimationDirector?.cancelAll?.();}
  })()`);
  assert.equal(revive.hp,35);assert.equal(revive.sp,17);assert.equal(revive.count,revive.beforeCount-1);assert.ok(revive.marked&&revive.rejected&&revive.living&&revive.initiative,JSON.stringify(revive));assert.equal(revive.defeated,false);assert.equal(revive.auto,null);
  evidence.push({revival:revive});console.log('PASS manual revival: dead target / one item / HP35 / unchanged SP / living UI / initiative');
  await resize([360,640]);
  await c.eval("(async()=>{await FourSymbolsFeatures.ensure('feature-boss-relic','acquisition-qa');showPage('home');v174OpenRelicDetail('relic_xuanwu_seal');})()");
  await c.eval("(async()=>{const until=Date.now()+20000;while(!document.querySelector('[data-relic-source=\"relic_xuanwu_seal\"]')&&Date.now()<until)await new Promise(r=>setTimeout(r,30));if(!document.querySelector('[data-relic-source=\"relic_xuanwu_seal\"]'))throw Error('formal relic renderer did not decorate acquisition');})()");await settle();
  const beforeRelicSource=await c.eval('JSON.stringify({items:inventoryItems,gold,player})');
  await c.eval("document.querySelector('[data-relic-source=\"relic_xuanwu_seal\"]').scrollIntoView({block:'center'})");await settle();
  const relicControl=await check('[data-relic-source="relic_xuanwu_seal"]',[360,640],true);assert.ok(relicControl.projectedFont>=13&&relicControl.rect.height>=44);
  await click('[data-relic-source="relic_xuanwu_seal"]',[360,640]);
  await check('#v132RewardModal .v132-reward-modal-inner',[360,640]);
  const relicSourceText=await c.eval("document.getElementById('v132RewardModal').textContent");
  assert.ok(relicSourceText.includes('第一位角色達Lv.20')&&relicSourceText.includes('雪獄尊')&&relicSourceText.includes('第25層'),'complete relic direct/fragment/chest ancestry missing');
  assert.equal(await c.eval('JSON.stringify({items:inventoryItems,gold,player})'),beforeRelicSource,'relic acquisition UI changed owned state');
  await screenshot('acquisition-relic-360x640');await c.eval('v132CloseRewardModal()');
  evidence.push({relicAcquisition:true});console.log('PASS relic acquisition: Lv20 direct unlock / fragment Boss / Tower ancestry / read-only');
  await checkDisplay('late-features-reentry');
  // Phase 2 regressions use the final production owners, including lazy CSS.
  // A viewport fit is insufficient: general pages must have no transformed
  // ancestor, retain real CSS pixels, and actually reflow on wide displays.
  for(const v of DISPLAY_VIEWPORTS){
   await resize(v);await c.eval("closeItemModal();closeHomeFeature();showPage('home')");await settle();
   const home=await check('#homePage',v),nav=await check('#game-ui #bottomNav',v);
   const domain=await c.eval(`(()=>{const n=document.getElementById('homePage');const ancestors=[];for(let p=n;p;p=p.parentElement)ancestors.push(getComputedStyle(p).transform);return {parent:n.parentElement.id,ancestors,navParent:document.getElementById('bottomNav').parentElement.parentElement.id,resources:[...n.querySelectorAll('.home-hud-resources b,.v146-home-resource strong')].map(n=>parseFloat(getComputedStyle(n).fontSize))};})()`);
   assert.equal(domain.parent,'game-ui');assert.equal(domain.navParent,'game-ui');
   assert.ok(domain.ancestors.every(t=>t==='none'),'browser UI inherited a transform');
   assert.ok(domain.resources.every(size=>size>=13),'browser home text below reading minimum');
   assert.ok(home.rect.bottom<=nav.rect.top+1,'navigation overlaps browser page');
   if(v[0]>=800)assert.ok(home.rect.width>700,'desktop remained a narrow stage projection');
   await c.eval("adventureHomeEntry.scrollIntoView({block:'nearest'})");await settle();
   await check('#adventureHomeEntry',v,true);
   const entrance=await c.eval(`(()=>{const entry=adventureHomeEntry,r=entry.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);const axis=adventureHomeAxis.getBoundingClientRect(),cards=document.querySelector('.home-card-grid').getBoundingClientRect(),roster=document.getElementById('v146HomeRoster').getBoundingClientRect();return {hit:entry===hit||entry.contains(hit),afterContent:axis.top>=Math.max(cards.bottom,roster.bottom)-1};})()`);
   assert.ok(entrance.hit&&entrance.afterContent,'adventure entrance overlaps or covers home controls');
   await c.eval("showPage('inventory')");await settle();
   const bag=await check('#inventoryPage',v),frame=await measure('.inventory-classic-shell');
   if(v[0]>=800)assert.ok(frame.columns.split(' ').length===2,'desktop bag did not use two columns');
   await check('.inventory-bottom-actions',v);await check('.map-inventory-overlay-close',v,true);
   await c.eval("closeMapInventoryOverlay();showPage('training')");await settle();
   assert.equal(await c.eval("bottomNav.parentElement.parentElement.id"),'game-overlay-layer','native return lost navigation domain');
   await c.eval("openHomeFeature('character')");await settle();
   const character=await check('#homeFeatureModal .home-feature-modal-box',v);
   assert.ok(character.rect.width<=961,'character ignored shared Large Panel limit');
   await c.eval("closeHomeFeature();openHomeFeature('shop')");await settle();
   const shopGrid=await check('.shop-potion-list',v);
   if(v[0]>=1100)assert.ok(shopGrid.columns.split(' ').length>=3,'desktop shop grid remained mobile columns');
   await c.eval("closeHomeFeature();openHomeFeature('relic')");
   await c.eval("(async()=>{const end=Date.now()+20000;while(!document.querySelector('.team-relic-grid')&&Date.now()<end)await new Promise(r=>setTimeout(r,30));if(!document.querySelector('.team-relic-grid'))throw Error('relic list missing');})()");await settle();
   const relicGrid=await measure('.team-relic-grid');
   assert.ok(relicGrid.overflow<=1,'relic list gained horizontal overflow');
   await check('#homeFeatureModalBody',v);
   await c.eval("document.querySelector('.team-relic-grid > :last-child').scrollIntoView({block:'end'})");await settle();
   await check('.team-relic-grid > :last-child',v);
   if(v[0]>=1100)assert.ok(relicGrid.columns.split(' ').length>=3,'desktop relic grid remained mobile columns');
   await c.eval("closeHomeFeature();showPage('home')");
   evidence.push({generalUi:true,viewport:v,home,nav,bag,character,domain,entrance,shopGrid,relicGrid});
  }
  console.log('PASS general browser UI: eight widths, desktop reflow, reading size, shared panel and native return');
  const visibility=await c.eval(`(async()=>{const source=document.getElementById('gameInterface'),ui=document.getElementById('game-ui'),previous=source.style.display;source.style.display='none';await new Promise(requestAnimationFrame);const hidden=ui.hidden;source.style.display=previous;await new Promise(requestAnimationFrame);return {hidden,restored:!ui.hidden,roots:document.querySelectorAll('#game-ui').length};})()`);
  assert.deepEqual(visibility,{hidden:true,restored:true,roots:1},'browser boundary lost original interface visibility/reentry lifecycle');
  evidence.push({generalVisibility:visibility});
  return evidence;
 }catch(error){if(c){try{const shot=await c.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(OUT,'failure.png'),Buffer.from(shot.data,'base64'));}catch{}}error.evidence=evidence;if(browserError){error.message+="\nBrowser: "+browserError;error.stack+="\nBrowser: "+browserError;}throw error;}finally{c?.close();proc.kill('SIGTERM');try{fs.rmSync(profile,{recursive:true,force:true});}catch{}}
}
fs.mkdirSync(OUT,{recursive:true});let local;
try{
 const live=!!process.env.DEV_BASE_URL;let url;
 if(live){
  url=new URL('index.html',process.env.DEV_BASE_URL.replace(/\/$/,'')+'/').href;
  const deployed=await (await fetch(new URL('release-manifest.json',url),{cache:'no-store'})).json();
  assert.ok(process.env.EXPECTED_COMMIT_SHA,'live QA requires expected deployment SHA');assert.equal(deployed.commitSha,process.env.EXPECTED_COMMIT_SHA,'deployed SHA mismatch');
  const manifest=await (await fetch(new URL('build/asset-manifest.json',url),{cache:'no-store'})).json();assert.deepEqual(manifest,ASSET_MANIFEST,'deployed production bundles mismatch');
 }else {local=await startServer();url=local.url;}
 const evidence=await run(findChrome(),url,live);
 fs.writeFileSync(path.join(OUT,'evidence.json'),JSON.stringify({passed:true,environment:live?'deployed-site':'production-local',sha:process.env.EXPECTED_COMMIT_SHA||process.env.GITHUB_SHA||null,evidence},null,2)+'\n');
 console.log('Responsive Item real runtime QA PASS: 6/6 viewports + manual revival');
}catch(error){fs.writeFileSync(path.join(OUT,'evidence.json'),JSON.stringify({passed:false,error:String(error.stack||error),evidence:error.evidence||[]},null,2)+'\n');throw error;}finally{local?.server.close();}
