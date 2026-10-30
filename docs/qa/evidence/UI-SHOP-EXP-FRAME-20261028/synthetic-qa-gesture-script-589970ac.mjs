import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {startServer,findChrome,waitJson,Cdp} from 'file:///C:/Users/User/.codex/worktrees/ui1016-integration/my-game/.github/scripts/runtime-browser-qa-support.mjs';
const output='C:/Projects/my-game/artifacts/ui1016-shop-scroll-v3-589970ac';
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
      if(name==='exp'){
        for(const tab of ['status','expPool']){
          const pt=await client.eval(`(()=>{const e=[...document.querySelectorAll('.character-tab-row button')].find(x=>(x.getAttribute('onclick')||'').includes(${JSON.stringify("switchCharacterTab('")}+${JSON.stringify(tab)}));if(!e)throw Error('tab missing '+${JSON.stringify(tab)});const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2,h=document.elementFromPoint(x,y);if(!h||!(h===e||e.contains(h)))throw Error('tab covered');return{x,y}})()`);
          if(w<800){await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[pt]});await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}else{await client.send('Input.dispatchMouseEvent',{type:'mousePressed',...pt,button:'left',clickCount:1});await client.send('Input.dispatchMouseEvent',{type:'mouseReleased',...pt,button:'left',clickCount:1});}
          await new Promise(r=>setTimeout(r,300));const actual=await client.eval("document.getElementById('homeFeatureModal').dataset.characterTab");if(actual!==tab)throw Error('tab switch failed '+tab+' '+actual);
          fs.writeFileSync(path.join(output,`tab-${tab}-${w}x${h}.json`),JSON.stringify({viewport:[w,h],tab,actual,input:w<800?'touch':'mouse'},null,2));
        }
      }
      const shot=await client.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(output,`${name}-${w}x${h}.png`),Buffer.from(shot.data,'base64'));
      const scrolling=await client.eval(`(()=>{const root=document.querySelector('#homeFeatureModal');return [...root.querySelectorAll('*')].filter(e=>e.scrollHeight>e.clientHeight+5&&/(auto|scroll)/.test(getComputedStyle(e).overflowY)).map(e=>({id:e.id,cls:e.className,top:e.scrollTop,max:e.scrollHeight-e.clientHeight,rect:e.getBoundingClientRect().toJSON()}));})()`);
      fs.writeFileSync(path.join(output,`${name}-scroll-${w}x${h}.json`),JSON.stringify(scrolling,null,2));
      if(name==='exp'&&w<800){const s=scrolling.find(a=>a.id==='characterTabContent');if(!s)throw Error('exp scroll owner missing');const x=s.rect.x+s.rect.width*.9,y=s.rect.y+s.rect.height*.8;await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});for(let i=1;i<=8;i++){await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-i*20}]});await new Promise(r=>setTimeout(r,30));}await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await new Promise(r=>setTimeout(r,350));const after=await client.eval("document.getElementById('characterTabContent').scrollTop");fs.writeFileSync(path.join(output,`exp-touch-scroll-${w}x${h}.json`),JSON.stringify({before:s.top,after,max:s.max}));if(after<=s.top)throw Error('touch scroll failed');}
      if(scrolling.length){const s=scrolling[0],x=s.rect.x+s.rect.width/2,y=s.rect.y+s.rect.height/2;const selector=s.id?'#'+s.id:'.shop-potion-list';const before=await client.eval(`document.querySelector(${JSON.stringify(selector)}).scrollTop`);await client.send('Input.dispatchMouseEvent',{type:'mouseWheel',x,y,deltaX:0,deltaY:12000});await new Promise(r=>setTimeout(r,350));const after=await client.eval(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});return e?{top:e.scrollTop,max:e.scrollHeight-e.clientHeight}:null})()`);fs.writeFileSync(path.join(output,`${name}-wheel-${w}x${h}.json`),JSON.stringify({selector,before,after},null,2));if(!after||after.top<after.max-2)throw Error('wheel did not reach bottom '+name);const bottom=await client.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(output,`${name}-bottom-${w}x${h}.png`),Buffer.from(bottom.data,'base64'));}
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
