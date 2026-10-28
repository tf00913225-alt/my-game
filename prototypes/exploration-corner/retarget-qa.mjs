import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import net from 'node:net';import {spawn} from 'node:child_process';
import {Cdp,waitJson} from '../../.github/scripts/runtime-browser-qa-support.mjs';
import {startSample} from './serve.mjs';
const {server,url}=await startSample(),results=[];
try{for(const width of [393,1920]){
const port=await new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
const proc=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--no-sandbox','--remote-allow-origins=*','--disable-gpu','--no-first-run','--remote-debugging-port='+port,'--user-data-dir='+fs.mkdtempSync(path.join(os.tmpdir(),'corner-probe-')),'about:blank'],{stdio:'ignore',windowsHide:true});let c;
try{const pages=await waitJson('http://127.0.0.1:'+port+'/json/list');c=new Cdp(pages.find(p=>p.type==='page').webSocketDebuggerUrl);await c.send('Page.enable');await c.send('Runtime.enable');
await c.send('Emulation.setDeviceMetricsOverride',{width,height:width===393?873:1080,deviceScaleFactor:1,mobile:width===393});await c.send('Emulation.setTouchEmulationEnabled',{enabled:width===393,maxTouchPoints:1});await c.send('Page.navigate',{url});await new Promise(r=>setTimeout(r,500));
await c.eval(`window.probe=[];const root=document.querySelector('.explore-corner');const read=()=>({t:performance.now(),position:root.dataset.position,destination:root.dataset.destination});for(const type of ['pointerdown','pointerup','pointercancel'])document.addEventListener(type,e=>{window.probe.push({...read(),type,x:e.clientX,y:e.clientY});queueMicrotask(()=>window.probe.push({...read(),type:type+'-handled'}));},{capture:true});function sample(){window.probe.push({...read(),type:'frame'});requestAnimationFrame(sample)}requestAnimationFrame(sample);true`);
const point=async(x,y)=>c.eval(`(()=>{const r=document.querySelector('[data-world]').getBoundingClientRect();return {x:r.left+${x}*r.width/1400,y:r.top+${y}*r.height/2600}})()`);
const down=async p=>c.send(width===393?'Input.dispatchTouchEvent':'Input.dispatchMouseEvent',width===393?{type:'touchStart',touchPoints:[{...p,id:1}]}:{type:'mousePressed',...p,button:'left',clickCount:1});
const up=async p=>c.send(width===393?'Input.dispatchTouchEvent':'Input.dispatchMouseEvent',width===393?{type:'touchEnd',touchPoints:[]}:{type:'mouseReleased',...p,button:'left',clickCount:1});
const read=()=>c.eval("({position:document.querySelector('.explore-corner').dataset.position,destination:document.querySelector('.explore-corner').dataset.destination})");
const cases=[];for(const [x,y] of [[400,1500],[950,1500],[400,1500],[500,1100],[800,900]]){
 const before=await read(),p=await point(x,y);await down(p);const contact=await read();
 if(x===800)assert.equal(contact.destination,'','blocked contact cancels the old route immediately');
 else{assert.ok(contact.destination,'destination exists before release');assert.notEqual(contact.destination,before.destination,'contact replaces the old route');}
 await new Promise(r=>setTimeout(r,250));const held=await read();await up(p);const released=await read();
 assert.equal(released.destination,held.destination,'release cannot replay an old coordinate');cases.push({target:[x,y],before,contact,held,released});
}
if(width===393){
 let p=await point(400,1500);await down(p);assert.ok((await read()).destination);
 await c.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});assert.equal((await read()).destination,'');
 p=await point(950,1500);await down(p);await c.send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight'});
 const before=await read();await c.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await new Promise(r=>setTimeout(r,120));
 const after=await read();assert.ok(Number(after.position.split(',')[0])>Number(before.position.split(',')[0])+10,'old pointer cancellation must not cancel keyboard takeover');
 await c.send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowRight',code:'ArrowRight'});
}
results.push({width,cases,events:await c.eval('window.probe')});
}catch(error){results.push({width,status:'FAIL',error:String(error.stack)});throw error;
}finally{c?.close();proc.kill();}}
}finally{server.closeAllConnections();server.close();const out=process.env.PROBE_OUTPUT||'../retarget-regression.json';fs.writeFileSync(out,JSON.stringify(results,null,2));}
for(const r of results)console.log(JSON.stringify({width:r.width,cases:r.cases.length,status:'PASS'}));
