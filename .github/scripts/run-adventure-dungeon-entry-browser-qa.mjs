import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {startServer,waitJson,Cdp,findChrome} from './runtime-browser-qa-support.mjs';

// Full production entry handlers, lazy loader and pages; only the established
// isolated account transport replaces external Firebase. No battle or rewards.
const local=await startServer({baseUrl:process.env.ENTRY_QA_BASE_URL});
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'entry-route-qa-'));
const port=9893;
const proc=spawn(findChrome(),['--headless=new','--no-sandbox','--disable-gpu','--remote-debugging-port='+port,'--user-data-dir='+profile,'about:blank'],{stdio:'ignore',windowsHide:true});
const out=process.env.ENTRY_QA_OUTPUT||'artifacts/adventure-dungeon-entry';
fs.mkdirSync(out,{recursive:true});
const results=[];let c;
const until=expression=>c.eval(`(async()=>{const end=Date.now()+60000;while(!(${expression})&&Date.now()<end)await new Promise(r=>setTimeout(r,50));if(!(${expression}))throw Error('entry QA timeout');return true;})()`);
async function tap(selector){
    const point=await c.eval(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('missing control');const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2,hit=document.elementFromPoint(x,y);if(e.disabled||!hit||!(e===hit||e.contains(hit)))throw Error('control intercepted: '+hit?.id);return {x,y};})()`);
    await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...point,radiusX:1,radiusY:1}]});
    await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
}
async function snapshot(){return c.eval(`(()=>{const root=document.getElementById('adventurePage');return {active:[...document.querySelectorAll('.page.active')].map(e=>e.id),title:document.getElementById('adventureHeaderTitle')?.textContent,adventureHidden:root?.hidden,adventureVisible:window.FourSymbolsAdventure?.getView()?.visible,roots:document.querySelectorAll('#adventurePage').length,entries:document.querySelectorAll('#adventureHomeEntry').length,shells:document.querySelectorAll('.native-bottom-nav-layer').length,dungeon:document.getElementById('dungeonTabContent')?.textContent,errors:window.__entryErrors};})()`);}
async function capture(label){const shot=await c.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,label+'.png'),Buffer.from(shot.data,'base64'));}
try{
    const tabs=await waitJson('http://127.0.0.1:'+port+'/json/list');c=new Cdp(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
    await c.send('Page.enable');await c.send('Runtime.enable');
    await c.send('Page.addScriptToEvaluateOnNewDocument',{source:"window.__entryErrors=[];addEventListener('error',e=>__entryErrors.push(e.message));"});
    for(const [width,height] of [[390,844],[412,915]]){
        await c.send('Storage.clearDataForOrigin',{origin:new URL(local.url).origin,storageTypes:'local_storage'});
        await c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});
        await c.send('Emulation.setTouchEmulationEnabled',{enabled:true});
        await c.send('Page.navigate',{url:local.url});
        await until("window.FourSymbolsStartupPolicy?.getState?.()==='READY'&&document.getElementById('startupLoader')?.hidden&&!document.querySelector('#firebaseAuthOverlay.show')");
        await c.eval("closeHomeFeature();showPage('home');");
        for(let n=0;n<3;n++){
            await tap('#adventureHomeEntry');
            await until("document.getElementById('adventurePage')?.classList.contains('active')");
            const adventure=await snapshot();
            assert.deepEqual(adventure.active,['adventurePage']);assert.equal(adventure.title,'山關初行');assert.equal(adventure.adventureHidden,false);assert.equal(adventure.adventureVisible,true);
            assert.equal(adventure.roots,1);assert.equal(adventure.entries,1);assert.equal(adventure.shells,1);
            if(n===0)await capture(width+'-adventure');
            await tap('#adventurePage .adventure-back-button');
            assert.deepEqual((await snapshot()).active,['homePage']);
            await tap('#dungeonNav');
            await until("document.getElementById('dungeonPage')?.classList.contains('active')");
            const dungeon=await snapshot();
            assert.deepEqual(dungeon.active,['dungeonPage']);assert.equal(dungeon.adventureHidden,true);assert.equal(dungeon.adventureVisible,false);assert.match(dungeon.dungeon,/經驗副本/);assert.doesNotMatch(dungeon.dungeon,/山關初行/);assert.deepEqual(dungeon.errors,[]);
            if(n===0)await capture(width+'-dungeon');
            results.push({width,height,iteration:n+1,adventure,dungeon});
            console.log('PASS touch routes',width,height,n+1);
            await tap('#bottomNav button[aria-label="返回"]');
        }
        // Repeated accepted navigation calls cannot remount or lose visibility.
        await c.eval("openAdventureMap();openAdventureMap();openAdventureMap();");
        const repeat=await snapshot();assert.deepEqual(repeat.active,['adventurePage']);assert.equal(repeat.adventureVisible,true);assert.equal(repeat.roots,1);
        await c.eval("openDungeonHub();openDungeonHub();openDungeonHub();");
        const repeatDungeon=await snapshot();assert.deepEqual(repeatDungeon.active,['dungeonPage']);assert.equal(repeatDungeon.adventureHidden,true);
    }
    fs.writeFileSync(path.join(out,'evidence.json'),JSON.stringify({base:process.env.ENTRY_QA_BASE_URL||'local-production',results},null,2));
    console.log('PASS: 6 Adventure + 6 Dungeon touch entries; repeated calls, unique roots, final visibility, no page errors.');
}finally{c?.close();proc.kill();local.server.close();}
