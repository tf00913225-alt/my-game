import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {spawn} from "node:child_process";
import {startServer,waitJson,Cdp,QA_CLOUD_MODULE} from "../../.github/scripts/runtime-browser-qa-support.mjs";

// Production index, feature loader, createCharacter, Adventure and battle stay
// real. Only Firebase transport is isolated; this is not SDK/emulator evidence.
let cloud=QA_CLOUD_MODULE.replace(/export async function readCurrentCloudSave\(\)\{.*?\}\);\}/,
    'export async function readCurrentCloudSave(){return {exists:false,uid,path:"users/"+uid+"/saves/current",data:null};}');
cloud=cloud.replace('export async function bootstrapTrustedCloudSave(){throw new Error("QA cloud writes are forbidden");}',
    'export async function bootstrapTrustedCloudSave(){return {serverRevision:0,authoritativeStateReady:false};}');
cloud=cloud.replace('export async function createInitialCanonicalCharacter(){throw new Error("QA cloud writes are forbidden");}',
    'export async function createInitialCanonicalCharacter(selection,expectedRevision){if(expectedRevision!==0)throw Error("revision");window.__storyQaCreated={selection,expectedRevision};return {sourceRevision:1,serverRevision:1,authoritativeStateReady:false};}');
assert.notEqual(cloud,QA_CLOUD_MODULE);
const chrome=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||"C:/Program Files/Google/Chrome/Application/chrome.exe";
assert.ok(fs.existsSync(chrome));
const artifact=path.resolve("artifacts/browser-qa/chapter1-story");fs.mkdirSync(artifact,{recursive:true});
const server=await startServer({cloudModule:cloud});const results=[];
console.log(JSON.stringify({pid:process.pid,url:server.url,artifact}));
try{
    for(const [width,height] of [[360,800],[393,873],[412,915],[1920,1080]]){
        const profile=fs.mkdtempSync(path.join(os.tmpdir(),"chapter1-story-qa-")),port=9700+Math.floor(Math.random()*200);
        const proc=spawn(chrome,["--headless=new","--no-sandbox","--remote-allow-origins=*","--disable-gpu","--no-first-run","--remote-debugging-address=127.0.0.1","--remote-debugging-port="+port,"--user-data-dir="+profile,"about:blank"],{stdio:"ignore",windowsHide:true});
        let client;
        try{
            const pages=await waitJson(`http://127.0.0.1:${port}/json/list`);console.log('page target',pages.find(p=>p.type==="page")?.webSocketDebuggerUrl);client=new Cdp(pages.find(p=>p.type==="page").webSocketDebuggerUrl);
            await Promise.race([client.ready,new Promise((_,reject)=>setTimeout(()=>reject(Error('WebSocket open deadline')),5000))]);console.log('websocket open');
            await Promise.race([client.send("Page.enable"),new Promise((_,reject)=>setTimeout(()=>reject(Error('Page.enable deadline')),10000))]);console.log('page enabled');await client.send("Runtime.enable");
            await client.send("Emulation.setDeviceMetricsOverride",{width,height,deviceScaleFactor:1,mobile:width<700});
            await client.send("Page.navigate",{url:server.url});console.log('navigated',width,height);
            const result=await Promise.race([client.eval(`(async()=>{
                const check=(v,m)=>{if(!v)throw Error(m);};
                const wait=async(fn,label)=>{const deadline=Date.now()+30000;while(!fn()&&Date.now()<deadline)await new Promise(r=>setTimeout(r,50));check(fn(),label);};
                await wait(()=>window.FourSymbolsStartupPolicy?.canCreateCharacter?.(),'fresh account creation state');
                await FourSymbolsFeatures.ensure('gameplay-core','chapter1-story-browser-qa');
                document.getElementById('creationId').value='故事驗收';
                while(creationPoints>0)creationAdd('attack',1);
                await createCharacter();
                await wait(()=>window.FourSymbolsAdventure?.getView?.().dialogue,'creation directly opens story');
                await wait(()=>window.FourSymbolsReleaseUpdate?.getState?.().availableReleaseVersion,'release notice resolved');
                check(!document.getElementById('homeFeatureModal')?.classList.contains('show'),'normal login announcement must defer until onboarding ends');
                check(window.__storyQaCreated?.selection.displayName==='故事驗收','real creation consumed transport');
                const api=FourSymbolsAdventure,first=api.getView();
                check(first.dialogue.nodeId==='c1_01','first story node');
                const root=document.getElementById('adventurePage');check(root,'story root');
                const before=api.getView().dialogue.lineIndex;
                const next=root.querySelector('[onclick*="advanceDialogue"]');check(next,'Next control');next.click();
                check(api.getView().dialogue.lineIndex===before+1,'one click advances exactly one line');
                const rect=root.querySelector('[onclick*="advanceDialogue"]').getBoundingClientRect();check(rect.width>0&&rect.height>0,'Next visible');
                check(rect.left>=0&&rect.right<=innerWidth+1&&rect.top>=0&&rect.bottom<=innerHeight+1,'Next in viewport');
                const target=root.querySelector('[onclick*="advanceDialogue"]'),hit=document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2);
                check(target===hit||target.contains(hit),'Next must be unobscured and hittable');
                check(document.querySelectorAll('#adventurePage').length===1,'one story DOM owner');
                const portraits=[];for(const image of root.querySelectorAll('.adventure-story img')){
                    await image.decode();check(image.naturalWidth>0,'story image decoded: '+image.className);portraits.push({className:image.className,src:image.getAttribute('src'),width:image.naturalWidth});
                }
                return {created:window.__storyQaCreated,view:api.getView(),portraits,nextRect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height},viewport:{width:innerWidth,height:innerHeight}};
            })()`),new Promise((_,reject)=>setTimeout(()=>reject(Error('bounded browser evaluation timeout')),45000))]);
            const shot=await client.send("Page.captureScreenshot",{format:"png"});fs.writeFileSync(path.join(artifact,`${width}x${height}.png`),Buffer.from(shot.data,"base64"));
            if(width===393){
                result.stage1=await client.eval(`(async()=>{
                    const check=(v,m)=>{if(!v)throw Error(m);};
                    const wait=async(fn,label)=>{const deadline=Date.now()+45000;while(!fn()&&Date.now()<deadline)await new Promise(r=>setTimeout(r,50));check(fn(),label);};
                    const api=FourSymbolsAdventure;let remaining=20;while(api.getView().dialogue&&remaining-->0){document.querySelector('#adventurePage [onclick*="advanceDialogue"]').click();await new Promise(r=>setTimeout(r,100));}check(remaining>0,'bounded opening dialogue');
                    await wait(()=>battleActive,'story starts existing battle');
                    check(v132ActiveDungeonRun?.mode==='adventure','existing Dungeon battle Owner');
                    check(monsters.filter(m=>m.alive).every(m=>m.tutorialEncounter===true),'independent tutorial roster');
                    const initial={hp:player.hp,sp:player.sp,enemy:monsters.filter(m=>m.alive).map(m=>({hp:m.hp,attack:m.attack,mode:m.mode}))};
                    if(!autoBattle)toggleAutoBattle();
                    await wait(()=>!battleActive,'stage1 natural victory');autoBattle=false;autoConfig.enabled=false;
                    check(api.getChapterState().completedNodes.c1_01,'stage1 completed through real combat');
                    check(api.getChapterState().currentNodeId==='c1_02','stage1 advances to stage2');
                    const reward=document.querySelector('#adventurePage [onclick*="claimNodeReward"]');
                    return {initial,final:{hp:player.hp,sp:player.sp,turn},state:api.getChapterState(),rewardButton:!!reward};
                })()`);
            }
            results.push({width,height,result});
        }catch(error){
            const diagnostic=await Promise.race([client?.eval('({startup:window.FourSymbolsStartupPolicy?.getState?.(),creation:window.FourSymbolsStartupPolicy?.canCreateCharacter?.(),body:document.body.innerText.slice(-3500)})').catch(()=>null),new Promise(r=>setTimeout(()=>r(null),2000))]);
            fs.writeFileSync(path.join(artifact,"failure.json"),JSON.stringify({error:String(error.stack),width,height,diagnostic,events:client?.events.slice(-20)},null,2));throw error;
        }finally{client?.close();proc.kill();}
    }
    fs.writeFileSync(path.join(artifact,"evidence.json"),JSON.stringify({passed:true,transport:"isolated Firebase, real production frontend",results},null,2));
    console.log("Chapter 1 creation and story presentation passed four viewports");
}finally{server.server.closeAllConnections();await new Promise(resolve=>server.server.close(resolve));}
