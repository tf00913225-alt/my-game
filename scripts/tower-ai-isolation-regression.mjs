import fs from 'node:fs';import vm from 'node:vm';import {execFileSync} from 'node:child_process';import assert from 'node:assert/strict';
import {loadLegacyRuntime} from './monster-balance-shadow-matrix.mjs';
// Explicit historical source comparison; run with a fetched base commit. Not a shallow-clone CI bypass.
const base=process.argv[2]||'ed8d5a0fc03f4a838a34bba48a87cb5c56c289c3',original=fs.readFileSync;
function load(baseline){
 const overrides=new Map();
 for(const path of ['js/00-main.js','js/36-v141-content-systems.js','js/gameplay-boss-tower-system.js']){
  let source=baseline?execFileSync('git',['show',base+':'+path],{encoding:'utf8',maxBuffer:2000000}):original(path,'utf8');
  if(path.endsWith('gameplay-boss-tower-system.js'))source=source.replace('    window.GameplaySystem=Object.freeze({','    window.__isolationBuildBoss=buildBossMonster;\n    window.GameplaySystem=Object.freeze({');
  overrides.set(path,source);
 }
 fs.readFileSync=function(path,...args){return overrides.has(String(path))?overrides.get(String(path)):original.call(this,path,...args);};
 let c;try{c=loadLegacyRuntime().context;}finally{fs.readFileSync=original;}
 vm.runInContext(original('tests/fixtures/wild-balance-reference-party.js','utf8'),c);
 return c;
}
function sequence(c,mode,seed){c.__input={mode,seed};return JSON.parse(vm.runInContext(`JSON.stringify((()=>{
 let seed=__input.seed;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 battleActive=false;prepareWildBalanceReferenceParty(100,3);saveGame=()=>{};updateUI=()=>{};finishPlayerAction=()=>{};
 const mode=__input.mode;
 let roster;
 if(mode==='personalBoss'||mode==='worldBoss'){
  const defs=mode==='worldBoss'?GameplaySystem.worldBosses:GameplaySystem.personalBosses;
  const def=defs.find(d=>d.element==='water');roster=[__isolationBuildBoss(def,{mode:mode==='worldBoss'?'world':'personal',stage:3})];
 }else if(mode==='abyss'){roster=v174AbyssBuildWaves(40,0,0)[0];}
 else {roster=Array.from({length:6},(_,i)=>{const m=MonsterBalance.build({monsterKey:'isolation.'+i,name:'isolation '+i,mode,rank:'regular',element:'water',archetype:i%3===2?'support':'magic',level:100,context:mode+'/isolation',...(mode==='daily'?{dailyType:'exp',wave:1,slot:i,partySize:3,highestPartyLevel:100,skillFrequency:.6}:{})});v144ConfigureMonsterEncounterSkills(m,'isolation');return m;});}
 monsters=roster;currentBattleMonsters=roster.map((m,i)=>i);currentZone=mode==='wild'?'zone10':'dungeon';v132ActiveDungeonRun=mode==='wild'?null:{mode:mode==='personalBoss'||mode==='worldBoss'?'boss':mode};
 battleActive=true;battleToken++;battlePhase='resolve';FourSymbolsBattlefieldSlots.clearActiveEnemySnapshot();v138EnsureEnemyFormationSnapshot(currentBattleMonsters);
 const casts=[];showMonsterSkillNameBadge=(name,element,index)=>casts.push({round:turn,name,element,index});
 const snapshots=[];
 for(let n=1;n<=6;n++){
  turn=n;notifyBattleRoundBoundary('round_start',battleToken);
  for(const i of currentBattleMonsters){
   monsters[i].hp=Math.max(1,Math.floor(monsters[i].maxHP*(n%2?.35:.8)));
   for(const index of getExistingPartyIndexes()){const p=getPartyCharacterByIndex(index);p.hp=getPartyBattleStats(index).maxHP;p.statusEffects=[];}
   processSingleMonsterAttack(i,battleToken);
   snapshots.push({round:n,index:i,hp:monsters.map(m=>m.hp),sp:monsters.map(m=>m.sp),party:getExistingPartyIndexes().map(k=>getPartyCharacterByIndex(k).hp)});
  }
  notifyBattleRoundBoundary('round_end',battleToken);
 }
 battleActive=false;return {casts,snapshots};
})())`,c));}
const old=load(true),current=load(false),cases=[];
for(const mode of ['wild','daily','personalBoss','worldBoss','abyss'])for(const seed of [1,7,42,123]){
 const before=sequence(old,mode,seed),after=sequence(current,mode,seed);assert.deepEqual(after,before,mode+'/'+seed);cases.push({mode,seed,casts:after.casts.length,matched:true});
}
fs.mkdirSync('artifacts/tower-ai-diversity',{recursive:true});
fs.writeFileSync('artifacts/tower-ai-diversity/isolation.json',JSON.stringify({base,cases},null,2));console.log(JSON.stringify({cases:cases.length,matched:cases.filter(x=>x.matched).length}));
