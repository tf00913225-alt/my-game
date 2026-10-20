import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {spawn,execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {startServer,waitJson,Cdp,QA_CLOUD_MODULE,findChrome} from '../../.github/scripts/runtime-browser-qa-support.mjs';

// Only external transport is isolated. Every player action uses trusted CDP
// pointer/touch input. Runtime/state reads below are observations, never commands.
let cloud=QA_CLOUD_MODULE.replace(/export async function readCurrentCloudSave\(\)\{.*?\}\);\}/,
    'export async function readCurrentCloudSave(){return {exists:false,uid,path:"users/"+uid+"/saves/current",data:null};}');
cloud=cloud.replace('export async function bootstrapTrustedCloudSave(){throw new Error("QA cloud writes are forbidden");}',
    'export async function bootstrapTrustedCloudSave(){return {serverRevision:0,authoritativeStateReady:false};}');
cloud=cloud.replace('export async function createInitialCanonicalCharacter(){throw new Error("QA cloud writes are forbidden");}',
    'export async function createInitialCanonicalCharacter(selection,expectedRevision){if(expectedRevision!==0)throw Error("revision");return {sourceRevision:1,serverRevision:1,authoritativeStateReady:false};}');
assert.notEqual(cloud,QA_CLOUD_MODULE);
const chrome=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':findChrome());
const artifact=path.resolve('artifacts/browser-qa/chapter1-guided-pointer');fs.mkdirSync(artifact,{recursive:true});
const server=await startServer({cloudModule:cloud}),results=[];
if(process.argv.includes('--serve-only')){
    console.log(JSON.stringify({mode:'serve-only',url:server.url,pid:process.pid,transport:'fresh external auth/cloud transport only; no character or progress injection'}));
    await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});
    server.server.closeAllConnections();await new Promise(resolve=>server.server.close(resolve));
}else{
try{
    for(const [width,height] of [[393,873],[1920,1080]]){
        const mobile=width<700,trace=[];
        const port=await new Promise((resolve,reject)=>{const s=net.createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(error=>error?reject(error):resolve(p));});});
        const profile=fs.mkdtempSync(path.join(os.tmpdir(),'chapter1-pointer-qa-'));
        const proc=spawn(chrome,['--headless=new','--no-sandbox','--remote-allow-origins=*','--disable-gpu','--no-first-run','--remote-debugging-port='+port,'--user-data-dir='+profile,'about:blank'],{stdio:'ignore',windowsHide:true});
        let client;
        try{
            const pages=await waitJson('http://127.0.0.1:'+port+'/json/list');client=new Cdp(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
            await client.send('Page.enable');await client.send('Runtime.enable');
            await client.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});
            await client.send('Emulation.setTouchEmulationEnabled',{enabled:mobile,maxTouchPoints:1});
            await client.send('Page.navigate',{url:server.url});
            const wait=async(expression,label)=>{const deadline=Date.now()+45000;while(Date.now()<deadline){if(await client.eval(expression))return;await new Promise(r=>setTimeout(r,80));}throw Error(label);};
            const tap=async selector=>{
                const target=await client.eval(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)return {error:'missing target'};const r=e.getBoundingClientRect(),s=getComputedStyle(e),x=r.x+r.width/2,y=r.y+r.height/2,hit=document.elementFromPoint(x,y);return {x,y,text:e.textContent,error:e.disabled?'disabled':r.width<=0||r.height<=0||s.visibility==='hidden'||s.display==='none'?'hidden':x<0||y<0||x>=innerWidth||y>=innerHeight?'outside viewport':!(hit===e||e.contains(hit))?'occluded':null};})()`);
                assert.equal(target.error,null,selector+': '+target.error);trace.push({selector,...target,input:mobile?'touch':'mouse'});
                if(mobile){await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:target.x,y:target.y}]});await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
                else{await client.send('Input.dispatchMouseEvent',{type:'mousePressed',x:target.x,y:target.y,button:'left',clickCount:1});await client.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:target.x,y:target.y,button:'left',clickCount:1});}
                await new Promise(r=>setTimeout(r,150));
            };
            const capture=async label=>{await new Promise(r=>setTimeout(r,350));const shot=await client.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(artifact,width+'x'+height+'-'+label+'.png'),Buffer.from(shot.data,'base64'));};
            await wait('window.FourSymbolsStartupPolicy?.canCreateCharacter?.()','fresh creation ready');
            await tap('#creationId');await client.send('Input.insertText',{text:'點選驗收'});
            await tap('#creationPrimaryNextButton');
            for(let i=0;i<10;i++)await tap('[onclick="creationAdd(\'attack\',1)"]');
            await tap('#creationSubmitButton');
            await wait('!!document.querySelector(".adventure-story-dialogue")','opening dialogue visible');await capture('opening');
            let lines=20;
            while(await client.eval('!!document.querySelector(".adventure-story-dialogue")')&&lines-->0)await tap('#adventurePage [onclick*="advanceDialogue"]');
            assert.ok(lines>0,'bounded opening');await wait('typeof battleActive!=="undefined"&&battleActive','first battle starts');
            const rounds=[];
            for(let actions=0;actions<10&&await client.eval('battleActive');actions++){
                await wait('!battleActive||(battlePhase==="declare"&&!battleAdvanceScheduled&&battlePresentationLocks.size===0&&declaredCharacterIndexes.has(activeBattleCharacterIndex))','manual action ready');
                if(!await client.eval('battleActive'))break;
                const before=await client.eval('({turn,hp:player.hp,sp:player.sp,enemyHP:monsters[0].hp})');rounds.push(before);
                await tap('button[aria-label="普通攻擊"]');await tap('#battleMonster0');
                await wait('!battleActive||turn>'+before.turn,'natural battle round');
            }
            await wait('!battleActive','first battle terminates');await capture('first-victory');
            assert.equal(await client.eval('FourSymbolsAdventure.getView().panel'),'node-reward');
            await tap('#adventurePage [onclick*="claimNodeReward"]');
            await capture('reward-claimed-map');
            assert.equal(await client.eval('FourSymbolsAdventure.getView().selectedNodeId'),'c1_02');
            await tap('.adventure-sheet-actions button');
            await wait('FourSymbolsAdventure.getView().dialogue?.nodeId==="c1_02"','player reaches second story');await capture('second-story');
            results.push({width,height,trace,rounds,state:await client.eval('FourSymbolsAdventure.getChapterState()')});
        }catch(error){
            const diagnostic=await client?.eval('({body:document.body.innerText,view:window.FourSymbolsAdventure?.getView?.()})').catch(()=>null);
            if(client){const shot=await client.send('Page.captureScreenshot',{format:'png'}).catch(()=>null);if(shot)fs.writeFileSync(path.join(artifact,'failure.png'),Buffer.from(shot.data,'base64'));}
            fs.writeFileSync(path.join(artifact,'failure.json'),JSON.stringify({error:String(error.stack),width,height,trace,diagnostic},null,2));throw error;
        }finally{client?.close();proc.kill();}
    }
    fs.writeFileSync(path.join(artifact,'evidence.json'),JSON.stringify({passed:true,head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),manifest:createHash('sha256').update(fs.readFileSync('build/asset-manifest.json')).digest('hex'),transport:'isolated external transport; trusted pointer/touch player actions',results},null,2));
    console.log('Pointer/touch first victory, reward claim and second-story entry PASS');
}finally{server.server.closeAllConnections();await new Promise(resolve=>server.server.close(resolve));}
}
