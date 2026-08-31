/* =====================================================
   V142 — reusable skill-animation director and action gate
   Visuals are isolated from damage, AI and initiative logic.
===================================================== */
(function installV142SkillAnimationSystem(){
    "use strict";

    if(typeof window==="undefined"){ return; }
    /* Recover if an earlier runtime load set only the sentinel before it failed. */
    if(window.__v142SkillAnimationInstalled && window.v142SkillAnimationDirector){ return; }
    window.__v142SkillAnimationInstalled=true;

    const VERSION="142";
    const NORMAL_ANIMATION_MS=520;
    const CURRENT_DECLARE_DELAY_MS=90;
    const CURRENT_RESOLVE_DELAY_MS=1600;
    const CURRENT_ROUND_HANDOFF_MS=400;

    /*
       Each skill owns presentation timing. The combat engine keeps its existing
       delay; V142 only waits for the longer of that delay and this animation.
    */
    const SPECS={
        flameSlash:[760,"basic","slash"],fireCritical:[1050,"medium","impact"],
        explosiveFlurry:[1450,"medium","barrage"],dragonSlash:[2800,"ultimate","dragon"],
        fireRocket:[900,"basic","projectile"],blazeSpell:[1150,"medium","burst"],
        flameTornado:[2100,"high","tornado"],phoenixCry:[3200,"ultimate","phoenix"],
        rage:[1500,"medium","aura"],fireEX:[3000,"ultimate","aura"],

        waterKnife:[800,"basic","slash"],frostPunch:[900,"basic","ice-impact"],
        iceSpin:[1000,"medium","ice-barrage"],frostCrush:[1150,"high","ice-impact"],
        waterBall:[1100,"basic","projectile"],floodBeast:[1350,"medium","wave"],
        iceArrowRain:[1600,"high","ice-rain"],freeze:[950,"high","freeze"],
        healSpell:[1250,"medium","heal"],revive:[1800,"high","revive"],
        waterEX:[3000,"ultimate","aura"],

        stormFist:[720,"basic","impact"],stormFlurry:[1250,"medium","barrage"],
        windCrossSlash:[1900,"high","cross-slash"],dizzyFist:[2200,"high","lightning"],
        windSpell:[900,"basic","projectile"],stormCircle:[1500,"medium","tornado"],
        windHowlLightning:[2150,"high","lightning"],stormRain:[2850,"ultimate","tempest"],
        dodgeSkill:[1400,"medium","aura"],stealthSkill:[1700,"medium","veil"],
        dinghaishenzhen:[2200,"high","aura"],windEX:[3000,"ultimate","aura"],

        stoneSlash:[760,"basic","slash"],petrifyFist:[1300,"medium","stone-impact"],
        stoneBreakSky:[2150,"high","stone-impact"],earthquakeCrush:[2650,"ultimate","earthquake"],
        stoneThrow:[900,"basic","projectile"],sandWind:[1450,"medium","sandstorm"],
        flyingSandStrike:[2200,"high","petrify"],dustStorm:[2750,"ultimate","earthquake"],
        earthShield:[1600,"medium","shield"],rockWall:[1850,"high","shield"],
        barrier:[2300,"high","barrier"],earthEX:[3000,"ultimate","aura"],

        stormSpell:[2450,"high","tempest"],
        yuanXiangGuangMing:[2200,"high","holy-heal"],
        yuanGuangShield:[1950,"high","holy-shield"],
        yuanZuBlessing:[2500,"high","holy-blessing"]
    };

    const COLORS={
        fire:["#ff5d2e","#ffc05c"],water:["#43c8ff","#d9f6ff"],
        wind:["#57f3b4","#e6fff5"],earth:["#d7a651","#fff0a3"],
        light:["#ffe68a","#ffffff"],dark:["#b98cff","#f0dbff"],
        normal:["#f1e7d3","#ffffff"]
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
                id:"yuanZuBlessing",
                name:"元祖賜福",
                element:"light",
                category:"buff",
                targetType:"allyAll",
                maxLevel:1,
                spCost:45,
                agilityBonusPercent:75,
                duration:2,
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

    function qualityLevel(){
        const nav=typeof navigator!=="undefined"?navigator:{};
        const memory=Number(nav.deviceMemory)||4;
        const cores=Number(nav.hardwareConcurrency)||4;
        let quality=(memory<=2||cores<=2)?"low":(memory<=4||cores<=4)?"medium":"high";
        try{
            if(window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches){
                quality="low";
            }
        }catch(_){}
        return quality;
    }

    const state={
        sequence:0,
        active:null,
        latest:null,
        rafId:0,
        fallbackTimer:0,
        visibilityHandler:null,
        targetCards:[],
        tickets:{declare:null,resolve:null},
        roundGate:null,
        completedBoundaries:[],
        metrics:{
            version:VERSION,quality:qualityLevel(),started:0,completed:0,
            superseded:0,boundariesAdvanced:0,duplicateBoundariesBlocked:0,
            peakParticles:0,last:null
        }
    };

    function ensureStage(){
        if(typeof document==="undefined"||!document.createElement){ return null; }
        let stage=document.getElementById("v142-skill-stage");
        if(stage){ return stage; }
        stage=document.createElement("div");
        stage.id="v142-skill-stage";
        stage.className="v142-skill-stage v142-quality-"+state.metrics.quality;
        stage.setAttribute("aria-hidden","true");
        stage.innerHTML=
            '<canvas class="v142-particle-canvas"></canvas>'+
            '<div class="v142-vignette"></div><div class="v142-ground"></div>'+
            '<svg class="v142-vector-stage" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true">'+
                '<circle class="v142-energy-ring" cx="50" cy="50" r="24"></circle>'+
                '<path class="v142-vector-slash v142-vector-slash-a" d="M15 72 Q48 18 86 32"></path>'+
                '<path class="v142-vector-slash v142-vector-slash-b" d="M22 24 Q54 82 88 62"></path>'+
                '<path class="v142-wave-line" d="M3 63 Q18 43 34 63 T66 63 T98 63"></path>'+
            '</svg>'+
            '<div class="v142-cast-core"></div><div class="v142-projectile"></div>'+
            '<div class="v142-summon"></div><div class="v142-impact"></div>'+
            '<div class="v142-skill-caption"><b></b><span></span></div>'+
            '<i class="v142-animation-clock"></i>';
        const host=document.getElementById("battlePage")||document.body||document.documentElement;
        if(host&&host.appendChild){ host.appendChild(stage); }
        return stage;
    }

    function canvasData(canvas){
        if(!canvas||!canvas.getContext){ return null; }
        const rect=canvas.getBoundingClientRect?canvas.getBoundingClientRect():{width:0,height:0};
        const width=Math.max(1,Math.round(rect.width||window.innerWidth||360));
        const height=Math.max(1,Math.round(rect.height||window.innerHeight||640));
        const dpr=Math.min(state.metrics.quality==="low"?1:1.5,Number(window.devicePixelRatio)||1);
        const pixelWidth=Math.round(width*dpr);
        const pixelHeight=Math.round(height*dpr);
        if(canvas.width!==pixelWidth||canvas.height!==pixelHeight){
            canvas.width=pixelWidth;
            canvas.height=pixelHeight;
        }
        const context=canvas.getContext("2d");
        if(!context){ return null; }
        context.setTransform(dpr,0,0,dpr,0,0);
        return {context:context,width:width,height:height};
    }

    function stopCanvas(){
        if(state.rafId&&typeof cancelAnimationFrame==="function"){ cancelAnimationFrame(state.rafId); }
        state.rafId=0;
        const stage=typeof document!=="undefined"?document.getElementById("v142-skill-stage"):null;
        const canvas=stage&&stage.querySelector?stage.querySelector(".v142-particle-canvas"):null;
        const data=canvasData(canvas);
        if(data){ data.context.clearRect(0,0,data.width,data.height); }
    }

    function startCanvas(stage,config,startedAt){
        if(!stage||!stage.querySelector||typeof requestAnimationFrame!=="function"){ return; }
        stopCanvas();
        const data=canvasData(stage.querySelector(".v142-particle-canvas"));
        if(!data){ return; }
        const colors=COLORS[config.element]||COLORS.normal;
        const count=state.metrics.quality==="low"?18:state.metrics.quality==="medium"?34:52;
        const particles=Array.from({length:count},(_,index)=>({
            x:data.width*(.18+Math.random()*.64),
            y:data.height*(.3+Math.random()*.48),
            vx:(Math.random()-.5)*(config.tier==="ultimate"?3.2:1.9),
            vy:-(.6+Math.random()*2.4),
            radius:1.5+Math.random()*(config.tier==="ultimate"?5:3),
            delay:(index%7)/6*config.duration*.38,
            life:config.duration*(.32+Math.random()*.42)
        }));
        state.metrics.peakParticles=Math.max(state.metrics.peakParticles,particles.length);
        const shadow=state.metrics.quality==="low"?0:state.metrics.quality==="medium"?7:12;

        function frame(){
            if(!state.active||state.active.startedAt!==startedAt){ return; }
            const elapsed=Date.now()-startedAt;
            const context=data.context;
            context.clearRect(0,0,data.width,data.height);
            context.globalCompositeOperation="lighter";
            particles.forEach((particle,index)=>{
                const local=elapsed-particle.delay;
                if(local<0||local>particle.life){ return; }
                const progress=local/particle.life;
                const spiral=/tornado|tempest|sandstorm/.test(config.style);
                context.globalAlpha=Math.sin(Math.PI*progress)*.88;
                context.fillStyle=index%2?colors[0]:colors[1];
                context.shadowColor=colors[0];
                context.shadowBlur=shadow;
                context.beginPath();
                context.arc(
                    particle.x+particle.vx*local/12+(spiral?Math.sin(progress*Math.PI*5)*35*(1-progress):0),
                    particle.y+particle.vy*local/12+(config.style==="earthquake"?Math.sin(index*2.7+elapsed/45)*8:0),
                    Math.max(.4,particle.radius*(1-progress)),0,Math.PI*2
                );
                context.fill();
            });
            if(config.tier==="ultimate"||config.style==="earthquake"){
                const progress=Math.min(1,elapsed/config.duration);
                context.globalAlpha=Math.max(0,.55-progress*.5);
                context.strokeStyle=colors[1];
                context.lineWidth=2+progress*5;
                context.beginPath();
                context.arc(data.width/2,data.height*.56,20+progress*Math.min(data.width,data.height)*.38,0,Math.PI*2);
                context.stroke();
            }
            context.globalAlpha=1;
            context.globalCompositeOperation="source-over";
            if(elapsed<config.duration){ state.rafId=requestAnimationFrame(frame); }
            else{ context.clearRect(0,0,data.width,data.height); state.rafId=0; }
        }
        state.rafId=requestAnimationFrame(frame);
    }

    function clearTargets(){
        state.targetCards.forEach(card=>{
            if(card&&card.classList){ card.classList.remove("v142-target-hit","v142-target-heavy"); }
            if(card&&card.style){
                card.style.removeProperty("--v142-duration");
                card.style.removeProperty("--v142-color");
            }
        });
        state.targetCards=[];
    }

    function markTargets(side,actorIndex,config){
        if(typeof document==="undefined"||!document.getElementById){ return; }
        clearTargets();
        const targetSide=side==="monster"?"player":"monster";
        const wide=/all|row|tri/i.test(String(config.targetType||""))||
            /barrage|rain|tempest|earthquake|tornado|phoenix|blessing|shield/.test(config.style);
        let preferred=null;
        if(side==="player"&&typeof queuedPlayerActions!=="undefined"){
            const queued=queuedPlayerActions&&queuedPlayerActions[actorIndex];
            if(queued&&Number.isInteger(queued.target)){ preferred=queued.target; }
            if(queued&&Number.isInteger(queued.targetAlly)){ preferred=queued.targetAlly; }
        }
        const max=targetSide==="monster"?10:3;
        for(let index=0;index<max;index++){
            if(!wide&&preferred!==null&&index!==preferred){ continue; }
            if(!wide&&preferred===null&&index>0){ continue; }
            const card=document.getElementById(targetSide==="monster"?"battleMonster"+index:"battlePlayerCard"+index);
            if(!card){ continue; }
            card.style.setProperty("--v142-duration",config.duration+"ms");
            card.style.setProperty("--v142-color",(COLORS[config.element]||COLORS.normal)[0]);
            card.classList.add("v142-target-hit");
            if(config.tier==="high"||config.tier==="ultimate"){ card.classList.add("v142-target-heavy"); }
            state.targetCards.push(card);
        }
    }

    function removeVisibilityHandler(){
        if(state.visibilityHandler&&typeof document!=="undefined"&&document.removeEventListener){
            document.removeEventListener("visibilitychange",state.visibilityHandler);
        }
        state.visibilityHandler=null;
    }

    function cleanup(stage){
        stopCanvas();
        clearTargets();
        removeVisibilityHandler();
        if(state.fallbackTimer){ clearTimeout(state.fallbackTimer); state.fallbackTimer=0; }
        if(stage){
            stage.className="v142-skill-stage v142-quality-"+state.metrics.quality;
            ["data-element","data-tier","data-style","data-side"].forEach(name=>stage.removeAttribute(name));
        }
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
            id:++state.sequence,
            key:key,
            battleToken:typeof battleToken!=="undefined"?battleToken:null,
            config:config,
            startedAt:Date.now(),
            deadline:0,
            done:false,
            reason:null,
            completionCount:0,
            promise:null,
            complete:null
        };
        gate.deadline=gate.startedAt+Math.max(0,Number(config.resolveDuration)||Number(config.duration)||0);
        gate.promise=new Promise(resolve=>{ resolvePromise=resolve; });
        gate.complete=function(reason){
            if(gate.done){ return false; }
            gate.done=true;
            gate.reason=reason||"completed";
            gate.completionCount++;
            if(state.active===gate){ state.active=null; }
            state.metrics.completed++;
            cleanup(typeof document!=="undefined"?document.getElementById("v142-skill-stage"):null);
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
        if(meta.render===false){ return gate; }

        const stage=ensureStage();
        if(!stage){
            state.fallbackTimer=setTimeout(()=>gate.complete("headless-fallback"),config.resolveDuration);
            return gate;
        }
        const colors=COLORS[config.element]||COLORS.normal;
        stage.style.setProperty("--v142-duration",config.duration+"ms");
        stage.style.setProperty("--v142-color",colors[0]);
        stage.style.setProperty("--v142-color-soft",colors[1]);
        stage.setAttribute("data-element",config.element);
        stage.setAttribute("data-tier",config.tier);
        stage.setAttribute("data-style",config.style);
        stage.setAttribute("data-side",meta.side||"player");

        const caption=stage.querySelector(".v142-skill-caption");
        if(caption){
            caption.querySelector("b").textContent=config.name;
            caption.querySelector("span").textContent=
                config.tier==="ultimate"?"終極演出":config.tier==="high"?"高階技能":
                config.element==="normal"?"一般行動":"元素技能";
        }
        const clock=stage.querySelector(".v142-animation-clock");
        stage.classList.remove("v142-active");
        if(clock){ clock.classList.remove("v142-clock-running"); }
        void stage.offsetWidth;
        stage.classList.add("v142-active");
        stage.classList.add(config.tier==="ultimate"?"v142-screen-shake-heavy":"v142-screen-shake");
        if(clock){
            clock.classList.add("v142-clock-running");
            clock.addEventListener("animationend",event=>{
                if(event.target===clock&&event.animationName==="v142ActionClock"){
                    gate.complete("animationend");
                }
            },{once:true});
        }
        markTargets(meta.side||"player",meta.actorIndex,config);
        startCanvas(stage,config,gate.startedAt);

        state.fallbackTimer=setTimeout(()=>gate.complete("fallback"),config.resolveDuration+450);
        state.visibilityHandler=function(){
            if(!document.hidden&&Date.now()>=gate.deadline){ gate.complete("visibility-resume"); }
        };
        document.addEventListener("visibilitychange",state.visibilityHandler);
        return gate;
    }

    const director={
        play:play,
        getActive:function(){ return state.active; },
        getLatest:function(){ return state.latest; },
        getMetrics:function(){ return Object.assign({},state.metrics,{active:!!state.active}); },
        dispose:function(){
            state.tickets.declare=null;
            state.tickets.resolve=null;
            state.roundGate=null;
            if(state.active&&!state.active.done){ state.active.complete("dispose"); }
            else{ cleanup(typeof document!=="undefined"?document.getElementById("v142-skill-stage"):null); }
        },
        notifyVisibilityReturn:function(){
            const gate=state.active;
            if(gate&&!gate.done&&Date.now()>=gate.deadline){ gate.complete("visibility-resume"); }
        },
        registerRenderer:function(name,renderer){
            if(typeof name!=="string"||typeof renderer!=="function"){ return false; }
            director.renderers[name]=renderer;
            return true;
        },
        renderers:Object.create(null)
    };
    window.v142SkillAnimationDirector=director;
    window.v142GetSkillAnimationConfig=function(skillId){
        const skill=typeof skillDatabase!=="undefined"?skillDatabase[skillId]:null;
        return animationConfig(skillId,skill&&skill.name,skill&&skill.element);
    };
    window.v142GetAnimationDiagnostics=function(){ return director.getMetrics(); };
    window.v142CreateAnimationGateForTest=function(duration,onComplete){
        return createGate({
            id:"test",name:"test",element:"normal",duration:duration,
            resolveDuration:duration,tier:"normal",style:"impact"
        },"test-"+state.sequence,onComplete);
    };

    function startFromBadge(side,name,element,actorIndex){
        if(typeof battleActive!=="undefined"&&!battleActive){ return null; }
        const config=animationConfig(null,name,element);
        if(config.category==="passive"||config.targetType==="none"){ return null; }
        return director.play(config,{
            side:side,
            actorIndex:Number.isInteger(actorIndex)?actorIndex:0,
            key:identity(side,name,actorIndex)
        });
    }

    if(typeof showSkillNameBadge==="function"){
        const previous=showSkillNameBadge;
        showSkillNameBadge=function(name,element,characterIndex){
            const result=previous.apply(this,arguments);
            const index=Number.isInteger(characterIndex)?characterIndex:
                (typeof activeBattleCharacterIndex!=="undefined"?activeBattleCharacterIndex:0);
            startFromBadge("player",name,element,index);
            return result;
        };
    }
    if(typeof showMonsterSkillNameBadge==="function"){
        const previous=showMonsterSkillNameBadge;
        showMonsterSkillNameBadge=function(name,element,monsterIndex){
            const result=previous.apply(this,arguments);
            startFromBadge("monster",name,element,monsterIndex);
            return result;
        };
    }

    function currentGate(){
        const gate=state.latest;
        if(!gate){ return null; }
        if(typeof battleToken!=="undefined"&&gate.battleToken!==null&&gate.battleToken!==battleToken){ return null; }
        return gate;
    }

    function rememberBoundary(key){
        state.completedBoundaries.push(key);
        if(state.completedBoundaries.length>48){ state.completedBoundaries.splice(0,state.completedBoundaries.length-48); }
    }

    function runTicket(kind,ticket,invoke){
        const key=[kind,ticket.token,ticket.round,ticket.index,ticket.gateId].join("|");
        if(ticket.consumed||state.completedBoundaries.indexOf(key)>=0){
            state.metrics.duplicateBoundariesBlocked++;
            return;
        }
        ticket.consumed=true;
        const delay=Math.max(0,ticket.earliestAt-Date.now());
        const timeReady=delay?new Promise(resolve=>setTimeout(resolve,delay)):Promise.resolve();
        const animationReady=ticket.gate&&!ticket.gate.done?ticket.gate.promise:Promise.resolve();
        Promise.all([timeReady,animationReady]).then(()=>{
            if(state.completedBoundaries.indexOf(key)>=0){ return; }
            if(typeof battleActive!=="undefined"&&!battleActive){ return; }
            if(typeof battleToken!=="undefined"&&ticket.token!==battleToken){ return; }
            rememberBoundary(key);
            state.metrics.boundariesAdvanced++;
            if(state.tickets[kind]===ticket){ state.tickets[kind]=null; }
            invoke();
        });
    }

    function resolveDelay(index){
        return typeof initiativeQueue!=="undefined"&&index>=initiativeQueue.length
            ?CURRENT_ROUND_HANDOFF_MS:CURRENT_RESOLVE_DELAY_MS;
    }

    function partyDefeated(){
        if(typeof getPartyCharacterByIndex!=="function"){ return false; }
        let found=false;
        let alive=false;
        for(let index=0;index<3;index++){
            const character=getPartyCharacterByIndex(index);
            if(character){ found=true; if(character.hp>0){ alive=true; } }
        }
        return found&&!alive;
    }

    function monstersDefeated(){
        if(typeof currentBattleMonsters==="undefined"||!Array.isArray(currentBattleMonsters)||!currentBattleMonsters.length){ return false; }
        return !currentBattleMonsters.some(index=>typeof monsters!=="undefined"&&monsters[index]&&monsters[index].alive);
    }

    const terminalLocks=new Set();
    if(typeof finishPlayerAction==="function"){
        const previous=finishPlayerAction;
        finishPlayerAction=function(){
            const gate=currentGate();
            if((partyDefeated()||monstersDefeated())&&gate&&!gate.done){
                const lock="terminal|"+gate.id;
                if(terminalLocks.has(lock)){ return; }
                terminalLocks.add(lock);
                const that=this;
                const args=arguments;
                gate.promise.then(()=>{
                    terminalLocks.delete(lock);
                    if(typeof battleActive!=="undefined"&&!battleActive){ return; }
                    previous.apply(that,args);
                });
                return;
            }

            const phase=typeof battlePhase!=="undefined"?battlePhase:null;
            const token=typeof battleToken!=="undefined"?battleToken:null;
            const beforeDeclare=typeof activeBattleCharacterIndex!=="undefined"?activeBattleCharacterIndex:null;
            const beforeResolve=typeof initiativeIndex!=="undefined"?initiativeIndex:null;
            const calledAt=Date.now();
            const delayOverride=typeof window!=="undefined"&&Number.isFinite(Number(window.__battleAdvanceDelayOverrideMs))
                ?Math.max(0,Number(window.__battleAdvanceDelayOverrideMs)):null;
            const result=previous.apply(this,arguments);
            const actionGate=currentGate();
            const boundaryGate=delayOverride===null?actionGate:null;

            if(phase==="declare"&&typeof activeBattleCharacterIndex!=="undefined"&&activeBattleCharacterIndex!==beforeDeclare){
                state.tickets.declare={
                    token:token,round:typeof turn!=="undefined"?turn:0,index:activeBattleCharacterIndex,
                    gate:boundaryGate,gateId:boundaryGate?boundaryGate.id:"none",
                    earliestAt:Math.max(
                        calledAt+(delayOverride===null?CURRENT_DECLARE_DELAY_MS:delayOverride),
                        boundaryGate?boundaryGate.deadline:0
                    ),
                    consumed:false
                };
            }else if(phase==="resolve"&&typeof initiativeIndex!=="undefined"&&initiativeIndex!==beforeResolve){
                const roundEnded=typeof initiativeQueue!=="undefined"&&initiativeIndex>=initiativeQueue.length;
                state.roundGate=roundEnded&&boundaryGate
                    ?{token:token,gate:boundaryGate,consumed:false}
                    :null;
                state.tickets.resolve={
                    token:token,round:typeof turn!=="undefined"?turn:0,index:initiativeIndex,
                    /* The last combatant must also hold processNextCombatant.
                       Waiting only inside beginCharacterTurn was too late:
                       startTurn had already switched to declare and exposed
                       the manual HUD while the last animation was playing. */
                    gate:boundaryGate,
                    gateId:boundaryGate?boundaryGate.id:"none",
                    earliestAt:Math.max(
                        calledAt+(delayOverride===null?resolveDelay(initiativeIndex):delayOverride),
                        boundaryGate?boundaryGate.deadline:0
                    ),
                    consumed:false
                };
            }
            return result;
        };
    }

    if(typeof beginCharacterTurn==="function"){
        const previous=beginCharacterTurn;
        beginCharacterTurn=function(token){
            const ticket=state.tickets.declare;
            if(ticket&&ticket.token===token&&typeof activeBattleCharacterIndex!=="undefined"&&ticket.index===activeBattleCharacterIndex){
                const that=this;
                const args=arguments;
                runTicket("declare",ticket,()=>previous.apply(that,args));
                return;
            }
            const roundGate=state.roundGate;
            if(roundGate&&roundGate.token===token){
                if(!roundGate.gate||roundGate.gate.done){
                    state.roundGate=null;
                    return previous.apply(this,arguments);
                }
                if(roundGate.consumed){
                    state.metrics.duplicateBoundariesBlocked++;
                    return;
                }
                roundGate.consumed=true;
                const that=this;
                const args=arguments;
                roundGate.gate.promise.then(()=>{
                    if(state.roundGate!==roundGate){ return; }
                    state.roundGate=null;
                    if(typeof battleActive!=="undefined"&&!battleActive){ return; }
                    if(typeof battleToken!=="undefined"&&token!==battleToken){ return; }
                    previous.apply(that,args);
                });
                return;
            }
            return previous.apply(this,arguments);
        };
    }

    if(typeof processNextCombatant==="function"){
        const previous=processNextCombatant;
        processNextCombatant=function(token){
            const ticket=state.tickets.resolve;
            if(ticket&&ticket.token===token&&typeof initiativeIndex!=="undefined"&&ticket.index===initiativeIndex){
                const that=this;
                const args=arguments;
                runTicket("resolve",ticket,()=>previous.apply(that,args));
                return;
            }
            return previous.apply(this,arguments);
        };
    }

    function emperorAllies(){
        if(typeof currentBattleMonsters==="undefined"||typeof monsters==="undefined"){ return []; }
        return currentBattleMonsters.map(index=>monsters[index]).filter(monster=>monster&&monster.alive);
    }

    function baseMaxHp(monster){
        return monster&&monster.v141Shield
            ?Number(monster.v141Shield.baseMaxHP)||Number(monster.maxHP)||0
            :Number(monster&&monster.maxHP)||0;
    }

    function baseHp(monster){
        const shield=monster&&monster.v141Shield?Math.max(0,Number(monster.v141Shield.remaining)||0):0;
        return Math.max(0,(Number(monster&&monster.hp)||0)-shield);
    }

    function restoreSp(monster,amount){
        const max=Math.max(0,Number(monster&&monster.maxSP)||Number(monster&&monster.sp)||0);
        const before=Math.max(0,Number(monster&&monster.sp)||0);
        monster.sp=Math.min(max,before+amount);
        return monster.sp-before;
    }

    function clearNegativeStates(monster){
        const removed=Array.isArray(monster&&monster.statusEffects)?monster.statusEffects.length:0;
        if(monster){ monster.statusEffects=[]; }
        return removed;
    }

    function applyBlessing(monster){
        if(!monster||!monster.alive){ return; }
        let blessing=monster.v142AgilityBlessing;
        if(!blessing){
            const original=Math.max(0,Number(monster.agility)||0);
            const display={type:"v141TeamBuff",v141BuffType:"agility",turnsLeft:2};
            blessing={originalAgility:original,turnsLeft:2,displayBuff:display};
            monster.v142AgilityBlessing=blessing;
            monster.agility=Math.round(original*1.75);
            monster.activeBuffs=monster.activeBuffs||[];
            monster.activeBuffs.push(display);
        }else{
            blessing.turnsLeft=2;
            blessing.displayBuff.turnsLeft=2;
        }
    }

    function castExtremeEmperorSkill(monsterIndex,forcedSkillId){
        const monster=typeof monsters!=="undefined"?monsters[monsterIndex]:null;
        if(!monster||!monster.alive||monster.name!=="極帝天尊"){ return false; }
        if(
            (typeof isMonsterFrozen==="function"&&isMonsterFrozen(monster))||
            (typeof isMonsterPetrified==="function"&&isMonsterPetrified(monster))
        ){ return false; }
        const allies=emperorAllies();
        if(!allies.length){ return false; }

        const anyNegative=allies.some(ally=>Array.isArray(ally.statusEffects)&&ally.statusEffects.length);
        const anyInjured=allies.some(ally=>baseHp(ally)<baseMaxHp(ally));
        const anySpGap=allies.some(ally=>Math.max(0,(Number(ally.maxSP)||0)-(Number(ally.sp)||0))>=95);
        const anyShieldless=allies.some(ally=>!(ally.v141Shield&&Number(ally.v141Shield.remaining)>0));
        const allBlessed=allies.every(ally=>ally.v142AgilityBlessing&&ally.v142AgilityBlessing.turnsLeft>0);

        let skillId=forcedSkillId||null;
        if(!skillId){
            if(anyNegative){ skillId="yuanZuBlessing"; }
            else if(anyInjured||anySpGap){ skillId="yuanXiangGuangMing"; }
            else if(anyShieldless){ skillId="yuanGuangShield"; }
            else if(!allBlessed){ skillId="yuanZuBlessing"; }
            else{ return false; }
        }
        const skill=typeof skillDatabase!=="undefined"?skillDatabase[skillId]:null;
        if(!skill){ return false; }
        const cost=Math.max(0,Number(skill.spCost)||0);
        if((Number(monster.sp)||0)<cost){ return false; }
        monster.sp=Math.max(0,(Number(monster.sp)||0)-cost);
        if(typeof showMonsterSkillNameBadge==="function"){
            showMonsterSkillNameBadge(skill.name,skill.element||"light",monsterIndex);
        }

        if(skillId==="yuanXiangGuangMing"){
            let hpTotal=0;
            let spTotal=0;
            allies.forEach(ally=>{
                const healed=typeof window.v141HealMonsterPreservingShield==="function"
                    ?window.v141HealMonsterPreservingShield(ally,350)
                    :(function(){
                        const before=Number(ally.hp)||0;
                        ally.hp=Math.min(Number(ally.maxHP)||before,before+350);
                        return ally.hp-before;
                    })();
                hpTotal+=healed;
                spTotal+=restoreSp(ally,95);
            });
            if(typeof addBattleLog==="function"){
                addBattleLog(monster.name+"施放元相光明，我方全體回復350 HP、95 SP（實際 "+hpTotal+" HP／"+spTotal+" SP）。");
            }
        }else if(skillId==="yuanGuangShield"){
            allies.forEach(ally=>{
                if(typeof window.v141ApplyMonsterShield==="function"){ window.v141ApplyMonsterShield(ally,200,2); }
                else{
                    ally.v141Shield={remaining:200,turnsLeft:2,baseMaxHP:ally.maxHP,baseHp:ally.hp};
                    ally.hp=(Number(ally.hp)||0)+200;
                }
            });
            if(typeof addBattleLog==="function"){
                addBattleLog(monster.name+"施放元光護體，我方全體獲得200護盾，持續2回合。");
            }
        }else if(skillId==="yuanZuBlessing"){
            let removed=0;
            allies.forEach(ally=>{ removed+=clearNegativeStates(ally); applyBlessing(ally); });
            if(typeof addBattleLog==="function"){
                addBattleLog(monster.name+"施放元祖賜福，我方全體解除"+removed+"個負面狀態並提升75%敏捷，持續2回合。");
            }
        }else{
            return false;
        }

        if(typeof updateUI==="function"){ updateUI(); }
        if(typeof finishPlayerAction==="function"){ finishPlayerAction(); }
        return true;
    }

    window.v142ResolveExtremeEmperorAction=castExtremeEmperorSkill;

    if(typeof window.v141TryMonsterSpecialAction==="function"){
        const previous=window.v141TryMonsterSpecialAction;
        window.v141TryMonsterSpecialAction=function(monsterIndex){
            const monster=typeof monsters!=="undefined"?monsters[monsterIndex]:null;
            if(monster&&monster.name==="極帝天尊"){
                monster.v141SupportSkillIds=Array.from(new Set((monster.v141SupportSkillIds||[]).concat([
                    "yuanXiangGuangMing","yuanGuangShield","yuanZuBlessing"
                ])));
                if(castExtremeEmperorSkill(monsterIndex)){ return true; }
            }
            return previous.apply(this,arguments);
        };
    }

    let lastBlessingTick="";
    if(typeof startTurn==="function"){
        const previous=startTurn;
        startTurn=function(token){
            const key=String(token)+":"+String(typeof turn!=="undefined"?turn:"");
            if(key!==lastBlessingTick){
                lastBlessingTick=key;
                emperorAllies().forEach(monster=>{
                    const blessing=monster.v142AgilityBlessing;
                    if(!blessing){ return; }
                    if(typeof turn!=="undefined"&&turn>1){ blessing.turnsLeft--; }
                    blessing.displayBuff.turnsLeft=blessing.turnsLeft;
                    if(blessing.turnsLeft>0){ return; }
                    monster.agility=blessing.originalAgility;
                    monster.activeBuffs=(monster.activeBuffs||[]).filter(buff=>buff!==blessing.displayBuff);
                    delete monster.v142AgilityBlessing;
                });
            }
            return previous.apply(this,arguments);
        };
    }

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
