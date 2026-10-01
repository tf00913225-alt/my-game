import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Runs inside the existing account-first, production-bundle battle QA session.
// All fixture changes are local to that disposable QA account/document.
export async function battleSkillTouchFloodQa(client,artifactDir){
    const checks={touchInput:'CDP native touch (browser emulation, not physical Android)',animation:[]};
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
        for(const skill of ['healSpell','earthShield']){
            await client.eval(`__touchQaReset(${JSON.stringify(skill)});true`);
            await tap('.skill-quick-button[data-skill-id="'+skill+'"]');
            const declared=await state();
            assert.equal(declared.ready,true,skill+' must declare through common owner');
            if(declared.pending){await client.eval(`returnFromBattleTargetSelection();true`);}
        }
        await client.eval(`__touchQaReset('waterBall');player.sp=0;populateSkillQuickBar();document.getElementById('skillQuickBar').classList.add('show');true`);
        assert.equal((await point(button)).disabled,true);await tap(button);assert.equal((await state()).ready,false);
        const rejection=await client.eval(`(()=>{__touchQaReset('waterBall');autoBattle=true;prepareAction('waterBall');const auto=!actionReady;autoBattle=false;battlePhase='resolve';prepareAction('waterBall');const phase=!actionReady;battlePhase='declare';characterSkillLoadouts[getPartyCharacterKey(0)].equippedSkills=[];prepareAction('waterBall');return {auto,phase,equipment:!actionReady};})()`);
        assert.deepEqual(rejection,{auto:true,phase:true,equipment:true});checks.rejections=rejection;

        await client.eval(`(async()=>{const im=new Image();im.src=v143SkillAnimationManifest.floodBeast.sprite.src;await im.decode();v142SkillAnimationDirector.play({id:'floodBeast',element:'water',category:'magic',targetType:'single',duration:1350,resolveDuration:1350},{side:'player',actorIndex:0,targetSide:'monster',targetId:currentBattleMonsters[0],targetIds:[currentBattleMonsters[0]]});await new Promise(r=>setTimeout(r,100));v142SkillAnimationDirector.dispose();return true;})()`);
        const enemyIds=await client.eval(`currentBattleMonsters.filter(i=>monsters[i]?.alive&&document.getElementById('battleMonster'+i)).slice(0,3)`);
        const slots=await client.eval(`FourSymbolsBattlefieldSlots.allySlots.slice(0,3)`);
        const originalSlot=await client.eval(`FourSymbolsBattlefieldSlots.getAllySlotForCharacter(0)`);
        for(const side of ['player','monster']){
            for(let column=0;column<3;column++){
                const targetId=side==='player'?enemyIds[column]:0;
                assert.ok(Number.isInteger(targetId));
                if(side==='monster'){await client.eval(`FourSymbolsBattlefieldSlots.moveAllyCharacter(0,${JSON.stringify(slots[column])});updateUI();true`);}
                for(const [phase,time] of [['cast',.08],['flight',.3],['impact',.65],['dissipate',.92]]){
                    const snapshot=await client.eval(`(()=>{
                        v142SkillAnimationDirector.play({id:'floodBeast',name:'洪水猛獸',element:'water',category:'magic',targetType:'single',duration:1350,resolveDuration:1350},{side:${JSON.stringify(side)},actorIndex:0,targetSide:${JSON.stringify(side==='player'?'monster':'player')},targetId:${targetId},targetIds:[${targetId}]});
                        const n=document.querySelector('.v143-vfx-sprite[data-skill="floodBeast"]');if(!n)return null;
                        for(const a of n.getAnimations()){a.pause();a.currentTime=1350*${time};}
                        const r=n.getBoundingClientRect(),m=new DOMMatrix(getComputedStyle(n).transform);
                        const dx=parseFloat(n.style.getPropertyValue('--v143-sprite-dx')),dy=parseFloat(n.style.getPropertyValue('--v143-sprite-dy'));
                        return {motion:n.dataset.motion,travel:n.dataset.travel||null,center:{x:r.left+r.width/2,y:r.top+r.height/2},actor:{x:parseFloat(n.style.left),y:parseFloat(n.style.top)},dx,dy,angle:Math.atan2(m.b,m.a)*180/Math.PI,background:getComputedStyle(n).backgroundPosition,opacity:getComputedStyle(n).opacity,hit:v143SkillAnimationManifest.floodBeast.hit};
                    })()`);
                    assert.ok(snapshot);assert.equal(snapshot.motion,'phased');assert.equal(snapshot.travel,null);
                    assert.equal(snapshot.hit,.5833333333);
                    if(phase==='cast'||phase==='impact'||phase==='dissipate'){
                        assert.ok(Math.abs(snapshot.angle)<.01,phase+' must stay upright');
                        const atTarget=phase!=='cast';
                        assert.ok(Math.abs(snapshot.center.x-snapshot.actor.x-(atTarget?snapshot.dx:0))<1);
                        assert.ok(Math.abs(snapshot.center.y-snapshot.actor.y-(atTarget?snapshot.dy:0))<1);
                    }else{
                        const expected=Math.atan2(snapshot.dy,snapshot.dx)*180/Math.PI;
                        assert.ok(Math.abs(snapshot.angle-expected)<.1,'beast must point at target');
                    }
                    const shot=await client.send('Page.captureScreenshot',{format:'png'});
                    fs.writeFileSync(path.join(artifactDir,'flood-'+side+'-'+column+'-'+phase+'.png'),Buffer.from(shot.data,'base64'));
                    checks.animation.push({side,column,phase,...snapshot,imagePngBase64:shot.data});
                }
            }
        }
        await client.eval(`FourSymbolsBattlefieldSlots.moveAllyCharacter(0,${JSON.stringify(originalSlot)});v142SkillAnimationDirector.dispose();true`);
        return checks;
    }finally{
        await client.eval(`(()=>{if(!window.__touchQa)return;clearTimeout(battleAdvanceTimeoutId);battleAdvanceTimeoutId=null;battleAdvanceScheduled=false;finishPlayerAction=__touchQa.finish;for(const key of Object.keys(characterSkillLoadouts)){delete characterSkillLoadouts[key];}Object.assign(characterSkillLoadouts,__touchQa.loadouts);player.sp=__touchQa.sp;activeBattleCharacterIndex=__touchQa.index;battlePhase=__touchQa.phase;autoBattle=__touchQa.auto;actionReady=__touchQa.ready;pendingAction=__touchQa.pending;queuedPlayerActions=__touchQa.queued;clearBattleTargetSelectionMode();closeMenus();delete window.__touchQa;delete window.__touchQaReset;updateUI();return true;})()`);
    }
}
