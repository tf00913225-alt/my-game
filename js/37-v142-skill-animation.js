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
    const CURRENT_DECLARE_DELAY_MS=90;
    const CURRENT_RESOLVE_DELAY_MS=1600;
    const CURRENT_ROUND_HANDOFF_MS=400;

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
        tickets:{declare:null,resolve:null},roundGate:null,completedBoundaries:[],
        metrics:{
            version:VERSION,started:0,completed:0,superseded:0,
            boundariesAdvanced:0,duplicateBoundariesBlocked:0,last:null
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
            config:config,startedAt:Date.now(),deadline:0,done:false,reason:null,
            completionCount:0,promise:null,complete:null
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

        /* V142 is intentionally visual-free. V143 replaces director.play and
           passes render:false while it renders the formal image Sprite Sheet.
           If V143 is unavailable, timing still completes without a substitute VFX. */
        if(meta.render!==false){
            state.fallbackTimer=setTimeout(
                ()=>gate.complete("v142-timing-only"),
                Math.max(0,Number(config.resolveDuration)||Number(config.duration)||0)
            );
            if(typeof document!=="undefined"&&document.addEventListener){
                state.visibilityHandler=function(){
                    if(!document.hidden&&Date.now()>=gate.deadline){ gate.complete("visibility-resume"); }
                };
                document.addEventListener("visibilitychange",state.visibilityHandler);
            }
        }
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

    function startFromBadge(side,name,element,actorIndex){
        if(typeof battleActive!=="undefined"&&!battleActive){ return null; }
        const config=animationConfig(null,name,element);
        if(config.category==="passive"||config.targetType==="none"){ return null; }
        return director.play(config,{
            side:side,actorIndex:Number.isInteger(actorIndex)?actorIndex:0,
            key:identity(side,name,actorIndex)
        });
    }
    window.v142PlaySkillAnimationFromBadge=function(side,name,element,actorIndex){
        return startFromBadge(side,name,element,actorIndex);
    };

    function currentGate(){
        const gate=state.latest;
        if(!gate){ return null; }
        if(typeof battleToken!=="undefined"&&gate.battleToken!==null&&gate.battleToken!==battleToken){ return null; }
        return gate;
    }

    function rememberBoundary(key){
        state.completedBoundaries.push(key);
        if(state.completedBoundaries.length>48){
            state.completedBoundaries.splice(0,state.completedBoundaries.length-48);
        }
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
        let found=false,alive=false;
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
                const that=this,args=arguments;
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
                state.roundGate=roundEnded&&boundaryGate?{token:token,gate:boundaryGate,consumed:false}:null;
                state.tickets.resolve={
                    token:token,round:typeof turn!=="undefined"?turn:0,index:initiativeIndex,
                    gate:boundaryGate,gateId:boundaryGate?boundaryGate.id:"none",
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
                const that=this,args=arguments;
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
                const that=this,args=arguments;
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
                const that=this,args=arguments;
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
            const display={type:"v141TeamBuff",v141BuffType:"agility",turnsLeft:2,statusName:"元祖賜福"};
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
            let hpTotal=0,spTotal=0;
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
