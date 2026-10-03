import fs from 'node:fs';
import vm from 'node:vm';
export function collectNonWildOutputs(loadRuntime){
 const {context:c}=loadRuntime();c.__gameplayBossTowerInstalled=false;
 const tower=fs.readFileSync('js/gameplay-boss-tower-system.js','utf8').replace('    window.GameplaySystem=Object.freeze({','    window.__nonWild={troop:buildTowerTroop,towerBoss:buildTowerBossMonster,boss:buildBossMonster};\n    window.GameplaySystem=Object.freeze({');
 vm.runInContext(tower,c);
 vm.runInContext(fs.readFileSync('js/adventure/adventure-content-v1-20260915.js','utf8'),c);
 delete c.FourSymbolsAdventure;
 const adventure=fs.readFileSync('js/adventure/adventure-runtime-v1-20260915.js','utf8').replace('    window.FourSymbolsAdventure=Object.freeze({','    window.__nonWildAdventure=buildEncounter;\n    window.FourSymbolsAdventure=Object.freeze({');
 vm.runInContext(adventure,c);
 return JSON.parse(vm.runInContext(`JSON.stringify((()=>{
  const fields=['name','level','element','rank','maxHP','maxSP','attack','magicAttack','defense','agility','attackPoints','intelligencePoints','vitalityPoints','energyPoints','defensePoints','agilityPoints','evasion','skillChance','vTowerDirectDamageMultiplier','vTowerCriticalBonusPercent','vTowerStatusAccuracyPercent'];
  const project=m=>Object.fromEntries(fields.filter(k=>m[k]!==undefined).map(k=>[k,m[k]]));const rows=[];
  for(const level of [1,10,30,50,70,100])for(const element of ['fire','water','wind','earth']){
   for(const rank of ['regular','elite'])rows.push({mode:'tower',level,element,rank,value:project(__nonWild.troop(level,element,rank,level,0))});
   const definition={id:'qa-boss',name:'Non-Wild Boss',level,element};
   rows.push({mode:'towerBoss',level,element,value:project(__nonWild.towerBoss(definition,level))});
   for(const mode of ['personal','world'])rows.push({mode,level,element,value:project(__nonWild.boss(definition,{mode,stage:2}))});
  }
  for(const id of Object.keys(FourSymbolsAdventureContent.encounters))rows.push({mode:'adventure',id,value:__nonWildAdventure(id).map(project)});
  return rows;
 })())`,c));
}
