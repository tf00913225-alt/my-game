import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {startServer,waitJson,Cdp,findChrome} from './runtime-browser-qa-support.mjs';
const baseUrl=process.env.DEV_BASE_URL||'';
if(baseUrl){const manifest=await fetch(new URL('release-manifest.json',baseUrl)).then(r=>r.json());assert.equal(manifest.commitSha,process.env.EXPECTED_COMMIT_SHA);}
const server=await startServer({baseUrl});
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'shop-equipment-'));
const port=9782;
const proc=spawn(findChrome(),['--headless=new','--no-sandbox','--disable-gpu','--remote-debugging-port='+port,'--user-data-dir='+profile,'about:blank'],{stdio:'ignore',windowsHide:true});
const dir=process.env.SHOP_QA_ARTIFACT_DIR||'artifacts/shop-equipment/after';fs.mkdirSync(dir,{recursive:true});
let c;const evidence=[];
const ready=String.raw`(async()=>{const end=Date.now()+60000;while(window.FourSymbolsStartupPolicy?.getState?.()!=='READY'&&Date.now()<end)await new Promise(r=>setTimeout(r,100));if(window.FourSymbolsStartupPolicy?.getState?.()!=='READY')throw Error('startup not ready');await FourSymbolsFeatures.ensure('gameplay-core','shop-equipment-qa');autoBattle=false;autoPatrolEnabled=false;closeHomeFeature();openHomeFeature('shop');v169SwitchShopPage('equipment');return true;})()`;
const snapshot=String.raw`(async()=>{const cards=[...document.querySelectorAll('.v17346-shop-card')];if(cards.length!==6)throw Error('six cards required');await Promise.all(cards.map(async card=>{const art=card.querySelector('.v169-item-art img');if(!art)throw Error('glyph-only card');await art.decode();if(art.hidden||!art.naturalWidth)throw Error('broken icon');}));return {gold,count:inventoryItems.length,cards:cards.map(card=>({id:card.dataset.offerId,name:card.querySelector('.v17346-shop-name').textContent,stat:card.querySelector('.v17346-stat').textContent,rarity:card.dataset.rarity,slot:card.querySelector('.v17346-shop-slot').textContent,asset:card.querySelector('img').getAttribute('src'),button:card.querySelector('button').textContent,disabled:card.querySelector('button').disabled,rect:card.getBoundingClientRect().toJSON()})),overflow:document.documentElement.scrollWidth>innerWidth};})()`;
async function capture(width,stage){const state=await c.eval(snapshot);const image=await c.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(dir,width+'-'+stage+'.png'),Buffer.from(image.data,'base64'));evidence.push({width,stage,...state});assert.equal(state.overflow,false);return state;}
function sameOffers(a,b){assert.deepEqual(b.cards.map(({button,disabled,rect,...v})=>v),a.cards.map(({button,disabled,rect,...v})=>v));}
try{
 const tabs=await waitJson('http://127.0.0.1:'+port+'/json/list');c=new Cdp(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await c.send('Page.enable');await c.send('Runtime.enable');
 for(const [width,height] of [[390,844],[412,915]]){
  await c.send('Storage.clearDataForOrigin',{origin:new URL(server.url).origin,storageTypes:'local_storage'});await c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});await c.send('Page.navigate',{url:server.url});await c.eval(ready);
  await c.eval('gold=100000;saveGame();v169SwitchShopPage("equipment");true');const before=await capture(width,'A-before');
  const cost=Number(before.cards[0].button.replace(/[^0-9]/g,''));
  assert.deepEqual(await c.eval(`(()=>{const b=document.querySelector('.v17346-shop-buy');b.click();b.click();b.click();return {gold,count:inventoryItems.length,repeat:v17346BuyEquipmentShopOffer(0)};})()`),{gold:before.gold-cost,count:before.count+1,repeat:false});
  // Capture real success modal, then dismiss via its actual control.
  assert.equal(await c.eval(`document.getElementById('v169RpgDialogTitle')?.textContent`),'購買成功');
  await c.eval(`document.querySelector('.v169-rpg-dialog-button:last-child').click();true`);
  const bought=await capture(width,'B-purchased');sameOffers(before,bought);assert.equal(bought.cards[0].button,'已購買');assert.equal(bought.cards[0].disabled,true);assert.equal(bought.cards.filter(v=>v.disabled).length,1);
  const potion=await c.eval(`(()=>{v169SwitchShopPage('potion');return {cards:document.querySelectorAll('.shop-potion-card').length,max:[...document.querySelectorAll('.shop-potion-quantity')].map(v=>v.max)};})()`);assert.ok(potion.cards>0);assert.ok(potion.max.every(v=>v==='999'));
  await c.eval(`v169SwitchShopPage('equipment');true`);const tabsState=await capture(width,'C-tabs');sameOffers(bought,tabsState);assert.equal(tabsState.cards[0].button,'已購買');
  await c.eval(`closeHomeFeature();openHomeFeature('shop');true`);const reopen=await capture(width,'D-reopen');sameOffers(bought,reopen);assert.equal(reopen.cards[0].button,'已購買');
  await c.eval(`closeHomeFeature();openHomeFeature('achievement');closeHomeFeature();openHomeFeature('shop');true`);sameOffers(bought,await c.eval(snapshot));
  const eventIndex=c.events.length;await c.send('Page.reload',{ignoreCache:true});
  const loadEnd=Date.now()+30000;while(!c.events.slice(eventIndex).some(e=>e.method==='Page.loadEventFired')&&Date.now()<loadEnd)await new Promise(r=>setTimeout(r,50));
  await c.eval(ready);const reload=await capture(width,'E-reload');sameOffers(bought,reload);assert.equal(reload.cards[0].button,'已購買');assert.equal(await c.eval('v17346BuyEquipmentShopOffer(0)'),false);
  // The established read-only Cloud fixture may project its account snapshot;
  // funds for the new batch are local QA setup, never a deployed account write.
  await c.eval('gold=100000;document.querySelector(".v17345-equipment-refresh button").click();true');const refresh=await capture(width,'F-refresh');assert.ok(refresh.cards.every(v=>!v.disabled&&v.button!=='已購買'));assert.ok(refresh.cards.every(v=>v.id!==bought.cards.find(b=>b.id===v.id)?.id));
  console.log('Shop offer/render/reentry/reload/refresh production QA PASS '+width+'x'+height);
 }
 fs.writeFileSync(path.join(dir,'evidence.json'),JSON.stringify({passed:true,commitSha:process.env.EXPECTED_COMMIT_SHA||'local',evidence},null,2));
}catch(error){fs.writeFileSync(path.join(dir,'evidence.json'),JSON.stringify({passed:false,error:String(error.stack),evidence},null,2));throw error;}
finally{c?.close();proc.kill();await new Promise(r=>server.server.close(r));}
