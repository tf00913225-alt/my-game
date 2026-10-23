import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import net from 'node:net';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';
import {waitJson,Cdp,findChrome} from '../../.github/scripts/runtime-browser-qa-support.mjs';
import {startSample} from './serve.mjs';
const output=path.resolve(process.env.CORNER_QA_OUTPUT||'../corner-evidence');fs.mkdirSync(output,{recursive:true});
const {server,url}=await startSample();const results=[];
const chrome=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':findChrome());
try{for(const [width,height] of [[393,873],[1920,1080]]){
 const port=await new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'exploration-corner-'));
 const proc=spawn(chrome,['--headless=new','--no-sandbox','--remote-allow-origins=*','--disable-gpu','--no-first-run','--remote-debugging-port='+port,'--user-data-dir='+profile,'about:blank'],{stdio:'ignore',windowsHide:true});let client;
 try{
  const pages=await waitJson('http://127.0.0.1:'+port+'/json/list');client=new Cdp(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
  await client.send('Page.enable');await client.send('Runtime.enable');await client.send('Network.enable');
  await client.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<700});
  await client.send('Emulation.setTouchEmulationEnabled',{enabled:width<700,maxTouchPoints:1});
  await client.send('Page.navigate',{url});await new Promise(r=>setTimeout(r,900));
  const read=()=>client.eval(`(()=>{const r=document.querySelector('.explore-corner'),p=document.querySelector('[data-player]'),s=document.getElementById('game-stage').getBoundingClientRect();return {position:r.dataset.position,camera:r.dataset.camera,facing:p.dataset.facing,walking:p.classList.contains('is-walking'),prompt:document.querySelector('[data-interact]').disabled,dialog:!document.querySelector('[data-dialog]').hidden,stage:{width:s.width,height:s.height},saveKeys:Object.keys(localStorage)}})()`);
  const capture=async label=>{const shot=await client.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(output,`${width}-${label}.png`),Buffer.from(shot.data,'base64'));};
  const hold=async(direction,ms)=>{
   if(width<700){const point=await client.eval(`(()=>{const r=document.querySelector('[data-direction="${direction}"]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...point,id:1,radiusX:2,radiusY:2}]});await new Promise(r=>setTimeout(r,ms));await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
   else{const key={up:'ArrowUp',down:'ArrowDown',left:'ArrowLeft',right:'ArrowRight'}[direction];await client.send('Input.dispatchKeyEvent',{type:'keyDown',key,code:key});await new Promise(r=>setTimeout(r,ms));await client.send('Input.dispatchKeyEvent',{type:'keyUp',key,code:key});}
   await new Promise(r=>setTimeout(r,90));
  };
  const spriteVisible=async()=>{const box=await client.eval(`(()=>{const b=document.querySelector('[data-player] use').getBBox();return {width:b.width,height:b.height}})()`);assert.ok(box.width>50&&box.height>100,'player SVG geometry must actually load');};
  const start=await read();assert.ok(start.position);assert.ok(Math.abs(start.stage.width/start.stage.height-9/16)<.001);assert.deepEqual(start.saveKeys,[]);await spriteVisible();await capture('start');
  await hold('up',1600);const house=await read();assert.ok(Number(house.position.split(',')[1])>=1053);await capture('house-collision');
  await hold('down',800);await hold('right',1050);const near=await read();assert.equal(near.prompt,false);await capture('npc-near');
  const tap=async selector=>{const p=await client.eval(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);if(width<700){await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...p,id:1}]});await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}else{await client.send('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',clickCount:1});await client.send('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'left',clickCount:1});}await new Promise(r=>setTimeout(r,150));};
  await tap('[data-interact]');const dialog=await read();assert.equal(dialog.dialog,true);await capture('greeting');await hold('left',300);assert.equal((await read()).position,dialog.position);await tap('[data-dialog] button');
  await hold('down',900);await hold('left',2250);await capture('tree-front');
  // Go around the trunk before walking beneath the foreground canopy.
  await hold('left',250);await hold('up',1300);await hold('right',280);await capture('tree-back');
  const depth=await client.eval(`({player:Number(document.querySelector('[data-player]').style.zIndex),tree:Number(document.querySelector('[data-object="tree"]').style.zIndex)})`);assert.ok(depth.player<depth.tree,'actual character is behind tree');
  const stop=await read();await new Promise(r=>setTimeout(r,250));assert.equal((await read()).position,stop.position);assert.equal(stop.walking,false);assert.deepEqual(stop.saveKeys,[]);
  // Lifecycle-only fixture: simulate restored visible dialog without injecting player state.
  await client.eval(`window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));document.querySelector('[data-dialog]').hidden=false;window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));true`);
  const remount=await read();assert.equal(remount.dialog,false);assert.equal(remount.position,start.position);assert.equal(remount.walking,false);
  await hold('down',200);assert.notEqual((await read()).position,remount.position);
  const tapWorld=async(x,y)=>{
    const started=Date.now();
    const point=await client.eval(`(()=>{const r=document.querySelector('[data-world]').getBoundingClientRect();return {x:r.left+${x}*r.width/1400,y:r.top+${y}*r.height/2600}})()`);
    if(width<700){await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...point,id:1}]});await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
    else{await client.send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});await client.send('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});}
    return Date.now()-started;
  };
  const destination=()=>client.eval(`document.querySelector('.explore-corner').dataset.destination`);
  const arrive=async()=>{const deadline=Date.now()+12000;while(await destination()){if(Date.now()>deadline)throw Error('tap route did not arrive');await new Promise(r=>setTimeout(r,100));}};
  const diagonalStart=await read();await tapWorld(400,1600);await new Promise(r=>setTimeout(r,160));
  const diagonal=await read(),[sx,sy]=diagonalStart.position.split(',').map(Number),[dx,dy]=diagonal.position.split(',').map(Number);
  assert.ok(dx<sx&&dy>sy,'tap movement must visibly advance both axes');await capture('diagonal-moving');await arrive();
  if(width>=700){
   await client.send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowDown',code:'ArrowDown'});await client.send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight'});
   const before=(await read()).position.split(',').map(Number);await new Promise(r=>setTimeout(r,160));
   await client.send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowDown',code:'ArrowDown'});await client.send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowRight',code:'ArrowRight'});
   const after=(await read()).position.split(',').map(Number);assert.ok(after[0]>before[0]&&after[1]>before[1],'combined keyboard input must be diagonal');
  }
  await tapWorld(720,1250);await arrive();
  await tapWorld(720,650);assert.equal(await destination(),'720.00,650.00');await capture('tap-house-route');await arrive();
  const houseRoute=await read();assert.ok(Math.abs(Number(houseRoute.position.split(',')[1])-650)<1);await capture('tap-house-arrived');
  await tapWorld(800,900);assert.equal(await destination(),'');assert.match(await client.eval(`document.querySelector('[data-status]').textContent`),/無法抵達/);
  await tapWorld(720,1250);await new Promise(r=>setTimeout(r,100));const retapMs=await tapWorld(500,1100),retarget=(await destination()).split(',').map(Number);
  // The camera keeps moving between CDP coordinate sampling and pointer release.
  // Bound that drift by actual elapsed time and world speed; stationary taps below remain exact.
  assert.equal(retarget.length,2);assert.notEqual(await destination(),'720.00,1250.00');
  assert.ok(Math.hypot(retarget[0]-500,retarget[1]-1100)<=320*retapMs/1000+1,'retarget must match the release-time camera within its physical travel bound');
  await hold('down',200);assert.equal(await destination(),'');const takeover=await read();await new Promise(r=>setTimeout(r,150));assert.equal((await read()).position,takeover.position);
  await tapWorld(720,1250);await arrive();await tapWorld(1060,1280);assert.notEqual(await destination(),'');assert.equal((await read()).dialog,false);await arrive();
  const npcTap=await read();assert.equal(npcTap.prompt,false);assert.equal(npcTap.dialog,false);await new Promise(r=>setTimeout(r,100));await spriteVisible();await capture('tap-npc-arrived');
  await tap('[data-interact]');assert.equal((await read()).dialog,true);assert.equal(await destination(),'');await tap('[data-dialog] button');
  await client.send('Emulation.setDeviceMetricsOverride',{width:width<700?360:1440,height:width<700?800:900,deviceScaleFactor:1,mobile:width<700});
  await new Promise(r=>setTimeout(r,150));await tapWorld(800,1500);assert.equal(await destination(),'800.00,1500.00');await arrive();await capture('tap-resized');
  const errors=client.events.filter(e=>e.method==='Runtime.exceptionThrown');assert.deepEqual(errors,[]);
  results.push({width,height,start,house,near,dialog,stop,depth,remount,houseRoute,npcTap,takeover,retap:{elapsedMs:retapMs,target:retarget,error:Math.hypot(retarget[0]-500,retarget[1]-1100)},errors,method:width<700?'CDP touch emulation; not physical phone':'CDP keyboard and mouse',status:'PASS'});
 }catch(error){results.push({width,height,status:'FAIL',error:String(error.stack)});throw error;}
 finally{client?.close();proc.kill();}
}}finally{server.closeAllConnections();server.close();fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify({output,results}));}
