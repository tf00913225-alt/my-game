// Production index, builder output, Display, navigation, Inventory and AccountSave.
// Only external Auth/Cloud transport is isolated; progress is an explicit QA fixture.
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import net from 'node:net';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';
import {startServer,waitJson,Cdp,findChrome,collectStartupFailure,QA_CLOUD_MODULE,qaPrelude} from './runtime-browser-qa-support.mjs';
const out=path.resolve('artifacts/browser-qa/taoxi');fs.mkdirSync(out,{recursive:true});
const fixtureSource=QA_CLOUD_MODULE.match(/const save=(.*?);export async function readCurrentCloudSave/)[1];
const localCloud=QA_CLOUD_MODULE.replace(/export async function readCurrentCloudSave\(\)\{.*?\}\);\}/,'export async function readCurrentCloudSave(){return {exists:true,uid,path:"users/"+uid+"/saves/current",data:{ownerUid:uid,authoritativeStateReady:false}};}');
assert.notEqual(localCloud,QA_CLOUD_MODULE);
const repoSource=fs.readFileSync('js/startup/account-save-repository.js','utf8');
const cloudConflict=process.argv.includes('--cloud-conflict-only');
const server=await startServer(cloudConflict?{}:{cloudModule:localCloud,handleRequest(req,res){
 if(new URL(req.url,'http://localhost').pathname!=='/index.html')return false;
 const seed='<script>'+repoSource+';if(FourSymbolsAccountSave.readActive().status==="empty")FourSymbolsAccountSave.writeForUid("skill-runtime-browser-qa",'+fixtureSource+',{source:"qa-local-fixture"});</script>';
 const html=fs.readFileSync('index.html','utf8').replace('<!-- build:critical-script -->',qaPrelude()+seed+'<!-- build:critical-script -->');res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});res.end(html);return true;
}}),results=[];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
try{for(const [width,height] of (cloudConflict||process.argv.includes('--mobile-only')?[[393,873]]:process.argv.includes('--desktop-only')?[[1920,1080]]:[[393,873],[1920,1080]])){
  const port=await new Promise(resolve=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const n=s.address().port;s.close(()=>resolve(n));});});
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'taoxi-qa-'));
  const chrome=process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':findChrome();
  const proc=spawn(chrome,['--headless=new','--no-sandbox','--disable-gpu','--no-first-run','--remote-allow-origins=*','--remote-debugging-port='+port,'--user-data-dir='+profile,'about:blank'],{stdio:'ignore',windowsHide:true});
  let c;
  try{
    const tabs=await waitJson('http://127.0.0.1:'+port+'/json/list',{chromeProcess:proc});c=new Cdp(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
    await c.send('Page.enable');await c.send('Runtime.enable');await c.send('Network.enable');
    await c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<700});
    await c.send('Emulation.setTouchEmulationEnabled',{enabled:width<700,maxTouchPoints:2});
    await c.send('Page.navigate',{url:server.url});
    const wait=async(expression,label,timeout=45000)=>{const end=Date.now()+timeout;while(Date.now()<end){if(await c.eval(expression))return;await sleep(80);}throw Error('Timeout: '+label);};
    const input=async(x,y)=>{if(width<700){await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}else{await c.send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1});await c.send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1});}};
    const tap=async selector=>{const p=await c.eval(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('missing '+${JSON.stringify(selector)});const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2,hit=document.elementFromPoint(x,y);if(e.disabled||r.width<=0||r.height<=0||!e.contains(hit))throw Error('not actionable '+${JSON.stringify(selector)});return {x,y};})()`);await input(p.x,p.y);await sleep(180);};
    const capture=async label=>{await sleep(180);const shot=await c.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,`${width}-${label}.png`),Buffer.from(shot.data,'base64'));};
    const tapArt=async(selector,rx=.5,ry=.5)=>{const p=await c.eval(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width*${rx},y:r.y+r.height*${ry}};})()`);await input(p.x,p.y);};
    const walk=async(x,y)=>{
      for(let n=0;n<16;n++){
        const p=await c.eval(`(()=>{const root=document.getElementById('explorationPage'),v=root.querySelector('.taoxi-viewport'),r=v.getBoundingClientRect(),cam=root.dataset.camera.split(',').map(Number),pos=root.dataset.position.split(',').map(Number);return {cam,pos,r:{x:r.x,y:r.y,width:r.width,height:r.height}};})()`);
        if(Math.hypot(p.pos[0]-x,p.pos[1]-y)<20)return;
        const tx=Math.max(p.cam[0]+45,Math.min(p.cam[0]+1035,x)),ty=Math.max(p.cam[1]+45,Math.min(p.cam[1]+1375,y));
        await input(p.r.x+(tx-p.cam[0])/1080*p.r.width,p.r.y+(ty-p.cam[1])/1420*p.r.height);
        await sleep(1400);
      }throw Error('walking did not reach '+x+','+y);
    };
    await wait(`window.FourSymbolsStartupPolicy?.getState?.()==='READY'&&document.getElementById('startupLoader')?.hidden===true&&!document.getElementById('firebaseAuthOverlay')?.classList.contains('show')`,'formal boot');
    if(await c.eval("document.getElementById('homeFeatureModal')?.classList.contains('show')"))await tap('#homeFeatureModal [onclick="closeHomeFeature()"]');
    // Exercise the player's first click without preloading Adventure for the test.
    const homeHits=await c.eval(`[...document.querySelectorAll('#homePage .home-card,#adventureHomeEntry,#taoxiHomeEntry')].map(e=>{const r=e.getBoundingClientRect();const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {name:e.getAttribute('aria-label')||e.id,visible:r.width>0&&r.height>0,hit:e===hit||e.contains(hit)};}).filter(e=>e.visible)`);
    for(const row of homeHits)assert.equal(row.hit,true,'home control '+row.name);await capture('home-entry');
    const stage=await c.eval(`(()=>{const r=document.getElementById('game-stage').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};})()`);
    assert.ok(Math.abs(stage.width/stage.height-9/16)<.001,'one 9:16 canvas');assert.ok(Math.abs(stage.x+stage.width/2-width/2)<1,'centered canvas');
    await tap('#taoxiHomeEntry');await wait(`document.querySelector('#explorationPage [data-village]')`,'world map');
    assert.equal(await c.eval(`document.querySelector('[data-village]').disabled`),true,'not unlocked prematurely');await capture('locked-map');
    await tap('#explorationPage [data-back]');
    await c.eval(`(()=>{FourSymbolsAdventure.getView();const s=player.adventureProgress.chapters.chapter_v1;s.currentNodeId='c1_06';s.onboarding={active:false,phase:'complete',source:'qa-fixture'};for(let i=1;i<=5;i++)s.completedNodes['c1_0'+i]=true;if(saveGame()!==true)throw Error('fixture save');})()`);
    await tap('#taoxiHomeEntry');await tap('[data-village]');
    await wait(`document.getElementById('explorationPage').dataset.scene==='village'`,'village');await capture('village');
    // Physical front/back depth, including the transparent padding reported by the player.
    const heldKey=async(key,ms)=>{await c.send('Input.dispatchKeyEvent',{type:'keyDown',key,code:key});await sleep(ms);await c.send('Input.dispatchKeyEvent',{type:'keyUp',key,code:key});await sleep(80);};
    assert.equal(await c.eval(`document.querySelectorAll('[data-object] .taoxi-entry-arrow').length`),2,'only unlocked homes show arrows');
    await capture('entry-arrows');await walk(470,2500);await heldKey('ArrowUp',1000);
    const front=await c.eval(`(()=>{const r=document.getElementById('explorationPage'),a=r.querySelector('[data-player]'),h=r.querySelector('[data-object="a"]');return {y:Number(r.dataset.position.split(',')[1]),actor:Number(a.style.zIndex),house:Number(h.style.zIndex)};})()`);
    assert.ok(front.y<2350&&front.y>2285,'player stops at house footprint');assert.ok(front.actor>front.house,'player renders in front of house');await capture('house-front');
    await walk(50,2430);await walk(50,1700);await walk(470,1700);await heldKey('ArrowDown',1000);
    const behind=await c.eval(`(()=>{const r=document.getElementById('explorationPage');return {y:Number(r.dataset.position.split(',')[1]),actor:Number(r.querySelector('[data-player]').style.zIndex),house:Number(r.querySelector('[data-object="a"]').style.zIndex)};})()`);
    assert.ok(behind.y<1980&&behind.y>1900);assert.ok(behind.actor<behind.house,'house renders in front only behind it');await capture('house-behind');
    await walk(50,1700);await walk(840,2600);await walk(840,2240);
    assert.equal(await c.eval(`!!document.querySelector('.adventure-transient-dialogue')`),false,'passing NPC never starts conversation');await capture('npc-pass-through');
    const before=await c.eval(`JSON.stringify(player.adventureProgress)`);
    await tapArt('[data-object="elder"]');await wait(`Math.abs(Number(document.getElementById('explorationPage').dataset.position.split(',')[1])-2570)<5`,'clicked NPC approach');
    assert.equal(await c.eval(`!!document.querySelector('.adventure-transient-dialogue')`),false,'NPC click only approaches');await tap('[data-interact]');await capture('dialogue');
    await tap('.adventure-transient-dialogue button');await tap('.adventure-transient-dialogue button');
    assert.equal(await c.eval(`JSON.stringify(player.adventureProgress)`),before,'ordinary dialogue must not advance story');
    await tapArt('[data-object="a"] .taoxi-entry-arrow');await wait(`document.getElementById('explorationPage').dataset.scene==='a'`,'single click auto enters house');await capture('interior');
    await tapArt('[data-object="a-chest"]');await wait(`Math.abs(Number(document.getElementById('explorationPage').dataset.position.split(',')[1])-1035)<5`,'clicked chest approach');
    assert.equal(await c.eval(`!!document.querySelector('.adventure-transient-dialogue')`),false,'chest click only approaches');await tap('[data-interact]');await capture('search');
    assert.equal(await c.eval(`player.explorationProgress.searched['a-chest']`),true);const count=await c.eval(`getPotionCount('hpPotion10')`);
    await tap('.adventure-transient-dialogue button');await tap('[data-interact]');await tap('.adventure-transient-dialogue button');assert.equal(await c.eval(`getPotionCount('hpPotion10')`),count,'repeat no second grant');
    await tapArt('[data-object="door"] .taoxi-entry-arrow');await wait(`document.getElementById('explorationPage').dataset.scene==='village'`,'single click auto exits house');await tap('#explorationPage [data-back]');await tap('#explorationPage [data-back]');
    assert.equal(await c.eval(`document.getElementById('homePage').classList.contains('active')`),true,'return origin');
    const oldOrigin=await c.eval('performance.timeOrigin');await c.send('Page.reload');await wait('performance.timeOrigin!=='+oldOrigin,'new document');
    if(cloudConflict){
      await wait(`window.FourSymbolsStartupPolicy?.getState?.()==='MIGRATION_REQUIRED'`,'authoritative conflict gate');
      assert.equal(await c.eval(`FourSymbolsAccountSave.readActive().save.player.explorationProgress.searched['a-chest']`),true);
      await capture('authoritative-conflict');const evidence={expectedState:'MIGRATION_REQUIRED',localReceiptRetained:true,cloudReadinessUnchanged:true,scope:'isolated authoritative Cloud response; original resolver refusal, no true account or server write'};
      fs.writeFileSync(path.join(out,'cloud-conflict.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));continue;
    }
    await wait(`window.FourSymbolsStartupPolicy?.getState?.()==='READY'&&document.getElementById('startupLoader')?.hidden===true&&!document.getElementById('firebaseAuthOverlay')?.classList.contains('show')`,'reload boot');if(await c.eval("document.getElementById('homeFeatureModal')?.classList.contains('show')"))await tap('#homeFeatureModal [onclick="closeHomeFeature()"]');await c.eval(`FourSymbolsFeatures.ensure('adventure','taoxi-reload')`);
    assert.equal(await c.eval(`player.explorationProgress.searched['a-chest']`),true,'reload retained receipt');assert.equal(await c.eval(`getPotionCount('hpPotion10')`),count,'reload retained inventory');
    await c.eval(`FourSymbolsAdventure.open()`);await tap('#taoxiStoryEntry');await wait(`document.getElementById('explorationPage').dataset.scene==='map'&&!document.getElementById('explorationPage').hidden`,'story entry');await tap('#explorationPage [data-back]');assert.equal(await c.eval(`document.getElementById('adventurePage').classList.contains('active')`),true);
    await c.eval(`FourSymbolsAdventure.startStory('c1_06')`);await wait(`document.getElementById('adventurePage').dataset.panel==='story'`,'actual Story panel');
    const storyCursor=await c.eval(`JSON.stringify(player.adventureProgress.chapters.chapter_v1.dialogue)`);await capture('story-entry');
    await tap('#taoxiStoryEntry');await wait(`document.getElementById('explorationPage').dataset.scene==='map'&&!document.getElementById('explorationPage').hidden`,'actual Story exploration entry');await tap('#explorationPage [data-back]');
    assert.equal(await c.eval(`document.getElementById('adventurePage').dataset.panel`),'story');assert.equal(await c.eval(`JSON.stringify(player.adventureProgress.chapters.chapter_v1.dialogue)`),storyCursor,'return preserves the actual Story cursor');
    if(width===393&&process.argv.includes('--appearances')){
      await tap('#taoxiStoryEntry');
      const originals=await c.eval(`({gender:player.gender,element:player.element})`);
      for(const gender of ['male','female'])for(const element of ['fire','water','wind','earth']){
        await c.eval(`Object.assign(player,${JSON.stringify({gender,element})})`);await tap('[data-village]');
        for(const [key,code,facing] of [['ArrowLeft',37,'left'],['ArrowRight',39,'right'],['ArrowUp',38,'up'],['ArrowDown',40,'down']]){
          await c.send('Input.dispatchKeyEvent',{type:'keyDown',key,code:key,windowsVirtualKeyCode:code});await sleep(240);
          assert.equal(await c.eval(`document.querySelector('[data-player]').dataset.facing`),facing);
          await c.send('Input.dispatchKeyEvent',{type:'keyUp',key,code:key,windowsVirtualKeyCode:code});
        }
        await capture('appearance-'+gender+'-'+element);await tap('#explorationPage [data-back]');
      }
      await c.eval(`Object.assign(player,${JSON.stringify(originals)})`);await tap('#explorationPage [data-back]');
      fs.writeFileSync(path.join(out,'appearances.json'),JSON.stringify({eightAppearances:true,fourDirectionsEach:true,actualKeyInput:true,viewport:{width,height},build:JSON.parse(fs.readFileSync('asset-manifest.json','utf8')).featureManifest.bundles['feature-adventure']},null,2));
    }
    if(width===393&&!process.argv.includes('--first-loop-only')){
      // The same real pointer path exercises the entire content set. No position setter.
      await tap('#taoxiStoryEntry');await tap('[data-village]');
      const joy=await c.eval(`(()=>{const r=document.querySelector('[data-joystick]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
      const start=await c.eval(`document.getElementById('explorationPage').dataset.position`);
      await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[joy]});await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:joy.x+30,y:joy.y-25}]});await sleep(450);await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      assert.notEqual(await c.eval(`document.getElementById('explorationPage').dataset.position`),start,'joystick moves continuously');
      const destination=await c.eval(`(()=>{const root=document.getElementById('explorationPage'),cam=root.dataset.camera.split(',').map(Number),r=root.querySelector('.taoxi-viewport').getBoundingClientRect();return {x:r.x+(990-cam[0])/1080*r.width,y:r.y+(2100-cam[1])/1420*r.height};})()`);
      await input(destination.x,destination.y);await sleep(180);
      assert.ok(await c.eval(`document.getElementById('explorationPage').dataset.destination`),'tap takes over');
      await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:joy.x-25,y:joy.y}]});await sleep(100);
      assert.equal(await c.eval(`document.getElementById('explorationPage').dataset.destination`),'','joystick cancels route');
      await c.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
      const canceled=await c.eval(`document.getElementById('explorationPage').dataset.position`);await sleep(250);assert.equal(await c.eval(`document.getElementById('explorationPage').dataset.position`),canceled,'cancel stops movement');
      await tap('#explorationPage [data-back]');await tap('[data-village]');
      const house=async id=>{
        const target=await c.eval(`FourSymbolsTaoxiContent.village().objects.find(o=>o.id===${JSON.stringify(id)}).approach`);
        const currentY=await c.eval(`Number(document.getElementById('explorationPage').dataset.position.split(',')[1])`);
        await walk(990,currentY);await walk(990,target.y+300);await walk(id==='e'?1050:Math.max(700,Math.min(1100,target.x)),target.y+300);
        const portal=await c.eval(`!!document.querySelector('[data-object="'+${JSON.stringify(id)}+'"] .taoxi-entry-arrow')`);
        await tapArt('[data-object="'+id+'"]'+(portal?' .taoxi-entry-arrow':''),portal ? .5 : .46,portal ? .5 : .88);
        if(portal)await wait(`document.getElementById('explorationPage').dataset.scene===${JSON.stringify(id)}`,'house portal '+id);
        else{await wait(`Math.hypot(...document.getElementById('explorationPage').dataset.position.split(',').map((v,i)=>Number(v)-[${target.x},${target.y}][i]))<5`,'locked door approach');await tap('[data-interact]');}
      };
      const search=async id=>{
        const target=await c.eval(`FourSymbolsTaoxiContent.interior(document.getElementById('explorationPage').dataset.scene).objects.find(o=>o.id===${JSON.stringify(id)}).approach`);
        await tapArt('[data-object="'+id+'"]');await wait(`Math.hypot(...document.getElementById('explorationPage').dataset.position.split(',').map((v,i)=>Number(v)-[${target.x},${target.y}][i]))<5`,'search approach '+id);await tap('[data-interact]');
      };
      await house('a');await search('a-letter');await tap('.adventure-transient-dialogue button');await tap('#explorationPage [data-back]');
      await walk(900,2475);await walk(940,1940);await tap('[data-interact]');await tap('.adventure-transient-dialogue button');await tap('.adventure-transient-dialogue button');
      await house('b');
      const durable=await c.eval(`localStorage.getItem(FourSymbolsAccountSave.saveKey(FourSymbolsAccountSave.getActiveUid()))`);
      await c.eval(`(()=>{const key=FourSymbolsAccountSave.metadataKey(FourSymbolsAccountSave.getActiveUid());window.__taoxiSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===key)throw Error('QA_STORAGE_REFUSAL');return window.__taoxiSetItem.call(this,k,v);};})()`);
      await search('b-chest');
      assert.equal(await c.eval(`player.explorationProgress.searched['b-chest']===true`),false,'failed save does not consume point');assert.equal(await c.eval(`getPotionCount('spPotion10')`),0,'failed save grants no potion');
      assert.equal(await c.eval(`localStorage.getItem(FourSymbolsAccountSave.saveKey(FourSymbolsAccountSave.getActiveUid()))`),durable,'original durable save retained');
      await c.eval(`Storage.prototype.setItem=window.__taoxiSetItem;delete window.__taoxiSetItem`);await tap('.adventure-transient-dialogue button');
      await search('b-chest');await tap('.adventure-transient-dialogue button');await search('b-note');await tap('.adventure-transient-dialogue button');await capture('house-b');await tap('#explorationPage [data-back]');
      await house('c');assert.equal(await c.eval(`document.getElementById('explorationPage').dataset.scene`),'c');
      await search('c-chest');await tap('.adventure-transient-dialogue button');await search('c-journal');await tap('.adventure-transient-dialogue button');await capture('house-c');await tap('#explorationPage [data-back]');
      await house('d');assert.equal(await c.eval(`document.getElementById('explorationPage').dataset.scene`),'village','D still story locked');await capture('locked-house');await tap('.adventure-transient-dialogue button');
      await c.eval(`player.adventureProgress.chapters.chapter_v1.completedNodes.c1_06=true;saveGame()`);
      await tap('#explorationPage [data-back]');await tap('[data-village]');await house('d');assert.equal(await c.eval(`document.getElementById('explorationPage').dataset.scene`),'d');
      await search('d-chest');await tap('.adventure-transient-dialogue button');await search('d-box');await tap('.adventure-transient-dialogue button');await capture('house-d');await tap('#explorationPage [data-back]');
      await house('e');assert.equal(await c.eval(`document.getElementById('explorationPage').dataset.scene`),'village','E still story locked');await tap('.adventure-transient-dialogue button');
      await c.eval(`player.adventureProgress.chapters.chapter_v1.completedNodes.c1_16=true;saveGame()`);await tap('#explorationPage [data-back]');await tap('[data-village]');await house('e');assert.equal(await c.eval(`document.getElementById('explorationPage').dataset.scene`),'e');
      await search('e-chest');await tap('.adventure-transient-dialogue button');await search('e-record');await tap('.adventure-transient-dialogue button');await capture('house-e');
      assert.equal(await c.eval(`Object.keys(player.explorationProgress.searched).length`),10,'all ten points');assert.equal(await c.eval(`getPotionCount('hpPotion10')`),3);assert.equal(await c.eval(`getPotionCount('spPotion10')`),3);
      await tap('#explorationPage [data-back]');await tap('#explorationPage [data-back]');
      const originals=await c.eval(`({gender:player.gender,element:player.element})`);
      for(const gender of ['male','female'])for(const element of ['fire','water','wind','earth']){
        await c.eval(`Object.assign(player,${JSON.stringify({gender,element})})`);await tap('[data-village]');
        const image=await c.eval(`(()=>{const e=document.querySelector('.taoxi-character');return getComputedStyle(e).backgroundImage;})()`);assert.ok(image.includes('player_'+gender+'_0'+(['fire','water','wind','earth'].indexOf(element)+1)));
        await capture('appearance-'+gender+'-'+element);await tap('#explorationPage [data-back]');
      }
      await c.eval(`Object.assign(player,${JSON.stringify(originals)});saveGame()`);
      const saved=await c.eval(`FourSymbolsAccountSave.readActive().save.player.explorationProgress`);assert.equal(Object.keys(saved.searched).length,10);
      const uid=await c.eval(`FourSymbolsAccountSave.getActiveUid()`),savedBytes=await c.eval(`JSON.stringify(FourSymbolsAccountSave.readActive().save)`);
      await c.eval(`FourSymbolsAccountSave.activate('taoxi-isolation-other')`);
      assert.equal(await c.eval(`(async()=>{try{await FourSymbolsTaoxi.open('adventure');return false;}catch(error){return /探索紀錄/.test(error.message);}})()`),true,'foreign UID cache refused');
      assert.equal(await c.eval(`FourSymbolsAccountSave.readActive().status`),'empty','no foreign UID save created');assert.equal(await c.eval(`JSON.stringify(FourSymbolsAccountSave.readForUid(${JSON.stringify(uid)}).save)`),savedBytes,'original UID bytes unchanged');await c.eval(`FourSymbolsAccountSave.activate(${JSON.stringify(uid)})`);
      const fullEvidence={fullFiveHouses:true,tenSearchPoints:true,eightAppearances:true,dualControl:true,cancel:true,storageRefusalAndRetry:true,uidIsolationFixture:true,transport:'existing UID-local Boot mode; external Auth/Cloud and earned main progress are explicit QA fixtures',build:JSON.parse(fs.readFileSync('asset-manifest.json','utf8')).featureManifest.bundles['feature-adventure']};
      fs.writeFileSync(path.join(out,'full-content.json'),JSON.stringify(fullEvidence,null,2));console.log(JSON.stringify(fullEvidence));
    }
    const exceptions=c.events.filter(e=>e.method==='Runtime.exceptionThrown');assert.deepEqual(exceptions,[]);
    results.push({width,height,firstLoop:true,storyEntry:true,actualStoryEntry:true,storyCursorPreserved:true,reload:true,repeatNoGrant:true,storyUnchanged:true,transport:'isolated Auth/Cloud; explicit earned-progress fixture; local save only'});
    fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results.at(-1)));
  }catch(error){if(c){fs.writeFileSync(path.join(out,`${width}-failure.json`),JSON.stringify(await collectStartupFailure(c,{message:error.message}),null,2));const shot=await c.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,`${width}-failure.png`),Buffer.from(shot.data,'base64'));}throw error;}
  finally{c?.close();proc.kill();}
}}finally{server.server.closeAllConnections();await new Promise(r=>server.server.close(r));}
