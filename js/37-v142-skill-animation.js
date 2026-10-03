/* =====================================================
   V142 — combat action timing gate only
   Visual rendering was retired in V174. V143 owns all battle VFX.
===================================================== */
(function installV142SkillAnimationSystem(){
    "use strict";

    if(typeof window==="undefined"){ return; }
    if(window.__v142SkillAnimationInstalled && window.v142SkillAnimationDirector &&
        typeof window.v142PlaySkillAnimationFromBadge==="function"){ return; }
    window.__v142SkillAnimationInstalled=true;

    const VERSION="142-gate-only";
    const NORMAL_ANIMATION_MS=520;

    const SPECS={
        flameSlash:[760,"basic","slash"],fireCritical:[1050,"medium","impact"],
        explosiveFlurry:[1450,"medium","barrage"],dragonSlash:[2800,"ultimate","dragon"],
        fireRocket:[900,"basic","projectile"],blazeSpell:[1150,"medium","burst"],
        flameTornado:[2100,"high","tornado"],phoenixCry:[3200,"ultimate","phoenix"],
        rage:[1500,"medium","aura"],fireEX:[3000,"ultimate","aura"],

        waterKnife:[800,"basic","slash"],frostPunch:[900,"basic","ice-impact"],
        iceSpin:[1000,"medium","ice-barrage"],frostCrush:[1150,"high","ice-impact"],
        waterBall:[1400,"basic","projectile"],floodBeast:[1350,"medium","wave"],
        iceArrowRain:[1600,"high","ice-rain"],freeze:[950,"high","freeze"],
        healSpell:[1250,"medium","heal"],revive:[1800,"high","revive"],
        waterEX:[3000,"ultimate","aura"],

        stormFist:[1200,"basic","impact"],stormFlurry:[1500,"medium","barrage"],
        windCrossSlash:[1700,"high","cross-slash"],dizzyFist:[1800,"high","lightning"],
        windSpell:[1400,"basic","projectile"],stormCircle:[1600,"medium","tornado"],
        windHowlLightning:[1900,"high","lightning"],stormRain:[2600,"ultimate","tempest"],
        dodgeSkill:[1600,"medium","aura"],stealthSkill:[1700,"medium","veil"],
        dinghaishenzhen:[2200,"high","aura"],windEX:[3000,"ultimate","aura"],

        stoneSlash:[1100,"basic","slash"],petrifyFist:[1400,"medium","stone-impact"],
        stoneBreakSky:[1700,"high","stone-impact"],earthquakeCrush:[1800,"ultimate","earthquake"],
        stoneThrow:[1300,"basic","projectile"],sandWind:[1500,"medium","sandstorm"],
        flyingSandStrike:[2000,"high","petrify"],dustStorm:[2000,"ultimate","earthquake"],
        earthShield:[1800,"medium","shield"],rockWall:[1700,"high","shield"],
        barrier:[1900,"high","barrier"],earthEX:[3000,"ultimate","aura"],

        stormSpell:[2450,"high","tempest"],
        yuanXiangGuangMing:[2200,"high","holy-heal"],
        yuanGuangShield:[1950,"high","holy-shield"],
        yuanZuBlessing:[2000,"high","holy-blessing"]
    };

    function patchExtremeEmperorSkills(){
        if(typeof skillDatabase==="undefined"){ return; }
        const heal=skillDatabase.yuanXiangGuangMing;
        if(heal){
            heal.baseHeal=350;
            heal.baseHealSP=95;
            heal.targetType="allyAll";
            heal.description="我方全體回復350 HP、95 SP。";
        }
        const shield=skillDatabase.yuanGuangShield;
        if(shield){
            shield.shieldAmount=200;
            shield.shieldDuration=2;
            shield.targetType="allyAll";
            shield.description="我方全體獲得200護盾，持續2回合。";
        }
        if(!skillDatabase.yuanZuBlessing){
            skillDatabase.yuanZuBlessing={
                id:"yuanZuBlessing",name:"元祖賜福",element:"light",category:"buff",
                targetType:"allyAll",maxLevel:1,spCost:45,agilityBonusPercent:75,duration:2,
                description:"我方全體解除所有負面狀態，並增加敏捷75%，持續2回合。"
            };
        }
    }

    function fallbackSpec(skill){
        if(!skill){ return [NORMAL_ANIMATION_MS,"normal","impact"]; }
        const tier=Math.max(0,Number(skill.tier)||0);
        const category=String(skill.category||"");
        const target=String(skill.targetType||"");
        if(/heal|revive|buff/.test(category)){
            return [tier>=3?2200:1400,tier>=3?"high":"medium",category==="revive"?"revive":category==="heal"?"heal":"aura"];
        }
        if(target==="all"||target==="enemyAll"||target==="allyAll"){
            return [tier>=3?2700:1900,tier>=3?"ultimate":"high","barrage"];
        }
        if(target==="row"||target==="tri"){
            return [tier>=3?2100:1350,tier>=3?"high":"medium","barrage"];
        }
        if(tier>=4){ return [2800,"ultimate","burst"]; }
        if(tier>=3){ return [1900,"high","burst"]; }
        if(tier>=2){ return [1200,"medium","impact"]; }
        return [760,"basic","impact"];
    }

    function findSkill(skillId,name,element){
        if(typeof skillDatabase==="undefined"){ return {id:skillId,skill:null}; }
        if(skillId&&skillDatabase[skillId]){ return {id:skillId,skill:skillDatabase[skillId]}; }
        let foundId=null;
        Object.getOwnPropertyNames(skillDatabase).some(id=>{
            const candidate=skillDatabase[id];
            if(candidate&&candidate.name===name&&(!element||!candidate.element||candidate.element===element)){
                foundId=id;
                return true;
            }
            return false;
        });
        return {id:foundId,skill:foundId?skillDatabase[foundId]:null};
    }

    function animationConfig(skillId,name,element){
        if(name==="普通攻擊"||skillId==="normal"){
            return {
                id:"normal",name:"普通攻擊",element:element||"normal",
                duration:NORMAL_ANIMATION_MS,resolveDuration:NORMAL_ANIMATION_MS,
                tier:"normal",style:"impact",targetType:"single"
            };
        }
        const found=findSkill(skillId,name,element);
        const spec=SPECS[found.id]||fallbackSpec(found.skill);
        return {
            id:found.id||"unknown",
            name:name||(found.skill&&found.skill.name)||"技能",
            element:(found.skill&&found.skill.element)||element||"normal",
            duration:Math.max(NORMAL_ANIMATION_MS,Number(found.skill&&found.skill.animationDuration)||spec[0]),
            resolveDuration:Math.max(NORMAL_ANIMATION_MS,Number(found.skill&&found.skill.resolveDuration)||spec[0]),
            tier:(found.skill&&found.skill.animationTier)||spec[1],
            style:(found.skill&&found.skill.animationStyle)||spec[2],
            category:(found.skill&&found.skill.category)||"",
            targetType:(found.skill&&found.skill.targetType)||"single"
        };
    }

    function applyMetadata(){
        if(typeof skillDatabase==="undefined"){ return; }
        Object.keys(skillDatabase).forEach(id=>{
            const skill=skillDatabase[id];
            if(!skill){ return; }
            const spec=SPECS[id]||fallbackSpec(skill);
            skill.animationDuration=Math.max(NORMAL_ANIMATION_MS,Number(skill.animationDuration)||spec[0]);
            skill.resolveDuration=Math.max(NORMAL_ANIMATION_MS,Number(skill.resolveDuration)||spec[0]);
            skill.animationTier=skill.animationTier||spec[1];
            skill.animationStyle=skill.animationStyle||spec[2];
        });
    }

    patchExtremeEmperorSkills();
    applyMetadata();

    const state={
        sequence:0,active:null,latest:null,fallbackTimer:0,visibilityHandler:null,
        metrics:{
            version:VERSION,started:0,completed:0,superseded:0,
            last:null
        }
    };

    function removeVisibilityHandler(){
        if(state.visibilityHandler&&typeof document!=="undefined"&&document.removeEventListener){
            document.removeEventListener("visibilitychange",state.visibilityHandler);
        }
        state.visibilityHandler=null;
    }

    function cleanup(){
        removeVisibilityHandler();
        if(state.fallbackTimer){ clearTimeout(state.fallbackTimer); state.fallbackTimer=0; }
    }

    function armGateDeadline(gate,duration,reason){
        if(!gate||gate.done){ return false; }
        if(state.fallbackTimer){ clearTimeout(state.fallbackTimer); state.fallbackTimer=0; }
        const visualDuration=Math.max(0,Number(duration)||0);
        gate.visualStartedAt=Date.now();
        gate.deadline=gate.visualStartedAt+visualDuration;
        state.fallbackTimer=setTimeout(
            ()=>gate.complete(reason||"v142-timing-only"),
            visualDuration
        );
        return true;
    }

    function identity(side,name,actorIndex){
        return [
            typeof battleToken!=="undefined"?battleToken:"none",
            typeof turn!=="undefined"?turn:"none",
            typeof battlePhase!=="undefined"?battlePhase:"none",
            typeof initiativeIndex!=="undefined"?initiativeIndex:"none",
            typeof activeBattleCharacterIndex!=="undefined"?activeBattleCharacterIndex:"none",
            side,actorIndex,name
        ].join("|");
    }

    function createGate(config,key,onComplete){
        let resolvePromise=null;
        const gate={
            id:++state.sequence,key:key,
            battleToken:typeof battleToken!=="undefined"?battleToken:null,
            config:config,startedAt:Date.now(),visualStartedAt:0,deadline:0,done:false,reason:null,
            completionCount:0,promise:null,complete:null
        };
        gate.deadline=gate.startedAt+Math.max(0,Number(config.resolveDuration)||Number(config.duration)||0);
        gate.restartVisualTimeline=function(duration){
            return armGateDeadline(gate,duration,"v142-v143-visual-complete");
        };
        gate.promise=new Promise(resolve=>{ resolvePromise=resolve; });
        gate.complete=function(reason){
            if(gate.done){ return false; }
            gate.done=true;
            gate.reason=reason||"completed";
            gate.completionCount++;
            if(state.active===gate){ state.active=null; }
            state.metrics.completed++;
            cleanup();
            resolvePromise(gate);
            return true;
        };
        if(typeof onComplete==="function"){ gate.promise.then(()=>onComplete(gate)); }
        return gate;
    }

    function play(config,meta){
        meta=meta||{};
        const key=meta.key||identity(meta.side||"player",config.name,meta.actorIndex);
        if(state.active&&!state.active.done){
            if(state.active.key===key){ return state.active; }
            state.metrics.superseded++;
            state.active.complete("superseded");
        }
        const gate=createGate(config,key,meta.onComplete);
        state.active=gate;
        state.latest=gate;
        state.metrics.started++;
        state.metrics.last={
            id:config.id,name:config.name,duration:config.duration,
            resolveDuration:config.resolveDuration,tier:config.tier,
            style:config.style,element:config.element,side:meta.side||"player"
        };

        /* The gate measures visual lifetime only. Queue progression never waits
           on this Promise; 00-main.js reads the remaining time and schedules its
           own deterministic handoff even if the raster renderer fails. */
        armGateDeadline(
            gate,
            Math.max(0,Number(config.resolveDuration)||Number(config.duration)||0),
            meta.render===false?"v142-render-safety-deadline":"v142-timing-only"
        );
        if(typeof document!=="undefined"&&document.addEventListener){
            state.visibilityHandler=function(){
                if(!document.hidden&&Date.now()>=gate.deadline){ gate.complete("visibility-resume"); }
            };
            document.addEventListener("visibilitychange",state.visibilityHandler);
        }
        return gate;
    }

    const director={
        play:play,
        getActive:function(){ return state.active; },
        getLatest:function(){ return state.latest; },
        getMetrics:function(){ return Object.assign({},state.metrics,{active:!!state.active}); },
        dispose:function(){
            if(state.active&&!state.active.done){ state.active.complete("dispose"); }
            else{ cleanup(); }
        },
        notifyVisibilityReturn:function(){
            const gate=state.active;
            if(gate&&!gate.done&&Date.now()>=gate.deadline){ gate.complete("visibility-resume"); }
        }
    };

    window.v142SkillAnimationDirector=director;
    window.v142GetSkillAnimationConfig=function(skillId){
        const skill=typeof skillDatabase!=="undefined"?skillDatabase[skillId]:null;
        return animationConfig(skillId,skill&&skill.name,skill&&skill.element);
    };
    window.v142GetSkillNameDisplayDuration=function(name,element){
        const config=animationConfig(null,name,element);
        return Math.max(1,Math.round(config.duration*2/3));
    };
    window.v142GetAnimationDiagnostics=function(){ return director.getMetrics(); };
    window.v142CreateAnimationGateForTest=function(duration,onComplete){
        return createGate({
            id:"test",name:"test",element:"normal",duration:duration,
            resolveDuration:duration,tier:"normal",style:"impact"
        },"test-"+state.sequence,onComplete);
    };

    function startFromBadge(side,name,element,actorIndex,targetId,targetIds,targetContract){
        if(typeof battleActive!=="undefined"&&!battleActive){ return null; }
        const config=animationConfig(null,name,element);
        if(config.category==="passive"||config.targetType==="none"){ return null; }
        const meta={
            side:side,actorIndex:Number.isInteger(actorIndex)?actorIndex:0,
            key:identity(side,name,actorIndex)
        };
        const contract=targetContract&&targetContract.version==="battle-target-contract-v1"
            ?targetContract
            :Object.freeze({
                version:"battle-target-contract-v1",
                side:side,
                actorIndex:meta.actorIndex,
                targetId:targetId!==undefined?targetId:null,
                targetIds:Object.freeze(Array.isArray(targetIds)?targetIds.slice():[])
            });
        meta.targetContract=contract;
        meta.targetSide=contract.targetSide;
        meta.targetId=contract.targetId!==undefined?contract.targetId:null;
        meta.targetIds=Array.isArray(contract.targetIds)?contract.targetIds.slice():[];
        return director.play(config,meta);
    }
    window.v142PlaySkillAnimationFromBadge=function(side,name,element,actorIndex,targetId,targetIds,targetContract){
        return startFromBadge(side,name,element,actorIndex,targetId,targetIds,targetContract);
    };

    function currentGate(){
        const gate=state.latest;
        if(!gate){ return null; }
        if(typeof battleToken!=="undefined"&&gate.battleToken!==null&&gate.battleToken!==battleToken){ return null; }
        return gate;
    }

    /* The visual gate owns only visual lifetime. Queue progression has one
       owner in 00-main.js and can never wait on a renderer Promise. */
    window.v142GetActiveAnimationGate=currentGate;
    window.v142GetRemainingAnimationMs=function(){
        const gate=currentGate();
        return gate&&!gate.done?Math.max(0,gate.deadline-Date.now()):0;
    };


    /* V142 is visual-lifecycle only. Legacy Extreme Emperor heal/shield/buff
       gameplay dispatch and round ticking were retired; formal enemy support
       skills are owned by V141/V155 and FourSymbolsDurationLifecycle. */

    if(typeof checkBattleEnd==="function"){
        const previous=checkBattleEnd;
        checkBattleEnd=function(){
            const result=previous.apply(this,arguments);
            if(result){ setTimeout(()=>director.dispose(),0); }
            return result;
        };
    }
    if(typeof window.addEventListener==="function"){
        window.addEventListener("pagehide",()=>director.dispose());
    }
})();
