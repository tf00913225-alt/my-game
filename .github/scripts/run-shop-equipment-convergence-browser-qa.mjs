import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import http from 'node:http';
import {startServer,waitJson,Cdp,findChrome,QA_CLOUD_PATH,QA_CLOUD_MODULE} from './runtime-browser-qa-support.mjs';
const baseUrl=process.env.DEV_BASE_URL||'';
if(baseUrl){const manifest=await fetch(new URL('release-manifest.json',baseUrl)).then(r=>r.json());assert.equal(manifest.commitSha,process.env.EXPECTED_COMMIT_SHA);}
const server=await startServer({baseUrl});
// The disposable account transport echoes only its own saved fixture snapshot
// on reload, avoiding the shared fixture's intentionally stale Cloud conflict.
// Production auth/save/session modules and player accounts are never changed.
const cloudFixture=QA_CLOUD_MODULE.replace('const save=','const initialSave=').replace('gameSave:save','gameSave:JSON.parse(localStorage.getItem("four_symbols_save:skill-runtime-browser-qa")||"null")||initialSave');
const proxy=http.createServer(async(req,res)=>{
 if(String(req.url).split('?')[0]===QA_CLOUD_PATH&&req.headers['sec-fetch-dest']==='script'){res.writeHead(200,{'content-type':'text/javascript','cache-control':'no-store'});res.end(cloudFixture);return;}
 try{const upstream=await fetch(new URL(req.url,server.url),{headers:{'sec-fetch-dest':String(req.headers['sec-fetch-dest']||'')}});res.writeHead(upstream.status,{'content-type':upstream.headers.get('content-type')||'text/plain','cache-control':'no-store'});res.end(Buffer.from(await upstream.arrayBuffer()));}catch(e){res.writeHead(502);res.end(String(e));}
});await new Promise(r=>proxy.listen(0,'127.0.0.1',r));const qaUrl='http://127.0.0.1:'+proxy.address().port+'/index.html';
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'shop-equipment-'));
const port=9782;
const proc=spawn(findChrome(),['--headless=new','--no-sandbox','--disable-gpu','--remote-debugging-port='+port,'--user-data-dir='+profile,'about:blank'],{stdio:'ignore',windowsHide:true});
const dir=process.env.SHOP_QA_ARTIFACT_DIR||'artifacts/shop-equipment/after';fs.mkdirSync(dir,{recursive:true});
let c;const evidence=[];
const ready=String.raw`(async()=>{const end=Date.now()+60000;while((window.FourSymbolsStartupPolicy?.getState?.()!=='READY'||document.getElementById('startupLoader')?.hidden!==true||document.getElementById('firebaseAuthOverlay')?.classList.contains('show'))&&Date.now()<end)await new Promise(r=>setTimeout(r,100));if(window.FourSymbolsStartupPolicy?.getState?.()!=='READY'||document.getElementById('startupLoader')?.hidden!==true||document.getElementById('firebaseAuthOverlay')?.classList.contains('show'))throw Error('visible startup not ready');await FourSymbolsFeatures.ensure('gameplay-core','shop-equipment-qa');autoBattle=false;autoPatrolEnabled=false;closeHomeFeature();openHomeFeature('shop');v169SwitchShopPage('equipment');return true;})()`;
const snapshot=String.raw`(async()=>{const fadeEnd=Date.now()+1500;while(document.getElementById('v169RpgDialogLayer')&&Number(getComputedStyle(document.getElementById('v169RpgDialogLayer')).opacity)>0&&Date.now()<fadeEnd)await new Promise(r=>setTimeout(r,16));const cards=[...document.querySelectorAll('.v17346-shop-card')];if(cards.length!==6)throw Error('six cards required');await Promise.all(cards.map(async card=>{const art=card.querySelector('.v169-item-art img');if(['purple','orange'].includes(card.dataset.rarity)){if(art||card.querySelector('.v169-item-art')?.dataset.assetState!=='missing')throw Error('high-tier legacy art fallback');return;}if(!art)throw Error('white/blue art missing');await art.decode();if(art.hidden||!art.naturalWidth)throw Error('broken icon');}));if(document.getElementById('firebaseAuthOverlay')?.classList.contains('show'))throw Error('auth overlay covers shop');const shop=document.querySelector('.v17345-equipment-shop');if(getComputedStyle(shop).visibility==='hidden'||shop.getBoundingClientRect().height<1)throw Error('shop not visible');return {gold,count:inventoryItems.length,cards:cards.map(card=>({id:card.dataset.offerId,name:card.querySelector('.v17346-shop-name').textContent,stat:card.querySelector('.v17346-stat').textContent,rarity:card.dataset.rarity,slot:card.querySelector('.v17346-shop-slot').textContent,asset:card.querySelector('img')?.getAttribute('src')||null,assetState:card.querySelector('.v169-item-art')?.dataset.assetState||'ready',button:card.querySelector('button').textContent,disabled:card.querySelector('button').disabled,rect:card.getBoundingClientRect().toJSON()})),overflow:document.documentElement.scrollWidth>innerWidth};})()`;
async function capture(width,stage){const state=await c.eval(snapshot);const image=await c.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(dir,width+'-'+stage+'.png'),Buffer.from(image.data,'base64'));evidence.push({width,stage,...state});assert.equal(state.overflow,false);return state;}
function sameOffers(a,b){assert.deepEqual(b.cards.map(({button,disabled,rect,...v})=>v),a.cards.map(({button,disabled,rect,...v})=>v));}
try{
 const tabs=await waitJson('http://127.0.0.1:'+port+'/json/list');c=new Cdp(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await c.send('Page.enable');await c.send('Runtime.enable');
 for(const [width,height] of [[390,844],[412,915]]){
  await c.send('Storage.clearDataForOrigin',{origin:new URL(qaUrl).origin,storageTypes:'local_storage'});await c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});await c.send('Page.navigate',{url:qaUrl});await c.eval(ready);
  await c.eval('gold=100000;saveGame();v169SwitchShopPage("equipment");true');const before=await capture(width,'A-before');
  const cost=Number(before.cards[0].button.replace(/[^0-9]/g,''));
  assert.deepEqual(await c.eval(`(()=>{const b=document.querySelector('.v17346-shop-buy');b.click();b.click();b.click();return {gold,count:inventoryItems.length,repeat:v17346BuyEquipmentShopOffer(0)};})()`),{gold:before.gold-cost,count:before.count+1,repeat:false});
  // Capture real success modal, then dismiss via its actual control.
  assert.equal(await c.eval(`document.getElementById('v169RpgDialogTitle')?.textContent`),'購買成功');
  await c.eval(`document.querySelector('.v169-rpg-dialog-button:last-child').click();true`);
  const bought=await capture(width,'B-purchased');sameOffers(before,bought);assert.equal(bought.cards[0].button,'已購買');assert.equal(bought.cards[0].disabled,true);assert.equal(bought.cards.filter(v=>v.disabled).length,1);
  const heldBeforeReload=await c.eval('inventoryItems.filter(item=>item.v17346GeneratedEquipment).map(({v141Uid,stats,reforgeStats})=>({v141Uid,stats,reforgeStats}))');
  const potion=await c.eval(`(()=>{v169SwitchShopPage('potion');return {cards:document.querySelectorAll('.shop-potion-card').length,max:[...document.querySelectorAll('.shop-potion-quantity')].map(v=>v.max)};})()`);assert.ok(potion.cards>0);assert.ok(potion.max.every(v=>v==='999'));
  await c.eval(`v169SwitchShopPage('equipment');true`);const tabsState=await capture(width,'C-tabs');sameOffers(bought,tabsState);assert.equal(tabsState.cards[0].button,'已購買');
  await c.eval(`closeHomeFeature();openHomeFeature('shop');true`);const reopen=await capture(width,'D-reopen');sameOffers(bought,reopen);assert.equal(reopen.cards[0].button,'已購買');
  await c.eval(`closeHomeFeature();openHomeFeature('achievement');closeHomeFeature();openHomeFeature('shop');true`);sameOffers(bought,await c.eval(snapshot));
  const eventIndex=c.events.length;await c.send('Page.reload',{ignoreCache:true});
  const loadEnd=Date.now()+30000;while(!c.events.slice(eventIndex).some(e=>e.method==='Page.loadEventFired')&&Date.now()<loadEnd)await new Promise(r=>setTimeout(r,50));
  await c.eval(ready);const reload=await capture(width,'E-reload');sameOffers(bought,reload);assert.equal(reload.cards[0].button,'已購買');assert.equal(reload.gold,bought.gold);assert.equal(reload.count,bought.count);assert.equal(await c.eval('v17346BuyEquipmentShopOffer(0)'),false);
  assert.deepEqual(await c.eval('inventoryItems.filter(item=>item.v17346GeneratedEquipment).map(({v141Uid,stats,reforgeStats})=>({v141Uid,stats,reforgeStats}))'),heldBeforeReload,'load must preserve owned equipment UIDs and rolled stats');
  // The established read-only Cloud fixture may project its account snapshot;
  // funds for the new batch are local QA setup, never a deployed account write.
  await c.eval('gold=100000;document.querySelector(".v17345-equipment-refresh button").click();true');const refresh=await capture(width,'F-refresh');assert.ok(refresh.cards.every(v=>!v.disabled&&v.button!=='已購買'));assert.ok(refresh.cards.every(v=>v.id!==bought.cards.find(b=>b.id===v.id)?.id));
  assert.deepEqual(await c.eval(`(()=>{const img=document.querySelector('.v17346-gear-art img');const art=img.parentElement;img.dispatchEvent(new Event('error'));return {state:art.dataset.assetState,label:art.getAttribute('aria-label'),fallback:art.textContent};})()`),{state:'broken',label:'裝備圖片無法載入',fallback:'◇'});
  await c.eval(`v169SwitchShopPage('potion');v169SwitchShopPage('equipment');true`);sameOffers(refresh,await c.eval(snapshot));
  console.log('Shop offer/render/reentry/reload/refresh production QA PASS '+width+'x'+height);
 }
 fs.writeFileSync(path.join(dir,'evidence.json'),JSON.stringify({passed:true,commitSha:process.env.EXPECTED_COMMIT_SHA||'local',evidence},null,2));
}catch(error){fs.writeFileSync(path.join(dir,'evidence.json'),JSON.stringify({passed:false,error:String(error.stack),evidence},null,2));throw error;}
finally{c?.close();proc.kill();await new Promise(r=>proxy.close(r));await new Promise(r=>server.server.close(r));}
