import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {findChrome,startServer,waitJson,Cdp,ASSET_MANIFEST} from './runtime-browser-qa-support.mjs';
const out='artifacts/browser-qa';fs.mkdirSync(out,{recursive:true});
const baseUrl=process.env.QA_BASE_URL||'';
const expected=process.env.EXPECTED_COMMIT_SHA||process.env.GITHUB_SHA||'local';
if(baseUrl){const manifest=await (await fetch(baseUrl+'/release-manifest.json',{cache:'no-store'})).json();assert.equal(manifest.commitSha,expected);assert.equal(manifest.cacheVersion,ASSET_MANIFEST.release);}
const server=await startServer({baseUrl});
const bases=[['home',"showPage('home')"],['training',"showPage('training')"],['patrol',"enterMap()"],['daily',"leaveMap();vGameplayOpenDailyDungeons()"],['gameplay',"showPage('gameplay')"],['boss',"vGameplayOpenBoss()"],['tower',"vGameplayOpenTower()"],['abyss',"vGameplayOpenAbyss()"]];
const measure=`(()=>{const shell=document.querySelector('.native-bottom-nav-layer'),nav=document.getElementById('bottomNav'),r=nav.getBoundingClientRect();return {visible:!shell.hidden&&getComputedStyle(shell).display!=='none',shellCount:document.querySelectorAll('.native-bottom-nav-layer').length,navCount:document.querySelectorAll('#bottomNav').length,legacy:document.querySelectorAll('#mapPageNav,#v141DungeonNav').length,context:nav.dataset.navContext,signature:nav.dataset.navSignature,buttons:[...nav.children].map(n=>n.getAttribute('onclick')),hitboxes:nav.getClientRects().length,reason:FourSymbolsBottomNav.foregroundSuppressionReason(),active:document.querySelector('#game-content .page.active')?.id};})()`;
const rows=[];const results=[];
async function run(width,height){
 const port=9850+Math.floor(Math.random()*100),profile=fs.mkdtempSync(path.join(os.tmpdir(),'foreground-potion-'));
 const proc=spawn(findChrome(),['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--remote-debugging-port='+port,'--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});let c;
 try{
 const page=(await waitJson(`http://127.0.0.1:${port}/json/list`)).find(p=>p.type==='page');c=new Cdp(page.webSocketDebuggerUrl);
 await c.send('Page.enable');await c.send('Runtime.enable');await c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});
 await c.send('Page.navigate',{url:server.url});
 await c.eval(`(async()=>{for(let i=0;i<600;i++){if(window.FourSymbolsStartupPolicy?.getState?.()==='READY'&&document.getElementById('startupLoader')?.hidden)return;await new Promise(r=>setTimeout(r,50));}throw Error('Startup not ready');})()`);
 await c.eval("closeHomeFeature();showPage('home');openHomeFeature('character')");
 const cold=await c.eval(measure);assert.equal(cold.visible,false);assert.equal(cold.hitboxes,0);await c.eval('closeHomeFeature()');assert.equal((await c.eval(measure)).visible,true);
 await c.eval(`(async()=>{for(const f of ['gameplay-core','patrol','boss-tower','abyss'])await FourSymbolsFeatures.ensure(f,'foreground-potion-qa');closeHomeFeature();showPage('home');})()`);
 for(let pass=0;pass<2;pass++)for(const [base,action] of bases){
  await c.eval(action);const before=await c.eval(measure);assert.equal(before.visible,true,base+' base visible');
  const features=base==='home'?['character','inventory','relic','autoBattleSettings','shop','forge','rest','quest','achievement','notice','expPool','system','formation']:['character','inventory','relic','autoBattleSettings'];
  for(const feature of features){
   const open=feature==='inventory'?"openInventoryContext({sourcePage:document.querySelector('#game-content .page.active').id.replace(/Page$/,''),closeBehavior:'restore-source'})":feature==='relic'?"v148OpenContextRelic()":`openHomeFeature('${feature}')`;
   await c.eval(open);const immediate=await c.eval(measure);assert.equal(immediate.visible,false,base+'/'+feature+' immediate');assert.equal(immediate.hitboxes,0,'hidden hitbox');
   await c.eval('new Promise(r=>setTimeout(r,180))');const opened=await c.eval(measure);assert.equal(opened.visible,false,base+'/'+feature+' final');
   for(const key of ['shellCount','navCount'])assert.equal(opened[key],1);assert.equal(opened.legacy,0);
   if(pass===0&&['home','daily','abyss'].includes(base)&&['character','relic','autoBattleSettings','shop'].includes(feature)){
    const shot=await c.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(`${out}/foreground-${width}-${base}-${feature}.png`,Buffer.from(shot.data,'base64'));
   }
   await c.eval(feature==='inventory'?'closeMapInventoryOverlay()':'closeHomeFeature()');const closed=await c.eval(measure);
   assert.equal(closed.visible,true,base+'/'+feature+' restore');assert.equal(closed.context,before.context);assert.equal(closed.signature,before.signature);assert.deepEqual(closed.buttons,before.buttons);assert.equal(closed.active,before.active);
   rows.push({width,height,pass,base,feature,immediate,opened,closed});
  }
 }
 // Isolated QA-owned character values and stats fixture; all production callers,
 // inventory consumption and recovery rules remain the final loaded runtime.
 const potions=await c.eval(`(async()=>{
  closeHomeFeature();showPage('home');
  const originalStats=getPartyBattleStats,originalFinish=finishPlayerAction,originalAlert=window.alert,originalRpgAlert=window.rpgAlert,originalSave=saveGame;
  const oldInventory=inventoryItems.slice(),oldHP=player.hp,oldSP=player.sp,oldConfig={...autoConfig};
  const actualStats=originalStats(0);getPartyBattleStats=index=>index===0?{...actualStats,maxHP:4520,maxSP:1190}:originalStats(index);
  // Suppress only test feedback/save/action completion; do not replace a recovery or stock owner.
  finishPlayerAction=()=>{};window.alert=()=>{};window.rpgAlert=async()=>true;saveGame=()=>true;
  Object.assign(autoConfig,{enabled:true,hp:100,sp:100,returnToCityWhenEmpty:false});
  const rows=[];
  try{
   for(const route of ['battle','inventory-single','inventory-batch','post-battle','element-box']){
    for(const [id,resource,start,expected] of [['hpPotion10','hp',4000,4066],['hpPotion10','hp',4500,4520],['spPotion10','sp',1000,1066],['spPotion10','sp',1170,1190],['hpPotion20','hp',3000,3904],['hpPotion30','hp',3000,4356],['spPotion20','sp',500,738],['spPotion30','sp',500,857],['nineTurnRestorationPill','hp',4000,4520],['taichingQiPill','sp',1000,1190]]){
     if((route==='post-battle'||route==='element-box')&&getPotionDefinition(id).manualOnly)continue;
     inventoryItems.splice(0,inventoryItems.length);addPotionToInventory(id,1);player.hp=4520;player.sp=1190;player[resource]=start;
     rebuildInventorySlots();inventoryCharacterIndex=0;
     if(route==='battle')applyPotionEffect(id,0);
     else if(route==='inventory-single')v17342UseInventoryPotion(inventorySlots.findIndex(item=>item?.id===id));
     else if(route==='inventory-batch'){showPage('inventory');setInventoryFilter('potion');renderInventory();openItemModal(inventorySlots.findIndex(item=>item?.id===id));document.getElementById('v17350BatchQuantity').value='1';await v17350RunBatchAction();closeItemModal();closeMapInventoryOverlay();}
     else if(route==='post-battle')applyPostBattleAutoRecovery();
     else v154FinishAutoRecovery();
     rows.push({route,id,start,expected,actual:player[resource],stock:getPotionCount(id)});
    }
   }
   // Batch stops at cap and consumes only necessary quantities.
   inventoryItems.splice(0,inventoryItems.length);addPotionToInventory('hpPotion10',10);player.hp=4400;showPage('inventory');setInventoryFilter('potion');renderInventory();openItemModal(inventorySlots.findIndex(item=>item?.id==='hpPotion10'));document.getElementById('v17350BatchQuantity').value='10';await v17350RunBatchAction();rows.push({route:'batch-cap',actual:player.hp,expected:4520,stock:getPotionCount('hpPotion10'),expectedStock:8});closeItemModal();closeMapInventoryOverlay();
   inventoryItems.splice(0,inventoryItems.length,{id:'hpPotion10',type:'potion',count:321,recoveryPercent:10},{id:'spPotion10',type:'potion',count:456,recoveryPercent:10});normalizePotionInventoryFromLegacy({});
   const legacy={hp:getPotionCount('hpPotion10'),sp:getPotionCount('spPotion10'),items:inventoryItems.map(x=>({id:x.id,mode:x.recoveryMode,value:x.recoveryValue,percent:x.recoveryPercent}))};
   const shop=renderShopContent();
   return {rows,legacy,shopFlat:shop.includes('恢復 66 HP')&&shop.includes('恢復 66 SP'),oldShopNote:shop.includes('10%、20%、30%'),descriptions:['hpPotion10','spPotion10','hpPotion20','hpPotion30','spPotion20','spPotion30'].map(getPotionEffectDescription)};
  }finally{getPartyBattleStats=originalStats;finishPlayerAction=originalFinish;window.alert=originalAlert;window.rpgAlert=originalRpgAlert;saveGame=originalSave;inventoryItems.splice(0,inventoryItems.length,...oldInventory);player.hp=oldHP;player.sp=oldSP;Object.assign(autoConfig,oldConfig);rebuildInventorySlots();}
 })()`);
 for(const row of potions.rows){assert.equal(row.actual,row.expected,JSON.stringify(row));assert.equal(row.stock,row.expectedStock??0,JSON.stringify(row));}
 assert.equal(potions.legacy.hp,321);assert.equal(potions.legacy.sp,456);assert.ok(potions.legacy.items.every(x=>x.mode==='flat'&&x.value===66&&x.percent===undefined));assert.equal(potions.shopFlat,true);assert.equal(potions.oldShopNote,false);
 await c.eval("showPage('home');openHomeFeature('character')");await c.send('Page.reload',{ignoreCache:true});await c.eval(`(async()=>{for(let i=0;i<600;i++){if(window.FourSymbolsStartupPolicy?.getState?.()==='READY'&&document.getElementById('startupLoader')?.hidden)break;await new Promise(r=>setTimeout(r,50));}closeHomeFeature();showPage('home');})()`);assert.equal((await c.eval(measure)).visible,true);
 results.push({width,height,cold,potions,reload:true});
 }finally{c?.close();proc.kill('SIGKILL');fs.rmSync(profile,{recursive:true,force:true});}
}
try{for(const [w,h] of [[390,844],[412,915]])await run(w,h);const result={passed:true,expected,environment:baseUrl?'deployed-dev':'local-production',rows,results};fs.writeFileSync(`${out}/foreground-potion-qa.json`,JSON.stringify(result,null,2)+'\n');console.log('Foreground/Potion QA PASS',rows.length,'panel transitions',results.map(x=>x.potions.rows.length));}
catch(error){fs.writeFileSync(`${out}/foreground-potion-qa.json`,JSON.stringify({passed:false,error:String(error.stack),rows,results},null,2));throw error;}
finally{await new Promise(r=>server.server.close(r));}
