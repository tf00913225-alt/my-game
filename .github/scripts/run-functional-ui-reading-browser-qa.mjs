import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {ROOT,startServer,waitJson,Cdp,findChrome} from './runtime-browser-qa-support.mjs';

// Use the same isolated account and the real production loader as skill QA.
const skillQa=fs.readFileSync(path.join(ROOT,'.github/scripts/run-skill-progression-browser-qa.mjs'),'utf8');
const prepare=skillQa.match(/const PREPARE_RUNTIME=`([\s\S]*?)`;/)[1];
const viewport=JSON.parse(process.env.UI_READING_VIEWPORT||'[393,873]');
const sourceHead=process.env.GITHUB_SHA||execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim();
const sourceDirty=!!execFileSync('git',['status','--porcelain'],{cwd:ROOT,encoding:'utf8'}).trim();
const out=path.join(ROOT,'artifacts/browser-qa/functional-reading',viewport.join('x'));
fs.mkdirSync(out,{recursive:true});
const server=await startServer();
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'functional-reading-'));
const port=9700+Math.floor(Math.random()*200);
const chrome=spawn(findChrome(),['--headless=new','--no-sandbox','--disable-gpu',`--remote-debugging-port=${port}`,`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore',windowsHide:true});
let c;const scenes=[];
const settle=()=>new Promise(r=>setTimeout(r,350));
const measure=String.raw`(selector)=>{
 const host=document.querySelector(selector);if(!host)throw Error('missing '+selector);
 const elementScale=e=>{let box=e;while(box&&!box.offsetWidth)box=box.parentElement;return box?box.getBoundingClientRect().width/box.offsetWidth:1;};
 const rows=[],overflow=[],controls=[];
 const tree=document.createTreeWalker(host,NodeFilter.SHOW_TEXT);
 while(tree.nextNode()){
  const n=tree.currentNode,e=n.parentElement,text=n.textContent.trim();
  if(!text||!e||e.closest('script,style,[aria-hidden="true"],.nav-sr-only,.inventory-title-plate-kicker'))continue;
  const s=getComputedStyle(e),r=e.getBoundingClientRect();
  if(!r.width||!r.height||s.visibility==='hidden'||s.display==='none')continue;
  if(/^[＋+×‹›◀▶▼▲▾◇◆…·—→←？]+$/.test(text))continue;
  const after=getComputedStyle(e,'::after');
  const replaced=parseFloat(s.fontSize)===0&&after.content&&after.content!=='none';
  const font=parseFloat(replaced?after.fontSize:s.fontSize)*elementScale(e);
  const button=!!e.closest('button,[role="tab"],[role="button"]');
  const primary=button&&e.matches('button,#creationSubmitLabel,.creation-next>span,.creation-back>span,.element-option .element-name')&&!e.closest('.home-test-tools');
  rows.push({text:text.slice(0,90),font,button,primary,selector:e.id?'#'+e.id:e.tagName.toLowerCase()+'.'+String(e.className).trim().replace(/\s+/g,'.'),parent:e.parentElement.id||e.parentElement.className});
 }
 for(const e of host.querySelectorAll('button,[role="tab"],[role="button"]')){
  const s=getComputedStyle(e),r=e.getBoundingClientRect();if(!r.width||!r.height||s.visibility==='hidden'||!e.textContent.trim())continue;
  const walker=document.createTreeWalker(e,NodeFilter.SHOW_TEXT),bounds=[];
  while(walker.nextNode()){const n=walker.currentNode;if(!n.textContent.trim()||n.parentElement.closest('[aria-hidden="true"]'))continue;const range=document.createRange();range.selectNodeContents(n);bounds.push(range.getBoundingClientRect());}
  const t={left:Math.min(...bounds.map(b=>b.left)),right:Math.max(...bounds.map(b=>b.right)),top:Math.min(...bounds.map(b=>b.top)),bottom:Math.max(...bounds.map(b=>b.bottom))};
  const clamped=Array.from(e.querySelectorAll('*')).some(n=>parseInt(getComputedStyle(n).webkitLineClamp)>0);
  const labelControl=e.matches('button,[role="tab"]')&&!clamped;
  controls.push({label:(e.textContent||e.getAttribute('aria-label')||'').trim().slice(0,60),width:r.width,height:r.height,overflow:labelControl&&(t.left<r.left-1||t.right>r.right+1||t.top<r.top-1||t.bottom>r.bottom+1)});
 }
 for(const e of host.querySelectorAll('h1,h2,h3,.item-modal-name,.home-feature-modal-title,[role="tablist"]')){
  const r=e.getBoundingClientRect();if(!r.width||!r.height)continue;
  if(e.scrollWidth>e.clientWidth+1)overflow.push({text:e.textContent.trim().slice(0,60),width:r.width,scroll:e.scrollWidth,client:e.clientWidth});
 }
 return {rows,controls,overflow};
}`;
try{
 const target=(await waitJson(`http://127.0.0.1:${port}/json/list`)).find(t=>t.type==='page');
 c=new Cdp(target.webSocketDebuggerUrl);await c.send('Page.enable');await c.send('Runtime.enable');
 await c.send('Emulation.setDeviceMetricsOverride',{width:viewport[0],height:viewport[1],deviceScaleFactor:1,mobile:true});
 await c.send('Page.navigate',{url:server.url});await c.eval(prepare);
 await c.eval("(async()=>{await FourSymbolsFeatures.ensure('relic','functional-reading');await FourSymbolsFeatures.ensure('gameplay-core','functional-reading');})()");
 await c.eval("(()=>{const armor=v17346GenerateEquipment(()=>.2,{slot:'armor',classType:'warrior',rarity:'orange',uid:'reading-equipped-armor'});const bagArmor=v17346GenerateEquipment(()=>.2,{slot:'armor',classType:'warrior',rarity:'orange',uid:'reading-bag-armor'});inventoryItems.push(bagArmor,{...getPotionDefinition('hpPotion10'),count:30});characterEquipment.fire.armor=armor;rebuildInventorySlots();renderInventory();})()");
 const capture=async(name,selector='#homeFeatureModal')=>{
  await settle();const data=await c.eval(`(${measure})(${JSON.stringify(selector)})`);
  assert.ok(data.rows.length||data.controls.length,name+': empty UI coverage');
  scenes.push({name,...data});fs.writeFileSync(path.join(out,'all-text.json'),JSON.stringify(scenes,null,2));
  const image=await c.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(image.data,'base64'));
  console.log(name+': '+data.rows.length+' text nodes, '+data.rows.filter(x=>x.font<12.9).length+' below minimum');
 };
 const tap=async selector=>{
  const point=await c.eval(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)return null;const r=e.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,hit=document.elementFromPoint(x,y);return {x,y,hit:hit===e||e.contains(hit),label:e.textContent.trim()};})()`);
  assert.ok(point?.hit,'real touch is blocked: '+selector+' '+JSON.stringify(point));
  await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:point.x,y:point.y}]});
  await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await settle();
 };
 if(process.env.UI_READING_CREATION_ONLY!=='1'){
  await c.eval("(()=>{closeHomeFeature();showPage('home');window.__readingInventoryBackup=inventoryItems.slice();window.__readingEquipmentBackup=structuredClone(characterEquipment);inventoryItems.splice(0);rebuildInventorySlots();openMapInventoryOverlay('home');setInventoryFilter('equipment');})()");
  await capture('inventory-empty','#inventoryPage');
  assert.equal(await c.eval("document.querySelectorAll('#inventoryGrid .has-item').length"),0,'empty inventory still displays items');
  for(const filter of ['item','material','function']){
   await c.eval(`setInventoryFilter(${JSON.stringify(filter)})`);
   assert.equal(await c.eval("document.querySelectorAll('#inventoryGrid .has-item').length"),0,'empty category contains stale item');
  }
  await c.eval("(()=>{inventoryItems.splice(0,...Array.from({length:120},(_,i)=>({...v17346GenerateEquipment(()=>.2,{slot:'armor',classType:'warrior',rarity:'orange',uid:'reading-full-'+i}),count:1})));rebuildInventorySlots();setInventoryFilter('equipment');})()");
  // The formal first render may equip one fixture item. Fill the remaining
  // bag slot afterwards; do not change equipment normalization to stage QA.
  await c.eval("(()=>{if(inventoryItems.length===119){inventoryItems.push({...v17346GenerateEquipment(()=>.2,{slot:'armor',classType:'warrior',rarity:'orange',uid:'reading-full-extra'}),count:1});rebuildInventorySlots();renderInventoryItems();}})()");
  const fullState=await c.eval('({items:inventoryItems.length,slots:inventorySlots.filter(Boolean).length,first:inventoryItems[0],last:inventoryItems.at(-1)})');
  assert.equal(fullState.slots,120,'full inventory fixture did not fill formal capacity: '+JSON.stringify(fullState));
  await capture('inventory-full','#inventoryPage');
  await c.eval('openItemModal(0)');await capture('inventory-full-detail','#itemModal');await c.eval('closeItemModal()');
  assert.ok(await c.eval("document.getElementById('inventoryPage').getBoundingClientRect().width>0&&document.querySelectorAll('#inventoryGrid .has-item').length>0"),'full inventory not restored after item detail');
  await capture('inventory-full-return','#inventoryPage');
  await c.eval("inventoryItems.splice(0,inventoryItems.length,...window.__readingInventoryBackup);Object.assign(characterEquipment,structuredClone(window.__readingEquipmentBackup));rebuildInventorySlots();renderInventory();closeMapInventoryOverlay()");
  await c.eval(`(()=>{
   const ticket=v132GetContentDefinitions().tickets[0];
   if(!ticket)throw Error('real ticket definition missing');
   window.__readingPreviewTicket={...ticket,count:3};
   inventoryItems.push({id:'materialChest',name:'材料寶箱',type:'chest',count:3,stats:{}},{...ticket,count:3});
   rebuildInventorySlots();
   window.__readingPreviewAssets=()=>JSON.stringify({gold,inventoryItems,characterEquipment});
   window.__readingPreviewBefore=window.__readingPreviewAssets();
   closeHomeFeature();showPage('home');
  })()`);
  for(const type of ['material','ticket']){
   const info=await c.eval(`(()=>{
    const id=${type==='material'?"'materialChest'":"window.__readingPreviewTicket.id"};
    openItemModal(inventorySlots.findIndex(i=>i?.id===id));
    const button=document.getElementById('v132ItemPreviewButton');
    if(!button||getComputedStyle(button).display==='none')throw Error('formal preview action unavailable');
    button.click();
    const modal=document.getElementById('v132RewardModal');
    const rows=Array.from(modal.querySelectorAll('${type==='material'?'.v132-preview-row':'.v132-preview-item'}'));
    const defs=${type==='material'?"v132MaterialChestDropTable.map(e=>({entry:e,def:v132GetOreDefinition(e.itemId)||getPotionDefinition(e.itemId)}))":"v132GetEquipmentSetItemDefinitions(window.__readingPreviewTicket.setId).map(def=>({def}))"};
    return {title:modal.querySelector('h3')?.textContent,rule:modal.querySelector('p')?.textContent,
     rows:rows.map(e=>({text:e.textContent,icon:!!e.querySelector('.v132-preview-icon'),id:e.dataset.itemId})),
     expected:defs.map(({entry,def})=>({name:def.name,amount:entry?.amount,probability:entry?.weight??100/defs.length,id:def.id}))};
   })()`);
   assert.ok(info.title?.includes('開啟預覽'),type+': preview title missing');
   assert.match(info.rule,/每箱抽取一項|隨機獲得1件/,type+': draw-count rule missing');
   if(type==='material')assert.match(info.rule,/暫定.*尚未定案/,'provisional chest policy must remain visible');
   assert.equal(info.rows.length,info.expected.length,type+': preview rows do not match formal definitions');
   info.expected.forEach((e,i)=>{assert.ok(info.rows[i].icon&&info.rows[i].text.includes(e.name),type+': missing item icon/name '+e.name);assert.ok(info.rows[i].text.includes((Math.round(e.probability*10)/10)+'%'),type+': wrong displayed probability');if(e.amount)assert.ok(info.rows[i].text.includes('×'+e.amount),'material preview quantity missing');});
   await capture('preview-'+type,'#v132RewardModal');
   const scroll=await c.eval(`(()=>{const root=document.getElementById('v132RewardModal'),list=root.querySelector('.v132-preview-list-scroll,.v132-preview-grid');let e=list;while(e&&!(e.scrollHeight>e.clientHeight+1&&/auto|scroll/.test(getComputedStyle(e).overflowY)))e=e.parentElement;if(!e)return {needed:false};e.scrollTop=e.scrollHeight;const last=list.lastElementChild.getBoundingClientRect(),r=e.getBoundingClientRect();return {needed:true,top:e.scrollTop,reachable:last.bottom<=r.bottom+1};})()`);
   if(scroll.needed)assert.ok(scroll.top>0&&scroll.reachable,type+': final preview entry unreachable');
   await capture('preview-'+type+'-end','#v132RewardModal');
   if(type==='ticket'){
    await tap('#v132RewardModal .v132-preview-item');
    assert.ok(await c.eval("document.getElementById('itemModal').classList.contains('v132-ticket-preview-detail')&&document.getElementById('v132RewardModal').classList.contains('v132-detail-paused')"),'ticket result detail did not preserve preview');
    await capture('preview-ticket-equipment','#itemModal');
    await tap('#itemModal .close-item-button');
    const returnState=await c.eval("(()=>{const e=document.getElementById('v132RewardModal'),r=e.getBoundingClientRect(),s=getComputedStyle(e);return {classes:e.className,style:e.getAttribute('style'),display:s.display,visibility:s.visibility,width:r.width,height:r.height,items:e.querySelectorAll('.v132-preview-item').length};})()");
    fs.writeFileSync(path.join(out,'preview-ticket-return-state.json'),JSON.stringify(returnState,null,2));
    const returnImage=await c.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,'preview-ticket-return.png'),Buffer.from(returnImage.data,'base64'));
    assert.ok(returnState.width&&returnState.height&&returnState.display!=='none'&&returnState.visibility!=='hidden','ticket preview became invisible after returning from item detail: '+JSON.stringify(returnState));
    assert.ok(await c.eval("!document.getElementById('v132RewardModal').classList.contains('v132-detail-paused')&&document.querySelectorAll('#v132RewardModal .v132-preview-item').length===10"),'ticket detail did not return to preview');
    await capture('preview-ticket-return','#v132RewardModal');
    // Rehosting from itemModal to game-ui must preserve real hit testing.
    await tap('#v132RewardModal .v132-preview-item:last-child');
    await capture('preview-ticket-last-equipment','#itemModal');
    await tap('#itemModal .close-item-button');
    assert.equal(await c.eval("document.querySelectorAll('#v132RewardModal .v132-preview-item').length"),10);
   }
   await tap('#v132RewardModal .v132-reward-actions button');
   await c.eval('closeItemModal()');
   await c.eval(`v132ShowItemPreview(${type==='material'?"inventoryItems.find(i=>i.id==='materialChest')":"window.__readingPreviewTicket"})`);
   await capture('preview-'+type+'-reopen','#v132RewardModal');
   await c.eval('v132CloseRewardModal()');
   assert.ok(await c.eval('window.__readingPreviewBefore===window.__readingPreviewAssets()'),type+': read-only preview changed player assets');
  }
 }
 if(process.env.UI_READING_CREATION_ONLY!=='1'&&process.env.UI_READING_PREVIEW_ONLY!=='1'){
 await c.eval("selectedSkillElementTab='fire';renderSkillLoadout();showSkillDetail('flameSlash')");
 await capture('skill-detail','#skillDetailModal');await c.eval('closeSkillDetail()');
 for(const feature of ['character','shop','forge','synthesis','autoBattleSettings','quest','announcement','system','rest','expPool','offlineExp','hero','relic','achievement']){
  await c.eval(`closeHomeFeature();showPage('home');openHomeFeature(${JSON.stringify(feature)})`);
  if(feature==='relic')await c.eval("(async()=>{const end=Date.now()+15000;while(!document.querySelector('.team-relic-grid')&&Date.now()<end)await new Promise(r=>setTimeout(r,50));if(!document.querySelector('.team-relic-grid'))throw Error('relic content did not load');})()");
  await capture(feature);
  const tabs=await c.eval(`Array.from(document.querySelectorAll('#homeFeatureModal [role="tab"],#homeFeatureModal .character-tab-row button,#homeFeatureModal .quest-tab,#homeFeatureModal .v141-synthesis-tabs button,#homeFeatureModal .v17345-shop-tabs button,#homeFeatureModal .v17346-shop-tabs button,#homeFeatureModal .team-relic-tabs button')).filter(e=>e.getBoundingClientRect().width>0).map(e=>({label:e.textContent.trim(),click:e.getAttribute('onclick')}))`);
  for(let i=0;i<tabs.length;i++){
   if(!tabs[i].click||!/Tab|tab|Category|category|filter|Filter/.test(tabs[i].click))continue;
   await c.eval(tabs[i].click);await capture(feature+'-tab-'+i);
   if(feature==='relic'){
    const selected=await c.eval(`(()=>{const row=document.querySelector('.team-relic-tabs'),active=row?.querySelector('button.active');if(!row||!active)return null;const r=row.getBoundingClientRect(),a=active.getBoundingClientRect();return {label:active.textContent.trim(),left:a.left,right:a.right,rowLeft:r.left,rowRight:r.right};})()`);
    assert.ok(selected&&selected.label===tabs[i].label&&selected.left>=selected.rowLeft-1&&selected.right<=selected.rowRight+1,'selected relic category must remain visible: '+JSON.stringify(selected));
   }
  }
 }
 await c.eval("closeHomeFeature();openHomeFeature('character');switchCharacterTab('skill')");
 for(const element of ['fire','water','wind','earth']){await c.eval(`selectedSkillElementTab=${JSON.stringify(element)};renderSkillLoadout()`);await capture('skills-'+element);}
 const skillIds=await c.eval("Object.keys(skillDatabase).filter(id=>{const s=skillDatabase[id];return s.element&&Object.hasOwn(s,'learnLevel')&&s.category!=='monster';})");
 for(const id of (process.env.UI_READING_QUICK==='1'?[]:skillIds)){await c.eval(`showSkillDetail(${JSON.stringify(id)})`);await capture('skill-'+id,'#skillDetailModal');await c.eval('closeSkillDetail()');}
 await c.eval("closeHomeFeature();showPage('home')");await capture('home','#homePage');
 const homeHits=await c.eval("Array.from(document.querySelectorAll('#homePage .home-card')).filter(e=>e.getBoundingClientRect().width>0).map(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return {label:e.getAttribute('aria-label'),hit:hit===e||e.contains(hit)};})");
 assert.ok(homeHits.length>=12&&homeHits.every(e=>e.hit),'home entries are covered: '+JSON.stringify(homeHits));
 await c.eval("openMapInventoryOverlay('home')");await capture('inventory','#inventoryPage');
 await c.eval('openInventoryCharacterDetail()');await capture('character-detail','#inventoryCharacterDetailModal');await c.eval('closeInventoryCharacterDetail();closeMapInventoryOverlay()');
 await c.eval("openHomeFeature('character');switchCharacterTab('status');showStatusHelp()");await capture('status-help','#statusHelpModal');await c.eval('closeStatusHelp();closeHomeFeature()');
 await c.eval("openEquippedItem(characterEquipment.fire.armor,'armor')");await capture('equipment-detail','#itemModal');await c.eval('closeItemModal()');
 await c.eval("openItemModal(inventorySlots.findIndex(i=>i?.id==='hpPotion10'))");await capture('potion-detail','#itemModal');await c.eval('closeItemModal()');
 await c.eval("v174OpenRelicDetail('relic_xuanwu_seal')");await capture('relic-detail','#homeFeatureModal');await c.eval('closeHomeFeature()');
 await c.eval("(async()=>{await FourSymbolsFeatures.ensure('dungeon','functional-reading');await FourSymbolsFeatures.ensure('abyss','functional-reading');await FourSymbolsFeatures.ensure('adventure','functional-reading');await FourSymbolsFeatures.ensure('patrol','functional-reading')})()");
 for(const page of ['training','dungeon','boss']){
  await c.eval(`closeHomeFeature();showPage(${JSON.stringify(page)})`);await capture(page,'#'+page+'Page');
 }
 await c.eval("showPage('dungeon');switchDungeonTab('daily')");
 for(const type of ['exp','material','gold','equipment']){
  const selector='#dungeonTabContent [data-dungeon-cover="'+type+'"] .v141-dungeon-cover-actions button:first-child';
  await c.eval('document.querySelector('+JSON.stringify(selector)+').scrollIntoView({block:"center"})');await settle();await tap(selector);
  await capture('dungeon-reward-'+type,'#v132RewardModal');
  const preview=await c.eval("(()=>{const b=document.querySelector('#v132RewardModal .v17363-text-reward-preview'),r=b.getBoundingClientRect(),scale=document.querySelector('#game-ui').getBoundingClientRect().width/document.querySelector('#game-ui').offsetWidth;return {width:r.width,title:b.querySelector('h3').textContent,body:[...b.querySelectorAll('p')].map(e=>parseFloat(getComputedStyle(e).fontSize)*scale)};})()");
  assert.ok(preview.width>=Math.min(viewport[0]-40,280),'formal preview must use readable stage width: '+JSON.stringify(preview));
  assert.ok(preview.body.length&&preview.body.every(n=>n>=14),'formal preview body must stay readable: '+JSON.stringify(preview));
  await c.eval("(()=>{const b=document.querySelector('#v132RewardModal .v132-reward-modal-inner');b.scrollTop=b.scrollHeight;})()");await settle();
  await capture('dungeon-reward-'+type+'-bottom','#v132RewardModal');await tap('#v132RewardModal .v132-reward-actions button');
 }
 await c.eval('vGameplayOpenBoss()');
 for(const type of ['personal','world']){
  await c.eval(`vGameplaySwitchBossTab(${JSON.stringify(type)})`);await capture('boss-'+type,'#bossPage');
  const details=await c.eval("Array.from(document.querySelectorAll('#bossPage [onclick]')).map(e=>e.getAttribute('onclick')).filter(s=>s.startsWith('vGameplayOpenBossDetail('))");
  if(details.length){await c.eval(details[0]);await capture('boss-'+type+'-detail','#bossPage');await c.eval('vGameplayCloseBossDetail()');}
 }
 for(const [name,action,selector] of [
  ['gameplay-hub','vGameplayBackToHub()','#gameplayPage'],
  ['tower','vGameplayOpenTower()','#towerPage'],
  ['tower-overview','vGameplayToggleTowerOverview()','#towerPage'],
  ['abyss','vGameplayOpenAbyss()','#dungeonPage'],
  ['adventure','openAdventureMap()','#adventurePage']
 ]){await c.eval(action);await capture(name,selector);
  if(name==='abyss'){
   const geometry=await c.eval("(()=>{const b=document.querySelector('.v174-abyss-leave'),list=document.querySelector('.v174-abyss-card-list'),r=b.getBoundingClientRect(),l=list.getBoundingClientRect(),h=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return {hit:h===b||b.contains(h),separate:l.top>=r.bottom-1,overflow:list.scrollHeight>list.clientHeight+1,x:l.right-12,y:l.bottom-12,to:l.top+16,before:list.scrollTop};})()");
   assert.ok(geometry.hit&&geometry.separate,'abyss cards cover return control');
   if(geometry.overflow){
    await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:geometry.x,y:geometry.y}]});
    for(let i=1;i<=8;i++){await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:geometry.x,y:geometry.y+(geometry.to-geometry.y)*i/8}]});await new Promise(r=>setTimeout(r,20));}
    await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await settle();
    assert.ok(await c.eval("document.querySelector('.v174-abyss-card-list').scrollTop>0"),'abyss list cannot touch-scroll');
    await c.eval("(()=>{const e=document.querySelector('.v174-abyss-card-list');e.scrollTop=e.scrollHeight;})()");
    const reachable=await c.eval("(()=>{const e=document.querySelector('.v174-abyss-card-list');return e.lastElementChild.getBoundingClientRect().bottom<=e.getBoundingClientRect().bottom+1;})()");assert.ok(reachable,'last abyss card unreachable');
   }
  }
 }
 const position=await c.eval("(()=>{const e=document.querySelector('.adventure-view');e.scrollTop=1000;const before=e.scrollTop;FourSymbolsAdventureUI.render();return {before,after:e.scrollTop};})()");assert.ok(Math.abs(position.before-position.after)<=1,'map rerender moved player scroll position');
 const originalCoordinates=await c.eval("(()=>{const v=FourSymbolsAdventure.getView(),nodes=[...v.chapter.nodes,...v.chapter.hiddenNodes];return Array.from(document.querySelectorAll('.adventure-node')).every(e=>{const n=nodes.find(n=>n.id===e.dataset.nodeId);return parseFloat(e.style.getPropertyValue('--node-x'))===n.x&&parseFloat(e.style.getPropertyValue('--node-y'))===n.y;});})()");assert.ok(originalCoordinates,'map layout rewrites original node coordinates');
 const mapOverlap=await c.eval(`(()=>{const nodes=Array.from(document.querySelectorAll('#adventurePage .adventure-node')).map(e=>({id:e.dataset.nodeId,r:e.getBoundingClientRect()}));return nodes.flatMap((a,i)=>nodes.slice(i+1).filter(b=>Math.min(a.r.right,b.r.right)-Math.max(a.r.left,b.r.left)>2&&Math.min(a.r.bottom,b.r.bottom)-Math.max(a.r.top,b.r.top)>2).map(b=>[a.id,b.id]));})()`);
 assert.deepEqual(mapOverlap,[],'adventure map nodes overlap');
 await c.eval("showPage('home');openHomeFeature('quest')");
 const questScroll=await c.eval("(()=>{const e=document.querySelector('.quest-completion-milestones');e.scrollLeft=e.scrollWidth;return {left:e.scrollLeft,last:e.lastElementChild.getBoundingClientRect().right,edge:e.getBoundingClientRect().right,count:e.children.length};})()");
 assert.ok(questScroll.count===5&&questScroll.left>0&&questScroll.last<=questScroll.edge+1,'all quest milestones must be reachable');
 }
 if(process.env.UI_READING_PREVIEW_ONLY!=='1'){
 await c.eval("closeHomeFeature();showPage('home');openCharacterCreation(3)");await capture('creation-step-1','#creationPage');
 for(const element of ['water','wind','earth']){await c.eval(`selectElement(${JSON.stringify(element)})`);await capture('creation-'+element,'#creationPage');}
 const creationFit=await c.eval("(()=>{const role=document.querySelector('.creation-role-card').getBoundingClientRect(),box=document.querySelector('.creation-showcase').getBoundingClientRect();return role.bottom<=box.bottom+1;})()");assert.ok(creationFit,'creation role description clipped');
 await c.eval("showCreationSkillDetail('flameSlash')");await capture('creation-skill-detail','#creationSkillDetailModal');await c.eval('closeCreationSkillDetail()');
 await c.eval('setCreationStep(2)');await capture('creation-step-2','#creationPage');await c.eval('cancelAdditionalCharacterCreation()');
 }
 const report={head:sourceHead,dirty:sourceDirty,viewport,previewOnly:process.env.UI_READING_PREVIEW_ONLY==='1',scenes:scenes.map(s=>({name:s.name,textCount:s.rows.length,small:s.rows.filter(x=>x.font<12.9),smallControls:s.rows.filter(x=>x.button&&x.font<14.9),smallPrimaryControls:s.rows.filter(x=>x.primary&&x.font<14.9),overflow:s.overflow,clippedControls:s.controls.filter(x=>x.overflow)}))};
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
 fs.writeFileSync(path.join(out,'all-text.json'),JSON.stringify(scenes,null,2));
 if(process.env.UI_READING_AUDIT_ONLY!=='1'){
 assert.deepEqual(report.scenes.flatMap(s=>s.smallPrimaryControls.map(x=>s.name+': '+x.text+' '+x.font)),[],'primary actions below 15px');
 assert.deepEqual(report.scenes.flatMap(s=>s.clippedControls.map(x=>s.name+': '+x.label)),[],'functional UI clips button labels');
 assert.deepEqual(report.scenes.flatMap(s=>s.overflow.map(x=>s.name+': '+x.text)),[],'functional UI headings overflow');
 assert.deepEqual(report.scenes.flatMap(s=>s.small.map(x=>s.name+': '+x.selector+' '+x.text)),[],'functional UI contains unreadable text');
 }
}finally{c?.close();chrome.kill();await new Promise(r=>server.server.close(r));}
