const test=require('node:test');
const assert=require('node:assert/strict');
const createRuntime=require('../scripts/test-helpers/relic-runtime-fixture.cjs');
function setup(id,level=1){
    const r=createRuntime({}),c=r.context;
    c.v174RelicDevUnlock(id);c.v174RelicSystem.getOwnedState()[id].level=level;
    assert.equal(c.v174EquipRelic(id),true);c.startBattle();
    r.emit=(type,event)=>c.FourSymbolsCombatEvents.emit(type,event);
    r.round=round=>{c.turn=round;c.startTurn();};
    r.end=()=>r.advanceRound();
    return r;
}
function startAction(r,index,enemy=true){
    const action={token:r.context.battleToken,index,entity:enemy?r.monsters[0]:r.party[0],entry:{type:enemy?'monster':'player'}};
    r.context.battleDurationAction=action;r.emit('action_started',{action});return action;
}
for(const [level,anchor] of [[1,0],[10,1],[20,2]]){
    test('Lv'+level+' rock armor direct incoming action once, source exclusions and last-charge shield',()=>{
        const r=setup('relic_rock_mountain_seal',level),c=r.context,p=r.party[0],a=startAction(r,0);
        const direct=()=>c.applyPlayerDirectIncomingModifiers(p,100,{attacker:r.monsters[0]});
        assert.equal(direct(),100-[8,10,12][anchor]);assert.equal(direct(),100-[8,10,12][anchor]);
        assert.equal(c.applyPlayerDirectIncomingModifiers(p,100,{attacker:r.monsters[0],sourceType:'dot',damageKind:'dot'}),100);
        r.emit('action_finished',{action:a});startAction(r,1);assert.equal(direct(),100-[8,10,12][anchor]);
        assert.equal(c.FourSymbolsPlayerShield.remaining(p),level===20?60:0);
        startAction(r,2);assert.equal(direct(),100);
    });
    test('Lv'+level+' origin deterministic cleanse and unconditional team heal',()=>{
        const r=setup('relic_origin_talisman',level);r.party.forEach(p=>p.hp=500);
        r.party[0].statusEffects=[{type:'burn',turnsLeft:3},{type:'freeze',turnsLeft:3},{type:'poison',turnsLeft:3},{type:'stun',turnsLeft:3,uncleansable:true}];
        r.party[1].statusEffects=[{type:'burn',turnsLeft:3},{type:'freeze',turnsLeft:3},{type:'poison',turnsLeft:3}];
        r.context.turn=4;r.end();assert.equal(r.party[0].hp,500+[60,80,100][anchor]);
        assert.equal(r.party[0].statusEffects.length,4-[1,2,3][anchor]);assert.equal(r.party[1].statusEffects.length,3);
        assert.ok(r.party[0].statusEffects.some(s=>s.uncleansable));
        r.party.forEach(p=>p.statusEffects=[]);r.context.turn=8;r.end();assert.equal(r.party[0].hp,500+2*[60,80,100][anchor]);
    });
    test('Lv'+level+' red sky formal damage and crit source gates',()=>{
        const r=setup('relic_red_sky_war_mark',level),owner=r.context.v174RelicDamageModifiers,p=r.party[0];
        for(const source of ['normalAttack','activeSkill']){assert.equal(owner.ordinaryBonus(p,source),[6,8,10][anchor]);assert.equal(owner.critBonus(p,source),[4,6,8][anchor]);}
        for(const source of ['dot','relic','counter','followUp','reflect','item','hpCost','environment']){assert.equal(owner.ordinaryBonus(p,source),0);assert.equal(owner.critBonus(p,source),0);}
        r.end();r.end();assert.equal(owner.ordinaryBonus(p,'normalAttack'),level===20?10:0);if(level===20){r.end();assert.equal(owner.ordinaryBonus(p,'normalAttack'),0);}
    });
    test('Lv'+level+' ice mirror unconditional damage with legal general debuff bonus only',()=>{
        const r=setup('relic_ice_mirror_heart',level),c=r.context,power=c.v174RelicSystem.getRelicPower('relic_ice_mirror_heart');
        r.monsters[1].statusEffects=[{type:'attackDown',turnsLeft:2}];r.monsters[2].statusEffects=[{type:'internal',turnsLeft:2}];
        c.turn=3;r.end();const base=power*[.85,1,1.15][anchor];
        assert.equal(r.monsters[2].hp,2000-Math.floor(base));assert.equal(r.monsters[1].hp,2000-Math.floor(base*(1+[.15,.2,.25][anchor])));
    });
    test('Lv'+level+' wind cycle real spend refund, each actor once and next action expiry',()=>{
        const r=setup('relic_wind_chasing_talisman',level),c=r.context,p=r.party[0];r.round(3);p.sp=100;
        r.emit('skill_completed',{actor:p,actualSpent:7,sourceType:'counter'});assert.equal(p.sp,100);
        r.emit('skill_completed',{actor:p,actualSpent:7,sourceType:'activeSkill'});assert.equal(p.sp,100+Math.floor(7*[.15,.2,.25][anchor]));
        assert.equal(c.v174GetRelicFinalEvasionPercent(0),[8,10,12][anchor]);
        r.emit('skill_completed',{actor:p,actualSpent:100,sourceType:'activeSkill'});assert.equal(p.sp,100+Math.floor(7*[.15,.2,.25][anchor]));
        startAction(r,0,false);assert.equal(c.v174GetRelicFinalEvasionPercent(0),0);
        const p2=r.party[1];p2.sp=10;r.emit('skill_completed',{actor:p2,actualSpent:0,sourceType:'activeSkill'});assert.equal(p2.sp,10);
    });
    test('Lv'+level+' mountain snapshot exact 30%, actual enemy loss, per-round and per-battle caps',()=>{
        const r=setup('relic_mountain_river_cauldron',level),c=r.context,p=r.party[0];
        assert.equal(c.v174RelicDebugState().roundMaxHp,3000);
        c.settleBattleHpDamage(p,899,{attacker:r.monsters[0],sourceType:'dot',damageKind:'dot'});assert.equal(c.v174RelicDebugState().totalTriggers,0);
        c.settleBattleHpDamage(p,1,{attacker:r.monsters[0],sourceType:'dot',damageKind:'dot'});assert.equal(c.v174RelicDebugState().totalTriggers,1);
        assert.equal(p.hp,100+[80,100,120][anchor]);assert.equal(c.v174RelicDamageModifiers.incomingReduction(p),[10,12,15][anchor]);
        assert.equal(c.FourSymbolsPlayerShield.remaining(p),level===20?80:0);
        c.settleBattleHpDamage(r.party[1],999,{attacker:r.monsters[0]});assert.equal(c.v174RelicDebugState().totalTriggers,1);
        r.round(2);assert.equal(c.v174RelicDebugState().roundHpLoss,0);
        c.settleBattleHpDamage(r.party[2],900,{attacker:r.party[2],sourceType:'self'});assert.equal(c.v174RelicDebugState().roundHpLoss,0);
    });
    test('Lv'+level+' burning star crossing survives, no burn requirement and round cap',()=>{
        const r=setup('relic_burning_star_mark',level),c=r.context,power=c.v174RelicSystem.getRelicPower('relic_burning_star_mark');
        c.settleBattleHpDamage(r.monsters[1],1000,{attacker:r.party[0],sourceType:'normalAttack'});
        assert.equal(r.monsters[1].hp,1000-Math.floor(power*[.9,1.1,1.3][anchor]));
        c.settleBattleHpDamage(r.monsters[2],1000,{attacker:r.party[0]});assert.equal(r.monsters[2].hp,1000);
        r.round(2);c.settleBattleHpDamage(r.monsters[3],2000,{attacker:r.party[0]});assert.equal(c.v174RelicDebugState().roundTriggerCounts['relic_burning_star_mark:hp_cross_50']||0,0);
        r.monsters[1].hp=1500;c.settleBattleHpDamage(r.monsters[1],1000,{attacker:r.party[0]});assert.equal(r.monsters[1].hp,Math.max(0,500-Math.floor(power*[.9,1.1,1.3][anchor]*(level===20?1.3:1))));
    });
    test('Lv'+level+' spirit spring living-only HP/SP restoration and caps',()=>{
        const r=setup('relic_spirit_spring_bottle',level);r.party[0].sp=0;r.party[0].hp=500;r.party[1].hp=0;r.party[1].sp=0;
        r.context.turn=3;r.end();assert.equal(r.party[0].sp,[16,20,24][anchor]);assert.equal(r.party[0].hp,500+[0,30,50][anchor]);assert.equal(r.party[1].sp,0);assert.equal(r.party[1].hp,0);
    });
    test('Lv'+level+' demon seal independent committed-status insurance preserves protected states',()=>{
        const r=setup('relic_demon_suppressing_seal',level),c=r.context;
        assert.equal(c.v174ProjectRelicBattleStats(0,{resistance:0,statusResistance:0}).statusResistance,[6,10,15][anchor]);
        const write=(index,protectedState=false)=>{const state={type:'freeze',turnsLeft:2,uncleansable:protectedState};r.party[index].statusEffects.push(state);r.emit('status_written',{target:r.party[index],state});return state;};
        write(0,true);assert.equal(r.party[0].statusEffects.length,1);write(0);assert.equal(r.party[0].statusEffects.length,1);
        write(0);assert.equal(r.party[0].statusEffects.length,2);write(1);assert.equal(r.party[1].statusEffects.length,0);
        r.end();r.end();r.end();assert.equal(c.v174ProjectRelicBattleStats(0,{resistance:0,statusResistance:0}).statusResistance,0);
    });
}
test('broken army only character normal/active kills, HP ratio targeting and no recursive kill',()=>{
    for(const source of ['normalAttack','activeSkill','relic','dot','counter','followUp','reflect','environment']){
        const r=setup('relic_broken_army_scroll',20),c=r.context;r.monsters[1].hp=150;r.monsters[1].maxHP=1000;r.monsters[2].hp=200;r.monsters[2].maxHP=2000;
        c.settleBattleHpDamage(r.monsters[3],2000,{attacker:r.party[0],sourceType:source});
        assert.equal(r.monsters[2].hp,['normalAttack','activeSkill'].includes(source)?0:200);assert.equal(r.monsters[1].hp,150);
        if(['normalAttack','activeSkill'].includes(source)){assert.equal(c.v174RelicDebugState().totalTriggers,1);}
    }
});
test('adaptive array exact average boundaries and formal skill-only final damage',()=>{
    for(const [hp,form] of [[400,'生'],[401,'和'],[750,'和'],[751,'勢']]){
        const r=setup('relic_all_returning_array',20),c=r.context;r.party.forEach(p=>p.hp=hp);r.party[2].hp=0;r.round(4);
        const mod=c.v174RelicDebugState().playerMods[0][0];assert.ok(mod.statusName.endsWith(form));
        if(form==='勢'){assert.equal(c.v174RelicDamageModifiers.skillFinalBonus(r.party[0],'activeSkill'),20);for(const source of ['normalAttack','counter','followUp','dot','relic']){assert.equal(c.v174RelicDamageModifiers.skillFinalBonus(r.party[0],source),0);}}
        if(form==='和'){assert.equal(c.v174ProjectRelicBattleStats(0,{attack:100,magicAttack:100,defense:100,statusResistance:0}).attack.toFixed(6),"115.000000");}
        if(form==='生'){assert.equal(r.party[0].hp,580);assert.equal(c.v174RelicDamageModifiers.incomingReduction(r.party[0]),12);}
        r.end();r.end();assert.equal(c.v174RelicDebugState().playerMods[0].length,0);
    }
});
test('nine dragon complete actions cross-round, misses count and hard-control skips do not',()=>{
    const r=setup('relic_nine_dragon_fire'),c=r.context;
    for(let i=0;i<6;i++){const action=startAction(r,i);r.emit('action_finished',{action});r.emit('action_finished',{action});}
    assert.equal(c.v174RelicDebugState().enemyActionCount,6);r.round(2);assert.equal(c.v174RelicDebugState().enemyActionCount,6);
    r.monsters[0].frozen=true;let action=startAction(r,0);r.emit('action_finished',{action});assert.equal(c.v174RelicDebugState().enemyActionCount,6);
    r.monsters[0].frozen=false;action=startAction(r,1);r.emit('action_finished',{action});assert.equal(c.v174RelicDebugState().enemyActionCount,0);assert.equal(c.v174RelicDebugState().totalTriggers,1);
});

test('fixed battlefield and party slots break equal-ratio and cleanse ties',()=>{
    let r=setup('relic_broken_army_scroll'),c=r.context;
    c.FourSymbolsBattlefieldSlots={enemySlots:['front','rear'],getActiveEnemySnapshot:()=>({}),getEnemySlotForMonster:(s,i)=>i===2?'front':'rear'};
    r.monsters[0].hp=2000;r.monsters[1].hp=1000;r.monsters[2].hp=1000;
    const power=c.v174RelicSystem.getRelicPower('relic_broken_army_scroll');
    c.settleBattleHpDamage(r.monsters[3],2000,{attacker:r.party[0],sourceType:'normalAttack'});
    assert.equal(r.monsters[1].hp,1000);assert.equal(r.monsters[2].hp,1000-Math.floor(power*.9));
    r=setup('relic_origin_talisman');c=r.context;
    c.FourSymbolsBattlefieldSlots={allySlots:['front','rear'],getAllySlotForCharacter:i=>i===1?'front':'rear'};
    r.party.forEach(p=>{p.hp=500;p.statusEffects=[{type:'poison',turnsLeft:3}];});c.turn=4;r.end();
    assert.equal(r.party[1].statusEffects.length,0);assert.equal(r.party[0].statusEffects.length,1);
});
test('nine dragon can trigger twice in the same round after fourteen complete actions',()=>{
    const r=setup('relic_nine_dragon_fire'),c=r.context;
    for(let i=0;i<14;i++){const action=startAction(r,i);r.emit('action_finished',{action});}
    assert.equal(c.v174RelicDebugState().totalTriggers,2);assert.equal(c.v174RelicDebugState().enemyActionCount,0);
});
for(const [level,anchor] of [[1,0],[10,1],[20,2]]){
    test('Lv'+level+' broken army exact scalar and one activation per round',()=>{
        const r=setup('relic_broken_army_scroll',level),c=r.context;
        r.monsters[1].hp=1500;r.monsters[2].hp=1600;
        const power=c.v174RelicSystem.getRelicPower('relic_broken_army_scroll');
        c.settleBattleHpDamage(r.monsters[3],2000,{attacker:r.party[0],sourceType:'activeSkill'});
        assert.equal(r.monsters[1].hp,1500-Math.floor(power*[.9,1.15,1.4][anchor]));
        c.settleBattleHpDamage(r.monsters[2],2000,{attacker:r.party[0],sourceType:'normalAttack'});assert.equal(c.v174RelicDebugState().totalTriggers,1);
    });
    test('Lv'+level+' adaptive array each mode anchors and round-end expiry',()=>{
        for(const hp of [400,600,900]){
            const r=setup('relic_all_returning_array',level),c=r.context;r.party.forEach(p=>{p.hp=hp;p.statusEffects=[{type:'poison',turnsLeft:5}];});r.round(4);
            if(hp===400){assert.equal(r.party[0].hp,hp+[120,150,180][anchor]);assert.equal(c.v174RelicDamageModifiers.incomingReduction(r.party[0]),[8,10,12][anchor]);assert.equal(r.party[0].statusEffects.length,level===20?0:1);}
            if(hp===600){const stats=c.v174ProjectRelicBattleStats(0,{attack:100,defense:100,statusResistance:0});assert.ok(Math.abs(stats.attack-(100+[10,12,15][anchor]))<1e-9);assert.ok(Math.abs(stats.defense-stats.attack)<1e-9);assert.equal(stats.statusResistance,level===20?10:0);}
            if(hp===900){assert.equal(c.v174RelicDamageModifiers.skillFinalBonus(r.party[0],'activeSkill'),[10,15,20][anchor]);}
            r.party[0].hp=100;r.end();assert.ok(c.v174RelicDebugState().playerMods[0].length);r.end();assert.equal(c.v174RelicDebugState().playerMods[0].length,0);
        }
    });
    test('Lv'+level+' wind rounding minimum, actual-spend maximum and independent actors',()=>{
        const r=setup('relic_wind_chasing_talisman',level);r.round(3);
        r.party.forEach(p=>p.sp=0);
        r.emit('skill_completed',{actor:r.party[0],actualSpent:1,sourceType:'activeSkill'});assert.equal(r.party[0].sp,1);
        r.emit('skill_completed',{actor:r.party[1],actualSpent:0,sourceType:'activeSkill'});assert.equal(r.party[1].sp,0);
        r.emit('skill_completed',{actor:r.party[2],actualSpent:19,sourceType:'activeSkill'});assert.equal(r.party[2].sp,Math.floor(19*[.15,.2,.25][anchor]));
        r.end();assert.ok(!r.party[1].activeBuffs.some(b=>b.sourceId==='wind_cycle_window'));
    });
}
test('mountain two activations per battle, round reset and actual overkill clamp',()=>{
    const r=setup('relic_mountain_river_cauldron'),c=r.context;
    for(let round=1;round<=3;round++){
        r.party.forEach(p=>p.hp=1000);if(round>1)r.round(round);
        c.settleBattleHpDamage(r.party[0],900,{attacker:r.monsters[0]});assert.equal(c.v174RelicDebugState().totalTriggers,Math.min(round,2));
    }
    r.round(4);r.party[0].hp=20;c.settleBattleHpDamage(r.party[0],99999,{attacker:r.monsters[0]});assert.equal(c.v174RelicDebugState().roundHpLoss,20);
});
