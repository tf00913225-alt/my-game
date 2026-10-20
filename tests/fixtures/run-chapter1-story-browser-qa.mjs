import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {spawn} from "node:child_process";
import net from "node:net";
import {execFileSync} from "node:child_process";
import {createHash} from "node:crypto";
import {startServer,waitJson,Cdp,QA_CLOUD_MODULE,findChrome} from "../../.github/scripts/runtime-browser-qa-support.mjs";

// Production index, feature loader, createCharacter, Adventure and battle stay
// real. Only Firebase transport is isolated; this is not SDK/emulator evidence.
let cloud=QA_CLOUD_MODULE.replace(/export async function readCurrentCloudSave\(\)\{.*?\}\);\}/,
    'export async function readCurrentCloudSave(){return {exists:false,uid,path:"users/"+uid+"/saves/current",data:null};}');
cloud=cloud.replace('export async function bootstrapTrustedCloudSave(){throw new Error("QA cloud writes are forbidden");}',
    'export async function bootstrapTrustedCloudSave(){return {serverRevision:0,authoritativeStateReady:false};}');
cloud=cloud.replace('export async function createInitialCanonicalCharacter(){throw new Error("QA cloud writes are forbidden");}',
    'export async function createInitialCanonicalCharacter(selection,expectedRevision){if(expectedRevision!==0)throw Error("revision");window.__storyQaCreated={selection,expectedRevision};return {sourceRevision:1,serverRevision:1,authoritativeStateReady:false};}');
assert.notEqual(cloud,QA_CLOUD_MODULE);
const chrome=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||(process.platform==='win32'?"C:/Program Files/Google/Chrome/Application/chrome.exe":findChrome());
assert.ok(fs.existsSync(chrome));
const artifact=path.resolve("artifacts/browser-qa/chapter1-story");fs.mkdirSync(artifact,{recursive:true});
const server=await startServer({cloudModule:cloud});const results=[];
console.log(JSON.stringify({pid:process.pid,url:server.url,artifact}));
try{
    for(const [width,height] of [[360,800],[393,873],[412,915],[1920,1080]]){
        const profile=fs.mkdtempSync(path.join(os.tmpdir(),"chapter1-story-qa-")),port=await new Promise((resolve,reject)=>{const s=net.createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(e=>e?reject(e):resolve(p));});});
        const proc=spawn(chrome,["--headless=new","--no-sandbox","--remote-allow-origins=*","--disable-gpu","--no-first-run","--remote-debugging-address=127.0.0.1","--remote-debugging-port="+port,"--user-data-dir="+profile,"about:blank"],{stdio:"ignore",windowsHide:true});
        let client,captureQueue=Promise.resolve();
        try{
            const pages=await waitJson(`http://127.0.0.1:${port}/json/list`);console.log('page target',pages.find(p=>p.type==="page")?.webSocketDebuggerUrl);client=new Cdp(pages.find(p=>p.type==="page").webSocketDebuggerUrl);
            client.ws.addEventListener('message',event=>{
                const message=JSON.parse(String(event.data));if(message.method!=='Runtime.consoleAPICalled')return;
                const label=message.params.args?.find(arg=>typeof arg.value==='string'&&arg.value.startsWith('STORY_QA_CAPTURE:'))?.value.slice(17);
                if(label)captureQueue=captureQueue.then(async()=>{const shot=await client.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(artifact,`${width}x${height}-${label}.png`),Buffer.from(shot.data,'base64'));});
            });
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
                window.dismissStoryQaAlerts=async()=>{for(let count=0;count<20;count++){const button=Array.from(document.querySelectorAll('.v169-rpg-dialog-layer.show .v169-rpg-dialog-actions button')).find(b=>!b.hidden&&b.textContent.includes('知道'));if(!button)break;button.click();await new Promise(r=>setTimeout(r,30));}check(!document.querySelector('.v169-rpg-dialog-layer.show'),'all ordinary QA acknowledgement dialogs closed');};window.storyQaSceneMetadata=[];window.captureStoryQa=async label=>{await dismissStoryQaAlerts();const button=document.querySelector('.adventure-story-dialogue button');if(button){const r=button.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);check(button===hit||button.contains(hit),'story scene Next topmost');}storyQaSceneMetadata.push({label,dialogue:JSON.parse(JSON.stringify(FourSymbolsAdventure.getView().dialogue)),npcSrc:document.querySelector('.adventure-story-npc')?.getAttribute('src'),speaker:document.querySelector('.adventure-story-speaker')?.textContent});await new Promise(r=>setTimeout(r,400));check(Array.from(document.querySelectorAll('.v169-rpg-dialog-layer')).every(layer=>{const style=getComputedStyle(layer);return style.display==='none'||style.visibility==='hidden'||Number(style.opacity)<=0.01;}),'dialog fade fully hidden before capture');await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));console.log('STORY_QA_CAPTURE:'+label);await new Promise(r=>setTimeout(r,100));};
                await Promise.all(Array.from(root.querySelectorAll('.adventure-story img'),image=>image.decode()));
                await window.captureStoryQa('opening-npc-active');
                for(let reopen=0;reopen<3;reopen++){api.hide();api.open();}
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
            if(width===393||width===1920){
                result.stage1=await client.eval(`(async()=>{
                    const check=(v,m)=>{if(!v)throw Error(m);};
                    const wait=async(fn,label)=>{const deadline=Date.now()+45000;while(!fn()&&Date.now()<deadline)await new Promise(r=>setTimeout(r,50));check(fn(),label);};
                    const api=FourSymbolsAdventure;let remaining=20;while(api.getView().dialogue&&remaining-->0){document.querySelector('#adventurePage [onclick*="advanceDialogue"]').click();await new Promise(r=>setTimeout(r,100));}check(remaining>0,'bounded opening dialogue');
                    await wait(()=>battleActive,'story starts existing battle');
                    check(v132ActiveDungeonRun?.mode==='adventure','existing Dungeon battle Owner');
                    check(monsters.filter(m=>m.alive).every(m=>m.tutorialEncounter===true),'independent tutorial roster');
                    const initial={hp:player.hp,sp:player.sp,enemy:monsters.filter(m=>m.alive).map(m=>({hp:m.hp,attack:m.attack,mode:m.mode}))};
                    const rounds=[];let actions=0;
                    while(battleActive&&actions<10){
                        await wait(()=>!battleActive||(battlePhase==='declare'&&!battleAdvanceScheduled&&battlePresentationLocks.size===0&&declaredCharacterIndexes.has(activeBattleCharacterIndex)),'manual action ready');if(!battleActive)break;
                        const beforeTurn=turn;rounds.push({turn,hp:player.hp,enemyHP:monsters[0].hp});
                        document.querySelector('button[aria-label="普通攻擊"]').click();document.getElementById('battleMonster0').click();actions++;
                        await wait(()=>!battleActive||turn>beforeTurn,'real AI turn completes');
                    }
                    check(!battleActive,'stage1 natural victory');
                    check(api.getChapterState().completedNodes.c1_01,'stage1 completed through real combat');
                    check(api.getChapterState().currentNodeId==='c1_02','stage1 advances to stage2');
                    const reward=document.querySelector('#adventurePage [onclick*="claimNodeReward"]');
                    const stage1={initial,rounds,actions,final:{hp:player.hp,sp:player.sp,turn},state:api.getChapterState(),rewardButton:!!reward};
                    window.chapter1QaBattleEvidence={stage1,lessons:[]};
                    return stage1;
                })()`);
                result.tutorial=await client.eval(`(async()=>{
                    const check=(v,m)=>{if(!v)throw Error(m);};
                    const wait=async(fn,label)=>{const deadline=Date.now()+45000;while(!fn()&&Date.now()<deadline)await new Promise(r=>setTimeout(r,50));check(fn(),label);};
                    const api=FourSymbolsAdventure,evidence=window.chapter1QaBattleEvidence;
                    const dismiss=window.dismissStoryQaAlerts;
                    const dialogue=async()=>{let limit=30;while(api.getView().dialogue&&limit-->0){const cursor=api.getView().dialogue;if(cursor.phase==='guidance')await captureStoryQa('guidance-'+cursor.nodeId+'-'+cursor.lineIndex);if(cursor.nodeId==='c1_02'&&cursor.phase==='before')await captureStoryQa('stage2-cast-'+cursor.lineIndex);check(api.advanceDialogue(),'dialogue commit');await new Promise(r=>setTimeout(r,40));}check(limit>0,'dialogue bounded');};
                    const fight=async(skill=false)=>{
                        await wait(()=>battleActive,'lesson battle begins');const rounds=[];let actions=0;
                        while(battleActive&&actions<25){
                            await wait(()=>!battleActive||(battlePhase==='declare'&&!battleAdvanceScheduled&&battlePresentationLocks.size===0&&declaredCharacterIndexes.has(activeBattleCharacterIndex)),'lesson action ready');if(!battleActive)break;
                            const beforeTurn=turn;rounds.push({turn,hp:player.hp,sp:player.sp,enemyHP:monsters[0].hp});
                            if(skill){toggleSkillQuickBar();const button=document.querySelector('.skill-quick-button[data-skill-id="flameSlash"]');check(button&&!button.disabled,'learned equipped skill button');button.click();}
                            else document.querySelector('button[aria-label="普通攻擊"]').click();
                            document.getElementById('battleMonster0').click();actions++;await wait(()=>!battleActive||turn>beforeTurn,'lesson real AI turn completes');
                        }
                        check(!battleActive,'bounded real battle');return {rounds,actions,hp:player.hp,sp:player.sp,state:api.getChapterState()};
                    };
                    check(api.claimNodeReward('c1_01'),'claim first growth resource');
                    check(api.startStory('c1_02'),'stage2 story');await dialogue();const before2={gold,sharedExp,hpPotion:getPotionCount('hpPotion10'),spPotion:getPotionCount('spPotion10')};const defeat2=await fight();
                    check(gold===before2.gold&&sharedExp===before2.sharedExp&&getPotionCount('hpPotion10')===before2.hpPotion&&getPotionCount('spPotion10')===before2.spPotion,'tutorial defeat2 has no death penalty or auto potion consumption');
                    check(!api.getChapterState().completedNodes.c1_02,'stage2 natural tutorial defeat');
                    check(api.advanceDialogue(),'persist one guidance line');const cursorBeforeReload=JSON.stringify(api.getView().dialogue);
                    check(loadGame()!==false,'reload through original UID Save Owner during guidance');api.open();
                    check(JSON.stringify(api.getView().dialogue)===cursorBeforeReload,'guidance cursor retained after save reload');await dialogue();
                    check(!api.continueTutorial(),'unlearned skill blocked');await dismiss();check(api.openTutorialSystem(),'open original skill system');await captureStoryQa('skill-page');
                    learnSkill('flameSlash');equipSkill('flameSlash');
                    check(characterSkillLoadouts.fire.skillLevels.flameSlash>0&&characterSkillLoadouts.fire.equippedSkills.includes('flameSlash'),'real learn and equip');
                    api.returnFromTutorial();check(api.continueTutorial(),'return same stage2 retry');const retry2=await fight(true);check(api.getChapterState().completedNodes.c1_02,'stage2 passed');
                    check(api.startStory('c1_03'),'stage3 story');await dialogue();const stage3=await fight(true);check(api.getChapterState().completedNodes.c1_03,'stage3 actual skill used');
                    check(api.startStory('c1_04'),'stage4 story');await dialogue();const before4={gold,sharedExp,hpPotion:getPotionCount('hpPotion10'),spPotion:getPotionCount('spPotion10')};const defeat4=await fight();check(!api.getChapterState().completedNodes.c1_04,'stage4 natural tutorial defeat');
                    check(gold===before4.gold&&sharedExp===before4.sharedExp&&getPotionCount('hpPotion10')===before4.hpPotion&&getPotionCount('spPotion10')===before4.spPotion,'tutorial defeat4 has no death penalty or auto potion consumption');await dialogue();
                    const claim=document.querySelector('#adventurePage [onclick*="claimNodeReward"]');check(claim,'visible tutorial equipment reward action');claim.click();
                    const uid=api.getChapterState().grantedEquipmentUid;check(uid,'starter grant receipt');check(!api.continueTutorial(),'unequipped armor blocks retry');await dismiss();
                    api.openTutorialSystem();await captureStoryQa('equipment-page');rebuildInventorySlots();const slot=inventorySlots.findIndex(item=>item?.v141Uid===uid);check(slot>=0,'grant exists in original inventory');
                    openItemModal(slot);check(equipSelectedItem(),'original equipment transfer');api.returnFromTutorial();check(api.continueTutorial(),'equipped exact grant allows retry');
                    const retry4=await fight(true);check(api.getChapterState().completedNodes.c1_04,'stage4 passed');
                    check(api.startStory('c1_05'),'stage5 story');await dialogue();check(!api.continueTutorial(),'preparation required');await dismiss();
                    api.openTutorialSystem();rebuildInventorySlots();const potionSlot=inventorySlots.findIndex(item=>item?.id==='spPotion10');
                    check(potionSlot>=0,'starter SP potion available');const beforeSP=player.sp,beforePotion=getPotionCount('spPotion10');
                    check(v17342UseInventoryPotion(potionSlot),'use original inventory SP potion');check(player.sp>beforeSP&&getPotionCount('spPotion10')===beforePotion-1,'real capped recovery and consumption');
                    api.returnFromTutorial();check(api.confirmPreparation(),'confirm actual HP SP preparation');check(api.continueTutorial(),'stage5 starts');const stage5=await fight(true);
                    check(api.getChapterState().completedNodes.c1_05&&!api.getChapterState().onboarding.active,'onboarding completes after natural win');
                    evidence.lessons={defeat2,retry2,stage3,defeat4,retry4,stage5};return evidence.lessons;
                })()`);
                result.formalChapter=await client.eval(`(async()=>{
                    const check=(v,m)=>{if(!v)throw Error(m);};
                    const wait=async(fn,label)=>{const deadline=Date.now()+45000;while(!fn()&&Date.now()<deadline)await new Promise(r=>setTimeout(r,50));check(fn(),label);};
                    const api=FourSymbolsAdventure,stages=[];
                    const dismiss=window.dismissStoryQaAlerts;
                    const recover=async()=>{
                        for(const [id,resource,max] of [['hpPotion10','hp',getPartyBattleStats(0).maxHP],['spPotion10','sp',getPartyBattleStats(0).maxSP]]){
                            let limit=10;while(player[resource]<max*.75&&getPotionCount(id)>0&&limit-->0){rebuildInventorySlots();const slot=inventorySlots.findIndex(item=>item?.id===id);check(slot>=0&&v17342UseInventoryPotion(slot),'formal preparation consumes existing potion');await dismiss();}
                        }
                    };
                    for(let stage=6;stage<=20;stage++){
                        const id='c1_'+String(stage).padStart(2,'0');check(api.getChapterState().currentNodeId===id,'linear current '+id);
                        await recover();if(stage===6)await captureStoryQa('map-after-tutorial');check(api.startStory(id),'start formal story '+id);if(stage===11||stage===19)await captureStoryQa('scene-'+id);let lines=30;
                        while(api.getView().dialogue&&lines-->0){check(api.advanceDialogue(),'formal dialogue '+id);await new Promise(r=>setTimeout(r,40));}check(lines>0,'formal dialogue bounded');
                        const node=FourSymbolsAdventureContent.chapters.chapter_v1.nodes.find(n=>n.id===id),rounds=[];
                        if(node.type==='rest')check(api.restAtNode(id),'formal rest');
                        if(node.type==='chest')check(api.openChest(id),'formal chest');
                        if(['battle','elite','boss'].includes(node.type)){
                            await wait(()=>battleActive,'formal battle starts');let actions=0;
                            while(battleActive&&actions<40){
                                await wait(()=>!battleActive||(battlePhase==='declare'&&!battleAdvanceScheduled&&battlePresentationLocks.size===0&&declaredCharacterIndexes.has(activeBattleCharacterIndex)),'formal action ready');if(!battleActive)break;
                                const before=turn;rounds.push({turn,hp:player.hp,sp:player.sp,enemies:monsters.filter(m=>m.alive).map(m=>m.hp)});
                                toggleSkillQuickBar();const skill=document.querySelector('.skill-quick-button[data-skill-id="flameSlash"]');
                                if(skill&&!skill.disabled)skill.click();else document.querySelector('button[aria-label="普通攻擊"]').click();
                                const target=currentBattleMonsters.find(i=>monsters[i]?.alive);document.getElementById('battleMonster'+target).click();actions++;
                                await wait(()=>!battleActive||turn>before,'formal natural AI round');
                            }
                            check(!battleActive,'bounded formal combat');
                        }
                        check(api.getChapterState().completedNodes[id],'formal node completes '+id);
                        if(api.getChapterState().rewardClaims[id]==='ready')check(api.claimNodeReward(id),'formal node reward');
                        if(stage===11){const key=JSON.stringify(api.getChapterState().storyKeys);check(api.getChapterState().storyKeys.blackPineToken.sourceNodeId===id,'one story key');api.startStory(id);while(api.getView().dialogue)check(api.advanceDialogue(),'reopen key dialogue');check(JSON.stringify(api.getChapterState().storyKeys)===key,'story key repeat adds nothing');}
                        stages.push({id,type:node.type,rounds,hp:player.hp,sp:player.sp});
                        if(stage===20){let ending=30;while(api.getView().dialogue&&ending-->0){const cursor=api.getView().dialogue;await captureStoryQa(cursor.lineIndex===2?'ending-guard':'ending-line-'+cursor.lineIndex);check(api.advanceDialogue(),'ending dialogue');}check(ending>0,'ending bounded');}
                    }
                    check(api.getChapterState().chapterCompleted,'twenty-node chapter completed');
                    check(Object.keys(api.getChapterState().completedNodes).filter(id=>/^c1_/.test(id)).length===20,'20 of 20 completed');
                    const uid=FourSymbolsAccountSave.getActiveUid(),saved=FourSymbolsAccountSave.readForUid(uid);check(saved.status==='ready'&&saved.save.player.adventureProgress.chapters.chapter_v1.chapterCompleted,'original Save Owner persisted ending');
                    return {stages,state:api.getChapterState()};
                })()`);
            }
            await captureQueue;result.sceneMetadata=await client.eval("window.storyQaSceneMetadata");
            if(width===393||width===1920){const scene=label=>result.sceneMetadata.find(row=>row.label===label);assert.equal(scene("stage2-cast-0").npcSrc,scene("stage2-cast-1").npcSrc,"stage2 cast persists during player reply");assert.equal(scene("ending-guard").dialogue.lineIndex,2);assert.equal(scene("ending-guard").speaker,"守驛人");assert.equal(scene("ending-line-3").dialogue.lineIndex,3);assert.equal(scene("ending-guard").npcSrc,scene("ending-line-3").npcSrc,"guard persists during final player reply");}
            results.push({width,height,result});
        }catch(error){
            const diagnostic=await Promise.race([client?.eval('({startup:window.FourSymbolsStartupPolicy?.getState?.(),creation:window.FourSymbolsStartupPolicy?.canCreateCharacter?.(),body:document.body.innerText.slice(-3500)})').catch(()=>null),new Promise(r=>setTimeout(()=>r(null),2000))]);
            fs.writeFileSync(path.join(artifact,"failure.json"),JSON.stringify({error:String(error.stack),width,height,diagnostic,events:client?.events.slice(-20)},null,2));throw error;
        }finally{client?.close();proc.kill();}
    }
    fs.writeFileSync(path.join(artifact,"evidence.json"),JSON.stringify({passed:true,head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),workingTreeDirty:!!execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),buildManifestSha256:createHash('sha256').update(fs.readFileSync('build/asset-manifest.json')).digest('hex'),transport:"isolated Firebase, real production frontend",results},null,2));
    if(fs.existsSync(path.join(artifact,'failure.json')))fs.unlinkSync(path.join(artifact,'failure.json'));
    console.log("Chapter 1 creation and story presentation passed four viewports");
}finally{server.server.closeAllConnections();await new Promise(resolve=>server.server.close(resolve));}
