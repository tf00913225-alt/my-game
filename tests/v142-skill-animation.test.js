"use strict";

/* HISTORICAL SPEC SNAPSHOT (V142): 只保留該版驗收紀錄；V170 最終規格以 v170-final-spec-integration.test.js 為準。 */

const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const source=fs.readFileSync("js/37-v142-skill-animation.js","utf8");
const css=fs.readFileSync("css/39-v142-skill-animation.css","utf8");
const loader=fs.readFileSync("js/20-anonymous-20.js","utf8");
const index=fs.readFileSync("index.html","utf8");

let passed=0;
function test(name,handler){
    return Promise.resolve().then(handler).then(()=>{
        passed++;
        console.log("✓ "+name);
    });
}

function makeSkillDatabase(){
    return {
        flameSlash:{id:"flameSlash",name:"火焰斬",element:"fire",category:"physical",targetType:"single",tier:1},
        explosiveFlurry:{id:"explosiveFlurry",name:"火爆亂擊",element:"fire",category:"physical",targetType:"tri",tier:2},
        phoenixCry:{id:"phoenixCry",name:"火鳳天鳴",element:"fire",category:"magic",targetType:"all",tier:4},
        frostCrush:{id:"frostCrush",name:"冰封重擊",element:"water",category:"physical",targetType:"single",tier:3},
        stormRain:{id:"stormRain",name:"風起雲湧",element:"wind",category:"magic",targetType:"all",tier:4},
        dustStorm:{id:"dustStorm",name:"地牛猛襲",element:"earth",category:"magic",targetType:"all",tier:4},
        healSpell:{id:"healSpell",name:"治療術",element:"water",category:"heal",targetType:"ally",tier:3},
        yuanXiangGuangMing:{
            id:"yuanXiangGuangMing",name:"元相光明",element:"light",
            category:"heal",targetType:"allyAll",spCost:35,baseHeal:350
        },
        yuanGuangShield:{
            id:"yuanGuangShield",name:"元光護體",element:"light",
            category:"buff",targetType:"allyAll",spCost:40,shieldAmount:200,shieldDuration:2
        }
    };
}

function createScheduler(){
    let now=0;
    let nextId=1;
    const timers=new Map();
    return {
        Date:{now:()=>now},
        setTimeout(handler,delay){
            const id=nextId++;
            timers.set(id,{handler,at:now+Math.max(0,Number(delay)||0)});
            return id;
        },
        clearTimeout(id){ timers.delete(id); },
        advance(target){
            now=target;
            let progressed=true;
            while(progressed){
                progressed=false;
                [...timers.entries()]
                    .filter(([,timer])=>timer.at<=now)
                    .sort((a,b)=>a[1].at-b[1].at)
                    .forEach(([id,timer])=>{
                        if(!timers.has(id)){ return; }
                        timers.delete(id);
                        timer.handler();
                        progressed=true;
                    });
            }
        },
        now:()=>now
    };
}

function createContext(options={}){
    const scheduler=options.scheduler||createScheduler();
    const logs=[];
    const calls={finish:0,process:0,begin:0,startTurn:0,previousSpecial:0};
    const context={
        console,
        Math,
        Promise,
        Set,
        Map,
        Array,
        Object,
        Number,
        String,
        Boolean,
        RegExp,
        Date:scheduler.Date,
        setTimeout:scheduler.setTimeout,
        clearTimeout:scheduler.clearTimeout,
        requestAnimationFrame:handler=>scheduler.setTimeout(()=>handler(scheduler.now()),16),
        cancelAnimationFrame:scheduler.clearTimeout,
        navigator:{deviceMemory:4,hardwareConcurrency:4},
        document:{
            hidden:false,
            getElementById(){ return null; },
            addEventListener(){},
            removeEventListener(){}
        },
        skillDatabase:makeSkillDatabase(),
        battleActive:options.battleActive!==undefined?options.battleActive:true,
        battleToken:7,
        turn:1,
        battlePhase:"resolve",
        initiativeIndex:0,
        initiativeQueue:[{type:"player"},{type:"monster"}],
        activeBattleCharacterIndex:0,
        queuedPlayerActions:[],
        currentBattleMonsters:[],
        monsters:[],
        showSkillNameBadge(){},
        showMonsterSkillNameBadge(){},
        beginCharacterTurn(){ calls.begin++; },
        processNextCombatant(token){
            calls.process++;
            if(typeof context.onProcess==="function"){ context.onProcess(token); }
            if(options.roundFlow&&context.initiativeIndex>=context.initiativeQueue.length){
                context.startTurn(token);
            }
        },
        finishPlayerAction(){
            calls.finish++;
            if(context.battlePhase==="declare"){
                context.activeBattleCharacterIndex++;
                scheduler.setTimeout(()=>context.beginCharacterTurn(context.battleToken),90);
            }else{
                context.initiativeIndex++;
                const delay=context.initiativeIndex>=context.initiativeQueue.length?400:1600;
                scheduler.setTimeout(()=>context.processNextCombatant(context.battleToken),delay);
            }
        },
        startTurn(token){
            calls.startTurn++;
            if(options.roundFlow){ context.beginCharacterTurn(token); }
        },
        checkBattleEnd(){ return false; },
        getPartyCharacterByIndex(index){ return index===0?{hp:100}:null; },
        isMonsterFrozen(){ return false; },
        isMonsterPetrified(){ return false; },
        addBattleLog(message){ logs.push(message); },
        updateUI(){},
        v141TryMonsterSpecialAction(){ calls.previousSpecial++; return false; }
    };
    context.window=context;
    context.addEventListener=function(){};
    context.matchMedia=()=>({matches:false});
    context.v141HealMonsterPreservingShield=function(monster,amount){
        const shield=monster.v141Shield?monster.v141Shield.remaining:0;
        const max=monster.v141Shield?monster.v141Shield.baseMaxHP:monster.maxHP;
        const base=Math.max(0,monster.hp-shield);
        const healed=Math.max(0,Math.min(amount,max-base));
        monster.hp=base+healed+shield;
        return healed;
    };
    context.v141ApplyMonsterShield=function(monster,amount,turns){
        const baseHp=monster.v141Shield?monster.hp-monster.v141Shield.remaining:monster.hp;
        monster.v141Shield={remaining:amount,turnsLeft:turns,baseMaxHP:monster.maxHP,baseHp};
        monster.hp=baseHp+amount;
    };
    vm.createContext(context);
    vm.runInContext(source,context);
    return {context,scheduler,calls,logs};
}

(async()=>{
    await test("V142 assets are versioned and loaded after V141",()=>{
        assert.match(loader,/const V_ASSET_VERSION="173\.57"/);
        assert.match(loader,/css\/39-v142-skill-animation\.css/);
        assert.match(loader,/js\/36-v141-content-systems\.js[\s\S]*js\/37-v142-skill-animation\.js/);
        assert.match(index,/js\/20-anonymous-20\.js\?v=173\.57/);
    });

    await test("player and monster skill badges actually start animation gates",()=>{
        const {context}=createContext();
        context.showSkillNameBadge("火焰斬","fire",0);
        assert.equal(context.v142SkillAnimationDirector.getLatest().config.name,"火焰斬");
        assert.equal(context.v142GetAnimationDiagnostics().last.side,"player");
        context.showMonsterSkillNameBadge("火焰斬","fire",0);
        assert.equal(context.v142SkillAnimationDirector.getLatest().config.name,"火焰斬");
        assert.equal(context.v142GetAnimationDiagnostics().last.side,"monster");
    });

    await test("normal, small and ultimate skills keep distinct durations",()=>{
        const {context}=createContext({battleActive:false});
        assert.equal(context.v142GetSkillAnimationConfig("normal").duration,520);
        assert.equal(context.v142GetSkillAnimationConfig("flameSlash").duration,760);
        assert.equal(context.v142GetSkillAnimationConfig("explosiveFlurry").duration,1450);
        assert.equal(context.v142GetSkillAnimationConfig("phoenixCry").duration,3200);
        assert.equal(context.skillDatabase.phoenixCry.resolveDuration,3200);
        assert.equal(context.v142GetSkillNameDisplayDuration("普通攻擊","normal"),347);
        assert.equal(context.v142GetSkillNameDisplayDuration("火焰斬","fire"),507);
        assert.equal(context.v142GetSkillNameDisplayDuration("火鳳天鳴","fire"),2133);
    });

    await test("an animation gate resolves exactly once",async()=>{
        const {context}=createContext({battleActive:false});
        let completions=0;
        const gate=context.v142CreateAnimationGateForTest(50,()=>{ completions++; });
        assert.equal(gate.complete("animationend"),true);
        assert.equal(gate.complete("fallback"),false);
        assert.equal(gate.complete("visibility-resume"),false);
        await Promise.resolve();
        assert.equal(gate.completionCount,1);
        assert.equal(completions,1);
    });

    await test("long battles reuse the director without leaving an active action",()=>{
        const {context}=createContext({battleActive:false});
        const config=context.v142GetSkillAnimationConfig("flameSlash");
        for(let index=0;index<200;index++){
            const gate=context.v142SkillAnimationDirector.play(config,{
                side:index%2?"monster":"player",
                actorIndex:index%3,
                key:"long-battle-"+index,
                render:false
            });
            assert.equal(gate.complete("animationend"),true);
        }
        const metrics=context.v142GetAnimationDiagnostics();
        assert.equal(metrics.started,200);
        assert.equal(metrics.completed,200);
        assert.equal(metrics.active,false);
    });

    await test("large skills block initiative until animation completion",async()=>{
        const {context,scheduler,calls}=createContext();
        const config=context.v142GetSkillAnimationConfig("phoenixCry");
        const gate=context.v142SkillAnimationDirector.play(config,{side:"player",actorIndex:0,render:false});
        context.finishPlayerAction();
        scheduler.advance(1600);
        context.processNextCombatant(7);
        await Promise.resolve();
        assert.equal(calls.process,0,"initiative must not advance at the old fixed delay");
        scheduler.advance(3199);
        await Promise.resolve();
        assert.equal(calls.process,0);
        scheduler.advance(3200);
        gate.complete("animationend");
        await Promise.resolve();
        await Promise.resolve();
        assert.equal(calls.process,1);
        assert.equal(context.v142GetAnimationDiagnostics().duplicateBoundariesBlocked>=1,true);
    });

    await test("the next action can issue its own independent gate",async()=>{
        const {context,scheduler,calls}=createContext();
        context.initiativeQueue=[{type:"player"},{type:"monster"},{type:"player"}];
        const first=context.v142SkillAnimationDirector.play(
            context.v142GetSkillAnimationConfig("flameSlash"),
            {side:"player",actorIndex:0,render:false}
        );
        let second=null;
        context.onProcess=function(){
            context.onProcess=null;
            second=context.v142SkillAnimationDirector.play(
                context.v142GetSkillAnimationConfig("phoenixCry"),
                {side:"monster",actorIndex:1,render:false}
            );
            context.finishPlayerAction();
        };
        context.finishPlayerAction();
        scheduler.advance(760);
        first.complete("animationend");
        scheduler.advance(1600);
        await Promise.resolve();
        await Promise.resolve();
        assert.equal(calls.process,1);
        assert.ok(second);
        scheduler.advance(3200);
        await Promise.resolve();
        assert.equal(calls.process,1,"second action is still animating");
        scheduler.advance(4800);
        second.complete("animationend");
        await Promise.resolve();
        await Promise.resolve();
        assert.equal(calls.process,2);
    });

    await test("simple skills do not add delay beyond the existing 1.6 second cadence",async()=>{
        const {context,scheduler,calls}=createContext();
        const gate=context.v142SkillAnimationDirector.play(
            context.v142GetSkillAnimationConfig("flameSlash"),
            {side:"player",actorIndex:0,render:false}
        );
        context.finishPlayerAction();
        scheduler.advance(760);
        gate.complete("animationend");
        scheduler.advance(1599);
        await Promise.resolve();
        assert.equal(calls.process,0);
        scheduler.advance(1600);
        await Promise.resolve();
        await Promise.resolve();
        assert.equal(calls.process,1);
    });

    await test("completed boundaries stay unique when a later round reuses the last gate",async()=>{
        const {context,scheduler,calls}=createContext();
        const gate=context.v142SkillAnimationDirector.play(
            context.v142GetSkillAnimationConfig("flameSlash"),
            {side:"player",actorIndex:0,render:false}
        );
        gate.complete("animationend");

        context.finishPlayerAction();
        scheduler.advance(1600);
        await Promise.resolve();
        await Promise.resolve();
        assert.equal(calls.process,1);

        context.turn=2;
        context.initiativeIndex=0;
        context.finishPlayerAction();
        scheduler.advance(3200);
        await Promise.resolve();
        await Promise.resolve();
        assert.equal(calls.process,2,"a repeated gate id in round two must still advance combat");
    });

    await test("round handoff cannot expose the next manual turn before the final animation ends",async()=>{
        const {context,scheduler,calls}=createContext({roundFlow:true});
        context.initiativeQueue=[{type:"player"}];
        const gate=context.v142SkillAnimationDirector.play(
            context.v142GetSkillAnimationConfig("flameSlash"),
            {side:"player",actorIndex:0,render:false}
        );
        context.finishPlayerAction();
        scheduler.advance(400);
        await Promise.resolve();
        await Promise.resolve();
        assert.equal(calls.startTurn,0,"startTurn must remain gated while the final animation is active");
        assert.equal(calls.begin,0,"the next actor may not begin while the prior animation is active");
        scheduler.advance(760);
        gate.complete("animationend");
        await Promise.resolve();
        await Promise.resolve();
        assert.equal(calls.startTurn,1);
        assert.equal(calls.begin,1);
    });

    await test("auto/declare actions also wait for their own animation",async()=>{
        const {context,scheduler,calls}=createContext();
        context.battlePhase="declare";
        const gate=context.v142SkillAnimationDirector.play(
            context.v142GetSkillAnimationConfig("flameSlash"),
            {side:"player",actorIndex:0,render:false}
        );
        context.finishPlayerAction();
        scheduler.advance(90);
        await Promise.resolve();
        assert.equal(calls.begin,0);
        scheduler.advance(760);
        gate.complete("animationend");
        await Promise.resolve();
        await Promise.resolve();
        assert.equal(calls.begin,1);
    });

    await test("background resume completes an expired action without double resolve",async()=>{
        const {context,scheduler}=createContext();
        let completions=0;
        const gate=context.v142SkillAnimationDirector.play(
            context.v142GetSkillAnimationConfig("flameSlash"),
            {render:false,onComplete:()=>{ completions++; }}
        );
        scheduler.advance(800);
        context.v142SkillAnimationDirector.notifyVisibilityReturn();
        context.v142SkillAnimationDirector.notifyVisibilityReturn();
        await Promise.resolve();
        assert.equal(gate.reason,"visibility-resume");
        assert.equal(completions,1);
    });

    await test("player and monster badge hooks share one director and cleanup path",()=>{
        assert.match(source,/showSkillNameBadge=function/);
        assert.match(source,/showMonsterSkillNameBadge=function/);
        assert.match(source,/animationend/);
        assert.match(source,/cancelAnimationFrame/);
        assert.match(source,/removeEventListener\("visibilitychange"/);
        assert.match(source,/registerRenderer/);
        assert.match(css,/v142ActionClock/);
        assert.match(css,/data-style="dragon"/);
        assert.match(css,/data-style="phoenix"/);
        assert.match(css,/data-style="earthquake"/);
    });

    await test("元相光明 heals 350 HP and restores 95 SP to every living ally",()=>{
        const {context}=createContext({battleActive:false});
        const emperor={name:"極帝天尊",alive:true,hp:1000,maxHP:1000,sp:300,maxSP:500,agility:100,statusEffects:[]};
        const ally={name:"天兵",alive:true,hp:100,maxHP:1000,sp:20,maxSP:200,agility:80,statusEffects:[]};
        context.monsters=[emperor,ally];
        context.currentBattleMonsters=[0,1];
        assert.equal(context.v142ResolveExtremeEmperorAction(0,"yuanXiangGuangMing"),true);
        assert.equal(ally.hp,450);
        assert.equal(ally.sp,115);
        assert.equal(emperor.sp,360,"caster pays 35 SP, then receives the shared 95 SP heal");
    });

    await test("元光護體 gives all allies a 200 shield for two turns",()=>{
        const {context}=createContext({battleActive:false});
        const emperor={name:"極帝天尊",alive:true,hp:1000,maxHP:1000,sp:300,maxSP:500,agility:100,statusEffects:[]};
        const ally={name:"天兵",alive:true,hp:700,maxHP:1000,sp:100,maxSP:200,agility:80,statusEffects:[]};
        context.monsters=[emperor,ally];
        context.currentBattleMonsters=[0,1];
        assert.equal(context.v142ResolveExtremeEmperorAction(0,"yuanGuangShield"),true);
        assert.equal(emperor.v141Shield.remaining,200);
        assert.equal(ally.v141Shield.remaining,200);
        assert.equal(ally.v141Shield.turnsLeft,2);
    });

    await test("元祖賜福 cleanses all debuffs and applies/restores 75% agility for two turns",()=>{
        const {context}=createContext({battleActive:false});
        const emperor={name:"極帝天尊",alive:true,hp:1000,maxHP:1000,sp:300,maxSP:500,agility:100,statusEffects:[{type:"burn"}],activeBuffs:[]};
        const ally={name:"天兵",alive:true,hp:700,maxHP:1000,sp:100,maxSP:200,agility:80,statusEffects:[{type:"freeze"},{type:"defenseDown"}],activeBuffs:[]};
        context.monsters=[emperor,ally];
        context.currentBattleMonsters=[0,1];
        assert.equal(context.v142ResolveExtremeEmperorAction(0,"yuanZuBlessing"),true);
        assert.equal(emperor.statusEffects.length,0);
        assert.equal(ally.statusEffects.length,0);
        assert.equal(emperor.agility,175);
        assert.equal(ally.agility,140);
        assert.equal(ally.v142AgilityBlessing.turnsLeft,2);
        context.turn=2;
        context.startTurn(7);
        assert.equal(ally.v142AgilityBlessing.turnsLeft,1);
        context.turn=3;
        context.startTurn(7);
        assert.equal(ally.agility,80);
        assert.equal(ally.v142AgilityBlessing,undefined);
    });

    console.log("\nV142 skill animation suite: "+passed+" tests passed.");
})().catch(error=>{
    console.error(error);
    process.exitCode=1;
});
