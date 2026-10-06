"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const main=fs.readFileSync("js/00-main.js","utf8");
const follow=fs.readFileSync("js/43-v149-skill-ui-rules.js","utf8");
function declaration(name){
    const match=main.match(new RegExp("^function "+name+"\\([\\s\\S]*?^\\}","m"));
    assert.ok(match,"missing core owner "+name);return match[0];
}
for(const shape of ["single","tri","row","column","all"]){
    test(shape+" planning excludes dead ally even after revival",()=>{
        const r=runtime({hp:[0,100,100],shape});const snapshot=r.plan();
        assert.deepEqual(Array.from(snapshot.targets,e=>e.index),[1,2]);
        assert.ok(Object.isFrozen(snapshot)&&Object.isFrozen(snapshot.targets));
        r.party[0].hp=100;r.setRandom(.9);r.ctx.processSingleMonsterAttack(0,7,snapshot);r.flush();
        assert.ok(r.hits.length>0);assert.ok(!r.hits.includes(0));assert.equal(r.party[0].hp,100);
        if(shape==="single")assert.deepEqual(r.hits,[1,1]);
    });
}
test("random planning can select every living ally, resolution never rerolls",()=>{
    for(const [roll,index] of [[0,0],[.4,1],[.99,2]]){
        const r=runtime();r.setRandom(roll);const snapshot=r.plan();r.setRandom(0);
        r.ctx.processSingleMonsterAttack(0,7,snapshot);r.flush();assert.deepEqual(r.hits,[index,index]);
    }
});
test("primary dying before resolution cancels instead of selecting a revived ally",()=>{
    const r=runtime({hp:[0,100,100]});const snapshot=r.plan();
    r.party[1].hp=0;r.party[0].hp=100;r.ctx.processSingleMonsterAttack(0,7,snapshot);r.flush();
    assert.deepEqual(r.hits,[]);assert.equal(r.finishes,1);assert.equal(r.ctx.monsters[0].sp,100);
});
test("reused party index cannot replace captured identity",()=>{
    const r=runtime();const snapshot=r.plan();r.party[0]={hp:100};
    r.ctx.processSingleMonsterAttack(0,7,snapshot);r.flush();assert.deepEqual(r.hits,[]);
});
test("late stealth invalidates primary without silent fallback",()=>{
    const r=runtime();const snapshot=r.plan();r.party[0].stealth=true;
    r.ctx.processSingleMonsterAttack(0,7,snapshot);r.flush();assert.deepEqual(r.hits,[]);
});
test("all may affect stealthed original roster, targeted attacks may not select it",()=>{
    const r=runtime({shape:"all"});r.party.forEach(p=>p.stealth=true);const snapshot=r.plan();
    r.ctx.processSingleMonsterAttack(0,7,snapshot);r.flush();assert.deepEqual(r.hits,[0,1,2,0,1,2]);
});
for(const boundary of ["cancel","new-battle","new-round","replaced-monster"]){
    test("pending follow-up discarded on "+boundary,()=>{
        const r=runtime();r.ctx.processSingleMonsterAttack(0,7);
        if(boundary==="cancel")r.ctx.battleActive=false;
        if(boundary==="new-battle")r.ctx.battleToken++;
        if(boundary==="new-round")r.ctx.turn++;
        if(boundary==="replaced-monster")r.ctx.monsters[0]={...r.ctx.monsters[0]};
        r.flush();assert.deepEqual(r.hits,[0]);assert.equal(r.finishes,0,"old callback cannot finish new action");
    });
}
test("manual and auto share queue snapshot handoff",()=>{
    assert.match(declaration("startResolutionPhase"),/entry\.targetSnapshot=createEnemyActionTargetSnapshot/);
    assert.match(declaration("processNextCombatant"),/processSingleMonsterAttack\(\s*entry\.monsterIndex,\s*token,\s*entry\.targetSnapshot/);
    assert.doesNotMatch(declaration("processSingleMonsterAttack"),/Math\.random\(\)\*selectablePrimaryTargets/);
});
function runtime({hp=[100,100,100],damage=10,shape="single",rank="regular",wrap=true,skillId="fireCritical",maxCasts=1,critical=true}={}){
    const party=hp.map((value,index)=>({id:"ally"+index,hp:value,level:50,element:"water",activeBuffs:[],statusEffects:[]}));
    const timers=[],hits=[],badges=[],logs=[],interceptors=[];let finishes=0,random=0;
    const math=Object.create(Math);math.random=()=>random;
    const noop=()=>{};
    const ctx={console,Math:math,Number,Object,Array,Set,Map,Promise,Date,
        battleActive:true,battleToken:7,turn:1,battleDurationAction:null,combatEventObservers:new Map(),combatDamageFacts:new WeakMap(),currentZone:"qa",initiativeQueue:[],initiativeIndex:0,
        monsters:[{id:"enemy",name:"enemy",hp:1000,alive:true,level:50,element:"fire",rank,sp:100,skillIds:[skillId],skillChance:1}],
        currentBattleMonsters:[0],skillDatabase:{[skillId]:{id:skillId,name:"烈焰爆擊",element:"fire",spCost:10,maxLevel:10,category:"physical",targetType:shape,followUpOnCriticalOrDefeat:true,followUpMaxCasts:maxCasts}},
        getPartyCharacterIndex:e=>party.indexOf(e),getExistingPartyIndexes:()=>party.map((_,i)=>i),getPartyCharacterByIndex:i=>party[i],getPartyBattleStats:()=>({evasion:0,antiCrit:0,defense:0}),
        canSelectHostileBattlePrimary:(_,i)=>party[i].hp>0&&!party[i].stealth,
        resolveBattlefieldTargets:(_,i,type)=>type==="single"?[i]:party.map((_,j)=>j),
        normalizeBattleTargetType:x=>x,getEffectiveSkillTargetType:s=>s.targetType,
        isMonsterFrozen:()=>false,isMonsterPetrified:()=>false,getStatDownPercentFor:()=>0,
        getMonsterAccuracy:()=>0,getFinalHitReductionPercent:()=>0,getFinalAccuracyBonusPercent:()=>0,
        getActiveRageCriticalBonuses:()=>({damage:0}),getMonsterCriticalChance:()=>critical?100:0,rollHitChance:()=>true,
        CRIT_CHANCE_MIN_AFTER_ANTI_CRIT:1,CRIT_MULTIPLIER_MAX:3,
        calculateSkillDamage:()=>damage,calculateDamage:()=>damage,hasActiveBuff:()=>false,
        applySkillDebuffEffectsToPlayer:noop,getMonsterEffectiveAbilityPoints:()=>0,
        showPlayerHit:(amount,resource,index)=>hits.push(index),showMonsterSkillNameBadge:(...args)=>badges.push(args),
        addBattleLog:message=>logs.push(message),updateUI:noop,lungeMonsterCard:noop,
        document:{getElementById:()=>null,querySelectorAll:()=>[],readyState:"complete"},
        setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout:noop,
        finishPlayerAction(){if(interceptors.some(fn=>fn()))return;finishes++;},
        FourSymbolsBattleFlow:{interceptActionFinish(fn){interceptors.push(fn);return ()=>interceptors.splice(interceptors.indexOf(fn),1);}}
    };
    ctx.window=ctx;vm.createContext(ctx);
    for(const name of ["emitCombatEvent","getBattleDamageSource","getDamageContextAttacker","getFormalDamageContext","getCombatantHealthSnapshot","settleBattleHpDamage","isPartyDamageTarget","applyPlayerDirectIncomingModifiers","absorbPlayerShields","createEnemyActionTargetSnapshot","isEnemyActionTargetSnapshotCurrent","resolveEnemyActionTargets","retargetEnemyFollowUpSnapshot"]){
        if(main.includes("function "+name+"("))vm.runInContext(declaration(name),ctx);
    }
    vm.runInContext(declaration("processSingleMonsterAttack"),ctx);
    if(wrap)vm.runInContext(follow,ctx);
    return {ctx,party,hits,badges,logs,plan:()=>ctx.createEnemyActionTargetSnapshot(0,7),
        setRandom:value=>{random=value;},flush(){while(timers.length)timers.shift()();},get finishes(){return finishes;}};
}
for(const rank of ["regular","boss"]){
    test(rank+" fire critical follow-up keeps original living target",()=>{
        const r=runtime({rank});r.ctx.processSingleMonsterAttack(0,7);r.setRandom(.9);r.flush();
        assert.deepEqual(r.hits,[0,0]);assert.equal(r.finishes,1);assert.equal(r.ctx.monsters[0].sp,90);
    });
    test(rank+" lethal first hit retargets snapshot survivor",()=>{
        const r=runtime({rank,hp:[5,100,100]});r.ctx.processSingleMonsterAttack(0,7);r.flush();
        assert.deepEqual(r.hits,[0,1]);assert.equal(r.party[1].hp,90);assert.equal(r.finishes,1);
    });
}

for(const [skillId,maxCasts] of [["flameSlash",1],["fireCritical",1],["explosiveFlurry",1],["dragonSlash",2]]){
    test(skillId+" lethal chain retains cast limit, SP and once-only finish",()=>{
        const r=runtime({skillId,maxCasts,hp:[5,5,5],critical:false});r.setRandom(.05);
        r.ctx.processSingleMonsterAttack(0,7);r.flush();
        assert.deepEqual(r.hits,maxCasts===2?[0,1,2]:[0,1]);
        assert.equal(r.badges.length,maxCasts+1);assert.equal(r.ctx.monsters[0].sp,90);
        assert.equal(r.finishes,1);
    });
}
test("dragon retarget locks surviving B for second follow-up",()=>{
    const r=runtime({skillId:"dragonSlash",maxCasts:2,hp:[5,100,100]});
    r.ctx.processSingleMonsterAttack(0,7);r.flush();assert.deepEqual(r.hits,[0,1,1]);assert.equal(r.finishes,1);
});
test("A/B/C/D: revived D never enters lethal fallback roster",()=>{
    const r=runtime({skillId:"dragonSlash",maxCasts:2,hp:[5,5,100,0]});
    const snapshot=r.plan();r.party[3].hp=100;r.setRandom(.99);
    r.ctx.processSingleMonsterAttack(0,7,snapshot);r.flush();
    assert.deepEqual(r.hits,[0,2,2]);assert.equal(r.party[3].hp,100);
    assert.deepEqual(Array.from(snapshot.targets,e=>e.index),[0,1,2]);
});
test("lethal fallback excludes hidden/reused identities and stops when exhausted",()=>{
    const r=runtime({hp:[5,100,0]});const snapshot=r.plan();r.party[1].stealth=true;r.party[2].hp=100;
    r.ctx.processSingleMonsterAttack(0,7,snapshot);r.flush();assert.deepEqual(r.hits,[0]);assert.equal(r.finishes,1);
});
test("dead caster stops pending free cast and finishes once",()=>{
    const r=runtime({hp:[5,100,100]});r.ctx.processSingleMonsterAttack(0,7);r.ctx.monsters[0].hp=0;r.ctx.monsters[0].alive=false;
    r.flush();assert.deepEqual(r.hits,[0]);assert.equal(r.finishes,1);
});
test("noncritical nonlethal cast has no follow-up",()=>{
    const r=runtime({critical:false});const snapshot=r.plan();r.setRandom(.5);r.ctx.processSingleMonsterAttack(0,7,snapshot);r.flush();assert.deepEqual(r.hits,[0]);assert.equal(r.finishes,1);
});
test("tri geometry is resolved anew around retargeted primary",()=>{
    const r=runtime({shape:"tri",hp:[5,100,100]});const centers=[];
    r.ctx.resolveBattlefieldTargets=(_,i)=>{centers.push(i);return [i];};
    r.ctx.processSingleMonsterAttack(0,7);r.flush();assert.deepEqual(r.hits,[0,1]);assert.deepEqual([...new Set(centers)],[0,1]);
});
test("originally hidden primary candidate stays outside fallback after becoming visible",()=>{
    const r=runtime({hp:[5,100,100]});r.party[1].stealth=true;const snapshot=r.plan();r.party[1].stealth=false;
    r.ctx.processSingleMonsterAttack(0,7,snapshot);r.flush();assert.deepEqual(r.hits,[0,2]);assert.equal(r.party[1].hp,100);
});
