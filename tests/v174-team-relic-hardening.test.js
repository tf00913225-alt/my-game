"use strict";
const fs=require("fs"),vm=require("vm"),assert=require("node:assert/strict");
const source=fs.readFileSync("js/60-team-relic-system.js","utf8");

function make(){
 const store=new Map([["save",JSON.stringify({player:{id:"甲"},gold:99999})]]);
 const party=[{id:"甲",level:30,hp:1000,sp:200,activeBuffs:[],statusEffects:[]},{id:"乙",level:30,hp:1000,sp:200,activeBuffs:[],statusEffects:[]},{id:"丙",level:30,hp:1000,sp:200,activeBuffs:[],statusEffects:[]}];
 const monsters=Array.from({length:10},(_,i)=>({name:"怪"+i,alive:true,rank:"regular",hp:2000,maxHP:2000,attack:100,magicAttack:100,accuracy:100,statusEffects:[]}));
 let mode="hp",damage=10; const startSeen=[];
 const doc={readyState:"complete",body:{appendChild(){}},getElementById(){return null;},createElement(){return {classList:{add(){},remove(){}},style:{},setAttribute(){},appendChild(){},offsetWidth:1};},addEventListener(){}};
 const c={console,Math,Number,Object,Array,Set,Map,JSON,Date,Promise,setTimeout,clearTimeout,document:doc,SAVE_KEY:"save",localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,String(v))},gold:99999,player:party[0],player2:party[1],player3:party[2],monsters,currentBattleMonsters:[0,1,2,3,4,5,6,7,8,9],battleActive:false,battleToken:0,turn:1,battlePhase:"resolve",initiativeIndex:0,initiativeQueue:[],
 getExistingPartyIndexes:()=>[0,1,2],getPartyCharacterByIndex:i=>party[i],getPartyBattleStats:()=>({maxHP:1000,maxSP:200,attack:100,magicAttack:100,defense:100,evasion:0,resistance:0}),getMainCharacterStats:()=>({maxHP:1000,maxSP:200,defense:100}),getPlayer2BattleStats:()=>({maxHP:1000,maxSP:200,defense:100}),getPlayer3BattleStats:()=>({maxHP:1000,maxSP:200,defense:100}),getMonsterRank:m=>m.rank,isMonsterFrozen:m=>!!m.frozen,isMonsterPetrified:m=>!!m.petrified,
 showPlayerHit(){},showMonsterHit(){},addBattleLog(){},updateUI(){},updateGoldDisplay(){},showPage(){},openHomeFeature(){},closeHomeFeature(){},saveGame(){},killMonster(i){monsters[i].alive=false;},applyBurnEffect(e,d,p){if(e.statusEffects.some(x=>x.type==="burn"&&x.turnsLeft>0))return false;e.statusEffects.push({type:"burn",turnsLeft:d,percent:p});return true;},applyFreezeEffect(e,d=2){if(e.statusEffects.some(x=>x.type==="freeze"&&x.turnsLeft>0))return false;e.statusEffects.push({type:"freeze",turnsLeft:d});return true;},
 startTurn(){startSeen.push(this.v174RelicDebugState&&this.v174RelicDebugState()?.relicId||null);},startBattle(){this.battleActive=true;this.battleToken++;this.turn=1;this.startTurn(this.battleToken);},processNextCombatant(){},processSingleMonsterAttack(){const p=party[0];if(mode==="shield"){const s=p.activeBuffs.find(b=>b.type==="shield");s.remaining=Math.max(0,s.remaining-damage);}else{p.hp=Math.max(0,p.hp-damage);this.showPlayerHit(damage,"hp",0,false);}},tickStatusEffects(){},winBattle(){this.battleActive=false;},loseBattle(){this.battleActive=false;}};
 c.saveGame=function(){store.set("save",JSON.stringify({player:{id:"甲"},gold:c.gold}));}; c.window=c;vm.createContext(c);vm.runInContext(source,c);return {c,party,monsters,startSeen,setMode:v=>mode=v,setDamage:v=>damage=v};
}
{
 const r=make(); r.c.v174EquipRelic("relic_qinglan_feather");r.c.startBattle();assert.equal(r.startSeen[0],"relic_qinglan_feather","battle state exists before original startTurn runs");r.c.loseBattle();
}
{
 const r=make();r.c.v174EquipRelic("relic_sun_orb");r.c.startBattle();r.c.turn=2;r.monsters.forEach(m=>m.hp=2000);r.c.startTurn(r.c.battleToken);const after=r.monsters[1].hp;r.c.v174RelicDebugDispatch("round_start",{sourceType:"system"});assert.equal(r.monsters[1].hp,after,"duplicate round boundary cannot trigger twice");r.c.loseBattle();
}
{
 const r=make();r.c.v174EquipRelic("relic_tiangang_banner");r.c.startBattle();r.party[0].activeBuffs=[{type:"shield",turnsLeft:9,remaining:1000,amount:1000}];r.setMode("shield");r.setDamage(10);for(let i=0;i<6;i++)r.c.processSingleMonsterAttack(1);assert.ok(r.monsters.some(m=>m.hp<2000),"fully shielded effective attacks still count once per enemy action");r.c.loseBattle();
}
{
 const r=make();r.c.v174EquipRelic("relic_cold_spring_jade");r.party[0].hp=400;r.setDamage(100);r.c.startBattle();r.c.processSingleMonsterAttack(1);assert.equal(r.c.v174RelicDebugState().totalTriggers,1);r.party[0].hp=300;r.c.turn=4;r.setDamage(10);r.c.processSingleMonsterAttack(1);assert.equal(r.c.v174RelicDebugState().totalTriggers,1,"staying below 35 percent does not retrigger without a fresh crossing");r.c.loseBattle();
}
{
 const r=make();r.c.v174EquipRelic("relic_qiankun_flask");r.c.startBattle();r.c.applyFreezeEffect(r.party[0],2);assert.equal(r.c.v174RelicDebugState().lastEvent.event,"ally_debuffed","real shared status owner emits ally_debuffed");r.c.loseBattle();
}
assert.match(source,/formalMaterialSource:null/);assert.match(source,/boundaryEvents:\{\}/);assert.match(source,/shieldAfter<entry\.shield/);assert.match(source,/previousHpPercent/);
console.log("✓ relic hardening tests passed");
