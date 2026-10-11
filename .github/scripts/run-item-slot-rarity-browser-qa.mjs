import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {startServer,waitJson,Cdp,findChrome} from './runtime-browser-qa-support.mjs';

// Existing isolated account transport; all UI, generation, CSS and lifecycle
// owners come from the complete production bundles. Never touches a player UID.
const server=await startServer();
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'item-slot-qa-'));
const port=9871;
const proc=spawn(findChrome(),['--headless=new','--no-sandbox','--disable-gpu','--remote-debugging-port='+port,'--user-data-dir='+profile,'about:blank'],{stdio:'ignore',windowsHide:true});
const dir='artifacts/item-slot-rarity';fs.mkdirSync(dir,{recursive:true});
let c;const evidence=[];
const ready=`(async()=>{const end=Date.now()+60000;while((window.FourSymbolsStartupPolicy?.getState?.()!=='READY'||document.getElementById('startupLoader')?.hidden!==true||document.getElementById('firebaseAuthOverlay')?.classList.contains('show'))&&Date.now()<end)await new Promise(r=>setTimeout(r,100));if(FourSymbolsStartupPolicy.getState()!=='READY'||document.getElementById('firebaseAuthOverlay')?.classList.contains('show'))throw Error('visible startup not ready');await FourSymbolsFeatures.ensure('gameplay-core','item-slot-qa');autoBattle=false;autoPatrolEnabled=false;return true;})()`;
const snapshot=`window.__slotSnapshot=e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return {rarity:e.dataset.itemRarity,color:s.borderTopColor,background:s.backgroundImage,backgroundColor:s.backgroundColor,radius:s.borderRadius,width:r.width,height:r.height,left:r.left,right:r.right,top:r.top,bottom:r.bottom};};true`;
async function capture(label){const shot=await c.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(dir,label+'.png'),Buffer.from(shot.data,'base64'));}
try{
 const tabs=await waitJson('http://127.0.0.1:'+port+'/json/list');c=new Cdp(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
 await c.send('Page.enable');await c.send('Runtime.enable');
 for(const [width,height] of [[1080,1920],[390,844],[412,915]]){
  await c.send('Storage.clearDataForOrigin',{origin:new URL(server.url).origin,storageTypes:'local_storage'});
  await c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});
  await c.send('Page.navigate',{url:server.url});await c.eval(ready);await c.eval(snapshot);
  await c.eval("closeHomeFeature();showPage('home');openHomeFeature('shop');v169SwitchShopPage('potion');");
  const quantities=await c.eval(`(()=>{const input=document.querySelector('.shop-potion-quantity');if(!input)throw Error('quantity missing');const row=input.closest('.shop-potion-purchase-row'),price=row.querySelector('.v146-shop-total'),buy=row.querySelector('button');const results=[];for(const value of ['1','12','999']){input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));results.push({value:input.value,input:__slotSnapshot(input),price:__slotSnapshot(price),buy:__slotSnapshot(buy),overflow:input.scrollWidth-input.clientWidth,limit:input.max});}return results;})()`);
  for(const q of quantities){assert.ok(q.input.width>=47);assert.ok(q.price.width>=56);assert.ok(q.buy.width>=54&&q.buy.height>=42);assert.ok(q.input.right<=q.price.left&&q.price.right<=q.buy.left);assert.ok(q.overflow<=1);assert.equal(q.limit,'999');}
  await capture(width+'-potions');
  await c.eval("v169SwitchShopPage('equipment');");
  const shop=await c.eval(`(()=>{return [...document.querySelectorAll('.v17346-shop-card')].map(card=>({key:card.dataset.rarity,slot:__slotSnapshot(card.querySelector('.v169-item-art')),name:getComputedStyle(card.querySelector('.equipment-rarity-name')).color}));})()`);
  assert.equal(shop.length,6);for(const row of shop){assert.equal(row.slot.rarity,row.key);assert.equal(row.slot.color,row.name);assert.ok(row.slot.background.includes('0.25'));}
  await c.eval("v17346PreviewEquipmentShopOffer(0)");
  const preview=await c.eval(`(()=>{const modal=document.querySelector('.v17346-shop-preview-modal');return {slot:__slotSnapshot(modal.querySelector('.v169-item-art')),name:getComputedStyle(modal.querySelector('.equipment-rarity-name')).color};})()`);
  assert.equal(preview.slot.color,preview.name);assert.ok(preview.slot.background.includes('0.25'));await capture(width+'-shop-preview');
  await c.eval(`v132CloseRewardModal();closeHomeFeature();inventoryItems.splice(0,inventoryItems.length,...['white','blue','purple','orange','pink','four-symbol'].map((rarityKey,i)=>({id:'slot-qa-'+i,v141Uid:'slot-qa-'+i,type:'armor',name:'階級測試 '+rarityKey,count:1,stats:{defensePoints:5},reforgeSlots:1,rarityKey,icon:'<span class="v169-item-art v169-equipment-art"><svg viewBox="0 0 64 64"><path fill="gold" d="M12 12h40v40H12z"/></svg></span>'})));showPage('inventory');setInventoryFilter('equipment');renderInventory();`);
  const bag=await c.eval(`(()=>{return [...document.querySelectorAll('#inventoryGrid .has-item')].map(e=>({slot:__slotSnapshot(e),art:__slotSnapshot(e.querySelector('.v169-item-art')),neutral:e.querySelector('.v169-item-art').classList.contains('inventory-backpack-rarity-neutral')}));})()`);
  assert.equal(bag.length,6);for(const row of bag){assert.equal(row.slot.radius,'0px');assert.ok(row.slot.background.includes('0.25'));assert.equal(row.neutral,true);assert.equal(row.art.backgroundColor,'rgba(0, 0, 0, 0)');assert.equal(row.art.radius,'0px');}
  const worn=[];
  for(let index=0;index<6;index++){
   const state=await c.eval(`(()=>{const item=inventoryItems[${index}];characterEquipment[getBackpackEquipmentKey(0)].armor=item;renderEquipment();const slot=[...document.querySelectorAll('#equipmentGrid .has-item')].find(e=>e.title===item.name);return {slot:__slotSnapshot(slot),inner:__slotSnapshot(slot.querySelector('.v169-item-art'))};})()`);
   assert.equal(state.slot.rarity,bag[index].slot.rarity);assert.equal(state.slot.color,bag[index].slot.color);assert.ok(state.slot.background.includes('0.25'));assert.equal(state.slot.radius,'0px');assert.equal(state.inner.backgroundColor,'rgba(0, 0, 0, 0)');worn.push(state);
  }
  await c.eval("characterEquipment[getBackpackEquipmentKey(0)].armor=null;renderEquipment();");
  const empty=await c.eval(`(()=>{const slot=[...document.querySelectorAll('#equipmentGrid .inventory-equipment-slot')].find(e=>!e.classList.contains('has-item'));return {slot:__slotSnapshot(slot),text:slot.textContent,shared:slot.classList.contains('item-slot')};})()`);
  assert.equal(empty.shared,false);assert.equal(empty.slot.rarity,undefined);assert.ok(empty.text.includes('＋'));
  await capture(width+'-inventory');
  const detail=[];
  for(let index=0;index<6;index++){
   const state=await c.eval(`(()=>{openItemModal(${index});const name=document.querySelector('#itemModalName .equipment-rarity-name'),compare=document.querySelector('.v17351-compare-pane.selected .equipment-rarity-name'),art=document.querySelector('.v17351-compare-pane.selected .v169-item-art');return {name:getComputedStyle(name).color,compare:getComputedStyle(compare).color,slot:__slotSnapshot(art)};})()`);
   assert.equal(state.name,state.compare);assert.equal(state.slot.color,bag[index].slot.color);assert.ok(state.slot.background.includes('0.25'));detail.push(state);await c.eval('closeItemModal()');
  }
  const longName=await c.eval("inventoryItems[0].name='千年玄鐵古銅長名稱裝備測試'.repeat(3);openItemModal(0);(()=>{const n=document.querySelector('#itemModal .item-modal-box');return n.scrollWidth-n.clientWidth})()");assert.ok(longName<=1,'long name must wrap without horizontal overflow');await c.eval('closeItemModal()');
  await c.eval("openHomeFeature('forge');v141SwitchSynthesisTab('reforge');");
  const forge=await c.eval("[...document.querySelectorAll('.v141-forge-option .equipment-rarity-name')].map(n=>getComputedStyle(n).color)");assert.equal(forge.length,6);for(let i=0;i<6;i++)assert.equal(forge[i],detail[i].name);await c.eval('closeHomeFeature()');
  const errors=await c.eval("document.documentElement.scrollWidth>innerWidth");assert.equal(errors,false);
  evidence.push({width,height,quantities,shop,preview,bag,worn,empty,detail});
 }
 fs.writeFileSync(path.join(dir,'evidence.json'),JSON.stringify(evidence,null,2));
 console.log('PASS: complete production bundles; 1080×1920, 390×844, 412×915; quantity 1/12/999, six rarity slots, shop/detail/name, full bag/worn backgrounds, empty lifecycle');
}finally{c?.close();proc.kill();await new Promise(r=>server.server.close(r));}
