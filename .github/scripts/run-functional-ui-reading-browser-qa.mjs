import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {ROOT,startServer,waitJson,Cdp,findChrome} from './runtime-browser-qa-support.mjs';

// Use the same isolated account and the real production loader as skill QA.
const skillQa=fs.readFileSync(path.join(ROOT,'.github/scripts/run-skill-progression-browser-qa.mjs'),'utf8');
const prepare=skillQa.match(/const PREPARE_RUNTIME=`([\s\S]*?)`;/)[1];
const viewport=JSON.parse(process.env.UI_READING_VIEWPORT||'[393,873]');
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
  if(/^[＋+×‹›◀▶▼▲▾◇◆…·—→]+$/.test(text))continue;
  const after=getComputedStyle(e,'::after');
  const replaced=parseFloat(s.fontSize)===0&&after.content&&after.content!=='none';
  const font=parseFloat(replaced?after.fontSize:s.fontSize)*elementScale(e);
  const button=!!e.closest('button,[role="tab"],[role="button"]');
  rows.push({text:text.slice(0,90),font,button,selector:e.id?'#'+e.id:e.tagName.toLowerCase()+'.'+String(e.className).trim().replace(/\s+/g,'.'),parent:e.parentElement.id||e.parentElement.className});
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
 await c.eval("(()=>{const armor=v17346GenerateEquipment(()=>.2,{slot:'armor',classType:'warrior',rarity:'orange'});inventoryItems.push(armor,{...getPotionDefinition('hpPotion10'),count:30});characterEquipment.fire.armor=armor;rebuildInventorySlots();renderInventory();})()");
 const capture=async(name,selector='#homeFeatureModal')=>{
  await settle();const data=await c.eval(`(${measure})(${JSON.stringify(selector)})`);
  assert.ok(data.rows.length||data.controls.length,name+': empty UI coverage');
  scenes.push({name,...data});fs.writeFileSync(path.join(out,'all-text.json'),JSON.stringify(scenes,null,2));
  const image=await c.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(image.data,'base64'));
  console.log(name+': '+data.rows.length+' text nodes, '+data.rows.filter(x=>x.font<12.9).length+' below minimum');
 };
 if(process.env.UI_READING_CREATION_ONLY!=='1'){
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
 for(const type of ['exp','material','equipment']){await c.eval(`v141ShowDungeonRewardPreview(${JSON.stringify(type)})`);await capture('dungeon-reward-'+type,'#v132RewardModal');await c.eval('v132CloseRewardModal()');}
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
 ]){await c.eval(action);await capture(name,selector);}
 const mapOverlap=await c.eval(`(()=>{const nodes=Array.from(document.querySelectorAll('#adventurePage .adventure-node')).map(e=>({id:e.dataset.nodeId,r:e.getBoundingClientRect()}));return nodes.flatMap((a,i)=>nodes.slice(i+1).filter(b=>Math.min(a.r.right,b.r.right)-Math.max(a.r.left,b.r.left)>2&&Math.min(a.r.bottom,b.r.bottom)-Math.max(a.r.top,b.r.top)>2).map(b=>[a.id,b.id]));})()`);
 assert.deepEqual(mapOverlap,[],'adventure map nodes overlap');
 await c.eval("showPage('home');openHomeFeature('quest')");
 const questScroll=await c.eval("(()=>{const e=document.querySelector('.quest-completion-milestones');e.scrollLeft=e.scrollWidth;return {left:e.scrollLeft,last:e.lastElementChild.getBoundingClientRect().right,edge:e.getBoundingClientRect().right,count:e.children.length};})()");
 assert.ok(questScroll.count===5&&questScroll.left>0&&questScroll.last<=questScroll.edge+1,'all quest milestones must be reachable');
 }
 await c.eval("closeHomeFeature();showPage('home');openCharacterCreation(3)");await capture('creation-step-1','#creationPage');
 for(const element of ['water','wind','earth']){await c.eval(`selectElement(${JSON.stringify(element)})`);await capture('creation-'+element,'#creationPage');}
 const creationFit=await c.eval("(()=>{const role=document.querySelector('.creation-role-card').getBoundingClientRect(),box=document.querySelector('.creation-showcase').getBoundingClientRect();return role.bottom<=box.bottom+1;})()");assert.ok(creationFit,'creation role description clipped');
 await c.eval("showCreationSkillDetail('flameSlash')");await capture('creation-skill-detail','#creationSkillDetailModal');await c.eval('closeCreationSkillDetail()');
 await c.eval('setCreationStep(2)');await capture('creation-step-2','#creationPage');await c.eval('cancelAdditionalCharacterCreation()');
 const report={viewport,scenes:scenes.map(s=>({name:s.name,textCount:s.rows.length,small:s.rows.filter(x=>x.font<12.9),smallControls:s.rows.filter(x=>x.button&&x.font<14.9),overflow:s.overflow,clippedControls:s.controls.filter(x=>x.overflow)}))};
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
 fs.writeFileSync(path.join(out,'all-text.json'),JSON.stringify(scenes,null,2));
 if(process.env.UI_READING_AUDIT_ONLY!=='1'){
 assert.deepEqual(report.scenes.flatMap(s=>s.clippedControls.map(x=>s.name+': '+x.label)),[],'functional UI clips button labels');
 assert.deepEqual(report.scenes.flatMap(s=>s.overflow.map(x=>s.name+': '+x.text)),[],'functional UI headings overflow');
 assert.deepEqual(report.scenes.flatMap(s=>s.small.map(x=>s.name+': '+x.selector+' '+x.text)),[],'functional UI contains unreadable text');
 }
}finally{c?.close();chrome.kill();await new Promise(r=>server.server.close(r));}
