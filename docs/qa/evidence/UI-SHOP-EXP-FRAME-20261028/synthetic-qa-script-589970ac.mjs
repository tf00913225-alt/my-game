import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {startServer,findChrome,waitJson,Cdp} from 'file:///C:/Users/User/.codex/worktrees/ui1016-integration/my-game/.github/scripts/runtime-browser-qa-support.mjs';
const output='C:/Projects/my-game/artifacts/ui1016-touch-589970ac';
fs.mkdirSync(output,{recursive:true});
const server=await startServer();
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'ui1016-qa-'));
let browser,client;
try {
  browser=spawn(findChrome(),['--headless=new','--disable-gpu','--remote-debugging-port=19476',`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore',windowsHide:true});
  const target=(await waitJson('http://127.0.0.1:19476/json/list')).find(t=>t.type==='page');
  client=new Cdp(target.webSocketDebuggerUrl);
  await client.send('Page.enable'); await client.send('Runtime.enable');
  let loaded=false;
  for(const [w,h] of [[360,640],[393,873],[412,915],[1280,800]]){
    await client.send('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile:w<800});
    await client.send('Emulation.setTouchEmulationEnabled',{enabled:w<800});
    if(!loaded){await client.send('Page.navigate',{url:server.url});await new Promise(r=>setTimeout(r,1000));
    await client.eval(`(async()=>{const until=Date.now()+45000;while(Date.now()<until&&!(window.FourSymbolsStartupPolicy?.getState?.()==='READY'&&document.getElementById('startupLoader')?.hidden&&!document.getElementById('firebaseAuthOverlay')?.classList.contains('show')&&getComputedStyle(document.getElementById('gameInterface')).display!=='none')) await new Promise(r=>setTimeout(r,100));if(window.FourSymbolsStartupPolicy?.getState?.()!=='READY'||document.getElementById('firebaseAuthOverlay')?.classList.contains('show'))throw Error('startup not ready: '+JSON.stringify({state:window.FourSymbolsStartupPolicy?.getState?.(),error:String(window.FourSymbolsStartupPolicy?.getLastError?.()?.message||''),loaderHidden:document.getElementById('startupLoader')?.hidden,authVisible:document.getElementById('firebaseAuthOverlay')?.classList.contains('show')}));await FourSymbolsFeatures.ensure('gameplay-core','ui1016-qa');showPage('home');closeHomeFeature()})()`);loaded=true;}
    for(const [name,action] of [['shop',"openHomeFeature('shop')"],['exp',"closeHomeFeature();openHomeFeature('character');switchCharacterTab('expPool')"]]){
      await client.eval(action); await new Promise(r=>setTimeout(r,400));
      const shot=await client.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(output,`${name}-${w}x${h}.png`),Buffer.from(shot.data,'base64'));
      const scrolling=await client.eval(`(()=>{const root=document.querySelector('#homeFeatureModal');return [...root.querySelectorAll('*')].filter(e=>e.scrollHeight>e.clientHeight+5&&/(auto|scroll)/.test(getComputedStyle(e).overflowY)).map(e=>({id:e.id,cls:e.className,top:e.scrollTop,max:e.scrollHeight-e.clientHeight,rect:e.getBoundingClientRect().toJSON()}));})()`);
      fs.writeFileSync(path.join(output,`${name}-scroll-${w}x${h}.json`),JSON.stringify(scrolling,null,2));
      if(scrolling.length){const s=scrolling[0],x=s.rect.x+s.rect.width/2,y=s.rect.y+s.rect.height/2;await client.send('Input.dispatchMouseEvent',{type:'mouseWheel',x,y,deltaX:0,deltaY:1200});await new Promise(r=>setTimeout(r,350));const after=await client.eval(`(()=>{const e=document.getElementById(${JSON.stringify(s.id)});return e?{top:e.scrollTop,max:e.scrollHeight-e.clientHeight}:null})()`);fs.writeFileSync(path.join(output,`${name}-wheel-${w}x${h}.json`),JSON.stringify({before:s,after},null,2));if(s.id&&(!after||after.top<=s.top))throw Error('wheel did not scroll '+name);const bottom=await client.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(output,`${name}-bottom-${w}x${h}.png`),Buffer.from(bottom.data,'base64'));}
      const geom=await client.eval(`(()=>{const e=document.querySelector('#homeFeatureModalTitle'),r=e.getBoundingClientRect(),b=document.querySelector('#homeFeatureModal button[onclick="closeHomeFeature()"]');if(!b)throw Error('missing back');const q=b.getBoundingClientRect();if(!q.width||!q.height)throw Error('back is hidden');return {title:r.toJSON(),back:q.toJSON()}})()`);
      fs.writeFileSync(path.join(output,`${name}-${w}x${h}.json`),JSON.stringify(geom,null,2));
      await client.eval(`document.getElementById('homeFeatureModalTitle').textContent='測試很長的頁面標題文字';`);
      await new Promise(r=>setTimeout(r,200));const long=await client.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(output,`${name}-long-${w}x${h}.png`),Buffer.from(long.data,'base64'));
      const b=geom.back,x=b.x+b.width/2,y=b.y+b.height/2;
      const hit=await client.eval(`(()=>{const b=document.querySelector('#homeFeatureModal button[onclick="closeHomeFeature()"]'),h=document.elementFromPoint(${x},${y});return !!(h&&(h===b||b.contains(h)))})()`);if(!hit)throw Error('back obscured '+name);
      if(w<800){await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}else{await client.send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1});await client.send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1});}
      await new Promise(r=>setTimeout(r,200));if(await client.eval("getComputedStyle(document.getElementById('homeFeatureModal')).display!=='none' && document.getElementById('homeFeatureModal').classList.contains('show')"))throw Error('back did not close '+name);
    }
  }
} finally {client?.close();browser?.kill();server.server.close();try{fs.rmSync(profile,{recursive:true,force:true});}catch{}}
