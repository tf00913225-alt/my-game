import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {ROOT,startServer,waitJson,Cdp,findChrome} from './runtime-browser-qa-support.mjs';

// Use the same isolated account and the real production loader as skill QA.
const skillQa=fs.readFileSync(path.join(ROOT,'.github/scripts/run-skill-progression-browser-qa.mjs'),'utf8');
const prepare=skillQa.match(/const PREPARE_RUNTIME=`([\s\S]*?)`;/)[1];
const out=path.join(ROOT,'artifacts/browser-qa/functional-reading');
fs.mkdirSync(out,{recursive:true});
const server=await startServer();
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'functional-reading-'));
const port=9700+Math.floor(Math.random()*200);
const chrome=spawn(findChrome(),['--headless=new','--no-sandbox','--disable-gpu',`--remote-debugging-port=${port}`,`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore',windowsHide:true});
let c;const scenes=[];
const settle=()=>new Promise(r=>setTimeout(r,350));
const measure=String.raw`(selector)=>{
 const host=document.querySelector(selector);if(!host)throw Error('missing '+selector);
 const scale=document.getElementById('game-ui').getBoundingClientRect().width/document.getElementById('game-ui').offsetWidth;
 const rows=[],overflow=[],controls=[];
 const tree=document.createTreeWalker(host,NodeFilter.SHOW_TEXT);
 while(tree.nextNode()){
  const n=tree.currentNode,e=n.parentElement,text=n.textContent.trim();
  if(!text||!e||e.closest('script,style,[aria-hidden="true"],.nav-sr-only,.inventory-title-plate-kicker'))continue;
  const s=getComputedStyle(e),r=e.getBoundingClientRect();
  if(!r.width||!r.height||s.visibility==='hidden'||s.display==='none')continue;
  if(/^[＋+×‹›◀▶▼▲◇◆…·—]+$/.test(text))continue;
  const font=parseFloat(s.fontSize)*scale;
  const button=!!e.closest('button,[role="tab"],[role="button"]');
  rows.push({text:text.slice(0,90),font,button,selector:e.id?'#'+e.id:e.tagName.toLowerCase()+'.'+String(e.className).trim().replace(/\s+/g,'.'),parent:e.parentElement.id||e.parentElement.className});
 }
 for(const e of host.querySelectorAll('button,[role="tab"],[role="button"]')){
  const s=getComputedStyle(e),r=e.getBoundingClientRect();if(!r.width||!r.height||s.visibility==='hidden')continue;
  controls.push({label:(e.textContent||e.getAttribute('aria-label')||'').trim().slice(0,60),width:r.width,height:r.height,overflow:e.scrollWidth>e.clientWidth+1||e.scrollHeight>e.clientHeight+1});
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
 await c.send('Emulation.setDeviceMetricsOverride',{width:393,height:873,deviceScaleFactor:1,mobile:true});
 await c.send('Page.navigate',{url:server.url});await c.eval(prepare);
 const capture=async(name,selector='#homeFeatureModal')=>{
  await settle();const data=await c.eval(`(${measure})(${JSON.stringify(selector)})`);
  scenes.push({name,...data});
  const image=await c.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(image.data,'base64'));
  console.log(name+': '+data.rows.length+' text nodes, '+data.rows.filter(x=>x.font<12.9).length+' below minimum');
 };
 await c.eval("selectedSkillElementTab='fire';renderSkillLoadout();showSkillDetail('flameSlash')");
 await capture('skill-detail','#skillDetailModal');await c.eval('closeSkillDetail()');
 for(const feature of ['character','shop','forge','synthesis','autoBattleSettings','quest','announcement','system','rest','hero','relic','achievement']){
  await c.eval(`closeHomeFeature();showPage('home');openHomeFeature(${JSON.stringify(feature)})`);
  await capture(feature);
  const tabs=await c.eval(`Array.from(document.querySelectorAll('#homeFeatureModal [role="tab"],#homeFeatureModal .character-tab-row button,#homeFeatureModal .quest-tab,#homeFeatureModal .v141-synthesis-tabs button,#homeFeatureModal .v17345-shop-tabs button')).filter(e=>e.getBoundingClientRect().width>0).map(e=>({label:e.textContent.trim(),click:e.getAttribute('onclick')}))`);
  for(let i=0;i<tabs.length;i++){
   if(!tabs[i].click||!/Tab|tab|Category|category|filter|Filter/.test(tabs[i].click))continue;
   await c.eval(tabs[i].click);await capture(feature+'-tab-'+i);
  }
 }
 await c.eval("closeHomeFeature();showPage('home')");await capture('home','#homePage');
 await c.eval("openMapInventoryOverlay('home')");await capture('inventory','#inventoryPage');
 const report={scenes:scenes.map(s=>({name:s.name,textCount:s.rows.length,small:s.rows.filter(x=>x.font<12.9),smallControls:s.rows.filter(x=>x.button&&x.font<14.9),overflow:s.overflow,clippedControls:s.controls.filter(x=>x.overflow)}))};
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
 fs.writeFileSync(path.join(out,'all-text.json'),JSON.stringify(scenes,null,2));
 if(process.env.UI_READING_AUDIT_ONLY!=='1')assert.deepEqual(report.scenes.flatMap(s=>s.small.map(x=>s.name+': '+x.selector+' '+x.text)),[],'functional UI contains unreadable text');
}finally{c?.close();chrome.kill();await new Promise(r=>server.server.close(r));}
