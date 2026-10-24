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
function stableScrollSample(previous,sample,now){
    if(!sample||!['scrollTop','scrollLeft','left','top','width','height'].every(key=>Number.isFinite(sample[key])))return {sample,since:now,count:0,settled:false,ready:false};
    const same=previous?.count>0&&['scrollTop','scrollLeft','left','top','width','height'].every(key=>Math.abs(sample[key]-previous.sample[key])<.5);
    const since=same?previous.since:now,count=same?previous.count+1:1;
    const settled=count>=4&&now-since>=240;return {sample,since,count,settled,ready:settled&&sample.valid===true};
}
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
    const requested=process.argv.find(arg=>arg.startsWith('--port='));
    if(requested){
        const port=Number(requested.slice('--port='.length));assert.ok(Number.isInteger(port)&&port>0&&port<=65535,'valid explicit serve-only port');
        await new Promise(resolve=>server.server.close(resolve));
        await new Promise((resolve,reject)=>{server.server.once('error',reject);server.server.listen(port,'127.0.0.1',()=>{server.server.removeListener('error',reject);resolve();});});
        server.url='http://127.0.0.1:'+port+'/index.html';
    }
    console.log(JSON.stringify({mode:'serve-only',url:server.url,pid:process.pid,transport:'fresh external auth/cloud transport only; no character or progress injection'}));
    await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});
    server.server.closeAllConnections();await new Promise(resolve=>server.server.close(resolve));
}else{
try{
    for(const [width,height] of (process.argv.includes('--first-lesson-only')?[[393,873]]:[[360,800],[393,873],[412,915],[1920,1080]])){
        const mobile=width<700,trace=[],scenes=[],portraitChecks=[],rounds=[],purchases=[],attempts=[];
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
            const point=async target=>{
                assert.equal(target.error,null,target.selector+': '+target.error);trace.push({...target,input:mobile?'touch':'mouse'});
                if(mobile){await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:target.x,y:target.y}]});await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
                else{await client.send('Input.dispatchMouseEvent',{type:'mousePressed',x:target.x,y:target.y,button:'left',clickCount:1});await client.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:target.x,y:target.y,button:'left',clickCount:1});}
                await new Promise(r=>setTimeout(r,180));
            };
            const tap=async selector=>{
                const target=await client.eval(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)return {error:'missing target'};const r=e.getBoundingClientRect(),s=getComputedStyle(e),x=r.x+r.width/2,y=r.y+r.height/2,hit=document.elementFromPoint(x,y);return {x,y,text:e.textContent,error:e.disabled?'disabled':r.width<=0||r.height<=0||s.visibility==='hidden'||s.display==='none'?'hidden':x<0||y<0||x>=innerWidth||y>=innerHeight?'outside viewport':!(hit===e||e.contains(hit))?'occluded':null};})()`);
                await point({selector,...target});
            };
            const capture=async label=>{await new Promise(r=>setTimeout(r,350));const shot=await client.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(artifact,width+'x'+height+'-'+label+'.png'),Buffer.from(shot.data,'base64'));};
            const observe=()=>client.eval(`({view:FourSymbolsAdventure.getView(),hp:player.hp,sp:player.sp,gold,sharedExp,battle:typeof battleActive!=='undefined'&&battleActive,turn:typeof turn==='undefined'?null:turn,phase:typeof battlePhase==='undefined'?null:battlePhase,pending:typeof pendingAction==='undefined'?null:pendingAction,maxHP:getPartyBattleStats(0).maxHP,maxSP:getPartyBattleStats(0).maxSP,potions:Object.fromEntries(potionDefinitions.map(p=>[p.id,getPotionCount(p.id)])),inventory:inventoryItems.map(i=>({uid:i.v141Uid,name:i.name,definitionId:i.definitionId})),equipped:Object.values(characterEquipment[player.element]||{}).map(i=>i?.v141Uid),enemies:typeof currentBattleMonsters==='undefined'?[]:currentBattleMonsters.map(i=>({id:i,hp:monsters[i]?.hp,alive:monsters[i]?.alive}))})`);
            const guidePoint=()=>client.eval(`(()=>{const overlay=document.getElementById('adventureInputGuide'),ring=overlay?.querySelector('.adventure-guide-ring');if(!overlay||overlay.hidden||!ring)return null;const next=overlay.querySelector('.adventure-guide-next:not([hidden]):not(:disabled)');if(ring.hidden&&!next)return null;const r=(next||ring).getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2,hit=document.elementFromPoint(x,y),target=hit?.closest('button,[role="tab"],[data-item-id],[data-item-uid]')||hit;return {x,y,selector:'visible-guide-highlight',text:target?.textContent||'',id:target?.id,handler:target?.getAttribute('onclick'),copy:overlay.querySelector('.adventure-guide-copy')?.textContent,error:!target||target===overlay||target.id==='game-viewport'||(overlay.contains(target)&&!next)?'highlight not over player target':target.disabled?'disabled':null};})()`);
            const tapGuide=async()=>{
                const free=await observe();
                if(free.view.firstLesson?.step==='finish-battle'||(free.view.state.onboarding.flowVersion===3&&free.view.state.onboarding.basicComplete&&['c1_02','c1_03'].includes(free.view.state.currentNodeId))){
                    await captureStory();
                    if(free.view.dialogue){await tap('#adventurePage [onclick*="advanceDialogue"]');return true;}
                    if(free.battle){
                        await wait('!battleActive||(battlePhase==="declare"&&!battleAdvanceScheduled&&battlePresentationLocks.size===0&&declaredCharacterIndexes.has(activeBattleCharacterIndex))','normal unlocked stage two/three input');
                        const current=await observe();if(!current.battle)return true;
                        if(current.pending){await tap('#battleMonsterArea [id^="battleMonster"]');}
                        else{await tap('#mainBattleMenu button[onclick*="normal"]');}
                        return true;
                    }
                    if(free.view.panel==='node-reward'){await tap('#adventurePage [onclick*="claimNodeReward"]');return true;}
                    await tap('.adventure-sheet-actions > .adventure-button.primary');return true;
                }
                await wait(`(()=>{if(!FourSymbolsAdventure.getView().tutorial.active||FourSymbolsAdventure.getView().firstLesson?.step==='finish-battle'||FourSymbolsAdventure.getView().state.onboarding.basicComplete&&['c1_02','c1_03'].includes(FourSymbolsAdventure.getView().state.currentNodeId))return true;if(battleActive&&!(battlePhase==='declare'&&!battleAdvanceScheduled&&battlePresentationLocks.size===0&&declaredCharacterIndexes.has(activeBattleCharacterIndex)))return false;const g=document.getElementById('adventureInputGuide'),r=g?.querySelector('.adventure-guide-ring');if(!g||g.hidden||!r)return false;const n=g.querySelector('.adventure-guide-next:not([hidden]):not(:disabled)'),box=(n||r).getBoundingClientRect();if(r.hidden&&!n)return false;const hit=document.elementFromPoint(box.x+box.width/2,box.y+box.height/2);return !!hit?.closest('button,[role="tab"],[data-item-id],[data-item-uid],[id^="battleMonster"],.ally-targetable');})()`,'formal manual turn and visible guide target, or completed onboarding');
                const ready=await observe();if(!ready.view.tutorial.active||ready.view.firstLesson?.step==='finish-battle'||ready.view.state.onboarding.basicComplete&&['c1_02','c1_03'].includes(ready.view.state.currentNodeId))return false;
                await captureStory();
                if(ready.view.panel==='node-reward'&&ready.view.selectedNodeId==='c1_01'){assert.equal(ready.view.state.currentNodeId,'c1_02');assert.equal(ready.view.state.rewardClaims.c1_01,'ready');await capture('first-victory');}
                const target=await guidePoint();
                if(['技能已裝好，返回故事再挑戰。','技能已裝好，接回剛才的戰鬥。'].some(text=>target?.copy?.startsWith(text)))assert.equal(target.id,'adventureTutorialReturn','visible guide center must hit the original tutorial return button');
                if(target.handler==="v169SwitchShopPage('equipment')")assert.equal(await client.eval('!!document.querySelector("#homeFeatureModal .v17345-equipment-shop")'),false,'fresh shop starts with the real potion category');
                const offer=target.id==='chapter1TutorialArmorBuy'?await client.eval(String.raw`(()=>{const b=document.getElementById('chapter1TutorialArmorBuy'),price=b.textContent.match(/([\d,]+)\s*金幣/);if(!price)throw Error('formal armor offer price missing');return {name:b.closest('[data-tutorial-offer]').querySelector('.v17346-shop-name').textContent.trim(),cost:Number(price[1].replaceAll(',',''))};})()`):null;
                await point(target);
                if(offer){const bought=await observe(),receipt=bought.view.state.equipmentLessonPurchase,item=bought.inventory.find(i=>i.uid===receipt?.equipmentUid);assert.ok(receipt&&item,'fresh tutorial must make a real shop purchase');assert.equal(bought.gold,ready.gold-offer.cost);assert.equal(receipt.paidGold,offer.cost);assert.equal(item.name,offer.name);assert.equal(bought.view.state.grantedEquipmentUid,item.uid);purchases.push({kind:'lesson-armor',name:item.name,uid:item.uid,price:offer.cost,beforeGold:ready.gold,afterGold:bought.gold});}
                if(target.id==='itemEquipButton'){const worn=await observe();assert.ok(worn.view.state.equipmentLessonPurchase,'fresh character cannot pass with a legacy gift');assert.ok(worn.equipped.includes(worn.view.state.equipmentLessonPurchase.equipmentUid),'the exact paid armor is worn');}
                if(ready.battle&&ready.pending)await wait(`!battleActive||pendingAction!==${JSON.stringify(ready.pending)}||battlePhase!=='declare'||turn>${ready.turn}`,'real pending target action commits');
                return true;
            };
            const recorded=new Set();
            const captureStory=async()=>{
                const view=await client.eval('FourSymbolsAdventure.getView()'),cursor=view.dialogue;if(!cursor)return;
                await wait(`(()=>{const image=document.querySelector('#adventurePage .adventure-story-npc[src]'),next=document.querySelector('#adventurePage [onclick*="advanceDialogue"]');return !!image&&!!image.getAttribute('src')&&image.complete&&image.naturalWidth>0&&!!next&&!next.disabled;})()`,'real NPC decoded and story Next enabled');
                const portrait=await client.eval(`(async()=>{const v=FourSymbolsAdventure.getView(),cursor=v.dialogue,node=v.chapter.nodes.find(n=>n.id===cursor.nodeId),lines=cursor.phase==='ending'?v.chapter.ending:cursor.phase==='guidance'?node.guidance:node.dialogue,line=lines[cursor.lineIndex],key=FourSymbolsAdventureContent.storyPresentation.npcs[line.npcAssetId||node.npc],expected=v154ResolveMonsterPortraitRecord({portraitKey:key})?.path,image=document.querySelector('#adventurePage .adventure-story-npc[src]');await image.decode();return {nodeId:cursor.nodeId,phase:cursor.phase,lineIndex:cursor.lineIndex,speaker:line.speaker,key,expected,actual:image.getAttribute('src'),width:image.naturalWidth};})()`);
                assert.ok(portrait.expected&&portrait.width>0,'formal NPC portrait exists for every speaking/player line');assert.equal(portrait.actual,portrait.expected,'story cast follows the existing registry');
                portraitChecks.push(portrait);
                let label;
                if(cursor.nodeId==='c1_01'&&cursor.lineIndex===0)label='opening-npc-active';
                if(cursor.nodeId==='c1_02'&&cursor.phase==='before')label='stage2-cast-'+cursor.lineIndex;
                if(cursor.phase==='guidance')label='guidance-'+cursor.nodeId+'-'+cursor.lineIndex;
                if(['c1_11','c1_19'].includes(cursor.nodeId)&&cursor.lineIndex===0)label='scene-'+cursor.nodeId;
                if(cursor.phase==='ending')label=cursor.lineIndex===2?'ending-guard':'ending-line-'+cursor.lineIndex;
                if(label&&!recorded.has(label)){recorded.add(label);scenes.push({label,...await client.eval('({dialogue:JSON.parse(JSON.stringify(FourSymbolsAdventure.getView().dialogue)),npcSrc:document.querySelector(".adventure-story-npc")?.getAttribute("src"),speaker:document.querySelector(".adventure-story-speaker")?.textContent})')});await capture(label);}
            };
            const dismiss=async()=>{
                for(let i=0;i<12;i++){
                    const selector='.v169-rpg-dialog-layer.show .v169-rpg-dialog-actions button:not([hidden])';
                    if(!await client.eval(`!!document.querySelector(${JSON.stringify(selector)})`))break;
                    assert.equal(await client.eval(`window.v169GetRpgDialogState().active`),'alert','only original alert acknowledgements may be dismissed');
                    await wait(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e||!e.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}))return false;const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return r.width>0&&r.height>0&&(hit===e||e.contains(hit));})()`,'original alert acknowledgement paints and owns its pointer center');
                    const text=await client.eval(`document.querySelector(${JSON.stringify(selector)}).textContent`);
                    assert.match(text,/知道|收下|確定|好的/,'only a visible ordinary acknowledgement is dismissed');await tap(selector);
                }
                await wait(`Array.from(document.querySelectorAll('.v169-rpg-dialog-layer')).every(e=>getComputedStyle(e).display==='none'||Number(getComputedStyle(e).opacity)<=.01)`,'ordinary dialogue fade completes');
            };
            const reveal=async selector=>{
                for(let i=0;i<16;i++){
                    const r=await client.eval(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)return null;const r=e.getBoundingClientRect(),p=e.closest('[data-scroll-owner="y"],.home-feature-modal-body,.skill-scroll,.shop-potion-list')?.getBoundingClientRect();return {top:r.top,bottom:r.bottom,y:r.y+r.height/2,x:r.x+r.width/2,p:p?{left:p.left,right:p.right,top:p.top,bottom:p.bottom}:null};})()`);
                    assert.ok(r,'visible UI target exists: '+selector);const area=r.p||{left:width*.2,right:width*.8,top:height*.2,bottom:height*.8},top=Math.max(30,area.top+8),bottom=Math.min(height-30,area.bottom-8);if(r.y>top&&r.y<bottom){
                        const deadline=Date.now()+45000;let stable;
                        while(Date.now()<deadline){
                            const sample=await client.eval(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)return {valid:false};const r=e.getBoundingClientRect(),owner=e.closest('[data-scroll-owner="y"],.home-feature-modal-body,.skill-scroll,.shop-potion-list'),p=owner?.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2,hit=document.elementFromPoint(x,y);return {valid:!e.disabled&&e.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})&&r.width>0&&r.height>0&&x>=0&&x<innerWidth&&y>=0&&y<innerHeight&&(!p||x>p.left&&x<p.right&&y>p.top+8&&y<p.bottom-8)&&(hit===e||e.contains(hit)),scrollTop:owner?.scrollTop||0,scrollLeft:owner?.scrollLeft||0,left:r.left,top:r.top,width:r.width,height:r.height,owner:p?.toJSON(),hit:{id:hit?.id,tag:hit?.tagName},disabled:e.disabled};})()`);
                            stable=stableScrollSample(stable,sample,Date.now());if(stable.ready){trace.push({selector,observation:'original scroll owner and target stable',sample});return;}if(stable.settled){trace.push({selector,observation:'scroll settled outside valid pointer target; adjust through original scrolling',sample});break;}await new Promise(resolve=>setTimeout(resolve,80));
                        }
                        if(stable?.settled)continue;
                        throw Error('original scroll target never became stable and pointer ready: '+selector+' '+JSON.stringify(stable));
                    }
                    const x=Math.max(20,Math.min(width-20,(area.left+area.right)/2)),y=Math.max(80,Math.min(height-80,(area.top+area.bottom)/2)),direction=r.y<top?-1:1;
                    if(mobile){await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y:y+direction*60}]});for(let n=1;n<=5;n++){await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y+direction*(60-n*24)}]});await new Promise(resolve=>setTimeout(resolve,40));}await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
                    else await client.send('Input.dispatchMouseEvent',{type:'mouseWheel',x,y,deltaX:0,deltaY:direction*220});
                    await new Promise(r=>setTimeout(r,200));
                }
                throw Error('normal scrolling cannot reach '+selector);
            };
            await wait('window.FourSymbolsStartupPolicy?.canCreateCharacter?.()','fresh creation ready');
            await wait(`(()=>{const input=document.getElementById('creationId');if(!input)return false;const r=input.getBoundingClientRect(),style=getComputedStyle(input),x=r.x+r.width/2,y=r.y+r.height/2,hit=document.elementFromPoint(x,y);return !input.disabled&&r.width>0&&r.height>0&&style.visibility!=='hidden'&&style.display!=='none'&&x>=0&&y>=0&&x<innerWidth&&y<innerHeight&&(hit===input||input.contains(hit));})()`,'original creation input receives pointer after startup presentation');
            await tap('#creationId');await client.send('Input.insertText',{text:'點選驗收'});
            await tap('#creationPrimaryNextButton');
            for(let i=0;i<10;i++)await tap('[onclick="creationAdd(\'attack\',1)"]');
            await tap('#creationSubmitButton');
            await wait('!!document.querySelector(".adventure-story-dialogue")','opening dialogue visible');await captureStory();
            assert.equal(await client.eval('document.querySelectorAll("#adventurePage").length'),1,'one story DOM owner');
            const portraits=await client.eval(`(async()=>{const rows=[];for(const image of document.querySelectorAll('#adventurePage .adventure-story img')){await image.decode();if(!image.naturalWidth)throw Error('portrait decode');rows.push({className:image.className,src:image.getAttribute('src'),width:image.naturalWidth});}return rows;})()`);
            assert.equal(portraits.length,3,'opening includes background, player AND the real NPC portrait');assert.ok(portraits.some(image=>image.className.includes('adventure-story-npc')));
            const nextRect=await client.eval(`(()=>{const r=document.querySelector('#adventurePage [onclick*="advanceDialogue"]').getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};})()`);
            assert.ok(nextRect.width>0&&nextRect.height>0&&nextRect.left>=0&&nextRect.top>=0&&nextRect.right<=width+1&&nextRect.bottom<=height+1,'entire opening Next remains inside viewport');
            const line=await client.eval('FourSymbolsAdventure.getView().dialogue.lineIndex');await tapGuide();
            assert.equal(await client.eval('FourSymbolsAdventure.getView().dialogue.lineIndex'),line+1,'one trusted tap advances one line');
            if(width===360||width===412){results.push({width,height,trace,portraits,portraitChecks,scenes,nextRect});continue;}
            let firstClaimed=false,lessonDefeats={},lessonInitial=null;
            for(let step=0;step<240;step++){
                const before=await observe();if(process.argv.includes('--first-lesson-only')&&before.view.state.onboarding.basicComplete)break;if(!before.view.tutorial.active)break;
                await captureStory();
                if(before.view.firstLesson?.step==='status-intro'){
                    assert.equal(before.view.firstLesson.level,2);assert.equal(before.sharedExp,0);
                    assert.equal(before.view.firstLesson.attributePoints,5,'personal upgrade retains all optional attribute points');
                }
                if(before.view.firstLesson?.step==='cast-intro'){
                    assert.equal(before.turn,before.view.state.onboarding.battleCheckpoint.turn,'same retained round resumes');
                    assert.equal(await client.eval('document.getElementById("battleTurnIndicator").textContent'),'第'+before.turn+'回合','visible round agrees with the retained battle');
                    await capture('first-battle-resumed');
                }
                if(before.battle){rounds.push(before);if(!lessonInitial)lessonInitial=before;}
                if(before.view.panel==='node-reward'&&before.view.selectedNodeId==='c1_01'){
                    assert.equal(before.view.state.currentNodeId,'c1_02');await capture('first-victory');
                }
                if(before.view.dialogue?.phase==='guidance')lessonDefeats[before.view.dialogue.nodeId]=true;
                await tapGuide();
                const after=await observe();
                if(lessonInitial&&!after.battle&&!after.view.firstLesson){
                    const id=lessonInitial.view.tutorial.battleNodeId;
                    if(!after.view.state.completedNodes[id]){
                        assert.ok(['c1_02','c1_04'].includes(id),'only the authored defeat lessons may fail');
                        assert.equal(after.gold,lessonInitial.gold);assert.equal(after.sharedExp,lessonInitial.sharedExp);
                        assert.equal(after.potions.hpPotion10,lessonInitial.potions.hpPotion10);assert.equal(after.potions.spPotion10,lessonInitial.potions.spPotion10);
                        attempts.push({lesson:true,id,initial:lessonInitial,terminal:after});
                    }
                    lessonInitial=null;
                }
                if(!firstClaimed&&after.view.state.rewardClaims.c1_01==='claimed'){
                    firstClaimed=true;assert.ok(['city-intro','city'].includes(after.view.firstLesson?.step),'early receipt remains before character upgrade');assert.equal(after.sharedExp,300);assert.equal(after.view.state.completedNodes.c1_01,undefined);await capture('first-exp-before-upgrade');
                }
            }
            let current=await observe();if(process.argv.includes('--first-lesson-only')){assert.equal(current.view.state.onboarding.basicComplete,true);assert.equal(current.view.state.currentNodeId,'c1_02');assert.equal(current.view.state.rewardClaims.c1_01,'claimed');assert.equal(current.view.state.onboarding.battleCheckpoint,undefined);await capture('first-lesson-complete');results.push({width,height,trace,portraits,portraitChecks,scenes,nextRect,firstLesson:current});continue;}assert.equal(current.view.tutorial.active,false,'bounded five-lesson player guide');
            assert.ok(firstClaimed);assert.equal(lessonDefeats.c1_02,undefined,'stage two retains its fight without redundant forced basics');assert.ok(current.view.state.completedNodes.c1_02&&current.view.state.completedNodes.c1_03,'both retained stages really completed');assert.ok(lessonDefeats.c1_04,'equipment defeat lesson actually occurred');
            assert.equal(purchases.filter(p=>p.kind==='lesson-armor').length,1);assert.equal(current.view.state.rewardClaims.c1_05,'claimed','supplies were really claimed before practice, not granted after victory');
            assert.ok(trace.some(action=>action.handler==="v169SwitchShopPage('equipment')"),'the player really selected the equipment shop category');
            assert.ok(current.potions.hpPotion10<current.view.state.onboarding.preparation.hpCount||current.potions.spPotion10<current.view.state.onboarding.preparation.spCount,'stage5 requires an original inventory or battle potion consumed after its claimed baseline');
            for(let n=1;n<=5;n++)assert.ok(current.view.state.completedNodes['c1_'+String(n).padStart(2,'0')]);
            if(current.view.panel==='node-reward')await tap('#adventurePage [onclick*="claimNodeReward"]');
            await dismiss();await capture('map-after-tutorial');

            const prepare=async()=>{
                const before=await observe();if(before.hp>=before.maxHP&&before.sp>=before.maxSP)return;
                await tap('.adventure-back-button');await dismiss();
                await tap('#inventoryNav');await tap('#inventoryCategoryTabs [data-filter="item"]');
                for(const resource of ['hp','sp']){
                    for(let used=0;used<24;used++){
                        const status=await observe(),max=resource==='hp'?status.maxHP:status.maxSP;if(status[resource]>=max)break;
                        let item=await client.eval(`Array.from(document.querySelectorAll('#inventoryGrid [data-item-id]')).map(e=>e.dataset.itemId).find(id=>id.startsWith(${JSON.stringify(resource+'Potion')}))||null`);
                        if(!item){
                            await tap('#mapInventoryOverlayClose');await tap('[aria-label="商店"]');await tap('#homeFeatureModal [onclick="v169SwitchShopPage(\'potion\')"]');
                            const id=resource+'Potion30',button='button[onclick*="buyShopItem(\''+id+'\'"]';await reveal(button);
                            const transaction=await observe(),price=await client.eval(`Number(document.getElementById(${JSON.stringify('shopQuantity-'+id)}).dataset.unitPrice)`);
                            await tap(button);await wait(`document.querySelector('.v169-rpg-dialog-layer.show .v169-rpg-dialog-actions button:last-child')?.textContent==='確定購買'`,'normal shop confirmation');await tap('.v169-rpg-dialog-layer.show .v169-rpg-dialog-actions button:last-child');await dismiss();
                            const receipt=await observe();assert.equal(receipt.gold,transaction.gold-price);assert.equal(receipt.potions[id],transaction.potions[id]+1);purchases.push({id,price,beforeGold:transaction.gold,afterGold:receipt.gold});
                            await tap('[onclick="closeHomeFeature()"]');await tap('#inventoryNav');await tap('#inventoryCategoryTabs [data-filter="item"]');item=id;
                        }
                        const beforeUse=await observe(),selector='#inventoryGrid [data-item-id="'+item+'"]';await reveal(selector);await tap(selector);await tap('#v17342InventoryPotionUse');await dismiss();
                        const afterUse=await observe();assert.equal(afterUse.potions[item],beforeUse.potions[item]-1);assert.ok(afterUse[resource]>beforeUse[resource]);assert.ok(afterUse[resource]<=max);
                    }
                    const full=await observe();assert.ok(full[resource]>=(resource==='hp'?full.maxHP:full.maxSP),'normal UI preparation restores '+resource);
                }
                await tap('#mapInventoryOverlayClose');await tap('#adventureHomeEntry');
            };
            const chooseStage=async id=>{
                await tap('#adventureStagePicker summary');const selector='[data-stage-id="'+id+'"]';await reveal(selector);
                const browsing=()=>client.eval(`(()=>{const picker=document.getElementById('adventureStagePicker');return {open:picker.open,scrollTop:picker.querySelector('.adventure-stage-list').scrollTop};})()`);
                const before=await browsing();assert.equal(before.open,true);
                // Model the external sync notification, never a gameplay action.
                await client.eval(`document.dispatchEvent(new CustomEvent('four-symbols:hero-acquisition-state'));true`);
                const after=await browsing();assert.deepEqual(after,before,'background Hero refresh retains native map browsing');
                trace.push({kind:'background-hero-notification',stage:id,browsingBefore:before,browsingAfter:after});
                await reveal(selector);await tap(selector);assert.equal((await observe()).view.selectedNodeId,id);
            };
            const enterCurrent=async stage=>{
                const action=await client.eval('document.querySelector(".adventure-sheet-actions > .adventure-button.primary")?.getAttribute("aria-label")||""');
                if(!action.includes('進入第 '+stage+' 關'))await chooseStage('c1_'+String(stage).padStart(2,'0'));
                await tap('.adventure-sheet-actions > .adventure-button.primary');
            };
            const fight=async()=>{
                const initial=await observe(),battleRounds=[];
                for(let action=0;action<40;action++){
                    await wait('!battleActive||(battlePhase==="declare"&&!battleAdvanceScheduled&&battlePresentationLocks.size===0&&declaredCharacterIndexes.has(activeBattleCharacterIndex))','formal manual action');
                    const before=await observe();if(!before.battle)break;battleRounds.push(before);
                    await tap('#mainBattleMenu button[onclick*="toggleSkillQuickBar"]');
                    if(await client.eval('!!document.querySelector("#skillQuickBar.show .skill-quick-button:not(:disabled)")'))await tap('#skillQuickBar.show .skill-quick-button:not(:disabled)');
                    else await tap('button[aria-label="普通攻擊"]');
                    await tap('#battleMonsterArea .battle-monster.targetable');
                    await wait('!battleActive||turn>'+before.turn,'formal natural AI round');
                }
                const terminal=await observe();assert.equal(terminal.battle,false,'bounded natural combat');attempts.push({initial,rounds:battleRounds,terminal});return {initial,terminal};
            };
            for(let stage=6;stage<=20;stage++){
                const id='c1_'+String(stage).padStart(2,'0');assert.equal((await observe()).view.state.currentNodeId,id);
                for(let retry=0;retry<3;retry++){
                    await prepare();await enterCurrent(stage);
                    for(let line=0;line<30&&(await observe()).view.dialogue;line++){await captureStory();await tap('#adventurePage [onclick*="advanceDialogue"]');}
                    current=await observe();
                    if(current.battle){const battle=await fight();current=battle.terminal;if(!current.view.state.completedNodes[id]){assert.ok(current.hp<=0,'only a real defeat permits retry');assert.equal(current.gold,battle.initial.gold);assert.equal(current.sharedExp,battle.initial.sharedExp);assert.equal(current.view.state.rewardClaims[id],battle.initial.view.state.rewardClaims[id]);continue;}}
                    if(current.view.panel==='rest')await tap('#adventurePage [onclick*="restAtNode"]');
                    if(current.view.panel==='chest'&&!current.view.state.completedNodes[id])await tap('#adventurePage [onclick*="openChest"]');
                    current=await observe();assert.ok(current.view.state.completedNodes[id],'formal player completes '+id);
                    if(current.view.panel==='node-reward'||current.view.panel==='chest'&&current.view.state.rewardClaims[id]==='ready')await tap('#adventurePage [onclick*="claimNodeReward"]');
                    current=await observe();
                    if(current.view.panel==='rest')await tap('#adventurePage .adventure-button.secondary');
                    if(stage===11){
                        const key=JSON.stringify(current.view.state.storyKeys);assert.equal(current.view.state.storyKeys.blackPineToken.sourceNodeId,'c1_11');
                        await chooseStage('c1_11');await tap('.adventure-sheet-actions > .adventure-button.primary');
                        for(let line=0;line<30&&(await observe()).view.dialogue;line++)await tap('#adventurePage [onclick*="advanceDialogue"]');
                        assert.equal(JSON.stringify((await observe()).view.state.storyKeys),key,'UI story replay cannot duplicate the key');assert.equal((await observe()).view.state.currentNodeId,'c1_12');
                    }
                    if(stage===14)assert.equal(current.view.state.storyKeys.blackPineToken.sourceNodeId,'c1_11','stage14 retained its real prerequisite key');
                    if(stage===20){
                        for(let line=0;line<30&&(await observe()).view.dialogue;line++){await captureStory();await tap('#adventurePage [onclick*="advanceDialogue"]');}
                        await tap('#adventurePage [onclick*="claimChapterReward"]');assert.equal((await observe()).view.state.chapterRewardClaimed,true);
                        assert.equal(await client.eval('!!document.querySelector("#adventurePage [onclick*=claimChapterReward]")'),false,'chapter reward action disappears after one real claim');
                        await tap('#adventurePage [onclick*="setPanel"]');await chooseStage('c1_20');await tap('.adventure-sheet-actions > .adventure-button.primary');
                        await tap('#adventurePage [onclick*="claimNodeReward"]');assert.equal((await observe()).view.state.rewardClaims.c1_20,'claimed');
                        assert.equal(await client.eval('!!document.querySelector("#adventurePage [onclick*=claimNodeReward]")'),false,'boss reward action disappears after one real claim');
                    }
                    break;
                }
                assert.ok((await observe()).view.state.completedNodes[id],'bounded attempts complete '+id);
            }
            current=await observe();assert.equal(current.view.state.chapterCompleted,true);assert.equal(Object.keys(current.view.state.completedNodes).filter(id=>/^c1_/.test(id)).length,20);
            assert.equal(await client.eval(`(()=>{const s=FourSymbolsAccountSave.readForUid(FourSymbolsAccountSave.getActiveUid());return s.status==='ready'&&s.save.player.adventureProgress.chapters.chapter_v1.chapterCompleted;})()`),true,'original Save Owner persisted ending');
            const scene=label=>scenes.find(s=>s.label===label);assert.equal(scene('stage2-cast-0').npcSrc,scene('stage2-cast-1').npcSrc);assert.equal(scene('ending-guard').dialogue.lineIndex,2);assert.equal(scene('ending-guard').speaker,'守驛人');assert.equal(scene('ending-guard').npcSrc,scene('ending-line-3').npcSrc);
            results.push({width,height,trace,rounds,portraits,portraitChecks,scenes,nextRect,purchases,attempts,state:current.view.state});
        }catch(error){
            const diagnostic=await client?.eval(`(()=>{const button=document.getElementById('adventureTutorialReturn'),r=button?.getBoundingClientRect(),style=button?getComputedStyle(button):null,hit=r?document.elementFromPoint(r.x+r.width/2,r.y+r.height/2):null;return {body:document.body.innerText,view:window.FourSymbolsAdventure?.getView?.(),tutorialReturn:button?{hidden:button.hidden,pointerEvents:style.pointerEvents,display:style.display,visibility:style.visibility,rect:r.toJSON(),centerHit:{id:hit?.id,tag:hit?.tagName,text:hit?.textContent,ownsCenter:hit===button||button.contains(hit)}}:null};})()`).catch(()=>null);
            if(diagnostic)diagnostic.creationStartup=await client.eval(`(()=>{const describe=e=>{if(!e)return null;const r=e.getBoundingClientRect(),s=getComputedStyle(e),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {id:e.id,hidden:e.hidden,className:e.className,rect:r.toJSON(),display:s.display,visibility:s.visibility,opacity:s.opacity,pointerEvents:s.pointerEvents,centerHit:{id:hit?.id,tag:hit?.tagName,ownsCenter:hit===e||e.contains(hit)}};};return {canCreate:window.FourSymbolsStartupPolicy?.canCreateCharacter?.(),input:describe(document.getElementById('creationId')),loader:describe(document.getElementById('startupLoader'))};})()`).catch(()=>null);
            if(client){const shot=await client.send('Page.captureScreenshot',{format:'png'}).catch(()=>null);if(shot)fs.writeFileSync(path.join(artifact,'failure.png'),Buffer.from(shot.data,'base64'));}
            fs.writeFileSync(path.join(artifact,'failure.json'),JSON.stringify({error:String(error.stack),width,height,trace,rounds,scenes,portraitChecks,purchases,attempts,diagnostic},null,2));throw error;
        }finally{client?.close();proc.kill();}
    }
    fs.writeFileSync(path.join(artifact,'evidence.json'),JSON.stringify({passed:true,head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),manifest:createHash('sha256').update(fs.readFileSync('build/asset-manifest.json')).digest('hex'),transport:'isolated external transport; trusted pointer/touch player actions',results},null,2));
    console.log(process.argv.includes('--first-lesson-only')?'Pointer/touch focused first lesson PASS':'Pointer/touch four-viewport opening, five guided lessons and twenty-node player journey PASS');
}finally{server.server.closeAllConnections();await new Promise(resolve=>server.server.close(resolve));}
}
