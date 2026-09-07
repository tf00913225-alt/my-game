"use strict";
const fs=require("fs");
const vm=require("vm");
const assert=require("node:assert/strict");

const source=fs.readFileSync("js/60-team-relic-system.js","utf8");
const loader=fs.readFileSync("js/19-stage-v78-character-inventory-runtime.js","utf8");
const css=fs.readFileSync("css/55-team-relic-system.css","utf8");

assert.match(loader,/js\/60-team-relic-system\.js\?v=173\.63-relic1/);
assert.match(loader,/css\/55-team-relic-system\.css\?v=173\.63-relic1/);
assert.match(source,/const RELIC_BALANCE_CONFIG=Object\.freeze/);
assert.match(source,/playerRelics/);
assert.match(source,/teamLoadout=\{relicId:null,subRelicId:null\}/);
assert.match(source,/data\.playerRelics=playerRelics/);
assert.match(source,/data\.teamLoadout=\{relicId:teamLoadout\.relicId,subRelicId:null\}/);
assert.doesNotMatch(source,/localStorage\.setItem\([^\n]*relic/i,"relics must not create a separate localStorage save key");
[
    "battle_start","round_start","round_end","odd_round_start","odd_round_end","even_round_start","even_round_end",
    "every_n_rounds","enemy_action_count","ally_hit_count","ally_hp_below","ally_debuffed","enemy_defeated","ally_down",
    "before_lethal_damage","once_per_battle"
].forEach(type=>assert.ok(source.includes('triggerDef.type==="'+type+'"'),"trigger schema supports "+type));
assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
assert.match(css,/team-relic-tabs[\s\S]*overflow-x:auto/);
assert.match(css,/map-return\.png/);

function createRuntime(){
    const store=new Map();
    const party=[
        {id:"甲",level:30,hp:1000,sp:200,activeBuffs:[],statusEffects:[]},
        {id:"乙",level:30,hp:1000,sp:200,activeBuffs:[],statusEffects:[]},
        {id:"丙",level:30,hp:1000,sp:200,activeBuffs:[],statusEffects:[]}
    ];
    const monsters=Array.from({length:10},(_,i)=>({
        name:"怪"+i,rank:i===0?"boss":"regular",alive:true,hp:2000,maxHP:2000,sp:100,maxSP:100,
        attack:100,magicAttack:100,accuracy:100,statusEffects:[],activeBuffs:[]
    }));
    let enemyDamage=10;
    const document={
        readyState:"complete",body:{appendChild(){}},head:{appendChild(){}},documentElement:{dataset:{}},
        getElementById(){return null;},querySelector(){return null;},
        createElement(){return {className:"",id:"",style:{},classList:{add(){},remove(){},contains(){return false;}},setAttribute(){},appendChild(){},querySelector(){return null;}};},
        addEventListener(){}
    };
    const context={
        console,Math,Number,Object,Array,Set,Map,JSON,Date,Promise,setTimeout,clearTimeout,document,
        localStorage:{getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)},
        SAVE_KEY:"game-save",gold:100000,player:party[0],player2:party[1],player3:party[2],monsters,currentBattleMonsters:[0,1,2,3,4,5,6,7,8,9],
        battleActive:false,battleToken:0,turn:1,battlePhase:"resolve",initiativeIndex:0,initiativeQueue:[],
        getExistingPartyIndexes:()=>[0,1,2],getPartyCharacterByIndex:i=>party[i]||null,
        getPartyBattleStats:()=>({maxHP:1000,maxSP:200,attack:100,magicAttack:100,defense:100,evasion:0,resistance:0}),
        getMainCharacterStats:()=>({maxHP:1000,maxSP:200,attack:100,magicAttack:100,defense:100,evasion:0,resistance:0}),
        getPlayer2BattleStats:()=>({maxHP:1000,maxSP:200,attack:100,magicAttack:100,defense:100,evasion:0,resistance:0}),
        getPlayer3BattleStats:()=>({maxHP:1000,maxSP:200,attack:100,magicAttack:100,defense:100,evasion:0,resistance:0}),
        getMonsterRank:m=>m.rank||"regular",isMonsterFrozen:m=>!!m.frozen,isMonsterPetrified:m=>!!m.petrified,
        applyBurnEffect(m,d,p){if(m.statusEffects.some(s=>s.type==="burn"&&s.turnsLeft>0))return false;m.statusEffects.push({type:"burn",turnsLeft:d,percent:p});return true;},
        showPlayerHit(){},showMonsterHit(){},addBattleLog(){},updateUI(){},updateGoldDisplay(){},showPage(){},openHomeFeature(){},closeHomeFeature(){},
        killMonster(i){if(monsters[i])monsters[i].alive=false;},
        startTurn(){},
        startBattle(){this.battleActive=true;this.battleToken++;this.turn=1;this.startTurn(this.battleToken);},
        processNextCombatant(){},
        processSingleMonsterAttack(){const c=party[0];c.hp=Math.max(0,c.hp-enemyDamage);this.showPlayerHit(enemyDamage,"hp",0,false);},
        tickStatusEffects(){},
        winBattle(){this.battleActive=false;},loseBattle(){this.battleActive=false;}
    };
    context.window=context;
    context.saveGame=function(){store.set("game-save",JSON.stringify({player:{id:"甲"},gold:context.gold}));};
    store.set("game-save",JSON.stringify({player:{id:"甲"},gold:100000}));
    vm.createContext(context);
    vm.runInContext(source,context);
    return {context,store,party,monsters,setEnemyDamage:value=>{enemyDamage=value;}};
}

const runtime=createRuntime();
const {context,store,party,monsters}=runtime;
assert.equal(Object.keys(context.v174RelicSystem.catalog).length,20,"catalog has 20 relics");
assert.equal(Object.values(context.v174RelicSystem.catalog).filter(r=>r.runtimeReady).length,10,"first 10 relics are real runtime-ready relics");
assert.equal(Object.values(context.v174RelicSystem.catalog).filter(r=>!r.runtimeReady).length,10,"relics 11-20 remain locked placeholders");

assert.equal(context.v174EquipRelic("relic_qiankun_flask"),true);
let saved=JSON.parse(store.get("game-save"));
assert.equal(saved.teamLoadout.relicId,"relic_qiankun_flask");
assert.equal(saved.playerRelics.relic_qiankun_flask.unlocked,true);
assert.equal(Object.keys(saved.teamLoadout).filter(key=>/relic/i.test(key)).length,2,"one primary relic truth plus reserved disabled sub-relic field");

party.forEach(c=>c.hp=500);
context.startBattle();
assert.equal(context.v174EquipRelic("relic_sun_orb"),false,"hot swap is blocked during battle");
context.v174RelicDebugDispatch("round_end",{sourceType:"system"});
assert.ok(party.every(c=>c.hp>500),"Qiankun Flask heals on odd round end");
context.loseBattle();

context.v174EquipRelic("relic_sun_orb");
monsters.forEach(m=>{m.alive=true;m.hp=2000;});
context.startBattle();
context.turn=2;context.startTurn(context.battleToken);
assert.ok(monsters.some(m=>m.hp<2000),"Sun Orb damages all enemies on even round start");
assert.equal(context.v174RelicDebugState().enemyActionCount,0,"round trigger does not fake enemy actions");
context.loseBattle();

context.v174EquipRelic("relic_nine_dragon_fire");
monsters.forEach(m=>{m.alive=true;m.hp=2000;m.statusEffects=[];});party[0].hp=1000;runtime.setEnemyDamage(10);
context.startBattle();
for(let i=0;i<6;i++)context.processSingleMonsterAttack(1,context.battleToken);
assert.equal(context.v174RelicDebugState().enemyActionCount,6);
assert.ok(monsters.every(m=>m.hp===2000),"Nine Dragon does not fire before seven effective enemy actions");
context.processSingleMonsterAttack(1,context.battleToken);
assert.ok(monsters.some(m=>m.hp<2000),"Nine Dragon fires on the seventh effective enemy action");
assert.equal(context.v174RelicDebugState().enemyActionCount,0,"enemy action counter resets after trigger");
context.loseBattle();

context.v174EquipRelic("relic_nine_dragon_fire");
context.v174RelicSystem.getOwnedState().relic_nine_dragon_fire.level=10;
monsters.forEach(m=>{m.alive=true;m.hp=2000;m.statusEffects=[];});
monsters[1].statusEffects=[{type:"burn",turnsLeft:2,percent:9}];
const oldRandom=context.Math.random;context.Math.random=()=>0;
context.startBattle();for(let i=0;i<7;i++)context.processSingleMonsterAttack(1,context.battleToken);context.Math.random=oldRandom;
assert.equal(monsters[1].statusEffects.filter(s=>s.type==="burn").length,1,"relic burn reuses the formal burn owner and does not stack/refresh a duplicate");
context.loseBattle();

context.v174EquipRelic("relic_returning_wheel");
party[0].hp=100;party[0].activeBuffs=[];runtime.setEnemyDamage(500);context.startBattle();context.processSingleMonsterAttack(1,context.battleToken);
assert.ok(party[0].hp>1,"Returning Wheel prevents lethal finalization then heals");
assert.ok(party[0].activeBuffs.some(b=>b.type==="shield"&&b.remaining>0),"Returning Wheel uses the shared shield state");
assert.equal(context.v174RelicDebugState().totalTriggers,1);
party[0].hp=100;context.processSingleMonsterAttack(1,context.battleToken);
assert.equal(party[0].hp,0,"Returning Wheel is party-wide once per battle, not once per character");
context.loseBattle();

context.v174EquipRelic("relic_cold_spring_jade");party[0].hp=400;runtime.setEnemyDamage(100);context.startBattle();context.processSingleMonsterAttack(1,context.battleToken);
assert.ok(party[0].hp>300,"Cold Spring Jade emergency-heals below 35% HP");context.loseBattle();

context.v174EquipRelic("relic_xuanwu_seal");party.forEach(c=>{c.hp=1000;c.activeBuffs=[];});context.startBattle();context.turn=3;context.startTurn(context.battleToken);
assert.ok(party.every(c=>c.activeBuffs.some(b=>b.type==="shield")),"Xuanwu Seal triggers every third round");context.loseBattle();

context.v174EquipRelic("relic_tiangang_banner");monsters.forEach(m=>{m.alive=true;m.hp=2000;});party[0].hp=1000;runtime.setEnemyDamage(10);context.startBattle();
for(let i=0;i<6;i++)context.processSingleMonsterAttack(1,context.battleToken);
assert.ok(monsters.some(m=>m.hp<2000),"Tiangang Banner naturally charges from being outnumbered");
assert.equal(context.v174RelicDebugState().allyHitCount,0);context.loseBattle();

context.v174EquipRelic("relic_qinglan_feather");party[0].hp=1000;context.startBattle();
const boosted=context.getPartyBattleStats(0);assert.ok(boosted.evasion>=8&&boosted.resistance>=8,"Qinglan Feather feeds the shared party stat owner");context.loseBattle();

context.v174EquipRelic("relic_soul_bell");monsters.forEach(m=>{m.alive=true;m.attack=100;m.magicAttack=100;m.accuracy=100;});context.startBattle();context.turn=4;context.startTurn(context.battleToken);
assert.ok(monsters[1].attack<100,"Soul Bell applies actual live monster attack reduction");context.loseBattle();

context.v174EquipRelic("relic_rock_mountain_seal");party[0].hp=1000;context.startBattle();
assert.ok(context.getPartyBattleStats(0).defense>100,"Rock Mountain Seal opening defense uses the real shared stat owner");context.loseBattle();

context.v174EquipRelic("relic_qiankun_flask");context.startBattle();monsters[0].alive=true;context.killMonster(0);
assert.equal(context.v174RelicDebugState().lastEvent.event,"enemy_defeated","character-source kill reaches enemy_defeated event boundary");context.loseBattle();

const beforeLevel=context.v174RelicSystem.getOwnedState().relic_qiankun_flask.level;
assert.equal(context.v174UpgradeRelic("relic_qiankun_flask"),true);
assert.equal(context.v174RelicSystem.getOwnedState().relic_qiankun_flask.level,beforeLevel+1);
saved=JSON.parse(store.get("game-save"));
assert.equal(saved.playerRelics.relic_qiankun_flask.level,beforeLevel+1,"upgrade persists in the existing SAVE_KEY document");

assert.equal(context.v174EquipRelic("relic_origin_talisman"),false,"locked/non-runtime relic can never become a fake usable relic");
context.v174UnequipRelic();
saved=JSON.parse(store.get("game-save"));assert.equal(saved.teamLoadout.relicId,null,"unequip persists relicId=null");

console.log("✓ V174 team relic system integration tests passed.");
