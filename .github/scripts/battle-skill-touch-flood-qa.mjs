import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// Runs inside the existing account-first, production-bundle battle QA session.
// All fixture changes are local to that disposable QA account/document.
export async function battleSkillTouchFloodQa(rawClient,artifactDir,{animationOnly=false}={}){
    const bounded=(promise,label)=>new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>reject(new Error('Battle touch/flood QA timed out: '+label)),15000);
        promise.then(value=>{clearTimeout(timer);resolve(value);},error=>{clearTimeout(timer);reject(error);});
    });
    const client={eval:expression=>bounded(rawClient.eval(expression),expression.slice(0,100)),send:(method,params)=>bounded(rawClient.send(method,params),method)};
    const checks={touchInput:'CDP native touch (browser emulation, not physical Android)',animation:[]};
    const manifest=JSON.parse(fs.readFileSync('asset-manifest.json','utf8'));
    const expectedAssets=Object.entries(manifest.assets).filter(([name])=>/^build\/(app-shell\.|gameplay-core[-.])/.test(name)).map(([name,data])=>({name,hash:data.sha256}));
    const spritePath='assets/vfx/water/tidal-beast-vfx.png';
    const spriteHash=crypto.createHash('sha256').update(fs.readFileSync(spritePath)).digest('hex');
    const deployedAssets=await client.eval(`(async()=>{
        const response=await fetch('/asset-manifest.json',{cache:'no-store'});if(!response.ok)throw new Error('Asset manifest HTTP '+response.status);const actual=await response.json();
        const files=await Promise.all(${JSON.stringify(expectedAssets.concat([{name:spritePath,hash:spriteHash}]))}.map(async item=>{const response=await fetch('/'+item.name,{cache:'no-store'});if(!response.ok)throw new Error(item.name+' HTTP '+response.status);const digest=await crypto.subtle.digest('SHA-256',await response.arrayBuffer());const hash=Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');return {name:item.name,hash:hash.slice(0,item.hash.length)};}));
        let deployedSha=null;if(location.hostname==='dev.four-symbols-dev.pages.dev'){const response=await fetch('/release-manifest.json',{cache:'no-store'});if(!response.ok)throw new Error('Release manifest HTTP '+response.status);deployedSha=(await response.json()).commitSha;}
        return {assets:actual.assets,files,deployedSha};
    })()`);
    assert.deepEqual(deployedAssets.assets,manifest.assets,'served asset list must match the exact checkout');
    assert.deepEqual(deployedAssets.files,expectedAssets.concat([{name:spritePath,hash:spriteHash}]),'served bundles and original atlas must match their hashes');
    if(deployedAssets.deployedSha){assert.equal(deployedAssets.deployedSha,process.env.EXPECTED_COMMIT_SHA||process.env.GITHUB_SHA);}
    checks.assets={manifestMatches:true,files:deployedAssets.files,deployedSha:deployedAssets.deployedSha};
    await client.eval(`(()=>{
        window.__touchQa={index:activeBattleCharacterIndex,phase:battlePhase,auto:autoBattle,ready:actionReady,pending:pendingAction,queued:queuedPlayerActions,loadouts:JSON.parse(JSON.stringify(characterSkillLoadouts)),sp:player.sp,finish:finishPlayerAction,submissions:0};
        clearInterval(timerId);timerId=null;
        finishPlayerAction=function(){__touchQa.submissions++;return __touchQa.finish.apply(this,arguments);};
        window.__touchQaReset=function(skill){
            clearTimeout(battleAdvanceTimeoutId);battleAdvanceTimeoutId=null;battleAdvanceScheduled=false;
            clearInterval(timerId);timerId=null;activeBattleCharacterIndex=0;battlePhase='declare';autoBattle=false;actionReady=false;pendingAction=null;queuedPlayerActions={};clearBattleTargetSelectionMode();
            const key=getPartyCharacterKey(0);const load=characterSkillLoadouts[key];load.skillLevels[skill]=1;load.equippedSkills=[skill];player.sp=9999;
            updateActionHudVisibility();populateSkillQuickBar();document.getElementById('skillQuickBar').classList.add('show');syncTurnTimerWithBattlePickers();
        };return true;
    })()`);
    const state=()=>client.eval(`({ready:actionReady,pending:pendingAction,submissions:__touchQa.submissions})`);
    const point=async selector=>{
        const data=await client.eval(`(()=>{const n=document.querySelector(${JSON.stringify(selector)});if(!n)return null;const r=n.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;return {x,y,disabled:n.disabled===true,hit:n.contains(document.elementFromPoint(x,y)),pointer:getComputedStyle(n).pointerEvents,width:r.width,height:r.height};})()`);
        assert.ok(data&&data.width>0&&data.height>0,selector+' must be visible');
        assert.equal(data.hit,true,selector+' must own its center hitbox');
        assert.notEqual(data.pointer,'none');return data;
    };
    const tap=async selector=>{
        const {x,y}=await point(selector);
        await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1,radiusX:2,radiusY:2}]});
        await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    };
    try{
        await client.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
        if(!animationOnly){
        await client.eval(`__touchQaReset('waterBall');true`);
        const button='.skill-quick-button[data-skill-id="waterBall"]';
        await tap(button);assert.equal((await state()).pending,'waterBall');
        await client.eval(`returnFromBattleTargetSelection();true`);
        assert.equal((await state()).ready,false);
        const {x,y}=await point(button);
        await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:2}]});
        await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+14,y,id:2}]});
        await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
        // The drag may emit a suppressed compatibility click, or no click at all.
        assert.equal((await state()).ready,false,'drag must not select a skill');
        await tap(button);assert.equal((await state()).pending,'waterBall','next normal tap must recover');
        await client.eval(`returnFromBattleTargetSelection();true`);
        await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:3}]});
        await client.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
        await tap(button);assert.equal((await state()).pending,'waterBall','cancel must not poison next tap');
        await client.eval(`returnFromBattleTargetSelection();true`);
        await tap(button);
        await client.eval(`(()=>{document.querySelector('.skill-quick-button[data-skill-id="waterBall"]').click();return true;})()`);
        assert.equal((await state()).submissions,0,'selection must not submit before a target');
        const target=await client.eval(`currentBattleMonsters.find(i=>canSelectHostileBattlePrimary('monster',i,getBattleActionTargetType('waterBall',0)))`);
        await tap('#battleMonster'+target);
        const submitted=await client.eval(`({queue:queuedPlayerActions[0],count:__touchQa.submissions,advance:battleAdvanceScheduled})`);
        assert.equal(submitted.queue.action,'waterBall');assert.equal(submitted.queue.target,target);assert.equal(submitted.count,1);assert.equal(submitted.advance,true);
        await client.eval(`selectBattleTarget(${target});true`);assert.equal((await state()).submissions,1,'duplicate target cannot submit twice');
        checks.skillDeclaration={normalTap:true,returnAndReselect:true,dragRecovery:true,cancelRecovery:true,targetSubmittedOnce:true,hitbox:true};
        checks.supportDeclarations=[];
        for(const skill of ['healSpell','barrier','earthShield','rage']){
            await client.eval(`__touchQaReset(${JSON.stringify(skill)});true`);
            const before=(await state()).submissions;
            await tap('.skill-quick-button[data-skill-id="'+skill+'"]');
            const declared=await state();
            const formal=await client.eval(`({targetType:skillDatabase[${JSON.stringify(skill)}].targetType,queue:queuedPlayerActions[0]})`);
            if(['ally','allyTri','deadAlly'].includes(formal.targetType)){
                assert.equal(declared.ready,true,skill+' must enter ally selection');
                assert.equal(declared.pending,skill);assert.equal(declared.submissions,before);
                await client.eval(`returnFromBattleTargetSelection();true`);
            }else{
                assert.equal(formal.queue?.action,skill,skill+' must declare the formal self/all action');
                assert.equal(declared.ready,false);assert.equal(declared.submissions,before+1);
            }
            checks.supportDeclarations.push({skill,targetType:formal.targetType,passed:true});
        }
        await client.eval(`__touchQaReset('revive');true`);
        const reviveFixture=await client.eval(`[0,1,2].map(index=>({index,hp:getBattleCharacterByIndex(index)?.hp||0}))`);
        assert.ok(reviveFixture.every(item=>item.hp>0),'revive no-target acceptance requires all three allies alive');
        await tap('.skill-quick-button[data-skill-id="revive"]');
        const reviveRejected=await client.eval(`(()=>{const n=document.getElementById('battleActionNotice');return {ready:actionReady,pending:pendingAction,text:n?.textContent||'',visible:!!n&&!n.hidden&&n.classList.contains('show')};})()`);
        assert.deepEqual(reviveRejected,{ready:false,pending:null,text:'我方目前沒有人死亡，無法使用復活術。',visible:true});
        checks.reviveNoTargetNotice=reviveRejected;
        await client.eval(`__touchQaReset('waterBall');player.sp=0;populateSkillQuickBar();document.getElementById('skillQuickBar').classList.add('show');true`);
        assert.equal((await point(button)).disabled,true);await tap(button);assert.equal((await state()).ready,false);
        const rejection=await client.eval(`(()=>{__touchQaReset('waterBall');autoBattle=true;prepareAction('waterBall');const auto=!actionReady;autoBattle=false;battlePhase='resolve';prepareAction('waterBall');const phase=!actionReady;battlePhase='declare';characterSkillLoadouts[getPartyCharacterKey(0)].equippedSkills=[];prepareAction('waterBall');return {auto,phase,equipment:!actionReady};})()`);
        assert.deepEqual(rejection,{auto:true,phase:true,equipment:true});checks.rejections=rejection;
        }

        checks.allTargetDeclarations=[];
        for(const skill of ['stormRain','iceArrowRain']){
            await client.eval(`__touchQaReset(${JSON.stringify(skill)});true`);
            const before=(await state()).submissions;
            const button='.skill-quick-button[data-skill-id="'+skill+'"]';
            await tap(button);
            assert.equal((await state()).pending,skill,'all-target must enter confirmation selection');
            assert.equal((await state()).submissions,before,'all-target must wait for confirmation');
            await client.eval(`returnFromBattleTargetSelection();true`);
            assert.equal((await state()).ready,false);
            await tap(button);
            const target=await client.eval(`currentBattleMonsters.find(i=>canSelectHostileBattlePrimary('monster',i,'all'))`);
            assert.ok(Number.isInteger(target),'all-target must have a living confirmation anchor');
            await tap('#battleMonster'+target);
            const submitted=await client.eval(`({queue:queuedPlayerActions[0],count:__touchQa.submissions})`);
            assert.equal(submitted.queue.action,skill);assert.equal(submitted.queue.target,target);
            assert.equal(submitted.count,before+1);
            await client.eval(`selectBattleTarget(${target});true`);
            assert.equal((await state()).submissions,before+1,'duplicate confirmation cannot submit twice');
            checks.allTargetDeclarations.push({skill,returnAndReselect:true,confirmationSubmittedOnce:true});
        }

        // Real confirmation schedules the next combatant. Clear that fixture timer
        // before measuring animation geometry so later screenshots stay on this turn.
        await client.eval(`__touchQaReset('waterBall');true`);
        const isolated=await client.eval(`({advance:battleAdvanceScheduled,timer:battleAdvanceTimeoutId,phase:battlePhase})`);
        assert.deepEqual(isolated,{advance:false,timer:null,phase:'declare'});
        console.log('Battle touch/flood QA: native input and formal support/all-target declarations passed; warming flood atlas');
        await client.eval(`(async()=>{const im=new Image();im.src=v143SkillAnimationManifest.floodBeast.sprite.src;await im.decode();v142SkillAnimationDirector.play({id:'floodBeast',element:'water',category:'magic',targetType:'single',duration:1350,resolveDuration:1350},{side:'player',actorIndex:0,targetSide:'monster',targetId:currentBattleMonsters[0],targetIds:[currentBattleMonsters[0]]});await new Promise(r=>setTimeout(r,100));v142SkillAnimationDirector.dispose();return true;})()`);
        const enemyIds=await client.eval(`currentBattleMonsters.filter(i=>monsters[i]?.alive&&document.getElementById('battleMonster'+i)).slice(0,3)`);
        const slots=await client.eval(`FourSymbolsBattlefieldSlots.allySlots.slice(0,3)`);
        const originalSlot=await client.eval(`FourSymbolsBattlefieldSlots.getAllySlotForCharacter(0)`);
        const bossIndex=await client.eval(`FourSymbolsBossBattle.isActive()?FourSymbolsBossBattle.getBossIndex():null`);
        checks.actorKind=Number.isInteger(bossIndex)?'boss':'regular-monster';
        // Lossless screenshots at CSS-pixel resolution keep this permanent QA
        // evidence small without changing the viewport or formal artwork.
        const screenshotClip=await client.eval(`({x:0,y:0,width:innerWidth,height:innerHeight,scale:1/devicePixelRatio})`);
        for(const side of animationOnly?['monster']:['player','monster']){
            const actorIndex=side==='monster'&&Number.isInteger(bossIndex)?bossIndex:0;
            for(let column=0;column<3;column++){
                const targetId=side==='player'?enemyIds[column]:0;
                assert.ok(Number.isInteger(targetId));
                if(side==='monster'){
                    const projected=await client.eval(`(()=>{FourSymbolsBattlefieldSlots.moveAllyCharacter(0,${JSON.stringify(slots[column])});FourSymbolsBattlefieldRenderGeometry.reconcile();updateUI();return document.getElementById('battlePlayerCard0').dataset.slot;})()`);
                    assert.equal(projected,slots[column],'moved target must be rendered in its canonical slot');
                }
                for(const [phase,time] of [['cast',.08],['flight',.3],['impact',.65],['dissipate',.92]]){
                    console.log('Battle touch/flood QA: '+side+' target '+column+' '+phase);
                    const snapshot=await client.eval(`(()=>{
                        v142SkillAnimationDirector.dispose();
                        v142SkillAnimationDirector.play({id:'floodBeast',name:'洪水猛獸',element:'water',category:'magic',targetType:'single',duration:1350,resolveDuration:1350},{side:${JSON.stringify(side)},actorIndex:${actorIndex},targetSide:${JSON.stringify(side==='player'?'monster':'player')},targetId:${targetId},targetIds:[${targetId}]});
                        const n=document.querySelector('.v143-vfx-sprite[data-skill="floodBeast"]');if(!n)return null;
                        for(const a of n.getAnimations()){a.pause();a.currentTime=1350*${time};}
                        const r=n.getBoundingClientRect(),m=new DOMMatrix(getComputedStyle(n).transform);
                        const dx=parseFloat(n.style.getPropertyValue('--v143-sprite-dx')),dy=parseFloat(n.style.getPropertyValue('--v143-sprite-dy'));
                        const targetSide=${JSON.stringify(side==='player'?'monster':'player')},targetIndex=${targetId};
                        const targetSlot=FourSymbolsBattlefieldSlots.getSlotForCombatant(targetSide,targetIndex);
                        const targetCenter=FourSymbolsBattlefieldSlots.getSlotCenter(targetSlot);
                        if(Math.abs(parseFloat(n.style.left)+dx-targetCenter.x)>1||Math.abs(parseFloat(n.style.top)+dy-targetCenter.y)>1)throw new Error('Flood endpoint must match the current canonical target, not a reused animation');
                        return {motion:n.dataset.motion,travel:n.dataset.travel||null,center:{x:r.left+r.width/2,y:r.top+r.height/2},actor:{x:parseFloat(n.style.left),y:parseFloat(n.style.top)},dx,dy,angle:Math.atan2(m.b,m.a)*180/Math.PI,background:getComputedStyle(n).backgroundPosition,opacity:getComputedStyle(n).opacity,hit:v143SkillAnimationManifest.floodBeast.hit};
                    })()`);
                    assert.ok(snapshot);assert.equal(snapshot.motion,'phased');assert.equal(snapshot.travel,null);
                    assert.equal(snapshot.hit,.5833333333);
                    assert.ok(Math.abs(snapshot.angle)<.01,phase+' must preserve the original upright artwork');
                    if(phase==='cast'||phase==='impact'||phase==='dissipate'){
                        const atTarget=phase!=='cast';
                        assert.ok(Math.abs(snapshot.center.x-snapshot.actor.x-(atTarget?snapshot.dx:0))<1);
                        assert.ok(Math.abs(snapshot.center.y-snapshot.actor.y-(atTarget?snapshot.dy:0))<1);
                    }
                    const shot=await client.send('Page.captureScreenshot',{format:'png',clip:screenshotClip});
                    fs.writeFileSync(path.join(artifactDir,'flood-'+side+'-'+column+'-'+phase+'.png'),Buffer.from(shot.data,'base64'));
                    checks.animation.push({side,actorIndex,column,phase,...snapshot,imagePngBase64:shot.data});
                }
            }
        }
        await client.eval(`FourSymbolsBattlefieldSlots.moveAllyCharacter(0,${JSON.stringify(originalSlot)});FourSymbolsBattlefieldRenderGeometry.reconcile();v142SkillAnimationDirector.dispose();true`);
        return checks;
    }finally{
        await client.eval(`(()=>{if(!window.__touchQa)return;clearTimeout(battleAdvanceTimeoutId);battleAdvanceTimeoutId=null;battleAdvanceScheduled=false;finishPlayerAction=__touchQa.finish;for(const key of Object.keys(characterSkillLoadouts)){delete characterSkillLoadouts[key];}Object.assign(characterSkillLoadouts,__touchQa.loadouts);player.sp=__touchQa.sp;activeBattleCharacterIndex=__touchQa.index;battlePhase=__touchQa.phase;autoBattle=__touchQa.auto;actionReady=__touchQa.ready;pendingAction=__touchQa.pending;queuedPlayerActions=__touchQa.queued;clearBattleTargetSelectionMode();closeMenus();delete window.__touchQa;delete window.__touchQaReset;updateUI();return true;})()`);
    }
}
