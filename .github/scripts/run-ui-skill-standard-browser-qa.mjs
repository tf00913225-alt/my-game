import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawn,execFileSync} from 'node:child_process';
import {ROOT,startServer,waitJson,Cdp,findChrome} from './runtime-browser-qa-support.mjs';

// Use the established isolated account transport and the real production loader.
const prepare=fs.readFileSync(path.join(ROOT,'.github/scripts/run-skill-progression-browser-qa.mjs'),'utf8').match(/const PREPARE_RUNTIME=`([\s\S]*?)`;/)[1];
const viewport=JSON.parse(process.env.UI_READING_VIEWPORT||'[393,873]');
const out=path.join(ROOT,'artifacts/ui-skill-standard/segment-1-r3',viewport.join('x'));
fs.mkdirSync(out,{recursive:true});
const server=await startServer(),port=9800+viewport[0];
const chrome=spawn(findChrome(),['--headless=new','--no-sandbox','--disable-gpu',`--remote-debugging-port=${port}`,`--user-data-dir=${fs.mkdtempSync(path.join(os.tmpdir(),'ui-standard-'))}`,'about:blank'],{stdio:'ignore',windowsHide:true});
let c;
const report={head:execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim(),dirty:!!execFileSync('git',['status','--porcelain'],{cwd:ROOT,encoding:'utf8'}).trim(),viewport,scenes:[],actions:[],errors:[]};
report.files=Object.fromEntries(['index.html','asset-manifest.json','css/00-main.css','css/33-v132-content-expansion.css','css/49-v169-rpg-ui.css','js/00-main.js','js/36-v141-content-systems.js','.github/scripts/run-ui-skill-standard-browser-qa.mjs'].map(file=>[file,createHash('sha256').update(fs.readFileSync(path.join(ROOT,file))).digest('hex')]));
const settle=()=>new Promise(r=>setTimeout(r,400));
try{
 const target=(await waitJson(`http://127.0.0.1:${port}/json/list`)).find(t=>t.type==='page');
 c=new Cdp(target.webSocketDebuggerUrl);await c.send('Page.enable');await c.send('Runtime.enable');
 await c.send('Emulation.setDeviceMetricsOverride',{width:viewport[0],height:viewport[1],deviceScaleFactor:1,mobile:viewport[0]<800});
 await c.send('Page.navigate',{url:server.url});await c.eval(prepare);
 const capture=async name=>{await settle();fs.writeFileSync(path.join(out,name+'.png'),Buffer.from((await c.send('Page.captureScreenshot',{format:'png'})).data,'base64'));report.scenes.push(name);};
 const tap=async selector=>{
  const hit=await c.eval(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('missing control');e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2,h=document.elementFromPoint(x,y);const range=document.createRange();range.selectNodeContents(e);const t=range.getBoundingClientRect();return {selector:${JSON.stringify(selector)},x,y,width:r.width,height:r.height,hit:h===e||e.contains(h),labelInside:t.left>=r.left-1&&t.right<=r.right+1&&t.top>=r.top-1&&t.bottom<=r.bottom+1};})()`);
  assert.ok(hit.hit,'covered control '+selector);report.actions.push(hit);
  assert.ok(hit.labelInside,'clipped label '+selector);
  await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:hit.x,y:hit.y}]});
  await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await settle();
 };
 const swipe=async selector=>{
  const r=await c.eval(`(()=>{const e=document.querySelector(${JSON.stringify(selector)}),r=e.getBoundingClientRect(),x=r.left+r.width*.5,y=r.bottom-30,t=document.elementFromPoint(x,y);return {x,y,to:r.top+30,before:e.scrollTop,target:t?.outerHTML.slice(0,250)};})()`);
  await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:r.x,y:r.y}]});
  for(let i=1;i<=10;i++){await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:r.x,y:r.y+(r.to-r.y)*i/10}]});await new Promise(resolve=>setTimeout(resolve,20));}
  await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await settle();
  const after=await c.eval(`document.querySelector(${JSON.stringify(selector)}).scrollTop`);
  report.actions.push({swipe:selector,before:r.before,after,target:r.target,x:r.x,y:r.y,to:r.to});return after>r.before;
 };
 await settle();
 report.skillSkin=await c.eval("(()=>{const e=document.querySelector('.character-showcase-choice.is-current-character'),s=getComputedStyle(e);return {edge:s.getPropertyValue('--character-choice-edge'),border:s.borderColor,shadow:s.boxShadow};})()");
 await capture('skill-baseline');assert.ok(await swipe('#characterTabContent'));await capture('skill-scrolled');
 await tap('#characterTabBtnExpPool');
 const expTop=await c.eval("(()=>{const e=document.getElementById('characterTabContent'),t=e.querySelector('.exp-pool-title').getBoundingClientRect(),r=e.getBoundingClientRect();return {scroll:e.scrollTop,headingTop:t.top,contentTop:r.top};})()");
 report.actions.push(expTop);assert.equal(expTop.scroll,0);assert.ok(expTop.headingTop>=expTop.contentTop);await capture('exp-charge-after-scrolled-skill');
 await c.eval('player.level=1;player.exp=0;player.expNext=v133GetExpNextForLevel(1);player2=null;sharedExp=0;updateUI();closeHomeFeature();openHomeFeature("character");switchCharacterTab("expPool")');
 assert.equal(await c.eval('document.getElementById("sharedExpValue").textContent'),'0');await capture('exp-zero-one-character');
 await tap('#characterTabBtnStatus');
 await c.eval('player.attributePoints=2;updateStatusPreview()');
 await capture('attributes-available');await tap('#statusBtnAttackPlus');
 assert.equal(await c.eval('pendingStats.attack'),1,'plus did not allocate preview');await capture('attributes-preview');
 await tap('#statusBtnAttackMinus');assert.equal(await c.eval('pendingStats.attack'),0,'minus did not undo preview');
 await c.eval('player.attributePoints=0;updateStatusPreview()');await tap('#statusBtnAttackPlus');assert.equal(await c.eval('pendingStats.attack'),0,'zero points changed preview');
 assert.ok(await swipe('#characterTabContent'));await capture('attributes-bottom-zero');
 await tap('#characterTabBtnSkill');await tap('#characterTabBtnStatus');assert.equal(await c.eval('document.getElementById("characterTabContent").scrollTop'),0);
 await capture('attributes-tab-return');
 await tap('#statusHelpButton');await capture('attribute-help');
 report.actions.push(await c.eval("(()=>{const e=document.querySelector('#statusHelpModal .close-item-button'),s=getComputedStyle(e),r=e.getBoundingClientRect();return {helpClose:{text:e.textContent.trim(),font:s.fontSize,height:r.height,width:r.width,display:s.display}};})()"));
 await tap('#statusHelpModal .close-item-button');assert.equal(await c.eval("document.getElementById('statusHelpModal').classList.contains('show')"),false);
 await tap('#homeFeatureModal .character-header-actions button[onclick="closeHomeFeature()"]');
 assert.equal(await c.eval("document.getElementById('homeFeatureModal').classList.contains('show')"),false);
 await c.eval("openHomeFeature('character');switchCharacterTab('expPool')");await tap('#homeFeatureModal .character-header-actions button[onclick="closeHomeFeature()"]');
 await c.eval("closeHomeFeature();openHomeFeature('autoBattleSettings')");await capture('auto-settings');
 await tap('#autoBattleSettingsPanel .custom-dropdown-label');await capture('auto-character-menu');
 await tap('#autoBattleSettingsPanel .custom-dropdown-label');
 assert.equal(await c.eval("document.querySelectorAll('.custom-dropdown-list.open').length"),0,'menu portal stayed open');
 report.autoScroll=await c.eval("(()=>{let e=document.querySelector('.auto-threshold-grid');const a=[];while(e){const s=getComputedStyle(e);a.push({id:e.id,cls:e.className,scroll:e.scrollTop,height:e.clientHeight,total:e.scrollHeight,overflow:s.overflowY,touch:s.touchAction});e=e.parentElement;}return a;})()");
 assert.ok(await swipe('#homeFeatureModalBody'),'auto content did not scroll');await capture('auto-settings-bottom');
 await tap('#homeFeatureModal .character-header-actions button[onclick="closeHomeFeature()"]');
 await c.eval("(async()=>{await FourSymbolsFeatures.ensure('equipment','ui-standard')})()");
 await c.eval("inventoryItems.push(v17346GenerateEquipment(()=>.2,{slot:'armor',classType:'warrior',rarity:'orange'}));rebuildInventorySlots();closeHomeFeature();openHomeFeature('forge');v141SwitchForgeTab('reforge')");
 await tap('.v141-forge-option');await capture('reforge-before-rules');
 const originalForge=await c.eval("document.querySelector('.v141-reforge-identity').textContent");
 await tap('.v141-affix-info');await capture('reforge-rules-top');
 const ruleText=await c.eval("document.querySelector('.v141-affix-content').textContent");assert.match(ruleText,/四象階材料/);assert.match(ruleText,/最高值固定10%/);
 assert.ok(await swipe('.v141-affix-content'));await capture('reforge-rules-middle');
 for(let i=0;i<8;i++){if(!await swipe('.v141-affix-content'))break;}
 await capture('reforge-rules-end');
 const bottom=await c.eval("(()=>{const e=document.querySelector('.v141-affix-content'),p=e.lastElementChild.getBoundingClientRect(),r=e.getBoundingClientRect(),f=document.querySelector('.v141-affix-modal .v132-reward-actions').getBoundingClientRect();return {lastBottom:p.bottom,contentBottom:r.bottom,footerTop:f.top,scroll:e.scrollTop};})()");report.actions.push(bottom);
 assert.ok(bottom.lastBottom<=bottom.contentBottom+1&&bottom.contentBottom<=bottom.footerTop+1,'rules hidden by footer');
 await tap('.v141-affix-modal .v132-reward-actions button');assert.equal(await c.eval("document.getElementById('v132RewardModal').classList.contains('show')"),false);await capture('reforge-return');
 assert.equal(await c.eval("document.querySelector('.v141-reforge-identity').textContent"),originalForge,'rules return changed selected forge equipment');
 report.errors=await c.eval('window.__skillQaRuntimeErrors||[]');
 console.log(JSON.stringify({viewport,scenes:report.scenes.length,actions:report.actions.length}));
}catch(error){report.failure=String(error.stack||error);throw error;}
finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));c?.close();chrome.kill();await new Promise(r=>server.server.close(r));}
