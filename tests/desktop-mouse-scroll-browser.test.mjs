import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import crypto from 'node:crypto';import {spawn,execFileSync} from 'node:child_process';
import {ROOT,startServer,waitJson,Cdp,findChrome} from '../.github/scripts/runtime-browser-qa-support.mjs';

test('mouse scroll uses the formal gesture and display owners without activating synthetic rewards',async()=>{
 const main=fs.readFileSync(path.join(ROOT,'js/00-main.js'),'utf8');
 const geometry=main.slice(main.indexOf('function getDisplaySurfaceGeometry('),main.indexOf('function updateGameStageScale('));
 const api=main.slice(main.indexOf('window.FourSymbolsDisplay = Object.freeze({'),main.indexOf('window.GAME_VIRTUAL_WIDTH ='));
 const display='const GAME_WIDTH=1080,GAME_HEIGHT=1920,LEGACY_WIDTH=420,LEGACY_HEIGHT=1920*420/1080;'+geometry+api;
 const original=fs.readFileSync(path.join(ROOT,'tests/fixtures/desktop-scroll-gesture.html'),'utf8');
 assert.match(original,/<script src="\/js\/01-stage-v8-touch-lock\.js"><\/script>/,'fixture loads the formal gesture owner by default');
 const oldPath=process.env.DESKTOP_SCROLL_BASELINE_PATH;
 const server=await startServer({handleRequest(req,res){const u=new URL(req.url,'http://qa.invalid');if(u.pathname==='/__desktop-scroll'){res.writeHead(200,{'content-type':'text/html;charset=utf-8'});res.end(original.replace('/* DISPLAY_OWNER */',display).replace('/js/01-stage-v8-touch-lock.js',u.searchParams.has('before')?'/__old-gesture.js':'/js/01-stage-v8-touch-lock.js'));return true;}if(u.pathname==='/__old-gesture.js'&&oldPath){res.writeHead(200,{'content-type':'text/javascript'});res.end(fs.readFileSync(oldPath));return true;}return false;}});
 const out=path.join(ROOT,'artifacts/browser-qa/desktop-mouse-scroll');fs.mkdirSync(out,{recursive:true});
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'desktop-scroll-'));const port=19000+Math.floor(Math.random()*1500);
 const proc=spawn(findChrome(),['--headless=new','--no-sandbox','--disable-gpu',`--remote-debugging-port=${port}`,`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore',windowsHide:true});let c;const cases=[],diagnostics=[];
 const pause=()=>new Promise(r=>setTimeout(r,90));
 try{
  c=new Cdp((await waitJson(`http://127.0.0.1:${port}/json/list`,30000,proc)).find(t=>t.type==='page').webSocketDebuggerUrl);c.ws.addEventListener('message',event=>{const m=JSON.parse(String(event.data));if(m.method==='Runtime.exceptionThrown')diagnostics.push(m.params.exceptionDetails.text);if(m.method==='Log.entryAdded'&&/passive/i.test(m.params.entry.text))diagnostics.push(m.params.entry.text);});await c.send('Page.enable');await c.send('Runtime.enable');await c.send('Log.enable');
  await c.send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
  const load=async before=>{await c.send('Page.navigate',{url:new URL('__desktop-scroll'+(before?'?before=1':''),server.url).href});await c.eval('(async()=>{const end=Date.now()+5000;while((!window.ready||!window.FourSymbolsGestureArbiter)&&Date.now()<end)await new Promise(r=>setTimeout(r,20));if(!window.ready||!window.FourSymbolsGestureArbiter)throw Error("synthetic scroll fixture not ready");})()');};
  const box=async selector=>c.eval(`document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect().toJSON()`);
  const point=async selector=>{const b=await box(selector);return{x:b.x+b.width/2,y:b.y+b.height/2};};
  const press=p=>c.send('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',clickCount:1});
  const release=p=>c.send('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'left',clickCount:1});
  const drag=async(selector,dx,dy)=>{const p=await point(selector);await press(p);const first=Math.min(1,12/Math.max(1,Math.hypot(dx,dy)));await c.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:p.x+dx*first,y:p.y+dy*first,button:'left',buttons:1});for(let i=1;i<=6;i++)await c.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:p.x+dx*i/6,y:p.y+dy*i/6,button:'left',buttons:1});await release({x:p.x+dx,y:p.y+dy});await pause();};
  const shot=async name=>fs.writeFileSync(path.join(out,name+'.png'),Buffer.from((await c.send('Page.captureScreenshot',{format:'png'})).data,'base64'));
  if(oldPath){await load(true);await drag('#reward1',-100,0);assert.equal(await c.eval('rail.scrollLeft'),0);await shot('before-no-mouse-pan');cases.push({name:'original mouse drag missing',scroll:0});}
  await load(false);
  for(const scale of [1,.5]){
   await c.eval(`document.getElementById('game-stage').style.transform='scale(${scale})';vertical.scrollTop=0;rail.scrollLeft=0;claims=0;`);
   await drag('#reward1',-80,0);const left=await c.eval('rail.scrollLeft');assert(Math.abs(left-80/scale)<2);assert.equal(await c.eval('claims'),0,'drag cannot claim');
   await shot('after-horizontal-scale-'+scale);cases.push({name:'mouse horizontal scale '+scale,scroll:left,noReward:true});
   await c.eval('rail.scrollLeft=0');await drag('#reward0',9,0);assert.equal(await c.eval('rail.scrollLeft'),0);assert.equal(await c.eval('claims'),1,'under10px remains a tap');
   await c.eval('claims=0;vertical.scrollTop=0;rail.scrollLeft=0');await drag('#reward0',0,-65);assert(Math.abs(await c.eval('vertical.scrollTop')-65/scale)<2);assert.equal(await c.eval('rail.scrollLeft'),0,'vertical movement does not consume inner x rail');assert.equal(await c.eval('claims'),0);
   cases.push({name:'nested vertical scale '+scale,scroll:await c.eval('vertical.scrollTop'),noReward:true});
  }
  await c.eval("document.getElementById('game-stage').style.transform='scale(1)';vertical.scrollTop=0;rail.scrollLeft=0;claims=0;");
  const wheel=await point('#rail');await c.send('Input.dispatchMouseEvent',{type:'mouseWheel',...wheel,deltaX:0,deltaY:100});await pause();assert(await c.eval('vertical.scrollTop')>0,'native wheel remains available');cases.push({name:'native wheel retained'});
  await c.eval('vertical.scrollTop=0;rail.scrollLeft=0;reward0.focus()');await c.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'});await c.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});assert.equal(await c.eval('claims'),1,'keyboard activation survives');cases.push({name:'keyboard activation retained'});
  await c.eval('claims=0;rail.scrollLeft=0');await drag('#reward0',-900,0);assert.equal(await c.eval('rail.scrollLeft'),await c.eval('rail.scrollWidth-rail.clientWidth'));assert.equal(await c.eval('claims'),0);await drag('#reward4',900,0);assert.equal(await c.eval('rail.scrollLeft'),0);cases.push({name:'both horizontal ends clamp without reward'});
  for(const selector of ['#edit','#range','#textarea','#select','#editable','#emptyEditable','#formation','#battleElementBoxButton','#v141TaskTracker','#hold','#canvas']){
   await c.eval(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center'});`);const before=await c.eval('vertical.scrollTop');const p=await point(selector);await press(p);await c.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:p.x-30,y:p.y-35,button:'left',buttons:1});assert.equal(await c.eval('!!FourSymbolsGestureArbiter.getState(1)?.mouseScroll'),false,selector+' cannot be stolen for panning');await release({x:p.x-30,y:p.y-35});assert.equal(await c.eval('vertical.scrollTop'),before,selector+' must retain original input owner');
   cases.push({name:'dedicated input excluded '+selector});
  }
  await c.eval('vertical.scrollTop=0;rail.scrollLeft=0;claims=0;');const start=await point('#reward0');await press(start);await c.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:start.x-40,y:start.y,button:'left',buttons:1});await c.eval("window.dispatchEvent(new Event('blur'))");assert.equal(await c.eval('FourSymbolsGestureArbiter.getState(1)'),null);await release({x:start.x-40,y:start.y});await drag('#reward0',0,0);assert.equal(await c.eval('claims'),1,'cleanup cannot consume the next independent tap');cases.push({name:'blur capture cleanup and next tap'});
  await c.eval("vertical.scrollTop=0;rail.scrollLeft=0;claims=0;detached.innerHTML='<div style=\"width:700px;height:100px\"><button id=\"retiredReward\" onclick=\"claims++\">合成領取</button></div>';FourSymbolsGestureArbiter.registerSurface(detached);");const retired=await point('#retiredReward');await press(retired);await c.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:retired.x-25,y:retired.y,button:'left',buttons:1});await c.eval('FourSymbolsGestureArbiter.unregisterSurface(detached)');await release({x:retired.x-25,y:retired.y});assert.equal(await c.eval('claims'),0,'unregister during drag cannot activate a still-connected reward');await drag('#retiredReward',0,0);assert.equal(await c.eval('claims'),1,'retiring a drag must not consume the next independent click');cases.push({name:'unregister during mouse drag and fresh click'});
  for(const reset of ['resize','blur']){
   await c.eval('claims=0;detached.scrollLeft=0;FourSymbolsGestureArbiter.registerSurface(detached)');const retiring=await point('#retiredReward');await press(retiring);await c.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:retiring.x-25,y:retiring.y,button:'left',buttons:1});await c.eval(`FourSymbolsGestureArbiter.unregisterSurface(detached);window.dispatchEvent(new Event(${JSON.stringify(reset)}));retiredReward.focus()`);
   await c.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'});await c.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});assert.equal(await c.eval('claims'),1,'retired pointer guard must preserve keyboard activation');await c.eval('claims=0');
   await release({x:retiring.x-25,y:retiring.y});assert.equal(await c.eval('claims'),0,reset+' after unregister cannot remove the retired gesture protection');await drag('#retiredReward',0,0);assert.equal(await c.eval('claims'),1);cases.push({name:'unregister then '+reset+' preserves keyboard and suppresses release'});
  }
  await c.eval('claims=0;detached.scrollLeft=0;FourSymbolsGestureArbiter.registerSurface(detached)');const held=await point('#retiredReward');await press(held);await c.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:held.x-25,y:held.y,button:'left',buttons:1});await c.eval('FourSymbolsGestureArbiter.unregisterSurface(detached)');await new Promise(r=>setTimeout(r,1150));await release({x:held.x-25,y:held.y});assert.equal(await c.eval('claims'),0,'completion lifetime must start on release, not while mouse remains held');cases.push({name:'unregister while held longer than click lifetime cannot claim'});
  for(const reset of ['blur','resize']){
   await c.eval('vertical.scrollTop=0;rail.scrollLeft=0;claims=0;');const p=await point('#reward0');await press(p);await c.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:p.x-25,y:p.y,button:'left',buttons:1});await c.eval(`window.dispatchEvent(new Event(${JSON.stringify(reset)}))`);await new Promise(r=>setTimeout(r,1150));await release({x:p.x-25,y:p.y});assert.equal(await c.eval('claims'),0,reset+' cannot expire an active held drag before release');await drag('#reward0',0,0);assert.equal(await c.eval('claims'),1);cases.push({name:'active '+reset+' held longer than completion lifetime cannot claim'});
  }
  for(const cancel of ['pointercancel','lostcapture','resize','removed']){
   await c.eval('vertical.scrollTop=0;rail.scrollLeft=0;claims=0;');const p=await point('#reward0');await press(p);await c.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:p.x-25,y:p.y,button:'left',buttons:1});
   if(cancel==='pointercancel')await c.eval("document.dispatchEvent(new PointerEvent('pointercancel',{pointerId:1,pointerType:'mouse',bubbles:true}))");
   if(cancel==='lostcapture')await c.eval('reward0.releasePointerCapture(1)');
   if(cancel==='resize')await c.eval("window.dispatchEvent(new Event('resize'))");
   if(cancel==='removed')await c.eval('reward0.remove()');
   await c.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:p.x-30,y:p.y,button:'left',buttons:1});await release({x:p.x-30,y:p.y});assert.equal(await c.eval('claims'),0,cancel+' cannot activate rewards');assert.equal(await c.eval('FourSymbolsGestureArbiter.getState(1)'),null);
   if(cancel==='removed')await c.eval("rail.insertAdjacentHTML('afterbegin','<button id=\"reward0\">20%合成寶箱</button>')");
   await drag('#reward0',0,0);assert.equal(await c.eval('claims'),1,cancel+' cannot eat next tap');cases.push({name:cancel+' retires capture and preserves next tap'});
  }
  await c.eval("vertical.scrollTop=0;rail.scrollLeft=0;claims=0;reward0.setPointerCapture=()=>{throw Error('synthetic capture unavailable')}");await drag('#reward0',-40,0);assert.equal(await c.eval('claims'),0);assert(await c.eval('rail.scrollLeft')>0);await c.eval('delete reward0.setPointerCapture');cases.push({name:'capture unavailable retains drag suppression'});
  await c.eval('vertical.scrollTop=0;rail.scrollLeft=0;claims=0;');await c.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});const touch=await point('#reward0');await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch]});for(let i=1;i<=8;i++)await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:touch.x-120*i/8,y:touch.y}]});await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await pause();assert(await c.eval('rail.scrollLeft')>0,'native touch horizontal pan survives');assert.equal(await c.eval('claims'),0);cases.push({name:'native touch pan and no reward'});
  assert.deepEqual(diagnostics,[],'no runtime errors or passive-listener warnings');const head=execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim();fs.writeFileSync(path.join(out,'evidence.json'),JSON.stringify({head,sourceHash:crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,'js/01-stage-v8-touch-lock.js'))).digest('hex'),cases,diagnostics,scope:'Synthetic inputs/actions only; no accounts, game rewards or saves; browser touch emulation, not hardware'},null,2));console.log('PASS desktop mouse scroll: '+cases.length+' synthetic safety cases');
 }finally{
  c?.close();
  if(proc.exitCode===null&&proc.signalCode===null){
   if(process.platform==='win32'){try{execFileSync('taskkill',['/PID',String(proc.pid),'/T','/F'],{stdio:'ignore',windowsHide:true,timeout:5000});}catch{proc.kill();}}
   else proc.kill('SIGTERM');
   await new Promise(resolve=>{const timer=setTimeout(resolve,2000);proc.once('exit',()=>{clearTimeout(timer);resolve();});});
   if(proc.exitCode===null&&proc.signalCode===null)proc.kill('SIGKILL');
  }
  assert(path.resolve(profile).startsWith(path.resolve(os.tmpdir())+path.sep));fs.rmSync(profile,{recursive:true,force:true,maxRetries:3,retryDelay:100});server.server.closeAllConnections();await new Promise(r=>server.server.close(r));
 }
});
